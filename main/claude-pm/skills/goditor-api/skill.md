---
name: goditor-api
description: Goditor API(이미지→섹션 자동조립) 기획 및 구현 작업을 이어가는 매니저 스킬. 스펙 설계, 에디터 API 추가, buildSection 구현 작업을 관리한다. "고디터 api", "goditor api", "스펙 이어서", "자동조립 이어서" 등을 말할 때 실행.
version: 1.0.0
---

# Goditor API 매니저

이미지 분석 → 에디터 섹션 자동조립 파이프라인 설계 및 구현 작업을 이어가는 스킬.

---

## 세션 시작 루틴

1. **작업 로그 조회** → `/Users/a1/web-editor/docs/goditor-api-planning.md` 읽기
2. **현재 Spec 버전 확인** → `docs/` 폴더에 `goditor-spec-v*.md` 목록 확인
3. **에디터 API 구현 상태 확인** → `js/block-factory.js`에 `addRow`, `activateCol` 추가됐는지 grep
4. **goditor-api.js 존재 여부** → `js/goditor-api.js` 파일 확인
5. 현황 브리핑 후 다음 작업 제안

```bash
# 세션 시작 시 실행
cat /Users/a1/web-editor/docs/goditor-api-planning.md
ls /Users/a1/web-editor/docs/goditor-spec-v*.md 2>/dev/null
grep -n "window.addRow\|window.activateCol\|window.goditor" /Users/a1/web-editor/js/block-factory.js 2>/dev/null | head -20
ls /Users/a1/web-editor/js/goditor-api.js 2>/dev/null && echo "goditor-api.js 존재" || echo "goditor-api.js 미생성"
```

---

## 프로젝트 개요

### 목적
쇼핑몰 상세페이지 이미지를 분석해서 상페마법사 에디터에 섹션을 자동으로 조립하는 스킬 개발.

### 3역할 구조
```
이미지
  ↓
[1] 이미지 분석 봇 (GPT / Gemini) — 토큰 절약
  ↓ Goditor JSON Spec
[2] 에디터 실행 봇 (Claude Code CDP — 포트 9336)
  ↓ window.goditor.buildSection(spec)
[3] 웹에디터 (Electron / /Users/a1/web-editor/)
```

### 핵심 원칙
- **JSON Spec이 계약서**: 분석 봇이 어떤 모델이든 Spec만 지키면 됨
- **실행 봇은 thin executor**: 분석 로직 없이 Spec → API 호출만
- **에디터는 API 노출**: `window.goditor.buildSection(spec)` 단일 진입점

---

## 현재 진행 상태 (2026-04-03)

### 완료
- [x] 블록 타입 전수조사
- [x] Spec v1 초안 작성 (`docs/goditor-spec-v1.md`)
- [x] 3-에이전트 병렬 평가 완료 (이미지봇/CDP봇/스키마설계 관점)

### 진행 필요
- [ ] **Spec v2 작성** — v1 평가 피드백 반영 (`docs/goditor-spec-v2.md`)
- [ ] **에디터 공개 API 추가** — `js/block-factory.js` 수정
- [ ] **`goditor-api.js` 구현** — `window.goditor.buildSection(spec)`
- [ ] **CDP 스킬 업데이트** — spec executor 패턴으로 단순화
- [ ] **이미지 분석 프롬프트** — GPT/Gemini용 시스템 프롬프트 + few-shot

---

## Spec v2 주요 변경 방향

### 1. Block 타입명 (코드 기준 kebab-case 통일)
| v1 | v2 |
|----|----|
| `asset` | `image` |
| `iconCircle` | `icon-circle` |
| `labelGroup` | `label-group` |
| (누락) | `icon-text`, `group` |

