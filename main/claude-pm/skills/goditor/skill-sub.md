---
name: cto-webeditor-sub
description: [상페마법사 웹에디터] 서브 터미널(feature 브랜치 작업 세션)용 컨텍스트 스킬. feature 브랜치 개발 시 참고할 프로젝트 구조, IPC 패턴, 블록 구조, 병합 규칙을 담고 있어.
version: 1.1.0
---

# 상페마법사 웹에디터 — 서브 터미널 컨텍스트

## 이 세션의 역할

- **메인 세션** (`dev` 브랜치 담당): 브랜치 DB 작업 등록, 병합, 충돌 해소, `dev → main` PR
- **이 세션 (서브)**: feature 브랜치 개발 담당. 완성 시 브랜치 DB 상태를 "머지요청"으로 변경

## 세션 시작 절차 (서브터미널 진입 시)

사용자가 브랜치명을 알려주면 (예: "feature/T23-text-edit-ux"):

### 1단계: 내 작업 DB 읽기

> ⚠️ 브랜치명으로 기존 항목을 찾는다. 항목이 없어도 절대 새로 생성하지 않는다.

```bash
node -e "
import { readFileSync } from 'fs';
import os from 'os';
import path from 'path';

const envRaw = readFileSync(path.join(os.homedir(), '.config/secrets/.env'), 'utf8');
const apiKey = envRaw.match(/NOTION_API_KEY=(.+)/)[1].trim();
const BRANCH = 'feature/T23-text-edit-ux';  // ← 사용자 입력값으로 교체

const res = await fetch('https://api.notion.com/v1/databases/329111a5-7788-81b4-83db-febdf925c34d/query', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
  body: JSON.stringify({
    filter: { property: '브랜치명', rich_text: { contains: BRANCH } }
  })
});
const db = await res.json();
const p = db.results[0];
if (!p) { console.log('항목 없음 — 메인 세션에 등록 요청'); process.exit(0); }

const name   = p.properties['기능명']?.title?.[0]?.text?.content || '-';
const branch = p.properties['브랜치명']?.rich_text?.[0]?.text?.content || '-';
const status = p.properties['상태']?.select?.name || '-';
const memo   = p.properties['머지로그']?.rich_text?.map(t => t.plain_text).join('') || '';
console.log('PAGE_ID:', p.id);
console.log('기능명:', name);
console.log('브랜치명:', branch);
console.log('상태:', status);
console.log('터미널:', p.properties['터미널']?.select?.name || '-');
console.log('\n=== 작업 지시 (머지로그) ===');
console.log(memo || '(없음)');
" --input-type=module
```

### 2단계: 브랜치 체크아웃 & 작업

```bash
cd /Users/a1/web-editor
git checkout dev && git pull origin dev
git checkout <브랜치명>   # DB에서 읽은 브랜치명으로
# 없으면 새로 생성: git checkout -b <브랜치명>
```

### 3단계: 완료 시 상태만 변경 (새 항목 생성 금지)

> ⚠️ 반드시 1단계에서 얻은 PAGE_ID로 PATCH. POST(새 항목 생성) 절대 금지.
> 머지로그는 덮어쓰지 않는다 — 상태와 완료일만 변경.

```bash
node -e "
import { readFileSync } from 'fs';
import os from 'os';
import path from 'path';

const envRaw = readFileSync(path.join(os.homedir(), '.config/secrets/.env'), 'utf8');
const apiKey = envRaw.match(/NOTION_API_KEY=(.+)/)[1].trim();
const PAGE_ID = 'XXXXXXXX-...';  // ← 1단계에서 출력된 PAGE_ID로 교체

const res = await fetch('https://api.notion.com/v1/pages/' + PAGE_ID, {
  method: 'PATCH',  // ← PATCH만 사용. POST 금지.
  headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
  body: JSON.stringify({ properties: {
    '상태':   { select: { name: '머지요청' } },
    '완료일': { date: { start: new Date().toISOString().split('T')[0] } },
  }})
});
const data = await res.json();
console.log(data.id ? '✅ 머지요청으로 변경 완료' : '❌ 실패: ' + JSON.stringify(data));
" --input-type=module
```

