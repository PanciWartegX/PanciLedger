create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text not null default 'Pengguna',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,24}$'),
  constraint profiles_display_name_length check (char_length(trim(display_name)) between 1 and 80)
);

with source as (
  select
    u.id,
    lower(trim(coalesce(u.raw_user_meta_data->>'username',''))) as candidate,
    coalesce(nullif(trim(u.raw_user_meta_data->>'display_name'),''), nullif(split_part(coalesce(u.email,''),'@',1),''), 'Pengguna') as display_name,
    count(*) over (partition by lower(trim(coalesce(u.raw_user_meta_data->>'username','')))) as candidate_count
  from auth.users u
)
insert into public.profiles(id,username,display_name)
select id,
  case when candidate ~ '^[a-z0-9_]{3,24}$' and candidate_count=1
    then candidate else 'user_' || substr(replace(id::text,'-',''),1,12) end,
  left(display_name,80)
from source
on conflict (id) do nothing;

create unique index if not exists profiles_username_lower_uidx on public.profiles (lower(username));
create index if not exists profiles_display_name_idx on public.profiles (lower(display_name));

alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon;
grant select, update on public.profiles to authenticated;

drop policy if exists "Users and workspace peers can view profiles" on public.profiles;
create policy "Users and workspace peers can view profiles"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.workspace_members wm
    where wm.user_id = profiles.id
      and public.is_workspace_member(wm.workspace_id)
  )
);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $profile$
declare
  new_username text;
  new_display_name text;
begin
  new_username := lower(trim(coalesce(new.raw_user_meta_data->>'username','')));
  new_display_name := coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''), nullif(split_part(coalesce(new.email,''),'@',1),''), 'Pengguna');
  if new_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Username harus 3-24 karakter: huruf kecil, angka, atau garis bawah' using errcode='22023';
  end if;
  insert into public.profiles(id,username,display_name)
  values(new.id,new_username,left(new_display_name,80));
  return new;
end;
$profile$;

revoke all on function public.handle_new_user_profile() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

create or replace function public.resolve_auth_email_for_login(
  login_identifier text,
  login_password text
)
returns text
language plpgsql
security definer
set search_path = ''
as $login$
declare
  matched_email text;
begin
  if login_identifier is null or login_password is null
     or char_length(login_identifier) not between 3 and 254
     or char_length(login_password) not between 8 and 256 then
    return null;
  end if;

  select u.email into matched_email
  from auth.users u
  left join public.profiles p on p.id = u.id
  where (
    lower(p.username) = lower(trim(login_identifier))
    or lower(u.email) = lower(trim(login_identifier))
  )
    and u.email is not null
    and u.encrypted_password is not null
    and u.encrypted_password <> ''
    and extensions.crypt(login_password, u.encrypted_password) = u.encrypted_password
  limit 1;

  return matched_email;
end;
$login$;

revoke all on function public.resolve_auth_email_for_login(text,text) from public;
grant execute on function public.resolve_auth_email_for_login(text,text) to anon, authenticated;
