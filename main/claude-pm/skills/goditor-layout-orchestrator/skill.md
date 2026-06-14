---
name: goditor-layout-orchestrator
description: 이미지 + (선택)대상 섹션 ID를 받아 자동으로 create/rebuild/fill 모드를 디스패치해서 에디터 섹션을 완성하는 총괄 오케스트레이터 스킬. CDP 포트 9334 대상. 사용자에게 모드/프로젝트 선택을 묻지 않는다.
version: 3.1.0
---

# goditor-layout-orchestrator (총괄 오케스트레이터)

## 역할

이미지를 받아 에디터 조립까지 전체 파이프라인을 총괄한다.
각 단계는 전문 서브스킬에 위임한다.

1. **세션 시작** — 새 프로젝트 생성 or 기존 프로젝트 이어서 선택
2. **스크래치패드 로드** — 이미지를 캔버스 우측에 참고용으로 배치
3. **레이아웃 분석 → Spec 작성** — `/goditor-layout-planner`에 위임
4. **에디터 조립** — `/goditor-layout-generator`에 위임
5. **결과 평가** — `/goditor-layout-evaluator`에 위임 (독립 실행)

---

## 자동 디스패치 (사용자에게 모드 묻지 않음)

사용자는 단순히 *"이 이미지(스크래치)대로 섹션 완성해줘"* 라고만 지시한다.
스킬이 입력을 보고 자동으로 모드를 선택한다. **모드는 사용자가 알 필요 없는 내부 구현 디테일이다.**

### 디스패치 결정 트리

```
1) 입력 확인: 이미지(또는 sp_xxx) + 대상 섹션 ID(sec_xxx)?
   ├─ 대상 섹션 ID 없음 / 빈 캔버스 지시 → 모드 = create (새 섹션 생성)
   └─ 대상 섹션 ID 있음 → 2)로

2) sec_xxx 내부 enumerate
   ├─ 블록 0개 (빈 섹션) → 모드 = rebuild (= create 로직을 sec 안에서 실행)
   └─ 블록 1개 이상 → 3)으로

3) 이미지 영역 ↔ 기존 블록 매핑 시도 (planner-경량 분석)
   ├─ 종류·개수·배치가 매칭됨 → 모드 = fill (텍스트/색상만 채움)
   └─ 매칭 안 됨 (블록 추가/삭제/재배치 필요) → 모드 = rebuild
```

**결정 후 후행 보고만** 한다: `"rebuild 모드로 진행했습니다 (기존 N개 블록 → 새 M개 블록으로 재조립)"`. 모드 선택 자체로 사용자에게 묻지 않는다.

| 모드 | 트리거 | 색상 룰 | 도구 | 워크플로우 |
|---|---|---|---|---|
| **create** | 새 섹션 | 흑백 5단계 (L1~L5) | `addTextBlock/addAssetBlock/...` | planner → generator → evaluator |
| **rebuild** | 기존 sec, 구조 불일치 또는 빈 sec | 흑백 5단계 (L1~L5) | `deleteBlock` 후 create 도구 (sec_id 유지) | enumerate → delete-all → planner → generator(`--target-section`) → evaluator |
| **fill** | 기존 sec, 구조 일치 | 원본 컬러 그대로 | `update_*_block` MCP 도구 | 시각 분석 → blockId별 partial update → evaluator |

---

## 5단계 흑백 팔레트 (create 모드 전용 고정)

create 모드에서는 **모든 색상은 아래 5단계만 사용**한다. fill 모드에서는 적용 안 됨.

| 레벨 | hex | 용도 |
|------|-----|------|
| L1 | `#222222` | 어두운 배경 |
| L2 | `#444444` | 보조 배경 (카드, 구분선) |
| L3 | `#888888` | 보조 요소 (icon-circle bgColor, 보조 텍스트) |
| L4 | `#cccccc` | 서브 텍스트 (caption, 부제목) |
| L5 | `#ffffff` | 메인 텍스트, 강조 |

밝은 배경 섹션은 L1↔L5 반전. 원본 색상(골드, 네이비 등)은 무시.

---

## [CREATE 모드] 세션 시작 루틴

모드=create로 디스패치된 경우. **사용자에게 새 vs 기존 프로젝트 묻지 않는다.** 디폴트는 현재 활성 프로젝트.

