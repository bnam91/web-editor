import { propPanel } from './globals.js';

/* ═══════════════════════════════════
   SUB-SECTION PROPERTIES PANEL
═══════════════════════════════════ */

function rgbToHexSS(rgb) {
  if (!rgb || rgb === 'transparent') return '#ffffff';
  if (/^#/.test(rgb)) return rgb;
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return '#ffffff';
  return '#' + m.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
}

export function showSubSectionProperties(ss) {
  const rawBg  = ss.style.backgroundColor || ss.dataset.bg || '#f5f5f5';
  const hexBg  = rgbToHexSS(rawBg);
  const padY   = parseInt(ss.dataset.padY)   || 0;
  const width  = parseInt(ss.dataset.width)  || 780;
  const height = parseInt(ss.dataset.height) || 520;
  const hasBgImg = ss.style.backgroundImage && ss.style.backgroundImage !== 'none';

  // 보더
  const borderWidth = parseInt(ss.dataset.borderWidth) || 0;
  const borderStyle = ss.dataset.borderStyle || 'solid';
  const rawBorderColor = ss.style.borderColor || ss.dataset.borderColor || '#888888';
  const hexBorderColor = rgbToHexSS(rawBorderColor);

  // 코너 반경
  const radius = parseInt(ss.dataset.radius) || 0;

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="16" height="16" viewBox="1.5 1.5 13 13" fill="none">
            <path fill="#888" fill-rule="evenodd" d="M5.5 3a.5.5 0 0 1 .5.5V5h4V3.5a.5.5 0 0 1 1 0V5h1.5a.5.5 0 0 1 0 1H11v4h1.5a.5.5 0 0 1 0 1H11v1.5a.5.5 0 0 1-1 0V11H6v1.5a.5.5 0 0 1-1 0V11H3.5a.5.5 0 0 1 0-1H5V6H3.5a.5.5 0 0 1 0-1H5V3.5a.5.5 0 0 1 .5-.5m4.5 7V6H6v4z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${ss.dataset.layerName || 'Frame'}</span>
        </div>
        ${ss.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="navigator.clipboard.writeText('${ss.id}')">${ss.id}</span>` : ''}
      </div>
    </div>
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
        <input type="range" class="prop-slider" id="ss-width-slider" min="200" max="860" step="10" value="${width}">
        <input type="number" class="prop-number" id="ss-width-num" min="200" max="860" value="${width}">
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

  // ── 컴포넌트 저장 ─────────────────────────────────────
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
    setTimeout(() => {
      if (ssTplSaveBtn) { ssTplSaveBtn.textContent = '컴포넌트로 저장'; ssTplSaveBtn.disabled = false; }
    }, 1500);
  });

  // ── 배경 이미지 ──────────────────────────────────────
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
      // 위치 편집 / 제거 버튼 동적 추가
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

  // ── 배경색 ────────────────────────────────────────────
  const bgColor = document.getElementById('ss-bg-color');
  const bgHex   = document.getElementById('ss-bg-hex');
  const applyBg = (hex) => {
    ss.style.backgroundColor = hex;
    ss.dataset.bg = hex;
    window.scheduleAutoSave?.();
  };
  bgColor.addEventListener('input', () => { bgHex.value = bgColor.value; applyBg(bgColor.value); });
  bgColor.addEventListener('change', () => { window.pushHistory?.(); });
  bgHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(bgHex.value)) { bgColor.value = bgHex.value; applyBg(bgHex.value); }
  });

  // ── 보더 ──────────────────────────────────────────────
  const borderWSlider = document.getElementById('ss-border-w-slider');
  const borderWNum    = document.getElementById('ss-border-w-num');
  const borderStyleEl = document.getElementById('ss-border-style');
  const borderColorEl = document.getElementById('ss-border-color');
  const borderColorHex = document.getElementById('ss-border-color-hex');

  const applyBorder = () => {
    const w = parseInt(borderWNum.value) || 0;
    const s = borderStyleEl.value;
    const c = borderColorHex.value;
    ss.dataset.borderWidth = w;
    ss.dataset.borderStyle = s;
    ss.dataset.borderColor = c;
    if (w > 0) {
      ss.style.border = `${w}px ${s} ${c}`;
    } else {
      ss.style.border = '';
    }
    window.scheduleAutoSave?.();
  };

  borderWSlider.addEventListener('input', () => { borderWNum.value = borderWSlider.value; applyBorder(); });
  borderWSlider.addEventListener('change', () => window.pushHistory?.());
  borderWNum.addEventListener('change', () => window.pushHistory?.());
  borderWNum.addEventListener('input', () => {
    const v = Math.min(20, Math.max(0, parseInt(borderWNum.value) || 0));
    borderWSlider.value = v;
    applyBorder();
  });
  borderStyleEl.addEventListener('change', () => { applyBorder(); window.pushHistory?.(); });
  borderColorEl.addEventListener('input', () => {
    borderColorHex.value = borderColorEl.value;
    applyBorder();
  });
  borderColorEl.addEventListener('change', () => { window.pushHistory?.(); });
  borderColorHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(borderColorHex.value)) {
      borderColorEl.value = borderColorHex.value;
      applyBorder();
    }
  });

  // ── 코너 반경 ─────────────────────────────────────────
  const radiusSlider = document.getElementById('ss-radius-slider');
  const radiusNum    = document.getElementById('ss-radius-num');
  const applyRadius  = (v) => {
    ss.dataset.radius = v;
    ss.style.borderRadius = v + 'px';
    window.scheduleAutoSave?.();
  };
  radiusSlider.addEventListener('input', () => { radiusNum.value = radiusSlider.value; applyRadius(radiusSlider.value); });
  radiusSlider.addEventListener('change', () => window.pushHistory?.());
  radiusNum.addEventListener('change', () => window.pushHistory?.());
  radiusNum.addEventListener('input', () => {
    const v = Math.min(80, Math.max(0, parseInt(radiusNum.value) || 0));
    radiusSlider.value = v;
    applyRadius(v);
  });

  // ── 높이 ──────────────────────────────────────────────
  const heightSlider = document.getElementById('ss-height-slider');
  const heightNum    = document.getElementById('ss-height-num');
  const applyHeight  = (v) => {
    ss.dataset.height = v;
    ss.style.minHeight = v + 'px';
    window.scheduleAutoSave?.();
  };
  heightSlider.addEventListener('input', () => { heightNum.value = heightSlider.value; applyHeight(heightSlider.value); });
  heightSlider.addEventListener('change', () => window.pushHistory?.());
  heightNum.addEventListener('change', () => window.pushHistory?.());
  heightNum.addEventListener('input', () => {
    const v = Math.min(1200, Math.max(100, parseInt(heightNum.value) || 520));
    heightSlider.value = v;
    applyHeight(v);
  });

  // ── 너비 ──────────────────────────────────────────────
  const widthSlider = document.getElementById('ss-width-slider');
  const widthNum    = document.getElementById('ss-width-num');
  const applyWidth  = (v) => {
    const oldW = parseInt(ss.dataset.width) || ss.offsetWidth || 860;
    const newW = parseInt(v);
    const ratio = newW / oldW;
    // 내부 absolute 블록의 left/width 비례 재계산
    const inner = ss.querySelector('.sub-section-inner');
    if (inner && ratio !== 1) {
      inner.querySelectorAll('[style*="position: absolute"], [style*="position:absolute"]').forEach(block => {
        const curLeft  = parseInt(block.style.left  || 0);
        const curWidth = parseInt(block.style.width || block.offsetWidth || 0);
        block.style.left  = Math.round(curLeft  * ratio) + 'px';
        if (curWidth) block.style.width = Math.round(curWidth * ratio) + 'px';
      });
    }
    ss.dataset.width = v;
    ss.style.width     = newW + 'px';
    ss.style.maxWidth  = '100%';
    ss.style.margin    = '0 auto';
    ss.style.alignSelf = 'center';
    window.scheduleAutoSave?.();
  };
  widthSlider.addEventListener('input', () => { widthNum.value = widthSlider.value; applyWidth(widthSlider.value); });
  widthSlider.addEventListener('change', () => window.pushHistory?.());
  widthNum.addEventListener('change', () => window.pushHistory?.());
  widthNum.addEventListener('input', () => {
    const v = Math.min(860, Math.max(200, parseInt(widthNum.value) || 780));
    widthSlider.value = v;
    applyWidth(v);
  });

  // ── 상/하 패딩 ────────────────────────────────────────
  const padYSlider = document.getElementById('ss-pady-slider');
  const padYNum    = document.getElementById('ss-pady-num');
  const applyPadY  = (v) => {
    ss.dataset.padY = v;
    ss.style.paddingTop    = v + 'px';
    ss.style.paddingBottom = v + 'px';
    window.scheduleAutoSave?.();
  };
  padYSlider.addEventListener('input', () => { padYNum.value = padYSlider.value; applyPadY(padYSlider.value); });
  padYSlider.addEventListener('change', () => window.pushHistory?.());
  padYNum.addEventListener('change', () => window.pushHistory?.());
  padYNum.addEventListener('input', () => {
    const v = Math.min(200, Math.max(0, parseInt(padYNum.value) || 0));
    padYSlider.value = v;
    applyPadY(v);
  });
}

window.showSubSectionProperties = showSubSectionProperties;
