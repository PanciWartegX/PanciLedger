create table public.notifications (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 notification_type text not null check (char_length(notification_type) between 1 and 48),
 title text not null check (char_length(title) between 1 and 120),
 body text not null check (char_length(body) between 1 and 240),
 entity_type text,
 entity_id uuid,
 created_at timestamptz not null default now(),
 read_at timestamptz
);
create index notifications_recipient_unread_idx on public.notifications(recipient_id,created_at desc) where read_at is null;
create index notifications_workspace_created_idx on public.notifications(workspace_id,created_at desc);
alter table public.notifications enable row level security;
create policy "Users read their own workspace notifications" on public.notifications for select to authenticated using(recipient_id=(select auth.uid()) and public.is_workspace_member(workspace_id));
create policy "Users mark their own notifications read" on public.notifications for update to authenticated using(recipient_id=(select auth.uid()) and public.is_workspace_member(workspace_id)) with check(recipient_id=(select auth.uid()) and public.is_workspace_member(workspace_id));
revoke all on public.notifications from public,anon,authenticated;
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;

create or replace function public.notify_workspace_transaction()
returns trigger language plpgsql security definer set search_path='' as $notify$
begin
 if new.status='POSTED' then
  if tg_op='UPDATE' and old.status='POSTED' then return new; end if;
  if new.kind<>'TRANSFER' or not exists(select 1 from public.financial_transactions t where t.transfer_id=new.transfer_id and t.id<>new.id) then
   insert into public.notifications(workspace_id,recipient_id,notification_type,title,body,entity_type,entity_id)
   select new.workspace_id,m.user_id,
    case when new.kind='INCOME' then 'TRANSACTION_INCOME' when new.kind='EXPENSE' then 'TRANSACTION_EXPENSE' when new.kind='TRANSFER' then 'TRANSACTION_TRANSFER' else 'TRANSACTION_UPDATE' end,
    case when new.kind='INCOME' then 'Pemasukan baru' when new.kind='EXPENSE' then 'Pengeluaran baru' when new.kind='TRANSFER' then 'Transfer baru' else 'Transaksi diperbarui' end,
    left(new.description,180)||' · '||new.currency||' '||new.amount::text,
    'financial_transaction',new.id
   from public.workspace_members m where m.workspace_id=new.workspace_id;
  end if;
 end if;
 return new;
end; $notify$;
revoke all on function public.notify_workspace_transaction() from public,anon,authenticated;
create trigger notify_transaction_after_insert after insert on public.financial_transactions for each row execute function public.notify_workspace_transaction();
create trigger notify_transaction_after_update after update of status on public.financial_transactions for each row execute function public.notify_workspace_transaction();
