import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Linking, Platform
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { notify, confirmAsync } from '../lib/alert'
import { COLORS, RADIUS, SHADOW } from '../constants/theme'

const TEXT_MAIN = COLORS.text
const TEXT_MUTED = COLORS.textMuted
const CARD = COLORS.card
const BG_APP = COLORS.bg

const TPL_COLOR: Record<string, string> = {
  professional: '#1763D6', minimal: '#1A1D26', brand: '#16A06A',
}
const STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#8A93A6' },
  sent: { label: 'Terkirim', color: '#1763D6' },
  paid: { label: 'Lunas', color: '#16A06A' },
  approved: { label: 'Disetujui', color: '#16A06A' },
  rejected: { label: 'Ditolak', color: '#E5484D' },
}

// Penawaran (quotation) pakai istilah lifecycle berbeda
const QUOTE_LABEL: Record<string, string> = { draft: 'Draft', sent: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak' }
function statusLabel(docType: string, status: string) {
  if (docType === 'quotation') return QUOTE_LABEL[status] || status
  return STATUS[status]?.label || status
}

type Item = { name: string; qty: number; price: number; subtotal: number }

export default function DocumentPreviewScreen() {
  const params = useLocalSearchParams()
  const id = params.id as string
  const [loading, setLoading] = useState(true)
  const [doc, setDoc] = useState<any>(null)
  const [biz, setBiz] = useState<any>(null)
  const [bank, setBank] = useState<any>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: d } = await supabase.from('documents').select('*').eq('id', id).single()
    setDoc(d)
    const { data: bp } = await supabase.from('business_profile').select('*').eq('user_id', user?.id).limit(1)
    setBiz(bp?.[0] || null)
    if (d?.bank_account_id) {
      const { data: b } = await supabase.from('business_bank_accounts').select('*').eq('id', d.bank_account_id).single()
      setBank(b)
    }
    setLoading(false)
  }

  const fmt = (n: number) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID')

  async function setStatus(status: string) {
    await supabase.from('documents').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setDoc({ ...doc, status })
  }

  // Penawaran disetujui → buat Project + Piutang otomatis (anti-dobel via project_id)
  async function handleMakeProject() {
    if (doc.project_id) return
    const ok = await confirmAsync(
      'Jadikan Project?',
      `Penawaran ${doc.doc_number} akan dibuat jadi project aktif + piutang ${fmt(doc.total)} atas nama ${doc.client_name || 'klien'}.`,
      'Buat Project'
    )
    if (!ok) return
    setDownloading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const firstItem = (doc.items || [])[0]
      const projName = `${doc.client_name || 'Klien'}${firstItem?.name ? ' - ' + firstItem.name : ' - ' + doc.doc_number}`

      const { data: project, error: pErr } = await supabase.from('projects').insert({
        user_id: user?.id,
        name: projName,
        client_name: doc.client_name || null,
        type: 'lainnya',
        contract_value: doc.total,
        status: 'aktif',
      }).select().single()
      if (pErr || !project) throw pErr || new Error('Gagal buat project')

      const { error: rErr } = await supabase.from('receivables').insert({
        user_id: user?.id,
        project_id: project.id,
        type: 'piutang',
        party_name: doc.client_name || projName,
        amount: doc.total,
        description: `Dari penawaran ${doc.doc_number}`,
        status: 'pending',
      })
      if (rErr) throw rErr

      await supabase.from('documents').update({ project_id: project.id, updated_at: new Date().toISOString() }).eq('id', id)

      router.replace(`/business-project-detail?id=${project.id}`)
    } catch (e: any) {
      setDownloading(false)
      notify('Gagal', e?.message || 'Gagal membuat project')
    }
  }

  async function handlePdf() {
    setDownloading(true)
    try {
      const { data, error } = await supabase.functions.invoke('generate-document-pdf', { body: { document_id: id } })
      if (error) throw error
      const url = data?.url
      if (!url) throw new Error('URL PDF kosong')
      if (Platform.OS === 'web') window.open(url, '_blank')
      else Linking.openURL(url)
      if (doc?.status === 'draft') setStatus('sent')
    } catch (e: any) {
      notify('Gagal', 'Gagal membuat PDF: ' + (e?.message || 'error'))
    } finally {
      setDownloading(false)
    }
  }

  function handleWhatsApp() {
    const title = doc.doc_type === 'invoice' ? 'Invoice' : 'Penawaran'
    const lines = [
      `Halo ${doc.client_name || ''},`,
      ``,
      `Berikut ${title} ${doc.doc_number} dari ${biz?.business_name || 'kami'}.`,
      ``,
      ...(doc.items || []).map((it: Item) => `• ${it.name} (${it.qty}x) — ${fmt(it.subtotal)}`),
      ``,
      `Total: ${fmt(doc.total)}`,
      ...(bank ? [``, `Pembayaran ke ${bank.bank_name}`, `${bank.account_number} a.n. ${bank.account_holder || biz?.business_name || ''}`] : []),
      ...(doc.note ? [``, doc.note] : []),
      ``,
      `Terima kasih.`,
    ]
    const text = encodeURIComponent(lines.join('\n'))
    const url = `https://wa.me/?text=${text}`
    if (Platform.OS === 'web') window.open(url, '_blank')
    else Linking.openURL(url)
  }

  if (loading) return <View style={styles.loadingWrap}><ActivityIndicator color={TPL_COLOR.professional} /></View>
  if (!doc) return <View style={styles.loadingWrap}><Text style={{ color: TEXT_MUTED }}>Dokumen tidak ditemukan</Text></View>

  const accent = TPL_COLOR[doc.template_key] || TPL_COLOR.professional
  const st = STATUS[doc.status] || STATUS.draft
  const title = doc.doc_type === 'invoice' ? 'INVOICE' : 'PENAWARAN'

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={TEXT_MAIN} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pratinjau</Text>
        <TouchableOpacity onPress={() => router.push(`/document-form?id=${id}`)} style={styles.backBtn}>
          <Ionicons name="create-outline" size={20} color={TEXT_MAIN} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* Paper */}
        <View style={styles.paper}>
          {/* Top bar accent */}
          <View style={[styles.accentBar, { backgroundColor: accent }]} />

          {/* Business header */}
          <View style={styles.bizHeader}>
            <View style={{ flex: 1 }}>
              {biz?.logo_url ? (
                <Image source={{ uri: biz.logo_url }} style={styles.logo} resizeMode="contain" />
              ) : null}
              <Text style={styles.bizName}>{biz?.business_name || 'Bisnis Anda'}</Text>
              {biz?.address ? <Text style={styles.bizMeta}>{biz.address}</Text> : null}
              {biz?.phone ? <Text style={styles.bizMeta}>{biz.phone}</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.docTitle, { color: accent }]}>{title}</Text>
              <Text style={styles.docNumber}>{doc.doc_number}</Text>
              <View style={[styles.statusBadge, { backgroundColor: st.color + '20', marginTop: 6 }]}>
                <Text style={[styles.statusText, { color: st.color }]}>{statusLabel(doc.doc_type, doc.status)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Client + dates */}
          <View style={styles.metaRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>Kepada</Text>
              <Text style={styles.metaValueBold}>{doc.client_name || '-'}</Text>
              {doc.client_address ? <Text style={styles.metaValue}>{doc.client_address}</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.metaLabel}>Tgl Terbit</Text>
              <Text style={styles.metaValue}>{doc.issue_date || '-'}</Text>
              {doc.due_date ? <><Text style={[styles.metaLabel, { marginTop: 6 }]}>Jatuh Tempo</Text><Text style={styles.metaValue}>{doc.due_date}</Text></> : null}
            </View>
          </View>

          {/* Items table */}
          <View style={[styles.tableHead, { backgroundColor: accent + '12' }]}>
            <Text style={[styles.thItem]}>Item</Text>
            <Text style={styles.thQty}>Qty</Text>
            <Text style={styles.thAmt}>Jumlah</Text>
          </View>
          {(doc.items || []).map((it: Item, i: number) => (
            <View key={i} style={styles.tableRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{it.name}</Text>
                <Text style={styles.itemUnit}>{fmt(it.price)} × {it.qty}</Text>
              </View>
              <Text style={styles.tdQty}>{it.qty}</Text>
              <Text style={styles.tdAmt}>{fmt(it.subtotal)}</Text>
            </View>
          ))}

          {/* Totals */}
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalValue}>{fmt(doc.subtotal)}</Text></View>
            {doc.ppn_amount > 0 && (
              <View style={styles.totalRow}><Text style={styles.totalLabel}>PPN</Text><Text style={styles.totalValue}>{fmt(doc.ppn_amount)}</Text></View>
            )}
            <View style={[styles.totalRow, styles.grandRow]}>
              <Text style={styles.grandLabel}>TOTAL</Text>
              <Text style={[styles.grandValue, { color: accent }]}>{fmt(doc.total)}</Text>
            </View>
          </View>

          {/* Bank */}
          {bank ? (
            <View style={styles.bankBox}>
              <Text style={styles.bankTitle}>Pembayaran</Text>
              <Text style={styles.bankLine}>{bank.bank_name} — {bank.account_number}</Text>
              {bank.account_holder ? <Text style={styles.bankMeta}>a.n. {bank.account_holder}</Text> : null}
            </View>
          ) : null}

          {/* Note */}
          {doc.note ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteLabel}>Catatan</Text>
              <Text style={styles.noteText}>{doc.note}</Text>
            </View>
          ) : null}
        </View>

        {/* Penawaran → Project */}
        {doc.doc_type === 'quotation' && (
          doc.project_id ? (
            <TouchableOpacity style={styles.projectCta} onPress={() => router.push(`/business-project-detail?id=${doc.project_id}`)} activeOpacity={0.85}>
              <Ionicons name="briefcase" size={20} color="#16A06A" />
              <View style={{ flex: 1 }}>
                <Text style={styles.ctaTitle}>Lihat Project</Text>
                <Text style={styles.ctaSub}>Penawaran ini sudah jadi project</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
            </TouchableOpacity>
          ) : doc.status === 'approved' ? (
            <TouchableOpacity style={[styles.projectCta, { borderColor: '#16A06A', backgroundColor: '#16A06A0C' }]} onPress={handleMakeProject} activeOpacity={0.85}>
              <Ionicons name="add-circle" size={22} color="#16A06A" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.ctaTitle, { color: '#16A06A' }]}>Jadikan Project</Text>
                <Text style={styles.ctaSub}>Buat project aktif + piutang otomatis</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.ctaHint}>
              <Ionicons name="information-circle-outline" size={16} color={TEXT_MUTED} />
              <Text style={styles.ctaHintText}>Ubah status ke "Disetujui" untuk jadikan project</Text>
            </View>
          )
        )}

        {/* Status quick actions */}
        <Text style={styles.quickLabel}>Ubah Status</Text>
        <View style={styles.statusPills}>
          {(doc.doc_type === 'invoice' ? ['draft', 'sent', 'paid'] : ['draft', 'sent', 'approved', 'rejected']).map(s => (
            <TouchableOpacity key={s} style={[styles.pill, doc.status === s && { backgroundColor: (STATUS[s]?.color || '#888') + '20', borderColor: STATUS[s]?.color }]} onPress={() => setStatus(s)}>
              <Text style={[styles.pillText, doc.status === s && { color: STATUS[s]?.color }]}>{statusLabel(doc.doc_type, s)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Bottom actions */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={[styles.actBtn, styles.waBtn]} onPress={handleWhatsApp} activeOpacity={0.85}>
          <Ionicons name="logo-whatsapp" size={20} color="#fff" />
          <Text style={styles.actText}>WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actBtn, styles.pdfBtn]} onPress={handlePdf} disabled={downloading} activeOpacity={0.85}>
          {downloading ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="download-outline" size={20} color="#fff" /><Text style={styles.actText}>PDF</Text></>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, backgroundColor: BG_APP, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: BG_APP },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, backgroundColor: CARD,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: BG_APP },
  headerTitle: { fontSize: 17, fontWeight: '800', color: TEXT_MAIN },
  paper: { backgroundColor: CARD, borderRadius: RADIUS.lg, ...SHADOW.card, overflow: 'hidden' },
  accentBar: { height: 6, width: '100%' },
  bizHeader: { flexDirection: 'row', padding: 18, paddingBottom: 12 },
  logo: { width: 90, height: 40, marginBottom: 8, alignSelf: 'flex-start' },
  bizName: { fontSize: 17, fontWeight: '800', color: TEXT_MAIN },
  bizMeta: { fontSize: 11, color: TEXT_MUTED, marginTop: 2 },
  docTitle: { fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  docNumber: { fontSize: 12, color: TEXT_MUTED, marginTop: 2, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.pill },
  statusText: { fontSize: 11, fontWeight: '700' },
  divider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: 18 },
  metaRow: { flexDirection: 'row', padding: 18, paddingTop: 14, paddingBottom: 14 },
  metaLabel: { fontSize: 10, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' },
  metaValue: { fontSize: 13, color: TEXT_MAIN, marginTop: 2 },
  metaValueBold: { fontSize: 14, color: TEXT_MAIN, fontWeight: '700', marginTop: 2 },
  tableHead: { flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 18 },
  thItem: { flex: 1, fontSize: 11, fontWeight: '800', color: TEXT_MAIN },
  thQty: { width: 40, fontSize: 11, fontWeight: '800', color: TEXT_MAIN, textAlign: 'center' },
  thAmt: { width: 90, fontSize: 11, fontWeight: '800', color: TEXT_MAIN, textAlign: 'right' },
  tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border, alignItems: 'center' },
  itemName: { fontSize: 13, color: TEXT_MAIN, fontWeight: '600' },
  itemUnit: { fontSize: 11, color: TEXT_MUTED, marginTop: 2 },
  tdQty: { width: 40, fontSize: 13, color: TEXT_MAIN, textAlign: 'center' },
  tdAmt: { width: 90, fontSize: 13, color: TEXT_MAIN, textAlign: 'right', fontWeight: '600' },
  totalsBox: { paddingHorizontal: 18, paddingTop: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: 13, color: TEXT_MUTED },
  totalValue: { fontSize: 13, color: TEXT_MAIN, fontWeight: '600' },
  grandRow: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 6, paddingTop: 10 },
  grandLabel: { fontSize: 14, fontWeight: '900', color: TEXT_MAIN, letterSpacing: 0.5 },
  grandValue: { fontSize: 18, fontWeight: '900' },
  bankBox: { margin: 18, marginTop: 16, padding: 14, backgroundColor: BG_APP, borderRadius: RADIUS.md },
  bankTitle: { fontSize: 11, fontWeight: '800', color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  bankLine: { fontSize: 14, color: TEXT_MAIN, fontWeight: '700', marginTop: 4 },
  bankMeta: { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },
  noteBox: { paddingHorizontal: 18, paddingBottom: 20 },
  noteLabel: { fontSize: 11, fontWeight: '800', color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  noteText: { fontSize: 13, color: TEXT_MAIN, marginTop: 4, lineHeight: 19 },
  projectCta: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: CARD, borderRadius: RADIUS.lg, padding: 16, marginTop: 16, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.card },
  ctaTitle: { fontSize: 15, fontWeight: '800', color: TEXT_MAIN },
  ctaSub: { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },
  ctaHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingHorizontal: 4 },
  ctaHintText: { fontSize: 12, color: TEXT_MUTED, flex: 1 },
  quickLabel: { fontSize: 12, fontWeight: '700', color: TEXT_MUTED, marginTop: 20, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  statusPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border, backgroundColor: CARD },
  pillText: { fontSize: 12, fontWeight: '700', color: TEXT_MUTED },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 28, backgroundColor: CARD, borderTopWidth: 1, borderTopColor: COLORS.border },
  actBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: RADIUS.lg },
  waBtn: { backgroundColor: '#25D366' },
  pdfBtn: { backgroundColor: COLORS.primary },
  actText: { fontSize: 15, fontWeight: '700', color: '#fff' },
})
