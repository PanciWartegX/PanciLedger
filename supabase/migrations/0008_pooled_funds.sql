-- Pooled funds: commitments, contributions and expenses backed by posted ledger entries.
create table public.pooled_funds (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 1 and 80),
 target_amount numeric(20,2) not null check (target_amount > 0 and target_amount <= 999999999999999999),
 currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
 account_id uuid not null,
 target_date date,
 is_active boolean not null default true,
 request_key uuid not null,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 constraint pooled_funds_account_fk foreign key (workspace_id,account_id) references public.financial_accounts(workspace_id,id) on delete restrict,
 constraint pooled_funds_workspace_id_id_key unique(workspace_id,id),
 constraint pooled_funds_idempotency unique(workspace_id,request_key)
);
create index pooled_funds_workspace_active_idx on public.pooled_funds(workspace_id,is_active,created_at desc);

create table public.pooled_fund_commitments (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 fund_id uuid not null,
 member_id uuid not null,
 committed_amount numeric(20,2) not null check (committed_amount > 0 and committed_amount <= 999999999999999999),
 created_by uuid not null references auth.users(id) on delete restrict,
 updated_at timestamptz not null default now(),
 constraint pooled_fund_commitments_fund_fk foreign key (workspace_id,fund_id) references public.pooled_funds(workspace_id,id) on delete cascade,
 constraint pooled_fund_commitments_member_fk foreign key (workspace_id,member_id) references public.workspace_members(workspace_id,user_id) on delete cascade,
 constraint pooled_fund_commitments_unique unique(fund_id,member_id)
);
create index pooled_fund_commitments_workspace_idx on public.pooled_fund_commitments(workspace_id,fund_id);

create table public.pooled_fund_contributions (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 fund_id uuid not null,
 contributor_id uuid not null,
 recorded_by uuid not null references auth.users(id) on delete restrict,
 amount numeric(20,2) not null check (amount > 0 and amount <= 999999999999999999),
 notes text check (notes is null or char_length(notes) <= 240),
 transaction_id uuid not null unique references public.financial_transactions(id) on delete restrict,
 request_key uuid not null,
 created_at timestamptz not null default now(),
 constraint pooled_fund_contributions_fund_fk foreign key (workspace_id,fund_id) references public.pooled_funds(workspace_id,id) on delete restrict,
 constraint pooled_fund_contributions_member_fk foreign key (workspace_id,contributor_id) references public.workspace_members(workspace_id,user_id) on delete restrict,
 constraint pooled_fund_contributions_idempotency unique(workspace_id,request_key)
);
create index pooled_fund_contributions_fund_created_idx on public.pooled_fund_contributions(workspace_id,fund_id,created_at desc);

create table public.pooled_fund_expenses (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 fund_id uuid not null,
 created_by uuid not null references auth.users(id) on delete restrict,
 amount numeric(20,2) not null check (amount > 0 and amount <= 999999999999999999),
 description text not null check (char_length(trim(description)) between 1 and 240),
 transaction_id uuid not null unique references public.financial_transactions(id) on delete restrict,
 request_key uuid not null,
 created_at timestamptz not null default now(),
 constraint pooled_fund_expenses_fund_fk foreign key (workspace_id,fund_id) references public.pooled_funds(workspace_id,id) on delete restrict,
 constraint pooled_fund_expenses_idempotency unique(workspace_id,request_key)
);
create index pooled_fund_expenses_fund_created_idx on public.pooled_fund_expenses(workspace_id,fund_id,created_at desc);

alter table public.pooled_funds enable row level security;
alter table public.pooled_fund_commitments enable row level security;
alter table public.pooled_fund_contributions enable row level security;
alter table public.pooled_fund_expenses enable row level security;
create policy "Workspace members read pooled funds" on public.pooled_funds for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace members read fund commitments" on public.pooled_fund_commitments for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace members read fund contributions" on public.pooled_fund_contributions for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace members read fund expenses" on public.pooled_fund_expenses for select to authenticated using (public.is_workspace_member(workspace_id));
revoke all on public.pooled_funds,public.pooled_fund_commitments,public.pooled_fund_contributions,public.pooled_fund_expenses from public,anon,authenticated;
grant select on public.pooled_funds,public.pooled_fund_commitments,public.pooled_fund_contributions,public.pooled_fund_expenses to authenticated;

