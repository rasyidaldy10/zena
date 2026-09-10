import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'

// ============================================================
// KURS VALAS — sumber: BCA e-Rate (fallback kurs pasar Yahoo)
//
// Aturan main yang dipakai konsisten di seluruh app:
//   - BELI valas       -> kurs JUAL bank (sell). Itu yang kita bayar.
//   - NILAI SALDO & P/L -> kurs BELI bank (buy). Itu yang kita terima kalau cair.
// Selisih keduanya = spread bank. Jadi wajar kalau tepat setelah beli,
// posisi terlihat minus sebesar spread — itu memang kondisi riilnya.
// ============================================================

export const BASE_CURRENCY = 'IDR'

export interface CurrencyMeta {
  code: string
  symbol: string
  name: string
  decimals: number
  flag: string
}

export const CURRENCIES: Record<string, CurrencyMeta> = {
  IDR: { code: 'IDR', symbol: 'Rp', name: 'Rupiah', decimals: 0, flag: '🇮🇩' },
  USD: { code: 'USD', symbol: '$', name: 'Dolar Amerika', decimals: 2, flag: '🇺🇸' },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Dolar Singapura', decimals: 2, flag: '🇸🇬' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2, flag: '🇪🇺' },
}

/** Mata uang asing yang bisa dipilih user (IDR bukan "valas"). */
export const FOREIGN_CURRENCIES = Object.values(CURRENCIES).filter((c) => c.code !== BASE_CURRENCY)

export const isForeign = (currency?: string | null): boolean =>
  !!currency && currency !== BASE_CURRENCY

export const currencyMeta = (code?: string | null): CurrencyMeta =>
  CURRENCIES[(code || BASE_CURRENCY).toUpperCase()] ?? {
    code: (code || BASE_CURRENCY).toUpperCase(),
    symbol: (code || BASE_CURRENCY).toUpperCase(),
    name: (code || BASE_CURRENCY).toUpperCase(),
    decimals: 2,
    flag: '🏳️',
  }

export interface FxRate {
  currency: string
  buy: number          // bank beli dari kita -> nilai saldo kita
  sell: number         // bank jual ke kita   -> harga saat kita beli valas
  rate_date: string
  source: 'bca' | 'yahoo'
  source_time: string | null
  prev_buy: number | null
  prev_sell: number | null
  prev_date: string | null
}

export type FxRateMap = Record<string, FxRate>

const CACHE_KEY = 'zena-fx-rates'
// BCA meng-update halaman kursnya beberapa kali sehari (terpantau: 04.00 lalu
// 16.20 WIB pada hari yang sama), bukan cuma sekali di pagi hari. Cache pendek
// ini menahan agar tidak menghajar BCA di setiap render, sambil tetap terasa
// live setiap kali user benar-benar membuka layar dompet.
const CACHE_TTL_MS = 5 * 60 * 1000

interface FxCache {
  savedAt: number
  rates: FxRateMap
}

function toMap(rows: FxRate[]): FxRateMap {
  const map: FxRateMap = {}
  for (const r of rows) if (r?.currency) map[r.currency.toUpperCase()] = r
  return map
}

/**
 * Ambil kurs terbaru — LIVE dari BCA setiap kali cache lokal habis, bukan
 * hanya sekali sehari. BCA meng-update halaman kursnya beberapa kali sehari
 * (bukan cuma jam 04.00), jadi mengandalkan snapshot DB yang sudah ada untuk
 * "hari ini" akan menampilkan angka basi sepanjang hari. Tabel snapshot
 * (`fx_rates_daily`, diisi live call ini ATAU cron harian) tetap dipakai
 * sebagai (a) fallback kalau BCA/edge function sedang gagal, dan (b) sumber
 * "kurs kemarin" untuk hitung gerak harian.
 */
