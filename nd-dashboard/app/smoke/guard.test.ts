import { test, expect } from "bun:test";
import { checkCall } from "../guard";
const cwd = "/Users/me/.config/stillroom/worktrees/video-client/VDC-1";
const g = { sandbox: false, maxTurns: 1, maxBudgetUsd: 1, denialsBeforePause: 3, protectedBranches: ["main", "development", "release/*"], writeAllow: ["/tmp"] };
test("writes inside the worktree pass", () => { expect(checkCall("Edit", { file_path: cwd + "/src/a.ts" }, cwd, g)).toBe(""); expect(checkCall("Write", { file_path: "src/b.ts" }, cwd, g)).toBe(""); expect(checkCall("Write", { file_path: "/tmp/x" }, cwd, g)).toBe(""); });
test("writes outside are blocked", () => { expect(checkCall("Edit", { file_path: "/Users/me/code/toolbox/x.ts" }, cwd, g)).toMatch(/outside/); expect(checkCall("Write", { file_path: "~/.ssh/config" }, cwd, g)).toMatch(/credential/); });
test("pushes", () => {
  expect(checkCall("Bash", { command: "git push -u origin VDC-1" }, cwd, g)).toBe("");
  expect(checkCall("Bash", { command: "git push origin main" }, cwd, g)).toMatch(/no pushes to main/);
  expect(checkCall("Bash", { command: "git push origin HEAD:development" }, cwd, g)).toMatch(/development/);
  expect(checkCall("Bash", { command: "git push origin release/15.1" }, cwd, g)).toMatch(/release/);
  expect(checkCall("Bash", { command: "git push --force origin VDC-1" }, cwd, g)).toMatch(/force/);
  expect(checkCall("Bash", { command: "git push origin :old" }, cwd, g)).toMatch(/deleting/);
  expect(checkCall("Bash", { command: "git fetch && git push origin VDC-1 && gh pr create" }, cwd, g)).toBe("");
});
test("github merges and deletes", () => { expect(checkCall("Bash", { command: "gh pr merge 12 --squash" }, cwd, g)).toMatch(/hers/); expect(checkCall("Bash", { command: "gh pr view 12" }, cwd, g)).toBe(""); });
test("rm and secrets", () => {
  expect(checkCall("Bash", { command: "rm -rf node_modules" }, cwd, g)).toBe("");
  expect(checkCall("Bash", { command: "rm -rf ~/code/toolbox" }, cwd, g)).toMatch(/deleted outside/);
  expect(checkCall("Bash", { command: "rm -rf /" }, cwd, g)).toMatch(/deleted outside/);
  expect(checkCall("Bash", { command: "cat ~/.aws/credentials" }, cwd, g)).toMatch(/credential/);
  expect(checkCall("Bash", { command: "cat .env" }, cwd, g)).toMatch(/credential/);
  expect(checkCall("Bash", { command: "cat .env.example" }, cwd, g)).toBe("");
  expect(checkCall("Bash", { command: "sudo rm x" }, cwd, g)).toMatch(/sudo/);
  expect(checkCall("Bash", { command: "bun test" }, cwd, g)).toBe("");
});
