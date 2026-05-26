
-- ENUMS
CREATE TYPE booking_status AS ENUM ('pending','confirmed','completed','cancelled');
CREATE TYPE event_type AS ENUM ('wedding','engagement','birthday','other');
CREATE TYPE payment_status AS ENUM ('unpaid','partial','paid');
CREATE TYPE notif_level AS ENUM ('info','warning','success','error');
CREATE TYPE item_status AS ENUM ('available','limited','unavailable');

-- CLIENTS
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  is_vip BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  events_count INT NOT NULL DEFAULT 0,
  total_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_event_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- DECORATIONS
CREATE TABLE public.decorations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  images TEXT[] DEFAULT '{}',
  total_qty INT NOT NULL DEFAULT 1,
  booked_qty INT NOT NULL DEFAULT 0,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  status item_status NOT NULL DEFAULT 'available',
  bookings_count INT NOT NULL DEFAULT 0,
  total_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.decoration_available(d public.decorations)
RETURNS INT LANGUAGE sql IMMUTABLE AS $$ SELECT GREATEST(d.total_qty - d.booked_qty, 0) $$;

-- SUPPLIES
CREATE TABLE public.supplies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  total_qty INT NOT NULL DEFAULT 0,
  used_qty INT NOT NULL DEFAULT 0,
  min_alert INT NOT NULL DEFAULT 5,
  supplier TEXT,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  status item_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BOOKINGS
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  phone TEXT,
  event_type event_type NOT NULL DEFAULT 'wedding',
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  deposit NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  expenses NUMERIC(12,2) NOT NULL DEFAULT 0,
  remaining NUMERIC(12,2) GENERATED ALWAYS AS (total_price - deposit) STORED,
  net_profit NUMERIC(12,2) GENERATED ALWAYS AS (total_price - expenses) STORED,
  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BOOKING <-> DECORATIONS (many-to-many)
CREATE TABLE public.booking_decorations (
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  decoration_id UUID REFERENCES public.decorations(id) ON DELETE CASCADE,
  qty INT NOT NULL DEFAULT 1,
  PRIMARY KEY (booking_id, decoration_id)
);

-- EXPENSES
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_type TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  kind TEXT,
  level notif_level NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- TRIGGERS / SMART LOGIC
-- =========================

-- Auto-generate booking code: B-1000+
CREATE SEQUENCE IF NOT EXISTS bookings_code_seq START 1042;
CREATE OR REPLACE FUNCTION public.set_booking_code() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := 'B-' || nextval('bookings_code_seq')::text;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_booking_code BEFORE INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.set_booking_code();

-- Prevent decoration overbooking + double-booking time conflict
CREATE OR REPLACE FUNCTION public.check_booking_conflicts() RETURNS TRIGGER AS $$
DECLARE
  conflict_count INT;
  d RECORD;
  available INT;
BEGIN
  -- Time conflict for same decoration on same date
  FOR d IN SELECT decoration_id, qty FROM public.booking_decorations WHERE booking_id = NEW.booking_id LOOP
    SELECT COALESCE(SUM(bd.qty),0) INTO conflict_count
    FROM public.booking_decorations bd
    JOIN public.bookings b ON b.id = bd.booking_id
    WHERE bd.decoration_id = d.decoration_id
      AND b.id <> NEW.booking_id
      AND b.status IN ('pending','confirmed')
      AND b.event_date = (SELECT event_date FROM public.bookings WHERE id = NEW.booking_id)
      AND tstzrange(
        (b.event_date::text || ' ' || b.start_time::text)::timestamptz,
        (b.event_date::text || ' ' || b.end_time::text)::timestamptz
      ) && tstzrange(
        ((SELECT event_date FROM public.bookings WHERE id=NEW.booking_id)::text || ' ' ||
         (SELECT start_time FROM public.bookings WHERE id=NEW.booking_id)::text)::timestamptz,
        ((SELECT event_date FROM public.bookings WHERE id=NEW.booking_id)::text || ' ' ||
         (SELECT end_time FROM public.bookings WHERE id=NEW.booking_id)::text)::timestamptz
      );

    SELECT total_qty INTO available FROM public.decorations WHERE id = d.decoration_id;
    IF conflict_count + d.qty > available THEN
      RAISE EXCEPTION 'تعارض في الحجز: الديكور المختار غير متوفر في هذا التوقيت';
    END IF;
  END LOOP;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_booking_decoration_conflict AFTER INSERT ON public.booking_decorations
FOR EACH ROW EXECUTE FUNCTION public.check_booking_conflicts();

-- Recalculate decoration stats (booked_qty, status, bookings_count, total_revenue)
CREATE OR REPLACE FUNCTION public.recalc_decoration(dec_id UUID) RETURNS VOID AS $$
DECLARE
  total INT;
  active_booked INT;
  bcount INT;
  revenue NUMERIC;
