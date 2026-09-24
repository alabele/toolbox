// Drives the app's WebSocket protocol like the browser would.
const ws = new WebSocket("ws://localhost:4747/ws");
const t0 = Date.now(); const log = (s: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);
let sid = "", answered = false;
const done = new Promise<void>((resolve) => {
  ws.onopen = () => { log("open"); ws.send(JSON.stringify({ type: "start", cwd: "/tmp/quiet-e2e", prompt: "Create a file named e2e.txt containing the single word ok, then reply in one short sentence.", mode: "default" })); };
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data));
    if (m.type === "started") { log(`started temp ${m.payload.tempId}`); sid = m.payload.tempId; }
    if (m.type === "meta" && (m.sessionId === sid || sid.startsWith("pending-"))) {
      if (m.payload.sessionId !== sid) { sid = m.payload.sessionId; log(`re-keyed to ${sid}`); }
      log(`meta status=${m.payload.status} pending=${m.payload.pending ? m.payload.pending.kind + ":" + m.payload.pending.toolName : "none"}`);
      if (m.payload.pending && !answered) { answered = true; ws.send(JSON.stringify({ type: "answer", sessionId: sid, requestId: m.payload.pending.id, decision: { behavior: "allow" } })); log("answered allow"); }
      if (m.payload.status === "idle" || m.payload.status === "failed") { resolve(); }
    }
    if (m.type === "event" && m.sessionId === sid) { const ev = m.payload; log(`event ${ev.kind}${ev.name ? " " + ev.name : ""}${ev.text ? ": " + ev.text.slice(0, 60) : ""}${ev.result !== undefined ? " -> result" : ""}`); }
  };
});
await Promise.race([done, new Promise(r => setTimeout(r, 150000))]);
await Bun.write("/tmp/quiet-e2e/sid", sid); log(`session ${sid}; file ok? ${await Bun.file("/tmp/quiet-e2e/e2e.txt").exists()}`);
ws.close(); process.exit(0);
