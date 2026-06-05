/**
 * Stock Market Data Service
 * Real-time Indonesia stock prices (IHSG + individual stocks)
 */

export interface StockPrice {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
}

export interface StockWatchlist {
  userId: string
  tickers: string[] // e.g. ['BBCA', 'BBRI', 'TLKM', 'ASII']
}

// Popular Indonesian stocks (BEI / IDX)
export const POPULAR_STOCKS = [
  { symbol: 'BBCA', name: 'Bank BCA', sector: 'Finansial' },
  { symbol: 'BBRI', name: 'Bank BRI', sector: 'Finansial' },
  { symbol: 'BMRI', name: 'Bank Mandiri', sector: 'Finansial' },
  { symbol: 'BBNI', name: 'Bank BNI', sector: 'Finansial' },
  { symbol: 'TLKM', name: 'Telkom Indonesia', sector: 'Telekomunikasi' },
  { symbol: 'ASII', name: 'Astra International', sector: 'Otomotif' },
  { symbol: 'UNVR', name: 'Unilever Indonesia', sector: 'Konsumer' },
  { symbol: 'ICBP', name: 'Indofood CBP', sector: 'Konsumer' },
  { symbol: 'GGRM', name: 'Gudang Garam', sector: 'Konsumer' },
  { symbol: 'INDF', name: 'Indofood Sukses', sector: 'Konsumer' },
  { symbol: 'ADRO', name: 'Adaro Energy', sector: 'Energi' },
  { symbol: 'ANTM', name: 'Aneka Tambang', sector: 'Pertambangan' },
  { symbol: 'INCO', name: 'Vale Indonesia', sector: 'Pertambangan' },
  { symbol: 'PTBA', name: 'Bukit Asam', sector: 'Pertambangan' },
  { symbol: 'GOTO', name: 'GoTo Gojek Tokopedia', sector: 'Teknologi' },
  { symbol: 'BUKA', name: 'Bukalapak', sector: 'Teknologi' },
]

// Default watchlist (most popular)
export const DEFAULT_WATCHLIST = ['BBCA', 'BBRI', 'TLKM', 'ASII', 'GOTO']

// In-memory cache (5 min TTL)
let stockCache: { data: StockPrice[]; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get IHSG index (Indonesia Stock Exchange Composite Index)
 */
export async function getIHSGIndex(): Promise<{ index: number; change: number; changePercent: number }> {
  try {
    // TODO: Integrate with real API (e.g., Yahoo Finance, IDX API)
    // For now, return mock data

    // Mock: IHSG around 7200-7400
    const baseIndex = 7234.56
    const randomChange = (Math.random() - 0.5) * 100
    const index = baseIndex + randomChange
    const change = randomChange
    const changePercent = (change / baseIndex) * 100

    return {
      index: Math.round(index * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
    }
  } catch (error) {
    console.error('Error fetching IHSG:', error)
    return { index: 7234, change: 0, changePercent: 0 }
  }
}

/**
 * Get stock prices for given tickers
 */
export async function getStockPrices(tickers: string[]): Promise<StockPrice[]> {
  try {
    // Check cache first
    if (stockCache && Date.now() - stockCache.timestamp < CACHE_TTL) {
      return stockCache.data.filter(stock => tickers.includes(stock.symbol))
    }

    // TODO: Integrate with real API (Yahoo Finance, IDX API, or RapidAPI)
    // For now, generate mock data with realistic values

    const mockPrices: StockPrice[] = tickers.map(ticker => {
      const stockInfo = POPULAR_STOCKS.find(s => s.symbol === ticker)

      // Realistic price ranges for each stock
      const priceMap: Record<string, number> = {
        'BBCA': 9800 + Math.random() * 500,
        'BBRI': 5100 + Math.random() * 200,
        'BMRI': 6200 + Math.random() * 300,
        'BBNI': 5400 + Math.random() * 200,
        'TLKM': 3800 + Math.random() * 200,
        'ASII': 5600 + Math.random() * 300,
        'UNVR': 2500 + Math.random() * 100,
        'ICBP': 10200 + Math.random() * 500,
        'GGRM': 22000 + Math.random() * 1000,
        'INDF': 6800 + Math.random() * 300,
        'ADRO': 3200 + Math.random() * 200,
        'ANTM': 1800 + Math.random() * 100,
        'INCO': 4500 + Math.random() * 300,
        'PTBA': 2900 + Math.random() * 200,
        'GOTO': 62 + Math.random() * 10,
        'BUKA': 85 + Math.random() * 15,
      }

      const basePrice = priceMap[ticker] || 1000 + Math.random() * 5000
      const changePercent = (Math.random() - 0.5) * 10 // -5% to +5%
      const change = basePrice * (changePercent / 100)
      const price = basePrice + change

      return {
        symbol: ticker,
        name: stockInfo?.name || ticker,
        price: Math.round(price),
        change: Math.round(change),
        changePercent: Math.round(changePercent * 100) / 100,
        volume: Math.floor(Math.random() * 1000000000), // Mock volume
      }
    })

    // Update cache
    stockCache = {
      data: mockPrices,
      timestamp: Date.now(),
    }

    return mockPrices
  } catch (error) {
    console.error('Error fetching stock prices:', error)
    return []
  }
}

/**
 * Clear cache (force refresh)
 */
export function clearStockCache() {
  stockCache = null
}

/**
 * Format large numbers (e.g., 1.2B, 450M)
 */
export function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) {
    return `${(volume / 1_000_000_000).toFixed(1)}B`
  }
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(1)}M`
  }
  if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(1)}K`
  }
  return volume.toString()
}
