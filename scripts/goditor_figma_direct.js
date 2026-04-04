/**
 * goditor_figma_direct.js
 * Figma 프레임 → canvas HTML 직접 변환 → CDP 주입
 * - 프레임 직접 자식 기준으로 행 그루핑
 * - 각 노드의 실제 bbox 너비를 % 로 col width 계산
 * - 복잡한 노드(벡터 포함) → sub-section-block + 절대 좌표 배치
 *
 * 사용법:
 *   node goditor_figma_direct.js --channel <채널ID> --frame <nodeId> --project <proj_xxx> [--port 9337] [--page <pageId>]
 */

const { spawnSync } = require('child_process');
const fs   = require('fs');
const http = require('http');
const WebSocket = require('/Users/a1/web-editor/node_modules/ws');

const FIGMA_CMD    = '/Users/a1/web-editor/figma-renderer/figma_cmd.mjs';
const IMPORTER_CMD = '/Users/a1/web-editor/scripts/goditor_figma_importer.js';

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

function makeGapHtml(height) {
  return `<div class="gap-block" data-type="gap" style="height:${height}px" id="${genId('gb')}" draggable="true"></div>`;
}

function makeTextBlockHtml(text, style, color, fontSize, align) {
  const cls      = styleToClass[style] || 'tb-body';
  const dataType = styleToDataType[style] || 'body';
  const colorStyle  = color && color !== '#111111' ? `color:${color};` : '';
  const fontSzStyle = fontSize ? `font-size:${fontSize}px;` : '';
  const alignStyle  = align && align !== 'left' ? `text-align:${align};` : '';
  const inline = colorStyle + fontSzStyle + alignStyle;
  return `<div class="text-block" data-type="${dataType}" id="${genId('tb')}">` +
    `<div class="${cls}" contenteditable="false" style="font-family:'Pretendard',sans-serif;${inline}">${escapeHtml(text)}</div>` +
    `</div>`;
}

function makeJokerBlockHtml(svgContent, w, h) {
  return `<div class="joker-block" id="${genId('sb')}" ` +
    `style="display:flex;align-items:center;justify-content:center;width:${w}px;height:${h}px;overflow:hidden;">` +
    svgContent +
    `</div>`;
}

function makeRowHtml(layout, cols) {
  const colsHtml = cols.map(c =>
    `<div class="col" data-width="${c.width}">${c.html}</div>`
  ).join('');
  return `<div class="row" id="${genId('row')}" data-layout="${layout}">${colsHtml}</div>`;
}

// ─── 벡터 포함 여부 체크 ─────────────────────────────────────
const JOKER_TYPES = new Set(['VECTOR', 'ELLIPSE', 'STAR', 'POLYGON', 'BOOLEAN_OPERATION', 'LINE']);

function hasVectorDescendants(node) {
  if (JOKER_TYPES.has(node.type)) return true;
  return (node.children || []).some(c => hasVectorDescendants(c));
}

// ─── 노드의 리프(TEXT/VECTOR) 수집 (containerBox 기준 상대좌표) ──
function collectLeavesInContainer(node, containerBox) {
  const results = [];

  function walk(n, depth) {
    const bbox = n.absoluteBoundingBox;
    if (!bbox) return;

    if (n.type === 'TEXT') {
      results.push({
        kind: 'text', node: n,
        relX: bbox.x - containerBox.x,
        relY: bbox.y - containerBox.y,
        w: bbox.width, h: bbox.height,
      });
      return;
    }

    if (JOKER_TYPES.has(n.type)) {
      results.push({
        kind: 'vector', node: n,
        relX: bbox.x - containerBox.x,
        relY: bbox.y - containerBox.y,
        w: bbox.width, h: bbox.height,
      });
      return;
    }

    // 컨테이너 노드: 자식 재귀
    let children = n.children || [];
    if (children.length === 0 && depth < 6) {
      try {
        const detail = figma('get_node_info', { nodeId: n.id });
        children = detail?.children || [];
      } catch (e) {}
    }
    // 자식 없고 접근 불가 → 비주얼 노드이면 vector leaf로 처리
    if (children.length === 0 && ['INSTANCE', 'COMPONENT', 'VECTOR', 'ELLIPSE'].includes(n.type)) {
      results.push({
        kind: 'vector', node: n,
        relX: bbox.x - containerBox.x,
        relY: bbox.y - containerBox.y,
        w: bbox.width, h: bbox.height,
      });
      return;
    }
    children.forEach(c => walk(c, depth + 1));
  }

  let children = node.children || [];
  if (children.length === 0) {
    try {
      const detail = figma('get_node_info', { nodeId: node.id });
      children = detail?.children || [];
    } catch (e) {}
  }
  children.forEach(c => walk(c, 0));
  return results;
}

