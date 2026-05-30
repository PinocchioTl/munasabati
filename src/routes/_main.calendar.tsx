import { createFileRoute } from "@tanstack/react-router";
import { Card, SectionHeader, LoadingState, EmptyState } from "@/components/ui-bits";
import { useBookings, eventTypeLabels, statusLabels, formatSAR, type Booking, type BookingStatus } from "@/lib/db";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  ChevronRight, ChevronLeft, CalendarDays, AlertTriangle, Sparkles,
  Clock, User, Phone, Wallet, TrendingUp, Flame, CircleDot,
} from "lucide-react";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/_main/calendar")({
  component: CalendarPage,
});

const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const fullDayNames = ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const shortDayNames = ["أحد","إثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"];
const WEEKDAY_ORDER = [6, 0, 1, 2, 3, 4, 5] as const; // السبت → الجمعة، مبني على Date.getDay()
type WeekdayNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type CalendarCell = { date: Date; iso: string; day: number; weekDay: WeekdayNumber } | null;
const dayNames = WEEKDAY_ORDER.map((day) => fullDayNames[day]);

// ألوان الحالات: مؤكد أخضر، انتظار أصفر، جاري التنفيذ أزرق، مكتمل بنفسجي، ملغي أحمر
const statusColor: Record<BookingStatus, { bg: string; text: string; ring: string; dot: string; chip: string }> = {
  confirmed:   { bg: "bg-success/15", text: "text-success", ring: "ring-success/40", dot: "bg-success", chip: "bg-success/15 text-success border-success/30" },
  pending:     { bg: "bg-warning/15", text: "text-warning", ring: "ring-warning/40", dot: "bg-warning", chip: "bg-warning/15 text-warning border-warning/30" },
  in_progress: { bg: "bg-info/15", text: "text-info", ring: "ring-info/40", dot: "bg-info", chip: "bg-info/15 text-info border-info/30" },
  completed:   { bg: "bg-[oklch(0.55_0.18_295)]/15", text: "text-[oklch(0.65_0.22_295)]", ring: "ring-[oklch(0.55_0.18_295)]/40", dot: "bg-[oklch(0.55_0.18_295)]", chip: "bg-[oklch(0.55_0.18_295)]/15 text-[oklch(0.65_0.22_295)] border-[oklch(0.55_0.18_295)]/30" },
  cancelled:   { bg: "bg-destructive/15", text: "text-destructive", ring: "ring-destructive/40", dot: "bg-destructive", chip: "bg-destructive/15 text-destructive border-destructive/30" },
};

