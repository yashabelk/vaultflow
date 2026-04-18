"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Vault,
  ArrowUpRight,
  ClipboardCheck,
  RefreshCw,
  ScrollText,
  Bell,
} from "lucide-react"
import { useUserStore } from "@/stores/useUserStore"
import { useAlertStore } from "@/stores/useAlertStore"
import { useRequestStore } from "@/stores/useRequestStore"
import type { UserRole } from "@/types"

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/wallets", label: "Wallets", icon: Vault },
  { href: "/requests/new", label: "New Request", icon: ArrowUpRight },
  { href: "/approval-queue", label: "Approval Queue", icon: ClipboardCheck },
  { href: "/reconciliation", label: "Reconciliation", icon: RefreshCw },
  { href: "/audit-log", label: "Audit Log", icon: ScrollText },
  { href: "/alerts", label: "Alerts", icon: Bell },
]

const ROLES: UserRole[] = ["operator", "approver", "auditor"]

const ROLE_COLORS: Record<UserRole, string> = {
  operator: "bg-blue-500",
  approver: "bg-green-500",
  auditor: "bg-purple-500",
}

export function Sidebar() {
  const pathname = usePathname()
  const { currentUser, setRole } = useUserStore()
  const alerts = useAlertStore((s) => s.alerts)
  const requests = useRequestStore((s) => s.requests)

  const openAlertsCount = alerts.filter((a) => a.status === "open").length
  const pendingCount = requests.filter((r) => r.status === "pending_review").length

  return (
    <aside className="w-[220px] shrink-0 h-screen flex flex-col bg-slate-950 border-r border-slate-800/60">
      {/* Brand */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-amber-500 rounded-md flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1.5" y="3.5" width="11" height="8.5" rx="1.5" stroke="white" strokeWidth="1.4" />
              <path d="M4.5 3.5V2.5a2.5 2.5 0 0 1 5 0v1" stroke="white" strokeWidth="1.4" />
              <circle cx="7" cy="7.75" r="1.25" fill="white" />
            </svg>
          </div>
          <span className="text-white font-semibold text-sm tracking-tight">VaultFlow</span>
        </div>
        <p className="mt-1.5 text-[10px] text-slate-500 font-mono uppercase tracking-[0.15em]">
          Custody Console
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          const badge =
            href === "/alerts"
              ? openAlertsCount
              : href === "/approval-queue"
              ? pendingCount
              : 0

          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-150 ${
                isActive
                  ? "bg-amber-500/10 text-amber-400"
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
              }`}
            >
              <Icon
                size={15}
                className={`shrink-0 transition-colors ${
                  isActive ? "text-amber-400" : "text-slate-500 group-hover:text-slate-300"
                }`}
              />
              <span className={`flex-1 text-[13px] ${isActive ? "font-medium" : ""}`}>{label}</span>
              {badge > 0 && (
                <span
                  className={`text-[10px] font-mono min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 ${
                    isActive
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-slate-700 text-slate-300"
                  }`}
                >
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Role Switcher + User */}
      <div className="px-3 pt-3 pb-4 border-t border-slate-800/60 space-y-3">
        <div>
          <p className="text-[10px] text-slate-600 uppercase tracking-[0.15em] font-mono px-1 mb-1.5">
            Role
          </p>
          <div className="flex flex-col gap-0.5">
            {ROLES.map((role) => (
              <button
                key={role}
                onClick={() => setRole(role)}
                className={`text-left px-3 py-1.5 rounded-md text-xs transition-colors capitalize ${
                  currentUser.role === role
                    ? "bg-amber-500/10 text-amber-400 font-medium"
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-1 pt-2 border-t border-slate-800/60">
          <div className="relative shrink-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] text-white font-bold font-mono ${ROLE_COLORS[currentUser.role]}`}
            >
              {currentUser.initials}
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-200 font-medium truncate">{currentUser.name}</p>
            <p className="text-[10px] text-slate-500 capitalize">{currentUser.role}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
