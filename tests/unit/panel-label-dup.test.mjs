/* panel-label-dup.test.mjs — 공용 조각이 «절 제목을 되풀이하는 라벨»·«절 안 절 제목»을 안 낸다. (right-panel-unify U0b ⑤⑥)
 *   실행: node --test tests/unit/panel-label-dup.test.mjs
 *   L1 js/overlay-float.js floatPositionRowHTML — 윗줄 라벨이 SECTION_TITLE 의 어떤 제목과도 같지 않다(옛 「Position」 = Position 절 되풀이)
 *      + X/Y 칸 id·aria 그대로(#P-x-number · #P-y-number)
 *   N1 ★양성대조 — 라벨을 옛 「Position」 으로 되돌린 판이면 L1 판정이 빨강
 *   L2 js/radial-arrange.js circleSampleRowHTML — 절 안에 .prop-section-title 을 안 낸다 · 틀의 fieldRowHTML 로 · #icb-sample-row 그대로
 *   N2 ★양성대조 — 옛 꼴(절 제목 div)을 되살린 판이면 L2 판정이 빨강
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

/* ⑥ — radial-arrange.js 는 모듈 그래프(radial-geom · samples · frame-geometry · _panel-frame)가 커서 «소스 꼴»을 잰다.
   행위(샘플 단추 클릭)는 기존 DOM 시험이 #icb-sample-row 로 잰다 — 이 칸은 «절 안 절 제목 0» 만. */
const { stripComments } = createRequire(import.meta.url)('./_strip-comments.js');
function sampleRowBody(src = readSrc(ROOT, 'js/radial-arrange.js')) {
  const m = /function circleSampleRowHTML\(block\) \{[\s\S]*?\n\}/.exec(stripComments(src));
  assert.ok(m, '★circleSampleRowHTML 을 못 찾았다');
  return m[0];
}
const nestedTitle = (body) => /class="prop-section-title"/.test(body);

test('L2 circleSampleRowHTML — 절 제목 없이 fieldRowHTML 한 줄 · #icb-sample-row 그대로', () => {
  const body = sampleRowBody();
  assert.equal(nestedTitle(body), false, '★절 안에 .prop-section-title 이 있다');
  assert.match(body, /return fieldRowHTML\('샘플 그림',/, '★틀의 필드 줄을 안 쓴다');
  assert.match(body, /id="icb-sample-row"/);
  assert.match(readSrc(ROOT, 'js/radial-arrange.js'), /import \{ fieldRowHTML \} from '\.\/props\/_panel-frame\.js';/);
});

test('N2 ★양성대조 — 옛 절 제목 div 를 되살리면 빨강', () => {
  const src = readSrc(ROOT, 'js/radial-arrange.js');
  const ANCHOR = "return fieldRowHTML('샘플 그림', `";
  assert.ok(src.includes(ANCHOR), '★변이 닻을 못 찾았다');
  assert.equal(nestedTitle(sampleRowBody(src.replace(ANCHOR, ANCHOR + '\n      <div class="prop-section-title" style="padding-top:10px;">샘플 그림</div>'))), true);
});
