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

function buildHtml(doc: any, biz: any, bank: any): string {
  const accent = TPL_COLOR[doc.template_key] || TPL_COLOR.professional
  const title = doc.doc_type === 'invoice' ? 'INVOICE' : 'PENAWARAN'
  const items: any[] = Array.isArray(doc.items) ? doc.items : []

  const rows = items.map((it) => `
    <tr>
      <td>
        <div class="iname">${esc(it.name)}</div>
        <div class="iunit">${fmt(it.price)} &times; ${esc(it.qty)}</div>
      </td>
      <td class="c">${esc(it.qty)}</td>
      <td class="r">${fmt(it.subtotal)}</td>
    </tr>`).join('')

  const ppnRow = Number(doc.ppn_amount) > 0
    ? `<div class="trow"><span>PPN</span><span>${fmt(doc.ppn_amount)}</span></div>` : ''

  const logo = biz?.logo_url
    ? `<img src="${esc(biz.logo_url)}" class="logo" />` : ''

  const bankBox = bank ? `
    <div class="bank">
      <div class="blabel">PEMBAYARAN</div>
      <div class="bline">${esc(bank.bank_name)} — ${esc(bank.account_number)}</div>
      ${bank.account_holder ? `<div class="bmeta">a.n. ${esc(bank.account_holder)}</div>` : ''}
    </div>` : ''

  const noteBox = doc.note ? `
    <div class="note"><div class="blabel">CATATAN</div><div>${esc(doc.note)}</div></div>` : ''

  const dueBox = doc.due_date
    ? `<div class="mlabel" style="margin-top:8px">JATUH TEMPO</div><div class="mval">${esc(doc.due_date)}</div>` : ''

  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(doc.doc_number)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #1A1D26; background: #F5F7FA; padding: 24px; }
  .paper { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
  .accent { height: 8px; background: ${accent}; }
  .head { display: flex; justify-content: space-between; padding: 28px 28px 16px; }
  .logo { max-height: 48px; max-width: 160px; margin-bottom: 10px; display: block; }
  .bname { font-size: 20px; font-weight: 800; }
  .bmeta2 { font-size: 12px; color: #8A93A6; margin-top: 3px; }
  .right { text-align: right; }
  .dtitle { font-size: 24px; font-weight: 900; letter-spacing: 1px; color: ${accent}; }
  .dnum { font-size: 13px; color: #8A93A6; margin-top: 4px; font-weight: 600; }
  .badge { display: inline-block; margin-top: 8px; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; background: ${accent}1f; color: ${accent}; text-transform: uppercase; }
  .divider { height: 1px; background: #EDF0F5; margin: 0 28px; }
  .meta { display: flex; justify-content: space-between; padding: 18px 28px; }
  .mlabel { font-size: 10px; color: #8A93A6; text-transform: uppercase; letter-spacing: .5px; font-weight: 700; }
  .mval { font-size: 13px; margin-top: 2px; }
  .mname { font-size: 15px; font-weight: 700; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: ${accent}12; font-size: 11px; text-transform: uppercase; padding: 10px 28px; text-align: left; }
  thead th.c { text-align: center; } thead th.r { text-align: right; }
  tbody td { padding: 12px 28px; border-bottom: 1px solid #EDF0F5; font-size: 13px; vertical-align: top; }
  td.c { text-align: center; } td.r { text-align: right; font-weight: 600; }
  .iname { font-weight: 600; } .iunit { font-size: 11px; color: #8A93A6; margin-top: 2px; }
  .totals { padding: 14px 28px; }
  .trow { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: #555; }
  .grand { display: flex; justify-content: space-between; border-top: 1px solid #EDF0F5; margin-top: 8px; padding-top: 12px; }
  .grand .l { font-size: 15px; font-weight: 900; letter-spacing: .5px; }
  .grand .v { font-size: 20px; font-weight: 900; color: ${accent}; }
  .bank, .note { margin: 16px 28px; padding: 14px; background: #F5F7FA; border-radius: 8px; }
  .blabel { font-size: 11px; font-weight: 800; color: #8A93A6; text-transform: uppercase; letter-spacing: .5px; }
  .bline { font-size: 14px; font-weight: 700; margin-top: 4px; } .bmeta { font-size: 12px; color: #8A93A6; margin-top: 2px; }
  .note div:last-child { font-size: 13px; margin-top: 4px; line-height: 1.5; }
  .foot { text-align: center; font-size: 11px; color: #8A93A6; padding: 16px; }
  .printbar { max-width: 720px; margin: 16px auto 0; text-align: center; }
  .printbtn { background: ${accent}; color: #fff; border: 0; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; }
  @media print { body { background: #fff; padding: 0; } .paper { box-shadow: none; border-radius: 0; } .printbar { display: none; } }
</style></head>
<body>
  <div class="paper">
    <div class="accent"></div>
    <div class="head">
      <div>${logo}<div class="bname">${esc(biz?.business_name || 'Bisnis Anda')}</div>
        ${biz?.address ? `<div class="bmeta2">${esc(biz.address)}</div>` : ''}
        ${biz?.phone ? `<div class="bmeta2">${esc(biz.phone)}</div>` : ''}
      </div>
      <div class="right">
        <div class="dtitle">${title}</div>
        <div class="dnum">${esc(doc.doc_number)}</div>
        <div class="badge">${esc(doc.status)}</div>
      </div>
    </div>
    <div class="divider"></div>
    <div class="meta">
      <div><div class="mlabel">KEPADA</div><div class="mname">${esc(doc.client_name || '-')}</div>
        ${doc.client_address ? `<div class="mval">${esc(doc.client_address)}</div>` : ''}</div>
      <div class="right"><div class="mlabel">TGL TERBIT</div><div class="mval">${esc(doc.issue_date || '-')}</div>${dueBox}</div>
    </div>
    <table>
      <thead><tr><th>Item</th><th class="c">Qty</th><th class="r">Jumlah</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="3" style="text-align:center;color:#8A93A6">Tidak ada item</td></tr>'}</tbody>
    </table>
    <div class="totals">
      <div class="trow"><span>Subtotal</span><span>${fmt(doc.subtotal)}</span></div>
      ${ppnRow}
      <div class="grand"><span class="l">TOTAL</span><span class="v">${fmt(doc.total)}</span></div>
    </div>
    ${bankBox}
    ${noteBox}
    <div class="foot">Dibuat dengan Zena</div>
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
