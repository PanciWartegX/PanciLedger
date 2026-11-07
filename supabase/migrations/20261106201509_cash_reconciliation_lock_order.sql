-- Lock the account before taking a fresh balance snapshot. This serializes
-- reconciliation with the ledger RPCs that lock the same account row.

create or replace function public.create_cash_reconciliation(
  target_workspace uuid,
  target_account uuid,
  counted_amount numeric,
  reconciliation_notes text,
  request_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  expected_amount numeric(20,2);
  new_id uuid;
begin
  if actor is null or not public.has_workspace_role(
    target_workspace,
    array['OWNER','ADMIN','TREASURER']::public.workspace_role[]
  ) then
    raise exception 'Insufficient workspace permissions' using errcode = '42501';
  end if;

  if target_workspace is null or target_account is null
     or counted_amount is null or counted_amount < 0
     or counted_amount > 999999999999999999
     or request_key is null
     or (reconciliation_notes is not null and char_length(reconciliation_notes) > 500) then
    raise exception 'Invalid cash reconciliation details' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(request_key::text, 0));

  select cr.id into new_id
  from public.cash_reconciliations cr
  where cr.workspace_id = target_workspace and cr.request_key = create_cash_reconciliation.request_key;

  if new_id is not null then
    return new_id;
  end if;

  perform 1
  from public.financial_accounts a
  where a.id = target_account
    and a.workspace_id = target_workspace
    and a.is_active
  for update;

  if not found then
    raise exception 'Active account not found in this workspace' using errcode = 'P0002';
  end if;

  select v.current_balance into expected_amount
  from public.workspace_account_balances v
  where v.id = target_account and v.workspace_id = target_workspace;

  if expected_amount is null then
    raise exception 'Unable to calculate account balance' using errcode = 'P0002';
  end if;

  insert into public.cash_reconciliations(
    workspace_id, account_id, expected_balance, counted_balance,
    notes, request_key, reconciled_by
  ) values (
    target_workspace, target_account, expected_amount, counted_amount,
    nullif(trim(reconciliation_notes), ''), request_key, actor
  )
  returning id into new_id;

  insert into public.workspace_audit_log(
    workspace_id, actor_id, action, entity_type, entity_id, details
  ) values (
    target_workspace, actor, 'CASH_RECONCILED', 'cash_reconciliation', new_id,
    jsonb_build_object(
      'account_id', target_account,
      'expected_balance', expected_amount,
      'counted_balance', counted_amount,
      'difference', counted_amount - expected_amount
    )
  );

  return new_id;
end;
$$;

revoke all on function public.create_cash_reconciliation(uuid, uuid, numeric, text, uuid) from public, anon;
grant execute on function public.create_cash_reconciliation(uuid, uuid, numeric, text, uuid) to authenticated;
