"use client"

import Link from "next/link"
import {
  Wallet,
  Clock,
  ShieldAlert,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ArrowUpRight,
  Shield,
  XCircle,
  Lock,
  RefreshCw,
  Bell,
  type LucideIcon,
} from "lucide-react"
import { useWalletStore } from "@/stores/useWalletStore"
import { useRequestStore } from "@/stores/useRequestStore"
import { useAlertStore } from "@/stores/useAlertStore"
import { useAuditStore } from "@/stores/useAuditStore"
import { useUserStore } from "@/stores/useUserStore"
import { TIER_LABELS } from "@/lib/constants"
import type { AuditAction, AlertSeverity } from "@/types"

const ACTION_LABELS: Record<AuditAction, string> = {
  WITHDRAWAL_REQUESTED: "Withdrawal Requested",
  RISK_CHECK_RUN: "Risk Check Run",
  REQUEST_APPROVED: "Request Approved",
  REQUEST_REJECTED: "Request Rejected",
  REQUEST_ESCALATED: "Request Escalated",
  REQUEST_EXECUTED: "Request Executed",
  REQUEST_FAILED: "Request Failed",
  WALLET_FROZEN: "Wallet Frozen",
  WALLET_UNFROZEN: "Wallet Unfrozen",
  RECONCILIATION_RUN: "Reconciliation Run",
  ALERT_RAISED: "Alert Raised",
  ALERT_ACKNOWLEDGED: "Alert Acknowledged",
  ALERT_RESOLVED: "Alert Resolved",
}

interface ActionMeta {
  icon: LucideIcon
  iconBg: string
  iconColor: string
  leftBorder: string
}

const ACTION_META: Record<AuditAction, ActionMeta> = {
  WITHDRAWAL_REQUESTED: { icon: ArrowUpRight,  iconBg: "bg-blue-50",    iconColor: "text-blue-600",    leftBorder: "border-l-blue-300"    },
  RISK_CHECK_RUN:       { icon: Shield,         iconBg: "bg-slate-100",  iconColor: "text-slate-400",   leftBorder: "border-l-slate-200"   },
  REQUEST_APPROVED:     { icon: CheckCircle2,   iconBg: "bg-green-50",   iconColor: "text-green-600",   leftBorder: "border-l-green-400"   },
  REQUEST_REJECTED:     { icon: XCircle,        iconBg: "bg-red-50",     iconColor: "text-red-600",     leftBorder: "border-l-red-400"     },
  REQUEST_ESCALATED:    { icon: ArrowUpRight,   iconBg: "bg-purple-50",  iconColor: "text-purple-600",  leftBorder: "border-l-purple-400"  },
  REQUEST_EXECUTED:     { icon: CheckCircle2,   iconBg: "bg-emerald-50", iconColor: "text-emerald-600", leftBorder: "border-l-emerald-400" },
  REQUEST_FAILED:       { icon: XCircle,        iconBg: "bg-red-50",     iconColor: "text-red-600",     leftBorder: "border-l-red-400"     },
  WALLET_FROZEN:        { icon: Lock,           iconBg: "bg-red-50",     iconColor: "text-red-600",     leftBorder: "border-l-red-500"     },
  WALLET_UNFROZEN:      { icon: CheckCircle2,   iconBg: "bg-green-50",   iconColor: "text-green-600",   leftBorder: "border-l-green-400"   },
  RECONCILIATION_RUN:   { icon: RefreshCw,      iconBg: "bg-blue-50",    iconColor: "text-blue-600",    leftBorder: "border-l-blue-300"    },
  ALERT_RAISED:         { icon: AlertTriangle,  iconBg: "bg-amber-50",   iconColor: "text-amber-600",   leftBorder: "border-l-amber-400"   },
  ALERT_ACKNOWLEDGED:   { icon: Bell,           iconBg: "bg-blue-50",    iconColor: "text-blue-500",    leftBorder: "border-l-blue-300"    },
  ALERT_RESOLVED:       { icon: CheckCircle2,   iconBg: "bg-green-50",   iconColor: "text-green-600",   leftBorder: "border-l-green-400"   },
}

const SEVERITY_META: Record<AlertSeverity, { rowCls: string; borderCls: string; labelCls: string; dotCls: string }> = {
  critical: {
    rowCls:    "bg-red-50 border-l-[3px] border-l-red-500",
    borderCls: "border-b-red-100",
    labelCls:  "text-red-700",
    dotCls:    "bg-red-500",
  },
  warning: {
    rowCls:    "bg-amber-50 border-l-[3px] border-l-amber-400",
    borderCls: "border-b-amber-100",
    labelCls:  "text-amber-700",
    dotCls:    "bg-amber-500",
  },
  info: {
    rowCls:    "border-l-[3px] border-l-blue-300",
    borderCls: "border-b-slate-100",
    labelCls:  "text-blue-600",
    dotCls:    "bg-blue-500",
  },
}

