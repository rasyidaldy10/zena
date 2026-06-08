import { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { UserWallet } from '../types'
import { COLORS } from '../constants/theme'
import { formatRupiah } from '../lib/format'

interface Props {
  visible: boolean
  onClose: () => void
  onSelect: (wallet: UserWallet) => void
}

export default function ModalPilihWallet({ visible, onClose, onSelect }: Props) {
  const [wallets, setWallets] = useState<UserWallet[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (visible) {
      fetchWallets()
    }
  }, [visible])

  async function fetchWallets() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data, error } = await supabase
        .from('user_wallets')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setWallets(data || [])
    } catch (error) {
      console.error('Error fetching wallets:', error)
    } finally {
      setLoading(false)
    }
  }

  function renderWalletItem({ item }: { item: UserWallet }) {
    return (
      <TouchableOpacity style={styles.walletItem} onPress={() => onSelect(item)}>
        <View style={styles.walletLeft}>
          <Text style={styles.walletIcon}>{item.icon}</Text>
          <View style={styles.walletInfo}>
            <Text style={styles.walletName}>{item.wallet_name}</Text>
            {item.bank_name && (
              <Text style={styles.walletBank}>
                {item.bank_name}
                {item.last_4_digits && ` •••• ${item.last_4_digits}`}
              </Text>
            )}
          </View>
        </View>
        <Text style={styles.walletBalance}>{formatRupiah(item.current_balance)}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Pilih Wallet</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Wallet List */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={COLORS.PRIMARY} />
            </View>
          ) : wallets.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>Tidak ada wallet aktif</Text>
            </View>
          ) : (
            <FlatList
              data={wallets}
              renderItem={renderWalletItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  closeButton: {
    fontSize: 24,
    color: COLORS.TEXT_LIGHT,
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.TEXT_LIGHT,
  },
  listContent: {
    padding: 16,
    gap: 8,
  },
  walletItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: 12,
    padding: 16,
  },
  walletLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  walletIcon: {
    fontSize: 24,
  },
  walletInfo: {
    flex: 1,
    gap: 2,
  },
  walletName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  walletBank: {
    fontSize: 12,
    color: COLORS.TEXT_LIGHT,
  },
  walletBalance: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.PRIMARY,
  },
})
