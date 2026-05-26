
-- ENUMS
CREATE TYPE booking_status AS ENUM ('pending','confirmed','completed','cancelled');
CREATE TYPE event_type AS ENUM ('wedding','engagement','birthday','other');
CREATE TYPE payment_status AS ENUM ('unpaid','partial','paid');
CREATE TYPE notif_level AS ENUM ('info','warning','success','error');
CREATE TYPE item_status AS ENUM ('available','limited','unavailable');

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, phone TEXT, address TEXT,
  is_vip BOOLEAN NOT NULL DEFAULT false, notes TEXT,
  events_count INT NOT NULL DEFAULT 0,
  total_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_event_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.decorations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, category TEXT,
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

CREATE TABLE public.supplies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, category TEXT,
  total_qty INT NOT NULL DEFAULT 0,
  used_qty INT NOT NULL DEFAULT 0,
  min_alert INT NOT NULL DEFAULT 5,
  supplier TEXT,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  status item_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL, phone TEXT,
  event_type TEXT NOT NULL DEFAULT 'wedding',
  event_date DATE NOT NULL,
  start_time TIME NOT NULL, end_time TIME NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  deposit NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  expenses NUMERIC(12,2) NOT NULL DEFAULT 0,
  transport_cost NUMERIC NOT NULL DEFAULT 0,
  remaining NUMERIC(12,2) GENERATED ALWAYS AS (total_price - deposit) STORED,
  net_profit NUMERIC(12,2) GENERATED ALWAYS AS (total_price - expenses) STORED,
  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  location TEXT, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.booking_decorations (
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  decoration_id UUID REFERENCES public.decorations(id) ON DELETE CASCADE,
  qty INT NOT NULL DEFAULT 1,
  PRIMARY KEY (booking_id, decoration_id)
);

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_type TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, body TEXT, kind TEXT,
  level notif_level NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS bookings_code_seq START 1042;
CREATE OR REPLACE FUNCTION public.set_booking_code() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN IF NEW.code IS NULL THEN NEW.code := 'B-' || nextval('bookings_code_seq')::text; END IF; RETURN NEW; END $$;
CREATE TRIGGER trg_booking_code BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_booking_code();

CREATE OR REPLACE FUNCTION public.check_booking_conflicts() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
DECLARE conflict_count INT; d RECORD; available INT;
BEGIN
  FOR d IN SELECT decoration_id, qty FROM public.booking_decorations WHERE booking_id = NEW.booking_id LOOP
    SELECT COALESCE(SUM(bd.qty),0) INTO conflict_count
    FROM public.booking_decorations bd JOIN public.bookings b ON b.id = bd.booking_id
    WHERE bd.decoration_id = d.decoration_id AND b.id <> NEW.booking_id
      AND b.status IN ('pending','confirmed')
      AND b.event_date = (SELECT event_date FROM public.bookings WHERE id = NEW.booking_id);
    SELECT total_qty INTO available FROM public.decorations WHERE id = d.decoration_id;
    IF conflict_count + d.qty > available THEN
      RAISE EXCEPTION 'تعارض في الحجز: الديكور المختار غير متوفر';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_booking_decoration_conflict AFTER INSERT ON public.booking_decorations FOR EACH ROW EXECUTE FUNCTION public.check_booking_conflicts();

