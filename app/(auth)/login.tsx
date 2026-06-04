import { useState } from 'react'
import {
  View, Text, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Platform, Image
} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { supabase } from '../../lib/supabase'

WebBrowser.maybeCompleteAuthSession()

const PRIMARY = '#185FA5'

export default function LoginScreen() {
  const [loading, setLoading] = useState(false)

  const handleGoogleLogin = async () => {
    setLoading(true)
    try {
      if (Platform.OS === 'web') {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
            scopes: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
            skipBrowserRedirect: false,
            queryParams: {
              access_type: 'offline',
              // prompt: 'consent' removed - hanya pakai saat pertama kali atau di profile
            },
          },
        })
        if (error) throw error
        // Web will auto-redirect to Google, no need to setLoading(false)
      } else {
        const redirectTo = Linking.createURL('/')
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo,
            skipBrowserRedirect: true,
            scopes: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
            queryParams: {
              access_type: 'offline',
              // prompt: 'consent' removed
            },
          },
        })
        if (error) throw error
        if (data?.url) {
          const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
          if (result.type === 'success' && result.url) {
            const url = Linking.parse(result.url)
            const sessionUrl = `${redirectTo}${url.path ?? ''}?${url.queryParams ? new URLSearchParams(url.queryParams as Record<string, string>).toString() : ''}`
            await Linking.openURL(sessionUrl)
          }
        }
      }
    } catch (error: any) {
      Alert.alert('Login Gagal', error.message || 'Terjadi kesalahan saat login dengan Google')
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
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

        {/* Google Login Button */}
        <TouchableOpacity
          style={styles.googleBtn}
          onPress={handleGoogleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
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
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F', justifyContent: 'space-between' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logoContainer: { alignItems: 'center', marginBottom: 60 },
  logo: { width: 120, height: 120, marginBottom: 16 },
  logoText: { fontSize: 72, marginBottom: 12 },
  appName: { fontSize: 42, fontWeight: '900', color: '#fff', letterSpacing: 4, marginBottom: 8 },
  tagline: { fontSize: 14, color: '#888780', letterSpacing: 1 },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 16,
    gap: 12, shadowColor: PRIMARY, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  googleIcon: { fontSize: 24, fontWeight: '900', color: '#fff' },
  googleText: { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  googleTextLoading: { fontSize: 14, fontWeight: '600', color: '#fff', marginLeft: 12 },
  disclaimer: {
    fontSize: 11, color: '#555', textAlign: 'center', marginTop: 24,
    lineHeight: 16, paddingHorizontal: 12,
  },
  footer: {
    fontSize: 12, color: '#333', textAlign: 'center', paddingBottom: 32,
  },
})
