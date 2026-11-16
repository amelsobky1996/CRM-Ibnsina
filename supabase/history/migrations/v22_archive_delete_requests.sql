-- v22: task archive + delete requests.
--  * "Delete" no longer removes a task: it moves it to the archive (archive_kind = 'deleted').
--  * "Archive" moves it there too (archive_kind = 'archived'). Both can be restored.
--  * The creator / their managers / admins delete directly. An assignee who isn't one of them
--    sends a delete request to the creator, who approves (-> archive) or rejects.
--  * Only the creator / their managers / admins can remove a task for good (from the archive).

alter table public.tasks
  add column if not exists archived_at  timestamptz,
  add column if not exists archived_by  uuid references public.profiles(id) on delete set null,
  add column if not exists archive_kind text check (archive_kind in ('archived', 'deleted'));
create index if not exists tasks_archived_idx on public.tasks (archived_at) where archived_at is not null;

-- archive columns change only through the functions below
create or replace function public.tasks_guard_archive()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.archived_at, new.archived_by, new.archive_kind) is distinct from (old.archived_at, old.archived_by, old.archive_kind)
     and coalesce(current_setting('app.archive_ok', true), '') <> '1' then
    raise exception 'archive_via_rpc' using hint = 'use archive_task / restore_task';
  end if;
  return new;
end $$;
create or replace trigger tasks_guard_archive before update on public.tasks
  for each row execute function public.tasks_guard_archive();

-- who may delete a task outright (same as the "tasks delete" policy)
create or replace function public.can_delete_task(p_task uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.tasks t where t.id = p_task
      and (t.created_by = auth.uid() or public.is_ancestor(auth.uid(), t.created_by)))
$$;
revoke all on function public.can_delete_task(uuid) from public, anon;
grant execute on function public.can_delete_task(uuid) to authenticated;

-- delete requests
create table if not exists public.task_delete_requests (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  requested_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  reason       text check (char_length(reason) <= 500),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by   uuid references public.profiles(id) on delete set null,
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);
create unique index if not exists task_delete_requests_one_pending on public.task_delete_requests (task_id) where status = 'pending';
alter table public.task_delete_requests enable row level security;
create policy "delreq read" on public.task_delete_requests for select to authenticated using (public.can_see_task(task_id));
alter publication supabase_realtime add table public.task_delete_requests;

-- new notification kinds
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'assigned', 'comment', 'completed', 'due_soon', 'absent', 'thanks', 'mention', 'delete_request', 'delete_decision']));

