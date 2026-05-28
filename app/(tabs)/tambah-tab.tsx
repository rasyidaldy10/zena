import { useEffect } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'

export default function TambahTab() {
  useEffect(() => {
    router.replace('/tambah-transaksi')
  }, [])
  return <View />
}