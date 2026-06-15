import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = (Deno.env.get('secretkeynew') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TPL_COLOR: Record<string, string> = {
  professional: '#1763D6',
  minimal: '#1A1D26',
  brand: '#16A06A',
}

const fmt = (n: number) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID')
const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
function formatTanggal(d: string): string {
  if (!d) return '-'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  return `${dt.getDate()} ${BULAN[dt.getMonth()]} ${dt.getFullYear()}`
}

// Angka -> terbilang (Bahasa Indonesia)
function terbilang(num: number): string {
  const n = Math.floor(Math.abs(Number(num) || 0))
  const sat = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']
  const f = (x: number): string => {
    if (x < 12) return sat[x]
    if (x < 20) return f(x - 10) + ' belas'
    if (x < 100) return f(Math.floor(x / 10)) + ' puluh' + (x % 10 ? ' ' + sat[x % 10] : '')
    if (x < 200) return 'seratus' + (x - 100 ? ' ' + f(x - 100) : '')
    if (x < 1000) return sat[Math.floor(x / 100)] + ' ratus' + (x % 100 ? ' ' + f(x % 100) : '')
    if (x < 2000) return 'seribu' + (x - 1000 ? ' ' + f(x - 1000) : '')
    if (x < 1e6) return f(Math.floor(x / 1000)) + ' ribu' + (x % 1000 ? ' ' + f(x % 1000) : '')
    if (x < 1e9) return f(Math.floor(x / 1e6)) + ' juta' + (x % 1e6 ? ' ' + f(x % 1e6) : '')
    if (x < 1e12) return f(Math.floor(x / 1e9)) + ' miliar' + (x % 1e9 ? ' ' + f(x % 1e9) : '')
    return f(Math.floor(x / 1e12)) + ' triliun' + (x % 1e12 ? ' ' + f(x % 1e12) : '')
  }
  if (n === 0) return 'Nol rupiah'
  const w = f(n).replace(/\s+/g, ' ').trim()
  return w.charAt(0).toUpperCase() + w.slice(1) + ' rupiah'
}

function buildHtml(doc: any, biz: any, bank: any): string {
  const accent = TPL_COLOR[doc.template_key] || TPL_COLOR.professional
  const title = doc.doc_type === 'invoice' ? 'INVOICE' : 'PENAWARAN'
  const items: any[] = Array.isArray(doc.items) ? doc.items : []
  const bizName = esc(biz?.business_name || 'Bisnis Anda')

  const rows = items.map((it, i) => `
    <tr>
      <td class="c muted">${i + 1}</td>
      <td><div class="iname">${esc(it.name)}</div></td>
      <td class="c">${esc(it.qty)}</td>
      <td class="r">${fmt(it.price)}</td>
      <td class="r b">${fmt(it.subtotal)}</td>
    </tr>`).join('')

  const ppnRow = Number(doc.ppn_amount) > 0
    ? `<div class="trow"><span>PPN</span><span>${fmt(doc.ppn_amount)}</span></div>` : ''

  const logo = biz?.logo_url ? `<img src="${esc(biz.logo_url)}" class="logo" />` : ''

  const bankBox = bank ? `
    <div class="box">
      <div class="blabel">INFORMASI PEMBAYARAN</div>
      <div class="bline">${esc(bank.bank_name)}</div>
      <div class="bnum">${esc(bank.account_number)}</div>
      ${bank.account_holder ? `<div class="bmeta">a.n. ${esc(bank.account_holder)}</div>` : ''}
    </div>` : `<div class="box" style="visibility:hidden"></div>`

  const noteBox = doc.note ? `
    <div class="note"><div class="blabel">CATATAN</div><div class="ntext">${esc(doc.note)}</div></div>` : ''

  const dueBox = doc.due_date
    ? `<div class="mlabel" style="margin-top:10px">JATUH TEMPO</div><div class="mval">${formatTanggal(doc.due_date)}</div>` : ''

  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(doc.doc_number)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #20242E; background: #EEF1F6; padding: 24px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .paper { max-width: 760px; margin: 0 auto; background: #fff; box-shadow: 0 6px 30px rgba(0,0,0,.08); }
  .accent { height: 6px; background: ${accent}; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; padding: 34px 36px 22px; }
  .logo { max-height: 54px; max-width: 180px; margin-bottom: 12px; display: block; }
  .bname { font-size: 21px; font-weight: 800; letter-spacing: -.3px; }
  .bmeta2 { font-size: 12px; color: #707A8C; margin-top: 4px; line-height: 1.5; max-width: 260px; }
  .right { text-align: right; }
  .dtitle { font-size: 30px; font-weight: 800; letter-spacing: 3px; color: ${accent}; }
  .dnum { font-size: 13px; color: #707A8C; margin-top: 6px; font-weight: 600; letter-spacing: .3px; }
  .badge { display: inline-block; margin-top: 10px; padding: 5px 14px; border-radius: 999px; font-size: 10px; font-weight: 800; letter-spacing: .5px; background: ${accent}1f; color: ${accent}; text-transform: uppercase; }
  .meta { display: flex; justify-content: space-between; padding: 8px 36px 22px; gap: 30px; }
  .mlabel { font-size: 10px; color: #98A1B2; text-transform: uppercase; letter-spacing: .8px; font-weight: 700; }
  .mval { font-size: 13px; margin-top: 3px; color: #20242E; }
  .mname { font-size: 15px; font-weight: 700; margin-top: 3px; }
  .maddr { font-size: 12px; color: #707A8C; margin-top: 2px; line-height: 1.5; max-width: 260px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: ${accent}; color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; padding: 11px 14px; text-align: left; font-weight: 700; }
  thead th:first-child { padding-left: 36px; } thead th:last-child { padding-right: 36px; }
  thead th.c { text-align: center; } thead th.r { text-align: right; }
  tbody td { padding: 13px 14px; border-bottom: 1px solid #EDF0F5; font-size: 13px; vertical-align: top; }
  tbody td:first-child { padding-left: 36px; } tbody td:last-child { padding-right: 36px; }
  tbody tr:nth-child(even) { background: #FAFBFC; }
  td.c { text-align: center; } td.r { text-align: right; } td.b { font-weight: 700; } .muted { color: #98A1B2; }
  .iname { font-weight: 600; color: #20242E; }
  .lower { display: flex; justify-content: space-between; padding: 22px 36px 0; gap: 30px; }
  .terbilang { font-size: 12px; color: #4A5263; font-style: italic; }
  .terbilang b { font-style: normal; font-weight: 700; color: #20242E; }
  .totals { width: 280px; }
  .trow { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #4A5263; }
  .grand { display: flex; justify-content: space-between; border-top: 2px solid #20242E; margin-top: 8px; padding-top: 12px; align-items: baseline; }
  .grand .l { font-size: 14px; font-weight: 800; letter-spacing: .5px; }
  .grand .v { font-size: 22px; font-weight: 800; color: ${accent}; }
  .foot2 { display: flex; justify-content: space-between; padding: 26px 36px 10px; gap: 30px; align-items: flex-end; }
  .box { flex: 1; padding: 14px 16px; background: #F6F8FB; border-radius: 8px; border: 1px solid #EDF0F5; }
  .blabel { font-size: 10px; font-weight: 800; color: #98A1B2; text-transform: uppercase; letter-spacing: .7px; }
  .bline { font-size: 15px; font-weight: 700; margin-top: 6px; } .bnum { font-size: 14px; font-weight: 600; margin-top: 2px; letter-spacing: .5px; } .bmeta { font-size: 12px; color: #707A8C; margin-top: 3px; }
  .sign { width: 220px; text-align: center; }
  .sign-date { font-size: 12px; color: #4A5263; margin-bottom: 2px; }
  .sign-label { font-size: 13px; color: #20242E; margin-bottom: 56px; }
  .sign-name { font-size: 14px; font-weight: 800; border-top: 1px solid #20242E; padding-top: 6px; }
  .note { margin: 18px 36px 0; padding: 14px 16px; background: #FFF9ED; border-left: 3px solid ${accent}; border-radius: 6px; }
  .ntext { font-size: 12px; color: #4A5263; margin-top: 5px; line-height: 1.5; }
  .foot { text-align: center; font-size: 10px; color: #B0B7C3; padding: 22px 16px 26px; margin-top: 18px; border-top: 1px solid #F0F2F6; }
  .printbar { max-width: 760px; margin: 16px auto 0; text-align: center; }
  .printbtn { background: ${accent}; color: #fff; border: 0; padding: 12px 30px; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; }
  @media print { body { background: #fff; padding: 0; } .paper { box-shadow: none; } .printbar { display: none; } }
</style></head>
<body>
  <div class="paper">
    <div class="accent"></div>
    <div class="head">
      <div>${logo}<div class="bname">${bizName}</div>
        ${biz?.address ? `<div class="bmeta2">${esc(biz.address)}</div>` : ''}
        ${biz?.phone ? `<div class="bmeta2">${esc(biz.phone)}</div>` : ''}
      </div>
      <div class="right">
        <div class="dtitle">${title}</div>
        <div class="dnum">${esc(doc.doc_number)}</div>
        <div class="badge">${esc(doc.status)}</div>
      </div>
    </div>
    <div class="meta">
      <div><div class="mlabel">KEPADA YTH.</div><div class="mname">${esc(doc.client_name || '-')}</div>
        ${doc.client_address ? `<div class="maddr">${esc(doc.client_address)}</div>` : ''}</div>
      <div class="right"><div class="mlabel">TANGGAL TERBIT</div><div class="mval">${formatTanggal(doc.issue_date)}</div>${dueBox}</div>
    </div>
    <table>
      <thead><tr><th class="c">No</th><th>Deskripsi</th><th class="c">Qty</th><th class="r">Harga</th><th class="r">Jumlah</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#98A1B2;padding:24px">Tidak ada item</td></tr>'}</tbody>
    </table>
    <div class="lower">
      <div class="terbilang">Terbilang:<br/><b>${terbilang(doc.total)}</b></div>
      <div class="totals">
        <div class="trow"><span>Subtotal</span><span>${fmt(doc.subtotal)}</span></div>
        ${ppnRow}
        <div class="grand"><span class="l">TOTAL</span><span class="v">${fmt(doc.total)}</span></div>
      </div>
    </div>
    <div class="foot2">
      ${bankBox}
      <div class="sign">
        <div class="sign-date">${formatTanggal(doc.issue_date)}</div>
        <div class="sign-label">Hormat kami,</div>
        <div class="sign-name">${bizName}</div>
      </div>
    </div>
    ${noteBox}
    <div class="foot">Dokumen ini sah dan dibuat secara elektronik &middot; Dibuat dengan Zena</div>
  </div>
  <div class="printbar"><button class="printbtn" onclick="window.print()">Simpan / Cetak PDF</button></div>
  <script>window.addEventListener('load',function(){setTimeout(function(){try{window.print()}catch(e){}},400)})</script>
</body></html>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { document_id } = await req.json()
    if (!document_id) {
      return new Response(JSON.stringify({ error: 'document_id wajib' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data: doc, error: docErr } = await admin
      .from('documents').select('*').eq('id', document_id).single()
    if (docErr || !doc) throw new Error('Dokumen tidak ditemukan')

    const { data: biz } = await admin
      .from('business_profile').select('*').eq('user_id', doc.user_id).limit(1)
    let bank = null
    if (doc.bank_account_id) {
      const { data: b } = await admin
        .from('business_bank_accounts').select('*').eq('id', doc.bank_account_id).single()
      bank = b
    }

    const html = buildHtml(doc, biz?.[0] || null, bank)
    const path = `documents/${doc.user_id}/${document_id}.html`
    const { error: upErr } = await admin.storage
      .from('logos')
      .upload(path, new Blob([html], { type: 'text/html' }), { contentType: 'text/html', upsert: true })
    if (upErr) throw upErr

    const { data: pub } = admin.storage.from('logos').getPublicUrl(path)
    const url = `${pub.publicUrl}?t=${Date.now()}`

    await admin.from('documents').update({ pdf_url: url }).eq('id', document_id)

    // Kirim html mentah juga — biar app web bisa render via blob (anti masalah content-type storage)
    return new Response(JSON.stringify({ url, html }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error)?.message || 'error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
