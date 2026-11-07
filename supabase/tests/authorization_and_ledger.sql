-- Behavioral integration tests against the disposable PostgreSQL CI database.
-- Run as the postgres service account; switch to authenticated for API calls.

grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;

insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-0000-0000-000000000001','owner@panciledger.test',now()),
 ('00000000-0000-0000-0000-000000000002','viewer@panciledger.test',now()),
 ('00000000-0000-0000-0000-000000000003','treasurer@panciledger.test',now()),
 ('00000000-0000-0000-0000-000000000004','outsider@panciledger.test',now()),
 ('00000000-0000-0000-0000-000000000005','invitee@panciledger.test',now()),
 ('00000000-0000-0000-0000-000000000006','admin@panciledger.test',now());

insert into public.workspaces(id,name,created_by) values
 ('10000000-0000-0000-0000-000000000001','Workspace A','00000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002','Workspace B','00000000-0000-0000-0000-000000000004');

insert into public.workspace_members(workspace_id,user_id,role) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','VIEWER'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','TREASURER'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000006','ADMIN');

insert into public.financial_accounts(id,workspace_id,name,currency,opening_balance) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Operasional','IDR',1000),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Dana Bersama','IDR',0),
 ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Tabungan','IDR',0),
 ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','Rekening Lain','IDR',500),
 ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000002','Workspace B account','IDR',0);

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);

do $$
declare
  visible_count integer;
  tx1 uuid;
  tx2 uuid;
  budget1 uuid;
  budget2 uuid;
  v_fund_id uuid;
  invite_token uuid;
  v_goal_id uuid;
  movement_id uuid;
  progress numeric;
  pooled_balance numeric;
  transfer_balance numeric;
begin
  select count(*) into visible_count from public.workspaces;
  if visible_count <> 1 then raise exception 'Workspace isolation failed for owner: % visible workspaces', visible_count; end if;

  tx1 := public.create_and_post_transaction(
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'INCOME',100,'CI idempotent income',
    '30000000-0000-0000-0000-000000000001'
  );
  tx2 := public.create_and_post_transaction(
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'INCOME',100,'CI idempotent income',
    '30000000-0000-0000-0000-000000000001'
  );
  if tx1 <> tx2 then raise exception 'Transaction idempotency failed'; end if;

  budget1 := public.create_workspace_budget(
    '10000000-0000-0000-0000-000000000001','CI budget',500,'IDR',null,
    current_date,current_date+30,'30000000-0000-0000-0000-000000000002'
  );
  budget2 := public.create_workspace_budget(
    '10000000-0000-0000-0000-000000000001','CI budget',500,'IDR',null,
    current_date,current_date+30,'30000000-0000-0000-0000-000000000002'
  );
  if budget1 <> budget2 then raise exception 'Budget idempotency failed'; end if;

  v_fund_id := public.create_pooled_fund(
    '10000000-0000-0000-0000-000000000001','CI pooled fund',200,'IDR',
    '20000000-0000-0000-0000-000000000002',current_date+30,
    '30000000-0000-0000-0000-000000000003'
  );
  perform public.record_pooled_fund_contribution(
    v_fund_id,'00000000-0000-0000-0000-000000000002',100,'CI contribution',
    '30000000-0000-0000-0000-000000000004'
  );
  begin
    perform public.record_pooled_fund_expense(
      v_fund_id,120,'Must exceed available fund balance',
      '30000000-0000-0000-0000-000000000005'
    );
    raise exception 'Pooled fund accepted an expense above available balance';
  exception when check_violation then
    null;
  end;
  perform public.record_pooled_fund_expense(
    v_fund_id,80,'CI valid expense','30000000-0000-0000-0000-000000000006'
  );
  select balance into pooled_balance from public.pooled_fund_balances where pooled_fund_balances.fund_id=v_fund_id;
  if pooled_balance <> 20 then raise exception 'Pooled fund balance mismatch: %', pooled_balance; end if;

  v_goal_id := public.create_savings_goal(
    '10000000-0000-0000-0000-000000000001','CI savings goal',500,'IDR',
    '20000000-0000-0000-0000-000000000003',current_date+90
  );
  movement_id := public.move_savings_funds(
    v_goal_id,'DEPOSIT',50,'20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000007'
  );
  perform public.move_savings_funds(
    v_goal_id,'WITHDRAWAL',10,'20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000008'
  );
  select balance into progress from public.savings_goal_progress where savings_goal_progress.goal_id=v_goal_id;
  if progress <> 40 then raise exception 'Savings balance mismatch: %', progress; end if;

  invite_token := public.create_workspace_invitation(
    '10000000-0000-0000-0000-000000000001','invitee@panciledger.test','MEMBER'
  );
  begin
    perform public.create_workspace_invitation(
      '10000000-0000-0000-0000-000000000001','invitee@panciledger.test','MEMBER'
    );
    raise exception 'Active duplicate invitation was accepted';
  exception when unique_violation then
    null;
  end;

  if not exists(select 1 from public.notifications where recipient_id='00000000-0000-0000-0000-000000000001') then
    raise exception 'Expected owner transaction notifications were not created';
  end if;
