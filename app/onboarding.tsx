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

const PERSONA_PREVIEW: Record<string, (name: string, lang: string) => string> = {
  bestie: (n, l) => l === 'en' ? `"Yo ${n}! I got your wallet covered. Let's go! 😎"` : l === 'my' ? `"Eh ${n}! Jom kita jaga duit sama-sama! 😎"` : l === 'zh' ? `"嘿 ${n}！我来帮你管钱啦！😎"` : `"Eh ${n}! Santai aja, gue jagain dompet lo. Gas! 😎"`,
  advisor: (n, l) => l === 'en' ? `"Welcome, ${n}. I'm here to help you manage your finances professionally."` : l === 'my' ? `"Selamat datang, ${n}. Saya sedia membantu anda mengurus kewangan."` : l === 'zh' ? `"欢迎，${n}。我将专业地帮助您管理财务。"` : `"Selamat datang, ${n}. Saya siap membantu Anda mengelola keuangan dengan baik."`,
  kakak: (n, l) => l === 'en' ? `"Hey ${n}! I'm always here for you 🧡"` : l === 'my' ? `"Eh ${n}, akak ada di sini ya. Jangan risau 🧡"` : l === 'zh' ? `"嘿 ${n}，我一直在这里支持你 🧡"` : `"Eh ${n}, kak di sini ya. Tenang aja, kak bantu pelan-pelan 🧡"`,
  adek: (n, l) => l === 'en' ? `"Hiii ${n}! I'll cheer you on every step! 🎉"` : l === 'my' ? `"Kak ${n}! Adik akan sokong kak selalu! 🎉"` : l === 'zh' ? `"${n}！我会一直为你加油的！🎉"` : `"Kak ${n}! Dek seneng bisa bantu kak! Semangat terus ya kak! 🎉"`,
  pacar: (n, l) => l === 'en' ? `"Hey babe ${n}, let's manage our money together ♡"` : l === 'my' ? `"${n} sayang, jom kita uruskan duit bersama ♡"` : l === 'zh' ? `"${n} 亲爱的，我们一起管理财务吧 ♡"` : `"${n} sayang, aku selalu ada kok. Kita atur keuangan bareng yuk ♡"`,
  stoic: (n, l) => l === 'en' ? `"${n}. Good finances start with action today."` : l === 'my' ? `"${n}. Kewangan yang baik bermula dengan tindakan hari ini."` : l === 'zh' ? `"${n}。良好的财务从今天的行动开始。"` : `"${n}. Keuangan baik dimulai dari langkah hari ini."`,
}

const LANG_LABELS: Record<string, Record<string, string>> = {
  id: {
    step1Title: 'Pilih bahasa',
    step1Sub: 'Zena akan ngobrol pakai bahasa ini',
    step2Title: 'Siapa namamu?',
    step2Sub: 'Biar Zena bisa nyapa kamu dengan cara yang paling nyaman',
    step2Placeholder: 'Nama panggilanmu...',
    step3Title: 'Zena mau jadi siapa buat kamu?',
    step3Sub: 'Bisa diganti kapan saja di pengaturan',
    step4Title: 'Metode budgeting',
    step4Sub: 'Pilih yang paling cocok, bisa diubah nanti',
    step5Title: 'Berapa penghasilan bulananmu?',
    step5Sub: 'Buat bantu Zena hitung budget yang pas buat kamu',
    step5Note: 'Bisa dilewati, isi nanti di profil',
    preview: 'Preview sapaan:',
    next: 'Lanjut →',
    back: '← Kembali',
    start: 'Mulai pakai Zena 🚀',
  },
  en: {
    step1Title: 'Pick a language',
    step1Sub: 'Zena will talk to you in this language',
    step2Title: "What's your name?",
    step2Sub: 'So Zena can greet you the way you like',
    step2Placeholder: 'Your nickname...',
    step3Title: 'Who should Zena be for you?',
    step3Sub: 'You can change this anytime in settings',
    step4Title: 'Budgeting method',
    step4Sub: 'Pick one that fits, you can change later',
    step5Title: "What's your monthly income?",
    step5Sub: 'Helps Zena calculate the right budget for you',
    step5Note: 'You can skip this and fill it later in profile',
    preview: 'Preview:',
    next: 'Next →',
    back: '← Back',
    start: 'Start using Zena 🚀',
  },
  my: {
    step1Title: 'Pilih bahasa',
    step1Sub: 'Zena akan berbual dalam bahasa ini',
    step2Title: 'Siapa nama anda?',
    step2Sub: 'Supaya Zena boleh sapa anda dengan cara yang selesa',
    step2Placeholder: 'Nama panggilan anda...',
    step3Title: 'Zena nak jadi siapa untuk anda?',
    step3Sub: 'Boleh tukar bila-bila masa dalam tetapan',
    step4Title: 'Kaedah belanjawan',
    step4Sub: 'Pilih yang sesuai, boleh tukar kemudian',
    step5Title: 'Berapa pendapatan bulanan anda?',
    step5Sub: 'Untuk bantu Zena kira belanjawan yang sesuai',
    step5Note: 'Boleh langkau dan isi kemudian di profil',
    preview: 'Pratonton sapaan:',
    next: 'Seterusnya →',
    back: '← Kembali',
    start: 'Mula guna Zena 🚀',
  },
  zh: {
    step1Title: '选择语言',
    step1Sub: 'Zena 将使用这种语言与你交流',
    step2Title: '你叫什么名字？',
    step2Sub: 'Zena 会用你喜欢的方式问候你',
    step2Placeholder: '你的昵称...',
    step3Title: 'Zena 应该扮演什么角色？',
    step3Sub: '随时可以在设置中更改',
    step4Title: '预算方法',
    step4Sub: '选择适合你的，之后可以更改',
    step5Title: '你的月收入是多少？',
    step5Sub: '帮助 Zena 为你计算合适的预算',
    step5Note: '可以跳过，稍后在个人资料中填写',
    preview: '问候预览：',
    next: '下一步 →',
    back: '← 返回',
    start: '开始使用 Zena 🚀',
  },
}

