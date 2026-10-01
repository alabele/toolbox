// Stillroom. Pull-only. Nothing here animates or redraws the thing you are reading.
const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
const STATE = {
  "needs-permission": { icon: "hand",                    word: "Needs permission", short: "Permission", color: "var(--st-permission)" },
  "needs-answer":     { icon: "message-circle-question", word: "Needs an answer",  short: "Question",   color: "var(--st-answer)" },
  failed:             { icon: "triangle-alert",          word: "Failed",           short: "Failed",     color: "var(--st-failed)" },
  finished:           { icon: "moon-star",               word: "Your turn",        short: "Your turn",  color: "var(--st-finished)" },
  working:            { icon: "orbit",                   word: "Working",          short: "Working",    color: "var(--st-working)" },
  idle:               { icon: "moon",                    word: "Closed",           short: "Closed",    color: "var(--st-idle)" },
};
const ic = (name, cls = "ic ic-sm") => name.startsWith("pk:") ? `<svg class="${cls} pk"><use href="#pk-${name.slice(3)}"/></svg>` : `<i data-lucide="${name}" class="${cls}"></i>`;
const icons = () => { try { lucide.createIcons(); } catch {} };
const THEMES = [["stillroom","Stillroom","#d2aa54"],["calm-waters","Calm Waters","#4299e1"],["forest-floor","Forest Floor","#5eead4"],["soft-purple","Soft Purple","#a78bfa"],["midnight-rose","Midnight Rose","#f687b3"],["sunrise-warmth","Sunrise Warmth","#f6ad55"],["high-contrast","High Contrast","#fbbf24"]];
const OLD_MS = 3 * 24 * 3600 * 1000; // past this, a waiting session moves to the older shelf

const showEarlier = new Set(); let quietArt = "";
fetch("/nice-work.svg").then(r => r.text()).then(s => { quietArt = s; if (!openId && !termId && !roundsOn && list.length) renderNext(); }).catch(() => {});
let ws, wsReady = false, openId = null, termId = null, transcript = [], meta = null, cwds = [], list = [], listVersion = -1, shownVersion = -1;
const pendingStarts = [];
const prefs = load();
function load() { try { return JSON.parse(localStorage.getItem("stillroom-prefs") || localStorage.getItem("quiet-prefs") || "{}"); } catch { return {}; } }
function save() { try { localStorage.setItem("stillroom-prefs", JSON.stringify(prefs)); } catch {} }
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function shapeOf(repo) { return "#s" + (hash(repo) % 8); }
function tintOf(repo) { return `hsl(${[28, 160, 210, 330, 45, 190, 100, 270][hash(repo + "t") % 8]} 30% 66%)`; }
function ago(ms) { const m = Math.max(0, Math.round(ms / 60000)); if (m < 1) return "just now"; if (m < 60) return `${m} min`; const h = Math.round(m / 60); if (h < 36) return `${h} h`; const d = Math.round(h / 24); if (d < 45) return `${d} d`; return `${Math.round(d / 30)} mo`; }
function esc(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
const jar = (repo, sub) => `<span class="jar" style="--jc:${tintOf(repo)}"><svg class="shape" width="14" height="14" fill="currentColor"><use href="${shapeOf(repo)}"/></svg><span class="jar-label">${esc(repo)}</span>${sub ? `<span class="where">${esc(sub)}</span>` : ""}</span>`;
const pill = (st) => `<span class="pill" style="--pc:${st.color}">${ic(st.icon)}<span>${st.word}</span></span>`;
const plain = (s) => String(s || "").replace(/```[\s\S]*?```/g, " ").replace(/[*_`#>]+/g, "").replace(/^\s*[-\d.]+\s+/gm, "").replace(/\s+/g, " ").trim();
const firstLine = (s) => { let t = plain(s).replace(/^(Done|Partly done|Blocked|Found|Question|Working|Failed|Good|Yes|No|Sorry[^.]*)\b[.,:!—-]*\s*/i, "").replace(/^[—–-]\s*/, ""); const m = t.match(/^.*?[.!?](\s|$)/); return (m ? m[0] : t).trim().slice(0, 140); };
// the second line is what the session wants from her: her own note first, else the reply's Next or Question line; nothing else
const askLine = (x) => { const t = String(x.lastReply || x.last || ""); const m = t.match(/^\s*\**(Next|Question)\**\s*:\s*(.+)$/im); return m ? plain(m[2]).slice(0, 120) : ""; };
const lineOf = (x) => x.note ? { text: x.note, note: true } : (prefs.notes?.[x.sessionId] ? { text: prefs.notes[x.sessionId], note: true } : { text: x.needsYou || x.state === "finished" ? askLine(x) : "", note: false });
const monogram = (repo) => { const w = String(repo || "").split(/[-_ ]+/).filter(Boolean); return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || "??").slice(0, 2)).toUpperCase(); };
const isOld = (x) => x.state !== "working" && Date.now() - x.stateSince > OLD_MS;
const isDismissed = (x) => (prefs.dismissed || []).includes(x.sessionId);
const hrefOf = (x) => x.managed ? `#s/${x.sessionId}` : `#t/${x.sessionId}`;

// ---------- server calls ----------
async function fetchState() { try { return await (await fetch("/api/state", { cache: "no-store" })).json(); } catch { return { error: "The local server is not reachable. Start it with: bun run server.ts" }; } }
async function act(path, sessionId, btn, extra) { const was = btn.textContent; btn.disabled = true; btn.textContent = "Working"; try { const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId, ...(extra || {}) }) }); btn.textContent = r.ok ? "Done" : `Failed: ${(await r.text()).slice(0, 80)}`; } catch { btn.textContent = "Failed"; } btn.disabled = false; setTimeout(() => (btn.textContent = was), 1500); }
async function copyCmd(cmd, btn) { const was = btn.textContent; try { await navigator.clipboard.writeText(cmd); btn.textContent = "Copied"; } catch { btn.textContent = "Select and copy"; } setTimeout(() => (btn.textContent = was), 1500); }
function send(o) { if (wsReady) ws.send(JSON.stringify(o)); else setTimeout(() => send(o), 300); }

