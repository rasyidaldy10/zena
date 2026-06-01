import { useEffect, useState } from 'react'
import { Platform, ActivityIndicator, View } from 'react-native'
import { Stack, router, useSegments, usePathname } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [initialized, setInitialized] = useState(false)
  const segments = useSegments()
  const pathname = usePathname()

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)

      if (session) {
        // Cek apakah user sudah onboarding
        const { data } = await supabase
          .from('user_preferences')
          .select('id')
          .eq('user_id', session.user.id)
          .single()

        if (data) {
          // User sudah onboarding → dashboard
          if (pathname === '/' || pathname.includes('auth')) {
            router.replace('/(tabs)')
          }
        } else {
          // User baru → onboarding
          if (!pathname.includes('onboarding')) {
            router.replace('/onboarding')
          }
        }
      } else {
        // No session → login
        const isOAuthCallback =
          Platform.OS === 'web' &&
          typeof window !== 'undefined' &&
          window.location.search.includes('code=')

        if (!isOAuthCallback && !pathname.includes('auth')) {
          router.replace('/(auth)/login')
        }
      }

      setInitialized(true)
    })

    // Listen auth changes (login/logout only, bukan setiap state change)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)

      // Hanya handle event login/logout, bukan INITIAL_SESSION atau TOKEN_REFRESHED
      if (event === 'SIGNED_IN' && session) {
        const { data } = await supabase
          .from('user_preferences')
          .select('id')
          .eq('user_id', session.user.id)
          .single()

        if (data) {
          router.replace('/(tabs)')
        } else {
          router.replace('/onboarding')
        }
      } else if (event === 'SIGNED_OUT') {
        router.replace('/(auth)/login')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  if (!initialized) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0F0F', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#185FA5" />
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="tambah-transaksi" />
      <Stack.Screen name="edit-transaksi" />
      <Stack.Screen name="tambah-wallet" />
      <Stack.Screen name="edit-wallet" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="zena-intelligence" />
      <Stack.Screen name="gmail-setup" />
    </Stack>
  )
}
