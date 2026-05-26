
-- Rental system for supplies: booking_supplies table + dynamic used_qty

CREATE TABLE IF NOT EXISTS public.booking_supplies (
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  supply_id uuid NOT NULL REFERENCES public.supplies(id) ON DELETE CASCADE,
  qty integer NOT NULL DEFAULT 1 CHECK (qty > 0),
  PRIMARY KEY (booking_id, supply_id)
);

ALTER TABLE public.booking_supplies ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_all_booking_supplies ON public.booking_supplies
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_supplies.booking_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_supplies.booking_id AND b.owner_id = auth.uid()));

-- Recalc supply (rental model): used_qty = sum of active bookings (pending/confirmed/in_progress)
CREATE OR REPLACE FUNCTION public.recalc_supply(sup_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  total INT;
  active_used INT;
  remaining INT;
  alert INT;
BEGIN
  SELECT total_qty, min_alert INTO total, alert FROM public.supplies WHERE id = sup_id;
  IF total IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(bs.qty),0) INTO active_used
  FROM public.booking_supplies bs
  JOIN public.bookings b ON b.id = bs.booking_id
  WHERE bs.supply_id = sup_id AND b.status IN ('pending','confirmed','in_progress');

  remaining := total - active_used;

  UPDATE public.supplies SET
    used_qty = active_used,
    status = CASE
      WHEN remaining <= 0 THEN 'unavailable'::item_status
      WHEN remaining <= alert THEN 'limited'::item_status
      ELSE 'available'::item_status
    END
  WHERE id = sup_id;
END $$;

-- Trigger: recalc on booking_supplies changes
CREATE OR REPLACE FUNCTION public.trg_recalc_supply()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_supply(OLD.supply_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_supply(NEW.supply_id);
    IF TG_OP = 'UPDATE' AND OLD.supply_id IS DISTINCT FROM NEW.supply_id THEN
      PERFORM public.recalc_supply(OLD.supply_id);
    END IF;
    RETURN NEW;
  END IF;
END $$;

DROP TRIGGER IF EXISTS booking_supplies_recalc ON public.booking_supplies;
CREATE TRIGGER booking_supplies_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.booking_supplies
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_supply();

-- Also recalc all supplies for a booking when its status changes
CREATE OR REPLACE FUNCTION public.trg_recalc_supplies_on_booking_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    FOR r IN SELECT DISTINCT supply_id FROM public.booking_supplies WHERE booking_id = NEW.id LOOP
      PERFORM public.recalc_supply(r.supply_id);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bookings_recalc_supplies ON public.bookings;
CREATE TRIGGER bookings_recalc_supplies
AFTER UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_supplies_on_booking_status();

-- Disable old "low stock" auto-notification trigger logic by replacing update_supply_status:
-- keep status calc but remove the spam notification (rental: low stock is per-date, not permanent)
CREATE OR REPLACE FUNCTION public.update_supply_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE remaining INT;
BEGIN
  remaining := NEW.total_qty - NEW.used_qty;
  NEW.status := CASE
    WHEN remaining <= 0 THEN 'unavailable'::item_status
    WHEN remaining <= NEW.min_alert THEN 'limited'::item_status
    ELSE 'available'::item_status
  END;
  RETURN NEW;
END $$;

-- Reset used_qty for existing supplies (rental model starts clean)
UPDATE public.supplies SET used_qty = 0, status = 'available'::item_status WHERE used_qty > 0;