// ─── TEXT 노드만 재귀 수집 ────────────────────────────────────
function collectTextNodes(node) {
  if (node.type === 'TEXT') return [node];
  return (node.children || []).flatMap(c => collectTextNodes(c));
}

// 현재 처리 중인 프레임명 (spec SVG 캐시 키)
let _currentFrameName = '';

// ─── Spec JSON에서 SVG 캐시 로드 ────────────────────────────
// importer로 spec 생성 후 SVGs를 relX 기준으로 캐싱
let _specSvgCache = null;
function getSpecSvgCache(frameName) {
  if (_specSvgCache !== null) return _specSvgCache;
  _specSvgCache = {};
  // /tmp/goditor_spec_figma_{frameName}.json 파일 탐색
  const safeN = (frameName || '').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const specPath = `/tmp/goditor_spec_figma_${safeN}.json`;
  if (!fs.existsSync(specPath)) return _specSvgCache;
  try {
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    // 모든 joker 블록을 찾아 SVG 수집 (x 좌표 → svg)
    function walkSpec(items) {
      for (const item of items || []) {
        if (item.type === 'joker' && item.svg) {
          const key = Math.round(item.x || 0) + '_' + Math.round(item.width || 0);
          _specSvgCache[key] = item.svg;
        }
        walkSpec(item.blocks || []);
        walkSpec(item.cols || []);
        walkSpec(item.rows || []);
        walkSpec(item.children || []);
        walkSpec(item.sections || []);
      }
    }
    walkSpec(spec.sections);
    console.log(`   📋 spec SVG 캐시: ${Object.keys(_specSvgCache).length}개 로드됨`);
  } catch (e) {}
  return _specSvgCache;
}

// ─── 전체 노드를 SVG joker-block으로 ────────────────────────
function getNodeAsJoker(node, w, h, frameName) {
  let svgContent = '';

  // 1) get_svg 직접 시도
  try {
    const svgResult = figma('get_svg', { nodeId: node.id });
    svgContent = svgResult?.svgString || svgResult?.svg || (typeof svgResult === 'string' ? svgResult : '');
  } catch (e) {}

  // 2) componentId로 시도 (compound ID 대응)
  if (!svgContent && node.componentId) {
    try {
      const svgResult = figma('get_svg', { nodeId: node.componentId });
      svgContent = svgResult?.svgString || svgResult?.svg || (typeof svgResult === 'string' ? svgResult : '');
    } catch (e) {}
  }

  // 3) spec JSON 캐시 fallback (relX + width 기준 매칭)
  if (!svgContent) {
    const cache = getSpecSvgCache(frameName || '');
    const relX = node._relX || 0;
    const key = Math.round(relX) + '_' + Math.round(w);
    if (cache[key]) svgContent = cache[key];
    if (!svgContent) {
      // width만 매칭
      const wKey = Object.keys(cache).find(k => k.endsWith('_' + Math.round(w)));
      if (wKey) svgContent = cache[wKey];
    }
  }

  return makeJokerBlockHtml(svgContent, w, h);
}

