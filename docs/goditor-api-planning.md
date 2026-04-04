# Goditor API 기획 작업 로그

> 시작일: 2026-04-03
> 목적: 이미지 분석 → 에디터 섹션 자동조립 파이프라인 설계

---

## 배경 및 목적

이미지를 분석해서 상페마법사 에디터에 섹션을 자동으로 조립하는 스킬(Claude Code)을 개발 중.
토큰 절약을 위해 **이미지 분석 파트는 GPT/Gemini**로, **에디터 실행 파트는 Claude Code CDP**로 분리하는 구조를 결정.

### 세 역할 구조

```
이미지
  ↓
[1] 이미지 분석 봇 (GPT / Gemini)
  ↓ JSON Spec
[2] 에디터 실행 봇 (Claude Code CDP — 포트 9336)
  ↓ window.* API 호출
[3] 웹에디터 (Electron)
```

- **[1]**은 모델 교체 자유 (계약은 JSON Spec)
- **[2]**는 Spec을 받아 실행만 함 (분석 로직 없음)
- **[3]**은 Spec 실행에 필요한 API를 `window.*`로 노출

---

## 현재 상태

### ✅ 완료
- 블록 타입 전수조사 (`/Users/a1/web-editor/js/block-factory.js` 기준)
- Goditor Spec v1 초안 작성 (`docs/goditor-spec-v1.md`)
- 3개 에이전트 병렬 평가 완료 (이미지봇 4.5/10, CDP봇 3/10, 스키마 6/10)
- **Spec v2 작성 완료** (`docs/goditor-spec-v2.md`) — 2026-04-03
- **paddingX API 설계 완료** (`docs/goditor-api-reference.md` v1.1) — 2026-04-03
  - 섹션 레벨: `addSection({ paddingX })` → `.section-inner` padding-left/right
  - 블록 레벨: `addTextBlock(style, { paddingX })` → `.row` padding-left/right
  - dataset 키: `data-padding-x` (JS: `dataset.paddingX`)
  - margin 아닌 padding 사용 (bg 색상 깨짐 방지)
- **`addAssetBlock` paddingX 옵션 구현** (`js/block-factory.js`) — 2026-04-04
  - `window.addAssetBlock('wide', { paddingX: 215 })` → row에 padding-left/right 215px
  - 섹션 paddingX와 독립적으로 동작 (col-active 분기 포함)
  - `row.dataset.paddingX` 저장 → save-load.js 재로드 시 자동 복원
  - `goditor-api.js` image 블록 케이스에도 `paddingX` 전달 추가
  - `docs/goditor-api-reference.md` addAssetBlock 섹션 업데이트 (opts 표 추가)

### 🔴 미완료
- **에디터 공개 API 추가** — `js/block-factory.js` 수정 (아래 누락 API 목록 참조)
- **`goditor-api.js` 구현** — `window.goditor.buildSection(spec)`
- CDP 스킬 업데이트 — spec executor 패턴으로 단순화
- 이미지 분석 프롬프트 작성 — GPT/Gemini용 시스템 프롬프트 + few-shot
- 에디터 공개 API 추가 (아래 누락 API 목록 참조)

---

## 평가 결과 요약 (2026-04-03)

### 이미지 분석 봇 관점 — 4.5/10

| 심각도 | 문제 |
|--------|------|
| 높음 | Section.label 분류 기준 없음 (Hook/Main/Detail 판단 불가) |
| 높음 | Row.layout 선택 기준 없음 (flex vs grid 판단 불가) |
| 높음 | asset preset 선택 기준 없음 (standard/square/tall/wide 구분 불가) |
| 높음 | 버튼(CTA), 뱃지, 가격 블록 타입 누락 |
| 중간 | text style 판단 기준 없음 (h2 vs h3, caption vs label) |
| 중간 | graph items 수치 추출 불가 (이미지에서 정확한 수치 파싱 어려움) |
| 중간 | table/card 내부 데이터 구조 없음 |

### CDP 실행 봇 관점 — 3/10

| 심각도 | 문제 | 필요 API |
|--------|------|---------|
| 높음 | Row/Col 생성 API 없음 | `window.addRow(layout, ratio)`, `window.activateCol(colId)` |
| 높음 | text content/align 초기값 주입 불가 | `addTextBlock(style, {content, align})` |
| 중간 | gap height 파라미터 없음 | `addGapBlock(height)` |
| 중간 | divider 스타일 파라미터 없음 | `addDividerBlock({color, style, weight})` |
| 중간 | iconCircle 파라미터 없음 | `addIconCircleBlock({size, bgColor})` |
| 중간 | graph 데이터 주입 불가 | `addGraphBlock({chartType, items})` |
| 중간 | labelGroup 초기값 없음 | `addLabelGroupBlock({labels})` |
| 중간 | card count/스타일 하드코딩 | `addCardBlock(count, {bgColor, radius})` |

### 스키마 설계 관점 — 6/10

