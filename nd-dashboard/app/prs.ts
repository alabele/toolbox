// Pull requests: every open PR of hers across GitHub, in plain words, with what needs her on top.
// `gh search` (one call, all repos) every 5 minutes; `gh pr view` per PR only when it changed or is in play.
// State lives in ~/.config/stillroom/prs.json. The Slack channel per repo lives in repos.json.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fetchTickets, jiraReady, QA_STATUSES, type Ticket } from "./jira";

const FILE = process.env.ND_PRS ?? join(homedir(), ".config", "stillroom", "prs.json");
const REPOS_FILE = join(homedir(), ".config", "stillroom", "repos.json");
const SEARCH_MS = 5 * 60_000, VIEW_STALE_MS = 2 * 60_000, SHELF_IDLE_DAYS = 21, SHELF_DRAFT_DAYS = 14;
const TICKET_RE = /\b(STORY|D|VDC|PROJ)-(\d{1,6})\b/gi;

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
  viewedAt?: number; firstSeen: number; shelved?: boolean; state: PrState; needsYou: boolean; reason: string; error?: string;
  ticket?: Ticket; mismatch?: string; // the branch's ticket, and one line when the ticket and the PR disagree
}
interface Store { prs: Record<string, Pr>; searchedAt: number; tickets?: Record<string, Ticket>; ticketsAt?: number; jiraError?: string }
const JIRA_MS = 15 * 60_000;

export class Prs {
  private s: Store = { prs: {}, searchedAt: 0 };
  private busy = false; private timer: any;
  repos: Record<string, { channel?: string; approvers?: string[]; qa?: boolean }> = {}; // per repo: the Slack channel, who counts as the reviewer, whether QA signs off after
  constructor(private onChange: () => void, private link: (pr: Pr) => { sessionId: string; title: string } | null) {
    try { this.s = JSON.parse(readFileSync(FILE, "utf8")); } catch {}
    try { this.repos = JSON.parse(readFileSync(REPOS_FILE, "utf8")); } catch {}
    for (const p of Object.values(this.s.prs)) { p.reviewing = false; this.derive(p); }
  }
  jira() { return { connected: jiraReady(), error: this.s.jiraError, at: this.s.ticketsAt }; }
  list(): Pr[] { return Object.values(this.s.prs).sort((a, b) => (b.needsYou ? 1 : 0) - (a.needsYou ? 1 : 0) || a.updatedAt - b.updatedAt); }
  get(key: string) { return this.s.prs[key]; }
  setChannel(repo: string, channel: string) { this.repos[repo] = { ...(this.repos[repo] || {}), channel }; try { mkdirSync(dirname(REPOS_FILE), { recursive: true }); writeFileSync(REPOS_FILE, JSON.stringify(this.repos, null, 1)); } catch {} }
  start() { this.tick(); this.timer = setInterval(() => this.tick(), 60_000); }
  stop() { clearInterval(this.timer); }

  /** Marks a PR as under Claude's review while the loop runs; refreshes when it ends. */
  markReviewing(key: string, on: boolean) { const p = this.s.prs[key]; if (!p) return; p.reviewing = on; this.derive(p); this.save(); this.onChange(); if (!on) this.view(p).then(() => { this.save(); this.onChange(); }); }
  noteSlack(key: string, slack: Pr["slack"]) { const p = this.s.prs[key]; if (!p) return; p.slack = { ...(p.slack || { channel: "", askedAt: 0 }), ...slack }; this.derive(p); this.save(); this.onChange(); }

