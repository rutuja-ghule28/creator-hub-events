-- ============================================================================== 
-- Creator Connect Database Setup: Phase 2 (Independent Organizer Architecture)
-- Target Project: eikbbvimvaghfwzpidcj
-- Source: drizzle/migrations/0004_independent_organizer_architecture.sql
-- Note: Run in Supabase SQL Editor AFTER Phase 1 has completed and committed.
-- ==============================================================================

BEGIN;

-- Creator Connect Migration: Independent Organizer Architecture & Personal Data Protection
-- Version: 0004
-- Date: 2026-11-18

-- 1. Add account_type to public.profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'attendee'
  CHECK (account_type IN ('attendee', 'creator', 'organizer'));

-- 2. Create public.organizers table (holds safe public information only)
CREATE TABLE IF NOT EXISTS public.organizers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  bio text NOT NULL DEFAULT '',
  website_url text,
  location text NOT NULL DEFAULT 'Pune',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Public Organizer Table Grants
GRANT SELECT ON public.organizers TO authenticated, anon;
GRANT INSERT ON public.organizers TO authenticated;
GRANT UPDATE (name, bio, website_url, location, avatar_url) ON public.organizers TO authenticated;
GRANT ALL ON public.organizers TO service_role;
ALTER TABLE public.organizers ENABLE ROW LEVEL SECURITY;

-- Public Organizer RLS Policies
CREATE POLICY "organizers_readable" 
  ON public.organizers 
  FOR SELECT 
  TO authenticated, anon 
  USING (true);

CREATE POLICY "organizers_insert_own" 
  ON public.organizers 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "organizers_update_own" 
  ON public.organizers 
  FOR UPDATE 
  TO authenticated 
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Helper: owns_organizer
CREATE OR REPLACE FUNCTION public.owns_organizer(_organizer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizers WHERE id = _organizer_id AND user_id = auth.uid()
  )
$$;

-- 3. Dedicated Private Profile Structure for Organizer Personal Data Protection
CREATE TABLE IF NOT EXISTS public.organizer_private_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid UNIQUE NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
  contact_email text,
  contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Strict Private Permissions: Anonymous users have ZERO access
REVOKE ALL ON public.organizer_private_details FROM anon;
GRANT SELECT, INSERT ON public.organizer_private_details TO authenticated;
GRANT UPDATE (contact_email, contact_phone, updated_at) ON public.organizer_private_details TO authenticated;
GRANT ALL ON public.organizer_private_details TO service_role;
ALTER TABLE public.organizer_private_details ENABLE ROW LEVEL SECURITY;

-- Only the organizer owner and admins can read private contact details
CREATE POLICY "organizer_private_read_own" 
  ON public.organizer_private_details 
  FOR SELECT 
  TO authenticated 
  USING (
    public.owns_organizer(organizer_id) OR public.has_role(auth.uid(), 'admin')
  );

-- Only the organizer owner and admins can insert private contact details
CREATE POLICY "organizer_private_insert_own" 
  ON public.organizer_private_details 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    public.owns_organizer(organizer_id) OR public.has_role(auth.uid(), 'admin')
  );

-- Only the organizer owner and admins can update private contact details
CREATE POLICY "organizer_private_update_own" 
  ON public.organizer_private_details 
  FOR UPDATE 
  TO authenticated 
  USING (
    public.owns_organizer(organizer_id) OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.owns_organizer(organizer_id) OR public.has_role(auth.uid(), 'admin')
  );

-- 4. Enhance public.events to support organizer ownership while preserving creator records & discovery
ALTER TABLE public.events 
  ADD COLUMN IF NOT EXISTS organizer_id uuid REFERENCES public.organizers(id) ON DELETE CASCADE;

ALTER TABLE public.events 
  ALTER COLUMN creator_id DROP NOT NULL;

-- Ensure every event has at least one valid owner (creator or organizer)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_events_has_owner'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT chk_events_has_owner CHECK (creator_id IS NOT NULL OR organizer_id IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_events_organizer_id ON public.events(organizer_id);

-- 5. Update owns_event() to recognize both creator ownership and organizer ownership
CREATE OR REPLACE FUNCTION public.owns_event(_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    LEFT JOIN public.creators c ON c.id = e.creator_id
    LEFT JOIN public.organizers o ON o.id = e.organizer_id
    WHERE e.id = _event_id
      AND (
        (e.creator_id IS NOT NULL AND c.user_id = auth.uid())
        OR
        (e.organizer_id IS NOT NULL AND o.user_id = auth.uid())
      )
  )
$$;

-- 6. Events Permissions & RLS (Preserves Anonymous & Authenticated Discovery of Live Events)
GRANT SELECT ON public.events TO anon;

