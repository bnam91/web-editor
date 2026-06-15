# 상세페이지 자동생성 통합 플로우 구현 스펙

> 작성일: 2026-03-27
> 작성자: Idea Lab Squad IDEA-04 (스펙 문서 작성가)
> 기준 브랜치: `feature/step2`

---

## 프로젝트명

**상페마법사 자동생성 통합 플로우 (AutoGen Unified Pipeline)**

---

## 목표 한 줄 요약

분산된 5단계 수작업 플로우(USP 분석 → 셀링포인트 → data.json → 에디터 적용 → 비주얼 감사)를 단일 웹에디터 내에서 끊김 없이 연결하여, URL 하나로 상세페이지 초안을 자동 생성하고 즉시 편집·출력할 수 있는 통합 파이프라인을 구축한다.

---

## 현재 상태 (feature/step2 브랜치 기준)

### 이미 구현된 핵심 기능 (구현 완료)

| 영역 | 구현 내용 | 대표 커밋 |
|------|-----------|-----------|
| **에디터 기반** | Row/Col/Grid 블록, 섹션 드래그앤드롭, 레이어 패널 | `ab1d9a8` 초기 MVP |
| **이미지 편집** | 8핸들 편집모드, Circle 편집모드, 이미지 교체 | `421252e` |
| **텍스트 패딩** | 텍스트 블록 좌우 패딩 슬라이더 + 체인 연동 | `71f1457` |
| **Col 프로퍼티** | Col 배경색, 세로 정렬, Contents 드롭다운 | `edc9bf4` |
| **A/B 베리에이션** | A~E 멀티 variant 지원, 레이어 패널 자동 접기 | `241f4c2` |
| **템플릿 시스템** | 템플릿 패널 UI, DnD 삽입, 태그 검색 필터 | `e9f7f57`, `d6ab9c4` |
| **디자인 시스템** | `--preset-*` 토큰 편집기, 드롭다운, 신규등록 | `81ce57c`, `e98f0e4` |
| **변수 바인딩** | Figma Variable 개념 시안 (패널 UI 존재) | `df8b6b9` |
| **컴포넌트 선반** | 블록 저장/재사용 시안 B | `c1faaef` |
| **피그마 Export** | Figma JSON 내보내기, 업로드 실패 시 재시도 | `1773f33`, `9456aa4` |
| **HTML Export** | `export-html.js` 존재 (기본 구현) | `js/export-html.js` |
| **Preview 모드** | 멀티페이지 Side-by-Side 미리보기 | `f4c0373` |
| **AI 프롬프트 UI** | AI 프롬프트 중앙 패널 UI | `8ed4376` |
| **레이어 DnD** | 레이어 패널 드래그앤드롭, 섹션 간 이동 | `3e3563b` |
| **멀티탭/브랜치** | 탭 시스템, 자동저장 race condition 해소 | `b26a98d`, `0e41316` |
| **기획 플로우 UI** | 홈화면 타입 선택 + 카드 + placeholder 페이지 | `3d495fc` |

### 미구현 / 시안(placeholder) 단계

| 영역 | 상태 | 비고 |
|------|------|------|
| URL 크롤링 → 에디터 자동 채우기 | 미구현 | `pages/planning.html` placeholder만 존재 |
| USP → 질문지 자동 변환 브릿지 | 미구현 | design-bot-usp 스킬과 에디터 간 IPC 연결 없음 |
| 이미지 → 섹션 자동 매핑 | 미구현 | 수작업으로 이미지 업로드 후 수동 배치 |
| 텍스트 split (AI 재생성 포함) | 미구현 | AI 프롬프트 UI만 존재, 실제 split 로직 없음 |
| 타이포 프리셋 (에디터 내 적용) | 부분 구현 | Design System 패널에 토큰 편집기 있으나 preset 적용 UI 미완 |
| HTML + 이미지 패키징 export | 미구현 | `export-html.js` 기본만, 이미지 번들링 없음 |
| 모바일/PC 전환 뷰 | 미구현 | `6b8f740` 모바일 폰트 스케일만, 실시간 전환 없음 |
| 전환율 피드백 루프 | 미구현 | 데이터 연동 구조 없음 |
| A/B 버전 비교 (시각적) | 부분 구현 | variant 전환은 있으나 Side-by-Side 비교 뷰 없음 |

