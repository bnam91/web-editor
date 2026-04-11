# Web Editor — Claude 작업 지침

> 이 파일은 프로젝트 전체에 적용되는 공통 원칙을 담는다.
> 특정 파일/모듈 전용 규칙은 해당 폴더의 CLAUDE.md에 작성한다.

---

## 기본 작업 방식 (하네스 엔지니어링)

**YOU MUST**: 모든 작업 요청은 기능 단위별로 **Planner → Generator → Evaluator** 에이전트 파이프라인으로 진행한다.

| 에이전트 | 역할 |
|---------|------|
| **Planner** | 요구사항 분석, 구현 방향 설계, 변경 파일 목록 확정 |
| **Generator** | Planner 결과 기반 실제 코드 구현 |
| **Evaluator** | 구현 결과 검증 (CDP QA 포함), 문제 발견 시 Generator 재투입 |

### 병렬 실행 규칙

- **독립적인 기능 단위가 여러 개** → 각 단위의 파이프라인을 병렬로 스폰
- **단위 간 의존성 있음** → 순차 실행
- **단순 조회·문서 작업** → 파이프라인 생략 가능 (판단 후 결정)

### 예시

```
요청: "A 버그 수정 + B 기능 추가"  (독립적)
→ [Unit A: Planner→Generator→Evaluator]
   [Unit B: Planner→Generator→Evaluator]  ← 병렬 스폰

요청: "로그인 후 대시보드 리다이렉트 구현"  (의존성 있음)
→ Unit A(로그인) → Unit B(리다이렉트)  ← 순차
```

---

## 개발 명령어

```bash
npm run dev          # 개발 서버 (핫리로드 + DevTools, 포트 9334)
npm start            # 프로덕션 실행
npm run build:mac    # macOS 빌드
npm run release:mac  # macOS 배포 (auto-update)
npm run figma        # Figma WebSocket 서버 (포트 3055)
```

---

## 핵심 파일 책임

| 파일 | 책임 |
|------|------|
| `js/editor.js` | 선택·줌·키보드 단축키 |
| `js/block-factory.js` | 모든 블록 생성 (`make*`, `add*`) |
| `js/drag-drop.js` | DnD 조율 (block-drag / section-drag / drag-utils 통합) |
| `js/io/save-load.js` | 직렬화·로드·autoSave (MutationObserver + 1.5s debounce) |
| `js/io/export-figma-json.js` | Figma 업로드용 JSON 빌드 |
| `js/panels/layer-panel.js` | 레이어 패널 트리 렌더링 |
| `js/overlay-handles.js` | 리사이즈·코너반경 핸들 (`#ss-handles-overlay`) |

세부 JS 규칙: `js/CLAUDE.md` 참조

---

## 참고 문서

- 디자인 시스템: `_context/DESIGN_SYSTEM.md`
- 스킬 라우팅: `_context/SKILLS_GUIDE.md`
- 기능 명세·스펙: `docs/` 폴더

> 필요한 작업이 생겼을 때만 열 것. 매 작업마다 전부 읽지 말 것.

| 문서 | 읽어야 할 때 |
|------|------------|
| `docs/DRAG_SPEC.md` | 드래그앤드롭 버그 수정·기능 변경 시 |
| `docs/TEMPLATE_SYSTEM.md` | 템플릿 저장·삽입·브라우저 작업 시 |
| `docs/branch-system.md` | 브랜치 전환·병합·커밋 관련 작업 시 |
| `docs/project-storage.md` | 프로젝트 저장 구조 변경·디버깅 시 |
| `docs/goditor-api-reference.md` | CDP로 블록 생성·자동화 스크립트 작성 시 (32KB — 필요한 함수만 검색) |
| `docs/LEFT_PANEL_LAYER.md` | 레이어 패널 수정 시 |
| `docs/RIGHT_PANEL_PROPS.md` | 프로퍼티 패널 수정 시 |

---

## 자동 검증 (훅)

- JS 파일 저장 시 `node --check` 자동 실행
- 문법 오류 있으면 저장 차단됨 → 오류 수정 후 재시도

---

## 작업 완료 후 QA 루틴

**YOU MUST**: 요청한 작업이 끝나면 반드시 아래 루틴을 수행한다. 코드 수정 후 CDP QA 없이 "완료"를 보고하는 것은 금지.

### 포트 맵

| 스크립트 | 포트 |
|---|---|
| `npm run dev` | 9334 (메인) |
| `npm run dev:step2` | 9335 |
| `npm run dev:planning` | 9336 |
| `npm run dev:ui-polish` | 9337 |
| `npm run dev:design-token` | 9338 |
| `npm run dev:template-tag` | 9339 |

**접속 판단 기준:**
1. `chrome-devtools` MCP는 **9334 고정** — 별도 지시 없으면 항상 이쪽 사용
2. 사용자가 특정 포트/브랜치를 언급한 경우 해당 포트 사용
3. 어느 포트가 실행 중인지 모를 때 → `chrome-devtools` MCP `list_pages`로 먼저 확인

### QA 루프

1. 작업 완료
2. **CDP로 해당 포트에 접속해 직접 QA** (스크린샷, JS 실행, 콘솔 오류 확인 등)
3. 이상 발견 시 → 코드 수정 → 재QA
4. 통과하면 결과 보고 (무엇을 확인했는지 반드시 포함)

---

## 신규 블록 컴포넌트 추가 시 필수 체크리스트

새 블록 타입(예: `chat-block`)을 추가할 때 아래 4곳을 **반드시 동시에** 수정한다. 하나라도 빠지면 버그 발생.

| 파일 | 추가 내용 | 빠졌을 때 증상 |
|------|----------|--------------|
| `js/editor.js` → `deselectAll()` | 새 블록 클래스를 `.selected` 해제 셀렉터에 추가 | 블록 선택 아웃라인이 해제되지 않음 |
| `js/panels/layer-panel-items.js` | `isXxx` 감지, `type` 분기, `labels`/`typeLbls` 등록, block 목록 배열, click 핸들러에 `showXxxProperties` 추가 | 레이어 패널에서 "Asset"으로 표시되거나 아예 미등록 |
| `js/props/prop-xxx.js` | `propPanel.innerHTML`의 헤더를 `prop-block-label > prop-block-icon + prop-block-info + prop-block-id` 풀 구조로 작성 | 프로퍼티 패널 헤더가 단순 텍스트로 표시 (블록명·위치·ID 정보 없음) |
| `js/block-drag.js` | `isXxx` 감지, click 핸들러에 `showXxxProperties` 연결 | 블록 클릭 시 프로퍼티 패널 열리지 않음 |

> **실수 예방**: 신규 블록 구현 후 QA 전에 위 4곳을 grep으로 교차 확인할 것.

---

## 경로별 자동 로드 규칙

`css/**` 또는 `js/**` 편집 시 해당 규칙 파일이 자동 로드된다.

| 경로 | 규칙 파일 | 내용 |
|------|---------|------|
| `css/**` | `.claude/rules/css-blocks.md` | 블록 선택 스타일, speech-bubble outline, 코너 반경 핸들 |
| `js/**` | `.claude/rules/js-structure.md` | 블록 구조 원칙, DOM 계층 구조 |
