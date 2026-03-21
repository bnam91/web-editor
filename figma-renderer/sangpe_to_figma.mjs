#!/usr/bin/env node
/**
 * sangpe-design-v1 JSON → Figma 변환기 v3
 * - create_text에 fontSize/fontWeight/fontColor/align/width 한 번에 전달
 * - create_* 에 parentId 전달로 즉시 부모 프레임에 삽입
 * - textAutoResize:"HEIGHT"로 Figma 실제 높이 반환 → 정확한 위치 계산
 * 사용법: node sangpe_to_figma.mjs <channelId> <jsonPath>
 */

import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHANNEL   = process.argv[2];
const JSON_PATH = process.argv[3];

if (!CHANNEL || !JSON_PATH) {
  console.error('Usage: node sangpe_to_figma.mjs <channelId> <jsonPath>');
  process.exit(1);
}

const FIGMA_CMD = path.join(__dirname, 'figma_cmd.mjs');

// ─── Figma 커맨드 ────────────────────────────────────────────────
function run(command, params) {
  const result = spawnSync(
    'node',
    [FIGMA_CMD, '--channel', CHANNEL, '--command', command, '--params', JSON.stringify(params)],
    { encoding: 'utf-8', timeout: 15000 }
  );
  if (result.error) throw result.error;
  try {
    return JSON.parse(result.stdout);
  } catch {
    console.error(`  ⚠️  [${command}] 파싱 실패:`, result.stdout?.slice(0, 80));
    return null;
  }
}

// ─── 색상 (hex → {r,g,b,a}) ──────────────────────────────────────
function hex(h) {
  if (!h || !h.startsWith('#')) return { r: 0, g: 0, b: 0, a: 1 };
  return {
    r: parseInt(h.slice(1, 3), 16) / 255,
    g: parseInt(h.slice(3, 5), 16) / 255,
    b: parseInt(h.slice(5, 7), 16) / 255,
    a: 1,
  };
}

// ─── textAlign 변환 ──────────────────────────────────────────────
const ALIGN_MAP = { left: 'LEFT', center: 'CENTER', right: 'RIGHT', start: 'LEFT', end: 'RIGHT' };
function toFigmaAlign(align) {
  return ALIGN_MAP[(align || 'left').toLowerCase()] || 'LEFT';
}

