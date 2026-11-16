-- v24: images in chat (direct + group), max 1.5 MB, private bucket readable only by the conversation.
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
