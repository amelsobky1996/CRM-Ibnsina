-- v17: weekly report "Project Update" + auto digest of tasks per project/assignee/period
alter table public.weekly_updates
  add column if not exists project_update text not null default ''
  check (char_length(project_update) <= 5000);

-- Tasks per (project, assignee) for a report period: finished inside the period,
-- or still open with a deadline inside the period or up to 7 days after it.
-- Titles only; the weekly report is visible to the whole team.
create or replace function public.weekly_task_digest(p_start date, p_end date)
returns table (project_id uuid, user_id uuid, task_id uuid, title text, status text,
               progress int, deadline date, completed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.project_id, a.user_id, t.id, t.title, t.status, t.progress, t.deadline, t.completed_at
  from public.tasks t
  join public.task_assignees a on a.task_id = t.id
  where auth.uid() is not null
    and t.project_id is not null
    and p_end >= p_start and p_end - p_start <= 92
    and (
      (t.status = 'done' and t.completed_at is not null
        and (t.completed_at at time zone 'Africa/Cairo')::date between p_start and p_end)
      or (t.status <> 'done' and t.deadline between p_start and p_end + 7)
    )
  order by (t.status = 'done') desc, t.deadline nulls last, t.title
$$;
revoke all on function public.weekly_task_digest(date, date) from public, anon;
grant execute on function public.weekly_task_digest(date, date) to authenticated;
