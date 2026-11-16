-- v26: group photo. Stored in the public avatars bucket under <group id>/..., set only by the group's owners.
alter table public.chat_groups add column if not exists avatar_url text;

create or replace function public.set_group_avatar(p_group uuid, p_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_owner(p_group) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.chat_groups set avatar_url = nullif(btrim(coalesce(p_url, '')), '') where id = p_group;
end $$;
revoke all on function public.set_group_avatar(uuid, text) from public, anon;
grant execute on function public.set_group_avatar(uuid, text) to authenticated;

-- folder name = group id (a uuid, so the existing avatar policies keep working)
create or replace function public.can_edit_group_photo(p_folder text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_folder ~ '^[0-9a-f-]{36}$' and public.is_group_owner(p_folder::uuid);
$$;
revoke all on function public.can_edit_group_photo(text) from public, anon;
grant execute on function public.can_edit_group_photo(text) to authenticated;

create policy "group photo upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.can_edit_group_photo((storage.foldername(name))[1]));
create policy "group photo update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and public.can_edit_group_photo((storage.foldername(name))[1]));
create policy "group photo delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and public.can_edit_group_photo((storage.foldername(name))[1]));
