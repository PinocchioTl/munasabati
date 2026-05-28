import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Mail, Lock, LogIn } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, Field, inputCls } from "@/components/AuthShell";
import { Button } from "@/components/ui-bits";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

async function logAttempt(identifier: string, success: boolean, error?: string) {
  try {
    await supabase.from("login_attempts").insert({
      identifier, method: "email", success, error_message: error ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch {}
}

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !password) return setError("الرجاء إدخال جميع الحقول");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    await logAttempt(email.trim(), !error, error?.message);
    if (error) return setError(error.message.includes("Invalid") ? "البريد أو كلمة المرور غير صحيحة" : error.message);
    toast.success("تم تسجيل الدخول بنجاح");
    navigate({ to: "/" });
  }

  return (
    <AuthShell
      title="مرحباً بك"
      subtitle="سجل الدخول لإدارة أعراسك ومناسباتك"
      footer={<>ليس لديك حساب؟ <Link to="/signup" className="font-semibold text-foreground hover:text-gold">أنشئ حساباً جديداً</Link></>}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="البريد الإلكتروني">
          <div className="relative">
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className={`${inputCls} pr-10`} placeholder="you@example.com" autoComplete="email" />
          </div>
        </Field>
        <Field label="كلمة المرور">
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
              className={`${inputCls} pr-10 pl-10`} placeholder="••••••••" autoComplete="current-password" />
            <button type="button" onClick={() => setShow(!show)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <div className="text-left text-xs">
          <Link to="/forgot-password" className="font-semibold text-foreground hover:text-gold">نسيت كلمة المرور؟</Link>
        </div>
        {error && <div className="rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs px-3 py-2">{error}</div>}
        <Button type="submit" loading={loading} className="w-full" size="lg" variant="gold">
          <LogIn className="size-4" /> تسجيل الدخول
        </Button>
      </form>
    </AuthShell>
  );
}