create or replace view public.pooled_fund_balances with (security_invoker=true) as
select f.id as fund_id,f.workspace_id,
 coalesce((select sum(c.amount) from public.pooled_fund_contributions c where c.fund_id=f.id),0)::numeric(20,2) as total_contributions,
 coalesce((select sum(e.amount) from public.pooled_fund_expenses e where e.fund_id=f.id),0)::numeric(20,2) as total_expenses,
 (coalesce((select sum(c.amount) from public.pooled_fund_contributions c where c.fund_id=f.id),0)-coalesce((select sum(e.amount) from public.pooled_fund_expenses e where e.fund_id=f.id),0))::numeric(20,2) as balance
from public.pooled_funds f;
grant select on public.pooled_fund_balances to authenticated;

create or replace view public.pooled_fund_member_progress with (security_invoker=true) as
select c.workspace_id,c.fund_id,c.member_id,c.committed_amount,
 coalesce(sum(p.amount),0)::numeric(20,2) as paid_amount,
 case when coalesce(sum(p.amount),0)>=c.committed_amount then 'PAID'
      when f.target_date is not null and current_date>f.target_date then 'OVERDUE'
      when coalesce(sum(p.amount),0)>0 then 'PARTIAL' else 'PENDING' end as status
from public.pooled_fund_commitments c join public.pooled_funds f on f.id=c.fund_id
left join public.pooled_fund_contributions p on p.fund_id=c.fund_id and p.contributor_id=c.member_id
group by c.workspace_id,c.fund_id,c.member_id,c.committed_amount,f.target_date;
grant select on public.pooled_fund_member_progress to authenticated;

create or replace function public.create_pooled_fund(target_workspace uuid,fund_name text,fund_target numeric,fund_currency char(3),target_account uuid,fund_target_date date,request_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); new_id uuid; account_currency char(3); existing public.pooled_funds%rowtype;
begin
 if actor is null or not public.has_workspace_role(target_workspace,array['OWNER','ADMIN','TREASURER']::public.workspace_role[]) then raise exception 'Insufficient workspace permissions' using errcode='42501'; end if;
 if target_workspace is null or fund_name is null or char_length(trim(fund_name)) not between 1 and 80 or fund_target is null or fund_target<=0 or fund_target>999999999999999999 or fund_currency is null or fund_currency !~ '^[A-Z]{3}$' or target_account is null or request_key is null then raise exception 'Invalid pooled fund details' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(request_key::text,0));
 select * into existing from public.pooled_funds f where f.workspace_id=target_workspace and f.request_key=create_pooled_fund.request_key;
 if found then
  if existing.name<>trim(fund_name) or existing.target_amount<>fund_target or existing.currency<>fund_currency or existing.account_id<>target_account or existing.target_date is distinct from fund_target_date then raise exception 'Idempotency payload mismatch' using errcode='22023'; end if;
  return existing.id;
 end if;
 select a.currency into account_currency from public.financial_accounts a where a.id=target_account and a.workspace_id=target_workspace and a.is_active for update;
 if not found or account_currency<>fund_currency then raise exception 'Fund account must be active and use the fund currency' using errcode='23514'; end if;
 insert into public.pooled_funds(workspace_id,name,target_amount,currency,account_id,target_date,request_key,created_by) values(target_workspace,trim(fund_name),fund_target,fund_currency,target_account,fund_target_date,request_key,actor) returning id into new_id;
 insert into public.workspace_audit_log(workspace_id,actor_id,action,entity_type,entity_id,details) values(target_workspace,actor,'POOLED_FUND_CREATED','pooled_fund',new_id,jsonb_build_object('target_amount',fund_target,'currency',fund_currency));
 return new_id;
end; $$;

