-- Savings goals use actual account-to-account ledger transfers.
create table public.savings_goals (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 1 and 80),
 target_amount numeric(20,2) not null check (target_amount > 0 and target_amount <= 999999999999999999),
 currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
 account_id uuid not null,
 target_date date,
 is_active boolean not null default true,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 constraint savings_goals_account_fk foreign key (workspace_id,account_id) references public.financial_accounts(workspace_id,id) on delete restrict,
 constraint savings_goals_one_goal_per_account unique(workspace_id,account_id),
 constraint savings_goals_workspace_id_id_key unique(workspace_id,id)
);
create index savings_goals_workspace_active_idx on public.savings_goals(workspace_id,is_active,created_at desc);

create table public.savings_movements (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 goal_id uuid not null,
 movement_type text not null check (movement_type in ('DEPOSIT','WITHDRAWAL')),
 amount numeric(20,2) not null check (amount > 0 and amount <= 999999999999999999),
 transfer_id uuid not null,
 request_key uuid not null,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 constraint savings_movements_goal_fk foreign key (workspace_id,goal_id) references public.savings_goals(workspace_id,id) on delete restrict,
 constraint savings_movements_idempotency unique(workspace_id,request_key),
 constraint savings_movements_transfer_unique unique(transfer_id)
);
create index savings_movements_goal_created_idx on public.savings_movements(workspace_id,goal_id,created_at desc);

alter table public.savings_goals enable row level security;
alter table public.savings_movements enable row level security;
create policy "Workspace members read savings goals" on public.savings_goals for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace members read savings movements" on public.savings_movements for select to authenticated using (public.is_workspace_member(workspace_id));
revoke all on public.savings_goals,public.savings_movements from public,anon,authenticated;
grant select on public.savings_goals,public.savings_movements to authenticated;

create or replace view public.savings_goal_progress with (security_invoker=true) as
select g.id as goal_id,g.workspace_id,
 coalesce(sum(m.amount) filter(where m.movement_type='DEPOSIT'),0)::numeric(20,2) as total_deposits,
 coalesce(sum(m.amount) filter(where m.movement_type='WITHDRAWAL'),0)::numeric(20,2) as total_withdrawals,
 (coalesce(sum(m.amount) filter(where m.movement_type='DEPOSIT'),0)-coalesce(sum(m.amount) filter(where m.movement_type='WITHDRAWAL'),0))::numeric(20,2) as balance
from public.savings_goals g left join public.savings_movements m on m.goal_id=g.id
group by g.id,g.workspace_id;
grant select on public.savings_goal_progress to authenticated;

create or replace function public.create_savings_goal(target_workspace uuid,goal_name text,goal_target numeric,goal_currency char(3),goal_account uuid,goal_target_date date)
returns uuid language plpgsql security definer set search_path='' as $sg$
declare actor uuid:=auth.uid(); new_id uuid; account_currency char(3);
begin
 if actor is null or not public.has_workspace_role(target_workspace,array['OWNER','ADMIN','TREASURER']::public.workspace_role[]) then raise exception 'Insufficient workspace permissions' using errcode='42501'; end if;
 if goal_name is null or char_length(trim(goal_name)) not between 1 and 80 or goal_target is null or goal_target<=0 or goal_target>999999999999999999 or goal_currency is null or goal_currency !~ '^[A-Z]{3}$' or goal_account is null then raise exception 'Invalid savings goal details' using errcode='22023'; end if;
 select a.currency into account_currency from public.financial_accounts a where a.id=goal_account and a.workspace_id=target_workspace and a.is_active for update;
 if not found or account_currency<>goal_currency then raise exception 'Savings account must be active and match goal currency' using errcode='23514'; end if;
 insert into public.savings_goals(workspace_id,name,target_amount,currency,account_id,target_date,created_by)
 values(target_workspace,trim(goal_name),goal_target,goal_currency,goal_account,goal_target_date,actor) returning id into new_id;
 insert into public.workspace_audit_log(workspace_id,actor_id,action,entity_type,entity_id,details)
 values(target_workspace,actor,'SAVINGS_GOAL_CREATED','savings_goal',new_id,jsonb_build_object('target_amount',goal_target,'currency',goal_currency,'account_id',goal_account));
 return new_id;
end; $sg$;

create or replace function public.move_savings_funds(target_goal uuid,movement_kind text,movement_amount numeric,other_account uuid,request_key uuid)
returns uuid language plpgsql security definer set search_path='' as $sg$
declare g public.savings_goals%rowtype; actor uuid:=auth.uid(); transfer_group uuid; movement_id uuid; existing public.savings_movements%rowtype; available numeric;
begin
 select * into g from public.savings_goals where id=target_goal and is_active for update;
 if not found or actor is null or not public.has_workspace_role(g.workspace_id,array['OWNER','ADMIN','TREASURER']::public.workspace_role[]) then raise exception 'Insufficient workspace permissions or goal not found' using errcode='42501'; end if;
 if movement_kind not in ('DEPOSIT','WITHDRAWAL') or movement_amount is null or movement_amount<=0 or movement_amount>999999999999999999 or other_account is null or other_account=g.account_id or request_key is null then raise exception 'Invalid savings movement' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(request_key::text,0));
 select * into existing from public.savings_movements m where m.workspace_id=g.workspace_id and m.request_key=move_savings_funds.request_key;
 if found then
  if existing.goal_id<>g.id or existing.movement_type<>movement_kind or existing.amount<>movement_amount or existing.created_by<>actor then raise exception 'Idempotency payload mismatch' using errcode='22023'; end if;
  return existing.id;
 end if;
 if movement_kind='DEPOSIT' then
  transfer_group:=public.create_transfer(g.workspace_id,other_account,g.account_id,movement_amount,'Setoran tabungan: '||g.name,request_key);
 else
  select coalesce(sum(m.amount) filter(where m.movement_type='DEPOSIT'),0)-coalesce(sum(m.amount) filter(where m.movement_type='WITHDRAWAL'),0)
  into available from public.savings_movements m where m.goal_id=g.id;
  if available<movement_amount then raise exception 'Withdrawal exceeds savings goal balance' using errcode='23514'; end if;
  transfer_group:=public.create_transfer(g.workspace_id,g.account_id,other_account,movement_amount,'Penarikan tabungan: '||g.name,request_key);
 end if;
 insert into public.savings_movements(workspace_id,goal_id,movement_type,amount,transfer_id,request_key,created_by)
 values(g.workspace_id,g.id,movement_kind,movement_amount,transfer_group,request_key,actor) returning id into movement_id;
 insert into public.workspace_audit_log(workspace_id,actor_id,action,entity_type,entity_id,details)
 values(g.workspace_id,actor,'SAVINGS_MOVEMENT_RECORDED','savings_movement',movement_id,jsonb_build_object('goal_id',g.id,'movement_type',movement_kind,'amount',movement_amount,'transfer_id',transfer_group));
 return movement_id;
end; $sg$;

revoke all on function public.create_savings_goal(uuid,text,numeric,char,uuid,date) from public,anon;
revoke all on function public.move_savings_funds(uuid,text,numeric,uuid,uuid) from public,anon;
grant execute on function public.create_savings_goal(uuid,text,numeric,char,uuid,date) to authenticated;
grant execute on function public.move_savings_funds(uuid,text,numeric,uuid,uuid) to authenticated;
