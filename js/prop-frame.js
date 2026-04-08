/* ══════════════════════════════════════
   PROP-FRAME — Frame 속성 패널 (frame-block)
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
  // showFrameProperties는 frame-block 전용 패널 → 항상 Frame 아이콘 사용
  // shape 아이콘은 showShapeProperties(shape-block) 패널에서만 표시
  return `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          ${_FRAME_ICON}
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${el.dataset.layerName || 'Frame'}</span>
        </div>
        ${id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${id}')">${id}</span>` : ''}
      </div>
    </div>`;
}

/* ════════════════════════════════════════
   AUTO 모드 (frame-block)
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
        <input type="range" class="prop-slider" id="ss-gap-slider" min="0" max="80" step="2" value="${parseInt(ss.style.gap) || 0}">
        <input type="number" class="prop-number" id="ss-gap-num" min="0" max="80" value="${parseInt(ss.style.gap) || 0}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">회전 / 반전</div>
      <div class="prop-row" style="margin-top:6px;gap:6px;">
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
  const _setAlign = (alignItems, justifyContent) => {
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
    window.scheduleAutoSave?.();
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
   공개 API
════════════════════════════════════════ */
export function showFrameProperties(el) {
  _renderAutoPanel(el);
}

window.showFrameProperties      = showFrameProperties;
window.showFrameProperties = el => showFrameProperties(el);
