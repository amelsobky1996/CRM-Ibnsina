import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, EMAIL_DOMAIN, VAPID_PUBLIC } from "./config.js";
import { tx, LANG, THEME, LOCALE, startTranslator, applyPrefs, setLang, setTheme } from "./i18n.js";

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
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>',
  restore: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6"/><path d="M4 4v4.6h4.6"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  dots: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  chev: '<path d="M15 6l-6 6 6 6"/>',
  tasks: '<path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>',
  projects: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  team: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  org: '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-2h12v2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.4-5.7L20 8.6"/><path d="M20 4v4.6h-4.6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  minimize: '<path fill="currentColor" stroke="none" d="M10.804,12.398c-.007,0-.014-.002-.021-.003-.644-.095-3.979-.462-7.259,1.539-.384,.234-.564,.697-.44,1.13,.022,.076,.462,1.578,1.452,2.915l-3.235,3.171c-.394,.387-.409,1.029-.014,1.415,.508,.497,1.169,.285,1.415,.014l3.253-3.188c1.445,1.051,3.04,1.47,3.273,1.466,.34-.005,.665-.174,.85-.473,2.142-3.453,1.589-7.01,1.564-7.16-.07-.428-.408-.761-.836-.827Z"/><path fill="currentColor" stroke="none" d="M13.196,11.602c.007,0,.014,.002,.021,.003,.644,.095,3.979,.462,7.259-1.539,.384-.234,.564-.697,.44-1.13-.022-.076-.462-1.578-1.452-2.915l3.235-3.171c.394-.387,.409-1.029,.014-1.415-.508-.497-1.169-.285-1.415-.014l-3.253,3.188c-1.445-1.051-3.04-1.47-3.273-1.466-.34,.005-.665,.174-.85,.473-2.142,3.453-1.589,7.01-1.564,7.16,.07,.428,.408,.761,.836,.827Z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  play: '<path fill="currentColor" stroke="none" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
  sort: '<path d="M7 4v16M4 7l3-3 3 3M14 6h7M14 12h5M14 18h3"/>',
  grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
  filter: '<path d="M4 5h16l-6 7.5V19l-4 1.5v-8z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
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
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3A4.7 4.7 0 0 0 21 9.7C21 5.9 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="14.5" cy="7" r="1.2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  checklist: '<path d="M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17"/><path d="M11 6h9M11 12h9M11 18h9"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  board: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/>',
  rows: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  report: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 17v-3M12 17v-6M16 17v-2"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  printer: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  zoomIn: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M8 11h6M11 8v6"/>',
  zoomOut: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M8 11h6"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  collapse: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
};
const icon = (name, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;

const fmtDate = (d) => d ? new Date(d.length === 10 ? d + "T00:00:00" : d)
  .toLocaleDateString(LOCALE(), { day: "numeric", month: "short", year: "numeric" }) : "";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString(LOCALE(),
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
// Default illustrated avatars, used until the person uploads a photo.
const DEFAULT_AVATAR = {
  male: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" fill="#DCEBFA"/>
    <path d="M8 66c2-14 12-21 24-21s22 7 24 21z" fill="#2F6FB5"/>
    <path d="M27 38h10v9a5 5 0 0 1-10 0z" fill="#E6B48F"/>
    <circle cx="32" cy="28" r="12" fill="#F1C7A3"/>
    <path d="M20 28c-1-10 5-16 12.5-16S45 17 44 27c-3-5-8-7-12-7s-9 2-12 8z" fill="#3A2A22"/>
    <path d="M26 45l6 6 6-6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round" opacity=".85"/>
  </svg>`,
  female: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" fill="#FBE3EF"/>
    <path d="M18 33c-1-14 5-21 14-21s15 7 14 21c0 8 2 13 5 17H13c3-4 5-9 5-17z" fill="#4A2C24"/>
    <path d="M8 66c2-14 12-21 24-21s22 7 24 21z" fill="#C2408A"/>
    <path d="M27 38h10v9a5 5 0 0 1-10 0z" fill="#E6B48F"/>
    <circle cx="32" cy="28" r="11.5" fill="#F3CDAE"/>
    <path d="M20.5 29c0-9 5-14.5 11.5-14.5S43.5 20 43.5 29c-5-1-9.5-4-11.5-8-2 4-6.5 7-11.5 8z" fill="#4A2C24"/>
    <circle cx="32" cy="49" r="1.8" fill="#fff" opacity=".85"/>
  </svg>`,
};

function avatar(p, cls = "") {
  if (!p) return `<span class="av ${cls}">?</span>`;
  // data-pid powers the hover card; no title= so the browser tooltip doesn't fight it
  const id = `data-pid="${esc(p.id)}"`;
  if (p.avatar_url) return `<img class="av ${cls}" ${id} src="${esc(p.avatar_url)}" alt="${esc(p.full_name)}" loading="lazy">`;
  if (DEFAULT_AVATAR[p.gender]) return `<span class="av av-default ${cls}" ${id} role="img" aria-label="${esc(p.full_name)}">${DEFAULT_AVATAR[p.gender]}</span>`;
  const initials = p.full_name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  let h = 0; for (const c of p.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `<span class="av ${cls}" ${id} role="img" aria-label="${esc(p.full_name)}" style="background:${AV_COLORS[h % AV_COLORS.length]}">${esc(initials)}</span>`;
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
  view: { tab: null, status: "all", q: "", user: null, project: "" },
  teamDirectOnly: false,
  notifs: [],
  msgs: [],
  wu: { week: null, project: null, tab: null, rows: null, loadedWeek: null, drafts: {}, fileProjects: null },
  groups: [],
  gmsgs: [],
  statuses: [],
  att: { takers: new Set(), days: [], points: new Map(), sessions: [], rows: [], awards: [], loaded: false, tab: null, day: null, draft: null, draftDay: null },
  chatDrafts: {},
  chatQ: "",
  scores: {},
  homePeriod: 30,
  reportWeek: 0,
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
// must mirror the "projects delete" RLS policy
const canDeleteProject = (p) => state.me.is_admin || p.created_by === state.me.id || (p.created_by && isAncestor(state.me.id, p.created_by));

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
  const all = data.map((t) => ({ ...t, assignees: (t.task_assignees || []).map((a) => a.user_id), mentions: t.mentions || [] }));
  // archived / deleted tasks (DB v22) live in their own list and stay out of every other view
  state.archiveReady = data.length ? "archived_at" in data[0] : state.archiveReady ?? false;
  state.tasks = all.filter((t) => !t.archived_at);
  state.archived = all.filter((t) => t.archived_at).sort((a, b) => b.archived_at.localeCompare(a.archived_at));
  await loadDelReqs();
  // tasks.mentions ships with DB migration v20; until then the description doesn't take @mentions
  if (data.length) state.descMentions = "mentions" in data[0];
  else if (state.descMentions == null) state.descMentions = !(await sb.from("tasks").select("mentions").limit(1)).error;
  await loadLinks();
}
async function loadDelReqs() {
  const { data, error } = await sb.from("task_delete_requests").select("*").eq("status", "pending");
  state.delReqs = error ? [] : data || [];
  if (!error) state.archiveReady = true;
}
// the archive lists only tasks I'm part of (admins: all); everyone can still open any task read-only
const myArchived = () => (state.archived || []).filter((t) => state.me.is_admin || canWorkOn(t) || (t.mentions || []).includes(state.me.id));
const delReqOf = (t) => (state.delReqs || []).find((r) => r.task_id === t.id);
const findTask = (id) => state.tasks.find((x) => x.id === id) || (state.archived || []).find((x) => x.id === id);
// people @mentioned in a task description (matched on "@Full Name")
function mentionIdsIn(text) {
  if (!text || !text.includes("@")) return [];
  return state.profiles.filter((p) => p.full_name && text.includes("@" + p.full_name)).map((p) => p.id);
}
const isMentioned = (t, uid = state.me.id) => (t.mentions || []).includes(uid) && !t.assignees.includes(uid);

async function loadStatuses() {
  const { data, error } = await sb.from("task_statuses").select("*").order("position");
  if (error) throw error;
  state.statuses = data || [];
}
// board columns of a project, in order
const projCols = (pid) => state.statuses.filter((c) => c.project_id === pid).sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
const colById = (id) => state.statuses.find((c) => c.id === id);
// the column a task sits in (falls back to the first column of its kind)
function taskCol(t) {
  if (!t.project_id) return null;
  const c = colById(t.status_id);
  if (c && c.project_id === t.project_id) return c;
  const cols = projCols(t.project_id);
  return cols.find((x) => x.kind === t.status) || null;
}
const statusPill = (t) => {
  const c = taskCol(t);
  return c ? `<span class="pill s-col" style="--sc:${esc(c.color)}">${esc(c.name)}</span>` : `<span class="pill s-${t.status}">${STATUS[t.status]}</span>`;
};

async function loadProjects() {
  // the admin's order (projects.position) is the order everywhere
  const { data, error } = await sb.from("projects").select("*").order("position", { ascending: true }).order("created_at", { ascending: false });
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

// Crop dialog for profile photos: drag to move, zoom (slider / wheel / pinch), rotate. Resolves a square JPEG Blob or null.
function cropImage(file) {
  return new Promise(async (resolve) => {
    let img;
    try { img = await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch { try { img = await createImageBitmap(file); } catch { toast(tx("الصورة دي مش مدعومة، جرّب صورة JPG أو PNG"), true); return resolve(null); } }
    const root = document.createElement("div");
    root.className = "overlay confirm-layer";
    root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", tx("ظبط الصورة"));
    root.innerHTML = `<div class="modal confirm crop-modal">
        <h2>${tx("ظبط الصورة")}</h2>
        <p class="crop-hint">${tx("اسحب الصورة عشان تحركها، وكبّر أو صغّر لحد ما وشك يبقى في نص الدايرة")}</p>
        <div class="crop-stage" tabindex="0" aria-label="${tx("اسحب الصورة عشان تحركها")}"><canvas></canvas><div class="crop-ring" aria-hidden="true"></div></div>
        <div class="crop-tools">
          <button type="button" class="icon-btn" data-z="-" aria-label="${tx("تصغير")}">${icon("minus", "sm")}</button>
          <input type="range" min="1" max="4" step="0.01" value="1" aria-label="${tx("تكبير")}">
          <button type="button" class="icon-btn" data-z="+" aria-label="${tx("تكبير")}">${icon("plus", "sm")}</button>
          <button type="button" class="icon-btn" data-rot aria-label="${tx("لف الصورة")}" title="${tx("لف الصورة")}">${icon("rotate", "sm")}</button>
        </div>
        <div class="modal-foot"><button type="button" class="btn ghost" data-no>${tx("إلغاء")}</button><button type="button" class="btn primary" data-yes>${icon("check", "sm")}<span>${tx("حفظ الصورة")}</span></button></div>
      </div>`;
    document.body.append(root);
    const stage = $(".crop-stage", root), cv = $("canvas", stage), ctx = cv.getContext("2d"), zr = $("input[type=range]", root);
    let V = 0, dpr = 1, z = 1, rot = 0, ox = 0, oy = 0;
    const dims = () => (rot % 180 ? [img.height, img.width] : [img.width, img.height]);
    const base = () => { const [w, h] = dims(); return V / Math.min(w, h); };
    const clamp = () => {
      const [w, h] = dims(), k = base() * z;
      const mx = Math.max(0, (w * k - V) / 2), my = Math.max(0, (h * k - V) / 2);
      ox = Math.min(mx, Math.max(-mx, ox)); oy = Math.min(my, Math.max(-my, oy));
    };
    const paint = (c, size, scale) => {
      c.save(); c.fillStyle = "#fff"; c.fillRect(0, 0, size, size);
      c.translate(size / 2 + ox * scale, size / 2 + oy * scale); c.rotate(rot * Math.PI / 180);
      const k = base() * z * scale; c.scale(k, k);
      c.imageSmoothingQuality = "high";
      c.drawImage(img, -img.width / 2, -img.height / 2); c.restore();
    };
    const draw = () => { clamp(); paint(ctx, cv.width, dpr); };
    const fit = () => {
      V = stage.clientWidth; dpr = Math.min(3, devicePixelRatio || 1);
      cv.width = cv.height = Math.round(V * dpr); draw();
    };
    const setZoom = (nz, cx = 0, cy = 0) => {
      nz = Math.min(4, Math.max(1, nz));
      // keep the point under the cursor / fingers still
      ox = cx - (cx - ox) * nz / z; oy = cy - (cy - oy) * nz / z;
      z = nz; zr.value = z; draw();
    };
    requestAnimationFrame(fit);
    const onResize = () => fit(); addEventListener("resize", onResize);
    const pts = new Map(); let pinch = null;
    const local = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left - V / 2, e.clientY - r.top - V / 2]; };
    stage.addEventListener("pointerdown", (e) => { stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); stage.classList.add("grab"); });
    stage.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1) { ox += e.clientX - prev[0]; oy += e.clientY - prev[1]; draw(); return; }
      const [a, b] = [...pts.values()], dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const r = stage.getBoundingClientRect(), cx = (a[0] + b[0]) / 2 - r.left - V / 2, cy = (a[1] + b[1]) / 2 - r.top - V / 2;
      if (pinch) setZoom(pinch.z * dist / pinch.d, cx, cy); else pinch = { d: dist, z };
    });
    const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) stage.classList.remove("grab"); };
    stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
    stage.addEventListener("wheel", (e) => { e.preventDefault(); const [cx, cy] = local(e); setZoom(z * Math.exp(-e.deltaY * 0.0015), cx, cy); }, { passive: false });
    stage.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 30 : 8, m = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
      if (m) { e.preventDefault(); ox += m[0]; oy += m[1]; draw(); }
      else if (e.key === "+" || e.key === "=") setZoom(z + 0.1); else if (e.key === "-") setZoom(z - 0.1);
    });
    zr.oninput = () => setZoom(Number(zr.value));
    $$("[data-z]", root).forEach((b) => b.onclick = () => setZoom(z + (b.dataset.z === "+" ? 0.25 : -0.25)));
    $("[data-rot]", root).onclick = () => { rot = (rot + 90) % 360; [ox, oy] = [-oy, ox]; draw(); };
    const done = (v) => {
      removeEventListener("resize", onResize); document.removeEventListener("keydown", onKey, true);
      root.classList.add("closing"); setTimeout(() => root.remove(), reduceMotion ? 0 : 180);
      img.close?.(); resolve(v);
    };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); done(null); } else if (e.key === "Enter" && e.target.tagName !== "BUTTON") { e.preventDefault(); $("[data-yes]", root).click(); } };
    document.addEventListener("keydown", onKey, true);
    root.addEventListener("mousedown", (e) => { if (e.target === root) done(null); });
    $("[data-no]", root).onclick = () => done(null);
    $("[data-yes]", root).onclick = () => {
      const OUT = 480, oc = document.createElement("canvas"); oc.width = oc.height = OUT;
      paint(oc.getContext("2d"), OUT, OUT / V);
      oc.toBlob((b) => done(b), "image/jpeg", 0.9);
    };
    setTimeout(() => stage.focus(), 80);
  });
}
// pick a photo, then crop it; calls back with the cropped Blob
const pickPhoto = (cb) => pickFile("image/*", async (file) => { const b = await cropImage(file); if (b) cb(b); });

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
  if (/exceeded the maximum allowed size|Payload too large/i.test(m)) return tx("الملف أكبر من {mb} ميجا", { mb: MAX_FILE_MB });
  return m;
};

/* =====================================================================
   Boot / Auth
   ===================================================================== */
// Splash: ~4s of animation then ~2s holding the final frame (6s from page load (or until the app is ready, whichever is later)
const SPLASH_MS = reduceMotion ? 2500 : 6000;
let splashReady = false;
function dismissSplash() {
  const el = document.getElementById("splash");
  if (!el || el.classList.contains("sp-out")) return;
  const wait = Math.max(0, SPLASH_MS - performance.now());
  setTimeout(() => { el.classList.add("sp-out"); setTimeout(() => el.remove(), 600); }, wait);
}
function splashDone() { if (!splashReady) { splashReady = true; dismissSplash(); } }

async function init() {
  applyPrefs();
  startTranslator();
  setTimeout(splashDone, 12000); // safety net if the network is slow
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
    syncPrefsFromProfile();
    await Promise.all([loadTasks(), loadProjects(), loadStatuses(), loadNotifs(), loadMessages(), loadAttMeta(), loadGroups().catch((e) => console.error(e))]);
    renderShell();
    subscribe();
    syncPush();
  } catch (e) {
    console.error(e);
    renderLogin(friendly(e));
  }
}

let channel, reloadTimer;
// Realtime is split into independent channels so one failing feed can never silence the others
// (e.g. chat). Every channel reconnects by itself, and the app catches up whenever it comes back
// to the foreground or the network returns.
let chans = [], rtRetry = {}, rtWanted = false;
function rtChannel(name, bind) {
  const make = () => {
    const ch = sb.channel(`${name}-${state.me.id}-${Date.now()}`);
    bind(ch);
    ch._dttName = name;
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") { rtRetry[name] = 0; return; }
      if (!rtWanted || !["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) return;
      if (status === "CLOSED" && !chans.includes(ch)) return; // we closed it on purpose
      const n = (rtRetry[name] = (rtRetry[name] || 0) + 1);
      setTimeout(() => {
        if (!rtWanted || !chans.includes(ch)) return;
        chans = chans.filter((c) => c !== ch);
        sb.removeChannel(ch);
        chans.push(make());
      }, Math.min(30000, 1000 * 2 ** Math.min(n, 5)));
    });
    return ch;
  };
  chans.push(make());
}
function unsubscribeAll() {
  rtWanted = false;
  const old = chans; chans = [];
  old.forEach((c) => sb.removeChannel(c));
  channel = null;
}
// re-sync after the app was in the background / offline (sockets often die there on phones)
async function catchUp() {
  if (!state.me) return;
  const dead = chans.filter((c) => c.state !== "joined");
  if (dead.length) {
    chans = chans.filter((c) => c.state === "joined");
    dead.forEach((c) => sb.removeChannel(c));
    const names = new Set(dead.map((c) => c._dttName));
    RT_FEEDS.filter(([n]) => names.has(n)).forEach(([n, bind]) => rtChannel(n, bind));
  }
  try {
    coreReload();
    await Promise.all([loadMessages(), loadNotifs(), loadGroups().catch((e) => console.error(e))]);
    renderBell(); renderChatBadges();
    const r = currentRoute();
    if (r.page === "chat") {
      fillConvs(r.params.get("with"), r.params.get("group"));
      if (r.params.get("with")) { fillThread(r.params.get("with")); markThreadRead(r.params.get("with")); }
      if (r.params.get("group") && groupById(r.params.get("group"))) { fillGroupThread(r.params.get("group")); markGroupRead(r.params.get("group")); }
    }
  } catch (e) { console.error(e); }
}
let RT_FEEDS = [];
document.addEventListener("visibilitychange", () => { if (!document.hidden) catchUp(); });
addEventListener("online", () => catchUp());
addEventListener("focus", () => { if (chans.some((c) => c.state !== "joined")) catchUp(); });
// Reload tasks/projects/people and repaint. Never dropped: with a form or task drawer open the
// data still refreshes, and the page repaints as soon as that window closes.
let coreRepaintPending = false;
const coreDataSig = () => JSON.stringify([
  state.tasks.map((t) => [t.id, t.updated_at, t.assignees.join(","), (state.links || []).length]),
  (state.archived || []).map((t) => [t.id, t.updated_at]),
  (state.delReqs || []).map((r) => r.id),
  state.projects.map((p) => [p.id, p.updated_at || p.name, p.status, p.lead_id, p.position]),
  state.statuses.map((c) => [c.id, c.name, c.color, c.position]),
  state.profiles.map((p) => [p.id, p.updated_at || p.full_name, p.avatar_url]),
]);
function coreReload(force = false) {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async () => {
    if (!state.me) return;
    const before = coreDataSig();
    try { await Promise.all([loadProfiles(), loadTasks(), loadProjects(), loadStatuses()]); }
    catch (e) { console.error(e); return; }
    tasksSig = null;
    if (coreDataSig() === before && !force) return; // nothing changed: don't disturb the page
    if (currentRoute().page === "chat") { renderNav(); return; }
    if ($("#modal-root").innerHTML) { coreRepaintPending = true; renderNav(); return; }
    state.animate = false; route();
  }, 400);
}
function flushCoreRepaint() {
  if (!coreRepaintPending || $("#modal-root").innerHTML || !state.me) return;
  coreRepaintPending = false;
  if (currentRoute().page !== "chat") { state.animate = false; route(); }
}
// Safety net for missed realtime events (phone asleep, flaky network, RLS-filtered inserts):
// a tiny "what changed" probe on the tasks I can see; reload only when it differs.
let tasksSig = null;
async function probeTasks() {
  if (!state.me || document.hidden) return;
  const { data, count, error } = await sb.from("tasks").select("id, updated_at", { count: "exact" }).order("updated_at", { ascending: false }).limit(1);
  if (error) return;
  const { count: ac } = await sb.from("task_assignees").select("task_id", { count: "exact", head: true });
  const sig = `${count}|${data?.[0]?.updated_at || ""}|${ac ?? ""}`;
  if (tasksSig !== null && sig !== tasksSig) coreReload();
  tasksSig = sig;
}
setInterval(probeTasks, 20000);

// safety net: if the chat feed is down, poll for new messages
setInterval(() => {
  if (!state.me || document.hidden) return;
  const chat = chans.find((c) => c._dttName === "chat");
  if (!chat || chat.state !== "joined") catchUp();
}, 15000);

function subscribe() {
  unsubscribeAll();
  rtWanted = true;
  const reload = () => coreReload();
  const attRefresh = async () => {
    try {
      await loadAttMeta();
      if (state.att.loaded) await loadAttData();
      const pg = currentRoute().page;
      if ((pg === "home" || (pg === "attendance" && state.att.tab !== "take")) && !$("#modal-root").innerHTML) { state.animate = false; route(); }
    } catch (e) { console.error(e); }
  };
  const attReload = () => debounced(attRefresh, 600);
  const me = state.me.id;
  RT_FEEDS = [
    ["chat", (ch) => {
      for (const col of ["recipient_id", "sender_id"])
        ch.on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `${col}=eq.${me}` }, (pl) => onMessageRealtime(pl.eventType, pl.new));
    }],
    ["groups", (ch) => {
      for (const table of ["group_messages", "chat_group_members", "chat_groups"])
        ch.on("postgres_changes", { event: "*", schema: "public", table }, (pl) => onGroupRealtime(table, pl.eventType, pl.new, pl.old));
    }],
    ["notifs", (ch) => {
      ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${me}` }, async (payload) => {
        if (["assigned", "completed", "comment", "mention", "delete_request", "delete_decision"].includes(payload.new?.type)) coreReload();
        await loadNotifs();
        renderBell(true);
        const n = payload.new && state.notifs.find((x) => x.id === payload.new.id);
        if (n) { const tmp = document.createElement("div"); tmp.innerHTML = notifText(n); toast(tmp.textContent); }
      });
      ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${me}` }, async () => { await loadNotifs(); renderBell(); });
    }],
    ["core", (ch) => {
      for (const table of ["tasks", "task_assignees", "task_links", "profiles", "projects", "task_statuses", "task_delete_requests"])
        ch.on("postgres_changes", { event: "*", schema: "public", table }, reload);
    }],
    ["att", (ch) => {
      for (const table of ["attendance_sessions", "points_awards", "attendance_takers", "standup_settings"])
        ch.on("postgres_changes", { event: "*", schema: "public", table }, attReload);
    }],
    ["weekly", (ch) => {
      ch.on("postgres_changes", { event: "*", schema: "public", table: "weekly_updates" }, () => debounced(weeklyRefresh, 600));
      ch.on("postgres_changes", { event: "*", schema: "public", table: "report_periods" }, () => debounced(periodsRefresh, 400));
    }],
  ];
  RT_FEEDS.forEach(([n, bind]) => rtChannel(n, bind));
  channel = chans[0];
}

function renderSetup() {
  splashDone();
  $("#root").innerHTML = `
    <div class="setup">
      <h2>محتاج إعداد Supabase</h2>
      <p>افتح <code>js/config.js</code> وحط <code>SUPABASE_URL</code> و <code>SUPABASE_ANON_KEY</code> بتوع مشروعك، وبعدها اعمل refresh.</p>
    </div>`;
}

function renderLogin(message = "") {
  splashDone();
  unsubscribeAll();
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
        <button type="button" class="lang-switch" id="lang-switch">${icon("globe", "sm")}<span>${LANG === "en" ? "العربية" : "English"}</span></button>
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
  $("#lang-switch").onclick = () => { setLang(LANG === "en" ? "ar" : "en"); renderLogin(); };
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
/* ---------- Messenger-style chat heads above the floating button ---------- */
const chatHeads = []; // newest first: { key, kind, id, count, text }
let peekTimer = 0;
function chatHeadPush(kind, id, text, from, quiet = false) {
  const key = kind + ":" + id;
  let h = chatHeads.find((x) => x.key === key);
  const isNew = !h;
  if (h) { if (!quiet) { h.count++; h.text = text; } chatHeads.splice(chatHeads.indexOf(h), 1); }
  else h = { key, kind, id, count: quiet ? 0 : 1, text };
  h.from = from;
  chatHeads.unshift(h);
  while (chatHeads.length > 4) chatHeads.pop();
  if (!quiet) navigator.vibrate?.(25);
  renderChatHeads(key, isNew, quiet);
}
// chat page → back to where you were, with this conversation waiting as a bubble
function wireMinimize(pane) {
  const b = $(".thread-min", pane); if (!b) return;
  b.onclick = () => {
    const [kind, id] = b.dataset.min.split(":");
    const last = kind === "g" ? groupMsgs(id).filter((m) => !m.deleted_at).slice(-1)[0] : visibleMsgs().filter((m) => partnerOf(m) === id && !m.deleted_at).slice(-1)[0];
    const text = last ? (kind === "g" ? `${profile(last.sender_id)?.full_name?.split(" ")[0] || ""}: ` : "") + msgPreviewText(last) : "";
    const back = state.lastNonChat && !state.lastNonChat.startsWith("#/chat") ? state.lastNonChat : "#/home";
    location.hash = back;
    setTimeout(() => chatHeadPush(kind, id, text, null, true), 60);
  };
}
function chatHeadRemove(key, animate = true) {
  const i = chatHeads.findIndex((x) => x.key === key);
  if (i < 0) return;
  chatHeads.splice(i, 1);
  const el = $(`#chat-heads [data-key="${CSS.escape(key)}"]`);
  if (el && animate && !reduceMotion) { el.classList.add("leaving"); setTimeout(() => el.remove(), 260); }
  else el?.remove();
}
function chatHeadHtml(h) {
  const g = h.kind === "g" ? groupById(h.id) : null, p = h.kind === "u" ? profile(h.id) : null;
  const name = g ? g.name : p?.full_name || tx("رسالة جديدة");
  return `<div class="ch-head" data-key="${esc(h.key)}" role="button" tabindex="0" aria-label="${esc(tx("رسالة من {name}", { name }))}">
      <span class="ch-av">${g ? groupAvatar(g) : avatar(p, "lg")}</span>
      <span class="ch-badge" ${h.count > 1 ? "" : "hidden"}>${h.count > 99 ? "99+" : h.count}</span>
      <button type="button" class="ch-x" aria-label="${tx("إغلاق")}">${icon("close", "sm")}</button>
      <span class="ch-peek"><b>${esc(name)}</b><span dir="auto">${esc(h.text.length > 90 ? h.text.slice(0, 90) + "…" : h.text)}</span></span>
    </div>`;
}
function renderChatHeads(changedKey, isNew, quiet = false) {
  const box = $("#chat-heads"); if (!box) return;
  // keep existing nodes (their animations), add/update/reorder
  for (const h of chatHeads) {
    let el = $(`[data-key="${CSS.escape(h.key)}"]`, box);
    if (!el) {
      const t = document.createElement("template"); t.innerHTML = chatHeadHtml(h).trim(); el = t.content.firstChild;
      wireChatHead(el, h.key);
      if (h.key === changedKey && isNew) el.classList.add("entering");
    } else if (h.key === changedKey) {
      $(".ch-peek span", el).textContent = h.text.length > 90 ? h.text.slice(0, 90) + "…" : h.text;
      const b = $(".ch-badge", el); b.hidden = h.count < 2; b.textContent = h.count > 99 ? "99+" : h.count;
      el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
    }
    box.append(el); // order: newest last in DOM = closest to the button
  }
  $$(".ch-head", box).forEach((el) => { if (!chatHeads.some((h) => h.key === el.dataset.key)) el.remove(); });
  [...box.children].reverse().forEach((el, i) => el.style.setProperty("--i", i));
  syncHeadsActive();
  // preview bubble on the newest head for a few seconds
  $$(".ch-head.peek", box).forEach((el) => el.classList.remove("peek"));
  const el = !quiet && changedKey && $(`[data-key="${CSS.escape(changedKey)}"]`, box);
  if (el) { el.classList.add("peek"); clearTimeout(peekTimer); peekTimer = setTimeout(() => el.classList.remove("peek"), 5200); }
}
/* a small chat window that opens beside the heads (Messenger style) */
let miniKey = null;
const miniOpenWith = () => (miniKey?.startsWith("u:") ? miniKey.slice(2) : null);
const miniOpenGroup = () => (miniKey?.startsWith("g:") ? miniKey.slice(2) : null);
function syncHeadsActive() {
  $$("#chat-heads .ch-head").forEach((el) => {
    const on = el.dataset.key === miniKey;
    el.classList.toggle("active", on);
    if (on) { el.classList.remove("peek"); const b = $(".ch-badge", el); if (b) b.hidden = true; }
  });
}
function openMiniChat(key) {
  if (miniKey === key) return closeMiniChat();
  const [kind, id] = key.split(":");
  const p = kind === "u" ? profile(id) : null, g = kind === "g" ? groupById(id) : null;
  if (!p && !g) return openChatHead(key);
  let box = $("#mini-chat");
  if (!box) {
    box = document.createElement("div");
    box.id = "mini-chat"; box.className = "mini-chat"; box.setAttribute("role", "dialog");
    document.body.append(box);
  }
  box.setAttribute("aria-label", p ? p.full_name : g.name);
  box.innerHTML = `<div id="chat-pane" class="mini-pane"></div>`;
  miniKey = key;
  const h = chatHeads.find((x) => x.key === key); if (h) h.count = 0;
  box.classList.remove("closing"); void box.offsetWidth; box.classList.add("open");
  if (p) renderThread(p); else renderGroupThread(g);
  const head = $(".thread-head", box);
  head.insertAdjacentHTML("beforeend", `
    <a class="icon-btn mini-full" href="${g ? `#/chat?group=${id}` : `#/chat?with=${id}`}" title="${tx("فتح في المحادثات")}" aria-label="${tx("فتح في المحادثات")}">${icon("expand", "sm")}</a>
    <button type="button" class="icon-btn mini-x" title="${tx("إغلاق")}" aria-label="${tx("إغلاق")}">${icon("close", "sm")}</button>`);
  $(".mini-x", box).onclick = closeMiniChat;
  $(".mini-full", box).onclick = () => { closeMiniChat(false); chatHeadRemove(key); };
  syncHeadsActive();
}
function closeMiniChat(animate = true) {
  const box = $("#mini-chat");
  if (!box || !miniKey) return;
  miniKey = null;
  box.classList.remove("open");
  if (animate && !reduceMotion) { box.classList.add("closing"); setTimeout(() => { if (!miniKey) { box.classList.remove("closing"); box.innerHTML = ""; } }, 240); }
  else box.innerHTML = "";
  syncHeadsActive();
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && miniKey && !$("#modal-root .overlay") && !$(".img-viewer")) closeMiniChat();
});

function openChatHead(key) {
  const [kind, id] = key.split(":");
  chatHeadRemove(key);
  location.hash = kind === "g" ? `#/chat?group=${id}` : `#/chat?with=${id}`;
}
// tap opens the chat; drag it to the ✕ at the bottom to dismiss (like Messenger)
function wireChatHead(el, key) {
  $(".ch-x", el).onclick = (e) => { e.stopPropagation(); if (miniKey === key) closeMiniChat(); chatHeadRemove(key); };
  el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openMiniChat(key); } };
  el.addEventListener("dragstart", (e) => e.preventDefault());
  let sx = 0, sy = 0, drag = false, down = false;
  const trash = () => $("#ch-trash");
  const overTrash = (x, y) => { const r = trash().getBoundingClientRect(); return Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) < 70; };
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest(".ch-x")) return;
    down = true; drag = false; sx = e.clientX; sy = e.clientY; el.setPointerCapture(e.pointerId);
  });
  el.addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!drag && Math.hypot(dx, dy) > 8) { drag = true; el.classList.add("dragging"); el.classList.remove("peek"); document.body.classList.add("ch-dragging"); }
    if (drag) {
      el.style.translate = `${dx}px ${dy}px`;
      trash().classList.toggle("hot", overTrash(e.clientX, e.clientY));
    }
  });
  const end = (e) => {
    if (!down) return; down = false;
    document.body.classList.remove("ch-dragging");
    if (!drag) { openMiniChat(key); return; }
    el.classList.remove("dragging");
    const hit = overTrash(e.clientX, e.clientY);
    trash().classList.remove("hot");
    if (hit) { el.classList.add("trashed"); setTimeout(() => chatHeadRemove(key, false), 220); }
    else { el.classList.add("springback"); el.style.translate = ""; setTimeout(() => el.classList.remove("springback"), 450); }
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}

// Floating "new task" button: ripple + spin, then the new-task dialog. "N" opens it from anywhere.
function wireFab() {
  const fab = $("#fab"); if (!fab) return;
  fab.onclick = (e) => {
    const r = fab.getBoundingClientRect(), d = Math.max(r.width, r.height);
    const rip = document.createElement("span");
    rip.className = "fab-ripple";
    const x = (e.clientX || r.left + r.width / 2) - r.left - d / 2, y = (e.clientY || r.top + r.height / 2) - r.top - d / 2;
    rip.style.cssText = `width:${d}px;height:${d}px;left:${x}px;top:${y}px`;
    fab.append(rip); setTimeout(() => rip.remove(), 650);
    fab.classList.remove("pop"); void fab.offsetWidth; fab.classList.add("pop");
    setTimeout(() => openNewTask(), reduceMotion ? 0 : 160);
  };
}
document.addEventListener("keydown", (e) => {
  if (e.key !== "n" && e.key !== "N" && e.key !== "ى") return;
  if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
  const t = e.target;
  if (t.closest?.("input, textarea, select, [contenteditable]") || $("#modal-root .overlay") || $(".overlay.confirm-layer")) return;
  if (!state.me || !$("#fab")) return;
  e.preventDefault(); $("#fab").click();
});

function renderShell() {
  splashDone();
  $("#root").innerHTML = `
    <div class="app">
      <aside class="side brand-bg">
        <a class="side-brand" href="#/home" title="الرئيسية" aria-label="الرئيسية">
          <img class="side-logo" src="assets/logo-white.png" alt="Ibnsina Pharma">
          <div class="side-product">Digital Team Tasks Tracker</div>
        </a>
        <nav class="nav" id="nav" aria-label="القائمة الرئيسية"></nav>
        <div class="nav-more" id="nav-more" hidden>
          <button class="nav-more-btn" id="nav-more-btn" aria-haspopup="menu" aria-expanded="false">${icon("grid", "sm")}<span>المزيد</span></button>
          <div class="nav-menu" id="nav-menu" role="menu" hidden></div>
        </div>
        <div class="side-me" id="side-me"></div>
      </aside>
      <main class="main" id="view"></main>
      <nav class="tabbar" id="tabbar" aria-label="القائمة الرئيسية"></nav>
    </div>
    <div class="chat-heads" id="chat-heads" aria-live="polite"></div>
    <div class="ch-trash" id="ch-trash" aria-hidden="true">${icon("close")}</div>
    <button class="fab" id="fab" type="button" aria-label="${tx("مهمة جديدة")}" title="${tx("مهمة جديدة")} (N)">
      <span class="fab-ic">${icon("plus")}</span><span class="fab-label">${tx("مهمة جديدة")}</span><kbd class="fab-key">N</kbd>
    </button>`;
  wireFab();
  window.onhashchange = () => { state.animate = true; route(); };
  window.onresize = () => { placeTabPill(document); sizeBoard(); sizeChat(); fitNav(); };
  state.animate = true;
  route();
}

function renderNav() {
  if (!$("#nav")) return;
  const r = currentRoute();
  const myOpen = state.tasks.filter((t) => t.assignees.includes(state.me.id) && t.status !== "done").length;
  const items = [["home", "الرئيسية", "home"], ["tasks", "المهام", "tasks", myOpen], ["chat", "المحادثات", "chat", "chat"], ["projects", "المشاريع", "projects"], ["weekly", "التقرير الأسبوعي", "report"], ["attendance", "الحضور والنقاط", "trophy"]];
  if (isManager()) items.push(["reports", "التقارير", "report"]);
  if (isManager()) items.push(["team", "أداء الفريق", "team"]);
  items.push(["org", "الهيكل التنظيمي", "org"]);
  if (isManager()) items.push(["users", "الموظفين", "users"]);
  items.push(["settings", "الإعدادات", "settings"]);
  $("#nav").innerHTML = `<span class="nav-ind" aria-hidden="true"></span>` + items.map(([k, label, ic, n]) =>
    `<a href="#/${k}" class="${r.page === k ? "on" : ""}" ${r.page === k ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}</span>${n === "chat" ? `<span class="count chat-count" data-chat-badge hidden></span>` : n ? `<span class="count">${n}</span>` : ""}</a>`).join("");
  // Mobile app tab bar: first four destinations + "More" sheet for the rest
  const primary = items.slice(0, 4), rest = items.slice(4);
  const inMore = rest.some(([k]) => k === r.page);
  $("#tabbar").innerHTML = primary.map(([k, label, ic, n]) =>
    `<a href="#/${k}" class="tb ${r.page === k ? "on" : ""}" ${r.page === k ? 'aria-current="page"' : ""}><span class="tb-ic">${icon(ic)}${n === "chat" ? `<span class="tb-badge" data-chat-badge hidden></span>` : n ? `<span class="tb-badge">${n > 9 ? "9+" : n}</span>` : ""}</span><span class="tb-lbl">${label}</span></a>`).join("") +
    `<button class="tb ${inMore ? "on" : ""}" id="tb-more" aria-haspopup="dialog"><span class="tb-ic">${icon("grid")}</span><span class="tb-lbl">المزيد</span></button>`;
  $("#tb-more").onclick = () => openMoreSheet(rest);
  renderChatBadges();
  const me = state.me;
  // header: notifications on their own, then the account button with a dropdown menu
  $("#side-me").innerHTML = `
    <span id="bell-slot" class="bell-solo"></span>
    <div class="acct">
      <button class="acct-btn" id="acct-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="acct-menu" title="${esc(me.full_name)}">
        ${avatar(me)}
        <span class="who"><b>${esc(me.full_name)}</b><small>${esc(me.job_title || "")}</small></span>
        <span class="acct-chev">${icon("chev", "sm")}</span>
      </button>
      <div class="acct-menu" id="acct-menu" role="menu" hidden>
        <div class="acct-head">${avatar(me)}<div><b>${esc(me.full_name)}</b><small>${esc(me.job_title || "")}</small></div></div>
        <button role="menuitem" data-acct="photo">${icon("camera")}<span>${tx("تغيير الصورة الشخصية")}</span></button>
        <button role="menuitem" data-acct="lang">${icon("globe")}<span>${tx("اللغة")}</span><em>${LANG === "en" ? "English" : "العربية"}</em><span class="acct-switch">${LANG === "en" ? "ع" : "EN"}</span></button>
        <button role="menuitem" data-acct="pass">${icon("lock")}<span>${tx("تغيير كلمة السر")}</span></button>
        <hr>
        <button role="menuitem" data-acct="logout" class="danger">${icon("logout")}<span>${tx("تسجيل الخروج")}</span></button>
      </div>
    </div>`;
  renderBell();
  fitNav(); requestAnimationFrame(fitNav); watchNav();
  document.fonts?.ready.then(fitNav);
  const acctBtn = $("#acct-btn"), acctMenu = $("#acct-menu");
  const closeAcct = () => { acctMenu.hidden = true; acctBtn.setAttribute("aria-expanded", "false"); };
  acctBtn.onclick = (e) => {
    e.stopPropagation();
    const open = acctMenu.hidden;
    $("#notif-panel") && toggleNotifPanel();
    acctMenu.hidden = !open; acctBtn.setAttribute("aria-expanded", String(open));
    if (open) $("[role=menuitem]", acctMenu)?.focus();
  };
  acctMenu.onkeydown = (e) => {
    const items = $$("[role=menuitem]", acctMenu), i = items.indexOf(document.activeElement);
    if (e.key === "Escape") { e.stopPropagation(); closeAcct(); acctBtn.focus(); }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus(); }
  };
  $$("[data-acct]", acctMenu).forEach((b) => b.onclick = async () => {
    closeAcct();
    switch (b.dataset.acct) {
      case "photo": return changeMyPhoto();
      case "lang": setLang(LANG === "en" ? "ar" : "en"); savePrefs(); state.animate = false; return renderShell();
      case "pass": return openPasswordModal(me);
      case "logout": await dropPushForLogout(); return sb.auth.signOut();
    }
  });
}
function changeMyPhoto() {
  const me = state.me;
  pickPhoto(async (file) => {
    try { await uploadAvatar(me.id, file); await loadProfiles(); state.animate = false; renderShell(); toast("اتغيرت الصورة"); }
    catch (e) { toast(friendly(e), true); }
  });
}
document.addEventListener("click", (e) => {
  const m = $("#acct-menu");
  if (m && !m.hidden && !e.target.closest(".acct")) { m.hidden = true; $("#acct-btn")?.setAttribute("aria-expanded", "false"); }
});

// Desktop nav: a pill that glides from the previous page's link to the current one
let navIndAt = null;
function placeNavInd() {
  const nav = $("#nav"), ind = nav && $(".nav-ind", nav);
  if (!ind) return;
  const a = $("a.on:not(.nav-ovf)", nav);
  if (!a || matchMedia("(max-width: 960px)").matches) { ind.style.opacity = "0"; return; }
  const to = { x: a.offsetLeft, w: a.offsetWidth };
  if (navIndAt && !reduceMotion) {
    ind.style.transition = "none";
    ind.style.transform = `translateX(${navIndAt.x}px)`; ind.style.width = navIndAt.w + "px";
    void ind.offsetWidth;
    ind.style.transition = "";
  }
  ind.style.opacity = "1";
  ind.style.transform = `translateX(${to.x}px)`; ind.style.width = to.w + "px";
  navIndAt = to;
}
addEventListener("scroll", () => $(".side")?.classList.toggle("scrolled", scrollY > 6), { passive: true });
// link widths change once the web font arrives (or the bar goes tight/compact): re-measure the pill without animating
let navRO = null, navRaf = 0;
function snapNavInd() {
  cancelAnimationFrame(navRaf);
  navRaf = requestAnimationFrame(() => {
    const ind = $("#nav .nav-ind"); if (!ind) return;
    ind.style.transition = "none"; navIndAt = null; placeNavInd();
    void ind.offsetWidth; ind.style.transition = "";
  });
}
function watchNav() {
  const nav = $("#nav"); if (!nav || !window.ResizeObserver) return;
  navRO?.disconnect();
  const seen = new WeakMap();
  navRO = new ResizeObserver((entries) => {
    let changed = false;
    for (const e of entries) {
      const w = Math.round(e.contentRect.width), was = seen.get(e.target);
      if (was !== undefined && was !== w) changed = true;
      seen.set(e.target, w);
    }
    if (changed) snapNavInd();
  });
  navRO.observe(nav); $$("a", nav).forEach((a) => navRO.observe(a));
}
document.fonts?.addEventListener?.("loadingdone", () => { fitNavInner(); snapNavInd(); });

// Desktop top bar: links that don't fit move into the "More" dropdown
function fitNav() { fitNavInner(); placeNavInd(); }
function fitNavInner() {
  const nav = $("#nav"), more = $("#nav-more"), menu = $("#nav-menu");
  if (!nav || !more) return;
  const links = $$("a", nav);
  links.forEach((a) => a.classList.remove("nav-ovf"));
  nav.classList.remove("compact", "tight");
  more.hidden = true; menu.hidden = true;
  if (matchMedia("(max-width: 960px)").matches) return;
  const fits = () => nav.scrollWidth <= nav.clientWidth + 1;
  if (fits()) return;
  nav.classList.add("tight"); if (fits()) return;      // smaller padding
  nav.classList.add("compact"); if (fits()) return;    // drop the icons
  
  more.hidden = false;
  for (let i = links.length - 1; i > 0 && nav.scrollWidth > nav.clientWidth + 1; i--) links[i].classList.add("nav-ovf");
  const hidden = links.filter((a) => a.classList.contains("nav-ovf"));
  menu.innerHTML = hidden.map((a) => `<a role="menuitem" href="${a.getAttribute("href")}" class="${a.classList.contains("on") ? "on" : ""}">${a.innerHTML}</a>`).join("");
  $("#nav-more-btn").classList.toggle("on", hidden.some((a) => a.classList.contains("on")));
  $$("a", menu).forEach((a) => a.onclick = () => closeNavMenu());
  renderChatBadges();
}
function closeNavMenu() { const m = $("#nav-menu"); if (m) m.hidden = true; $("#nav-more-btn")?.setAttribute("aria-expanded", "false"); }
document.addEventListener("click", (e) => {
  const btn = e.target.closest?.("#nav-more-btn");
  if (btn) { const m = $("#nav-menu"); m.hidden = !m.hidden; btn.setAttribute("aria-expanded", String(!m.hidden)); return; }
  if (!e.target.closest?.("#nav-menu")) closeNavMenu();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeNavMenu(); });

function openMoreSheet(rest) {
  const me = state.me, r = currentRoute();
  const ov = openModal(`
    <div class="sheet-grab" aria-hidden="true"></div>
    <div class="sheet-me">
      ${avatar(me)}
      <div class="who"><b>${esc(me.full_name)}</b><small>${esc(me.job_title || "")}</small></div>
    </div>
    <div class="sheet-list">
      ${rest.map(([k, label, ic]) => `<a href="#/${k}" class="sheet-item ${r.page === k ? "on" : ""}"><span class="si-ic">${icon(ic)}</span><span>${label}</span>${icon("chev", "sm")}</a>`).join("")}
    </div>
    <div class="sheet-list">
      <button class="sheet-item" data-act="photo"><span class="si-ic">${icon("camera")}</span><span>تغيير صورتي</span>${icon("chev", "sm")}</button>
      <button class="sheet-item" data-act="pass"><span class="si-ic">${icon("lock")}</span><span>تغيير كلمة السر</span>${icon("chev", "sm")}</button>
      <button class="sheet-item danger" data-act="out"><span class="si-ic">${icon("logout")}</span><span>تسجيل الخروج</span></button>
    </div>`, { label: "المزيد" });
  ov.classList.add("sheet");
  $$(".sheet-list a", ov).forEach((a) => a.addEventListener("click", () => closeModal()));
  $('[data-act="photo"]', ov).onclick = () => { closeModal(); changeMyPhoto(); };
  $('[data-act="pass"]', ov).onclick = () => { closeModal(); setTimeout(() => openPasswordModal(me), 220); };
  $('[data-act="out"]', ov).onclick = async () => { closeModal(); await dropPushForLogout(); sb.auth.signOut(); };
}

function currentRoute() {
  const h = location.hash.replace(/^#\/?/, "");
  const [page, qs] = h.split("?");
  return { page: page || "home", params: new URLSearchParams(qs || "") };
}

function route() {
  if (!state.me || !$("#view")) return;
  const { page, params } = currentRoute();
  document.body.dataset.page = page;
  if (page !== "chat") state.lastNonChat = location.hash;
  if (page === "chat") closeMiniChat(false);
  if (page === "chat") { const w = params.get("with"), g = params.get("group"); if (w) chatHeadRemove("u:" + w); if (g) chatHeadRemove("g:" + g); }
  renderNav();
  const view = $("#view");
  if (page !== "chat") document.body.classList.remove("chat-thread");
  if (page === "settings") renderSettings();
  else if (page === "chat") renderChat();
  else if (page === "attendance") renderAttendance();
  else if (page === "weekly") renderWeekly();
  else if (page === "home") renderHome();
  else if (page === "reports" && isManager()) renderReports();
  else if (page === "projects") renderProjects();
  else if (page === "team" && isManager()) renderTeam();
  else if (page === "org") renderOrg();
  else if (page === "users" && isManager()) renderUsers();
  else if (page !== "tasks") { location.replace("#/home"); return; }
  else {
    if (location.hash !== state.lastHash) {
      state.lastHash = location.hash;
      state.view.user = params.get("user") || null;
      state.view.project = params.get("project") || "";
      if (state.view.user || state.view.project) { state.view.tab = "all"; state.view.status = "all"; }
    }
    renderTasks();
    const openId = params.get("task");
    if (openId) {
      history.replaceState(null, "", "#/tasks");
      state.lastHash = "#/tasks";
      if (state.tasks.some((t) => t.id === openId)) setTimeout(() => openTask(openId), 60);
      else toast("المهمة دي مبقتش موجودة", true);
    }
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
    case "mine":    return state.tasks.filter((t) => t.assignees.includes(me) || (t.mentions || []).includes(me));
    case "created": return state.tasks.filter((t) => t.created_by === me);
    case "team":    return state.tasks.filter((t) => t.assignees.some((u) => team.has(u)));
    case "archived": return myArchived();
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
  const label = d < 0 ? tx("متأخرة {n} يوم", { n: -d }) : d === 0 ? "النهارده" : d === 1 ? "بكرة" : fmtDate(t.deadline);
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
    list.map((p) => `<option value="${p.id}" ${p.id === selected ? "selected" : ""}>${esc(p.name)}${p.status === "archived" ? " " + tx("(مؤرشف)") : ""}</option>`).join("");
}

function renderTasks() {
  const v = state.view;
  const tabs = [["mine", "مسندة لي"], ["created", "أنشأتها"]];
  if (isManager()) tabs.push(["team", "مهام فريقي"]);
  tabs.push(["all", tx("كل مهام الموظفين")]);
  // admins land on everyone's tasks; everybody else on their own
  const defTab = state.me.is_admin ? "all" : "mine";
  const arch = v.tab === "archived" && state.archiveReady;
  if (!tabs.some(([k]) => k === v.tab) && !arch) v.tab = defTab;
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
    const q = v.q.toLowerCase().trim(), qn = q.replace(/^#/, "");
    list = list.filter((t) => (/^\d+$/.test(qn) && String(t.task_no) === qn) || t.title.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q));
  }
  list = sortTasks(list);
  const board = getView() === "board" && !arch;
  const filterUser = v.user && profile(v.user);
  const filterProj = project(v.project);
  const firstName = state.me.full_name.split(" ")[0];
  const myOpen = tasksForTab("mine").filter((t) => t.status !== "done").length;

  const STAT_LABELS = { open: tx("مفتوحة"), overdue: tx("متأخرة"), week: tx("خلال 7 أيام"), done: tx("مكتملة") };
  const statCard = (key, label, ic, tone, n) =>
    `<button class="stat ${tone} ${v.status === key ? "on" : ""}" data-st="${key}" aria-pressed="${v.status === key}">
       <div class="ico">${icon(ic)}</div><b data-count="${n}">${n}</b><span>${label}</span></button>`;

  $("#view").innerHTML = `
    <div class="page-head ${board ? "ph-board" : ""}">
      <div><h1>${filterProj ? esc(filterProj.name) : "المهام"}</h1>
        <p>${filterProj ? esc(filterProj.description || "مهام المشروع") : tx("أهلاً {name}، عندك {n} مهمة مفتوحة.", { name: esc(firstName), n: myOpen })}</p>
        ${filterProj ? `<div class="proj-lead-line">${profile(filterProj.lead_id) ? `${avatar(profile(filterProj.lead_id), "sm")}<span>${tx("المسؤول: {name}", { name: esc(profile(filterProj.lead_id).full_name) })}</span>` : "<span>بدون مسؤول</span>"}</div>` : ""}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${filterProj && canEditProject(filterProj) ? `<button class="btn ghost" id="edit-cur-proj">${icon("edit")}تعديل المشروع</button>` : ""}
        <div class="tf">
          <button class="btn tf-btn ${v.status !== "all" || v.user || arch ? "active" : ""} ${arch ? "tf-arch-on" : ""}" id="tf-btn" aria-haspopup="dialog" aria-expanded="false">${icon("filter")}<span>${tx("فلتر")}</span><em>${filterUser ? esc(filterUser.full_name.split(" ")[0]) : arch ? tx("المهام المؤرشفة") : tabs.find(([k]) => k === v.tab)[1]}${STAT_LABELS[v.status] ? " · " + STAT_LABELS[v.status] : ""}</em></button>
          <div class="tf-pop" id="tf-pop" role="dialog" aria-label="${tx("فلتر")}" hidden>
            <h4>${tx("المهام")}</h4>
            <div class="tf-opts">${tabs.map(([k, l]) => `<button class="tf-opt ${v.tab === k ? "on" : ""}" data-ftab="${k}"><span>${l}</span><b>${tasksForTab(k).length}</b></button>`).join("")}</div>
            ${state.archiveReady ? `<button class="tf-opt tf-arch ${arch ? "on" : ""}" data-ftab="archived">${icon("archive", "sm")}<span>${tx("المهام المؤرشفة")}</span><b>${myArchived().length}</b></button>` : ""}
            <h4>${tx("الحالة")}</h4>
            <div class="tf-stats">
              ${[["open", "مفتوحة", "inbox", "", stats.open], ["overdue", "متأخرة", "flame", "t-bad", stats.overdue], ["week", "خلال 7 أيام", "clock", "t-warn", stats.week], ["done", "مكتملة", "check", "t-ok", stats.done]]
                .map(([k, l, ic, tone, n]) => `<button class="tf-stat ${tone} ${v.status === k ? "on" : ""}" data-fst="${k}" aria-pressed="${v.status === k}"><span class="ico">${icon(ic, "sm")}</span><b>${n}</b><span>${l}</span></button>`).join("")}
            </div>
            <h4>${tx("الموظف")}</h4>
            <select class="input" id="tf-user" aria-label="${tx("الموظف")}"><option value="">${tx("كل الموظفين")}</option>${state.profiles.filter((p) => p.active && p.id !== state.me.id).sort((a, b) => a.full_name.localeCompare(b.full_name, "ar")).map((p) => `<option value="${p.id}" ${v.user === p.id ? "selected" : ""}>${esc(p.full_name)}</option>`).join("")}</select>
            ${v.status !== "all" || v.tab !== defTab || v.user ? `<button class="tf-reset" id="tf-reset">${icon("close", "sm")}${tx("مسح الفلتر")}</button>` : ""}
          </div>
        </div>
        <button class="btn primary new-task-btn" id="new-task"><span class="nt-plus">${icon("plus")}</span>مهمة جديدة</button>
      </div>
    </div>
    ${filterUser ? `<div><span class="filter-tag">${tx("مهام {name}", { name: esc(filterUser.full_name) })} <button id="clear-user" aria-label="إلغاء الفلتر">×</button></span></div>` : ""}
    ${arch ? `<div class="arch-banner">${icon("archive")}<div><b>${tx("المهام المؤرشفة")}</b><span>${tx("المهام اللي اتأرشفت أو اتحذفت. تقدر ترجعها تاني أو تحذفها نهائيًا.")}</span></div><button class="btn sm" id="arch-back">${icon("close", "sm")}${tx("رجوع للمهام")}</button></div>` : ""}
    <div class="toolbar ${board ? "tb-board" : ""}">
      <div class="view-toggle" ${arch ? "hidden" : ""} role="group" aria-label="طريقة العرض">
        <button class="${board ? "" : "on"}" data-view="list" aria-pressed="${!board}" title="قائمة">${icon("rows", "sm")}<span>قائمة</span></button>
        <button class="${board ? "on" : ""}" data-view="board" aria-pressed="${board}" title="كانبان">${icon("board", "sm")}<span>كانبان</span></button>
      </div>
      ${board ? "" : `<div class="chips">
        <button class="chip ${v.status === "all" ? "on" : ""}" data-st="all">الكل</button>
        ${Object.entries(STATUS).map(([k, l]) => `<button class="chip ${v.status === k ? "on" : ""}" data-st="${k}">${l}</button>`).join("")}
      </div>`}
      <span class="grow"></span>
      <select class="input" id="proj-filter" aria-label="المشروع">${projectOptions(v.project, { includeArchivedId: v.project, emptyLabel: "كل المشاريع" })}</select>
      <div class="input-icon search">${icon("search", "sm")}<input class="input" id="q" type="search" placeholder="${tx("ابحث بالاسم أو رقم المهمة")}" value="${esc(v.q)}"></div>
    </div>
    ${board ? boardHtml(list) : `<div class="list ${arch ? "list-arch" : ""} ${state.animate ? "stagger" : ""}">
      ${list.length ? `<div class="list-head"><span>الحالة</span><span>المهمة</span><span>المسؤولين</span><span>الموعد</span><span>الإنجاز</span><span></span></div>` : ""}
      ${list.map((t, i) => {
        const p = project(t.project_id);
        return `
        <div class="task-row ${t.status === "done" ? "done" : ""}" role="button" tabindex="0" data-id="${t.id}" aria-label="${esc(t.title)}" style="--i:${Math.min(i, 14)};${p ? `--c:${esc(p.color)}` : ""}">
          ${statusPill(t)}
          <span class="t-title"><b>${tnoHtml(t)}${esc(t.title)}</b>${arch ? archBadge(t) : ""}${isMentioned(t) ? `<span class="kb-mention">${icon("at", "sm")}${tx("عملولك منشن")}</span>` : ""}${linkChipsHtml(t)}
            <small>${p ? projChip(p) : ""}<span class="prio prio-${t.priority}">● ${PRIORITY[t.priority]}</span><span ${t.created_by ? `data-pid="${esc(t.created_by)}"` : ""}>${tx("من {name}", { name: esc(profile(t.created_by)?.full_name || "—") })}</span></small></span>
          ${avatarsCell(t.assignees)}
          ${deadlineCell(t)}
          ${progressCell(t)}
          <span class="row-actions">${arch ? archRowActions(t) : canWorkOn(t) ? `${delReqOf(t) ? `<span class="req-dot" title="${tx("فيه طلب حذف مستني موافقة")}">${icon("clock", "sm")}</span>` : ""}${state.archiveReady ? `<button class="row-arch" data-arch="${t.id}" title="${tx("أرشفة")}" aria-label="${tx("أرشفة")}">${icon("archive", "sm")}</button>` : ""}<button class="row-del" data-del="${t.id}" title="حذف المهمة" aria-label="${tx("حذف المهمة {title}", { title: esc(t.title) })}">${icon("trash", "sm")}</button>` : ""}</span>
        </div>`;
      }).join("") || `<div class="empty"><div class="ill">${icon("tasks")}</div><b>${arch ? tx("مفيش مهام مؤرشفة") : "مفيش مهام هنا"}</b>${arch ? tx("لما تأرشف أو تحذف مهمة هتلاقيها هنا.") : v.tab === "mine" && v.status === "all" && !v.project ? "أي مهمة تتسند لك هتظهر في القائمة دي." : "غيّر الفلتر أو أضف مهمة جديدة."}</div>`}
    </div>`}`;

  $("#new-task").onclick = () => openNewTask();
  // filter popover: which tasks (mine / created / team / all) + status shortcuts with counts
  const tfBtn = $("#tf-btn"), tfPop = $("#tf-pop");
  const tfClose = () => { tfPop.hidden = true; tfBtn.setAttribute("aria-expanded", "false"); };
  tfBtn.onclick = (e) => { e.stopPropagation(); const open = tfPop.hidden; tfPop.hidden = !open; tfBtn.setAttribute("aria-expanded", String(open)); };
  tfPop.onclick = (e) => e.stopPropagation();
  tfPop.onkeydown = (e) => { if (e.key === "Escape") { e.stopPropagation(); tfClose(); tfBtn.focus(); } };
  document.addEventListener("click", tfClose, { once: true });
  $$("[data-ftab]", tfPop).forEach((b) => b.onclick = () => { v.tab = b.dataset.ftab; state.animate = true; renderTasks(); afterRender(); $("#tf-btn")?.click(); });
  $$("[data-fst]", tfPop).forEach((b) => b.onclick = () => { v.status = v.status === b.dataset.fst ? "all" : b.dataset.fst; state.animate = true; renderTasks(); afterRender(); $("#tf-btn")?.click(); });
  const tfr = $("#tf-reset"); if (tfr) tfr.onclick = () => { v.tab = defTab; v.status = "all"; if (v.user) { location.hash = "#/tasks" + (v.project ? `?project=${v.project}` : ""); return; } state.animate = true; renderTasks(); afterRender(); };
  const tfu = $("#tf-user"); if (tfu) tfu.onchange = () => {
    if (tfu.value) v.tab = "all";
    const qs = new URLSearchParams();
    if (tfu.value) qs.set("user", tfu.value);
    if (v.project) qs.set("project", v.project);
    location.hash = "#/tasks" + (qs.toString() ? "?" + qs : "");
  };
  const ecp = $("#edit-cur-proj"); if (ecp) ecp.onclick = () => openProjectModal(filterProj);
  $$("[data-view]").forEach((b) => b.onclick = () => {
    if (b.dataset.view === getView()) return;
    setView(b.dataset.view);
    if (b.dataset.view === "board" && STATUS[v.status]) v.status = "all";
    state.animate = true; renderTasks(); afterRender();
  });
  if (board) wireBoard();
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
    r.onclick = (e) => { if (!e.target.closest(".row-actions button")) openTask(r.dataset.id); };
    r.onkeydown = (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === r) { e.preventDefault(); openTask(r.dataset.id); } };
  });
  $$("[data-del]").forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    const t = state.tasks.find((x) => x.id === b.dataset.del);
    if (t) deleteTask(t, b.closest(".task-row"));
  });
  $$("[data-arch]").forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    const t = state.tasks.find((x) => x.id === b.dataset.arch);
    if (t) archiveTask(t, b.closest(".task-row"));
  });
  $$("[data-restore]").forEach((b) => b.onclick = (e) => { e.stopPropagation(); const t = findTask(b.dataset.restore); if (t) restoreTask(t, b.closest(".task-row")); });
  $$("[data-purge]").forEach((b) => b.onclick = (e) => { e.stopPropagation(); const t = findTask(b.dataset.purge); if (t) purgeTask(t, b.closest(".task-row")); });
  const ab = $("#arch-back"); if (ab) ab.onclick = () => { v.tab = defTab; state.animate = true; renderTasks(); afterRender(); };
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
  cleanupDrawer();
  document.body.style.overflow = "";
  if (reduceMotion) { $("#modal-root").innerHTML = ""; flushCoreRepaint(); return; }
  ov.classList.add("closing");
  setTimeout(() => { if (ov.isConnected) $("#modal-root").innerHTML = ""; flushCoreRepaint(); }, 200);
}
function openModal(html, { drawer = false, label = "", wide = false } = {}) {
  cleanupDrawer();
  $("#modal-root").innerHTML = `<div class="overlay ${drawer ? "drawer" : ""}" role="dialog" aria-modal="true" aria-label="${esc(label)}">${drawer ? `<div class="panel">${html}</div>` : `<div class="modal ${wide ? "wide" : ""}">${html}</div>`}</div>`;
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
    <div class="pick-tools">
      <div class="input-icon people-search">${icon("search", "sm")}<input class="input" type="search" placeholder="ابحث باسم الموظف" data-people-search></div>
      <span class="pick-count" data-pick-count></span>
    </div>
    <div class="pick-grid">
      ${people.map((p) => `
        <label class="pick-p" data-name="${esc(p.full_name.toLowerCase())}">
          <input type="checkbox" name="assignee" value="${p.id}" ${sel.has(p.id) ? "checked" : ""}>
          ${avatar(p)}<span class="tp-name"><b>${esc(p.full_name)}${p.id === me ? " " + tx("(أنا)") : ""}</b><small>${esc(p.job_title || "")}</small></span>
          <span class="pick-mark">${icon("check", "sm")}</span>
        </label>`).join("")}
    </div>`;
}
function wirePeopleSearch(root) {
  const s = $("[data-people-search]", root);
  if (!s) return;
  s.oninput = () => {
    const q = s.value.trim().toLowerCase();
    $$(".pick-grid label, .people-pick label", root).forEach((l) => l.hidden = q && !l.dataset.name.includes(q));
  };
  const cnt = $("[data-pick-count]", root), grid = $(".pick-grid", root);
  if (!cnt || !grid) return;
  const count = () => { const n = $$(".pick-grid input:checked", root).length; cnt.textContent = n ? tx("اخترت {n}", { n }) : tx("مختارتش حد لسه"); cnt.classList.toggle("none", !n); };
  grid.addEventListener("change", count); count();
}

function checkFileSize(file) {
  if (file.size > MAX_FILE_MB * 1048576) throw new Error(tx("{file}: الحد الأقصى {mb} ميجا للملف", { file: file.name, mb: MAX_FILE_MB }));
}

/* ---------- New task ---------- */
// end date can't be before the start date
function wireDateRange(root) {
  const st = $("input[name=start_date]", root), en = $("input[name=deadline]", root);
  if (!st || !en) return;
  const sync = () => { en.min = st.value || ""; if (st.value && en.value && en.value < st.value) en.value = st.value; };
  st.addEventListener("change", sync); sync();
}
// "reached 100%: move it to the done column?"
async function askMoveToDone() {
  return confirmDialog({ title: tx("المهمة وصلت 100%"), body: tx("تنقلها لخانة المكتملة؟"), ok: tx("أيوه، انقلها"), cancel: "لأ، سيبها مكانها", danger: false, ic: "check" });
}
function openNewTask(status = "todo", colId = null) {
  const col = colId && colById(colId);
  const ov = openModal(`
    <h2>مهمة جديدة${col ? ` <span class="pill s-col" style="--sc:${esc(col.color)}">${esc(col.name)}</span>` : status !== "todo" && STATUS[status] ? ` <span class="pill s-${status}">${STATUS[status]}</span>` : ""}</h2>
    <form id="nt">
      <label class="field"><span>عنوان المهمة</span><input class="input" name="title" maxlength="200" required></label>
      <label class="field mention-host"><span>التفاصيل${state.descMentions ? ` <em class="hint-inline">${tx("اكتب @ عشان تعمل منشن لحد")}</em>` : ""}</span><textarea class="input" name="description" rows="3"></textarea></label>
      <div class="row4">
        <label class="field"><span>المشروع</span><select class="input" name="project_id">${projectOptions(state.view.project)}</select></label>
        <label class="field"><span>الأولوية</span>
          <select class="input" name="priority">${Object.entries(PRIORITY).map(([k, l]) => `<option value="${k}" ${k === "medium" ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="field"><span>${tx("تاريخ البداية")}</span><input class="input" type="date" name="start_date" value="${cairoToday()}"></label>
        <label class="field"><span>${tx("تاريخ النهاية")}</span><input class="input" type="date" name="deadline" min="${cairoToday()}"></label>
      </div>
      <div class="field"><span>إسناد إلى</span>${peoplePicker([state.me.id])}</div>
      <div class="field" id="nt-steps"><span>${tx("الخطوات (اختياري)")}</span>
        <div class="subtasks ns-list"></div>
        <div class="sub-add"><input class="input" id="ns-new" placeholder="أضف خطوة واضغط Enter" maxlength="300" aria-label="خطوة جديدة"><button type="button" class="btn sm" id="ns-add">${icon("plus", "sm")}إضافة</button></div>
      </div>
      ${state.linksReady && state.tasks.length ? `<div class="field" id="nt-links"><span>${tx("ربط بمهمة تانية (اختياري)")}</span><div class="link-list"></div>${linkAddHtml()}</div>` : ""}
      <label class="dropzone">${icon("clip", "sm")}<span id="nt-files">${tx("إرفاق ملفات (اختياري، حتى {mb} ميجا للملف)", { mb: MAX_FILE_MB })}</span><input type="file" multiple name="files"></label>
      <div id="nt-progress"></div>
      <p class="err" id="nt-err"></p>
      <div class="modal-foot">
        <button type="button" class="btn ghost" data-close>إلغاء</button>
        <button class="btn primary" type="submit">إنشاء المهمة</button>
      </div>
    </form>`, { label: "مهمة جديدة", wide: true });
  wirePeopleSearch(ov);
  $("[data-close]", ov).onclick = closeModal;
  wireDateRange(ov);
  if (state.descMentions) wireMentions($("textarea[name=description]", ov), $(".mention-host", ov), descMentionPeople());
  // steps written before the task exists: add, rename, drag to reorder; saved right after it's created
  const pendingSteps = [];
  const nsBox = $(".ns-list", ov), nsIn = $("#ns-new", ov);
  const drawSteps = () => {
    nsBox.innerHTML = pendingSteps.map((x, i) => `
      <div class="sub" data-id="${i}">
        ${pendingSteps.length > 1 ? `<span class="ns-grip sub-grip" aria-hidden="true">${icon("grip", "sm")}</span>` : ""}
        <span class="ns-no">${i + 1}</span>
        <span class="ns-title">${esc(x)}</span>
        <button type="button" class="sub-edit" data-nsedit="${i}" aria-label="${tx("تعديل الخطوة")}" title="${tx("تعديل الخطوة")}">${icon("edit", "sm")}</button>
        <button type="button" class="sub-del" data-nsdel="${i}" aria-label="حذف الخطوة">${icon("close", "sm")}</button>
      </div>`).join("");
    $$("[data-nsedit]", nsBox).forEach((b) => b.onclick = async () => {
      const i = +b.dataset.nsedit;
      const v = await promptDialog({ title: tx("تعديل الخطوة"), label: tx("نص الخطوة"), value: pendingSteps[i] });
      if (v != null) { pendingSteps[i] = v; drawSteps(); }
    });
    $$("[data-nsdel]", nsBox).forEach((b) => b.onclick = () => { pendingSteps.splice(+b.dataset.nsdel, 1); drawSteps(); });
  };
  wireDragList(nsBox, ".sub", (order) => { const copy = order.map((i) => pendingSteps[+i]); pendingSteps.splice(0, pendingSteps.length, ...copy); drawSteps(); });
  const addStep = () => { const v = nsIn.value.trim(); if (!v) return; pendingSteps.push(v); nsIn.value = ""; drawSteps(); nsIn.focus(); };
  nsIn.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); addStep(); } };
  $("#ns-add", ov).onclick = addStep;
  // links picked before the task exists; saved right after it's created
  const pendingLinks = [];
  const ntl = $("#nt-links", ov);
  const drawPending = () => {
    if (!ntl) return;
    $(".link-list", ntl).innerHTML = pendingLinks.map((x, i) => { const o = taskLite(x.otherId); return `<div class="link-row"><span class="link-kind k-${x.kind}">${icon(LINK_KINDS[x.kind].ic, "sm")}${tx(LINK_KINDS[x.kind].out)}</span><span class="link-open">${tnoHtml(o)}<span>${esc(o?.title || "")}</span></span><button type="button" class="sub-del" data-prm="${i}" aria-label="${tx("فك الربط")}">${icon("close", "sm")}</button></div>`; }).join("");
    $$("[data-prm]", ntl).forEach((b) => b.onclick = () => { pendingLinks.splice(+b.dataset.prm, 1); drawPending(); });
    wireTaskPicker($(".link-add", ntl), { exclude: new Set(pendingLinks.map((x) => x.otherId)), onPick: (otherId) => { pendingLinks.push({ otherId, kind: $("select[name=link_kind]", ntl).value }); drawPending(); } });
  };
  drawPending();
  const fileInput = $("#nt input[name=files]");
  fileInput.onchange = () => {
    $("#nt-files").textContent = fileInput.files.length ? [...fileInput.files].map((f) => f.name).join("، ") : tx("إرفاق ملفات (اختياري، حتى {mb} ميجا للملف)", { mb: MAX_FILE_MB });
  };
  const err = (m) => { $("#nt-err").textContent = ""; requestAnimationFrame(() => $("#nt-err").textContent = m); };
  $("#nt").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const title = String(f.get("title")).trim();
    const assignees = f.getAll("assignee");
    if (!title) return err("اكتب عنوان المهمة");
    if (!assignees.length) return err("اختار شخص واحد على الأقل");
    if (f.get("start_date") && f.get("deadline") && f.get("deadline") < f.get("start_date")) return err(tx("تاريخ النهاية لازم يكون بعد تاريخ البداية أو في نفس اليوم"));
    try { [...fileInput.files].forEach(checkFileSize); } catch (ex) { return err(ex.message); }
    const btn = e.submitter; btn.disabled = true; btn.textContent = "جاري الحفظ…";
    try {
      const { data: task, error } = await sb.from("tasks").insert({
        title,
        description: String(f.get("description")).trim() || null,
        ...(state.descMentions ? { mentions: mentionIdsIn(String(f.get("description"))) } : {}),
        start_date: f.get("start_date") || null,
        deadline: f.get("deadline") || null,
        priority: f.get("priority"),
        project_id: f.get("project_id") || null,
        status: STATUS[status] ? status : "todo",
        ...(col && (f.get("project_id") || null) === col.project_id ? { status_id: col.id } : {}),
        created_by: state.me.id,
      }).select().single();
      if (error) throw error;
      const { error: e2 } = await sb.from("task_assignees").insert(assignees.map((u) => ({ task_id: task.id, user_id: u })));
      if (e2) throw e2;
      const steps = pendingSteps.map((x) => x.trim()).filter(Boolean);
      if (steps.length) {
        const { error: e4 } = await sb.from("task_subtasks").insert(steps.map((title, i) => ({ task_id: task.id, title, position: i })));
        if (e4) toast(friendly(e4), true);
      }
      if (pendingLinks.length) {
        const { error: e3 } = await sb.from("task_links").insert(pendingLinks.map((x) => ({ task_id: task.id, other_id: x.otherId, kind: x.kind })));
        if (e3) toast(friendly(e3), true);
      }
      if (fileInput.files.length) {
        $("#nt-progress").innerHTML = `<div class="upload-bar"><i></i></div>`;
        for (const file of fileInput.files) await uploadTaskFile(task.id, file);
      }
      await loadTasks();
      closeModal(); state.animate = true; route();
      toast(task.task_no ? tx("اتعملت المهمة #{n}", { n: task.task_no }) : "اتعملت المهمة");
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
    if (!confirm(tx("حذف «{name}»؟", { name: f.file_name }))) return;
    await sb.storage.from("task-files").remove([f.storage_path]);
    const { error: e } = await sb.from("task_files").delete().eq("id", f.id);
    if (e) return toast(friendly(e), true);
    toast("اتحذف الملف"); renderFiles(taskId, box);
  });
}

/* ---------- Task drawer ---------- */
/* ---------- @mentions in comments ---------- */
// people who can open this task: its people, their managers up the chain, and admins
function mentionCandidates(t) {
  const ids = new Set([t.created_by, ...t.assignees, ...(t.mentions || [])].filter(Boolean));
  for (const id of [...ids]) { let p = profile(id); const seen = new Set(); while (p?.manager_id && !seen.has(p.manager_id)) { seen.add(p.manager_id); ids.add(p.manager_id); p = profile(p.manager_id); } }
  state.profiles.forEach((p) => { if (p.is_admin) ids.add(p.id); });
  ids.delete(state.me.id);
  return [...ids].map(profile).filter((p) => p && p.active).sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
}
// anyone active can be @mentioned in a description; that also lets them open the task
const descMentionPeople = () => state.profiles.filter((p) => p.active && p.id !== state.me.id).sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
function commentHtml(c) {
  let html = esc(c.body);
  const names = (c.mentions || []).map(profile).filter(Boolean).sort((a, b) => b.full_name.length - a.full_name.length);
  for (const p of names) {
    const tag = "@" + esc(p.full_name);
    html = html.split(tag).join(`<span class="mention ${p.id === state.me.id ? "me" : ""}" data-pid="${p.id}">${tag}</span>`);
  }
  return html;
}
function wireMentions(ta, host, people) {
  const chosen = new Map(); // id -> name
  const box = document.createElement("div");
  box.className = "mention-box"; box.hidden = true; box.setAttribute("role", "listbox");
  host.appendChild(box);
  let items = [], idx = 0, tokenStart = -1;
  const close = () => { box.hidden = true; items = []; tokenStart = -1; };
  const update = () => {
    const pos = ta.selectionStart, before = ta.value.slice(0, pos);
    const m = before.match(/(^|\s)@([^\s@]{0,24}(?:\s[^\s@]{0,24})?)$/);
    if (!m) return close();
    const q = m[2].trim().toLowerCase();
    items = people.filter((p) => !q || p.full_name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)) || p.full_name.toLowerCase().startsWith(q) || (p.username || "").toLowerCase().startsWith(q)).slice(0, 6);
    if (!items.length) return close();
    tokenStart = pos - m[2].length - 1;
    idx = Math.min(idx, items.length - 1);
    box.innerHTML = `<div class="mb-head">${tx("منشن لحد")}</div>` + items.map((p, i) => `<button type="button" role="option" class="mb-item ${i === idx ? "on" : ""}" data-i="${i}">${avatar(p, "sm")}<span><b>${esc(p.full_name)}</b><small>${esc(p.job_title || "")}</small></span></button>`).join("");
    box.hidden = false;
    $$(".mb-item", box).forEach((b) => b.onmousedown = (e) => { e.preventDefault(); pick(Number(b.dataset.i)); });
  };
  const pick = (i) => {
    const p = items[i]; if (!p || tokenStart < 0) return;
    const pos = ta.selectionStart, ins = "@" + p.full_name + " ";
    ta.value = ta.value.slice(0, tokenStart) + ins + ta.value.slice(pos);
    const caret = tokenStart + ins.length;
    ta.setSelectionRange(caret, caret);
    chosen.set(p.id, p.full_name);
    close(); ta.focus();
    ta.dispatchEvent(new Event("input"));
  };
  ta.addEventListener("input", () => { idx = 0; update(); });
  ta.addEventListener("click", update);
  ta.addEventListener("blur", () => setTimeout(close, 150));
  ta.addEventListener("keydown", (e) => {
    if (box.hidden) return;
    if (e.key === "ArrowDown") { e.preventDefault(); idx = (idx + 1) % items.length; update(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); idx = (idx - 1 + items.length) % items.length; update(); }
    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(idx); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  });
  return {
    ids: (body) => [...chosen].filter(([, name]) => body.includes("@" + name)).map(([id]) => id),
    reset: () => { chosen.clear(); close(); },
  };
}

function statusOptions(pid, selected) {
  const cols = pid ? projCols(pid) : [];
  return cols.length
    ? cols.map((c) => `<option value="${c.id}" ${c.id === selected ? "selected" : ""}>${esc(c.name)}</option>`).join("")
    : Object.entries(STATUS).map(([k, l]) => `<option value="${k}" ${selected === k ? "selected" : ""}>${l}</option>`).join("");
}
function openTask(id) {
  const t = findTask(id);
  if (!t) return toast("المهمة مش موجودة", true);
  // archived / deleted tasks open read-only; anyone working on a task (assignees too) can edit its details
  const archived = !!t.archived_at;
  const manage = !archived && canManageTask(t), work = !archived && canWorkOn(t), edit = work;
  const req = !archived && delReqOf(t);
  // colleagues who aren't on the task see it read-only (no comments / files)
  const engage = !archived && (work || isMentioned(t));
  const creator = profile(t.created_by);
  const dropText = tx("اسحب الملفات هنا أو اضغط للاختيار (حتى {mb} ميجا)", { mb: MAX_FILE_MB });
  const ov = openModal(`
    <div class="panel-top">
      <span class="pt-left">${statusPill(t)}${t.task_no ? `<button type="button" class="tno tno-copy" id="copy-tno" title="${tx("نسخ رقم المهمة")}" dir="ltr">#${t.task_no}</button>` : ""}</span>
      <button class="icon-btn" data-close aria-label="إغلاق" style="color:var(--ink-2)">${icon("close")}</button>
    </div>
    <div id="blocked-banner"></div>
    ${!archived && !engage ? `<div class="view-note">${icon("eye", "sm")}<span>${tx("بتشوف المهمة دي للعرض بس، التعديل والتعليقات للمسؤولين عنها")}</span></div>` : ""}
    ${archived ? `<div class="arch-note ${t.archive_kind === "deleted" ? "del" : ""}">${icon(t.archive_kind === "deleted" ? "trash" : "archive")}
      <div><b>${t.archive_kind === "deleted" ? tx("المهمة دي محذوفة") : tx("المهمة دي مؤرشفة")}</b><span>${tx("{name} · {when}", { name: esc(profile(t.archived_by)?.full_name || "—"), when: fmtDateTime(t.archived_at) })}</span></div>
      ${canRestoreTask(t) ? `<button type="button" class="btn sm" id="td-restore">${icon("restore", "sm")}${tx("استرجاع")}</button>` : ""}</div>` : ""}
    ${req ? `<div class="req-note">${icon("trash")}
      <div><b>${req.requested_by === state.me.id ? tx("طلبت حذف المهمة دي") : tx("{name} طالب يحذف المهمة دي", { name: esc(profile(req.requested_by)?.full_name || "—") })}</b>
      <span>${req.reason ? esc(req.reason) + " · " : ""}${canDeleteTask(t) ? tx("وافق أو ارفض") : tx("مستني موافقة {name}", { name: esc(profile(t.created_by)?.full_name || tx("الأدمن")) })}</span></div>
      <div class="req-acts">${canDeleteTask(t) ? `<button type="button" class="btn sm ghost" id="req-no">${icon("close", "sm")}${tx("رفض")}</button><button type="button" class="btn sm btn-danger" id="req-yes">${icon("check", "sm")}${tx("موافقة")}</button>`
        : req.requested_by === state.me.id ? `<button type="button" class="btn sm ghost" id="req-cancel">${tx("إلغاء الطلب")}</button>` : ""}</div></div>` : ""}
    <form id="td">
      <input class="title-input" name="title" value="${esc(t.title)}" ${edit ? "" : "disabled"} aria-label="عنوان المهمة" maxlength="200">
      <div class="meta">${tx("أنشأها {name} · {date}", { name: esc(creator?.full_name || "—"), date: fmtDateTime(t.created_at) })}${t.completed_at ? " · " + tx("اكتملت {date}", { date: fmtDateTime(t.completed_at) }) : ""}</div>

      <label class="field"><span>المشروع</span>
        <select class="input" name="project_id" ${edit ? "" : "disabled"}>${projectOptions(t.project_id, { includeArchivedId: t.project_id })}</select></label>
      <div class="row2">
        <label class="field"><span>الحالة</span>
          <select class="input" name="status" ${work ? "" : "disabled"}>${statusOptions(t.project_id, taskCol(t)?.id || t.status)}</select></label>
        <label class="field"><span>الأولوية</span>
          <select class="input" name="priority" ${edit ? "" : "disabled"}>${Object.entries(PRIORITY).map(([k, l]) => `<option value="${k}" ${t.priority === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      </div>
      <div class="row2">
        <label class="field"><span>${tx("تاريخ البداية")}</span><input class="input" type="date" name="start_date" value="${t.start_date || ""}" ${edit ? "" : "disabled"}></label>
        <label class="field"><span>${tx("تاريخ النهاية")}</span><input class="input" type="date" name="deadline" value="${t.deadline || ""}" ${edit ? "" : "disabled"}></label>
      </div>
      <div class="row2">
        <div class="field" style="grid-column:1/-1"><span>نسبة الإنجاز</span>
          <div class="range-row"><input type="range" name="progress" min="0" max="100" step="5" value="${t.progress}" ${work ? "" : "disabled"} aria-label="نسبة الإنجاز"><output id="pv">${t.progress}%</output></div>
          <small class="hint" id="pv-hint" hidden>بتتحسب تلقائيًا من الخطوات</small></div>
      </div>
      <label class="field mention-host"><span>التفاصيل${edit && state.descMentions ? ` <em class="hint-inline">${tx("اكتب @ عشان تعمل منشن لحد")}</em>` : ""}</span><textarea class="input" name="description" ${edit ? "" : "disabled"}>${esc(t.description || "")}</textarea>
        ${(t.mentions || []).length ? `<div class="desc-mentions">${icon("at", "sm")}<span>${tx("اتعمل منشن لـ")}</span>${t.mentions.map(profile).filter(Boolean).map((p) => `<span class="dm-chip ${p.id === state.me.id ? "me" : ""}" data-person="${p.id}">${avatar(p, "sm")}${esc(p.full_name)}</span>`).join("")}</div>` : ""}
      </label>

      <div class="section">
        <h3>${icon("users", "sm")}المسؤولين عن المهمة</h3>
        <div class="assignee-list">${t.assignees.map((u) => profile(u)).filter(Boolean).map((p) => `<span class="tag">${avatar(p, "sm")}${esc(p.full_name)}</span>`).join("")}</div>
        ${manage ? `<button type="button" class="btn sm" id="edit-as" style="margin-top:10px">${icon("edit", "sm")}تعديل المسؤولين</button><div id="as-edit" hidden style="margin-top:10px">${peoplePicker(t.assignees)}</div>` : ""}
      </div>

      ${work ? `<p class="err" id="td-err" style="margin-top:16px"></p>` : ""}
    </form>

    ${state.linksReady ? `<div class="section" id="links-box">
      <h3>${icon("link", "sm")}${tx("المهام المرتبطة")} <span class="sub-count" id="links-count"></span></h3>
      <div class="link-list"></div>
      ${work ? linkAddHtml() : ""}
    </div>` : ""}

    <div class="section">
      <h3>${icon("checklist", "sm")}الخطوات <span class="sub-count" id="sub-count"></span></h3>
      <div class="sub-bar" id="sub-bar" hidden><i></i></div>
      <div id="sub-list" class="subtasks"><div class="spinner" style="margin:10px auto"></div></div>
      ${work ? `<div class="sub-add"><input class="input" id="sub-new" placeholder="أضف خطوة واضغط Enter" maxlength="300" aria-label="خطوة جديدة"><button type="button" class="btn sm" id="sub-add-btn">${icon("plus", "sm")}إضافة</button></div>` : ""}
    </div>

    <div class="section">
      <h3>${icon("clip", "sm")}الملفات</h3>
      <div id="files-box"><div class="spinner" style="margin:10px auto"></div></div>
      ${work ? `<label class="dropzone" id="drop">${icon("clip", "sm")}<span>${dropText}</span><input type="file" multiple></label><div id="up-progress"></div>` : ""}
    </div>

    <div class="section">
      <div class="seg-tabs" role="tablist">
        <button type="button" class="on" role="tab" aria-selected="true" data-dtab="comments">${icon("chat", "sm")}<span>التعليقات</span><span class="n" id="c-count"></span></button>
        <button type="button" role="tab" aria-selected="false" data-dtab="activity">${icon("history", "sm")}<span>سجل النشاط</span></button>
      </div>
      <div id="dtab-comments">
        <div id="c-list" class="comments"><div class="spinner" style="margin:10px auto"></div></div>
        ${engage ? `<form id="c-form" class="c-form">
          ${avatar(state.me, "sm")}
          <textarea class="input" name="body" rows="2" maxlength="4000" placeholder="اكتب تعليق…" aria-label="اكتب تعليق…"></textarea>
          <button class="btn primary sm" type="submit" aria-label="إرسال">${icon("send", "sm")}</button>
        </form>` : ""}
      </div>
      <div id="dtab-activity" hidden><div id="a-list" class="timeline"></div></div>
    </div>
    ${work || (archived && canDeleteTask(t)) ? `<div class="drawer-foot">
      ${archived ? `<button type="button" class="btn danger ghost" id="purge-task">${icon("trash", "sm")}<span>${tx("حذف نهائي")}</span></button>`
        : `<button type="button" class="btn danger ghost" id="del-task">${icon("trash", "sm")}<span>${canDeleteTask(t) || !state.archiveReady ? "حذف المهمة" : tx("طلب حذف")}</span></button>
           ${state.archiveReady ? `<button type="button" class="btn ghost" id="arch-task">${icon("archive", "sm")}<span>${tx("أرشفة")}</span></button>` : ""}`}
      <span class="spacer"></span>
      ${work ? `<button class="btn primary" type="submit" form="td">${icon("check", "sm")}<span>حفظ التغييرات</span></button>` : ""}
    </div>` : ""}`, { drawer: true, label: t.title });

  $("[data-close]", ov).onclick = closeModal;
  wirePeopleSearch(ov);
  wireDateRange(ov);
  if (edit && state.descMentions) wireMentions($("textarea[name=description]", ov), $(".mention-host", ov), descMentionPeople());
  const range = $("input[name=progress]", ov), status = $("select[name=status]", ov);
  range.oninput = () => { $("#pv", ov).textContent = range.value + "%"; };
  const kindOf = (v) => colById(v)?.kind || v;
  // reaching 100% asks whether to move the task to the done column (once per drawer)
  let askedDone = false;
  const offerDone = async () => {
    if (askedDone || !ov.isConnected || kindOf(status.value) === "done") return;
    askedDone = true;
    if (!(await askMoveToDone()) || !ov.isConnected) return;
    const pid = $("select[name=project_id]", ov)?.value || t.project_id;
    const doneCol = pid && projCols(pid).find((c) => c.kind === "done");
    const prev = status.value;
    status.value = doneCol ? doneCol.id : "done";
    if (!status.value) { status.value = prev; return toast(tx("مفيش عمود للمهام المكتملة في المشروع ده"), true); }
    range.value = 100; $("#pv", ov).textContent = "100%";
    const sub = $('button[type=submit][form="td"]', ov);
    $("#td", ov).requestSubmit(sub || undefined);
  };
  range.addEventListener("change", () => { if (Number(range.value) === 100) offerDone(); else askedDone = false; });
  ov._offerDone = offerDone;
  status.onchange = () => { if (kindOf(status.value) === "done") { range.value = 100; $("#pv", ov).textContent = "100%"; } };
  const projSel = $("select[name=project_id]", ov);
  if (projSel) projSel.onchange = () => {
    // a different project has different columns: keep the same kind where possible
    const k = kindOf(status.value), pid = projSel.value || null;
    const match = pid && projCols(pid).find((c) => c.kind === k);
    status.innerHTML = statusOptions(pid, match ? match.id : k);
  };
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
  const arb = $("#arch-task", ov); if (arb) arb.onclick = () => archiveTask(t);
  const pur = $("#purge-task", ov); if (pur) pur.onclick = () => purgeTask(t);
  const rst = $("#td-restore", ov); if (rst) rst.onclick = () => restoreTask(t);
  if (req) {
    const y = $("#req-yes", ov), n = $("#req-no", ov), c = $("#req-cancel", ov);
    if (y) y.onclick = () => decideDelReq(req, true);
    if (n) n.onclick = () => decideDelReq(req, false);
    if (c) c.onclick = () => cancelDelReq(req);
  }

  wireDrawerExtras(t, ov, work);
  wireTaskLinks(t, ov, work);
  const ct = $("#copy-tno", ov);
  if (ct) ct.onclick = () => { navigator.clipboard?.writeText("#" + t.task_no).then(() => toast(tx("اتنسخ رقم المهمة")), () => {}); };

  const form = $("#td", ov);
  if (!work) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const tdErr = (m) => { $("#td-err", ov).textContent = ""; requestAnimationFrame(() => $("#td-err", ov).textContent = m); };
    const sv = String(f.get("status") || "");
    const patch = colById(sv) ? { status_id: sv } : { status: sv };
    if (!range.disabled) patch.progress = Number(f.get("progress"));
    if (edit) {
      patch.title = String(f.get("title")).trim();
      patch.description = String(f.get("description")).trim() || null;
      if (state.descMentions) patch.mentions = mentionIdsIn(patch.description || "");
      patch.deadline = f.get("deadline") || null;
      patch.start_date = f.get("start_date") || null;
      if (patch.start_date && patch.deadline && patch.deadline < patch.start_date) return tdErr(tx("تاريخ النهاية لازم يكون بعد تاريخ البداية أو في نفس اليوم"));
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
      toast(kindOf(sv) === "done" && t.status !== "done" ? (blockedWarn(t) || "برافو! المهمة اكتملت") : "اتحفظت التغييرات", kindOf(sv) === "done" && t.status !== "done" && !!blockedWarn(t));
    } catch (ex) {
      tdErr(friendly(ex)); btn.disabled = false;
    }
  };
}

/* ---------- Confirm + delete ---------- */
// Small "edit this text" popup that stacks above the task drawer / modals; resolves with the text or null
function promptDialog({ title, value = "", label = "", ok = "حفظ", max = 300, optional = false, ic = "edit", placeholder = "", danger = false }) {
  return new Promise((resolve) => {
    const root = document.createElement("div");
    root.className = "overlay confirm-layer";
    root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
    root.innerHTML = `<form class="modal confirm prompt">
        <div class="confirm-ico ${danger ? "bad" : ""}">${icon(ic)}</div>
        <h2></h2>
        <label class="field"><span></span><textarea class="input" rows="3" maxlength="${max}" ${optional ? "" : "required"}></textarea></label>
        <p class="err"></p>
        <div class="modal-foot"><button type="button" class="btn ghost" data-no>${tx("إلغاء")}</button><button type="submit" class="btn ${danger ? "btn-danger" : "primary"}" data-yes>${icon("check", "sm")}<span></span></button></div>
      </form>`;
    $("h2", root).textContent = title;
    $(".field > span", root).textContent = label;
    $("[data-yes] span", root).textContent = tx(ok);
    const ta = $("textarea", root); ta.value = value; if (placeholder) ta.placeholder = placeholder;
    document.body.append(root);
    const done = (v) => {
      document.removeEventListener("keydown", onKey, true);
      root.classList.add("closing");
      setTimeout(() => root.remove(), reduceMotion ? 0 : 180);
      resolve(v);
    };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); done(null); } };
    document.addEventListener("keydown", onKey, true);
    root.addEventListener("mousedown", (e) => { if (e.target === root) done(null); });
    $("[data-no]", root).onclick = () => done(null);
    // Enter saves, Shift+Enter makes a new line
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("form", root).requestSubmit(); } });
    $("form", root).onsubmit = (e) => {
      e.preventDefault();
      const v = ta.value.trim();
      if (!v && !optional) { $(".err", root).textContent = tx("اكتب نص الخطوة"); ta.focus(); return; }
      done(v);
    };
    setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 60);
  });
}
function confirmDialog({ title, body = "", ok = "تأكيد", cancel = "إلغاء", danger = true, ic = null }) {
  return new Promise((resolve) => {
    const root = document.createElement("div");
    root.className = "overlay confirm-layer";
    root.setAttribute("role", "alertdialog");
    root.setAttribute("aria-modal", "true");
    root.innerHTML = `<div class="modal confirm">
        <div class="confirm-ico ${danger ? "bad" : ic === "check" ? "good" : ""}">${icon(ic || (danger ? "trash" : "alert"))}</div>
        <h2></h2><p></p>
        <div class="modal-foot"><button class="btn ghost" data-no>${tx(cancel)}</button><button class="btn ${danger ? "btn-danger" : "primary"}" data-yes></button></div>
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

// Delete = move to the archive as "deleted". The creator / their managers / admins do it directly;
// an assignee sends a request to whoever assigned the task (DB v22). Without v22: the old hard delete.
async function deleteTask(t, rowEl = null) {
  if (!state.archiveReady) return purgeTask(t, rowEl);
  if (canDeleteTask(t)) {
    const ok = await confirmDialog({ title: "حذف المهمة؟", body: tx("«{title}» هتتنقل للمهام المؤرشفة، وتقدر ترجعها من هناك في أي وقت.", { title: t.title }), ok: "حذف المهمة" });
    if (!ok) return;
    return runArchive(t, "deleted", null, rowEl);
  }
  const pending = delReqOf(t);
  if (pending) return toast(pending.requested_by === state.me.id ? tx("طلب الحذف بتاعك لسه مستني الموافقة") : tx("فيه طلب حذف للمهمة دي مستني الموافقة"));
  const boss = profile(t.created_by);
  const reason = await promptDialog({
    title: tx("طلب حذف المهمة"), ic: "trash", danger: true, optional: true, max: 500, ok: "ابعت الطلب",
    label: tx("المهمة دي أسندها لك {name}، فهيوصله إشعار يوافق على الحذف أو يرفض. سبب الحذف (اختياري):", { name: boss?.full_name || tx("الأدمن") }),
    placeholder: tx("مثلًا: المهمة اتلغت أو مكررة"),
  });
  if (reason === null) return;
  return runArchive(t, "deleted", reason, rowEl);
}
async function archiveTask(t, rowEl = null) {
  const ok = await confirmDialog({ title: tx("أرشفة المهمة؟"), body: tx("«{title}» هتختفي من المهام وتتنقل للمهام المؤرشفة، وتقدر ترجعها في أي وقت.", { title: t.title }), ok: tx("أرشفة"), ic: "archive", danger: false });
  if (!ok) return;
  return runArchive(t, "archived", null, rowEl);
}
async function runArchive(t, kind, reason, rowEl) {
  rowEl?.classList.add("removing");
  const { data, error } = await sb.rpc("archive_task", { p_task: t.id, p_kind: kind, p_reason: reason || null });
  if (error) { rowEl?.classList.remove("removing"); return toast(friendly(error), true); }
  if (data === "requested") {
    rowEl?.classList.remove("removing");
    await loadTasks(); if (!$("#modal-root .overlay")) { state.animate = false; route(); } else { closeModal(); route(); }
    return toast(tx("اتبعت طلب الحذف لـ {name}", { name: profile(t.created_by)?.full_name || tx("الأدمن") }));
  }
  if (rowEl && !reduceMotion) await new Promise((r) => setTimeout(r, 280));
  await loadTasks();
  if ($("#modal-root .overlay")) closeModal();
  state.animate = false; route();
  toast(kind === "deleted" ? tx("اتحذفت المهمة واتنقلت للمهام المؤرشفة") : tx("اتأرشفت المهمة"));
}
const canRestoreTask = (t) => canDeleteTask(t) || (t.archive_kind === "archived" && canWorkOn(t));
async function restoreTask(t, rowEl = null) {
  rowEl?.classList.add("removing");
  const { error } = await sb.rpc("restore_task", { p_task: t.id });
  if (error) { rowEl?.classList.remove("removing"); return toast(friendly(error), true); }
  if (rowEl && !reduceMotion) await new Promise((r) => setTimeout(r, 280));
  await loadTasks();
  if ($("#modal-root .overlay")) closeModal();
  state.animate = false; route();
  toast(tx("رجعت المهمة للمهام"));
}
// gone for good (files included). Only the creator / their managers / admins.
async function purgeTask(t, rowEl = null) {
  const ok = await confirmDialog({ title: tx("حذف نهائي؟"), body: tx("«{title}» هتتحذف نهائيًا مع كل ملفاتها وتعليقاتها، ومش هتقدر ترجعها.", { title: t.title }), ok: tx("حذف نهائي") });
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
  state.archived = (state.archived || []).filter((x) => x.id !== t.id);
  if ($("#modal-root .overlay")) closeModal();
  route();
  toast("اتحذفت المهمة");
}
async function decideDelReq(r, approve) {
  if (approve && !(await confirmDialog({ title: tx("توافق على الحذف؟"), body: tx("المهمة هتتنقل للمهام المؤرشفة كمحذوفة، وتقدر ترجعها بعدين."), ok: tx("موافق، احذفها") }))) return;
  const { error } = await sb.rpc("decide_delete_request", { p_req: r.id, p_approve: approve });
  if (error) return toast(friendly(error), true);
  await loadTasks();
  if ($("#modal-root .overlay")) closeModal();
  state.animate = false; route();
  toast(approve ? tx("اتحذفت المهمة واتنقلت للمهام المؤرشفة") : tx("اترفض طلب الحذف"));
}
async function cancelDelReq(r) {
  const { error } = await sb.rpc("cancel_delete_request", { p_req: r.id });
  if (error) return toast(friendly(error), true);
  await loadTasks();
  if ($("#modal-root .overlay")) closeModal();
  state.animate = false; route();
  toast(tx("اتلغى طلب الحذف"));
}
const archBadge = (t) => `<span class="arch-badge ${t.archive_kind === "deleted" ? "del" : ""}">${icon(t.archive_kind === "deleted" ? "trash" : "archive", "sm")}${t.archive_kind === "deleted" ? tx("محذوفة") : tx("مؤرشفة")}<em>${tx("{name} · {when}", { name: esc(profile(t.archived_by)?.full_name || "—"), when: timeAgo(t.archived_at) })}</em></span>`;
const archRowActions = (t) =>
  `${canRestoreTask(t) ? `<button class="row-restore" data-restore="${t.id}" title="${tx("استرجاع")}" aria-label="${tx("استرجاع")}">${icon("restore", "sm")}<span>${tx("استرجاع")}</span></button>` : ""}` +
  `${canDeleteTask(t) ? `<button class="row-del" data-purge="${t.id}" title="${tx("حذف نهائي")}" aria-label="${tx("حذف نهائي")}">${icon("trash", "sm")}</button>` : ""}`;

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
      <div><h1>المشاريع</h1><p>${tx("{n} مشروع نشط", { n: active.length })}${archived.length ? " · " + tx("{n} مؤرشف", { n: archived.length }) : ""}</p></div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        ${archived.length ? `<label class="check" style="margin:0"><input type="checkbox" id="show-arch" ${state.showArchived ? "checked" : ""}> إظهار المؤرشفة</label>` : ""}
        ${state.me.is_admin && all.length > 1 ? `<button class="btn" id="order-proj">${icon("sort")}${tx("ترتيب المشاريع")}</button>` : ""}
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
          ${canEditProject(p) ? `<button class="proj-edit" data-edit-proj="${p.id}" title="تعديل المشروع" aria-label="تعديل المشروع">${icon("edit", "sm")}<span>تعديل</span></button>` : ""}
          <div class="proj-top">
            ${ring(s.progress, p.color)}
            <div class="grow"><h3><span class="proj-no">${String(all.indexOf(p) + 1).padStart(2, "0")}</span>${esc(p.name)}</h3><p>${esc(p.description || (p.status === "archived" ? "مشروع مؤرشف" : "بدون وصف"))}</p></div>
          </div>
          <div class="proj-meta">
            <span>${icon("inbox", "sm")}${tx("{n} مفتوحة", { n: s.open })}</span>
            <span>${icon("check", "sm")}${tx("{n} مكتملة", { n: s.done })}</span>
            ${s.overdue ? `<span class="bad">${icon("flame", "sm")}${tx("{n} متأخرة", { n: s.overdue })}</span>` : ""}
          </div>
          <div class="proj-foot">
            <span>${lead ? tx("المسؤول: {name}", { name: esc(lead.full_name) }) : "بدون مسؤول"}</span>
            <span class="avatars">${ppl.slice(0, 5).map((x) => avatar(x, "sm")).join("")}${ppl.length > 5 ? `<span class="more">+${ppl.length - 5}</span>` : ""}</span>
          </div>
        </div>`;
      }).join("")}
    </div>` : `<div class="empty"><div class="ill">${icon("projects")}</div><b>مفيش مشاريع لسه</b>${canCreate ? 'اضغط "مشروع جديد" وابدأ تنظم مهام الفريق.' : "المدير هو اللي بيضيف المشاريع."}</div>`}`;

  const np = $("#new-proj"); if (np) np.onclick = () => openProjectModal();
  const op = $("#order-proj"); if (op) op.onclick = openProjectOrder;
  const sa = $("#show-arch"); if (sa) sa.onchange = (e) => { state.showArchived = e.target.checked; state.animate = true; route(); };
  $$("[data-proj]").forEach((c) => {
    const go = () => { location.hash = `#/tasks?project=${c.dataset.proj}`; };
    c.onclick = (e) => { if (!e.target.closest("[data-edit-proj]")) go(); };
    c.onkeydown = (e) => { if (e.key === "Enter" && e.target === c) go(); };
  });
  $$("[data-edit-proj]").forEach((b) => b.onclick = (e) => { e.stopPropagation(); openProjectModal(project(b.dataset.editProj)); });
}

// Drag rows by their grip to reorder them; onDrop gets the new order of row ids (data-sub / data-id)
function wireDragList(box, rowSel, onDrop) {
  box.addEventListener("pointerdown", (e) => {
    const grip = e.target.closest(".sub-grip, .ns-grip"); if (!grip || !box.contains(grip)) return;
    const row = grip.closest(rowSel); if (!row) return;
    e.preventDefault();
    row.classList.add("dragging"); row.setPointerCapture(e.pointerId);
    let lastY = e.clientY;
    const onMove = (ev) => {
      const dy = ev.clientY - lastY; row.style.transform = `translateY(${dy}px)`;
      const sib = dy < 0 ? row.previousElementSibling : row.nextElementSibling;
      if (!sib || !sib.matches(rowSel)) return;
      const sr = sib.getBoundingClientRect(), rr = row.getBoundingClientRect();
      if ((dy < 0 && rr.top < sr.top + sr.height / 2) || (dy > 0 && rr.bottom > sr.top + sr.height / 2)) {
        dy < 0 ? sib.before(row) : sib.after(row);
        lastY = ev.clientY; row.style.transform = "";
      }
    };
    const onUp = () => {
      row.removeEventListener("pointermove", onMove); row.classList.remove("dragging"); row.style.transform = "";
      onDrop($$(rowSel, box).map((r) => r.dataset.sub || r.dataset.id));
    };
    row.addEventListener("pointermove", onMove);
    row.addEventListener("pointerup", onUp, { once: true });
    row.addEventListener("pointercancel", onUp, { once: true });
  });
}

// Admin: drag (or use the arrows) to set the project order; it's used on every page
function openProjectOrder() {
  let list = [...state.projects];
  const ov = openModal(`
    <h2>${tx("ترتيب المشاريع")}</h2>
    <p class="meta" style="margin:-4px 0 14px">${tx("اسحب المشروع أو استخدم الأسهم. الترتيب ده هيظهر بيه في كل السستم: المهام، والتقرير الأسبوعي، والملفات.")}</p>
    <ol class="po-list" id="po-list"></ol>
    <p class="err" id="po-err"></p>
    <div class="modal-foot"><span class="spacer"></span>
      <button type="button" class="btn ghost" data-close>إلغاء</button>
      <button type="button" class="btn primary" id="po-save">${icon("check", "sm")}${tx("حفظ الترتيب")}</button>
    </div>`, { label: tx("ترتيب المشاريع") });
  const box = $("#po-list", ov);
  const draw = (focusId) => {
    box.innerHTML = list.map((p, i) => `
      <li class="po-row ${p.status === "archived" ? "archived" : ""}" data-id="${p.id}" style="--c:${esc(p.color || "#0B6FC4")}">
        <span class="po-grip" aria-hidden="true">${icon("grip", "sm")}</span>
        <b class="po-no">${String(i + 1).padStart(2, "0")}</b>
        <i class="po-dot"></i>
        <span class="po-name">${esc(p.name)}${p.status === "archived" ? ` <small>${tx("(مؤرشف)")}</small>` : ""}</span>
        <button type="button" class="icon-btn" data-up="${i}" ${i ? "" : "disabled"} aria-label="${tx("لفوق")}">${icon("chev", "sm")}</button>
        <button type="button" class="icon-btn po-down" data-down="${i}" ${i < list.length - 1 ? "" : "disabled"} aria-label="${tx("لتحت")}">${icon("chev", "sm")}</button>
      </li>`).join("");
    const move = (i, d) => { const [x] = list.splice(i, 1); list.splice(i + d, 0, x); draw(x.id); };
    $$("[data-up]", box).forEach((b) => b.onclick = () => move(+b.dataset.up, -1));
    $$("[data-down]", box).forEach((b) => b.onclick = () => move(+b.dataset.down, 1));
    if (focusId) { const r = $(`[data-id="${focusId}"]`, box); r?.classList.add("moved"); r?.scrollIntoView({ block: "nearest" }); }
  };
  // pointer drag on the grip: swap with neighbours as the row passes their middle
  box.addEventListener("pointerdown", (e) => {
    const grip = e.target.closest(".po-grip"); if (!grip) return;
    const row = grip.closest(".po-row"); e.preventDefault();
    row.classList.add("dragging"); row.setPointerCapture(e.pointerId);
    let lastY = e.clientY;
    const onMove = (ev) => {
      const dy = ev.clientY - lastY; row.style.transform = `translateY(${dy}px)`;
      const sib = dy < 0 ? row.previousElementSibling : row.nextElementSibling;
      if (!sib) return;
      const sr = sib.getBoundingClientRect(), rr = row.getBoundingClientRect();
      if ((dy < 0 && rr.top < sr.top + sr.height / 2) || (dy > 0 && rr.bottom > sr.top + sr.height / 2)) {
        dy < 0 ? sib.before(row) : sib.after(row);
        lastY = ev.clientY; row.style.transform = "";
        $$(".po-row", box).forEach((r, i) => { $(".po-no", r).textContent = String(i + 1).padStart(2, "0"); });
      }
    };
    const onUp = () => {
      row.removeEventListener("pointermove", onMove); row.classList.remove("dragging"); row.style.transform = "";
      const ids = $$(".po-row", box).map((r) => r.dataset.id);
      list = ids.map((id) => list.find((p) => p.id === id)); draw(row.dataset.id);
    };
    row.addEventListener("pointermove", onMove);
    row.addEventListener("pointerup", onUp, { once: true });
    row.addEventListener("pointercancel", onUp, { once: true });
  });
  draw();
  $("[data-close]", ov).onclick = closeModal;
  $("#po-save", ov).onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true;
    const { error } = await sb.rpc("reorder_projects", { p_ids: list.map((p) => p.id) });
    if (error) { b.disabled = false; $("#po-err", ov).textContent = friendly(error); return; }
    await loadProjects(); closeModal(); state.animate = true; route(); toast(tx("اتحفظ ترتيب المشاريع"));
  };
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
        ${!isNew && canDeleteProject(p) ? `<button type="button" class="btn danger ghost" id="del-proj">حذف المشروع</button>` : ""}<span class="spacer"></span>
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
    const ok = await confirmDialog({ title: tx("حذف مشروع «{name}»؟", { name: p.name }), body: n ? tx("المهام ({n}) مش هتتحذف، هتفضل من غير مشروع.", { n }) : "", ok: "حذف" });
    if (!ok) return;
    const { data, error } = await sb.from("projects").delete().eq("id", p.id).select("id");
    if (error) return err(friendly(error));
    if (!data?.length) return err("مش مسموح لك تحذف المشروع ده");
    await Promise.all([loadProjects(), loadTasks()]);
    closeModal(); state.animate = true; route(); toast("اتحذف المشروع");
  };
}

/* =====================================================================
   Preferences sync (language + theme follow the account)
   ===================================================================== */
function syncPrefsFromProfile() {
  const me = state.me;
  if (me.pref_lang && me.pref_lang !== LANG) setLang(me.pref_lang);
  if (me.pref_theme && me.pref_theme !== THEME) setTheme(me.pref_theme);
  if (!me.pref_lang || !me.pref_theme) savePrefs();
}
function savePrefs() {
  if (!state.me) return;
  sb.from("profiles").update({ pref_lang: LANG, pref_theme: THEME }).eq("id", state.me.id)
    .then(({ error }) => { if (!error) { state.me.pref_lang = LANG; state.me.pref_theme = THEME; } });
}

function timeAgo(d) {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return tx("دلوقتي");
  if (s < 3600) return tx("من {n} دقيقة", { n: Math.floor(s / 60) });
  if (s < 86400) return tx("من {n} ساعة", { n: Math.floor(s / 3600) });
  if (s < 86400 * 7) return tx("من {n} يوم", { n: Math.floor(s / 86400) });
  return fmtDate(d);
}
const debounced = (() => { const timers = new Map(); return (fn, ms = 250) => { clearTimeout(timers.get(fn)); timers.set(fn, setTimeout(fn, ms)); }; })();

/* =====================================================================
   Notifications
   ===================================================================== */
async function loadNotifs() {
  const { data, error } = await sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(60);
  if (!error) state.notifs = data || [];
}
const unreadCount = () => state.notifs.filter((n) => !n.read_at).length;

function notifText(n) {
  const actor = `<b>${esc(profile(n.actor_id)?.full_name || tx("حد من الفريق"))}</b>`;
  const title = `<b>«${esc(n.data?.title || "")}»</b>`;
  switch (n.type) {
    case "assigned": return tx("{actor} أسند لك مهمة {title}", { actor, title });
    case "comment": return tx("{actor} علّق على {title}", { actor, title });
    case "completed": return tx("{actor} خلّص مهمة {title}", { actor, title });
    case "due_soon": return tx("موعد تسليم {title} بكرة", { title });
    case "mention": return tx("{actor} عمل لك منشن في {title}", { actor, title });
    case "delete_request": return tx("{actor} طالب يحذف {title} — وافق أو ارفض", { actor, title }) + (n.data?.reason ? ` — ${esc(n.data.reason)}` : "");
    case "delete_decision": return n.data?.approved ? tx("{actor} وافق على حذف {title}", { actor, title }) : tx("{actor} رفض حذف {title}", { actor, title });
    case "absent": return tx("اتسجلت غايب عن استاند أب {day} ({pts} نقاط)", { day: `<b>${esc(n.data?.day ? fmtDayShort(n.data.day) : "")}</b>`, pts: PTS.absent });
    case "thanks": return tx("{actor} اداك {pts} نقطة شكر", { actor, pts: `<b>+${esc(n.data?.points ?? "")}</b>` }) + (n.data?.reason ? ` — ${esc(n.data.reason)}` : "");
    default: return title;
  }
}

function renderBell(ring = false) {
  const slot = $("#bell-slot");
  if (!slot) return;
  const n = unreadCount();
  slot.innerHTML = `<button class="icon-btn bell ${ring ? "ring" : ""}" id="bell" title="الإشعارات" aria-label="الإشعارات" aria-haspopup="dialog">${icon("bell")}${n ? `<span class="badge">${n > 9 ? "9+" : n}</span>` : ""}</button>`;
  $("#bell").onclick = (e) => { e.stopPropagation(); toggleNotifPanel(); };
  if ($("#notif-panel")) toggleNotifPanel(true);
}

function toggleNotifPanel(refresh = false) {
  let panel = $("#notif-panel");
  if (panel && !refresh) { panel.classList.add("closing"); setTimeout(() => panel.remove(), reduceMotion ? 0 : 160); return; }
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "notif-panel"; panel.className = "notif-panel";
    panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "الإشعارات");
    document.body.append(panel);
  }
  const items = state.notifs;
  panel.innerHTML = `
    <div class="np-head"><b>الإشعارات</b>${unreadCount() ? `<button class="btn ghost sm" id="np-read">تحديد الكل كمقروء</button>` : ""}</div>
    <div class="np-list">${items.length ? items.map((n) => {
      const actor = profile(n.actor_id);
      return `<button class="np-item ${n.read_at ? "" : "unread"}" data-n="${n.id}">
        <span class="np-ico t-${n.type}">${actor ? avatar(actor, "sm") : icon(n.type === "due_soon" ? "clock" : n.type === "absent" ? "calendar" : n.type === "thanks" ? "trophy" : "bell", "sm")}</span>
        <span class="np-body"><span class="np-text">${notifText(n)}</span>
          ${n.type === "comment" && n.data?.excerpt ? `<span class="np-ex">${esc(n.data.excerpt)}</span>` : ""}
          <small>${timeAgo(n.created_at)}</small></span>
      </button>`;
    }).join("") : `<div class="np-empty">${icon("bell")}<b>مفيش إشعارات</b><span>هتوصلك هنا لما حد يسند لك مهمة أو يعلّق عليها أو موعد يقرّب.</span></div>`}</div>`;
  const rd = $("#np-read", panel);
  if (rd) rd.onclick = async (e) => {
    e.stopPropagation();
    const now = new Date().toISOString();
    state.notifs.forEach((n) => { n.read_at = n.read_at || now; });
    renderBell();
    await sb.from("notifications").update({ read_at: now }).eq("user_id", state.me.id).is("read_at", null);
  };
  $$("[data-n]", panel).forEach((b) => b.onclick = async (e) => {
    e.stopPropagation();
    const n = state.notifs.find((x) => x.id === b.dataset.n);
    toggleNotifPanel();
    if (n && !n.read_at) {
      n.read_at = new Date().toISOString(); renderBell();
      sb.from("notifications").update({ read_at: n.read_at }).eq("id", n.id).then(() => {});
    }
    if (n && (n.type === "absent" || n.type === "thanks")) { state.att.tab = "me"; location.hash = "#/attendance"; if (currentRoute().page === "attendance") route(); }
    else if (n?.task_id && findTask(n.task_id)) openTask(n.task_id);
    else toast("المهمة دي مبقتش موجودة", true);
  });
}
document.addEventListener("click", (e) => {
  const p = $("#notif-panel");
  if (p && !p.contains(e.target) && !e.target.closest("#bell")) toggleNotifPanel();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#notif-panel")) toggleNotifPanel(); });

/* =====================================================================
   Task drawer extras: checklist, comments, activity (live)
   ===================================================================== */
let drawerCh = null, drawerDirty = false;
function cleanupDrawer() {
  if (drawerCh) { sb.removeChannel(drawerCh); drawerCh = null; }
  if (drawerDirty) {
    drawerDirty = false;
    loadTasks().then(() => { state.animate = false; route(); }).catch(console.error);
  }
}

const ACT_ICON = {
  created: "plus", status: "tasks", progress: "team", deadline: "calendar", title: "edit", priority: "flame",
  project: "projects", assigned: "users", unassigned: "users", file_added: "clip", file_removed: "clip",
  subtask_added: "checklist", subtask_done: "check", subtask_undone: "checklist",
  archived: "archive", deleted: "trash", restored: "restore", delete_requested: "trash", delete_rejected: "close",
};
function activityText(a) {
  const actor = `<b>${esc(profile(a.actor_id)?.full_name || tx("النظام"))}</b>`;
  const d = a.details || {};
  const q = (x) => `<b>«${esc(x ?? "")}»</b>`;
  const person = (id) => `<b>${esc(profile(id)?.full_name || "—")}</b>`;
  const st = (k) => `<span class="pill s-${esc(k)}">${tx(STATUS[k] || k)}</span>`;
  switch (a.action) {
    case "created": return tx("{a} أنشأ المهمة", { a: actor });
    case "status": return tx("{a} غيّر الحالة من {from} إلى {to}", { a: actor, from: st(d.from), to: st(d.to) });
    case "progress": return tx("{a} حدّث الإنجاز إلى {n}%", { a: actor, n: d.to });
    case "deadline": return d.to ? tx("{a} غيّر الموعد إلى {d}", { a: actor, d: `<b>${fmtDate(d.to)}</b>` }) : tx("{a} شال الموعد النهائي", { a: actor });
    case "title": return tx("{a} غيّر العنوان إلى {t}", { a: actor, t: q(d.to) });
    case "priority": return tx("{a} غيّر الأولوية إلى {p}", { a: actor, p: `<b>${tx(PRIORITY[d.to] || d.to)}</b>` });
    case "project": return d.to ? tx("{a} نقل المهمة لمشروع {p}", { a: actor, p: q(d.to) }) : tx("{a} شال المهمة من المشروع", { a: actor });
    case "assigned": return tx("{a} أسند المهمة إلى {u}", { a: actor, u: person(d.user_id) });
    case "unassigned": return tx("{a} شال {u} من المهمة", { a: actor, u: person(d.user_id) });
    case "file_added": return tx("{a} رفع ملف {f}", { a: actor, f: q(d.name) });
    case "file_removed": return tx("{a} حذف ملف {f}", { a: actor, f: q(d.name) });
    case "subtask_added": return tx("{a} أضاف خطوة {s}", { a: actor, s: q(d.title) });
    case "subtask_done": return tx("{a} خلّص خطوة {s}", { a: actor, s: q(d.title) });
    case "subtask_undone": return tx("{a} رجّع خطوة {s} لغير مكتملة", { a: actor, s: q(d.title) });
    case "archived": return tx("{a} أرشف المهمة", { a: actor });
    case "deleted": return tx("{a} حذف المهمة (اتنقلت للأرشيف)", { a: actor });
    case "restored": return tx("{a} رجّع المهمة من الأرشيف", { a: actor });
    case "delete_requested": return tx("{a} طلب حذف المهمة", { a: actor }) + (d.reason ? ` — ${q(d.reason)}` : "");
    case "delete_rejected": return tx("{a} رفض طلب الحذف", { a: actor });
    default: return esc(a.action);
  }
}

function wireDrawerExtras(t, ov, work) {
  const range = $("input[name=progress]", ov);

  // ---- checklist
  const subList = $("#sub-list", ov);
  let subs = [];
  const refreshProgress = async () => {
    const { data } = await sb.from("tasks").select("progress").eq("id", t.id).single();
    if (data && ov.isConnected) {
      const was = t.progress;
      t.progress = data.progress; range.value = data.progress; $("#pv", ov).textContent = data.progress + "%";
      if (data.progress === 100 && was !== 100 && work) ov._offerDone?.();
    }
  };
  const renderSubs = () => {
    if (!ov.isConnected) return;
    const done = subs.filter((x) => x.done).length;
    $("#sub-count", ov).textContent = subs.length ? `${done}/${subs.length}` : "";
    const bar = $("#sub-bar", ov);
    bar.hidden = !subs.length;
    if (subs.length) $("i", bar).style.width = (done * 100 / subs.length) + "%";
    const auto = subs.length > 0;
    range.disabled = auto || !work;
    $("#pv-hint", ov).hidden = !auto;
    subList.innerHTML = subs.length ? subs.map((x) => `
      <div class="sub ${x.done ? "done" : ""}" data-sub="${x.id}">
        ${work && subs.length > 1 ? `<span class="sub-grip" title="${tx("اسحب عشان تغيّر الترتيب")}" aria-hidden="true">${icon("grip", "sm")}</span>` : ""}
        <label><input type="checkbox" ${x.done ? "checked" : ""} ${work ? "" : "disabled"}><span class="box">${icon("check", "sm")}</span><span class="txt">${esc(x.title)}</span></label>
        ${work ? `<button type="button" class="sub-edit" data-sedit="${x.id}" aria-label="${tx("تعديل الخطوة")}" title="${tx("تعديل الخطوة")}">${icon("edit", "sm")}</button>
        <button type="button" class="sub-del" data-sdel="${x.id}" aria-label="حذف الخطوة">${icon("close", "sm")}</button>` : ""}
      </div>`).join("")
      : `<p class="meta" style="margin:0">مفيش خطوات لسه. قسّم المهمة لخطوات صغيرة ونسبة الإنجاز هتتحسب لوحدها.</p>`;
    $$("input[type=checkbox]", subList).forEach((cb) => cb.onchange = async () => {
      const id = cb.closest("[data-sub]").dataset.sub, it = subs.find((x) => x.id === id);
      it.done = cb.checked; renderSubs(); drawerDirty = true;
      const { error } = await sb.from("task_subtasks").update({ done: it.done }).eq("id", id);
      if (error) { it.done = !it.done; renderSubs(); return toast(friendly(error), true); }
      refreshProgress();
    });
    $$("[data-sedit]", subList).forEach((b) => b.onclick = () => editSub(b.closest(".sub"), subs.find((x) => x.id === b.dataset.sedit)));
    $$("[data-sdel]", subList).forEach((b) => b.onclick = async () => {
      const id = b.dataset.sdel, row = b.closest(".sub");
      row.classList.add("removing");
      const { error } = await sb.from("task_subtasks").delete().eq("id", id);
      if (error) { row.classList.remove("removing"); return toast(friendly(error), true); }
      subs = subs.filter((x) => x.id !== id); drawerDirty = true; renderSubs(); refreshProgress();
    });
  };
  // rename a step in a small popup
  const editSub = async (row, it) => {
    if (!it) return;
    const v = await promptDialog({ title: tx("تعديل الخطوة"), label: tx("نص الخطوة"), value: it.title });
    if (v == null || v === it.title || !ov.isConnected) return;
    const old = it.title; it.title = v; renderSubs();
    const { error } = await sb.from("task_subtasks").update({ title: v }).eq("id", it.id);
    if (error) { it.title = old; renderSubs(); return toast(friendly(error), true); }
    drawerDirty = true; toast(tx("اتعدلت الخطوة"));
  };
  // reorder by dragging the grip; positions are saved as 0..n-1
  if (work) wireDragList(subList, ".sub", async (ids) => {
    const before = subs.map((x) => x.id).join();
    subs = ids.map((id) => subs.find((x) => x.id === id)).filter(Boolean);
    if (subs.map((x) => x.id).join() === before) return;
    renderSubs();
    const changed = subs.map((x, i) => ({ x, i })).filter(({ x, i }) => x.position !== i);
    const res = await Promise.all(changed.map(({ x, i }) => sb.from("task_subtasks").update({ position: i }).eq("id", x.id)));
    const err = res.find((r) => r.error)?.error;
    if (err) { toast(friendly(err), true); return loadSubs(); }
    changed.forEach(({ x, i }) => { x.position = i; });
    drawerDirty = true;
  });
  const loadSubs = async () => {
    const { data } = await sb.from("task_subtasks").select("*").eq("task_id", t.id).order("position").order("created_at");
    subs = data || []; renderSubs();
  };
  const addInput = $("#sub-new", ov);
  const addSub = async () => {
    const title = addInput.value.trim();
    if (!title) return;
    addInput.value = ""; addInput.focus();
    const pos = subs.reduce((m, x) => Math.max(m, (x.position ?? 0) + 1), subs.length);
    const { data, error } = await sb.from("task_subtasks").insert({ task_id: t.id, title, position: pos }).select().single();
    if (error) return toast(friendly(error), true);
    if (!subs.some((x) => x.id === data.id)) subs.push(data);
    drawerDirty = true; renderSubs(); refreshProgress();
  };
  if (addInput) {
    addInput.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); addSub(); } };
    $("#sub-add-btn", ov).onclick = addSub;
  }

  // ---- comments
  const cList = $("#c-list", ov);
  const loadComments = async () => {
    const { data, error } = await sb.from("task_comments").select("*").eq("task_id", t.id).order("created_at");
    if (!ov.isConnected) return;
    if (error) { cList.innerHTML = `<p class="err">${esc(friendly(error))}</p>`; return; }
    $("#c-count", ov).textContent = data.length || "";
    cList.innerHTML = data.length ? data.map((c) => {
      const u = profile(c.user_id), mine = c.user_id === state.me.id;
      return `<div class="comment ${mine ? "mine" : ""}">${avatar(u, "sm")}
        <div class="c-body"><div class="c-meta"><b>${esc(u?.full_name || "—")}</b><small title="${fmtDateTime(c.created_at)}">${timeAgo(c.created_at)}</small>
          ${mine || state.me.is_admin ? `<button class="c-del" data-cdel="${c.id}" aria-label="حذف التعليق">${icon("trash", "sm")}</button>` : ""}</div>
          <p>${commentHtml(c)}</p></div></div>`;
    }).join("") : `<p class="meta" style="margin:0 0 12px">مفيش تعليقات لسه. ابدأ النقاش هنا.</p>`;
    cList.scrollTop = cList.scrollHeight;
    $$("[data-cdel]", cList).forEach((b) => b.onclick = async () => {
      const { error: e2 } = await sb.from("task_comments").delete().eq("id", b.dataset.cdel);
      if (e2) return toast(friendly(e2), true);
      loadComments();
    });
  };
  const cForm = $("#c-form", ov), ta = cForm && $("textarea", cForm);
  if (cForm) {
  const mention = wireMentions(ta, cForm, mentionCandidates(t));
  ta.addEventListener("keydown", (e) => { if (e.defaultPrevented) return; if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); cForm.requestSubmit(); } });
  ta.oninput = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 180) + "px"; };
  cForm.onsubmit = async (e) => {
    e.preventDefault();
    const body = ta.value.trim();
    if (!body) return;
    const btn = $("button", cForm); btn.disabled = true;
    const { error } = await sb.from("task_comments").insert({ task_id: t.id, body, user_id: state.me.id, mentions: mention.ids(body) });
    btn.disabled = false;
    if (error) return toast(friendly(error), true);
    ta.value = ""; ta.style.height = ""; mention.reset();
    drawerDirty = true;
    loadComments();
  };
  }

  // ---- activity
  const aList = $("#a-list", ov);
  const loadActivity = async () => {
    const { data } = await sb.from("task_activity").select("*").eq("task_id", t.id).order("created_at", { ascending: false }).limit(100);
    if (!ov.isConnected) return;
    aList.innerHTML = (data || []).length ? data.map((a) => `
      <div class="tl-item"><span class="tl-dot a-${esc(a.action)}">${icon(ACT_ICON[a.action] || "history", "sm")}</span>
        <div><p>${activityText(a)}</p><small>${timeAgo(a.created_at)} · ${fmtDateTime(a.created_at)}</small></div></div>`).join("")
      : `<p class="meta">مفيش نشاط مسجل.</p>`;
  };

  // ---- tabs
  $$("[data-dtab]", ov).forEach((b) => b.onclick = () => {
    $$("[data-dtab]", ov).forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", String(x === b)); });
    $("#dtab-comments", ov).hidden = b.dataset.dtab !== "comments";
    $("#dtab-activity", ov).hidden = b.dataset.dtab !== "activity";
    if (b.dataset.dtab === "activity") loadActivity();
  });

  loadSubs(); loadComments();
  drawerCh = sb.channel("task-" + t.id)
    .on("postgres_changes", { event: "*", schema: "public", table: "task_comments", filter: `task_id=eq.${t.id}` }, () => debounced(loadComments))
    .on("postgres_changes", { event: "*", schema: "public", table: "task_subtasks", filter: `task_id=eq.${t.id}` }, () => debounced(loadSubs))
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "task_activity", filter: `task_id=eq.${t.id}` }, () => {
      if (!$("#dtab-activity", ov)?.hidden) debounced(loadActivity);
    })
    .subscribe();
}

/* =====================================================================
   Task numbers + task links (blocked by / follow-up of)
   ===================================================================== */
const tnoHtml = (t) => t?.task_no ? `<span class="tno" dir="ltr">#${t.task_no}</span>` : "";
const LINK_KINDS = {
  blocked_by: { out: "متوقفة على", in: "مستنياها", ic: "lock" },
  follows: { out: "تكميلية لـ", in: "ليها تكملة", ic: "link" },
};
async function loadLinks() {
  const { data, error } = await sb.from("task_links").select("*");
  state.linksReady = !error; // false until DB migration v18 adds the table
  if (error) { state.links = []; state.linkBrief = new Map(); return; }
  state.links = data || [];
  // the other end of a link may be a task I can't open: fetch just its number/title/status
  const known = new Set(state.tasks.map((t) => t.id));
  const missing = [...new Set(state.links.flatMap((l) => [l.task_id, l.other_id]))].filter((id) => !known.has(id));
  state.linkBrief = new Map();
  if (missing.length) {
    const { data: brief } = await sb.rpc("linked_tasks_brief", { p_ids: missing });
    (brief || []).forEach((b) => state.linkBrief.set(b.id, { ...b, hidden: true }));
  }
}
const taskLite = (id) => state.tasks.find((t) => t.id === id) || state.linkBrief?.get(id) || null;
// every link touching a task, seen from that task's side
function linksOf(id) {
  return (state.links || []).filter((l) => l.task_id === id || l.other_id === id).map((l) => {
    const out = l.task_id === id, otherId = out ? l.other_id : l.task_id;
    return { l, out, otherId, other: taskLite(otherId), label: LINK_KINDS[l.kind][out ? "out" : "in"], ic: LINK_KINDS[l.kind].ic };
  });
}
// unfinished tasks this one is waiting on
const blockersOf = (t) => linksOf(t.id).filter((x) => x.out && x.l.kind === "blocked_by" && x.other && x.other.status !== "done");

function linkChipsHtml(t) {
  const ls = linksOf(t.id);
  if (!ls.length) return "";
  const bl = blockersOf(t);
  if (bl.length) return `<span class="kb-blocked" title="${esc(bl.map((x) => `#${x.other.task_no} ${x.other.title}`).join("\n"))}">${icon("lock", "sm")}${tx("متوقفة على")} <bdi dir="ltr">${bl.map((x) => "#" + x.other.task_no).join(" ")}</bdi></span>`;
  return `<span class="kb-links" title="${esc(ls.map((x) => `${tx(x.label)} #${x.other?.task_no ?? "?"}`).join("\n"))}">${icon("link", "sm")}${ls.length}</span>`;
}

// search box that picks a task (by #number or title)
function wireTaskPicker(root, { exclude = new Set(), onPick }) {
  const input = $(".tp-input", root), box = $(".tp-results", root);
  const render = () => {
    const raw = input.value.trim().toLowerCase().replace(/^#/, "");
    if (!raw) { box.hidden = true; box.innerHTML = ""; return; }
    const hits = state.tasks.filter((t) => !exclude.has(t.id) && (String(t.task_no || "") === raw || String(t.task_no || "").startsWith(raw) && /^\d+$/.test(raw) || t.title.toLowerCase().includes(raw)))
      .sort((a, b) => (String(b.task_no) === raw) - (String(a.task_no) === raw) || (b.task_no || 0) - (a.task_no || 0)).slice(0, 8);
    box.hidden = false;
    box.innerHTML = hits.length ? hits.map((t) => `<button type="button" class="tp-hit" data-tp="${t.id}">${tnoHtml(t)}<span>${esc(t.title)}</span>${statusPill(t)}</button>`).join("")
      : `<p class="meta" style="margin:8px 10px">${tx("مفيش مهمة بالرقم أو الاسم ده")}</p>`;
    $$("[data-tp]", box).forEach((b) => b.onmousedown = (e) => { e.preventDefault(); input.value = ""; box.hidden = true; onPick(b.dataset.tp); });
  };
  input.oninput = render;
  input.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); $("[data-tp]", box)?.dispatchEvent(new MouseEvent("mousedown")); } if (e.key === "Escape" && !box.hidden) { e.stopPropagation(); box.hidden = true; } };
  input.onblur = () => setTimeout(() => { box.hidden = true; }, 150);
}
const linkAddHtml = () => `
  <div class="link-add">
    <select class="input" name="link_kind" aria-label="${tx("نوع الربط")}">
      <option value="blocked_by">${tx("متوقفة على")}</option><option value="follows">${tx("تكميلية لـ")}</option>
    </select>
    <div class="tp"><div class="input-icon">${icon("search", "sm")}<input class="input tp-input" placeholder="${tx("رقم المهمة أو اسمها")}" autocomplete="off" aria-label="${tx("رقم المهمة أو اسمها")}"></div><div class="tp-results" hidden></div></div>
  </div>`;

// drawer section: list + add/remove links
function wireTaskLinks(t, ov, work) {
  const box = $("#links-box", ov);
  if (!box) return;
  const draw = () => {
    if (!ov.isConnected) return;
    const ls = linksOf(t.id), bl = blockersOf(t);
    $("#links-count", ov).textContent = ls.length || "";
    $("#blocked-banner", ov).innerHTML = bl.length && t.status !== "done"
      ? `<div class="blocked-banner">${icon("lock", "sm")}<span>${tx("المهمة دي متوقفة على {list} اللي لسه ماخلصتش", { list: bl.map((x) => `<b dir="ltr">#${x.other.task_no}</b> «${esc(x.other.title)}»`).join("، ") })}</span></div>` : "";
    $(".link-list", box).innerHTML = ls.length ? ls.map((x) => `
      <div class="link-row ${x.other?.status === "done" ? "done" : ""}">
        <span class="link-kind k-${x.l.kind}">${icon(x.ic, "sm")}${tx(x.label)}</span>
        ${x.other ? `<button type="button" class="link-open" ${x.other.hidden ? "disabled" : `data-lopen="${x.otherId}"`}>${tnoHtml(x.other)}<span>${esc(x.other.title)}</span></button>${x.other.hidden ? `<span class="pill s-${x.other.status}">${STATUS[x.other.status] || ""}</span>` : statusPill(x.other)}`
          : `<span class="meta" style="margin:0">${tx("مهمة مش متاحة")}</span>`}
        ${work ? `<button type="button" class="sub-del" data-lrm="${x.l.id}" aria-label="${tx("فك الربط")}" title="${tx("فك الربط")}">${icon("close", "sm")}</button>` : ""}
      </div>`).join("") : `<p class="meta" style="margin:0">${tx("مش مرتبطة بأي مهمة. اربطها بمهمة متوقفة عليها أو بتكمّلها.")}</p>`;
    $$("[data-lopen]", box).forEach((b) => b.onclick = () => openTask(b.dataset.lopen));
    $$("[data-lrm]", box).forEach((b) => b.onclick = async () => {
      const { error } = await sb.from("task_links").delete().eq("id", b.dataset.lrm);
      if (error) return toast(friendly(error), true);
      state.links = state.links.filter((l) => l.id !== b.dataset.lrm); draw();
    });
    if (work) {
      const ex = new Set([t.id, ...ls.map((x) => x.otherId)]);
      wireTaskPicker($(".link-add", box), { exclude: ex, onPick: async (otherId) => {
        const kind = $("select[name=link_kind]", box).value;
        const { data, error } = await sb.from("task_links").insert({ task_id: t.id, other_id: otherId, kind }).select().single();
        if (error) return toast(error.code === "23505" ? tx("المهمتين مربوطين ببعض بالفعل") : friendly(error), true);
        state.links.push(data); draw(); toast(tx("اتربطت المهمة"));
      } });
    }
  };
  draw();
}

/* =====================================================================
   Kanban board
   ===================================================================== */
// the board became the default view (Trello-style); reset an older saved "list" choice once
try { if (!localStorage.getItem("dtt.view.v2")) { localStorage.removeItem("dtt.view"); localStorage.setItem("dtt.view.v2", "1"); } } catch { /* ignore */ }
const getView = () => { try { return localStorage.getItem("dtt.view") === "list" ? "list" : "board"; } catch { return "board"; } };
const setView = (v) => { try { localStorage.setItem("dtt.view", v); } catch { /* ignore */ } };

function kbCard(t) {
  const p = project(t.project_id), drag = canWorkOn(t);
  return `<article class="kb-card ${t.status === "done" ? "done" : ""} ${drag ? "can-drag" : ""}" data-id="${t.id}" tabindex="0" role="button" aria-label="${esc(t.title)}" style="${p ? `--c:${esc(p.color)}` : ""}">
    <div class="kb-top">${p ? projChip(p) : ""}${tnoHtml(t)}</div>
    <b>${esc(t.title)}</b>
    ${isMentioned(t) ? `<span class="kb-mention">${icon("at", "sm")}${tx("عملولك منشن")}</span>` : ""}
    ${linkChipsHtml(t)}
    <div class="kb-meta">${deadlineCell(t)}<span class="prio prio-${t.priority}">● ${PRIORITY[t.priority]}</span></div>
    <div class="kb-foot">${avatarsCell(t.assignees)}<span class="progress"><span class="bar ${t.status === "done" ? "done" : ""}"><i style="width:${t.progress}%"></i></span><span class="num">${t.progress}%</span></span></div>
  </article>`;
}
const BOARD_COLS = ["todo", "in_progress", "review", "done", "blocked"];
// on a single project's board the columns are that project's own; otherwise one column per status kind
function boardHtml(list) {
  const pid = state.view.project && project(state.view.project) ? state.view.project : null;
  const custom = pid ? projCols(pid) : [];
  const canCols = !!pid && isManager();
  const cols = custom.length
    ? custom.map((c) => ({ key: c.id, name: esc(c.name), color: c.color, kind: c.kind, col: c, items: list.filter((t) => taskCol(t)?.id === c.id) }))
    : BOARD_COLS.map((k) => ({ key: k, name: STATUS[k], color: null, kind: k, items: list.filter((t) => t.status === k) }));
  return `<div class="board ${state.animate ? "stagger" : ""} ${custom.length ? "custom" : ""}" id="board" data-mode="${custom.length ? "custom" : "kind"}">${cols.map((c, ci) => `
    <section class="kb-col c-${c.kind}" data-col="${c.key}" style="--i:${ci};${c.color ? `--tone:${esc(c.color)}` : ""}" aria-label="${c.name}">
      <header>
        <span class="kb-title"><i class="kb-dot"></i><span class="kb-name">${c.name}</span><span class="kb-n">${c.items.length}</span></span>
        <span class="kb-tools">
          <button class="kb-icon" data-add="${c.key}" title="${tx("إضافة مهمة")}" aria-label="${tx("إضافة مهمة")}">${icon("plus", "sm")}</button>
          ${canCols ? `<button class="kb-icon" data-colmenu="${c.key}" title="${tx("خيارات العمود")}" aria-label="${tx("خيارات العمود")}">${icon("dots", "sm")}</button>` : ""}
        </span>
      </header>
      <div class="kb-drop">${c.items.map(kbCard).join("")}<div class="kb-empty" ${c.items.length ? "hidden" : ""}>${tx("اسحب مهمة هنا")}</div></div>
    </section>`).join("")}
    ${canCols ? `<button class="kb-col-add" id="kb-col-add">${icon("plus")}<span>${tx("إضافة عمود")}</span></button>` : ""}
  </div>`;
}
const COL_COLORS = ["#64748B", "#0B6FC4", "#0E9AA7", "#7A4FD0", "#C2410C", "#D97706", "#17996A", "#D13B47", "#DB2777", "#334155"];
function openColModal(pid, col = null) {
  const isNew = !col;
  const color = col?.color || COL_COLORS[projCols(pid).length % COL_COLORS.length];
  const ov = openModal(`
    <h2>${isNew ? tx("عمود جديد") : tx("تعديل العمود")}</h2>
    <form id="colf">
      <label class="field"><span>${tx("اسم الحالة")}</span><input class="input" name="name" maxlength="40" required value="${esc(col?.name || "")}" placeholder="${tx("مثلاً: تصميم، اختبار، جاهز للنشر")}"></label>
      <div class="field"><span>${tx("اللون")}</span>
        <div class="swatches" role="radiogroup" aria-label="${tx("اللون")}">
          ${COL_COLORS.map((c) => `<label style="--c:${c}"><input type="radio" name="color" value="${c}" ${c.toLowerCase() === color.toLowerCase() ? "checked" : ""} aria-label="${c}"><span></span></label>`).join("")}
          <label class="sw-custom" title="${tx("لون تاني")}"><input type="color" name="custom" value="${esc(color)}" aria-label="${tx("لون تاني")}"></label>
        </div></div>
      <label class="field"><span>${tx("بتتحسب في التقارير كـ")}</span>
        <select class="input" name="kind">${BOARD_COLS.map((k) => `<option value="${k}" ${(col?.kind || "in_progress") === k ? "selected" : ""}>${STATUS[k]}</option>`).join("")}</select>
        <small class="hint">${tx("المهام اللي في عمود من نوع «مكتملة» بتتحسب مخلّصة.")}</small></label>
      <p class="err" id="colf-err"></p>
      <div class="modal-foot"><span class="spacer"></span>
        <button type="button" class="btn ghost" data-close>إلغاء</button>
        <button class="btn primary" type="submit">${isNew ? tx("إضافة العمود") : tx("حفظ")}</button>
      </div>
    </form>`, { label: isNew ? tx("عمود جديد") : tx("تعديل العمود") });
  $("[data-close]", ov).onclick = closeModal;
  const custom = $("input[name=custom]", ov);
  custom.oninput = () => $$("input[name=color]", ov).forEach((r) => { r.checked = false; });
  $$("input[name=color]", ov).forEach((r) => r.onchange = () => { custom.value = r.value; });
  $("#colf", ov).onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const picked = $("input[name=color]:checked", ov)?.value || custom.value;
    const row = { name: String(f.get("name")).trim(), color: picked, kind: f.get("kind") };
    if (!row.name) return;
    const btn = e.submitter; btn.disabled = true;
    const q = isNew
      ? sb.from("task_statuses").insert({ ...row, project_id: pid, position: Math.max(-1, ...projCols(pid).map((c) => c.position)) + 1 }).select().single()
      : sb.from("task_statuses").update(row).eq("id", col.id).select().single();
    const { data, error } = await q;
    if (error || !data) { btn.disabled = false; $("#colf-err", ov).textContent = error ? friendly(error) : tx("مش مسموح لك تعدّل الأعمدة"); return; }
    state.statuses = state.statuses.filter((c) => c.id !== data.id).concat(data);
    if (!isNew && data.kind !== col.kind) await loadTasks(); // tasks in it changed kind on the server
    closeModal(); toast(isNew ? tx("اتضاف العمود") : tx("اتحفظ العمود"));
    state.animate = false; renderTasks(); afterRender();
  };
}
function openColMenu(btn, colId) {
  $("#col-menu")?.remove();
  const c = colById(colId); if (!c) return;
  const cols = projCols(c.project_id), i = cols.findIndex((x) => x.id === c.id);
  const m = document.createElement("div");
  m.id = "col-menu"; m.className = "col-menu"; m.setAttribute("role", "menu");
  const prevLbl = document.dir === "rtl" ? tx("حرّكه يمين") : tx("حرّكه شمال"), nextLbl = document.dir === "rtl" ? tx("حرّكه شمال") : tx("حرّكه يمين");
  m.innerHTML = `
    <button role="menuitem" data-cm="edit">${icon("edit", "sm")}${tx("تعديل الاسم واللون")}</button>
    ${i > 0 ? `<button role="menuitem" data-cm="prev">${icon("chev", "sm")}${prevLbl}</button>` : ""}
    ${i < cols.length - 1 ? `<button role="menuitem" data-cm="next">${icon("chev", "sm")}${nextLbl}</button>` : ""}
    ${cols.length > 1 ? `<button role="menuitem" class="danger" data-cm="del">${icon("trash", "sm")}${tx("مسح العمود")}</button>` : ""}`;
  document.body.appendChild(m);
  const r = btn.getBoundingClientRect(), w = m.offsetWidth;
  m.style.top = `${r.bottom + 6}px`;
  m.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, document.dir === "rtl" ? r.left : r.right - w))}px`;
  const close = () => { m.remove(); removeEventListener("pointerdown", outside, true); };
  const outside = (e) => { if (!m.contains(e.target) && e.target !== btn) close(); };
  setTimeout(() => addEventListener("pointerdown", outside, true));
  m.onclick = async (e) => {
    const a = e.target.closest("[data-cm]")?.dataset.cm; if (!a) return;
    close();
    if (a === "edit") return openColModal(c.project_id, c);
    if (a === "prev" || a === "next") {
      const other = cols[a === "prev" ? i - 1 : i + 1];
      const pa = c.position === other.position ? (a === "prev" ? other.position - 1 : other.position + 1) : other.position;
      const pb = c.position;
      const [r1, r2] = await Promise.all([
        sb.from("task_statuses").update({ position: pa }).eq("id", c.id),
        sb.from("task_statuses").update({ position: pb }).eq("id", other.id),
      ]);
      if (r1.error || r2.error) return toast(friendly(r1.error || r2.error), true);
      c.position = pa; other.position = pb;
      state.animate = false; renderTasks(); afterRender();
      return;
    }
    if (a === "del") openColDelete(c);
  };
}
function openColDelete(c) {
  const others = projCols(c.project_id).filter((x) => x.id !== c.id);
  const n = state.tasks.filter((t) => taskCol(t)?.id === c.id).length;
  const ov = openModal(`
    <h2>${tx("مسح عمود «{name}»؟", { name: esc(c.name) })}</h2>
    <form id="cdel">
      ${n ? `<label class="field"><span>${tx("فيه {n} مهمة — تتنقل لعمود:", { n })}</span>
        <select class="input" name="to">${others.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></label>`
        : `<p class="meta">${tx("العمود فاضي، مفيش مهام هتتأثر.")}</p><input type="hidden" name="to" value="${others[0].id}">`}
      <p class="err" id="cdel-err"></p>
      <div class="modal-foot"><span class="spacer"></span>
        <button type="button" class="btn ghost" data-close>إلغاء</button>
        <button class="btn btn-danger" type="submit">${icon("trash", "sm")}${tx("مسح العمود")}</button>
      </div>
    </form>`, { label: tx("مسح العمود") });
  $("[data-close]", ov).onclick = closeModal;
  $("#cdel", ov).onsubmit = async (e) => {
    e.preventDefault();
    const to = new FormData(e.target).get("to");
    const { error } = await sb.rpc("delete_task_status", { p_id: c.id, p_move_to: to });
    if (error) { $("#cdel-err", ov).textContent = friendly(error); return; }
    await Promise.all([loadStatuses(), loadTasks()]);
    closeModal(); toast(tx("اتمسح العمود"));
    state.animate = false; renderTasks(); afterRender();
  };
}
function sizeChat() {
  const c = $(".chat"); if (!c) return;
  if (matchMedia("(max-width: 960px)").matches) { c.style.height = ""; return; }
  const top = c.getBoundingClientRect().top + window.scrollY;
  let h = Math.max(420, Math.floor(innerHeight - top - 16));
  c.style.height = h + "px";
  // whatever still spills (page padding, footer) comes off the chat too, so the page never scrolls
  const over = document.documentElement.scrollHeight - innerHeight;
  if (over > 0 && h - over >= 420) c.style.height = (h - over) + "px";
}
function sizeBoard() {
  const b = $("#board"); if (!b) return;
  const mobile = matchMedia("(max-width: 960px)").matches;
  const top = b.getBoundingClientRect().top + window.scrollY;
  b.style.height = `max(440px, calc(100dvh - ${Math.round(top)}px - ${mobile ? 96 : 24}px))`;
}
let boardDrag = null, boardJustDragged = 0;
document.addEventListener("touchmove", (e) => { if (boardDrag?.active) e.preventDefault(); }, { passive: false });
function wireBoard() {
  sizeBoard();
  const board = $("#board"); if (!board) return;
  const customBoard = board.dataset.mode === "custom";
  $$("[data-add]", board).forEach((b) => b.onclick = () => customBoard ? openNewTask(colById(b.dataset.add)?.kind || "todo", b.dataset.add) : openNewTask(b.dataset.add));
  $$("[data-colmenu]", board).forEach((b) => b.onclick = (e) => { e.stopPropagation(); openColMenu(b, b.dataset.colmenu); });
  const addCol = $("#kb-col-add", board); if (addCol) addCol.onclick = () => openColModal(state.view.project);
  $$(".kb-card", board).forEach((c) => {
    c.onclick = () => { if (Date.now() - boardJustDragged < 350) return; openTask(c.dataset.id); };
    c.onkeydown = (e) => { if (e.key === "Enter") openTask(c.dataset.id); };
    if (!c.classList.contains("can-drag")) return;
    c.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || boardDrag) return;
      const touch = e.pointerType !== "mouse";
      const d = boardDrag = { card: c, id: c.dataset.id, from: c.closest(".kb-col").dataset.col, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, active: false, touch, pid: e.pointerId };
      const begin = () => {
        if (boardDrag !== d || d.active) return;
        d.active = true;
        const r = c.getBoundingClientRect();
        d.ox = d.sx - r.left; d.oy = d.sy - r.top;
        const g = d.ghost = c.cloneNode(true);
        g.classList.add("kb-ghost"); g.removeAttribute("tabindex");
        g.style.width = r.width + "px";
        document.body.appendChild(g);
        c.classList.add("kb-ph");
        board.classList.add("dragging");
        document.body.classList.add("kb-dragging");
        navigator.vibrate?.(12);
        place(d.x, d.y);
        tick();
      };
      if (touch) d.timer = setTimeout(begin, 260);
      const onMove = (ev) => {
        d.x = ev.clientX; d.y = ev.clientY;
        if (!d.active) {
          const dist = Math.hypot(d.x - d.sx, d.y - d.sy);
          if (touch) { if (dist > 10) cleanup(); return; }
          if (dist > 5) begin(); else return;
        }
        ev.preventDefault();
        place(d.x, d.y);
      };
      const onUp = () => {
        const wasActive = d.active, target = d.over;
        cleanup();
        if (!wasActive) return;
        boardJustDragged = Date.now();
        if (target && target !== d.from) (board.dataset.mode === "custom" ? moveTaskToCol(d.id, target) : moveTask(d.id, target));
        else { renderTasks(); afterRender(); }
      };
      function cleanup() {
        clearTimeout(d.timer); cancelAnimationFrame(d.raf);
        removeEventListener("pointermove", onMove); removeEventListener("pointerup", onUp); removeEventListener("pointercancel", onCancel);
        d.ghost?.remove(); c.classList.remove("kb-ph");
        $$(".kb-col.over", board).forEach((x) => x.classList.remove("over"));
        board.classList.remove("dragging"); document.body.classList.remove("kb-dragging");
        if (boardDrag === d) boardDrag = null;
      }
      const onCancel = () => { const was = d.active; cleanup(); if (was) { renderTasks(); afterRender(); } };
      addEventListener("pointermove", onMove, { passive: false });
      addEventListener("pointerup", onUp);
      addEventListener("pointercancel", onCancel);
      function place(x, y) {
        d.ghost && (d.ghost.style.transform = `translate(${x - d.ox}px, ${y - d.oy}px) rotate(${touch ? 2 : 3}deg)`);
        const under = document.elementFromPoint(x, y);
        const col = under?.closest?.(".kb-col");
        $$(".kb-col.over", board).forEach((k) => { if (k !== col) k.classList.remove("over"); });
        if (!col) return;
        col.classList.add("over");
        d.over = col.dataset.col;
        // move the placeholder to where it would land
        const drop = $(".kb-drop", col);
        const cards = $$(".kb-card:not(.kb-ph)", drop);
        const before = cards.find((k) => { const r = k.getBoundingClientRect(); return y < r.top + r.height / 2; });
        if (before) { if (c.nextElementSibling !== before) drop.insertBefore(c, before); }
        else if (c.parentElement !== drop || c.nextElementSibling !== $(".kb-empty", drop)) drop.insertBefore(c, $(".kb-empty", drop));
        $$(".kb-col", board).forEach((k) => { const n = $$(".kb-card", k).length; $(".kb-empty", k).hidden = n > 0; });
      }
      // auto-scroll the board sideways and the column up/down near the edges
      function tick() {
        if (boardDrag !== d || !d.active) return;
        const br = board.getBoundingClientRect(), edge = 60;
        if (d.x < br.left + edge) board.scrollLeft -= Math.ceil((br.left + edge - d.x) / (touch ? 7 : 4));
        else if (d.x > br.right - edge) board.scrollLeft += Math.ceil((d.x - (br.right - edge)) / (touch ? 7 : 4));
        const col = d.over && $(`.kb-col[data-col="${d.over}"] .kb-drop`, board);
        if (col) {
          const cr = col.getBoundingClientRect();
          if (d.y < cr.top + 40) col.scrollTop -= 8; else if (d.y > cr.bottom - 40) col.scrollTop += 8;
        }
        d.raf = requestAnimationFrame(tick);
        place(d.x, d.y);
      }
    });
  });
}
async function moveTask(id, status) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t || t.status === status) return;
  if (!canWorkOn(t)) return toast("مش مسموح لك تعمل الخطوة دي", true);
  const prev = { status: t.status, progress: t.progress, completed_at: t.completed_at };
  t.status = status;
  const sameKind = t.project_id && projCols(t.project_id).find((c) => c.kind === status);
  if (sameKind) t.status_id = sameKind.id;
  if (status === "done") { t.progress = 100; t.completed_at = new Date().toISOString(); } else t.completed_at = null;
  renderTasks(); afterRender();
  $(`.kb-card[data-id="${id}"]`)?.classList.add("landed");
  const { error } = await sb.from("tasks").update({ status }).eq("id", id);
  if (error) { Object.assign(t, prev); renderTasks(); afterRender(); return toast(friendly(error), true); }
  if (status === "done") toast(blockedWarn(t) || "برافو! المهمة اكتملت", !!blockedWarn(t));
}
const blockedWarn = (t) => { const bl = blockersOf(t); return bl.length ? tx("اتقفلت، بس خلي بالك: كانت متوقفة على {list} ولسه ماخلصتش", { list: bl.map((x) => "#" + x.other.task_no).join(" ") }) : ""; };

async function moveTaskToCol(id, colId) {
  const t = state.tasks.find((x) => x.id === id), c = colById(colId);
  if (!t || !c || t.status_id === colId) return;
  if (!canWorkOn(t)) return toast("مش مسموح لك تعمل الخطوة دي", true);
  const prev = { status: t.status, status_id: t.status_id, progress: t.progress, completed_at: t.completed_at };
  t.status_id = c.id; t.status = c.kind;
  if (c.kind === "done") { t.progress = 100; t.completed_at = new Date().toISOString(); } else t.completed_at = null;
  renderTasks(); afterRender();
  $(`.kb-card[data-id="${id}"]`)?.classList.add("landed");
  const { error } = await sb.from("tasks").update({ status_id: c.id }).eq("id", id);
  if (error) { Object.assign(t, prev); renderTasks(); afterRender(); return toast(friendly(error), true); }
  if (c.kind === "done" && prev.status !== "done") toast(blockedWarn(t) || "برافو! المهمة اكتملت", !!blockedWarn(t));
}

/* =====================================================================
   Home: greeting + on-time leaderboard for everyone
   ===================================================================== */
const LEVELS = [[90, "ممتاز", "ok"], [75, "جيد جدًا", "good"], [60, "جيد", "warn"], [0, "يحتاج تحسين", "bad"]];
const scoreOf = (r) => { const den = r.on_time + r.late + r.overdue; return den ? Math.round((r.on_time * 100) / den) : null; };
const levelOf = (sc) => LEVELS.find(([m]) => sc >= m);

async function loadScores(period) {
  const key = String(period || "all"), c = state.scores[key];
  if (c && Date.now() - c.at < 60000) return c.rows;
  const { data, error } = await sb.rpc("team_scores", { p_days: period || null });
  if (error) throw error;
  state.scores[key] = { at: Date.now(), rows: data || [] };
  return state.scores[key].rows;
}

function scoreRing(sc, size = 58) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r;
  const lv = sc === null ? null : levelOf(sc);
  const off = sc === null ? c : c * (1 - sc / 100);
  return `<div class="ring lvl-${lv ? lv[2] : "none"}" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle class="bg" cx="${size / 2}" cy="${size / 2}" r="${r}"/>
    <circle class="fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${c.toFixed(1)}" data-off="${off.toFixed(1)}"/>
  </svg><b>${sc === null ? "—" : sc + "%"}</b></div>`;
}

function renderHome() {
  const me = state.me, first = me.full_name.split(" ")[0];
  const mine = state.tasks.filter((t) => t.assignees.includes(me.id));
  const myOpen = mine.filter((t) => t.status !== "done");
  const myLate = myOpen.filter(isOverdue).length;
  const dueToday = myOpen.filter((t) => t.deadline && daysUntil(t.deadline) === 0).length;
  const nextUp = sortTasks(myOpen).slice(0, 5);
  const greet = new Date().getHours() < 12 ? "صباح الخير" : "مساء الخير";
  const dateLong = new Date().toLocaleDateString(LOCALE(), { weekday: "long", day: "numeric", month: "long" });
  const periods = [[30, "آخر 30 يوم"], [90, "آخر 3 شهور"], [0, "من الأول"]];

  $("#view").innerHTML = `
    ${pushPromptHtml()}
    <div class="home-hero">
      <div class="hero-text">
        <p class="hero-date">${icon("calendar", "sm")}${esc(dateLong)}</p>
        <h1>${tx("{g}، {name}", { g: tx(greet), name: esc(first) })}</h1>
        <p>${myLate ? tx("عندك {n} مهمة متأخرة، ابدأ بيها.", { n: myLate })
          : myOpen.length ? tx("عندك {n} مهمة مفتوحة ومفيش حاجة متأخرة. كمّل كده!", { n: myOpen.length })
          : tx("مفيش مهام مفتوحة عندك دلوقتي.")}</p>
      </div>
      <button class="btn hero-new new-task-btn" id="home-new"><span class="nt-plus">${icon("plus")}</span>مهمة جديدة</button>
      <div class="hero-stats">
        <a class="hstat" href="#/tasks"><span class="ico">${icon("inbox")}</span><b data-count="${myOpen.length}">${myOpen.length}</b><span>مهامك المفتوحة</span></a>
        <a class="hstat t-bad ${myLate ? "hot" : ""}" href="#/tasks"><span class="ico">${icon("flame")}</span><b data-count="${myLate}">${myLate}</b><span>متأخرة</span></a>
        <a class="hstat t-warn" href="#/tasks"><span class="ico">${icon("clock")}</span><b data-count="${dueToday}">${dueToday}</b><span>مطلوبة النهارده</span></a>
        <div class="hstat t-ok" id="my-score"><span class="ico">${icon("target")}</span><b>—</b><span>التزامك بالمواعيد</span></div>
      </div>
    </div>
    <div class="home-grid">
      <section class="lb-card">
        <header class="lb-head">
          <div><h2>${icon("trophy")}<span>أداء الفريق في المواعيد</span></h2>
            <p>النسبة = المهام اللي اتسلمت في ميعادها ÷ (اللي اتسلمت + اللي اتأخرت أو لسه متأخرة)</p></div>
          <div class="seg seg-sm" role="radiogroup" aria-label="الفترة">
            ${periods.map(([d, l]) => `<label><input type="radio" name="period" value="${d}" ${state.homePeriod === d ? "checked" : ""}><span>${l}</span></label>`).join("")}
          </div>
        </header>
        <div id="lb"><div class="lb-skel">${"<i></i>".repeat(6)}</div></div>
      </section>
      <aside class="side-col">
        ${homePointsCard()}
        <section class="mini-card">
          <h3>${icon("tasks", "sm")}مهامك الجاية</h3>
          ${nextUp.length ? `<div class="next-list">${nextUp.map((t) => `
            <button class="next-item" data-open="${t.id}">
              ${statusPill(t)}
              <b>${esc(t.title)}</b>${deadlineCell(t)}
            </button>`).join("")}</div>
            <a class="see-all" href="#/tasks">كل مهامك</a>`
          : `<p class="meta" style="margin:0">مفيش مهام مفتوحة. استمتع بيومك!</p>`}
        </section>
        <section class="mini-card legend">
          <h3>${icon("target", "sm")}إزاي بنقيس؟</h3>
          ${LEVELS.map(([m, l, k]) => `<div class="lg-row"><span class="lg-dot lvl-${k}"></span><b>${l}</b><small>${m ? tx("{n}% أو أكتر", { n: m }) : tx("أقل من 60%")}</small></div>`).join("")}
        </section>
      </aside>
    </div>`;

  $("#home-new").onclick = () => openNewTask();
  $$("[data-open]").forEach((b) => b.onclick = () => openTask(b.dataset.open));
  $$("input[name=period]").forEach((r) => r.onchange = () => { state.homePeriod = Number(r.value); fillLeaderboard(true); });
  fillLeaderboard(state.animate);
  wirePushPrompt();
}

async function fillLeaderboard(animate) {
  const box = $("#lb");
  if (!box) return;
  let rows;
  try { rows = await loadScores(state.homePeriod); }
  catch (e) { box.innerHTML = `<p class="err">${esc(friendly(e))}</p>`; return; }
  if (!$("#lb")) return;
  const me = state.me.id;
  const people = rows.map((r) => ({ ...r, p: profile(r.user_id), score: scoreOf(r) })).filter((x) => x.p);
  const ranked = people.filter((x) => x.score !== null).sort((a, b) => b.score - a.score || b.on_time - a.on_time || a.p.full_name.localeCompare(b.p.full_name, "ar"));
  const noData = people.filter((x) => x.score === null).sort((a, b) => a.p.full_name.localeCompare(b.p.full_name, "ar"));
  const sum = (k) => people.reduce((s, x) => s + x[k], 0);
  const teamScore = scoreOf({ on_time: sum("on_time"), late: sum("late"), overdue: sum("overdue") });
  const mineRow = people.find((x) => x.user_id === me);
  const ms = $("#my-score b");
  if (ms) ms.textContent = mineRow?.score === null || !mineRow ? "—" : mineRow.score + "%";
  const canOpen = () => true; // everyone can view colleagues' tasks (read-only)

  const row = (x, i) => {
    const den = x.on_time + x.late + x.overdue, lv = levelOf(x.score);
    return `<div class="lb-row ${x.user_id === me ? "me" : ""} ${canOpen(x.user_id) ? "link" : ""}" data-u="${x.user_id}" style="--i:${Math.min(i, 14)}" ${canOpen(x.user_id) ? 'tabindex="0" role="link"' : ""}>
      <span class="rank r${i + 1}">${i + 1}</span>
      <div class="person">${avatar(x.p)}<div><b>${esc(x.p.full_name)}</b><small>${esc(x.p.job_title || "")}</small></div></div>
      <div class="lb-bar" title="${tx("{a} في الموعد · {b} اتأخرت · {c} متأخرة دلوقتي", { a: x.on_time, b: x.late, c: x.overdue })}">
        <span class="seg-ok" style="width:${(x.on_time * 100) / den}%"></span><span class="seg-late" style="width:${(x.late * 100) / den}%"></span><span class="seg-over" style="width:${(x.overdue * 100) / den}%"></span>
      </div>
      <div class="lb-counts"><span class="c-ok">${icon("check", "sm")}${x.on_time}</span><span class="c-late">${icon("clock", "sm")}${x.late}</span><span class="c-over">${icon("flame", "sm")}${x.overdue}</span></div>
      <span class="lvl-pill lvl-${lv[2]}">${lv[1]}</span>
      ${scoreRing(x.score, 52)}
    </div>`;
  };

  box.innerHTML = `
    <div class="team-score">
      ${scoreRing(teamScore, 92)}
      <div><b>${teamScore === null ? tx("لسه مفيش بيانات كفاية") : tx("الفريق ملتزم بالمواعيد بنسبة {n}%", { n: teamScore })}</b>
        <p>${tx("{a} مهمة اتسلمت في ميعادها · {b} اتسلمت متأخر · {c} متأخرة دلوقتي", { a: sum("on_time"), b: sum("late"), c: sum("overdue") })}</p></div>
    </div>
    ${ranked.length ? `<div class="lb-list ${animate ? "stagger" : ""}">${ranked.map(row).join("")}</div>` : ""}
    ${noData.length ? `<div class="nodata"><h4>لسه مفيش مهام بمواعيد اتسلمت</h4><div class="nodata-list">${noData.map((x) => `<span class="nd-chip ${canOpen(x.user_id) ? "link" : ""}" data-u="${x.user_id}">${avatar(x.p, "sm")}${esc(x.p.full_name)}</span>`).join("")}</div></div>` : ""}`;

  $$("[data-u]", box).forEach((el) => {
    if (!canOpen(el.dataset.u)) return;
    const go = () => { location.hash = `#/tasks?user=${el.dataset.u}`; };
    el.onclick = go;
    el.onkeydown = (e) => { if (e.key === "Enter") go(); };
  });
  requestAnimationFrame(() => requestAnimationFrame(() => $$("#lb .ring .fg").forEach((c) => { c.style.strokeDashoffset = c.dataset.off; })));
}

/* =====================================================================
   Weekly report (managers) with Excel + PDF export
   ===================================================================== */
function weekRange(offset) {
  const d = today();
  const start = new Date(d); start.setDate(d.getDate() - d.getDay() - offset * 7); // weeks start on Sunday
  const end = new Date(start); end.setDate(start.getDate() + 7);
  return { start, end };
}
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function buildReport() {
  const { start, end } = weekRange(state.reportWeek);
  const inRange = (iso) => { if (!iso) return false; const x = new Date(iso); return x >= start && x < end; };
  const people = (state.me.is_admin ? state.profiles.filter((p) => p.id !== state.me.id) : descendants(state.me.id)).filter((p) => p.active);
  const ids = new Set(people.map((p) => p.id));
  const doneDay = (t) => ymd(new Date(t.completed_at));
  const onTimeT = (t) => t.deadline && doneDay(t) <= t.deadline;
  const rows = people.map((p) => {
    const mine = state.tasks.filter((t) => t.assignees.includes(p.id));
    const completed = mine.filter((t) => t.status === "done" && inRange(t.completed_at));
    const withDl = completed.filter((t) => t.deadline);
    const onTime = withDl.filter(onTimeT).length;
    const late = withDl.length - onTime;
    const open = mine.filter((t) => t.status !== "done");
    return {
      p, completed: completed.length, onTime, late, overdue: open.filter(isOverdue).length, open: open.length,
      created: mine.filter((t) => inRange(t.created_at)).length,
      rate: withDl.length ? Math.round((onTime * 100) / withDl.length) : null,
    };
  }).sort((a, b) => b.completed - a.completed || a.p.full_name.localeCompare(b.p.full_name, "ar"));
  const teamTasks = state.tasks.filter((t) => t.assignees.some((u) => ids.has(u)));
  const completedList = teamTasks.filter((t) => t.status === "done" && inRange(t.completed_at))
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at));
  const overdueList = teamTasks.filter(isOverdue).sort((a, b) => a.deadline.localeCompare(b.deadline));
  const tot = rows.reduce((a, r) => ({ completed: a.completed + r.completed, onTime: a.onTime + r.onTime, late: a.late + r.late, created: a.created + r.created }), { completed: 0, onTime: 0, late: 0, created: 0 });
  tot.overdue = overdueList.length;
  tot.rate = tot.onTime + tot.late ? Math.round((tot.onTime * 100) / (tot.onTime + tot.late)) : null;
  return { start, end, rows, completedList, overdueList, tot, onTimeT };
}

function renderReports() {
  const R = buildReport();
  const last = new Date(R.end); last.setDate(last.getDate() - 1);
  const range = `${fmtDate(ymd(R.start))} – ${fmtDate(ymd(last))}`;
  const weekLabel = (i) => {
    const w = weekRange(i), l = new Date(w.end); l.setDate(l.getDate() - 1);
    const r = `${fmtDate(ymd(w.start))} – ${fmtDate(ymd(l))}`;
    return i === 0 ? tx("الأسبوع ده ({r})", { r }) : i === 1 ? tx("الأسبوع اللي فات ({r})", { r }) : r;
  };
  const names = (t) => t.assignees.map(profile).filter(Boolean).map((p) => esc(p.full_name)).join(LANG === "en" ? ", " : "، ");

  $("#view").innerHTML = `
    <div class="page-head">
      <div><h1>التقرير الأسبوعي</h1><p>${tx(state.me.is_admin ? "كل الفريق" : "الموظفين تحت إدارتك")} · ${range}</p></div>
      <div class="report-tools no-print">
        <select class="input" id="rep-week" aria-label="الأسبوع">${Array.from({ length: 8 }, (_, i) => `<option value="${i}" ${state.reportWeek === i ? "selected" : ""}>${weekLabel(i)}</option>`).join("")}</select>
        <button class="btn" id="rep-xlsx">${icon("download", "sm")}Excel</button>
        <button class="btn" id="rep-pdf">${icon("printer", "sm")}PDF</button>
      </div>
    </div>
    <div class="print-only print-head"><img src="assets/logo-white.png" alt=""><div><b>Digital Team Tasks Tracker</b><span>${tx("التقرير الأسبوعي")} · ${range}</span></div></div>
    <div class="stats">
      <div class="stat t-ok"><div class="ico">${icon("check")}</div><b data-count="${R.tot.completed}">${R.tot.completed}</b><span>مهام اتسلمت</span></div>
      <div class="stat"><div class="ico">${icon("target")}</div><b>${R.tot.rate === null ? "—" : R.tot.rate + "%"}</b><span>الالتزام بالمواعيد</span></div>
      <div class="stat t-warn"><div class="ico">${icon("clock")}</div><b data-count="${R.tot.late}">${R.tot.late}</b><span>اتسلمت متأخر</span></div>
      <div class="stat t-bad"><div class="ico">${icon("flame")}</div><b data-count="${R.tot.overdue}">${R.tot.overdue}</b><span>متأخرة دلوقتي</span></div>
    </div>
    <section class="rep-sec">
      <h3>${icon("users", "sm")}ملخص الموظفين</h3>
      ${R.rows.length ? `<div class="table-wrap"><table class="t">
        <thead><tr><th>الموظف</th><th>مهام جديدة</th><th>اتسلمت</th><th>في الموعد</th><th>متأخر</th><th>متأخرة دلوقتي</th><th>مفتوحة</th><th>الالتزام بالمواعيد</th></tr></thead>
        <tbody>${R.rows.map((r) => `<tr>
          <td><div class="person">${avatar(r.p, "sm")}<div><b>${esc(r.p.full_name)}</b><small>${esc(r.p.job_title || "")}</small></div></div></td>
          <td class="num">${r.created}</td><td class="num">${r.completed}</td><td class="num">${r.onTime}</td>
          <td class="num ${r.late ? "bad" : ""}">${r.late}</td><td class="num ${r.overdue ? "bad" : ""}">${r.overdue}</td><td class="num">${r.open}</td>
          <td>${r.rate === null ? "—" : `<span class="lvl-pill lvl-${levelOf(r.rate)[2]}">${r.rate}%</span>`}</td></tr>`).join("")}</tbody></table></div>`
      : `<div class="empty"><div class="ill">${icon("users")}</div><b>مفيش موظفين تحت إدارتك لسه</b></div>`}
    </section>
    <div class="rep-two">
      <section class="rep-sec">
        <h3>${icon("check", "sm")}اتسلمت الأسبوع ده <span class="n">${R.completedList.length}</span></h3>
        ${R.completedList.length ? `<ul class="rep-list">${R.completedList.map((t) => `<li>
          <span class="dot ${!t.deadline ? "" : R.onTimeT(t) ? "ok" : "late"}"></span>
          <div><b>${esc(t.title)}</b><small>${names(t)} · ${fmtDate(t.completed_at)}</small></div>
          ${t.deadline ? `<span class="lvl-pill lvl-${R.onTimeT(t) ? "ok" : "warn"}">${R.onTimeT(t) ? "في الموعد" : "متأخر"}</span>` : ""}</li>`).join("")}</ul>`
        : `<p class="meta">مفيش مهام اتسلمت في الفترة دي.</p>`}
      </section>
      <section class="rep-sec">
        <h3>${icon("flame", "sm")}متأخرة دلوقتي <span class="n">${R.overdueList.length}</span></h3>
        ${R.overdueList.length ? `<ul class="rep-list">${R.overdueList.map((t) => `<li>
          <span class="dot late"></span>
          <div><b>${esc(t.title)}</b><small>${names(t)} · ${tx("الموعد كان {d}", { d: fmtDate(t.deadline) })}</small></div>
          <span class="lvl-pill lvl-bad">${tx("متأخرة {n} يوم", { n: -daysUntil(t.deadline) })}</span></li>`).join("")}</ul>`
        : `<p class="meta">مفيش مهام متأخرة. ممتاز!</p>`}
      </section>
    </div>`;

  $("#rep-week").onchange = (e) => { state.reportWeek = Number(e.target.value); state.animate = true; route(); };
  $("#rep-pdf").onclick = () => window.print();
  $("#rep-xlsx").onclick = () => exportReportXlsx(R, range);
}

let xlsxLoading = null;
function loadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  xlsxLoading = xlsxLoading || new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => res(window.XLSX);
    s.onerror = () => { xlsxLoading = null; rej(new Error(tx("مقدرناش نحمّل مكتبة Excel، جرّب تاني."))); };
    document.head.append(s);
  });
  return xlsxLoading;
}
async function exportReportXlsx(R, range) {
  const btn = $("#rep-xlsx"); btn.disabled = true;
  try {
    const XLSX = await loadXlsx();
    const nm = (t) => t.assignees.map(profile).filter(Boolean).map((p) => p.full_name).join(", ");
    const wb = XLSX.utils.book_new();
    const sheet = (rows, widths) => { const ws = XLSX.utils.aoa_to_sheet(rows); ws["!cols"] = widths.map((w) => ({ wch: w })); return ws; };
    XLSX.utils.book_append_sheet(wb, sheet([
      [tx("التقرير الأسبوعي"), range],
      [],
      [tx("مهام اتسلمت"), R.tot.completed],
      [tx("في الموعد"), R.tot.onTime],
      [tx("اتسلمت متأخر"), R.tot.late],
      [tx("متأخرة دلوقتي"), R.tot.overdue],
      [tx("الالتزام بالمواعيد"), R.tot.rate === null ? "—" : R.tot.rate + "%"],
    ], [26, 30]), tx("الملخص"));
    XLSX.utils.book_append_sheet(wb, sheet([
      [tx("الموظف"), tx("المسمى الوظيفي"), tx("مهام جديدة"), tx("اتسلمت"), tx("في الموعد"), tx("متأخر"), tx("متأخرة دلوقتي"), tx("مفتوحة"), tx("الالتزام بالمواعيد")],
      ...R.rows.map((r) => [r.p.full_name, r.p.job_title || "", r.created, r.completed, r.onTime, r.late, r.overdue, r.open, r.rate === null ? "—" : r.rate + "%"]),
    ], [24, 22, 12, 10, 10, 10, 14, 10, 16]), tx("الموظفين"));
    XLSX.utils.book_append_sheet(wb, sheet([
      [tx("المهمة"), tx("المسؤولين"), tx("المشروع"), tx("الموعد النهائي"), tx("اتسلمت يوم"), tx("الحالة")],
      ...R.completedList.map((t) => [t.title, nm(t), project(t.project_id)?.name || "", t.deadline || "", ymd(new Date(t.completed_at)), !t.deadline ? "" : R.onTimeT(t) ? tx("في الموعد") : tx("متأخر")]),
    ], [36, 28, 20, 14, 14, 12]), tx("اتسلمت"));
    XLSX.utils.book_append_sheet(wb, sheet([
      [tx("المهمة"), tx("المسؤولين"), tx("المشروع"), tx("الموعد النهائي"), tx("أيام التأخير"), tx("نسبة الإنجاز")],
      ...R.overdueList.map((t) => [t.title, nm(t), project(t.project_id)?.name || "", t.deadline, -daysUntil(t.deadline), t.progress + "%"]),
    ], [36, 28, 20, 14, 12, 12]), tx("متأخرة"));
    if (LANG !== "en") wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.writeFile(wb, `weekly-report-${ymd(R.start)}.xlsx`);
    toast("اتنزل ملف الإكسل");
  } catch (e) { toast(friendly(e), true); }
  btn.disabled = false;
}


/* =====================================================================
   Person hover card (hover a photo ~2s)
   ===================================================================== */
const HOVER_DELAY = 2000;
let pcTimer = null, pcHideTimer = null, pcFor = null, pcPending = null;

function hidePersonCard(now = false) {
  clearTimeout(pcTimer); pcTimer = null; pcPending = null;
  const card = $("#person-card");
  if (!card) { pcFor = null; return; }
  const go = () => { card.remove(); pcFor = null; };
  if (now || reduceMotion) return go();
  card.classList.add("closing");
  setTimeout(go, 140);
}

// large side photo for the hover card (real photo, gender illustration, or initials)
function bigPhoto(p) {
  if (p.avatar_url) return `<img class="pc-img" src="${esc(p.avatar_url)}" alt="${esc(p.full_name)}">`;
  if (DEFAULT_AVATAR[p.gender]) return `<span class="pc-img pc-ill g-${p.gender}" role="img" aria-label="${esc(p.full_name)}">${DEFAULT_AVATAR[p.gender]}</span>`;
  const initials = p.full_name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  let h = 0; for (const c of p.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `<span class="pc-img pc-ini" role="img" aria-label="${esc(p.full_name)}" style="--bg:${AV_COLORS[h % AV_COLORS.length]}">${esc(initials)}</span>`;
}

// Hovering anywhere on a "person" (photo, name, row/card) opens the card
const PERSON_ZONES = ".lb-row, .org-card, .conv, .sheet-me, tbody tr:has(.person), .person";
function personTarget(t) {
  if (!t?.closest) return null;
  let z = null;
  try { z = t.closest(PERSON_ZONES); } catch { z = t.closest(".lb-row, .org-card, .conv, .sheet-me, .person"); }
  z ||= t.closest("[data-pid]");
  if (!z || z.closest("#person-card") || z.closest(".chat-heads")) return null;
  const pid = z.dataset.pid || z.querySelector("[data-pid]")?.dataset.pid;
  return pid ? { el: z, pid } : null;
}
function showPersonCard(el, pid = el.dataset.pid) {
  const p = profile(pid);
  if (!p || !el.isConnected) return;
  hidePersonCard(true);
  pcFor = el;
  const me = state.me.id;
  const mgr = profile(p.manager_id);
  const team = descendants(p.id).length;
  const canWork = true; // everyone can view colleagues' tasks (read-only)
  const mine = canWork ? state.tasks.filter((t) => t.assignees.includes(p.id)) : [];
  const open = mine.filter((t) => t.status !== "done").length;
  const late = mine.filter(isOverdue).length;

  const card = document.createElement("div");
  card.id = "person-card";
  card.className = "person-card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", p.full_name);
  card.innerHTML = `
    <div class="pc-photo">${bigPhoto(p)}${p.id === me ? `<span class="pc-me">${p.gender === "female" ? "أنتِ" : "أنت"}</span>` : ""}</div>
    <div class="pc-body">
      <div class="pc-main">
        <b class="pc-name">${esc(p.full_name)}</b>
        <span class="pc-title">${esc(p.job_title || "—")}</span>
        <div class="pc-tags">
          ${p.is_admin ? `<span class="pill s-review">أدمن</span>` : ""}
          ${p.active ? "" : `<span class="pill s-blocked">موقوف</span>`}
          ${p.gender ? genderPill(p.gender) : ""}
        </div>
      </div>
      <div class="pc-rows">
        <div class="pc-row pc-row-mgr"><span class="pc-k">المدير المباشر</span>
          ${mgr ? `<span class="pc-v pc-mgr">${avatar(mgr, "sm")}<span><b>${esc(mgr.full_name)}</b><small>${esc(mgr.job_title || "")}</small></span></span>`
                : `<span class="pc-v muted">أعلى الهيكل</span>`}</div>
        ${team ? `<div class="pc-row"><span class="pc-k">عدد الفريق</span><span class="pc-v"><b>${team}</b></span></div>` : ""}
        ${canWork ? `<div class="pc-row"><span class="pc-k">مهام مفتوحة</span><span class="pc-v"><b>${open}</b>${late ? `<span class="pc-late">${icon("flame", "sm")}${tx("{n} متأخرة", { n: late })}</span>` : ""}</span></div>` : ""}
      </div>
      ${(p.id !== me && p.active) || canWork ? `<div class="pc-actions">
        ${p.id !== me && p.active ? `<a class="btn sm primary pc-link" href="#/chat?with=${p.id}">${icon("chat", "sm")}<span>مراسلة</span></a>` : ""}
        ${canWork ? `<a class="btn sm pc-link" href="#/tasks?user=${p.id}">${icon("tasks", "sm")}<span>عرض المهام</span></a>` : ""}
      </div>` : ""}
    </div>`;
  document.body.append(card);

  // position: below the photo if there's room, otherwise above; keep inside the viewport
  const r = el.getBoundingClientRect(), cw = card.offsetWidth, ch = card.offsetHeight, gap = 10, pad = 10;
  let top = r.bottom + gap, origin = "top";
  if (top + ch > innerHeight - pad && r.top - gap - ch > pad) { top = r.top - gap - ch; origin = "bottom"; }
  top = Math.max(pad, Math.min(top, innerHeight - ch - pad));
  let left = r.left + r.width / 2 - cw / 2;
  left = Math.max(pad, Math.min(left, innerWidth - cw - pad));
  card.style.top = top + "px";
  card.style.left = left + "px";
  card.style.transformOrigin = `${Math.round(r.left + r.width / 2 - left)}px ${origin}`;

  card.addEventListener("pointerenter", () => clearTimeout(pcHideTimer));
  card.addEventListener("pointerleave", () => { pcHideTimer = setTimeout(() => hidePersonCard(), 200); });
  $$(".pc-link", card).forEach((l) => l.addEventListener("click", () => { hidePersonCard(true); closeModal(); }));
}

document.addEventListener("pointerover", (e) => {
  if (e.pointerType === "touch") return;
  const hit = personTarget(e.target);
  if (!hit) return;
  const el = hit.el;
  if (pcFor === el) { clearTimeout(pcHideTimer); return; }
  if (pcPending === el) return; // still inside the same person, keep the timer running
  clearTimeout(pcTimer);
  pcPending = el;
  pcTimer = setTimeout(() => { pcPending = null; showPersonCard(el, hit.pid); }, HOVER_DELAY);
});
document.addEventListener("pointerout", (e) => {
  const hit = personTarget(e.target);
  if (!hit) return;
  const el = hit.el;
  if (el.contains(e.relatedTarget)) return;
  if (pcPending === el) pcPending = null;
  clearTimeout(pcTimer);
  if (pcFor === el) { clearTimeout(pcHideTimer); pcHideTimer = setTimeout(() => hidePersonCard(), 250); }
});
addEventListener("scroll", () => hidePersonCard(true), true);
addEventListener("hashchange", () => hidePersonCard(true));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") hidePersonCard(true); });
document.addEventListener("pointerdown", (e) => { if (!e.target.closest("#person-card")) hidePersonCard(true); });

/* =====================================================================
   Settings (language + theme, saved on this device)
   ===================================================================== */
/* =====================================================================
   Chat (1:1 direct messages, text only)
   ===================================================================== */
const MSG_MAX = 4000;

/* ---------- chat images (DB v24): up to 1.5 MB, private bucket ---------- */
const CHAT_IMG_MAX = 1.5 * 1024 * 1024;
const CHAT_IMG_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const chatImgUrls = new Map(); // storage path -> { url, exp }
const hasAtt = (m) => !!(m.attachment_path || m._local);
const isVoice = (m) => (m.attachment_meta || m._meta)?.kind === "audio";
const hasImg = (m) => hasAtt(m) && !isVoice(m);
const msgPreviewText = (m) => (m.body || "").trim() ? m.body.replace(/\s+/g, " ") : isVoice(m) ? "🎤 " + tx("رسالة صوتية") : hasImg(m) ? "📷 " + tx("صورة") : "";
// makes any picture fit the 1.5 MB limit (keeps small JPG/PNG/WebP/GIF as they are)
async function prepChatImage(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error(tx("ابعت صورة بس (JPG أو PNG)"));
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { throw new Error(tx("الصورة دي مش مدعومة، جرّب صورة JPG أو PNG")); }
  const W = bmp.width, H = bmp.height;
  try {
    if (CHAT_IMG_TYPES.includes(file.type) && file.size <= CHAT_IMG_MAX) return { blob: file, type: file.type, w: W, h: H, size: file.size };
    let max = 2560, q = 0.86;
    for (let i = 0; i < 10; i++) {
      const k = Math.min(1, max / Math.max(W, H)), w = Math.round(W * k), h = Math.round(H * k);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(bmp, 0, 0, w, h);
      const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", q));
      if (blob && blob.size <= CHAT_IMG_MAX) return { blob, type: "image/jpeg", w, h, size: blob.size };
      if (q > 0.7) q -= 0.08; else max = Math.round(max * 0.8);
    }
    throw new Error(tx("الصورة أكبر من 1.5 ميجا"));
  } finally { bmp.close?.(); }
}
async function uploadChatImage(att) {
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/aac": "aac" }[att.type] || "bin";
  const path = `${state.me.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from("chat-files").upload(path, att.blob, { contentType: att.type, upsert: false });
  if (error) throw error;
  return path;
}
const imgMeta = (att) => !att ? null : att.kind === "audio" ? { kind: "audio", dur: att.dur, peaks: att.peaks, size: att.size, type: att.type } : { w: att.w, h: att.h, size: att.size, type: att.type };
function msgImgHtml(m) {
  if (isVoice(m)) return voiceHtml(m);
  if (!hasImg(m)) return "";
  const a = m.attachment_meta || m._meta || {};
  const ratio = a.w && a.h ? `aspect-ratio:${a.w} / ${a.h};` : "";
  const cached = m.attachment_path && chatImgUrls.get(m.attachment_path);
  const src = m._local || (cached && cached.exp > Date.now() ? cached.url : "");
  return `<button type="button" class="msg-img-wrap ${src ? "" : "loading"}" data-view-img="${esc(m.attachment_path || "")}" aria-label="${tx("فتح الصورة")}">
    <img class="msg-img" ${src ? `src="${esc(src)}"` : ""} data-path="${esc(m.attachment_path || "")}" style="${ratio}" alt="${tx("صورة")}" draggable="false"></button>`;
}
// fill in signed URLs for the images in a thread (one request for all of them)
async function hydrateChatImgs(box) {
  const imgs = $$("img.msg-img[data-path]", box).filter((i) => i.dataset.path && !i.getAttribute("src"));
  if (!imgs.length) return;
  const need = [...new Set(imgs.map((i) => i.dataset.path))].filter((p) => !(chatImgUrls.get(p)?.exp > Date.now()));
  if (need.length) {
    const { data } = await sb.storage.from("chat-files").createSignedUrls(need, 3600);
    (data || []).forEach((d) => { if (d.signedUrl) chatImgUrls.set(d.path, { url: d.signedUrl, exp: Date.now() + 3500e3 }); });
  }
  imgs.forEach((i) => {
    const u = chatImgUrls.get(i.dataset.path);
    if (u) { i.src = u.url; i.closest(".msg-img-wrap")?.classList.remove("loading"); }
  });
}
function wireMsgImgs(box) {
  wireVoicePlayers(box);
  const pin = box.scrollHeight - box.scrollTop - box.clientHeight < 140;
  if (pin) $$("img.msg-img", box).forEach((i) => i.addEventListener("load", () => { box.scrollTop = box.scrollHeight; }, { once: true }));
  $$("[data-view-img]", box).forEach((b) => b.onclick = (e) => { e.stopPropagation(); const img = $("img", b); if (img?.src) openImageViewer(img.src); });
  $$("img.msg-img", box).forEach((i) => { i.onload = () => i.closest(".msg-img-wrap")?.classList.remove("loading"); });
  hydrateChatImgs(box);
}
function openImageViewer(src) {
  $(".img-viewer")?.remove();
  const v = document.createElement("div");
  v.className = "img-viewer"; v.setAttribute("role", "dialog"); v.setAttribute("aria-modal", "true"); v.setAttribute("aria-label", tx("صورة"));
  v.innerHTML = `<img src="${esc(src)}" alt="">
    <div class="iv-bar"><a class="icon-btn" href="${esc(src)}" download target="_blank" rel="noopener" aria-label="${tx("تحميل")}" title="${tx("تحميل")}">${icon("download")}</a>
    <button class="icon-btn" data-x aria-label="${tx("إغلاق")}">${icon("close")}</button></div>`;
  document.body.append(v);
  const close = () => { v.classList.add("closing"); setTimeout(() => v.remove(), 180); removeEventListener("keydown", onKey, true); };
  const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  addEventListener("keydown", onKey, true);
  v.onclick = (e) => { if (e.target === v || e.target.closest("[data-x]")) close(); };
}
// composer: image button, paste and drag & drop, preview with remove
function wireAttach(key, pane, refresh) {
  (state.chatAttach ||= {});
  const box = $("#attach-preview", pane), input = $("#attach-in", pane);
  const draw = () => {
    const a = state.chatAttach[key];
    box.hidden = !a;
    box.innerHTML = a ? `<div class="ap-card"><img src="${esc(a.url)}" alt=""><div class="ap-info"><b>${tx("صورة")}</b><small>${(a.size / 1024 / 1024).toFixed(2)} MB · ${a.w}×${a.h}</small></div>
      <button type="button" class="icon-btn" id="attach-x" aria-label="${tx("شيل الصورة")}">${icon("close", "sm")}</button></div>` : "";
    const x = $("#attach-x", box); if (x) x.onclick = () => { URL.revokeObjectURL(a.url); delete state.chatAttach[key]; draw(); refresh(); };
    refresh();
  };
  const take = async (file) => {
    if (!file) return;
    const btn = $("#attach-btn", pane); btn?.classList.add("busy");
    try {
      const a = await prepChatImage(file);
      if (state.chatAttach[key]) URL.revokeObjectURL(state.chatAttach[key].url);
      state.chatAttach[key] = { ...a, url: URL.createObjectURL(a.blob) };
      draw(); $("#msg-in", pane)?.focus();
    } catch (e) { toast(friendly(e), true); }
    btn?.classList.remove("busy");
  };
  $("#attach-btn", pane).onclick = () => input.click();
  input.onchange = () => { take(input.files[0]); input.value = ""; };
  $("#msg-in", pane).addEventListener("paste", (e) => {
    const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith("image/"));
    if (f) { e.preventDefault(); take(f); }
  });
  const zone = $("#chat-pane");
  zone.ondragover = (e) => { if ([...e.dataTransfer.items].some((i) => i.kind === "file")) { e.preventDefault(); zone.classList.add("drop-on"); } };
  zone.ondragleave = (e) => { if (!zone.contains(e.relatedTarget)) zone.classList.remove("drop-on"); };
  zone.ondrop = (e) => { e.preventDefault(); zone.classList.remove("drop-on"); take([...e.dataTransfer.files].find((x) => x.type.startsWith("image/"))); };
  draw();
}
/* ---------- voice notes (DB v25): record → upload to chat-files → custom player ---------- */
const VOICE_MAX_SEC = 300;
const fmtDur = (s) => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
let rec = null; // the recording in progress
function wireVoice(pane, send) {
  const mic = $("#mic-btn", pane), bar = $("#rec-bar", pane);
  if (!mic) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { mic.hidden = true; return; }
  const stopAll = () => {
    if (!rec) return;
    clearInterval(rec.tick); cancelAnimationFrame(rec.raf);
    rec.stream.getTracks().forEach((t) => t.stop());
    rec.ctx?.close?.();
    bar.hidden = true; pane.classList.remove("recording");
  };
  const finish = (keep) => new Promise((done) => {
    if (!rec) return done(null);
    const r = rec;
    r.mr.onstop = () => {
      stopAll(); rec = null;
      if (!keep) return done(null);
      const type = (r.mr.mimeType || "audio/webm").split(";")[0];
      const blob = new Blob(r.chunks, { type });
      const dur = (Date.now() - r.t0) / 1000;
      if (dur < 0.6) { toast(tx("التسجيل قصير أوي")); return done(null); }
      if (blob.size > CHAT_IMG_MAX) { toast(tx("الرسالة الصوتية أكبر من 1.5 ميجا"), true); return done(null); }
      // 40 bars from the levels we sampled while recording
      const lv = r.levels.length ? r.levels : [0.2];
      const peaks = Array.from({ length: 40 }, (_, i) => {
        const a = Math.floor(i * lv.length / 40), b = Math.max(a + 1, Math.floor((i + 1) * lv.length / 40));
        return Math.round(Math.min(1, Math.max(...lv.slice(a, b)) * 1.6) * 100) / 100;
      });
      done({ kind: "audio", blob, type, dur: Math.round(dur * 10) / 10, peaks, size: blob.size, url: URL.createObjectURL(blob) });
    };
    if (r.mr.state !== "inactive") r.mr.stop(); else r.mr.onstop();
  });
  mic.onclick = async () => {
    if (rec) return;
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { return toast(tx("لازم تسمح للمتصفح يستخدم المايك"), true); }
    const mime = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"].find((t) => MediaRecorder.isTypeSupported?.(t)) || "";
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
    rec = { mr, stream, chunks: [], levels: [], t0: Date.now() };
    mr.ondataavailable = (e) => { if (e.data.size) rec?.chunks.push(e.data); };
    mr.start(250);
    // live level meter + waveform
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const an = ctx.createAnalyser(); an.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.fftSize), cv = $("#rec-wave", pane), c2 = cv.getContext("2d");
      const draw = () => {
        if (!rec) return;
        an.getByteTimeDomainData(buf);
        let sum = 0; for (const v of buf) sum += ((v - 128) / 128) ** 2;
        const level = Math.sqrt(sum / buf.length);
        rec.levels.push(level);
        const W = cv.width = cv.clientWidth * devicePixelRatio, H = cv.height = cv.clientHeight * devicePixelRatio;
        c2.clearRect(0, 0, W, H);
        const n = Math.floor(W / (5 * devicePixelRatio)), tail = rec.levels.slice(-n);
        c2.fillStyle = getComputedStyle(cv).color;
        tail.forEach((l, i) => {
          const h = Math.max(3 * devicePixelRatio, Math.min(1, l * 3.2) * H);
          const x = W - (tail.length - i) * 5 * devicePixelRatio;
          c2.beginPath(); c2.roundRect?.(x, (H - h) / 2, 3 * devicePixelRatio, h, 2 * devicePixelRatio) ?? c2.rect(x, (H - h) / 2, 3 * devicePixelRatio, h); c2.fill();
        });
        rec.raf = requestAnimationFrame(draw);
      };
      rec.ctx = ctx; draw();
    } catch { /* no meter, recording still works */ }
    bar.hidden = false; pane.classList.add("recording");
    const tm = $("#rec-time", pane);
    rec.tick = setInterval(async () => {
      const sec = (Date.now() - rec.t0) / 1000;
      tm.textContent = fmtDur(sec);
      if (sec >= VOICE_MAX_SEC) { toast(tx("وصلت لأقصى مدة ({n} دقايق)، هبعتها", { n: VOICE_MAX_SEC / 60 })); const a = await finish(true); if (a) send(a); }
    }, 250);
  };
  $("#rec-cancel", pane).onclick = () => finish(false);
  $("#rec-send", pane).onclick = async () => { const a = await finish(true); if (a) send(a); };
}
// leaving the thread mid-recording discards it
addEventListener("hashchange", () => { if (rec) { try { rec.mr.stop(); } catch {} clearInterval(rec.tick); rec.stream.getTracks().forEach((t) => t.stop()); rec = null; } });

function voiceHtml(m) {
  const a = m.attachment_meta || m._meta || {};
  const peaks = Array.isArray(a.peaks) && a.peaks.length ? a.peaks : Array.from({ length: 40 }, (_, i) => 0.25 + 0.35 * Math.abs(Math.sin(i * 1.7)));
  return `<div class="voice" data-voice="${esc(m.attachment_path || "")}" data-local="${esc(m._local || "")}" data-dur="${a.dur || 0}">
    <button type="button" class="v-play" aria-label="${tx("تشغيل")}">${icon("play")}</button>
    <div class="v-wave" aria-hidden="true">${peaks.map((p) => `<i style="height:${Math.round(Math.max(0.12, p) * 100)}%"></i>`).join("")}</div>
    <span class="v-time">${fmtDur(a.dur)}</span></div>`;
}
let voiceAudio = null, voiceEl = null;
async function voiceUrl(el) {
  if (el.dataset.local) return el.dataset.local;
  const path = el.dataset.voice; if (!path) return null;
  const c = chatImgUrls.get(path);
  if (c && c.exp > Date.now()) return c.url;
  const { data } = await sb.storage.from("chat-files").createSignedUrl(path, 3600);
  if (data?.signedUrl) { chatImgUrls.set(path, { url: data.signedUrl, exp: Date.now() + 3500e3 }); return data.signedUrl; }
  return null;
}
function voiceStop() {
  if (voiceAudio) { voiceAudio.pause(); }
  if (voiceEl) { voiceEl.classList.remove("playing"); $(".v-play", voiceEl).innerHTML = icon("play"); }
}
function wireVoicePlayers(box) {
  $$(".voice", box).forEach((el) => {
    // keep the one that is playing across re-renders
    if (voiceEl && voiceAudio && !voiceAudio.paused && el.dataset.voice && el.dataset.voice === voiceEl.dataset.voice) { voiceEl = el; el.classList.add("playing"); $(".v-play", el).innerHTML = icon("pause"); }
    const play = $(".v-play", el);
    play.onclick = async (e) => {
      e.stopPropagation();
      if (voiceEl === el && voiceAudio && !voiceAudio.paused) return voiceStop();
      voiceStop();
      const url = await voiceUrl(el); if (!url) return toast(tx("مقدرتش أشغّل الرسالة"), true);
      if (!voiceAudio) voiceAudio = new Audio();
      if (voiceAudio._src !== url) { voiceAudio.src = url; voiceAudio._src = url; }
      voiceEl = el;
      const dur = Number(el.dataset.dur) || 0;
      voiceAudio.ontimeupdate = () => {
        if (!voiceEl) return;
        const d = isFinite(voiceAudio.duration) && voiceAudio.duration > 0 ? voiceAudio.duration : dur || 1;
        const pr = Math.min(1, voiceAudio.currentTime / d), bars = $$(".v-wave i", voiceEl), k = Math.round(pr * bars.length);
        bars.forEach((b, i) => b.classList.toggle("on", i < k));
        $(".v-time", voiceEl).textContent = fmtDur(voiceAudio.currentTime);
      };
      voiceAudio.onended = () => { const v = voiceEl; voiceStop(); if (v) { $$(".v-wave i", v).forEach((b) => b.classList.remove("on")); $(".v-time", v).textContent = fmtDur(Number(v.dataset.dur)); } voiceAudio.currentTime = 0; };
      el.classList.add("playing"); play.innerHTML = icon("pause");
      try { await voiceAudio.play(); } catch { voiceStop(); toast(tx("مقدرتش أشغّل الرسالة"), true); }
    };
    // tap on the wave to seek
    $(".v-wave", el).onclick = (e) => {
      if (voiceEl !== el || !voiceAudio || !isFinite(voiceAudio.duration)) return;
      const r = e.currentTarget.getBoundingClientRect();
      const x = document.documentElement.dir === "rtl" ? (r.right - e.clientX) / r.width : (e.clientX - r.left) / r.width;
      voiceAudio.currentTime = Math.max(0, Math.min(1, x)) * voiceAudio.duration;
    };
  });
}

/* ---------- edit a message while it's still unread (DB v25) ---------- */
const groupMsgUnread = (m) => { const g = groupById(m.group_id); return !!g && !g.members.some((x) => x.user_id !== m.sender_id && x.last_read_at && x.last_read_at >= m.created_at); };
async function editChatMessage(m, group = false) {
  const v = await promptDialog({ title: tx("تعديل الرسالة"), value: m.body || "", label: tx("التعديل متاح لحد ما الرسالة تتقري"), ok: "حفظ", max: MSG_MAX, optional: hasAtt(m) });
  if (v === null || v.trim() === (m.body || "").trim()) return;
  const { data, error } = await sb.rpc(group ? "edit_group_message" : "edit_message", { p_id: m.id, p_body: v });
  if (error) return toast(/already_read/.test(error.message) ? tx(group ? "حد في المجموعة قرا الرسالة، مينفعش تتعدل" : "الرسالة اتقرت خلاص، مينفعش تتعدل") : friendly(error), true);
  m.body = v.trim(); m.edited_at = data || new Date().toISOString();
  if (group) { fillGroupThread(m.group_id); fillConvs(null, m.group_id); } else { const pid = partnerOf(m); fillThread(pid); fillConvs(pid); }
  toast(tx("اتعدلت الرسالة"));
}

const takeAttach = (key) => { const a = state.chatAttach?.[key]; if (a) delete state.chatAttach[key]; return a || null; };
const attachHtml = () => `<div class="rec-bar" id="rec-bar" hidden>
        <button type="button" class="icon-btn rec-cancel" id="rec-cancel" aria-label="${tx("إلغاء التسجيل")}" title="${tx("إلغاء التسجيل")}">${icon("trash")}</button>
        <span class="rec-dot" aria-hidden="true"></span><span class="rec-time" id="rec-time">0:00</span>
        <canvas class="rec-wave" id="rec-wave" aria-hidden="true"></canvas>
        <button type="button" class="btn primary rec-send" id="rec-send" aria-label="${tx("إرسال الرسالة الصوتية")}">${icon("send")}</button>
      </div>
      <button type="button" class="icon-btn attach-btn mic-btn" id="mic-btn" aria-label="${tx("رسالة صوتية")}" title="${tx("سجّل رسالة صوتية")}">${icon("mic")}</button>
      <input type="file" id="attach-in" accept="image/*" hidden>
      <button type="button" class="icon-btn attach-btn" id="attach-btn" aria-label="${tx("ابعت صورة")}" title="${tx("ابعت صورة (لحد 1.5 ميجا)")}">${icon("image")}</button>`;
async function loadMessages() {
  const { data, error } = await sb.from("messages").select("*").order("created_at", { ascending: false }).limit(3000);
  if (!error) state.msgs = (data || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}
const partnerOf = (m) => (m.sender_id === state.me.id ? m.recipient_id : m.sender_id);
// hidden on my side?
const msgVisible = (m) => !((m.sender_id === state.me.id && m.deleted_for_sender) || (m.recipient_id === state.me.id && m.deleted_for_recipient));
const visibleMsgs = () => state.msgs.filter(msgVisible);
const chatUnread = (pid) => visibleMsgs().filter((m) => m.recipient_id === state.me.id && !m.read_at && !m.deleted_at && (!pid || m.sender_id === pid)).length;

function conversations() {
  const last = new Map();
  for (const m of visibleMsgs()) last.set(partnerOf(m), m);
  return [...last.entries()].map(([pid, m]) => ({ pid, last: m })).sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));
}

const fmtClock = (d) => new Date(d).toLocaleTimeString(LOCALE(), { hour: "numeric", minute: "2-digit" });
function fmtDay(d) {
  const x = new Date(d), today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(x); day.setHours(0, 0, 0, 0);
  const diff = Math.round((today - day) / 86400000);
  if (diff === 0) return tx("النهارده");
  if (diff === 1) return tx("امبارح");
  return x.toLocaleDateString(LOCALE(), { weekday: "long", day: "numeric", month: "long" });
}
function fmtListTime(d) {
  const x = new Date(d), diff = (Date.now() - x) / 86400000;
  if (new Date().toDateString() === x.toDateString()) return fmtClock(d);
  if (diff < 6) return x.toLocaleDateString(LOCALE(), { weekday: "short" });
  return x.toLocaleDateString(LOCALE(), { day: "numeric", month: "short" });
}
// escape, keep line breaks, linkify http(s) URLs
const msgHtml = (s) => esc(s).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`).replace(/\n/g, "<br>");

function renderChat() {
  const { params } = currentRoute();
  const withId = params.get("with"), groupId = params.get("group");
  const partner = withId && profile(withId);
  const grp = groupId && groupById(groupId);
  if ((withId && (!partner || withId === state.me.id)) || (groupId && !grp)) { location.replace("#/chat"); return; }
  const open = partner || grp;
  document.body.classList.toggle("chat-thread", !!open);
  $("#view").innerHTML = `
    <div class="page-head chat-head-page"><div><h1>المحادثات</h1><p>كلّم أي حد في الفريق مباشرة.</p></div></div>
    <div class="chat ${open ? "has-thread" : ""}">
      <aside class="chat-list">
        <div class="chat-list-top">
          <div class="input-icon chat-search">${icon("search", "sm")}<input class="input" type="search" id="chat-q" placeholder="ابحث باسم الموظف أو المجموعة" value="${esc(state.chatQ || "")}"></div>
          <button class="btn sm primary new-group" id="new-group" title="${tx("مجموعة جديدة")}">${icon("users", "sm")}<span>${tx("مجموعة جديدة")}</span></button>
        </div>
        <div class="chat-convs" id="chat-convs"></div>
      </aside>
      <section class="chat-thread-pane" id="chat-pane">${open ? "" : `<div class="chat-empty"><div class="ill">${icon("chat")}</div><b>اختار حد تكلمه</b><span>الرسايل نصية بس، ومحدش يقدر يشوفها غيركم انتم الاتنين.</span></div>`}</section>
    </div>`;
  fillConvs(withId, groupId);
  sizeChat(); requestAnimationFrame(sizeChat);
  $("#chat-q").oninput = (e) => { state.chatQ = e.target.value; fillConvs(withId, groupId); };
  $("#new-group").onclick = () => openGroupModal();
  if (partner) renderThread(partner);
  else if (grp) renderGroupThread(grp);
}

function fillConvs(activeId, activeGroup = currentRoute().params.get("group")) {
  const box = $("#chat-convs"); if (!box) return;
  const q = (state.chatQ || "").trim().toLowerCase();
  const match = (p) => !q || p.full_name.toLowerCase().includes(q) || (p.job_title || "").toLowerCase().includes(q) || (p.username || "").toLowerCase().includes(q);
  const convs = conversations().filter((c) => profile(c.pid) && match(profile(c.pid)));
  const talked = new Set(convs.map((c) => c.pid));
  const others = state.profiles.filter((p) => p.active && p.id !== state.me.id && !talked.has(p.id) && match(p))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
  const row = (p, last) => {
    const n = chatUnread(p.id);
    const preview = last ? (last.sender_id === state.me.id ? tx("انت: ") : "") + (last.deleted_at ? tx("اتمسحت الرسالة دي") : msgPreviewText(last)) : (p.job_title || "");
    return `<a class="conv ${p.id === activeId ? "on" : ""} ${n ? "unread" : ""}" href="#/chat?with=${p.id}">
      ${avatar(p)}
      <span class="conv-main"><span class="conv-top"><b><bdi>${esc(p.full_name)}</bdi></b>${last ? `<time>${fmtListTime(last.created_at)}</time>` : ""}</span>
        <span class="conv-sub"><span class="conv-prev"><bdi>${esc(preview)}</bdi></span>${n ? `<span class="conv-badge">${n > 99 ? "99+" : n}</span>` : ""}</span></span>
    </a>`;
  };
  const groups = state.groups.filter((g) => !q || g.name.toLowerCase().includes(q)).map((g) => {
    const ms = groupMsgs(g.id); const last = ms[ms.length - 1];
    return { g, last, at: last?.created_at || myMember(g)?.joined_at || g.created_at };
  });
  const grow = ({ g, last }) => {
    const n = groupUnread(g.id);
    const who = last ? (last.sender_id === state.me.id ? tx("انت") : (profile(last.sender_id)?.full_name.split(" ")[0] || "")) : "";
    const preview = last ? `${who}: ${last.deleted_at ? tx("اتمسحت الرسالة دي") : msgPreviewText(last)}` : tx("{n} أعضاء", { n: g.members.length });
    return `<a class="conv ${g.id === activeGroup ? "on" : ""} ${n ? "unread" : ""}" href="#/chat?group=${g.id}">
      ${groupAvatar(g)}
      <span class="conv-main"><span class="conv-top"><b><bdi>${esc(g.name)}</bdi></b>${last ? `<time>${fmtListTime(last.created_at)}</time>` : ""}</span>
        <span class="conv-sub"><span class="conv-prev"><bdi>${esc(preview)}</bdi></span>${n ? `<span class="conv-badge">${n > 99 ? "99+" : n}</span>` : ""}</span></span>
    </a>`;
  };
  // DMs and groups in one list, latest activity first
  const merged = [...convs.map((c) => ({ at: c.last.created_at, html: () => row(profile(c.pid), c.last) })), ...groups.map((x) => ({ at: x.at, html: () => grow(x) }))]
    .sort((a, b) => b.at.localeCompare(a.at));
  box.innerHTML =
    (merged.length ? merged.map((x) => x.html()).join("") : "") +
    (others.length ? `<div class="conv-sep">${convs.length ? "باقي الفريق" : "ابدأ محادثة"}</div>` + others.map((p) => row(p, null)).join("") : "") +
    (!merged.length && !others.length ? `<p class="muted" style="padding:16px;text-align:center">مفيش نتايج</p>` : "");
}

function renderThread(p) {
  const pane = $("#chat-pane");
  const draft = (state.chatDrafts ||= {})[p.id] || "";
  pane.innerHTML = `
    <header class="thread-head">
      <a class="icon-btn thread-back" href="#/chat" aria-label="رجوع">${icon("chev")}</a>
      ${avatar(p)}
      <div class="thread-who" data-pid="${p.id}"><b>${esc(p.full_name)}</b><small>${esc(p.job_title || "")}</small></div>
      <button class="icon-btn thread-min" data-min="u:${p.id}" title="${tx("تصغير لفقاعة")}" aria-label="${tx("تصغير لفقاعة")}">${icon("minimize")}</button>
      <button class="icon-btn thread-clear" id="thread-clear" title="مسح المحادثة عندي" aria-label="مسح المحادثة عندي">${icon("trash")}</button>
    </header>
    <div class="thread-msgs" id="thread-msgs" aria-live="polite"></div>
    <div class="attach-preview" id="attach-preview" hidden></div>
    <form class="composer" id="composer">
      ${attachHtml()}
      <textarea class="input" id="msg-in" rows="1" maxlength="${MSG_MAX}" placeholder="اكتب رسالة…" aria-label="اكتب رسالة">${esc(draft)}</textarea>
      <button class="btn primary send-btn" type="submit" aria-label="إرسال" ${draft.trim() ? "" : "disabled"}>${icon("send")}</button>
    </form>`;
  fillThread(p.id, true);
  wireMinimize(pane);
  $("#thread-clear").onclick = async () => {
    if (!visibleMsgs().some((m) => partnerOf(m) === p.id)) return toast(tx("المحادثة فاضية أصلاً"));
    const ok = await confirmDialog({ title: tx("مسح المحادثة مع {name}؟", { name: p.full_name }), body: tx("الرسايل هتتمسح عندك انت بس، و{name} هيفضل شايفها.", { name: p.full_name.split(" ")[0] }), ok: "مسح" });
    if (!ok) return;
    const { error } = await sb.rpc("clear_conversation", { p_partner: p.id });
    if (error) return toast(friendly(error), true);
    const me = state.me.id;
    state.msgs.forEach((m) => { if (partnerOf(m) === p.id) { if (m.sender_id === me) m.deleted_for_sender = true; else m.deleted_for_recipient = true; } });
    fillThread(p.id, true); fillConvs(p.id); renderChatBadges(); toast(tx("اتمسحت المحادثة"));
  };
  const ta = $("#msg-in"), btn = $(".send-btn", pane);
  const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 160) + "px"; };
  grow();
  const refresh = () => { btn.disabled = !ta.value.trim() && !state.chatAttach?.[p.id]; };
  ta.oninput = () => { state.chatDrafts[p.id] = ta.value; refresh(); grow(); };
  wireAttach(p.id, pane, refresh);
  wireVoice(pane, (att) => sendMessage(p.id, null, "", att));
  ta.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !matchMedia("(hover: none)").matches) { e.preventDefault(); $("#composer").requestSubmit(); }
  };
  $("#composer").onsubmit = (e) => { e.preventDefault(); sendMessage(p.id, ta); };
  if (matchMedia("(hover: hover)").matches) ta.focus();
  markThreadRead(p.id);
}

function fillThread(pid, jump = false) {
  const box = $("#thread-msgs"); if (!box) return;
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  const msgs = visibleMsgs().filter((m) => partnerOf(m) === pid);
  if (!msgs.length) {
    box.innerHTML = `<div class="thread-empty">${avatar(profile(pid), "lg")}<b>${esc(profile(pid)?.full_name || "")}</b><span>ابدأ المحادثة برسالة.</span></div>`;
    return;
  }
  let html = "", lastDay = "", prev = null;
  for (const m of msgs) {
    const day = new Date(m.created_at).toDateString();
    if (day !== lastDay) { html += `<div class="day-sep"><span>${fmtDay(m.created_at)}</span></div>`; lastDay = day; prev = null; }
    const mine = m.sender_id === state.me.id;
    const grouped = prev && prev.sender_id === m.sender_id && (new Date(m.created_at) - new Date(prev.created_at)) < 5 * 60000;
    const status = mine ? (m._pending ? `<span class="tick">${icon("clock", "sm")}</span>` : m._failed ? `<span class="tick bad">${icon("alert", "sm")}</span>` : `<span class="tick ${m.read_at ? "read" : ""}" title="${m.read_at ? tx("اتقرت") : tx("اتبعتت")}">${icon("check", "sm")}${m.read_at ? icon("check", "sm") : ""}</span>`) : "";
    const canAct = !m._pending && !m._failed;
    html += `<div class="msg ${mine ? "mine" : "theirs"} ${grouped ? "grouped" : ""} ${m._failed ? "failed" : ""} ${m.deleted_at ? "deleted" : ""}" data-mid="${m.id}">
      <div class="bubble-row">
        <div class="bubble ${!m.deleted_at && hasImg(m) ? "has-img" : ""} ${!m.deleted_at && hasImg(m) && !(m.body || "").trim() ? "img-only" : ""} ${!m.deleted_at && isVoice(m) ? "has-voice" : ""}">${m.deleted_at ? `<span class="txt gone">${icon("ban", "sm")}${tx(mine ? "انت مسحت الرسالة دي" : "اتمسحت الرسالة دي")}</span>` : `${msgImgHtml(m)}${(m.body || "").trim() ? `<span class="txt" dir="auto">${msgHtml(m.body)}</span>` : ""}`}<span class="meta">${m.edited_at && !m.deleted_at ? `<span class="edited">${tx("معدلة")}</span>` : ""}<time>${fmtClock(m.created_at)}</time>${m.deleted_at ? "" : status}</span></div>
        ${canAct ? `<button class="msg-act" data-act="${m.id}" aria-label="${tx("خيارات الرسالة")}" title="${tx("خيارات الرسالة")}">${icon("dots", "sm")}</button>` : ""}
      </div>
      ${m._failed ? `<button class="retry" data-retry="${m.id}">${tx("مااتبعتتش — اضغط تعيد")}</button>` : ""}
    </div>`;
    prev = m;
  }
    box.innerHTML = html;
  if (jump || nearBottom) box.scrollTop = box.scrollHeight;
  wireMsgImgs(box);
  $$("[data-act]", box).forEach((b) => b.onclick = (e) => { e.stopPropagation(); openMsgActions(b.dataset.act); });
  // long-press / right-click on a bubble opens the same menu
  $$(".msg[data-mid] .bubble", box).forEach((bub) => {
    const id = bub.closest(".msg").dataset.mid;
    if (id.startsWith("tmp-")) return;
    bub.addEventListener("contextmenu", (e) => { e.preventDefault(); openMsgActions(id); });
    let t;
    bub.addEventListener("touchstart", () => { t = setTimeout(() => { t = null; navigator.vibrate?.(15); openMsgActions(id); }, 480); }, { passive: true });
    const cancel = () => clearTimeout(t);
    bub.addEventListener("touchend", cancel); bub.addEventListener("touchmove", cancel); bub.addEventListener("touchcancel", cancel);
  });
  $$("[data-retry]", box).forEach((b) => b.onclick = () => {
    const m = state.msgs.find((x) => x.id === b.dataset.retry);
    if (!m) return;
    state.msgs = state.msgs.filter((x) => x !== m);
    sendMessage(m.recipient_id, null, m.body, m._att);
  });
}

function openMsgActions(id) {
  const m = state.msgs.find((x) => x.id === id);
  if (!m || $("#modal-root .overlay")) return;
  const mine = m.sender_id === state.me.id;
  const ov = openModal(`
    <div class="sheet-grab" aria-hidden="true"></div>
    <div class="msg-preview ${m.deleted_at ? "gone" : ""}" dir="auto">${m.deleted_at ? tx("اتمسحت الرسالة دي") : esc(msgPreviewText(m).length > 160 ? msgPreviewText(m).slice(0, 160) + "…" : msgPreviewText(m))}</div>
    <div class="sheet-list">
      ${mine && !m.deleted_at && !m.read_at && !isVoice(m) ? `<button class="sheet-item" data-do="edit"><span class="si-ic">${icon("edit")}</span><span>${tx("تعديل")}</span></button>` : ""}
      ${!m.deleted_at && (m.body || "").trim() ? `<button class="sheet-item" data-do="copy"><span class="si-ic">${icon("copy")}</span><span>نسخ النص</span></button>` : ""}
      <button class="sheet-item danger" data-do="me"><span class="si-ic">${icon("trash")}</span><span>مسح عندي</span></button>
      ${mine && !m.deleted_at ? `<button class="sheet-item danger" data-do="all"><span class="si-ic">${icon("ban")}</span><span>مسح عند الكل</span></button>` : ""}
    </div>
    <button class="btn ghost" data-close style="width:100%">إلغاء</button>`, { label: "خيارات الرسالة" });
  ov.classList.add("sheet");
  $("[data-close]", ov).onclick = closeModal;
  const copy = $('[data-do="copy"]', ov);
  if (copy) copy.onclick = async () => { closeModal(); try { await navigator.clipboard.writeText(m.body); toast(tx("اتنسخ")); } catch { toast(tx("مقدرتش أنسخ"), true); } };
  $('[data-do="me"]', ov).onclick = () => { closeModal(); deleteMessages(m, false); };
  const ed = $('[data-do="edit"]', ov); if (ed) ed.onclick = () => { closeModal(); editChatMessage(m); };
  const all = $('[data-do="all"]', ov);
  if (all) all.onclick = async () => {
    closeModal();
    const ok = await confirmDialog({ title: tx("مسح الرسالة عند الكل؟"), body: tx("الرسالة هتتمسح عندك وعند {name}، وهيظهر مكانها إنها اتمسحت.", { name: profile(m.recipient_id)?.full_name || "" }), ok: "مسح عند الكل" });
    if (ok) deleteMessages(m, true);
  };
}

async function deleteMessages(m, forEveryone) {
  const { data, error } = await sb.rpc("delete_messages", { p_ids: [m.id], p_for_everyone: forEveryone });
  if (error) return toast(friendly(error), true);
  if (!data) return toast(tx("مقدرتش أمسح الرسالة"), true);
  if (forEveryone) { m.body = ""; m.deleted_at = new Date().toISOString(); m.attachment_path = null; m.attachment_meta = null; }
  else if (m.sender_id === state.me.id) m.deleted_for_sender = true; else m.deleted_for_recipient = true;
  const pid = partnerOf(m);
  fillThread(pid); fillConvs(pid); renderChatBadges();
  toast(tx(forEveryone ? "اتمسحت عند الكل" : "اتمسحت عندك"));
}

async function sendMessage(pid, ta, bodyOverride, attOverride) {
  const body = (bodyOverride ?? ta.value).trim();
  const att = attOverride ?? (ta ? takeAttach(pid) : null);
  if (!body && !att) return;
  if (body.length > MSG_MAX) return toast(tx("الرسالة طويلة أوي"), true);
  const temp = { id: "tmp-" + Math.random().toString(36).slice(2), sender_id: state.me.id, recipient_id: pid, body, created_at: new Date().toISOString(), read_at: null, _pending: true,
    _local: att?.url || null, _meta: imgMeta(att), _att: att };
  state.msgs.push(temp);
  if (ta) { ta.value = ""; state.chatDrafts[pid] = ""; ta.style.height = "auto"; ta.focus(); $(".send-btn")?.setAttribute("disabled", ""); const ap = $("#attach-preview"); if (ap) { ap.hidden = true; ap.innerHTML = ""; } }
  fillThread(pid, true); fillConvs(pid);
  let data = null, error = null;
  try {
    const path = att ? await uploadChatImage(att) : null;
    if (path) chatImgUrls.set(path, { url: att.url, exp: Date.now() + 3500e3 });
    ({ data, error } = await sb.from("messages").insert({ sender_id: state.me.id, recipient_id: pid, body, attachment_path: path, attachment_meta: imgMeta(att) }).select().single());
  } catch (e) { error = e; }
  if (error || !data) { temp._pending = false; temp._failed = true; toast(friendly(error || new Error("send failed")), true); }
  else {
    const i = state.msgs.indexOf(temp);
    if (state.msgs.some((m) => m.id === data.id)) state.msgs.splice(i, 1); // realtime got there first
    else state.msgs[i] = data;
  }
  if (currentRoute().page === "chat" || miniOpenWith() === pid) { fillThread(pid); fillConvs(currentRoute().params.get("with")); }
}

let readBusy = false;
async function markThreadRead(pid) {
  if (readBusy || document.hidden) return;
  const ids = state.msgs.filter((m) => m.sender_id === pid && m.recipient_id === state.me.id && !m.read_at).map((m) => m.id);
  if (!ids.length) return;
  readBusy = true;
  const now = new Date().toISOString();
  state.msgs.forEach((m) => { if (ids.includes(m.id)) m.read_at = now; });
  renderChatBadges(); fillConvs(pid);
  await sb.from("messages").update({ read_at: now }).in("id", ids);
  readBusy = false;
}

function renderChatBadges() {
  const n = chatUnread() + groupsUnread();
  $$("[data-chat-badge]").forEach((el) => { el.textContent = n > 99 ? "99+" : n; el.hidden = !n; });
}

function onMessageRealtime(evt, m) {
  if (!m || !state.me) return;
  const i = state.msgs.findIndex((x) => x.id === m.id);
  if (evt === "INSERT") {
    if (i >= 0) return;
    if (m.sender_id === state.me.id) {
      // our own message from another device (or a race with our own insert)
      const pending = state.msgs.find((x) => x._pending && x.body === m.body && x.recipient_id === m.recipient_id);
      if (pending) return; // sendMessage will reconcile
    }
    state.msgs.push(m);
  } else if (evt === "UPDATE") {
    if (i >= 0) state.msgs[i] = { ...state.msgs[i], ...m };
  }
  const r = currentRoute();
  const openWith = r.page === "chat" ? r.params.get("with") : miniOpenWith();
  const pid = partnerOf(m);
  if (openWith === pid) { fillThread(pid); if (evt === "INSERT" && m.recipient_id === state.me.id) markThreadRead(pid); }
  if (r.page === "chat") fillConvs(openWith);
  renderChatBadges();
  if (evt === "INSERT" && m.recipient_id === state.me.id && openWith !== pid) {
    chatHeadPush("u", m.sender_id, msgPreviewText(m));
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden || !state.me) return;
  const r = currentRoute();
  if (r.page === "chat" && r.params.get("with")) markThreadRead(r.params.get("with"));
  if (r.page === "chat" && r.params.get("group")) markGroupRead(r.params.get("group"));
});

/* =====================================================================
   Attendance (stand-up) + points
   ===================================================================== */
const PTS = { present: 0, absent: -3, every3: -10 };
const cairoToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
const cairoDay = (ts) => new Date(ts).toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
const dayName = (i, style = "long") => new Date(2026, 0, 4 + i).toLocaleDateString(LOCALE(), { weekday: style });
const fmtDayLong = (d) => new Date(d + "T12:00:00").toLocaleDateString(LOCALE(), { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtDayShort = (d) => new Date(d + "T12:00:00").toLocaleDateString(LOCALE(), { weekday: "short", day: "numeric", month: "short" });
const isTaker = () => !!state.me && (state.me.is_admin || state.att.takers.has(state.me.id));
const signed = (n) => (n > 0 ? "+" : "") + n;
const signedH = (n) => `<bdi dir="ltr">${signed(n)}</bdi>`;
// points cycle: 16th of a month -> 15th of the next; everyone starts each cycle at 100
const PTS_BASE = 100;
const pad2 = (n) => String(n).padStart(2, "0");
function cycleStartOf(d) { let [y, m, dd] = d.split("-").map(Number); if (dd < 16) { m--; if (!m) { m = 12; y--; } } return `${y}-${pad2(m)}-16`; }
function cycleEndOf(st) { let [y, m] = st.split("-").map(Number); m++; if (m > 12) { m = 1; y++; } return `${y}-${pad2(m)}-15`; }
const inCycle = (d, st) => d >= st && d <= cycleEndOf(st);
const curCycle = () => cycleStartOf(cairoToday());
const awardDay = (a) => new Date(a.created_at).toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
const fmtDM = (d) => new Date(d + "T12:00:00").toLocaleDateString(LOCALE(), { day: "numeric", month: "long" });
const cycleLabel = (st) => tx("من {a} لـ {b}", { a: fmtDM(st), b: fmtDM(cycleEndOf(st)) });
const ptsTone = (t) => (t > PTS_BASE ? "pos" : t < PTS_BASE ? "neg" : "");
function cycleList() {
  const A = state.att, cur = curCycle();
  let first = cur;
  for (const ss of A.sessions) { const c = cycleStartOf(ss.day); if (c < first) first = c; }
  for (const a of A.awards) { const c = cycleStartOf(awardDay(a)); if (c < first) first = c; }
  const out = [];
  for (let c = cur; c >= first && out.length < 60; ) { out.push(c); let [y, m] = c.split("-").map(Number); m--; if (!m) { m = 12; y--; } c = `${y}-${pad2(m)}-16`; }
  return out;
}
async function loadCyclePoints(st) {
  const { data, error } = await sb.rpc("points_summary", { p_start: st });
  if (error) throw error;
  state.att.cyclePoints = new Map((data || []).map((r) => [r.user_id, r]));
  state.att.cyclePointsFor = st;
}
function cyclePicker() {
  const A = state.att, list = cycleList();
  return `<div class="cycle-pick"><span>${icon("calendar", "sm")}الدورة</span><select class="input" id="cycle-sel">${list.map((c, i) => `<option value="${c}" ${c === A.cycle ? "selected" : ""}>${cycleLabel(c)}${i === 0 ? " · " + tx("الحالية") : ""}</option>`).join("")}</select></div>`;
}
function wireCyclePicker(rerender) {
  const sel = $("#cycle-sel"); if (!sel) return;
  sel.onchange = async () => {
    state.att.cycle = sel.value;
    try { if (sel.value !== curCycle()) await loadCyclePoints(sel.value); } catch (e) { return toast(friendly(e), true); }
    rerender();
  };
}
const pointsFor = () => (state.att.cycle && state.att.cycle !== curCycle() && state.att.cyclePointsFor === state.att.cycle ? state.att.cyclePoints : state.att.points);

async function loadAttMeta() {
  const [tk, st, pts] = await Promise.all([
    sb.from("attendance_takers").select("user_id"),
    sb.from("standup_settings").select("weekdays").eq("id", 1).single(),
    sb.rpc("points_summary"),
  ]);
  if (!tk.error) state.att.takers = new Set((tk.data || []).map((r) => r.user_id));
  if (!st.error && st.data) state.att.days = st.data.weekdays || [];
  if (!pts.error) state.att.points = new Map((pts.data || []).map((r) => [r.user_id, r]));
  if (state.att.cycle && state.att.cycle !== curCycle()) { try { await loadCyclePoints(state.att.cycle); } catch (e) { console.error(e); } }
}
async function loadAttData() {
  const [ss, at, aw] = await Promise.all([
    sb.from("attendance_sessions").select("*").order("day", { ascending: false }).limit(1000),
    sb.from("attendance").select("*").order("day", { ascending: false }).limit(20000),
    sb.from("points_awards").select("*").order("created_at", { ascending: false }).limit(2000),
  ]);
  for (const r of [ss, at, aw]) if (r.error) throw r.error;
  state.att.sessions = ss.data || [];
  state.att.rows = at.data || [];
  state.att.awards = aw.data || [];
  state.att.loaded = true;
}
const myPoints = (id = state.me.id, map = state.att.points) => map.get(id) || { total: PTS_BASE, present: 0, absent: 0, penalty: 0, thanks: 0 };

function pointsBoardHtml(limit = 0, map = state.att.points) {
  const people = state.profiles.filter((p) => p.active).map((p) => ({ p, s: myPoints(p.id, map) }))
    .sort((a, b) => b.s.total - a.s.total || a.p.full_name.localeCompare(b.p.full_name, "ar"));
  const list = limit ? people.slice(0, limit) : people;
  let rank = 0, prev = null;
  return `<div class="pts-board">${list.map((x, i) => {
    if (x.s.total !== prev) { rank = i + 1; prev = x.s.total; }
    return `<div class="pts-row ${x.p.id === state.me.id ? "me" : ""}">
      <span class="pts-rank r${Math.min(rank, 4)}">${rank}</span>
      <div class="person">${avatar(x.p, "sm")}<div><b>${esc(x.p.full_name)}</b><small>${esc(x.p.job_title || "")}</small></div></div>
      <b class="pts-val ${ptsTone(x.s.total)}">${x.s.total}</b>
    </div>`;
  }).join("")}</div>`;
}

function homePointsCard() {
  const s = myPoints();
  return `
    <section class="mini-card pts-card">
      <h3>${icon("trophy", "sm")}نقاطي</h3>
      <p class="pts-cycle">${cycleLabel(curCycle())}</p>
      <div class="pts-big ${ptsTone(s.total)}"><b>${s.total}</b><span>${tx("من {n} نقطة", { n: PTS_BASE })}</span></div>
      <div class="pts-break">
        <span class="ok">${icon("check", "sm")}${tx("حضور {n}", { n: s.present })}</span>
        <span class="bad">${icon("close", "sm")}${tx("غياب {n}", { n: s.absent })}</span>
        ${s.thanks ? `<span class="thx">${icon("trophy", "sm")}${tx("شكر {n}", { n: signedH(s.thanks) })}</span>` : ""}
      </div>
      <a class="see-all" href="#/attendance">تفاصيل نقاطي</a>
    </section>
    <section class="mini-card">
      <h3>${icon("team", "sm")}ترتيب النقاط</h3>
      ${pointsBoardHtml(8)}
      <a class="see-all" href="#/attendance">الترتيب كامل</a>
    </section>`;
}

/* ---------- page ---------- */
async function renderAttendance() {
  const view = $("#view");
  if (!state.att.loaded) {
    view.innerHTML = `<div class="page-head"><div><h1>الحضور والنقاط</h1></div></div><div class="lb-skel">${"<i></i>".repeat(5)}</div>`;
    try { await Promise.all([loadAttData(), loadAttMeta()]); }
    catch (e) { view.innerHTML = `<div class="empty"><b>${esc(friendly(e))}</b></div>`; return; }
    if (currentRoute().page !== "attendance") return;
  }
  const A = state.att, me = state.me, s = myPoints();
  const taker = isTaker();
  const tabs = [["me", "نقاطي"], ["board", "الترتيب"], ["log", "سجل الغياب"]];
  if (taker) tabs.unshift(["take", "تسجيل الغياب"]);
  if (me.is_admin) tabs.push(["admin", "الإعدادات والشكر"]);
  if (!tabs.some(([k]) => k === A.tab)) A.tab = taker ? "take" : "me";
  if (!A.cycle) A.cycle = curCycle();

  view.innerHTML = `
    <div class="page-head hero">
      <div><h1>الحضور والنقاط</h1>
        <p>${tx("الدورة الحالية {range}", { range: cycleLabel(curCycle()) })} · ${tx("الاستاند أب: {days}", { days: A.days.length ? A.days.slice().sort().map((d) => dayName(d)).join(LANG === "en" ? ", " : "، ") : tx("مفيش أيام متحددة") })}</p></div>
      <div class="att-head-actions">
        ${canExportAtt() ? `<button class="btn ghost" id="att-export">${icon("download")}${tx("تصدير PDF")}</button>` : ""}
        <div class="pts-head-me ${ptsTone(s.total)}">${icon("trophy", "sm")}<span>${tx("رصيدك")}</span><b>${s.total}</b></div>
      </div>
      <div class="rules">
        <span class="rule base"><b>${PTS_BASE}</b>رصيد البداية كل دورة (من يوم 16 لـ يوم 15)</span>
        <span class="rule bad"><b>${PTS.absent}</b>غياب</span>
        <span class="rule bad"><b>${PTS.every3}</b>إضافية مع كل 3 غيابات في نفس الدورة</span>
        <span class="rule thx"><b>+</b>نقاط شكر من الإدارة</span>
      </div>
    </div>
    <div class="tabs" role="tablist"><span class="pill-bg"></span>${tabs.map(([k, l]) => `<button class="tab ${A.tab === k ? "on" : ""}" data-atab="${k}" role="tab" aria-selected="${A.tab === k}">${l}</button>`).join("")}</div>
    <div id="att-body"></div>`;
  $$("[data-atab]").forEach((b) => b.onclick = () => { A.tab = b.dataset.atab; state.animate = false; renderAttendance(); });
  const ax = $("#att-export"); if (ax) ax.onclick = openAttExport;
  placeTabPill(view);
  ({ take: attTake, me: attMine, board: attBoard, log: attLog, admin: attAdmin })[A.tab]();
}

function attMine() {
  const A = state.att, me = state.me.id, cyc = A.cycle || curCycle();
  const s = myPoints(me, pointsFor());
  const rows = A.rows.filter((r) => r.user_id === me && inCycle(r.day, cyc));
  let absN = 0;
  const events = [];
  rows.slice().sort((a, b) => a.day.localeCompare(b.day)).forEach((r) => {
    if (r.status === "absent") {
      absN++;
      events.push({ when: r.day, pts: PTS.absent, label: tx("غياب عن الاستاند أب"), kind: "bad" });
      if (absN % 3 === 0) events.push({ when: r.day, pts: PTS.every3, label: tx("خصم تكرار الغياب ({n} غيابات في الدورة)", { n: absN }), kind: "bad" });
    }
  });
  A.awards.filter((a) => a.user_id === me && inCycle(awardDay(a), cyc)).forEach((a) => events.push({ when: awardDay(a), pts: a.points, label: tx("نقاط شكر") + (a.reason ? ` — ${a.reason}` : ""), kind: "thx", by: a.given_by }));
  events.sort((a, b) => b.when.localeCompare(a.when));
  const isCur = cyc === curCycle();
  $("#att-body").innerHTML = `
    ${cyclePicker()}
    <div class="stats">
      <div class="stat ${s.total < PTS_BASE ? "t-bad" : "t-ok"}"><div class="ico">${icon("trophy")}</div><b>${s.total}</b><span>${isCur ? tx("رصيدك في الدورة دي") : tx("رصيدك في آخر الدورة")}</span></div>
      <div class="stat t-ok"><div class="ico">${icon("check")}</div><b>${s.present}</b><span>مرات الحضور</span></div>
      <div class="stat t-bad"><div class="ico">${icon("close")}</div><b>${s.absent}</b><span>مرات الغياب</span></div>
      <div class="stat t-warn"><div class="ico">${icon("alert")}</div><b>${s.penalty ? "−" + s.penalty : 0}</b><span>${isCur && s.absent % 3 === 2 ? tx("خصم التكرار — الغياب الجاي عليه −10") : tx("خصم تكرار الغياب")}</span></div>
    </div>
    <section class="card-box">
      <h3>${icon("history", "sm")}سجل نقاطي</h3>
      <div class="pts-log">
        ${events.map((e) => `
        <div class="pl-row k-${e.kind}">
          <span class="pl-dot">${icon(e.kind === "ok" ? "check" : e.kind === "thx" ? "trophy" : "close", "sm")}</span>
          <div class="pl-main"><b dir="auto">${esc(e.label)}</b><small>${fmtDayLong(e.when)}${e.by && profile(e.by) ? " · " + tx("من {name}", { name: esc(profile(e.by).full_name) }) : ""}</small></div>
          <b class="pl-pts">${signedH(e.pts)}</b>
        </div>`).join("")}
        <div class="pl-row k-base">
          <span class="pl-dot">${icon("flag", "sm")}</span>
          <div class="pl-main"><b>${tx("رصيد بداية الدورة")}</b><small>${fmtDayLong(cyc)}</small></div>
          <b class="pl-pts">${PTS_BASE}</b>
        </div>
      </div>
    </section>`;
  wireCyclePicker(attMine);
}

function attBoard() {
  $("#att-body").innerHTML = `${cyclePicker()}<section class="card-box">${pointsBoardHtml(0, pointsFor())}</section>`;
  wireCyclePicker(attBoard);
}

function attLog() {
  const A = state.att;
  const byDay = new Map();
  A.rows.forEach((r) => { if (!byDay.has(r.day)) byDay.set(r.day, []); byDay.get(r.day).push(r); });
  $("#att-body").innerHTML = A.sessions.length ? `<div class="att-log">${A.sessions.map((ss) => {
    const rows = byDay.get(ss.day) || [];
    const abs = rows.filter((r) => r.status === "absent").map((r) => profile(r.user_id)).filter(Boolean);
    const pres = rows.filter((r) => r.status === "present").length;
    return `<div class="al-row">
      <div class="al-date"><b>${fmtDayShort(ss.day)}</b><small>${tx("سجّله {name}", { name: esc(profile(ss.updated_by || ss.taken_by)?.full_name || "—") })}</small></div>
      <div class="al-counts"><span class="ok">${tx("{n} حاضر", { n: pres })}</span><span class="bad">${tx("{n} غايب", { n: abs.length })}</span></div>
      <div class="al-abs">${abs.length ? abs.map((p) => `<span class="al-chip">${avatar(p, "xs")}${esc(p.full_name)}</span>`).join("") : `<span class="meta">${tx("الكل حضر")} 🎉</span>`}</div>
      ${isTaker() ? `<button class="btn sm ghost" data-edit-day="${ss.day}">${icon("edit", "sm")}تعديل</button>` : ""}
    </div>`;
  }).join("")}</div>` : `<div class="empty"><div class="ill">${icon("calendar")}</div><b>لسه مفيش غياب متسجل</b>${isTaker() ? "ابدأ من تبويب «تسجيل الغياب»." : "مسؤول الغياب هو اللي بيسجله بعد كل استاند أب."}</div>`;
  $$("[data-edit-day]").forEach((b) => b.onclick = () => { state.att.day = b.dataset.editDay; state.att.tab = "take"; renderAttendance(); });
}

function attTake() {
  const A = state.att;
  const today = cairoToday();
  if (!A.day) {
    // default: today if it's a standup day, otherwise the most recent standup day
    let d = new Date(today + "T12:00:00");
    for (let i = 0; i < 7 && A.days.length && !A.days.includes(d.getDay()); i++) d.setDate(d.getDate() - 1);
    A.day = d.toLocaleDateString("en-CA");
  }
  const day = A.day;
  const session = A.sessions.find((x) => x.day === day);
  const existing = new Map(A.rows.filter((r) => r.day === day).map((r) => [r.user_id, r.status]));
  const people = state.profiles.filter((p) => p.active || existing.has(p.id)).sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
  if (A.draftDay !== day) { A.draft = new Map(people.map((p) => [p.id, existing.get(p.id) || "present"])); A.draftDay = day; }
  const wd = new Date(day + "T12:00:00").getDay();
  const absentN = [...A.draft.values()].filter((v) => v === "absent").length;
  $("#att-body").innerHTML = `
    <section class="card-box take-box">
      <div class="take-top">
        <label class="field" style="margin:0"><span>يوم الاستاند أب</span><input class="input" type="date" id="att-day" value="${day}" max="${today}"></label>
        <div class="take-info">
          <b>${fmtDayLong(day)}</b>
          ${session ? `<span class="pill s-review">${tx("متسجل قبل كده — بتعدّل")}</span>` : `<span class="pill s-todo">${tx("تسجيل جديد")}</span>`}
          ${A.days.length && !A.days.includes(wd) ? `<span class="pill s-blocked">${tx("اليوم ده مش من أيام الاستاند أب")}</span>` : ""}
        </div>
      </div>
      <div class="take-tools">
        <span class="meta">${tx("دوس على الشخص عشان تغيّره لغايب. الكل حاضر في الأول.")}</span>
        <span class="take-count"><span class="ok">${tx("{n} حاضر", { n: people.length - absentN })}</span><span class="bad">${tx("{n} غايب", { n: absentN })}</span></span>
      </div>
      <div class="take-grid">${people.map((p) => {
        const st = A.draft.get(p.id) || "present";
        return `<button type="button" class="take-p ${st}" data-tp="${p.id}" aria-pressed="${st === "absent"}">
          ${avatar(p)}<span class="tp-name"><b>${esc(p.full_name)}</b><small>${esc(p.job_title || "")}</small></span>
          <span class="tp-st">${icon(st === "absent" ? "close" : "check", "sm")}${st === "absent" ? tx("غايب") : tx("حاضر")}</span>
        </button>`;
      }).join("")}</div>
      <div class="modal-foot">
        ${session ? `<button class="btn danger ghost" id="att-del">${icon("trash", "sm")}مسح تسجيل اليوم ده</button><span class="spacer"></span>` : ""}
        <button class="btn primary" id="att-save">${icon("check")}${session ? "حفظ التعديل" : "حفظ الغياب"}</button>
      </div>
    </section>`;
  $("#att-day").onchange = (e) => { if (!e.target.value) return; A.day = e.target.value; attTake(); };
  $$("[data-tp]").forEach((b) => b.onclick = () => {
    const id = b.dataset.tp;
    A.draft.set(id, A.draft.get(id) === "absent" ? "present" : "absent");
    const y = window.scrollY; attTake(); window.scrollTo({ top: y });
  });
  $("#att-save").onclick = async (e) => {
    const btn = e.currentTarget; btn.disabled = true;
    const rows = [...A.draft.entries()].map(([user_id, status]) => ({ user_id, status }));
    const { error } = await sb.rpc("save_attendance", { p_day: day, p_rows: rows });
    if (error) { btn.disabled = false; return toast(friendly(error), true); }
    await Promise.all([loadAttData(), loadAttMeta()]);
    A.draftDay = null;
    toast(tx("اتسجل غياب {day}", { day: fmtDayShort(day) }));
    attTake(); renderNavPts();
  };
  const del = $("#att-del");
  if (del) del.onclick = async () => {
    const ok = await confirmDialog({ title: tx("مسح تسجيل {day}؟", { day: fmtDayShort(day) }), body: tx("الحضور والغياب بتوع اليوم ده هيتمسحوا والنقاط هتتحسب من غيرهم."), ok: "مسح" });
    if (!ok) return;
    const { data, error } = await sb.from("attendance_sessions").delete().eq("day", day).select("day");
    if (error || !data?.length) return toast(error ? friendly(error) : tx("مقدرتش أمسح"), true);
    await Promise.all([loadAttData(), loadAttMeta()]);
    A.draftDay = null; toast(tx("اتمسح")); attTake();
  };
}

function attAdmin() {
  const A = state.att;
  const takers = state.profiles.filter((p) => A.takers.has(p.id));
  const candidates = state.profiles.filter((p) => p.active && !p.is_admin && !A.takers.has(p.id)).sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
  const active = state.profiles.filter((p) => p.active).sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
  $("#att-body").innerHTML = `
    <div class="att-admin">
      <section class="card-box">
        <h3>${icon("calendar", "sm")}أيام الاستاند أب</h3>
        <div class="day-chips">${[0, 1, 2, 3, 4, 5, 6].map((d) => `<label class="day-chip"><input type="checkbox" value="${d}" ${A.days.includes(d) ? "checked" : ""}><span>${dayName(d)}</span></label>`).join("")}</div>
        <button class="btn sm primary" id="days-save" style="margin-top:12px">حفظ الأيام</button>
      </section>
      <section class="card-box">
        <h3>${icon("users", "sm")}مسؤولين الغياب</h3>
        <p class="meta" style="margin-top:0">الأدمن يقدر يسجل الغياب دايمًا. ضيف هنا أي حد تاني يسجله ويعدّله بأثر رجعي.</p>
        <div class="taker-list">${takers.length ? takers.map((p) => `<div class="taker">${avatar(p, "sm")}<span><b>${esc(p.full_name)}</b><small>${esc(p.job_title || "")}</small></span><button class="icon-btn" data-rm-taker="${p.id}" aria-label="شيل" title="شيل">${icon("close", "sm")}</button></div>`).join("") : `<p class="meta">مفيش مسؤولين غيرك لسه.</p>`}</div>
        <div class="taker-add"><select class="input" id="taker-sel"><option value="">اختار موظف…</option>${candidates.map((p) => `<option value="${p.id}">${esc(p.full_name)}${p.job_title ? " — " + esc(p.job_title) : ""}</option>`).join("")}</select><button class="btn primary" id="taker-add">${icon("plus", "sm")}إضافة</button></div>
      </section>
      <section class="card-box span2">
        <h3>${icon("trophy", "sm")}نقاط شكر</h3>
        <form class="thx-form" id="thx-form">
          <select class="input" name="user" required><option value="">الموظف…</option>${active.map((p) => `<option value="${p.id}">${esc(p.full_name)}</option>`).join("")}</select>
          <input class="input" name="points" type="number" min="1" max="1000" step="1" placeholder="عدد النقاط" required>
          <input class="input" name="reason" maxlength="300" placeholder="السبب (اختياري)">
          <button class="btn primary" type="submit">${icon("plus", "sm")}إضافة النقاط</button>
        </form>
        ${A.awards.length ? `<div class="pts-log">${A.awards.slice(0, 50).map((a) => `
          <div class="pl-row k-thx">
            <span class="pl-dot">${icon("trophy", "sm")}</span>
            <div class="pl-main"><b>${esc(profile(a.user_id)?.full_name || "—")}</b><small dir="auto">${a.reason ? esc(a.reason) + " · " : ""}${fmtDayLong(a.created_at.slice(0, 10))}</small></div>
            <b class="pl-pts">+${a.points}</b>
            <button class="icon-btn" data-rm-award="${a.id}" aria-label="مسح" title="مسح">${icon("trash", "sm")}</button>
          </div>`).join("")}</div>` : ""}
      </section>
    </div>`;
  $("#days-save").onclick = async () => {
    const days = $$(".day-chip input:checked").map((i) => Number(i.value));
    const { error } = await sb.from("standup_settings").update({ weekdays: days, updated_by: state.me.id, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) return toast(friendly(error), true);
    A.days = days; toast(tx("اتحفظت أيام الاستاند أب")); renderAttendance();
  };
  $("#taker-add").onclick = async () => {
    const id = $("#taker-sel").value; if (!id) return;
    const { error } = await sb.from("attendance_takers").insert({ user_id: id, added_by: state.me.id });
    if (error) return toast(friendly(error), true);
    A.takers.add(id); toast(tx("بقى مسؤول غياب")); attAdmin();
  };
  $$("[data-rm-taker]").forEach((b) => b.onclick = async () => {
    const { error } = await sb.from("attendance_takers").delete().eq("user_id", b.dataset.rmTaker);
    if (error) return toast(friendly(error), true);
    A.takers.delete(b.dataset.rmTaker); attAdmin();
  });
  $("#thx-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target), btn = e.submitter; btn.disabled = true;
    const row = { user_id: f.get("user"), points: Number(f.get("points")), reason: String(f.get("reason") || "").trim() || null, given_by: state.me.id };
    const { error } = await sb.from("points_awards").insert(row);
    btn.disabled = false;
    if (error) return toast(friendly(error), true);
    await Promise.all([loadAttData(), loadAttMeta()]);
    toast(tx("اتضافت {n} نقطة لـ {name}", { n: row.points, name: profile(row.user_id)?.full_name || "" })); attAdmin();
  };
  $$("[data-rm-award]").forEach((b) => b.onclick = async () => {
    const ok = await confirmDialog({ title: tx("مسح نقاط الشكر دي؟"), ok: "مسح" }); if (!ok) return;
    const { data, error } = await sb.from("points_awards").delete().eq("id", b.dataset.rmAward).select("id");
    if (error || !data?.length) return toast(error ? friendly(error) : tx("مقدرتش أمسح"), true);
    await Promise.all([loadAttData(), loadAttMeta()]); attAdmin();
  });
}
function renderNavPts() { /* points live in the page header & home; nothing in the nav */ }


/* ---------- attendance & points PDF export ---------- */
const canExportAtt = () => isTaker() || isManager();

// every points event per person (absence -3, every 3rd absence in a cycle -10, thanks +n), dated
function pointsEvents() {
  const A = state.att, ev = new Map();
  const push = (uid, e) => { if (!ev.has(uid)) ev.set(uid, []); ev.get(uid).push(e); };
  const abs = new Map();
  A.rows.filter((r) => r.status === "absent").sort((a, b) => a.day.localeCompare(b.day)).forEach((r) => {
    const k = r.user_id + "|" + cycleStartOf(r.day);
    const n = (abs.get(k) || 0) + 1; abs.set(k, n);
    push(r.user_id, { day: r.day, kind: "abs", pts: PTS.absent });
    if (n % 3 === 0) push(r.user_id, { day: r.day, kind: "rep", pts: PTS.every3, n });
  });
  A.awards.forEach((a) => push(a.user_id, { day: awardDay(a), kind: "thx", pts: a.points, reason: a.reason, by: a.given_by }));
  return ev;
}

function buildAttReport({ from, to, cycle, userId }) {
  const A = state.att, ev = pointsEvents();
  const inR = (d) => d >= from && d <= to;
  const sessions = A.sessions.filter((s) => inR(s.day)).sort((a, b) => a.day.localeCompare(b.day));
  const rowsR = A.rows.filter((r) => inR(r.day));
  let people = state.profiles.filter((p) => p.active || rowsR.some((r) => r.user_id === p.id));
  if (userId) people = people.filter((p) => p.id === userId);
  const list = people.map((p) => {
    const mine = rowsR.filter((r) => r.user_id === p.id);
    const present = mine.filter((r) => r.status === "present").length;
    const absent = mine.length - present;
    const es = (ev.get(p.id) || []).filter((e) => inR(e.day));
    const absDed = es.filter((e) => e.kind === "abs").reduce((s, e) => s + e.pts, 0);
    const repDed = es.filter((e) => e.kind === "rep").reduce((s, e) => s + e.pts, 0);
    const thanks = es.filter((e) => e.kind === "thx").reduce((s, e) => s + e.pts, 0);
    const net = absDed + repDed + thanks;
    return { p, present, absent, rate: mine.length ? Math.round(present / mine.length * 100) : null, absDed, repDed, thanks, net, balance: cycle ? PTS_BASE + net : null, events: es.sort((a, b) => a.day.localeCompare(b.day)) };
  }).sort((a, b) => (cycle ? b.balance - a.balance : b.net - a.net) || a.absent - b.absent || a.p.full_name.localeCompare(b.p.full_name, "ar"));
  const totP = list.reduce((s, x) => s + x.present, 0), totA = list.reduce((s, x) => s + x.absent, 0);
  return { from, to, cycle, userId, sessions, rowsR, list, totP, totA, rate: totP + totA ? Math.round(totP / (totP + totA) * 100) : null };
}

function attReportHtml(R) {
  const one = R.userId && R.list[0];
  const period = R.cycle ? tx("دورة {range}", { range: cycleLabel(R.cycle) }) : tx("من {a} لـ {b}", { a: fmtDayLong(R.from), b: fmtDayLong(R.to) });
  const n = (v) => `<bdi dir="ltr">${v > 0 ? "+" + v : v}</bdi>`;
  const byDay = new Map();
  R.rowsR.forEach((r) => { if (!byDay.has(r.day)) byDay.set(r.day, []); byDay.get(r.day).push(r); });
  return `
    <div class="pd-head">
      <img src="assets/logo-white.png" alt="">
      <div><b>${tx("تقرير الحضور والنقاط")}${one ? " — " + esc(one.p.full_name) : ""}</b><span>${period}</span></div>
      <small>${tx("اتطبع {date}", { date: new Date().toLocaleString(LOCALE(), { dateStyle: "medium", timeStyle: "short" }) })}</small>
    </div>
    <p class="pd-rules">${tx("القواعد: الرصيد بيبدأ {base} نقطة كل دورة (من يوم 16 لـ يوم 15) · الغياب {a} · مع كل 3 غيابات في نفس الدورة {r} إضافية · نقاط الشكر بتتضاف.", { base: PTS_BASE, a: PTS.absent, r: PTS.every3 })}</p>
    <div class="pd-stats">
      <div><b>${R.sessions.length}</b><span>${tx("استاند أب متسجل")}</span></div>
      <div><b>${R.totP}</b><span>${tx("مرات حضور")}</span></div>
      <div><b>${R.totA}</b><span>${tx("مرات غياب")}</span></div>
      <div><b>${R.rate === null ? "—" : R.rate + "%"}</b><span>${tx("نسبة الحضور")}</span></div>
    </div>
    <h3>${one ? tx("الملخص") : tx("نقاط الموظفين")}</h3>
    <table class="pd-t">
      <thead><tr><th>#</th><th>${tx("الموظف")}</th><th>${tx("حضور")}</th><th>${tx("غياب")}</th><th>${tx("نسبة الحضور")}</th><th>${tx("خصم الغياب")}</th><th>${tx("خصم التكرار")}</th><th>${tx("نقاط شكر")}</th><th>${R.cycle ? tx("الرصيد") : tx("صافي التغيير")}</th></tr></thead>
      <tbody>${R.list.map((x, i) => `<tr>
        <td>${i + 1}</td>
        <td><b>${esc(x.p.full_name)}</b><small>${esc(x.p.job_title || "")}</small></td>
        <td>${x.present}</td><td>${x.absent}</td><td>${x.rate === null ? "—" : x.rate + "%"}</td>
        <td class="neg">${x.absDed ? n(x.absDed) : "0"}</td><td class="neg">${x.repDed ? n(x.repDed) : "0"}</td><td class="pos">${x.thanks ? n(x.thanks) : "0"}</td>
        <td class="tot ${R.cycle ? (x.balance < PTS_BASE ? "neg" : x.balance > PTS_BASE ? "pos" : "") : x.net < 0 ? "neg" : x.net > 0 ? "pos" : ""}">${R.cycle ? x.balance : n(x.net)}</td>
      </tr>`).join("")}</tbody>
    </table>
    ${one ? `
      <h3>${tx("تفاصيل النقاط")}</h3>
      ${one.events.length ? `<table class="pd-t"><thead><tr><th>${tx("اليوم")}</th><th>${tx("البند")}</th><th>${tx("النقاط")}</th></tr></thead><tbody>
        ${one.events.map((e) => `<tr><td>${fmtDayLong(e.day)}</td><td>${e.kind === "abs" ? tx("غياب عن الاستاند أب") : e.kind === "rep" ? tx("خصم تكرار الغياب ({n} غيابات في الدورة)", { n: e.n }) : tx("نقاط شكر") + (e.reason ? " — " + esc(e.reason) : "")}</td><td class="${e.pts < 0 ? "neg" : "pos"}">${n(e.pts)}</td></tr>`).join("")}
      </tbody></table>` : `<p class="pd-empty">${tx("مفيش خصومات أو نقاط شكر في الفترة دي.")}</p>`}` : ""}
    <h3>${tx("سجل الاستاند أب")}</h3>
    ${R.sessions.length ? `<table class="pd-t"><thead><tr><th>${tx("اليوم")}</th><th>${tx("حضور")}</th><th>${tx("غياب")}</th><th>${one ? tx("الحالة") : tx("الغايبين")}</th></tr></thead><tbody>
      ${R.sessions.map((ss) => {
        const rows = byDay.get(ss.day) || [];
        const absP = rows.filter((r) => r.status === "absent").map((r) => profile(r.user_id)).filter(Boolean);
        const mine = one && rows.find((r) => r.user_id === one.p.id);
        return `<tr><td>${fmtDayLong(ss.day)}</td><td>${rows.length - absP.length}</td><td>${absP.length}</td>
          <td>${one ? (mine ? (mine.status === "absent" ? `<span class="neg">${tx("غايب")}</span>` : tx("حاضر")) : "—") : absP.length ? absP.map((p) => esc(p.full_name)).join("، ") : tx("الكل حضر")}</td></tr>`;
      }).join("")}
    </tbody></table>` : `<p class="pd-empty">${tx("مفيش استاند أب متسجل في الفترة دي.")}</p>`}`;
}

function openAttExport() {
  const A = state.att, cycles = cycleList(), cur = curCycle();
  const people = state.profiles.filter((p) => p.active).sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
  const ov = openModal(`
    <h2>${icon("download")} ${tx("تصدير الحضور والنقاط PDF")}</h2>
    <form id="ax-form">
      <div class="field"><span>${tx("الفترة")}</span>
        <div class="seg" role="radiogroup">
          <label><input type="radio" name="mode" value="cycle" checked><span>${tx("دورة نقاط")}</span></label>
          <label><input type="radio" name="mode" value="range"><span>${tx("فترة مخصصة")}</span></label>
        </div></div>
      <label class="field" id="ax-cycle"><span>${tx("الدورة")}</span>
        <select class="input" name="cycle">${cycles.map((c, i) => `<option value="${c}" ${c === (A.cycle || cur) ? "selected" : ""}>${cycleLabel(c)}${i === 0 ? " · " + tx("الحالية") : ""}</option>`).join("")}</select></label>
      <div class="row2" id="ax-range" hidden>
        <label class="field"><span>${tx("من")}</span><input class="input" type="date" name="from" value="${cur}"></label>
        <label class="field"><span>${tx("لحد")}</span><input class="input" type="date" name="to" value="${cairoToday()}"></label>
      </div>
      <label class="field"><span>${tx("الموظفين")}</span>
        <select class="input" name="user"><option value="">${tx("كل الموظفين")}</option>${people.map((p) => `<option value="${p.id}">${esc(p.full_name)}</option>`).join("")}</select></label>
      <p class="meta" style="margin:0 0 12px">${tx("هيفتح شاشة الطباعة، اختار منها «Save as PDF» أو «حفظ كـ PDF».")}</p>
      <p class="err" id="ax-err"></p>
      <div class="modal-foot">
        <button type="button" class="btn ghost" data-close>إلغاء</button>
        <button class="btn primary" type="submit">${icon("printer")}${tx("تصدير PDF")}</button>
      </div>
    </form>`, { label: tx("تصدير الحضور والنقاط PDF") });
  $("[data-close]", ov).onclick = closeModal;
  $$('input[name="mode"]', ov).forEach((r) => r.onchange = () => {
    const range = $('input[name="mode"]:checked', ov).value === "range";
    $("#ax-range", ov).hidden = !range; $("#ax-cycle", ov).hidden = range;
  });
  $("#ax-form", ov).onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    let from, to, cycle = null;
    if (f.get("mode") === "cycle") { cycle = String(f.get("cycle")); from = cycle; to = cycleEndOf(cycle); }
    else {
      from = String(f.get("from") || ""); to = String(f.get("to") || "");
      if (!from || !to) { $("#ax-err", ov).textContent = tx("حدد بداية ونهاية الفترة"); return; }
      if (from > to) [from, to] = [to, from];
      if (from === cycleStartOf(from) && to === cycleEndOf(from)) cycle = from;
    }
    const R = buildAttReport({ from, to, cycle, userId: String(f.get("user") || "") || null });
    closeModal();
    printDoc(attReportHtml(R), `${tx("الحضور والنقاط")} ${from} - ${to}`);
  };
}

function printDoc(html, title) {
  $("#print-doc")?.remove();
  const doc = document.createElement("div");
  doc.id = "print-doc"; doc.className = "print-doc";
  doc.dir = document.documentElement.dir;
  doc.innerHTML = html;
  document.body.appendChild(doc);
  document.body.classList.add("print-doc-on");
  const oldTitle = document.title;
  document.title = title;
  const done = () => { document.body.classList.remove("print-doc-on"); doc.remove(); document.title = oldTitle; removeEventListener("afterprint", done); };
  addEventListener("afterprint", done);
  // wait for the logo image so it makes it into the PDF
  const img = $("img", doc);
  const go = () => setTimeout(() => window.print(), 60);
  if (img && !img.complete) { img.onload = go; img.onerror = go; } else go();
}


/* =====================================================================
   Push notifications (arrive while the app is closed)
   ===================================================================== */
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
function pushStatus() {
  if (isIOS() && !isStandalone()) return "ios-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return Notification.permission === "granted" ? "granted" : "default";
}
const b64ToBytes = (b64) => { const p = "=".repeat((4 - (b64.length % 4)) % 4); const raw = atob((b64 + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };
async function swReg() {
  if (!("serviceWorker" in navigator)) throw new Error("no service worker");
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) reg = await navigator.serviceWorker.register("sw.js");
  return navigator.serviceWorker.ready.then(() => reg);
}
async function savePushSub(sub) {
  const j = sub.toJSON();
  const { error } = await sb.from("push_subscriptions").upsert({ user_id: state.me.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 200) }, { onConflict: "endpoint" });
  if (error) throw error;
}
async function enablePush() {
  const st = pushStatus();
  if (st === "ios-install") { toast(tx("على الآيفون: ضيف السستم للشاشة الرئيسية الأول وافتحه من هناك"), true); return false; }
  if (st === "unsupported") { toast(tx("المتصفح ده مش بيدعم الإشعارات"), true); return false; }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") { toast(tx("الإشعارات مقفولة من إعدادات المتصفح"), true); return false; }
  try {
    const reg = await swReg();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) });
    await savePushSub(sub);
    try { localStorage.setItem("dtt.push", "on"); } catch { /* ignore */ }
    toast(tx("تمام، الإشعارات هتوصلك حتى والسستم مقفول"));
    return true;
  } catch (e) { console.error(e); toast(friendly(e), true); return false; }
}
async function disablePush() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint); await sub.unsubscribe(); }
    try { localStorage.setItem("dtt.push", "off"); } catch { /* ignore */ }
  } catch (e) { console.error(e); }
}
// keep this device's subscription registered under the signed-in user
async function syncPush() {
  try {
    if (pushStatus() !== "granted") return;
    if ((() => { try { return localStorage.getItem("dtt.push") === "off"; } catch { return false; } })()) return;
    const reg = await swReg();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) });
    await savePushSub(sub);
  } catch (e) { console.warn("push sync", e); }
}
// before signing out, stop this device from receiving the previous user's notifications
async function dropPushForLogout() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  } catch { /* ignore */ }
}
navigator.serviceWorker?.addEventListener("message", (e) => { if (e.data?.type === "open" && e.data.url) location.href = e.data.url; });

async function fillPushRow() {
  const row = $("#push-row"); if (!row) return;
  const st = pushStatus();
  let on = false;
  if (st === "granted") { try { const reg = await navigator.serviceWorker.getRegistration(); on = !!(await reg?.pushManager.getSubscription()) && localStorage.getItem("dtt.push") !== "off"; } catch { /* ignore */ } }
  const msg = {
    "ios-install": tx("على الآيفون: من زرار المشاركة اختار «Add to Home Screen»، وافتح السستم من الأيقونة، وبعدين فعّل الإشعارات.").replace("«Add to Home Screen»", '<bdi dir="ltr">«Add to Home Screen»</bdi>'),
    unsupported: tx("المتصفح ده مش بيدعم الإشعارات"),
    denied: tx("الإشعارات مقفولة من إعدادات المتصفح. افتحها من إعدادات الموقع وارجع هنا."),
  }[st];
  row.innerHTML = msg ? `<p class="meta" style="margin:0">${msg}</p>` :
    `<span class="pill ${on ? "s-done" : "s-todo"}">${on ? tx("شغالة على الجهاز ده") : tx("مقفولة على الجهاز ده")}</span>
     <button class="btn sm ${on ? "ghost" : "primary"}" id="push-toggle">${icon("bell", "sm")}<span>${on ? tx("إيقاف") : tx("تفعيل")}</span></button>`;
  const b = $("#push-toggle");
  if (b) b.onclick = async () => { b.disabled = true; if (on) { await disablePush(); toast(tx("اتقفلت الإشعارات على الجهاز ده")); } else await enablePush(); fillPushRow(); };
}
function pushPromptHtml() {
  const st = pushStatus();
  let dismissed = false; try { dismissed = localStorage.getItem("dtt.pushPrompt") === "no"; } catch { /* ignore */ }
  if (dismissed || st === "granted" || st === "unsupported" || st === "denied") return "";
  const ios = st === "ios-install";
  return `<div class="push-prompt" id="push-prompt">
    <div class="pp-ic">${icon("bell")}</div>
    <div class="pp-txt"><b>${tx("فعّل الإشعارات على الجهاز ده")}</b><span>${ios ? tx("على الآيفون: من زرار المشاركة اختار «Add to Home Screen»، وافتح السستم من الأيقونة، وبعدين فعّل الإشعارات.").replace("«Add to Home Screen»", '<bdi dir="ltr">«Add to Home Screen»</bdi>') : tx("عشان توصلك الرسايل والمهام الجديدة حتى والسستم مقفول.")}</span></div>
    <div class="pp-act">${ios ? "" : `<button class="btn sm primary" id="pp-on">${tx("تفعيل")}</button>`}<button class="btn sm ghost" id="pp-no">${tx("مش دلوقتي")}</button></div>
  </div>`;
}
function wirePushPrompt() {
  const on = $("#pp-on"), no = $("#pp-no");
  if (on) on.onclick = async () => { if (await enablePush()) $("#push-prompt")?.remove(); };
  if (no) no.onclick = () => { try { localStorage.setItem("dtt.pushPrompt", "no"); } catch { /* ignore */ } $("#push-prompt")?.remove(); };
}

/* =====================================================================
   Group chats
   ===================================================================== */
async function loadGroups() {
  const [g, m, msgs] = await Promise.all([
    sb.from("chat_groups").select("*"),
    sb.from("chat_group_members").select("*"),
    sb.from("group_messages").select("*").order("created_at", { ascending: false }).limit(3000),
  ]);
  for (const r of [g, m, msgs]) if (r.error) throw r.error;
  state.groups = (g.data || []).map((x) => ({ ...x, members: (m.data || []).filter((r) => r.group_id === x.id) }));
  state.gmsgs = (msgs.data || []).sort((a, b) => a.created_at.localeCompare(b.created_at));
}
const groupById = (id) => state.groups.find((g) => g.id === id);
const myMember = (g) => g?.members.find((m) => m.user_id === state.me.id);
const isGroupOwner = (g) => myMember(g)?.role === "owner";
const groupMsgs = (gid) => { const me = myMember(groupById(gid)); return state.gmsgs.filter((m) => m.group_id === gid && (!me?.cleared_at || m.created_at > me.cleared_at)); };
const groupUnread = (gid) => { const me = myMember(groupById(gid)); if (!me) return 0; return groupMsgs(gid).filter((m) => m.sender_id !== state.me.id && !m.deleted_at && m.created_at > me.last_read_at).length; };
const groupsUnread = () => state.groups.reduce((s, g) => s + groupUnread(g.id), 0);
const groupInitials = (name) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const groupAvatar = (g, cls = "") => `<span class="av g-av ${cls}" style="background:${esc(g.color)}" aria-hidden="true">${icon("team", "sm")}<b>${esc(groupInitials(g.name))}</b></span>`;
const groupMembersLine = (g) => {
  const names = g.members.map((m) => profile(m.user_id)).filter(Boolean).sort((a, b) => (a.id === state.me.id) - (b.id === state.me.id)).map((p) => p.id === state.me.id ? tx("انت") : p.full_name.split(" ")[0]);
  return names.slice(0, 5).join("، ") + (names.length > 5 ? " " + tx("و{n} كمان", { n: names.length - 5 }) : "");
};

function renderGroupThread(g) {
  const pane = $("#chat-pane");
  const key = "g:" + g.id;
  const draft = (state.chatDrafts ||= {})[key] || "";
  pane.innerHTML = `
    <header class="thread-head">
      <a class="icon-btn thread-back" href="#/chat" aria-label="رجوع">${icon("chev")}</a>
      ${groupAvatar(g)}
      <button class="thread-who g-who" id="g-info" title="${tx("بيانات المجموعة")}"><b>${esc(g.name)}</b><small>${esc(groupMembersLine(g))}</small></button>
      <button class="icon-btn thread-min" data-min="g:${g.id}" title="${tx("تصغير لفقاعة")}" aria-label="${tx("تصغير لفقاعة")}">${icon("minimize")}</button>
      <button class="icon-btn thread-clear" id="g-info2" title="${tx("بيانات المجموعة")}" aria-label="${tx("بيانات المجموعة")}">${icon("users")}</button>
    </header>
    <div class="thread-msgs" id="thread-msgs" aria-live="polite"></div>
    <div class="attach-preview" id="attach-preview" hidden></div>
    <form class="composer" id="composer">
      ${attachHtml()}
      <textarea class="input" id="msg-in" rows="1" maxlength="${MSG_MAX}" placeholder="اكتب رسالة…" aria-label="اكتب رسالة">${esc(draft)}</textarea>
      <button class="btn primary send-btn" type="submit" aria-label="إرسال" ${draft.trim() ? "" : "disabled"}>${icon("send")}</button>
    </form>`;
  fillGroupThread(g.id, true);
  wireMinimize(pane);
  $("#g-info").onclick = $("#g-info2").onclick = () => openGroupModal(g.id);
  const ta = $("#msg-in"), btn = $(".send-btn", pane);
  const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 160) + "px"; };
  grow();
  const refresh = () => { btn.disabled = !ta.value.trim() && !state.chatAttach?.[key]; };
  ta.oninput = () => { state.chatDrafts[key] = ta.value; refresh(); grow(); };
  wireAttach(key, pane, refresh);
  wireVoice(pane, (att) => sendGroupMessage(g.id, null, "", att));
  ta.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !matchMedia("(hover: none)").matches) { e.preventDefault(); $("#composer").requestSubmit(); } };
  $("#composer").onsubmit = (e) => { e.preventDefault(); sendGroupMessage(g.id, ta); };
  if (matchMedia("(hover: hover)").matches) ta.focus();
  markGroupRead(g.id);
}

function fillGroupThread(gid, jump = false) {
  const box = $("#thread-msgs"); if (!box) return;
  const g = groupById(gid); if (!g) return;
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  const msgs = groupMsgs(gid);
  if (!msgs.length) {
    box.innerHTML = `<div class="thread-empty">${groupAvatar(g, "lg")}<b>${esc(g.name)}</b><span>${tx("{n} أعضاء", { n: g.members.length })} · ${tx("ابدأ المحادثة برسالة.")}</span></div>`;
    return;
  }
  let html = "", lastDay = "", prev = null;
  for (const m of msgs) {
    const day = new Date(m.created_at).toDateString();
    if (day !== lastDay) { html += `<div class="day-sep"><span>${fmtDay(m.created_at)}</span></div>`; lastDay = day; prev = null; }
    const mine = m.sender_id === state.me.id;
    const grouped = prev && prev.sender_id === m.sender_id && (new Date(m.created_at) - new Date(prev.created_at)) < 5 * 60000;
    const who = profile(m.sender_id);
    const status = mine ? (m._pending ? `<span class="tick">${icon("clock", "sm")}</span>` : m._failed ? `<span class="tick bad">${icon("alert", "sm")}</span>` : `<span class="tick">${icon("check", "sm")}</span>`) : "";
    const canAct = !m._pending && !m._failed;
    html += `<div class="msg ${mine ? "mine" : "theirs"} ${grouped ? "grouped" : ""} ${m._failed ? "failed" : ""} ${m.deleted_at ? "deleted" : ""} g-msg" data-mid="${m.id}">
      ${!mine && !grouped ? `<div class="g-sender">${avatar(who, "sm")}<b style="color:${senderColor(m.sender_id)}">${esc(who?.full_name || tx("عضو سابق"))}</b></div>` : ""}
      <div class="bubble-row">
        <div class="bubble ${!m.deleted_at && hasImg(m) ? "has-img" : ""} ${!m.deleted_at && hasImg(m) && !(m.body || "").trim() ? "img-only" : ""} ${!m.deleted_at && isVoice(m) ? "has-voice" : ""}">${m.deleted_at ? `<span class="txt gone">${icon("ban", "sm")}${tx(mine ? "انت مسحت الرسالة دي" : "اتمسحت الرسالة دي")}</span>` : `${msgImgHtml(m)}${(m.body || "").trim() ? `<span class="txt" dir="auto">${msgHtml(m.body)}</span>` : ""}`}<span class="meta">${m.edited_at && !m.deleted_at ? `<span class="edited">${tx("معدلة")}</span>` : ""}<time>${fmtClock(m.created_at)}</time>${m.deleted_at ? "" : status}</span></div>
        ${canAct ? `<button class="msg-act" data-gact="${m.id}" aria-label="${tx("خيارات الرسالة")}" title="${tx("خيارات الرسالة")}">${icon("dots", "sm")}</button>` : ""}
      </div>
      ${m._failed ? `<button class="retry" data-gretry="${m.id}">${tx("مااتبعتتش — اضغط تعيد")}</button>` : ""}
    </div>`;
    prev = m;
  }
  box.innerHTML = html;
  if (jump || nearBottom) box.scrollTop = box.scrollHeight;
  wireMsgImgs(box);
  $$("[data-gact]", box).forEach((b) => b.onclick = (e) => { e.stopPropagation(); openGroupMsgActions(b.dataset.gact); });
  $$(".msg[data-mid] .bubble", box).forEach((bub) => {
    const id = bub.closest(".msg").dataset.mid;
    if (id.startsWith("tmp-")) return;
    bub.addEventListener("contextmenu", (e) => { e.preventDefault(); openGroupMsgActions(id); });
    let t;
    bub.addEventListener("touchstart", () => { t = setTimeout(() => { navigator.vibrate?.(15); openGroupMsgActions(id); }, 480); }, { passive: true });
    const cancel = () => clearTimeout(t);
    bub.addEventListener("touchend", cancel); bub.addEventListener("touchmove", cancel); bub.addEventListener("touchcancel", cancel);
  });
  $$("[data-gretry]", box).forEach((b) => b.onclick = () => {
    const m = state.gmsgs.find((x) => x.id === b.dataset.gretry); if (!m) return;
    state.gmsgs = state.gmsgs.filter((x) => x !== m);
    sendGroupMessage(m.group_id, null, m.body, m._att);
  });
}
const SENDER_COLORS = ["#0B6FC4", "#C2410C", "#7A4FD0", "#17996A", "#DB2777", "#0E9AA7", "#B45309", "#4F46E5"];
const senderColor = (id) => SENDER_COLORS[[...String(id)].reduce((s, c) => s + c.charCodeAt(0), 0) % SENDER_COLORS.length];

async function sendGroupMessage(gid, ta, bodyOverride, attOverride) {
  const body = (bodyOverride ?? ta.value).trim();
  const att = attOverride ?? (ta ? takeAttach("g:" + gid) : null);
  if (!body && !att) return;
  if (body.length > MSG_MAX) return toast(tx("الرسالة طويلة أوي"), true);
  const temp = { id: "tmp-" + Math.random().toString(36).slice(2), group_id: gid, sender_id: state.me.id, body, created_at: new Date().toISOString(), _pending: true,
    _local: att?.url || null, _meta: imgMeta(att), _att: att };
  state.gmsgs.push(temp);
  if (ta) { ta.value = ""; state.chatDrafts["g:" + gid] = ""; ta.style.height = "auto"; ta.focus(); $(".send-btn")?.setAttribute("disabled", ""); const ap = $("#attach-preview"); if (ap) { ap.hidden = true; ap.innerHTML = ""; } }
  fillGroupThread(gid, true); fillConvs(null, gid);
  let data = null, error = null;
  try {
    const path = att ? await uploadChatImage(att) : null;
    if (path) chatImgUrls.set(path, { url: att.url, exp: Date.now() + 3500e3 });
    ({ data, error } = await sb.from("group_messages").insert({ group_id: gid, sender_id: state.me.id, body, attachment_path: path, attachment_meta: imgMeta(att) }).select().single());
  } catch (e) { error = e; }
  if (error || !data) { temp._pending = false; temp._failed = true; toast(friendly(error || new Error("send failed")), true); }
  else {
    const i = state.gmsgs.indexOf(temp);
    if (state.gmsgs.some((m) => m.id === data.id)) state.gmsgs.splice(i, 1); else state.gmsgs[i] = data;
    const me = myMember(groupById(gid)); if (me) me.last_read_at = data.created_at;
  }
  if (currentRoute().params.get("group") === gid || miniOpenGroup() === gid) { fillGroupThread(gid); fillConvs(null, gid); }
}

let gReadBusy = false;
async function markGroupRead(gid, clear = false) {
  const g = groupById(gid), me = myMember(g);
  if (!me || (!clear && (gReadBusy || document.hidden || !groupUnread(gid)))) return;
  gReadBusy = true;
  const now = new Date().toISOString();
  me.last_read_at = now; if (clear) me.cleared_at = now;
  renderChatBadges(); fillConvs(null, gid);
  const { error } = await sb.rpc("mark_group_read", { p_group: gid, p_clear: clear });
  gReadBusy = false;
  if (error) console.error(error);
}

function openGroupMsgActions(id) {
  const m = state.gmsgs.find((x) => x.id === id);
  if (!m || $("#modal-root .overlay")) return;
  const mine = m.sender_id === state.me.id;
  const ov = openModal(`
    <div class="sheet-grab" aria-hidden="true"></div>
    <div class="msg-preview ${m.deleted_at ? "gone" : ""}" dir="auto">${m.deleted_at ? tx("اتمسحت الرسالة دي") : esc(msgPreviewText(m).length > 160 ? msgPreviewText(m).slice(0, 160) + "…" : msgPreviewText(m))}</div>
    <div class="sheet-list">
      ${!m.deleted_at && (m.body || "").trim() ? `<button class="sheet-item" data-do="copy"><span class="si-ic">${icon("copy")}</span><span>نسخ النص</span></button>` : ""}
      ${mine && !m.deleted_at && !isVoice(m) && groupMsgUnread(m) ? `<button class="sheet-item" data-do="edit"><span class="si-ic">${icon("edit")}</span><span>${tx("تعديل")}</span></button>` : ""}
      ${!mine && profile(m.sender_id) ? `<a class="sheet-item" href="#/chat?with=${m.sender_id}" data-do="dm"><span class="si-ic">${icon("chat")}</span><span>${tx("رد على {name} في الخاص", { name: esc(profile(m.sender_id).full_name.split(" ")[0]) })}</span></a>` : ""}
      ${mine && !m.deleted_at ? `<button class="sheet-item danger" data-do="all"><span class="si-ic">${icon("ban")}</span><span>مسح عند الكل</span></button>` : ""}
    </div>
    <button class="btn ghost" data-close style="width:100%">إلغاء</button>`, { label: "خيارات الرسالة" });
  ov.classList.add("sheet");
  $("[data-close]", ov).onclick = closeModal;
  const copy = $('[data-do="copy"]', ov);
  if (copy) copy.onclick = async () => { closeModal(); try { await navigator.clipboard.writeText(m.body); toast(tx("اتنسخ")); } catch { toast(tx("مقدرتش أنسخ"), true); } };
  const dm = $('[data-do="dm"]', ov); if (dm) dm.onclick = () => closeModal();
  const ed = $('[data-do="edit"]', ov); if (ed) ed.onclick = () => { closeModal(); editChatMessage(m, true); };
  const all = $('[data-do="all"]', ov);
  if (all) all.onclick = async () => {
    closeModal();
    const ok = await confirmDialog({ title: tx("مسح الرسالة عند الكل؟"), body: tx("الرسالة هتتمسح عند كل أعضاء المجموعة، وهيظهر مكانها إنها اتمسحت."), ok: "مسح عند الكل" });
    if (!ok) return;
    const { data, error } = await sb.rpc("delete_group_message", { p_id: m.id });
    if (error || !data) return toast(error ? friendly(error) : tx("مقدرتش أمسح الرسالة"), true);
    m.body = ""; m.deleted_at = new Date().toISOString(); m.attachment_path = null; m.attachment_meta = null;
    fillGroupThread(m.group_id); fillConvs(null, m.group_id); toast(tx("اتمسحت عند الكل"));
  };
}

/* create a group / view & manage one */
function openGroupModal(gid = null) {
  const g = gid && groupById(gid);
  const isNew = !g, owner = isNew || isGroupOwner(g);
  const memberIds = new Set(g ? g.members.map((m) => m.user_id) : []);
  const color = g?.color || COL_COLORS[(state.groups.length + 1) % COL_COLORS.length];
  const membersHtml = g ? g.members.map((m) => ({ m, p: profile(m.user_id) })).filter((x) => x.p)
    .sort((a, b) => (b.m.role === "owner") - (a.m.role === "owner") || a.p.full_name.localeCompare(b.p.full_name, "ar"))
    .map(({ m, p }) => `<div class="gm-row">
      <div class="person">${avatar(p, "sm")}<div><b>${esc(p.full_name)}${p.id === state.me.id ? ` <span class="me-tag">${tx("(أنا)")}</span>` : ""}</b><small>${esc(p.job_title || "")}</small></div></div>
      ${m.role === "owner" ? `<span class="pill s-review">${tx("مشرف")}</span>` : ""}
      ${owner && p.id !== state.me.id ? `<span class="gm-acts">
        <button type="button" class="btn sm ghost" data-gm-owner="${p.id}" data-on="${m.role === "owner" ? 0 : 1}">${m.role === "owner" ? tx("شيل الإشراف") : tx("خليه مشرف")}</button>
        <button type="button" class="icon-btn" data-gm-rm="${p.id}" title="${tx("شيل من المجموعة")}" aria-label="${tx("شيل من المجموعة")}">${icon("close", "sm")}</button></span>` : ""}
    </div>`).join("") : "";
  const pickable = state.profiles.filter((p) => p.active && p.id !== state.me.id && !memberIds.has(p.id)).sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
  const ov = openModal(`
    <h2>${isNew ? tx("مجموعة جديدة") : tx("بيانات المجموعة")}</h2>
    <form id="gf">
      <div class="g-top">
        <span class="g-preview" id="g-preview">${groupAvatar({ name: g?.name || "؟", color }, "lg")}</span>
        <label class="field" style="flex:1;margin:0"><span>${tx("اسم المجموعة")}</span><input class="input" name="name" maxlength="60" required value="${esc(g?.name || "")}" ${owner ? "" : "readonly"} placeholder="${tx("مثلاً: فريق التصميم")}"></label>
      </div>
      ${owner ? `<div class="field"><span>${tx("اللون")}</span><div class="swatches">${COL_COLORS.map((c) => `<label style="--c:${c}"><input type="radio" name="color" value="${c}" ${c.toLowerCase() === color.toLowerCase() ? "checked" : ""} aria-label="${c}"><span></span></label>`).join("")}</div></div>` : ""}
      ${g ? `<div class="field"><span>${tx("الأعضاء ({n})", { n: g.members.length })}</span><div class="gm-list">${membersHtml}</div></div>` : ""}
      ${owner && pickable.length ? `<div class="field"><span>${isNew ? tx("الأعضاء") : tx("إضافة أعضاء")}</span>
        <div class="input-icon people-search">${icon("search", "sm")}<input class="input" type="search" placeholder="${tx("ابحث باسم الموظف")}" data-people-search></div>
        <div class="people-pick">${pickable.map((p) => `<label data-name="${esc(p.full_name.toLowerCase())}"><input type="checkbox" name="member" value="${p.id}">${avatar(p, "sm")}<span>${esc(p.full_name)}</span><small>${esc(p.job_title || "")}</small></label>`).join("")}</div></div>` : ""}
      <p class="err" id="gf-err"></p>
      <div class="modal-foot g-foot">
        ${g ? `<button type="button" class="btn ghost" id="g-clear">${icon("trash", "sm")}${tx("مسح المحادثة عندي")}</button>
               <button type="button" class="btn danger ghost" id="g-leave">${icon("logout", "sm")}${tx("خروج من المجموعة")}</button>
               ${owner ? `<button type="button" class="btn danger ghost" id="g-del">${icon("trash", "sm")}${tx("حذف المجموعة")}</button>` : ""}` : ""}
        <span class="spacer"></span>
        <button type="button" class="btn ghost" data-close>${g && !owner ? tx("إغلاق") : "إلغاء"}</button>
        ${owner ? `<button class="btn primary" type="submit">${isNew ? tx("إنشاء المجموعة") : tx("حفظ")}</button>` : ""}
      </div>
    </form>`, { label: isNew ? tx("مجموعة جديدة") : tx("بيانات المجموعة") });
  wirePeopleSearch(ov);
  $("[data-close]", ov).onclick = closeModal;
  const err = (m) => { $("#gf-err", ov).textContent = m; };
  const preview = () => { const n = $("input[name=name]", ov).value || "؟", c = $("input[name=color]:checked", ov)?.value || color; $("#g-preview", ov).innerHTML = groupAvatar({ name: n, color: c }, "lg"); };
  $("input[name=name]", ov).oninput = preview;
  $$("input[name=color]", ov).forEach((r) => r.onchange = preview);
  const done = async (msg, goList) => { await loadGroups(); closeModal(); if (msg) toast(msg); if (goList) location.hash = "#/chat"; else route(); renderChatBadges(); };
  $("#gf", ov).onsubmit = async (e) => {
    e.preventDefault();
    if (!owner) return;
    const f = new FormData(e.target);
    const name = String(f.get("name")).trim(), c = f.get("color") || color, add = f.getAll("member");
    if (!name) return err(tx("اكتب اسم المجموعة"));
    const btn = e.submitter; btn.disabled = true;
    if (isNew) {
      if (!add.length) { btn.disabled = false; return err(tx("اختار عضو واحد على الأقل")); }
      const { data, error } = await sb.rpc("create_chat_group", { p_name: name, p_members: add, p_color: c });
      if (error) { btn.disabled = false; return err(friendly(error)); }
      await loadGroups(); closeModal(); location.hash = "#/chat?group=" + data; toast(tx("اتعملت المجموعة"));
      return;
    }
    const r1 = await sb.rpc("update_chat_group", { p_group: g.id, p_name: name, p_color: c });
    const r2 = add.length ? await sb.rpc("add_group_members", { p_group: g.id, p_members: add }) : { error: null };
    if (r1.error || r2.error) { btn.disabled = false; return err(friendly(r1.error || r2.error)); }
    done(tx("اتحفظت المجموعة"));
  };
  $$("[data-gm-rm]", ov).forEach((b) => b.onclick = async () => {
    const { error } = await sb.rpc("remove_group_member", { p_group: g.id, p_user: b.dataset.gmRm });
    if (error) return err(friendly(error));
    await loadGroups(); closeModal(); openGroupModal(g.id);
  });
  $$("[data-gm-owner]", ov).forEach((b) => b.onclick = async () => {
    const { error } = await sb.rpc("set_group_owner", { p_group: g.id, p_user: b.dataset.gmOwner, p_owner: b.dataset.on === "1" });
    if (error) return err(friendly(error));
    await loadGroups(); closeModal(); openGroupModal(g.id);
  });
  const clr = $("#g-clear", ov);
  if (clr) clr.onclick = async () => { closeModal(); await markGroupRead(g.id, true); toast(tx("اتمسحت المحادثة")); route(); };
  const leave = $("#g-leave", ov);
  if (leave) leave.onclick = async () => {
    closeModal();
    const ok = await confirmDialog({ title: tx("تخرج من «{name}»؟", { name: g.name }), body: tx("مش هتوصلك رسايل المجموعة تاني، ومحدش يقدر يرجعك غير المشرف."), ok: tx("خروج") });
    if (!ok) return;
    const { error } = await sb.rpc("remove_group_member", { p_group: g.id, p_user: state.me.id });
    if (error) return toast(friendly(error), true);
    await loadGroups(); location.hash = "#/chat"; toast(tx("خرجت من المجموعة")); renderChatBadges();
  };
  const del = $("#g-del", ov);
  if (del) del.onclick = async () => {
    closeModal();
    const ok = await confirmDialog({ title: tx("حذف «{name}» نهائيًا؟", { name: g.name }), body: tx("المجموعة وكل رسايلها هتتمسح عند كل الأعضاء."), ok: tx("حذف المجموعة") });
    if (!ok) return;
    const { error } = await sb.rpc("delete_chat_group", { p_group: g.id });
    if (error) return toast(friendly(error), true);
    await loadGroups(); location.hash = "#/chat"; toast(tx("اتحذفت المجموعة")); renderChatBadges();
  };
}

function onGroupRealtime(table, evt, row, old) {
  if (!state.me) return;
  const r = currentRoute();
  const openG = r.page === "chat" ? r.params.get("group") : miniOpenGroup();
  if (table === "group_messages") {
    const m = row; if (!m?.id) return;
    const i = state.gmsgs.findIndex((x) => x.id === m.id);
    if (evt === "INSERT") {
      if (i >= 0) return;
      if (m.sender_id === state.me.id && state.gmsgs.some((x) => x._pending && x.body === m.body && x.group_id === m.group_id)) return;
      state.gmsgs.push(m);
      if (openG === m.group_id) { fillGroupThread(m.group_id); markGroupRead(m.group_id); }
      else if (m.sender_id !== state.me.id) {
        chatHeadPush("g", m.group_id, `${profile(m.sender_id)?.full_name?.split(" ")[0] || ""}: ${msgPreviewText(m)}`, m.sender_id);
      }
    } else if (evt === "UPDATE" && i >= 0) { state.gmsgs[i] = { ...state.gmsgs[i], ...m }; if (openG === m.group_id) fillGroupThread(m.group_id); }
    if (r.page === "chat") fillConvs(r.params.get("with"), openG);
    renderChatBadges();
    return;
  }
  // membership / group changes: reload the small group tables
  debounced(groupMetaReload, 400);
}
async function groupMetaReload() {
    try {
      await loadGroups();
      const rr = currentRoute();
      if (rr.page === "chat") {
        const gid = rr.params.get("group");
        if (gid && !groupById(gid)) { location.hash = "#/chat"; return; }
        fillConvs(rr.params.get("with"), gid);
        if (gid) { const g = groupById(gid); const head = $(".g-who"); if (head && g) head.innerHTML = `<b>${esc(g.name)}</b><small>${esc(groupMembersLine(g))}</small>`; }
      }
      renderChatBadges();
    } catch (e) { console.error(e); }
}

/* =====================================================================
   Weekly report: everyone writes Highs / Lows / Sprint / Bugs per project,
   the system compiles one downloadable file. Weeks run Monday -> Monday.
   ===================================================================== */
const WU_FIELDS = [
  ["project_update", "Project Update", "التاسكات اللي خلصت أو قربت تخلص — بتتملى لوحدها من المهام وتقدر تعدّل فيها"],
  ["highs", "Highs", "إيه اللي مشي كويس الأسبوع ده؟"],
  ["lows", "Lows", "إيه المشاكل أو اللي اتأخر؟ التاسكات المتأخرة بتتكتب هنا لوحدها"],
  ["sprint", "Sprint Updates", "التقدم في السبرنت والمهام اللي اتعملت"],
  ["bugs", "Bugs Updates", "البجز اللي اتحلت أو اللي لسه مفتوحة"],
];
function mondayOf(dateStr) { const d = new Date(dateStr + "T12:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); }
const addDays = (dateStr, n) => { const d = new Date(dateStr + "T12:00:00"); d.setDate(d.getDate() + n); return ymd(d); };
// Report periods: standard Monday -> Monday weeks, unless an admin defined a custom period
// covering those days (then the custom one replaces the overlapping weeks).
async function loadPeriods() {
  const { data, error } = await sb.from("report_periods").select("*").order("start_date", { ascending: false });
  if (error) throw error;
  state.wu.periods = data || [];
}
function periodList() {
  const custom = (state.wu.periods || []).map((p) => ({ start: p.start_date, end: p.end_date, name: p.name, custom: true, incl: true, id: p.id }));
  const cur = mondayOf(cairoToday()), out = [...custom];
  const taken = (day) => custom.some((c) => c.start <= day && day <= c.end);
  for (let i = 0; i < 16; i++) {
    const st = addDays(cur, -7 * i), days = Array.from({ length: 7 }, (_, k) => addDays(st, k));
    if (!days.some(taken)) { out.push({ start: st, end: addDays(st, 7), name: "", custom: false, incl: false }); continue; }
    // a custom period cuts into this week: keep the leftover days (3+ in a row) as their own period
    let seg = [];
    for (const d of [...days, null]) {
      if (d && !taken(d)) { seg.push(d); continue; }
      if (seg.length >= 3) out.push({ start: seg[0], end: seg[seg.length - 1], name: "", custom: false, incl: true });
      seg = [];
    }
  }
  return out.sort((a, b) => b.start.localeCompare(a.start));
}
const periodOf = (st) => periodList().find((p) => p.start === st) || { start: st, end: addDays(st, 7), custom: false, incl: false };
const inPeriod = (p, day) => p.start <= day && (p.incl ? day <= p.end : day < p.end);
function currentPeriod() { const t = cairoToday(); return periodList().find((p) => inPeriod(p, t)) || periodOf(mondayOf(t)); }
const periodRange = (p) => p.incl ? tx("من {a} لـ {b}", { a: fmtDM(p.start), b: fmtDM(p.end) }) : tx("من الاتنين {a} لـ الاتنين {b}", { a: fmtDM(p.start), b: fmtDM(p.end) });
const periodLabel = (p) => (p.custom && p.name ? p.name + " · " : "") + periodRange(p);
const weekLabel = (st) => periodLabel(periodOf(st));
function weekOptions(selected) {
  const t = cairoToday(), cur = currentPeriod();
  let seenCur = false;
  return periodList().filter((p) => p.start <= t || p.custom).map((p) => {
    let tag = "";
    if (p.start === cur.start) { tag = " · " + tx("الحالي"); seenCur = true; }
    else if (p.start > t) tag = " · " + tx("جاية");
    else if (seenCur) { tag = " · " + tx("اللي فات"); seenCur = false; }
    return `<option value="${p.start}" ${p.start === selected ? "selected" : ""}>${esc(periodLabel(p))}${tag}</option>`;
  }).join("");
}
async function loadWeekly(week) {
  const per = periodOf(week), last = per.incl ? per.end : addDays(per.end, -1);
  const [{ data, error }, dg] = await Promise.all([
    sb.from("weekly_updates").select("*").eq("week_start", week),
    sb.rpc("weekly_task_digest_v2", { p_start: week, p_end: last }),
  ]);
  if (error) throw error;
  state.wu.rows = data || []; state.wu.loadedWeek = week;
  // v2 also returns overdue tasks (DB migration v18); fall back to v1 until it's applied
  const dg1 = dg.error ? await sb.rpc("weekly_task_digest", { p_start: week, p_end: last }) : null;
  const raw = (dg1 ? (dg1.error ? [] : dg1.data) : dg.data) || [];
  // "late" is judged at the period's end, or today while the period is still running
  const ref = [cairoToday(), addDays(last, 1)].sort()[0];
  state.wu.digest = raw.map((d) => ({ ...d, late: d.status !== "done" && !!d.deadline && d.deadline < ref, lateDays: d.deadline ? Math.round((new Date(ref) - new Date(d.deadline)) / 864e5) : 0 }));
  if (state.wu.puReady == null) {
    const probe = await sb.from("weekly_updates").select("project_update").limit(1);
    state.wu.puReady = !probe.error;
  }
}
// The Project Update column ships with DB migration v17; until it's applied the section stays hidden.
const wuFields = () => state.wu.puReady ? WU_FIELDS : WU_FIELDS.filter(([k]) => k !== "project_update");
const wuText = (r, k) => (r?.[k] || "").trim();
// Lines generated from the tasks assigned to someone in a project & period:
//  - Project Update: finished during the period, or still open and due inside it (or within a week after it)
//  - Lows: still open and already past their deadline
const AUTO_FIELDS = ["project_update", "lows"];
function digestItems(pid, uid, field = "project_update") {
  return (state.wu.digest || []).filter((d) => d.project_id === pid && (!uid || d.user_id === uid) && (field === "lows" ? d.late : !d.late));
}
function digestLine(d) {
  const no = d.task_no ? `#${d.task_no} ` : "";
  if (d.status === "done") return `✅ ${no}${d.title} — ${tx("اتقفلت {date}", { date: fmtDM(cairoDay(d.completed_at)) })}`;
  if (d.late) return `🔴 ${no}${d.title} — ${lateText(d.lateDays)} · ${tx("الموعد {date}", { date: fmtDM(d.deadline) })} · ${d.progress || 0}%`;
  return `⏳ ${no}${d.title} — ${tx(STATUS[d.status] || d.status)} · ${d.progress || 0}%${d.deadline ? " · " + tx("الموعد {date}", { date: fmtDM(d.deadline) }) : ""}`;
}
const lateText = (n) => n <= 1 ? tx("متأخرة يوم") : n === 2 ? tx("متأخرة يومين") : n <= 10 ? tx("متأخرة {n} أيام", { n }) : tx("متأخرة {n} يوم", { n });
const digestText = (pid, uid, field) => digestItems(pid, uid, field).map(digestLine).join("\n");

async function weeklyRefresh() {
  state.wu.loadedWeek = null;
  // don't wipe a form someone is typing in; the compiled view and the periods list refresh live
  if (currentRoute().page === "weekly" && state.wu.tab !== "write") renderWeekly();
}
async function periodsRefresh() {
  state.wu.periods = null;
  if (currentRoute().page === "weekly" && state.wu.tab !== "write") renderWeekly();
}
async function renderWeekly() {
  const W = state.wu;
  if (!W.periods) { try { await loadPeriods(); } catch { W.periods = []; } if (currentRoute().page !== "weekly") return; }
  if (!W.week || !periodList().some((p) => p.start === W.week)) W.week = currentPeriod().start;
  W.tab ||= "write";
  if (W.tab === "periods" && !state.me.is_admin) W.tab = "write";
  const projects = state.projects.filter((p) => p.status !== "archived");
  if (!W.project || !projects.some((p) => p.id === W.project)) W.project = projects[0]?.id || null;
  $("#view").innerHTML = `
    <div class="page-head hero"><div><h1>التقرير الأسبوعي</h1><p>${tx("كل واحد يكتب تحديثاته لكل مشروع، والسستم بيجمعها في ملف واحد. الأسبوع من الاتنين للاتنين، إلا لو الأدمن حدد فترة تانية.")}</p></div>
    <div class="wu-bar">
      <label class="field"><span>${tx("الفترة")}</span><select class="input" id="wu-week">${weekOptions(W.week)}</select></label>
      <div class="tabs" role="tablist"><span class="pill-bg"></span>
        <button class="tab ${W.tab === "write" ? "on" : ""}" data-wtab="write">${icon("edit", "sm")}${tx("تحديثاتي")}</button>
        <button class="tab ${W.tab === "file" ? "on" : ""}" data-wtab="file">${icon("report", "sm")}${tx("الملف المجمّع")}</button>
        ${state.me.is_admin ? `<button class="tab ${W.tab === "periods" ? "on" : ""}" data-wtab="periods">${icon("calendar", "sm")}${tx("الفترات")}</button>` : ""}
      </div>
    </div></div>
    <div id="wu-body"><div class="lb-skel">${"<i></i>".repeat(4)}</div></div>`;
  placeTabPill($("#view"));
  $("#wu-week").onchange = (e) => { W.week = e.target.value; renderWeekly(); };
  $$("[data-wtab]").forEach((b) => b.onclick = () => { W.tab = b.dataset.wtab; renderWeekly(); });
  if (W.tab === "periods") return weeklyPeriods();
  try { await loadWeekly(W.week); } catch (e) { $("#wu-body").innerHTML = `<div class="empty"><b>${esc(friendly(e))}</b></div>`; return; }
  if (currentRoute().page !== "weekly") return;
  if (!projects.length) { $("#wu-body").innerHTML = `<div class="empty"><div class="ill">${icon("projects")}</div><b>${tx("مفيش مشاريع لسه")}</b>${tx("اعمل مشروع الأول من صفحة المشاريع.")}</div>`; return; }
  (W.tab === "write" ? weeklyWrite : weeklyFile)(projects);
}

// Admin: custom report periods (e.g. a sprint, or a week that starts another day)
function weeklyPeriods() {
  const W = state.wu, t = cairoToday();
  const list = W.periods || [];
  $("#wu-body").innerHTML = `
    <div class="card-box">
      <div class="wu-form-head"><div><h3>${icon("calendar", "sm")}${tx("فترات التقرير")}</h3>
        <small>${tx("الافتراضي إن التقرير أسبوعي من الاتنين للاتنين. لو عايز تغيّر التوقيت (سبرنت أسبوعين مثلاً، أو أسبوع بيبدأ يوم تاني) حدد الفترة هنا وهتحل محل الأسابيع اللي بتتقاطع معاها.")}</small></div>
        <button class="btn primary" id="rp-new">${icon("plus", "sm")}${tx("فترة جديدة")}</button></div>
      ${list.length ? `<div class="rp-list">${list.map((p) => {
        const P = { start: p.start_date, end: p.end_date, name: p.name, custom: true, incl: true };
        const st = inPeriod(P, t) ? ["ok", tx("الحالية")] : p.start_date > t ? ["soon", tx("جاية")] : ["no", tx("خلصت")];
        return `<div class="rp-row">
          <div class="rp-main"><b>${esc(p.name || tx("فترة بدون اسم"))}</b><span>${periodRange(P)} · ${tx("{n} يوم", { n: Math.round((new Date(p.end_date) - new Date(p.start_date)) / 864e5) + 1 })}</span></div>
          <span class="wu-st ${st[0]}">${st[1]}</span>
          <button class="icon-btn" data-rp-edit="${p.id}" title="${tx("تعديل")}" aria-label="${tx("تعديل")}">${icon("edit", "sm")}</button>
          <button class="icon-btn" data-rp-del="${p.id}" title="${tx("مسح")}" aria-label="${tx("مسح")}">${icon("trash", "sm")}</button>
        </div>`; }).join("")}</div>`
      : `<div class="empty" style="padding:28px 10px"><div class="ill">${icon("calendar")}</div><b>${tx("مفيش فترات مخصّصة")}</b>${tx("التقرير ماشي بالأسبوع العادي من الاتنين للاتنين.")}</div>`}
    </div>`;
  $("#rp-new").onclick = () => openPeriodModal();
  $$("[data-rp-edit]").forEach((b) => b.onclick = () => openPeriodModal(list.find((p) => p.id === b.dataset.rpEdit)));
  $$("[data-rp-del]").forEach((b) => b.onclick = async () => {
    const p = list.find((x) => x.id === b.dataset.rpDel);
    const ok = await confirmDialog({ title: tx("تمسح الفترة دي؟"), body: tx("التحديثات اللي اتكتبت فيها مش هتتمسح، والأيام دي هترجع للأسبوع العادي."), ok: "مسح" });
    if (!ok) return;
    const { error } = await sb.from("report_periods").delete().eq("id", p.id);
    if (error) return toast(friendly(error), true);
    W.periods = W.periods.filter((x) => x.id !== p.id); toast(tx("اتمسحت الفترة")); renderWeekly();
  });
}

function openPeriodModal(p = null) {
  const isNew = !p;
  const def = (() => { const cur = currentPeriod(); return { s: cur.end, e: addDays(cur.end, 13) }; })();
  const ov = openModal(`
    <h2>${isNew ? tx("فترة جديدة") : tx("تعديل الفترة")}</h2>
    <form id="rpf">
      <label class="field"><span>${tx("اسم الفترة (اختياري)")}</span><input class="input" name="name" maxlength="80" value="${esc(p?.name || "")}" placeholder="${tx("مثلاً: Sprint 12")}"></label>
      <div class="row2">
        <label class="field"><span>${tx("من")}</span><input class="input" type="date" name="start" required value="${p?.start_date || def.s}"></label>
        <label class="field"><span>${tx("لـ")}</span><input class="input" type="date" name="end" required value="${p?.end_date || def.e}"></label>
      </div>
      <small class="hint" id="rpf-len"></small>
      ${!isNew ? `<small class="hint">${tx("لو غيّرت يوم البداية، التحديثات اللي اتكتبت في الفترة دي هتتنقل معاها.")}</small>` : ""}
      <p class="err" id="rpf-err"></p>
      <div class="modal-foot"><span class="spacer"></span>
        <button type="button" class="btn ghost" data-close>إلغاء</button>
        <button class="btn primary" type="submit">${isNew ? tx("إضافة الفترة") : tx("حفظ")}</button>
      </div>
    </form>`, { label: isNew ? tx("فترة جديدة") : tx("تعديل الفترة") });
  $("[data-close]", ov).onclick = closeModal;
  const f = $("#rpf", ov);
  const len = () => { const a = f.elements.start.value, b = f.elements.end.value; $("#rpf-len", ov).textContent = a && b && b > a ? tx("{n} يوم", { n: Math.round((new Date(b) - new Date(a)) / 864e5) + 1 }) : ""; };
  f.oninput = len; len();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const row = { name: f.elements.name.value.trim(), start_date: f.elements.start.value, end_date: f.elements.end.value };
    const err = (m) => { $("#rpf-err", ov).textContent = m; };
    if (!(row.end_date > row.start_date)) return err(tx("تاريخ النهاية لازم يبقى بعد البداية"));
    if ((new Date(row.end_date) - new Date(row.start_date)) / 864e5 > 92) return err(tx("الفترة مينفعش تزيد عن 3 شهور"));
    const btn = e.submitter; btn.disabled = true;
    const q = isNew ? sb.from("report_periods").insert(row).select().single() : sb.from("report_periods").update(row).eq("id", p.id).select().single();
    const { data, error } = await q;
    btn.disabled = false;
    if (error || !data) return err(error?.code === "23P01" ? tx("الفترة دي متداخلة مع فترة تانية متحددة") : error?.code === "23505" ? tx("فيه حد كاتب تحديثات في نفس اليوم ده، اختار يوم بداية تاني") : error ? friendly(error) : tx("مش مسموح لك"));
    state.wu.periods = (state.wu.periods || []).filter((x) => x.id !== data.id).concat(data).sort((a, b) => b.start_date.localeCompare(a.start_date));
    if (!isNew && state.wu.week === p.start_date) state.wu.week = data.start_date;
    closeModal(); toast(isNew ? tx("اتضافت الفترة") : tx("اتحفظت الفترة")); renderWeekly();
  };
}

function weeklyWrite(projects) {
  const W = state.wu, me = state.me.id;
  const mine = W.rows.filter((r) => r.user_id === me);
  const row = mine.find((r) => r.project_id === W.project) || {};
  const draftKey = `${W.project}|${W.week}`;
  const draft = W.drafts[draftKey] || {};
  const autoOf = Object.fromEntries(AUTO_FIELDS.map((k) => [k, digestText(W.project, me, k)]));
  // an empty Project Update is filled from the tasks (same rule the compiled file uses)
  const val = (k) => draft[k] ?? (AUTO_FIELDS.includes(k) ? wuText(row, k) || autoOf[k] : row[k] ?? "");
  $("#wu-body").innerHTML = `
    <div class="wu-grid">
      <aside class="wu-projects card-box">
        <h3>${icon("projects", "sm")}${tx("المشروع")}</h3>
        ${projects.map((p) => { const done = mine.some((r) => r.project_id === p.id && wuFields().some(([k]) => wuText(r, k))); return `<button class="wu-proj ${p.id === W.project ? "on" : ""}" data-wproj="${p.id}" style="--c:${esc(p.color || "#0B6FC4")}"><i></i><span>${esc(p.name)}</span>${done ? `<em title="${tx("اتكتب")}">${icon("check", "sm")}</em>` : ""}</button>`; }).join("")}
      </aside>
      <form class="card-box wu-form" id="wu-form">
        <div class="wu-form-head"><div><h3>${esc(project(W.project)?.name || "")}</h3><small>${weekLabel(W.week)}</small></div>
          ${row.updated_at ? `<span class="wu-st ok">${tx("اتحفظ {t}", { t: timeAgo(row.updated_at) })}</span>` : `<span class="wu-st no">${tx("لسه ماتكتبش")}</span>`}</div>
        ${wuFields().map(([k, label, hint]) => `
          <label class="field wu-field f-${k}"><span><b class="wu-tag">${label}</b> ${tx(hint)}</span>
            <textarea class="input" name="${k}" rows="4" maxlength="5000" placeholder="${k === "project_update" ? tx("مفيش تاسكات خلصت أو قربت تخلص ليك في المشروع ده الفترة دي — اكتب اللي عملته") : tx("كل نقطة في سطر لوحدها")}">${esc(val(k))}</textarea>
            ${autoOf[k] ? `<span class="wu-auto">${icon(k === "lows" ? "flame" : "tasks", "sm")}${tx(k === "lows" ? "{n} تاسك متأخرة من قائمة مهامك" : "{n} تاسك من قائمة مهامك", { n: digestItems(W.project, me, k).length })} <button type="button" class="wu-link" data-refill="${k}">${tx("املاها تاني من التاسكات")}</button></span>` : ""}</label>`).join("")}
        <p class="err" id="wu-err"></p>
        <div class="modal-foot">
          ${row.id ? `<button type="button" class="btn danger ghost" id="wu-del">${icon("trash", "sm")}${tx("مسح تحديثاتي للمشروع ده")}</button>` : ""}
          <span class="spacer"></span>
          <button class="btn primary" type="submit">${icon("check", "sm")}${row.id ? tx("حفظ التعديل") : tx("حفظ التحديثات")}</button>
        </div>
      </form>
    </div>`;
  $$("[data-wproj]").forEach((b) => b.onclick = () => { W.project = b.dataset.wproj; weeklyWrite(projects); });
  const form = $("#wu-form");
  form.oninput = () => { W.drafts[draftKey] = Object.fromEntries(wuFields().map(([k]) => [k, form.elements[k].value])); };
  $$("[data-refill]", form).forEach((b) => b.onclick = () => { const k = b.dataset.refill; form.elements[k].value = autoOf[k]; form.oninput(); form.elements[k].focus(); });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const vals = Object.fromEntries(wuFields().map(([k]) => [k, form.elements[k].value.trim()]));
    if (!Object.values(vals).some(Boolean)) { $("#wu-err").textContent = tx("اكتب في خانة واحدة على الأقل"); return; }
    const btn = e.submitter; btn.disabled = true;
    const { error } = await sb.from("weekly_updates").upsert({ project_id: W.project, week_start: W.week, user_id: me, ...vals }, { onConflict: "project_id,week_start,user_id" });
    btn.disabled = false;
    if (error) { $("#wu-err").textContent = friendly(error); return; }
    delete W.drafts[draftKey];
    await loadWeekly(W.week);
    toast(tx("اتحفظت تحديثات {p}", { p: project(W.project)?.name || "" }));
    weeklyWrite(projects);
  };
  const del = $("#wu-del");
  if (del) del.onclick = async () => {
    const ok = await confirmDialog({ title: tx("تمسح تحديثاتك للمشروع ده؟"), ok: "مسح" }); if (!ok) return;
    const { error } = await sb.from("weekly_updates").delete().eq("id", row.id);
    if (error) return toast(friendly(error), true);
    delete W.drafts[draftKey]; await loadWeekly(W.week); weeklyWrite(projects);
  };
}

const wuLines = (text) => text.split(/\n+/).map((l) => l.replace(/^\s*[-•*·]\s*/, "").trim()).filter(Boolean);
function weeklyCompiled(projects) {
  const W = state.wu;
  const nameOf = (uid) => profile(uid)?.full_name || "";
  return projects.map((p) => {
    const rows = W.rows.filter((r) => r.project_id === p.id && wuFields().some(([k]) => wuText(r, k)))
      .sort((a, b) => nameOf(a.user_id).localeCompare(nameOf(b.user_id), "ar"));
    // anyone who left Project Update / Lows empty gets lines generated from their tasks
    // (one line per task, all of its assignees named)
    const people = new Set(rows.map((r) => r.user_id));
    const autoFor = (k) => {
      const wrote = new Set(rows.filter((r) => wuText(r, k)).map((r) => r.user_id));
      const byTask = new Map();
      for (const d of digestItems(p.id, null, k)) {
        if (wrote.has(d.user_id)) continue;
        people.add(d.user_id);
        const e = byTask.get(d.task_id) || { d, who: [] };
        e.who.push(nameOf(d.user_id)); byTask.set(d.task_id, e);
      }
      return [...byTask.values()].map(({ d, who }) => ({ t: digestLine(d), who: who.filter(Boolean).join("، "), auto: true }));
    };
    const fields = wuFields(), keys = fields.map(([k]) => k);
    const auto = Object.fromEntries(AUTO_FIELDS.filter((k) => keys.includes(k)).map((k) => [k, autoFor(k)]));
    const sections = fields.map(([k, label]) => ({ k, label, items: [
      ...rows.flatMap((r) => wuLines(r[k] || "").map((t) => ({ t, who: nameOf(r.user_id) }))),
      ...(auto[k] || []),
    ] }));
    const autoN = Object.values(auto).reduce((n, a) => n + a.length, 0);
    return { p, rows, auto: autoN, people: people.size, sections };
  }).filter((x) => x.rows.length || x.auto);
}

function weeklyFile(projects) {
  const W = state.wu;
  W.fileProjects ||= "all";
  const data = weeklyCompiled(projects).filter((x) => W.fileProjects === "all" || x.p.id === W.fileProjects);
  const contributors = new Set(W.rows.map((r) => r.user_id));
  $("#wu-body").innerHTML = `
    <div class="wu-file-bar">
      <label class="field" style="margin:0"><span>${tx("المشاريع")}</span><select class="input" id="wu-fp"><option value="all">${tx("كل المشاريع")}</option>${projects.map((p) => `<option value="${p.id}" ${W.fileProjects === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
      <span class="meta" style="margin:0">${tx("{n} شاركوا في الأسبوع ده", { n: contributors.size })}</span>
      <span class="spacer"></span>
      <button class="btn ghost" id="wu-doc" ${data.length ? "" : "disabled"}>${icon("download", "sm")}${tx("تحميل Word")}</button>
      <button class="btn ghost" id="wu-ppt" ${data.length ? "" : "disabled"}>${icon("board", "sm")}${tx("تحميل PowerPoint")}</button>
      <button class="btn primary" id="wu-pdf" ${data.length ? "" : "disabled"}>${icon("printer", "sm")}${tx("تحميل PDF")}</button>
    </div>
    ${data.length ? `<div class="card-box wu-preview">${weeklyDocHtml(data, false)}</div>`
      : `<div class="empty"><div class="ill">${icon("report")}</div><b>${tx("لسه محدش كتب تحديثات للأسبوع ده")}</b>${tx("أول ما حد يكتب من تبويب «تحديثاتي» هتظهر هنا.")}</div>`}`;
  $("#wu-fp").onchange = (e) => { W.fileProjects = e.target.value; weeklyFile(projects); };
  const fname = `Weekly-Report-${W.week}_to_${periodOf(W.week).end}`;
  $("#wu-pdf").onclick = () => printDoc(weeklyDocHtml(data, true), fname);
  $("#wu-doc").onclick = () => downloadWord(weeklyDocHtml(data, true, true), fname);
  $("#wu-ppt").onclick = async (e) => {
    const b = e.currentTarget, html = b.innerHTML; b.disabled = true; b.innerHTML = `<span class="spinner sm"></span>${tx("بيتجهز…")}`;
    try { await downloadWeeklyPptx(data, fname); toast(tx("اتحمّل ملف الباوربوينت")); }
    catch (ex) { console.error(ex); toast(friendly(ex), true); }
    b.disabled = false; b.innerHTML = html;
  };
}

/* ---------- Weekly report → PowerPoint (built in the browser with PptxGenJS) ---------- */
const PPTX_SRC = "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js";
let pptxLib = null;
function loadPptx() {
  if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
  return pptxLib ||= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = PPTX_SRC; s.onload = () => res(window.PptxGenJS); s.onerror = () => { pptxLib = null; rej(new Error(tx("مقدرناش نحمّل أداة الباوربوينت، جرّب تاني"))); };
    document.head.append(s);
  });
}
const toDataUrl = (url) => fetch(url).then((r) => r.blob()).then((b) => new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); }));
// the header's brand gradient, painted once as a slide background
function brandBackdrop(rtl, accent = null) {
  const c = document.createElement("canvas"); c.width = 1920; c.height = 1080;
  const g = c.getContext("2d");
  const lin = g.createLinearGradient(0, 0, 1920, 700);
  [[0, "#052B57"], [.4, "#0656A3"], [.72, "#0870C8"], [1, "#2F6ACB"]].forEach(([o, col]) => lin.addColorStop(o, col));
  g.fillStyle = lin; g.fillRect(0, 0, 1920, 1080);
  const glow = (x, y, r, col) => { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = rg; g.fillRect(0, 0, 1920, 1080); };
  glow(rtl ? 1650 : 270, -120, 900, "rgba(255,255,255,.20)");
  glow(rtl ? 380 : 1540, 1250, 900, "rgba(124,92,230,.38)");
  if (accent) glow(rtl ? 300 : 1620, 300, 700, accent + "55");
  // faint sun rays (the Ibnsina symbol)
  const cx = rtl ? 300 : 1620, cy = 540;
  g.strokeStyle = "rgba(255,255,255,.07)"; g.lineWidth = 10; g.lineCap = "round";
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * 170, cy + Math.sin(a) * 170); g.lineTo(cx + Math.cos(a) * 420, cy + Math.sin(a) * 420); g.stroke(); }
  return c.toDataURL("image/jpeg", 0.86);
}

async function downloadWeeklyPptx(data, fname) {
  const Pptx = await loadPptx();
  const rtl = document.documentElement.dir === "rtl";
  const pres = new Pptx();
  pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  pres.author = state.me.full_name; pres.company = "Ibnsina Pharma"; pres.title = tx("التقرير الأسبوعي");
  pres.rtlMode = rtl;
  const W = 13.333, H = 7.5, M = 0.7;
  const FONT = rtl ? "Segoe UI" : "Segoe UI";
  const INK = "142037", MUTED = "6B7A93", LINE = "E4EAF2";
  const hasAr = (t) => /[؀-ۿ]/.test(t);
  const dirOf = (t) => (hasAr(t) || (rtl && !/[A-Za-z]/.test(t))) ? { align: "right", rtlMode: true } : { align: "left", rtlMode: false };
  const pageAlign = rtl ? "right" : "left";
  const hex = (c) => (c || "#0B6FC4").replace("#", "").slice(0, 6).toUpperCase();
  const period = weekLabel(state.wu.week);
  const [logo, bgTitle] = await Promise.all([toDataUrl("assets/logo-white.png"), Promise.resolve(brandBackdrop(rtl))]);
  const SEC = { project_update: "6D28D9", highs: "128257", lows: "C9303B", sprint: "0472C4", bugs: "B45309" };
  let pageNo = 0;
  const footer = (s, projName) => {
    pageNo++;
    s.addShape(pres.ShapeType.line, { x: M, y: H - 0.62, w: W - 2 * M, h: 0, line: { color: LINE, width: 0.75 } });
    s.addText(`${projName ? projName + "  ·  " : ""}${period}`, { x: M, y: H - 0.55, w: W - 2 * M - 1, h: 0.35, fontFace: FONT, fontSize: 10, color: MUTED, align: pageAlign, rtlMode: rtl });
    s.addText(String(pageNo), { x: rtl ? M : W - M - 0.8, y: H - 0.55, w: 0.8, h: 0.35, fontFace: FONT, fontSize: 10, bold: true, color: MUTED, align: rtl ? "left" : "right" });
  };

  // 1) cover
  {
    const s = pres.addSlide(); pageNo++;
    s.background = { data: bgTitle };
    s.addImage({ data: logo, x: rtl ? W - M - 2.6 : M, y: 0.6, w: 2.6, h: 2.6 * 162 / 440 });
    s.addText(tx("التقرير الأسبوعي"), { x: M, y: 2.55, w: W - 2 * M, h: 1.1, fontFace: FONT, fontSize: 48, bold: true, color: "FFFFFF", align: pageAlign, rtlMode: rtl });
    s.addText(period, { x: M, y: 3.6, w: W - 2 * M, h: 0.6, fontFace: FONT, fontSize: 22, color: "D6E6FA", align: pageAlign, rtlMode: rtl });
    s.addShape(pres.ShapeType.roundRect, { x: rtl ? W - M - 1.2 : M, y: 4.45, w: 1.2, h: 0.08, fill: { color: "FFFFFF", transparency: 25 }, rectRadius: 0.04, line: { type: "none" } });
    const people = new Set(data.flatMap((d) => d.sections.flatMap((x) => x.items.map((i) => i.who))).filter(Boolean)).size;
    s.addText(tx("{p} مشروع  ·  {n} مشارك", { p: data.length, n: people }), { x: M, y: 4.75, w: W - 2 * M, h: 0.45, fontFace: FONT, fontSize: 15, color: "BFD6F2", align: pageAlign, rtlMode: rtl });
    s.addText("Digital Team Tasks Tracker", { x: M, y: H - 0.9, w: W - 2 * M, h: 0.4, fontFace: FONT, fontSize: 11, color: "9EBBE0", align: pageAlign, charSpacing: 2 });
  }

  // 2) agenda
  {
    const s = pres.addSlide(); s.background = { color: "FFFFFF" };
    s.addText(tx("المحتوى"), { x: M, y: 0.55, w: W - 2 * M, h: 0.8, fontFace: FONT, fontSize: 30, bold: true, color: INK, align: pageAlign, rtlMode: rtl });
    s.addShape(pres.ShapeType.roundRect, { x: rtl ? W - M - 0.9 : M, y: 1.35, w: 0.9, h: 0.07, fill: { color: "0656A3" }, rectRadius: 0.03, line: { type: "none" } });
    const cols = data.length > 6 ? 2 : 1, perCol = Math.ceil(data.length / cols), colW = (W - 2 * M - (cols - 1) * 0.5) / cols;
    data.forEach(({ p, people }, i) => {
      const c = Math.floor(i / perCol), r = i % perCol;
      const x = rtl ? W - M - (c + 1) * colW - c * 0.5 : M + c * (colW + 0.5), y = 1.85 + r * 0.78;
      s.addShape(pres.ShapeType.roundRect, { x, y, w: colW, h: 0.64, fill: { color: "F6F8FC" }, line: { color: LINE, width: 0.75 }, rectRadius: 0.1 });
      s.addShape(pres.ShapeType.roundRect, { x: rtl ? x + colW - 0.62 : x + 0.14, y: y + 0.12, w: 0.48, h: 0.4, fill: { color: hex(p.color) }, rectRadius: 0.08, line: { type: "none" } });
      s.addText(String(i + 1).padStart(2, "0"), { x: rtl ? x + colW - 0.62 : x + 0.14, y: y + 0.12, w: 0.48, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: "FFFFFF", align: "center", valign: "middle" });
      s.addText(p.name, { x: rtl ? x + 1.6 : x + 0.8, y, w: colW - 2.45, h: 0.64, fontFace: FONT, fontSize: 16, bold: true, color: INK, valign: "middle", ...dirOf(p.name) });
      s.addText(tx("{n} شاركوا", { n: people }), { x: rtl ? x + 0.15 : x + colW - 1.6, y, w: 1.45, h: 0.64, fontFace: FONT, fontSize: 11, color: MUTED, valign: "middle", align: rtl ? "left" : "right", rtlMode: rtl });
    });
    footer(s);
  }

  // 3) per project: a title slide, then its sections (long sections continue on the next slide)
  for (const { p, people, sections } of data) {
    const col = hex(p.color);
    {
      const s = pres.addSlide(); pageNo++;
      s.background = { data: brandBackdrop(rtl, "#" + col) };
      s.addShape(pres.ShapeType.roundRect, { x: rtl ? W - M - 0.16 : M, y: 2.35, w: 0.16, h: 2.3, fill: { color: col }, rectRadius: 0.06, line: { type: "none" } });
      const tx0 = rtl ? M : M + 0.45, tw = W - 2 * M - 0.45;
      s.addText(tx("المشروع"), { x: tx0, y: 2.25, w: tw, h: 0.45, fontFace: FONT, fontSize: 14, color: "BFD6F2", align: pageAlign, rtlMode: rtl, charSpacing: 1 });
      s.addText(p.name, { x: tx0, y: 2.7, w: tw, h: 1.3, fontFace: FONT, fontSize: 44, bold: true, color: "FFFFFF", valign: "top", fit: "shrink", ...dirOf(p.name), align: pageAlign });
      const lead = profile(p.lead_id)?.full_name;
      // one fact per line so Arabic and English names never get mixed up in one line
      [period, lead ? `${tx("المسؤول")}: ${lead}` : null, tx("{n} شاركوا", { n: people })].filter(Boolean).forEach((line, i) =>
        s.addText(line, { x: tx0, y: 4.1 + i * 0.42, w: tw, h: 0.4, fontFace: FONT, fontSize: 15, color: i ? "BFD6F2" : "D6E6FA", align: pageAlign, rtlMode: rtl }));
      s.addImage({ data: logo, x: rtl ? M : W - M - 1.5, y: H - 0.95, w: 1.5, h: 1.5 * 162 / 440 });
    }
    const filled = sections.filter((x) => x.items.length);
    const empty = sections.filter((x) => !x.items.length);
    for (const sec of filled) {
      // paginate by an estimate of wrapped lines
      const pages = []; let cur = [], lines = 0;
      for (const it of sec.items) {
        const n = Math.max(1, Math.ceil((it.t.length + it.who.length + 4) / 95));
        if (cur.length && lines + n > 10) { pages.push(cur); cur = []; lines = 0; }
        cur.push(it); lines += n;
      }
      if (cur.length) pages.push(cur);
      pages.forEach((items, pi) => {
        const s = pres.addSlide(); s.background = { color: "FFFFFF" };
        const sc = SEC[sec.k] || "0656A3";
        s.addShape(pres.ShapeType.rect, { x: rtl ? W - 0.12 : 0, y: 0, w: 0.12, h: H, fill: { color: col }, line: { type: "none" } });
        s.addText(p.name, { x: M, y: 0.42, w: W - 2 * M, h: 0.35, fontFace: FONT, fontSize: 12, bold: true, color: col, ...dirOf(p.name), align: pageAlign });
        s.addText(sec.label.toUpperCase() + (pages.length > 1 ? `  (${pi + 1}/${pages.length})` : ""), { x: M, y: 0.78, w: W - 2 * M, h: 0.7, fontFace: FONT, fontSize: 28, bold: true, color: INK, align: pageAlign, charSpacing: 1 });
        s.addShape(pres.ShapeType.roundRect, { x: rtl ? W - M - 0.9 : M, y: 1.5, w: 0.9, h: 0.07, fill: { color: sc }, rectRadius: 0.03, line: { type: "none" } });
        const paras = [];
        items.forEach((it, i) => {
          const d = dirOf(it.t);
          paras.push({ text: it.t, options: { ...d, bullet: { code: "25CF", indent: 18 }, color: INK, fontSize: 16, breakLine: false, paraSpaceBefore: i ? 9 : 0 } });
          paras.push({ text: `   — ${it.who}${it.auto ? " · " + tx("تلقائي") : ""}`, options: { ...d, color: MUTED, fontSize: 12, breakLine: true } });
        });
        s.addText(paras, { x: M, y: 1.85, w: W - 2 * M, h: H - 2.65, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.12, fit: "shrink" });
        footer(s, p.name);
      });
    }
    if (empty.length && filled.length) {
      // one calm line at the end of the project for sections nobody filled
      const last = pres.addSlide(); last.background = { color: "FFFFFF" };
      last.addShape(pres.ShapeType.rect, { x: rtl ? W - 0.12 : 0, y: 0, w: 0.12, h: H, fill: { color: col }, line: { type: "none" } });
      last.addText(p.name, { x: M, y: 0.42, w: W - 2 * M, h: 0.35, fontFace: FONT, fontSize: 12, bold: true, color: col, ...dirOf(p.name), align: pageAlign });
      last.addText(tx("أقسام من غير تحديثات الفترة دي"), { x: M, y: 0.78, w: W - 2 * M, h: 0.7, fontFace: FONT, fontSize: 24, bold: true, color: INK, align: pageAlign, rtlMode: rtl });
      empty.forEach((e, i) => {
        const x = rtl ? W - M - (i + 1) * 2.55 + 0.25 : M + i * 2.55;
        last.addShape(pres.ShapeType.roundRect, { x, y: 1.9, w: 2.3, h: 0.7, fill: { color: "F6F8FC" }, line: { color: LINE, width: 0.75 }, rectRadius: 0.12 });
        last.addText(e.label, { x, y: 1.9, w: 2.3, h: 0.7, fontFace: FONT, fontSize: 14, bold: true, color: SEC[e.k] || INK, align: "center", valign: "middle" });
      });
      footer(last, p.name);
    }
  }

  // 4) closing
  {
    const s = pres.addSlide(); s.background = { data: bgTitle };
    s.addImage({ data: logo, x: (W - 3) / 2, y: 2.3, w: 3, h: 3 * 162 / 440 });
    s.addText(tx("شكراً"), { x: M, y: 3.6, w: W - 2 * M, h: 0.9, fontFace: FONT, fontSize: 36, bold: true, color: "FFFFFF", align: "center", rtlMode: rtl });
    s.addText(`Digital Team  ·  ${period}`, { x: M, y: 4.45, w: W - 2 * M, h: 0.5, fontFace: FONT, fontSize: 14, color: "BFD6F2", align: "center", rtlMode: rtl });
  }
  await pres.writeFile({ fileName: fname + ".pptx" });
}

// one document: project name, then its 4 sections with everyone's points
function weeklyDocHtml(data, forFile, word = false) {
  const head = `<div class="pd-head">${word ? "" : `<img src="assets/logo-white.png" alt="">`}<div><b>${tx("التقرير الأسبوعي")}</b><span>${weekLabel(state.wu.week)}</span></div>${forFile ? `<small>${tx("اتطبع {date}", { date: new Date().toLocaleString(LOCALE(), { dateStyle: "medium", timeStyle: "short" }) })}</small>` : ""}</div>`;
  return (forFile ? head : "") + data.map(({ p, people, sections }) => `
    <section class="wu-proj-sec">
      <h2 class="wu-ph" style="--c:${esc(p.color || "#0B6FC4")}">${esc(p.name)}<small>${tx("{n} شاركوا", { n: people })}</small></h2>
      ${sections.map((s) => `
        <div class="wu-sec s-${s.k}">
          <h4>${s.label}</h4>
          ${s.items.length ? `<ul>${s.items.map((i) => `<li><span dir="auto">${esc(i.t)}</span> <em>— ${esc(i.who)}${i.auto ? ` · ${tx("تلقائي")}` : ""}</em></li>`).join("")}</ul>` : `<p class="wu-none">—</p>`}
        </div>`).join("")}
    </section>`).join("");
}

function downloadWord(bodyHtml, name) {
  const rtl = document.documentElement.dir === "rtl";
  const html = `<!DOCTYPE html><html dir="${rtl ? "rtl" : "ltr"}" lang="${LANG}"><head><meta charset="utf-8"><title>${esc(name)}</title>
  <style>
    body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;color:#142037;font-size:11pt;direction:${rtl ? "rtl" : "ltr"}}
    .pd-head{background:#0472C4;color:#fff;padding:12pt 14pt;margin-bottom:10pt}
    .pd-head b{display:block;font-size:16pt}.pd-head span,.pd-head small{font-size:10pt}
    h2{font-size:15pt;color:#0B3B66;border-bottom:2pt solid #0472C4;padding-bottom:3pt;margin:18pt 0 6pt}
    h2 small{font-size:9pt;color:#6B7A93;font-weight:normal;margin:0 8pt}
    h4{font-size:12pt;margin:10pt 0 3pt;color:#0472C4}
    ul{margin:0 0 4pt;padding-${rtl ? "right" : "left"}:18pt} li{margin:2pt 0} em{color:#6B7A93;font-style:normal;font-size:9.5pt}
    .s-project_update h4{color:#6D28D9}.s-highs h4{color:#128257}.s-lows h4{color:#C9303B}.s-sprint h4{color:#0472C4}.s-bugs h4{color:#B45309}
  </style></head><body>${bodyHtml}</body></html>`;
  const blob = new Blob(["﻿", html], { type: "application/msword" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name + ".doc";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function renderSettings() {
  const themes = [
    ["light", "فاتح", ""],
    ["dark", "داكن", ""],
    ["system", "حسب الجهاز", "بيتبع إعدادات جهازك تلقائيًا."],
  ];
  $("#view").innerHTML = `
    <div class="page-head"><div><h1>الإعدادات</h1><p>تخصيص شكل ولغة النظام.</p></div></div>
    <div class="settings">
      <section class="set-card">
        <div class="set-head"><div class="ico">${icon("globe")}</div><div><h3>اللغة</h3><p>اختار لغة الواجهة.</p></div></div>
        <div class="choice-grid two" role="radiogroup" aria-label="اللغة">
          <button class="choice ${LANG === "ar" ? "on" : ""}" data-lang="ar" role="radio" aria-checked="${LANG === "ar"}">
            <span class="glyph" lang="ar">ع</span><b lang="ar">العربية</b>${LANG === "ar" ? `<span class="tick">${icon("check", "sm")}</span>` : ""}</button>
          <button class="choice ${LANG === "en" ? "on" : ""}" data-lang="en" role="radio" aria-checked="${LANG === "en"}">
            <span class="glyph" lang="en">Aa</span><b lang="en">English</b>${LANG === "en" ? `<span class="tick">${icon("check", "sm")}</span>` : ""}</button>
        </div>
      </section>
      <section class="set-card">
        <div class="set-head"><div class="ico">${icon("palette")}</div><div><h3>المظهر</h3><p>${THEME === "system" ? "بيتبع إعدادات جهازك تلقائيًا." : ""}</p></div></div>
        <div class="choice-grid three" role="radiogroup" aria-label="المظهر">
          ${themes.map(([k, l]) => `
            <button class="choice theme ${THEME === k ? "on" : ""}" data-theme-pick="${k}" role="radio" aria-checked="${THEME === k}">
              <span class="preview p-${k}" aria-hidden="true"><i class="pv-side"></i><i class="pv-line"></i><i class="pv-line short"></i><i class="pv-card"></i></span>
              <b>${l}</b>${THEME === k ? `<span class="tick">${icon("check", "sm")}</span>` : ""}</button>`).join("")}
        </div>
      </section>
      <section class="set-card">
        <div class="set-head"><div class="ico">${icon("user")}</div><div><h3>حسابي</h3><p></p></div></div>
        <div class="me-row">
          ${avatar(state.me, "lg")}
          <div class="grow"><b>${esc(state.me.full_name)}</b><small>${esc(state.me.job_title || "")} · <span dir="ltr">${esc(state.me.username)}</span></small></div>
          <button class="btn sm" id="set-photo">${icon("user", "sm")}<span>تغيير صورتي</span></button>
          <button class="btn sm" id="set-pass">${icon("lock", "sm")}<span>تغيير كلمة السر</span></button>
        </div>
      </section>
      <section class="set-card">
        <div class="set-head"><div class="ico">${icon("bell")}</div><div><h3>إشعارات الجهاز</h3><p>توصلك الرسايل والمهام الجديدة حتى والسستم مقفول.</p></div></div>
        <div class="push-row" id="push-row"></div>
      </section>
      <p class="meta">الإعدادات دي محفوظة مع حسابك، وبتطبق على أي جهاز تدخل منه.</p>
    </div>`;
  fillPushRow();
  $$("[data-lang]").forEach((b) => b.onclick = () => {
    if (b.dataset.lang === LANG) return;
    setLang(b.dataset.lang);
    savePrefs();
    renderShell();
    toast(tx("اتحفظت الإعدادات"));
  });
  $$("[data-theme-pick]").forEach((b) => b.onclick = () => {
    setTheme(b.dataset.themePick);
    savePrefs();
    state.animate = false; route();
    toast(tx("اتحفظت الإعدادات"));
  });
  $("#set-pass").onclick = () => openPasswordModal(state.me);
  $("#set-photo").onclick = () => pickPhoto(async (file) => {
    try { await uploadAvatar(state.me.id, file); await loadProfiles(); state.animate = false; route(); toast("اتغيرت الصورة"); }
    catch (e) { toast(friendly(e), true); }
  });
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
      <div><h1>أداء الفريق</h1><p>${tx(state.teamDirectOnly ? "{n} موظف تحت إدارتك المباشرة" : "{n} موظف تحت إدارتك", { n: members.length })}</p></div>
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
  const canSeeWork = () => true; // everyone can view colleagues' tasks (read-only)
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
      <div class="org-card ${p.id === me ? "me" : ""} ${p.active ? "" : "inactive"} ${canSeeWork(p) ? "link" : ""}" data-person="${p.id}" ${canSeeWork(p) ? 'tabindex="0" role="link"' : ""} dir="${LANG === "en" ? "ltr" : "rtl"}">
        ${p.id === me ? `<span class="me-tag">${p.gender === "female" ? "أنتِ" : "أنت"}</span>` : ""}
        ${avatar(p, "lg")}
        <b>${esc(p.full_name)}</b>
        <small>${esc(p.job_title || "—")}</small>
        ${stats ? `<div class="org-stats">${stats}</div>` : ""}
      </div>
      ${kids.length ? `<button class="org-toggle" data-toggle="${p.id}" aria-expanded="${!isCol}" aria-label="${tx(isCol ? "إظهار فريق {name}" : "إخفاء فريق {name}", { name: esc(p.full_name) })}">${isCol ? `+${team}` : "−"}</button>
        <ul>${kids.map((k) => node(k, depth + 1)).join("")}</ul>` : ""}
    </li>`;
  };
  const treeHtml = roots.map((r) => node(r)).join("");
  const managers = state.profiles.filter((p) => (state.children.get(p.id) || []).length).length;

  $("#view").innerHTML = `
    <div class="page-head hero">
      <div><h1>الهيكل التنظيمي</h1><p>${tx("{n} موظف · {m} مدير · {l} مستويات", { n: state.profiles.length, m: managers, l: levels.length })}</p></div>
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
  $("#uf-photo", ov).onclick = () => pickPhoto((file) => {
    photo = file;
    $("#uf-av", ov).innerHTML = `<img class="av lg" src="${URL.createObjectURL(file)}" alt="">`;
  });
  const err = (m) => { $("#uf-err", ov).textContent = ""; requestAnimationFrame(() => $("#uf-err", ov).textContent = m); };
  $$("input[name=gender]", ov).forEach((r) => r.onchange = () => {
    if (photo || user?.avatar_url) return;
    const name = $("input[name=full_name]", ov).value.trim() || "?";
    $("#uf-av", ov).innerHTML = avatar({ id: user?.id || "new", full_name: name, gender: r.value }, "lg");
  });

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
      if (!confirm(tx(user.active ? "إيقاف حساب {name}؟ مش هيقدر يدخل السستم." : "تفعيل حساب {name}؟", { name: user.full_name }))) return;
      try { await adminCall({ action: "set_active", user_id: user.id, active: !user.active }); await loadProfiles(); closeModal(); route(); toast("اتحدثت حالة الحساب"); }
      catch (ex) { err(friendly(ex)); }
    };
    $("#uf-del", ov).onclick = async () => {
      if (!confirm(tx("حذف {name} نهائيًا؟ الموظفين اللي تحته هيتنقلوا لمديره.", { name: user.full_name }))) return;
      try { await adminCall({ action: "delete", user_id: user.id }); await Promise.all([loadProfiles(), loadTasks()]); closeModal(); route(); toast("اتحذف الموظف"); }
      catch (ex) { err(friendly(ex)); }
    };
  }
}

function openPasswordModal(user) {
  const self = user.id === state.me.id;
  const ov = openModal(`
    <h2>${self ? "تغيير كلمة السر" : tx("كلمة سر جديدة لـ {name}", { name: esc(user.full_name) })}</h2>
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
