/**
 * goditor_figma_importer.js
 * Figma WebSocket (Talk to Figma) → Goditor Spec v2 JSON 변환 + 빌드
 *
 * 사용법:
 *   node goditor_figma_importer.js --channel 33bugs6o [--frame 100:15] [--build] [--port 9337]
 *
 * --channel : Talk to Figma 채널 ID
 * --frame   : 특정 프레임 ID (생략 시 현재 페이지의 모든 프레임 목록 출력)
 * --build   : Spec 생성 후 goditor_runner.js로 자동 빌드
 * --port    : CDP 포트 (기본값: 9336)
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FIGMA_CMD = path.join(__dirname, '../figma-renderer/figma_cmd.mjs');
const RUNNER    = path.join(__dirname, 'goditor_runner.js');

// ─── 인수 파싱 ────────────────────────────────────────────────────
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) {
    const key = process.argv[i].slice(2);
    const next = process.argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
}

const CHANNEL = args.channel;
const BUILD   = args.build === true || args.build === 'true';
const PORT    = args.port ? parseInt(args.port) : 9336;

if (!CHANNEL) {
  console.error('Usage: node goditor_figma_importer.js --channel <id> [--frame <nodeId>] [--build]');
  process.exit(1);
}

// ─── Figma 커맨드 실행 ───────────────────────────────────────────
function figma(command, params) {
  const r = spawnSync('node', [FIGMA_CMD,
    '--command', command,
    '--params', JSON.stringify(params),
    '--channel', CHANNEL
  ], { encoding: 'utf-8', timeout: 15000, maxBuffer: 50 * 1024 * 1024 });

  if (r.error) throw r.error;
  if (!r.stdout?.trim()) return null;
  try { return JSON.parse(r.stdout); } catch { return null; }
}

// ─── 색상 변환 (0-1 rgba → hex) ─────────────────────────────────
function rgba2hex({ r, g, b }) {
  const h = v => Math.round(v * 255).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}

// ─── SVG 자연 크기 추출 ──────────────────────────────────────────
function getSvgNaturalSize(svgStr) {
  if (!svgStr) return null;
  const wm = svgStr.match(/\bwidth="([\d.]+)"/);
  const hm = svgStr.match(/\bheight="([\d.]+)"/);
  if (wm && hm) {
    const w = parseFloat(wm[1]);
    const h = parseFloat(hm[1]);
    if (w > 0 && h > 0) return { w, h };
  }
  return null;
}

// ─── SVG 인라인 추출 헬퍼 (get_svg → export_node_as_image 폴백) ──
// 1차: get_svg, 2차: export_node_as_image(format:SVG) base64 디코드
const __svgCache = new Map();
function exportSvgInline(nodeId) {
  if (!nodeId) return '';
  if (__svgCache.has(nodeId)) return __svgCache.get(nodeId);

  let svg = '';
  // 1차: get_svg
  try {
    const r = figma('get_svg', { nodeId });
    svg = r?.svgString || r?.svg || (typeof r === 'string' ? r : '');
  } catch (e) {
    svg = '';
  }

  // 2차 폴백: export_node_as_image (format SVG)
  if (!svg || (typeof svg === 'string' && !svg.includes('<svg'))) {
    try {
      const exp = figma('export_node_as_image', { nodeId, format: 'SVG', scale: 1 });
      if (exp?.imageData) {
        const decoded = Buffer.from(exp.imageData, 'base64').toString('utf-8');
        if (decoded && decoded.includes('<svg')) {
          svg = decoded;
          console.log(`   [svg-fallback] export OK: ${nodeId} (len=${decoded.length})`);
        }
      }
    } catch (e) {
      // 무시 — 최종 빈 문자열 반환
    }
  }

  if (!svg) {
    console.warn(`   [svg-empty] ${nodeId} — get_svg & export 모두 실패`);
    svg = '';
  }
  __svgCache.set(nodeId, svg);
  return svg;
}

// ─── PNG 래스터 폴백 (SVG export 실패 노드용) ──────────────────────
// Figma가 렌더한 그대로(fill/stroke/effect 포함) PNG로 받아 data URL 반환 → 이미지 블록
const __pngCache = new Map();
function exportPngInline(nodeId, scale = 2) {
  if (!nodeId) return '';
  if (__pngCache.has(nodeId)) return __pngCache.get(nodeId);
  let url = '';
  try {
    const exp = figma('export_node_as_image', { nodeId, format: 'PNG', scale });
    if (exp?.imageData) {
      // degenerate(1×1 등) PNG 거부 — 투명/비가시(opacity 0) 노드는 Figma가 1×1로 export함
      const buf = Buffer.from(exp.imageData, 'base64');
      let ok = true;
      if (buf.length >= 24 && buf.toString('latin1', 1, 4) === 'PNG') {
        const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
        if (w <= 2 || h <= 2) ok = false;
      }
      if (ok) url = `data:${exp.mimeType || 'image/png'};base64,${exp.imageData}`;
    }
  } catch (e) { url = ''; }
  if (url) console.log(`   [png-fallback] ${nodeId} (len=${url.length})`);
  else console.log(`   [skip-empty] ${nodeId} — SVG·PNG 모두 빈 콘텐츠(투명/비가시)`);
  __pngCache.set(nodeId, url);
  return url;
}

// ─── rotation 추출 (Figma rad → CSS deg, 부호 반전) ──────────────
function getRotationDeg(node) {
  // 1순위: 명시적 rotation 필드 (라디안)
  if (typeof node?.rotation === 'number' && Math.abs(node.rotation) > 1e-6) {
    return Math.round((-node.rotation * 180 / Math.PI) * 100) / 100;
  }
  // 2순위: relativeTransform 2x3 행렬에서 atan2 추출
  const rt = node?.relativeTransform;
  if (Array.isArray(rt) && rt.length >= 2 && Array.isArray(rt[0]) && Array.isArray(rt[1])) {
    const a = rt[0][0];
    const b = rt[1][0];
    const rad = Math.atan2(b, a);
    if (Math.abs(rad) > 1e-6) {
      // relativeTransform은 CSS와 동일한 시계방향 회전(양수) — 부호 그대로
      return Math.round((rad * 180 / Math.PI) * 100) / 100;
    }
  }
  return 0;
}

// ─── 노드 배경색 추출 ────────────────────────────────────────────
function getBgColor(node) {
  const fill = node.background?.[0] || node.fills?.[0];
  if (fill?.type === 'SOLID') return rgba2hex(fill.color);
  return null;
}

// ─── fontSize → text style ──────────────────────────────────────
function mapStyle(fontSize, fontWeight) {
  if (fontSize >= 90) return 'h1';
  if (fontSize >= 60) return 'h2';
  if (fontSize >= 44) return 'h3';
  if (fontSize >= 30) return 'body';
  if (fontWeight >= 600) return 'label';
  return 'caption';
}

// ─── align 변환 ──────────────────────────────────────────────────
function mapAlign(figmaAlign) {
  if (figmaAlign === 'CENTER') return 'center';
  if (figmaAlign === 'RIGHT')  return 'right';
  return 'left';
}

// ─── 자식 노드 → 블록 ────────────────────────────────────────────
// containerW: 에디터에서 실제 렌더링 될 컨테이너 폭(px). 기본값 860(메인 캔버스)
function nodeToBlock(node, frameBox, containerW = 860) {
  // 투명/비가시 노드 스킵 (opacity 0 등) — export 낭비·빈 블록 방지 (export 결과로도 2차 판정)
  if (node.opacity === 0 || node.visible === false) return null;
  if (node.type === 'TEXT') {
    const style   = node.style || {};
    const fills   = node.fills || [];
    const color   = fills[0]?.type === 'SOLID' ? rgba2hex(fills[0].color) : '#111111';
    const fontSize = style.fontSize || 36;
    const fontWeight = style.fontWeight || 400;
    const constraints = node.constraints || {};
    // textAlignHorizontal이 LEFT여도 constraint가 CENTER면 시각적으로 가운데 배치
    const align = constraints.horizontal === 'CENTER' && style.textAlignHorizontal !== 'RIGHT'
      ? 'center'
      : mapAlign(style.textAlignHorizontal);
    const rot = getRotationDeg(node);
    return {
      type: 'text',
      style: mapStyle(fontSize, fontWeight),
      content: node.characters || '',
      color,
      fontSize: Math.round(fontSize),
      align,
      ...(rot ? { rotation: rot } : {}),
    };
  }

  // ELLIPSE / VECTOR / STAR / POLYGON / LINE / BOOLEAN_OPERATION → joker 블록 (SVG 추출)
  const jokerTypes = ['ELLIPSE', 'VECTOR', 'STAR', 'POLYGON', 'BOOLEAN_OPERATION', 'LINE'];
  if (jokerTypes.includes(node.type)) {
    const bbox = node.absoluteBoundingBox || {};
    const svgContent = exportSvgInline(node.id);
    const scale = containerW / (frameBox?.width || containerW);
    const bboxW = bbox.width || 200;
    const bboxH = bbox.height || 200;
    // SVG 실패 → PNG 래스터 폴백 → 이미지 블록. PNG도 빈(1×1)이면 노드 스킵
    if (!(typeof svgContent === 'string' && svgContent.includes('<svg'))) {
      const png = exportPngInline(node.id, 2);
      if (png) {
        const rotJ = getRotationDeg(node);
        return {
          type: 'image', label: node.name || node.type,
          preset: bboxH / bboxW > 1.1 ? 'tall' : bboxH / bboxW < 0.75 ? 'wide' : 'standard',
          src: png, width: Math.round(bboxW * scale), height: Math.round(bboxH * scale),
          x: Math.round((bbox.x - (frameBox?.x || 0)) * scale),
          ...(rotJ ? { rotation: rotJ } : {}),
        };
      }
      return null; // SVG·PNG 모두 빈 콘텐츠 → 투명/비가시 노드 스킵
    }
    // SVG 자연 크기가 bbox보다 훨씬 작으면 (bbox가 hit area 포함 등) SVG 크기 우선
    const svgDims = getSvgNaturalSize(typeof svgContent === 'string' ? svgContent : '');
    const useW = (svgDims && bboxH / svgDims.h > 3) ? svgDims.w : bboxW;
    const useH = (svgDims && bboxH / svgDims.h > 3) ? svgDims.h : bboxH;
    const scaledW = Math.round(useW * scale);
    const scaledH = Math.round(useH * scale);
    const relX = Math.round((bbox.x - (frameBox?.x || 0)) * scale);
    const rot = getRotationDeg(node);
    return {
      type: 'joker',
      label: node.name || node.type,
      svg: typeof svgContent === 'string' ? svgContent : JSON.stringify(svgContent),
      width: scaledW,
      height: scaledH,
      x: relX,
      ...(rot ? { rotation: rot } : {}),
    };
  }

  // FRAME → 서브섹션 (재귀로 자식 탐색)
  if (node.type === 'FRAME') {
    const bbox = node.absoluteBoundingBox || {};
    const detail = figma('get_node_info', { nodeId: node.id });
    const childNodes = detail?.children || [];

    // 빈 frame 또는 gap_* 이름의 빈 frame → gap-block
    const looksLikeGap = childNodes.length === 0 && (
      (bbox.height || 0) < 50 || /^gap[_\s\-]?\d*$/i.test(node.name || '')
    );
    if (looksLikeGap) {
      return { type: 'gap', height: Math.round(bbox.height || 20) };
    }

    const scale = containerW / (frameBox?.width || containerW);
    const scaledW = Math.round((bbox.width || 200) * scale);
    const scaledH = Math.round((bbox.height || 200) * scale);
    const relX = Math.round(((bbox.x || 0) - (frameBox?.x || 0)) * scale);
    const bg = getBgColor(node) || '#f5f5f5';

    // 자식은 서브섹션의 실제 렌더 폭(scaledW)을 컨테이너로 사용 → scale=1.0
    const children = [];
    if (childNodes.length) {
      // 부모 autoLayout 정렬이 CENTER이면 자식 텍스트도 중앙 정렬
      const lm = detail?.layoutMode;
      const primary = detail?.primaryAxisAlignItems;
      const counter = detail?.counterAxisAlignItems;
      const childTextAlign = (
        (lm === 'HORIZONTAL' && primary === 'CENTER') ||
        (lm === 'VERTICAL'   && counter === 'CENTER')
      ) ? 'center' : null;

      for (const child of childNodes) {
        // 자식 nodeToBlock 호출 — frameBox=bbox(현재 sub-section), containerW=scaledW
        // 이로써 자식은 직속 부모(sub-section)의 (0,0) 기준 좌표가 됨
        const childBlock = nodeToBlock(child, bbox, scaledW);
        if (childBlock) {
          const childBbox = child.absoluteBoundingBox || {};
          // y는 항상 직속 부모(=현재 frame=bbox) 기준
          childBlock.y = Math.round((childBbox.y || 0) - (bbox.y || 0));
          // x도 일관되게 직속 부모 기준으로 평탄화 (nodeToBlock 내 분기에서 이미 계산했더라도 덮어씀)
          if (childBlock.x !== undefined) {
            childBlock.x = Math.round((childBbox.x || 0) - (bbox.x || 0));
          }
          if (childTextAlign && childBlock.type === 'text') {
            childBlock.align = childTextAlign;
          }
          children.push(childBlock);
        }
      }
    }

    // cornerRadius 추출 (Figma에서 0이 아니면 적용)
    const radiusRaw = detail?.cornerRadius ?? node.cornerRadius;
    const radius = (typeof radiusRaw === 'number' && radiusRaw > 0)
      ? Math.round(radiusRaw * scale)
      : undefined;

    const rot = getRotationDeg(detail || node);
    const clip = !!(detail?.clipsContent ?? node.clipsContent);

    return {
      type: 'sub-section',
      label: node.name || 'Frame',
      width: scaledW,
      height: scaledH,
      x: relX,
      bg,
      ...(radius !== undefined ? { radius } : {}),
      clip,
      ...(rot ? { rotation: rot } : {}),
      // autoLayout 정보 보존 (runner가 활용 가능하도록)
      ...(detail?.layoutMode && detail.layoutMode !== 'NONE' ? {
        layoutMode: detail.layoutMode,
        itemSpacing: Math.round(detail.itemSpacing || 0),
        paddingTop: Math.round(detail.paddingTop || 0),
        paddingBottom: Math.round(detail.paddingBottom || 0),
        paddingLeft: Math.round(detail.paddingLeft || 0),
        paddingRight: Math.round(detail.paddingRight || 0),
      } : {}),
      children,
    };
  }

  // INSTANCE / COMPONENT / SLOT / GROUP → 자식에서 TEXT 노드 재귀 추출 시도
  const containerTypes = ['INSTANCE', 'COMPONENT', 'COMPONENT_SET', 'GROUP'];
  if (containerTypes.includes(node.type) || node.type === 'SLOT') {
    // 자식이 없으면 get_node_info로 가져옴
    const detail = node.children ? node : (() => {
      try { return figma('get_node_info', { nodeId: node.id }); } catch(e) { return node; }
    })();
    const children = detail?.children || [];

    // 재귀적으로 TEXT 노드만 추출
    function collectTexts(nodes) {
      const result = [];
      for (const n of nodes) {
        if (n.type === 'TEXT') result.push(n);
        else if (n.children) result.push(...collectTexts(n.children));
      }
      return result;
    }
    const texts = collectTexts(children);

    if (texts.length > 0) {
      // 텍스트 블록 배열 반환 (호출부에서 배열 처리)
      return {
        type: 'text-group',
        blocks: texts.map(t => nodeToBlock(t, frameBox, containerW)).filter(Boolean),
      };
    }
  }

  // 그 외 모든 노드 → 조커 블록 (SVG 추출 시도, 실패 시 빈 조커)
  const bbox = node.absoluteBoundingBox || {};
  const scale = containerW / (frameBox?.width || containerW);
  const bboxW = bbox.width || 200;
  const bboxH = bbox.height || 200;
  const relX = Math.round(((bbox.x || 0) - (frameBox?.x || 0)) * scale);
  const rotFallback = getRotationDeg(node);

  const svgContent = exportSvgInline(node.id);

  // SVG 실패 → PNG 래스터 폴백 → 이미지 블록 (Figma 렌더 그대로 보존). PNG도 빈(1×1)이면 노드 스킵
  if (!svgContent || (typeof svgContent === 'string' && !svgContent.includes('<svg'))) {
    const png = exportPngInline(node.id, 2);
    if (png) {
      const sW = Math.round(bboxW * scale), sH = Math.round(bboxH * scale);
      return {
        type: 'image',
        label: node.name || node.type,
        preset: bboxH / bboxW > 1.1 ? 'tall' : bboxH / bboxW < 0.75 ? 'wide' : 'standard',
        src: png, width: sW, height: sH, x: relX,
        ...(rotFallback ? { rotation: rotFallback } : {}),
      };
    }
    return null; // SVG·PNG 모두 실질 콘텐츠 없음 → 투명/비가시 노드 스킵
  }

  // 이미지 fill 감지: SVG 안에 <image xlink:href="data:image/..." 패턴이 있으면 image 타입으로 변환
  if (typeof svgContent === 'string' && svgContent.includes('xlink:href="data:image/')) {
    const base64Match = svgContent.match(/xlink:href="(data:image\/[^"]+)"/);
    const scaledW = Math.round(bboxW * scale);
    const scaledH = Math.round(bboxH * scale);
    return {
      type: 'image',
      label: node.name || node.type,
      preset: bboxH / bboxW > 1.1 ? 'tall' : bboxH / bboxW < 0.75 ? 'wide' : 'standard',
      src: base64Match ? base64Match[1] : '',
      width: scaledW,
      height: scaledH,
      x: relX,
      ...(rotFallback ? { rotation: rotFallback } : {}),
    };
  }

  // SVG 자연 크기가 bbox보다 훨씬 작으면 SVG 크기 우선 (CONNECTOR/LINE 등)
  const svgDims = getSvgNaturalSize(svgContent);
  const useW = (svgDims && bboxH / svgDims.h > 3) ? svgDims.w : bboxW;
  const useH = (svgDims && bboxH / svgDims.h > 3) ? svgDims.h : bboxH;
  const scaledW = Math.round(useW * scale);
  const scaledH = Math.round(useH * scale);

  return {
    type: 'joker',
    label: node.name || node.type,
    svg: svgContent,
    width: scaledW,
    height: scaledH,
    x: relX,
    ...(rotFallback ? { rotation: rotFallback } : {}),
  };
}

// ─── autoLayout VERTICAL → stack rows (children 순서 그대로) ──────
function buildStackRows(children, frameBox, parentNode) {
  const rows = [];
  const padTop      = Math.round(parentNode?.paddingTop || 0);
  const padBottom   = Math.round(parentNode?.paddingBottom || 0);
  const itemSpacing = Math.round(parentNode?.itemSpacing || 0);

  const pushGap = (h) => {
    if (h > 8) rows.push({
      layout: 'stack',
      cols: [{ flex: 1, blocks: [{ type: 'gap', height: h }] }]
    });
  };

  pushGap(padTop);

  let firstReal = true;
  for (const child of children) {
    const block = nodeToBlock(child, frameBox);
    if (!block) continue;

    if (!firstReal && itemSpacing > 8) pushGap(itemSpacing);
    firstReal = false;

    if (block.type === 'text-group' && Array.isArray(block.blocks)) {
      for (const tb of block.blocks) {
        rows.push({ layout: 'stack', cols: [{ flex: 1, blocks: [tb] }] });
      }
    } else {
      rows.push({ layout: 'stack', cols: [{ flex: 1, blocks: [block] }] });
    }
  }

  pushGap(padBottom);

  return rows;
}

// ─── 자식 노드들 → rows ──────────────────────────────────────────
// parentNode가 autoLayout VERTICAL이면 children 순서 그대로 stack 변환,
// 아니면 Y 좌표 기반 그루핑 휴리스틱 사용.
function buildRows(children, frameBox, parentNode = null) {
  if (!children?.length) return [];

  // autoLayout VERTICAL → 순서 보존 stack 모드
  if (parentNode?.layoutMode === 'VERTICAL') {
    return buildStackRows(children, frameBox, parentNode);
  }

  const FRAME_TOP = frameBox.y;
  const FRAME_W   = frameBox.width;
  const TOLERANCE = frameBox.height * 0.04; // 4% 허용

  // INSTANCE/GROUP 노드를 TEXT 자식들로 재귀 펼치기
  function flattenToTextLeaves(node) {
    const containerTypes = ['INSTANCE', 'COMPONENT', 'COMPONENT_SET', 'GROUP', 'SLOT'];
    if (node.type === 'TEXT') return [node];
    if (containerTypes.includes(node.type)) {
      // children 없으면 get_node_info로 가져옴
      let children = node.children;
      if (!children) {
        try { children = figma('get_node_info', { nodeId: node.id })?.children || []; }
        catch(e) { children = []; }
      }
      const texts = children.flatMap(c => flattenToTextLeaves(c));
      // TEXT 자식이 있으면 펼침, 없으면 원본 반환 (joker 처리)
      if (texts.length > 0) return texts;
    }
    return [node];
  }

  // 프레임 기준 상대 좌표로 변환, Y 정렬 (INSTANCE는 TEXT 자식으로 펼침)
  const nodes = children
    .filter(c => c.absoluteBoundingBox)
    .flatMap(c => flattenToTextLeaves(c))
    .filter(c => c.absoluteBoundingBox)
    .map(c => ({
      ...c,
      _relX: c.absoluteBoundingBox.x - frameBox.x,
      _relY: c.absoluteBoundingBox.y - FRAME_TOP,
      _w: c.absoluteBoundingBox.width,
      _h: c.absoluteBoundingBox.height,
    }))
    .sort((a, b) => a._relY - b._relY);

  function toBlocks(node) {
    const b = nodeToBlock(node, frameBox);
    if (!b) return [];
    return [b];
  }

  // Y 허용 오차 내에서 같은 행으로 그루핑
  const rowGroups = [];
  let cur = [];
  let prevY = null;

  for (const node of nodes) {
    if (prevY === null || Math.abs(node._relY - prevY) <= TOLERANCE) {
      cur.push(node);
    } else {
      if (cur.length) rowGroups.push(cur);
      cur = [node];
    }
    prevY = node._relY;
  }
  if (cur.length) rowGroups.push(cur);

  // 각 행 → row spec
  const rows = [];
  let lastY = 0;

  for (const group of rowGroups) {
    const groupTop = Math.min(...group.map(n => n._relY));

    // 행 위 gap
    const gapH = Math.round(groupTop - lastY);
    if (gapH > 8) {
      rows.push({
        layout: 'stack',
        cols: [{ flex: 1, blocks: [{ type: 'gap', height: gapH }] }]
      });
    }

    const sorted = [...group].sort((a, b) => a._relX - b._relX);

    if (sorted.length === 1) {
      // 단열
      rows.push({
        layout: 'stack',
        cols: [{ flex: 1, blocks: toBlocks(sorted[0]) }]
      });
    } else {
      // 다열 flex
      const totalW = sorted.reduce((s, n) => s + n._w, 0);
      const flexes = sorted.map(n => Math.round((n._w / totalW) * 12));
      const gcd = flexes.reduce((a, b) => { while (b) { [a, b] = [b, a % b]; } return a; }, flexes[0]);

      rows.push({
        layout: 'flex',
        cols: sorted.map((n, i) => ({
          flex: flexes[i] / gcd,
          blocks: toBlocks(n)
        }))
      });
    }

    const groupBottom = Math.max(...group.map(n => n._relY + n._h));
    lastY = groupBottom;
  }

  // 마지막 gap
  const bottomGap = Math.round(frameBox.height - lastY);
  if (bottomGap > 8) {
    rows.push({
      layout: 'stack',
      cols: [{ flex: 1, blocks: [{ type: 'gap', height: bottomGap }] }]
    });
  }

  return rows;
}

// ─── 프레임 → Section spec ──────────────────────────────────────
function frameToSection(frame) {
  const frameBox = frame.absoluteBoundingBox;
  const bg = getBgColor(frame);
  const paddingX = 0; // Figma는 패딩 개념이 다름 — 일단 0

  const rows = buildRows(frame.children, frameBox, frame);

  const section = {
    label: '',
    settings: { ...(bg ? { bg } : {}) },
    rows,
  };

  return section;
}

// ─── 메인 ────────────────────────────────────────────────────────
(async () => {
  // 문서 정보 조회
  const doc = figma('get_document_info', {});
  if (!doc) { console.error('❌ 문서 조회 실패 — Figma 플러그인이 켜져 있는지 확인하세요'); process.exit(1); }

  const frameList = doc.children || [];

  // 프레임 지정 없으면 목록 출력 후 종료
  if (!args.frame) {
    console.log(`\n📄 현재 페이지: ${doc.name}`);
    console.log('프레임 목록:');
    frameList.forEach(f => console.log(`  --frame ${f.id}  → "${f.name}"`));
    console.log('\n원하는 프레임 ID를 --frame 옵션으로 지정하세요.');
    process.exit(0);
  }

  const targetId = args.frame;
  const targetMeta = frameList.find(f => f.id === targetId);
  if (!targetMeta) {
    console.error(`❌ 프레임 ID "${targetId}" 를 찾을 수 없습니다`);
    process.exit(1);
  }

  console.log(`\n🔍 프레임 읽는 중: "${targetMeta.name}" (${targetId})`);
  const frame = figma('get_node_info', { nodeId: targetId });
  if (!frame) { console.error('❌ 노드 정보 읽기 실패'); process.exit(1); }

  // ─── VECTOR 타입 자동 감지 → SVG 추출 경로 ──────────────────────
  const VECTOR_TYPES = ['VECTOR', 'ELLIPSE', 'STAR', 'POLYGON', 'BOOLEAN_OPERATION', 'LINE'];
  if (VECTOR_TYPES.includes(frame.type)) {
    console.log(`⚡ VECTOR 타입 감지 (${frame.type}) → SVG 추출 경로로 전환`);

    const exportResult = figma('export_node_as_image', { nodeId: targetId, format: 'SVG', scale: 1 });
    if (!exportResult?.imageData) {
      console.error('❌ SVG 추출 실패');
      process.exit(1);
    }

    const svgContent = Buffer.from(exportResult.imageData, 'base64').toString('utf-8');
    const bbox = frame.absoluteBoundingBox || {};
    const svgDims = getSvgNaturalSize(svgContent);
    const w = svgDims?.w || Math.round(bbox.width || 100);
    const h = svgDims?.h || Math.round(bbox.height || 100);

    console.log(`   SVG 크기: ${w}×${h}px`);

    const safeName = targetMeta.name.replace(/[^a-zA-Z0-9가-힣]/g, '_').slice(0, 24);
    const svgPath = `/tmp/goditor_vector_figma_${safeName}.svg`;
    fs.writeFileSync(svgPath, svgContent);
    console.log(`✅ SVG 저장: ${svgPath}`);

    if (BUILD) {
      // CDP로 직접 벡터 블록 추가
      const http = require('http');
      const WebSocket = require('/Users/a1/web-editor/node_modules/ws');

      function getWsUrl() {
        return new Promise((resolve, reject) => {
          http.get(`http://127.0.0.1:${PORT}/json`, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
              const pages = JSON.parse(data);
              const page = pages.find(p => p.type === 'page' && (p.url.includes('web-editor') || p.url.includes('index.html')));
              if (page) resolve(page.webSocketDebuggerUrl);
              else reject(new Error('웹에디터 페이지 없음'));
            });
          }).on('error', reject);
        });
      }

      const wsUrl = await getWsUrl();
      const ws = new WebSocket(wsUrl);
      await new Promise(r => ws.on('open', r));

      let msgId = 1;
      function ev(expr) {
        return new Promise((resolve, reject) => {
          const id = msgId++;
          ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } }));
          const handler = raw => {
            const msg = JSON.parse(raw);
            if (msg.id !== id) return;
            ws.off('message', handler);
            const val = msg.result?.result;
            if (val?.subtype === 'error') reject(new Error(val.description));
            else resolve(val?.value);
          };
          ws.on('message', handler);
        });
      }

      console.log('\n🏗️  에디터에 벡터 블록 추가 중...');
      // 새 섹션 추가
      await ev('window.addSection()');
      await new Promise(r => setTimeout(r, 300));

      const svgEscaped = JSON.stringify(svgContent);
      const result = await ev(`
        (async () => {
          window.addVectorBlock(${svgEscaped}, { w: ${w}, h: ${h}, label: ${JSON.stringify(targetMeta.name)} });
          await new Promise(r => setTimeout(r, 300));
          window.triggerAutoSave && window.triggerAutoSave();
          return 'ok';
        })()
      `);
      console.log(`✅ 벡터 블록 추가 완료 (${w}×${h}px)`);
      ws.close();
    } else {
      console.log(`\n벡터 블록 추가하려면 --build 옵션을 사용하세요:`);
      console.log(`  node ${path.basename(process.argv[1])} --channel ${CHANNEL} --frame ${targetId} --build --port ${PORT}`);
    }
    process.exit(0);
  }
  // ─────────────────────────────────────────────────────────────────

  // Spec 생성
  const safeName = targetMeta.name.replace(/[^a-zA-Z0-9가-힣]/g, '_').slice(0, 24);
  const specPath = `/tmp/goditor_spec_figma_${safeName}.json`;

  const spec = {
    schema: 'goditor-spec',
    version: 2,
    meta: { source: 'figma', frameId: targetId, frameName: targetMeta.name },
    sections: [frameToSection(frame)]
  };

  fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
  console.log(`✅ Spec 저장: ${specPath}`);
  console.log(`   섹션: 1개, rows: ${spec.sections[0].rows.length}개`);

  // 빌드
  if (BUILD) {
    console.log('\n🏗️  에디터 빌드 중...');
    const runnerArgs = [RUNNER, specPath, '--port', String(PORT)];
    const result = spawnSync('node', runnerArgs, { encoding: 'utf-8', stdio: 'inherit' });
    process.exit(result.status || 0);
  } else {
    console.log(`\n빌드하려면:\n  node ${RUNNER} ${specPath} --port ${PORT}`);
  }
})();
