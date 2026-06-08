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
