import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, EMAIL_DOMAIN } from "./config.js";

/* =====================================================================
   Helpers
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const MAX_FILE_MB = 50;
const STATUS = { todo: "جديدة", in_progress: "قيد التنفيذ", review: "مراجعة", blocked: "متوقفة", done: "مكتملة" };
const PRIORITY = { high: "عالية", medium: "متوسطة", low: "منخفضة" };
const GENDER = { male: "ذكر", female: "أنثى" };
const genderPill = (g) => g ? `<span class="g-pill g-${g}">${g === "female" ? "♀" : "♂"} ${GENDER[g]}</span>` : `<span class="meta" style="margin:0">—</span>`;
const PROJECT_COLORS = ["#0B6FC4", "#4A5DA8", "#7A4FD0", "#C2408A", "#D6603A", "#C99100", "#17996A", "#1590A8"];

const ICONS = {
  tasks: '<path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>',
  projects: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  team: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  org: '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-2h12v2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  clip: '<path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  inbox: '<path d="M4 13h4l2 3h4l2-3h4"/><path d="M5 5h14l2 8v6H3v-6z"/>',
  flame: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-5 5-5 8-1-1-2-2-2-4-2 2-2 5-2 8 0 4 3 7 7 7z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  zoomIn: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M8 11h6M11 8v6"/>',
  zoomOut: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M8 11h6"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  collapse: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
};
const icon = (name, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;

const fmtDate = (d) => d ? new Date(d.length === 10 ? d + "T00:00:00" : d)
  .toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" }) : "";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("ar-EG",
  { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const daysUntil = (dateStr) => Math.round((new Date(dateStr + "T00:00:00") - today()) / 86400000);
const fmtSize = (b) => b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : (b / 1048576).toFixed(1) + " MB";
const isOverdue = (t) => t.status !== "done" && t.deadline && daysUntil(t.deadline) < 0;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function toast(msg, bad = false) {
  const el = document.createElement("div");
  el.innerHTML = `<svg viewBox="0 0 24 24">${bad ? ICONS.alert : ICONS.check}</svg><span></span>`;
  el.querySelector("span").textContent = msg;
  if (bad) el.className = "bad";
  $("#toast").append(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 220); }, 3200);
}

function countUp(root) {
  $$("[data-count]", root).forEach((el) => {
    const target = Number(el.dataset.count);
    if (reduceMotion || target === 0) { el.textContent = target; return; }
    const start = performance.now(), dur = 700;
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function placeTabPill(root) {
  const tabs = $(".tabs", root);
  if (!tabs) return;
  const on = $("button.on", tabs), pill = $(".pill-bg", tabs);
  if (!on || !pill) return;
  pill.style.left = on.offsetLeft + "px";
  pill.style.width = on.offsetWidth + "px";
}

const AV_COLORS = ["#0B6FC4", "#4A5DA8", "#167F8C", "#7A4FB5", "#B5562F", "#2E7D4F", "#A63D6B", "#5B6B82"];
function avatar(p, cls = "") {
  if (!p) return `<span class="av ${cls}">?</span>`;
  if (p.avatar_url) return `<img class="av ${cls}" src="${esc(p.avatar_url)}" alt="${esc(p.full_name)}" title="${esc(p.full_name)}" loading="lazy">`;
  const initials = p.full_name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  let h = 0; for (const c of p.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `<span class="av ${cls}" style="background:${AV_COLORS[h % AV_COLORS.length]}" title="${esc(p.full_name)}">${esc(initials)}</span>`;
}

/* =====================================================================
   State
   ===================================================================== */
const configured = !SUPABASE_URL.startsWith("YOUR_");
const sb = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const state = {
  me: null,
  profiles: [],
  byId: new Map(),
  children: new Map(),
  tasks: [],
  projects: [],
  projById: new Map(),
  view: { tab: "mine", status: "all", q: "", user: null, project: "" },
  teamDirectOnly: false,
  showArchived: false,
  animate: true,
};

const profile = (id) => state.byId.get(id);
const project = (id) => id ? state.projById.get(id) : null;

function descendants(id) {
  const out = [], stack = [...(state.children.get(id) || [])];
  while (stack.length) {
    const p = stack.shift();
    out.push(p);
    stack.push(...(state.children.get(p.id) || []));
  }
  return out;
}
function isAncestor(mgr, emp) {
  let cur = profile(emp), guard = 0;
  while (cur && cur.manager_id && guard++ < 50) {
    if (cur.manager_id === mgr) return true;
    cur = profile(cur.manager_id);
  }
  return false;
}
const isManager = () => state.me.is_admin || (state.children.get(state.me.id) || []).length > 0;
const manageable = () => state.me.is_admin ? state.profiles : descendants(state.me.id);

function canManageTask(t) {
  const me = state.me.id;
  return state.me.is_admin || t.created_by === me ||
    (t.created_by && isAncestor(me, t.created_by)) ||
    t.assignees.some((u) => isAncestor(me, u));
}
const canWorkOn = (t) => canManageTask(t) || t.assignees.includes(state.me.id);
// must mirror the "tasks delete" RLS policy
const canDeleteTask = (t) => state.me.is_admin || t.created_by === state.me.id || (t.created_by && isAncestor(state.me.id, t.created_by));
const canEditProject = (p) => state.me.is_admin || p.created_by === state.me.id || p.lead_id === state.me.id ||
  (p.created_by && isAncestor(state.me.id, p.created_by));

/* =====================================================================
   Data
   ===================================================================== */
async function loadProfiles() {
  const { data, error } = await sb.from("profiles").select("*").order("full_name");
  if (error) throw error;
  state.profiles = data;
  state.byId = new Map(data.map((p) => [p.id, p]));
  state.children = new Map();
  for (const p of data) {
    if (!p.manager_id) continue;
    if (!state.children.has(p.manager_id)) state.children.set(p.manager_id, []);
    state.children.get(p.manager_id).push(p);
  }
  if (state.me) state.me = profile(state.me.id) || state.me;
}

