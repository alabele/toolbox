// Stillroom. Pull-only. Nothing here animates or redraws the thing you are reading.
const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
const STATE = {
  "needs-permission": { icon: "hand",                    word: "Needs permission", short: "Permission", color: "var(--st-permission)" },
  "needs-answer":     { icon: "message-circle-question", word: "Needs an answer",  short: "Question",   color: "var(--st-answer)" },
  failed:             { icon: "triangle-alert",          word: "Failed",           short: "Failed",     color: "var(--st-failed)" },
  finished:           { icon: "moon-star",               word: "Your turn",        short: "Your turn",  color: "var(--st-finished)" },
  working:            { icon: "orbit",                   word: "Working",          short: "Working",    color: "var(--st-working)" },
  idle:               { icon: "moon",                    word: "Resting",          short: "Resting",    color: "var(--st-idle)" },
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
const lineOf = (x) => x.note ? { text: x.note, note: true } : (prefs.notes?.[x.sessionId] ? { text: prefs.notes[x.sessionId], note: true } : { text: plain(x.last), note: false });
const isOld = (x) => x.state !== "working" && Date.now() - x.stateSince > OLD_MS;
const isDismissed = (x) => (prefs.dismissed || []).includes(x.sessionId);
const hrefOf = (x) => x.managed ? `#s/${x.sessionId}` : `#t/${x.sessionId}`;

// ---------- server calls ----------
async function fetchState() { try { return await (await fetch("/api/state", { cache: "no-store" })).json(); } catch { return { error: "The local server is not reachable. Start it with: bun run server.ts" }; } }
async function act(path, sessionId, btn, extra) { const was = btn.textContent; btn.disabled = true; btn.textContent = "Working"; try { const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId, ...(extra || {}) }) }); btn.textContent = r.ok ? "Done" : `Failed: ${(await r.text()).slice(0, 80)}`; } catch { btn.textContent = "Failed"; } btn.disabled = false; setTimeout(() => (btn.textContent = was), 1500); }
async function copyCmd(cmd, btn) { const was = btn.textContent; try { await navigator.clipboard.writeText(cmd); btn.textContent = "Copied"; } catch { btn.textContent = "Select and copy"; } setTimeout(() => (btn.textContent = was), 1500); }
function send(o) { if (wsReady) ws.send(JSON.stringify(o)); else setTimeout(() => send(o), 300); }