function formatTs(ts: string) {
  const d = new Date(ts)
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`
}

function formatUSD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export default function DashboardPage() {
  const wallets  = useWalletStore((s) => s.wallets)
  const requests = useRequestStore((s) => s.requests)
  const alerts   = useAlertStore((s) => s.alerts)
  const events   = useAuditStore((s) => s.events)
  const users    = useUserStore((s) => s.users)

  const pendingRequests = requests.filter((r) => r.status === "pending_review")
  const openAlerts      = alerts.filter((a) => a.status === "open")
  const criticalAlerts  = openAlerts.filter((a) => a.severity === "critical")

  const stablecoinAUM = wallets
    .filter((w) => w.asset === "USDC" || w.asset === "USDT")
    .reduce((sum, w) => sum + w.balance, 0)

  const tierCounts = {
    hot:  wallets.filter((w) => w.tier === "hot").length,
    warm: wallets.filter((w) => w.tier === "warm").length,
    cold: wallets.filter((w) => w.tier === "cold").length,
  }

  const frozenCount      = wallets.filter((w) => w.status === "frozen").length
  const underReviewCount = wallets.filter((w) => w.status === "under_review").length

  const recentEvents  = events.slice(0, 9)
  const getUserName   = (id: string) => users.find((u) => u.id === id)?.name ?? id

  const systemStatus =
    criticalAlerts.length > 0
      ? { label: `${criticalAlerts.length} critical alert${criticalAlerts.length > 1 ? "s" : ""}`,  cls: "border-red-300 bg-red-50 text-red-700 font-semibold",    dot: "bg-red-500 animate-pulse" }
      : openAlerts.length > 0
      ? { label: `${openAlerts.length} open alert${openAlerts.length > 1 ? "s" : ""}`,              cls: "border-amber-300 bg-amber-50 text-amber-700 font-semibold", dot: "bg-amber-500" }
      : { label: "All systems clear",                                                                cls: "border-green-200 bg-green-50 text-green-700",               dot: "bg-green-500" }

  return (
    <div className="p-8 min-h-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Operations overview</p>
        </div>
        <div className={`flex items-center gap-2 text-[12px] font-mono px-3.5 py-2 rounded-full border ${systemStatus.cls}`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${systemStatus.dot}`} />
          {systemStatus.label}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-7">
        <StatCard
          label="Total Wallets"
          value={wallets.length}
          sub={`${tierCounts.hot} hot · ${tierCounts.warm} warm · ${tierCounts.cold} cold`}
          icon={<Wallet size={15} className="text-slate-400" />}
          href="/wallets"
        />
        <StatCard
          label="Pending Approvals"
          value={pendingRequests.length}
          sub={pendingRequests.length === 0 ? "Queue is clear" : "Awaiting review"}
          icon={<Clock size={15} className={pendingRequests.length > 0 ? "text-amber-500" : "text-slate-400"} />}
          accent={pendingRequests.length > 0 ? "amber" : undefined}
          href="/approval-queue"
        />
        <StatCard
          label="Open Alerts"
          value={openAlerts.length}
          sub={criticalAlerts.length > 0 ? `${criticalAlerts.length} critical` : "No critical issues"}
          icon={<ShieldAlert size={15} className={criticalAlerts.length > 0 ? "text-red-500" : openAlerts.length > 0 ? "text-amber-500" : "text-slate-400"} />}
          accent={criticalAlerts.length > 0 ? "red" : openAlerts.length > 0 ? "amber" : undefined}
          href="/alerts"
        />
        <StatCard
          label="Stablecoin AUM"
          value={formatUSD(stablecoinAUM)}
          sub="USDC · Ethereum"
          icon={<TrendingUp size={15} className="text-slate-400" />}
          href="/wallets"
          mono={false}
        />
      </div>

      {/* Body */}
      <div className="grid grid-cols-5 gap-5">

        {/* Recent Activity */}
        <div className="col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
            <h2 className="text-[13px] font-bold text-slate-900">Recent Activity</h2>
            <Link href="/audit-log" className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 font-semibold transition-colors">
              View all <ArrowRight size={11} />
            </Link>
          </div>

          {recentEvents.map((event, i) => {
            const meta  = ACTION_META[event.action]
            const Icon  = meta.icon
            const isLast = i === recentEvents.length - 1
            return (
              <div
                key={event.id}
                className={`flex items-start gap-3 pl-4 pr-5 py-3 border-l-[3px] ${meta.leftBorder} ${isLast ? "" : "border-b border-slate-100"}`}
              >
                <div className={`w-[26px] h-[26px] rounded-md flex items-center justify-center shrink-0 mt-0.5 ${meta.iconBg}`}>
                  <Icon size={13} className={meta.iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-semibold text-slate-900 leading-none truncate">
                      {ACTION_LABELS[event.action]}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono tabular-nums shrink-0">
                      {formatTs(event.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-[11px] text-slate-500">{getUserName(event.actorId)}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-[11px] font-mono text-slate-400">{event.entityId}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Right column */}
        <div className="col-span-2 flex flex-col gap-5">

          {/* Open Alerts */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200">
              <h2 className="text-[13px] font-bold text-slate-900">Open Alerts</h2>
              <Link href="/alerts" className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 font-semibold transition-colors">
                View all <ArrowRight size={11} />
              </Link>
            </div>

            {openAlerts.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-5 text-[12px] text-slate-500">
                <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                No open alerts
              </div>
            ) : (
              <div>
                {openAlerts.slice(0, 4).map((alert, i) => {
                  const sev   = SEVERITY_META[alert.severity]
                  const isLast = i === Math.min(openAlerts.length, 4) - 1
                  return (
                    <div
                      key={alert.id}
                      className={`flex items-start gap-3 px-4 py-3.5 ${sev.rowCls} ${isLast ? "" : `border-b ${sev.borderCls}`}`}
                    >
                      <AlertTriangle size={14} className={`mt-0.5 shrink-0 ${sev.labelCls}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] text-slate-800 leading-relaxed line-clamp-2 font-medium">
                          {alert.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wide ${sev.labelCls}`}>
                            <span className={`w-1 h-1 rounded-full ${sev.dotCls}`} />
                            {alert.severity}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{formatTs(alert.triggeredAt)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {openAlerts.length > 4 && (
                  <div className="px-4 py-2.5 border-t border-slate-100">
                    <Link href="/alerts" className="text-[11px] text-slate-500 hover:text-amber-600 transition-colors">
                      +{openAlerts.length - 4} more alert{openAlerts.length - 4 > 1 ? "s" : ""}
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Wallet Tier Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-200">
              <h2 className="text-[13px] font-bold text-slate-900">Wallet Tiers</h2>
            </div>
            <div className="p-4 space-y-3">
              {(["hot", "warm", "cold"] as const).map((tier) => {
                const count    = tierCounts[tier]
                const pct      = (count / wallets.length) * 100
                const barColor = tier === "hot" ? "bg-red-400" : tier === "warm" ? "bg-amber-400" : "bg-blue-400"
                const dotColor = tier === "hot" ? "bg-red-400" : tier === "warm" ? "bg-amber-400" : "bg-blue-400"
                return (
                  <div key={tier} className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                    <span className="text-[12px] text-slate-700 font-medium flex-1 capitalize">{TIER_LABELS[tier]}</span>
                    <span className="text-[13px] font-mono font-bold text-slate-900 tabular-nums w-5 text-right">{count}</span>
                    <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}

              <div className="pt-3 mt-1 border-t border-slate-100 space-y-1.5">
                {frozenCount > 0 && (
                  <div className="flex items-center gap-2 text-[12px] font-medium text-red-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    {frozenCount} wallet{frozenCount > 1 ? "s" : ""} frozen
                  </div>
                )}
                {underReviewCount > 0 && (
                  <div className="flex items-center gap-2 text-[12px] font-medium text-amber-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    {underReviewCount} under review
                  </div>
                )}
                {frozenCount === 0 && underReviewCount === 0 && (
                  <div className="flex items-center gap-2 text-[12px] text-green-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                    All wallets active
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string | number
  sub: string
  icon: React.ReactNode
  accent?: "amber" | "red" | "green"
  href: string
  mono?: boolean
}

function StatCard({ label, value, sub, icon, accent, href, mono = true }: StatCardProps) {
  const cardBg = accent === "red"
    ? "bg-red-50 border-red-200"
    : accent === "amber"
    ? "bg-amber-50 border-amber-200"
    : "bg-white border-slate-200"

  const topBar = accent === "red"
    ? "bg-red-500"
    : accent === "amber"
    ? "bg-amber-500"
    : null

  const valueColor = accent === "red"
    ? "text-red-700"
    : accent === "amber"
    ? "text-amber-700"
    : "text-slate-900"

  const subColor = accent === "red"
    ? "text-red-600 font-semibold"
    : accent === "amber"
    ? "text-amber-700 font-semibold"
    : "text-slate-500"

  return (
    <Link href={href} className={`relative block rounded-xl border overflow-hidden p-5 shadow-sm hover:shadow-md transition-all duration-150 group ${cardBg}`}>
      {topBar && <div className={`absolute top-0 left-0 right-0 h-[3px] ${topBar}`} />}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.13em]">{label}</span>
        {icon}
      </div>
      <div className={`text-[42px] leading-none font-bold tabular-nums ${mono ? "font-mono" : ""} ${valueColor}`}>
        {value}
      </div>
      <p className={`text-[11.5px] mt-2.5 ${subColor}`}>{sub}</p>
    </Link>
  )
}
