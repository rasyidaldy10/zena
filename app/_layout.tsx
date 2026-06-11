import { useEffect, useRef } from 'react'
import { Stack, router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import { ErrorBoundary } from '../lib/ErrorBoundary'

export default function RootLayout() {
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
    let routedOnce = false

    // Hard safety net: kalau INITIAL_SESSION telat/tak fire, route manual via
    // getSession (di luar callback = aman, tak deadlock).
    const hardStop = setTimeout(async () => {
      if (routedOnce) return
      try {
        const { data: { session: s } } = await supabase.auth.getSession()
        routedOnce = true
        routedUserRef.current = s?.user?.id ?? null
        await routeForSession(s)
      } catch {
        router.replace('/(auth)/login')
      }
    }, 4000)

    // PENTING: jangan await query Supabase LANGSUNG di dalam callback
    // onAuthStateChange — bisa deadlock (auth client lagi megang lock).
    // Defer pakai setTimeout(0) supaya query jalan di luar lock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      // INITIAL_SESSION: routing awal saat app start
      if (event === 'INITIAL_SESSION') {
        routedOnce = true
        routedUserRef.current = newSession?.user?.id ?? null
        setTimeout(() => {
          routeForSession(newSession).catch(() =>
            router.replace(newSession ? '/(tabs)' : '/(auth)/login')
          )
        }, 0)
        return
      }

      // SIGNED_IN: navigasi HANYA kalau login user baru (bukan refocus recovery)
      if (event === 'SIGNED_IN' && newSession) {
        if (routedUserRef.current === newSession.user.id) return
        routedUserRef.current = newSession.user.id
        setTimeout(() => {
          routeForSession(newSession).catch(() => router.replace('/(tabs)'))
        }, 0)
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
      clearTimeout(hardStop)
      subscription.unsubscribe()
    }
  }, [])

  // PENTING: <Stack> SELALU di-render supaya router.replace selalu punya
  // navigator. Loading awal ditampilkan oleh route index ("/") yang berupa
  // loader. Auth listener di atas yang router.replace ke tujuan sebenarnya.
  return (
    <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
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
