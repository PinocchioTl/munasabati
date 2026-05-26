
-- Convert decorations/supplies to TRUE rental: status is always "available"
-- because nothing is ever permanently removed from stock. Date-based
-- availability is enforced at booking time in the app layer.

CREATE OR REPLACE FUNCTION public.recalc_decoration(dec_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE active_booked INT; bcount INT; revenue NUMERIC;
BEGIN
  SELECT COALESCE(SUM(bd.qty),0) INTO active_booked FROM public.booking_decorations bd
    JOIN public.bookings b ON b.id = bd.booking_id
    WHERE bd.decoration_id = dec_id AND b.status IN ('pending','confirmed','in_progress');
  SELECT COUNT(*) INTO bcount FROM public.booking_decorations bd
    JOIN public.bookings b ON b.id = bd.booking_id
    WHERE bd.decoration_id = dec_id AND b.status IN ('confirmed','completed');
  SELECT COALESCE(SUM(d.price * bd.qty),0) INTO revenue FROM public.booking_decorations bd
    JOIN public.bookings b ON b.id = bd.booking_id
    JOIN public.decorations d ON d.id = bd.decoration_id
    WHERE bd.decoration_id = dec_id AND b.status IN ('confirmed','completed');
  UPDATE public.decorations
    SET booked_qty = active_booked,
        bookings_count = bcount,
        total_revenue = revenue,
        status = 'available'::item_status -- rental: always available; date conflicts handled per-booking
  WHERE id = dec_id;
END $function$;

CREATE OR REPLACE FUNCTION public.recalc_supply(sup_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE active_used INT;
BEGIN
  SELECT COALESCE(SUM(bs.qty),0) INTO active_used FROM public.booking_supplies bs
    JOIN public.bookings b ON b.id = bs.booking_id
    WHERE bs.supply_id = sup_id AND b.status IN ('pending','confirmed','in_progress');
  UPDATE public.supplies
    SET used_qty = active_used,
        status = 'available'::item_status -- rental: always available; date conflicts handled per-booking
  WHERE id = sup_id;
END $function$;

-- The BEFORE-UPDATE trigger on supplies also forces status from used_qty.
-- Override it so status stays 'available' (rental model).
CREATE OR REPLACE FUNCTION public.update_supply_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.status := 'available'::item_status;
  RETURN NEW;
END $function$;

-- Backfill: reset all current statuses to available
UPDATE public.decorations SET status = 'available'::item_status WHERE status <> 'available';
UPDATE public.supplies SET status = 'available'::item_status WHERE status <> 'available';
