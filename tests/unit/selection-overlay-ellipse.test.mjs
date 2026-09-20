/* U-CIRCLE — 「원 도형이 파란 선택 아웃라인에 «잘려» 보인다」(현빈 2026-09-20, 0920b circle-clip / T-072)
 *   원문: 「원모양 쉐이프 블럭 추가했는데, 파란색 아웃라인에 원이 잘려보이는 문제가 있다.」
 *
 * ★증상의 정체 = «가려짐»이 아니라 «접선을 선이 덮는다».
 *   원은 자기 상자의 네 변에 «정확히 접한다»(block-factory.js:2065 ellipse rx=ry=50, 0918 이후 채움도형 기본
 *   stroke 0, shape-svg 는 preserveAspectRatio:none + width/height 100%). 선택 테두리는 그 상자 «안쪽»
 *   1.0~1.4 화면px 를 덮는 네모다(_snapLo/_snapHi — 「선은 상자 안」은 U-M63-1 이 잠가 놓은 규약).
 *   ⇒ 네 접점 부근이 선에 덮여 «평평해» 보인다. 사각형에서는 선이 제 채움 위에 얹혀 안 보이던 것이 원에서만 튄다.
 *
 * ★고침 = 현빈 결정 ㉮ — 「선택선은 모든 블럭에서 «네모» 유지, 어긋난 데만 수정」.
 *   ⛔둥근 선(SEL_FOLLOW_RADIUS)은 «안 켠다». 움직이는 것은 선의 «모양»이 아니라 «자리»다:
 *     원(과 그 래퍼)에 한해 스냅 방향을 뒤집어 선을 상자 «바로 바깥»에 둔다(_snapLoOut/_snapHiOut).
 *
 * ★실앱 실측(격리 9375 · dpr 2 · 신규 100px 원 · 고침 전 → 후)
 *     띠가 덮은 원 픽셀   40% 168 → 0 · 100% 270 → 0 · 150% 332 → 0 (device px)
 *     최장 가로 덮임런    40%  28 → 0 · 100%  46 → 0 · 150%  58 → 0
 *   그리고 계산과 맞는다 — 깊이 d 띠가 반지름 R 원에서 덮는 현 = 2√(2Rd − d²).
 *     40% · R=20 · d=1.38 ⇒ 14.4 CSS px ≈ 29 device px (실측 28).
 *
 * ★음성대조 = «고치기 전 경로 그 자체»다. outset 인자를 빼고 부르면 옛 계산이 «한 글자도 안 바뀐 채»
 *   그대로 돌아간다(기본값 false) ⇒ 같은 파일에서 「덮임 12~14px(빨강)」과 「0(초록)」을 나란히 잰다.
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
              'function _selOutsetOf(', 'export function subtractInterval('];
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
  const ctx = vm.createContext({ getComputedStyle: el => el.__cs, Math, JSON, Number, String, Object });
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
/** ★증상 지표 — 「원의 접선이 선에 덮인 길이」(CSS px, 왼쪽 세로변).
 *  깊이 d = 띠의 «안쪽 끝» − 상자 왼변. 원의 그 깊이에서의 현 2√(2Rd−d²) 과 «실제로 그려지는 구간»의 교집합. */
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
  const g = makeCtx(2)._geomOf(fixture(697, 117.1188, 737, 157.1187), '', 0.4, true);
  assert.equal(g.rot, false);
  assert.ok(Number.isFinite(g.T) && Number.isFinite(g.L), '_geomOf 가 축정렬 기하를 못 냈다');
});

/* ═════ 1. 증상과 음성대조 — 같은 소스, 인자 하나 차이 ═════════════════════════════ */
test('U-CIRCLE-1 [음성대조] 옛 경로(outset 없음)는 원을 12~14px 덮고, 새 경로는 0 이다', () => {
  const G = makeCtx(2);
  const el = fixture(697, 117.1187515258789, 737, 157.11874389648438);   // ★실앱 실측 자리(줌 40% · 100px 원)
  const before = G._geomOf(el, '', 0.4);                                  // ← 인자 생략 = 고치기 «전» 계산 그대로
  const after  = G._geomOf(el, '', 0.4, true);
  const covB = coveredChord(before, G._edgesOf(before));
  const covA = coveredChord(after,  G._edgesOf(after));
  assert.ok(covB > 12, `음성대조가 «안 빨갛다»(${covB}) — 이 검사가 아무것도 안 재고 있다는 뜻이다`);
  assert.ok(Math.abs(covB - 12.49) < 0.2, `옛 경로의 덮임이 12.49 가 아니다: ${covB} — 계산식이나 스냅이 바뀌었다`);
  assert.equal(covA, 0, `고친 경로가 여전히 원을 덮는다: ${covA}`);
});

