/* radial-arc-geom — 방사형 에셋 블럭 «호 모드»의 상자 기하(js/radial-arc-geom.js) (프로토 · 1013t2A3 V3 → V4 반원 · 2026-10-14)
 * 현빈 원문: 「방사블럭에 호가 왜 잘려있는지? 잘리지 않게 해주고」.
 * 잠그는 것 = «그려지는 것 전부(호 선 · 선 연장 · 선 두께 · 양 끝 항목 · 라벨 · 가운데)가 스테이지 상자 안에 든다».
 * 재는 자리 = 순수 함수 그대로(require). 상자 식을 믿지 않고 «호 위를 0.5° 씩 찍은 점»으로 따로 잰다(AG4).
 *   AG1 등분 각도           AG2 단위원 호 상자        AG3 V2 식이면 데모 호가 위·아래로 28.89px 넘는다(음성대조 기준 수)
 *   AG4 여러 각도 범위 · 반지름 · 폭에서 «호·항목·라벨·가운데 ⊂ 스테이지»      AG5 폭이 모자라면 반지름을 줄인다 · 바닥에서는 fits=false
 *   AG6 원 중심은 «들어올 만큼만» 민다      AG7 라벨 어림      AG8 호 path 꼴      AG9 험한 입력 → NaN 0건
 *   AG10 블럭 렌더가 이 기하를 쓰고 호 스테이지를 자르지 않는다(소스 대조)
 *   AG11 (V3 고침) 바닥 반지름에서도 안 들어가면 — 반지름은 바닥에서 멎고(더 무너뜨리지 않는다) · «호 선 · 항목»만은 폭 안 · 넘치는 쪽은 라벨/가운데 · 블럭이 바닥을 넘긴다
 *   AG12 (V4 반원) 호 모드의 기본 꼴 — 끝점 둘이 왼쪽 변(x = 0) · 지름이 세로(2R) · 가장 오른쪽 x = R · 맞추기가 원 중심을 밀지도 반지름을 줄이지도 않는다
 *        (현빈 「반원 끝점이 왼쪽에 붙어야 … 반원이 되도록」). 같은 칸 안의 대조: V3 호출 꼴(왼쪽 여유 16 · 둥근 끝)이면 원 중심이 17px 밀린다 · 끝 각도 38° 면 끝점이 왼쪽 변에 없다.
 *   AG13 (V4) 끝점을 피한 등분(arcAnglesInset) · 끝이 잘린 선의 상자(lineCap butt) · 가로 여유 따로(padL · padR — 안 주면 예전과 같다) · 블럭이 그 값들을 넘긴다(소스 대조)
 * 전제 단언: 상자를 보기 전에 «찍은 점 수 > 0»을 먼저 본다 — 빈 배열이 통과로 읽히지 않게. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../../js/radial-arc-geom.js');

const rad = (d) => d * Math.PI / 180;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} 기대 ${b} ± ${tol} · 실제 ${a}`);
const EPS = 0.02;   // 좌표를 소수 2자리로 반올림한다

/** 스테이지 좌표에서 «그려지는 것»의 사각형을 하나씩 낸다 — 상자 식(contentBox)을 안 쓰고 따로 센다. */
function drawnRects(spec, f) {
  const out = [];
  const mh = (spec.markerHalf || 0) + (spec.halo || 0), lw = (spec.lineWidth || 0) / 2;
  spec.degs.forEach((d, i) => {
    const x = f.cx + f.R * Math.cos(rad(d)), y = f.cy + f.R * Math.sin(rad(d));
    out.push({ what: `항목 ${i}`, x0: x - mh, x1: x + mh, y0: y - mh, y1: y + mh });
    const l = spec.labels && spec.labels[i];
    if (l) out.push({ what: `라벨 ${i}`, x0: x + l.x0, x1: x + l.x1, y0: y + l.y0, y1: y + l.y1 });
  });
  if (spec.line && spec.line !== 'none' && spec.line !== 'spoke') {
    const lo = Math.min(spec.lineLo, spec.lineHi), hi = Math.min(Math.max(spec.lineLo, spec.lineHi), lo + 360);
    for (let d = lo; d <= hi + 1e-9; d += 0.5) {
      const x = f.cx + f.R * Math.cos(rad(d)), y = f.cy + f.R * Math.sin(rad(d));
      out.push({ what: `호 ${d}°`, x0: x - lw, x1: x + lw, y0: y - lw, y1: y + lw });
    }
  }
  if (spec.line === 'spoke') out.push({ what: '바큇살 중심', x0: f.cx - lw, x1: f.cx + lw, y0: f.cy - lw, y1: f.cy + lw });
  if (spec.center) out.push({ what: '가운데', x0: f.cx + spec.center.x0, x1: f.cx + spec.center.x1, y0: f.cy + spec.center.y0, y1: f.cy + spec.center.y1 });
  return out;
}
function assertInside(spec, f, pad, tag) {
  const rects = drawnRects(spec, f);
  assert.ok(rects.length > 0, `${tag} 전제: 그려지는 것이 있다`);
  const yMax = f.H - pad + 1 + EPS;   // H 는 올림(최대 1px 여유)
  for (const r of rects) {
    if (r.y0 < pad - EPS) assert.fail(`${tag} ${r.what} 위 넘침 ${(pad - r.y0).toFixed(2)}px`);
    if (r.y1 > yMax) assert.fail(`${tag} ${r.what} 아래 넘침 ${(r.y1 - (f.H - pad)).toFixed(2)}px`);
    if (!f.fits) continue;
    if (r.x0 < pad - EPS) assert.fail(`${tag} ${r.what} 왼쪽 넘침 ${(pad - r.x0).toFixed(2)}px`);
    if (r.x1 > f.W - pad + EPS) assert.fail(`${tag} ${r.what} 오른쪽 넘침 ${(r.x1 - (f.W - pad)).toFixed(2)}px`);
  }
  return rects.length;
}
const sideLabels = (n, half, gap, w, h) => Array.from({ length: n }, () => ({ x0: half + gap, x1: half + gap + w, y0: -h / 2, y1: h / 2 }));

