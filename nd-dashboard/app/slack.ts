// Slack goes through the claude.ai Slack connector inside a one-shot, unsaved Claude session. No token to keep.
import { query } from "@anthropic-ai/claude-agent-sdk";
import { homedir } from "node:os";
import { sessionEnv } from "./sessions";

// The Slack connector is passed to the session by name and id, so it loads even when the auto-fetched list is slow to arrive.
// Its id comes from the same claude.ai endpoint the CLI uses, with the login token from the keychain. Cached for an hour.
let slackServer: { at: number; cfg: any } | null = null;
async function findSlack(): Promise<any> {
  if (slackServer && Date.now() - slackServer.at < 3600_000) return slackServer.cfg;
  try {
    const conf = JSON.parse(await Bun.file(`${homedir()}/.claude.json`).text()); const org = conf?.oauthAccount?.organizationUuid; if (!org) return null;
    const sec = Bun.spawnSync(["security", "find-generic-password", "-s", "Claude Code-credentials", "-w"], { stdout: "pipe", stderr: "pipe" }); const tok = JSON.parse(sec.stdout.toString() || "{}")?.claudeAiOauth?.accessToken; if (!tok) return null;
    const r = await fetch(`https://api.anthropic.com/api/oauth/organizations/${org}/mcp/connectors/list`, { method: "POST", headers: { authorization: `Bearer ${tok}`, "anthropic-beta": "oauth-2025-04-20", "content-type": "application/json" }, body: "{}" });
    if (!r.ok) return null; const j = await r.json(); const s = (j.results || []).find((c: any) => c.name === "Slack" && c.connected && c.installedServerId);
    const cfg = s ? { "claude.ai Slack": { type: "claudeai-proxy", url: "https://mcp.slack.com/mcp", id: s.installedServerId } } : null;
    slackServer = { at: Date.now(), cfg }; return cfg;
  } catch { return null; }
}
export async function slackConnected(): Promise<boolean> { return !!(await findSlack()); }
async function oneShot(prompt: string, cwd: string): Promise<string> {
  const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), 120_000);
  try {
    const mcpServers = (await findSlack()) || undefined;
    const q = query({ prompt, options: { permissionMode: "bypassPermissions", maxTurns: 8, persistSession: false, env: sessionEnv(), cwd, abortController: abort, mcpServers } as any });
    let text = ""; for await (const m of q) if (m.type === "assistant") for (const b of (m as any).message.content) if (b.type === "text") text = b.text; // the last text wins
    return text.trim();
  } catch (e: any) { return `ERROR ${e?.message ?? e}`; } finally { clearTimeout(timer); }
}
/** Posts a message to a channel; returns the permalink, or an error string starting with ERROR. */
export async function postToSlack(channel: string, text: string, cwd = homedir()): Promise<string> {
  if (!(await findSlack())) return "ERROR Slack is not connected to this claude.ai account. Connect it at claude.ai, Settings, Connectors.";
  const out = await oneShot(`Use the Slack connector to post exactly this message to the channel ${channel} (no edits, no extra words, no thread):\n\n${text}\n\nThen reply with only the permalink of the message you posted. If you cannot post, reply with only: ERROR followed by one line saying why.`, cwd);
  const m = out.match(/https:\/\/\S+slack\.com\/archives\/\S+/); return m ? m[0].replace(/[).,]+$/, "") : out.startsWith("ERROR") ? out : `ERROR ${out.slice(0, 200) || "no permalink came back"}`;
}
/** Replies in the thread of a posted message. */
export async function replyInThread(permalink: string, text: string, cwd = homedir()): Promise<string> {
  if (!(await findSlack())) return "ERROR Slack is not connected to this claude.ai account. Connect it at claude.ai, Settings, Connectors.";
  const out = await oneShot(`Use the Slack connector to reply in the thread of this message: ${permalink}\nPost exactly this reply (no edits, no extra words):\n\n${text}\n\nThen reply with only: ok. If you cannot, reply with only: ERROR followed by one line saying why.`, cwd);
  return /^ok\b/i.test(out) ? "ok" : out.startsWith("ERROR") ? out : `ERROR ${out.slice(0, 200)}`;
}
/** Read-only check that the connector answers: the channels whose name matches. */
export async function slackProbe(name: string, cwd = homedir()): Promise<string> {
  return oneShot(`Use the Slack connector to search channels for "${name}". Reply with only the channel names you found, one per line, or "none".`, cwd);
}
