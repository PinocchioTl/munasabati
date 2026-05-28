-- Fix item-images INSERT policy to enforce folder ownership (tenant isolation)
DROP POLICY IF EXISTS "auth_insert_item_images" ON storage.objects;
CREATE POLICY "auth_insert_item_images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'item-images'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- Also tighten UPDATE/DELETE to require the user-owned folder (in addition to existing owner check)
DROP POLICY IF EXISTS "auth_update_item_images" ON storage.objects;
CREATE POLICY "auth_update_item_images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'item-images'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'item-images'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "auth_delete_item_images" ON storage.objects;
CREATE POLICY "auth_delete_item_images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'item-images'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- Defense-in-depth: explicit restrictive policy preventing non-admins from
-- writing to user_roles (blocks privilege escalation even if a future
-- permissive policy is added by mistake).
CREATE POLICY "non_admins_cannot_write_roles" ON public.user_roles
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));