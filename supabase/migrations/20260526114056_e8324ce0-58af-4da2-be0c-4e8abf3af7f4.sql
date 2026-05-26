
ALTER VIEW public.monthly_revenue SET (security_invoker = true);
ALTER VIEW public.top_decorations SET (security_invoker = true);

ALTER FUNCTION public.decoration_available(public.decorations) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_owner_id() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;

DROP POLICY IF EXISTS "Public read branding" ON storage.objects;
CREATE POLICY "Public read branding"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'branding' AND (storage.foldername(name))[1] IS NOT NULL);

DROP POLICY IF EXISTS "public_read_item_images" ON storage.objects;
CREATE POLICY "public_read_item_images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'item-images' AND name IS NOT NULL);
