// Pull requests: every open PR of hers across GitHub, in plain words, with what needs her on top.
// `gh search` (one call, all repos) every 5 minutes; `gh pr view` per PR only when it changed or is in play.
// State lives in ~/.config/stillroom/prs.json. The Slack channel per repo lives in repos.json.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fetchTickets, jiraReady, ticketsReady, QA_STATUSES, transitionTicket, type Ticket } from "./jira";

const FILE = process.env.ND_PRS ?? join(homedir(), ".config", "stillroom", "prs.json");
const REPOS_FILE = join(homedir(), ".config", "stillroom", "repos.json");
const SEARCH_MS = 5 * 60_000, VIEW_STALE_MS = 2 * 60_000, SHELF_IDLE_DAYS = 21, SHELF_DRAFT_DAYS = 14;
const TICKET_RE = /\b(STORY|D|VDC|PROJ|GOAL|TD)-(\d{1,6})\b/gi;
const STOP = new Set(["with", "the", "and", "for", "from", "that", "this", "into", "onto", "plugin", "added", "written", "run", "ran", "used", "using", "ticket", "steps", "step"]);

export interface ChecklistItem { item: string; done: boolean; auto: boolean; skip?: string; action?: "review" | "ask" | "send" | "cmd"; instruction?: string; gate?: boolean }
/** One run of the ship checklist: steps in order, each by its own method, stopping at a failure or a step marked "ask". */
export interface ShipRun { startedAt: number; status: "running" | "needs-you" | "failed" | "done" | "stopped"; step?: string; why?: string; confirmed: string[]; log: { item: string; result: string; at: number }[]; busySince?: number }
const TEST_RE = /(^|\/)(__tests__|tests?|spec|e2e|cypress)\/|\.(test|spec)\.[cm]?[jt]sx?$|_test\.(go|py|rb)$|(^|\/)test_[^/]*\.py$|Tests?\.(cs|java|kt|swift)$/i;
export type PrState = "changes" | "checks-failing" | "conflict" | "ready" | "approved-qa" | "claude-approved" | "claude-reviewing" | "checks-running" | "review" | "draft" | "shelf";
export const PR_WORDS: Record<PrState, string> = { changes: "Changes asked for", "checks-failing": "Checks failing", conflict: "Merge conflict", ready: "Ready to merge", "approved-qa": "Approved, in QA", "claude-approved": "Approved by Claude", "claude-reviewing": "Claude is reviewing", "checks-running": "Checks running", review: "Waiting on review", draft: "Draft", shelf: "Shelved" };
export const NEEDS_YOU: PrState[] = ["changes", "checks-failing", "conflict", "ready"];

export interface Pr {
  key: string; repo: string; short: string; number: number; title: string; url: string; isDraft: boolean; updatedAt: number;
  headRef?: string; reviewDecision?: string; mergeable?: string; mergeState?: string;
  checks?: { name: string; ok: boolean | null }[]; reviewers?: { login: string; state: string }[];
  claudeVerdict?: "approve" | "changes" | null; claudeAt?: number; reviewing?: boolean;
  tickets: string[]; sessionId?: string; sessionTitle?: string;
  slack?: { channel: string; askedAt: number; permalink?: string; nudgedAt?: number; note?: string };
  requested?: string[]; // reviewers GitHub is waiting on
  done?: Record<string, boolean>; skip?: Record<string, string>; checklist?: ChecklistItem[];
  files?: string[]; testsTouched?: string[]; warn?: string; // changed files from GitHub; test files among them when the task was not about tests
  run?: ShipRun; // the checklist running itself (QUEUE item 1)
  ticketMoves?: { step: string; to: string; at: number; result: string }[]; // what the app did to the ticket as the PR moved // the repo's ship checklist, with what the app can tick itself
  prio?: 1 | 2 | 3; // hers; missing means the project's, else Med
  step?: { n: number; of: number; name: string }; // where it is on the road to merge: Draft, Claude review, Review, QA, Merge
  alert?: string; seen?: string[]; // a new human review on a watched PR brings it back once ("Ilya approved"); Keep waiting clears it
  watched?: boolean; // she handed this one off: it shows under Waiting on others and comes back to her; everything else stays on the Pull requests screen
  viewedAt?: number; firstSeen: number; shelved?: boolean; state: PrState; needsYou: boolean; reason: string; error?: string;
  ticket?: Ticket; mismatch?: string; // the branch's ticket, and one line when the ticket and the PR disagree
}
interface Store { prs: Record<string, Pr>; gone?: Record<string, Pr & { fate: "merged" | "closed"; by?: string; goneAt: number }>; searchedAt: number; tickets?: Record<string, Ticket>; ticketsAt?: number; jiraError?: string }
const JIRA_MS = 15 * 60_000;

