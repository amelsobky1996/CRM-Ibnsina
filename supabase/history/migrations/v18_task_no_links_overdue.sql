-- v18: unique task number, task links (blocked by / follow-up of), overdue tasks in the weekly digest

-- 1) a permanent, human-friendly number per task (#1, #2, ...). Assigned by the DB, never editable.
alter table public.tasks add column if not exists task_no bigint generated always as identity;
create unique index if not exists tasks_task_no_key on public.tasks(task_no);

-- 2) task links. kind 'blocked_by': task_id can't move on until other_id is done.
--                 kind 'follows'   : task_id is a follow-up / continuation of other_id.
create table if not exists public.task_links (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  other_id   uuid not null references public.tasks(id) on delete cascade,
  kind       text not null check (kind in ('blocked_by', 'follows')),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (task_id <> other_id)
);
-- one link per pair of tasks, whichever direction
create unique index if not exists task_links_pair_key
  on public.task_links (least(task_id, other_id), greatest(task_id, other_id));
create index if not exists task_links_other_idx on public.task_links(other_id);

alter table public.task_links enable row level security;
create policy "links read" on public.task_links for select to authenticated
  using (public.can_see_task(task_id) or public.can_see_task(other_id));
create policy "links insert" on public.task_links for insert to authenticated
  with check (public.can_see_task(task_id) and public.can_see_task(other_id));
create policy "links delete" on public.task_links for delete to authenticated
  using (public.can_see_task(task_id) or public.can_see_task(other_id));

-- the other end of a link may be a task this user can't open: expose only its number/title/status
create or replace function public.linked_tasks_brief(p_ids uuid[])
returns table (id uuid, task_no bigint, title text, status text, deadline date)
language sql stable security definer set search_path = public as $$
  select t.id, t.task_no, t.title, t.status, t.deadline
  from public.tasks t
  where auth.uid() is not null
    and t.id = any(p_ids)
    and exists (select 1 from public.task_links l
                where (l.other_id = t.id and public.can_see_task(l.task_id))
                   or (l.task_id = t.id and public.can_see_task(l.other_id)))
$$;
revoke all on function public.linked_tasks_brief(uuid[]) from public, anon;
grant execute on function public.linked_tasks_brief(uuid[]) to authenticated;

alter publication supabase_realtime add table public.task_links;

-- 3) weekly digest now also returns open tasks that are overdue (deadline before the period / today);
--    the app puts those under Lows and the rest under Project Update.
create or replace function public.weekly_task_digest_v2(p_start date, p_end date)
returns table (project_id uuid, user_id uuid, task_id uuid, title text, status text,
               progress int, deadline date, completed_at timestamptz, task_no bigint)
language sql stable security definer set search_path = public as $$
  select t.project_id, a.user_id, t.id, t.title, t.status, t.progress, t.deadline, t.completed_at, t.task_no
  from public.tasks t
  join public.task_assignees a on a.task_id = t.id
  where auth.uid() is not null
    and t.project_id is not null
    and p_end >= p_start and p_end - p_start <= 92
    and (
      (t.status = 'done' and t.completed_at is not null
        and (t.completed_at at time zone 'Africa/Cairo')::date between p_start and p_end)
      or (t.status <> 'done' and t.deadline <= p_end + 7)
    )
  order by (t.status = 'done') desc, t.deadline nulls last, t.title
$$;
revoke all on function public.weekly_task_digest_v2(date, date) from public, anon;
grant execute on function public.weekly_task_digest_v2(date, date) to authenticated;
