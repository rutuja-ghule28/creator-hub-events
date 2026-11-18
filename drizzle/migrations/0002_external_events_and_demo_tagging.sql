-- Creator Connect Migration: External Event Discovery & Demo Tagging
-- Version: 0002
-- Date: 2026-11-18

-- 1. Non-destructive demo tagging on existing tables
ALTER TABLE public.creators 
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.events 
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- Tag verified demo creators by exact UUID
UPDATE public.creators
SET is_demo = true
WHERE id IN (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000005',
  'a0000000-0000-0000-0000-000000000006'
);

-- Tag verified demo events by exact UUID
UPDATE public.events
SET is_demo = true
WHERE id IN (
  'e0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000002',
  'e0000000-0000-0000-0000-000000000003',
  'e0000000-0000-0000-0000-000000000004',
  'e0000000-0000-0000-0000-000000000005',
  'e0000000-0000-0000-0000-000000000006',
  'e0000000-0000-0000-0000-000000000007'
);

-- 2. Create external_events table
CREATE TABLE IF NOT EXISTS public.external_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,                    -- 'townscript', 'allevents', 'meetup', 'luma', 'partner', 'bookmyshow', 'insider'
  source_event_id text NOT NULL,                -- External event ID or slug
  source_event_url text NOT NULL,               -- Canonical source event page (HTTPS only)
  official_booking_url text NOT NULL,           -- Direct official ticketing checkout destination (HTTPS only)
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Meetup',       -- 'Concert', 'Comedy', 'Workshop', 'Meetup', 'Festival'
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  venue_name text NOT NULL,
  address text,
  city text NOT NULL,                           -- 'Mumbai', 'Pune', 'Bengaluru', 'Delhi NCR', 'Hyderabad', etc.
  state text,
  country text NOT NULL DEFAULT 'IN',
  ticket_price_min numeric(10, 2),              -- NULL if free or unlisted
  ticket_price_max numeric(10, 2),
  currency text NOT NULL DEFAULT 'INR',
  is_free boolean NOT NULL DEFAULT false,
  cover_url text,
  status text NOT NULL DEFAULT 'live',          -- 'live', 'concluded', 'cancelled', 'pending', 'rejected'
  submission_type text NOT NULL DEFAULT 'api',  -- 'api' or 'organizer'
  submitted_by_creator_id uuid REFERENCES public.creators(id) ON DELETE SET NULL,
  is_demo boolean NOT NULL DEFAULT false,
  source_last_verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_external_event_source UNIQUE (source_name, source_event_id),
  CONSTRAINT chk_source_url_https CHECK (source_event_url ~* '^https://'),
  CONSTRAINT chk_booking_url_https CHECK (official_booking_url ~* '^https://')
);

-- 3. Row Level Security & Grants
GRANT SELECT, INSERT ON public.external_events TO authenticated;
GRANT UPDATE ON public.external_events TO authenticated;
GRANT SELECT ON public.external_events TO anon;
GRANT ALL ON public.external_events TO service_role;
ALTER TABLE public.external_events ENABLE ROW LEVEL SECURITY;

-- Read policy: Anyone (anon or authenticated) can view active, non-demo external events
CREATE POLICY "external_events_public_read" 
  ON public.external_events 
  FOR SELECT 
  TO authenticated, anon 
  USING (status = 'live' AND is_demo = false);

-- Creator read own policy: Creators can view their own pending/submitted events
CREATE POLICY "external_events_creator_read_own"
  ON public.external_events
  FOR SELECT
  TO authenticated
  USING (
    submitted_by_creator_id IN (
      SELECT id FROM public.creators WHERE user_id = auth.uid()
    )
  );

-- Creator insert policy: Authenticated creators can submit events pending admin verification for their own creator profile
CREATE POLICY "external_events_creator_insert"
  ON public.external_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    status = 'pending' AND
    submission_type = 'organizer' AND
    is_demo = false AND
    submitted_by_creator_id IS NOT NULL AND
    EXISTS (
      SELECT 1
      FROM public.creators c
      WHERE c.id = submitted_by_creator_id
        AND c.user_id = auth.uid()
        AND (c.verified = true OR c.verification_status = 'verified')
    )
  );

-- Admin read policy: Admins can see all external events (including pending, cancelled, or demo)
CREATE POLICY "external_events_admin_read" 
  ON public.external_events 
  FOR SELECT 
  TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin write policy: Admins can manage external events (approve, reject, update, delete)
CREATE POLICY "external_events_admin_manage" 
  ON public.external_events 
  FOR ALL 
  TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. High-performance composite indexes
CREATE INDEX IF NOT EXISTS idx_external_events_city_starts_at 
  ON public.external_events (city, starts_at);

CREATE INDEX IF NOT EXISTS idx_external_events_status_demo 
  ON public.external_events (status, is_demo);

CREATE INDEX IF NOT EXISTS idx_external_events_source_lookup 
  ON public.external_events (source_name, source_event_id);