async function loadTasks() {
  const { data, error } = await sb.from("tasks")
    .select("*, task_assignees(user_id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  state.tasks = data.map((t) => ({ ...t, assignees: (t.task_assignees || []).map((a) => a.user_id) }));
}

async function loadProjects() {
  const { data, error } = await sb.from("projects").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  state.projects = data;
  state.projById = new Map(data.map((p) => [p.id, p]));
}

async function adminCall(body) {
  const { data, error } = await sb.functions.invoke("admin-users", { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); msg = j.error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return data;
}

async function resizeImage(file, size = 320) {
  const img = await createImageBitmap(file);
  const s = Math.min(img.width, img.height);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  return new Promise((res) => c.toBlob(res, "image/jpeg", 0.86));
}

async function uploadAvatar(userId, file) {
  const blob = await resizeImage(file);
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await sb.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  const { data } = sb.storage.from("avatars").getPublicUrl(path);
  const { error: e2 } = await sb.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", userId);
  if (e2) throw e2;
}

const friendly = (e) => {
  const m = e?.message || String(e);
  if (/row-level security/i.test(m)) return "مش مسموح لك تعمل الخطوة دي";
  if (/exceeded the maximum allowed size|Payload too large/i.test(m)) return `الملف أكبر من ${MAX_FILE_MB} ميجا`;
  return m;
};

/* =====================================================================
   Boot / Auth
   ===================================================================== */
async function init() {
  if (!configured) return renderSetup();
  const { data: { session } } = await sb.auth.getSession();
  sb.auth.onAuthStateChange((evt) => { if (evt === "SIGNED_OUT") renderLogin(); });
  if (!session) return renderLogin();
  await boot(session.user.id);
}

async function boot(userId) {
  try {
    state.me = { id: userId };
    await loadProfiles();
    state.me = profile(userId);
    if (!state.me) throw new Error("لا يوجد ملف موظف مرتبط بهذا الحساب");
    if (!state.me.active) { await sb.auth.signOut(); return renderLogin("الحساب ده موقوف. كلّم مديرك."); }
    await Promise.all([loadTasks(), loadProjects()]);
    renderShell();
    subscribe();
  } catch (e) {
    console.error(e);
    renderLogin(friendly(e));
  }
}

let channel, reloadTimer;
function subscribe() {
  if (channel) sb.removeChannel(channel);
  const reload = () => {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(async () => {
      if ($("#modal-root").innerHTML) return; // don't re-render under an open form
      try {
        await Promise.all([loadProfiles(), loadTasks(), loadProjects()]);
        state.animate = false; route();
      } catch (e) { console.error(e); }
    }, 500);
  };
  channel = sb.channel("crm");
  for (const table of ["tasks", "task_assignees", "profiles", "projects"])
    channel.on("postgres_changes", { event: "*", schema: "public", table }, reload);
  channel.subscribe();
}

function renderSetup() {
  $("#root").innerHTML = `
    <div class="setup">
      <h2>محتاج إعداد Supabase</h2>
      <p>افتح <code>js/config.js</code> وحط <code>SUPABASE_URL</code> و <code>SUPABASE_ANON_KEY</code> بتوع مشروعك، وبعدها اعمل refresh.</p>
    </div>`;
}

function renderLogin(message = "") {
  if (channel) { sb.removeChannel(channel); channel = null; }
  state.me = null;
  $("#modal-root").innerHTML = "";
  const rays = Array.from({ length: 14 }, (_, i) =>
    `<i style="transform:rotate(${i * 360 / 14}deg);animation-delay:${(i * .6).toFixed(1)}s"></i>`).join("");
  $("#root").innerHTML = `
    <div class="login">
      <section class="login-art brand-bg">
        <div class="rays" aria-hidden="true">${rays}</div>
        <img src="assets/logo-white.png" alt="Ibnsina Pharma">
        <div class="copy">
          <h1>Digital Team Tasks Tracker</h1>
          <p>المشاريع والمهام والمواعيد والملفات في مكان واحد، وكل مدير شايف أداء فريقه أول بأول.</p>
        </div>
      </section>
      <section class="login-form">
        <form id="login" novalidate>
          <h2>تسجيل الدخول</h2>
          <p class="sub">استخدم اسم المستخدم وكلمة السر اللي اداهولك مديرك.</p>
          <label class="field"><span>اسم المستخدم</span>
            <input class="input" name="username" dir="ltr" autocomplete="username" autocapitalize="none" required></label>
          <label class="field"><span>كلمة السر</span>
            <input class="input" name="password" type="password" dir="ltr" autocomplete="current-password" required></label>
          <p class="err" id="login-err">${esc(message)}</p>
          <button class="btn primary block" type="submit">دخول</button>
        </form>
      </section>
    </div>`;
  $("#login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const username = String(f.get("username")).trim().toLowerCase();
    const password = String(f.get("password"));
    const btn = e.target.querySelector("button");
    const err = $("#login-err");
    err.textContent = "";
    if (!username || !password) { err.textContent = "اكتب اسم المستخدم وكلمة السر"; return; }
    btn.disabled = true; btn.innerHTML = `<span class="spinner" style="width:18px;height:18px;border-width:2px;border-color:rgba(255,255,255,.4);border-top-color:#fff"></span>`;
    const { data, error } = await sb.auth.signInWithPassword({ email: `${username}@${EMAIL_DOMAIN}`, password });
    if (error) {
      btn.disabled = false; btn.textContent = "دخول";
      requestAnimationFrame(() => {
        err.textContent = /banned/i.test(error.message) ? "الحساب ده موقوف. كلّم مديرك." : "اسم المستخدم أو كلمة السر غير صحيحة";
      });
      return;
    }
    await boot(data.user.id);
  });
}

/* =====================================================================
   Shell + routing
   ===================================================================== */
function renderShell() {
  $("#root").innerHTML = `
    <div class="app">
      <aside class="side brand-bg">
        <div class="side-brand">
          <img class="side-logo" src="assets/logo-white.png" alt="Ibnsina Pharma">
          <div class="side-product">Digital Team Tasks Tracker</div>
        </div>
        <nav class="nav" id="nav" aria-label="القائمة الرئيسية"></nav>
        <div class="side-me" id="side-me"></div>
      </aside>
      <main class="main" id="view"></main>
    </div>`;
  window.onhashchange = () => { state.animate = true; route(); };
  window.onresize = () => placeTabPill(document);
  state.animate = true;
  route();
}

function renderNav() {
  if (!$("#nav")) return;
  const r = currentRoute();
  const myOpen = state.tasks.filter((t) => t.assignees.includes(state.me.id) && t.status !== "done").length;
  const items = [["tasks", "المهام", "tasks", myOpen], ["projects", "المشاريع", "projects"]];
  if (isManager()) items.push(["team", "أداء الفريق", "team"]);
  items.push(["org", "الهيكل التنظيمي", "org"]);
  if (isManager()) items.push(["users", "الموظفين", "users"]);
  $("#nav").innerHTML = items.map(([k, label, ic, n]) =>
    `<a href="#/${k}" class="${r.page === k ? "on" : ""}" ${r.page === k ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}</span>${n ? `<span class="count">${n}</span>` : ""}</a>`).join("");
  const me = state.me;
  $("#side-me").innerHTML = `
    <button class="avatar-btn" id="me-photo" title="تغيير صورتي" aria-label="تغيير صورتي">${avatar(me)}</button>
    <div class="who" title="${esc(me.full_name)}"><b>${esc(me.full_name)}</b><small>${esc(me.job_title || "")}</small></div>
    <button class="icon-btn" id="me-pass" title="تغيير كلمة السر" aria-label="تغيير كلمة السر">${icon("lock")}</button>
    <button class="icon-btn" id="logout" title="تسجيل الخروج" aria-label="تسجيل الخروج">${icon("logout")}</button>`;
  $("#logout").onclick = () => sb.auth.signOut();
  $("#me-pass").onclick = () => openPasswordModal(me);
  $("#me-photo").onclick = () => pickFile("image/*", async (file) => {
    try { await uploadAvatar(me.id, file); await loadProfiles(); state.animate = false; route(); toast("اتغيرت الصورة"); }
    catch (e) { toast(friendly(e), true); }
  });
}

function currentRoute() {
  const h = location.hash.replace(/^#\/?/, "");
  const [page, qs] = h.split("?");
  return { page: page || "tasks", params: new URLSearchParams(qs || "") };
}

function route() {
  if (!state.me || !$("#view")) return;
  const { page, params } = currentRoute();
  renderNav();
  const view = $("#view");
  if (page === "projects") renderProjects();
  else if (page === "team" && isManager()) renderTeam();
  else if (page === "org") renderOrg();
  else if (page === "users" && isManager()) renderUsers();
  else {
    if (location.hash !== state.lastHash) {
      state.lastHash = location.hash;
      state.view.user = params.get("user") || null;
      state.view.project = params.get("project") || "";
      if (state.view.user || state.view.project) { state.view.tab = "all"; state.view.status = "all"; }
    }
    renderTasks();
  }
  if (state.animate) {
    view.classList.remove("enter"); void view.offsetWidth; view.classList.add("enter");
    countUp(view);
    window.scrollTo({ top: 0 });
  } else {
    view.classList.remove("enter");
    $$("[data-count]", view).forEach((el) => { el.textContent = el.dataset.count; });
  }
  requestAnimationFrame(() => {
    placeTabPill(view);
    $$(".ring .fg", view).forEach((c) => { c.style.strokeDashoffset = c.dataset.off; });
  });
  state.animate = false;
}

/* =====================================================================
   Tasks view
   ===================================================================== */
function tasksForTab(tab) {
  const me = state.me.id;
  const team = new Set(descendants(me).map((p) => p.id));
  switch (tab) {
    case "mine":    return state.tasks.filter((t) => t.assignees.includes(me));
    case "created": return state.tasks.filter((t) => t.created_by === me);
    case "team":    return state.tasks.filter((t) => t.assignees.some((u) => team.has(u)));
    default:        return state.tasks;
  }
}

function sortTasks(list) {
  return [...list].sort((a, b) => {
    const ad = a.status === "done", bd = b.status === "done";
    if (ad !== bd) return ad ? 1 : -1;
    if (ad) return (b.completed_at || "").localeCompare(a.completed_at || "");
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return b.created_at.localeCompare(a.created_at);
  });
}

function deadlineCell(t) {
  if (!t.deadline) return `<span class="t-deadline">${icon("calendar", "sm")}بدون موعد</span>`;
  if (t.status === "done") return `<span class="t-deadline">${icon("calendar", "sm")}${fmtDate(t.deadline)}</span>`;
  const d = daysUntil(t.deadline);
  const cls = d < 0 ? "overdue" : d <= 2 ? "soon" : "";
  const label = d < 0 ? `متأخرة ${-d} يوم` : d === 0 ? "النهارده" : d === 1 ? "بكرة" : fmtDate(t.deadline);
  return `<span class="t-deadline ${cls}" title="${fmtDate(t.deadline)}">${icon(d < 0 ? "flame" : "calendar", "sm")}${label}</span>`;
}

const progressCell = (t) =>
  `<span class="progress t-progress"><span class="bar ${t.status === "done" ? "done" : ""}"><i style="width:${t.progress}%"></i></span><span class="num">${t.progress}%</span></span>`;

function avatarsCell(ids) {
  const ps = ids.map(profile).filter(Boolean);
  return `<span class="avatars">${ps.slice(0, 4).map((p) => avatar(p)).join("")}${ps.length > 4 ? `<span class="more">+${ps.length - 4}</span>` : ""}</span>`;
}

const projChip = (p) => p ? `<span class="proj-chip" style="--c:${esc(p.color)}"><i></i><span>${esc(p.name)}</span></span>` : "";

function projectOptions(selected, { includeArchivedId = null, emptyLabel = "بدون مشروع" } = {}) {
  const list = state.projects.filter((p) => p.status === "active" || p.id === includeArchivedId);
  return `<option value="">${emptyLabel}</option>` +
    list.map((p) => `<option value="${p.id}" ${p.id === selected ? "selected" : ""}>${esc(p.name)}${p.status === "archived" ? " (مؤرشف)" : ""}</option>`).join("");
}

function renderTasks() {
  const v = state.view;
  const tabs = [["mine", "مسندة لي"], ["created", "أنشأتها"]];
  if (isManager()) tabs.push(["team", "مهام فريقي"]);
  tabs.push(["all", "الكل"]);
  if (!tabs.some(([k]) => k === v.tab)) v.tab = "mine";
  if (v.project && !project(v.project)) v.project = "";

  let base = tasksForTab(v.tab);
  if (v.user) base = base.filter((t) => t.assignees.includes(v.user));
  if (v.project) base = base.filter((t) => t.project_id === v.project);

  const open = base.filter((t) => t.status !== "done");
  const stats = {
    open: open.length,
    overdue: base.filter(isOverdue).length,
    week: open.filter((t) => t.deadline && daysUntil(t.deadline) >= 0 && daysUntil(t.deadline) <= 7).length,
    done: base.filter((t) => t.status === "done").length,
  };

  let list = base;
  if (v.status === "overdue") list = list.filter(isOverdue);
  else if (v.status === "week") list = list.filter((t) => t.status !== "done" && t.deadline && daysUntil(t.deadline) >= 0 && daysUntil(t.deadline) <= 7);
  else if (v.status === "open") list = list.filter((t) => t.status !== "done");
  else if (v.status !== "all") list = list.filter((t) => t.status === v.status);
  if (v.q) {
    const q = v.q.toLowerCase();
    list = list.filter((t) => t.title.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q));
  }
  list = sortTasks(list);
  const filterUser = v.user && profile(v.user);
  const filterProj = project(v.project);
  const firstName = state.me.full_name.split(" ")[0];
  const myOpen = tasksForTab("mine").filter((t) => t.status !== "done").length;

  const statCard = (key, label, ic, tone, n) =>
    `<button class="stat ${tone} ${v.status === key ? "on" : ""}" data-st="${key}" aria-pressed="${v.status === key}">
       <div class="ico">${icon(ic)}</div><b data-count="${n}">${n}</b><span>${label}</span></button>`;

  $("#view").innerHTML = `
    <div class="page-head">
      <div><h1>${filterProj ? esc(filterProj.name) : "المهام"}</h1>
        <p>${filterProj ? esc(filterProj.description || "مهام المشروع") : `أهلاً ${esc(firstName)}، عندك ${myOpen} مهمة مفتوحة.`}</p></div>
      <button class="btn primary" id="new-task">${icon("plus")}مهمة جديدة</button>
    </div>
    <div class="stats">
      ${statCard("open", "مفتوحة", "inbox", "", stats.open)}
      ${statCard("overdue", "متأخرة", "flame", "t-bad", stats.overdue)}
      ${statCard("week", "خلال 7 أيام", "clock", "t-warn", stats.week)}
      ${statCard("done", "مكتملة", "check", "t-ok", stats.done)}
    </div>
    <div>
      <div class="tabs" role="tablist"><span class="pill-bg"></span>
        ${tabs.map(([k, l]) => `<button role="tab" aria-selected="${v.tab === k}" data-tab="${k}" class="${v.tab === k ? "on" : ""}">${l}<span class="n">${tasksForTab(k).length}</span></button>`).join("")}
      </div>
      ${filterUser ? `<span class="filter-tag">مهام ${esc(filterUser.full_name)} <button id="clear-user" aria-label="إلغاء الفلتر">×</button></span>` : ""}
    </div>
    <div class="toolbar">
      <div class="chips">
        <button class="chip ${v.status === "all" ? "on" : ""}" data-st="all">الكل</button>
        ${Object.entries(STATUS).map(([k, l]) => `<button class="chip ${v.status === k ? "on" : ""}" data-st="${k}">${l}</button>`).join("")}
      </div>
      <span class="grow"></span>
      <select class="input" id="proj-filter" aria-label="المشروع">${projectOptions(v.project, { includeArchivedId: v.project, emptyLabel: "كل المشاريع" })}</select>
      <div class="input-icon search">${icon("search", "sm")}<input class="input" id="q" type="search" placeholder="ابحث في المهام" value="${esc(v.q)}"></div>
    </div>
    <div class="list ${state.animate ? "stagger" : ""}">
      ${list.length ? `<div class="list-head"><span>الحالة</span><span>المهمة</span><span>المسؤولين</span><span>الموعد</span><span>الإنجاز</span><span></span></div>` : ""}
      ${list.map((t, i) => {
        const p = project(t.project_id);
        return `
        <div class="task-row ${t.status === "done" ? "done" : ""}" role="button" tabindex="0" data-id="${t.id}" aria-label="${esc(t.title)}" style="--i:${Math.min(i, 14)};${p ? `--c:${esc(p.color)}` : ""}">
          <span class="pill s-${t.status}">${STATUS[t.status]}</span>
          <span class="t-title"><b>${esc(t.title)}</b>
            <small>${p ? projChip(p) : ""}<span class="prio prio-${t.priority}">● ${PRIORITY[t.priority]}</span><span>من ${esc(profile(t.created_by)?.full_name || "—")}</span></small></span>
          ${avatarsCell(t.assignees)}
          ${deadlineCell(t)}
          ${progressCell(t)}
          <span class="row-actions">${canDeleteTask(t) ? `<button class="row-del" data-del="${t.id}" title="حذف المهمة" aria-label="حذف المهمة ${esc(t.title)}">${icon("trash", "sm")}</button>` : ""}</span>
        </div>`;
      }).join("") || `<div class="empty"><div class="ill">${icon("tasks")}</div><b>مفيش مهام هنا</b>${v.tab === "mine" && v.status === "all" && !v.project ? "أي مهمة تتسند لك هتظهر في القائمة دي." : "غيّر الفلتر أو أضف مهمة جديدة."}</div>`}
    </div>`;

  $("#new-task").onclick = () => openNewTask();
  $$("[data-tab]").forEach((b) => b.onclick = () => {
    v.tab = b.dataset.tab;
    $$("[data-tab]").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b); });
    placeTabPill($("#view"));
    setTimeout(() => { state.animate = true; renderTasks(); afterRender(); }, 180);
  });
  $$("[data-st]").forEach((b) => b.onclick = () => {
    v.status = v.status === b.dataset.st && b.classList.contains("stat") ? "all" : b.dataset.st;
    state.animate = true; renderTasks(); afterRender();
  });
  $$(".task-row").forEach((r) => {
    r.onclick = (e) => { if (!e.target.closest("[data-del]")) openTask(r.dataset.id); };
    r.onkeydown = (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === r) { e.preventDefault(); openTask(r.dataset.id); } };
  });
  $$("[data-del]").forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    const t = state.tasks.find((x) => x.id === b.dataset.del);
    if (t) deleteTask(t, b.closest(".task-row"));
  });
  $("#proj-filter").onchange = (e) => {
    const qs = new URLSearchParams();
    if (v.user) qs.set("user", v.user);
    if (e.target.value) qs.set("project", e.target.value);
    location.hash = "#/tasks" + (qs.toString() ? "?" + qs : "");
  };
  const q = $("#q");
  q.oninput = () => {
    v.q = q.value; clearTimeout(q._t);
    q._t = setTimeout(() => { renderTasks(); afterRender(); const n = $("#q"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250);
  };
  const cu = $("#clear-user");
  if (cu) cu.onclick = () => { location.hash = "#/tasks" + (v.project ? `?project=${v.project}` : ""); };
}

function afterRender() {
  const view = $("#view");
  $$("[data-count]", view).forEach((el) => { el.textContent = el.dataset.count; });
  requestAnimationFrame(() => placeTabPill(view));
  state.animate = false;
}

/* =====================================================================
   Modals
   ===================================================================== */
function closeModal() {
  const ov = $("#modal-root .overlay");
  if (!ov) return;
  document.body.style.overflow = "";
  if (reduceMotion) { $("#modal-root").innerHTML = ""; return; }
  ov.classList.add("closing");
  setTimeout(() => { if (ov.isConnected) $("#modal-root").innerHTML = ""; }, 200);
}
function openModal(html, { drawer = false, label = "" } = {}) {
  $("#modal-root").innerHTML = `<div class="overlay ${drawer ? "drawer" : ""}" role="dialog" aria-modal="true" aria-label="${esc(label)}">${drawer ? `<div class="panel">${html}</div>` : `<div class="modal">${html}</div>`}</div>`;
  document.body.style.overflow = "hidden";
  const ov = $("#modal-root .overlay");
  ov.addEventListener("mousedown", (e) => { if (e.target === ov) closeModal(); });
  setTimeout(() => $("input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])", ov)?.focus(), 60);
  return ov;
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#modal-root").innerHTML) closeModal(); });

function pickFile(accept, cb, multiple = false) {
  const i = document.createElement("input");
  i.type = "file"; i.accept = accept; i.multiple = multiple;
  i.onchange = () => i.files.length && cb(multiple ? [...i.files] : i.files[0]);
  i.click();
}

function peoplePicker(selected) {
  const sel = new Set(selected);
  const people = state.profiles.filter((p) => p.active);
  const me = state.me.id;
  people.sort((a, b) => (b.id === me) - (a.id === me) || a.full_name.localeCompare(b.full_name, "ar"));
  return `
    <div class="input-icon people-search">${icon("search", "sm")}<input class="input" type="search" placeholder="ابحث باسم الموظف" data-people-search></div>
    <div class="people-pick">
      ${people.map((p) => `
        <label data-name="${esc(p.full_name.toLowerCase())}">
          <input type="checkbox" name="assignee" value="${p.id}" ${sel.has(p.id) ? "checked" : ""}>
          ${avatar(p, "sm")}<span>${esc(p.full_name)}${p.id === me ? " (أنا)" : ""}</span>
          <small>${esc(p.job_title || "")}</small>
        </label>`).join("")}
    </div>`;
}
function wirePeopleSearch(root) {
  const s = $("[data-people-search]", root);
  if (!s) return;
  s.oninput = () => {
    const q = s.value.trim().toLowerCase();
    $$(".people-pick label", root).forEach((l) => l.hidden = q && !l.dataset.name.includes(q));
  };
}

function checkFileSize(file) {
  if (file.size > MAX_FILE_MB * 1048576) throw new Error(`${file.name}: الحد الأقصى ${MAX_FILE_MB} ميجا للملف`);
}

/* ---------- New task ---------- */
function openNewTask() {
  const ov = openModal(`
    <h2>مهمة جديدة</h2>
    <form id="nt">
      <label class="field"><span>عنوان المهمة</span><input class="input" name="title" maxlength="200" required></label>
      <label class="field"><span>المشروع</span><select class="input" name="project_id">${projectOptions(state.view.project)}</select></label>
      <label class="field"><span>التفاصيل</span><textarea class="input" name="description"></textarea></label>
      <div class="row2">
        <label class="field"><span>الموعد النهائي</span><input class="input" type="date" name="deadline"></label>
        <label class="field"><span>الأولوية</span>
          <select class="input" name="priority">${Object.entries(PRIORITY).map(([k, l]) => `<option value="${k}" ${k === "medium" ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      </div>
      <div class="field"><span>إسناد إلى</span>${peoplePicker([state.me.id])}</div>
      <label class="dropzone">${icon("clip", "sm")}<span id="nt-files">إرفاق ملفات (اختياري، حتى ${MAX_FILE_MB} ميجا للملف)</span><input type="file" multiple name="files"></label>
      <div id="nt-progress"></div>
      <p class="err" id="nt-err"></p>
      <div class="modal-foot">
        <button type="button" class="btn ghost" data-close>إلغاء</button>
        <button class="btn primary" type="submit">إنشاء المهمة</button>
      </div>
    </form>`, { label: "مهمة جديدة" });
  wirePeopleSearch(ov);
  $("[data-close]", ov).onclick = closeModal;
  const fileInput = $("#nt input[name=files]");
  fileInput.onchange = () => {
    $("#nt-files").textContent = fileInput.files.length ? [...fileInput.files].map((f) => f.name).join("، ") : `إرفاق ملفات (اختياري، حتى ${MAX_FILE_MB} ميجا للملف)`;
  };
  const err = (m) => { $("#nt-err").textContent = ""; requestAnimationFrame(() => $("#nt-err").textContent = m); };
  $("#nt").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const title = String(f.get("title")).trim();
    const assignees = f.getAll("assignee");
    if (!title) return err("اكتب عنوان المهمة");
    if (!assignees.length) return err("اختار شخص واحد على الأقل");
    try { [...fileInput.files].forEach(checkFileSize); } catch (ex) { return err(ex.message); }
    const btn = e.submitter; btn.disabled = true; btn.textContent = "جاري الحفظ…";
    try {
      const { data: task, error } = await sb.from("tasks").insert({
        title,
        description: String(f.get("description")).trim() || null,
        deadline: f.get("deadline") || null,
        priority: f.get("priority"),
        project_id: f.get("project_id") || null,
        created_by: state.me.id,
      }).select().single();
      if (error) throw error;
      const { error: e2 } = await sb.from("task_assignees").insert(assignees.map((u) => ({ task_id: task.id, user_id: u })));
      if (e2) throw e2;
      if (fileInput.files.length) {
        $("#nt-progress").innerHTML = `<div class="upload-bar"><i></i></div>`;
        for (const file of fileInput.files) await uploadTaskFile(task.id, file);
      }
      await loadTasks();
      closeModal(); state.animate = true; route();
      toast("اتعملت المهمة");
    } catch (ex) {
      err(friendly(ex));
      $("#nt-progress").innerHTML = "";
      btn.disabled = false; btn.textContent = "إنشاء المهمة";
    }
  };
}

/* ---------- Files ---------- */
async function uploadTaskFile(taskId, file) {
  checkFileSize(file);
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const path = `${taskId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from("task-files").upload(path, file, { contentType: file.type || undefined });
  if (error) throw error;
  const { error: e2 } = await sb.from("task_files").insert({
    task_id: taskId, file_name: file.name, storage_path: path,
    size_bytes: file.size, mime_type: file.type || null, uploaded_by: state.me.id,
  });
  if (e2) { await sb.storage.from("task-files").remove([path]); throw e2; }
}

async function renderFiles(taskId, box) {
  const { data, error } = await sb.from("task_files").select("*").eq("task_id", taskId).order("created_at", { ascending: false });
  if (error) { box.innerHTML = `<p class="err">${esc(friendly(error))}</p>`; return; }
  box.innerHTML = data.length ? `<div class="files">${data.map((f) => `
    <div class="file">
      <span class="ext">${esc((f.file_name.split(".").pop() || "").slice(0, 4))}</span>
      <span class="info"><b title="${esc(f.file_name)}">${esc(f.file_name)}</b>
        <small>${esc(profile(f.uploaded_by)?.full_name || "—")} · ${fmtDateTime(f.created_at)}${f.size_bytes ? " · " + fmtSize(f.size_bytes) : ""}</small></span>
      <button class="btn sm" data-dl="${f.id}">تحميل</button>
      ${f.uploaded_by === state.me.id || state.me.is_admin ? `<button class="btn sm ghost danger" data-rm="${f.id}" aria-label="حذف الملف">حذف</button>` : ""}
    </div>`).join("")}</div>` : `<p class="meta" style="margin:0">مفيش ملفات مرفقة لسه.</p>`;
  $$("[data-dl]", box).forEach((b) => b.onclick = async () => {
    const f = data.find((x) => x.id === b.dataset.dl);
    const { data: s, error: e } = await sb.storage.from("task-files").createSignedUrl(f.storage_path, 120, { download: f.file_name });
    if (e) return toast(friendly(e), true);
    window.open(s.signedUrl, "_blank", "noopener");
  });
  $$("[data-rm]", box).forEach((b) => b.onclick = async () => {
    const f = data.find((x) => x.id === b.dataset.rm);
    if (!confirm(`حذف "${f.file_name}"؟`)) return;
    await sb.storage.from("task-files").remove([f.storage_path]);
    const { error: e } = await sb.from("task_files").delete().eq("id", f.id);
    if (e) return toast(friendly(e), true);
    toast("اتحذف الملف"); renderFiles(taskId, box);
  });
}

/* ---------- Task drawer ---------- */
function openTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return toast("المهمة مش موجودة", true);
  const manage = canManageTask(t), work = canWorkOn(t);
  const creator = profile(t.created_by);
  const dropText = `اسحب الملفات هنا أو اضغط للاختيار (حتى ${MAX_FILE_MB} ميجا)`;
  const ov = openModal(`
    <div class="panel-top">
      <span class="pill s-${t.status}">${STATUS[t.status]}</span>
      <button class="icon-btn" data-close aria-label="إغلاق" style="color:var(--ink-2)">${icon("close")}</button>
    </div>
    <form id="td">
      <input class="title-input" name="title" value="${esc(t.title)}" ${manage ? "" : "disabled"} aria-label="عنوان المهمة" maxlength="200">
      <div class="meta">أنشأها ${esc(creator?.full_name || "—")} · ${fmtDateTime(t.created_at)}${t.completed_at ? ` · اكتملت ${fmtDateTime(t.completed_at)}` : ""}</div>

      <label class="field"><span>المشروع</span>
        <select class="input" name="project_id" ${manage ? "" : "disabled"}>${projectOptions(t.project_id, { includeArchivedId: t.project_id })}</select></label>
      <div class="row2">
        <label class="field"><span>الحالة</span>
          <select class="input" name="status" ${work ? "" : "disabled"}>${Object.entries(STATUS).map(([k, l]) => `<option value="${k}" ${t.status === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="field"><span>الأولوية</span>
          <select class="input" name="priority" ${manage ? "" : "disabled"}>${Object.entries(PRIORITY).map(([k, l]) => `<option value="${k}" ${t.priority === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      </div>
      <div class="row2">
        <label class="field"><span>الموعد النهائي</span><input class="input" type="date" name="deadline" value="${t.deadline || ""}" ${manage ? "" : "disabled"}></label>
        <div class="field"><span>نسبة الإنجاز</span>
          <div class="range-row"><input type="range" name="progress" min="0" max="100" step="5" value="${t.progress}" ${work ? "" : "disabled"} aria-label="نسبة الإنجاز"><output id="pv">${t.progress}%</output></div></div>
      </div>
      <label class="field"><span>التفاصيل</span><textarea class="input" name="description" ${manage ? "" : "disabled"}>${esc(t.description || "")}</textarea></label>

      <div class="section">
        <h3>${icon("users", "sm")}المسؤولين عن المهمة</h3>
        <div class="assignee-list">${t.assignees.map((u) => profile(u)).filter(Boolean).map((p) => `<span class="tag">${avatar(p, "sm")}${esc(p.full_name)}</span>`).join("")}</div>
        ${manage ? `<button type="button" class="btn sm" id="edit-as" style="margin-top:10px">${icon("edit", "sm")}تعديل المسؤولين</button><div id="as-edit" hidden style="margin-top:10px">${peoplePicker(t.assignees)}</div>` : ""}
      </div>

      ${work ? `<p class="err" id="td-err" style="margin-top:16px"></p>
      <div class="modal-foot">
        ${canDeleteTask(t) ? `<button type="button" class="btn danger ghost" id="del-task">${icon("trash", "sm")}حذف المهمة</button>` : ""}${manage ? `<span class="spacer"></span>` : ""}
        <button class="btn primary" type="submit">حفظ التغييرات</button>
      </div>` : ""}
    </form>

    <div class="section">
      <h3>${icon("clip", "sm")}الملفات</h3>
      <div id="files-box"><div class="spinner" style="margin:10px auto"></div></div>
      ${work ? `<label class="dropzone" id="drop">${icon("clip", "sm")}<span>${dropText}</span><input type="file" multiple></label><div id="up-progress"></div>` : ""}
    </div>`, { drawer: true, label: t.title });

  $("[data-close]", ov).onclick = closeModal;
  wirePeopleSearch(ov);
  const range = $("input[name=progress]", ov), status = $("select[name=status]", ov);
  range.oninput = () => { $("#pv", ov).textContent = range.value + "%"; };
  status.onchange = () => { if (status.value === "done") { range.value = 100; $("#pv", ov).textContent = "100%"; } };
  const ea = $("#edit-as", ov);
  if (ea) ea.onclick = () => { $("#as-edit", ov).hidden = false; ea.hidden = true; };

  const filesBox = $("#files-box", ov);
  renderFiles(t.id, filesBox);
  const drop = $("#drop", ov);
  if (drop) {
    const input = $("input", drop);
    const handle = async (files) => {
      if (!files.length) return;
      $("#up-progress", ov).innerHTML = `<div class="upload-bar"><i></i></div>`;
      try { for (const f of files) await uploadTaskFile(t.id, f); toast(files.length > 1 ? "اترفعت الملفات" : "اترفع الملف"); }
      catch (e) { toast(friendly(e), true); }
      $("#up-progress", ov).innerHTML = "";
      input.value = "";
      renderFiles(t.id, filesBox);
    };
    input.onchange = () => handle([...input.files]);
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
    drop.ondragleave = () => drop.classList.remove("over");
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); handle([...e.dataTransfer.files]); };
  }

  const del = $("#del-task", ov);
  if (del) del.onclick = () => deleteTask(t);

  const form = $("#td", ov);
  if (!work) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const tdErr = (m) => { $("#td-err", ov).textContent = ""; requestAnimationFrame(() => $("#td-err", ov).textContent = m); };
    const patch = { status: f.get("status"), progress: Number(f.get("progress")) };
    if (manage) {
      patch.title = String(f.get("title")).trim();
      patch.description = String(f.get("description")).trim() || null;
      patch.deadline = f.get("deadline") || null;
      patch.priority = f.get("priority");
      patch.project_id = f.get("project_id") || null;
      if (!patch.title) return tdErr("العنوان مطلوب");
    }
    const btn = e.submitter; btn.disabled = true;
    try {
      const { error } = await sb.from("tasks").update(patch).eq("id", t.id);
      if (error) throw error;
      if (manage && !$("#as-edit", ov).hidden) {
        const next = new Set(f.getAll("assignee"));
        if (!next.size) throw new Error("لازم يفضل شخص واحد مسؤول على الأقل");
        const add = [...next].filter((u) => !t.assignees.includes(u));
        const rm = t.assignees.filter((u) => !next.has(u));
        if (add.length) { const { error: ea2 } = await sb.from("task_assignees").insert(add.map((u) => ({ task_id: t.id, user_id: u }))); if (ea2) throw ea2; }
        if (rm.length) { const { error: er } = await sb.from("task_assignees").delete().eq("task_id", t.id).in("user_id", rm); if (er) throw er; }
      }
      await loadTasks(); closeModal(); route();
      toast(patch.status === "done" && t.status !== "done" ? "برافو! المهمة اكتملت" : "اتحفظت التغييرات");
    } catch (ex) {
      tdErr(friendly(ex)); btn.disabled = false;
    }
  };
}

/* ---------- Confirm + delete ---------- */
function confirmDialog({ title, body = "", ok = "تأكيد", danger = true }) {
  return new Promise((resolve) => {
    const root = document.createElement("div");
    root.className = "overlay confirm-layer";
    root.setAttribute("role", "alertdialog");
    root.setAttribute("aria-modal", "true");
    root.innerHTML = `<div class="modal confirm">
        <div class="confirm-ico ${danger ? "bad" : ""}">${icon(danger ? "trash" : "alert")}</div>
        <h2></h2><p></p>
        <div class="modal-foot"><button class="btn ghost" data-no>إلغاء</button><button class="btn ${danger ? "btn-danger" : "primary"}" data-yes></button></div>
      </div>`;
    $("h2", root).textContent = title;
    $("p", root).textContent = body;
    $("[data-yes]", root).textContent = ok;
    document.body.append(root);
    const done = (v) => {
      document.removeEventListener("keydown", onKey, true);
      root.classList.add("closing");
      setTimeout(() => root.remove(), reduceMotion ? 0 : 180);
      resolve(v);
    };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); done(false); } };
    document.addEventListener("keydown", onKey, true);
    root.addEventListener("mousedown", (e) => { if (e.target === root) done(false); });
    $("[data-no]", root).onclick = () => done(false);
    $("[data-yes]", root).onclick = () => done(true);
    setTimeout(() => $("[data-no]", root).focus(), 50);
  });
}

async function deleteTask(t, rowEl = null) {
  const ok = await confirmDialog({ title: "حذف المهمة؟", body: `«${t.title}» هتتحذف نهائيًا مع كل ملفاتها.`, ok: "حذف المهمة" });
  if (!ok) return;
  rowEl?.classList.add("removing");
  try {
    const { data: files } = await sb.from("task_files").select("storage_path").eq("task_id", t.id);
    const { data: gone, error } = await sb.from("tasks").delete().eq("id", t.id).select("id");
    if (error) throw error;
    if (!gone?.length) throw new Error("مش مسموح لك تحذف المهمة دي، اللي أنشأها أو مديره بس");
    if (files?.length) await sb.storage.from("task-files").remove(files.map((f) => f.storage_path));
  } catch (e) {
    rowEl?.classList.remove("removing");
    return toast(friendly(e), true);
  }
  if (rowEl && !reduceMotion) await new Promise((r) => setTimeout(r, 280));
  state.tasks = state.tasks.filter((x) => x.id !== t.id);
  if ($("#modal-root .overlay")) closeModal();
  route();
  toast("اتحذفت المهمة");
}

/* =====================================================================
   Projects
   ===================================================================== */
function projectStats(pid) {
  const ts = state.tasks.filter((t) => t.project_id === pid);
  const done = ts.filter((t) => t.status === "done").length;
  const progress = ts.length ? Math.round(ts.reduce((s, t) => s + (t.status === "done" ? 100 : t.progress), 0) / ts.length) : 0;
  const people = new Set(ts.flatMap((t) => t.assignees));
  return { total: ts.length, done, open: ts.length - done, overdue: ts.filter(isOverdue).length, progress, people: [...people] };
}

function ring(pct, color) {
  const r = 25, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return `<div class="ring" style="--c:${esc(color)}"><svg viewBox="0 0 58 58" aria-hidden="true">
    <circle class="bg" cx="29" cy="29" r="${r}"/>
    <circle class="fg" cx="29" cy="29" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${state.animate ? c.toFixed(1) : off.toFixed(1)}" data-off="${off.toFixed(1)}"/>
  </svg><b>${pct}%</b></div>`;
}

function renderProjects() {
  const all = state.projects;
  const active = all.filter((p) => p.status === "active");
  const archived = all.filter((p) => p.status === "archived");
  const shown = state.showArchived ? all : active;
  const canCreate = isManager();

  $("#view").innerHTML = `
    <div class="page-head">
      <div><h1>المشاريع</h1><p>${active.length} مشروع نشط${archived.length ? ` · ${archived.length} مؤرشف` : ""}</p></div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        ${archived.length ? `<label class="check" style="margin:0"><input type="checkbox" id="show-arch" ${state.showArchived ? "checked" : ""}> إظهار المؤرشفة</label>` : ""}
        ${canCreate ? `<button class="btn primary" id="new-proj">${icon("plus")}مشروع جديد</button>` : ""}
      </div>
    </div>
    ${shown.length ? `<div class="proj-grid ${state.animate ? "stagger" : ""}">
      ${shown.map((p, i) => {
        const s = projectStats(p.id);
        const lead = profile(p.lead_id);
        const ppl = s.people.map(profile).filter(Boolean);
        return `
        <div class="proj-card ${p.status === "archived" ? "archived" : ""}" style="--c:${esc(p.color)};--i:${Math.min(i, 12)}" data-proj="${p.id}" tabindex="0" role="link" aria-label="${esc(p.name)}">
          ${canEditProject(p) ? `<button class="icon-btn proj-edit" data-edit-proj="${p.id}" aria-label="تعديل المشروع" style="color:var(--ink-2)">${icon("edit", "sm")}</button>` : ""}
          <div class="proj-top">
            ${ring(s.progress, p.color)}
            <div class="grow"><h3>${esc(p.name)}</h3><p>${esc(p.description || (p.status === "archived" ? "مشروع مؤرشف" : "بدون وصف"))}</p></div>
          </div>
          <div class="proj-meta">
            <span>${icon("inbox", "sm")}${s.open} مفتوحة</span>
            <span>${icon("check", "sm")}${s.done} مكتملة</span>
            ${s.overdue ? `<span class="bad">${icon("flame", "sm")}${s.overdue} متأخرة</span>` : ""}
          </div>
          <div class="proj-foot">
            <span>${lead ? `المسؤول: ${esc(lead.full_name)}` : "بدون مسؤول"}</span>
            <span class="avatars">${ppl.slice(0, 5).map((x) => avatar(x, "sm")).join("")}${ppl.length > 5 ? `<span class="more">+${ppl.length - 5}</span>` : ""}</span>
          </div>
        </div>`;
      }).join("")}
    </div>` : `<div class="empty"><div class="ill">${icon("projects")}</div><b>مفيش مشاريع لسه</b>${canCreate ? 'اضغط "مشروع جديد" وابدأ تنظم مهام الفريق.' : "المدير هو اللي بيضيف المشاريع."}</div>`}`;

  const np = $("#new-proj"); if (np) np.onclick = () => openProjectModal();
  const sa = $("#show-arch"); if (sa) sa.onchange = (e) => { state.showArchived = e.target.checked; state.animate = true; route(); };
  $$("[data-proj]").forEach((c) => {
    const go = () => { location.hash = `#/tasks?project=${c.dataset.proj}`; };
    c.onclick = (e) => { if (!e.target.closest("[data-edit-proj]")) go(); };
    c.onkeydown = (e) => { if (e.key === "Enter" && e.target === c) go(); };
  });
  $$("[data-edit-proj]").forEach((b) => b.onclick = (e) => { e.stopPropagation(); openProjectModal(project(b.dataset.editProj)); });
}

function openProjectModal(p = null) {
  const isNew = !p;
  const color = p?.color || PROJECT_COLORS[state.projects.length % PROJECT_COLORS.length];
  const leads = state.profiles.filter((x) => x.active);
  const ov = openModal(`
    <h2>${isNew ? "مشروع جديد" : "تعديل المشروع"}</h2>
    <form id="pf2">
      <label class="field"><span>اسم المشروع</span><input class="input" name="name" maxlength="120" value="${esc(p?.name || "")}" required></label>
      <label class="field"><span>الوصف</span><textarea class="input" name="description" style="min-height:80px">${esc(p?.description || "")}</textarea></label>
      <label class="field"><span>المسؤول عن المشروع</span>
        <select class="input" name="lead_id"><option value="">بدون</option>
          ${leads.map((x) => `<option value="${x.id}" ${x.id === (p ? p.lead_id : state.me.id) ? "selected" : ""}>${esc(x.full_name)}${x.job_title ? " — " + esc(x.job_title) : ""}</option>`).join("")}
        </select></label>
      <div class="field"><span>اللون</span>
        <div class="swatches" role="radiogroup" aria-label="لون المشروع">
          ${PROJECT_COLORS.map((c) => `<label style="--c:${c}"><input type="radio" name="color" value="${c}" ${c === color ? "checked" : ""} aria-label="${c}"><span></span></label>`).join("")}
        </div></div>
      ${!isNew ? `<label class="check"><input type="checkbox" name="archived" ${p.status === "archived" ? "checked" : ""}> مشروع مؤرشف (مش هيظهر في اختيارات المهام الجديدة)</label>` : ""}
      <p class="err" id="pf2-err"></p>
      <div class="modal-foot">
        ${!isNew ? `<button type="button" class="btn danger ghost" id="del-proj">حذف المشروع</button><span class="spacer"></span>` : ""}
        <button type="button" class="btn ghost" data-close>إلغاء</button>
        <button class="btn primary" type="submit">${isNew ? "إنشاء المشروع" : "حفظ"}</button>
      </div>
    </form>`, { label: isNew ? "مشروع جديد" : "تعديل المشروع" });
  $("[data-close]", ov).onclick = closeModal;
  const err = (m) => { $("#pf2-err").textContent = ""; requestAnimationFrame(() => $("#pf2-err").textContent = m); };
  $("#pf2").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const row = {
      name: String(f.get("name")).trim(),
      description: String(f.get("description")).trim() || null,
      lead_id: f.get("lead_id") || null,
      color: f.get("color") || color,
    };
    if (!row.name) return err("اكتب اسم المشروع");
    if (!isNew) row.status = f.has("archived") ? "archived" : "active";
    const btn = e.submitter; btn.disabled = true;
    try {
      const { error } = isNew
        ? await sb.from("projects").insert({ ...row, created_by: state.me.id })
        : await sb.from("projects").update(row).eq("id", p.id);
      if (error) throw error;
      await loadProjects(); closeModal(); state.animate = true; route();
      toast(isNew ? "اتعمل المشروع" : "اتحفظ المشروع");
    } catch (ex) { err(friendly(ex)); btn.disabled = false; }
  };
  const del = $("#del-proj", ov);
  if (del) del.onclick = async () => {
    const n = state.tasks.filter((t) => t.project_id === p.id).length;
    if (!confirm(`حذف مشروع "${p.name}"؟${n ? ` المهام (${n}) مش هتتحذف، هتفضل من غير مشروع.` : ""}`)) return;
    const { error } = await sb.from("projects").delete().eq("id", p.id);
    if (error) return err(friendly(error));
    await Promise.all([loadProjects(), loadTasks()]);
    closeModal(); state.animate = true; route(); toast("اتحذف المشروع");
  };
}