CREATE OR REPLACE FUNCTION public.recalc_decoration(dec_id UUID) RETURNS VOID LANGUAGE plpgsql SET search_path=public AS $$
DECLARE total INT; active_booked INT; bcount INT; revenue NUMERIC;
BEGIN
  SELECT total_qty INTO total FROM public.decorations WHERE id = dec_id;
  SELECT COALESCE(SUM(bd.qty),0) INTO active_booked FROM public.booking_decorations bd
    JOIN public.bookings b ON b.id = bd.booking_id
    WHERE bd.decoration_id = dec_id AND b.status IN ('pending','confirmed');
  SELECT COUNT(*) INTO bcount FROM public.booking_decorations bd
    JOIN public.bookings b ON b.id = bd.booking_id
    WHERE bd.decoration_id = dec_id AND b.status IN ('confirmed','completed');
  SELECT COALESCE(SUM(d.price * bd.qty),0) INTO revenue FROM public.booking_decorations bd
    JOIN public.bookings b ON b.id = bd.booking_id
    JOIN public.decorations d ON d.id = bd.decoration_id
    WHERE bd.decoration_id = dec_id AND b.status IN ('confirmed','completed');
  UPDATE public.decorations SET booked_qty=active_booked, bookings_count=bcount, total_revenue=revenue,
    status = CASE WHEN total-active_booked <= 0 THEN 'unavailable'::item_status
                  WHEN (total-active_booked)::float/NULLIF(total,0) < 0.3 THEN 'limited'::item_status
                  ELSE 'available'::item_status END
  WHERE id = dec_id;
END $$;

CREATE OR REPLACE FUNCTION public.trg_recalc_decoration() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN IF TG_OP='DELETE' THEN PERFORM public.recalc_decoration(OLD.decoration_id); RETURN OLD;
ELSE PERFORM public.recalc_decoration(NEW.decoration_id); RETURN NEW; END IF; END $$;
CREATE TRIGGER trg_bd_recalc AFTER INSERT OR UPDATE OR DELETE ON public.booking_decorations FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_decoration();

CREATE OR REPLACE FUNCTION public.update_payment_status() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.payment_status := CASE WHEN NEW.deposit<=0 THEN 'unpaid'::payment_status
  WHEN NEW.deposit>=NEW.total_price THEN 'paid'::payment_status ELSE 'partial'::payment_status END;
RETURN NEW; END $$;
CREATE TRIGGER trg_payment_status BEFORE INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_payment_status();

CREATE OR REPLACE FUNCTION public.recalc_client(c_id UUID) RETURNS VOID LANGUAGE plpgsql SET search_path=public AS $$
BEGIN IF c_id IS NULL THEN RETURN; END IF;
UPDATE public.clients SET
  events_count=(SELECT COUNT(*) FROM public.bookings WHERE client_id=c_id),
  total_paid=(SELECT COALESCE(SUM(deposit),0) FROM public.bookings WHERE client_id=c_id),
  last_event_date=(SELECT MAX(event_date) FROM public.bookings WHERE client_id=c_id)
WHERE id=c_id; END $$;

CREATE OR REPLACE FUNCTION public.trg_recalc_client() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN IF TG_OP='DELETE' THEN PERFORM public.recalc_client(OLD.client_id); RETURN OLD;
ELSE PERFORM public.recalc_client(NEW.client_id);
  IF TG_OP='UPDATE' AND OLD.client_id IS DISTINCT FROM NEW.client_id THEN PERFORM public.recalc_client(OLD.client_id); END IF;
  RETURN NEW; END IF; END $$;
CREATE TRIGGER trg_booking_client AFTER INSERT OR UPDATE OR DELETE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_client();

CREATE OR REPLACE FUNCTION public.update_supply_status() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
DECLARE remaining INT;
BEGIN remaining := NEW.total_qty - NEW.used_qty;
NEW.status := CASE WHEN remaining<=0 THEN 'unavailable'::item_status
  WHEN remaining<=NEW.min_alert THEN 'limited'::item_status ELSE 'available'::item_status END;
RETURN NEW; END $$;
CREATE TRIGGER trg_supply_status BEFORE INSERT OR UPDATE ON public.supplies FOR EACH ROW EXECUTE FUNCTION public.update_supply_status();

CREATE OR REPLACE FUNCTION public.notify_new_booking() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN INSERT INTO public.notifications(title, body, level, kind)
VALUES ('حجز جديد', 'تم إنشاء حجز ' || NEW.code || ' للزبون ' || NEW.customer_name, 'info','booking');
RETURN NEW; END $$;
CREATE TRIGGER trg_new_booking AFTER INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.notify_new_booking();

CREATE OR REPLACE VIEW public.monthly_revenue AS
SELECT to_char(event_date,'YYYY-MM') AS month, SUM(total_price) AS revenue,
  SUM(net_profit) AS profit, COUNT(*) AS bookings
