/* logo-collab-model.js — 1013t2A2 로고 «콜라보» [로고1 × 로고2 (× 로고3)] 의 순수 모델 (DOM 0 · import 0)
 * 현빈 원문: 「logo 블럭 : 우측패널에 옵션을 하나 추가… 콜라보 옵션인데 로고갯수를 별모양 블럭처럼 추가할 수 있게…
 *            로고1과 2 사이에 ‘x’를 넣어서 [ 로고1 X 로고2 ] 구조로… 로고 갯수를 3개까지 늘릴 수 있어.」
 * ★별 «갯수»(js/shape-star.js clampStarCount)와 같은 규율 — 「1 = 옛 꼴(꺼짐) · 블록을 복제하지 않는다 · 한 블록 안에서 옆으로 넓어진다」.
 * ★여기 수가 «한 자리»다 — 패널(min/max)·DOM 렌더(logo-collab.js)·Figma export·CSS 폴백(--collab-gap 16px)이 다 이걸 본다.
 *   CSS 폴백과 같은 수인지는 tests/unit/logo-collab-model.test.mjs LM3 가 대조한다. */
export const COLLAB_MIN = 1;
export const COLLAB_MAX = 3;
export const COLLAB_GAP_DEFAULT = 16;
export const COLLAB_GAP_MIN = 0, COLLAB_GAP_MAX = 80;
export const COLLAB_X_MIN = 8, COLLAB_X_MAX = 96;
export const COLLAB_GLYPH = '×';   // 「×」 — 원문 ‘x’ 를 곱셈 기호로 읽었다(가정)

/** 갯수 — 숫자 아니면 1(꺼짐), 1~3 으로 막는다. */
export function clampCollabCount(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return COLLAB_MIN;
  return Math.min(COLLAB_MAX, Math.max(COLLAB_MIN, n));
}
const _clamp = (v, lo, hi, dflt) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};
export const clampCollabGap = (v) => _clamp(v, COLLAB_GAP_MIN, COLLAB_GAP_MAX, COLLAB_GAP_DEFAULT);
/** × 글자 기본 크기 = 칸 높이의 절반(64 → 32). */
export function collabXSizeDefault(h) {
  const n = Number(h);
  return _clamp(Number.isFinite(n) && n > 0 ? n * 0.5 : 32, COLLAB_X_MIN, COLLAB_X_MAX, 32);
}
export const clampCollabXSize = (v, h) => _clamp(v, COLLAB_X_MIN, COLLAB_X_MAX, collabXSizeDefault(h));

/** 기하 — 칸 폭 S · 갯수 n · 간격 gap · × 상자 폭 x.
 *  W = n·S + (n−1)·(2·gap + x) · 칸 k 의 left = (k−1)·(S + 2·gap + x) · ×k 의 left = k·S + (k−1)·(2·gap + x) + gap */
export function collabGeometry(S, n, gap, x) {
  const c = clampCollabCount(n);
  const step = S + 2 * gap + x;
  const slots = [], xs = [];
  for (let k = 0; k < c; k++) slots.push(k * step);
  for (let k = 1; k < c; k++) xs.push(k * S + (k - 1) * (2 * gap + x) + gap);
  return { width: c * S + (c - 1) * (2 * gap + x), slots, xs };
}
