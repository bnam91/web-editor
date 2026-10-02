/* U-CIRCLE — 「원 도형의 선택 표시」. 2026-09-21 현빈 지시 8번으로 «답이 바뀐 자리»다.
 *
 * ★증상(2026-09-20, T-072) = «가려짐»이 아니라 «접선을 선이 덮는다».
 *   원은 자기 상자의 네 변에 «정확히 접한다»(block-factory.js ellipse rx=ry=50, shape-svg 는
 *   preserveAspectRatio:none + width/height 100%). 선택 테두리는 그 상자 «안쪽» 1.0~1.4 화면px 를
 *   덮는 네모다(_snapLo/_snapHi — 「선은 상자 안」은 U-M63-1 이 잠가 놓은 규약).
 *   ⇒ 네 접점 부근이 선에 덮여 «평평해» 보인다.
 *
 * ★옛 답(2026-09-20 ㉮) = «원의 선만 상자 바로 밖으로». 그 답은 대가를 둘 남겼다:
 *   ⑴ 상자 밖 선이 맞닿은 이웃의 1px 을 덮어(§4-3) «맞닿은 변만 안으로 되돌리는» 보정
 *      (_blockedEdges/_outsetEdgesOf)이 필요했고,
 *   ⑵ 그 보정 때문에 «세로로 쌓인» 실제 화면에서는 위·아래가 여전히 물렸다
 *      (실측 9506·줌40%·120px 원: 윗선 y158 vs 상자 윗변 157.119 ⇒ 0.88px 파고듦).
 *
 * ★새 답(2026-09-21 현빈) = «아이콘 서클과 같은 길».
 *   현빈: 「icb_k7kbb_msmevtj 는 문제없지 않니? 같은 원모양인데 아웃라인 이것처럼 하면 될 것 같은데」
 *   아이콘 서클은 선을 다른 블럭과 똑같이 상자 «안»에 두고, 원의 둘레는 ::before 링이 «따로» 그린다
 *   (css/editor-blocks.css `.icon-circle-block.selected::before`). 접점이 선에 덮여도 그 자리에
 *   «원을 따르는 선»이 있어 «잘린» 게 아니라 «둘린» 것으로 읽힌다.
 *   ⇒ 원 도형도 같은 길: `.shape-block.selected[data-shape-type="ellipse"]::before`.
 *     선의 자리는 «모든 블럭에서 같게»(상자 안) 되돌아갔고, 그래서 이웃 불가침도 공짜로 돌아왔다.
 *
 * ★이 파일이 지키는 것
 *   ⑴ 원이 «예외»가 아니다 — _selOutsetOf 에 타입 목록이 없다(선언형 탈출구만 남는다).
 *   ⑵ 바깥 스냅 «산술»은 살아 있다 — 탈출구로 켜면 옛 경로가 한 글자도 안 바뀐 채 돈다.
 *   ⑶ ㉮·T-028 불변 — 선의 «모양»은 여전히 네모(호 0개), 반경 블럭도 그대로.
 *   ⑷ CSS 링이 «아이콘 서클과 같은 꼴»이고 사정거리가 원 하나다.
 *   숫자(픽셀)는 tests/dom/shape-ellipse-selection-outline·shape-ellipse-neighbor 가 브라우저에서 잰다.
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

/** 이름으로 최상위 선언 한 덩이를 잘라낸다(중괄호 균형) — U-M63 하네스와 «같은» 방식. */
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
const line = re => { const m = SRC.match(re); assert.ok(m, `소스에서 «${re}» 를 못 찾았다`); return m[0].replace(/^export\s+/, ''); };

