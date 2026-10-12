-- Run in the SQL Editor of a NEW Supabase project, as the project owner.
-- Re-runnable for this schema. Never grant broad UPDATE/DELETE to browser roles.
begin;

create table if not exists public.memes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 140),
  image_url text not null check (char_length(image_url) <= 1000),
  storage_path text not null unique check (storage_path ~ '^uploads/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif)$'),
  category text not null check (category in ('General IB','Math AA','Math AI','Economics','Business Management','ESS','Biology','Chemistry','Physics','Computer Science','English','Spanish','Psychology','History','Geography','TOK','Extended Essay','Internal Assessments','CAS','Mocks','Final Exams','Predicted Grades','University Applications','IB Teachers','Group Projects','Procrastination')),
  tags text[] not null default '{}' check (cardinality(tags) <= 8 and char_length(array_to_string(tags, ',')) <= 250 and array_position(tags, null) is null),
  display_name text not null default 'Anonymous IB Survivor' check (char_length(btrim(display_name)) between 1 and 60),
  likes integer not null default 0 check (likes >= 0),
  downloads integer not null default 0 check (downloads >= 0),
  reports integer not null default 0 check (reports >= 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  constraint meme_public_storage_url check (
    image_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/memes/uploads/'
    and right(image_url, char_length(storage_path)) = storage_path
    and image_url = substring(image_url from '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/memes/') || storage_path
  )
);
create index if not exists memes_approved_created_idx on public.memes(created_at desc, id) where status = 'approved';
alter table public.memes enable row level security;

-- Fail closed if an existing project has other permissive policies.
-- Do not silently destroy policies belonging to another application.
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='memes' and policyname not in ('memes_approved_read','memes_pending_insert')) then
    raise exception 'Unexpected memes policies exist. Review them or use a fresh Supabase project before running this script.';
  end if;
end $$;

revoke all on table public.memes from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on table public.memes to anon, authenticated;
-- Column grants protect status, counters, IDs and upload timestamps, even if
-- a visitor skips the UI and calls the REST API directly.
grant insert (title, image_url, storage_path, category, tags, display_name) on public.memes to anon, authenticated;
drop policy if exists memes_approved_read on public.memes;
create policy memes_approved_read on public.memes for select to anon, authenticated using (status = 'approved');
drop policy if exists memes_pending_insert on public.memes;
create policy memes_pending_insert on public.memes for insert to anon, authenticated with check (status = 'pending' and likes = 0 and downloads = 0 and reports = 0);

-- These narrowly scoped functions are the only browser mutation route for
-- existing records. No dynamic SQL; empty search_path prevents object hijacking.
create or replace function public.increment_meme_like(meme_id uuid)
returns integer language sql security definer set search_path = '' as $$
  update public.memes set likes = case when likes < 2147483647 then likes + 1 else likes end
  where id = meme_id and status = 'approved' returning likes;
$$;
create or replace function public.increment_meme_download(meme_id uuid)
returns integer language sql security definer set search_path = '' as $$
  update public.memes set downloads = case when downloads < 2147483647 then downloads + 1 else downloads end
  where id = meme_id and status = 'approved' returning downloads;
$$;
create or replace function public.increment_meme_report(meme_id uuid)
returns integer language sql security definer set search_path = '' as $$
  update public.memes set reports = case when reports < 2147483647 then reports + 1 else reports end
  where id = meme_id and status = 'approved' returning reports;
$$;
revoke all on function public.increment_meme_like(uuid) from public, anon, authenticated;
revoke all on function public.increment_meme_download(uuid) from public, anon, authenticated;
revoke all on function public.increment_meme_report(uuid) from public, anon, authenticated;
grant execute on function public.increment_meme_like(uuid) to anon, authenticated;
grant execute on function public.increment_meme_download(uuid) to anon, authenticated;
grant execute on function public.increment_meme_report(uuid) to anon, authenticated;

-- Public bucket means images are accessible by URL BEFORE approval too.
-- RLS moderates the feed, not access to a known image URL. See README.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memes','memes',true,10485760,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies are ORed. Other policies may authorize overwrites/deletes;
-- this guard avoids claiming security in an already permissive project.
do $$ begin
  if exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname <> 'memes_anonymous_upload' and cmd in ('ALL','INSERT','UPDATE','DELETE') and (roles && array['anon','authenticated','public']::name[])) then
    raise exception 'Other browser-writable Storage policies exist. Review their scope before using this script; use a fresh project for simplest setup.';
  end if;
end $$;
drop policy if exists memes_anonymous_upload on storage.objects;
create policy memes_anonymous_upload on storage.objects for insert to anon, authenticated
with check (bucket_id = 'memes' and name ~ '^uploads/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif)$');
-- No browser SELECT policy on Storage metadata, no UPDATE or DELETE policy.
-- Public object retrieval uses the public bucket endpoint, not metadata SELECT.
commit;