DROP POLICY IF EXISTS "events read" ON public.events;
CREATE POLICY "events read" ON public.events FOR SELECT TO authenticated, anon
USING (
  status = 'live' 
  OR (creator_id IS NOT NULL AND public.owns_creator(creator_id))
  OR (organizer_id IS NOT NULL AND public.owns_organizer(organizer_id))
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "events insert" ON public.events;
CREATE POLICY "events insert" ON public.events FOR INSERT TO authenticated 
WITH CHECK (
  (
    creator_id IS NOT NULL 
    AND public.owns_creator(creator_id) 
    AND public.has_role(auth.uid(), 'creator')
  )
  OR
  (
    organizer_id IS NOT NULL 
    AND public.owns_organizer(organizer_id) 
    AND public.has_role(auth.uid(), 'organizer')
  )
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "events update" ON public.events;
CREATE POLICY "events update" ON public.events FOR UPDATE TO authenticated
USING (
  (creator_id IS NOT NULL AND public.owns_creator(creator_id))
  OR (organizer_id IS NOT NULL AND public.owns_organizer(organizer_id))
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  (creator_id IS NOT NULL AND public.owns_creator(creator_id))
  OR (organizer_id IS NOT NULL AND public.owns_organizer(organizer_id))
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "events delete" ON public.events;
CREATE POLICY "events delete" ON public.events FOR DELETE TO authenticated
USING (
  (creator_id IS NOT NULL AND public.owns_creator(creator_id))
  OR (organizer_id IS NOT NULL AND public.owns_organizer(organizer_id))
  OR public.has_role(auth.uid(), 'admin')
);

-- 7. Add submitted_by_organizer_id to external_events & secure policies
ALTER TABLE public.external_events
  ADD COLUMN IF NOT EXISTS submitted_by_organizer_id uuid REFERENCES public.organizers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_external_events_organizer ON public.external_events(submitted_by_organizer_id);

DROP POLICY IF EXISTS "external_events_organizer_read_own" ON public.external_events;
CREATE POLICY "external_events_organizer_read_own"
  ON public.external_events
  FOR SELECT
  TO authenticated
  USING (
    submitted_by_organizer_id IN (
      SELECT id FROM public.organizers WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "external_events_organizer_insert" ON public.external_events;
CREATE POLICY "external_events_organizer_insert"
  ON public.external_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    status = 'pending' AND
    submission_type = 'organizer' AND
    is_demo = false AND
    submitted_by_organizer_id IS NOT NULL AND
    public.owns_organizer(submitted_by_organizer_id) AND
    public.has_role(auth.uid(), 'organizer')
  );

-- 8. Update on_event_status() notification trigger for organizer events
CREATE OR REPLACE FUNCTION public.on_event_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  host_name text;
BEGIN
  IF new.status = 'live' AND old.status IS DISTINCT FROM 'live' THEN
    IF new.creator_id IS NOT NULL THEN
      SELECT display_name INTO host_name FROM public.creators WHERE id = new.creator_id;
      INSERT INTO public.notifications (user_id, title, body, event_id, kind)
      SELECT f.user_id, host_name || ' has a new event', new.title || ' is now open for registration.', new.id, 'event'
      FROM public.follows f WHERE f.creator_id = new.creator_id;
    ELSIF new.organizer_id IS NOT NULL THEN
      SELECT name INTO host_name FROM public.organizers WHERE id = new.organizer_id;
    END IF;

    IF new.promotion_brief IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, event_id, kind)
      SELECT c.user_id, 'New campaign matches your niche', new.title || ' is looking for ' || COALESCE(new.target_niche,'creators') || '.', new.id, 'campaign'
      FROM public.creators c
      WHERE c.user_id IS NOT NULL AND c.verified AND (new.creator_id IS NULL OR c.id <> new.creator_id)
        AND (new.target_niche IS NULL OR LOWER(c.category) = LOWER(new.target_niche));
    END IF;
  END IF;
  RETURN new;
END $$;

-- 9. Enhanced handle_new_user() trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  requested_role text;
  valid_account_type text;
  user_full_name text;
BEGIN
  requested_role := LOWER(TRIM(COALESCE(
    new.raw_user_meta_data->>'account_type',
    new.raw_user_meta_data->>'role',
    'attendee'
  )));

  IF requested_role = 'creator' THEN
    valid_account_type := 'creator';
  ELSIF requested_role = 'organizer' THEN
    valid_account_type := 'organizer';
  ELSE
    valid_account_type := 'attendee';
  END IF;

  user_full_name := COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

  INSERT INTO public.profiles (id, full_name, email, account_type)
  VALUES (
    new.id,
    user_full_name,
    new.email,
    valid_account_type
  )
  ON CONFLICT (id) DO NOTHING;

  -- All authenticated users receive 'attendee' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'attendee')
  ON CONFLICT DO NOTHING;

  -- If organizer is selected, assign 'organizer' role and create organizer public & private profiles
  IF valid_account_type = 'organizer' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'organizer'::public.app_role)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.organizers (user_id, name)
    VALUES (new.id, user_full_name)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.organizer_private_details (organizer_id, contact_email)
    SELECT id, new.email FROM public.organizers WHERE user_id = new.id
    ON CONFLICT (organizer_id) DO NOTHING;
  END IF;

  RETURN new;
END $$;

COMMIT;