/* 선풍기 데모(b67106ab)의 설정 — 가운데 그림은 뺐다 */
const DEMO = { radius: 542, start: -38, end: 38, count: 3, extend: 20, lineWidth: 1.5, dot: 22, gap: 44, labelW: 300, labelH: 163, centerXPct: -11, width: 860 };
function demoSpec() {
  const degs = A.arcAngles(DEMO.count, DEMO.start, DEMO.end);
  const rng = A.lineRange(DEMO.start, DEMO.end, degs, DEMO.extend);
  return { degs, line: 'orbit', lineLo: rng.lo, lineHi: rng.hi, lineWidth: DEMO.lineWidth, markerHalf: DEMO.dot / 2, halo: 5,
    labels: sideLabels(DEMO.count, DEMO.dot / 2, DEMO.gap, DEMO.labelW, DEMO.labelH), center: null };
}

test('AG1 등분 각도 — 양 끝 포함 · 하나면 가운데 · 0개면 []', () => {
  assert.deepEqual(A.arcAngles(3, -38, 38), [-38, 0, 38]);
  assert.deepEqual(A.arcAngles(5, -90, 90), [-90, -45, 0, 45, 90]);
  assert.deepEqual(A.arcAngles(1, -60, 60), [0]);
  assert.deepEqual(A.arcAngles(0, -60, 60), []);
  assert.deepEqual(A.arcAngles(3, 40, -40), [40, 0, -40]);
  assert.deepEqual(A.lineRange(-38, 38, [-38, 0, 52], 20), { lo: -58, hi: 72 });
  assert.deepEqual(A.lineRange(60, -60, [], 0), { lo: -60, hi: 60 });
});

test('AG2 단위원 호 상자 — 끝점과 구간 안의 90° 배수', () => {
  const b = A.sweepBox(-58, 58);
  near(b.maxX, 1, 1e-9, '0° 를 지난다'); near(b.minX, Math.cos(rad(58)), 1e-9, 'minX');
  near(b.minY, -Math.sin(rad(58)), 1e-9, 'minY'); near(b.maxY, Math.sin(rad(58)), 1e-9, 'maxY');
  const h = A.sweepBox(-90, 90);
  near(h.minX, 0, 1e-9, '반원 minX'); near(h.maxX, 1, 1e-9); near(h.minY, -1, 1e-9); near(h.maxY, 1, 1e-9);
  const q = A.sweepBox(-135, 135);
  near(q.minX, Math.cos(rad(135)), 1e-9, '270° minX'); near(q.maxX, 1, 1e-9); near(q.minY, -1, 1e-9); near(q.maxY, 1, 1e-9);
  assert.deepEqual(A.sweepBox(0, 360), { minX: -1, maxX: 1, minY: -1, maxY: 1 });
  assert.deepEqual(A.sweepBox(-200, 400), { minX: -1, maxX: 1, minY: -1, maxY: 1 });
  const s = A.sweepBox(100, 170);   // 90° 배수를 안 지나는 구간
  near(s.maxX, Math.cos(rad(100)), 1e-9); near(s.minX, Math.cos(rad(170)), 1e-9); near(s.maxY, Math.sin(rad(100)), 1e-9); near(s.minY, Math.sin(rad(170)), 1e-9);
});

