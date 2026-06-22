// novi-api — API gateway untuk agen Novi (OpenClaw) mengakses data Zena milik Rasyid.
//
// Keamanan:
//  - Auth pakai Bearer token rahasia (secret NOVI_API_KEY). Salah → 401.
//  - SEMUA operasi dipaksa scope ke 1 user (NOVI_USER_ID / resolve dari NOVI_USER_EMAIL).
//  - Tabel kredensial bank (bank_connections, bank_connection_audit_log) DIBLOKIR keras.
//  - Pakai service role internal (pola secretkeynew yang sudah dipakai function lain).
//
// Cara panggil: POST { "action": "...", ...params }  +  header Authorization: Bearer <NOVI_API_KEY>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = (Deno.env.get('secretkeynew') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!
const NOVI_API_KEY = Deno.env.get('NOVI_API_KEY') ?? ''
const NOVI_USER_EMAIL = Deno.env.get('NOVI_USER_EMAIL') ?? 'rasyid@zena.app'
let NOVI_USER_ID = Deno.env.get('NOVI_USER_ID') ?? ''

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// === Whitelist tabel ===
// Tabel yang punya kolom user_id → otomatis di-scope user_id.
const USER_TABLES = new Set([
  'transactions', 'user_wallets', 'recurring_transactions', 'reminders',
  'investment_holdings', 'investment_transactions',
  'projects', 'receivables', 'products', 'stock_movements', 'tax_summary',
  'documents', 'business_profile', 'business_bank_accounts',
  'user_preferences', 'notifications', 'ai_insights',
])
// Tabel anak (tanpa user_id) → diverifikasi lewat kepemilikan baris induk.
const CHILD_TABLES: Record<string, { parent: string; fk: string }> = {
  project_terms: { parent: 'projects', fk: 'project_id' },
  transaction_items: { parent: 'transactions', fk: 'transaction_id' },
  product_variants: { parent: 'products', fk: 'product_id' },
}
// Tabel yang DILARANG keras (kredensial bank konvensional).
const BLOCKED_TABLES = new Set(['bank_connections', 'bank_connection_audit_log'])

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

class ApiError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