create or replace function public.set_pooled_fund_commitment(target_fund uuid,target_member uuid,commitment_amount numeric)
returns uuid language plpgsql security definer set search_path='' as $$
declare f public.pooled_funds%rowtype; actor uuid:=auth.uid(); new_id uuid;
begin
 select * into f from public.pooled_funds where id=target_fund for update;
 if not found or actor is null or not public.has_workspace_role(f.workspace_id,array['OWNER','ADMIN','TREASURER']::public.workspace_role[]) then raise exception 'Insufficient workspace permissions or fund not found' using errcode='42501'; end if;
 if target_member is null or commitment_amount is null or commitment_amount<=0 or commitment_amount>999999999999999999 or not exists(select 1 from public.workspace_members m where m.workspace_id=f.workspace_id and m.user_id=target_member) then raise exception 'Invalid member commitment' using errcode='22023'; end if;
 insert into public.pooled_fund_commitments(workspace_id,fund_id,member_id,committed_amount,created_by) values(f.workspace_id,f.id,target_member,commitment_amount,actor)
 on conflict(fund_id,member_id) do update set committed_amount=excluded.committed_amount,created_by=excluded.created_by,updated_at=now() returning id into new_id;
 insert into public.workspace_audit_log(workspace_id,actor_id,action,entity_type,entity_id,details) values(f.workspace_id,actor,'POOLED_FUND_COMMITMENT_SET','pooled_fund_commitment',new_id,jsonb_build_object('member_id',target_member,'committed_amount',commitment_amount));
 return new_id;
end; $$;

create or replace function public.record_pooled_fund_contribution(target_fund uuid,target_member uuid,contribution_amount numeric,contribution_notes text,request_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare f public.pooled_funds%rowtype; actor uuid:=auth.uid(); tx_id uuid; contribution_id uuid; existing public.pooled_fund_contributions%rowtype;
begin
 select * into f from public.pooled_funds where id=target_fund and is_active for update;
 if not found or actor is null or not public.has_workspace_role(f.workspace_id,array['OWNER','ADMIN','TREASURER']::public.workspace_role[]) then raise exception 'Fund not found or treasury permission required' using errcode='42501'; end if;
 if target_member is null or not exists(select 1 from public.workspace_members m where m.workspace_id=f.workspace_id and m.user_id=target_member) then raise exception 'Contributor must be a workspace member' using errcode='22023'; end if;
 if contribution_amount is null or contribution_amount<=0 or contribution_amount>999999999999999999 or (contribution_notes is not null and char_length(contribution_notes)>240) or request_key is null then raise exception 'Invalid contribution details' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(request_key::text,0));
 select * into existing from public.pooled_fund_contributions c where c.workspace_id=f.workspace_id and c.request_key=record_pooled_fund_contribution.request_key;
 if found then
  if existing.fund_id<>f.id or existing.contributor_id<>target_member or existing.recorded_by<>actor or existing.amount<>contribution_amount or existing.notes is distinct from nullif(trim(contribution_notes),'') then raise exception 'Idempotency payload mismatch' using errcode='22023'; end if;
  return existing.id;
 end if;
 insert into public.financial_transactions(workspace_id,account_id,kind,status,amount,currency,description,idempotency_key,created_by,direction,posted_at)
 values(f.workspace_id,f.account_id,'INCOME','POSTED',contribution_amount,f.currency,coalesce(nullif(trim(contribution_notes),''),'Iuran dana: '||f.name),request_key,actor,'IN',now()) returning id into tx_id;
 insert into public.pooled_fund_contributions(workspace_id,fund_id,contributor_id,recorded_by,amount,notes,transaction_id,request_key)
 values(f.workspace_id,f.id,target_member,actor,contribution_amount,nullif(trim(contribution_notes),''),tx_id,request_key) returning id into contribution_id;
 insert into public.workspace_audit_log(workspace_id,actor_id,action,entity_type,entity_id,details) values(f.workspace_id,actor,'POOLED_FUND_CONTRIBUTION_RECORDED','pooled_fund_contribution',contribution_id,jsonb_build_object('fund_id',f.id,'amount',contribution_amount,'transaction_id',tx_id));
 return contribution_id;
end; $$;

