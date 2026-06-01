import { useEffect, useState } from 'react'
import { Platform, ActivityIndicator, View } from 'react-native'
import { Stack, router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    // Initial check with routing
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)

      // Route based on session
      if (session) {
        // Check onboarding status
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
      } else {
        router.replace('/(auth)/login')
      }

      setInitializing(false)
    })

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event)
      setSession(session)

      // Handle only login/logout events (not TOKEN_REFRESHED)
      if (event === 'SIGNED_IN' && session) {
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
      // Ignore TOKEN_REFRESHED, USER_UPDATED, INITIAL_SESSION
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
      <Stack.Screen name="tambah-investasi" />
      <Stack.Screen name="detail-wallet" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="zena-intelligence" />
      <Stack.Screen name="gmail-setup" />
    </Stack>
  )
}
