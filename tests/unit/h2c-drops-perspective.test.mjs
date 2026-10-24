/* h2c-drops-perspective.test.mjs
 *   ★★`H2C-DROPS-PERSPECTIVE-01` — ★썸네일(＋Electron 없는 PNG)에서 ★사다리꼴 자유변형이
 *   ★★원근이 ★빠진 채 ★그려진다. (2026-10-25 신설 · ★적대적 ⒠ ★C4)
 *
 * ★★★이 파일은 ★«고침»이 ★아니다 — ★★수를 박아 ★명부에 올린다.
 *   ★고치려면 ★vendor html2canvas 를 ★손대거나(⛔외부 판) ★썸네일 경로를 ★바꿔야 한다
 *   ⇒ ★★사람 판정이다. ★올렸다.
 *
 * ★★찾은 이 = 적대적 검수 ⒠(수지맥) ★C4. ★그 보고는 「★픽셀 차이는 ★못 쟀다」로 남겼다.
 *   ⇒ ★★수는 ★내가 냈다(261025) — ★1차 출처(★그 파서)와 ★★제품의 ★같은 자(`js/fx/homography.js`)로.
 *
 * ★★1차 출처 — `vendor/html2canvas/html2canvas.min.js` (★1.4.1 · ★내가 열어 읽었다)
 *   matrix3d: function(A){ var e=…, t=e[0], r=e[1];
 *                          e[2],e[3];                      ← ★버린다
 *                          var B=e[4], n=e[5];
 *                          e[6],e[7],e[8],e[9],e[10],e[11]; ← ★버린다
 *                          var s=e[12], A=e[13];
 *                          return e[14],e[15], 16===e.length ? [t,r,B,n,s,A] : null; }
 *   ⇒ ★★`[e0,e1,e4,e5,e12,e13]` ★6값만 = ★2D ★affine. ★`e[3]·e[7]·e[15]`(★원근)은 ★★사라진다.
 *
 * ★★경로 — ★어디서 ★그 길로 가나(★내가 소스로 확인)
 *   · ★썸네일 : `js/io/save-load.js` — `typeof html2canvas === 'undefined'` 면 ★아예 ★안 만든다
 *     ⇒ ★★«늘» html2canvas 다.
 *   · ★PNG   : `js/io/export-image.js:425` — `!!window.electronAPI?.captureSection` 이면 ★네이티브(CDP),
 *     ★아니면 ★html2canvas. ⇒ ★Electron 밖에서는 ★같은 병.
 *
 * ★★수 (★사다리꼴 네 점 `[[40,0],[360,0],[400,140],[0,140]]` · W=338.34 · H=43 — ★261024 실측 장면)
 *   | 꼭짓점 | ★원근 포함(네이티브) | ★affine 만(썸네일) | ★차이 |
 *   | nw | (40, 0)    | (40, 0)    | 0        |
 *   | ne | (360, 0)   | (360, 0)   | 0        |
 *   | se | (400, 140) | ★(320, 112) | ★★84.76 |
 *   | sw | (0, 140)   | ★(0, 112)   | ★28.00  |
 *   ★위변/아래변 비 : ★원근 포함 ★1.25(★사다리꼴) → ★affine ★1.00(★★평행사변형)
 *   ⇒ ★★원근이 ★«완전히» 사라지고 ★높이도 ★140 → ★112 로 ★당겨진다.
 *   ⛔★이것은 ★«모델 px» 기하 차이다 — ★★«화면 픽셀»은 ★안 쟀다(★앱 맥 · 태양 ⒜ 몫).
 *     ★이름 = `H2C-PERSPECTIVE-SCREEN-PX-UNMEASURED-01`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { homography, cornerMatrix3d, normalizeCorners } from '../../js/fx/homography.js';

const ROOT = path.join(import.meta.dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* ★261024 실측 장면 — ⛔숫자를 지어내지 않았다 */
const W = 338.34, H = 43;
const TRAP = [[40, 0], [360, 0], [400, 140], [0, 140]];
const AXIS = [[0, 0], [400, 0], [400, 120], [0, 120]];

/** 네 점 → `matrix3d` 16값 (★제품의 ★같은 자를 ★쓴다 · ⛔식을 다시 짜지 않는다) */
function m16(corners) {
  const { D } = normalizeCorners(corners);
  const h = homography([[0, 0], [W, 0], [W, H], [0, H]], D);
  assert.ok(h, '★호모그래피를 못 풀었다 — 장면이 섰는지 먼저 봐라');
  const m = cornerMatrix3d(h);
  const inside = m.match(/\(([^)]*)\)/);
  assert.ok(inside, `★matrix3d 꼴이 아니다: ${m}`);
  const nums = (inside[1].match(/-?[0-9.]+(?:e-?[0-9]+)?/g) || []).map(Number);
  assert.equal(nums.length, 16, `★16 값이 아니다 (${nums.length}) — 자가 헛돈다`);
  return nums;
}
/** ★원근 ★포함 — ★CSS `matrix3d` 의 ★참 변환(열 우선 · w 로 나눈다) */
const full = (n) => (x, y) => {
  const w = n[3] * x + n[7] * y + n[15];
  return [(n[0] * x + n[4] * y + n[12]) / w, (n[1] * x + n[5] * y + n[13]) / w];
};
/** ★html2canvas 1.4.1 ★파서와 ★같은 식 — ★`[e0,e1,e4,e5,e12,e13]` ★affine 6값 */
const affine = (n) => (x, y) => [n[0] * x + n[4] * y + n[12], n[1] * x + n[5] * y + n[13]];