| 우선순위 | 문제 |
|----------|------|
| 1순위 | Block 타입명 불일치 (spec의 `asset` ≠ 코드의 `image`, `iconCircle` ≠ `icon-circle`) |
| 1순위 | Col에 id 없음 → 특정 Col 지목 불가 |
| 2순위 | layout/ratio 분리 설계 문제 → Col 소유 구조로 재설계 필요 |
| 3순위 | 버전 관리 전략 부재 (version 정수 필드 추가 필요) |
| 기타 | settings 범위 불명확 (섹션별 vs 전역), group 블록 누락 |

---

## Spec v2 설계 방향 (결정 사항)

### 1. Block 타입명 통일 (코드 기준 kebab-case)

| v1 스펙 | v2 스펙 (코드 기준) |
|---------|------------------|
| `asset` | `image` |
| `iconCircle` | `icon-circle` |
| `labelGroup` | `label-group` |
| (누락) | `icon-text` |
| (누락) | `group` |

### 2. layout/ratio → Col 소유 구조

```json
// v1 (Row 소유)
{ "layout": "flex", "ratio": "1:2", "cols": [{}, {}] }

// v2 (Col 소유)
{
  "layout": "flex",
  "cols": [
    { "id": "col_001", "flex": 1, "blocks": [] },
    { "id": "col_002", "flex": 2, "blocks": [] }
  ]
}
```

### 3. 최상위 버전 구조

```json
{
  "schema": "goditor-spec",
  "version": 2,
  "minCompatVersion": 1,
  "meta": { "generator": "gemini-2.0", "createdAt": "2026-04-03" },
  "sections": [...]
}
```

### 4. Section.label 판단 기준 명문화

```
Hook   → 제품 첫인상, 감성 어필, 핵심 카피
Main   → 핵심 기능/스펙 소개
Detail → 소재, 사용법, 세부 정보
CTA    → 구매 유도, 가격, 버튼
Event  → 할인, 기간 한정, 프로모션
```

---

## 에디터 공개 API 추가 목록 (block-factory.js 수정 필요)

```js
// 신규 추가 필요
window.addRow(layout, ratioStr)           // Row 생성 + 레이아웃 적용
window.activateCol(colId)                 // Col 선택 상태 설정 (state._lastActiveCol 동기화)
window.addTextBlock(style, {content, align, paddingX})  // 옵션 파라미터 추가 (paddingX 설계 완료 ✅)
window.addSection({paddingX})             // paddingX 옵션 추가 (설계 완료 ✅)
window.addGapBlock(height)                // height 파라미터 추가
window.addDividerBlock({color, style, weight})
window.addIconCircleBlock({size, bgColor})
window.addGraphBlock({chartType, items})
window.addLabelGroupBlock({labels})
window.addCardBlock(count, {bgColor, radius})
window.addTableBlock({showHeader, cellAlign})

// 장기 (goditor-api.js 신규 파일)
window.goditor.buildSection(specJson)     // 선언적 JSON → 섹션 조립
```

---

## 구현 완료 항목 (2026-04-04)

- [x] `addSubSectionBlock({ fullWidth: true, bg })` — fullWidth 모드 추가. text/image/gap 블록을 플로우 레이아웃으로 sub-section 내부에 삽입 가능
- [x] `activateSubSection(ss)` / `deactivateSubSection()` — 공개 API 추가
- [x] `goditor_runner.js` — `layout: 'sub-section'` 처리 추가
- [x] sub-section 너비 슬라이더 860px 오버플로우 버그 수정 (`max-width: 100%` 추가)
- [x] `addTextBlock` `white-space: pre-wrap` 추가 (`\n` 줄바꿈 지원)

- [x] `addLabelGroupBlock({ shape: 'circle' })` — `drag-utils.js` `makeLabelItem` shape 파라미터 추가, CSS `.label-item.label-circle` 추가, `export-design-json.js` radius `'50%'` 처리 수정
- [x] `goditor-api-reference.md` `addLabelGroupBlock` shape 옵션 문서화

---

## 다음 작업 순서

1. **`addTextBlock` 줄바꿈 지원** — `block-factory.js`에서 `\n` → `white-space: pre-wrap` 또는 `<br>` 변환 (contentEl.textContent → innerHTML)
2. **Row 배경색** — `addRowBlock`에 `bg` 옵션 추가 또는 sub-section 대체 방식 확정
3. **Spec v2 문서 확정** (`docs/goditor-spec-v2.md`)
4. **`goditor-api.js` 구현** — `window.goditor.buildSection(spec)`
5. **CDP 에이전트 스킬 업데이트** — spec executor 패턴으로 단순화
6. **이미지 분석 프롬프트 작성** — GPT/Gemini용 시스템 프롬프트 + few-shot 예시

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `docs/goditor-spec-v1.md` | Spec v1 원문 |
| `docs/goditor-spec-v2.md` | Spec v2 (작성 예정) |
| `js/block-factory.js` | 블록 생성 함수 (API 추가 대상) |
| `js/drag-utils.js` | insertAfterSelected, _insertToActiveCol |
| `js/editor.js` | col-active 상태 관리 |
| `js/goditor-api.js` | buildSection 구현 (신규 생성 예정) |
