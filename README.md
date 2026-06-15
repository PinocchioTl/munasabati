# Munasabati - Electron Desktop Application

تطبيق ويب محدثة لتطبيق سطح المكتب Electron مع دعم كامل للعمل أوفلاين والمزامنة الذكية للبيانات.

## ✨ الميزات الرئيسية

### 1. **تطبيق سطح المكتب EXE**
- بناء باستخدام **Electron** و **React**
- واجهة حديثة وسلسة
- قاعدة بيانات محلية باستخدام **SQLite**
- توزيع سهل (NSIS + Portable)

### 2. **العمل Offline/Online**
- تطبيق يعمل بدون اتصال بالإنترنت
- مزامنة تلقائية عند استعادة الاتصال
- Service Workers لدعم PWA

### 3. **نظام المزامنة الذكي**
- تخزين البيانات محليًا في **SQLite**
- طابور عمليات للبيانات المعلقة
- كشف ومعالجة التضاربات التلقائية
- مزامنة ثنائية الاتجاه

### 4. **المزامنة التلقائية**
- مراقبة مستمرة لحالة الاتصال
- مزامنة فورية عند الاتصال بالإنترنت
- تحديثات الخادم تُطبق تلقائيًا محليًا
- واجهة لعرض حالة المزامنة

### 5. **تخزين البيانات الموثوق**
- **SQLite** محلية للبيانات المعقدة
- **IndexedDB** (عبر Electron Store) للتخزين المؤقت
- **Service Workers** للملفات الثابتة
- حفظ تلقائي للبيانات

## 🏗️ بنية المشروع

```
munasabati/
├── electron/                    # كود Electron الرئيسي
│   ├── main.ts                 # عملية Electron الرئيسية
│   ├── preload.ts              # سكريبت preload آمن
│   ├── sync-manager.ts         # مدير المزامنة الذكي
│   └── ipc-handlers.ts         # معالجات الاتصال بين العمليات
├── src/                         # كود React
│   ├── hooks/
│   │   ├── useElectronDB.ts    # Hook لعمليات قاعدة البيانات
│   │   └── useSync.ts          # Hook لإدارة المزامنة
│   └── components/
│       └── SyncStatus.tsx      # مكون عرض حالة المزامنة
├── public/
│   └── service-worker.ts       # Service Worker للدعم Offline
├── assets/                      # الرموز والموارد
├── vite.config.ts              # إعدادات Vite
├── electron-builder.yml        # إعدادات بناء التطبيق
└── package.json                # المعتمديات والسكريبتات
```

## 🚀 البدء السريع

### المتطلبات
- Node.js 18+ 
- npm أو yarn

### التثبيت والتطوير

```bash
# تثبيت المعتمديات
npm install

# تشغيل في وضع التطوير
npm run dev

# تشغيل Vite فقط (يدويًا)
npm run dev:vite

# تشغيل Electron فقط
npm run dev:electron
```

### البناء والتوزيع

```bash
# بناء التطبيق EXE
npm run build:exe

# بناء محمول (بدون installer)
npm run build:vite && electron-builder --win portable

# بناء مع Installer (NSIS)
npm run build:vite && electron-builder --win nsis
```

## 🔄 كيفية عمل نظام المزامنة

### التدفق الأساسي

1. **أثناء الاتصال بالإنترنت:**
   - جميع التغييرات تُحفظ محليًا أولاً
   - ثم تُرسل للخادم فورًا
   - الخادم يرسل التأكيد

2. **أثناء انقطاع الاتصال:**
   - التغييرات تُحفظ محليًا فقط
   - تُضاف إلى طابور المزامنة
   - يعرض التطبيق رسالة "offline"

3. **عند العودة للاتصال:**
   - المزامنة تبدأ تلقائيًا
   - يتم إرسال العمليات المعلقة
   - يتم جلب التحديثات من الخادم
   - يتم حل التضاربات تلقائيًا

### معالجة التضاربات

```typescript
// الاستراتيجيات المتاحة:
- 'remote': الأولوية للبيانات من الخادم
- 'local': الأولوية للبيانات المحلية
- 'merge': دمج ذكي للبيانات
```

## 🎯 الاستخدام في الكود

