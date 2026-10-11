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
 * ★★★그 유보를 ★풀었다 (2026-10-10 · 1010t1b · 지디 판정) ─ ⛔«열린 채»로 두지 않는다:
 *   ★★「라운드」는 ★★1010t1b 에서 ★★뺐고, ★★★현빈 ★판정으로 ★올렸다(조정자 명부).
 *   ★까닭 ⑴ ★그것이 ★★현빈 ★원문에 ★있다 — ★섹션 `data-memo` 의 그 줄이 ★출처다(t1bstar 실측)
 *        ⇒ ★★«범위 밖»이 ★아니다. ⛔「안 쓰여 있었다」로 ★치우면 ★현빈 요구를 ★조용히 ★빼는 것이 된다.
 *   ★까닭 ⑵ ★그런데 ★비용이 ★★다른 축이다(polygon→path · 이미지 clip · 내보내기 ★셋)
 *        ⇒ ★★그래서 ★«넣나 빼나»는 ★★현빈이 ★고를 일이다 — ★지디도 ★내가도 ★안 고른다.
 *   ⇒ ★★다음 사람에게: ★이 자리에서 ★★판정을 ★기다리지 ★마라. ★★현빈 답이 ★오면 ★그때 ★선다.
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
/* ══ 1010t1b ★실측 ★기록 (t1bstar · 2026-10-10 · ★기준판 bcd8e7861740) ══════════════
 * ★왜 ★여기 적나 — ★위 「⚠️상한 200 은 ★«잠정»」이 ★「★그 별건이 서면 ★상한을 확정한다」로
 *   ★유보해 둔 그 물음을 ★★1010t1b1(현빈 2026-10-10)이 ★되살렸다. ★그 별건 = ★★«gap 도 폭을 키운다».
 * ★현빈 원문(1010t1b1): 「우측패널에서 ★간격을 조절하면 ★해당 블럭의 ★너비가 늘어나며, ★별모양이 아닌
 *   ★별모양 간의 갭이 조절되어야될 것 같은데, ★너비고정에 ★간격이 넓어지면 ★별모양 ★비율까지 영향을
 *   끼치게 되더라. ★별모양 블럭의 ★너비가 조절되게함으로써 ★별모양 영향을 안 끼치는 선에서」
 *
 * ★★쟀다 — ★자 = ★node 로 ★이 파일의 ★순수함수를 ★불러서. ⛔창(DOM) 안 썼다.
 *   ⒜ ★★라이브 대조 — 현빈 블록 shp_1p9hd3j (프로젝트 proj_1791204636612 · 섹션 sec_ts0he_z2e9rv0)
 *      ★저장된 dataset = starCount 5 · starInner 48 · starGap 15 · ★저장된 viewBox 가 "0 0 1060 190"
 *      ⇒ ★starViewBox(5,15) 가 ★그 문자열과 ★★바이트 동일하다 ⇒ ★★식이 ★라이브 데이터로 ★확인됐다.
 *   ⒝ ★★납작함의 ★수 — ★프레임 폭 500 ★고정(현빈 실제 data-width) · count 5 · inner 48 에서
 *      ★별 하나의 ★화면 크기(px)와 ★가로:세로 비:
 *        gap 0 → 86.22×86.32 (비 0.9988)   ★gap 15 → 81.34×86.32 (비 ★0.9423) ←★현빈이 지금 보는 값
 *        gap 50 → 71.85×86.32 (0.8324) · gap 100 → 61.59×86.32 (0.7134) · gap 200 → 47.90×86.32 (★0.5549)
 *      ⇒ ★★세로는 ★불변이고 ★가로만 ★줄어든다. ★현빈 말 그대로다. ★상한에서 ★★44.5% 납작하다.
 *   ⒞ ★★둘째 결함 — ★`applyStarCount`(prop-shape.js) 의 ★폭 비가 ★`c/prev` 라 ★★gap 을 ★안 센다.
 *      ★정확비 = (틀폭·c ＋ g·(c−1)) / (틀폭·prev ＋ g·(prev−1))
 *      ★gap 15 에서 ★오차: prev 1→5 ★−5.66% · 5→6 −0.24% · 5→10 −0.70% · 2→3 −1.19%
 *      ★★gap 0 이면 ★오차 0 ⇒ ★기존 검사가 ★전부 gap 0 이라 ★초록이었고 ★★안 잡혔다.
 *   ⒟ ★★분모 — 「별 크기 유지」를 ★재는 칸은 ★tests/dom/shape-star-count.dom.spec.js 의 ★★S3 ★하나다
 *      (그 파일 ★시험 수 ★9 · 자 = ★python 으로 ★주석 떼고 셌다 · ⛔셸 grep 은 ★13 이라 ★틀렸다)
 *      ★S3 는 ★gap 을 ★안 건드린다(폭 100→300→200→100) ⇒ ★폭을 ★viewBox 폭에서 ★파생해도 ★안 깨진다.
 *      ★★그래서 ★곧 ★이 뜻이다 — ★★gap≠0 을 ★재는 자가 ★★0건이다. ★새 자를 ★세워야 한다.
 *
 * ★★아직 ★모른다 — ⛔「닫았다」로 ★읽지 ★마라
 *   ⒤ ★납작함을 ★★화면에서 ★한 번도 ★안 봤다. ⒝ 는 ★순수함수 ＋ ★preserveAspectRatio=none 의
 *      ★정의에서 ★«계산»한 값이다 — ★viewBox 식만 ★⒜ 로 ★바이트 대조됐다.
 *   ⒥ ★폭이 ★패널 상한에 ★닿을 때 ★gap 을 ★count 와 ★같게 ★멈추나 — ★★미정(지디 판정 대기).
 *   ⒦ ★gap 상한을 ★푸나 ★두나 — ★위 「잠정」의 그 물음. ★★미정(지디 판정 대기).
 *   ⒧ ★내보내기 — ★export-html 은 캔버스를 ★cloneNode 해 ★innerHTML 을 뱉는다 ⇒ ★DOM 이 ★그대로 나간다.
 *      ⛔★export-figma-json 의 ★_shapeFigmaBlock 은 ★dataset 을 ★필드별로 ★다시 짓고 ★폴리곤을 ★안 읽는다
 *      ⇒ ★★별 갯수·간격·통통함이 ★★오늘 ★이미 ★피그마에선 ★별 ★하나로 간다(★기존 결함 · ★이 묶음과 무관).
 *      ★★이건 ★소스 독해다 — ★내보내기를 ★돌려 ★산출물을 ★본 것이 ★아니다. */

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

