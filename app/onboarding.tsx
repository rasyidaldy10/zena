import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { PERSONA_CONFIG, LANGUAGE_CONFIG, BUDGET_METHODS } from '../constants'
import { Persona, Language, BudgetMethod } from '../types'

const PRIMARY = '#185FA5'

export default function OnboardingScreen() {
  const [step, setStep] = useState(1)
  const [nickname, setNickname] = useState('')
  const [persona, setPersona] = useState<Persona>('bestie')
  const [language, setLanguage] = useState<Language>('id')
  const [budgetMethod, setBudgetMethod] = useState<BudgetMethod>('503020')
  const [income, setIncome] = useState('')
  const [loading, setLoading] = useState(false)

  const formatIncome = (text: string) => {
    const numbers = text.replace(/\D/g, '')
    const formatted = numbers.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    setIncome(formatted)
  }

  const handleFinish = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('user_preferences').upsert({
      user_id: user?.id,
      nickname,
      persona,
      language,
      budget_method: budgetMethod,
      monthly_income: parseFloat(income.replace(/\./g, '')) || 0,
      updated_at: new Date().toISOString(),
    })

    // Buat wallet default
    await supabase.from('user_wallets').insert([
      { user_id: user?.id, wallet_name: 'Cash', wallet_type: 'personal', color: '#185FA5', icon: '💵' },
      { user_id: user?.id, wallet_name: 'Bank', wallet_type: 'personal', color: '#534AB7', icon: '🏦' },
    ])

    router.replace('/(tabs)')
    setLoading(false)
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepWrap}>
            <Text style={styles.stepNum}>1 / 4</Text>
            <Text style={styles.stepTitle}>Siapa namamu?</Text>
            <Text style={styles.stepSub}>Biar AI-mu bisa nyapa dengan cara yang paling nyaman</Text>
            <TextInput
              style={styles.input}
              placeholder="Nama panggilanmu..."
              placeholderTextColor="#888780"
              value={nickname}
              onChangeText={setNickname}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.nextBtn, !nickname && styles.nextBtnDisabled]}
              onPress={() => nickname && setStep(2)}
              disabled={!nickname}
            >
              <Text style={styles.nextBtnText}>Lanjut →</Text>
            </TouchableOpacity>
          </View>
        )

      case 2:
        return (
          <View style={styles.stepWrap}>
            <Text style={styles.stepNum}>2 / 4</Text>
            <Text style={styles.stepTitle}>AI kamu mau jadi siapa?</Text>
            <Text style={styles.stepSub}>Bisa diganti kapan saja di pengaturan</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(Object.entries(PERSONA_CONFIG) as [Persona, typeof PERSONA_CONFIG[Persona]][]).map(([key, p]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.personaBtn, persona === key && styles.personaBtnActive]}
                  onPress={() => setPersona(key)}
                >
                  <Text style={styles.personaIcon}>{p.icon}</Text>
                  <View style={styles.personaInfo}>
                    <Text style={[styles.personaName, persona === key && styles.personaNameActive]}>{p.name}</Text>
                    <Text style={styles.personaDesc}>{p.desc}</Text>
                  </View>
                  {persona === key && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>Preview sapaan:</Text>
                <Text style={styles.previewText}>
                  {persona === 'bestie' && `"Hei ${nickname}! Gue siap jagain dompet lo. Gas! 😎"`}
                  {persona === 'advisor' && `"Selamat datang, ${nickname}. Saya siap membantu Anda mengelola keuangan."`}
                  {persona === 'kakak' && `"Hei ${nickname}! Kak bakal selalu ada buat jagain keuanganmu ya 🧡"`}
                  {persona === 'adek' && `"Kak ${nickname}! Dek siap bantu kak kelola keuangan! Semangat! 🎉"`}
                  {persona === 'pacar' && `"${nickname} sayang, aku siap bantu jaga keuangan kita bareng ♡"`}
                  {persona === 'stoic' && `"${nickname}. Keuangan yang baik dimulai dari tindakan hari ini."`}
                </Text>
              </View>
              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(3)}>
                <Text style={styles.nextBtnText}>Lanjut →</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        )

      case 3:
        return (
          <View style={styles.stepWrap}>
            <Text style={styles.stepNum}>3 / 4</Text>
            <Text style={styles.stepTitle}>Metode budgeting</Text>
            <Text style={styles.stepSub}>Pilih yang paling cocok, bisa diubah nanti</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(Object.entries(BUDGET_METHODS) as [BudgetMethod, typeof BUDGET_METHODS[BudgetMethod]][]).map(([key, m]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.methodBtn, budgetMethod === key && styles.methodBtnActive]}
                  onPress={() => setBudgetMethod(key)}
                >
                  <Text style={[styles.methodName, budgetMethod === key && styles.methodNameActive]}>{m.name}</Text>
                  <Text style={styles.methodDesc}>{m.desc}</Text>
                  {budgetMethod === key && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(4)}>
                <Text style={styles.nextBtnText}>Lanjut →</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        )

      case 4:
        return (
          <View style={styles.stepWrap}>
            <Text style={styles.stepNum}>4 / 4</Text>
            <Text style={styles.stepTitle}>Berapa penghasilan bulananmu?</Text>
            <Text style={styles.stepSub}>Ini untuk membantu AI menghitung budget yang tepat</Text>
            <View style={styles.incomeWrap}>
              <Text style={styles.incomePrefix}>Rp</Text>
              <TextInput
                style={styles.incomeInput}
                placeholder="0"
                placeholderTextColor="#444"
                value={income}
                onChangeText={formatIncome}
                keyboardType="numeric"
                autoFocus
              />
            </View>
            <Text style={styles.incomeNote}>Bisa dilewati dan diisi nanti di profil</Text>
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={handleFinish}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.nextBtnText}>Mulai pakai Zena 🚀</Text>
              }
            </TouchableOpacity>
          </View>
        )
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        {step > 1 && (
          <TouchableOpacity onPress={() => setStep(step - 1)} style={styles.backBtn}>
            <Text style={styles.backText}>← Kembali</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.logo}>Zena</Text>
        <View style={{ width: 80 }} />
      </View>

      <View style={styles.progressWrap}>
        {[1, 2, 3, 4].map(s => (
          <View key={s} style={[styles.progressDot, s <= step && styles.progressDotActive]} />
        ))}
      </View>

      {renderStep()}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
  },
  backBtn: { width: 80 },
  backText: { fontSize: 14, color: PRIMARY },
  logo: { fontSize: 20, fontWeight: '600', color: PRIMARY },
  progressWrap: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginBottom: 32 },
  progressDot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#2A2A2A' },
  progressDotActive: { backgroundColor: PRIMARY },
  stepWrap: { flex: 1, paddingHorizontal: 20 },
  stepNum: { fontSize: 12, color: '#888780', marginBottom: 8 },
  stepTitle: { fontSize: 24, fontWeight: '600', color: '#fff', marginBottom: 8, letterSpacing: -0.5 },
  stepSub: { fontSize: 14, color: '#888780', marginBottom: 24, lineHeight: 20 },
  input: {
    height: 52, backgroundColor: '#1A1A1A', borderRadius: 12,
    paddingHorizontal: 16, fontSize: 16, color: '#fff',
    borderWidth: 0.5, borderColor: '#2A2A2A', marginBottom: 16,
  },
  nextBtn: {
    height: 52, backgroundColor: PRIMARY, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  nextBtnDisabled: { backgroundColor: '#2A2A2A' },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  personaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  personaBtnActive: { borderColor: PRIMARY, borderWidth: 2 },
  personaIcon: { fontSize: 24 },
  personaInfo: { flex: 1 },
  personaName: { fontSize: 14, fontWeight: '500', color: '#fff' },
  personaNameActive: { color: PRIMARY },
  personaDesc: { fontSize: 12, color: '#888780', marginTop: 2 },
  checkmark: { fontSize: 16, color: PRIMARY, fontWeight: '700' },
  previewBox: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14,
    marginTop: 8, marginBottom: 4, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  previewLabel: { fontSize: 11, color: '#888780', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  previewText: { fontSize: 13, color: '#fff', lineHeight: 20, fontStyle: 'italic' },
  methodBtn: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  methodBtnActive: { borderColor: PRIMARY, borderWidth: 2 },
  methodName: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 4 },
  methodNameActive: { color: PRIMARY },
  methodDesc: { fontSize: 12, color: '#888780' },
  incomeWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A',
    borderRadius: 16, paddingHorizontal: 20, marginBottom: 8,
    borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  incomePrefix: { fontSize: 24, color: '#888780', marginRight: 8 },
  incomeInput: { flex: 1, fontSize: 32, fontWeight: '600', color: '#fff', paddingVertical: 16 },
  incomeNote: { fontSize: 12, color: '#888780', textAlign: 'center', marginBottom: 8 },
})