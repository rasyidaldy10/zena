import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, Platform, Image, KeyboardAvoidingView, ScrollView
} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { supabase } from '../../lib/supabase'

WebBrowser.maybeCompleteAuthSession()

const PRIMARY = '#185FA5'

export default function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false)

  // Safety timeout: reset loading jika stuck lebih dari 8 detik
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        console.log('⚠️ Loading timeout! Resetting...')
        setLoading(false)
        Alert.alert(
          'Timeout',
          'Login memakan waktu terlalu lama. Coba refresh halaman atau coba lagi.',
          [{ text: 'OK' }]
        )
      }, 8000)
      return () => clearTimeout(timeout)
    }
  }, [loading])

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Email dan password harus diisi')
      return
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password harus minimal 6 karakter')
      return
    }

    setLoading(true)
    try {
      if (mode === 'signup') {
        // Sign up - skip untuk development, pakai Google SSO
        console.log('🔵 Signup attempt:', email)
        setLoading(false)
        Alert.alert(
          'Info',
          'Untuk saat ini, silakan gunakan "Masuk dengan Google" di bawah.\n\nEmail signup sedang dalam pengembangan.',
          [{
            text: 'OK'
          }]
        )
        return
      } else {
        // Login
        console.log('🔵 Login attempt:', email)
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        })

        console.log('🔵 Login result:', { session: !!data.session, error })

        if (error) throw error

        if (data.session) {
          console.log('✅ Login success! Session:', data.session.user.id)
          // Loading akan tetap ON sampai redirect selesai by _layout.tsx
        }
      }
    } catch (error: any) {
      console.error('❌ Auth error:', error)
      Alert.alert(
        mode === 'signup' ? 'Gagal Daftar' : 'Gagal Masuk',
        error.message || 'Terjadi kesalahan. Silakan coba lagi.'
      )
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    console.log('🔵 Google login clicked')
    setLoadingGoogle(true)

    // Safety timeout: reset loading if OAuth doesn't complete within 30s
    const timeoutId = setTimeout(() => {
      console.log('⚠️ OAuth timeout - resetting loading state')
      setLoadingGoogle(false)
    }, 30000)

    try {
      if (Platform.OS === 'web') {
        console.log('🔵 Web OAuth flow')
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/`,
            skipBrowserRedirect: false,
          },
        })
        if (error) {
          console.error('❌ OAuth error:', error.message)
          clearTimeout(timeoutId)
          throw error
        }
        console.log('✅ Redirecting to Google...')
        // Web will auto-redirect, timeout will handle if user cancels
      } else {
        // Native mobile flow
        const redirectTo = Linking.createURL('/')
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo, skipBrowserRedirect: true },
        })
        clearTimeout(timeoutId)
        if (error) throw error
        if (data?.url) {
          const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
          if (result.type === 'success' && result.url) {
            await Linking.openURL(result.url)
          } else {
            // User cancelled
            setLoadingGoogle(false)
          }
        }
      }
    } catch (error: any) {
      clearTimeout(timeoutId)
      console.error('❌ Google login error:', error.message)
      Alert.alert('Login Gagal', error.message || 'Terjadi kesalahan saat login dengan Google')
      setLoadingGoogle(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Logo/Icon */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>Zena</Text>
            <Text style={styles.tagline}>Keuanganmu, selaras.</Text>
          </View>

          {/* Toggle Login/Sign Up */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === 'login' && styles.toggleBtnActive]}
              onPress={() => setMode('login')}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleText, mode === 'login' && styles.toggleTextActive]}>
                Masuk
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === 'signup' && styles.toggleBtnActive]}
              onPress={() => setMode('signup')}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleText, mode === 'signup' && styles.toggleTextActive]}>
                Daftar
              </Text>
            </TouchableOpacity>
          </View>

          {/* Email/Password Form */}
          <View style={styles.formContainer}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#555"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading && !loadingGoogle}
            />
            <TextInput
              style={styles.input}
              placeholder="Password (min. 6 karakter)"
              placeholderTextColor="#555"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading && !loadingGoogle}
            />
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleEmailAuth}
              disabled={loading || loadingGoogle}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>
                  {mode === 'login' ? 'Masuk' : 'Daftar'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>atau</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Login Button */}
          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogleLogin}
            disabled={loading || loadingGoogle}
            activeOpacity={0.8}
          >
            {loadingGoogle ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text style={styles.googleTextLoading}>Membuka Google...</Text>
              </>
            ) : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleText}>Masuk dengan Google</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Dengan masuk, kamu menyetujui penggunaan data untuk personalisasi pengalaman keuangan
          </Text>
        </View>

        <Text style={styles.footer}>Made with 🤍 by Zena AI</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  scrollContent: { flexGrow: 1, justifyContent: 'space-between' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 32, paddingTop: 40 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logo: { width: 100, height: 100, marginBottom: 12 },
  logoText: { fontSize: 72, marginBottom: 12 },
  appName: { fontSize: 42, fontWeight: '900', color: '#fff', letterSpacing: 4, marginBottom: 8 },
  tagline: { fontSize: 14, color: '#888780', letterSpacing: 1 },

  // Toggle Login/Sign Up
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: PRIMARY,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  toggleTextActive: {
    color: '#fff',
  },

  // Form
  formContainer: {
    gap: 12,
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  submitBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: PRIMARY,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2A2A2A',
  },
  dividerText: {
    fontSize: 13,
    color: '#555',
    marginHorizontal: 16,
  },

  // Google Button
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1A1A1A', borderRadius: 12, paddingVertical: 16,
    gap: 12, borderWidth: 1, borderColor: '#2A2A2A',
  },
  googleIcon: { fontSize: 20, fontWeight: '900', color: '#fff' },
  googleText: { fontSize: 15, fontWeight: '600', color: '#fff', letterSpacing: 0.5 },
  googleTextLoading: { fontSize: 14, fontWeight: '600', color: '#fff', marginLeft: 12 },

  disclaimer: {
    fontSize: 11, color: '#555', textAlign: 'center', marginTop: 24,
    lineHeight: 16, paddingHorizontal: 12,
  },
  footer: {
    fontSize: 12, color: '#333', textAlign: 'center', paddingBottom: 32,
  },
})
