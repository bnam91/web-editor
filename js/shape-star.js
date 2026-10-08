// 별 쉐이프 꼭짓점 수(B2) — 순수 함수. viewBox 200×190 (block-factory.js SHAPE_DEFS.star 와 같은 틀).
// ★n=5 는 «옛 문자열 그대로» 돌려준다(저장된 별·내보내기와 바이트 동일 — 계산 결과로 바꾸지 마라).
export const STAR_VB_W = 200;
export const STAR_VB_H = 190;
export const STAR_MIN = 3;
export const STAR_MAX = 12;
export const STAR_DEFAULT = 5;

const OLD_POINTS = '100,8 122,70 188,70 135,110 155,172 100,132 45,172 65,110 12,70 78,70';
const OLD_CLIP = 'polygon(50% 4.21%, 61% 36.84%, 94% 36.84%, 67.5% 57.89%, 77.5% 90.53%, 50% 69.47%, 22.5% 90.53%, 32.5% 57.89%, 6% 36.84%, 39% 36.84%)';

const CX = 100, CY = 98.66, R_OUT = 90.66, R_IN = 36;   // 5각 옛 별의 바깥 반지름·중심을 따른다

export function clampStarN(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return STAR_DEFAULT;
  return Math.min(STAR_MAX, Math.max(STAR_MIN, v));
}

const r2 = (v) => Math.round(v * 100) / 100;

function _coords(n, rIn = R_IN) {
  const out = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + i * Math.PI / n;
    const r = i % 2 === 0 ? R_OUT : rIn;
    out.push([r2(CX + r * Math.cos(a)), r2(CY + r * Math.sin(a))]);
  }
  return out;
}

/* ══ 별 «통통함» (현빈 2026-10-07 「★별이 너무 뾰족해서 ★라운드나 ★살짝 통통한 별로도」) ══
 * ★두 축 중 ★«통통»만 이 자리다 — ★「라운드」(꼭지 둥글기)는 ★★별개다:
 *   points → <polygon> / clip-path: polygon() 은 ★직선만이라 ★꼭지 radius 를 못 받는다
 *   ⇒ path(아크) 전환이 필요하고 ★이미지 clip·내보내기 셋이 같이 걸린다(비용 큼 · 지디 판정).
 * ★뜻 = ★안쪽 반지름 비(R_IN / R_OUT). ★작으면 뾰족하고 ★크면 통통하다.
 *   ★고치기 전 = ★R_IN 36 / R_OUT 90.66 = ★0.3971 «상수»였다(조절 자리 0건).
 * ★★단위는 ★정수 ％다 — 「꼭짓점 3~12」·「갯수 1~10」과 ★같은 결의 슬라이더가 되게(지디 ㉡).
 * ★★★«미설정 = 옛 별»이다 — `dataset.starInner` 가 ★없으면 ★비를 ★안 쓰고 ★옛 특례를 탄다.
 *   ★왜 — ★`OLD_POINTS` 는 ★계산값이 ★아니다(★실측: 10 좌표쌍 중 ★9 가 다르다 · 손으로 그린 옛 별).
 *     ⇒ ★기본값을 ★어느 정수 ％로 둬도 ★옛 별과 ★안 맞는다. ⇒ ★미설정을 ★특례로 둔다.
 *   ★이 꼴은 ★이 파일의 선례와 ★같다 — `dataset.starPoints` 미설정 → n=5 → OLD_POINTS.
 *     (레포 관례: 「★새것은 ★새 기본값, ★옛것은 ★저장값」)
 * ⚠️★슬라이더 초기 표시는 ★40 이다(0.3971 에 가장 가까운 정수). ★사람이 ★그 칸을 ★만지면
 *   비가 ★0.3971 → ★0.40 이 되어 ★R_IN 이 ★36 → ★36.26 (★0.26px) ★미세하게 달라진다.
 *   ⇒ ★★사람이 ★만진 ★뒤의 일이라 ★무해로 판단했다(지디 승인 2026-10-07).
 * ★기하 제약 ★0건 — ★비 0.15~0.95 × n=3~12 ★전수에서 viewBox(200×190)를 넘는 좌표가 ★0건이다(실측).
 *   ⇒ ★그래서 범위를 ★15~95 로 ★넓게 열 수 있다. ★막아둔 까닭이 ★없다. */
