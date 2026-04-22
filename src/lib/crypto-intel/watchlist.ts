// src/lib/crypto-intel/watchlist.ts
// Watchlist inicial. Editar `WATCHLIST` para añadir/quitar assets.
// En Fase 4 se vuelve configurable desde dashboard.

export interface WatchlistEntry {
  symbol: string;
  name: string;
  coingeckoId: string;
  binanceSymbol: string;
  rank: number;
}

// Top 10 market cap + BTC/ETH (BTC y ETH ya están en top). Ajustar según market cap real al deploy.
export const WATCHLIST: WatchlistEntry[] = [
  { symbol: "BTC",   name: "Bitcoin",     coingeckoId: "bitcoin",       binanceSymbol: "BTCUSDT",  rank: 1  },
  { symbol: "ETH",   name: "Ethereum",    coingeckoId: "ethereum",      binanceSymbol: "ETHUSDT",  rank: 2  },
  { symbol: "SOL",   name: "Solana",      coingeckoId: "solana",        binanceSymbol: "SOLUSDT",  rank: 3  },
  { symbol: "BNB",   name: "BNB",         coingeckoId: "binancecoin",   binanceSymbol: "BNBUSDT",  rank: 4  },
  { symbol: "XRP",   name: "XRP",         coingeckoId: "ripple",        binanceSymbol: "XRPUSDT",  rank: 5  },
  { symbol: "ADA",   name: "Cardano",     coingeckoId: "cardano",       binanceSymbol: "ADAUSDT",  rank: 6  },
  { symbol: "DOGE",  name: "Dogecoin",    coingeckoId: "dogecoin",      binanceSymbol: "DOGEUSDT", rank: 7  },
  { symbol: "AVAX",  name: "Avalanche",   coingeckoId: "avalanche-2",   binanceSymbol: "AVAXUSDT", rank: 8  },
  { symbol: "LINK",  name: "Chainlink",   coingeckoId: "chainlink",     binanceSymbol: "LINKUSDT", rank: 9  },
  { symbol: "DOT",   name: "Polkadot",    coingeckoId: "polkadot",      binanceSymbol: "DOTUSDT",  rank: 10 },
];

export const BINANCE_SYMBOLS = WATCHLIST.map((w) => w.binanceSymbol);
export const SYMBOL_BY_BINANCE = new Map(
  WATCHLIST.map((w) => [w.binanceSymbol, w.symbol])
);
export const ENTRY_BY_SYMBOL = new Map(WATCHLIST.map((w) => [w.symbol, w]));