/* ★viewBox 의 ★«가로»만 — ★`starViewBox` 와 ★★같은 식을 ★한 자리에서 낸다.
 * ★★왜 뽑았나(1010t1b1) — ★폭 연동이 ★이 수를 ★필요로 한다. ⛔부르는 쪽에서 ★식을 ★다시 쓰면
 *   ★★명부가 ★둘이 되고, ★그 둘이 ★어긋나면 ★★별이 ★조용히 ★납작해진다(★그게 ★b1 의 ★흠이었다).
 * ⇒ ★`starViewBox` 도 ★이 함수를 ★쓴다 — ★★식은 ★여기 ★하나뿐이다. */
export function starViewBoxWidth(count, gap) {
  const c = clampStarCount(count);
  const g = clampStarGap(gap);
  /* ★간격은 ★별 «사이»에만 든다 ⇒ (c−1) 번. ★c=1 이면 ★0 ⇒ 옛 폭과 ★같다. */
  return STAR_VB_W * c + g * (c - 1);
}

/** 별 count 개를 담는 viewBox 문자열. count=1 이면 SHAPE_DEFS.star.vb 와 ★바이트 동일. */
export function starViewBox(count, gap) {
  return `0 0 ${starViewBoxWidth(count, gap)} ${STAR_VB_H}`;
}

