
-- ============ 1. Branding fields on profiles ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#D4AF37',
  ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#111827',
  ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#2563EB',
  ADD COLUMN IF NOT EXISTS background_color text DEFAULT '#F9FAFB';

-- ============ 2. Add owner_id to all business tables ============
ALTER TABLE public.bookings        ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.decorations     ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.supplies        ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.clients         ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.expenses        ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.notifications   ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.event_types     ADD COLUMN IF NOT EXISTS owner_id uuid;

CREATE INDEX IF NOT EXISTS idx_bookings_owner      ON public.bookings(owner_id);
CREATE INDEX IF NOT EXISTS idx_decorations_owner   ON public.decorations(owner_id);
CREATE INDEX IF NOT EXISTS idx_supplies_owner      ON public.supplies(owner_id);
CREATE INDEX IF NOT EXISTS idx_clients_owner       ON public.clients(owner_id);
CREATE INDEX IF NOT EXISTS idx_expenses_owner      ON public.expenses(owner_id);
CREATE INDEX IF NOT EXISTS idx_notifications_owner ON public.notifications(owner_id);
CREATE INDEX IF NOT EXISTS idx_event_types_owner   ON public.event_types(owner_id);

-- ============ 3. Auto-set owner_id from auth.uid() ============
CREATE OR REPLACE FUNCTION public.set_owner_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bookings','decorations','supplies','clients','expenses','notifications','event_types']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_owner_id_trg ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_owner_id_trg BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_owner_id()', t);
  END LOOP;
END $$;

-- ============ 4. Replace open policies with per-owner policies ============
DROP POLICY IF EXISTS public_all_bookings        ON public.bookings;
DROP POLICY IF EXISTS public_all_decorations     ON public.decorations;
DROP POLICY IF EXISTS public_all_supplies        ON public.supplies;
DROP POLICY IF EXISTS public_all_clients         ON public.clients;
DROP POLICY IF EXISTS public_all_expenses        ON public.expenses;
DROP POLICY IF EXISTS public_all_notifications   ON public.notifications;
DROP POLICY IF EXISTS public_all_event_types     ON public.event_types;
DROP POLICY IF EXISTS public_all_booking_decorations ON public.booking_decorations;

CREATE POLICY owner_all_bookings      ON public.bookings      FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);
CREATE POLICY owner_all_decorations   ON public.decorations   FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);
CREATE POLICY owner_all_supplies      ON public.supplies      FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);
CREATE POLICY owner_all_clients       ON public.clients       FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);
CREATE POLICY owner_all_expenses      ON public.expenses      FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);
CREATE POLICY owner_all_notifications ON public.notifications FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);
CREATE POLICY owner_all_event_types   ON public.event_types   FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);

-- booking_decorations: scope via parent booking
CREATE POLICY owner_all_booking_decorations ON public.booking_decorations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_decorations.booking_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_decorations.booking_id AND b.owner_id = auth.uid()));

-- ============ 5. Branding storage bucket ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read branding" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own branding" ON storage.objects;
DROP POLICY IF EXISTS "Users update own branding" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own branding" ON storage.objects;

CREATE POLICY "Public read branding" ON storage.objects FOR SELECT USING (bucket_id = 'branding');
CREATE POLICY "Users upload own branding" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own branding" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own branding" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND auth.uid()::text = (storage.foldername(name))[1]);