/* =====================================================================
   Team performance
   ===================================================================== */
function statsFor(userId) {
  const mine = state.tasks.filter((t) => t.assignees.includes(userId));
  const done = mine.filter((t) => t.status === "done");
  const open = mine.filter((t) => t.status !== "done");
  const withDl = done.filter((t) => t.deadline);
  const onTime = withDl.filter((t) => t.completed_at && new Date(t.completed_at) <= new Date(t.deadline + "T23:59:59"));
  const avg = open.length ? Math.round(open.reduce((s, t) => s + t.progress, 0) / open.length) : null;
  const projects = [...new Set(open.map((t) => t.project_id).filter(Boolean))].map(project).filter(Boolean);
  return {
    done: done.length, open: open.length, overdue: open.filter(isOverdue).length, avg, projects,
    onTimeRate: withDl.length ? Math.round((onTime.length / withDl.length) * 100) : null,
    blocked: open.filter((t) => t.status === "blocked").length,
  };
}

function renderTeam() {
  const me = state.me;
  let members = me.is_admin ? state.profiles.filter((p) => p.id !== me.id) : descendants(me.id);
  if (state.teamDirectOnly) members = members.filter((p) => p.manager_id === me.id);
  const rows = members.map((p) => ({ p, s: statsFor(p.id) }));
  const tot = rows.reduce((a, { s }) => ({ open: a.open + s.open, overdue: a.overdue + s.overdue, done: a.done + s.done, blocked: a.blocked + s.blocked }), { open: 0, overdue: 0, done: 0, blocked: 0 });
  rows.sort((a, b) => b.s.overdue - a.s.overdue || b.s.open - a.s.open);

  $("#view").innerHTML = `
    <div class="page-head">
      <div><h1>أداء الفريق</h1><p>${members.length} موظف ${state.teamDirectOnly ? "تحت إدارتك المباشرة" : "تحت إدارتك"}</p></div>
      <label class="check" style="margin:0"><input type="checkbox" id="direct" ${state.teamDirectOnly ? "checked" : ""}> المباشرين فقط</label>
    </div>
    <div class="stats">
      <div class="stat"><div class="ico">${icon("inbox")}</div><b data-count="${tot.open}">${tot.open}</b><span>مهام مفتوحة</span></div>
      <div class="stat t-bad"><div class="ico">${icon("flame")}</div><b data-count="${tot.overdue}">${tot.overdue}</b><span>متأخرة</span></div>
      <div class="stat t-rev"><div class="ico">${icon("pause")}</div><b data-count="${tot.blocked}">${tot.blocked}</b><span>متوقفة</span></div>
      <div class="stat t-ok"><div class="ico">${icon("check")}</div><b data-count="${tot.done}">${tot.done}</b><span>مكتملة</span></div>
    </div>
    ${rows.length ? `<div class="table-wrap"><table class="t">
      <thead><tr><th>الموظف</th><th>شغال على</th><th>مفتوحة</th><th>متأخرة</th><th>مكتملة</th><th style="width:170px">متوسط الإنجاز</th><th>الالتزام بالمواعيد</th></tr></thead>
      <tbody>${rows.map(({ p, s }) => `
        <tr class="click ${p.active ? "" : "inactive"}" data-user="${p.id}" tabindex="0">
          <td><div class="person">${avatar(p)}<div><b>${esc(p.full_name)}</b><small>${esc(p.job_title || "")}${profile(p.manager_id) ? " · " + esc(profile(p.manager_id).full_name) : ""}</small></div></div></td>
          <td><div style="display:flex;flex-direction:column;gap:3px">${s.projects.slice(0, 3).map(projChip).join("") || '<span class="meta" style="margin:0">—</span>'}</div></td>
          <td class="num">${s.open}</td>
          <td class="num ${s.overdue ? "bad" : ""}">${s.overdue}</td>
          <td class="num">${s.done}</td>
          <td>${s.avg === null ? `<span class="meta">—</span>` : `<span class="progress"><span class="bar"><i style="width:${s.avg}%"></i></span><span class="num">${s.avg}%</span></span>`}</td>
          <td class="num">${s.onTimeRate === null ? "—" : s.onTimeRate + "%"}</td>
        </tr>`).join("")}</tbody></table></div>`
      : `<div class="empty"><div class="ill">${icon("users")}</div><b>مفيش موظفين تحت إدارتك لسه</b>أضف موظفين من صفحة الموظفين.</div>`}`;

  $("#direct").onchange = (e) => { state.teamDirectOnly = e.target.checked; state.animate = true; route(); };
  $$("tr[data-user]").forEach((tr) => {
    const go = () => { state.view.status = "all"; state.view.project = ""; location.hash = `#/tasks?user=${tr.dataset.user}`; };
    tr.onclick = go;
    tr.onkeydown = (e) => { if (e.key === "Enter") go(); };
  });
}

