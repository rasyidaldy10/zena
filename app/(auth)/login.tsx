import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, Platform, Image, KeyboardAvoidingView, ScrollView
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'

const PRIMARY = '#185FA5'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  // Safety timeout: reset loading jika stuck lebih dari 8 detik
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        setLoading(false)
        Alert.alert('Timeout', 'Login memakan waktu terlalu lama. Coba lagi.')
      }, 8000)
      return () => clearTimeout(timeout)
    }
  }, [loading])

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Oops', 'Email dan password harus diisi')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password.trim(),
      })

      if (error) throw error
      // Loading tetap ON sampai _layout.tsx selesai redirect
      if (!data.session) {
        setLoading(false)
        Alert.alert('Gagal', 'Login gagal. Periksa email dan password kamu.')
      }
    } catch (error: any) {
      setLoading(false)
      Alert.alert(
        'Gagal Masuk',
        error.message === 'Invalid login credentials'
          ? 'Email atau password salah.'
          : error.message || 'Terjadi kesalahan. Coba lagi.'
      )
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
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>Zena</Text>
            <Text style={styles.tagline}>Keuanganmu, selaras.</Text>
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
              editable={!loading}
            />
            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                placeholderTextColor="#555"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color="#888780"
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Masuk</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.disclaimer}>
            Belum punya akun? Hubungi admin Zena untuk dibuatkan akun.
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
  appName: { fontSize: 42, fontWeight: '900', color: '#fff', letterSpacing: 4, marginBottom: 8 },
  tagline: { fontSize: 14, color: '#888780', letterSpacing: 1 },
  formContainer: { gap: 12, marginBottom: 24 },
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
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    paddingRight: 12,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#fff',
  },
  eyeBtn: {
    padding: 6,
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
  submitText: { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  disclaimer: {
    fontSize: 12, color: '#555', textAlign: 'center', marginTop: 24,
    lineHeight: 18, paddingHorizontal: 12,
  },
  footer: { fontSize: 12, color: '#333', textAlign: 'center', paddingBottom: 32 },
})
