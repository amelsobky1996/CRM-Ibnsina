-- v25: voice messages (audio in chat-files, max 1.5 MB) + editing a message while it is still unread.
alter table public.messages       add column if not exists edited_at timestamptz;
alter table public.group_messages add column if not exists edited_at timestamptz;

update storage.buckets set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a', 'audio/wav']
 where id = 'chat-files';

create or replace function public.messages_guard_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and coalesce(current_setting('app.msg_rpc', true), '') <> '1' then
    new.id := old.id; new.sender_id := old.sender_id; new.recipient_id := old.recipient_id;
    new.body := old.body; new.created_at := old.created_at;
    new.deleted_for_sender := old.deleted_for_sender; new.deleted_for_recipient := old.deleted_for_recipient;
    new.deleted_at := old.deleted_at;
    new.attachment_path := old.attachment_path; new.attachment_meta := old.attachment_meta;
    new.edited_at := old.edited_at;
  end if;
  return new;
end $$;

-- edit my direct message, only while the other person hasn't read it
create or replace function public.edit_message(p_id uuid, p_body text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare m public.messages; b text := btrim(coalesce(p_body, '')); t timestamptz := now();
begin
  select * into m from public.messages where id = p_id;
  if not found or m.sender_id is distinct from auth.uid() or m.deleted_at is not null then raise exception 'not allowed'; end if;
  if m.read_at is not null then raise exception 'already_read' using hint = 'الرسالة اتقرت خلاص، مينفعش تتعدل'; end if;
  if char_length(b) > 4000 or (b = '' and m.attachment_path is null) then raise exception 'invalid body'; end if;
  perform set_config('app.msg_rpc', '1', true);
  update public.messages set body = b, edited_at = t where id = p_id;
  perform set_config('app.msg_rpc', '', true);
  return t;
end $$;
revoke all on function public.edit_message(uuid, text) from public, anon;
grant execute on function public.edit_message(uuid, text) to authenticated;

-- edit my group message, only while no other member has read it
create or replace function public.edit_group_message(p_id uuid, p_body text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare m public.group_messages; b text := btrim(coalesce(p_body, '')); t timestamptz := now();
begin
  select * into m from public.group_messages where id = p_id;
  if not found or m.sender_id is distinct from auth.uid() or m.deleted_at is not null then raise exception 'not allowed'; end if;
  if exists (select 1 from public.chat_group_members cm where cm.group_id = m.group_id and cm.user_id <> m.sender_id and cm.last_read_at >= m.created_at) then
    raise exception 'already_read' using hint = 'حد في المجموعة قرا الرسالة، مينفعش تتعدل';
  end if;
  if char_length(b) > 4000 or (b = '' and m.attachment_path is null) then raise exception 'invalid body'; end if;
  update public.group_messages set body = b, edited_at = t where id = p_id;
  return t;
end $$;
revoke all on function public.edit_group_message(uuid, text) from public, anon;
grant execute on function public.edit_group_message(uuid, text) to authenticated;

-- push text for voice notes
create or replace function public.push_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare who text; txt text := case when btrim(new.body) <> '' then new.body
                                   when new.attachment_meta->>'kind' = 'audio' then '🎤 رسالة صوتية' else '📷 صورة' end;
begin
  select full_name into who from profiles where id = new.sender_id;
  perform public.send_push(new.recipient_id, coalesce(who, 'رسالة جديدة'),
    case when char_length(txt) > 140 then left(txt, 140) || '…' else txt end,
    '/#/chat?with=' || new.sender_id, 'chat-' || new.sender_id);
  return new;
end $$;
create or replace function public.push_on_group_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare g text; who text; r record; txt text := case when btrim(new.body) <> '' then new.body
                                   when new.attachment_meta->>'kind' = 'audio' then '🎤 رسالة صوتية' else '📷 صورة' end;
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
