import { createFileRoute } from "@tanstack/react-router";
import { Card, SectionHeader, LoadingState, EmptyState } from "@/components/ui-bits";
import { useBookings, useDecorations, useClients, formatSAR, eventTypeLabels, type EventType } from "@/lib/db";
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, BarChart, Bar, AreaChart, Area,
} from "recharts";
import { useMemo, useState } from "react";
import {
  TrendingUp, TrendingDown, CalendarDays, Wallet, Users, Sparkles,
  Crown, AlertTriangle, Flame, Package, BarChart3, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

export const Route = createFileRoute("/_main/analytics")({
  component: AnalyticsPage,
});

const arMonths = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const arMonthsShort = ["ينا","فبر","مار","أبر","ماي","يون","يول","أغس","سبت","أكت","نوف","ديس"];
const arDays = ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];

type RangeFilter = "month" | "quarter" | "year" | "all";
type TypeFilter = "all" | EventType;

const CHART_COLORS = {
  gold: "#D4AF37",
  blue: "#2563EB",
  green: "#10B981",
  red: "#EF4444",
  purple: "#8B5CF6",
  orange: "#F97316",
};
const PIE_COLORS = [CHART_COLORS.gold, CHART_COLORS.blue, CHART_COLORS.green, CHART_COLORS.purple, CHART_COLORS.orange, CHART_COLORS.red];

