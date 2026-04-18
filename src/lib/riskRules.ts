import type { Wallet, WithdrawalRequest, RiskCheckResult } from "@/types"
import { RISK_THRESHOLDS } from "@/lib/constants"

interface RiskContext {
  wallet: Wallet
  request: Pick<WithdrawalRequest, "amount" | "asset" | "network" | "toAddress" | "fromWalletId">
  hasPendingDuplicate: boolean
  hasOpenMismatchAlert: boolean
  hasAddressAppeared: boolean
}

function result(
  ruleId: string,
  ruleName: string,
  passed: boolean,
  severity: RiskCheckResult["severity"],
  message: string
): RiskCheckResult {
  return { ruleId, ruleName, passed, severity, message, checkedAt: new Date().toISOString() }
}

export function runRiskChecks(ctx: RiskContext): RiskCheckResult[] {
  const { wallet, request } = ctx
  const available = wallet.balance - wallet.reservedBalance
  const results: RiskCheckResult[] = []

  // R01 — Large Withdrawal Threshold
  const pct = request.amount / wallet.balance
  if (pct > RISK_THRESHOLDS.LARGE_WITHDRAWAL_BLOCK_PCT) {
    results.push(result("R01", "Large Withdrawal Threshold", false, "block",
      `Amount is ${(pct * 100).toFixed(0)}% of wallet balance — exceeds 50% block threshold`))
  } else if (pct > RISK_THRESHOLDS.LARGE_WITHDRAWAL_WARN_PCT) {
    results.push(result("R01", "Large Withdrawal Threshold", false, "warn",
      `Amount is ${(pct * 100).toFixed(0)}% of wallet balance — exceeds 25% review threshold`))
  } else {
    results.push(result("R01", "Large Withdrawal Threshold", true, "info", "Amount within normal threshold"))
  }

  // R02 — New Address Flag
  if (!ctx.hasAddressAppeared) {
    results.push(result("R02", "New Address Flag", false, "warn",
      "Unrecognized destination address — not seen in prior audit log"))
  } else {
    results.push(result("R02", "New Address Flag", true, "info", "Address recognized from prior transactions"))
  }

  // R03 — Network Mismatch
  if (wallet.network !== request.network) {
    results.push(result("R03", "Network Mismatch", false, "block",
      `Wallet is on ${wallet.network} but request specifies ${request.network}`))
  } else {
    results.push(result("R03", "Network Mismatch", true, "info", "Network matches wallet configuration"))
  }

  // R04 — Insufficient Balance
  if (request.amount > available) {
    results.push(result("R04", "Insufficient Balance", false, "block",
      `Available balance is ${available} ${wallet.asset} — insufficient for requested amount`))
  } else {
    results.push(result("R04", "Insufficient Balance", true, "info", "Sufficient available balance"))
  }

  // R05 — Frozen Wallet
  if (wallet.status === "frozen") {
    results.push(result("R05", "Frozen Wallet", false, "block",
      "Source wallet is frozen — no withdrawals permitted"))
  } else {
    results.push(result("R05", "Frozen Wallet", true, "info", "Wallet is active"))
  }

  // R06 — Hot Wallet Low Reserve
  if (wallet.tier === "hot") {
    const postBalance = wallet.balance - request.amount
    if (postBalance < wallet.minReserve) {
      results.push(result("R06", "Hot Wallet Low Reserve", false, "warn",
        `Post-withdrawal balance ${postBalance.toFixed(4)} ${wallet.asset} would breach minimum reserve of ${wallet.minReserve} ${wallet.asset}`))
    } else {
      results.push(result("R06", "Hot Wallet Low Reserve", true, "info", "Hot wallet reserve maintained"))
    }
  }

  // R07 — Reconciliation Mismatch Active
  if (ctx.hasOpenMismatchAlert) {
    results.push(result("R07", "Reconciliation Mismatch Active", false, "warn",
      "This wallet has an unresolved reconciliation mismatch — withdrawal should be reviewed"))
  }

  // R08 — Duplicate Request Detection
  if (ctx.hasPendingDuplicate) {
    results.push(result("R08", "Duplicate Request Detection", false, "warn",
      "An identical pending request already exists for this wallet, address, amount, and asset"))
  }

  return results
}

export function hasBlockingResult(results: RiskCheckResult[]): boolean {
  return results.some((r) => r.severity === "block" && !r.passed)
}

export function hasWarningResult(results: RiskCheckResult[]): boolean {
  return results.some((r) => r.severity === "warn" && !r.passed)
}
