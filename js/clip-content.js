/* clip-content.js — ★★«내용 자르기»의 ★★★단 하나의 ★술어와 ★★계열 표. (2026-10-10 · 현빈 1010t1c2)
 *
 * ★현빈 원문 ★c2 — 「★에셋블럭이나, ★그리드 블럭에 ★이미지줄를 추가했을때에도
 *   ★이미지 삽입할 수 있는 상황에서 ★★‘내용자르기’ 기능이 ★있으면 좋겠다」
 *
 * ★★왜 ★한 자리인가 (지디 판정 ㉠ · 2026-10-10)
 *   ★그 토글을 ★★계열마다 ★제 벌로 ★판정하면 ★★명부가 ★★넷이 된다(프레임·에셋·그리드 평형·그리드 원형).
 *   ⇒ ★★표를 ★★이 파일 ★하나에 두고 ★★부르는 자를 ★늘린다. ★선례 = `js/frame-bg.js`(★값을 넣는 자리 ★하나).
 *
 * ★★★계열별 ★기본값은 ★★다르다 — ★★그것을 ★★행위로 ★쟀다(⛔CSS 독해로는 ★세 번 ★틀렸다):
 *   ★프레임        ★★자른다   — `css/editor-blocks.css` `.frame-block { overflow: hidden }` (★2026-10-10 ②)
 *   ★에셋          ★★자른다   — `.asset-img-clip { overflow: hidden }` (★실측: ov hidden · ovInline null ·
 *                               ★밖에 잉크 ★false · ★★양성대조(자름 떼면) ★true)
 *   ★그리드 ★원형   ★★자른다   — ★★렌더러가 ★인라인으로 박는다(`js/blocks/grid-block.js:2296`)
 *                               ★까닭(그 파일 ㈏): ★CSS 에 두면 ★★내보낸 HTML·캡처 클론이 ★못 들고 간다
 *   ★★그리드 ★평형 ★★★안 자른다 — ★★★일부러 ★안 붙였다(그 파일 ㈐). ★★실측으로 ★두 번 ★고쳐 세운 자리다
 *                               ★까닭: ★붙이면 ★★flex 항목의 `min-height:auto` 가 ★★통째로 ★0 이 된다
 *                               (★★내 실측 2026-10-10: ★상자 ★[386, ★0]) ⇒ ★★c2 ㈁ 는 ★★범위 ★밖이다
 *
 * ★★★그래서 ★토글은 ★★«속성이 ★있을 때만» ★이긴다 — ⛔기본값을 ★★안 바꾼다:
 *   ★속성 ★없음  ⇒ ★★그 계열의 ★지금 기본값 (★★★옛 바이트 ★보존 · 지디 조건 ㉢)
 *   ★`'true'`   ⇒ ★자른다
 *   ★`'false'`  ⇒ ★안 자른다
 *   ★★까닭: ★★기본값을 ★뒤집으면 ★★★현빈의 ★기존 문서가 ★달라 보인다. ★★제 ② 가 ★프레임에서 ★그것을 했고
 *     ★★그 뒤 ★`1010t1c1`(「이동이 안 된다」)이 ★왔다 ⇒ ★★같은 꼴을 ★또 ★만들지 ★않는다.
 *
 * ⛔새 속성 이름을 ★만들지 ★마라 — ★★`data-clip-content` ★그대로다(★프레임이 ★쓰는 ★그 이름).
 *   ★선례: ★`.sec-bg-proxy` 를 ★안 바꾼 까닭 — ★★그 이름을 ★읽는 ★소비자가 ★따로 있다.
 */

