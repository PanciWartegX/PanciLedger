-- Workspace budgets: period-based spending limits with ledger-derived usage.
create table public.workspace_budgets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  amount numeric(20,2) not null check (amount > 0 and amount <= 999999999999999999),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  account_id uuid,
  period_start date not null,
  period_end date not null,
  is_active boolean not null default true,
  request_key uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint workspace_budgets_period_check check (period_end >= period_start),
  constraint workspace_budgets_account_fk
    foreign key (workspace_id, account_id)
    references public.financial_accounts(workspace_id, id) on delete restrict,
  constraint workspace_budgets_idempotency_unique unique (workspace_id, request_key)
);

create index workspace_budgets_workspace_period_idx
  on public.workspace_budgets(workspace_id, is_active, period_start, period_end);
create index workspace_budgets_account_idx
  on public.workspace_budgets(workspace_id, account_id)
  where account_id is not null;

alter table public.workspace_budgets enable row level security;
create policy "Workspace members view budgets"
  on public.workspace_budgets for select to authenticated
  using (public.is_workspace_member(workspace_id));

revoke all on public.workspace_budgets from public, anon, authenticated;
grant select on public.workspace_budgets to authenticated;

create or replace view public.workspace_budget_usage
with (security_invoker = true)
as
select
  b.id as budget_id,
  b.workspace_id,
  coalesce(sum(t.amount) filter (where t.id is not null), 0)::numeric(20,2) as spent
from public.workspace_budgets b
left join public.financial_transactions t
  on t.workspace_id = b.workspace_id
  and t.currency = b.currency
  and t.status = 'POSTED'
  and t.direction = 'OUT'
  and t.occurred_at >= b.period_start::timestamptz
  and t.occurred_at < (b.period_end + 1)::timestamptz
  and (b.account_id is null or t.account_id = b.account_id)
group by b.id, b.workspace_id;

grant select on public.workspace_budget_usage to authenticated;

create or replace function public.create_workspace_budget(
  target_workspace uuid,
  budget_name text,
  budget_amount numeric,
  budget_currency char(3),
  target_account uuid,
  period_start date,
  period_end date,
  request_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  new_id uuid;
  existing public.workspace_budgets%rowtype;
  account_currency char(3);
begin
  if actor is null or not public.has_workspace_role(
    target_workspace,
    array['OWNER','ADMIN','TREASURER']::public.workspace_role[]
  ) then
    raise exception 'Insufficient workspace permissions' using errcode = '42501';
  end if;

  if target_workspace is null or budget_name is null
     or char_length(trim(budget_name)) not between 1 and 80
     or budget_amount is null or budget_amount <= 0
     or budget_amount > 999999999999999999
     or budget_currency is null or budget_currency !~ '^[A-Z]{3}$'
     or period_start is null or period_end is null or period_end < period_start
     or period_end - period_start > 366
     or request_key is null then
    raise exception 'Invalid budget details' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(request_key::text, 0));

  select * into existing from public.workspace_budgets b
  where b.workspace_id = target_workspace and b.request_key = create_workspace_budget.request_key;

  if found then
    if existing.name <> trim(budget_name)
       or existing.amount <> budget_amount
       or existing.currency <> budget_currency
       or existing.account_id is distinct from target_account
       or existing.period_start <> period_start
       or existing.period_end <> period_end then
      raise exception 'Idempotency key payload mismatch' using errcode = '22023';
    end if;
    return existing.id;
  end if;

  if target_account is not null then
    select a.currency into account_currency
    from public.financial_accounts a
    where a.id = target_account and a.workspace_id = target_workspace and a.is_active;
    if not found or account_currency <> budget_currency then
      raise exception 'Account must be active in this workspace and match budget currency' using errcode = '23514';
    end if;
  end if;

  insert into public.workspace_budgets(
    workspace_id, name, amount, currency, account_id,
    period_start, period_end, request_key, created_by
  ) values (
    target_workspace, trim(budget_name), budget_amount, budget_currency,
    target_account, period_start, period_end, request_key, actor
  ) returning id into new_id;

  insert into public.workspace_audit_log(
    workspace_id, actor_id, action, entity_type, entity_id, details
  ) values (
    target_workspace, actor, 'BUDGET_CREATED', 'workspace_budget', new_id,
    jsonb_build_object('amount', budget_amount, 'currency', budget_currency,
      'period_start', period_start, 'period_end', period_end, 'account_id', target_account)
  );

  return new_id;
end;
$$;

revoke all on function public.create_workspace_budget(uuid, text, numeric, char, uuid, date, date, uuid) from public, anon;
grant execute on function public.create_workspace_budget(uuid, text, numeric, char, uuid, date, date, uuid) to authenticated;
