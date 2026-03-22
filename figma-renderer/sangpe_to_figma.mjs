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

import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHANNEL   = process.argv[2];
const JSON_PATH = process.argv[3];

if (!CHANNEL || !JSON_PATH) {
  console.error('Usage: node sangpe_to_figma.mjs <channelId> <jsonPath>');
  process.exit(1);
}

const FIGMA_CMD = path.join(__dirname, 'figma_cmd.mjs');

// ─── Figma 커맨드 ────────────────────────────────────────────────
// opts: { timeout } (ms)
function run(command, params, opts = {}) {
  const paramsStr  = JSON.stringify(params);
  const spawnMs    = (opts.timeout || 15000) + 3000; // spawnSync는 ws timeout보다 여유 있게
  const timeoutArg = String(opts.timeout || 8000);

  let args;
  let tmpFile = null;

  // CLI 인수 크기 한계(~2MB) 초과 시 임시 파일로 전달
  if (paramsStr.length > 100000) {
    tmpFile = path.join(os.tmpdir(), `figma_params_${Date.now()}.json`);
    writeFileSync(tmpFile, paramsStr);
    args = [FIGMA_CMD, '--channel', CHANNEL, '--command', command,
            '--params-file', tmpFile, '--timeout', timeoutArg];
  } else {
    args = [FIGMA_CMD, '--channel', CHANNEL, '--command', command,
            '--params', paramsStr, '--timeout', timeoutArg];
  }

  const result = spawnSync('node', args, { encoding: 'utf-8', timeout: spawnMs });

  if (tmpFile) { try { unlinkSync(tmpFile); } catch {} }

  if (result.error) throw result.error;
  // delete_node 등 반환값 없는 커맨드는 파싱 경고 생략
  if (!result.stdout?.trim()) return null;
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

  // ── GAP (빈 프레임 스페이서) ─────────────────────────────────
  if (block.type === 'gap') {
    const frame = run('create_frame', {
      x, y,
      width: availableWidth,
      height: block.height,
      name: 'gap',
      parentId,
    });
    if (frame) {
      run('set_fill_color', { nodeId: frame.id, color: { r: 0, g: 0, b: 0, a: 0 } });
    }
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

  // ── LABEL GROUP (여러 라벨 가로 배치) ────────────────────────
  if (block.type === 'label-group') {
    const items    = block.items || [];
    const style    = block.style || {};
    const gap      = style.gap      || 10;
    const paddingX = style.paddingX || 20;
    const align    = style.align    || 'left';
    const fontSize = 26;
    const padH = 36, padV = 11;
    const totalH = block.height || (fontSize * 1.4 + padV * 2 + 16);

    const family    = 'Noto Sans KR';
    const fontStyle = 'Bold';
    run('load_font_async', { family, style: fontStyle });

    // 1단계: 모든 아이템 텍스트 너비 사전 측정 (임시 생성 → 측정 → 삭제)
    const measured = [];
    for (const item of items) {
      const tmp = run('create_text', {
        x: 0, y: 0,
        text: item.text || 'Tag',
        fontSize, fontWeight: 700,
        fontColor: hex(item.color || '#ffffff'),
        textAutoResize: 'WIDTH_AND_HEIGHT',
        name: `_tmp_measure_${item.text}`,
        parentId,
      });
      if (!tmp) { measured.push({ textW: fontSize * 3, textH: fontSize * 1.4 }); continue; }
      run('set_font_name', { nodeId: tmp.id, family, style: fontStyle });
      const info  = run('get_node_info', { nodeId: tmp.id });
      const textW = info?.absoluteBoundingBox?.width  || fontSize * (item.text?.length || 3) * 0.65;
      const textH = info?.absoluteBoundingBox?.height || fontSize * 1.4;
      run('delete_node', { nodeId: tmp.id });
      measured.push({ textW: Math.ceil(textW), textH: Math.ceil(textH) });
    }

    // 2단계: 래퍼 프레임 생성 + 오토레이아웃 (HORIZONTAL)
    const primaryAlign = align === 'center' ? 'CENTER' : align === 'right' ? 'MAX' : 'MIN';
    const wrapper = run('create_frame', {
      x, y, width: availableWidth, height: totalH,
      name: `label-group_${block.id || ''}`,
      parentId,
    });
    if (!wrapper) return totalH;
    run('set_fill_color', { nodeId: wrapper.id, color: { r: 0, g: 0, b: 0, a: 0 } });
    run('set_auto_layout', {
      nodeId: wrapper.id,
      layoutMode: 'HORIZONTAL',
      paddingLeft: paddingX, paddingRight: paddingX,
      paddingTop: 0, paddingBottom: 0,
      itemSpacing: gap,
      primaryAxisAlignItems: primaryAlign,
      counterAxisAlignItems: 'CENTER',
      layoutWrap: 'WRAP',
      primaryAxisSizingMode: 'FIXED',
      counterAxisSizingMode: 'AUTO',
    });
    // 오토레이아웃 후 hug 모드로 바뀌므로 너비 고정 (fallback)
    run('resize_node', { nodeId: wrapper.id, width: availableWidth, height: totalH });

    // 3단계: 태그 프레임 생성 (래퍼 자식 — 오토레이아웃이 위치 자동 계산)
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const { textW, textH } = measured[i];
      const boxW = textW + padH * 2;
      const boxH = textH + padV * 2;

      const frame = run('create_frame', {
        x: 0, y: 0,
        width: boxW, height: boxH,
        name: `lgi_${item.text}`,
        parentId: wrapper.id,
      });
      if (!frame) continue;

      run('set_fill_color', { nodeId: frame.id, color: hex(item.bg || '#111111') });
      if ((item.radius || 0) > 0) run('set_corner_radius', { nodeId: frame.id, radius: item.radius });
      // 태그 내부 오토레이아웃 — hug content, 텍스트 수정 시 태그 박스 자동 확장
      run('set_auto_layout', {
        nodeId: frame.id,
        layoutMode: 'HORIZONTAL',
        paddingLeft: padH, paddingRight: padH,
        paddingTop: padV, paddingBottom: padV,
        itemSpacing: 0,
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        primaryAxisSizingMode: 'AUTO',
        counterAxisSizingMode: 'AUTO',
      });

      const textNode = run('create_text', {
        x: 0, y: 0,
        text: item.text || 'Tag',
        fontSize, fontWeight: 700,
        fontColor: hex(item.color || '#ffffff'),
        textAlignHorizontal: 'CENTER',
        textAutoResize: 'WIDTH_AND_HEIGHT',
        name: `lgi_text_${item.text}`,
        parentId: frame.id,
      });
      if (textNode) {
        run('set_font_name', { nodeId: textNode.id, family, style: fontStyle });
      }
    }

    const preview = items.map(i => i.text).join(' | ');
    console.log(`      · label-group [${items.length}개] "${preview}"  정렬:${align}  높이:${totalH}px`);
    return totalH;
  }

  // ── LABEL (배경 박스 + 텍스트) ────────────────────────────────
  if (block.type === 'text' && block.variant === 'label' && block.labelBox) {
    const s  = block.style   || {};
    const p  = block.padding || { top: 0, right: 0, bottom: 0, left: 0 };
    const lb = block.labelBox;

    const rawFamily = (s.fontFamily || 'Noto Sans KR').replace(/[\"']/g, '').split(',')[0].trim();
    const fontStyle = s.fontWeight >= 700 ? 'Bold' : 'Regular';
    run('load_font_async', { family: rawFamily, style: fontStyle });

    // 1. 텍스트 측정용 임시 노드 생성 → 크기 조회 → 삭제
    const tmpNode = run('create_text', {
      x: 0, y: 0,
      text:               block.content,
      fontSize:           s.fontSize   || 26,
      fontWeight:         s.fontWeight || 700,
      fontColor:          hex(s.color  || '#ffffff'),
      textAlignHorizontal: 'CENTER',
      textAutoResize:     'WIDTH_AND_HEIGHT',
      name: `_tmp_label_${block.id}`,
      parentId,
    });
    if (!tmpNode) return (s.fontSize || 26) * 1.4 + (p.top || 0) + (p.bottom || 0);
    run('set_font_name', { nodeId: tmpNode.id, family: rawFamily, style: fontStyle });
    const textInfo = run('get_node_info', { nodeId: tmpNode.id });
    const textW = textInfo?.absoluteBoundingBox?.width  || 100;
    const textH = textInfo?.absoluteBoundingBox?.height || (s.fontSize || 26) * 1.4;
    run('delete_node', { nodeId: tmpNode.id });

    const boxW  = textW + lb.paddingH * 2;
    const boxH  = textH + lb.paddingV * 2;
    const totalH = boxH + (p.top || 0) + (p.bottom || 0);

    // 2. 래퍼 프레임 (투명, 전체 너비 × 총 높이)
    const wrapper = run('create_frame', {
      x, y, width: availableWidth, height: totalH,
      name: `label_${block.id}`,
      parentId,
    });
    if (!wrapper) return totalH;
    run('set_fill_color', { nodeId: wrapper.id, color: { r: 0, g: 0, b: 0, a: 0 } });

    // 래퍼에 오토레이아웃 → label_box 중앙 정렬, 텍스트 변경 시 양옆으로 균등 확장
    run('set_auto_layout', {
      nodeId: wrapper.id,
      layoutMode: 'HORIZONTAL',
      paddingLeft: p.left || 0, paddingRight: p.right || 0,
      paddingTop: p.top || 0, paddingBottom: p.bottom || 0,
      itemSpacing: 0,
      primaryAxisAlignItems: 'CENTER',
      counterAxisAlignItems: 'CENTER',
      primaryAxisSizingMode: 'FIXED',
      counterAxisSizingMode: 'AUTO',
    });

    // 3. 배경 프레임 (래퍼 자식 — 오토레이아웃이 중앙 배치)
    const labelFrame = run('create_frame', {
      x: 0, y: 0,
      width: boxW, height: boxH,
      name: `label_box_${block.id}`,
      parentId: wrapper.id,
    });
    if (labelFrame) {
      run('set_fill_color', { nodeId: labelFrame.id, color: hex(lb.bg) });
      if (lb.radius > 0) run('set_corner_radius', { nodeId: labelFrame.id, radius: lb.radius });

      // 오토레이아웃 적용 (Shift+A) — 텍스트 수정 시 박스 자동 크기 조절
      run('set_auto_layout', {
        nodeId: labelFrame.id,
        layoutMode: 'HORIZONTAL',
        paddingLeft: lb.paddingH, paddingRight: lb.paddingH,
        paddingTop: lb.paddingV, paddingBottom: lb.paddingV,
        itemSpacing: 0,
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        primaryAxisSizingMode: 'AUTO',
        counterAxisSizingMode: 'AUTO',
      });

      // 4. 텍스트를 배경 프레임 자식으로 생성 (오토레이아웃이 위치/크기 자동 계산)
      const textNode = run('create_text', {
        x: 0, y: 0,
        text:               block.content,
        fontSize:           s.fontSize   || 26,
        fontWeight:         s.fontWeight || 700,
        fontColor:          hex(s.color  || '#ffffff'),
        textAlignHorizontal: 'CENTER',
        textAutoResize:     'WIDTH_AND_HEIGHT',
        name: `label_text_${block.id}`,
        parentId: labelFrame.id,
      });
      if (textNode) {
        run('set_font_name', { nodeId: textNode.id, family: rawFamily, style: fontStyle });
      }
    }

    console.log(`      · label "${block.content}"  box:${Math.round(boxW)}×${Math.round(boxH)} → ${wrapper?.id}`);
    return totalH;
  }

  // ── TEXT ─────────────────────────────────────────────────────
  if (block.type === 'text') {
    const s   = block.style   || {};
    const p   = block.padding || { top: 0, right: 0, bottom: 0, left: 0 };
    const textWidth = availableWidth - (p.left || 0) - (p.right || 0);
    const totalH = (block.height && block.height > 0)
      ? block.height
      : Math.ceil((s.fontSize || 16) * (s.lineHeight || 1.4)) + (p.top || 0) + (p.bottom || 0);

    const rawFamily = (s.fontFamily || 'Noto Sans KR').replace(/["']/g, '').split(',')[0].trim();
    const fontStyle = s.fontWeight >= 700 ? 'Bold' : 'Regular';
    run('load_font_async', { family: rawFamily, style: fontStyle });

    // 1. 텍스트 블록 래퍼 프레임 생성
    const frame = run('create_frame', {
      x, y,
      width: availableWidth,
      height: totalH,
      name: `${block.variant || 'text'}_${block.id}`,
      parentId,
    });
    if (!frame) return totalH;
    run('set_fill_color', { nodeId: frame.id, color: { r: 0, g: 0, b: 0, a: 0 } });

    // 2. 텍스트를 프레임 자식으로 생성 (로컬 좌표)
    const node = run('create_text', {
      x: p.left || 0,
      y: p.top  || 0,
      text:                block.content,
      fontSize:            s.fontSize   || 16,
      fontWeight:          s.fontWeight || 400,
      fontColor:           hex(s.color  || '#111111'),
      textAlignHorizontal: toFigmaAlign(s.textAlign),
      width:               textWidth,
      textAutoResize:      'HEIGHT',
      name: `text_${block.id}`,
      parentId: frame.id,
    });

    if (node) {
      run('set_font_name', { nodeId: node.id, family: rawFamily, style: fontStyle });
      if (s.letterSpacing !== undefined && s.letterSpacing !== 0) {
        run('set_letter_spacing', { nodeId: node.id, letterSpacing: s.letterSpacing, unit: 'PIXELS' });
      }
      if (s.lineHeight) {
        run('set_line_height', { nodeId: node.id, lineHeight: s.lineHeight * s.fontSize, unit: 'PIXELS' });
      }
      run('resize_node', { nodeId: node.id, width: textWidth, height: node.height || 100 });
    }

    const preview = block.content.slice(0, 24) + (block.content.length > 24 ? '…' : '');
    console.log(`      · text[${block.variant}] ${s.fontSize}px "${preview}"  DOM높이:${totalH}px → ${frame.id}`);
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
        }, { timeout: 30000 });
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

// ─── Figma 연결 확인 ─────────────────────────────────────────────
const pingResult = run('get_document_info', {}, { timeout: 6000 });
if (!pingResult) {
  console.error('❌ Figma 연결 실패: 채널 ID를 확인하거나 Figma 플러그인이 실행 중인지 확인해주세요.');
  process.exit(1);
}

// ─── 모드 판단 ────────────────────────────────────────────────────
// 하나라도 figmaId 가 있으면 "부분 업로드" 모드 → 전체 삭제 안 함
const isPartialUpload = sections.some(s => s.figmaId);

if (!isPartialUpload) {
  // 전체 업로드: 기존 페이지 프레임 전체 삭제
  console.log('🗑  기존 노드 정리 중...');
  const pageChildren = pingResult?.children || [];
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