test('AG3 음성대조 기준 수 — V2 식(높이 = 항목 y 범위 + 여유)이면 데모 호가 위·아래로 28.89px 넘고, V3 은 0', () => {
  const spec = demoSpec();
  // V2(b67106ab radialLayoutOf 호 가지) 를 그대로 옮긴 것
  const ys = spec.degs.map((d) => DEMO.radius * Math.sin(rad(d)));
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const padV = Math.round(Math.max(DEMO.dot / 2, DEMO.labelH / 2) + 16);
  const H2 = Math.round(Math.max(maxY - minY + 2 * padV, 580 + 24));
  const cy2 = (H2 - (maxY - minY)) / 2 - minY;
  assert.equal(H2, 863, 'V2 스테이지 높이');
  const top2 = cy2 - DEMO.radius * Math.sin(rad(58)) - DEMO.lineWidth / 2;
  const bot2 = cy2 + DEMO.radius * Math.sin(rad(58)) + DEMO.lineWidth / 2;
  near(-top2, 28.89, 0.01, 'V2 위 넘침');
  near(bot2 - H2, 28.89, 0.01, 'V2 아래 넘침');
  // V3
  const f = A.fit(spec, { radius: DEMO.radius, width: DEMO.width, pad: 16, wantCx: DEMO.width * DEMO.centerXPct / 100 });
  assert.equal(f.fits, true); assert.equal(f.R, 542, '반지름 그대로'); assert.equal(f.shift, 0, '원 중심 그대로'); near(f.cx, -94.6, EPS, 'cx');
  near(f.box.minY, 16, EPS, '상자 위 = 여유'); assert.ok(f.box.maxY <= f.H - 16 + 1 + EPS, '상자 아래');
  assert.ok(f.H >= Math.ceil(2 * (542 * Math.sin(rad(58)) + 0.75) + 32), `높이가 선 연장 끝까지 담는다 · 실제 ${f.H}`);
  assertInside(spec, f, 16, 'demo');
});

test('AG4 여러 각도 범위 · 반지름 · 폭 · 라벨에서 «호·항목·라벨·가운데 ⊂ 스테이지»', () => {
  const ranges = [[-10, 10], [-38, 38], [-60, 60], [-90, 90], [-135, 135], [-180, 180], [0, 200], [30, 120], [-170, -100], [100, 250], [45, -45], [0, 360], [-180, 360]];
  let n = 0, fitsCount = 0;
  for (const [s, e] of ranges) for (const R of [80, 542, 800]) for (const W of [360, 860]) for (const count of [2, 9])
    for (const ext of [0, 20, 90]) for (const line of ['orbit', 'spoke', 'none']) for (const kind of ['side', 'below', 'none']) for (const center of [null, { x0: 236 - 290, x1: 236 + 290, y0: -290, y1: 290 }]) {
      const degs = A.arcAngles(count, s, e);
      const rng = A.lineRange(s, e, degs, ext);
      const half = kind === 'below' ? 48 : 11;
      const labels = kind === 'side' ? sideLabels(count, half, 44, 300, 120)
        : kind === 'below' ? Array.from({ length: count }, () => ({ x0: -68, x1: 68, y0: half + 10, y1: half + 10 + 42 })) : [];
      const spec = { degs, line, lineLo: rng.lo, lineHi: rng.hi, lineWidth: 6, markerHalf: half, halo: 5, labels, center };
      const f = A.fit(spec, { radius: R, width: W, pad: 16, wantCx: W * -0.11 });
      for (const k of ['R', 'W', 'H', 'cx', 'cy']) assert.ok(Number.isFinite(f[k]), `${k} 유한`);
      assert.ok(f.R <= R && f.R >= Math.min(R, A.MIN_RADIUS), `반지름 범위 ${f.R}`);
      if (!f.fits) assert.equal(f.R, Math.min(R, A.MIN_RADIUS), '가로로 안 들어오는 것은 바닥 반지름에서뿐이다');
      assertInside(spec, f, 16, `[${s}~${e} R${R} W${W} n${count} ext${ext} ${line} ${kind} ${center ? 'center' : '-'}]`);
      n++; if (f.fits) fitsCount++;
    }
  assert.equal(n, 13 * 3 * 2 * 2 * 3 * 3 * 3 * 2, '돈 조합 수');
  assert.ok(fitsCount > 1000, `전제: 가로까지 본 조합이 충분하다 · ${fitsCount}`);
});