---

## 구현 범위

### MVP — 반드시 있어야 할 핵심 기능

> 목표: URL 입력 → 초안 생성 → 즉시 수정 가능한 상태까지 자동화

#### MVP-1. USP → 질문지 자동 변환 브릿지
- `product-usp-analyzer` 스킬 결과(맥 노트 저장 형식)를 파싱하여 에디터가 읽을 수 있는 JSON 구조로 변환
- 변환 결과를 `data.json` BODY 필드(design-bot 포맷)에 자동 매핑
- **입력:** USP 분석 결과 텍스트 또는 JSON
- **출력:** `design-bot` 호환 `data.json`
- **구현 위치:** `services/usp-bridge.js` (신규) + IPC 핸들러 `main.js`

#### MVP-2. URL 크롤링 → 질문지 자동 채우기
- 상품 URL 입력 시 Electron `net.request` 또는 별도 크롤러 서비스로 상품명, 이미지, 설명 자동 추출
- `pages/planning.html` 기획 UI의 placeholder 필드에 자동 채움
- **입력:** 쇼핑몰 상품 URL (스마트스토어, 쿠팡)
- **출력:** 질문지 필드 자동 완성
- **구현 위치:** `services/url-crawler.js` (신규)

#### MVP-3. 이미지 → 섹션 자동 매핑
- 크롤링된 이미지 목록을 카테고리(대표 이미지, 서브 이미지, 상세 컷)로 자동 분류
- 분류 결과에 따라 템플릿 섹션에 이미지 자동 삽입
- **의존:** MVP-2 완료 후 진행
- **구현 위치:** `js/image-handling.js` 확장 + `js/template-system.js` 연동

#### MVP-4. 텍스트 split UI
- 긴 텍스트 블록을 여러 섹션으로 분할하는 인라인 split 버튼
- 선택된 텍스트 블록에서 문단 단위로 분리 → 각각 새 텍스트 블록 생성
- **구현 위치:** `js/prop-text.js` 확장

#### MVP-5. 모바일/PC 전환 뷰
- 에디터 상단 토글 버튼으로 캔버스 너비 360px(모바일) ↔ 860px(PC) 즉시 전환
- 전환 시 폰트 스케일 및 패딩 자동 리스케일 (기존 `6b8f740` 스케일 로직 활용)
- **구현 위치:** `js/editor.js` + `js/prop-page.js` 확장

---

### Phase 2 — 있으면 좋은 기능

#### P2-1. HTML + 이미지 패키징 Export
- 현재 `export-html.js`의 기본 HTML에 사용된 이미지를 Base64 인라인 또는 ZIP 번들로 패키징
- Electron `dialog.showSaveDialog`로 ZIP 저장 지원
- **의존:** MVP 완료 후

#### P2-2. A/B 버전 Side-by-Side 비교 뷰
- 기존 A~E 멀티 variant(T38/T42) 위에 Side-by-Side 레이아웃 오버레이 추가
- 현재 `feature/T32-preview-sidebyside` 구조를 variant 비교에 재활용
- **구현 위치:** `js/preview.js` + `js/section-variation.js` 연동

#### P2-3. 타이포 프리셋 에디터 내 원클릭 적용
- Design System 패널의 `--preset-*` 토큰을 선택된 텍스트 블록에 원클릭 적용
- 현재 토큰 편집기 UI는 완성, 선택 블록 연동 로직만 추가 필요
- **구현 위치:** `js/design-system.js` + `js/prop-text.js`

#### P2-4. AI 재생성 (선택 블록 단위)
- 현재 AI 프롬프트 UI(`8ed4376`)에 "선택된 블록 컨텍스트 전달 → Claude API 호출 → 결과 자동 적용" 파이프라인 연결
- **의존:** P2-1 이후, Claude API 키 환경변수 필요

#### P2-5. 피그마 연동 자동 Publish
- 현재 피그마 Publish(재시도 UI 포함)에 "자동생성 완료 시 Publish" 옵션 추가
- **구현 위치:** `js/figma-publish.js`

---

### Phase 3 — 장기 로드맵

