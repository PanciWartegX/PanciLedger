-- PanciLedger: least-privilege grants and missing foreign-key indexes.
-- Apply after 0001-0006.

-- Remove broad default table/view grants. Regrant only the operations used by
-- the application; row-level policies remain the authorization boundary.
revoke all on all tables in schema public from public, anon, authenticated;

grant select on public.workspaces to authenticated;
grant select on public.workspace_members to authenticated;
grant select on public.financial_accounts to authenticated;
grant select, insert on public.financial_transactions to authenticated;
grant select on public.workspace_audit_log to authenticated;
grant select on public.workspace_account_balances to authenticated;

-- RLS helper functions are only needed by authenticated policies and RPCs.
revoke all on function public.has_workspace_role(uuid, public.workspace_role[]) from public, anon;
revoke all on function public.is_workspace_member(uuid) from public, anon;
grant execute on function public.has_workspace_role(uuid, public.workspace_role[]) to authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;

-- This function is only an event-trigger callback, not an API/RPC endpoint.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- Explicitly retain authenticated-only access for application RPCs.
revoke all on function public.create_workspace(text) from public, anon;
revoke all on function public.create_financial_account(uuid, text, char, numeric) from public, anon;
revoke all on function public.post_transaction(uuid) from public, anon;
revoke all on function public.create_transfer(uuid, uuid, uuid, numeric, text, uuid) from public, anon;
revoke all on function public.reverse_transaction(uuid, uuid) from public, anon;
revoke all on function public.add_workspace_member(uuid, uuid, public.workspace_role) from public, anon;
revoke all on function public.remove_workspace_member(uuid, uuid) from public, anon;

grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.create_financial_account(uuid, text, char, numeric) to authenticated;
grant execute on function public.post_transaction(uuid) to authenticated;
grant execute on function public.create_transfer(uuid, uuid, uuid, numeric, text, uuid) to authenticated;
grant execute on function public.reverse_transaction(uuid, uuid) to authenticated;
grant execute on function public.add_workspace_member(uuid, uuid, public.workspace_role) to authenticated;
grant execute on function public.remove_workspace_member(uuid, uuid) to authenticated;

-- Cover foreign keys that are not already the leading columns of an index.
create index if not exists workspaces_created_by_idx
  on public.workspaces(created_by);
create index if not exists financial_transactions_workspace_account_idx
  on public.financial_transactions(workspace_id, account_id);
create index if not exists financial_transactions_created_by_idx
  on public.financial_transactions(created_by);
create index if not exists workspace_audit_log_actor_idx
  on public.workspace_audit_log(actor_id);
