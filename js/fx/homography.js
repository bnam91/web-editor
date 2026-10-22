/* ═══════════════════════════════════════════════════════════════════════════
   fx/homography.js — 글상자 «자유변형»(네 점 Distort)의 셈 — ★순수 함수만.
   ───────────────────────────────────────────────────────────────────────────
   ★참값은 시안이다 — ~/.gd-work/team-lead/sian/sian-08-text-freetransform-v8.html
     (sha앞12 e1338e08e1de)의 `homography` · `cssMatrix` · `draw()` 의 정규화·박스 식 ·
     변의 1/3·2/3 자리 셈. ⛔이 파일의 «수식»을 바꾸지 마라 — 시안에서 다섯 표본으로 검산됐다.
   ★왜 따로 떼나: 저장되는 값은 «모서리 여덟 숫자»뿐이고, 화면에 쓰는 행렬은 그 여덟에서 «계산된다».
     계산을 제품 화면 안에 두면 같은 식이 두 자리(시안·제품)에 살아 갈린다 ⇒ 셈만 여기 한 자리에.
   ⛔DOM 접근 0 · 전역 0 — 받은 수로 수만 낸다. 호출자가 style 에 꽂는다.
   회귀: tests/unit/text-freetransform-homography.test.mjs
     (P-2 가 ★시안에서 기계로 뗀 참조 구현과 «같은 값»인지 다섯 꼴에서 겨룬다 — 수식을 고치면 빨강).
═══════════════════════════════════════════════════════════════════════════ */

/** 네 점 대응 → 3×3 호모그래피(8 미지수) — 가우스 소거.
 *  @param {number[][]} src 원래 네 점 [[x,y]×4] (글상자는 [[0,0],[W,0],[W,H],[0,H]])
 *  @param {number[][]} dst 옮겨갈 네 점 [[x,y]×4]
 *  @returns {number[]|null} [h11,h12,h13, h21,h22,h23, h31,h32, 1] · 네 점이 한 줄·겹침이면 null
 *  ★검산(시안 261022): 양성 = 네 모서리가 «정확히» 그 자리로 간다 ·
 *    음성대조 = 평행사변형·늘이기면 h31·h32 가 «정확히» 0(2D 행렬로도 된다),
 *    사다리꼴이면 0 이 아니다(= 원근이 필요하다 ⇒ 3판으로는 사다리꼴 불가의 증명).
 *  ⛔이름이 `homography` 여야 한다 — 검사(P-1)가 이 이름을 집어 온다. */
export function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const n = 8, M = A.map((row, i) => row.concat(b[i]));
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;     /* ★네 점이 한 줄·겹침 ⇒ 못 푼다 */
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const h = []; for (let i = 0; i < n; i++) h.push(M[i][n] / M[i][i]);
  h.push(1);
  return h;
}

/** 호모그래피 → CSS `matrix3d(…)` 문자열 (시안 `cssMatrix`).
 *  ★matrix3d 는 «열 우선» 16 값 — 1열 h11,h21,0,h31 / 2열 h12,h22,0,h32 / 3열 0,0,1,0 / 4열 h13,h23,0,1.
 *    ⇒ 원근 항은 m[3](=h31) · m[7](=h32) 자리에 앉는다(여기가 어긋나면 사다리꼴이 affine 으로 때워진다).
 *  @param {number[]} h homography() 가 낸 9값
 *  @returns {string} 'matrix3d(…)' */
export function cornerMatrix3d(h) {
  return `matrix3d(${h[0]},${h[3]},0,${h[6]}, ${h[1]},${h[4]},0,${h[7]}, 0,0,1,0, ${h[2]},${h[5]},0,1)`;
}

/** 네 모서리를 «0,0 으로 당긴다» — 왼·위로 나간 것도 박스가 감싸게(시안 draw() ⒞ · 현빈 msg5416).
 *  ⛔당기기 «전»의 네 점으로 호모그래피를 풀면 왼·위로 나간 글자가 박스 밖으로 삐져나간다.
 *  @param {number[][]} C 모서리 네 점(저장되는 값)
 *  @returns {{D:number[][], mnx:number, mny:number}} D = C − min · 당긴 거리 mnx·mny */
export function normalizeCorners(C) {
  const nxs = C.map(q => q[0]), nys = C.map(q => q[1]);
  const mnx = Math.min(...nxs), mny = Math.min(...nys);
  const D = C.map(([x, y]) => [x - mnx, y - mny]);
  return { D, mnx, mny };
}

/** 정규화된 네 점 → 파란 아웃라인(.text-block)의 폭·높이 (시안 draw()).
 *  ★글자의 오른쪽 끝 = 원점(OX) ＋ max(Dx). OX 가 음수면 그만큼 왼쪽에서 시작한다
 *    ⇒ 필요한 폭 = max(Dx) ＋ OX, 단 바탕(W+OX)보다 작아지지 않게 · 음수가 되지 않게 1 로 자른다.
 *  ⇒ 변형 0 이면 바탕 그대로(W+OX, H+OY) — 「켜기 전인데 박스가 줄어 있다」가 여기서 막힌다.
 *  @param {number[][]} D normalizeCorners().D
 *  @param {number} W 바탕 글자폭 · @param {number} H 바탕 글자높이
 *  @param {number} OX 글자 좌상단 원점 x · @param {number} OY 그 y
 *  @returns {{w:number, h:number}} (호출자가 width · min-height 로 꽂는다 — ⛔height 는 글자를 자른다) */
export function boxFromCorners(D, W, H, OX, OY) {
  const mxx = Math.max(...D.map(q => q[0])), mxy = Math.max(...D.map(q => q[1]));
  return {
    w: Math.max(mxx + OX, W + OX, 1),
    h: Math.max(mxy + OY, H + OY, 1),
  };
}

/* 변 이름 → 그 변의 «원래» 두 끝(단위 사각형 기준) — n:위 e:오른 s:아래 w:왼, 모서리 순서 nw·ne·se·sw. */
const EDGE_ENDS = Object.freeze({
  n: [[0, 0], [1, 0]],
  e: [[1, 0], [1, 1]],
  s: [[1, 1], [0, 1]],
  w: [[0, 1], [0, 0]],
});

/** 변의 비율 t 자리가 «변형 뒤» 어디로 가나 (시안 draw() 의 EDGEPTS 셈).
 *  ★자리는 선형 보간이 «아니라» 호모그래피로 구한다 — 원근이 걸리면 1/3 이 1/3 이 아니다.
 *  @param {number[]} h homography() 가 낸 9값
 *  @param {'n'|'e'|'s'|'w'} side 어느 변
 *  @param {number} t 그 변에서의 비율(0..1 · 핸들은 1/3·2/3)
 *  @param {number} [W=1] h 를 푼 원래 사각형의 폭 · @param {number} [H=1] 그 높이
 *    （기본 1 = h 가 «단위 사각형»에서 풀렸을 때. 글상자는 W·H 를 넘긴다.）
 *  @returns {number[]} [x, y] */
export function edgePointAt(h, side, t, W = 1, H = 1) {
  const [a, b] = EDGE_ENDS[side];
  const mx = (a[0] + (b[0] - a[0]) * t) * W;
  const my = (a[1] + (b[1] - a[1]) * t) * H;
  const w = h[6] * mx + h[7] * my + 1;
  return [(h[0] * mx + h[1] * my + h[2]) / w, (h[3] * mx + h[4] * my + h[5]) / w];
}
