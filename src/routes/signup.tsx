import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Mail, Lock, User, UserPlus, Building2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, Field, inputCls } from "@/components/AuthShell";
import { Button } from "@/components/ui-bits";
import { PhoneInput, buildE164 } from "@/components/PhoneInput";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function passwordStrength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) || /[\u0600-\u06FF]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  const arr = [
    { label: "ضعيفة جداً", color: "bg-destructive" },
    { label: "ضعيفة", color: "bg-destructive" },
    { label: "متوسطة", color: "bg-warning" },
    { label: "قوية", color: "bg-info" },
    { label: "قوية جداً", color: "bg-success" },
  ];
  return { score: s, ...arr[s] };
}

function SignupPage() {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [countryCode, setCountryCode] = useState("+213");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const strength = passwordStrength(password);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!companyName.trim()) return setError("يجب إدخال اسم الشركة");
    if (!fullName.trim()) return setError("يجب إدخال الاسم الكامل");
    if (!phone.trim()) return setError("يجب إدخال رقم الهاتف");
    if (!email.trim()) return setError("يجب إدخال البريد الإلكتروني");
    if (password.length < 8) return setError("كلمة المرور 8 أحرف على الأقل");
    if (password !== confirm) return setError("كلمتا المرور غير متطابقتين");

    setLoading(true);
    const fullPhone = buildE164(countryCode, phone);
    const { error: signUpErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName, company_name: companyName, phone: fullPhone },
      },
    });

    if (signUpErr) {
      setLoading(false);
      return setError(signUpErr.message.includes("already") ? "هذا البريد مسجل مسبقاً" : signUpErr.message);
    }

    // Auto sign-in (email auto-confirm is enabled)
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInErr) return setError(signInErr.message);
    toast.success("تم إنشاء الحساب بنجاح");
    navigate({ to: "/" });
  }

  return (
    <AuthShell
      title="أنشئ حساباً جديداً"
      subtitle=""
      footer={<>لديك حساب بالفعل؟ <Link to="/login" className="font-semibold text-foreground hover:text-gold">سجل الدخول</Link></>}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="اسم الشركة">
          <div className="relative">
            <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)}
              className={`${inputCls} pr-10`} placeholder="شركة الأعراس الفاخرة" />
          </div>
        </Field>

        <Field label="الاسم الكامل">
          <div className="relative">
            <User className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input value={fullName} onChange={(e) => setFullName(e.target.value)}
              className={`${inputCls} pr-10`} placeholder="محمد عبدالله" />
          </div>
        </Field>

        <Field label="رقم الهاتف">
          <PhoneInput countryCode={countryCode} onCountryCodeChange={setCountryCode}
            phone={phone} onPhoneChange={setPhone} />
        </Field>

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
              className={`${inputCls} pr-10 pl-10`} placeholder="••••••••" autoComplete="new-password" />
            <button type="button" onClick={() => setShow(!show)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {password && (
            <div className="mt-2">
              <div className="flex gap-1">
                {[0,1,2,3].map((i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full ${i < strength.score ? strength.color : "bg-secondary"}`} />
                ))}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">قوة كلمة المرور: {strength.label}</div>
            </div>
          )}
        </Field>

        <Field label="تأكيد كلمة المرور">
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className={`${inputCls} pr-10`} placeholder="••••••••" autoComplete="new-password" />
          </div>
        </Field>

        {error && <div className="rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs px-3 py-2">{error}</div>}

        <Button type="submit" loading={loading} className="w-full" size="lg" variant="gold">
          <UserPlus className="size-4" /> إنشاء الحساب
        </Button>

        <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
          بإنشائك حساباً فأنت توافق على شروط الاستخدام وسياسة الخصوصية.
        </p>
      </form>
    </AuthShell>
  );
}
