/* u3-unwrap-typo-fill.test.mjs — 모달 패널(U3)이 _typo-section 빌더의 «절 통째»를 _panel-frame.js unwrapSection 으로 벗겨
 * Typography·Fill 절 «몸통»으로 넣는다. 몸통에 옛 절 제목(.prop-section-title)이 남으면 절 안에 절 머리가 하나 더 선다(제목 두 번).
 * U1 몸통에 prop-section-title 0 · 껍데기(.prop-section) 0 · 컨트롤(mdl-typo-*) 은 그대로.
 * U2 prop-modal.js 가 실제로 그 둘을 unwrapSection 으로 감싼다(소스).
 * 양성대조(내장 N1): 벗기기 «전» 원문엔 prop-section-title 이 있다 — 없으면 U1 의 0 은 공짜다.
 *   바깥 양성대조: unwrapSection 의 제목 지우기 줄(else inner = inner.replace(...))을 빼면 U1 빨강.
 * ★빌더 소스를 그대로 돌린다(베끼지 않는다 — modal-typo-model.test.mjs buildTypoMarkup 과 같은 꼴). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const strip = (rel) => read(rel).replace(/^import[^\n]*\n/gm, '').replace(/^export\s+/gm, '');

function build() {
  const frame = read('js/props/_panel-frame.js');
  const a = frame.indexOf('export function unwrapSection(');
  assert.ok(a > 0, '★unwrapSection 을 못 찾았다');
  const b = frame.indexOf('\n}\n', a) + 2;
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  vm.runInContext(`${strip('js/props/prop-text-utils.js')}\n;${strip('js/props/_typo-section.js')}
    ;${frame.slice(a, b).replace(/^export\s+/, '')}
    ;globalThis.__RAW = [buildTypographySectionHtml({ p:'mdl-typo', font:'', weight:'', size:36, isBold:false, isItalic:false, isStrike:false, isHighlight:false, lh:1.7, ls:0, sizeMin:10, sizeMax:60 }),
                         buildFillSectionHtml({ p:'mdl-typo', colorHex:'#1c1c1e', alpha:100 })];
    ;globalThis.__OUT = __RAW.map((h) => unwrapSection(h));`, ctx, { filename: 'u3-unwrap-typo-fill' });
  return { raw: ctx.__RAW, out: ctx.__OUT };
}

test('N1 [전제·양성대조] 벗기기 전 원문엔 절 제목이 있다', () => {
  const { raw } = build();
  for (const h of raw) assert.match(h, /class="prop-section-title"/, '★원문에 제목이 없다 — U1 의 0 이 공짜다');
});

test('U1 unwrapSection 몸통 — prop-section-title 0 · .prop-section 껍데기 0 · 컨트롤은 그대로', () => {
  const { out } = build();
  for (const o of out) {
    assert.doesNotMatch(o.body, /prop-section-title/, '★몸통에 옛 절 제목이 남았다 — 절 안 절 머리');
    assert.doesNotMatch(o.body, /class="prop-section"/, '★몸통에 절 껍데기가 남았다');
    assert.match(o.body, /id="mdl-typo-/, '★컨트롤이 사라졌다 — 몸통을 너무 벗겼다');
  }
});

test('U2 prop-modal.js 가 Typography·Fill 빌더를 unwrapSection 으로 감싼다', () => {
  const src = read('js/props/prop-modal.js');
  assert.match(src, /unwrapSection\(buildTypographySectionHtml\(/);
  assert.match(src, /unwrapSection\(buildFillSectionHtml\(/);
  assert.doesNotMatch(src, /function _unwrapSec\(/, '★로컬 사본이 돌아왔다(U0c ⑨ 한 벌)');
});
