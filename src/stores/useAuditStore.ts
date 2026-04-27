"use client"

import { create } from "zustand"
import type { AuditEvent } from "@/types"
import { SEED_AUDIT_EVENTS } from "@/data/seed"
import { nanoid } from "@/lib/nanoid"

interface AuditStore {
  events: AuditEvent[]
  appendEvent: (
    params: Omit<AuditEvent, "id" | "timestamp">
  ) => void
  getEventsForEntity: (entityId: string) => AuditEvent[]
  hasAddressAppeared: (address: string) => boolean
}

export const useAuditStore = create<AuditStore>((set, get) => ({
  events: [...SEED_AUDIT_EVENTS].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  ),

  appendEvent: (params) => {
    const event: AuditEvent = {
      id: `aud_${nanoid()}`,
      timestamp: new Date().toISOString(),
      ...params,
    }
    set((state) => ({ events: [event, ...state.events] }))
  },

  getEventsForEntity: (entityId) =>
    get().events.filter((e) => e.entityId === entityId),

  hasAddressAppeared: (address) =>
    get().events.some(
      (e) => (e.details as { toAddress?: string }).toAddress === address
    ),
}))