### 프로젝트 결정 규칙 (자동)

1. **현재 활성 프로젝트가 있으면 그걸 사용** (`window.activeProjectId`)
2. 활성 프로젝트가 없으면 새 프로젝트 자동 생성:
   ```javascript
   await window.createNewProjectTab()
   await window.setProjectName('자동생성-' + Date.now())
   ```
3. 사용자가 *명시적으로* "새 프로젝트로 만들어줘" 또는 "프로젝트명 X로" 라고 한 경우에만 새 프로젝트 생성. 그 외 묻지 않음.

### PROJECT_ID 전달 규칙

확정된 `PROJECT_ID`는 이후 모든 단계에 명시적으로 전달한다:
- 스크래치패드 로드: 어느 프로젝트에 올릴지 명시 (포트 `9336`, PROJECT_ID)
- 제너레이터: Spec 실행 전 해당 프로젝트가 활성화됐는지 확인

---

## 역할 분리 구조

분석과 구현은 **Spec v2 JSON을 경계로 명확히 분리**된다.

```
[이미지]
   ↓
(분석 단계) → Spec v2 JSON 작성
   ↓
[Spec v2 JSON]  ← 여기서 사람이 검토/수정 가능
   ↓
(구현 단계) → CDP로 에디터에 빌드
   ↓
[에디터 섹션]
```

- **분석 단계 (플래너)**: 이미지를 보고 섹션 구조, 블록 타입, 텍스트, 색상 등을 Spec으로 문서화. **구현 가능 여부도 이 단계에서 판단** — API로 표현 불가능한 요소는 대체 방안을 Spec에 명시하고 제너레이터에 전달
- **구현 단계 (제너레이터)**: Spec을 읽고 CDP API만 호출 — 이미지 재분석 불필요, 막히는 상황 없어야 함
- **평가 단계 (이벨류에이터)**: 빌드 결과를 원본과 비교해 정확도 평가 → 수정 필요 시 플래너에 피드백. **`/goditor-layout-evaluator` 스킬로 독립 실행**
- **Spec이 인터페이스**: 각 단계를 분리하거나 사람이 중간에 개입해 수정할 때 Spec이 경계선 역할을 함

### 플래너의 구현 가능성 분석 (핵심)

Spec 작성 시 각 블록/효과에 대해 아래를 판단한다:

| 판단 항목 | 확인 방법 |
|-----------|-----------|
| 블록 타입 지원 여부 | 이 스킬의 "블록 추가 API 전체" 섹션 확인 |
| API 미지원 기능 | `/Users/a1/web-editor/docs/goditor-api-reference.md` 확인 후 없으면 `/goditor-api` 스킬로 요청 |
| 대체 표현 | 구현 불가 시 가장 근접한 블록으로 대체 방안을 Spec에 명시 |

**Spec에 `note` 필드로 대체 방안 기록 예시:**
```json
{ "type": "image", "preset": "standard", "note": "원본은 그라데이션 오버레이이나 현재 미지원 → asset-block으로 대체" }
```

플래너 단계가 충실할수록 제너레이터는 Spec 그대로 실행만 하면 된다.

### 이벨류에이터 독립성 원칙

이벨류에이터는 **Spec을 보지 않는다.**

같은 에이전트가 Spec을 작성하고 평가하면, 플래너가 놓친 오류를 이벨류에이터도 동일하게 놓친다.
(예: Spec에 잘못된 fontSize가 적혀 있으면, 그걸 기준으로 평가해서 pass를 줘버림)

**이벨류에이터 입력:**
- 원본 이미지 (분석 대상)
- 결과 스크린샷 (빌드 결과)
- Spec은 전달하지 않음

**이벨류에이터 질문:**
> "이 두 이미지가 얼마나 일치하는가?"

Spec이 어떻게 작성됐는지 모르는 상태에서 원본과 결과물만 비교하기 때문에, 플래너의 판단 오류도 독립적으로 잡아낼 수 있다.

### 이벨류에이터 체크 항목

| 항목 | 확인 내용 |
|------|-----------|
| **배경색** | 섹션 배경색이 원본과 일치하는가 |
| **레이아웃** | 열 구성(1열/2열/3열), 비율이 맞는가 |
| **블록 순서** | 각 col 안에 블록이 올바른 순서로 들어갔는가 |
| **텍스트** | 내용, 스타일, 색상, **줄바꿈 여부**가 원본과 맞는가 |
| **이미지 영역** | Asset 블록 위치와 크기가 원본과 맞는가 |

