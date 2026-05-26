import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, Package, CalendarDays, Users, ArrowLeft, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY_PREFIX = "glide_onboarding_seen_";

export function OnboardingWelcome() {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      setUserId(uid);
      const seen = localStorage.getItem(STORAGE_KEY_PREFIX + uid);
      if (!seen) setOpen(true);
    });
  }, []);

  const close = () => {
    if (userId) localStorage.setItem(STORAGE_KEY_PREFIX + userId, "1");
    setOpen(false);
  };

  if (!open) return null;

  const steps = [
    { icon: Package, title: "أضف الديكورات", desc: "ابدأ ببناء كتالوج الديكورات الخاص بك", to: "/decorations" },
    { icon: Sparkles, title: "أضف المستلزمات", desc: "نظّم مخزون المستلزمات والمواد", to: "/supplies" },
    { icon: Users, title: "أضف العملاء", desc: "أنشئ قاعدة بيانات الزبائن", to: "/customers" },
    { icon: CalendarDays, title: "سجّل أول حجز", desc: "ابدأ بإدارة حجوزات المناسبات", to: "/bookings" },
  ] as const;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
        <button
          onClick={close}
          className="absolute top-4 left-4 p-2 rounded-lg hover:bg-muted transition"
          aria-label="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-8 pb-6 text-center bg-gradient-to-b from-primary/5 to-transparent">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold mb-2">نظم ديكوراتك بسهولة، وخلي كل مناسبة في وقتها المثالي.</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            منصة مرنة لإدارة أعراسك ومناسباتك من الصفر.
          </p>
        </div>

        <div className="px-8 pb-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {steps.map((s, i) => (
            <Link
              key={s.to}
              to={s.to}
              onClick={close}
              className="group flex items-start gap-3 p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/40 transition"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
                <s.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-sm font-semibold mb-0.5">
                  <span className="text-muted-foreground">{i + 1}.</span> {s.title}
                </div>
                <div className="text-xs text-muted-foreground line-clamp-2">{s.desc}</div>
              </div>
            </Link>
          ))}
        </div>

        <div className="p-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <button
            onClick={close}
            className="text-xs text-muted-foreground hover:text-foreground transition"
          >
            تخطي الآن
          </button>
          <button
            onClick={close}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm shadow-lg hover:opacity-90 transition w-full sm:w-auto justify-center"
          >
            ابدأ الآن
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
