// Format utility functions
// Number and currency formatting helpers

/**
 * Format number to Indonesian Rupiah currency format
 * @param amount - Amount to format
 * @returns Formatted currency string (e.g., "Rp 1.500.000")
 */
export function formatRupiah(amount: number): string {
  return 'Rp ' + amount.toLocaleString('id-ID')
}

/**
 * Format an amount in any supported currency.
 * Rupiah stays whole ("Rp 1.500.000"); foreign currencies keep 2 decimals
 * ("$ 1.250,50") because balances there are rarely round numbers.
 * @param amount - Amount to format
 * @param currency - ISO 4217 code, defaults to IDR
 * @returns Formatted currency string (e.g., "S$ 100,00")
 */
export function formatMoney(amount: number, currency: string = 'IDR'): string {
  const code = (currency || 'IDR').toUpperCase()
  if (code === 'IDR') return formatRupiah(Math.round(amount))

  const symbols: Record<string, string> = { USD: '$', SGD: 'S$', EUR: '€' }
  const formatted = amount.toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${symbols[code] ?? code + ' '}${symbols[code] ? ' ' : ''}${formatted}`
}

/**
 * Rupiah value of a transaction, for every report, budget and score.
 *
 * Foreign-currency transactions store the nominal in `amount` (e.g. 50 USD) and
 * the rupiah value locked at transaction time in `amount_idr`. Reading `amount`
 * directly would add 50 to a rupiah total; reading a live conversion would make
 * last month's report drift every time the rate moves. So always read this.
 *
 * @param t - Transaction-like object
 * @returns Locked rupiah value, falling back to `amount` for rupiah rows
 */
export function amountInIDR(t: { amount: number; amount_idr?: number | null }): number {
  return t.amount_idr ?? t.amount
}

/**
 * Parse a user-typed amount into a number, handling both Indonesian and plain
 * notation. This is deliberately shared by every money input: rupiah uses "."
 * as a thousands separator while foreign currencies use it as a decimal point,
 * so a single naive strip of "." silently corrupts one of the two.
 *
 * Rules: a comma always means the decimal point. Otherwise a lone "." followed
 * by exactly 3 digits is read as a thousands separator ("10.000" -> 10000),
 * anything else as a decimal point ("100.50" -> 100.5).
 *
 * @param text - Raw input text
 * @returns Parsed number, or 0 when unparseable
 */
export function parseAmountInput(text: string): number {
  const cleaned = (text ?? '').replace(/[^\d.,-]/g, '')
  if (!cleaned) return 0

  let normalized: string
  if (cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else {
    const dots = cleaned.split('.').length - 1
    if (dots > 1) {
      normalized = cleaned.replace(/\./g, '')
    } else if (dots === 1) {
      const tail = cleaned.split('.')[1]
      normalized = tail.length === 3 ? cleaned.replace('.', '') : cleaned
    } else {
      normalized = cleaned
    }
  }
  const value = parseFloat(normalized)
  return isFinite(value) ? value : 0
}

/**
 * Format a rupiah delta with an explicit sign, for gain/loss labels.
 * @param amount - Signed amount
 * @returns Formatted string (e.g., "+Rp 42.150" / "−Rp 23.916")
 */
export function formatDelta(amount: number): string {
  const rounded = Math.round(amount)
  if (rounded === 0) return 'Rp 0'
  const sign = rounded > 0 ? '+' : '−'
  return sign + 'Rp ' + Math.abs(rounded).toLocaleString('id-ID')
}

/**
 * Format number with Indonesian locale
 * @param num - Number to format
 * @returns Formatted number string with thousand separators
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('id-ID')
}

/**
 * Format percentage
 * @param value - Percentage value (0-100)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string (e.g., "25.5%")
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return value.toFixed(decimals) + '%'
}

/**
 * Format date to Indonesian locale
 * @param date - Date string or Date object
 * @returns Formatted date string (e.g., "5 Jun 2026")
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Format datetime to Indonesian locale
 * @param date - Date string or Date object
 * @returns Formatted datetime string (e.g., "5 Jun 2026, 14:30")
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
