/**
 * goditor_figma_direct.js
 * Figma 프레임 → canvas HTML 직접 변환 → CDP 주입
 *
 * 접근 방식:
 *   Figma는 col/row 개념 없음 → 프레임 전체를 단일 sub-section (position:relative)으로
 *   모든 leaf (TEXT, VECTOR, 배경 RECT)를 프레임 기준 절대 x,y 좌표로 배치
 *   section-inner padding = 0 (Figma 좌표 그대로)
 *
 * 사용법:
 *   node goditor_figma_direct.js --channel <채널ID> --frame <nodeId> --project <proj_xxx> [--port 9337]
 */

const { spawnSync } = require('child_process');
const fs   = require('fs');
const http = require('http');
const WebSocket = require('/Users/a1/web-editor/node_modules/ws');

const FIGMA_CMD = '/Users/a1/web-editor/figma-renderer/figma_cmd.mjs';

// ─── 인수 파싱 ────────────────────────────────────────────────
const args = (() => {
  const a = process.argv.slice(2);
  const r = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) r[a[i].slice(2)] = a[i + 1] ?? true;
  }
  return r;
})();

const CHANNEL = args.channel;
const FRAME   = args.frame;
const PROJECT = args.project;
const PORT    = parseInt(args.port || '9337');

if (!CHANNEL || !FRAME) {
  console.error('Usage: node goditor_figma_direct.js --channel <id> --frame <nodeId> --project <proj_xxx> [--port 9337]');
  process.exit(1);
}

// ─── Figma 커맨드 실행 ────────────────────────────────────────
function figma(command, params) {
  const r = spawnSync('node', [FIGMA_CMD,
    '--command', command,
    '--params', JSON.stringify(params),
    '--channel', CHANNEL
  ], { encoding: 'utf-8', timeout: 20000, maxBuffer: 50 * 1024 * 1024 });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  try {
    const parsed = JSON.parse(r.stdout);
    if (parsed.result?.content) return JSON.parse(parsed.result.content)[0];
    return parsed.result ?? parsed;
  } catch { return r.stdout; }
}

// ─── ID 생성 ─────────────────────────────────────────────────
function genId(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 9);
}

// ─── 색상 변환 ───────────────────────────────────────────────
function rgba2hex({ r, g, b }) {
  const h = v => Math.round(v * 255).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}

function getBgColor(node) {
  const fills = node.background || node.fills || [];
  const solid = fills.find(f => f.type === 'SOLID' && f.visible !== false);
  return solid ? rgba2hex(solid.color) : null;
}

// ─── 텍스트 스타일 매핑 ──────────────────────────────────────
function mapStyle(fontSize, fontWeight) {
  if (fontSize >= 90) return 'h1';
  if (fontSize >= 60) return 'h2';
  if (fontSize >= 44) return 'h3';
  if (fontSize >= 30) return 'body';
  if (fontWeight >= 600) return 'label';
  return 'caption';
}

function mapAlign(figmaAlign) {
  if (figmaAlign === 'CENTER') return 'center';
  if (figmaAlign === 'RIGHT') return 'right';
  return 'left';
}

const styleToClass    = { h1: 'tb-h1', h2: 'tb-h2', h3: 'tb-h3', body: 'tb-body', caption: 'tb-caption', label: 'tb-label' };
const styleToDataType = { h1: 'heading', h2: 'heading', h3: 'heading', body: 'body', caption: 'caption', label: 'label' };

// ─── HTML 헬퍼 ───────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function makeRowHtml(layout, cols) {
  const colsHtml = cols.map(c =>
    `<div class="col" data-width="${c.width}">${c.html}</div>`
  ).join('');
  return `<div class="row" id="${genId('row')}" data-layout="${layout}">${colsHtml}</div>`;
}

// ─── 벡터 타입 셋 ─────────────────────────────────────────────
const JOKER_TYPES = new Set(['VECTOR', 'ELLIPSE', 'STAR', 'POLYGON', 'BOOLEAN_OPERATION', 'LINE']);

