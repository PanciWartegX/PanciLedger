-- PanciLedger: hardened workspace membership, atomic ledger operations and balances.
-- Apply after migrations 0001-0003 using Supabase CLI.

create type public.ledger_direction as enum ('IN', 'OUT');

alter table public.financial_transactions
  add column direction public.ledger_direction,
  add column transfer_id uuid;

update public.financial_transactions
set direction = case
  when kind = 'EXPENSE' then 'OUT'::public.ledger_direction
  else 'IN'::public.ledger_direction
end;

alter table public.financial_transactions
  alter column direction set not null,
  alter column direction set default 'IN';

alter table public.financial_transactions
  add constraint financial_transactions_transfer_kind_check
  check ((kind = 'TRANSFER') = (transfer_id is not null));

create unique index financial_transactions_one_reversal_idx
  on public.financial_transactions(reversal_of)
  where reversal_of is not null;

create table public.workspace_audit_log (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  entity_type text not null check (char_length(entity_type) between 1 and 80),
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index workspace_audit_log_workspace_created_idx
  on public.workspace_audit_log(workspace_id, created_at desc);
alter table public.workspace_audit_log enable row level security;

create policy "Auditors and workspace admins can view audit log"
on public.workspace_audit_log for select to authenticated
using (public.has_workspace_role(
  workspace_id,
  array['OWNER','ADMIN','AUDITOR']::public.workspace_role[]
));

-- Membership writes go through narrow RPCs; users cannot promote themselves by
-- directly updating their membership row.
drop policy if exists "Owners and admins manage membership" on public.workspace_members;

create or replace function public.create_workspace(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  new_workspace_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if workspace_name is null or char_length(trim(workspace_name)) not between 1 and 80 then
    raise exception 'Workspace name must be between 1 and 80 characters' using errcode = '22023';
  end if;

  insert into public.workspaces(name, created_by)
  values (trim(workspace_name), actor)
  returning id into new_workspace_id;

  insert into public.workspace_audit_log(workspace_id, actor_id, action, entity_type, entity_id)
  values (new_workspace_id, actor, 'WORKSPACE_CREATED', 'workspace', new_workspace_id);

  return new_workspace_id;
end;
$$;

create or replace function public.add_workspace_member(
  target_workspace uuid,
  target_user uuid,
  assigned_role public.workspace_role default 'MEMBER'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role public.workspace_role;
begin
  select m.role into actor_role
  from public.workspace_members m
  where m.workspace_id = target_workspace and m.user_id = auth.uid();

  if actor_role is null or actor_role not in ('OWNER', 'ADMIN') then
    raise exception 'Insufficient workspace permissions' using errcode = '42501';
  end if;
  if assigned_role in ('OWNER', 'ADMIN') and actor_role <> 'OWNER' then
    raise exception 'Only an owner can assign owner or admin roles' using errcode = '42501';
  end if;
  if actor_role = 'OWNER' and assigned_role <> 'OWNER' then
    if exists (select 1 from public.workspace_members m
               where m.workspace_id = target_workspace and m.user_id = target_user and m.role = 'OWNER')
       and (select count(*) from public.workspace_members m
            where m.workspace_id = target_workspace and m.role = 'OWNER') <= 1 then
      raise exception 'A workspace must retain at least one owner' using errcode = '23514';
    end if;
  end if;

  insert into public.workspace_members(workspace_id, user_id, role)
  values (target_workspace, target_user, assigned_role)
  on conflict (workspace_id, user_id) do update set role = excluded.role
  where actor_role = 'OWNER'
     or public.workspace_members.role not in ('OWNER', 'ADMIN');

  if not found then
    raise exception 'Cannot change an owner or admin membership' using errcode = '42501';
  end if;

  insert into public.workspace_audit_log(workspace_id, actor_id, action, entity_type, details)
  values (target_workspace, auth.uid(), 'MEMBER_ADDED_OR_ROLE_CHANGED', 'workspace_member',
    jsonb_build_object('user_id', target_user, 'role', assigned_role));
end;
$$;

create or replace function public.remove_workspace_member(
  target_workspace uuid,
  target_user uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role public.workspace_role;
  target_role public.workspace_role;
  owner_count bigint;
begin
  select role into actor_role from public.workspace_members
  where workspace_id = target_workspace and user_id = auth.uid();
  select role into target_role from public.workspace_members
  where workspace_id = target_workspace and user_id = target_user
  for update;

  if actor_role is null or actor_role not in ('OWNER', 'ADMIN') or target_role is null then
    raise exception 'Insufficient permissions or member not found' using errcode = '42501';
  end if;
  if target_role in ('OWNER', 'ADMIN') and actor_role <> 'OWNER' then
    raise exception 'Only an owner can remove an owner or admin' using errcode = '42501';
  end if;
  if target_role = 'OWNER' then
    select count(*) into owner_count from public.workspace_members
    where workspace_id = target_workspace and role = 'OWNER';
    if owner_count <= 1 then
      raise exception 'A workspace must retain at least one owner' using errcode = '23514';
    end if;
  end if;

  delete from public.workspace_members
  where workspace_id = target_workspace and user_id = target_user;

  insert into public.workspace_audit_log(workspace_id, actor_id, action, entity_type, details)
  values (target_workspace, auth.uid(), 'MEMBER_REMOVED', 'workspace_member',
    jsonb_build_object('user_id', target_user));
end;
$$;

create or replace function public.create_financial_account(
  target_workspace uuid,
  account_name text,
  account_currency char(3) default 'IDR',
  initial_balance numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_account_id uuid;
begin
  if not public.has_workspace_role(
    target_workspace,
    array['OWNER','ADMIN','TREASURER']::public.workspace_role[]
  ) then
    raise exception 'Insufficient workspace permissions' using errcode = '42501';
  end if;
  if account_name is null or char_length(trim(account_name)) not between 1 and 80
     or account_currency !~ '^[A-Z]{3}$'
     or initial_balance is null or abs(initial_balance) > 999999999999999999 then
    raise exception 'Invalid account details' using errcode = '22023';
  end if;

  insert into public.financial_accounts(workspace_id, name, currency, opening_balance)
  values (target_workspace, trim(account_name), account_currency, initial_balance)
  returning id into new_account_id;

  insert into public.workspace_audit_log(workspace_id, actor_id, action, entity_type, entity_id)
  values (target_workspace, auth.uid(), 'ACCOUNT_CREATED', 'financial_account', new_account_id);

  return new_account_id;
end;
$$;

create or replace function public.post_transaction(target_transaction uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tx public.financial_transactions%rowtype;
begin
  select * into tx from public.financial_transactions
  where id = target_transaction
  for update;

  if not found then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;
  if tx.created_by <> auth.uid()
     and not public.has_workspace_role(tx.workspace_id, array['OWNER','ADMIN','TREASURER']::public.workspace_role[]) then
    raise exception 'Insufficient workspace permissions' using errcode = '42501';
  end if;
  if not public.has_workspace_role(tx.workspace_id, array['OWNER','ADMIN','TREASURER']::public.workspace_role[]) then
    raise exception 'Insufficient workspace permissions' using errcode = '42501';
  end if;
  if tx.status <> 'DRAFT' or tx.kind in ('TRANSFER','REVERSAL') then
    raise exception 'Only income, expense or adjustment drafts can be posted here' using errcode = '23514';
  end if;
  if tx.kind = 'INCOME' and tx.direction <> 'IN' then
    raise exception 'Income must increase the account balance' using errcode = '23514';
  end if;
  if tx.kind = 'EXPENSE' and tx.direction <> 'OUT' then
    raise exception 'Expense must decrease the account balance' using errcode = '23514';
  end if;

  update public.financial_transactions
  set status = 'POSTED', posted_at = now()
  where id = target_transaction;

  insert into public.workspace_audit_log(workspace_id, actor_id, action, entity_type, entity_id)
  values (tx.workspace_id, auth.uid(), 'TRANSACTION_POSTED', 'financial_transaction', target_transaction);

  return target_transaction;
end;
$$;

create or replace function public.create_transfer(
  target_workspace uuid,
  source_account uuid,
  destination_account uuid,
  transfer_amount numeric,
  transfer_description text,
  request_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  transfer_group uuid := gen_random_uuid();
  source_currency char(3);
  destination_currency char(3);
  existing_group uuid;
  actor uuid := auth.uid();
begin
  if actor is null or not public.has_workspace_role(
    target_workspace,
    array['OWNER','ADMIN','TREASURER']::public.workspace_role[]
  ) then
    raise exception 'Insufficient workspace permissions' using errcode = '42501';
  end if;
  if source_account = destination_account or transfer_amount is null or transfer_amount <= 0
     or transfer_amount > 999999999999999999
     or transfer_description is null or char_length(trim(transfer_description)) not between 1 and 240
     or request_key is null then
    raise exception 'Invalid transfer details' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(request_key::text, 0));
  select transfer_id into existing_group
  from public.financial_transactions
  where workspace_id = target_workspace and idempotency_key = request_key;
  if existing_group is not null then
    return existing_group;
  end if;

  select currency into source_currency from public.financial_accounts
  where id = source_account and workspace_id = target_workspace and is_active for update;
  select currency into destination_currency from public.financial_accounts
  where id = destination_account and workspace_id = target_workspace and is_active for update;

  if source_currency is null or destination_currency is null or source_currency <> destination_currency then
    raise exception 'Both active accounts must belong to this workspace and use the same currency' using errcode = '23514';
  end if;

  insert into public.financial_transactions(
    workspace_id, account_id, kind, status, amount, currency, description,
    idempotency_key, created_by, direction, transfer_id, posted_at
  ) values (
    target_workspace, source_account, 'TRANSFER', 'POSTED', transfer_amount,
    source_currency, trim(transfer_description), request_key, actor, 'OUT', transfer_group, now()
  );

  insert into public.financial_transactions(
    workspace_id, account_id, kind, status, amount, currency, description,
    idempotency_key, created_by, direction, transfer_id, posted_at
  ) values (
    target_workspace, destination_account, 'TRANSFER', 'POSTED', transfer_amount,
    destination_currency, trim(transfer_description), gen_random_uuid(), actor, 'IN', transfer_group, now()
  );

  insert into public.workspace_audit_log(workspace_id, actor_id, action, entity_type, entity_id, details)
  values (target_workspace, actor, 'TRANSFER_POSTED', 'transfer', transfer_group,
    jsonb_build_object('source_account', source_account, 'destination_account', destination_account, 'amount', transfer_amount));

  return transfer_group;
end;
$$;

create or replace function public.reverse_transaction(
  target_transaction uuid,
  request_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  original public.financial_transactions%rowtype;
  reversal_id uuid;
begin
  select * into original from public.financial_transactions
  where id = target_transaction
  for update;

  if not found or original.status <> 'POSTED' then
    raise exception 'Posted transaction not found' using errcode = 'P0002';
  end if;
  if not public.has_workspace_role(original.workspace_id, array['OWNER','ADMIN','TREASURER']::public.workspace_role[]) then
    raise exception 'Insufficient workspace permissions' using errcode = '42501';
  end if;
  if original.kind in ('TRANSFER', 'REVERSAL') then
    raise exception 'This transaction type cannot be reversed through the single-entry reversal workflow' using errcode = '0A000';
  end if;

  select id into reversal_id from public.financial_transactions where reversal_of = target_transaction;
  if reversal_id is not null then
    return reversal_id;
  end if;

  insert into public.financial_transactions(
    workspace_id, account_id, kind, status, amount, currency, description,
    idempotency_key, created_by, reversal_of, posted_at, direction
  ) values (
    original.workspace_id, original.account_id, 'REVERSAL', 'POSTED',
    original.amount, original.currency, 'Reversal: ' || original.description,
    request_key, auth.uid(), target_transaction, now(),
    case when original.direction = 'IN' then 'OUT'::public.ledger_direction else 'IN'::public.ledger_direction end
  )
  returning id into reversal_id;

  insert into public.workspace_audit_log(workspace_id, actor_id, action, entity_type, entity_id, details)
  values (original.workspace_id, auth.uid(), 'TRANSACTION_REVERSED', 'financial_transaction', reversal_id,
    jsonb_build_object('reversed_transaction_id', target_transaction));

  return reversal_id;
end;
$$;

create or replace view public.workspace_account_balances
with (security_invoker = true)
as
select
  a.id,
  a.workspace_id,
  a.name,
  a.currency,
  a.opening_balance,
  a.is_active,
  a.created_at,
  a.opening_balance + coalesce(sum(
    case when t.direction = 'IN' then t.amount else -t.amount end
  ) filter (where t.status = 'POSTED'), 0) as current_balance
from public.financial_accounts a
left join public.financial_transactions t
  on t.account_id = a.id and t.workspace_id = a.workspace_id
group by a.id;

grant select on public.workspace_account_balances to authenticated;
revoke all on function public.create_workspace(text) from public, anon;
revoke all on function public.add_workspace_member(uuid, uuid, public.workspace_role) from public, anon;
revoke all on function public.remove_workspace_member(uuid, uuid) from public, anon;
revoke all on function public.create_financial_account(uuid, text, char, numeric) from public, anon;
revoke all on function public.post_transaction(uuid) from public, anon;
revoke all on function public.create_transfer(uuid, uuid, uuid, numeric, text, uuid) from public, anon;
revoke all on function public.reverse_transaction(uuid, uuid) from public, anon;

grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.add_workspace_member(uuid, uuid, public.workspace_role) to authenticated;
grant execute on function public.remove_workspace_member(uuid, uuid) to authenticated;
grant execute on function public.create_financial_account(uuid, text, char, numeric) to authenticated;
grant execute on function public.post_transaction(uuid) to authenticated;
grant execute on function public.create_transfer(uuid, uuid, uuid, numeric, text, uuid) to authenticated;
grant execute on function public.reverse_transaction(uuid, uuid) to authenticated;