function AnalyticsPage() {
  const { data: bookings = [], isLoading } = useBookings();
  const { data: decorations = [] } = useDecorations();
  const { data: clients = [] } = useClients();

  const [range, setRange] = useState<RangeFilter>("year");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  // ===== Filter bookings =====
  const filtered = useMemo(() => {
    const now = new Date();
    return bookings.filter(b => {
      if (typeFilter !== "all" && b.event_type !== typeFilter) return false;
      const d = new Date(b.event_date);
      if (range === "month") {
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      } else if (range === "quarter") {
        const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
        return diff >= 0 && diff < 3;
      } else if (range === "year") {
        return d.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [bookings, range, typeFilter]);

  // ===== KPI calculations (respect filters) =====
  const kpi = useMemo(() => {
    const now = new Date();
    // For growth comparison: split filtered into current-period vs previous equivalent
    const thisMonth = filtered.filter(b => {
      const d = new Date(b.event_date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = bookings.filter(b => {
      if (typeFilter !== "all" && b.event_type !== typeFilter) return false;
      const d = new Date(b.event_date);
      return d.getFullYear() === lastMonthDate.getFullYear() && d.getMonth() === lastMonthDate.getMonth();
    });

    const revenue = filtered.reduce((s, b) => s + +b.total_price, 0);
    const profit = filtered.reduce((s, b) => s + (+b.net_profit || 0), 0);
    const revThis = thisMonth.reduce((s, b) => s + +b.total_price, 0);
    const revLast = lastMonth.reduce((s, b) => s + +b.total_price, 0);
    const profitThis = thisMonth.reduce((s, b) => s + (+b.net_profit || 0), 0);
    const profitLast = lastMonth.reduce((s, b) => s + (+b.net_profit || 0), 0);

    const revGrowth = revLast > 0 ? Math.round(((revThis - revLast) / revLast) * 100) : (revThis > 0 ? 100 : 0);
    const profitGrowth = profitLast > 0 ? Math.round(((profitThis - profitLast) / profitLast) * 100) : (profitThis > 0 ? 100 : 0);
    const upcoming = filtered.filter(b => new Date(b.event_date) >= now && b.status !== "cancelled").length;

    return {
      totalBookings: filtered.length,
      bookingsGrowth: lastMonth.length > 0 ? Math.round(((thisMonth.length - lastMonth.length) / lastMonth.length) * 100) : 0,
      revenue, revGrowth,
      profit, profitGrowth,
      clientsCount: clients.length,
      newClients: clients.filter(c => c.events_count === 1).length,
      upcoming,
    };
  }, [filtered, bookings, clients, typeFilter]);

  // ===== Charts data =====
  const charts = useMemo(() => {
    // Monthly revenue & profit (filtered)
    const monthMap: Record<string, { rev: number; profit: number; expenses: number; count: number }> = {};
    filtered.forEach(b => {
      const key = b.event_date.slice(0, 7);
      const m = (monthMap[key] ||= { rev: 0, profit: 0, expenses: 0, count: 0 });
      m.rev += +b.total_price;
      m.profit += +b.net_profit || 0;
      m.expenses += +b.expenses;
      m.count += 1;
    });
    const monthly = Object.entries(monthMap).sort().map(([k, v]) => ({
      month: arMonthsShort[+k.slice(5, 7) - 1],
      revenue: Math.round(v.rev),
      profit: Math.round(v.profit),
      expenses: Math.round(v.expenses),
      bookings: v.count,
    }));

    // Top decorations
    const decCount: Record<string, { name: string; bookings: number; revenue: number }> = {};
    filtered.forEach(b => {
      (b.booking_decorations || []).forEach(bd => {
        const name = bd.decoration?.name || "—";
        const price = bd.decoration?.price || 0;
        const k = bd.decoration_id;
        const e = (decCount[k] ||= { name, bookings: 0, revenue: 0 });
        e.bookings += bd.qty;
        e.revenue += +price * bd.qty;
      });
    });
    const topDecs = Object.values(decCount).sort((a, b) => b.bookings - a.bookings).slice(0, 6);
    const leastDec = Object.values(decCount).sort((a, b) => a.bookings - b.bookings)[0];
    const topProfitDec = Object.values(decCount).sort((a, b) => b.revenue - a.revenue)[0];

    // Top clients (by spend)
    const topClients = [...clients].sort((a, b) => +b.total_paid - +a.total_paid).slice(0, 5);
    const vipCount = clients.filter(c => c.is_vip).length;
    const repeatRate = clients.length > 0
      ? Math.round((clients.filter(c => c.events_count > 1).length / clients.length) * 100)
      : 0;

    // Day of week analysis (busiest days)
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    filtered.forEach(b => { dayCounts[new Date(b.event_date).getDay()]++; });
    const daysData = dayCounts.map((c, i) => ({ day: arDays[i].replace("ال", ""), count: c }));

    // Best month
    const best = [...monthly].sort((a, b) => b.revenue - a.revenue)[0];

    // Inventory availability
    const totalQty = decorations.reduce((s, d) => s + d.total_qty, 0);
    const bookedQty = decorations.reduce((s, d) => s + d.booked_qty, 0);
    const availPct = totalQty > 0 ? Math.round(((totalQty - bookedQty) / totalQty) * 100) : 100;
    const lowStock = decorations.filter(d => d.status !== "available");

    // Event type breakdown
    const typeMap: Record<string, number> = {};
    filtered.forEach(b => { typeMap[b.event_type] = (typeMap[b.event_type] || 0) + 1; });
    const typeData = Object.entries(typeMap).map(([k, v]) => ({ name: eventTypeLabels[k as EventType], value: v }));

    return { monthly, topDecs, leastDec, topProfitDec, topClients, vipCount, repeatRate, daysData, best, availPct, lowStock, typeData };
  }, [filtered, clients, decorations]);

  return (
    <div className="space-y-6 animate-slide-up">
      <SectionHeader title="الإحصائيات" subtitle="تحليلات ذكية ومؤشرات أداء فاخرة للشركة" />

      {/* ===== Filters ===== */}
      <Card className="p-3 lg:p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between backdrop-blur-xl bg-card/70">
        <div className="flex items-center gap-1 p-1 bg-secondary/60 rounded-xl w-fit">
          {([
            ["month", "هذا الشهر"], ["quarter", "آخر 3 أشهر"],
            ["year", "هذه السنة"], ["all", "الكل"],
          ] as const).map(([v, l]) => (
            <button key={v} onClick={() => setRange(v as RangeFilter)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                range === v ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
              }`}>{l}</button>
          ))}
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          className="bg-secondary/60 rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring">
          <option value="all">جميع المناسبات</option>
          {(Object.keys(eventTypeLabels) as EventType[]).map(t => (
            <option key={t} value={t}>{eventTypeLabels[t]}</option>
          ))}
        </select>
      </Card>

      {/* ===== KPIs ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        <KPI label="الدخل الشهري" value={formatSAR(kpi.revenue)} growth={kpi.revGrowth} icon={<Wallet className="size-5" />} accent="gold" />
        <KPI label="الربح الصافي" value={formatSAR(kpi.profit)} growth={kpi.profitGrowth} icon={<TrendingUp className="size-5" />} accent="green" />
        <KPI label="إجمالي الحجوزات" value={kpi.totalBookings} growth={kpi.bookingsGrowth} icon={<CalendarDays className="size-5" />} accent="blue" />
        <KPI label="عدد الزبائن" value={kpi.clientsCount} sub={`${kpi.newClients} جديد`} icon={<Users className="size-5" />} accent="purple" />
        <KPI label="مناسبات قادمة" value={kpi.upcoming} sub="حجز مؤكد" icon={<Sparkles className="size-5" />} accent="gold" />
        <KPI label="نسبة النمو" value={`${kpi.revGrowth > 0 ? "+" : ""}${kpi.revGrowth}%`}
          sub="مقارنة بالشهر الماضي" icon={kpi.revGrowth >= 0 ? <ArrowUpRight className="size-5" /> : <ArrowDownRight className="size-5" />}
          accent={kpi.revGrowth >= 0 ? "green" : "red"} />
      </div>

      {/* ===== Smart Alerts ===== */}
      <SmartAlerts kpi={kpi} charts={charts} />

      {isLoading ? <LoadingState rows={4} /> : (
        <>
          {/* ===== Revenue Trend ===== */}
          <Card className="p-5 lg:p-6">
            <ChartHeader title="تطور الأرباح والإيرادات" subtitle="مقارنة بين الدخل والمصاريف والأرباح الصافية" icon={<TrendingUp className="size-5" />} />
            <div className="h-72 mt-4">
              {charts.monthly.length === 0 ? <ChartEmpty /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts.monthly}>
                    <defs>
                      <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.gold} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={CHART_COLORS.gold} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="profitG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.green} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={CHART_COLORS.green} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} reversed />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} orientation="right" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="revenue" name="الإيرادات" stroke={CHART_COLORS.gold} strokeWidth={2.5} fill="url(#revG)" />
                    <Area type="monotone" dataKey="profit" name="الربح الصافي" stroke={CHART_COLORS.green} strokeWidth={2.5} fill="url(#profitG)" />
                    <Line type="monotone" dataKey="expenses" name="المصاريف" stroke={CHART_COLORS.red} strokeWidth={2} strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* ===== Two-column charts ===== */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-5 lg:p-6">
              <ChartHeader title="الحجوزات عبر الزمن" subtitle="عدد الحجوزات شهرياً" icon={<BarChart3 className="size-5" />} />
              <div className="h-64 mt-4">
                {charts.monthly.length === 0 ? <ChartEmpty /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} reversed />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} orientation="right" />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="bookings" name="حجوزات" fill={CHART_COLORS.blue} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card className="p-5 lg:p-6">
              <ChartHeader title="توزيع المناسبات" subtitle="حسب نوع الحدث" icon={<Sparkles className="size-5" />} />
              <div className="h-64 mt-4">
                {charts.typeData.length === 0 ? <ChartEmpty /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={charts.typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={55} paddingAngle={4}>
                        {charts.typeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          {/* ===== Top Decorations + Busiest Days ===== */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-5 lg:p-6">
              <ChartHeader title="أكثر الديكورات طلباً" subtitle="ترتيب حسب عدد الحجوزات" icon={<Crown className="size-5" />} />
              {charts.topDecs.length === 0 ? <ChartEmpty /> : (
                <div className="space-y-3 mt-4">
                  {charts.topDecs.map((d, i) => {
                    const max = charts.topDecs[0].bookings || 1;
                    const pct = (d.bookings / max) * 100;
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`size-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                              i === 0 ? "bg-gold/15 text-gold" : "bg-secondary text-muted-foreground"
                            }`}>{i + 1}</span>
                            <span className="text-sm font-semibold truncate">{d.name}</span>
                          </div>
                          <span className="text-xs font-bold text-gold shrink-0">{d.bookings} حجز</span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary/50 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-gold transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="p-5 lg:p-6">
              <ChartHeader title="أكثر الأيام ازدحاماً" subtitle="حجوزات حسب يوم الأسبوع" icon={<Flame className="size-5" />} />
              <div className="h-64 mt-4">
                {charts.daysData.every(d => d.count === 0) ? <ChartEmpty /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.daysData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} reversed />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} orientation="right" allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" name="حجوزات" fill={CHART_COLORS.purple} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          {/* ===== Clients Analysis ===== */}
          <Card className="p-5 lg:p-6">
            <ChartHeader title="تحليل العملاء" subtitle="نظرة شاملة على قاعدة الزبائن" icon={<Users className="size-5" />} />
            <div className="grid sm:grid-cols-3 gap-3 mt-4 mb-5">
              <MiniStat label="عملاء VIP" value={charts.vipCount} icon={<Crown className="size-4" />} accent="text-gold" />
              <MiniStat label="عملاء جدد" value={kpi.newClients} icon={<Users className="size-4" />} accent="text-info" />
              <MiniStat label="معدل العودة" value={`${charts.repeatRate}%`} icon={<TrendingUp className="size-4" />} accent="text-success" />
            </div>
            {charts.topClients.length === 0 ? <ChartEmpty /> : (
              <div>
                <div className="text-xs font-bold text-muted-foreground mb-2">أعلى العملاء إنفاقاً</div>
                <div className="space-y-2">
                  {charts.topClients.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 hover:bg-secondary/70 transition">
                      <div className={`size-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        i === 0 ? "bg-gradient-gold text-primary shadow-gold" : "bg-secondary text-muted-foreground"
                      }`}>{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                          {c.name}
                          {c.is_vip && <Crown className="size-3 text-gold" />}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{c.events_count} مناسبة</div>
                      </div>
                      <div className="text-sm font-bold text-gold">{formatSAR(+c.total_paid)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* ===== Decoration Analysis ===== */}
          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="size-10 rounded-xl bg-gold/15 text-gold flex items-center justify-center"><Crown className="size-5" /></div>
                <div className="font-bold text-sm">الأكثر ربحاً</div>
              </div>
              <div className="text-base font-bold truncate">{charts.topProfitDec?.name || "—"}</div>
              <div className="text-xs text-gold mt-1">{charts.topProfitDec ? formatSAR(charts.topProfitDec.revenue) : "—"}</div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="size-10 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center"><TrendingDown className="size-5" /></div>
                <div className="font-bold text-sm">الأقل استخداماً</div>
              </div>
              <div className="text-base font-bold truncate">{charts.leastDec?.name || "—"}</div>
              <div className="text-xs text-muted-foreground mt-1">{charts.leastDec?.bookings || 0} حجز فقط</div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="size-10 rounded-xl bg-success/15 text-success flex items-center justify-center"><Package className="size-5" /></div>
                <div className="font-bold text-sm">نسبة توفر المخزون</div>
              </div>
              <div className="text-2xl font-bold text-success">{charts.availPct}%</div>
              <div className="h-1.5 rounded-full bg-secondary mt-2 overflow-hidden">
                <div className="h-full bg-gradient-to-l from-success to-success/60" style={{ width: `${charts.availPct}%` }} />
              </div>
            </Card>
          </div>

          {/* ===== Best Month Summary ===== */}
          {charts.best && (
            <Card className="p-6 bg-gradient-luxury text-sidebar-foreground border-gold/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 size-40 bg-gold/10 rounded-full blur-3xl" />
              <div className="relative flex items-center gap-5">
                <div className="size-14 rounded-2xl bg-gradient-gold text-primary flex items-center justify-center shadow-gold shrink-0">
                  <Crown className="size-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-sidebar-foreground/60 font-semibold">أفضل شهر أداءً</div>
                  <div className="text-xl lg:text-2xl font-bold text-gradient-gold">{charts.best.month}</div>
                  <div className="text-sm text-sidebar-foreground/80 mt-1">
                    {formatSAR(charts.best.revenue)} من {charts.best.bookings} حجز • ربح صافي {formatSAR(charts.best.profit)}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/* ============ COMPONENTS ============ */
const accentMap = {
  gold: "from-gold/20 to-transparent text-gold ring-gold/30",
  green: "from-success/20 to-transparent text-success ring-success/30",
  blue: "from-info/20 to-transparent text-info ring-info/30",
  purple: "from-purple-500/20 to-transparent text-purple-500 ring-purple-500/30",
  red: "from-destructive/20 to-transparent text-destructive ring-destructive/30",
};

function KPI({ label, value, growth, sub, icon, accent }: {
  label: string; value: string | number; growth?: number; sub?: string;
  icon: React.ReactNode; accent: keyof typeof accentMap;
}) {
  const a = accentMap[accent];
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 backdrop-blur-xl p-4 lg:p-5 shadow-soft hover:shadow-elegant transition-all hover:-translate-y-0.5 bg-gradient-to-bl ${a}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] text-muted-foreground font-semibold">{label}</div>
        <div className={`size-9 rounded-xl bg-card/80 flex items-center justify-center ring-1 ${a.split(" ").find(c => c.startsWith("ring-"))}`}>
          {icon}
        </div>
      </div>
      <div className="text-xl lg:text-2xl font-bold">{value}</div>
      {typeof growth === "number" && (
        <div className={`mt-2 inline-flex items-center gap-1 text-[11px] font-bold ${growth >= 0 ? "text-success" : "text-destructive"}`}>
          {growth >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
          {growth >= 0 ? "+" : ""}{growth}%
          <span className="text-muted-foreground font-medium">عن الشهر الماضي</span>
        </div>
      )}
      {sub && !growth && <div className="mt-2 text-[11px] text-muted-foreground font-medium">{sub}</div>}
    </div>
  );
}

function ChartHeader({ title, subtitle, icon }: { title: string; subtitle: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="font-bold text-base lg:text-lg">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
      </div>
      <div className="size-9 rounded-xl bg-secondary/60 text-foreground/70 flex items-center justify-center shrink-0">{icon}</div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-elegant p-3 text-xs" dir="rtl">
      <div className="font-bold mb-1.5">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold">
            {typeof p.value === "number" && p.value > 999 ? formatSAR(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartEmpty() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
      <BarChart3 className="size-8 opacity-40" />
      <div className="text-xs font-semibold">لا توجد بيانات كافية</div>
    </div>
  );
}

function MiniStat({ label, value, icon, accent }: { label: string; value: string | number; icon: React.ReactNode; accent: string }) {
  return (
    <div className="rounded-xl border border-border/60 p-3 bg-secondary/30">
      <div className="flex items-center gap-2 mb-1">
        <span className={accent}>{icon}</span>
        <span className="text-[11px] text-muted-foreground font-semibold">{label}</span>
      </div>
      <div className={`text-xl font-bold ${accent}`}>{value}</div>
    </div>
  );
}

function SmartAlerts({ kpi, charts }: { kpi: any; charts: any }) {
  const alerts: { icon: React.ReactNode; title: string; desc: string; color: string }[] = [];

  if (kpi.revGrowth < -10) {
    alerts.push({
      icon: <TrendingDown className="size-5" />,
      title: "انخفاض في الأرباح",
      desc: `الإيرادات هذا الشهر انخفضت بنسبة ${Math.abs(kpi.revGrowth)}% مقارنة بالشهر الماضي`,
      color: "destructive",
    });
  }
  if (kpi.revGrowth > 20) {
    alerts.push({
      icon: <TrendingUp className="size-5" />,
      title: "نمو ممتاز في الإيرادات",
      desc: `زيادة بنسبة ${kpi.revGrowth}% عن الشهر الماضي — استمر!`,
      color: "success",
    });
  }
  if (charts.topDecs?.[0]) {
    alerts.push({
      icon: <Flame className="size-5" />,
      title: "ديكور رائج",
      desc: `"${charts.topDecs[0].name}" هو الأكثر طلباً بـ ${charts.topDecs[0].bookings} حجز`,
      color: "gold",
    });
  }
  if (charts.lowStock?.length > 0) {
    alerts.push({
      icon: <AlertTriangle className="size-5" />,
      title: "نقص في المخزون",
      desc: `${charts.lowStock.length} ديكور يحتاج إعادة تموين أو غير متوفر`,
      color: "warning",
    });
  }
  if (kpi.upcoming >= 5) {
    alerts.push({
      icon: <CalendarDays className="size-5" />,
      title: "مناسبات مزدحمة قادمة",
      desc: `لديك ${kpi.upcoming} مناسبة مؤكدة قادمة — تجهز مبكراً`,
      color: "info",
    });
  }

  if (alerts.length === 0) return null;

  const colorMap: Record<string, string> = {
    destructive: "border-destructive/30 bg-destructive/5 text-destructive",
    success: "border-success/30 bg-success/5 text-success",
    gold: "border-gold/30 bg-gold/5 text-gold",
    warning: "border-warning/30 bg-warning/5 text-warning",
    info: "border-info/30 bg-info/5 text-info",
  };

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {alerts.map((a, i) => (
        <div key={i} className={`rounded-2xl border p-4 backdrop-blur ${colorMap[a.color]}`}>
          <div className="flex items-start gap-3">
            <div className="shrink-0">{a.icon}</div>
            <div className="min-w-0">
              <div className="font-bold text-sm">{a.title}</div>
              <div className="text-xs mt-1 text-foreground/70">{a.desc}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
