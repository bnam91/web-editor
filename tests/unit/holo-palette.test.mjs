/* holo-palette — FX-GRADIENT-GAZE-01(현빈 261121 가안 «계산 그라데이션») ③ 배지 CSS 변수화: 색 정본 js/fx/holo-palette.js ↔ css/editor-blocks.css --holo-* 가 같다.
 * P1 배지 4색(silver=기본 .badge-hologram-square · gold/rose/pearl = .color-*) 의 --holo-c1..c7 = HOLO_PRESETS 같은 이름 · --holo-from = 210deg
 * P2 배지 conic 은 var(--holo-c1..c7) 만 읽는다(같은 정지각 HOLO_STOP_DEG · 고리 = c1) — 색 글자를 다시 박지 않았다
 * P3 holoConicCss / holoAngularStops 꼴(정지 8 · 끝 = 첫 색 · 0..1)
 * 픽셀 같음(고치기 전/뒤 배지 4색 0px 차) = 지혜맥 실앱 png 비교 _patches/gaze-badge-same(커밋 메시지).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readSrc } from './_srcread.js';
import { createRequire } from 'node:module';
const { sliceBlock } = createRequire(import.meta.url)('./_slice-block.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const H = await import(pathToFileURL(path.join(ROOT, 'js/fx/holo-palette.js')).href);
const CSS = readSrc(ROOT, 'css', 'editor-blocks.css');
const block = (sel) => sliceBlock(CSS, sel + ' {', `[전제] ${sel} 규칙`);   // 짝 괄호로 자름(slice-block-shared SB-16)
const varsOf = (b) => Array.from({ length: 7 }, (_, k) => (new RegExp(`--holo-c${k + 1}:\\s*(#[0-9a-f]{6})`, 'i').exec(b) || [])[1]?.toLowerCase());

test('P1 배지 4색 = 정본', () => {
  const base = block('.badge-hologram-square');
  assert.deepEqual(varsOf(base), [...H.HOLO_PRESETS.silver]);
  assert.match(base, /--holo-from:\s*210deg/); assert.equal(H.HOLO_FROM_DEG, 210);
  for (const c of ['gold', 'rose', 'pearl']) assert.deepEqual(varsOf(block(`.badge-hologram-row.color-${c} .badge-hologram-square`)), [...H.HOLO_PRESETS[c]], c);
});

test('P2 배지 conic 은 변수만', () => {
  const want = 'conic-gradient(from var(--holo-from) at 50% 50%,' + H.HOLO_STOP_DEG.map((d, i) => ` var(--holo-c${(i % 7) + 1}) ${d}deg`).join(',');
  const norm = (s) => s.replace(/\s+/g, ' ');
  for (const sel of ['.badge-hologram-square', '.badge-hologram-row.color-gold .badge-hologram-square', '.badge-hologram-row.color-rose .badge-hologram-square', '.badge-hologram-row.color-pearl .badge-hologram-square']) {
    const b = norm(block(sel));
    assert.ok(b.includes(norm(want)), `${sel} conic = 변수`);
    assert.doesNotMatch(b.slice(b.indexOf('conic-gradient')), /#[0-9a-f]{6}/i, `${sel} conic 안 hex 0`);
  }
});

test('P3 holoConicCss · holoAngularStops', () => {
  assert.equal(H.holoConicCss('gold', 30), 'conic-gradient(from 30deg at 50% 50%, ' + H.HOLO_STOP_DEG.map((d, i) => `${H.HOLO_PRESETS.gold[i % 7]} ${d}deg`).join(', ') + ')');
  assert.equal(H.holoConicCss('nope'), H.holoConicCss('silver'));
  const s = H.holoAngularStops('oil');
  assert.equal(s.length, 8); assert.equal(s[0].position, 0); assert.equal(s[7].position, 1); assert.equal(s[7].color, s[0].color);
  assert.equal(H.HOLO_KEYS.length, 6);
});
