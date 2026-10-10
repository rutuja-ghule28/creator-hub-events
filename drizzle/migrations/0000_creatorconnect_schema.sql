
create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('attendee','creator','admin');
create type public.event_status as enum ('pending','live','rejected','removed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  city text default 'Pune',
  avatar_url text,
  notify_enabled boolean not null default true,
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert on public.profiles to authenticated;
grant update (full_name, phone, city, avatar_url, notify_enabled) on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  display_name text not null,
  category text not null default 'Artist',
  bio text not null default '',
  avatar_url text,
  location text not null default 'Pune',
  audience_size integer not null default 0 check (audience_size >= 0),
  portfolio_links text[] not null default '{}',
  contact_email text,
  contact_phone text,
  verified boolean not null default false,
  verification_status text not null default 'pending',
  verification_docs text[] not null default '{}',
  page_views integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert on public.creators to authenticated;
grant update (display_name, category, bio, avatar_url, location, audience_size, portfolio_links, contact_email, contact_phone, verification_docs) on public.creators to authenticated;
grant all on public.creators to service_role;
alter table public.creators enable row level security;
create policy "creators readable" on public.creators for select to authenticated using (true);
create policy "request creator" on public.creators for insert to authenticated with check (user_id = auth.uid() and verified = false and verification_status = 'pending');
create policy "edit own creator" on public.creators for update to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.owns_creator(_creator_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.creators where id = _creator_id and user_id = auth.uid())
$$;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  title text not null,
  type text not null default 'Meetup',
  description text not null default '',
  starts_at timestamptz not null,
  venue text not null,
  area text not null default 'Pune',
  capacity integer not null check (capacity > 0),
  seats_taken integer not null default 0,
  status public.event_status not null default 'pending',
  cover_url text,
  promotion_brief text,
  target_niche text,
  application_deadline timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "events read" on public.events for select to authenticated using (status = 'live' or public.owns_creator(creator_id) or public.has_role(auth.uid(),'admin'));
create policy "events insert" on public.events for insert to authenticated with check (public.owns_creator(creator_id) and public.has_role(auth.uid(),'creator'));
create policy "events update" on public.events for update to authenticated using (public.owns_creator(creator_id) or public.has_role(auth.uid(),'admin'));
create policy "events delete" on public.events for delete to authenticated using (public.owns_creator(creator_id) or public.has_role(auth.uid(),'admin'));

create or replace function public.owns_event(_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events e join public.creators c on c.id = e.creator_id where e.id = _event_id and c.user_id = auth.uid())
$$;

create or replace function public.guard_event_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.has_role(auth.uid(),'admin') then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'pending'; new.seats_taken := 0;
  elsif new.status is distinct from old.status then
    raise exception 'Only admins can change event status';
  elsif new.seats_taken is distinct from old.seats_taken and current_setting('app.seat_update', true) is distinct from 'on' then
    new.seats_taken := old.seats_taken;
  end if;
  return new;
end $$;
create trigger events_guard before insert or update on public.events for each row execute function public.guard_event_status();

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null,
  full_name text not null,
  email text not null,
  phone text not null,
  attendee_count integer not null default 1 check (attendee_count between 1 and 4),
  ticket_code text not null unique default ('CC-' || upper(substr(md5(random()::text || clock_timestamp()::text),1,8))),
  checked_in boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);
grant select, insert, update on public.registrations to authenticated;
grant all on public.registrations to service_role;
alter table public.registrations enable row level security;
create policy "reg read" on public.registrations for select to authenticated using (user_id = auth.uid() or public.owns_event(event_id) or public.has_role(auth.uid(),'admin'));
create policy "reg insert" on public.registrations for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.events e where e.id = event_id and e.status = 'live'));
create policy "reg update" on public.registrations for update to authenticated using (public.owns_event(event_id) or public.has_role(auth.uid(),'admin'));

create table public.follows (
  user_id uuid not null,
  creator_id uuid not null references public.creators(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, creator_id)
);
grant select, insert, delete on public.follows to authenticated;
grant all on public.follows to service_role;
alter table public.follows enable row level security;
create policy "follows read" on public.follows for select to authenticated using (true);
create policy "follows insert" on public.follows for insert to authenticated with check (user_id = auth.uid());
create policy "follows delete" on public.follows for delete to authenticated using (user_id = auth.uid());

