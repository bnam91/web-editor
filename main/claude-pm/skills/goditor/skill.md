---
name: goditor
description: [상페마법사 웹에디터] CTO 프로젝트를 관리하는 스킬이야. 진행 현황 조회, 다음할일 확인, DB 업데이트를 처리해. 사용자가 "웹에디터 현황", "웹에디터 이어서", "웹에디터 업데이트", "상페마법사 현황" 등을 말할 때 실행해.
version: 1.3.0
---

# CTO 프로젝트: 상페마법사 웹에디터

## Claude 작업 규칙 (필독)

> **에디터 블록은 절대 HTML 직접 하드코딩 금지.**
> 반드시 에디터가 노출한 기존 window 함수만 사용할 것.

### QA 자동화 (document-skills:webapp-testing 사용)

CDP 수동 검증 대신 Playwright 기반 자동화 QA 실행 가능.
기능 구현 후 "webapp-testing으로 QA해줘" 또는 "Playwright로 테스트해줘" 요청 시 해당 스킬 트리거.

**테스트 폴더**: `/Users/a1/web-editor/tests/`, `/Users/a1/web-editor/e2e/`

**이 프로젝트에서 주로 쓰는 패턴**:
- Electron 앱이므로 `file://` URL로 직접 `index.html` 로드 (정적 HTML 자동화 패턴)
- `window.addSection()`, `window.addTextBlock()` 등 공개 API 호출 검증
- 블록 추가 후 DOM 내 예상 구조 확인 + 스크린샷 캡처
- `window.triggerAutoSave()` 후 `projects/{id}.json` 파일 변경 확인

**실행 명령**:
```bash
cd /Users/a1/web-editor && npx playwright test
```

### 디자인 스킬 (document-skills 패키지)

- **`document-skills:frontend-design`** — Step 3-A 임시 미리보기 URL 랜딩페이지 제작 시 사용. "AI스러운 느낌" 없는 프로덕션급 UI 생성.
- **`document-skills:theme-factory`** — 테마 선택 UI 또는 Style Preset 확장 시 참고. 10가지 프리셋 테마(컬러+폰트) 제공.

---

### CDP로 블록 생성할 때 반드시 지킬 것

1. **섹션 생성**: `window.addSection()` 호출 → 자동으로 선택 상태가 됨
2. **블록 추가**: 아래 함수들만 사용 (선택된 섹션 기준으로 추가됨)
   - `window.addTextBlock('h1' | 'h2' | 'h3' | 'body' | 'caption' | 'label')`
   - `window.addAssetBlock()`
   - `window.addGapBlock()`
   - `window.addIconCircleBlock()`
   - `window.addTableBlock()`
   - `window.addCardBlock()`
   - `window.addStripBannerBlock()`
   - `window.addGraphBlock()`
   - `window.addDividerBlock()`
   - `window.addLabelGroupBlock()`
3. **텍스트 내용 변경**: 블록 추가 후 `block.querySelector('[class^="tb-"]').innerHTML = '...'`
4. **텍스트 정렬**: 반드시 내부 contentEl에만 → `inner.style.textAlign = 'center'`
   - 래퍼 `text-block` div에 직접 스타일 추가 금지
5. **저장 트리거**: 작업 후 `window.triggerAutoSave()` 호출

### 금지 사항
- `innerHTML`로 섹션/블록 구조 직접 작성 ❌
- `padding`, `margin` 등 레이아웃 스타일 임의 추가 ❌ (pageSettings가 관리)
- `data-*` 속성 임의 추가 ❌

---

## 프로젝트 정보

- **노션 프로젝트 페이지 ID**: `329111a5-7788-812e-878b-f7532f706e05`
- **노션 관리 페이지 ID**: `329111a5-7788-803b-b812-d171b6321e60`
- **로컬 경로**: `/Users/a1/web-editor/`
- **GitHub**: `https://github.com/bnam91/web-editor`
- **API 키 경로**: `~/.config/secrets/.env` → `NOTION_API_KEY`

## 관리 DB 목록

| DB | ID | 용도 |
|----|----|------|
| 투두 DB | `329111a5-7788-8021-9027-deea1f33dd18` | 개발 태스크 (이름/상태/우선순위) |
| QA 체크리스트 DB | `32a111a5-7788-801f-aca8-e5978b13fe3d` | 기능별 QA 항목 (이름/상태) |
| 타임라인 DB | `329111a5-7788-810e-af37-d94d4e293de3` | 마일스톤 일정 관리 |
| 브랜치 관리 DB | `329111a5-7788-81b4-83db-febdf925c34d` | feature 브랜치 현황 |

### 타임라인 DB 칼럼
- **마일스톤** (title): 마일스톤 이름
- **날짜** (date): 목표일
- **상태** (select): 예정/진행중/완료/지연
- **카테고리** (select): MVP/UI/UX/기능/배포/기획
- **메모** (rich_text): 세부 설명