// Tanggal hari ini WIB (UTC+7), format YYYY-MM-DD
function todayWIB(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

async function getUserId(): Promise<string> {
  if (NOVI_USER_ID) return NOVI_USER_ID
  const { data, error } = await admin.auth.admin.listUsers()
  if (error) throw new ApiError('Gagal resolve user: ' + error.message, 500)
  const u = data.users.find((x) => (x.email ?? '').toLowerCase() === NOVI_USER_EMAIL.toLowerCase())
  if (!u) throw new ApiError(`User ${NOVI_USER_EMAIL} tidak ditemukan`, 500)
  NOVI_USER_ID = u.id
  return u.id
}

function assertTableAllowed(table: string, allowChild = true) {
  if (!table) throw new ApiError('Parameter "table" wajib diisi')
  if (BLOCKED_TABLES.has(table)) throw new ApiError(`Tabel "${table}" diblokir (data bank konvensional)`, 403)
  if (USER_TABLES.has(table)) return 'user'
  if (allowChild && CHILD_TABLES[table]) return 'child'
  throw new ApiError(`Tabel "${table}" tidak diizinkan`, 403)
}

async function assertParentOwned(uid: string, child: string, fkValue: unknown) {
  const meta = CHILD_TABLES[child]
  if (!fkValue) throw new ApiError(`Field "${meta.fk}" wajib untuk tabel "${child}"`)
  const { data, error } = await admin.from(meta.parent).select('id, user_id').eq('id', fkValue).maybeSingle()
  if (error) throw new ApiError(error.message, 500)
  if (!data || (data as { user_id: string }).user_id !== uid) {
    throw new ApiError('Akses ditolak: baris induk bukan milik user', 403)
  }
}

// === Wallet helpers ===
async function loadWallets(uid: string) {
  const { data, error } = await admin
    .from('user_wallets')
    .select('id, wallet_name, wallet_function, icon, color, current_balance')
    .eq('user_id', uid)
    .eq('is_active', true) // samakan dgn app: dompet non-aktif/diarsipkan tidak dihitung
    .order('created_at', { ascending: true })
  if (error) throw new ApiError(error.message, 500)
  return data ?? []
}

async function resolveWallet(uid: string, p: Record<string, unknown>) {
  const wallets = await loadWallets(uid)
  if (wallets.length === 0) throw new ApiError('User belum punya dompet', 400)
  if (p.wallet_id) {
    const w = wallets.find((x) => x.id === p.wallet_id)
    if (!w) throw new ApiError('wallet_id tidak ditemukan', 404)
    return w
  }
  if (p.wallet_name) {
    const name = String(p.wallet_name).toLowerCase()
    const w = wallets.find((x) => (x.wallet_name ?? '').toLowerCase().includes(name))
    if (!w) throw new ApiError(`Dompet "${p.wallet_name}" tidak ditemukan`, 404)
    return w
  }
  return wallets[0] // default: dompet pertama
}

// === Actions ===

// Catat transaksi income/expense + update saldo dompet (mirror logic app)
async function recordTransaction(uid: string, p: Record<string, unknown>) {
  const type = String(p.type ?? '').toLowerCase()
  if (type === 'transfer') return transferTransaction(uid, p)
  if (type !== 'income' && type !== 'expense') {
    throw new ApiError('type harus "income", "expense", atau "transfer"')
  }
  const amount = Number(p.amount)
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError('amount wajib angka > 0')
  const category = String(p.category ?? (type === 'income' ? 'Lainnya' : 'Lainnya')).trim() || 'Lainnya'
  const wallet = await resolveWallet(uid, p)
  const date = p.date ? String(p.date) : todayWIB()

  const { data: txn, error } = await admin.from('transactions').insert({
    user_id: uid,
    amount,
    type,
    category,
    note: p.note ? String(p.note) : '',
    source: 'novi',
    is_categorized: true,
    is_wallet_transfer: false,
    has_items: false,
    wallet_source: wallet.id,
    wallet_id: wallet.id,
    project_id: p.project_id ?? null,
    date,
  }).select().single()
  if (error) throw new ApiError(error.message, 500)

  const newBalance = type === 'income' ? wallet.current_balance + amount : wallet.current_balance - amount
  await admin.from('user_wallets').update({ current_balance: newBalance }).eq('id', wallet.id)

  return {
    transaction: txn,
    wallet: { id: wallet.id, name: wallet.wallet_name, old_balance: wallet.current_balance, new_balance: newBalance },
  }
}

// Transfer antar dompet (buat pasangan expense+income + update 2 saldo)
async function transferTransaction(uid: string, p: Record<string, unknown>) {
  const amount = Number(p.amount)
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError('amount wajib angka > 0')
  if (!p.from_wallet_id && !p.from_wallet_name) throw new ApiError('from_wallet_id / from_wallet_name wajib')
  if (!p.to_wallet_id && !p.to_wallet_name) throw new ApiError('to_wallet_id / to_wallet_name wajib')
  const from = await resolveWallet(uid, { wallet_id: p.from_wallet_id, wallet_name: p.from_wallet_name })
  const to = await resolveWallet(uid, { wallet_id: p.to_wallet_id, wallet_name: p.to_wallet_name })
  if (from.id === to.id) throw new ApiError('Dompet asal & tujuan tidak boleh sama')
  if (from.current_balance < amount) throw new ApiError(`Saldo ${from.wallet_name} tidak cukup`)
  const date = p.date ? String(p.date) : todayWIB()
  const note = p.note ? ' · ' + String(p.note) : ''

  await admin.from('transactions').insert({
    user_id: uid, amount, type: 'expense', category: 'Transfer',
    note: `Transfer ke ${to.wallet_name}${note}`, source: 'novi',
    is_categorized: true, is_wallet_transfer: true, wallet_source: from.id, wallet_id: from.id, date,
  })
  await admin.from('transactions').insert({
    user_id: uid, amount, type: 'income', category: 'Transfer',
    note: `Transfer dari ${from.wallet_name}${note}`, source: 'novi',
    is_categorized: true, is_wallet_transfer: true, wallet_source: to.id, wallet_id: to.id, date,
  })
  await admin.from('user_wallets').update({ current_balance: from.current_balance - amount }).eq('id', from.id)
  await admin.from('user_wallets').update({ current_balance: to.current_balance + amount }).eq('id', to.id)

  return {
    transfer: { amount, from: from.wallet_name, to: to.wallet_name },
    balances: { [from.wallet_name]: from.current_balance - amount, [to.wallet_name]: to.current_balance + amount },
  }
}

// Hapus transaksi + balikin saldo dompet
async function deleteTransaction(uid: string, p: Record<string, unknown>) {
  if (!p.id) throw new ApiError('id wajib')
  const { data: txn, error } = await admin.from('transactions').select('*').eq('id', p.id).eq('user_id', uid).maybeSingle()
  if (error) throw new ApiError(error.message, 500)
  if (!txn) throw new ApiError('Transaksi tidak ditemukan', 404)
  // balikin saldo
  if (txn.wallet_id && !txn.is_wallet_transfer) {
    const { data: w } = await admin.from('user_wallets').select('id, current_balance').eq('id', txn.wallet_id).maybeSingle()
    if (w) {
      const revert = txn.type === 'income' ? w.current_balance - txn.amount : w.current_balance + txn.amount
      await admin.from('user_wallets').update({ current_balance: revert }).eq('id', w.id)
    }
  }
  await admin.from('transactions').delete().eq('id', p.id).eq('user_id', uid)
  return { deleted: true, id: p.id }
}

// Ringkasan bulan (income/expense/net) + saldo total
async function summary(uid: string, p: Record<string, unknown>) {
  const month = p.month ? String(p.month) : todayWIB().slice(0, 7) // YYYY-MM
  const start = `${month}-01`
  const [y, m] = month.split('-').map(Number)
  const end = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`
  const { data, error } = await admin
    .from('transactions')
    .select('type, amount, is_wallet_transfer')
    .eq('user_id', uid)
    .gte('date', start)
    .lt('date', end)
  if (error) throw new ApiError(error.message, 500)
  let income = 0, expense = 0
  for (const t of data ?? []) {
    if (t.is_wallet_transfer) continue
    if (t.type === 'income') income += t.amount
    else if (t.type === 'expense') expense += t.amount
  }
  const wallets = await loadWallets(uid)
  const totalBalance = wallets.reduce((s, w) => s + (w.current_balance ?? 0), 0)
  return { month, income, expense, net: income - expense, total_balance: totalBalance, wallet_count: wallets.length }
}

// === Generic CRUD (whitelisted, user-scoped) ===
async function dbSelect(uid: string, p: Record<string, unknown>) {
  const table = String(p.table ?? '')
  const kind = assertTableAllowed(table)
  let q = admin.from(table).select(p.columns ? String(p.columns) : '*')
  if (kind === 'user') {
    q = q.eq('user_id', uid)
  } else {
    const meta = CHILD_TABLES[table]
    const filters = (p.filters ?? {}) as Record<string, unknown>
    await assertParentOwned(uid, table, filters[meta.fk])
    q = q.eq(meta.fk, filters[meta.fk])
  }
  for (const [k, v] of Object.entries((p.filters ?? {}) as Record<string, unknown>)) {
    if (k === 'user_id') continue
    q = q.eq(k, v as never)
  }
  if (p.order) q = q.order(String(p.order), { ascending: p.ascending !== false })
  q = q.limit(Number(p.limit ?? 50))
  const { data, error } = await q
  if (error) throw new ApiError(error.message, 500)
  return { rows: data, count: data?.length ?? 0 }
}

async function dbInsert(uid: string, p: Record<string, unknown>) {
  const table = String(p.table ?? '')
  const kind = assertTableAllowed(table)
  const values = { ...(p.values as Record<string, unknown>) }
  if (kind === 'user') {
    values.user_id = uid // paksa
  } else {
    const meta = CHILD_TABLES[table]
    await assertParentOwned(uid, table, values[meta.fk])
  }
  const { data, error } = await admin.from(table).insert(values).select()
  if (error) throw new ApiError(error.message, 500)
  return { inserted: data }
}

async function dbUpdate(uid: string, p: Record<string, unknown>) {
  const table = String(p.table ?? '')
  const kind = assertTableAllowed(table)
  if (!p.id) throw new ApiError('id wajib')
  const values = { ...(p.values as Record<string, unknown>) }
  delete values.user_id // jangan biarkan pindah kepemilikan
  if (kind === 'user') {
    const { data, error } = await admin.from(table).update(values).eq('id', p.id).eq('user_id', uid).select()
    if (error) throw new ApiError(error.message, 500)
    if (!data?.length) throw new ApiError('Baris tidak ditemukan / bukan milik user', 404)
    return { updated: data }
  }
  const meta = CHILD_TABLES[table]
  const { data: row } = await admin.from(table).select(`id, ${meta.fk}`).eq('id', p.id).maybeSingle()
  if (!row) throw new ApiError('Baris tidak ditemukan', 404)
  await assertParentOwned(uid, table, (row as Record<string, unknown>)[meta.fk])
  const { data, error } = await admin.from(table).update(values).eq('id', p.id).select()
  if (error) throw new ApiError(error.message, 500)
  return { updated: data }
}

async function dbDelete(uid: string, p: Record<string, unknown>) {
  const table = String(p.table ?? '')
  if (table === 'transactions') return deleteTransaction(uid, p) // pakai versi yg balikin saldo
  const kind = assertTableAllowed(table)
  if (!p.id) throw new ApiError('id wajib')
  if (kind === 'user') {
    const { error } = await admin.from(table).delete().eq('id', p.id).eq('user_id', uid)
    if (error) throw new ApiError(error.message, 500)
    return { deleted: true, id: p.id }
  }
  const meta = CHILD_TABLES[table]
  const { data: row } = await admin.from(table).select(`id, ${meta.fk}`).eq('id', p.id).maybeSingle()
  if (!row) throw new ApiError('Baris tidak ditemukan', 404)
  await assertParentOwned(uid, table, (row as Record<string, unknown>)[meta.fk])
  const { error } = await admin.from(table).delete().eq('id', p.id)
  if (error) throw new ApiError(error.message, 500)
  return { deleted: true, id: p.id }
}

const ACTIONS: Record<string, (uid: string, p: Record<string, unknown>) => Promise<unknown>> = {
  record_transaction: recordTransaction,
  transfer: transferTransaction,
  delete_transaction: deleteTransaction,
  list_wallets: async (uid) => ({ wallets: await loadWallets(uid) }),
  list_transactions: (uid, p) => dbSelect(uid, { ...p, table: 'transactions', order: p.order ?? 'date', ascending: false }),
  summary,
  db_select: dbSelect,
  db_insert: dbInsert,
  db_update: dbUpdate,
  db_delete: dbDelete,
  whoami: async (uid) => ({ user_id: uid, email: NOVI_USER_EMAIL }),
  list_actions: async () => ({ actions: Object.keys(ACTIONS) }),
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Gunakan POST' }, 405)

  // Auth
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!NOVI_API_KEY || token !== NOVI_API_KEY) {
    return json({ error: 'Unauthorized' }, 401)
  }

  try {
    const body = (await req.json()) as Record<string, unknown>
    const action = String(body.action ?? '')
    const fn = ACTIONS[action]
    if (!fn) return json({ error: `Action "${action}" tidak dikenal`, available: Object.keys(ACTIONS) }, 400)

    const uid = await getUserId()
    const { action: _a, ...params } = body
    const result = await fn(uid, params)
    console.log(`[novi-api] action=${action} ok`)
    return json({ ok: true, action, result })
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500
    console.error(`[novi-api] error:`, String(err))
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, status)
  }
})
