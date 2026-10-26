import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, EMAIL_DOMAIN } from "./config.js";

/* =====================================================================
   Helpers
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const STATUS = {
  todo:        "جديدة",
  in_progress: "قيد التنفيذ",
  review:      "مراجعة",
  blocked:     "متوقفة",
  done:        "مكتملة",
};
const PRIORITY = { high: "عالية", medium: "متوسطة", low: "منخفضة" };

const fmtDate = (d) => d ? new Date(d.length === 10 ? d + "T00:00:00" : d)
  .toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" }) : "";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("ar-EG",
  { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const daysUntil = (dateStr) => Math.round((new Date(dateStr + "T00:00:00") - today()) / 86400000);
const fmtSize = (b) => b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : (b / 1048576).toFixed(1) + " MB";

function toast(msg, bad = false) {
  const el = document.createElement("div");
  el.textContent = msg;
  if (bad) el.className = "bad";
  $("#toast").append(el);
  setTimeout(() => el.remove(), 3200);
}

const AV_COLORS = ["#0B6FC4", "#4A5DA8", "#167F8C", "#7A4FB5", "#B5562F", "#2E7D4F", "#A63D6B", "#5B6B82"];
function avatar(p, cls = "") {
  if (!p) return `<span class="av ${cls}">?</span>`;
  if (p.avatar_url) return `<img class="av ${cls}" src="${esc(p.avatar_url)}" alt="${esc(p.full_name)}" loading="lazy">`;
  const initials = p.full_name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("");
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
  view: { tab: "mine", status: "all", q: "", user: null },
  teamDirectOnly: false,
};

const profile = (id) => state.byId.get(id);

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
const manageable = () => state.me.is_admin
  ? state.profiles
  : descendants(state.me.id);

function canManageTask(t) {
  const me = state.me.id;
  return state.me.is_admin || t.created_by === me ||
    (t.created_by && isAncestor(me, t.created_by)) ||
    t.assignees.some((u) => isAncestor(me, u));
}
const canWorkOn = (t) => canManageTask(t) || t.assignees.includes(state.me.id);

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
    await loadTasks();
    renderShell();
    subscribe();
  } catch (e) {
    console.error(e);
    renderLogin(e.message);
  }
}

let channel, reloadTimer;
function subscribe() {
  if (channel) sb.removeChannel(channel);
  const reload = () => {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(async () => {
      try { await loadProfiles(); await loadTasks(); renderNav(); route(); } catch (e) { console.error(e); }
    }, 400);
  };
  channel = sb.channel("crm")
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, reload)
    .on("postgres_changes", { event: "*", schema: "public", table: "task_assignees" }, reload)
    .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, reload)
    .subscribe();
}

function renderSetup() {
  $("#root").innerHTML = `
    <div class="setup">
      <h2>محتاج إعداد Supabase</h2>
      <p>افتح <code>js/config.js</code> وحط <code>SUPABASE_URL</code> و <code>SUPABASE_ANON_KEY</code> بتوع مشروعك، وبعدها اعمل refresh.</p>
      <p>الخطوات كاملة في ملف <code>README.md</code>.</p>
    </div>`;
}

function renderLogin(message = "") {
  if (channel) { sb.removeChannel(channel); channel = null; }
  state.me = null;
  closeModal();
  $("#root").innerHTML = `
    <div class="login">
      <section class="login-art brand-bg">
        <img src="assets/logo-white.png" alt="Ibnsina Pharma">
        <div>
          <h1>Ibnsina Digital CRM</h1>
          <p>مهام الفريق، المواعيد، والملفات في مكان واحد — وكل مدير شايف أداء فريقه أول بأول.</p>
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
    if (!username || !password) { $("#login-err").textContent = "اكتب اسم المستخدم وكلمة السر"; return; }
    btn.disabled = true; btn.textContent = "جاري الدخول…";
    const { data, error } = await sb.auth.signInWithPassword({ email: `${username}@${EMAIL_DOMAIN}`, password });
    if (error) {
      btn.disabled = false; btn.textContent = "دخول";
      $("#login-err").textContent = /banned/i.test(error.message)
        ? "الحساب ده موقوف. كلّم مديرك."
        : "اسم المستخدم أو كلمة السر غير صحيحة";
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
        <img class="side-logo" src="assets/logo-white.png" alt="Ibnsina Pharma">
        <div class="side-product">Digital CRM</div>
        <nav class="nav" id="nav"></nav>
        <div class="side-me" id="side-me"></div>
      </aside>
      <main class="main" id="view"></main>
    </div>`;
  renderNav();
  window.onhashchange = route;
  route();
}

function renderNav() {
  if (!$("#nav")) return;
  const r = currentRoute();
  const myOpen = state.tasks.filter((t) => t.assignees.includes(state.me.id) && t.status !== "done").length;
  const items = [["tasks", "المهام", myOpen]];
  if (isManager()) items.push(["team", "أداء الفريق"]);
  items.push(["org", "الهيكل التنظيمي"]);
  if (isManager()) items.push(["users", "الموظفين"]);
  $("#nav").innerHTML = items.map(([k, label, n]) =>
    `<a href="#/${k}" class="${r.page === k ? "on" : ""}">${label}${n ? `<span class="count">${n}</span>` : ""}</a>`).join("");
  const me = state.me;
  $("#side-me").innerHTML = `
    <button class="avatar-btn" id="me-photo" title="تغيير صورتي">${avatar(me)}</button>
    <div class="who"><b>${esc(me.full_name)}</b><small>${esc(me.job_title || "")}</small></div>
    <button id="me-pass" title="تغيير كلمة السر" aria-label="تغيير كلمة السر">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></button>
    <button id="logout" title="تسجيل الخروج" aria-label="تسجيل الخروج">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11"/></svg></button>`;
  $("#logout").onclick = () => sb.auth.signOut();
  $("#me-pass").onclick = () => openPasswordModal(me);
  $("#me-photo").onclick = () => pickFile("image/*", async (file) => {
    try { await uploadAvatar(me.id, file); await loadProfiles(); renderNav(); route(); toast("اتغيرت الصورة"); }
    catch (e) { toast(e.message, true); }
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
  if (page === "team" && isManager()) return renderTeam();
  if (page === "org") return renderOrg();
  if (page === "users" && isManager()) return renderUsers();
  if (params.get("user")) { state.view.user = params.get("user"); state.view.tab = "all"; }
  else state.view.user = null;
  renderTasks();
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
  if (!t.deadline) return `<span class="t-deadline">بدون موعد</span>`;
  if (t.status === "done") return `<span class="t-deadline">${fmtDate(t.deadline)}</span>`;
  const d = daysUntil(t.deadline);
  const cls = d < 0 ? "overdue" : d <= 2 ? "soon" : "";
  const label = d < 0 ? `متأخرة ${-d} يوم` : d === 0 ? "النهارده" : d === 1 ? "بكرة" : fmtDate(t.deadline);
  return `<span class="t-deadline ${cls}" title="${fmtDate(t.deadline)}">${label}</span>`;
}

function progressCell(t) {
  return `<span class="progress t-progress"><span class="bar ${t.status === "done" ? "done" : ""}"><i style="width:${t.progress}%"></i></span><span class="num">${t.progress}%</span></span>`;
}

function avatarsCell(ids) {
  const ps = ids.map(profile).filter(Boolean);
  return `<span class="avatars">${ps.slice(0, 4).map((p) => avatar(p)).join("")}${ps.length > 4 ? `<span class="more">+${ps.length - 4}</span>` : ""}</span>`;
}

function renderTasks() {
  const v = state.view;
  const tabs = [["mine", "مسندة لي"], ["created", "أنشأتها"]];
  if (isManager()) tabs.push(["team", "مهام فريقي"]);
  tabs.push(["all", "الكل"]);
  if (!tabs.some(([k]) => k === v.tab)) v.tab = "mine";

  let list = tasksForTab(v.tab);
  if (v.user) list = list.filter((t) => t.assignees.includes(v.user));
  const counts = { all: list.length };
  for (const k of Object.keys(STATUS)) counts[k] = list.filter((t) => t.status === k).length;
  counts.overdue = list.filter((t) => t.status !== "done" && t.deadline && daysUntil(t.deadline) < 0).length;
  if (v.status === "overdue") list = list.filter((t) => t.status !== "done" && t.deadline && daysUntil(t.deadline) < 0);
  else if (v.status !== "all") list = list.filter((t) => t.status === v.status);
  if (v.q) {
    const q = v.q.toLowerCase();
    list = list.filter((t) => t.title.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q));
  }
  list = sortTasks(list);
  const filterUser = v.user && profile(v.user);

  $("#view").innerHTML = `
    <div class="page-head">
      <div><h1>المهام</h1><p>أهلاً ${esc(state.me.full_name.split(" ")[0])}، عندك ${tasksForTab("mine").filter((t) => t.status !== "done").length} مهمة مفتوحة.</p></div>
      <button class="btn primary" id="new-task">+ مهمة جديدة</button>
    </div>
    <div class="tabs" role="tablist">
      ${tabs.map(([k, l]) => `<button role="tab" data-tab="${k}" class="${v.tab === k ? "on" : ""}">${l}<span class="n">${tasksForTab(k).length}</span></button>`).join("")}
    </div>
    ${filterUser ? `<div class="filter-user">مهام ${esc(filterUser.full_name)} <button id="clear-user" aria-label="إلغاء الفلتر">×</button></div>` : ""}
    <div class="toolbar">
      <div class="chips">
        <button class="chip ${v.status === "all" ? "on" : ""}" data-st="all">الكل ${counts.all}</button>
        ${Object.entries(STATUS).map(([k, l]) => `<button class="chip ${v.status === k ? "on" : ""}" data-st="${k}">${l} ${counts[k]}</button>`).join("")}
        ${counts.overdue ? `<button class="chip ${v.status === "overdue" ? "on" : ""}" data-st="overdue" style="color:var(--danger)">متأخرة ${counts.overdue}</button>` : ""}
      </div>
      <input class="input search" id="q" type="search" placeholder="ابحث في المهام" value="${esc(v.q)}">
    </div>
    <div class="list">
      ${list.length ? `<div class="list-head"><span>الحالة</span><span>المهمة</span><span>المسؤولين</span><span>الموعد</span><span>الإنجاز</span></div>` : ""}
      ${list.map((t) => `
        <button class="task-row" data-id="${t.id}">
          <span class="pill s-${t.status}">${STATUS[t.status]}</span>
          <span class="t-title"><b>${esc(t.title)}</b><small><span class="prio-${t.priority}">● </span>${PRIORITY[t.priority]} · من ${esc(profile(t.created_by)?.full_name || "—")}</small></span>
          ${avatarsCell(t.assignees)}
          ${deadlineCell(t)}
          ${progressCell(t)}
        </button>`).join("") || `<div class="empty"><b>مفيش مهام هنا</b>${v.tab === "mine" ? "أي مهمة تتسند لك هتظهر في القائمة دي." : "غيّر الفلتر أو أضف مهمة جديدة."}</div>`}
    </div>`;

  $("#new-task").onclick = () => openNewTask();
  $$("[data-tab]").forEach((b) => b.onclick = () => { v.tab = b.dataset.tab; renderTasks(); });
  $$("[data-st]").forEach((b) => b.onclick = () => { v.status = b.dataset.st; renderTasks(); });
  $$(".task-row").forEach((b) => b.onclick = () => openTask(b.dataset.id));
  const q = $("#q");
  q.oninput = () => { v.q = q.value; clearTimeout(q._t); q._t = setTimeout(() => { renderTasks(); const n = $("#q"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  const cu = $("#clear-user");
  if (cu) cu.onclick = () => { v.user = null; location.hash = "#/tasks"; };
}

/* =====================================================================
   Modals
   ===================================================================== */
