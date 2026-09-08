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
 * ★이 파일의 규율 — 「양성대조 없는 통과는 통과가 아니다」
 *   각 test 첫 줄 주석에 «이 변이를 넣으면 이 검사가 빨개진다»를 적었다. 전부 실제로 돌려서 확인했다.
 *   그리고 격자 검사는 «훑은 칸 수»를 먼저 단언한다 — 표가 비면 루프가 0바퀴로 자기통과한다.
 *
 * ★자(尺)는 «구현을 안 빌린다»
 *   도형 꼭짓점을 shapeCornerPts 로 받아 재면 동어반복이다(구현이 틀리면 자도 같이 틀린다).
 *   아래 corners() 는 size·비율·회전만으로 초등기하로 다시 만든다.
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

/** ★변이판 — 소스를 «치환해서» 따로 물린다. 양성대조를 「말로」가 아니라 «실행»으로 낸다. */
async function loadMutant(from, to) {
  const src = fs.readFileSync(SRC, 'utf8');
  const out = src.replace(from, to);
  assert.notEqual(out, src, `변이가 안 걸렸다 — 대상을 놓쳤다: ${from}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoom-mutant-'));
  const mjs = path.join(dir, 'zoom-geometry.mjs');
  fs.writeFileSync(mjs, out, 'utf8');
  return import(pathToFileURL(mjs).href);
}

/* 앱 기본값 — js/blocks/zoom-block.js 의 ZOOM_DEFAULTS 와 «같은 수»다. */
const ST = {
  shape: 'rect', angle: -90, length: 170, spread: 0,
  maxop: 30, curve: 100, narrow: 62, size: 260, rot: 0,
  fill: '#cfd6e0', shadow: 'on', bd: 'off', bdw: 6, bdc: '#ffffff', bdr: 0,
};
const RECT_RATIO = 3.5 / 6.5;

/* ── 자(尺) — 구현을 안 빌린다 ─────────────────────────────────────────────── */

/** rect/square 의 꼭짓점(+테두리). size·비율·회전만으로 «다시» 만든다. */
function corners(st) {
  const bw = st.bd === 'on' ? Math.max(0, Number(st.bdw) || 0) : 0;
  const hw = st.size / 2 + bw;
  const hh = (st.shape === 'rect' ? st.size / 2 * RECT_RATIO : st.size / 2) + bw;
  const th = (Number(st.rot) || 0) * Math.PI / 180;
  const co = Math.cos(th), si = Math.sin(th);
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]
    .map(p => ({ x: p[0] * co - p[1] * si, y: p[0] * si + p[1] * co }));
}

/** 원판 윤곽을 촘촘히(720점). 원은 꼭짓점이 없어 «점으로» 잰다. */
function circlePts(st) {
  const bw = st.bd === 'on' ? Math.max(0, Number(st.bdw) || 0) : 0;
  const r = st.size / 2 + bw, out = [];
  for (let i = 0; i < 720; i++) { const t = i / 720 * 2 * Math.PI; out.push({ x: r * Math.cos(t), y: r * Math.sin(t) }); }
  return out;
}
const outlinePts = (st) => (st.shape === 'circle' ? circlePts(st) : corners(st));

/** 선분 p→q 를 기준으로 P 가 «어느 쪽»인가. */
const cross = (p, q, P) => (q.x - p.x) * (P.y - p.y) - (q.y - p.y) * (P.x - p.x);

/**
 * ★자(尺) — 「빔 옆선 «밖»으로 나간 윤곽점」의 최대 깊이(px). 0 이면 아무것도 안 나갔다.
 * 옆선 둘(a→A, b→B). 각 옆선의 «안쪽» = 반대편 끝점이 있는 쪽.
 */
function overshoot(st, geo, pts) {
  let worst = 0;
  for (const [P, Q, ref] of [[geo.a, geo.A, geo.B], [geo.b, geo.B, geo.A]]) {
    const len = Math.hypot(Q.x - P.x, Q.y - P.y);
    if (!(len > 1e-9)) continue;
    const si = Math.sign(cross(P, Q, ref));
    if (si === 0) continue;
    for (const p of pts) {
      const v = cross(P, Q, p) / len;
      if (Math.sign(v) !== si) worst = Math.max(worst, Math.abs(v));
    }
  }
  return worst;
}

/* ⚠️★버린 자(尺) 하나를 기록해 둔다 — 「빛이 «닿는» 윤곽점만」으로 좁혀 재는 판.
     그럴싸했지만 «갈라지지 않았다»: spread 30 에서 옛 규칙 14.70px · 새 규칙 14.70px 로 같다.
     대조가 안 서는 자는 「고쳤다」를 못 증명한다.
   ⇒ T2·T7 은 «윤곽점 전부»를 보는 위 overshoot 하나만 쓴다. 그 자로는 옛 190.19 / 새 14.99 로 갈린다.
   ⛔이걸 다시 만들지 마라 — 통과는 더 잘 나오지만 재는 게 없다. */

/** 볼록 다각형 «안»인가 — T3 의 잔여가 「광원이 도형 안」인지 가르는 자. */
function insideConvex(P, poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const v = Math.sign(cross(poly[i], poly[(i + 1) % poly.length], P));
    if (v === 0) continue;
    if (s === 0) s = v; else if (v !== s) return false;
  }
  return true;
}

/** 두 «선분»이 진짜로 교차하나(끝점 스침은 제외) — 빔이 꼬였는지 재는 자. */
function segCross(p1, p2, p3, p4) {
  const d1 = cross(p3, p4, p1), d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3), d4 = cross(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/* ── 격자 — ★수를 적을 땐 «어느 격자에서 잰 것인지»를 그 수 옆에 붙인다 ────── */
const ROTS = [...Array(24).keys()].map(i => i * 15);        // 0…345, 24칸
const ANGS = [...Array(24).keys()].map(i => -180 + i * 15); // −180…165, 24칸
const NARROWS = [0, 25, 50, 62, 75, 95, 99, 100];
const SHAPES = ['rect', 'square'];

/** 격자를 돈다. cb(st, geo) 를 매 칸에 부른다. 반환 = 돈 칸 수. */
function walk(G, opt, cb) {
  const shapes = opt.shapes || SHAPES;
  const narrows = opt.narrows || NARROWS;
  const spreads = opt.spreads || [0];
  let n = 0;
  for (const shape of shapes) for (const rot of ROTS) for (const angle of ANGS)
    for (const narrow of narrows) for (const spread of spreads) {
      const st = { ...ST, shape, rot, angle, narrow, spread, length: opt.length, bd: opt.bd || 'off' };
      cb(st, G.computeZoomGeometry(st, null)); n++;
    }
  return n;
}

/* ═══════════════════════════════════════════════════════════════════════════
   T1 — «축 L» 은 정확히 짧은 변의 한가운데다
   ★변이: computeZoomGeometry 의 `var L = lPin || { x: (a.x + b.x) / 2 … }` 를
          `var L = lightPoint(st.angle, st.length, 0, 0)` 로 되돌리면 빨개진다 (실행으로 확인)
   ⚠️★「자동일 때」만 재면 이 대조가 «안 산다» — 실제로 0/9216 이 나왔다.
     자동이면 a·b 가 광원을 중심으로 대칭이라 mid(a,b) 와 광원이 어차피 같은 점이기 때문이다.
     ⇒ 이 계약이 «일하는 자리»는 사람이 a 를 끈 뒤다. 그래서 자동 격자 «와» 끈 격자를 둘 다 잰다.
       (끈 격자에서 변이는 1152/1152 어긋난다 — 실행으로 확인)
   ⛔`< ε` 로 봐주지 않는다 — 같은 산식으로 두 번 세는 것이라 «어긋남이 정확히 0»이어야 한다.
   ═══════════════════════════════════════════════════════════════════════════ */
test('T1 mid(a,b) 와 L 이 «정확히» 같다 — 자동일 때도, ★사람이 끈 뒤에도 (어긋남 === 0)', async () => {
  const g = await loadGeom();
  let n = 0;
  for (const length of [0, 60, 170, 250, 400, 1200]) {
    n += walk(g, { length, shapes: ['rect', 'square', 'circle'] }, (st, geo) => {
      assert.equal((geo.a.x + geo.b.x) / 2, geo.L.x, `L.x 어긋남 @${JSON.stringify(st)}`);
      assert.equal((geo.a.y + geo.b.y) / 2, geo.L.y, `L.y 어긋남 @${JSON.stringify(st)}`);
    });
  }
  assert.equal(n, 6 * 3 * 24 * 24 * 8, `훑은 칸 = ${n} (길이6 × 프리셋3 × 회전24 × 광원24 × 좁아짐8)`);

  /* ★★사람이 a 를 «한쪽으로» 끈 뒤 — 여기가 이 계약이 실제로 일하는 자리다. */
  const pins = [];
  for (const rot of ROTS) for (const angle of ANGS) for (const dx of [-160, 160]) {
    const st = { ...ST, rot, angle, length: 250 };
    const base = g.computeZoomGeometry(st, null);
    const pin = { a: { x: base.a.x + dx, y: base.a.y - dx }, b: { ...base.b } };
    pins.push({ st, pin });
    const geo = g.computeZoomGeometry(st, pin);
    assert.equal((geo.a.x + geo.b.x) / 2, geo.L.x, `끈 뒤 L.x 어긋남 @rot=${rot} angle=${angle} dx=${dx}`);
    assert.equal((geo.a.y + geo.b.y) / 2, geo.L.y, `끈 뒤 L.y 어긋남 @rot=${rot} angle=${angle} dx=${dx}`);
  }
  assert.equal(pins.length, 24 * 24 * 2, `끈 격자 = ${pins.length}칸 (회전24 × 광원24 × 끈 방향2)`);

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
   ★변이: tangentAt 을 「옛 실루엣」(= 광원에서 잰 c·d)으로 되돌리면 2,784/9,216 이 빨개진다.
   ═══════════════════════════════════════════════════════════════════════════ */
test('T2 [length 250·400 격자] 빔 옆선 밖으로 나간 윤곽점 = 0', async () => {
  const g = await loadGeom();
  for (const length of [250, 400]) {
    for (const bd of ['off', 'on']) {
      let bad = 0, worst = 0, worstAt = null;
      const n = walk(g, { length, bd, shapes: ['rect', 'square', 'circle'] }, (st, geo) => {
        const v = overshoot(st, geo, outlinePts(st));
        if (v > 1e-6) { bad++; if (v > worst) { worst = v; worstAt = st; } }
      });
      assert.equal(n, 3 * 24 * 24 * 8, `훑은 칸 = ${n}`);
      assert.equal(bad, 0,
        `length=${length} bd=${bd} 격자(프리셋3 × 회전24 × 광원24 × 좁아짐8 = ${n}칸): ` +
        `${bad}칸 삐져나감, 최대 ${worst.toFixed(2)}px @${JSON.stringify(worstAt)}`);
    }
  }

  /* ★양성대조 — 옛 규칙(c·d = 광원 실루엣)으로 되돌리면 수백 건이 난다. */
  const old = await loadMutant(
    /  var c = tangentAt\(outline, a, L, b, sil, 0\);.*\n  var d = tangentAt\(outline, b, L, a, sil, 1\);/,
    '  var c = sil[0];\n  var d = sil[1];');
  let bad = 0, worst = 0;
  const n = walk(old, { length: 250 }, (st, geo) => {
    const v = overshoot(st, geo, outlinePts(st));
    if (v > 1e-6) { bad++; worst = Math.max(worst, v); }
  });
  assert.ok(bad > 100,
    `대조가 무의미하다 — 옛 규칙에서도 안 삐져나갔다 (${bad}/${n}, 최대 ${worst.toFixed(2)}px)`);
});

/* ═══════════════════════════════════════════════════════════════════════════
   T3 — ★앱 기본 길이(170)에서는 «잔여가 0 이 아니다». 그리고 그 잔여의 «정체»가 하나다.
   ⛔여기에 0 을 쓰면 검사가 거짓이 된다 — 실제로 화면에 보이는 잔여다(shadowVisible=false 는 0건).
   ★잔여는 «전부» 「광원이 도형 안」이다: 회전한 도형의 대각(정사각 260 → 183.8)이 길이 170 보다
     길어서 광원이 도형 «속»에 들어앉는 배치들이다. 그때는 접선이 아예 없다.
   ★변이: tangentAt 을 옛 실루엣으로 되돌리면 잔여가 768 → 3,360 으로 «훨씬» 커진다.
   ═══════════════════════════════════════════════════════════════════════════ */
test('T3 [length 170(앱 기본) 격자] 잔여는 96·768 이고, ★전부 「광원이 도형 안」이다', async () => {
  const g = await loadGeom();

  // ⑴ 기본 좁아짐(62) 한 칸만 — 실측 96/1152
  {
    let bad = 0, lightIn = 0, worst = 0, notIn = [];
    const n = walk(g, { length: 170, narrows: [62] }, (st, geo) => {
      const v = overshoot(st, geo, outlinePts(st));
      if (v <= 1e-6) return;
      bad++; worst = Math.max(worst, v);
      if (insideConvex(geo.L, outlinePts(st))) lightIn++;
      else if (notIn.length < 5) notIn.push({ ...st });
    });
    assert.equal(n, 1152, `훑은 칸 = ${n} (프리셋2 × 회전24 × 광원24 × 좁아짐1)`);
    assert.equal(bad, 96,
      `length=170 narrow=62 격자(1152칸): 잔여 ${bad}칸, 최대 ${worst.toFixed(2)}px`);
    assert.equal(lightIn, bad,
      `잔여 ${bad}칸 중 ${bad - lightIn}칸은 「광원이 도형 안」이 아니다 — 다른 원인이 섞였다: ${JSON.stringify(notIn)}`);
  }

  // ⑵ 좁아짐 여덟 칸 전부 — 실측 768/9216
  {
    let bad = 0, lightIn = 0, worst = 0, invisible = 0;
    const n = walk(g, { length: 170 }, (st, geo) => {
      if (!g.shadowVisible(st, geo)) invisible++;
      const v = overshoot(st, geo, outlinePts(st));
      if (v <= 1e-6) return;
      bad++; worst = Math.max(worst, v);
      if (insideConvex(geo.L, outlinePts(st))) lightIn++;
    });
    assert.equal(n, 9216, `훑은 칸 = ${n} (프리셋2 × 회전24 × 광원24 × 좁아짐8)`);
    assert.ok(bad > 0, '★잔여를 0 이라고 적으면 검사가 거짓이 된다 — 화면에 실제로 보인다');
    assert.equal(bad, 768,
      `length=170 격자(9216칸): 잔여 ${bad}칸, 최대 ${worst.toFixed(2)}px`);
    assert.equal(lightIn, bad, `잔여 ${bad}칸 중 「광원이 도형 안」이 아닌 것 ${bad - lightIn}칸`);
    assert.equal(invisible, 0, '★잔여가 «안 그려서» 안 보이는 것이 아님을 못박는다');
  }

  /* ★양성대조 — 옛 규칙이면 같은 격자에서 잔여가 훨씬 커진다. */
  const old = await loadMutant(
    /  var c = tangentAt\(outline, a, L, b, sil, 0\);.*\n  var d = tangentAt\(outline, b, L, a, sil, 1\);/,
    '  var c = sil[0];\n  var d = sil[1];');
  let oldBad = 0;
  walk(old, { length: 170 }, (st, geo) => { if (overshoot(st, geo, outlinePts(st)) > 1e-6) oldBad++; });
  assert.ok(oldBad > 768 * 2,
    `대조가 무의미하다 — 옛 규칙의 잔여(${oldBad})가 새 규칙(768)보다 크게 나쁘지 않다`);
});

/* ═══════════════════════════════════════════════════════════════════════════
   ★T4 — 좁아짐 100% 에서 «줌 이펙트가 통째로 사라지지» 않는다
   ★변이: tangentAt 의 `if (sg === 0) return sil[which];` 한 줄을 지우면
          narrow=100 격자 1,152칸이 «전부» 사라진다(실행으로 확인 — 1152/1152).
   왜: k=0 ⇒ a==b==L ⇒ cross(L,중심,P)=0 ⇒ 동률 가지에서 «상대»가 자기 자신 ⇒ c==d ⇒
       shadowVisible 이 |d−c|>1e-6 로 걸러 안 그린다. 슬라이더 최대가 100 이라 한 번만 밀면 나온다.
   ═══════════════════════════════════════════════════════════════════════════ */
test('T4 ★좁아짐 100% 에서도 줌 이펙트가 «안 사라진다»', async () => {
  const g = await loadGeom();
  for (const narrow of [0, 50, 95, 99, 100]) {
    let gone = 0;
    const n = walk(g, { length: 250, narrows: [narrow] }, (st, geo) => {
      if (!g.shadowVisible(st, geo)) gone++;
    });
    assert.equal(n, 1152, `훑은 칸 = ${n} (프리셋2 × 회전24 × 광원24)`);
    assert.equal(gone, 0, `length=250 narrow=${narrow} 격자(1152칸): 사라짐 ${gone}/${n}`);
  }
  // 처방의 «착지점»도 못박는다 — sg===0 이면 광원 실루엣으로 떨어진다.
  const st = { ...ST, length: 250, narrow: 100 };
  const geo = g.computeZoomGeometry(st, null);
  assert.ok(Math.hypot(geo.B.x - geo.A.x, geo.B.y - geo.A.y) > 1,
    'narrow 100 에서 c·d 가 한 점으로 붙었다 — 처방이 안 걸렸다');

  /* ★양성대조 — 처방 줄을 지우면 narrow 100 이 «전부» 사라진다. */
  const bad = await loadMutant(
    /\n\s*if \(sg === 0\) return sil\[which\];[^\n]*\n/, '\n');
  let gone = 0;
  const n = walk(bad, { length: 250, narrows: [100] }, (st2, geo2) => {
    if (!bad.shadowVisible(st2, geo2)) gone++;
  });
  assert.equal(gone, n, `대조가 무의미하다 — 처방을 지웠는데 ${gone}/${n} 만 사라졌다(전부여야 한다)`);
  // 그리고 그 변이는 narrow 99 에서는 «멀쩡하다» — 벼랑이지 비탈이 아니다.
  let gone99 = 0;
  walk(bad, { length: 250, narrows: [99] }, (st2, geo2) => { if (!bad.shadowVisible(st2, geo2)) gone99++; });
  assert.equal(gone99, 0, '★99 에서도 사라지면 「슬라이더 끝의 벼랑」이라는 진단이 틀린 것이다');
});

/* ═══════════════════════════════════════════════════════════════════════════
   T5 — 빔이 «안 꼬인다». 옆선 a→c 와 b→d 가 선분으로 만나면 사다리꼴이 나비넥타이가 된다.
   ★변이: 축을 mid(a,b) → 고정 광원으로 되돌리면 꼬이는 배치가 «실제로» 나온다.
   ═══════════════════════════════════════════════════════════════════════════ */
test('T5 빔이 안 꼬인다 — 옆선 둘이 선분으로 안 만난다', async () => {
  const g = await loadGeom();
  let twist = 0, at = null;
  let n = 0;
  for (const length of [170, 250, 400]) {
    n += walk(g, { length, shapes: ['rect', 'square', 'circle'] }, (st, geo) => {
      if (segCross(geo.a, geo.A, geo.b, geo.B)) { twist++; at = at || { ...st }; }
    });
  }
  assert.equal(n, 3 * 3 * 24 * 24 * 8, `훑은 칸 = ${n}`);
  assert.equal(twist, 0, `길이3 × 프리셋3 × 회전24 × 광원24 × 좁아짐8 = ${n}칸 중 ${twist}칸이 꼬였다 @${JSON.stringify(at)}`);

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
    if (segCross(...Object.values(pick(bad.computeZoomGeometry(st, pin))))) twisted++;
    assert.equal(segCross(...Object.values(pick(g.computeZoomGeometry(st, pin)))), false,
      `새 규칙인데 꼬였다 @rot=${rot} angle=${angle} dx=${dx}`);
  }
  assert.ok(twisted > 0, `대조가 무의미하다 — 축을 광원에 붙박아도 안 꼬였다(${twisted}/${tried})`);
});
/** segCross 인자 넷을 순서대로 뽑는다(a,A,b,B). */
function pick(geo) { return { a: geo.a, A: geo.A, b: geo.b, B: geo.B }; }

/* ═══════════════════════════════════════════════════════════════════════════
   T7 — 벌리기가 «여전히 돈다»
   ★벌리기는 c·d 를 도형 «둘레»를 타고 빛을 등진 쪽으로 미끄러뜨린다(현빈 2026-09-08 「계속 둬」).
     ⇒ c 가 도형 «뒤»로 넘어가면 옆선 a→c 는 도형을 «가로지를 수밖에 없다».
       그래서 「벌린 뒤에도 삐져나감 0」은 «어떤 접선 규칙으로도 불가능»하다 — 벌리기 명세와 모순이다.
     ⇒ 여기서 못박는 것은 «접선 규칙이 안 무너진다»는 것이다:
         벌리기가 만든 삐져나감이 «걸어간 거리»(spread/2)를 넘지 않는다.
       spread=0 에서는 정확히 0 이다(그게 T2 다).
   ★변이: tangentAt 을 옛 실루엣으로 되돌리면 spread 30 의 상한(15px)이 실제로 깨진다.
   ═══════════════════════════════════════════════════════════════════════════ */
test('T7 벌리기가 여전히 돈다 — 삐져나감이 «걸어간 거리»(spread/2)를 안 넘는다', async () => {
  const g = await loadGeom();
  const SPREADS = [0, 30, 60, 120, 240];
  const got = {};
  for (const spread of SPREADS) {
    let worst = 0, gone = 0, twist = 0, nan = 0;
    const n = walk(g, { length: 250, spreads: [spread] }, (st, geo) => {
      if (!g.shadowVisible(st, geo)) gone++;
      if (!g.allFinite([geo.A, geo.B, geo.a, geo.b, geo.L])) nan++;
      if (segCross(geo.a, geo.A, geo.b, geo.B)) twist++;
      worst = Math.max(worst, overshoot(st, geo, outlinePts(st)));
    });
    assert.equal(n, 9216, `훑은 칸 = ${n}`);
    assert.equal(nan, 0, `spread=${spread}: NaN ${nan}칸`);
    assert.equal(gone, 0, `spread=${spread}: 줌 이펙트가 사라진 칸 ${gone}`);
    assert.equal(twist, 0, `spread=${spread}: 꼬인 칸 ${twist}`);
    assert.ok(worst <= spread / 2 + 1e-6,
      `length=250 격자(9216칸) spread=${spread}: 삐져나감 최대 ${worst.toFixed(2)}px > 걸어간 거리 ${spread / 2}px`);
    got[spread] = +worst.toFixed(2);
  }
  // ★spread 0 은 «정확히» 0 — 벌리기를 안 걸면 접선이 그대로다.
  assert.equal(got[0], 0, `spread=0 인데 ${got[0]}px 나갔다`);
  // ★나머지는 «0 이 아니다» — 상한이 헐렁해서 통과한 것이 아님을 못박는다(실측: 14.99/29.91/59.27/117.88).
  for (const s of [30, 60, 120, 240]) {
    assert.ok(got[s] > s / 4,
      `spread=${s} 의 실측 삐져나감 ${got[s]}px 가 너무 작다 — 상한 검사가 «헐렁해서» 통과한 것인지 다시 봐라`);
  }

  /* ★양성대조 — 옛 규칙이면 spread 30 에서 이미 상한을 깬다. */
  const old = await loadMutant(
    /  var c = tangentAt\(outline, a, L, b, sil, 0\);.*\n  var d = tangentAt\(outline, b, L, a, sil, 1\);/,
    '  var c = sil[0];\n  var d = sil[1];');
  let oldWorst = 0;
  walk(old, { length: 250, spreads: [30] }, (st, geo) => {
    oldWorst = Math.max(oldWorst, overshoot(st, geo, outlinePts(st)));
  });
  assert.ok(oldWorst > 15,
    `대조가 무의미하다 — 옛 규칙도 spread 30 에서 상한(15px)을 안 깼다(최대 ${oldWorst.toFixed(2)}px)`);
});
