/* prop-text-wireup-overlay.js
 * 텍스트블록 "오버레이(플로팅)" 토글 — Figma의 오버레이 버튼과 같은 개념.
 * 오토레이아웃(row/text-frame) 흐름에 속한 블록을 흐름에서 빼서 섹션 위에
 * position:absolute 로 띄운다. 다시 누르면 원래 있던 부모 · 순서로 복귀한다.
 *
 * ★2026-09-20 (0920b-overlay-extend / T-052) — 알맹이는 전부 js/overlay-float.js 로 옮겼다.
 *   현빈 원문 3번 「도형 블럭과 에셋 블럭에도 오버레이 버튼·기능」 때문에 같은 동작이 세
 *   패널에서 필요해졌는데, 이 파일은 2026-09-15~16 사이 후속 P0 수정만 11커밋을 받은 자리다
 *   (회전축 어긋남 · 클램프 범위 · 재부모 좌표 점프 · contenteditable 가드 · 복귀 섹션 오인 …).
 *   베껴 두 벌을 만들면 그 11개를 두 번 더 만든다 ⇒ 공용 모듈 하나로 두고 이 파일은
 *   «텍스트 패널의 배선»만 남긴다. 타입 차이(=위치를 쥔 요소)는 overlay-float.js posElOf 가 흡수한다.
 *
 * ★기존 자산 재사용(그대로 유효):
 *   - 선택 아웃라인 보라는 새 CSS가 아니라 js/selection-overlay.js 의 선언형 경로
 *     (`host.dataset.selVariant` → 'sticker' 변형 stroke = --ui-sel-overlay) 그대로 탄다.
 *   - ⛔이동 드래그는 «별도 배선 불필요」가 아니다(2026-09-15 정정). js/block-drag.js 의
 *     일반 절대배치 드래그는 «자기 free-layout 프레임 안에서만» 움직이는 것을 전제해서
 *     섹션 직속 오버레이엔 그 전제가 아예 없다 — 전용 드래그(overlay-float.js
 *     bindFloatMoveDrag, 전역 이름은 옛 이름 그대로 window._bindOverlayMoveDrag)를 쓴다.
 */

import { wireFloatToggle } from '../overlay-float.js';

export function wireOverlaySection({ tb }) {
  wireFloatToggle({
    block: tb,
    buttonId: 'txt-overlay-toggle',
    // 패널 재렌더 — 버튼 active 상태 + X/Y 값 갱신
    rerender: () => window.showTextProperties?.(tb),
  });
}