create or replace function public.record_pooled_fund_expense(target_fund uuid,expense_amount numeric,expense_description text,request_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare f public.pooled_funds%rowtype; actor uuid:=auth.uid(); tx_id uuid; expense_id uuid; available numeric; existing public.pooled_fund_expenses%rowtype;
begin
 select * into f from public.pooled_funds where id=target_fund and is_active for update;
 if not found or actor is null or not public.has_workspace_role(f.workspace_id,array['OWNER','ADMIN','TREASURER']::public.workspace_role[]) then raise exception 'Insufficient workspace permissions or fund not found' using errcode='42501'; end if;
 if expense_amount is null or expense_amount<=0 or expense_amount>999999999999999999 or expense_description is null or char_length(trim(expense_description)) not between 1 and 240 or request_key is null then raise exception 'Invalid expense details' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(request_key::text,0));
 select * into existing from public.pooled_fund_expenses e where e.workspace_id=f.workspace_id and e.request_key=record_pooled_fund_expense.request_key;
 if found then
  if existing.fund_id<>f.id or existing.created_by<>actor or existing.amount<>expense_amount or existing.description<>trim(expense_description) then raise exception 'Idempotency payload mismatch' using errcode='22023'; end if;
  return existing.id;
 end if;
 select coalesce(sum(c.amount),0)-coalesce((select sum(e.amount) from public.pooled_fund_expenses e where e.fund_id=f.id),0) into available from public.pooled_fund_contributions c where c.fund_id=f.id;
 if available<expense_amount then raise exception 'Expense exceeds available fund balance' using errcode='23514'; end if;
 insert into public.financial_transactions(workspace_id,account_id,kind,status,amount,currency,description,idempotency_key,created_by,direction,posted_at)
 values(f.workspace_id,f.account_id,'EXPENSE','POSTED',expense_amount,f.currency,trim(expense_description),request_key,actor,'OUT',now()) returning id into tx_id;
 insert into public.pooled_fund_expenses(workspace_id,fund_id,created_by,amount,description,transaction_id,request_key)
 values(f.workspace_id,f.id,actor,expense_amount,trim(expense_description),tx_id,request_key) returning id into expense_id;
 insert into public.workspace_audit_log(workspace_id,actor_id,action,entity_type,entity_id,details) values(f.workspace_id,actor,'POOLED_FUND_EXPENSE_RECORDED','pooled_fund_expense',expense_id,jsonb_build_object('fund_id',f.id,'amount',expense_amount,'transaction_id',tx_id));
 return expense_id;
end; $$;

revoke all on function public.create_pooled_fund(uuid,text,numeric,char,uuid,date,uuid) from public,anon;
revoke all on function public.set_pooled_fund_commitment(uuid,uuid,numeric) from public,anon;
revoke all on function public.record_pooled_fund_contribution(uuid,uuid,numeric,text,uuid) from public,anon;
revoke all on function public.record_pooled_fund_expense(uuid,numeric,text,uuid) from public,anon;
grant execute on function public.create_pooled_fund(uuid,text,numeric,char,uuid,date,uuid) to authenticated;
grant execute on function public.set_pooled_fund_commitment(uuid,uuid,numeric) to authenticated;
grant execute on function public.record_pooled_fund_contribution(uuid,uuid,numeric,text,uuid) to authenticated;
grant execute on function public.record_pooled_fund_expense(uuid,numeric,text,uuid) to authenticated;

-- A pooled-fund ledger entry is paired with a contribution/expense record.
-- Prevent generic reversals from desynchronizing fund progress from the ledger.
create or replace function public.guard_pooled_fund_ledger_reversal()
returns trigger language plpgsql set search_path='' as $pooled_guard$
begin
 if new.kind='REVERSAL' and new.reversal_of is not null and (
   exists(select 1 from public.pooled_fund_contributions c where c.transaction_id=new.reversal_of)
   or exists(select 1 from public.pooled_fund_expenses e where e.transaction_id=new.reversal_of)
 ) then
  raise exception 'Pooled fund entries must be corrected through a dedicated fund adjustment workflow' using errcode='23514';
 end if;
 return new;
end; $pooled_guard$;
revoke all on function public.guard_pooled_fund_ledger_reversal() from public,anon,authenticated;
create trigger pooled_fund_ledger_reversal_guard
before insert on public.financial_transactions
for each row execute function public.guard_pooled_fund_ledger_reversal();

