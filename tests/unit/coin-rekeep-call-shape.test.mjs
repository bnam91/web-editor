/* coin-rekeep-call-shape — `_rekeepCoin` 을 부르는 자리는 «전부» `window._rekeepCoin?.(` 꼴이다(1013t2r2 S1FIX).
 *
 * ★왜 — `_rekeepCoin` 은 js/sticker-select.js 가 정의하고 window 에 건다. 다른 파일(sticker-block.js ·
 *   prop-sticker-coin.js)은 window 경유 `?.` 로 부른다. sticker-select.js 의 코너 리사이즈 onUp 한 자리만
 *   맨 이름으로 불러 꼴이 갈렸다 — 그 함수를 떼어 싣는 곳(tests/dom/resize-undo-history.dom.spec.js 의
 *   sliceBlock)에서 ReferenceError 로 드러났다.
 * ★무엇을 잠그나
 *   K1 js/ 전체에서 부르는 자리를 센다 — 세 파일에 하나씩, 셋 다 `window._rekeepCoin?.(` · 맨 이름 0
 *   K2 셈 자(callSites)의 반례 한 쌍 — 맨 이름·`?.` 없는 window 호출은 «나쁨»으로, 주석·정의는 «안 셈»으로 잡는다
 * ★주석은 걷고 센다(주석 안의 이름은 호출이 아니다).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[\s;{}(),])\/\/.*$/gm, '$1');
}
/* 부르는 자리 — 정의(`function _rekeepCoin(`)와 대입(`= _rekeepCoin;`)은 호출이 아니다. */
function callSites(src) {
  const out = [];
  const lines = stripComments(src).split('\n');
  const re = /(window\.)?_rekeepCoin\s*(\?\.)?\s*\(/g;
  lines.forEach((l, i) => {
    for (const m of l.matchAll(re)) {
      if (/function\s+$/.test(l.slice(0, m.index))) continue;
      out.push({ line: i + 1, good: !!m[1] && !!m[2], text: l.trim() });
    }
  });
  return out;
}
function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? jsFiles(p) : (d.name.endsWith('.js') ? [p] : []);
  });
}

test('K1 js/ 전체 — `_rekeepCoin` 호출은 세 파일에 하나씩이고 셋 다 window._rekeepCoin?.( 꼴', () => {
  const found = {};
  for (const f of jsFiles(path.join(REPO, 'js'))) {
    const sites = callSites(fs.readFileSync(f, 'utf8'));
    if (sites.length) found[path.relative(REPO, f)] = sites;
  }
  assert.deepEqual(Object.keys(found).sort(), ['js/blocks/sticker-block.js', 'js/props/prop-sticker-coin.js', 'js/sticker-select.js']);
  for (const [f, sites] of Object.entries(found)) {
    assert.equal(sites.length, 1, `${f}: 부르는 자리 ${sites.length}개`);
    assert.equal(sites[0].good, true, `${f}:${sites[0].line} 맨 이름(또는 ?. 없는) 호출 — ${sites[0].text}`);
  }
  const bare = Object.values(found).flat().filter((s) => !s.good);
  assert.equal(bare.length, 0);
});

test('K2 셈 자의 반례 한 쌍 — 나쁜 꼴은 잡고 좋은 꼴은 놓아준다 · 주석·정의는 안 센다', () => {
  assert.deepEqual(callSites('  _rekeepCoin(block);   // 코인').map((s) => s.good), [false]);
  assert.deepEqual(callSites('  window._rekeepCoin(block);').map((s) => s.good), [false]);
  assert.deepEqual(callSites('  window._rekeepCoin?.(block);').map((s) => s.good), [true]);
  assert.deepEqual(callSites('  window._rekeepCoin?.(b);  // _rekeepCoin(b) 를 부른다').map((s) => s.good), [true]);
  assert.deepEqual(callSites('/* _rekeepCoin(block) */\n// _rekeepCoin(block)\nfunction _rekeepCoin(block) {\nwindow._rekeepCoin = _rekeepCoin;'), []);
});
