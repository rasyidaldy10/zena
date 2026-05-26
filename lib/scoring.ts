import { Transaction, FinancialScore, TierName, TIER_CONFIG } from '../types'

export const calculateFinancialScore = (
  transactions: Transaction[],
  monthlyIncome: number,
  streakDays: number
): FinancialScore => {

  // 1. Konsistensi catat (35%) — berdasarkan streak
  const consistencyScore = Math.min(100, (streakDays / 30) * 100)

  // 2. Budget adherence (25%) — pengeluaran vs income
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  const budgetScore = monthlyIncome > 0
    ? Math.max(0, 100 - ((totalExpense / monthlyIncome) * 100 - 70))
    : 50

  // 3. Saving rate (25%) — berapa persen yang ditabung
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const savingRate = totalIncome > 0
    ? ((totalIncome - totalExpense) / totalIncome) * 100
    : 0

  const savingScore = Math.min(100, Math.max(0, savingRate * 2))

  // 4. Goal completion (15%) — placeholder, akan diupdate saat ada goals
  const goalScore = 50

  // Total weighted score
  const total = Math.round(
    (consistencyScore * 0.35) +
    (budgetScore * 0.25) +
    (savingScore * 0.25) +
    (goalScore * 0.15)
  )

  // Tentukan tier
  const tier = Object.entries(TIER_CONFIG).find(
    ([_, config]) => total >= config.min && total <= config.max
  )?.[0] as TierName || 'Starter'

  return {
    total,
    consistency: Math.round(consistencyScore),
    budget_adherence: Math.round(budgetScore),
    saving_rate: Math.round(savingScore),
    goal_completion: goalScore,
    tier,
  }
}

export const getNextTier = (currentTier: TierName): TierName | null => {
  const tiers: TierName[] = ['Starter', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Sovereign']
  const currentIndex = tiers.indexOf(currentTier)
  return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null
}

export const getPointsToNextTier = (score: number, currentTier: TierName): number => {
  const nextTier = getNextTier(currentTier)
  if (!nextTier) return 0
  return TIER_CONFIG[nextTier].min - score
}