/* =====================================================================
   Org chart
   ===================================================================== */
function renderOrg() {
  const me = state.me.id;
  const roots = state.profiles.filter((p) => !p.manager_id || !profile(p.manager_id));
  const collapsed = state.orgCollapsed || (state.orgCollapsed = new Set());
  const canSeeWork = (p) => p.id === me || state.me.is_admin || isAncestor(me, p.id);
  const levels = [];

  const node = (p, depth = 0) => {
    if (depth > 30) return "";
    (levels[depth] = levels[depth] || []).push(p);
    const kids = [...(state.children.get(p.id) || [])].sort((a, b) =>
      (state.children.get(b.id)?.length || 0) - (state.children.get(a.id)?.length || 0) || a.full_name.localeCompare(b.full_name, "ar"));
    const team = descendants(p.id).length;
    const isCol = collapsed.has(p.id) && kids.length;
    const open = canSeeWork(p) ? state.tasks.filter((t) => t.assignees.includes(p.id) && t.status !== "done").length : null;
    const late = canSeeWork(p) ? state.tasks.filter((t) => t.assignees.includes(p.id) && isOverdue(t)).length : 0;
    const stats = [
      team ? `<span title="عدد الفريق">${icon("users", "sm")}${team}</span>` : "",
      open !== null ? `<span title="مهام مفتوحة">${icon("inbox", "sm")}${open}</span>` : "",
      late ? `<span class="bad" title="متأخرة">${icon("flame", "sm")}${late}</span>` : "",
    ].join("");
    return `<li class="${isCol ? "collapsed" : ""}" style="--d:${depth}">
      <div class="org-card ${p.id === me ? "me" : ""} ${p.active ? "" : "inactive"} ${canSeeWork(p) ? "link" : ""}" data-person="${p.id}" ${canSeeWork(p) ? 'tabindex="0" role="link"' : ""} dir="rtl">
        ${p.id === me ? `<span class="me-tag">${p.gender === "female" ? "أنتِ" : "أنت"}</span>` : ""}
        ${avatar(p, "lg")}
        <b>${esc(p.full_name)}</b>
        <small>${esc(p.job_title || "—")}</small>
        ${stats ? `<div class="org-stats">${stats}</div>` : ""}
      </div>
      ${kids.length ? `<button class="org-toggle" data-toggle="${p.id}" aria-expanded="${!isCol}" aria-label="${isCol ? "إظهار" : "إخفاء"} فريق ${esc(p.full_name)}">${isCol ? `+${team}` : "−"}</button>
        <ul>${kids.map((k) => node(k, depth + 1)).join("")}</ul>` : ""}
    </li>`;
  };
  const treeHtml = roots.map((r) => node(r)).join("");
  const managers = state.profiles.filter((p) => (state.children.get(p.id) || []).length).length;

  $("#view").innerHTML = `
    <div class="page-head">
      <div><h1>الهيكل التنظيمي</h1><p>${state.profiles.length} موظف · ${managers} مدير · ${levels.length} مستويات</p></div>
      <div class="org-tools">
        <button class="btn sm" id="org-expand">${icon("expand", "sm")}فتح الكل</button>
        <button class="btn sm" id="org-collapse">${icon("collapse", "sm")}طي الكل</button>
        <span class="zoom">
          <button class="icon-btn" id="zoom-out" aria-label="تصغير">${icon("zoomOut", "sm")}</button>
          <output id="zoom-val">${Math.round((state.orgZoom || 1) * 100)}%</output>
          <button class="icon-btn" id="zoom-in" aria-label="تكبير">${icon("zoomIn", "sm")}</button>
        </span>
      </div>
    </div>
    <div class="org-viewport" id="org-vp" dir="ltr">
      <div class="tree ${state.animate ? "grow" : ""}" id="org-tree" style="zoom:${state.orgZoom || 1}"><ul>${treeHtml}</ul></div>
    </div>
    <p class="meta" style="margin-top:10px">اسحب بالماوس عشان تتحرك في الهيكل، واضغط على أي شخص في فريقك عشان تشوف مهامه.</p>`;

  const vp = $("#org-vp"), tree = $("#org-tree");
  const center = () => { vp.scrollLeft = Math.max(0, (vp.scrollWidth - vp.clientWidth) / 2); };
  requestAnimationFrame(() => {
    if (!state.orgZoom) {
      const natural = tree.scrollWidth;
      const fit = natural > vp.clientWidth ? Math.max(.5, Math.floor((vp.clientWidth / natural) * 10) / 10) : 1;
      tree.style.zoom = fit;
      $("#zoom-val").textContent = Math.round(fit * 100) + "%";
      state.orgZoomFit = fit;
    }
    center();
  });

  $$("[data-toggle]", vp).forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    const id = b.dataset.toggle, li = b.closest("li");
    const nowCol = !li.classList.contains("collapsed");
    li.classList.toggle("collapsed", nowCol);
    nowCol ? collapsed.add(id) : collapsed.delete(id);
    b.setAttribute("aria-expanded", String(!nowCol));
    b.textContent = nowCol ? `+${descendants(id).length}` : "−";
  });
  $("#org-expand").onclick = () => { collapsed.clear(); state.animate = true; route(); };
  $("#org-collapse").onclick = () => {
    roots.forEach((r) => (state.children.get(r.id) || []).forEach((k) => { if ((state.children.get(k.id) || []).length) collapsed.add(k.id); }));
    state.animate = true; route();
  };
  const setZoom = (z) => {
    state.orgZoom = Math.min(1.4, Math.max(.5, Math.round(z * 10) / 10));
    tree.style.zoom = state.orgZoom;
    $("#zoom-val").textContent = Math.round(state.orgZoom * 100) + "%";
  };
  const cur = () => state.orgZoom || state.orgZoomFit || 1;
  $("#zoom-in").onclick = () => { setZoom(cur() + .1); center(); };
  $("#zoom-out").onclick = () => { setZoom(cur() - .1); center(); };

  $$(".org-card.link", vp).forEach((c) => {
    const go = () => { location.hash = `#/tasks?user=${c.dataset.person}`; };
    c.onclick = () => { if (!vp.dataset.dragged) go(); };
    c.onkeydown = (e) => { if (e.key === "Enter") go(); };
  });

  // drag to pan
  let drag = null;
  vp.onpointerdown = (e) => {
    if (e.button !== 0 || e.target.closest("button")) return;
    drag = { x: e.clientX, y: e.clientY, l: vp.scrollLeft, t: vp.scrollTop, moved: false };
    delete vp.dataset.dragged;
  };
  vp.onpointermove = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true; vp.classList.add("dragging"); vp.dataset.dragged = "1";
    vp.scrollLeft = drag.l - dx; vp.scrollTop = drag.t - dy;
  };
  const end = () => { drag = null; vp.classList.remove("dragging"); setTimeout(() => delete vp.dataset.dragged, 60); };
  vp.onpointerup = end; vp.onpointerleave = end;
}

