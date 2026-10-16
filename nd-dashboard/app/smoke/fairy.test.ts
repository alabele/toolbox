import { test, expect } from "bun:test";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
process.env.ND_FAIRY = join(mkdtempSync(join(tmpdir(), "fairy-")), "fairy.json"); process.env.ND_NO_TITLES = "1"; process.env.ND_NO_FAIRY_HAIKU = "1";
const { Fairy } = await import("../fairy");
const day = 86400e3;
function ctx() { const ended: string[] = [], reopened: any[] = [], removed: string[] = [], restored: any[] = [], assigned: any[] = [];
  const sessions: any[] = [ { sessionId: "a", cwd: "/x", title: "VDC-9: old thing", status: "idle", stateSince: Date.now() - 5 * day, startedAt: 0 }, { sessionId: "b", cwd: "/x", title: "fresh", status: "idle", stateSince: Date.now() - 1 * day, startedAt: 0 }, { sessionId: "e", cwd: "/x", title: "VDC-9: fresh with a key", status: "idle", stateSince: Date.now() - 1 * day, startedAt: 0 }, { sessionId: "c", cwd: "/x", title: "working", status: "working", stateSince: Date.now() - 9 * day, startedAt: 0 }, { sessionId: "d", cwd: "/x", title: "paused one", status: "idle", paused: { note: "x" }, stateSince: Date.now() - 9 * day, startedAt: 0 } ];
  const waitsArr: any[] = [ { id: "w1", text: "asked and left", askedAt: Date.now() - 6 * day, since: Date.now() - 12 * day }, { id: "w2", text: "asked recently", askedAt: Date.now() - 1 * day, since: Date.now() - 6 * day }, { id: "w3", text: "never asked", since: Date.now() - 20 * day } ];
  const pj = { projects: [{ id: "p1", name: "Release", prio: 1, on: true, keys: ["VDC-9"], words: ["release"] }], assign: {} as Record<string, string> };
  const c = { sessions: () => sessions.filter(s => !ended.includes(s.sessionId)), end: (id: string) => ended.push(id), reopen: (s: any) => reopened.push(s),
    waits: { list: () => waitsArr.filter(w => !removed.includes(w.id)), remove: (id: string) => removed.push(id), restore: (w: any) => restored.push(w) },
    projects: { list: () => pj, assign: (item: string, project: string | null, key?: string) => { assigned.push([item, project]); if (project) pj.assign[item] = project; else delete pj.assign[item]; } },
    prs: () => [] };
  return { c, ended, reopened, removed, restored, assigned };
}
test("tidy closes the four-day session, lets the asked-and-left wait go, files by key, and undoes", async () => {
  const { c, ended, reopened, removed, restored, assigned } = ctx(); const f = new Fairy(c as any, () => {});
  const n = await f.tidy();
  expect(ended).toEqual(["a"]); expect(removed).toEqual(["w1"]); expect(assigned.some(a => a[0] === "s:e" && a[1] === "p1")).toBe(true);
  const log = f.payload().log; expect(log.length).toBe(n); expect(log.map(a => a.kind).sort()).toEqual(["closed-session", "filed", "let-go-wait"]);
  expect(log.every(a => !/stale|dead|neglect|you haven/i.test(a.text))).toBe(true);
  expect(f.undoAll()).toBe(n); expect(reopened[0].sessionId).toBe("a"); expect(restored[0].id).toBe("w1"); expect(assigned.at(-1)).toEqual(["s:e", null]);
});
test("tidies at midnight on weekdays, once a night", async () => { const { c, ended } = ctx(); const f = new Fairy(c as any, () => {}); (f as any).s.lastRun = 0;
  const wedNoon = new Date(2026, 9, 14, 12, 0), wedMidnight = new Date(2026, 9, 14, 0, 10), satMidnight = new Date(2026, 9, 17, 0, 10);
  await f.tick(wedNoon); expect(ended).toEqual([]); await f.tick(satMidnight); expect(ended).toEqual([]);
  await f.tick(wedMidnight); expect(ended).toEqual(["a"]); expect(Fairy.isTidyTime(new Date(2026, 9, 14, 0, 40), (f as any).s.lastRun)).toBe(false); });
