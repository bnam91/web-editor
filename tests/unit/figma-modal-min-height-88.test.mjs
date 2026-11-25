// figma-modal-min-height-88.test.mjs — 0.9.14 #88 FIGMA-MODAL-FIXED-HEIGHT-SENT-AS-H-01
//   모달 hMode='fixed' 의 H 는 «최소 높이»다(modal-block.js renderModalBlock min-height · 패널 라벨 「최소」 ·
//   modal-frameify.js 도 minHeight). JSON 경로만 height=H 를 실어 내용이 H 보다 크면 Figma 에서 «짧게» 나왔다.
//   ⇒ height = max(H, 실측 offsetHeight). 원본 소스의 모달 갈래를 _slice-block 으로 잘라 가짜 DOM 으로 «실행»한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { sliceBlock } = createRequire(import.meta.url)('./_slice-block.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXP = fs.readFileSync(path.join(ROOT, 'js/io/export-figma-json.js'), 'utf8');
const MODAL_SRC = sliceBlock(EXP, "if (el.classList.contains('modal-block')) {");

function run(el, live) {
  const document = { getElementById: (id) => (id === el.id ? live : null) };
  return new Function('el', 'document',
    `const _modalTextRanges = () => []; const _strokeBorderOut = () => null; ${MODAL_SRC}; return null;`)(el, document);
}
// 분리된 클론(offsetHeight 0) + 살아 있는 요소(실측 h) — 실제 내보내기와 같은 꼴
function mkModal(ds, h) {
  const el = { id: 'mdl_1', dataset: ds, offsetHeight: 0, classList: { contains: (c) => c === 'modal-block' }, querySelector: () => null };
  return [el, { offsetHeight: h }];
}

test('#88 ★hMode=fixed H=100, 내용이 ~180 → height = 실측 180 (H 아님)', () => {
  const [el, live] = mkModal({ hMode: 'fixed', height: '100', textText: 'x' }, 180);
  assert.equal(run(el, live).height, 180);
});

test('#88 음성대조: 내용이 H 보다 짧으면(실측 60) → height = H 100', () => {
  const [el, live] = mkModal({ hMode: 'fixed', height: '100', textText: 'x' }, 60);
  assert.equal(run(el, live).height, 100);
});

test('#88 살아 있는 요소가 없으면(실측 0) → height = H', () => {
  const [el] = mkModal({ hMode: 'fixed', height: '100' }, 0);
  assert.equal(run(el, null).height, 100);
});

test('#88 hMode=auto 는 그대로 실측', () => {
  const [el, live] = mkModal({ hMode: 'auto', height: '100' }, 180);
  assert.equal(run(el, live).height, 180);
});
