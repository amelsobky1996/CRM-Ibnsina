-- =====================================================================
-- Digital Team Tasks Tracker — full database setup
-- Exported from the live Supabase project (schema only, no data) on 2026-11-16.
--
-- How to use: new Supabase project → SQL Editor → paste this whole file → Run (once).
-- Then follow section 9 at the bottom (push notification keys) and README.md.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Extensions, schemas, settings
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net with schema extensions;   -- web push from the database
create extension if not exists pg_cron;                         -- daily "due tomorrow" reminders

create schema if not exists private;                            -- server-only settings (not exposed by the API)
revoke all on schema private from public, anon, authenticated;

set check_function_bodies = off;
set search_path = public, extensions;
-- ---------------------------------------------------------------------
-- 2) Tables (defaults & constraints are added in section 4)
-- ---------------------------------------------------------------------
create table private.app_config (
  key text not null,
  value text not null
);
create table public.attendance (
  day date not null,
  user_id uuid not null,
  status text not null
);
create table public.attendance_sessions (
  day date not null,
  taken_by uuid,
  taken_at timestamp with time zone not null,
  updated_by uuid,
  updated_at timestamp with time zone not null
);
create table public.attendance_takers (
  user_id uuid not null,
  added_by uuid,
  created_at timestamp with time zone not null
);
create table public.chat_group_members (
  group_id uuid not null,
  user_id uuid not null,
  role text not null,
  joined_at timestamp with time zone not null,
  last_read_at timestamp with time zone not null,
  cleared_at timestamp with time zone
);
create table public.chat_groups (
  id uuid not null,
  name text not null,
  color text not null,
  created_by uuid,
  created_at timestamp with time zone not null
);
create table public.group_messages (
  id uuid not null,
  group_id uuid not null,
  sender_id uuid,
  body text not null,
  created_at timestamp with time zone not null,
  deleted_at timestamp with time zone
);
create table public.messages (
  id uuid not null,
  sender_id uuid not null,
  recipient_id uuid not null,
  body text not null,
  created_at timestamp with time zone not null,
  read_at timestamp with time zone,
  deleted_for_sender boolean not null,
  deleted_for_recipient boolean not null,
  deleted_at timestamp with time zone
);
create table public.notifications (
  id uuid not null,
  user_id uuid not null,
  task_id uuid,
  actor_id uuid,
  type text not null,
  data jsonb not null,
  dedupe text,
  read_at timestamp with time zone,
  created_at timestamp with time zone not null
);
create table public.points_awards (
  id uuid not null,
  user_id uuid not null,
  points integer not null,
  reason text,
  given_by uuid,
  created_at timestamp with time zone not null
);
create table public.profiles (
  id uuid not null,
  username text not null,
  full_name text not null,
  job_title text,
  avatar_url text,
  manager_id uuid,
  is_admin boolean not null,
  active boolean not null,
  created_at timestamp with time zone not null,
  gender text,
  pref_lang text,
  pref_theme text
);
create table public.projects (
  id uuid not null,
  name text not null,
  description text,
  color text not null,
  status text not null,
  lead_id uuid,
  created_by uuid,
  created_at timestamp with time zone not null,
  "position" integer not null
);
create table public.push_subscriptions (
  id uuid not null,
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamp with time zone not null
);
create table public.report_periods (
  id uuid not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  created_by uuid,
  created_at timestamp with time zone not null
);
create table public.standup_settings (
  id integer not null,
  weekdays integer[] not null,
  updated_by uuid,
  updated_at timestamp with time zone not null
);
create table public.task_activity (
  id uuid not null,
  task_id uuid not null,
  actor_id uuid,
  action text not null,
  details jsonb not null,
  created_at timestamp with time zone not null
);
create table public.task_assignees (
  task_id uuid not null,
  user_id uuid not null,
  assigned_by uuid,
  assigned_at timestamp with time zone not null
);
create table public.task_comments (
  id uuid not null,
  task_id uuid not null,
  user_id uuid,
  body text not null,
  created_at timestamp with time zone not null,
  mentions uuid[] not null
);
create table public.task_delete_requests (
  id uuid not null,
  task_id uuid not null,
  requested_by uuid not null,
  reason text,
  status text not null,
  decided_by uuid,
  decided_at timestamp with time zone,
  created_at timestamp with time zone not null
);
create table public.task_files (
  id uuid not null,
  task_id uuid not null,
  uploaded_by uuid,
  file_name text not null,
  storage_path text not null,
  size_bytes bigint,
  mime_type text,
  created_at timestamp with time zone not null
);
create table public.task_links (
  id uuid not null,
  task_id uuid not null,
  other_id uuid not null,
  kind text not null,
  created_by uuid,
  created_at timestamp with time zone not null
);
create table public.task_statuses (
  id uuid not null,
  project_id uuid not null,
  name text not null,
  color text not null,
  kind text not null,
  "position" integer not null,
  created_at timestamp with time zone not null
);
create table public.task_subtasks (
  id uuid not null,
  task_id uuid not null,
  title text not null,
  done boolean not null,
  "position" integer not null,
  created_by uuid,
  created_at timestamp with time zone not null
);
create table public.tasks (
  id uuid not null,
  title text not null,
  description text,
  status text not null,
  priority text not null,
  progress integer not null,
  deadline date,
  created_by uuid,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null,
  completed_at timestamp with time zone,
  project_id uuid,
  status_id uuid,
  task_no bigint generated always as identity not null,
  start_date date,
  mentions uuid[] not null,
  archived_at timestamp with time zone,
  archived_by uuid,
  archive_kind text
);
create table public.weekly_updates (
  id uuid not null,
  project_id uuid not null,
  week_start date not null,
  user_id uuid not null,
  highs text not null,
  lows text not null,
  sprint text not null,
  bugs text not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null,
  project_update text not null
);
-- ---------------------------------------------------------------------
-- 3) Functions
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._set_archived(p_task uuid, p_kind text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform set_config('app.archive_ok', '1', true);
  update public.tasks set archived_at = case when p_kind is null then null else now() end,
                          archived_by = case when p_kind is null then null else auth.uid() end,
                          archive_kind = p_kind
   where id = p_task;
  perform set_config('app.archive_ok', '', true);
  perform public.log_activity(p_task, coalesce(p_kind, 'restored'), '{}'::jsonb);
end $function$
;
CREATE OR REPLACE FUNCTION public.add_group_members(p_group uuid, p_members uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n int;
begin
  if not public.is_group_owner(p_group) then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into chat_group_members (group_id, user_id)
    select p_group, m from unnest(p_members) m where exists (select 1 from profiles p where p.id = m and p.active)
    on conflict do nothing;
  get diagnostics n = row_count; return n;
end $function$
;
CREATE OR REPLACE FUNCTION public.archive_task(p_task uuid, p_kind text DEFAULT 'archived'::text, p_reason text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;
CREATE OR REPLACE FUNCTION public.assignees_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_title text;
begin
  if tg_op = 'INSERT' then
    select title into v_title from public.tasks where id = new.task_id;
    perform public.log_activity(new.task_id, 'assigned', jsonb_build_object('user_id', new.user_id));
    perform public.notify(new.user_id, new.task_id, 'assigned', jsonb_build_object('title', v_title));
    return new;
  else
    perform public.log_activity(old.task_id, 'unassigned', jsonb_build_object('user_id', old.user_id));
    return old;
  end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.can_delete_task(p_task uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.is_admin() or exists (
    select 1 from public.tasks t where t.id = p_task
      and (t.created_by = auth.uid() or public.is_ancestor(auth.uid(), t.created_by)))
$function$
;
CREATE OR REPLACE FUNCTION public.can_edit_profile(p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p_user = auth.uid() or public.is_admin() or public.is_ancestor(auth.uid(), p_user);
$function$
;
CREATE OR REPLACE FUNCTION public.can_engage_task(p_task uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.can_work_task(p_task)
    or exists (select 1 from public.tasks t where t.id = p_task and auth.uid() = any(t.mentions));
$function$
;
CREATE OR REPLACE FUNCTION public.can_see_task(p_task uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() is not null
     and exists (select 1 from public.profiles where id = auth.uid() and active);
$function$
;
CREATE OR REPLACE FUNCTION public.can_work_task(p_task uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.is_admin()
    or exists (select 1 from public.tasks t
               where t.id = p_task
                 and (t.created_by = auth.uid() or public.is_ancestor(auth.uid(), t.created_by)))
    or exists (select 1 from public.task_assignees a
               where a.task_id = p_task
                 and (a.user_id = auth.uid() or public.is_ancestor(auth.uid(), a.user_id)));
$function$
;
CREATE OR REPLACE FUNCTION public.cancel_delete_request(p_req uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.task_delete_requests set status = 'cancelled', decided_by = auth.uid(), decided_at = now()
   where id = p_req and status = 'pending' and requested_by = auth.uid();
  if not found then raise exception 'not allowed'; end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.clear_conversation(p_partner uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); n integer := 0; k integer;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  perform set_config('app.msg_rpc', '1', true);
  update messages set deleted_for_sender = true where sender_id = uid and recipient_id = p_partner and not deleted_for_sender;
  get diagnostics k = row_count; n := n + k;
  update messages set deleted_for_recipient = true where recipient_id = uid and sender_id = p_partner and not deleted_for_recipient;
  get diagnostics k = row_count; n := n + k;
  perform set_config('app.msg_rpc', '', true);
  return n;
end $function$
;
CREATE OR REPLACE FUNCTION public.comments_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_title text; v_creator uuid; v_mentions uuid[]; r record; m uuid;
begin
  select title, created_by, mentions into v_title, v_creator, v_mentions from public.tasks where id = new.task_id;
  foreach m in array coalesce(new.mentions, '{}') loop
    if exists (select 1 from profiles where id = m and is_admin)
       or m = v_creator or exists (select 1 from task_assignees where task_id = new.task_id and user_id = m)
       or public.is_ancestor(m, v_creator)
       or exists (select 1 from task_assignees a where a.task_id = new.task_id and public.is_ancestor(m, a.user_id))
       or m = any(coalesce(v_mentions, '{}')) then
      perform public.notify(m, new.task_id, 'mention', jsonb_build_object('title', v_title, 'excerpt', left(new.body, 140)));
    end if;
  end loop;
  for r in
    select user_id as uid from public.task_assignees where task_id = new.task_id
    union select v_creator
  loop
    if not (r.uid = any(coalesce(new.mentions, '{}'))) then
      perform public.notify(r.uid, new.task_id, 'comment', jsonb_build_object('title', v_title, 'excerpt', left(new.body, 140)));
    end if;
  end loop;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.create_chat_group(p_name text, p_members uuid[], p_color text DEFAULT '#0B6FC4'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); gid uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  insert into chat_groups (name, color, created_by) values (btrim(p_name), coalesce(p_color, '#0B6FC4'), uid) returning id into gid;
  insert into chat_group_members (group_id, user_id, role) values (gid, uid, 'owner');
  insert into chat_group_members (group_id, user_id)
    select gid, m from unnest(p_members) m where m <> uid and exists (select 1 from profiles p where p.id = m and p.active)
    on conflict do nothing;
  return gid;
end $function$
;
CREATE OR REPLACE FUNCTION public.decide_delete_request(p_req uuid, p_approve boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;
CREATE OR REPLACE FUNCTION public.delete_chat_group(p_group uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_group_owner(p_group) then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from chat_groups where id = p_group;
end $function$
;
CREATE OR REPLACE FUNCTION public.delete_group_message(p_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n int;
begin
  update group_messages set body = '', deleted_at = now() where id = p_id and sender_id = auth.uid() and deleted_at is null;
  get diagnostics n = row_count; return n;
end $function$
;
CREATE OR REPLACE FUNCTION public.delete_messages(p_ids uuid[], p_for_everyone boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); n integer := 0; k integer;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  perform set_config('app.msg_rpc', '1', true);
  if p_for_everyone then
    update messages set body = '', deleted_at = now()
     where id = any(p_ids) and sender_id = uid and deleted_at is null;
    get diagnostics n = row_count;
  else
    update messages set deleted_for_sender = true where id = any(p_ids) and sender_id = uid;
    get diagnostics k = row_count; n := n + k;
    update messages set deleted_for_recipient = true where id = any(p_ids) and recipient_id = uid;
    get diagnostics k = row_count; n := n + k;
  end if;
  perform set_config('app.msg_rpc', '', true);
  return n;
end $function$
;
CREATE OR REPLACE FUNCTION public.delete_task_status(p_id uuid, p_move_to uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare src record; dst record; n int;
begin
  if not public.is_manager() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into src from task_statuses where id = p_id;
  select * into dst from task_statuses where id = p_move_to;
  if src.id is null or dst.id is null or src.project_id <> dst.project_id or src.id = dst.id then raise exception 'عمود غير صالح'; end if;
  update tasks set status_id = dst.id where status_id = src.id;
  get diagnostics n = row_count;
  delete from task_statuses where id = src.id;
  return n;
end $function$
;
CREATE OR REPLACE FUNCTION public.files_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.task_id, 'file_added', jsonb_build_object('name', new.file_name));
    return new;
  else
    perform public.log_activity(old.task_id, 'file_removed', jsonb_build_object('name', old.file_name));
    return old;
  end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_username text := lower(coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(new.email,'@',1)));
  v_first    boolean := not exists (select 1 from public.profiles);
begin
  insert into public.profiles (id, username, full_name, job_title, manager_id, is_admin)
  values (
    new.id,
    v_username,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), v_username),
    nullif(new.raw_user_meta_data->>'job_title',''),
    nullif(new.raw_user_meta_data->>'manager_id','')::uuid,
    v_first
  );
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$function$
;
CREATE OR REPLACE FUNCTION public.is_ancestor(p_manager uuid, p_emp uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with recursive chain(mid) as (
    select manager_id from public.profiles where id = p_emp
    union
    select p.manager_id from public.profiles p join chain c on p.id = c.mid
    where c.mid is not null
  )
  select p_manager is not null and exists (select 1 from chain where mid = p_manager);
$function$
;
CREATE OR REPLACE FUNCTION public.is_attendance_taker(uid uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select is_admin from profiles where id = uid), false)
      or exists (select 1 from attendance_takers where user_id = uid);
$function$
;
CREATE OR REPLACE FUNCTION public.is_group_member(p_group uuid, p_user uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from chat_group_members where group_id = p_group and user_id = p_user);
$function$
;
CREATE OR REPLACE FUNCTION public.is_group_owner(p_group uuid, p_user uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from chat_group_members where group_id = p_group and user_id = p_user and role = 'owner');
$function$
;
CREATE OR REPLACE FUNCTION public.is_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.is_admin() or exists (select 1 from public.profiles where manager_id = auth.uid());
$function$
;
CREATE OR REPLACE FUNCTION public.linked_tasks_brief(p_ids uuid[])
 RETURNS TABLE(id uuid, task_no bigint, title text, status text, deadline date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select t.id, t.task_no, t.title, t.status, t.deadline
  from public.tasks t
  where auth.uid() is not null
    and t.id = any(p_ids)
    and exists (select 1 from public.task_links l
                where (l.other_id = t.id and public.can_see_task(l.task_id))
                   or (l.task_id = t.id and public.can_see_task(l.other_id)))
$function$
;
CREATE OR REPLACE FUNCTION public.log_activity(p_task uuid, p_action text, p_details jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if exists (select 1 from public.tasks where id = p_task) then
    insert into public.task_activity(task_id, actor_id, action, details) values (p_task, auth.uid(), p_action, coalesce(p_details, '{}'::jsonb));
  end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.mark_group_read(p_group uuid, p_clear boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update chat_group_members set last_read_at = now(), cleared_at = case when p_clear then now() else cleared_at end
   where group_id = p_group and user_id = auth.uid();
end $function$
;
CREATE OR REPLACE FUNCTION public.messages_guard_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is not null and coalesce(current_setting('app.msg_rpc', true), '') <> '1' then
    new.id := old.id; new.sender_id := old.sender_id; new.recipient_id := old.recipient_id;
    new.body := old.body; new.created_at := old.created_at;
    new.deleted_for_sender := old.deleted_for_sender; new.deleted_for_recipient := old.deleted_for_recipient;
    new.deleted_at := old.deleted_at;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.notify(p_user uuid, p_task uuid, p_type text, p_data jsonb, p_dedupe text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_user is null or p_user = auth.uid() then return; end if;
  if not exists (select 1 from public.profiles where id = p_user and active) then return; end if;
  insert into public.notifications(user_id, task_id, actor_id, type, data, dedupe)
  values (p_user, p_task, auth.uid(), p_type, coalesce(p_data, '{}'::jsonb), p_dedupe)
  on conflict (dedupe) do nothing;
end $function$
;
CREATE OR REPLACE FUNCTION public.notify_absent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'absent' then
    insert into notifications (user_id, actor_id, type, data, dedupe)
    values (new.user_id, auth.uid(), 'absent', jsonb_build_object('day', new.day), 'absent:' || new.user_id || ':' || new.day)
    on conflict (dedupe) do nothing;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.notify_due_soon()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;
CREATE OR REPLACE FUNCTION public.notify_task_mentions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;
CREATE OR REPLACE FUNCTION public.notify_thanks()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into notifications (user_id, actor_id, type, data)
  values (new.user_id, new.given_by, 'thanks', jsonb_build_object('points', new.points, 'reason', coalesce(new.reason, '')));
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.points_cycle_start(d date)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case when extract(day from d) >= 16 then make_date(extract(year from d)::int, extract(month from d)::int, 16)
              else (make_date(extract(year from d)::int, extract(month from d)::int, 16) - interval '1 month')::date end;
$function$
;
CREATE OR REPLACE FUNCTION public.points_summary(p_start date DEFAULT NULL::date)
 RETURNS TABLE(user_id uuid, total integer, present integer, absent integer, penalty integer, thanks integer, cycle_start date, cycle_end date)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with c as (
    select public.points_cycle_start(coalesce(p_start, (now() at time zone 'Africa/Cairo')::date)) s
  ), cc as (select s, (s + interval '1 month' - interval '1 day')::date e from c),
  a as (
    select at.user_id, count(*) filter (where status = 'present')::int pr, count(*) filter (where status = 'absent')::int ab
    from attendance at, cc where at.day between cc.s and cc.e group by at.user_id),
  t as (
    select pa.user_id, sum(points)::int th from points_awards pa, cc
    where (pa.created_at at time zone 'Africa/Cairo')::date between cc.s and cc.e group by pa.user_id)
  -- 100 each cycle; absent -3; every 3rd absence in the cycle -10; + thank-you points. Attending adds nothing.
  select p.id,
         100 - coalesce(a.ab, 0) * 3 - (coalesce(a.ab, 0) / 3) * 10 + coalesce(t.th, 0),
         coalesce(a.pr, 0), coalesce(a.ab, 0), (coalesce(a.ab, 0) / 3) * 10, coalesce(t.th, 0),
         cc.s, cc.e
  from profiles p cross join cc
  left join a on a.user_id = p.id
  left join t on t.user_id = p.id;
$function$
;
CREATE OR REPLACE FUNCTION public.projects_lock_created_by()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.created_by is distinct from old.created_by and auth.uid() is not null then
    new.created_by := old.created_by;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.projects_position_default()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.position is null or new.position = 0 then
    select coalesce(max(position), 0) + 1 into new.position from public.projects;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.projects_seed_statuses()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin perform public.seed_project_statuses(new.id); return new; end $function$
;
CREATE OR REPLACE FUNCTION public.protect_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_service boolean := auth.uid() is null;
  v_priv    boolean := v_service or public.is_admin() or public.is_ancestor(auth.uid(), new.id);
begin
  new.username := old.username;
  if not v_priv then
    new.manager_id := old.manager_id;
    new.job_title  := old.job_title;
    new.active     := old.active;
  end if;
  if not (v_service or public.is_admin()) then
    new.is_admin := old.is_admin;
  end if;
  if new.manager_id is not null
     and (new.manager_id = new.id or public.is_ancestor(new.id, new.manager_id)) then
    raise exception 'لا يمكن أن يكون الموظف مديرًا لمديره';
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.push_config()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'private'
AS $function$
  select jsonb_object_agg(key, value) from private.app_config where key in ('push_secret', 'vapid_public', 'vapid_private', 'vapid_subject');
$function$
;
CREATE OR REPLACE FUNCTION public.push_on_group_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare g text; who text; r record;
begin
  select name into g from chat_groups where id = new.group_id;
  select full_name into who from profiles where id = new.sender_id;
  for r in select user_id from chat_group_members where group_id = new.group_id and user_id <> new.sender_id loop
    perform public.send_push(r.user_id, coalesce(g, 'Group'),
      coalesce(who, '') || ': ' || case when char_length(new.body) > 120 then left(new.body, 120) || '…' else new.body end,
      '/#/chat?group=' || new.group_id, 'group-' || new.group_id);
  end loop;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.push_on_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare who text;
begin
  select full_name into who from profiles where id = new.sender_id;
  perform public.send_push(new.recipient_id, coalesce(who, 'رسالة جديدة'),
    case when char_length(new.body) > 140 then left(new.body, 140) || '…' else new.body end,
    '/#/chat?with=' || new.sender_id, 'chat-' || new.sender_id);
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.remove_group_member(p_group uuid, p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); next_owner uuid;
begin
  if p_user <> uid and not public.is_group_owner(p_group) then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from chat_group_members where group_id = p_group and user_id = p_user;
  if not exists (select 1 from chat_group_members where group_id = p_group) then
    delete from chat_groups where id = p_group; return;
  end if;
  if not exists (select 1 from chat_group_members where group_id = p_group and role = 'owner') then
    select user_id into next_owner from chat_group_members where group_id = p_group order by joined_at limit 1;
    update chat_group_members set role = 'owner' where group_id = p_group and user_id = next_owner;
  end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.reorder_projects(p_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.projects p set position = o.n
  from unnest(p_ids) with ordinality as o(id, n)
  where p.id = o.id;
end $function$
;
CREATE OR REPLACE FUNCTION public.report_period_moved()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.start_date <> old.start_date then
    update public.weekly_updates set week_start = new.start_date where week_start = old.start_date;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.retract_absent_notifs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from notifications where type = 'absent' and data->>'day' = old.day::text;
  return old;
end $function$
;
CREATE OR REPLACE FUNCTION public.save_attendance(p_day date, p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); n int;
begin
  if not public.is_attendance_taker(uid) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_day > (now() at time zone 'Africa/Cairo')::date then raise exception 'لا يمكن تسجيل غياب ليوم في المستقبل'; end if;
  insert into attendance_sessions (day, taken_by, updated_by) values (p_day, uid, uid)
    on conflict (day) do update set updated_by = uid, updated_at = now();
  delete from attendance where day = p_day;
  insert into attendance (day, user_id, status)
    select p_day, (r->>'user_id')::uuid, r->>'status'
    from jsonb_array_elements(p_rows) r
    where exists (select 1 from profiles p where p.id = (r->>'user_id')::uuid);
  get diagnostics n = row_count;
  delete from notifications nt
   where nt.type = 'absent' and nt.data->>'day' = p_day::text
     and not exists (select 1 from attendance a where a.day = p_day and a.user_id = nt.user_id and a.status = 'absent');
  return n;
end $function$
;
CREATE OR REPLACE FUNCTION public.seed_project_statuses(p_project uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into task_statuses (project_id, name, color, kind, position)
  select p_project, v.name, v.color, v.kind, v.pos from (values
    ('جديدة', '#64748B', 'todo', 0), ('قيد التنفيذ', '#0B6FC4', 'in_progress', 1), ('مراجعة', '#7A4FD0', 'review', 2),
    ('مكتملة', '#17996A', 'done', 3), ('متوقفة', '#D13B47', 'blocked', 4)) v(name, color, kind, pos)
  where not exists (select 1 from task_statuses where project_id = p_project);
$function$
;
-- Web push: calls the push-send Edge Function. The project URL is read from private.app_config ('project_url'),
-- so this works on any Supabase project (see section 9 at the end of this file).
CREATE OR REPLACE FUNCTION public.send_push(p_user uuid, p_title text, p_body text, p_url text, p_tag text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare sec text; base text;
begin
  if not exists (select 1 from push_subscriptions where user_id = p_user) then return; end if;
  select value into sec from private.app_config where key = 'push_secret';
  select value into base from private.app_config where key = 'project_url';
  if sec is null or base is null then return; end if;
  perform net.http_post(
    url := rtrim(base, '/') || '/functions/v1/push-send',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', sec),
    body := jsonb_build_object('user_id', p_user, 'title', p_title, 'body', p_body, 'url', p_url, 'tag', p_tag),
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning 'send_push failed: %', sqlerrm;
end $function$
;
CREATE OR REPLACE FUNCTION public.set_group_owner(p_group uuid, p_user uuid, p_owner boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_group_owner(p_group) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not p_owner and not exists (select 1 from chat_group_members where group_id = p_group and role = 'owner' and user_id <> p_user) then
    raise exception 'لازم يفضل مشرف واحد على الأقل';
  end if;
  update chat_group_members set role = case when p_owner then 'owner' else 'member' end where group_id = p_group and user_id = p_user;
end $function$
;
CREATE OR REPLACE FUNCTION public.subtasks_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_task uuid := coalesce(new.task_id, old.task_id); v_total int; v_done int;
begin
  if not exists (select 1 from public.tasks where id = v_task) then return null; end if;
  if tg_op = 'INSERT' then
    perform public.log_activity(v_task, 'subtask_added', jsonb_build_object('title', new.title));
  elsif tg_op = 'UPDATE' and new.done is distinct from old.done then
    perform public.log_activity(v_task, case when new.done then 'subtask_done' else 'subtask_undone' end, jsonb_build_object('title', new.title));
  end if;
  select count(*), count(*) filter (where done) into v_total, v_done from public.task_subtasks where task_id = v_task;
  if v_total > 0 then
    update public.tasks set progress = round(v_done * 100.0 / v_total)
      where id = v_task and status <> 'done' and progress is distinct from round(v_done * 100.0 / v_total)::int;
  end if;
  return null;
end $function$
;
CREATE OR REPLACE FUNCTION public.tasks_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.id, 'created', jsonb_build_object('title', new.title));
    return new;
  end if;
  if new.status is distinct from old.status then
    perform public.log_activity(new.id, 'status', jsonb_build_object('from', old.status, 'to', new.status));
    if new.status = 'done' then
      perform public.notify(new.created_by, new.id, 'completed', jsonb_build_object('title', new.title));
    end if;
  elsif new.progress is distinct from old.progress then
    perform public.log_activity(new.id, 'progress', jsonb_build_object('from', old.progress, 'to', new.progress));
  end if;
  if new.deadline is distinct from old.deadline then
    perform public.log_activity(new.id, 'deadline', jsonb_build_object('from', old.deadline, 'to', new.deadline));
  end if;
  if new.title is distinct from old.title then
    perform public.log_activity(new.id, 'title', jsonb_build_object('from', old.title, 'to', new.title));
  end if;
  if new.priority is distinct from old.priority then
    perform public.log_activity(new.id, 'priority', jsonb_build_object('from', old.priority, 'to', new.priority));
  end if;
  if new.project_id is distinct from old.project_id then
    perform public.log_activity(new.id, 'project', jsonb_build_object('to', (select name from public.projects where id = new.project_id)));
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.tasks_status_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c_id uuid; c_kind text; c_proj uuid; f_id uuid; f_kind text;
begin
  if new.project_id is null then new.status_id := null; return new; end if;
  if new.status_id is not null then
    select id, kind, project_id into c_id, c_kind, c_proj from task_statuses where id = new.status_id;
    if c_id is null or c_proj <> new.project_id then new.status_id := null; c_id := null; c_kind := null; end if;
  end if;
  -- an explicit move to a column wins: the task takes that column's kind
  if new.status_id is not null and (tg_op = 'INSERT' or new.status_id is distinct from old.status_id) then
    new.status := c_kind;
    return new;
  end if;
  -- otherwise make sure the column matches the kind (kind changed, project changed, or no column yet)
  if new.status_id is not null and c_kind = new.status then return new; end if;
  select id into f_id from task_statuses where project_id = new.project_id and kind = new.status order by position limit 1;
  if f_id is null then
    select id, kind into f_id, f_kind from task_statuses where project_id = new.project_id order by position limit 1;
    if f_kind is not null then new.status := f_kind; end if;
  end if;
  new.status_id := f_id;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.tasks_touch()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at := now();
  if new.status = 'done' then
    if tg_op = 'INSERT' or old.status <> 'done' then
      new.completed_at := now();
    end if;
    new.progress := 100;
  else
    new.completed_at := null;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.update_chat_group(p_group uuid, p_name text, p_color text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_group_owner(p_group) then raise exception 'not allowed' using errcode = '42501'; end if;
  update chat_groups set name = coalesce(nullif(btrim(p_name), ''), name), color = coalesce(p_color, color) where id = p_group;
end $function$
;
CREATE OR REPLACE FUNCTION public.weekly_touch()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin new.updated_at := now(); return new; end $function$
;
create or replace function public.tasks_guard_archive()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.archived_at, new.archived_by, new.archive_kind) is distinct from (old.archived_at, old.archived_by, old.archive_kind)
     and coalesce(current_setting('app.archive_ok', true), '') <> '1' then
    raise exception 'archive_via_rpc' using hint = 'use archive_task / restore_task';
  end if;
  return new;
end $$;
create or replace function public.restore_task(p_task uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t public.tasks;
begin
  select * into t from public.tasks where id = p_task;
  if not found or t.archived_at is null then return; end if;
  if not (public.can_delete_task(p_task) or (t.archive_kind = 'archived' and public.can_work_task(p_task))) then
    raise exception 'not allowed';
  end if;
  perform public._set_archived(p_task, null);
end $$;
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
-- ---------------------------------------------------------------------
-- 4) Defaults, keys, checks, foreign keys, indexes
-- ---------------------------------------------------------------------
alter table attendance_sessions alter column taken_at set default now();
alter table attendance_sessions alter column updated_at set default now();
alter table attendance_takers alter column created_at set default now();
alter table chat_group_members alter column joined_at set default now();
alter table chat_group_members alter column last_read_at set default now();
alter table chat_group_members alter column role set default 'member'::text;
alter table chat_groups alter column color set default '#0B6FC4'::text;
alter table chat_groups alter column created_at set default now();
alter table chat_groups alter column id set default gen_random_uuid();
alter table group_messages alter column created_at set default now();
alter table group_messages alter column id set default gen_random_uuid();
alter table messages alter column created_at set default now();
alter table messages alter column deleted_for_recipient set default false;
alter table messages alter column deleted_for_sender set default false;
alter table messages alter column id set default gen_random_uuid();
alter table notifications alter column created_at set default now();
alter table notifications alter column data set default '{}'::jsonb;
alter table notifications alter column id set default gen_random_uuid();
alter table points_awards alter column created_at set default now();
alter table points_awards alter column id set default gen_random_uuid();
alter table profiles alter column active set default true;
alter table profiles alter column created_at set default now();
alter table profiles alter column is_admin set default false;
alter table projects alter column "position" set default 0;
alter table projects alter column color set default '#0B6FC4'::text;
alter table projects alter column created_at set default now();
alter table projects alter column created_by set default auth.uid();
alter table projects alter column id set default gen_random_uuid();
alter table projects alter column status set default 'active'::text;
alter table push_subscriptions alter column created_at set default now();
alter table push_subscriptions alter column id set default gen_random_uuid();
alter table report_periods alter column created_at set default now();
alter table report_periods alter column created_by set default auth.uid();
alter table report_periods alter column id set default gen_random_uuid();
alter table report_periods alter column name set default ''::text;
alter table standup_settings alter column id set default 1;
alter table standup_settings alter column updated_at set default now();
alter table standup_settings alter column weekdays set default '{0,1,2,3,4}'::integer[];
alter table task_activity alter column created_at set default now();
alter table task_activity alter column details set default '{}'::jsonb;
alter table task_activity alter column id set default gen_random_uuid();
alter table task_assignees alter column assigned_at set default now();
alter table task_assignees alter column assigned_by set default auth.uid();
alter table task_comments alter column created_at set default now();
alter table task_comments alter column id set default gen_random_uuid();
alter table task_comments alter column mentions set default '{}'::uuid[];
alter table task_comments alter column user_id set default auth.uid();
alter table task_delete_requests alter column created_at set default now();
alter table task_delete_requests alter column id set default gen_random_uuid();
alter table task_delete_requests alter column requested_by set default auth.uid();
alter table task_delete_requests alter column status set default 'pending'::text;
alter table task_files alter column created_at set default now();
alter table task_files alter column id set default gen_random_uuid();
alter table task_files alter column uploaded_by set default auth.uid();
alter table task_links alter column created_at set default now();
alter table task_links alter column created_by set default auth.uid();
alter table task_links alter column id set default gen_random_uuid();
alter table task_statuses alter column "position" set default 0;
alter table task_statuses alter column color set default '#64748B'::text;
alter table task_statuses alter column created_at set default now();
alter table task_statuses alter column id set default gen_random_uuid();
alter table task_statuses alter column kind set default 'in_progress'::text;
alter table task_subtasks alter column "position" set default 0;
alter table task_subtasks alter column created_at set default now();
alter table task_subtasks alter column created_by set default auth.uid();
alter table task_subtasks alter column done set default false;
alter table task_subtasks alter column id set default gen_random_uuid();
alter table tasks alter column created_at set default now();
alter table tasks alter column created_by set default auth.uid();
alter table tasks alter column id set default gen_random_uuid();
alter table tasks alter column mentions set default '{}'::uuid[];
alter table tasks alter column priority set default 'medium'::text;
alter table tasks alter column progress set default 0;
alter table tasks alter column status set default 'todo'::text;
alter table tasks alter column updated_at set default now();
alter table weekly_updates alter column bugs set default ''::text;
alter table weekly_updates alter column created_at set default now();
alter table weekly_updates alter column highs set default ''::text;
alter table weekly_updates alter column id set default gen_random_uuid();
alter table weekly_updates alter column lows set default ''::text;
alter table weekly_updates alter column project_update set default ''::text;
alter table weekly_updates alter column sprint set default ''::text;
alter table weekly_updates alter column updated_at set default now();
alter table attendance add constraint attendance_pkey PRIMARY KEY (day, user_id);
alter table attendance_sessions add constraint attendance_sessions_pkey PRIMARY KEY (day);
alter table attendance_takers add constraint attendance_takers_pkey PRIMARY KEY (user_id);
alter table chat_group_members add constraint chat_group_members_pkey PRIMARY KEY (group_id, user_id);
alter table chat_groups add constraint chat_groups_pkey PRIMARY KEY (id);
alter table group_messages add constraint group_messages_pkey PRIMARY KEY (id);
alter table messages add constraint messages_pkey PRIMARY KEY (id);
alter table notifications add constraint notifications_pkey PRIMARY KEY (id);
alter table points_awards add constraint points_awards_pkey PRIMARY KEY (id);
alter table private.app_config add constraint app_config_pkey PRIMARY KEY (key);
alter table profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table projects add constraint projects_pkey PRIMARY KEY (id);
alter table push_subscriptions add constraint push_subscriptions_pkey PRIMARY KEY (id);
alter table report_periods add constraint report_periods_pkey PRIMARY KEY (id);
alter table standup_settings add constraint standup_settings_pkey PRIMARY KEY (id);
alter table task_activity add constraint task_activity_pkey PRIMARY KEY (id);
alter table task_assignees add constraint task_assignees_pkey PRIMARY KEY (task_id, user_id);
alter table task_comments add constraint task_comments_pkey PRIMARY KEY (id);
alter table task_delete_requests add constraint task_delete_requests_pkey PRIMARY KEY (id);
alter table task_files add constraint task_files_pkey PRIMARY KEY (id);
alter table task_links add constraint task_links_pkey PRIMARY KEY (id);
alter table task_statuses add constraint task_statuses_pkey PRIMARY KEY (id);
alter table task_subtasks add constraint task_subtasks_pkey PRIMARY KEY (id);
alter table tasks add constraint tasks_pkey PRIMARY KEY (id);
alter table weekly_updates add constraint weekly_updates_pkey PRIMARY KEY (id);
alter table notifications add constraint notifications_dedupe_key UNIQUE (dedupe);
alter table profiles add constraint profiles_username_key UNIQUE (username);
alter table push_subscriptions add constraint push_subscriptions_endpoint_key UNIQUE (endpoint);
alter table task_files add constraint task_files_storage_path_key UNIQUE (storage_path);
alter table weekly_updates add constraint weekly_updates_project_id_week_start_user_id_key UNIQUE (project_id, week_start, user_id);
alter table attendance add constraint attendance_status_check CHECK ((status = ANY (ARRAY['present'::text, 'absent'::text])));
alter table chat_group_members add constraint chat_group_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'member'::text])));
alter table chat_groups add constraint chat_groups_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 60)));
alter table group_messages add constraint group_messages_check CHECK ((((deleted_at IS NULL) AND ((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 4000))) OR ((deleted_at IS NOT NULL) AND (body = ''::text))));
alter table messages add constraint messages_body_check CHECK ((((deleted_at IS NULL) AND ((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 4000))) OR ((deleted_at IS NOT NULL) AND (body = ''::text))));
alter table messages add constraint messages_check CHECK ((sender_id <> recipient_id));
alter table notifications add constraint notifications_type_check CHECK ((type = ANY (ARRAY['assigned'::text, 'comment'::text, 'completed'::text, 'due_soon'::text, 'absent'::text, 'thanks'::text, 'mention'::text, 'delete_request'::text, 'delete_decision'::text])));
alter table points_awards add constraint points_awards_points_check CHECK (((points >= 1) AND (points <= 1000)));
alter table points_awards add constraint points_awards_reason_check CHECK ((char_length(reason) <= 300));
alter table profiles add constraint profiles_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text])));
alter table profiles add constraint profiles_pref_lang_check CHECK ((pref_lang = ANY (ARRAY['ar'::text, 'en'::text])));
alter table profiles add constraint profiles_pref_theme_check CHECK ((pref_theme = ANY (ARRAY['light'::text, 'dark'::text, 'system'::text])));
alter table projects add constraint projects_color_check CHECK ((color ~ '^#[0-9A-Fa-f]{6}$'::text));
alter table projects add constraint projects_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 120)));
alter table projects add constraint projects_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])));
alter table report_periods add constraint report_periods_check CHECK ((end_date > start_date));
alter table report_periods add constraint report_periods_check1 CHECK (((end_date - start_date) <= 92));
alter table report_periods add constraint report_periods_name_check CHECK ((char_length(name) <= 80));
alter table standup_settings add constraint standup_settings_id_check CHECK ((id = 1));
alter table task_comments add constraint task_comments_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 4000)));
alter table task_delete_requests add constraint task_delete_requests_reason_check CHECK ((char_length(reason) <= 500));
alter table task_delete_requests add constraint task_delete_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])));
alter table task_links add constraint task_links_check CHECK ((task_id <> other_id));
alter table task_links add constraint task_links_kind_check CHECK ((kind = ANY (ARRAY['blocked_by'::text, 'follows'::text])));
alter table task_statuses add constraint task_statuses_color_check CHECK ((color ~ '^#[0-9A-Fa-f]{6}$'::text));
alter table task_statuses add constraint task_statuses_kind_check CHECK ((kind = ANY (ARRAY['todo'::text, 'in_progress'::text, 'review'::text, 'blocked'::text, 'done'::text])));
alter table task_statuses add constraint task_statuses_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 40)));
alter table task_subtasks add constraint task_subtasks_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 300)));
alter table tasks add constraint tasks_archive_kind_check CHECK ((archive_kind = ANY (ARRAY['archived'::text, 'deleted'::text])));
alter table tasks add constraint tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));
alter table tasks add constraint tasks_progress_check CHECK (((progress >= 0) AND (progress <= 100)));
alter table tasks add constraint tasks_start_before_end CHECK (((start_date IS NULL) OR (deadline IS NULL) OR (start_date <= deadline)));
alter table tasks add constraint tasks_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'review'::text, 'blocked'::text, 'done'::text])));
alter table tasks add constraint tasks_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 200)));
alter table weekly_updates add constraint weekly_updates_bugs_check CHECK ((char_length(bugs) <= 5000));
alter table weekly_updates add constraint weekly_updates_highs_check CHECK ((char_length(highs) <= 5000));
alter table weekly_updates add constraint weekly_updates_lows_check CHECK ((char_length(lows) <= 5000));
alter table weekly_updates add constraint weekly_updates_project_update_check CHECK ((char_length(project_update) <= 5000));
alter table weekly_updates add constraint weekly_updates_sprint_check CHECK ((char_length(sprint) <= 5000));
alter table attendance add constraint attendance_day_fkey FOREIGN KEY (day) REFERENCES attendance_sessions(day) ON DELETE CASCADE;
alter table attendance add constraint attendance_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table attendance_sessions add constraint attendance_sessions_taken_by_fkey FOREIGN KEY (taken_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table attendance_sessions add constraint attendance_sessions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table attendance_takers add constraint attendance_takers_added_by_fkey FOREIGN KEY (added_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table attendance_takers add constraint attendance_takers_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table chat_group_members add constraint chat_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE;
alter table chat_group_members add constraint chat_group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table chat_groups add constraint chat_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table group_messages add constraint group_messages_group_id_fkey FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE;
alter table group_messages add constraint group_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table messages add constraint messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table messages add constraint messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table notifications add constraint notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table notifications add constraint notifications_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
alter table notifications add constraint notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table points_awards add constraint points_awards_given_by_fkey FOREIGN KEY (given_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table points_awards add constraint points_awards_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table profiles add constraint profiles_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table projects add constraint projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table projects add constraint projects_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table push_subscriptions add constraint push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table report_periods add constraint report_periods_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table standup_settings add constraint standup_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table task_activity add constraint task_activity_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table task_activity add constraint task_activity_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
alter table task_assignees add constraint task_assignees_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table task_assignees add constraint task_assignees_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
alter table task_assignees add constraint task_assignees_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table task_comments add constraint task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
alter table task_comments add constraint task_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table task_delete_requests add constraint task_delete_requests_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table task_delete_requests add constraint task_delete_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE CASCADE;
alter table task_delete_requests add constraint task_delete_requests_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
alter table task_files add constraint task_files_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
alter table task_files add constraint task_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table task_links add constraint task_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table task_links add constraint task_links_other_id_fkey FOREIGN KEY (other_id) REFERENCES tasks(id) ON DELETE CASCADE;
alter table task_links add constraint task_links_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
alter table task_statuses add constraint task_statuses_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
alter table task_subtasks add constraint task_subtasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table task_subtasks add constraint task_subtasks_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
alter table tasks add constraint tasks_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table tasks add constraint tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table tasks add constraint tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
alter table tasks add constraint tasks_status_id_fkey FOREIGN KEY (status_id) REFERENCES task_statuses(id) ON DELETE SET NULL;
alter table weekly_updates add constraint weekly_updates_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
alter table weekly_updates add constraint weekly_updates_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
CREATE INDEX attendance_user_idx ON public.attendance USING btree (user_id, day);
CREATE INDEX cgm_user_idx ON public.chat_group_members USING btree (user_id);
CREATE INDEX gm_group_idx ON public.group_messages USING btree (group_id, created_at DESC);
CREATE INDEX messages_pair_idx ON public.messages USING btree (LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id), created_at DESC);
CREATE INDEX messages_recipient_unread_idx ON public.messages USING btree (recipient_id) WHERE (read_at IS NULL);
CREATE INDEX messages_sender_idx ON public.messages USING btree (sender_id, created_at DESC);
CREATE INDEX notifications_user_idx ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX points_awards_user_idx ON public.points_awards USING btree (user_id);
CREATE INDEX profiles_manager_idx ON public.profiles USING btree (manager_id);
CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions USING btree (user_id);
CREATE INDEX task_activity_task_idx ON public.task_activity USING btree (task_id, created_at);
CREATE INDEX task_assignees_user_idx ON public.task_assignees USING btree (user_id);
CREATE INDEX task_comments_task_idx ON public.task_comments USING btree (task_id, created_at);
CREATE INDEX task_files_task_idx ON public.task_files USING btree (task_id);
CREATE INDEX task_links_other_idx ON public.task_links USING btree (other_id);
CREATE INDEX task_statuses_project_idx ON public.task_statuses USING btree (project_id, "position");
CREATE INDEX task_subtasks_task_idx ON public.task_subtasks USING btree (task_id, "position");
CREATE INDEX tasks_archived_idx ON public.tasks USING btree (archived_at) WHERE (archived_at IS NOT NULL);
CREATE INDEX tasks_created_by_idx ON public.tasks USING btree (created_by);
CREATE INDEX tasks_mentions_gin ON public.tasks USING gin (mentions);
CREATE INDEX tasks_project_idx ON public.tasks USING btree (project_id);
CREATE INDEX tasks_status_id_idx ON public.tasks USING btree (status_id);
CREATE INDEX weekly_updates_week_idx ON public.weekly_updates USING btree (week_start, project_id);
CREATE UNIQUE INDEX task_delete_requests_one_pending ON public.task_delete_requests USING btree (task_id) WHERE (status = 'pending'::text);
CREATE UNIQUE INDEX task_links_pair_key ON public.task_links USING btree (LEAST(task_id, other_id), GREATEST(task_id, other_id));
CREATE UNIQUE INDEX tasks_task_no_key ON public.tasks USING btree (task_no);
alter table report_periods add constraint report_periods_no_overlap EXCLUDE USING gist (daterange(start_date, end_date, '[]'::text) WITH &&);
-- ---------------------------------------------------------------------
-- 5) Triggers
-- ---------------------------------------------------------------------
CREATE TRIGGER assignees_audit AFTER INSERT OR DELETE ON public.task_assignees FOR EACH ROW EXECUTE FUNCTION assignees_audit();
CREATE TRIGGER attendance_notify AFTER INSERT ON public.attendance FOR EACH ROW EXECUTE FUNCTION notify_absent();
CREATE TRIGGER awards_notify AFTER INSERT ON public.points_awards FOR EACH ROW EXECUTE FUNCTION notify_thanks();
CREATE TRIGGER comments_notify AFTER INSERT ON public.task_comments FOR EACH ROW EXECUTE FUNCTION comments_notify();
CREATE TRIGGER files_audit AFTER INSERT OR DELETE ON public.task_files FOR EACH ROW EXECUTE FUNCTION files_audit();
CREATE TRIGGER group_messages_push AFTER INSERT ON public.group_messages FOR EACH ROW EXECUTE FUNCTION push_on_group_message();
CREATE TRIGGER messages_guard_update BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION messages_guard_update();
CREATE TRIGGER messages_push AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION push_on_message();
CREATE TRIGGER notifications_push AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION push_on_notification();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER profiles_protect BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION protect_profile();
CREATE TRIGGER projects_lock_created_by BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION projects_lock_created_by();
CREATE TRIGGER projects_position_default BEFORE INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION projects_position_default();
CREATE TRIGGER projects_seed_statuses AFTER INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION projects_seed_statuses();
CREATE TRIGGER report_period_moved AFTER UPDATE OF start_date ON public.report_periods FOR EACH ROW EXECUTE FUNCTION report_period_moved();
CREATE TRIGGER sessions_retract AFTER DELETE ON public.attendance_sessions FOR EACH ROW EXECUTE FUNCTION retract_absent_notifs();
CREATE TRIGGER subtasks_sync AFTER INSERT OR DELETE OR UPDATE ON public.task_subtasks FOR EACH ROW EXECUTE FUNCTION subtasks_sync();
CREATE TRIGGER tasks_a_status_sync BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION tasks_status_sync();
CREATE TRIGGER tasks_audit AFTER INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION tasks_audit();
CREATE TRIGGER tasks_guard_archive BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION tasks_guard_archive();
CREATE TRIGGER tasks_mentions_notify AFTER INSERT OR UPDATE OF mentions ON public.tasks FOR EACH ROW EXECUTE FUNCTION notify_task_mentions();
CREATE TRIGGER tasks_touch BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION tasks_touch();
CREATE TRIGGER weekly_touch BEFORE UPDATE ON public.weekly_updates FOR EACH ROW EXECUTE FUNCTION weekly_touch();

-- ---------------------------------------------------------------------
-- 6) Row Level Security
-- ---------------------------------------------------------------------
alter table attendance enable row level security;
alter table attendance_sessions enable row level security;
alter table attendance_takers enable row level security;
alter table chat_group_members enable row level security;
alter table chat_groups enable row level security;
alter table group_messages enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;
alter table points_awards enable row level security;
alter table profiles enable row level security;
alter table projects enable row level security;
alter table push_subscriptions enable row level security;
alter table report_periods enable row level security;
alter table standup_settings enable row level security;
alter table task_activity enable row level security;
alter table task_assignees enable row level security;
alter table task_comments enable row level security;
alter table task_delete_requests enable row level security;
alter table task_files enable row level security;
alter table task_links enable row level security;
alter table task_statuses enable row level security;
alter table task_subtasks enable row level security;
alter table tasks enable row level security;
alter table weekly_updates enable row level security;
create policy "activity read" on public.task_activity for select to authenticated using (can_see_task(task_id));
create policy "assignees delete" on public.task_assignees for delete to authenticated using (can_work_task(task_id));
create policy "assignees insert" on public.task_assignees for insert to authenticated with check (can_work_task(task_id));
create policy "assignees read" on public.task_assignees for select to authenticated using (can_see_task(task_id));
create policy "attendance read" on public.attendance for select to authenticated using (true);
create policy "avatars delete" on storage.objects for delete to authenticated using (((bucket_id = 'avatars'::text) AND can_edit_profile(((storage.foldername(name))[1])::uuid)));
create policy "avatars update" on storage.objects for update to authenticated using (((bucket_id = 'avatars'::text) AND can_edit_profile(((storage.foldername(name))[1])::uuid)));
create policy "avatars upload" on storage.objects for insert to authenticated with check (((bucket_id = 'avatars'::text) AND can_edit_profile(((storage.foldername(name))[1])::uuid)));
create policy "awards admin add" on public.points_awards for insert to authenticated with check ((is_admin() AND (given_by = auth.uid())));
create policy "awards admin delete" on public.points_awards for delete to authenticated using (is_admin());
create policy "awards read" on public.points_awards for select to authenticated using (true);
create policy "comments delete" on public.task_comments for delete to authenticated using (((user_id = auth.uid()) OR is_admin()));
create policy "comments insert" on public.task_comments for insert to authenticated with check (((user_id = auth.uid()) AND can_engage_task(task_id)));
create policy "comments read" on public.task_comments for select to authenticated using (can_see_task(task_id));
create policy "delreq read" on public.task_delete_requests for select to authenticated using (can_see_task(task_id));
create policy "files delete" on public.task_files for delete to authenticated using (((uploaded_by = auth.uid()) OR is_admin()));
create policy "files insert" on public.task_files for insert to authenticated with check (((uploaded_by = auth.uid()) AND can_engage_task(task_id)));
create policy "files read" on public.task_files for select to authenticated using (can_see_task(task_id));
create policy "group members read" on public.chat_group_members for select to authenticated using (is_group_member(group_id));
create policy "group messages read" on public.group_messages for select to authenticated using (is_group_member(group_id));
create policy "group messages send" on public.group_messages for insert to authenticated with check (((sender_id = auth.uid()) AND (deleted_at IS NULL) AND is_group_member(group_id)));
create policy "groups read" on public.chat_groups for select to authenticated using (is_group_member(id));
create policy "links delete" on public.task_links for delete to authenticated using ((can_work_task(task_id) OR can_work_task(other_id)));
create policy "links insert" on public.task_links for insert to authenticated with check ((can_work_task(task_id) AND can_see_task(other_id)));
create policy "links read" on public.task_links for select to authenticated using ((can_see_task(task_id) OR can_see_task(other_id)));
create policy "messages mark read" on public.messages for update to authenticated using ((recipient_id = ( SELECT auth.uid() AS uid))) with check ((recipient_id = ( SELECT auth.uid() AS uid)));
create policy "messages read" on public.messages for select to authenticated using (((sender_id = ( SELECT auth.uid() AS uid)) OR (recipient_id = ( SELECT auth.uid() AS uid))));
create policy "messages send" on public.messages for insert to authenticated with check (((sender_id = ( SELECT auth.uid() AS uid)) AND (read_at IS NULL) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = messages.recipient_id) AND p.active)))));
create policy "notifications delete" on public.notifications for delete to authenticated using ((user_id = auth.uid()));
create policy "notifications read" on public.notifications for select to authenticated using ((user_id = auth.uid()));
create policy "notifications update" on public.notifications for update to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy "profiles read" on public.profiles for select to authenticated using (true);
create policy "profiles update" on public.profiles for update to authenticated using (can_edit_profile(id)) with check (can_edit_profile(id));
create policy "projects delete" on public.projects for delete to authenticated using (((created_by = auth.uid()) OR is_admin() OR is_ancestor(auth.uid(), created_by)));
create policy "projects insert" on public.projects for insert to authenticated with check ((is_manager() AND (created_by = auth.uid())));
create policy "projects read" on public.projects for select to authenticated using (true);
create policy "projects update" on public.projects for update to authenticated using (((created_by = auth.uid()) OR (lead_id = auth.uid()) OR is_admin() OR is_ancestor(auth.uid(), created_by))) with check (true);
create policy "push own add" on public.push_subscriptions for insert to authenticated with check ((user_id = auth.uid()));
create policy "push own delete" on public.push_subscriptions for delete to authenticated using ((user_id = auth.uid()));
create policy "push own read" on public.push_subscriptions for select to authenticated using ((user_id = auth.uid()));
create policy "push own update" on public.push_subscriptions for update to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy "sessions read" on public.attendance_sessions for select to authenticated using (true);
create policy "sessions taker delete" on public.attendance_sessions for delete to authenticated using (is_attendance_taker());
create policy "standup admin" on public.standup_settings for update to authenticated using (is_admin()) with check (is_admin());
create policy "standup read" on public.standup_settings for select to authenticated using (true);
create policy "statuses managers add" on public.task_statuses for insert to authenticated with check (is_manager());
create policy "statuses managers edit" on public.task_statuses for update to authenticated using (is_manager()) with check (is_manager());
create policy "statuses read" on public.task_statuses for select to authenticated using (true);
create policy "subtasks delete" on public.task_subtasks for delete to authenticated using (can_work_task(task_id));
create policy "subtasks insert" on public.task_subtasks for insert to authenticated with check (can_work_task(task_id));
create policy "subtasks read" on public.task_subtasks for select to authenticated using (can_see_task(task_id));
create policy "subtasks update" on public.task_subtasks for update to authenticated using (can_work_task(task_id)) with check (can_work_task(task_id));
create policy "takers admin add" on public.attendance_takers for insert to authenticated with check (is_admin());
create policy "takers admin remove" on public.attendance_takers for delete to authenticated using (is_admin());
create policy "takers read" on public.attendance_takers for select to authenticated using (true);
create policy "task files delete" on storage.objects for delete to authenticated using (((bucket_id = 'task-files'::text) AND ((owner = auth.uid()) OR is_admin())));
create policy "task files read" on storage.objects for select to authenticated using (((bucket_id = 'task-files'::text) AND can_see_task(((storage.foldername(name))[1])::uuid)));
create policy "task files upload" on storage.objects for insert to authenticated with check (((bucket_id = 'task-files'::text) AND can_engage_task(((storage.foldername(name))[1])::uuid)));
create policy "tasks delete" on public.tasks for delete to authenticated using (((created_by = auth.uid()) OR is_admin() OR is_ancestor(auth.uid(), created_by)));
create policy "tasks insert" on public.tasks for insert to authenticated with check ((created_by = auth.uid()));
create policy "tasks read" on public.tasks for select to authenticated using (((created_by = auth.uid()) OR is_ancestor(auth.uid(), created_by) OR can_see_task(id)));
create policy "tasks update" on public.tasks for update to authenticated using (can_work_task(id)) with check (can_work_task(id));
create policy "weekly own add" on public.weekly_updates for insert to authenticated with check ((user_id = auth.uid()));
create policy "weekly own delete" on public.weekly_updates for delete to authenticated using (((user_id = auth.uid()) OR is_admin()));
create policy "weekly own edit" on public.weekly_updates for update to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy "weekly read" on public.weekly_updates for select to authenticated using (true);
create policy rp_del on public.report_periods for delete to authenticated using (is_admin());
create policy rp_ins on public.report_periods for insert to authenticated with check (is_admin());
create policy rp_read on public.report_periods for select to authenticated using (true);
create policy rp_upd on public.report_periods for update to authenticated using (is_admin()) with check (is_admin());
-- ---------------------------------------------------------------------
-- 7) Who may call which function (same as the live project)
-- ---------------------------------------------------------------------
revoke all on function public.push_on_message() from public, anon, authenticated;
grant execute on function public.push_on_message() to public;
grant execute on function public.push_on_message() to anon, authenticated, service_role;
revoke all on function public.push_on_group_message() from public, anon, authenticated;
grant execute on function public.push_on_group_message() to public;
grant execute on function public.push_on_group_message() to anon, authenticated, service_role;
revoke all on function public.notify_task_mentions() from public, anon, authenticated;
grant execute on function public.notify_task_mentions() to public;
grant execute on function public.notify_task_mentions() to anon, authenticated, service_role;
revoke all on function public.projects_position_default() from public, anon, authenticated;
grant execute on function public.projects_position_default() to public;
grant execute on function public.projects_position_default() to anon, authenticated, service_role;
revoke all on function public.tasks_status_sync() from public, anon, authenticated;
grant execute on function public.tasks_status_sync() to public;
grant execute on function public.tasks_status_sync() to anon, authenticated, service_role;
revoke all on function public.push_on_notification() from public, anon, authenticated;
grant execute on function public.push_on_notification() to public;
grant execute on function public.push_on_notification() to anon, authenticated, service_role;
revoke all on function public.add_group_members(uuid,uuid[]) from public, anon, authenticated;
grant execute on function public.add_group_members(uuid,uuid[]) to authenticated, service_role;
revoke all on function public.archive_task(uuid,text,text) from public, anon, authenticated;
grant execute on function public.archive_task(uuid,text,text) to authenticated, service_role;
revoke all on function public.can_delete_task(uuid) from public, anon, authenticated;
grant execute on function public.can_delete_task(uuid) to authenticated, service_role;
revoke all on function public.can_work_task(uuid) from public, anon, authenticated;
grant execute on function public.can_work_task(uuid) to authenticated, service_role;
revoke all on function public.decide_delete_request(uuid,boolean) from public, anon, authenticated;
grant execute on function public.decide_delete_request(uuid,boolean) to authenticated, service_role;
revoke all on function public.is_ancestor(uuid,uuid) from public, anon, authenticated;
grant execute on function public.is_ancestor(uuid,uuid) to authenticated, service_role;
revoke all on function public.points_cycle_start(date) from public, anon, authenticated;
grant execute on function public.points_cycle_start(date) to public;
grant execute on function public.points_cycle_start(date) to anon, authenticated, service_role;
revoke all on function public.cancel_delete_request(uuid) from public, anon, authenticated;
grant execute on function public.cancel_delete_request(uuid) to authenticated, service_role;
revoke all on function public.create_chat_group(text,uuid[],text) from public, anon, authenticated;
grant execute on function public.create_chat_group(text,uuid[],text) to authenticated, service_role;
revoke all on function public.delete_task_status(uuid,uuid) from public, anon, authenticated;
grant execute on function public.delete_task_status(uuid,uuid) to authenticated, service_role;
revoke all on function public.linked_tasks_brief(uuid[]) from public, anon, authenticated;
grant execute on function public.linked_tasks_brief(uuid[]) to authenticated, service_role;
revoke all on function public.set_group_owner(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.set_group_owner(uuid,uuid,boolean) to authenticated, service_role;
revoke all on function public.weekly_task_digest_v2(date,date) from public, anon, authenticated;
grant execute on function public.weekly_task_digest_v2(date,date) to authenticated, service_role;
revoke all on function public.projects_lock_created_by() from public, anon, authenticated;
grant execute on function public.projects_lock_created_by() to public;
grant execute on function public.projects_lock_created_by() to anon, authenticated, service_role;
revoke all on function public.points_summary(date) from public, anon, authenticated;
grant execute on function public.points_summary(date) to public;
grant execute on function public.points_summary(date) to anon, authenticated, service_role;
revoke all on function public.retract_absent_notifs() from public, anon, authenticated;
grant execute on function public.retract_absent_notifs() to public;
grant execute on function public.retract_absent_notifs() to anon, authenticated, service_role;
revoke all on function public.clear_conversation(uuid) from public, anon, authenticated;
grant execute on function public.clear_conversation(uuid) to authenticated, service_role;
revoke all on function public.delete_chat_group(uuid) from public, anon, authenticated;
grant execute on function public.delete_chat_group(uuid) to authenticated, service_role;
revoke all on function public.delete_messages(uuid[],boolean) from public, anon, authenticated;
grant execute on function public.delete_messages(uuid[],boolean) to authenticated, service_role;
revoke all on function public.mark_group_read(uuid,boolean) from public, anon, authenticated;
grant execute on function public.mark_group_read(uuid,boolean) to authenticated, service_role;
revoke all on function public.update_chat_group(uuid,text,text) from public, anon, authenticated;
grant execute on function public.update_chat_group(uuid,text,text) to authenticated, service_role;
revoke all on function public._set_archived(uuid,text) from public, anon, authenticated;
grant execute on function public._set_archived(uuid,text) to service_role;
revoke all on function public.files_audit() from public, anon, authenticated;
grant execute on function public.files_audit() to service_role;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;
revoke all on function public.notify_due_soon() from public, anon, authenticated;
grant execute on function public.notify_due_soon() to service_role;
revoke all on function public.notify(uuid,uuid,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.notify(uuid,uuid,text,jsonb,text) to service_role;
revoke all on function public.protect_profile() from public, anon, authenticated;
grant execute on function public.protect_profile() to service_role;
revoke all on function public.send_push(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.send_push(uuid,text,text,text,text) to service_role;
revoke all on function public.tasks_audit() from public, anon, authenticated;
grant execute on function public.tasks_audit() to service_role;
revoke all on function public.can_engage_task(uuid) from public, anon, authenticated;
grant execute on function public.can_engage_task(uuid) to authenticated, service_role;
revoke all on function public.can_see_task(uuid) from public, anon, authenticated;
grant execute on function public.can_see_task(uuid) to authenticated, service_role;
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated, service_role;
revoke all on function public.is_attendance_taker(uuid) from public, anon, authenticated;
grant execute on function public.is_attendance_taker(uuid) to authenticated, service_role;
revoke all on function public.is_manager() from public, anon, authenticated;
grant execute on function public.is_manager() to authenticated, service_role;
revoke all on function public.remove_group_member(uuid,uuid) from public, anon, authenticated;
grant execute on function public.remove_group_member(uuid,uuid) to authenticated, service_role;
revoke all on function public.restore_task(uuid) from public, anon, authenticated;
grant execute on function public.restore_task(uuid) to authenticated, service_role;
revoke all on function public.save_attendance(date,jsonb) from public, anon, authenticated;
grant execute on function public.save_attendance(date,jsonb) to authenticated, service_role;
revoke all on function public.team_scores(integer) from public, anon, authenticated;
grant execute on function public.team_scores(integer) to authenticated, service_role;
revoke all on function public.seed_project_statuses(uuid) from public, anon, authenticated;
grant execute on function public.seed_project_statuses(uuid) to public;
grant execute on function public.seed_project_statuses(uuid) to anon, authenticated, service_role;
revoke all on function public.tasks_guard_archive() from public, anon, authenticated;
grant execute on function public.tasks_guard_archive() to public;
grant execute on function public.tasks_guard_archive() to anon, authenticated, service_role;
revoke all on function public.notify_absent() from public, anon, authenticated;
grant execute on function public.notify_absent() to public;
grant execute on function public.notify_absent() to anon, authenticated, service_role;
revoke all on function public.projects_seed_statuses() from public, anon, authenticated;
grant execute on function public.projects_seed_statuses() to public;
grant execute on function public.projects_seed_statuses() to anon, authenticated, service_role;
revoke all on function public.report_period_moved() from public, anon, authenticated;
grant execute on function public.report_period_moved() to public;
grant execute on function public.report_period_moved() to anon, authenticated, service_role;
revoke all on function public.notify_thanks() from public, anon, authenticated;
grant execute on function public.notify_thanks() to public;
grant execute on function public.notify_thanks() to anon, authenticated, service_role;
revoke all on function public.tasks_touch() from public, anon, authenticated;
grant execute on function public.tasks_touch() to public;
grant execute on function public.tasks_touch() to anon, authenticated, service_role;
revoke all on function public.weekly_touch() from public, anon, authenticated;
grant execute on function public.weekly_touch() to public;
grant execute on function public.weekly_touch() to anon, authenticated, service_role;
revoke all on function public.delete_group_message(uuid) from public, anon, authenticated;
grant execute on function public.delete_group_message(uuid) to authenticated, service_role;
revoke all on function public.is_group_owner(uuid,uuid) from public, anon, authenticated;
grant execute on function public.is_group_owner(uuid,uuid) to authenticated, service_role;
revoke all on function public.assignees_audit() from public, anon, authenticated;
grant execute on function public.assignees_audit() to service_role;
revoke all on function public.comments_notify() from public, anon, authenticated;
grant execute on function public.comments_notify() to service_role;
revoke all on function public.log_activity(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.log_activity(uuid,text,jsonb) to service_role;
revoke all on function public.push_config() from public, anon, authenticated;
grant execute on function public.push_config() to service_role;
revoke all on function public.subtasks_sync() from public, anon, authenticated;
grant execute on function public.subtasks_sync() to service_role;
revoke all on function public.can_edit_profile(uuid) from public, anon, authenticated;
grant execute on function public.can_edit_profile(uuid) to authenticated, service_role;
revoke all on function public.is_group_member(uuid,uuid) from public, anon, authenticated;
grant execute on function public.is_group_member(uuid,uuid) to authenticated, service_role;
revoke all on function public.reorder_projects(uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_projects(uuid[]) to authenticated, service_role;
revoke all on function public.weekly_task_digest(date,date) from public, anon, authenticated;
grant execute on function public.weekly_task_digest(date,date) to authenticated, service_role;
revoke all on function public.messages_guard_update() from public, anon, authenticated;
grant execute on function public.messages_guard_update() to public;
grant execute on function public.messages_guard_update() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 8) Realtime, storage buckets, scheduled job, default settings row
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table
  public.profiles, public.tasks, public.task_assignees, public.projects, public.task_comments, public.task_subtasks,
  public.task_activity, public.notifications, public.messages, public.standup_settings, public.attendance_takers,
  public.attendance_sessions, public.points_awards, public.task_statuses, public.chat_groups, public.chat_group_members,
  public.group_messages, public.weekly_updates, public.report_periods, public.task_links, public.task_delete_requests;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',    'avatars',    true,  2097152,  array['image/jpeg', 'image/png', 'image/webp']),
  ('task-files', 'task-files', false, 52428800, null)
on conflict (id) do nothing;

-- every day 05:00 UTC (07:00 Cairo): notify assignees of tasks due tomorrow
select cron.schedule('due-soon-notifications', '0 5 * * *', $$ select public.notify_due_soon(); $$);

insert into public.standup_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 9) Push notification settings (server-only).
--    Replace the placeholders BEFORE running, or update them later with:
--      update private.app_config set value = '...' where key = '...';
--    Generate a VAPID key pair with:  npx web-push generate-vapid-keys
--    Put the PUBLIC key in js/config.js (VAPID_PUBLIC) too.
-- ---------------------------------------------------------------------
insert into private.app_config (key, value) values
  ('project_url',   'https://YOUR-PROJECT-REF.supabase.co'),
  ('push_secret',   encode(extensions.gen_random_bytes(24), 'hex')),
  ('vapid_public',  'YOUR_VAPID_PUBLIC_KEY'),
  ('vapid_private', 'YOUR_VAPID_PRIVATE_KEY'),
  ('vapid_subject', 'mailto:you@example.com')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 10) v24 — images in chat (up to 1.5 MB, private bucket chat-files)
-- ---------------------------------------------------------------------
alter table public.messages       add column if not exists attachment_path text, add column if not exists attachment_meta jsonb;
alter table public.group_messages add column if not exists attachment_path text, add column if not exists attachment_meta jsonb;

-- a message is text, an image, or both; a message deleted for everyone keeps neither
alter table public.messages drop constraint messages_body_check;
alter table public.messages add constraint messages_body_check check (
  (deleted_at is null and char_length(body) <= 4000 and (char_length(btrim(body)) >= 1 or attachment_path is not null))
  or (deleted_at is not null and body = '' and attachment_path is null));
alter table public.group_messages drop constraint group_messages_check;
alter table public.group_messages add constraint group_messages_check check (
  (deleted_at is null and char_length(body) <= 4000 and (char_length(btrim(body)) >= 1 or attachment_path is not null))
  or (deleted_at is not null and body = '' and attachment_path is null));

-- senders may only attach files from their own folder
alter policy "messages send" on public.messages with check (
  sender_id = (select auth.uid()) and read_at is null
  and exists (select 1 from public.profiles p where p.id = messages.recipient_id and p.active)
  and (attachment_path is null or split_part(attachment_path, '/', 1) = (select auth.uid())::text));
alter policy "group messages send" on public.group_messages with check (
  sender_id = auth.uid() and deleted_at is null and public.is_group_member(group_id)
  and (attachment_path is null or split_part(attachment_path, '/', 1) = auth.uid()::text));

-- recipients can't change the attachment either
create or replace function public.messages_guard_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and coalesce(current_setting('app.msg_rpc', true), '') <> '1' then
    new.id := old.id; new.sender_id := old.sender_id; new.recipient_id := old.recipient_id;
    new.body := old.body; new.created_at := old.created_at;
    new.deleted_for_sender := old.deleted_for_sender; new.deleted_for_recipient := old.deleted_for_recipient;
    new.deleted_at := old.deleted_at;
    new.attachment_path := old.attachment_path; new.attachment_meta := old.attachment_meta;
  end if;
  return new;
end $$;

-- "delete for everyone" also drops the image
create or replace function public.delete_messages(p_ids uuid[], p_for_everyone boolean default false)
returns integer language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n integer := 0; k integer;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  perform set_config('app.msg_rpc', '1', true);
  if p_for_everyone then
    update messages set body = '', deleted_at = now(), attachment_path = null, attachment_meta = null
     where id = any(p_ids) and sender_id = uid and deleted_at is null;
    get diagnostics n = row_count;
  else
    update messages set deleted_for_sender = true where id = any(p_ids) and sender_id = uid;
    get diagnostics k = row_count; n := n + k;
    update messages set deleted_for_recipient = true where id = any(p_ids) and recipient_id = uid;
    get diagnostics k = row_count; n := n + k;
  end if;
  perform set_config('app.msg_rpc', '', true);
  return n;
end $$;
create or replace function public.delete_group_message(p_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update group_messages set body = '', deleted_at = now(), attachment_path = null, attachment_meta = null
   where id = p_id and sender_id = auth.uid() and deleted_at is null;
  get diagnostics n = row_count; return n;
end $$;

-- push text for image messages
create or replace function public.push_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare who text; txt text := case when btrim(new.body) = '' then '📷 صورة' else new.body end;
begin
  select full_name into who from profiles where id = new.sender_id;
  perform public.send_push(new.recipient_id, coalesce(who, 'رسالة جديدة'),
    case when char_length(txt) > 140 then left(txt, 140) || '…' else txt end,
    '/#/chat?with=' || new.sender_id, 'chat-' || new.sender_id);
  return new;
end $$;
create or replace function public.push_on_group_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare g text; who text; r record; txt text := case when btrim(new.body) = '' then '📷 صورة' else new.body end;
begin
  select name into g from chat_groups where id = new.group_id;
  select full_name into who from profiles where id = new.sender_id;
  for r in select user_id from chat_group_members where group_id = new.group_id and user_id <> new.sender_id loop
    perform public.send_push(r.user_id, coalesce(g, 'Group'),
      coalesce(who, '') || ': ' || case when char_length(txt) > 120 then left(txt, 120) || '…' else txt end,
      '/#/chat?group=' || new.group_id, 'group-' || new.group_id);
  end loop;
  return new;
end $$;

-- storage: chat-files/<sender id>/<file>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-files', 'chat-files', false, 1572864, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = false;

create or replace function public.can_read_chat_file(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    split_part(p_name, '/', 1) = auth.uid()::text
    or exists (select 1 from public.messages m where m.attachment_path = p_name and auth.uid() in (m.sender_id, m.recipient_id))
    or exists (select 1 from public.group_messages g where g.attachment_path = p_name and public.is_group_member(g.group_id)));
$$;
revoke all on function public.can_read_chat_file(text) from public, anon;
grant execute on function public.can_read_chat_file(text) to authenticated;

create policy "chat files upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "chat files read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-files' and public.can_read_chat_file(name));
create policy "chat files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-files' and owner = auth.uid());
