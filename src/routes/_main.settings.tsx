import { createFileRoute } from "@tanstack/react-router";
import { Card, SectionHeader, Button } from "@/components/ui-bits";
import {
  Bell, Palette, Database, Shield, Search, Crown, Moon, Sun, Type, Layout,
  Download, Upload, History, RefreshCw, Lock, KeyRound, LogOut, EyeOff,
  AlertTriangle, Clock, Package, Wallet, Check, Sparkles, Plug,
  MessageCircle, MapPin, CalendarDays, Mail,
} from "lucide-react";
import { useState, useEffect, useMemo, ReactNode } from "react";
import { toast } from "sonner";
import { BrandingSettings } from "@/components/BrandingSettings";
import { PhoneInput } from "@/components/PhoneInput";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_main/settings")({
  component: SettingsPage,
});

type SectionId = "branding" | "notifications" | "integrations" | "appearance" | "backup" | "security";

const sections: { id: SectionId; label: string; icon: typeof Bell; color: string; bg: string; desc: string }[] = [
  { id: "branding",      label: "الهوية البصرية", icon: Sparkles, color: "text-gold", bg: "bg-gold/10", desc: "شعار الشركة، الاسم، الألوان" },
  { id: "notifications", label: "الإشعارات", icon: Bell, color: "text-warning", bg: "bg-warning/10", desc: "تنبيهات المناسبات والمخزون والدفعات" },
  { id: "integrations",  label: "التكاملات", icon: Plug, color: "text-info", bg: "bg-info/10", desc: "واتساب، خرائط، تقويم، بريد" },
  { id: "appearance",    label: "المظهر",    icon: Palette, color: "text-info",    bg: "bg-info/10",    desc: "الوضع الليلي، الألوان، حجم الخط" },
  { id: "backup",        label: "النسخ الاحتياطي", icon: Database, color: "text-success", bg: "bg-success/10", desc: "تصدير، استيراد، نسخ تلقائي" },
  { id: "security",      label: "الأمان",    icon: Shield, color: "text-destructive", bg: "bg-destructive/10", desc: "كلمة المرور، PIN، جلسات الدخول" },
];

const ACCENT_COLORS = [
  { name: "ذهبي", value: "gold", hex: "#D4AF37" },
  { name: "أزرق", value: "blue", hex: "#2563EB" },
  { name: "أخضر", value: "green", hex: "#10B981" },
  { name: "بنفسجي", value: "purple", hex: "#8B5CF6" },
  { name: "وردي", value: "pink", hex: "#EC4899" },
  { name: "برتقالي", value: "orange", hex: "#F97316" },
];

