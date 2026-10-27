/* waitForFunction 에 «Promise 를 돌려주는 술어»를 넘기면 그 Promise 가 «참»으로만 풀려야 한다 — 시트 182
 *
 * 까닭(실측 · S5 가드 자 ×3): Playwright 는 Promise 술어를 «한 번» 부르고 그 값을 기다릴 뿐 다시 안 부른다.
 *   거짓으로 풀려도 waitForFunction 은 그대로 돌아온다 — 요소가 없는 장면에서 옛 `__s5mk` 가드가 22~24ms 에 풀렸다.
 *   ⇒ «거짓으로 풀릴 수 있는 Promise 술어» = 아무것도 안 기다리는 가드. 조건 대기는 동기 술어 + polling 으로 쓴다.
 * 자: tests/ 아래 .js·.mjs(주석 뗌) · `waitForFunction(<화살표> => new Promise((r) => …))` 의 몸에서
 *   풀개(r) 부름의 인자가 전부 글자 그대로 `true` 인가. 지금 꼴 = 두 rAF 기다리기·스크롤 멎음 루프(전부 r(true)). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { stripComments } = createRequire(import.meta.url)('./_strip-comments.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HEAD = /waitForFunction\(\s*(?:\([^)]*\)|\w+)\s*=>\s*new Promise\(\s*\(?\s*(\w+)\s*\)?\s*=>/g;

/** src 안 Promise 술어마다 { line, resolver, bad: [거짓일 수 있는 풀개 부름] }. */
function scan(src) {
  const out = [];
  for (const m of src.matchAll(HEAD)) {
    const start = m.index + m[0].length;
    let depth = 1, i = src.lastIndexOf('new Promise(', start) + 'new Promise('.length;
    for (; i < src.length && depth > 0; i++) { if (src[i] === '(') depth++; else if (src[i] === ')') depth--; }
    const body = src.slice(start, i - 1);
    const bad = [];
    for (const c of body.matchAll(new RegExp(`\\b${m[1]}\\(([^()]*(?:\\([^()]*\\)[^()]*)*)\\)`, 'g'))) if (c[1].trim() !== 'true') bad.push(c[0]);
    out.push({ line: src.slice(0, m.index).split('\n').length, resolver: m[1], bad });
  }
  return out;
}
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return d.name === 'node_modules' ? [] : files(p);
    return /\.(m?js)$/.test(d.name) && p !== fileURLToPath(import.meta.url) ? [p] : [];
  });
}

test('P1 자가 산다 — 옛 __s5mk 가드 꼴은 잡고 · 두 rAF·멎음 루프 꼴은 안 잡는다', () => {
  const OLD = `await page.waitForFunction(() => new Promise((res) => { const b = document.getElementById('x'); if (!b) return res(false);
    requestAnimationFrame(() => requestAnimationFrame(() => res(document.getElementById('x') === b && b.__s5mk >= 2))); }));`;
  const RAF2 = `await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));`;
  const LOOP = `await page.waitForFunction(() => new Promise((resolve) => { const tick = () => { if (same >= 12) resolve(true); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }));`;
  assert.deepEqual(scan(OLD).map((s) => s.bad.length), [2]);
  assert.deepEqual(scan(RAF2).map((s) => s.bad.length), [0]);
  assert.deepEqual(scan(LOOP).map((s) => s.bad.length), [0]);
});

test('P2 레포의 Promise 술어는 «참»으로만 풀린다', () => {
  const hits = [];
  let n = 0;
  for (const f of files(path.join(ROOT, 'tests'))) {
    for (const s of scan(stripComments(fs.readFileSync(f, 'utf8')))) {
      n++;
      if (s.bad.length) hits.push(`${path.relative(ROOT, f)}:${s.line} ${s.bad.join(' · ')}`);
    }
  }
  console.log(`    Promise 술어 ${n}곳 · 거짓일 수 있는 풀개 ${hits.length}곳`);
  assert.ok(n > 0, '전제 — tests/ 에서 Promise 술어를 하나도 못 찾았다(자가 죽었거나 뿌리가 틀렸다)');
  assert.deepEqual(hits, [], '거짓으로 풀릴 수 있는 Promise 술어 — 한 번 부르고 끝나 아무것도 안 기다린다. 동기 술어 + { polling } 으로');
});
