// Gamification: XP, Tier, Badge
import { COLORS } from '../constants/theme'

export type TierKey = 'starter' | 'bronze' | 'silver' | 'gold' | 'platinum'

export const XP_PER = {
  transaction: 10,    // +10 XP per transaksi dicatat
  activeDay: 50,      // +50 XP per hari aktif (streak)
  budgetTarget: 100,  // +100 XP saat capai target budget bulanan
}

export const TIERS: { key: TierKey; label: string; min: number; color: string; icon: string }[] = [
  { key: 'starter',  label: 'Starter',  min: 0,    color: '#8A93A6', icon: 'leaf' },
  { key: 'bronze',   label: 'Bronze',   min: 250,  color: '#CD7F32', icon: 'medal' },
  { key: 'silver',   label: 'Silver',   min: 500,  color: '#9AA7B5', icon: 'medal' },
  { key: 'gold',     label: 'Gold',     min: 1000, color: '#E0A100', icon: 'trophy' },
  { key: 'platinum', label: 'Platinum', min: 2500, color: '#5B8DEF', icon: 'diamond' },
]

export function getTierByXp(xp: number) {
  let current = TIERS[0]
  for (const t of TIERS) if (xp >= t.min) current = t
  return current
}

export function getNextTierByXp(xp: number) {
  return TIERS.find(t => t.min > xp) || null
}

// XP diturunkan dari data yang sudah ada (transaksi + streak + bulan on-budget)
export function computeXp(p: { transactionCount: number; streakDays: number; onBudgetMonths?: number }) {
  return (
    p.transactionCount * XP_PER.transaction +
    p.streakDays * XP_PER.activeDay +
    (p.onBudgetMonths || 0) * XP_PER.budgetTarget
  )
}

export type BadgeKey = 'first_saver' | 'consistent' | 'investor' | 'budget_pro'

export const BADGES: { key: BadgeKey; label: string; icon: string; color: string; desc: string }[] = [
  { key: 'first_saver', label: 'First Saver', icon: 'star',      color: '#E0A100', desc: 'Catat transaksi pertama' },
  { key: 'consistent',  label: 'Consistent',  icon: 'ribbon',    color: '#16A06A', desc: 'Streak 7 hari' },
  { key: 'investor',    label: 'Investor',     icon: 'trending-up', color: '#1763D6', desc: 'Punya investasi' },
  { key: 'budget_pro',  label: 'Budget Pro',  icon: 'water',     color: '#5B8DEF', desc: '3 bulan on-budget' },
]

export function computeBadges(p: {
  transactionCount: number
  streakDays: number
  hasInvestment: boolean
  budgetAdherence: number
}): Record<BadgeKey, boolean> {
  return {
    first_saver: p.transactionCount >= 1,
    consistent: p.streakDays >= 7,
    investor: p.hasInvestment,
    budget_pro: p.budgetAdherence >= 80,
  }
}

// Rank "Top X%" — kalau data user sedikit, pakai estimasi dari score
export function estimateRankPercent(score: number): number {
  // skor tinggi → top kecil. Map 0..100 → 90%..3%
  const top = Math.round(90 - (score / 100) * 87)
  return Math.max(3, Math.min(90, top))
}

export const ACCENT = COLORS.primary