create or replace function public._set_archived(p_task uuid, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.archive_ok', '1', true);
  update public.tasks set archived_at = case when p_kind is null then null else now() end,
                          archived_by = case when p_kind is null then null else auth.uid() end,
                          archive_kind = p_kind
   where id = p_task;
  perform set_config('app.archive_ok', '', true);
  perform public.log_activity(p_task, coalesce(p_kind, 'restored'), '{}'::jsonb);
end $$;
revoke all on function public._set_archived(uuid, text) from public, anon, authenticated;

-- archive / delete. Returns 'archived', 'deleted' or 'requested'.
create or replace function public.archive_task(p_task uuid, p_kind text default 'archived', p_reason text default null)
returns text language plpgsql security definer set search_path = public as $$
declare t public.tasks;
begin
  if auth.uid() is null or p_kind not in ('archived', 'deleted') then raise exception 'not allowed'; end if;
  select * into t from public.tasks where id = p_task;
  if not found or not public.can_work_task(p_task) then raise exception 'not allowed'; end if;
  if t.archived_at is not null then return t.archive_kind; end if;

  if p_kind = 'archived' or public.can_delete_task(p_task) then
    perform public._set_archived(p_task, p_kind);
    update public.task_delete_requests set status = 'cancelled', decided_at = now(), decided_by = auth.uid()
     where task_id = p_task and status = 'pending';
    return p_kind;
  end if;

  -- an assignee asks the person who assigned it
  if exists (select 1 from public.task_delete_requests where task_id = p_task and status = 'pending') then
    return 'requested';
  end if;
  insert into public.task_delete_requests (task_id, requested_by, reason)
  values (p_task, auth.uid(), nullif(trim(p_reason), ''));
  perform public.log_activity(p_task, 'delete_requested', jsonb_build_object('reason', nullif(trim(p_reason), '')));
  perform public.notify(coalesce(t.created_by, (select id from public.profiles where is_admin and active order by created_at limit 1)),
    p_task, 'delete_request',
    jsonb_build_object('title', t.title, 'reason', nullif(trim(p_reason), ''), 'by', auth.uid()));
  return 'requested';
end $$;
revoke all on function public.archive_task(uuid, text, text) from public, anon;
grant execute on function public.archive_task(uuid, text, text) to authenticated;

create or replace function public.decide_delete_request(p_req uuid, p_approve boolean)
returns text language plpgsql security definer set search_path = public as $$
declare r public.task_delete_requests; t public.tasks;
begin
  select * into r from public.task_delete_requests where id = p_req;
  if not found or r.status <> 'pending' or not public.can_delete_task(r.task_id) then raise exception 'not allowed'; end if;
  select * into t from public.tasks where id = r.task_id;
  update public.task_delete_requests
     set status = case when p_approve then 'approved' else 'rejected' end, decided_by = auth.uid(), decided_at = now()
   where id = p_req;
  if p_approve and t.archived_at is null then perform public._set_archived(r.task_id, 'deleted'); end if;
  if not p_approve then perform public.log_activity(r.task_id, 'delete_rejected', '{}'::jsonb); end if;
  perform public.notify(r.requested_by, r.task_id, 'delete_decision',
    jsonb_build_object('title', t.title, 'approved', p_approve));
  return case when p_approve then 'approved' else 'rejected' end;
end $$;
revoke all on function public.decide_delete_request(uuid, boolean) from public, anon;
grant execute on function public.decide_delete_request(uuid, boolean) to authenticated;

create or replace function public.cancel_delete_request(p_req uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.task_delete_requests set status = 'cancelled', decided_by = auth.uid(), decided_at = now()
   where id = p_req and status = 'pending' and requested_by = auth.uid();
  if not found then raise exception 'not allowed'; end if;
end $$;
revoke all on function public.cancel_delete_request(uuid) from public, anon;
grant execute on function public.cancel_delete_request(uuid) to authenticated;

create or replace function public.restore_task(p_task uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t public.tasks;
begin
  select * into t from public.tasks where id = p_task;
  if not found or t.archived_at is null then return; end if;
  -- a deleted task comes back only by someone allowed to delete it; an archived one by anyone working on it
  if not (public.can_delete_task(p_task) or (t.archive_kind = 'archived' and public.can_work_task(p_task))) then
    raise exception 'not allowed';
  end if;
  perform public._set_archived(p_task, null);
end $$;
revoke all on function public.restore_task(uuid) from public, anon;
grant execute on function public.restore_task(uuid) to authenticated;

-- archived / deleted tasks stay out of reminders, scores and the weekly report
create or replace function public.notify_due_soon()
returns integer language plpgsql security definer set search_path = public as $$
declare v_tomorrow date := ((now() at time zone 'Africa/Cairo')::date + 1); n int := 0; r record;
begin
  for r in
    select t.id, t.title, t.deadline, a.user_id
    from public.tasks t join public.task_assignees a on a.task_id = t.id
    where t.status <> 'done' and t.deadline = v_tomorrow and t.archived_at is null
  loop
    insert into public.notifications(user_id, task_id, type, data, dedupe)
    values (r.user_id, r.id, 'due_soon', jsonb_build_object('title', r.title, 'deadline', r.deadline),
            'due:' || r.id || ':' || r.user_id || ':' || r.deadline)
    on conflict (dedupe) do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;

-- scores: deleted tasks don't count at all; archived ones count only if they were finished
create or replace function public.team_scores(p_days integer default null)
returns table(user_id uuid, on_time integer, late integer, overdue integer, done_total integer, open_total integer)
language sql stable security definer set search_path = public as $$
  with today as (select (now() at time zone 'Africa/Cairo')::date as d),
  rows as (
    select a.user_id, t.status, t.deadline,
           (t.completed_at at time zone 'Africa/Cairo')::date as done_day, t.completed_at
    from public.task_assignees a join public.tasks t on t.id = a.task_id
    where t.archived_at is null or (t.archive_kind = 'archived' and t.status = 'done')
  )
  select p.id,
    count(*) filter (where r.status = 'done' and r.deadline is not null and r.done_day <= r.deadline
                     and (p_days is null or r.completed_at >= now() - make_interval(days => p_days)))::int,
    count(*) filter (where r.status = 'done' and r.deadline is not null and r.done_day > r.deadline
                     and (p_days is null or r.completed_at >= now() - make_interval(days => p_days)))::int,
    count(*) filter (where r.status <> 'done' and r.deadline is not null and r.deadline < (select d from today))::int,
    count(*) filter (where r.status = 'done'
                     and (p_days is null or r.completed_at >= now() - make_interval(days => p_days)))::int,
    count(*) filter (where r.status <> 'done')::int
  from public.profiles p left join rows r on r.user_id = p.id
  where p.active and auth.uid() is not null
  group by p.id;
$$;

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
    and (t.archived_at is null or (t.archive_kind = 'archived' and t.status = 'done'))
    and (
      (t.status = 'done' and t.completed_at is not null
        and (t.completed_at at time zone 'Africa/Cairo')::date between p_start and p_end)
      or (t.status <> 'done' and t.deadline <= p_end + 7)
    )
  order by (t.status = 'done') desc, t.deadline nulls last, t.title
$$;

create or replace function public.weekly_task_digest(p_start date, p_end date)
returns table(project_id uuid, user_id uuid, task_id uuid, title text, status text, progress integer, deadline date, completed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.project_id, a.user_id, t.id, t.title, t.status, t.progress, t.deadline, t.completed_at
  from public.tasks t
  join public.task_assignees a on a.task_id = t.id
  where auth.uid() is not null
    and t.project_id is not null
    and p_end >= p_start and p_end - p_start <= 92
    and (t.archived_at is null or (t.archive_kind = 'archived' and t.status = 'done'))
    and (
      (t.status = 'done' and t.completed_at is not null
        and (t.completed_at at time zone 'Africa/Cairo')::date between p_start and p_end)
      or (t.status <> 'done' and t.deadline between p_start and p_end + 7)
    )
  order by (t.status = 'done') desc, t.deadline nulls last, t.title
$$;

-- push text for the new notification kinds
create or replace function public.push_on_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor text; lang text; t text := coalesce(new.data->>'title', ''); body text; url text := '/#/tasks';
begin
  select full_name into actor from profiles where id = new.actor_id;
  select coalesce(pref_lang, 'ar') into lang from profiles where id = new.user_id;
  actor := coalesce(actor, case when lang = 'en' then 'Someone' else 'حد' end);
  if new.task_id is not null then url := '/#/tasks?task=' || new.task_id; end if;
  body := case new.type
    when 'assigned'  then case when lang = 'en' then actor || ' assigned you «' || t || '»' else actor || ' أسند لك «' || t || '»' end
    when 'comment'   then (case when lang = 'en' then actor || ' commented on «' || t || '»' else actor || ' علّق على «' || t || '»' end)
                          || coalesce(': ' || nullif(new.data->>'excerpt', ''), '')
    when 'mention'   then (case when lang = 'en' then actor || ' mentioned you on «' || t || '»' else actor || ' عمل لك منشن في «' || t || '»' end)
                          || coalesce(': ' || nullif(new.data->>'excerpt', ''), '')
    when 'completed' then case when lang = 'en' then actor || ' completed «' || t || '»' else actor || ' خلّص «' || t || '»' end
    when 'due_soon'  then case when lang = 'en' then '«' || t || '» is due tomorrow' else 'موعد تسليم «' || t || '» بكرة' end
    when 'absent'    then case when lang = 'en' then 'You were marked absent from the ' || coalesce(new.data->>'day', '') || ' stand-up (−3 points)' else 'اتسجلت غايب عن استاند أب ' || coalesce(new.data->>'day', '') || ' (−3 نقاط)' end
    when 'thanks'    then (case when lang = 'en' then actor || ' gave you +' || coalesce(new.data->>'points', '') || ' thank-you points' else actor || ' اداك +' || coalesce(new.data->>'points', '') || ' نقطة شكر' end)
                          || coalesce(' — ' || nullif(new.data->>'reason', ''), '')
    when 'delete_request' then (case when lang = 'en' then actor || ' asks to delete «' || t || '» — approve or reject' else actor || ' طالب يحذف «' || t || '» — وافق أو ارفض' end)
                          || coalesce(' — ' || nullif(new.data->>'reason', ''), '')
    when 'delete_decision' then case when (new.data->>'approved')::boolean
                          then case when lang = 'en' then actor || ' approved deleting «' || t || '»' else actor || ' وافق على حذف «' || t || '»' end
                          else case when lang = 'en' then actor || ' rejected deleting «' || t || '»' else actor || ' رفض حذف «' || t || '»' end end
    else t end;
  if new.type in ('absent', 'thanks') then url := '/#/attendance'; end if;
  perform public.send_push(new.user_id, 'Digital Team Tasks Tracker', body, url, 'n-' || new.id);
  return new;
end $$;
