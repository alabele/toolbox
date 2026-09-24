// Slack goes through the claude.ai Slack connector inside a one-shot, unsaved Claude session. No token to keep.
import { query } from "@anthropic-ai/claude-agent-sdk";
import { homedir } from "node:os";
import { sessionEnv } from "./sessions";

async function oneShot(prompt: string, cwd: string): Promise<string> {
  const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), 120_000);
  try {
    const q = query({ prompt, options: { permissionMode: "bypassPermissions", maxTurns: 8, persistSession: false, env: sessionEnv(), cwd, abortController: abort } as any });
    let text = ""; for await (const m of q) if (m.type === "assistant") for (const b of (m as any).message.content) if (b.type === "text") text = b.text; // the last text wins
    return text.trim();
  } catch (e: any) { return `ERROR ${e?.message ?? e}`; } finally { clearTimeout(timer); }
}
/** Posts a message to a channel; returns the permalink, or an error string starting with ERROR. */
export async function postToSlack(channel: string, text: string, cwd = homedir()): Promise<string> {
  const out = await oneShot(`Use the Slack connector to post exactly this message to the channel ${channel} (no edits, no extra words, no thread):\n\n${text}\n\nThen reply with only the permalink of the message you posted. If you cannot post, reply with only: ERROR followed by one line saying why.`, cwd);
  const m = out.match(/https:\/\/\S+slack\.com\/archives\/\S+/); return m ? m[0].replace(/[).,]+$/, "") : out.startsWith("ERROR") ? out : `ERROR ${out.slice(0, 200) || "no permalink came back"}`;
}
/** Replies in the thread of a posted message. */
export async function replyInThread(permalink: string, text: string, cwd = homedir()): Promise<string> {
  const out = await oneShot(`Use the Slack connector to reply in the thread of this message: ${permalink}\nPost exactly this reply (no edits, no extra words):\n\n${text}\n\nThen reply with only: ok. If you cannot, reply with only: ERROR followed by one line saying why.`, cwd);
  return /^ok\b/i.test(out) ? "ok" : out.startsWith("ERROR") ? out : `ERROR ${out.slice(0, 200)}`;
}
