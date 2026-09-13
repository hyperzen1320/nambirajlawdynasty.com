-- ─────────────────────────────────────────────────────────────────────
-- Nambiraj Law Dynasty — CMS schema
--
--   cms_documents           One row per editable document (site settings,
--                           each page, the disclaimer). `data` is JSON whose
--                           shape is defined in src/cms/documents.ts.
--   cms_document_revisions  The previous version of a document, archived
--                           automatically on every change (newest 50 kept),
--                           so an editor's mistake can be restored.
--   cms_admins              Which signed-in users may edit. Being able to
--                           log in is not enough — a user must be listed here.
--   news_posts              The News page's posts, one row each (drafts stay
--                           private until published).
--   storage bucket          `cms-media`: public images uploaded from the admin.
--
-- Safe to run more than once. Apply in the Supabase SQL Editor (or with
-- `supabase db push`), then run supabase/seed.sql to load the current copy.
-- ─────────────────────────────────────────────────────────────────────

-- ── Tables ────────────────────────────────────────────────────────────

create table if not exists public.cms_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

create table if not exists public.cms_documents (
  id               text primary key check (id ~ '^[a-z][a-z0-9-]{0,63}$'),
  data             jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  version          integer not null default 1,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  updated_by_email text
);

create table if not exists public.cms_document_revisions (
  id               bigint generated always as identity primary key,
  document_id      text not null references public.cms_documents (id) on delete cascade,
  version          integer not null,
  data             jsonb not null,
  saved_at         timestamptz not null,
  saved_by_email   text,
  archived_at      timestamptz not null default now()
);

create index if not exists cms_document_revisions_document_idx
  on public.cms_document_revisions (document_id, id desc);

-- ── Who may edit ──────────────────────────────────────────────────────

create or replace function public.is_cms_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cms_admins where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_cms_admin() from public;
grant execute on function public.is_cms_admin() to anon, authenticated;

-- ── Versioning & history ──────────────────────────────────────────────
-- Stamps who/when, bumps `version` (the admin uses it to refuse saving over
-- someone else's newer edit), and archives the outgoing content.

create or replace function public.cms_documents_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.version := old.version + 1;

    if new.data is distinct from old.data then
      insert into public.cms_document_revisions
        (document_id, version, data, saved_at, saved_by_email)
      values
        (old.id, old.version, old.data, old.updated_at, old.updated_by_email);

      delete from public.cms_document_revisions r
      where r.document_id = old.id
        and r.id not in (
          select k.id from public.cms_document_revisions k
          where k.document_id = old.id
          order by k.id desc
          limit 50
        );
    end if;
  else
    new.version := 1;
  end if;

  new.updated_at := now();
  new.updated_by := (select auth.uid());
  new.updated_by_email := (select auth.jwt() ->> 'email');
  return new;
end;
$$;

drop trigger if exists cms_documents_stamp on public.cms_documents;
create trigger cms_documents_stamp
  before insert or update on public.cms_documents
  for each row execute function public.cms_documents_stamp();

-- ── Row level security ────────────────────────────────────────────────
-- Everyone may read documents (they are the public website). Only listed
-- admins may create or change them. Nobody deletes through the API.

alter table public.cms_documents          enable row level security;
alter table public.cms_document_revisions enable row level security;
alter table public.cms_admins             enable row level security;

revoke all on table public.cms_documents          from anon, authenticated;
revoke all on table public.cms_document_revisions from anon, authenticated;
revoke all on table public.cms_admins             from anon, authenticated;

grant select                 on table public.cms_documents          to anon, authenticated;
grant insert, update         on table public.cms_documents          to authenticated;
grant select                 on table public.cms_document_revisions to authenticated;
grant select                 on table public.cms_admins             to authenticated;

drop policy if exists "cms_documents: public read"   on public.cms_documents;
drop policy if exists "cms_documents: admins insert" on public.cms_documents;
drop policy if exists "cms_documents: admins update" on public.cms_documents;

create policy "cms_documents: public read"
  on public.cms_documents for select
  to anon, authenticated
  using (true);

create policy "cms_documents: admins insert"
  on public.cms_documents for insert
  to authenticated
  with check ((select public.is_cms_admin()));

create policy "cms_documents: admins update"
  on public.cms_documents for update
  to authenticated
  using ((select public.is_cms_admin()))
  with check ((select public.is_cms_admin()));

drop policy if exists "cms_document_revisions: admins read" on public.cms_document_revisions;
create policy "cms_document_revisions: admins read"
  on public.cms_document_revisions for select
  to authenticated
  using ((select public.is_cms_admin()));

drop policy if exists "cms_admins: admins read" on public.cms_admins;
create policy "cms_admins: admins read"
  on public.cms_admins for select
  to authenticated
  using ((select public.is_cms_admin()));

-- ── Media storage ─────────────────────────────────────────────────────
-- Public bucket: anyone can view an uploaded image by its URL; only admins
-- can upload, replace or delete. SVG is excluded — it can carry script.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cms-media',
  'cms-media',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "cms-media: admins list"   on storage.objects;
drop policy if exists "cms-media: admins upload" on storage.objects;
drop policy if exists "cms-media: admins update" on storage.objects;
drop policy if exists "cms-media: admins delete" on storage.objects;

create policy "cms-media: admins list"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'cms-media' and (select public.is_cms_admin()));