// ─── Spec JSON SVG 캐시 ───────────────────────────────────────
let _specSvgCache = null;
let _currentFrameName = '';

function getSpecSvgCache(frameName) {
  if (_specSvgCache !== null) return _specSvgCache;
  _specSvgCache = {};
  const safeN = (frameName || '').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const specPath = `/tmp/goditor_spec_figma_${safeN}.json`;
  if (!fs.existsSync(specPath)) return _specSvgCache;
  try {
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    function walkSpec(items) {
      for (const item of (items || [])) {
        if (item.type === 'joker' && item.svg) {
          const key = Math.round(item.x || 0) + '_' + Math.round(item.width || 0);
          _specSvgCache[key] = item.svg;
        }
        walkSpec(item.blocks);
        walkSpec(item.cols);
        walkSpec(item.rows);
        walkSpec(item.children);
        walkSpec(item.sections);
      }
    }
    walkSpec(spec.sections);
    console.log(`   📋 spec SVG 캐시: ${Object.keys(_specSvgCache).length}개 로드됨`);
  } catch (e) {}
  return _specSvgCache;
}

// ─── SVG 추출 (직접 → componentId → spec 캐시) ───────────────
function getSvgForNode(node, w) {
  let svg = '';

  try {
    const r = figma('get_svg', { nodeId: node.id });
    svg = r?.svgString || r?.svg || (typeof r === 'string' ? r : '');
  } catch (e) {}

  if (!svg && node.componentId) {
    try {
      const r = figma('get_svg', { nodeId: node.componentId });
      svg = r?.svgString || r?.svg || (typeof r === 'string' ? r : '');
    } catch (e) {}
  }

  if (!svg) {
    const cache = getSpecSvgCache(_currentFrameName);
    const wRound = Math.round(w);
    const match = Object.entries(cache).find(([k]) => k.endsWith('_' + wRound));
    if (match) svg = match[1];
  }

  return svg;
}

// ─── 전체 프레임에서 모든 leaf 수집 ──────────────────────────
// leaf 종류:
//   { kind:'rect',   x,y,w,h, bg }          — fill 있는 컨테이너 배경
//   { kind:'text',   x,y,w,h, node }         — TEXT 노드
//   { kind:'vector', x,y,w,h, node }         — VECTOR/ELLIPSE 등