### 2. layout/ratio → Col 소유 구조
```json
// v2
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

### 4. Section.label 판단 기준
```
Hook   → 제품 첫인상, 감성 어필, 핵심 카피
Main   → 핵심 기능/스펙 소개
Detail → 소재, 사용법, 세부 정보
CTA    → 구매 유도, 가격, 버튼
Event  → 할인, 기간 한정, 프로모션
```

---

## 기존 구현된 CDP 공개 API

> 전체 명세 → `web-editor/docs/SCRATCH_PAD.md`

### scratch-pad.js (이미 완성)

```js
// CDP 외부에서 이미지 삽입 시 사용
window._scratchAddAndSave(src, x, y, w)
// - src: base64 DataURL
// - x/y: canvas-scaler 로컬 좌표 (캔버스 오른쪽 여백 권장: x=960)
// - w: 너비 px (기본 860)
// - 내부적으로 _createItem() + IndexedDB 저장까지 처리
// - 반드시 한 장씩 순차 호출 (한꺼번에 보내면 timeout)
// - awaitPromise: true 필수 (비동기 저장 대기)

window.clearScratchPad()              // 현재 프로젝트+페이지 스크래치 전체 삭제
window.initScratchPad(projectId, pageId)  // 프로젝트 열기 시 IndexedDB에서 복원
window.switchScratch(projectId, pageId)   // 프로젝트 전환 시
window.switchScratchPage(pageId)          // 페이지 전환 시
```

**저장 구조**
- IndexedDB: `ScratchPadDB` / store: `scratch`
- key: `scratch-pad-{projectId}-{pageId}`
- value: `[{ src, x, y, w }, ...]` — 새로고침/재시작 후 자동 복원

**CDP 스킬 연동**: `/goditor-images_to_scratchpad` 가 위 API를 사용해 폴더 이미지를 일괄 삽입

---

## 에디터 API 추가 목록

### block-factory.js 수정 대상
```js
window.addRow(layout, ratioStr)              // 신규 — Row 생성
window.activateCol(colId)                    // 신규 — Col 선택 (state 동기화 포함)
window.addTextBlock(style, {content, align}) // 옵션 파라미터 추가
window.addGapBlock(height)                   // height 파라미터 추가
window.addDividerBlock({color, style, weight})
window.addIconCircleBlock({size, bgColor})
window.addGraphBlock({chartType, items})
window.addLabelGroupBlock({labels})
window.addCardBlock(count, {bgColor, radius})
window.addTableBlock({showHeader, cellAlign})
window.addSection({skipDefaultBlock: true})  // 이미 요청된 옵션
```

### goditor-api.js (신규 파일)
```js
window.goditor = {
  buildSection(spec) { ... },   // 선언적 JSON → 섹션 완성
  buildFromSpec(fullSpec) { ... } // sections 배열 전체 처리
}
```

---

## 이 스킬을 호출하는 곳

| 호출자 | 언제 |
|--------|------|
| `/goditor-layout-orchestrator` | API 부재 또는 버그 발견 시 → 에디터 담당자에게 요청 전달 |
| `/goditor-layout-planner` | 구현 가능성 분석 중 미지원 API 확인 시 |

---

## 관련 파일 경로
| 파일 | 역할 |
|------|------|
| `docs/goditor-api-planning.md` | 작업 로그 (이 스킬의 원본 기록) |
| `docs/goditor-spec-v1.md` | Spec v1 원문 |
| `docs/goditor-spec-v2.md` | Spec v2 (작성 예정) |
| `js/block-factory.js` | 블록 생성 함수 (API 추가 대상) |
| `js/drag-utils.js` | insertAfterSelected, _insertToActiveCol |
| `js/editor.js` | col-active 상태 관리 |
| `js/goditor-api.js` | buildSection 구현 (신규 생성 예정) |

---

## 세션 종료 루틴

작업 후 `docs/goditor-api-planning.md`의 **현재 상태** 섹션 업데이트:
- 완료 항목 체크
- 다음 작업 순서 갱신
- 발견된 새 이슈 추가
