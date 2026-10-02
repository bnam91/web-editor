/* U-OVCOLOR — 「오버레이를 켜면 테두리는 보라인데 모서리 핸들은 파랑」 (현빈 2026-09-21)
 *   원문: 「오버레이 하면 아웃라인이 보라인데 모서리 핸들은 파랑이다. 스티커는 보라 핸들까지
 *   되어 있으니 색을 맞춰줘」
 *
 * ★이 레포는 같은 병을 이미 두 번 고쳤다 — 그때마다 «계열 한정자»로 하나씩 고쳤다:
 *     확대블럭  .zm-overlay-handle[data-zoom-resize-dir]   (2026-09-08)
 *     오버레이텍스트 .tfo-overlay-handle[data-tf-resize-dir] (2026-09-20)
 *   그래서 «오버레이를 켤 수 있는 블럭이 늘 때마다» 또 빠졌다. 실제로 이번에 빠진 것이
 *   도형(.shape-handle)과 에셋(.asset-overlay-handle/.asset-radius-handle)이다
 *   (실앱 9506 실측 — 테두리 rgb(153,102,255) / 손잡이 rgb(45,111,232)).
 *
 * ★그래서 고침은 «목록»이 아니라 «표식»으로 간다 —
 *   js/overlay-float.js 가 enterFloat 에서 블럭에 dataset.selVariant='sticker' 를 찍고
 *   (선이 보라가 되는 바로 그 표식, js/selection-overlay.js _variantOf),
 *   js/overlay-handles.js syncHandleSelVariant 가 그 표식을 손잡이로 «옮겨 찍는다».
 *   손잡이는 #ss-handles-overlay(고정층) 안이라 블럭의 자손이 아니라서 CSS 자손 선택자로는 못 닿는다.
 *
 * ⚠️이 파일은 «배선과 규칙»을 지킨다. 실제로 화면에서 같은 색인지는
 *    tests/dom/overlay-handle-color.dom.spec.js 가 진짜 브라우저에서 잰다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const HANDLES = rd('js/overlay-handles.js');
const FLOAT = rd('js/overlay-float.js');
const CSS = rd('css/editor-blocks.css');

/** 이름으로 최상위 선언 한 덩이를 잘라낸다(중괄호 균형) — U-CIRCLE 하네스와 «같은» 방식. */
function slice(src, head) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, `소스에서 «${head}» 를 못 찾았다 — 이름이 바뀌었으면 이 검사도 같이 옮겨라`);
  let j = src.indexOf('{', i), depth = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (!depth) { j = k + 1; break; } }
  }
  return src.slice(i, j).replace(/^export\s+/, '');
}

function loadSync() {
  const ctx = vm.createContext({});
  vm.runInContext(slice(HANDLES, 'export function syncHandleSelVariant(') + '\nglobalThis.__f = syncHandleSelVariant;', ctx);
  return ctx.__f;
}

/** 손잡이 흉내 — dataset 에 쓴 «횟수»를 센다(같은 값을 매 프레임 다시 쓰면 스타일이 헛도니까). */
function fakeHandle() {
  const store = {};
  let writes = 0, deletes = 0;
  const dataset = new Proxy(store, {
    set(t, k, v) { writes++; t[k] = v; return true; },
    deleteProperty(t, k) { deletes++; delete t[k]; return true; },
  });
  return { dataset, get writes() { return writes; }, get deletes() { return deletes; }, get raw() { return store; } };
}
/** 블럭 흉내 — closest 가 «자신 또는 조상»에서 표식 가진 것을 돌려준다. */
function fakeBlock(variantOnSelf, variantOnAncestor) {
  const anc = variantOnAncestor ? { dataset: { selVariant: variantOnAncestor } } : null;
  const self = { dataset: variantOnSelf ? { selVariant: variantOnSelf } : {} };
  self.closest = sel => (sel === '[data-sel-variant]' ? (variantOnSelf ? self : anc) : null);
  return self;
}

