/* outer-pad — 「패딩 제외(full-bleed)」가 ★되먹을 섹션 좌우 패딩. ★이 파일의 전부가 그 함수 하나다. (2026-10-06 ⒜-2)
 *
 * ★왜 뽑았나 — ★같은 함수가 ★두 벌이었다. 실측(주석 뺀 본문을 공백 없이 눌러 diff):
 *     js/blocks/chat-block.js   `_effSectionPadX`  ─┐ ★한 글자도 안 다르다
 *     js/blocks/canvas-block.js `_effSectionPadX`  ─┘
 *   ⇒ 두 벌이면 한쪽이 ★조용히 늙는다. 이 레포가 그 병을 여러 번 앓았다.
 *
 * ⛔에셋의 `applyExcludePadX`(js/block-factory.js)는 ★«다른 함수»다 — ★합치지 않는다. 다른 점 ★넷(실측):
 *     ㉠ 전역 토글 `pageSettings.padXExcludesAsset` 을 ★먼저 본다
 *     ㉡ `ASSET_PRESETS[preset].width` 고정폭 ★가드가 있다
 *     ㉢ `.section-inner` 가 없으면 ★0 이 아니라 ★global padX 를 쓴다
 *     ㉣ 값을 ★돌려주지 않고 margin/width 를 ★직접 적용한다
 *   ★chat-block.js 의 「에셋 패턴 ★미러」 주석은 «패턴»을 가리킨 말이고 «같은 함수»가 아니다.
 *   ⛔그 낱말을 「사본」으로 읽으면 ★합쳐서 동작이 바뀐다(2026-10-06 에 내가 그렇게 읽었고, 본문을 눌러 견줘 잡았다).
 *   ⇒ 「합친 것을 재는 쌍」: 이 함수를 무력화하면 ★챗·캔버스 ★2곳이 빨강 · ★에셋은 ★초록(음성대조).
 *
 * ★자유배치 프레임에서 ★0 을 돌려주는 것은 ⛔«구멍이 아니라 설계»다 —
 *   그 안의 블럭은 absolute 배치라 full-bleed 가 뜻이 없다(에셋 가드와 같은 규약).
 *   ★실측 2026-10-06: 기본 프레임이 data-free-layout="true" 라 프레임 안 챗의 full-bleed 는 «안 돈다».
 *   ⛔그걸 「고쳐야 할 구멍」으로 읽지 마라 — 세 블럭이 같은 규약을 공유한다.
 *
 * ⛔이 파일은 ★import 가 0 이다 — 하네스가 모듈을 골라 싣는 자리(tests/dom/number-field-contract 등)에서
 *   간선 하나가 그래프를 통째로 키워 __ready 가 안 켜지는 사고가 있었다(까닭은 js/blocks/chat-bounds.js 머리말).
 */

/**
 * 이 블럭이 「패딩 제외」로 되먹을 섹션 좌우 패딩(px).
 * @param {Element} block
 * @returns {number} 0 이면 되먹을 것이 없다(자유배치 프레임 안 · 섹션 밖).
 */
export function effSectionPadX(block) {
  // 자유배치 프레임 내부는 absolute 배치 → full-bleed 무의미 (에셋 applyExcludePadX 가드 미러)
  if (block.closest?.('.frame-block[data-free-layout="true"]')) return 0;
  const inner = block.closest?.('.section-inner');
  if (!inner) return 0;
  const hasOverride = inner.dataset.paddingX !== '' && inner.dataset.paddingX !== undefined;
  if (hasOverride) return parseInt(inner.dataset.paddingX) || 0;
  return window.state?.pageSettings?.padX || 0;
}
