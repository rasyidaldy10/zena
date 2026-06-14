import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { notify } from '../lib/alert'
import { BUDGET_METHODS } from '../constants'
import { BudgetMethod } from '../types'
import { COLORS, RADIUS, SHADOW } from '../constants/theme'

const PRIMARY = COLORS.primary
const TEXT_MAIN = COLORS.text
const TEXT_MUTED = COLORS.textMuted
const CARD = COLORS.card
const BG_APP = COLORS.bg

export default function EditProfilScreen() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [nickname, setNickname] = useState('')
  const [income, setIncome] = useState('')
  const [budgetMethod, setBudgetMethod] = useState<BudgetMethod>('503020')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('user_preferences').select('nickname, monthly_income, budget_method')
      .eq('user_id', user?.id).order('created_at', { ascending: true }).limit(1)
    const p = data?.[0]
    if (p) {
      setNickname(p.nickname || '')
      setIncome(p.monthly_income ? p.monthly_income.toLocaleString('id-ID') : '')
      setBudgetMethod((p.budget_method as BudgetMethod) || '503020')
    }
    setLoading(false)
  }

  async function handleSave() {
    const incomeValue = parseFloat(income.replace(/\./g, '')) || 0
    if (incomeValue < 0) { notify('Oops', 'Penghasilan tidak valid'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('user_preferences')
      .update({
        nickname: nickname.trim(),
        monthly_income: incomeValue,
        budget_method: budgetMethod,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user?.id)
    setSaving(false)
    if (error) { notify('Gagal', error.message); return }
    router.replace('/(tabs)/profil')
    setTimeout(() => notify('Berhasil ✅', 'Profil diperbarui'), 300)
  }

  if (loading) return <View style={styles.loadingWrap}><ActivityIndicator color={PRIMARY} /></View>

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={TEXT_MAIN} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ubah Profil</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.label}>Nama Panggilan</Text>
          <TextInput style={styles.input} value={nickname} onChangeText={setNickname} placeholder="Nama" placeholderTextColor={TEXT_MUTED} />

          <Text style={[styles.label, { marginTop: 18 }]}>Penghasilan / Bulan (Rp)</Text>
          <TextInput
            style={styles.input}
            value={income}
            onChangeText={(t) => setIncome(t.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.'))}
            keyboardType="numeric" placeholder="0" placeholderTextColor={TEXT_MUTED}
          />
        </View>

        <Text style={styles.sectionTitle}>Metode Budgeting</Text>
        <View style={styles.card}>
          {(Object.entries(BUDGET_METHODS) as [BudgetMethod, typeof BUDGET_METHODS[BudgetMethod]][]).map(([key, m]) => (
            <TouchableOpacity
              key={key}
              style={[styles.methodRow, budgetMethod === key && styles.methodRowActive]}
              onPress={() => setBudgetMethod(key)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.methodName, budgetMethod === key && { color: PRIMARY }]}>{m.name}</Text>
                <Text style={styles.methodDesc}>{m.desc}</Text>
              </View>
              {budgetMethod === key && <Ionicons name="checkmark-circle" size={18} color={PRIMARY} />}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Simpan Perubahan</Text>}
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
  input: { backgroundColor: BG_APP, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: TEXT_MAIN, borderWidth: 1, borderColor: COLORS.border },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: TEXT_MAIN, marginBottom: 10 },
  methodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: RADIUS.md, marginBottom: 6, borderWidth: 1, borderColor: COLORS.border },
  methodRowActive: { borderColor: PRIMARY, backgroundColor: PRIMARY + '0C' },
  methodName: { fontSize: 14, fontWeight: '700', color: TEXT_MAIN },
  methodDesc: { fontSize: 11.5, color: TEXT_MUTED, marginTop: 2 },
  saveBtn: { backgroundColor: PRIMARY, borderRadius: RADIUS.lg, paddingVertical: 16, alignItems: 'center', marginTop: 6, marginBottom: 30 },
  saveText: { fontSize: 16, fontWeight: '700', color: '#fff' },
})
