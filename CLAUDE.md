# VaultFlow — CLAUDE.md

## What this project is
A simulated digital asset custody operations console. NOT a trading app, NOT a portfolio tracker.
Demonstrates: wallet tiering, withdrawal approval workflows, risk rule engine, reconciliation, audit logs.
All data is mock/in-memory. No real blockchain, no real auth, no backend.

## Commands
```bash
npm run dev       # start dev server (localhost:3000)
npm run build     # production build
npm run lint      # ESLint
npx vitest        # run unit tests
npx vitest run    # run tests once (CI mode)
```

## Stack
- Next.js 14 App Router, TypeScript, Tailwind CSS
- shadcn/ui (components in src/components/ui/)
- Zustand (stores in src/stores/)
- Vitest (tests in src/lib/__tests__/)

## Folder structure
```
src/
  app/                        # Next.js pages (App Router)
    page.tsx                  # Dashboard (/)
    wallets/page.tsx
    requests/new/page.tsx
    approval-queue/page.tsx
    reconciliation/page.tsx
    audit-log/page.tsx
    alerts/page.tsx
    layout.tsx                # Root layout with sidebar
  components/
    ui/                       # shadcn generated components — do not edit manually
    layout/                   # Sidebar, nav, role switcher
    dashboard/                # Dashboard-specific components
    wallets/                  # Wallet table, wallet detail
    requests/                 # Withdrawal form, risk check results
    approval/                 # Approval queue table, action dialogs
    reconciliation/           # Reconciliation panel
    audit/                    # Audit event list
    alerts/                   # Alert list, resolution dialog
  data/
    seed.ts                   # All mock data (wallets, users, requests, events, alerts)
  lib/
    riskRules.ts              # Risk check engine — pure functions, fully tested
    constants.ts              # RISK_THRESHOLDS, ASSET_DECIMALS, etc.
    nanoid.ts                 # Lightweight ID generator
    utils.ts                  # shadcn cn() utility
  stores/
    useUserStore.ts           # currentUser, role switcher, users list
    useWalletStore.ts         # wallets, updateBalance, setWalletStatus
    useRequestStore.ts        # withdrawal requests, approval events
    useAlertStore.ts          # alerts, raiseAlert, updateAlertStatus
    useReconciliationStore.ts # reconciliation records
    useAuditStore.ts          # audit event log (append-only)
  types/
    index.ts                  # ALL TypeScript types — single source of truth
```

## Key types (src/types/index.ts)
- `Wallet` — id, name, tier (hot|warm|cold), asset, network, balance, reservedBalance, status
- `WithdrawalRequest` — id, requesterId, fromWalletId, toAddress, amount, asset, network, status, riskCheckResults[]
- `RiskCheckResult` — ruleId, ruleName, passed, severity (block|warn|info), message
- `AuditEvent` — id, timestamp, actorId, actorRole, action, entityType, entityId, details
- `Alert` — id, severity (critical|warning|info), status (open|acknowledged|resolved), ruleId
- `ReconciliationRecord` — walletId, internalBalance, onchainBalance, delta, status

## Risk rules (src/lib/riskRules.ts)
| ID  | Name                          | Severity   |
|-----|-------------------------------|------------|
| R01 | Large Withdrawal Threshold    | warn/block |
| R02 | New Address Flag              | warn       |
| R03 | Network Mismatch              | block      |
| R04 | Insufficient Balance          | block      |
| R05 | Frozen Wallet                 | block      |
| R06 | Hot Wallet Low Reserve        | warn       |
| R07 | Reconciliation Mismatch Active| warn       |
| R08 | Duplicate Request Detection   | warn       |

`hasBlockingResult(results)` → true if any block rule failed → request auto-rejected
`hasWarningResult(results)` → true if any warn rule failed → proceeds with warnings shown

## Simulated roles (useUserStore)
- `operator` — can create withdrawal requests, view all screens
- `approver` — can approve/reject/escalate requests, freeze wallets
- `auditor` — read-only access to all screens
Role is switched via UI role switcher (no real auth).

## Withdrawal request lifecycle
1. Operator submits form → `useRequestStore.addRequest()`
2. Risk checks run → `runRiskChecks()` in riskRules.ts
3. If BLOCK result → `setStatus('rejected_by_risk')`, `raiseAlert()`
4. If WARN/PASS → status stays `pending_review`, appears in Approval Queue
5. Approver approves → `setStatus('approved')` → `setStatus('executed')` + `updateBalance()`
6. Every state change → `useAuditStore.appendEvent()`

## Reconciliation workflow
1. User triggers run → compare wallet.balance vs simulated onchain value
2. Simulated onchain = balance ± small random variance (SIMULATED_ONCHAIN_VARIANCE = 2%)
3. Delta != 0 → ReconciliationRecord with status 'mismatch' + Alert raised
4. AuditEvent logged for every run

## Conventions
- All IDs use prefixes: `wlt_`, `req_`, `aud_`, `alt_`, `rec_`, `apv_`, `usr_`
- Dates: always ISO 8601 strings — never Date objects in state
- Amounts: raw decimal numbers (BTC = 4.821, not satoshis)
- No comments unless the WHY is non-obvious
- No backend, no API routes, no database
- "use client" required on all store files and any component using hooks

## Do NOT
- Add real blockchain connectivity
- Add a real database or API routes
- Add real authentication
- Add features outside the 7 screens: Dashboard, Wallets, New Request, Approval Queue, Reconciliation, Audit Log, Alerts