test('AG5 폭이 모자라면 반지름을 줄인다 — 줄인 뒤에는 들어온다 · 바닥에서도 안 들어오면 fits=false(가운데 놓기)', () => {
  const degs = A.arcAngles(7, -135, 135), rng = A.lineRange(-135, 135, degs, 0);
  const spec = { degs, line: 'orbit', lineLo: rng.lo, lineHi: rng.hi, lineWidth: 2, markerHalf: 48, halo: 0, labels: [], center: null };
  const f = A.fit(spec, { radius: 542, width: 860, pad: 16, wantCx: 430 });
  assert.equal(f.fits, true);
  assert.ok(f.R < 542 && f.shrunk === 542 - f.R, `줄었다 · R ${f.R}`);
  assertInside(spec, f, 16, '270°');
  // 1px 더 크면 안 들어간다 = «가장 큰» 반지름을 골랐다
  const wider = A.contentBox(f.R + 1, spec);
  assert.ok(wider.maxX - wider.minX > 860 - 32, '한 칸 큰 반지름은 넘친다');
  // 바닥
  const tight = A.fit(spec, { radius: 542, width: 120, pad: 16, wantCx: 60 });
  assert.equal(tight.fits, false); assert.equal(tight.R, A.MIN_RADIUS);
  near(tight.box.minX + tight.box.maxX, 120, 0.05, '좌우로 같은 만큼 넘친다');
  // 넉넉하면 안 줄인다
  const roomy = A.fit(spec, { radius: 200, width: 860, pad: 16, wantCx: 430 });
  assert.equal(roomy.R, 200); assert.equal(roomy.shrunk, 0); assert.equal(roomy.shift, 0);
});

test('AG6 원 중심은 «들어올 만큼만» 민다 — 바라는 자리가 되면 그대로 · 넘치면 변에 붙는다', () => {
  const spec = demoSpec();
  const ok = A.fit(spec, { radius: 542, width: 860, pad: 16, wantCx: -94.6 });
  assert.equal(ok.shift, 0);
  const farLeft = A.fit(spec, { radius: 542, width: 860, pad: 16, wantCx: -600 });
  near(farLeft.box.minX, 16, EPS, '왼쪽 변에 붙는다'); assert.ok(farLeft.shift > 0);
  const farRight = A.fit(spec, { radius: 542, width: 860, pad: 16, wantCx: 900 });
  near(farRight.box.maxX, 860 - 16, EPS, '오른쪽 변에 붙는다'); assert.ok(farRight.shift < 0);
  assertInside(spec, farLeft, 16, 'farLeft'); assertInside(spec, farRight, 16, 'farRight');
});

test('AG7 라벨 어림 — 줄 수 · 최대 폭 · 아이콘', () => {
  assert.deepEqual(A.labelEstimate({ text: '가나다', fontSize: 20, lineHeight: 1.5, maxWidth: 300, iconSize: 0 }), { w: 60, h: 30 });
  assert.deepEqual(A.labelEstimate({ text: '가나다\n**라마**', fontSize: 20, lineHeight: 1.5, maxWidth: 300, iconSize: 40, iconGap: 10 }), { w: 60, h: 110 });
  const wrap = A.labelEstimate({ text: '가'.repeat(20), fontSize: 20, lineHeight: 1.5, maxWidth: 150, iconSize: 0 });
  assert.deepEqual(wrap, { w: 150, h: 90 }, '400px 짜리 한 줄이 150 폭에서 3줄');
  const empty = A.labelEstimate({ text: '', fontSize: 16, lineHeight: 1.3, maxWidth: 120 });
  assert.ok(empty.h > 0 && empty.w === 0);
});

test('AG8 호 path — 구간 · 큰 호 깃발 · 방향 · 한 바퀴 이상 = 온 원 · 빈 구간 = ""', () => {
  assert.equal(A.arcPath(0, 0, 100, 0, 90), 'M 100 0 A 100 100 0 0 1 0 100');
  assert.equal(A.arcPath(0, 0, 100, 90, 0), 'M 0 100 A 100 100 0 0 0 100 0');
  assert.match(A.arcPath(10, 20, 100, -135, 135), /^M -60\.71 -50\.71 A 100 100 0 1 1 -60\.71 90\.71$/);
  assert.equal(A.arcPath(0, 0, 100, 0, 360), 'M 0 -100 A 100 100 0 1 1 0 100 A 100 100 0 1 1 0 -100 Z');
  assert.equal(A.arcPath(0, 0, 100, 30, 30), '');
  assert.equal(A.arcPath(0, 0, 0, 0, 90), '');
});

test('AG9 험한 입력 — NaN · Infinity 가 산출에 안 들어간다', () => {
  for (const bad of [NaN, Infinity, 'abc', undefined, null, {}]) {
    const f = A.fit({ degs: [bad, 0], line: 'orbit', lineLo: bad, lineHi: 40, lineWidth: bad, markerHalf: bad, halo: bad, labels: [{ x0: bad, x1: 10, y0: bad, y1: 5 }], center: { x0: bad, x1: bad, y0: bad, y1: bad } },
      { radius: bad, width: bad, pad: bad, wantCx: bad });
    for (const v of [f.R, f.W, f.H, f.cx, f.cy, f.box.minX, f.box.maxX, f.box.minY, f.box.maxY]) assert.ok(Number.isFinite(v), `${String(bad)} → ${v}`);
    assert.ok(!/NaN|Infinity/.test(A.arcPath(bad, bad, 100, bad, 90)));
  }
  const none = A.fit(null, null);
  assert.deepEqual(none.box, { minX: 0, maxX: 0, minY: 0, maxY: 0 });
  assert.deepEqual(A.contentBox(100, { degs: [] }), { minX: 0, maxX: 0, minY: 0, maxY: 0 });
});

