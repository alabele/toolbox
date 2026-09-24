// Ticket status from Jira Cloud, read-only. The token sits in its own file, like the pr-loop key.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// site and email live in ~/.config/stillroom/jira.json ({"site": "https://x.atlassian.net", "email": "you@x.com"}); the token in jira-token beside it
const CONF = (() => { try { return JSON.parse(readFileSync(join(homedir(), ".config", "stillroom", "jira.json"), "utf8")); } catch { return {}; } })();
const SITE = (process.env.ND_JIRA_SITE ?? CONF.site ?? "").replace(/\/$/, "");
const EMAIL = process.env.ND_JIRA_EMAIL ?? CONF.email ?? "";
const TOKEN_FILE = join(homedir(), ".config", "stillroom", "jira-token");
export const QA_STATUSES = ["Ready for QA", "In Test"]; // "in QA" in plain words
export interface Ticket { key: string; status: string; summary: string; assignee?: string; at: number; url: string }

export function jiraReady(): boolean { return !!SITE && !!EMAIL && existsSync(TOKEN_FILE); }
function auth(): string | null { try { const t = readFileSync(TOKEN_FILE, "utf8").trim(); return t ? "Basic " + Buffer.from(`${EMAIL}:${t}`).toString("base64") : null; } catch { return null; } }

/** One search for all keys. Returns what it found; missing keys are left out. */
export async function fetchTickets(keys: string[]): Promise<{ tickets: Ticket[]; error?: string }> {
  const a = auth(); if (!a) return { tickets: [], error: "Jira not connected." };
  const uniq = [...new Set(keys)].slice(0, 100); if (!uniq.length) return { tickets: [] };
  try {
    const r = await fetch(`${SITE}/rest/api/3/search/jql`, { method: "POST", headers: { authorization: a, "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ jql: `key in (${uniq.join(",")})`, fields: ["status", "summary", "assignee"], maxResults: 100 }) });
    if (r.status === 401 || r.status === 403) return { tickets: [], error: "Jira rejected the token." };
    if (!r.ok) { const t = await r.text(); if (r.status === 400 && /does not exist|Issue does not exist/i.test(t)) return await oneByOne(uniq, a); return { tickets: [], error: `Jira said ${r.status}.` }; }
    const j = await r.json(); return { tickets: (j.issues || []).map(toTicket) };
  } catch (e: any) { return { tickets: [], error: `Jira unreachable: ${e?.message ?? e}` }; }
}
// a key that no longer exists makes the whole search fail; fall back to asking for each
async function oneByOne(keys: string[], a: string): Promise<{ tickets: Ticket[] }> {
  const out: Ticket[] = [];
  for (const k of keys) { try { const r = await fetch(`${SITE}/rest/api/3/issue/${k}?fields=status,summary,assignee`, { headers: { authorization: a, accept: "application/json" } }); if (r.ok) out.push(toTicket(await r.json())); } catch {} }
  return { tickets: out };
}
const toTicket = (i: any): Ticket => ({ key: i.key, status: i.fields?.status?.name || "", summary: i.fields?.summary || "", assignee: i.fields?.assignee?.displayName, at: Date.now(), url: `${SITE}/browse/${i.key}` });
