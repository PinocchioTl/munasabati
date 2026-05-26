import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import logoAsset from "@/assets/logo.png";

export const DEFAULT_LOGO = logoAsset;

export interface Branding {
  companyName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
}

const DEFAULTS: Branding = {
  companyName: "Munasabati",
  logoUrl: logoAsset,
  primaryColor: "#D4AF37",
  secondaryColor: "#111827",
  accentColor: "#2563EB",
  backgroundColor: "#F9FAFB",
};

interface Ctx {
  branding: Branding;
  loading: boolean;
  refresh: () => Promise<void>;
  save: (b: Partial<Branding>) => Promise<void>;
}

const BrandingCtx = createContext<Ctx>({
  branding: DEFAULTS,
  loading: false,
  refresh: async () => {},
  save: async () => {},
});

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [branding, setBranding] = useState<Branding>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchBranding = useCallback(async () => {
    if (!user) {
      setBranding(DEFAULTS);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("company_name, logo_url, primary_color, secondary_color, accent_color, background_color")
      .eq("id", user.id)
      .maybeSingle();
    if (data) {
      setBranding({
        companyName: data.company_name?.trim() || DEFAULTS.companyName,
        logoUrl: data.logo_url || DEFAULTS.logoUrl,
        primaryColor: data.primary_color || DEFAULTS.primaryColor,
        secondaryColor: data.secondary_color || DEFAULTS.secondaryColor,
        accentColor: data.accent_color || DEFAULTS.accentColor,
        backgroundColor: data.background_color || DEFAULTS.backgroundColor,
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchBranding(); }, [fetchBranding]);

  // Apply CSS variables + document title
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--gold", branding.primaryColor);
    root.style.setProperty("--ring", branding.primaryColor);
    root.style.setProperty("--sidebar-primary", branding.primaryColor);
    root.style.setProperty("--sidebar-ring", branding.primaryColor);
    root.style.setProperty("--primary", branding.secondaryColor);
    root.style.setProperty("--sidebar", branding.secondaryColor);
    root.style.setProperty("--info", branding.accentColor);
    root.style.setProperty("--background", branding.backgroundColor);
    document.title = `${branding.companyName} — مناسبتي`;
  }, [branding]);

  const save = useCallback(async (patch: Partial<Branding>) => {
    if (!user) throw new Error("غير مسجل الدخول");
    const next = { ...branding, ...patch };
    const { error } = await supabase.from("profiles").update({
      company_name: next.companyName,
      logo_url: next.logoUrl,
      primary_color: next.primaryColor,
      secondary_color: next.secondaryColor,
      accent_color: next.accentColor,
      background_color: next.backgroundColor,
    }).eq("id", user.id);
    if (error) throw error;
    setBranding(next);
  }, [branding, user]);

  return (
    <BrandingCtx.Provider value={{ branding, loading, refresh: fetchBranding, save }}>
      {children}
    </BrandingCtx.Provider>
  );
}

export const useBranding = () => useContext(BrandingCtx);
