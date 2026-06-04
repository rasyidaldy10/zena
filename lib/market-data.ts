import { MarketPrice, MarketData } from '../types'

const COINGECKO_API = 'https://api.coingecko.com/api/v3'
const CACHE_TTL = 300 // 5 minutes

// In-memory cache
let cachedData: MarketData | null = null
let cacheTimestamp = 0

/**
 * Fetch crypto prices from CoinGecko
 * Free tier: 10-50 calls/minute
 */
async function fetchCryptoPrices(): Promise<MarketPrice[]> {
  try {
    // Top 5 crypto by market cap
    const ids = 'bitcoin,ethereum,binancecoin,solana,cardano'
    const response = await fetch(
      `${COINGECKO_API}/simple/price?ids=${ids}&vs_currencies=idr&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
    )

    if (!response.ok) {
      console.error('CoinGecko API error:', response.status)
      return []
    }

    const data = await response.json()

    const mapping: Record<string, { symbol: string; name: string }> = {
      bitcoin: { symbol: 'BTC', name: 'Bitcoin' },
      ethereum: { symbol: 'ETH', name: 'Ethereum' },
      binancecoin: { symbol: 'BNB', name: 'BNB' },
      solana: { symbol: 'SOL', name: 'Solana' },
      cardano: { symbol: 'ADA', name: 'Cardano' },
    }

    const prices: MarketPrice[] = []

    for (const [id, info] of Object.entries(mapping)) {
      if (data[id]) {
        prices.push({
          symbol: info.symbol,
          name: info.name,
          price: data[id].idr || 0,
          currency: 'IDR',
          change_24h: data[id].idr_24h_change || 0,
          market_cap: data[id].idr_market_cap,
          volume_24h: data[id].idr_24h_vol,
          last_updated: new Date().toISOString(),
        })
      }
    }

    return prices
  } catch (error) {
    console.error('Error fetching crypto prices:', error)
    return []
  }
}

/**
 * Fetch IHSG (Indonesia Stock Exchange Index)
 * Using Yahoo Finance fallback
 */
async function fetchStockIndices(): Promise<MarketPrice[]> {
  try {
    // Using publicly available IHSG data endpoint
    // Fallback: return mock data if API unavailable

    // TODO: Implement actual IHSG API when available
    // For now, return placeholder

    return [
      {
        symbol: 'IHSG',
        name: 'IDX Composite',
        price: 7234, // Mock value
        currency: 'IDR',
        change_24h: -0.5, // Mock change
        last_updated: new Date().toISOString(),
      },
    ]
  } catch (error) {
    console.error('Error fetching stock indices:', error)
    return []
  }
}

/**
 * Get market data with caching
 * Cache TTL: 5 minutes
 */
export async function getMarketData(): Promise<MarketData> {
  const now = Date.now()

  // Return cached data if still fresh
  if (cachedData && now - cacheTimestamp < CACHE_TTL * 1000) {
    return cachedData
  }

  // Fetch fresh data
  const [crypto, indices] = await Promise.all([
    fetchCryptoPrices(),
    fetchStockIndices(),
  ])

  const data: MarketData = {
    crypto,
    indices,
    last_updated: new Date().toISOString(),
    cache_ttl: CACHE_TTL,
  }

  // Update cache
  cachedData = data
  cacheTimestamp = now

  return data
}

/**
 * Clear cache (for manual refresh)
 */
export function clearMarketCache() {
  cachedData = null
  cacheTimestamp = 0
}

/**
 * Format price with proper Indonesian notation
 */
export function formatMarketPrice(price: number): string {
  if (price >= 1_000_000_000) {
    // Billions
    return `${(price / 1_000_000_000).toFixed(2)}M`
  } else if (price >= 1_000_000) {
    // Millions
    return `${(price / 1_000_000).toFixed(2)}jt`
  } else if (price >= 1_000) {
    // Thousands
    return `${(price / 1_000).toFixed(0)}rb`
  }
  return price.toLocaleString('id-ID')
}

/**
 * Format percentage change
 */
export function formatChange(change: number): { text: string; color: string; icon: string } {
  const isPositive = change >= 0
  return {
    text: `${isPositive ? '+' : ''}${change.toFixed(2)}%`,
    color: isPositive ? '#1D9E75' : '#E74C3C',
    icon: isPositive ? '🟢' : '🔴',
  }
}
