
CREATE OR REPLACE FUNCTION public.set_invoice_code() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := 'INV-' || nextval('invoices_code_seq')::text;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.update_invoice_payment_status() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.payment_status := CASE
    WHEN NEW.paid_amount <= 0 THEN 'unpaid'::payment_status
    WHEN NEW.paid_amount >= NEW.total THEN 'paid'::payment_status
    ELSE 'partial'::payment_status
  END;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