create policy "cms-media: admins upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'cms-media' and (select public.is_cms_admin()));

create policy "cms-media: admins update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'cms-media' and (select public.is_cms_admin()))
  with check (bucket_id = 'cms-media' and (select public.is_cms_admin()));

create policy "cms-media: admins delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'cms-media' and (select public.is_cms_admin()));

-- ── News posts ────────────────────────────────────────────────────────
-- The News page's growing collection: one row per post. Visitors can read
-- published posts only; admins can read drafts and create, edit and delete.

create table if not exists public.news_posts (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80),
  title            text not null default '',
  published        boolean not null default false,
  published_on     date not null default current_date,
  cover_image      text not null default '',
  excerpt          text not null default '',
  body             text not null default '',
  version          integer not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  updated_by_email text
);

create index if not exists news_posts_listing_idx
  on public.news_posts (published, published_on desc, created_at desc);

create or replace function public.news_posts_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.created_at := old.created_at;
    new.version := old.version + 1;
  else
    new.version := 1;
    new.created_at := now();
  end if;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  new.updated_by_email := (select auth.jwt() ->> 'email');
  return new;
end;
$$;

drop trigger if exists news_posts_stamp on public.news_posts;
create trigger news_posts_stamp
  before insert or update on public.news_posts
  for each row execute function public.news_posts_stamp();

alter table public.news_posts enable row level security;

revoke all on table public.news_posts from anon, authenticated;
grant select                         on table public.news_posts to anon, authenticated;
grant insert, update, delete         on table public.news_posts to authenticated;

drop policy if exists "news_posts: read published or admin" on public.news_posts;
drop policy if exists "news_posts: admins insert"           on public.news_posts;
drop policy if exists "news_posts: admins update"           on public.news_posts;
drop policy if exists "news_posts: admins delete"           on public.news_posts;

create policy "news_posts: read published or admin"
  on public.news_posts for select
  to anon, authenticated
  using (published or (select public.is_cms_admin()));

create policy "news_posts: admins insert"
  on public.news_posts for insert
  to authenticated
  with check ((select public.is_cms_admin()));

create policy "news_posts: admins update"
  on public.news_posts for update
  to authenticated
  using ((select public.is_cms_admin()))
  with check ((select public.is_cms_admin()));

create policy "news_posts: admins delete"
  on public.news_posts for delete
  to authenticated
  using ((select public.is_cms_admin()));
