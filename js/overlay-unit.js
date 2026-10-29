/* overlay-unit.js — 섹션에 «떠 있는» 블럭 단위 판정 한 벌(248 · 2026-10-29).
 * 부르는 곳 둘: js/props/prop-multisel.js(여럿 고름 «서로 맞춤» · getSelectedOverlayUnits) · js/scratch-pad.js(선택상자 캔버스 대상 _marqueeCanvasTargets).
 * ★왜 한 벌인가 — 두 곳이 같은 단위(오버레이 래퍼 · 섹션 직속 줌)를 «각자» 들고 있었고, 1013t2C1(ac343b47)이 섹션 직속 스티커를
 *   «서로 맞춤» 쪽에만 더해 선택상자가 스티커(마킹·보통)를 못 골랐다(248 · 지디 판정 «명부가 둘인데 하나만 넓혔다»).
 *   ⛔소비자 쪽에 단위 선택자를 다시 적지 마라 — 명부가 다시 둘이 된다. 잠그는 자 = tests/unit/overlay-unit-248(O3).
 * ⛔어노테이션은 단위가 아니다(ac343b47 «어노테이션 제외» 결정). 그라데이션(섹션 직속)은 248 ㊂⒜ 판정 전 — 넣지 않았다.
 * (모듈 맨 위에 window 접근 없음 — 유닛이 node 에서 그대로 읽는다.) */
export const isStickerUnit = (u) => !!u?.classList?.contains('sticker-block');
export const isSectionHost = (el) => !!el && (el.classList?.contains('section-block') || el.classList?.contains('section-merged-part'));
export function overlayUnitOf(el) {
  const w = el.closest?.('[data-overlay-block="true"]');
  if (w && isSectionHost(w.parentElement)) return w;
  if (el.classList?.contains('zoom-block') && isSectionHost(el.parentElement)) return el;
  // ★1013t2C1 — 섹션 직속 스티커도 «떠 있는 블럭» 단위(줌과 같은 꼴) — ⌘/⇧ 로 여럿 고르면 「서로 맞춤」 · 248 부터 선택상자도
  if (isStickerUnit(el) && isSectionHost(el.parentElement)) return el;
  return null;
}
