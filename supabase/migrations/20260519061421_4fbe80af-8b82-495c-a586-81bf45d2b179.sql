
-- Add phone fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false;

-- Login attempts table for security auditing
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('email','phone')),
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier_created
  ON public.login_attempts(identifier, created_at DESC);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Anyone (even unauth) can insert their attempt log; only admins read
CREATE POLICY "anyone_insert_login_attempts"
  ON public.login_attempts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "admins_read_login_attempts"
  ON public.login_attempts FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Update handle_new_user to capture phone from metadata or auth.users.phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email, company_name, phone_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'company_name', ''),
    (NEW.phone_confirmed_at IS NOT NULL)
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    phone_verified = EXCLUDED.phone_verified OR public.profiles.phone_verified;
  RETURN NEW;
END;
$function$;
