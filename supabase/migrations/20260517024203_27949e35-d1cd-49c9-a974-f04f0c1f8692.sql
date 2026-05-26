-- Convert bookings.event_type from enum to text to allow any custom event type
ALTER TABLE public.bookings
  ALTER COLUMN event_type DROP DEFAULT,
  ALTER COLUMN event_type TYPE text USING event_type::text,
  ALTER COLUMN event_type SET DEFAULT 'wedding';