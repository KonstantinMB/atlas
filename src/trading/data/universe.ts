/**
 * Tradeable Universe Definition
 *
 * Defines all assets the paper trading engine can trade.
 * 40 liquid ETFs covering all sectors + major assets + crypto.
 * All have high average daily volume (> 1M shares/day).
 */

export interface UniverseAsset {
  symbol: string;
  name: string;
  sector: string;
  assetClass: 'equity' | 'commodity' | 'fixed-income' | 'crypto' | 'international' | 'thematic' | 'stock' | 'forex';
  avgDailyVolume: number; // Average daily volume (shares)
  beta: number; // Beta vs SPY (1.0 = market, >1.0 = more volatile, <1.0 = less volatile)
  expense: number; // Expense ratio (annual %)
}

/**
 * Full tradeable universe (40 assets)
 */
export const TRADEABLE_UNIVERSE: UniverseAsset[] = [
  // Broad Market Indices (4)
  {
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF Trust',
    sector: 'Broad Market',
    assetClass: 'equity',
    avgDailyVolume: 75_000_000,
    beta: 1.0,
    expense: 0.0945,
  },
  {
    symbol: 'QQQ',
    name: 'Invesco QQQ Trust (Nasdaq 100)',
    sector: 'Technology',
    assetClass: 'equity',
    avgDailyVolume: 45_000_000,
    beta: 1.15,
    expense: 0.20,
  },
  {
    symbol: 'DIA',
    name: 'SPDR Dow Jones Industrial Average ETF',
    sector: 'Broad Market',
    assetClass: 'equity',
    avgDailyVolume: 3_500_000,
    beta: 0.95,
    expense: 0.16,
  },
  {
    symbol: 'IWM',
    name: 'iShares Russell 2000 ETF (Small Cap)',
    sector: 'Small Cap',
    assetClass: 'equity',
    avgDailyVolume: 28_000_000,
    beta: 1.10,
    expense: 0.19,
  },

  // Sector ETFs (10)
  {
    symbol: 'XLF',
    name: 'Financial Select Sector SPDR Fund',
    sector: 'Financials',
    assetClass: 'equity',
    avgDailyVolume: 55_000_000,
    beta: 1.12,
    expense: 0.10,
  },
  {
    symbol: 'XLE',
    name: 'Energy Select Sector SPDR Fund',
    sector: 'Energy',
    assetClass: 'equity',
    avgDailyVolume: 28_000_000,
    beta: 1.25,
    expense: 0.10,
  },
  {
    symbol: 'XLK',
    name: 'Technology Select Sector SPDR Fund',
    sector: 'Technology',
    assetClass: 'equity',
    avgDailyVolume: 12_000_000,
    beta: 1.20,
    expense: 0.10,
  },
  {
    symbol: 'XLV',
    name: 'Health Care Select Sector SPDR Fund',
    sector: 'Healthcare',
    assetClass: 'equity',
    avgDailyVolume: 12_000_000,
    beta: 0.85,
    expense: 0.10,
  },
  {
    symbol: 'XLI',
    name: 'Industrial Select Sector SPDR Fund',
    sector: 'Industrials',
    assetClass: 'equity',
    avgDailyVolume: 10_000_000,
    beta: 1.05,
    expense: 0.10,
  },
  {
    symbol: 'XLP',
    name: 'Consumer Staples Select Sector SPDR Fund',
    sector: 'Consumer Staples',
    assetClass: 'equity',
    avgDailyVolume: 8_000_000,
    beta: 0.70,
    expense: 0.10,
  },
  {
    symbol: 'XLU',
    name: 'Utilities Select Sector SPDR Fund',
    sector: 'Utilities',
    assetClass: 'equity',
    avgDailyVolume: 10_000_000,
    beta: 0.60,
    expense: 0.10,
  },
  {
    symbol: 'XLB',
    name: 'Materials Select Sector SPDR Fund',
    sector: 'Materials',
    assetClass: 'equity',
    avgDailyVolume: 5_000_000,
    beta: 1.10,
    expense: 0.10,
  },
  {
    symbol: 'XLRE',
    name: 'Real Estate Select Sector SPDR Fund',
    sector: 'Real Estate',
    assetClass: 'equity',
    avgDailyVolume: 3_500_000,
    beta: 0.90,
    expense: 0.10,
  },
  {
    symbol: 'XLC',
    name: 'Communication Services Select Sector SPDR Fund',
    sector: 'Communications',
    assetClass: 'equity',
    avgDailyVolume: 4_000_000,
    beta: 1.00,
    expense: 0.10,
  },

  // Commodities (4)
  {
    symbol: 'GLD',
    name: 'SPDR Gold Trust',
    sector: 'Precious Metals',
    assetClass: 'commodity',
    avgDailyVolume: 8_000_000,
    beta: 0.05,
    expense: 0.40,
  },
  {
    symbol: 'SLV',
    name: 'iShares Silver Trust',
    sector: 'Precious Metals',
    assetClass: 'commodity',
    avgDailyVolume: 12_000_000,
    beta: 0.15,
    expense: 0.50,
  },
  {
    symbol: 'USO',
    name: 'United States Oil Fund',
    sector: 'Energy',
    assetClass: 'commodity',
    avgDailyVolume: 18_000_000,
    beta: 0.45,
    expense: 0.79,
  },
  {
    symbol: 'UNG',
    name: 'United States Natural Gas Fund',
    sector: 'Energy',
    assetClass: 'commodity',
    avgDailyVolume: 3_000_000,
    beta: 0.30,
    expense: 1.06,
  },

  // Fixed Income (5)
  {
    symbol: 'TLT',
    name: 'iShares 20+ Year Treasury Bond ETF',
    sector: 'Treasury',
    assetClass: 'fixed-income',
    avgDailyVolume: 18_000_000,
    beta: -0.45,
    expense: 0.15,
  },
  {
    symbol: 'IEF',
    name: 'iShares 7-10 Year Treasury Bond ETF',
    sector: 'Treasury',
    assetClass: 'fixed-income',
    avgDailyVolume: 5_000_000,
    beta: -0.25,
    expense: 0.15,
  },
  {
    symbol: 'SHY',
    name: 'iShares 1-3 Year Treasury Bond ETF',
    sector: 'Treasury',
    assetClass: 'fixed-income',
    avgDailyVolume: 3_000_000,
    beta: -0.05,
    expense: 0.15,
  },
  {
    symbol: 'HYG',
    name: 'iShares iBoxx $ High Yield Corporate Bond ETF',
    sector: 'Corporate Bonds',
    assetClass: 'fixed-income',
    avgDailyVolume: 12_000_000,
    beta: 0.60,
    expense: 0.49,
  },
  {
    symbol: 'LQD',
    name: 'iShares iBoxx $ Investment Grade Corporate Bond ETF',
    sector: 'Corporate Bonds',
    assetClass: 'fixed-income',
    avgDailyVolume: 7_000_000,
    beta: 0.30,
    expense: 0.14,
  },

  // International (3)
  {
    symbol: 'EEM',
    name: 'iShares MSCI Emerging Markets ETF',
    sector: 'Emerging Markets',
    assetClass: 'international',
    avgDailyVolume: 32_000_000,
    beta: 1.15,
    expense: 0.68,
  },
  {
    symbol: 'EFA',
    name: 'iShares MSCI EAFE ETF (Developed Markets ex-US)',
    sector: 'Developed Markets',
    assetClass: 'international',
    avgDailyVolume: 18_000_000,
    beta: 0.95,
    expense: 0.32,
  },
  {
    symbol: 'VWO',
    name: 'Vanguard FTSE Emerging Markets ETF',
    sector: 'Emerging Markets',
    assetClass: 'international',
    avgDailyVolume: 10_000_000,
    beta: 1.12,
    expense: 0.08,
  },

  // Thematic/Niche (5)
  {
    symbol: 'JETS',
    name: 'U.S. Global Jets ETF (Airlines)',
    sector: 'Airlines',
    assetClass: 'thematic',
    avgDailyVolume: 2_500_000,
    beta: 1.40,
    expense: 0.60,
  },
  {
    symbol: 'SMH',
    name: 'VanEck Semiconductor ETF',
    sector: 'Semiconductors',
    assetClass: 'thematic',
    avgDailyVolume: 6_000_000,
    beta: 1.35,
    expense: 0.35,
  },
  {
    symbol: 'XBI',
    name: 'SPDR S&P Biotech ETF',
    sector: 'Biotech',
    assetClass: 'thematic',
    avgDailyVolume: 5_000_000,
    beta: 1.20,
    expense: 0.35,
  },
  {
    symbol: 'ARKK',
    name: 'ARK Innovation ETF (Disruptive Tech)',
    sector: 'Innovation',
    assetClass: 'thematic',
    avgDailyVolume: 8_000_000,
    beta: 1.50,
    expense: 0.75,
  },
  {
    symbol: 'LIT',
    name: 'Global X Lithium & Battery Tech ETF',
    sector: 'Battery Tech',
    assetClass: 'thematic',
    avgDailyVolume: 1_500_000,
    beta: 1.25,
    expense: 0.75,
  },

  // ── Top 100 US Stocks (by market cap) ─────────────────────────────────────
  { symbol: 'NVDA',  name: 'NVIDIA Corporation',              sector: 'Semiconductors',      assetClass: 'stock', avgDailyVolume: 310_000_000, beta: 1.70, expense: 0 },
  { symbol: 'AAPL',  name: 'Apple Inc.',                      sector: 'Technology',          assetClass: 'stock', avgDailyVolume: 55_000_000,  beta: 1.20, expense: 0 },
  { symbol: 'GOOGL', name: 'Alphabet Inc. (Google)',         sector: 'Technology',          assetClass: 'stock', avgDailyVolume: 25_000_000,  beta: 1.05, expense: 0 },
  { symbol: 'MSFT',  name: 'Microsoft Corporation',          sector: 'Technology',          assetClass: 'stock', avgDailyVolume: 22_000_000,  beta: 0.90, expense: 0 },
  { symbol: 'AMZN',  name: 'Amazon.com Inc.',                sector: 'Consumer Discretionary', assetClass: 'stock', avgDailyVolume: 35_000_000,  beta: 1.15, expense: 0 },
  { symbol: 'TSM',   name: 'Taiwan Semiconductor',            sector: 'Semiconductors',      assetClass: 'stock', avgDailyVolume: 15_000_000,  beta: 1.10, expense: 0 },
  { symbol: 'META',  name: 'Meta Platforms Inc.',            sector: 'Technology',          assetClass: 'stock', avgDailyVolume: 18_000_000,  beta: 1.25, expense: 0 },
  { symbol: 'AVGO',  name: 'Broadcom Inc.',                  sector: 'Semiconductors',      assetClass: 'stock', avgDailyVolume: 4_000_000,   beta: 1.35, expense: 0 },
  { symbol: 'TSLA',  name: 'Tesla Inc.',                      sector: 'Consumer Discretionary', assetClass: 'stock', avgDailyVolume: 120_000_000, beta: 2.00, expense: 0 },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway',              sector: 'Financials',          assetClass: 'stock', avgDailyVolume: 4_000_000,   beta: 0.85, expense: 0 },
  { symbol: 'WMT',   name: 'Walmart Inc.',                    sector: 'Consumer Staples',    assetClass: 'stock', avgDailyVolume: 7_000_000,   beta: 0.55, expense: 0 },
  { symbol: 'LLY',   name: 'Eli Lilly and Company',          sector: 'Healthcare',          assetClass: 'stock', avgDailyVolume: 3_000_000,   beta: 0.50, expense: 0 },
  { symbol: 'JPM',   name: 'JPMorgan Chase & Co.',           sector: 'Financials',         assetClass: 'stock', avgDailyVolume: 9_000_000,   beta: 1.10, expense: 0 },
  { symbol: 'XOM',   name: 'ExxonMobil Corporation',         sector: 'Energy',               assetClass: 'stock', avgDailyVolume: 18_000_000,  beta: 0.85, expense: 0 },
  { symbol: 'V',     name: 'Visa Inc.',                       sector: 'Financials',          assetClass: 'stock', avgDailyVolume: 7_000_000,   beta: 0.95, expense: 0 },
  { symbol: 'JNJ',   name: 'Johnson & Johnson',              sector: 'Healthcare',          assetClass: 'stock', avgDailyVolume: 8_000_000,   beta: 0.60, expense: 0 },
  { symbol: 'ASML',  name: 'ASML Holding',                   sector: 'Semiconductors',      assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 1.20, expense: 0 },
  { symbol: 'MU',    name: 'Micron Technology',               sector: 'Semiconductors',      assetClass: 'stock', avgDailyVolume: 25_000_000,  beta: 1.50, expense: 0 },
  { symbol: 'MA',    name: 'Mastercard Inc.',                 sector: 'Financials',          assetClass: 'stock', avgDailyVolume: 5_000_000,   beta: 1.00, expense: 0 },
  { symbol: 'COST',  name: 'Costco Wholesale',               sector: 'Consumer Staples',    assetClass: 'stock', avgDailyVolume: 3_000_000,   beta: 0.80, expense: 0 },
  { symbol: 'ORCL',  name: 'Oracle Corporation',              sector: 'Technology',          assetClass: 'stock', avgDailyVolume: 8_000_000,   beta: 1.05, expense: 0 },
  { symbol: 'ABBV',  name: 'AbbVie Inc.',                    sector: 'Healthcare',          assetClass: 'stock', avgDailyVolume: 6_000_000,   beta: 0.55, expense: 0 },
  { symbol: 'NFLX',  name: 'Netflix Inc.',                    sector: 'Technology',          assetClass: 'stock', avgDailyVolume: 5_000_000,   beta: 1.20, expense: 0 },
  { symbol: 'PG',    name: 'Procter & Gamble',                sector: 'Consumer Staples',    assetClass: 'stock', avgDailyVolume: 6_000_000,   beta: 0.45, expense: 0 },
  { symbol: 'HD',    name: 'Home Depot Inc.',                 sector: 'Consumer Discretionary', assetClass: 'stock', avgDailyVolume: 4_000_000,   beta: 1.05, expense: 0 },
  { symbol: 'CVX',   name: 'Chevron Corporation',             sector: 'Energy',              assetClass: 'stock', avgDailyVolume: 10_000_000,  beta: 0.80, expense: 0 },
  { symbol: 'MRK',   name: 'Merck & Co.',                    sector: 'Healthcare',          assetClass: 'stock', avgDailyVolume: 8_000_000,   beta: 0.50, expense: 0 },
  { symbol: 'PFE',   name: 'Pfizer Inc.',                    sector: 'Healthcare',          assetClass: 'stock', avgDailyVolume: 25_000_000,  beta: 0.55, expense: 0 },
  { symbol: 'KO',    name: 'Coca-Cola Company',               sector: 'Consumer Staples',    assetClass: 'stock', avgDailyVolume: 15_000_000,  beta: 0.55, expense: 0 },
  { symbol: 'PEP',   name: 'PepsiCo Inc.',                    sector: 'Consumer Staples',    assetClass: 'stock', avgDailyVolume: 5_000_000,   beta: 0.50, expense: 0 },
  { symbol: 'DIS',   name: 'Walt Disney Company',            sector: 'Consumer Discretionary', assetClass: 'stock', avgDailyVolume: 12_000_000, beta: 1.25, expense: 0 },
  { symbol: 'TMO',   name: 'Thermo Fisher Scientific',       sector: 'Healthcare',          assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 0.90, expense: 0 },
  { symbol: 'ABT',   name: 'Abbott Laboratories',            sector: 'Healthcare',          assetClass: 'stock', avgDailyVolume: 5_000_000,   beta: 0.70, expense: 0 },
  { symbol: 'DHR',   name: 'Danaher Corporation',            sector: 'Healthcare',          assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 0.85, expense: 0 },
  { symbol: 'BMY',   name: 'Bristol-Myers Squibb',           sector: 'Healthcare',          assetClass: 'stock', avgDailyVolume: 10_000_000,  beta: 0.55, expense: 0 },
  { symbol: 'NEE',   name: 'NextEra Energy',                  sector: 'Utilities',          assetClass: 'stock', avgDailyVolume: 6_000_000,   beta: 0.60, expense: 0 },
  { symbol: 'MCD',   name: 'McDonald\'s Corporation',        sector: 'Consumer Discretionary', assetClass: 'stock', avgDailyVolume: 3_000_000,   beta: 0.70, expense: 0 },
  { symbol: 'ADBE',  name: 'Adobe Inc.',                     sector: 'Technology',          assetClass: 'stock', avgDailyVolume: 3_000_000,   beta: 1.15, expense: 0 },
  { symbol: 'TXN',   name: 'Texas Instruments',               sector: 'Semiconductors',     assetClass: 'stock', avgDailyVolume: 5_000_000,   beta: 1.00, expense: 0 },
  { symbol: 'WFC',   name: 'Wells Fargo & Company',           sector: 'Financials',         assetClass: 'stock', avgDailyVolume: 18_000_000,  beta: 1.20, expense: 0 },
  { symbol: 'PM',    name: 'Philip Morris International',     sector: 'Consumer Staples',    assetClass: 'stock', avgDailyVolume: 5_000_000,   beta: 0.60, expense: 0 },
  { symbol: 'CSCO',  name: 'Cisco Systems',                  sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 15_000_000,  beta: 0.95, expense: 0 },
  { symbol: 'INTC',  name: 'Intel Corporation',               sector: 'Semiconductors',      assetClass: 'stock', avgDailyVolume: 45_000_000,  beta: 1.10, expense: 0 },
  { symbol: 'UNP',   name: 'Union Pacific',                  sector: 'Industrials',         assetClass: 'stock', avgDailyVolume: 3_000_000,   beta: 1.00, expense: 0 },
  { symbol: 'UPS',   name: 'United Parcel Service',          sector: 'Industrials',         assetClass: 'stock', avgDailyVolume: 4_000_000,   beta: 1.05, expense: 0 },
  { symbol: 'HON',   name: 'Honeywell International',         sector: 'Industrials',         assetClass: 'stock', avgDailyVolume: 3_000_000,   beta: 1.00, expense: 0 },
  { symbol: 'RTX',   name: 'RTX Corporation',                sector: 'Industrials',         assetClass: 'stock', avgDailyVolume: 6_000_000,   beta: 0.95, expense: 0 },
  { symbol: 'AMD',   name: 'Advanced Micro Devices',         sector: 'Semiconductors',      assetClass: 'stock', avgDailyVolume: 55_000_000,  beta: 1.60, expense: 0 },
  { symbol: 'QCOM',  name: 'Qualcomm Inc.',                  sector: 'Semiconductors',      assetClass: 'stock', avgDailyVolume: 8_000_000,   beta: 1.25, expense: 0 },
  { symbol: 'IBM',   name: 'IBM Corporation',                sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 4_000_000,   beta: 0.85, expense: 0 },
  { symbol: 'INTU',  name: 'Intuit Inc.',                    sector: 'Technology',          assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 1.10, expense: 0 },
  { symbol: 'AMGN',  name: 'Amgen Inc.',                     sector: 'Healthcare',         assetClass: 'stock', avgDailyVolume: 3_000_000,   beta: 0.65, expense: 0 },
  { symbol: 'SPGI',  name: 'S&P Global Inc.',                sector: 'Financials',         assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 0.95, expense: 0 },
  { symbol: 'LMT',   name: 'Lockheed Martin',                 sector: 'Industrials',        assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 0.90, expense: 0 },
  { symbol: 'GE',    name: 'General Electric',               sector: 'Industrials',         assetClass: 'stock', avgDailyVolume: 12_000_000,  beta: 1.15, expense: 0 },
  { symbol: 'SBUX',  name: 'Starbucks Corporation',          sector: 'Consumer Discretionary', assetClass: 'stock', avgDailyVolume: 7_000_000,   beta: 0.95, expense: 0 },
  { symbol: 'GILD',  name: 'Gilead Sciences',                sector: 'Healthcare',          assetClass: 'stock', avgDailyVolume: 6_000_000,   beta: 0.55, expense: 0 },
  { symbol: 'VZ',    name: 'Verizon Communications',        sector: 'Communications',      assetClass: 'stock', avgDailyVolume: 20_000_000,  beta: 0.45, expense: 0 },
  { symbol: 'NOW',   name: 'ServiceNow Inc.',                sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 1.20, expense: 0 },
  { symbol: 'AMAT',  name: 'Applied Materials',              sector: 'Semiconductors',     assetClass: 'stock', avgDailyVolume: 8_000_000,   beta: 1.45, expense: 0 },
  { symbol: 'BKNG',  name: 'Booking Holdings',               sector: 'Consumer Discretionary', assetClass: 'stock', avgDailyVolume: 1_000_000,   beta: 1.25, expense: 0 },
  { symbol: 'TGT',   name: 'Target Corporation',             sector: 'Consumer Discretionary', assetClass: 'stock', avgDailyVolume: 5_000_000,   beta: 1.00, expense: 0 },
  { symbol: 'LRCX',  name: 'Lam Research',                   sector: 'Semiconductors',     assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 1.50, expense: 0 },
  { symbol: 'PLD',   name: 'Prologis Inc.',                  sector: 'Real Estate',         assetClass: 'stock', avgDailyVolume: 4_000_000,   beta: 0.95, expense: 0 },
  { symbol: 'C',     name: 'Citigroup Inc.',                 sector: 'Financials',         assetClass: 'stock', avgDailyVolume: 15_000_000,  beta: 1.35, expense: 0 },
  { symbol: 'KLAC',  name: 'KLA Corporation',                sector: 'Semiconductors',     assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 1.40, expense: 0 },
  { symbol: 'SCHW',  name: 'Charles Schwab',                 sector: 'Financials',         assetClass: 'stock', avgDailyVolume: 8_000_000,   beta: 1.15, expense: 0 },
  { symbol: 'DE',    name: 'Deere & Company',                sector: 'Industrials',        assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 1.00, expense: 0 },
  { symbol: 'MDLZ',  name: 'Mondelez International',         sector: 'Consumer Staples',    assetClass: 'stock', avgDailyVolume: 6_000_000,   beta: 0.55, expense: 0 },
  { symbol: 'BLK',   name: 'BlackRock Inc.',                 sector: 'Financials',         assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 1.15, expense: 0 },
  { symbol: 'ADI',   name: 'Analog Devices',                 sector: 'Semiconductors',     assetClass: 'stock', avgDailyVolume: 4_000_000,   beta: 1.10, expense: 0 },
  { symbol: 'AXON',  name: 'Axon Enterprise',                sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 1_000_000,   beta: 1.30, expense: 0 },
  { symbol: 'PANW',  name: 'Palo Alto Networks',             sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 4_000_000,   beta: 1.25, expense: 0 },
  { symbol: 'ADSK',  name: 'Autodesk Inc.',                  sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 1.15, expense: 0 },
  { symbol: 'USB',   name: 'U.S. Bancorp',                   sector: 'Financials',         assetClass: 'stock', avgDailyVolume: 6_000_000,   beta: 1.00, expense: 0 },
  { symbol: 'PGR',   name: 'Progressive Corporation',       sector: 'Financials',        assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 0.55, expense: 0 },
  { symbol: 'SNPS',  name: 'Synopsys Inc.',                  sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 1.20, expense: 0 },
  { symbol: 'EMR',   name: 'Emerson Electric',               sector: 'Industrials',        assetClass: 'stock', avgDailyVolume: 3_000_000,   beta: 1.05, expense: 0 },
  { symbol: 'ICE',   name: 'Intercontinental Exchange',      sector: 'Financials',         assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 0.80, expense: 0 },
  { symbol: 'MS',    name: 'Morgan Stanley',                 sector: 'Financials',         assetClass: 'stock', avgDailyVolume: 8_000_000,   beta: 1.25, expense: 0 },
  { symbol: 'TMUS',  name: 'T-Mobile US',                    sector: 'Communications',    assetClass: 'stock', avgDailyVolume: 5_000_000,   beta: 0.70, expense: 0 },
  { symbol: 'REGN',  name: 'Regeneron Pharmaceuticals',       sector: 'Healthcare',         assetClass: 'stock', avgDailyVolume: 1_000_000,   beta: 0.75, expense: 0 },
  { symbol: 'ZTS',   name: 'Zoetis Inc.',                     sector: 'Healthcare',         assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 0.85, expense: 0 },
  { symbol: 'MO',    name: 'Altria Group',                   sector: 'Consumer Staples',   assetClass: 'stock', avgDailyVolume: 8_000_000,   beta: 0.55, expense: 0 },
  { symbol: 'CB',    name: 'Chubb Limited',                  sector: 'Financials',        assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 0.75, expense: 0 },
  { symbol: 'CME',   name: 'CME Group Inc.',                 sector: 'Financials',        assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 0.65, expense: 0 },
  { symbol: 'CI',    name: 'Cigna Corporation',               sector: 'Healthcare',        assetClass: 'stock', avgDailyVolume: 3_000_000,   beta: 0.60, expense: 0 },
  { symbol: 'APD',   name: 'Air Products',                   sector: 'Materials',          assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 0.95, expense: 0 },
  { symbol: 'SO',    name: 'Southern Company',                sector: 'Utilities',         assetClass: 'stock', avgDailyVolume: 5_000_000,   beta: 0.50, expense: 0 },
  { symbol: 'APH',   name: 'Amphenol Corporation',           sector: 'Technology',        assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 1.15, expense: 0 },
  { symbol: 'GD',    name: 'General Dynamics',               sector: 'Industrials',        assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 0.90, expense: 0 },
  { symbol: 'ECL',   name: 'Ecolab Inc.',                    sector: 'Materials',          assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 0.85, expense: 0 },
  { symbol: 'DUK',   name: 'Duke Energy',                    sector: 'Utilities',          assetClass: 'stock', avgDailyVolume: 5_000_000,   beta: 0.45, expense: 0 },
  { symbol: 'ITW',   name: 'Illinois Tool Works',            sector: 'Industrials',        assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 1.00, expense: 0 },
  { symbol: 'NOC',   name: 'Northrop Grumman',               sector: 'Industrials',        assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 0.75, expense: 0 },
  { symbol: 'BDX',   name: 'Becton Dickinson',               sector: 'Healthcare',         assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 0.70, expense: 0 },
  { symbol: 'CMCSA', name: 'Comcast Corporation',            sector: 'Communications',    assetClass: 'stock', avgDailyVolume: 12_000_000,  beta: 0.95, expense: 0 },
  { symbol: 'SLB',   name: 'Schlumberger Limited',           sector: 'Energy',             assetClass: 'stock', avgDailyVolume: 10_000_000,  beta: 1.10, expense: 0 },
  { symbol: 'VMC',   name: 'Vulcan Materials',               sector: 'Materials',         assetClass: 'stock', avgDailyVolume: 1_000_000,   beta: 0.95, expense: 0 },
  { symbol: 'SHW',   name: 'Sherwin-Williams',               sector: 'Materials',          assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 1.10, expense: 0 },
  { symbol: 'BAC',   name: 'Bank of America Corp.',          sector: 'Financials',        assetClass: 'stock', avgDailyVolume: 32_000_000,  beta: 1.35, expense: 0 },
  { symbol: 'GS',    name: 'Goldman Sachs Group',            sector: 'Financials',        assetClass: 'stock', avgDailyVolume: 3_000_000,   beta: 1.30, expense: 0 },
  { symbol: 'UNH',   name: 'UnitedHealth Group',             sector: 'Healthcare',         assetClass: 'stock', avgDailyVolume: 3_000_000,   beta: 0.75, expense: 0 },

  // ── Additional popular stocks (AI, Defense, Fintech, EV, SaaS) ─────────────
  { symbol: 'PLTR',  name: 'Palantir Technologies',         sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 45_000_000,  beta: 1.50, expense: 0 },
  { symbol: 'CRM',   name: 'Salesforce Inc.',               sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 8_000_000,   beta: 1.15, expense: 0 },
  { symbol: 'SNOW',  name: 'Snowflake Inc.',                sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 6_000_000,   beta: 1.30, expense: 0 },
  { symbol: 'UBER',  name: 'Uber Technologies',            sector: 'Consumer Discretionary', assetClass: 'stock', avgDailyVolume: 22_000_000,  beta: 1.25, expense: 0 },
  { symbol: 'COIN',  name: 'Coinbase Global',               sector: 'Financials',         assetClass: 'stock', avgDailyVolume: 12_000_000,  beta: 2.00, expense: 0 },
  { symbol: 'RBLX',  name: 'Roblox Corporation',            sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 8_000_000,   beta: 1.40, expense: 0 },
  { symbol: 'RIVN',  name: 'Rivian Automotive',             sector: 'Consumer Discretionary', assetClass: 'stock', avgDailyVolume: 25_000_000,  beta: 1.80, expense: 0 },
  { symbol: 'LCID',  name: 'Lucid Group',                   sector: 'Consumer Discretionary', assetClass: 'stock', avgDailyVolume: 35_000_000,  beta: 2.00, expense: 0 },
  { symbol: 'HOOD',  name: 'Robinhood Markets',             sector: 'Financials',         assetClass: 'stock', avgDailyVolume: 15_000_000,  beta: 1.50, expense: 0 },
  { symbol: 'SOFI',  name: 'SoFi Technologies',            sector: 'Financials',         assetClass: 'stock', avgDailyVolume: 20_000_000,  beta: 1.60, expense: 0 },
  { symbol: 'PYPL',  name: 'PayPal Holdings',               sector: 'Financials',         assetClass: 'stock', avgDailyVolume: 12_000_000,  beta: 1.15, expense: 0 },
  { symbol: 'SHOP',  name: 'Shopify Inc.',                  sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 10_000_000,  beta: 1.45, expense: 0 },
  { symbol: 'SQ',    name: 'Block Inc. (Square)',           sector: 'Financials',         assetClass: 'stock', avgDailyVolume: 12_000_000,  beta: 1.35, expense: 0 },
  { symbol: 'ABNB',  name: 'Airbnb Inc.',                   sector: 'Consumer Discretionary', assetClass: 'stock', avgDailyVolume: 5_000_000,   beta: 1.20, expense: 0 },
  { symbol: 'NIO',   name: 'NIO Inc.',                      sector: 'Consumer Discretionary', assetClass: 'stock', avgDailyVolume: 45_000_000,  beta: 1.70, expense: 0 },
  { symbol: 'BABA',  name: 'Alibaba Group',                 sector: 'Consumer Discretionary', assetClass: 'stock', avgDailyVolume: 18_000_000,  beta: 0.95, expense: 0 },
  { symbol: 'JD',    name: 'JD.com Inc.',                   sector: 'Consumer Discretionary', assetClass: 'stock', avgDailyVolume: 12_000_000,  beta: 0.85, expense: 0 },
  { symbol: 'CRWD',  name: 'CrowdStrike Holdings',          sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 5_000_000,   beta: 1.35, expense: 0 },
  { symbol: 'DDOG',  name: 'Datadog Inc.',                  sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 4_000_000,   beta: 1.25, expense: 0 },
  { symbol: 'NET',   name: 'Cloudflare Inc.',               sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 5_000_000,   beta: 1.30, expense: 0 },
  { symbol: 'MDB',   name: 'MongoDB Inc.',                  sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 1.40, expense: 0 },
  { symbol: 'ZS',    name: 'Zscaler Inc.',                  sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 3_000_000,   beta: 1.25, expense: 0 },
  { symbol: 'FTNT',  name: 'Fortinet Inc.',                 sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 4_000_000,   beta: 1.15, expense: 0 },
  { symbol: 'OKTA',  name: 'Okta Inc.',                     sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 4_000_000,   beta: 1.20, expense: 0 },
  { symbol: 'AI',    name: 'C3.ai Inc.',                    sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 8_000_000,   beta: 1.60, expense: 0 },
  { symbol: 'PATH',  name: 'UiPath Inc.',                   sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 5_000_000,   beta: 1.35, expense: 0 },
  { symbol: 'GTLB',  name: 'GitLab Inc.',                   sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 1.40, expense: 0 },
  { symbol: 'WIX',   name: 'Wix.com Ltd.',                  sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 1_500_000,   beta: 1.25, expense: 0 },
  { symbol: 'ZM',    name: 'Zoom Video Communications',    sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 6_000_000,   beta: 0.90, expense: 0 },
  { symbol: 'DOCU',  name: 'DocuSign Inc.',                  sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 4_000_000,   beta: 1.10, expense: 0 },
  { symbol: 'SPLK',  name: 'Splunk Inc.',                   sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 3_000_000,   beta: 1.15, expense: 0 },
  { symbol: 'TEAM',  name: 'Atlassian Corporation',         sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 2_500_000,   beta: 1.20, expense: 0 },
  { symbol: 'TWLO',  name: 'Twilio Inc.',                  sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 4_000_000,   beta: 1.25, expense: 0 },
  { symbol: 'HUBS',  name: 'HubSpot Inc.',                  sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 1_500_000,   beta: 1.30, expense: 0 },
  { symbol: 'ESTC',  name: 'Elastic N.V.',                  sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 2_000_000,   beta: 1.25, expense: 0 },
  { symbol: 'SMCI',  name: 'Super Micro Computer',          sector: 'Technology',         assetClass: 'stock', avgDailyVolume: 15_000_000,  beta: 1.80, expense: 0 },
  { symbol: 'ARM',   name: 'Arm Holdings',                  sector: 'Semiconductors',     assetClass: 'stock', avgDailyVolume: 12_000_000,  beta: 1.40, expense: 0 },

  // ── Top 100 Cryptocurrencies (Yahoo *-USD symbols, 24/7 tradeable) ─────────
  { symbol: 'BTC-USD',   name: 'Bitcoin',           sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 1_000_000_000, beta: 1.80, expense: 0 },
  { symbol: 'ETH-USD',   name: 'Ethereum',          sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 500_000_000,  beta: 2.00, expense: 0 },
  { symbol: 'BNB-USD',   name: 'BNB',               sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 200_000_000,  beta: 1.90, expense: 0 },
  { symbol: 'SOL-USD',   name: 'Solana',            sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 200_000_000,  beta: 2.50, expense: 0 },
  { symbol: 'XRP-USD',   name: 'XRP',               sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 300_000_000,  beta: 2.10, expense: 0 },
  { symbol: 'DOGE-USD',  name: 'Dogecoin',          sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 150_000_000,  beta: 2.80, expense: 0 },
  { symbol: 'ADA-USD',   name: 'Cardano',           sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 80_000_000,   beta: 2.40, expense: 0 },
  { symbol: 'AVAX-USD',  name: 'Avalanche',         sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 60_000_000,   beta: 2.60, expense: 0 },
  { symbol: 'TRX-USD',   name: 'TRON',              sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 100_000_000,  beta: 2.20, expense: 0 },
  { symbol: 'SHIB-USD',  name: 'Shiba Inu',         sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 80_000_000,   beta: 2.90, expense: 0 },
  { symbol: 'DOT-USD',   name: 'Polkadot',         sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 50_000_000,   beta: 2.30, expense: 0 },
  { symbol: 'LINK-USD',  name: 'Chainlink',        sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 40_000_000,   beta: 2.40, expense: 0 },
  { symbol: 'MATIC-USD', name: 'Polygon',           sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 70_000_000,   beta: 2.50, expense: 0 },
  { symbol: 'POL-USD',   name: 'Polygon (POL)',    sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 50_000_000,   beta: 2.50, expense: 0 },
  { symbol: 'BCH-USD',   name: 'Bitcoin Cash',      sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 30_000_000,   beta: 2.20, expense: 0 },
  { symbol: 'LTC-USD',   name: 'Litecoin',         sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 40_000_000,   beta: 2.00, expense: 0 },
  { symbol: 'UNI-USD',   name: 'Uniswap',          sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 25_000_000,   beta: 2.60, expense: 0 },
  { symbol: 'ATOM-USD',  name: 'Cosmos',            sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 20_000_000,   beta: 2.40, expense: 0 },
  { symbol: 'NEAR-USD',  name: 'NEAR Protocol',     sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 30_000_000,   beta: 2.70, expense: 0 },
  { symbol: 'APT-USD',   name: 'Aptos',             sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 35_000_000,   beta: 2.80, expense: 0 },
  { symbol: 'ARB-USD',   name: 'Arbitrum',          sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 40_000_000,   beta: 2.70, expense: 0 },
  { symbol: 'OP-USD',    name: 'Optimism',         sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 30_000_000,   beta: 2.80, expense: 0 },
  { symbol: 'INJ-USD',   name: 'Injective',        sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 25_000_000,   beta: 2.90, expense: 0 },
  { symbol: 'SUI-USD',   name: 'Sui',               sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 45_000_000,   beta: 2.90, expense: 0 },
  { symbol: 'RENDER-USD', name: 'Render',           sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 20_000_000,   beta: 2.80, expense: 0 },
  { symbol: 'FET-USD',   name: 'Fetch.ai',         sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 15_000_000,   beta: 2.90, expense: 0 },
  { symbol: 'PEPE-USD',  name: 'Pepe',              sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 50_000_000,   beta: 3.00, expense: 0 },
  { symbol: 'TON-USD',   name: 'Toncoin',          sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 40_000_000,   beta: 2.70, expense: 0 },
  { symbol: 'STX-USD',   name: 'Stacks',            sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 15_000_000,   beta: 2.60, expense: 0 },
  { symbol: 'HBAR-USD',  name: 'Hedera',            sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 25_000_000,   beta: 2.50, expense: 0 },
  { symbol: 'FIL-USD',   name: 'Filecoin',          sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 20_000_000,   beta: 2.60, expense: 0 },
  { symbol: 'IMX-USD',   name: 'Immutable X',      sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 15_000_000,   beta: 2.80, expense: 0 },
  { symbol: 'AAVE-USD',  name: 'Aave',              sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 10_000_000,   beta: 2.70, expense: 0 },
  { symbol: 'MKR-USD',   name: 'Maker',             sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 5_000_000,    beta: 2.50, expense: 0 },
  { symbol: 'VET-USD',   name: 'VeChain',          sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 30_000_000,   beta: 2.40, expense: 0 },
  { symbol: 'GRT-USD',   name: 'The Graph',         sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 15_000_000,   beta: 2.70, expense: 0 },
  { symbol: 'ALGO-USD',  name: 'Algorand',         sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 25_000_000,   beta: 2.50, expense: 0 },
  { symbol: 'ETC-USD',   name: 'Ethereum Classic', sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 20_000_000,   beta: 2.30, expense: 0 },
  { symbol: 'EGLD-USD',  name: 'MultiversX',       sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 10_000_000,   beta: 2.60, expense: 0 },
  { symbol: 'XLM-USD',   name: 'Stellar',          sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 40_000_000,   beta: 2.20, expense: 0 },
  { symbol: 'THETA-USD', name: 'Theta Network',     sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 10_000_000,   beta: 2.50, expense: 0 },
  { symbol: 'RUNE-USD',  name: 'THORChain',         sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 8_000_000,    beta: 2.80, expense: 0 },
  { symbol: 'FLOKI-USD', name: 'Floki',            sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 20_000_000,   beta: 2.90, expense: 0 },
  { symbol: 'BONK-USD',  name: 'Bonk',              sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 35_000_000,   beta: 2.95, expense: 0 },
  { symbol: 'WIF-USD',   name: 'dogwifhat',        sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 25_000_000,   beta: 2.95, expense: 0 },
  { symbol: 'SAND-USD',  name: 'The Sandbox',      sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 15_000_000,   beta: 2.70, expense: 0 },
  { symbol: 'MANA-USD',  name: 'Decentraland',     sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 20_000_000,   beta: 2.60, expense: 0 },
  { symbol: 'AXS-USD',   name: 'Axie Infinity',    sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 10_000_000,   beta: 2.70, expense: 0 },
  { symbol: 'ICP-USD',   name: 'Internet Computer', sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 15_000_000,   beta: 2.80, expense: 0 },
  { symbol: 'ROSE-USD',  name: 'Oasis Network',     sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 8_000_000,    beta: 2.60, expense: 0 },
  { symbol: 'FLOW-USD',  name: 'Flow',              sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 10_000_000,   beta: 2.50, expense: 0 },
  { symbol: 'TIA-USD',   name: 'Celestia',         sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 25_000_000,   beta: 2.80, expense: 0 },
  { symbol: 'SEI-USD',   name: 'Sei',               sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 30_000_000,   beta: 2.90, expense: 0 },
  { symbol: 'KAVA-USD',  name: 'Kava',              sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 5_000_000,   beta: 2.60, expense: 0 },
  { symbol: 'BLUR-USD',  name: 'Blur',              sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 10_000_000,   beta: 2.80, expense: 0 },
  { symbol: 'JUP-USD',   name: 'Jupiter',          sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 40_000_000,   beta: 2.90, expense: 0 },
  { symbol: 'STRK-USD',  name: 'Starknet',         sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 20_000_000,   beta: 2.85, expense: 0 },
  { symbol: 'PENDLE-USD', name: 'Pendle',          sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 15_000_000,   beta: 2.80, expense: 0 },
  { symbol: 'SNX-USD',   name: 'Synthetix',        sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 5_000_000,    beta: 2.70, expense: 0 },
  { symbol: 'ZETA-USD',  name: 'ZetaChain',        sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 10_000_000,   beta: 2.85, expense: 0 },
  { symbol: 'DYM-USD',   name: 'Dymension',        sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 8_000_000,    beta: 2.80, expense: 0 },
  { symbol: 'WLD-USD',   name: 'Worldcoin',        sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 35_000_000,   beta: 2.90, expense: 0 },
  { symbol: 'AR-USD',    name: 'Arweave',          sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 8_000_000,    beta: 2.70, expense: 0 },
  { symbol: 'CFX-USD',   name: 'Conflux',          sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 15_000_000,   beta: 2.80, expense: 0 },
  { symbol: 'CRV-USD',   name: 'Curve DAO',        sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 8_000_000,    beta: 2.60, expense: 0 },
  { symbol: 'COMP-USD',  name: 'Compound',         sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 5_000_000,   beta: 2.50, expense: 0 },
  { symbol: 'LDO-USD',   name: 'Lido DAO',         sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 10_000_000,   beta: 2.70, expense: 0 },
  { symbol: 'MINA-USD',  name: 'Mina',              sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 8_000_000,    beta: 2.60, expense: 0 },
  { symbol: 'JASMY-USD', name: 'JasmyCoin',        sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 20_000_000,   beta: 2.80, expense: 0 },
  { symbol: 'ENS-USD',   name: 'Ethereum Name Service', sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 5_000_000, beta: 2.60, expense: 0 },
  { symbol: 'GALA-USD',  name: 'Gala',              sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 25_000_000,   beta: 2.70, expense: 0 },
  { symbol: 'ASTR-USD',  name: 'Astar',            sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 8_000_000,   beta: 2.60, expense: 0 },
  { symbol: 'CHZ-USD',   name: 'Chiliz',           sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 15_000_000,   beta: 2.50, expense: 0 },
  { symbol: '1INCH-USD', name: '1inch',            sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 8_000_000,   beta: 2.70, expense: 0 },
  { symbol: 'DYDX-USD',  name: 'dYdX',             sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 10_000_000,   beta: 2.80, expense: 0 },
  { symbol: 'SKL-USD',   name: 'Skale',            sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 5_000_000,    beta: 2.60, expense: 0 },
  { symbol: 'ZEC-USD',   name: 'Zcash',            sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 8_000_000,   beta: 2.40, expense: 0 },
  { symbol: 'XTZ-USD',   name: 'Tezos',            sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 10_000_000,   beta: 2.50, expense: 0 },
  { symbol: 'KSM-USD',   name: 'Kusama',           sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 5_000_000,   beta: 2.60, expense: 0 },
  { symbol: 'ENJ-USD',   name: 'Enjin Coin',       sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 15_000_000,   beta: 2.60, expense: 0 },
  { symbol: 'BAT-USD',   name: 'Basic Attention Token', sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 10_000_000, beta: 2.50, expense: 0 },
  { symbol: 'ZIL-USD',   name: 'Zilliqa',          sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 15_000_000,   beta: 2.60, expense: 0 },
  { symbol: 'ONE-USD',   name: 'Harmony',          sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 20_000_000,   beta: 2.70, expense: 0 },
  { symbol: 'ICX-USD',   name: 'ICON',             sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 10_000_000,   beta: 2.50, expense: 0 },
  { symbol: 'QTUM-USD',  name: 'Qtum',             sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 8_000_000,   beta: 2.40, expense: 0 },
  { symbol: 'WAVES-USD', name: 'Waves',            sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 5_000_000,   beta: 2.50, expense: 0 },
  { symbol: 'LSK-USD',   name: 'Lisk',             sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 5_000_000,   beta: 2.60, expense: 0 },
  { symbol: 'DASH-USD',  name: 'Dash',             sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 5_000_000,   beta: 2.30, expense: 0 },
  { symbol: 'NANO-USD',  name: 'Nano',             sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 5_000_000,   beta: 2.50, expense: 0 },
  { symbol: 'SC-USD',    name: 'Siacoin',          sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 8_000_000,   beta: 2.60, expense: 0 },
  { symbol: 'RVN-USD',   name: 'Ravencoin',        sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 5_000_000,   beta: 2.50, expense: 0 },
  { symbol: 'DGB-USD',   name: 'DigiByte',         sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 5_000_000,   beta: 2.40, expense: 0 },
  { symbol: 'KNC-USD',   name: 'Kyber Network',    sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 5_000_000,   beta: 2.60, expense: 0 },
  { symbol: 'OMG-USD',   name: 'OMG Network',      sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 5_000_000,   beta: 2.50, expense: 0 },
  { symbol: 'ANKR-USD',  name: 'Ankr',             sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 10_000_000,   beta: 2.70, expense: 0 },
  { symbol: 'CELO-USD',  name: 'Celo',             sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 8_000_000,   beta: 2.60, expense: 0 },
  { symbol: 'OCEAN-USD', name: 'Ocean Protocol',   sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 5_000_000,   beta: 2.70, expense: 0 },
  { symbol: 'AUDIO-USD', name: 'Audius',           sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 5_000_000,   beta: 2.60, expense: 0 },
  { symbol: 'YFI-USD',   name: 'yearn.finance',    sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 3_000_000,   beta: 2.50, expense: 0 },
  { symbol: 'SUSHI-USD', name: 'SushiSwap',        sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 8_000_000,   beta: 2.70, expense: 0 },
  { symbol: 'BAND-USD',  name: 'Band Protocol',    sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 5_000_000,   beta: 2.60, expense: 0 },
  { symbol: 'UMA-USD',   name: 'UMA',              sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 3_000_000,   beta: 2.60, expense: 0 },
  { symbol: 'REN-USD',   name: 'Ren',              sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 5_000_000,   beta: 2.50, expense: 0 },
  { symbol: 'STORJ-USD', name: 'Storj',            sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 5_000_000,   beta: 2.60, expense: 0 },
  { symbol: 'C98-USD',   name: 'Coin98',           sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 5_000_000,   beta: 2.70, expense: 0 },
  { symbol: 'LRC-USD',   name: 'Loopring',         sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 8_000_000,   beta: 2.60, expense: 0 },
  { symbol: 'API3-USD',  name: 'API3',             sector: 'Cryptocurrency', assetClass: 'crypto', avgDailyVolume: 3_000_000,   beta: 2.70, expense: 0 },

  // ── Forex (Yahoo format: XXXYYY=X) ───────────────────────────────────────────
  { symbol: 'EURUSD=X',  name: 'Euro / US Dollar',     sector: 'Forex', assetClass: 'forex', avgDailyVolume: 0, beta: 0, expense: 0 },
  { symbol: 'GBPUSD=X',  name: 'British Pound / USD',  sector: 'Forex', assetClass: 'forex', avgDailyVolume: 0, beta: 0, expense: 0 },
  { symbol: 'USDJPY=X',  name: 'US Dollar / Japanese Yen', sector: 'Forex', assetClass: 'forex', avgDailyVolume: 0, beta: 0, expense: 0 },
  { symbol: 'AUDUSD=X',  name: 'Australian Dollar / USD', sector: 'Forex', assetClass: 'forex', avgDailyVolume: 0, beta: 0, expense: 0 },
  { symbol: 'USDCAD=X',  name: 'US Dollar / Canadian Dollar', sector: 'Forex', assetClass: 'forex', avgDailyVolume: 0, beta: 0, expense: 0 },
  { symbol: 'USDCHF=X',  name: 'US Dollar / Swiss Franc', sector: 'Forex', assetClass: 'forex', avgDailyVolume: 0, beta: 0, expense: 0 },
  { symbol: 'NZDUSD=X',  name: 'New Zealand Dollar / USD', sector: 'Forex', assetClass: 'forex', avgDailyVolume: 0, beta: 0, expense: 0 },
  { symbol: 'EURGBP=X',  name: 'Euro / British Pound', sector: 'Forex', assetClass: 'forex', avgDailyVolume: 0, beta: 0, expense: 0 },
  { symbol: 'EURJPY=X',  name: 'Euro / Japanese Yen', sector: 'Forex', assetClass: 'forex', avgDailyVolume: 0, beta: 0, expense: 0 },
  { symbol: 'GBPJPY=X',  name: 'British Pound / Japanese Yen', sector: 'Forex', assetClass: 'forex', avgDailyVolume: 0, beta: 0, expense: 0 },
];

