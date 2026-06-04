import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPublicOwner } from "@/lib/booking-public.functions";
import { Crown, Loader2, Sparkles, Home, Package, ShoppingBag, Phone } from "lucide-react";

export const Route = createFileRoute("/booking/$slug")({
  component: BookingShell,
});

function BookingShell() {
  const { slug } = useParams({ strict: false }) as { slug: string };
  const { data: owner, isLoading, error } = useQuery({
    queryKey: ["public-owner", slug],
    queryFn: () => getPublicOwner({ data: { slug } }),
    retry: false,
  });

  if (isLoading) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-[#FAF7F2]">
        <Loader2 className="size-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }
  if (error || !owner) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-[#FAF7F2] p-6">
        <div className="max-w-md text-center">
          <div className="size-16 mx-auto rounded-2xl bg-[#5D0A13] text-[#D4AF37] flex items-center justify-center mb-4">
            <Crown />
          </div>
          <h1 className="text-xl font-bold text-[#5D0A13]">الصفحة غير متوفرة</h1>
          <p className="text-sm text-muted-foreground mt-2">رابط الحجز غير صحيح أو تم تعطيله مؤقتاً.</p>
        </div>
      </div>
    );
  }

  const cssVars = {
    "--bk-primary": owner.secondary_color || "#5D0A13",
    "--bk-gold": owner.primary_color || "#D4AF37",
    "--bk-bg": owner.background_color || "#FAF7F2",
  } as React.CSSProperties;

  return (
    <div dir="rtl" lang="ar" style={cssVars}
      className="min-h-screen flex flex-col"
      data-bk-root
    >
      <style>{`
        [data-bk-root]{background:var(--bk-bg);color:#1a1a1a;font-family:inherit}
        [data-bk-root] .bk-primary{background:var(--bk-primary);color:#fff}
        [data-bk-root] .bk-gold{background:var(--bk-gold);color:var(--bk-primary)}
        [data-bk-root] .bk-text-primary{color:var(--bk-primary)}
        [data-bk-root] .bk-text-gold{color:var(--bk-gold)}
        [data-bk-root] .bk-border-gold{border-color:var(--bk-gold)}
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-30 bk-primary shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/booking/$slug" params={{ slug }} className="flex items-center gap-3 min-w-0 flex-1">
            <div className="size-10 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
              {owner.logo_url ? <img src={owner.logo_url} alt="" className="size-full object-contain" /> : <Crown className="bk-text-gold size-5" />}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm sm:text-base truncate">{owner.company_name || "Munasabati Booking"}</div>
              {owner.tagline && <div className="text-[10px] sm:text-xs opacity-80 truncate">{owner.tagline}</div>}
            </div>
          </Link>
          {owner.phone && (
            <a href={`tel:${owner.phone}`} className="hidden sm:flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition">
              <Phone className="size-3.5" /> {owner.phone}
            </a>
          )}
        </div>

        {/* Tabs */}
        <nav className="max-w-6xl mx-auto px-2 sm:px-4 flex gap-1 overflow-x-auto scrollbar-none border-t border-white/10">
          <TabLink slug={slug} to="/booking/$slug" icon={<Home className="size-3.5" />} label="الرئيسية" exact />
          <TabLink slug={slug} to="/booking/$slug/decorations" icon={<Sparkles className="size-3.5" />} label="الديكورات" />
          <TabLink slug={slug} to="/booking/$slug/supplies" icon={<Package className="size-3.5" />} label="المستلزمات" />
          <TabLink slug={slug} to="/booking/$slug/request" icon={<ShoppingBag className="size-3.5" />} label="طلب حجز" />
        </nav>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="bk-primary mt-12 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs opacity-80">
          <div className="font-bold">{owner.company_name}</div>
          <div className="mt-1">مدعوم بواسطة <span className="bk-text-gold font-bold">Munasabati</span></div>
        </div>
      </footer>
    </div>
  );
}

function TabLink({ slug, to, icon, label, exact }: { slug: string; to: string; icon: React.ReactNode; label: string; exact?: boolean }) {
  return (
    <Link
      to={to as any}
      params={{ slug } as any}
      activeOptions={{ exact: !!exact }}
      className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold whitespace-nowrap text-white/80 hover:text-white transition border-b-2 border-transparent [&.active]:border-[var(--bk-gold)] [&.active]:text-white"
      activeProps={{ className: "active" }}
    >
      {icon} {label}
    </Link>
  );
}