function CalendarStatusBadge({ status }: { status: BookingStatus }) {
  const c = statusColor[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${c.chip}`}>
      <span className={`size-1.5 rounded-full ${c.dot}`} />
      {statusLabels[status]}
    </span>
  );
}

type ViewMode = "month" | "week" | "day";
const makeLocalDate = (year: number, month: number, day: number) => new Date(year, month, day, 12, 0, 0, 0);
const fmtISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const todayISO = () => fmtISO(new Date());

function parseLocalISO(dateISO: string) {
  const [year, month, day] = dateISO.split("-").map(Number);
  return makeLocalDate(year, month - 1, day);
}

function getDaysInMonth(year: number, month: number) {
  return makeLocalDate(year, month + 1, 0).getDate();
}

function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const firstOfMonth = makeLocalDate(year, month, 1);
  const daysInMonth = getDaysInMonth(year, month);
  const firstColumn = WEEKDAY_ORDER.indexOf(firstOfMonth.getDay() as WeekdayNumber);
  const totalCells = Math.ceil((firstColumn + daysInMonth) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const day = index - firstColumn + 1;
    if (day < 1 || day > daysInMonth) return null;
    const date = makeLocalDate(year, month, day);
    return { date, iso: fmtISO(date), day, weekDay: date.getDay() as WeekdayNumber };
  });
}

function buildWeekDays(cursor: Date) {
  const current = makeLocalDate(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
  const diffFromWeekStart = (current.getDay() - WEEKDAY_ORDER[0] + 7) % 7;
  const start = makeLocalDate(current.getFullYear(), current.getMonth(), current.getDate() - diffFromWeekStart);
  return Array.from({ length: 7 }, (_, i) => makeLocalDate(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

/** Detect decoration conflicts across bookings of a date (same decoration overused or overlapping). */
function detectConflicts(dayBookings: Booking[]): Set<string> {
  // returns set of conflicting booking ids
  const conflicts = new Set<string>();
  const active = dayBookings.filter(b => b.status === "pending" || b.status === "confirmed");
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j];
      const overlap = a.start_time < b.end_time && b.start_time < a.end_time;
      if (!overlap) continue;
      const aDecs = (a.booking_decorations || []).map(d => d.decoration_id);
      const bDecs = (b.booking_decorations || []).map(d => d.decoration_id);
      if (aDecs.some(id => bDecs.includes(id))) {
        conflicts.add(a.id); conflicts.add(b.id);
      }
    }
  }
  return conflicts;
}

function CalendarPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(new Date()); // for week/day views
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { data: bookings = [], isLoading } = useBookings();

  const today = todayISO();

  const bookingsByDate = useMemo(() => {
    const m: Record<string, Booking[]> = {};
    bookings.forEach(b => { (m[b.event_date] ||= []).push(b); });
    // sort each day by start_time
    Object.values(m).forEach(arr => arr.sort((x, y) => x.start_time.localeCompare(y.start_time)));
    return m;
  }, [bookings]);

  // ===== Month metrics =====
  const monthMetrics = useMemo(() => {
    const dim = getDaysInMonth(year, month);
    let total = 0, empty = 0;
    let topDay = { date: "", count: 0 };
    for (let d = 1; d <= dim; d++) {
      const ds = fmtISO(makeLocalDate(year, month, d));
      const list = bookingsByDate[ds] || [];
      total += list.length;
      if (list.length === 0) empty++;
      if (list.length > topDay.count) topDay = { date: ds, count: list.length };
    }
    const busy = dim - empty;
    return { total, empty, busy, dim, fillPct: Math.round((busy / dim) * 100), topDay };
  }, [bookingsByDate, year, month]);

  const navMonth = (delta: number) => {
    let m = month + delta, y = year;
    if (m > 11) { m = 0; y++; } else if (m < 0) { m = 11; y--; }
    setMonth(m); setYear(y);
  };
  const navWeek = (delta: number) => { const d = new Date(cursor); d.setDate(d.getDate() + delta * 7); setCursor(d); };
  const navDay = (delta: number) => { const d = new Date(cursor); d.setDate(d.getDate() + delta); setCursor(d); };

  // ===== Month grid =====
  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);

  // ===== Week cells =====
  const weekDays = useMemo(() => buildWeekDays(cursor), [cursor]);

  const selectedBookings = selectedDate ? (bookingsByDate[selectedDate] || []) : [];
  const selectedConflicts = useMemo(() => detectConflicts(selectedBookings), [selectedBookings]);

  return (
    <div className="space-y-6 animate-slide-up">
      <SectionHeader title="التقويم" subtitle="عرض شامل وذكي لجميع المناسبات والحجوزات" />

      {/* ===== Smart KPIs ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <GlassStat icon={<CalendarDays className="size-5" />} label="حجوزات هذا الشهر" value={monthMetrics.total} accent="text-gold" />
        <GlassStat icon={<Flame className="size-5" />} label="أكثر يوم ازدحاماً" value={monthMetrics.topDay.count ? `${monthMetrics.topDay.date.slice(-2)} • ${monthMetrics.topDay.count} حجز` : "—"} accent="text-destructive" small />
        <GlassStat icon={<CircleDot className="size-5" />} label="أيام فارغة" value={monthMetrics.empty} accent="text-muted-foreground" />
        <GlassStat icon={<TrendingUp className="size-5" />} label="نسبة الامتلاء" value={`${monthMetrics.fillPct}%`} accent="text-info" progress={monthMetrics.fillPct} />
      </div>

      {/* ===== View Switcher ===== */}
      <Card className="p-4 lg:p-6 backdrop-blur-xl bg-card/70 border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-1 p-1 bg-secondary/60 rounded-xl w-fit">
            {(["month","week","day"] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  view === v ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
                }`}>
                {v === "month" ? "شهر" : v === "week" ? "أسبوع" : "يوم"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {view === "month" && (<>
              <NavBtn onClick={() => navMonth(-1)}><ChevronRight className="size-4" /></NavBtn>
              <div className="text-base lg:text-xl font-bold min-w-[150px] text-center">{monthNames[month]} {year}</div>
              <NavBtn onClick={() => navMonth(1)}><ChevronLeft className="size-4" /></NavBtn>
              <button onClick={() => { const n = new Date(); setMonth(n.getMonth()); setYear(n.getFullYear()); }}
                className="ms-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-gold text-primary shadow-gold">اليوم</button>
            </>)}
            {view === "week" && (<>
              <NavBtn onClick={() => navWeek(-1)}><ChevronRight className="size-4" /></NavBtn>
              <div className="text-sm lg:text-base font-bold min-w-[180px] text-center">
                {weekDays[0].getDate()} - {weekDays[6].getDate()} {monthNames[weekDays[6].getMonth()]}
              </div>
              <NavBtn onClick={() => navWeek(1)}><ChevronLeft className="size-4" /></NavBtn>
              <button onClick={() => setCursor(new Date())} className="ms-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-gold text-primary shadow-gold">اليوم</button>
            </>)}
            {view === "day" && (<>
              <NavBtn onClick={() => navDay(-1)}><ChevronRight className="size-4" /></NavBtn>
              <div className="text-sm lg:text-base font-bold min-w-[200px] text-center">
                {fullDayNames[cursor.getDay()]} {cursor.getDate()} {monthNames[cursor.getMonth()]}
              </div>
              <NavBtn onClick={() => navDay(1)}><ChevronLeft className="size-4" /></NavBtn>
              <button onClick={() => setCursor(new Date())} className="ms-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-gold text-primary shadow-gold">اليوم</button>
            </>)}
          </div>
        </div>

        {isLoading ? <LoadingState rows={4} /> : (
          <>
            {view === "month" && (
              <>
                <div className="grid grid-cols-7 gap-1.5 mb-2">
                  {dayNames.map(d => (
                    <div key={d} className="text-center text-[11px] font-bold text-muted-foreground py-2">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {cells.map((d, i) => {
                    if (d === null) return <div key={i} className="min-h-[88px] lg:min-h-[110px]" />;
                    const ds = d.iso;
                    const dayBookings = bookingsByDate[ds] || [];
                    const isToday = ds === today;
                    const busy = dayBookings.length >= 3;
                    const conflicts = detectConflicts(dayBookings);
                    const hasConflict = conflicts.size > 0;

                    return (
                      <button key={i} onClick={() => setSelectedDate(ds)}
                        className={`group relative text-right min-h-[88px] lg:min-h-[110px] rounded-2xl border p-2 transition-all hover:-translate-y-0.5 hover:shadow-elegant overflow-hidden ${
                          isToday ? "border-gold/60 bg-gradient-to-br from-gold/10 to-transparent shadow-gold/30 shadow-lg" :
                          hasConflict ? "border-destructive/40 bg-destructive/5" :
                          busy ? "border-gold/30 bg-card/80 backdrop-blur" :
                          "border-border/60 bg-card/40 backdrop-blur hover:bg-card/80"
                        }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            {hasConflict && <AlertTriangle className="size-3.5 text-destructive animate-pulse" />}
                            {busy && !hasConflict && <Flame className="size-3.5 text-gold" />}
                          </div>
                          <div className={`text-xs font-bold ${isToday ? "text-gold" : ""}`}>{d.day}</div>
                        </div>

                        <div className="mt-1.5 space-y-1">
                          {dayBookings.slice(0, 2).map(b => {
                            const c = statusColor[b.status];
                            return (
                              <div key={b.id} className={`text-[10px] truncate px-1.5 py-0.5 rounded-md font-semibold flex items-center gap-1 ${c.bg} ${c.text}`}>
                                <span className={`size-1 rounded-full ${c.dot} shrink-0`} />
                                <span className="truncate">{b.customer_name}</span>
                              </div>
                            );
                          })}
                          {dayBookings.length > 2 && (
                            <div className="text-[10px] text-muted-foreground font-semibold">+{dayBookings.length - 2} أخرى</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {view === "week" && (
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((d, i) => {
                  const ds = fmtISO(d);
                  const list = bookingsByDate[ds] || [];
                  const isToday = ds === today;
                  const conflicts = detectConflicts(list);
                  return (
                    <button key={i} onClick={() => setSelectedDate(ds)}
                      className={`text-right min-h-[200px] rounded-2xl border p-3 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-elegant ${
                        isToday ? "border-gold/60 bg-gradient-to-br from-gold/10 to-transparent" :
                        conflicts.size ? "border-destructive/40 bg-destructive/5" :
                        "border-border/60 bg-card/50"
                      }`}>
                      <div className="text-center pb-2 border-b border-border/40">
                        <div className="text-[10px] text-muted-foreground">{shortDayNames[d.getDay()]}</div>
                        <div className={`text-lg font-bold ${isToday ? "text-gold" : ""}`}>{d.getDate()}</div>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {list.length === 0 && <div className="text-[10px] text-muted-foreground text-center py-4">فارغ</div>}
                        {list.slice(0, 4).map(b => {
                          const c = statusColor[b.status];
                          return (
                            <div key={b.id} className={`text-[10px] px-2 py-1 rounded-lg font-semibold ${c.bg} ${c.text}`}>
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-mono">{b.start_time.slice(0,5)}</span>
                                <span className={`size-1.5 rounded-full ${c.dot}`} />
                              </div>
                              <div className="truncate">{b.customer_name}</div>
                            </div>
                          );
                        })}
                        {list.length > 4 && <div className="text-[10px] text-muted-foreground text-center">+{list.length - 4}</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {view === "day" && (
              <DayTimeline date={fmtISO(cursor)} list={bookingsByDate[fmtISO(cursor)] || []} onOpen={setSelectedDate} />
            )}
          </>
        )}

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-border/50 flex flex-wrap items-center gap-3 text-[11px]">
          <span className="text-muted-foreground font-semibold">الحالات:</span>
          {(Object.keys(statusColor) as BookingStatus[]).map(s => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${statusColor[s].dot}`} />
              <span className="font-medium">{statusLabels[s]}</span>
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 ms-auto text-destructive">
            <AlertTriangle className="size-3" /> تعارض حجوزات
          </span>
        </div>
      </Card>

      {/* ===== Day Details Dialog ===== */}
      <Dialog open={!!selectedDate} onOpenChange={(o) => !o && setSelectedDate(null)}>
        <DialogContent className="max-w-2xl backdrop-blur-2xl bg-card/95 border-border/60 max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Sparkles className="size-5 text-gold" />
              {selectedDate && (() => {
                const d = parseLocalISO(selectedDate);
                return `${fullDayNames[d.getDay()]}، ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
              })()}
            </DialogTitle>
            <DialogDescription>
              {selectedBookings.length === 0 ? "لا توجد حجوزات في هذا اليوم" : `${selectedBookings.length} حجز/حجوزات`}
              {selectedConflicts.size > 0 && (
                <span className="ms-2 inline-flex items-center gap-1 text-destructive font-semibold">
                  <AlertTriangle className="size-3.5" /> تعارض مكتشف
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedBookings.length === 0 ? (
            <EmptyState title="يوم فارغ" description="لا توجد أي حجوزات مسجلة في هذا التاريخ" />
          ) : (
            <div className="space-y-3 mt-2">
              {selectedConflicts.size > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/30">
                  <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <div className="font-bold text-destructive">تنبيه تعارض</div>
                    <div className="text-muted-foreground mt-0.5">يوجد ديكور مستخدم في أكثر من حجز خلال نفس الوقت. راجع الحجوزات المميزة باللون الأحمر.</div>
                  </div>
                </div>
              )}
              {selectedBookings.map(b => {
                const c = statusColor[b.status];
                const conflicted = selectedConflicts.has(b.id);
                return (
                  <div key={b.id}
                    className={`p-4 rounded-2xl border backdrop-blur transition ${
                      conflicted ? "border-destructive/50 bg-destructive/5 ring-2 ring-destructive/20" :
                      `border-border/60 bg-card/60 hover:ring-2 hover:${c.ring}`
                    }`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`size-11 rounded-xl ${c.bg} ${c.text} flex items-center justify-center shrink-0`}>
                          <CalendarDays className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm truncate flex items-center gap-2">
                            {b.customer_name}
                            {conflicted && <AlertTriangle className="size-3.5 text-destructive" />}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">{b.code || "—"}</div>
                        </div>
                      </div>
                      <CalendarStatusBadge status={b.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <InfoChip icon={<Sparkles className="size-3.5" />} label={eventTypeLabels[b.event_type]} />
                      <InfoChip icon={<Clock className="size-3.5" />} label={`${b.start_time.slice(0,5)} - ${b.end_time.slice(0,5)}`} />
                      {b.phone && <InfoChip icon={<Phone className="size-3.5" />} label={b.phone} />}
                      <InfoChip icon={<User className="size-3.5" />} label={b.customer_name} />
                    </div>

                    {b.booking_decorations && b.booking_decorations.length > 0 && (
                      <div className="mb-3">
                        <div className="text-[10px] font-bold text-muted-foreground mb-1.5">الديكورات</div>
                        <div className="flex flex-wrap gap-1.5">
                          {b.booking_decorations.map((bd, i) => (
                            <span key={i} className="text-[11px] px-2 py-1 rounded-lg bg-gold/10 text-gold font-semibold border border-gold/20">
                              {bd.decoration?.name || "—"} × {bd.qty}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/40">
                      <MoneyCell label="الإجمالي" value={formatSAR(b.total_price)} />
                      <MoneyCell label="العربون" value={formatSAR(b.deposit)} accent="text-success" />
                      <MoneyCell label="المتبقي" value={formatSAR(b.remaining)} accent="text-warning" />
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold">
                        <Wallet className="size-3.5 text-muted-foreground" />
                        <span className={
                          b.payment_status === "paid" ? "text-success" :
                          b.payment_status === "partial" ? "text-warning" : "text-destructive"
                        }>
                          {b.payment_status === "paid" ? "مدفوع بالكامل" : b.payment_status === "partial" ? "مدفوع جزئياً" : "غير مدفوع"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NavBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="size-9 rounded-xl bg-secondary/60 hover:bg-secondary flex items-center justify-center transition active:scale-95">
      {children}
    </button>
  );
}

function GlassStat({ icon, label, value, accent = "text-foreground", progress, small }: {
  icon: React.ReactNode; label: string; value: string | number; accent?: string; progress?: number; small?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-4 shadow-soft hover:shadow-elegant transition">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-muted-foreground font-semibold">{label}</div>
        <div className={`size-8 rounded-xl bg-secondary/60 flex items-center justify-center ${accent}`}>{icon}</div>
      </div>
      <div className={`mt-2 font-bold ${small ? "text-base" : "text-2xl"} ${accent}`}>{value}</div>
      {typeof progress === "number" && (
        <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
          <div className="h-full bg-gradient-gold transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

function InfoChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/60 text-foreground/80 font-medium truncate">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function MoneyCell({ label, value, accent = "text-foreground" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-muted-foreground font-semibold mb-0.5">{label}</div>
      <div className={`text-xs font-bold ${accent}`}>{value}</div>
    </div>
  );
}

function DayTimeline({ date, list, onOpen }: { date: string; list: Booking[]; onOpen: (d: string) => void }) {
  const hours = Array.from({ length: 16 }, (_, i) => i + 8); // 8 AM - 11 PM
  const conflicts = detectConflicts(list);

  if (list.length === 0) {
    return <EmptyState title="لا توجد حجوزات" description="هذا اليوم متاح بالكامل لحجوزات جديدة" />;
  }

  return (
    <div className="space-y-1.5">
      <button onClick={() => onOpen(date)} className="w-full mb-3 text-[11px] text-gold font-bold hover:underline">
        عرض التفاصيل الكاملة ←
      </button>
      {hours.map(h => {
        const hourStr = String(h).padStart(2, "0");
        const slotBookings = list.filter(b => {
          const sh = parseInt(b.start_time.slice(0, 2));
          const eh = parseInt(b.end_time.slice(0, 2));
          return sh <= h && eh > h;
        });
        return (
          <div key={h} className="flex gap-3 items-stretch min-h-[56px]">
            <div className="w-14 text-xs font-mono font-bold text-muted-foreground pt-2 text-left">{hourStr}:00</div>
            <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(slotBookings.length, 1)}, minmax(0, 1fr))` }}>
              {slotBookings.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/40" />
              ) : slotBookings.map(b => {
                const c = statusColor[b.status];
                const isConflict = conflicts.has(b.id);
                return (
                  <button key={b.id} onClick={() => onOpen(date)}
                    className={`text-right p-2.5 rounded-xl border backdrop-blur transition hover:-translate-y-0.5 hover:shadow-elegant ${
                      isConflict ? "border-destructive/50 bg-destructive/10" :
                      `border-border/50 ${c.bg}`
                    }`}>
                    <div className={`text-[11px] font-bold flex items-center gap-1 ${c.text}`}>
                      {isConflict && <AlertTriangle className="size-3" />}
                      {b.customer_name}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {eventTypeLabels[b.event_type]} • {b.start_time.slice(0,5)} - {b.end_time.slice(0,5)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
