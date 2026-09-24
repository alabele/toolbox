// Does a session resumed after a server restart still route permission prompts? Two short turns.
const wsUrl = "ws://localhost:4747/ws"; const t0 = Date.now(); const log = (s: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);
function run(label: string, sendFn: (ws: WebSocket, sid: string) => void, sidIn: string): Promise<string> {
  return new Promise((resolve) => { const ws = new WebSocket(wsUrl); let sid = sidIn, answered = false, done = false;
    ws.onopen = () => { log(`${label}: open`); sendFn(ws, sid); };
    ws.onmessage = (e) => { const m = JSON.parse(String(e.data));
      if (m.type === "started") sid = m.payload.tempId;
      if (m.type === "meta" && (m.sessionId === sid || sid.startsWith("pending-"))) { if (m.payload.sessionId !== sid) sid = m.payload.sessionId;
        log(`${label}: status=${m.payload.status} pending=${m.payload.pending ? m.payload.pending.toolName : "none"}`);
        if (m.payload.pending && !answered) { answered = true; ws.send(JSON.stringify({ type: "answer", sessionId: sid, requestId: m.payload.pending.id, decision: { behavior: "allow" } })); log(`${label}: allowed`); }
        if ((m.payload.status === "idle" || m.payload.status === "failed") && !done) { done = true; setTimeout(() => { ws.close(); resolve(sid); }, 300); } }
      if (m.type === "event" && m.sessionId === sid && m.payload.kind === "text") log(`${label}: claude: ${m.payload.text.replace(/\s+/g, " ").slice(0, 110)}`);
      if (m.type === "event" && m.sessionId === sid && m.payload.kind === "note") log(`${label}: NOTE ${m.payload.text}`); };
    setTimeout(() => { if (!done) { log(`${label}: timeout`); ws.close(); resolve(sid); } }, 120000); });
}
const phase = process.argv[2];
if (phase === "1") { const sid = await run("turn1", (ws) => ws.send(JSON.stringify({ type: "start", cwd: "/tmp/sr-perm", prompt: "Create a file a.txt containing the word one, then reply in five words.", mode: "default" })), "pending-x"); await Bun.write("/tmp/sr-perm/sid", sid); log(`session ${sid}`); }
else { const sid = (await Bun.file("/tmp/sr-perm/sid").text()).trim(); await run("turn2", (ws) => ws.send(JSON.stringify({ type: "send", sessionId: sid, text: "Now create b.txt containing the word two, then reply in five words." })), sid); log(`b.txt exists: ${await Bun.file("/tmp/sr-perm/b.txt").exists()}`); }
process.exit(0);