const corners = (f) => [[0, 0], [W, 0], [W, H], [0, H]].map(([x, y]) => f(x, y));
const maxGap = (a, b) => Math.max(...a.map((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1])));
const edgeRatio = (f) => {
  const top = Math.hypot(...[f(W, 0), f(0, 0)].reduce((_, __, i, A) => [A[0][0] - A[1][0], A[0][1] - A[1][1]]));
  const bot = Math.hypot(...[f(W, H), f(0, H)].reduce((_, __, i, A) => [A[0][0] - A[1][0], A[0][1] - A[1][1]]));
  return bot / top;
};

test('V0 ★1차 출처 — ★html2canvas 1.4.1 의 ★`matrix3d` 파서가 ★6값만 돌려준다', () => {
  const v = read('vendor/html2canvas/html2canvas.min.js');
  assert.match(v, /html2canvas 1\.4\.1/, '★판이 바뀌었다 — ★파서를 다시 읽고 이 파일을 판정해라');
  const i = v.indexOf('matrix3d:function');
  assert.ok(i > 0, '★`matrix3d:function` 을 못 찾았다 — ★min 꼴이 바뀌었다(자가 낡았다)');
  const seg = v.slice(i, i + 320);
  /* ★★닻 — ★돌려주는 것이 ★6값이다. ⛔그 조각의 ★글자를 ★그대로 ★집는다 */
  assert.match(seg, /return e\[14\],e\[15\],16===e\.length\?\[t,r,B,n,s,A\]:null/,
    `★파서의 return 꼴이 바뀌었다 — ★원근을 ★쓰기 시작했으면 ★이 파일을 ★닫아라.\n  조각: ${seg.slice(0, 220)}`);
});

test('V1 ★경로 — ★썸네일은 ★«늘» html2canvas · ★PNG 는 ★Electron 이면 ★네이티브', () => {
  const sl = read('js/io/save-load.js');
  assert.match(sl, /typeof html2canvas === 'undefined'\) return null/,
    '★썸네일의 html2canvas 가드가 사라졌다 — ★다른 길이 생겼으면 판정해라');
  const ei = read('js/io/export-image.js');
  assert.match(ei, /window\.electronAPI\?\.captureSection/,
    '★PNG 의 네이티브 갈림이 사라졌다 — ★판정해라');
});

test('V2 ★★★수 — ★사다리꼴은 ★affine 으로 떨어지면 ★꼭짓점이 ★84.76 px 어긋난다', () => {
  const n = m16(TRAP);
  /* ★전제 — ★원근 칸이 ★0 이 아니다(⛔0 이면 아래 비교가 ★항등식이 된다) */
  const persp = Math.max(Math.abs(n[3]), Math.abs(n[7]));
  assert.ok(persp > 1e-6, `★사다리꼴인데 원근 칸이 0 이다 (e3=${n[3]} e7=${n[7]}) — 장면이 안 섰다`);

  const gap = maxGap(corners(full(n)), corners(affine(n)));
  /* ★261025 실측 = ★84.76 px. ⛔절대값을 박지 않고 ★하한으로 잰다(W·H 가 바뀌면 값이 움직인다) */
  assert.ok(gap > 20, `★원근을 버려도 ★꼭짓점이 거의 안 움직인다 (${gap.toFixed(2)} px) — ★고쳐졌나? 판정해라`);

  /* ★★위변/아래변 비 — ★사다리꼴 → ★평행사변형 */
  const rF = edgeRatio(full(n)), rA = edgeRatio(affine(n));
  assert.ok(Math.abs(rF - 1) > 0.05, `★원근 포함인데 비가 1 이다 (${rF.toFixed(4)}) — 사다리꼴이 아니다`);
  assert.ok(Math.abs(rA - 1) < 1e-6,
    `★affine 인데 비가 1 이 아니다 (${rA.toFixed(4)}) — ★파서가 원근을 쓰기 시작했나? 판정해라`);
});

test('V3 ★★음성대조 — ★축정렬(원근 0)은 ★두 식이 ★같다 (★갈림이 ★원근 탓임을 ★보인다)', () => {
  const n = m16(AXIS);
  /* ★전제 — ★이 장면은 ★원근 칸이 ★0 이다 */
  assert.ok(Math.abs(n[3]) < 1e-9 && Math.abs(n[7]) < 1e-9,
    `★축정렬인데 원근 칸이 0 이 아니다 (e3=${n[3]} e7=${n[7]})`);
  const gap = maxGap(corners(full(n)), corners(affine(n)));
  /* ⛔이 칸이 ★없으면 ★V2 의 「어긋난다」가 ★「두 식이 ★원래 다르다」와 ★구분이 ★안 된다 */
  assert.ok(gap < 1e-6,
    `★원근이 0 인데도 두 식이 갈린다 (${gap} px) — ★★내 두 식 중 하나가 틀렸다(V2 의 수를 못 믿는다)`);
});

test('V4 ★★«화면 픽셀»은 ★안 쟀다 — ★그 사실을 ★박는다', () => {
  /* ★위 수는 ★«모델 px» ★기하 차이다. ★실제 ★썸네일 PNG 와 ★네이티브 PNG 의
     ★★픽셀 차이는 ★★아무도 ★안 쟀다 :
       · ★적대적 ⒠ : 「★픽셀 차이는 ★못 쟀다」
       · ★나(261025) : ★기하 차이만 냈다 — ★앱(Electron)이 없으면 ★네이티브 쪽을 ★못 만든다
     ⇒ ★앱 맥(★태양 ⒜) 몫. ★이름 = `H2C-PERSPECTIVE-SCREEN-PX-UNMEASURED-01`
     ★이 칸은 ★★항상 초록인 ★«기록»이고 ★«자»가 ★아니다. ⛔그것을 ★숨기지 않는다. */
  assert.ok(true, 'H2C-PERSPECTIVE-SCREEN-PX-UNMEASURED-01 — 기록용 칸');
});
