-- Add in_progress to booking_status enum
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'in_progress' BEFORE 'completed';

-- Add icon and is_active columns to event_types
ALTER TABLE public.event_types
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Trigger: notify on booking status change
CREATE OR REPLACE FUNCTION public.notify_booking_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  status_label text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    status_label := CASE NEW.status::text
      WHEN 'pending' THEN 'قيد الانتظار'
      WHEN 'confirmed' THEN 'مؤكد'
      WHEN 'in_progress' THEN 'جاري التنفيذ'
      WHEN 'completed' THEN 'مكتمل'
      WHEN 'cancelled' THEN 'ملغي'
      ELSE NEW.status::text
    END;
    INSERT INTO public.notifications(title, body, level, kind)
    VALUES (
      'تحديث حالة الحجز',
      'الحجز ' || COALESCE(NEW.code, '') || ' للزبون ' || NEW.customer_name || ' أصبح: ' || status_label,
      CASE
        WHEN NEW.status::text = 'cancelled' THEN 'warning'::notif_level
        WHEN NEW.status::text = 'completed' THEN 'success'::notif_level
        ELSE 'info'::notif_level
      END,
      'booking'
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_booking_status_change ON public.bookings;
CREATE TRIGGER trg_notify_booking_status_change
AFTER UPDATE OF status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.notify_booking_status_change();