BEGIN
  SELECT total_qty, price INTO total, revenue FROM public.decorations WHERE id = dec_id;

  SELECT COALESCE(SUM(bd.qty),0) INTO active_booked
  FROM public.booking_decorations bd
  JOIN public.bookings b ON b.id = bd.booking_id
  WHERE bd.decoration_id = dec_id AND b.status IN ('pending','confirmed');

  SELECT COUNT(*) INTO bcount
  FROM public.booking_decorations bd
  JOIN public.bookings b ON b.id = bd.booking_id
  WHERE bd.decoration_id = dec_id AND b.status IN ('confirmed','completed');

  SELECT COALESCE(SUM(d.price * bd.qty),0) INTO revenue
  FROM public.booking_decorations bd
  JOIN public.bookings b ON b.id = bd.booking_id
  JOIN public.decorations d ON d.id = bd.decoration_id
  WHERE bd.decoration_id = dec_id AND b.status IN ('confirmed','completed');

  UPDATE public.decorations SET
    booked_qty = active_booked,
    bookings_count = bcount,
    total_revenue = revenue,
    status = CASE
      WHEN total - active_booked <= 0 THEN 'unavailable'::item_status
      WHEN (total - active_booked)::float / NULLIF(total,0) < 0.3 THEN 'limited'::item_status
      ELSE 'available'::item_status
    END
  WHERE id = dec_id;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.trg_recalc_decoration() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_decoration(OLD.decoration_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_decoration(NEW.decoration_id);
    RETURN NEW;
  END IF;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_bd_recalc AFTER INSERT OR UPDATE OR DELETE ON public.booking_decorations
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_decoration();

-- Update payment_status from deposit/total
CREATE OR REPLACE FUNCTION public.update_payment_status() RETURNS TRIGGER AS $$
BEGIN
  NEW.payment_status := CASE
    WHEN NEW.deposit <= 0 THEN 'unpaid'::payment_status
    WHEN NEW.deposit >= NEW.total_price THEN 'paid'::payment_status
    ELSE 'partial'::payment_status
  END;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_payment_status BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.update_payment_status();

-- Recalc client rollups when booking changes
CREATE OR REPLACE FUNCTION public.recalc_client(c_id UUID) RETURNS VOID AS $$
BEGIN
  IF c_id IS NULL THEN RETURN; END IF;
  UPDATE public.clients SET
    events_count = (SELECT COUNT(*) FROM public.bookings WHERE client_id = c_id),
    total_paid = (SELECT COALESCE(SUM(deposit),0) FROM public.bookings WHERE client_id = c_id),
    last_event_date = (SELECT MAX(event_date) FROM public.bookings WHERE client_id = c_id)
  WHERE id = c_id;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.trg_recalc_client() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN PERFORM public.recalc_client(OLD.client_id); RETURN OLD;
  ELSE
    PERFORM public.recalc_client(NEW.client_id);
    IF TG_OP = 'UPDATE' AND OLD.client_id IS DISTINCT FROM NEW.client_id THEN
      PERFORM public.recalc_client(OLD.client_id);
    END IF;
    RETURN NEW;
  END IF;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_booking_client AFTER INSERT OR UPDATE OR DELETE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_client();

-- Update supplies status & low-stock notification
CREATE OR REPLACE FUNCTION public.update_supply_status() RETURNS TRIGGER AS $$
DECLARE remaining INT;
BEGIN
  remaining := NEW.total_qty - NEW.used_qty;
  NEW.status := CASE
    WHEN remaining <= 0 THEN 'unavailable'::item_status
    WHEN remaining <= NEW.min_alert THEN 'limited'::item_status
    ELSE 'available'::item_status
  END;
  IF remaining <= NEW.min_alert AND remaining > 0 THEN
    INSERT INTO public.notifications(title, body, level, kind)
    VALUES ('تنبيه نقص مخزون',
            'العنصر "' || NEW.name || '" اقترب من النفاد (متبقي ' || remaining || ')',
            'warning','supply');
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_supply_status BEFORE INSERT OR UPDATE ON public.supplies
FOR EACH ROW EXECUTE FUNCTION public.update_supply_status();

-- New booking notification
CREATE OR REPLACE FUNCTION public.notify_new_booking() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications(title, body, level, kind)
  VALUES ('حجز جديد',
          'تم إنشاء حجز ' || NEW.code || ' للزبون ' || NEW.customer_name,
          'info','booking');
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_new_booking AFTER INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.notify_new_booking();

-- =========================
-- VIEWS (analytics)
-- =========================
CREATE OR REPLACE VIEW public.monthly_revenue AS
SELECT
  to_char(event_date, 'YYYY-MM') AS month,
  SUM(total_price) AS revenue,
  SUM(net_profit) AS profit,
  COUNT(*) AS bookings
FROM public.bookings
WHERE status IN ('confirmed','completed')
GROUP BY 1 ORDER BY 1;

CREATE OR REPLACE VIEW public.top_decorations AS
SELECT d.id, d.name, d.bookings_count, d.total_revenue
FROM public.decorations d
ORDER BY d.total_revenue DESC;

-- =========================
-- INDEXES
-- =========================
CREATE INDEX idx_bookings_date ON public.bookings(event_date);
CREATE INDEX idx_bookings_client ON public.bookings(client_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bd_decoration ON public.booking_decorations(decoration_id);
CREATE INDEX idx_expenses_booking ON public.expenses(booking_id);

-- =========================
-- RLS — مفتوحة مؤقتاً لتطبيق داخلي بدون مصادقة
-- يُنصح بإضافة نظام مصادقة لاحقاً
-- =========================
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decorations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_decorations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients','decorations','supplies','bookings','booking_decorations','expenses','notifications'] LOOP
    EXECUTE format('CREATE POLICY "public_all_%I" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;
