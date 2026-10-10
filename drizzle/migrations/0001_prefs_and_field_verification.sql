
create table public.notification_preferences (
  user_id uuid not null,
  kind text not null,
  in_app boolean not null default true,
  email boolean not null default false,
  primary key (user_id, kind)
);
grant select, insert, update, delete on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;
alter table public.notification_preferences enable row level security;
create policy "prefs own" on public.notification_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.respect_in_app_pref()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.notification_preferences p where p.user_id = new.user_id and p.kind = new.kind and not p.in_app) then
    return null;
  end if;
  if exists (select 1 from public.profiles p where p.id = new.user_id and not p.notify_enabled) and new.kind <> 'ticket' then
    return null;
  end if;
  return new;
end $$;
create trigger notifications_pref before insert on public.notifications for each row execute function public.respect_in_app_pref();

alter table public.creators add column verified_fields text[] not null default '{}';

create or replace function public.set_verified_fields(_creator_id uuid, _fields text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Admins only'; end if;
  update public.creators set verified_fields = _fields where id = _creator_id;
end $$;
revoke execute on function public.set_verified_fields(uuid, text[]) from anon;
