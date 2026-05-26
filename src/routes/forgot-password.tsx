import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, Field, inputCls } from "@/components/AuthShell";
import { Button } from "@/components/ui-bits";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email) return setError("أدخل بريدك الإلكتروني");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return setError(error.message);
    setSent(true);
  }

  if (sent) {
    return (
      <AuthShell title="تحقق من بريدك" subtitle="أرسلنا لك رابط استعادة كلمة المرور">
        <div className="text-center space-y-4">
          <div className="mx-auto size-16 rounded-2xl bg-success/15 flex items-center justify-center">
            <CheckCircle2 className="size-8 text-success" />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            تم إرسال رسالة إلى <span className="font-semibold text-foreground">{email}</span>.
            افتح الرابط لإعادة تعيين كلمة المرور.
          </p>
          <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:text-gold">
            <ArrowLeft className="size-4" /> العودة لتسجيل الدخول
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="نسيت كلمة المرور؟"
      subtitle="أدخل بريدك لإرسال رابط الاستعادة"
      footer={<Link to="/login" className="font-semibold text-foreground hover:text-gold">العودة لتسجيل الدخول</Link>}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="البريد الإلكتروني">
          <div className="relative">
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className={`${inputCls} pr-10`} placeholder="you@example.com" />
          </div>
        </Field>
        {error && <div className="rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs px-3 py-2">{error}</div>}
        <Button type="submit" loading={loading} className="w-full" size="lg" variant="gold">
          إرسال رابط الاستعادة
        </Button>
      </form>
    </AuthShell>
  );
}
