import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SectionHeader, LoadingState, EmptyState, Button } from "@/components/ui-bits";
import { useNotifications, useMarkNotificationRead, useMarkNotificationUnread, useMarkAllNotificationsRead, useDeleteNotification } from "@/lib/db";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Info, CheckCheck, Trash2, Calendar, Package, Wallet, Settings, Sparkles, Bell, ChevronLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { useMemo, useRef, useState } from "react";

// Map notification kind → source page route
const kindRoute: Record<string, string> = {
  booking: "/bookings",
  decoration: "/decorations",
  supply: "/supplies",
  profit: "/profits",
};
function getNotificationRoute(n: any): string | null {
  if (n.kind && kindRoute[n.kind]) return kindRoute[n.kind];
  return null;
}

export const Route = createFileRoute("/_main/notifications")({
  component: NotificationsPage,
});

type Tab = "all" | "unread" | "booking" | "decoration" | "supply" | "finance" | "system";

const tabs: { key: Tab; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "unread", label: "غير مقروءة" },
  { key: "booking", label: "الحجوزات" },
  { key: "decoration", label: "الديكورات" },
  { key: "supply", label: "المخزون" },
  { key: "finance", label: "المالية" },
  { key: "system", label: "النظام" },
];

// Kind → modern color + icon mapping
const kindStyle: Record<string, { icon: any; ring: string; bg: string; text: string; dot: string }> = {
  booking:    { icon: Calendar,  ring: "ring-blue-500/20",    bg: "bg-blue-500/10",    text: "text-blue-500",    dot: "bg-blue-500" },
  decoration: { icon: Sparkles,  ring: "ring-violet-500/20",  bg: "bg-violet-500/10",  text: "text-violet-500",  dot: "bg-violet-500" },
  supply:     { icon: Package,   ring: "ring-orange-500/20",  bg: "bg-orange-500/10",  text: "text-orange-500",  dot: "bg-orange-500" },
  profit:     { icon: Wallet,    ring: "ring-emerald-500/20", bg: "bg-emerald-500/10", text: "text-emerald-500", dot: "bg-emerald-500" },
  system:     { icon: Settings,  ring: "ring-muted-foreground/20", bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

function getKindStyle(kind?: string | null, level?: string) {
  if (kind && kindStyle[kind]) return kindStyle[kind];
  if (level === "warning") return { icon: AlertTriangle, ring: "ring-amber-500/20", bg: "bg-amber-500/10", text: "text-amber-500", dot: "bg-amber-500" };
  if (level === "error")   return { icon: AlertTriangle, ring: "ring-red-500/20", bg: "bg-red-500/10", text: "text-red-500", dot: "bg-red-500" };
  if (level === "success") return { icon: CheckCircle2, ring: "ring-emerald-500/20", bg: "bg-emerald-500/10", text: "text-emerald-500", dot: "bg-emerald-500" };
  return kindStyle.system;
}

function matchesTab(n: any, tab: Tab) {
  if (tab === "all") return true;
  if (tab === "unread") return !n.is_read;
  if (tab === "finance") return n.kind === "profit";
  if (tab === "system") return !n.kind || !["booking", "decoration", "supply", "profit"].includes(n.kind);
  return n.kind === tab;
}

function NotificationsPage() {
  const { data: notifications = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markUnread = useMarkNotificationUnread();
  const markAll = useMarkAllNotificationsRead();
  const del = useDeleteNotification();
  const [tab, setTab] = useState<Tab>("all");

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: 0, unread: 0, booking: 0, decoration: 0, supply: 0, finance: 0, system: 0 };
    notifications.forEach(n => {
      tabs.forEach(t => { if (matchesTab(n, t.key)) c[t.key]++; });
    });
    return c;
  }, [notifications]);

  const filtered = useMemo(() => notifications.filter(n => matchesTab(n, tab)), [notifications, tab]);
  const unread = counts.unread;
  const navigate = useNavigate();
  const openNotification = (n: any) => {
    const route = getNotificationRoute(n);
    const wasUnread = !n.is_read;
    if (wasUnread) {
      markRead.mutate(n.id);
      toast.success("تم تعليم الإشعار كمقروء", {
        action: {
          label: "تراجع",
          onClick: () => markUnread.mutate(n.id),
        },
        duration: 5000,
      });
    }
    if (route) navigate({ to: route });
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <SectionHeader
        title="الإشعارات"
        subtitle={unread > 0 ? `لديك ${unread} إشعار غير مقروء` : "لا توجد إشعارات جديدة"}
        action={unread > 0 ? (
          <Button variant="outline" size="sm" onClick={() => markAll.mutate()} loading={markAll.isPending}>
            <CheckCheck className="size-4" />تعليم الكل
          </Button>
        ) : undefined}
      />

      {/* Modern segmented tabs */}
      <div className="sticky top-14 sm:top-16 z-20 -mx-3 sm:mx-0 px-3 sm:px-0 py-2 bg-background/85 backdrop-blur-xl">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {tabs.map(t => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
                }`}
              >
                {t.label}
                {counts[t.key] > 0 && (
                  <span className={`text-[10px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center ${
                    active ? "bg-background/20 text-background" : "bg-background text-foreground"
                  }`}>
                    {counts[t.key]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <LoadingState rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="لا توجد إشعارات"
          description="عند وصول إشعارات جديدة ستظهر هنا"
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((n, idx) => (
            <NotificationCard
              key={n.id}
              notification={n}
              index={idx}
              onRead={() => markRead.mutate(n.id)}
              onDelete={() => del.mutate(n.id)}
              onOpen={() => openNotification(n)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationCard({ notification: n, index, onRead, onDelete, onOpen }: any) {
  const style = getKindStyle(n.kind, n.level);
  const Icon = style.icon;
  const time = formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ar });
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);
  const moved = useRef(false);
  const hasRoute = !!getNotificationRoute(n);

  const onTouchStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; moved.current = false; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (Math.abs(dx) > 6) moved.current = true;
    setDragX(Math.max(-20, Math.min(140, dx)));
  };
  const onTouchEnd = () => {
    if (dragX > 90) {
      onDelete();
    } else if (dragX < -60 && !n.is_read) {
      onRead();
    }
    setDragX(0);
    startX.current = null;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (moved.current) { moved.current = false; return; }
    // Don't trigger when clicking inner action buttons
    if ((e.target as HTMLElement).closest("button")) return;
    onOpen?.();
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Swipe action backgrounds */}
      {dragX > 10 && (
        <div className="absolute inset-0 flex items-center justify-start pl-6 bg-destructive/90 text-destructive-foreground rounded-2xl">
          <Trash2 className="size-5" />
        </div>
      )}
      {dragX < -10 && !n.is_read && (
        <div className="absolute inset-0 flex items-center justify-end pr-6 bg-emerald-500/90 text-white rounded-2xl">
          <CheckCheck className="size-5" />
        </div>
      )}

      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={handleClick}
        role={hasRoute ? "button" : undefined}
        tabIndex={hasRoute ? 0 : undefined}
        onKeyDown={(e) => { if (hasRoute && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onOpen?.(); } }}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragX === 0 ? "transform 0.25s ease" : "none",
          animationDelay: `${Math.min(index * 30, 300)}ms`,
        }}
        className={`group relative bg-card border border-border rounded-2xl p-4 sm:p-5 hover:shadow-md hover:border-border/80 transition-all animate-fade-in ${hasRoute ? "cursor-pointer" : ""} ${
          !n.is_read ? "bg-card" : "bg-card/60"
        }`}
      >
        <div className="flex gap-3 sm:gap-4">
          {/* Icon */}
          <div className={`size-10 sm:size-11 rounded-xl flex items-center justify-center shrink-0 ring-1 ${style.bg} ${style.text} ${style.ring}`}>
            <Icon className="size-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className={`text-sm sm:text-[15px] truncate ${!n.is_read ? "font-bold text-foreground" : "font-semibold text-foreground/80"}`}>
                  {n.title}
                </h3>
                {!n.is_read && <span className={`size-2 rounded-full shrink-0 ${style.dot}`} />}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] text-muted-foreground/70 whitespace-nowrap">{time}</span>
                {hasRoute && <ChevronLeft className="size-4 text-muted-foreground/60 group-hover:text-foreground transition" />}
              </div>
            </div>

            {n.body && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                {n.body}
              </p>
            )}

            {/* Desktop actions */}
            <div className="hidden sm:flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {!n.is_read && (
                <button
                  onClick={onRead}
                  className="text-[11px] font-semibold text-muted-foreground hover:text-emerald-600 px-2 py-1 rounded-md hover:bg-emerald-500/10 transition flex items-center gap-1"
                >
                  <CheckCheck className="size-3" />
                  تعليم كمقروء
                </button>
              )}
              <button
                onClick={() => { if (confirm("حذف هذا الإشعار؟")) onDelete(); }}
                className="text-[11px] font-semibold text-muted-foreground hover:text-destructive px-2 py-1 rounded-md hover:bg-destructive/10 transition flex items-center gap-1"
              >
                <Trash2 className="size-3" />
                حذف
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
