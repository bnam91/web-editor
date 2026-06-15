/* ══════════════════════════════════════
   PROP-FRAME — Frame 속성 패널 (frame-block)
══════════════════════════════════════ */
import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';
import { bindSlider } from './_helpers.js';

function rgbToHex(rgb) {
  if (!rgb || rgb === 'transparent') return '#ffffff';
  if (/^#/.test(rgb)) return rgb;
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return '#ffffff';
  return '#' + m.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
}

/* ── shape 타입별 아이콘 SVG ── */
const _SHAPE_ICONS = {
  star:      `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><polygon points="8,2 9.8,6.2 14.5,6.2 10.8,8.9 12.2,13.5 8,10.8 3.8,13.5 5.2,8.9 1.5,6.2 6.2,6.2" fill="#888"/></svg>`,
  rectangle: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="8" rx="1" stroke="#888" stroke-width="1.4" fill="none"/></svg>`,
  ellipse:   `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#888" stroke-width="1.4" fill="none"/></svg>`,
  line:      `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><line x1="2" y1="14" x2="14" y2="2" stroke="#888" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  arrow:     `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><line x1="2" y1="14" x2="14" y2="2" stroke="#888" stroke-width="1.6" stroke-linecap="round"/><polyline points="8,2 14,2 14,8" stroke="#888" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  polygon:   `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><polygon points="8,2 14,12 2,12" stroke="#888" stroke-width="1.4" fill="none" stroke-linejoin="round"/></svg>`,
};
const _FRAME_ICON = `<svg width="16" height="16" viewBox="1.5 1.5 13 13" fill="none"><path fill="#888" fill-rule="evenodd" d="M5.5 3a.5.5 0 0 1 .5.5V5h4V3.5a.5.5 0 0 1 1 0V5h1.5a.5.5 0 0 1 0 1H11v4h1.5a.5.5 0 0 1 0 1H11v1.5a.5.5 0 0 1-1 0V11H6v1.5a.5.5 0 0 1-1 0V11H3.5a.5.5 0 0 1 0-1H5V6H3.5a.5.5 0 0 1 0-1H5V3.5a.5.5 0 0 1 .5-.5m4.5 7V6H6v4z" clip-rule="evenodd"/></svg>`;
const _BANNER_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#888" stroke-width="1.4"><rect x="2" y="4" width="12" height="8" rx="1.5"/><line x1="2" y1="7.5" x2="9" y2="7.5"/></svg>`;

/* ── 공통 헤더: Frame 이름 + 모드 토글 ── */
function _headerHTML(el, mode) {
  const id = el.id || '';
  // showFrameProperties는 frame-block 전용 패널.
  // banner-preset 변형은 컴포넌트 단위 — Banner 아이콘 + 'Banner' 라벨 사용.
  const isBanner = !!el.dataset.bannerPreset;
  const icon = isBanner ? _BANNER_ICON : _FRAME_ICON;
  const defaultName = isBanner ? 'Banner' : 'Frame';
  return `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          ${icon}
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${el.dataset.layerName || defaultName}</span>
        </div>
        ${id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${id}')">${id}</span>` : ''}
      </div>
    </div>`;
}

/* ════════════════════════════════════════
   AUTO 모드 (frame-block)
════════════════════════════════════════ */
/* ── 자유배치 자식 행 그루핑 (Step 1: 분석만) ── */
function _analyzeFreeLayoutChildren(ss) {
  const directChildren = Array.from(ss.children).filter(c =>
    c.style.position === 'absolute' && c.id
  );
  const items = directChildren.map(c => {
    const left   = parseInt(c.style.left)   || 0;
    const top    = parseInt(c.style.top)    || 0;
    const width  = parseInt(c.style.width)  || c.offsetWidth  || 0;
    const height = parseInt(c.style.height) || c.offsetHeight || 0;
    return { el: c, id: c.id, left, top, width, height, bottom: top + height, right: left + width };
  });
  const rows = [];
  for (const it of [...items].sort((a, b) => a.top - b.top)) {
    const row = rows.find(r => it.top < r.maxBottom && it.bottom > r.minTop);
    if (row) {
      row.items.push(it);
      row.maxBottom = Math.max(row.maxBottom, it.bottom);
      row.minTop    = Math.min(row.minTop, it.top);
    } else {
      rows.push({ items: [it], minTop: it.top, maxBottom: it.bottom });
    }
  }
  rows.forEach(r => r.items.sort((a, b) => a.left - b.left));
  rows.sort((a, b) => a.minTop - b.minTop);
  const vGaps = [];
  for (let i = 1; i < rows.length; i++) {
    vGaps.push(rows[i].minTop - rows[i - 1].maxBottom);
  }
  const frameH = parseInt(ss.style.height) || parseInt(ss.dataset.height) || ss.offsetHeight || 0;
  const frameW = parseInt(ss.style.width)  || ss.offsetWidth  || parseInt(ss.dataset.width)  || 0;
  const padTop = rows.length ? rows[0].minTop : 0;
  const padBot = rows.length ? Math.max(0, frameH - rows[rows.length - 1].maxBottom) : 0;
  return { rows, vGaps, padTop, padBot, frameH, frameW };
}

function _logAnalysis(ss) {
  // (FIX-4) 이스터에그 게이팅 — off면 콘솔 디버그 함수 동작 차단
  if (window.isEasterEggEnabled && !window.isEasterEggEnabled('freeLayoutAnalyze')) return;
  const a = _analyzeFreeLayoutChildren(ss);
  const lines = [];
  lines.push(`프레임: ${ss.id} (${a.frameW}×${a.frameH})`);
  lines.push(`상단 여백: ${a.padTop}px / 하단 여백: ${a.padBot}px`);
  lines.push(`행 ${a.rows.length}개:`);
  a.rows.forEach((r, i) => {
    const desc = r.items.map(it => `${it.id} (X${it.left} W${it.width})`).join(', ');
    const tag  = r.items.length > 1 ? ` [가로 ${r.items.length}개]` : '';
    lines.push(`  행${i + 1} [Y${r.minTop}~${r.maxBottom}]${tag}: ${desc}`);
  });
  if (a.vGaps.length) lines.push(`세로 갭: ${a.vGaps.join(', ')}px`);
  console.log('[스택 변환 분석]\n' + lines.join('\n'));
  return a;
}
window.__analyzeFreeLayoutFrame = _logAnalysis;

/* ── Banner 외곽 자식 좌우 미러링 ──
   absolute 자식: style.left + dataset.offsetX 갱신
   normal flow 자식: style.marginLeft 갱신 (margin-right로 흡수)
   공식: newX = bannerWidth − x − childWidth */
function _swapBannerChildren(ss) {
  if (!ss?.dataset?.bannerPreset) return;
  // 줌 영향을 받지 않도록 inline style / dataset 픽셀값을 우선 사용
  const bannerWidth = parseInt(ss.style.width) || parseInt(ss.dataset.width) || 0;
  if (!bannerWidth) return;
  window.pushHistory?.();
  Array.from(ss.children).forEach(child => {
    const cw = parseInt(child.style.width) || parseInt(child.dataset.width) || 0;
    if (!cw) return;
    if (child.style.position === 'absolute') {
      const curX = parseFloat(child.style.left) || 0;
      const newX = bannerWidth - curX - cw;
      child.style.left = newX + 'px';
      if (child.dataset.offsetX !== undefined) child.dataset.offsetX = newX;
    } else {
      const curML = parseFloat(child.style.marginLeft) || 0;
      const newML = bannerWidth - curML - cw;
      child.style.marginLeft = newML + 'px';
    }
  });
  window.scheduleAutoSave?.();
}

/* ── 자유배치 → 스택 변환 (Step 2: 단일 자식 행만) ── */
function _convertFreeLayoutToStack(ss) {
  // (FIX-4) 이스터에그 게이팅 — off면 콘솔 디버그 변환 함수 동작 차단
  if (window.isEasterEggEnabled && !window.isEasterEggEnabled('freeLayoutAnalyze')) return false;
  const a = _analyzeFreeLayoutChildren(ss);
  const multiRows = a.rows.filter(r => r.items.length > 1);
  if (multiRows.length > 0) {
    alert(`다중 자식 행 ${multiRows.length}개 — 가로 묶기는 Step 3에서 지원 예정.`);
    return false;
  }
  if (a.rows.length === 0) {
    alert('변환할 자식이 없습니다.');
    return false;
  }

  window.pushHistory?.();

  const parentW = a.frameW;
  const orderedItems = a.rows.map(r => r.items[0]);

  for (const it of orderedItems) {
    const c = it.el;
    c.style.position = '';
    c.style.left = '';
    c.style.top = '';
    c.style.flexShrink = '0';
    if (it.width < parentW) {
      c.style.width = it.width + 'px';
      c.style.alignSelf = 'center';
    } else {
      c.style.width = '';
      c.style.alignSelf = '';
    }
  }

  orderedItems.forEach(it => it.el.remove());

  const insertGap = (h) => {
    if (h <= 0) return;
    const gb = window.makeGapBlock();
    gb.style.height = h + 'px';
    gb.dataset.h = h;
    ss.appendChild(gb);
    window.bindBlock?.(gb);
  };

  if (a.padTop > 0) insertGap(a.padTop);
  for (let i = 0; i < orderedItems.length; i++) {
    ss.appendChild(orderedItems[i].el);
    if (i < a.vGaps.length) insertGap(a.vGaps[i]);
  }
  if (a.padBot > 0) insertGap(a.padBot);

  delete ss.dataset.freeLayout;
  delete ss.dataset.height;
  ss.dataset.fullWidth = 'true';
  ss.style.height = '';
  ss.style.minHeight = '';

  window.scheduleAutoSave?.();
  window.buildLayerPanel?.();
  window.showFrameProperties?.(ss);
  return true;
}
window.__convertFreeLayoutToStack = _convertFreeLayoutToStack;

function _renderAutoPanel(ss) {
  const isShapeFrame = !!ss.querySelector('.shape-block');
  const isFreeLayout = ss.dataset.freeLayout === 'true';
  const rawBg  = ss.style.backgroundColor || ss.dataset.bg || '#f5f5f5';
  const hexBg  = rgbToHex(rawBg);
  const bgAlpha = parseAlphaFromColor(rawBg);
  const padY   = parseInt(ss.dataset.padY)   || 0;
  const width  = parseInt(ss.dataset.width)  || (isShapeFrame ? 100 : 780);
  const height = parseInt(ss.dataset.height) || (isShapeFrame ? 100 : 520);
  const minWidth = isShapeFrame ? Math.min(width, 20) : 200;
  const hasBgImg = ss.style.backgroundImage && ss.style.backgroundImage !== 'none';
  const borderWidth = parseInt(ss.dataset.borderWidth) || 0;
  const borderStyle = ss.dataset.borderStyle || 'solid';
  const rawBorderColor = ss.style.borderColor || ss.dataset.borderColor || '#888888';
  const hexBorderColor = rgbToHex(rawBorderColor);
  const borderAlpha    = parseAlphaFromColor(rawBorderColor);
  const radius = parseInt(ss.dataset.radius) || 0;
  // 배경 투명도 (I2): dataset.bgOpacity는 0~1 float, UI는 0~100 표시. 미설정 = 100%.
  // I2-F3: invalid 값(NaN/범위초과)은 1(100%)로 클램프 후 표시.
  let _bgOpa = parseFloat(ss.dataset.bgOpacity);
  if (!Number.isFinite(_bgOpa) || _bgOpa < 0 || _bgOpa > 1) _bgOpa = 1;
  const bgOpacity = ss.dataset.bgOpacity !== undefined
    ? Math.round(_bgOpa * 100)
    : 100;

  const bannerPreset = ss.dataset.bannerPreset || '';
  const isBanner = !!bannerPreset;
  const bannerOptionsHTML = isBanner
    ? (window.listBannerPresets?.() || [])
        .map(p => `<option value="${p.key}" ${p.key === bannerPreset ? 'selected' : ''}>${p.label}</option>`)
        .join('')
    : '';

  // Banner inner stack frame: 부모가 banner-preset이고 자신은 normal flow(margin 기반).
  // 사용자가 X 위치를 프로퍼티 패널로 조절할 수 있도록 슬라이더 노출.
  const isBannerInner = !!(ss.parentElement?.dataset?.bannerPreset) && ss.style.position !== 'absolute';
  const bannerInnerX = isBannerInner ? (parseInt(ss.style.marginLeft) || 0) : 0;
  const bannerOuterW = isBannerInner ? (parseInt(ss.parentElement.style.width) || parseInt(ss.parentElement.dataset?.width) || 0) : 0;
  const bannerInnerXMax = isBannerInner ? Math.max(0, bannerOuterW - (parseInt(ss.style.width) || parseInt(ss.dataset.width) || 0)) : 0;

  propPanel.innerHTML = _headerHTML(ss, 'auto') + `
    ${isBanner ? `
    <div class="prop-section">
      <div class="prop-section-title">Banner Preset</div>
      <select class="prop-select" id="ss-banner-preset" style="width:100%;height:28px;background:#1a1a1a;color:#e5e5e5;border:1px solid #333;border-radius:4px;padding:0 8px;font-size:11px;">
        ${bannerOptionsHTML}
      </select>
      <button class="prop-action-btn secondary" id="ss-banner-swap-btn" style="margin-top:6px;">좌우 바꾸기</button>
    </div>
    ` : ''}
    ${isBannerInner ? `
    <div class="prop-section">
      <div class="prop-section-title">Banner Position</div>
      <div class="prop-row">
        <span class="prop-label">X</span>
        <input type="range" class="prop-slider" id="ss-banner-inner-x-slider" min="0" max="${bannerInnerXMax}" step="1" value="${bannerInnerX}">
        <input type="number" class="prop-number" id="ss-banner-inner-x-num" min="0" max="${bannerInnerXMax}" value="${bannerInnerX}">
      </div>
    </div>
    ` : ''}
    <div class="prop-section">
      <div class="prop-section-title">Layout</div>
      <div class="prop-row" style="gap:4px;">
        <span style="font-size:11px;color:${isFreeLayout ? '#9ca3af' : '#5fb4d8'};font-weight:500;flex:1;">${isFreeLayout ? 'free' : 'stack'}</span>
        ${isFreeLayout ? `<button class="prop-action-btn secondary" id="ss-to-stack-btn" style="height:24px;padding:0 10px;font-size:11px;width:auto;flex:0 0 auto;">stack</button>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Background</div>
      <div class="prop-color-row">
        <span class="prop-label">${bgAlpha === 0 ? '배경색 (투명)' : '배경색'}</span>
        ${colorFieldHTML({ idPrefix: 'ss-bg', hex: hexBg, alpha: bgAlpha })}
      </div>
      <div class="prop-row">
        <span class="prop-label">배경 투명도</span>
        <input type="range" class="prop-slider" id="ss-bgopa-slider" min="0" max="100" step="1" value="${bgOpacity}">
        <input type="number" class="prop-number" id="ss-bgopa-num" min="0" max="100" value="${bgOpacity}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Bg Image</div>
      <button class="prop-action-btn secondary" id="ss-bg-img-btn" style="margin-top:6px;">이미지 선택</button>
      <input type="file" id="ss-bg-img-input" accept="image/*" style="display:none">
      ${hasBgImg ? `
        <button class="prop-action-btn secondary" id="ss-bg-pos-btn" style="margin-top:4px;">위치 편집</button>
        <button class="prop-action-btn danger" id="ss-bg-img-clear" style="margin-top:4px;">이미지 제거</button>
      ` : ''}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Border</div>
      <div class="prop-row">
        <span class="prop-label">두께</span>
        <input type="range" class="prop-slider" id="ss-border-w-slider" min="0" max="20" step="1" value="${borderWidth}">
        <input type="number" class="prop-number" id="ss-border-w-num" min="0" max="20" value="${borderWidth}">
      </div>
      <div class="prop-row">
        <span class="prop-label">스타일</span>
        <select class="prop-select" id="ss-border-style">
          <option value="solid"  ${borderStyle === 'solid'  ? 'selected' : ''}>Solid</option>
          <option value="dashed" ${borderStyle === 'dashed' ? 'selected' : ''}>Dashed</option>
          <option value="dotted" ${borderStyle === 'dotted' ? 'selected' : ''}>Dotted</option>
        </select>
      </div>
      <div class="prop-color-row" style="margin-top:6px;">
        <span class="prop-label">색상</span>
        ${colorFieldHTML({ idPrefix: 'ss-border', hex: hexBorderColor, alpha: borderAlpha })}
      </div>
      <div class="prop-row">
        <span class="prop-label">코너</span>
        <input type="range" class="prop-slider" id="ss-radius-slider" min="0" max="80" step="1" value="${radius}">
        <input type="number" class="prop-number" id="ss-radius-num" min="0" max="80" value="${radius}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Size</div>
      <div class="prop-row">
        <span class="prop-label">너비</span>
        <input type="range" class="prop-slider" id="ss-width-slider" min="${minWidth}" max="860" step="10" value="${width}">
        <input type="number" class="prop-number" id="ss-width-num" min="${minWidth}" max="860" value="${width}">
      </div>
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range" class="prop-slider" id="ss-height-slider" min="100" max="1200" step="10" value="${height}">
        <input type="number" class="prop-number" id="ss-height-num" min="100" max="1200" value="${height}">
      </div>
      <div class="prop-row">
        <span class="prop-label">상/하 여백</span>
        <input type="range" class="prop-slider" id="ss-pady-slider" min="0" max="200" step="4" value="${padY}">
        <input type="number" class="prop-number" id="ss-pady-num" min="0" max="200" value="${padY}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Position</div>
      <div class="prop-row" style="gap:4px;">
        <span class="prop-label" style="width:16px;flex-shrink:0;">X</span>
        <input type="number" class="prop-number" id="ss-pos-x" style="flex:1;" value="${parseInt(ss.dataset.translateX) || 0}">
        <span class="prop-label" style="width:16px;flex-shrink:0;margin-left:4px;">Y</span>
        <input type="number" class="prop-number" id="ss-pos-y" style="flex:1;" value="${parseInt(ss.dataset.translateY) || 0}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Child Align</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-top:6px;">
        <button class="prop-align-btn" id="ss-align-left"    title="왼쪽 정렬"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path fill="currentColor" d="M3 2h1.5v12H3zM6.5 4.5h6a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-6zm0 4h4a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-4z"/></svg></button>
        <button class="prop-align-btn" id="ss-align-hcenter" title="가운데 정렬"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path fill="currentColor" d="M7.25 2h1.5v2.5H13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5H8.75v1H12a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5H8.75V14h-1.5v-2.5H4a.5.5 0 0 1-.5-.5V9a.5.5 0 0 1 .5-.5h3.25v-1H4a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5h3.25z"/></svg></button>
        <button class="prop-align-btn" id="ss-align-right"   title="오른쪽 정렬"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path fill="currentColor" d="M11.5 2H13v12h-1.5zM3.5 4.5h6a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-6zm2 4h4a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-4z"/></svg></button>
        <button class="prop-align-btn" id="ss-align-top"     title="위 정렬"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path fill="currentColor" d="M2 3v1.5h12V3zM4.5 6.5v6a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-6zm4 0v4a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-4z"/></svg></button>
        <button class="prop-align-btn" id="ss-align-vcenter" title="세로 가운데"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path fill="currentColor" d="M2 7.25h2.5V4a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v3.25h1V4a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v3.25H14v1.5h-2.5V12a.5.5 0 0 1-.5.5H9a.5.5 0 0 1-.5-.5V8.75h-1V12a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V8.75H2z"/></svg></button>
        <button class="prop-align-btn" id="ss-align-bottom"  title="아래 정렬"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path fill="currentColor" d="M2 11.5v1.5h12v-1.5zM4.5 3.5v6a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-6zm4 2v4a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-4z"/></svg></button>
      </div>
      <div class="prop-row" style="margin-top:8px;">
        <span class="prop-label" style="width:40px;">간격</span>
        <input type="range" class="prop-slider" id="ss-gap-slider" min="0" max="80" step="2" value="${parseInt(ss.style.gap) || 0}">
        <input type="number" class="prop-number" id="ss-gap-num" min="0" max="80" value="${parseInt(ss.style.gap) || 0}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Rotate / Flip</div>
      <div class="prop-row" style="gap:4px;">
        <span class="prop-label" style="flex-shrink:0;">각도</span>
        <input type="number" class="prop-number" id="ss-rotate-deg" style="width:56px;" min="-360" max="360" value="${parseInt(ss.dataset.rotateDeg) || 0}">
        <span style="font-size:11px;color:#6b6b6b;flex-shrink:0;">°</span>
      </div>
      <div class="prop-row" style="gap:3px;justify-content:flex-end;margin-top:2px;">
        <button class="prop-align-btn" id="ss-rotate-90" title="90° 시계 방향 회전"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" d="M11.5 4.5A5 5 0 1 0 13 8"/><polyline stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" points="9,2 12,4.5 9.5,7.5"/></svg></button>
        <button class="prop-align-btn" id="ss-flip-h" title="좌우 반전"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M8 2v12M4 4l-2 4 2 4M12 4l2 4-2 4"/><path fill="currentColor" opacity=".35" d="M8 5v6l-4-3z"/></svg></button>
        <button class="prop-align-btn" id="ss-flip-v" title="상하 반전"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M2 8h12M4 4l4-2 4 2M4 12l4 2 4-2"/><path fill="currentColor" opacity=".35" d="M5 8h6l-3 4z"/></svg></button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Component</div>
      ${(() => {
        const allTemplates = window.loadTemplates?.() || [];
        const folders = [...new Set(allTemplates.map(t => t.folder || '기타'))];
        const folderOptions = folders.map(f => `<option value="${f}">${f}</option>`).join('');
        const catOptions = ['Hero','Main','Feature','Detail','CTA','Event','기타'].map(c =>
          `<option value="${c}">${c}</option>`
        ).join('');
        return `
          <select class="prop-select" id="ss-tpl-folder" style="width:100%;margin-bottom:6px;">
            ${folderOptions}
            <option value="__new__">새 폴더...</option>
          </select>
          <input type="text" id="ss-tpl-folder-new" class="tpl-name-input" placeholder="새 폴더 이름" style="display:none;margin-bottom:6px;">
          <select class="prop-select" id="ss-tpl-cat" style="width:100%;margin-bottom:6px;">
            ${catOptions}
          </select>
          <input type="text" id="ss-tpl-name" class="tpl-name-input" placeholder="컴포넌트 이름" style="margin-bottom:6px;">
          <button class="prop-action-btn primary" id="ss-tpl-save-btn" style="margin-top:4px;">컴포넌트로 저장</button>
        `;
      })()}
    </div>
    <div class="prop-section">
      <div class="prop-hint">Frame 클릭 후 플로팅 패널에서 블록을 추가하면 이 안으로 들어갑니다.</div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(ss.id || null);

  // ── Banner Preset 변경 ──
  const bannerSel = document.getElementById('ss-banner-preset');
  if (bannerSel) {
    bannerSel.addEventListener('change', e => {
      const newKey = e.target.value;
      const oldKey = ss.dataset.bannerPreset;
      if (newKey === oldKey) return;
      const ok = confirm('프리셋을 바꾸면 현재 배너 안의 내용이 모두 사라집니다. 계속할까요?');
      if (!ok) {
        e.target.value = oldKey;
        return;
      }
      window.pushHistory?.();
      window._applyBannerPreset?.(ss, newKey);
      window.showFrameProperties?.(ss);
    });
  }

  // ── Banner 좌우 바꾸기 ──
  document.getElementById('ss-banner-swap-btn')?.addEventListener('click', () => {
    _swapBannerChildren(ss);
  });

  // ── Banner Inner X(margin-left) 조절 ──
  if (isBannerInner) {
    const innerXSlider = document.getElementById('ss-banner-inner-x-slider');
    const innerXNum    = document.getElementById('ss-banner-inner-x-num');
    const applyInnerX = (v) => { ss.style.marginLeft = v + 'px'; };
    if (innerXSlider && innerXNum) bindSlider(innerXSlider, innerXNum, applyInnerX, { min: 0, max: bannerInnerXMax });
  }

  // ── Layout: 스택 변환 ──
  document.getElementById('ss-to-stack-btn')?.addEventListener('click', () => {
    _convertFreeLayoutToStack(ss);
  });

  // ── 위치(X/Y) 핸들러 ──
  const _applyTransform = () => {
    const tx = parseInt(ss.dataset.translateX) || 0;
    const ty = parseInt(ss.dataset.translateY) || 0;
    const rd = parseFloat(ss.dataset.rotateDeg) || 0;
    const fx = ss.dataset.flipH === '1' ? -1 : 1;
    const fy = ss.dataset.flipV === '1' ? -1 : 1;
    ss.style.transform = `translate(${tx}px,${ty}px) rotate(${rd}deg) scale(${fx},${fy})`;
    window.scheduleAutoSave?.();
  };
  document.getElementById('ss-pos-x')?.addEventListener('input', e => { ss.dataset.translateX = parseInt(e.target.value) || 0; _applyTransform(); });
  document.getElementById('ss-pos-y')?.addEventListener('input', e => { ss.dataset.translateY = parseInt(e.target.value) || 0; _applyTransform(); });
  // 드래그 커밋(change) 1회 = undo 1액션
  document.getElementById('ss-pos-x')?.addEventListener('change', () => window.pushHistory?.());
  document.getElementById('ss-pos-y')?.addEventListener('change', () => window.pushHistory?.());

  // ── 자식 정렬 핸들러 ──
  const _setAlign = (alignItems, justifyContent) => {
    // freeLayout(자유배치) 프레임: 자식이 절대좌표라 flex 정렬이 무효 →
    // 부모 프레임 크기 기준으로 각 자식의 left/top을 직접 재계산
    if (ss.dataset.freeLayout === 'true') {
      const ssW = ss.clientWidth, ssH = ss.clientHeight;
      const kids = [...ss.children].filter(c =>
        !c.classList.contains('frame-resize-handle') &&
        getComputedStyle(c).position === 'absolute');
      kids.forEach(c => {
        if (alignItems !== null) {
          const cw = c.offsetWidth;
          const left = alignItems === 'center' ? Math.round((ssW - cw) / 2)
                     : alignItems === 'flex-end' ? Math.round(ssW - cw) : 0;
          c.style.left = left + 'px'; c.dataset.offsetX = left;
        }
        if (justifyContent !== null) {
          const ch = c.offsetHeight;
          const top = justifyContent === 'center' ? Math.round((ssH - ch) / 2)
                    : justifyContent === 'flex-end' ? Math.round(ssH - ch) : 0;
          c.style.top = top + 'px'; c.dataset.offsetY = top;
        }
      });
      if (alignItems !== null) ss.dataset.childAlignX = alignItems;
      if (justifyContent !== null) ss.dataset.childAlignY = justifyContent;
      window.scheduleAutoSave?.();
      return;
    }
    if (alignItems !== null) {
      ss.style.alignItems = alignItems;
      ss.dataset.alignItems = alignItems;
      // 자식 row의 align-self / margin이 align-items를 덮어쓰는 문제 수정
      const alignSelfMap = { 'flex-start': 'flex-start', 'center': 'center', 'flex-end': 'flex-end' };
      const marginMap    = { 'flex-start': '0',          'center': '0 auto',  'flex-end': '0' };
      ss.querySelectorAll(':scope > .row').forEach(row => {
        row.style.alignSelf = alignSelfMap[alignItems] || '';
        row.style.margin    = marginMap[alignItems]    || '0';
      });
    }
    if (justifyContent !== null) { ss.style.justifyContent = justifyContent; ss.dataset.justifyContent = justifyContent; }
    window.scheduleAutoSave?.();
  };
  const _setGap = v => {
    ss.style.gap = v + 'px';
    ss.dataset.gap = String(v);
  };

  // 현재 상태 반영
  const curAlignItems    = ss?.style.alignItems    || ss.dataset.alignItems    || 'flex-start';
  const curJustifyContent= ss?.style.justifyContent|| ss.dataset.justifyContent|| 'flex-start';
  const _markAlignActive = (id, group) => {
    group.forEach(i => document.getElementById(i)?.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
  };
  const hGroup = ['ss-align-left','ss-align-hcenter','ss-align-right'];
  const vGroup = ['ss-align-top','ss-align-vcenter','ss-align-bottom'];
  const hMap = { 'flex-start':'ss-align-left', 'center':'ss-align-hcenter', 'flex-end':'ss-align-right' };
  const vMap = { 'flex-start':'ss-align-top',  'center':'ss-align-vcenter',  'flex-end':'ss-align-bottom' };
  _markAlignActive(hMap[curAlignItems]    || 'ss-align-left', hGroup);
  _markAlignActive(vMap[curJustifyContent] || 'ss-align-top',  vGroup);

  document.getElementById('ss-align-left')?.addEventListener('click',    () => { _setAlign('flex-start', null); _markAlignActive('ss-align-left',    hGroup); window.pushHistory?.(); });
  document.getElementById('ss-align-hcenter')?.addEventListener('click', () => { _setAlign('center',     null); _markAlignActive('ss-align-hcenter', hGroup); window.pushHistory?.(); });
  document.getElementById('ss-align-right')?.addEventListener('click',   () => { _setAlign('flex-end',   null); _markAlignActive('ss-align-right',   hGroup); window.pushHistory?.(); });

  document.getElementById('ss-align-top')?.addEventListener('click',     () => { _setAlign(null, 'flex-start'); _markAlignActive('ss-align-top',    vGroup); window.pushHistory?.(); });
  document.getElementById('ss-align-vcenter')?.addEventListener('click', () => { _setAlign(null, 'center');     _markAlignActive('ss-align-vcenter', vGroup); window.pushHistory?.(); });
  document.getElementById('ss-align-bottom')?.addEventListener('click',  () => { _setAlign(null, 'flex-end');   _markAlignActive('ss-align-bottom',  vGroup); window.pushHistory?.(); });

  const gapSlider = document.getElementById('ss-gap-slider');
  const gapNum    = document.getElementById('ss-gap-num');
  if (gapSlider && gapNum) bindSlider(gapSlider, gapNum, _setGap, { min: 0, max: 80 });

  // ── 회전 / 반전 핸들러 ──
  document.getElementById('ss-rotate-deg')?.addEventListener('input', e => {
    ss.dataset.rotateDeg = parseFloat(e.target.value) || 0;
    _applyTransform();
  });
  document.getElementById('ss-rotate-deg')?.addEventListener('change', () => window.pushHistory?.());
  document.getElementById('ss-rotate-90')?.addEventListener('click', () => {
    const cur = parseFloat(ss.dataset.rotateDeg) || 0;
    const next = (cur + 90) % 360;
    ss.dataset.rotateDeg = next;
    const inp = document.getElementById('ss-rotate-deg');
    if (inp) inp.value = next;
    _applyTransform();
    window.pushHistory?.();
  });
  document.getElementById('ss-flip-h')?.addEventListener('click', () => {
    ss.dataset.flipH = ss.dataset.flipH === '1' ? '0' : '1';
    document.getElementById('ss-flip-h')?.classList.toggle('active', ss.dataset.flipH === '1');
    _applyTransform();
    window.pushHistory?.();
  });
  document.getElementById('ss-flip-v')?.addEventListener('click', () => {
    ss.dataset.flipV = ss.dataset.flipV === '1' ? '0' : '1';
    document.getElementById('ss-flip-v')?.classList.toggle('active', ss.dataset.flipV === '1');
    _applyTransform();
    window.pushHistory?.();
  });
  // 초기 flip 상태 반영
  if (ss.dataset.flipH === '1') document.getElementById('ss-flip-h')?.classList.add('active');
  if (ss.dataset.flipV === '1') document.getElementById('ss-flip-v')?.classList.add('active');

  // ── 배경 CSS변수 동기화 (I2) ──
  // has-bg-opacity 프레임은 배경을 ::before가 그리므로 --frame-bg / --frame-bg-img로 전달.
  // 색(--frame-bg) / 이미지·그라데이션(--frame-bg-img) / 위치(--frame-bg-pos) 3분기 모두 반영.
  const _syncFrameBgVars = () => {
    if (!ss.classList.contains('has-bg-opacity')) return;
    const bgVal = ss.dataset.bg || ss.style.backgroundColor || 'transparent';
    const isGradient = /gradient\s*\(/i.test(bgVal);
    if (isGradient) {
      // 그라데이션: 색은 비우고 이미지 슬롯에 gradient css
      ss.style.setProperty('--frame-bg', 'transparent');
      ss.style.setProperty('--frame-bg-img', bgVal);
    } else {
      ss.style.setProperty('--frame-bg', bgVal);
      if (ss.dataset.bgImg) {
        ss.style.setProperty('--frame-bg-img', `url("${ss.dataset.bgImg}")`);
      } else {
        ss.style.setProperty('--frame-bg-img', 'none');
      }
    }
    ss.style.setProperty('--frame-bg-pos', ss.dataset.bgPos || 'center');
    // 본체 배경은 ::before가 대신 그리므로 비워 이중 배경 방지
    ss.style.backgroundColor = '';
    ss.style.backgroundImage = '';
    ss.style.background = '';
  };

  // ── 배경 투명도(bgOpacity) 슬라이더 (I2) ──
  const bgOpaSlider = document.getElementById('ss-bgopa-slider');
  const bgOpaNum    = document.getElementById('ss-bgopa-num');
  const applyBgOpacity = (v) => {
    const o = v / 100;
    ss.dataset.bgOpacity = String(o);
    ss.style.setProperty('--frame-bg-opacity', String(o));
    const active = o < 1;
    ss.classList.toggle('has-bg-opacity', active);
    if (active) {
      _syncFrameBgVars();
    } else {
      // 100%로 복귀 시 ::before 비활성 → 본체 배경 원복.
      // gradient / image / solid 상호배타 (I2-F1): gradient면 이미지로 덮지 않음.
      const bgVal = ss.dataset.bg || '';
      const isGradient = /gradient\s*\(/i.test(bgVal);
      if (isGradient) {
        ss.style.background = bgVal;
        ss.style.backgroundImage = '';
      } else if (ss.dataset.bgImg) {
        ss.style.backgroundImage = `url("${ss.dataset.bgImg}")`;
        ss.style.backgroundSize = 'cover';
        ss.style.backgroundPosition = ss.dataset.bgPos || 'center';
      } else if (bgVal) {
        ss.style.backgroundColor = bgVal;
      }
    }
  };
  if (bgOpaSlider && bgOpaNum) bindSlider(bgOpaSlider, bgOpaNum, applyBgOpacity, { min: 0, max: 100 });

  // 배경 이미지
  const bgImgBtn   = document.getElementById('ss-bg-img-btn');
  const bgImgInput = document.getElementById('ss-bg-img-input');
  const bgImgClear = document.getElementById('ss-bg-img-clear');
  const bgPosBtn   = document.getElementById('ss-bg-pos-btn');

  bgImgBtn.addEventListener('click', () => bgImgInput.click());
  bgImgInput.addEventListener('change', () => {
    const file = bgImgInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      ss.style.backgroundImage = `url('${e.target.result}')`;
      ss.style.backgroundSize = 'cover';
      ss.style.backgroundPosition = 'center';
      ss.dataset.bgImg = e.target.result;
      _syncFrameBgVars();
      window.scheduleAutoSave?.();
      window.pushHistory?.();
      if (!document.getElementById('ss-bg-pos-btn')) {
        const posBtn = document.createElement('button');
        posBtn.id = 'ss-bg-pos-btn';
        posBtn.className = 'prop-action-btn secondary';
        posBtn.style.cssText = 'margin-top:4px;';
        posBtn.textContent = '위치 편집';
        posBtn.addEventListener('click', () => window.enterBgPosDragMode?.(ss));
        bgImgBtn.after(posBtn);
      }
      if (!document.getElementById('ss-bg-img-clear')) {
        const clearBtn = document.createElement('button');
        clearBtn.id = 'ss-bg-img-clear';
        clearBtn.className = 'prop-action-btn danger';
        clearBtn.style.cssText = 'margin-top:4px;';
        clearBtn.textContent = '이미지 제거';
        clearBtn.addEventListener('click', removeBgImg);
        document.getElementById('ss-bg-pos-btn').after(clearBtn);
      }
    };
    reader.readAsDataURL(file);
  });

  function removeBgImg() {
    ss.style.backgroundImage = '';
    ss.style.backgroundSize = '';
    ss.style.backgroundPosition = '';
    delete ss.dataset.bgImg;
    delete ss.dataset.bgPos;
    _syncFrameBgVars();
    document.getElementById('ss-bg-pos-btn')?.remove();
    document.getElementById('ss-bg-img-clear')?.remove();
    window.scheduleAutoSave?.();
    window.pushHistory?.();
  }
  if (bgImgClear) bgImgClear.addEventListener('click', removeBgImg);
  if (bgPosBtn)   bgPosBtn.addEventListener('click', () => window.enterBgPosDragMode?.(ss));

  // 배경색 (solid + gradient)
  wireColorField('ss-bg', {
    initialAlpha: bgAlpha,
    onApply: (c) => {
      // 이전 그라데이션 제거 후 솔리드 적용
      ss.style.backgroundImage = '';
      ss.style.backgroundColor = c;
      ss.dataset.bg = c;
      _syncFrameBgVars();
      window.scheduleAutoSave?.();
    },
    onGradient: (css, commit) => {
      // 그라데이션은 backgroundColor가 아니라 background로 적용
      ss.style.backgroundColor = '';
      ss.style.background = css;
      ss.dataset.bg = css;
      _syncFrameBgVars();
      window.scheduleAutoSave?.();
      if (commit) window.pushHistory?.();
    },
    onCommit: () => window.pushHistory?.(),
  });

  // 보더
  const borderWSlider  = document.getElementById('ss-border-w-slider');
  const borderWNum     = document.getElementById('ss-border-w-num');
  const borderStyleEl  = document.getElementById('ss-border-style');
  let _borderColor = hexBorderColor;
  const applyBorder = () => {
    const w = parseInt(borderWNum.value) || 0;
    const s = borderStyleEl.value;
    const c = _borderColor;
    ss.dataset.borderWidth = w; ss.dataset.borderStyle = s; ss.dataset.borderColor = c;
    ss.style.border = w > 0 ? `${w}px ${s} ${c}` : '';
  };
  bindSlider(borderWSlider, borderWNum, () => applyBorder(), { min: 0, max: 20 });
  borderStyleEl.addEventListener('change', () => { applyBorder(); window.pushHistory?.(); window.scheduleAutoSave?.(); });
  wireColorField('ss-border', {
    initialAlpha: borderAlpha,
    onApply: (c) => { _borderColor = c; applyBorder(); },
    onCommit: () => window.pushHistory?.(),
  });

  // 코너
  const radiusSlider = document.getElementById('ss-radius-slider');
  const radiusNum    = document.getElementById('ss-radius-num');
  const applyRadius  = (v) => { ss.dataset.radius = v; ss.style.borderRadius = v + 'px'; };
  bindSlider(radiusSlider, radiusNum, applyRadius, { min: 0, max: 80 });

  // 높이
  const heightSlider = document.getElementById('ss-height-slider');
  const heightNum    = document.getElementById('ss-height-num');
  const minHeight    = isShapeFrame ? Math.min(height, 20) : 100;
  heightSlider.min   = minHeight;
  heightNum.min      = minHeight;
  const applyHeight  = (v) => {
    const newH = parseInt(v);
    if (isShapeFrame) {
      const oldH = parseInt(ss.dataset.height || ss.style.minHeight || height);
      const ratio = newH / oldH;
      if (ratio !== 1) {
        ss.querySelectorAll(':scope > [style*="position: absolute"], :scope > [style*="position:absolute"]').forEach(block => {
          const curH = parseInt(block.style.height || block.offsetHeight || 0);
          if (curH) block.style.height = Math.round(curH * ratio) + 'px';
          const curW = parseInt(block.style.width || block.offsetWidth || 0);
          if (curW) block.style.width = Math.round(curW * ratio) + 'px';
          const svg = block.querySelector('svg');
          if (svg) {
            const svgH = parseInt(svg.style.height || svg.getAttribute('height') || 0);
            const svgW = parseInt(svg.style.width  || svg.getAttribute('width')  || 0);
            if (svgH) svg.style.height = Math.round(svgH * ratio) + 'px';
            if (svgW) svg.style.width  = Math.round(svgW * ratio) + 'px';
          }
        });
        // 너비도 비례 동기화
        const curW = parseInt(ss.dataset.width || ss.offsetWidth || width);
        const newW = Math.round(curW * ratio);
        ss.style.width = newW + 'px'; ss.dataset.width = newW;
        const wSlider = document.getElementById('ss-width-slider');
        const wNum    = document.getElementById('ss-width-num');
        if (wSlider) wSlider.value = newW;
        if (wNum)    wNum.value    = newW;
      }
    }
    ss.dataset.height = newH; ss.style.minHeight = newH + 'px'; ss.style.height = newH + 'px';
  };
  bindSlider(heightSlider, heightNum, applyHeight, { min: minHeight, max: 1200 });

  // 너비
  const widthSlider = document.getElementById('ss-width-slider');
  const widthNum    = document.getElementById('ss-width-num');
  const applyWidth  = (v) => {
    const oldW = parseInt(ss.dataset.width) || ss.offsetWidth || (isShapeFrame ? 100 : 860);
    const newW = parseInt(v);
    const ratio = newW / oldW;
    if (ratio !== 1) {
      ss.querySelectorAll(':scope > [style*="position: absolute"], :scope > [style*="position:absolute"]').forEach(block => {
        const curLeft  = parseInt(block.style.left  || 0);
        const curW = parseInt(block.style.width || block.offsetWidth || 0);
        block.style.left = Math.round(curLeft * ratio) + 'px';
        if (curW) block.style.width = Math.round(curW * ratio) + 'px';
        if (isShapeFrame) {
          // shape frame: height도 비례 스케일
          const curH = parseInt(block.style.height || block.offsetHeight || 0);
          if (curH) block.style.height = Math.round(curH * ratio) + 'px';
          // SVG도 비례 스케일
          const svg = block.querySelector('svg');
          if (svg) {
            const svgW = parseInt(svg.style.width || svg.getAttribute('width') || 0);
            const svgH = parseInt(svg.style.height || svg.getAttribute('height') || 0);
            if (svgW) svg.style.width = Math.round(svgW * ratio) + 'px';
            if (svgH) svg.style.height = Math.round(svgH * ratio) + 'px';
          }
        }
      });
      if (isShapeFrame) {
        // inner/block/svg는 CSS height:100%로 ss를 따름 — inline 스케일 불필요
        // frame min-height 비례 스케일
        const curFrameH = parseInt(ss.dataset.height || ss.style.minHeight || 0);
        if (curFrameH) {
          const newH = Math.round(curFrameH * ratio);
          ss.style.minHeight = newH + 'px'; ss.style.height = newH + 'px';
          ss.dataset.height = newH;
          const hSlider = document.getElementById('ss-height-slider');
          const hNum    = document.getElementById('ss-height-num');
          if (hSlider) hSlider.value = newH;
          if (hNum)    hNum.value    = newH;
        }
      }
    }
    ss.dataset.width = newW; ss.style.width = newW + 'px';
    ss.style.margin = '0 auto'; ss.style.alignSelf = 'center';
  };
  bindSlider(widthSlider, widthNum, applyWidth, { min: minWidth, max: 860 });

  // 패딩
  const padYSlider = document.getElementById('ss-pady-slider');
  const padYNum    = document.getElementById('ss-pady-num');
  const applyPadY  = (v) => { ss.dataset.padY = v; ss.style.paddingTop = v + 'px'; ss.style.paddingBottom = v + 'px'; };
  bindSlider(padYSlider, padYNum, applyPadY, { min: 0, max: 200 });

  // 컴포넌트 저장
  const ssTplFolderSel = document.getElementById('ss-tpl-folder');
  const ssTplFolderNew = document.getElementById('ss-tpl-folder-new');
  ssTplFolderSel?.addEventListener('change', () => {
    if (ssTplFolderNew) ssTplFolderNew.style.display = ssTplFolderSel.value === '__new__' ? 'block' : 'none';
  });
  const ssTplSaveBtn = document.getElementById('ss-tpl-save-btn');
  ssTplSaveBtn?.addEventListener('click', () => {
    const name = document.getElementById('ss-tpl-name')?.value.trim();
    if (!name) { document.getElementById('ss-tpl-name')?.focus(); return; }
    const category = document.getElementById('ss-tpl-cat')?.value;
    let folder = ssTplFolderSel?.value || '기타';
    if (folder === '__new__') folder = (ssTplFolderNew?.value.trim()) || '기타';
    window.saveAsTemplate?.(ss, name, folder, category, [], 'subsection');
    document.getElementById('ss-tpl-name').value = '';
    ssTplSaveBtn.textContent = '저장됨 ✓';
    ssTplSaveBtn.disabled = true;
    setTimeout(() => { if (ssTplSaveBtn) { ssTplSaveBtn.textContent = '컴포넌트로 저장'; ssTplSaveBtn.disabled = false; } }, 1500);
  });
}

/* ════════════════════════════════════════
   공개 API
════════════════════════════════════════ */
export function showFrameProperties(el) {
  _renderAutoPanel(el);
}

window.showFrameProperties      = showFrameProperties;
window.showFrameProperties = el => showFrameProperties(el);