function closeModal() { $("#modal-root").innerHTML = ""; document.body.style.overflow = ""; }
function openModal(html, { drawer = false } = {}) {
  $("#modal-root").innerHTML = `<div class="overlay ${drawer ? "drawer" : ""}">${drawer ? `<div class="panel">${html}</div>` : `<div class="modal">${html}</div>`}</div>`;
  document.body.style.overflow = "hidden";
  const ov = $("#modal-root .overlay");
  ov.addEventListener("mousedown", (e) => { if (e.target === ov) closeModal(); });
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
    <input class="input people-search" type="search" placeholder="ابحث باسم الموظف" data-people-search>
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

/* ---------- New task ---------- */
function openNewTask() {
  const ov = openModal(`
    <h2>مهمة جديدة</h2>
    <form id="nt">
      <label class="field"><span>عنوان المهمة</span><input class="input" name="title" maxlength="200" required autofocus></label>
      <label class="field"><span>التفاصيل</span><textarea class="input" name="description"></textarea></label>
      <div class="row2">
        <label class="field"><span>الموعد النهائي</span><input class="input" type="date" name="deadline"></label>
        <label class="field"><span>الأولوية</span>
          <select class="input" name="priority">${Object.entries(PRIORITY).map(([k, l]) => `<option value="${k}" ${k === "medium" ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      </div>
      <div class="field"><span>إسناد إلى</span>${peoplePicker([state.me.id])}</div>
      <label class="dropzone" id="nt-drop">إرفاق ملفات (اختياري)<input type="file" multiple name="files"></label>
      <div id="nt-files" class="meta" style="margin:6px 0 0"></div>
      <p class="err" id="nt-err"></p>
      <div class="modal-foot">
        <button type="button" class="btn" data-close>إلغاء</button>
        <button class="btn primary" type="submit">إنشاء المهمة</button>
      </div>
    </form>`);
  wirePeopleSearch(ov);
  $("[data-close]", ov).onclick = closeModal;
  const fileInput = $("#nt input[name=files]");
  fileInput.onchange = () => { $("#nt-files").textContent = [...fileInput.files].map((f) => f.name).join("، "); };
  $("#nt").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const title = String(f.get("title")).trim();
    const assignees = f.getAll("assignee");
    if (!title) return $("#nt-err").textContent = "اكتب عنوان المهمة";
    if (!assignees.length) return $("#nt-err").textContent = "اختار شخص واحد على الأقل";
    const btn = e.submitter; btn.disabled = true; btn.textContent = "جاري الحفظ…";
    try {
      const { data: task, error } = await sb.from("tasks").insert({
        title,
        description: String(f.get("description")).trim() || null,
        deadline: f.get("deadline") || null,
        priority: f.get("priority"),
        created_by: state.me.id,
      }).select().single();
      if (error) throw error;
      const { error: e2 } = await sb.from("task_assignees").insert(assignees.map((u) => ({ task_id: task.id, user_id: u })));
      if (e2) throw e2;
      for (const file of fileInput.files) await uploadTaskFile(task.id, file);
      await loadTasks();
      closeModal(); route();
      toast("اتعملت المهمة");
    } catch (err) {
      $("#nt-err").textContent = err.message;
      btn.disabled = false; btn.textContent = "إنشاء المهمة";
    }
  };
}

/* ---------- Files ---------- */
async function uploadTaskFile(taskId, file) {
  if (file.size > 25 * 1048576) throw new Error(`${file.name}: الحد الأقصى 25 ميجا`);
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
  if (error) { box.innerHTML = `<p class="err">${esc(error.message)}</p>`; return; }
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
    if (e) return toast(e.message, true);
    window.open(s.signedUrl, "_blank", "noopener");
  });
  $$("[data-rm]", box).forEach((b) => b.onclick = async () => {
    const f = data.find((x) => x.id === b.dataset.rm);
    if (!confirm(`حذف "${f.file_name}"؟`)) return;
    await sb.storage.from("task-files").remove([f.storage_path]);
    const { error: e } = await sb.from("task_files").delete().eq("id", f.id);
    if (e) return toast(e.message, true);
    toast("اتحذف الملف"); renderFiles(taskId, box);
  });
}

/* ---------- Task drawer ---------- */
function openTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return toast("المهمة مش موجودة", true);
  const manage = canManageTask(t), work = canWorkOn(t);
  const creator = profile(t.created_by);
  const ov = openModal(`
    <div class="panel-top">
      <span class="pill s-${t.status}">${STATUS[t.status]}</span>
      <button class="btn ghost sm" data-close aria-label="إغلاق">إغلاق ✕</button>
    </div>
    <form id="td">
      <input class="title-input" name="title" value="${esc(t.title)}" ${manage ? "" : "disabled"} aria-label="عنوان المهمة" maxlength="200">
      <div class="meta">أنشأها ${esc(creator?.full_name || "—")} · ${fmtDateTime(t.created_at)}${t.completed_at ? ` · اكتملت ${fmtDateTime(t.completed_at)}` : ""}</div>

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
        <h3>المسؤولين عن المهمة</h3>
        <div class="assignee-list" id="as-view">${t.assignees.map((u) => profile(u)).filter(Boolean).map((p) => `<span class="tag">${avatar(p, "sm")}${esc(p.full_name)}</span>`).join("")}</div>
        ${manage ? `<button type="button" class="btn sm" id="edit-as" style="margin-top:8px">تعديل المسؤولين</button><div id="as-edit" hidden style="margin-top:8px">${peoplePicker(t.assignees)}</div>` : ""}
      </div>

      ${work ? `<p class="err" id="td-err"></p>
      <div class="modal-foot">
        ${manage ? `<button type="button" class="btn danger ghost" id="del-task">حذف المهمة</button><span class="spacer"></span>` : ""}
        <button class="btn primary" type="submit">حفظ التغييرات</button>
      </div>` : ""}
    </form>

    <div class="section">
      <h3>الملفات</h3>
      <div id="files-box"><p class="meta">جاري التحميل…</p></div>
      ${work ? `<label class="dropzone" id="drop">اسحب الملفات هنا أو اضغط للاختيار (حتى 25 ميجا)<input type="file" multiple></label>` : ""}
    </div>`, { drawer: true });

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
    const handle = async (files) => {
      drop.textContent = "جاري الرفع…";
      try { for (const f of files) await uploadTaskFile(t.id, f); toast("اترفعت الملفات"); }
      catch (e) { toast(e.message, true); }
      drop.innerHTML = `اسحب الملفات هنا أو اضغط للاختيار (حتى 25 ميجا)<input type="file" multiple>`;
      $("input", drop).onchange = (e) => handle([...e.target.files]);
      renderFiles(t.id, filesBox);
    };
    $("input", drop).onchange = (e) => handle([...e.target.files]);
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
    drop.ondragleave = () => drop.classList.remove("over");
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); handle([...e.dataTransfer.files]); };
  }

  const del = $("#del-task", ov);
  if (del) del.onclick = async () => {
    if (!confirm("حذف المهمة نهائيًا بكل ملفاتها؟")) return;
    const { data: files } = await sb.from("task_files").select("storage_path").eq("task_id", t.id);
    if (files?.length) await sb.storage.from("task-files").remove(files.map((f) => f.storage_path));
    const { error } = await sb.from("tasks").delete().eq("id", t.id);
    if (error) return toast(error.message, true);
    await loadTasks(); closeModal(); route(); toast("اتحذفت المهمة");
  };

  $("#td", ov).onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const patch = { status: f.get("status"), progress: Number(f.get("progress")) };
    if (manage) {
      patch.title = String(f.get("title")).trim();
      patch.description = String(f.get("description")).trim() || null;
      patch.deadline = f.get("deadline") || null;
      patch.priority = f.get("priority");
      if (!patch.title) return $("#td-err", ov).textContent = "العنوان مطلوب";
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
        if (add.length) { const { error: ea } = await sb.from("task_assignees").insert(add.map((u) => ({ task_id: t.id, user_id: u }))); if (ea) throw ea; }
        if (rm.length) { const { error: er } = await sb.from("task_assignees").delete().eq("task_id", t.id).in("user_id", rm); if (er) throw er; }
      }
      await loadTasks(); closeModal(); route(); toast("اتحفظت التغييرات");
    } catch (err) {
      $("#td-err", ov).textContent = err.message; btn.disabled = false;
    }
  };
}

/* =====================================================================
   Team performance
   ===================================================================== */
function statsFor(userId) {
  const mine = state.tasks.filter((t) => t.assignees.includes(userId));
  const done = mine.filter((t) => t.status === "done");
  const open = mine.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => t.deadline && daysUntil(t.deadline) < 0);
  const withDl = done.filter((t) => t.deadline);
  const onTime = withDl.filter((t) => t.completed_at && new Date(t.completed_at) <= new Date(t.deadline + "T23:59:59"));
  const avg = open.length ? Math.round(open.reduce((s, t) => s + t.progress, 0) / open.length) : null;
  return {
    total: mine.length, done: done.length, open: open.length, overdue: overdue.length, avg,
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
      <div><b class="num">${tot.open}</b><span>مهام مفتوحة</span></div>
      <div class="${tot.overdue ? "bad" : ""}"><b class="num">${tot.overdue}</b><span>متأخرة</span></div>
      <div class="${tot.blocked ? "bad" : ""}"><b class="num">${tot.blocked}</b><span>متوقفة</span></div>
      <div><b class="num">${tot.done}</b><span>مكتملة</span></div>
    </div>
    ${rows.length ? `<div class="table-wrap"><table class="t">
      <thead><tr><th>الموظف</th><th>المدير المباشر</th><th>مفتوحة</th><th>متأخرة</th><th>مكتملة</th><th style="width:170px">متوسط الإنجاز (المفتوحة)</th><th>الالتزام بالمواعيد</th></tr></thead>
      <tbody>${rows.map(({ p, s }) => `
        <tr class="click ${p.active ? "" : "inactive"}" data-user="${p.id}" tabindex="0">
          <td><div class="person">${avatar(p)}<div><b>${esc(p.full_name)}</b><small>${esc(p.job_title || "")}</small></div></div></td>
          <td>${esc(profile(p.manager_id)?.full_name || "—")}</td>
          <td class="num">${s.open}</td>
          <td class="num ${s.overdue ? "bad" : ""}">${s.overdue}</td>
          <td class="num">${s.done}</td>
          <td>${s.avg === null ? `<span class="meta">—</span>` : `<span class="progress"><span class="bar"><i style="width:${s.avg}%"></i></span><span class="num">${s.avg}%</span></span>`}</td>
          <td class="num">${s.onTimeRate === null ? "—" : s.onTimeRate + "%"}</td>
        </tr>`).join("")}</tbody></table></div>`
      : `<div class="list"><div class="empty"><b>مفيش موظفين تحت إدارتك لسه</b>أضف موظفين من صفحة الموظفين.</div></div>`}`;

  $("#direct").onchange = (e) => { state.teamDirectOnly = e.target.checked; renderTeam(); };
  $$("tr[data-user]").forEach((tr) => {
    const go = () => { state.view.status = "all"; location.hash = `#/tasks?user=${tr.dataset.user}`; };
    tr.onclick = go;
    tr.onkeydown = (e) => { if (e.key === "Enter") go(); };
  });
}

/* =====================================================================
   Org chart
   ===================================================================== */
function renderOrg() {
  const roots = state.profiles.filter((p) => !p.manager_id || !profile(p.manager_id));
  const node = (p, depth = 0) => {
    const kids = state.children.get(p.id) || [];
    if (depth > 30) return "";
    return `<li><span class="node ${p.id === state.me.id ? "me" : ""} ${p.active ? "" : "inactive"}">${avatar(p, "sm")}<span><b>${esc(p.full_name)}</b><small>${esc(p.job_title || "")}</small></span></span>
      ${kids.length ? `<ul>${kids.map((k) => node(k, depth + 1)).join("")}</ul>` : ""}</li>`;
  };
  $("#view").innerHTML = `
    <div class="page-head"><div><h1>الهيكل التنظيمي</h1><p>${state.profiles.length} موظف</p></div></div>
    <div class="org"><ul>${roots.map((r) => node(r)).join("")}</ul></div>`;
}

/* =====================================================================
   Users (managers / admin)
   ===================================================================== */
function renderUsers() {
  const list = manageable();
  $("#view").innerHTML = `
    <div class="page-head">
      <div><h1>الموظفين</h1><p>${state.me.is_admin ? "إدارة كل حسابات الفريق" : "الموظفين تحت إدارتك"}</p></div>
      <button class="btn primary" id="add-user">+ إضافة موظف</button>
    </div>
    ${list.length ? `<div class="table-wrap"><table class="t">
      <thead><tr><th>الموظف</th><th>اسم المستخدم</th><th>المدير المباشر</th><th>الحالة</th><th></th></tr></thead>
      <tbody>${list.map((p) => `
        <tr class="${p.active ? "" : "inactive"}">
          <td><div class="person">${avatar(p)}<div><b>${esc(p.full_name)}${p.is_admin ? ` <span class="pill s-review">أدمن</span>` : ""}</b><small>${esc(p.job_title || "")}</small></div></div></td>
          <td dir="ltr" style="text-align:start">${esc(p.username)}</td>
          <td>${esc(profile(p.manager_id)?.full_name || "—")}</td>
          <td>${p.active ? `<span class="pill s-done">نشط</span>` : `<span class="pill s-blocked">موقوف</span>`}</td>
          <td><button class="btn sm" data-edit="${p.id}">تعديل</button></td>
        </tr>`).join("")}</tbody></table></div>`
      : `<div class="list"><div class="empty"><b>مفيش موظفين لسه</b>اضغط "إضافة موظف" وابدأ تبني فريقك.</div></div>`}`;
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
        <span id="uf-av">${user ? avatar(user, "lg") : `<span class="av lg" style="background:var(--line);color:var(--ink-3)">+</span>`}</span>
        <button type="button" class="btn sm" id="uf-photo">${user?.avatar_url ? "تغيير الصورة" : "إضافة صورة"}</button>
      </div>
      <label class="field"><span>الاسم بالكامل</span><input class="input" name="full_name" value="${esc(user?.full_name || "")}" required></label>
      <label class="field"><span>المسمى الوظيفي</span><input class="input" name="job_title" value="${esc(user?.job_title || "")}"></label>
      <label class="field"><span>المدير المباشر</span><select class="input" name="manager_id">${managerOptions(user)}</select></label>
      ${isNew ? `
      <div class="row2">
        <label class="field"><span>اسم المستخدم</span><input class="input" name="username" dir="ltr" autocapitalize="none" autocomplete="off" pattern="[a-z0-9._\\-]{3,30}" placeholder="ahmed.ali" required></label>
        <label class="field"><span>كلمة السر</span><input class="input" name="password" dir="ltr" autocomplete="new-password" minlength="8" placeholder="8 حروف على الأقل" required></label>
      </div>` : `<p class="meta">اسم المستخدم: <b dir="ltr">${esc(user.username)}</b></p>`}
      ${state.me.is_admin && (!user || user.id !== state.me.id) ? `<label class="check"><input type="checkbox" name="is_admin" ${user?.is_admin ? "checked" : ""}> صلاحية أدمن (يدير كل الموظفين ويشوف كل المهام)</label>` : ""}
      <p class="err" id="uf-err"></p>
      <div class="modal-foot">
        ${!isNew && user.id !== state.me.id ? `
          <button type="button" class="btn sm" id="uf-pass">تغيير كلمة السر</button>
          <button type="button" class="btn sm" id="uf-active">${user.active ? "إيقاف الحساب" : "تفعيل الحساب"}</button>
          <button type="button" class="btn sm danger ghost" id="uf-del">حذف</button>
          <span class="spacer"></span>` : ""}
        <button type="button" class="btn" data-close>إلغاء</button>
        <button class="btn primary" type="submit">${isNew ? "إنشاء الحساب" : "حفظ"}</button>
      </div>
    </form>`);
  $("[data-close]", ov).onclick = closeModal;
  $("#uf-photo", ov).onclick = () => pickFile("image/*", (file) => {
    photo = file;
    $("#uf-av", ov).innerHTML = `<img class="av lg" src="${URL.createObjectURL(file)}" alt="">`;
  });
  const err = (m) => $("#uf-err", ov).textContent = m;

  $("#uf", ov).onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const full_name = String(f.get("full_name")).trim();
    const job_title = String(f.get("job_title")).trim() || null;
    const manager_id = f.get("manager_id") || null;
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
      } else {
        const { error } = await sb.from("profiles").update({ full_name, job_title, manager_id }).eq("id", id);
        if (error) throw error;
      }
      if (state.me.is_admin && f.has("is_admin") !== !!user?.is_admin && (!user || user.id !== state.me.id)) {
        const { error } = await sb.from("profiles").update({ is_admin: f.has("is_admin") }).eq("id", id);
        if (error) throw error;
      }
      if (photo) await uploadAvatar(id, photo);
      await loadProfiles(); closeModal(); route();
      toast(isNew ? "اتعمل الحساب — ابعت للموظف اسم المستخدم وكلمة السر" : "اتحفظت البيانات");
    } catch (ex) { err(ex.message); btn.disabled = false; }
  };

  if (!isNew && user.id !== state.me.id) {
    $("#uf-pass", ov).onclick = () => openPasswordModal(user);
    $("#uf-active", ov).onclick = async () => {
      if (!confirm(user.active ? `إيقاف حساب ${user.full_name}؟ مش هيقدر يدخل السستم.` : `تفعيل حساب ${user.full_name}؟`)) return;
      try { await adminCall({ action: "set_active", user_id: user.id, active: !user.active }); await loadProfiles(); closeModal(); route(); toast("اتحدثت حالة الحساب"); }
      catch (ex) { err(ex.message); }
    };
    $("#uf-del", ov).onclick = async () => {
      if (!confirm(`حذف ${user.full_name} نهائيًا؟ الموظفين اللي تحته هيتنقلوا لمديره.`)) return;
      try { await adminCall({ action: "delete", user_id: user.id }); await loadProfiles(); await loadTasks(); closeModal(); route(); toast("اتحذف الموظف"); }
      catch (ex) { err(ex.message); }
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
      <div class="modal-foot"><button type="button" class="btn" data-close>إلغاء</button><button class="btn primary" type="submit">حفظ كلمة السر</button></div>
    </form>`);
  $("[data-close]", ov).onclick = closeModal;
  $("#pf", ov).onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const p1 = String(f.get("p1")), p2 = String(f.get("p2"));
    if (p1.length < 8) return $("#pf-err").textContent = "8 حروف على الأقل";
    if (p1 !== p2) return $("#pf-err").textContent = "كلمتين السر مش متطابقين";
    try {
      if (self) { const { error } = await sb.auth.updateUser({ password: p1 }); if (error) throw error; }
      else await adminCall({ action: "set_password", user_id: user.id, password: p1 });
      closeModal(); toast("اتغيرت كلمة السر");
    } catch (ex) { $("#pf-err").textContent = ex.message; }
  };
}

init();
