import { useEffect, useState, useRef } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Stack, router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import { ErrorBoundary } from '../lib/ErrorBoundary'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)
  // Track user id yang SUDAH di-route. Mencegah navigasi ulang saat
  // tab di-refocus (Supabase fire SIGNED_IN lagi pas session recovery).
  const routedUserRef = useRef<string | null>(null)

  // Tentukan tujuan berdasarkan session + status onboarding
  const routeForSession = async (s: Session | null) => {
    if (!s) {
      routedUserRef.current = null
      router.replace('/(auth)/login')
      return
    }
    // Pakai limit(1) — TIDAK pakai maybeSingle karena maybeSingle ERROR
    // kalau ada baris duplikat (yang bikin user nyangkut di onboarding loop).
    const { data, error } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', s.user.id)
      .limit(1)

    if (error) {
      // Error baca prefs (network/RLS) → jangan tendang ke onboarding.
      // User punya session = kemungkinan besar returning user → ke dashboard.
      console.error('Prefs check error:', error.message)
      router.replace('/(tabs)')
      return
    }
    router.replace(data && data.length > 0 ? '/(tabs)' : '/onboarding')
  }

  useEffect(() => {
    // Safety: kalau INITIAL_SESSION tak kunjung datang dalam 3s, route manual
    const fallback = setTimeout(async () => {
      if (initializing) {
        const { data: { session: s } } = await supabase.auth.getSession()
        routedUserRef.current = s?.user?.id ?? null
        await routeForSession(s)
        setInitializing(false)
      }
    }, 3000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession)

      // INITIAL_SESSION: dipanggil sekali saat app start (sumber routing awal)
      if (event === 'INITIAL_SESSION') {
        clearTimeout(fallback)
        routedUserRef.current = newSession?.user?.id ?? null
        await routeForSession(newSession)
        setInitializing(false)
        return
      }

      // SIGNED_IN: navigasi HANYA kalau ini login user baru (bukan refocus
      // recovery untuk user yang sudah di-route).
      if (event === 'SIGNED_IN' && newSession) {
        if (routedUserRef.current === newSession.user.id) {
          return // session recovery / refocus — jangan navigasi
        }
        routedUserRef.current = newSession.user.id
        await routeForSession(newSession)
        return
      }

      // SIGNED_OUT: balik ke login
      if (event === 'SIGNED_OUT') {
        routedUserRef.current = null
        router.replace('/(auth)/login')
        return
      }

      // TOKEN_REFRESHED & USER_UPDATED: tidak perlu navigasi apa-apa
    })

    return () => {
      clearTimeout(fallback)
      subscription.unsubscribe()
    }
  }, [])

  // Show loader only during first initialization
  if (initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0F0F', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#185FA5" />
      </View>
    )
  }

  return (
    <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ animation: 'none' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'none' }} />
        <Stack.Screen name="tambah-transaksi" />
        <Stack.Screen name="edit-transaksi" />
        <Stack.Screen name="tambah-wallet" />
        <Stack.Screen name="edit-wallet" />
        <Stack.Screen name="tambah-investasi" />
        <Stack.Screen name="detail-wallet" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="zena-intelligence" />
      </Stack>
    </ErrorBoundary>
  )
}
