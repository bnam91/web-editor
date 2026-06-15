# Design FIX Plan (실행기록) — prop-panels · 2026-06-11

design-squad FIX 모드. report-2026-06-11-prop-panels.md 발견 중 현빈 일괄승인분(HTML 시트).
승인: 후보1·3·5(즉시) + 후보2 B안 + 후보4 selective. **커밋 안 함** — diff+재검증 보고까지.
검증: CDP 9334 computed style + 콘솔에러 0. 새 hex/색 추가 없음(토큰·표준클래스만).

## PR-1 (후보1) — 위험버튼 raw hex → 표준 ✅ 적용·검증
- prop-canvas.js:36 `.prop-btn +color:#e55` → `.prop-btn.prop-btn-danger` (인라인색 제거)
- editor-blocks.css `.cvb-card-btn-sm-del` `color:#e55` → `var(--ui-danger)`
- prop-frame.js:270·563 인라인 `#3a2a2a/#e06c6c` → `.prop-action-btn.danger`
- 검증: card 삭제색 rgb(224,108,108)=#e06c6c 토큰 확인. (frame "이미지 제거"는 솔리드 빨강 — 현빈 확인요청 보류)
- 정정: chat/step/comparison/banner02의 `.prop-btn.prop-btn-danger`(항목✕)는 이미 일관 → 손대지 않음.

## PR-2 (후보2 B안) — 풀폭버튼 역할별 ✅ 적용·검증
- 분류: prop-btn-full 라벨 중 "전체 적용"(label-group)만 primary 액션, 나머지(추가/업로드/교체/Pill·Box 토글)=중립.
- prop-label-group.js:72 "전체 적용" `.prop-btn-full` → `.prop-action-btn.primary`(파랑). 중립 버튼은 회색 유지.
- editor-props.css `.prop-export-btn` radius 5→4 (primary와 통일). 검증: export radius 4px 확인.

## PR-3 (후보3) — 헤더 아이콘 16px ✅ 적용·검증
- **26파일 미수정** — editor-props.css `.prop-block-icon svg { width:16px; height:16px; }` 1줄(CSS width가 svg width 속성 override). 헤더 아이콘이 전 패널 `.prop-block-icon` 안에 일관 → 안전.
- 검증: 실측 15.99px.

## PR-4 (후보4 selective) — 행 간격 ✅ 적용·검증
- prop-row 인라인 `margin-top:6px` 제거(더블마진 해소) + `gap:6px→4px`. 11파일 24곳. perl 셀렉터 앵커(`class="prop-row"`)로 prop-row만.
- **비-row 마진 보존**: 그래디언트 stop·textarea·chat profile-row·+추가버튼 등 margin-top:6px 유지(정상 간격).
- 검증: prop-row mt6/gap6 잔존 0, 비-row 마진 보존, 빈 style="" 0, JS 문법 정상.

## PR-5 (후보5) — step 아이템 간격 ✅ 적용·검증
- editor-props.css `.stb-prop-item` 정의 신설(표준 `.prop-line-card`와 동일: bg-elevated/border/radius6/pad8/mb8/gap6). CSS 미정의로 간격0이던 버그 해소.
- 검증: padding 8px / margin-bottom 8px.

## 영향 파일 (커밋 대기)
js/props/{prop-canvas, prop-frame, prop-label-group, prop-chat, prop-shape, prop-section, prop-sticker, prop-mockup, prop-iconify, prop-table, prop-vector, prop-text-template, prop-page}.js
css/{editor-props, editor-blocks}.css
※ editor-blocks.css 대형 diff는 이전 card-block 삭제분 — 이번 FIX는 1줄(cvb-card-btn-sm-del 색).

## 롤백
PR별 독립. git diff 범위 한정. 커밋은 현빈 승인 후 PR단위로 끊어 올림.
