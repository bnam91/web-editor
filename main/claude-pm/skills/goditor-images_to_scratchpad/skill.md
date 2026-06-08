---
name: goditor-images_to_scratchpad
description: 이미지 폴더를 상페마법사 웹에디터의 스크래치패드(참고 자료 영역)에 CDP로 자동 삽입하는 스킬. 사용자가 폴더 경로와 프로젝트명(또는 현재 열린 프로젝트)을 언급하면서 "스크래치패드에 넣어줘", "참고 이미지 올려줘", "이미지 로드해줘" 등을 말할 때 실행해. 필수 입력: 이미지 폴더 경로 + 대상 프로젝트명(없으면 현재 열린 프로젝트로 자동 감지).
version: 2.0.0
---

# goditor-images_to_scratchpad

## 역할

이미지 폴더의 파일들을 순서대로 상페마법사 웹에디터의 **스크래치패드**에 삽입한다.  
스크래치패드는 캔버스 섹션과 독립된 자유 배치 참고 영역(`canvas-scaler` 내 `.scratch-item`)이다.

---

## 필수 입력 파라미터

| 파라미터 | 설명 | 예시 |
|----------|------|------|
| **폴더 경로** | 이미지가 들어있는 로컬 폴더 | `/Users/a1/Downloads/div_download/세이프본_무릎보호대` |
| **프로젝트명** | 현재 웹에디터에서 열린 프로젝트 이름 | `세이프본_무릎보호대`, `proj_1775041043520` 등 |

> 프로젝트명을 말하지 않으면 **"어떤 프로젝트에 넣을까요?"** 라고 반드시 물어볼 것.  
> 단, 사용자가 "현재 열린 프로젝트" 또는 "지금 거"라고 하면 CDP URL에서 자동 감지.

---

## 이 스킬을 호출하는 곳

| 호출자 | 언제 |
|--------|------|
| `/goditor-layout-orchestrator` | 이미지 여러 장을 스크래치패드에 일괄 로드할 때 |

---

## 환경 정보

- **웹에디터 CDP 포트**: 동적 확인 (아래 참조)
- **ws 패키지 경로**: `/Users/a1/web-editor/node_modules/ws`
- **기본 이미지 너비**: `860px`
- **배치 위치**: 캔버스 오른쪽 (`x = 960`, 캔버스 너비 860px + 100px 여백)
- **이미지 간 간격**: `100px`

### 포트 결정 규칙

**항상 시작 전에 포트를 확인한다.**

1. `/goditor-layout-orchestrator`에서 호출된 경우 → 오케스트레이터가 포트를 인자로 전달함 (기본 `9336`)
2. 직접 호출된 경우 → 사용자에게 반드시 물어본다:
   > "어떤 포트의 웹에디터에 올릴까요? (goditor 작업이면 9336, 일반 dev면 9334)"

하드코딩 금지. 포트를 모르면 작업 시작하지 않는다.

---

## 작업 절차

### 1. 포트 상태 확인 및 프로젝트 열기
```bash
curl -s http://127.0.0.1:{PORT}/json
```
- 페이지 없거나(`[]`) 프로젝트가 다르면:
  ```bash
  # goditor 작업 시 (포트 9336)
  cd /Users/a1/web-editor && npx electron . --remote-debugging-port=9336 admin &
  sleep 3
  ```
  그 후 CDP로 프로젝트 URL로 이동:
  ```javascript
  Page.navigate({ url: 'file:///Users/a1/web-editor/index.html?project={PROJECT_ID}' })
  ```
- 이미 올바른 프로젝트가 열려있으면 바로 스크립트 실행

### 2. 스크립트 작성 및 실행
`/tmp/load_images_to_scratchpad.js` 파일을 아래 템플릿으로 작성 후:
```bash
node /tmp/load_images_to_scratchpad.js
```

---

## 핵심 스크립트 템플릿

