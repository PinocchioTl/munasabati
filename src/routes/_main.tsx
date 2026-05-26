import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { OnboardingWelcome } from "@/components/OnboardingWelcome";
import { BrandingProvider } from "@/lib/branding";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_main")({
  component: GuardedLayout,
});

function GuardedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <BrandingProvider>
      <AppLayout />
      <OnboardingWelcome />
    </BrandingProvider>
  );
}
