"use client"

import { useState, useMemo } from "react"
import {
  ArrowUpRight, Shield, CheckCircle2, XCircle,
  Lock, RefreshCw, AlertTriangle, Bell,
  Search, type LucideIcon,
} from "lucide-react"
import { useAuditStore } from "@/stores/useAuditStore"
import { useUserStore } from "@/stores/useUserStore"
import type { AuditAction, UserRole } from "@/types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTs(ts: string) {
  const d = new Date(ts)
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`
}

// ─── Action metadata ──────────────────────────────────────────────────────────

interface ActionMeta { icon: LucideIcon; label: string; iconBg: string; iconColor: string; leftBorder: string }

const ACTION_META: Record<AuditAction, ActionMeta> = {
  WITHDRAWAL_REQUESTED: { icon: ArrowUpRight,  label: "Withdrawal Requested", iconBg: "bg-blue-50",    iconColor: "text-blue-600",    leftBorder: "border-l-blue-300"    },
  RISK_CHECK_RUN:       { icon: Shield,         label: "Risk Check Run",       iconBg: "bg-slate-100",  iconColor: "text-slate-400",   leftBorder: "border-l-slate-200"   },
  REQUEST_APPROVED:     { icon: CheckCircle2,   label: "Request Approved",     iconBg: "bg-green-50",   iconColor: "text-green-600",   leftBorder: "border-l-green-400"   },
  REQUEST_REJECTED:     { icon: XCircle,        label: "Request Rejected",     iconBg: "bg-red-50",     iconColor: "text-red-600",     leftBorder: "border-l-red-400"     },
  REQUEST_ESCALATED:    { icon: ArrowUpRight,   label: "Request Escalated",    iconBg: "bg-purple-50",  iconColor: "text-purple-600",  leftBorder: "border-l-purple-400"  },
  REQUEST_EXECUTED:     { icon: CheckCircle2,   label: "Request Executed",     iconBg: "bg-emerald-50", iconColor: "text-emerald-600", leftBorder: "border-l-emerald-400" },
  REQUEST_FAILED:       { icon: XCircle,        label: "Request Failed",       iconBg: "bg-red-50",     iconColor: "text-red-600",     leftBorder: "border-l-red-400"     },
  WALLET_FROZEN:        { icon: Lock,           label: "Wallet Frozen",        iconBg: "bg-red-50",     iconColor: "text-red-600",     leftBorder: "border-l-red-500"     },
  WALLET_UNFROZEN:      { icon: CheckCircle2,   label: "Wallet Unfrozen",      iconBg: "bg-green-50",   iconColor: "text-green-600",   leftBorder: "border-l-green-400"   },
  RECONCILIATION_RUN:   { icon: RefreshCw,      label: "Reconciliation Run",   iconBg: "bg-blue-50",    iconColor: "text-blue-600",    leftBorder: "border-l-blue-300"    },
  ALERT_RAISED:         { icon: AlertTriangle,  label: "Alert Raised",         iconBg: "bg-amber-50",   iconColor: "text-amber-600",   leftBorder: "border-l-amber-400"   },
  ALERT_ACKNOWLEDGED:   { icon: Bell,           label: "Alert Acknowledged",   iconBg: "bg-blue-50",    iconColor: "text-blue-500",    leftBorder: "border-l-blue-300"    },
  ALERT_RESOLVED:       { icon: CheckCircle2,   label: "Alert Resolved",       iconBg: "bg-green-50",   iconColor: "text-green-600",   leftBorder: "border-l-green-400"   },
}

const ACTION_GROUPS: { label: string; actions: AuditAction[] }[] = [
  { label: "Requests",       actions: ["WITHDRAWAL_REQUESTED","RISK_CHECK_RUN","REQUEST_APPROVED","REQUEST_REJECTED","REQUEST_ESCALATED","REQUEST_EXECUTED","REQUEST_FAILED"] },
  { label: "Wallets",        actions: ["WALLET_FROZEN","WALLET_UNFROZEN"] },
  { label: "Reconciliation", actions: ["RECONCILIATION_RUN"] },
  { label: "Alerts",         actions: ["ALERT_RAISED","ALERT_ACKNOWLEDGED","ALERT_RESOLVED"] },
]

const ROLE_LABELS: Record<UserRole, string> = {
  operator: "Operator",
  approver: "Approver",
  auditor:  "Auditor",
}

const PAGE_SIZE = 20

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const events      = useAuditStore((s) => s.events)
  const getUserById = useUserStore((s) => s.getUserById)

  const [search,       setSearch]       = useState("")
  const [actionFilter, setActionFilter] = useState<AuditAction | "all">("all")
  const [roleFilter,   setRoleFilter]   = useState<UserRole | "all">("all")
  const [page,         setPage]         = useState(1)
  const [expandedId,   setExpandedId]   = useState<string | null>(null)

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (actionFilter !== "all" && e.action !== actionFilter) return false
      if (roleFilter   !== "all" && e.actorRole !== roleFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const actor = getUserById(e.actorId)
        if (
          !e.id.toLowerCase().includes(q) &&
          !e.entityId.toLowerCase().includes(q) &&
          !e.action.toLowerCase().includes(q) &&
          !(actor?.name.toLowerCase().includes(q))
        ) return false
      }
      return true
    })
  }, [events, actionFilter, roleFilter, search, getUserById])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleFilterChange() { setPage(1) }

  return (
    <div className="p-8 min-h-full">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Audit Log</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">{events.length} events — append-only</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by ID, actor, entity…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); handleFilterChange() }}
            className="pl-8 pr-3 py-2 text-[12px] bg-white border border-slate-200 rounded-lg outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all w-56"
          />
        </div>

        {/* Action filter */}
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value as AuditAction | "all"); handleFilterChange() }}
          className="text-[12px] font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none hover:border-slate-300 cursor-pointer"
        >
          <option value="all">All actions</option>
          {ACTION_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.actions.map((a) => (
                <option key={a} value={a}>{ACTION_META[a].label}</option>
              ))}
            </optgroup>
          ))}
        </select>

        {/* Role filter */}
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value as UserRole | "all"); handleFilterChange() }}
          className="text-[12px] font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none hover:border-slate-300 cursor-pointer"
        >
          <option value="all">All roles</option>
          {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>

        {(search || actionFilter !== "all" || roleFilter !== "all") && (
          <button
            onClick={() => { setSearch(""); setActionFilter("all"); setRoleFilter("all"); setPage(1) }}
            className="text-[12px] text-slate-400 hover:text-slate-600 transition-colors"
          >
            Clear
          </button>
        )}

        <span className="text-[12px] text-slate-400 ml-auto font-mono">
          {filtered.length} event{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {pageItems.length === 0 ? (
          <div className="px-5 py-16 text-center text-[13px] text-slate-400">
            No events match the current filters.
          </div>
        ) : (
          <div>
            {pageItems.map((event, i) => {
              const meta     = ACTION_META[event.action]
              const Icon     = meta.icon
              const actor    = getUserById(event.actorId)
              const isLast   = i === pageItems.length - 1
              const isExpanded = expandedId === event.id
              const hasDetails = Object.keys(event.details).length > 0

              return (
                <div key={event.id} className={`border-l-[3px] ${meta.leftBorder} ${isLast ? "" : "border-b border-slate-100"}`}>
                  <div
                    className={`flex items-start gap-3 pl-4 pr-5 py-3 transition-colors ${hasDetails ? "cursor-pointer hover:bg-slate-50/60" : ""}`}
                    onClick={() => hasDetails && setExpandedId(isExpanded ? null : event.id)}
                  >
                    <div className={`w-[26px] h-[26px] rounded-md flex items-center justify-center shrink-0 mt-0.5 ${meta.iconBg}`}>
                      <Icon size={13} className={meta.iconColor} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 justify-between">
                        <span className="text-[13px] font-semibold text-slate-900 leading-none">
                          {meta.label}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 tabular-nums shrink-0">
                          {formatTs(event.timestamp)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[11px] text-slate-500">{actor?.name ?? event.actorId}</span>
                        <span className="text-slate-300">·</span>
                        <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                          event.actorRole === "operator" ? "bg-blue-50 text-blue-600 border-blue-200" :
                          event.actorRole === "approver" ? "bg-green-50 text-green-600 border-green-200" :
                                                           "bg-purple-50 text-purple-600 border-purple-200"
                        }`}>
                          {event.actorRole}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-[11px] font-mono text-slate-400">{event.entityId}</span>
                        {hasDetails && (
                          <span className="text-[10px] text-slate-300 ml-auto">
                            {isExpanded ? "▲ hide" : "▼ details"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && hasDetails && (
                    <div className="ml-[52px] mr-5 mb-3 bg-slate-50 rounded-lg border border-slate-100 px-4 py-3">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                        {Object.entries(event.details).map(([key, val]) => (
                          <div key={key} className="flex items-baseline gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide shrink-0 w-28">{key}</span>
                            <span className="text-[11px] font-mono text-slate-700 break-all">{String(val)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-[12px] text-slate-400 font-mono">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-[12px] font-medium bg-white border border-slate-200 rounded-lg disabled:opacity-40 hover:border-slate-300 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-[12px] font-medium bg-white border border-slate-200 rounded-lg disabled:opacity-40 hover:border-slate-300 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
