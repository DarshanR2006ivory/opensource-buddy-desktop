create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  languages text[] not null default '{}',
  skills text[] not null default '{}',
  experience_level text not null default 'beginner'
    check (experience_level in ('beginner', 'intermediate', 'advanced')),
  interests text[] not null default '{}',
  project_types text[] not null default '{}',
  github_username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.github_issues (
  id bigint primary key,
  repository text not null,
  owner text not null,
  number integer not null check (number > 0),
  title text not null,
  body text,
  html_url text not null,
  state text not null,
  labels jsonb not null default '[]'::jsonb,
  language text,
  comments integer not null default 0,
  repository_url text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  closed_at timestamptz,
  fetched_at timestamptz not null default now(),
  unique (owner, repository, number)
);

create index if not exists github_issues_repo_number_idx on public.github_issues (owner, repository, number);
create index if not exists github_issues_updated_at_idx on public.github_issues (updated_at desc);
create index if not exists github_issues_fetched_at_idx on public.github_issues (fetched_at desc);
create index if not exists github_issues_labels_idx on public.github_issues using gin (labels);

create table if not exists public.github_repositories (
  owner text not null,
  repository text not null,
  language text,
  fetched_at timestamptz not null default now(),
  primary key (owner, repository)
);
create index if not exists github_repositories_fetched_at_idx on public.github_repositories (fetched_at desc);

create table if not exists public.github_issue_search_cache (
  query_hash text primary key,
  issue_ids bigint[] not null default '{}',
  total_count integer not null default 0 check (total_count >= 0),
  incomplete_results boolean not null default false,
  fetched_at timestamptz not null default now()
);
create index if not exists github_issue_search_cache_fetched_at_idx on public.github_issue_search_cache (fetched_at);

create table if not exists public.saved_issues (
  user_id uuid not null references auth.users (id) on delete cascade,
  issue_id bigint not null references public.github_issues (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, issue_id)
);
create index if not exists saved_issues_user_created_idx on public.saved_issues (user_id, created_at desc);

create table if not exists public.contribution_guides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  issue_id bigint not null references public.github_issues (id) on delete cascade,
  guide jsonb not null,
  model text not null,
  generated_at timestamptz not null default now()
);
create index if not exists contribution_guides_user_issue_idx on public.contribution_guides (user_id, issue_id, generated_at desc);

create table if not exists public.contribution_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  issue_id bigint not null references public.github_issues (id) on delete cascade,
  status text not null default 'saved' check (status in ('saved', 'in_progress', 'completed')),
  notes text,
  updated_at timestamptz not null default now(),
  primary key (user_id, issue_id)
);
create index if not exists contribution_progress_user_status_idx on public.contribution_progress (user_id, status);

alter table public.profiles enable row level security;
alter table public.github_issues enable row level security;
alter table public.github_repositories enable row level security;
alter table public.github_issue_search_cache enable row level security;
alter table public.saved_issues enable row level security;
alter table public.contribution_guides enable row level security;
alter table public.contribution_progress enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "Users can delete their own profile" on public.profiles;
create policy "Users can delete their own profile"
  on public.profiles for delete to authenticated using (auth.uid() = id);

drop policy if exists "Cached issues are readable by everyone" on public.github_issues;
create policy "Cached issues are readable by everyone"
  on public.github_issues for select to anon, authenticated using (true);

drop policy if exists "Users can read their own saved issues" on public.saved_issues;
create policy "Users can read their own saved issues"
  on public.saved_issues for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can save their own issues" on public.saved_issues;
create policy "Users can save their own issues"
  on public.saved_issues for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can remove their own saved issues" on public.saved_issues;
create policy "Users can remove their own saved issues"
  on public.saved_issues for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read their own contribution guides" on public.contribution_guides;
create policy "Users can read their own contribution guides"
  on public.contribution_guides for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can read their own contribution progress" on public.contribution_progress;
create policy "Users can read their own contribution progress"
  on public.contribution_progress for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can create their own contribution progress" on public.contribution_progress;
create policy "Users can create their own contribution progress"
  on public.contribution_progress for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update their own contribution progress" on public.contribution_progress;
create policy "Users can update their own contribution progress"
  on public.contribution_progress for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own contribution progress" on public.contribution_progress;
create policy "Users can delete their own contribution progress"
  on public.contribution_progress for delete to authenticated using (auth.uid() = user_id);

revoke all on public.github_issue_search_cache from anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.github_issues to anon, authenticated;
grant select, insert, delete on public.saved_issues to authenticated;
grant select on public.contribution_guides to authenticated;
grant select, insert, update, delete on public.contribution_progress to authenticated;
grant all on public.github_issues, public.github_repositories, public.github_issue_search_cache, public.contribution_guides to service_role;
