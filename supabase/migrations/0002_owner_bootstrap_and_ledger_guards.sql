-- Bootstrap the creator as workspace owner and protect posted ledger rows.
create function public.bootstrap_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.created_by, 'OWNER');
  return new;
end;
$$;

create trigger workspaces_bootstrap_owner
after insert on public.workspaces
for each row execute function public.bootstrap_workspace_owner();

create function public.guard_posted_transaction_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'POSTED' then
    raise exception 'Posted financial transactions are immutable; create a reversal instead'
      using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger financial_transactions_immutable_posted
before update or delete on public.financial_transactions
for each row execute function public.guard_posted_transaction_mutation();

-- Keep the owner bootstrap function callable only by the trigger execution context.
revoke all on function public.bootstrap_workspace_owner() from public, anon, authenticated;
revoke all on function public.guard_posted_transaction_mutation() from public, anon, authenticated;
