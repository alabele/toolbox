// The ship runner on a fake PR: steps run in order by method, stop at a failure, wait at an "ask" step, finish and report.
import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const home = mkdtempSync(join(tmpdir(), "ship-")); process.env.HOME = home; mkdirSync(join(home, ".config", "stillroom"), { recursive: true });
process.env.ND_PRS = join(home, "prs.json"); writeFileSync(join(home, ".config", "stillroom", "repos.json"), JSON.stringify({ "o/r": { checklist: ["Lint | cmd: true", "Review | review", "Hand check | | ask", "Notes | write the notes"] } }));
const { Prs } = await import("../prs");
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
function fresh() { let changes = 0; const prs = new Prs(() => { changes++; }, () => null); (prs as any).repos = JSON.parse(require("node:fs").readFileSync(join(home, ".config", "stillroom", "repos.json"), "utf8"));
  const p: any = { key: "o/r#1", repo: "o/r", short: "r #1", number: 1, title: "VDC-9: thing", url: "u", isDraft: false, updatedAt: Date.now(), tickets: ["VDC-9"], firstSeen: Date.now(), state: "review", needsYou: false, reason: "", mergeable: "MERGEABLE", checks: [], reviewers: [], claudeVerdict: null };
  (prs as any).s.prs[p.key] = p; (prs as any).derive(p); return { prs, p, n: () => changes }; }
test("runs in order, waits at ask, finishes", async () => {
  const { prs, p } = fresh(); const ran: string[] = []; const done: string[] = [];
  prs.onRunStep = async (pr, c) => { ran.push(c.item); if (c.action === "cmd") return "done"; if (c.action === "review") { setTimeout(() => { pr.claudeVerdict = "approve"; pr.claudeAt = Date.now(); (prs as any).derive(pr); }, 30); return "started"; } if (c.action === "send") { setTimeout(() => prs.setCheck(pr.key, c.item, true), 30); return "started"; } return "needs-you: no method"; };
  prs.onRunDone = (pr, ok, why) => { done.push(`${ok}:${why}`); };
  expect(prs.shipRun(p.key)).toBe(true); await sleep(200);
  expect(ran).toEqual(["Lint", "Review"]); expect(p.run.status).toBe("needs-you"); expect(p.run.step).toBe("Hand check"); expect(p.needsYou).toBe(true);
  expect(prs.shipGo(p.key)).toBe(true); await sleep(200);
  expect(ran).toEqual(["Lint", "Review", "Notes"]); expect(p.run.status).toBe("done"); expect(done[0]).toMatch(/^true/); expect(p.checklist.every((c: any) => c.done || c.skip)).toBe(true); // her go ticked Hand check
});
test("stops at a failure and needs her", async () => {
  const { prs, p } = fresh(); const done: string[] = [];
  prs.onRunStep = async (pr, c) => c.action === "cmd" ? "error: lint exited 1" : "done"; prs.onRunDone = (pr, ok, why) => { done.push(`${ok}:${why}`); };
  prs.shipRun(p.key); await sleep(100);
  expect(p.run.status).toBe("failed"); expect(p.run.why).toMatch(/lint exited 1/); expect(p.needsYou).toBe(true); expect(p.reason).toMatch(/Ship run stopped/); expect(done[0]).toMatch(/^false/);
});
test("tests touched waits for her go first", async () => {
  const { prs, p } = fresh(); p.testsTouched = ["src/a.test.ts"]; prs.onRunStep = async () => "done";
  prs.shipRun(p.key); await sleep(50); expect(p.run.status).toBe("needs-you"); expect(p.run.why).toMatch(/Tests changed/);
});
