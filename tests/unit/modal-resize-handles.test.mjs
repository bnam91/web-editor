/* modal-resize-handles — 모달 블록의 «모서리 점»을 잠근다. (2026-09-08 신설)
 *   실행: node --test "tests/unit/*.test.mjs"  ·  DOM 없이 «소스에서 진짜 핸들러를» 떼어 실행한다.
 *
 * ★왜 이 파일이 있나
 *   현빈: 「파란색 아웃라인과 핸들이 없네?」 — 실측하니 «절반만» 맞았다.
 *   선택 오버레이는 모달을 대상으로 잡고 네 변을 이미 그리고 있었다(soActive true / path 4변).
 *   없는 것은 «모서리 점»뿐이었고(handleCount 0), 그 점이 붙는 등록 지점 다섯 중 셋이 끊겨 있었다.
 *
 * ★★그리고 이 파일이 «변이를 잡는 그물»이다.
 *   tests/dom 은 playwright 라 검수자가 돌리는 `node --test` 스위트에 «안 들어간다»
 *   (tests/dom/modal-variant.dom.spec.js:19-22 가 그렇게 적어 뒀다).
 *   반대로 getComputedStyle 은 여기서 못 잰다(jsdom/happy-dom 미설치).
 *   ⇒ 런타임 실측 = tests/dom/modal-resize.dom.spec.js · 변이 그물 = 이 파일. 둘 다 있어야 완성이다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* ⛔주석 걷어내기는 «공용 부품»을 쓴다 — 자기 벌을 만들면 S-6 가 즉시 빨강. */
const _req = createRequire(import.meta.url);
const { makeStripper } = _req('./_strip-comments.js');
/** 파일 «하나»마다 새 stripper(블록 주석 상태를 들고 간다). */
const strip = (src) => { const s = makeStripper(); return src.split('\n').map(s).join('\n'); };

const F = {
  handles:  'js/overlay-handles.js',
  editor:   'js/editor.js',
  drag:     'js/block-drag.js',
  modal:    'js/blocks/modal-block.js',
  prop:     'js/props/prop-modal.js',
  flags:    'js/feature-flags.js',
};
const RAW  = Object.fromEntries(Object.entries(F).map(([k, p]) => [k, rd(p)]));
const CODE = Object.fromEntries(Object.entries(RAW).map(([k, s]) => [k, strip(s)]));

/** 이름으로 최상위 선언 한 덩이를 잘라낸다 — ⛔고정 창(slice(i, i+900)) 금지, 중괄호 균형으로. */
function sliceDecl(src, head, what) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, `«${head}» 를 못 찾았다 (${what}) — 이름이 바뀌었으면 이 검사도 같이 옮겨라`);
  let j = src.indexOf('{', i), depth = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (!depth) { j = k + 1; break; } }
  }
  return src.slice(i, j);
}

/* ═══════════════════════════════════════════════════════════════════
   U0 — ★「입력이 살아 있다」. U1~U9 «앞»에 온다.
   아래 검사들은 전부 «소스 문자열»을 훑는다 ⇒ 소스가 비거나 대상 함수가 껍데기가 되면
   「0건 발견 = 통과」로 조용히 초록이 된다. 그 병을 «먼저» 잡는다.
═══════════════════════════════════════════════════════════════════ */
test('U0 ★입력이 살아 있다 — 훑는 파일이 실재하고, showHandlesFor 가 «빈 함수»가 아니다', () => {
  for (const [k, p] of Object.entries(F)) {
    assert.ok(fs.existsSync(path.join(ROOT, p)), `${p} 가 없다 — 검사가 대상을 놓쳤다`);
    const lines = CODE[k].split('\n').filter(l => l.trim() !== '').length;
    assert.ok(lines > 0, `${p} 에 주석을 걷고 나니 코드가 «한 줄도» 없다 (${k})`);
  }
  /* showHandlesFor 가 «실제로 가르는» 블록 종류를 세어 둔다.
     ⛔특정 수를 못박지 않는다 — 지금 수를 재서 «그 이상»으로 잠근다(블록은 계속 는다). */
  const fn = sliceDecl(CODE.handles, 'function showHandlesFor(', 'overlay-handles');
  const kinds = [...fn.matchAll(/contains\('([a-z0-9-]+)'\)/g)].map(m => m[1]);
  assert.ok(kinds.length >= 7,
    `showHandlesFor 의 분기가 ${kinds.length}개뿐이다 — 함수를 비우면 아래 U1 이 아니라 «여기»가 먼저 빨개져야 한다`);
});

