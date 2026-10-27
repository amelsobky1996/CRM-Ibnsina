// =====================================================================
// Language + theme preferences, and Arabic → English translation.
//
// The UI is written in Arabic. In English mode:
//   • every rendered text node / placeholder / title / aria-label whose
//     whole text matches a key in EN is swapped automatically (observer);
//   • sentences with names or numbers go through tx("… {var} …", vars).
// Missing keys fall back to the Arabic text.
// =====================================================================

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export let LANG = store.get("dtt.lang") === "en" ? "en" : "ar";
export let THEME = ["light", "dark"].includes(store.get("dtt.theme")) ? store.get("dtt.theme") : "system";
export const LOCALE = () => (LANG === "en" ? "en-GB" : "ar-EG");

const EN = {
  // ---------- statuses / priorities / gender
  "جديدة": "To do", "قيد التنفيذ": "In progress", "مراجعة": "In review", "متوقفة": "Blocked", "مكتملة": "Done",
  "عالية": "High", "متوسطة": "Medium", "منخفضة": "Low",
  "● عالية": "● High", "● متوسطة": "● Medium", "● منخفضة": "● Low",
  "ذكر": "Male", "أنثى": "Female", "♂ ذكر": "♂ Male", "♀ أنثى": "♀ Female",

  // ---------- app / auth
  "Digital Team Tasks Tracker": "Digital Team Tasks Tracker",
  "جاري التحميل…": "Loading…",
  "مش مسموح لك تعمل الخطوة دي": "You're not allowed to do that",
  "لا يوجد ملف موظف مرتبط بهذا الحساب": "No employee profile is linked to this account",
  "الحساب ده موقوف. كلّم مديرك.": "This account is suspended. Contact your manager.",
  "محتاج إعداد Supabase": "Supabase setup needed",
  "المشاريع والمهام والمواعيد والملفات في مكان واحد، وكل مدير شايف أداء فريقه أول بأول.":
    "Projects, tasks, deadlines and files in one place, with every manager seeing their team's progress as it happens.",
  "تسجيل الدخول": "Sign in",
  "استخدم اسم المستخدم وكلمة السر اللي اداهولك مديرك.": "Use the username and password your manager gave you.",
  "اسم المستخدم": "Username", "كلمة السر": "Password", "دخول": "Sign in",
  "اكتب اسم المستخدم وكلمة السر": "Enter your username and password",
  "اسم المستخدم أو كلمة السر غير صحيحة": "Incorrect username or password",

  // ---------- navigation / shell
  "القائمة الرئيسية": "Main menu", "المهام": "Tasks", "المشاريع": "Projects", "أداء الفريق": "Team performance",
  "الهيكل التنظيمي": "Org chart", "الموظفين": "Employees", "الإعدادات": "Settings",
  "تغيير صورتي": "Change my photo", "تغيير كلمة السر": "Change password", "تسجيل الخروج": "Sign out", "المزيد": "More",
  "اتغيرت الصورة": "Photo updated",

  // ---------- tasks list
  "بدون موعد": "No deadline", "النهارده": "Today", "بكرة": "Tomorrow", "بدون مشروع": "No project",
  "مسندة لي": "Assigned to me", "أنشأتها": "Created by me", "مهام فريقي": "My team's tasks", "الكل": "All",
  "مهام المشروع": "Project tasks", "مهمة جديدة": "New task",
  "مفتوحة": "Open", "متأخرة": "Overdue", "خلال 7 أيام": "Due in 7 days",
  "إلغاء الفلتر": "Clear filter", "المشروع": "Project", "كل المشاريع": "All projects", "ابحث في المهام": "Search tasks",
  "الحالة": "Status", "المهمة": "Task", "المسؤولين": "Assignees", "الموعد": "Deadline", "الإنجاز": "Progress",
  "حذف المهمة": "Delete task", "مفيش مهام هنا": "No tasks here",
  "أي مهمة تتسند لك هتظهر في القائمة دي.": "Tasks assigned to you will show up here.",
  "غيّر الفلتر أو أضف مهمة جديدة.": "Change the filter or add a new task.",
  "ابحث باسم الموظف": "Search by name",

  // ---------- task form / drawer
  "عنوان المهمة": "Task title", "التفاصيل": "Details", "الموعد النهائي": "Deadline", "الأولوية": "Priority",
  "إسناد إلى": "Assign to", "إلغاء": "Cancel", "إنشاء المهمة": "Create task",
  "اكتب عنوان المهمة": "Enter a task title", "اختار شخص واحد على الأقل": "Pick at least one person",
  "جاري الحفظ…": "Saving…", "اتعملت المهمة": "Task created",
  "تحميل": "Download", "حذف الملف": "Delete file", "حذف": "Delete", "مفيش ملفات مرفقة لسه.": "No files attached yet.",
  "اتحذف الملف": "File deleted", "المهمة مش موجودة": "Task not found", "إغلاق": "Close",
  "نسبة الإنجاز": "Progress", "المسؤولين عن المهمة": "Assignees", "تعديل المسؤولين": "Edit assignees",
  "حفظ التغييرات": "Save changes", "الملفات": "Files",
  "اترفعت الملفات": "Files uploaded", "اترفع الملف": "File uploaded", "العنوان مطلوب": "Title is required",
  "لازم يفضل شخص واحد مسؤول على الأقل": "At least one assignee is required",
  "برافو! المهمة اكتملت": "Nice! Task completed", "اتحفظت التغييرات": "Changes saved",
  "تأكيد": "Confirm", "حذف المهمة؟": "Delete task?", "اتحذفت المهمة": "Task deleted",
  "مش مسموح لك تحذف المهمة دي، اللي أنشأها أو مديره بس": "You can't delete this task. Only its creator or their manager can.",

  // ---------- projects
  "إظهار المؤرشفة": "Show archived", "مشروع جديد": "New project", "تعديل المشروع": "Edit project",
  "مشروع مؤرشف": "Archived project", "بدون وصف": "No description", "بدون مسؤول": "No lead",
  "مفيش مشاريع لسه": "No projects yet",
  'اضغط "مشروع جديد" وابدأ تنظم مهام الفريق.': 'Click "New project" to start organizing your team\'s work.',
  "المدير هو اللي بيضيف المشاريع.": "Projects are added by managers.",
  "اسم المشروع": "Project name", "الوصف": "Description", "المسؤول عن المشروع": "Project lead", "بدون": "None",
  "اللون": "Color", "لون المشروع": "Project color",
  "مشروع مؤرشف (مش هيظهر في اختيارات المهام الجديدة)": "Archived (hidden when creating new tasks)",
  "حذف المشروع": "Delete project", "إنشاء المشروع": "Create project", "حفظ": "Save",
  "اكتب اسم المشروع": "Enter a project name", "اتعمل المشروع": "Project created",
  "اتحفظ المشروع": "Project saved", "اتحذف المشروع": "Project deleted",

  // ---------- team performance
  "المباشرين فقط": "Direct reports only", "مهام مفتوحة": "Open tasks", "الموظف": "Employee",
  "شغال على": "Working on", "متوسط الإنجاز": "Avg. progress", "الالتزام بالمواعيد": "On-time rate",
  "مفيش موظفين تحت إدارتك لسه": "No one reports to you yet",
  "أضف موظفين من صفحة الموظفين.": "Add people from the Employees page.",

  // ---------- org chart
  "عدد الفريق": "Team size", "أنتِ": "You", "أنت": "You", "فتح الكل": "Expand all", "طي الكل": "Collapse all",
  "تصغير": "Zoom out", "تكبير": "Zoom in",
  "اسحب بالماوس عشان تتحرك في الهيكل، واضغط على أي شخص في فريقك عشان تشوف مهامه.":
    "Drag to move around the chart. Click anyone on your team to see their tasks.",

  // ---------- employees
  "إدارة كل حسابات الفريق": "Manage all team accounts", "الموظفين تحت إدارتك": "People who report to you",
  "إضافة موظف": "Add employee", "النوع": "Gender", "المدير المباشر": "Direct manager", "أدمن": "Admin",
  "نشط": "Active", "موقوف": "Suspended", "تعديل": "Edit", "مفيش موظفين لسه": "No employees yet",
  'اضغط "إضافة موظف" وابدأ تبني فريقك.': 'Click "Add employee" to start building your team.',
  "— بدون مدير (أعلى الهيكل) —": "— No manager (top level) —",
  "تعديل بيانات الموظف": "Edit employee", "تغيير الصورة": "Change photo", "إضافة صورة": "Add photo",
  "الاسم بالكامل": "Full name", "المسمى الوظيفي": "Job title", "8 حروف على الأقل": "At least 8 characters",
  "اسم المستخدم:": "Username:",
  "صلاحية أدمن (يدير كل الموظفين ويشوف كل المهام)": "Admin access (manages everyone and sees all tasks)",
  "إيقاف الحساب": "Suspend account", "تفعيل الحساب": "Reactivate account", "إنشاء الحساب": "Create account",
  "اختار النوع": "Choose a gender", "اكتب الاسم": "Enter a name",
  "اسم المستخدم: حروف إنجليزية صغيرة وأرقام و . _ - (من 3 لـ 30)": "Username: 3–30 lowercase letters, numbers, or . _ -",
  "كلمة السر 8 حروف على الأقل": "Password must be at least 8 characters",
  "اتعمل الحساب، ابعت للموظف اسم المستخدم وكلمة السر": "Account created. Send the employee their username and password.",
  "اتحفظت البيانات": "Details saved", "اتحدثت حالة الحساب": "Account status updated", "اتحذف الموظف": "Employee deleted",
  "كلمة السر الجديدة": "New password", "تأكيد كلمة السر": "Confirm password", "حفظ كلمة السر": "Save password",
  "كلمتين السر مش متطابقين": "Passwords don't match", "اتغيرت كلمة السر": "Password changed",

  // ---------- server / database messages
  "تقدر تضيف موظفين تحت إدارتك فقط": "You can only add people who report to you",
  "اسم المستخدم ده مستخدم قبل كده": "That username is already taken",
  "تغيير كلمة سر الموظفين متاح للمدير الرئيسي بس": "Only the main admin can change employees' passwords",
  "غير مسموح": "Not allowed", "مش هينفع توقف حسابك": "You can't suspend your own account",
  "مش هينفع تحذف حسابك": "You can't delete your own account",
  "كلمة السر لازم تكون 8 حروف على الأقل": "Password must be at least 8 characters",
  "اكتب اسم الموظف": "Enter the employee's name", "يلزم تسجيل الدخول": "Sign-in required",
  "الحساب غير مفعّل": "This account isn't active",
  "اسم المستخدم من 3 إلى 30 حرف: حروف إنجليزية صغيرة وأرقام و . _ -": "Username: 3–30 lowercase letters, numbers, or . _ -",
  "لا يمكن أن يكون الموظف مديرًا لمديره": "An employee can't manage their own manager",

  // ---------- settings
  "تخصيص شكل ولغة النظام على الجهاز ده.": "Personalize how the app looks on this device.",
  "اللغة": "Language", "اختار لغة الواجهة.": "Choose the interface language.",
  "المظهر": "Appearance", "فاتح": "Light", "داكن": "Dark", "حسب الجهاز": "System",
  "بيتبع إعدادات جهازك تلقائيًا.": "Follows your device setting automatically.",
  "حسابي": "My account", "اتحفظت الإعدادات": "Settings saved",
  "الإعدادات دي محفوظة على الجهاز ده بس.": "These settings are saved on this device only.",

  // ---------- templates with values (used through tx)
  "الملف أكبر من {mb} ميجا": "File is larger than {mb} MB",
  "متأخرة {n} يوم": "{n}d overdue",
  "(مؤرشف)": "(archived)",
  "أهلاً {name}، عندك {n} مهمة مفتوحة.": "Hi {name}, you have {n} open tasks.",
  "مهام {name}": "{name}'s tasks",
  "من {name}": "by {name}",
  "حذف المهمة {title}": "Delete task {title}",
  "(أنا)": "(me)",
  "{file}: الحد الأقصى {mb} ميجا للملف": "{file}: max {mb} MB per file",
  "إرفاق ملفات (اختياري، حتى {mb} ميجا للملف)": "Attach files (optional, up to {mb} MB each)",
  "حذف «{name}»؟": "Delete “{name}”?",
  "اسحب الملفات هنا أو اضغط للاختيار (حتى {mb} ميجا)": "Drop files here or click to choose (up to {mb} MB)",
  "أنشأها {name} · {date}": "Created by {name} · {date}",
  "اكتملت {date}": "completed {date}",
  "«{title}» هتتحذف نهائيًا مع كل ملفاتها.": "“{title}” will be permanently deleted with all its files.",
  "{n} مشروع نشط": "{n} active projects", "{n} مؤرشف": "{n} archived",
  "{n} مفتوحة": "{n} open", "{n} مكتملة": "{n} done", "{n} متأخرة": "{n} overdue",
  "المسؤول: {name}": "Lead: {name}",
  "حذف مشروع «{name}»؟": "Delete project “{name}”?",
  "المهام ({n}) مش هتتحذف، هتفضل من غير مشروع.": "Its {n} tasks will be kept without a project.",
  "{n} موظف تحت إدارتك المباشرة": "{n} direct reports", "{n} موظف تحت إدارتك": "{n} people under you",
  "إظهار فريق {name}": "Show {name}'s team", "إخفاء فريق {name}": "Hide {name}'s team",
  "{n} موظف · {m} مدير · {l} مستويات": "{n} people · {m} managers · {l} levels",
  "إيقاف حساب {name}؟ مش هيقدر يدخل السستم.": "Suspend {name}'s account? They won't be able to sign in.",
  "تفعيل حساب {name}؟": "Reactivate {name}'s account?",
  "حذف {name} نهائيًا؟ الموظفين اللي تحته هيتنقلوا لمديره.": "Permanently delete {name}? Their reports will move to their manager.",
  "كلمة سر جديدة لـ {name}": "New password for {name}",
  // ---------- v4: navigation, notifications
  "الرئيسية": "Home", "التقارير": "Reports", "الإشعارات": "Notifications", "تحديد الكل كمقروء": "Mark all as read",
  "مفيش إشعارات": "No notifications",
  "هتوصلك هنا لما حد يسند لك مهمة أو يعلّق عليها أو موعد يقرّب.": "You'll see updates here when someone assigns you a task, comments on it, or a deadline is near.",
  "المهمة دي مبقتش موجودة": "This task no longer exists", "حد من الفريق": "A teammate", "النظام": "System",
  "{actor} أسند لك مهمة {title}": "{actor} assigned you {title}",
  "{actor} علّق على {title}": "{actor} commented on {title}",
  "{actor} خلّص مهمة {title}": "{actor} completed {title}",
  "موعد تسليم {title} بكرة": "{title} is due tomorrow",
  "دلوقتي": "just now", "من {n} دقيقة": "{n}m ago", "من {n} ساعة": "{n}h ago", "من {n} يوم": "{n}d ago",

  // ---------- v4: drawer
  "بتتحسب تلقائيًا من الخطوات": "Calculated from the checklist", "الخطوات": "Checklist",
  "أضف خطوة واضغط Enter": "Add a step and press Enter", "خطوة جديدة": "New step", "إضافة": "Add",
  "حذف الخطوة": "Delete step",
  "مفيش خطوات لسه. قسّم المهمة لخطوات صغيرة ونسبة الإنجاز هتتحسب لوحدها.": "No steps yet. Break the task into small steps and progress will update automatically.",
  "التعليقات": "Comments", "سجل النشاط": "Activity", "اكتب تعليق…": "Write a comment…", "إرسال": "Send",
  "حذف التعليق": "Delete comment", "مفيش تعليقات لسه. ابدأ النقاش هنا.": "No comments yet. Start the conversation here.",
  "مفيش نشاط مسجل.": "No activity yet.",
  "{a} أنشأ المهمة": "{a} created the task",
  "{a} غيّر الحالة من {from} إلى {to}": "{a} changed status from {from} to {to}",
  "{a} حدّث الإنجاز إلى {n}%": "{a} updated progress to {n}%",
  "{a} غيّر الموعد إلى {d}": "{a} changed the deadline to {d}",
  "{a} شال الموعد النهائي": "{a} removed the deadline",
  "{a} غيّر العنوان إلى {t}": "{a} renamed the task to {t}",
  "{a} غيّر الأولوية إلى {p}": "{a} set priority to {p}",
  "{a} نقل المهمة لمشروع {p}": "{a} moved the task to {p}",
  "{a} شال المهمة من المشروع": "{a} removed the task from its project",
  "{a} أسند المهمة إلى {u}": "{a} assigned {u}",
  "{a} شال {u} من المهمة": "{a} removed {u} from the task",
  "{a} رفع ملف {f}": "{a} uploaded {f}", "{a} حذف ملف {f}": "{a} deleted {f}",
  "{a} أضاف خطوة {s}": "{a} added step {s}", "{a} خلّص خطوة {s}": "{a} completed step {s}",
  "{a} رجّع خطوة {s} لغير مكتملة": "{a} reopened step {s}",

  // ---------- v4: kanban
  "طريقة العرض": "View", "قائمة": "List", "كانبان": "Board", "اسحب مهمة هنا": "Drag a task here",

  // ---------- v4: home
  "صباح الخير": "Good morning", "مساء الخير": "Good evening", "{g}، {name}": "{g}, {name}",
  "عندك {n} مهمة متأخرة، ابدأ بيها.": "You have {n} overdue tasks. Start with those.",
  "عندك {n} مهمة مفتوحة ومفيش حاجة متأخرة. كمّل كده!": "You have {n} open tasks and nothing overdue. Keep it up!",
  "مفيش مهام مفتوحة عندك دلوقتي.": "You have no open tasks right now.",
  "مهامك المفتوحة": "Your open tasks", "مطلوبة النهارده": "Due today", "التزامك بالمواعيد": "Your on-time rate",
  "أداء الفريق في المواعيد": "Team on-time delivery",
  "النسبة = المهام اللي اتسلمت في ميعادها ÷ (اللي اتسلمت + اللي اتأخرت أو لسه متأخرة)": "Score = tasks delivered on time ÷ (delivered + late or still overdue)",
  "الفترة": "Period", "آخر 30 يوم": "Last 30 days", "آخر 3 شهور": "Last 3 months", "من الأول": "All time",
  "مهامك الجاية": "Up next", "كل مهامك": "All your tasks", "مفيش مهام مفتوحة. استمتع بيومك!": "Nothing open. Enjoy your day!",
  "إزاي بنقيس؟": "How it's scored", "ممتاز": "Excellent", "جيد جدًا": "Very good", "جيد": "Good", "يحتاج تحسين": "Needs improvement",
  "{n}% أو أكتر": "{n}% or more", "أقل من 60%": "Below 60%",
  "لسه مفيش مهام بمواعيد اتسلمت": "No delivered tasks with deadlines yet",
  "لسه مفيش بيانات كفاية": "Not enough data yet",
  "الفريق ملتزم بالمواعيد بنسبة {n}%": "The team delivers on time {n}% of the time",
  "{a} مهمة اتسلمت في ميعادها · {b} اتسلمت متأخر · {c} متأخرة دلوقتي": "{a} delivered on time · {b} delivered late · {c} overdue now",
  "{a} في الموعد · {b} اتأخرت · {c} متأخرة دلوقتي": "{a} on time · {b} late · {c} overdue now",

  // ---------- v4: reports
  "التقرير الأسبوعي": "Weekly report", "كل الفريق": "Whole team", "الأسبوع": "Week",
  "مهام اتسلمت": "Tasks delivered", "اتسلمت متأخر": "Delivered late", "متأخرة دلوقتي": "Overdue now",
  "ملخص الموظفين": "By employee", "مهام جديدة": "New tasks", "اتسلمت": "Delivered", "في الموعد": "On time", "متأخر": "Late",
  "اتسلمت الأسبوع ده": "Delivered this week", "مفيش مهام اتسلمت في الفترة دي.": "Nothing was delivered in this period.",
  "مفيش مهام متأخرة. ممتاز!": "Nothing overdue. Great!", "اتنزل ملف الإكسل": "Excel file downloaded",
  "الأسبوع ده ({r})": "This week ({r})", "الأسبوع اللي فات ({r})": "Last week ({r})", "الموعد كان {d}": "Was due {d}",
  "الملخص": "Summary", "اتسلمت يوم": "Delivered on", "أيام التأخير": "Days late",
  "مقدرناش نحمّل مكتبة Excel، جرّب تاني.": "Couldn't load the Excel library. Try again.",

  // ---------- person hover card
  "أعلى الهيكل": "Top of the chart", "عرض المهام": "View tasks",

  // ---------- v4: settings
  "تخصيص شكل ولغة النظام.": "Personalize how the app looks.",
  "الإعدادات دي محفوظة مع حسابك، وبتطبق على أي جهاز تدخل منه.": "Saved to your account and applied on any device you sign in from.",
};