/* ══ ★«별 하나의 비»를 ★지키는 ★프레임 폭 (현빈 2026-10-10 · 1010t1b1) ════════════
 * ★현빈 원문: 「★너비고정에, ★간격이 넓어지면 ★별모양 ★비율까지 영향을 끼치게 되더라.
 *               ★별모양 블럭의 ★너비가 조절되게함으로써 ★별모양 영향을 ★안 끼치는 선에서」
 * ★★무엇이 흠이었나 — ★이 파일의 ★간격 머리말이 ★이미 ★임자를 ★이름으로 지목해 뒀다:
 *   ★`applyStarCount` 는 ★폭을 ★키웠고 ★`applyStarGap` 은 ★★안 키웠다 ⇒ ★★현빈 판정
 *   「별 크기 유지」(2026-10-06)를 ★★한쪽만 ★지키고 있었다.
 * ★★식 — ★`preserveAspectRatio="none"` 이라 ★가로 배율 = ★W / vbW 다.
 *   ⇒ ★별 하나의 ★비를 ★지키려면 ★★그 배율을 ★붙들어야 한다 ⇒ ★W' = ★W · vbW' / vbW
 *   ★★이 식은 ★count 든 ★gap 이든 ★★같다 — ★그래서 ★★둘이 ★이 함수 ★하나를 ★쓴다(지디 판정 ③).
 *     ⛔따로 분기하지 마라 — ★분기하면 ★★명부가 ★둘이 된다.
 * ★★★그리고 ★그게 ★옛 식의 ★흠도 ★같이 고친다 — ★옛 `c/prev` 는 ★★gap 을 ★안 셌다.
 *   ★실측(t1bstar 2026-10-10 · gap 15): prev 1→5 에서 ★−5.66% · 5→6 −0.24% · 5→10 −0.70%
 *   ★★gap 0 에서는 ★`c/prev` 와 ★★항등이다 ⇒ ★그래서 ★기존 검사(전부 gap 0)가 ★초록이었고 ★안 잡혔다.
 * ⚠️★클램프는 ★여기 ★없다 — ★W 의 ★상·하한은 ★패널의 것이고(슬라이더와 ★같은 수) ★부르는 쪽이 ★쥔다.
 *   ★까닭: ★이 파일은 ★«별의 기하»만 안다. ★860 은 ★★도형 패널의 수다. */
export function starFrameWidthFor(curW, prevCount, prevGap, nextCount, nextGap) {
  const w = Number(curW);
  const prevVb = starViewBoxWidth(prevCount, prevGap);
  const nextVb = starViewBoxWidth(nextCount, nextGap);
  if (!Number.isFinite(w) || w <= 0 || prevVb <= 0 || nextVb <= 0) return null;
  return w * nextVb / prevVb;
}

/** i 번째(0부터) 별의 points — 별 하나의 좌표를 가로로 i·(200＋간격) 만큼 옮긴 것.
 *  ★`scale`(1010t1b2 · ％)이 있으면 ★«그 별의 중심»에서 ★배율을 ★points 에 ★녹인다.
 *  ★★배율 미설정·100 이면 ★★옛 길을 ★그대로 탄다 — ★계산을 ★안 타므로 ★바이트가 ★동일하다. */
export function starPointsAt(n, i = 0, gap, inner, scale) {
  const base = starPoints(n, inner);
  const dx = (STAR_VB_W + clampStarGap(gap)) * Math.max(0, Math.round(Number(i)) || 0);
  const s = clampStarScale(scale);
  /* ★★옛 길 — ⛔배율이 없으면 ★한 글자도 ★다른 계산을 ★타지 않는다(바이트 보존의 자리) */
  if (s === null || s === STAR_SCALE_DEFAULT) {
    if (!dx) return base;
    return base.trim().split(/\s+/)
      .map(pair => { const [x, y] = pair.split(','); return (r2(Number(x) + dx)) + ',' + y; })
      .join(' ');
  }
  /* ★배율은 ★«그 별의 중심»(CX＋dx, CY)에서 — ⛔틀 원점에서 주면 ★별이 ★옆으로 ★밀린다 */
  const k = s / 100;
  const cx = CX + dx;
  return base.trim().split(/\s+/)
    .map(pair => {
      const [x, y] = pair.split(',').map(Number);
      return r2(cx + (x - CX) * k) + ',' + r2(CY + (y - CY) * k);
    })
    .join(' ');
}

