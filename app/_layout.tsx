import { useEffect, useState, useRef } from 'react'
import { Platform, ActivityIndicator, View } from 'react-native'
import { Stack, router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import { ErrorBoundary } from '../lib/ErrorBoundary'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)
  const hasNavigatedRef = useRef(false)

  useEffect(() => {
    // Initial check with routing
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)

      // Route based on session - only on first load
      if (!hasNavigatedRef.current) {
        try {
          if (session) {
            // Check onboarding status
            const { data, error } = await supabase
              .from('user_preferences')
              .select('id')
              .eq('user_id', session.user.id)
              .maybeSingle()

            if (error) {
              console.error('Error fetching user_preferences:', error)
              // If DB error, go to login
              router.replace('/(auth)/login')
            } else if (data) {
              router.replace('/(tabs)')
            } else {
              router.replace('/onboarding')
            }
          } else {
            router.replace('/(auth)/login')
          }
        } catch (error) {
          console.error('Routing error:', error)
          // Fallback to login on any error
          router.replace('/(auth)/login')
        }
        hasNavigatedRef.current = true
      }

      setInitializing(false)
    }).catch((error) => {
      console.error('Auth session error:', error)
      setInitializing(false)
      router.replace('/(auth)/login')
    })

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        console.log('🔔 Auth event:', event, 'Session:', !!session, 'HasNavigated:', hasNavigatedRef.current)
        setSession(session)

        // Handle only login/logout events (not TOKEN_REFRESHED, INITIAL_SESSION)
        if (event === 'SIGNED_IN' && session && hasNavigatedRef.current) {
          console.log('🔵 SIGNED_IN detected, checking onboarding...')
          const { data, error } = await supabase
            .from('user_preferences')
            .select('id')
            .eq('user_id', session.user.id)
            .maybeSingle()

          console.log('🔵 User preferences result:', { exists: !!data, error })

          if (error) {
            console.error('❌ Error fetching preferences on SIGNED_IN:', error)
            // Fallback ke onboarding jika error
            console.log('⚠️ Fallback to onboarding due to error')
            router.replace('/onboarding')
          } else if (data) {
            console.log('✅ User has preferences, go to dashboard')
            router.replace('/(tabs)')
          } else {
            console.log('✅ New user, go to onboarding')
            router.replace('/onboarding')
          }
        } else if (event === 'SIGNED_OUT' && hasNavigatedRef.current) {
          console.log('🔴 SIGNED_OUT, go to login')
          router.replace('/(auth)/login')
        }
        // Ignore TOKEN_REFRESHED, USER_UPDATED, INITIAL_SESSION
      } catch (error) {
        console.error('❌ Auth state change error:', error)
        // Fallback to onboarding on any error
        if (session) {
          console.log('⚠️ Fallback to onboarding due to catch error')
          router.replace('/onboarding')
        }
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
        <Stack.Screen name="gmail-setup" />
      </Stack>
    </ErrorBoundary>
  )
}
