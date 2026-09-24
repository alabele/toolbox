// Drive headless Chrome over CDP: navigate, wait real seconds, evaluate an expression, save a screenshot.
// usage: bun smoke/cdp-shot.ts <url> <out.png> [waitMs] [expression]
const [url, out, waitMs = "4000", expr = "document.querySelector('#transcript')?.children.length"] = process.argv.slice(2);
const port = 9333;
const chrome = Bun.spawn(["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--window-size=${process.env.W ?? 1000},${process.env.H ?? 700}`, "--user-data-dir=/tmp/quiet-cdp-profile", "about:blank"], { stdout: "ignore", stderr: "ignore" });
await Bun.sleep(1500);
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json() as any[];
const page = targets.find(t => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl); let id = 0; const waiting = new Map<number, (v: any) => void>();
const call = (method: string, params: any = {}) => new Promise<any>(r => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.id && waiting.has(m.id)) { waiting.get(m.id)!(m.result); waiting.delete(m.id); } };
await new Promise(r => ws.onopen = r);
await call("Page.enable"); await call("Runtime.enable");
await call("Page.navigate", { url }); await Bun.sleep(Number(waitMs));
const ev = await call("Runtime.evaluate", { expression: expr, returnByValue: true });
console.log("eval:", JSON.stringify(ev?.result?.value));
const shot = await call("Page.captureScreenshot", { format: "png" });
await Bun.write(out, Buffer.from(shot.data, "base64")); console.log("saved", out);
ws.close(); chrome.kill(); process.exit(0);