export class Prs {
  private s: Store = { prs: {}, searchedAt: 0 };
  private busy = false; private timer: any;
  repos: Record<string, { channel?: string; reviewers?: string[]; approvers?: string[]; qa?: boolean; base?: string; checklist?: string[]; ticketSteps?: Record<string, string> }> = {}; // base: the branch a ticket worktree starts from, when PRs do not land on the GitHub default // ticketSteps: step name -> Jira status to move the ticket to when the PR reaches it // per repo: the Slack channel, who to ask, who counts as the approval, whether QA signs off after
  onGone: (pr: Pr, how: "merged" | "closed", by?: string) => void = () => {};
  /** Set by the server: runs one checklist step. Returns "done", "started" (the app will see it finish), "needs-you: why", or "error: why". */
  onRunStep: (pr: Pr, c: ChecklistItem) => Promise<string> = async () => "error: no runner";
  onRunDone: (pr: Pr, ok: boolean, why: string) => void = () => {};
  /** Ship it: the checklist runs itself from the first open step. */
  shipRun(key: string) { const p = this.s.prs[key]; if (!p || !p.checklist?.length) return false; if (p.run?.status === "running" || p.run?.status === "needs-you") return false;
    p.run = { startedAt: Date.now(), status: "running", confirmed: [], log: [] };
    if (p.testsTouched?.length) { p.run.status = "needs-you"; p.run.step = "Tests changed"; p.run.why = `Tests changed: ${p.testsTouched.slice(0, 4).join(", ")}${p.testsTouched.length > 4 ? "…" : ""}. Say go if that was the task.`; }
    this.derive(p); this.save(); this.onChange(); if (p.run.status === "running") this.advanceRun(p); return true; }
  /** Her go on a step that waited for her. */
  shipGo(key: string) { const p = this.s.prs[key]; const r = p?.run; if (!p || !r || r.status !== "needs-you") return false; if (r.step) { r.confirmed.push(r.step); const c = p.checklist?.find(x => x.item === r.step); if (c && !c.action) p.done = { ...(p.done || {}), [c.item]: true }; } /* her go on a step with no method is her tick */ r.status = "running"; r.step = undefined; r.why = undefined; r.busySince = undefined; this.derive(p); this.save(); this.onChange(); this.advanceRun(p); return true; }
  shipStop(key: string) { const p = this.s.prs[key]; const r = p?.run; if (!p || !r || r.status === "done") return false; r.status = "stopped"; r.why = "Stopped by her."; r.busySince = undefined; this.derive(p); this.save(); this.onChange(); return true; }
  /** A step failed (the session said so, or a method errored). The run stops here and needs her. */
  shipFail(key: string, why: string) { const p = this.s.prs[key]; const r = p?.run; if (!p || !r || !["running", "needs-you"].includes(r.status)) return false; r.status = "failed"; r.why = why; r.busySince = undefined; r.log.push({ item: r.step || "", result: `failed: ${why}`, at: Date.now() }); this.onRunDone(p, false, `stopped at "${r.step}": ${why}`); this.derive(p); this.save(); this.onChange(); return true; }
  private advancing = new Set<string>();
  private async advanceRun(p: Pr) {
    const r = p.run; if (!r || r.status !== "running" || this.advancing.has(p.key)) return;
    const next = (p.checklist || []).find(c => !c.done && !c.skip);
    if (!next) { r.status = "done"; r.step = undefined; r.busySince = undefined; r.why = `All ${p.checklist?.length} steps done.`; this.onRunDone(p, true, r.why); this.derive(p); this.save(); this.onChange(); return; }
    if (r.step === next.item && r.busySince) { if (Date.now() - r.busySince > 45 * 60e3) this.shipFail(p.key, `No word on "${next.item}" for 45 minutes.`); return; } // still waiting on this step
    if (next.gate && !r.confirmed.includes(next.item)) { r.status = "needs-you"; r.step = next.item; r.why = `"${next.item}" is marked ask: it waits for your go.`; this.derive(p); this.save(); this.onChange(); return; }
    r.step = next.item; r.busySince = Date.now(); this.advancing.add(p.key); this.save(); this.onChange();
    try { const res = await this.onRunStep(p, next); r.log.push({ item: next.item, result: res, at: Date.now() });
      if (res.startsWith("error")) { this.advancing.delete(p.key); this.shipFail(p.key, res.replace(/^error:?\s*/, "")); return; }
      if (res.startsWith("needs-you")) { r.status = "needs-you"; r.why = res.replace(/^needs-you:?\s*/, "") || `"${next.item}" needs you.`; r.busySince = undefined; }
      else if (res === "done") { p.done = { ...(p.done || {}), [next.item]: true }; r.busySince = undefined; }
      // "started": the step finishes on its own (a verdict lands, the session calls ship_step) and derive moves the run on
    } catch (e: any) { this.advancing.delete(p.key); this.shipFail(p.key, String(e?.message || e)); return; }
    finally { this.advancing.delete(p.key); }
    this.derive(p); this.save(); this.onChange();
  }
  transcript: ((pr: Pr) => string) | null = null; // set by the server: text of the session that made the PR // set by the server: a PR that left the list
  constructor(private onChange: () => void, private link: (pr: Pr) => { sessionId: string; title: string } | null) {
    try { this.s = JSON.parse(readFileSync(FILE, "utf8")); } catch {}
    try { this.repos = JSON.parse(readFileSync(REPOS_FILE, "utf8")); } catch {}
    for (const p of Object.values(this.s.prs)) { p.reviewing = false; this.derive(p); }
  }
  jira() { return { connected: jiraReady(), error: this.s.jiraError, at: this.s.ticketsAt }; }
  list(): Pr[] { return Object.values(this.s.prs).sort((a, b) => (b.needsYou ? 1 : 0) - (a.needsYou ? 1 : 0) || a.updatedAt - b.updatedAt); }
  get(key: string) { return this.s.prs[key]; }
  setChannel(repo: string, channel: string) { this.setRepo(repo, { channel }); }
  setCheck(key: string, item: string, on: boolean) { const p = this.s.prs[key]; if (!p) return false; p.done = { ...(p.done || {}), [item]: on }; if (p.skip) delete p.skip[item]; this.derive(p); this.save(); this.onChange(); return true; }
  /** A step that does not apply to this PR, with why. Empty why clears it. */
  setSkip(key: string, item: string, why: string) { const p = this.s.prs[key]; if (!p) return false; p.skip = { ...(p.skip || {}) }; if (why) p.skip[item] = why; else delete p.skip[item]; this.derive(p); this.save(); this.onChange(); return true; }
  /** The PR a session is on, by its id. */
  forSession(sid: string) { return Object.values(this.s.prs).find(p => p.sessionId === sid); }
  setRepo(repo: string, cfg: Partial<{ channel: string; reviewers: string[]; approvers: string[]; qa: boolean; base: string; checklist: string[] }>) { this.repos[repo] = { ...(this.repos[repo] || {}), ...cfg }; try { mkdirSync(dirname(REPOS_FILE), { recursive: true }); writeFileSync(REPOS_FILE, JSON.stringify(this.repos, null, 1)); } catch {} for (const p of Object.values(this.s.prs)) if (p.repo === repo) this.derive(p); this.save(); this.onChange(); }
  /** A repo is set up when it has a channel and reviewers to ask. */
  configured(repo: string) { const r = this.repos[repo]; return !!(r?.channel && r?.reviewers?.length); }
  start() { this.tick(); this.timer = setInterval(() => this.tick(), 60_000); }
  stop() { clearInterval(this.timer); }

