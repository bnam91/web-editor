/* ═══════════════════════════════════
   VARIATION VISIBILITY — 「숨은 시안」의 «단일 술어»
   ═══════════════════════════════════

 * A/B 시안(js/section-variation.js)은 한 그룹에서 «하나만» 활성이다.
 *   활성  : data-variation-active="1"
 *   비활성: data-variation-active="0"  ← 화면에서 숨는다
 *          (css/editor-panels.css `.section-block[data-variation-active="0"]{display:none!important}`)
 *
 * ★이 파일이 있는 이유 — 그 「숨음」을 «본문 밖»에서도 물어야 하는 자리가 셋이다.
 *   ⑴ HTML 내보내기(js/io/export-html.js)      — 배송본에 안 쓰는 시안이 실리면 안 된다
 *   ⑵ Figma JSON(js/io/export-figma-json.js)   — 같은 이유. 같은 배송본이다
 *   ⑶ 인스펙터(js/inspector.js)                — 못 가는 곳을 세지도, 가지도 않는다
 *   이 조건을 세 파일에 «베껴» 두면 한 곳만 고쳐지는 날이 온다. 이 레포는 그걸로 이미
 *   버그를 냈다(tests/_export-channels.js 머리말 참조). ⇒ 술어는 여기 «한 곳»에 둔다.
 *
 * ⛔이 술어를 «저장 경로»에 쓰지 마라 — 저장본(.gdt · proj.json · 프로젝트 JSON)에서 빼면
 *   그건 숨기는 게 아니라 «시안을 지우는» 것이다. 여기는 «배송본과 화면»의 술어다.
 *
 * ★출처는 CSS 규칙과 «같은 조건»이다 — 화면에서 안 보이는 것이 곧 배송에서 빠지는 것이라
 *   「보이는 대로 나간다」가 성립한다. 조건을 좁히거나(그룹까지 요구) 넓히면 그 등식이 깨진다.
 */

/** 숨은 시안 표식 — css/editor-panels.css 의 숨김 규칙과 «같은» 셀렉터. */
export const HIDDEN_VARIATION_SEL = '[data-variation-active="0"]';

/** 숨은 시안 «섹션» — 클론에서 통째로 들어낼 때 쓴다. */
export const HIDDEN_VARIATION_SECTION_SEL = `.section-block${HIDDEN_VARIATION_SEL}`;

/** 순회 셀렉터에 덧대는 제외 절 — `'.section-block' + NOT_HIDDEN_VARIATION`. */
export const NOT_HIDDEN_VARIATION = `:not(${HIDDEN_VARIATION_SEL})`;

/** 그 요소 «자신»이 숨은 시안 섹션인가. */
export function isHiddenVariationSection(el) {
  return !!el && typeof el.getAttribute === 'function'
      && el.getAttribute('data-variation-active') === '0';
}

/** 그 요소가 숨은 시안 «안»에 있는가(자기 자신 포함). 블록은 섹션 안에 산다. */
export function isInHiddenVariation(el) {
  if (!el) return false;
  if (typeof el.closest === 'function') return !!el.closest(HIDDEN_VARIATION_SEL);
  return isHiddenVariationSection(el);   // closest 없는 판(구형/스텁) — 최소한 자기 자신은 본다
}

/** ★인스펙터가 「셀 것 = 갈 곳」을 고르는 술어. 지워졌거나 숨은 시안 안이면 «둘 다» 아니다.
 *  ⚠️isConnected 는 «명시적 false»만 거른다 — 속성이 없는 판(테스트 스텁)을 죽이지 않는다. */
export function isJumpTarget(el) {
  return !!el && el.isConnected !== false && !isInHiddenVariation(el);
}