// ─── sub-section-block HTML 생성 ────────────────────────────
function buildSubSectionHtml(node) {
  const bbox = node.absoluteBoundingBox || {};
  const w    = Math.round(bbox.width  || 200);
  const h    = Math.round(bbox.height || 200);
  const bg   = getBgColor(node) || 'transparent';

  const leaves = collectLeavesInContainer(node, bbox);

  // leaves 없거나 ALL vector(텍스트 없음) → 전체 노드를 SVG joker로
  if (leaves.length === 0 || leaves.every(l => l.kind === 'vector')) {
    return getNodeAsJoker(node, w, h, _currentFrameName);
  }

  let innerHtml = '';

  for (const leaf of leaves) {
    if (leaf.kind === 'text') {
      const n       = leaf.node;
      const style   = mapStyle(n.style?.fontSize || 36, n.style?.fontWeight || 400);
      const color   = (n.fills || []).find(f => f.type === 'SOLID')
        ? rgba2hex((n.fills || []).find(f => f.type === 'SOLID').color)
        : '#111111';
      const align   = mapAlign(n.style?.textAlignHorizontal);
      const cls     = styleToClass[style] || 'tb-body';
      const dataType = styleToDataType[style] || 'body';
      const fontSize = Math.round(n.style?.fontSize || 36);
      const colorStyle = color !== '#111111' ? `color:${color};` : '';
      const alignStyle = align !== 'left' ? `text-align:${align};` : '';
      innerHtml += `<div class="text-block" data-type="${dataType}" id="${genId('tb')}" ` +
        `style="position:absolute;left:${Math.round(leaf.relX)}px;top:${Math.round(leaf.relY)}px;width:${Math.round(leaf.w)}px;">` +
        `<div class="${cls}" contenteditable="false" ` +
        `style="font-family:'Pretendard',sans-serif;font-size:${fontSize}px;${colorStyle}${alignStyle}">${escapeHtml(n.characters || '')}</div>` +
        `</div>`;
    } else if (leaf.kind === 'vector') {
      // SVG 추출: 직접 → componentId → spec 캐시 순서
      let svgContent = '';
      try {
        const svgResult = figma('get_svg', { nodeId: leaf.node.id });
        svgContent = svgResult?.svgString || svgResult?.svg || (typeof svgResult === 'string' ? svgResult : '');
      } catch (e) {}
      if (!svgContent && leaf.node.componentId) {
        try {
          const svgResult = figma('get_svg', { nodeId: leaf.node.componentId });
          svgContent = svgResult?.svgString || svgResult?.svg || (typeof svgResult === 'string' ? svgResult : '');
        } catch (e) {}
      }
      if (!svgContent) {
        // spec 캐시: width로 매칭 (아이콘 크기 기준)
        const cache = getSpecSvgCache(_currentFrameName);
        const lw = Math.round(leaf.w);
        const match = Object.entries(cache).find(([k]) => k.endsWith('_' + lw));
        if (match) svgContent = match[1];
      }
      const lw = Math.round(leaf.w);
      const lh = Math.round(leaf.h);
      innerHtml += `<div class="joker-block" id="${genId('sb')}" ` +
        `style="position:absolute;left:${Math.round(leaf.relX)}px;top:${Math.round(leaf.relY)}px;` +
        `width:${lw}px;height:${lh}px;display:flex;align-items:center;justify-content:center;overflow:hidden;">` +
        svgContent +
        `</div>`;
    }
  }

  return `<div class="sub-section-block" id="${genId('ss')}" ` +
    `style="display:block;width:${w}px;height:${h}px;background:${bg};overflow:visible;position:relative;">` +
    `<div class="sub-section-inner" style="position:relative;width:100%;height:${h}px;">` +
    innerHtml +
    `</div>` +
    `</div>`;
}

