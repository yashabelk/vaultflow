"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Info,
  Lock,
  Eye,
  ChevronRight,
  Ban,
} from "lucide-react"
import { useWalletStore } from "@/stores/useWalletStore"
import { useRequestStore } from "@/stores/useRequestStore"
import { useAlertStore } from "@/stores/useAlertStore"
import { useAuditStore } from "@/stores/useAuditStore"
import { useUserStore } from "@/stores/useUserStore"
import { runRiskChecks, hasBlockingResult, hasWarningResult } from "@/lib/riskRules"
import { RISK_CHECK_DELAY_MS, NETWORK_LABELS, TIER_LABELS } from "@/lib/constants"
import type { RiskCheckResult, Wallet, WithdrawalRequest } from "@/types"

type Stage = "idle" | "checking" | "done"

const RULE_DEFS = [
  { id: "R01", name: "Large Withdrawal Threshold" },
  { id: "R02", name: "New Address Flag" },
  { id: "R03", name: "Network Mismatch" },
  { id: "R04", name: "Insufficient Balance" },
  { id: "R05", name: "Frozen Wallet" },
  { id: "R06", name: "Hot Wallet Low Reserve" },
  { id: "R07", name: "Reconciliation Mismatch Active" },
  { id: "R08", name: "Duplicate Request Detection" },
]

function tierDot(tier: Wallet["tier"]) {
  if (tier === "hot") return "bg-red-400"
  if (tier === "warm") return "bg-amber-400"
  return "bg-blue-400"
}

function tierBadge(tier: Wallet["tier"]) {
  if (tier === "hot") return "bg-red-50 text-red-700 border-red-200"
  if (tier === "warm") return "bg-amber-50 text-amber-700 border-amber-200"
  return "bg-blue-50 text-blue-700 border-blue-200"
}

function statusBadge(status: Wallet["status"]) {
  if (status === "active") return "bg-green-50 text-green-700 border-green-200"
  if (status === "frozen") return "bg-red-50 text-red-700 border-red-200"
  return "bg-amber-50 text-amber-700 border-amber-200"
}

function statusLabel(status: Wallet["status"]) {
  if (status === "active") return "Active"
  if (status === "frozen") return "Frozen"
  return "Under Review"
}

function formatBalance(n: number, asset: string) {
  if (asset === "USDC" || asset === "USDT") {
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 8 })
}