// ---------- sidebar: every session, one place ----------
const PRIO = { 1: "High", 2: "Med", 3: "Low" }; const prioOf = (id) => (prefs.prio || {})[id] || 2;
function setPrio(id, n) { const p = { ...(prefs.prio || {}) }; if (n === 2) delete p[id]; else p[id] = n; prefs.prio = p; save(); renderSide(); renderSessHead?.(); if (roundsOn) renderRounds(); }
function prioCtl(id) { return `<span class="prio" role="group" aria-label="Priority">${[1, 2, 3].map(n => `<button type="button" class="prio-b${prioOf(id) === n ? " on" : ""} p${n}" data-prio="${n}" data-id="${id}">${PRIO[n]}</button>`).join("")}</span>`; }
document.addEventListener("click", (e) => { const b = e.target.closest("[data-prio]"); if (!b) return; e.preventDefault(); e.stopPropagation(); setPrio(b.dataset.id, +b.dataset.prio); }, true);
function toggleStar(id) { const s = { ...(prefs.stars || {}) }; if (s[id] != null) delete s[id]; else s[id] = Math.max(-1, ...Object.values(s)) + 1; prefs.stars = s; save(); renderSide(); renderSessHead?.(); }
function renderSide() {
  const live = list.filter(x => !isDismissed(x)); const groups = { older: [] };
  for (const x of live) if (isOld(x) || x.state === "idle") groups.older.push(x);
  groups.older.sort((a, b) => b.stateSince - a.stateSince);
  const item = (x, old) => { const st = STATE[x.state]; const ln = lineOf(x); const cur = x.sessionId === openId || x.sessionId === termId;
    return `<a class="si${old ? " older" : ""}" href="${hrefOf(x)}" aria-current="${cur}" style="--sc:${st.color}" data-id="${x.sessionId}"><span class="si-top"><span class="si-title">${esc(x.title)}</span><button type="button" class="pencil" data-edit title="Rename">${ic("pencil")}</button></span>${ln.text ? `<span class="si-line${ln.note ? " note" : ""}">${esc(ln.text)}</span>` : ""}${old ? `<span class="si-acts"><span class="where">${ago(Date.now() - x.stateSince)}</span><span class="grow"></span>${x.worktree ? `<button class="iconbtn rmwt" data-path="${esc(x.worktree.path)}" title="Remove its worktree; the branch stays">${ic("folder-x")}</button>` : ""}<button class="iconbtn letgo" data-id="${x.sessionId}" data-managed="${!!x.managed}" title="Let it go">${ic("x")}</button></span>` : ""}</a>`; };
  const g = (key, label, arr, collapsible = true) => { if (!arr.length) return ""; const open = prefs.open?.[key] ?? false;
    return `<div class="sg sg-${key}"><${collapsible ? "button" : "div"} class="sg-h${collapsible ? " toggle" : ""}"${collapsible ? ` data-toggle="${key}" aria-expanded="${open}"` : ""}>${collapsible ? `<svg class="chev" width="11" height="11"><use href="#i-chev"/></svg>` : ""}${label} <span class="where">${arr.length}</span></${collapsible ? "button" : "div"}>${open && key === "older" && arr.length > 1 ? `<button type="button" class="btn tiny sg-clear" data-clear="older">Clear all ${arr.length}</button>` : ""}${open ? arr.map(x => item(x, key === "older")).join("") : ""}</div>`; };
  // the project list is the navigation: by her priority, then rooms with something for her, then in flight; off ones behind one line
  const rooms = roomItems(); const cur = roomId();
  const rowFor = (p, its) => { const n = its.filter(needsIt).length, blocked = its.find(it => it.t === "session" && it.o.needsYou && it.o.state !== "finished"); const fl = its.filter(it => !needsIt(it) && !waitingIt(it)).length, w = its.filter(waitingIt).length;
    const word = n ? (blocked ? STATE[blocked.o.state].word.toLowerCase() : `${n} need${n === 1 ? "s" : ""} you`) : fl ? `${fl} in flight` : w ? `${w} waiting` : ""; const id = p ? p.id : "none";
    return `<a class="proj-nav${n ? " needs" : ""}${p && !p.on ? " quiet" : ""}" href="#p/${id}" aria-current="${cur === id}" data-drop="${id}"><span class="pn-name">${esc(p ? p.name : "Unassigned")}</span><span class="pn-word">${esc(word)}</span></a>`; };
  // Projects, then High / Medium / Low / Unassigned, each collapsible and collapsed unless she opened it
  const byPrio = { 1: [], 2: [], 3: [] }; for (const p of projects) byPrio[p.prio].push(p);
  const sortP = (arr) => arr.slice().sort((x, y) => (x.on ? 0 : 1) - (y.on ? 0 : 1) || (rooms.get(y.id).some(needsIt) - rooms.get(x.id).some(needsIt)) || (rooms.get(y.id).length > 0) - (rooms.get(x.id).length > 0) || x.order - y.order);
  const gword = (arr) => { const n = arr.reduce((s, p) => s + rooms.get(p.id).filter(needsIt).length, 0); const fl = arr.reduce((s, p) => s + rooms.get(p.id).filter(it => !needsIt(it) && !waitingIt(it)).length, 0); return n ? `${n} need${n === 1 ? "s" : ""} you` : fl ? `${fl} in flight` : ""; };
  // a muted group stays in the list but says nothing: no words, no counts, nothing from it anywhere else
  const pg = (key, label, arr, rowsHtml) => { const open = prefs.open?.[key] ?? false; const muted = !!prefs.mute?.[key]; const w = muted ? "muted" : open ? "" : gword(arr);
    return `<div class="sg sg-${key}${muted ? " muted" : ""}"><div class="sg-row"><button class="sg-h toggle" data-toggle="${key}" aria-expanded="${open}"><svg class="chev" width="11" height="11"><use href="#i-chev"/></svg>${label}<span class="where${w.includes("need") ? " needs" : ""}">${w}</span></button><button type="button" class="mute" data-mute="${key}" title="${muted ? "Unmute" : "Mute: nothing from here counts until you unmute"}">${ic(muted ? "bell-off" : "bell")}</button></div>${open ? rowsHtml : ""}</div>`; };
  const none = rooms.get("none") || [];
  const nav = `<nav class="proj-list-nav"><div class="sg-title">Projects</div>${pg("p1", "High", byPrio[1], sortP(byPrio[1]).map(p => rowFor(p, rooms.get(p.id))).join(""))}${pg("p2", "Medium", byPrio[2], sortP(byPrio[2]).map(p => rowFor(p, rooms.get(p.id))).join(""))}${pg("p3", "Low", byPrio[3], sortP(byPrio[3]).map(p => rowFor(p, rooms.get(p.id))).join(""))}${pg("p0", "Unassigned", [], rowFor(null, none)).replace('<span class="where"></span>', `<span class="where${none.some(needsIt) ? " needs" : ""}">${none.filter(needsIt).length ? `${none.filter(needsIt).length} need${none.filter(needsIt).length === 1 ? "s" : ""} you` : none.length ? `${none.length} in flight` : ""}</span>`)}<button type="button" class="menu-note side-addproj" id="side-addproj">+ Add a project</button><form id="side-addproj-form" hidden><input placeholder="Project name, Enter to save" aria-label="Project name"></form></nav>`;
  $("#side-groups").innerHTML = nav;
  $("#side-older").innerHTML = g("older", "Archive", groups.older, true);
  $("#side-addproj").onclick = () => { const f = $("#side-addproj-form"); f.hidden = false; $("#side-addproj").hidden = true; f.querySelector("input").focus(); };
  $("#side-addproj-form").onsubmit = (e) => { e.preventDefault(); const name = e.target.querySelector("input").value.trim(); if (!name) return; fetch("/api/project", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, prio: 1 }) }); };
  // rows dragged from a room land on a project here
  document.querySelectorAll("[data-drop]").forEach(el => { el.addEventListener("dragover", (e) => { if (!dragItem) return; e.preventDefault(); el.classList.add("over"); }); el.addEventListener("dragleave", () => el.classList.remove("over")); el.addEventListener("drop", (e) => { if (!dragItem) return; e.preventDefault(); el.classList.remove("over"); const to = el.dataset.drop === "none" ? null : el.dataset.drop; fetch("/api/project", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assign: { item: dragItem.item, project: to, key: dragItem.key || undefined } }) }); const u = $("#undo"); $("#undo-text").textContent = `Moved to ${to ? projects.find(p => p.id === to)?.name : "No project"}.`; u.hidden = false; setTimeout(() => { u.hidden = true; }, 5000); dragItem = null; }); });
  document.querySelectorAll("[data-mute]").forEach(b => b.onclick = (e) => { e.stopPropagation(); prefs.mute = { ...(prefs.mute || {}), [b.dataset.mute]: !prefs.mute?.[b.dataset.mute] }; save(); renderSide(); if (roundsOn) renderRoom(); });
  document.querySelectorAll("[data-toggle]").forEach(t => t.onclick = () => { prefs.open = { ...(prefs.open || {}), [t.dataset.toggle]: !prefs.open?.[t.dataset.toggle] }; save(); renderSide(); });
  document.querySelector("[data-clear=older]")?.addEventListener("click", () => { const ids = groups.older.map(x => x.sessionId); if (!ids.length) return;
    if (!confirm(`Clear all ${ids.length} from the Archive? They leave the list. Conversations stay on disk; anything still running in a terminal keeps running.`)) return;
    prefs.dismissed = [...new Set([...(prefs.dismissed || []), ...ids])]; for (const id of ids) unpin(id); save(); renderSide(); renderNext(); });
  const startEdit = (row) => { const id = row.dataset.id; const x = list.find(s => s.sessionId === id); const tel = row.querySelector(".si-title"); if (!x || !tel || row.querySelector(".title-edit")) return;
    editTitle(tel, x.title, (v) => { if (x.managed) send({ type: "title", sessionId: id, title: v }); else { prefs.titles = { ...(prefs.titles || {}), [id]: v }; save(); } tel.textContent = v; renderSide(); }); const inp = row.querySelector(".title-edit"); inp.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); }); };
  document.querySelectorAll(".si").forEach(row => { row.querySelector("[data-edit]")?.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); startEdit(row); }); });
  document.querySelectorAll(".rmwt").forEach(b => b.onclick = async (e) => { e.preventDefault(); e.stopPropagation(); if (!confirm("Remove this worktree? Uncommitted changes in it are lost. The branch stays.")) return; const r = await fetch("/api/worktree/remove", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: b.dataset.path }) }); b.title = r.ok ? "Removed" : "Could not remove"; b.disabled = true; });
  document.querySelectorAll(".letgo").forEach(b => b.onclick = async (e) => { e.preventDefault(); e.stopPropagation(); const id = b.dataset.id;
    if (!confirm("Let this session go? It ends now. The conversation stays on disk and can be resumed later.")) return;
    unpin(id); if (b.dataset.managed === "true") send({ type: "end", sessionId: id });
    else { try { const r = await fetch("/api/letgo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: id }) }); if (!r.ok) { $("#error").hidden = false; $("#error").textContent = "Could not end it: " + await r.text(); return; } } catch {} }
    prefs.dismissed = [...(prefs.dismissed || []), id]; save(); renderSide(); renderNext(); });
  const needsAny = [...rooms].some(([rid, its]) => !mutedRoom(rid) && its.some(needsIt));
  document.title = (needsAny ? "Needs you · " : "") + "Stillroom"; document.body.dataset.needs = needsAny ? "1" : "0"; icons();
}
let dragItem = null;
// every session, PR and wait, sorted into rooms by project; "none" holds the rest
const needsIt = (it) => it.t === "pr" ? it.o.needsYou && it.o.watched : it.t === "wait" ? !!it.o.back : it.o.needsYou;
const waitingIt = (it) => it.t === "pr" ? it.o.watched && !it.o.needsYou : it.t === "wait" ? !it.o.back : false;
function roomItems() { const rooms = new Map(projects.map(p => [p.id, []])); rooms.set("none", []);
  const items = [...list.filter(x => !isDismissed(x) && !isOld(x) && x.state !== "idle").map(x => ({ o: x, t: "session" })), ...prList.filter(p => !p.shelved && (p.watched || p.needsYou)).map(p => ({ o: p, t: "pr" })), ...waitList.map(w => ({ o: w, t: "wait" }))];
  for (const it of items) { const p = projectOf(it.o); (rooms.get(p ? p.id : "none") || rooms.get("none")).push(it); } return rooms; }
const mutedRoom = (rid) => { const p = rid === "none" ? null : projects.find(x => x.id === rid); const key = rid === "none" ? "p0" : p ? `p${p.prio}` : "p0"; return !!prefs.mute?.[key]; };
const roomId = () => { const m = location.hash.match(/^#p\/(.+)$/); return m ? m[1] : null; };
function renderNext() {
  const el = $("#next"); const live = list.filter(x => !isDismissed(x) && !isOld(x));
  const urgent = live.filter(x => x.needsYou && x.state !== "finished").sort((a, b) => a.stateSince - b.stateSince);
  const needs = urgent.length ? urgent : live.filter(x => x.state === "finished").sort((a, b) => b.stateSince - a.stateSince);
  const working = live.filter(x => x.state === "working").length;
  if (!needs.length) { el.innerHTML = `<div class="quiet"><span class="art"><svg class="pk pk-lg" viewBox="0 0 64 64" aria-hidden="true"><use href="#pk-celestial"/></svg></span><span class="txt">Nothing needs you<span class="sub">${working ? `${working === 1 ? "One session is" : working + " sessions are"} working.` : "No sessions running."}</span></span></div>`; return; }
  const x = needs[0]; const st = STATE[x.state]; const ln = lineOf(x);
  el.innerHTML = `<h2>${urgent.length ? "Next" : "Ready to review"}</h2><div class="card plate${urgent.length ? " needs" : ""}"><span class="plate-label">${ic(st.icon)}${st.word}</span><div class="meta">${jar(x.repo, x.sub)}<span class="where">${ago(Date.now() - x.stateSince)}</span></div><div class="ttl">${esc(x.title)}</div>${ln.text ? `<div class="line${ln.note ? " note" : ""}">${esc(ln.text)}</div>` : ""}<div class="acts">${x.managed ? `<a class="btn primary" href="#s/${x.sessionId}">Open</a>` : `<button class="btn primary" data-a="resume">Resume in Terminal</button>${x.kind === "background" ? `<button class="btn soft" data-a="here">Open here instead</button>` : ""}<button class="btn ghost" data-a="reveal">Show folder</button>`}${needs.length > 1 ? `<span class="where">${needs.length - 1} more in the sidebar</span>` : ""}</div><div class="path">${esc(x.cwd)}</div></div>`;
  el.querySelector('[data-a="resume"]')?.addEventListener("click", (e) => act("/api/resume", x.sessionId, e.target));
  el.querySelector('[data-a="here"]')?.addEventListener("click", () => send({ type: "resume", sessionId: x.sessionId, cwd: x.cwd }));
  if (x.live) el.querySelector(".card")?.insertAdjacentHTML("beforeend", `<p class="hint">Still open in a terminal. To move it here, quit it there first (type /exit), then come back and press Open here.</p>`);
  el.querySelector('[data-a="reveal"]')?.addEventListener("click", (e) => act("/api/reveal", x.sessionId, e.target)); icons();
}

// ---------- Rounds: every session that needs you, as cards you answer in place ----------
let roundsOn = false; const sentCards = new Map(); // id -> what the item looked like when you answered; a new reply drops it
let openRound = null; let roomTimer = {}; // roomTimer[id] = end time she asked for
const sentKey = (x) => `${x.pending?.id || ""}:${(x.lastReply || "").length}`;
function renderRounds() { renderRoom(); }
function renderRoom() {
  const id = roomId() || ""; const p = id === "none" ? null : projects.find(x => x.id === id); if (!p && id !== "none") { $("#room-head").innerHTML = `<p class="quiet">That project is gone.</p>`; $("#rounds-list").innerHTML = ""; $("#room-rest").innerHTML = ""; return; }
  const rooms = roomItems(); const its = rooms.get(id) || []; const el = $("#rounds-list");
  for (const it of its) if (it.t === "session") { const x = it.o; if (sentCards.has(x.sessionId) && sentCards.get(x.sessionId) !== sentKey(x) && x.needsYou) sentCards.delete(x.sessionId); }
  // what needs her: blocked first, then your turn, then PRs and waits that came back; inside, her priority, pinned order, longest wait
  const blockedRank = (it) => it.t === "session" ? (it.o.state === "needs-permission" ? 0 : it.o.state === "needs-answer" ? 1 : it.o.state === "failed" ? 2 : 3) : 4;
  const rank = (it) => { const sid = it.t === "session" ? it.o.sessionId : ""; const s = sid ? (prefs.stars || {})[sid] : null; return (sid ? prioOf(sid) : 2) * 1e6 + (s == null ? 1e5 : s); };
  const waiting = (it) => needsIt(it) && !(it.t === "session" && sentCards.has(it.o.sessionId));
  const queue = its.filter(it => needsIt(it) || (it.t === "session" && sentCards.has(it.o.sessionId))).sort((a, b) => waiting(b) - waiting(a) || blockedRank(a) - blockedRank(b) || rank(a) - rank(b) || (a.o.stateSince || a.o.updatedAt || a.o.since || 0) - (b.o.stateSince || b.o.updatedAt || b.o.since || 0));
  const cards = queue.map(it => it.t === "session" ? it.o : it.t === "pr" ? { sessionId: `pr:${it.o.key}`, pr: it.o, needsYou: true, state: "finished", stateSince: it.o.updatedAt, title: it.o.tickets[0] ? `${it.o.tickets[0]}: ${it.o.title}` : it.o.title, managed: false, cwd: "" } : { sessionId: `wait:${it.o.id}`, wait: it.o, needsYou: true, state: "finished", stateSince: it.o.backAt || it.o.since, title: it.o.text, managed: false, cwd: "" });
  const n = its.filter(needsIt).length, fl = its.filter(it => !needsIt(it) && !waitingIt(it)).length, w = its.filter(waitingIt).length;
  const counts = [n ? `<b>${n} need${n === 1 ? "s" : ""} you</b>` : "", fl ? `${fl} in flight` : "", w ? `${w} waiting on others` : ""].filter(Boolean).join(", ");
  // elsewhere: only blocked items in other rooms
  const elsewhere = []; for (const [rid, ris] of rooms) { if (rid === id || mutedRoom(rid)) continue; for (const it of ris) if (it.t === "session" && it.o.needsYou && it.o.state !== "finished" && (rid === "none" || projects.find(q => q.id === rid)?.on)) elsewhere.push({ rid, it }); }
  const nextRoom = (() => { const on = projects.filter(q => q.on && q.id !== id && !mutedRoom(q.id)).sort((x, y) => x.prio - y.prio || x.order - y.order); for (const q of on) { const k = rooms.get(q.id).filter(needsIt).length; if (k) return { name: q.name, id: q.id, k }; } const k = mutedRoom("none") ? 0 : (rooms.get("none") || []).filter(needsIt).length; return k && id !== "none" ? { name: "Unassigned", id: "none", k } : null; })();
  const timer = roomTimer[id]; const timerLine = timer ? (Date.now() > timer ? `<span class="room-timer">Your hour is up. Stay, or ${nextRoom ? `<a href="#p/${nextRoom.id}">go to ${esc(nextRoom.name)}</a>` : "find a good place"}.</span>` : `<span class="room-timer">Here until ${new Date(timer).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>`) : `<button type="button" class="btn tiny" id="room-hour">Work here for an hour</button>`;
  $("#room-head").innerHTML = `<div class="room-top"><h1 class="room-name">${esc(p ? p.name : "No project")}</h1>${p ? `<span class="room-prio">${PRIO[p.prio]}${p.on ? "" : ", quiet"}</span>` : ""}<span class="grow"></span>${timerLine}</div><p class="room-counts">${counts || "Nothing in flight."}</p>${!p ? `<p class="hint">These have no project yet. Drag a row onto a project in the sidebar, or leave them.</p>` : ""}`;
  $("#room-hour")?.addEventListener("click", () => { roomTimer[id] = Date.now() + 3600e3; renderRoom(); });
  // the accordion
  if (!cards.length) { el.innerHTML = `<div class="plate room-done"><span class="plate-label">${ic("moon-star")}Good place</span><p>Nothing here needs you.${fl || w ? ` ${[fl ? `${fl} in flight` : "", w ? `${w} waiting on others` : ""].filter(Boolean).join(", ")}.` : ""}</p>${nextRoom ? `<a class="btn primary" href="#p/${nextRoom.id}">Open ${esc(nextRoom.name)}, ${nextRoom.k} need${nextRoom.k === 1 ? "s" : ""} you</a>` : `<p class="quiet">Nothing needs you in any project.</p>`}</div>`; openRound = null; }
  else {
    if (!openRound || !cards.some(x => x.sessionId === openRound)) { const nx = cards.find(x => !(sentCards.has(x.sessionId) && !x.needsYou)); openRound = nx ? nx.sessionId : null; }
    const ordered = cards.slice(); // in room order; the open one stays where it is, so Cmd+Down walks down the list
    const keep = new Set(ordered.map(x => x.sessionId)); for (const old of [...el.children]) if (!keep.has(old.dataset.id)) old.remove();
    ordered.forEach((x, i) => { const isOpen = x.sessionId === openRound;
      const key = JSON.stringify([x.state, x.pending?.id, (x.lastReply || "").length, sentCards.has(x.sessionId), i, isOpen, x.title, x.note || prefs.notes?.[x.sessionId] || "", ordered.length, x.wait?.back || "", x.pr?.reason || ""]);
      let card = el.querySelector(`[data-id="${CSS.escape(x.sessionId)}"]`); if (card && card.dataset.key === key) { if (el.children[i] !== card) el.insertBefore(card, el.children[i] || null); return; }
      const fresh = roundCard(x, isOpen, ordered.some(y => y !== x && !(sentCards.has(y.sessionId) && !y.needsYou))); fresh.dataset.key = key; fresh.draggable = true; fresh.dataset.item = itemId(x.pr || x.wait || x); fresh.dataset.key2 = itemKey(x.pr || x.wait || x);
      fresh.addEventListener("dragstart", (e) => { dragItem = { item: fresh.dataset.item, key: fresh.dataset.key2 }; e.dataTransfer.effectAllowed = "move"; });
      const draft = card?.querySelector("textarea")?.value; if (draft) { const t = fresh.querySelector("textarea"); if (t) t.value = draft; }
      if (card) card.replaceWith(fresh); else el.insertBefore(fresh, el.children[i] || null); });
    const focusBox = el.querySelector(".rc.is-open textarea"); if (focusBox && document.activeElement?.tagName !== "TEXTAREA") focusBox.focus({ preventScroll: true });
  }
  // the rest: in flight, waiting on others, new session, elsewhere, more
  const row = (it) => { const o = it.o; const title = it.t === "pr" ? (o.tickets?.[0] ? `${o.tickets[0]}: ${o.title}` : o.title) : it.t === "wait" ? o.text : o.title; const state = it.t === "pr" ? PR_WORD[o.state] : it.t === "wait" ? "Waiting" : (sentCards.has(o.sessionId) ? "Sent" : STATE[o.state].word); const href = it.t === "pr" ? "#prs" : it.t === "wait" ? (o.link || "#") : hrefOf(o);
    return `<li class="proj-item" draggable="true" data-item="${esc(itemId(o))}" data-key="${esc(itemKey(o))}"><span class="proj-kind">${ic(it.t === "pr" ? "git-pull-request" : it.t === "wait" ? "hourglass" : "message-circle")}</span><a href="${esc(href)}" class="proj-title" ${it.t === "wait" && o.link ? 'target="_blank" rel="noopener"' : ""}>${esc(title)}</a><span class="proj-state">${esc(state)}</span>${it.t === "wait" ? `<span class="rc-acts"><button class="btn tiny" data-wback="${o.id}">It came back</button><button class="btn tiny" data-wdrop="${o.id}">Let it go</button></span>` : ""}</li>`; };
  const group = (name, arr) => arr.length ? `<h3 class="lg-h">${name}</h3><ul class="proj-items">${arr.map(row).join("")}</ul>` : "";
  const folders = [...new Set(its.filter(it => it.t === "session").map(it => it.o.cwd).filter(Boolean))]; const lastCwd = folders[0] || prefs.lastCwd || "";
  const going = its.filter(it => it.t === "session" && (it.o.state === "working" || it.o.needsYou)).length;
  const newForm = projNewOpen === id ? `<form class="proj-new" data-new="${id}"><label><span>Folder</span><input name="cwd" value="${esc(tilde(lastCwd))}" list="room-folders"><datalist id="room-folders">${folders.map(f => `<option value="${esc(tilde(f))}">`).join("")}</datalist></label><label><span>Ticket</span><input name="ticket" placeholder="VDC-1234"></label><label><span>First message</span><textarea name="msg" rows="2" placeholder="What should it do first? Enter to start."></textarea></label>${going >= 3 ? `<p class="hint">${going} already going here.</p>` : ""}<div class="rc-acts"><button class="btn primary" type="submit">Start</button><button class="btn tiny" type="button" data-cancel="1">Cancel</button></div></form>` : "";
  const editP = p && projEditOpen === id ? `<div class="rc-extra proj-extra"><div class="proj-edit"><label>Name <input class="proj-name-in" value="${esc(p.name)}"></label><label>Matches <input class="proj-words-in" value="${esc(p.words.join(", "))}" placeholder="words from titles, comma separated"></label><label>Keys <input class="proj-keys-in" value="${esc(p.keys.join(", "))}" placeholder="ticket keys it learned"></label></div><div class="rc-acts"><span class="prio">${[1, 2, 3].map(k => `<button type="button" class="prio-b${p.prio === k ? " on" : ""} p${k}" data-pprio="${k}">${PRIO[k]}</button>`).join("")}</span><button class="btn tiny" data-quiet="1">${p.on ? "Quiet" : "Wake"}</button><button class="btn tiny" data-remove="1">Remove project</button></div><p class="hint">Quiet projects leave the list and sit behind "off". Their items stay.</p></div>` : "";
  $("#room-rest").innerHTML = `${group("In flight", its.filter(it => !needsIt(it) && !waitingIt(it)))}${group("Waiting on others", its.filter(waitingIt))}${newForm}<div class="rc-tail proj-foot">${p ? `<button class="btn tiny" type="button" data-newsess="${id}">New session in ${esc(p.name)}</button>` : ""}${p ? `<button class="rc-more" type="button" data-editp="1">${projEditOpen === id ? "Done" : "Edit this project"}</button>` : ""}</div>${editP}${elsewhere.length ? `<p class="hint">Elsewhere: ${esc(elsewhere[0].it.o.title)} is ${STATE[elsewhere[0].it.o.state].word.toLowerCase()}. <a href="#p/${elsewhere[0].rid}">Open it</a>${elsewhere.length > 1 ? `, and ${elsewhere.length - 1} more.` : "."}</p>` : ""}`;
  const post = (b) => fetch("/api/project", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
  const rest = $("#room-rest");
  rest.querySelectorAll(".proj-item[draggable]").forEach(r => r.addEventListener("dragstart", (e) => { dragItem = { item: r.dataset.item, key: r.dataset.key }; e.dataTransfer.effectAllowed = "move"; }));
  const wpost = (body) => fetch("/api/wait", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  rest.querySelectorAll("[data-wback]").forEach(b => b.onclick = (e) => { e.preventDefault(); wpost({ back: b.dataset.wback, why: "You said it came back" }); });
  rest.querySelectorAll("[data-wdrop]").forEach(b => b.onclick = (e) => { e.preventDefault(); wpost({ remove: b.dataset.wdrop }); });
  rest.querySelector("[data-newsess]")?.addEventListener("click", () => { projNewOpen = id; renderRoom(); $("#room-rest .proj-new textarea")?.focus(); });
  const f = rest.querySelector(".proj-new"); if (f) { f.querySelector("[data-cancel]").onclick = () => { projNewOpen = false; renderRoom(); };
    f.querySelector("textarea").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } if (e.key === "Escape") { projNewOpen = false; renderRoom(); } });
    f.onsubmit = (e) => { e.preventDefault(); const cwd = resolveCwd(f.cwd.value), ticket = f.ticket.value.trim().toUpperCase(), msg = f.msg.value.trim(); if (!cwd || !msg) { (cwd ? f.msg : f.cwd).focus(); return; } prefs.lastCwd = tilde(cwd); save(); send({ type: "start", cwd, prompt: ticket ? `${ticket}: ${msg}` : msg, project: id === "none" ? undefined : id, key: ticket || undefined, quiet: true }); projNewOpen = false; renderRoom(); }; }
  rest.querySelector("[data-editp]")?.addEventListener("click", () => { projEditOpen = projEditOpen === id ? null : id; renderRoom(); });
  if (p && projEditOpen === id) { const saveFields = () => { const name = rest.querySelector(".proj-name-in").value.trim() || p.name; const words = rest.querySelector(".proj-words-in").value.split(",").map(s => s.trim()).filter(Boolean); const keys = rest.querySelector(".proj-keys-in").value.split(",").map(s => s.trim().toUpperCase()).filter(Boolean); if (name !== p.name || words.join() !== p.words.join() || keys.join() !== p.keys.join()) post({ id, name, words, keys }); };
    rest.querySelectorAll(".proj-name-in,.proj-words-in,.proj-keys-in").forEach(i => { i.onchange = saveFields; i.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); i.blur(); } }; });
    rest.querySelectorAll("[data-pprio]").forEach(b => b.onclick = () => post({ id, name: p.name, prio: +b.dataset.pprio }));
    rest.querySelector("[data-quiet]").onclick = () => post({ id, name: p.name, on: !p.on });
    rest.querySelector("[data-remove]").onclick = () => { const snap = { ...p }; post({ remove: id }); location.hash = ""; const u = $("#undo"); $("#undo-text").textContent = `Removed "${p.name}". Its items are under No project.`; u.hidden = false; $("#undo-btn").onclick = () => { post({ name: snap.name, prio: snap.prio, on: snap.on, keys: snap.keys, words: snap.words }); u.hidden = true; }; setTimeout(() => { u.hidden = true; }, 12000); }; }
  icons();
}
let projEditOpen = null; let landed = false;
function moonSvg(p) { return ""; }
function aboveRule(t) { const m = String(t || "").match(/\n\s*(-{3,}|\*{3,})\s*\n/); return m ? t.slice(0, m.index) : t; }
function prPlate(x, isOpen, hasNext) { const p = x.pr; const card = document.createElement("article"); card.className = "rc plate " + (isOpen ? "is-open" : "is-collapsed"); card.dataset.id = x.sessionId;
  const label = `<span class="plate-label">${ic(PR_ICON[p.state] || "circle")}${PR_WORD[p.state]}</span>`;
  if (!isOpen) { card.innerHTML = `${label}<button class="rc-row" type="button"><span class="rc-title">${esc(x.title)}</span><span class="rc-note">${esc(p.short)}</span></button>`; card.querySelector(".rc-row").onclick = () => { openRound = x.sessionId; renderRounds(); }; return card; }
  card.innerHTML = `${hasNext ? `<button class="rc-next" type="button">Next one</button>` : ""}${label}<h3 class="rc-title">${esc(x.title)}</h3><p class="rc-need">${esc(p.reason)} This is the one you were waiting on.</p><div class="rc-acts">${p.sessionId ? `<a class="btn primary" href="#s/${p.sessionId}">Open its session</a>` : `<button class="btn primary" data-a="start">Start a session on this</button>`}<a class="btn tiny" href="${esc(p.url)}" target="_blank" rel="noopener">Open on GitHub</a>${p.alert ? `<button class="btn tiny" data-a="keep">Keep waiting</button>` : ""}<a class="btn tiny" href="#prs">See the PR</a></div>`;
  card.querySelector('[data-a="keep"]')?.addEventListener("click", () => fetch("/api/pr/keep-waiting", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: p.key }) }));
  card.querySelector(".rc-next")?.addEventListener("click", () => { const others = [...$("#rounds-list").children].map(c => c.dataset.id).filter(id => id !== x.sessionId); openRound = others[0] || null; renderRoom(); });
  card.querySelector('[data-a="start"]')?.addEventListener("click", () => { location.hash = ""; show("home"); $("#ns-cwd").value = guessCwd(p); $("#ns-prompt").value = `${p.tickets[0] ? p.tickets[0] + ": " : ""}pick up ${p.short}, ${p.url}. Read the newest review comments and the failing checks first.`; $("#ns-prompt").focus(); });
  return card; }