/** 별 count 개의 polygon points 배열. count=1 이면 [starPoints(n)] — 옛 한 벌 그대로.
 *  ★`scales` = `data-star-scales` 문자열(1010t1b2) — ★미설정이면 ★전부 옛 길이다. */
export function starPointsList(n, count, gap, inner, scales) {
  const k = clampStarCount(count);
  const sl = starScaleList(scales, k);
  return Array.from({ length: k }, (_, i) => starPointsAt(n, i, gap, inner, sl ? sl[i] : null));
}

/* ══ 별 «평점»(별점) (현빈 2026-10-10 · 1010t1b3) ═══════════════════════════════
 * ★현빈 원문: 「★별점기능이 들어가야함 ★챗블럭에 ★이미 있는 기능인데 ★참고
 *               (★별점기능을 하면 ★별이 ★5개로 구성)」
 *   ＋ `data-memo` 의 그 줄: 「우측패널에서 ★평점입력가능했으면 좋겠거든」
 * ★★꼴을 ★새로 짓지 않았다 — ★챗블럭에서 ★빌렸다. ★정본 = `js/blocks/chat-block.js`
 *   그 줄이 ★채운 별과 ★빈 별을 ★두 색으로 ★가른다(0~5 ★정수 · 미설정이면 ★키가 없다).
 * ★★색을 ★여기 ★다시 적는 까닭 — ⛔명부를 ★둘로 ★만드는 것이 ★아니다:
 *   챗은 ★«글자»(`<span>★`)에 ★color 를 주고 ★별 도형은 ★«polygon»에 ★fill 을 준다 ⇒ ★쓰는 자리가 ★다르다.
 *   ⇒ ★그래서 ★값을 ★빌리고, ★★«두 값이 ★챗과 ★같다»를 ★★검사로 ★잠근다
 *     (★이 파일의 ★선례와 ★같은 규율: 「SHAPE_DEFS.star 의 옛 문자열 == starPoints(5) — 명부가 둘이라 ★대조로 잠근다」)
 * ★★미설정 = ★«평점 아님»이다 — `dataset.starRating` 이 ★없으면 ★칠을 ★안 한다(옛 별 그대로 · 바이트 보존).
 *   ★이 꼴은 ★`starInner`·`starGap` 의 ★특례와 ★같다.
 * ★★분모는 ★5 ★고정이다(지디 판정 ⑤ 2026-10-10) — 「★구성」이 ★고정을 뜻하고,
 *   ★3/5 를 ★그리려면 ★분모가 ★5 여야 ★뜻이 선다. ⇒ ★켜면 ★갯수가 ★5 로 ★잠긴다(★끄면 ★풀린다).
 * ★★반쪽 별(3.5)은 ★안 받는다(지디 판정 ④) — ★챗이 ★0~5 ★정수고 ★현빈이 ★「챗블럭 참고」라 하셨다.
 *   ⇒ ★범위를 ★넓히는 것은 ★★현빈 건이다. ⛔여기서 ★넓히지 ★않는다. */
export const STAR_RATING_MIN = 0;
export const STAR_RATING_MAX = 5;
export const STAR_RATING_COUNT = 5;      // ★「별이 5개로 구성」 — ★평점의 ★분모
export const STAR_FILL_ON  = '#ff8a00';  // ★채운 별 — ★챗과 ★같다(검사로 잠근다)
export const STAR_FILL_OFF = '#d6d6d6';  // ★빈 별 — ★챗과 ★같다(검사로 잠근다)

