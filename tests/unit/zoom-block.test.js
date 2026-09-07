/* 단위 하네스 — 확대블럭(zoom-block)
 * 실행: node --test tests/unit/*.test.js tests/unit/*.test.mjs
 *
 * 두 갈래로 잰다.
 *   ⓐ 기하 — js/blocks/zoom-geometry.js 를 tmp `.mjs` 사본으로 «진짜 실행»한다
 *      (tests/unit/aifill-goya-asset.test.js 의 수법. 이 레포는 package.json 이
 *       "type":"commonjs" 라 js/**.js 를 node 가 그냥은 못 읽는다).
 *      ★그래서 기하를 zoom-block.js 에서 «떼어» zoom-geometry.js 로 뒀다 —
 *        모듈 최상단에 window 접근이 하나라도 있으면 그 import 가 ReferenceError 로 죽는다.
 *   ⓑ 배선 — 신규 블록 체크리스트 5곳 + 금지사항. 소스는 «반드시» _srcread.js 의 readSrc() 로
 *      읽고(CRLF 체크아웃에서 파일이 통째로 안 도는 것 방지), 주석은 stripComments() 로 «구문»으로
 *      거른 뒤에 센다.
 *      ★★거르개 자신에게도 대조를 붙였다(ⓑ-0) — 오늘 팀이 「금지 주석을 위반으로 세어」
 *        dev 를 빨갛게 만든 사고가 있었다. 거르개가 ①주석을 정말 지우는지 ②코드는 안 지우는지
 *        (특히 문자열 안의 `http://...` 를 «//주석»으로 오인해 잘라먹지 않는지) 둘 다 잰다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { readSrc } = require('./_srcread.js');
const { mkTmpRoot } = require('./_tmproot.js');

const ROOT = path.resolve(__dirname, '../..');

/* ── 주석 거르개 — «구문»으로 거른다 ─────────────────────────────────────────
 *  · /* … *\/ 블록은 줄을 넘어가도 상태를 들고 지운다(이 레포 주석은 이어지는 줄이
 *    `*` 로 시작하지 않는 경우가 흔해서, 「`*` 로 시작하는 줄만 버리기」로는 새어나간다).
 *  · // 는 «줄 맨 앞» 것만 지운다. 줄 중간까지 지우면 문자열 안의
 *    'http://www.w3.org/2000/svg' 를 잘라먹어 «코드가 사라진다»(= 검사가 조용히 눈멀음).
 * ───────────────────────────────────────────────────────────────────────── */
function stripComments(src) {
  const out = [];
  let inBlock = false;
  for (const line of String(src).split('\n')) {
    let l = line;
    if (inBlock) {
      const e = l.indexOf('*/');
      if (e < 0) { out.push(''); continue; }
      l = l.slice(e + 2); inBlock = false;
    }
    for (;;) {
      const b = l.indexOf('/*');
      if (b < 0) break;
      const e = l.indexOf('*/', b + 2);
      if (e < 0) { l = l.slice(0, b); inBlock = true; break; }
      l = l.slice(0, b) + l.slice(e + 2);
    }
    if (l.trim().startsWith('//')) l = '';
    out.push(l);
  }
  return out.join('\n');
}

const RAW = {
  geom:   readSrc(ROOT, 'js', 'blocks', 'zoom-geometry.js'),
  block:  readSrc(ROOT, 'js', 'blocks', 'zoom-block.js'),
  prop:   readSrc(ROOT, 'js', 'props', 'prop-zoom.js'),
  editor: readSrc(ROOT, 'js', 'editor.js'),
  layer:  readSrc(ROOT, 'js', 'panels', 'layer-panel-items.js'),
  drag:   readSrc(ROOT, 'js', 'block-drag.js'),
  css:    readSrc(ROOT, 'css', 'editor-blocks.css'),
  html:   readSrc(ROOT, 'index.html'),
  save:   readSrc(ROOT, 'js', 'io', 'save-load.js'),
  handles: readSrc(ROOT, 'js', 'overlay-handles.js'),
  overlay: readSrc(ROOT, 'js', 'selection-overlay.js'),
};
const SRC = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, stripComments(v)]));

/* ── ⓑ-0 거르개 자신의 대조 ────────────────────────────────────────────────── */
test('ⓑ-0-1 거르개는 주석을 «정말» 지운다 (금지어가 주석에만 있는 자리로 잰다)', () => {
  assert.ok(RAW.geom.includes('linearGradient'), '전제: zoom-geometry.js 주석에 금지어 설명이 있다');
  assert.equal(SRC.geom.includes('linearGradient'), false, '거른 뒤엔 그 주석이 남으면 안 된다');
});

test('ⓑ-0-2 거르개는 «코드»는 안 지운다 — 문자열 안의 `//` 를 주석으로 오인하지 않는다', () => {
  assert.ok(RAW.geom.includes('http://www.w3.org/2000/svg'), '전제: xmlns 문자열이 소스에 있다');
  assert.ok(SRC.geom.includes('http://www.w3.org/2000/svg'),
    '줄 중간의 // 까지 자르면 이 줄이 사라진다 = 아래 금지검사들이 조용히 눈먼다');
  assert.ok(SRC.block.includes('function renderZoomBlock'), '함수 정의는 남아야 한다');
  assert.ok(SRC.geom.includes('export function silhouette'), '기하 함수 정의는 남아야 한다');
});

/* ── ⓐ 기하 — 진짜 실행 ────────────────────────────────────────────────────── */
const SRC_MOD = path.resolve(ROOT, 'js/blocks/zoom-geometry.js');
let _modP = null;
function loadGeom() {
  if (!_modP) {
    const dir = mkTmpRoot('zoom-geom-');
    const mjs = path.join(dir, 'zoom-geometry.mjs');
    fs.copyFileSync(SRC_MOD, mjs);
    _modP = import(pathToFileURL(mjs).href);
  }
  return _modP;
}

const ST = {
  shape: 'rect', angle: 0, length: 170, spread: 0,
  maxop: 30, curve: 100, narrow: 62, size: 160, rot: 0,
  fill: '#cfd6e0', shadow: 'on', bd: 'off', bdw: 6, bdc: '#ffffff', bdr: 0,
  w: null, h: null,
};
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

test('ⓐ-1 rect 실루엣은 «광원을 마주보는 두 꼭짓점»이다 (+양성대조: 무한광원 근사는 다르게 답한다)', async () => {
  const g = await loadGeom();
  const L = g.lightPoint(0, 170, 0, 0);
  const [A, B] = g.silhouette('rect', 80, 0, L, 0, 0);
  // r=80, ZOOM_RECT_RATIO=0.625 → 꼭짓점 (±80, ±50). 광원은 (170,0).
  const got = [A, B].map(p => `${p.x},${p.y}`).sort();
  assert.deepEqual(got, ['80,-50', '80,50'].sort());

  // ★양성대조 — 「축에 수직인 극점」(광원이 «무한히 멀 때»만 맞는 근사)로 골랐다면
  //   각도 기준을 도형 중심에 두게 된다. 그 산식이 «같은 답을 내지 않음»을 보여야
  //   이 검사가 「아무 두 점이나 통과시키는 것」이 아님이 증명된다.
  const ps = g.shapePts('rect', 80, 0, 0, 0);
  const perp = ps.slice().sort((p, q) => Math.abs(q.y) - Math.abs(p.y)).slice(0, 2);
  const perpKeys = perp.map(p => `${p.x},${p.y}`).sort();
  assert.notDeepEqual(perpKeys, got, '두 방식이 같은 답이면 이 검사는 아무것도 못 가른다');
});

