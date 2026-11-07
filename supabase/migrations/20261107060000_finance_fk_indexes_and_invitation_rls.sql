-- Cover foreign keys on finance extension tables and avoid per-row JWT evaluation.
create index if not exists pooled_fund_commitments_created_by_idx
  on public.pooled_fund_commitments(created_by);
create index if not exists pooled_fund_commitments_member_idx
  on public.pooled_fund_commitments(workspace_id, member_id);
create index if not exists pooled_fund_contributions_member_idx
  on public.pooled_fund_contributions(workspace_id, contributor_id);
create index if not exists pooled_fund_contributions_recorded_by_idx
  on public.pooled_fund_contributions(recorded_by);
create index if not exists pooled_fund_expenses_created_by_idx
  on public.pooled_fund_expenses(created_by);
create index if not exists pooled_funds_created_by_idx
  on public.pooled_funds(created_by);
create index if not exists recurring_execution_logs_executed_by_idx
  on public.recurring_execution_logs(executed_by);
create index if not exists recurring_execution_logs_template_idx
  on public.recurring_execution_logs(workspace_id, recurring_transaction_id);
create index if not exists recurring_transactions_account_idx
  on public.recurring_transactions(workspace_id, account_id);
create index if not exists recurring_transactions_created_by_idx
  on public.recurring_transactions(created_by);
create index if not exists savings_goals_created_by_idx
  on public.savings_goals(created_by);
create index if not exists savings_movements_created_by_idx
  on public.savings_movements(created_by);
create index if not exists workspace_budgets_created_by_idx
  on public.workspace_budgets(created_by);
create index if not exists workspace_invitations_invited_by_idx
  on public.workspace_invitations(invited_by);

drop policy if exists "Workspace admins and invitees read invitations"
  on public.workspace_invitations;
create policy "Workspace admins and invitees read invitations"
  on public.workspace_invitations for select to authenticated
  using (
    public.has_workspace_role(workspace_id, array['OWNER','ADMIN']::public.workspace_role[])
    or lower(invited_email) = lower(coalesce((select auth.jwt()->>'email'), ''))
  );