/* ══ ★별점의 ★«두 색» — `data-star-fill-on` · `data-star-fill-off` ════════════════════
 * ★현빈 원문(2026-10-11): 「★주황/회색인데 ★각각 내가 ★다른 색으로 ★빨강/회색 , ★파랑/연파랑
 *   ★이런식으로 하고 싶을 수도 있으니 ★★내가 컨트롤 가능하게 해달라는것」
 *   ⇒ ★★«채운 색»과 ★★«빈 색» ★★두 칸 · ★★임의의 색.
 *
 * ★★앞 판(⒠ · f4cd889f)은 ★★2택(주황·회색)이었고 ★★그 요구의 ★부분집합이었다.
 *   ⇒ ★지디 판정 ㉠: ★2택을 ★버리고 ★자유색으로. ★★단 ★★폴백은 ★★그대로 ★산다 —
 *     ★★「모르는 값 ⇒ 주황」의 ★★참 몫은 ★★«쓰레기 값이 와도 ★화면이 안 깨진다»이고,
 *     ★바뀌는 것은 ★★«무엇이 ★모르는 값인가»라는 ★★술어 ★하나다(2택인가 → ★★유효한 #RRGGBB 인가).
 *
 * ★★★«명부가 하나인가» — ⛔이 레포엔 ★6자리 hex 를 ★재는 자가 ★★45곳쯤 ★흩어져 있다(★실측).
 *   ★`gradient-block.js:208` 의 ★`_HEX6` 는 ★★함수 안 지역 상수고 ★★export 가 ★아니다.
 *   ★`color-picker.js` 의 ★`formatHex6` 는 ★export 지만 ★★그 파일은 ★무겁다 —
 *     ★이 파일은 ★★`import` 출처가 ★★0 인 ★★잎 모듈이고, ★★그 잎성이 ★하네스 그래프를 ★지킨다(★실측).
 *   ⇒ ★★그래서 ★★«별 축의 ★명부»를 ★★여기 ★한 번만 ★두고 ★소비자가 ★끌어다 쓴다.
 *     ⛔`prop-shape.js` 에 ★또 ★적지 ★마라 — ★그러면 ★46번째가 ★된다.
 *
 * ★★미설정(키 없음) = ★★기본 두 색 ⇒ ★★옛 저장본과 ★바이트 ★동일하다. */
export const STAR_FILL_GREY = '#9e9e9e';
/** ★UI 가 ★★«권하는» 견본 — ⛔«허용되는 것의 ★전부»가 ★아니다(★자유색이 ★기본이다).
 *  ★이름을 ★`CHOICES`→`SWATCHES` 로 ★갈았다: ★`choices` 는 ★★«이것만 된다»로 ★읽혀 ★★이제 ★거짓이다. */
export const STAR_FILL_SWATCHES = Object.freeze([STAR_FILL_ON, STAR_FILL_GREY, STAR_FILL_OFF]);

/** ★6자리 hex 하나 — ★★별 축의 ★유일한 자리(위 머리말의 그 까닭). */
export const STAR_FILL_HEX6 = /^#[0-9a-fA-F]{6}$/;

/** ★색 하나를 ★받는다. ★★유효한 `#RRGGBB` 면 ★★소문자로 ★돌려주고, ★그 밖(미설정·빈 값·쓰레기)은 ★★`fallback`.
 *  ⛔null 을 돌려주지 ★마라 — ★부르는 쪽이 ★«칠하지 말라»로 ★읽는다(그건 ★`starFillsFor` 의 ★뜻이다). */
export function starFillColor(raw, fallback) {
  if (raw === undefined || raw === null) return fallback;
  const v = String(raw).trim();
  if (v === '') return fallback;
  return STAR_FILL_HEX6.test(v) ? v.toLowerCase() : fallback;
}

/** 평점 → 0~5 정수, 또는 ★null(미설정 = 평점 아님). ⛔null 을 숫자로 바꾸지 마라. */
export function clampStarRating(v) {
  if (v === undefined || v === null || v === '') return null;
  const k = Math.round(Number(v));
  if (!Number.isFinite(k)) return null;
  return Math.min(STAR_RATING_MAX, Math.max(STAR_RATING_MIN, k));
}