test('ⓐ-1b ★가까운 광원에서 실루엣은 «지지선» 조건을 만족한다 (무한광원 근사는 여기서 어긋난다)', async () => {
  const g = await loadGeom();
  // ★angle=20·length=170(기본 길이) — 실측으로 「두 산식이 갈리는」 자리를 골랐다.
  //   ⓐ-1 의 angle=0 은 도형이 광원 축에 대칭이라 «틀린 산식도 같은 답»을 낸다(변이 M2 가 안 걸렸다).
  const L = g.lightPoint(20, 170, 0, 0);
  const [A, B] = g.silhouette('rect', 80, 0, L, 0, 0);
  const ps = g.shapePts('rect', 80, 0, 0, 0);

  // 지지선 조건: L–P 를 지나는 직선의 «한쪽»에 도형 전체가 있어야 한다.
  const sideOk = (P) => {
    const ux = P.x - L.x, uy = P.y - L.y;
    const cr = ps.map(q => ux * (q.y - L.y) - uy * (q.x - L.x));
    return cr.every(c => c >= -1e-6) || cr.every(c => c <= 1e-6);
  };
  assert.ok(sideOk(A), 'A 가 지지선이 아니다 — 그 점은 실루엣이 아니다');
  assert.ok(sideOk(B), 'B 가 지지선이 아니다 — 그 점은 실루엣이 아니다');

  // 구체값 고정 — 「축에 수직인 극점 / 무한광원 근사」는 여기서 (80,50) 을 고른다.
  const got = [A, B].map(p => `${p.x},${p.y}`).sort();
  assert.deepEqual(got, ['-80,50', '80,-50'].sort());
});

test('ⓐ-2 circle 실루엣은 «접점»이다 — |CA|=r 이고 LA ⊥ CA', async () => {
  const g = await loadGeom();
  const L = g.lightPoint(0, 200, 0, 0);
  const [A, B] = g.silhouette('circle', 80, 0, L, 0, 0);
  for (const P of [A, B]) {
    assert.ok(Math.abs(Math.hypot(P.x, P.y) - 80) < 1e-9, '접점은 원 위에 있다');
    const dot = (P.x - L.x) * (P.x - 0) + (P.y - L.y) * (P.y - 0);
    assert.ok(Math.abs(dot) < 1e-9, `접선 성질 위반: dot=${dot}`);
  }
  assert.ok(dist(A, B) > 1, '두 접점이 겹치면 안 된다');
});

test('ⓐ-3 광원이 도형 안이면 circle 은 «퇴화»를 명시적으로 돌려준다(NaN 아님)', async () => {
  const g = await loadGeom();
  const L = g.lightPoint(0, 10, 0, 0);
  const [A, B] = g.silhouette('circle', 80, 0, L, 0, 0);
  assert.deepEqual(A, { x: 0, y: 0 });
  assert.deepEqual(B, { x: 0, y: 0 });
});

test('ⓐ-4 띠: A·B 쪽이 최대농도, a·b 쪽이 0, 그 사이는 단조감소', async () => {
  const g = await loadGeom();
  const geo = g.computeZoomGeometry(ST, null);
  const html = g.strips(geo.A, geo.B, geo.a, geo.b, 64, 1.0, 0.3);
  const ops = [...html.matchAll(/fill-opacity="([\d.]+)"/g)].map(m => parseFloat(m[1]));
  assert.equal(ops.length, 64);
  assert.ok(Math.abs(ops[0] - 0.3 * (1 - 0.5 / 64)) < 1e-4, `첫 띠 농도=${ops[0]}`);
  assert.ok(ops[63] < 0.005, `마지막 띠는 거의 투명이어야: ${ops[63]}`);
  for (let i = 1; i < ops.length; i++) assert.ok(ops[i] < ops[i - 1], `단조감소 위반 @${i}`);
});

test('ⓐ-5 ★비대칭 a·b 에서도 «윗변 전체가 한 농도»다 (선형 그라데이션이면 갈린다 — 대조로 잰다)', async () => {
  const g = await loadGeom();
  const geo = g.computeZoomGeometry(ST, null);
  const A = geo.A, B = geo.B;
  // a 는 광원 근처, b 는 «훨씬 멀리» — 축 방향 거리가 크게 다른 «그 상황»을 만든다.
  const a = { x: 170, y: 19 };
  const b = { x: 420, y: -60 };
  const PW = 1.0, MAXOP = 0.3;

  const html = g.strips(A, B, a, b, 40, PW, MAXOP);
  const polys = [...html.matchAll(/points="([^"]+)" fill="#000" fill-opacity="([\d.]+)"/g)];
  assert.equal(polys.length, 40);
  const last = polys[polys.length - 1];
  const pts = last[1].split(' ').map(s => s.split(',').map(Number));
  // 마지막 띠의 t1=1 쪽 두 점이 곧 a 와 b 다 — «한 폴리곤 = 한 농도» 라 둘이 갈릴 수가 없다.
  const has = (p) => pts.some(q => Math.abs(q[0] - p.x) < 0.01 && Math.abs(q[1] - p.y) < 0.01);
  assert.ok(has(a) && has(b), 'a·b 가 같은(마지막) 띠의 두 끝이어야 한다');
  assert.ok(parseFloat(last[2]) < 0.005, '그 띠의 농도는 0 에 가깝다');

  // ★대조 — 「축에 수직인 등농도선」(=linearGradient) 모델로 재면 a 와 b 의 농도가 «갈린다».
  const mAB = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const mab = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const ax = mab.x - mAB.x, ay = mab.y - mAB.y, alen = Math.hypot(ax, ay);
  const linOp = (p) => {
    const s = ((p.x - mAB.x) * ax + (p.y - mAB.y) * ay) / (alen * alen);
    return Math.pow(1 - Math.min(1, Math.max(0, s)), PW) * MAXOP;
  };
  const gap = Math.abs(linOp(a) - linOp(b));
  assert.ok(gap > 0.02, `선형 모델이 안 갈리면 이 대조가 무의미하다: gap=${gap}`);
});

test('ⓐ-6 spread 는 A·B 를 «그만큼» 벌린다', async () => {
  const g = await loadGeom();
  const base = g.computeZoomGeometry({ ...ST, spread: 0 }, null);
  const wide = g.computeZoomGeometry({ ...ST, spread: 60 }, null);
  assert.ok(Math.abs((dist(wide.A, wide.B) - dist(base.A, base.B)) - 60) < 1e-9);
});

test('ⓐ-7 narrow 는 «광원 위에 중심을 둔» 짧은 변을 만든다 (|ab| = |AB|·k)', async () => {
  const g = await loadGeom();
  const geo = g.computeZoomGeometry({ ...ST, narrow: 62 }, null);
  const k = 1 - 62 / 100;
  assert.ok(Math.abs(dist(geo.a, geo.b) - dist(geo.A, geo.B) * k) < 1e-9);
  const mid = { x: (geo.a.x + geo.b.x) / 2, y: (geo.a.y + geo.b.y) / 2 };
  assert.ok(dist(mid, geo.L) < 1e-9, '짧은 변의 중점은 광원이다');
});

test('ⓐ-8 rot 은 실루엣을 «실제로» 바꾼다 (square 45°)', async () => {
  const g = await loadGeom();
  const L = g.lightPoint(0, 300, 0, 0);
  const s0 = g.silhouette('square', 80, 0, L, 0, 0);
  const s45 = g.silhouette('square', 80, 45, L, 0, 0);
  assert.ok(dist(s0[0], s45[0]) > 1 || dist(s0[1], s45[1]) > 1);
});

test('ⓐ-9 ★a·b 는 «언제나 자동»으로 방향을 따라간다 — 끈 뒤에만 안 따라간다', async () => {
  const g = await loadGeom();
  const at0  = g.computeZoomGeometry({ ...ST, angle: 0 },  null);
  const at90 = g.computeZoomGeometry({ ...ST, angle: 90 }, null);
  assert.ok(dist(at0.a, at90.a) > 1, '자동인데 방향을 바꿔도 안 움직이면 광원과 그림자가 따로 논다');

  const pin = { a: { x: 11, y: 22 }, b: { x: 33, y: 44 } };
  const p0  = g.computeZoomGeometry({ ...ST, angle: 0 },  pin);
  const p90 = g.computeZoomGeometry({ ...ST, angle: 90 }, pin);
  assert.deepEqual(p0.a, pin.a);
  assert.deepEqual(p90.a, pin.a);
  assert.deepEqual(p90.b, pin.b);
  // 자동값은 그래도 같이 돌려준다 — 「자동으로 되돌리기」가 계산을 다시 안 해도 되게.
  assert.ok(dist(p0.autoA, p90.autoA) > 1);
});