function formatTs(ts: string) {
  const d = new Date(ts)
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`
}

export default function NewRequestPage() {
  const router = useRouter()
  const wallets      = useWalletStore((s) => s.wallets)
  const getWallet    = useWalletStore((s) => s.getWalletById)
  const addRequest   = useRequestStore((s) => s.addRequest)
  const setResults   = useRequestStore((s) => s.setRiskResults)
  const setStatus    = useRequestStore((s) => s.setStatus)
  const hasDuplicate = useRequestStore((s) => s.hasPendingDuplicate)
  const raiseAlert   = useAlertStore((s) => s.raiseAlert)
  const hasMismatch  = useAlertStore((s) => s.hasOpenMismatchForWallet)
  const appendEvent  = useAuditStore((s) => s.appendEvent)
  const hasAddress   = useAuditStore((s) => s.hasAddressAppeared)
  const currentUser  = useUserStore((s) => s.currentUser)

  const [stage, setStage]           = useState<Stage>("idle")
  const [fromWalletId, setFromWalletId] = useState("")
  const [amount, setAmount]         = useState("")
  const [toAddress, setToAddress]   = useState("")
  const [memo, setMemo]             = useState("")
  const [visibleRules, setVisibleRules] = useState(0)
  const [results, setResultsState]  = useState<RiskCheckResult[]>([])
  const [submittedReq, setSubmittedReq] = useState<WithdrawalRequest | null>(null)

  const wallet = fromWalletId ? getWallet(fromWalletId) : undefined
  const available = wallet ? wallet.balance - wallet.reservedBalance : 0

  const amountNum = parseFloat(amount) || 0
  const isFormComplete =
    fromWalletId !== "" &&
    amount !== "" &&
    amountNum > 0 &&
    toAddress.trim() !== ""

  // Group wallets by tier
  const byTier = {
    hot:  wallets.filter((w) => w.tier === "hot"),
    warm: wallets.filter((w) => w.tier === "warm"),
    cold: wallets.filter((w) => w.tier === "cold"),
  }

  async function handleSubmit() {
    if (!wallet || !isFormComplete) return

    setStage("checking")
    setVisibleRules(0)

    // Add request
    const req = addRequest({
      requesterId: currentUser.id,
      fromWalletId,
      toAddress: toAddress.trim(),
      asset: wallet.asset,
      network: wallet.network,
      amount: amountNum,
      memo: memo.trim(),
    })
    setSubmittedReq(req)

    appendEvent({
      actorId: currentUser.id,
      actorRole: currentUser.role,
      action: "WITHDRAWAL_REQUESTED",
      entityType: "request",
      entityId: req.id,
      details: {
        amount: amountNum,
        asset: wallet.asset,
        toAddress: toAddress.trim(),
        memo: memo.trim(),
        fromWalletId,
      },
    })

    // Animate rules appearing
    for (let i = 1; i <= RULE_DEFS.length; i++) {
      await new Promise<void>((res) =>
        setTimeout(res, (RISK_CHECK_DELAY_MS / RULE_DEFS.length) * i - (RISK_CHECK_DELAY_MS / RULE_DEFS.length) * (i - 1))
      )
      setVisibleRules(i)
    }

    await new Promise<void>((res) => setTimeout(res, 200))

    // Run risk checks
    const ctx = {
      wallet,
      request: {
        amount: amountNum,
        asset: wallet.asset,
        network: wallet.network,
        toAddress: toAddress.trim(),
        fromWalletId,
      },
      hasPendingDuplicate: hasDuplicate(fromWalletId, toAddress.trim(), amountNum, wallet.asset, req.id),
      hasOpenMismatchAlert: hasMismatch(fromWalletId),
      hasAddressAppeared: hasAddress(toAddress.trim()),
    }

    const riskResults = runRiskChecks(ctx)
    setResults(req.id, riskResults)
    setResultsState(riskResults)

    const blocked = hasBlockingResult(riskResults)

    appendEvent({
      actorId: currentUser.id,
      actorRole: currentUser.role,
      action: "RISK_CHECK_RUN",
      entityType: "request",
      entityId: req.id,
      details: {
        passed:  riskResults.filter((r) => r.passed).length,
        warned:  riskResults.filter((r) => !r.passed && r.severity === "warn").length,
        blocked: riskResults.filter((r) => !r.passed && r.severity === "block").length,
      },
    })

    if (blocked) {
      setStatus(req.id, "rejected_by_risk")
      raiseAlert({
        ruleId: riskResults.find((r) => !r.passed && r.severity === "block")?.ruleId ?? "RISK_BLOCK",
        severity: "critical",
        entityType: "request",
        entityId: req.id,
        message: `Withdrawal request ${req.id} auto-rejected by risk engine — blocking rule triggered on ${wallet.name}`,
      })
      appendEvent({
        actorId: currentUser.id,
        actorRole: currentUser.role,
        action: "REQUEST_REJECTED",
        entityType: "request",
        entityId: req.id,
        details: {
          reason: `Blocked by risk engine: ${riskResults.filter((r) => !r.passed && r.severity === "block").map((r) => r.ruleId).join(", ")}`,
        },
      })
    }

    setStage("done")
  }

  const isBlocked  = hasBlockingResult(results)
  const isWarned   = hasWarningResult(results)

  // ── Role guard ────────────────────────────────────────────────────────────
  if (currentUser.role !== "operator") {
    return (
      <div className="p-8 min-h-full">
        <div className="flex items-center gap-2 mb-7">
          <Link href="/" className="flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-700 transition-colors">
            <ArrowLeft size={14} />
            Dashboard
          </Link>
        </div>
        <div className="max-w-md mx-auto mt-16">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock size={20} className="text-slate-400" />
            </div>
            <h2 className="text-[15px] font-bold text-slate-900 mb-1.5">Access Restricted</h2>
            <p className="text-[13px] text-slate-500 mb-5">
              Only <span className="font-semibold text-slate-700">operators</span> can submit withdrawal requests.
              Switch your role in the sidebar to continue.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[13px] text-amber-600 hover:text-amber-700 font-semibold transition-colors"
            >
              <ArrowLeft size={13} /> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 min-h-full">

      {/* Header */}
      <div className="flex items-center gap-2 mb-1.5">
        <Link href="/" className="flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft size={14} />
          Dashboard
        </Link>
      </div>
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">New Withdrawal Request</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Submit a withdrawal for risk review and approval</p>
        </div>
        {submittedReq && (
          <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md">
            {submittedReq.id}
          </span>
        )}
      </div>

      {/* ── Stage: Idle (form) ─────────────────────────────────────────────── */}
      {stage === "idle" && (
        <div className="grid grid-cols-5 gap-5">

          {/* Form */}
          <div className="col-span-3">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200">
                <h2 className="text-[13px] font-bold text-slate-900">Request Details</h2>
              </div>

              <div className="p-5 space-y-5">

                {/* Source Wallet */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.1em] mb-1.5">
                    Source Wallet
                  </label>
                  <select
                    value={fromWalletId}
                    onChange={(e) => {
                      setFromWalletId(e.target.value)
                      setAmount("")
                    }}
                    className="w-full text-[13px] text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
                  >
                    <option value="">Select a wallet…</option>
                    {(["hot", "warm", "cold"] as const).map((tier) =>
                      byTier[tier].length > 0 ? (
                        <optgroup key={tier} label={`── ${TIER_LABELS[tier]} Wallets`}>
                          {byTier[tier].map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name} — {formatBalance(w.balance, w.asset)} {w.asset}
                              {w.status !== "active" ? ` [${statusLabel(w.status)}]` : ""}
                            </option>
                          ))}
                        </optgroup>
                      ) : null
                    )}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.1em] mb-1.5">
                    Amount
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={wallet ? `0.${"0".repeat(wallet.asset === "USDC" || wallet.asset === "USDT" ? 2 : 4)}` : "0.0000"}
                      disabled={!wallet}
                      className="w-full text-[13px] font-mono text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2.5 pr-16 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                    />
                    {wallet && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono font-bold text-slate-400 pointer-events-none">
                        {wallet.asset}
                      </span>
                    )}
                  </div>
                  {wallet && (
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[11px] text-slate-400">
                        Available: <span className="font-mono font-semibold text-slate-600">{formatBalance(available, wallet.asset)} {wallet.asset}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setAmount(available.toString())}
                        className="text-[11px] text-amber-600 hover:text-amber-700 font-semibold transition-colors"
                      >
                        Use max
                      </button>
                    </div>
                  )}
                </div>

                {/* Destination Address */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.1em] mb-1.5">
                    Destination Address
                  </label>
                  <input
                    type="text"
                    value={toAddress}
                    onChange={(e) => setToAddress(e.target.value)}
                    placeholder={
                      wallet?.network === "bitcoin"
                        ? "bc1q…"
                        : wallet?.network === "ethereum" || wallet?.network === "ethereum-testnet"
                        ? "0x…"
                        : wallet?.network === "solana"
                        ? "Solana address…"
                        : "Destination address…"
                    }
                    className="w-full text-[13px] font-mono text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all placeholder:font-sans placeholder:text-slate-300"
                  />
                </div>

                {/* Network (read-only) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.1em] mb-1.5">
                    Network
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    {wallet ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                        <span className="text-[13px] text-slate-700 font-medium">
                          {NETWORK_LABELS[wallet.network]}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 ml-auto">{wallet.network}</span>
                      </>
                    ) : (
                      <span className="text-[13px] text-slate-400">Derived from wallet</span>
                    )}
                  </div>
                </div>

                {/* Memo */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.1em] mb-1.5">
                    Memo <span className="text-slate-400 normal-case font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={memo}
                    onChange={(e) => setMemo(e.target.value.slice(0, 200))}
                    placeholder="Client ref, purpose, batch ID…"
                    rows={3}
                    className="w-full text-[13px] text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all resize-none placeholder:text-slate-300"
                  />
                  <p className="text-[11px] text-slate-400 text-right mt-1">{memo.length}/200</p>
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={!isFormComplete}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-[13px] font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed bg-amber-500 hover:bg-amber-600 text-white shadow-sm hover:shadow-md active:scale-[0.99]"
                >
                  <Shield size={14} />
                  Run Risk Checks
                  <ChevronRight size={13} className="ml-0.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Wallet info sidebar */}
          <div className="col-span-2">
            {wallet ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-5">
                <div className="px-5 py-3.5 border-b border-slate-200">
                  <h2 className="text-[13px] font-bold text-slate-900">Wallet Details</h2>
                </div>
                <div className="p-5 space-y-4">
                  {/* Wallet name + status */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${tierDot(wallet.tier)}`} />
                        <span className="text-[14px] font-bold text-slate-900 truncate">{wallet.name}</span>
                      </div>
                      <span className={`text-[10px] font-mono font-bold uppercase tracking-wide px-2 py-0.5 rounded border shrink-0 ${statusBadge(wallet.status)}`}>
                        {statusLabel(wallet.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${tierBadge(wallet.tier)}`}>
                        {TIER_LABELS[wallet.tier]}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">{NETWORK_LABELS[wallet.network]}</span>
                    </div>
                  </div>

                  {/* Balance breakdown */}
                  <div className="space-y-2.5 pt-1 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="text-[12px] text-slate-500">Total Balance</span>
                      <span className="text-[13px] font-mono font-bold text-slate-900 tabular-nums">
                        {formatBalance(wallet.balance, wallet.asset)} <span className="text-slate-400 font-normal">{wallet.asset}</span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[12px] text-slate-500">Reserved</span>
                      <span className="text-[13px] font-mono text-slate-500 tabular-nums">
                        −{formatBalance(wallet.reservedBalance, wallet.asset)} <span className="text-slate-400">{wallet.asset}</span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                      <span className="text-[12px] font-semibold text-slate-700">Available</span>
                      <span className={`text-[13px] font-mono font-bold tabular-nums ${available <= 0 ? "text-red-600" : "text-green-700"}`}>
                        {formatBalance(available, wallet.asset)} <span className="text-slate-400 font-normal">{wallet.asset}</span>
                      </span>
                    </div>
                    {wallet.tier === "hot" && (
                      <div className="flex justify-between items-center">
                        <span className="text-[12px] text-slate-500">Min Reserve</span>
                        <span className="text-[13px] font-mono text-slate-500 tabular-nums">
                          {formatBalance(wallet.minReserve, wallet.asset)} <span className="text-slate-400">{wallet.asset}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Request preview */}
                  {amountNum > 0 && (
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">After Withdrawal</p>
                      <div className="flex justify-between items-center">
                        <span className="text-[12px] text-slate-500">Remaining</span>
                        <span className={`text-[13px] font-mono font-bold tabular-nums ${available - amountNum < 0 ? "text-red-600" : "text-slate-700"}`}>
                          {formatBalance(Math.max(0, available - amountNum), wallet.asset)} {wallet.asset}
                        </span>
                      </div>
                      {wallet.tier === "hot" && (
                        <div className="flex justify-between items-center">
                          <span className="text-[12px] text-slate-500">Reserve status</span>
                          <span className={`text-[11px] font-semibold ${wallet.balance - amountNum < wallet.minReserve ? "text-red-600" : "text-green-600"}`}>
                            {wallet.balance - amountNum < wallet.minReserve ? "⚠ Below minimum" : "✓ Maintained"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Address */}
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em] mb-1.5">Wallet Address</p>
                    <p className="text-[11px] font-mono text-slate-600 break-all leading-relaxed">{wallet.address}</p>
                  </div>

                  {wallet.status !== "active" && (
                    <div className={`flex items-start gap-2 p-3 rounded-lg border text-[12px] ${wallet.status === "frozen" ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                      <span>
                        {wallet.status === "frozen"
                          ? "Wallet is frozen — risk check will block this request."
                          : "Wallet is under review — withdrawal may be flagged."}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center">
                  <Eye size={16} className="text-slate-300" />
                </div>
                <p className="text-[13px] text-slate-400">Select a wallet to preview details</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Stage: Checking ────────────────────────────────────────────────── */}
      {stage === "checking" && (
        <div className="max-w-xl mx-auto">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2.5">
              <Loader2 size={14} className="text-amber-500 animate-spin" />
              <h2 className="text-[13px] font-bold text-slate-900">Running Risk Checks…</h2>
            </div>
            <div className="p-5">
              <div className="space-y-2">
                {RULE_DEFS.map((rule, i) => {
                  const visible = i < visibleRules
                  const active  = i === visibleRules - 1
                  return (
                    <div
                      key={rule.id}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg border transition-all duration-300 ${
                        visible
                          ? active
                            ? "border-amber-200 bg-amber-50"
                            : "border-slate-100 bg-slate-50"
                          : "border-transparent bg-transparent opacity-0"
                      }`}
                    >
                      {visible ? (
                        active ? (
                          <Loader2 size={13} className="text-amber-500 animate-spin shrink-0" />
                        ) : (
                          <div className="w-[13px] h-[13px] shrink-0 flex items-center justify-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          </div>
                        )
                      ) : (
                        <div className="w-[13px] h-[13px] shrink-0" />
                      )}
                      <span className="text-[11px] font-mono font-bold text-slate-400">{rule.id}</span>
                      <span className={`text-[12px] transition-colors ${active ? "text-amber-700 font-medium" : "text-slate-500"}`}>
                        {rule.name}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-300"
                    style={{ width: `${(visibleRules / RULE_DEFS.length) * 100}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-2 text-right font-mono tabular-nums">
                  {visibleRules}/{RULE_DEFS.length} checks
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Stage: Done (results) ──────────────────────────────────────────── */}
      {stage === "done" && (
        <div className="max-w-xl mx-auto space-y-4">

          {/* Summary banner */}
          {isBlocked ? (
            <div className="flex items-start gap-3 px-4 py-3.5 bg-red-50 border border-red-200 rounded-xl">
              <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-bold text-red-700">Request Auto-Rejected — Risk Engine Blocked</p>
                <p className="text-[12px] text-red-600 mt-0.5">
                  One or more blocking rules failed. This request has been rejected automatically and an alert has been raised.
                </p>
              </div>
            </div>
          ) : isWarned ? (
            <div className="flex items-start gap-3 px-4 py-3.5 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-bold text-amber-700">Warnings Detected — Proceed with Caution</p>
                <p className="text-[12px] text-amber-600 mt-0.5">
                  This request has been queued for approval. Approvers will review the flagged items.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 px-4 py-3.5 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-bold text-green-700">All Checks Passed</p>
                <p className="text-[12px] text-green-600 mt-0.5">
                  No risk issues detected. Submit for approval to continue.
                </p>
              </div>
            </div>
          )}

          {/* Results card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-[13px] font-bold text-slate-900">Risk Check Results</h2>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="text-green-600 font-semibold">
                  {results.filter((r) => r.passed).length} passed
                </span>
                {results.filter((r) => !r.passed && r.severity === "warn").length > 0 && (
                  <span className="text-amber-600 font-semibold">
                    {results.filter((r) => !r.passed && r.severity === "warn").length} warn
                  </span>
                )}
                {results.filter((r) => !r.passed && r.severity === "block").length > 0 && (
                  <span className="text-red-600 font-semibold">
                    {results.filter((r) => !r.passed && r.severity === "block").length} blocked
                  </span>
                )}
              </div>
            </div>

            <div>
              {results.map((result, i) => {
                const isLast = i === results.length - 1
                const rowCls = result.passed
                  ? ""
                  : result.severity === "block"
                  ? "bg-red-50 border-l-[3px] border-l-red-400"
                  : result.severity === "warn"
                  ? "bg-amber-50 border-l-[3px] border-l-amber-400"
                  : ""

                return (
                  <div
                    key={result.ruleId}
                    className={`flex items-start gap-3 px-4 py-3 ${rowCls} ${isLast ? "" : "border-b border-slate-100"}`}
                  >
                    {result.passed ? (
                      <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />
                    ) : result.severity === "block" ? (
                      <Ban size={14} className="text-red-500 shrink-0 mt-0.5" />
                    ) : result.severity === "warn" ? (
                      <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    ) : (
                      <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-mono font-bold text-slate-400">{result.ruleId}</span>
                        <span className="text-[12px] font-semibold text-slate-700">{result.ruleName}</span>
                        <span className={`ml-auto text-[10px] font-mono font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${
                          result.passed
                            ? "bg-green-50 text-green-600"
                            : result.severity === "block"
                            ? "bg-red-50 text-red-600"
                            : result.severity === "warn"
                            ? "bg-amber-50 text-amber-600"
                            : "bg-slate-100 text-slate-500"
                        }`}>
                          {result.passed ? "pass" : result.severity}
                        </span>
                      </div>
                      <p className="text-[12px] text-slate-500 leading-relaxed">{result.message}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Request info footer */}
          {submittedReq && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <span className="text-slate-400">Request ID</span>
                  <p className="font-mono font-semibold text-slate-700 mt-0.5">{submittedReq.id}</p>
                </div>
                <div>
                  <span className="text-slate-400">Submitted</span>
                  <p className="font-mono text-slate-700 mt-0.5">{formatTs(submittedReq.createdAt)}</p>
                </div>
                <div>
                  <span className="text-slate-400">Amount</span>
                  <p className="font-mono font-semibold text-slate-700 mt-0.5">
                    {formatBalance(submittedReq.amount, submittedReq.asset)} {submittedReq.asset}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Status</span>
                  <p className={`font-mono font-semibold mt-0.5 ${isBlocked ? "text-red-600" : "text-amber-600"}`}>
                    {isBlocked ? "rejected_by_risk" : "pending_review"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setStage("idle")
                setFromWalletId("")
                setAmount("")
                setToAddress("")
                setMemo("")
                setResultsState([])
                setSubmittedReq(null)
              }}
              className="flex-1 py-2.5 px-4 rounded-lg text-[13px] font-semibold text-slate-600 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
            >
              New Request
            </button>

            {isBlocked ? (
              <button
                disabled
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-[13px] font-semibold bg-red-100 text-red-400 cursor-not-allowed border border-red-200"
              >
                <Ban size={13} />
                Rejected by Risk Engine
              </button>
            ) : (
              <button
                onClick={() => router.push("/approval-queue")}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-[13px] font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-sm hover:shadow-md transition-all active:scale-[0.99]"
              >
                Submit for Review
                <ChevronRight size={13} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
