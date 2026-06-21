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

// ─── CSS text-shadow → Figma DROP_SHADOW effects (네온 글로우 재현) ──
function parseTextShadowToEffects(ts) {
  if (!ts || ts === 'none') return [];
  const parts = ts.split(/,(?![^()]*\))/).map(s => s.trim()).filter(Boolean);
  const effects = [];
  for (const p of parts) {
    const colMatch = p.match(/(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})/);
    if (!colMatch) continue;
    const nums = (p.replace(colMatch[0], '').match(/-?\d*\.?\d+px/g) || []).map(n => parseFloat(n));
    const c = hex(colMatch[0]);
    if (!c) continue;
    effects.push({ type: 'DROP_SHADOW', color: c, offset: { x: nums[0] || 0, y: nums[1] || 0 },
      radius: nums[2] || 0, spread: 0, visible: true, blendMode: 'NORMAL' });
  }
  return effects.slice(0, 8);
}

// ─── textAlign 변환 ──────────────────────────────────────────────
const ALIGN_MAP = { left: 'LEFT', center: 'CENTER', right: 'RIGHT', start: 'LEFT', end: 'RIGHT' };
function toFigmaAlign(align) {
  return ALIGN_MAP[(align || 'left').toLowerCase()] || 'LEFT';
}

// ─── fontWeight → Figma fontStyle 변환 ───────────────────────────
// Pretendard / Noto Sans KR 모두 동일한 스타일명 사용
function toFigmaFontStyle(fontWeight) {
  const w = parseInt(fontWeight) || 400;
  if (w <= 100) return 'Thin';
  if (w <= 200) return 'ExtraLight';
  if (w <= 300) return 'Light';
  if (w <= 400) return 'Regular';
  if (w <= 500) return 'Medium';
  if (w <= 600) return 'SemiBold';
  if (w <= 700) return 'Bold';
  if (w <= 800) return 'ExtraBold';
  return 'Black';
}

// ─── 폰트별 고유 style명 매핑 ────────────────────────────────────
// 일부 폰트는 표준 style명("Regular"/"Medium"…) 대신 고유 명칭을 사용.
// A2Z(커스텀, 시스템 설치) = Figma family "A2Z" + 숫자 prefix style명.
const _FAMILY_STYLE_MAP = {
  'A2Z': {
    'Thin': '1 Thin', 'ExtraLight': '2 ExtraLight', 'Light': '3 Light',
    'Regular': '4 Regular', 'Medium': '5 Medium', 'SemiBold': '6 SemiBold',
    'Bold': '7 Bold', 'ExtraBold': '8 ExtraBold', 'Black': '9 Black',
  },
};
function resolveFamilyStyle(family, style) {
  const m = _FAMILY_STYLE_MAP[family];
  return (m && m[style]) ? m[style] : style;
}

// ─── 폰트 로딩 (실패 시 Noto Sans KR 폴백) ───────────────────────
const _fontCache = {};
function loadFontSafe(family, style) {
  const key = `${family}__${style}`;
  if (_fontCache[key] !== undefined) return _fontCache[key];
  const tryStyle = resolveFamilyStyle(family, style);
  const result = run('load_font_async', { family, style: tryStyle });
  if (result?.success) {
    _fontCache[key] = { family, style: tryStyle };
    return _fontCache[key];
  }
  // 폴백: Noto Sans KR (Figma에서 항상 사용 가능)
  const fallbackStyle = (style === 'Regular' || style === 'Light' || style === 'Thin' || style === 'ExtraLight') ? 'Regular' : 'Bold';
  const fallbackKey = `Noto Sans KR__${fallbackStyle}`;
  if (!_fontCache[fallbackKey]) {
    run('load_font_async', { family: 'Noto Sans KR', style: fallbackStyle });
    _fontCache[fallbackKey] = { family: 'Noto Sans KR', style: fallbackStyle };
  }
  console.log(`  ⚠️  폰트 없음: ${family} ${style} → Noto Sans KR ${fallbackStyle} 사용`);
  _fontCache[key] = _fontCache[fallbackKey];
  return _fontCache[key];
}