평가 결과가 pass가 아니면 → **Spec 수정** 후 제너레이터 재실행.

---

## 환경

- **CDP 포트**: `9336` (goditor 전용 — 변경 금지)
- **에디터 실행**: `cd /Users/a1/web-editor && npx electron . --remote-debugging-port=9336 admin`
- **ws 경로**: `/Users/a1/web-editor/node_modules/ws`
- **스크래치패드 X**: `960` (캔버스 우측 860px + 100px 여백)
- **기본 이미지 너비**: `860px`

> 서브스킬(`/goditor-images_to_scratchpad` 등)을 호출할 때 포트 `9336`을 인자로 명시해서 전달한다.

---

## Step 1. 스크래치패드 로드

```javascript
// /tmp/scratch_single_load.js
const WebSocket = require('/Users/a1/web-editor/node_modules/ws');
const fs = require('fs');
const path = require('path');
const http = require('http');

const IMG_PATH = '{파일경로}';
const SCRATCH_X = 960;
const WIDTH = 860;
const PORT = 9336;

function getWsUrl() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${PORT}/json`, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        const pages = JSON.parse(data);
        const page = pages.find(p => p.type === 'page' && p.url.includes('web-editor'));
        if (page) resolve(page.webSocketDebuggerUrl);
        else reject(new Error('웹에디터 페이지 없음'));
      });
    }).on('error', reject);
  });
}

(async () => {
  const wsUrl = await getWsUrl();
  const ws = new WebSocket(wsUrl);
  let msgId = 1;
  const pending = new Map();

  function ev(fn, args) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      const expression = args?.length
        ? `(${fn})(${args.map(a => JSON.stringify(a)).join(',')})`
        : `(${fn})()`;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('timeout')); } }, 30000);
    });
  }

  ws.on('message', data => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id).resolve(msg.result?.result?.value ?? msg.result?.result);
      pending.delete(msg.id);
    }
  });

  await new Promise(r => ws.on('open', r));

  const ext = path.extname(IMG_PATH).toLowerCase().replace('.', '');
  const mime = (ext === 'jpg' || ext === 'jpeg') ? 'jpeg' : ext;
  const b64 = fs.readFileSync(IMG_PATH).toString('base64');
  const dataUrl = `data:image/${mime};base64,${b64}`;

  const startY = await ev(`() => {
    const items = window._scratchItems || [];
    if (items.length === 0) return 0;
    const last = items[items.length - 1];
    const h = last.el ? last.el.offsetHeight : 0;
    return Math.round(last.y + h + 100);
  }`);

  const result = await ev(`(src, x, y, w) => new Promise(resolve => {
    const img = new Image();
    img.onload = async () => {
      await window._scratchAddAndSave(src, x, y, w);
      resolve({ nw: img.naturalWidth, nh: img.naturalHeight });
    };
    img.onerror = async () => {
      await window._scratchAddAndSave(src, x, y, w);
      resolve({ nw: w, nh: w });
    };
    img.src = src;
  })`, [dataUrl, SCRATCH_X, startY, WIDTH]);

  console.log(`✅ 스크래치패드 로드: ${result?.nw}×${result?.nh}px`);
  ws.close();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
