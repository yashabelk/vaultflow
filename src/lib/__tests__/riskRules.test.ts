import { describe, it, expect } from "vitest"
import { runRiskChecks, hasBlockingResult, hasWarningResult } from "@/lib/riskRules"
import type { Wallet } from "@/types"

const baseWallet: Wallet = {
  id: "wlt_test",
  name: "Test Hot Wallet",
  tier: "hot",
  asset: "BTC",
  network: "bitcoin",
  balance: 10,
  reservedBalance: 1,
  address: "bc1qtest",
  status: "active",
  minReserve: 2,
  createdAt: "2025-01-01T00:00:00Z",
}

const baseRequest = {
  amount: 1,
  asset: "BTC" as const,
  network: "bitcoin" as const,
  toAddress: "bc1qknown",
  fromWalletId: "wlt_test",
}

const baseCtx = {
  wallet: baseWallet,
  request: baseRequest,
  hasPendingDuplicate: false,
  hasOpenMismatchAlert: false,
  hasAddressAppeared: true,
}

describe("R01 — Large Withdrawal Threshold", () => {
  it("passes when amount is under 25% of balance", () => {
    const results = runRiskChecks({ ...baseCtx, request: { ...baseRequest, amount: 2 } })
    const r01 = results.find((r) => r.ruleId === "R01")!
    expect(r01.passed).toBe(true)
  })

  it("warns when amount is between 25% and 50%", () => {
    const results = runRiskChecks({ ...baseCtx, request: { ...baseRequest, amount: 3 } })
    const r01 = results.find((r) => r.ruleId === "R01")!
    expect(r01.passed).toBe(false)
    expect(r01.severity).toBe("warn")
  })

  it("blocks when amount exceeds 50% of balance", () => {
    const results = runRiskChecks({ ...baseCtx, request: { ...baseRequest, amount: 6 } })
    const r01 = results.find((r) => r.ruleId === "R01")!
    expect(r01.passed).toBe(false)
    expect(r01.severity).toBe("block")
  })
})

describe("R03 — Network Mismatch", () => {
  it("blocks when wallet network does not match request network", () => {
    const results = runRiskChecks({
      ...baseCtx,
      request: { ...baseRequest, network: "ethereum" },
    })
    const r03 = results.find((r) => r.ruleId === "R03")!
    expect(r03.passed).toBe(false)
    expect(r03.severity).toBe("block")
  })
})

describe("R04 — Insufficient Balance", () => {
  it("blocks when amount exceeds available balance", () => {
    const results = runRiskChecks({
      ...baseCtx,
      request: { ...baseRequest, amount: 9.5 },
    })
    const r04 = results.find((r) => r.ruleId === "R04")!
    expect(r04.passed).toBe(false)
    expect(r04.severity).toBe("block")
  })
})

describe("R05 — Frozen Wallet", () => {
  it("blocks withdrawal from a frozen wallet", () => {
    const results = runRiskChecks({
      ...baseCtx,
      wallet: { ...baseWallet, status: "frozen" },
    })
    const r05 = results.find((r) => r.ruleId === "R05")!
    expect(r05.passed).toBe(false)
    expect(r05.severity).toBe("block")
  })
})

describe("R06 — Hot Wallet Low Reserve", () => {
  it("warns when post-withdrawal balance breaches min reserve", () => {
    const results = runRiskChecks({
      ...baseCtx,
      request: { ...baseRequest, amount: 8.5 },
    })
    const r06 = results.find((r) => r.ruleId === "R06")!
    expect(r06.passed).toBe(false)
    expect(r06.severity).toBe("warn")
  })

  it("does not run for non-hot wallets", () => {
    const results = runRiskChecks({
      ...baseCtx,
      wallet: { ...baseWallet, tier: "cold" },
    })
    expect(results.find((r) => r.ruleId === "R06")).toBeUndefined()
  })
})

describe("hasBlockingResult / hasWarningResult", () => {
  it("detects blocking results correctly", () => {
    const results = runRiskChecks({
      ...baseCtx,
      wallet: { ...baseWallet, status: "frozen" },
    })
    expect(hasBlockingResult(results)).toBe(true)
  })

  it("returns false when all rules pass", () => {
    const results = runRiskChecks(baseCtx)
    expect(hasBlockingResult(results)).toBe(false)
    expect(hasWarningResult(results)).toBe(false)
  })
})
