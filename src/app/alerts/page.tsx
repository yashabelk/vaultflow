"use client"

import { useState } from "react"
import { AlertTriangle, CheckCircle2, Bell, Lock, MessageSquare, Info } from "lucide-react"
import { useAlertStore } from "@/stores/useAlertStore"
import { useUserStore } from "@/stores/useUserStore"
import { useAuditStore } from "@/stores/useAuditStore"
import { useWalletStore } from "@/stores/useWalletStore"
import { useRequestStore } from "@/stores/useRequestStore"
import type { AlertSeverity, AlertStatus } from "@/types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTs(ts: string) {
  const d = new Date(ts)
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const SEV_META: Record<AlertSeverity, { icon: typeof AlertTriangle; iconColor: string; badge: string; leftBorder: string; rowBg: string }> = {
  critical: { icon: AlertTriangle, iconColor: "text-red-500",    badge: "bg-red-50 text-red-700 border-red-200",      leftBorder: "border-l-red-500",    rowBg: "bg-red-50/30"    },
  warning:  { icon: AlertTriangle, iconColor: "text-amber-500",  badge: "bg-amber-50 text-amber-700 border-amber-200", leftBorder: "border-l-amber-400",  rowBg: "bg-amber-50/20"  },
  info:     { icon: Info,          iconColor: "text-blue-500",   badge: "bg-blue-50 text-blue-700 border-blue-200",    leftBorder: "border-l-blue-300",   rowBg: ""                },
}

const STATUS_BADGE: Record<AlertStatus, string> = {
  open:         "bg-slate-900 text-white border-slate-900",
  acknowledged: "bg-blue-50 text-blue-700 border-blue-200",
  resolved:     "bg-green-50 text-green-700 border-green-200",
}

const STATUS_LABELS: Record<AlertStatus, string> = {
  open:         "Open",
  acknowledged: "Acknowledged",
  resolved:     "Resolved",
}

const STATUS_FILTERS: { value: AlertStatus | "all"; label: string }[] = [
  { value: "all",          label: "All" },
  { value: "open",         label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "resolved",     label: "Resolved" },
]