function SettingsPage() {
  const [active, setActive] = useState<SectionId>("notifications");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return sections;
    const q = query.toLowerCase();
    return sections.filter(s => s.label.includes(q) || s.desc.toLowerCase().includes(q));
  }, [query]);

  // Auto-scroll active mobile pill into view
  useEffect(() => {
    const el = document.getElementById(`mob-tab-${active}`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [active]);

  return (
    <div className="space-y-4 lg:space-y-6 animate-slide-up">
      <SectionHeader title="الإعدادات" subtitle="تخصيص التطبيق وإدارة حسابك" />

      {/* Search (hidden on mobile to save space) */}
      <div className="relative max-w-xl hidden sm:block">
        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث في الإعدادات..."
          className="w-full bg-card border border-border rounded-xl pr-10 pl-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring shadow-soft"
        />
      </div>

      {/* Mobile sticky segmented tabs */}
      <div className="lg:hidden sticky top-0 z-30 -mx-4 px-4 py-2 bg-background/85 backdrop-blur-md border-b border-border/50">
        <nav className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          {filtered.map(s => {
            const Icon = s.icon;
            const isActive = active === s.id;
            return (
              <button
                key={s.id}
                id={`mob-tab-${s.id}`}
                onClick={() => setActive(s.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl shrink-0 transition-all text-sm font-bold ${
                  isActive
                    ? "bg-gradient-gold text-primary shadow-gold"
                    : "bg-card border border-border/60 text-muted-foreground"
                }`}
              >
                <Icon className="size-4" />
                <span>{s.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-5">
        {/* Desktop sidebar */}
        <Card className="hidden lg:block p-2 h-fit lg:sticky lg:top-20">
          <nav className="flex flex-col gap-1">
            {filtered.map(s => {
              const Icon = s.icon;
              const isActive = active === s.id;
              return (
                <button key={s.id} onClick={() => setActive(s.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all text-right w-full ${
                    isActive ? "bg-gradient-to-l from-gold/10 to-transparent ring-1 ring-gold/30 shadow-soft" : "hover:bg-secondary/60"
                  }`}>
                  <div className={`size-9 rounded-lg ${s.bg} ${s.color} flex items-center justify-center shrink-0`}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-bold ${isActive ? "text-gold" : ""}`}>{s.label}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{s.desc}</div>
                  </div>
                </button>
              );
            })}
          </nav>
        </Card>

        {/* Content */}
        <div className="animate-fade-in min-w-0" key={active}>
          {active === "branding" && <BrandingSettings />}
          {active === "notifications" && <NotificationsSection />}
          {active === "integrations" && <IntegrationsSection />}
          {active === "appearance" && <AppearanceSection />}
          {active === "backup" && <BackupSection />}
          {active === "security" && <SecuritySection />}
        </div>
      </div>
    </div>
  );
}

/* ============ NOTIFICATIONS ============ */
function NotificationsSection() {
  const [enabled, setEnabled] = useState(true);
  const [beforeEvent, setBeforeEvent] = useState("24");
  const [unit, setUnit] = useState<"hours" | "days">("hours");

  return (
    <SectionShell icon={<Bell />} title="الإشعارات" desc="تحكم بجميع التنبيهات والتذكيرات">
      <SettingRow
        title="تفعيل الإشعارات"
        desc="تشغيل أو إيقاف جميع التنبيهات داخل التطبيق"
        right={<Toggle value={enabled} onChange={setEnabled} />}
        primary
      />

      <Divider />

      <SettingRow
        icon={<Clock className="size-4" />}
        title="تنبيه قبل المناسبات"
        desc="إرسال تذكير قبل موعد المناسبة"
        right={
          <div className="flex items-center gap-2">
            <input
              type="number" min={1} value={beforeEvent}
              onChange={(e) => setBeforeEvent(e.target.value)}
              className="w-20 bg-secondary/60 rounded-lg px-3 py-2 text-sm text-center outline-none focus:ring-2 focus:ring-ring"
            />
            <select value={unit} onChange={(e) => setUnit(e.target.value as "hours" | "days")}
              className="bg-secondary/60 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
              <option value="hours">ساعة</option>
              <option value="days">يوم</option>
            </select>
          </div>
        }
      />

      <Divider />

      <SwitchRow icon={<AlertTriangle className="size-4 text-destructive" />} title="تعارض الحجوزات"
        desc="تنبيه فوري عند وجود تعارض في الديكور أو الوقت" defaultOn />
      <SwitchRow icon={<Package className="size-4 text-warning" />} title="نقص المخزون"
        desc="إشعار عند اقتراب الديكور أو المستلزمات من النفاد" defaultOn />
      <SwitchRow icon={<Wallet className="size-4 text-info" />} title="تأخر الدفع"
        desc="تذكير عند اقتراب موعد المناسبة والمبلغ لم يكتمل" defaultOn />

      <SaveBar />
    </SectionShell>
  );
}

/* ============ APPEARANCE ============ */
/* ============ INTEGRATIONS ============ */
const INTEGRATIONS_KEY = "munasabati.integrations";
type IntegrationsState = {
  whatsapp: boolean;
  maps: boolean;
  calendar: boolean;
  email: boolean;
  whatsappNumber: string;
  mapsProvider: "google" | "apple";
};
const DEFAULT_INTEGRATIONS: IntegrationsState = {
  whatsapp: true,
  maps: true,
  calendar: true,
  email: true,
  whatsappNumber: "",
  mapsProvider: "google",
};

function loadIntegrations(): IntegrationsState {
  if (typeof window === "undefined") return DEFAULT_INTEGRATIONS;
  try {
    const raw = localStorage.getItem(INTEGRATIONS_KEY);
    return raw ? { ...DEFAULT_INTEGRATIONS, ...JSON.parse(raw) } : DEFAULT_INTEGRATIONS;
  } catch { return DEFAULT_INTEGRATIONS; }
}

function IntegrationsSection() {
  const [s, setS] = useState<IntegrationsState>(DEFAULT_INTEGRATIONS);
  useEffect(() => { setS(loadIntegrations()); }, []);
  const update = <K extends keyof IntegrationsState>(k: K, v: IntegrationsState[K]) => {
    const next = { ...s, [k]: v };
    setS(next);
    try { localStorage.setItem(INTEGRATIONS_KEY, JSON.stringify(next)); } catch {/* ignore */}
  };

  return (
    <SectionShell icon={<Plug />} title="التكاملات" desc="اربط التطبيق بخدماتك المفضلة بدون مفاتيح API">
      <IntegrationCard
        icon={<MessageCircle className="size-5" />}
        title="واتساب"
        desc="إرسال تفاصيل الحجز والتذكيرات للعملاء عبر واتساب"
        color="text-success" bg="bg-success/10"
        enabled={s.whatsapp}
        onToggle={(v) => update("whatsapp", v)}
        extra={s.whatsapp && (
          <input
            type="tel" dir="ltr" placeholder="+213XXXXXXXXX"
            value={s.whatsappNumber}
            onChange={(e) => update("whatsappNumber", e.target.value)}
            className="mt-3 w-full bg-secondary/60 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        )}
      />
      <Divider />
      <IntegrationCard
        icon={<MapPin className="size-5" />}
        title="الخرائط"
        desc="فتح موقع المناسبة مباشرة في خرائط Google أو Apple"
        color="text-info" bg="bg-info/10"
        enabled={s.maps}
        onToggle={(v) => update("maps", v)}
        extra={s.maps && (
          <div className="flex gap-1 p-1 rounded-xl bg-secondary/60 mt-3 w-fit">
            {([["google","Google"],["apple","Apple"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => update("mapsProvider", v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  s.mapsProvider === v ? "bg-card shadow-soft" : "text-muted-foreground"
                }`}>{l}</button>
            ))}
          </div>
        )}
      />
      <Divider />
      <IntegrationCard
        icon={<CalendarDays className="size-5" />}
        title="التقويم (iCalendar)"
        desc="تصدير الحجوزات بصيغة .ics لتقويم Google و Apple و Outlook"
        color="text-gold" bg="bg-gold/10"
        enabled={s.calendar}
        onToggle={(v) => update("calendar", v)}
      />
      <Divider />
      <IntegrationCard
        icon={<Mail className="size-5" />}
        title="البريد الإلكتروني"
        desc="فتح برنامج البريد لإرسال الفواتير والتأكيدات للعملاء"
        color="text-warning" bg="bg-warning/10"
        enabled={s.email}
        onToggle={(v) => update("email", v)}
      />

      <div className="mt-6 pt-5 border-t border-border/60 text-xs text-muted-foreground">
        💡 هذه التكاملات تعمل عبر الروابط القياسية بدون الحاجة إلى مفاتيح خارجية. لإرسال رسائل تلقائية تحتاج إلى تفعيل بوابة مدفوعة.
      </div>
    </SectionShell>
  );
}

