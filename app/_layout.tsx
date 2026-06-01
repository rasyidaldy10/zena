import { useEffect, useState } from 'react'
import { Platform, ActivityIndicator, View } from 'react-native'
import { Stack, router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    // Initial check: fast, no DB query
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setInitializing(false)
    })

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event)
      setSession(session)

      // Handle only login/logout events
      if (event === 'SIGNED_IN' && session) {
        // Check onboarding status (non-blocking)
        const { data } = await supabase
          .from('user_preferences')
          .select('id')
          .eq('user_id', session.user.id)
          .maybeSingle()

        if (data) {
          router.replace('/(tabs)')
        } else {
          router.replace('/onboarding')
        }
      } else if (event === 'SIGNED_OUT') {
        router.replace('/(auth)/login')
      }
    })

    return () => subscription.unsubscribe()
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
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ animation: 'none' }} />
      <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
      <Stack.Screen name="onboarding" options={{ animation: 'none' }} />
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