export const STAR_INNER_MIN = 15;
export const STAR_INNER_MAX = 95;
export const STAR_INNER_DISPLAY = 40;   // ★슬라이더 «초기 표시»뿐 — ⛔dataset 기본값이 아니다

/** 통통함 ％ → 15~95 정수, 또는 ★null(미설정 = 옛 별). ⛔null 을 숫자로 바꾸지 마라. */
export function clampStarInner(v) {
  if (v === undefined || v === null || v === '') return null;
  const k = Math.round(Number(v));
  if (!Number.isFinite(k)) return null;
  return Math.min(STAR_INNER_MAX, Math.max(STAR_INNER_MIN, k));
}

/** 통통함 ％ → 안쪽 반지름. null 이면 ★옛 R_IN 을 그대로 돌려준다. */
function _rIn(inner) {
  const k = clampStarInner(inner);
  return k === null ? R_IN : r2(R_OUT * k / 100);
}

/* ══ 별 «간격» (현빈 2026-10-07 「★별 ★간격 조절되면 좋겠고」) ══
 * ★고치기 전 = ★`starPointsAt` 의 dx 가 ★STAR_VB_W(200) «고정»이었다 ⇒ 조절 자리 0건.
 * ★★하한 ★−150 — ★지디 결정 2026-10-07. ★출처가 ★«기하»다(⛔Q1 과 다르다):
 *   ★★«완전히 가려지는» 점 = dx ≤ 0 ⇒ ★g ≤ ★−200 이고, ★★그것은 ★n 과 ★무관하다
 *     (dx 가 ★틀 폭에만 달렸다 · ★실측 n=3~12 전수).
 *   ⇒ ★★그래서 ★«고정 하한»이 ★존재한다 ⇒ ★−150 = 그 절대 하한의 ★50 전이다.
 *   ⛔−190 처럼 ★경계에 앉히지 않는다 — 「★꺾이는 점의 ★직전에 앉히지 마라」(2026-10-07 규율).
 *   ⛔겹침 «시작»점(−18.68 ~ −42.98)에서 ★파생하지 않는다 — ★그건 ★n 의 함수다.
 * ⚠️★상한 ★200 은 ★«잠정»이다 — ★★재서 ★까닭을 갈았다(2026-10-07):
 *   ⛔옛 까닭(「860 을 넘으면 ★잘리나 ★축소되나를 ★안 쟀다」)은 ★★죽었다. ★실측했다:
 *   ★★`preserveAspectRatio = none` ⇒ ★★«축소된다»(★가로로 ★납작해진다). ⛔★잘리지 ★않는다
 *     ★실측 — 별 하나의 화면 폭: count=1 ★70×66 → ★count=10 gap=0 ★★7×69 → count=10 gap=200 ★4×69
 *     ⇒ ★★그 납작함은 ★★count 가 ★이미 만든다. ★gap 은 ★더하는 쪽이다. ★잘림은 ★0건(overflowX:hidden)
 *   ★★★그리고 ★참 임자를 찾았다 — ★★«비일관»이다:
 *     `js/props/prop-shape.js applyStarCount` 는 ★count 를 올릴 때 ★프레임 폭을 ★N배로 ★키운다
 *       (★까닭이 거기 적혀 있다: 「★별 크기 유지 — ★현빈 판정 2026-10-06」)
 *     ★★그런데 ★`applyStarGap` 은 ★★폭을 ★안 키운다 ⇒ ★★gap 을 늘리면 ★납작해진다
 *     ⇒ ★★현빈의 ★판정을 ★한쪽만 지키고 있다
 *   ⇒ ★★그래서 ★★납작함의 ★임자는 ★★«별건»이다(★지디 2026-10-07 · 처방 권고 = ★gap 도 폭을 키운다).
 *     ⛔이 묶음에 ★넣지 않았다 — ★이번 일은 ★«간격 칸을 만드는 것»이고 ★폭 연동은 ★다른 기능이다.
 *     ★선행: ★「별 크기 유지」를 ★재는 자의 ★분모 세기(★applyStarCount 의 검사가 깨질 수 있다).
 *   ⇒ ★그 별건이 서면 ★상한을 ★확정한다. ★그때까지 ★200.
 * ★★count=1 이면 dx=0 이라 ★간격과 ★무관하다 ⇒ ★옛 바이트 규율이 ★안 깨진다(실측). */
export const STAR_GAP_MIN = -150;
export const STAR_GAP_MAX = 200;
export const STAR_GAP_DEFAULT = 0;