export async function getRates(currencies: string[] = ['USD', 'SGD', 'EUR']): Promise<FxRateMap> {
  const wanted = currencies.map((c) => c.toUpperCase()).filter((c) => c !== BASE_CURRENCY)
  if (wanted.length === 0) return {}

  // 1. cache lokal (menahan panggilan berulang saat pindah-pindah layar)
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY)
    if (raw) {
      const cached = JSON.parse(raw) as FxCache
      const fresh = Date.now() - cached.savedAt < CACHE_TTL_MS
      const complete = wanted.every((c) => cached.rates?.[c])
      if (fresh && complete) return cached.rates
    }
  } catch { /* cache rusak -> ambil ulang */ }

  // 2. LIVE: scrape BCA langsung
  let rates: FxRateMap = {}
  try {
    const { data } = await supabase.functions.invoke('fx-rate', { body: { currencies: wanted } })
    if (data?.rates?.length) rates = toMap(data.rates as FxRate[])
  } catch { /* BCA/edge function bermasalah -> jatuh ke snapshot DB di bawah */ }

  // 3. fallback: kalau live gagal atau ada mata uang yang belum lengkap,
  //    pakai snapshot DB terakhir (lebih baik angka agak basi daripada kosong)
  const missing = wanted.filter((c) => !rates[c])
  if (missing.length > 0) {
    try {
      const { data } = await supabase
        .from('fx_rates_latest')
        .select('*')
        .eq('rate_type', 'erate')
        .in('currency', missing)
      if (data) rates = { ...rates, ...toMap(data as FxRate[]) }
    } catch { /* tidak ada apa-apa lagi yang bisa dicoba */ }
  }

  if (Object.keys(rates).length > 0) {
    try {
      // GABUNG dengan isi cache lama, jangan ditimpa. Tiap layar meminta mata
      // uang yang berbeda (Home cuma yang dipakai dompet, form transaksi minta
      // ketiganya). Kalau ditimpa, cache dari layar sempit membuat layar lain
      // selalu dianggap "tidak lengkap" lalu menembak BCA lagi — jendela ~2
      // detik itu yang memunculkan "Kurs Belum Ada" kalau user cepat menyimpan.
      const raw = await AsyncStorage.getItem(CACHE_KEY)
      const prev = raw ? (JSON.parse(raw) as FxCache).rates : {}
      const merged: FxRateMap = { ...prev, ...rates }
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ savedAt: Date.now(), rates: merged } as FxCache)
      )
    } catch { /* cache opsional */ }
  }
  return rates
}

export async function clearRateCache(): Promise<void> {
  try { await AsyncStorage.removeItem(CACHE_KEY) } catch { /* abaikan */ }
}

// ---------- konversi ----------

/** Nilai rupiah dari saldo valas, memakai kurs BELI bank (yang kita terima kalau cair). */
export function toIDR(amount: number, currency: string, rates: FxRateMap): number | null {
  if (!isForeign(currency)) return amount
  const rate = rates[currency.toUpperCase()]
  if (!rate?.buy) return null
  return amount * rate.buy
}

/** Harga rupiah untuk MEMBELI sejumlah valas, memakai kurs JUAL bank. */
export function costToBuyIDR(amount: number, currency: string, rates: FxRateMap): number | null {
  if (!isForeign(currency)) return amount
  const rate = rates[currency.toUpperCase()]
  if (!rate?.sell) return null
  return amount * rate.sell
}

export interface Movement {
  amountIDR: number
  percent: number
  direction: 'up' | 'down' | 'flat'
}

function movement(nowValue: number, refValue: number): Movement {
  const diff = nowValue - refValue
  const percent = refValue > 0 ? (diff / refValue) * 100 : 0
  return {
    amountIDR: diff,
    percent,
    // pembulatan rupiah: selisih < 1 perak dianggap datar
    direction: Math.abs(diff) < 1 ? 'flat' : diff > 0 ? 'up' : 'down',
  }
}

/**
 * Gerak nilai rupiah saldo sejak snapshot kurs sebelumnya.
 * null kalau belum ada data hari sebelumnya (hari pertama fitur nyala,
 * atau libur/akhir pekan saat BCA belum merilis kurs baru).
 */
export function dailyMovement(balance: number, currency: string, rates: FxRateMap): Movement | null {
  if (!isForeign(currency) || balance === 0) return null
  const rate = rates[currency.toUpperCase()]
  if (!rate?.buy || !rate.prev_buy) return null
  return movement(balance * rate.buy, balance * rate.prev_buy)
}

/**
 * Untung/rugi belum terealisasi: nilai saldo sekarang (kurs beli bank)
 * dibanding modal perolehan (kurs rata-rata saat kita beli).
 */
export function unrealizedPL(
  balance: number,
  currency: string,
  avgBuyRate: number | null | undefined,
  rates: FxRateMap
): Movement | null {
  if (!isForeign(currency) || !avgBuyRate || avgBuyRate <= 0 || balance === 0) return null
  const rate = rates[currency.toUpperCase()]
  if (!rate?.buy) return null
  return movement(balance * rate.buy, balance * avgBuyRate)
}

/**
 * Kurs rata-rata tertimbang setelah menambah valas — sama seperti
 * "Tambah Posisi" pada investasi. Saat MENJUAL valas, rata-rata tidak berubah
 * (metode average cost), jadi fungsi ini hanya dipanggil saat saldo bertambah.
 */
export function weightedAvgRate(
  oldBalance: number,
  oldAvgRate: number | null | undefined,
  addAmount: number,
  addRate: number
): number {
  if (addAmount <= 0) return oldAvgRate ?? addRate
  if (!oldAvgRate || oldBalance <= 0) return addRate
  return (oldBalance * oldAvgRate + addAmount * addRate) / (oldBalance + addAmount)
}

/** Spread bank hari ini (selisih kurs jual & beli) dalam persen. */
export function spreadPercent(currency: string, rates: FxRateMap): number | null {
  const rate = rates[currency.toUpperCase()]
  if (!rate?.buy || !rate?.sell) return null
  const mid = (rate.buy + rate.sell) / 2
  return mid > 0 ? ((rate.sell - rate.buy) / mid) * 100 : null
}
