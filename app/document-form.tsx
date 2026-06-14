import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { notify } from '../lib/alert'
import { generateDocNumber } from '../lib/docNumber'
import { COLORS, RADIUS, SHADOW } from '../constants/theme'

const PRIMARY = COLORS.primary
const TEXT_MAIN = COLORS.text
const TEXT_MUTED = COLORS.textMuted
const CARD = COLORS.card
const BG_APP = COLORS.bg

type Item = { name: string; qty: string; price: string }
type Bank = { id: string; bank_name: string; account_number: string }
const TEMPLATES = [
  { key: 'professional', label: 'Professional' },
  { key: 'minimal', label: 'Minimal' },
  { key: 'brand', label: 'Brand' },
]

export default function DocumentFormScreen() {
  const params = useLocalSearchParams()
  const editId = params.id as string | undefined
  const isEdit = !!editId

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [docType, setDocType] = useState<'invoice' | 'quotation'>((params.type === 'quotation' ? 'quotation' : 'invoice'))
  const [docNumber, setDocNumber] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [items, setItems] = useState<Item[]>([{ name: '', qty: '1', price: '' }])
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [bankId, setBankId] = useState('')
  const [note, setNote] = useState('')
  const [templateKey, setTemplateKey] = useState('professional')
  const [projectId] = useState<string>((params.project as string) || '')
  // context
  const [abbr, setAbbr] = useState('INV')
  const [ppnEnabled, setPpnEnabled] = useState(false)
  const [ppnRate, setPpnRate] = useState(11)
  const [banks, setBanks] = useState<Bank[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: bp }, { data: prefs }, { data: bba }] = await Promise.all([
      supabase.from('business_profile').select('business_abbr, default_note').eq('user_id', user?.id).limit(1),
      supabase.from('user_preferences').select('ppn_enabled, ppn_rate').eq('user_id', user?.id).order('created_at', { ascending: true }).limit(1),
      supabase.from('business_bank_accounts').select('id, bank_name, account_number, is_default').eq('user_id', user?.id).order('created_at', { ascending: true }),
    ])
    setAbbr(bp?.[0]?.business_abbr || 'INV')
    setPpnEnabled(prefs?.[0]?.ppn_enabled || false)
    setPpnRate(prefs?.[0]?.ppn_rate || 11)
    setBanks((bba || []) as Bank[])

    if (isEdit) {
      const { data: doc } = await supabase.from('documents').select('*').eq('id', editId).single()
      if (doc) {
        setDocType(doc.doc_type)
        setDocNumber(doc.doc_number)
        setClientName(doc.client_name || '')
        setClientAddress(doc.client_address || '')
        setItems((doc.items || []).length ? (doc.items as any[]).map(it => ({ name: it.name || '', qty: String(it.qty || 1), price: String(it.price || 0) })) : [{ name: '', qty: '1', price: '' }])
        setIssueDate(doc.issue_date || issueDate)
        setDueDate(doc.due_date || '')
        setBankId(doc.bank_account_id || '')
        setNote(doc.note || '')
        setTemplateKey(doc.template_key || 'professional')
      }
    } else {
      // default bank + default note
      const def = (bba || []).find((b: any) => b.is_default) || (bba || [])[0]
      if (def) setBankId(def.id)
      if (bp?.[0]?.default_note) setNote(bp[0].default_note)
      // prefill dari Project (tombol "Buat Invoice")
      if (params.client) setClientName(String(params.client))
      if (params.amount) {
        setItems([{ name: String(params.pname || 'Pekerjaan project'), qty: '1', price: String(params.amount) }])
      }
    }
    setLoading(false)
  }

  const num = (s: string) => parseFloat(s.replace(/[^0-9.]/g, '')) || 0
  const subtotal = items.reduce((s, it) => s + num(it.qty) * num(it.price), 0)
  const ppnAmount = ppnEnabled ? Math.round(subtotal * ppnRate / 100) : 0
  const total = subtotal + ppnAmount
  const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')

  const updateItem = (i: number, f: keyof Item, v: string) =>
    setItems(items.map((it, idx) => idx === i ? { ...it, [f]: v } : it))
  const addItem = () => setItems([...items, { name: '', qty: '1', price: '' }])
  const removeItem = (i: number) => setItems(items.length > 1 ? items.filter((_, idx) => idx !== i) : items)

  async function handleSave() {
    if (!clientName.trim()) { notify('Oops', 'Nama klien wajib diisi'); return }
    const validItems = items.filter(it => it.name.trim() && num(it.price) > 0)
    if (validItems.length === 0) { notify('Oops', 'Tambahkan minimal 1 item dengan harga'); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const itemsJson = validItems.map(it => ({ name: it.name.trim(), qty: num(it.qty), price: num(it.price), subtotal: num(it.qty) * num(it.price) }))

    if (isEdit) {
      const { error } = await supabase.from('documents').update({
        client_name: clientName.trim(), client_address: clientAddress.trim() || null,
        items: itemsJson, subtotal, ppn_amount: ppnAmount, total,
        issue_date: issueDate, due_date: dueDate || null, bank_account_id: bankId || null,
        note: note.trim() || null, template_key: templateKey, updated_at: new Date().toISOString(),
      }).eq('id', editId)
      setSaving(false)
      if (error) { notify('Gagal', error.message); return }
      router.replace(`/document-preview?id=${editId}`)
      return
    }

    // BARU — generate nomor atomik (anti-duplikat)
    const number = await generateDocNumber(docType, abbr, issueDate)
    if (!number) { setSaving(false); notify('Gagal', 'Gagal membuat nomor. Pastikan SQL documents sudah dijalankan.'); return }

    const { data: inserted, error } = await supabase.from('documents').insert({
      user_id: user?.id, doc_type: docType, doc_number: number,
      client_name: clientName.trim(), client_address: clientAddress.trim() || null,
      items: itemsJson, subtotal, ppn_amount: ppnAmount, total,
      issue_date: issueDate, due_date: dueDate || null, bank_account_id: bankId || null,
      note: note.trim() || null, template_key: templateKey, status: 'draft',
      project_id: projectId || null,
    }).select().single()
    setSaving(false)
    if (error) { notify('Gagal', error.message); return }
    router.replace(`/document-preview?id=${inserted.id}`)
  }

  if (loading) return <View style={styles.loadingWrap}><ActivityIndicator color={PRIMARY} /></View>

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={22} color={TEXT_MAIN} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit' : 'Buat'} {docType === 'invoice' ? 'Invoice' : 'Penawaran'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Nomor (readonly) */}
        <View style={styles.card}>
          <Text style={styles.label}>Nomor Dokumen</Text>
          <View style={styles.readonlyBox}>
            <Text style={styles.readonlyText}>{isEdit ? docNumber : 'Otomatis dibuat saat simpan'}</Text>
            <Ionicons name="lock-closed" size={14} color={TEXT_MUTED} />
          </View>

          <Text style={[styles.label, { marginTop: 16 }]}>Nama Klien *</Text>
          <TextInput style={styles.input} value={clientName} onChangeText={setClientName} placeholder="Nama klien / perusahaan" placeholderTextColor={TEXT_MUTED} />

          <Text style={[styles.label, { marginTop: 16 }]}>Alamat Klien</Text>
          <TextInput style={[styles.input, styles.area]} value={clientAddress} onChangeText={setClientAddress} placeholder="Alamat klien" placeholderTextColor={TEXT_MUTED} multiline />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Tgl Terbit</Text>
              <TextInput style={styles.input} value={issueDate} onChangeText={setIssueDate} placeholder="YYYY-MM-DD" placeholderTextColor={TEXT_MUTED} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Jatuh Tempo</Text>
              <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" placeholderTextColor={TEXT_MUTED} />
            </View>
          </View>
        </View>

        {/* Items */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Item</Text>
          <TouchableOpacity onPress={addItem}><Text style={styles.addLink}>+ Tambah Item</Text></TouchableOpacity>
        </View>
        <View style={styles.card}>
          {items.map((it, i) => (
            <View key={i} style={[styles.itemRow, i > 0 && { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12, marginTop: 12 }]}>
              <TextInput style={[styles.input, { marginBottom: 8 }]} value={it.name} onChangeText={(v) => updateItem(i, 'name', v)} placeholder="Nama item" placeholderTextColor={TEXT_MUTED} />
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput style={[styles.input, { flex: 0.5 }]} value={it.qty} onChangeText={(v) => updateItem(i, 'qty', v.replace(/[^0-9]/g, ''))} placeholder="Qty" placeholderTextColor={TEXT_MUTED} keyboardType="numeric" />
                <TextInput style={[styles.input, { flex: 1 }]} value={it.price} onChangeText={(v) => updateItem(i, 'price', v.replace(/[^0-9]/g, ''))} placeholder="Harga" placeholderTextColor={TEXT_MUTED} keyboardType="numeric" />
                <TouchableOpacity onPress={() => removeItem(i)} style={{ padding: 6 }}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
              <Text style={styles.itemSub}>Subtotal: {fmt(num(it.qty) * num(it.price))}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.card}>
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalValue}>{fmt(subtotal)}</Text></View>
          {ppnEnabled && (
            <View style={styles.totalRow}><Text style={styles.totalLabel}>PPN {ppnRate}%</Text><Text style={styles.totalValue}>{fmt(ppnAmount)}</Text></View>
          )}
          <View style={[styles.totalRow, { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, marginTop: 6 }]}>
            <Text style={styles.totalLabelBold}>Total</Text><Text style={styles.totalValueBold}>{fmt(total)}</Text>
          </View>
        </View>

        {/* Rekening */}
        {banks.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Rekening Pembayaran</Text>
            <View style={styles.card}>
              {banks.map(b => (
                <TouchableOpacity key={b.id} style={[styles.bankRow, bankId === b.id && styles.bankRowActive]} onPress={() => setBankId(b.id)}>
                  <Ionicons name={bankId === b.id ? 'radio-button-on' : 'radio-button-off'} size={18} color={bankId === b.id ? PRIMARY : TEXT_MUTED} />
                  <Text style={styles.bankText}>{b.bank_name} · {b.account_number}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Template */}
        <Text style={styles.sectionTitle}>Template</Text>
        <View style={[styles.card, { flexDirection: 'row', gap: 8 }]}>
          {TEMPLATES.map(t => (
            <TouchableOpacity key={t.key} style={[styles.tplBtn, templateKey === t.key && styles.tplBtnActive]} onPress={() => setTemplateKey(t.key)}>
              <Text style={[styles.tplText, templateKey === t.key && { color: '#fff' }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Note */}
        <View style={styles.card}>
          <Text style={styles.label}>Catatan</Text>
          <TextInput style={[styles.input, styles.area]} value={note} onChangeText={setNote} placeholder="Catatan dokumen" placeholderTextColor={TEXT_MUTED} multiline />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{isEdit ? 'Simpan Perubahan' : 'Buat & Pratinjau'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, backgroundColor: BG_APP, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: BG_APP },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, backgroundColor: CARD,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: BG_APP },
  headerTitle: { fontSize: 17, fontWeight: '800', color: TEXT_MAIN },
  card: { backgroundColor: CARD, borderRadius: RADIUS.lg, padding: 16, ...SHADOW.card, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: TEXT_MUTED, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  readonlyBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#EEF1F6', borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12 },
  readonlyText: { fontSize: 14, fontWeight: '700', color: TEXT_MAIN },
  input: { backgroundColor: BG_APP, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: TEXT_MAIN, borderWidth: 1, borderColor: COLORS.border },
  area: { minHeight: 64, textAlignVertical: 'top' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: TEXT_MAIN, marginBottom: 10 },
  addLink: { fontSize: 13, fontWeight: '700', color: PRIMARY },
  itemRow: {},
  itemSub: { fontSize: 12, color: TEXT_MUTED, marginTop: 6, textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  totalLabel: { fontSize: 13, color: TEXT_MUTED },
  totalValue: { fontSize: 13, fontWeight: '600', color: TEXT_MAIN },
  totalLabelBold: { fontSize: 15, fontWeight: '800', color: TEXT_MAIN },
  totalValueBold: { fontSize: 16, fontWeight: '800', color: PRIMARY },
  bankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  bankRowActive: { borderColor: PRIMARY, backgroundColor: PRIMARY + '0C' },
  bankText: { fontSize: 13, color: TEXT_MAIN, fontWeight: '600' },
  tplBtn: { flex: 1, paddingVertical: 12, borderRadius: RADIUS.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  tplBtnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  tplText: { fontSize: 13, fontWeight: '700', color: TEXT_MAIN },
  saveBtn: { backgroundColor: PRIMARY, borderRadius: RADIUS.lg, paddingVertical: 16, alignItems: 'center', marginTop: 6, marginBottom: 30 },
  saveText: { fontSize: 16, fontWeight: '700', color: '#fff' },
})
