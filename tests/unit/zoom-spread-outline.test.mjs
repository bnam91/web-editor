/* zoom-spread-outline — 확대블럭 「벌림」이 «도형 선을 따라 미끄러지는가». 현빈 2026-09-08
 *
 *   「벌리기 슬라이드를 하면 c,d의 거리가 벌어지는데 «그게아니고», c는 A부터 왼쪽으로
 *     쉐이프 선따라서 가고, d는 B의 바깥쪽으로 라인따라 벌려지게」
 *   「미끄러지는게 맞아 도형선따라서. 모서리 넘어가도 계속 둬.
 *     그리고 각 꼭지점마다, 살짝씩 걸리는 느낌도 줄수 있어? 마그네틱 같은 느낌으로?」
 *
 * ★여기 검사는 «소스를 읽지» 않는다 — zoom-geometry.js 를 tmp `.mjs` 사본으로 «진짜 실행»해서
 *   좌표를 잰다(zoom-block.test.js 의 loadGeom 수법 그대로). 소스 문자열로 재면
 *   「함수 이름은 그대로인데 안이 텅 빈」 변이가 통과한다.
 *   ⚠️예외는 T8(색) 하나 — 색은 CSS 라 실행이 없다. 그래서 D1(tests/dom)이 «렌더된 색»을 잰다.
 *
 * ⛔이 파일이 지키는 것과 «되돌리면 빨개지는 것»은 각 test 의 첫 줄 주석에 적었다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readSrc } from './_srcread.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/* ⛔js/**.js 는 이 레포가 "type":"commonjs" 라 node 가 ESM 으로 못 읽는다.
   ⇒ tmp 에 `.mjs` 로 «복사해» 동적 import 한다. 사본이지 흉내가 아니다. */
let _modP = null;
function loadGeom() {
  if (!_modP) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoom-spread-'));
    const mjs = path.join(dir, 'zoom-geometry.mjs');
    fs.copyFileSync(path.resolve(ROOT, 'js/blocks/zoom-geometry.js'), mjs);
    _modP = import(pathToFileURL(mjs).href);
  }
  return _modP;
}

const ST = {
  shape: 'rect', angle: 0, length: 170, spread: 0,
  maxop: 30, curve: 100, narrow: 62, size: 260, rot: 0,
  fill: '#cfd6e0', shadow: 'on', bd: 'off', bdw: 6, bdc: '#ffffff', bdr: 0,
};
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/* ── 검사 «자기» 자(尺) — 구현을 안 빌린다 ────────────────────────────────────
   ⛔walkPolygon 을 빌려 재면 동어반복이다(구현이 틀려도 자도 같이 틀린다).
   여기 둘은 «꼭짓점 목록»만 받아 초등기하로 잰다. */