function needLine(x, sent) { // one plain line: what this item wants from you
  if (!x.managed) return x.state === "failed" ? "It failed in a terminal. Look there, or let it go." : "It runs in a terminal. Answer it there.";
  if (sent && !x.needsYou) return "Sent. Working on it.";
  if (x.pending?.kind === "permission") return `Wants to run ${x.pending.toolName || "a tool"}. Allow it?`;
  if (x.pending) return "Asked you a question.";
  if (x.state === "failed") return "It failed. Reply to try again, or close it.";
  return ""; // finished: the reply's own first line says what happened
}
function waitPlate(x, isOpen) { const w = x.wait; const card = document.createElement("article"); card.className = "rc plate " + (isOpen ? "is-open" : "is-collapsed"); card.dataset.id = x.sessionId;
  const label = `<span class="plate-label">${ic("hourglass")}Came back</span>`;
  if (!isOpen) { card.innerHTML = `${label}<button class="rc-row" type="button"><span class="rc-title">${esc(w.text)}</span><span class="rc-note">${esc(w.back || "")}</span></button>`; card.querySelector(".rc-row").onclick = () => { openRound = x.sessionId; renderRoom(); }; return card; }
  card.innerHTML = `${label}<h3 class="rc-title">${esc(w.text)}</h3><p class="rc-need">${esc(w.back || "It came back.")}</p><div class="rc-acts">${w.link ? `<a class="btn primary" href="${esc(w.link)}" target="_blank" rel="noopener">Open it</a>` : ""}<button class="btn tiny" data-a="done">Done with it</button></div>`;
  card.querySelector('[data-a="done"]').onclick = () => fetch("/api/wait", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ remove: w.id }) }); return card; }
