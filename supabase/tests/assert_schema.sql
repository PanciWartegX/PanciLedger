-- Guard against silently omitting a feature migration or RLS policy.
do $$
declare
  required_table text;
  required_tables text[] := array[
    'workspaces',
    'workspace_members',
    'financial_accounts',
    'financial_transactions',
    'workspace_audit_log',
    'cash_reconciliations',
    'workspace_budgets',
    'pooled_funds',
    'pooled_fund_commitments',
    'pooled_fund_contributions',
    'pooled_fund_expenses',
    'savings_goals',
    'savings_movements',
    'recurring_transactions',
    'recurring_execution_logs',
    'notifications',
    'workspace_invitations'
  ];
begin
  foreach required_table in array required_tables loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'Required table public.% is missing', required_table;
    end if;
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = required_table
        and c.relrowsecurity
    ) then
      raise exception 'RLS is not enabled on public.%', required_table;
    end if;
  end loop;

  if to_regprocedure('public.create_and_post_transaction(uuid,uuid,public.transaction_kind,numeric,text,uuid)') is null then
    raise exception 'Atomic transaction RPC is missing';
  end if;
  if to_regprocedure('public.create_cash_reconciliation(uuid,uuid,numeric,text,uuid)') is null then
    raise exception 'Cash reconciliation RPC is missing';
  end if;
  if to_regprocedure('public.create_workspace_budget(uuid,text,numeric,char,uuid,date,date,uuid)') is null then
    raise exception 'Workspace budget RPC is missing';
  end if;
  if to_regprocedure('public.create_pooled_fund(uuid,text,numeric,char,uuid,date,uuid)') is null then
    raise exception 'Pooled fund RPC is missing';
  end if;
  if to_regprocedure('public.create_savings_goal(uuid,text,numeric,char,uuid,date)') is null then
    raise exception 'Savings goal RPC is missing';
  end if;
  if to_regprocedure('public.execute_due_recurring(uuid,integer)') is null then
    raise exception 'Recurring execution RPC is missing';
  end if;
  if to_regprocedure('public.accept_workspace_invitation(uuid)') is null then
    raise exception 'Invitation acceptance RPC is missing';
  end if;
end;
$$;

select 'PanciLedger schema and RLS smoke checks passed' as result;
