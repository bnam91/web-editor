# js/ — 모듈별 작업 지침

> 이 파일은 js/ 폴더 내 특정 파일에 적용되는 세부 규칙을 담는다.
> 프로젝트 전체 원칙은 루트 CLAUDE.md를 참고한다.

---

## 레퍼런스 모달 (`reference-modal.js`)

- 툴바는 모달 위에 `position:absolute` 오버레이 (이미지 크기 변화 없음)
- hover 시 height 0 → 32px 슬라이드다운
- 이미지 영역 전체 드래그 가능 (`ref-image-wrap` mousedown)
- 우하단 리사이즈 핸들 (`#ref-resize-handle`, z-index:3) — `mousedown` 인터셉트 가드 필요
- 슬라이더/버튼/input은 `e.target.closest('button, input, label, #ref-resize-handle')` 체크로 드래그 차단

---

## 텍스트 블록 패딩 (`prop-text.js`)

- 상하 패딩은 단일 슬라이더 `txt-pv-slider`로 top/bottom 동시 조절
- 개별 top/bottom 슬라이더 없음