test('U-OVCOLOR-1 ★오버레이면 손잡이에 «같은 표식»을 옮겨 찍는다 (자신·조상 어느 쪽이든)', () => {
  const sync = loadSync();
  const h1 = fakeHandle();
  sync(h1, fakeBlock('sticker', null));
  assert.equal(h1.raw.selVariant, 'sticker', '★블럭 자신에 찍힌 표식을 손잡이가 못 받았다');

  const h2 = fakeHandle();
  sync(h2, fakeBlock(null, 'sticker'));
  assert.equal(h2.raw.selVariant, 'sticker', '★조상(위치를 쥔 posEl)에 찍힌 표식을 손잡이가 못 받았다 — 에셋이 이 꼴이다');
});

test('U-OVCOLOR-2 ★[음성대조] 오버레이가 아니면 표식이 «안» 붙는다 — 평상시 파랑 불변', () => {
  const sync = loadSync();
  const h = fakeHandle();
  sync(h, fakeBlock(null, null));
  assert.equal('selVariant' in h.raw, false, '★비오버레이 블럭의 손잡이에 표식이 붙었다 — 평상시 선택까지 보라가 된다');
  assert.equal(h.writes, 0, '★안 붙이면서 dataset 을 썼다');
});

test('U-OVCOLOR-3 ★오버레이를 «끄면» 표식이 걷힌다 (켰다 끈 뒤에도 보라로 남으면 안 된다)', () => {
  const sync = loadSync();
  const h = fakeHandle();
  const on = fakeBlock('sticker', null), off = fakeBlock(null, null);
  sync(h, on);
  assert.equal(h.raw.selVariant, 'sticker');
  sync(h, off);
  assert.equal('selVariant' in h.raw, false, '★오버레이를 껐는데 손잡이가 보라로 남았다');
  assert.equal(h.deletes, 1, '★지우는 길이 안 탔다');
});

test('U-OVCOLOR-4 ★같은 값이면 다시 안 쓴다 — 위치 갱신 루프(매 프레임)가 부르는 함수다', () => {
  const sync = loadSync();
  const h = fakeHandle();
  const b = fakeBlock('sticker', null);
  for (let i = 0; i < 10; i++) sync(h, b);
  assert.equal(h.writes, 1, `★매 프레임 dataset 을 다시 썼다(${h.writes}회) — 쓸데없는 스타일 무효화가 rAF 마다 난다`);
});

