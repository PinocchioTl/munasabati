import { createFileRoute } from "@tanstack/react-router";
import { Card, SectionHeader, LoadingState, Button, EmptyState } from "@/components/ui-bits";
import { useBookings, useDecorations, useExpenses, useCreateExpense, useDeleteExpense, formatSAR, type Booking, type Expense } from "@/lib/db";
import { TrendingUp, TrendingDown, Wallet, Receipt, Trophy, Calendar, Plus, Trash2, ArrowDownToLine, ArrowUpFromLine, BarChart3, Filter, X } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, PieChart, Pie, Cell, Legend } from "recharts";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_main/profits")({
  component: ProfitsPage,
});

const arMonths = ["ينا","فبر","مار","أبر","ماي","يون","يول","أغس","سبت","أكت","نوف","ديس"];
const EXPENSE_TYPES = ["نقل وتوصيل", "عمالة", "تجهيزات", "صيانة", "ورود وزهور", "أخرى"];

type Period = "day" | "week" | "month" | "year" | "all";

function periodRange(period: Period): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0,10);
  const from = new Date(now);
  if (period === "day") from.setDate(from.getDate() - 1);
  else if (period === "week") from.setDate(from.getDate() - 7);
  else if (period === "month") from.setMonth(from.getMonth() - 1);
  else if (period === "year") from.setFullYear(from.getFullYear() - 1);
  else return { from: "0000-01-01", to: "9999-12-31" };
  return { from: from.toISOString().slice(0,10), to };
}