function roundCard(x, isOpen, hasNext) {
  if (x.wait) return waitPlate(x, isOpen);
  if (x.pr) return prPlate(x, isOpen, hasNext);
  const st = STATE[x.state]; const sent = sentCards.has(x.sessionId); const note = x.note || prefs.notes?.[x.sessionId] || "";
  const card = document.createElement("article"); card.className = "rc plate " + (isOpen ? "is-open" : "is-collapsed") + (sent ? " sent" : ""); card.dataset.id = x.sessionId;
  const label = `<span class="plate-label">${ic(st.icon)}${sent && !x.needsYou ? "Sent" : st.word}</span>`;
  if (!isOpen) { card.innerHTML = `${label}<button class="rc-row" type="button"><span class="rc-title">${esc(x.title)}</span>${sent && !x.needsYou ? `<span class="rc-note">Sent. Working on it.</span>` : note ? `<span class="rc-note">${esc(note)}</span>` : ""}</button>`;
    card.querySelector(".rc-row").onclick = () => { openRound = x.sessionId; renderRounds(); }; return card; }
  // the open item: title, one line saying what it needs, the reply, one way to answer, and the rest behind More
  const need = needLine(x, sent); card.innerHTML = `${label}<h3 class="rc-title">${esc(x.title)}</h3>${soFarHtml(x)}${x.prompt ? `<div class="rc-ask">${esc(x.prompt)}</div>` : ""}${need ? `<p class="rc-need">${esc(need)}</p>` : ""}`;
  if (x.pending) { const box = document.createElement("div"); box.className = "pending"; renderPendingInto(box, x.pending, x.sessionId); card.appendChild(box); }
  else if (x.lastReply || x.last) { const body = document.createElement("div"); body.className = "rc-body clamp"; body.appendChild(docHtml(x.lastReply || x.last, x.managed ? x.sessionId : undefined)); card.appendChild(body);
    const more = document.createElement("button"); more.className = "btn tiny rc-fold"; more.textContent = "Read the whole reply"; more.onclick = () => { body.classList.toggle("clamp"); more.textContent = body.classList.contains("clamp") ? "Read the whole reply" : "Show less"; }; card.appendChild(more);
    requestAnimationFrame(() => { if (body.scrollHeight <= body.clientHeight + 4) { body.classList.remove("clamp"); more.hidden = true; } }); }
  const answered = () => { sentCards.set(x.sessionId, sentKey(x)); renderRoom(); }; // stays here; the reply lands in this plate. Cmd+Down moves on
  if (!x.managed) { card.insertAdjacentHTML("beforeend", `<div class="rc-answer"><button class="btn primary" data-a="resume">Resume in Terminal</button></div>`); card.querySelector('[data-a="resume"]').onclick = (e) => act("/api/resume", x.sessionId, e.target); }
  else if (!(sent && !x.needsYou)) {
    const f = document.createElement("form"); f.className = "rc-reply";
    const ph = x.pending ? (x.pending.kind === "permission" ? "Or type to deny with a note" : "Or answer in your own words") : "Reply. Enter to send";
    f.innerHTML = `<textarea rows="2" placeholder="${ph}"></textarea><button class="btn primary" type="submit">Send</button>`; if (!x.pending) armSuggestion(f.querySelector("textarea"), x.lastReply || "");
    acceptFiles(f.querySelector("textarea"), () => x.sessionId);
    f.onsubmit = (e) => { e.preventDefault(); const t = withFiles(f.querySelector("textarea"), f.querySelector("textarea").value.trim()); if (!t) return;
      if (x.pending) send({ type: "answer", sessionId: x.sessionId, requestId: x.pending.id, decision: x.pending.kind === "permission" ? { behavior: "deny", message: t } : { freeText: t } }); else send({ type: "send", sessionId: x.sessionId, text: t }); answered(); };
    f.querySelector("textarea").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } }); card.appendChild(f);
  }
  const row = document.createElement("div"); row.className = "rc-tail"; row.insertAdjacentHTML("beforeend", prioCtl(x.sessionId));
  const more = document.createElement("button"); more.className = "rc-more"; more.type = "button"; more.textContent = "More"; row.appendChild(more);
  if (hasNext) { const nx = document.createElement("button"); nx.className = "rc-next"; nx.type = "button"; nx.textContent = "Next one"; nx.title = "Next one (Cmd+Down; Cmd+Up goes back)"; nx.onclick = () => { const ids = [...$("#rounds-list").children].map(c => c.dataset.id); const i = ids.indexOf(x.sessionId); openRound = ids[i + 1] || ids.find(id => id !== x.sessionId) || null; renderRoom(); $("#rounds-list").querySelector(".rc.is-open")?.scrollIntoView({ block: "start" }); }; card.insertAdjacentElement("afterbegin", nx); }
  card.appendChild(row);
  const extra = document.createElement("div"); extra.className = "rc-extra"; extra.hidden = true;
  extra.innerHTML = `<div class="rc-acts"><button class="btn tiny" data-a="note">Leave a note</button>${x.managed ? `<button class="btn tiny" data-a="close">Close session</button><a class="btn tiny" href="#s/${x.sessionId}">Open in focus</a>` : `<button class="btn tiny" data-a="letgo">Let it go</button>`}</div><p class="rc-foot">${ago(Date.now() - x.stateSince)} waiting<span class="path">${esc(x.cwd)}</span></p>`;
  more.onclick = () => { extra.hidden = !extra.hidden; more.textContent = extra.hidden ? "More" : "Less"; };
  extra.querySelector('[data-a="note"]').onclick = () => { const v = prompt("Note to self, shown on the item", note); if (v === null) return; if (x.managed) send({ type: "note", sessionId: x.sessionId, note: v }); else { prefs.notes = { ...(prefs.notes || {}), [x.sessionId]: v.trim() }; if (!prefs.notes[x.sessionId]) delete prefs.notes[x.sessionId]; save(); renderSide(); renderRounds(); } };
  extra.querySelector('[data-a="close"]')?.addEventListener("click", () => { closeWithUndo(x); openRound = null; });
  extra.querySelector('[data-a="letgo"]')?.addEventListener("click", async () => { if (!confirm("Let this session go? It ends now. The conversation stays on disk.")) return; try { await fetch("/api/letgo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: x.sessionId }) }); } catch {} prefs.dismissed = [...(prefs.dismissed || []), x.sessionId]; unpin(x.sessionId); save(); renderSide(); renderRounds(); });
  card.appendChild(extra);
  return card;
}

// ---------- projects: which bucket a thing belongs to, and whether that bucket is on ----------
const KEY_RE = /\b(VDC|D|STORY|PROJ|OPS|DOCS)-(\d{1,6})\b/i;
const keyOf = (text) => { const m = String(text || "").match(KEY_RE); return m ? `${m[1].toUpperCase()}-${m[2]}` : ""; };
const itemId = (o) => o.pr ? `pr:${o.pr.key}` : o.key && o.repo ? `pr:${o.key}` : o.kind && o.since ? `wait:${o.id}` : `s:${o.sessionId}`;
const itemKey = (o) => o.repo ? (o.tickets?.[0] || "") : o.kind && o.since ? (o.ticket || keyOf(o.text)) : keyOf(o.title);
const itemText = (o) => o.repo ? `${o.title} ${o.headRef || ""} ${o.tickets?.join(" ") || ""}` : o.kind && o.since ? o.text : `${o.title} ${o.prompt || ""} ${o.cwd || ""}`;
function projectOf(o) { const id = itemId(o); if (assign[id]) return projects.find(p => p.id === assign[id]) || null;
  const key = itemKey(o); const text = itemText(o).toLowerCase();
  return projects.find(p => (key && p.keys.includes(key)) || p.words.some(w => w && text.includes(w.toLowerCase()))) || null; }
const projectOn = (o) => { const p = projectOf(o); return !p || p.on; };
let projOpenId = null, projRowOpen = null, projNewOpen = false;
function renderProjects() {
  const head = $("#proj-head"), body = $("#proj-body");
  const post = (b) => fetch("/api/project", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
  const items = [...list.filter(x => !isDismissed(x) && !isOld(x) && x.state !== "idle").map(x => ({ o: x, t: "session" })), ...prList.filter(p => !p.shelved).map(p => ({ o: p, t: "pr" })), ...waitList.map(w => ({ o: w, t: "wait" }))];
  const needs = (it) => it.t === "pr" ? it.o.needsYou && it.o.watched : it.t === "wait" ? !!it.o.back : it.o.needsYou;
  const waiting = (it) => it.t === "pr" ? it.o.watched && !it.o.needsYou : it.t === "wait" ? !it.o.back : false;
  const buckets = new Map(projects.map(p => [p.id, []])); const unsorted = [];
  for (const it of items) { const p = projectOf(it.o); if (p) buckets.get(p.id).push(it); else unsorted.push(it); }
  const counts = (its) => { const n = its.filter(needs).length, w = its.filter(waiting).length, f = its.length - n - w; const parts = []; if (n) parts.push(`<b>${n} need${n === 1 ? "s" : ""} you</b>`); if (f) parts.push(`${f} in flight`); if (w) parts.push(`${w} waiting on others`); return parts.length ? parts.join(", ") : "nothing in flight"; };
  const ordered = projects.slice().sort((a, b) => (a.on ? 0 : 1) - (b.on ? 0 : 1) || (buckets.get(b.id).filter(needs).length > 0) - (buckets.get(a.id).filter(needs).length > 0) || a.prio - b.prio || a.order - b.order);
  const row = (it) => { const o = it.o; const id = itemId(o); const key = itemKey(o);
    const title = it.t === "pr" ? (o.tickets?.[0] ? `${o.tickets[0]}: ${o.title}` : o.title) : it.t === "wait" ? o.text : o.title;
    const state = it.t === "pr" ? PR_WORD[o.state] : it.t === "wait" ? (o.back ? "Came back" : "Waiting") : (sentCards.has(o.sessionId) && !o.needsYou ? "Sent" : STATE[o.state].word);
    const href = it.t === "pr" ? "#prs" : it.t === "wait" ? (o.link || "#") : hrefOf(o);
    const canOpen = it.t !== "wait"; const open = projRowOpen === id;
    return `<li class="proj-item${open ? " open" : ""}" draggable="true" data-item="${esc(id)}" data-key="${esc(key)}"><span class="proj-kind">${ic(it.t === "pr" ? "git-pull-request" : it.t === "wait" ? "hourglass" : "message-circle")}</span>${canOpen ? `<button type="button" class="proj-title proj-open" data-open="${esc(id)}">${esc(title)}</button>` : `<a href="${esc(href)}" class="proj-title">${esc(title)}</a>`}<span class="proj-state">${esc(state)}</span>${open ? `<div class="proj-work" data-work="${esc(id)}"></div>` : ""}</li>`; };
  const group = (name, its) => its.length ? `<h3 class="lg-h">${name}</h3><ul class="proj-items">${its.map(row).join("")}</ul>` : "";
  const plate = (p) => { const its = buckets.get(p.id); const open = projOpenId === p.id; const top = ordered[0]?.id === p.id && its.some(needs);
    if (!open) return `<article class="rc plate is-collapsed proj-plate${p.on ? "" : " quiet"}${top ? " top" : ""}" data-proj="${p.id}"><span class="plate-label">${p.on ? PRIO[p.prio] : `${ic("moon")}Quiet`}</span><button class="rc-row" type="button"><span class="rc-title">${esc(p.name)}</span><span class="rc-note">${counts(its)}</span></button></article>`;
    const nextIt = its.filter(needs)[0]; const going = its.filter(it => it.t === "session" && (it.o.state === "working" || it.o.needsYou)).length;
    const elsewhere = projects.filter(q => q.id !== p.id && q.on).reduce((n, q) => n + buckets.get(q.id).filter(needs).length, 0);
    const nextLine = nextIt ? `<p class="proj-next">Next here: <button type="button" class="proj-open link" data-open="${esc(itemId(nextIt.o))}">${esc(nextIt.t === "pr" ? nextIt.o.short : nextIt.o.title)}</button>, ${esc((nextIt.t === "pr" ? PR_WORD[nextIt.o.state] : nextIt.t === "wait" ? "came back" : STATE[nextIt.o.state].word).toLowerCase())}.</p>` : `<p class="proj-next quiet">Nothing here needs you.${elsewhere ? ` <a href="#rounds">Rounds has ${elsewhere}.</a>` : ""}</p>`;
    const folders = [...new Set(its.filter(it => it.t === "session").map(it => it.o.cwd).filter(Boolean))]; const lastCwd = folders[0] || prefs.lastCwd || "";
    const newForm = projNewOpen === p.id ? `<form class="proj-new" data-new="${p.id}"><label><span>Folder</span><input name="cwd" value="${esc(tilde(lastCwd))}" list="proj-folders-${p.id}"><datalist id="proj-folders-${p.id}">${folders.map(f => `<option value="${esc(tilde(f))}">`).join("")}</datalist></label><label><span>Ticket</span><input name="ticket" placeholder="VDC-1234"></label><label><span>First message</span><textarea name="msg" rows="2" placeholder="What should it do first? Enter to start."></textarea></label>${going >= 3 ? `<p class="hint">${going} already going here.</p>` : ""}<div class="rc-acts"><button class="btn primary" type="submit">Start</button><button class="btn tiny" type="button" data-cancel="1">Cancel</button></div></form>` : "";
    return `<article class="rc plate is-open proj-plate${p.on ? "" : " quiet"}${top ? " top" : ""}" data-proj="${p.id}"><span class="plate-label">${p.on ? PRIO[p.prio] : `${ic("moon")}Quiet`}</span><button class="rc-next" type="button" data-fold="1">Fold</button><h3 class="rc-title">${esc(p.name)}</h3><p class="rc-need">${counts(its)}</p>${nextLine}<svg class="vine rc-vine" height="12" aria-hidden="true"><use href="#vine"/></svg>
      ${newForm}${its.length ? group("Needs you", its.filter(needs)) + group("In flight", its.filter(it => !needs(it) && !waiting(it))) + group("Waiting on others", its.filter(waiting)) : `<p class="quiet">Nothing in flight. Drag rows here from Unsorted, or give it words that match.</p>`}
      <div class="rc-tail proj-foot"><button class="btn tiny" type="button" data-newsess="${p.id}">New session in ${esc(p.name)}</button><button class="rc-more" type="button" data-more="1">More</button></div>${elsewhere && nextIt ? `<p class="hint">Elsewhere: ${elsewhere} need${elsewhere === 1 ? "s" : ""} you. <a href="#rounds">Open Rounds</a></p>` : ""}
      <div class="rc-extra proj-extra" hidden><div class="proj-edit"><label>Name <input class="proj-name-in" value="${esc(p.name)}"></label><label>Matches <input class="proj-words-in" value="${esc(p.words.join(", "))}" placeholder="words from titles, comma separated"></label><label>Keys <input class="proj-keys-in" value="${esc(p.keys.join(", "))}" placeholder="ticket keys it learned"></label></div>
      <div class="rc-acts"><span class="prio">${[1, 2, 3].map(n => `<button type="button" class="prio-b${p.prio === n ? " on" : ""} p${n}" data-pprio="${n}">${PRIO[n]}</button>`).join("")}</span><button class="btn tiny" data-quiet="1">${p.on ? "Quiet" : "Wake"}</button><button class="btn tiny" data-remove="1">Remove project</button></div><p class="hint">Quiet projects leave the sidebar and Rounds and sink to the bottom here.</p></div></article>`; };
  head.innerHTML = `<p class="proj-how">One plate per project. Open one to see what is in flight. Quiet ones sit at the bottom and stay out of the sidebar and Rounds.</p>`;
  body.innerHTML = ordered.map(plate).join("") + (unsorted.length ? `<article class="rc plate proj-plate unsorted ${projOpenId === "unsorted" ? "is-open" : "is-collapsed"}" data-proj="unsorted"><span class="plate-label">Unsorted</span>${projOpenId === "unsorted" ? `<h3 class="rc-title">Unsorted</h3><p class="rc-need">Drag a row onto a project above. A row with a ticket key you sorted before sorts itself.</p><ul class="proj-items">${unsorted.map(row).join("")}</ul>` : `<button class="rc-row" type="button"><span class="rc-title">Unsorted</span><span class="rc-note">${unsorted.length}</span></button>`}</article>` : "") + `<button type="button" class="proj-add-link" id="proj-add-link">+ Add a project</button><form id="proj-add" class="proj-addform" hidden><input name="name" placeholder="Project name, Enter to save" aria-label="Project name"></form>`;
  // rows open in place: the same content as an open Rounds plate, without its frame
  body.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { projRowOpen = projRowOpen === b.dataset.open ? null : b.dataset.open; renderProjects(); });
  body.querySelectorAll("[data-work]").forEach(w => { const id = w.dataset.work; let x = null;
    if (id.startsWith("s:")) x = list.find(s => s.sessionId === id.slice(2)); else if (id.startsWith("pr:")) { const p = prList.find(p => p.key === id.slice(3)); if (p) x = { sessionId: id, pr: p, needsYou: p.needsYou, state: "finished", stateSince: p.updatedAt, title: p.tickets[0] ? `${p.tickets[0]}: ${p.title}` : p.title, managed: false, cwd: "" }; }
    if (!x) return; const card = roundCard(x, true, false); card.classList.add("in-project"); w.appendChild(card); const ta = card.querySelector("textarea"); if (ta) { ta.rows = 2; ta.focus({ preventScroll: true }); } });
  body.querySelectorAll("[data-newsess]").forEach(b => b.onclick = () => { projNewOpen = b.dataset.newsess; renderProjects(); body.querySelector(".proj-new textarea")?.focus(); });
  body.querySelectorAll(".proj-new").forEach(f => { f.querySelector("[data-cancel]").onclick = () => { projNewOpen = false; renderProjects(); };
    f.querySelector("textarea").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } if (e.key === "Escape") { projNewOpen = false; renderProjects(); } });
    f.onsubmit = (e) => { e.preventDefault(); const cwd = resolveCwd(f.cwd.value), ticket = f.ticket.value.trim().toUpperCase(), msg = f.msg.value.trim(); if (!cwd || !msg) { (cwd ? f.msg : f.cwd).focus(); return; } prefs.lastCwd = tilde(cwd); save();
      send({ type: "start", cwd, prompt: ticket ? `${ticket}: ${msg}` : msg, project: f.dataset.new, key: ticket || undefined, quiet: true }); projNewOpen = false; renderProjects(); }; });
  // open and fold
  body.querySelectorAll(".proj-plate.is-collapsed .rc-row").forEach(b => b.onclick = () => { projOpenId = b.closest(".proj-plate").dataset.proj; projRowOpen = null; renderProjects(); });
  body.querySelectorAll("[data-fold]").forEach(b => b.onclick = () => { projOpenId = null; renderProjects(); });
  body.querySelectorAll("[data-more]").forEach(b => b.onclick = () => { const x = b.closest(".proj-plate").querySelector(".proj-extra"); x.hidden = !x.hidden; b.textContent = x.hidden ? "More" : "Less"; });
  // edits inside the open plate
  const openPlate = body.querySelector(".proj-plate.is-open:not(.unsorted)"); if (openPlate) { const pid = openPlate.dataset.proj; const p = projects.find(x => x.id === pid);
    const saveFields = () => { const name = openPlate.querySelector(".proj-name-in").value.trim() || p.name; const words = openPlate.querySelector(".proj-words-in").value.split(",").map(s => s.trim()).filter(Boolean); const keys = openPlate.querySelector(".proj-keys-in").value.split(",").map(s => s.trim().toUpperCase()).filter(Boolean); if (name !== p.name || words.join() !== p.words.join() || keys.join() !== p.keys.join()) post({ id: pid, name, words, keys }); };
    openPlate.querySelectorAll(".proj-name-in,.proj-words-in,.proj-keys-in").forEach(i => { i.onchange = saveFields; i.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); i.blur(); } }; });
    openPlate.querySelectorAll("[data-pprio]").forEach(b => b.onclick = () => post({ id: pid, name: p.name, prio: +b.dataset.pprio }));
    openPlate.querySelector("[data-quiet]").onclick = () => post({ id: pid, name: p.name, on: !p.on });
    openPlate.querySelector("[data-remove]").onclick = () => { const snap = { ...p }; post({ remove: pid }); projOpenId = null; const u = $("#undo"); $("#undo-text").textContent = `Removed "${p.name}". Its items are in Unsorted.`; u.hidden = false; $("#undo-btn").onclick = () => { post({ name: snap.name, prio: snap.prio, on: snap.on, keys: snap.keys, words: snap.words }); u.hidden = true; }; setTimeout(() => { u.hidden = true; }, 12000); }; }
  // add
  $("#proj-add-link").onclick = () => { const f = $("#proj-add"); f.hidden = false; $("#proj-add-link").hidden = true; f.name.focus(); };
  $("#proj-add").onsubmit = (e) => { e.preventDefault(); const name = e.target.name.value.trim(); if (!name) return; post({ name, prio: 1 }); };
  // drag a row onto a project plate
  let dragging = null;
  body.querySelectorAll(".proj-item[draggable]").forEach(r => { r.addEventListener("dragstart", (e) => { dragging = { item: r.dataset.item, key: r.dataset.key }; e.dataTransfer.effectAllowed = "move"; r.classList.add("dragging"); }); r.addEventListener("dragend", () => { r.classList.remove("dragging"); body.querySelectorAll(".proj-plate.over").forEach(x => x.classList.remove("over")); }); });
  body.querySelectorAll(".proj-plate:not(.unsorted)").forEach(pl => { pl.addEventListener("dragover", (e) => { if (!dragging) return; e.preventDefault(); pl.classList.add("over"); }); pl.addEventListener("dragleave", () => pl.classList.remove("over")); pl.addEventListener("drop", (e) => { if (!dragging) return; e.preventDefault(); pl.classList.remove("over"); post({ assign: { item: dragging.item, project: pl.dataset.proj, key: dragging.key || undefined } }); dragging = null; }); });
  const uns = body.querySelector(".proj-plate.unsorted"); if (uns) { uns.addEventListener("dragover", (e) => { if (!dragging) return; e.preventDefault(); uns.classList.add("over"); }); uns.addEventListener("dragleave", () => uns.classList.remove("over")); uns.addEventListener("drop", (e) => { if (!dragging) return; e.preventDefault(); uns.classList.remove("over"); post({ assign: { item: dragging.item, project: null } }); dragging = null; }); }
  icons();
}
// ---------- pull requests ----------
let prList = [], prRepos = {}, prJira = {}, waitList = [], projects = [], assign = {}; const prOpen = new Set(); let prFilter = "all";
const PR_ICON = { changes: "message-square-warning", "checks-failing": "circle-x", conflict: "git-merge", ready: "circle-check", "approved-qa": "flask-conical", "claude-approved": "sparkles", "claude-reviewing": "orbit", "checks-running": "loader", review: "clock", draft: "pencil-line", shelf: "archive" };
const NEEDS_PR = ["changes", "checks-failing", "conflict", "ready", "claude-reviewing", "checks-running"];
const PR_WORD = { changes: "Changes asked for", "checks-failing": "Checks failing", conflict: "Merge conflict", ready: "Ready to merge", "approved-qa": "Approved, in QA", "claude-approved": "Approved by Claude", "claude-reviewing": "Claude is reviewing", "checks-running": "Checks running", review: "Waiting on review", draft: "Draft", shelf: "Shelved" };
const prPrio = (p) => p.prio || projectOf(p)?.prio || 2;
let prPrioFilter = 0, repoSetupOpen = null;
function renderPrs() {
  const el = $("#prs-groups"); const note = $("#prs-note"); const err = prList.find(p => p.error)?.error || (prJira.connected ? prJira.error : "Ticket status needs Jira. Save an API token to ~/.config/stillroom/jira-token."); note.hidden = !err; note.textContent = err || "";
  if (!prList.length) { el.innerHTML = `<p class="quiet">${err ? "" : "No open pull requests, or the first look is still on its way."}</p>`; return; }
  // a filter row, then repositories; inside a repo what needs her first, drafts last
  const FILTERS = [["all", "All", (p) => !p.shelved], ["needs", "Needs you", (p) => p.needsYou], ["review", "Waiting on review", (p) => p.state === "review" || p.state === "checks-running"], ["qa", "In QA", (p) => p.state === "approved-qa"], ["claude", "Approved by Claude", (p) => p.state === "claude-approved"], ["draft", "Drafts", (p) => p.isDraft && !p.shelved], ["shelf", "Shelf", (p) => p.shelved]];
  const rank = (p) => p.needsYou ? 0 : p.isDraft ? 2 : 1; const fn = (FILTERS.find(f => f[0] === prFilter) || FILTERS[0])[2];
  const live = prList.filter(fn).filter(p => !prPrioFilter || prPrio(p) === prPrioFilter).sort((a, b) => prPrio(a) - prPrio(b) || rank(a) - rank(b) || a.updatedAt - b.updatedAt);
  const byRepo = new Map(); for (const p of live) { if (!byRepo.has(p.repo)) byRepo.set(p.repo, []); byRepo.get(p.repo).push(p); }
  const repos = [...byRepo].sort((a, b) => (b[1].some(p => p.needsYou) - a[1].some(p => p.needsYou)) || a[0].split("/")[1].localeCompare(b[0].split("/")[1]));
  el.innerHTML = `<div class="lg-filter pr-filter">${FILTERS.map(([k, w, f]) => { const n = prList.filter(f).length; return `<button class="btn tiny" data-f="${k}" aria-pressed="${prFilter === k}">${w}${n ? ` <span class="pr-count">${n}</span>` : ""}</button>`; }).join("")}<span class="grow"></span><span class="prio">${[1, 2, 3].map(n => `<button type="button" class="prio-b${prPrioFilter === n ? " on" : ""} p${n}" data-pf="${n}">${PRIO[n]}</button>`).join("")}</span></div>`
    + (repos.length ? repos.map(([repo, rows]) => { const r = prRepos[repo] || {}; const ok = !!(r.channel && r.reviewers?.length); const open = repoSetupOpen === repo;
      return `<section class="pr-repo"><h2 class="pr-h">${esc(repo.split("/")[1])}<span class="grow"></span>${ok ? `<button type="button" class="pr-setup ok" data-setup="${esc(repo)}" title="${esc(r.channel)}, asks ${esc(r.reviewers.join(", "))}">${ic("check")}set up</button>` : `<button type="button" class="pr-setup" data-setup="${esc(repo)}">${ic("circle-alert")}not set up</button>`}</h2>${open ? `<form class="repo-setup" data-repo="${esc(repo)}"><label><span>Slack channel</span><input name="channel" value="${esc(r.channel || "")}" placeholder="#video-client-developers"></label><label><span>Reviewers to ask</span><input name="reviewers" value="${esc((r.reviewers || []).join(", "))}" placeholder="GitHub logins, comma separated"></label><label><span>Counts as approval</span><input name="approvers" value="${esc((r.approvers || []).join(", "))}" placeholder="GitHub logins; empty means any approval"></label><label class="repo-qa"><input type="checkbox" name="qa" ${r.qa ? "checked" : ""}> QA signs off after approval</label><label class="repo-list"><span>Ship checklist</span><textarea name="checklist" rows="5" placeholder="One step per line. Add | and an instruction to give the step a Do it button that tells the session what to do:\nRan auto fix | Run vdc-autofix on this ticket\nACs written | Write the acceptance criteria with the jira-vdc skill\nclaude-pr-loop run on the PR\nAsked reviewers in Slack and on GitHub\nQA steps added | Add the QA test steps to the ticket">${esc((r.checklist || []).join("\n"))}</textarea></label><label class="repo-list"><span>Ticket moves</span><textarea name="ticketSteps" rows="3" placeholder="When the PR reaches a step, move the ticket. One per line, like:\nReview asked = Code Review\nQA = Ready for QA">${esc(Object.entries(r.ticketSteps || {}).map(([k, v]) => `${k} = ${v}`).join("\n"))}</textarea></label><div class="rc-acts"><button class="btn tiny" type="submit">Save</button><button class="btn tiny" type="button" data-cancel="1">Cancel</button></div></form>` : ""}<ul class="pr-list">${rows.map(p => prRow(p)).join("")}</ul></section>`; }).join("") : `<p class="quiet">Nothing here.</p>`);
  el.querySelectorAll("[data-setup]").forEach(b => b.onclick = () => { repoSetupOpen = repoSetupOpen === b.dataset.setup ? null : b.dataset.setup; renderPrs(); });
  el.querySelectorAll(".repo-setup").forEach(f => { f.querySelector("[data-cancel]").onclick = () => { repoSetupOpen = null; renderPrs(); }; f.onsubmit = (e) => { e.preventDefault(); fetch("/api/repo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repo: f.dataset.repo, channel: f.channel.value, reviewers: f.reviewers.value, approvers: f.approvers.value, qa: f.qa.checked, checklist: f.checklist.value, ticketSteps: f.ticketSteps.value }) }); repoSetupOpen = null; }; });
  for (const b of el.querySelectorAll(".pr-filter [data-f]")) b.onclick = () => { prFilter = b.dataset.f; renderPrs(); };
  for (const b of el.querySelectorAll(".pr-filter [data-pf]")) b.onclick = () => { prPrioFilter = prPrioFilter === +b.dataset.pf ? 0 : +b.dataset.pf; renderPrs(); };
  for (const li of el.querySelectorAll(".pr-row")) { const key = li.dataset.key; const p = prList.find(x => x.key === key); const toggle = () => { prOpen.has(key) ? prOpen.delete(key) : prOpen.add(key); renderPrs(); };
    li.querySelector(".lg-plus").onclick = toggle; li.querySelector(".pr-title").onclick = toggle;
    li.querySelector('[data-a="review"]')?.addEventListener("click", (e) => act("/api/pr/review", null, e.target, { key }));
    li.querySelectorAll('[data-prprio]').forEach(b => b.onclick = () => fetch("/api/pr/prio", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, prio: +b.dataset.prprio }) }));
    li.querySelector('[data-a="keep"]')?.addEventListener("click", () => fetch("/api/pr/keep-waiting", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key }) }));
    li.querySelector('[data-a="watch"]')?.addEventListener("click", () => fetch("/api/pr/watch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, on: !p.watched }) }));
    li.querySelector('[data-a="channel"]')?.addEventListener("click", async () => { const v = prompt(`Which Slack channel for ${p.repo.split("/")[1]}? (like #docs-eng)`, prRepos[p.repo]?.channel || "#"); if (!v || v === "#") return; await fetch("/api/pr/channel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repo: p.repo, channel: v.trim() }) }); });
    li.querySelector('[data-a="ask"]')?.addEventListener("click", async (e) => { const text = li.querySelector(".pr-msg")?.value?.trim(); if (!text) return; act("/api/pr/ask", null, e.target, { key, text }); });
    li.querySelector('[data-a="setup"]')?.addEventListener("click", () => { repoSetupOpen = p.repo; renderPrs(); });
    li.querySelector('[data-a="nudge"]')?.addEventListener("click", (e) => act("/api/pr/slack", null, e.target, { key, kind: "nudge" }));
    li.querySelector('[data-a="start"]')?.addEventListener("click", () => { location.hash = ""; show("home"); $("#ns-cwd").value = guessCwd(p); $("#ns-prompt").value = `Pick up ${p.short}: ${p.url}\nCheck out its branch first.`; $("#ns-prompt").focus(); }); }
  icons();
}
function guessCwd(p) { const name = p.repo.split("/")[1]; const hit = list.find(x => x.cwd.split("/").pop() === name); return hit ? hit.cwd : `~/code/${name}`; }
function prRow(p) {
  const open = prOpen.has(p.key); const ch = prRepos[p.repo]?.channel; const dayOld = p.slack?.askedAt && Date.now() - p.slack.askedAt > 24 * 3600e3 && !p.reviewers?.length;
  const checks = (p.checks || []).filter(c => c.ok === false).map(c => esc(c.name)); const people = (p.reviewers || []).filter(r => r.state === "APPROVED" || r.state === "CHANGES_REQUESTED").map(r => `${esc(r.login)} ${r.state === "APPROVED" ? "approved" : "asked for changes"}`);
  const ship = shipList(p);
  const facts = [p.step ? `Step ${p.step.n} of ${p.step.of}: ${p.step.name}` : "", p.reason, checks.length ? `Failed: ${checks.join(", ")}` : "", people.join(", "), p.claudeVerdict ? `Claude ${p.claudeVerdict === "approve" ? "approved" : "asked for changes"} ${ago(Date.now() - p.claudeAt)} ago` : "", p.slack?.askedAt ? `Asked in ${esc(p.slack.channel)} ${ago(Date.now() - p.slack.askedAt)} ago${p.slack.nudgedAt ? `, nudged ${ago(Date.now() - p.slack.nudgedAt)} ago` : ""}` : "", p.requested?.length ? `GitHub is waiting on ${p.requested.map(esc).join(", ")}` : "", ...(p.ticketMoves || []).slice(-1).map(m => `Ticket ${m.result === "moved" ? "moved to" : m.result === "moving" ? "moving to" : "not moved to"} ${esc(m.to)}${m.result !== "moved" && m.result !== "moving" ? `: ${esc(m.result)}` : ""}`), p.ticket ? `${p.ticket.key}: ${esc(p.ticket.status)}${p.ticket.assignee ? `, ${esc(p.ticket.assignee)}` : ""}. <a href="${esc(p.ticket.url)}" target="_blank" rel="noopener">Open the ticket</a>` : p.tickets.length ? `${p.tickets.join(", ")}: ticket status needs Jira` : ""].filter(Boolean);
  const session = p.sessionId ? `<a class="btn tiny" href="#s/${p.sessionId}">Open its session</a>` : `<button class="btn tiny" data-a="start">Start a session on this</button>`;
  const watch = `<button class="btn tiny" data-a="watch">${p.watched ? "Stop waiting on this" : "Wait on this"}</button>${p.alert ? `<button class="btn tiny" data-a="keep">Keep waiting</button>` : ""}<span class="prio">${[1, 2, 3].map(n => `<button type="button" class="prio-b${prPrio(p) === n ? " on" : ""} p${n}" data-prprio="${n}">${PRIO[n]}</button>`).join("")}</span>`;
  const review = p.state === "claude-reviewing" ? `<span class="pr-running">Claude is reviewing, a few minutes</span>` : `<button class="btn tiny" data-a="review">Run Claude review</button>`;
  const rcfg = prRepos[p.repo] || {}; const setUp = !!(rcfg.channel && rcfg.reviewers?.length);
  const slack = !setUp ? `<p class="hint">Asking for review needs this repo set up: a Slack channel and reviewers. <button type="button" class="link" data-a="setup">Set it up</button></p>` : p.slack?.askedAt ? `${dayOld ? `<button class="btn tiny" data-a="nudge">Nudge the thread</button>` : ""}${p.slack.permalink ? `<a class="btn tiny" href="${esc(p.slack.permalink)}" target="_blank" rel="noopener">Open the thread</a>` : ""}` : `<div class="pr-ask"><textarea class="pr-msg" rows="2">Review request: ${esc(p.title)} ${esc(p.url)}</textarea><button class="btn tiny" data-a="ask">Ask for review: ${esc(rcfg.reviewers.join(", "))} on GitHub, and ${esc(rcfg.channel)}</button></div>`;
  return `<li class="pr-row ${open ? "open" : ""} st-${p.state}" data-key="${esc(p.key)}"><span class="pr-mark" title="${PR_WORD[p.state]}">${ic(PR_ICON[p.state] || "circle")}</span><p class="pr-title">${esc(p.title)}</p><span class="pr-short">${p.shelved ? esc(p.short) : "#" + p.number}${p.tickets.map(t => `<span class="pr-ticket">${esc(t)}${p.ticket?.key === t && p.ticket.status ? ` <em>${esc(p.ticket.status)}</em>` : ""}</span>`).join("")}</span><span class="pr-state s-${p.state}">${p.mismatch ? `<span class="pr-mismatch">${esc(p.mismatch)}</span>` : ""}${p.watched ? `<span class="pr-watch" title="You are waiting on this one">${ic("eye")}</span>` : ""}${prPrio(p) !== 2 ? `<span class="pr-prio p${prPrio(p)}">${PRIO[prPrio(p)]}</span>` : ""}${p.step ? `<span class="pr-step" title="${esc(p.step.name)}">${p.step.n}/${p.step.of} ${esc(p.step.name)}</span>` : ""}${NEEDS_PR.includes(p.state) || p.alert ? `<span class="pr-word">${PR_WORD[p.state]}</span>` : ""}</span><button class="lg-plus" type="button" aria-label="More"><span></span></button>${open ? `<div class="pr-more"><ul class="pr-facts">${facts.map(f => `<li>${f}</li>`).join("")}</ul>${ship}<div class="rc-acts">${session}${watch}${review}<a class="btn tiny" href="${esc(p.url)}" target="_blank" rel="noopener">Open on GitHub</a></div>${slack}</div>` : ""}</li>`;
}
// ---------- the ledger: what got done, day by day ----------
let ledgerRows = [], ledgerSums = {};
function dayLabel(t) { const d = new Date(t), now = new Date(); const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); const diff = Math.round((day(now) - day(d)) / 864e5);
  if (diff === 0) return "Today"; if (diff === 1) return "Yesterday"; return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }); }
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const clock = (t) => new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
let ledgerFilter = { kind: "all", day: "" };
function renderLedger() {
  const now = $("#ledger-now"); const working = list.filter(x => !isDismissed(x) && (x.state === "working" || x.needsYou));
  now.innerHTML = working.length ? `<section class="lg-now"><h2 class="lg-h">In hand</h2><ul class="lg-list lg-hand">${working.map(x => `<li><a href="${x.managed ? "#s/" : "#t/"}${x.sessionId}">${esc(x.title)}</a><span class="lg-state">${STATE[x.state].word}</span></li>`).join("")}</ul></section>` : "";
  for (const b of $$("#ledger-filter [data-f]")) b.setAttribute("aria-pressed", String(ledgerFilter.kind === b.dataset.f));
  const days = $("#ledger-days"); let rows = [...ledgerRows].sort((a, b) => b.at - a.at);
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (ledgerFilter.kind === "today") rows = rows.filter(r => startOf(new Date(r.at)) === startOf(new Date()));
  if (ledgerFilter.kind === "week") rows = rows.filter(r => r.at > startOf(new Date()) - 6 * 864e5);
  if (ledgerFilter.kind === "day" && ledgerFilter.day) { const [y, m, d] = ledgerFilter.day.split("-").map(Number); const t0 = new Date(y, m - 1, d).getTime(); rows = rows.filter(r => r.at >= t0 && r.at < t0 + 864e5); }
  if (!rows.length) { days.innerHTML = `<p class="quiet">${ledgerRows.length ? "Nothing on that day." : "Nothing in the ledger yet. Each reply that opens with Done lands here."}</p>`; icons(); return; }
  // one line per session per day, newest first: a headline, the way back, and the points behind a plus
  const groups = new Map(); for (const r of rows) { const k = `${r.sessionId}|${dayKey(r.at)}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  const lgRow = ([k, rs]) => { const sid = rs[0].sessionId;
    const s = ledgerSums[k]; const latest = rs[0]; const partly = rs.every(r => r.status === "partly");
    const headline = s ? s.headline : (latest.lines[0] || latest.title); const points = s ? s.points : [...new Set(rs.flatMap(r => r.lines))]; const next = latest.next;
    return `<li class="lg-row ${partly ? "partly" : "done"}" data-sid="${sid}"><span class="lg-dot" aria-hidden="true"></span><div class="lg-main"><p class="lg-first">${renderInline(headline)}${s ? "" : `<span class="lg-wait" title="A shorter headline is on its way">…</span>`}</p><div class="lg-rest" hidden>${points.map(p => `<p>${renderInline(p)}</p>`).join("")}${next ? `<p class="lg-next">Next: ${renderInline(next)}</p>` : ""}</div></div><span class="lg-side"><a class="lg-go" href="#s/${sid}" title="Open the session">${ic("arrow-up-right")}</a><button class="lg-plus" type="button" aria-label="More"><span></span></button></span></li>`; };
  // by project: the session's project, or the ledger row's own title and ticket
  const projOfRow = (rs) => { const sid = rs[0].sessionId; const sess = list.find(x => x.sessionId === sid); if (sess) { const p = projectOf(sess); if (p) return p; } const fake = { sessionId: sid, title: rs[0].title, prompt: "", cwd: "" }; return projectOf(fake); };
  const byProj = new Map(); for (const g of groups) { const p = projOfRow(g[1]); const k = p ? p.id : ""; if (!byProj.has(k)) byProj.set(k, []); byProj.get(k).push(g); }
  const order = [...projects.map(p => p.id).filter(id => byProj.has(id)), ...(byProj.has("") ? [""] : [])];
  days.innerHTML = order.map(id => { const p = projects.find(x => x.id === id); return `<section class="lg-proj"><h2 class="lg-h">${p ? esc(p.name) : "No project"}</h2><ul class="lg-list">${byProj.get(id).map(lgRow).join("")}</ul></section>`; }).join("");
  for (const li of days.querySelectorAll(".lg-row")) { const open = () => { const on = li.classList.toggle("open"); li.querySelector(".lg-rest").hidden = !on; }; li.querySelector(".lg-plus").onclick = open; li.querySelector(".lg-first").onclick = open; }
  icons();
}
for (const b of $$("#ledger-filter [data-f]")) b.onclick = () => { ledgerFilter = { kind: b.dataset.f, day: "" }; $("#ledger-date").value = ""; renderLedger(); };
$("#ledger-date").onchange = () => { ledgerFilter = $("#ledger-date").value ? { kind: "day", day: $("#ledger-date").value } : { kind: "all", day: "" }; renderLedger(); };
function renderInline(t) { try { return marked.parseInline(t); } catch { return esc(t); } }
// ---------- terminal session detail ----------
function renderTerm() {
  const x = list.find(s => s.sessionId === termId); const el = $("#tsess");
  if (!x) { el.innerHTML = `<p class="quiet">That session is no longer listed.</p>`; return; }
  const st = STATE[x.state]; const note = prefs.notes?.[x.sessionId] || "";
  el.innerHTML = `<div class="card" style="--fc:${st.color}"><div class="meta" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${jar(x.repo, x.sub)}${pill(st)}<span class="where">${ago(Date.now() - x.stateSince)} in this state</span></div><div class="ttl" id="t-title" style="font-size:15px;cursor:text" title="Click to rename">${esc(x.title)}</div>${x.last ? `<div class="line" style="color:var(--text-secondary)">${esc(x.last)}</div>` : ""}<div class="acts" style="display:flex;gap:8px;flex-wrap:wrap">${!x.live ? `<button class="btn primary" data-a="here">Open here</button><button class="btn soft" data-a="resume">Resume in Terminal</button>` : `<button class="btn primary" data-a="resume">Resume in Terminal</button>`}<button class="btn ghost" data-a="reveal">Show folder</button><button class="btn ghost" data-a="copy">Copy command</button></div><div class="path" style="font-family:var(--mono);font-size:11px;color:var(--text-tertiary)">${esc(x.cwd)}</div></div>
  <div class="park"><label for="tnote">Note to self, shown in the sidebar</label><div class="park-row"><input id="tnote" value="${esc(note)}" placeholder="e.g. waiting on CI; check Tuesday"><button class="btn primary" id="tnote-save">Save</button></div></div>
  <p class="hint">This session lives in a terminal or in the background. Stillroom can watch it but not attach to it.</p>`;
  el.querySelector('[data-a="resume"]').onclick = (e) => act("/api/resume", x.sessionId, e.target);
  el.querySelector('[data-a="here"]')?.addEventListener("click", () => send({ type: "resume", sessionId: x.sessionId, cwd: x.cwd }));
  if (x.live) el.querySelector(".card")?.insertAdjacentHTML("beforeend", `<p class="hint">Still open in a terminal. To move it here, quit it there first (type /exit), then come back and press Open here.</p>`);
  el.querySelector('[data-a="reveal"]').onclick = (e) => act("/api/reveal", x.sessionId, e.target);
  el.querySelector('[data-a="copy"]').onclick = (e) => copyCmd(x.resume, e.target);
  icons(); $("#t-title").onclick = () => { const tel = $("#t-title"); editTitle(tel, x.title, (v) => { prefs.titles = { ...(prefs.titles || {}), [x.sessionId]: v }; save(); renderSide(); renderTerm(); }); };
  $("#tnote-save").onclick = () => { prefs.notes = { ...(prefs.notes || {}), [x.sessionId]: $("#tnote").value.trim() }; if (!prefs.notes[x.sessionId]) delete prefs.notes[x.sessionId]; save(); renderSide(); };
  
}

// ---------- websocket ----------
function connect() {
  ws = new WebSocket((location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/ws");
  ws.onopen = () => { wsReady = true; };
  ws.onclose = () => { wsReady = false; setTimeout(connect, 2000); };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.type === "hello") { cwds = m.payload.cwds || []; if (!$("#ns-cwd").value && prefs.lastCwd) $("#ns-cwd").value = prefs.lastCwd; applyList(m.payload.sessions, m.payload.version); }
    if (m.type === "list") applyList(m.payload.sessions, m.payload.version);
    if (m.type === "projects") { projects = (m.payload?.projects || []).slice().sort((a, b) => a.prio - b.prio || a.order - b.order); assign = m.payload?.assign || {}; renderSide(); if (roundsOn) renderRoom(); if (openId) renderSessHead();
      if (!landed) { landed = true; if (!location.hash || location.hash === "#projects" || location.hash === "#rounds") { const top = topRoom(); if (top) location.hash = `#p/${top}`; } } }
    if (m.type === "waits") { waitList = m.payload || []; renderSide(); if (roundsOn) renderRoom(); }
    if (m.type === "prs") { prList = m.payload?.prs || []; prRepos = m.payload?.repos || {}; prJira = m.payload?.jira || {}; $("#prs-n").textContent = String(prList.filter(p => p.needsYou).length || ""); if (!$("#prs").hidden) renderPrs(); renderSide(); if (roundsOn) renderRoom(); }
    if (m.type === "ledger") { ledgerRows = m.payload?.entries || []; ledgerSums = m.payload?.summaries || {}; if (!$("#ledger").hidden) renderLedger(); }
    if (m.type === "started") { pendingStarts.push(m.payload.tempId); if (m.payload.quiet) { const u = $("#undo"); $("#undo-text").textContent = "Started. It's under In flight."; if (roundsOn) setTimeout(renderRoom, 300); u.hidden = false; setTimeout(() => { u.hidden = true; }, 6000); } else openSession(m.payload.tempId); }
    if (m.type === "start-failed") { const e = $("#error"); e.hidden = false; e.textContent = m.payload; $("#ns-cwd").focus(); setTimeout(() => { e.hidden = true; }, 8000); }
    if (m.type === "meta") { const mm = m.payload; if (openId === m.sessionId || (openId && openId.startsWith("pending-") && pendingStarts.includes(openId))) { if (openId !== mm.sessionId) { openId = mm.sessionId; location.hash = "s/" + mm.sessionId; send({ type: "open", sessionId: mm.sessionId }); } meta = mm; renderSessHead(); renderPending(); } }
    if (m.type === "event" && m.sessionId === openId) { const ev = m.payload; const i = ev.kind === "tool" ? transcript.findIndex(x => x.kind === "tool" && x.id === ev.id) : -1; if (i >= 0) transcript[i] = ev; else transcript.push(ev); renderTranscript(); }
    if (m.type === "transcript" && m.sessionId === openId) { meta = m.payload.meta; transcript = m.payload.events; renderSessHead(); renderTranscript(); renderPending(); }
    if (m.type === "error") { $("#error").hidden = false; $("#error").textContent = m.payload; }
  };
}
function withTitles(rows) { return (rows || []).map(x => (!x.managed && prefs.titles?.[x.sessionId]) ? { ...x, title: prefs.titles[x.sessionId] } : x); }
function applyList(sessions, version) { // the sidebar is navigation and always updates; the home card holds still while you read
  list = withTitles(sessions); listVersion = version ?? listVersion; renderSide();
  if (termId) renderTerm(); if (!$("#ledger").hidden) renderLedger(); if (roundsOn) renderRoom();
  if (!openId && !termId && !roundsOn) { if (document.hasFocus() && shownVersion >= 0 && listVersion !== shownVersion) $("#stale").hidden = false; else { renderNext(); shownVersion = listVersion; $("#stale").hidden = true; } }
}
async function refresh() { const d = await fetchState(); $("#error").hidden = !d.error && !d.pollError; $("#error").textContent = d.error || (d.pollError ? `Could not read sessions: ${d.pollError}` : ""); if (d.error) return; list = withTitles(d.sessions); listVersion = d.version; renderSide(); if (!openId && !termId && !roundsOn) { renderNext(); shownVersion = listVersion; $("#stale").hidden = true; } if (termId) renderTerm(); }

