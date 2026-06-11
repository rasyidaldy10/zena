import { ActivityIndicator, View } from 'react-native'

// Halaman entry (route "/"). Cuma loader — routing sebenarnya ditangani
// oleh auth listener di _layout.tsx (router.replace ke login/onboarding/tabs).
export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0F0F0F', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#185FA5" />
    </View>
  )
}
