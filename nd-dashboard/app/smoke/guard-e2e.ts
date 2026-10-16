// Drives one session on a probe server and prints what the guard did. usage: bun smoke/guard-e2e.ts <port> <cwd> "<prompt>"
const [port, cwd, prompt] = process.argv.slice(2);
const ws = new WebSocket(`ws://localhost:${port}/ws`); const t0 = Date.now(); const log = (s: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);
let sid = ""; const notes: string[] = []; let reply = "";
const done = new Promise<void>((resolve) => {
  ws.onopen = () => { log("open"); ws.send(JSON.stringify({ type: "start", cwd, prompt, mode: "bypassPermissions" })); };
  ws.onmessage = (e) => { const m = JSON.parse(String(e.data));
    if (m.type === "started") sid = m.payload.tempId;
    if (m.type === "start-failed") { log(`start failed: ${JSON.stringify(m.payload)}`); resolve(); }
    if (m.type === "meta" && (m.sessionId === sid || sid.startsWith("pending-"))) { if (m.payload.sessionId !== sid) sid = m.payload.sessionId; if (m.payload.paused) log(`paused: ${m.payload.paused.note}`); if (m.payload.status === "idle" || m.payload.status === "failed") resolve(); }
    if (m.type === "event" && m.sessionId === sid) { const ev = m.payload; if (ev.kind === "note") notes.push(ev.text); if (ev.kind === "tool") log(`tool ${ev.name} ${JSON.stringify(ev.input).slice(0, 90)}`); if (ev.kind === "tool" && ev.result !== undefined) log(`  -> ${String(ev.result).slice(0, 140).replace(/\n/g, " ")}`); if (ev.kind === "text") reply = ev.text; } };
});
await Promise.race([done, new Promise(r => setTimeout(r, 180000))]);
log(`notes: ${JSON.stringify(notes)}`); log(`reply: ${reply.slice(0, 400).replace(/\n/g, " | ")}`); ws.close(); process.exit(0);