// ---------- routing ----------
function show(which) { $("#home").hidden = which !== "home"; $("#tsess").hidden = which !== "term"; $("#sess").hidden = which !== "sess"; $("#rounds").hidden = which !== "rounds"; $("#ledger").hidden = which !== "ledger"; $("#side-ledger").setAttribute("aria-current", String(which === "ledger")); $("#prs").hidden = which !== "prs"; $("#side-prs").setAttribute("aria-current", String(which === "prs")); $("#projects").hidden = true; roundsOn = which === "rounds"; document.body.classList.toggle("in-rounds", roundsOn); $("#side-rounds").setAttribute("aria-current", String(roundsOn)); if (which !== "sess") { openId = null; meta = null; transcript = []; } if (which !== "term") termId = null; }
function openSession(id) { termId = null; openId = id; transcript = []; meta = null; location.hash = "s/" + id; show("sess"); $("#transcript").innerHTML = ""; $("#pending").hidden = true; $("#park").hidden = true; send({ type: "open", sessionId: id }); renderSide(); setTimeout(() => $("#reply").focus(), 50); }
function route() { const s = location.hash.match(/^#s\/(.+)$/), t = location.hash.match(/^#t\/(.+)$/);
  if (s) { if (openId !== s[1]) openSession(s[1]); return; }
  if (t) { show("term"); termId = t[1]; renderTerm(); renderSide(); return; }
  const pr = location.hash.match(/^#p\/(.+)$/); if (pr) { show("rounds"); sentCards.clear(); openRound = null; projNewOpen = false; renderRoom(); renderSide(); return; }
  if (location.hash === "#projects" || location.hash === "#rounds") { const top = topRoom(); location.hash = top ? `#p/${top}` : ""; return; }
  if (location.hash === "#prs") { show("prs"); renderPrs(); renderSide(); return; }
  if (location.hash === "#ledger") { show("ledger"); renderLedger(); renderSide(); return; }
  show("home"); refresh(); }
function topRoom() { const rooms = roomItems(); const on = projects.filter(p => p.on && !mutedRoom(p.id)).sort((x, y) => x.prio - y.prio || x.order - y.order); const withNeeds = on.find(p => rooms.get(p.id).some(needsIt)); if (withNeeds) return withNeeds.id; if (!mutedRoom("none") && (rooms.get("none") || []).some(needsIt)) return "none"; return on[0]?.id || null; }
window.addEventListener("hashchange", route);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && !openId) refresh(); });
window.addEventListener("focus", () => { if (!openId) refresh(); });
document.addEventListener("keydown", (e) => { if (e.target.matches("input,select,textarea")) return; if (e.key === "r" || e.key === "R") { e.preventDefault(); refresh(); } if (e.key === "Escape") closeMenu(); });

