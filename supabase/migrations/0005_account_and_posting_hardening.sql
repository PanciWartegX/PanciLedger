-- PanciLedger hardening: restrict direct account mutation and validate active account posting.
-- Apply after 0004_workspace_rbac_and_atomic_ledger.sql.

drop policy if exists "Treasury roles manage accounts" on public.financial_accounts;
-- Account creation is performed by the audited SECURITY DEFINER RPC.
-- There are intentionally no direct client UPDATE or DELETE policies.
-- Members retain the existing SELECT policy.

create or replace function public.post_transaction(target_transaction uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tx public.financial_transactions%rowtype;
  account_currency char(3);
  account_is_active boolean;
begin
  select * into tx
  from public.financial_transactions
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

  select a.currency, a.is_active
  into account_currency, account_is_active
  from public.financial_accounts a
  where a.id = tx.account_id and a.workspace_id = tx.workspace_id
  for update;

  if not found or account_is_active is distinct from true then
    raise exception 'Transactions can only be posted to an active account in this workspace' using errcode = '23514';
  end if;
  if tx.currency <> account_currency then
    raise exception 'Transaction currency must match its account currency' using errcode = '23514';
  end if;

  update public.financial_transactions
  set status = 'POSTED', posted_at = now()
  where id = target_transaction;

  insert into public.workspace_audit_log(workspace_id, actor_id, action, entity_type, entity_id)
  values (tx.workspace_id, auth.uid(), 'TRANSACTION_POSTED', 'financial_transaction', target_transaction);

  return target_transaction;
end;
$$;

revoke all on function public.post_transaction(uuid) from public, anon;
grant execute on function public.post_transaction(uuid) to authenticated;
