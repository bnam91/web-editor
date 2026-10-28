/* 저장 세척(serializeCleanRoot)의 245 자리는 «.section-block» 만 건드린다 — 범위가 넓어지면 빨강
 *
 * 까닭(지디 261029 · 호출 자리로 받침): 섹션은 열 때 data-bg-img 에서 style 을 다시 칠한다(js/io/save-load.js ·
 *   `if (sec.dataset.bgImg && !sec.style.backgroundImage)` — 열기·⌘Z·템플릿 넣기 세 길 · S5 앱 ×3).
 *   프레임·캔버스 블럭은 열 때 다시 칠하는 자리가 0 이다(applyFrameBgImageInline 실호출 image-handling.js · prop-frame.js 뿐 ·
 *   block-factory.js 주석 «canvas 는 inline style 만으로 영속 · dataset.bgImg 는 참조용») ⇒ 그쪽 style 을 빼면 그림이 죽는다.
 * 자: 주석 뗀 serializeCleanRoot 본문에서 «data-bg-img 를 가진 요소의 style.backgroundImage 를 비우는» 자리를 찾아,
 *   그 querySelectorAll 선택자가 정확히 '.section-block[data-bg-img]' 인지 · 같은 꼴의 다른 선택자가 없는지.
 * 한 쌍(커밋 메시지): 선택자를 '[data-bg-img]' 로 넓힌 사본 → S1 빨강 · GD1001_ROOT 로 읽힌다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { sliceBlock } = require('./_slice-block.js');
const { stripComments } = require('./_strip-comments.js');

const ROOT = process.env.GD1001_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js/io/section-serialize.js'), 'utf8');

/** body 안 «querySelectorAll(<sel>).forEach(… => { … style.backgroundImage = '' … })» 의 sel 목록(data-bg-img 를 보는 것만) */
function clearSites(body) {
  const out = [];
  const re = /querySelectorAll\(\s*(['"])([^'"]*data-bg-img[^'"]*)\1\s*\)\s*\.forEach\(/g;
  for (const m of body.matchAll(re)) {
    const open = body.indexOf('{', m.index + m[0].length);
    let d = 0, i = open; for (; i < body.length; i++) { if (body[i] === '{') d++; else if (body[i] === '}') { d--; if (d === 0) break; } }
    if (/style\.backgroundImage\s*=\s*(['"])\1/.test(body.slice(open, i))) out.push(m[2]);
  }
  return out;
}

test('S0 자가 산다 — 섹션 한정은 잡고 · 넓힌 것도 잡고 · data-bg-img 안 보는 forEach 는 안 잡는다', () => {
  const A = "root.querySelectorAll('.section-block[data-bg-img]').forEach(el => { if (x) el.style.backgroundImage = ''; });";
  const B = "root.querySelectorAll('[data-bg-img]').forEach(el => { el.style.backgroundImage = ''; });";
  const C = "root.querySelectorAll('[data-lazy-bg]').forEach(el => { el.style.backgroundImage = el.getAttribute('data-lazy-bg'); });";
  assert.deepEqual([clearSites(A), clearSites(B), clearSites(C)], [['.section-block[data-bg-img]'], ['[data-bg-img]'], []]);
});

test('S1 serializeCleanRoot 의 245 자리 = 정확히 하나 · 선택자 .section-block[data-bg-img](프레임·캔버스 무접촉)', () => {
  const body = stripComments(sliceBlock(SRC, '  function serializeCleanRoot(root) {'));
  assert.deepEqual(clearSites(body), ['.section-block[data-bg-img]'], '섹션 밖(프레임·캔버스)의 style 배경을 빼면 열 때 다시 칠하는 자리가 없어 그림이 죽는다(245)');
});
