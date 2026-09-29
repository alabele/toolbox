// Projects: her own buckets ("Release 15.1.0", "LetsO bugs"). Each has a priority, an on/off switch, and rules:
// ticket keys, and words to match in a title. Anything she sorts by hand is remembered by its id.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const FILE = join(homedir(), ".config", "stillroom", "projects.json");
export interface Project { id: string; name: string; prio: 1 | 2 | 3; on: boolean; keys: string[]; words: string[]; order: number }
interface Store { projects: Project[]; assign: Record<string, string> }

export class Projects {
  private s: Store = { projects: [], assign: {} };
  constructor(private onChange: () => void) { try { this.s = JSON.parse(readFileSync(FILE, "utf8")); } catch {} }
  list() { return this.s; }
  upsert(p: Partial<Project> & { name: string }) {
    const cur = p.id ? this.s.projects.find(x => x.id === p.id) : undefined;
    const next: Project = { id: cur?.id || Math.random().toString(36).slice(2, 8), name: p.name.trim(), prio: (p.prio as any) || cur?.prio || 2, on: p.on ?? cur?.on ?? true, keys: (p.keys ?? cur?.keys ?? []).map(k => k.toUpperCase()), words: (p.words ?? cur?.words ?? []).map(w => w.trim()).filter(Boolean), order: cur?.order ?? this.s.projects.length };
    if (cur) Object.assign(cur, next); else this.s.projects.push(next); this.save(); this.onChange(); return next;
  }
  remove(id: string) { this.s.projects = this.s.projects.filter(p => p.id !== id); for (const k of Object.keys(this.s.assign)) if (this.s.assign[k] === id) delete this.s.assign[k]; this.save(); this.onChange(); }
  /** Sort one item into a project by hand. A ticket key on the item teaches the project that key. */
  assign(item: string, project: string | null, key?: string) {
    if (!project) delete this.s.assign[item]; else { this.s.assign[item] = project; const p = this.s.projects.find(x => x.id === project); if (p && key && !p.keys.includes(key.toUpperCase())) p.keys.push(key.toUpperCase()); }
    this.save(); this.onChange();
  }
  private save() { try { mkdirSync(dirname(FILE), { recursive: true }); writeFileSync(FILE + ".tmp", JSON.stringify(this.s, null, 1)); renameSync(FILE + ".tmp", FILE); } catch {} }
}