```

---

## Step 2. 레이아웃 분석 → Goditor Spec v2 파일 저장

이미지를 Read 툴로 열고 분석 후 아래 포맷의 JSON을 `/tmp/goditor_spec_{이름}.json` 파일로 저장한다.
값을 스크립트에 하드코딩하지 않는다 — 모든 값은 Spec 파일에서 온다.

```json
{
  "schema": "goditor-spec",
  "version": 2,
  "sections": [
    {
      "label": "Hook|Main|Detail|CTA|Event|''",
      "settings": { "bg": "#ffffff" },
      "rows": [
        {
          "layout": "stack|frame|sub-section",
          "cols": [
            {
              "flex": 1,
              "blocks": []
            }
          ]
        }
      ]
    }
  ]
}
```

### 블록 타입

| 타입 | 필드 |
|------|------|
| `text` | `style`: h1/h2/h3/body/caption/label, `content`, `align`: left/center/right, `color`, `fontSize`, `height`(frame 내부 필수) |
| `image` | `preset`: standard/square/tall/wide/logo |
| `gap` | `height`: px |
| `divider` | `color`, `lineStyle`: solid/dashed/dotted, `weight` |
| `icon-circle` | `size`, `bgColor` |
| `label-group` | `labels: []` |
| `table` | `showHeader`, `cellAlign` |
| `card` | `count`, `bgColor`, `radius` |
| `graph` | `chartType`: bar-v/bar-h, `items: [{label, value}]` |

### layout 선택 기준

- **stack**: 위→아래 단열. 블록 바로 추가
- **frame**: 2~3열 가로 배치. freeLayout Frame + 절대좌표 배치. `frameHeight` 필수
- **sub-section**: 이중 배경 구역 (fullWidth frame)

> `grid` 와 `flex` 는 사용하지 않는다.

### image preset 크기 (고정 px)

| preset | 크기 |
|--------|------|
| standard | height: 780px |
| square | height: 860px |
| tall | height: 1032px |
| wide | height: 575px |
| logo | width: 200px, height: 64px (유일하게 width 고정) |

### label 판단 기준

- **Hook**: 첫인상, 감성 어필, 히어로 이미지, 메인 카피
- **Main**: 핵심 기능·스펙 소개
- **Detail**: 소재, 사용법, 세부 정보, 스펙 표
- **CTA**: 구매 유도, 가격, 버튼
- **Event**: 할인, 기간 한정, 프로모션
- **""**: 판단 불가

---

## Step 3. 캔버스 빌드 — 범용 Spec 런너

제너레이터는 Spec 파일을 읽어서 실행한다. 값을 직접 쓰지 않는다.

```
node /Users/a1/web-editor/scripts/goditor_runner.js /tmp/goditor_spec_{이름}.json
```

런너 스크립트 (`/Users/a1/web-editor/scripts/goditor_runner.js`):

```javascript
const WebSocket = require('/Users/a1/web-editor/node_modules/ws');
const http = require('http');
const fs = require('fs');
const PORT = 9336;