/* =====================================================================
   Users (managers / admin)
   ===================================================================== */
function renderUsers() {
  const list = manageable();
  $("#view").innerHTML = `
    <div class="page-head">
      <div><h1>الموظفين</h1><p>${state.me.is_admin ? "إدارة كل حسابات الفريق" : "الموظفين تحت إدارتك"}</p></div>
      <button class="btn primary" id="add-user">${icon("plus")}إضافة موظف</button>
    </div>
    ${list.length ? `<div class="table-wrap"><table class="t">
      <thead><tr><th>الموظف</th><th>اسم المستخدم</th><th>النوع</th><th>المدير المباشر</th><th>الحالة</th><th></th></tr></thead>
      <tbody>${list.map((p) => `
        <tr class="${p.active ? "" : "inactive"}">
          <td><div class="person">${avatar(p)}<div><b>${esc(p.full_name)}${p.is_admin ? ` <span class="pill s-review">أدمن</span>` : ""}</b><small>${esc(p.job_title || "")}</small></div></div></td>
          <td dir="ltr" style="text-align:start">${esc(p.username)}</td>
          <td>${genderPill(p.gender)}</td>
          <td>${esc(profile(p.manager_id)?.full_name || "—")}</td>
          <td>${p.active ? `<span class="pill s-done">نشط</span>` : `<span class="pill s-blocked">موقوف</span>`}</td>
          <td><button class="btn sm" data-edit="${p.id}">${icon("edit", "sm")}تعديل</button></td>
        </tr>`).join("")}</tbody></table></div>`
      : `<div class="empty"><div class="ill">${icon("users")}</div><b>مفيش موظفين لسه</b>اضغط "إضافة موظف" وابدأ تبني فريقك.</div>`}`;
  $("#add-user").onclick = () => openUserModal();
  $$("[data-edit]").forEach((b) => b.onclick = () => openUserModal(profile(b.dataset.edit)));
}

