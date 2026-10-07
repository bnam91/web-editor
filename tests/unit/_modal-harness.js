/* _modal-harness — `js/blocks/modal-block.js` 를 «진짜로» 돌려보는 단 하나의 하네스.
 *
 * ★왜 뽑았나 (2026-09-08)
 *   modal-variant-identity.test.mjs 가 이 함수를 갖고 있었고, modal-text-defaults.test.mjs 가
 *   «두 번째 소비자»로 붙었다. 그대로 베끼면 검사 둘이 «다른 벌»로 같은 모듈을 재게 된다 —
 *   한쪽 벌만 낡아도 「어느 벌로 쟀는지」에 따라 답이 갈리고, 그 갈림은 조용하다.
 *   ⇒ 같은 날 `_strip-comments.js` 가 정확히 그 병에서 태어났다(사본 11벌 중 9벌이 부서져 있었다).
 *     같은 실수를 이 파일에서 반복하지 않는다.
 *
 * ⛔표도 함수도 «베끼지» 않는다 — 소스를 그대로 vm 에 올려 실행한다.
 *   베끼면 검사가 코드와 조용히 갈라져, 검사는 초록인데 제품은 깨진 상태가 된다.
 *   ESM 문법 두 가지만 벗긴다(import 줄 · 끝의 export 문) — 나머지 본문은 «한 글자도» 안 건드린다.
 *
 * ⚠️호출할 때마다 «새» 컨텍스트를 만든다. 검사끼리 모듈 상태(genId 시퀀스 등)를 나눠 갖지 않게.
 *
 * (파일명이 _ 로 시작해 테스트 글롭(`*.test.js` / `*.test.mjs`)에 안 걸린다 — 도구다.)
 * ★ESM(.mjs)에서는 createRequire 로 부른다:
 *     const { loadModalModule } = createRequire(import.meta.url)('./_modal-harness.js');
 */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { readSrc } = require('./_srcread.js');

const ROOT = path.join(__dirname, '../..');
const MODAL_REL = 'js/blocks/modal-block.js';
/* ★2026-10-08 — modal-block.js 가 ★공용 sanitizer 를 import 하게 됐다(수지② 부분 서식).
   ★그 의존을 ★vm 에 ★같이 올린다 — ⛔안 올리면 이름이 ★undefined 가 되고, 그 길을 타는 검사가
     ★«다른 이유»로 빨개진다(tests/unit/typo-section-ssot.test.mjs buildSection 이 utils·helpers 를
      같이 올리는 ★그 까닭과 같다 · 2026-10-06 실측된 함정).
   ★이름 충돌은 ★없음을 확인했다(공용 모듈 최상위 13개 ∩ modal-block.js 최상위 = ★0). */
const SANITIZE_REL = 'js/util/sanitize-rich-text.js';

/** modal-block.js 의 «원본 소스»(LF 정규화). 소스 문자열을 재는 검사가 같은 것을 보게. */
function modalSrc() {
  return readSrc(ROOT, MODAL_REL);
}

/**
 * modal-block.js 를 vm 에 올려 실행하고 «내부 이름»을 꺼내 준다.
 * DOM 에 닿는 것은 최소로 스텁한다: document.createElement · genId.
 * (선례: selection-outline-zoom.test.mjs 가 같은 방식으로 _geomOf 를 진짜로 돌린다.)
 */
/* @param {object} [opts]
 * @param {object} [opts.win]  vm 안의 `window` 로 쓸 «그 객체». 안 주면 빈 객체(종전과 같다).
 *   ★왜 열었나 (2026-09-09, gen-mdl-icon)
 *     modal-block.js 의 iconBlockNewColor() 가 window.makeIconifyBlock 을 «불러» 아이콘블럭의
 *     기본색을 읽는다(⑴ 「같은 색」의 출처를 하나로 두는 장치). 하네스가 window 를 못 채우면
 *     그 길이 «검사에서만» 폴백으로 새어, 두 색이 갈라져도 초록이 뜬다 — 그게 제일 나쁜 통과다.
 *   ⚠️인자를 «그대로» ctx.window 로 쓴다(복사 X) — 호출자가 같은 객체를 계속 들여다볼 수 있게.
 *   ⚠️인자 없이 부르면 종전과 «완전히» 같다(기존 세 검사 무영향). */
function loadModalModule(opts) {
  /* ★ESM 문법 세 가지를 벗긴다 — ⑴ import 줄 ⑵ 끝의 export 문 ⑶ ★`export const/function` 의 접두사.
     ⑶ 은 2026-10-08 에 더했다: `export const MODAL_SLOT_KEYS` 가 생기면서 ⑵ 로는 안 벗겨져
        ★「export 문을 다 못 벗겼다」로 ★5파일이 빨개졌다(실측). ⛔본문은 한 글자도 안 건드린다. */
  const strip = (src) => src
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/export\s*\{[\s\S]*?\};/, '')
    .replace(/^export\s+/gm, '');
  const dep = strip(readSrc(ROOT, SANITIZE_REL));
  const body = strip(modalSrc());
  for (const [what, src] of [['공용 sanitizer', dep], ['modal-block.js', body]]) {
    assert.ok(!/^\s*import\s/m.test(src), `${what}: import 줄을 다 못 벗겼다 — 하네스를 고쳐라`);
    assert.ok(!/^\s*export\s/m.test(src), `${what}: export 문을 다 못 벗겼다 — 하네스를 고쳐라`);
  }

  let seq = 0;
  const mkEl = () => ({
    className: '', id: '', innerHTML: '',
    dataset: Object.create(null),
    style: {},
    appendChild() {},
    scrollIntoView() {},
  });
  const ctx = {
    document: { createElement: mkEl },
    window: (opts && opts.win) || {},
    genId: (p) => `${p}_${++seq}`,
    insertAfterSelected() {}, showNoSelectionHint() {}, bindBlock() {},
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(
    dep + '\n;' + body
         + '\n;globalThis.__M = { MODAL_VARIANT_IDENTITY, MODAL_IDENTITY_KEYS, MODAL_DEFAULTS,'
         + ' MODAL_VARIANTS, _effDefault, applyModalVariant, makeModalBlock, renderModalBlock,'
         + ' applyPickedIconToModal, iconBlockNewColor, syncModalIconFirstLineOffset,'
         + ' MODAL_SLOT_KEYS, commitModalSlot };',
    ctx, { filename: MODAL_REL });
  return ctx.__M;
}

/** 저장·로드 왕복본처럼 «dataset 만 든» 블록 흉내. renderModalBlock 이 실제로 받는 모양 그대로다. */
function fakeBlock(dataset = {}) {
  return {
    className: 'modal-block', id: 'mdl_fake', innerHTML: '',
    dataset: Object.assign(Object.create(null), dataset),
    style: {},
    appendChild() {}, scrollIntoView() {},
  };
}

module.exports = { loadModalModule, modalSrc, fakeBlock, ROOT, MODAL_REL };