/** Translate an Arabic source string (with optional {vars}). */
export function tx(ar, vars) {
  let s = LANG === "en" ? (EN[ar] ?? ar) : ar;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
  return s;
}

const AR_RE = /[؀-ۿ]/;
function trText(s) {
  const k = s.trim();
  if (!k || !AR_RE.test(k)) return s;
  const v = EN[k];
  return v === undefined ? s : s.replace(k, v);
}

const ATTRS = ["placeholder", "title", "aria-label"];
function translateNode(root) {
  if (LANG !== "en" || !root) return;
  if (root.nodeType === 3) { const n = trText(root.nodeValue); if (n !== root.nodeValue) root.nodeValue = n; return; }
  if (root.nodeType !== 1) return;
  const els = [root, ...root.querySelectorAll("*")];
  for (const el of els) {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v && AR_RE.test(v)) { const n = trText(v); if (n !== v) el.setAttribute(a, n); }
    }
  }
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const v = trText(n.nodeValue);
    if (v !== n.nodeValue) n.nodeValue = v;
  }
}

let observer = null;
export function startTranslator() {
  if (observer) return;
  observer = new MutationObserver((muts) => {
    if (LANG !== "en") return;
    for (const m of muts) for (const n of m.addedNodes) translateNode(n);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  translateNode(document.body);
  const nativeConfirm = window.confirm.bind(window);
  window.confirm = (msg) => nativeConfirm(LANG === "en" ? trText(String(msg)) : msg);
}

export function applyPrefs() {
  const html = document.documentElement;
  html.lang = LANG;
  html.dir = LANG === "en" ? "ltr" : "rtl";
  if (THEME === "system") delete html.dataset.theme; else html.dataset.theme = THEME;
  const dark = THEME === "dark" || (THEME === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0C1322" : "#0B6FC4");
  document.title = (LANG === "en" ? "Ibnsina · " : "ابن سينا · ") + "Digital Team Tasks Tracker";
}

export function setLang(l) { LANG = l === "en" ? "en" : "ar"; store.set("dtt.lang", LANG); applyPrefs(); }
export function setTheme(th) { THEME = ["light", "dark"].includes(th) ? th : "system"; store.set("dtt.theme", THEME); applyPrefs(); }
