export const RISK_THRESHOLDS = {
  LARGE_WITHDRAWAL_WARN_PCT: 0.25,
  LARGE_WITHDRAWAL_BLOCK_PCT: 0.50,
} as const

export const ASSET_DECIMALS: Record<string, number> = {
  BTC: 8,
  ETH: 6,
  USDC: 2,
  USDT: 2,
  SOL: 4,
}

export const NETWORK_LABELS: Record<string, string> = {
  bitcoin: "Bitcoin",
  ethereum: "Ethereum",
  solana: "Solana",
  "ethereum-testnet": "Ethereum Testnet",
}

export const TIER_LABELS: Record<string, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
}

export const RISK_CHECK_DELAY_MS = 1200

export const SIMULATED_ONCHAIN_VARIANCE = 0.02
