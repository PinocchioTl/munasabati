
-- 1. Event types table
CREATE TABLE IF NOT EXISTS public.event_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_all_event_types ON public.event_types FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.event_types (name, label) VALUES
  ('wedding', 'عرس'),
  ('engagement', 'خطوبة'),
  ('birthday', 'عيد ميلاد'),
  ('other', 'أخرى')
ON CONFLICT (name) DO NOTHING;

-- 2. Bookings.location
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS location text;

-- 3. Supplies.images
ALTER TABLE public.supplies ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}';

-- 4. Storage bucket for item images
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public_read_item_images" ON storage.objects FOR SELECT
USING (bucket_id = 'item-images');
CREATE POLICY "public_write_item_images" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'item-images');
CREATE POLICY "public_update_item_images" ON storage.objects FOR UPDATE
USING (bucket_id = 'item-images');
CREATE POLICY "public_delete_item_images" ON storage.objects FOR DELETE
USING (bucket_id = 'item-images');
