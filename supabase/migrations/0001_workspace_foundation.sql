-- PanciLedger workspace foundation.
-- Apply with Supabase CLI after reviewing the migration in your project.
create extension if not exists pgcrypto;

create type public.workspace_role as enum ('OWNER', 'ADMIN', 'TREASURER', 'AUDITOR', 'MEMBER', 'VIEWER');
create type public.transaction_kind as enum ('INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT', 'REVERSAL');
create type public.transaction_status as enum ('DRAFT', 'POSTED', 'VOID');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'MEMBER',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  currency char(3) not null default 'IDR',
  opening_balance numeric(20,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  account_id uuid not null,
  kind public.transaction_kind not null,
  status public.transaction_status not null default 'DRAFT',
  amount numeric(20,2) not null check (amount > 0),
  currency char(3) not null default 'IDR',
  description text not null check (char_length(trim(description)) between 1 and 240),
  occurred_at timestamptz not null default now(),
  idempotency_key uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  reversal_of uuid references public.financial_transactions(id) on delete restrict,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, account_id) references public.financial_accounts(workspace_id, id),
  unique (workspace_id, idempotency_key),
  check ((kind = 'REVERSAL') = (reversal_of is not null))
);

create index financial_transactions_workspace_date_idx
  on public.financial_transactions(workspace_id, occurred_at desc);
create index workspace_members_user_idx on public.workspace_members(user_id, workspace_id);

create function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = target_workspace and m.user_id = (select auth.uid())
  );
$$;

create function public.has_workspace_role(target_workspace uuid, allowed public.workspace_role[])
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = (select auth.uid())
      and m.role = any(allowed)
  );
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.financial_transactions enable row level security;

create policy "Members can view their workspaces" on public.workspaces
for select to authenticated using (public.is_workspace_member(id));
create policy "Authenticated users can create workspaces" on public.workspaces
for insert to authenticated with check (created_by = (select auth.uid()));
create policy "Workspace admins can update workspaces" on public.workspaces
for update to authenticated using (public.has_workspace_role(id, array['OWNER','ADMIN']::public.workspace_role[]))
with check (public.has_workspace_role(id, array['OWNER','ADMIN']::public.workspace_role[]));

create policy "Members can view workspace membership" on public.workspace_members
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Owners and admins manage membership" on public.workspace_members
for all to authenticated
using (public.has_workspace_role(workspace_id, array['OWNER','ADMIN']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['OWNER','ADMIN']::public.workspace_role[]));

create policy "Members can view accounts" on public.financial_accounts
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Treasury roles manage accounts" on public.financial_accounts
for all to authenticated
using (public.has_workspace_role(workspace_id, array['OWNER','ADMIN','TREASURER']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['OWNER','ADMIN','TREASURER']::public.workspace_role[]));

create policy "Members can view transactions" on public.financial_transactions
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Treasury roles create transactions" on public.financial_transactions
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_workspace_role(workspace_id, array['OWNER','ADMIN','TREASURER']::public.workspace_role[])
);
-- No UPDATE or DELETE policy: posted financial history must not be edited or deleted by clients.
-- Posting, transfers, reversals and balance projections will be implemented as audited database RPCs.

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid, public.workspace_role[]) to authenticated;
