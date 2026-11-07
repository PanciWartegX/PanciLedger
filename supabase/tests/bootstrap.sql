-- Minimal Supabase Auth compatibility layer for isolated migration CI.
-- This is test-only and must never be applied to a hosted Supabase project.
create role anon nologin;
create role authenticated nologin;

create schema auth;
create schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table auth.users (
  id uuid primary key,
  email text unique,
  encrypted_password text not null default '',
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant execute on function auth.jwt() to anon, authenticated;

-- The hosted project has this pre-existing event-trigger callback; the migration
-- revokes client execution on it. The CI database models its presence without
-- installing a database-wide event trigger.
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
as $$
begin
  return;
end;
$$;