const CD = HANDLES.match(/export const CORNER_DIRS = (\[[^\]]*\]);/);
assert.ok(CD, 'overlay-handles.js 에서 CORNER_DIRS 를 못 찾았다');
const CORNER_DIRS = JSON.parse(CD[1].replace(/'/g, '"'));

const DEPS = ['function _radiiOf(', 'function _clampRadii(', 'function _insetRadii(',
              'function _geomOf(', 'function _edgesOf(', 'function _pathData(',
              'function _selOutsetOf(',
              'export function subtractInterval('];
const CONSTS = [
  line(/const _rowEdge = [^\n;]+;/), line(/const _snapLo = [^\n;]+;/), line(/const _snapHi = [^\n;]+;/),
  line(/const _snapLoOut = [^\n;]+;/), line(/const _snapHiOut = [^\n;]+;/),
  line(/export const SEL_FOLLOW_RADIUS = [^\n;]+;/),   // ⛔false 그대로 쓴다 — 여기서 true 로 바꾸지 마라
  line(/const _RAD_PROPS = \{[\s\S]*?\};/), line(/const _ZERO_R = \{[^\n]*\};/),
  line(/export const STROKE_W = \{[^\n]*\};/), line(/const _strokeOf = [^\n;]+;/),
  line(/const _n = [^\n;]+;/), line(/const _arc = [^\n;]+;/),
];

function makeCtx(dpr) {
  const src = [
    `const CORNER_DIRS = ${JSON.stringify(CORNER_DIRS)};`,
    `const _dpr = () => ${dpr};`,
    'const _cornerScreen = (el, dir) => el.__c[dir];',
    ...CONSTS, ...DEPS.map(slice),
  ].join('\n');
  const ctx = vm.createContext({ getComputedStyle: el => el.__cs, Math, JSON, Number, String, Object,
    document: { getElementById: () => null } });
  vm.runInContext(src + '\nglobalThis.__g = { _geomOf, _edgesOf, _pathData, _selOutsetOf, SEL_FOLLOW_RADIUS };', ctx);
  return ctx.__g;
}

/** 축정렬 상자 하나 — U-M63 의 fixture 와 같은 꼴. */
function fixture(l, t, r, b, radius = '0px') {
  return {
    offsetWidth: r - l, offsetHeight: b - t,
    __cs: { borderTopLeftRadius: radius, borderTopRightRadius: radius,
            borderBottomRightRadius: radius, borderBottomLeftRadius: radius },
    __c: { nw: { x: l, y: t }, ne: { x: r, y: t }, sw: { x: l, y: b }, se: { x: r, y: b } },
  };
}
/** 네 변의 «칠해지는 띠»(선 중심 ± 반굵기) + 상자 변 — U-M63 의 bands 와 같은 꼴. */
function bands(g) {
  const h = g.h;
  return {
    top:    { lo: g.T - h, hi: g.T + h, boxLo: g.raw.t, boxHi: g.raw.b },
    bottom: { lo: g.B - h, hi: g.B + h, boxLo: g.raw.t, boxHi: g.raw.b },
    left:   { lo: g.L - h, hi: g.L + h, boxLo: g.raw.l, boxHi: g.raw.r },
    right:  { lo: g.R - h, hi: g.R + h, boxLo: g.raw.l, boxHi: g.raw.r },
  };
}
/** 「원의 접선이 선에 덮인 길이」(CSS px, 왼쪽 세로변) — 옛 증상 지표. 새 판에서는 «링이 그 자리를
 *  같은 색으로 두르므로» 0 이 목표가 아니다. 산술이 살아 있는지 보는 데만 쓴다. */
function coveredChord(g, edges) {
  const W = g.raw.r - g.raw.l, H = g.raw.b - g.raw.t;
  const R = Math.min(W, H) / 2, cy = (g.raw.t + g.raw.b) / 2;
  const d = (g.L + g.h) - g.raw.l;
  if (d <= 0) return 0;
  const half = Math.sqrt(Math.max(0, 2 * R * d - d * d));
  let cov = 0;
  for (const [a, b] of edges.left) {
    const lo = Math.max(a, cy - half), hi = Math.min(b, cy + half);
    if (hi > lo) cov += hi - lo;
  }
  return cov;
}
const DPRS = [1, 1.25, 1.5, 2, 2.5, 3];
const ZOOMS = [4, 1, 0.4, 0.1];
const FRACS = [0, 1 / 16, 1 / 8, 0.2, 0.25, 1 / 3, 0.375, 0.5, 0.625, 2 / 3, 0.75, 0.8, 0.875, 0.9375, 0.99];
const EPS = 1e-9;
function forGrid(cb, { radius = '0px', w = 120, h = 60, outset = true } = {}) {
  for (const k of DPRS) {
    const G = makeCtx(k);
    for (const zoom of ZOOMS) for (const fx of FRACS) for (const fy of FRACS) {
      const l = 100 + fx, t = 200 + fy;
      const el = fixture(l, t, l + w, t + h, radius);
      cb(G._geomOf(el, '', zoom, outset), k, zoom, `dpr=${k} zoom=${zoom * 100}% frac=(${fx.toFixed(4)},${fy.toFixed(4)})`, G, el);
    }
  }
}

/* ═════ 0. 하네스 자기검사 — 안 실은 선언이 있으면 조용히 엉뚱한 걸 잰다(U-M63-0 과 같은 방어) ═════ */
test('U-CIRCLE-0 ★하네스가 잘라 넣은 코드가 부르는 최상위 선언을 «전부» 실었다', () => {
  const loaded = new Set([...CONSTS, ...DEPS.map(slice)]
    .flatMap(s => [...s.matchAll(/(?:function|const)\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1])));
  ['_cornerScreen', '_dpr', 'CORNER_DIRS', 'getComputedStyle', 'Math', 'subtractInterval'].forEach(n => loaded.add(n));
  const missing = new Set();
  for (const s of DEPS.map(slice))
    for (const m of s.matchAll(/(?<![.\w$])([_a-zA-Z$][\w$]*)\s*\(/g))
      if (/^_/.test(m[1]) && !loaded.has(m[1])) missing.add(m[1]);
  assert.deepEqual([...missing], [], 'DEPS/CONSTS 에 추가하라');
  // 그리고 실제로 «돈다»는 것까지(문자열 검사만으론 로드 실패를 못 잡는다)
  const g = makeCtx(2)._geomOf(fixture(697, 117.1188, 737, 157.1187), '', 0.4);
  assert.equal(g.rot, false);
  assert.ok(Number.isFinite(g.T) && Number.isFinite(g.L), '_geomOf 가 축정렬 기하를 못 냈다');
});

/* ═════ 1. 새 계약 — 원도 «기본 경로»다(선은 상자 안). 예외 목록이 없다 ═══════════ */
test('U-CIRCLE-1 ★원은 더 이상 «예외»가 아니다 — _selOutsetOf 에 타입 목록이 없고 원도 거짓', () => {
  const G = makeCtx(2);
  const host = (sel, kid = null, dataset = {}) => ({
    dataset,
    matches: s => s.split(',').some(one => one.trim() === sel),
    querySelector: s => (kid && s.includes(kid) ? {} : null),
  });
  const ELL = '.shape-block[data-shape-type="ellipse"]';
  assert.equal(G._selOutsetOf(host(ELL)), false,
    '★원이 아직 옵트인된다 — 그러면 맞닿음 보정이 다시 필요해지고 위·아래 물림이 되살아난다(2026-09-21 지시 8)');
  assert.equal(G._selOutsetOf(host('.frame-block', ELL)), false, '★원의 래퍼 프레임이 아직 옵트인된다');
  for (const t of ['rectangle', 'polygon', 'star', 'line', 'arrow']) {
    assert.equal(G._selOutsetOf(host(`.shape-block[data-shape-type="${t}"]`)), false, `${t} 가 옵트인됐다`);
  }
  assert.equal(G._selOutsetOf(host('.text-block')), false, '글자 블럭이 옵트인됐다');
  // 선언형 탈출구는 «남아 있다» — 산술을 되살릴 유일한 길이다
  assert.equal(G._selOutsetOf(host('.text-block', null, { selOutset: 'on' })), true, 'dataset 탈출구가 죽었다');
  assert.equal(G._selOutsetOf(host(ELL, null, { selOutset: 'off' })), false, 'dataset 탈출구가 «off» 를 무시한다');
  // ⛔소스에 타입 목록이 다시 생기면 빨강 — 「목록으로 관리되는 규칙」이 이 파일의 고질이다
  assert.doesNotMatch(slice('function _selOutsetOf('), /shape-type|shape-block|matches|querySelector/,
    '★_selOutsetOf 에 타입 판정이 다시 들어왔다 — 켜려면 dataset.selOutset 으로 «그 블럭만» 켜라');
});

test('U-CIRCLE-2 ★원의 선이 다른 블럭과 «같은 규약»(상자 안)으로 돌아왔다 — 이웃 불가침이 공짜로 선다', () => {
  let n = 0;
  forGrid((g, k, zoom, label) => {
    for (const [e, b] of Object.entries(bands(g))) {
      assert.ok(b.lo >= b.boxLo - EPS && b.hi <= b.boxHi + EPS,
        `${label} ${e}: 띠가 상자 밖으로 나갔다 — 맞닿은 이웃 상자를 칠하게 된다(§4-3)`);
      n++;
    }
  }, { outset: false });   // ★_collect 가 원에 넘기는 값이 바로 이 false 다(U-CIRCLE-11 이 배선을 잠근다)
  assert.ok(n >= 4000, `표본이 너무 적다(${n}) — 격자가 줄었으면 검사가 헐거워진 것이다`);
});

/* ═════ 2. 바깥 스냅 «산술»은 살아 있다 — 탈출구로 켜면 옛 경로 그대로 ═══════════ */
test('U-CIRCLE-3 [산술 보존] 탈출구로 켜면 네 띠가 «전부 상자 밖»이고 나간 몫이 굵기+1/dpr 을 안 넘는다', () => {
  let n = 0;
  forGrid((g, k, zoom, label) => {
    const lim = g.sw + 1 / k + EPS;      // ★상수 상한 — 줌에 비례해 번지는 M63 과 «다른» 성질이다
    for (const [e, b] of Object.entries(bands(g))) {
      const inner = (e === 'top' || e === 'left') ? b.hi : b.lo;
      const outer = (e === 'top' || e === 'left') ? b.lo : b.hi;
      const box   = (e === 'top' || e === 'left') ? b.boxLo : b.boxHi;
      if (e === 'top' || e === 'left') {
        assert.ok(inner <= box + EPS, `${label} ${e}: 띠 안쪽끝 ${inner} 가 상자 ${box} 안`);
        assert.ok(box - outer <= lim, `${label} ${e}: 상자 밖으로 ${box - outer} — 상한 ${lim} 초과`);
      } else {
        assert.ok(inner >= box - EPS, `${label} ${e}: 띠 안쪽끝 ${inner} 가 상자 ${box} 안`);
        assert.ok(outer - box <= lim, `${label} ${e}: 상자 밖으로 ${outer - box} — 상한 ${lim} 초과`);
      }
      n++;
    }
  });
  assert.ok(n >= 4000);
});

test('U-CIRCLE-4 [산술 보존] 켜도 «완전히 칠해진 디바이스 행»은 하나 이상이다(M65 불변)', () => {
  let n = 0;
  forGrid((g, k, zoom, label) => {
    for (const [e, b] of Object.entries(bands(g))) {
      const full = Math.floor(b.hi * k + EPS) - Math.ceil(b.lo * k - EPS);
      assert.ok(full >= 1, `${label} ${e}: 완전히 칠해진 행이 ${full} 개 — 선이 두 행으로 갈려 옅어진다(M65 재발)`);
      n++;
    }
  });
  assert.ok(n >= 4000);
});

test('U-CIRCLE-5 [산술 보존] 켠 직선 구간이 바깥 꼭지(L−h … R+h)까지 이어져 네 귀에 구멍이 없다', () => {
  const G = makeCtx(2);
  const g = G._geomOf(fixture(697, 117.1188, 737, 157.1187), '', 0.4, true);
  const e = G._edgesOf(g);
  for (const k of ['top', 'bottom']) {
    assert.equal(e[k].length, 1, `${k} 구간이 하나가 아니다`);
    assert.ok(Math.abs(e[k][0][0] - (g.L - g.h)) < 1e-9, `${k} 시작이 바깥 꼭지가 아니다: ${e[k][0][0]}`);
    assert.ok(Math.abs(e[k][0][1] - (g.R + g.h)) < 1e-9, `${k} 끝이 바깥 꼭지가 아니다: ${e[k][0][1]}`);
  }
  for (const k of ['left', 'right']) {
    assert.ok(Math.abs(e[k][0][0] - (g.T - g.h)) < 1e-9, `${k} 시작이 바깥 꼭지가 아니다`);
    assert.ok(Math.abs(e[k][0][1] - (g.B + g.h)) < 1e-9, `${k} 끝이 바깥 꼭지가 아니다`);
  }
});

test('U-CIRCLE-6 [음성대조] 인자 하나로 두 경로가 갈린다 — 안쪽 12.49px 덮음 vs 바깥 0', () => {
  const G = makeCtx(2);
  const el = fixture(697, 117.1187515258789, 737, 157.11874389648438);   // ★실앱 실측 자리(줌 40% · 100px 원)
  const inside  = G._geomOf(el, '', 0.4);          // ← 지금 원이 타는 경로(상자 «안»)
  const outside = G._geomOf(el, '', 0.4, true);    // ← 탈출구로 켠 경로(상자 «밖»)
  const covIn  = coveredChord(inside,  G._edgesOf(inside));
  const covOut = coveredChord(outside, G._edgesOf(outside));
  assert.ok(Math.abs(covIn - 12.49) < 0.2,
    `안쪽 경로의 덮임이 12.49 가 아니다: ${covIn} — 스냅이 바뀌었으면 CSS 링의 전제도 다시 재라`);
  assert.equal(covOut, 0, `바깥 경로가 여전히 덮는다: ${covOut} — 산술이 죽었다`);
  /* ★이 12.49 는 «결함»이 아니다 — 그 자리를 CSS 링이 «같은 색으로» 두르므로 잘린 게 아니라 둘린 것으로
     보인다(아이콘 서클이 몇 달째 그 모양이고 현빈이 「문제없다」고 한 그 모양이다).
     ⇒ 이 숫자가 0 이 되어야 한다고 읽지 마라. 화면 판정은 DOM 스펙(픽셀)이 한다. */
});

/* ═════ 3. 현빈 결정 ㉮·T-028 — «네모»가 유지되는가 ══════════════════════════════ */
test('U-CIRCLE-7 ★선의 모양은 여전히 네모 — 두 경로 모두 직선 4개·호 0개', () => {
  const G = makeCtx(2);
  for (const outset of [undefined, true]) {
    const g = G._geomOf(fixture(697, 117.1188, 737, 157.1187), '', 0.4, outset);
    const d = G._pathData({ g, edges: G._edgesOf(g) });
    assert.equal((d.match(/A/g) || []).length, 0, `호가 생겼다(outset=${outset}) — 「모든 블럭 네모」 결정 위반: ${d}`);
    assert.equal((d.match(/L/g) || []).length, 4, `직선이 4개가 아니다(outset=${outset}): ${d}`);
    for (const dir of CORNER_DIRS)
      assert.ok(g.r[dir][0] === 0 && g.r[dir][1] === 0,
        `${dir} 반경이 0 이 아니다 — 음수 인셋이 0 을 «키웠다»: ${JSON.stringify(g.r[dir])}`);
  }
});

test('U-CIRCLE-8 ★결정 불변 — 반경 18px 배너/모달은 여전히 네모 + 상자 «안»이다', () => {
  const G = makeCtx(2);
  const el = fixture(200.3, 300.7, 560.3, 480.7, '18px');
  assert.equal(G.SEL_FOLLOW_RADIUS, false, '전역 스위치가 켜졌다 — 2026-09-15 「모든 블럭 네모」 결정이 뒤집혔다');
  const g = G._geomOf(el, '', 1);
  const d = G._pathData({ g, edges: G._edgesOf(g) });
  assert.equal((d.match(/A/g) || []).length, 0, '반경 블럭에 호가 생겼다 — 결정 위반');
  for (const [e, b] of Object.entries(bands(g)))
    assert.ok(b.lo >= b.boxLo - EPS && b.hi <= b.boxHi + EPS, `${e}: 띠가 상자 밖 — 반경 블럭까지 선이 움직였다`);
});

test('U-CIRCLE-9 [산술 보존] 회전판도 켜면 같은 «방향»으로 민다', () => {
  const G = makeCtx(2);
  const rotFix = () => ({
    offsetWidth: 40, offsetHeight: 40,
    __cs: { borderTopLeftRadius: '0px', borderTopRightRadius: '0px', borderBottomRightRadius: '0px', borderBottomLeftRadius: '0px' },
    // 30° 회전한 40×40 상자의 네 꼭지점
    __c: { nw: { x: 100, y: 100 }, ne: { x: 134.641, y: 120 }, sw: { x: 80, y: 134.641 }, se: { x: 114.641, y: 154.641 } },
  });
  const inn = G._geomOf(rotFix(), '', 1);            // 기본 = 안쪽(원이 지금 타는 길)
  const out = G._geomOf(rotFix(), '', 1, true);      // 탈출구 = 바깥
  assert.equal(inn.rot, true); assert.equal(out.rot, true);
  const cx = (100 + 114.641) / 2, cy = (100 + 154.641) / 2;
  const toCenter = p => Math.hypot(p.x - cx, p.y - cy);
  assert.ok(toCenter(inn.o.nw) < toCenter(out.o.nw),
    `회전판에서 두 경로가 같은 자리다(inn ${toCenter(inn.o.nw)} / out ${toCenter(out.o.nw)})`);
  assert.ok(out.r.nw[0] === 0 && out.r.nw[1] === 0, `회전판에서 음수 인셋이 반경을 «키웠다» — 호가 생긴다: ${JSON.stringify(out.r.nw)}`);
});

/* ═════ 4. 배선 — 맞닿음 보정이 «사라졌는가» ═══════════════════════════════════ */
test('U-CIRCLE-10 ★맞닿은 변 보정(_blockedEdges/_outsetEdgesOf)이 코드에서 사라졌다', () => {
  for (const name of ['function _blockedEdges', 'function _outsetEdgesOf']) {
    assert.ok(!SRC.includes(name),
      `★${name} 가 살아 있다 — 이 보정은 «선이 상자 밖»일 때만 필요한 것이고, 지금은 원도 안쪽이다. 남아 있으면 죽은 길이다`);
  }
  const body = SRC.slice(SRC.indexOf('function _collect'), SRC.indexOf('function _collect') + 1200);
  assert.match(body, /outset:\s*_selOutsetOf\(/,
    '★_collect 가 선언형 판정을 직접 안 쓴다 — 어떤 값이 넘어가는지 알 수 없게 됐다');
});

/* ═════ 5. CSS — «아이콘 서클과 같은 꼴»인가, 사정거리는 원 하나인가 ══════════════ */
/** 선택자로 규칙 한 덩이를 꺼낸다. */
function ruleOf(sel) {
  const i = CSS.indexOf(sel);
  assert.ok(i >= 0, `CSS 에서 «${sel}» 규칙을 못 찾았다`);
  const j = CSS.indexOf('{', i), k = CSS.indexOf('}', j);
  return CSS.slice(j + 1, k);
}

test('U-CIRCLE-11 ★원 도형 링이 «아이콘 서클과 같은 꼴»이다 (현빈 2026-09-21 「아웃라인 이것처럼」)', () => {
  const icb = ruleOf('.icon-circle-block.selected::before');
  const ell = ruleOf('.shape-block.selected[data-shape-type="ellipse"]::before');
  /* 두 규칙이 «같은 선언»을 갖는지 이름으로 대조한다 — 값까지 한 글자씩 못박으면 아이콘 서클 쪽
     튜닝에 거짓 빨강이 난다. 대신 «링을 링이게 하는» 넷은 값까지 본다. */
  for (const [prop, re] of [['border-radius', /border-radius:\s*50%/],
                            ['border', /border:\s*var\(--sel-outline-w\)\s+solid\s+var\(--sel-color\)/],
                            ['box-sizing', /box-sizing:\s*border-box/],
                            ['pointer-events', /pointer-events:\s*none/]]) {
    assert.match(icb, re, `아이콘 서클 링에서 ${prop} 가 바뀌었다 — 원 도형이 베낀 전제가 사라졌다`);
    assert.match(ell, re, `원 도형 링의 ${prop} 가 아이콘 서클과 다르다`);
  }
  assert.match(ell, /position:\s*absolute/, '링이 absolute 가 아니면 inset:0 이 안 먹는다');
  assert.match(ell, /inset:\s*0/, '링이 상자와 같은 자리가 아니다');
  // ★z-index — .shape-svg(z-index:1) «위»여야 SVG 가 링을 덮지 않는다(아이콘 서클이 겪은 바로 그 병)
  const z = /z-index:\s*(\d+)/.exec(ell);
  assert.ok(z && Number(z[1]) >= 2, `링의 z-index 가 .shape-svg(1) 위가 아니다: ${z && z[1]}`);
});

test('U-CIRCLE-12 ★사정거리 — 링은 «원»에만, 사각/별/다각형은 네모 그대로', () => {
  // 링 규칙의 선택자가 ellipse 한정인지(타입 없는 .shape-block.selected::before 가 있으면 전 도형에 링이 생긴다)
  assert.ok(!/\.shape-block\.selected::before/.test(CSS),
    '★타입 한정 없는 도형 링 규칙이 있다 — 사각형·별에도 원 링이 그려진다(T-028 위반)');
  for (const t of ['rectangle', 'polygon', 'star', 'line', 'arrow']) {
    assert.ok(!CSS.includes(`.shape-block.selected[data-shape-type="${t}"]::before`),
      `${t} 에도 링 규칙이 생겼다 — 사정거리 밖`);
  }
  // 도형 일반의 폴백 오프셋은 종전 그대로(−굵기), 그리고 «원 전용 예외»는 없어졌다
  const base = ruleOf('.shape-block.selected');
  assert.match(base, /outline-offset:\s*calc\(-1 \* var\(--sel-outline-w\)\)/,
    '도형 일반의 폴백 오프셋이 바뀌었다');
  assert.ok(!/\.shape-block\.selected\[data-shape-type="ellipse"\]\s*\{\s*outline-offset:\s*0;?\s*\}/.test(CSS),
    '★원 전용 outline-offset:0 예외가 남아 있다 — 이제 원도 다른 도형과 같은 자리다');
});

test('U-CIRCLE-13 ★오버레이면 링도 보라 — 토큰(--ui-sel-overlay)만 쓰고 리터럴을 안 쓴다', () => {
  const ov = ruleOf('.shape-block.selected[data-shape-type="ellipse"][data-sel-variant="sticker"]::before');
  assert.match(ov, /border-color:\s*var\(--ui-sel-overlay/,
    '★오버레이 원의 링이 토큰을 안 쓴다 — 테두리·핸들은 보라인데 링만 파랑이면 한 블록에 두 색이다');
  assert.ok(!/border-color:\s*#9966ff\s*;/.test(ov), '★리터럴 #9966ff 를 값으로 썼다 — 토큰만 쓴다');
});
