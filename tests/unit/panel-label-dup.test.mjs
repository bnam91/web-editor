/* panel-label-dup.test.mjs — 공용 조각이 «절 제목을 되풀이하는 라벨»·«절 안 절 제목»을 안 낸다. (right-panel-unify U0b ⑤⑥)
 *   실행: node --test tests/unit/panel-label-dup.test.mjs
 *   L1 js/overlay-float.js floatPositionRowHTML — 윗줄 라벨이 SECTION_TITLE 의 어떤 제목과도 같지 않다(옛 「Position」 = Position 절 되풀이)
 *      + X/Y 칸 id·aria 그대로(#P-x-number · #P-y-number)
 *   N1 ★양성대조 — 라벨을 옛 「Position」 으로 되돌린 판이면 L1 판정이 빨강
 *   (⑥ radial-arrange 는 아래 L2 · N2 — 다음 커밋)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const { readSrc } = createRequire(import.meta.url)('./_srcread.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

function sectionTitles() {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(readSrc(ROOT, 'js/props/_section-spec.js').replace(/^export\s+/gm, '') + ';globalThis.__S = SECTION_TITLE;', ctx);
  return Object.values(ctx.__S);
}
const TITLES = sectionTitles();
/** 마크업 → 윗줄 라벨·.prop-label 글 중 절 제목과 같은 것 */
const dupLabels = (html) => [...html.matchAll(/class="prop-(?:field-)?label[^"]*"[^>]*>([^<]*)</g)].map((m) => m[1].trim()).filter((t) => TITLES.includes(t));

function floatRow(src = readSrc(ROOT, 'js/overlay-float.js')) {
  const m = /export function floatPositionRowHTML\([\s\S]*?\n\}/.exec(src);
  assert.ok(m, '★floatPositionRowHTML 을 못 찾았다');
  const f = new Function(m[0].replace('export ', '') + '; return floatPositionRowHTML;')();
  return f({ prefix: 'asset', posEl: { dataset: { overlayBlock: 'true', offsetX: '12', offsetY: '34' } } });
}

test('L1 floatPositionRowHTML — 라벨이 절 제목을 되풀이하지 않고 X/Y 칸은 그대로', () => {
  const html = floatRow();
  assert.deepEqual(dupLabels(html), [], '★라벨이 절 제목을 되풀이한다');
  assert.match(html, /<span class="prop-field-label">[^<]+<\/span>\s*<div class="prop-lhls-row">/, '★윗줄 라벨 자리가 사라졌다(grid-xy-position P1 의 앞 형제 꼴)');
  assert.match(html, /id="asset-x-number" value="12" aria-label="X position"/);
  assert.match(html, /id="asset-y-number" value="34" aria-label="Y position"/);
});

test('N1 ★양성대조 — 라벨을 옛 「Position」 으로 되돌리면 빨강', () => {
  const src = readSrc(ROOT, 'js/overlay-float.js');
  const ANCHOR = '<span class="prop-field-label">X / Y</span>';
  assert.ok(src.includes(ANCHOR), '★변이 닻을 못 찾았다');
  assert.deepEqual(dupLabels(floatRow(src.replace(ANCHOR, '<span class="prop-field-label">Position</span>'))), ['Position']);
});