FROM public.bookings WHERE status IN ('confirmed','completed')
GROUP BY 1 ORDER BY 1;

CREATE OR REPLACE VIEW public.top_decorations AS
SELECT d.id, d.name, d.bookings_count, d.total_revenue FROM public.decorations d
ORDER BY d.total_revenue DESC;

CREATE INDEX idx_bookings_date ON public.bookings(event_date);
CREATE INDEX idx_bookings_client ON public.bookings(client_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bd_decoration ON public.booking_decorations(decoration_id);
CREATE INDEX idx_expenses_booking ON public.expenses(booking_id);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decorations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_decorations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT, phone TEXT, email TEXT, company_name TEXT,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#D4AF37',
  secondary_color TEXT DEFAULT '#111827',
  accent_color TEXT DEFAULT '#2563EB',
  background_color TEXT DEFAULT '#F9FAFB',
  trial_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_own_profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid()=id);
CREATE POLICY "users_update_own_profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid()=id);
CREATE POLICY "users_insert_own_profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid()=id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN INSERT INTO public.profiles (id, full_name, phone, email, company_name, phone_verified)
VALUES (NEW.id,
  COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
  COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''),
  NEW.email,
  COALESCE(NEW.raw_user_meta_data->>'company_name', ''),
  (NEW.phone_confirmed_at IS NOT NULL))
ON CONFLICT (id) DO UPDATE SET
  phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
  phone_verified = EXCLUDED.phone_verified OR public.profiles.phone_verified;
RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='admin') $$;

CREATE POLICY "users_read_own_roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid()=user_id OR public.is_admin(auth.uid()));
CREATE POLICY "admins_manage_roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text, action text NOT NULL, entity text, entity_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_read_audit" ON public.audit_log FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "authenticated_insert_audit" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_user ON public.audit_log(user_id);

CREATE TABLE IF NOT EXISTS public.event_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE, label text NOT NULL,
  color text, icon text,
  is_active boolean NOT NULL DEFAULT true,
  owner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplies ADD COLUMN images text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.supplies ADD COLUMN notes text;

INSERT INTO storage.buckets (id, name, public) VALUES ('item-images','item-images',true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('branding','branding',true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public_read_item_images" ON storage.objects FOR SELECT USING (bucket_id='item-images');
CREATE POLICY "auth_insert_item_images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='item-images');
CREATE POLICY "auth_update_item_images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='item-images' AND owner=auth.uid()) WITH CHECK (bucket_id='item-images' AND owner=auth.uid());
CREATE POLICY "auth_delete_item_images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='item-images' AND owner=auth.uid());

CREATE POLICY "Public read branding" ON storage.objects FOR SELECT USING (bucket_id='branding');
CREATE POLICY "Users upload own branding" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='branding' AND auth.uid()::text=(storage.foldername(name))[1]);
CREATE POLICY "Users update own branding" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='branding' AND auth.uid()::text=(storage.foldername(name))[1]);
CREATE POLICY "Users delete own branding" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='branding' AND auth.uid()::text=(storage.foldername(name))[1]);

ALTER TABLE public.bookings ADD COLUMN owner_id uuid;
ALTER TABLE public.decorations ADD COLUMN owner_id uuid;
ALTER TABLE public.supplies ADD COLUMN owner_id uuid;
ALTER TABLE public.clients ADD COLUMN owner_id uuid;
ALTER TABLE public.expenses ADD COLUMN owner_id uuid;
ALTER TABLE public.notifications ADD COLUMN owner_id uuid;

CREATE INDEX idx_bookings_owner ON public.bookings(owner_id);
CREATE INDEX idx_decorations_owner ON public.decorations(owner_id);
CREATE INDEX idx_supplies_owner ON public.supplies(owner_id);
CREATE INDEX idx_clients_owner ON public.clients(owner_id);
CREATE INDEX idx_expenses_owner ON public.expenses(owner_id);
CREATE INDEX idx_notifications_owner ON public.notifications(owner_id);
CREATE INDEX idx_event_types_owner ON public.event_types(owner_id);