```javascript
const WebSocket = require('/Users/a1/web-editor/node_modules/ws');
const fs = require('fs');
const path = require('path');
const http = require('http');

const FOLDER = '{사용자_전달_폴더}';
const PROJECT_ID = '{프로젝트_ID}';
const PORT = 9336;  // goditor: 9336 / 일반 dev: 9334
const WIDTH = 860;
const START_X = 960;
const START_Y = 0;
const GAP_Y = 100;

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function evaluate(ws, fn, args, pending, msgIdRef) {
  return new Promise((resolve, reject) => {
    const id = msgIdRef.val++;
    const expression = args && args.length > 0
      ? `(${fn})(${args.map(a => JSON.stringify(a)).join(',')})`
      : `(${fn})()`;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('timeout')); } }, 60000);
  });
}

(async () => {
  // CDP 페이지 자동 조회 (하드코딩 금지 — 매번 바뀜)
  const pages = await getJson(`http://127.0.0.1:${PORT}/json`);
  const page = pages.find(p => p.type === 'page');
  if (!page) throw new Error(`포트 ${PORT}에 웹에디터 페이지 없음`);

  console.log(`현재 URL: ${page.url}`);

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  const msgIdRef = { val: 1 };

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve } = pending.get(msg.id);
      pending.delete(msg.id);
      resolve(msg.result?.result?.value ?? msg.result?.result);
    }
  });

  await new Promise(r => ws.on('open', r));
  console.log('CDP 연결 성공');

  // 다른 프로젝트면 이동
  if (!page.url.includes(PROJECT_ID)) {
    console.log(`프로젝트 이동: ${PROJECT_ID}`);
    const navId = msgIdRef.val++;
    ws.send(JSON.stringify({ id: navId, method: 'Page.navigate', params: { url: `file:///Users/a1/web-editor/index.html?project=${PROJECT_ID}` } }));
    await new Promise(r => setTimeout(r, 4000));
    console.log('페이지 로드 완료');
  }

  // _scratchAddAndSave 존재 여부 확인 (에디터 로드 완료 확인)
  const hasScratchApi = await evaluate(ws, `() => typeof window._scratchAddAndSave === 'function'`, [], pending, msgIdRef);
  if (!hasScratchApi) throw new Error('_scratchAddAndSave 없음 — 에디터가 아직 로드 중이거나 다른 페이지');

  // 기존 스크래치 클리어 (IndexedDB 포함)
  await evaluate(ws, `() => window.clearScratchPad ? window.clearScratchPad() : null`, [], pending, msgIdRef);
  console.log('기존 스크래치 초기화');

  const images = fs.readdirSync(FOLDER)
    .filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
    .sort()
    .map(f => path.join(FOLDER, f));

  console.log(`이미지 ${images.length}개 발견`);

  let curY = START_Y;

  for (let i = 0; i < images.length; i++) {
    const imgPath = images[i];
    const ext = path.extname(imgPath).toLowerCase().replace('.', '');
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : ext;
    const b64 = fs.readFileSync(imgPath).toString('base64');
    const dataUrl = `data:image/${mime};base64,${b64}`;

    process.stdout.write(`[${i+1}/${images.length}] ${path.basename(imgPath)} ... `);

    let result;
    try {
      // _scratchAddAndSave: DOM 생성 + IndexedDB 저장 (새로고침 후에도 유지)
      result = await evaluate(ws, `(src, x, y, w) => new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          const displayH = img.naturalWidth > 0 ? Math.round((img.naturalHeight / img.naturalWidth) * w) : w;
          window._scratchAddAndSave(src, x, y, w);
          resolve({ nw: img.naturalWidth, nh: img.naturalHeight, displayH });
        };
        img.onerror = () => {
          window._scratchAddAndSave(src, x, y, w);
          resolve({ nw: w, nh: w, displayH: w });
        };
        img.src = src;
      })`, [dataUrl, START_X, curY, WIDTH], pending, msgIdRef);
    } catch(e) {
      console.log(`SKIP (${e.message})`);
      curY += WIDTH + GAP_Y;
      continue;
    }

    if (!result || typeof result.displayH === 'undefined') {
      console.log(`SKIP (결과 없음)`);
      curY += WIDTH + GAP_Y;
      continue;
    }

    curY += result.displayH + GAP_Y;
    console.log(`${result.nw}×${result.nh}px`);
  }

  console.log(`\n✅ 완료! ${images.length}개 → IndexedDB 저장 완료 (새로고침 후에도 유지)`);
  ws.close();
})().catch(e => { console.error(e.message); process.exit(1); });
```

---

## 주요 동작 원리

1. `curl http://127.0.0.1:{PORT}/json`으로 현재 CDP 페이지 URL/ID 자동 조회 (하드코딩 금지)
2. 에디터가 없거나 다른 프로젝트면 → `Page.navigate`로 프로젝트 이동 후 4초 대기
3. `window._scratchAddAndSave(src, x, y, w)` 호출 — DOM 생성 + IndexedDB 저장 한 번에 처리
4. 이미지를 **한 장씩** base64로 전달 (한 번에 전달 시 timeout 발생)
5. **새로고침 후에도 유지** — IndexedDB(`ScratchPadDB`)에 프로젝트+페이지 키로 저장됨
6. `clearScratchPad()`로 기존 항목 먼저 초기화 후 삽입

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `_scratchAddAndSave 없음` 오류 | 에디터가 아직 로드 중 | 4초 대기 후 재시도, 또는 프로젝트 수동 오픈 확인 |
| `웹에디터 페이지 없음` 오류 | 해당 포트에 창이 없음 | 에디터 재실행 후 포트 확인 |
| x 좌표 음수면 안 보임 | canvas-wrap scrollLeft=0 한계 | x=960 (캔버스 오른쪽) 고정 |
| 새로고침해도 사라짐 (구버전) | DOM 직접 생성으로 IndexedDB 저장 누락 | `_scratchAddAndSave` 사용으로 해결 (현재 버전) |
