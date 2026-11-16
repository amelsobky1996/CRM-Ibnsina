-- v27: group event lines (left / removed / added / admin changes), any member can take over an admin-less group,
--      and people who leave keep the group read-only (history up to the moment they left).
alter table public.chat_group_members add column if not exists left_at timestamptz;

-- active member (can write) vs. anyone who was ever in it (can read what was sent while they were in)
create or replace function public.is_group_member(p_group uuid, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from chat_group_members where group_id = p_group and user_id = p_user and left_at is null);
$$;
create or replace function public.is_group_owner(p_group uuid, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from chat_group_members where group_id = p_group and user_id = p_user and role = 'owner' and left_at is null);
$$;
create or replace function public.can_read_group(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from chat_group_members where group_id = p_group and user_id = auth.uid());
$$;
create or replace function public.can_read_group_msg(p_group uuid, p_at timestamptz)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from chat_group_members where group_id = p_group and user_id = auth.uid() and (left_at is null or p_at <= left_at));
$$;
revoke all on function public.can_read_group(uuid) from public, anon;
revoke all on function public.can_read_group_msg(uuid, timestamptz) from public, anon;
grant execute on function public.can_read_group(uuid) to authenticated;
grant execute on function public.can_read_group_msg(uuid, timestamptz) to authenticated;
alter policy "groups read" on public.chat_groups using (public.can_read_group(id));
alter policy "group members read" on public.chat_group_members using (public.can_read_group(group_id));
alter policy "group messages read" on public.group_messages using (public.can_read_group_msg(group_id, created_at));

create or replace function public.can_read_chat_file(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    split_part(p_name, '/', 1) = auth.uid()::text
    or exists (select 1 from public.messages m where m.attachment_path = p_name and auth.uid() in (m.sender_id, m.recipient_id))
    or exists (select 1 from public.group_messages g where g.attachment_path = p_name and public.can_read_group_msg(g.group_id, g.created_at)));
$$;

-- someone who left can take the group off their list for good
create or replace function public.forget_group(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from chat_group_members where group_id = p_group and user_id = auth.uid() and left_at is not null;
  if not found then raise exception 'not allowed'; end if;
end $$;
revoke all on function public.forget_group(uuid) from public, anon;
grant execute on function public.forget_group(uuid) to authenticated;
alter table public.group_messages add column if not exists kind text not null default 'text';
alter table public.group_messages add column if not exists event jsonb;
alter table public.group_messages drop constraint if exists group_messages_kind_check;
alter table public.group_messages add constraint group_messages_kind_check check (kind in ('text', 'system'));
alter table public.group_messages drop constraint group_messages_check;
alter table public.group_messages add constraint group_messages_check check (
  kind = 'system'
  or (deleted_at is null and char_length(body) <= 4000 and (char_length(btrim(body)) >= 1 or attachment_path is not null))
  or (deleted_at is not null and body = '' and attachment_path is null));
-- members can only send normal messages
alter policy "group messages send" on public.group_messages with check (
  sender_id = auth.uid() and deleted_at is null and kind = 'text' and event is null and public.is_group_member(group_id)
  and (attachment_path is null or split_part(attachment_path, '/', 1) = auth.uid()::text));

create or replace function public._group_event(p_group uuid, p_actor uuid, p_event jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.group_messages (group_id, sender_id, body, kind, event) values (p_group, p_actor, '', 'system', p_event);
$$;
revoke all on function public._group_event(uuid, uuid, jsonb) from public, anon, authenticated;

-- leaving / removing: the row stays (left_at) so the history stays readable; no automatic hand-over; an event line is posted
create or replace function public.remove_group_member(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); was_owner boolean;
begin
  if p_user <> uid and not public.is_group_owner(p_group) then raise exception 'not allowed' using errcode = '42501'; end if;
  select role = 'owner' into was_owner from chat_group_members where group_id = p_group and user_id = p_user and left_at is null;
  if not found then return; end if;
  -- the event goes in first so the person who leaves still sees it as the last line
  if exists (select 1 from chat_group_members where group_id = p_group and user_id <> p_user and left_at is null) then
    perform public._group_event(p_group, p_user, jsonb_build_object(
      'type', case when p_user = uid then 'left' else 'removed' end, 'by', uid, 'was_owner', was_owner,
      'no_owner', not exists (select 1 from chat_group_members where group_id = p_group and role = 'owner' and left_at is null and user_id <> p_user)));
  end if;
  update chat_group_members set left_at = now(), role = 'member' where group_id = p_group and user_id = p_user;
  -- nobody active left: the group is closed (rows kept so former members can still read it)
end $$;

create or replace function public.add_group_members(p_group uuid, p_members uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare added uuid[];
begin
  if not public.is_group_owner(p_group) then raise exception 'not allowed' using errcode = '42501'; end if;
  with ins as (
    insert into chat_group_members (group_id, user_id)
    select p_group, m from unnest(p_members) m where exists (select 1 from profiles p where p.id = m and p.active)
    on conflict (group_id, user_id) do update set left_at = null, role = 'member', joined_at = now(), last_read_at = now()
      where chat_group_members.left_at is not null
    returning user_id)
  select coalesce(array_agg(user_id), '{}') into added from ins;
  if cardinality(added) > 0 then
    perform public._group_event(p_group, auth.uid(), jsonb_build_object('type', 'added', 'users', to_jsonb(added)));
  end if;
  return cardinality(added);
end $$;

create or replace function public.set_group_owner(p_group uuid, p_user uuid, p_owner boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_owner(p_group) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not p_owner and not exists (select 1 from chat_group_members where group_id = p_group and role = 'owner' and left_at is null and user_id <> p_user) then
    raise exception 'لازم يفضل مشرف واحد على الأقل';
  end if;
  update chat_group_members set role = case when p_owner then 'owner' else 'member' end where group_id = p_group and user_id = p_user and left_at is null;
  if found then
    perform public._group_event(p_group, auth.uid(), jsonb_build_object('type', case when p_owner then 'made_admin' else 'removed_admin' end, 'user', p_user));
  end if;
end $$;

-- a group with no admin: the first member who asks becomes admin
create or replace function public.claim_group_owner(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_member(p_group) then raise exception 'not allowed' using errcode = '42501'; end if;
  if exists (select 1 from chat_group_members where group_id = p_group and role = 'owner' and left_at is null) then
    raise exception 'has_owner' using hint = 'المجموعة ليها مشرف خلاص';
  end if;
  update chat_group_members set role = 'owner' where group_id = p_group and user_id = auth.uid();
  perform public._group_event(p_group, auth.uid(), jsonb_build_object('type', 'claimed'));
end $$;
revoke all on function public.claim_group_owner(uuid) from public, anon;
grant execute on function public.claim_group_owner(uuid) to authenticated;

-- event lines don't send phone notifications
create or replace function public.push_on_group_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare g text; who text; r record; txt text := case when btrim(new.body) <> '' then new.body
                                   when new.attachment_meta->>'kind' = 'audio' then '🎤 رسالة صوتية' else '📷 صورة' end;
begin
  if new.kind = 'system' then return new; end if;
  select name into g from chat_groups where id = new.group_id;
  select full_name into who from profiles where id = new.sender_id;
  for r in select user_id from chat_group_members where group_id = new.group_id and user_id <> new.sender_id and left_at is null loop
    perform public.send_push(r.user_id, coalesce(g, 'Group'),
      coalesce(who, '') || ': ' || case when char_length(txt) > 120 then left(txt, 120) || '…' else txt end,
      '/#/chat?group=' || new.group_id, 'group-' || new.group_id);
  end loop;
  return new;
end $$;