### 브랜치 관리 DB 칼럼
- **기능명** (title): 브랜치 기능명
- **브랜치명** (rich_text): 실제 git 브랜치명 (예: feature/T14-xxx)
- **상태** (select): 진행중/머지요청/dev머지/리뷰대기/중단/완료
- **터미널** (select): T1~T13 (담당 터미널/세션 번호)
- **시작일** (date): 브랜치 생성일
- **완료일** (date): 머지 완료일
- **머지로그** (rich_text): 머지 시 변경 내용 요약

## 제품 비전 / 킥 (핵심 차별화)

| # | 킥 | 한 줄 요약 |
|---|----|-----------|
| 1 | 드래그앤드롭 조립 | 디자인 몰라도 됨, 가장 낮은 진입장벽 |
| 2 | Hook/Main/Detail/CTA 구조 | 상세페이지 기획법을 앱이 가르쳐줌 |
| 3 | AI 섹션 자동생성 | 텍스트도 못 쓰겠으면 AI가 채워줌 |
| 4 | 템플릿 마켓 | 잘 만든 거 사다 쓰면 됨 |

**MVP = 킥 1 + 킥 2** (현재 거의 완성)

> 드래그앤드롭만으로 디자인이 가능하다는 것 자체가 가장 강력한 킥. 기획 구조(Hook→Main→Detail→CTA)를 앱이 레이블로 안내하므로 "어떻게 만들어야 하는지"도 자연스럽게 학습됨.

## Git 브랜치 전략

```
main   ← 안정 배포본 (직접 커밋 금지)
dev    ← 중간 통합 브랜치 (메인 Claude Code 담당)
feature/figma-json     ← 피그마 JSON 내보내기/가져오기
feature/template       ← 템플릿 시스템
feature/animation-gif  ← 애니메이션 + GIF 생성기
feature/ai-prompt      ← AI 프롬프트 UI
feature/preview        ← Preview 모드
```

**운영 규칙**
- 각 wow 기능은 별도 터미널(Claude Code)에서 feature 브랜치로 개발
- 기능 완성 시 → 메인 Claude Code(이 세션)에게 병합 요청
- 메인이 `dev`로 merge 후 충돌 해소 → 안정화되면 `dev → main` PR

## 이 스킬을 호출하는 곳

| 호출자 | 언제 |
|--------|------|
| `/goditor-layout-orchestrator` | 에디터 소스코드 직접 수정이 필요할 때 |
| `/goditor-api` | API 구현을 위해 block-factory.js 등 수정 요청 시 |

---

## 프로젝트 개요

상세페이지 제작용 웹 에디터 (상페마법사). Electron 앱.
- 좌측 패널(File/Branch/Inspector 탭) + 중앙 캔버스 + 우측 프로퍼티 패널
- Section > Row > Col > TextBlock/AssetBlock/GapBlock/IconCircleBlock/TableBlock/LabelGroupBlock/GroupBlock 계층
- 멀티페이지 시스템 (pages 배열, v2 저장 포맷)
- Style Preset 시스템 (CSS Variables + JSON 파일 기반, default/dark/brand/minimal)
- 프로젝트 목록 페이지 (`pages/projects.html`) → 에디터 (`index.html?project=id`)
- `npm start` 로 실행

### 현재 파일 구조
```
/Users/a1/web-editor/
  main.js               ← Electron 메인 프로세스 (hot reload, fullscreen IPC, presets/templates IPC)
  preload.js            ← contextBridge (presets, templates, fullscreen, isElectron)
  index.html            ← 에디터 메인 페이지 (플로팅 패널: Text/Asset/Row/Component)
  css/editor.css        ← 스타일
  presets/              ← 디자인 프리셋 JSON (default/dark/brand/minimal)
  templates/
    index.json          ← 템플릿 메타데이터 (폴더>카테고리>이름 3계층)
    canvas/{id}.html    ← 섹션 outerHTML (템플릿 본문)
  projects/             ← 프로젝트 JSON 파일 저장소
  pages/
    projects.html       ← 프로젝트 목록 페이지 (생성/삭제/이름변경)
  js/
    editor.js           ← 코어 에디터 (선택, 히스토리, 단축키, 섹션 툴바)
    drag-drop.js        ← 드래그앤드롭, 블록 생성(makeTextBlock 등), addTextBlock/addIconCircleBlock/addTableBlock
    save-load.js        ← 저장/로드, autoSave(MutationObserver + 1.5s debounce), 브랜치 시스템, 커밋 모달
    export.js           ← JSON 내보내기/가져오기, Figma 업로드
    template-system.js  ← 템플릿 저장/로드/삽입 (파일 기반, in-memory cache)
    image-handling.js   ← 이미지 업로드, 원형 프레임(triggerCircleUpload/loadImageToCircle)
    layer-panel.js      ← 레이어 패널 트리
    inspector.js        ← Inspector 탭 (섹션 프로퍼티)
    branch-system.js    ← 브랜치 생성/전환/집중모드
    preview.js          ← Preview 모드
    animation-engine.js ← 애니메이션 엔진
    gif.js              ← GIF 생성
    prop-text.js        ← 텍스트 블록 프로퍼티 패널
    prop-asset.js       ← 에셋 블록 프로퍼티 패널
    prop-components.js  ← IconCircle/Table 블록 프로퍼티 패널
    prop-label-group.js ← 라벨 그룹 프로퍼티 패널
    prop-layout.js      ← 레이아웃(Col) 프로퍼티 패널
    prop-row.js         ← Row 프로퍼티 패널
    prop-page.js        ← 페이지 설정 패널
    globals.js          ← 전역 변수/상수
```