// ---------- sidebar: every session, one place ----------
function renderSide() {
  const live = list.filter(x => !isDismissed(x));
  const groups = { needs: [], working: [], done: [], older: [] };
  for (const x of live) { if (isOld(x) || x.state === "idle") groups.older.push(x); else if (x.needsYou && x.state !== "finished") groups.needs.push(x); else if (x.state === "working") groups.working.push(x); else groups.done.push(x); }
  const byRepo = (a, b) => a.repo.localeCompare(b.repo) || b.startedAt - a.startedAt;
  groups.needs.sort((a, b) => a.stateSince - b.stateSince); groups.working.sort(byRepo); groups.done.sort(byRepo); groups.older.sort((a, b) => b.stateSince - a.stateSince);
  const item = (x, old) => { const st = STATE[x.state]; const ln = lineOf(x); const cur = x.sessionId === openId || x.sessionId === termId;
    return `<a class="si${old ? " older" : ""}" href="${hrefOf(x)}" aria-current="${cur}" style="--sc:${st.color};--jc:${tintOf(x.repo)}"><span class="si-top"><span class="si-title">${esc(x.title)}</span><span class="si-state">${ic(st.icon)}${st.short}</span></span>${ln.text ? `<span class="si-line${ln.note ? " note" : ""}">${esc(ln.text)}</span>` : ""}${old ? `<span class="si-acts"><span class="where">${ago(Date.now() - x.stateSince)}</span><button class="btn tiny letgo" data-id="${x.sessionId}" data-managed="${!!x.managed}">Let it go</button></span>` : ""}</a>`; };
  const g = (key, label, arr, collapsible) => { if (!arr.length) return ""; const open = collapsible ? !!prefs.open?.[key] : true;
    return `<div class="sg"><${collapsible ? "button" : "div"} class="sg-h${collapsible ? " toggle" : ""}"${collapsible ? ` data-toggle="${key}" aria-expanded="${open}"` : ""}>${collapsible ? `<svg class="chev" width="11" height="11"><use href="#i-chev"/></svg>` : ""}${label} <span class="where">${arr.length}</span></${collapsible ? "button" : "div"}>${open ? arr.map(x => item(x, key === "older")).join("") : ""}</div>`; };
  $("#side-groups").innerHTML = g("needs", "Needs you", groups.needs) + g("done", "Your turn", groups.done) + g("working", "Working", groups.working, true) + g("older", "Older", groups.older, true) || `<p class="menu-note">No sessions yet.</p>`;
  document.querySelectorAll("[data-toggle]").forEach(t => t.onclick = () => { prefs.open = { ...(prefs.open || {}), [t.dataset.toggle]: !prefs.open?.[t.dataset.toggle] }; save(); renderSide(); });
  document.querySelectorAll(".letgo").forEach(b => b.onclick = async (e) => { e.preventDefault(); e.stopPropagation(); const id = b.dataset.id;
    if (!confirm("Let this session go? It ends now. The conversation stays on disk and can be resumed later.")) return;
    if (b.dataset.managed === "true") send({ type: "end", sessionId: id });
    else { try { const r = await fetch("/api/letgo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: id }) }); if (!r.ok) { $("#error").hidden = false; $("#error").textContent = "Could not end it: " + await r.text(); return; } } catch {} }
    prefs.dismissed = [...(prefs.dismissed || []), id]; save(); renderSide(); renderNext(); });
  document.title = (groups.needs.length ? "Needs you · " : "") + "Stillroom"; document.body.dataset.needs = groups.needs.length ? "1" : "0"; icons();
  const rn = list.filter(x => !isDismissed(x) && !isOld(x) && x.needsYou).length; $("#rounds-n").textContent = rn ? String(rn) : ""; $("#side-rounds").setAttribute("aria-current", String(roundsOn));
  if (roundsOn) renderRounds();
}
// ---------- sidebar width: drag the edge ----------
(() => { const grip = $("#side-grip"); const apply = (w) => document.documentElement.style.setProperty("--side-w", Math.min(600, Math.max(240, w)) + "px"); if (prefs.sideW) apply(prefs.sideW);
  grip.addEventListener("pointerdown", (e) => { e.preventDefault(); const start = e.clientX, base = $("#side").getBoundingClientRect().width; const move = (ev) => apply(base + ev.clientX - start); const up = (ev) => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); prefs.sideW = Math.min(600, Math.max(240, base + ev.clientX - start)); save(); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); }); })();

// ---------- home: the form and one next card ----------
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
let openRound = null;
const sentKey = (x) => `${x.pending?.id || ""}:${(x.lastReply || "").length}`;
function renderRounds() {
  const el = $("#rounds-list"); const live = list.filter(x => !isDismissed(x) && !isOld(x));
  for (const x of live) if (sentCards.has(x.sessionId) && sentCards.get(x.sessionId) !== sentKey(x) && x.needsYou) sentCards.delete(x.sessionId); // it came back to you
  const waiting = (x) => x.needsYou && !sentCards.has(x.sessionId);
  let cards = live.filter(x => x.needsYou || sentCards.has(x.sessionId)).sort((a, b) => waiting(b) - waiting(a) || (a.state === "finished") - (b.state === "finished") || a.stateSince - b.stateSince);
  if (!cards.length) { el.innerHTML = `<p class="quiet">Nothing needs you right now.</p>`; openRound = null; return; }
  if (!openRound || !cards.some(x => x.sessionId === openRound)) { const next = cards.find(waiting); openRound = next ? next.sessionId : null; } // stays open until you move on
  cards = cards.sort((a, b) => (b.sessionId === openRound) - (a.sessionId === openRound)); // the open one is always on top
  const keep = new Set(cards.map(x => x.sessionId)); for (const old of [...el.children]) if (!keep.has(old.dataset.id)) old.remove();
  cards.forEach((x, i) => {
    const isOpen = x.sessionId === openRound;
    const key = JSON.stringify([x.state, x.pending?.id, (x.lastReply || "").length, sentCards.has(x.sessionId), i, isOpen, x.title, x.note || prefs.notes?.[x.sessionId] || "", cards.filter(waiting).length]);
    let card = el.querySelector(`[data-id="${x.sessionId}"]`);
    if (card && card.dataset.key === key) { if (el.children[i] !== card) el.insertBefore(card, el.children[i] || null); return; }
    const fresh = roundCard(x, isOpen, cards.some(y => y !== x && waiting(y))); fresh.dataset.key = key;
    const draft = card?.querySelector("textarea")?.value; if (draft) { const t = fresh.querySelector("textarea"); if (t) t.value = draft; } // a new reply must not eat what you were typing
    if (card) card.replaceWith(fresh); else el.insertBefore(fresh, el.children[i] || null);
  }); icons();
  const focusBox = el.querySelector(".rc.is-open textarea"); if (focusBox && document.activeElement?.tagName !== "TEXTAREA") focusBox.focus({ preventScroll: true });
}
function aboveRule(t) { const m = String(t || "").match(/\n\s*(-{3,}|\*{3,})\s*\n/); return m ? t.slice(0, m.index) : t; }
function needLine(x, sent) { // one plain line: what this item wants from you
  if (!x.managed) return x.state === "failed" ? "It failed in a terminal. Look there, or let it go." : "It runs in a terminal. Answer it there.";
  if (sent && !x.needsYou) return "Sent. Working on it.";
  if (x.pending?.kind === "permission") return `Wants to run ${x.pending.toolName || "a tool"}. Allow it?`;
  if (x.pending) return "Asked you a question.";
  if (x.state === "failed") return "It failed. Reply to try again, or close it.";
  return ""; // finished: the reply's own first line says what happened
}
function roundCard(x, isOpen, hasNext) {
  const st = STATE[x.state]; const sent = sentCards.has(x.sessionId); const note = x.note || prefs.notes?.[x.sessionId] || "";
  const card = document.createElement("article"); card.className = "rc plate " + (isOpen ? "is-open" : "is-collapsed") + (sent ? " sent" : ""); card.dataset.id = x.sessionId;
  const label = `<span class="plate-label">${ic(st.icon)}${sent && !x.needsYou ? "Sent" : st.word}</span>`;
  if (!isOpen) { card.innerHTML = `${label}<button class="rc-row" type="button"><span class="rc-title">${esc(x.title)}</span>${sent && !x.needsYou ? `<span class="rc-note">Sent. Working on it.</span>` : note ? `<span class="rc-note">${esc(note)}</span>` : ""}</button>`;
    card.querySelector(".rc-row").onclick = () => { openRound = x.sessionId; renderRounds(); }; return card; }
  // the open item: title, one line saying what it needs, the reply, one way to answer, and the rest behind More
  const need = needLine(x, sent); card.innerHTML = `${label}<h3 class="rc-title">${esc(x.title)}</h3>${x.prompt ? `<div class="rc-ask">${esc(x.prompt)}</div>` : ""}${need ? `<p class="rc-need">${esc(need)}</p>` : ""}`;
  if (x.pending) { const box = document.createElement("div"); box.className = "pending"; renderPendingInto(box, x.pending, x.sessionId); card.appendChild(box); }
  else if (x.lastReply || x.last) { const body = document.createElement("div"); body.className = "rc-body clamp"; body.appendChild(docHtml(x.lastReply || x.last, x.managed ? x.sessionId : undefined)); card.appendChild(body);
    const more = document.createElement("button"); more.className = "btn tiny rc-fold"; more.textContent = "Read the whole reply"; more.onclick = () => { body.classList.toggle("clamp"); more.textContent = body.classList.contains("clamp") ? "Read the whole reply" : "Show less"; }; card.appendChild(more);
    requestAnimationFrame(() => { if (body.scrollHeight <= body.clientHeight + 4) { body.classList.remove("clamp"); more.hidden = true; } }); }
  const answered = () => { sentCards.set(x.sessionId, sentKey(x)); renderRounds(); }; // the plate stays open; the reply lands here
  if (!x.managed) { card.insertAdjacentHTML("beforeend", `<div class="rc-answer"><button class="btn primary" data-a="resume">Resume in Terminal</button></div>`); card.querySelector('[data-a="resume"]').onclick = (e) => act("/api/resume", x.sessionId, e.target); }
  else if (!(sent && !x.needsYou)) {
    const f = document.createElement("form"); f.className = "rc-reply";
    const ph = x.pending ? (x.pending.kind === "permission" ? "Or type to deny with a note" : "Or answer in your own words") : "Reply. Enter to send";
    f.innerHTML = `<textarea rows="2" placeholder="${ph}"></textarea><button class="btn primary" type="submit">Send</button>`;
    f.onsubmit = (e) => { e.preventDefault(); const t = f.querySelector("textarea").value.trim(); if (!t) return;
      if (x.pending) send({ type: "answer", sessionId: x.sessionId, requestId: x.pending.id, decision: x.pending.kind === "permission" ? { behavior: "deny", message: t } : { freeText: t } }); else send({ type: "send", sessionId: x.sessionId, text: t }); answered(); };
    f.querySelector("textarea").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } }); card.appendChild(f);
  }
  const row = document.createElement("div"); row.className = "rc-tail";
  const more = document.createElement("button"); more.className = "rc-more"; more.type = "button"; more.textContent = "More"; row.appendChild(more);
  if (hasNext) { const nx = document.createElement("button"); nx.className = "rc-next"; nx.type = "button"; nx.textContent = "Next one"; nx.onclick = () => { const rest = list.filter(y => y.sessionId !== x.sessionId && y.needsYou && !sentCards.has(y.sessionId) && !isDismissed(y) && !isOld(y)); openRound = rest[0]?.sessionId || null; renderRounds(); $("#main").scrollTo(0, 0); }; card.insertAdjacentElement("afterbegin", nx); }
  card.appendChild(row);
  const extra = document.createElement("div"); extra.className = "rc-extra"; extra.hidden = true;
  extra.innerHTML = `<div class="rc-acts"><button class="btn tiny" data-a="note">Leave a note</button>${x.managed ? `<button class="btn tiny" data-a="close">Close session</button><a class="btn tiny" href="#s/${x.sessionId}">Open in focus</a>` : `<button class="btn tiny" data-a="letgo">Let it go</button>`}</div><p class="rc-foot">${ago(Date.now() - x.stateSince)} waiting<span class="path">${esc(x.cwd)}</span></p>`;
  more.onclick = () => { extra.hidden = !extra.hidden; more.textContent = extra.hidden ? "More" : "Less"; };
  extra.querySelector('[data-a="note"]').onclick = () => { const v = prompt("Note to self, shown on the item", note); if (v === null) return; if (x.managed) send({ type: "note", sessionId: x.sessionId, note: v }); else { prefs.notes = { ...(prefs.notes || {}), [x.sessionId]: v.trim() }; if (!prefs.notes[x.sessionId]) delete prefs.notes[x.sessionId]; save(); renderSide(); renderRounds(); } };
  extra.querySelector('[data-a="close"]')?.addEventListener("click", () => { closeWithUndo(x); openRound = null; });
  extra.querySelector('[data-a="letgo"]')?.addEventListener("click", async () => { if (!confirm("Let this session go? It ends now. The conversation stays on disk.")) return; try { await fetch("/api/letgo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: x.sessionId }) }); } catch {} prefs.dismissed = [...(prefs.dismissed || []), x.sessionId]; save(); renderSide(); renderRounds(); });
  card.appendChild(extra);
  return card;
}

// ---------- pull requests ----------
let prList = [], prRepos = {}, prJira = {}; const prOpen = new Set(); let prFilter = "all";
const PR_ICON = { changes: "message-square-warning", "checks-failing": "circle-x", conflict: "git-merge", ready: "circle-check", "approved-qa": "flask-conical", "claude-approved": "sparkles", "claude-reviewing": "orbit", "checks-running": "loader", review: "clock", draft: "pencil-line", shelf: "archive" };
const PR_WORD = { changes: "Changes asked for", "checks-failing": "Checks failing", conflict: "Merge conflict", ready: "Ready to merge", "approved-qa": "Approved, in QA", "claude-approved": "Approved by Claude", "claude-reviewing": "Claude is reviewing", "checks-running": "Checks running", review: "Waiting on review", draft: "Draft", shelf: "Shelved" };
function renderPrs() {
  const el = $("#prs-groups"); const note = $("#prs-note"); const err = prList.find(p => p.error)?.error || (prJira.connected ? prJira.error : "Ticket status needs Jira. Save an API token to ~/.config/stillroom/jira-token."); note.hidden = !err; note.textContent = err || "";
  if (!prList.length) { el.innerHTML = `<p class="quiet">${err ? "" : "No open pull requests, or the first look is still on its way."}</p>`; return; }
  // a filter row, then repositories; inside a repo what needs her first, drafts last
  const FILTERS = [["all", "All", (p) => !p.shelved], ["needs", "Needs you", (p) => p.needsYou], ["review", "Waiting on review", (p) => p.state === "review" || p.state === "checks-running"], ["qa", "In QA", (p) => p.state === "approved-qa"], ["claude", "Approved by Claude", (p) => p.state === "claude-approved"], ["draft", "Drafts", (p) => p.isDraft && !p.shelved], ["shelf", "Shelf", (p) => p.shelved]];
  const rank = (p) => p.needsYou ? 0 : p.isDraft ? 2 : 1; const fn = (FILTERS.find(f => f[0] === prFilter) || FILTERS[0])[2];
  const live = prList.filter(fn).sort((a, b) => rank(a) - rank(b) || a.updatedAt - b.updatedAt);
  const byRepo = new Map(); for (const p of live) { if (!byRepo.has(p.repo)) byRepo.set(p.repo, []); byRepo.get(p.repo).push(p); }
  const repos = [...byRepo].sort((a, b) => (b[1].some(p => p.needsYou) - a[1].some(p => p.needsYou)) || a[0].split("/")[1].localeCompare(b[0].split("/")[1]));
  el.innerHTML = `<div class="lg-filter pr-filter">${FILTERS.map(([k, w, f]) => { const n = prList.filter(f).length; return `<button class="btn tiny" data-f="${k}" aria-pressed="${prFilter === k}">${w}${n ? ` <span class="pr-count">${n}</span>` : ""}</button>`; }).join("")}</div>`
    + (repos.length ? repos.map(([repo, rows]) => `<section class="pr-repo"><h2 class="pr-h">${esc(repo.split("/")[1])}</h2><ul class="pr-list">${rows.map(p => prRow(p)).join("")}</ul></section>`).join("") : `<p class="quiet">Nothing here.</p>`);
  for (const b of el.querySelectorAll(".pr-filter [data-f]")) b.onclick = () => { prFilter = b.dataset.f; renderPrs(); };
  for (const li of el.querySelectorAll(".pr-row")) { const key = li.dataset.key; const p = prList.find(x => x.key === key); const toggle = () => { prOpen.has(key) ? prOpen.delete(key) : prOpen.add(key); renderPrs(); };
    li.querySelector(".lg-plus").onclick = toggle; li.querySelector(".pr-title").onclick = toggle;
    li.querySelector('[data-a="review"]')?.addEventListener("click", (e) => act("/api/pr/review", null, e.target, { key }));
    li.querySelector('[data-a="channel"]')?.addEventListener("click", async () => { const v = prompt(`Which Slack channel for ${p.repo.split("/")[1]}? (like #docs-eng)`, prRepos[p.repo]?.channel || "#"); if (!v || v === "#") return; await fetch("/api/pr/channel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repo: p.repo, channel: v.trim() }) }); });
    li.querySelector('[data-a="ask"]')?.addEventListener("click", async (e) => { const text = li.querySelector(".pr-msg")?.value?.trim(); if (!text) return; act("/api/pr/slack", null, e.target, { key, kind: "ask", text }); });
    li.querySelector('[data-a="nudge"]')?.addEventListener("click", (e) => act("/api/pr/slack", null, e.target, { key, kind: "nudge" }));
    li.querySelector('[data-a="start"]')?.addEventListener("click", () => { location.hash = ""; show("home"); $("#ns-cwd").value = guessCwd(p); $("#ns-prompt").value = `Pick up ${p.short}: ${p.url}\nCheck out its branch first.`; $("#ns-prompt").focus(); }); }
  icons();
}
function guessCwd(p) { const name = p.repo.split("/")[1]; const hit = list.find(x => x.cwd.split("/").pop() === name); return hit ? hit.cwd : `~/code/${name}`; }
function prRow(p) {
  const open = prOpen.has(p.key); const ch = prRepos[p.repo]?.channel; const dayOld = p.slack?.askedAt && Date.now() - p.slack.askedAt > 24 * 3600e3 && !p.reviewers?.length;
  const checks = (p.checks || []).filter(c => c.ok === false).map(c => esc(c.name)); const people = (p.reviewers || []).filter(r => r.state === "APPROVED" || r.state === "CHANGES_REQUESTED").map(r => `${esc(r.login)} ${r.state === "APPROVED" ? "approved" : "asked for changes"}`);
  const facts = [p.reason, checks.length ? `Failed: ${checks.join(", ")}` : "", people.join(", "), p.claudeVerdict ? `Claude ${p.claudeVerdict === "approve" ? "approved" : "asked for changes"} ${ago(Date.now() - p.claudeAt)} ago` : "", p.slack?.askedAt ? `Asked in ${esc(p.slack.channel)} ${ago(Date.now() - p.slack.askedAt)} ago${p.slack.nudgedAt ? `, nudged ${ago(Date.now() - p.slack.nudgedAt)} ago` : ""}` : "", p.ticket ? `${p.ticket.key}: ${esc(p.ticket.status)}${p.ticket.assignee ? `, ${esc(p.ticket.assignee)}` : ""}. <a href="${esc(p.ticket.url)}" target="_blank" rel="noopener">Open the ticket</a>` : p.tickets.length ? `${p.tickets.join(", ")}: ticket status needs Jira` : ""].filter(Boolean);
  const session = p.sessionId ? `<a class="btn tiny" href="#s/${p.sessionId}">Open its session</a>` : `<button class="btn tiny" data-a="start">Start a session on this</button>`;
  const review = p.state === "claude-reviewing" ? `<span class="pr-running">Claude is reviewing, a few minutes</span>` : `<button class="btn tiny" data-a="review">Run Claude review</button>`;
  const slack = !ch ? `<button class="btn tiny" data-a="channel">Set the Slack channel</button>` : p.slack?.permalink ? `${dayOld ? `<button class="btn tiny" data-a="nudge">Nudge the thread</button>` : ""}<a class="btn tiny" href="${esc(p.slack.permalink)}" target="_blank" rel="noopener">Open the thread</a>` : `<div class="pr-ask"><textarea class="pr-msg" rows="2">Review request: ${esc(p.title)} ${esc(p.url)}</textarea><button class="btn tiny" data-a="ask">Ask in ${esc(ch)}</button></div>`;
  return `<li class="pr-row ${open ? "open" : ""} st-${p.state}" data-key="${esc(p.key)}"><span class="pr-mark" title="${PR_WORD[p.state]}">${ic(PR_ICON[p.state] || "circle")}</span><p class="pr-title">${esc(p.title)}</p><span class="pr-short">${p.shelved ? esc(p.short) : "#" + p.number}${p.tickets.map(t => `<span class="pr-ticket">${esc(t)}${p.ticket?.key === t && p.ticket.status ? ` <em>${esc(p.ticket.status)}</em>` : ""}</span>`).join("")}</span><span class="pr-state s-${p.state}">${p.mismatch ? `<span class="pr-mismatch">${esc(p.mismatch)}</span>` : ""}${PR_WORD[p.state]}</span><button class="lg-plus" type="button" aria-label="More"><span></span></button>${open ? `<div class="pr-more"><ul class="pr-facts">${facts.map(f => `<li>${f}</li>`).join("")}</ul><div class="rc-acts">${session}${review}<a class="btn tiny" href="${esc(p.url)}" target="_blank" rel="noopener">Open on GitHub</a></div>${slack}</div>` : ""}</li>`;
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
  days.innerHTML = `<ul class="lg-list">${[...groups].map(([k, rs]) => { const sid = rs[0].sessionId;
    const s = ledgerSums[k]; const latest = rs[0]; const partly = rs.every(r => r.status === "partly");
    const headline = s ? s.headline : (latest.lines[0] || latest.title); const points = s ? s.points : [...new Set(rs.flatMap(r => r.lines))]; const next = latest.next;
    return `<li class="lg-row ${partly ? "partly" : "done"}" data-sid="${sid}"><span class="lg-dot" aria-hidden="true"></span><div class="lg-main"><p class="lg-first">${renderInline(headline)}${s ? "" : `<span class="lg-wait" title="A shorter headline is on its way">…</span>`}</p><div class="lg-rest" hidden>${points.map(p => `<p>${renderInline(p)}</p>`).join("")}${next ? `<p class="lg-next">Next: ${renderInline(next)}</p>` : ""}</div></div><span class="lg-side"><a class="lg-go" href="#s/${sid}" title="Open the session">${ic("arrow-up-right")}</a><button class="lg-plus" type="button" aria-label="More"><span></span></button></span></li>`; }).join("")}</ul>`;
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
    if (m.type === "prs") { prList = m.payload?.prs || []; prRepos = m.payload?.repos || {}; prJira = m.payload?.jira || {}; $("#prs-n").textContent = String(prList.filter(p => p.needsYou).length || ""); if (!$("#prs").hidden) renderPrs(); }
    if (m.type === "ledger") { ledgerRows = m.payload?.entries || []; ledgerSums = m.payload?.summaries || {}; if (!$("#ledger").hidden) renderLedger(); }
    if (m.type === "started") { pendingStarts.push(m.payload.tempId); openSession(m.payload.tempId); }
    if (m.type === "meta") { const mm = m.payload; if (openId === m.sessionId || (openId && openId.startsWith("pending-") && pendingStarts.includes(openId))) { if (openId !== mm.sessionId) { openId = mm.sessionId; location.hash = "s/" + mm.sessionId; send({ type: "open", sessionId: mm.sessionId }); } meta = mm; renderSessHead(); renderPending(); } }
    if (m.type === "event" && m.sessionId === openId) { const ev = m.payload; const i = ev.kind === "tool" ? transcript.findIndex(x => x.kind === "tool" && x.id === ev.id) : -1; if (i >= 0) transcript[i] = ev; else transcript.push(ev); renderTranscript(); }
    if (m.type === "transcript" && m.sessionId === openId) { meta = m.payload.meta; transcript = m.payload.events; renderSessHead(); renderTranscript(); renderPending(); }
    if (m.type === "error") { $("#error").hidden = false; $("#error").textContent = m.payload; }
  };
}
function withTitles(rows) { return (rows || []).map(x => (!x.managed && prefs.titles?.[x.sessionId]) ? { ...x, title: prefs.titles[x.sessionId] } : x); }
function applyList(sessions, version) { // the sidebar is navigation and always updates; the home card holds still while you read
  list = withTitles(sessions); listVersion = version ?? listVersion; renderSide();
  if (termId) renderTerm(); if (!$("#ledger").hidden) renderLedger();
  if (!openId && !termId && !roundsOn) { if (document.hasFocus() && shownVersion >= 0 && listVersion !== shownVersion) $("#stale").hidden = false; else { renderNext(); shownVersion = listVersion; $("#stale").hidden = true; } }
}
async function refresh() { const d = await fetchState(); $("#error").hidden = !d.error && !d.pollError; $("#error").textContent = d.error || (d.pollError ? `Could not read sessions: ${d.pollError}` : ""); if (d.error) return; list = withTitles(d.sessions); listVersion = d.version; renderSide(); if (!openId && !termId && !roundsOn) { renderNext(); shownVersion = listVersion; $("#stale").hidden = true; } if (termId) renderTerm(); }

// ---------- routing ----------
function show(which) { $("#home").hidden = which !== "home"; $("#tsess").hidden = which !== "term"; $("#sess").hidden = which !== "sess"; $("#rounds").hidden = which !== "rounds"; $("#ledger").hidden = which !== "ledger"; $("#side-ledger").setAttribute("aria-current", String(which === "ledger")); $("#prs").hidden = which !== "prs"; $("#side-prs").setAttribute("aria-current", String(which === "prs")); roundsOn = which === "rounds"; document.body.classList.toggle("in-rounds", roundsOn); $("#side-rounds").setAttribute("aria-current", String(roundsOn)); if (which !== "sess") { openId = null; meta = null; transcript = []; } if (which !== "term") termId = null; }
function openSession(id) { termId = null; openId = id; transcript = []; meta = null; location.hash = "s/" + id; show("sess"); $("#transcript").innerHTML = ""; $("#pending").hidden = true; $("#park").hidden = true; send({ type: "open", sessionId: id }); renderSide(); setTimeout(() => $("#reply").focus(), 50); }
function route() { const s = location.hash.match(/^#s\/(.+)$/), t = location.hash.match(/^#t\/(.+)$/);
  if (s) { if (openId !== s[1]) openSession(s[1]); return; }
  if (t) { show("term"); termId = t[1]; renderTerm(); renderSide(); return; }
  if (location.hash === "#prs") { show("prs"); renderPrs(); renderSide(); return; }
  if (location.hash === "#ledger") { show("ledger"); renderLedger(); renderSide(); return; }
  if (location.hash === "#rounds") { show("rounds"); sentCards.clear(); renderRounds(); renderSide(); refresh(); return; }
  show("home"); refresh(); }
window.addEventListener("hashchange", route);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && !openId) refresh(); });
window.addEventListener("focus", () => { if (!openId) refresh(); });
document.addEventListener("keydown", (e) => { if (e.target.matches("input,select,textarea")) return; if (e.key === "r" || e.key === "R") { e.preventDefault(); refresh(); } if (e.key === "Escape") closeMenu(); });

// ---------- new session ----------
$("#newsess").onsubmit = (e) => { e.preventDefault(); const cwd = resolveCwd($("#ns-cwd").value), prompt = $("#ns-prompt").value.trim(); if (!cwd || !prompt) { (cwd ? $("#ns-prompt") : $("#ns-cwd")).focus(); return; } prefs.lastCwd = tilde(cwd); save(); send({ type: "start", cwd, prompt }); $("#ns-prompt").value = ""; };
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
function renderSessHead() {
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
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); done(true); } if (e.key === "Escape") done(false); }); inp.addEventListener("blur", () => done(true)); }
$("#sess-title").onclick = () => { const el = $("#sess-title"); editTitle(el, el.textContent, (v) => { el.textContent = v; send({ type: "title", sessionId: openId, title: v }); }); };
$("#sess-title").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#sess-title").click(); });
$("#show-steps").onchange = (e) => { prefs.showSteps = e.target.checked; save(); $("#transcript").classList.toggle("no-steps", !prefs.showSteps); };
$("#sess-stop").onclick = () => send({ type: "interrupt", sessionId: openId });
function closeWithUndo(x) { // no dialog: it closes, and one line offers Undo
  send({ type: "end", sessionId: x.sessionId }); const u = $("#undo"); $("#undo-text").textContent = `Closed "${x.title.slice(0, 40)}". It stays on disk.`; u.hidden = false;
  $("#undo-btn").onclick = () => { send({ type: "resume", sessionId: x.sessionId, cwd: x.cwd }); u.hidden = true; }; setTimeout(() => { u.hidden = true; }, 12000); }