/* ═══════════════════════════════════════════════════════════════════
   U1~U3 — 등록 지점 셋이 «이어져 있나»
═══════════════════════════════════════════════════════════════════ */
test('U1 showHandlesFor 에 modal 배선 — 없으면 클릭해도 «모서리 점»이 0개다', () => {
  // ⇐ 되돌리기: showHandlesFor 의 modal-block 분기 제거
  const fn = sliceDecl(CODE.handles, 'function showHandlesFor(', 'overlay-handles');
  assert.match(fn, /contains\('modal-block'\)/, 'showHandlesFor 가 모달을 안 가른다');
  assert.match(fn, /showModalRadiusHandles\(/, '모달 라디우스 핸들을 안 띄운다');
  assert.match(fn, /showModalResizeHandles\(/, '모달 리사이즈 핸들을 안 띄운다');
});

test('U2 deselectAll 에 hide 2개 — 없으면 모듈 상태가 «해제된 블록»을 계속 가리킨다', () => {
  // ⇐ 되돌리기: editor.js deselectAll 의 hideModal* 두 줄 제거
  const fn = sliceDecl(CODE.editor, 'function deselectAll(', 'editor');
  assert.match(fn, /hideModalRadiusHandles\?\.\(\)/, 'deselectAll 이 모달 라디우스 핸들을 안 지운다');
  assert.match(fn, /hideModalResizeHandles\?\.\(\)/, 'deselectAll 이 모달 리사이즈 핸들을 안 지운다');
  /* ★대조 — 이 목록이 원래 «여럿»이다. 하나도 없으면 검사가 엉뚱한 함수를 잡은 것이다. */
  const hides = [...fn.matchAll(/hide[A-Za-z]+Handles?\?\.\(\)/g)].length;
  assert.ok(hides >= 8, `deselectAll 의 hide 호출이 ${hides}개뿐이다 — 대상을 놓쳤다`);
});

test('U3 block-drag 의 공용 클릭 루프가 showHandlesFor 를 부른다', () => {
  // ⇐ 되돌리기: block-drag.js 공용 루프의 showHandlesFor 한 줄 제거
  const loop = sliceDecl(CODE.drag, 'for (const [flag, showFn]', 'block-drag');
  // ★대조 — modal 이 «실제로» 이 루프에 얹혀 있나(옮겨 갔으면 이 검사는 의미가 없다)
  assert.match(loop, /showModalProperties/, 'modal 이 이 공용 루프에 없다 — 검사를 옮겨라');
  assert.match(loop, /window\.showHandlesFor\?\.\(block\)/,
    '모달은 이 공용 루프에 얹혀 있는데 루프에 핸들 호출이 없다');
});

/* ═══════════════════════════════════════════════════════════════════
   U4~U6 — ★핸들러를 «떼어내 실행»한다. 소스를 «읽는» 검사만으로는
   「dataset 대신 style 에 쓴다」 같은 변이를 못 잡는다.
═══════════════════════════════════════════════════════════════════ */
const LIMITS_SRC = sliceDecl(CODE.modal, 'const MODAL_LIMITS = ', 'modal-block');
const CLAMP_SRC  = CODE.modal.match(/const clampModal = [^\n]+;/)[0];
const SETMODE_SRC = sliceDecl(CODE.modal, 'function setModalSizeMode(', 'modal-block');
const RESIZE_SRC = sliceDecl(CODE.handles, 'function _onModalResizeHandleMouseDown(', 'overlay-handles');
const RADIUS_SRC = sliceDecl(CODE.handles, 'function _onModalRadiusHandleMouseDown(', 'overlay-handles');

/** 진짜 핸들러를 vm 안에서 돌린다 — DOM 에 닿는 것만 «최소로» 스텁한다. */
function drive(kind, dir, block, moves, opts = {}) {
  const scale = opts.scale ?? 1;
  const els = {
    'mdl-w-number': { value: '' }, 'mdl-h-number': { value: '' },
    'mdl-radius-slider': { value: '' }, 'mdl-radius-number': { value: '' },
  };
  const calls = { render: 0, history: 0, save: 0, props: 0 };
  const on = {};
  const ctx = vm.createContext({
    Math, String, Number, Object, JSON,
    document: {
      getElementById: id => els[id] || null,
      addEventListener: (t, fn) => { on[t] = fn; },
      removeEventListener: (t) => { delete on[t]; },
    },
    window: {
      MODAL_AUTOCENTER: opts.autocenter !== false,
      renderModalBlock: () => calls.render++,
      pushHistory: () => calls.history++,
      scheduleAutoSave: () => calls.save++,
      showModalProperties: () => calls.props++,
    },
  });
  vm.runInContext([
    `const _canvasScaleNow = () => ${scale};`,
    LIMITS_SRC + ';', CLAMP_SRC, SETMODE_SRC, RESIZE_SRC, RADIUS_SRC,
    'globalThis.__h = { resize: _onModalResizeHandleMouseDown, radius: _onModalRadiusHandleMouseDown };',
  ].join('\n'), ctx);

  const ev = (x, y) => ({ button: 0, clientX: x, clientY: y, stopPropagation() {}, preventDefault() {} });
  ctx.__h[kind](ev(0, 0), block, dir);
  for (const [dx, dy] of moves) on.mousemove?.(ev(dx, dy));
  on.mouseup?.();
  return { els, calls, listenersLeft: Object.keys(on).length };
}

const mkBlock = (ds = {}, w = 400, h = 100) =>
  ({ dataset: { wMode: 'full', hMode: 'auto', ...ds }, style: {}, offsetWidth: w, offsetHeight: h });

test('U4 ★리사이즈 mousedown 을 떼어내 실행 — 값이 «dataset» 에 남는다', () => {
  /* ⇐ 되돌리기: dataset 대신 block.style 에 쓰면 여기가 빨강.
     (그게 «에셋 코드를 그대로 베낀» 모습이고, 실제 앱에서는 재렌더 한 번에 값이 증발한다) */
  const b = mkBlock();
  const r = drive('resize', 'se', b, [[200, 150]]);
  assert.equal(b.dataset.width, '800', '가로 200px 을 끌면 폭이 «400 늘어야» 한다 (가운데 고정 상자 = 2·dx)');
  assert.equal(b.dataset.height, '250');
  assert.equal(b.dataset.wMode, 'fixed');
  assert.equal(b.dataset.hMode, 'fixed');
  assert.ok(r.calls.render >= 1, '드래그가 끝났는데 renderModalBlock 을 한 번도 안 불렀다 — 값이 그림이 되지 않는다');
  assert.ok(r.calls.history >= 1, 'pushHistory 가 없다 — 되돌리기가 안 된다');
  assert.equal(r.listenersLeft, 0, 'mouseup 뒤에도 document 리스너가 남아 있다');
});

test('U4-b ★가로는 2배, 세로는 1배 — 커서 100px 에 모서리 50px 이 되지 않는다', () => {
  /* ⇐ 되돌리기: sx * dx * 2 를 sx * dx 로 바꾸면 여기가 빨강.
     근거: wMode:'fixed' 는 margin-left/right:auto 를 같이 준다 ⇒ 상자가 정중앙에 선다
     ⇒ 폭이 Δ 늘면 각 «변»은 Δ/2 만 움직인다. 실측: 폭400 이 860 호스트에서 left=230. */
  const e = mkBlock(); drive('resize', 'se', e, [[100, 0]]);
  assert.equal(e.dataset.width, '600', 'e 쪽: 100px 끌면 폭이 200 늘어야 한다');
  const w = mkBlock(); drive('resize', 'sw', w, [[-100, 0]]);
  assert.equal(w.dataset.width, '600', 'w 쪽도 «같은» 2배다');
  const s = mkBlock(); drive('resize', 'se', s, [[0, 100]]);
  assert.equal(s.dataset.height, '200', '세로는 1배 — 위 변이 흐름에 박혀 있어 아래로만 자란다');
});

test('U5 리사이즈 클램프 — 표 밖으로 못 나간다', () => {
  // ⇐ 되돌리기: clampModal 을 빼고 날값을 쓰면 여기가 빨강
  const lo = mkBlock(); drive('resize', 'se', lo, [[-9999, -9999]]);
  assert.equal(Number(lo.dataset.width) >= 80, true, `폭 하한을 뚫었다: ${lo.dataset.width}`);
  assert.equal(Number(lo.dataset.height) >= 30, true, `높이 하한을 뚫었다: ${lo.dataset.height}`);
  const hi = mkBlock(); drive('resize', 'se', hi, [[9999, 9999]]);
  assert.equal(Number(hi.dataset.width) <= 860, true, `폭 상한을 뚫었다: ${hi.dataset.width}`);
  assert.equal(Number(hi.dataset.height) <= 900, true, `높이 상한을 뚫었다: ${hi.dataset.height}`);
});

test('U6 ★라디우스 mousedown 실행 — dataset.radius 와 «패널 두 필드»가 함께 간다', () => {
  /* ⇐ 되돌리기: 배선을 끊거나(dataset 미기록) 슬라이더·숫자 중 «하나만» 맞추면 빨강.
     실측으로 셋이 갈라져 있었다: dataset 75 / 슬라이더 "60" / 숫자 "75". */
  const b = mkBlock({ radius: '10' });
  const r = drive('radius', 'se', b, [[-20, -20]]);
  assert.equal(b.dataset.radius, '30', 'se 를 안쪽으로 20 끌면 반경이 20 늘어야 한다');
  assert.equal(r.els['mdl-radius-slider'].value, '30', '슬라이더가 안 따라온다');
  assert.equal(r.els['mdl-radius-number'].value, '30', '숫자가 안 따라온다');
  // 클램프 — 표(0~60) 밖으로 못 나간다
  const hi = mkBlock({ radius: '10' }); drive('radius', 'se', hi, [[-9999, -9999]]);
  assert.equal(hi.dataset.radius, '60');
  const lo = mkBlock({ radius: '10' }); drive('radius', 'se', lo, [[9999, 9999]]);
  assert.equal(lo.dataset.radius, '0');
});

/* ═══════════════════════════════════════════════════════════════════
   U7~U9 — 표가 하나인가 · 클래스가 자기 것인가 · 판정이 «표시키»인가
═══════════════════════════════════════════════════════════════════ */
test('U7 ★SSOT — 패널의 min/max 와 핸들의 클램프가 «같은 표»를 본다', () => {
  // ⇐ 되돌리기: 어느 한쪽에 숫자 리터럴을 다시 넣으면 빨강
  assert.match(CODE.prop, /import \{[^}]*MODAL_LIMITS[^}]*\} from '\.\.\/blocks\/modal-block\.js'/,
    '패널이 표를 «안 읽고» 자기 숫자를 갖는다');
  for (const [id, key] of [['mdl-w-number', 'width'], ['mdl-h-number', 'height'], ['mdl-radius-number', 'radius']]) {
    const row = CODE.prop.match(new RegExp(`id="${id}"[^>]*`));
    assert.ok(row, `${id} 행을 못 찾았다 — 검사가 대상을 놓쳤다`);
    assert.match(row[0], new RegExp(`min="\\$\\{L\\.${key}\\.min\\}"`), `${id} 의 min 이 리터럴이다`);
    assert.match(row[0], new RegExp(`max="\\$\\{L\\.${key}\\.max\\}"`), `${id} 의 max 가 리터럴이다`);
  }
  // 핸들 쪽 — 떼어낸 두 핸들러 «안»에 크기·반경 리터럴이 없다
  const nums = (RESIZE_SRC + '\n' + RADIUS_SRC).match(/\b(?:80|860|30|900|60)\b/g);
  assert.equal(nums, null, `핸들이 자기 리터럴을 갖는다: ${nums}`);
  assert.match(RESIZE_SRC, /MODAL_LIMITS\.width/);
  assert.match(RADIUS_SRC, /MODAL_LIMITS\.radius/);
});

