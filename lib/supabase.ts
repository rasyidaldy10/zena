import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

// Storage: localStorage di web, AsyncStorage di native (iOS/Android)
// Ini bikin session persistent — gak logout/onboarding ulang saat app ditutup
const storage = Platform.OS === 'web'
  ? {
      getItem: (key: string) =>
        typeof window !== 'undefined' ? window.localStorage.getItem(key) : null,
      setItem: (key: string, value: string) => {
        if (typeof window !== 'undefined') window.localStorage.setItem(key, value)
      },
      removeItem: (key: string) => {
        if (typeof window !== 'undefined') window.localStorage.removeItem(key)
      },
    }
  : AsyncStorage

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storage,
    storageKey: 'zena-auth',
  },
})
