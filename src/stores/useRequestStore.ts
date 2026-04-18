"use client"

import { create } from "zustand"
import type {
  WithdrawalRequest,
  ApprovalEvent,
  RequestStatus,
  RiskCheckResult,
} from "@/types"
import { SEED_REQUESTS, SEED_APPROVAL_EVENTS } from "@/data/seed"
import { nanoid } from "@/lib/nanoid"

interface RequestStore {
  requests: WithdrawalRequest[]
  approvalEvents: ApprovalEvent[]
  pendingRequests: WithdrawalRequest[]
  addRequest: (
    params: Omit<WithdrawalRequest, "id" | "createdAt" | "updatedAt" | "status" | "riskCheckResults">
  ) => WithdrawalRequest
  setRiskResults: (requestId: string, results: RiskCheckResult[]) => void
  setStatus: (requestId: string, status: RequestStatus) => void
  addApprovalEvent: (params: Omit<ApprovalEvent, "id" | "timestamp">) => void
  getRequestById: (id: string) => WithdrawalRequest | undefined
  getApprovalEventsForRequest: (requestId: string) => ApprovalEvent[]
  hasPendingDuplicate: (
    fromWalletId: string,
    toAddress: string,
    amount: number,
    asset: string,
    excludeId?: string
  ) => boolean
}

export const useRequestStore = create<RequestStore>((set, get) => ({
  requests: SEED_REQUESTS,
  approvalEvents: SEED_APPROVAL_EVENTS,

  get pendingRequests() {
    return get().requests.filter((r) => r.status === "pending_review")
  },

  addRequest: (params) => {
    const request: WithdrawalRequest = {
      id: `req_${nanoid()}`,
      status: "pending_review",
      riskCheckResults: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...params,
    }
    set((state) => ({ requests: [request, ...state.requests] }))
    return request
  },

  setRiskResults: (requestId, results) =>
    set((state) => ({
      requests: state.requests.map((r) =>
        r.id === requestId
          ? { ...r, riskCheckResults: results, updatedAt: new Date().toISOString() }
          : r
      ),
    })),

  setStatus: (requestId, status) =>
    set((state) => ({
      requests: state.requests.map((r) =>
        r.id === requestId
          ? { ...r, status, updatedAt: new Date().toISOString() }
          : r
      ),
    })),

  addApprovalEvent: (params) => {
    const event: ApprovalEvent = {
      id: `apv_${nanoid()}`,
      timestamp: new Date().toISOString(),
      ...params,
    }
    set((state) => ({ approvalEvents: [event, ...state.approvalEvents] }))
  },

  getRequestById: (id) => get().requests.find((r) => r.id === id),

  getApprovalEventsForRequest: (requestId) =>
    get().approvalEvents.filter((e) => e.requestId === requestId),

  hasPendingDuplicate: (fromWalletId, toAddress, amount, asset, excludeId) =>
    get().requests.some(
      (r) =>
        r.id !== excludeId &&
        r.fromWalletId === fromWalletId &&
        r.toAddress === toAddress &&
        r.amount === amount &&
        r.asset === asset &&
        r.status === "pending_review"
    ),
}))
