
CREATE SEQUENCE IF NOT EXISTS invoices_code_seq START 1000;

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  code text UNIQUE,
  client_id uuid,
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  customer_address text,
  booking_id uuid,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  subtotal numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
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

CREATE POLICY "owner_all_invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);

CREATE POLICY "public_read_invoices_by_token" ON public.invoices
  FOR SELECT TO anon, authenticated
  USING (public_token IS NOT NULL);

CREATE POLICY "owner_all_invoice_items" ON public.invoice_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_items.invoice_id AND i.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_items.invoice_id AND i.owner_id = auth.uid()));

CREATE POLICY "public_read_invoice_items" ON public.invoice_items
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_items.invoice_id AND i.public_token IS NOT NULL));

CREATE TRIGGER set_invoice_owner BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

CREATE OR REPLACE FUNCTION public.set_invoice_code() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := 'INV-' || nextval('invoices_code_seq')::text;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_set_invoice_code BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_invoice_code();

CREATE OR REPLACE FUNCTION public.update_invoice_payment_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.payment_status := CASE
    WHEN NEW.paid_amount <= 0 THEN 'unpaid'::payment_status
    WHEN NEW.paid_amount >= NEW.total THEN 'paid'::payment_status
    ELSE 'partial'::payment_status
  END;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_invoice_payment_status BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_invoice_payment_status();

CREATE INDEX idx_invoices_owner ON public.invoices(owner_id);
CREATE INDEX idx_invoices_client ON public.invoices(client_id);
CREATE INDEX idx_invoice_items_inv ON public.invoice_items(invoice_id);
