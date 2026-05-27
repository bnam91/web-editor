// figma-import-utils.js
// goditor_figma_importer.js에서 분리한 순수 유틸 — 모듈 상태(CHANNEL/args/figma) 의존 없음.
// 색상 변환, 그라데이션, 회전, 배경 fill 분류, 텍스트 스타일/HTML span 생성.

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

// ─── rotation 추출 (Figma rad → CSS deg) ──────────────────────────
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

// ─── 노드 배경색 추출 (SOLID hex만 — 섹션/페이지 backgroundColor용) ──
function getBgColor(node) {
  const fill = node.background?.[0] || node.fills?.[0];
  if (fill?.type === 'SOLID') return rgba2hex(fill.color);
  return null;
}

// ─── 색 객체 → CSS (alpha<1이면 rgba) ──
function rgbaCss(c) {
  if (!c) return '#000000';
  const a = c.a === undefined ? 1 : c.a;
  if (a >= 1) return rgba2hex(c);
  const r = Math.round((c.r || 0) * 255), g = Math.round((c.g || 0) * 255), b = Math.round((c.b || 0) * 255);
  return `rgba(${r},${g},${b},${+a.toFixed(3)})`;
}

// ─── Figma 그라데이션 fill → CSS gradient ──
function gradientToCss(fill) {
  const stops = (fill.gradientStops || [])
    .map(s => `${rgbaCss(s.color)} ${Math.round((s.position || 0) * 100)}%`).join(', ');
  if (!stops) return null;
  if (fill.type === 'GRADIENT_RADIAL') return `radial-gradient(circle, ${stops})`;
  // linear: 핸들 위치로 각도 산출 (y축 아래로 증가 → CSS 0deg=위쪽 기준)
  const h = fill.gradientHandlePositions || [];
  let angle = 180;
  if (h.length >= 2) {
    const dx = h[1].x - h[0].x, dy = h[1].y - h[0].y;
    angle = Math.round((Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360);
  }
  return `linear-gradient(${angle}deg, ${stops})`;
}

// ─── 노드 배경 fill → { kind:'solid'|'gradient'|'image', css } ──
// 프레임 background는 CSS `background`라서 solid/gradient 모두 받을 수 있음
function getBgFill(node) {
  const fill = node.background?.[0] || node.fills?.[0];
  if (!fill || fill.visible === false) return null;
  if (fill.type === 'SOLID') return { kind: 'solid', css: rgba2hex(fill.color) };
  if (fill.type === 'GRADIENT_LINEAR' || fill.type === 'GRADIENT_RADIAL') {
    const css = gradientToCss(fill);
    return css ? { kind: 'gradient', css } : null;
  }
  if (fill.type === 'IMAGE') return { kind: 'image' };
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

// ─── HTML 이스케이프 ──
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── 글자별 스타일(styleOverrideTable) → HTML span run ──
// Figma 텍스트의 characterStyleOverrides(글자별 키) + styleOverrideTable(키별 스타일)을
// 연속 run으로 묶어 <span style="color/font-weight/font-size">로 출력. override 없으면 null.
function buildStyledTextHtml(node, baseColor, scale) {
  const chars = node.characters || '';
  const cso = node.characterStyleOverrides;
  const tbl = node.styleOverrideTable;
  if (!chars || !Array.isArray(cso) || !tbl || Object.keys(tbl).length === 0) return null;
  const baseSize = node.style?.fontSize;
  const baseWeight = node.style?.fontWeight;
  const styleOf = (key) => {
    const ov = tbl[String(key)];
    if (!ov) return null;
    const parts = [];
    const fill = (ov.fills || [])[0];
    if (fill?.type === 'SOLID') { const c = rgbaCss(fill.color); if (c !== baseColor) parts.push(`color:${c}`); }
    if (ov.fontWeight && ov.fontWeight !== baseWeight) parts.push(`font-weight:${ov.fontWeight}`);
    if (ov.fontSize && ov.fontSize !== baseSize) parts.push(`font-size:${Math.round(ov.fontSize * scale)}px`);
    if (ov.fontStyle && /italic/i.test(ov.fontStyle)) parts.push('font-style:italic');
    return parts.length ? parts.join(';') : null;
  };
  let html = '', curStyle = undefined, buf = '', anyOverride = false;
  const flush = () => {
    if (!buf) return;
    html += curStyle ? `<span style="${curStyle}">${escHtml(buf)}</span>` : escHtml(buf);
    buf = '';
  };
  for (let i = 0; i < chars.length; i++) {
    const key = cso[i];
    const st = (key === undefined || key === null) ? null : styleOf(key);
    if (st !== curStyle) { flush(); curStyle = st; }
    if (st) anyOverride = true;
    buf += chars[i];
  }
  flush();
  return anyOverride ? html : null;
}

module.exports = {
  rgba2hex, getSvgNaturalSize, getRotationDeg, getBgColor,
  rgbaCss, gradientToCss, getBgFill, mapStyle, mapAlign,
  escHtml, buildStyledTextHtml,
};
