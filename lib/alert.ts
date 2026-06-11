import { Alert, Platform } from 'react-native'

/**
 * Konfirmasi cross-platform.
 * Di web, Alert.alert React Native TIDAK menjalankan callback tombol,
 * jadi pakai window.confirm. Di native pakai Alert.alert biasa.
 * @returns Promise<boolean> — true kalau user menekan tombol konfirmasi.
 */
export function confirmAsync(
  title: string,
  message?: string,
  confirmText = 'OK',
  cancelText = 'Batal'
): Promise<boolean> {
  if (Platform.OS === 'web') {
    const ok = typeof window !== 'undefined'
      ? window.confirm(message ? `${title}\n\n${message}` : title)
      : false
    return Promise.resolve(ok)
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: 'destructive', onPress: () => resolve(true) },
    ])
  })
}

/**
 * Notifikasi sederhana cross-platform (1 tombol OK).
 * Di web pakai window.alert; di native Alert.alert.
 */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(message ? `${title}\n\n${message}` : title)
    }
    return
  }
  Alert.alert(title, message)
}
