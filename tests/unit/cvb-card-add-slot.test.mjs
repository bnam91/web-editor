/* cvb-card-add-slot — 카드 블럭 «캔버스 ＋ 로 줄 추가»(1012t1K1)의 판정 함수 cvbMissingTextSlots.
 *
 * ★무엇을 지키나: 「어느 카드의 어느 줄이 비어 ＋ 가 떠야 하나」를 렌더(_appendCardTexts)와
 *   «같은 폴백»(_cvbSlotTexts)으로 정한다. 둘이 갈리면 ＋ 가 «이미 보이는 줄»에 뜨거나
 *   «빈 줄»에 안 뜬다(특히 both 모드 descTop undefined → desc 폴백).
 * ★실제 소스를 import 한다(cvb-card-inline.test.js 와 같은 스텁 사본 꼴) — 판정 로직을 베끼지 않는다.
 *   ⛔canvas-block.js 의 import 줄이 바뀌면 아래 치환이 «못 찾음»으로 빨개진다(조용히 안 지나간다).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readSrc } from './_srcread.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function stubCopy(relSrc, replacements, tag) {
  let src = readSrc(path.join(__dirname, '../../', relSrc));
  for (const [from, to] of replacements) {
    const prev = src;
    src = src.replace(from, to);
    assert.notEqual(src, prev, `${relSrc} 에서 다음을 못 찾음 — 리팩터링됐나?\n${from}`);
  }
  const out = path.join(os.tmpdir(), `${tag}-${process.pid}-${Math.random().toString(36).slice(2, 8)}.mjs`);
  fs.writeFileSync(out, src);
  return pathToFileURL(out).href;
}

/* 미니 DOM — _appendCardTexts 가 쓰는 표면만(createElement · className · dataset · style · appendChild) */
function makeEl(tag) {
  return { tagName: tag, className: '', dataset: {}, style: {}, textContent: '', children: [],
    appendChild(c) { this.children.push(c); return c; } };
}

let CVB;
before(async () => {
  const url = stubCopy('js/blocks/canvas-block.js', [
    ["import { genId, showNoSelectionHint, insertAfterSelected, colorLuminance } from '../drag-utils.js';\nimport { bindBlock } from '../drag-drop.js';\nimport { checkerBg } from '../checker-tokens.js';",
     "const checkerBg = () => ''; const genId = (p) => p + '_x'; const showNoSelectionHint = () => {}; const insertAfterSelected = () => {}; const colorLuminance = () => null; const bindBlock = () => {};"],
    ["import { effSectionPadX as _effSectionPadX } from './outer-pad.js';", 'const _effSectionPadX = () => 0;'],
    /* t5-16(261026) — canvas-block 이 카드 높이 자 card-limits.js 를 import 한다. 잎 모듈(값만)이라 스텁 대신 «진짜 파일»의 글을 그 자리에 싣는다(export 만 뗀다 · 값 사본 0 · .js 는 CJS 로 읽혀 URL import 가 안 된다). */
    ["import { CVB_H_MIN, CVB_H_MAX } from './card-limits.js';", fs.readFileSync(path.join(__dirname, '../../js/blocks/card-limits.js'), 'utf8').replace(/^export /gm, '')],
    /* ★1017t1d1 — canvas-block.js 가 line-host.js 를 import 하기 시작했다(심플카드 「줄」). 이 시험은
       cvbMissingTextSlots 만 보고 어느 카드도 .lines 를 안 쓴다 ⇒ lnHasLines 는 항상 false 로 충분하다.
       ⇒ ⒜-2 주석의 그 규약 그대로 — import 가 늘면 이 하네스 명부를 세고 스텁을 더한다. */
    ["import { lnHasLines, lnLinesHtml, lnValidateLines, lnRemark, LN_KINDS } from './line-host.js';",
     "const lnHasLines = () => false; const lnLinesHtml = () => ''; const lnValidateLines = () => null; const lnRemark = () => {}; const LN_KINDS = [];"],
  ], 'cvb-add-slot');
  globalThis.window = globalThis.window || globalThis;
  globalThis.document = globalThis.document || { createElement: makeEl, getElementById: () => null };
  CVB = await import(url);
  assert.equal(typeof CVB.cvbMissingTextSlots, 'function', '전제: cvbMissingTextSlots 가 export 됐다');
});

