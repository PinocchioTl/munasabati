import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo.png";

export function AuthShell({ title, subtitle, children, footer }: {
  title: string; subtitle?: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div dir="rtl" className="min-h-screen relative flex items-center justify-center px-4 py-10 bg-background overflow-hidden">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -right-32 size-[480px] rounded-full blur-3xl opacity-40"
             style={{ background: "radial-gradient(circle, oklch(0.77 0.13 85 / 0.45), transparent 65%)" }} />
        <div className="absolute -bottom-40 -left-32 size-[520px] rounded-full blur-3xl opacity-40"
             style={{ background: "radial-gradient(circle, oklch(0.22 0.025 260 / 0.55), transparent 65%)" }} />
        <div className="absolute inset-0 opacity-[0.03]"
             style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
      </div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <Link to="/login" className="flex items-center justify-center gap-3 mb-8 group">
          <div className="size-12 rounded-2xl bg-gradient-gold flex items-center justify-center shadow-gold transition group-hover:scale-105 overflow-hidden">
            <img src={logo} alt="Munasabati" className="size-full object-contain p-1.5" />
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-gradient-gold leading-none">Munasabati</div>
            <div className="text-[11px] text-muted-foreground mt-1">مناسبتي — نظم ديكوراتك بسهولة</div>
          </div>
        </Link>

        {/* Glass card */}
        <div className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-xl shadow-luxury p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>}
          </div>
          {children}
        </div>

        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold mb-1.5 text-foreground/80">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground mt-1">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-border bg-background/60 px-4 py-2.5 text-sm outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 placeholder:text-muted-foreground/60";
