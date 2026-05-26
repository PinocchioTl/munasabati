import { useState, useEffect, ReactNode, useRef } from "react";
import { X, Upload, ImagePlus, Trash2 } from "lucide-react";
import { Button, Card } from "@/components/ui-bits";
import { toast } from "sonner";
import { useUpsertDecoration, useUpdateDecoration, useDeleteDecoration, useUpsertSupply, useUpdateSupply, useDeleteSupply, uploadItemImages, type Supply, type Decoration } from "@/lib/db";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-semibold text-muted-foreground mb-1.5">{label}</div>
      {children}
    </label>
  );
}

const inputCls = "w-full bg-secondary/60 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg max-h-[92vh] overflow-y-auto animate-scale-in">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="font-bold text-lg">{title}</div>
            <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg"><X className="size-5" /></button>
          </div>
          {children}
        </Card>
      </div>
    </div>
  );
}

function ImageUploader({ images, setImages }: { images: string[]; setImages: (u: string[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await uploadItemImages(files);
      setImages([...images, ...urls]);
      toast.success(`تم رفع ${urls.length} صورة`);
    } catch (err: any) {
      toast.error(err.message || "تعذّر رفع الصور");
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <div>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={onPick} />
      <div className="grid grid-cols-4 gap-2">
        {images.map((url, i) => (
          <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-border group">
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))}
              className="absolute top-1 left-1 size-7 rounded-lg bg-destructive/90 text-destructive-foreground opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
          className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-gold hover:bg-gold/5 transition flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-gold disabled:opacity-50">
          {uploading ? <Upload className="size-5 animate-pulse" /> : <ImagePlus className="size-5" />}
          <span className="text-[10px] font-semibold">{uploading ? "جاري الرفع..." : "إضافة"}</span>
        </button>
      </div>
    </div>
  );
}

export function DecorationDialog({ open, onClose, decoration }: { open: boolean; onClose: () => void; decoration?: Decoration | null }) {
  const isEdit = !!decoration?.id;
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [totalQty, setTotalQty] = useState("1");
  const [images, setImages] = useState<string[]>([]);
  const upsert = useUpsertDecoration();
  const update = useUpdateDecoration();
  const del = useDeleteDecoration();

  useEffect(() => {
    if (!open) return;
    if (decoration) {
      setName(decoration.name);
      setCategory(decoration.category || "");
      setPrice(String(decoration.price));
      setTotalQty(String(decoration.total_qty));
      setImages(decoration.images || []);
    } else {
      setName(""); setCategory(""); setPrice(""); setTotalQty("1"); setImages([]);
    }
  }, [open, decoration]);

  const validate = () => {
    if (!name.trim()) { toast.error("اسم الديكور مطلوب"); return false; }
    if (!category.trim()) { toast.error("التصنيف مطلوب"); return false; }
    const p = Number(price);
    if (!Number.isFinite(p) || p < 0) { toast.error("السعر غير صحيح"); return false; }
    const q = Number(totalQty);
    if (!Number.isFinite(q) || q <= 0) { toast.error("الكمية يجب أن تكون أكبر من 0"); return false; }
    if (isEdit && images.length === 0) { toast.error("أضف صورة واحدة على الأقل"); return false; }
    return true;
  };

  const submit = async () => {
    if (!validate()) return;
    try {
      if (isEdit && decoration) {
        await update.mutateAsync({
          id: decoration.id,
          name, category,
          price: Number(price) || 0,
          total_qty: Number(totalQty) || 0,
          images,
        });
        toast.success("تم تحديث الديكور بنجاح");
      } else {
        const res = await upsert.mutateAsync({
          name, category,
          price: Number(price) || 0,
          total_qty: Number(totalQty) || 0,
          images,
        });
        toast.success(res.updated ? "تم تحديث الديكور الموجود" : "تمت إضافة الديكور بنجاح");
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message || "تعذّر الحفظ");
    }
  };

  const onDelete = async () => {
    if (!decoration) return;
    if (!confirm(`حذف "${decoration.name}" نهائياً؟`)) return;
    try {
      await del.mutateAsync(decoration.id);
      toast.success("تم حذف الديكور");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "تعذّر الحذف");
    }
  };

  const loading = upsert.isPending || update.isPending;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "تعديل الديكور" : "إضافة ديكور جديد"}>
      <div className="space-y-3">
        <Field label="اسم الديكور *">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="مثل: قوس ذهبي" />
        </Field>
        <Field label="التصنيف *">
          <input className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)} maxLength={50} placeholder="مثل: أقواس، كراسي، إضاءة" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="السعر (د.ج) *">
            <input type="number" min="0" inputMode="decimal" className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field label="الكمية الكلية *">
            <input type="number" min="1" inputMode="numeric" className={inputCls} value={totalQty} onChange={(e) => setTotalQty(e.target.value)} />
          </Field>
        </div>
        <Field label="الصور">
          <ImageUploader images={images} setImages={setImages} />
        </Field>
        {isEdit && decoration && (
          <div className="text-[11px] text-muted-foreground bg-secondary/40 rounded-xl p-3">
            المحجوز حالياً: {decoration.booked_qty} — لا يمكن تقليل الكمية لأقل من ذلك. الحجوزات المرتبطة لن تتأثر.
          </div>
        )}
        {!isEdit && (
          <div className="text-[11px] text-muted-foreground bg-info/10 border border-info/20 rounded-xl p-3">
            إن وُجد ديكور بنفس الاسم سيتم تحديثه تلقائياً بدل إنشاء عنصر مكرر.
          </div>
        )}
        <div className="flex gap-2 pt-2">
          {isEdit && (
            <Button variant="outline" onClick={onDelete} loading={del.isPending} className="text-destructive hover:bg-destructive/10">
              <Trash2 className="size-4" />حذف
            </Button>
          )}
          <Button variant="outline" className="flex-1" onClick={onClose}>إلغاء</Button>
          <Button variant="gold" className="flex-1" loading={loading} onClick={submit}>حفظ</Button>
        </div>
      </div>
    </Modal>
  );
}


