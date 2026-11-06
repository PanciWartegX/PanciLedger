create table public.recurring_transactions (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 1 and 80),
 transaction_type public.transaction_kind not null check (transaction_type in ('INCOME','EXPENSE')),
 account_id uuid not null,
 amount numeric(20,2) not null check (amount > 0 and amount <= 999999999999999999),
 description text not null check (char_length(trim(description)) between 1 and 240),
 cadence text not null check (cadence in ('DAILY','WEEKLY','MONTHLY','YEARLY','CUSTOM')),
 interval_days integer,
 next_run_at date not null,
 last_run_at timestamptz,
 is_active boolean not null default true,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 constraint recurring_transactions_account_fk foreign key(workspace_id,account_id) references public.financial_accounts(workspace_id,id) on delete restrict,
 constraint recurring_custom_interval_check check ((cadence='CUSTOM' and interval_days between 1 and 365) or (cadence<>'CUSTOM' and interval_days is null)),
 constraint recurring_workspace_id_id_key unique(workspace_id,id)
);
create index recurring_transactions_due_idx on public.recurring_transactions(workspace_id,next_run_at) where is_active;
create table public.recurring_execution_logs (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 recurring_transaction_id uuid not null,
 scheduled_for date not null,
 transaction_id uuid not null unique references public.financial_transactions(id) on delete restrict,
 amount numeric(20,2) not null check (amount>0),
 executed_by uuid not null references auth.users(id) on delete restrict,
 executed_at timestamptz not null default now(),
 constraint recurring_execution_schedule_fk foreign key(workspace_id,recurring_transaction_id) references public.recurring_transactions(workspace_id,id) on delete restrict,
 constraint recurring_execution_once unique(recurring_transaction_id,scheduled_for)
);
create index recurring_execution_workspace_time_idx on public.recurring_execution_logs(workspace_id,executed_at desc);
alter table public.recurring_transactions enable row level security;
alter table public.recurring_execution_logs enable row level security;
create policy "Workspace members read recurring templates" on public.recurring_transactions for select to authenticated using(public.is_workspace_member(workspace_id));
create policy "Workspace members read recurring execution logs" on public.recurring_execution_logs for select to authenticated using(public.is_workspace_member(workspace_id));
revoke all on public.recurring_transactions,public.recurring_execution_logs from public,anon,authenticated;
grant select on public.recurring_transactions,public.recurring_execution_logs to authenticated;

create or replace function public.create_recurring_transaction(target_workspace uuid,template_name text,transaction_type public.transaction_kind,target_account uuid,template_amount numeric,template_description text,template_cadence text,custom_interval_days integer,first_run_date date)
returns uuid language plpgsql security definer set search_path='' as $rt$
declare actor uuid:=auth.uid(); new_id uuid;
begin
 if actor is null or not public.has_workspace_role(target_workspace,array['OWNER','ADMIN','TREASURER']::public.workspace_role[]) then raise exception 'Insufficient workspace permissions' using errcode='42501'; end if;
 if template_name is null or char_length(trim(template_name)) not between 1 and 80 or transaction_type is null or transaction_type not in ('INCOME','EXPENSE') or target_account is null or template_amount is null or template_amount<=0 or template_amount>999999999999999999 or template_description is null or char_length(trim(template_description)) not between 1 and 240 or template_cadence is null or template_cadence not in ('DAILY','WEEKLY','MONTHLY','YEARLY','CUSTOM') or first_run_date is null then raise exception 'Invalid recurring transaction details' using errcode='22023'; end if;
 if (template_cadence='CUSTOM' and (custom_interval_days is null or custom_interval_days not between 1 and 365)) or (template_cadence<>'CUSTOM' and custom_interval_days is not null) then raise exception 'Invalid custom interval' using errcode='22023'; end if;
 if not exists(select 1 from public.financial_accounts a where a.id=target_account and a.workspace_id=target_workspace and a.is_active) then raise exception 'Active account not found' using errcode='23514'; end if;
 insert into public.recurring_transactions(workspace_id,name,transaction_type,account_id,amount,description,cadence,interval_days,next_run_at,created_by)
 values(target_workspace,trim(template_name),transaction_type,target_account,template_amount,trim(template_description),template_cadence,custom_interval_days,first_run_date,actor) returning id into new_id;
 insert into public.workspace_audit_log(workspace_id,actor_id,action,entity_type,entity_id,details) values(target_workspace,actor,'RECURRING_TEMPLATE_CREATED','recurring_transaction',new_id,jsonb_build_object('type',transaction_type,'amount',template_amount,'cadence',template_cadence,'first_run_at',first_run_date));
 return new_id;
end; $rt$;

create or replace function public.execute_due_recurring(target_workspace uuid,max_items integer default 20)
returns integer language plpgsql security definer set search_path='' as $rt$
declare actor uuid:=auth.uid(); item public.recurring_transactions%rowtype; tx_id uuid; executed integer:=0; next_date date;
begin
 if actor is null or not public.has_workspace_role(target_workspace,array['OWNER','ADMIN','TREASURER']::public.workspace_role[]) then raise exception 'Insufficient workspace permissions' using errcode='42501'; end if;
 if max_items is null or max_items not between 1 and 50 then raise exception 'Batch size must be between 1 and 50' using errcode='22023'; end if;
 for item in select * from public.recurring_transactions r where r.workspace_id=target_workspace and r.is_active and r.next_run_at<=current_date order by r.next_run_at,r.created_at limit max_items for update skip locked loop
  tx_id:=public.create_and_post_transaction(target_workspace,item.account_id,item.transaction_type,item.amount,item.description,gen_random_uuid());
  insert into public.recurring_execution_logs(workspace_id,recurring_transaction_id,scheduled_for,transaction_id,amount,executed_by) values(target_workspace,item.id,item.next_run_at,tx_id,item.amount,actor);
  next_date:=case item.cadence when 'DAILY' then item.next_run_at+1 when 'WEEKLY' then item.next_run_at+7 when 'MONTHLY' then (item.next_run_at+interval '1 month')::date when 'YEARLY' then (item.next_run_at+interval '1 year')::date else item.next_run_at+item.interval_days end;
  update public.recurring_transactions set next_run_at=next_date,last_run_at=now() where id=item.id;
  insert into public.workspace_audit_log(workspace_id,actor_id,action,entity_type,entity_id,details) values(target_workspace,actor,'RECURRING_TRANSACTION_EXECUTED','recurring_transaction',item.id,jsonb_build_object('scheduled_for',item.next_run_at,'transaction_id',tx_id,'amount',item.amount));
  executed:=executed+1;
 end loop;
 return executed;
end; $rt$;
revoke all on function public.create_recurring_transaction(uuid,text,public.transaction_kind,uuid,numeric,text,text,integer,date) from public,anon;
revoke all on function public.execute_due_recurring(uuid,integer) from public,anon;
grant execute on function public.create_recurring_transaction(uuid,text,public.transaction_kind,uuid,numeric,text,text,integer,date) to authenticated;
grant execute on function public.execute_due_recurring(uuid,integer) to authenticated;