test('AG11 바닥 반지름에서도 안 들어가면 — 반지름은 바닥에서 멎고 · 호 선과 항목만은 폭 안에 담는다(넘치는 쪽 = 라벨 · 가운데)', () => {
  const degs = A.arcAngles(3, -38, 38), rng = A.lineRange(-38, 38, degs, 20);
  const base = { degs, line: 'orbit', lineLo: rng.lo, lineHi: rng.hi, lineWidth: 1.5, markerHalf: 11, halo: 5 };
  const labels = sideLabels(3, 11, 44, 300, 160);
  const FLOOR = 80, PAD = 16;
  const cases = [
    ['폭 320 · 라벨 300', 320, { ...base, labels, center: null }],
    ['폭 860 · 가운데 가로 밀기 −600', 860, { ...base, labels, center: { x0: -710, x1: -490, y0: -110, y1: 110 } }],
    ['폭 860 · 가운데 크기 900', 860, { ...base, labels, center: { x0: -450, x1: 450, y0: -450, y1: 450 } }],
  ];
  for (const [tag, W, spec] of cases) {
    const f = A.fit(spec, { radius: 542, width: W, pad: PAD, wantCx: W * -0.11, minRadius: FLOOR });
    assert.equal(f.fits, false, `${tag} 전제: 전부는 안 들어간다`);
    assert.equal(f.R, FLOOR, `${tag} 반지름은 넘겨 준 바닥에서 멎는다(기본 바닥 ${A.MIN_RADIUS} 까지 무너지지 않는다)`);
    assert.equal(f.coreFits, true, `${tag} 호 선 · 항목은 들어간다`);
    // 호 선 · 항목만 따로 센다 — 폭 안
    const core = drawnRects({ ...spec, labels: null, center: null }, f);
    assert.ok(core.length > 3, `${tag} 전제: 호 선 · 항목이 있다(${core.length})`);
    for (const r of core) {
      assert.ok(r.x0 >= PAD - EPS, `${tag} ${r.what} 왼쪽 넘침 ${(PAD - r.x0).toFixed(2)}px`);
      assert.ok(r.x1 <= W - PAD + EPS, `${tag} ${r.what} 오른쪽 넘침 ${(r.x1 - (W - PAD)).toFixed(2)}px`);
    }
    // 세로는 전부(라벨 · 가운데 포함) 담는다
    assertInside(spec, f, PAD, tag);
    // 넘치는 것이 있다면 라벨 · 가운데뿐이다
    const out = drawnRects(spec, f).filter((r) => r.x0 < PAD - EPS || r.x1 > W - PAD + EPS).map((r) => r.what);
    assert.ok(out.length > 0 && out.every((w) => /^(라벨|가운데)/.test(w)), `${tag} 넘치는 것: ${out.join(',')}`);
  }
  // 가운데 놓기만 하면 호가 왼쪽으로 나갔을 자리다 — 「폭 320」에서 호 선 · 항목 상자의 왼쪽 끝이 여유(16)에 붙는다
  const f320 = A.fit(cases[0][2], { radius: 542, width: 320, pad: PAD, wantCx: -35, minRadius: FLOOR });
  const cb = A.contentBox(f320.R, { ...cases[0][2], labels: null, center: null });
  near(f320.cx + cb.minX, PAD, 0.02, '호 선 · 항목 상자의 왼쪽 끝');
  // 호 선 · 항목조차 안 들어가면 예전대로 가운데(AG5 의 바닥 칸과 같은 꼴)
  const none = A.fit({ ...base, labels: null, center: null }, { radius: 542, width: 60, pad: PAD, wantCx: 0, minRadius: FLOOR });
  assert.equal(none.fits, false); assert.equal(none.coreFits, false); assert.equal(none.R, FLOOR);
  near(none.box.minX + none.box.maxX, 60, 0.05, '좌우로 같은 만큼 넘친다');
  // 블럭이 바닥을 «패널 반지름 칸의 최소»로 넘긴다(소스 대조)
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'blocks', 'radial-block.js'), 'utf8');
  assert.match(src, /RADIAL_ARC_GEOM\.fit\(spec, \{[^}]*minRadius: RADIAL_LIMITS\.radius\.min[^}]*\}\)/, '바닥 = RADIAL_LIMITS.radius.min');
});