test('U-OVCOLOR-5 ★배선 — 에셋의 «두» 손잡이 갱신 루프가 실제로 부른다 (만들고 안 부르면 소용없다)', () => {
  for (const fn of ['function _updateAssetResizeHandlePositions(', 'function _updateAssetRadiusHandlePositions(']) {
    assert.match(slice(HANDLES, fn), /syncHandleSelVariant\(/,
      `★${fn} 가 표식을 안 옮긴다 — 그 계열 손잡이는 오버레이에서도 파랑으로 남는다`);
  }
});

test('U-OVCOLOR-6 ★표식의 출처가 «선 색을 고르는 그 표식»과 같다 (두 색이 갈라질 수 없게)', () => {
  assert.match(FLOAT, /dataset\.selVariant = 'sticker'/,
    '★overlay-float 가 더 이상 selVariant 를 안 찍는다 — 선도 손잡이도 보라를 잃는다');
  assert.match(slice(HANDLES, 'export function syncHandleSelVariant('), /selVariant/,
    '★손잡이 쪽이 다른 표식을 본다 — 언젠가 선과 손잡이가 갈라진다');
});

/* ═════ CSS — «한 규칙»으로 닿는가, 비오버레이는 그대로인가 ═══════════════════ */
function ruleOf(sel) {
  const i = CSS.indexOf(sel);
  assert.ok(i >= 0, `CSS 에서 «${sel}» 규칙을 못 찾았다`);
  const j = CSS.indexOf('{', i), k = CSS.indexOf('}', j);
  return CSS.slice(j + 1, k);
}

test('U-OVCOLOR-7 ★고정층 손잡이는 «표식 하나»로 보라가 된다 — 토큰만 쓴다', () => {
  const r = ruleOf('#ss-handles-overlay [data-sel-variant="sticker"]');
  assert.match(r, /border-color:\s*var\(--ui-sel-overlay/, '★고정층 규칙이 토큰을 안 쓴다');
  assert.ok(!/border-color:\s*#9966ff\s*;/.test(r), '★리터럴 #9966ff 를 값으로 썼다 — 토큰만 쓴다');
});

test('U-OVCOLOR-8 ★도형 손잡이(.shape-handle)는 «블럭의 자식»이라 자손 선택자로 닿는다', () => {
  const r = ruleOf('.shape-block[data-sel-variant="sticker"] .shape-handle');
  assert.match(r, /border-color:\s*var\(--ui-sel-overlay/, '★도형 손잡이가 오버레이에서 파랑으로 남는다');
});

test('U-OVCOLOR-9 ★[음성대조] 표식이 없으면 종전 파랑 그대로다 (기본 규칙이 --sel-color)', () => {
  /* ⚠️앞머리에 줄바꿈을 붙인다 — `.shape-handle {` 만으로는 «자손 선택자 끝»
     (`.shape-block[…] .shape-handle {`)이 먼저 잡혀 엉뚱한 규칙을 잰다(실제로 한 번 물렸다). */
  for (const sel of ['\n.asset-overlay-handle,', '\n.shape-handle {']) {
    const r = ruleOf(sel);
    assert.match(r, /border:[^;]*var\(--sel-color\)/,
      `★${sel} 의 기본 테두리가 --sel-color 가 아니다 — 평상시(비오버레이) 파랑이 바뀌었다`);
  }
  // 보라 규칙들은 «전부» 표식 한정자를 달고 있다(무조건 보라가 되는 규칙이 없다)
  for (const m of CSS.matchAll(/^([^\n{]*\[data-sel-variant="sticker"\][^\n{]*)\{/gm)) {
    assert.match(m[1], /\[data-sel-variant="sticker"\]/, `한정자 없는 보라 규칙: ${m[1]}`);
  }
});

test('U-OVCOLOR-10 ★전수 — 오버레이 토글을 «가진» 패널이 셋이고, 셋 다 보라에 닿는다', () => {
  /* ⛔블럭 이름을 여기 적지 않는다 — 소스에서 «토글 버튼을 그리는 패널»을 세어 온다.
     새 패널이 토글을 달면 이 수가 늘어 빨강이 나고, 그때 그 블럭의 손잡이 계열을 여기 더하게 된다. */
  const panels = ['js/props/prop-asset.js', 'js/props/prop-shape.js', 'js/props/prop-text-template.js']
    .filter(p => /overlayToggleBtnHTML\(\{/.test(rd(p)));
  assert.equal(panels.length, 3,
    `★오버레이 토글을 그리는 패널 수가 3 이 아니다(${panels.length}) — 늘었으면 그 블럭의 손잡이 색도 여기 더해라`);
  // 텍스트·아이콘텍스트 = .tfo-overlay-handle (계열 한정자 판, 오버레이에서만 만들어진다)
  assert.match(ruleOf('.tfo-overlay-handle[data-tf-resize-dir]'), /border-color:\s*var\(--ui-sel-overlay/,
    '★오버레이 텍스트/아이콘텍스트 손잡이가 보라가 아니다');
  // 도형 = .shape-handle · 에셋 = 고정층 두 계열(리사이즈·반경)
  assert.match(ruleOf('.shape-block[data-sel-variant="sticker"] .shape-handle'), /--ui-sel-overlay/);
  assert.match(ruleOf('#ss-handles-overlay [data-sel-variant="sticker"]'), /--ui-sel-overlay/);
});