function ProfitsPage() {
  const { data: bookings = [], isLoading: lb } = useBookings();
  const { data: decorations = [] } = useDecorations();
  const { data: expenses = [], isLoading: le } = useExpenses();
  const [period, setPeriod] = useState<Period>("all");
  const [openExp, setOpenExp] = useState(false);

  const { from, to } = useMemo(() => periodRange(period), [period]);

  const completed = useMemo(() => bookings.filter(b => b.status === "completed"), [bookings]);

  const inRange = <T extends { date?: string; event_date?: string }>(arr: T[], key: "date"|"event_date") =>
    arr.filter(x => {
      const d = (x as any)[key] as string;
      return d >= from && d <= to;
    });

  const data = useMemo(() => {
    const compInRange = inRange(completed, "event_date");
    const expInRange = inRange(expenses, "date");

    const totalRevenue = compInRange.reduce((s, b) => s + +b.total_price, 0);
    const totalExpenses = expInRange.reduce((s, e) => s + +e.amount, 0);
    const totalProfit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;
    const avgPerBooking = compInRange.length > 0 ? Math.round(totalProfit / compInRange.length) : 0;

    // Monthly aggregation (all data, for trend chart)
    const monthly: Record<string, { revenue: number; expenses: number; profit: number; count: number }> = {};
    completed.forEach(b => {
      const m = b.event_date.slice(0,7);
      monthly[m] ??= { revenue: 0, expenses: 0, profit: 0, count: 0 };
      monthly[m].revenue += +b.total_price;
      monthly[m].count += 1;
    });
    expenses.forEach(e => {
      const m = e.date.slice(0,7);
      monthly[m] ??= { revenue: 0, expenses: 0, profit: 0, count: 0 };
      monthly[m].expenses += +e.amount;
    });
    Object.values(monthly).forEach(v => v.profit = v.revenue - v.expenses);

    const trend = Object.entries(monthly).sort().map(([k,v]) => ({
      month: arMonths[+k.slice(5,7)-1] + " " + k.slice(2,4),
      key: k,
      ...v,
    }));

    const trendInRange = trend.filter(t => t.key >= from.slice(0,7) && t.key <= to.slice(0,7));

    const bestMonth = trend.length ? trend.reduce((a, b) => a.profit > b.profit ? a : b) : null;
    const worstMonth = trend.length ? trend.reduce((a, b) => a.profit < b.profit ? a : b) : null;

    const last = trend[trend.length - 1];
    const prev = trend[trend.length - 2];
    const growth = prev && prev.profit !== 0
      ? Math.round(((last.profit - prev.profit) / Math.abs(prev.profit)) * 100)
      : 0;

    // Profit per decoration
    const decStats: Record<string, { name: string; revenue: number; bookings: number }> = {};
    compInRange.forEach(b => {
      (b.booking_decorations || []).forEach(bd => {
        const dec = decorations.find(d => d.id === bd.decoration_id);
        if (!dec) return;
        decStats[dec.id] ??= { name: dec.name, revenue: 0, bookings: 0 };
        decStats[dec.id].revenue += +dec.price * bd.qty;
        decStats[dec.id].bookings += 1;
      });
    });
    // Approximate per-decoration profit using overall margin
    const decArr = Object.values(decStats).map(d => ({
      ...d,
      profit: Math.round(d.revenue * (margin / 100)),
    })).sort((a, b) => b.profit - a.profit);

    // Expenses by type
    const byType: Record<string, number> = {};
    expInRange.forEach(e => {
      byType[e.expense_type] = (byType[e.expense_type] || 0) + +e.amount;
    });
    const expensePie = Object.entries(byType).map(([name, value]) => ({ name, value }));

    // Paid / pending across all non-cancelled bookings in range
    const active = inRange(bookings.filter(b => b.status !== "cancelled"), "event_date");
    const paid = active.reduce((s, b) => s + +b.deposit, 0);
    const pending = active.reduce((s, b) => s + +b.remaining, 0);

    return {
      totalRevenue, totalExpenses, totalProfit, margin, avgPerBooking,
      trend, trendInRange, bestMonth, worstMonth, growth,
      decArr, expensePie, paid, pending,
      completedCount: compInRange.length,
    };
  }, [bookings, completed, expenses, decorations, from, to]);

  const PIE_COLORS = ["var(--gold)", "var(--info)", "var(--success)", "var(--warning)", "var(--destructive)", "var(--primary)"];
  const isLoading = lb || le;

  return (
    <div className="space-y-6 animate-slide-up" dir="rtl">
      <SectionHeader
        title="الأرباح"
        subtitle="تقارير مالية دقيقة — تحسب تلقائياً من الحجوزات المكتملة والمصاريف"
        action={
          <Button variant="gold" onClick={() => setOpenExp(true)}>
            <Plus className="size-4" /> إضافة مصروف
          </Button>
        }
      />

      {/* Period filter */}
      <Card className="p-2 flex items-center gap-1 flex-wrap">
        <div className="flex items-center gap-2 px-3 text-xs text-muted-foreground">
          <Filter className="size-3.5" /> الفترة:
        </div>
        {([
          ["day", "اليوم"],
          ["week", "أسبوع"],
          ["month", "شهر"],
          ["year", "سنة"],
          ["all", "الكل"],
        ] as [Period, string][]).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setPeriod(k)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              period === k ? "bg-primary text-primary-foreground shadow-elegant" : "hover:bg-secondary"
            }`}
          >
            {l}
          </button>
        ))}
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="إجمالي الدخل" value={formatSAR(data.totalRevenue)} icon={ArrowDownToLine} color="text-info bg-info/10" sub={`${data.completedCount} حجز مكتمل`} />
        <StatCard label="المصاريف" value={formatSAR(data.totalExpenses)} icon={ArrowUpFromLine} color="text-destructive bg-destructive/10" />
        <StatCard label="الربح الصافي" value={formatSAR(data.totalProfit)} icon={TrendingUp} color="text-success bg-success/10" sub={`هامش ${data.margin}%`} />
        <StatCard label="متوسط الربح/حجز" value={formatSAR(data.avgPerBooking)} icon={Wallet} color="text-gold bg-gold/10" sub={data.growth !== 0 ? `${data.growth > 0 ? "▲" : "▼"} ${Math.abs(data.growth)}% عن الشهر السابق` : undefined} />
      </div>

      {isLoading ? <LoadingState rows={3} /> : (
        <>
          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="p-6 lg:col-span-2">
              <div className="text-xl font-bold mb-1">تطور الأرباح الشهرية</div>
              <div className="text-xs text-muted-foreground mb-5">الدخل والمصاريف والربح الصافي عبر الزمن</div>
              <div className="h-72">
                {data.trend.length === 0 ? <div className="h-full flex items-center justify-center text-sm text-muted-foreground">لا توجد بيانات</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.trend}>
                      <defs>
                        <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--info)" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="var(--info)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="prof" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} reversed />
                      <YAxis stroke="var(--muted-foreground)" fontSize={12} orientation="right" />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" name="الدخل" dataKey="revenue" stroke="var(--info)" strokeWidth={2} fill="url(#rev)" />
                      <Area type="monotone" name="الربح الصافي" dataKey="profit" stroke="var(--gold)" strokeWidth={2} fill="url(#prof)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card className="p-6 bg-gradient-luxury text-sidebar-foreground border-0 relative overflow-hidden">
              <Trophy className="absolute -top-4 -left-4 size-32 text-gold/10" />
              <div className="relative space-y-5">
                <div>
                  <div className="text-[11px] text-sidebar-foreground/70 uppercase tracking-wider">أفضل شهر</div>
                  {data.bestMonth ? (
                    <>
                      <div className="text-3xl font-bold text-gold mt-2">{data.bestMonth.month}</div>
                      <div className="text-base font-bold mt-1">{formatSAR(data.bestMonth.profit)}</div>
                    </>
                  ) : <div className="text-sm text-sidebar-foreground/60 mt-2">—</div>}
                </div>
                <div className="border-t border-sidebar-foreground/10 pt-4">
                  <div className="text-[11px] text-sidebar-foreground/70 uppercase tracking-wider">أقل شهر</div>
                  {data.worstMonth ? (
                    <>
                      <div className="text-xl font-bold text-destructive mt-2">{data.worstMonth.month}</div>
                      <div className="text-sm font-bold mt-1">{formatSAR(data.worstMonth.profit)}</div>
                    </>
                  ) : <div className="text-sm text-sidebar-foreground/60 mt-2">—</div>}
                </div>
              </div>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-6">
              <div className="text-xl font-bold mb-1 flex items-center gap-2"><BarChart3 className="size-5" /> الربح حسب الديكور</div>
              <div className="text-xs text-muted-foreground mb-5">الأكثر والأقل ربحاً ضمن الفترة المحددة</div>
              {data.decArr.length === 0 ? <div className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات</div> : (
                <div className="space-y-3">
                  {data.decArr.slice(0, 6).map((p, i) => {
                    const max = data.decArr[0]?.profit || 1;
                    return (
                      <div key={p.name}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="font-medium flex items-center gap-2">
                            <span className={`size-5 rounded-md flex items-center justify-center text-[10px] font-bold ${i === 0 ? "bg-gold/20 text-gold" : "bg-secondary"}`}>{i+1}</span>
                            {p.name}
                            <span className="text-[10px] text-muted-foreground">({p.bookings} حجز)</span>
                          </span>
                          <span className="font-bold text-gold">{formatSAR(p.profit)}</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-gold transition-all" style={{ width: `${Math.max((p.profit / max) * 100, 2)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="p-6">
              <div className="text-xl font-bold mb-1">توزيع المصاريف</div>
              <div className="text-xs text-muted-foreground mb-5">حسب نوع المصروف ضمن الفترة</div>
              <div className="h-64">
                {data.expensePie.length === 0 ? <div className="h-full flex items-center justify-center text-sm text-muted-foreground">لا توجد مصاريف مسجلة</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.expensePie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                        {data.expensePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} formatter={(v: any) => formatSAR(+v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <div className="text-xl font-bold mb-1 flex items-center gap-2"><Calendar className="size-5" /> مقارنة الإيرادات بالمصاريف</div>
            <div className="text-xs text-muted-foreground mb-5">رؤية كاملة لكل شهر</div>
            <div className="h-64">
              {data.trend.length === 0 ? <div className="h-full flex items-center justify-center text-sm text-muted-foreground">لا توجد بيانات</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} reversed />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} orientation="right" />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} formatter={(v: any) => formatSAR(+v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar name="الدخل" dataKey="revenue" fill="var(--info)" radius={[8,8,0,0]} />
                    <Bar name="المصاريف" dataKey="expenses" fill="var(--destructive)" radius={[8,8,0,0]} />
                    <Bar name="الربح" dataKey="profit" fill="var(--gold)" radius={[8,8,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xl font-bold flex items-center gap-2"><Receipt className="size-5" /> سجل المصاريف</div>
                <div className="text-xs text-muted-foreground mt-1">جميع المصاريف المسجلة ضمن الفترة</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setOpenExp(true)}>
                <Plus className="size-3.5" /> مصروف جديد
              </Button>
            </div>
            <ExpensesTable expenses={inRange(expenses, "date")} bookings={bookings} />
          </Card>

          <Card className="p-6">
            <div className="text-xl font-bold mb-4">حالة المدفوعات</div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-success/10 border border-success/20 rounded-2xl p-5">
                <div className="text-sm text-muted-foreground">مدفوعات مستلمة</div>
                <div className="text-2xl font-bold text-success mt-2">{formatSAR(data.paid)}</div>
              </div>
              <div className="bg-warning/10 border border-warning/20 rounded-2xl p-5">
                <div className="text-sm text-muted-foreground">مدفوعات متبقية</div>
                <div className="text-2xl font-bold text-warning mt-2">{formatSAR(data.pending)}</div>
              </div>
            </div>
          </Card>
        </>
      )}

      <ExpenseDialog open={openExp} onClose={() => setOpenExp(false)} bookings={bookings} />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, sub }: any) {
  return (
    <Card className="p-5">
      <div className={`size-10 rounded-xl flex items-center justify-center ${color}`}><Icon className="size-[18px]" /></div>
      <div className="mt-4 text-xl lg:text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
      {sub && <div className="text-[11px] text-success font-semibold mt-1">{sub}</div>}
    </Card>
  );
}

function ExpensesTable({ expenses, bookings }: { expenses: Expense[]; bookings: Booking[] }) {
  const del = useDeleteExpense();
  if (expenses.length === 0) {
    return <EmptyState title="لا توجد مصاريف" description="ابدأ بتسجيل مصاريفك لتتبع الأرباح بدقة" />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-right text-xs text-muted-foreground border-b border-border">
            <th className="py-2 px-2 font-semibold">التاريخ</th>
            <th className="py-2 px-2 font-semibold">النوع</th>
            <th className="py-2 px-2 font-semibold">المبلغ</th>
            <th className="py-2 px-2 font-semibold">الحجز</th>
            <th className="py-2 px-2 font-semibold">ملاحظات</th>
            <th className="py-2 px-2 font-semibold"></th>
          </tr>
        </thead>
        <tbody>
          {expenses.map(e => {
            const b = bookings.find(x => x.id === e.booking_id);
            return (
              <tr key={e.id} className="border-b border-border/50 hover:bg-secondary/30">
                <td className="py-3 px-2 text-xs text-muted-foreground">{e.date}</td>
                <td className="py-3 px-2 font-medium">{e.expense_type}</td>
                <td className="py-3 px-2 font-bold text-destructive">{formatSAR(+e.amount)}</td>
                <td className="py-3 px-2 text-xs text-muted-foreground">{b ? `${b.code || ""} — ${b.customer_name}` : "—"}</td>
                <td className="py-3 px-2 text-xs text-muted-foreground max-w-xs truncate">{e.notes || "—"}</td>
                <td className="py-3 px-2 text-left">
                  <button
                    onClick={() => {
                      if (confirm("حذف هذا المصروف؟")) {
                        del.mutate(e.id, {
                          onSuccess: () => toast.success("تم حذف المصروف"),
                          onError: (err: any) => toast.error(err.message),
                        });
                      }
                    }}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExpenseDialog({ open, onClose, bookings }: { open: boolean; onClose: () => void; bookings: Booking[] }) {
  const [type, setType] = useState(EXPENSE_TYPES[0]);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [bookingId, setBookingId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const create = useCreateExpense();

  const handleSubmit = () => {
    create.mutate({
      expense_type: type,
      amount: +amount,
      date,
      booking_id: bookingId || null,
      notes,
    }, {
      onSuccess: () => {
        toast.success("تم تسجيل المصروف بنجاح");
        setAmount(""); setNotes(""); setBookingId("");
        onClose();
      },
      onError: (err: any) => toast.error(err.message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">إضافة مصروف جديد</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>نوع المصروف</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPENSE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>المبلغ (د.ج)</Label>
            <Input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label>التاريخ</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <Label>الحجز المرتبط (اختياري)</Label>
            <Select value={bookingId || "none"} onValueChange={(v) => setBookingId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="اختر حجز..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون حجز</SelectItem>
                {bookings.slice(0, 50).map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.code || ""} — {b.customer_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}><X className="size-4" /> إلغاء</Button>
          <Button variant="gold" onClick={handleSubmit} loading={create.isPending}>
            <Plus className="size-4" /> تسجيل المصروف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
