
-- Harden is_admin: SECURITY DEFINER with fixed search_path
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

-- Same for has_role (consistency, used by RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Remove the redundant RESTRICTIVE policy on user_roles; the PERMISSIVE
-- admins_manage_roles already restricts writes to admins (no other write policy exists).
DROP POLICY IF EXISTS non_admins_cannot_write_roles ON public.user_roles;

-- Remove direct client INSERT into audit_log to preserve audit integrity.
DROP POLICY IF EXISTS authenticated_insert_audit ON public.audit_log;
REVOKE INSERT ON public.audit_log FROM authenticated, anon;

-- Provide a SECURITY DEFINER RPC so clients can append audit entries
-- without being able to forge user_id / user_email.
CREATE OR REPLACE FUNCTION public.log_audit(
  _action text,
  _entity text DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT email INTO uemail FROM auth.users WHERE id = uid;
  INSERT INTO public.audit_log (user_id, user_email, action, entity, entity_id, metadata)
  VALUES (uid, uemail, _action, _entity, _entity_id, COALESCE(_metadata, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.log_audit(text, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit(text, text, uuid, jsonb) TO authenticated;