test('U-CIRCLE-2 옵트인이면 네 띠가 «전부 상자 밖»이고, 나간 몫이 굵기+1/dpr 을 안 넘는다', () => {
  let n = 0;
  forGrid((g, k, zoom, label) => {
    const lim = g.sw + 1 / k + EPS;      // ★상수 상한 — 줌에 비례해 번지는 M63 과 «다른» 성질이다
    for (const [e, b] of Object.entries(bands(g))) {
      const inner = (e === 'top' || e === 'left') ? b.hi : b.lo;
      const outer = (e === 'top' || e === 'left') ? b.lo : b.hi;
      const box   = (e === 'top' || e === 'left') ? b.boxLo : b.boxHi;
      if (e === 'top' || e === 'left') {
        assert.ok(inner <= box + EPS, `${label} ${e}: 띠 안쪽끝 ${inner} 가 상자 ${box} 안 — 블럭을 문다`);
        assert.ok(box - outer <= lim, `${label} ${e}: 상자 밖으로 ${box - outer} — 상한 ${lim} 초과`);
      } else {
        assert.ok(inner >= box - EPS, `${label} ${e}: 띠 안쪽끝 ${inner} 가 상자 ${box} 안 — 블럭을 문다`);
        assert.ok(outer - box <= lim, `${label} ${e}: 상자 밖으로 ${outer - box} — 상한 ${lim} 초과`);
      }
      n++;
    }
  });
  assert.ok(n >= 4000, `표본이 너무 적다(${n}) — 격자가 줄었으면 검사가 헐거워진 것이다`);
});