// ─── 노드 → col 내부 HTML ────────────────────────────────────
function nodeToColHtml(node) {
  // TEXT 노드
  if (node.type === 'TEXT') {
    const style   = mapStyle(node.style?.fontSize || 36, node.style?.fontWeight || 400);
    const color   = (node.fills || []).find(f => f.type === 'SOLID')
      ? rgba2hex((node.fills || []).find(f => f.type === 'SOLID').color)
      : '#111111';
    const align   = mapAlign(node.style?.textAlignHorizontal);
    return makeTextBlockHtml(node.characters || '', style, color, Math.round(node.style?.fontSize || 36), align);
  }

  // 벡터 포함 → sub-section-block (leaves 없으면 내부에서 joker fallback)
  if (hasVectorDescendants(node)) {
    return buildSubSectionHtml(node);
  }

  // 배경 있는 컨테이너 → sub-section으로 (bg 포함 텍스트 카드 등)
  if (getBgColor(node)) {
    return buildSubSectionHtml(node);
  }

  // 텍스트만 포함한 투명 컨테이너 → 텍스트 추출해 세로 나열
  const texts = collectTextNodes(node);
  if (texts.length > 0) {
    return texts.map(t => {
      const style  = mapStyle(t.style?.fontSize || 36, t.style?.fontWeight || 400);
      const color  = (t.fills || []).find(f => f.type === 'SOLID')
        ? rgba2hex((t.fills || []).find(f => f.type === 'SOLID').color)
        : '#111111';
      const align  = mapAlign(t.style?.textAlignHorizontal);
      return makeTextBlockHtml(t.characters || '', style, color, Math.round(t.style?.fontSize || 36), align);
    }).join('');
  }

  // Fallback: joker (SVG 추출 시도)
  return getNodeAsJoker(node, Math.round(node._w || 200), Math.round(node._h || 200), _currentFrameName);
}

// ─── 레이아웃 래퍼 여부 ──────────────────────────────────────
// INSTANCE/COMPONENT는 절대 전개하지 않음 → 카드 등 컴포넌트는 sub-section으로
// SLOT/FRAME/GROUP 중 배경 없는 것만 전개
function isLayoutWrapper(node) {
  if (node.type === 'INSTANCE' || node.type === 'COMPONENT') return false;
  if (!['FRAME', 'GROUP', 'COMPONENT_SET', 'SLOT'].includes(node.type)) return false;
  if (getBgColor(node)) return false;  // 배경 있으면 콘텐츠 블록
  return true;
}

// 투명 래퍼 컨테이너를 재귀적으로 전개 (depth 제한)
// children이 없으면 get_node_info로 시도
function flattenLayoutWrappers(nodes, frameW, depth = 0) {
  if (depth > 6) return nodes;
  const result = [];
  for (const node of nodes) {
    if (!node.absoluteBoundingBox) continue;
    if (isLayoutWrapper(node)) {
      // 이미 children이 있으면 바로 사용, 없으면 fetch 시도
      let children = node.children || [];
      if (children.length === 0) {
        try {
          const detail = figma('get_node_info', { nodeId: node.id });
          children = detail?.children || [];
        } catch (e) {}
      }
      if (children.length > 0) {
        // 자식 중 absoluteBoundingBox 없는 게 있으면 fetch 결과 사용
        const childrenWithBbox = children.filter(c => c.absoluteBoundingBox);
        if (childrenWithBbox.length > 0) {
          result.push(...flattenLayoutWrappers(childrenWithBbox, frameW, depth + 1));
          continue;
        }
      }
    }
    result.push(node);
  }
  return result;
}

