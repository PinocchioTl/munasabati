
-- 1. إصلاح RLS على الفواتير: السماح فقط لمن يملك التوكن (عبر header)
DROP POLICY IF EXISTS public_read_invoices_by_token ON public.invoices;
DROP POLICY IF EXISTS public_read_invoice_items ON public.invoice_items;

-- إنشاء دالة آمنة للقراءة بالتوكن (تستخدم من server route فقط مع supabaseAdmin)
-- لا نُعيد إنشاء policy عامة. القراءة العامة تتم عبر createServerFn + supabaseAdmin مع تحقق من التوكن.

-- 2. إصلاح RLS WITH CHECK لمنع إدخال صفوف بدون owner
DROP POLICY IF EXISTS owner_all_bookings ON public.bookings;
CREATE POLICY owner_all_bookings ON public.bookings FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS owner_all_clients ON public.clients;
CREATE POLICY owner_all_clients ON public.clients FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS owner_all_decorations ON public.decorations;
CREATE POLICY owner_all_decorations ON public.decorations FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS owner_all_supplies ON public.supplies;
CREATE POLICY owner_all_supplies ON public.supplies FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS owner_all_expenses ON public.expenses;
CREATE POLICY owner_all_expenses ON public.expenses FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS owner_all_notifications ON public.notifications;
CREATE POLICY owner_all_notifications ON public.notifications FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS owner_all_event_types ON public.event_types;
CREATE POLICY owner_all_event_types ON public.event_types FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS owner_all_invoices ON public.invoices;
CREATE POLICY owner_all_invoices ON public.invoices FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- 3. إصلاح storage policies على item-images: السماح فقط للمستخدمين المسجلين
DROP POLICY IF EXISTS public_write_item_images ON storage.objects;
DROP POLICY IF EXISTS public_update_item_images ON storage.objects;
DROP POLICY IF EXISTS public_delete_item_images ON storage.objects;

CREATE POLICY auth_insert_item_images ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'item-images');
CREATE POLICY auth_update_item_images ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'item-images' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'item-images' AND owner = auth.uid());
CREATE POLICY auth_delete_item_images ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'item-images' AND owner = auth.uid());

-- 4. إصلاح search_path على جميع الدوال
ALTER FUNCTION public.update_payment_status() SET search_path = public;
ALTER FUNCTION public.update_supply_status() SET search_path = public;
ALTER FUNCTION public.notify_new_booking() SET search_path = public;
ALTER FUNCTION public.set_booking_code() SET search_path = public;
ALTER FUNCTION public.decoration_available(decorations) SET search_path = public;
ALTER FUNCTION public.recalc_client(uuid) SET search_path = public;
ALTER FUNCTION public.check_booking_conflicts() SET search_path = public;
ALTER FUNCTION public.trg_recalc_decoration() SET search_path = public;
ALTER FUNCTION public.trg_recalc_client() SET search_path = public;
ALTER FUNCTION public.notify_booking_status_change() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.recalc_decoration(uuid) SET search_path = public;
ALTER FUNCTION public.set_owner_id() SET search_path = public;
