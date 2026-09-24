// Builds the interactive page and REPORT.md from data.js. Usage: node build.js <out.html>
const fs=require("fs"),path=require("path");
const d=require("./data.js");const out=process.argv[2];
let h=fs.readFileSync(path.join(__dirname,"template.html"),"utf8");
const js=Object.entries({F:d.F,TOPICS:d.TOPICS,COV:d.COV,PR:d.PR,RECS:d.RECS,BENCH:d.BENCH}).map(([k,v])=>`const ${k}=${JSON.stringify(v)};`).join("\n").replace(/<\//g,"<\\/");
h=h.replace("/*DATA*/",()=>js);
const sub={RUNS:d.STATS.runs,EXTRACTED:d.STATS.extracted,CHECKED:d.STATS.checked,SOURCES:d.STATS.sources,NF:d.F.length,NP:d.PR.length};
for(const[k,v]of Object.entries(sub))h=h.split("{{"+k+"}}").join(v);
fs.writeFileSync(out,h);
// ---- REPORT.md
const C={high:"High",medium:"Medium",low:"Low"};let m=[];
m.push("# Designing a regulating work dashboard for an engineer who works best with low cognitive load\n");
m.push(`Research report, 2026-09-21. Generated from \`build/data.js\` by \`build/build.js\`. Interactive version: https://claude.ai/artifact/2EV6UqbsQ2xM4VVNCXbGEh\n`);
m.push(`| Research runs | Claims extracted | Claims fact-checked | Refuted | Distinct sources |\n|---|---|---|---|---|\n| ${d.STATS.runs} | ${d.STATS.extracted} | ${d.STATS.checked} | ${d.STATS.refuted} | ${d.STATS.sources} |\n`);
m.push("**How to read this.** Each run extracts claims from sources and sends at most 25 to three independent fact-checkers. A claim is dropped if two of three refute it. Findings below survived that check. Recommendations marked *reasoning* are extrapolation from checked principles. Section 5 lists what was never checked. Raw verifier output is in the `pass*-raw.json` files.\n");
m.push("**The main limit.** Nearly every study used neurotypical people, children, or students. No checked source studied the exact profile this tool is built for. Treat findings as starting defaults. The user's own reaction outranks them.\n");
m.push("## 1. Findings\n");
for(const c of["high","medium","low"]){m.push(`### ${C[c]} confidence\n`);
 for(const f of d.F.filter(f=>f.c===c))m.push(`**F${f.id}. ${f.t}.**${f.x?" *Contested.*":""} ${f.w} *Limits:* ${f.v} [${f.s}](${f.u})\n`);}
m.push("## 2. Design principles\n");
d.PR.forEach((p,i)=>m.push(`${i+1}. **${p[0]}.** ${p[1]} (${p[2].map(x=>"F"+x).join(", ")})`));
m.push("\n## 3. Recommendations by area\n");
for(const r of d.RECS){m.push(`### ${r.n} — ${r.b==="ext"?"reasoning":"evidence"}\n\n${r.bt}\n`);r.i.forEach((x,i)=>m.push(`${i+1}. ${x}`));m.push("");}
m.push("## 4. What Claude Code already provides\n\nConfirmed on Claude Code 2.1.278. `claude agents` is a built-in multi-session view sorted by what needs you, with in-place replies and a recap on reattach. `claude agents --json` lists live sessions with state and working directory and needs no terminal. Lifecycle hooks (`Notification` with permission and idle types, `Stop`, `SessionEnd`, and an HTTP hook type) push events from every repo when set at user scope. Build on these. Do not parse transcripts or scrape terminal text.\n");
m.push("## 5. Coverage\n");
const lab={ok:"Checked",weak:"Checked, weak evidence",none:"Never checked"};
for(const s of["ok","weak","none"]){m.push(`**${lab[s]}:** `+d.COV.filter(c=>c[1]===s).map(c=>c[0]+(c[3]?" (contested)":"")+(c[2]?` [${c[2].map(x=>"F"+x).join(", ")}]`:"")).join("; ")+".\n");}
m.push("Never checked means no claim reached verification. It does not mean the literature is empty or negative.\n");
m.push("## 6. The agent bench\n\n| Agent | Modelled on | Role | Owns | Evidence standing |\n|---|---|---|---|---|");
d.BENCH.forEach(b=>m.push(`| ${b.join(" | ")} |`));
fs.writeFileSync(path.join(__dirname,"..","REPORT.md"),m.join("\n")+"\n");
console.log("built",out,"and REPORT.md:",d.F.length,"findings");