---

## 메인 세션 — 브랜치 DB에 작업 등록하는 법

> 이 섹션은 메인 세션(dev 담당)이 서브터미널에 작업을 배정할 때 사용

### 새 브랜치 항목 생성 + 작업 지시 작성

```bash
node -e "
import { readFileSync } from 'fs';
import os from 'os';
import path from 'path';

const envRaw = readFileSync(path.join(os.homedir(), '.config/secrets/.env'), 'utf8');
const apiKey = envRaw.match(/NOTION_API_KEY=(.+)/)[1].trim();

// ── 여기만 수정 ──
const 기능명   = 'feature/template-folder';
const 브랜치명 = 'feature/template-folder';
const 터미널   = 'T14';  // T1~T13 중 사용
const 작업지시 = [
  '## 작업 내용: 템플릿 폴더 구조 개편',
  '',
  '### 변경 범위',
  '- js/template-system.js',
  '- js/editor.js (~441줄 저장 UI)',
  '- css/editor.css',
  '',
  '### 세부 지시',
  '1. 저장 UI: 폴더 드롭다운 → 카테고리 드롭다운 → 이름 입력 → 저장',
  '2. 좌측 패널: 폴더 필터 드롭다운 + 카테고리 토글 + 템플릿 리스트',
  '3. 미리보기: 패널 인라인 → document.body 독립 모달',
  '',
  '완료 후: 상태를 "머지요청"으로 변경'
].join('\n');
// ────────────────

// 1. DB 행 생성
const createRes = await fetch('https://api.notion.com/v1/pages', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
  body: JSON.stringify({
    parent: { database_id: '329111a5-7788-81b4-83db-febdf925c34d' },
    properties: {
      '기능명':  { title: [{ text: { content: 기능명 } }] },
      '브랜치명':{ rich_text: [{ text: { content: 브랜치명 } }] },
      '상태':    { select: { name: '진행중' } },
      '터미널':  { select: { name: 터미널 } },
      '시작일':  { date: { start: new Date().toISOString().split('T')[0] } },
    }
  })
});
const page = await createRes.json();
if (!page.id) { console.error('생성 실패:', JSON.stringify(page)); process.exit(1); }
console.log('생성된 PAGE_ID:', page.id);

// 2. 페이지 본문에 작업 지시 작성
const lines = 작업지시.split('\n');
const blocks = lines.map(line => ({
  object: 'block',
  type: 'paragraph',
  paragraph: { rich_text: [{ text: { content: line } }] }
}));
await fetch('https://api.notion.com/v1/blocks/' + page.id + '/children', {
  method: 'PATCH',
  headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
  body: JSON.stringify({ children: blocks })
});
console.log('✅ 작업 지시 등록 완료 → 서브터미널에 T' + 터미널.replace('T','') + ' 시작 요청');
" --input-type=module
```

### 서브터미널에 보내는 한 줄 메시지

```
/cto-webeditor-sub
나는 T14 터미널이야. 브랜치 DB에서 내 작업 읽고 시작해.
```

## 프로젝트 기본 정보

- **로컬 경로**: `/Users/a1/web-editor/`
- **GitHub**: `https://github.com/bnam91/web-editor`
- **실행**: `npm start` (Electron 앱)
- **캔버스 폭**: 860px 고정

## 브랜치 전략

```
main   ← 안정 배포본 (직접 커밋 금지)
dev    ← 중간 통합 브랜치 (메인 세션 담당)
feature/xxx  ← 이 세션에서 작업
```

### 병합 요청 방법
1. feature 브랜치에서 작업 완료 후 커밋
2. 메인 세션(dev 브랜치)에 아래 형식으로 요청:

```
feature/xxx 병합 요청합니다.
변경 내용: [한 줄 요약]
충돌 예상 파일: js/xxx.js (있는 경우)
```

