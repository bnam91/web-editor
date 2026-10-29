#!/usr/bin/env node
/* harness-fake-paths.js — ★198 ⒢ «제품 파일을 레포와 다른 URL 경로로 싣는 줄» 래칫 (S3 · 261029 · 지디 15:5x 정의)
 *
 * ★왜: 하네스 spec 이 제품 파일을 가짜 경로(/props/prop-page.js · /overlay-float.js …)로 서빙하면 그 파일의 상대 import 가
 *   가짜 자리로 풀려, 제품에 import 가 하나 늘 때 404 가 난다(198 · overlay-extend-asset 의 ../io/export-formats.js).
 *   그때마다 route 한 줄을 더하는 국소 완화가 뿌리를 가렸다 ⇒ 줄 수를 «자가 세고» 늘지 못하게 잠근다.
 * ★세는 것(지디 15:5x 못박음) = «제품 파일» 을 레포와 다른 URL 경로로 싣는 줄:
 *   ⑴ <script type="module" src=P>   ⑵ 인라인 <script type="module"> 안 절대 import P   ⑶ 고전 <script src=P>
 *   P 가 레포 파일 경로가 아니고(앞 '/' 뗀 자리에 레포 파일 없음) · 같은 spec 의 route 가 P 를 «레포 .js 파일을 읽은 const» 로 준다.
 *   ⛔합성(spec 이 지은 글자 · 예 /__harness.js)은 안 센다 — 제품 파일이 아니다. ⛔spec 합집합이 아니라 «줄» 로 센다.
 * ⛔이 자가 안 보는 것: route 가 함수·helper(dragUtilsDep 등)로 주는 경로 · src 없는 spec(addScriptTag · evaluate 주입) · 틀 문자열 경로(${…}).
 * 쓰기: node tests/harness-fake-paths.js            → 지금 줄 수 · 명부와 견줌(늘면 rc 1 · 줄면 rc 1 «명부를 줄여라 --record»)
 *       node tests/harness-fake-paths.js --record   → 명부(tests/unit/HARNESS_FAKE_PATHS.json)를 지금 것으로 씀(줄어들 때만 · 늘면 거절 rc 1 · 명부 파일이 없을 때 첫 세움만 예외)
 * 잠그는 자리: tests/unit/harness-fake-paths.test.mjs */
'use strict';
const fs = require('fs');
const path = require('path');