// ─── 프레임 → section HTML ───────────────────────────────────
function buildSectionHtml(frameNode) {
  const frameBox = frameNode.absoluteBoundingBox || {};
  const frameW   = frameBox.width  || 860;
  const frameH   = frameBox.height || 1000;
  const bg       = getBgColor(frameNode) || '#ffffff';
  const TOLERANCE = frameH * 0.04;

  // 프레임 직접 자식 → 레이아웃 래퍼 전개 후 상대좌표 계산
  const rawChildren = flattenLayoutWrappers(frameNode.children || [], frameW);
  const directChildren = rawChildren
    .filter(c => c.absoluteBoundingBox)
    .map(c => ({
      ...c,
      _relX: c.absoluteBoundingBox.x - frameBox.x,
      _relY: c.absoluteBoundingBox.y - frameBox.y,
      _w:    c.absoluteBoundingBox.width,
      _h:    c.absoluteBoundingBox.height,
    }))
    .sort((a, b) => a._relY - b._relY);

  console.log(`   처리 노드 수: ${directChildren.length} (원본 직접 자식: ${(frameNode.children||[]).length})`);
  if (directChildren.length === 0) {
    console.log('  ⚠️  처리할 노드 없음');
  }

  // Y 기준 행 그루핑
  const rowGroups = [];
  let cur = [];
  let prevY = null;
  for (const n of directChildren) {
    if (prevY === null || Math.abs(n._relY - prevY) <= TOLERANCE) {
      cur.push(n);
    } else {
      if (cur.length) rowGroups.push(cur);
      cur = [n];
    }
    prevY = n._relY;
  }
  if (cur.length) rowGroups.push(cur);

  let innerHtml   = '';
  let lastBottomY = 0;

  for (const group of rowGroups) {
    const groupTopY = Math.min(...group.map(n => n._relY));
    const sorted    = [...group].sort((a, b) => a._relX - b._relX);

    // 앞 gap
    const gapH = Math.round(groupTopY - lastBottomY);
    if (gapH > 8) innerHtml += makeGapHtml(gapH);

    if (sorted.length === 1) {
      const n      = sorted[0];
      const colHtml = nodeToColHtml(n);
      innerHtml += makeRowHtml('stack', [{ width: 100, html: colHtml }]);
    } else {
      // 행 내 노드 너비 합 대비 % 로 계산 (합계 ~100%)
      const totalRowW = sorted.reduce((s, n) => s + n._w, 0);
      const cols = sorted.map(n => {
        const pct     = Math.max(1, Math.round((n._w / totalRowW) * 100));
        const colHtml = nodeToColHtml(n);
        return { width: pct, html: colHtml };
      });
      innerHtml += makeRowHtml('flex', cols);
    }

    lastBottomY = Math.max(...group.map(n => n._relY + n._h));
  }

  // 하단 gap
  const bottomGap = Math.round(frameH - lastBottomY);
  if (bottomGap > 8) innerHtml += makeGapHtml(bottomGap);

  const secId = genId('sec');
  return {
    secId,
    bg,
    html: `<div class="section-block" data-section="__NUM__" id="${secId}" data-name="__NAME__" style="background:${bg}">
  <div class="section-hitzone"><span class="section-label" draggable="true">__NAME__</span></div>
  <div class="section-toolbar">
    <button class="st-btn st-ab-btn" title="A/B 베리에이션 생성">A/B</button>
    <button class="st-btn st-branch-btn" onclick="openSectionBranchMenu(this)" title="feature 브랜치로 실험">⎇</button>
  </div>
  <div class="section-inner">${innerHtml}</div>
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
  console.log(`   직접 자식 수: ${(frameNode.children || []).length}`);

  // spec JSON이 있으면 SVG 캐시 미리 로드
  getSpecSvgCache(frameName);

  console.log('🏗️  HTML 변환 중...');
  const { secId, html } = buildSectionHtml(frameNode);

  // 섹션 번호는 간단히 1로 고정 (에디터에 주입 후 자동 번호 부여)
  const sectionNum  = 1;
  const sectionName = frameName;
  const finalHtml   = html
    .replace(/__NUM__/g, String(sectionNum))
    .replace(/__NAME__/g, sectionName);

  console.log('🔄 에디터에 섹션 직접 주입 중... (CDP port:', PORT, ')');
  const result = await cdpInjectSection(PORT, finalHtml);
  console.log(`✅ 주입 완료 (총 섹션 수: ${result})`);
  console.log(`   섹션 ID: ${secId}, 이름: ${sectionName}`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
