import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { ParsedTransaction, formatParsedTransaction } from '../lib/transaction-parser'

const PRIMARY = '#185FA5'

interface Props {
  parsed: ParsedTransaction
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export default function TransactionConfirmCard({ parsed, onConfirm, onCancel, loading }: Props) {
  const confidence = Math.round(parsed.confidence * 100)
  const confidenceColor = confidence >= 70 ? '#1D9E75' : confidence >= 50 ? '#EF9F27' : '#E24B4A'

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>💡 Deteksi Transaksi</Text>
        <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor + '20' }]}>
          <Text style={[styles.confidenceText, { color: confidenceColor }]}>
            {confidence}% yakin
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.details}>{formatParsedTransaction(parsed)}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.cancelBtn]}
          onPress={onCancel}
          disabled={loading}
        >
          <Text style={styles.cancelText}>❌ Batal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.confirmBtn]}
          onPress={onConfirm}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.confirmText}>✅ Simpan</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>
        Tap Simpan untuk otomatis catat transaksi ini
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: PRIMARY + '40',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  confidenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '700',
  },
  content: {
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  details: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: '#2A2A2A',
  },
  confirmBtn: {
    backgroundColor: PRIMARY,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#888780',
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  hint: {
    fontSize: 11,
    color: '#888780',
    textAlign: 'center',
  },
})