3. 메인 세션이 `git merge feature/xxx` → 충돌 해소 → dev 안정화 후 main PR

## 현재 브랜치 목록 (참고)

| 브랜치 | 담당 기능 |
|--------|----------|
| feature/T10-hide-exports | 내보내기 UI 숨김 |
| feature/T11-figma-section-sync | Figma 섹션 동기화 |
| feature/T12-row-height | Row 높이 조절 |
| feature/T13-row-properties | Row 프로퍼티 패널 |
| feature/T6-topbar-cleanup | 상단바 정리 |
| feature/T7-smart-save | 스마트 저장 |
| feature/T8-inspector-panel | Inspector 패널 |
| feature/T9-branch-ui | 브랜치 UI |
| feature/component-blocks | 컴포넌트 블록 |
| feature/figma-export | Figma 내보내기 |
| feature/preview | Preview 모드 |
| feature/template | 템플릿 시스템 |
| feature/text-animation-gif | 애니메이션 + GIF |

## 파일 구조

```
/Users/a1/web-editor/
  main.js               ← Electron 메인 프로세스
  preload.js            ← contextBridge (window.electronAPI)
  index.html            ← 에디터 메인 페이지
  css/editor.css        ← 스타일 (CSS Variables 기반)
  presets/              ← 디자인 프리셋 JSON (default/dark/brand/minimal)
  templates/
    index.json          ← 템플릿 메타데이터
    canvas/{id}.html    ← 섹션 outerHTML
  projects/             ← 프로젝트 JSON 저장소
  pages/
    projects.html       ← 프로젝트 목록 페이지
  js/
    editor.js           ← 코어 에디터 (선택, 히스토리, 단축키, 섹션 툴바)
    drag-drop.js        ← 드래그앤드롭, 블록 생성(makeTextBlock 등)
    save-load.js        ← 저장/로드, autoSave(MutationObserver + 1.5s debounce)
    export.js           ← JSON 내보내기/가져오기, Figma 업로드
    template-system.js  ← 템플릿 저장/로드/삽입
    image-handling.js   ← 이미지 업로드, 원형 프레임
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
  figma-renderer/
    sangpe_to_figma.mjs ← Figma WebSocket 렌더러
```

## DOM 계층 구조 (블록 모델)

```
.section-block
  └── .section-inner
        └── .row
              └── .col[data-width="50"]
                    ├── .text-block
                    │     └── .tb-h1 / .tb-h2 / .tb-h3 / .tb-body / .tb-caption / .tb-label
                    ├── .asset-block[data-img-src][data-size][data-use-padx]
                    ├── .gap-block
                    ├── .icon-circle-block[data-size][data-bg-color][data-img-src]
                    ├── .table-block
                    ├── .label-group-block
                    └── .group-block
                          └── .group-inner
                                └── .row ...
```

### 블록 data 속성 주요 목록

