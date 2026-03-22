#!/usr/bin/env node
/**
 * sangpe-design-v1 JSON → Figma 변환기 v4
 * - 선택된 섹션만 업로드 지원
 * - section.figmaId 가 있으면 해당 프레임 삭제 후 같은 Y 위치에 재생성 (update)
 * - section.figmaId 가 없으면 신규 생성 (upload)
 * - 각 섹션 완료 시 SECTION_MAP:{...} 라인 출력 → 호출자가 파싱해 node_map 갱신
 *
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

// ─── 색상 (hex / rgb() → {r,g,b,a}) ─────────────────────────────
function hex(h) {
  if (!h) return { r: 0, g: 0, b: 0, a: 1 };
  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = h.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgbMatch) {
    return {
      r: parseFloat(rgbMatch[1]) / 255,
      g: parseFloat(rgbMatch[2]) / 255,
      b: parseFloat(rgbMatch[3]) / 255,
      a: rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1,
    };
  }
  if (!h.startsWith('#')) return { r: 1, g: 1, b: 1, a: 1 };
  const clean = h.length === 4
    ? '#' + h[1]+h[1] + h[2]+h[2] + h[3]+h[3]
    : h;
  return {
    r: parseInt(clean.slice(1, 3), 16) / 255,
    g: parseInt(clean.slice(3, 5), 16) / 255,
    b: parseInt(clean.slice(5, 7), 16) / 255,
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
    const fontStyle = s.fontWeight >= 700 ? 'Bold' : 'Regular';
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
        run('set_corner_radius', { nodeId: labelFrame.id, radius: lb.radius });

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

    const rawFamily = (s.fontFamily || 'Noto Sans KR').replace(/["']/g, '').split(',')[0].trim();
    const fontStyle = s.fontWeight >= 700 ? 'Bold' : 'Regular';

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

    run('set_font_name', { nodeId: node.id, family: rawFamily, style: fontStyle });

    if (s.letterSpacing !== undefined && s.letterSpacing !== 0) {
      run('set_letter_spacing', { nodeId: node.id, letterSpacing: s.letterSpacing, unit: 'PIXELS' });
    }

    if (s.lineHeight) {
      run('set_line_height', { nodeId: node.id, lineHeight: s.lineHeight * s.fontSize, unit: 'PIXELS' });
    }

    run('resize_node', { nodeId: node.id, width: textWidth, height: node.height || 100 });

    const nodeInfo = run('get_node_info', { nodeId: node.id });
    const actualH  = nodeInfo?.absoluteBoundingBox?.height || node.height || Math.ceil((s.fontSize || 16) * (s.lineHeight || 1.4));
    const totalH   = actualH + (p.top || 0) + (p.bottom || 0);

    const preview = block.content.slice(0, 24) + (block.content.length > 24 ? '…' : '');
    console.log(`      · text[${block.variant}] ${s.fontSize}px "${preview}"  실제높이:${actualH}px → ${node.id}`);
    return totalH;
  }

  // ── IMAGE ─────────────────────────────────────────────────────
  if (block.type === 'image') {
    const s    = block.style || {};
    const imgH = block.height || 400;

    const node = run('create_frame', {
      x, y,
      width:  availableWidth,
      height: imgH,
      name: `image_${block.id}`,
      parentId,
    });
    if (node) {
      if (block.src) {
        // 실제 이미지 데이터가 있으면 fill로 적용
        let sourceType, imageSource;
        if (block.src.startsWith('data:')) {
          // data:image/xxx;base64,XXXX → base64 부분만 추출
          sourceType   = 'base64';
          imageSource  = block.src.split(',')[1];
        } else {
          sourceType   = 'url';
          imageSource  = block.src;
        }
        const fillResult = run('set_image_fill', {
          nodeId: node.id,
          imageSource,
          sourceType,
          scaleMode: 'FILL',
        });
        if (!fillResult) {
          // 이미지 업로드 실패 시 회색 fallback
          run('set_fill_color', { nodeId: node.id, color: { r: 0.84, g: 0.84, b: 0.84, a: 1 } });
          console.log(`      · image ${availableWidth}×${imgH} → ${node.id} ⚠️ 이미지 업로드 실패, 회색 플레이스홀더`);
        } else {
          console.log(`      · image ${availableWidth}×${imgH} → ${node.id} ✓ 이미지 적용`);
        }
      } else {
        // 이미지 없으면 회색 플레이스홀더
        run('set_fill_color', { nodeId: node.id, color: { r: 0.84, g: 0.84, b: 0.84, a: 1 } });
        console.log(`      · image ${availableWidth}×${imgH} → ${node.id} (플레이스홀더)`);
      }
      if ((s.borderRadius || 0) > 0)
        run('set_corner_radius', { nodeId: node.id, radius: s.borderRadius });
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

console.log(`\n🎨 sangpe → Figma 변환 시작`);
console.log(`   캔버스: ${canvasWidth}px  섹션: ${sections.length}개  섹션 간격: ${sectionGap}px\n`);

// ─── 모드 판단 ────────────────────────────────────────────────────
// 하나라도 figmaId 가 있으면 "부분 업로드" 모드 → 전체 삭제 안 함
const isPartialUpload = sections.some(s => s.figmaId);

if (!isPartialUpload) {
  // 전체 업로드: 기존 페이지 프레임 전체 삭제
  console.log('🗑  기존 노드 정리 중...');
  const docInfo = run('get_document_info', {});
  const pageChildren = docInfo?.children || [];
  let deletedCount = 0;
  for (const child of pageChildren) {
    run('delete_node', { nodeId: child.id });
    deletedCount++;
  }
  if (deletedCount > 0) console.log(`   → ${deletedCount}개 삭제됨\n`);
} else {
  // 부분 업로드: 업데이트 대상 섹션 프레임만 삭제
  console.log('🔄 업데이트 대상 섹션 정리 중...');
  let deletedCount = 0;
  for (const section of sections) {
    if (section.figmaId) {
      run('delete_node', { nodeId: section.figmaId });
      deletedCount++;
      console.log(`   → 삭제: ${section.name} (${section.figmaId})`);
    }
  }
  if (deletedCount > 0) console.log(`   → ${deletedCount}개 삭제됨\n`);
}

// ─── 신규 섹션 추가 위치 계산 (부분 업로드 시) ──────────────────
let appendY = 0;
if (isPartialUpload) {
  const docInfo = run('get_document_info', {});
  const children = docInfo?.children || [];
  for (const child of children) {
    const info = run('get_node_info', { nodeId: child.id });
    const bbox = info?.absoluteBoundingBox;
    if (bbox) appendY = Math.max(appendY, bbox.y + bbox.height + sectionGap);
  }
}

// ─── 섹션 렌더링 ─────────────────────────────────────────────────
let currentY = appendY;

for (let si = 0; si < sections.length; si++) {
  const section = sections[si];

  // 업데이트 모드: 저장된 Y 위치에 재생성; 신규: currentY 에 추가
  const sectionY = (isPartialUpload && section.figmaY !== undefined)
    ? section.figmaY
    : currentY;

  console.log(`📦 [${si + 1}/${sections.length}] "${section.name}"  bg:${section.background || '#fff'}  y:${sectionY}`);

  const secFrame = run('create_frame', {
    x: 0, y: sectionY,
    width: canvasWidth, height: 100,
    name: section.name,
  });
  if (!secFrame) {
    currentY += 100 + sectionGap;
    continue;
  }
  run('set_fill_color', { nodeId: secFrame.id, color: hex(section.background || '#ffffff') });

  let blockY = 0;
  for (const block of section.blocks) {
    const h = renderBlock(block, secFrame.id, 0, blockY, canvasWidth);
    blockY += h;
  }

  run('resize_node', { nodeId: secFrame.id, width: canvasWidth, height: blockY });
  console.log(`   → 섹션 높이: ${blockY}px  ID: ${secFrame.id}\n`);

  // 섹션 매핑 정보 출력 (호출자가 파싱해 node_map 갱신)
  console.log(`SECTION_MAP:${JSON.stringify({ id: section.id, figmaId: secFrame.id, y: sectionY, height: blockY, name: section.name })}`);

  // 신규 섹션만 currentY 전진 (업데이트 섹션은 기존 위치 유지)
  if (!isPartialUpload || section.figmaY === undefined) {
    currentY = sectionY + blockY + sectionGap;
  }
}

console.log('✅ 완료!');
console.log(`   섹션 ${sections.length}개 처리 완료`);