function collectAllLeaves(frameNode) {
  const frameBox = frameNode.absoluteBoundingBox || {};
  const frameW   = frameBox.width  || 860;
  const frameH   = frameBox.height || 1000;
  const results  = [];
  // (kind,x,y,w) 키로 동일 위치 요소 중복 방지 (버튼 variant 스택 등)
  // seenIds는 사용 안 함 — Figma 로컬 컴포넌트 ID가 여러 인스턴스에서 공유될 수 있기 때문
  const seenPos  = new Set();

  function walk(n, depth) {

    const bbox = n.absoluteBoundingBox;
    if (!bbox) return;

    const x = Math.round(bbox.x - frameBox.x);
    const y = Math.round(bbox.y - frameBox.y);
    const w = Math.round(bbox.width);
    const h = Math.round(bbox.height);

    // 프레임 범위 완전 밖이면 스킵 (overflow 요소)
    if (x + w <= 0 || x >= frameW * 1.5 || y + h <= 0 || y >= frameH * 1.5) return;

    if (n.type === 'TEXT') {
      // 동일 위치 텍스트 중복 방지 (버튼 variant 스택)
      const posKey = `text_${x}_${y}_${w}`;
      if (seenPos.has(posKey)) return;
      seenPos.add(posKey);
      results.push({ kind: 'text', node: n, x, y, w, h });
      return;
    }

    if (JOKER_TYPES.has(n.type)) {
      const posKey = `vec_${x}_${y}_${w}_${h}`;
      if (seenPos.has(posKey)) return;
      seenPos.add(posKey);
      results.push({ kind: 'vector', node: n, x, y, w, h });
      return;
    }

    // 배경이 있는 컨테이너 → rect leaf 먼저 추가
    const bg = getBgColor(n);
    if (bg) {
      results.push({ kind: 'rect', x, y, w, h, bg });
    }

    // 자식 재귀
    let children = n.children || [];
    if (children.length === 0 && depth < 8) {
      try {
        const detail = figma('get_node_info', { nodeId: n.id });
        children = detail?.children || [];
      } catch (e) {}
    }

    // 자식 없는 INSTANCE/COMPONENT → 아이콘 등 → vector leaf
    if (children.length === 0 && ['INSTANCE', 'COMPONENT'].includes(n.type)) {
      const posKey = `vec_${x}_${y}_${w}_${h}`;
      if (!seenPos.has(posKey)) {
        seenPos.add(posKey);
        results.push({ kind: 'vector', node: n, x, y, w, h });
      }
      return;
    }

    children.forEach(c => walk(c, depth + 1));
  }

  // 프레임 자식부터 시작
  let children = frameNode.children || [];
  if (children.length === 0) {
    try {
      const detail = figma('get_node_info', { nodeId: frameNode.id });
      children = detail?.children || [];
    } catch (e) {}
  }
  children.forEach(c => walk(c, 0));

  console.log(`   leaf 수: ${results.length} (rect:${results.filter(l=>l.kind==='rect').length} text:${results.filter(l=>l.kind==='text').length} vector:${results.filter(l=>l.kind==='vector').length})`);
  return results;
}

// ─── section HTML 빌드 ────────────────────────────────────────
function buildSectionHtml(frameNode) {
  const frameBox = frameNode.absoluteBoundingBox || {};
  const frameW   = Math.round(frameBox.width  || 860);
  const frameH   = Math.round(frameBox.height || 1000);
  const bg       = getBgColor(frameNode) || '#ffffff';

  const leaves = collectAllLeaves(frameNode);

  let innerHtml = '';

  for (const leaf of leaves) {
    const { x, y, w, h } = leaf;
    const posStyle = `position:absolute;left:${x}px;top:${y}px;width:${w}px;`;

    if (leaf.kind === 'rect') {
      // 배경 사각형
      innerHtml += `<div id="${genId('rct')}" style="${posStyle}height:${h}px;background:${leaf.bg};"></div>\n`;

    } else if (leaf.kind === 'text') {
      const n        = leaf.node;
      const style    = mapStyle(n.style?.fontSize || 36, n.style?.fontWeight || 400);
      const color    = (n.fills || []).find(f => f.type === 'SOLID')
        ? rgba2hex((n.fills || []).find(f => f.type === 'SOLID').color)
        : '#111111';
      const align    = mapAlign(n.style?.textAlignHorizontal);
      const cls      = styleToClass[style] || 'tb-body';
      const dataType = styleToDataType[style] || 'body';
      const fontSize = Math.round(n.style?.fontSize || 36);
      const colorStyle = color !== '#111111' ? `color:${color};` : '';
      const alignStyle = align !== 'left' ? `text-align:${align};` : '';

      innerHtml += `<div class="text-block" data-type="${dataType}" id="${genId('tb')}" style="${posStyle}">` +
        `<div class="${cls}" contenteditable="false" ` +
        `style="font-family:'Pretendard',sans-serif;font-size:${fontSize}px;${colorStyle}${alignStyle}">${escapeHtml(n.characters || '')}</div>` +
        `</div>\n`;

    } else if (leaf.kind === 'vector') {
      const svg = getSvgForNode(leaf.node, w);
      innerHtml += `<div class="joker-block" id="${genId('sb')}" ` +
        `style="${posStyle}height:${h}px;display:flex;align-items:center;justify-content:center;overflow:hidden;">` +
        svg +
        `</div>\n`;
    }
  }

  // 단일 sub-section이 프레임 전체를 커버
  const subSection =
    `<div class="sub-section-block" id="${genId('ss')}" ` +
    `style="display:block;width:${frameW}px;height:${frameH}px;background:transparent;overflow:visible;position:relative;">` +
    `<div class="sub-section-inner" style="position:relative;width:100%;height:${frameH}px;">` +
    innerHtml +
    `</div></div>`;

  const rowHtml = makeRowHtml('stack', [{ width: 100, html: subSection }]);

  const secId = genId('sec');
  // section-inner padding:0 → Figma 절대좌표 그대로 반영
  return {
    secId,
    bg,
    html: `<div class="section-block" data-section="__NUM__" id="${secId}" data-name="__NAME__" style="background:${bg}">
  <div class="section-hitzone"><span class="section-label" draggable="true">__NAME__</span></div>
  <div class="section-toolbar">
    <button class="st-btn st-ab-btn" title="A/B 베리에이션 생성">A/B</button>
    <button class="st-btn st-branch-btn" onclick="openSectionBranchMenu(this)" title="feature 브랜치로 실험">⎇</button>
  </div>
  <div class="section-inner" style="padding:0;">${rowHtml}</div>
</div>`,
  };
}

