import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { Stack, router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) {
        setSession(session)
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return
      setSession(session)
      if (session) {
        const { data } = await supabase
          .from('user_preferences')
          .select('id, avatar_url')
          .eq('user_id', session.user.id)
          .single()

        if (data) {
          const googleAvatar =
            session.user.user_metadata?.avatar_url ||
            session.user.user_metadata?.picture
          if (googleAvatar && !data.avatar_url) {
            await supabase
              .from('user_preferences')
              .update({ avatar_url: googleAvatar })
              .eq('user_id', session.user.id)
          }
          router.replace('/(tabs)')
        } else {
          router.replace('/onboarding')
        }
      } else {
        // Jangan redirect ke login kalau lagi proses OAuth callback
        // (URL punya ?code= dari Supabase redirect)
        const isOAuthCallback =
          Platform.OS === 'web' &&
          typeof window !== 'undefined' &&
          window.location.search.includes('code=')

        if (!isOAuthCallback) {
          router.replace('/(auth)/login')
        }
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  if (loading) return null

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="tambah-transaksi" />
      <Stack.Screen name="edit-transaksi" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="zena-intelligence" />
    </Stack>
  )
}
