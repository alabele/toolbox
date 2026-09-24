// Smoke test: does the Agent SDK run from Bun with the user's login, load their settings,
// stream messages, and route a permission prompt through canUseTool?
import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cwd = mkdtempSync(join(tmpdir(), "quiet-smoke-"));
const t0 = Date.now();
const log = (s: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);
let permissionPrompts = 0;

async function* input(): AsyncGenerator<SDKUserMessage> {
  yield { type: "user", parent_tool_use_id: null, message: { role: "user", content: "Create a file named smoke.txt in the current directory containing exactly the word hello. Then reply with one short sentence." } };
}

const q = query({
  prompt: input(),
  options: {
    cwd,
    includePartialMessages: false,
    canUseTool: async (toolName, input) => {
      permissionPrompts++;
      log(`PERMISSION PROMPT #${permissionPrompts}: ${toolName} ${JSON.stringify(input).slice(0, 120)}`);
      return { behavior: "allow", updatedInput: input };
    },
  },
});

for await (const m of q) {
  if (m.type === "system" && m.subtype === "init") {
    log(`init: session ${m.session_id}, model ${m.model}, claude ${m.claude_code_version}`);
    log(`  tools ${m.tools.length}, mcp ${m.mcp_servers.map(s => s.name + ":" + s.status).join(",") || "none"}`);
    log(`  agents ${(m.agents ?? []).filter(a => a.startsWith("nd-")).length} nd-* of ${(m.agents ?? []).length}, plugins ${m.plugins.length}, skills ${m.skills.length}`);
  } else if (m.type === "assistant") {
    for (const b of m.message.content) {
      if (b.type === "text") log(`assistant text: ${b.text.slice(0, 100)}`);
      if (b.type === "tool_use") log(`assistant tool_use: ${b.name}`);
    }
  } else if (m.type === "user") {
    log("tool_result returned");
  } else if (m.type === "result") {
    log(`result: ${m.subtype}, turns ${m.num_turns}, cost $${m.total_cost_usd?.toFixed(4)}, session ${m.session_id}`);
  } else {
    log(`(${m.type}${"subtype" in m ? ":" + (m as any).subtype : ""})`);
  }
}
const f = join(cwd, "smoke.txt");
log(`file exists: ${existsSync(f)}${existsSync(f) ? `, content ${JSON.stringify(readFileSync(f, "utf8").trim())}` : ""}`);
log(`permission prompts fired: ${permissionPrompts}`);
log(`scratch dir: ${cwd}`);
