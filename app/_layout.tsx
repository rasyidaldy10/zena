import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { Stack, router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'

const isOAuthCallback = () => {
  if (Platform.OS !== 'web') return false
  try {
    const search = window.location.search
    const hash = window.location.hash
    return search.includes('code=') || hash.includes('access_token=')
  } catch {
    return false
  }
}

export default function RootLayout() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Kalau ini OAuth callback (ada ?code= di URL), tunggu exchange selesai
    // sebelum cek session — jangan langsung redirect ke login
    const oauthInProgress = isOAuthCallback()

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!oauthInProgress) {
        // Bukan OAuth callback: langsung routing berdasarkan session
        if (!session) {
          setLoading(false)
          router.replace('/(auth)/login')
          return
        }
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
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
            setLoading(false)
            router.replace('/(tabs)')
          } else {
            setLoading(false)
            router.replace('/onboarding')
          }
        } else if (event === 'SIGNED_OUT') {
          // Hanya redirect ke login kalau memang logout eksplisit
          setLoading(false)
          router.replace('/(auth)/login')
        }
      }
    )

    return () => subscription.unsubscribe()
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
    </Stack>
  )
}
