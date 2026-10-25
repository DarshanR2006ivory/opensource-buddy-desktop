alter table public.contribution_guides enable row level security;

drop policy if exists "Users can create their own contribution guides" on public.contribution_guides;
create policy "Users can create their own contribution guides"
  on public.contribution_guides for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own contribution guides" on public.contribution_guides;
create policy "Users can update their own contribution guides"
  on public.contribution_guides for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own contribution guides" on public.contribution_guides;
create policy "Users can delete their own contribution guides"
  on public.contribution_guides for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can update their own saved issues" on public.saved_issues;
create policy "Users can update their own saved issues"
  on public.saved_issues for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant update on public.saved_issues to authenticated;
grant insert, update, delete on public.contribution_guides to authenticated;
grant delete on public.contribution_progress to authenticated;
