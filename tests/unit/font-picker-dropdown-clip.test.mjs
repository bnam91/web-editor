/* font-picker-dropdown-clip — 모달 패널처럼 트리거가 창 아래쪽에 있을 때도
 *   폰트 검색 드롭다운 «전체»가 화면 안에 보이는가. (2026-09-16, T-020 QA FAIL)
 *
 * ★왜 이 파일이 있나
 *   현빈: 「모달블럭에서 폰트 검색목록 드랍다운이 나타나긴 하지만, … 패널 아래에 잘려서
 *          다보이지않아서 확인이 안된다.」
 *   _font-picker.js 의 트리거 클릭 핸들러는 `top: r.bottom + 2` 로만 자리를 잡았다 —
 *   색피커(color-picker.js:_position)처럼 «남은 공간»을 보지 않는다.
 *   모달 패널은 Variant/Icon/Size/Padding/Background/Border/Shadow/Text 절이 Typography
 *   «위»에 죽 늘어서 있어(js/props/prop-modal.js), 폰트 트리거가 창 하단 가까이 앉기 쉽다.
 *   그러면 목록(검색칸+목록+눈누버튼, CSS max-height 로 최대 ~254px)이 창 바닥 «밖»으로
 *   나가 잘린 채 뜬다 — position:fixed 라 패널 스크롤로도 못 따라간다.
 *
 * ★이 레포엔 jsdom 이 없다(선례: modal-typo-model.test.mjs 머리말) — getComputedStyle 은
 *   실물 CDP QA 의 몫이다. 여기서는 손으로 만든 가짜 DOM 으로 «위치 계산 로직 자체»를
 *   실행으로 잰다(선례: tpl-popout-geometry.test.mjs G4-c).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const _req = createRequire(import.meta.url);
const { readSrc } = _req('./_srcread.js');
const { stripComments } = _req('./_strip-comments.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

const strip = (rel) => stripComments(readSrc(ROOT, rel))
  .replace(/^import[^\n]*\n/gm, '')
  .replace(/^export\s+/gm, '');

/** 가짜 엘리먼트 — 이 테스트가 실제로 건드리는 자리(style/classList/rect)만 채운다. */
function fakeEl({ rect } = {}) {
  const listeners = {};
  return {
    style: {},
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); },
    },
    dataset: {},
    value: '',
    innerHTML: '',
    textContent: '',
    _listeners: listeners,
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    removeEventListener() {},
    contains() { return false; },
    querySelector() { return null; },
    getBoundingClientRect() { return rect ? rect() : { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }; },
    scrollIntoView() {},
    closest() { return null; },
  };
}

/** wireFontPicker 를 실제 소스로 실행할 수 있는 격리 컨텍스트를 만든다. */
function loadFontPicker() {
  const utils = strip('js/props/prop-text-utils.js');
  const picker = strip('js/props/_font-picker.js');
  const store = new Map();
  const ctx = {
    console,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    },
    document: { addEventListener() {}, removeEventListener() {} },
    window: { queryLocalFonts: undefined, innerHeight: 1000 },
    setTimeout: () => {},
  };
  vm.createContext(ctx);
  vm.runInContext(
    `${utils}\n;${picker}\n;globalThis.__wireFontPicker = wireFontPicker;`,
    ctx, { filename: 'js/props/_font-picker.js' },
  );
  return { ctx, wireFontPicker: ctx.__wireFontPicker };
}

