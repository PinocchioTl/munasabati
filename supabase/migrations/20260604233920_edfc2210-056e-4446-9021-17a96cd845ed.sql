
-- 1) Extend profiles for public booking storefront
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS booking_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_prices boolean NOT NULL DEFAULT true;

-- slug format constraint (lowercase letters, digits, hyphen; 3-40)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_public_slug_format') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_public_slug_format
      CHECK (public_slug IS NULL OR public_slug ~ '^[a-z0-9][a-z0-9-]{2,39}$');
  END IF;
END $$;

-- 2) Decoration description
ALTER TABLE public.decorations
  ADD COLUMN IF NOT EXISTS description text;

-- 3) booking_requests
CREATE TYPE public.booking_request_status AS ENUM (
  'new','reviewing','accepted','confirmed','completed','cancelled'
);

CREATE TABLE public.booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  event_date date NOT NULL,
  event_location text,
  event_type text NOT NULL DEFAULT 'other',
  notes text,
  decorations jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{id, qty}]
  supplies jsonb NOT NULL DEFAULT '[]'::jsonb,    -- [{id, qty}]
  status public.booking_request_status NOT NULL DEFAULT 'new',
  booking_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX booking_requests_owner_status_idx
  ON public.booking_requests(owner_id, status, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.booking_requests TO authenticated;
GRANT ALL ON public.booking_requests TO service_role;

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_booking_requests"
  ON public.booking_requests FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "owner_update_booking_requests"
  ON public.booking_requests FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_delete_booking_requests"
  ON public.booking_requests FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());
-- No INSERT policy: inserts happen via supabaseAdmin in server fn (validated)

CREATE TRIGGER set_booking_requests_updated_at
  BEFORE UPDATE ON public.booking_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Notify owner on new request
CREATE OR REPLACE FUNCTION public.notify_new_booking_request()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications(title, body, level, kind, owner_id)
  VALUES (
    'طلب حجز جديد',
    'طلب حجز جديد من ' || NEW.customer_name || ' بتاريخ ' || NEW.event_date::text,
    'info'::notif_level,
    'booking_request',
    NEW.owner_id
  );
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_new_booking_request
  AFTER INSERT ON public.booking_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_booking_request();
