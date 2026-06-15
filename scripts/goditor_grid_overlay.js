/**
 * goditor_grid_overlay.js
 * Spec JSON의 paddingX / flex 비율을 읽어서
 * 스크래치패드에 올라간 이미지 위에 그리드 가이드라인을 SVG로 덧그린다.
 *
 * 사용법:
 *   node goditor_grid_overlay.js <spec.json> [scratchpad_image_index]
 *
 * scratchpad_image_index: 스크래치패드에 올라간 이미지 순서 (0-based, 기본값 0)
 */

const WebSocket = require('/Users/a1/web-editor/node_modules/ws');
const http = require('http');
const fs = require('fs');
const PORT = 9336;
const COL_GAP = 12; // flex row gap (editor-layout.css 고정값)

const specPath = process.argv[2];
if (!specPath) {
  console.error('usage: node goditor_grid_overlay.js <spec.json> [image_index]');
  process.exit(1);
}
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const imgIndex = parseInt(process.argv[3] ?? '0');

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
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('timeout: ' + expr.slice(0, 60))); } }, 10000);
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

  // 스크래치패드 이미지 위치/크기 가져오기 (.scratch-item 기준)
  const imgInfo = await ev(`(function() {
    const items = document.querySelectorAll('.scratch-item');
    const el = items[${imgIndex}];
    if (!el) return null;
    return {
      x: parseFloat(el.style.left) || 0,
      y: parseFloat(el.style.top)  || 0,
      w: el.offsetWidth,
      h: el.offsetHeight,
      parentId: el.parentElement?.id || ''
    };
  })()`);

  if (!imgInfo) {
    console.error(`❌ 스크래치패드 이미지 [${imgIndex}] 없음`);
    process.exit(1);
  }

  console.log(`이미지: x=${imgInfo.x}, y=${imgInfo.y}, ${imgInfo.w}×${imgInfo.h} (parent: #${imgInfo.parentId})`);

  // Spec에서 첫 번째 섹션의 paddingX, flex 비율 추출
  const section = spec.sections[0];
  const paddingX = section?.settings?.paddingX ?? 0;
  const rows = section?.rows ?? [];

  // 가이드라인 계산
  const W = imgInfo.w;   // 이미지 너비 (=860px 기준)
  const H = imgInfo.h;
  const scale = W / 860; // 실제 픽셀 스케일

  const lines = []; // { x1, y1, x2, y2, color, label }

  // paddingX 경계선 (좌우)
  const pxLeft  = paddingX * scale;
  const pxRight = W - paddingX * scale;
  if (paddingX > 0) {
    lines.push({ x1: pxLeft,  y1: 0, x2: pxLeft,  y2: H, color: '#FF4444', label: `padX=${paddingX}` });
    lines.push({ x1: pxRight, y1: 0, x2: pxRight, y2: H, color: '#FF4444', label: '' });
  }

  // flex col 경계선
  for (const row of rows) {
    if (row.layout === 'flex' && row.cols?.length > 1) {
      const contentW = (W - paddingX * 2 * scale);
      const totalGap = COL_GAP * scale * (row.cols.length - 1);
      const totalFlex = row.cols.reduce((s, c) => s + (c.flex || 1), 0);
      const colAvail = contentW - totalGap;

      let cursor = pxLeft;
      for (let i = 0; i < row.cols.length - 1; i++) {
        const colW = colAvail * ((row.cols[i].flex || 1) / totalFlex);
        cursor += colW;
        lines.push({ x1: cursor, y1: 0, x2: cursor, y2: H, color: '#44AAFF', label: `col${i+1}|col${i+2}` });
        cursor += COL_GAP * scale;
      }
      break; // 첫 flex row만
    }
  }

  // SVG 오버레이를 스크래치패드 위에 생성
  const overlayId = `grid-overlay-${imgIndex}`;
  const svgLines = lines.map(l =>
    `<line x1="${l.x1.toFixed(1)}" y1="${l.y1.toFixed(1)}" x2="${l.x2.toFixed(1)}" y2="${l.y2.toFixed(1)}" stroke="${l.color}" stroke-width="1.5" stroke-dasharray="6,3"/>`
    + (l.label ? `<text x="${(l.x1 + 3).toFixed(1)}" y="14" font-size="11" fill="${l.color}" font-family="monospace">${l.label}</text>` : '')
  ).join('\n    ');

  await ev(`(function() {
    const old = document.getElementById('${overlayId}');
    if (old) old.remove();

    const items = document.querySelectorAll('.scratch-item');
    const refEl = items[${imgIndex}];
    if (!refEl) return;
    const parent = refEl.parentElement;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = '${overlayId}';
    svg.style.cssText = 'position:absolute; left:${imgInfo.x}px; top:${imgInfo.y}px; width:${imgInfo.w}px; height:${imgInfo.h}px; pointer-events:none; z-index:9999;';
    svg.innerHTML = \`${svgLines}\`;
    parent.appendChild(svg);
  })()`);

  console.log(`✅ 그리드 오버레이 완료 (${lines.length}개 선)`);
  lines.forEach(l => l.label && console.log(`  ${l.color === '#FF4444' ? '🔴' : '🔵'} ${l.label} @ x=${l.x1.toFixed(0)}px`));
  ws.close();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
