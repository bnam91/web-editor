#!/usr/bin/env node
/**
 * figma_node_to_editor.mjs
 *
 * Figma 노드(get_node_info) 구조를 읽어 에디터 API로 구현하는 스크립트.
 *
 * 사용법:
 *   node figma_node_to_editor.mjs --channel <채널ID> --frame <노드ID> --section <섹션ID> [--port 9336]
 *   node figma_node_to_editor.mjs --node-file <path> --section <섹션ID> [--port 9336]
 *
 * 블록 매핑:
 *   RECTANGLE + IMAGE fill  → addAssetBlock
 *   RECTANGLE/FRAME + SOLID → addShapeBlock
 *   ELLIPSE                 → addShapeBlock (ellipse)
 *   TEXT                    → addTextBlock
 *   GROUP/INSTANCE          → 자식 재귀 전개 (flatten)
 *   VECTOR/BOOLEAN_OP 등    → addShapeBlock (solid fill 있을 때) 또는 스킵
 *
 * 원칙:
 *   - Figma 원본 치수 그대로 사용 (스케일 없음)
 *   - joker 블록은 사용하지 않음
 *   - 위치/크기는 dataset에도 저장 (save/load 복원 보장)
 */

import WebSocket from '/Users/a1/web-editor/node_modules/ws/index.js';
import http from 'http';
import fs from 'fs';

// ─── CLI 파싱 ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const CHANNEL    = get('--channel');
const FRAME_ID   = get('--frame');
const SECTION_ID = get('--section');
const NODE_FILE  = get('--node-file');
const PORT       = parseInt(get('--port') || '9336');  // 에디터 기본 포트
const FIGMA_WS   = 'ws://localhost:3055';

if (!SECTION_ID) {
  console.error('Usage: node figma_node_to_editor.mjs --section <sectionId> [--channel <id> --frame <nodeId>] [--node-file <path>] [--port 9336]');
  process.exit(1);
}
if (!NODE_FILE && (!CHANNEL || !FRAME_ID)) {
  console.error('❌ --node-file 또는 (--channel + --frame) 중 하나가 필요합니다.');
  process.exit(1);
}

const delay = ms => new Promise(r => setTimeout(r, ms));

// ─── Figma WebSocket ───────────────────────────────────────────────────────────
function figmaCmd(ws, command, params = {}) {
  return new Promise((resolve, reject) => {
    const cmdId = `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const queue = [];
    const started = Date.now();
    const TIMEOUT = 12000;

    const onMsg = (raw) => {
      try { queue.push(JSON.parse(raw.toString())); } catch {}
    };
    ws.on('message', onMsg);
    ws.send(JSON.stringify({ type: 'message', channel: CHANNEL, message: { id: cmdId, command, params } }));

    const poll = setInterval(() => {
      for (let i = 0; i < queue.length; i++) {
        const msg = queue[i];
        if (msg?.type === 'broadcast' && msg?.message?.result !== undefined) {
          if (!msg.message.id || msg.message.id === cmdId) {
            clearInterval(poll);
            ws.off('message', onMsg);
            resolve(msg.message.result);
            return;
          }
        }
      }
      if (Date.now() - started > TIMEOUT) {
        clearInterval(poll);
        ws.off('message', onMsg);
        reject(new Error(`Figma timeout: ${command}`));
      }
    }, 50);
  });
}

// ─── CDP ───────────────────────────────────────────────────────────────────────
async function getCdpWsUrl() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${PORT}/json`, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        const pages = JSON.parse(data);
        const page = pages.find(p => p.type === 'page' &&
          (p.url.includes('web-editor') || p.url.includes('index.html')));
        if (page) resolve(page.webSocketDebuggerUrl);
        else reject(new Error(`에디터 페이지 없음 (포트 ${PORT})`));
      });
    }).on('error', reject);
  });
}

