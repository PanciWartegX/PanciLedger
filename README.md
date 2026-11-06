# PanciLedger

**PanciWartegX** — multi-workspace financial management.

Copyright © 2026 PanciWartegX. All rights reserved.

## Status

The initial Next.js application shell and Supabase workspace foundation are on `develop`. The dashboard currently uses clearly labeled sample data; financial actions are not wired to a live database yet.

## Stack

Next.js App Router, TypeScript strict, Supabase PostgreSQL/Auth/SSR/Storage, Tailwind CSS, React Hook Form, Zod, Recharts, and Lucide.

## Local development

1. Install Node.js 20.9+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and anon key.
4. Run `npm run dev`.

Apply SQL migrations with the Supabase CLI only after reviewing them. Never expose the Supabase service-role key to browser code.

## Product invariants

- One account can belong to multiple workspaces.
- Workspace membership and roles are enforced by PostgreSQL RLS and server-side checks.
- Monetary values use PostgreSQL `numeric`, not floating-point storage.
- Posted transactions are immutable; corrections use reversal records.
- Writes must be atomic and idempotent.
- Preview deployments only until explicit Production approval.

## Planned modules

Accounts, ledger, income/expenses/transfers, shared funds, savings goals, budgets, recurring transactions, reports, exports, notifications, audit logs, and secure attachments.
