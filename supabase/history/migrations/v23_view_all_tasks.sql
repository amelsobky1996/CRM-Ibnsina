-- v23: everyone can VIEW every task (read-only): its details, progress, steps, comments, files, activity.
-- Changing a task stays with can_work_task; commenting / uploading stays with the people working on it
-- plus anyone @mentioned (can_engage_task = the previous can_see_task).

create or replace function public.can_engage_task(p_task uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_work_task(p_task)
    or exists (select 1 from public.tasks t where t.id = p_task and auth.uid() = any(t.mentions));
$$;
revoke all on function public.can_engage_task(uuid) from public, anon;
grant execute on function public.can_engage_task(uuid) to authenticated;

create or replace function public.can_see_task(p_task uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

alter policy "comments insert" on public.task_comments with check (user_id = auth.uid() and public.can_engage_task(task_id));
alter policy "files insert" on public.task_files with check (uploaded_by = auth.uid() and public.can_engage_task(task_id));
alter policy "task files upload" on storage.objects
  with check (bucket_id = 'task-files' and public.can_engage_task(((storage.foldername(name))[1])::uuid));
