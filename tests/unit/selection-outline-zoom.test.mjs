/* U-M63 / U-M65 — 「배율을 바꿔도 선택 테두리가 «상자 안»에 «한 줄로 진하게»」를 잠근다.
 *   실행: node --test "tests/unit/*.test.mjs"  ·  DOM 없이 «소스에서 진짜 _geomOf 를» 떼어 실행한다.
 *
 * ★왜 이 파일이 생겼나 — 윈도우 실기 QA(미니4호기, 대상은 «옛» dev 6461a28)가 둘을 올렸다.
 *   M63  400% 에서 아웃라인이 «4px, 그리고 박스 바깥»
 *        (`outline-width: calc(1px * 0.25)` 를 Chromium 이 사용값 1px 로 «올림»하는데
 *         `outline-offset` 은 −0.25px 그대로 → 굵어진 몫의 절반이 상자 «밖»에 찍힌다)
 *   M65  40% 부근에서 카드 «아래» 테두리가 사실상 안 보인다(파랑우세 아래 17 vs 위 116 / 옆 149)
 *        — 가려짐이 아니라 «서브픽셀 반올림»으로 한 줄이 두 줄로 갈려 둘 다 옅어진 것.
 *
 * ★★둘 다 «지금 dev 에서는 안 난다» — M67(선택 표시를 오버레이 층의 SVG 로 이동)이 막고 있다.
 *   막는 것은 «두 가지»이고, 이 파일은 그 둘을 각각 검사로 세운다:
 *     ⑴ CSS outline 을 «투명으로» 중화한다(css/editor-blocks.css 의 body.sel-ov 절).
 *        ⇒ M63 의 원인인 outline-width/offset 불일치가 «아무것도 칠하지 않는다».
 *     ⑵ SVG 선을 «디바이스 격자»에 스냅해 상자 «안쪽»에 놓는다(_snapLo/_snapHi).
 *        ⇒ 선의 시작 변이 디바이스 정수라 «완전히 칠해진 행»이 반드시 하나 생긴다(M65 해소).
 *
 * ★실측 근거(2026-09-06, 격리 인스턴스 · dpr 은 스크린샷높이/innerHeight 로 «재서» 씀):
 *   지표 = 파랑우세 b−r. 카드 네 변을 배율 400/100/40/10 에서 각각 잰 값.
 *     지금 dev  : 네 변 전부 155 · 두께 2 디바이스행(dpr2) · 상자 «밖» 파랑 0
 *     양성대조  : 같은 트리 사본에서 SEL_OVERLAY_ENABLED=false 로만 되돌림
 *                 → 400% 에서 «4 디바이스행 · 상자 밖 파랑 155»(M63 재현)
 *                 → 40%·dpr1.25 에서 아래·옆이 «116»(위 155) — M65 의 비대칭 방향 재현
 *   ⚠️M65 의 «17» 은 이 맥(dpr 2 / 에뮬 1·1.25·1.5)에서 재현되지 않았다. 보고는 윈도우 실기였다.
 *     ⇒ 이 파일이 잠그는 것은 «17 이라는 수치»가 아니라 그것을 낳는 «기하 조건»이다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SRC = rd('js/selection-overlay.js');
const HANDLES = rd('js/overlay-handles.js');
const CSS = rd('css/editor-blocks.css');

/** 이름으로 최상위 선언 한 덩이를 잘라낸다(중괄호 균형). export 접두는 벗긴다. */
function slice(head) {
  const i = SRC.indexOf(head);
  assert.ok(i >= 0, `소스에서 «${head}» 를 못 찾았다 — 이름이 바뀌었으면 이 검사도 같이 옮겨라`);
  let j = SRC.indexOf('{', i), depth = 0;
  for (let k = j; k < SRC.length; k++) {
    if (SRC[k] === '{') depth++;
    else if (SRC[k] === '}') { depth--; if (!depth) { j = k + 1; break; } }
  }
  return SRC.slice(i, j).replace(/^export\s+/, '');
}
const line = re => { const m = SRC.match(re); assert.ok(m, `소스에서 «${re}» 를 못 찾았다`); return m[0]; };

