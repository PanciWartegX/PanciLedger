create table public.workspace_invitations (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 invited_email text not null check (char_length(invited_email) between 3 and 254),
 assigned_role public.workspace_role not null default 'MEMBER',
 invite_token uuid not null unique default gen_random_uuid(),
 invited_by uuid not null references auth.users(id) on delete restrict,
 expires_at timestamptz not null default (now()+interval '7 days'),
 accepted_at timestamptz,
 created_at timestamptz not null default now(),
 constraint workspace_invitation_email_lower check (invited_email=lower(trim(invited_email)))
);
create unique index workspace_invitation_open_email_idx on public.workspace_invitations(workspace_id,invited_email) where accepted_at is null;
create index workspace_invitation_workspace_created_idx on public.workspace_invitations(workspace_id,created_at desc);
alter table public.workspace_invitations enable row level security;
create policy "Workspace admins and invitees read invitations" on public.workspace_invitations for select to authenticated
using (public.has_workspace_role(workspace_id,array['OWNER','ADMIN']::public.workspace_role[]) or lower(invited_email)=lower(coalesce(auth.jwt()->>'email','')));
revoke all on public.workspace_invitations from public,anon,authenticated;
grant select on public.workspace_invitations to authenticated;

create or replace function public.create_workspace_invitation(target_workspace uuid,target_email text,target_role public.workspace_role)
returns uuid language plpgsql security definer set search_path='' as $wi$
declare actor uuid:=auth.uid(); actor_role public.workspace_role; token uuid;
begin
 select m.role into actor_role from public.workspace_members m where m.workspace_id=target_workspace and m.user_id=actor;
 if actor is null or actor_role is null or actor_role not in ('OWNER','ADMIN') then raise exception 'Insufficient workspace permissions' using errcode='42501'; end if;
 if target_email is null or char_length(trim(target_email)) not between 3 and 254 or target_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' or target_role is null then raise exception 'Invalid invitation details' using errcode='22023'; end if;
 if target_role in ('OWNER','ADMIN') and actor_role<>'OWNER' then raise exception 'Only an owner can invite owners or admins' using errcode='42501'; end if;
 token:=gen_random_uuid();
 insert into public.workspace_invitations(workspace_id,invited_email,assigned_role,invite_token,invited_by)
 values(target_workspace,lower(trim(target_email)),target_role,token,actor);
 insert into public.workspace_audit_log(workspace_id,actor_id,action,entity_type,details)
 values(target_workspace,actor,'WORKSPACE_INVITATION_CREATED','workspace_invitation',jsonb_build_object('email',lower(trim(target_email)),'role',target_role));
 return token;
end; $wi$;

create or replace function public.accept_workspace_invitation(invite_token uuid)
returns uuid language plpgsql security definer set search_path='' as $wi$
declare actor uuid:=auth.uid(); actor_email text; invitation public.workspace_invitations%rowtype; inviter_role public.workspace_role;
begin
 if actor is null or invite_token is null then raise exception 'Authenticated email and invitation token required' using errcode='28000'; end if;
 select lower(u.email) into actor_email from auth.users u where u.id=actor and u.email_confirmed_at is not null;
 if actor_email is null or actor_email='' then raise exception 'A verified email address is required to accept invitations' using errcode='42501'; end if;
 select * into invitation from public.workspace_invitations i where i.invite_token=accept_workspace_invitation.invite_token for update;
 if not found or invitation.accepted_at is not null or invitation.expires_at<=now() or invitation.invited_email<>actor_email then raise exception 'Invitation is invalid, expired or addressed to another email' using errcode='42501'; end if;
 select m.role into inviter_role from public.workspace_members m where m.workspace_id=invitation.workspace_id and m.user_id=invitation.invited_by;
 if inviter_role is null or (invitation.assigned_role in ('OWNER','ADMIN') and inviter_role<>'OWNER') then raise exception 'Inviter no longer has permission to grant this role' using errcode='42501'; end if;
 if exists(select 1 from public.workspace_members m where m.workspace_id=invitation.workspace_id and m.user_id=actor) then raise exception 'You are already a workspace member' using errcode='23505'; end if;
 insert into public.workspace_members(workspace_id,user_id,role) values(invitation.workspace_id,actor,invitation.assigned_role);
 update public.workspace_invitations set accepted_at=now() where id=invitation.id;
 insert into public.workspace_audit_log(workspace_id,actor_id,action,entity_type,entity_id,details)
 values(invitation.workspace_id,actor,'WORKSPACE_INVITATION_ACCEPTED','workspace_invitation',invitation.id,jsonb_build_object('role',invitation.assigned_role));
 return invitation.workspace_id;
end; $wi$;

revoke all on function public.create_workspace_invitation(uuid,text,public.workspace_role) from public,anon;
revoke all on function public.accept_workspace_invitation(uuid) from public,anon;
grant execute on function public.create_workspace_invitation(uuid,text,public.workspace_role) to authenticated;
grant execute on function public.accept_workspace_invitation(uuid) to authenticated;
