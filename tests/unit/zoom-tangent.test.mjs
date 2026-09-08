/* zoom-tangent — 확대블럭 「손잡이 셋 + 접선 규칙」. 현빈 승인 2026-09-09
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *   ⛔`node --test tests/unit`(디렉터리 인자)로 부르지 마라 — Node 24 에서 한 개도 안 돌고
 *     화면엔 「tests 1 / pass 0 / fail 1」로 «작은 실패»처럼 보인다.
 *
 * ★무엇이 틀렸었나
 *   옛 판은 c·d(코드의 A·B)를 «광원 L 에서» 쟀다. 그러면 사람이 a·b 를 끌었을 때 c·d 가
 *   «안 따라와서» 도형이 빔 옆선 «밖»으로 삐져나온다.
 *   ⇒ 이제 c·d 는 «a·b 각자에서 그은 접점»이다. 접선이면 도형은 정의상 그 선 «안쪽»에 있다.
 *
 * ★★이 파일이 한 번 뚫렸다 — 적대적 검수가 «6/6 초록»인 변이를 일곱 개 찾았다(2026-09-09).
 *   그때 배운 것 셋. 새 검사를 더할 때 이 셋을 지켜라.
 *     ⑴ ★「N/N 통과」를 적을 땐 N 이 «무엇의 전수»인지 같이 적어라.
 *        뚫린 이유의 절반이 «격자에 축이 빠져 있던 것»이었다 — 원(circle)이 통째로 빠졌고
 *        (H5), 사람이 핸들로 끈 크기 w/h 가 한 칸도 없었다(H6). 아래 격자 상수 옆의
 *        「전수」 주석이 그 기록이다.
 *     ⑵ ★거리(‖c−d‖)만 재면 «좌우 맞바꿈»을 못 잡는다. 처방의 «착지한 점»은 좌표로 못박아라(T4-ii).
 *     ⑶ ★변이가 빨갛다고 「계약이 물었다」로 읽지 마라. 「무엇이 빨갛게 만들었나」를 갈라라 —
 *        양성대조의 앵커를 지우는 변이는 «하네스가 부서진 것»이지 계약이 문 것이 아니다.
 *        그래서 loadMutant 는 못 찾으면 «하네스가 부서졌다»라고 대놓고 말한다.
 *
 * ★이 파일의 규율 — 「양성대조 없는 통과는 통과가 아니다」
 *   각 test 머리에 «이 변이를 넣으면 이 검사가 빨개진다»를 적었고, 전부 실제로 돌려서 확인했다.
 *   그리고 격자 검사는 «훑은 칸 수»를 먼저 단언한다 — 표가 비면 루프가 0바퀴로 자기통과한다.
 *
 * ★자(尺)는 «구현을 안 빌린다»
 *   꼭짓점·실루엣·둘레를 구현에서 받아 재면 동어반복이다(구현이 틀리면 자도 같이 틀린다).
 *   아래 corners()·silFrom()·overshoot() 는 size·비율·회전만 받아 초등기하로 «다시» 만든다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.resolve(ROOT, 'js/blocks/zoom-geometry.js');

/* ⛔js/**.js 는 이 레포가 "type":"commonjs" 라 node 가 ESM 으로 못 읽는다.
   ⇒ tmp 에 `.mjs` 로 «복사해» 동적 import 한다. 사본이지 흉내가 아니다. */
let _modP = null;
function loadGeom() {
  if (!_modP) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoom-tangent-'));
    const mjs = path.join(dir, 'zoom-geometry.mjs');
    fs.copyFileSync(SRC, mjs);
    _modP = import(pathToFileURL(mjs).href);
  }
  return _modP;
}

/** ★변이판 — 소스를 «치환해서» 따로 물린다. 양성대조를 「말로」가 아니라 «실행»으로 낸다.
 *  ⛔못 찾으면 «하네스가 부서졌다»고 말한다 — 그 빨강은 계약이 문 것이 아니다. */