/** 별 count 개의 fill 배열. ★평점 미설정이면 ★null — ⛔«칠하지 않는다»는 뜻이다(빈 배열이 아니다). */
export function starRatingFills(rating, count, fill, fillOff) {
  const r = clampStarRating(rating);
  if (r === null) return null;
  const c = clampStarCount(count);
  /* ★★두 색 ★다 ★고를 수 있다(현빈 2026-10-11). ★각자 ★제 ★기본값으로 ★폴백한다.
     ⚠️★★둘이 ★같아도 ★막지 ★않는다 — ★★사람이 ★그렇게 ★고를 수 있다.
       ★그러면 ★«몇 점인가»가 ★안 읽히지만 ★★그건 ★사람의 ★선택이고, ★★여기서 ★되돌리면
       ★★«내가 ★고른 색이 ★안 들어간다»가 ★된다(★더 나쁜 고장). ⇒ ★판정은 ★패널이 ★말로 ★돕는다. */
  const on  = starFillColor(fill, STAR_FILL_ON);
  const off = starFillColor(fillOff, STAR_FILL_OFF);
  return Array.from({ length: c }, (_, i) => (i < r ? on : off));
}

/** 패널 미리보기 문자열 — 챗(prop-chat.js)의 그 꼴 그대로. */
export function starRatingPreview(rating) {
  const r = clampStarRating(rating) ?? STAR_RATING_MAX;
  return '★'.repeat(r) + '☆'.repeat(STAR_RATING_MAX - r);
}

/* ══ 별 «개별 색» (현빈 2026-10-10 · 1010t1b2 의 ★색 축) ═══════════════════════════
 * ★현빈 원문: 「캔버스에서 별모양의 쉐이프블럭을 ★더블클릭하면, ★개별 별모양 블럭을 선택하고
 *               ★색 지정 및 ★모서리 핸들로 크기조절이 ★개별로 가능하게 해줄 것」
 * ★★이 자리는 ★그 중 ★«색»뿐이다 — ★«크기»(starScales)는 ★★아직 ★안 만들었다(지디 판정 ⑧ 대기).
 *
 * ★★꼴 = ★index keyed ★목록. ★빈 칸 = ★«물려받는다»(그 별만 블록 색을 따른다).
 *   예: "#ff0000,,#00ff00"  ⇒ 0번 빨강 · ★1번 물려받음 · 2번 초록 · 그 뒤 전부 물려받음
 * ★★★미설정(키 없음) = ★«전부 물려받음» ⇒ ★옛 저장본과 ★바이트 동일하다.
 *   ★이 꼴은 ★`starInner`·`starGap`·`starRating` 의 ★특례와 ★★같은 규율이다. ⛔null 을 색으로 바꾸지 마라.
 *
 * ★★왜 ★dataset 인가 — ★★points 에 ★못 녹인다. ★색은 ★기하가 ★아니다.
 *   ＋ ★`_applyStarGeom` 이 ★사람이 ★패널을 ★만질 때마다 ★polygon 을 ★다시 쓴다
 *     ⇒ ★★DOM 의 fill 만 믿으면 ★★한 번 만지면 ★사라진다. ★★dataset 이 ★정본이다(그 파일의 그 문장).
 *
 * ★★★평점과 ★겹칠 때 — ★★«개별 색이 ★이긴다»로 두었다. ★★이것은 ★내 기본값이다(지디 판정 대기).
 *   ★까닭 = ★개별 색은 ★사람이 ★그 별 ★하나에 ★직접 한 일이고, ★평점 칠은 ★★평점에서 ★파생된 것이다.
 *     ⇒ ★«명시»가 ★«파생»을 ★이긴다.
 *   ★★그리고 ★둘은 ★★다른 dataset 에 ★따로 산다 ⇒ ★★어느 쪽도 ★남의 ★데이터를 ★지우지 ★않는다
 *     ⇒ ★★가역이다(★그라데이션 칸에서 ★배운 그 자). ⇒ ★뒤집어도 ★싸다.
 * ★★★그리고 ★칠의 ★임자는 ★★이 파일의 ★`starFillsFor` ★하나다 — ⛔부르는 쪽에서 ★섞지 마라.
 *   ★까닭: ★평점·개별색이 ★★각자 ★polygon 에 ★쓰면 ★★«누가 마지막에 썼나»가 ★칠을 정한다(순서 의존). */
