/* ★「좁아짐이 빨간 원을 지나가지 못한다」 — 현빈 2026-09-09 지시의 계약.
 *   원문: 「이동이 살짝만 구현하려는거라서 … ★빨간 원을 못 지나가게만 해줌될듯?」
 *
 * ★이 검사가 «지키는 것»은 수 하나가 아니라 «관계»다:
 *     어떤 크기·어떤 좁아짐에서도  dist(a, 광원) ≥ 2·ZOOM_HANDLE_R
 *   ⇒ 상한 공식(100·(1−4R/|AB|))을 바꿔도, 손잡이 반지름을 바꿔도 이 관계가 남으면 통과한다.
 *   ⛔「narrow ≤ 92.3」처럼 «한 수»로 못박지 않는다 — 그건 크기 하나에서만 참이다.
 *
 * ⛔js/**.js 는 이 레포가 "type":"commonjs" 라 node 가 ESM 으로 못 읽는다 ⇒ tmp 에 .mjs 로 복사해 import.
 *   (zoom-tangent.test.mjs 와 «같은 관용구». 사본이지 흉내가 아니다.) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.resolve(ROOT, 'js/blocks/zoom-geometry.js');

let _modP = null;
function loadGeom() {
  if (!_modP) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoom-narrow-'));
    const mjs = path.join(dir, 'zoom-geometry.mjs');
    fs.copyFileSync(SRC, mjs);
    _modP = import(pathToFileURL(mjs).href);
  }
  return _modP;
}
/** 변이를 «겹쳐» 쌓는다 — loadMutant([f1,t1],[f2,t2]) 또는 옛 꼴 loadMutant(f,t). */
async function loadMutant(...args) {
  const pairs = Array.isArray(args[0]) ? args : [args];
  const src = fs.readFileSync(SRC, 'utf8');
  let out = src;
  for (const [from, to] of pairs) {
    const next = out.replace(from, to);
    assert.notEqual(next, out,
      `★하네스가 부서졌다(계약이 문 것이 아니다) — 앵커를 못 찾았다: ${from}`);
    out = next;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoom-narrow-mut-'));
  const mjs = path.join(dir, 'zoom-geometry.mjs');
  fs.writeFileSync(mjs, out, 'utf8');
  return import(pathToFileURL(mjs).href);
}

const BASE = { shape: 'rect', angle: -90, length: 170, spread: 0, maxop: 30,
               curve: 100, rot: 0, bdr: 0, w: null, h: null };
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/* ★격자 — 크기는 슬라이더 전 범위(20~600), 좁아짐도 전 범위(0~100). 도형 셋. */
const SIZES  = [20, 24, 30, 40, 50, 60, 80, 100, 140, 200, 260, 400, 600];
const NARROW = [0, 10, 20, 40, 62, 80, 90, 96, 99, 100];
const SHAPES = ['rect', 'square', 'circle', 'a4'];

/* ★계약을 «정확한 말»로 적는다 — 처음엔 「언제나 2R 이상」으로 썼다가 검사가 반례를 냈다:
     circle size20 은 narrow 0(가장 벌린 상태)에서도 dist=9.98 이다. 지름 20 = 4R 이라
     ★도형이 그만큼 작으면 «더 벌릴 수가 없다». 좁아짐이 만든 문제가 아니다.
   ⇒ 지켜야 할 것은 「2R 이상」이 아니라 ★«좁아짐이 상황을 더 나쁘게 만들지 않는다»이다:
       dist(narrow) ≥ min(2R, dist(narrow 0))
   ⛔약해진 게 아니다 — 「좁아짐 탓에 빨간 원을 지나가는 일이 없다」가 현빈이 말한 그것이다. */
test('N1 ★좁아짐이 a·b 를 빨간 원 «안»으로 밀어 넣지 않는다', async () => {
  const G = await loadGeom();
  const R = G.ZOOM_HANDLE_R;
  let cells = 0, worst = Infinity, pressed = 0;
  for (const shape of SHAPES) for (const size of SIZES) {
    /* 그 도형이 «가장 벌어진» 상태 — 여기보다 나빠지면 안 된다. */
    const g0 = G.computeZoomGeometry({ ...BASE, shape, size, narrow: 0 }, null);
    const floor = Math.min(2 * R, dist(g0.a, g0.L)) - 1e-9;
    for (const narrow of NARROW) {
      const g = G.computeZoomGeometry({ ...BASE, shape, size, narrow }, null);
      cells++;
      for (const [nm, v] of [['a', dist(g.a, g.L)], ['b', dist(g.b, g.L)]]) {
        if (v < worst) worst = v;
        assert.ok(v >= floor,
          `${shape} size${size} narrow${narrow}: dist(${nm},광원)=${v.toFixed(2)} < ${floor.toFixed(2)}`
          + ` — 좁아짐이 «narrow 0 보다 나쁘게» 만들었다`);
      }
      if (narrow > 0 && Math.abs(dist(g.a, g.L) - 2 * R) < 1e-6) pressed++;
    }
  }
  /* ★「입력이 살아 있다」 — 격자가 비었으면 위 루프는 0바퀴로 «조용히» 통과한다. */
  assert.ok(cells === SHAPES.length * SIZES.length * NARROW.length && cells > 0,
    `격자가 안 돌았다 — cells=${cells}`);
  assert.ok(pressed > 0,
    `★한도가 «실제로 물린» 칸이 0 이다 — 격자가 상한을 안 밟았으니 이 검사는 아무것도 안 봤다`
    + ` (최소거리 ${worst.toFixed(2)})`);
});

test('N2 [음성대조] 기본 배치는 «안 눌린다» — 화면이 안 바뀐다', async () => {
  const G = await loadGeom();
  /* 앱 기본: size 260 · narrow 62. 상한이 92.3 이라 62 는 한참 아래 ⇒ 손대면 안 된다. */
  const g = G.computeZoomGeometry({ ...BASE, size: 260, narrow: 62 }, null);
  assert.ok(Math.abs(Math.abs(g.a.x) - 49.4) < 1e-6,
    `기본 배치가 눌렸다 — a.x=${g.a.x} (상한 넣기 «전» 실측 ±49.40)`);
  /* ★상한이 기본값 «위»에 있는 크기 전수에서 한 톨도 안 바뀌어야 한다. */
  for (const size of [60, 80, 100, 140, 200, 260, 400, 600]) {
    const lim = G.narrowLimit(...(() => {
      const s0 = G.computeZoomGeometry({ ...BASE, size, narrow: 0 }, null);
      return [s0.a, s0.b];
    })());
    if (!(lim > 62)) continue;                       // 눌리는 크기는 이 단언의 대상이 아니다
    const eff = G.computeZoomGeometry({ ...BASE, size, narrow: 62 }, null);
    const raw = G.autoShortEdge(
      ...(() => { const s0 = G.computeZoomGeometry({ ...BASE, size, narrow: 0 }, null); return [s0.a, s0.b, s0.L]; })(), 62);
    assert.ok(Math.abs(eff.a.x - raw[0].x) < 1e-9 && Math.abs(eff.a.y - raw[0].y) < 1e-9,
      `size ${size}: 상한(${lim.toFixed(1)})이 62 «위»인데 값이 바뀌었다`);
  }
});

test('N3 ★상한이 «크기를 따라간다» — 한 수로 굳지 않았다', async () => {
  const G = await loadGeom();
  const limOf = (size) => {
    const s0 = G.computeZoomGeometry({ ...BASE, size, narrow: 0 }, null);
    return G.narrowLimit(s0.a, s0.b);
  };
  const l20 = limOf(20), l60 = limOf(60), l260 = limOf(260), l600 = limOf(600);
  assert.ok(l20 < l60 && l60 < l260 && l260 < l600,
    `상한이 크기에 따라 «안» 커진다 — 20:${l20} 60:${l60} 260:${l260} 600:${l600}`);
  /* ★세 수가 서로 «다르다» — 하나를 보편값처럼 쓰지 못하게 못박는다. */
  assert.equal(new Set([l20, l60, l260, l600].map(v => v.toFixed(3))).size, 4,
    '네 크기의 상한이 같다 — 크기를 안 보고 있다');
});

/* ★그물은 «하나»다 — 좁아짐 상한(⑶)뿐이다.
     한때 밀어내기(pushOutOfLight)를 둘째 그물로 넣었는데, 현빈이 「손으로 끈 것은 자유가 좋다」로
     정정하셔서 뺐다(N6~N8 참조). ⇒ 이 변이도 «하나»로 돌아왔다.
   ⚠️★그때 배운 것: 그물이 둘이면 «하나만 끈» 변이는 남은 그물이 받아내서 «안 빨개진다».
     실제로 그렇게 초록이 나와서 알았다. ⇒ 변이는 언제나 «그 계약을 지키는 그물 전부»를 꺼야 한다. */
test('N4 [변이] 상한을 없애면 이 검사가 «실제로» 빨개진다', async () => {
  const bad = await loadMutant(
    '  var nEff = Math.max(0, Math.min(Number(st.narrow) || 0, nLim));',
    '  var nEff = Math.max(0, Number(st.narrow) || 0);');
  const R = bad.ZOOM_HANDLE_R;
  let broke = 0;
  for (const size of SIZES) for (const narrow of NARROW) {
    const g = bad.computeZoomGeometry({ ...BASE, size, narrow }, null);
    if (dist(g.a, g.L) < 2 * R - 1e-9) broke++;
  }
  assert.ok(broke > 0,
    '★변이를 넣었는데 «한 칸도» 안 깨졌다 — 이 검사는 아무것도 안 지킨다');
});

test('N5 ★저장본은 «안 고친다» — 넘긴 st 를 «되읽어» 확인한다', async () => {
  const G = await loadGeom();
  /* 「읽는 자리에서만 자른다」의 계약. 저장본(호출자가 준 st)을 고쳐 쓰면 이 단언이 깨져야 한다.
     ⚠️★한 번 «안 깨지게» 써 놨었다 — 적대적 검수가 잡았다(2026-09-09).
       옛 판은 매 호출마다 `{ ...st, size: 30 }` 로 «새 객체»를 펼쳐 넘겼다.
       ⇒ 호출된 쪽이 그 사본을 마음껏 고쳐도 «원본은 영영 안 더럽혀지고», 되읽을 것이 없다.
       실제로 `st.narrow = nEff;` 를 심어 봤는데 N5 가 «초록»이었다.
     ⇒ ★고침: «같은 객체»를 넘기고, 부른 «뒤에» 그 객체를 되읽는다. 그게 이 계약의 유일한 자다. */
  const st = { ...BASE, narrow: 62 };

  /* ⑴ 상한이 무는 크기에서 «같은 객체»를 넘긴다 — 여기서 고쳐 쓰면 아래 ⑵가 잡는다. */
  const stSmall = { ...BASE, narrow: 62, size: 30 };
  const smallSame = G.computeZoomGeometry(stSmall, null);
  assert.ok(dist(smallSame.a, smallSame.L) >= 2 * G.ZOOM_HANDLE_R - 1e-9,
    '작은 도형에서 상한이 «안» 물었다 — 이 칸이 계약을 안 밟았다');
  /* ⑵ ★되읽기 — 넘긴 객체가 «한 톨도» 안 바뀌어야 한다. */
  assert.equal(stSmall.narrow, 62,
    `★저장본을 «고쳐 썼다» — 넘긴 st.narrow 가 ${stSmall.narrow} 로 바뀌었다(62 여야 한다)`);
  assert.deepEqual(stSmall, { ...BASE, narrow: 62, size: 30 },
    '★넘긴 st 의 «다른 키»가 바뀌었다 — 계산이 호출자 상태를 더럽힌다');

  /* ⑶ 같은 객체를 «두 번» 부른다 — 첫 호출이 더럽혔으면 둘째가 달라진다. */
  const g1 = G.computeZoomGeometry(stSmall, null);
  const g2 = G.computeZoomGeometry(stSmall, null);
  assert.ok(Math.abs(g1.a.x - g2.a.x) < 1e-12 && Math.abs(g1.a.y - g2.a.y) < 1e-12,
    '★같은 객체로 두 번 불렀는데 결과가 달라졌다 — 첫 호출이 st 를 더럽혔다');

  const small = G.computeZoomGeometry({ ...st, size: 30 }, null);
  const big   = G.computeZoomGeometry({ ...st, size: 260 }, null);
  const rawBig = (() => {
    const s0 = G.computeZoomGeometry({ ...st, size: 260, narrow: 0 }, null);
    return G.autoShortEdge(s0.a, s0.b, s0.L, 62);
  })();
  assert.ok(dist(small.a, small.L) >= 2 * G.ZOOM_HANDLE_R - 1e-9, '작은 도형에서 안 눌렸다');
  assert.ok(Math.abs(big.a.x - rawBig[0].x) < 1e-9,
    '큰 도형에서 62 가 «안» 되살아났다 — 저장본을 고쳐 썼을 수 있다');
});

/* ═══════════════════════════════════════════════════════════════════════════
   ★N6~N8 — «손으로 끈» 손잡이는 «자유다». 막지 않는다.
     ⚠️★이 절은 «뒤집힌» 계약이다. 기록을 남긴다:
       내가 「슬라이더만 막으면 손으로 끌어 빨간 원 위에 겹쳐 놓을 수 있고, 그러면 다시 못 집는다」며
       밀어내기를 넣었다(pushOutOfLight). ★현빈이 앱에서 «직접 끌어 보고» 정정하셨다 —
         「상한 없이 빨간색 지금 지나가지는 거 «좋은데»? 지금 적용된 그대로 둬도 될 것 같아」
       ⇒ 넣었던 것을 뺐다. ⛔검사를 «지우지» 않고 «반대 계약»으로 바꾼다 — 그래야 누가 다시 넣으면 빨개진다.
     ⇒ 지금의 규약(둘을 갈라 읽어라):
         · 슬라이더로 «준 값»(narrow) → ★막는다 (N1~N5)
         · 손으로 «끈» a·b          → ★자유다 (N6~N8)
   ═══════════════════════════════════════════════════════════════════════════ */

test('N6 ★손으로 끈 a 는 빨간 원 «위에도» 놓인다 — 밀어내지 않는다', async () => {
  const G = await loadGeom();
  const L = { x: 0, y: -170 };
  let onTop = 0;
  for (const off of [0, 1, 2, 5, 9]) {
    const P = { x: off, y: L.y };
    const g = G.computeZoomGeometry({ ...BASE, size: 260, narrow: 62 }, { a: P, L });
    assert.ok(Math.abs(g.a.x - P.x) < 1e-9 && Math.abs(g.a.y - P.y) < 1e-9,
      `광원에서 ${off}px 에 놓았는데 (${g.a.x},${g.a.y}) 로 «밀렸다» — 현빈 결정은 「자유」다`);
    if (dist(g.a, g.L) < 2 * G.ZOOM_HANDLE_R) onTop++;
  }
  /* ★「입력이 살아 있다」 — 실제로 «겹치는» 자리를 밟았어야 이 검사가 뭔가를 본 것이다. */
  assert.ok(onTop > 0, '★한 칸도 겹치지 않았다 — 격자가 빨간 원 근처를 안 밟았다');
});

test('N7 ★빛을 «고정 안 한» 채 a·b 를 바짝 붙여도 그대로 둔다', async () => {
  const G = await loadGeom();
  const base = G.computeZoomGeometry({ ...BASE, size: 260, narrow: 62 }, null);
  let close = 0;
  for (const ax of [10, 2, 0, -40, -49]) {
    const P = { x: ax, y: base.a.y };
    const g = G.computeZoomGeometry({ ...BASE, size: 260, narrow: 62 }, { a: P });
    assert.ok(Math.abs(g.a.x - P.x) < 1e-9, `a.x=${ax} 가 ${g.a.x} 로 움직였다 — 끈 것은 안 건드린다`);
    if (dist(g.a, g.L) < 2 * G.ZOOM_HANDLE_R) close++;
  }
  assert.ok(close > 0, '★한 칸도 가깝지 않았다 — 격자가 벽 근처를 안 밟았다');
});

test('N8 [변이] 밀어내기를 «되살리면» 이 계약이 실제로 빨개진다', async () => {
  /* ★현빈 결정을 되돌리는 변이. 누가 pushOutOfLight 를 다시 부르면 N6·N7 이 문다. */
  const bad = await loadMutant(
    '  var L = lPin || { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };',
    '  if (lPin) { a = pushOutOfLight(a, lPin); b = pushOutOfLight(b, lPin); }\n'
    + '  var L = lPin || { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };');
  const L = { x: 0, y: -170 };
  const g = bad.computeZoomGeometry({ ...BASE, size: 260, narrow: 62 }, { a: { x: 2, y: L.y }, L });
  assert.ok(Math.abs(g.a.x - 2) > 1e-9,
    '★밀어내기를 되살렸는데도 «안 밀린다» — 이 검사는 아무것도 안 지킨다');
});