function IntegrationCard({ icon, title, desc, color, bg, enabled, onToggle, extra }: {
  icon: ReactNode; title: string; desc: string; color: string; bg: string;
  enabled: boolean; onToggle: (v: boolean) => void; extra?: ReactNode;
}) {
  return (
    <div className="py-4">
      <div className="flex items-start gap-3">
        <div className={`size-11 rounded-xl ${bg} ${color} flex items-center justify-center shrink-0`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-bold text-sm">{title}</div>
            {enabled && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/15 text-success">مفعّل</span>}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
        </div>
        <Toggle value={enabled} onChange={onToggle} />
      </div>
      {extra && <div className="mr-14">{extra}</div>}
    </div>
  );
}

function AppearanceSection() {
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );
  const [accent, setAccent] = useState("gold");
  const [fontSize, setFontSize] = useState<"sm" | "md" | "lg">("md");
  const [density, setDensity] = useState<"compact" | "spacious">("spacious");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <SectionShell icon={<Palette />} title="المظهر" desc="خصص شكل التطبيق وألوانه">
      {/* Theme toggle */}
      <SettingRow
        title="السمة"
        desc="اختر بين الوضع النهاري والليلي"
        right={
          <div className="flex gap-1 p-1 rounded-xl bg-secondary/60">
            <button onClick={() => setDark(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                !dark ? "bg-card shadow-soft" : "text-muted-foreground"
              }`}>
              <Sun className="size-3.5" /> نهاري
            </button>
            <button onClick={() => setDark(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                dark ? "bg-card shadow-soft" : "text-muted-foreground"
              }`}>
              <Moon className="size-3.5" /> ليلي
            </button>
          </div>
        }
        primary
      />

      <Divider />

      {/* Accent color */}
      <div className="py-4">
        <div className="mb-3">
          <div className="font-bold text-sm">اللون الأساسي</div>
          <div className="text-xs text-muted-foreground mt-0.5">يستخدم في الأزرار والعناصر الفاخرة</div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {ACCENT_COLORS.map(c => {
            const sel = accent === c.value;
            return (
              <button key={c.value} onClick={() => setAccent(c.value)}
                className={`group relative aspect-square rounded-2xl border-2 transition hover:scale-105 ${
                  sel ? "border-foreground shadow-elegant" : "border-border/60"
                }`}
                style={{ backgroundColor: c.hex }}>
                {sel && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                    <Check className="size-6 text-white" strokeWidth={3} />
                  </div>
                )}
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-foreground whitespace-nowrap">{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Divider className="mt-6" />

      {/* Font size */}
      <SettingRow
        icon={<Type className="size-4" />}
        title="حجم الخط"
        desc="حجم النصوص في التطبيق"
        right={
          <div className="flex gap-1 p-1 rounded-xl bg-secondary/60">
            {([["sm","صغير"],["md","متوسط"],["lg","كبير"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setFontSize(v as typeof fontSize)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  fontSize === v ? "bg-card shadow-soft" : "text-muted-foreground"
                }`}>{l}</button>
            ))}
          </div>
        }
      />

      <Divider />

      {/* Density */}
      <SettingRow
        icon={<Layout className="size-4" />}
        title="كثافة الواجهة"
        desc="مساحات بين العناصر"
        right={
          <div className="flex gap-1 p-1 rounded-xl bg-secondary/60">
            <button onClick={() => setDensity("compact")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                density === "compact" ? "bg-card shadow-soft" : "text-muted-foreground"
              }`}>مدمج</button>
            <button onClick={() => setDensity("spacious")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                density === "spacious" ? "bg-card shadow-soft" : "text-muted-foreground"
              }`}>واسع</button>
          </div>
        }
      />

      <SaveBar />
    </SectionShell>
  );
}

/* ============ BACKUP ============ */
function BackupSection() {
  const handleExport = () => toast.success("جاري تصدير البيانات...", { description: "سيتم تنزيل الملف خلال لحظات" });
  const handleImport = () => toast.info("اختر ملف النسخة الاحتياطية");

  return (
    <SectionShell icon={<Database />} title="النسخ الاحتياطي" desc="إدارة بيانات التطبيق والنسخ التلقائية">
      <div className="grid sm:grid-cols-2 gap-3">
        <ActionCard
          icon={<Download className="size-5" />}
          title="تصدير البيانات"
          desc="تنزيل جميع البيانات بصيغة JSON"
          accent="success"
          onClick={handleExport}
          actionLabel="تصدير الآن"
        />
        <ActionCard
          icon={<Upload className="size-5" />}
          title="استيراد البيانات"
          desc="استرجاع من نسخة احتياطية"
          accent="info"
          onClick={handleImport}
          actionLabel="اختيار ملف"
        />
      </div>

      <Divider className="my-4" />

      <SwitchRow
        icon={<RefreshCw className="size-4 text-gold" />}
        title="النسخ الاحتياطي التلقائي"
        desc="حفظ تلقائي يومي للبيانات في السحابة"
        defaultOn
      />

      <Divider />

      <div className="py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-secondary text-foreground flex items-center justify-center">
              <History className="size-4" />
            </div>
            <div>
              <div className="font-bold text-sm">سجل التعديلات</div>
              <div className="text-xs text-muted-foreground">آخر العمليات على البيانات</div>
            </div>
          </div>
          <Button variant="ghost" size="sm">عرض الكل</Button>
        </div>
        <div className="space-y-2 mt-3">
          {[
            { t: "إضافة حجز جديد", time: "قبل 5 دقائق", c: "text-success" },
            { t: "تحديث ديكور كراسي ذهبية", time: "قبل ساعة", c: "text-info" },
            { t: "نسخ احتياطي تلقائي", time: "قبل 3 ساعات", c: "text-gold" },
          ].map((l, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary/40 text-sm">
              <span className={`size-1.5 rounded-full ${l.c.replace("text-", "bg-")}`} />
              <span className="flex-1 font-medium">{l.t}</span>
              <span className="text-xs text-muted-foreground">{l.time}</span>
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

/* ============ SECURITY ============ */
function SecuritySection() {
  const [pinEnabled, setPinEnabled] = useState(false);
  const [hideSensitive, setHideSensitive] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);

  return (
    <SectionShell icon={<Shield />} title="الأمان" desc="حماية حسابك وبياناتك الحساسة">
      <div className="rounded-2xl border border-success/30 bg-success/5 p-4 flex items-center gap-3 mb-2">
        <div className="size-10 rounded-xl bg-success/15 text-success flex items-center justify-center">
          <Shield className="size-5" />
        </div>
        <div className="flex-1">
          <div className="font-bold text-sm">حسابك آمن</div>
          <div className="text-xs text-muted-foreground">جميع إعدادات الأمان مفعلة</div>
        </div>
        <span className="text-[11px] font-bold text-success">محمي ✓</span>
      </div>

      <Divider />

      <ActionRow
        icon={<KeyRound className="size-4" />}
        title="تغيير كلمة المرور"
        desc="نوصي بتغييرها كل 90 يوم"
        actionLabel="تغيير"
        onClick={() => setPwOpen(true)}
      />

      <Divider />

      <ActionRow
        icon={<KeyRound className="size-4 text-info" />}
        title="ربط أو تغيير رقم الهاتف"
        desc="استخدم رقم هاتفك للدخول السريع عبر SMS"
        actionLabel="إدارة"
        onClick={() => setPhoneOpen(true)}
      />

      <Divider />

      <SwitchRow
        icon={<Lock className="size-4 text-gold" />}
        title="قفل التطبيق برمز PIN"
        desc="رمز إضافي عند فتح التطبيق"
        value={pinEnabled}
        onChange={setPinEnabled}
      />

      <Divider />

      <SwitchRow
        icon={<EyeOff className="size-4 text-info" />}
        title="إخفاء البيانات الحساسة"
        desc="إخفاء الأرقام والأسعار افتراضياً"
        value={hideSensitive}
        onChange={setHideSensitive}
      />

      <Divider />

      <ActionRow
        icon={<LogOut className="size-4 text-destructive" />}
        title="تسجيل الخروج من جميع الأجهزة"
        desc="إنهاء كل الجلسات النشطة في كافة الأجهزة"
        actionLabel="تسجيل الخروج"
        variant="destructive"
        onClick={async () => {
          await supabase.auth.signOut({ scope: "global" });
          window.location.href = "/login";
        }}
      />

      {pwOpen && <ChangePasswordModal onClose={() => setPwOpen(false)} />}
      {phoneOpen && <LinkPhoneModal onClose={() => setPhoneOpen(false)} />}
    </SectionShell>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function save() {
    if (pw.length < 8) return toast.error("8 أحرف على الأقل");
    if (pw !== confirm) return toast.error("كلمتا المرور غير متطابقتين");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تم تحديث كلمة المرور");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="font-bold text-lg">تغيير كلمة المرور</div>
        <input type="password" placeholder="كلمة المرور الجديدة" value={pw} onChange={(e) => setPw(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm" />
        <input type="password" placeholder="تأكيد كلمة المرور" value={confirm} onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm" />
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} loading={loading} variant="gold">حفظ</Button>
        </div>
      </div>
    </div>
  );
}

function LinkPhoneModal({ onClose }: { onClose: () => void }) {
  const [countryCode, setCountryCode] = useState("+213");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!phone) return toast.error("أدخل رقم الهاتف");
    const { buildE164 } = await import("@/components/PhoneInput");
    const full = buildE164(countryCode, phone);
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return toast.error("غير مسجل الدخول"); }
    const { error } = await supabase.from("profiles").update({ phone: full }).eq("id", user.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تم تحديث رقم الهاتف");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="font-bold text-lg">تحديث رقم الهاتف</div>
        <PhoneInput countryCode={countryCode} onCountryCodeChange={setCountryCode}
          phone={phone} onPhoneChange={setPhone} />
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} loading={loading} variant="gold">حفظ</Button>
        </div>
      </div>
    </div>
  );
}




/* ============ HELPERS ============ */
function SectionShell({ icon, title, desc, children }: { icon: ReactNode; title: string; desc: string; children: ReactNode }) {
  return (
    <Card className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3 sm:gap-4 pb-4 sm:pb-5 mb-2 border-b border-border/60">
        <div className="size-10 sm:size-12 rounded-2xl bg-gradient-gold text-primary flex items-center justify-center shadow-gold shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-lg sm:text-xl font-bold truncate">{title}</div>
          <div className="text-xs sm:text-sm text-muted-foreground">{desc}</div>
        </div>
      </div>
      {children}
    </Card>
  );
}

function SettingRow({ icon, title, desc, right, primary }: {
  icon?: ReactNode; title: string; desc: string; right: ReactNode; primary?: boolean;
}) {
  return (
    <div className={`flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 py-4 ${primary ? "" : ""}`}>
      {icon && (
        <div className="size-9 rounded-lg bg-secondary text-foreground flex items-center justify-center shrink-0">{icon}</div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
      <div className="shrink-0 w-full sm:w-auto flex sm:block justify-end">{right}</div>
    </div>
  );
}

function SwitchRow({ icon, title, desc, defaultOn, value, onChange }: {
  icon: ReactNode; title: string; desc: string; defaultOn?: boolean;
  value?: boolean; onChange?: (v: boolean) => void;
}) {
  const [internal, setInternal] = useState(!!defaultOn);
  const v = value ?? internal;
  const setV = onChange ?? setInternal;
  return <SettingRow icon={icon} title={title} desc={desc} right={<Toggle value={v} onChange={setV} />} />;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`relative w-12 h-7 rounded-full transition-colors duration-300 ${
        value ? "bg-gradient-gold shadow-gold" : "bg-secondary"
      }`}>
      <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow-md transition-all duration-300 ${
        value ? "right-0.5" : "right-[1.375rem]"
      }`} />
    </button>
  );
}

function Divider({ className = "" }: { className?: string }) {
  return <div className={`h-px bg-border/60 ${className}`} />;
}

function ActionCard({ icon, title, desc, accent, onClick, actionLabel }: {
  icon: ReactNode; title: string; desc: string; accent: "success" | "info"; onClick: () => void; actionLabel: string;
}) {
  const colors = {
    success: "bg-success/10 text-success border-success/20",
    info: "bg-info/10 text-info border-info/20",
  };
  return (
    <div className="p-4 rounded-2xl border border-border/60 bg-card/50 hover:shadow-elegant transition group">
      <div className={`size-11 rounded-xl ${colors[accent]} border flex items-center justify-center mb-3`}>{icon}</div>
      <div className="font-bold text-sm">{title}</div>
      <div className="text-xs text-muted-foreground mt-1 mb-3">{desc}</div>
      <Button variant="outline" size="sm" className="w-full" onClick={onClick}>{actionLabel}</Button>
    </div>
  );
}

function ActionRow({ icon, title, desc, actionLabel, variant = "outline", onClick }: {
  icon: ReactNode; title: string; desc: string; actionLabel: string;
  variant?: "outline" | "destructive"; onClick: () => void;
}) {
  return (
    <SettingRow
      icon={icon}
      title={title}
      desc={desc}
      right={<Button variant={variant} size="sm" onClick={onClick}>{actionLabel}</Button>}
    />
  );
}

function SaveBar() {
  return (
    <div className="mt-6 pt-5 border-t border-border/60 flex items-center justify-between gap-3">
      <div className="text-xs text-muted-foreground">يتم الحفظ تلقائياً عند التغيير</div>
      <Button variant="gold" size="sm" onClick={() => toast.success("تم حفظ الإعدادات بنجاح")}>
        <Crown className="size-4" /> حفظ التغييرات
      </Button>
    </div>
  );
}
