# PanciLedger

**PanciWartegX** — multi-workspace financial management.

Copyright © 2026 PanciWartegX. All rights reserved.

## Status

The `develop` branch contains the Next.js application shell, Supabase SSR clients, email/password authentication UI, route session guard, CI workflow, and initial workspace schema migrations. The dashboard still contains sample data; financial actions are not connected to live database records.

## Local development

1. Use Node.js 20.9+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase API settings.
5. Run `npm run dev`.

Never commit `.env.local`. The publishable/anon key is intended for client use but must be paired with correct Row Level Security. Never expose the Supabase service-role key to browser code.

Apply SQL migrations with the Supabase CLI only after review. Configure Supabase Auth Site URL and allowed redirect URLs for local and Preview deployments.

## Product invariants

- One account can belong to multiple workspaces.
- Workspace membership and roles are enforced by PostgreSQL RLS and server-side checks.
- Monetary values use PostgreSQL `numeric`, not floating-point storage.
- Posted transactions are immutable; corrections use reversal records.
- Writes must be atomic and idempotent.
- Preview deployments only until explicit Production approval.

## Validation

CI runs dependency installation, TypeScript type-checking, ESLint, and a Next.js production build for pushes and pull requests to `main` and `develop`.

## Planned modules

Accounts, ledger, income/expenses/transfers, shared funds, savings goals, budgets, recurring transactions, reports, exports, notifications, audit logs, and secure attachments.
