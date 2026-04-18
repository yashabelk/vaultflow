"use client"

import { useState } from "react"
import {
  CheckCircle2, XCircle, AlertTriangle, Clock,
  Info, Ban, ArrowUpRight, Lock, MessageSquare,
} from "lucide-react"
import { useRequestStore } from "@/stores/useRequestStore"
import { useWalletStore } from "@/stores/useWalletStore"
import { useUserStore } from "@/stores/useUserStore"
import { useAuditStore } from "@/stores/useAuditStore"
import { NETWORK_LABELS, TIER_LABELS } from "@/lib/constants"
import type {
  WithdrawalRequest, ApprovalEvent, Wallet, User,
  AssetSymbol, RequestStatus,
} from "@/types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBalance(n: number, asset: AssetSymbol) {
  if (asset === "USDC" || asset === "USDT")
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
  if (asset === "BTC") return n.toFixed(4)
  if (asset === "ETH") return n.toFixed(3)
  if (asset === "SOL") return n.toFixed(2)
  return String(n)
}

function truncateAddress(addr: string) {
  if (addr.startsWith("0x")) return `${addr.slice(0, 10)}…${addr.slice(-6)}`
  return `${addr.slice(0, 12)}…${addr.slice(-6)}`
}

function formatTs(ts: string) {
  const d = new Date(ts)
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`
}

// ─── Status + risk styling maps ───────────────────────────────────────────────

const STATUS_META: Record<RequestStatus, { label: string; cls: string; leftBorder: string }> = {
  pending_review:   { label: "Pending Review",   cls: "bg-amber-50 text-amber-700 border-amber-200",   leftBorder: "border-l-amber-400"   },
  escalated:        { label: "Escalated",         cls: "bg-purple-50 text-purple-700 border-purple-200", leftBorder: "border-l-purple-500"  },
  approved:         { label: "Approved",          cls: "bg-green-50 text-green-700 border-green-200",    leftBorder: "border-l-green-400"   },
  rejected:         { label: "Rejected",          cls: "bg-slate-100 text-slate-500 border-slate-200",   leftBorder: "border-l-slate-300"   },
  rejected_by_risk: { label: "Rejected by Risk",  cls: "bg-red-50 text-red-700 border-red-200",         leftBorder: "border-l-red-400"     },
  executed:         { label: "Executed",          cls: "bg-emerald-50 text-emerald-700 border-emerald-200", leftBorder: "border-l-emerald-400" },
  failed:           { label: "Failed",            cls: "bg-red-50 text-red-700 border-red-200",         leftBorder: "border-l-red-400"     },
}

const TIER_DOT: Record<string, string> = {
  hot: "bg-red-400", warm: "bg-amber-400", cold: "bg-blue-400",
}

const ACTION_META = {
  approve:  { label: "Approve",  confirmLabel: "Confirm Approval",  cls: "bg-green-600 hover:bg-green-700 text-white",  border: "border-green-200 bg-green-50" },
  reject:   { label: "Reject",   confirmLabel: "Confirm Rejection", cls: "bg-red-600 hover:bg-red-700 text-white",      border: "border-red-200 bg-red-50"     },
  escalate: { label: "Escalate", confirmLabel: "Confirm Escalation",cls: "bg-purple-600 hover:bg-purple-700 text-white",border: "border-purple-200 bg-purple-50"},
}

// ─── Request list card ────────────────────────────────────────────────────────

function RequestCard({
  req, walletName, requesterName, isSelected, onClick,
}: {
  req: WithdrawalRequest
  walletName: string
  requesterName: string
  isSelected: boolean
  onClick: () => void
}) {
  const meta       = STATUS_META[req.status]
  const blockCount = req.riskCheckResults.filter((r) => !r.passed && r.severity === "block").length
  const warnCount  = req.riskCheckResults.filter((r) => !r.passed && r.severity === "warn").length
  const passCount  = req.riskCheckResults.filter((r) => r.passed).length

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border overflow-hidden shadow-sm transition-all duration-150 border-l-[3px] ${meta.leftBorder} ${
        isSelected
          ? "bg-white border-slate-300 ring-2 ring-amber-300/60"
          : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md"
      }`}
    >
      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-mono text-slate-400">{req.id}</span>
          <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${meta.cls}`}>
            {meta.label}
          </span>
        </div>

        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-[22px] font-bold font-mono text-slate-900 tabular-nums leading-none">
            {formatBalance(req.amount, req.asset)}
          </span>
          <span className="text-[13px] font-semibold text-slate-400">{req.asset}</span>
        </div>

        <p className="text-[12px] text-slate-500 mb-3">
          {walletName}
          <span className="text-slate-300 mx-1.5">·</span>
          {requesterName}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] font-mono">
            {req.riskCheckResults.length === 0
              ? <span className="text-slate-300">no checks run</span>
              : <>
                  {passCount > 0  && <span className="text-green-600">{passCount} pass</span>}
                  {warnCount > 0  && <span className="text-amber-600">{warnCount} warn</span>}
                  {blockCount > 0 && <span className="text-red-600 font-bold">{blockCount} block</span>}
                </>
            }
          </div>
          <span className="text-[11px] text-slate-400 font-mono">{formatTs(req.createdAt)}</span>
        </div>
      </div>
    </button>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  request, wallet, requester, approvalHistory, getUserById,
  canAct, isApprover,
  confirmAction, setConfirmAction, notes, setNotes,
  onApprove, onReject, onEscalate,
}: {
  request: WithdrawalRequest
  wallet: Wallet | undefined
  requester: User | undefined
  approvalHistory: ApprovalEvent[]
  getUserById: (id: string) => User | undefined
  canAct: boolean
  isApprover: boolean
  confirmAction: "approve" | "reject" | "escalate" | null
  setConfirmAction: (a: "approve" | "reject" | "escalate" | null) => void
  notes: string
  setNotes: (n: string) => void
  onApprove: () => void
  onReject: () => void
  onEscalate: () => void
}) {
  const meta      = STATUS_META[request.status]
  const isBlocked = request.riskCheckResults.some((r) => !r.passed && r.severity === "block")
  const isWarned  = request.riskCheckResults.some((r) => !r.passed && r.severity === "warn")

  const actionHandlers = { approve: onApprove, reject: onReject, escalate: onEscalate }

  return (
    <div className="col-span-3 space-y-4">

      {/* Request header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-[13px] font-bold text-slate-900">Request Details</h2>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{request.id}</span>
          </div>
          <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${meta.cls}`}>
            {meta.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-px bg-slate-100">
          {/* Left col */}
          <div className="bg-white p-5 space-y-4">
            <Field label="Requester">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                  {requester?.initials ?? "?"}
                </div>
                <span className="text-[13px] font-semibold text-slate-900">{requester?.name ?? request.requesterId}</span>
                <span className="text-[11px] text-slate-400 capitalize">({requester?.role})</span>
              </div>
            </Field>

            <Field label="Source Wallet">
              {wallet ? (
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${TIER_DOT[wallet.tier] ?? "bg-slate-400"}`} />
                  <span className="text-[13px] font-semibold text-slate-900">{wallet.name}</span>
                  <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">
                    {TIER_LABELS[wallet.tier]}
                  </span>
                </div>
              ) : (
                <span className="text-[13px] font-mono text-slate-500">{request.fromWalletId}</span>
              )}
            </Field>

            <Field label="Network">
              <span className="text-[13px] text-slate-700">{NETWORK_LABELS[request.network] ?? request.network}</span>
            </Field>

            <Field label="Submitted">
              <span className="text-[13px] font-mono text-slate-700">{formatTs(request.createdAt)}</span>
            </Field>
          </div>

          {/* Right col */}
          <div className="bg-white p-5 space-y-4">
            <Field label="Amount">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[20px] font-bold font-mono text-slate-900 tabular-nums leading-none">
                  {formatBalance(request.amount, request.asset)}
                </span>
                <span className="text-[13px] font-semibold text-slate-400">{request.asset}</span>
              </div>
            </Field>

            <Field label="Destination">
              <span className="text-[12px] font-mono text-slate-700 break-all leading-relaxed">
                {request.toAddress}
              </span>
            </Field>

            {request.memo && (
              <Field label="Memo">
                <p className="text-[13px] text-slate-700 leading-relaxed">{request.memo}</p>
              </Field>
            )}
          </div>
        </div>
      </div>

      {/* Risk check results */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-[13px] font-bold text-slate-900">Risk Check Results</h2>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            {request.riskCheckResults.filter((r) => r.passed).length > 0 && (
              <span className="text-green-600 font-semibold">
                {request.riskCheckResults.filter((r) => r.passed).length} passed
              </span>
            )}
            {request.riskCheckResults.filter((r) => !r.passed && r.severity === "warn").length > 0 && (
              <span className="text-amber-600 font-semibold">
                {request.riskCheckResults.filter((r) => !r.passed && r.severity === "warn").length} warn
              </span>
            )}
            {request.riskCheckResults.filter((r) => !r.passed && r.severity === "block").length > 0 && (
              <span className="text-red-600 font-semibold">
                {request.riskCheckResults.filter((r) => !r.passed && r.severity === "block").length} blocked
              </span>
            )}
          </div>
        </div>

        {request.riskCheckResults.length === 0 ? (
          <p className="px-5 py-5 text-[13px] text-slate-400">No risk checks have been run for this request.</p>
        ) : (
          <div>
            {request.riskCheckResults.map((result, i) => {
              const isLast = i === request.riskCheckResults.length - 1
              const rowCls = result.passed
                ? ""
                : result.severity === "block"
                ? "bg-red-50 border-l-[3px] border-l-red-400"
                : result.severity === "warn"
                ? "bg-amber-50 border-l-[3px] border-l-amber-400"
                : ""
              return (
                <div key={result.ruleId} className={`flex items-start gap-3 px-5 py-3 ${rowCls} ${isLast ? "" : "border-b border-slate-100"}`}>
                  {result.passed
                    ? <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />
                    : result.severity === "block"
                    ? <Ban size={14} className="text-red-500 shrink-0 mt-0.5" />
                    : result.severity === "warn"
                    ? <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    : <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
                  }
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
        )}
      </div>

      {/* Approval history */}
      {approvalHistory.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h2 className="text-[13px] font-bold text-slate-900">Approval History</h2>
          </div>
          <div>
            {approvalHistory.map((event, i) => {
              const actor    = getUserById(event.actorId)
              const isLast   = i === approvalHistory.length - 1
              const actionCls =
                event.action === "approve"  ? "text-green-600 bg-green-50 border-green-200" :
                event.action === "reject"   ? "text-red-600 bg-red-50 border-red-200" :
                                              "text-purple-600 bg-purple-50 border-purple-200"
              return (
                <div key={event.id} className={`flex items-start gap-3 px-5 py-3.5 ${isLast ? "" : "border-b border-slate-100"}`}>
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-600 shrink-0">
                    {actor?.initials ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[12px] font-semibold text-slate-900">{actor?.name ?? event.actorId}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${actionCls}`}>
                        {event.action}
                      </span>
                    </div>
                    {event.notes && (
                      <p className="text-[12px] text-slate-500 leading-relaxed">{event.notes}</p>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">{formatTs(event.timestamp)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Action panel */}
      {isApprover && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h2 className="text-[13px] font-bold text-slate-900">Actions</h2>
          </div>

          {!canAct ? (
            <div className="px-5 py-4 flex items-center gap-2 text-[12px] text-slate-500">
              <Lock size={13} className="shrink-0" />
              This request is <span className="font-semibold text-slate-700">{STATUS_META[request.status]?.label}</span> — no further action available.
            </div>
          ) : confirmAction ? (
            <div className={`p-5 border-l-4 ${
              confirmAction === "approve"  ? "border-l-green-500 bg-green-50/40" :
              confirmAction === "reject"   ? "border-l-red-500 bg-red-50/40" :
                                            "border-l-purple-500 bg-purple-50/40"
            }`}>
              <p className="text-[12px] font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <MessageSquare size={13} className="shrink-0" />
                Notes for this {confirmAction} <span className="font-normal text-slate-500">(optional)</span>
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  confirmAction === "approve"  ? "Verification notes, references…" :
                  confirmAction === "reject"   ? "Reason for rejection…" :
                                                "Reason for escalation, approval limit…"
                }
                rows={3}
                className="w-full text-[13px] text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all resize-none mb-3"
              />
              <div className="flex gap-2.5">
                <button
                  onClick={actionHandlers[confirmAction]}
                  className={`flex-1 py-2 px-4 rounded-lg text-[13px] font-semibold transition-all shadow-sm ${ACTION_META[confirmAction].cls}`}
                >
                  {ACTION_META[confirmAction].confirmLabel}
                </button>
                <button
                  onClick={() => { setConfirmAction(null); setNotes("") }}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="px-5 py-4">
              {isWarned && !isBlocked && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4 text-[12px] text-amber-700">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  Risk warnings were flagged on this request. Review the checks above before approving.
                </div>
              )}
              <div className="flex gap-2.5">
                {request.status !== "escalated" && (
                  <button
                    onClick={() => setConfirmAction("escalate")}
                    className="px-4 py-2 rounded-lg text-[13px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-all"
                  >
                    Escalate
                  </button>
                )}
                <button
                  onClick={() => setConfirmAction("reject")}
                  className="px-4 py-2 rounded-lg text-[13px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-all"
                >
                  Reject
                </button>
                <button
                  onClick={() => setConfirmAction("approve")}
                  className="flex-1 py-2 px-4 rounded-lg text-[13px] font-semibold bg-green-600 hover:bg-green-700 text-white shadow-sm transition-all"
                >
                  Approve & Execute
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!isApprover && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 flex items-center gap-2 text-[12px] text-slate-500">
          <Lock size={13} className="shrink-0" />
          Switch to the <span className="font-semibold text-slate-700">Approver</span> role in the sidebar to take action on this request.
        </div>
      )}
    </div>
  )
}

// ─── Reusable field ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-1">{label}</p>
      {children}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApprovalQueuePage() {
  const requests          = useRequestStore((s) => s.requests)
  const setStatus         = useRequestStore((s) => s.setStatus)
  const addApprovalEvent  = useRequestStore((s) => s.addApprovalEvent)
  const getApprovalEvents = useRequestStore((s) => s.getApprovalEventsForRequest)
  const getWallet         = useWalletStore((s) => s.getWalletById)
  const updateBalance     = useWalletStore((s) => s.updateBalance)
  const currentUser       = useUserStore((s) => s.currentUser)
  const getUserById       = useUserStore((s) => s.getUserById)
  const appendEvent       = useAuditStore((s) => s.appendEvent)

  const [selectedId,     setSelectedId]     = useState<string | null>(null)
  const [showAll,        setShowAll]        = useState(false)
  const [confirmAction,  setConfirmAction]  = useState<"approve" | "reject" | "escalate" | null>(null)
  const [notes,          setNotes]          = useState("")

  const queueItems = requests.filter((r) =>
    showAll ? true : r.status === "pending_review" || r.status === "escalated"
  )

  const effectiveSelectedId = selectedId ?? queueItems[0]?.id ?? null
  const selected = queueItems.find((r) => r.id === effectiveSelectedId) ?? null

  const isApprover = currentUser.role === "approver"
  const canAct = !!(isApprover && selected && (selected.status === "pending_review" || selected.status === "escalated"))

  const pendingCount = requests.filter((r) => r.status === "pending_review" || r.status === "escalated").length

  function handleApprove() {
    if (!selected) return
    const wallet = getWallet(selected.fromWalletId)
    const balanceBefore = wallet?.balance ?? 0

    addApprovalEvent({ requestId: selected.id, actorId: currentUser.id, action: "approve", notes })
    setStatus(selected.id, "approved")
    appendEvent({
      actorId: currentUser.id, actorRole: currentUser.role,
      action: "REQUEST_APPROVED", entityType: "request", entityId: selected.id,
      details: { notes },
    })

    if (wallet) updateBalance(wallet.id, selected.amount)
    setStatus(selected.id, "executed")
    appendEvent({
      actorId: currentUser.id, actorRole: currentUser.role,
      action: "REQUEST_EXECUTED", entityType: "request", entityId: selected.id,
      details: { balanceBefore, balanceAfter: balanceBefore - selected.amount, walletId: selected.fromWalletId },
    })

    setConfirmAction(null)
    setNotes("")
    setSelectedId(null)
  }

  function handleReject() {
    if (!selected) return
    addApprovalEvent({ requestId: selected.id, actorId: currentUser.id, action: "reject", notes })
    setStatus(selected.id, "rejected")
    appendEvent({
      actorId: currentUser.id, actorRole: currentUser.role,
      action: "REQUEST_REJECTED", entityType: "request", entityId: selected.id,
      details: { notes },
    })
    setConfirmAction(null)
    setNotes("")
    setSelectedId(null)
  }

  function handleEscalate() {
    if (!selected) return
    addApprovalEvent({ requestId: selected.id, actorId: currentUser.id, action: "escalate", notes })
    setStatus(selected.id, "escalated")
    appendEvent({
      actorId: currentUser.id, actorRole: currentUser.role,
      action: "REQUEST_ESCALATED", entityType: "request", entityId: selected.id,
      details: { notes },
    })
    setConfirmAction(null)
    setNotes("")
  }

  return (
    <div className="p-8 min-h-full">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Approval Queue</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            {pendingCount} request{pendingCount !== 1 ? "s" : ""} awaiting review
          </p>
        </div>
        <button
          onClick={() => { setShowAll(!showAll); setSelectedId(null) }}
          className={`text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-colors ${
            showAll
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
          }`}
        >
          {showAll ? "Active queue only" : "View all requests"}
        </button>
      </div>

      {queueItems.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 flex flex-col items-center gap-3 text-center">
          <CheckCircle2 size={32} className="text-green-400" />
          <p className="text-[14px] font-semibold text-slate-700">Queue is clear</p>
          <p className="text-[13px] text-slate-400">No pending or escalated requests.</p>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-5 items-start">

          {/* Left: request list */}
          <div className="col-span-2 space-y-2.5">
            {queueItems.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                walletName={getWallet(req.fromWalletId)?.name ?? req.fromWalletId}
                requesterName={getUserById(req.requesterId)?.name ?? req.requesterId}
                isSelected={req.id === effectiveSelectedId}
                onClick={() => { setSelectedId(req.id); setConfirmAction(null); setNotes("") }}
              />
            ))}
          </div>

          {/* Right: detail */}
          {selected && (
            <DetailPanel
              request={selected}
              wallet={getWallet(selected.fromWalletId)}
              requester={getUserById(selected.requesterId)}
              approvalHistory={getApprovalEvents(selected.id)}
              getUserById={getUserById}
              canAct={canAct}
              isApprover={isApprover}
              confirmAction={confirmAction}
              setConfirmAction={setConfirmAction}
              notes={notes}
              setNotes={setNotes}
              onApprove={handleApprove}
              onReject={handleReject}
              onEscalate={handleEscalate}
            />
          )}

        </div>
      )}
    </div>
  )
}