test('U1 기본 카드(제목만) → 설명 한 줄이 빈 줄', () => {
  assert.deepEqual(CVB.cvbMissingTextSlots({ title: '제목', desc: '' }, 'bottom', undefined), [{ slot: null, field: 'desc' }]);
  assert.deepEqual(CVB.cvbMissingTextSlots({ title: '제목' }, undefined, 'false'), [{ slot: null, field: 'desc' }]);
  assert.deepEqual(CVB.cvbMissingTextSlots({ title: '제목', desc: '   ' }, 'top', ''), [{ slot: null, field: 'desc' }], '공백만 = 빔(렌더와 같은 술어)');
});

test('U1b 설명만 있으면 제목 줄이 빈 줄 · 둘 다 있으면 []', () => {
  assert.deepEqual(CVB.cvbMissingTextSlots({ title: '', desc: '설명' }, 'bottom'), [{ slot: null, field: 'title' }]);
  assert.deepEqual(CVB.cvbMissingTextSlots({ title: '제목', desc: '설명' }, 'bottom'), []);
});

test('U2 둘 다 빔 → [] (안내문 .cvb-card-ph 가 맡는다)', () => {
  assert.deepEqual(CVB.cvbMissingTextSlots({ title: '', desc: '' }, 'bottom'), []);
  assert.deepEqual(CVB.cvbMissingTextSlots({}, 'both'), []);
});

test('U3 both — 위 설명만 빔 → top 슬롯 descTop 하나', () => {
  const card = { title: '제목', desc: '', descTop: '', descBottom: '아래 설명' };
  assert.deepEqual(CVB.cvbMissingTextSlots(card, 'both'), [{ slot: 'top', field: 'descTop' }]);
});

test('U4 both — descTop undefined 는 desc 로 폴백한다(렌더와 같은 폴백)', () => {
  assert.deepEqual(CVB.cvbMissingTextSlots({ title: '제목', desc: '공용 설명' }, 'both'), [], 'desc 가 차 있으면 위·아래 모두 보인다 → 빈 줄 없음');
  assert.deepEqual(CVB.cvbMissingTextSlots({ title: '제목', desc: '' }, 'both'),
    [{ slot: 'top', field: 'descTop' }, { slot: 'bottom', field: 'descBottom' }]);
  assert.deepEqual(CVB.cvbMissingTextSlots({ title: '제목', desc: '공용', descTop: null }, 'both'), [], 'null 도 폴백');
});

test('U5 textHide → []', () => {
  assert.deepEqual(CVB.cvbMissingTextSlots({ title: '제목' }, 'bottom', 'true'), []);
  assert.deepEqual(CVB.cvbMissingTextSlots({ title: '제목' }, 'both', true), []);
});

test('U5b 가로(landscape)는 labelPos both 라도 슬롯 하나(renderCanvas 가로 분기와 같다)', () => {
  assert.deepEqual(CVB.cvbMissingTextSlots({ title: '제목' }, 'both', undefined, 'landscape'), [{ slot: null, field: 'desc' }]);
});

test('U6 렌더 대조 — _appendCardTexts 가 «한쪽만» 그린 영역과 빈 줄 목록이 같다', () => {
  const cards = [
    { title: '제목' }, { desc: '설명' }, { title: 'a', desc: 'b' }, {},
    { title: '제목', desc: '', descTop: '', descBottom: '아래' },
    { title: '제목', desc: '공용' }, { title: '', titleTop: '위제목', desc: '' },
    { title: '제목', desc: '공용', descBottom: '' },
  ];
  let checked = 0;
  for (const card of cards) {
    for (const labelPos of ['bottom', 'both']) {
      const slots = labelPos === 'both' ? ['top', 'bottom'] : [null];
      const expect = [];
      for (const slot of slots) {
        const c = makeEl('div');
        CVB._appendCardTexts(c, card, 20, 14, 'left', '#000', '#333', 0, slot);
        const t = c.children.find(e => e.className === 'cvb-card-title');
        const d = c.children.find(e => e.className === 'cvb-card-desc');
        if (t && !d) expect.push({ slot, field: t.dataset.field.replace(/^title/, 'desc') });
        if (d && !t) expect.push({ slot, field: d.dataset.field.replace(/^desc/, 'title') });
      }
      assert.deepEqual(CVB.cvbMissingTextSlots(card, labelPos), expect, `${JSON.stringify(card)} · ${labelPos}`);
      checked++;
    }
  }
  assert.equal(checked, 16, '전제: 대조한 경우의 수');
});