### 저장 포맷 (v2)
```json
{ "version": 2, "currentPageId": "page_1", "pages": [
  { "id": "page_1", "name": "Page 1", "label": "Hook",
    "pageSettings": { "bg": "#969696", "gap": 100, "padX": 32, "padY": 32 },
    "canvas": "<HTML 문자열>" }
]}
```

### File 탭 구조
- **Page 섹션**: 멀티페이지 목록 (라벨: Hook/Main/Detail/CTA/Event, 드래그 정렬, 복사/삭제)
- **Layers 섹션**: 현재 활성 페이지의 레이어 트리

## 투두 DB 조회

### 투두 DB 우선순위 칼럼 값
- **MVP**: 발표/배포 전 반드시 완료해야 할 항목
- **높음**: 핵심 기능 버그/UX
- **중간**: 일반 기능 개선
- **낮음**: 나중에 해도 되는 것

### 현재 MVP 로드맵 (타임라인 DB)
- **Step 1 (3/25)**: 와이어프레임 조립 + 피그마 업로드 + 브랜치/템플릿 — MVP 발표
- **Step 1-A (3/25)**: 섹션 콘텐츠 완성 (리뷰카드/배너/그래프/비교표), 유다모 점검
- **Step 1-B (3/28)**: 앱빌드 + 자동업데이트 (electron-builder + electron-updater)
- **Step 2 (4/7)**: 기획 구조 가이드 강화 + AI 레이아웃 선택
- **Step 3-A (4/21)**: 외부 연동 + 이미지 생성 + PDF/임시URL
- **Step 3-B (5/12)**: 유저 등록 + 라이센스 + 수익화

```bash
# MVP 항목만 필터
node -e "
import { readFileSync } from 'fs';
import os from 'os';
import path from 'path';

const envRaw = readFileSync(path.join(os.homedir(), '.config/secrets/.env'), 'utf8');
const apiKey = envRaw.match(/NOTION_API_KEY=(.+)/)[1].trim();

const dbRes = await fetch('https://api.notion.com/v1/databases/329111a5-7788-8021-9027-deea1f33dd18/query', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
  body: JSON.stringify({
    filter: { property: '우선순위', select: { equals: 'MVP' } },
    sorts: [{ property: '상태', direction: 'ascending' }]
  })
});
const db = await dbRes.json();
console.log('=== MVP 투두 ===');
db.results.forEach(p => {
  const name = p.properties['이름']?.title?.[0]?.text?.content || '-';
  const status = p.properties['상태']?.select?.name || '-';
  console.log(\`[\${status}] \${name}\`);
});
" --input-type=module

# 전체 조회 (우선순위 정렬)
node -e "
import { readFileSync } from 'fs';
import os from 'os';
import path from 'path';

const envRaw = readFileSync(path.join(os.homedir(), '.config/secrets/.env'), 'utf8');
const apiKey = envRaw.match(/NOTION_API_KEY=(.+)/)[1].trim();

const dbRes = await fetch('https://api.notion.com/v1/databases/329111a5-7788-8021-9027-deea1f33dd18/query', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
  body: JSON.stringify({ sorts: [{ property: '우선순위', direction: 'ascending' }] })
});
const db = await dbRes.json();
console.log('=== 투두 목록 ===');
db.results.forEach(p => {
  const name = p.properties['이름']?.title?.[0]?.text?.content || '-';
  const status = p.properties['상태']?.select?.name || '-';
  const priority = p.properties['우선순위']?.select?.name || '-';
  if (status !== '완료') console.log(\`[\${status}] \${name} (우선순위: \${priority})\`);
});
" --input-type=module
```

## 프로젝트 현황 조회