function managerOptions(user) {
  const exclude = new Set(user ? [user.id, ...descendants(user.id).map((p) => p.id)] : []);
  const base = state.me.is_admin ? state.profiles : [state.me, ...descendants(state.me.id)];
  const opts = base.filter((p) => !exclude.has(p.id));
  const current = user ? user.manager_id : state.me.id;
  return `${state.me.is_admin ? `<option value="">— بدون مدير (أعلى الهيكل) —</option>` : ""}
    ${opts.map((p) => `<option value="${p.id}" ${p.id === current ? "selected" : ""}>${esc(p.full_name)}${p.job_title ? " — " + esc(p.job_title) : ""}</option>`).join("")}`;
}

function openUserModal(user = null) {
  const isNew = !user;
  let photo = null;
  const ov = openModal(`
    <h2>${isNew ? "إضافة موظف" : "تعديل بيانات الموظف"}</h2>
    <form id="uf">
      <div class="avatar-pick">
        <span id="uf-av">${user ? avatar(user, "lg") : `<span class="av lg" style="background:var(--line);color:var(--ink-3)">${icon("plus")}</span>`}</span>
        <button type="button" class="btn sm" id="uf-photo">${user?.avatar_url ? "تغيير الصورة" : "إضافة صورة"}</button>
      </div>
      <label class="field"><span>الاسم بالكامل</span><input class="input" name="full_name" value="${esc(user?.full_name || "")}" required></label>
      <div class="row2">
        <label class="field"><span>المسمى الوظيفي</span><input class="input" name="job_title" value="${esc(user?.job_title || "")}"></label>
        <div class="field"><span>النوع</span>
          <div class="seg" role="radiogroup" aria-label="النوع">
            ${Object.entries(GENDER).map(([k, l]) => `<label><input type="radio" name="gender" value="${k}" ${user?.gender === k ? "checked" : ""}><span>${k === "female" ? "♀" : "♂"} ${l}</span></label>`).join("")}
          </div></div>
      </div>
      <label class="field"><span>المدير المباشر</span><select class="input" name="manager_id">${managerOptions(user)}</select></label>
      ${isNew ? `
      <div class="row2">
        <label class="field"><span>اسم المستخدم</span><input class="input" name="username" dir="ltr" autocapitalize="none" autocomplete="off" placeholder="ahmed.ali" required></label>
        <label class="field"><span>كلمة السر</span><input class="input" name="password" dir="ltr" autocomplete="new-password" minlength="8" placeholder="8 حروف على الأقل" required></label>
      </div>` : `<p class="meta">اسم المستخدم: <b dir="ltr">${esc(user.username)}</b></p>`}
      ${state.me.is_admin && (!user || user.id !== state.me.id) ? `<label class="check"><input type="checkbox" name="is_admin" ${user?.is_admin ? "checked" : ""}> صلاحية أدمن (يدير كل الموظفين ويشوف كل المهام)</label>` : ""}
      <p class="err" id="uf-err"></p>
      <div class="modal-foot">
        ${!isNew && user.id !== state.me.id ? `
          ${state.me.is_admin ? `<button type="button" class="btn sm" id="uf-pass">تغيير كلمة السر</button>` : ""}
          <button type="button" class="btn sm" id="uf-active">${user.active ? "إيقاف الحساب" : "تفعيل الحساب"}</button>
          <button type="button" class="btn sm danger ghost" id="uf-del">حذف</button>
          <span class="spacer"></span>` : ""}
        <button type="button" class="btn ghost" data-close>إلغاء</button>
        <button class="btn primary" type="submit">${isNew ? "إنشاء الحساب" : "حفظ"}</button>
      </div>
    </form>`, { label: isNew ? "إضافة موظف" : "تعديل بيانات الموظف" });
  $("[data-close]", ov).onclick = closeModal;
  $("#uf-photo", ov).onclick = () => pickFile("image/*", (file) => {
    photo = file;
    $("#uf-av", ov).innerHTML = `<img class="av lg" src="${URL.createObjectURL(file)}" alt="">`;
  });
  const err = (m) => { $("#uf-err", ov).textContent = ""; requestAnimationFrame(() => $("#uf-err", ov).textContent = m); };

  $("#uf", ov).onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const full_name = String(f.get("full_name")).trim();
    const job_title = String(f.get("job_title")).trim() || null;
    const manager_id = f.get("manager_id") || null;
    const gender = f.get("gender") || null;
    if (!gender) return err("اختار النوع");
    if (!full_name) return err("اكتب الاسم");
    const btn = e.submitter; btn.disabled = true;
    try {
      let id = user?.id;
      if (isNew) {
        const username = String(f.get("username")).trim().toLowerCase();
        const password = String(f.get("password"));
        if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error("اسم المستخدم: حروف إنجليزية صغيرة وأرقام و . _ - (من 3 لـ 30)");
        if (password.length < 8) throw new Error("كلمة السر 8 حروف على الأقل");
        const r = await adminCall({ action: "create", username, password, full_name, job_title, manager_id });
        id = r.id;
        const { error: ge } = await sb.from("profiles").update({ gender }).eq("id", id);
        if (ge) throw ge;
      } else {
        const { error } = await sb.from("profiles").update({ full_name, job_title, manager_id, gender }).eq("id", id);
        if (error) throw error;
      }
      if (state.me.is_admin && f.has("is_admin") !== !!user?.is_admin && (!user || user.id !== state.me.id)) {
        const { error } = await sb.from("profiles").update({ is_admin: f.has("is_admin") }).eq("id", id);
        if (error) throw error;
      }
      if (photo) await uploadAvatar(id, photo);
      await loadProfiles(); closeModal(); route();
      toast(isNew ? "اتعمل الحساب، ابعت للموظف اسم المستخدم وكلمة السر" : "اتحفظت البيانات");
    } catch (ex) { err(friendly(ex)); btn.disabled = false; }
  };

  if (!isNew && user.id !== state.me.id) {
    const up = $("#uf-pass", ov); if (up) up.onclick = () => openPasswordModal(user);
    $("#uf-active", ov).onclick = async () => {
      if (!confirm(user.active ? `إيقاف حساب ${user.full_name}؟ مش هيقدر يدخل السستم.` : `تفعيل حساب ${user.full_name}؟`)) return;
      try { await adminCall({ action: "set_active", user_id: user.id, active: !user.active }); await loadProfiles(); closeModal(); route(); toast("اتحدثت حالة الحساب"); }
      catch (ex) { err(friendly(ex)); }
    };
    $("#uf-del", ov).onclick = async () => {
      if (!confirm(`حذف ${user.full_name} نهائيًا؟ الموظفين اللي تحته هيتنقلوا لمديره.`)) return;
      try { await adminCall({ action: "delete", user_id: user.id }); await Promise.all([loadProfiles(), loadTasks()]); closeModal(); route(); toast("اتحذف الموظف"); }
      catch (ex) { err(friendly(ex)); }
    };
  }
}

