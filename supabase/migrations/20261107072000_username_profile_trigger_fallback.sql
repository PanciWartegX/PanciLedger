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
  new_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'),''),
    nullif(split_part(coalesce(new.email,''),'@',1),''),
    'Pengguna'
  );

  -- Auth users created by the web signup use their requested username.
  -- Admin-created/legacy Auth users receive a deterministic fallback identity.
  if new_username = '' then
    new_username := 'user_' || substr(replace(new.id::text,'-',''),1,12);
  elsif new_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Username harus 3-24 karakter: huruf kecil, angka, atau garis bawah' using errcode='22023';
  end if;

  insert into public.profiles(id,username,display_name)
  values(new.id,new_username,left(new_display_name,80));
  return new;
end;
$profile$;

revoke all on function public.handle_new_user_profile() from public, anon, authenticated;
