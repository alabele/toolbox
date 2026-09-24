// One short turn with the same env handling the app uses. Reports auth source signals: connectors present, cost.
import { query } from "@anthropic-ai/claude-agent-sdk";
const env: Record<string, string | undefined> = { ...process.env }; delete env.ANTHROPIC_API_KEY; delete env.ANTHROPIC_AUTH_TOKEN;
for await (const m of query({ prompt: "Reply with exactly the word ok.", options: { cwd: "/tmp", env, maxTurns: 1, tools: [] } })) {
  if (m.type === "system" && m.subtype === "init") console.log("mcp servers:", m.mcp_servers.map(s => `${s.name}:${s.status}`).join(", ") || "none", "| model:", m.model);
  if (m.type === "result") console.log("result:", m.subtype, "| reported cost $" + ((m as any).total_cost_usd ?? 0).toFixed(3), "|", (m as any).is_error ? "ERROR " + JSON.stringify((m as any).errors ?? "").slice(0, 200) : "ok");
}