function cdpEval(ws, expr) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e9);
    const timeout = setTimeout(() => reject(new Error(`CDP timeout: ${expr.slice(0, 60)}`)), 12000);
    const handler = (raw) => {
      const msg = JSON.parse(raw);
      if (msg.id === id) {
        clearTimeout(timeout);
        ws.off('message', handler);
        if (msg.result?.result?.subtype === 'error') {
          reject(new Error(msg.result.result.description));
        } else {
          resolve(msg.result?.result?.value ?? msg.result?.result);
        }
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({
      id,
      method: 'Runtime.evaluate',
      params: { expression: expr, returnByValue: true, awaitPromise: true }
    }));
  });
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────────
function toHex({ r, g, b }) {
  const h = v => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function getTextStyle(fontSize, fontWeight = 400) {
  if (fontSize >= 90) return 'h1';
  if (fontSize >= 60) return 'h2';
  if (fontSize >= 44) return 'h3';
  if (fontSize >= 30) return 'body';
  if (fontWeight >= 600) return 'label';
  return 'caption';
}

function getTextAlign(figmaAlign) {
  return { LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFIED: 'left' }[figmaAlign] || 'center';
}

// ─── GROUP/INSTANCE 재귀 전개 ──────────────────────────────────────────────────
// GROUP, INSTANCE, COMPONENT_SET 등은 자식을 평탄화해서 직접 처리
function flattenChildren(nodes) {
  const result = [];
  for (const node of nodes) {
    const groupTypes = new Set(['GROUP', 'INSTANCE', 'COMPONENT_SET', 'SECTION']);
    if (groupTypes.has(node.type) && node.children?.length) {
      result.push(...flattenChildren(node.children));
    } else {
      result.push(node);
    }
  }
  return result;
}

// ─── 노드 분류 ────────────────────────────────────────────────────────────────
function classifyNode(node) {
  const { type, fills = [] } = node;
  if (type === 'TEXT') return 'text';
  if (type === 'ELLIPSE') return 'shape-ellipse';
  if (type === 'LINE') return 'shape-line';

  // RECTANGLE, FRAME, COMPONENT, VECTOR 등
  const imageFill = fills.find(f => f.type === 'IMAGE');
  if (imageFill) return 'image';

  const solidFill = fills.find(f => f.type === 'SOLID');
  if (solidFill) return 'shape';

  // fill 없는 경우 (투명 컨테이너 등) — 자식이 있으면 flatten 이미 처리됨
  return null; // 스킵
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
(async () => {
  let frame, figmaWs = null;

  if (NODE_FILE) {
    console.log(`\n📂 노드 파일 로드: ${NODE_FILE}`);
    frame = JSON.parse(fs.readFileSync(NODE_FILE, 'utf8'));
    console.log(`✅ "${frame.name}" 로드 완료`);
  } else {
    console.log(`\n📡 Figma 연결 중 (채널: ${CHANNEL})...`);
    figmaWs = new WebSocket(FIGMA_WS);
    await new Promise((resolve, reject) => {
      figmaWs.on('open', resolve);
      figmaWs.on('error', reject);
      setTimeout(() => reject(new Error('Figma WS 연결 timeout')), 5000);
    });
    figmaWs.send(JSON.stringify({ type: 'join', channel: CHANNEL }));
    await delay(500);
    console.log(`✅ Figma 연결`);

    console.log(`\n🔍 노드 조회: ${FRAME_ID}`);
    frame = await figmaCmd(figmaWs, 'get_node_info', { nodeId: FRAME_ID });
  }

  const frameW  = frame.absoluteBoundingBox?.width  || 360;
  const frameH  = frame.absoluteBoundingBox?.height || 508;
  const frameR  = frame.cornerRadius || 0;
  const frameBg = frame.fills?.find(f => f.type === 'SOLID');
  const frameBgColor = frameBg ? toHex(frameBg.color) : '#ffffff';
  const frameX  = frame.absoluteBoundingBox?.x || 0;
  const frameY  = frame.absoluteBoundingBox?.y || 0;

  console.log(`\n📐 "${frame.name}" ${frameW}×${frameH}px  radius:${frameR}  bg:${frameBgColor}`);

  // ─── CDP 연결 ───────────────────────────────────────────────────────────────
  console.log(`\n🔌 에디터 CDP 연결 중 (포트: ${PORT})...`);
  const cdpUrl = await getCdpWsUrl();
  const cdpWs  = new WebSocket(cdpUrl);
  await new Promise(r => cdpWs.on('open', r));
  console.log('✅ CDP 연결');

  const ev = (expr) => cdpEval(cdpWs, expr);

  // ─── 섹션 선택 + 초기화 ───────────────────────────────────────────────────
  const secFound = await ev(`!!document.querySelector('#${SECTION_ID}')`);
  if (!secFound) {
    console.error(`❌ 섹션 "${SECTION_ID}" 찾을 수 없음`);
    process.exit(1);
  }

  await ev(`selectSection(document.querySelector('#${SECTION_ID}'))`);
  await delay(300);
  await ev(`document.querySelector('#${SECTION_ID}').querySelectorAll('.row, .frame-block').forEach(el => el.remove())`);
  await ev(`setSectionBg('#${SECTION_ID}', 'transparent')`);
  await delay(200);
  console.log(`✅ 섹션 초기화`);

  // ─── 자식 노드 → layers 배열 변환 ──────────────────────────────────────────
  const rawChildren = frame.children || [];
  const children    = flattenChildren(rawChildren);
  console.log(`\n📦 레이어 변환 (원본 ${rawChildren.length}개 → 전개 후 ${children.length}개):`);

  const layers = [];
  for (const child of children) {
    const bbox = child.absoluteBoundingBox;
    if (!bbox) { console.log(`  ⚠️ "${child.name}": boundingBox 없음, 스킵`); continue; }

    const x = Math.round(bbox.x - frameX);
    const y = Math.round(bbox.y - frameY);
    const w = Math.round(bbox.width);
    const h = Math.round(bbox.height);

    const kind = classifyNode(child);
    if (!kind) { console.log(`  ⏭️  "${child.name}" (${child.type}) fill 없음, 스킵`); continue; }

    console.log(`  [${kind}] "${child.name}"  x=${x} y=${y} w=${w} h=${h}`);

    if (kind === 'image') {
      const ratio  = h / w;
      const preset = ratio < 0.75 ? 'wide' : ratio < 0.95 ? 'standard' : ratio < 1.1 ? 'square' : 'tall';
      layers.push({ type: 'image', label: child.name, x, y, w, h, preset });

    } else if (kind === 'shape' || kind === 'shape-ellipse' || kind === 'shape-line') {
      const solidFill = child.fills?.find(f => f.type === 'SOLID');
      const color     = solidFill ? toHex(solidFill.color) : '#cccccc';
      const shapeType = kind === 'shape-ellipse' ? 'ellipse' : kind === 'shape-line' ? 'line' : 'rectangle';
      layers.push({ type: 'shape', label: child.name, x, y, w, h, color, shapeType });

    } else if (kind === 'text') {
      const styleObj   = child.style || {};
      const fontSize   = styleObj.fontSize   || 28;
      const fontWeight = styleObj.fontWeight || 400;
      const align      = getTextAlign(styleObj.textAlignHorizontal);
      const content    = child.characters || '';
      const solidFill  = child.fills?.find(f => f.type === 'SOLID');
      const color      = solidFill ? toHex(solidFill.color) : '#000000';
      layers.push({ type: 'text', label: child.name, x, y, w, h, content, color, fontSize, fontWeight, align });
    }
  }

  // ─── addCanvasBlock 호출 ──────────────────────────────────────────────────
  const canvasOpts = JSON.stringify({
    width:     frameW,
    height:    frameH,
    bg:        frameBgColor,
    radius:    frameR,
    layerName: frame.name,
    layers,
  });
  await ev(`window.addCanvasBlock(${canvasOpts})`);
  await delay(300);

  const blockId = await ev(`(function(){
    var secs = document.querySelectorAll('.section-block');
    var sec  = Array.from(secs).find(s => s.id === '${SECTION_ID}');
    if (!sec) return null;
    var cvb = [...sec.querySelectorAll('.canvas-block')].pop();
    return cvb ? cvb.id : null;
  })()`);
  console.log(`\n🃏 Canvas Block: ${blockId} (${frameW}×${frameH}px, ${layers.length} layers)`);

  // ─── 마무리 ───────────────────────────────────────────────────────────────
  await delay(200);
  await delay(300);
  await ev(`(typeof window.triggerAutoSave === 'function' ? window.triggerAutoSave() : (typeof window.scheduleAutoSave === 'function' ? window.scheduleAutoSave() : null))`);
  await delay(600);

  console.log(`\n✅ 완료`);
  console.log(`   섹션  : ${SECTION_ID}`);
  console.log(`   프레임: ${frame.name} (${frameW}×${frameH}px)`);
  console.log(`   레이어: ${layers.length}개`);

  if (figmaWs) figmaWs.close();
  cdpWs.close();
})().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