end;
$$;

-- A viewer can read their own workspace, but cannot read another workspace,
-- its financial accounts or restricted audit records, and cannot create budgets.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$
declare n integer;
begin
  select count(*) into n from public.workspaces;
  if n<>1 then raise exception 'Viewer workspace isolation failed: %',n; end if;
  select count(*) into n from public.financial_accounts where workspace_id='10000000-0000-0000-0000-000000000002';
  if n<>0 then raise exception 'Viewer can read another workspace account'; end if;
  select count(*) into n from public.workspace_audit_log;
  if n<>0 then raise exception 'Viewer can read restricted audit log'; end if;
  begin
    perform public.create_workspace_budget(
      '10000000-0000-0000-0000-000000000001','Forbidden budget',100,'IDR',null,
      current_date,current_date+7,'30000000-0000-0000-0000-000000000009'
    );
    raise exception 'Viewer was allowed to create a budget';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

-- A treasurer can post financial entries but still cannot administer membership.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$
declare n integer;
begin
  perform public.create_and_post_transaction(
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'EXPENSE',25,'CI treasurer expense',
    '30000000-0000-0000-0000-000000000010'
  );
  begin
    perform public.add_workspace_member(
      '10000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000005',
      'MEMBER'
    );
    raise exception 'Treasurer was allowed to administer workspace membership';
  exception when insufficient_privilege then
    null;
  end;
  select current_balance into n from public.workspace_account_balances
  where id='20000000-0000-0000-0000-000000000001';
  if n<>1035 then raise exception 'Ledger balance mismatch: %',n; end if;
end;
$$;

-- An administrator cannot grant OWNER/ADMIN; that privilege is reserved to OWNER.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',false);
do $$
begin
  begin
    perform public.add_workspace_member(
      '10000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000005',
      'ADMIN'
    );
    raise exception 'Admin was allowed to grant ADMIN';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

-- Expired invitations can be renewed without leaving a stale unique-index entry.
reset role;
update public.workspace_invitations set expires_at=now()-interval '1 minute'
where workspace_id='10000000-0000-0000-0000-000000000001'
  and invited_email='invitee@panciledger.test' and accepted_at is null;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $renew$
declare renewed_token uuid;
begin
  renewed_token := public.create_workspace_invitation(
    '10000000-0000-0000-0000-000000000001','invitee@panciledger.test','MEMBER'
  );
  if renewed_token is null or not exists(select 1 from public.workspace_invitations
    where invited_email='invitee@panciledger.test' and invite_token=renewed_token
      and expires_at>now() and accepted_at is null) then
    raise exception 'Expired invitation renewal failed';
  end if;
end;
$renew$;

-- The invited address must match the verified account before membership is added.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',false);
select set_config('request.jwt.claims','{"email":"invitee@panciledger.test","sub":"00000000-0000-0000-0000-000000000005"}',false);

do $invite$
declare token uuid;
begin
  select invite_token into token from public.workspace_invitations
  where invited_email='invitee@panciledger.test' and accepted_at is null;
  if token is null then raise exception 'Invitation fixture missing'; end if;
  perform public.accept_workspace_invitation(token);
  if not exists(select 1 from public.workspace_members
    where workspace_id='10000000-0000-0000-0000-000000000001'
      and user_id='00000000-0000-0000-0000-000000000005' and role='MEMBER') then
    raise exception 'Verified invitation acceptance failed';
  end if;
end;
$$;

reset role;
select 'PanciLedger authorization and ledger integration tests passed' as result;