  private async tick() {
    if (this.busy) return; this.busy = true;
    try {
      if (Date.now() - this.s.searchedAt > SEARCH_MS) await this.search();
      const due = Object.values(this.s.prs).filter(p => !p.viewedAt || p.updatedAt > p.viewedAt || (p.state === "checks-running" && Date.now() - p.viewedAt > VIEW_STALE_MS)).slice(0, 8);
      for (const p of due) await this.view(p);
      if (jiraReady() && (Date.now() - (this.s.ticketsAt ?? 0) > JIRA_MS || due.length)) await this.tickets();
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
    for (const key of Object.keys(this.s.prs)) if (!seen.has(key)) delete this.s.prs[key]; // merged or closed: it leaves the list
    this.s.searchedAt = Date.now();
  }
  /** Ticket status for every key on a live PR; one Jira search. */
  private async tickets() {
    const keys = Object.values(this.s.prs).filter(p => !p.shelved).flatMap(p => p.tickets);
    const r = await fetchTickets(keys); this.s.jiraError = r.error; if (r.error) return;
    this.s.tickets = { ...(this.s.tickets || {}) }; for (const t of r.tickets) this.s.tickets[t.key] = t; this.s.ticketsAt = Date.now();
  }
  /** Force a ticket refresh now (after the token lands). */
  async refreshTickets() { this.s.ticketsAt = 0; await this.tick(); }
  /** Per PR: reviews, checks, mergeability, Claude's verdict, ticket keys. */
  private async view(p: Pr) {
    const out = await run(["gh", "pr", "view", String(p.number), "-R", p.repo, "--json", "reviewDecision,mergeable,mergeStateStatus,headRefName,statusCheckRollup,reviews,comments,body,isDraft,updatedAt"]);
    p.viewedAt = Date.now(); if (out.error) { p.error = out.error; return; }
    const j = JSON.parse(out.text);
    p.reviewDecision = j.reviewDecision || ""; p.mergeable = j.mergeable; p.mergeState = j.mergeStateStatus; p.headRef = j.headRefName; p.isDraft = !!j.isDraft; p.updatedAt = Date.parse(j.updatedAt) || p.updatedAt;
    const seenChecks = new Map<string, boolean | null>();
    for (const c of j.statusCheckRollup || []) { const name = c.name || c.context || "check"; const st = (c.conclusion || c.state || c.status || "").toUpperCase(); const ok = ["SUCCESS", "NEUTRAL", "SKIPPED"].includes(st) ? true : ["FAILURE", "ERROR", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE"].includes(st) ? false : null; const prev = seenChecks.get(name); seenChecks.set(name, prev === false ? false : ok === null && prev === true ? true : ok); }
    p.checks = [...seenChecks].map(([name, ok]) => ({ name, ok }));
    p.reviewers = (j.reviews || []).filter((r: any) => r.author?.login && !/claude-pr-loop/.test(r.body || "") && r.author.login !== "github-actions").map((r: any) => ({ login: r.author.login, state: r.state }));
    let verdict: Pr["claudeVerdict"] = null, at = 0;
    for (const x of [...(j.reviews || []), ...(j.comments || [])]) { const b = x.body || ""; if (!/claude-pr-loop/.test(b)) continue; const t = Date.parse(x.submittedAt || x.createdAt || "") || 0; if (t < at) continue; at = t; verdict = /Review:\s*Approved/i.test(b) || x.state === "APPROVED" ? "approve" : "changes"; }
    p.claudeVerdict = verdict; p.claudeAt = at || undefined;
    const keys = new Set<string>(); for (const src of [p.headRef || "", p.title, (j.body || "").slice(0, 4000)]) for (const m of src.matchAll(TICKET_RE)) keys.add(`${m[1].toUpperCase()}-${m[2]}`); // the branch name is the ticket, so it comes first
    p.tickets = [...keys].slice(0, 4);
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
    p.state = st; p.reason = why; p.needsYou = NEEDS_YOU.includes(st) && !p.shelved && !p.sessionId;
    if (p.sessionId && NEEDS_YOU.includes(st)) p.reason += " A session is on it.";
  }
  private save() { try { mkdirSync(dirname(FILE), { recursive: true }); writeFileSync(FILE + ".tmp", JSON.stringify(this.s, null, 1)); renameSync(FILE + ".tmp", FILE); } catch {} }
}

async function run(cmd: string[]): Promise<{ text: string; error?: string }> {
  try { const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe", env: { ...process.env, GH_PROMPT_DISABLED: "1" } }); const text = await new Response(proc.stdout).text(); const err = await new Response(proc.stderr).text(); const code = await proc.exited;
    if (code !== 0) return { text: "", error: /not logged|auth login/i.test(err) ? "GitHub not connected. Run gh auth login." : /rate limit/i.test(err) ? "GitHub rate limit hit. It will retry." : err.trim().split("\n")[0] || `gh failed (${code})` };
    return { text }; } catch (e: any) { return { text: "", error: e?.message ?? String(e) }; }
}