/**
 * Get asset metadata by symbol
 */
export function getAsset(symbol: string): UniverseAsset | undefined {
  return TRADEABLE_UNIVERSE.find(a => a.symbol === symbol);
}

/**
 * Get all symbols in the universe
 */
export function getAllSymbols(): string[] {
  return TRADEABLE_UNIVERSE.map(a => a.symbol);
}

/**
 * Get symbols by asset class
 */
export function getSymbolsByAssetClass(
  assetClass: UniverseAsset['assetClass']
): string[] {
  return TRADEABLE_UNIVERSE.filter(a => a.assetClass === assetClass).map(a => a.symbol);
}

/**
 * Get symbols by sector
 */
export function getSymbolsBySector(sector: string): string[] {
  return TRADEABLE_UNIVERSE.filter(a => a.sector === sector).map(a => a.symbol);
}

/**
 * Check if symbol is in tradeable universe
 */
export function isTradeable(symbol: string): boolean {
  return TRADEABLE_UNIVERSE.some(a => a.symbol === symbol);
}

/**
 * Get all unique sectors
 */
export function getAllSectors(): string[] {
  const sectors = new Set(TRADEABLE_UNIVERSE.map(a => a.sector));
  return Array.from(sectors).sort();
}

/**
 * Get all unique asset classes
 */