  /** Marks a PR as under Claude's review while the loop runs; refreshes when it ends. */
  markReviewing(key: string, on: boolean) { const p = this.s.prs[key]; if (!p) return; p.reviewing = on; this.derive(p); this.save(); this.onChange(); if (!on) this.view(p).then(() => { this.save(); this.onChange(); }); }
  setPrio(key: string, prio: number) { const p = this.s.prs[key]; if (!p) return false; p.prio = ([1, 2, 3].includes(prio) ? prio : undefined) as any; this.save(); this.onChange(); return true; }
  setWatch(key: string, on: boolean) { const p = this.s.prs[key]; if (!p) return false; p.watched = on; p.alert = undefined; p.seen = reviewMarks(p); this.derive(p); this.save(); this.onChange(); return true; }
  /** She saw the review; back to waiting. */
  keepWaiting(key: string) { const p = this.s.prs[key]; if (!p) return false; p.alert = undefined; p.seen = reviewMarks(p); this.derive(p); this.save(); this.onChange(); return true; }
  /** The PR a session was on, if any. */
  bySession(sessionId: string) { return Object.values(this.s.prs).find(p => p.sessionId === sessionId); }
  noteSlack(key: string, slack: Pr["slack"]) { const p = this.s.prs[key]; if (!p) return; p.slack = { ...(p.slack || { channel: "", askedAt: 0 }), ...slack }; this.derive(p); this.save(); this.onChange(); }

