/* _text-template-harness — `js/props/prop-text-template.js` 를 «진짜로» 돌려보는 단 하나의 하네스.
 *
 * ★왜 있나 (2026-09-08, B단위 «타이포/채우기 절 뽑기»)
 *   Typography·Fill 절을 `_typo-section.js` 로 뽑아낼 때 「산출 HTML 이 한 글자도 안 바뀌었는가」를
 *   증명해야 한다. 그러려면 buildTextPropsHtml 을 «실제로» 부를 수 있어야 한다.
 *   ⛔검사가 마크업을 «베껴» 들고 있으면, 뽑기가 틀려도 검사와 코드가 나란히 틀린다.
 *     그래서 소스를 그대로 vm 에 올려 실행한다 — 선례: `_modal-harness.js`.
 *
 * ⛔ESM 문법과 «의존 모듈»만 최소로 채운다 — 본문은 한 글자도 안 건드린다.
 *   import 줄을 벗기는 대신, 벗겨진 이름들을 컨텍스트에 «진짜 구현»으로 넣어 준다
 *   (_fontDisplayName 은 prop-text-utils.js 원본을 같은 vm 에 올려서 쓴다 — 베끼지 않는다).
 *
 * ⚠️호출할 때마다 «새» 컨텍스트를 만든다. 검사끼리 모듈 상태를 나눠 갖지 않게.
 *
 * (파일명이 _ 로 시작해 테스트 글롭(`*.test.js` / `*.test.mjs`)에 안 걸린다 — 도구다.)
 * ★ESM(.mjs)에서는 createRequire 로 부른다:
 *     const { loadTextTemplate } = createRequire(import.meta.url)('./_text-template-harness.js');
 */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { readSrc } = require('./_srcread.js');

const ROOT = path.join(__dirname, '../..');
const TEMPLATE_REL = 'js/props/prop-text-template.js';
const UTILS_REL = 'js/props/prop-text-utils.js';
const TYPO_REL = 'js/props/_typo-section.js';

/** ESM 문법만 벗긴다(import 줄 · export 키워드). 본문은 그대로. */
function stripEsm(src, what) {
  const body = String(src)
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/^export\s+/gm, '')
    .replace(/^export\s*\{[\s\S]*?\};\s*$/gm, '');
  assert.ok(!/^\s*import\s/m.test(body), `${what}: import 줄을 다 못 벗겼다 — 하네스를 고쳐라`);
  assert.ok(!/^\s*export\s/m.test(body), `${what}: export 를 다 못 벗겼다 — 하네스를 고쳐라`);
  return body;
}

/**
 * buildTextPropsHtml 을 «실제로» 실행 가능한 형태로 돌려준다.
 * 같은 vm 에 prop-text-utils.js(_fontDisplayName)와, 있으면 _typo-section.js 도 함께 올린다.
 * @returns {{ buildTextPropsHtml: Function, ctx: object }}
 */
function loadTextTemplate() {
  const fs = require('node:fs');
  const parts = [stripEsm(readSrc(ROOT, UTILS_REL), UTILS_REL)];

  // _typo-section.js 는 «추출 후»에만 존재한다 — 있으면 올리고, 없으면 (추출 전) 그냥 넘어간다.
  const typoPath = path.join(ROOT, TYPO_REL);
  if (fs.existsSync(typoPath)) parts.push(stripEsm(readSrc(ROOT, TYPO_REL), TYPO_REL));

  parts.push(stripEsm(readSrc(ROOT, TEMPLATE_REL), TEMPLATE_REL));

  const ctx = {
    window: { getBlockBreadcrumb: () => 'Section 1 / Row 1' },
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(parts.join('\n;\n') + '\n;globalThis.__T = { buildTextPropsHtml };',
    ctx, { filename: TEMPLATE_REL });
  assert.equal(typeof ctx.__T.buildTextPropsHtml, 'function',
    'buildTextPropsHtml 을 못 꺼냈다 — 하네스가 죽었다');
  return { buildTextPropsHtml: ctx.__T.buildTextPropsHtml, ctx };
}

/* ★골든 비교에 쓰는 «고정 상태». 값을 바꾸면 픽스처도 다시 떠야 한다 —
   그래서 여기 «한 곳»에만 둔다(검사와 생성기가 같은 것을 본다). */
const GOLDEN_STATE = {
  tb: { id: 'tb_golden', dataset: { layerName: 'Golden Text' } },
  isOverlayTb: false,
  currentClass: 'tb-body',
  currentAlign: 'center',
  currentX: 12, currentY: 34, currentRotation: 15,
  currentW: 300,
  currentFont: 'Georgia, serif',
  currentWeight: '600',
  currentSize: 22,
  currentLH: 1.55, currentLS: 1.5,
  currentColor: '#ff3366', currentColorAlpha: 80,
  currentPadT: 4, currentPadL: 6, currentPadR: 8, phLinked: false,
  isLabel: false, currentBgColor: '#ffffff', currentRadius: 4, labelPillH: 24,
  isSpeechBubble: false, currentBubbleStyle: 'round', currentTail: 'left',
  bubbleBgHex: '#ffffff', showSender: false, senderName: '',
  isIconText: false, currentItbGap: 8,
  mix: { color: { mixed: false }, fontSize: { mixed: false }, fontWeight: { mixed: false } },
  shadow: { enabled: true, x: 3, y: 3, blur: 6, color: '#112233', alpha: 40 },
  isLiner: false,
  isStrike: true, isBold: true, isItalic: false, isHighlight: false,
};

/* ★두 번째 고정 상태 — «Mix» 와 «isLiner» 가 켜진 쪽.
   한 상태만 재면 mix/isLiner 분기가 통째로 안 보이는 채로 초록이 된다. */
const GOLDEN_STATE_MIX = {
  ...GOLDEN_STATE,
  tb: { id: 'tb_golden2', dataset: {} },
  isOverlayTb: true,
  isLiner: true,
  currentFont: '',
  currentWeight: '',
  mix: { color: { mixed: true }, fontSize: { mixed: true }, fontWeight: { mixed: true } },
  isStrike: false, isBold: false, isItalic: true, isHighlight: true,
};

module.exports = { loadTextTemplate, GOLDEN_STATE, GOLDEN_STATE_MIX, ROOT, TEMPLATE_REL, TYPO_REL };