// ---------- new session ----------
$("#newsess").onsubmit = (e) => { e.preventDefault(); const cwd = resolveCwd($("#ns-cwd").value), prompt = withFiles($("#ns-prompt"), $("#ns-prompt").value.trim()); if (!cwd || !prompt) { (cwd ? $("#ns-prompt") : $("#ns-cwd")).focus(); return; } prefs.lastCwd = tilde(cwd); save(); send({ type: "start", cwd, prompt }); $("#ns-prompt").value = ""; };
$("#ns-prompt").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#newsess").requestSubmit(); } });
const cwdIn = $("#ns-cwd"), cwdList = $("#cwd-list"); let cwdSel = 0, cwdMatches = [], homeDir = "";
const tilde = (p) => homeDir && p.startsWith(homeDir) ? "~" + p.slice(homeDir.length) : p;
function resolveCwd(v) { v = v.trim(); if (!v) return ""; if (v.startsWith("~")) v = v.replace(/^~/, homeDir || "~"); return v.replace(/\/+$/, "") || "/"; }
let cwdReq = 0;
async function showCwdList() { const q = cwdIn.value; const my = ++cwdReq; let dirs = [];
  try { const r = await (await fetch("/api/dirs?q=" + encodeURIComponent(q || "~/"))).json(); if (my !== cwdReq) return; dirs = r.dirs; homeDir = r.home; } catch {}
  cwdMatches = dirs; cwdSel = 0; cwdList.hidden = !cwdMatches.length; cwdIn.setAttribute("aria-expanded", String(!cwdList.hidden));
  cwdList.innerHTML = cwdMatches.map((c, i) => `<li role="option" aria-selected="${i === cwdSel}" data-c="${esc(c)}">${esc(c.split("/").pop())}<small>${esc(tilde(c.replace(/\/[^/]+$/, "")))}</small></li>`).join(""); }
function completeTo(c, andGo) { cwdIn.value = tilde(c) + (andGo ? "" : "/"); if (andGo) { cwdList.hidden = true; cwdIn.setAttribute("aria-expanded", "false"); $("#ns-prompt").focus(); } else showCwdList(); }
cwdIn.addEventListener("input", showCwdList); cwdIn.addEventListener("focus", showCwdList);
cwdIn.addEventListener("blur", () => setTimeout(() => { cwdList.hidden = true; }, 120));
cwdIn.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { if (!cwdMatches.length) return; e.preventDefault(); cwdSel = (cwdSel + (e.key === "ArrowDown" ? 1 : -1) + cwdMatches.length) % cwdMatches.length; [...cwdList.children].forEach((li, i) => li.setAttribute("aria-selected", String(i === cwdSel))); }
  else if (e.key === "Tab" && cwdMatches.length && !cwdList.hidden) { e.preventDefault(); // like a shell: one match completes it, several complete the common prefix
    if (cwdMatches.length === 1) completeTo(cwdMatches[0], false); else { let p = cwdMatches[0]; for (const m of cwdMatches) { let i = 0; while (i < p.length && i < m.length && p[i].toLowerCase() === m[i].toLowerCase()) i++; p = p.slice(0, i); } const cur = resolveCwd(cwdIn.value); if (p.length > cur.length + 1) { cwdIn.value = tilde(p); showCwdList(); } else completeTo(cwdMatches[cwdSel], false); } }
  else if (e.key === "Enter") { e.preventDefault(); const typed = resolveCwd(cwdIn.value); const exact = cwdMatches.find(c => c === typed); if (cwdMatches.length && !cwdList.hidden && !exact && cwdIn.value.endsWith("/") === false && cwdMatches.length === 1) completeTo(cwdMatches[0], true); else if (typed) { cwdIn.value = tilde(typed); cwdList.hidden = true; $("#ns-prompt").focus(); } }
  else if (e.key === "Escape") cwdList.hidden = true;
});
cwdList.addEventListener("mousedown", (e) => { const li = e.target.closest("li"); if (li) { e.preventDefault(); completeTo(li.dataset.c, true); } });

// ---------- session view ----------
const MSTATE = { starting: "working", working: "working", waiting: "needs-permission", idle: "finished", failed: "failed", ended: "idle" };
function soFarHtml(x) { const kids = list.filter(s => s.parent === x.sessionId); if (!x.abstract && !kids.length) return "";
  let j = null; try { const m = String(x.abstract || "").match(/\{[\s\S]*\}/); j = m ? JSON.parse(m[0]) : null; } catch {}
  const item = (cls, icon, it) => `<li class="sf ${cls}">${ic(icon)}<span class="sf-line">${esc(it.line)}${it.more ? `<button type="button" class="sf-more" aria-label="More">+</button><span class="sf-detail" hidden>${esc(it.more)}</span>` : ""}</span></li>`;
  const body = j ? `<ul class="sf-list">${j.started ? item("start", "flag", { line: j.started }) : ""}${(j.found || []).map(it => item("found", "search", it)).join("")}${(j.done || []).map(it => item("done", "circle-check", it)).join("")}${(j.open || []).map(it => item("open", "circle-dashed", it)).join("")}${j.next ? item("next", "corner-down-right", { line: j.next }) : ""}</ul>` : `<p>${esc(x.abstract || "Nothing written yet. It fills in after the next turn.")}</p>`;
  return `<details class="sofar"${prefs.sofarOpen ? " open" : ""}><summary><svg class="chev" width="11" height="11"><use href="#i-chev"/></svg>So far</summary>${body}${kids.length ? `<p class="sofar-kids">Started from here: ${kids.map(k => `<a href="#s/${k.sessionId}">${esc(k.title)}</a>`).join(", ")}</p>` : ""}${shipHtml(x)}</details>`; }