/* ── 하네스 재료 ────────────────────────────────────────────────────────────
 * ⛔_geomOf 를 «베끼지» 않는다 — 제품 함수를 그대로 실행한다(베끼면 검사가 코드와 갈라진다).
 *   DOM 에 닿는 것만 «최소로» 스텁한다: _cornerScreen(상자 꼭지점) · getComputedStyle(반경) · _dpr. */
const DEPS = [
  'function _radiiOf(', 'function _clampRadii(', 'function _insetRadii(', 'function _geomOf(',
];
const CONSTS = [
  line(/const _rowEdge = [^\n;]+;/),
  line(/const _snapLo = [^\n;]+;/),
  line(/const _snapHi = [^\n;]+;/),
  line(/const _RAD_PROPS = \{[\s\S]*?\};/),
  line(/const _ZERO_R = \{[^\n]*\};/),
  line(/export const STROKE_W = \{[^\n]*\};/).replace(/^export\s+/, ''),
  line(/const _strokeOf = [^\n;]+;/),
];

/** CORNER_DIRS 는 «순서»가 계약이다 — _geomOf 가 `[nw, ne, sw_, se]` 로 구조분해한다. */
const CD = HANDLES.match(/export const CORNER_DIRS = (\[[^\]]*\]);/);
assert.ok(CD, 'overlay-handles.js 에서 CORNER_DIRS 를 못 찾았다');
const CORNER_DIRS = JSON.parse(CD[1].replace(/'/g, '"'));

/** dpr 을 «바꿔 가며» 같은 소스를 돌린다. mutate 로 «망가뜨린 사본»도 만들 수 있다(양성대조). */
function makeGeom(dpr, mutate = s => s) {
  const src = mutate([
    `const CORNER_DIRS = ${JSON.stringify(CORNER_DIRS)};`,
    `const _dpr = () => ${dpr};`,
    /* DOM 스텁 — 상자의 «네 꼭지점»만 준다. 나머지 기하는 전부 제품 코드가 계산한다. */
    'const _cornerScreen = (el, dir) => el.__c[dir];',
    ...CONSTS,
    ...DEPS.map(h => slice(h)),
  ].join('\n'));
  const ctx = vm.createContext({
    getComputedStyle: el => el.__cs,
    Math, JSON, Number, String, Object,
  });
  vm.runInContext(src + '\nglobalThis.__g = { _geomOf, _snapLo, _snapHi, _rowEdge, STROKE_W };', ctx);
  return ctx.__g;
}

/** 축정렬 상자 하나 — _cornerScreen 스텁이 이 네 꼭지점을 돌려준다. */
function fixture(l, t, r, b, radius = '0px') {
  return {
    offsetWidth: r - l, offsetHeight: b - t,
    __cs: { borderTopLeftRadius: radius, borderTopRightRadius: radius,
            borderBottomRightRadius: radius, borderBottomLeftRadius: radius },
    __c: { nw: { x: l, y: t }, ne: { x: r, y: t }, sw: { x: l, y: b }, se: { x: r, y: b } },
  };
}
/** _geomOf 는 «컨텍스트 안»에서 _cornerScreen 을 찾는다 — 스텁도 같은 컨텍스트에 있어야 한다.
 *  (처음엔 new Function 인자로 넘겼다가 `_cornerScreen is not defined` 로 죽었다.) */
const geomOf = (G, el, scale) => G._geomOf(el, '', scale);

/* ── 격자 ──────────────────────────────────────────────────────────────────
 * 배율 400 · 100 · 40 · 10 % 를 다 돈다(M63 은 400%, M65 는 40% 가 핵심이지만
 * «다른 배율을 깨뜨리지 않았는지»가 같이 잠겨야 한다). dpr 은 «가정하지 않고» 흔한 값을 다 돈다. */
const DPRS = [1, 1.25, 1.5, 2, 2.5, 3];
const ZOOMS = [4, 1, 0.4, 0.1];              // 400% · 100% · 40% · 10%
const FRACS = [0, 1 / 16, 1 / 8, 0.2, 0.25, 1 / 3, 0.375, 0.5, 0.625, 2 / 3, 0.75, 0.8, 0.875, 0.9375, 0.99];
const EPS = 1e-9;

/** 한 상자에서 네 변의 «칠해지는 띠»(선 중심 ± 반굵기)를 돌려준다. */
function bands(g) {
  const h = g.h;
  return {
    top:    { lo: g.T - h, hi: g.T + h, boxLo: g.raw.t, boxHi: g.raw.b },
    bottom: { lo: g.B - h, hi: g.B + h, boxLo: g.raw.t, boxHi: g.raw.b },
    left:   { lo: g.L - h, hi: g.L + h, boxLo: g.raw.l, boxHi: g.raw.r },
    right:  { lo: g.R - h, hi: g.R + h, boxLo: g.raw.l, boxHi: g.raw.r },
  };
}
/** 각 dpr·배율·소수부에 대해 케이스를 돌린다. cb(g, k, zoom, label) */
function forGrid(cb, { radius = '0px', w = 120, h = 60 } = {}) {
  for (const k of DPRS) {
    const G = makeGeom(k);
    for (const zoom of ZOOMS) {
      for (const fx of FRACS) for (const fy of FRACS) {
        const l = 100 + fx, t = 200 + fy;
        const el = fixture(l, t, l + w, t + h, radius);
        cb(geomOf(G, el, zoom), k, zoom, `dpr=${k} zoom=${zoom * 100}% frac=(${fx.toFixed(4)},${fy.toFixed(4)})`);
      }
    }
  }
}

/* ═════ 0. 하네스가 «자기 자신»을 검사한다 ════════════════════════════════
 * ★본보기 = google-login-loopback 의 U-GLOGIN-0. 잘라 넣은 코드가 부르는 함수를
 *   하나라도 «안 실으면» 검사가 조용히 엉뚱한 것을 재거나 매달린다. 사람이 목록을
 *   손으로 맞추는 규약은 반드시 갈라지므로 «기계»가 센다. */
test('U-M63-0 ★하네스가 _geomOf 가 부르는 «최상위 선언 전부»를 싣는다', () => {
  const body = DEPS.map(h => slice(h)).join('\n');
  const called = new Set([...body.matchAll(/\b(_[A-Za-z][A-Za-z0-9_]*)\s*\(/g)].map(m => m[1]));
  const loaded = new Set([
    ...DEPS.map(h => h.match(/function\s+(\w+)/)[1]),
    ...CONSTS.map(c => c.match(/const\s+(\w+)/)[1]),
    '_dpr', '_cornerScreen',                       // 스텁으로 «명시해» 꽂는 둘(컨텍스트 안에 정의된다)
  ]);
  const declaredInSrc = n => new RegExp(`(?:function|const)\\s+${n}\\b`).test(SRC);
  const missing = [...called].filter(n => !loaded.has(n) && declaredInSrc(n));
  assert.deepEqual(missing, [], `하네스가 «안 실은» 선언: ${missing.join(', ')} — DEPS/CONSTS 에 추가하라`);
  // 그리고 실제로 «돈다»는 것까지 확인한다(문자열 검사만으론 로드 실패를 못 잡는다).
  const g = geomOf(makeGeom(2), fixture(10.3, 20.7, 130.3, 80.7), 1);
  assert.equal(g.rot, false);
  assert.ok(Number.isFinite(g.T) && Number.isFinite(g.B), '_geomOf 가 축정렬 기하를 못 냈다');
});

test('U-M63-0b CORNER_DIRS 의 «순서»가 _geomOf 의 구조분해와 같다', () => {
  assert.deepEqual(CORNER_DIRS, ['nw', 'ne', 'sw', 'se'],
    '_geomOf 는 `const [nw, ne, sw_, se] = CORNER_DIRS.map(...)` 로 «순서»에 기댄다');
});

/* ═════ 1. M63 — 선이 «상자 밖»으로 나가지 않는다 ═══════════════════════ */
test('U-M63-1 배율 400·100·40·10% × dpr 6종에서 선의 «띠 전체»가 상자 안이다', () => {
  let n = 0;
  forGrid((g, k, zoom, label) => {
    for (const [e, b] of Object.entries(bands(g))) {
      assert.ok(b.lo >= b.boxLo - EPS,
        `${label} ${e}: 띠 시작 ${b.lo} 가 상자 ${b.boxLo} «밖» — M63 재발(선이 박스 바깥)`);
      assert.ok(b.hi <= b.boxHi + EPS,
        `${label} ${e}: 띠 끝 ${b.hi} 가 상자 ${b.boxHi} «밖» — M63 재발(선이 박스 바깥)`);
      n++;
    }
  });
  assert.ok(n >= 4000, `표본이 너무 적다(${n}) — 격자가 줄었으면 검사가 헐거워진 것이다`);
});

test('U-M63-2 [양성대조] «옛» CSS outline 모델은 400% 에서 실제로 상자 밖으로 나간다', () => {
  /* 옛 판(6461a28)의 기하를 «지정값이 아니라 사용값»으로 계산한다.
   *   지정: outline-width = calc(1px × inv-zoom) = 1/zoom (로컬 CSS px), outline-offset = −그 값
   *   ⇒ 의도한 띠는 [변−w, 변] — 상자에 «딱 붙어 안쪽». 이게 M56 의 줌불변이었다.
   *   ★그런데 Chromium 은 outline-width «사용값»을 최소 «디바이스 1px»(= 1/dpr 로컬 CSS px)로
   *     올리면서 outline-offset 은 «안» 올린다. 그 초과분이 그대로 상자 «밖»에 찍힌다.
   *   ⇒ used = max(1/zoom, 1/dpr) · 바깥으로 나간 몫(화면 CSS px) = max(1, zoom/dpr) − 1
   * ★실측으로 이 모델을 검증했다(사본에서 SEL_OVERLAY_ENABLED=false 로만 되돌림, dpr 2):
   *     400% — 계산 outlineWidth 0.5px(지정 0.25px) · offset −0.25px · 화면 «4 디바이스행» ·
   *            상자 밖 파랑우세 155  ⇒ 모델이 말하는 «밖 1 화면CSS px = 2 디바이스행»과 일치
   *     100%/40%/10% — 밖 0 (보고가 400% 에서만 난 이유) */
  const usedLocal = (zoom, dpr) => Math.max(1 / zoom, 1 / dpr);
  const outsideScreen = (zoom, dpr) => Math.max(0, (usedLocal(zoom, dpr) - 1 / zoom) * zoom);
  const thickScreen = (zoom, dpr) => usedLocal(zoom, dpr) * zoom;

  assert.equal(+usedLocal(4, 2).toFixed(6), 0.5,
    '실측한 계산값(400%·dpr2 에서 outline-width 0.5px)과 모델이 어긋난다 — 모델부터 고쳐라');
  assert.ok(outsideScreen(4, 2) > 0,
    '양성대조가 «안 빨갛다» — 대조 모델이 틀렸다면 U-M63-1 의 초록도 못 믿는다');
  assert.equal(outsideScreen(4, 2), 1, '400%·dpr2: 밖으로 «화면 1 CSS px»(= 2 디바이스행)');
  assert.equal(thickScreen(4, 2) * 2, 4, '400%·dpr2: 두께 «4 디바이스행» — 실측과 같다');
  assert.equal(outsideScreen(4, 1), 3, '400%·dpr1(윈도우 보고): 밖으로 3px — 보고의 「4px, 박스 바깥」과 같은 판');
  assert.equal(outsideScreen(1, 2), 0, '100% 에서는 옛 모델도 «안» 나갔다 — 그래서 400% 에서만 보고됐다');
  assert.equal(outsideScreen(0.4, 2), 0, '40% 도 «폭 초과»로는 안 나간다 — M65 는 다른 기제(반올림)다');

  /* ★그리고 «지금 코드»는 같은 자리에서 0 이다 — 대조가 성립한다. */
  const G = makeGeom(2);
  const g = geomOf(G, fixture(100.3, 200.7, 220.3, 260.7), 4);
  for (const [e, b] of Object.entries(bands(g))) {
    assert.ok(b.lo >= b.boxLo - EPS && b.hi <= b.boxHi + EPS, `지금 코드가 400% 에서 ${e} 를 상자 밖에 그렸다`);
  }
});

test('U-M63-3 [양성대조] 스냅을 «CSS 정수 반올림»으로 되돌리면 U-M63-1 이 빨개진다', () => {
  /* ⛔공용 트리를 건드리지 않는다 — «잘라낸 문자열 사본»만 망가뜨린다(harness.md §3-c ⑵-b). */
  const broken = s => s
    .replace(/const _snapLo = [^\n;]+;/, 'const _snapLo = (v, k, h) => Math.round(v) + h;')
    .replace(/const _snapHi = [^\n;]+;/, 'const _snapHi = (v, k, h) => Math.round(v) - h;');
  const G = makeGeom(2, broken);
  let violated = 0;
  for (const fx of FRACS) {
    const el = fixture(100 + fx, 200 + fx, 220 + fx, 260 + fx);
    const g = geomOf(G, el, 4);
    for (const b of Object.values(bands(g))) if (b.lo < b.boxLo - EPS || b.hi > b.boxHi + EPS) violated++;
  }
  assert.ok(violated > 0,
    '망가뜨린 사본이 «통과»했다 — U-M63-1 이 아무것도 안 재고 있다는 뜻이다');
});

/* ═════ 2. M65 — 선이 «옅어지지» 않는다(완전히 칠해진 디바이스 행이 있다) ═══ */
test('U-M65-1 네 변 모두 «완전히 칠해진 디바이스 행/열»을 최소 1개 갖는다', () => {
  let n = 0;
  forGrid((g, k, zoom, label) => {
    for (const [e, b] of Object.entries(bands(g))) {
      const lo = b.lo * k, hi = b.hi * k;
      const full = Math.floor(hi + EPS) - Math.ceil(lo - EPS);
      assert.ok(full >= 1,
        `${label} ${e}: 완전히 칠해진 디바이스 행이 ${full} 개 — M65 재발(선이 두 행으로 갈려 둘 다 옅어진다)`);
      /* ★기제 자체를 박는다 — 띠의 «상자 안쪽을 향하지 않는 쪽 끝»이 디바이스 격자 위에 정확히 있어야 한다.
         위·왼쪽은 _snapLo(ceil) 이라 «시작»이, 아래·오른쪽은 _snapHi(floor) 라 «끝»이 격자다.
         ⚠️처음엔 둘 다 «시작»으로 쟀다가 아래·오른쪽에서 빨갰다 — 검사가 틀렸던 것이지 코드가 아니다. */
      const gridEnd = (e === 'top' || e === 'left') ? lo : hi;
      assert.ok(Math.abs(gridEnd - Math.round(gridEnd)) < 1e-7,
        `${label} ${e}: 띠의 격자쪽 끝이 ${gridEnd} 로 어긋났다 — 디바이스 격자 스냅이 빠졌다(M65 기제 복귀)`);
      n++;
    }
  });
  assert.ok(n >= 4000, `표본이 너무 적다(${n})`);
});

test('U-M65-2 둥근 카드(반경 16px)에서도 «네 변» 판정이 같다 — M65 는 카드 보고였다', () => {
  let n = 0;
  forGrid((g, k, zoom, label) => {
    for (const [e, b] of Object.entries(bands(g))) {
      assert.ok(b.lo >= b.boxLo - EPS && b.hi <= b.boxHi + EPS, `${label} ${e}: 띠가 상자 밖(둥근 카드)`);
      const full = Math.floor(b.hi * k + EPS) - Math.ceil(b.lo * k - EPS);
      assert.ok(full >= 1, `${label} ${e}: 완전히 칠해진 행 ${full} 개(둥근 카드)`);
      n++;
    }
  }, { radius: '16px' });
  assert.ok(n >= 4000, `표본이 너무 적다(${n})`);
});

test('U-M65-3 [양성대조] «옛» CSS outline 모델은 40%·dpr1.25 에서 한 행도 못 채운다', () => {
  /* 옛 판은 선의 시작이 디바이스 격자에 안 맞아 한 줄이 «두 행으로 갈린다».
     실측(사본 SEL_OVERLAY_ENABLED=false, 40%·dpr1.25): 아래·옆 116 / 위 155 — 갈린 쪽이 옅다. */
  const k = 1.25, zoom = 0.4;
  const usedScreen = Math.max(1 / k, (1 / zoom)) * zoom;   // = 1.0 화면 CSS px
  let split = 0;
  for (const f of FRACS) {
    const lo = (200 + f) * k, hi = lo + usedScreen * k;     // 격자에 «안» 맞춘 띠
    if (Math.floor(hi + EPS) - Math.ceil(lo - EPS) < 1) split++;
  }
  assert.ok(split > 0,
    '양성대조가 «안 빨갛다» — 대조 모델이 틀렸다면 U-M65-1 의 초록도 못 믿는다');
});

/* ═════ 3. 무엇이 «막고 있는가» 를 코드로 박는다 ═══════════════════════════ */
test('U-M63-4 M63 의 원인(outline-width/offset)이 «칠하지 않는다» — 중화 절이 살아 있다', () => {
  /* --sel-outline-w 는 지금도 calc(1px * inv-zoom) 이다. 그게 안전한 «유일한» 이유가
     body.sel-ov 중화 절이다. 이 절이 사라지면 M63 이 그대로 돌아온다. */
  assert.match(rd('css/editor-base.css'), /--sel-outline-w:\s*calc\(1px \* var\(--inv-zoom, 1\)\)/,
    '전제가 바뀌었다 — --sel-outline-w 가 더는 배율 역수가 아니면 이 검사의 «이유»를 다시 써라');
  const neutral = /body\.sel-ov #canvas \.selected:not\(\.section-block\)[^{]*\{[^}]*outline-color:\s*transparent\s*!important/;
  assert.match(CSS.replace(/\s*\n\s*/g, ' '), neutral,
    'body.sel-ov 중화 절이 사라졌다 — CSS outline 이 다시 칠해지고 M63 이 재발한다');
});

test('U-M63-5 오버레이 킬스위치가 «켜져» 있다 — 끄면 M63·M65 가 둘 다 돌아온다', () => {
  assert.match(rd('js/feature-flags.js'), /SEL_OVERLAY_ENABLED\s*=\s*true/,
    '★킬스위치를 false 로 내리면 문서 outline 으로 되돌아가고 M63(400% 박스 밖)·'
    + 'M65(40% 아래변 옅음)가 «같이» 재발한다. 실측 근거는 이 파일 머리말의 양성대조.'
    + ' 정말 내려야 한다면 그 결정을 여기서 «명시»하고 이 검사를 같이 고쳐라.');
});

test('U-M65-4 선 굵기는 «배율 보정을 달지 않는다» — 오버레이는 스케일러 밖이다', () => {
  /* ⚠️주석을 «먼저» 걷어낸다 — 이 규칙 안의 주석이 --inv-zoom 을 «설명»하고 있어서
     주석째로 재면 「보정이 붙었다」로 오탐한다(첫 판이 정확히 그렇게 빨갰다). */
  const NOCOMMENT = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const m = NOCOMMENT.match(/\.ss-sel-path\s*\{[^}]*\}/);
  assert.ok(m, 'css/editor-blocks.css 에서 .ss-sel-path 규칙을 못 찾았다');
  assert.match(m[0], /stroke-width:\s*1\s*;/, '.ss-sel-path 의 stroke-width 가 1 이 아니다');
  assert.ok(!/--inv-zoom/.test(m[0]),
    'stroke-width 에 --inv-zoom 이 붙었다 — 오버레이는 #canvas-scaler «밖»이라 보정이 «틀린다»(굵기가 배율에 흔들려 M63·M65 가 되돌아온다)');
});
