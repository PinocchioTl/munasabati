
DROP POLICY IF EXISTS "anyone_insert_login_attempts" ON public.login_attempts;

CREATE OR REPLACE FUNCTION public.log_login_attempt(
  _identifier text,
  _method text,
  _success boolean,
  _error_message text,
  _user_agent text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _identifier IS NULL OR length(_identifier) = 0 OR length(_identifier) > 320 THEN RETURN; END IF;
  INSERT INTO public.login_attempts(identifier, method, success, error_message, user_agent)
  VALUES (
    left(_identifier, 320),
    left(COALESCE(_method, 'email'), 32),
    COALESCE(_success, false),
    NULLIF(left(COALESCE(_error_message, ''), 500), ''),
    NULLIF(left(COALESCE(_user_agent, ''), 500), '')
  );
END
$$;

REVOKE ALL ON FUNCTION public.log_login_attempt(text, text, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_login_attempt(text, text, boolean, text, text) TO anon, authenticated;
