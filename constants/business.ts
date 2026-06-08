// Business Mode Constants
// Categories, types, and configurations for business features

import { BusinessCategory, ProjectType, WalletFunction } from '../types'

export const BUSINESS_CATEGORIES: Array<{
  value: BusinessCategory
  label: string
  icon: string
}> = [
  { value: 'penjualan', label: 'Penjualan Produk', icon: '🛒' },
  { value: 'pembelian_alat', label: 'Pembelian Alat', icon: '📦' },
  { value: 'operasional', label: 'Operasional', icon: '⚙️' },
  { value: 'transport', label: 'Transport', icon: '🚗' },
  { value: 'gaji', label: 'Gaji Karyawan', icon: '👤' },
  { value: 'entertain', label: 'Entertain Klien', icon: '🍽️' },
  { value: 'iklan', label: 'Iklan/Marketing', icon: '📣' },
  { value: 'lainnya', label: 'Lainnya', icon: '📌' },
]

export const PROJECT_TYPES: Array<{
  value: ProjectType
  label: string
  icon: string
}> = [
  { value: 'alkes', label: 'Alat Kesehatan', icon: '🏥' },
  { value: 'servis', label: 'Servis/Maintenance', icon: '🔧' },
  { value: 'konsultasi', label: 'Konsultasi', icon: '💼' },
  { value: 'lainnya', label: 'Lainnya', icon: '📋' },
]

export const WALLET_FUNCTIONS: Array<{
  value: WalletFunction
  label: string
  icon: string
  desc: string
}> = [
  {
    value: 'rekening_utama',
    label: 'Rekening Utama',
    icon: '🏦',
    desc: 'Rekening bank utama sehari-hari',
  },
  {
    value: 'dana_darurat',
    label: 'Dana Darurat',
    icon: '🛡️',
    desc: 'Simpanan untuk kondisi darurat',
  },
  {
    value: 'ewallet',
    label: 'E-Wallet',
    icon: '💳',
    desc: 'Dompet digital (GoPay, OVO, Dana)',
  },
  {
    value: 'transit',
    label: 'Dompet Transit',
    icon: '🔄',
    desc: 'Uang tunai keperluan harian',
  },
  {
    value: 'tabungan',
    label: 'Tabungan',
    icon: '🌱',
    desc: 'Rekening tabungan tujuan tertentu',
  },
  {
    value: 'investasi',
    label: 'Investasi',
    icon: '📈',
    desc: 'Saham, reksa dana, dll',
  },
  {
    value: 'bisnis',
    label: 'Bisnis',
    icon: '💼',
    desc: 'Rekening khusus bisnis',
  },
]

export const PRODUCT_UNITS = [
  { value: 'pcs', label: 'Pcs (Pieces)' },
  { value: 'box', label: 'Box' },
  { value: 'set', label: 'Set' },
  { value: 'unit', label: 'Unit' },
  { value: 'kg', label: 'Kg (Kilogram)' },
  { value: 'liter', label: 'Liter' },
  { value: 'meter', label: 'Meter' },
  { value: 'lusin', label: 'Lusin' },
  { value: 'pack', label: 'Pack' },
]

// Helper functions
export function getBusinessCategoryLabel(category: BusinessCategory): string {
  return BUSINESS_CATEGORIES.find(c => c.value === category)?.label || category
}

export function getBusinessCategoryIcon(category: BusinessCategory): string {
  return BUSINESS_CATEGORIES.find(c => c.value === category)?.icon || '📌'
}

export function getProjectTypeLabel(type: ProjectType): string {
  return PROJECT_TYPES.find(t => t.value === type)?.label || type
}

export function getProjectTypeIcon(type: ProjectType): string {
  return PROJECT_TYPES.find(t => t.value === type)?.icon || '📋'
}