test('ⓐ-10 ★마크업 실측 — buildZoomInner 가 실제로 내보내는 것을 «파싱해서» 잰다', async () => {
  const g = await loadGeom();
  const html = g.buildZoomInner({ ...ST, fill: '#cfd6e0' }, null);

  assert.equal(html.includes('NaN'), false, 'NaN 이 한 글자라도 새면 SVG 가 통째로 안 그려진다');
  assert.equal(html.includes('linearGradient'), false, '내보내는 마크업에도 선형이 없어야 한다');
  assert.equal((html.match(/<svg\b/g) || []).length, 2, 'SVG 는 둘 — 본체 + a·b 핸들 층');
  assert.equal((html.match(/<polygon[^>]*fill="#000"/g) || []).length, 64, '띠 64장');
  assert.equal((html.match(/class="zoom-shape"/g) || []).length, 1, '도형은 하나');
  assert.equal((html.match(/class="zoom-handle"/g) || []).length, 2, 'a·b 핸들 둘');
  // ⛔플로팅으로 옮기면서 «보조 선택상자»는 없어졌다 — 블록 자신이 그 상자다
  assert.equal(/zoom-sel-box|zoom-stage/.test(html), false, '보조 상자가 되살아났다');

  assert.ok(html.indexOf('zoom-shadow') < html.indexOf('zoom-shape'), '도형이 그림자 «뒤»면 사다리꼴이 도형을 덮는다');
  assert.ok(html.indexOf('zoom-shape') < html.indexOf('zoom-handle-layer'), '핸들은 도형 뒤에');

  const geo = g.computeZoomGeometry(ST, null);
  const ha = html.match(/data-pt="a" cx="([-\d.]+)" cy="([-\d.]+)"/);
  assert.ok(ha);
  assert.ok(Math.abs(parseFloat(ha[1]) - geo.a.x) < 0.01 && Math.abs(parseFloat(ha[2]) - geo.a.y) < 0.01);
  const vbs = [...html.matchAll(/viewBox="([^"]+)"/g)].map(m => m[1]);
  assert.equal(vbs.length, 2);
  assert.equal(vbs[0], vbs[1], '두 층의 viewBox 가 다르면 핸들이 엉뚱한 자리에 뜬다');
  // 두 층은 블록 안에서 «같은 자리»에 놓여야 좌표가 맞는다
  const lefts = [...html.matchAll(/style="left:([-\d.]+)px;top:([-\d.]+)px;"/g)].map(m => m[1] + ',' + m[2]);
  assert.equal(lefts.length, 2);
  assert.equal(lefts[0], lefts[1]);
});

test('ⓐ-11 뷰박스가 도형·그림자·광원을 «전부» 담는다 (잘리면 화면에서 사다리꼴 끝이 사라진다)', async () => {
  const g = await loadGeom();
  for (const st of [ST, { ...ST, shape: 'circle' }, { ...ST, shape: 'square', angle: 135, length: 400, spread: 90 }]) {
    const svg = g.buildZoomSvg(st, null);
    const vb = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/).slice(1).map(Number);
    const [x, y, w, h] = vb;
    const geo = g.computeZoomGeometry(st, null);
    const must = [geo.A, geo.B, geo.a, geo.b, geo.L, ...g.outerExtentPts(st)];
    for (const p of must) {
      assert.ok(p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h,
        `${st.shape}/${st.angle}: (${p.x.toFixed(1)},${p.y.toFixed(1)}) 가 뷰박스 밖`);
    }
    // width/height 는 뷰박스와 «같은 단위 수»여야 캔버스 100% 에서 1:1 로 보인다.
    const wa = parseFloat(svg.match(/width="([\d.]+)"/)[1]);
    assert.ok(Math.abs(wa - w) < 0.01);
  }
});

test('ⓐ-12 색은 «걸러서» 마크업에 들어간다 (색 자리로 태그가 못 들어온다)', async () => {
  const g = await loadGeom();
  const svg = g.buildZoomSvg({ ...ST, fill: '"/><script>x()</script><rect fill="red' }, null);
  assert.equal(svg.includes('<script'), false, '색 문자열로 태그가 끼어들었다');
  assert.ok(svg.includes('fill="#cfd6e0"'), 'fallback 색으로 떨어져야 한다');
  // 대조 — 정상 색은 그대로 통과한다(거르개가 «전부» 막아버리면 색 기능이 죽는다)
  assert.ok(g.buildZoomSvg({ ...ST, fill: 'rgba(10, 20, 30, 0.5)' }, null).includes('rgba(10, 20, 30, 0.5)'));
});

test('ⓐ-13 퇴화(광원이 도형 안)여도 «도형은» 그려지고 NaN 이 안 샌다', async () => {
  const g = await loadGeom();
  const svg = g.buildZoomSvg({ ...ST, shape: 'circle', length: 5 }, null);
  assert.equal(svg.includes('NaN'), false);
  assert.equal((svg.match(/class="zoom-shape"/g) || []).length, 1);
  assert.equal((svg.match(/<polygon[^>]*fill="#000"/g) || []).length, 0, '퇴화면 그림자는 접는다');
});

/* ── ⓐ 그림자 라디오 · 테두리 (현빈 2026-09-08 정정) ────────────────────────
 * 이 둘이 「스티커 블록 둘 → 확대블럭 하나」의 근거다.
 *   끔 = 도형 + 테두리(에셋블럭 스티커) · 켬 = 도형 + 그림자(돋보기)
 * ───────────────────────────────────────────────────────────────────────── */
test("ⓐ-14 ★shadow:'off' 면 그림자 폴리곤이 «0개»다 (투명도 0 이 아니라 «안 그린다»)", async () => {
  const g = await loadGeom();
  const off = g.buildZoomSvg({ ...ST, shadow: 'off' }, null);
  assert.equal((off.match(/<polygon[^>]*fill="#000"/g) || []).length, 0, '띠가 남아 있으면 DOM 만 무거워진다');
  assert.equal(off.includes('fill-opacity="0.0000"'), false, '투명도 0 으로 «두는» 것도 안 된다');
  assert.equal((off.match(/class="zoom-shape"/g) || []).length, 1, '도형은 그대로 있어야 한다');
  assert.equal((off.match(/class="zoom-handle"/g) || []).length, 0, '그림자가 없으면 a·b 핸들도 뜻이 없다');

  // 대조 — 같은 st 에서 켜면 돌아온다
  const on = g.buildZoomSvg({ ...ST, shadow: 'on' }, null);
  assert.equal((on.match(/<polygon[^>]*fill="#000"/g) || []).length, 64);
});

test("ⓐ-15 ★off→on 왕복에 그림자 값이 «그대로» 돌아온다 (조립기가 st 를 안 건드린다)", async () => {
  const g = await loadGeom();
  const on1 = g.buildZoomSvg({ ...ST, shadow: 'on' }, null);
  g.buildZoomSvg({ ...ST, shadow: 'off' }, null);          // 껐다가
  const on2 = g.buildZoomSvg({ ...ST, shadow: 'on' }, null); // 다시 켠다
  assert.equal(on2, on1, '왕복 후 그림이 달라지면 어딘가에서 값이 샜다');

  // ★더 세게 — 얼린 st 로 불러도 던지지 않아야 한다(= 조립기가 상태를 쓰지 않는다)
  const frozen = Object.freeze({ ...ST, shadow: 'off' });
  assert.doesNotThrow(() => g.buildZoomSvg(frozen, null));
  assert.equal(frozen.angle, ST.angle);
  assert.equal(frozen.length, ST.length);
});