export const STAR_COLORS_SEP = ',';

/** `data-star-colors` → (색|null) 배열 길이 count. ★미설정이면 ★null(=전부 물려받음). */
export function starColorList(raw, count) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const c = clampStarCount(count);
  const parts = String(raw).split(STAR_COLORS_SEP);
  const out = Array.from({ length: c }, (_, i) => {
    const v = (parts[i] === undefined ? '' : String(parts[i]).trim());
    return v === '' ? null : v;
  });
  /* ★★칸이 ★전부 ★비었으면 ★미설정과 ★같다 — ⛔",",",,," 가 ★«설정»으로 ★보이면 ★옛 바이트가 ★깨진다 */
  return out.some(v => v !== null) ? out : null;
}

/** (색|null) 배열 → `data-star-colors` 문자열. ★전부 null 이면 ★null(=키를 ★지우라는 뜻). */
export function starColorsAttr(list) {
  if (!Array.isArray(list) || !list.some(v => v)) return null;
  /* ★꼬리의 ★빈 칸은 ★버린다 — ★같은 뜻이면 ★짧은 쪽이 ★정본이다(직렬화가 ★흔들리지 않게) */
  const trimmed = list.slice();
  while (trimmed.length && !trimmed[trimmed.length - 1]) trimmed.pop();
  return trimmed.map(v => (v ? String(v) : '')).join(STAR_COLORS_SEP);
}

/* ★★★polygon 의 ★fill 을 정하는 ★★단 ★하나의 자.
 * ★돌려주는 배열의 ★null = ★★«fill 속성을 ★쓰지 ★말라»(=블록 색·그라데이션을 ★물려받는다).
 * ★우선순위: ★개별 색 ＞ ★평점 칠 ＞ ★물려받기. (★위 머리말의 그 까닭) */
export function starFillsFor({ rating, colors, count, fill, fillOff } = {}) {
  const c = clampStarCount(count);
  const rate = starRatingFills(rating, c, fill, fillOff);
  const cols = starColorList(colors, c);
  if (!rate && !cols) return null;                 // ★둘 다 미설정 = ★옛 별 그대로
  return Array.from({ length: c }, (_, i) => {
    const own = cols ? cols[i] : null;
    if (own) return own;                           // ★명시가 ★파생을 ★이긴다
    return rate ? rate[i] : null;
  });
}