test('U8 ★모달 핸들은 «자기» 클래스를 쓴다 — .asset-[별] 을 빌리지 않는다', () => {
  /* ⇐ 되돌리기: .asset-overlay-handle 로 되돌리면 빨강.
     빌리면 hideAssetResizeHandles() 의 일괄 remove 에 쓸려 나간다 —
     아이콘 원형이 실제로 그렇게 물렸다(재클릭 시 1→0개, css/editor-blocks.css 에 기록). */
  const show = sliceDecl(CODE.handles, 'function showModalResizeHandles(', 'overlay-handles')
             + sliceDecl(CODE.handles, 'function hideModalResizeHandles(', 'overlay-handles')
             + sliceDecl(CODE.handles, 'function showModalRadiusHandles(', 'overlay-handles')
             + sliceDecl(CODE.handles, 'function hideModalRadiusHandles(', 'overlay-handles');
  assert.match(show, /mdl-overlay-handle/);
  assert.match(show, /mdl-radius-handle/);
  assert.equal(/asset-/.test(show), false, '모달 핸들이 에셋 클래스를 빌린다 — 남의 정리에 쓸려 나간다');
  // 그리고 «자기» hide 함수를 갖는다(에셋 hide 를 부르지 않는다)
  assert.equal(/hideAsset/.test(show), false);
});