// every outside link opens in a Chrome window, not inside this app window
document.addEventListener("click", (e) => { const l = e.target.closest?.('a[target="_blank"]'); if (!l || !/^https?:/.test(l.href)) return; e.preventDefault(); fetch("/api/open", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: l.href }) }).catch(() => window.open(l.href, "_blank")); }, true);
document.addEventListener("click", (e) => { const b = e.target.closest?.(".sf-more"); if (!b) return; e.preventDefault(); const d = b.nextElementSibling; d.hidden = !d.hidden; b.textContent = d.hidden ? "+" : "−"; });
function shipList(pr) { if (!pr?.checklist?.length) return ""; const left = pr.checklist.filter(c => !c.done && !c.skip).length; const moves = (pr.ticketMoves || []).slice(-2);
  return `<div class="ship"><h4 class="lg-h">Ship checklist, ${esc(pr.short)}${left ? ` <span class="lg-n">${left} left</span>` : ` <span class="lg-n">all done</span>`}</h4><ul class="ship-list">${pr.checklist.map(c => `<li class="${c.done ? "done" : ""}${c.skip ? " skip" : ""}"><label><input type="checkbox" data-check="${esc(pr.key)}" data-item="${esc(c.item)}" ${c.done ? "checked" : ""} ${c.skip ? "disabled" : ""}><span class="box">${ic("check")}</span> ${esc(c.item)}${c.auto && c.done ? ` <span class="lg-n">seen</span>` : ""}${c.skip ? ` <span class="lg-n">does not apply: ${esc(c.skip)}</span>` : ""}</label>${!c.done && !c.skip ? (c.action === "review" ? `<button class="btn tiny" data-do="${esc(pr.key)}" data-item="${esc(c.item)}">Run Claude review</button>` : c.action === "ask" ? `<a class="btn tiny" href="#prs" data-prgo="${esc(pr.key)}">Ask for review</a>` : c.action === "send" ? `<button class="btn tiny" data-do="${esc(pr.key)}" data-item="${esc(c.item)}" title="${esc(c.instruction)}">Do it</button>` : "") + `<button class="iconbtn" data-skip="${esc(pr.key)}" data-item="${esc(c.item)}" title="Does not apply">${ic("minus")}</button>` : c.skip ? `<button class="iconbtn" data-unskip="${esc(pr.key)}" data-item="${esc(c.item)}" title="It does apply after all">${ic("undo-2")}</button>` : ""}</li>`).join("")}</ul>${moves.length ? `<p class="hint">${moves.map(m => `${esc(m.to)}: ${m.result === "moved" ? "ticket moved" : m.result === "moving" ? "moving the ticket" : esc(m.result)}`).join(". ")}.</p>` : ""}</div>`; }
function shipHtml(x) { const pr = prList.find(p => p.sessionId === x.sessionId); return shipList(pr); }
document.addEventListener("click", (e) => { const d = e.target.closest?.("[data-do]"); if (d) { e.preventDefault(); act("/api/pr/do", null, d, { key: d.dataset.do, item: d.dataset.item }); return; }
  const s = e.target.closest?.("[data-skip]"); if (s) { e.preventDefault(); const why = prompt("Why does this step not apply here?", "does not apply"); if (why === null) return; fetch("/api/pr/skip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: s.dataset.skip, item: s.dataset.item, why: why.trim() || "does not apply" }) }); return; }
  const u = e.target.closest?.("[data-unskip]"); if (u) { e.preventDefault(); fetch("/api/pr/skip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: u.dataset.unskip, item: u.dataset.item, why: "" }) }); return; }
  const g = e.target.closest?.("[data-prgo]"); if (g) { prOpen.add(g.dataset.prgo); setTimeout(() => document.querySelector(`.pr-row[data-key="${CSS.escape(g.dataset.prgo)}"]`)?.scrollIntoView({ block: "center" }), 80); } });
document.addEventListener("change", (e) => { const c = e.target.closest?.("[data-check]"); if (!c) return; fetch("/api/pr/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: c.dataset.check, item: c.dataset.item, on: c.checked }) }); });
document.addEventListener("toggle", (e) => { if (e.target.classList?.contains("sofar")) { prefs.sofarOpen = e.target.open; save(); } }, true);
function renderSessHead() { $("#sess-star")?.classList.toggle("on", (prefs.stars || {})[openId] != null);
  { const me = list.find(s => s.sessionId === openId); const sf = $("#sess-sofar"); if (sf) sf.innerHTML = me ? soFarHtml(me) : ""; }
  { const me = list.find(s => s.sessionId === openId); const wl = $("#sess-wt"); if (wl) { wl.hidden = !me?.worktree; if (me?.worktree) wl.textContent = `On branch ${me.worktree.branch}, in its own worktree`; } }
  { const me = list.find(s => s.sessionId === openId); const p = me ? projectOf(me) : null; const b = $("#sess-back"); if (b) { b.hidden = false; b.href = p ? `#p/${p.id}` : "#p/none"; b.querySelector("span").textContent = `Back to ${p ? p.name : "No project"}`; } }
  const pe = $("#sess-proj"); if (pe) { const me = list.find(s => s.sessionId === openId); const cur = me ? projectOf(me) : null; pe.innerHTML = `<button type="button" class="proj-link" id="proj-link">Project: ${cur ? esc(cur.name) : "none"}</button><span class="proj-pills" hidden>${projects.map(p => `<button type="button" class="btn tiny" data-pp="${p.id}">${esc(p.name)}</button>`).join("")}<button type="button" class="btn tiny" data-pp="">None</button></span>`;
    pe.querySelector("#proj-link").onclick = () => { const s = pe.querySelector(".proj-pills"); s.hidden = !s.hidden; };
    pe.querySelectorAll("[data-pp]").forEach(b => b.onclick = () => fetch("/api/project", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assign: { item: `s:${openId}`, project: b.dataset.pp || null, key: me ? keyOf(me.title) || undefined : undefined } }) })); } const pc = $("#sess-prio"); if (pc) pc.innerHTML = prioCtl(openId);
  if (!meta) return;
  const repo = meta.cwd.split("/").filter(Boolean).pop() || meta.cwd;
  const j = $("#sess-jar"); j.style.setProperty("--jc", tintOf(repo)); j.querySelector("use").setAttribute("href", shapeOf(repo)); j.querySelector(".shape").setAttribute("fill", "currentColor"); $("#sess-repo").textContent = repo;
  $("#sess-title").textContent = meta.userTitle || (list.find(x => x.sessionId === meta.sessionId)?.title) || meta.title;
  const key = meta.status === "waiting" && meta.pending?.kind === "question" ? "needs-answer" : MSTATE[meta.status]; const st = STATE[key];
  const p = $("#sess-pill"); p.style.setProperty("--pc", st.color); p.querySelector("i, svg").outerHTML = ic(st.icon); p.querySelector(".pill-t").textContent = meta.status === "starting" ? "Starting" : st.word; icons();
  $("#sess-stop").disabled = meta.status !== "working"; $("#show-steps").checked = !!prefs.showSteps; renderStatus();
  $("#park-note").value = meta.note || ""; $("#sess-park").querySelector("span").textContent = meta.note ? "Note saved" : "Leave a note";
  
}
// click the title to rename it
function editTitle(el, current, onSave) { const inp = document.createElement("input"); inp.className = "title-edit"; inp.value = current; el.replaceWith(inp); inp.focus(); inp.select();
  const done = (save) => { const v = inp.value.trim(); inp.replaceWith(el); if (save && v !== current) onSave(v); };
  inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); done(true); } if (e.key === "Escape") { e.preventDefault(); done(false); } }); inp.addEventListener("blur", () => done(true)); }
$("#sess-title").onclick = () => { const el = $("#sess-title"); editTitle(el, el.textContent, (v) => { el.textContent = v; send({ type: "title", sessionId: openId, title: v }); }); };
$("#sess-title").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#sess-title").click(); });
$("#show-steps").onchange = (e) => { prefs.showSteps = e.target.checked; save(); $("#transcript").classList.toggle("no-steps", !prefs.showSteps); };
$("#sess-stop").onclick = () => send({ type: "interrupt", sessionId: openId });
function unpin(id) { if ((prefs.stars || {})[id] == null) return; const s = { ...prefs.stars }; delete s[id]; prefs.stars = s; save(); }
function closeWithUndo(x) { // no dialog: it closes, and one line offers Undo; a closed session is no longer pinned
  send({ type: "end", sessionId: x.sessionId }); unpin(x.sessionId); const u = $("#undo"); const pr = prList.find(p => p.sessionId === x.sessionId);
  $("#undo-text").textContent = pr ? `Closed. ${pr.short} is waiting on others. It comes back under Needs you when someone acts.` : `Closed "${x.title.slice(0, 40)}". It stays on disk.`; u.hidden = false;
  $("#undo-btn").onclick = () => { send({ type: "resume", sessionId: x.sessionId, cwd: x.cwd }); u.hidden = true; }; setTimeout(() => { u.hidden = true; }, 12000); }
$("#sess-end").onclick = () => { const x = list.find(s => s.sessionId === openId) || { sessionId: openId, title: meta?.title || "", cwd: meta?.cwd }; closeWithUndo(x); location.hash = ""; };
$("#sess-star").onclick = () => { if (openId) toggleStar(openId); };
$("#sess-more").onclick = () => { const m = $("#sess-ctl-more"); m.hidden = !m.hidden; $("#sess-more").textContent = m.hidden ? "More" : "Less"; };
$("#wait-form").onsubmit = (e) => { e.preventDefault(); const inp = e.target.querySelector("input"); const t = inp.value.trim(); if (!t) return; fetch("/api/wait", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: t, sessionId: openId || undefined }) }).then(() => { inp.value = ""; $("#wait-form").hidden = true; const u = $("#undo"); $("#undo-text").textContent = `On the Waiting list: "${t.slice(0, 60)}". It comes back under Needs you.`; u.hidden = false; setTimeout(() => { u.hidden = true; }, 6000); }); };
$("#sess-wait").onclick = () => { const f = $("#wait-form"); f.hidden = !f.hidden; if (f.hidden) return; const inp = f.querySelector("input"); const pr = prList.find(p => p.sessionId === openId); const t = list.find(s => s.sessionId === openId)?.title || ""; const key = (t.match(/^([A-Z]+-\d+)/) || [])[1]; inp.value = pr ? `${pr.short} to merge ${pr.url}` : key ? `${key} to move to ` : ""; inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); };
$("#sess-branch").onclick = () => { // a new session in the same folder; the first line says where it came from
  const from = list.find(s => s.sessionId === openId); const cwd = from?.cwd || meta?.cwd || ""; const title = from?.title || meta?.title || "";
  location.hash = ""; show("home"); $("#ns-cwd").value = tilde(cwd); $("#ns-prompt").value = `Follows on from "${title}" (session ${openId}, transcript in ~/.claude/projects). \n\n`; $("#ns-prompt").focus(); $("#ns-prompt").setSelectionRange($("#ns-prompt").value.length, $("#ns-prompt").value.length); };
$("#sess-park").onclick = () => { $("#park").hidden = !$("#park").hidden; if (!$("#park").hidden) $("#park-note").focus(); };
$("#park-save").onclick = () => { send({ type: "note", sessionId: openId, note: $("#park-note").value }); $("#park").hidden = true; };
$("#park-clear").onclick = () => { $("#park-note").value = ""; send({ type: "note", sessionId: openId, note: "" }); $("#park").hidden = true; };
$("#park-note").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("#park-save").click(); } });

// Claude's reply as a document. A line of --- splits the answer from the details, per the writing rules in CLAUDE.md.
const mdOpts = { gfm: true, breaks: false };
function renderMd(t) { try { const html = marked.parse(t.replace(/<\/?(script|style|iframe)[^>]*>/gi, ""), mdOpts); return html; } catch { return `<p>${esc(t)}</p>`; } }
// ---------- files in the box: drop or paste, they save to disk and the message names their paths ----------
const attachments = new WeakMap(); // textarea -> [{ name, path }]
function attachBox(ta) { let box = ta.parentElement.querySelector(".attach"); if (!box) { box = document.createElement("div"); box.className = "attach"; box.hidden = true; ta.insertAdjacentElement("afterend", box); } return box; }
function renderAttach(ta) { const box = attachBox(ta); const items = attachments.get(ta) || []; box.hidden = !items.length;
  box.innerHTML = items.map((f, i) => `<span class="chip">${ic(/\.(png|jpe?g|gif|webp)$/i.test(f.name) ? "image" : "file")}${esc(f.name)}<button type="button" class="chip-x" data-i="${i}" aria-label="Remove">×</button></span>`).join("");
  box.querySelectorAll(".chip-x").forEach(b => b.onclick = () => { items.splice(+b.dataset.i, 1); renderAttach(ta); }); icons(); }
async function addFiles(ta, files, sid) { const list = [...files].filter(f => f && f.size <= 25 * 1024 * 1024); if (!list.length) return;
  const fd = new FormData(); fd.append("sessionId", sid || "new"); for (const f of list) fd.append("file", f, f.name || "pasted.png");
  ta.classList.add("uploading"); try { const r = await fetch("/api/upload", { method: "POST", body: fd }); const j = await r.json(); const cur = attachments.get(ta) || []; (j.paths || []).forEach((p, i) => cur.push({ name: list[i]?.name || p.split("/").pop(), path: p })); attachments.set(ta, cur); renderAttach(ta); }
  catch { $("#error").hidden = false; $("#error").textContent = "Could not save the file."; } ta.classList.remove("uploading"); }
function withFiles(ta, text) { const items = attachments.get(ta) || []; if (!items.length) return text; const tail = `Attached files (read them as needed):\n${items.map(f => `- ${f.path}`).join("\n")}`; attachments.set(ta, []); renderAttach(ta); return text ? `${text}\n\n${tail}` : tail; }
function acceptFiles(ta, sidFn) { // drag in, or paste an image from the clipboard
  ta.addEventListener("dragover", (e) => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); ta.classList.add("drop"); } });
  ta.addEventListener("dragleave", () => ta.classList.remove("drop"));
  ta.addEventListener("drop", (e) => { if (!e.dataTransfer?.files?.length) return; e.preventDefault(); ta.classList.remove("drop"); addFiles(ta, e.dataTransfer.files, sidFn()); });
  ta.addEventListener("paste", (e) => { const fs = [...(e.clipboardData?.files || [])]; if (!fs.length) return; e.preventDefault(); addFiles(ta, fs, sidFn()); }); }