const TAG = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
const SRC = /\bsrc=(["'`])(.*?)\1/;
const MOD = /type\s*=\s*["']module/;
const ABS_IMP = /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)(["'])(\/[^"']+)\1/gm;

/** spec 한 벌 글자 → [{ form, line, url, product }] (product = 그 url 로 주는 레포 파일)
 *  @param {string} text  spec 원문 @param {(rel:string)=>boolean} isRepoFile 레포 파일인가(앞 '/' 뗀 상대경로) */
function scanSpec(text, isRepoFile) {
  const consts = new Map();
  for (const m of text.matchAll(/const\s+(\w+)\s*=\s*(?:fs\.)?readFileSync\(\s*path\.join\(\s*\w+\s*,\s*['"]([^'"]+\.js)['"]/g)) consts.set(m[1], m[2]);
  for (const m of text.matchAll(/const\s+(\w+)\s*=\s*read\(\s*['"]([^'"]+\.js)['"]/g)) consts.set(m[1], m[2]);
  const routes = new Map();   // url → 레포 파일 — route 가 그 url 에 «레포 .js 파일 글자» 를 준다고 읽히는 꼴만
  /* 꼴 셋(261029 333aa3d9 에서 열어 본 것): ① pathname === 'P' 뒤 300 자 안에 레포 const 이름(body: NAME · js(NAME) 등)
     ② 같은 창 안에 readFileSync(path.join(X, 'js/….js')) 인라인 ③ 명부 객체 { 'P': 'js/….js' } */
  for (const m of text.matchAll(/pathname\s*===\s*['"](\/[^'"]+)['"]/g)) {
    const win = text.slice(m.index, m.index + 300).split(/pathname\s*===/)[1] || '';
    const inl = /readFileSync\(\s*path\.join\(\s*\w+\s*,\s*['"]([^'"]+\.js)['"]/.exec(win);
    if (inl) { routes.set(m[1], inl[1]); continue; }
    for (const [name, rel] of consts) if (new RegExp(`\\b${name}\\b`).test(win)) { routes.set(m[1], rel); break; }
  }
  for (const m of text.matchAll(/['"](\/[^'"\s]+\.js)['"]\s*:\s*['"](js\/[^'"\s]+\.js)['"]/g)) routes.set(m[1], m[2]);
  const out = [];
  const lineAt = (i) => text.slice(0, i).split('\n').length;
  const fake = (p) => !p.includes('${') && p.startsWith('/') && !isRepoFile(p.split('?')[0].slice(1)) && routes.has(p.split('?')[0]);
  for (const m of text.matchAll(TAG)) {
    const attrs = m[1], body = m[2], src = SRC.exec(attrs), mod = MOD.test(attrs);
    if (src) {
      if (fake(src[2])) out.push({ form: mod ? '⑴' : '⑶', line: lineAt(m.index), url: src[2], product: routes.get(src[2].split('?')[0]) });
    } else if (mod) {
      for (const im of body.matchAll(ABS_IMP)) if (fake(im[2])) out.push({ form: '⑵', line: lineAt(m.index + m[0].indexOf(body) + im.index), url: im[2], product: routes.get(im[2]) });
    }
  }
  return out;
}

/** 저장소 전수 — '__harness' 글자 든 tests/**.js(이 파일·잠금 검사 제외) */
function scanRepo(root) {
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); } else if (p.endsWith('.js')) files.push(p); } };
  walk(path.join(root, 'tests'));
  const isRepoFile = (rel) => fs.existsSync(path.join(root, rel)) && fs.statSync(path.join(root, rel)).isFile();
  const rows = [];
  for (const f of files.sort()) {
    const t = fs.readFileSync(f, 'utf8');
    if (!t.includes('__harness') || f.endsWith(path.join('tests', 'harness-fake-paths.js'))) continue;
    const spec = path.relative(root, f).split(path.sep).join('/');
    for (const r of scanSpec(t, isRepoFile)) rows.push({ spec, ...r });
  }
  return rows;
}
/** 명부 열쇠 — 줄 번호는 안 넣는다(위아래 줄이 늘어도 안 흔들림) · 같은 열쇠가 여러 줄이면 그 수만큼 */
const keyOf = (r) => `${r.spec} ${r.form} ${r.url}`;
function compare(rows, roster) {
  const cnt = (keys) => keys.reduce((m, k) => m.set(k, (m.get(k) || 0) + 1), new Map());
  const now = cnt(rows.map(keyOf)), was = cnt(roster.entries || []);
  const grew = [], shrank = [];
  for (const [k, n] of now) if (n > (was.get(k) || 0)) grew.push(`${k} ×${n - (was.get(k) || 0)}`);
  for (const [k, n] of was) if (n > (now.get(k) || 0)) shrank.push(`${k} ×${n - (now.get(k) || 0)}`);
  return { now: rows.length, was: (roster.entries || []).length, grew, shrank };
}
module.exports = { scanSpec, scanRepo, compare, keyOf };

if (require.main === module) {
  const root = path.join(__dirname, '..'), rosterPath = path.join(__dirname, 'unit', 'HARNESS_FAKE_PATHS.json');
  const rows = scanRepo(root);
  const roster = fs.existsSync(rosterPath) ? JSON.parse(fs.readFileSync(rosterPath, 'utf8')) : { entries: [] };
  const v = compare(rows, roster);
  const by = (f) => rows.filter((r) => r.form === f).length;
  console.log(`── harness-fake-paths ── 지금 ${v.now} 줄(⑴ ${by('⑴')} · ⑵ ${by('⑵')} · ⑶ ${by('⑶')}) · 명부 ${v.was} · 늘어남 ${v.grew.length} · 줄어듦 ${v.shrank.length}`);
  console.log('   자 한계: route 가 함수·helper 로 주는 경로 · src 없는 spec · 틀 문자열 경로는 안 본다 ⇒ 이 수는 ≥ 쪽');
  for (const g of v.grew) console.log(`   ⛔늘어남: ${g}`);
  for (const s of v.shrank) console.log(`   ↓ 줄어듦: ${s}`);
  if (process.argv.includes('--record')) {
    if (v.grew.length && fs.existsSync(rosterPath)) { console.error('⛔늘어난 줄이 있어 명부를 안 쓴다 — 가짜 경로를 레포 경로로 고쳐라'); process.exit(1); }   // 명부가 아예 없을 때(첫 세움)만 늘어남을 받는다
    fs.writeFileSync(rosterPath, JSON.stringify({ meta: { what: '제품 파일을 레포와 다른 URL 경로로 싣는 줄(⑴ module+src · ⑵ 인라인 module 절대 import · ⑶ 고전 src) · 합성 제외', by: 'node tests/harness-fake-paths.js --record' }, entries: rows.map(keyOf).sort() }, null, 1) + '\n');
    console.log(`   ✎ 명부 ${rows.length} 줄로 씀`); process.exit(0);
  }
  if (v.grew.length || v.shrank.length) process.exit(1);
}
