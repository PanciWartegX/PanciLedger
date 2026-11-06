-- PanciLedger: make income/expense creation and posting a single atomic RPC.
-- Apply after 0001-0007.

create or replace function public.create_and_post_transaction(
  target_workspace uuid,
  target_account uuid,
  transaction_type public.transaction_kind,
  transaction_amount numeric,
  transaction_description text,
  request_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  account_currency char(3);
  existing_tx public.financial_transactions%rowtype;
  new_transaction_id uuid;
begin
  if actor is null or not public.has_workspace_role(
    target_workspace,
    array['OWNER','ADMIN','TREASURER']::public.workspace_role[]
  ) then
    raise exception 'Insufficient workspace permissions' using errcode = '42501';
  end if;

  if transaction_type is null or transaction_type not in ('INCOME','EXPENSE')
     or transaction_amount is null or transaction_amount <= 0
     or transaction_amount > 999999999999999999.99
     or transaction_description is null
     or char_length(trim(transaction_description)) not between 1 and 240
     or request_key is null then
    raise exception 'Invalid transaction details' using errcode = '22023';
  end if;

  -- Make retries with the same request key safe.
  select * into existing_tx
  from public.financial_transactions
  where workspace_id = target_workspace and idempotency_key = request_key
  for update;

  if found then
    if existing_tx.created_by = actor
       and existing_tx.account_id = target_account
       and existing_tx.kind = transaction_type
       and existing_tx.amount = transaction_amount
       and existing_tx.description = trim(transaction_description)
       and existing_tx.status = 'POSTED' then
      return existing_tx.id;
    end if;
    raise exception 'Idempotency key has already been used' using errcode = '23505';
  end if;

  select a.currency into account_currency
  from public.financial_accounts a
  where a.id = target_account
    and a.workspace_id = target_workspace
    and a.is_active
  for update;

  if not found then
    raise exception 'Active account not found in this workspace' using errcode = '23514';
  end if;

  insert into public.financial_transactions(
    workspace_id, account_id, kind, status, amount, currency,
    description, idempotency_key, created_by, direction
  ) values (
    target_workspace, target_account, transaction_type, 'DRAFT',
    transaction_amount, account_currency, trim(transaction_description),
    request_key, actor,
    case when transaction_type = 'EXPENSE'
      then 'OUT'::public.ledger_direction
      else 'IN'::public.ledger_direction
    end
  )
  returning id into new_transaction_id;

  -- Posting happens inside this same database transaction. Any validation
  -- failure rolls back both the draft insert and the attempted posting.
  perform public.post_transaction(new_transaction_id);

  return new_transaction_id;
end;
$$;

revoke all on function public.create_and_post_transaction(
  uuid, uuid, public.transaction_kind, numeric, text, uuid
) from public, anon;
grant execute on function public.create_and_post_transaction(
  uuid, uuid, public.transaction_kind, numeric, text, uuid
) to authenticated;

-- All new ledger entries must go through the atomic, validated RPC.
revoke insert on public.financial_transactions from authenticated;
