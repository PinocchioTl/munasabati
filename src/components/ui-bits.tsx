import { ReactNode } from "react";
import { statusLabels, BookingStatus } from "@/lib/db";
import { Inbox, Loader2 } from "lucide-react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-card rounded-2xl border border-border/70 shadow-elegant hover-lift ${className}`}>
      {children}
    </div>
  );
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const statusStyles: Record<BookingStatus, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  confirmed: "bg-success/15 text-success border-success/30",
  in_progress: "bg-info/15 text-info border-info/30",
  completed: "bg-[oklch(0.55_0.18_295)]/15 text-[oklch(0.65_0.22_295)] border-[oklch(0.55_0.18_295)]/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${statusStyles[status]}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </span>
  );
}

export function Button({ children, variant = "primary", size = "md", className = "", loading, disabled, ...props }: any) {
  const variants: Record<string, string> = {
    primary: "bg-primary text-primary-foreground hover:opacity-90 shadow-elegant",
    gold: "bg-gradient-gold text-primary shadow-gold hover:opacity-95",
    outline: "border border-border bg-card hover:bg-secondary",
    ghost: "hover:bg-secondary",
    destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
  };
  const sizes: Record<string, string> = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-base",
  };
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-24 rounded-2xl bg-secondary/50 animate-pulse" />
      ))}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <Card className="p-12 text-center">
      <div className="mx-auto size-16 rounded-2xl bg-secondary/60 flex items-center justify-center text-muted-foreground">
        <Inbox className="size-7" />
      </div>
      <div className="mt-4 font-bold text-lg">{title}</div>
      {description && <div className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">{description}</div>}
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}