// ─── 블록 렌더링 ─────────────────────────────────────────────────
// 빈 에셋/원 placeholder 체커보드 SVG (goditor repeating-conic 36px셀 #d8d8d8/#f0f0f0, 72px타일 — 회차12 현빈 B결정)
function checkerSvg(w, h, ellipse) {
  const W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h));
  const clip = ellipse ? `<clipPath id="ck_cl"><ellipse cx="${W / 2}" cy="${H / 2}" rx="${W / 2}" ry="${H / 2}"/></clipPath>` : '';
  const ca = ellipse ? ' clip-path="url(#ck_cl)"' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>`
    + `<pattern id="ckp" width="72" height="72" patternUnits="userSpaceOnUse">`
    + `<rect width="72" height="72" fill="#f0f0f0"/><rect width="36" height="36" fill="#d8d8d8"/><rect x="36" y="36" width="36" height="36" fill="#d8d8d8"/>`
    + `</pattern>${clip}</defs><rect width="${W}" height="${H}" fill="url(#ckp)"${ca}/></svg>`;
}

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

  // ── FRAME (free-layout 자유배치 컨테이너) ────────────────────
  if (block.type === 'frame') {
    const fw = block.width || availableWidth;
    const fh = block.height || 0;
    const fx = x + Math.max(0, Math.round((availableWidth - fw) / 2)); // 섹션폭보다 좁으면 중앙
    const frame = run('create_frame', { x: fx, y, width: fw, height: fh, name: `frame_${block.id || ''}`, parentId });
    if (!frame) return fh;
    const bgc = (block.bg || '').trim();
    // 프레임 배경: #hex 뿐 아니라 rgb()/rgba()도 파싱(예: 카드 rgba(255,255,255,.55) — 이전엔 미파싱→투명 드롭으로 카드 사라짐).
    let _fc = null;
    if (bgc.startsWith('#')) _fc = hex(bgc);
    else { const _m = bgc.match(/rgba?\(([^)]+)\)/); if (_m) { const _p = _m[1].split(',').map(s => parseFloat(s)); _fc = { r: (_p[0] || 0) / 255, g: (_p[1] || 0) / 255, b: (_p[2] || 0) / 255, a: _p[3] !== undefined ? _p[3] : 1 }; } }
    run('set_fill_color', { nodeId: frame.id, color: _fc || { r: 1, g: 1, b: 1, a: 0 } });
    if (block.radius) run('set_corner_radius', { nodeId: frame.id, radius: block.radius });
    if (block.free) {
      for (const ch of (block.children || [])) {
        renderBlock(ch.block, frame.id, ch.x || 0, ch.y || 0, ch.w || fw);
      }
    } else {
      let cy = 0;
      for (const ch of (block.children || [])) {
        const h = renderBlock(ch.block, frame.id, ch.x || 0, cy, ch.w || fw);
        cy += h;
      }
    }
    return fh;
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
    loadFontSafe(family, fontStyle);

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
      name: `tag-group_${block.id || ''}`,
      parentId,
    });
    if (!wrapper) return totalH;
    run('set_fill_color', { nodeId: wrapper.id, color: { r: 0, g: 0, b: 0, a: 0 } });
    const rowGap = style.rowGap || gap;
    run('set_auto_layout', {
      nodeId: wrapper.id,
      layoutMode: 'HORIZONTAL',
      paddingLeft: paddingX, paddingRight: paddingX,
      paddingTop: 0, paddingBottom: 0,
      itemSpacing: gap,
      counterAxisSpacing: rowGap,
      primaryAxisAlignItems: primaryAlign,
      counterAxisAlignItems: 'CENTER',
      layoutWrap: 'WRAP',
      primaryAxisSizingMode: 'FIXED',
      counterAxisSizingMode: 'AUTO',
    });
    // 너비만 고정, 높이는 AUTO로 Figma가 결정 (2줄 wrap 시 높이가 달라질 수 있음)
    run('resize_node', { nodeId: wrapper.id, width: availableWidth });

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

    // 태그 생성 후 실제 높이 읽기 (wrap 2줄 시 totalH와 다를 수 있음)
    const wrapperInfo = run('get_node_info', { nodeId: wrapper.id });
    const actualH = wrapperInfo?.absoluteBoundingBox?.height || totalH;

    const preview = items.map(i => i.text).join(' | ');
    console.log(`      · tag-group [${items.length}개] "${preview}"  정렬:${align}  높이:${actualH}px`);
    return actualH;
  }

  // ── LABEL (배경 박스 + 텍스트) ────────────────────────────────
  if (block.type === 'text' && block.variant === 'label' && block.labelBox) {
    const s  = block.style   || {};
    const p  = block.padding || { top: 0, right: 0, bottom: 0, left: 0 };
    const lb = block.labelBox;

    const rawFamily = (s.fontFamily || 'Noto Sans KR').replace(/[\"']/g, '').split(',')[0].trim();
    const fontStyle = toFigmaFontStyle(s.fontWeight);
    const resolvedFont = loadFontSafe(rawFamily, fontStyle);

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
    run('set_font_name', { nodeId: tmpNode.id, family: resolvedFont.family, style: resolvedFont.style });
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
        run('set_font_name', { nodeId: textNode.id, family: resolvedFont.family, style: resolvedFont.style });
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
    // ⑤ Figma 글리프 advance가 브라우저보다 미세하게 넓어 같은 폭이어도 일찍 wrap(회차12 thhvp4d 확정, 큰 폰트일수록 심함).
    // → wrap 판정용 폭만 fontSize 비례 소량(≈반 글자) 넓혀 경계 케이스를 goditor와 맞춤. 프레임/시각폭은 그대로, 패딩 여백 내라 오버플로 없음.
    const _wrapSlack = Math.ceil((s.fontSize || 16) * 0.14);
    // ⑤ Figma가 같은 폭에서 한글을 브라우저보다 넓게 렌더(폰트메트릭 고질) → 폭매칭만으론 명시줄이 재wrap됨.
    // 콘텐츠에 명시적 \n이 있으면(=각 줄이 의도된 줄바꿈) 재wrap을 막아야 함 → wrap폭을 최대(availableWidth−좌패딩)로 줘 명시줄이 잘리지 않게.
    // 자연wrap(명시\n 없음) 콘텐츠는 기존대로 liveWidth/패딩+slack 사용(과확장 방지).
    const _hasExplicitNL = /\n/.test(block.content || '');
    const _liveW = (block.liveWidth && block.liveWidth > textWidth) ? block.liveWidth : (textWidth + _wrapSlack);
    const textWrapW  = _hasExplicitNL
      ? (availableWidth - (p.left || 0))
      : Math.min(availableWidth - (p.left || 0), _liveW);
    const totalH = (block.height && block.height > 0)
      ? block.height
      : Math.ceil((s.fontSize || 16) * (s.lineHeight || 1.4)) + (p.top || 0) + (p.bottom || 0);

    const rawFamily = (s.fontFamily || 'Noto Sans KR').replace(/["']/g, '').split(',')[0].trim();
    const fontStyle = toFigmaFontStyle(s.fontWeight);
    const resolvedFont = loadFontSafe(rawFamily, fontStyle);

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
    // 중앙정렬 텍스트는 박스를 가운데로 둬야 함(회차12 76 본문 36px 우측시프트 fix: \n텍스트 textWrapW가 우패딩 미반영 비대칭 → center 깨짐). 폭은 유지(rewrap 회귀 방지), x만 중앙 보정.
    const _txtX = (s.textAlign === 'center')
      ? Math.max(0, Math.round((availableWidth - textWrapW) / 2))
      : (p.left || 0);
    const node = run('create_text', {
      x: _txtX,
      y: p.top  || 0,
      text:                block.content,
      fontSize:            s.fontSize   || 16,
      fontWeight:          s.fontWeight || 400,
      fontColor:           hex(s.color  || '#111111'),
      textAlignHorizontal: toFigmaAlign(s.textAlign),
      width:               textWrapW,
      textAutoResize:      'HEIGHT',
      name: `text_${block.id}`,
      parentId: frame.id,
    });

    if (node) {
      run('set_font_name', { nodeId: node.id, family: resolvedFont.family, style: resolvedFont.style });
      if (s.letterSpacing !== undefined && s.letterSpacing !== 0) {
        run('set_letter_spacing', { nodeId: node.id, letterSpacing: s.letterSpacing, unit: 'PIXELS' });
      }
      if (s.lineHeight) {
        run('set_line_height', { nodeId: node.id, lineHeight: s.lineHeight * s.fontSize, unit: 'PIXELS' });
      }
      // ⚠️ node.height(=create_text 시점 자동높이, 기본 lineHeight 1.2)로 resize하면
      //    set_line_height가 무력화돼 행간이 좁아짐. DOM 실측 높이(totalH-패딩)로 고정해야
      //    goditor 행간(예 body 1.6)과 일치한다.
      const textBoxH = Math.max(1, totalH - (p.top || 0) - (p.bottom || 0));
      run('resize_node', { nodeId: node.id, width: textWrapW, height: textBoxH });

      // text-effect(네온 등) 글로우 — CSS text-shadow를 Figma DROP_SHADOW effect로 적용(회차12 chart 크림글로우 fix)
      const _fx = parseTextShadowToEffects(s.textShadow);
      if (_fx.length) run('set_effects', { nodeId: node.id, effects: _fx });
    }

    const preview = block.content.slice(0, 24) + (block.content.length > 24 ? '…' : '');
    console.log(`      · text[${block.variant}] ${s.fontSize}px "${preview}"  DOM높이:${totalH}px → ${frame.id}`);
    return totalH;
  }

  // ── CIRCLE (icon-circle-block) ────────────────────────────────
  if (block.type === 'circle') {
    const size    = block.size || 240;
    const circleX = x + Math.round((availableWidth - size) / 2);
    // 빈 원: .icb-circle 체커보드(goditor 숨김=투명)라 회색 칠 금지 → 투명. 사용자가 색 지정한 원만 그 색.
    const hasBg   = block.bgColor && block.bgColor !== 'transparent';

    // hex → figma RGB
    const hexToRgb = h => {
      const v = h.replace('#','');
      return { r: parseInt(v.slice(0,2),16)/255, g: parseInt(v.slice(2,4),16)/255, b: parseInt(v.slice(4,6),16)/255, a: 1 };
    };
    const TRANSPARENT = { r: 1, g: 1, b: 1, a: 0 };

    const node = run('create_frame', { x: circleX, y, width: size, height: size, name: `circle_${block.id}`, parentId });
    if (node) {
      run('set_corner_radius', { nodeId: node.id, radius: size / 2 });
      if (block.src) {
        const sourceType  = block.src.startsWith('data:') ? 'base64' : 'url';
        const imageSource = block.src.startsWith('data:') ? block.src.split(',')[1] : block.src;
        const fillResult  = run('set_image_fill', { nodeId: node.id, imageSource, sourceType, scaleMode: 'FILL' }, { timeout: 30000 });
        if (!fillResult) run('set_fill_color', { nodeId: node.id, color: hasBg ? hexToRgb(block.bgColor) : TRANSPARENT });
        console.log(`      · circle ${size}×${size} → ${node.id}${fillResult ? ' ✓ 이미지' : (hasBg ? ' (배경색)' : ' (빈 원 투명)')}`);
      } else if (hasBg) {
        run('set_fill_color', { nodeId: node.id, color: hexToRgb(block.bgColor) });
        console.log(`      · circle ${size}×${size} → ${node.id} (배경색: ${block.bgColor})`);
      } else {
        run('set_fill_color', { nodeId: node.id, color: TRANSPARENT });
        const _ck = run('create_node_from_svg', { svg: checkerSvg(size, size, true), parentId: node.id, x: 0, y: 0 }, { timeout: 12000 });
        if (_ck) run('resize_node', { nodeId: _ck.id, width: size, height: size });
        console.log(`      · circle ${size}×${size} → ${node.id} (빈 원 체커)`);
      }
    }
    return size;
  }

  // ── TABLE (table-block) ────────────────────────────────────────
  if (block.type === 'table') {
    const rows      = block.rows || [];
    const tblW      = availableWidth;
    const tblH      = block.height || (rows.length * 60) || 200;
    const fontSize  = block.fontSize || 28;
    const lineColor = block.lineColor || '#cccccc';
    const headerBg  = block.headerBg  || '#f0f0f0';
    const textColor = block.textColor || '#222222';

    // 데이터 없으면 기존 플레이스홀더로 폴백
    if (!rows.length) {
      const node = run('create_frame', { x, y, width: tblW, height: tblH, name: `table_${block.id}`, parentId });
      if (node) run('set_fill_color', { nodeId: node.id, color: { r: 0.95, g: 0.95, b: 0.95, a: 1 } });
      return tblH;
    }

    const wrap = run('create_frame', { x, y, width: tblW, height: tblH, name: `table_${block.id}`, parentId });
    if (!wrap) return tblH;
    run('set_fill_color', { nodeId: wrap.id, color: { r: 1, g: 1, b: 1, a: 0 } });

    const font  = loadFontSafe(block.fontFamily || 'Pretendard', 'Regular');
    const fontB = loadFontSafe(block.fontFamily || 'Pretendard', 'Bold');
    const rowH  = Math.floor(tblH / rows.length);

    rows.forEach((row, ri) => {
      const ry       = ri * rowH;
      const thisRowH = (ri === rows.length - 1) ? (tblH - ry) : rowH;
      const isHeader = block.showHeader && row.header;

      const rowFrame = run('create_frame', { x: 0, y: ry, width: tblW, height: thisRowH, name: `trow_${ri}`, parentId: wrap.id });
      if (!rowFrame) return;
      run('set_fill_color', { nodeId: rowFrame.id, color: isHeader ? hex(headerBg) : { r: 1, g: 1, b: 1, a: 0 } });

      // 하단 수평선
      if (block.showHLines && ri < rows.length - 1) {
        const line = run('create_frame', { x: 0, y: thisRowH - 1, width: tblW, height: 1, name: `hline_${ri}`, parentId: rowFrame.id });
        if (line) run('set_fill_color', { nodeId: line.id, color: hex(lineColor) });
      }

      const cells = row.cells || [];
      const cw = cells.length ? Math.floor(tblW / cells.length) : tblW;
      cells.forEach((cell, ci) => {
        const cx = ci * cw;
        if (block.showVLines && ci > 0) {
          const vline = run('create_frame', { x: cx, y: 0, width: 1, height: thisRowH, name: `vline_${ri}_${ci}`, parentId: rowFrame.id });
          if (vline) run('set_fill_color', { nodeId: vline.id, color: hex(lineColor) });
        }
        if (cell.text) {
          // 셀별 live computed 색/weight/fontSize 우선(회차12 table fix: 값 파랑·800·강조56 반영), 없으면 테이블 레벨 폴백
          const cellFs     = cell.fontSize || fontSize;
          const cellWeight = cell.weight || (isHeader ? 700 : 400);
          const cellColor  = cell.color || textColor;
          const cellFont   = loadFontSafe(block.fontFamily || 'Pretendard', toFigmaFontStyle(cellWeight));
          const tn = run('create_text', {
            x: cx + 8, y: Math.max(0, Math.round((thisRowH - cellFs * 1.3) / 2)),
            width: cw - 16, text: cell.text,
            fontSize: cellFs, fontWeight: cellWeight,
            fontColor: hex(cellColor),
            textAlignHorizontal: toFigmaAlign(cell.align || 'center'),
            textAutoResize: 'HEIGHT', name: `tcell_${ri}_${ci}`, parentId: rowFrame.id,
          });
          if (tn) run('set_font_name', { nodeId: tn.id, family: cellFont.family, style: cellFont.style });
        }
      });
    });
    console.log(`      · table ${block.colCount}열×${rows.length}행 → ${wrap.id}`);
    return tblH;
  }

  // ── CHAT (chat-block) ──────────────────────────────────────────
  if (block.type === 'chat') {
    const msgs     = block.messages || [];
    const fontSize = block.fontSize || 32;
    const radius   = block.radius   || 16;
    const gap      = (block.gap != null) ? block.gap : 46;  // builder가 실측 버블간 간격 emit (없으면 46)
    // goditor .chb-bubble 실측: 패딩 40(전방향)·lineHeight ×1.5 (회차12 p6bwvy9 — 기존 14/10·×1.4는 버블 압축돼 수직오프셋 유발).
    const padH = 40, padV = 40;
    const lineH = Math.round(fontSize * 1.5);
    const sidePad = 47;                            // goditor .chat-block padding 실측
    const rowW = availableWidth - sidePad * 2;     // 실제 메시지 행 너비(~766)
    const maxBubbleW = Math.round(rowW * 0.70);    // .chb-wrap maxWidth:70%
    const innerMaxW  = maxBubbleW - padH * 2;
    const charW = fontSize * 0.92;

    const wrap = run('create_frame', { x, y, width: availableWidth, height: block.height || 10, name: `chat_${block.id}`, parentId });
    if (!wrap) return block.height || 0;
    run('set_fill_color', { nodeId: wrap.id, color: { r: 1, g: 1, b: 1, a: 0 } });

    const font = loadFontSafe(block.fontFamily || 'Pretendard', 'Regular');
    let cy = block.topPad || 0;  // goditor chat-block 상단 패딩 실측 반영
    msgs.forEach((m, mi) => {
      const isLeft = m.align !== 'right';
      const bg    = isLeft ? (block.bgLeft || '#e5e5ea')   : (block.bgRight || '#1888fe');
      const color = isLeft ? (block.colorLeft || '#111111') : (block.colorRight || '#ffffff');
      const textLines = String(m.text || '').split('\n');
      let lineCount = 0, longest = 0;
      textLines.forEach(ln => {
        const w = ln.length * charW;
        longest = Math.max(longest, Math.min(w, innerMaxW));
        lineCount += Math.max(1, Math.ceil(w / innerMaxW));
      });
      const bubbleW = (m.w && m.w > 0) ? m.w : Math.min(maxBubbleW, Math.round(longest) + padH * 2);
      const bubbleH = (m.h && m.h > 0) ? m.h : (lineCount * lineH + padV * 2);
      const bx = isLeft ? sidePad : (availableWidth - sidePad - bubbleW);
      const bubble = run('create_frame', { x: bx, y: cy, width: bubbleW, height: bubbleH, name: `bubble_${mi}`, parentId: wrap.id });
      if (bubble) {
        run('set_fill_color', { nodeId: bubble.id, color: hex(bg) });
        run('set_corner_radius', { nodeId: bubble.id, radius });
        const tn = run('create_text', {
          x: padH, y: padV, width: bubbleW - padH * 2,
          text: m.text || '', fontSize, fontWeight: 400, fontColor: hex(color),
          textAlignHorizontal: 'LEFT', textAutoResize: 'HEIGHT',
          name: `bubbletext_${mi}`, parentId: bubble.id,
        });
        if (tn) run('set_font_name', { nodeId: tn.id, family: font.family, style: font.style });
      }
      cy += bubbleH + gap;
    });
    console.log(`      · chat ${msgs.length}말풍선 → ${wrap.id}`);
    return block.height || cy;
  }

  // ── IMAGE ─────────────────────────────────────────────────────
  if (block.type === 'image') {
    const s      = block.style || {};
    const imgH   = block.height || 400;
    const padX   = block.padX  || 0;
    const effectiveW = availableWidth - padX * 2;
    const sizePct = block.sizePct || 100;
    const imgW   = Math.round(effectiveW * sizePct / 100);
    const imgX   = x + padX + Math.round((effectiveW - imgW) / 2);

    const node = run('create_frame', {
      x: imgX, y,
      width:  imgW,
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
        // 빈 슬롯 = goditor 체커보드 placeholder를 Figma에도 체커로(회차12 현빈 B결정)
        run('set_fill_color', { nodeId: node.id, color: { r: 1, g: 1, b: 1, a: 0 } });
        const _ck = run('create_node_from_svg', { svg: checkerSvg(availableWidth, imgH, false), parentId: node.id, x: 0, y: 0 }, { timeout: 12000 });
        if (_ck) run('resize_node', { nodeId: _ck.id, width: Math.round(availableWidth), height: Math.round(imgH) });
        console.log(`      · image ${availableWidth}×${imgH} → ${node.id} (빈 슬롯 체커)`);
      }
      if ((s.borderRadius || 0) > 0)
        run('set_corner_radius', { nodeId: node.id, radius: s.borderRadius });

      // ── 오버레이 렌더링 ──
      if (block.overlayOn && node) {
        const opacity = typeof block.overlayBg === 'number' ? block.overlayBg : 0.35;
        const ovRect = run('create_frame', {
          x: imgX, y,
          width: imgW, height: imgH,
          name: `overlay_bg_${block.id}`,
          parentId,
        });
        if (ovRect) {
          run('set_fill_color', { nodeId: ovRect.id, color: { r: 0, g: 0, b: 0, a: opacity } });
        }

        if (block.overlayText) {
          const hexToRgb = hex => {
            const m = (hex || '#ffffff').replace('#','').match(/.{2}/g);
            return m ? { r: parseInt(m[0],16)/255, g: parseInt(m[1],16)/255, b: parseInt(m[2],16)/255, a: 1 } : { r:1, g:1, b:1, a:1 };
          };
          const textColor = hexToRgb(block.overlayColor);
          run('create_text', {
            x: imgX + 24, y: y + Math.round(imgH / 2) - 24,
            width: imgW - 48,
            text: block.overlayText,
            fontSize: 32,
            fontColor: textColor,
            name: `overlay_text_${block.id}`,
            parentId,
          });
        }
        console.log(`      · overlay → opacity:${opacity}, text:"${block.overlayText?.slice(0,20) || ''}"`);
      }
    }
    return imgH;
  }

  // ── CARD-GRID ─────────────────────────────────────────────────────
  if (block.type === 'card-grid') {
    const { cards = [], gridCols = 2, cardGap = 10, canvasH = 400,
            radius = 16, textBg = '#cccccc', titleSize = 32, descSize = 20,
            textAlign = 'center', imgRatio = 75, cardMode = 'simple',
            labelPos = 'below', overlayHeight = 180, gradientBg = '' } = block;
    const isOverlay = labelPos === 'overlay-bottom';

    const padX      = block.padX || 0;
    const effectiveW = availableWidth - padX * 2;
    const totalGap  = cardGap * (gridCols - 1);
    const cardW     = Math.floor((effectiveW - totalGap) / gridCols);
    const cardH     = block.height || canvasH;
    const imgH      = (cardMode !== 'text-only' && imgRatio > 0) ? Math.round(cardH * imgRatio / 100) : 0;
    const labelH    = cardH - imgH;

    // 래퍼 프레임 (투명)
    const wrapper = run('create_frame', { x: x + padX, y, width: effectiveW, height: cardH, name: `card-grid_${block.id}`, parentId });
    if (!wrapper) return cardH;
    run('set_fill_color', { nodeId: wrapper.id, color: { r: 1, g: 1, b: 1, a: 0 } });

    const gridRows = Math.ceil(cards.length / gridCols);
    const rowH = Math.floor(cardH / gridRows);

    cards.forEach((card, i) => {
      // 빈 placeholder 카드(기본 "카드 제목"·desc/img/icon/셀색 전무)는 goditor가 숨김 → skip(Figma에 placeholder 텍스트 안 띄움)
      const _isPlaceholder = (!card.title || card.title === '카드 제목')
        && !card.desc && !card.imgSrc && !(card.icon && card.icon.svg) && !card.cellBg;
      if (_isPlaceholder) return;
      const col  = i % gridCols;
      const row  = Math.floor(i / gridCols);
      const cardX = col * (cardW + cardGap);
      const cardY = row * rowH;
      const thisH = (row === gridRows - 1) ? cardH - cardY : rowH;
      const thisImgH   = isOverlay ? thisH : Math.round(thisH * imgRatio / 100);
      const thisLabelH = isOverlay ? thisH : thisH - thisImgH;

      // 카드 outer 프레임 (투명 배경, 전체 radius)
      const cardFrame = run('create_frame', { x: cardX, y: cardY, width: cardW, height: thisH, name: `card_${i}`, parentId: wrapper.id });
      if (!cardFrame) return;
      run('set_fill_color', { nodeId: cardFrame.id, color: { r: 1, g: 1, b: 1, a: 0 } });
      if (radius > 0) run('set_corner_radius', { nodeId: cardFrame.id, radius });

      // 상단 영역: 이미지(있으면) / 아이콘(SVG) / 둘 다 없으면 생략
      const isIconCard = !card.imgSrc && card.icon && card.icon.svg;
      if (thisImgH > 0) {
        if (card.imgSrc) {
          const imgFrame = run('create_frame', { x: 0, y: 0, width: cardW, height: thisImgH, name: `card_img_${i}`, parentId: cardFrame.id });
          if (imgFrame) {
            run('set_fill_color', { nodeId: imgFrame.id, color: { r: 0.84, g: 0.84, b: 0.84, a: 1 } });
            const st = card.imgSrc.startsWith('data:') ? 'base64' : 'url';
            const src = card.imgSrc.startsWith('data:') ? card.imgSrc.split(',')[1] : card.imgSrc;
            run('set_image_fill', { nodeId: imgFrame.id, imageSource: src, sourceType: st, scaleMode: 'FILL' }, { timeout: 15000 });
          }
        } else if (isIconCard) {
          // goditor 아이콘 카드: 투명 배경 + 중앙 아이콘. SVG의 currentColor를 iconColor로 치환해 색 반영.
          // iconMode=true면 블록 iconColor가 카드별 색을 덮음(goditor 동작) → 블록 우선.
          const iconColor = (block.iconColor && block.iconColor !== 'transparent') ? block.iconColor
                          : (card.iconColor && card.iconColor !== 'transparent') ? card.iconColor : '#222222';
          const svg = String(card.icon.svg).replace(/currentColor/g, iconColor);
          const iconSize = Math.max(24, Math.round(Math.min(cardW, thisImgH) * 0.42));
          const ix = Math.round((cardW - iconSize) / 2);
          const iy = Math.round((thisImgH - iconSize) / 2);
          const iconNode = run('create_node_from_svg', { svg, parentId: cardFrame.id, x: ix, y: iy }, { timeout: 12000 });
          if (iconNode) run('resize_node', { nodeId: iconNode.id, width: iconSize, height: iconSize });
        }
      }

      // 라벨(텍스트) 영역 — overlay-bottom 모드면 하단 그라데이션 + 전체높이 투명 라벨,
      // 아니면(simple) 아이콘카드는 투명, 아니면 cellBg||textBg
      let labelFrame;
      if (isOverlay) {
        const ovH = Math.round(thisH * overlayHeight / canvasH);
        const gradFrame = run('create_frame', { x: 0, y: thisH - ovH, width: cardW, height: ovH, name: `card_overlay_${i}`, parentId: cardFrame.id });
        if (gradFrame) {
          // 진짜 세로 linear-gradient(transparent→rgba(0,0,0,0.85)) 적용. 플러그인 set_gradient 지원.
          const gradRes = run('set_gradient', {
            nodeId: gradFrame.id,
            type: 'GRADIENT_LINEAR',
            stops: [
              { position: 0, color: { r: 0, g: 0, b: 0, a: 0 } },
              { position: 1, color: { r: 0, g: 0, b: 0, a: 0.85 } },
            ],
            // 세로(위→아래) 방향: y축을 따라 0→1
            gradientTransform: [[0, 1, 0], [-1, 0, 1]],
          });
          // 그라데이션 실패 시 반투명 검정 단색 폴백
          if (!gradRes) run('set_fill_color', { nodeId: gradFrame.id, color: { r: 0, g: 0, b: 0, a: 0.5 } });
        }
        labelFrame = run('create_frame', { x: 0, y: 0, width: cardW, height: thisH, name: `card_label_${i}`, parentId: cardFrame.id });
        if (labelFrame) run('set_fill_color', { nodeId: labelFrame.id, color: { r: 1, g: 1, b: 1, a: 0 } });
      } else {
        const labelBg = card.cellBg || (isIconCard ? '' : textBg);
        labelFrame = run('create_frame', { x: 0, y: thisImgH, width: cardW, height: thisLabelH, name: `card_label_${i}`, parentId: cardFrame.id });
        if (labelFrame) {
          if (labelBg) run('set_fill_color', { nodeId: labelFrame.id, color: hex(labelBg) });
          else run('set_fill_color', { nodeId: labelFrame.id, color: { r: 1, g: 1, b: 1, a: 0 } });
        }
      }
      if (!labelFrame) return;

      // 텍스트 색: 라벨 배경 명도 기준(어두우면 흰색, 밝으면 goditor 기본 #222/#888)
      // overlay-bottom 모드는 하단이 검정 그라데이션 → 무조건 어두운 배경으로 취급(흰 텍스트)
      const _lum = (() => { const b = isOverlay ? '#000000' : (card.cellBg || (isIconCard ? '' : textBg)); if (!b || !/^#/.test(b)) return 1;
        const h = b.replace('#',''); const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),bl=parseInt(h.slice(4,6),16);
        return (0.299*r + 0.587*g + 0.114*bl) / 255; })();
      const titleColor = block.titleColor || (_lum < 0.5 ? '#ffffff' : '#222222');
      const descColor  = block.descColor  || (_lum < 0.5 ? '#dddddd' : '#888888');

      // 텍스트 세로 중앙 정렬 (padding 10px 상하, 14px 좌우)
      const padH = 14;
      const padV = 10;
      const textW = cardW - padH * 2;
      const hasDesc = !!card.desc;
      // 제목 줄바꿈 추정(한글 ≈ 1em/글자) → desc가 제목 2번째 줄과 겹치지 않게 스택.
      const titleLines = card.title ? Math.max(1, Math.ceil((card.title.length * titleSize * 0.95) / Math.max(1, textW))) : 0;
      const titleBlockH = titleLines * Math.round(titleSize * 1.45);
      const totalTextH = titleBlockH + (hasDesc ? 4 + descSize * 1.45 : 0);
      const textStartY = isOverlay
        ? Math.round(thisH * (canvasH - overlayHeight + 10) / canvasH)
        : Math.max(padV, Math.round((thisLabelH - totalTextH) / 2));

      if (card.title) {
        const titleFont = loadFontSafe('Noto Sans KR', 'Bold');
        const titleNode = run('create_text', {
          x: padH, y: textStartY,
          width: textW,
          text: card.title,
          fontSize: titleSize,
          fontWeight: 600,
          fontColor: hex(titleColor),
          textAlignHorizontal: toFigmaAlign(textAlign),
          textAutoResize: 'HEIGHT',
          name: `card_title_${i}`,
          parentId: labelFrame.id,
        });
        if (titleNode) run('set_font_name', { nodeId: titleNode.id, family: titleFont.family, style: titleFont.style });
      }

      if (hasDesc) {
        const descFont = loadFontSafe('Noto Sans KR', 'Regular');
        const descNode = run('create_text', {
          x: padH, y: textStartY + titleBlockH + 4,
          width: textW,
          text: card.desc,
          fontSize: descSize,
          fontWeight: 400,
          fontColor: hex(descColor),
          textAlignHorizontal: toFigmaAlign(textAlign),
          textAutoResize: 'HEIGHT',
          name: `card_desc_${i}`,
          parentId: labelFrame.id,
        });
        if (descNode) run('set_font_name', { nodeId: descNode.id, family: descFont.family, style: descFont.style });
      }
    });

    console.log(`      · card-grid ${gridCols}열 ${cards.length}장 (${cardW}×${cardH}px/card) → ${wrapper.id}`);
    return cardH;
  }

  // ── ICON (icon-block) : SVG 아이콘 (id 추적 위해 named 프레임으로 감쌈) ──
  if (block.type === 'icon') {
    const size = block.size || 48;
    const ix = x + Math.round((availableWidth - size) / 2);
    const wrap = run('create_frame', { x: ix, y, width: size, height: size, name: `icon_${block.id || ''}`, parentId });
    if (wrap) run('set_fill_color', { nodeId: wrap.id, color: { r: 1, g: 1, b: 1, a: 0 } });
    if (block.svg && wrap) {
      const color = (block.color && block.color !== 'transparent') ? block.color : '#000000';
      const svg = String(block.svg).replace(/currentColor/g, color);
      const node = run('create_node_from_svg', { svg, parentId: wrap.id, x: 0, y: 0 }, { timeout: 12000 });
      if (node) run('resize_node', { nodeId: node.id, width: size, height: size });
    }
    return block.height || size;
  }

  // ── DIVIDER (divider-block) : 선 ──
  if (block.type === 'divider') {
    const weight = block.weight || 1;
    const padV = block.padV || 0;
    let lineW, lineH;
    if (block.dir === 'vertical') { lineW = weight; lineH = block.lineLength || 100; }
    else { lineW = Math.round(availableWidth * (block.lineLength || 100) / 100); lineH = weight; }
    const lx = x + Math.round((availableWidth - lineW) / 2);
    const ly = y + padV;
    const line = run('create_frame', { x: lx, y: ly, width: Math.max(1, lineW), height: Math.max(1, lineH), name: `divider_${block.id || ''}`, parentId });
    if (line) run('set_fill_color', { nodeId: line.id, color: hex(block.color || '#cccccc') });
    return block.height || (padV * 2 + lineH);
  }

  // ── SHAPE (shape-block) : 도형(선/화살표/사각/원/다각형/별) — 회차12 fix: 회색박스→실제 SVG도형+회전 ──
  if (block.type === 'shape') {
    const w = Math.max(1, block.width || 75), h = Math.max(1, block.height || 75);
    const type = block.shapeType || 'rectangle';
    const color = block.color || '#cccccc';
    const sw = Number(block.strokeWidth) || 0;        // viewBox user-space 단위 (goditor와 동일)
    const rot = Number(block.rotation) || 0;          // deg, transform-origin center
    const half = sw / 2;
    const inset = Math.max(0, 100 - sw);
    const rr = Math.max(0, 50 - half);
    const DEFS = {
      rectangle: { vb: '0 0 100 100', fill: true,  inner: `<rect x="${half}" y="${half}" width="${inset}" height="${inset}"/>` },
      ellipse:   { vb: '0 0 100 100', fill: true,  inner: `<ellipse cx="50" cy="50" rx="${rr}" ry="${rr}"/>` },
      line:      { vb: '0 0 200 40',  fill: false, inner: `<line x1="10" y1="20" x2="190" y2="20" stroke-linecap="round"/>` },
      arrow:     { vb: '0 0 200 40',  fill: false, inner: `<line x1="10" y1="20" x2="172" y2="20" stroke-linecap="round"/><polygon points="170,10 194,20 170,30" fill="${color}" stroke="none"/>` },
      polygon:   { vb: '0 0 200 180', fill: true,  inner: `<polygon points="100,8 194,172 6,172"/>` },
      star:      { vb: '0 0 200 190', fill: true,  inner: `<polygon points="100,8 122,70 188,70 135,110 155,172 100,132 45,172 65,110 12,70 78,70"/>` },
    };
    const def = DEFS[type] || DEFS.rectangle;
    const [vbW, vbH] = def.vb.split(/\s+/).slice(2).map(Number);
    const cxv = vbW / 2, cyv = vbH / 2;
    const styleAttr = `color:${color};stroke-width:${sw};fill:${def.fill ? color : 'none'};stroke:${color};`;
    const gOpen = rot ? `<g transform="rotate(${rot} ${cxv} ${cyv})">` : '';
    const gClose = rot ? `</g>` : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${def.vb}" preserveAspectRatio="none" style="${styleAttr}">${gOpen}${def.inner}${gClose}</svg>`;
    const wrap = run('create_frame', { x, y, width: w, height: h, name: `shape_${block.id || ''}`, parentId });
    if (wrap) {
      run('set_fill_color', { nodeId: wrap.id, color: { r: 1, g: 1, b: 1, a: 0 } });
      const node = run('create_node_from_svg', { svg, parentId: wrap.id, x: 0, y: 0 }, { timeout: 12000 });
      if (node) run('resize_node', { nodeId: node.id, width: w, height: h });
    }
    return h;
  }

  // ── GRAPH (graph-block) : line/area=면적꺾은선, bar=막대 ──
  if (block.type === 'graph') {
    const items = block.items || [];
    const gh = block.height || 300;
    const gw = (block.width && block.width > 0 && block.width <= availableWidth) ? block.width : availableWidth;  // goditor 그래프 실폭(중앙정렬) — 회차12 80 차트 가로스케일 fix
    const gx = x + Math.round((availableWidth - gw) / 2);
    const wrap = run('create_frame', { x: gx, y, width: gw, height: gh, name: `graph_${block.id || ''}`, parentId });
    if (wrap) run('set_fill_color', { nodeId: wrap.id, color: { r: 1, g: 1, b: 1, a: 0 } });
    if (wrap && items.length) {
      const n = items.length;
      const maxV = Math.max(...items.map(it => Number(it.value) || 0), 1);
      const font = loadFontSafe('Pretendard', 'Regular');
      const fontB = loadFontSafe('Pretendard', 'Bold');
      const isLine = (block.chartType === 'line' || block.chartType === 'area');
      const valH = 44, labH = 50;
      const plotTop = valH, plotH = Math.max(20, gh - valH - labH);
      if (isLine) {
        // 면적+꺾은선+점 (SVG), 값/축 라벨은 Figma 텍스트
        const padX = 60;  // goditor graph 내부 좌우 패딩 실측(회차12 80) — 30이면 plot이 더 넓어 점 퍼짐
        const plotW = gw - padX * 2;
        const xs = items.map((it, i) => padX + (n > 1 ? i * (plotW / (n - 1)) : plotW / 2));
        const ys = items.map(it => plotTop + plotH * (1 - (Number(it.value) || 0) / maxV));
        const base = plotTop + plotH;
        const linePts = xs.map((x, i) => `${Math.round(x)},${Math.round(ys[i])}`).join(' ');
        const areaPts = `${Math.round(xs[0])},${base} ${linePts} ${Math.round(xs[n - 1])},${base}`;
        const dots = xs.map((x, i) => `<circle cx="${Math.round(x)}" cy="${Math.round(ys[i])}" r="7" fill="#ffffff"/>`).join('');
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${gw}" height="${gh}" viewBox="0 0 ${gw} ${gh}">`
          + `<polygon points="${areaPts}" fill="#666666" fill-opacity="0.45"/>`
          + `<polyline points="${linePts}" fill="none" stroke="#e0e0e0" stroke-width="3" stroke-linejoin="round"/>`
          + dots + `</svg>`;
        const node = run('create_node_from_svg', { svg, parentId: wrap.id, x: 0, y: 0 }, { timeout: 15000 });
        if (node) run('resize_node', { nodeId: node.id, width: gw, height: gh });
        items.forEach((it, i) => {
          const vn = run('create_text', { x: Math.round(xs[i] - 60), y: Math.max(0, Math.round(ys[i]) - 40), width: 120, text: String(it.value), fontSize: 24, fontWeight: 700, fontColor: hex('#ffffff'), textAlignHorizontal: 'CENTER', textAutoResize: 'HEIGHT', name: `gval_${i}`, parentId: wrap.id });
          if (vn) run('set_font_name', { nodeId: vn.id, family: fontB.family, style: fontB.style });
          const ln = run('create_text', { x: Math.round(xs[i] - 60), y: base + 12, width: 120, text: String(it.label || ''), fontSize: 22, fontWeight: 400, fontColor: hex('#888888'), textAlignHorizontal: 'CENTER', textAutoResize: 'HEIGHT', name: `glbl_${i}`, parentId: wrap.id });
          if (ln) run('set_font_name', { nodeId: ln.id, family: font.family, style: font.style });
        });
      } else {
        const gap = 24;
        const barW = Math.max(8, Math.floor((gw - gap * (n + 1)) / n));
        items.forEach((it, i) => {
          const bx = gap + i * (barW + gap);
          const v = Number(it.value) || 0;
          const bh = Math.max(2, Math.round(plotH * v / maxV));
          const by = plotTop + (plotH - bh);
          const bar = run('create_frame', { x: bx, y: by, width: barW, height: bh, name: `bar_${i}`, parentId: wrap.id });
          if (bar) { run('set_fill_color', { nodeId: bar.id, color: hex('#555555') }); run('set_corner_radius', { nodeId: bar.id, radius: 6 }); }
          const vn = run('create_text', { x: bx, y: Math.max(0, plotTop - 34), width: barW, text: String(it.value), fontSize: 24, fontWeight: 700, fontColor: hex('#ffffff'), textAlignHorizontal: 'CENTER', textAutoResize: 'HEIGHT', name: `gval_${i}`, parentId: wrap.id });
          if (vn) run('set_font_name', { nodeId: vn.id, family: fontB.family, style: fontB.style });
          const ln = run('create_text', { x: bx, y: plotTop + plotH + 12, width: barW, text: String(it.label || ''), fontSize: 22, fontWeight: 400, fontColor: hex('#888888'), textAlignHorizontal: 'CENTER', textAutoResize: 'HEIGHT', name: `glbl_${i}`, parentId: wrap.id });
          if (ln) run('set_font_name', { nodeId: ln.id, family: font.family, style: font.style });
        });
      }
    }
    return gh;
  }

  // ── STEP (step-block) : 흰 카드 + 원형 번호badge + 제목/설명 ──
  if (block.type === 'step') {
    const st = (block.steps && block.steps[0]) || {};
    const numSize = block.numSize || 50;
    const h = block.height || 80;
    const padX = 24, badgeGap = block.badgeGap || 20;
    const card = run('create_frame', { x, y, width: availableWidth, height: h, name: `step_${block.id || ''}`, parentId });
    if (!card) return h;
    run('set_fill_color', { nodeId: card.id, color: hex(block.cardBg || '#ffffff') });
    run('set_corner_radius', { nodeId: card.id, radius: 16 });
    const fontB = loadFontSafe('Pretendard', 'Bold');
    const font = loadFontSafe('Pretendard', 'Regular');
    // 번호 badge
    const by = Math.round((h - numSize) / 2);
    const badge = run('create_frame', { x: padX, y: by, width: numSize, height: numSize, name: 'step_badge', parentId: card.id });
    if (badge) {
      run('set_fill_color', { nodeId: badge.id, color: hex(block.numBg || '#222222') });
      run('set_corner_radius', { nodeId: badge.id, radius: Math.round(numSize / 2) });
      const numStr = block.badgeFormat === 'padded' ? String(block.startNumber).padStart(2, '0') : String(block.startNumber);
      const nfs = Math.round(numSize * 0.4);
      const nn = run('create_text', { x: 0, y: Math.round((numSize - nfs * 1.3) / 2), width: numSize, text: numStr, fontSize: nfs, fontWeight: 700, fontColor: hex(block.numColor || '#ffffff'), textAlignHorizontal: 'CENTER', textAutoResize: 'NONE', name: 'step_num', parentId: badge.id });
      if (nn) run('set_font_name', { nodeId: nn.id, family: fontB.family, style: fontB.style });
    }
    // 제목/설명
    const tx = padX + numSize + badgeGap;
    const tw = Math.max(40, availableWidth - tx - padX);
    const titleLines = Math.max(1, String(st.title || '').split('\n').length);
    const titleH = titleLines * (block.titleSize || 36) * 1.4;
    const hasDesc = !!st.desc;
    const totalTextH = titleH + (hasDesc ? (block.descSize || 24) * 1.4 + 4 : 0);
    let ty = Math.max(0, Math.round((h - totalTextH) / 2));
    if (st.title) {
      const tn = run('create_text', { x: tx, y: ty, width: tw, text: st.title, fontSize: block.titleSize || 36, fontWeight: 700, fontColor: hex(block.titleColor || '#222222'), textAlignHorizontal: 'LEFT', textAutoResize: 'HEIGHT', name: 'step_title', parentId: card.id });
      if (tn) run('set_font_name', { nodeId: tn.id, family: fontB.family, style: fontB.style });
    }
    if (hasDesc) {
      const dn = run('create_text', { x: tx, y: ty + Math.round(titleH) + 4, width: tw, text: st.desc, fontSize: block.descSize || 24, fontWeight: 400, fontColor: hex(block.descColor || '#888888'), textAlignHorizontal: 'LEFT', textAutoResize: 'HEIGHT', name: 'step_desc', parentId: card.id });
      if (dn) run('set_font_name', { nodeId: dn.id, family: font.family, style: font.style });
    }
    return h;
  }

  // ── BANNER02 (banner02-block) : 라운드 컬러박스 + 좌측 텍스트스택 + 우측 이미지 ──
  if (block.type === 'banner02') {
    const bw = block.bannerW || 780, bh = block.bannerH || 260;
    const bx = x + Math.max(0, Math.round((availableWidth - bw) / 2));
    const frame = run('create_frame', { x: bx, y, width: bw, height: bh, name: `banner02_${block.id || ''}`, parentId });
    if (!frame) return block.height || bh;
    run('set_fill_color', { nodeId: frame.id, color: hex(block.bg || '#1a1f3d') });
    if (block.radius) run('set_corner_radius', { nodeId: frame.id, radius: block.radius });
    // 우측 이미지(또는 플레이스홀더)
    if (block.imgW > 0) {
      const imgF = run('create_frame', { x: block.imgX || 0, y: block.imgY || 0, width: block.imgW, height: block.imgH, name: 'banner_img', parentId: frame.id });
      if (imgF) {
        run('set_corner_radius', { nodeId: imgF.id, radius: 12 });
        if (block.imgSrc) {
          // 이미지 있을 때만 회색 베이스(로드 전) 후 이미지 적용. 빈 슬롯은 투명(goditor 체커보드 숨김 일치).
          run('set_fill_color', { nodeId: imgF.id, color: { r: 0.84, g: 0.84, b: 0.84, a: 1 } });
          const st = block.imgSrc.startsWith('data:') ? 'base64' : 'url';
          const src = block.imgSrc.startsWith('data:') ? block.imgSrc.split(',')[1] : block.imgSrc;
          run('set_image_fill', { nodeId: imgF.id, imageSource: src, sourceType: st, scaleMode: 'FILL' }, { timeout: 15000 });
        } else {
          run('set_fill_color', { nodeId: imgF.id, color: { r: 1, g: 1, b: 1, a: 0 } });
        }
      }
    }
    // 좌측 텍스트 스택
    const fontR = loadFontSafe('Pretendard', 'Regular');
    const fontB = loadFontSafe('Pretendard', 'Bold');
    let cy = block.textY || 35;
    const tw = block.textW || (bw - (block.textX || 36) - 40);
    for (const ln of (block.lines || [])) {
      cy += ln.gapTop || 0;
      const fnt = (ln.weight >= 600 || ln.kind === 'title') ? fontB : fontR;
      const tn = run('create_text', { x: block.textX || 36, y: Math.round(cy), width: tw, text: ln.text, fontSize: ln.size || 16, fontWeight: (ln.weight >= 600 || ln.kind === 'title') ? 700 : 400, fontColor: hex(ln.color || '#ffffff'), textAlignHorizontal: 'LEFT', textAutoResize: 'HEIGHT', name: `banner_${ln.kind || 'line'}`, parentId: frame.id });
      if (tn) run('set_font_name', { nodeId: tn.id, family: fnt.family, style: fnt.style });
      const lc = Math.max(1, String(ln.text || '').split('\n').length);
      cy += lc * (ln.size || 16) * 1.35;
    }
    return block.height || bh;
  }

  // ── COMPARISON (comparison-block) : 2열 비교 카드(헤더+행, featured 강조) ──
  // goditor comparison-block.js 레이아웃과 일치: featured열 폭=baseW×featScale, 인접칼럼 overlap 겹침,
  // featured는 header/row/gap·폰트 ×featScale, muted bg=#e9ebef(회차12 imac 실측 rgb233,235,239), 공통 중심선 정렬.
  if (block.type === 'comparison') {
    const cols = block.cols || [];
    const N = cols.length || 2;
    const compW = Math.min(block.compW || 720, availableWidth);
    const cx = x + Math.round((availableWidth - compW) / 2);
    const padX = Math.max(0, block.padX || 0);              // goditor .comparison padding (회차12 z8lg3v4)
    const contentW = Math.max(120, compW - padX * 2);
    const headerH = block.headerH || 72, rowH = block.rowH || 74, rowGap = block.rowGap || 12;
    const nRows = Math.max(0, ...cols.map(c => (c.rows || []).length));
    const featScale = block.featScale || 1.2;
    const overlap = block.overlap || 32;
    const baseW = Math.round((contentW + overlap * (N - 1)) / ((N - 1) + featScale));
    const featW = Math.round(baseW * featScale);
    const titleFont = block.titleFont || 38, rowFont = block.rowFont || 32;
    // 행별 높이: 이미지행(체커보드 빈슬롯 포함)은 rowHeights[ri] 예약해야 후속 텍스트행 정렬 일치(회차12 z8lg3v4)
    const rowHeights = Array.isArray(block.rowHeights) ? block.rowHeights : [];
    const baseRowH = (ri) => { const o = Number(rowHeights[ri]); return (Number.isFinite(o) && o > 0) ? o : rowH; };
    const colHeightOf = (isFeat) => {
      const hH = isFeat ? Math.round(headerH * featScale) : headerH;
      const gap = isFeat ? Math.round(rowGap * featScale) : rowGap;
      let acc = hH;
      for (let ri = 0; ri < nRows; ri++) acc += (isFeat ? Math.round(baseRowH(ri) * featScale) : baseRowH(ri)) + gap;
      return acc + 20;
    };
    const featColH = colHeightOf(true);
    const totalH = block.height || featColH;
    const fontB = loadFontSafe('Pretendard', 'Bold');
    const wrap = run('create_frame', { x: cx, y, width: compW, height: totalH, name: `comparison_${block.id || ''}`, parentId });
    if (!wrap) return totalH;
    run('set_fill_color', { nodeId: wrap.id, color: { r: 1, g: 1, b: 1, a: 0 } });
    // 인접 칼럼 overlap 겹침 → x를 (폭-overlap)씩 누적. featured(보통 마지막)가 나중 생성돼 위로 올라옴.
    let colX = padX;
    cols.forEach((col, i) => {
      const isFeat = i === block.featured;
      const sc = isFeat ? featScale : 1;
      const cw = isFeat ? featW : baseW;
      const ch = colHeightOf(isFeat);
      const colY = Math.round((featColH - ch) / 2);
      const hH = Math.round(headerH * sc), rH = Math.round(rowH * sc), gap = Math.round(rowGap * sc);
      const tFont = Math.round(titleFont * sc), rFont = Math.round(rowFont * sc);
      const card = run('create_frame', { x: colX, y: colY, width: cw, height: ch, name: `cmp_col_${i}`, parentId: wrap.id });
      if (card) {
        run('set_fill_color', { nodeId: card.id, color: hex(col.bg || (isFeat ? '#ffffff' : '#e9ebef')) });
        run('set_corner_radius', { nodeId: card.id, radius: block.radius || 20 });
        const titleColor = isFeat ? '#111111' : '#999999';
        const rowColor = isFeat ? '#222222' : '#aaaaaa';
        const ht = run('create_text', { x: 0, y: Math.round((hH - tFont) / 2) + 8, width: cw, text: col.title || '', fontSize: tFont, fontWeight: 700, fontColor: hex(titleColor), textAlignHorizontal: 'CENTER', textAutoResize: 'HEIGHT', name: `cmp_h_${i}`, parentId: card.id });
        if (ht) run('set_font_name', { nodeId: ht.id, family: fontB.family, style: fontB.style });
        let ryAcc = hH;
        (col.rows || []).forEach((r, ri) => {
          // 행 객체화(회차12): image 행은 텍스트 안 그림(빈슬롯=goditor 숨김)+높이는 예약(정렬), text 행만 텍스트.
          const isObj = r && typeof r === 'object';
          const rType = isObj ? r.type : 'text';
          const rText = isObj ? (r.text != null ? String(r.text) : '') : String(r);
          const effRowH = isFeat ? Math.round(baseRowH(ri) * featScale) : baseRowH(ri);
          const ryTop = ryAcc;
          ryAcc += effRowH + gap;
          if (rType === 'image') {
            const src = isObj ? (r.imgSrc || '') : '';
            if (src) {
              const imf = run('create_frame', { x: 0, y: ryTop, width: cw, height: effRowH, name: `cmp_img_${i}_${ri}`, parentId: card.id });
              if (imf) {
                let b64 = '';
                try {
                  if (src.startsWith('file://')) b64 = readFileSync(decodeURIComponent(src.replace('file://', ''))).toString('base64');
                  else if (src.startsWith('data:')) b64 = src.split(',')[1];
                } catch (e) {}
                if (b64) run('set_image_fill', { nodeId: imf.id, imageSource: b64, sourceType: 'base64', scaleMode: (isObj && r.imgFit === 'contain') ? 'FIT' : 'FILL' }, { timeout: 25000 });
                else run('set_fill_color', { nodeId: imf.id, color: { r: 1, g: 1, b: 1, a: 0 } });
              }
            }
            // src 없으면 placeholder 빈슬롯 → goditor처럼 아무것도 안 그림(텍스트 노출 방지)
          } else {
            const ry = ryTop + Math.round((effRowH - rFont) / 2);
            const rt = run('create_text', { x: 0, y: ry, width: cw, text: rText, fontSize: rFont, fontWeight: isFeat ? 700 : 400, fontColor: hex(rowColor), textAlignHorizontal: 'CENTER', textAutoResize: 'HEIGHT', name: `cmp_r_${i}_${ri}`, parentId: card.id });
            if (rt) run('set_font_name', { nodeId: rt.id, family: fontB.family, style: fontB.style });
          }
        });
      }
      colX += cw - overlap;
    });
    return totalH;
  }

  // ── MOCKUP (mockup-block) : 디바이스 프레임 이미지 (file:// → fs로 base64) ──
  if (block.type === 'mockup') {
    const w = block.width || 575;
    const h = block.height || 400;
    const mx = x + Math.round((availableWidth - w) / 2);  // goditor는 mockup 중앙정렬(회차12 17rm9jg/lm3x38k 실측 x=(secW-w)/2)
    // 디바이스 PNG 투명 화면영역이 흰 배경 비치는 것 방지: mockup 프레임 아래(z하위)에 dark 스크린 사각형 먼저 생성
    // → PNG 화면(투명)으로 dark가 비쳐 goditor 검정화면과 일치. (set_image_fill이 fills를 replace해도 별 레이어라 안전)
    if (block.imgSrc) {
      const _sbg = run('create_frame', { x: mx, y: y + (block.offsetY || 0), width: w, height: h, name: `mockup_screenbg_${block.id || ''}`, parentId });
      if (_sbg) run('set_fill_color', { nodeId: _sbg.id, color: { r: 0.07, g: 0.07, b: 0.07, a: 1 } });
    }
    const frame = run('create_frame', { x: mx, y: y + (block.offsetY || 0), width: w, height: h, name: `mockup_${block.id || ''}`, parentId });
    if (!frame) return h;
    let b64 = '';
    try {
      if (block.imgSrc && block.imgSrc.startsWith('file://')) {
        const p = decodeURIComponent(block.imgSrc.replace('file://', ''));
        b64 = readFileSync(p).toString('base64');
      } else if (block.imgSrc && block.imgSrc.startsWith('data:')) {
        b64 = block.imgSrc.split(',')[1];
      }
    } catch (e) {}
    if (b64) run('set_image_fill', { nodeId: frame.id, imageSource: b64, sourceType: 'base64', scaleMode: 'FIT' }, { timeout: 25000 });
    else run('set_fill_color', { nodeId: frame.id, color: { r: 0.84, g: 0.84, b: 0.84, a: 1 } });
    return h;
  }

  // ── LINER (liner-block) : 곡선텍스트 SVG 임베드 (id 추적 위해 named 프레임 래핑) ──
  if (block.type === 'liner') {
    const h = block.height || 56;
    const w = block.width || availableWidth;
    const wrap = run('create_frame', { x, y, width: w, height: h, name: `liner_${block.id || ''}`, parentId });
    if (wrap) {
      run('set_fill_color', { nodeId: wrap.id, color: { r: 1, g: 1, b: 1, a: 0 } });
      if (block.svg) {
        const node = run('create_node_from_svg', { svg: block.svg, parentId: wrap.id, x: 0, y: 0 }, { timeout: 15000 });
        if (node) run('resize_node', { nodeId: node.id, width: w, height: h });
      }
    }
    return h;
  }

  // ── LAUREL (laurel-block) : 중앙 텍스트 + 좌우 월계관 잎 SVG ──
  if (block.type === 'laurel') {
    const cell = (block.cells && block.cells[0]) || {};
    const lines = cell.lines || [];
    const h = block.height || 116;
    const wrap = run('create_frame', { x, y, width: availableWidth, height: h, name: `laurel_${block.id || ''}`, parentId });
    if (!wrap) return h;
    run('set_fill_color', { nodeId: wrap.id, color: { r: 1, g: 1, b: 1, a: 0 } });
    const fontB = loadFontSafe('Pretendard', 'Bold');
    const totalTextH = lines.reduce((a, l) => a + (l.fontSize || 28) * 1.3, 0);
    let cy = Math.round((h - totalTextH) / 2);
    lines.forEach((l, i) => {
      const tn = run('create_text', { x: 0, y: cy, width: availableWidth, text: l.text || '', fontSize: l.fontSize || 28, fontWeight: l.fontWeight || 500, fontColor: hex(l.color || '#000000'), textAlignHorizontal: 'CENTER', textAutoResize: 'HEIGHT', name: `laurel_t${i}`, parentId: wrap.id });
      if (tn) run('set_font_name', { nodeId: tn.id, family: fontB.family, style: fontB.style });
      cy += Math.round((l.fontSize || 28) * 1.3);
    });
    if (block.leafSvg && Array.isArray(block.leaves) && block.leaves.length) {
      // 실측 leaf geometry 사용 + 좌우반전(scaleX -1)은 SVG 자체를 flip (플러그인 flip 명령 없음)
      const leafColor = cell.leafColor || '#000000';
      const baseSvg = String(block.leafSvg).replace(/currentColor/g, leafColor);
      block.leaves.forEach((lv) => {
        let svg = baseSvg;
        if (lv.flip) {
          const m = /viewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)/.exec(svg);
          const vw = m ? parseFloat(m[1]) : 170;
          svg = svg.replace(/(<svg[^>]*?>)/, `$1<g transform="translate(${vw} 0) scale(-1 1)">`)
                   .replace(/<\/svg>\s*$/, '</g></svg>');
        }
        const lx = Math.round((lv.xFrac || 0) * availableWidth);
        const lw = Math.max(8, Math.round((lv.wFrac || 0) * availableWidth));
        const node = run('create_node_from_svg', { svg, parentId: wrap.id, x: lx, y: lv.y }, { timeout: 12000 });
        if (node) run('resize_node', { nodeId: node.id, width: lw, height: lv.h });
      });
    } else if (block.leafSvg) {
      const leafColor = cell.leafColor || '#000000';
      const svg = String(block.leafSvg).replace(/currentColor/g, leafColor);
      const leafH = h, leafW = Math.max(20, Math.round(leafH * 170 / 324));
      const textHalf = Math.round(availableWidth * 0.28);
      const lx = Math.max(0, Math.round(availableWidth / 2 - textHalf - leafW - 12));
      const lf = run('create_node_from_svg', { svg, parentId: wrap.id, x: lx, y: 0 }, { timeout: 12000 });
      if (lf) run('resize_node', { nodeId: lf.id, width: leafW, height: leafH });
      const rx = Math.round(availableWidth / 2 + textHalf + 12);
      const rt = run('create_node_from_svg', { svg, parentId: wrap.id, x: rx, y: 0 }, { timeout: 12000 });
      if (rt) run('resize_node', { nodeId: rt.id, width: leafW, height: leafH });
    }
    return h;
  }

  // ── GENERIC 폴백 (잔여) : 높이+배경+텍스트 ──
  if (block.type === 'generic') {
    const w = block.width || availableWidth;
    const h = block.height || 0;
    const fx = x + Math.max(0, Math.round((availableWidth - w) / 2));
    const frame = run('create_frame', { x: fx, y, width: Math.max(1, w), height: Math.max(1, h || 1), name: `${block.kind || 'block'}_${block.id || ''}`, parentId });
    if (frame) {
      const bgc = (block.bg || '').trim();
      if (bgc.startsWith('#') || bgc.startsWith('rgb')) run('set_fill_color', { nodeId: frame.id, color: hex(bgc) });
      else run('set_fill_color', { nodeId: frame.id, color: { r: 1, g: 1, b: 1, a: 0 } });
      if (block.radius) run('set_corner_radius', { nodeId: frame.id, radius: block.radius });
      const font = loadFontSafe('Pretendard', 'Regular');
      (block.texts || []).forEach((t, i) => {
        const tx = Math.max(0, t.x || 0), ty = Math.max(0, (typeof t.y === 'number' && t.y) ? t.y : i * 44);
        const tn = run('create_text', { x: tx, y: ty, width: Math.max(20, w - tx), text: t.t, fontSize: t.fs || 24, fontWeight: 400, fontColor: hex(t.color || '#111111'), textAlignHorizontal: 'LEFT', textAutoResize: 'HEIGHT', name: `gtext_${i}`, parentId: frame.id });
        if (tn) run('set_font_name', { nodeId: tn.id, family: font.family, style: font.style });
      });
    }
    return h;
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
// appendMode(배치 누적): 페이지 전체삭제 안 하고 기존 프레임 아래에 이어붙임.
//   data.appendY 가 주어지면 그 Y부터(기존 children 스캔 생략 — 대량 배치에서 빠름).
// 하나라도 figmaId 가 있으면 "부분 업로드" 모드 → 전체 삭제 안 함
const appendMode = data.appendMode === true;
const isPartialUpload = appendMode || sections.some(s => s.figmaId);

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
if (typeof data.appendY === 'number') {
  // 호출자가 직전 배치 종료 Y를 넘겨줌 → children 스캔 생략(대량 배치 가속)
  appendY = data.appendY;
} else if (isPartialUpload) {
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
  // 섹션 배경 이미지(텍스처 등) 있으면 image fill 적용
  if (section.bgImage) {
    const st = section.bgImage.startsWith('data:') ? 'base64' : 'url';
    const src = section.bgImage.startsWith('data:') ? section.bgImage.split(',')[1] : section.bgImage;
    run('set_image_fill', { nodeId: secFrame.id, imageSource: src, sourceType: st, scaleMode: 'FILL' }, { timeout: 20000 });
  }

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
