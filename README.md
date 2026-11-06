# PanciLedger

**PanciWartegX** — multi-workspace financial management.

Copyright © 2026 PanciWartegX. All rights reserved.

## Project status

Initial repository bootstrap. Application implementation is being developed on the `develop` branch. Deployments must use Preview until explicitly approved for Production.

## Product principles

- One user account can manage multiple isolated workspaces.
- Workspace membership and roles are enforced server-side and by PostgreSQL Row Level Security.
- Financial amounts use exact decimal/numeric storage, never floating-point arithmetic.
- Posted financial history is immutable; corrections use reversals.
- Financial writes must be atomic and protected against duplicate submissions.
- Secrets belong in environment variables and must never be committed.

## Planned stack

Next.js App Router, TypeScript strict, Supabase PostgreSQL/Auth/SSR/Storage, Tailwind CSS, shadcn/ui, React Hook Form, Zod, Recharts, and Lucide.

## Development

See the `develop` branch for the active application foundation and implementation.