/* ★★계열 표 — ★★★이 객체가 ★★유일한 명부다. ⛔부르는 자가 ★제 기본값을 ★들지 ★마라. */
export const CLIP_DEFAULTS = Object.freeze({
  /* ★★★«왜 ★이 계열이 ★이 기본값인가»를 ★★한 줄씩 적는다 (지디 조건 2026-10-10).
     ⛔까닭을 ★안 적으면 ★★다음 사람이 ★★«하나로 ★통일하자»를 ★한다 — ★★그 셋은 ★★까닭이 ★다르다. */
  frame: true,       /* `.frame-block` — ★현빈 1009t3-② 로 ★기본이 ★자름이 됐다(★CSS 맨 위) */
  asset: true,       /* `.asset-block` — ★`.asset-img-clip { overflow: hidden }` 래퍼가 ★자른다
                        ★＋ `io/save-load.js` 가 ★옛 데이터에 ★그 래퍼를 ★마이그레이션으로 ★붙인다 */
  gridCircle: true,  /* `.grd-img-frame.grd-img-circle` — ★렌더러가 ★인라인으로 ★박는다(grid-block.js:2296)
                        ★까닭(그 파일 ㈏): ★CSS 에 두면 ★★내보낸 HTML·캡처 클론이 ★그 규칙을 ★못 들고 간다 */
  gridPlain: false,  /* `.grd-img-frame`(원형 아님) — ★★★일부러 ★false 다. ⛔«빠뜨린 것»이 ★아니다.
                        ★까닭(그 파일 ㈐ · ★실측으로 ★두 번 ★고쳐 세운 자리):
                          ★`overflow:hidden` 을 붙이면 ★★flex 항목의 `min-height:auto` 가 ★★통째로 ★0 이 된다
                          (★★내 실측 2026-10-10: ★상자 ★[386, ★0])
                        ⇒ ★★그래서 ★★c2 ㈁ 는 ★★«토글 하나 추가»가 ★아니라 ★★«flex 가 ★무엇을 ★누르나»가 ★먼저다
                          — ★그 물음은 ★★그 파일에 ★★«별건»으로 ★이미 ★기록돼 있다 */
});

/** ★그 요소가 ★★어느 계열인가. ⛔부르는 자가 ★손으로 ★가르지 ★마라. */
export function clipFamily(el) {
  if (!el || !el.classList) return null;
  const c = el.classList;
  if (c.contains('frame-block')) return 'frame';
  if (c.contains('asset-block')) return 'asset';
  if (c.contains('grd-img-frame')) return c.contains('grd-img-circle') ? 'gridCircle' : 'gridPlain';
  return null;
}

/** ★★«이 블럭은 ★내용을 ★자르나» — ★★속성이 ★있으면 ★그것이, ★없으면 ★계열 기본값이 ★이긴다.
 *  @returns {boolean|null} ★계열을 ★모르면 ★`null`(⛔`false` 가 ★아니다 — ★「영은 답이 아니다」) */
export function clipsContent(el) {
  const fam = clipFamily(el);
  if (!fam) return null;
  const v = el.dataset ? el.dataset.clipContent : undefined;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return CLIP_DEFAULTS[fam];
}

/** ★★에셋의 ★자름을 ★★«렌더러가» ★먹인다 — ★지디 판정: ⛔`!important` 로 ★CSS 가 ★이기게 ★하지 ★않는다.
 *  ★★★옛 바이트 보존(조건 ㉢): ★속성이 ★★없으면 ★★인라인을 ★★★안 쓴다 ⇒ ★CSS 가 ★그대로 ★자른다.
 *    ⇒ ★★그래서 ★기존 문서의 ★저장 바이트가 ★★한 글자도 ★안 달라진다.
 *  ★끔일 때만 ★`overflow: visible` 을 ★인라인으로 쓴다(★CSS 와 ★같은 무게 · ★인라인이 ★이긴다).
 *  @returns {boolean} ★★«썼다/지웠다»가 ★아니라 ★★«자르나»를 ★돌려준다 — ★부르는 자가 ★또 안 세게. */
export function applyAssetClip(ab) {
  if (!ab || clipFamily(ab) !== 'asset') return false;
  const clip = ab.querySelector(':scope > .asset-img-clip');
  const on = clipsContent(ab);
  if (clip) {
    if (on) clip.style.removeProperty('overflow');   /* ★★미설정 꼴로 ★되돌린다 — ★CSS 가 ★자른다 */
    else clip.style.overflow = 'visible';
  }
  return !!on;
}

if (typeof window !== 'undefined') {
  window.clipsContent = clipsContent;
  window.clipFamily = clipFamily;
  window.applyAssetClip = applyAssetClip;
  window.CLIP_DEFAULTS = CLIP_DEFAULTS;
}