#### P3-1. 전환율 피드백 루프
- 생성된 상세페이지 HTML에 클릭 트래킹 스크립트 삽입
- 데이터를 MongoDB 또는 Google Sheets로 수집
- 에디터 내 "전환율 리포트" 패널 표시 (A/B 결과 포함)

#### P3-2. 멀티 쇼핑몰 크롤러 확장
- 스마트스토어, 쿠팡 외 자사몰, 11번가 크롤러 추가
- 크롤러 실패 시 수동 질문지 입력 fallback UI

#### P3-3. 컴포넌트 선반 → 공유 라이브러리
- 현재 로컬 저장 방식(`component-shelf.js`)을 MongoDB 동기화로 확장
- 팀 단위 컴포넌트 공유 및 버전 관리

#### P3-4. 상세페이지 버전 히스토리 & 롤백
- 현재 브랜치 시스템(`branch-system.js`)을 "버전별 비교/롤백" UI로 고도화
- 날짜별 스냅샷 저장 + diff 뷰

---

## 기술 스택 요구사항

### 기존 스택 (변경 없음)
- **런타임:** Electron (main process: Node.js, renderer: Vanilla JS ESM)
- **DB:** MongoDB Atlas (`.env` 환경변수로 크리덴셜 관리)
- **IPC:** `electronAPI.*` 패턴 (`preload.js` contextBridge)
- **스타일:** CSS Variables 기반 디자인 토큰 (`--preset-*`, `--sel-color` 등)
- **Export:** Figma JSON, HTML, Design JSON

### 신규 필요 스택

| 항목 | 용도 | 비고 |
|------|------|------|
| `Electron net.request` 또는 `axios` | URL 크롤링 (main process) | 기존 `electron` 모듈 활용 |
| `cheerio` | HTML 파싱 (main process) | npm 추가 필요 |
| `archiver` | ZIP 패키징 export | npm 추가 필요 (Phase 2) |
| `@anthropic-ai/sdk` | AI 재생성 블록 (Phase 2) | `.env` API 키 관리 |
| Claude API (claude-api 스킬) | USP 브릿지 변환 로직 | 서버리스 또는 로컬 호출 |

---

## 예상 작업 순서 (의존성 기준)

```
[Week 1-2] MVP 기반 작업
  Step 1. services/url-crawler.js 구현 (MVP-2)
    └─ Electron main process에서 cheerio로 HTML 파싱
    └─ 스마트스토어 / 쿠팡 셀렉터 정의

  Step 2. services/usp-bridge.js 구현 (MVP-1)
    └─ USP 분석 결과 → data.json 변환 함수
    └─ planning.html 질문지 필드 자동 채우기 IPC 연결
    └─ 의존: Step 1 완료 후 이미지 URL 활용

[Week 3] 에디터 연동
  Step 3. 이미지 → 섹션 자동 매핑 (MVP-3)
    └─ js/image-handling.js에 분류 로직 추가
    └─ js/template-system.js에 자동 삽입 트리거 연결
    └─ 의존: Step 2의 이미지 URL 목록

  Step 4. 텍스트 split UI (MVP-4)
    └─ js/prop-text.js에 split 버튼 + 로직 추가
    └─ 의존 없음 (독립 구현 가능)

  Step 5. 모바일/PC 전환 뷰 (MVP-5)
    └─ js/editor.js 캔버스 너비 토글
    └─ js/prop-page.js 스케일 리스케일 로직
    └─ 의존 없음 (독립 구현 가능)

[Week 4-5] Phase 2
  Step 6. HTML + 이미지 패키징 Export (P2-1)
    └─ js/export-html.js Base64 인라인 확장
    └─ archiver로 ZIP 번들링

  Step 7. A/B Side-by-Side 비교 뷰 (P2-2)
    └─ js/preview.js + js/section-variation.js 연동
    └─ 의존: 기존 variant(T38/T42) 구조

  Step 8. 타이포 프리셋 원클릭 적용 (P2-3)
    └─ js/design-system.js 선택 블록 연동

  Step 9. AI 재생성 블록 (P2-4)
    └─ @anthropic-ai/sdk 연결
    └─ 의존: Step 8 이후 (컨텍스트 전달 구조 필요)

[Week 6+] Phase 3 (장기)
  Step 10. 전환율 피드백 루프 (P3-1)
  Step 11. 멀티 쇼핑몰 크롤러 확장 (P3-2)
  Step 12. 컴포넌트 선반 공유 라이브러리 (P3-3)
  Step 13. 버전 히스토리 & 롤백 고도화 (P3-4)
```