test('AG10 블럭 렌더가 이 기하로 맞추고 호 스테이지를 자르지 않는다(소스 대조)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'blocks', 'radial-block.js'), 'utf8');
  assert.match(src, /import '\.\.\/radial-arc-geom\.js';/, '기하를 싣는다');
  assert.match(src, /window\.RADIAL_ARC_GEOM\.fit\(spec,/, '호 가지가 fit 으로 맞춘다');
  const lineUses = src.match(/window\.RADIAL_ARC_GEOM\.lineRange\(/g) || [];
  assert.equal(lineUses.length, 2, '선 구간 식이 한 자리(lineRange) — 상자 계산 1 + 선 그리기 1');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/overflow\s*:\s*hidden/.test(code), '렌더가 스테이지에 overflow:hidden 을 쓰지 않는다');
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'css', 'editor-radial.css'), 'utf8');
  const stageRule = (css.match(/\.rdl-stage(--arc)?\s*\{[^}]*\}/g) || []).join('\n');
  assert.ok(stageRule.length > 0, '전제: 스테이지 규칙이 있다');
  assert.ok(!/overflow\s*:\s*hidden/.test(stageRule), 'css 스테이지 규칙도 자르지 않는다');
});

/* ── V4 반원 ───────────────────────────────────────────────────────────────── */
const parseArc = (d) => {
  const m = /^M (-?[\d.]+) (-?[\d.]+) A ([\d.]+) ([\d.]+) 0 ([01]) ([01]) (-?[\d.]+) (-?[\d.]+)$/.exec(d);
  assert.ok(m, `전제: 호 path 꼴 — ${d}`);
  const [x1, y1, rx, ry, large, sweep, x2, y2] = m.slice(1).map(Number);
  return { x1, y1, rx, ry, large, sweep, x2, y2 };
};
/* 블럭이 넘기는 꼴 그대로 — 왼쪽 여유 0 · 끝이 잘린 선 */
const halfSpec = (n, labelW) => {
  const degs = A.arcAnglesInset(n, A.HALF.startDeg, A.HALF.endDeg);
  const rng = A.lineRange(A.HALF.startDeg, A.HALF.endDeg, degs, A.HALF.lineExtend);
  return { degs, line: 'orbit', lineLo: rng.lo, lineHi: rng.hi, lineWidth: 2, lineCap: 'butt', markerHalf: 9, halo: 5, labels: sideLabels(n, 9, 20, labelW, 29), center: null };
};
const halfFit = (spec, R, W, over) => A.fit(spec, Object.assign({ radius: R, width: W, pad: 16, padL: 0, wantCx: W * A.HALF.centerX / 100, minRadius: 80 }, over || {}));