export default function OnboardingScreen() {
  const [step, setStep] = useState(1)
  const [nickname, setNickname] = useState('')
  const [persona, setPersona] = useState<Persona>('bestie')
  const [language, setLanguage] = useState<Language>('en')
  const [budgetMethod, setBudgetMethod] = useState<BudgetMethod>('503020')
  const [income, setIncome] = useState('')
  const [loading, setLoading] = useState(false)

  const t = LANG_LABELS[language] ?? LANG_LABELS['en']

  const formatIncome = (text: string) => {
    const numbers = text.replace(/\D/g, '')
    const formatted = numbers.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    setIncome(formatted)
  }

  const handleFinish = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user

    const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null
    const userId = user?.id

    // HARUS selesai dulu sebelum navigate — kalau fire-and-forget,
    // _layout.tsx cek user_preferences dan tidak ketemu → redirect ke onboarding lagi
    await Promise.all([
      supabase.from('user_preferences').upsert({
        user_id: userId,
        nickname: nickname || user?.user_metadata?.full_name?.split(' ')[0] || '',
        persona,
        language,
        budget_method: budgetMethod,
        monthly_income: parseFloat(income.replace(/\./g, '')) || 0,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        updated_at: new Date().toISOString(),
      }),
      supabase.from('user_wallets').insert([
        { user_id: userId, wallet_name: 'Cash', wallet_type: 'personal', color: '#185FA5', icon: '💵' },
        { user_id: userId, wallet_name: 'Bank', wallet_type: 'personal', color: '#534AB7', icon: '🏦' },
      ]),
    ])

    router.replace('/(tabs)')
    setLoading(false)
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepWrap}>
            <Text style={styles.stepNum}>1 / 5</Text>
            <Text style={styles.stepTitle}>{t.step1Title}</Text>
            <Text style={styles.stepSub}>{t.step1Sub}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(Object.entries(LANGUAGE_CONFIG) as [Language, typeof LANGUAGE_CONFIG[Language]][]).map(([key, l]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.personaBtn, language === key && styles.personaBtnActive]}
                  onPress={() => setLanguage(key)}
                >
                  <Text style={styles.personaIcon}>{l.flag}</Text>
                  <View style={styles.personaInfo}>
                    <Text style={[styles.personaName, language === key && styles.personaNameActive]}>{l.label}</Text>
                    <Text style={styles.personaDesc}>{l.desc}</Text>
                  </View>
                  {language === key && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[styles.nextBtn, { marginTop: 16 }]} onPress={() => setStep(2)}>
                <Text style={styles.nextBtnText}>{t.next}</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        )

      case 2:
        return (
          <View style={styles.stepWrap}>
            <Text style={styles.stepNum}>2 / 5</Text>
            <Text style={styles.stepTitle}>{t.step2Title}</Text>
            <Text style={styles.stepSub}>{t.step2Sub}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.step2Placeholder}
              placeholderTextColor="#888780"
              value={nickname}
              onChangeText={setNickname}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.nextBtn, !nickname && styles.nextBtnDisabled]}
              onPress={() => nickname && setStep(3)}
              disabled={!nickname}
            >
              <Text style={styles.nextBtnText}>{t.next}</Text>
            </TouchableOpacity>
          </View>
        )

      case 3:
        return (
          <View style={styles.stepWrap}>
            <Text style={styles.stepNum}>3 / 5</Text>
            <Text style={styles.stepTitle}>{t.step3Title}</Text>
            <Text style={styles.stepSub}>{t.step3Sub}</Text>
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
                <Text style={styles.previewLabel}>{t.preview}</Text>
                <Text style={styles.previewText}>
                  {PERSONA_PREVIEW[persona]?.(nickname, language)}
                </Text>
              </View>
              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(4)}>
                <Text style={styles.nextBtnText}>{t.next}</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        )

      case 4:
        return (
          <View style={styles.stepWrap}>
            <Text style={styles.stepNum}>4 / 5</Text>
            <Text style={styles.stepTitle}>{t.step4Title}</Text>
            <Text style={styles.stepSub}>{t.step4Sub}</Text>
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
              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(5)}>
                <Text style={styles.nextBtnText}>{t.next}</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        )

      case 5:
        return (
          <View style={styles.stepWrap}>
            <Text style={styles.stepNum}>5 / 5</Text>
            <Text style={styles.stepTitle}>{t.step5Title}</Text>
            <Text style={styles.stepSub}>{t.step5Sub}</Text>
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
            <Text style={styles.incomeNote}>{t.step5Note}</Text>
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={handleFinish}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.nextBtnText}>{t.start}</Text>
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
            <Text style={styles.backText}>{t.back}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.logo}>Zena</Text>
        <View style={{ width: 80 }} />
      </View>

      <View style={styles.progressWrap}>
        {[1, 2, 3, 4, 5].map(s => (
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