const _mutCache = new Map();
async function loadMutant(from, to) {
  const key = String(from) + '\u241F' + to;   // ⛔구분자를 «NUL» 로 쓰지 마라 — git 이 소스를 «이진» 으로 보고 diff·blame 이 죽는다
  if (_mutCache.has(key)) return _mutCache.get(key);
  const src = fs.readFileSync(SRC, 'utf8');
  const out = src.replace(from, to);
  assert.notEqual(out, src,
    `★하네스가 부서졌다(계약이 문 것이 아니다) — 양성대조의 앵커를 못 찾았다: ${from}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoom-mutant-'));
  const mjs = path.join(dir, 'zoom-geometry.mjs');
  fs.writeFileSync(mjs, out, 'utf8');
  const p = import(pathToFileURL(mjs).href);
  _mutCache.set(key, p);
  return p;
}
/** 「c·d 를 옛 실루엣으로 되돌린다」 — 여러 검사가 함께 쓰는 대조. */
const OLD_RULE = () => loadMutant(
  /  var c = tangentAt\(outline, a, L, b, sil, 0\);.*\n  var d = tangentAt\(outline, b, L, a, sil, 1\);/,
  '  var c = sil[0];\n  var d = sil[1];');

/* 앱 기본값 — js/blocks/zoom-block.js 의 ZOOM_DEFAULTS 와 «같은 수»다. */
const ST = {
  shape: 'rect', angle: -90, length: 170, spread: 0,
  maxop: 30, curve: 100, narrow: 62, size: 260, rot: 0,
  fill: '#cfd6e0', shadow: 'on', bd: 'off', bdw: 6, bdc: '#ffffff', bdr: 0, w: null, h: null,
};
const RECT_RATIO = 3.5 / 6.5;

/* ── 격자의 축 — ★각 상수 옆에 «전수가 무엇인지»를 적는다 ────────────────────
   한 번 뚫린 자리다: circle 과 w/h 가 빠져 있어서 「9216칸 0건」이 «rect·square·기본크기의
   전수»였을 뿐인데 「전수」처럼 읽혔다. 축을 상수로 뽑아 이름을 붙여 둔다. */
const ROTS    = [...Array(24).keys()].map(i => i * 15);        // 도형 회전 0…345 — 24칸
const ANGS    = [...Array(24).keys()].map(i => -180 + i * 15); // 광원 방향 −180…165 — 24칸
const NARROWS = [0, 25, 50, 62, 75, 95, 99, 100];              // 좁아짐% — 8칸(★끝의 100 이 벼랑)
const SHAPES  = ['rect', 'square', 'circle'];                  // ★프리셋 «셋» — circle 을 빼지 마라
const BDS     = ['off', 'on'];                                 // 테두리 — 접선은 «테두리 포함» 판을 문다
/* ★w/h 덧씌우개 = 사람이 리사이즈 핸들로 끈 크기. «정상 사용»이다. 한 칸도 없으면 안 된다.
     null=파생(size+프리셋 비율) · [300,120]=납작 · [80,400]=길쭉(원이면 반지름 40 으로 «작아진다») */
const WHS     = [null, [300, 120], [80, 400]];

/* ── 자(尺) — 구현을 안 빌린다 ─────────────────────────────────────────────── */
const bwOf = (st) => (st.bd === 'on' ? Math.max(0, Number(st.bdw) || 0) : 0);

/** 반치수(+테두리). ★w/h 가 있으면 «그것이 이긴다» — 구현의 shapeHalf 와 같은 계약을 자가 다시 쓴다. */
function halfOf(st) {
  const bw = bwOf(st);
  const hw = (st.w > 0 ? st.w / 2 : st.size / 2);
  const hh = (st.h > 0 ? st.h / 2 : (st.shape === 'rect' ? st.size / 2 * RECT_RATIO : hw));
  return { hw: hw + bw, hh: (st.shape === 'circle' ? hw : hh) + bw };
}

/** rect/square 의 꼭짓점(+테두리) — size·비율·회전만으로 «다시» 만든다. */
function corners(st) {
  const { hw, hh } = halfOf(st);
  const th = (Number(st.rot) || 0) * Math.PI / 180;
  const co = Math.cos(th), si = Math.sin(th);
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]
    .map(p => ({ x: p[0] * co - p[1] * si, y: p[0] * si + p[1] * co }));
}

/** 선분 p→q 를 기준으로 P 가 «어느 쪽»인가. */
const cross = (p, q, P) => (q.x - p.x) * (P.y - p.y) - (q.y - p.y) * (P.x - p.x);
const dist  = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/**
 * ★자(尺) — 「빔 옆선 «밖»으로 나간 윤곽점」의 최대 깊이(px). 0 이면 아무것도 안 나갔다.
 * 옆선 둘(a→A, b→B). 각 옆선의 «안쪽» = 반대편 끝점이 있는 쪽.
 * ⚠️원은 «점으로 훑지 않는다» — 훑으면 표본 사이로 새고 느리다. 반지름 − 중심~선 거리로 «정확히» 푼다.
 */
function overshoot(st, geo) {
  let worst = 0;
  for (const [P, Q, ref] of [[geo.a, geo.A, geo.B], [geo.b, geo.B, geo.A]]) {
    const len = dist(P, Q);
    if (!(len > 1e-9)) continue;
    const si = Math.sign(cross(P, Q, ref));
    if (si === 0) continue;
    if (st.shape === 'circle') {
      const r = halfOf(st).hw;
      const dc = si * cross(P, Q, { x: 0, y: 0 }) / len;   // 중심이 «안쪽»으로 떨어진 거리
      if (r - dc > 0) worst = Math.max(worst, r - dc);
    } else {
      for (const p of corners(st)) {
        const v = cross(P, Q, p) / len;
        if (Math.sign(v) !== si) worst = Math.max(worst, Math.abs(v));
      }
    }
  }
  return worst;
}

/* ⚠️★버린 자(尺) 하나를 기록해 둔다 — 「빛이 «닿는» 윤곽점만」으로 좁혀 재는 판.
     그럴싸했지만 «갈라지지 않았다»: spread 30 에서 옛 규칙 14.70px · 새 규칙 14.70px 로 같다.
     대조가 안 서는 자는 「고쳤다」를 못 증명한다.
   ⇒ T2·T7 은 «윤곽 전부»를 보는 위 overshoot 하나만 쓴다. 그 자로는 옛 190.19 / 새 14.99 로 갈린다.
   ⛔이걸 다시 만들지 마라 — 통과는 더 잘 나오지만 재는 게 없다. */

/** 도형 «안»인가 — T3 의 잔여가 「광원이 도형 안」인지 가르는 자. */
function insideShape(st, P) {
  if (st.shape === 'circle') return Math.hypot(P.x, P.y) <= halfOf(st).hw + 0.5;
  const poly = corners(st);
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const v = Math.sign(cross(poly[i], poly[(i + 1) % poly.length], P));
    if (v === 0) continue;
    if (s === 0) s = v; else if (v !== s) return false;
  }
  return true;
}

/** ★실루엣 — 「P 에서 중심을 볼 때 각이 «가장 작은/큰» 윤곽점」. 실루엣의 정의 그대로 자가 다시 쓴다. */
function silPoly(pts, P) {
  const base = Math.atan2(-P.y, -P.x);
  let lo = pts[0], hi = pts[0], lv = Infinity, hv = -Infinity;
  for (const p of pts) {
    let q = Math.atan2(p.y - P.y, p.x - P.x) - base;
    while (q > Math.PI) q -= 2 * Math.PI;
    while (q < -Math.PI) q += 2 * Math.PI;
    if (q < lv) { lv = q; lo = p } if (q > hv) { hv = q; hi = p }
  }
  return [lo, hi];
}
function silCircle(st, P) {
  const r = halfOf(st).hw, d = Math.hypot(P.x, P.y);
  if (d <= r + 0.5) return [{ x: 0, y: 0 }, { x: 0, y: 0 }];   // 광원이 원 «안» — 퇴화
  const ph = Math.atan2(P.y, P.x), be = Math.acos(Math.max(-1, Math.min(1, r / d)));
  return [{ x: r * Math.cos(ph - be), y: r * Math.sin(ph - be) },
          { x: r * Math.cos(ph + be), y: r * Math.sin(ph + be) }];
}
const silFrom = (st, P) => (st.shape === 'circle' ? silCircle(st, P) : silPoly(corners(st), P));

/** 두 «선분»이 진짜로 교차하나(끝점 스침은 제외) — 빔이 꼬였는지 재는 자. */
function segCross(p1, p2, p3, p4) {
  const d1 = cross(p3, p4, p1), d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3), d4 = cross(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** 격자를 돈다. cb(st, geo) 를 매 칸에 부른다. 반환 = 돈 칸 수. */
function walk(G, opt, cb) {
  const shapes  = opt.shapes  || SHAPES;
  const narrows = opt.narrows || NARROWS;
  const spreads = opt.spreads || [0];
  const lengths = opt.lengths || [ST.length];
  const bds     = opt.bds     || BDS;
  const whs     = opt.whs     || WHS;
  let n = 0;
  for (const shape of shapes) for (const rot of ROTS) for (const angle of ANGS)
    for (const narrow of narrows) for (const length of lengths)
      for (const spread of spreads) for (const bd of bds) for (const wh of whs) {
        const st = { ...ST, shape, rot, angle, narrow, length, spread, bd,
                     w: wh ? wh[0] : null, h: wh ? wh[1] : null };
        cb(st, G.computeZoomGeometry(st, null)); n++;
      }
  return n;
}
/** 「이 격자는 무엇의 전수인가」를 한 줄로 — 수 옆에 «반드시» 붙인다. */
const N = (o) =>
  `프리셋${(o.shapes || SHAPES).length} × 회전${ROTS.length} × 광원${ANGS.length} × ` +
  `좁아짐${(o.narrows || NARROWS).length} × 길이${(o.lengths || [ST.length]).length} × ` +
  `벌림${(o.spreads || [0]).length} × 테두리${(o.bds || BDS).length} × w·h${(o.whs || WHS).length}`;
const NN = (o) =>
  (o.shapes || SHAPES).length * ROTS.length * ANGS.length * (o.narrows || NARROWS).length *
  (o.lengths || [ST.length]).length * (o.spreads || [0]).length *
  (o.bds || BDS).length * (o.whs || WHS).length;

/* ═══════════════════════════════════════════════════════════════════════════
   T1 — «축 L» 은 정확히 짧은 변의 한가운데다
   ★변이(실행 확인): `var L = lPin || {x:(a.x+b.x)/2, …}` → `var L = lightPoint(…)` ⇒ 끈 격자 전부 빨강
   ⚠️★「자동일 때」만 재면 이 대조가 «안 산다» — 실제로 0/9216 이 나왔다.
     자동이면 a·b 가 광원을 중심으로 대칭이라 mid(a,b) 와 광원이 어차피 같은 점이기 때문이다.
     ⇒ 이 계약이 «일하는 자리»는 사람이 a 를 끈 뒤다. 자동 격자 «와» 끈 격자를 둘 다 잰다.
   ⛔`< ε` 로 봐주지 않는다 — 같은 산식으로 두 번 세는 것이라 «어긋남이 정확히 0»이어야 한다.
   ═══════════════════════════════════════════════════════════════════════════ */
test('T1 mid(a,b) 와 L 이 «정확히» 같다 — 자동일 때도, ★사람이 끈 뒤에도 (어긋남 === 0)', async () => {
  const g = await loadGeom();
  const opt = { lengths: [0, 60, 170, 250, 400, 1200] };
  const n = walk(g, opt, (st, geo) => {
    assert.equal((geo.a.x + geo.b.x) / 2, geo.L.x, `L.x 어긋남 @${JSON.stringify(st)}`);
    assert.equal((geo.a.y + geo.b.y) / 2, geo.L.y, `L.y 어긋남 @${JSON.stringify(st)}`);
  });
  assert.equal(n, NN(opt), `★훑은 칸 = ${n} — 전수는 ${N(opt)} = ${NN(opt)}`);

  /* ★★사람이 a 를 «한쪽으로» 끈 뒤 — 여기가 이 계약이 실제로 일하는 자리다. */
  const pins = [];
  for (const shape of SHAPES) for (const rot of ROTS) for (const angle of ANGS) for (const dx of [-160, 160]) {
    const st = { ...ST, shape, rot, angle, length: 250 };
    const base = g.computeZoomGeometry(st, null);
    const pin = { a: { x: base.a.x + dx, y: base.a.y - dx }, b: { ...base.b } };
    pins.push({ st, pin });
    const geo = g.computeZoomGeometry(st, pin);
    assert.equal((geo.a.x + geo.b.x) / 2, geo.L.x, `끈 뒤 L.x 어긋남 @${shape} rot=${rot} angle=${angle} dx=${dx}`);
    assert.equal((geo.a.y + geo.b.y) / 2, geo.L.y, `끈 뒤 L.y 어긋남 @${shape} rot=${rot} angle=${angle} dx=${dx}`);
  }
  assert.equal(pins.length, 3 * 24 * 24 * 2,
    `★끈 격자 = ${pins.length}칸 — 전수는 프리셋3 × 회전24 × 광원24 × 끈 방향2 = ${3 * 24 * 24 * 2}`);

  /* ★양성대조 — 축을 옛 자리(광원)로 되돌리면 «끈 뒤»에 전부 어긋난다. */
  const bad = await loadMutant(
    'var L = lPin || { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };',
    'var L = lightPoint(st.angle, st.length, 0, 0);');
  let off = 0;
  for (const { st, pin } of pins) {
    const m = bad.computeZoomGeometry(st, pin);
    if (Math.abs((m.a.x + m.b.x) / 2 - m.L.x) + Math.abs((m.a.y + m.b.y) / 2 - m.L.y) > 1e-9) off++;
  }
  assert.equal(off, pins.length,
    `대조가 무의미하다 — 옛 축인데 ${off}/${pins.length} 만 어긋났다(전부여야 한다)`);
});

/* ═══════════════════════════════════════════════════════════════════════════
   T2 — 광원이 도형 «밖»인 격자(length ≥ 250)에서 삐져나간 윤곽점 = 0
   ★변이(실행 확인): tangentAt → 옛 실루엣 ⇒ 수천 칸이 빨개진다
   ═══════════════════════════════════════════════════════════════════════════ */
test('T2 [length 250·400 · ★프리셋 셋 · ★w/h 셋] 빔 옆선 밖으로 나간 윤곽점 = 0', async () => {
  const g = await loadGeom();
  const opt = { lengths: [250, 400] };
  let bad = 0, worst = 0, worstAt = null;
  const n = walk(g, opt, (st, geo) => {
    const v = overshoot(st, geo);
    if (v > 1e-6) { bad++; if (v > worst) { worst = v; worstAt = st; } }
  });
  assert.equal(n, NN(opt), `★훑은 칸 = ${n} — 전수는 ${N(opt)} = ${NN(opt)}`);
  assert.equal(bad, 0,
    `${N(opt)} = ${n}칸: ${bad}칸 삐져나감, 최대 ${worst.toFixed(2)}px @${JSON.stringify(worstAt)}`);

  /* ★양성대조 — 옛 규칙(c·d = 광원 실루엣)으로 되돌리면 수백 건이 난다. */
  const old = await OLD_RULE();
  let oldBad = 0, oldWorst = 0;
  const on = walk(old, { lengths: [250], whs: [null] }, (st, geo) => {
    const v = overshoot(st, geo);
    if (v > 1e-6) { oldBad++; oldWorst = Math.max(oldWorst, v); }
  });
  assert.ok(oldBad > 100,
    `대조가 무의미하다 — 옛 규칙에서도 안 삐져나갔다 (${oldBad}/${on}, 최대 ${oldWorst.toFixed(2)}px)`);
});

/* ═══════════════════════════════════════════════════════════════════════════
   T3 — ★앱 기본 길이(170)에서는 «잔여가 0 이 아니다». 그리고 그 잔여의 «정체»가 하나다.
   ⛔여기에 0 을 쓰면 검사가 거짓이 된다 — 실제로 화면에 보이는 잔여다(shadowVisible=false 는 0건).
   ★잔여는 «전부» 「광원이 도형 안」이다: 회전한 도형의 대각(정사각 260 → 183.8)이 길이 170 보다
     길어서 광원이 도형 «속»에 들어앉는 배치들이다. 그때는 접선이 아예 없다.
   ★★프리셋·w/h 마다 «따로» 센다 — 합쳐서 한 수로 적으면 「어느 축에서 나는지」가 사라진다.
     (한 번 그렇게 적었다가 원과 w/h 가 격자에 «없는» 것을 아무도 못 봤다.)
   ★변이(실행 확인): tangentAt → 옛 실루엣 ⇒ 잔여가 훨씬 커진다
   ═══════════════════════════════════════════════════════════════════════════ */
test('T3 [length 170(앱 기본)] 잔여를 프리셋·w/h 별로 «따로» 세고, ★전부 「광원이 도형 안」임을 못박는다', async () => {
  const g = await loadGeom();
  /* 실측 표 — 칸마다 회전24 × 광원24 × 좁아짐8 × 테두리2 = 9216칸. */
  const 기대 = {
    'rect|null':        0,
    'rect|[300,120]':   0,
    'rect|[80,400]':    1440,   // 40×200 — 대각 204 > 170 ⇒ 광원이 도형 안
    'square|null':      1536,   // 130√2 = 183.8 > 170 ⇒ 회전하면 광원이 도형 안
    'square|[300,120]': 0,      // hw=150 ⇒ 광원 170 이 «밖»
    'square|[80,400]':  1440,
    'circle|null':      0,
    'circle|[300,120]': 0,
    'circle|[80,400]':  0,      // 원은 h 를 안 쓴다 ⇒ 반지름 40, 광원은 늘 «밖»
  };
  let tot = 0, totBad = 0, totIn = 0;
  for (const shape of SHAPES) for (const wh of WHS) {
    let n = 0, bad = 0, lightIn = 0, worst = 0;
    const opt = { shapes: [shape], whs: [wh], lengths: [170] };
    n = walk(g, opt, (st, geo) => {
      const v = overshoot(st, geo);
      if (v <= 1e-6) return;
      bad++; worst = Math.max(worst, v);
      if (insideShape(st, geo.L)) lightIn++;
    });
    assert.equal(n, 9216, `★훑은 칸 = ${n} — 전수는 회전24 × 광원24 × 좁아짐8 × 테두리2 = 9216`);
    const key = `${shape}|${JSON.stringify(wh)}`;
    assert.equal(bad, 기대[key],
      `length=170 ${key} (9216칸): 잔여 ${bad}칸(기대 ${기대[key]}), 최대 ${worst.toFixed(2)}px`);
    assert.equal(lightIn, bad,
      `${key}: 잔여 ${bad}칸 중 ${bad - lightIn}칸이 「광원이 도형 안」이 아니다 — 다른 원인이 섞였다`);
    tot += n; totBad += bad; totIn += lightIn;
  }
  assert.equal(tot, 82944, `★합계 격자 = ${tot} — 전수는 프리셋3 × w·h3 × 9216 = 82944`);
  assert.equal(totBad, 4416, `합계 잔여 ${totBad} (기대 4416)`);
  assert.equal(totIn, totBad, '★잔여 전부가 「광원이 도형 안」이어야 한다');
  assert.ok(totBad > 0, '★잔여를 0 이라고 적으면 검사가 거짓이 된다 — 화면에 실제로 보인다');

  /* ★옛 판의 소격자(rect·square · 테두리 off · 기본 크기)도 그대로 둔다 — 768.
     이 수가 살아 있어야 「격자를 넓히면서 옛 계약을 흘리지 않았다」가 보인다. */
  {
    const opt = { shapes: ['rect', 'square'], bds: ['off'], whs: [null], lengths: [170] };
    let bad = 0, vis = 0;
    const n = walk(g, opt, (st, geo) => {
      if (!g.shadowVisible(st, geo)) vis++;
      if (overshoot(st, geo) > 1e-6) bad++;
    });
    assert.equal(n, 9216, `옛 소격자 = ${n}칸 — ${N(opt)}`);
    assert.equal(bad, 768, `옛 소격자(rect·square · 테두리 off · 기본 크기, 9216칸) 잔여 ${bad}`);
    assert.equal(vis, 0, '★잔여가 «안 그려서» 안 보이는 것이 아님을 못박는다');
  }

  /* ★양성대조 — 옛 규칙이면 같은 소격자에서 잔여가 크게 커진다. */
  const old = await OLD_RULE();
  let oldBad = 0;
  walk(old, { shapes: ['rect', 'square'], bds: ['off'], whs: [null], lengths: [170] },
       (st, geo) => { if (overshoot(st, geo) > 1e-6) oldBad++; });
  assert.ok(oldBad > 768 * 2,
    `대조가 무의미하다 — 옛 규칙의 잔여(${oldBad})가 새 규칙(768)보다 크게 나쁘지 않다`);
});

/* ═══════════════════════════════════════════════════════════════════════════
   ★T4 — 좁아짐 100% 의 «벼랑». 셋을 잰다.
     (i)   줌 이펙트가 통째로 사라지지 «않는다»
     (ii)  ★처방이 «착지한 점»이 어느 쪽인지 — 좌표로 못박는다
     (iii) 원에서 이펙트가 사라지는 것은 「광원이 원 «안»」일 때, 그때뿐이다
   ★변이(전부 실행 확인)
     · `if (sg === 0) return sil[which];` 삭제        ⇒ (i) 가 1152/1152 사라짐으로 빨강
     · tangentAt 첫 줄에 `which = 1 - which;`         ⇒ ★(ii) 가 20736/20736 으로 빨강
       ⛔(i) 는 이 변이에 «초록»이다 — (i) 가 처방 뒤에 거는 단언이 |B−A| > 1 하나뿐인데
         좌우를 맞바꿔도 그 거리는 그대로다. ⇒ 거리만으로는 맞바꿈을 못 잡는다. 좌표로 못박아야 한다.
     · shapeHalf 의 w 덧씌우개 무시                    ⇒ (ii) 가 13824/20736 으로 빨강
     · silhouetteCircle 퇴화 문턱 `r+0.5` → `r+50`     ⇒ (iii) 이 빨강
   ═══════════════════════════════════════════════════════════════════════════ */
test('T4 ★좁아짐 100% — 사라지지 않고, ★착지한 점이 «어느 쪽인지»까지 맞다', async () => {
  const g = await loadGeom();

  // (i) 사라지지 않는다
  for (const narrow of [0, 50, 95, 99, 100]) {
    const opt = { narrows: [narrow], lengths: [250] };
    let gone = 0;
    const n = walk(g, opt, (st, geo) => { if (!g.shadowVisible(st, geo)) gone++; });
    assert.equal(n, NN(opt), `★훑은 칸 = ${n} — 전수는 ${N(opt)} = ${NN(opt)}`);
    assert.equal(gone, 0, `length=250 narrow=${narrow} (${n}칸): 사라짐 ${gone}/${n}`);
  }

  /* ★★(ii) 착지한 «점»을 좌표로. narrow 100 ⇒ a==b==L 이라 cross 가 «정확히» 0 이고 처방이 탄다.
     그때 c 는 광원 실루엣의 «0번», d 는 «1번» 이어야 한다 — 검사 자기 자로 다시 만든 실루엣과 대조. */
  {
    const opt = { narrows: [100], lengths: [250, 400] };
    let bad = 0, worst = 0, at = null;
    const n = walk(g, opt, (st, geo) => {
      const s = silFrom(st, geo.L);
      const e = Math.max(dist(geo.A, s[0]), dist(geo.B, s[1]));
      if (e > 1e-9) { bad++; if (e > worst) { worst = e; at = st; } }
    });
    assert.equal(n, NN(opt), `★훑은 칸 = ${n} — 전수는 ${N(opt)} = ${NN(opt)}`);
    assert.equal(bad, 0,
      `${N(opt)} = ${n}칸: 착지점이 ${bad}칸에서 어긋났다(최대 ${worst.toFixed(2)}px) @${JSON.stringify(at)}`);
    // ⛔거리만 보는 옛 단언도 남긴다 — «이것만으론 부족하다»는 기록이다
    const one = g.computeZoomGeometry({ ...ST, length: 250, narrow: 100 }, null);
    assert.ok(dist(one.A, one.B) > 1, 'narrow 100 에서 c·d 가 한 점으로 붙었다 — 처방이 안 걸렸다');
  }

  /* (iii) ★원 — 사라지는 것은 「광원이 원 안(d ≤ r+0.5)」일 때, «그때뿐»이다.
     퇴화 문턱을 넉넉하게 잡으면(예: r+50) «가까이만 가도» 이펙트가 통째로 사라진다. */
  {
    let n = 0, gone = 0, mismatch = 0;
    for (const rot of ROTS) for (const angle of ANGS) for (const length of [140, 150, 170, 200])
      for (const bd of BDS) for (const wh of [null, [300, 120]]) for (const narrow of [0, 62, 100]) {
        const st = { ...ST, shape: 'circle', rot, angle, narrow, length, bd,
                     w: wh ? wh[0] : null, h: wh ? wh[1] : null };
        const geo = g.computeZoomGeometry(st, null); n++;
        const isGone = !g.shadowVisible(st, geo);
        const lightIn = Math.hypot(geo.L.x, geo.L.y) <= halfOf(st).hw + 0.5;
        if (isGone) gone++;
        if (isGone !== lightIn) mismatch++;
      }
    assert.equal(n, 27648,
      `★훑은 칸 = ${n} — 전수는 회전24 × 광원24 × 길이4(140·150·170·200) × 테두리2 × w·h2 × 좁아짐3 = 27648`);
    assert.equal(gone, 6912, `원 격자(27648칸) 사라짐 ${gone} (기대 6912 = w·h [300,120] 에서 반지름 150 > 길이 140·150)`);
    assert.equal(mismatch, 0,
      `★「사라짐 ⟺ 광원이 원 안」이 ${mismatch}칸에서 깨졌다 — 가까이만 가도 사라지면 그건 결함이다`);
    assert.ok(gone > 0 && gone < n, '전제: 사라지는 칸과 안 사라지는 칸이 «둘 다» 있다');
  }

  /* ★양성대조 — 처방 줄을 지우면 narrow 100 이 «전부» 사라진다. 99 에서는 멀쩡하다(벼랑이지 비탈이 아니다). */
  const bad = await loadMutant(/\n\s*if \(sg === 0\) return sil\[which\];[^\n]*\n/, '\n');
  const opt = { narrows: [100], lengths: [250], shapes: ['rect', 'square'], whs: [null] };
  let gone = 0;
  const n = walk(bad, opt, (st2, geo2) => { if (!bad.shadowVisible(st2, geo2)) gone++; });
  assert.equal(gone, n, `대조가 무의미하다 — 처방을 지웠는데 ${gone}/${n} 만 사라졌다(전부여야 한다)`);
  let gone99 = 0;
  walk(bad, { ...opt, narrows: [99] }, (st2, geo2) => { if (!bad.shadowVisible(st2, geo2)) gone99++; });
  assert.equal(gone99, 0, '★99 에서도 사라지면 「슬라이더 끝의 벼랑」이라는 진단이 틀린 것이다');

  /* ★★그리고 «착지 쪽을 맞바꾸는» 변이 — 위 대조는 이걸 못 잡는다(거리가 그대로라서). (ii) 가 잡는다. */
  const swap = await loadMutant(
    'export function tangentAt(outline, P, L, other, sil, which) {',
    'export function tangentAt(outline, P, L, other, sil, which) {\n  which = 1 - which;');
  let swapBad = 0;
  const sn = walk(swap, { narrows: [100], lengths: [250, 400] }, (st, geo) => {
    const s = silFrom(st, geo.L);
    if (Math.max(dist(geo.A, s[0]), dist(geo.B, s[1])) > 1e-9) swapBad++;
  });
  assert.equal(swapBad, sn,
    `대조가 무의미하다 — 착지 쪽을 맞바꿨는데 ${swapBad}/${sn} 만 어긋났다(전부여야 한다)`);
});

/* ═══════════════════════════════════════════════════════════════════════════
   T5 — 빔이 «안 꼬인다». 옆선 a→c 와 b→d 가 선분으로 만나면 사다리꼴이 나비넥타이가 된다.
   ★규모를 적는다: 벌림 0 에서만이다. 벌리기를 크게 주면 «되접힘»으로 실제로 꼬인다(T7 참조) —
     그건 현빈이 승인한 동작이지 결함이 아니다.
   ★변이(실행 확인): 축을 mid(a,b) → 고정 광원으로 되돌리면 «끈» 배치에서 꼬인다
   ═══════════════════════════════════════════════════════════════════════════ */
test('T5 [벌림 0] 빔이 안 꼬인다 — 옆선 둘이 선분으로 안 만난다', async () => {
  const g = await loadGeom();
  const opt = { lengths: [170, 250, 400] };
  let twist = 0, at = null;
  const n = walk(g, opt, (st, geo) => {
    if (segCross(geo.a, geo.A, geo.b, geo.B)) { twist++; at = at || { ...st }; }
  });
  assert.equal(n, NN(opt), `★훑은 칸 = ${n} — 전수는 ${N(opt)} = ${NN(opt)}`);
  assert.equal(twist, 0, `${N(opt)} = ${n}칸 중 ${twist}칸이 꼬였다 @${JSON.stringify(at)}`);

  /* ★양성대조 — 사람이 a 를 «한쪽으로» 끌었을 때. 축이 따라오면 안 꼬이고, 광원에 붙박이면 꼬인다. */
  const bad = await loadMutant(
    'var L = lPin || { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };',
    'var L = lightPoint(st.angle, st.length, 0, 0);');
  let twisted = 0, tried = 0;
  for (const rot of ROTS) for (const angle of ANGS) for (const dx of [-260, -160, 160, 260]) {
    const st = { ...ST, rot, angle, length: 250 };
    const base = g.computeZoomGeometry(st, null);
    const pin = { a: { x: base.a.x + dx, y: base.a.y + dx }, b: { ...base.b } };
    tried++;
    const bg = bad.computeZoomGeometry(st, pin);
    if (segCross(bg.a, bg.A, bg.b, bg.B)) twisted++;
    const gg = g.computeZoomGeometry(st, pin);
    assert.equal(segCross(gg.a, gg.A, gg.b, gg.B), false,
      `새 규칙인데 꼬였다 @rot=${rot} angle=${angle} dx=${dx}`);
  }
  assert.ok(twisted > 0, `대조가 무의미하다 — 축을 광원에 붙박아도 안 꼬였다(${twisted}/${tried})`);
});

/* ═══════════════════════════════════════════════════════════════════════════
   T7 — 벌리기가 «여전히 돈다»
   ★벌리기는 c·d 를 도형 «둘레»를 타고 빛을 등진 쪽으로 미끄러뜨린다(현빈 2026-09-08 「계속 둬」).
     ⇒ c 가 도형 «뒤»로 넘어가면 옆선 a→c 는 도형을 «가로지를 수밖에 없다».
       그래서 「벌린 뒤에도 삐져나감 0」은 «어떤 접선 규칙으로도 불가능»하다 — 벌리기 명세와 모순이다.
     ⇒ 여기서 못박는 것은 둘이다:
        ⑴ 원리 상한 — 삐져나감이 «걸어간 거리 + 걸림 창»(s/2 + 2·ZOOM_DETENT_W)을 안 넘는다.
           (걸림(마그네틱)이 걸음을 창 폭만큼 앞뒤로 흔들기 때문에 s/2 «만»으로는 상한이 아니다 — 실측으로 알았다)
        ⑵ ★래칫 — 격자별 «실측 최댓값»을 리터럴로 박는다. 한쪽으로만 재면 값을 까먹어도 초록이다.
           그래서 ±0.01px «양쪽»으로 못박는다.
   ★꼬임도 여기서 규모를 적는다 — spread 240 의 8074칸은 대부분 「F(먼 호)를 지난 되접힘」이다.
     (원 w=80 ⇒ 반지름 40, 둘레 251 인데 240 을 걸으면 한 바퀴에 가깝다)
   ★변이(실행 확인): tangentAt → 옛 실루엣 ⇒ spread 30 에서 원리 상한(63px)을 깬다
   ═══════════════════════════════════════════════════════════════════════════ */
test('T7 벌리기가 여전히 돈다 — 원리 상한 + ★실측 래칫(양쪽으로 못박는다)', async () => {
  const g = await loadGeom();
  const W = g.ZOOM_DETENT_W;
  assert.equal(W, 24, '전제: 걸림 창 반폭이 24 다(이 수가 바뀌면 아래 상한도 같이 움직인다)');
  /* 실측 표 — 격자는 프리셋3 × 회전24 × 광원24 × 좁아짐8 × 테두리2 × w·h3 = 82944칸, length 250. */
  const 기대 = { 0: 0, 30: 14.9919, 60: 29.9353, 120: 85.4738, 240: 132.0000 };
  const 기대꼬임 = { 0: 0, 30: 0, 60: 0, 120: 6, 240: 8074 };
  const 기대사라짐 = { 0: 0, 30: 0, 60: 0, 120: 2, 240: 0 };
  for (const spread of [0, 30, 60, 120, 240]) {
    const opt = { lengths: [250], spreads: [spread] };
    let worst = 0, gone = 0, twist = 0, nan = 0;
    const n = walk(g, opt, (st, geo) => {
      if (!g.shadowVisible(st, geo)) gone++;
      if (!g.allFinite([geo.A, geo.B, geo.a, geo.b, geo.L])) nan++;
      if (segCross(geo.a, geo.A, geo.b, geo.B)) twist++;
      worst = Math.max(worst, overshoot(st, geo));
    });
    assert.equal(n, NN(opt), `★훑은 칸 = ${n} — 전수는 ${N(opt)} = ${NN(opt)}`);
    assert.equal(nan, 0, `spread=${spread}: NaN ${nan}칸`);
    // ⑴ 원리 상한
    assert.ok(worst <= spread / 2 + 2 * W + 1e-6,
      `${n}칸 spread=${spread}: 삐져나감 최대 ${worst.toFixed(4)}px > 상한 ${spread / 2 + 2 * W}px (걸어간 거리 ${spread / 2} + 걸림 창 ${2 * W})`);
    // ⑵ ★래칫 — 실측을 «양쪽»으로 못박는다
    assert.ok(Math.abs(worst - 기대[spread]) < 0.01,
      `★래칫: spread=${spread} 의 실측 최댓값이 ${worst.toFixed(4)}px 다(박아 둔 값 ${기대[spread]}). ` +
      `기하를 «일부러» 고쳤다면 이 표를 새 실측으로 갱신하고, 아니면 회귀다`);
    assert.equal(twist, 기대꼬임[spread],
      `spread=${spread}: 꼬인 칸 ${twist} (박아 둔 값 ${기대꼬임[spread]} — 큰 벌림의 꼬임은 「F 를 지난 되접힘」이라 0 이 아니다)`);
    assert.equal(gone, 기대사라짐[spread],
      `spread=${spread}: 줌 이펙트가 사라진 칸 ${gone} (박아 둔 값 ${기대사라짐[spread]} — 벌림이 F 와 «정확히» 맞아 c·d 가 한 점이 되는 자리다)`);
  }
  // ★spread 0 은 «정확히» 0 — 벌리기를 안 걸면 접선이 그대로다(T2 와 같은 말).
  assert.equal(기대[0], 0);

  /* ★양성대조 — 옛 규칙이면 spread 30 에서 이미 원리 상한을 깬다. */
  const old = await OLD_RULE();
  let oldWorst = 0;
  walk(old, { lengths: [250], spreads: [30] }, (st, geo) => {
    oldWorst = Math.max(oldWorst, overshoot(st, geo));
  });
  assert.ok(oldWorst > 30 / 2 + 2 * W,
    `대조가 무의미하다 — 옛 규칙도 spread 30 에서 상한(${30 / 2 + 2 * W}px)을 안 깼다(최대 ${oldWorst.toFixed(2)}px)`);
});

/* ═══════════════════════════════════════════════════════════════════════════
   ★T8 — 「축 «위»에 놓인 후보는 «어느 편도 아니다»」
     같은 편 고르기(filter)의 «정확히 0» 자리다. 처방(sg===0)은 «잡는 쪽 P»만 지키고
     이 자리는 아무도 안 지키고 있었다 — 적대적 검수가 그 틈으로 둘을 뚫었다.
   ★손으로 지은 outline 으로 tangentAt 을 «직접» 부른다 — 격자로는 이 칼날을 못 밟는다
     (정사각형의 꼭짓점이 광원 축 «위»에 정확히 놓이려면 광원 각이 rot±45° 여야 하는데,
      15° 격자에는 그 각이 없다. 실측으로 확인하고 손으로 지었다).
   ★변이(전부 실행 확인)
     · filter 의 Math.sign → `(… > 0 ? 1 : -1)` (0을 −1로 삼킨다) ⇒ ⓑ 가 (-150,0) → (0,100)
     · `const ZERO = {x:0,y:0}` → `{x:1e-12,y:0}`                 ⇒ ⓐ 가 (-150,0) → (0,-100)
     · 동률 기준점 `other` → `P`                                   ⇒ ⓑ 가 (-150,0) → (0,100)
   ═══════════════════════════════════════════════════════════════════════════ */
test('T8 ★축 «위»에 놓인 접점 후보는 «어느 편도 아니다» — 같은 편 고르기에서 빠진다', async () => {
  const g = await loadGeom();
  /* 축 = L→중심 = y축. 삼각형의 꼭짓점 둘이 «그 축 위»에 정확히 놓인다.
     ⇒ crossSide(L, 중심, q) 가 리터럴 0 이 되는 후보가 생긴다. */
  const OUT = { kind: 'poly', pts: [{ x: 0, y: -100 }, { x: 0, y: 100 }, { x: -150, y: 0 }] };
  const L = { x: 0, y: -300 };
  const SENTINEL = [{ x: 9, y: 9 }, { x: 8, y: 8 }];   // 처방으로 새면 «눈에 띄게» 틀린 값

  // 전제 — 축 위 후보의 cross 가 «정확히» 0 이다(부동소수 잔재가 아니다)
  for (const q of [{ x: 0, y: -100 }, { x: 0, y: 100 }]) {
    assert.equal(g.crossSide(L, { x: 0, y: 0 }, q), 0, '전제: 축 위 후보의 cross 가 정확히 0');
  }

  /* ⓐ P 가 축의 «왼쪽»(sg=+1). 후보는 (0,−100)[축 위] 과 (−150,0)[+1].
     축 위 후보가 빠지므로 남는 하나 (−150,0) 이 답이다.
     ⛔ZERO 를 1e-12 로 밀면 (0,−100) 의 부호가 0 → +1 로 «살아나» 동률이 되고, 답이 (0,−100) 으로 바뀐다. */
  assert.deepEqual(
    g.tangentAt(OUT, { x: -40, y: -300 }, L, { x: -600, y: 0 }, SENTINEL, 0),
    { x: -150, y: 0 },
    '★ⓐ 축 위 후보가 «살아나» 동률이 됐다 — 0 을 어느 편으로도 세면 안 된다');

  /* ⓑ P 가 축의 «오른쪽»(sg=−1). 후보는 (0,100)[축 위] 과 (−150,0)[+1].
     같은 편이 «하나도 없어» 동률 가지로 간다 ⇒ «상대(other)에서 먼» 쪽 = (−150,0).
     ⛔0 을 −1 로 삼키면 (0,100) 이 「같은 편」이 되어 답이 (0,100).
     ⛔동률 기준점을 other 대신 P 로 두어도 답이 (0,100). */
  assert.deepEqual(
    g.tangentAt(OUT, { x: 40, y: -300 }, L, { x: 500, y: -300 }, SENTINEL, 0),
    { x: -150, y: 0 },
    '★ⓑ 0 을 한쪽 편으로 삼켰거나, 동률 기준점이 «상대»가 아니다');

  /* ★양성대조 셋 — 실제로 물려 본다. */
  const swallow0 = await loadMutant(
    'var same = two.filter(function (q) { return Math.sign(crossSide(L, ZERO, q)) === sg; });',
    'var same = two.filter(function (q) { return (crossSide(L, ZERO, q) > 0 ? 1 : -1) === sg; });');
  assert.deepEqual(swallow0.tangentAt(OUT, { x: 40, y: -300 }, L, { x: 500, y: -300 }, SENTINEL, 0),
    { x: 0, y: 100 }, '대조가 무의미하다 — 0 을 삼켜도 답이 안 바뀌었다');

  const movedZero = await loadMutant('const ZERO = { x: 0, y: 0 };', 'const ZERO = { x: 1e-12, y: 0 };');
  assert.deepEqual(movedZero.tangentAt(OUT, { x: -40, y: -300 }, L, { x: -600, y: 0 }, SENTINEL, 0),
    { x: 0, y: -100 }, '대조가 무의미하다 — 축의 기준점을 밀어도 답이 안 바뀌었다');

  const byP = await loadMutant(
    'return _dist(two[0], other) > _dist(two[1], other) ? two[0] : two[1];',
    'return _dist(two[0], P) > _dist(two[1], P) ? two[0] : two[1];');
  assert.deepEqual(byP.tangentAt(OUT, { x: 40, y: -300 }, L, { x: 500, y: -300 }, SENTINEL, 0),
    { x: 0, y: 100 }, '대조가 무의미하다 — 동률 기준점을 바꿔도 답이 안 바뀌었다');
});

/* ═══════════════════════════════════════════════════════════════════════════
   ★T9 — 동률 가지의 «기준점»은 상대 점(other) 이다
     둘 다 같은 편(또는 둘 다 아닌 편)이면 고를 수가 없다. 그때 「상대에서 «먼» 쪽」을 고른다 —
     그래야 빔이 «넓게 열린다». 가까운 쪽을 고르면 두 옆선이 서로를 향해 오므라든다.
   ★이 가지는 장식이 아니다 — 아래 격자에서 6,174번 «실제로» 탄다.
   ★변이(실행 확인)
     · `_dist(two[0], other)` → `_dist(two[0], P)`  ⇒ 위반이 생긴다
     · 부등호 뒤집기(먼 쪽 → 가까운 쪽)              ⇒ 위반이 생긴다
   ═══════════════════════════════════════════════════════════════════════════ */
test('T9 ★동률이면 «상대에서 먼» 쪽을 고른다 — 그 가지를 6,174번 실제로 탄다', async () => {
  const g = await loadGeom();
  /** 그 격자에서 동률 가지를 몇 번 타고, 「먼 쪽」이 몇 번 깨지나. */
  const measure = (G) => {
    let tie = 0, viol = 0, off = 0;
    const opt = { shapes: ['rect', 'square'], lengths: [170, 250, 400] };
    const n = walk(G, opt, (st, geo) => {
      for (const [P, pick, other] of [[geo.a, geo.A, geo.b], [geo.b, geo.B, geo.a]]) {
        const sg = Math.sign(cross(geo.L, { x: 0, y: 0 }, P));
        if (sg === 0) continue;                       // 처방 자리는 T4·T8 이 본다
        const two = silFrom(st, P);
        const same = two.filter(q => Math.sign(cross(geo.L, { x: 0, y: 0 }, q)) === sg);
        if (same.length === 1) continue;              // 동률이 아니다
        tie++;
        const i = dist(pick, two[0]) < 1e-9 ? 0 : (dist(pick, two[1]) < 1e-9 ? 1 : -1);
        if (i < 0) { off++; continue; }               // 후보 둘 중 어느 것도 아니다 = 더 큰 결함
        if (dist(pick, other) + 1e-9 < dist(two[1 - i], other)) viol++;
      }
    });
    return { n, tie, viol, off };
  };
  const got = measure(g);
  assert.equal(got.n, NN({ shapes: ['rect', 'square'], lengths: [170, 250, 400] }),
    `★훑은 칸 = ${got.n} — 전수는 ${N({ shapes: ['rect', 'square'], lengths: [170, 250, 400] })}`);
  assert.equal(got.tie, 6174,
    `★동률 가지를 ${got.tie}번 탔다(박아 둔 값 6174) — 0 이면 아래 단언이 «0바퀴»로 자기통과한다`);
  assert.equal(got.off, 0, `고른 점이 접점 후보 둘 중 어느 것도 아니다 — ${got.off}건`);
  assert.equal(got.viol, 0, `「상대에서 먼 쪽」이 ${got.viol}번 깨졌다`);

  /* ★양성대조 둘 — 기준점을 P 로 바꾸거나 부등호를 뒤집으면 위반이 «실제로» 생긴다. */
  for (const [nm, from, to] of [
    ['기준점을 P 로', 'return _dist(two[0], other) > _dist(two[1], other) ? two[0] : two[1];',
                      'return _dist(two[0], P) > _dist(two[1], P) ? two[0] : two[1];'],
    ['가까운 쪽으로',  '_dist(two[0], other) > _dist(two[1], other)',
                      '_dist(two[0], other) < _dist(two[1], other)'],
  ]) {
    const bad = await loadMutant(from, to);
    const r = measure(bad);
    assert.ok(r.viol > 0, `대조가 무의미하다 — «${nm}» 로 바꿔도 위반이 0 이다 (동률 ${r.tie}번)`);
  }
});