$("#sess-end").onclick = () => { const x = list.find(s => s.sessionId === openId) || { sessionId: openId, title: meta?.title || "", cwd: meta?.cwd }; closeWithUndo(x); location.hash = ""; };
$("#sess-park").onclick = () => { $("#park").hidden = !$("#park").hidden; if (!$("#park").hidden) $("#park-note").focus(); };
$("#park-save").onclick = () => { send({ type: "note", sessionId: openId, note: $("#park-note").value }); $("#park").hidden = true; };
$("#park-clear").onclick = () => { $("#park-note").value = ""; send({ type: "note", sessionId: openId, note: "" }); $("#park").hidden = true; };
$("#park-note").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("#park-save").click(); } });

// Claude's reply as a document. A line of --- splits the answer from the details, per the writing rules in CLAUDE.md.
const mdOpts = { gfm: true, breaks: false };
function renderMd(t) { try { const html = marked.parse(t.replace(/<\/?(script|style|iframe)[^>]*>/gi, ""), mdOpts); return html; } catch { return `<p>${esc(t)}</p>`; } }
const STATUS_RE = /^\s*(Done|Partly done|Blocked|Found|Question|Working|Failed|Not done)\b[.:!]?/i;
const STATUS_CLASS = { done: "s-done", "partly done": "s-part", blocked: "s-block", found: "s-found", question: "s-ask", working: "s-work", failed: "s-block", "not done": "s-block" };
const STATUS_ICON = { "s-done": "circle-check", "s-part": "circle-dashed", "s-block": "circle-x", "s-found": "search", "s-ask": "circle-help", "s-work": "orbit" };
function docHtml(text, sid) { // sid: when given, numbered choices under a Question line become click-to-answer
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
  const lastText = [...visible].reverse().find(e => e.kind === "text");
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
$("#composer").onsubmit = (e) => { e.preventDefault(); const t = $("#reply").value.trim(); if (!t || !openId) return; const p = meta?.pending; if (p?.kind === "permission") send({ type: "answer", sessionId: openId, requestId: p.id, decision: { behavior: "deny", message: t } }); else send({ type: "send", sessionId: openId, text: t }); $("#reply").value = ""; };
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