create table public.saved_events (
  user_id uuid not null,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
grant select, insert, delete on public.saved_events to authenticated;
grant all on public.saved_events to service_role;
alter table public.saved_events enable row level security;
create policy "saved read" on public.saved_events for select to authenticated using (user_id = auth.uid() or public.owns_event(event_id) or public.has_role(auth.uid(),'admin'));
create policy "saved insert" on public.saved_events for insert to authenticated with check (user_id = auth.uid());
create policy "saved delete" on public.saved_events for delete to authenticated using (user_id = auth.uid());

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.announcements to authenticated;
grant all on public.announcements to service_role;
alter table public.announcements enable row level security;
create policy "ann read" on public.announcements for select to authenticated using (true);
create policy "ann insert" on public.announcements for insert to authenticated with check (public.owns_event(event_id));
create policy "ann delete" on public.announcements for delete to authenticated using (public.owns_event(event_id) or public.has_role(auth.uid(),'admin'));

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  reporter_id uuid not null,
  reason text not null,
  note text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create policy "reports read" on public.reports for select to authenticated using (reporter_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "reports insert" on public.reports for insert to authenticated with check (reporter_id = auth.uid() and status = 'open');
create policy "reports update" on public.reports for update to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  body text not null default '',
  event_id uuid references public.events(id) on delete cascade,
  kind text not null default 'general',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "notif read" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notif update" on public.notifications for update to authenticated using (user_id = auth.uid());
create policy "notif delete" on public.notifications for delete to authenticated using (user_id = auth.uid());
alter publication supabase_realtime add table public.notifications;

-- campaign applications
create table public.campaign_applications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  pitch text not null check (char_length(pitch) between 10 and 1500),
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  unique (event_id, creator_id)
);
grant select, insert, update, delete on public.campaign_applications to authenticated;
grant all on public.campaign_applications to service_role;
alter table public.campaign_applications enable row level security;
create policy "apps read" on public.campaign_applications for select to authenticated using (public.owns_creator(creator_id) or public.owns_event(event_id) or public.has_role(auth.uid(),'admin'));
create policy "apps insert" on public.campaign_applications for insert to authenticated with check (public.owns_creator(creator_id) and status = 'pending' and not public.owns_event(event_id));
create policy "apps update" on public.campaign_applications for update to authenticated using (public.owns_event(event_id) or public.has_role(auth.uid(),'admin'));
create policy "apps delete" on public.campaign_applications for delete to authenticated using (public.owns_creator(creator_id) and status = 'pending');

create table public.campaign_reports (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.campaign_applications(id) on delete cascade,
  reach integer not null default 0 check (reach >= 0),
  engagement integer not null default 0 check (engagement >= 0),
  deliverable_status text not null default 'not_started' check (deliverable_status in ('not_started','in_progress','delivered')),
  notes text,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.campaign_reports to authenticated;
grant all on public.campaign_reports to service_role;
alter table public.campaign_reports enable row level security;
create or replace function public.can_access_application(_app_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.campaign_applications a where a.id = _app_id
    and (public.owns_creator(a.creator_id) or public.owns_event(a.event_id) or public.has_role(auth.uid(),'admin')))
$$;
create policy "creports read" on public.campaign_reports for select to authenticated using (public.can_access_application(application_id));
create policy "creports insert" on public.campaign_reports for insert to authenticated with check (public.can_access_application(application_id));
create policy "creports update" on public.campaign_reports for update to authenticated using (public.can_access_application(application_id));

-- signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email)
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'attendee') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.on_registration()
returns trigger language plpgsql security definer set search_path = public as $$
declare e public.events;
begin
  new.checked_in := false;
  select * into e from public.events where id = new.event_id for update;
  if e.status <> 'live' then raise exception 'This event is not open for registration'; end if;
  if e.seats_taken + new.attendee_count > e.capacity then
    raise exception 'Only % seats left. Reduce the number of attendees.', e.capacity - e.seats_taken;
  end if;
  perform set_config('app.seat_update','on',true);
  update public.events set seats_taken = seats_taken + new.attendee_count where id = new.event_id;
  perform set_config('app.seat_update','off',true);
  insert into public.notifications (user_id, title, body, event_id, kind)
  values (new.user_id, 'You''re registered', 'Your ticket for ' || e.title || ' is ready.', new.event_id, 'ticket');
  return new;
end $$;
create trigger registrations_before before insert on public.registrations for each row execute function public.on_registration();

create or replace function public.guard_registration_update()
returns trigger language plpgsql as $$
begin
  new.event_id := old.event_id; new.user_id := old.user_id; new.attendee_count := old.attendee_count;
  new.ticket_code := old.ticket_code; new.full_name := old.full_name; new.email := old.email; new.phone := old.phone;
  return new;
end $$;
create trigger registrations_update_guard before update on public.registrations for each row execute function public.guard_registration_update();

create or replace function public.on_event_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare cname text;
begin
  if new.status = 'live' and old.status is distinct from 'live' then
    select display_name into cname from public.creators where id = new.creator_id;
    insert into public.notifications (user_id, title, body, event_id, kind)
    select f.user_id, cname || ' has a new event', new.title || ' is now open for registration.', new.id, 'event'
    from public.follows f where f.creator_id = new.creator_id;
    if new.promotion_brief is not null then
      insert into public.notifications (user_id, title, body, event_id, kind)
      select c.user_id, 'New campaign matches your niche', new.title || ' is looking for ' || coalesce(new.target_niche,'creators') || '.', new.id, 'campaign'
      from public.creators c
      where c.user_id is not null and c.verified and c.id <> new.creator_id
        and (new.target_niche is null or lower(c.category) = lower(new.target_niche));
    end if;
  end if;
  return new;
