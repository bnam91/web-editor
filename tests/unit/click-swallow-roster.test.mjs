/* «끈 뒤 click 한 번 삼키기» 꼴 — 0ms 는 한 벌(js/click-swallow.js) · 120ms·300ms 는 이름 명부 (220 CLICK-SWALLOW-IDIOM-COPIED-SIX-TIMES-01)
 *
 * 까닭(S5 261028 세기 · 판 7f3c6de2): 같은 꼴이 19 자리 14 파일 · 창 셋(0 · 120 · 300ms). 0ms 13 자리를 window.swallowNextClick 하나로 모았다.
 *   ⛔창을 하나로 고르지 않는다(지디) — 120ms 는 179 뿌리(다른 대상 click 까지 먹음)였다 ⇒ 120·300 은 제자리 · 명부로만 잠근다.
 * 자: js/ 아래 .js(주석 뗌) · «capture click 등록 → 그 리스너를 setTimeout(…, N) 이 걷는다» 를 N 으로 가른다 · 명부는 «파일 이름» 이다(⛔줄 번호).
 *   걷는 손 셋(첫 click · 다음 틱 · 다음 mousedown)은 js/click-swallow.js 의 옵션이 옛 꼴 그대로 받는다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { stripComments } = createRequire(import.meta.url)('./_strip-comments.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HELPER = 'js/click-swallow.js';
const ROSTER = Object.freeze({
  120: ['js/block-drag.js', 'js/blocks/mockup-block.js', 'js/effects-ft-handles.js', 'js/overlay-float.js'],
  300: ['js/gradient-line-overlay.js'],
});
const FLAG_300 = ['js/editor.js'];   // 깃발 꼴(_swallowPanClick · 리스너 아님) — 이 자 밖이라 이름만 지킨다

/** i 를 감싼 가장 안쪽 { … } 블럭(괄호 맞추기 · 문자열 속 괄호는 안 가림 — 이 자의 한계 · 대상 꼴엔 없음) */
function enclosingBlock(src, i) {
  let d = 0, a = i;
  for (; a >= 0; a--) { if (src[a] === '}') d++; else if (src[a] === '{') { if (d === 0) break; d--; } }
  if (a < 0) return src;
  d = 0; let b = a;
  for (; b < src.length; b++) { if (src[b] === '{') d++; else if (src[b] === '}') { d--; if (d === 0) break; } }
  return src.slice(a, b + 1);
}
/** src 안 «capture click 등록 + 그 이름을 걷는 setTimeout 의 ms» 목록 */
function scan(src) {
  const out = [];
  const reg = /(\w+)\.addEventListener\(\s*'click'\s*,\s*([\w$]+)\s*,\s*(?:true|\{[^}]*capture:\s*true[^}]*\})\s*\)/g;
  for (const m of src.matchAll(reg)) {
    const name = m[2];
    const tail = enclosingBlock(src, m.index);   // 등록을 «감싼 블럭»(구조) 안에서만 — ⛔고정 창(tests/unit/fixed-window-census) · 타이머가 등록 앞에 와도 잡힌다(gradient-line-overlay 꼴)
    const t = tail.match(new RegExp(`setTimeout\\(\\s*\\(\\)\\s*=>\\s*\\w+\\.removeEventListener\\(\\s*'click'\\s*,\\s*${name.replace('$', '\\$')}[^)]*\\)\\s*,\\s*(\\d+)\\s*\\)`))
      || tail.match(/setTimeout\(\s*(?:done|cleanup)\s*,\s*(\d+)\s*\)/);
    if (t) out.push(Number(t[1]));
  }
  return out;
}
function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? (d.name === 'vendor' ? [] : jsFiles(p)) : (d.name.endsWith('.js') ? [p] : []);
  });
}
const census = () => {
  const by = { 0: [], 120: [], 300: [], other: [] };
  for (const f of jsFiles(path.join(ROOT, 'js'))) {
    const rel = path.relative(ROOT, f).split(path.sep).join('/');
    for (const ms of scan(stripComments(fs.readFileSync(f, 'utf8')))) (by[ms] || by.other).push(rel + (by[ms] ? '' : ':' + ms));
  }
  return by;
};

test('S1 자가 산다 — 옛 0ms 사본·120ms 꼴은 잡고 · 상시 capture 는 안 잡는다', () => {
  const OLD0 = `const eat = (ce) => { ce.stopPropagation(); }; window.addEventListener('click', eat, { capture: true, once: true }); setTimeout(() => window.removeEventListener('click', eat, true), 0);`;
  const FN0 = `const swallow = (ev) => { ev.stopPropagation(); document.removeEventListener('click', swallow, true); }; document.addEventListener('click', swallow, true); setTimeout(() => document.removeEventListener('click', swallow, true), 0);`;
  const K120 = `document.addEventListener('click', killClick, true); setTimeout(() => document.removeEventListener('click', killClick, true), 120);`;
  const ALWAYS = `document.addEventListener('click', onPanelAct, true);`;
  const T300PRE = `const kill = (ev) => { cleanup(); }; const cleanup = () => { window.removeEventListener('click', kill, true); clearTimeout(tm); }; const tm = setTimeout(cleanup, 300); window.addEventListener('click', kill, true);`;
  assert.deepEqual([scan(OLD0), scan(FN0), scan(K120), scan(ALWAYS), scan(T300PRE)], [[0], [0], [120], [], [300]]);
});

test('S2 0ms 꼴은 js/click-swallow.js 한 벌뿐 — 사본이 다시 생기면 빨강', () => {
  const by = census();
  console.log(`    0ms ${by[0].length}(${[...new Set(by[0])].join(',')}) · 120ms ${by[120].length} · 300ms ${by[300].length} · 그 밖 ${by.other.length}`);
  assert.deepEqual([...new Set(by[0])], [HELPER], '0ms «다음 click 삼키기» 는 window.swallowNextClick 을 불러라(새 사본 금지)');
  assert.equal(by[0].length, 1);
});

test('S3 120ms·300ms 명부 = 실측 (양방향 · 이름)', () => {
  const by = census();
  for (const ms of [120, 300]) {
    const got = [...new Set(by[ms])].sort();
    assert.deepEqual(got, [...ROSTER[ms]].sort(), `${ms}ms 꼴 명부 ↔ 실측 — 새 자리면 명부에 올리기 전에 «창을 왜 그 값으로» 를 물어라(지디 220)`);
  }
  assert.deepEqual(by.other, [], '0·120·300 밖의 창이 생겼다');
  for (const f of FLAG_300) assert.match(fs.readFileSync(path.join(ROOT, f), 'utf8'), /_swallowPanClick/);
});

test('S4 부르는 자리 13 — 파일별 수(양방향)', () => {
  const want = { 'js/annotation-select.js': 4, 'js/blocks/modal-block.js': 1, 'js/blocks/radial-block.js': 1, 'js/drag-utils.js': 2, 'js/overlay-handles.js': 1,
    'js/scratch-pad.js': 1, 'js/section-bottom-handle.js': 1, 'js/sticker-select.js': 1, 'js/table-cell-select.js': 1 };
  const got = {};
  for (const f of jsFiles(path.join(ROOT, 'js'))) {
    const n = (stripComments(fs.readFileSync(f, 'utf8')).match(/window\.swallowNextClick\(/g) || []).length;
    if (n) got[path.relative(ROOT, f).split(path.sep).join('/')] = n;
  }
  assert.deepEqual(got, want);
  assert.match(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), /<script src="js\/click-swallow\.js"><\/script>/, 'index.html 이 그 한 벌을 싣는다');
});
