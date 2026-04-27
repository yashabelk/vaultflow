# VaultFlow

A simulated digital asset custody operations console — the kind of internal tool a custodian, exchange, or treasury team would use to manage wallets, route withdrawal requests through a risk engine, approve transactions, and reconcile balances.

**This is not a trading app or portfolio tracker.** It's an operations product focused on the workflow between operators, approvers, and auditors handling institutional crypto custody.

## What it demonstrates

- **Wallet tiering & state** — hot, warm, cold tiers; active / frozen / under-review states; reserve thresholds
- **Withdrawal workflow** — operator submits → 8-rule risk engine evaluates → approver acts (approve / reject / escalate) → request executes
- **Risk engine** — pure-function rules with severity tiers (block / warn / info), unit-tested
- **Reconciliation** — internal balances vs simulated on-chain balances, mismatch detection raises alerts
- **Audit trail** — append-only event log of every state change, filterable and searchable
- **Alert lifecycle** — open → acknowledged → resolved, with notes
- **Role-based access** — operator, approver, auditor; UI adapts per role

## Stack

| | |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| State | Zustand (in-memory, no backend) |
| Tests | Vitest |
| Font | Inter |

## Screens

| Route | Purpose |
|---|---|
| `/` | Dashboard — stat cards, activity feed, open alerts, wallet tier breakdown |
| `/wallets` | Wallet table with tier/status filters, freeze/unfreeze (approver) |
| `/requests/new` | Withdrawal form → animated risk checks → results |
| `/approval-queue` | Master-detail review of pending + escalated requests |
| `/reconciliation` | Run-all, deltas, mismatch alerts, run history |
| `/audit-log` | Filterable, paginated event log with expandable details |
| `/alerts` | Severity-sorted list with acknowledge/resolve workflow |

## Roles

Switch roles in the sidebar to see the UI adapt:

- **Operator** — submits withdrawal requests
- **Approver** — approves / rejects / escalates; freezes wallets; resolves alerts
- **Auditor** — read-only across all screens

## Getting started

```bash
npm install
npm run dev          # localhost:3000
npm run build        # production build
npm run lint         # ESLint
npx vitest           # unit tests (risk engine)
```

## Architecture notes

- All state is in-memory Zustand stores; refresh resets to seed data
- No backend, no database, no real auth, no real blockchain connectivity
- Risk rules are pure functions in `src/lib/riskRules.ts` — fully tested
- Types live in `src/types/index.ts` — single source of truth
- Mock data in `src/data/seed.ts` is constructed to feel realistic (a frozen wallet, an escalated request, an active reconciliation mismatch)

## Project structure

```
src/
  app/                   # Next.js routes (the 7 screens)
  components/
    layout/              # Sidebar
    ui/                  # shadcn primitives
  data/seed.ts           # All mock data
  lib/
    riskRules.ts         # Risk engine (tested)
    constants.ts
  stores/                # Zustand stores
  types/index.ts
```

## What's intentionally not built

This is a portfolio piece, not a real custody system. There is no real authentication, no API layer, no persistence, no on-chain integration, no key management, no MPC, no HSM. The point is the workflow design and the operations UX, not the cryptography.
