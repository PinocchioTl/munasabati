import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, Field, inputCls } from "@/components/AuthShell";
import { Button } from "@/components/ui-bits";

export const Route = createFileRoute("/reset-password")({
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("8 أحرف على الأقل");
    if (password !== confirm) return setError("كلمتا المرور غير متطابقتين");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message);
    toast.success("تم تحديث كلمة المرور");
    navigate({ to: "/" });
  }

  return (
    <AuthShell title="تعيين كلمة مرور جديدة" subtitle="اختر كلمة مرور قوية لحماية حسابك">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="كلمة المرور الجديدة">
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
              className={`${inputCls} pr-10 pl-10`} placeholder="••••••••" />
            <button type="button" onClick={() => setShow(!show)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <Field label="تأكيد كلمة المرور">
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className={`${inputCls} pr-10`} placeholder="••••••••" />
          </div>
        </Field>
        {error && <div className="rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs px-3 py-2">{error}</div>}
        <Button type="submit" loading={loading} className="w-full" size="lg" variant="gold">
          <ShieldCheck className="size-4" /> حفظ كلمة المرور
        </Button>
      </form>
    </AuthShell>
  );
}