// ─── CDP 헬퍼 ────────────────────────────────────────────────
function getEditorWsUrl(port) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json`, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const pages = JSON.parse(data);
          const page  = pages.find(p => p.type === 'page');
          if (!page) return reject(new Error('에디터 페이지 없음'));
          resolve(page.webSocketDebuggerUrl);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function cdpInjectSection(port, sectionHtml) {
  const wsUrl = await getEditorWsUrl(port);
  return new Promise((resolve, reject) => {
    const ws      = new WebSocket(wsUrl);
    const escaped = JSON.stringify(sectionHtml);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1, method: 'Runtime.evaluate',
        params: {
          expression: `(function() {
            const html = ${escaped};
            const canvas = document.querySelector('#canvas');
            if (!canvas) return 'ERROR: canvas not found';
            if (window.flushCurrentPage) window.flushCurrentPage();
            canvas.insertAdjacentHTML('beforeend', html);
            if (window.rebindAll) window.rebindAll();
            if (window.buildLayerPanel) window.buildLayerPanel();
            if (window.triggerAutoSave) window.triggerAutoSave();
            return 'OK:' + document.querySelectorAll('.section-block').length;
          })()`,
          returnByValue: true,
        },
      }));
    });
    ws.on('message', d => {
      const msg = JSON.parse(d);
      if (msg.id === 1) {
        const val = msg.result?.result?.value;
        if (String(val).startsWith('ERROR')) reject(new Error(val));
        else resolve(val);
        ws.close();
      }
    });
    ws.on('error', reject);
    setTimeout(() => reject(new Error('CDP inject timeout')), 15000);
  });
}

// ─── 메인 ─────────────────────────────────────────────────────
(async () => {
  console.log(`🔍 프레임 읽는 중: ${FRAME}`);
  const frameNode = figma('get_node_info', { nodeId: FRAME });
  const frameName = frameNode.name || FRAME;
  _currentFrameName = frameName;
  console.log(`   프레임명: "${frameName}"`);

  // spec JSON SVG 캐시 미리 로드
  getSpecSvgCache(frameName);

  console.log('🏗️  HTML 변환 중...');
  const { secId, html } = buildSectionHtml(frameNode);

  const finalHtml = html
    .replace(/__NUM__/g, '1')
    .replace(/__NAME__/g, frameName);

  console.log('🔄 에디터에 섹션 직접 주입 중... (CDP port:', PORT, ')');
  const result = await cdpInjectSection(PORT, finalHtml);
  console.log(`✅ 주입 완료 (총 섹션 수: ${result})`);
  console.log(`   섹션 ID: ${secId}, 이름: ${frameName}`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