const SEV_FILTERS: { value: AlertSeverity | "all"; label: string }[] = [
  { value: "all",      label: "All severities" },
  { value: "critical", label: "Critical" },
  { value: "warning",  label: "Warning" },
  { value: "info",     label: "Info" },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const alerts           = useAlertStore((s) => s.alerts)
  const updateAlertStatus = useAlertStore((s) => s.updateAlertStatus)
  const currentUser      = useUserStore((s) => s.currentUser)
  const appendEvent      = useAuditStore((s) => s.appendEvent)
  const getWallet        = useWalletStore((s) => s.getWalletById)
  const getRequest       = useRequestStore((s) => s.getRequestById)

  const [statusFilter, setStatusFilter] = useState<AlertStatus | "all">("all")
  const [sevFilter,    setSevFilter]    = useState<AlertSeverity | "all">("all")
  const [confirmId,    setConfirmId]    = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<"acknowledge" | "resolve" | null>(null)
  const [resolveNote,  setResolveNote]  = useState("")

  const filtered = alerts
    .filter((a) => statusFilter === "all" || a.status === statusFilter)
    .filter((a) => sevFilter    === "all" || a.severity === sevFilter)
    .sort((a, b) => {
      const sOrder = { open: 0, acknowledged: 1, resolved: 2 }
      if (sOrder[a.status] !== sOrder[b.status]) return sOrder[a.status] - sOrder[b.status]
      const sevOrder = { critical: 0, warning: 1, info: 2 }
      if (sevOrder[a.severity] !== sevOrder[b.severity]) return sevOrder[a.severity] - sevOrder[b.severity]
      return new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
    })

  const openCount   = alerts.filter((a) => a.status === "open").length
  const ackCount    = alerts.filter((a) => a.status === "acknowledged").length
  const critCount   = alerts.filter((a) => a.status === "open" && a.severity === "critical").length

  const isApprover  = currentUser.role === "approver"

  function startAction(id: string, action: "acknowledge" | "resolve") {
    setConfirmId(id)
    setConfirmAction(action)
    setResolveNote("")
  }

  function cancelAction() {
    setConfirmId(null)
    setConfirmAction(null)
    setResolveNote("")
  }

  function confirmAcknowledge(alertId: string) {
    updateAlertStatus(alertId, "acknowledged", currentUser.id)
    appendEvent({
      actorId: currentUser.id, actorRole: currentUser.role,
      action: "ALERT_ACKNOWLEDGED", entityType: "alert", entityId: alertId,
      details: {},
    })
    cancelAction()
  }

  function confirmResolve(alertId: string) {
    updateAlertStatus(alertId, "resolved", currentUser.id, resolveNote)
    appendEvent({
      actorId: currentUser.id, actorRole: currentUser.role,
      action: "ALERT_RESOLVED", entityType: "alert", entityId: alertId,
      details: { note: resolveNote },
    })
    cancelAction()
  }

  function getEntityLabel(entityType: string, entityId: string) {
    if (entityType === "wallet") {
      return getWallet(entityId)?.name ?? entityId
    }
    if (entityType === "request") {
      const req = getRequest(entityId)
      return req ? `${req.id} (${req.amount} ${req.asset})` : entityId
    }
    return entityId
  }

  return (
    <div className="p-8 min-h-full">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Alerts</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">{alerts.length} total alerts</p>
        </div>

        {/* Summary chips */}
        <div className="flex items-center gap-2">
          {critCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[12px] font-bold text-red-700">{critCount} critical</span>
            </div>
          )}
          {openCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm">
              <Bell size={12} className="text-slate-500" />
              <span className="text-[12px] font-semibold text-slate-700">{openCount} open</span>
            </div>
          )}
          {ackCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm">
              <span className="text-[12px] text-slate-500">{ackCount} acknowledged</span>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                statusFilter === value
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          value={sevFilter}
          onChange={(e) => setSevFilter(e.target.value as AlertSeverity | "all")}
          className="text-[12px] font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none hover:border-slate-300 cursor-pointer"
        >
          {SEV_FILTERS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <span className="text-[12px] text-slate-400 ml-auto font-mono">
          {filtered.length} of {alerts.length} alerts
        </span>
      </div>

      {/* Alert list */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-5 py-16 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 size={28} className="text-green-400" />
            <p className="text-[13px] text-slate-400">No alerts match the current filters.</p>
          </div>
        ) : (
          <div>
            {filtered.map((alert, i) => {
              const sev      = SEV_META[alert.severity]
              const Icon     = sev.icon
              const isLast   = i === filtered.length - 1
              const isActive = confirmId === alert.id

              return (
                <div
                  key={alert.id}
                  className={`border-l-[3px] ${sev.leftBorder} ${sev.rowBg} ${isLast ? "" : "border-b border-slate-100"}`}
                >
                  <div className="flex items-start gap-4 px-5 py-4">
                    <Icon size={15} className={`${sev.iconColor} shrink-0 mt-0.5`} />

                    <div className="flex-1 min-w-0">
                      {/* Message */}
                      <p className="text-[13px] font-medium text-slate-900 leading-relaxed mb-2">
                        {alert.message}
                      </p>

                      {/* Meta row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${sev.badge}`}>
                          {alert.severity}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${STATUS_BADGE[alert.status]}`}>
                          {STATUS_LABELS[alert.status]}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-[11px] text-slate-500 capitalize">{alert.entityType}</span>
                        <span className="text-[11px] font-mono text-slate-400">{getEntityLabel(alert.entityType, alert.entityId)}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-[11px] font-mono text-slate-400">{formatTs(alert.triggeredAt)}</span>
                      </div>

                      {/* Resolve note */}
                      {alert.status === "resolved" && alert.resolvedNote && (
                        <div className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500">
                          <MessageSquare size={11} className="shrink-0 mt-0.5 text-slate-400" />
                          <span>{alert.resolvedNote}</span>
                        </div>
                      )}

                      {/* Inline confirm form */}
                      {isActive && confirmAction && (
                        <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200">
                          {confirmAction === "resolve" && (
                            <>
                              <p className="text-[11px] font-semibold text-slate-600 mb-2">
                                Resolution note <span className="font-normal text-slate-400">(optional)</span>
                              </p>
                              <textarea
                                value={resolveNote}
                                onChange={(e) => setResolveNote(e.target.value)}
                                placeholder="Describe resolution or corrective action…"
                                rows={2}
                                className="w-full text-[12px] text-slate-900 bg-white border border-slate-200 rounded-md px-3 py-2 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all resize-none mb-2"
                              />
                            </>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => confirmAction === "acknowledge" ? confirmAcknowledge(alert.id) : confirmResolve(alert.id)}
                              className={`px-3 py-1.5 rounded-md text-[12px] font-semibold text-white transition-all ${
                                confirmAction === "acknowledge" ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"
                              }`}
                            >
                              {confirmAction === "acknowledge" ? "Confirm Acknowledge" : "Confirm Resolve"}
                            </button>
                            <button
                              onClick={cancelAction}
                              className="px-3 py-1.5 rounded-md text-[12px] font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {isApprover && alert.status !== "resolved" && !isActive && (
                      <div className="flex items-center gap-2 shrink-0">
                        {alert.status === "open" && (
                          <button
                            onClick={() => startAction(alert.id, "acknowledge")}
                            className="px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
                          >
                            Acknowledge
                          </button>
                        )}
                        <button
                          onClick={() => startAction(alert.id, "resolve")}
                          className="px-2.5 py-1.5 text-[11px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-md transition-colors"
                        >
                          Resolve
                        </button>
                      </div>
                    )}

                    {!isApprover && alert.status !== "resolved" && (
                      <div className="shrink-0">
                        <Lock size={12} className="text-slate-300" />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
