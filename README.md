# PanciLedger

**PanciWartegX** — multi-workspace financial management.

Copyright © 2026 PanciWartegX. All rights reserved.

## Current implementation

The `develop` branch contains a Next.js App Router application with Supabase email/password authentication, server-side session refresh, multi-workspace dashboard, workspace roles, account creation, income/expense posting, atomic same-currency transfers, single-entry reversals, and workspace audit activity.

The application is still under development. Shared-fund pools, paired transfer reversals, budgets, savings goals, recurring transactions, reports/exports, notifications, account administration, and broader automated integration tests are not complete. Do not treat the current build as production-ready until the database migrations and live Supabase flows have been tested.

## Stack

- Next.js App Router + TypeScript
- Supabase Auth, PostgreSQL, Row Level Security, and SQL RPCs
- Tailwind CSS
- Recharts and Lucide

## Local development

1. Use Node.js 20.9 or newer.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`.
5. Apply every SQL migration in `supabase/migrations` to the intended Supabase project, in filename order, after reviewing it.
6. Configure Supabase Auth Site URL and Redirect URLs for local development.
7. Run `npm run dev`.

The publishable key is designed for browser use. It does not grant elevated database access; Row Level Security and server-side authorization remain mandatory. No Supabase secret/service-role key is required by the current application. Never put a secret key in a `NEXT_PUBLIC_*` variable or commit it.

## Vercel Preview setup

1. Import the private GitHub repository `PanciWartegX/PanciLedger` into Vercel.
2. Set the Vercel project name to `panciledger` (the dashboard may normalize capitalization; the visible app branding remains **PanciLedger**).
3. Set the Production Branch to `main`; use `develop` as a Preview branch.
4. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the **Preview** environment only at first.
5. Add the Preview deployment URL to Supabase Auth Redirect URLs and configure the Site URL appropriately for the intended auth flow.
6. Deploy a Preview and test sign-up, email confirmation, sign-in, workspace isolation, roles, account balances, transactions, transfers, reversals, and sign-out.
7. Keep Production environment variables and Production deployment disabled until explicitly approved and all tests pass.

Vercel automatically detects Next.js; no custom build command is required. The expected build command is `npm run build`.

## Product invariants

- One user account can manage multiple workspaces.
- Workspace membership and roles are enforced by PostgreSQL RLS and server-side checks.
- Monetary values use PostgreSQL `numeric`, not floating-point storage.
- Posted transactions are immutable; corrections use reversal records.
- Transfers are two-sided and committed atomically.
- Preview deployments only until explicit Production approval.

## Validation

CI runs dependency installation, TypeScript type-checking, ESLint, and a Next.js production build for pushes and pull requests to `main` and `develop`.

## Planned modules

Shared funds/contributions, savings goals, budgets, recurring transactions, reports/exports, notifications, secure attachments, account/member management, and expanded test coverage.