test('U9 ★자동 가운데정렬은 «표시키 존재검사»다 — 값비교가 아니다', () => {
  /* ⇐ 되돌리기: `'autoCentered' in block.dataset` 를 `block.dataset.align === 'left'` 같은
     «값비교»로 바꾸면 아래 둘째 단언이 빨강.
     그 변이가 사고인 이유: 사용자가 center → left 로 되돌린 순간 다시 「안 건드림」으로 읽혀
     «다음 리사이즈에서 또» center 로 덮인다. 사용자의 선택이 계속 지워진다. */
  assert.match(SETMODE_SRC, /'autoCentered' in block\.dataset/,
    '판정이 표시키 존재검사가 아니다');

  const run = (ds, axis, opts = {}) => {
    const ctx = vm.createContext({
      Math, String, Number, Object,
      window: { MODAL_AUTOCENTER: opts.flag !== false },
    });
    vm.runInContext(SETMODE_SRC + '\nglobalThis.__f = setModalSizeMode;', ctx);
    const b = { dataset: { wMode: 'full', hMode: 'auto', ...ds } };
    const filled = ctx.__f(b, axis, 'fixed');
    return { b, filled };
  };
  // ⑴ 처음 늘어나는 순간 — 채운다
  const a = run({ align: 'left' }, 'w');
  assert.equal(a.filled, true);
  assert.equal(a.b.dataset.align, 'center');
  assert.equal(a.b.dataset.vAlign, 'center');
  assert.equal(a.b.dataset.autoCentered, '1');
  // ⑵ ★표시키가 이미 있으면 — 사용자가 left 로 되돌려 뒀어도 «안» 덮는다
  const c = run({ align: 'left', autoCentered: '1' }, 'h');
  assert.equal(c.filled, false);
  assert.equal(c.b.dataset.align, 'left', '사용자가 되돌린 정렬을 다시 덮었다 — 값비교로 판정하고 있다');
  // ⑶ 이미 fixed 면 «늘어나는 순간»이 아니다
  const d = run({ wMode: 'fixed', align: 'left' }, 'w');
  assert.equal(d.filled, false);
  assert.equal(d.b.dataset.align, 'left');
  // ⑷ ★킬스위치 — 되돌리기는 js/feature-flags.js 한 줄이다
  const e = run({ align: 'left' }, 'w', { flag: false });
  assert.equal(e.filled, false);
  assert.equal(e.b.dataset.align, 'left');
  assert.match(CODE.flags, /MODAL_AUTOCENTER\s*=\s*(true|false)/, '킬스위치가 feature-flags.js 에 없다');
});
