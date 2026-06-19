import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!user) { setIsAdmin(false); setLoading(false); return; }
    setLoading(true);
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => { if (active) { setIsAdmin(!!data); setLoading(false); } });
    return () => { active = false; };
  }, [user]);

  return { isAdmin, loading };
}

export async function logAudit(action: string, entity?: string, entityId?: string, metadata?: Record<string, unknown>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.rpc("log_audit", {
    _action: action,
    _entity: entity,
    _entity_id: entityId,
    _metadata: (metadata ?? {}) as never,
  });
}

export const DEV_ADMIN_EMAIL = "admin@local.com";
