import { Persona, Language, Transaction, BudgetMethod } from '../types'
import { BUDGET_METHODS } from '../constants'

export const getSystemPrompt = (
  persona: Persona,
  language: Language,
  nickname: string,
  monthlyIncome: number
): string => {
  const name = nickname || 'kamu'
  const income = monthlyIncome.toLocaleString('id-ID')

  // SPEED OPTIMIZATION: Shortened prompts (50% reduction)
  const prompts: Record<Persona, string> = {
    bestie: `Asisten keuangan ${name}, gaya santai lo/gue, emoji OK. Income: Rp ${income}. Jawab singkat 2-3 kalimat, Bahasa Indonesia.`,

    advisor: `Financial advisor ${name}, formal sopan. Income: Rp ${income}. Rekomendasi actionable pakai angka. Bahasa Indonesia.`,

    kakak: `Kak Zena untuk ${name}, hangat empatik, panggil "dek". Income: Rp ${income}. Tunjukkan empati, Bahasa Indonesia.`,

    adek: `Dek Zena untuk ${name}, ceria semangat, panggil "kak". Income: Rp ${income}. Selalu support, Bahasa Indonesia.`,

    pacar: `Pasangan ${name}, manis perhatian, panggil "sayang". Income: Rp ${income}. Caring bukan judging, Bahasa Indonesia.`,

    stoic: `Mentor ${name}, to the point, singkat padat. Income: Rp ${income}. Langsung solusi, Bahasa Indonesia.`,
  }

  return prompts[persona]
}

export const getContextualSystemPrompt = (
  persona: Persona,
  language: Language,
  nickname: string,
  monthlyIncome: number,
  recentTransactions: Transaction[],
  budgetMethod: BudgetMethod
): string => {
  const base = getSystemPrompt(persona, language, nickname, monthlyIncome)

  if (!recentTransactions.length && !monthlyIncome) return base

  const realTxns = recentTransactions.filter(t => !t.is_wallet_transfer)
  const currentMonth = new Date().toISOString().slice(0, 7)
  const thisMonthTxns = realTxns.filter(t => t.date?.startsWith(currentMonth))

  const totalExpense = thisMonthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const totalIncome = thisMonthTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const netBalance = totalIncome - totalExpense

  const categoryTotals = thisMonthTxns
    .filter(t => t.type === 'expense')
    .reduce((acc: Record<string, number>, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount
      return acc
    }, {})

  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, amt]) => `${cat}: Rp ${amt.toLocaleString('id-ID')}`)
    .join(', ')

  // Budget calculation
  let spendingBudget = monthlyIncome
  let savingTarget = 0
  if (budgetMethod === '503020') { spendingBudget = monthlyIncome * 0.8; savingTarget = monthlyIncome * 0.2 }
  else if (budgetMethod === '703010') { spendingBudget = monthlyIncome * 0.9; savingTarget = monthlyIncome * 0.3 }
  else if (budgetMethod === 'payfirst') { spendingBudget = monthlyIncome * 0.75; savingTarget = monthlyIncome * 0.25 }
  else if (budgetMethod === 'zero' || budgetMethod === 'envelope') { spendingBudget = monthlyIncome; savingTarget = 0 }

  const budgetUsedPct = spendingBudget > 0 ? Math.round((totalExpense / spendingBudget) * 100) : 0
  const savingRate = monthlyIncome > 0 ? Math.max(0, Math.round((netBalance / monthlyIncome) * 100)) : 0

  const today = new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const daysPassed = today.getDate()
  const daysLeft = daysInMonth - daysPassed
  const dailyAvgExpense = daysPassed > 0 ? totalExpense / daysPassed : 0
  const projectedExpense = dailyAvgExpense * daysInMonth

  const methodName = BUDGET_METHODS[budgetMethod]?.name || budgetMethod

  // SPEED OPTIMIZATION: Ultra-compact context (60% reduction)
  const context = `
[${currentMonth}] Out: ${totalExpense.toLocaleString('id-ID')} (${budgetUsedPct}%) | Net: ${netBalance.toLocaleString('id-ID')} | Save: ${savingRate}% | Top: ${topCategories || '-'} | D${daysPassed}/${daysInMonth} | Proj: ${Math.round(projectedExpense).toLocaleString('id-ID')}
Jawab berdasarkan data nyata. Highlight anomali.`

  return base + context
}

export const getReceiptPrompt = (): string => `
Kamu adalah asisten ekstrak data struk belanja.
User mengirimkan foto struk. Ekstrak informasi berikut dalam format JSON:
{
  "merchant": "nama toko",
  "amount": 0,
  "date": "YYYY-MM-DD",
  "items": ["item1", "item2"],
  "suggested_category": "kategori"
}
Kategori yang tersedia: Makan & Minum, Transport, Belanja, Tagihan, Hiburan, Kesehatan, Bisnis, Investasi, Tabungan, Biaya Admin & Fee, Lainnya.
Jawab HANYA dengan JSON valid, tanpa teks tambahan, tanpa markdown.
`

export const getCategoryPrompt = (transactions: string): string => `
Kamu adalah asisten kategorisasi transaksi keuangan.
Berikut daftar transaksi yang belum dikategorikan:
${transactions}

Untuk setiap transaksi, tentukan kategori yang paling tepat dari pilihan ini:
Makan & Minum, Transport, Belanja, Tagihan, Hiburan, Kesehatan, Bisnis, Investasi, Tabungan, Biaya Admin & Fee, Lainnya.

Jawab dalam format JSON array:
[{"id": "transaction_id", "category": "kategori", "confidence": 0.9}]
Jawab HANYA dengan JSON valid, tanpa teks tambahan.
`
