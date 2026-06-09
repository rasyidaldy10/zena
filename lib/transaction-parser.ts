// Transaction Parser - Extract transaction data from natural language
// Supports both Personal and Business transactions

import { TransactionType } from '../types'

export interface ParsedPersonalTransaction {
  type: 'personal'
  transaction_type: TransactionType
  amount: number
  description: string
  category?: string
  confidence: number
}

export interface ParsedBusinessTransaction {
  type: 'business'
  business_category: string
  amount: number
  description: string
  product_name?: string
  quantity?: number
  ppn_type?: 'masukan' | 'keluaran'
  confidence: number
}

export type ParsedTransaction = ParsedPersonalTransaction | ParsedBusinessTransaction

// Keywords mapping
const INCOME_KEYWORDS = ['gaji', 'terima', 'masuk', 'dapat', 'bonus', 'komisi', 'bayaran', 'honor', 'pendapatan']
const EXPENSE_KEYWORDS = ['beli', 'bayar', 'buat', 'untuk', 'makan', 'belanja', 'isi', 'top up', 'transfer', 'kirim', 'habis']

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  makanan: ['makan', 'minum', 'kopi', 'nasi', 'ayam', 'soto', 'bakso', 'cafe', 'resto', 'warung', 'lunch', 'dinner', 'breakfast'],
  transport: ['bensin', 'grab', 'gojek', 'parkir', 'tol', 'ojol', 'motor', 'mobil', 'taxi', 'uber'],
  belanja: ['beli', 'belanja', 'supermarket', 'alfamart', 'indomaret', 'tokopedia', 'shopee', 'lazada'],
  hiburan: ['nonton', 'film', 'bioskop', 'game', 'steam', 'netflix', 'spotify', 'youtube'],
  kesehatan: ['dokter', 'obat', 'rumah sakit', 'klinik', 'apotek', 'vitamin'],
  pendidikan: ['buku', 'kursus', 'les', 'sekolah', 'kuliah', 'udemy', 'course'],
  tagihan: ['listrik', 'air', 'internet', 'wifi', 'telepon', 'pln', 'pulsa', 'token'],
}

const BUSINESS_KEYWORDS: Record<string, string[]> = {
  penjualan: ['jual', 'penjualan', 'terjual', 'order', 'pesanan'],
  pembelian_alat: ['beli alat', 'pembelian', 'beli mesin', 'beli peralatan'],
  operasional: ['sewa', 'listrik', 'air', 'internet', 'operasional'],
  gaji: ['gaji', 'salary', 'upah', 'karyawan'],
  iklan: ['iklan', 'ads', 'marketing', 'promosi', 'fb ads', 'google ads'],
}

// Extract amount from text
function extractAmount(text: string): number | null {
  // Remove dots and commas, find numbers
  const patterns = [
    /(\d+)[.,]?(\d{3})[.,]?(\d{3})/g, // 1.000.000 or 1,000,000
    /(\d+)[.,]?(\d{3})/g,              // 50.000 or 50,000
    /(\d+)k/gi,                        // 50k
    /(\d+)rb/gi,                       // 50rb
    /(\d+)jt/gi,                       // 5jt
    /(\d+)/g,                          // plain number
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const numStr = match[0].toLowerCase()
      if (numStr.includes('k') || numStr.includes('rb')) {
        return parseFloat(numStr.replace(/[k,rb]/gi, '')) * 1000
      }
      if (numStr.includes('jt')) {
        return parseFloat(numStr.replace(/jt/gi, '')) * 1000000
      }
      return parseFloat(numStr.replace(/[.,]/g, ''))
    }
  }
  return null
}

// Detect category from keywords
function detectCategory(text: string): string {
  const lower = text.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return category
    }
  }
  return 'lainnya'
}

// Detect business category
function detectBusinessCategory(text: string): string | null {
  const lower = text.toLowerCase()
  for (const [category, keywords] of Object.entries(BUSINESS_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return category
    }
  }
  return null
}

// Detect transaction type (income/expense)
function detectTransactionType(text: string): TransactionType {
  const lower = text.toLowerCase()

  // Check income keywords
  if (INCOME_KEYWORDS.some(kw => lower.includes(kw))) {
    return 'income'
  }

  // Default to expense
  return 'expense'
}

// Extract product info for business transactions
function extractProductInfo(text: string): { name?: string; quantity?: number } {
  const qtyPattern = /(\d+)\s*(pcs|pc|box|unit|buah)/i
  const qtyMatch = text.match(qtyPattern)

  if (qtyMatch) {
    return {
      quantity: parseInt(qtyMatch[1]),
      name: text.replace(qtyPattern, '').trim()
    }
  }

  return {}
}

/**
 * Parse natural language text into transaction data
 * Examples:
 * - "Makan siang 50rb" → expense, makanan, 50000
 * - "Gaji masuk 10jt" → income, gaji, 10000000
 * - "Jual 5 pcs Produk A 500rb" → business, penjualan, 500000
 */
export function parseTransactionText(text: string, mode: 'personal' | 'business' = 'personal'): ParsedTransaction | null {
  const amount = extractAmount(text)
  if (!amount) return null

  // Check if this is business transaction
  const businessCategory = detectBusinessCategory(text)

  if (mode === 'business' || businessCategory) {
    const productInfo = extractProductInfo(text)

    return {
      type: 'business',
      business_category: businessCategory || 'lainnya',
      amount,
      description: text,
      product_name: productInfo.name,
      quantity: productInfo.quantity,
      ppn_type: businessCategory === 'penjualan' ? 'keluaran' : 'masukan',
      confidence: businessCategory ? 0.8 : 0.5,
    }
  }

  // Personal transaction
  const transactionType = detectTransactionType(text)
  const category = detectCategory(text)

  return {
    type: 'personal',
    transaction_type: transactionType,
    amount,
    description: text,
    category,
    confidence: 0.7,
  }
}

/**
 * Format parsed transaction for display
 */
export function formatParsedTransaction(parsed: ParsedTransaction): string {
  if (parsed.type === 'business') {
    let str = `💼 Bisnis - ${parsed.business_category}\n`
    str += `💰 Rp ${parsed.amount.toLocaleString('id-ID')}\n`
    if (parsed.product_name) str += `📦 ${parsed.product_name}\n`
    if (parsed.quantity) str += `🔢 ${parsed.quantity} pcs\n`
    str += `📝 ${parsed.description}`
    return str
  }

  const icon = parsed.transaction_type === 'income' ? '💵' : '💸'
  let str = `${icon} ${parsed.transaction_type === 'income' ? 'Pemasukan' : 'Pengeluaran'}\n`
  str += `💰 Rp ${parsed.amount.toLocaleString('id-ID')}\n`
  str += `🏷️ ${parsed.category}\n`
  str += `📝 ${parsed.description}`
  return str
}