### استخدام قاعدة البيانات

```typescript
import { useElectronDB } from '@/hooks/useElectronDB';

function MyComponent() {
  const { data, insert, update, remove, loading, error } = 
    useElectronDB({ table: 'tasks' });

  const handleAdd = async () => {
    await insert({ 
      title: 'مهمة جديدة',
      description: 'وصف المهمة'
    });
  };

  return (
    // عرض البيانات
  );
}
```

### الاستماع لأحداث المزامنة

```typescript
import { useSync } from '@/hooks/useSync';

function StatusBar() {
  const { status, error, forceSync } = useSync();

  return (
    <div>
      <p>الحالة: {status.isOnline ? 'اتصال' : 'بدون اتصال'}</p>
      <p>قيد الانتظار: {status.pendingOperations}</p>
      <button onClick={forceSync}>
        مزامنة فورية
      </button>
    </div>
  );
}
```

### إضافة عملية للمزامنة

```typescript
const { queueOperation } = useSync();

const syncData = async (data) => {
  await queueOperation({
    id: uuidv4(),
    entityType: 'tasks',
    entityId: data.id,
    operation: 'create', // أو 'update' أو 'delete'
    data,
    timestamp: Date.now(),
  });
};
```

## 🔐 الأمان

### تفاصيل الأمان المُطبقة

- **Context Isolation**: منع الوصول المباشر للـ APIs
- **Preload Script**: وسيط آمن بين العمليات
- **IPC Handlers**: معالجة آمنة للاتصالات
- **Sandbox Mode**: تشغيل عمليات معزولة
- **No Node Integration**: منع تضمين Node.js في Renderer

### الاتصال الآمن بين العمليات

```typescript
// في Preload
contextBridge.exposeInMainWorld('electronAPI', {
  db: { /* methods */ },
  sync: { /* methods */ }
});

// في Renderer (React)
await window.electronAPI.db.insert('table', data);
```

## 📊 قاعدة البيانات

### الجداول الأساسية

```sql
-- جدول المستخدمين
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  synced_at DATETIME
);

-- جدول المهام
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  synced_at DATETIME,
  is_deleted INTEGER DEFAULT 0
);

-- طابور المزامنة
CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  data TEXT,
  created_at DATETIME,
  synced INTEGER DEFAULT 0
);
```

## 🔧 متغيرات البيئة

أنشئ ملف `.env` في جذر المشروع:

```env
VITE_API_URL=http://localhost:3000/api
VITE_APP_NAME=Munasabati
```

## 📦 بناء التطبيق

### إخراجات البناء

- `release/Munasabati-Setup-*.exe` - مثبت Windows
- `release/Munasabati-*-portable.exe` - نسخة محمولة
- `release/builder-effective-config.yaml` - إعدادات البناء

### الخيارات المتاحة

```bash
# Windows NSIS (مع مثبت)
npm run build:exe

# Windows Portable (بدون مثبت)
electron-builder --win portable

# macOS (إذا لزم الأمر)
electron-builder --mac

# Linux (إذا لزم الأمر)
electron-builder --linux
```

## 🧪 الاختبار

```bash
# تشغيل Linter
npm run lint

# تنسيق الكود
npm run format
```

## 📚 الموارد الإضافية

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev)
- [TanStack Router](https://tanstack.com/router/latest)
- [SQLite](https://www.sqlite.org/)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

## 🐛 استكشاف الأخطاء

### المشاكل الشائعة

#### "Cannot find module 'better-sqlite3'"
```bash
npm install
npm rebuild
```

#### الخادم لا يستجيب (offline mode)
- تحقق من اتصالك بالإنترنت
- تحقق من URL الخادم في المتغيرات البيئية
- تحقق من سجلات المزامنة في console

#### البيانات لا تُحفظ
- تأكد من أن SQLite يعمل بشكل صحيح
- تحقق من صلاحيات المجلد

## 📝 الترخيص

MIT

## 👨‍💻 الدعم

في حالة وجود أي مشاكل أو اقتراحات، يرجى فتح issue أو pull request.

---

**ملاحظة:** هذا التطبيق يدعم العمل Offline بالكامل مع المزامنة التلقائية الذكية!
