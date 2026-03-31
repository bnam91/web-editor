/* ══════════════════════════════════════
   PROP-CANVAS — Canvas Block / Item 프로퍼티 패널
══════════════════════════════════════ */
import { propPanel } from './globals.js';

/* ── Canvas Block 속성 ── */
export function showCanvasProperties(cb) {
  const h  = parseInt(cb.style.height) || 500;
  const bg = cb.dataset.bg || '#f8f8f8';

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="10" height="10" rx="1.5"/>
            <line x1="1" y1="4.5" x2="11" y2="4.5" stroke-dasharray="2 1.5"/>
            <line x1="4.5" y1="4.5" x2="4.5" y2="11" stroke-dasharray="2 1.5"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">Canvas Block</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(cb) || ''}</span>
        </div>
        ${cb.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="navigator.clipboard.writeText('${cb.id}')">${cb.id}</span>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">캔버스 크기</div>
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

  const hSlider = document.getElementById('cb-h-slider');
  const hNumber = document.getElementById('cb-h-number');
  hSlider.addEventListener('mousedown', () => window.pushHistory?.());
  hSlider.addEventListener('input', () => { cb.style.height = hSlider.value + 'px'; hNumber.value = hSlider.value; });
  hNumber.addEventListener('change', () => {
    const v = Math.min(2000, Math.max(100, parseInt(hNumber.value) || 500));
    cb.style.height = v + 'px'; hSlider.value = v; window.pushHistory?.();
  });

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
  document.getElementById('cb-bg-clear').addEventListener('click', () => {
    applyBg('#f8f8f8'); window.pushHistory?.();
  });

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

  document.getElementById('cb-add-text').addEventListener('click', () => {
    window.addItemToCanvas(cb, 'text');
  });
}

/* ── Canvas Item 속성 ── */
export function showCanvasItemProperties(cb, item) {
  const x = Math.round(parseFloat(item.dataset.x) || 0);
  const y = Math.round(parseFloat(item.dataset.y) || 0);
  const w = Math.round(parseFloat(item.dataset.w) || 200);
  const h = Math.round(parseFloat(item.dataset.h) || 100);
  const type = item.dataset.type;
  const typeLabel = type === 'image' ? '이미지' : '텍스트';
  const fontSize   = parseInt(item.querySelector('.ci-text')?.style.fontSize) || 24;
  const textColor  = item.querySelector('.ci-text')?.style.color || '#111111';
  const textAlign  = item.querySelector('.ci-text')?.style.textAlign || item.dataset.textAlign || 'left';
  const fitMode    = item.dataset.fitMode || 'cover';
  const radius     = parseInt(item.dataset.radius) || 0;
  const opacity    = Math.round((parseFloat(item.dataset.opacity) ?? 1) * 100);

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
        <span class="prop-label">정렬</span>
        <div class="prop-align-group" style="flex:1">
          <button class="prop-align-btn ci-align-btn${textAlign==='left'?' active':''}"   data-align="left"   title="왼쪽 정렬">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><line x1="1" y1="3" x2="11" y2="3"/><line x1="1" y1="6" x2="7" y2="6"/><line x1="1" y1="9" x2="9" y2="9"/></svg>
          </button>
          <button class="prop-align-btn ci-align-btn${textAlign==='center'?' active':''}" data-align="center" title="가운데 정렬">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><line x1="1" y1="3" x2="11" y2="3"/><line x1="2.5" y1="6" x2="9.5" y2="6"/><line x1="1.5" y1="9" x2="10.5" y2="9"/></svg>
          </button>
          <button class="prop-align-btn ci-align-btn${textAlign==='right'?' active':''}"  data-align="right"  title="오른쪽 정렬">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><line x1="1" y1="3" x2="11" y2="3"/><line x1="5" y1="6" x2="11" y2="6"/><line x1="3" y1="9" x2="11" y2="9"/></svg>
          </button>
        </div>
      </div>
    </div>` : ''}
    ${type === 'image' ? `
    <div class="prop-section">
      <div class="prop-section-title">이미지 맞춤</div>
      <div class="prop-align-group">
        <button class="prop-align-btn ci-fit-btn${fitMode==='cover'?' active':''}"   data-fit="cover"   title="Cover (꽉 채움)">Cover</button>
        <button class="prop-align-btn ci-fit-btn${fitMode==='contain'?' active':''}" data-fit="contain" title="Contain (전체 표시)">Contain</button>
        <button class="prop-align-btn ci-fit-btn${fitMode==='fill'?' active':''}"    data-fit="fill"    title="Fill (늘리기)">Fill</button>
      </div>
    </div>` : ''}
    <div class="prop-section">
      <div class="prop-section-title">정렬 (캔버스 기준)</div>
      <div class="prop-align-group" style="flex-wrap:wrap;gap:4px">
        <button class="prop-align-btn ci-pos-btn" data-pos="left"   title="왼쪽 정렬">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><line x1="1" y1="1" x2="1" y2="13"/><rect x="3" y="4" width="5" height="6" rx="1"/></svg>
        </button>
        <button class="prop-align-btn ci-pos-btn" data-pos="hcenter" title="가로 중앙 정렬">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><line x1="7" y1="1" x2="7" y2="13"/><rect x="3" y="4" width="8" height="6" rx="1"/></svg>
        </button>
        <button class="prop-align-btn ci-pos-btn" data-pos="right"  title="오른쪽 정렬">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><line x1="13" y1="1" x2="13" y2="13"/><rect x="6" y="4" width="5" height="6" rx="1"/></svg>
        </button>
        <button class="prop-align-btn ci-pos-btn" data-pos="top"    title="위쪽 정렬">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><line x1="1" y1="1" x2="13" y2="1"/><rect x="4" y="3" width="6" height="5" rx="1"/></svg>
        </button>
        <button class="prop-align-btn ci-pos-btn" data-pos="vcenter" title="세로 중앙 정렬">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><line x1="1" y1="7" x2="13" y2="7"/><rect x="4" y="3" width="6" height="8" rx="1"/></svg>
        </button>
        <button class="prop-align-btn ci-pos-btn" data-pos="bottom" title="아래쪽 정렬">
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
      <button class="prop-action-btn secondary" id="ci-back-cb">← 캔버스 속성</button>
      <button class="prop-action-btn secondary" id="ci-duplicate">복제 (⌘D)</button>
      <button class="prop-action-btn danger"    id="ci-delete">요소 삭제</button>
    </div>`;

  // 위치/크기 change
  const applyGeom = () => {
    const nx = parseInt(document.getElementById('ci-x')?.value) || 0;
    const ny = parseInt(document.getElementById('ci-y')?.value) || 0;
    const nw = Math.max(40, parseInt(document.getElementById('ci-w')?.value) || 40);
    const nh = Math.max(20, parseInt(document.getElementById('ci-h')?.value) || 20);
    item.dataset.x = nx; item.dataset.y = ny;
    item.dataset.w = nw; item.dataset.h = nh;
    item.style.left = nx+'px'; item.style.top = ny+'px';
    item.style.width = nw+'px'; item.style.height = nh+'px';
    window.syncCanvasItemHandles?.(item);
  };
  ['ci-x','ci-y','ci-w','ci-h'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => { applyGeom(); window.pushHistory?.(); });
  });

  // border-radius
  const radiusSlider = document.getElementById('ci-radius-slider');
  const radiusNum    = document.getElementById('ci-radius');
  const applyRadius  = v => {
    item.dataset.radius = v;
    item.style.borderRadius = v + 'px';
    // img 안에도 적용
    const img = item.querySelector('.ci-img');
    if (img) img.style.borderRadius = v + 'px';
  };
  radiusSlider?.addEventListener('input', () => { applyRadius(parseInt(radiusSlider.value)); radiusNum.value = radiusSlider.value; });
  radiusSlider?.addEventListener('change', () => window.pushHistory?.());
  radiusNum?.addEventListener('change', () => {
    const v = Math.min(200, Math.max(0, parseInt(radiusNum.value) || 0));
    applyRadius(v); radiusSlider.value = v; window.pushHistory?.();
  });

  // opacity
  const opacitySlider = document.getElementById('ci-opacity-slider');
  const opacityNum    = document.getElementById('ci-opacity');
  const applyOpacity  = v => {
    const pct = Math.min(100, Math.max(0, v));
    item.dataset.opacity = (pct / 100).toFixed(2);
    item.style.opacity = pct / 100;
  };
  opacitySlider?.addEventListener('input', () => { applyOpacity(parseInt(opacitySlider.value)); opacityNum.value = opacitySlider.value; });
  opacitySlider?.addEventListener('change', () => window.pushHistory?.());
  opacityNum?.addEventListener('change', () => {
    const v = Math.min(100, Math.max(0, parseInt(opacityNum.value) ?? 100));
    applyOpacity(v); opacitySlider.value = v; window.pushHistory?.();
  });

  // 텍스트 속성
  if (type === 'text') {
    const textEl    = item.querySelector('.ci-text');
    const colorIn   = document.getElementById('ci-color');
    const colorHex  = document.getElementById('ci-color-hex');
    const colorSwatch = colorHex?.previousElementSibling;
    const applyColor = val => {
      if (textEl) textEl.style.color = val;
      if (colorIn)     colorIn.value  = val;
      if (colorHex)    colorHex.value = val;
      if (colorSwatch) colorSwatch.style.background = val;
    };
    document.getElementById('ci-fs')?.addEventListener('change', e => {
      const v = Math.min(400, Math.max(8, parseInt(e.target.value) || 24));
      if (textEl) textEl.style.fontSize = v + 'px';
      window.pushHistory?.();
    });
    colorIn?.addEventListener('input',  e => applyColor(e.target.value));
    colorIn?.addEventListener('change', () => window.pushHistory?.());
    colorHex?.addEventListener('change', e => {
      const v = e.target.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) { applyColor(v); window.pushHistory?.(); }
    });

    // 텍스트 정렬 버튼
    document.querySelectorAll('.ci-align-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const align = btn.dataset.align;
        if (textEl) textEl.style.textAlign = align;
        item.dataset.textAlign = align;
        document.querySelectorAll('.ci-align-btn').forEach(b => b.classList.toggle('active', b === btn));
        window.pushHistory?.();
      });
    });
  }

  // 이미지 fit 모드 버튼
  if (type === 'image') {
    document.querySelectorAll('.ci-fit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const fit = btn.dataset.fit;
        item.dataset.fitMode = fit;
        const img = item.querySelector('.ci-img');
        if (img) img.style.objectFit = fit;
        document.querySelectorAll('.ci-fit-btn').forEach(b => b.classList.toggle('active', b === btn));
        window.pushHistory?.();
      });
    });
  }

  // 정렬 버튼 (캔버스 기준)
  document.querySelectorAll('.ci-pos-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pos  = btn.dataset.pos;
      // canvas-block 논리 너비: section.offsetWidth / zoom (section이 width:100%이고 zoom은 section 외부에 적용)
      const zs   = (window.currentZoom || 100) / 100;
      const sec  = cb.closest('.section-block');
      const cbW  = sec ? Math.round(sec.offsetWidth / zs) : Math.round((cb.scrollWidth || 800) / zs);
      const cbH  = Math.round(parseFloat(cb.style.height) || 500);
      const iW   = parseFloat(item.dataset.w) || item.offsetWidth;
      const iH   = parseFloat(item.dataset.h) || item.offsetHeight;
      let nx = parseFloat(item.dataset.x) || 0;
      let ny = parseFloat(item.dataset.y) || 0;

      if (pos === 'left')    nx = 0;
      if (pos === 'hcenter') nx = Math.round((cbW - iW) / 2);
      if (pos === 'right')   nx = cbW - iW;
      if (pos === 'top')     ny = 0;
      if (pos === 'vcenter') ny = Math.round((cbH - iH) / 2);
      if (pos === 'bottom')  ny = cbH - iH;

      item.dataset.x = nx; item.dataset.y = ny;
      item.style.left = nx + 'px'; item.style.top = ny + 'px';
      window.syncCanvasItemHandles?.(item);

      // 패널 입력값 동기화
      const xEl = document.getElementById('ci-x'); const yEl = document.getElementById('ci-y');
      if (xEl) xEl.value = nx; if (yEl) yEl.value = ny;
      window.pushHistory?.();
    });
  });

  document.getElementById('ci-bring')?.addEventListener('click', () => window.bringForward?.());
  document.getElementById('ci-send')?.addEventListener('click',  () => window.sendBackward?.());
  document.getElementById('ci-back-cb')?.addEventListener('click', () => {
    window.deselectCanvasItem?.();
    showCanvasProperties(cb);
  });
  document.getElementById('ci-duplicate')?.addEventListener('click', () => window.duplicateSelectedItem?.());
  document.getElementById('ci-delete')?.addEventListener('click', () => window.removeSelectedItem?.());
}

window.showCanvasProperties     = showCanvasProperties;
window.showCanvasItemProperties = showCanvasItemProperties;
