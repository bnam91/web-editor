/* ══════════════════════════════════════
   PROP-FRAME — Frame 통합 속성 패널
   sub-section-block (Auto 모드) + canvas-block (Free 모드) 통합
══════════════════════════════════════ */
import { propPanel } from './globals.js';

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

/* ── 공통 헤더: Frame 이름 + 모드 토글 ── */
function _headerHTML(el, mode) {
  const id = el.id || '';
  const shapeBlock = el.querySelector?.('.shape-block');
  const shapeType  = shapeBlock?.dataset?.shapeType || null;
  const iconSvg    = shapeType ? (_SHAPE_ICONS[shapeType] || _FRAME_ICON) : _FRAME_ICON;
  return `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          ${iconSvg}
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${el.dataset.layerName || 'Frame'}</span>
        </div>
        ${id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="navigator.clipboard.writeText('${id}')">${id}</span>` : ''}
      </div>
      <div style="display:flex;gap:4px;margin-top:8px;">
        <button class="prop-align-btn${mode === 'auto' ? ' active' : ''}" id="frame-mode-auto" style="flex:1;font-size:11px;">Auto</button>
        <button class="prop-align-btn${mode === 'free' ? ' active' : ''}" id="frame-mode-free" style="flex:1;font-size:11px;">Free</button>
      </div>
    </div>`;
}

/* ════════════════════════════════════════
   AUTO 모드 (sub-section-block)
════════════════════════════════════════ */
function _renderAutoPanel(ss) {
  const isShapeFrame = !!ss.querySelector('.shape-block');
  const rawBg  = ss.style.backgroundColor || ss.dataset.bg || '#f5f5f5';
  const hexBg  = rgbToHex(rawBg);
  const padY   = parseInt(ss.dataset.padY)   || 0;
  const width  = parseInt(ss.dataset.width)  || (isShapeFrame ? 100 : 780);
  const height = parseInt(ss.dataset.height) || (isShapeFrame ? 100 : 520);
  const minWidth = isShapeFrame ? Math.min(width, 20) : 200;
  const hasBgImg = ss.style.backgroundImage && ss.style.backgroundImage !== 'none';
  const borderWidth = parseInt(ss.dataset.borderWidth) || 0;
  const borderStyle = ss.dataset.borderStyle || 'solid';
  const hexBorderColor = rgbToHex(ss.style.borderColor || ss.dataset.borderColor || '#888888');
  const radius = parseInt(ss.dataset.radius) || 0;

  propPanel.innerHTML = _headerHTML(ss, 'auto') + `
    <div class="prop-section">
      <div class="prop-section-title">배경</div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        <div class="prop-color-swatch" style="background:${hexBg}">
          <input type="color" id="ss-bg-color" value="${hexBg}">
        </div>
        <input type="text" class="prop-color-hex" id="ss-bg-hex" value="${hexBg}" maxlength="7">
      </div>
      <div class="prop-section-title" style="margin-top:10px;">배경 이미지</div>
      <button class="prop-action-btn secondary" id="ss-bg-img-btn" style="margin-top:6px;">이미지 선택</button>
      <input type="file" id="ss-bg-img-input" accept="image/*" style="display:none">
      ${hasBgImg ? `
        <button class="prop-action-btn secondary" id="ss-bg-pos-btn" style="margin-top:4px;">위치 편집</button>
        <button class="prop-action-btn" id="ss-bg-img-clear" style="margin-top:4px;background:#3a2a2a;color:#e06c6c;">이미지 제거</button>
      ` : ''}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">보더</div>
      <div class="prop-row">
        <span class="prop-label">두께</span>
        <input type="range" class="prop-slider" id="ss-border-w-slider" min="0" max="20" step="1" value="${borderWidth}">
        <input type="number" class="prop-number" id="ss-border-w-num" min="0" max="20" value="${borderWidth}">
      </div>
      <div class="prop-row" style="margin-top:6px;">
        <span class="prop-label">스타일</span>
        <select class="prop-select" id="ss-border-style" style="flex:1;background:#2a2a2a;color:#ccc;border:1px solid #3a3a3a;border-radius:4px;padding:3px 6px;font-size:12px;">
          <option value="solid"  ${borderStyle === 'solid'  ? 'selected' : ''}>Solid</option>
          <option value="dashed" ${borderStyle === 'dashed' ? 'selected' : ''}>Dashed</option>
          <option value="dotted" ${borderStyle === 'dotted' ? 'selected' : ''}>Dotted</option>
        </select>
      </div>
      <div class="prop-color-row" style="margin-top:6px;">
        <span class="prop-label">색상</span>
        <div class="prop-color-swatch" style="background:${hexBorderColor}">
          <input type="color" id="ss-border-color" value="${hexBorderColor}">
        </div>
        <input type="text" class="prop-color-hex" id="ss-border-color-hex" value="${hexBorderColor}" maxlength="7">
      </div>
      <div class="prop-row" style="margin-top:6px;">
        <span class="prop-label">코너</span>
        <input type="range" class="prop-slider" id="ss-radius-slider" min="0" max="80" step="1" value="${radius}">
        <input type="number" class="prop-number" id="ss-radius-num" min="0" max="80" value="${radius}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">크기</div>
      <div class="prop-row">
        <span class="prop-label">너비</span>
        <input type="range" class="prop-slider" id="ss-width-slider" min="${minWidth}" max="860" step="10" value="${width}">
        <input type="number" class="prop-number" id="ss-width-num" min="${minWidth}" max="860" value="${width}">
      </div>
      <div class="prop-row" style="margin-top:6px;">
        <span class="prop-label">높이</span>
        <input type="range" class="prop-slider" id="ss-height-slider" min="100" max="1200" step="10" value="${height}">
        <input type="number" class="prop-number" id="ss-height-num" min="100" max="1200" value="${height}">
      </div>
      <div class="prop-row" style="margin-top:6px;">
        <span class="prop-label">상/하 여백</span>
        <input type="range" class="prop-slider" id="ss-pady-slider" min="0" max="200" step="4" value="${padY}">
        <input type="number" class="prop-number" id="ss-pady-num" min="0" max="200" value="${padY}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">위치</div>
      <div class="prop-row" style="margin-top:6px;gap:6px;">
        <span class="prop-label" style="width:16px;flex-shrink:0;">X</span>
        <input type="number" class="prop-number" id="ss-pos-x" style="flex:1;" value="${parseInt(ss.dataset.translateX) || 0}">
        <span class="prop-label" style="width:16px;flex-shrink:0;margin-left:4px;">Y</span>
        <input type="number" class="prop-number" id="ss-pos-y" style="flex:1;" value="${parseInt(ss.dataset.translateY) || 0}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">자식 정렬</div>
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
        <input type="range" class="prop-slider" id="ss-gap-slider" min="0" max="80" step="2" value="${parseInt(ss.querySelector('.sub-section-inner')?.style.gap) || 0}">
        <input type="number" class="prop-number" id="ss-gap-num" min="0" max="80" value="${parseInt(ss.querySelector('.sub-section-inner')?.style.gap) || 0}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">회전 / 반전</div>
      <div class="prop-row" style="margin-top:6px;gap:6px;">
        <span class="prop-label" style="flex-shrink:0;">각도</span>
        <input type="number" class="prop-number" id="ss-rotate-deg" style="width:56px;" min="-360" max="360" value="${parseInt(ss.dataset.rotateDeg) || 0}">
        <span class="prop-label" style="flex-shrink:0;margin-left:2px;">°</span>
        <div style="display:flex;gap:3px;margin-left:auto;">
          <button class="prop-align-btn" id="ss-rotate-90" title="90° 시계 방향 회전"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" d="M11.5 4.5A5 5 0 1 0 13 8"/><path fill="currentColor" d="M11.5 2v4h-4l2-2a3.5 3.5 0 0 1 2 1.5z" style="display:none"/><polyline stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" points="9,2 12,4.5 9.5,7.5"/></svg></button>
          <button class="prop-align-btn" id="ss-flip-h" title="좌우 반전"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M8 2v12M4 4l-2 4 2 4M12 4l2 4-2 4"/><path fill="currentColor" opacity=".35" d="M8 5v6l-4-3z"/></svg></button>
          <button class="prop-align-btn" id="ss-flip-v" title="상하 반전"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M2 8h12M4 4l4-2 4 2M4 12l4 2 4-2"/><path fill="currentColor" opacity=".35" d="M5 8h6l-3 4z"/></svg></button>
        </div>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">컴포넌트</div>
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
      <div class="prop-hint" style="font-size:11px;color:#999;">Frame 클릭 후 플로팅 패널에서 블록을 추가하면 이 안으로 들어갑니다.</div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(ss.id || null);

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

  // ── 자식 정렬 핸들러 ──
  const ssInner = ss.querySelector('.sub-section-inner');
  const _setAlign = (alignItems, justifyContent) => {
    if (!ssInner) return;
    if (alignItems !== null) {
      ssInner.style.alignItems = alignItems;
      ss.dataset.alignItems = alignItems;
      // 자식 row의 align-self / margin이 align-items를 덮어쓰는 문제 수정
      // margin: 0 auto 와 align-self: center 가 부모 align-items를 무시하므로 함께 리셋
      const alignSelfMap = { 'flex-start': 'flex-start', 'center': 'center', 'flex-end': 'flex-end' };
      const marginMap    = { 'flex-start': '0',          'center': '0 auto',  'flex-end': '0' };
      ssInner.querySelectorAll(':scope > .row').forEach(row => {
        row.style.alignSelf = alignSelfMap[alignItems] || '';
        row.style.margin    = marginMap[alignItems]    || '0';
      });
    }
    if (justifyContent !== null) { ssInner.style.justifyContent = justifyContent; ss.dataset.justifyContent = justifyContent; }
    window.scheduleAutoSave?.();
  };
  const _setGap = v => {
    if (!ssInner) return;
    ssInner.style.gap = v + 'px';
    ss.dataset.gap = String(v);
    window.scheduleAutoSave?.();
  };

  // 현재 상태 반영
  const curAlignItems    = ssInner?.style.alignItems    || ss.dataset.alignItems    || 'flex-start';
  const curJustifyContent= ssInner?.style.justifyContent|| ss.dataset.justifyContent|| 'flex-start';
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

  document.getElementById('ss-align-left')?.addEventListener('click',    () => { _setAlign('flex-start', null); _markAlignActive('ss-align-left',    hGroup); });
  document.getElementById('ss-align-hcenter')?.addEventListener('click', () => { _setAlign('center',     null); _markAlignActive('ss-align-hcenter', hGroup); });
  document.getElementById('ss-align-right')?.addEventListener('click',   () => { _setAlign('flex-end',   null); _markAlignActive('ss-align-right',   hGroup); });

  document.getElementById('ss-align-top')?.addEventListener('click',     () => { _setAlign(null, 'flex-start'); _markAlignActive('ss-align-top',    vGroup); });
  document.getElementById('ss-align-vcenter')?.addEventListener('click', () => { _setAlign(null, 'center');     _markAlignActive('ss-align-vcenter', vGroup); });
  document.getElementById('ss-align-bottom')?.addEventListener('click',  () => { _setAlign(null, 'flex-end');   _markAlignActive('ss-align-bottom',  vGroup); });

  const gapSlider = document.getElementById('ss-gap-slider');
  const gapNum    = document.getElementById('ss-gap-num');
  gapSlider?.addEventListener('input', () => { gapNum.value = gapSlider.value; _setGap(parseInt(gapSlider.value)); });
  gapNum?.addEventListener('input',    () => { gapSlider.value = gapNum.value; _setGap(parseInt(gapNum.value) || 0); });

  // ── 회전 / 반전 핸들러 ──
  document.getElementById('ss-rotate-deg')?.addEventListener('input', e => {
    ss.dataset.rotateDeg = parseFloat(e.target.value) || 0;
    _applyTransform();
  });
  document.getElementById('ss-rotate-90')?.addEventListener('click', () => {
    const cur = parseFloat(ss.dataset.rotateDeg) || 0;
    const next = (cur + 90) % 360;
    ss.dataset.rotateDeg = next;
    const inp = document.getElementById('ss-rotate-deg');
    if (inp) inp.value = next;
    _applyTransform();
  });
  document.getElementById('ss-flip-h')?.addEventListener('click', () => {
    ss.dataset.flipH = ss.dataset.flipH === '1' ? '0' : '1';
    document.getElementById('ss-flip-h')?.classList.toggle('active', ss.dataset.flipH === '1');
    _applyTransform();
  });
  document.getElementById('ss-flip-v')?.addEventListener('click', () => {
    ss.dataset.flipV = ss.dataset.flipV === '1' ? '0' : '1';
    document.getElementById('ss-flip-v')?.classList.toggle('active', ss.dataset.flipV === '1');
    _applyTransform();
  });
  // 초기 flip 상태 반영
  if (ss.dataset.flipH === '1') document.getElementById('ss-flip-h')?.classList.add('active');
  if (ss.dataset.flipV === '1') document.getElementById('ss-flip-v')?.classList.add('active');

  // 모드 토글
  document.getElementById('frame-mode-auto')?.addEventListener('click', () => {});
  document.getElementById('frame-mode-free')?.addEventListener('click', () => {
    if (!confirm('Free 모드로 전환하면 되돌릴 수 없습니다.\n내부 블록들이 현재 위치에 고정됩니다.\n계속할까요?')) return;
    window.convertSubSectionToCanvas?.(ss);
  });

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
        clearBtn.className = 'prop-action-btn';
        clearBtn.style.cssText = 'margin-top:4px;background:#3a2a2a;color:#e06c6c;';
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
    document.getElementById('ss-bg-pos-btn')?.remove();
    document.getElementById('ss-bg-img-clear')?.remove();
    window.scheduleAutoSave?.();
    window.pushHistory?.();
  }
  if (bgImgClear) bgImgClear.addEventListener('click', removeBgImg);
  if (bgPosBtn)   bgPosBtn.addEventListener('click', () => window.enterBgPosDragMode?.(ss));

  // 배경색
  const bgColor = document.getElementById('ss-bg-color');
  const bgHex   = document.getElementById('ss-bg-hex');
  const applyBg = (hex) => { ss.style.backgroundColor = hex; ss.dataset.bg = hex; window.scheduleAutoSave?.(); };
  bgColor.addEventListener('input', () => { bgHex.value = bgColor.value; applyBg(bgColor.value); });
  bgColor.addEventListener('change', () => window.pushHistory?.());
  bgHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(bgHex.value)) { bgColor.value = bgHex.value; applyBg(bgHex.value); }
  });

  // 보더
  const borderWSlider  = document.getElementById('ss-border-w-slider');
  const borderWNum     = document.getElementById('ss-border-w-num');
  const borderStyleEl  = document.getElementById('ss-border-style');
  const borderColorEl  = document.getElementById('ss-border-color');
  const borderColorHex = document.getElementById('ss-border-color-hex');
  const applyBorder = () => {
    const w = parseInt(borderWNum.value) || 0;
    const s = borderStyleEl.value;
    const c = borderColorHex.value;
    ss.dataset.borderWidth = w; ss.dataset.borderStyle = s; ss.dataset.borderColor = c;
    ss.style.border = w > 0 ? `${w}px ${s} ${c}` : '';
    window.scheduleAutoSave?.();
  };
  borderWSlider.addEventListener('input', () => { borderWNum.value = borderWSlider.value; applyBorder(); });
  borderWSlider.addEventListener('change', () => window.pushHistory?.());
  borderWNum.addEventListener('change', () => window.pushHistory?.());
  borderWNum.addEventListener('input', () => { borderWSlider.value = Math.min(20, Math.max(0, parseInt(borderWNum.value) || 0)); applyBorder(); });
  borderStyleEl.addEventListener('change', () => { applyBorder(); window.pushHistory?.(); });
  borderColorEl.addEventListener('input', () => { borderColorHex.value = borderColorEl.value; applyBorder(); });
  borderColorEl.addEventListener('change', () => window.pushHistory?.());
  borderColorHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(borderColorHex.value)) { borderColorEl.value = borderColorHex.value; applyBorder(); }
  });

  // 코너
  const radiusSlider = document.getElementById('ss-radius-slider');
  const radiusNum    = document.getElementById('ss-radius-num');
  const applyRadius  = (v) => { ss.dataset.radius = v; ss.style.borderRadius = v + 'px'; window.scheduleAutoSave?.(); };
  radiusSlider.addEventListener('input', () => { radiusNum.value = radiusSlider.value; applyRadius(radiusSlider.value); });
  radiusSlider.addEventListener('change', () => window.pushHistory?.());
  radiusNum.addEventListener('input', () => { const v = Math.min(80, Math.max(0, parseInt(radiusNum.value) || 0)); radiusSlider.value = v; applyRadius(v); });
  radiusNum.addEventListener('change', () => window.pushHistory?.());

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
      const inner = ss.querySelector('.sub-section-inner');
      if (inner && ratio !== 1) {
        if (inner.style.height) inner.style.height = Math.round(parseInt(inner.style.height) * ratio) + 'px';
        inner.querySelectorAll('[style*="position: absolute"], [style*="position:absolute"]').forEach(block => {
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
    window.scheduleAutoSave?.();
  };
  heightSlider.addEventListener('input', () => { heightNum.value = heightSlider.value; applyHeight(heightSlider.value); });
  heightSlider.addEventListener('change', () => window.pushHistory?.());
  heightNum.addEventListener('input', () => { const v = Math.min(1200, Math.max(minHeight, parseInt(heightNum.value) || height)); heightSlider.value = v; applyHeight(v); });
  heightNum.addEventListener('change', () => window.pushHistory?.());

  // 너비
  const widthSlider = document.getElementById('ss-width-slider');
  const widthNum    = document.getElementById('ss-width-num');
  const applyWidth  = (v) => {
    const oldW = parseInt(ss.dataset.width) || ss.offsetWidth || (isShapeFrame ? 100 : 860);
    const newW = parseInt(v);
    const ratio = newW / oldW;
    const inner = ss.querySelector('.sub-section-inner');
    if (inner && ratio !== 1) {
      inner.querySelectorAll('[style*="position: absolute"], [style*="position:absolute"]').forEach(block => {
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
    window.scheduleAutoSave?.();
  };
  widthSlider.addEventListener('input', () => { widthNum.value = widthSlider.value; applyWidth(widthSlider.value); });
  widthSlider.addEventListener('change', () => window.pushHistory?.());
  widthNum.addEventListener('input', () => { const v = Math.min(860, Math.max(minWidth, parseInt(widthNum.value) || width)); widthSlider.value = v; applyWidth(v); });
  widthNum.addEventListener('change', () => window.pushHistory?.());

  // 패딩
  const padYSlider = document.getElementById('ss-pady-slider');
  const padYNum    = document.getElementById('ss-pady-num');
  const applyPadY  = (v) => { ss.dataset.padY = v; ss.style.paddingTop = v + 'px'; ss.style.paddingBottom = v + 'px'; window.scheduleAutoSave?.(); };
  padYSlider.addEventListener('input', () => { padYNum.value = padYSlider.value; applyPadY(padYSlider.value); });
  padYSlider.addEventListener('change', () => window.pushHistory?.());
  padYNum.addEventListener('input', () => { const v = Math.min(200, Math.max(0, parseInt(padYNum.value) || 0)); padYSlider.value = v; applyPadY(v); });
  padYNum.addEventListener('change', () => window.pushHistory?.());

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
   FREE 모드 (canvas-block)
════════════════════════════════════════ */
function _renderFreePanel(cb) {
  const h  = parseInt(cb.style.height) || 500;
  const bg = cb.dataset.bg || '#f8f8f8';

  propPanel.innerHTML = _headerHTML(cb, 'free') + `
    <div class="prop-section">
      <div class="prop-section-title">크기</div>
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range"  class="prop-slider" id="cb-h-slider" min="100" max="2000" step="10" value="${h}">
        <input type="number" class="prop-number" id="cb-h-number" min="100" max="2000" value="${h}">
      </div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        <div class="prop-color-swatch" style="background:${bg}">
          <input type="color" id="cb-bg-color" value="${bg}">
        </div>
        <input type="text" class="prop-color-hex" id="cb-bg-hex" value="${bg}" maxlength="7">
        <button class="prop-align-btn" id="cb-bg-clear">초기화</button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">요소 추가</div>
      <button class="prop-action-btn primary"   id="cb-add-image">이미지 추가</button>
      <button class="prop-action-btn secondary" id="cb-add-text">텍스트 추가</button>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(cb.id || null);

  // 모드 토글
  document.getElementById('frame-mode-auto')?.addEventListener('click', () => {
    window.showToast?.('Auto 모드로 되돌리기는 지원하지 않습니다.');
  });
  document.getElementById('frame-mode-free')?.addEventListener('click', () => {});

  // 높이
  const hSlider = document.getElementById('cb-h-slider');
  const hNumber = document.getElementById('cb-h-number');
  hSlider.addEventListener('input', () => { cb.style.height = hSlider.value + 'px'; hNumber.value = hSlider.value; });
  hSlider.addEventListener('change', () => window.pushHistory?.());
  hNumber.addEventListener('change', () => {
    const v = Math.min(2000, Math.max(100, parseInt(hNumber.value) || 500));
    cb.style.height = v + 'px'; hSlider.value = v; window.pushHistory?.();
  });

  // 배경색
  const bgInput  = document.getElementById('cb-bg-color');
  const bgHex    = document.getElementById('cb-bg-hex');
  const bgSwatch = bgHex?.previousElementSibling;
  const applyBg  = val => {
    cb.style.background = val; cb.dataset.bg = val;
    bgInput.value = val; bgHex.value = val;
    if (bgSwatch) bgSwatch.style.background = val;
  };
  bgInput.addEventListener('input', e => applyBg(e.target.value));
  bgInput.addEventListener('change', () => window.pushHistory?.());
  bgHex.addEventListener('change', e => {
    const v = e.target.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) { applyBg(v); window.pushHistory?.(); }
  });
  document.getElementById('cb-bg-clear').addEventListener('click', () => { applyBg('#f8f8f8'); window.pushHistory?.(); });

  // 이미지 추가
  document.getElementById('cb-add-image').addEventListener('click', () => {
    const item = window.addItemToCanvas(cb, 'image');
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        item.dataset.src = ev.target.result;
        let img = item.querySelector('.ci-img');
        if (!img) {
          img = document.createElement('img');
          img.className = 'ci-img'; img.draggable = false;
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;border-radius:inherit;';
          item.appendChild(img);
        }
        img.src = ev.target.result;
        window.pushHistory?.();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  });

  document.getElementById('cb-add-text').addEventListener('click', () => window.addItemToCanvas(cb, 'text'));
}

/* ════════════════════════════════════════
   공개 API
════════════════════════════════════════ */
export function showFrameProperties(el) {
  if (el.classList.contains('canvas-block')) {
    _renderFreePanel(el);
  } else {
    _renderAutoPanel(el);
  }
}

/* ════════════════════════════════════════
   Canvas Item 속성 패널 (Free 모드 내부 요소)
════════════════════════════════════════ */
export function showCanvasItemProperties(cb, item) {
  const x = Math.round(parseFloat(item.dataset.x) || 0);
  const y = Math.round(parseFloat(item.dataset.y) || 0);
  const w = Math.round(parseFloat(item.dataset.w) || 200);
  const h = Math.round(parseFloat(item.dataset.h) || 100);
  const type = item.dataset.type;
  const typeLabel = type === 'image' ? '이미지' : '텍스트';
  const textEl0   = item.querySelector('.ci-text');
  const fontSize  = parseInt(textEl0?.style.fontSize) || 24;
  const textColor = textEl0?.style.color || '#111111';
  const textAlign = textEl0?.style.textAlign || item.dataset.textAlign || 'left';
  const isBold    = (textEl0?.style.fontWeight === 'bold' || textEl0?.style.fontWeight === '700') || item.dataset.bold === 'true';
  const isItalic  = textEl0?.style.fontStyle === 'italic' || item.dataset.italic === 'true';
  const fitMode   = item.dataset.fitMode || 'cover';
  const radius    = parseInt(item.dataset.radius) || 0;
  const opacity   = Math.round((parseFloat(item.dataset.opacity) ?? 1) * 100);

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            ${type === 'image'
              ? '<rect x="1" y="1" width="10" height="10" rx="1"/><circle cx="4" cy="4" r="1"/><polyline points="11 8 8 5 3 11"/>'
              : '<line x1="2" y1="3" x2="10" y2="3"/><line x1="2" y1="6" x2="8" y2="6"/><line x1="2" y1="9" x2="6" y2="9"/>'}
          </svg>
        </div>
        <span class="prop-block-name">${typeLabel} 요소</span>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">위치 / 크기</div>
      <div class="prop-row">
        <span class="prop-icon-label">X</span>
        <input type="number" class="prop-number" id="ci-x" value="${x}">
        <span class="prop-icon-label">Y</span>
        <input type="number" class="prop-number" id="ci-y" value="${y}">
      </div>
      <div class="prop-row">
        <span class="prop-icon-label">W</span>
        <input type="number" class="prop-number" id="ci-w" value="${w}">
        <span class="prop-icon-label">H</span>
        <input type="number" class="prop-number" id="ci-h" value="${h}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">스타일</div>
      <div class="prop-row">
        <span class="prop-label">모서리</span>
        <input type="range"  class="prop-slider" id="ci-radius-slider" min="0" max="200" value="${radius}" style="flex:1">
        <input type="number" class="prop-number" id="ci-radius" value="${radius}" min="0" max="200" style="width:48px">
      </div>
      <div class="prop-row">
        <span class="prop-label">투명도</span>
        <input type="range"  class="prop-slider" id="ci-opacity-slider" min="0" max="100" value="${opacity}" style="flex:1">
        <input type="number" class="prop-number" id="ci-opacity" value="${opacity}" min="0" max="100" style="width:48px">
      </div>
    </div>
    ${type === 'text' ? `
    <div class="prop-section">
      <div class="prop-section-title">텍스트</div>
      <div class="prop-row">
        <span class="prop-label">크기</span>
        <input type="number" class="prop-number" id="ci-fs" value="${fontSize}" min="8" max="400">
      </div>
      <div class="prop-color-row">
        <span class="prop-label">색상</span>
        <div class="prop-color-swatch" style="background:${textColor}">
          <input type="color" id="ci-color" value="${textColor}">
        </div>
        <input type="text" class="prop-color-hex" id="ci-color-hex" value="${textColor}" maxlength="7">
      </div>
      <div class="prop-row" style="margin-top:6px">
        <span class="prop-label">서식</span>
        <div class="prop-align-group" style="flex:1">
          <button class="prop-align-btn ci-bold-btn${isBold?' active':''}" title="굵게" style="font-weight:700">B</button>
          <button class="prop-align-btn ci-italic-btn${isItalic?' active':''}" title="기울임" style="font-style:italic">I</button>
        </div>
      </div>
      <div class="prop-row" style="margin-top:6px">
        <span class="prop-label">정렬</span>
        <div class="prop-align-group" style="flex:1">
          <button class="prop-align-btn ci-align-btn${textAlign==='left'?' active':''}"   data-align="left">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><line x1="1" y1="3" x2="11" y2="3"/><line x1="1" y1="6" x2="7" y2="6"/><line x1="1" y1="9" x2="9" y2="9"/></svg>
          </button>
          <button class="prop-align-btn ci-align-btn${textAlign==='center'?' active':''}" data-align="center">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><line x1="1" y1="3" x2="11" y2="3"/><line x1="2.5" y1="6" x2="9.5" y2="6"/><line x1="1.5" y1="9" x2="10.5" y2="9"/></svg>
          </button>
          <button class="prop-align-btn ci-align-btn${textAlign==='right'?' active':''}"  data-align="right">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><line x1="1" y1="3" x2="11" y2="3"/><line x1="5" y1="6" x2="11" y2="6"/><line x1="3" y1="9" x2="11" y2="9"/></svg>
          </button>
        </div>
      </div>
    </div>` : ''}
    ${type === 'image' ? `
    <div class="prop-section">
      <div class="prop-section-title">이미지 맞춤</div>
      <div class="prop-align-group">
        <button class="prop-align-btn ci-fit-btn${fitMode==='cover'?' active':''}"   data-fit="cover">Cover</button>
        <button class="prop-align-btn ci-fit-btn${fitMode==='contain'?' active':''}" data-fit="contain">Contain</button>
        <button class="prop-align-btn ci-fit-btn${fitMode==='fill'?' active':''}"    data-fit="fill">Fill</button>
      </div>
    </div>` : ''}
    <div class="prop-section">
      <div class="prop-section-title">정렬 (Frame 기준)</div>
      <div class="prop-align-group" style="flex-wrap:wrap;gap:4px">
        <button class="prop-align-btn ci-pos-btn" data-pos="left">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><line x1="1" y1="1" x2="1" y2="13"/><rect x="3" y="4" width="5" height="6" rx="1"/></svg>
        </button>
        <button class="prop-align-btn ci-pos-btn" data-pos="hcenter">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><line x1="7" y1="1" x2="7" y2="13"/><rect x="3" y="4" width="8" height="6" rx="1"/></svg>
        </button>
        <button class="prop-align-btn ci-pos-btn" data-pos="right">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><line x1="13" y1="1" x2="13" y2="13"/><rect x="6" y="4" width="5" height="6" rx="1"/></svg>
        </button>
        <button class="prop-align-btn ci-pos-btn" data-pos="top">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><line x1="1" y1="1" x2="13" y2="1"/><rect x="4" y="3" width="6" height="5" rx="1"/></svg>
        </button>
        <button class="prop-align-btn ci-pos-btn" data-pos="vcenter">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><line x1="1" y1="7" x2="13" y2="7"/><rect x="4" y="3" width="6" height="8" rx="1"/></svg>
        </button>
        <button class="prop-align-btn ci-pos-btn" data-pos="bottom">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><line x1="1" y1="13" x2="13" y2="13"/><rect x="4" y="6" width="6" height="5" rx="1"/></svg>
        </button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">레이어 순서</div>
      <div class="prop-align-group">
        <button class="prop-align-btn" id="ci-bring">↑ 앞으로</button>
        <button class="prop-align-btn" id="ci-send">↓ 뒤로</button>
      </div>
    </div>
    <div class="prop-section">
      <button class="prop-action-btn secondary" id="ci-back-cb">← Frame 속성</button>
      <button class="prop-action-btn secondary" id="ci-duplicate">복제 (⌘D)</button>
      <button class="prop-action-btn danger"    id="ci-delete">요소 삭제</button>
    </div>`;

  // 위치/크기
  const applyGeom = () => {
    const nx = parseInt(document.getElementById('ci-x')?.value) || 0;
    const ny = parseInt(document.getElementById('ci-y')?.value) || 0;
    const nw = Math.max(40, parseInt(document.getElementById('ci-w')?.value) || 40);
    const nh = Math.max(20, parseInt(document.getElementById('ci-h')?.value) || 20);
    item.dataset.x = nx; item.dataset.y = ny; item.dataset.w = nw; item.dataset.h = nh;
    item.style.left = nx+'px'; item.style.top = ny+'px'; item.style.width = nw+'px'; item.style.height = nh+'px';
    window.syncCanvasItemHandles?.(item);
  };
  ['ci-x','ci-y','ci-w','ci-h'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => { applyGeom(); window.pushHistory?.(); });
  });

  // 모서리
  const radiusSlider = document.getElementById('ci-radius-slider');
  const radiusNum    = document.getElementById('ci-radius');
  const applyRadius  = v => { item.dataset.radius = v; item.style.borderRadius = v+'px'; const img = item.querySelector('.ci-img'); if (img) img.style.borderRadius = v+'px'; };
  radiusSlider?.addEventListener('input', () => { applyRadius(parseInt(radiusSlider.value)); radiusNum.value = radiusSlider.value; });
  radiusSlider?.addEventListener('change', () => window.pushHistory?.());
  radiusNum?.addEventListener('change', () => { const v = Math.min(200, Math.max(0, parseInt(radiusNum.value)||0)); applyRadius(v); radiusSlider.value = v; window.pushHistory?.(); });

  // 투명도
  const opacitySlider = document.getElementById('ci-opacity-slider');
  const opacityNum    = document.getElementById('ci-opacity');
  const applyOpacity  = v => { const pct = Math.min(100, Math.max(0, v)); item.dataset.opacity = (pct/100).toFixed(2); item.style.opacity = pct/100; };
  opacitySlider?.addEventListener('input', () => { applyOpacity(parseInt(opacitySlider.value)); opacityNum.value = opacitySlider.value; });
  opacitySlider?.addEventListener('change', () => window.pushHistory?.());
  opacityNum?.addEventListener('change', () => { const v = Math.min(100, Math.max(0, parseInt(opacityNum.value)??100)); applyOpacity(v); opacitySlider.value = v; window.pushHistory?.(); });

  // 텍스트 속성
  if (type === 'text') {
    const textEl    = item.querySelector('.ci-text');
    const colorIn   = document.getElementById('ci-color');
    const colorHex  = document.getElementById('ci-color-hex');
    const colorSwatch = colorHex?.previousElementSibling;
    const applyColor = val => {
      if (textEl) textEl.style.color = val;
      if (colorIn) colorIn.value = val; if (colorHex) colorHex.value = val;
      if (colorSwatch) colorSwatch.style.background = val;
    };
    document.getElementById('ci-fs')?.addEventListener('change', e => { const v = Math.min(400, Math.max(8, parseInt(e.target.value)||24)); if (textEl) textEl.style.fontSize = v+'px'; window.pushHistory?.(); });
    colorIn?.addEventListener('input', e => applyColor(e.target.value));
    colorIn?.addEventListener('change', () => window.pushHistory?.());
    colorHex?.addEventListener('change', e => { const v = e.target.value.trim(); if (/^#[0-9a-fA-F]{6}$/.test(v)) { applyColor(v); window.pushHistory?.(); } });
    document.querySelector('.ci-bold-btn')?.addEventListener('click', () => {
      const nowBold = item.dataset.bold === 'true'; item.dataset.bold = nowBold ? 'false' : 'true';
      if (textEl) textEl.style.fontWeight = nowBold ? '' : 'bold';
      document.querySelector('.ci-bold-btn')?.classList.toggle('active', !nowBold); window.pushHistory?.();
    });
    document.querySelector('.ci-italic-btn')?.addEventListener('click', () => {
      const nowItalic = item.dataset.italic === 'true'; item.dataset.italic = nowItalic ? 'false' : 'true';
      if (textEl) textEl.style.fontStyle = nowItalic ? '' : 'italic';
      document.querySelector('.ci-italic-btn')?.classList.toggle('active', !nowItalic); window.pushHistory?.();
    });
    document.querySelectorAll('.ci-align-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const align = btn.dataset.align; if (textEl) textEl.style.textAlign = align; item.dataset.textAlign = align;
        document.querySelectorAll('.ci-align-btn').forEach(b => b.classList.toggle('active', b === btn)); window.pushHistory?.();
      });
    });
  }

  // 이미지 fit
  if (type === 'image') {
    document.querySelectorAll('.ci-fit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const fit = btn.dataset.fit; item.dataset.fitMode = fit;
        const img = item.querySelector('.ci-img'); if (img) img.style.objectFit = fit;
        document.querySelectorAll('.ci-fit-btn').forEach(b => b.classList.toggle('active', b === btn)); window.pushHistory?.();
      });
    });
  }

  // 정렬 버튼
  document.querySelectorAll('.ci-pos-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pos = btn.dataset.pos;
      const zs  = (window.currentZoom || 100) / 100;
      const sec = cb.closest('.section-block');
      const cbW = sec ? Math.round(sec.offsetWidth / zs) : Math.round((cb.scrollWidth || 800) / zs);
      const cbH = Math.round(parseFloat(cb.style.height) || 500);
      const iW  = parseFloat(item.dataset.w) || item.offsetWidth;
      const iH  = parseFloat(item.dataset.h) || item.offsetHeight;
      let nx = parseFloat(item.dataset.x) || 0;
      let ny = parseFloat(item.dataset.y) || 0;
      if (pos === 'left')    nx = 0;
      if (pos === 'hcenter') nx = Math.round((cbW - iW) / 2);
      if (pos === 'right')   nx = cbW - iW;
      if (pos === 'top')     ny = 0;
      if (pos === 'vcenter') ny = Math.round((cbH - iH) / 2);
      if (pos === 'bottom')  ny = cbH - iH;
      item.dataset.x = nx; item.dataset.y = ny;
      item.style.left = nx+'px'; item.style.top = ny+'px';
      window.syncCanvasItemHandles?.(item);
      const xEl = document.getElementById('ci-x'); const yEl = document.getElementById('ci-y');
      if (xEl) xEl.value = nx; if (yEl) yEl.value = ny;
      window.pushHistory?.();
    });
  });

  document.getElementById('ci-bring')?.addEventListener('click', () => window.bringForward?.());
  document.getElementById('ci-send')?.addEventListener('click',  () => window.sendBackward?.());
  document.getElementById('ci-back-cb')?.addEventListener('click', () => { window.deselectCanvasItem?.(); showFrameProperties(cb); });
  document.getElementById('ci-duplicate')?.addEventListener('click', () => window.duplicateSelectedItem?.());
  document.getElementById('ci-delete')?.addEventListener('click', () => window.removeSelectedItem?.());
}

// 하위 호환 — 기존 코드에서 호출하는 window 함수명 유지
window.showFrameProperties      = showFrameProperties;
window.showSubSectionProperties = el => showFrameProperties(el);
window.showCanvasProperties     = el => showFrameProperties(el);
window.showCanvasItemProperties = showCanvasItemProperties;
