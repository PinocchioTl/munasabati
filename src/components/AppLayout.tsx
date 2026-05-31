import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, CalendarDays, CalendarRange, Sparkles, Package,
  Users, Wallet, Bell, BarChart3, Settings, Search, Plus, Crown, LogOut,
  MoreHorizontal, X,
} from "lucide-react";
import { useState } from "react";
import { useNotifications } from "@/lib/db";
import { useAuth, signOut } from "@/lib/auth";
import { useBranding } from "@/lib/branding";

// Primary navigation — matches user-requested sidebar order
const navItems = [
  { to: "/", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/bookings", label: "الحجوزات", icon: CalendarDays },
  { to: "/decorations", label: "الديكورات", icon: Sparkles },
  { to: "/supplies", label: "المستلزمات", icon: Package },
  { to: "/customers", label: "الزبائن", icon: Users },
  { to: "/profits", label: "الأرباح", icon: Wallet },
  { to: "/notifications", label: "الإشعارات", icon: Bell },
  { to: "/settings", label: "الإعدادات", icon: Settings },
];

// Secondary nav — accessible from sidebar (bottom group) and mobile "More" sheet
const secondaryItems = [
  { to: "/calendar", label: "التقويم", icon: CalendarRange },
  { to: "/analytics", label: "الإحصائيات", icon: BarChart3 },
];

// Mobile bottom-nav primary items (4 + More) — most-used daily actions
const mobilePrimary = ["/", "/bookings", "/decorations", "/customers"];


const quickActions = [
  { to: "/bookings", label: "حجز جديد", icon: CalendarDays },
  { to: "/decorations", label: "ديكور جديد", icon: Sparkles },
  { to: "/supplies", label: "مستلزم جديد", icon: Package },
  { to: "/customers", label: "زبون جديد", icon: Users },
];

export function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: notifications = [] } = useNotifications();
  const unread = notifications.filter((n) => !n.is_read).length;
  const { branding } = useBranding();
  const [moreOpen, setMoreOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const navigate = useNavigate();

  const moreItems = [...navItems.filter((i) => !mobilePrimary.includes(i.to)), ...secondaryItems];

  return (
    <div className="min-h-screen bg-background flex w-full" dir="rtl">
      {/* Sidebar - desktop (lg+) full, tablet (md) compact icons */}
      <aside className="hidden md:flex md:w-20 lg:w-72 shrink-0 flex-col bg-gradient-luxury text-sidebar-foreground sticky top-0 h-screen border-l border-sidebar-border">
        <div className="px-3 lg:px-6 py-5 lg:py-7 border-b border-sidebar-border/60">
          <div className="flex items-center gap-3 justify-center lg:justify-start">
            <div className="size-11 rounded-2xl bg-gradient-gold flex items-center justify-center shadow-gold overflow-hidden shrink-0">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt={branding.companyName} className="size-full object-contain" />
              ) : (
                <Crown className="size-5 text-primary" />
              )}
            </div>
            <div className="min-w-0 hidden lg:block">
              <div className="text-base font-bold text-gradient-gold truncate">{branding.companyName}</div>
              <div className="text-[11px] text-sidebar-foreground/60">نظم ديكوراتك بسهولة</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 lg:px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                className={`flex items-center gap-3 px-3 lg:px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group relative justify-center lg:justify-start ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                }`}
              >
                {active && <span className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-l-full bg-gold" />}
                <Icon className={`size-[18px] shrink-0 transition-transform group-hover:scale-110 ${active ? "text-gold" : ""}`} />
                <span className="flex-1 hidden lg:inline">{item.label}</span>
                {item.to === "/notifications" && unread > 0 && (
                  <span className="hidden lg:inline text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="hidden lg:block px-3 pt-5 pb-2 text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold">
            المزيد
          </div>
          <div className="hidden lg:block h-px bg-sidebar-border/60 mx-3 mb-2 lg:hidden" />
          {secondaryItems.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                className={`flex items-center gap-3 px-3 lg:px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group relative justify-center lg:justify-start ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                }`}
              >
                {active && <span className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-l-full bg-gold" />}
                <Icon className={`size-[18px] shrink-0 transition-transform group-hover:scale-110 ${active ? "text-gold" : ""}`} />
                <span className="flex-1 hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <UserCard />

      </aside>


      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 glass border-b border-border/60">
          <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 lg:px-8 h-14 sm:h-16">
            <div className="md:hidden flex items-center gap-2 min-w-0">
              <div className="size-9 rounded-xl bg-gradient-gold flex items-center justify-center overflow-hidden shrink-0">
                {branding.logoUrl ? (
                  <img src={branding.logoUrl} alt={branding.companyName} className="size-full object-contain" />
                ) : (
                  <Crown className="size-4 text-primary" />
                )}
              </div>
              <span className="font-bold text-sm truncate">{branding.companyName}</span>
            </div>

            <div className="hidden md:flex flex-1 max-w-md relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                placeholder="بحث عن حجز، زبون، ديكور..."
                className="w-full bg-secondary/60 border border-transparent focus:border-ring focus:bg-card rounded-xl pr-10 pl-4 py-2.5 text-sm outline-none transition"
              />
            </div>
            <div className="flex-1 md:hidden" />

            <Link to="/notifications" className="relative size-9 sm:size-10 rounded-xl hover:bg-secondary flex items-center justify-center transition">
              <Bell className="size-[18px]" />
              {unread > 0 && (
                <span className="absolute top-2 left-2 size-2 rounded-full bg-destructive ring-2 ring-background" />
              )}
            </Link>

            <button
              onClick={() => navigate({ to: "/bookings" })}
              className="hidden sm:inline-flex items-center gap-2 bg-primary text-primary-foreground hover:opacity-90 transition rounded-xl px-3 lg:px-4 py-2 lg:py-2.5 text-sm font-semibold shadow-elegant"
            >
              <Plus className="size-4" />
              <span className="hidden lg:inline">حجز جديد</span>
            </button>
          </div>
        </header>

        <div className="flex-1 min-w-0 max-w-full overflow-x-hidden px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 pb-28 md:pb-8 animate-fade-in">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav (hidden on md+) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-border/60 safe-area-inset">
        <div className="grid grid-cols-5 px-1 py-1.5">
          {mobilePrimary.map((to) => {
            const item = navItems.find((n) => n.to === to)!;
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to}
                className={`relative flex flex-col items-center gap-1 py-2 mx-0.5 rounded-xl text-[10px] font-medium transition-all active:scale-95 ${
                  active ? "text-gold bg-gold/10" : "text-muted-foreground hover:text-foreground"
                }`}>
                {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-8 rounded-b-full bg-gold" />}
                <Icon className={`size-[20px] transition-transform ${active ? "scale-110" : ""}`} />
                <span>{item.label}</span>
                {item.to === "/notifications" && unread > 0 && (
                  <span className="absolute top-1 right-3 size-2 rounded-full bg-destructive ring-2 ring-card" />
                )}
              </Link>
            );
          })}
          <button onClick={() => setMoreOpen(true)}
            className={`relative flex flex-col items-center gap-1 py-2 mx-0.5 rounded-xl text-[10px] font-medium transition-all active:scale-95 ${
              moreOpen ? "text-gold bg-gold/10" : "text-muted-foreground hover:text-foreground"
            }`}>
            <MoreHorizontal className="size-[20px]" />
            <span>المزيد</span>
            {unread > 0 && !mobilePrimary.includes("/notifications") && (
              <span className="absolute top-1 right-3 size-2 rounded-full bg-destructive ring-2 ring-card" />
            )}
          </button>
        </div>
      </nav>


      {/* Floating action button - mobile */}
      <div className="md:hidden">
        {fabOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setFabOpen(false)} />
            <div className="fixed bottom-36 left-4 z-50 flex flex-col gap-2 items-start">
              {quickActions.map((a) => {
                const Icon = a.icon;
                return (
                  <button key={a.to}
                    onClick={() => { setFabOpen(false); navigate({ to: a.to }); }}
                    className="flex items-center gap-3 bg-card text-foreground rounded-2xl pr-3 pl-4 py-2.5 shadow-elegant text-sm font-semibold border border-border">
                    <span className="size-9 rounded-xl bg-gradient-gold text-primary flex items-center justify-center">
                      <Icon className="size-4" />
                    </span>
                    {a.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <button
          onClick={() => setFabOpen((v) => !v)}
          className="fixed bottom-20 left-4 z-50 size-14 rounded-2xl bg-gradient-gold text-primary shadow-gold flex items-center justify-center active:scale-95 transition"
          aria-label="إضافة"
        >
          {fabOpen ? <X className="size-6" /> : <Plus className="size-6" />}
        </button>
      </div>

      {/* "More" bottom sheet */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-card rounded-t-3xl border-t border-border p-4 pb-8 animate-slide-up">
            <div className="mx-auto w-12 h-1.5 rounded-full bg-muted mb-4" />
            <div className="grid grid-cols-3 gap-3">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.to);
                return (
                  <Link key={item.to} to={item.to} onClick={() => setMoreOpen(false)}
                    className={`flex flex-col items-center justify-center gap-2 py-4 rounded-2xl border transition ${
                      active ? "border-gold/40 bg-gold/10 text-gold" : "border-border bg-secondary/40 text-foreground"
                    }`}>
                    <Icon className="size-5" />
                    <span className="text-xs font-medium">{item.label}</span>
                    {item.to === "/notifications" && unread > 0 && (
                      <span className="text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5">
                        {unread}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
            <button onClick={() => { setMoreOpen(false); signOut(); }}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-destructive/30 text-destructive font-semibold">
              <LogOut className="size-4" />
              تسجيل الخروج
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UserCard() {
  const { user } = useAuth();
  const name = (user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || "مستخدم";
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="p-3 lg:p-4 border-t border-sidebar-border/60">
      <div className="rounded-2xl bg-sidebar-accent/40 p-2 lg:p-3 backdrop-blur flex items-center gap-3 justify-center lg:justify-start">
        <div className="size-10 rounded-full bg-gradient-gold flex items-center justify-center text-primary font-bold shrink-0">
          {initial}
        </div>
        <div className="min-w-0 flex-1 hidden lg:block">
          <div className="text-sm font-semibold truncate">{name}</div>
          <div className="text-[11px] text-sidebar-foreground/60 truncate">{user?.email}</div>
        </div>
        <button onClick={() => signOut()} title="تسجيل الخروج"
          className="hidden lg:flex size-9 rounded-xl hover:bg-destructive/20 text-sidebar-foreground/70 hover:text-destructive items-center justify-center transition shrink-0">
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );
}