CREATE OR REPLACE FUNCTION public.set_owner_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NEW.owner_id IS NULL THEN NEW.owner_id := auth.uid(); END IF; RETURN NEW; END $$;

DO $$ DECLARE t text;
BEGIN FOREACH t IN ARRAY ARRAY['bookings','decorations','supplies','clients','expenses','notifications','event_types']
LOOP EXECUTE format('CREATE TRIGGER set_owner_id_trg BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_owner_id()', t);
END LOOP; END $$;

CREATE POLICY owner_all_bookings ON public.bookings FOR ALL TO authenticated USING (owner_id=auth.uid()) WITH CHECK (owner_id=auth.uid());
CREATE POLICY owner_all_decorations ON public.decorations FOR ALL TO authenticated USING (owner_id=auth.uid()) WITH CHECK (owner_id=auth.uid());
CREATE POLICY owner_all_supplies ON public.supplies FOR ALL TO authenticated USING (owner_id=auth.uid()) WITH CHECK (owner_id=auth.uid());
CREATE POLICY owner_all_clients ON public.clients FOR ALL TO authenticated USING (owner_id=auth.uid()) WITH CHECK (owner_id=auth.uid());
CREATE POLICY owner_all_expenses ON public.expenses FOR ALL TO authenticated USING (owner_id=auth.uid()) WITH CHECK (owner_id=auth.uid());
CREATE POLICY owner_all_notifications ON public.notifications FOR ALL TO authenticated USING (owner_id=auth.uid()) WITH CHECK (owner_id=auth.uid());
CREATE POLICY owner_all_event_types ON public.event_types FOR ALL TO authenticated USING (owner_id=auth.uid()) WITH CHECK (owner_id=auth.uid());
CREATE POLICY owner_all_booking_decorations ON public.booking_decorations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id=booking_decorations.booking_id AND b.owner_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id=booking_decorations.booking_id AND b.owner_id=auth.uid()));

CREATE SEQUENCE IF NOT EXISTS invoices_code_seq START 1000;

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid, code text UNIQUE, client_id uuid,
  customer_name text NOT NULL, customer_phone text, customer_email text, customer_address text,
  booking_id uuid,
  issue_date date NOT NULL DEFAULT CURRENT_DATE, due_date date,
  subtotal numeric NOT NULL DEFAULT 0, discount numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0, tax_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0, paid_amount numeric NOT NULL DEFAULT 0,
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  notes text,
  public_token text UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  name text NOT NULL,
  qty numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  position int NOT NULL DEFAULT 0
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_all_invoices ON public.invoices FOR ALL TO authenticated USING (owner_id=auth.uid()) WITH CHECK (owner_id=auth.uid());
CREATE POLICY owner_all_invoice_items ON public.invoice_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id=invoice_items.invoice_id AND i.owner_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id=invoice_items.invoice_id AND i.owner_id=auth.uid()));
CREATE TRIGGER set_invoice_owner BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

CREATE OR REPLACE FUNCTION public.set_invoice_code() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN IF NEW.code IS NULL THEN NEW.code := 'INV-' || nextval('invoices_code_seq')::text; END IF; RETURN NEW; END $$;
CREATE TRIGGER trg_set_invoice_code BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_invoice_code();

CREATE OR REPLACE FUNCTION public.update_invoice_payment_status() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.payment_status := CASE WHEN NEW.paid_amount<=0 THEN 'unpaid'::payment_status
  WHEN NEW.paid_amount>=NEW.total THEN 'paid'::payment_status ELSE 'partial'::payment_status END;
NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER trg_invoice_payment_status BEFORE INSERT OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_invoice_payment_status();

