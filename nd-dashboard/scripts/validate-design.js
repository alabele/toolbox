#!/usr/bin/env bun
// Checks the [CI] rules in DESIGN_GOVERNANCE.md against the app. Exit 1 on any failure.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
const root = join(dirname(new URL(import.meta.url).pathname), "..");
const R = JSON.parse(readFileSync(join(root, "config/design-rules.json"), "utf8"));
const css = readFileSync(join(root, R.files.css), "utf8"), html = readFileSync(join(root, R.files.html), "utf8"), js = readFileSync(join(root, R.files.js), "utf8");
const out = []; const fail = (id, msg) => out.push({ id, ok: false, msg }); const pass = (id, msg) => out.push({ id, ok: true, msg });

// I1: no color literals outside token blocks
{ const lines = css.split("\n"); const bad = []; let depth = 0, inTokens = false;
  for (let i = 0; i < lines.length; i++) { const l = lines[i];
    if (depth === 0 && R.I1.tokenBlockPrefixes.some(p => l.trimStart().startsWith(p))) inTokens = true;
    const opens = (l.match(/{/g) || []).length, closes = (l.match(/}/g) || []).length; const skip = inTokens; depth += opens - closes; if (depth <= 0) { depth = 0; inTokens = false; }
    if (skip) continue; const scan = l.replace(/\[[a-z-]+="[^"]*"\]/g, ""); // attribute selectors name colors without using them
    const m = scan.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g); if (!m) continue;
    for (const lit of m) { const norm = lit.replace(/\s/g, ""); if (R.I1.allowLiterals.some(a => norm.startsWith(a.replace(/\s/g, "")))) continue; bad.push(`${i + 1}: ${lit}`); } }
  bad.length ? fail("I1", `color literals outside token blocks: ${bad.slice(0, 6).join("; ")}${bad.length > 6 ? ` (+${bad.length - 6})` : ""}`) : pass("I1", "colors come from tokens"); }
// I2: only allowed font families load
{ const fam = [...html.matchAll(/family=([^&:"]+)/g)].map(m => decodeURIComponent(m[1]).replace(/\+/g, " "));
  const extra = fam.filter(f => !R.I2.allowedFamilies.includes(f)); extra.length ? fail("I2", `unexpected font families: ${extra.join(", ")}`) : pass("I2", `fonts: ${fam.join(", ")}`); }
// S1: stillness
{ const hasRule = css.includes(R.S1.requiredRule); const banned = R.S1.banned.filter(b => css.includes(b));
  !hasRule ? fail("S1", "global no-motion rule missing") : banned.length ? fail("S1", `banned: ${banned.join(", ")}`) : pass("S1", "no motion"); }
// M1 + M2: state vocabulary with icon and word
{ const m = js.match(/const STATE = \{([\s\S]*?)\n\};/); const keys = m ? [...m[1].matchAll(/^\s*"?([a-z-]+)"?:\s*\{/gm)].map(x => x[1]) : [];
  const want = R.M1.states; const same = keys.length === want.length && want.every(k => keys.includes(k));
  same ? pass("M1", `states: ${keys.join(", ")}`) : fail("M1", `state vocabulary is ${keys.join(", ")}; expected ${want.join(", ")}`);
  const missing = m ? want.filter(k => { const blk = m[1].match(new RegExp(`"?${k}"?:\\s*\\{([^}]*)\\}`)); return !blk || R.M2.eachStateHas.some(f => !blk[1].includes(f + ":")); }) : want;
  missing.length ? fail("M2", `states without icon and word: ${missing.join(", ")}`) : pass("M2", "every state has a mark and a word"); }
// D1: sidebar groups
{ const n = (js.match(/\bg\("[a-z]+", "/g) || []).length; n > R.D1.maxSidebarGroups ? fail("D1", `${n} sidebar groups, max ${R.D1.maxSidebarGroups}`) : pass("D1", `${n} sidebar groups`); }
// D4: radii from the list
{ const radii = [...css.matchAll(/border-radius:([^;}]+)/g)].map(m => m[1].trim()); const bad = [...new Set(radii.filter(r => !R.D4.allowedRadii.includes(r)))];
  bad.length ? fail("D4", `radii outside the list: ${bad.join(", ")}`) : pass("D4", "radii from the allowed set"); }
// C2: copy tells in UI strings (html text + js string literals)
{ const strings = [...js.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)].map(m => m[2]).filter(s => /[a-zA-Z]{3}/.test(s) && !/[;=]|=>|\(\)/.test(s));
  const htmlText = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
  const hay = [...strings, htmlText]; const hits = [];
  for (const b of R.C2.bannedInCopy) for (const s of hay) if (s.includes(b)) { hits.push(`${JSON.stringify(b)} in ${JSON.stringify(s.slice(0, 50))}`); break; }
  if (R.C2.emoji) for (const s of hay) if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s)) { hits.push(`emoji in ${JSON.stringify(s.slice(0, 50))}`); break; }
  hits.length ? fail("C2", hits.slice(0, 5).join("; ")) : pass("C2", "no copy tells"); }

for (const r of out) console.log(`${r.ok ? "pass" : "FAIL"}  ${r.id}  ${r.msg}`);
const failures = out.filter(r => !r.ok).length; console.log(failures ? `\n${failures} failing rule${failures === 1 ? "" : "s"}` : "\nall rules pass"); process.exit(failures ? 1 : 0);
