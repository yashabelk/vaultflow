"use client"

import { useState } from "react"
import { RefreshCw, CheckCircle2, AlertTriangle, Clock, ChevronDown, ChevronRight } from "lucide-react"
import { useWalletStore } from "@/stores/useWalletStore"
import { useReconciliationStore } from "@/stores/useReconciliationStore"
import { useAlertStore } from "@/stores/useAlertStore"
import { useAuditStore } from "@/stores/useAuditStore"
import { useUserStore } from "@/stores/useUserStore"
import { SIMULATED_ONCHAIN_VARIANCE } from "@/lib/constants"
import type { AssetSymbol, Wallet } from "@/types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBalance(n: number, asset: AssetSymbol) {
  if (asset === "USDC" || asset === "USDT")
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
  if (asset === "BTC") return n.toFixed(6)
  if (asset === "ETH") return n.toFixed(4)
  if (asset === "SOL") return n.toFixed(3)
  return String(n)
}

function formatTs(ts: string) {
  const d = new Date(ts)
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`
}

function simulateOnchain(wallet: Wallet): number {
  const seed = wallet.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
  // Only wallets where seed % 5 === 0 receive a simulated variance (~1 in 5).
  // All others return an exact match so the majority of wallets reconcile cleanly.
  if (seed % 5 !== 0) return wallet.balance
  const direction = seed % 2 === 0 ? 1 : -1
  const magnitude = (seed % 100) / 10000
  const capped    = Math.min(magnitude, SIMULATED_ONCHAIN_VARIANCE)
  return parseFloat((wallet.balance * (1 + direction * capped)).toFixed(8))
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReconciliationPage() {
  const wallets      = useWalletStore((s) => s.wallets)
  const addRecord    = useReconciliationStore((s) => s.addRecord)
  const records      = useReconciliationStore((s) => s.records)
  const getLatest    = useReconciliationStore((s) => s.getLatestForWallet)
  const raiseAlert   = useAlertStore((s) => s.raiseAlert)
  const hasOpenMismatch = useAlertStore((s) => s.hasOpenMismatchForWallet)
  const appendEvent  = useAuditStore((s) => s.appendEvent)
  const currentUser  = useUserStore((s) => s.currentUser)

  const [running,   setRunning]   = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [expanded,  setExpanded]  = useState<string | null>(null)

  async function runAll() {
    setRunning(true)
    for (const wallet of wallets) {
      setRunningId(wallet.id)
      await new Promise<void>((r) => setTimeout(r, 220))
      runSingle(wallet)
    }
    setRunningId(null)
    setRunning(false)
  }

  function runSingle(wallet: Wallet) {
    const onchain = simulateOnchain(wallet)
    const delta   = parseFloat((onchain - wallet.balance).toFixed(8))
    const status  = Math.abs(delta) < 0.000001 ? "matched" : "mismatch"

    const record = addRecord({
      runAt:           new Date().toISOString(),
      walletId:        wallet.id,
      internalBalance: wallet.balance,
      onchainBalance:  onchain,
      delta,
      status,
      notes: status === "matched" ? "" : `Delta of ${delta > 0 ? "+" : ""}${delta} ${wallet.asset} detected`,
    })

    appendEvent({
      actorId:    currentUser.id,
      actorRole:  currentUser.role,
      action:     "RECONCILIATION_RUN",
      entityType: "reconciliation",
      entityId:   record.id,
      details:    { walletId: wallet.id, delta, status },
    })

    if (status === "mismatch" && !hasOpenMismatch(wallet.id)) {
      raiseAlert({
        ruleId:     "RECON_MISMATCH",
        severity:   Math.abs(delta / wallet.balance) > 0.01 ? "critical" : "warning",
        entityType: "reconciliation",
        entityId:   wallet.id,
        message:    `Reconciliation mismatch on ${wallet.name}: internal ${formatBalance(wallet.balance, wallet.asset)} vs on-chain ${formatBalance(onchain, wallet.asset)} (Δ ${delta > 0 ? "+" : ""}${formatBalance(Math.abs(delta), wallet.asset)} ${wallet.asset})`,
      })
    }
  }

  // Latest record per wallet
  const latestByWallet = wallets.map((w) => ({
    wallet:  w,
    latest:  getLatest(w.id),
    running: runningId === w.id,
  }))

  const mismatchCount = latestByWallet.filter((x) => x.latest?.status === "mismatch").length
  const matchedCount  = latestByWallet.filter((x) => x.latest?.status === "matched").length
  const pendingCount  = latestByWallet.filter((x) => !x.latest).length

  // History: all records sorted by time desc
  const history = [...records].sort((a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime())

  return (
    <div className="p-8 min-h-full">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Reconciliation</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Compare internal balances against simulated on-chain values
          </p>
        </div>
        <button
          onClick={runAll}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-white shadow-sm transition-all"
        >
          <RefreshCw size={14} className={running ? "animate-spin" : ""} />
          {running ? "Running…" : "Run All Wallets"}
        </button>
      </div>

      {/* Summary chips */}
      <div className="flex items-center gap-3 mb-6">
        <SummaryChip icon={<CheckCircle2 size={13} className="text-green-500" />} label="Matched"      value={matchedCount} color="text-green-700" />
        <SummaryChip icon={<AlertTriangle size={13} className="text-red-500" />}  label="Mismatch"     value={mismatchCount} color={mismatchCount > 0 ? "text-red-700 font-bold" : "text-slate-700"} />
        <SummaryChip icon={<Clock size={13} className="text-slate-400" />}         label="Not yet run"  value={pendingCount}  color="text-slate-700" />
      </div>

      {/* Wallet status table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-3.5 border-b border-slate-200">
          <h2 className="text-[13px] font-bold text-slate-900">Wallet Status</h2>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em]">Wallet</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em]">Internal Balance</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em]">On-chain Balance</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em]">Delta</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em]">Status</th>
              <th className="text-right px-5 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em]">Last Run</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {latestByWallet.map(({ wallet, latest, running: isRunning }) => {
              const isMismatch = latest?.status === "mismatch"
              return (
                <tr
                  key={wallet.id}
                  className={`transition-colors ${isMismatch ? "bg-red-50/40" : isRunning ? "bg-amber-50/40" : "hover:bg-slate-50/60"}`}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {isRunning && <RefreshCw size={12} className="text-amber-500 animate-spin shrink-0" />}
                      <span className="font-semibold text-slate-900">{wallet.name}</span>
                      <span className="text-[11px] text-slate-400">{wallet.asset}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-slate-700 tabular-nums">
                    {latest ? formatBalance(latest.internalBalance, wallet.asset) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-slate-700 tabular-nums">
                    {latest ? formatBalance(latest.onchainBalance, wallet.asset) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {latest ? (
                      <span className={`font-mono font-semibold tabular-nums text-[12px] ${
                        latest.delta === 0 ? "text-green-600" :
                        Math.abs(latest.delta) > 0.001 * latest.internalBalance ? "text-red-600" : "text-amber-600"
                      }`}>
                        {latest.delta === 0 ? "0" : `${latest.delta > 0 ? "+" : ""}${formatBalance(latest.delta, wallet.asset)}`}
                      </span>
                    ) : <span className="text-slate-300 font-mono">—</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    {!latest ? (
                      <span className="text-[11px] text-slate-400 font-medium">Pending</span>
                    ) : latest.status === "matched" ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-md">
                        <CheckCircle2 size={11} /> Matched
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                        <AlertTriangle size={11} /> Mismatch
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right text-[11px] font-mono text-slate-400">
                    {latest ? formatTs(latest.runAt) : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* History */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setExpanded(expanded === "history" ? null : "history")}
          className="w-full flex items-center justify-between px-5 py-3.5 border-b border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <h2 className="text-[13px] font-bold text-slate-900">Run History</h2>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-mono">{history.length} records</span>
            {expanded === "history"
              ? <ChevronDown size={14} className="text-slate-400" />
              : <ChevronRight size={14} className="text-slate-400" />
            }
          </div>
        </button>

        {expanded === "history" && (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em]">Record</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em]">Wallet</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em]">Internal</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em]">On-chain</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em]">Delta</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em]">Status</th>
                <th className="text-right px-5 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em]">Run At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {history.slice(0, 30).map((rec) => {
                const wallet = wallets.find((w) => w.id === rec.walletId)
                return (
                  <tr key={rec.id} className={`${rec.status === "mismatch" ? "bg-red-50/30" : ""} hover:bg-slate-50/60 transition-colors`}>
                    <td className="px-5 py-2.5 font-mono text-slate-400">{rec.id}</td>
                    <td className="px-4 py-2.5 text-slate-600">{wallet?.name ?? rec.walletId}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                      {wallet ? formatBalance(rec.internalBalance, wallet.asset) : rec.internalBalance}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                      {wallet ? formatBalance(rec.onchainBalance, wallet.asset) : rec.onchainBalance}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                      <span className={rec.delta === 0 ? "text-green-600" : "text-red-600 font-semibold"}>
                        {rec.delta === 0 ? "0" : `${rec.delta > 0 ? "+" : ""}${wallet ? formatBalance(rec.delta, wallet.asset) : rec.delta}`}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                        rec.status === "matched"  ? "bg-green-50 text-green-700 border-green-200" :
                        rec.status === "mismatch" ? "bg-red-50 text-red-700 border-red-200" :
                                                    "bg-slate-100 text-slate-500 border-slate-200"
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-slate-400">{formatTs(rec.runAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function SummaryChip({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3.5 py-2 shadow-sm">
      {icon}
      <span className="text-[12px] text-slate-500">{label}</span>
      <span className={`text-[14px] font-bold font-mono ${color}`}>{value}</span>
    </div>
  )
}