test('AG12 (V4 반원) 기본 꼴 — 끝점 둘이 왼쪽 변(x=0) · 지름 세로(2R) · 가장 오른쪽 x = R · 원 중심 밀기 0 · 반지름 줄이기 0', () => {
  assert.deepEqual(A.HALF, { startDeg: -90, endDeg: 90, centerX: 0, lineExtend: 0 }, '반원의 기본 수');
  let n = 0;
  for (const R of [80, 250, 400]) for (const W of [640, 860, 1200]) for (const count of [2, 3, 6]) {
    const spec = halfSpec(count, 120);
    assert.deepEqual([spec.lineLo, spec.lineHi], [-90, 90], '선 구간 = −90° ~ 90°(선 연장 0)');
    const f = halfFit(spec, R, W);
    const tag = `[R${R} W${W} n${count}]`;
    assert.equal(f.fits, true, `${tag} 전제: 들어간다`);
    // 맞추기가 꼴을 건드리지 않는다
    assert.equal(f.cx, 0, `${tag} 원 중심 x = 0(블럭 왼쪽 변)`);
    assert.equal(f.shift, 0, `${tag} 원 중심을 밀지 않는다`);
    assert.equal(f.shrunk, 0, `${tag} 반지름을 줄이지 않는다`);
    assert.equal(f.R, R, `${tag} 반지름 그대로`);
    assert.equal(f.box.minX, 0, `${tag} 내용 상자의 왼쪽 끝 = 0`);
    // ★세 수 — 그려지는 path 에서
    const a = parseArc(A.arcPath(f.cx, f.cy, f.R, spec.lineLo, spec.lineHi));
    assert.equal(a.x1, 0, `${tag} ① 시작 끝점 x = 0`); assert.equal(a.x2, 0, `${tag} ① 끝 끝점 x = 0`);
    near(a.y2 - a.y1, 2 * R, EPS, `${tag} ② 끝점 둘의 y 차 = 2R`);
    assert.deepEqual([a.rx, a.ry, a.large, a.sweep], [R, R, 0, 1], `${tag} 반지름 R 의 호 · 시계 방향(오른쪽으로 부푼다)`);
    // 호 위를 0.5° 씩 찍은 점 — 가장 오른쪽 x = R, 왼쪽 변을 넘는 점 0
    let right = -Infinity, left = Infinity, pts = 0;
    for (let d = spec.lineLo; d <= spec.lineHi + 1e-9; d += 0.5) { const x = f.cx + f.R * Math.cos(rad(d)); right = Math.max(right, x); left = Math.min(left, x); pts++; }
    assert.equal(pts, 361, `${tag} 전제: 찍은 점 수`);
    near(right, R, 1e-9, `${tag} ③ 가장 오른쪽 점 x = R`);
    assert.ok(left > -1e-9, `${tag} 왼쪽 변을 넘는 점이 없다 · ${left}`);
    // 기준 수 함수가 같은 수를 낸다
    const h = A.halfCircle(f.R, f.cy);
    assert.deepEqual(h.start, { x: a.x1, y: a.y1 }); assert.deepEqual(h.end, { x: a.x2, y: a.y2 });
    assert.deepEqual(h.rightmost, { x: R, y: f.cy }); assert.equal(h.chord, 2 * R);
    // 끝점이 위 · 아래 변에 닿지 않는다(위 · 아래 여유 16 + 선 두께 반)
    assert.ok(a.y1 >= 16 + 1 - EPS, `${tag} 위 끝점 위의 여유 ≥ 16 + 선 두께 반 · ${a.y1}`);   // 라벨이 호 꼭대기보다 위로 나가는 조합에서는 더 크다
    if (R === 250 && count === 3) near(a.y1, 16 + 1, EPS, `${tag} 기본 반지름 · 항목 3 — 위 끝점의 y = 여유 + 선 두께 반`);
    assert.ok(f.H - a.y2 >= 16, `${tag} 아래 끝점 밑의 여유 · ${f.H - a.y2}`);
    // 항목(점 + 고리)이 왼쪽 변 안쪽이다 — 끝점에 서지 않는다
    for (const d of spec.degs) assert.ok(f.cx + f.R * Math.cos(rad(d)) - 14 >= 0, `${tag} 항목 ${d}° 가 왼쪽 변 안쪽`);
    n++;
  }
  assert.equal(n, 27, '돈 조합 수');

  // ── 대조(같은 식 · 값 하나만 바꾼다) ──
  const spec = halfSpec(3, 120);
  // ⓐ V3 호출 꼴(가로 여유 좌우 16 · 둥근 끝) — 원 중심이 조용히 17px 밀려 끝점이 왼쪽 변에서 떨어진다
  const v3 = A.fit(Object.assign({}, spec, { lineCap: undefined }), { radius: 250, width: 860, pad: 16, wantCx: 0, minRadius: 80 });
  assert.equal(v3.cx, 17, 'V3 호출 꼴이면 원 중심 x = 17'); assert.equal(v3.shift, 17);
  // ⓑ 왼쪽 여유만 0 이고 선 끝이 둥글면 — 둥근 끝(두께 반 1px)만큼 밀린다
  assert.equal(halfFit(Object.assign({}, spec, { lineCap: undefined }), 250, 860).cx, 1, '둥근 끝이면 1px 밀린다');
  // ⓒ 원 중심을 옛 값(−11%)으로 바라면 — 맞추기가 0 까지 밀어 온다(꼴은 같아도 «밀어서» 나온 꼴이다: shift ≠ 0)
  const old = halfFit(spec, 250, 860, { wantCx: 860 * -11 / 100 });
  assert.equal(old.cx, 0); near(old.shift, 94.6, EPS, '옛 원 중심이면 94.6px 을 민다');
  // ⓓ 끝 각도 38° — 끝점이 왼쪽 변에 없고 y 차가 2R 이 아니다
  const degs38 = A.arcAnglesInset(3, -90, 38), rng38 = A.lineRange(-90, 38, degs38, 0);
  const f38 = halfFit(Object.assign({}, spec, { degs: degs38, lineLo: rng38.lo, lineHi: rng38.hi }), 250, 860);
  const a38 = parseArc(A.arcPath(f38.cx, f38.cy, f38.R, rng38.lo, rng38.hi));
  assert.ok(a38.x2 > 100, `끝 38° 의 끝점 x = ${a38.x2}(왼쪽 변이 아니다)`);
  assert.ok(Math.abs((a38.y2 - a38.y1) - 500) > 50, `끝 38° 의 y 차 = ${a38.y2 - a38.y1}(2R 이 아니다)`);
  // ⓔ 알려진 가장자리 — 반지름 바닥(80)에 항목 10 이면 맨 끝 항목(−81°)의 고리가 왼쪽 변을 1.49px 넘어 그만큼 민다(기본값 250 · 항목 3 에서는 0)
  const edge = halfFit(halfSpec(10, 60), 80, 860);
  near(edge.cx, 1.49, EPS, '반지름 80 · 항목 10 의 밀림');
});

