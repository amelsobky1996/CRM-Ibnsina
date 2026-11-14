-- v20: @mentions in task descriptions.
-- People mentioned in a task's description can open it (read it, its comments, files, steps, and comment),
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

-- who can SEE a task: the people above, plus anyone @mentioned in its description
create or replace function public.can_see_task(p_task uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_work_task(p_task)
    or exists (select 1 from public.tasks t where t.id = p_task and auth.uid() = any(t.mentions));
$$;

-- write policies move to can_work_task (filled in from the live policy list when applied)

-- notify newly mentioned people (type 'mention' already has push + in-app text)
create or replace function public.notify_task_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  for uid in
    select unnest(new.mentions)
    except select unnest(case when tg_op = 'UPDATE' then old.mentions else '{}'::uuid[] end)
  loop
    if uid is distinct from auth.uid() then
      insert into public.notifications (user_id, type, task_id, actor_id) values (uid, 'mention', new.id, auth.uid());
    end if;
  end loop;
  return new;
end $$;
create or replace trigger tasks_mentions_notify
  after insert or update of mentions on public.tasks
  for each row execute function public.notify_task_mentions();