/** 점 P 에서 선분 UV 까지의 거리 + 그 위 매개변수 t. */
function segDist(P, U, V) {
  const vx = V.x - U.x, vy = V.y - U.y, L2 = vx * vx + vy * vy;
  let t = L2 > 1e-12 ? ((P.x - U.x) * vx + (P.y - U.y) * vy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { d: Math.hypot(P.x - (U.x + vx * t), P.y - (U.y + vy * t)), t };
}

/** 점이 닫힌 다각형의 «변 위»에 있나 — 가장 가까운 변까지의 거리와 그 변 index. */
function onPoly(pts, P) {
  let best = { d: Infinity, i: -1, t: 0 };
  for (let i = 0; i < pts.length; i++) {
    const r = segDist(P, pts[i], pts[(i + 1) % pts.length]);
    if (r.d < best.d) best = { d: r.d, i, t: r.t };
  }
  return best;
}

/** 다각형 둘레에서 «꼭짓점 0 부터의» 호길이. */
function arcParam(pts, P) {
  const n = pts.length, on = onPoly(pts, P);
  let s = 0;
  for (let i = 0; i < on.i; i++) s += dist(pts[i], pts[(i + 1) % n]);
  return s + on.t * dist(pts[on.i], pts[(on.i + 1) % n]);
}

/** 두 점 사이의 «둘레» 거리(짧은 쪽). */
function arcDist(pts, P, Q) {
  const n = pts.length;
  let per = 0; for (let i = 0; i < n; i++) per += dist(pts[i], pts[(i + 1) % n]);
  const d = Math.abs(arcParam(pts, P) - arcParam(pts, Q));
  return Math.min(d, per - d);
}

/* ── T0 ★「입력이 살아 있다」 — 본 단언 «앞»에 ──────────────────────────────── */

/** CSS 규칙 한 덩이를 «중괄호 균형»으로 떠낸다.
 *  ⚠️JS 에 이 도구를 쓸 땐 `f(opts = {})` 의 «기본값 중괄호»를 몸통으로 오인한다 —
 *    매개변수 괄호를 «먼저» 닫아라. 여기 대상은 CSS 라 그 함정이 없다. */
function cssRule(src, selector) {
  const i = src.indexOf(selector);
  assert.notEqual(i, -1, `CSS 규칙을 못 찾음(이름이 바뀌었다): ${selector}`);
  const j = src.indexOf('{', i), k = src.indexOf('}', j);
  assert.ok(j > 0 && k > j, `중괄호가 안 닫힌다: ${selector}`);
  return src.slice(i, k + 1);
}

const CSS = readSrc(ROOT, 'css', 'editor-blocks.css');
const HANDLE_RULE = cssRule(CSS, '.zoom-block .zoom-handle {');

test('T0 ★전제 — 잴 대상이 «실제로» 손에 들려 있다 (본 단언 앞)', async () => {
  // ⇐ 검사 입력을 비우면(모듈이 안 뜨거나 CSS 덩이가 빈 문자열) «여기가 먼저» 빨갛다
  const g = await loadGeom();
  for (const fn of ['computeZoomGeometry', 'applySpreadAlongOutline', 'walkPolygon',
                    'walkCircle', 'vertexDistances', 'detent', 'zoomMagnet', 'shapeCornerPts']) {
    assert.equal(typeof g[fn], 'function', `기하 모듈에 ${fn} 이 없다`);
  }
  // 떠낸 덩이가 «비지 않았고», 그 덩이여야만 있는 토큰을 갖는다
  assert.ok(HANDLE_RULE.length > 40, `핸들 규칙 덩이가 비었다: ${JSON.stringify(HANDLE_RULE)}`);
  assert.ok(HANDLE_RULE.includes('stroke-width') && HANDLE_RULE.includes('cursor: grab'),
    `이 덩이가 «그 규칙»이 아니다: ${HANDLE_RULE}`);
  // 그리고 기본 상태가 «움직일 여지»를 갖는다 — spread 0 에서 A·B 가 서로 다른 점이다
  const base = g.computeZoomGeometry({ ...ST, spread: 0 }, null);
  assert.ok(dist(base.A, base.B) > 1, '전제: spread 0 에서 A·B 가 «두 점»이다');
});

/* ── T1 ★두 점이 «도형 둘레 위»에 남는다 ────────────────────────────────────── */
test('T1 ★spread 를 키워도 A·B 가 «도형 선 위»에 남는다 (허공으로 안 나간다)', async () => {
  // ⇐ 직선 밀어내기(옛 applySpread)로 되돌리면 «빨강»
  const g = await loadGeom();
  for (const spread of [20, 60, 140, 300, 520]) {
    const st = { ...ST, spread };
    const geo = g.computeZoomGeometry(st, null);
    const pts = g.shapeCornerPts(st, geo.bw);
    for (const [nm, P] of [['A', geo.A], ['B', geo.B]]) {
      assert.ok(onPoly(pts, P).d < 0.5,
        `spread=${spread} ${nm} 가 윤곽에서 ${onPoly(pts, P).d.toFixed(2)}px 떠 있다`);
    }
    // 양성대조 — 옛 직선 모델이었다면 «떠 있었어야» 한다(자가 무디지 않다는 증명)
    const b = g.computeZoomGeometry({ ...ST, spread: 0 }, null);
    const d0 = dist(b.A, b.B), ux = (b.B.x - b.A.x) / d0, uy = (b.B.y - b.A.y) / d0;
    const oldA = { x: b.A.x - ux * spread / 2, y: b.A.y - uy * spread / 2 };
    assert.ok(onPoly(pts, oldA).d > 0.5, `자가 무디다 — 옛 모델의 자리도 «윤곽 위»로 읽힌다 (spread=${spread})`);
  }
});

/* ── T2 «둘레» 거리가 spread/2 씩 ──────────────────────────────────────────── */
test('T2 각 점이 «둘레 거리» spread/2 만큼 간다 (직선거리가 아니다)', async () => {
  // ⇐ 직선으로 되돌리거나 걷는 양을 spread 로 잘못 주면 «빨강»
  const g = await loadGeom();
  const base = g.computeZoomGeometry({ ...ST, spread: 0 }, null);
  const pts = g.shapeCornerPts(ST, base.bw);
  /* ⛔걸림 창(±16 슬라이더칸)에 안 걸리는 값만 고른다 — 그쪽은 T7 이 잰다.
     ★700 을 꼭 넣는다: 사각형은 첫 260 이 «곧은 변»이라 거기서는 둘레거리 = 직선거리다.
       그 자리만 재면 «직선 밀어내기»도 이 검사를 통과한다. 모서리를 넘긴 값이 있어야 갈린다. */
  for (const spread of [40, 120, 700]) {
    const geo = g.computeZoomGeometry({ ...ST, spread }, null);
    assert.ok(Math.abs(arcDist(pts, base.A, geo.A) - spread / 2) < 0.01,
      `A 의 둘레 이동 = ${arcDist(pts, base.A, geo.A).toFixed(3)} ≠ ${spread / 2}`);
    assert.ok(Math.abs(arcDist(pts, base.B, geo.B) - spread / 2) < 0.01,
      `B 의 둘레 이동 = ${arcDist(pts, base.B, geo.B).toFixed(3)} ≠ ${spread / 2}`);
    // 직선거리와 «다르다» — 같으면 이 검사는 직선 모델도 통과시킨다
    if (spread === 700) {
      assert.ok(Math.abs(dist(base.A, geo.A) - spread / 2) > 50,
        `직선거리와 둘레거리가 같은 자리만 골랐다 = 대조가 안 된다 (직선 ${dist(base.A, geo.A).toFixed(1)})`);
    }
  }
});

/* ── T3 ★모서리를 넘어간다 ────────────────────────────────────────────────── */
test('T3 ★한 변보다 큰 spread 에서 점이 «다음 변» 위에 있다 (모서리에서 안 멈춘다)', async () => {
  // ⇐ 모서리에서 멈추게(clamp) 하면 «빨강»
  const g = await loadGeom();
  const base = g.computeZoomGeometry({ ...ST, spread: 0 }, null);
  const pts = g.shapeCornerPts(ST, base.bw);
  const i0 = onPoly(pts, base.A).i;                     // A 가 출발하는 변
  const geo = g.computeZoomGeometry({ ...ST, spread: 700 }, null);   // h=350 > 첫 변 260
  const hit = onPoly(pts, geo.A);
  assert.ok(hit.d < 0.5, `A 가 윤곽을 벗어났다 (${hit.d.toFixed(2)}px)`);
  assert.notEqual(hit.i, i0, '아직 «첫 변»에 있다 = 모서리에서 멈췄다');
  assert.ok(arcDist(pts, base.A, geo.A) > 260, `둘레로 260 을 못 넘었다: ${arcDist(pts, base.A, geo.A).toFixed(1)}`);
});

/* ── T4 원 ────────────────────────────────────────────────────────────────── */
test('T4 원에서는 «호»를 따라간다 (중심에서의 거리가 변하지 않는다)', async () => {
  // ⇐ 원 갈래를 직선 밀어내기로 되돌리면 «빨강»
  const g = await loadGeom();
  const st0 = { ...ST, shape: 'circle', spread: 0 };
  const R = g.computeZoomGeometry(st0, null).r + g.computeZoomGeometry(st0, null).bw;
  const base = g.computeZoomGeometry(st0, null);
  for (const spread of [60, 200, 400]) {
    const geo = g.computeZoomGeometry({ ...ST, shape: 'circle', spread }, null);
    assert.ok(Math.abs(Math.hypot(geo.A.x, geo.A.y) - R) < 1e-6, `A 가 원 밖: ${Math.hypot(geo.A.x, geo.A.y)} ≠ ${R}`);
    assert.ok(Math.abs(Math.hypot(geo.B.x, geo.B.y) - R) < 1e-6, `B 가 원 밖`);
    // 호길이 = R·Δ각 이 spread/2
    const ang = (P) => Math.atan2(P.y, P.x);
    let d = Math.abs(ang(geo.A) - ang(base.A)); if (d > Math.PI) d = 2 * Math.PI - d;
    assert.ok(Math.abs(R * d - spread / 2) < 0.01, `호길이 ${(R * d).toFixed(2)} ≠ ${spread / 2}`);
  }
});

/* ── T5 회전 ──────────────────────────────────────────────────────────────── */
test('T5 회전(rot=25)에서도 «돌아간 실제 꼭짓점» 둘레를 탄다', async () => {
  // ⇐ 둘레를 «안 돌아간» 꼭짓점으로 계산하면(rot 무시) 빨강
  const g = await loadGeom();
  const st = { ...ST, rot: 25, bd: 'on', bdw: 6, spread: 240 };
  const geo = g.computeZoomGeometry(st, null);
  assert.ok(geo.bw > 0, '전제: 테두리 두께가 실루엣에 들어간다');
  const pts = g.shapeCornerPts(st, geo.bw);             // ★돌아간 + 두께 먹은 «그» 목록
  assert.ok(onPoly(pts, geo.A).d < 0.5, `A 가 회전 윤곽 밖: ${onPoly(pts, geo.A).d.toFixed(2)}px`);
  assert.ok(onPoly(pts, geo.B).d < 0.5, `B 가 회전 윤곽 밖`);
  /* ★양성대조 — rot 이 «실제로» 먹었나. ⛔「안 돌린 다각형에서는 떠 있다」로 재려다 물렸다:
     실측 0.359px 라 0.5 문턱을 못 넘었다(우연히 가까웠다). 그래서 «같은 spread 에서 rot 만 0» 과
     자리를 맞댄다 — 이건 우연이 안 낀다(실측 33.6px). */
  const flatGeo = g.computeZoomGeometry({ ...st, rot: 0 }, null);
  assert.ok(dist(geo.A, flatGeo.A) > 5,
    `rot 을 바꿔도 A 가 그 자리다 = 회전이 안 먹었거나 이 검사가 못 잰다 (${dist(geo.A, flatGeo.A).toFixed(2)}px)`);
});

/* ── T6 ★퇴화 ─────────────────────────────────────────────────────────────── */
test('T6 ★A==B(광원이 도형 안)에서 안 터진다 — 옛 성질 그대로', async () => {
  // ⇐ 퇴화 가드를 지우면 NaN/무한루프로 «빨강»
  const g = await loadGeom();
  for (const shape of ['circle', 'rect', 'square']) {
    const st = { ...ST, shape, length: 0, spread: 300 };
    const geo = g.computeZoomGeometry(st, null);
    assert.ok(Number.isFinite(geo.A.x) && Number.isFinite(geo.A.y), `${shape}: A 가 NaN`);
    assert.ok(Number.isFinite(geo.B.x) && Number.isFinite(geo.B.y), `${shape}: B 가 NaN`);
    if (shape === 'circle') {
      assert.deepEqual(geo.A, geo.B, '원 퇴화에서 A·B 는 «한 점»으로 남는다');
      assert.equal(g.shadowVisible(st, geo), false, '넓이 0 인 띠를 그리면 안 된다');
    }
    assert.doesNotThrow(() => g.buildZoomSvg(st, null), `${shape}: 마크업 조립이 터졌다`);
  }
});

/* ── T7 ★마그네틱 ─────────────────────────────────────────────────────────── */
test('T7 ★꼭짓점에서 «평평»하고, 더 밀면 «넘어간다» (스냅이 아니다)', async () => {
  // ⇐ 마그네틱을 지우면 「평평」 절반이, «영구 부착(스냅)»으로 바꾸면 「넘어간다」 절반이 빨강
  const g = await loadGeom();
  const base = g.computeZoomGeometry({ ...ST, spread: 0 }, null);
  const pts = g.shapeCornerPts(ST, base.bw);
  const CORNER = 260;                       // A 가 처음 만나는 꼭짓점의 둘레거리(아래 변 길이)
  assert.ok(Math.abs(dist(pts[0], pts[1]) - CORNER) < 1e-9 || Math.abs(dist(pts[1], pts[2]) - CORNER) < 1e-9,
    '전제: 260 이 «실제» 변 길이다');

  const at = (spread, extra) => g.computeZoomGeometry({ ...ST, spread, ...extra }, null).A;

  // ⑴ 평평 — 걸림 창의 «죽은 구간»(±W·S = ±8 둘레px = 슬라이더 ±16) 안에서 안 움직인다
  const flat = [504, 512, 520, 528, 536].map(s => at(s));
  for (const P of flat) assert.ok(dist(P, flat[0]) < 1e-9, `평평 구간에서 움직였다: ${JSON.stringify(P)}`);
  assert.ok(arcDist(pts, base.A, flat[0]) - CORNER < 1e-6 && CORNER - arcDist(pts, base.A, flat[0]) < 1e-6,
    '평평 구간이 «꼭짓점»이 아니다');

  // ⑵ ★양성대조 — 마그네틱을 끄면 같은 두 값이 «갈린다»(자가 무디지 않다)
  const offA = at(504, { magnet: 'off' }), offB = at(536, { magnet: 'off' });
  assert.ok(dist(offA, offB) > 10, `마그네틱을 꺼도 안 갈린다 = 이 검사가 걸림을 못 잰다 (${dist(offA, offB)})`);

  // ⑶ ★넘어간다 — 더 밀면 꼭짓점을 «지나친다». 끝까지 붙어 있으면 스냅이다
  const past = at(600);
  assert.ok(arcDist(pts, base.A, past) > CORNER + 20,
    `꼭짓점에 붙어 버렸다(스냅) — 둘레 이동 ${arcDist(pts, base.A, past).toFixed(1)}`);
  assert.ok(onPoly(pts, past).d < 0.5, '넘어간 뒤 윤곽을 벗어났다');

  // ⑷ 순수 함수 detent 자체 — 실행으로 «평평 + 통과»를 둘 다 잰다
  const V = [-260, 260], W = g.ZOOM_DETENT_W, S = g.ZOOM_DETENT_S;
  assert.ok(W > 0 && S > 0 && S < 1, `걸림 상수가 비었다: W=${W} S=${S}`);
  assert.equal(g.detent(260 - W * S, V, W, S), 260, '죽은 구간 왼쪽 끝이 꼭짓점이 아니다');
  assert.equal(g.detent(260 + W * S, V, W, S), 260, '죽은 구간 오른쪽 끝이 꼭짓점이 아니다');
  assert.ok(Math.abs(g.detent(260 + W, V, W, S) - (260 + W)) < 1e-9, '창 끝에서 사상이 «이어지지» 않는다(점이 튄다)');
  assert.ok(Math.abs(g.detent(1000, V, W, S) - 1000) < 1e-9, '창 밖인데 건드린다');
  assert.ok(g.detent(260 + W * 0.9, V, W, S) > 260 + 1, '죽은 구간 밖인데 «안» 움직인다 = 영구 부착');
  // 단조 — 사상이 뒤로 가면 슬라이더가 «되감긴다»
  let prev = -Infinity;
  for (let r = 200; r <= 320; r += 0.5) {
    const v = g.detent(r, V, W, S);
    assert.ok(v >= prev - 1e-9, `사상이 뒤로 갔다 at ${r}`);
    prev = v;
  }
  // 원에는 꼭짓점이 없다 ⇒ 걸림도 없다(연속)
  const cA = g.computeZoomGeometry({ ...ST, shape: 'circle', spread: 520 }, null).A;
  const cB = g.computeZoomGeometry({ ...ST, shape: 'circle', spread: 528 }, null).A;
  assert.ok(dist(cA, cB) > 1, '원에서도 걸린다 — 꼭짓점이 없는데 걸림을 넣었다');
});

/* ── T8 색 ────────────────────────────────────────────────────────────────── */
test('T8 a·b 핸들 색이 «토큰» --ui-sel-overlay 다 (리터럴도, 파랑도 아니다)', () => {
  // ⇐ --sel-color 로 되돌리거나 #9966ff 를 박아 넣으면 «빨강». 렌더된 색은 D1 이 잰다.
  assert.match(HANDLE_RULE, /stroke:\s*var\(--ui-sel-overlay\)/, `stroke 가 토큰이 아니다: ${HANDLE_RULE}`);
  assert.doesNotMatch(HANDLE_RULE, /--sel-color/, '앵커가 아직 파랑(--sel-color)이다');
  assert.doesNotMatch(HANDLE_RULE, /#9966ff/i, '리터럴을 박았다 — 토큰을 써라');
  const picked = cssRule(CSS, '.zoom-block .zoom-handle[data-picked="true"]');
  assert.ok(picked.includes('fill'), `전제: 집힌 앵커 규칙이 채움을 정한다: ${picked}`);
  assert.match(picked, /fill:\s*var\(--ui-sel-overlay\)/, `집힌 앵커 채움이 토큰이 아니다: ${picked}`);
  assert.doesNotMatch(picked, /--sel-color/, '집힌 앵커가 아직 파랑이다');
});