```bash
node -e "
import { readFileSync } from 'fs';
import os from 'os';
import path from 'path';

const envRaw = readFileSync(path.join(os.homedir(), '.config/secrets/.env'), 'utf8');
const apiKey = envRaw.match(/NOTION_API_KEY=(.+)/)[1].trim();
const PAGE_ID = '329111a5-7788-812e-878b-f7532f706e05';

const [pageRes, blockRes] = await Promise.all([
  fetch('https://api.notion.com/v1/pages/' + PAGE_ID, {
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Notion-Version': '2022-06-28' }
  }),
  fetch('https://api.notion.com/v1/blocks/' + PAGE_ID + '/children', {
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Notion-Version': '2022-06-28' }
  })
]);

const page = await pageRes.json();
const blocks = await blockRes.json();
const props = page.properties;
console.log('=== 상페마법사 웹에디터 ===');
console.log('상태:', props['상태']?.select?.name || '-');
console.log('진행률:', Math.round((props['진행률']?.number ?? 0) * 100), '%');
console.log('다음할일:', props['다음할일']?.rich_text?.[0]?.text?.content || '-');
console.log('블로커:', props['블로커']?.rich_text?.[0]?.text?.content || '없음');
console.log('마지막세션:', props['마지막세션']?.date?.start || '-');
" --input-type=module
```

## DB 업데이트

```bash
node -e "
import { readFileSync } from 'fs';
import os from 'os';
import path from 'path';

const envRaw = readFileSync(path.join(os.homedir(), '.config/secrets/.env'), 'utf8');
const apiKey = envRaw.match(/NOTION_API_KEY=(.+)/)[1].trim();
const PAGE_ID = '329111a5-7788-812e-878b-f7532f706e05';
const 다음할일 = '다음에 할 작업 내용';
const 진행률 = 0.5;  // 0.0 ~ 1.0
const 상태 = '진행중';  // 진행중 / 🔴 스톱 / 검수중 / 완료
const 블로커 = '';

const props = {
  '다음할일': { rich_text: [{ text: { content: 다음할일 } }] },
  '진행률': { number: Math.min(1, Math.max(0, 진행률)) },
  '마지막세션': { date: { start: new Date().toISOString().split('T')[0] } },
  '상태': { select: { name: 상태 } },
};
if (블로커) props['블로커'] = { rich_text: [{ text: { content: 블로커 } }] };
const res = await fetch('https://api.notion.com/v1/pages/' + PAGE_ID, {
  method: 'PATCH',
  headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
  body: JSON.stringify({ properties: props })
});
const data = await res.json();
console.log(data.id ? '✅ 업데이트 완료' : '❌ 실패: ' + JSON.stringify(data));
" --input-type=module
```

---

## 오픈소스 레퍼런스 리스트

디자인/UX/아키텍처 참고용. 구현 전 반드시 확인할 것.

| 프로젝트 | URL | 주요 참고 포인트 |
|---------|-----|----------------|
| **Suika** | https://github.com/F-star/suika | 선택 아웃라인(#1592fe, 1.5px), 핸들 7px 정사각형, Command+Transaction 이중 히스토리, Strategy 패턴 툴 시스템 |
| **Grida** | https://github.com/gridaco/grida | Figma 플러그인 연동, 컴포넌트 시스템, 협업 아키텍처 |
| **tldraw** | https://github.com/tldraw/tldraw | 무한 캔버스, 핸드drawn 스타일, 바인딩/화살표 시스템, 상태머신 기반 툴 관리 |
| **Penpot** | https://github.com/penpot/penpot | 오픈소스 Figma 대안, SVG 기반 렌더링, 컴포넌트/라이브러리 시스템, 다국어 |
| **vue-fabric-editor** | https://github.com/ikuaitu/vue-fabric-editor | Fabric.js 기반, Vue3, 다양한 블록 타입, 한국어 문서 참고 가능 |
| **Graphite** | https://github.com/GraphiteEditor/Graphite | Rust/WebAssembly 기반, 노드 기반 편집, 비파괴 편집 철학 |

### 즉시 적용 가능한 레퍼런스 항목

**Suika에서 직접 가져올 것:**
- 선택 아웃라인: `outline: 1.5px solid #1592fe` + `box-shadow: 0 0 0 3px rgba(21,146,254,0.15)`
- 선택 핸들: 7px 정사각형, `fill:#fcfcfc`, `border: 2px solid #1592fe`
- 드래그 선택 박스: `fill: #0f8eff33`, `border: 1px solid #0f8eff`
- 작은 요소(뷰포트 40px 미만) 핸들 자동 바깥 이동
- 정렬 단축키: `⌥W/A/S/D/H/V`

**tldraw에서 참고할 것:**
- 상태머신 기반 툴 전환 (현재 if/else 분기 → 개선 가능)
- 무한 캔버스 팬/줌 UX

**Penpot에서 참고할 것:**
- 프로퍼티 패널 카드 구조 (섹션 구분, 12px bold 타이틀)
- 컴포넌트 라이브러리 시스템