function openPasswordModal(user) {
  const self = user.id === state.me.id;
  const ov = openModal(`
    <h2>${self ? "تغيير كلمة السر" : `كلمة سر جديدة لـ ${esc(user.full_name)}`}</h2>
    <form id="pf">
      <label class="field"><span>كلمة السر الجديدة</span><input class="input" name="p1" type="password" dir="ltr" minlength="8" autocomplete="new-password" required></label>
      <label class="field"><span>تأكيد كلمة السر</span><input class="input" name="p2" type="password" dir="ltr" minlength="8" autocomplete="new-password" required></label>
      <p class="err" id="pf-err"></p>
      <div class="modal-foot"><button type="button" class="btn ghost" data-close>إلغاء</button><button class="btn primary" type="submit">حفظ كلمة السر</button></div>
    </form>`, { label: "تغيير كلمة السر" });
  $("[data-close]", ov).onclick = closeModal;
  const err = (m) => { $("#pf-err").textContent = ""; requestAnimationFrame(() => $("#pf-err").textContent = m); };
  $("#pf", ov).onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const p1 = String(f.get("p1")), p2 = String(f.get("p2"));
    if (p1.length < 8) return err("8 حروف على الأقل");
    if (p1 !== p2) return err("كلمتين السر مش متطابقين");
    try {
      if (self) { const { error } = await sb.auth.updateUser({ password: p1 }); if (error) throw error; }
      else await adminCall({ action: "set_password", user_id: user.id, password: p1 });
      closeModal(); toast("اتغيرت كلمة السر");
    } catch (ex) { err(friendly(ex)); }
  };
}

init();
