"use client"

import { create } from "zustand"
import type { Alert, AlertStatus } from "@/types"
import { SEED_ALERTS } from "@/data/seed"
import { nanoid } from "@/lib/nanoid"

interface AlertStore {
  alerts: Alert[]
  openAlerts: Alert[]
  raiseAlert: (params: Omit<Alert, "id" | "triggeredAt" | "status">) => void
  updateAlertStatus: (
    alertId: string,
    status: AlertStatus,
    actorId: string,
    note?: string
  ) => void
  getAlertsForEntity: (entityId: string) => Alert[]
  hasOpenMismatchForWallet: (walletId: string) => boolean
}

export const useAlertStore = create<AlertStore>((set, get) => ({
  alerts: SEED_ALERTS,

  get openAlerts() {
    return get().alerts.filter((a) => a.status === "open")
  },

  raiseAlert: (params) => {
    const alert: Alert = {
      id: `alt_${nanoid()}`,
      triggeredAt: new Date().toISOString(),
      status: "open",
      ...params,
    }
    set((state) => ({ alerts: [alert, ...state.alerts] }))
  },

  updateAlertStatus: (alertId, status, actorId, note) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === alertId
          ? {
              ...a,
              status,
              ...(status === "resolved" && {
                resolvedAt: new Date().toISOString(),
                resolvedBy: actorId,
                resolvedNote: note,
              }),
            }
          : a
      ),
    })),

  getAlertsForEntity: (entityId) =>
    get().alerts.filter((a) => a.entityId === entityId),

  hasOpenMismatchForWallet: (walletId) =>
    get().alerts.some(
      (a) =>
        a.entityId === walletId &&
        a.ruleId === "RECON_MISMATCH" &&
        a.status === "open"
    ),
}))