test('AG13 (V4) 끝점을 피한 등분 · 끝이 잘린 선의 상자 · 가로 여유 따로 · 블럭이 그 값을 넘긴다', () => {
  // 끝점을 피한 등분 — 구간을 n 칸으로 나눈 칸 가운데
  assert.deepEqual(A.arcAnglesInset(3, -90, 90), [-60, 0, 60]);
  assert.deepEqual(A.arcAnglesInset(4, -90, 90), [-67.5, -22.5, 22.5, 67.5]);
  assert.deepEqual(A.arcAnglesInset(1, -60, 60), [0]);
  assert.deepEqual(A.arcAnglesInset(0, -60, 60), []);
  assert.deepEqual(A.arcAnglesInset(2, 40, -40), [20, -20]);
  for (const bad of [NaN, Infinity, 'abc', undefined, null]) assert.ok(A.arcAnglesInset(3, bad, 90).every(Number.isFinite), '험한 입력');
  for (const n of [2, 3, 6, 10]) {
    const d = A.arcAnglesInset(n, -90, 90);
    assert.equal(d.length, n); assert.ok(d[0] > -90 && d[n - 1] < 90, `n${n} — 끝점에 서지 않는다`);
    near(d[0] + 90, 90 - d[n - 1], 1e-9, `n${n} — 양 끝에 같은 만큼 남는다`);
    near(d[1] - d[0], 180 / n, 1e-9, `n${n} — 같은 간격`);
  }
  // 끝이 잘린 선의 상자 — 끝점에서는 «반지름 방향»으로만 두껍다
  const line = (lo, hi, cap) => A.contentBox(100, { degs: [], line: 'orbit', lineLo: lo, lineHi: hi, lineWidth: 4, lineCap: cap });
  const hb = line(-90, 90, 'butt');
  near(hb.minX, 0, 1e-9, '반원 · 잘린 끝 — 왼쪽 끝 0'); near(hb.maxX, 102, 1e-9); near(hb.minY, -102, 1e-9); near(hb.maxY, 102, 1e-9);
  const hr = line(-90, 90);
  near(hr.minX, -2, 1e-9, '반원 · 둥근 끝 — 왼쪽으로 두께 반(예전 식 그대로)'); near(hr.maxX, 102, 1e-9);
  const nb = line(-58, 58, 'butt');
  near(nb.minX, 98 * Math.cos(rad(58)), 1e-9, '좁은 호 · 잘린 끝 — 왼쪽 끝 = 안쪽 반지름의 끝점'); near(nb.maxY, 102 * Math.sin(rad(58)), 1e-9);
  assert.deepEqual(line(0, 360, 'butt'), { minX: -102, maxX: 102, minY: -102, maxY: 102 }, '온 원');
  // 가로 여유 따로 — 안 주면 pad(예전 호출과 한 글자도 안 다르다)
  const spec = demoSpec(), o = { radius: 542, width: 860, pad: 16, wantCx: -600 };
  assert.deepEqual(A.fit(spec, o), A.fit(spec, Object.assign({ padL: 16, padR: 16 }, o)), 'padL · padR 기본 = pad');
  const l0 = A.fit(spec, Object.assign({ padL: 0 }, o));
  near(l0.box.minX, 0, EPS, '왼쪽 여유 0 — 상자가 왼쪽 변에 붙는다'); near(A.fit(spec, o).box.minX, 16, EPS, '기본 — 16 떨어진다');
  const r40 = A.fit(spec, Object.assign({ padR: 40 }, o, { wantCx: 900 }));
  near(r40.box.maxX, 860 - 40, EPS, '오른쪽 여유 40');
  near(l0.box.minY, 16, EPS, '세로 여유는 그대로 pad');
  // 블럭이 넘기는 값(소스 대조) — 왼쪽 여유 0 · 끝이 잘린 선 · 끝점을 피한 등분 · 기본 꼴의 수는 HALF 한 자리
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'blocks', 'radial-block.js'), 'utf8');
  assert.match(src, /const RADIAL_ARC_PAD_LEFT = 0;/, '왼쪽 여유 0');
  assert.match(src, /const RADIAL_ARC_LINECAP = 'butt';/, '끝이 잘린 선');
  assert.equal((src.match(/padL: RADIAL_ARC_PAD_LEFT/g) || []).length, 2, '맞추기 두 번(라벨 없이 · 라벨까지) 모두 왼쪽 여유를 넘긴다');
  assert.match(src, /lineCap: RADIAL_ARC_LINECAP/, '상자 계산이 선 끝을 안다');
  assert.match(src, /stroke-linecap="\$\{g\.arc \? RADIAL_ARC_LINECAP : 'round'\}"/, '그리는 선 끝 = 상자 계산의 선 끝(온 원은 둥근 끝 그대로)');
  assert.match(src, /RADIAL_ARC_GEOM\.arcAnglesInset\(n, startDeg, endDeg\)/, '자동 배치 = 끝점을 피한 등분');
  assert.match(src, /const RADIAL_ARC_PRESET = Object\.freeze\(\{\s*\.\.\.window\.RADIAL_ARC_GEOM\.HALF,/, '기본 꼴의 수 = HALF');
});