// ─── 블록 렌더링 ─────────────────────────────────────────────────
// 반환값: 실제 점유 높이(px)
function renderBlock(block, parentId, x, y, availableWidth) {

  // ── GAP (Y 오프셋만 추가, 노드 생성 안 함) ──────────────────
  if (block.type === 'gap') {
    return block.height;
  }

  // ── ROW (columns) ────────────────────────────────────────────
  if (block.columns) {
    let rowHeight = 0;
    let colX = x;
    for (const col of block.columns) {
      const colW = Math.round(availableWidth * (col.width / 100));
      let colY = y;
      for (const inner of col.blocks) {
        const h = renderBlock(inner, parentId, colX, colY, colW);
        colY += h;
      }
      rowHeight = Math.max(rowHeight, colY - y);
      colX += colW;
    }
    return rowHeight;
  }

  // ── LABEL (배경 박스 + 텍스트) ────────────────────────────────
  if (block.type === 'text' && block.variant === 'label' && block.labelBox) {
    const s  = block.style   || {};
    const p  = block.padding || { top: 0, right: 0, bottom: 0, left: 0 };
    const lb = block.labelBox;

    const rawFamily = (s.fontFamily || 'Noto Sans KR').replace(/[\"']/g, '').split(',')[0].trim();
    const fontStyle = s.fontWeight >= 700 ? 'Bold' : s.fontWeight >= 600 ? 'Semi Bold' : 'Regular';
    run('load_font_async', { family: rawFamily, style: fontStyle });

    // 1. 텍스트 노드 생성 (자연 너비 측정용 — textAutoResize: WIDTH_AND_HEIGHT)
    const textNode = run('create_text', {
      x: 0, y: 0,
      text:               block.content,
      fontSize:           s.fontSize   || 26,
      fontWeight:         s.fontWeight || 700,
      fontColor:          hex(s.color  || '#ffffff'),
      textAlignHorizontal: 'CENTER',
      textAutoResize:     'WIDTH_AND_HEIGHT',
      name: `label_text_${block.id}`,
      parentId,
    });
    if (!textNode) {
      return (s.fontSize || 26) * 1.4 + (p.top || 0) + (p.bottom || 0);
    }
    run('set_font_name', { nodeId: textNode.id, family: rawFamily, style: fontStyle });

    // 2. 실제 텍스트 크기 조회
    const textInfo = run('get_node_info', { nodeId: textNode.id });
    const textW = textInfo?.absoluteBoundingBox?.width  || 100;
    const textH = textInfo?.absoluteBoundingBox?.height || (s.fontSize || 26) * 1.4;

    // 3. 배경 프레임 생성 (label box)
    const boxW   = textW + lb.paddingH * 2;
    const boxH   = textH + lb.paddingV * 2;
    const boxX   = x + (p.left || 0) + (availableWidth - (p.left || 0) - (p.right || 0) - boxW) / 2;
    const boxY   = y + (p.top  || 0);

    const labelFrame = run('create_frame', {
      x: boxX, y: boxY,
      width:  boxW,
      height: boxH,
      name: `label_box_${block.id}`,
      parentId,
    });
    if (labelFrame) {
      run('set_fill_color', { nodeId: labelFrame.id, color: hex(lb.bg) });
      if (lb.radius > 0)
        run('set_corner_radius', { nodeId: labelFrame.id, cornerRadius: lb.radius });

      // 4. 텍스트를 배경 프레임 안으로 이동 + 위치 정렬
      run('insert_child', { parentId: labelFrame.id, childId: textNode.id, index: 0 });
      run('move_node', { nodeId: textNode.id, x: lb.paddingH, y: lb.paddingV });
    }

    const totalH = boxH + (p.top || 0) + (p.bottom || 0);
    console.log(`      · label "${block.content}"  box:${Math.round(boxW)}×${Math.round(boxH)} → ${labelFrame?.id}`);
    return totalH;
  }

  // ── TEXT ─────────────────────────────────────────────────────
  if (block.type === 'text') {
    const s   = block.style   || {};
    const p   = block.padding || { top: 0, right: 0, bottom: 0, left: 0 };
    const textWidth = availableWidth - (p.left || 0) - (p.right || 0);

    // 폰트 패밀리 파싱 (첫 번째 이름만 추출)
    const rawFamily = (s.fontFamily || 'Noto Sans KR').replace(/["']/g, '').split(',')[0].trim();
    const fontStyle = s.fontWeight >= 700 ? 'Bold' : s.fontWeight >= 600 ? 'Semi Bold' : 'Regular';

    // 폰트 로드
    run('load_font_async', { family: rawFamily, style: fontStyle });

    const node = run('create_text', {
      x: x + (p.left || 0),
      y: y + (p.top  || 0),
      text:               block.content,
      fontSize:           s.fontSize   || 16,
      fontWeight:         s.fontWeight || 400,
      fontColor:          hex(s.color  || '#111111'),
      textAlignHorizontal: toFigmaAlign(s.textAlign),
      width:              textWidth,
      textAutoResize:     'HEIGHT',
      name: `${block.variant || 'text'}_${block.id}`,
      parentId,
    });

    if (!node) {
      const fallbackH = Math.ceil((s.fontSize || 16) * (s.lineHeight || 1.4) * 2);
      return fallbackH + (p.top || 0) + (p.bottom || 0);
    }

    // 폰트 패밀리 적용
    run('set_font_name', { nodeId: node.id, family: rawFamily, style: fontStyle });

    // letterSpacing 적용 (px 단위)
    if (s.letterSpacing !== undefined && s.letterSpacing !== 0) {
      run('set_letter_spacing', { nodeId: node.id, letterSpacing: s.letterSpacing, unit: 'PIXELS' });
    }

    // lineHeight 적용
    if (s.lineHeight) {
      run('set_line_height', { nodeId: node.id, lineHeight: s.lineHeight * s.fontSize, unit: 'PIXELS' });
    }

    // width 강제 적용 → 줄바꿈 트리거
    run('resize_node', { nodeId: node.id, width: textWidth, height: node.height || 100 });

    // 실제 높이 재확인
    const nodeInfo = run('get_node_info', { nodeId: node.id });
    const actualH  = nodeInfo?.absoluteBoundingBox?.height || node.height || Math.ceil((s.fontSize || 16) * (s.lineHeight || 1.4));
    const totalH   = actualH + (p.top || 0) + (p.bottom || 0);

    const preview = block.content.slice(0, 24) + (block.content.length > 24 ? '…' : '');
    console.log(`      · text[${block.variant}] ${s.fontSize}px "${preview}"  실제높이:${actualH}px → ${node.id}`);
    return totalH;
  }

  // ── IMAGE (플레이스홀더) ──────────────────────────────────────
  if (block.type === 'image') {
    const s   = block.style  || {};
    const imgH = block.height || 400;

    const node = run('create_frame', {
      x, y,
      width:  availableWidth,
      height: imgH,
      name: `image_${block.id}`,
      parentId,
    });
    if (node) {
      run('set_fill_color', { nodeId: node.id, color: { r: 0.84, g: 0.84, b: 0.84, a: 1 } });
      if ((s.borderRadius || 0) > 0)
        run('set_corner_radius', { nodeId: node.id, cornerRadius: s.borderRadius });
      console.log(`      · image ${availableWidth}×${imgH} → ${node.id}`);
    }
    return imgH;
  }

  return 0;
}

// ─── MAIN ────────────────────────────────────────────────────────
const data        = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));
const { meta, sections } = data;
const canvasWidth = meta.canvasWidth || 860;
const sectionGap  = meta.theme?.sectionGap || 28;
const pageBg      = hex(meta.theme?.background || '#ffffff');

console.log(`\n🎨 sangpe → Figma 변환 시작`);
console.log(`   캔버스: ${canvasWidth}px  섹션: ${sections.length}개  섹션 간격: ${sectionGap}px\n`);

// ─── 기존 페이지 프레임 전체 삭제 ──────────────────────────────
console.log('🗑  기존 노드 정리 중...');
const docInfo = run('get_document_info', {});
const pageChildren = docInfo?.children || [];
let deletedCount = 0;
for (const child of pageChildren) {
  run('delete_node', { nodeId: child.id });
  deletedCount++;
}
if (deletedCount > 0) console.log(`   → ${deletedCount}개 삭제됨\n`);

let currentY = 0;

for (let si = 0; si < sections.length; si++) {
  const section = sections[si];
  console.log(`📦 [${si + 1}/${sections.length}] "${section.name}"  bg:${section.background || '#fff'}`);

  // 섹션 프레임을 페이지에 직접 생성 (parentId 없음)
  const secFrame = run('create_frame', {
    x: 0, y: currentY,
    width: canvasWidth, height: 100,
    name: section.name,
  });
  if (!secFrame) { currentY += 100 + sectionGap; continue; }
  run('set_fill_color', { nodeId: secFrame.id, color: hex(section.background || '#ffffff') });

  // 블록 렌더링 → 실제 높이 누적
  let blockY = 0;
  for (const block of section.blocks) {
    const h = renderBlock(block, secFrame.id, 0, blockY, canvasWidth);
    blockY += h;
  }

  // 실제 높이로 섹션 프레임 리사이즈
  run('resize_node', { nodeId: secFrame.id, width: canvasWidth, height: blockY });
  console.log(`   → 섹션 높이: ${blockY}px  ID: ${secFrame.id}\n`);

  currentY += blockY + sectionGap;
}

console.log('✅ 완료!');
console.log(`   섹션 ${sections.length}개 생성  총 높이: ${currentY - sectionGap}px`);