| 블록 | data 속성 |
|------|----------|
| text-block | (없음, 내부 .tb-xxx 클래스로 타입 구분) |
| asset-block | `data-img-src`, `data-size`(%), `data-use-padx`(true/false), `data-base-height` |
| gap-block | style.height |
| icon-circle-block | `data-size`(px), `data-bg-color`(#hex), `data-img-src` |
| col | `data-width`(%) |

## 저장 포맷 (v2)

```json
{
  "version": 2,
  "currentPageId": "page_1",
  "pages": [
    {
      "id": "page_1",
      "name": "Page 1",
      "label": "Hook",
      "pageSettings": { "bg": "#ffffff", "gap": 100, "padX": 32, "padY": 32 },
      "canvas": "<HTML 문자열>"
    }
  ]
}
```

- 저장: `autoSave()` → MutationObserver + 1.5s debounce → `window.electronAPI.saveProject()`
- 프로젝트 파일: `projects/{id}.json`

## Electron IPC 패턴

### renderer → main (invoke/handle)
```js
// renderer(js/*.js)에서 호출
const result = await window.electronAPI.saveProject(projectObj);
const list   = await window.electronAPI.listProjects();
const data   = await window.electronAPI.loadProject(id);
await window.electronAPI.deleteProject(id);

// 프리셋
const presets = await window.electronAPI.readPresets();
await window.electronAPI.savePreset(presetObj);
await window.electronAPI.deletePreset(presetId);

// 템플릿
const index = await window.electronAPI.loadTemplateIndex();
await window.electronAPI.saveTemplateIndex(arr);
const html  = await window.electronAPI.loadTemplateCanvas(id);
await window.electronAPI.saveTemplateCanvas(id, html);
await window.electronAPI.deleteTemplateCanvas(id);

// Figma
const { success, logs } = await window.electronAPI.figmaUpload(channel, designJSON);
const nodeMap = await window.electronAPI.readNodeMap();
await window.electronAPI.writeNodeMap(nodeMap);

// Fullscreen
const isFS = await window.electronAPI.getFullscreen();
window.electronAPI.onFullscreenChange(val => { ... });
```

### main.js에 새 IPC 핸들러 추가할 때
```js
// main.js
ipcMain.handle('my-feature:action', (event, param) => {
  // fs, path 등 Node.js API 사용 가능
  return result;
});

// preload.js contextBridge에도 추가
myFeatureAction: (param) => ipcRenderer.invoke('my-feature:action', param),
```

> **주의**: renderer(브라우저 컨텍스트)에서는 Node.js API 직접 사용 불가 → 반드시 IPC 경유

## CSS Variables (프리셋 시스템)

```css
/* :root 또는 프리셋 JSON에서 정의 */
--preset-h1-color, --preset-h1-family
--preset-h2-color, --preset-h2-family
--preset-h3-color, --preset-h3-family
--preset-body-color, --preset-body-family
--preset-caption-color
--preset-label-bg, --preset-label-color, --preset-label-radius
```

새 텍스트 스타일 추가 시: CSS + 프리셋 4개 JSON + `TEXT_DEFAULTS`(export.js) 동시 업데이트 필요

## Electron 디버깅 (CDP)

### 앱 CDP 포트로 실행
```bash
cd /Users/a1/web-editor
npm run dev -- --remote-debugging-port=9333
# 또는
npx electron . --remote-debugging-port=9333
```

### 렌더러 페이지에 CDP 연결
1. Chrome에서 `chrome://inspect` → `localhost:9333` 추가
2. 또는 MCP chrome-devtools가 9333 포트 연결 설정된 경우 직접 제어 가능

### 실제 사용자처럼 테스트하기
```bash
# CDP Chrome 열기
pkill -f "remote-debugging-port=9333" 2>/dev/null
npx electron /Users/a1/web-editor --remote-debugging-port=9333 > /tmp/electron_cdp.log 2>&1 &

# 포트 열릴 때까지 대기
python3 -c "
import time, urllib.request, json
for i in range(10):
    try:
        with urllib.request.urlopen('http://localhost:9333/json/version', timeout=2) as r:
            data = json.loads(r.read())
            print('연결됨:', data.get('webSocketDebuggerUrl'))
            break
    except:
        print(f'대기 중... ({i+1}/10)')
        time.sleep(1)
"
```

그 다음 MCP `chrome-devtools` 툴로 `http://localhost:9333` 연결하여 실제 UI 조작 테스트.

## 자주 하는 실수 / 주의사항

- `__dirname` 기반 경로는 패키징 시 read-only. 쓰기 경로는 반드시 `app.getPath('userData')` 사용
- 새 블록 타입 추가 시 반드시 체크해야 할 파일들:
  1. `drag-drop.js` — `makeXxxBlock()` 생성 함수
  2. `export.js` — `_block()` 파싱 + `TEXT_DEFAULTS`
  3. `figma-renderer/sangpe_to_figma.mjs` — 렌더러 처리
  4. `css/editor.css` — 스타일
- autoSave는 MutationObserver로 동작 → DOM 변경 없이 dataset만 바꾸면 저장 안 됨 → `triggerAutoSave()` 직접 호출 필요