CREATE INDEX idx_invoices_owner ON public.invoices(owner_id);
CREATE INDEX idx_invoices_client ON public.invoices(client_id);
CREATE INDEX idx_invoice_items_inv ON public.invoice_items(invoice_id);

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('email','phone')),
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT, ip_address TEXT, user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_attempts_identifier_created ON public.login_attempts(identifier, created_at DESC);
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_insert_login_attempts" ON public.login_attempts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admins_read_login_attempts" ON public.login_attempts FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.booking_supplies (
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  supply_id uuid NOT NULL REFERENCES public.supplies(id) ON DELETE CASCADE,
  qty integer NOT NULL DEFAULT 1 CHECK (qty > 0),
  PRIMARY KEY (booking_id, supply_id)
);
ALTER TABLE public.booking_supplies ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_all_booking_supplies ON public.booking_supplies FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id=booking_supplies.booking_id AND b.owner_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id=booking_supplies.booking_id AND b.owner_id=auth.uid()));

CREATE OR REPLACE FUNCTION public.recalc_supply(sup_id uuid) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE total INT; active_used INT; remaining INT; alert INT;
BEGIN SELECT total_qty, min_alert INTO total, alert FROM public.supplies WHERE id=sup_id;
IF total IS NULL THEN RETURN; END IF;
SELECT COALESCE(SUM(bs.qty),0) INTO active_used FROM public.booking_supplies bs
  JOIN public.bookings b ON b.id=bs.booking_id
  WHERE bs.supply_id=sup_id AND b.status IN ('pending','confirmed');
remaining := total - active_used;
UPDATE public.supplies SET used_qty=active_used,
  status = CASE WHEN remaining<=0 THEN 'unavailable'::item_status
    WHEN remaining<=alert THEN 'limited'::item_status ELSE 'available'::item_status END
WHERE id=sup_id; END $$;

CREATE OR REPLACE FUNCTION public.trg_recalc_supply() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN IF TG_OP='DELETE' THEN PERFORM public.recalc_supply(OLD.supply_id); RETURN OLD;
ELSE PERFORM public.recalc_supply(NEW.supply_id);
  IF TG_OP='UPDATE' AND OLD.supply_id IS DISTINCT FROM NEW.supply_id THEN PERFORM public.recalc_supply(OLD.supply_id); END IF;
  RETURN NEW; END IF; END $$;
CREATE TRIGGER booking_supplies_recalc AFTER INSERT OR UPDATE OR DELETE ON public.booking_supplies FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_supply();

CREATE OR REPLACE FUNCTION public.trg_recalc_supplies_on_booking_status() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE r RECORD;
BEGIN IF TG_OP='UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
  FOR r IN SELECT DISTINCT supply_id FROM public.booking_supplies WHERE booking_id=NEW.id LOOP
    PERFORM public.recalc_supply(r.supply_id);
  END LOOP;
END IF; RETURN NEW; END $$;
CREATE TRIGGER bookings_recalc_supplies AFTER UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_supplies_on_booking_status();

CREATE OR REPLACE FUNCTION public.notify_booking_status_change() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE status_label text;
BEGIN IF NEW.status IS DISTINCT FROM OLD.status THEN
  status_label := CASE NEW.status::text
    WHEN 'pending' THEN 'قيد الانتظار' WHEN 'confirmed' THEN 'مؤكد'
    WHEN 'completed' THEN 'مكتمل' WHEN 'cancelled' THEN 'ملغي'
    ELSE NEW.status::text END;
  INSERT INTO public.notifications(title, body, level, kind)
  VALUES ('تحديث حالة الحجز',
    'الحجز ' || COALESCE(NEW.code,'') || ' للزبون ' || NEW.customer_name || ' أصبح: ' || status_label,
    CASE WHEN NEW.status::text='cancelled' THEN 'warning'::notif_level
         WHEN NEW.status::text='completed' THEN 'success'::notif_level
         ELSE 'info'::notif_level END,
    'booking');
END IF; RETURN NEW; END $$;
CREATE TRIGGER trg_notify_booking_status_change AFTER UPDATE OF status ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.notify_booking_status_change();

INSERT INTO public.event_types (name, label) VALUES
  ('wedding','عرس'),('engagement','خطوبة'),('birthday','عيد ميلاد'),('other','أخرى')
ON CONFLICT (name) DO NOTHING;
