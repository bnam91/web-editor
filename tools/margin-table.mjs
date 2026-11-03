#!/usr/bin/env node
/* margin-table.mjs — 시트 271 표. 런 로그들의 `[여유] {...}` 줄을 «지금 / 문턱 / 여유 / 판 sha» 표로 낸다(찍는 자 = tests/unit/_margin.js · ⛔수를 손으로 안 적는다).
 *   쓰기: node tools/margin-table.mjs <로그> [로그…] · rc 0 표 · rc 2 줄이 0(자가 죽었다 · 안 쟀다) · 3 못 읽음.
 *   회차 칸: 같은 라벨 값이 로그마다 같으면 «같음»(문턱 · 이 줄) · 다르면 «흔들림»(장면 · 349 집안 · 시트 271 가름). 로그 하나면 «×1». 판 칸은 찍은 때의 sha — 둘이면 «a·b» 라 판이 섞인 것이다. */
import fs from 'node:fs';
const logs = process.argv.slice(2);
if (!logs.length) { console.error('쓰는 법: margin-table.mjs <로그>…'); process.exit(3); }
const by = new Map();
for (const f of logs) {
  let t; try { t = fs.readFileSync(f, 'utf8'); } catch (e) { console.error(`못 읽음 ${f}: ${e.code}`); process.exit(3); }
  for (const m of t.matchAll(/\[여유\] (\{[^\n]*?\})\s*$/gm)) {
    const r = JSON.parse(m[1]);
    if (!by.has(r.label)) by.set(r.label, { ...r, seen: new Map(), shas: new Set() });
    by.get(r.label).seen.set(f, r.now);
    by.get(r.label).shas.add(r.sha);
    by.get(r.label).left = r.left;
  }
}
if (!by.size) { console.error('⛔[여유] 줄 0 — 자가 죽었다(안 쟀다)'); process.exit(2); }
console.log(['라벨', '꼴', '지금', '문턱', '여유', '판', '회차'].join('\t'));
for (const r of [...by.values()].sort((a, b) => a.left - b.left || a.label.localeCompare(b.label))) {
  const vals = [...r.seen.values()];
  const round = vals.length < 2 ? '×1' : new Set(vals).size === 1 ? `같음 ×${vals.length}` : `흔들림 ${vals.join('·')}`;
  console.log([r.label, r.kind, r.now, r.limit, r.left, [...r.shas].join('·'), round].join('\t'));
}