test('U-CIRCLE-3 옵트인이어도 «완전히 칠해진 디바이스 행»은 그대로 하나 이상이다(M65 불변)', () => {
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

/* ═════ 2. 현빈 결정 ㉮ — «네모»가 유지되는가 ═══════════════════════════════════ */
test('U-CIRCLE-4 ★㉮ 유지 — 옵트인해도 경로는 «직선 4개·호 0개»다', () => {
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

test('U-CIRCLE-5 ★결정 불변 — 반경 18px 배너/모달은 옵트인 대상이 아니고, 여전히 네모 + 상자 «안»이다', () => {
  const G = makeCtx(2);
  const el = fixture(200.3, 300.7, 560.3, 480.7, '18px');
  assert.equal(G.SEL_FOLLOW_RADIUS, false, '전역 스위치가 켜졌다 — 2026-09-15 「모든 블럭 네모」 결정이 뒤집혔다');
  const g = G._geomOf(el, '', 1);                              // 배너는 outset 인자를 «안» 받는다
  const d = G._pathData({ g, edges: G._edgesOf(g) });
  assert.equal((d.match(/A/g) || []).length, 0, '반경 블럭에 호가 생겼다 — 결정 위반');
  for (const [e, b] of Object.entries(bands(g)))
    assert.ok(b.lo >= b.boxLo - EPS && b.hi <= b.boxHi + EPS, `${e}: 띠가 상자 밖 — 반경 블럭까지 선이 움직였다`);
});

test('U-CIRCLE-6 기본 경로는 «한 글자도» 안 바뀐다 — outset 이 거짓(=인자 생략)이면 띠가 상자 안이다(U-M63-1 과 같은 규약)', () => {
  let n = 0;
  forGrid((g, k, zoom, label) => {
    for (const [e, b] of Object.entries(bands(g))) {
      assert.ok(b.lo >= b.boxLo - EPS && b.hi <= b.boxHi + EPS,
        `${label} ${e}: 기본 경로인데 띠가 상자 밖 — outset 이 «전 블럭»에 샜다`);
      n++;
    }
  }, { outset: false });   // ★_geomOf 의 기본값이 false 라 «인자 생략»과 같은 경로다(U-CIRCLE-1 이 생략 호출로 교차확인)
  assert.ok(n >= 4000);
});

/* ═════ 3. 모퉁이 맞물림 — 바깥 선은 «꼭지까지» 이어진다 ═══════════════════════ */
test('U-CIRCLE-7 옵트인 직선 구간이 바깥 꼭지(L−h … R+h)까지 이어져 네 귀에 구멍이 없다', () => {
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

/* ═════ 4. 대상 판정 — «실측표»가 정한 범위 그대로인가 ═════════════════════════ */
test('U-CIRCLE-8 _selOutsetOf — 원(과 그 래퍼)만 참, 사각/별/다각/선은 거짓, dataset 이 우선', () => {
  const G = makeCtx(2);
  const host = (sel, kid = null, dataset = {}) => ({
    dataset,
    matches: s => s.split(',').some(one => one.trim() === sel),
    querySelector: s => (kid && s.includes(kid) ? {} : null),
  });
  const ELL = '.shape-block[data-shape-type="ellipse"]';
  assert.equal(G._selOutsetOf(host(ELL)), true, '원이 옵트인 안 된다 — 증상이 안 고쳐진다');
  assert.equal(G._selOutsetOf(host('.frame-block', ELL)), true, '래퍼 프레임이 빠졌다 — 남은 네모가 그대로 원을 문다');
  for (const t of ['rectangle', 'polygon', 'star', 'line', 'arrow']) {
    assert.equal(G._selOutsetOf(host(`.shape-block[data-shape-type="${t}"]`)), false,
      `${t} 까지 선이 움직였다 — 실측상 안 어긋나는 타입이다(사정거리 밖)`);
  }
  assert.equal(G._selOutsetOf(host('.text-block')), false, '글자 블럭까지 샜다');
  assert.equal(G._selOutsetOf(host(ELL, null, { selOutset: 'off' })), false, 'dataset 탈출구가 «안» 이긴다');
  assert.equal(G._selOutsetOf(host('.text-block', null, { selOutset: 'on' })), true, 'dataset 으로 켤 수 없다');
});

test('U-CIRCLE-9 회전한 원도 같은 «방향»으로 민다 — 회전판만 종전대로 물리면 안 된다', () => {
  const G = makeCtx(2);
  const rotFix = () => ({
    offsetWidth: 40, offsetHeight: 40,
    __cs: { borderTopLeftRadius: '0px', borderTopRightRadius: '0px', borderBottomRightRadius: '0px', borderBottomLeftRadius: '0px' },
    // 30° 회전한 40×40 상자의 네 꼭지점
    __c: { nw: { x: 100, y: 100 }, ne: { x: 134.641, y: 120 }, sw: { x: 80, y: 134.641 }, se: { x: 114.641, y: 154.641 } },
  });
  const inn = G._geomOf(rotFix(), '', 1);            // 기본 = 안쪽
  const out = G._geomOf(rotFix(), '', 1, true);      // 옵트인 = 바깥
  assert.equal(inn.rot, true); assert.equal(out.rot, true);
  const dist = g => Math.hypot(g.o.nw.x - 100, g.o.nw.y - 100);
  assert.ok(dist(inn) > 0.7 && dist(out) > 0.7, '회전판이 반굵기만큼 밀지 않는다');
  // 안쪽 판은 상자 «중심 쪽»으로, 바깥 판은 «반대»로 간다
  const cx = (100 + 114.641) / 2, cy = (100 + 154.641) / 2;
  const toCenter = p => Math.hypot(p.x - cx, p.y - cy);
  assert.ok(toCenter(inn.o.nw) < toCenter(out.o.nw),
    `회전한 원의 선이 바깥으로 안 갔다(inn ${toCenter(inn.o.nw)} / out ${toCenter(out.o.nw)})`);
  assert.ok(out.r.nw[0] === 0 && out.r.nw[1] === 0, `회전판에서 음수 인셋이 반경을 «키웠다» — 호가 생긴다: ${JSON.stringify(out.r.nw)}`);
});

/* ═════ 5. CSS 폴백이 같은 자리인가(오버레이가 꺼졌을 때) ═══════════════════════ */
test('U-CIRCLE-10 CSS 폴백 — 원만 outline-offset:0, 나머지 도형은 종전(−굵기) 그대로', () => {
  const rule = CSS.match(/\.shape-block\.selected\.selected\s*\{[^}]*\}|\.shape-block\.selected\s*\{[^}]*\}/);
  assert.ok(rule, '.shape-block.selected 규칙을 못 찾았다');
  assert.match(rule[0], /outline-offset:\s*calc\(-1 \* var\(--sel-outline-w\)\)/,
    '도형 일반의 폴백 오프셋이 바뀌었다 — 사정거리 밖(원만 고친다)');
  assert.match(CSS, /\.shape-block\.selected\[data-shape-type="ellipse"\]\s*\{\s*outline-offset:\s*0;\s*\}/,
    '원 전용 폴백(outline-offset:0)이 없다 — 오버레이가 꺼진 판에서 두 경로가 갈라진다');
});
