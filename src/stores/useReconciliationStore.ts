"use client"

import { create } from "zustand"
import type { ReconciliationRecord } from "@/types"
import { SEED_RECONCILIATION } from "@/data/seed"
import { nanoid } from "@/lib/nanoid"

interface ReconciliationStore {
  records: ReconciliationRecord[]
  addRecord: (record: Omit<ReconciliationRecord, "id">) => ReconciliationRecord
  getLatestForWallet: (walletId: string) => ReconciliationRecord | undefined
}

export const useReconciliationStore = create<ReconciliationStore>((set, get) => ({
  records: SEED_RECONCILIATION,

  addRecord: (params) => {
    const record: ReconciliationRecord = { id: `rec_${nanoid()}`, ...params }
    set((state) => ({ records: [record, ...state.records] }))
    return record
  },

  getLatestForWallet: (walletId) => {
    const sorted = get()
      .records.filter((r) => r.walletId === walletId)
      .sort((a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime())
    return sorted[0]
  },
}))
