# Ibnsina Digital Team Tasks Tracker

نظام إدارة مهام لفريق Ibnsina Pharma (حوالي 20 موظف) بهيكل إداري (مدير ومرؤوس).

**المميزات**
- صفحة رئيسية فيها كل الموظفين مترتبين حسب التزامهم بمواعيد التسليم.
- تعليقات وسجل نشاط وخطوات (Checklist) على كل مهمة، والإنجاز بيتحسب من الخطوات.
- إشعارات لحظية (إسناد، تعليق، إنهاء مهمة) وتنبيه يومي للمهام المطلوبة بكرة.
- عرض Kanban بالسحب والإفلات.
- تقرير أسبوعي للمدير مع تصدير Excel و PDF.
- عربي / English وفاتح / داكن، محفوظين مع الحساب.
- دخول باسم مستخدم وكلمة سر، والمدير هو اللي بيعمل حسابات فريقه.
- كل موظف ليه اسم وصورة ومسمى وظيفي ومدير مباشر، وفي صفحة للهيكل التنظيمي.
- إسناد مهام لنفسك أو لأي حد في الفريق (أكتر من شخص للمهمة الواحدة).
- حالة المهمة، الأولوية، الموعد النهائي، ونسبة الإنجاز.
- رفع ملفات على المهمة، تظهر للمسؤولين عنها ولمن أنشأها ولكل المديرين فوقهم.
- صفحة أداء الفريق للمدير: المفتوح، المتأخر، المكتمل، متوسط الإنجاز، ونسبة الالتزام بالمواعيد لكل موظف.
- تحديث لحظي (Realtime) بين كل المستخدمين.

**التقنيات:** HTML + JavaScript (بدون build) · Supabase (Postgres + Auth + Storage + Edge Functions) · استضافة Vercel.

---

## الإعداد

### 1) مشروع Supabase
1. اعمل مشروع جديد على [supabase.com](https://supabase.com).
2. من **SQL Editor** شغّل الملف `supabase/schema.sql` كله مرة واحدة.

### 2) Edge Function لإدارة الحسابات
```bash
npm i -g supabase
supabase login
supabase link --project-ref <PROJECT_REF>
supabase functions deploy admin-users
```
`SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` بيتحطوا تلقائيًا.
لو غيرت دومين الإيميلات الداخلي: `supabase secrets set EMAIL_DOMAIN=...` (ولازم يطابق `js/config.js`).

### 3) أول أدمن
من **Authentication → Users → Add user**:
- Email: `admin@ibnsina-crm.local`
- Password: كلمة سر قوية
- علّم على **Auto Confirm User**

أول حساب بيتعمل بياخد صلاحية أدمن تلقائيًا. ادخل بعدها باسم المستخدم `admin`، ومن صفحة **الموظفين** عدّل اسمك وصورتك وابدأ ضيف الفريق.

> لو Supabase رفض الدومين `ibnsina-crm.local`، استخدم أي دومين تاني (مثلاً `team.ibnsinapharma.com`) في `js/config.js` وفي secret الـ `EMAIL_DOMAIN`. مفيش إيميلات بتتبعت عليه، هو بس صيغة داخلية لاسم المستخدم.

### 4) الإعدادات في الواجهة
في `js/config.js` حط:
```js
export const SUPABASE_URL = "https://xxxx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJ...";
```
(من **Project Settings → API**. الـ anon key آمن يكون في الواجهة لأن كل الصلاحيات محمية بـ RLS.)

### 5) النشر على Vercel
اربط الريبو بـ Vercel كـ **Other / Static** بدون Build Command ولا Output Directory.
للتجربة محليًا: `npx serve .`

---

## الصلاحيات
| مين | يشوف | يعدّل |
|---|---|---|
| الموظف | المهام المسندة له واللي أنشأها | الحالة ونسبة الإنجاز والملفات للمهام المسندة له |
| منشئ المهمة | المهمة كاملة | كل حاجة + الحذف |
| المدير (مباشر أو أعلى) | كل مهام اللي تحته | كل حاجة، ويعمل حسابات للي تحته ويوقفها (من غير تغيير كلمات السر) |
| الأدمن (المدير الرئيسي) | كل حاجة | كل حاجة، وهو الوحيد اللي يغير كلمة سر أي موظف |

الصلاحيات متطبقة على مستوى قاعدة البيانات (Row Level Security) مش في الواجهة بس.

## هيكل الملفات
```
index.html
css/styles.css
js/config.js          ← بيانات Supabase
js/app.js             ← التطبيق
assets/               ← اللوجو
supabase/schema.sql   ← الجداول والصلاحيات والتخزين
supabase/functions/admin-users/index.ts
```

Powered by Sobky