export function getAllAssetClasses(): UniverseAsset['assetClass'][] {
  const classes = new Set(TRADEABLE_UNIVERSE.map(a => a.assetClass));
  return Array.from(classes);
}

/**
 * Sector to symbol mapping for quick lookups
 * Used by sentiment strategy to map news tone → tradeable ETFs
 */
export const SECTOR_TO_SYMBOLS: Record<string, string[]> = {
  'Technology': ['QQQ', 'XLK', 'SMH'],
  'Energy': ['XLE', 'USO', 'UNG'],
  'Financials': ['XLF'],
  'Healthcare': ['XLV', 'XBI'],
  'Industrials': ['XLI'],
  'Consumer Staples': ['XLP'],
  'Utilities': ['XLU'],
  'Materials': ['XLB'],
  'Real Estate': ['XLRE'],
  'Communications': ['XLC'],
  'Broad Market': ['SPY', 'DIA'],
  'Small Cap': ['IWM'],
  'Precious Metals': ['GLD', 'SLV'],
  'Airlines': ['JETS'],
  'Semiconductors': ['SMH'],
  'Biotech': ['XBI'],
  'Innovation': ['ARKK'],
  'Battery Tech': ['LIT'],
  'Emerging Markets': ['EEM', 'VWO'],
  'Developed Markets': ['EFA'],
  'Treasury': ['TLT', 'IEF', 'SHY'],
  'Corporate Bonds': ['HYG', 'LQD'],
  'Cryptocurrency': ['BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD', 'DOGE-USD', 'ADA-USD', 'AVAX-USD'],
  'Consumer Discretionary': ['AMZN', 'TSLA', 'HD'],
  'Consumer Staples Stock': ['WMT', 'COST'],
  'Forex': ['EURUSD=X', 'GBPUSD=X', 'USDJPY=X', 'AUDUSD=X', 'USDCAD=X', 'USDCHF=X', 'NZDUSD=X'],
};
