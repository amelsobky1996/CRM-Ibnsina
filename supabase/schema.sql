-- =====================================================================
-- Ibnsina Digital CRM — Supabase schema
-- شغّل الملف ده مرة واحدة من SQL Editor في Supabase
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  full_name   text not null,
  job_title   text,
  avatar_url  text,
  manager_id  uuid references public.profiles(id) on delete set null,
  is_admin    boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists profiles_manager_idx on public.profiles(manager_id);

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 1 and 200),
  description  text,
  status       text not null default 'todo'
               check (status in ('todo','in_progress','review','blocked','done')),
  priority     text not null default 'medium'
               check (priority in ('low','medium','high')),
  progress     int  not null default 0 check (progress between 0 and 100),
  deadline     date,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists tasks_created_by_idx on public.tasks(created_by);

create table if not exists public.task_assignees (
  task_id     uuid not null references public.tasks(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null default auth.uid(),
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index if not exists task_assignees_user_idx on public.task_assignees(user_id);

create table if not exists public.task_files (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  uploaded_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  file_name    text not null,
  storage_path text not null unique,
  size_bytes   bigint,
  mime_type    text,
  created_at   timestamptz not null default now()
);
create index if not exists task_files_task_idx on public.task_files(task_id);

-- ---------------------------------------------------------------------
-- Helper functions (security definer so RLS doesn't recurse)
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- true لو p_manager فوق p_emp في الهيكل (مدير مباشر أو غير مباشر)
create or replace function public.is_ancestor(p_manager uuid, p_emp uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with recursive chain(mid) as (
    select manager_id from public.profiles where id = p_emp
    union
    select p.manager_id from public.profiles p join chain c on p.id = c.mid
    where c.mid is not null
  )
  select p_manager is not null and exists (select 1 from chain where mid = p_manager);
$$;

-- المهمة ظاهرة لـ: اللي عملها، المسند لهم، وكل المديرين فوقهم، والأدمن
create or replace function public.can_see_task(p_task uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
    or exists (select 1 from public.tasks t
               where t.id = p_task
                 and (t.created_by = auth.uid() or public.is_ancestor(auth.uid(), t.created_by)))
    or exists (select 1 from public.task_assignees a
               where a.task_id = p_task
                 and (a.user_id = auth.uid() or public.is_ancestor(auth.uid(), a.user_id)));
$$;

create or replace function public.can_edit_profile(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user = auth.uid() or public.is_admin() or public.is_ancestor(auth.uid(), p_user);
$$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
-- إنشاء profile تلقائي لما يتعمل user (أول مستخدم بيبقى Admin)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
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
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- حماية الحقول الحساسة في البروفايل + منع الحلقات في الهيكل
create or replace function public.protect_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_service boolean := auth.uid() is null;  -- service role (Edge Function)
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
end $$;

drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect
  before update on public.profiles
  for each row execute function public.protect_profile();

-- updated_at / completed_at
create or replace function public.tasks_touch()
returns trigger language plpgsql as $$
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
end $$;

drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch
  before insert or update on public.tasks
  for each row execute function public.tasks_touch();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.tasks          enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_files     enable row level security;

drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles update" on public.profiles;
create policy "profiles read"   on public.profiles for select to authenticated using (true);
create policy "profiles update" on public.profiles for update to authenticated
  using (public.can_edit_profile(id)) with check (public.can_edit_profile(id));

drop policy if exists "tasks read"   on public.tasks;
drop policy if exists "tasks insert" on public.tasks;
drop policy if exists "tasks update" on public.tasks;
drop policy if exists "tasks delete" on public.tasks;
create policy "tasks read"   on public.tasks for select to authenticated using (public.can_see_task(id));
create policy "tasks insert" on public.tasks for insert to authenticated with check (created_by = auth.uid());
create policy "tasks update" on public.tasks for update to authenticated
  using (public.can_see_task(id)) with check (public.can_see_task(id));
create policy "tasks delete" on public.tasks for delete to authenticated
  using (created_by = auth.uid() or public.is_admin() or public.is_ancestor(auth.uid(), created_by));

drop policy if exists "assignees read"   on public.task_assignees;
drop policy if exists "assignees insert" on public.task_assignees;
drop policy if exists "assignees delete" on public.task_assignees;
create policy "assignees read"   on public.task_assignees for select to authenticated using (public.can_see_task(task_id));
create policy "assignees insert" on public.task_assignees for insert to authenticated with check (public.can_see_task(task_id));
create policy "assignees delete" on public.task_assignees for delete to authenticated using (public.can_see_task(task_id));

drop policy if exists "files read"   on public.task_files;
drop policy if exists "files insert" on public.task_files;
drop policy if exists "files delete" on public.task_files;
create policy "files read"   on public.task_files for select to authenticated using (public.can_see_task(task_id));
create policy "files insert" on public.task_files for insert to authenticated
  with check (uploaded_by = auth.uid() and public.can_see_task(task_id));
create policy "files delete" on public.task_files for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('task-files', 'task-files', false, 26214400)          -- 25 MB
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "task files read"   on storage.objects;
drop policy if exists "task files upload" on storage.objects;
drop policy if exists "task files delete" on storage.objects;
create policy "task files read" on storage.objects for select to authenticated
  using (bucket_id = 'task-files' and public.can_see_task(((storage.foldername(name))[1])::uuid));
create policy "task files upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'task-files' and public.can_see_task(((storage.foldername(name))[1])::uuid));
create policy "task files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'task-files' and (owner = auth.uid() or public.is_admin()));

drop policy if exists "avatars upload" on storage.objects;
drop policy if exists "avatars update" on storage.objects;
drop policy if exists "avatars delete" on storage.objects;
create policy "avatars upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.can_edit_profile(((storage.foldername(name))[1])::uuid));
create policy "avatars update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and public.can_edit_profile(((storage.foldername(name))[1])::uuid));
create policy "avatars delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and public.can_edit_profile(((storage.foldername(name))[1])::uuid));

-- ---------------------------------------------------------------------
-- Realtime (تحديث لحظي للمهام)
-- ---------------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.tasks;          exception when others then null; end;
  begin alter publication supabase_realtime add table public.task_assignees; exception when others then null; end;
  begin alter publication supabase_realtime add table public.profiles;       exception when others then null; end;
end $$;

-- صلاحيات الدوال (من تقرير الأمان)
revoke execute on function public.is_admin(), public.is_ancestor(uuid,uuid), public.can_see_task(uuid), public.can_edit_profile(uuid), public.handle_new_user(), public.protect_profile() from public, anon;
revoke execute on function public.handle_new_user(), public.protect_profile() from authenticated;
grant execute on function public.is_admin(), public.is_ancestor(uuid,uuid), public.can_see_task(uuid), public.can_edit_profile(uuid) to authenticated, service_role;

-- =====================================================================
-- v2: المشاريع + إصلاح إضافة المهام للموظفين + حد 50 ميجا للملف
-- =====================================================================
drop policy if exists "tasks read" on public.tasks;
create policy "tasks read" on public.tasks for select to authenticated
  using (created_by = auth.uid() or public.is_ancestor(auth.uid(), created_by) or public.can_see_task(id));

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  description text,
  color       text not null default '#0B6FC4' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  status      text not null default 'active' check (status in ('active','archived')),
  lead_id     uuid references public.profiles(id) on delete set null,
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
alter table public.tasks add column if not exists project_id uuid references public.projects(id) on delete set null;
create index if not exists tasks_project_idx on public.tasks(project_id);

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.profiles where manager_id = auth.uid());
$$;
revoke execute on function public.is_manager() from public, anon;
grant execute on function public.is_manager() to authenticated, service_role;

alter table public.projects enable row level security;
create policy "projects read"   on public.projects for select to authenticated using (true);
create policy "projects insert" on public.projects for insert to authenticated
  with check (public.is_manager() and created_by = auth.uid());
create policy "projects update" on public.projects for update to authenticated
  using (created_by = auth.uid() or lead_id = auth.uid() or public.is_admin() or public.is_ancestor(auth.uid(), created_by))
  with check (created_by = auth.uid() or lead_id = auth.uid() or public.is_admin() or public.is_ancestor(auth.uid(), created_by));
create policy "projects delete" on public.projects for delete to authenticated
  using (created_by = auth.uid() or public.is_admin() or public.is_ancestor(auth.uid(), created_by));
do $$ begin
  begin alter publication supabase_realtime add table public.projects; exception when others then null; end;
end $$;

update storage.buckets set file_size_limit = 52428800 where id = 'task-files';

-- v3: النوع (gender)
alter table public.profiles add column if not exists gender text check (gender in ('male','female'));
