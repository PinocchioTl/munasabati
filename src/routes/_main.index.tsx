import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Card, SectionHeader, StatusBadge, Button, LoadingState } from "@/components/ui-bits";
import { BookingDialog } from "@/components/BookingDialog";
import { useBookings, useDecorations, useSupplies, useNotifications, formatSAR, eventTypeLabels } from "@/lib/db";
import { TrendingUp, CalendarDays, Wallet, AlertTriangle, ArrowUpRight, Sparkles, Crown, Trophy, Users, Flame } from "lucide-react";
import { DemoModePanel } from "@/components/DemoModePanel";
import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart } from "recharts";

export const Route = createFileRoute("/_main/")({
  component: Dashboard,
});

const arabicMonths = ["ينا","فبر","مار","أبر","ماي","يون","يول","أغس","سبت","أكت","نوف","ديس"];

function Dashboard() {
  const [open, setOpen] = useState(false);
  const { data: bookings = [], isLoading: lb } = useBookings();
  const { data: decorations = [] } = useDecorations();
  const { data: supplies = [] } = useSupplies();
  const { data: notifications = [] } = useNotifications();

  const insights = useMemo(() => {
    const monthly: Record<string, { revenue: number; profit: number; bookings: number }> = {};
    bookings.forEach(b => {
      if (b.status === "cancelled") return;
      const m = b.event_date.slice(0, 7);
      monthly[m] ??= { revenue: 0, profit: 0, bookings: 0 };
      monthly[m].revenue += +b.total_price;
      monthly[m].profit += +b.net_profit;
      monthly[m].bookings += 1;
    });
    const monthlyArr = Object.entries(monthly).sort().map(([k,v]) => ({
      month: arabicMonths[+k.slice(5,7)-1], ...v,
    }));

    const pendingPayments = bookings.reduce((s, b) => s + +b.remaining, 0);
    const lowStock = supplies.filter(s => (s.total_qty - s.used_qty) <= s.min_alert).length;

    // Busiest day
    const dayCount: Record<string, number> = {};
    bookings.forEach(b => { dayCount[b.event_date] = (dayCount[b.event_date] || 0) + 1; });
    const busiest = Object.entries(dayCount).sort((a,b) => b[1]-a[1])[0];

    // Top customer
    const custMap: Record<string, { name: string; total: number; count: number }> = {};
    bookings.forEach(b => {
      const k = b.customer_name;
      custMap[k] ??= { name: k, total: 0, count: 0 };
      custMap[k].total += +b.total_price;
      custMap[k].count += 1;
    });
    const topCustomer = Object.values(custMap).sort((a,b) => b.total - a.total)[0];

    // Top decoration
    const decCount: Record<string, number> = {};
    bookings.forEach(b => b.booking_decorations?.forEach(bd => {
      decCount[bd.decoration_id] = (decCount[bd.decoration_id] || 0) + bd.qty;
    }));
    const topDec = Object.entries(decCount).sort((a,b) => b[1]-a[1])[0];
    const topDecObj = topDec ? decorations.find(d => d.id === topDec[0]) : null;

    // Best month
    const bestMonth = monthlyArr.slice().sort((a,b) => b.profit - a.profit)[0];

    const currentMonth = new Date().toISOString().slice(0,7);
    const thisMonthRevenue = monthly[currentMonth]?.revenue || monthlyArr.at(-1)?.revenue || 0;
    const next7Days = bookings.filter(b => {
      const d = new Date(b.event_date), now = new Date();
      const diff = (d.getTime() - now.getTime()) / 86400000;
      return diff >= 0 && diff <= 7;
    });

    return { monthlyArr, pendingPayments, lowStock, busiest, topCustomer, topDec, topDecObj, bestMonth, thisMonthRevenue, next7Days };
  }, [bookings, supplies, decorations]);

  const stats = [
    { label: "إجمالي الحجوزات", value: bookings.length, sub: `${bookings.filter(b => b.status === "confirmed").length} مؤكدة`, icon: CalendarDays, accent: "info" },
    { label: "مناسبات الأسبوع", value: insights.next7Days.length, sub: "خلال 7 أيام", icon: Sparkles, accent: "gold" },
    { label: "الدخل هذا الشهر", value: formatSAR(insights.thisMonthRevenue), sub: "محسوب تلقائياً", icon: Wallet, accent: "success" },
    { label: "مدفوعات معلقة", value: formatSAR(insights.pendingPayments), sub: `${bookings.filter(b => +b.remaining > 0).length} حجوزات`, icon: AlertTriangle, accent: "warning" },
  ];

  const accentMap: Record<string, string> = {
    info: "from-info/10 to-info/0 text-info",
    gold: "from-gold/15 to-gold/0 text-gold",
    success: "from-success/10 to-success/0 text-success",
    warning: "from-warning/15 to-warning/0 text-warning",
  };

  return (
    <div className="space-y-4 lg:space-y-8 animate-slide-up">
      <div className="hidden lg:block">
        <SectionHeader
          title="لوحة التحكم"
          subtitle="نظرة شاملة وذكية على أعمالك — تُحدّث تلقائياً"
          action={<Button variant="gold" onClick={() => setOpen(true)}><Sparkles className="size-4" />حجز جديد</Button>}
        />
      </div>
      <div className="lg:hidden flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight truncate">لوحة التحكم</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">نظرة شاملة • تُحدّث تلقائياً</p>
        </div>
        <Button variant="gold" size="sm" onClick={() => setOpen(true)} className="shrink-0"><Sparkles className="size-4" />جديد</Button>
      </div>

      <DemoModePanel />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-3 lg:p-5 relative overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-bl ${accentMap[s.accent]} opacity-60 pointer-events-none`} />
            <div className="relative">
              <div className="flex items-start justify-between">
                <div className={`size-8 lg:size-10 rounded-xl bg-card border border-border flex items-center justify-center ${accentMap[s.accent].split(" ").pop()}`}>
                  <s.icon className="size-4 lg:size-[18px]" />
                </div>
                <ArrowUpRight className="size-3.5 lg:size-4 text-muted-foreground" />
              </div>
              <div className="mt-2 lg:mt-4 text-lg lg:text-3xl font-bold tracking-tight truncate">{s.value}</div>
              <div className="text-[11px] lg:text-xs text-muted-foreground mt-1 truncate">{s.label}</div>
              <div className="hidden lg:flex text-[11px] text-muted-foreground/80 mt-2 items-center gap-1">
                <TrendingUp className="size-3" /> {s.sub}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Smart insights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <InsightCard icon={Flame} color="text-destructive bg-destructive/10" label="أكثر يوم ازدحاماً"
          value={insights.busiest ? insights.busiest[0] : "—"}
          sub={insights.busiest ? `${insights.busiest[1]} مناسبات` : "لا بيانات"} />
        <InsightCard icon={Users} color="text-info bg-info/10" label="أكثر زبون نشاطاً"
          value={insights.topCustomer?.name || "—"}
          sub={insights.topCustomer ? `${insights.topCustomer.count} حجوزات • ${formatSAR(insights.topCustomer.total)}` : ""} />
        <InsightCard icon={Crown} color="text-gold bg-gold/10" label="أكثر ديكور طلباً"
          value={insights.topDecObj?.name || "—"}
          sub={insights.topDec ? `${insights.topDec[1]} مرة` : ""} />
        <InsightCard icon={Trophy} color="text-success bg-success/10" label="أعلى شهر ربحاً"
          value={insights.bestMonth?.month || "—"}
          sub={insights.bestMonth ? formatSAR(insights.bestMonth.profit) : ""} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
        <Card className="p-4 lg:p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-sm text-muted-foreground">الدخل والأرباح</div>
              <div className="text-base lg:text-xl font-bold mt-1">تطور الإيرادات الشهرية</div>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-info" />الدخل</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-gold" />الأرباح</span>
            </div>
          </div>
          <div className="h-52 lg:h-64 -mx-2">
            {insights.monthlyArr.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">لا توجد بيانات بعد</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={insights.monthlyArr}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--info)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--info)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="prof" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} reversed />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} orientation="right" />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                  <Area type="monotone" dataKey="revenue" stroke="var(--info)" strokeWidth={2.5} fill="url(#rev)" />
                  <Area type="monotone" dataKey="profit" stroke="var(--gold)" strokeWidth={2.5} fill="url(#prof)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-5">
            <div className="text-sm text-muted-foreground">الأكثر طلباً</div>
            <div className="text-xl font-bold mt-1">أفضل الديكورات</div>
          </div>
          <div className="space-y-3">
            {[...decorations].sort((a,b) => b.bookings_count - a.bookings_count).slice(0, 5).map(d => {
              const pct = Math.round((d.booked_qty / Math.max(d.total_qty,1)) * 100);
              return (
                <div key={d.id}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="flex items-center gap-2">
                      <span className="text-lg">{d.images?.[0] || "🎀"}</span>
                      <span className="font-medium truncate">{d.name}</span>
                    </span>
                    <span className="text-xs font-bold text-muted-foreground">{d.bookings_count}</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-gold rounded-full transition-all" style={{ width: `${Math.max(pct, 6)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
        <Card className="p-4 lg:p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-sm text-muted-foreground">آخر النشاطات</div>
              <div className="text-base lg:text-xl font-bold mt-1">الحجوزات الأخيرة</div>
            </div>
            <Link to="/bookings" className="text-xs font-semibold text-info hover:underline">عرض الكل</Link>
          </div>
          {lb ? <LoadingState rows={4} /> : (
            <div className="divide-y divide-border">
              {bookings.slice(0, 5).map(b => (
                <div key={b.id} className="flex items-center gap-3 py-3.5">
                  <div className="size-11 rounded-xl bg-gradient-luxury text-gold flex items-center justify-center font-bold text-xs shrink-0">
                    {b.code?.split("-")[1] || "•"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">{b.customer_name}</span>
                      {+b.total_price >= 30000 && <Crown className="size-3.5 text-gold" />}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>{eventTypeLabels[b.event_type]}</span>
                      <span>•</span><span>{b.event_date}</span>
                      <span>•</span><span>{b.start_time?.slice(0,5)}</span>
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <div className="text-sm font-bold">{formatSAR(+b.total_price)}</div>
                    <StatusBadge status={b.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="mb-5">
            <div className="text-sm text-muted-foreground">مركز التنبيهات</div>
            <div className="text-xl font-bold mt-1">إشعارات مهمة</div>
          </div>
          <div className="space-y-3">
            {notifications.slice(0, 5).map(n => {
              const color = n.level === "warning" ? "text-warning bg-warning/10"
                : n.level === "success" ? "text-success bg-success/10"
                : n.level === "error" ? "text-destructive bg-destructive/10"
                : "text-info bg-info/10";
              return (
                <div key={n.id} className="flex gap-3">
                  <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                    <AlertTriangle className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{n.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</div>
                  </div>
                </div>
              );
            })}
            {notifications.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-8">لا توجد إشعارات بعد</div>
            )}
          </div>
        </Card>
      </div>

      <BookingDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function InsightCard({ icon: Icon, color, label, value, sub }: any) {
  return (
    <Card className="p-5">
      <div className={`size-10 rounded-xl flex items-center justify-center ${color}`}><Icon className="size-[18px]" /></div>
      <div className="text-[11px] text-muted-foreground mt-3">{label}</div>
      <div className="text-base font-bold mt-1 truncate">{value}</div>
      <div className="text-[11px] text-muted-foreground/80 mt-1">{sub}</div>
    </Card>
  );
}
