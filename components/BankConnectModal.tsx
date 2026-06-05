/**
 * Bank Connection Modal - Brick.co Integration
 * Allows users to select and connect their bank accounts
 */

import React, { useState, useEffect } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { getBankList, getBrickAuthUrl } from '../lib/brick'
import type { BrickBank } from '../types'

interface Props {
  visible: boolean
  onClose: () => void
  onBankSelected: (bankCode: string, bankName: string) => void
  userId: string
}

export default function BankConnectModal({
  visible,
  onClose,
  onBankSelected,
  userId,
}: Props) {
  const [banks, setBanks] = useState<BrickBank[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    loadBanks()
  }, [])

  async function loadBanks() {
    try {
      setLoading(true)
      const bankList = await getBankList()
      setBanks(bankList)
    } catch (error) {
      console.error('Error loading banks:', error)
      Alert.alert('Error', 'Gagal memuat daftar bank')
    } finally {
      setLoading(false)
    }
  }

  const filteredBanks = banks.filter((bank) => {
    const matchesSearch = bank.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
    const matchesFilter = showAll || bank.is_popular
    return matchesSearch && matchesFilter
  })

  const handleBankSelect = (bank: BrickBank) => {
    Alert.alert(
      'Connect Bank',
      `Hubungkan akun ${bank.name}?\n\nAnda akan diarahkan ke halaman login bank untuk memberikan akses.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Hubungkan',
          onPress: () => {
            onBankSelected(bank.code, bank.name)
            onClose()
          },
        },
      ]
    )
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View
          style={{
            flex: 1,
            marginTop: 80,
            backgroundColor: '#0F0F0F',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <Text style={{ fontSize: 24, fontWeight: '700', color: 'white' }}>
              Pilih Bank
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ fontSize: 32, color: '#666' }}>×</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Cari bank..."
            placeholderTextColor="#666"
            style={{
              backgroundColor: '#1A1A1A',
              borderRadius: 12,
              padding: 16,
              color: 'white',
              marginBottom: 16,
              fontSize: 16,
            }}
          />

          {/* Filter Toggle */}
          <TouchableOpacity
            onPress={() => setShowAll(!showAll)}
            style={{
              alignSelf: 'flex-start',
              marginBottom: 16,
              paddingVertical: 8,
              paddingHorizontal: 12,
              backgroundColor: showAll ? '#185FA5' : '#1A1A1A',
              borderRadius: 8,
            }}
          >
            <Text style={{ color: 'white', fontSize: 14 }}>
              {showAll ? '🔍 Semua Bank' : '⭐ Bank Populer'}
            </Text>
          </TouchableOpacity>

          {/* Bank List */}
          {loading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#185FA5" />
              <Text style={{ color: '#666', marginTop: 12 }}>
                Memuat daftar bank...
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              {filteredBanks.length === 0 ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Text style={{ color: '#666', textAlign: 'center' }}>
                    {searchQuery
                      ? 'Tidak ada bank yang cocok dengan pencarian'
                      : 'Tidak ada bank tersedia'}
                  </Text>
                </View>
              ) : (
                filteredBanks.map((bank) => (
                  <TouchableOpacity
                    key={bank.id}
                    onPress={() => handleBankSelect(bank)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#1A1A1A',
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 12,
                    }}
                  >
                    {/* Bank Icon/Logo */}
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: '#185FA5',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 16,
                      }}
                    >
                      <Text style={{ fontSize: 20 }}>🏦</Text>
                    </View>

                    {/* Bank Name */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
                        {bank.name}
                      </Text>
                      {bank.is_popular && (
                        <Text style={{ color: '#1D9E75', fontSize: 12, marginTop: 4 }}>
                          ⭐ Populer
                        </Text>
                      )}
                    </View>

                    {/* Arrow */}
                    <Text style={{ color: '#666', fontSize: 18 }}>›</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}

          {/* Security Note */}
          <View
            style={{
              backgroundColor: '#1A1A1A',
              borderRadius: 12,
              padding: 16,
              marginTop: 12,
            }}
          >
            <Text style={{ color: '#1D9E75', fontSize: 14, fontWeight: '600' }}>
              🔒 Aman & Terpercaya
            </Text>
            <Text style={{ color: '#666', fontSize: 12, marginTop: 8 }}>
              Powered by Brick.co - Bank-grade security, OJK compliant. Zena tidak
              pernah menyimpan password bank Anda.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  )
}
