-- Allow a workspace owner/admin to renew an expired invitation for the same email.
-- Keep the unique pending-invitation invariant while avoiding stale expired rows.
create or replace function public.create_workspace_invitation(
  target_workspace uuid,
  target_email text,
  target_role public.workspace_role
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $wi$
declare
  actor uuid := auth.uid();
  actor_role public.workspace_role;
  token uuid;
  existing public.workspace_invitations%rowtype;
  audit_action text;
begin
  select m.role into actor_role
  from public.workspace_members m
  where m.workspace_id = target_workspace and m.user_id = actor;

  if actor is null or actor_role is null or actor_role not in ('OWNER','ADMIN') then
    raise exception 'Insufficient workspace permissions' using errcode='42501';
  end if;
  if target_email is null
     or char_length(trim(target_email)) not between 3 and 254
     or target_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
     or target_role is null then
    raise exception 'Invalid invitation details' using errcode='22023';
  end if;
  if target_role in ('OWNER','ADMIN') and actor_role <> 'OWNER' then
    raise exception 'Only an owner can invite owners or admins' using errcode='42501';
  end if;

  if exists (
    select 1
    from public.workspace_members m
    join auth.users u on u.id = m.user_id
    where m.workspace_id = target_workspace
      and lower(u.email) = lower(trim(target_email))
  ) then
    raise exception 'This email already belongs to a workspace member' using errcode='23505';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_workspace::text || ':' || lower(trim(target_email)), 0)
  );

  select * into existing
  from public.workspace_invitations i
  where i.workspace_id = target_workspace
    and i.invited_email = lower(trim(target_email))
    and i.accepted_at is null
  for update;

  token := gen_random_uuid();
  if found then
    if existing.expires_at > now() then
      raise exception 'An active invitation already exists for this email' using errcode='23505';
    end if;

    update public.workspace_invitations
    set assigned_role = target_role,
        invite_token = token,
        invited_by = actor,
        expires_at = now() + interval '7 days',
        created_at = now()
    where id = existing.id;
    audit_action := 'WORKSPACE_INVITATION_RENEWED';
  else
    insert into public.workspace_invitations(
      workspace_id, invited_email, assigned_role, invite_token, invited_by
    ) values (
      target_workspace, lower(trim(target_email)), target_role, token, actor
    );
    audit_action := 'WORKSPACE_INVITATION_CREATED';
  end if;

  insert into public.workspace_audit_log(workspace_id,actor_id,action,entity_type,details)
  values (
    target_workspace, actor, audit_action, 'workspace_invitation',
    jsonb_build_object('email',lower(trim(target_email)),'role',target_role)
  );
  return token;
end;
$wi$;

revoke all on function public.create_workspace_invitation(uuid,text,public.workspace_role) from public,anon;
grant execute on function public.create_workspace_invitation(uuid,text,public.workspace_role) to authenticated;