/* ══ 별 «개별 크기» (현빈 2026-10-10 · 1010t1b2 의 ★크기 축 · 지디 판정 ⑧) ═══════════
 * ★현빈 원문: 「…★모서리 핸들로 ★크기조절이 ★개별로 가능하게 해줄 것」
 * ★★상태는 ★dataset 에 산다(지디 판정 ⑧ · 2026-10-10) — ⛔points 에 ★«녹이기만» 하면 ★사라진다:
 *   ★`_applyStarGeom` 이 ★사람이 ★아무 칸을 만질 때마다 ★points 를 ★dataset 에서 ★다시 만든다.
 *   ★실측: points 는 ★저장·복원은 ★된다(proj.json 에 글자로 있고 star 는 dynamic 이 아니라 canon 에 안 덮인다)
 *     ★★그러나 ★«패널 한 번 만지면» ★죽는다 ⇒ ★★저장되는 것과 ★살아남는 것은 ★다른 물음이다.
 * ★★«기하를 어디에 쓰나» = ★★points (지디 판정 · 유효) · ★★«상태가 어디 사나» = ★★dataset (이 자리)
 *
 * ★★★상한 ★100 — ★★기하에서 ★나왔다(⛔내가 고른 수가 ★아니다). ★실측 2026-10-10:
 *   ★배율을 ★«그 별의 중심»에서 ★올릴 때 ★y 가 ★viewBox(0~190)를 ★안 넘는 ★최대 배율
 *     = ★★1.0075 (★최악 = ★n=4 · inner 미설정 — ★짝수 n 은 ★꼭지가 ★아래를 ★곧장 가리킨다)
 *     ★손검산: 위 꼭지 s ≤ CY/R_OUT = 1.0882 · 아래 s ≤ (190−CY)/(R_OUT·cos36°) = 1.2453
 *     ⇒ ★n 에 따라 ★여유가 ★다르지만(n=5 는 ★1.088) ★★전수 최악의 ★내림이 ★100 이다.
 *   ★★왜 ★n 별 표를 ★안 만드나 — ★★그 표가 ★★«둘째 명부»다(n 을 키로 하는 수의 집합).
 *     ⇒ ★`starInner` 의 선례와 ★같은 꼴로 ★★전수에서 ★안전한 ★한 수를 ★쓴다.
 *   ★★★그래서 ★★«키우기»는 ★안 된다 — ★줄이기만 된다. ★★이건 ★★기능의 한계이고 ★지디·현빈께 ★올렸다.
 *     ★까닭 = ★별 하나의 ★틀이 ★200×190 이고 ★svg 는 ★viewBox 밖을 ★자른다
 *       (★`.shape-block .shape-svg` 에 ★overflow 선언이 ★0건 ⇒ ★바깥 svg 의 ★UA 기본값 = ★자른다)
 *     ⇒ ★키우려면 ★틀을 ★키워야 하고 ★그러면 ★★모든 별이 ★같이 작아진다(preserveAspectRatio=none)
 * ★하한 ★10 — ★★기하 제약이 ★없다. ★★내가 고른 수다(10％ 면 아직 보인다). ⇒ ★★넓혀도 ★싸다.
 * ★★★미설정(키 없음) = ★★전부 100 = ★옛 바이트 ★그대로. ⛔null 을 100 으로 ★바꾸지 마라. */
export const STAR_SCALE_MIN = 10;
export const STAR_SCALE_MAX = 100;
export const STAR_SCALE_DEFAULT = 100;

/** 배율 ％ → 10~100 정수, 또는 ★null(미설정). */
export function clampStarScale(v) {
  if (v === undefined || v === null || v === '') return null;
  const k = Math.round(Number(v));
  if (!Number.isFinite(k)) return null;
  return Math.min(STAR_SCALE_MAX, Math.max(STAR_SCALE_MIN, k));
}

/** `data-star-scales` → (％|null) 배열 길이 count. ★미설정이면 ★null. ★빈 칸·100 은 ★null(=배율 없음). */
export function starScaleList(raw, count) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const c = clampStarCount(count);
  const parts = String(raw).split(STAR_COLORS_SEP);
  const out = Array.from({ length: c }, (_, i) => {
    const v = clampStarScale(parts[i] === undefined ? '' : String(parts[i]).trim());
    /* ★100 은 ★«배율 없음»과 ★같다 ⇒ ★null 로 접는다 — ★옛 길(바이트 동일)을 ★타게 한다 */
    return (v === null || v === STAR_SCALE_DEFAULT) ? null : v;
  });
  return out.some(v => v !== null) ? out : null;
}

/** (％|null) 배열 → `data-star-scales` 문자열. ★전부 null 이면 ★null(=키를 ★지우라는 뜻). */
export function starScalesAttr(list) {
  if (!Array.isArray(list)) return null;
  const norm = list.map(v => {
    const k = clampStarScale(v);
    return (k === null || k === STAR_SCALE_DEFAULT) ? null : k;
  });
  if (!norm.some(v => v !== null)) return null;
  while (norm.length && norm[norm.length - 1] === null) norm.pop();
  return norm.map(v => (v === null ? '' : String(v))).join(STAR_COLORS_SEP);
}
