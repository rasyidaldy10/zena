export type Persona = 'bestie' | 'advisor' | 'kakak' | 'adek' | 'pacar' | 'stoic'
export type Language = 'id' | 'en' | 'my' | 'zh'
export type BudgetMethod = '503020' | '703010' | 'zero' | 'envelope' | 'payfirst' | 'custom'
export type TransactionType = 'income' | 'expense' | 'transfer'
export type TransactionSource = 'manual' | 'receipt_scan' | 'email' | 'voice'
export type Mood = 'happy' | 'neutral' | 'stressed' | 'bored' | 'excited'
export type WalletType =
  | 'personal' | 'business' | 'shared'
  | 'rekening_utama' | 'dana_darurat' | 'ewallet'
  | 'dompet_transit' | 'tabungan' | 'investasi'

export const WALLET_TYPE_CONFIG: Record<string, { label: string; icon: string; desc: string }> = {
  rekening_utama: { label: 'Rekening Utama', icon: '🏦', desc: 'Rekening bank utama sehari-hari' },
  dana_darurat:   { label: 'Dana Darurat',   icon: '🛡️', desc: 'Simpanan untuk kondisi darurat' },
  ewallet:        { label: 'E-Wallet',        icon: '📱', desc: 'Dompet digital (GoPay, OVO, Dana)' },
  dompet_transit: { label: 'Dompet Transit',  icon: '💸', desc: 'Uang tunai keperluan harian' },
  tabungan:       { label: 'Tabungan',        icon: '🐷', desc: 'Rekening tabungan tujuan tertentu' },
  investasi:      { label: 'Investasi',       icon: '📈', desc: 'Saham, reksa dana, dll' },
}
export type TierName = 'Starter' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Sovereign'

export interface UserPreferences {
  id: string
  user_id: string
  persona: Persona
  language: Language
  budget_method: BudgetMethod
  monthly_income: number
  nickname: string
  avatar_url?: string
  has_seen_ceo_welcome?: boolean
  created_at: string
  updated_at: string
}

export interface UserWallet {
  id: string
  user_id: string
  wallet_name: string
  wallet_type: WalletType
  current_balance: number
  bank_name?: string
  last_4_digits?: string
  color: string
  icon: string
  is_active: boolean
  created_at: string
}

export interface InvestmentHolding {
  id: string
  wallet_id: string
  user_id: string
  ticker: string
  quantity: number
  buy_price: number
  current_price?: number
  last_updated?: string
  created_at: string
}

export interface StockPrice {
  ticker: string
  price: number
  change_percent?: number
  last_updated: string
  source: string
}

export interface Transaction {
  id: string
  user_id: string
  amount: number
  type: TransactionType
  category: string
  wallet_source: string
  wallet_id: string
  is_wallet_transfer: boolean
  parent_transaction_id: string | null
  transaction_chain: string
  source: TransactionSource
  is_categorized: boolean
  note: string
  receipt_url: string | null
  mood: Mood | null
  date: string
  created_at: string
}

export interface Budget {
  id: string
  user_id: string
  category: string
  limit_amount: number
  month: string
  wallet_type: WalletType
  created_at: string
}

export interface Reminder {
  id: string
  user_id: string
  title: string
  amount: number
  due_date: string
  is_recurring: boolean
  recur_interval: string
  is_paid: boolean
  created_at: string
}

export interface FinancialScore {
  total: number
  consistency: number
  budget_adherence: number
  saving_rate: number
  goal_completion: number
  tier: TierName
}

// Kategori untuk EXPENSE (Pengeluaran)
export const EXPENSE_CATEGORIES = [
  'Makan & Minum',
  'Transport',
  'Belanja',
  'Tagihan',
  'Hiburan',
  'Kesehatan',
  'Pendidikan',
  'Biaya Admin & Fee',
  'Lainnya',
]

// Kategori untuk INCOME (Pemasukan)
export const INCOME_CATEGORIES = [
  'Gaji',
  'Bonus',
  'Freelance',
  'Bisnis',
  'Investasi',
  'Hadiah',
  'Cashback',
  'Lainnya',
]

// Legacy export (deprecated, use EXPENSE_CATEGORIES or INCOME_CATEGORIES)
export const CATEGORIES = EXPENSE_CATEGORIES

export type NotificationType = 'budget_alert' | 'anomaly' | 'weekly_insight' | 'daily_summary' | 'gmail' | 'categorization'

export interface ZenaNotification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  is_read: boolean
  metadata: Record<string, unknown>
  created_at: string
}

export interface AIInsight {
  id: string
  user_id: string
  insight_text: string
  week_start: string
  created_at: string
}

export interface AgentLog {
  id: string
  agent_name: string
  user_id: string | null
  action: string
  result: string | null
  created_at: string
}

export const TIER_CONFIG: Record<TierName, { min: number; max: number; color: string; icon: string }> = {
  Starter:   { min: 0,  max: 24,  color: '#B4B2A9', icon: '💸' },
  Bronze:    { min: 25, max: 44,  color: '#EF9F27', icon: '🟡' },
  Silver:    { min: 45, max: 64,  color: '#85B7EB', icon: '⚪' },
  Gold:      { min: 65, max: 79,  color: '#9FE1CB', icon: '🟢' },
  Platinum:  { min: 80, max: 94,  color: '#AFA9EC', icon: '💠' },
  Sovereign: { min: 95, max: 100, color: '#F0997B', icon: '👑' },
}