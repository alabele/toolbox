// Vantage as a ticket source: PROJ, STORY, D, GOAL and TD keys get a title and a status from the Vantage app's own
// workspace, read-only, the way VDC keys get theirs from Jira. Nothing here writes; Vantage entities move from the app.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const VANTAGE_PREFIXES = ["PROJ", "STORY", "D", "GOAL", "TD"];
export const isVantageKey = (key: string) => VANTAGE_PREFIXES.includes(key.split("-")[0]!.toUpperCase());
function workspace(): string | null { try { const c = JSON.parse(readFileSync(join(homedir(), "Library", "Application Support", "Vantage", "config.json"), "utf8")); const w = join(String(c.workspacePath || ""), "sdlc"); return existsSync(w) ? w : null; } catch { return null; } }
export function vantageReady(): boolean { return !!workspace(); }

// key -> file, rebuilt every ten minutes by walking the workspace (a few thousand files, under 100 ms)
let index: Map<string, string> = new Map(); let indexedAt = 0;
const SKIP = new Set(["audit", "templates", "checkpoints", "test-management", "frontend", "node_modules", ".git"]);
function walk(dir: string, depth: number, out: Map<string, string>) {
  if (depth > 6) return; let names: string[] = []; try { names = readdirSync(dir); } catch { return; }
  for (const n of names) { if (SKIP.has(n)) continue; const p = join(dir, n); let isDir = false; try { isDir = statSync(p).isDirectory(); } catch { continue; }
    if (isDir) { const pm = n.match(/^(PROJ)-(\d+)$/i); if (pm && existsSync(join(p, "project.md"))) out.set(`${pm[1]!.toUpperCase()}-${pm[2]}`, join(p, "project.md")); walk(p, depth + 1, out); }
    else { const m = n.match(/^(STORY|D|GOAL|TD)-(\d+)\.md$/i); if (m) out.set(`${m[1]!.toUpperCase()}-${m[2]}`, p); } }
}
function ensureIndex() { const w = workspace(); if (!w) { index = new Map(); return; } if (Date.now() - indexedAt < 10 * 60e3 && index.size) return; const out = new Map<string, string>(); walk(w, 0, out); index = out; indexedAt = Date.now(); }

export interface VantageEntity { key: string; title: string; status: string; description: string; file: string }
function parse(key: string, file: string): VantageEntity | null {
  let text = ""; try { text = readFileSync(file, "utf8"); } catch { return null; }
  const fm = text.match(/^---\s*\n([\s\S]*?)\n---/); const head = fm ? fm[1]! : "";
  const field = (k: string) => { const m = head.match(new RegExp(`^${k}:\\s*(.*)$`, "m")); return m ? m[1]!.trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1") : ""; };
  return { key, title: field("title"), status: field("status"), description: field("description"), file };
}
/** The entities for these keys; missing ones are left out. */
export function vantageEntities(keys: string[]): VantageEntity[] { ensureIndex(); const out: VantageEntity[] = []; for (const k of keys) { const f = index.get(k.toUpperCase()); if (!f) continue; const e = parse(k.toUpperCase(), f); if (e) out.push(e); } return out; }
/** Plain words for a Vantage status: work_complete -> "Work complete". */
export const vantageStatusWords = (s: string) => s ? s.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase()) : "";
