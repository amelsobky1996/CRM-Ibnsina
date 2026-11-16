-- v20: @mentions in task descriptions.
-- People mentioned in a task's description can open it (read it, its comments, files, steps; comment and attach),
-- but only its creator / assignees / their managers / admins can change it.

alter table public.tasks add column if not exists mentions uuid[] not null default '{}';
create index if not exists tasks_mentions_gin on public.tasks using gin (mentions);

-- who can WORK on a task: exactly the old can_see_task rule
create or replace function public.can_work_task(p_task uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
    or exists (select 1 from public.tasks t
               where t.id = p_task
                 and (t.created_by = auth.uid() or public.is_ancestor(auth.uid(), t.created_by)))
    or exists (select 1 from public.task_assignees a
               where a.task_id = p_task
                 and (a.user_id = auth.uid() or public.is_ancestor(auth.uid(), a.user_id)));
$$;
revoke all on function public.can_work_task(uuid) from public, anon;
grant execute on function public.can_work_task(uuid) to authenticated;

-- who can SEE a task: the people above, plus anyone @mentioned in its description
create or replace function public.can_see_task(p_task uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_work_task(p_task)
    or exists (select 1 from public.tasks t where t.id = p_task and auth.uid() = any(t.mentions));
$$;

-- changing a task stays with the people who work on it
alter policy "tasks update" on public.tasks using (public.can_work_task(id)) with check (public.can_work_task(id));
alter policy "assignees insert" on public.task_assignees with check (public.can_work_task(task_id));
alter policy "assignees delete" on public.task_assignees using (public.can_work_task(task_id));
alter policy "subtasks insert" on public.task_subtasks with check (public.can_work_task(task_id));
alter policy "subtasks update" on public.task_subtasks using (public.can_work_task(task_id)) with check (public.can_work_task(task_id));
alter policy "subtasks delete" on public.task_subtasks using (public.can_work_task(task_id));
alter policy "links insert" on public.task_links with check (public.can_work_task(task_id) and public.can_see_task(other_id));
alter policy "links delete" on public.task_links using (public.can_work_task(task_id) or public.can_work_task(other_id));

-- notify people newly mentioned in a description (type 'mention' already has in-app text + push)
create or replace function public.notify_task_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  for uid in
    select unnest(new.mentions)
    except select unnest(case when tg_op = 'UPDATE' then old.mentions else '{}'::uuid[] end)
  loop
    if uid is distinct from auth.uid() then
      perform public.notify(uid, new.id, 'mention',
        jsonb_build_object('title', new.title, 'excerpt', left(coalesce(new.description, ''), 140)));
    end if;
  end loop;
  return new;
end $$;
create or replace trigger tasks_mentions_notify
  after insert or update of mentions on public.tasks
  for each row execute function public.notify_task_mentions();