export function SupplyDialog({ open, onClose, supply }: { open: boolean; onClose: () => void; supply?: Supply | null }) {
  const isEdit = !!supply?.id;
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [totalQty, setTotalQty] = useState("1");
  const [minAlert, setMinAlert] = useState("5");
  const [supplier, setSupplier] = useState("");
  const [cost, setCost] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const upsert = useUpsertSupply();
  const update = useUpdateSupply();
  const del = useDeleteSupply();

  useEffect(() => {
    if (!open) return;
    if (supply) {
      setName(supply.name);
      setCategory(supply.category || "");
      setTotalQty(String(supply.total_qty));
      setMinAlert(String(supply.min_alert));
      setSupplier(supply.supplier || "");
      setCost(String(supply.cost));
      setImages(supply.images || []);
      setNotes(supply.notes || "");
    } else {
      setName(""); setCategory(""); setTotalQty("1"); setMinAlert("5");
      setSupplier(""); setCost(""); setImages([]); setNotes("");
    }
  }, [open, supply]);

  const validate = () => {
    if (!name.trim()) { toast.error("اسم المستلزم مطلوب"); return false; }
    const q = Number(totalQty);
    if (!Number.isFinite(q) || q < 0) { toast.error("الكمية غير صحيحة"); return false; }
    const m = Number(minAlert);
    if (!Number.isFinite(m) || m < 0) { toast.error("حد التنبيه غير صحيح"); return false; }
    const c = Number(cost) || 0;
    if (c < 0) { toast.error("التكلفة غير صحيحة"); return false; }
    return true;
  };

  const submit = async () => {
    if (!validate()) return;
    const payload = {
      name, category,
      total_qty: Number(totalQty) || 0,
      min_alert: Number(minAlert) || 0,
      supplier,
      cost: Number(cost) || 0,
      images,
      notes,
    };
    try {
      if (isEdit && supply) {
        await update.mutateAsync({ id: supply.id, ...payload });
        toast.success("تم تحديث المستلزم");
      } else {
        const res = await upsert.mutateAsync(payload);
        toast.success(res.updated ? "تم تحديث الكمية للمستلزم الموجود" : "تمت إضافة المستلزم بنجاح");
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message || "تعذّر الحفظ");
    }
  };

  const onDelete = async () => {
    if (!supply) return;
    if (!confirm(`حذف "${supply.name}" نهائياً؟`)) return;
    try {
      await del.mutateAsync(supply.id);
      toast.success("تم حذف المستلزم");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "تعذّر الحذف");
    }
  };

  const loading = upsert.isPending || update.isPending;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "تعديل المستلزم" : "إضافة مستلزم جديد"}>
      <div className="space-y-3">
        <Field label="اسم المستلزم *">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="مثل: شموع، ورود" />
        </Field>
        <Field label="التصنيف">
          <input className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)} maxLength={50} placeholder="اختياري" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الكمية *">
            <input type="number" min="0" className={inputCls} value={totalQty} onChange={(e) => setTotalQty(e.target.value)} />
          </Field>
          <Field label="حد التنبيه *">
            <input type="number" min="0" className={inputCls} value={minAlert} onChange={(e) => setMinAlert(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="المورد">
            <input className={inputCls} value={supplier} onChange={(e) => setSupplier(e.target.value)} maxLength={100} />
          </Field>
          <Field label="التكلفة (د.ج)">
            <input type="number" min="0" className={inputCls} value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
        </div>
        <Field label="الصور">
          <ImageUploader images={images} setImages={setImages} />
        </Field>
        <Field label="ملاحظات">
          <textarea className={`${inputCls} min-h-[72px] resize-y`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="اختياري" />
        </Field>
        {isEdit && supply && (
          <div className="text-[11px] text-muted-foreground bg-secondary/40 rounded-xl p-3">
            المستخدم حالياً: {supply.used_qty} — لا يمكن تقليل الكمية الكلية لأقل من ذلك.
          </div>
        )}
        {!isEdit && (
          <div className="text-[11px] text-muted-foreground bg-info/10 border border-info/20 rounded-xl p-3">
            إن وُجد مستلزم بنفس الاسم ستُضاف الكمية إليه بدل إنشاء سجل مكرر.
          </div>
        )}
        <div className="flex gap-2 pt-2">
          {isEdit && (
            <Button variant="outline" onClick={onDelete} loading={del.isPending} className="text-destructive hover:bg-destructive/10">
              <Trash2 className="size-4" />حذف
            </Button>
          )}
          <Button variant="outline" className="flex-1" onClick={onClose}>إلغاء</Button>
          <Button variant="gold" className="flex-1" loading={loading} onClick={submit}>حفظ</Button>
        </div>
      </div>
    </Modal>
  );
}