end $$;
create trigger events_status_after after update on public.events for each row execute function public.on_event_status();

create or replace function public.on_announcement()
returns trigger language plpgsql security definer set search_path = public as $$
declare e public.events;
begin
  select * into e from public.events where id = new.event_id;
  insert into public.notifications (user_id, title, body, event_id, kind)
  select distinct u, 'Update: ' || e.title, left(new.body, 140), e.id, 'announcement' from (
    select f.user_id u from public.follows f where f.creator_id = e.creator_id
    union select r.user_id from public.registrations r where r.event_id = e.id
  ) s;
  return new;
end $$;
create trigger announcements_after after insert on public.announcements for each row execute function public.on_announcement();

create or replace function public.on_application_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare e public.events; owner uuid; applicant uuid; cname text;
begin
  select * into e from public.events where id = new.event_id;
  select user_id into owner from public.creators where id = e.creator_id;
  select user_id, display_name into applicant, cname from public.creators where id = new.creator_id;
  if tg_op = 'INSERT' then
    if owner is not null then
      insert into public.notifications (user_id, title, body, event_id, kind)
      values (owner, 'New campaign application', cname || ' applied to ' || e.title || '.', e.id, 'application');
    end if;
  elsif new.status is distinct from old.status and applicant is not null then
    insert into public.notifications (user_id, title, body, event_id, kind)
    values (applicant, case when new.status = 'accepted' then 'Application accepted' else 'Application not selected' end,
      'Your application for ' || e.title || ' was ' || new.status || '.', e.id, 'application');
  end if;
  return new;
end $$;
create trigger applications_after after insert or update on public.campaign_applications for each row execute function public.on_application_change();

create or replace function public.guard_application_update()
returns trigger language plpgsql as $$
begin
  new.event_id := old.event_id; new.creator_id := old.creator_id; new.pitch := old.pitch;
  return new;
end $$;
create trigger applications_update_guard before update on public.campaign_applications for each row execute function public.guard_application_update();

create or replace function public.notify_deadlines()
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, title, body, event_id, kind)
  select c.user_id, 'Deadline approaching', 'Applications for ' || e.title || ' close in under 48 hours.', e.id, 'deadline'
  from public.events e join public.creators c on c.verified and c.user_id is not null and c.id <> e.creator_id
  where e.status = 'live' and e.promotion_brief is not null
    and e.application_deadline between now() and now() + interval '48 hours'
    and (e.target_niche is null or lower(c.category) = lower(e.target_niche))
    and not exists (select 1 from public.campaign_applications a where a.event_id = e.id and a.creator_id = c.id)
    and not exists (select 1 from public.notifications n where n.user_id = c.user_id and n.event_id = e.id and n.kind = 'deadline');
$$;
revoke execute on function public.notify_deadlines() from anon, authenticated;

create or replace function public.review_creator(_creator_id uuid, _approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare c public.creators;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Admins only'; end if;
  update public.creators set verified = _approve, verification_status = case when _approve then 'verified' else 'rejected' end
  where id = _creator_id returning * into c;
  if c.user_id is not null then
    if _approve then
      insert into public.user_roles (user_id, role) values (c.user_id, 'creator') on conflict do nothing;
      insert into public.notifications (user_id, title, body, kind) values (c.user_id, 'You''re a verified creator', 'You can now publish events from your creator dashboard.', 'verification');
    else
      insert into public.notifications (user_id, title, body, kind) values (c.user_id, 'Creator request not approved', 'Add stronger proof links and apply again.', 'verification');
    end if;
  end if;
end $$;

create or replace function public.set_suspended(_user_id uuid, _suspended boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Admins only'; end if;
  update public.profiles set suspended = _suspended where id = _user_id;
end $$;

create or replace function public.record_view(_creator_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.creators set page_views = page_views + 1 where id = _creator_id;
$$;

create or replace function public.admin_stats()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Admins only'; end if;
  return json_build_object(
    'users', (select count(*) from public.profiles),
    'verified_creators', (select count(*) from public.creators where verified),
    'live_events', (select count(*) from public.events where status='live'),
    'needs_review', (select count(*) from public.events where status='pending') + (select count(*) from public.creators where verification_status='pending')
  );
end $$;

revoke execute on function public.review_creator(uuid,boolean) from anon;
revoke execute on function public.set_suspended(uuid,boolean) from anon;
revoke execute on function public.admin_stats() from anon;
revoke execute on function public.record_view(uuid) from anon;
