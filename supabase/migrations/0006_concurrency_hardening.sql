-- PanciLedger concurrency hardening.
-- Apply after 0005_account_and_posting_hardening.sql.
-- Keep this as a forward-only migration so deployed databases can upgrade safely.

-- Serialize membership administration per workspace. Without the workspace lock,
-- two concurrent owner removals/demotions could each observe two owners and leave none.
create or replace function public.add_workspace_member(
  target_workspace uuid,
  target_user uuid,
  assigned_role public.workspace_role default 'MEMBER'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role public.workspace_role;
begin
  perform 1 from public.workspaces w
  where w.id = target_workspace
  for update;
  if not found then
    raise exception 'Workspace not found' using errcode = 'P0002';
  end if;

  select m.role into actor_role
  from public.workspace_members m
  where m.workspace_id = target_workspace and m.user_id = auth.uid();

  if actor_role is null or actor_role not in ('OWNER', 'ADMIN') then
    raise exception 'Insufficient workspace permissions' using errcode = '42501';
  end if;
  if target_user is null or assigned_role is null then
    raise exception 'A target user and role are required' using errcode = '22023';
  end if;
  if assigned_role in ('OWNER', 'ADMIN') and actor_role <> 'OWNER' then
    raise exception 'Only an owner can assign owner or admin roles' using errcode = '42501';
  end if;

  if actor_role = 'OWNER' and assigned_role <> 'OWNER' then
    if exists (
      select 1 from public.workspace_members m
      where m.workspace_id = target_workspace
        and m.user_id = target_user and m.role = 'OWNER'
    ) and (
      select count(*) from public.workspace_members m
      where m.workspace_id = target_workspace and m.role = 'OWNER'
    ) <= 1 then
      raise exception 'A workspace must retain at least one owner' using errcode = '23514';
    end if;
  end if;

  insert into public.workspace_members(workspace_id, user_id, role)
  values (target_workspace, target_user, assigned_role)
  on conflict (workspace_id, user_id) do update set role = excluded.role
  where actor_role = 'OWNER'
     or public.workspace_members.role not in ('OWNER', 'ADMIN');

  if not found then
    raise exception 'Cannot change an owner or admin membership' using errcode = '42501';
  end if;

  insert into public.workspace_audit_log(workspace_id, actor_id, action, entity_type, details)
  values (target_workspace, auth.uid(), 'MEMBER_ADDED_OR_ROLE_CHANGED', 'workspace_member',
    jsonb_build_object('user_id', target_user, 'role', assigned_role));
end;
$$;

create or replace function public.remove_workspace_member(
  target_workspace uuid,
  target_user uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role public.workspace_role;
  target_role public.workspace_role;
  owner_count bigint;
begin
  perform 1 from public.workspaces w
  where w.id = target_workspace
  for update;
  if not found then
    raise exception 'Workspace not found' using errcode = 'P0002';
  end if;

  select m.role into actor_role
  from public.workspace_members m
  where m.workspace_id = target_workspace and m.user_id = auth.uid();

  select m.role into target_role
  from public.workspace_members m
  where m.workspace_id = target_workspace and m.user_id = target_user
  for update;

  if actor_role is null or actor_role not in ('OWNER', 'ADMIN') or target_role is null then
    raise exception 'Insufficient permissions or member not found' using errcode = '42501';
  end if;
  if target_role in ('OWNER', 'ADMIN') and actor_role <> 'OWNER' then
    raise exception 'Only an owner can remove an owner or admin' using errcode = '42501';
  end if;
  if target_role = 'OWNER' then
    select count(*) into owner_count
    from public.workspace_members
    where workspace_id = target_workspace and role = 'OWNER';
    if owner_count <= 1 then
      raise exception 'A workspace must retain at least one owner' using errcode = '23514';
    end if;
  end if;

  delete from public.workspace_members
  where workspace_id = target_workspace and user_id = target_user;

  insert into public.workspace_audit_log(workspace_id, actor_id, action, entity_type, details)
  values (target_workspace, auth.uid(), 'MEMBER_REMOVED', 'workspace_member',
    jsonb_build_object('user_id', target_user));
end;
$$;

-- Acquire both account row locks in a stable primary-key order to prevent
-- opposite-direction transfers from deadlocking on the same pair of accounts.
create or replace function public.create_transfer(
  target_workspace uuid,
  source_account uuid,
  destination_account uuid,
  transfer_amount numeric,
  transfer_description text,
  request_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  transfer_group uuid := gen_random_uuid();
  source_currency char(3);
  destination_currency char(3);
  existing_group uuid;
  actor uuid := auth.uid();
begin
  if actor is null or not public.has_workspace_role(
    target_workspace,
    array['OWNER','ADMIN','TREASURER']::public.workspace_role[]
  ) then
    raise exception 'Insufficient workspace permissions' using errcode = '42501';
  end if;
  if source_account = destination_account or transfer_amount is null or transfer_amount <= 0
     or transfer_amount > 999999999999999999
     or transfer_description is null
     or char_length(trim(transfer_description)) not between 1 and 240
     or request_key is null then
    raise exception 'Invalid transfer details' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(request_key::text, 0));
  select t.transfer_id into existing_group
  from public.financial_transactions t
  where t.workspace_id = target_workspace and t.idempotency_key = request_key;
  if existing_group is not null then
    return existing_group;
  end if;

  perform a.id
  from public.financial_accounts a
  where a.id in (source_account, destination_account)
    and a.workspace_id = target_workspace
    and a.is_active
  order by a.id
  for update;

  select a.currency into source_currency
  from public.financial_accounts a
  where a.id = source_account and a.workspace_id = target_workspace and a.is_active;
  select a.currency into destination_currency
  from public.financial_accounts a
  where a.id = destination_account and a.workspace_id = target_workspace and a.is_active;

  if source_currency is null or destination_currency is null
     or source_currency <> destination_currency then
    raise exception 'Both active accounts must belong to this workspace and use the same currency'
      using errcode = '23514';
  end if;

  insert into public.financial_transactions(
    workspace_id, account_id, kind, status, amount, currency, description,
    idempotency_key, created_by, direction, transfer_id, posted_at
  ) values (
    target_workspace, source_account, 'TRANSFER', 'POSTED', transfer_amount,
    source_currency, trim(transfer_description), request_key, actor, 'OUT', transfer_group, now()
  );

  insert into public.financial_transactions(
    workspace_id, account_id, kind, status, amount, currency, description,
    idempotency_key, created_by, direction, transfer_id, posted_at
  ) values (
    target_workspace, destination_account, 'TRANSFER', 'POSTED', transfer_amount,
    destination_currency, trim(transfer_description), gen_random_uuid(), actor, 'IN', transfer_group, now()
  );

  insert into public.workspace_audit_log(workspace_id, actor_id, action, entity_type, entity_id, details)
  values (target_workspace, actor, 'TRANSFER_POSTED', 'transfer', transfer_group,
    jsonb_build_object('source_account', source_account,
      'destination_account', destination_account, 'amount', transfer_amount));

  return transfer_group;
end;
$$;

revoke all on function public.add_workspace_member(uuid, uuid, public.workspace_role) from public, anon;
revoke all on function public.remove_workspace_member(uuid, uuid) from public, anon;
revoke all on function public.create_transfer(uuid, uuid, uuid, numeric, text, uuid) from public, anon;
grant execute on function public.add_workspace_member(uuid, uuid, public.workspace_role) to authenticated;
grant execute on function public.remove_workspace_member(uuid, uuid) to authenticated;
grant execute on function public.create_transfer(uuid, uuid, uuid, numeric, text, uuid) to authenticated;
