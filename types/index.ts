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

export type WalletFunction =
  | 'rekening_utama' | 'dana_darurat' | 'ewallet'
  | 'transit' | 'tabungan' | 'investasi' | 'bisnis'

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
  has_seen_ceo_welcome?: boolean
  business_mode?: boolean
  active_mode?: 'personal' | 'business'
  created_at: string
  updated_at: string
  // Note: avatar_url comes from session.user.user_metadata.picture (Google OAuth)
}

export interface UserWallet {
  id: string
  user_id: string
  wallet_name: string
  wallet_type: WalletType
  wallet_function?: WalletFunction
  current_balance: number
  bank_name?: string
  last_4_digits?: string
  color: string
  icon: string
  is_active: boolean
  created_at: string
}

// StockPrice type moved to stock-data.ts (no longer used here)

export type BusinessCategory =
  | 'penjualan' | 'pembelian_alat' | 'operasional' | 'transport'
  | 'gaji' | 'entertain' | 'iklan' | 'lainnya'

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
  project_id?: string | null
  business_category?: BusinessCategory | null
  has_items?: boolean
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

// Market Data Types
export type AssetType = 'crypto' | 'stock' | 'index'

export interface MarketPrice {
  symbol: string // BTC, ETH, IHSG
  name: string // Bitcoin, Ethereum, IHSG
  price: number
  currency: string // IDR
  change_24h: number // percentage
  change_7d?: number
  market_cap?: number
  volume_24h?: number
  last_updated: string
}

export interface MarketData {
  crypto: MarketPrice[]
  indices: MarketPrice[]
  last_updated: string
  cache_ttl: number // seconds
}

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

// Brick.co Bank Connection Types
export type BankConnectionStatus = 'pending' | 'active' | 'expired' | 'error'

export interface BrickBank {
  id: number
  name: string
  code: string
  logo_url: string
  is_popular: boolean
}

export interface BrickAccessToken {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
}

export interface BrickBankAccount {
  id: string
  account_number: string
  account_name: string
  balance: number
  currency: string
  type: string // savings, checking, credit
}

export interface BrickTransaction {
  id: string
  account_id: string
  amount: number
  direction: 'in' | 'out'
  description: string
  reference_id: string
  date: string
  category?: string
  merchant_name?: string
}

export interface BankConnection {
  id: string
  user_id: string
  wallet_id: string | null
  bank_id: number
  bank_name: string
  bank_code: string
  account_id: string
  account_number: string
  account_name: string
  access_token: string
  refresh_token?: string
  token_expires_at: string
  status: BankConnectionStatus
  last_sync_at: string | null
  created_at: string
  updated_at: string
}

// Investment Holdings Types
export type InvestmentAssetType = 'stock' | 'crypto' | 'reksadana' | 'obligasi'

export interface InvestmentHolding {
  id: string
  user_id: string
  asset_type: InvestmentAssetType
  symbol: string
  asset_name: string
  quantity: number
  average_buy_price: number
  current_price: number
  total_value: number
  unrealized_gain_loss: number
  unrealized_gain_loss_percent: number
  last_updated_at: string
  created_at: string
}

// ============================================
// BUSINESS MODE TYPES
// ============================================

export type ProjectType = 'alkes' | 'servis' | 'konsultasi' | 'lainnya'
export type ProjectStatus = 'aktif' | 'selesai' | 'pending'
export type ReceivableType = 'piutang' | 'hutang'
export type ReceivableStatus = 'pending' | 'lunas'
export type StockMovementType = 'in' | 'out' | 'adjustment'

export interface Project {
  id: string
  user_id: string
  name: string
  client_name?: string
  type: ProjectType
  contract_value: number
  status: ProjectStatus
  created_at: string
  // Computed fields (from helper function)
  total_paid?: number
  total_expense?: number
  estimated_profit?: number
  margin_pct?: number
}

export interface ProjectTerm {
  id: string
  project_id: string
  label: string
  amount: number
  condition_text?: string
  paid_at?: string | null
  wallet_id?: string | null
  created_at?: string
}

export interface Receivable {
  id: string
  user_id: string
  project_id?: string | null
  type: ReceivableType
  party_name: string
  amount: number
  description?: string
  due_date?: string | null
  status: ReceivableStatus
  settled_at?: string | null
  created_at: string
}

export interface Product {
  id: string
  user_id: string
  name: string
  category?: string
  unit: string
  buy_price: number
  sell_price: number
  stock_qty: number
  stock_min_alert: number
  is_active: boolean
  created_at: string
}

export interface StockMovement {
  id: string
  user_id: string
  product_id: string
  project_id?: string | null
  transaction_id?: string | null
  type: StockMovementType
  qty: number
  price_per_unit: number
  note?: string
  created_at: string
}

export interface TransactionItem {
  id: string
  transaction_id: string
  product_id: string
  product?: Product
  qty: number
  price_per_unit: number
  subtotal: number
  created_at?: string
}