  private async tick() {
    if (this.busy) return; this.busy = true;
    try {
      if (Date.now() - this.s.searchedAt > SEARCH_MS) await this.search();
      const due = Object.values(this.s.prs).filter(p => !p.viewedAt || p.updatedAt > p.viewedAt || (p.state === "checks-running" && Date.now() - p.viewedAt > VIEW_STALE_MS)).slice(0, 8);
      for (const p of due) await this.view(p);
      if (ticketsReady() && (Date.now() - (this.s.ticketsAt ?? 0) > JIRA_MS || due.length)) await this.tickets();
      for (const p of Object.values(this.s.prs)) { p.ticket = p.tickets.map(k => this.s.tickets?.[k]).find(Boolean); const l = this.link(p); if (l) { p.sessionId = l.sessionId; p.sessionTitle = l.title; } this.derive(p); }
      this.save(); this.onChange();
    } catch (e: any) { appendFileSync(join(homedir(), ".config", "stillroom", "prs.log"), `${new Date().toISOString()} ${e?.message ?? e}\n`); }
    finally { this.busy = false; }
  }
  /** One call, all repos. */
  private async search() {
    const out = await run(["gh", "search", "prs", "--author", "@me", "--state", "open", "--json", "number,title,repository,isDraft,updatedAt,url", "--limit", "100"]);
    if (out.error) { for (const p of Object.values(this.s.prs)) p.error = out.error; return; }
    const rows = JSON.parse(out.text) as any[]; const seen = new Set<string>();
    for (const r of rows) { const repo = r.repository.nameWithOwner as string; const key = `${repo}#${r.number}`; seen.add(key);
      const cur = this.s.prs[key] ?? { key, repo, short: `${repo.split("/")[1]} #${r.number}`, number: r.number, title: "", url: r.url, isDraft: false, updatedAt: 0, tickets: [], firstSeen: Date.now(), state: "review" as PrState, needsYou: false, reason: "" };
      cur.title = r.title; cur.isDraft = !!r.isDraft; cur.updatedAt = Date.parse(r.updatedAt); cur.url = r.url; cur.error = undefined; this.s.prs[key] = cur; }
    for (const key of Object.keys(this.s.prs)) if (!seen.has(key)) { const gone = this.s.prs[key]; delete this.s.prs[key]; this.fate(gone); } // merged or closed PRs keep a record under gone, for the scorer // merged or closed: it leaves the list, and the ledger hears how
    this.s.searchedAt = Date.now();
  }
  private async fate(pr: Pr) { try { const out = await run(["gh", "pr", "view", String(pr.number), "-R", pr.repo, "--json", "state,mergedBy"]); if (out.error) return; const j = JSON.parse(out.text); const fate = j.state === "MERGED" ? "merged" : "closed"; this.s.gone = this.s.gone || {}; this.s.gone[pr.key] = { ...pr, fate, by: j.mergedBy?.login, goneAt: Date.now() }; const keys = Object.keys(this.s.gone); if (keys.length > 300) for (const k of keys.slice(0, keys.length - 300)) delete this.s.gone[k]; this.save(); this.onGone(pr, fate, j.mergedBy?.login); } catch {} }
  /** Ticket status for every key on a live PR; one Jira search. */
  private async tickets() {
    const keys = Object.values(this.s.prs).filter(p => !p.shelved).flatMap(p => p.tickets);
    const r = await fetchTickets(keys); this.s.jiraError = r.error; if (r.error) return;
    this.s.tickets = { ...(this.s.tickets || {}) }; for (const t of r.tickets) this.s.tickets[t.key] = t; this.s.ticketsAt = Date.now();
  }
  /** Re-read one PR soon (after she acted on it). */
  refreshOne(key: string) { const p = this.s.prs[key]; if (p) { p.viewedAt = 0; setTimeout(() => this.tick(), 1500); } }
  /** Force a ticket refresh now (after the token lands). */
  async refreshTickets() { this.s.ticketsAt = 0; await this.tick(); }
  /** Per PR: reviews, checks, mergeability, Claude's verdict, ticket keys. */
  private async view(p: Pr) {
    const out = await run(["gh", "pr", "view", String(p.number), "-R", p.repo, "--json", "reviewDecision,mergeable,mergeStateStatus,headRefName,statusCheckRollup,reviews,comments,body,isDraft,updatedAt,reviewRequests,files"]);
    p.viewedAt = Date.now(); if (out.error) { p.error = out.error; return; }
    const j = JSON.parse(out.text);
    p.reviewDecision = j.reviewDecision || ""; p.mergeable = j.mergeable; p.mergeState = j.mergeStateStatus; p.headRef = j.headRefName; p.isDraft = !!j.isDraft; p.updatedAt = Date.parse(j.updatedAt) || p.updatedAt;
    const seenChecks = new Map<string, boolean | null>();
    for (const c of j.statusCheckRollup || []) { const name = c.name || c.context || "check"; const st = (c.conclusion || c.state || c.status || "").toUpperCase(); const ok = ["SUCCESS", "NEUTRAL", "SKIPPED"].includes(st) ? true : ["FAILURE", "ERROR", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE"].includes(st) ? false : null; const prev = seenChecks.get(name); seenChecks.set(name, prev === false ? false : ok === null && prev === true ? true : ok); }
    p.checks = [...seenChecks].map(([name, ok]) => ({ name, ok }));
    p.requested = (j.reviewRequests || []).map((r: any) => r.login || r.name).filter(Boolean);
    p.reviewers = (j.reviews || []).filter((r: any) => r.author?.login && !/claude-pr-loop/.test(r.body || "") && r.author.login !== "github-actions").map((r: any) => ({ login: r.author.login, state: r.state }));
    let verdict: Pr["claudeVerdict"] = null, at = 0;
    for (const x of [...(j.reviews || []), ...(j.comments || [])]) { const b = x.body || ""; if (!/claude-pr-loop/.test(b)) continue; const t = Date.parse(x.submittedAt || x.createdAt || "") || 0; if (t < at) continue; at = t; verdict = /Review:\s*Approved/i.test(b) || x.state === "APPROVED" ? "approve" : "changes"; }
    p.claudeVerdict = verdict; p.claudeAt = at || undefined;
    const keys = new Set<string>(); for (const src of [p.headRef || "", p.title, (j.body || "").slice(0, 4000)]) for (const m of src.matchAll(TICKET_RE)) keys.add(`${m[1].toUpperCase()}-${m[2]}`); // the branch name is the ticket, so it comes first
    p.tickets = [...keys].slice(0, 4);
    p.files = (j.files || []).map((f: any) => String(f.path)).filter(Boolean).slice(0, 400);
    const aboutTests = /\btests?\b|\bspec\b|coverage|flaky/i.test(p.title); p.testsTouched = aboutTests ? [] : (p.files || []).filter(f => TEST_RE.test(f));
  }
  private derive(p: Pr) {
    const days = (t?: number) => t ? (Date.now() - t) / 864e5 : 0;
    const failing = (p.checks || []).filter(c => c.ok === false); const running = (p.checks || []).some(c => c.ok === null);
    const human = (p.reviewers || []).filter(r => r.state === "APPROVED" || r.state === "CHANGES_REQUESTED");
    const latest = new Map<string, string>(); for (const r of human) latest.set(r.login, r.state); // each reviewer's last word
    const words = [...latest.values()]; let decision = p.reviewDecision || (words.includes("CHANGES_REQUESTED") ? "CHANGES_REQUESTED" : words.includes("APPROVED") ? "APPROVED" : "");
    // a repo's own rule: named reviewers count as the approval, and QA signs off after them
    const rule = this.repos[p.repo] || {}; const approvedBy = [...latest].filter(([, s]) => s === "APPROVED").map(([l]) => l);
    const named = rule.approvers?.length ? approvedBy.filter(l => rule.approvers!.includes(l)) : []; const others = approvedBy.filter(l => !named.includes(l));
    if (named.length && !words.includes("CHANGES_REQUESTED")) decision = "APPROVED";
    const qaPending = !!rule.qa && named.length > 0 && others.length === 0;
    p.shelved = p.isDraft ? days(p.updatedAt) > SHELF_DRAFT_DAYS : days(p.updatedAt) > SHELF_IDLE_DAYS;
    let st: PrState, why = "";
    if (p.reviewing) { st = "claude-reviewing"; why = "claude-pr-loop is running on it."; }
    else if (p.shelved) { st = "shelf"; why = p.isDraft ? "A draft with no push in two weeks." : "Nothing has moved in three weeks."; }
    else if (p.isDraft) { st = "draft"; why = "Still a draft."; }
    else if (p.mergeable === "CONFLICTING") { st = "conflict"; why = "It conflicts with its base branch."; }
    else if (failing.length) { st = "checks-failing"; why = `${failing.map(c => c.name).join(", ")} failed.`; }
    else if (decision === "CHANGES_REQUESTED") { st = "changes"; why = `Changes asked for.`; }
    else if (decision === "APPROVED" && qaPending) { st = "approved-qa"; why = `${named.join(", ")} approved. QA signs off next${p.tickets.length ? `; ${p.tickets[0]} should be in QA` : ""}.`; }
    else if (decision === "APPROVED" && p.mergeable === "MERGEABLE" && !running) { st = "ready"; why = `Approved${approvedBy.length ? ` by ${approvedBy.join(", ")}` : ""} and green. Merging finishes it.`; }
    else if (running) { st = "checks-running"; why = "Checks are still running."; }
    else if (p.claudeVerdict === "approve" && !human.length) { st = "claude-approved"; why = "Claude approved it. Nobody else has reviewed yet."; }
    else { st = "review"; why = p.reviewDecision === "REVIEW_REQUIRED" && words.includes("APPROVED") ? "GitHub still wants a review; an earlier approval no longer counts." : p.slack?.askedAt ? `Asked in ${p.slack.channel}${days(p.slack.askedAt) >= 1 ? ", a day ago or more" : ""}.` : "Waiting on a reviewer."; }
    p.mismatch = undefined; const t = p.ticket;
    if (t && st === "approved-qa") { if (QA_STATUSES.includes(t.status)) why = `${named.join(", ")} approved. ${t.key} is ${t.status}.`; else { p.mismatch = `${t.key} is still ${t.status}`; why = `${named.join(", ")} approved, but ${t.key} is still ${t.status}, not in QA.`; } }
    else if (t && st === "ready" && !["Done", "Closed", "Deploy", "In Test", "Ready for QA"].includes(t.status)) p.mismatch = `${t.key} is ${t.status}`;
    else if (t && (t.status === "Done" || t.status === "Closed") && !["ready", "shelf"].includes(st)) p.mismatch = `${t.key} says ${t.status}`;
    if (p.watched) { const now = reviewMarks(p); const fresh = now.filter(m => !(p.seen || []).includes(m)); if (fresh.length) { p.alert = fresh.map(m => { const [l, s] = m.split(":"); return `${l} ${s === "APPROVED" ? "approved" : "asked for changes"}`; }).join(", "); } }
    // the road to merge, as steps: Draft, Claude review, Review, (QA), Merge
    // Draft, In progress (open, Claude not yet happy), Claude approved (no person yet), Review (a person has), QA (where the repo has it), Merge
    const names = ["Draft", "Before review", "Claude approved", "Review asked", "Reviewed", ...(rule.qa ? ["In QA"] : []), "Ready to merge"]; const of = names.length;
    const asked = !!(p.requested?.length || p.slack?.askedAt);
    let n = p.isDraft ? 1 : p.claudeVerdict !== "approve" ? 2 : human.length ? 5 : asked ? 4 : 3; if (st === "approved-qa") n = names.indexOf("In QA") + 1; if (st === "ready") n = of;
    p.step = { n, of, name: names[n - 1] };
    // the repo's checklist; items the app can see for itself are ticked for her
    // the checklist: "item | instruction" lines; the app ticks what it can see, the session can mark a step as not applying, her ticks win
    const seen = (this.transcript ? this.transcript(p) : "").toLowerCase();
    p.checklist = (rule.checklist || []).map(raw => { const [itemRaw, howRaw, askRaw] = raw.split("|").map(s => s.trim()); const item = itemRaw; const t = item.toLowerCase(); let auto: boolean | null = null; const gate = /^ask/i.test(askRaw || "") || undefined;
      // how to run it: "review" (Claude review), "ask for review", "cmd: <shell>", or words for the session that made the PR
      let instr = howRaw || undefined; let action: ChecklistItem["action"] = instr ? "send" : undefined; const howT = (howRaw || "").toLowerCase();
      if (/^(claude )?review$/.test(howT) || /^cmd:/.test(howT) || /^ask( for)? review$/.test(howT)) { action = /^cmd:/.test(howT) ? "cmd" : /^ask/.test(howT) ? "ask" : "review"; instr = /^cmd:/.test(howT) ? howRaw!.replace(/^cmd:\s*/i, "") : undefined; }
      const wantsGh = /github/.test(t), wantsSlack = /slack/.test(t);
      if (action === "review" || (!howRaw && /pr-loop|claude review|claude-pr/.test(t))) { auto = !!p.claudeVerdict; action = "review"; }
      else if (action === "ask" || (!howRaw && /reviewer|ask.*review|request.*review|slack/.test(t))) { auto = (wantsGh || !wantsSlack ? !!p.requested?.length : true) && (wantsSlack || !wantsGh ? !!p.slack?.askedAt : true) && !!(p.requested?.length || p.slack?.askedAt); action = "ask"; }
      else if (/\bqa\b/.test(t) && rule.qa && !/step|add|writ/.test(t)) auto = st === "approved-qa" || st === "ready";
      else if (/draft/.test(t)) auto = !p.isDraft;
      else if (seen) { const words = t.replace(/[^a-z0-9 -]/g, " ").split(/\s+/).filter(w => w.length > 3 && !STOP.has(w)); const hits = words.filter(w => seen.includes(w) || seen.includes(w.replace(/-/g, ""))).length; if (words.length && hits / words.length >= 0.6) auto = true; }
      const hers = p.done && Object.prototype.hasOwnProperty.call(p.done, item) ? p.done[item] : undefined; const skip = p.skip?.[item];
      return { item, done: hers !== undefined ? hers : !!auto, auto: auto !== null && hers === undefined, skip, action, instruction: instr, gate }; });
    p.warn = p.testsTouched?.length ? `Tests changed: ${p.testsTouched.slice(0, 3).join(", ")}${p.testsTouched.length > 3 ? ` and ${p.testsTouched.length - 3} more` : ""}` : undefined;
    // the ticket follows the PR: when the step reaches one she mapped, the ticket moves
    const steps = rule.ticketSteps || (rule.qa ? { "Review asked": "Code Review", "In QA": "Ready for QA" } : {}); const want = steps[p.step.name] || (p.step.name === "In QA" ? steps["QA"] : p.step.name === "Before review" ? steps["In progress"] : p.step.name === "Reviewed" ? steps["Review"] : p.step.name === "Ready to merge" ? steps["Merge"] : undefined);
    if (want && p.ticket && !["Done", "Closed"].includes(p.ticket.status) && p.ticket.status.toLowerCase() !== want.toLowerCase() && !(p.ticketMoves || []).some(m => m.step === p.step.name && m.to === want && Date.now() - m.at < 6 * 3600e3)) {
      const key = p.ticket.key, stepName = p.step.name; p.ticketMoves = [...(p.ticketMoves || []), { step: stepName, to: want, at: Date.now(), result: "moving" }];
      transitionTicket(key, want).then(r => { const mv = (p.ticketMoves || []).find(m => m.step === stepName && m.to === want); if (mv) mv.result = r === "ok" ? "moved" : r; if (r === "ok" && p.ticket) p.ticket.status = want; this.save(); this.onChange(); }); }
    p.state = st; p.reason = p.alert ? `${p.alert}. ${why}` : why; p.needsYou = (NEEDS_YOU.includes(st) || !!p.alert) && !p.shelved && !p.sessionId;
    if (p.sessionId && NEEDS_YOU.includes(st)) p.reason += " A session is on it.";
    const r = p.run;
    if (r && r.status === "running" && r.step) { const cur = p.checklist?.find(c => c.item === r.step);
      if (cur?.action === "review" && p.claudeVerdict === "changes" && (p.claudeAt || 0) >= (r.busySince || r.startedAt)) setTimeout(() => this.shipFail(p.key, "Claude asked for changes. Read its review, then Ship it again."), 10);
      else if (!cur || cur.done || cur.skip) { r.busySince = undefined; setTimeout(() => this.advanceRun(p), 50); } }
    if (r && (r.status === "needs-you" || r.status === "failed")) { p.needsYou = true; p.reason = `Ship run ${r.status === "failed" ? "stopped" : "needs you"}: ${r.why || r.step || ""} ${p.reason}`.trim(); }
    else if (r && r.status === "running") p.reason = `Shipping, step "${r.step || "…"}". ${p.reason}`;
  }
  private save() { try { mkdirSync(dirname(FILE), { recursive: true }); writeFileSync(FILE + ".tmp", JSON.stringify(this.s, null, 1)); renameSync(FILE + ".tmp", FILE); } catch {} }
}

/** Each human reviewer's last word, as "login:STATE". */
function reviewMarks(p: Pr): string[] { const last = new Map<string, string>(); for (const r of p.reviewers || []) if (r.state === "APPROVED" || r.state === "CHANGES_REQUESTED") last.set(r.login, r.state); return [...last].map(([l, s]) => `${l}:${s}`).sort(); }
async function run(cmd: string[]): Promise<{ text: string; error?: string }> {
  try { const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe", env: { ...process.env, GH_PROMPT_DISABLED: "1" } }); const text = await new Response(proc.stdout).text(); const err = await new Response(proc.stderr).text(); const code = await proc.exited;
    if (code !== 0) return { text: "", error: /not logged|auth login/i.test(err) ? "GitHub not connected. Run gh auth login." : /rate limit/i.test(err) ? "GitHub rate limit hit. It will retry." : err.trim().split("\n")[0] || `gh failed (${code})` };
    return { text }; } catch (e: any) { return { text: "", error: e?.message ?? String(e) }; }
}
