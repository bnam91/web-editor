---
paths:
  - "js/**"
---

# JS 편집 시 적용 규칙

## 블록 구조 원칙 (변경 금지)

### 프레임 블록 = Figma Frame

`frame-block`은 피그마 Frame과 동일한 개념. 자식 블록들의 컨테이너 역할.

### 텍스트·쉐이프 블록 — 단일 최소 단위

하위 레이어 열람 불가, 내부에 다른 요소 추가 불가한 최소 단위.

| 블록 | DOM 구조 | 규칙 |
|------|---------|------|
| 텍스트 | `frame-block[data-text-frame] > text-block` | text-frame은 투명 래퍼 |
| 쉐이프 | `frame-block > shape-block` | shape-frame은 투명 래퍼 |

- **너비 항상 동일**: `frame-block`(래퍼)과 내부 블록은 항상 같은 너비
- **한몸 이동**: DnD 시 래퍼와 콘텐츠는 반드시 함께 이동. 절대 분리 금지

### text-block 실제 구조

```html
div.text-block
  └─ div.tb-h1 (또는 tb-h2, tb-body, tb-caption, tb-label) [contenteditable]
```

### 레이어 패널 text-frame 투명 처리 — 전 레벨 적용

text-frame은 레이어 패널에서 **보이지 않아야** 한다. 내부 text-block을 직접 렌더링.

- `layer-panel.js` 섹션 루프: 적용됨
- `layer-panel-items.js > makeLayerFrameItem` 프레임 내부 루프: **반드시 동일하게 적용**
- **금지**: `makeLayerFrameItem` 내 자식 루프에서 `data-text-frame` 체크 누락 → "Frame + Text" 두 겹 표시됨

### text-frame CSS·인터랙션 규칙 (변경 금지)

text-frame은 **절대 `.selected` 클래스를 받지 않는다.**

```css
/* 올바름 — text-frame 제외 */
.frame-block:not(.selected):not([data-text-frame]) * { pointer-events: none; }

/* 금지 — text-block까지 pointer-events 차단됨 */
.frame-block:not(.selected) * { pointer-events: none; }
```

**`prop-text.js`**: width / X / Y 조작 시 `tb.closest('.frame-block[data-text-frame="true"]')` 로 text-frame 취득 후 수정. text-block 직접 style 수정 금지.

**drag-drop 세부 규칙**: `js/CLAUDE.md` 참조

### 에셋 블록 — 더블클릭 업로드

- **싱글 클릭**: 선택 전용
- **더블 클릭**: 이미지 업로드 파일 피커 (빈 블록) / 이미지 편집 모드 (이미지 있을 때)

---

## DOM 계층 구조 (현재)

```
section-block
  └─ section-inner
       ├─ frame-block[data-text-frame]   ← 텍스트 블록 투명 래퍼
       │    └─ text-block
       ├─ asset-block
       ├─ frame-block                    ← 프레임 블록 (Auto/Free layout)
       │    ├─ frame-block[data-text-frame] > text-block
       │    ├─ asset-block / gap-block / ...
       │    └─ frame-block               ← 중첩 프레임 가능
       └─ ...
```

- `data-free-layout="true"` → freeLayout (절대 위치 배치)
- `data-full-width="true"` → 전체 너비 플로우
- `data-text-frame="true"` → 텍스트 전용 투명 래퍼