test('ⓐ-16 ★테두리는 도형 «바깥»에 그린다 — 도형 크기가 안 줄어든다', async () => {
  const g = await loadGeom();
  const plain  = g.buildZoomSvg({ ...ST, bd: 'off' }, null);
  const bd     = g.buildZoomSvg({ ...ST, bd: 'on', bdw: 6 }, null);

  const shapeOf = (svg) => svg.match(/<rect class="zoom-shape"[^>]*>/)[0];
  assert.equal(shapeOf(bd), shapeOf(plain), '★테두리를 켰다고 도형 마크업이 바뀌면 «안쪽»으로 먹은 것이다');

  const bdEl = bd.match(/<rect class="zoom-border"[^>]*>/)[0];
  const num = (el, a) => parseFloat(el.match(new RegExp(a + '="([-\\d.]+)"'))[1]);
  assert.equal(num(bdEl, 'width'),  num(shapeOf(bd), 'width') + 12,  '두께 6 이면 좌우로 6 씩 = +12');
  assert.equal(num(bdEl, 'height'), num(shapeOf(bd), 'height') + 12);
  assert.ok(bd.indexOf('zoom-border') < bd.indexOf('zoom-shape'), '테두리판은 도형 «뒤»에 깔려야 한다');
  assert.equal((plain.match(/zoom-border/g) || []).length, 0, "bd:'off' 면 테두리는 아예 없다");
});

test('ⓐ-16b 모서리(bdr)를 주면 링 두께가 어디서나 같다 (바깥 rx = 안쪽 rx + 두께)', async () => {
  const g = await loadGeom();
  const svg = g.buildZoomSvg({ ...ST, bd: 'on', bdw: 6, bdr: 12 }, null);
  const rx = (cls) => parseFloat(svg.match(new RegExp('<rect class="' + cls + '"[^>]*rx="([\\d.]+)"'))[1]);
  assert.equal(rx('zoom-shape'), 12);
  assert.equal(rx('zoom-border'), 18);
});

test('ⓐ-17 뷰박스가 «테두리까지» 담는다 (안 담으면 링이 잘린다)', async () => {
  const g = await loadGeom();
  /* ★기대값을 outerExtentPts 로 만들면 «계측이 자기 자신을 잰다» — 그 함수를 망가뜨리는 변이(M16)가
     코드와 기대를 «같이» 줄여서 초록으로 통과했다(실제로 그랬다). ⇒ 여기서 직접 계산한다. */
  assert.equal(g.ZOOM_RECT_RATIO, 0.625, '비율이 바뀌면 아래 기대식도 같이 고쳐야 한다');
  const expectPts = (st) => {
    const half = st.size / 2;
    const bw = (st.bd === 'on') ? st.bdw : 0;
    if (st.shape === 'circle') { const R = half + bw; return [{ x: -R, y: -R }, { x: R, y: R }]; }
    const hw = half + bw;
    const hh = (st.shape === 'rect' ? half * 0.625 : half) + bw;
    const th = (st.rot || 0) * Math.PI / 180, co = Math.cos(th), si = Math.sin(th);
    return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]
      .map(p => ({ x: p[0] * co - p[1] * si, y: p[0] * si + p[1] * co }));
  };
  const cases = [
    { ...ST, bd: 'on', bdw: 24 },
    { ...ST, shape: 'circle', bd: 'on', bdw: 24 },
    { ...ST, shape: 'square', rot: 30, bd: 'on', bdw: 24, shadow: 'off' },
  ];
  for (const st of cases) {
    const svg = g.buildZoomSvg(st, null);
    const [x, y, w, h] = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/).slice(1).map(Number);
    for (const p of expectPts(st)) {
      assert.ok(p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h,
        `${st.shape}: 테두리 꼭짓점 (${p.x.toFixed(1)},${p.y.toFixed(1)}) 가 뷰박스 [${x.toFixed(1)},${(x + w).toFixed(1)}]×[${y.toFixed(1)},${(y + h).toFixed(1)}] 밖`);
    }
    // 대조 — 테두리를 끄면 상자가 «실제로» 줄어든다(그래야 위 통과가 「그냥 커서」가 아님이 증명된다)
    const noBd = g.buildZoomSvg({ ...st, bd: 'off' }, null);
    const w0 = parseFloat(noBd.match(/viewBox="[-\d.]+ [-\d.]+ ([-\d.]+)/)[1]);
    assert.ok(w0 < w, '테두리 유무로 뷰박스가 안 달라지면 이 검사는 아무것도 못 가른다');
  }
});

test('ⓐ-18 그림자와 테두리는 «배타가 아니다» — 둘 다 켤 수 있다', async () => {
  const g = await loadGeom();
  const both = g.buildZoomSvg({ ...ST, shadow: 'on', bd: 'on' }, null);
  assert.equal((both.match(/<polygon[^>]*fill="#000"/g) || []).length, 64);
  assert.equal((both.match(/zoom-border/g) || []).length, 1);
});

test('ⓐ-19 ★그림자는 «테두리 바깥» 윤곽에서 시작한다 — bdw 를 키우면 같이 나간다', async () => {
  const g = await loadGeom();
  const base = { ...ST, angle: 0, length: 400, bd: 'on' };
  // 기대값은 «검사 안에서» 독립 계산한다 — 대상 함수로 만들면 같이 틀려서 영원히 초록이다(M16 교훈).
  for (const bdw of [0, 6, 24]) {
    const geo = g.computeZoomGeometry({ ...base, bdw }, null);
    assert.ok(Math.abs(geo.A.x - (80 + bdw)) < 1e-9, `bdw=${bdw}: A.x=${geo.A.x}, 기대 ${80 + bdw}`);
    // ★세로도 «두께만큼» 늘어야 한다. 반지름만 키우면 rect 세로가 (r+두께)·0.625 로 «두께가 줄어든다».
    assert.ok(Math.abs(Math.abs(geo.A.y) - (50 + bdw)) < 1e-9, `bdw=${bdw}: |A.y|=${geo.A.y}, 기대 ${50 + bdw}`);
  }
  // 원은 반지름이 그대로 커진다
  const c = g.computeZoomGeometry({ ...base, shape: 'circle', bdw: 24 }, null);
  assert.ok(Math.abs(Math.hypot(c.A.x, c.A.y) - 104) < 1e-9, `circle |A|=${Math.hypot(c.A.x, c.A.y)}`);
});

test("ⓐ-19b ⛔bd:'off' 면 bdw 가 커도 «도형» 실루엣 그대로다 (대조 — 게이트가 살아 있나)", async () => {
  const g = await loadGeom();
  const off = g.computeZoomGeometry({ ...ST, angle: 0, length: 400, bd: 'off', bdw: 24 }, null);
  assert.ok(Math.abs(off.A.x - 80) < 1e-9, `테두리를 껐는데 그림자가 나갔다: A.x=${off.A.x}`);
  assert.ok(Math.abs(Math.abs(off.A.y) - 50) < 1e-9);
  // 대조 — 같은 bdw 로 켜면 «실제로» 달라진다(안 달라지면 위 검사가 아무것도 못 가른다)
  const on = g.computeZoomGeometry({ ...ST, angle: 0, length: 400, bd: 'on', bdw: 24 }, null);
  assert.ok(Math.abs(on.A.x - off.A.x) > 1, '켬/끔이 같은 답이면 이 대조가 무의미하다');
});

test('ⓐ-19c [리팩터 대조] silhouette 을 쪼갠 뒤에도 «같은 답»이다', async () => {
  const g = await loadGeom();
  // shapeCornerPts(st,0) 은 shapePts(kind, size/2, rot) 와 «같은 점»이어야 한다 — 산식이 갈리면 여기서 잡힌다.
  for (const shape of ['rect', 'square']) {
    for (const rot of [0, 30]) {
      const st = { ...ST, shape, rot };
      assert.deepEqual(g.shapeCornerPts(st, 0), g.shapePts(shape, st.size / 2, rot, 0, 0), `${shape}/${rot}`);
    }
  }
  // 쪼갠 알맹이와 겉함수가 같은 답
  const L = g.lightPoint(20, 170, 0, 0);
  assert.deepEqual(g.silhouette('rect', 80, 0, L, 0, 0), g.silhouetteFromPts(g.shapePts('rect', 80, 0, 0, 0), L, 0, 0));
  assert.deepEqual(g.silhouette('circle', 80, 0, L, 0, 0), g.silhouetteCircle(80, L, 0, 0));
});

