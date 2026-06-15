---
name: goditor-layout-generator
description: Goditor Spec v2 JSON 파일을 읽어 CDP로 에디터에 섹션을 자동 조립한다. 이미지 분석은 하지 않는다.
version: 1.0.0
---

# goditor-layout-generator

## 역할

Spec v2 JSON 파일을 받아 에디터에 섹션을 자동 조립한다.
**이 스킬은 실행만 담당한다. 이미지 분석과 Spec 작성은 `/goditor-layout-planner`가 한다.**

---

## 입력

```
Spec 경로: /tmp/goditor_spec_{이름}.json
```

---

## 실행 순서

1. (선택) 스크래치패드에 원본 이미지 로드
2. Spec JSON 파일 확인
3. `goditor_runner.js` 실행
4. 완료 확인

---

## Step 1. 스크래치패드 로드 (선택)

원본 이미지를 캔버스 우측 참고용으로 배치할 때 실행. 이미 올라간 경우 생략.

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

실행:
```bash
node /tmp/scratch_single_load.js
```

---

## Step 2. Spec 실행

```bash
node /Users/a1/web-editor/scripts/goditor_runner.js /tmp/goditor_spec_{이름}.json
```

런너가 Spec을 읽고 CDP로 에디터에 조립. 값 하드코딩 없음 — 모든 값은 Spec에서 온다.

---

## 환경

- **CDP 포트**: `9336`
- **ws 경로**: `/Users/a1/web-editor/node_modules/ws`
- **런너 경로**: `/Users/a1/web-editor/scripts/goditor_runner.js`
- **에디터 미실행 시**: `cd /Users/a1/web-editor && npx electron . --remote-debugging-port=9336 admin`

---

## 완료 후

빌드 완료 후 `/goditor-layout-evaluator` 스킬에 아래를 전달해 결과를 평가한다:

```
원본: /path/to/original_image.jpg
결과: (에디터 스크린샷)
```

평가 결과에 PARTIAL/FAIL이 있으면 `/goditor-layout-planner`에 피드백 전달 후 Spec 수정 → 재실행.

---

## 금지 사항

- Spec 파일 내용 수정 ❌ (수정이 필요하면 `/goditor-layout-planner`로 피드백)
- `innerHTML`로 블록 구조 직접 작성 ❌
- `window.*` 함수 외 DOM 직접 조작 ❌ (`activateCol`, `col-active` 해제 제외)
- 이미지 재분석 ❌ (막히는 상황 없어야 함)
