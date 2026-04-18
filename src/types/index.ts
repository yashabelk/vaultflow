// ─── Enumerations ────────────────────────────────────────────────────────────

export type WalletTier = "hot" | "warm" | "cold"
export type WalletStatus = "active" | "frozen" | "under_review"
export type AssetSymbol = "BTC" | "ETH" | "USDC" | "USDT" | "SOL"
export type Network = "bitcoin" | "ethereum" | "solana" | "ethereum-testnet"

export type RequestStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "rejected_by_risk"
  | "escalated"
  | "executed"
  | "failed"

export type RiskSeverity = "block" | "warn" | "info"
export type ApprovalAction = "approve" | "reject" | "escalate"
export type AlertSeverity = "critical" | "warning" | "info"
export type AlertStatus = "open" | "acknowledged" | "resolved"
export type ReconciliationStatus = "matched" | "mismatch" | "pending"
export type UserRole = "operator" | "approver" | "auditor"

export type AuditAction =
  | "WITHDRAWAL_REQUESTED"
  | "RISK_CHECK_RUN"
  | "REQUEST_APPROVED"
  | "REQUEST_REJECTED"
  | "REQUEST_ESCALATED"
  | "REQUEST_EXECUTED"
  | "REQUEST_FAILED"
  | "WALLET_FROZEN"
  | "WALLET_UNFROZEN"
  | "RECONCILIATION_RUN"
  | "ALERT_RAISED"
  | "ALERT_ACKNOWLEDGED"
  | "ALERT_RESOLVED"

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  role: UserRole
  initials: string
}

export interface Wallet {
  id: string
  name: string
  tier: WalletTier
  asset: AssetSymbol
  network: Network
  balance: number
  reservedBalance: number
  address: string
  status: WalletStatus
  minReserve: number
  createdAt: string
}

export interface RiskCheckResult {
  ruleId: string
  ruleName: string
  passed: boolean
  severity: RiskSeverity
  message: string
  checkedAt: string
}

export interface WithdrawalRequest {
  id: string
  requesterId: string
  fromWalletId: string
  toAddress: string
  asset: AssetSymbol
  network: Network
  amount: number
  memo: string
  status: RequestStatus
  riskCheckResults: RiskCheckResult[]
  createdAt: string
  updatedAt: string
}

export interface ApprovalEvent {
  id: string
  requestId: string
  actorId: string
  action: ApprovalAction
  notes: string
  timestamp: string
}

export interface AuditEvent {
  id: string
  timestamp: string
  actorId: string
  actorRole: UserRole
  action: AuditAction
  entityType: "wallet" | "request" | "alert" | "reconciliation"
  entityId: string
  details: Record<string, unknown>
}

export interface Alert {
  id: string
  triggeredAt: string
  ruleId: string
  severity: AlertSeverity
  entityType: "wallet" | "request" | "reconciliation"
  entityId: string
  message: string
  status: AlertStatus
  resolvedAt?: string
  resolvedBy?: string
  resolvedNote?: string
}

export interface ReconciliationRecord {
  id: string
  runAt: string
  walletId: string
  internalBalance: number
  onchainBalance: number
  delta: number
  status: ReconciliationStatus
  notes: string
}

// ─── Derived / View Types ─────────────────────────────────────────────────────

export interface WithdrawalRequestWithContext extends WithdrawalRequest {
  requester: User
  fromWallet: Wallet
}

export interface WalletWithStats extends Wallet {
  availableBalance: number
  pendingRequestsCount: number
  openAlertsCount: number
}