test('ⓐ-20 ★블록 «자신»이 도형 상자다 — 원이면 원, 테두리 켜면 테두리 바깥', async () => {
  const g = await loadGeom();
  /* 기대값은 검사 «안에서» 독립 계산한다(M16 교훈 — 대상 함수로 만들면 같이 틀린다). */
  const expect = (st) => {
    const half = st.size / 2, bw = (st.bd === 'on') ? st.bdw : 0;
    const circle = st.shape === 'circle';
    const hh = (circle ? half : (st.shape === 'rect' ? half * 0.625 : half)) + bw;
    return { w: (half + bw) * 2, h: hh * 2,
             radius: circle ? '50%' : (((st.bdr || 0) > 0 ? st.bdr + bw : 0).toFixed(2) + 'px') };
  };
  for (const st of [
    { ...ST, shape: 'rect' }, { ...ST, shape: 'circle' }, { ...ST, shape: 'square', rot: 30 },
    { ...ST, shape: 'rect', bd: 'on', bdw: 6, bdr: 12 }, { ...ST, shape: 'circle', bd: 'on', bdw: 24 },
  ]) {
    const box = g.blockBoxSpec(st);
    const e = expect(st);
    assert.equal(box.w, e.w, `${st.shape}: 폭`);
    assert.equal(box.h, e.h, `${st.shape}: 높이`);
    assert.equal(box.radius, e.radius, `${st.shape}: 모서리`);
  }
  assert.notEqual(g.blockBoxSpec({ ...ST, shape: 'circle' }).radius,
                  g.blockBoxSpec({ ...ST, shape: 'rect' }).radius);
  // 원은 돌려도 같은 모양 → 회전을 안 붙인다
  assert.equal(g.blockBoxSpec({ ...ST, shape: 'circle', rot: 30 }).rot, 0);
  assert.equal(g.blockBoxSpec({ ...ST, shape: 'square', rot: 30 }).rot, 30);
});

test('ⓐ-20b ★SVG 오프셋 — 도형 중심이 «블록 중심»에 정확히 앉는다', async () => {
  const g = await loadGeom();
  for (const st of [ST, { ...ST, shape: 'circle' }, { ...ST, bd: 'on', bdw: 24 }, { ...ST, angle: 90, length: 300 }]) {
    const off = g.svgOffset(st, null);
    const box = g.zoomBox(st, null);
    const b = g.blockBoxSpec(st);
    // 뷰박스 (0,0) = 도형 중심. 그 점의 블록 내 픽셀 좌표 = off + (-minX, -minY)
    assert.ok(Math.abs((off.left - box.minX) - b.w / 2) < 1e-9, `${st.shape}: 가로 중심 어긋남`);
    assert.ok(Math.abs((off.top - box.minY) - b.h / 2) < 1e-9, `${st.shape}: 세로 중심 어긋남`);
    // 그림자가 있으면 SVG 는 블록 «밖»으로 나간다(플로팅이라 아무것도 안 밀린다)
    if (st.shadow !== 'off') assert.ok(off.left < 0 || off.top < 0);
  }
});