const specPath = process.argv[2];
if (!specPath) { console.error('usage: node goditor_runner.js <spec.json>'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

function getWsUrl() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${PORT}/json`, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        const pages = JSON.parse(data);
        const page = pages.find(p => p.type === 'page' && p.url.includes('web-editor'));
        if (page) resolve(page.webSocketDebuggerUrl);
        else reject(new Error('웹에디터 페이지 없음'));
      });
    }).on('error', reject);
  });
}

(async () => {
  const wsUrl = await getWsUrl();
  const ws = new WebSocket(wsUrl);
  let msgId = 1;
  const pending = new Map();

  function ev(expr) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } }));
      setTimeout(() => { pending.delete(id); reject(new Error('timeout')); }, 10000);
    });
  }

  ws.on('message', data => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id).resolve(msg.result?.result?.value ?? msg.result?.result);
      pending.delete(msg.id);
    }
  });

  await new Promise(r => ws.on('open', r));
  const delay = ms => new Promise(r => setTimeout(r, ms));

  // 런너 전체 소스는 /Users/a1/web-editor/scripts/goditor_runner.js 참조
  // layout: 'frame'   → freeLayout Frame + 절대좌표 배치 (addTextBlock/addAssetBlock에 x/y/width 전달)
  // layout: 'sub-section' → addFrameBlock({ fullWidth: true, bg }) + deactivateFrame()
  // layout: 'stack'   → 블록 직접 추가
})().catch(e => { console.error('❌', e.message); process.exit(1); });
```

---

## 컴포넌트 선택 가이드 (Manifest)

spec 작성 직전, **"어떤 블록을 쓸 것인가"** 결정 단계에서 반드시 manifest를 참조한다.
API 시그니처(아래 "블록 추가 API 전체")는 **컴포넌트가 정해진 뒤** 호출 문법을 찾는 용도다.

- 사람이 빠르게 보기: `/Users/a1/web-editor/docs/component-manifest.md`
- planner/orchestrator가 programmatic하게 읽기: `/Users/a1/web-editor/main/claude-pm/component-manifest.json`

각 컴포넌트는 다음 메타를 가진다:
- `name`, `prefix` (DOM id 접두사 — orchestrator가 generator 호출 검증에 사용)
- `category` — `special` (자체 모달/렌더러) / `primitive` (1차 요소)
- `useCases` — 권장 시나리오 리스트
- `notRecommendedFor` — 다른 컴포넌트로 빠질 만한 함정 케이스
- `examplePrompt` — 사용자 요청 → 이 컴포넌트가 정답인 예시
- `api` — 실제 호출할 `window.addXxxBlock` 식별자

### 선택 절차

1. 사용자 요청에서 핵심 의도 추출 (예: "강조 라벨", "단계 가이드", "비교표")
2. manifest의 `useCases` 매칭으로 후보 2~3개
3. `notRecommendedFor`로 후보 제거 (예: 짧은 라벨인데 text-block 쓰면 안 됨 → sticker로 확정)
4. spec JSON `type` 필드에 컴포넌트명 적기
5. orchestrator가 prefix 검증 + 해당 `api`로 실제 호출

### Manifest에 없는 컴포넌트가 필요할 때

1. 본 스킬의 "API 부재 시 프로세스" 따르기
2. 신규 블록이 에디터에 추가되면 manifest JSON에도 한 항목 추가 (PM이 즉시 활용)

---

## 블록 추가 API 전체

```javascript
// 텍스트 (content로 생성과 동시에 세팅. 빈 문자열은 무시되므로 공백 ' ' 사용)
// fontSize: px 단위 숫자. 기본값 — h1:104, h2:72, h3:48, body:28, caption:20, label:18
window.addTextBlock('h1', { content: '제목', fontSize: 32, align: 'center', color: '#ffffff' })
window.addTextBlock('body', { content: '본문', color: '#333333' })

// 이미지 (preset = 고정 px 높이)
window.addAssetBlock('standard')   // 780px
window.addAssetBlock('square')     // 860px
window.addAssetBlock('tall')       // 1032px
window.addAssetBlock('wide')       // 575px
window.addAssetBlock('logo')       // 200×64px (width도 고정)

// 여백
window.addGapBlock(40)

// 구분선
window.addDividerBlock({ color: '#cccccc', lineStyle: 'solid', weight: 1 })

// 원형 아이콘
window.addIconCircleBlock({ size: 240, bgColor: '#e8e8e8' })

// 라벨 그룹
window.addLabelGroupBlock({ labels: ['태그1', '태그2'] })

// 표
window.addTableBlock({ showHeader: true, cellAlign: 'center' })

// 카드
window.addCardBlock(2, { bgColor: '#f5f5f5', radius: 12 })

// 그래프
window.addGraphBlock({ chartType: 'bar-v', items: [{ label: '항목', value: 80 }] })
```

---

## 섹션 배경색 API

```javascript
// 생성 시 한 번에
window.addSection({ skipDefaultBlock: true, bg: '#1565C0' })

// 생성 후 별도로 (섹션 요소 직접)
const sec = window.getSelectedSection()
window.setSectionBg(sec, '#1565C0')

// id 문자열로 지정
window.setSectionBg('sec_abc123', '#f5f5f5')

// 배경색 제거
window.setSectionBg(sec, '')
```

dataset.bg에 기록되어 재로드 시 자동 복원됨.

---

## 열 레이아웃 비율 레퍼런스 (frame layout)

| 구성 | flex 값 | colW (860px 기준) |
|------|---------|-------------------|
| 1열 | → stack 사용 | - |
| 2열 균등 | 1 : 1 | 430 : 430 |
| 2열 좌소우대 | 1 : 3 | 215 : 645 |
| 2열 좌대우소 | 3 : 1 | 645 : 215 |
| 2열 황금비 | 2 : 3 | 344 : 516 |
| 3열 균등 | 1 : 1 : 1 | 287 : 287 : 286 |

frame row 예시:
```json
{ "layout": "frame", "frameHeight": 580, "cols": [
  { "flex": 1, "blocks": [
    { "type": "gap", "height": 40 },
    { "type": "text", "style": "h2", "content": "제목", "fontSize": 48, "color": "#ffffff", "height": 67 }
  ]},
  { "flex": 1, "blocks": [
    { "type": "image", "preset": "standard" }
  ]}
]}

---

## [CREATE 모드] 전체 실행 순서

```
1. node /tmp/scratch_single_load.js   → 스크래치패드에 원본 이미지 로드
2. /goditor-layout-planner            → 이미지 분석 → /tmp/goditor_spec_{이름}.json 저장
3. (선택) 사람이 Spec 검토/수정
4. /goditor-layout-generator          → Spec 실행 → 에디터 섹션 조립
5. /goditor-layout-evaluator          → 원본 vs 결과 스크린샷 독립 비교
6. PARTIAL/FAIL 항목 있으면 → Spec 수정 후 4번부터 재실행
```

---

## [REBUILD 모드] 기존 섹션 재조립

### 목적
기존 섹션 `sec_xxx`의 **블록 구조 자체가 이미지와 다를 때**, 안의 블록을 전부 비우고 이미지 기준으로 다시 조립한다. **sec_id는 유지**된다 (다른 곳에서 sec_id를 참조하고 있을 수 있으므로).

create와의 차이점은 단 하나: `addSection`을 호출하지 않고 기존 sec를 재사용한다. 색상 룰(흑백 5단계), 블록 추가 API, planner/generator 사용은 동일.

### 트리거 조건 (디스패처가 자동 선택)
- 대상 sec_xxx가 비어있음 (블록 0개)
- 대상 sec_xxx에 블록이 있지만 이미지 구조와 매칭이 안 됨 (개수·종류·배치 불일치)

### 흐름

**1) sec 존재 확인 + 활성 프로젝트 확인**
```js
const sec = document.getElementById('sec_xxx');
if (!sec) throw new Error('sec_xxx 없음');
```

**2) sec 내부 기존 블록 enumerate (top-level 전체 — 화이트리스트 없이)**
```js
// 모든 top-level 자식 (gap/row/frame/text 등 종류 무관) — id 있는 것만
// 이전 화이트리스트 방식은 누락 prefix(gb_, row_, ss_ 등) 때문에 잔존 누적 발생 → 화이트리스트 폐기
const blockIds = [...sec.querySelectorAll(':scope > [id]')].map(b => b.id);
```
※ section-hitzone, section-toolbar 같은 inner sibling은 id 없으므로 자연 제외. section-inner 안의 자식들도 동일 패턴(`:scope > .section-inner > [id]`)으로 enumerate 가능.

**3) 기존 블록 일괄 삭제 — 빈 컨테이너 + gap도 다 지움**
```js
for (const id of blockIds) window.deleteBlock(id);
// 또는 더 단순: sec.querySelector(':scope > .section-inner').innerHTML = '' (단 이벤트 listener 잔존 위험)
```

**3-1) 신규 gap 삽입은 반드시 정식 API 사용**
```js
// ❌ 핵 금지: document.createElement('div').className = 'gap-block'
// ✅ 정식: addGapBlock(height) — 자동으로 id/dataset/이벤트 다 갖춤
window.addGapBlock(80);  // 80px gap
```

**4) sec 선택 상태로 만들기**
```js
window.deselectAll?.();
sec.classList.add('selected');
window.syncSection?.(sec);
```
(이 단계는 runner가 `--target-section` 받으면 내부에서 자동으로 처리하므로 생략 가능)

**5) planner → spec 생성 (create와 동일)**
```
/goditor-layout-planner   → /tmp/goditor_spec_{이름}.json
```

**6) generator를 `--target-section` 플래그로 실행**
```bash
node /Users/a1/web-editor/scripts/goditor_runner.js \
  /tmp/goditor_spec_{이름}.json \
  --port 9334 \
  --target-section sec_xxx
```
runner가 `addSection` 호출을 스킵하고 기존 sec_xxx에 블록을 추가한다.

**7) evaluator로 원본 vs 결과 비교 (create와 동일)**

### 후행 보고 (사용자에게)
```
rebuild 모드로 진행 (sec_xxx 유지)
- 삭제: 기존 N개 블록
- 추가: 새 M개 블록 (planner spec 기반)
- evaluator 결과: ...
```

### 금지 사항 (rebuild 모드)
- ❌ sec_xxx 자체를 deleteSection으로 삭제하지 말 것 — sec_id는 유지
- ❌ 새 섹션을 만들어서 마치 rebuild인 것처럼 위장 금지
- ❌ "fill로 안 됐으니 그냥 새 섹션 만들고 끝" 같은 우회 금지

---

## [FILL 모드] 기존 섹션/블록 채우기

### 목적
이미 만들어진 섹션(예: `sec_xxx`) 안의 기존 블록(banner02/comparison/step/card/mockup/text)을 *참고 이미지를 보고* 텍스트·색상으로 채운다. **새 블록을 생성하지 않는다.**

### 룰 차이 (create와 비교)
| | create | fill |
|---|---|---|
| 색상 | 흑백 5단계 고정 | **원본 컬러 카피** |
| 도구 | `addTextBlock/addAssetBlock/...` | **`update_*_block` MCP 도구만** |
| Spec | v2 JSON (rows/cols/blocks) | 불필요 — blockId별 partial 직접 작성 |
| 스크래치 이미지 | 참고 자료 | 참고 자료 (블록에 박지 말 것) |

### 금지 사항 (fill 모드)
- ❌ **스크래치 이미지를 블록에 그대로 박지 말 것** — sp_xxx는 *시각 참고용*. (사용자 룰)
- ❌ 새 블록 생성 (`addTextBlock`, `addBanner02Block` 등) 금지 — *기존 블록만* update
- ❌ 흑백 5단계 강제 안 함 — 원본 컬러 그대로 카피
- ⚠️ 그라데이션 미지원 → 가장 가까운 hex로 근사 + Spec/보고에 `note: "그라데이션 → hex 근사"` 명시
- ⚠️ banner02 우측 이미지/일러스트 슬롯 같은 *외부 src* 필요한 자리는 비워두기 (보고에 명시)

### 흐름

**1) 대상 섹션 + 참고 이미지 입력**
- 섹션 ID: `sec_xxx` (사용자 명시) — 또는 `window.getSelectedSection()?.id` 자동 픽
- 참고 이미지: `sp_xxx` (스크래치) 또는 외부 파일 경로

**2) 기존 블록 enumerate**
```js
const sec = document.getElementById('sec_xxx');
const blocks = [...sec.querySelectorAll('[id]')].filter(b =>
  /^(tb_|ab_|bn2_|cmp_|stb_|cdb_|cvb_|mkp_|icn_)/.test(b.id)
).map(b => ({
  id: b.id,
  type: (b.className.split(' ').find(c => c.endsWith('-block')) || '?'),
  dataset: { ...b.dataset }
}));
```

**3) 매핑 — 원본 이미지의 어느 영역 ↔ 어느 blockId**
- 이미지 시각 분석 (Read tool로 png 보기)
- 영역별로 *어떤 블록 종류와 매칭되는지* 추정 (banner02 ↔ 가로 배너, comparison ↔ N칼럼 비교 등)
- 1:1 매핑 표 작성 (메인 세션 또는 sub-skill)

**4) 블록별 partial 작성 후 update**

| 블록 prefix | MCP 도구 | partial 예시 |
|---|---|---|
| `bn2_` | `update_banner02_block` | `{label, title, sub, labelColor, titleColor, subColor, bg, layout, imgFit}` (단 imgSrc는 외부 자산 필요) |
| `cmp_` | `update_comparison_block` | `{cols: [{title, rows, bg, text}], featured, ...}` 또는 `{columnPatch: [{index, ...}]}` |
| `stb_` | `update_step_block` | `{steps: [{title, desc}], titleColor, descColor, numBg, ...}` |
| `cdb_` | `update_card_block` | `{cards: [{title, desc, imgSrc?}], bgColor, ...}` |
| `mkp_` | `update_mockup_block` | `{deviceKey?, width?, shadow?}` (imgSrc는 외부 자산 필요) |
| `tb_` | `update_block` | `{content}` |
| `icn_` | (도구 미존재) | iconify는 *교체*는 어려움 — 빈 슬롯에 *새로 추가*는 `add_iconify_block` 별도 호출 |

**5) 검증 (evaluator 독립)**
- 원본 이미지 vs 결과 스크린샷 1:1 비교
- 체크: 텍스트 일치, 색상 톤 일치, 줄바꿈, 강조 위치
- 흑백 5단계 룰 *적용 안 함* (원본 컬러 그대로)

### Fill 모드 실행 순서 (요약)
```
1. 모드=fill 확정 + 대상 sec_xxx + 참고 이미지(sp_xxx 또는 파일)
2. sec_xxx 안 블록 enumerate (id prefix 기반 type 추정)
3. 원본 이미지 시각 분석 → 영역 ↔ blockId 1:1 매핑
4. blockId별 partial 작성 (banner02 패턴 미러)
5. update_*_block 시퀀스 호출 (CDP 또는 PM이 MCP로)
6. /goditor-layout-evaluator (Spec 없이 원본 vs 결과 비교)
7. 불일치 항목 → partial 재작성 후 4번부터 재실행
```

### 일치 한계 (보고에 항상 포함)
- 그라데이션 배경 → hex 근사 (정확한 톤 재현 X)
- 외부 이미지/일러스트 슬롯 → 비움 (사용자에게 자산 요청)
- 폰트/줄간격 등 디테일은 도구 지원 범위 내에서만

---

## 서브스킬 역할 분담

| 단계 | 스킬 | 역할 |
|------|------|------|
| 분석 | `/goditor-layout-planner` | 이미지 → Spec v2 JSON 파일 |
| 조립 | `/goditor-layout-generator` | Spec JSON → `goditor_runner.js` 실행 |
| 평가 | `/goditor-layout-evaluator` | 원본 vs 결과 독립 비교 (Spec 보지 않음) |

---

## 외부 협업

| 작업 | 담당 스킬 |
|------|-----------|
| 에디터 코드 수정 (block-factory, editor.js 등) | `/goditor` |
| Goditor API 설계/기획/문서 관리 | `/goditor-api` |
| 이미지 폴더 전체를 스크래치패드에 일괄 로드 | `/goditor-images_to_scratchpad` |
| Figma ↔ 에디터 연동 (임포트/익스포트/직접 제어) | `/goditor-figma` |

- API가 없거나 버그가 있을 때 → **`/goditor-api`** 로 리포트/요청
- 에디터 코드 직접 수정이 필요할 때 → **`/goditor`** 로 전달
- 이미지가 여러 장일 때 스크래치패드 일괄 업로드 → **`/goditor-images_to_scratchpad`**
- 피그마 연동(임포트/익스포트/직접 제어) → **`/goditor-figma`** (채널 ID + 프레임 ID)

---

## API 문서 위치

| 문서 | 경로 |
|------|------|
| **API 레퍼런스 (최신)** | `/Users/a1/web-editor/docs/goditor-api-reference.md` |
| **Spec v2 정의** | `/Users/a1/web-editor/docs/goditor-spec-v2.md` |
| **컴포넌트 선택 카탈로그 (사람용)** | `/Users/a1/web-editor/docs/component-manifest.md` |
| **컴포넌트 메타 (PM/스킬용 JSON)** | `/Users/a1/web-editor/main/claude-pm/component-manifest.json` |
| **테스트 세션 프롬프트** | `/Users/a1/web-editor/docs/goditor-test-session-prompt.md` |

---

## API 부재 시 프로세스

필요한 API가 에디터에 구현되어 있지 않을 때:

1. `/Users/a1/web-editor/docs/goditor-api-reference.md` 먼저 확인 — 이미 있는지 체크
2. 없으면 **`/goditor-api` 스킬**로 에디터 담당자에게 요청 전달
   - 현재 상황, 필요한 이유, 원하는 API 시그니처를 명확히 설명
3. 구현 완료 후 이 스킬(skill.md)의 API 섹션 업데이트

---

## 금지 사항

- `innerHTML`로 블록/섹션 구조 직접 작성 ❌
- `window.*` 함수 외 DOM 직접 조작 ❌
- `addTextBlock` 호출 후 별도 `innerHTML`로 텍스트 수정 ❌ (content 옵션 사용)
- `addRowBlock`, `activateCol`, `addNewGridBlock` 사용 ❌ (삭제된 구버전 API)
- `flex`, `grid` layout Spec 작성 ❌ (`frame` 사용)

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| 블록이 다 새 row로 분리됨 | `activateCol` 미호출 또는 구버전 방식 | `addRowBlock` 후 `.row.row-active`로 row 참조, `activateCol(row, idx)` 호출 |
| 스크래치패드 리로드 후 사라짐 | 구버전 함수 사용 | `_scratchAddAndSave` 사용 |
| 배경색이 저장 안 됨 | `style.backgroundColor` 직접 수정 | `setSectionBg()` 또는 `addSection({ bg })` 사용 |
| 9336 응답없음 | 앱 꺼짐 | `cd /Users/a1/web-editor && npx electron . --remote-debugging-port=9336 admin` |
