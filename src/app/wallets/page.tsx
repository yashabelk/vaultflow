"use client"

import { useState } from "react"
import { AlertTriangle, Lock, LockOpen, Copy, Check } from "lucide-react"
import { useWalletStore } from "@/stores/useWalletStore"
import { useUserStore } from "@/stores/useUserStore"
import { useAuditStore } from "@/stores/useAuditStore"
import { useAlertStore } from "@/stores/useAlertStore"
import { TIER_LABELS, NETWORK_LABELS } from "@/lib/constants"
import type { WalletTier, WalletStatus, AssetSymbol, Wallet } from "@/types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBalance(amount: number, asset: AssetSymbol) {
  if (asset === "USDC" || asset === "USDT")
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  if (asset === "BTC") return amount.toFixed(4)
  if (asset === "ETH") return amount.toFixed(3)
  if (asset === "SOL") return amount.toFixed(2)
  return String(amount)
}

function truncateAddress(addr: string) {
  if (addr.startsWith("0x")) return `${addr.slice(0, 8)}…${addr.slice(-6)}`
  return `${addr.slice(0, 10)}…${addr.slice(-6)}`
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_BADGE: Record<WalletTier, string> = {
  hot:  "bg-red-100 text-red-700 border border-red-200",
  warm: "bg-amber-100 text-amber-700 border border-amber-200",
  cold: "bg-blue-100 text-blue-700 border border-blue-200",
}

const TIER_DOT: Record<WalletTier, string> = {
  hot:  "bg-red-500",
  warm: "bg-amber-500",
  cold: "bg-blue-500",
}

const STATUS_BADGE: Record<WalletStatus, string> = {
  active:       "bg-green-50 text-green-700 border border-green-200",
  frozen:       "bg-red-50 text-red-700 border border-red-200",
  under_review: "bg-amber-50 text-amber-700 border border-amber-200",
}

const STATUS_LABELS: Record<WalletStatus, string> = {
  active:       "Active",
  frozen:       "Frozen",
  under_review: "Under Review",
}

const TIER_FILTERS: { value: WalletTier | "all"; label: string }[] = [
  { value: "all",  label: "All" },
  { value: "hot",  label: "Hot" },
  { value: "warm", label: "Warm" },
  { value: "cold", label: "Cold" },
]

const STATUS_FILTERS: { value: WalletStatus | "all"; label: string }[] = [
  { value: "all",          label: "All statuses" },
  { value: "active",       label: "Active" },
  { value: "frozen",       label: "Frozen" },
  { value: "under_review", label: "Under Review" },
]

// ─── Address copy button ──────────────────────────────────────────────────────

function AddressCopy({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-slate-600 transition-colors group"
      title={address}
    >
      {truncateAddress(address)}
      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
      </span>
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WalletsPage() {
  const wallets        = useWalletStore((s) => s.wallets)
  const setWalletStatus = useWalletStore((s) => s.setWalletStatus)
  const currentUser    = useUserStore((s) => s.currentUser)
  const appendEvent    = useAuditStore((s) => s.appendEvent)
  const raiseAlert     = useAlertStore((s) => s.raiseAlert)

  const [tierFilter,   setTierFilter]   = useState<WalletTier | "all">("all")
  const [statusFilter, setStatusFilter] = useState<WalletStatus | "all">("all")

  const filtered = wallets.filter((w) => {
    if (tierFilter   !== "all" && w.tier   !== tierFilter)   return false
    if (statusFilter !== "all" && w.status !== statusFilter) return false
    return true
  })

  function handleFreeze(wallet: Wallet) {
    setWalletStatus(wallet.id, "frozen")
    appendEvent({
      actorId:    currentUser.id,
      actorRole:  currentUser.role,
      action:     "WALLET_FROZEN",
      entityType: "wallet",
      entityId:   wallet.id,
      details:    { reason: "Manual freeze by approver" },
    })
    raiseAlert({
      ruleId:     "WALLET_FROZEN",
      severity:   "warning",
      entityType: "wallet",
      entityId:   wallet.id,
      message:    `${wallet.name} frozen by ${currentUser.name}`,
    })
  }

  function handleUnfreeze(wallet: Wallet) {
    setWalletStatus(wallet.id, "active")
    appendEvent({
      actorId:    currentUser.id,
      actorRole:  currentUser.role,
      action:     "WALLET_UNFROZEN",
      entityType: "wallet",
      entityId:   wallet.id,
      details:    {},
    })
  }

  const isApprover = currentUser.role === "approver"

  return (
    <div className="p-8 min-h-full">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Wallets</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            {wallets.length} wallets across {[...new Set(wallets.map((w) => w.asset))].length} assets
          </p>
        </div>

        {/* Tier summary chips */}
        <div className="flex items-center gap-2">
          {(["hot", "warm", "cold"] as WalletTier[]).map((tier) => {
            const count = wallets.filter((w) => w.tier === tier).length
            return (
              <div key={tier} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px]">
                <span className={`w-1.5 h-1.5 rounded-full ${TIER_DOT[tier]}`} />
                <span className="text-slate-600 capitalize font-medium">{TIER_LABELS[tier]}</span>
                <span className="font-bold text-slate-900 font-mono">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        {/* Tier toggle */}
        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
          {TIER_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTierFilter(value)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                tierFilter === value
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Status select */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as WalletStatus | "all")}
          className="text-[12px] font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none hover:border-slate-300 focus:border-slate-400 transition-colors cursor-pointer"
        >
          {STATUS_FILTERS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {(tierFilter !== "all" || statusFilter !== "all") && (
          <button
            onClick={() => { setTierFilter("all"); setStatusFilter("all") }}
            className="text-[12px] text-slate-400 hover:text-slate-600 transition-colors"
          >
            Clear filters
          </button>
        )}

        <span className="text-[12px] text-slate-400 ml-auto">
          {filtered.length} of {wallets.length} wallets
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-[0.08em]">Wallet</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-[0.08em]">Tier</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-[0.08em]">Network</th>
              <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-[0.08em]">Balance</th>
              <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-[0.08em]">Available</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-[0.08em]">Status</th>
              {isApprover && (
                <th className="text-right px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-[0.08em]">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((wallet) => {
              const available     = wallet.balance - wallet.reservedBalance
              const belowReserve  = available < wallet.minReserve
              const isFrozen      = wallet.status === "frozen"
              const isUnderReview = wallet.status === "under_review"

              return (
                <tr
                  key={wallet.id}
                  className={`transition-colors ${
                    isFrozen ? "bg-red-50/40" : isUnderReview ? "bg-amber-50/30" : "hover:bg-slate-50/70"
                  }`}
                >
                  {/* Wallet name + address */}
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-slate-900">{wallet.name}</div>
                    <AddressCopy address={wallet.address} />
                  </td>

                  {/* Tier */}
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${TIER_BADGE[wallet.tier]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${TIER_DOT[wallet.tier]}`} />
                      {TIER_LABELS[wallet.tier]}
                    </span>
                  </td>

                  {/* Network */}
                  <td className="px-4 py-3.5 text-slate-600">
                    {NETWORK_LABELS[wallet.network]}
                  </td>

                  {/* Balance */}
                  <td className="px-4 py-3.5 text-right">
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatBalance(wallet.balance, wallet.asset)}
                    </span>
                    <span className="text-[11px] text-slate-400 ml-1">{wallet.asset}</span>
                  </td>

                  {/* Available */}
                  <td className="px-4 py-3.5 text-right">
                    <div className="inline-flex items-center gap-1.5 justify-end">
                      {belowReserve && (
                        <AlertTriangle size={12} className="text-amber-500 shrink-0" />
                      )}
                      <span className={`font-mono font-semibold tabular-nums ${belowReserve ? "text-amber-700" : "text-slate-700"}`}>
                        {formatBalance(available, wallet.asset)}
                      </span>
                      <span className="text-[11px] text-slate-400">{wallet.asset}</span>
                    </div>
                    {belowReserve && (
                      <div className="text-[10px] text-amber-600 mt-0.5 text-right">
                        min {formatBalance(wallet.minReserve, wallet.asset)}
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${STATUS_BADGE[wallet.status]}`}>
                      {STATUS_LABELS[wallet.status]}
                    </span>
                  </td>

                  {/* Actions */}
                  {isApprover && (
                    <td className="px-5 py-3.5 text-right">
                      {wallet.status === "frozen" ? (
                        <button
                          onClick={() => handleUnfreeze(wallet)}
                          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 border border-green-200 px-2.5 py-1 rounded-md transition-colors"
                        >
                          <LockOpen size={12} />
                          Unfreeze
                        </button>
                      ) : wallet.status === "active" ? (
                        <button
                          onClick={() => handleFreeze(wallet)}
                          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-md transition-colors"
                        >
                          <Lock size={12} />
                          Freeze
                        </button>
                      ) : (
                        <span className="text-[12px] text-slate-400">—</span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="px-5 py-12 text-center text-[13px] text-slate-400">
            No wallets match the current filters.
          </div>
        )}
      </div>
    </div>
  )
}