const STATUS_RE = /^\s*(Done|Partly done|Blocked|Found|Question|Working|Failed|Not done)\b[.:!]?/i;
const REPLY_LINE = /^\s*\**Reply\**\s*:\s*(.+?)\s*$/im;
function suggestReply(text) { // what she would most likely type next, from the reply itself
  if (!text) return ""; const m = text.match(REPLY_LINE); if (m) return m[1].replace(/^["'“”`]+|["'“”`.]+$/g, "").slice(0, 80);
  const say = text.match(/\bsay\s+["“'`]?([A-Za-z][A-Za-z0-9 ,'-]{0,30}?)["”'`]?\s+(?:and|to|if|when)\b/i); if (say) return say[1].trim();
  const pick = text.match(/^\s*\d+\.\s+(.+?)\s*\(my pick\)/im); if (pick) return pick[1].trim();
  return ""; }
const stripReplyLine = (t) => String(t || "").replace(REPLY_LINE, "").replace(/\n{3,}$/, "\n");
function armSuggestion(box, text) { // grey suggestion in the box; Tab takes it
  const s = suggestReply(text); box.dataset.suggest = s; const base = box.dataset.basePlaceholder || (box.dataset.basePlaceholder = box.placeholder);
  box.placeholder = s ? `${s}   (Tab to use this)` : base; box.classList.toggle("has-suggest", !!s); }
document.addEventListener("keydown", (e) => { if (!roundsOn || !(e.metaKey || e.ctrlKey)) return; if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return; e.preventDefault();
  const ids = [...$("#rounds-list").children].map(c => c.dataset.id); if (!ids.length) return; const i = ids.indexOf(openRound); const j = e.key === "ArrowDown" ? (i < 0 ? 0 : Math.min(ids.length - 1, i + 1)) : (i <= 0 ? 0 : i - 1); if (ids[j] === openRound) return;
  openRound = ids[j]; renderRoom(); $("#rounds-list").querySelector(".rc.is-open")?.scrollIntoView({ block: "start" }); $("#rounds-list").querySelector(".rc.is-open textarea")?.focus({ preventScroll: true }); });
document.addEventListener("keydown", (e) => { if (e.key !== "Tab" || e.shiftKey) return; const t = e.target; if (!(t instanceof HTMLTextAreaElement) || t.value || !t.dataset.suggest) return; e.preventDefault(); t.value = t.dataset.suggest; t.setSelectionRange(t.value.length, t.value.length); }, true);
const STATUS_CLASS = { done: "s-done", "partly done": "s-part", blocked: "s-block", found: "s-found", question: "s-ask", working: "s-work", failed: "s-block", "not done": "s-block" };
const STATUS_ICON = { "s-done": "circle-check", "s-part": "circle-dashed", "s-block": "circle-x", "s-found": "search", "s-ask": "circle-help", "s-work": "orbit" };
function docHtml(text, sid) { // sid: when given, numbered choices under a Question line become click-to-answer
  text = stripReplyLine(text);
  const m = text.match(/\n\s*(-{3,}|\*{3,})\s*\n/); let head = text, tail = "";
  if (m) { head = text.slice(0, m.index); tail = text.slice(m.index + m[0].length); }
  const wrap = document.createElement("div"); wrap.className = "doc"; wrap.innerHTML = renderMd(head);
  const first = wrap.querySelector("p"); if (first && first === wrap.firstElementChild) { first.classList.add("lead"); const nx = first.nextElementSibling; if (nx && nx.tagName === "UL") nx.classList.add("lead-list");
    const sm = first.textContent.match(STATUS_RE); if (sm && first.firstChild?.nodeType === 3) { const w = sm[0].trim(); const rest = first.firstChild.nodeValue.slice(first.firstChild.nodeValue.indexOf(w) + w.length); first.firstChild.nodeValue = rest; const cls = STATUS_CLASS[sm[1].toLowerCase()] || ""; first.insertAdjacentHTML("beforebegin", `<p class="status ${cls}">${ic(STATUS_ICON[cls] || "circle")}${esc(w.replace(/[.:!]$/, ""))}</p>`); } }
  for (const p of wrap.querySelectorAll("p")) { const s = p.firstElementChild; const lead = p.firstChild === s;
    if (/^\s*question\b/i.test(p.textContent) && !p.classList.contains("lead")) { p.classList.add("callout", "ask");
      const ol = p.nextElementSibling; if (ol && ol.tagName === "OL") { ol.classList.add("choices"); for (const li of ol.querySelectorAll("li")) { const t = li.textContent.trim(); const mine = /\(my pick\)/i.test(t); li.classList.toggle("pick", mine);
        if (sid) { const b = document.createElement("button"); b.type = "button"; b.className = "choice"; b.innerHTML = li.innerHTML.replace(/\s*\(my pick\)/i, "") + (mine ? `<span class="pick-tag">my pick</span>` : ""); b.onclick = () => { send({ type: "send", sessionId: sid, text: t.replace(/\s*\(my pick\)/i, "") }); ol.querySelectorAll(".choice").forEach(x => { x.disabled = true; }); b.classList.add("chosen"); }; li.replaceChildren(b); } } } }
    else if ((s?.tagName === "STRONG" && lead && !p.classList.contains("lead")) || /^\s*(next|next action|next step|your move|do this next)\b/i.test(p.textContent)) p.classList.add("callout"); }
  foldCode(wrap);
  if (tail.trim()) { wrap.insertAdjacentHTML("beforeend", `<details class="more"><summary><svg class="chev" width="11" height="11"><use href="#i-chev"/></svg>Details</summary><div class="doc"></div></details>`); const d = wrap.querySelector("details.more>.doc"); d.innerHTML = renderMd(tail); foldCode(d); }
  return wrap;
}
function copyBtn(text) { const b = document.createElement("button"); b.type = "button"; b.className = "copy"; b.textContent = "Copy"; b.title = "Copy to the clipboard";
  b.onclick = async (e) => { e.preventDefault(); e.stopPropagation(); try { await navigator.clipboard.writeText(text); b.textContent = "Copied"; } catch { b.textContent = "Could not copy"; } setTimeout(() => { b.textContent = "Copy"; }, 1500); }; return b; }
function foldCode(root) { // code is for when she asks; long blocks fold to one line; every block gets Copy
  for (const pre of root.querySelectorAll("pre")) { const n = (pre.textContent.match(/\n/g) || []).length + 1; const text = pre.textContent.replace(/\n$/, "");
    if (n <= 3) { const w = document.createElement("div"); w.className = "code-wrap"; pre.replaceWith(w); w.appendChild(pre); w.appendChild(copyBtn(text)); continue; }
    const d = document.createElement("details"); d.className = "code"; d.innerHTML = `<summary><svg class="chev" width="11" height="11"><use href="#i-chev"/></svg>Show code, ${n} lines</summary>`; d.querySelector("summary").appendChild(copyBtn(text)); pre.replaceWith(d); d.appendChild(pre); } }
const base = (p) => String(p || "").split("/").filter(Boolean).pop() || "";
function toolLabel(ev) { const i = ev.input || {}; const n = ev.name;
  if (n === "Bash") return [i.description || "Ran a command", i.command || ""];
  if (n === "Read") return [`Read ${base(i.file_path)}`, i.file_path || ""];
  if (n === "Edit") return [`Edited ${base(i.file_path)}`, i.file_path || ""];
  if (n === "Write") return [`Wrote ${base(i.file_path)}`, i.file_path || ""];
  if (n === "Grep") return [`Searched for "${i.pattern || ""}"`, i.path || ""];
  if (n === "Glob") return [`Listed files matching ${i.pattern || ""}`, i.path || ""];
  if (n === "Agent" || n === "Task") return [i.description ? `Delegated: ${i.description}` : "Delegated to an agent", i.subagent_type || ""];
  if (n === "WebFetch") { try { return [`Fetched ${new URL(i.url).host}`, i.url]; } catch { return ["Fetched a page", i.url || ""]; } }
  if (n === "WebSearch") return [`Searched the web for "${i.query || ""}"`, ""];
  if (n === "AskUserQuestion") return ["Asked you a question", ""];
  if (n === "TodoWrite" || n === "TaskCreate") return ["Updated its task list", ""];
  const a = i.file_path || i.command || i.pattern || i.description || i.prompt || i.query || i.url || i.path || ""; return [n, String(a).replace(/\s+/g, " ").slice(0, 140)]; }
function renderTranscript() {
  const ol = $("#transcript"); const mainEl = $("#main"); const atBottom = mainEl.scrollTop + mainEl.clientHeight >= mainEl.scrollHeight - 80; ol.innerHTML = "";
  let run = []; const flush = (last) => { if (!run.length) return; ol.appendChild(stepsEl(run, last)); run = []; };
  // Claude's narration between tool runs reads as one reply, not a stack of one-liners
  const merged = []; for (const ev of transcript) { const prev = merged.at(-1); if (ev.kind === "text" && prev && prev.kind === "text") { prev.text += "\n\n" + ev.text; continue; } if (ev.kind === "text" && prev && prev.kind === "tool" && !prefs.showSteps) { const lastText = [...merged].reverse().find(e => e.kind === "text" || e.kind === "user" || e.kind === "result"); if (lastText && lastText.kind === "text") { lastText.text += "\n\n" + ev.text; continue; } } merged.push(ev.kind === "text" ? { ...ev } : ev); }
  // only the latest exchange shows by default; everything before it sits behind one button
  const starts = merged.map((e, i) => e.kind === "user" ? i : -1).filter(i => i >= 0);
  const lastStart = starts.length ? starts.at(-1) : 0; const earlier = Math.max(0, starts.length - 1);
  const visible = showEarlier.has(openId) || lastStart === 0 ? merged : merged.slice(lastStart);
  const eb = $("#earlier"); eb.hidden = earlier === 0; eb.querySelector("span").textContent = showEarlier.has(openId) ? "Hide earlier" : `Earlier (${earlier})`; eb.title = "Show the earlier exchanges in this session";
  eb.onclick = () => { if (showEarlier.has(openId)) showEarlier.delete(openId); else showEarlier.add(openId); renderTranscript(); $("#main").scrollTo(0, 0); };
  const lastText = [...visible].reverse().find(e => e.kind === "text"); armSuggestion($("#reply"), lastText?.text || "");
  visible.forEach((ev) => { if (ev.kind === "tool") { run.push(ev); return; } flush(false); let li;
    if (ev.kind === "user") { li = document.createElement("li"); li.className = "t-user"; li.textContent = ev.text.replace(/\[Image:[^\]]*\]/g, "(image attached)"); }
    else if (ev.kind === "text") { li = document.createElement("li"); li.className = "t-text"; li.appendChild(docHtml(ev.text, ev === lastText ? openId : undefined)); }
    else if (ev.kind === "result") { li = document.createElement("li"); li.className = "t-result"; li.textContent = ev.subtype === "success" ? `Turn finished${ev.cost ? `, $${ev.cost.toFixed(2)} so far` : ""}` : `Turn ended: ${ev.subtype}`; }
    else { li = document.createElement("li"); li.className = "t-note"; li.textContent = ev.text; }
    ol.appendChild(li); });
  flush(true); ol.classList.toggle("no-steps", !prefs.showSteps); renderStatus(); icons(); if (atBottom) mainEl.scrollTo(0, mainEl.scrollHeight);
}
function renderStatus() { // one line while Claude works, naming what it is doing now
  const el = $("#status"); const working = meta && (meta.status === "working" || meta.status === "starting");
  if (!working) { el.hidden = true; return; }
  const last = [...transcript].reverse().find(e => e.kind === "tool" && !e.doneAt) || [...transcript].reverse().find(e => e.kind === "tool");
  el.textContent = meta.status === "starting" ? "Starting" : last && !last.doneAt ? `Working: ${toolLabel(last)[0].toLowerCase()}` : "Working"; el.hidden = false;
}
function stepsEl(run, isLast) { const li = document.createElement("li"); li.className = "t-steps"; const running = run.some(e => !e.doneAt), failed = run.filter(e => e.isError).length;
  const kinds = {}; for (const e of run) { const k = e.name === "Bash" ? "commands" : e.name === "Read" ? "files read" : e.name === "Edit" || e.name === "Write" ? "files changed" : e.name.startsWith("Web") ? "lookups" : e.name === "Grep" || e.name === "Glob" ? "searches" : "steps"; kinds[k] = (kinds[k] || 0) + 1; }
  const summary = run.length === 1 ? toolLabel(run[0])[0] : `${run.length} steps: ` + Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(", ");
  const det = document.createElement("details"); det.open = isLast && running;
  det.innerHTML = `<summary><svg class="chev" width="12" height="12"><use href="#i-chev"/></svg><b>${esc(summary)}</b>${running ? `<span class="tk run">${esc(toolLabel(run.at(-1))[0])}…</span>` : failed ? `<span class="tk err">${failed} failed</span>` : ""}</summary>`;
  const ul = document.createElement("ul"); ul.className = "steps"; for (const e of run) ul.appendChild(toolEl(e)); det.appendChild(ul); li.appendChild(det); return li; }
function toolEl(ev) { const li = document.createElement("li"); li.className = "t-tool"; const [n, a] = toolLabel(ev); const st = ev.doneAt ? (ev.isError ? "err" : "") : "run";
  li.innerHTML = `<details><summary><span class="ta">${esc(n)}</span><span class="raw">${esc(a)}</span><span class="tk ${st}">${ev.doneAt ? (ev.isError ? "failed" : "done") : "running"}</span></summary><pre>${esc(JSON.stringify(ev.input, null, 2))}${ev.result ? "\n\n" + esc(ev.result) : ""}</pre></details>`; return li; }

function renderPending() { const box = $("#pending"); const p = meta?.pending; if (!p) { box.hidden = true; box.innerHTML = ""; return; } box.hidden = false; renderPendingInto(box, p, openId); }
function renderPendingInto(box, p, sid) {
  box.classList.add("plate", "needs");
  if (p.kind === "question") { const qs = p.input.questions || []; const picks = {};
    box.innerHTML = `<span class="plate-label">${ic("message-circle-question")}Claude has a question</span>` + qs.map((q, qi) => `<div class="q" data-q="${qi}"><div class="qh">${esc(q.header || "")}</div><div class="qt">${esc(q.question)}</div><div class="opts">${(q.options || []).map(o => `<button type="button" class="opt" data-l="${esc(o.label)}" aria-pressed="false">${esc(o.label)}<small>${esc(o.description || "")}</small></button>`).join("")}</div></div>`).join("") + `<div class="acts"><button class="btn primary" id="q-send">Answer</button><span class="pd">Or type a reply below to answer in your own words.</span></div>`;
    box.querySelectorAll(".q").forEach((qel, qi) => { const q = qs[qi]; qel.querySelectorAll(".opt").forEach(b => b.onclick = () => { if (q.multiSelect) { const on = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(on)); picks[q.question] = [...qel.querySelectorAll('.opt[aria-pressed="true"]')].map(x => x.dataset.l).join(", "); } else { qel.querySelectorAll(".opt").forEach(x => x.setAttribute("aria-pressed", "false")); b.setAttribute("aria-pressed", "true"); picks[q.question] = b.dataset.l; } }); });
    box.querySelector("#q-send").onclick = () => { send({ type: "answer", sessionId: sid, requestId: p.id, decision: { answers: Object.fromEntries(qs.map(q => [q.question, picks[q.question] ?? ""])) } }); sentCards.add(sid); };
  } else { const i = p.input || {}; let body = "";
    if (p.toolName === "Bash") body = `<pre>${esc(i.command || "")}</pre>${i.description ? `<div class="pd">${esc(i.description)}</div>` : ""}`;
    else if (p.toolName === "Edit") body = `<div class="pd">${esc(i.file_path)}</div><pre>- ${esc(String(i.old_string || "").slice(0, 600))}\n+ ${esc(String(i.new_string || "").slice(0, 600))}</pre>`;
    else if (p.toolName === "Write") body = `<div class="pd">${esc(i.file_path)}</div><pre>${esc(String(i.content || "").slice(0, 800))}</pre>`;
    else body = `<pre>${esc(JSON.stringify(i, null, 2).slice(0, 1200))}</pre>`;
    box.innerHTML = `<span class="plate-label">${ic("hand")}Wants to run ${esc(p.toolName)}</span>${body}${p.decisionReason ? `<div class="pd">${esc(p.decisionReason)}</div>` : ""}<div class="acts"><button class="btn primary" data-d="allow">Allow</button><button class="btn soft" data-d="remember">Allow for this session</button><button class="btn ghost" data-d="deny">Deny</button><span class="pd">Or type below to deny with a note.</span></div>`;
    box.querySelector('[data-d="allow"]').onclick = () => { send({ type: "answer", sessionId: sid, requestId: p.id, decision: { behavior: "allow" } }); sentCards.add(sid); };
    box.querySelector('[data-d="remember"]').onclick = () => { send({ type: "answer", sessionId: sid, requestId: p.id, decision: { behavior: "allow", remember: true } }); sentCards.add(sid); };
    box.querySelector('[data-d="deny"]').onclick = () => { send({ type: "answer", sessionId: sid, requestId: p.id, decision: { behavior: "deny" } }); sentCards.add(sid); }; }
}
acceptFiles($("#reply"), () => openId); acceptFiles($("#ns-prompt"), () => "new");
$("#composer").onsubmit = (e) => { e.preventDefault(); const t = withFiles($("#reply"), $("#reply").value.trim()); if (!t || !openId) return; const p = meta?.pending; if (p?.kind === "permission") send({ type: "answer", sessionId: openId, requestId: p.id, decision: { behavior: "deny", message: t } }); else send({ type: "send", sessionId: openId, text: t }); $("#reply").value = ""; };
$("#reply").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#composer").requestSubmit(); } });

// ---------- appearance ----------
const menu = $("#menu"), gear = $("#gear");
function closeMenu() { menu.hidden = true; gear.setAttribute("aria-expanded", "false"); }
gear.onclick = () => { menu.hidden = !menu.hidden; gear.setAttribute("aria-expanded", String(!menu.hidden)); };
document.addEventListener("click", (e) => { if (!e.target.closest(".menu-wrap")) closeMenu(); });
function seg(el, opts, cur, on) { el.innerHTML = opts.map(([k, v]) => `<button data-k="${k}" aria-pressed="${k === cur}">${v}</button>`).join(""); el.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; on(b.dataset.k); [...el.children].forEach(c => c.setAttribute("aria-pressed", String(c === b))); }; }
function applyPrefs() { const theme = prefs.theme ?? "stillroom", modePref = prefs.mode ?? "dark"; const mode = modePref === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : modePref;
  document.documentElement.dataset.theme = theme; document.documentElement.dataset.mode = mode; document.body.classList.toggle("roomy", prefs.density === "roomy");
  $("#swatches").innerHTML = THEMES.map(([k, l, c]) => `<button class="swatch" data-k="${k}" aria-pressed="${k === theme}"><i style="background:${c}"></i>${l}</button>`).join("");
  $("#swatches").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; prefs.theme = b.dataset.k; prefs.themeChosen = true; save(); applyPrefs(); };
  seg($("#modes"), [["dark","Dark"],["light","Light"],["system","System"]], modePref, (k) => { prefs.mode = k; save(); applyPrefs(); });
  seg($("#density"), [["compact","Compact"],["roomy","Roomy"]], prefs.density ?? "compact", (k) => { prefs.density = k; save(); applyPrefs(); }); }
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyPrefs);
if (prefs.themeVersion !== 3) { delete prefs.theme; delete prefs.themeChosen; prefs.themeVersion = 3; save(); } // the board's look is the new default; a theme picked from the menu after this sticks
applyPrefs(); connect(); route(); icons();
