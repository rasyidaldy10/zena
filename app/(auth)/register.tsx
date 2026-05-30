import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { supabase } from '../../lib/supabase'

WebBrowser.maybeCompleteAuthSession()

export default function RegisterScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Oops', 'Semua field harus diisi ya')
      return
    }
    if (password !== confirmPassword) {
      Alert.alert('Oops', 'Password tidak sama nih')
      return
    }
    if (password.length < 6) {
      Alert.alert('Oops', 'Password minimal 6 karakter ya')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      Alert.alert('Gagal daftar', error.message)
    } else {
      Alert.alert(
        'Berhasil! 🎉',
        'Cek email kamu untuk verifikasi ya, lalu login.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      )
    }
    setLoading(false)
  }

  const handleGoogleRegister = async () => {
    setGoogleLoading(true)
    try {
      const redirectTo = Linking.createURL('/')
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          scopes: 'email profile',
        },
      })
      if (error) throw error
      if (!data?.url) throw new Error('Tidak ada URL OAuth')

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
      if (result.type === 'success') {
        const { url } = result
        const { error: sessionError } = await supabase.auth.exchangeCodeForSession(url)
        if (sessionError) throw sessionError
      }
    } catch (err: any) {
      Alert.alert('Gagal daftar dengan Google', err.message || 'Coba lagi ya')
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <View style={styles.logoWrap}>
          <Text style={styles.logo}>Zena</Text>
          <Text style={styles.tagline}>Mulai perjalanan finansialmu</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#888780"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#888780"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            placeholder="Konfirmasi password"
            placeholderTextColor="#888780"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={handleRegister}
            disabled={loading || googleLoading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnPrimaryText}>Daftar Sekarang</Text>
            }
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>atau daftar dengan</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.btnGoogle}
            onPress={handleGoogleRegister}
            disabled={loading || googleLoading}
          >
            {googleLoading
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.btnGoogleText}>Daftar dengan Google</Text>
                </>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => router.back()}
          >
            <Text style={styles.btnSecondaryText}>Sudah punya akun? Masuk</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  logoWrap: { alignItems: 'center', marginBottom: 48 },
  logo: { fontSize: 48, fontWeight: '600', color: '#185FA5', letterSpacing: -1 },
  tagline: { fontSize: 14, color: '#888780', marginTop: 6 },
  form: { gap: 12 },
  input: {
    height: 52,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#2A2A2A',
  },
  btnPrimary: {
    height: 52,
    backgroundColor: '#185FA5',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: '#2A2A2A' },
  dividerText: { fontSize: 12, color: '#888780' },
  btnGoogle: {
    height: 52,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#2A2A2A',
    gap: 10,
  },
  googleIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4285F4',
  },
  btnGoogleText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  btnSecondary: { alignItems: 'center', paddingVertical: 12 },
  btnSecondaryText: { color: '#888780', fontSize: 14 },
})