export function clampStarGap(g) {
  if (g === undefined || g === null || g === '') return STAR_GAP_DEFAULT;
  const k = Math.round(Number(g));
  if (!Number.isFinite(k)) return STAR_GAP_DEFAULT;
  return Math.min(STAR_GAP_MAX, Math.max(STAR_GAP_MIN, k));
}

export function starPoints(n, inner) {
  const k = clampStarN(n);
  const ip = clampStarInner(inner);
  /* ★미설정 ＋ n===5 = ★옛 별 «그대로»(바이트 동일). ⛔계산 결과로 바꾸지 마라. */
  if (ip === null && k === 5) return OLD_POINTS;
  return _coords(k, _rIn(ip)).map(([x, y]) => x + ',' + y).join(' ');
}

export function starClipPath(n, inner) {
  const k = clampStarN(n);
  const ip = clampStarInner(inner);
  if (ip === null && k === 5) return OLD_CLIP;
  const p = (v, d) => r2(v / d * 100) + '%';
  return 'polygon(' + _coords(k, _rIn(ip)).map(([x, y]) => p(x, STAR_VB_W) + ' ' + p(y, STAR_VB_H)).join(', ') + ')';
}

/* ══ 별 «갯수» (현빈 2026-10-06 「우측패널에 갯수추가하기하면 별 갯수가 여러개 추가되게 해줄래?」) ══
 * ★판정(지디가 현빈께 그림으로 여쭤 받음, 2026-10-06): «한 블록 안에 별 N개» ＋ 「늘리면 블록이
 *   옆으로 넓어진다(별 크기 유지)». ⛔블록을 N개로 복제하는 안은 아니다.
 * ★고치기 전 실측: 별 패널 라벨 전수 = 색상·외곽선·두께·W·H·꼭짓점·회전° ⇒ 「갯수」 0건.
 *   꼭짓점을 5→7 로 올리면 polygon 1개 그대로 · 좌표쌍 10→14 ⇒ «한 별의 뾰족한 끝»이 바뀌었다.
 * ★별 하나의 틀(200×190)을 가로로 N번 잇는다 ⇒ viewBox = (200·N) × 190.
 *   ⇒ 각 별의 «비율»이 N 과 무관하게 같다. 래퍼 프레임 폭을 N배로 키우면 별 크기가 유지된다.
 * ★count===1 은 ★옛 문자열을 그대로 돌려준다 — 저장된 별·내보내기와 바이트 동일(starPoints 의
 *   n===5 특례와 같은 규율). ⛔계산 결과로 바꾸지 마라.                                        */
export const STAR_COUNT_MIN = 1;
export const STAR_COUNT_MAX = 10;
export const STAR_COUNT_DEFAULT = 1;

export function clampStarCount(c) {
  const v = Math.round(Number(c));
  if (!Number.isFinite(v)) return STAR_COUNT_DEFAULT;
  return Math.min(STAR_COUNT_MAX, Math.max(STAR_COUNT_MIN, v));
}

/** 별 count 개를 담는 viewBox 문자열. count=1 이면 SHAPE_DEFS.star.vb 와 ★바이트 동일. */
export function starViewBox(count, gap) {
  const c = clampStarCount(count);
  const g = clampStarGap(gap);
  /* ★간격은 ★별 «사이»에만 든다 ⇒ (c−1) 번. ★c=1 이면 ★0 ⇒ 옛 문자열과 ★바이트 동일. */
  return `0 0 ${STAR_VB_W * c + g * (c - 1)} ${STAR_VB_H}`;
}

/** i 번째(0부터) 별의 points — 별 하나의 좌표를 가로로 i·200 만큼 옮긴 것. */
export function starPointsAt(n, i = 0, gap, inner) {
  const base = starPoints(n, inner);
  const dx = (STAR_VB_W + clampStarGap(gap)) * Math.max(0, Math.round(Number(i)) || 0);
  if (!dx) return base;
  return base.trim().split(/\s+/)
    .map(pair => { const [x, y] = pair.split(','); return (r2(Number(x) + dx)) + ',' + y; })
    .join(' ');
}

/** 별 count 개의 polygon points 배열. count=1 이면 [starPoints(n)] — 옛 한 벌 그대로. */
export function starPointsList(n, count, gap, inner) {
  const k = clampStarCount(count);
  return Array.from({ length: k }, (_, i) => starPointsAt(n, i, gap, inner));
}