test('ⓐ-21 ④체크패턴 — 기본 배경은 무늬고, 그때 도형은 «안 칠한다»', async () => {
  const g = await loadGeom();
  const chk = g.buildZoomInner({ ...ST, fill: g.ZOOM_CHECKER }, null);
  assert.match(chk, /class="zoom-bg"/, '체크 층이 없다');
  assert.match(chk, /<rect class="zoom-shape"[^>]*fill="none"/, '무늬 위에 색을 덧칠하면 체크가 안 보인다');
  const col = g.buildZoomInner({ ...ST, fill: '#cfd6e0' }, null);
  assert.equal(/class="zoom-bg"/.test(col), false);
  assert.match(col, /<rect class="zoom-shape"[^>]*fill="#cfd6e0"/);

  /* 무늬 상자 = «도형» 상자(테두리 제외). 블록 좌상단 기준이라 테두리 두께만큼 안쪽에서 시작한다. */
  const m = (html) => {
    const x = html.match(/class="zoom-bg" style="left:([-\d.]+)px;top:([-\d.]+)px;width:([\d.]+)px;height:([\d.]+)px/);
    assert.ok(x, '무늬 상자 치수를 못 읽었다');
    return x.slice(1).map(Number);
  };
  assert.deepEqual(m(chk), [0, 0, 160, 100]);          // rect: size 160 × 0.625, 테두리 없음
  const bd = g.buildZoomInner({ ...ST, fill: g.ZOOM_CHECKER, bd: 'on', bdw: 6 }, null);
  assert.deepEqual(m(bd), [6, 6, 160, 100]);           // ★테두리를 켜도 «도형 크기»는 그대로
  assert.match(g.buildZoomInner({ ...ST, shape: 'circle', fill: g.ZOOM_CHECKER }, null), /class="zoom-bg"[^>]*border-radius:50%/);
});

test('ⓐ-22 ⑤크기 덧씌우개 — w/h 가 «이기고», 없으면 size+프리셋 비율에서 파생된다', async () => {
  const g = await loadGeom();
  // 파생
  assert.deepEqual(g.shapeHalf({ ...ST, shape: 'rect' }), { hw: 80, hh: 50 });
  assert.deepEqual(g.shapeHalf({ ...ST, shape: 'square' }), { hw: 80, hh: 80 });
  assert.deepEqual(g.shapeHalf({ ...ST, shape: 'circle' }), { hw: 80, hh: 80 });
  // 덧씌우개가 이긴다
  assert.deepEqual(g.shapeHalf({ ...ST, shape: 'rect', w: 300, h: 120 }), { hw: 150, hh: 60 });
  // w 만 주면 square/circle 은 정비율, rect 는 여전히 «비율»로 세로를 만든다
  assert.deepEqual(g.shapeHalf({ ...ST, shape: 'square', w: 300 }), { hw: 150, hh: 150 });
  assert.deepEqual(g.shapeHalf({ ...ST, shape: 'rect', w: 300 }), { hw: 150, hh: 50 });
  // ⛔크기가 바뀌면 실루엣·뷰박스가 «같이» 따라온다
  const small = g.computeZoomGeometry({ ...ST, angle: 0, length: 400 }, null);
  const big   = g.computeZoomGeometry({ ...ST, angle: 0, length: 400, w: 300, h: 120 }, null);
  assert.equal(small.A.x, 80); assert.equal(big.A.x, 150);
  assert.ok(Math.abs(big.A.y) === 60);
  assert.ok(g.zoomBox({ ...ST, w: 300, h: 120 }, null).w > g.zoomBox(ST, null).w, '뷰박스가 안 따라왔다');
  // 블록 상자(=아웃라인·핸들이 앉는 자리)도 따라온다
  assert.equal(g.blockBoxSpec({ ...ST, w: 300, h: 120 }).w, 300);
});

test('ⓐ-23 ⑥a·b 기본 위치는 «12시»다 — y 가 아래로 증가하니 재서 골랐다', async () => {
  const g = await loadGeom();
  const D = { ...ST, angle: -90 };
  const L = g.lightPoint(D.angle, D.length, 0, 0);
  assert.ok(Math.abs(L.x) < 1e-9 && L.y < 0, `광원이 12시가 아니다: (${L.x},${L.y})`);
  const geo = g.computeZoomGeometry(D, null);
  assert.ok(geo.a.y < 0 && geo.b.y < 0, 'a·b 가 도형 «위»에 없다');
  assert.ok(Math.abs(geo.a.y - geo.b.y) < 1e-9, 'a·b 가 같은 높이여야 «수직»이다');
  assert.ok(Math.abs(geo.a.x + geo.b.x) < 1e-9, 'a·b 가 세로축에 대칭이어야 한다');
  // ⛔대조 — 옛 기본(0°)은 «오른쪽»이었다. 그게 현빈이 「오른쪽에 두지 말라」고 한 그 자리다.
  const old = g.computeZoomGeometry({ ...ST, angle: 0 }, null);
  assert.ok(old.a.x > 0 && Math.abs(old.a.y) < Math.abs(old.a.x), '대조가 성립 안 하면 이 검사는 무의미');
});

/* ── ⓑ 배선 — 신규 블록 체크리스트 5곳 ────────────────────────────────────── */
function sliceFn(src, header) {
  const i = src.indexOf(header);
  assert.notEqual(i, -1, `구간을 못 찾음: ${header}`);   // 못 찾으면 «건너뛰지 않고» 던진다
  const j = src.indexOf('\n}\n', i);
  assert.notEqual(j, -1, `구간 끝을 못 찾음: ${header}`);
  return src.slice(i, j);
}

test('ⓑ-1 [체크리스트①] js/editor.js deselectAll() 이 .zoom-block 의 .selected 를 푼다', () => {
  const body = sliceFn(SRC.editor, 'function deselectAll()');
  assert.ok(body.includes('.zoom-block'), 'deselectAll 안에 .zoom-block 이 없다 = 아웃라인이 안 풀린다');
});

test('ⓑ-1b js/editor.js 의 «선택 블록 SSOT» 목록에도 .zoom-block.selected 가 있다', () => {
  assert.ok(SRC.editor.includes('.zoom-block.selected'), 'Delete·복사 대상에서 빠진다');
});

test('ⓑ-2 [체크리스트②] layer-panel-items.js — 감지·type·labels·typeLbls·아이콘·클릭·프레임자식', () => {
  const s = SRC.layer;
  assert.ok(/const isZoom\s*=\s*block\.classList\.contains\('zoom-block'\)/.test(s), 'isZoom 감지 없음');
  assert.ok(s.includes("isZoom ? 'zoom'"), 'type 분기 없음 → Asset 으로 표시된다');
  // labels / typeLbls 는 «한 줄»에 수십 항목이라 길이제한 정규식으로 잡으면 놓친다 — 그 줄을 통째로 집는다.
  const lineWith = (needle) => s.split('\n').find(l => l.trimStart().startsWith(needle));
  const labelsLine = lineWith('const labels');
  const typeLine   = lineWith('const typeLbls');
  assert.ok(labelsLine && /zoom:\s*'Zoom'/.test(labelsLine), 'labels 등록 없음');
  assert.ok(typeLine   && /zoom:\s*'Zoom'/.test(typeLine),   "typeLbls 등록 없음(‘Component’ 로 뭉뚱그리지 않는다)");
  assert.ok(/\bzoom:\s*`<svg class="layer-item-icon"/.test(s), 'layerIcons 항목 없음');
  assert.ok(s.includes('window.showZoomProperties?.(block)'), '레이어 클릭 → 프로퍼티 연결 없음');
  assert.ok(s.includes("'zoom-block']") || s.includes("'zoom-block',"),
    '프레임 자식 블록 목록 배열에 zoom-block 이 없다 = 프레임 안에 넣으면 레이어에서 사라진다');
});

test('ⓑ-3 [체크리스트③] js/props/prop-zoom.js 헤더가 «풀 구조»다', () => {
  const s = SRC.prop;
  for (const cls of ['prop-block-label', 'prop-block-icon', 'prop-block-info', 'prop-block-id']) {
    assert.ok(s.includes(cls), `헤더 풀 구조 누락: ${cls}`);
  }
  assert.ok(s.includes('prop-block-name') && s.includes('prop-breadcrumb'), '블록명·위치 표기 누락');
  assert.ok(s.includes('window.showZoomProperties = showZoomProperties'), 'window 노출 없음');
});

test('ⓑ-4 [체크리스트④] js/block-drag.js — isZoom 감지 + 클릭 시 프로퍼티 패널', () => {
  const s = SRC.drag;
  assert.ok(/const isZoom\s*=\s*block\.classList\.contains\('zoom-block'\)/.test(s), 'isZoom 감지 없음');
  assert.ok(/if \(isZoom\) \{[\s\S]{0,1600}?window\.showZoomProperties\?\.\(block\)/.test(s),
    'isZoom 클릭 핸들러에서 showZoomProperties 를 안 부른다 = 클릭해도 패널이 안 열린다');
});

test('ⓑ-5 [체크리스트⑤] CSS 가 .zoom-block 의 선택 outline 을 «명시»한다', () => {
  const s = SRC.css;
  const m = s.match(/\.zoom-block\.selected\s*\{([^}]*)\}/);
  assert.ok(m, '.zoom-block.selected 규칙이 없다');
  assert.ok(/outline:\s*var\(--sel-outline-w\)\s+solid\s+var\(--ui-sel-overlay/.test(m[1]),
    '★확대블럭은 «스티커 계열»이라 보라(--ui-sel-overlay)다. 폭은 여전히 --sel-outline-w 토큰.');
  assert.ok(/outline-offset:\s*calc\(-1 \* var\(--sel-outline-w\)\)/.test(m[1]), 'offset -1px 상당 누락');
});

test('ⓑ-6 삽입 입구 — #fp-component-menu 에 형제들과 같은 어휘로 항목이 있다', () => {
  const menu = SRC.html.slice(SRC.html.indexOf('id="fp-component-menu"'));
  const end = menu.indexOf('</div>');
  const body = menu.slice(0, end);
  assert.ok(/onclick="addZoomBlock\(\);toggleFpDropdown\('fp-component-dropdown'\)"/.test(body),
    '컴포넌트 메뉴에 확대블럭 입구가 없다');
  assert.ok(SRC.html.includes('src="js/blocks/zoom-block.js"'), '블록 스크립트 태그 없음');
  assert.ok(SRC.html.includes('src="js/props/prop-zoom.js"'), '프로퍼티 스크립트 태그 없음');
});

test('ⓑ-7 저장/로드 — 캔버스 HTML 스냅샷이 정본이라 dataset 은 자동으로 실린다. 다만 로드 후 «재렌더»는 필요하다', () => {
  const s = SRC.save;
  assert.ok(s.includes('.zoom-block'), 'rebindAll 셀렉터에 .zoom-block 이 없다 = 로드 후 클릭이 안 먹는다');
  assert.ok(s.includes('window.renderZoomBlock?.(b)'),
    '저장본 SVG 는 스냅샷이라 a·b 핸들 드래그 위임이 없다 → laurel/chat 처럼 재렌더해야 한다');
  assert.ok(s.includes("'zmb'"), 'id 접두사 보강 경로에 zmb 가 없다');
});

/* ── ⓑ 금지사항 ──────────────────────────────────────────────────────────── */
test('ⓑ-8 ⛔선형 그라데이션(linearGradient)을 «코드»로 쓰지 않는다', () => {
  for (const k of ['geom', 'block', 'prop']) {
    assert.equal(SRC[k].includes('linearGradient'), false,
      `${k}: 선형은 축에 수직인 등농도선이라 a·b 의 농도가 갈린다 — 띠(strip)로 채워야 한다`);
  }
});

test('ⓑ-9 ⛔`?? alert(` 금지 (showToast 가 undefined 를 반환해 네이티브 alert 이 렌더러를 얼린다)', () => {
  for (const k of ['geom', 'block', 'prop']) {
    assert.equal(/\?\?\s*alert\(/.test(SRC[k]), false, `${k} 에 ?? alert( 이 있다`);
  }
});

test('ⓑ-10 ⛔makeZoomBlock 은 a·b 를 «박지 않는다» (끌기 전까지 언제나 자동)', () => {
  const body = sliceFn(SRC.block, 'function makeZoomBlock(');
  for (const key of ['ax', 'ay', 'bx', 'by']) {
    assert.equal(new RegExp(`dataset\\.${key}\\s*=`).test(body), false,
      `생성 시점에 dataset.${key} 를 박으면 방향·길이를 바꿔도 그림자가 안 따라온다`);
  }
  assert.ok(SRC.block.includes('function clearPinnedShortEdge'), '자동으로 되돌리는 길이 있어야 한다');
});

test("ⓑ-14 ★그림자·테두리는 «라디오»다 (⛔체크박스 아님) — 그리고 켤 때 값을 «안 지운다»", () => {
  const s = SRC.prop;
  assert.equal(/type="checkbox"/.test(s), false, '현빈이 「라디오버튼으로」라고 명시했다');
  for (const name of ['zm-shadow', 'zm-bd']) {
    const opts = [...s.matchAll(new RegExp(`type="radio" name="${name}" value="(on|off)"`, 'g'))].map(m => m[1]);
    assert.deepEqual(opts.sort(), ['off', 'on'], `${name} 라디오가 켬/끔 두 벌이 아니다`);
  }
  // ⛔라디오 핸들러가 그림자 값을 지우면 다시 켰을 때 안 돌아온다.
  const body = sliceFn(s, 'const bindRadio = (name, key, label) =>');
  for (const k of ['angle', 'length', 'maxop', 'curve', 'narrow', 'spread']) {
    assert.equal(new RegExp(`delete\\s+block\\.dataset\\.${k}\\b`).test(body), false,
      `라디오가 dataset.${k} 를 지운다 — 다시 켜면 값이 사라진다`);
  }
  assert.ok(/block\.dataset\[key\] = r\.value/.test(body), "라디오는 'on'/'off' 만 쓴다");
});

test('ⓑ-15 ★확대블럭은 «스티커 계열» 보라다 — hover 도 같은 토큰, 새 색 0건', () => {
  const s = SRC.css;
  const hov = s.match(/\.zoom-block:hover\s*\{([^}]*)\}/);
  assert.ok(hov && /var\(--ui-sel-overlay/.test(hov[1]), 'hover 도 보라여야 계열이 갈리지 않는다');
  // 대조 — 스티커 원본과 «같은 토큰»인지(색을 새로 만들지 않았는지)
  const stk = s.match(/\.sticker-block\.selected\s*\{([^}]*)\}/);
  assert.ok(stk && /var\(--ui-sel-overlay/.test(stk[1]), '전제: 스티커가 그 토큰을 쓴다');
  /* ★블록 자신이 «플로팅»이라 absolute 다 — 그래야 상자가 도형 상자가 되고, 오버레이가
     그 상자의 border-radius 를 읽어 원을 그린다. 보조 상자(.zoom-sel-box)는 없어졌다. */
  const blk = s.match(/\n\.zoom-block\s*\{([^}]*)\}/);
  assert.ok(blk, '.zoom-block 규칙이 없다');
  assert.match(blk[1], /position:\s*absolute/, '플로팅이 아니면 상자가 행 전체 폭이 된다');
  assert.equal(/width:\s*100%/.test(blk[1]), false, '행 전체 폭으로 되돌아갔다');
  assert.equal(/\.zoom-sel-box/.test(s), false, '보조 선택상자가 되살아났다');
});

test('ⓑ-16 ★선택 오버레이 — 변경 표면이 «_variantOf 세 줄»뿐이다', () => {
  const s = SRC.overlay;
  // ⑴ 갈래(보라)를 «선언»으로 받는다 — 블록 이름 목록을 안 늘린다(이 파일 머리의 규칙)
  assert.ok(/host\.dataset\?\.selVariant/.test(s), 'data-sel-variant 를 안 읽는다 = 보라가 안 붙는다');

  // ⛔⑵ 기존 입력의 답이 안 바뀐다 = 새 분기가 «옛 분기 뒤»에 온다
  const variant = sliceFn(s, 'function _variantOf(host)');
  assert.ok(variant.indexOf("classList.contains('sticker-block')") < variant.indexOf('dataset?.selVariant'),
    '선언형 분기가 «앞»에 오면 기존 두 블록의 판정이 바뀔 수 있다');

  /* ⛔⑶ 퇴행 방지 — _geomOf 와 _hostOf 는 «한 글자도» 안 건드렸다.
     ★플로팅으로 옮기면서 _hostOf 의 보조상자 분기가 «죽은 가지»가 됐다 — 죽은 가지는 썩으니 지웠다.
       그래서 지금 _hostOf 는 dev 원본과 같아야 한다. */
  const hostOf = sliceFn(s, 'function _hostOf(el)');
  assert.equal(/sel-box|SEL_BOX|selVariant|zoom/.test(hostOf), false,
    '_hostOf 에 확대블럭 전용 가지가 남아 있다 — 플로팅이면 필요 없다');
  const geom = sliceFn(s, 'function _geomOf(el, variant, scale)');
  for (const w of ['zoom', 'sel-box', 'selVariant', 'selBox']) {
    assert.equal(geom.includes(w), false, `_geomOf 에 ${w} 가 들어갔다 — 공용 함수를 건드렸다`);
  }

  // ⛔⑷ 선 굵기 표를 안 늘렸다(sticker 는 1 그대로)
  const sw = s.match(/export const STROKE_W = \{([^}]*)\}/);
  assert.ok(sw && /sticker:\s*1/.test(sw[1]), 'sticker 굵기가 1 이 아니다');
  assert.equal(sw[1].split(',').filter(x => x.trim()).length, 3, '굵기 갈래를 늘렸다 — sticker 를 그대로 써야 한다');
});

test('ⓑ-11 ⛔새 색을 만들지 않는다 — 체크패턴은 «전례와 바이트 동일»해야 통과한다', () => {
  const cssAll = SRC.css;
  const zone = cssAll.slice(cssAll.indexOf('.zoom-block {'));
  const mine = zone.slice(0, zone.indexOf('\n.chb-msg'));
  assert.ok(mine.length > 0);

  /* ★체크무늬 값은 «정본이 하나»여야 한다. 새로 쓴 게 아니라 .icb-circle 것을 그대로 쓴 것인지를
     «두 문자열이 같은가»로 잰다 — 눈으로 「비슷하다」고 넘기면 조용히 갈라진다. */
  /* ⚠️«줄머리»로 고정한다 — 그냥 indexOf 로 찾으면 `.icon-circle-block.drag-over .icb-circle {`
     같은 «다른 규칙»이 먼저 잡힌다(실제로 잡혔고, 위 전제 단언이 그걸 잡아냈다). */
  const grab = (src, sel) => {
    const i = src.indexOf('\n' + sel);
    assert.notEqual(i, -1, `${sel} 를 못 찾음`);
    const body = src.slice(i, src.indexOf('}', i));
    const m = body.match(/repeating-conic-gradient\([^;]*/);
    return m ? m[0].replace(/\s+/g, ' ').trim() : null;
  };
  const precedent = grab(cssAll, '.icb-circle {');
  const zoomBg    = grab(cssAll, '.zoom-block .zoom-bg {');
  assert.ok(precedent, '전제: .icb-circle 이 체크무늬를 갖고 있다');
  assert.equal(zoomBg, precedent, '★체크무늬를 «베꼈다» — 전례와 한 글자라도 다르면 두 정본이 된다');

  // 그 밖의 색 선언은 여전히 토큰이거나 중립값이어야 한다(체크무늬 줄만 면제)
  const decls = [...mine.matchAll(/(?:^|\s)(?:color|fill|stroke|background|outline)\s*:\s*([^;]+);/g)]
    .map(m => m[1].replace(/\s+/g, ' ').trim())
    .filter(d => !d.includes('repeating-conic-gradient'));
  for (const d of decls) {
    const ok = d.includes('var(--') || /^(#fff|none|transparent|currentColor)$/i.test(d) || /^\d/.test(d);
    assert.ok(ok, `새 색을 만들었다: ${d}`);
  }
});

test('ⓑ-19 ★⑧계열 = «플로팅»(스티커) — 행에 넣지 않는다', () => {
  const b = SRC.block;
  // ⑴ 삽입 자리 = 섹션 «직접 자식». 스티커와 같은 자리다.
  const add = sliceFn(b, 'function addZoomBlock(opts = {})');
  assert.ok(/sec\.appendChild\(block\)/.test(add), '섹션 직접 자식이 아니다 = 플로팅이 아니다');
  assert.equal(/insertAfterSelected/.test(b), false, '흐름 삽입 헬퍼가 남아 있다');
  // ⑵ 행(row)을 «만들지 않는다»
  const mk = sliceFn(b, 'function makeZoomBlock(opts = {})');
  assert.equal(/className = 'row'/.test(mk), false, '행을 다시 만들고 있다');
  assert.ok(/return block;/.test(mk), '행 없이 블록만 돌려줘야 한다');
  // ⑶ 위치 = absolute + left/top(px) + dataset.x/y — 스티커의 cssText 관례
  const rend = sliceFn(b, 'function renderZoomBlock(block)');
  assert.ok(/position:absolute;left:\$\{st\.x\}px;top:\$\{st\.y\}px;/.test(rend), '절대 위치를 안 쓴다');
  assert.ok(/width:\$\{box\.w[\s\S]{0,60}?height:\$\{box\.h/.test(rend), 'absolute 면 크기를 스스로 가져야 한다');
  assert.ok(/border-radius:\$\{box\.radius\}/.test(rend), '★블록의 border-radius 가 곧 아웃라인 모양이다');
  // ⑷ 이동 드래그도 «스티커 규약»을 그대로 쓴다(새로 만들지 않는다)
  const mv = sliceFn(b, 'function _bindZoomMoveDrag(block)');
  assert.ok(/window\._clampToSection/.test(mv) && /window\._findSectionAt/.test(mv),
    '스티커의 좌표 헬퍼를 안 쓰고 새로 만들었다');
  assert.ok(/dataset\.x = /.test(mv) && /style\.left = /.test(mv), 'dataset 과 style 을 «같이» 밀어야 한다');
  // ⑸ 보라 갈래는 블록이 «스스로» 든다
  assert.ok(/dataset\.selVariant = 'sticker'/.test(b), '선택 오버레이가 보라를 못 고른다');
  // ⑹ 배율은 «정본 함수»에서 온다 — 베끼면 핸들과 갈라진다
  assert.ok(/import \{ _canvasScaleNow \} from '\.\.\/overlay-handles\.js'/.test(b), '배율을 베꼈다');
});

test('ⓑ-17 ⑤핸들 배선 — 아웃라인 상자에 붙고, dataset.w/h 로 커밋한다', () => {
  const s = SRC.handles;
  assert.ok(/showHandlesFor[\s\S]{0,300}?zoom-block[\s\S]{0,120}?showZoomResizeHandles/.test(s),
    'showHandlesFor 가 zoom 을 안 태운다 = 핸들이 안 뜬다');
  const body = sliceFn(s, 'function _onZoomResizeMouseDown(e, zb, dir)');
  assert.ok(/zb\.dataset\.w = /.test(body) && /zb\.dataset\.h = /.test(body),
    '★크기를 style.width 로 쓰면 안 된다 — 확대블럭 크기는 CSS 상자가 아니라 SVG 안 도형이다');
  assert.equal(/zb\.style\.width/.test(body), false, 'style.width 로 쓰면 도형이 안 변한다');
  assert.ok(/window\.renderZoomBlock\?\.\(zb\)/.test(body), '재렌더 없이는 실루엣·그림자가 안 따라온다');
  assert.ok(/isCircle[\s\S]{0,120}?newW = newH/.test(body), '원은 정원만 그릴 수 있다(w=h 로 묶어야 한다)');
  /* ★핸들 기준 = «블록 자신». 플로팅이라 블록 상자가 곧 도형(+테두리) 상자다.
     ⛔보조 상자를 다시 들이면 블록 상자와 «두 벌»이 되어 아웃라인과 핸들이 갈린다. */
  const boxFn = sliceFn(s, 'function _zoomOutlineBox(zb)');
  assert.equal(/zoom-sel-box/.test(boxFn), false, '보조 상자가 되살아났다');
  assert.ok(/return zb;/.test(boxFn), '핸들 기준이 블록 자신이 아니다');
  // 캔버스 클릭 경로에서도 불러야 한다(레이어패널만 되면 반쪽이다)
  assert.ok(/if \(isZoom\)[\s\S]{0,1800}?window\.showHandlesFor\?\.\(block\)/.test(SRC.drag),
    '캔버스에서 클릭했을 때 핸들이 안 뜬다');
});

test("ⓑ-18 ⑦bdr 슬라이더는 «가려져» 있다 — 그러나 값·렌더 경로는 살아 있다", () => {
  const p = SRC.prop;
  // ⛔거른 소스(주석 제거본)에 zm-bdr 이 «없어야» 숨긴 것이다
  assert.equal(/zm-bdr/.test(p), false, '모서리 슬라이더가 아직 패널에 나온다');
  // ★그런데 «지우지는» 않았다 — 원본에는 주석으로 남아 있어야 「아직」을 되돌릴 수 있다
  assert.ok(RAW.prop.includes('zm-bdr'), '지워버리면 「아직」이 아니라 「없앰」이다');
  // ⛔값과 렌더 경로는 살아 있다
  assert.ok(/bdr:\s*_num\(d\.bdr/.test(SRC.block), 'dataset.bdr 을 안 읽는다');
  assert.ok(/bdr:\s*0,/.test(SRC.block), '기본값 0 이 사라졌다');
  assert.ok(/const bdr = Math\.max\(0, Number\(st\.bdr\) \|\| 0\)/.test(SRC.geom), '렌더가 bdr 을 안 쓴다');
});

test('ⓑ-12 기하 모듈은 window/document 를 «안 만진다» (그래야 검사가 실행으로 잴 수 있다)', () => {
  assert.equal(/\bwindow\b/.test(SRC.geom), false, 'zoom-geometry.js 에 window 가 있으면 동적 import 가 죽는다');
  assert.equal(/\bdocument\b/.test(SRC.geom), false);
});

test('ⓑ-13 기본값 — shape=rect(★기본은 사각형) · maxop=30 · length=170 · narrow=62 · curve=100 · angle=0 · spread=0', () => {
  const body = sliceFn(SRC.block, 'const ZOOM_DEFAULTS = {');
  const pick = (k) => {
    const m = body.match(new RegExp(`${k}:\\s*'?([^,'\\s]+)'?`));
    assert.ok(m, `기본값 ${k} 없음`);
    return m[1];
  };
  assert.equal(pick('shape'), 'rect');
  assert.equal(pick('angle'), '-90');   // ★12시(위) — y 가 아래로 증가하는 좌표계라 «음수»가 위다
  assert.equal(pick('length'), '170');
  assert.equal(pick('spread'), '0');
  assert.equal(pick('maxop'), '30');
  assert.equal(pick('curve'), '100');
  assert.equal(pick('narrow'), '62');
  assert.equal(pick('shadow'), 'off');   // ★기본은 «끔» = 에셋블럭 스티커(현빈 2026-09-08)
  assert.ok(/fill:\s*ZOOM_CHECKER/.test(body), '★기본 배경은 체크패턴이어야 한다');
  assert.equal(pick('bd'), 'off');       // ★테두리는 «끔»이 기본
  assert.equal(pick('bdw'), '6');
  assert.equal(pick('bdc'), '#ffffff');
  assert.equal(pick('bdr'), '0');
  assert.ok(/ZOOM_SHAPES = \['rect', 'circle', 'square'\]/.test(SRC.block), '프리셋 셋(사각형·원·정사각형) 누락');
});