---

## 리스크 및 주의사항

### 리스크 1. 크롤링 차단 (높음)
- 스마트스토어/쿠팡은 봇 차단 정책이 강함
- **대응:** Electron `session.setUserAgent` + 쿠키 유지, CDP 방식(chrome-devtools MCP) fallback, 실패 시 수동 입력 fallback UI 필수
- **주의:** 크롤러 로직은 `main.js` IPC 핸들러에만 위치 (renderer에서 직접 외부 요청 금지)

### 리스크 2. USP → 질문지 변환 정합성 (중간)
- LLM 기반 변환 시 필드 누락 또는 오매핑 발생 가능
- **대응:** 변환 결과 미리보기 + 수동 수정 UI를 브릿지 단계에 반드시 포함
- 자동 채움 후 "검토 모드" 강제 진입 (바로 생성 금지)

### 리스크 3. 이미지 자동 매핑 오류 (중간)
- 이미지 카테고리 분류 정확도 한계 (대표 이미지 vs 상세 컷 구분 어려움)
- **대응:** 분류 결과를 드래그로 재배치 가능한 UI 제공, 자동 매핑 후 검토 단계 추가

### 리스크 4. HTML Export 이미지 경로 깨짐 (높음)
- 현재 `export-html.js`는 로컬 경로 참조 방식 — 외부 공유 시 이미지 깨짐
- **대응:** Phase 2 ZIP 패키징 전까지 Base64 인라인 방식으로 임시 대응 (파일 크기 주의)

### 리스크 5. 모바일/PC 전환 시 레이아웃 깨짐 (중간)
- 기존 블록들이 고정 픽셀 값으로 설계되어 너비 전환 시 비율이 깨질 수 있음
- **대응:** 전환 시 블록 너비를 % 기반으로 재계산하는 normalize 함수 추가 필요
- **주의:** `CLAUDE.md`의 블록 선택 스타일 (`outline-offset: 0` 등) 변경 금지

### 리스크 6. 기존 IPC 패턴 준수 (낮음 — 필수 원칙)
- 신규 `services/*.js`는 반드시 `preload.js` contextBridge를 통해 renderer에 노출
- `electronAPI.*` 네이밍 컨벤션 준수
- `main.js`에 IPC 핸들러 등록 시 기존 `ipcMain.handle` 패턴 유지

### 리스크 7. A/B 비교 뷰와 기존 Variant 시스템 충돌 (낮음)
- T38/T42 variant 구조(`section-variation.js`)를 Side-by-Side에 재활용 시 레이어 패널 자동 접기 로직과 충돌 가능
- **대응:** Side-by-Side 모드 진입 시 레이어 패널 variant 접기 일시 비활성화

---

## 부록 — 현재 분산 플로우 vs 통합 후 비교

| 단계 | 현재 (분산) | 통합 후 |
|------|-------------|---------|
| 1. 입력 | URL 복사 → 브라우저에서 수동 분석 | URL 붙여넣기 → 자동 크롤링 |
| 2. USP 분석 | `product-usp-analyzer` 스킬 별도 실행 | 크롤링 결과 자동 USP 추출 |
| 3. 질문지 | `design-bot-usp` → 수동 복붙 | 질문지 자동 채우기 + 검토 UI |
| 4. 콘텐츠 생성 | `design-bot` 스킬 → `data.json` 수동 편집 | USP 브릿지 → 자동 data.json 생성 |
| 5. 에디터 적용 | `webeditor-block-tester` 스킬로 별도 주입 | 에디터 내 자동 레이아웃 + 이미지 매핑 |
| 6. 비주얼 감사 | `design-squad` 스킬 별도 실행 | 에디터 내 A/B 비교 뷰 + 실시간 확인 |
| 7. 출력 | 수동 피그마 업로드, HTML 별도 저장 | 원클릭 Figma Publish + ZIP Export |
