import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
  Image, KeyboardAvoidingView, Platform
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../lib/supabase'
import { notify, confirmAsync } from '../lib/alert'
import { uploadImage } from '../lib/upload'
import { COLORS, RADIUS, SHADOW } from '../constants/theme'

const PRIMARY = COLORS.primary
const TEXT_MAIN = COLORS.text
const TEXT_MUTED = COLORS.textMuted
const CARD = COLORS.card
const BG_APP = COLORS.bg

type Bank = { id?: string; bank_name: string; account_number: string; account_holder: string; is_default: boolean }

export default function ProfilBisnisScreen() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [abbr, setAbbr] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [defaultNote, setDefaultNote] = useState('')
  const [banks, setBanks] = useState<Bank[]>([])
  // form tambah bank
  const [addingBank, setAddingBank] = useState(false)
  const [bName, setBName] = useState('')
  const [bNumber, setBNumber] = useState('')
  const [bHolder, setBHolder] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const [{ data: bp }, { data: bba }] = await Promise.all([
      supabase.from('business_profile').select('*').eq('user_id', user.id).limit(1),
      supabase.from('business_bank_accounts').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
    ])
    const p = bp?.[0]
    if (p) {
      setProfileId(p.id)
      setName(p.business_name || '')
      setAbbr(p.business_abbr || '')
      setLogoUrl(p.logo_url || '')
      setAddress(p.address || '')
      setPhone(p.phone || '')
      setDefaultNote(p.default_note || '')
    }
    setBanks((bba || []) as Bank[])
    setLoading(false)
  }

  async function pickLogo() {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, base64: false })
    if (result.canceled || !result.assets?.[0]) return
    setUploadingLogo(true)
    const url = await uploadImage(result.assets[0].uri, 'logos')
    setUploadingLogo(false)
    if (url) setLogoUrl(url)
    else notify('Gagal', 'Upload logo gagal. Pastikan bucket "logos" sudah dibuat (run SQL).')
  }

  async function handleSaveProfile() {
    if (!name.trim()) { notify('Oops', 'Nama usaha wajib diisi'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      user_id: user?.id,
      business_name: name.trim(),
      business_abbr: abbr.trim().toUpperCase().slice(0, 5),
      logo_url: logoUrl || null,
      address: address.trim() || null,
      phone: phone.trim() || null,
      default_note: defaultNote.trim() || null,
    }
    const err = profileId
      ? (await supabase.from('business_profile').update(payload).eq('user_id', user?.id)).error
      : (await supabase.from('business_profile').insert(payload)).error
    // sinkron juga ke user_preferences.business_name biar konsisten
    await supabase.from('user_preferences').update({ business_name: name.trim() }).eq('user_id', user?.id)
    setSaving(false)
    if (err) { notify('Gagal', err.message); return }
    router.replace('/(tabs)/profil')
    setTimeout(() => notify('Berhasil ✅', 'Profil usaha tersimpan'), 300)
  }

  async function addBank() {
    if (!bName.trim() || !bNumber.trim()) { notify('Oops', 'Nama bank & nomor rekening wajib'); return }
    const { data: { user } } = await supabase.auth.getUser()
    const makeDefault = banks.length === 0
    const { data, error } = await supabase.from('business_bank_accounts').insert({
      user_id: user?.id, bank_name: bName.trim(), account_number: bNumber.trim(),
      account_holder: bHolder.trim() || null, is_default: makeDefault,
    }).select().single()
    if (error) { notify('Gagal', error.message); return }
    setBanks([...banks, data as Bank])
    setBName(''); setBNumber(''); setBHolder(''); setAddingBank(false)
  }

  async function setDefaultBank(id: string) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('business_bank_accounts').update({ is_default: false }).eq('user_id', user?.id)
    await supabase.from('business_bank_accounts').update({ is_default: true }).eq('id', id)
    setBanks(banks.map(b => ({ ...b, is_default: b.id === id })))
  }

  async function deleteBank(id: string) {
    const ok = await confirmAsync('Hapus Rekening?', 'Rekening ini akan dihapus.', 'Hapus')
    if (!ok) return
    await supabase.from('business_bank_accounts').delete().eq('id', id)
    setBanks(banks.filter(b => b.id !== id))
  }

  if (loading) return <View style={styles.loadingWrap}><ActivityIndicator color={PRIMARY} /></View>

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={TEXT_MAIN} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profil Usaha</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Logo */}
        <View style={styles.logoWrap}>
          <TouchableOpacity style={styles.logoBox} onPress={pickLogo} activeOpacity={0.8}>
            {uploadingLogo ? <ActivityIndicator color={PRIMARY} />
              : logoUrl ? <Image source={{ uri: logoUrl }} style={styles.logoImg} resizeMode="cover" />
              : <Ionicons name="image-outline" size={28} color={TEXT_MUTED} />}
          </TouchableOpacity>
          <Text style={styles.logoHint}>Ketuk untuk {logoUrl ? 'ganti' : 'upload'} logo</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Nama Usaha *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Contoh: Golden Medical Care" placeholderTextColor={TEXT_MUTED} />

          <Text style={[styles.label, { marginTop: 16 }]}>Singkatan Usaha (untuk no. invoice)</Text>
          <TextInput style={styles.input} value={abbr} onChangeText={(t) => setAbbr(t.toUpperCase().slice(0, 5))} placeholder="GMC" placeholderTextColor={TEXT_MUTED} autoCapitalize="characters" maxLength={5} />
          <Text style={styles.hint}>Maks 5 huruf. Contoh nomor: GMC-0001</Text>

          <Text style={[styles.label, { marginTop: 16 }]}>Alamat</Text>
          <TextInput style={[styles.input, styles.area]} value={address} onChangeText={setAddress} placeholder="Alamat usaha" placeholderTextColor={TEXT_MUTED} multiline />

          <Text style={[styles.label, { marginTop: 16 }]}>No. HP</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="08xxxxxxxxxx" placeholderTextColor={TEXT_MUTED} keyboardType="phone-pad" />

          <Text style={[styles.label, { marginTop: 16 }]}>Catatan Default Invoice</Text>
          <TextInput style={[styles.input, styles.area]} value={defaultNote} onChangeText={setDefaultNote} placeholder="Mis. Pembayaran via transfer, terima kasih." placeholderTextColor={TEXT_MUTED} multiline />
        </View>

        {/* Rekening Bank */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Rekening Bank</Text>
          <TouchableOpacity onPress={() => setAddingBank(!addingBank)}>
            <Text style={styles.addLink}>{addingBank ? 'Batal' : '+ Tambah Rekening'}</Text>
          </TouchableOpacity>
        </View>

        {addingBank && (
          <View style={styles.card}>
            <TextInput style={styles.input} value={bName} onChangeText={setBName} placeholder="Nama Bank (mis. BCA)" placeholderTextColor={TEXT_MUTED} />
            <TextInput style={[styles.input, { marginTop: 10 }]} value={bNumber} onChangeText={setBNumber} placeholder="Nomor Rekening" placeholderTextColor={TEXT_MUTED} keyboardType="numeric" />
            <TextInput style={[styles.input, { marginTop: 10 }]} value={bHolder} onChangeText={setBHolder} placeholder="Atas Nama" placeholderTextColor={TEXT_MUTED} />
            <TouchableOpacity style={styles.addBankBtn} onPress={addBank}>
              <Text style={styles.addBankText}>Simpan Rekening</Text>
            </TouchableOpacity>
          </View>
        )}

        {banks.length === 0 && !addingBank ? (
          <Text style={styles.emptyHint}>Belum ada rekening.</Text>
        ) : banks.map(b => (
          <View key={b.id} style={styles.bankCard}>
            <View style={styles.bankIcon}><Ionicons name="card" size={20} color={PRIMARY} /></View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.bankName}>{b.bank_name}</Text>
                {b.is_default && <View style={styles.defaultBadge}><Text style={styles.defaultText}>Default</Text></View>}
              </View>
              <Text style={styles.bankNumber}>{b.account_number}{b.account_holder ? ` · ${b.account_holder}` : ''}</Text>
            </View>
            {!b.is_default && b.id && (
              <TouchableOpacity onPress={() => setDefaultBank(b.id!)} style={styles.bankAction}>
                <Text style={styles.bankActionText}>Jadikan Default</Text>
              </TouchableOpacity>
            )}
            {b.id && (
              <TouchableOpacity onPress={() => deleteBank(b.id!)} style={{ padding: 6 }}>
                <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
              </TouchableOpacity>
            )}
          </View>
        ))}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Simpan Profil Usaha</Text>}
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
  logoWrap: { alignItems: 'center', marginBottom: 18 },
  logoBox: { width: 96, height: 96, borderRadius: 24, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, ...SHADOW.card, overflow: 'hidden' },
  logoImg: { width: '100%', height: '100%' },
  logoHint: { fontSize: 12, color: TEXT_MUTED, marginTop: 8 },
  card: { backgroundColor: CARD, borderRadius: RADIUS.lg, padding: 16, ...SHADOW.card, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: TEXT_MUTED, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: BG_APP, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: TEXT_MAIN, borderWidth: 1, borderColor: COLORS.border },
  area: { minHeight: 70, textAlignVertical: 'top' },
  hint: { fontSize: 11, color: TEXT_MUTED, marginTop: 6 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: TEXT_MAIN },
  addLink: { fontSize: 13, fontWeight: '700', color: PRIMARY },
  addBankBtn: { backgroundColor: PRIMARY, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  addBankText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  emptyHint: { fontSize: 13, color: TEXT_MUTED, marginBottom: 16 },
  bankCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: CARD, borderRadius: RADIUS.md, padding: 12, ...SHADOW.card, marginBottom: 10 },
  bankIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: PRIMARY + '12', alignItems: 'center', justifyContent: 'center' },
  bankName: { fontSize: 14, fontWeight: '700', color: TEXT_MAIN },
  bankNumber: { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },
  defaultBadge: { backgroundColor: COLORS.success + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  defaultText: { fontSize: 10, fontWeight: '700', color: COLORS.success },
  bankAction: { paddingHorizontal: 8, paddingVertical: 6 },
  bankActionText: { fontSize: 11, fontWeight: '700', color: PRIMARY },
  saveBtn: { backgroundColor: PRIMARY, borderRadius: RADIUS.lg, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 30 },
  saveText: { fontSize: 16, fontWeight: '700', color: '#fff' },
})