/** 트리거가 화면 y=`triggerBottom` 에 있는 모달 패널 상황을 구성한다. */
function buildHarness({ triggerBottom, triggerTop, windowHeight }) {
  const { ctx, wireFontPicker } = loadFontPicker();
  ctx.window.innerHeight = windowHeight;

  const trigger = fakeEl({ rect: () => ({ top: triggerTop, bottom: triggerBottom, left: 20, right: 220, width: 200, height: 24 }) });
  const dropdown = fakeEl();
  // ★마크업 초기값(_typo-section.js: style="display:none")과 맞춘다 — 안 그러면
  //   `isOpen = style.display !== 'none'` 이 undefined!=='none' 으로 «이미 열려 있다»로 오판해
  //   클릭이 열기가 아니라 닫기(_fpClose)로 빠진다.
  dropdown.style.display = 'none';
  // ★목록 렌더 후의 «실제 높이» — CSS max-height 상한(200) + 검색칸(28) + 눈누버튼(26) ≈ 254px.
  //   _fpBuildList 는 innerHTML 만 채우고 레이아웃은 안 하므로, 그 다음 getBoundingClientRect 를
  //   이 값으로 흉내낸다(가짜 DOM 이 실제 CSS 를 안 재기 때문).
  const DROPDOWN_HEIGHT = 254;
  dropdown.getBoundingClientRect = () => ({
    top: parseFloat(dropdown.style.top) || 0,
    height: DROPDOWN_HEIGHT,
    bottom: (parseFloat(dropdown.style.top) || 0) + DROPDOWN_HEIGHT,
    left: 0, right: 0, width: 200,
  });
  const search = fakeEl();
  const list = fakeEl();
  const nameEl = fakeEl();
  const noonnu = fakeEl();

  const byId = {
    'mdl-typo-font-trigger': trigger,
    'mdl-typo-font-dropdown': dropdown,
    'mdl-typo-font-search': search,
    'mdl-typo-font-list': list,
    'mdl-typo-font-name': nameEl,
    'mdl-typo-font-noonnu': noonnu,
  };
  const root = fakeEl();
  root.querySelector = (sel) => {
    const m = sel.match(/^#(.+)$/);
    return m ? (byId[m[1]] || null) : null;
  };

  wireFontPicker({ root, p: 'mdl-typo', getCurrent: () => '', onPick: () => {} });
  return { trigger, dropdown, DROPDOWN_HEIGHT };
}

test('전제 — wireFontPicker 가 실제로 로드된다', () => {
  const { wireFontPicker } = loadFontPicker();
  assert.equal(typeof wireFontPicker, 'function',
    '★_font-picker.js 가 wireFontPicker 를 안 낸다 — 아래 검사가 전부 무의미하다');
});

test('T-020-1 ★모달처럼 트리거가 창 하단 가까이 있으면 드롭다운을 위로 뒤집는다', () => {
  // 창 높이 1000, 트리거가 y=900 부근(모달의 Typography 절 — Variant~Shadow 뒤) →
  // 아래로 펼치면 900+2+254 = 1156 > 1000, 창 밖으로 넘친다.
  const { trigger, dropdown } = buildHarness({ triggerTop: 876, triggerBottom: 900, windowHeight: 1000 });
  trigger._listeners.click[0]();

  const top = parseFloat(dropdown.style.top);
  assert.ok(Number.isFinite(top), `★top 이 숫자가 아니다: ${dropdown.style.top}`);
  assert.ok(top < 876,
    `★아래로 펼쳤다(top=${top}) — 트리거 아래에 자리가 없는데 안 뒤집었다. ` +
    'QA FAIL 재현: 모달 패널 폰트 검색 드롭다운이 패널/창 바닥에서 잘린다');
  assert.ok(top + 254 <= 1000 + 0.01,
    `★뒤집었는데도 여전히 창 밖으로 넘친다: top=${top}, bottom=${top + 254}, window=1000`);
});

test('T-020-2 트리거 위쪽에 아래로 펼칠 공간이 «충분하면» 그대로 아래에 둔다(회귀 없음)', () => {
  // 텍스트블록처럼 Typography 절이 패널 맨 위에 있는 경우 — 기존 동작 그대로.
  const { trigger, dropdown } = buildHarness({ triggerTop: 40, triggerBottom: 64, windowHeight: 1000 });
  trigger._listeners.click[0]();

  const top = parseFloat(dropdown.style.top);
  assert.equal(top, 66, `★공간이 충분한데 위치를 건드렸다(top=${top}) — 기존 동작이 바뀌었다`);
});

test('T-020-3 뒤집어도 안 들어가는 극단 상황에서도 화면 밖(음수)으로 나가진 않는다', () => {
  const { trigger, dropdown } = buildHarness({ triggerTop: 10, triggerBottom: 34, windowHeight: 100 });
  trigger._listeners.click[0]();

  const top = parseFloat(dropdown.style.top);
  assert.ok(top >= 6 - 0.01, `★top=${top} — 창 위쪽 밖으로 나갔다(클램프 하한 6 미만)`);
});
