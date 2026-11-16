# Digital Team Tasks Tracker — Ibnsina Pharma

نظام إدارة مهام لفريق الديجيتال (حوالي 20 موظف) بهيكل إداري (مدير ومرؤوس).

**التقنيات:** HTML + CSS + JavaScript (ES modules بدون build) · Supabase (Postgres + Auth + Storage + Realtime + Edge Functions + pg_cron + pg_net) · استضافة static (Vercel أو أي استضافة).

## المميزات
- مهام برقم ثابت (#1، #2…)، حالة، أولوية، تاريخ بداية ونهاية، نسبة إنجاز، خطوات (Checklist) بالسحب والترتيب، ملفات، تعليقات بالمنشن، وسجل نشاط.
- ربط المهام ببعض (متوقفة على / استكمال لـ)، ومنشن الموظفين في تفاصيل المهمة.
- عرض قائمة و Kanban بأعمدة مخصصة لكل مشروع، وفلتر بالمهام/الحالة/الموظف.
- كل موظف يقدر يشوف مهام زمايله للعرض بس؛ التعديل للمسؤولين عن المهمة.
- حذف المهمة من الموظف المسند له = طلب حذف يوافق عليه اللي أسندها، والمحذوف/المؤرشف بيروح "المهام المؤرشفة" ويترجع.
- مشاريع بترتيب يحدده الأدمن، محادثات فردية وجروبات، إشعارات لحظية و Web Push على الموبايل.
- الحضور والنقاط (دورة من 16 لـ 15)، أداء الفريق والالتزام بالمواعيد، الهيكل التنظيمي.
- تقرير أسبوعي بفترات يحددها الأدمن، بيتملى تلقائيًا من المهام، وبيتصدّر PDF و Word و PowerPoint.
- عربي / English، فاتح / داكن، ويتثبت كتطبيق (PWA).

## محتويات المشروع
```
index.html, manifest.webmanifest, sw.js, favicon.ico, assets/   ← الواجهة
css/styles.css                                                   ← التصميم
js/app.js, js/i18n.js                                            ← التطبيق والترجمة
js/config.js                                                     ← إعدادات الاتصال (الملف الوحيد اللي بتعدّله)
supabase/schema.sql                                              ← قاعدة البيانات كاملة (ملف واحد)
supabase/functions/admin-users/   ← إنشاء الحسابات وكلمات السر وإيقاف/حذف الموظفين
supabase/functions/push-send/     ← إرسال إشعارات الموبايل (Web Push)
supabase/config.toml              ← إعدادات الـ Edge Functions
supabase/history/                 ← تاريخ التعديلات على القاعدة (للمرجع بس، مش محتاج تشغّله)
```

---

## خطوات الرفع على مشروع جديد

### 1) مشروع Supabase
1. اعمل مشروع جديد على [supabase.com](https://supabase.com).
2. من **SQL Editor** افتح `supabase/schema.sql` وشغّله كله مرة واحدة. ده بيعمل كل الجداول والدوال والصلاحيات (RLS) والـ triggers والـ Realtime والـ Storage buckets والتذكير اليومي.
3. افتح **Database → Extensions** واتأكد إن `pg_cron` و `pg_net` شغالين (الملف بيفعّلهم، بس لو ظهر خطأ فعّلهم من هنا وشغّل الملف تاني على مشروع فاضي).

### 2) الـ Edge Functions
```bash
npm i -g supabase
supabase login
supabase link --project-ref <PROJECT_REF>
supabase functions deploy admin-users --no-verify-jwt
supabase functions deploy push-send  --no-verify-jwt
```
`SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` بيتحطوا تلقائيًا.
لو غيرت دومين الإيميلات الداخلي: `supabase secrets set EMAIL_DOMAIN=...` (ولازم يطابق `EMAIL_DOMAIN` في `js/config.js`).

### 3) إشعارات الموبايل (Web Push)
1. اعمل مفاتيح VAPID: `npx web-push generate-vapid-keys`
2. في **SQL Editor**:
```sql
update private.app_config set value = 'https://<PROJECT_REF>.supabase.co' where key = 'project_url';
update private.app_config set value = '<VAPID_PUBLIC_KEY>'  where key = 'vapid_public';
update private.app_config set value = '<VAPID_PRIVATE_KEY>' where key = 'vapid_private';
update private.app_config set value = 'mailto:you@yourcompany.com' where key = 'vapid_subject';
```
(`push_secret` بيتعمل عشوائي تلقائيًا.)
3. حط المفتاح العام نفسه في `js/config.js` → `VAPID_PUBLIC`.

> لو مش عايز إشعارات موبايل دلوقتي تقدر تتخطى الخطوة دي. باقي السيستم والإشعارات جوه التطبيق شغالين عادي.

### 4) إعدادات الواجهة — `js/config.js`
```js
export const SUPABASE_URL = "https://<PROJECT_REF>.supabase.co";
export const SUPABASE_ANON_KEY = "eyJ...";            // Project Settings → API → anon public
export const EMAIL_DOMAIN = "ibnsina-crm.local";      // نفس اللي في secret الـ EMAIL_DOMAIN
export const VAPID_PUBLIC = "<VAPID_PUBLIC_KEY>";     // من الخطوة 3
```
الـ anon key آمن يكون في الواجهة لأن كل الصلاحيات محمية بـ RLS في القاعدة.

### 5) أول أدمن
من **Authentication → Users → Add user**:
- Email: `admin@ibnsina-crm.local` (أو `admin@<EMAIL_DOMAIN>`)
- Password: كلمة سر قوية، وعلّم على **Auto Confirm User**

أول حساب بيتعمل بياخد صلاحية أدمن تلقائيًا. ادخل باسم المستخدم `admin`، ومن صفحة **الموظفين** ضيف الفريق.

### 6) رفع الواجهة
الواجهة ملفات static، مفيش build:
- **Vercel:** اربط الريبو كـ **Other** بدون Build Command ولا Output Directory.
- **أي استضافة تانية** (Netlify، Cloudflare Pages، nginx، Apache، IIS): ارفع الملفات زي ما هي على الـ root. لازم HTTPS عشان إشعارات الموبايل والتثبيت كتطبيق.
- للتجربة على جهازك: `npx serve .`

بعد الرفع ضيف دومين الموقع في Supabase: **Authentication → URL Configuration → Site URL**.

---

## ملاحظات
- الأرشيف المضغوط ده **بدون بيانات** (مهام/موظفين/رسايل). لنقل البيانات من المشروع الحالي: من Supabase **Database → Backups** أو `pg_dump --data-only`، وملفات الـ Storage تتنقل من **Storage**.
- المفاتيح السرية (service role، VAPID private، push secret) **مش موجودة** في الملفات عن قصد؛ كل مشروع جديد بيعمل بتاعه.
- `supabase/schema.sql` متصدّر من القاعدة الشغالة وتمت مراجعته عليها جدول بجدول ودالة بدالة.
