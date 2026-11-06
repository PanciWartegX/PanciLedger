# PanciLedger

**PanciWartegX** — multi-workspace financial management.

Copyright © 2026 PanciWartegX. All rights reserved.

## Status

The `develop` branch contains the Next.js application shell, Supabase SSR clients, email/password authentication UI, route session guard, CI workflow, and initial workspace schema migrations. The dashboard still contains sample data; financial actions are not connected to live database records.

## Local development

1. Use Node.js 20.9+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. The Supabase project URL, publishable key, and JWKS discovery URL are prefilled in `.env.example`.
5. Run `npm run dev`.

The publishable key is intended for client initialization. It does **not** replace database authorization: every exposed table must have correct Row Level Security policies.

## Supabase credentials

- `NEXT_PUBLIC_SUPABASE_URL`: project URL; safe to include in client configuration.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: publishable key; designed to be used by browser clients with RLS.
- `SUPABASE_JWKS_URL`: public JWKS discovery endpoint.
- `SUPABASE_SECRET_KEY`: privileged server-only credential. Keep it in local/deployment environment variables or a secrets manager. Never commit it, prefix it with `NEXT_PUBLIC_`, return it from an API route, or import it into browser code.

The current application uses the publishable key for Supabase SSR/browser authentication. A secret-key client is intentionally not added until a reviewed server-only operation actually requires elevated privileges. Prefer user-scoped clients and RLS over bypassing RLS.

Never commit `.env.local`. The repository's `.gitignore` excludes local environment files.

## Supabase Auth setup

Configure the Supabase Auth Site URL and allowed redirect URLs for local development and each Preview deployment. The application callback route is `/auth/callback`.

Apply SQL migrations with the Supabase CLI only after review.

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
