import { propPanel } from './globals.js';
import { pushHistory, PRESETS, _presetsReady, rgbToHex, getBlockBreadcrumb } from './editor.js';

/* ═══════════════════════════════════
   SECTION PROPERTIES PANEL
═══════════════════════════════════ */

function applyPreset(sec, presetId) {
  const preset = PRESETS.find(p => p.id === presetId);
  // 기존 preset 변수 초기화
  PRESETS.forEach(p => Object.keys(p.variables).forEach(k => sec.style.removeProperty(k)));
  delete sec.dataset.preset;

  if (preset && presetId !== 'default') {
    Object.entries(preset.variables).forEach(([k, v]) => sec.style.setProperty(k, v));
    sec.dataset.preset = presetId;
  }
  // 프리셋 배경색 적용 (정의된 경우에만)
  if (preset?.backgroundColor) {
    sec.style.backgroundColor = preset.backgroundColor;
  }
  pushHistory();
}

function setRpIdBadge(id) {
  const badge = document.getElementById('rp-block-id-badge');
  if (!badge) return;
  if (id) {
    badge.textContent = id;
    badge.style.display = '';
    badge.onclick = () => _copyToClipboard(id);
  } else {
    badge.style.display = 'none';
  }
}

async function showSectionProperties(sec) {
  // race condition 방지: Electron readPresets() IPC가 완료될 때까지 대기 후 PRESETS 사용
  await _presetsReady;
  const rawBg = sec.style.backgroundColor || sec.style.background || '';
  const hexBg = rawBg
    ? (/^#[0-9a-f]{6}$/i.test(rawBg) ? rawBg : rgbToHex(rawBg))
    : '#ffffff';
  const hasBgImg  = !!sec.dataset.bgImg;
  const bgSize    = sec.dataset.bgSize || 'cover';
  const secPadB   = parseInt(sec.style.paddingBottom) || 0;
  const inner     = sec.querySelector('.section-inner');
  const secPadX        = parseInt(inner?.dataset.paddingX) || parseInt(inner?.style.paddingLeft) || 0;
  const secPadXAsset   = inner?.dataset.padXExcludesAsset || '';
  const bgImgHTML = hasBgImg ? `
    <div class="prop-row" style="margin-top:6px;">
      <span class="prop-label">사이즈</span>
      <select class="prop-select" id="sec-bg-size">
        <option value="cover"   ${bgSize==='cover'   ?'selected':''}>Cover</option>
        <option value="contain" ${bgSize==='contain' ?'selected':''}>Contain</option>
        <option value="auto"    ${bgSize==='auto'    ?'selected':''}>Auto</option>
      </select>
    </div>
    <button class="prop-action-btn secondary" id="sec-bg-pos-btn" style="margin-top:6px;">위치 편집</button>
    <button class="prop-action-btn danger" id="sec-bg-img-remove" style="margin-top:4px;">이미지 제거</button>
  ` : `
    <button class="prop-action-btn secondary" id="sec-bg-img-btn" style="margin-top:6px;">이미지 선택</button>
    <input type="file" id="sec-bg-img-input" accept="image/*" style="display:none">
  `;

  // 섹션 내 텍스트 블록 타입별 수집
  const typeMap = { heading: 'Heading', body: 'Body', caption: 'Caption', label: 'Label' };
  const typeOrder = ['heading', 'body', 'caption', 'label'];
  const found = {}; // type → { blocks: [], color: hex }
  sec.querySelectorAll('.text-block').forEach(tb => {
    const type = tb.dataset.type;
    if (!typeMap[type]) return;
    const contentEl = tb.querySelector('[contenteditable]') || tb.querySelector('div');
    const computed = window.getComputedStyle(contentEl);
    const colorHex = contentEl.style.color
      ? (/^#/.test(contentEl.style.color) ? contentEl.style.color : rgbToHex(contentEl.style.color))
      : rgbToHex(computed.color);
    if (!found[type]) found[type] = { blocks: [], color: colorHex };
    found[type].blocks.push(tb);
  });

  const colorRows = typeOrder.filter(t => found[t]).map(t => {
    const c = found[t].color;
    return `
      <div class="prop-color-row">
        <span class="prop-label">${typeMap[t]}</span>
        <div class="prop-color-swatch" style="background:${c}">
          <input type="color" id="sec-txt-${t}" value="${c}">
        </div>
        <input type="text" class="prop-color-hex" id="sec-txt-${t}-hex" value="${c}" maxlength="7">
      </div>`;
  }).join('');

  const currentPreset = sec.dataset.preset || 'default';
  const presetSelectHTML = PRESETS.map(p =>
    `<option value="${p.id}"${p.id === currentPreset ? ' selected' : ''}>${p.name}</option>`
  ).join('');

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path fill="#888" fill-rule="evenodd" d="M5.5 3a.5.5 0 0 1 .5.5V5h4V3.5a.5.5 0 0 1 1 0V5h1.5a.5.5 0 0 1 0 1H11v4h1.5a.5.5 0 0 1 0 1H11v1.5a.5.5 0 0 1-1 0V11H6v1.5a.5.5 0 0 1-1 0V11H3.5a.5.5 0 0 1 0-1H5V6H3.5a.5.5 0 0 1 0-1H5V3.5a.5.5 0 0 1 .5-.5m4.5 7V6H6v4z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${sec._name || sec.dataset.name || 'Section'}</span>
          <span class="prop-breadcrumb">${getBlockBreadcrumb(sec)}</span>
        </div>
        ${sec.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${sec.id}')">${sec.id}</span>` : ''}
      </div>
      <div class="prop-section-title">Preset</div>
      <select class="prop-select" id="sec-preset">${presetSelectHTML}</select>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">배경</div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        <div class="prop-color-swatch" style="background:${hexBg}">
          <input type="color" id="sec-bg-color" value="${hexBg}">
        </div>
        <input type="text" class="prop-color-hex" id="sec-bg-hex" value="${hexBg}" maxlength="7">
      </div>
      <div class="prop-section-title" style="margin-top:10px;">배경 이미지</div>
      ${bgImgHTML}
    </div>
    ${colorRows ? `<div class="prop-section"><div class="prop-section-title">텍스트 컬러</div>${colorRows}</div>` : ''}
    <div class="prop-section">
      <div class="prop-section-title">일괄 정렬</div>
      <div class="prop-align-group">
        <button class="prop-align-btn" id="sec-align-left">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/>
            <line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn" id="sec-align-center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="6" x2="11" y2="6"/>
            <line x1="2" y1="9" x2="12" y2="9"/><line x1="4" y1="12" x2="10" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn" id="sec-align-right">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/>
            <line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">패딩</div>
      <div class="prop-row">
        <span class="prop-label">좌우 패딩</span>
        <input type="range" class="prop-slider" id="sec-padx-slider" min="0" max="100" step="2" value="${secPadX}">
        <input type="number" class="prop-number" id="sec-padx-number" min="0" max="100" value="${secPadX}">
      </div>
      <div class="prop-row">
        <span class="prop-label">아래 패딩</span>
        <input type="range" class="prop-slider" id="sec-padb-slider" min="0" max="200" step="4" value="${secPadB}">
        <input type="number" class="prop-number" id="sec-padb-number" min="0" max="200" value="${secPadB}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">내보내기</div>
      <select class="prop-select" id="sec-export-format" style="width:100%;margin-bottom:6px;">
        <option value="png">PNG</option>
        <option value="jpg">JPG</option>
      </select>
      <select class="prop-select" id="sec-export-width" style="width:100%;margin-bottom:6px;">
        <option value="860">860px (기본)</option>
        <option value="780">780px (쿠팡)</option>
      </select>
      <button class="prop-export-btn" id="sec-export-btn">이 섹션 내보내기</button>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">템플릿</div>
      <select class="prop-select" id="sec-tpl-folder" style="width:100%;margin-bottom:6px;">
        ${(()=>{
          const tpls = window.loadTemplates ? window.loadTemplates() : [];
          const folders = [...new Set(tpls.map(t => t.folder || '기타'))];
          if (!folders.length) folders.push('내 템플릿');
          return folders.map(f => `<option value="${f.replace(/"/g,'&quot;')}">${f.replace(/</g,'&lt;')}</option>`).join('') +
            '<option value="__new__">새 폴더...</option>';
        })()}
      </select>
      <input type="text" id="sec-tpl-folder-new" class="tpl-name-input" placeholder="새 폴더 이름" style="display:none;margin-bottom:6px;">
      <select class="prop-select" id="sec-tpl-cat" style="width:100%;margin-bottom:6px;">
        <option value="Hero">Hero</option>
        <option value="Main">Main</option>
        <option value="Feature">Feature</option>
        <option value="Detail">Detail</option>
        <option value="CTA">CTA</option>
        <option value="Event">Event</option>
        <option value="기타">기타</option>
      </select>
      <input type="text" id="sec-tpl-name" class="tpl-name-input" placeholder="템플릿 이름 입력">
      <input type="text" id="sec-tpl-tags" class="tpl-name-input" placeholder="태그 입력 (쉼표 구분, 예: 헤더, 배너)" style="margin-top:4px;">
      <button class="prop-action-btn primary" id="sec-tpl-save-btn" style="margin-top:6px;">템플릿으로 저장</button>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(sec.id || null);

  // 좌우 패딩 이벤트
  const padXSlider = document.getElementById('sec-padx-slider');
  const padXNumber = document.getElementById('sec-padx-number');
  if (padXSlider && inner) {
    const applyPadX = v => {
      v = Math.min(100, Math.max(0, isNaN(v) ? 0 : v));
      inner.style.paddingLeft  = v ? v + 'px' : '';
      inner.style.paddingRight = v ? v + 'px' : '';
      inner.dataset.paddingX   = v || '';
      // 각 asset-block의 usePadx 개별 설정에 따라 negative margin 적용
      inner.querySelectorAll('.asset-block').forEach(ab => {
        if (ab.dataset.usePadx === 'true' && v > 0) {
          ab.style.marginLeft  = -v + 'px';
          ab.style.marginRight = -v + 'px';
          ab.style.width = `calc(100% + ${v * 2}px)`;
        } else {
          ab.style.marginLeft  = '';
          ab.style.marginRight = '';
          ab.style.width = '';
        }
      });
      padXSlider.value = v;
      padXNumber.value = v || '';
    };
    padXSlider.addEventListener('input',  e => applyPadX(parseInt(e.target.value)));
    padXSlider.addEventListener('change', () => pushHistory('섹션 좌우 패딩'));
    padXNumber.addEventListener('change', e => { applyPadX(parseInt(e.target.value)); pushHistory('섹션 좌우 패딩'); });

  }

  // 아래 여백 이벤트
  const padBSlider = document.getElementById('sec-padb-slider');
  const padBNumber = document.getElementById('sec-padb-number');
  if (padBSlider) {
    const applyPadB = v => {
      v = Math.min(200, Math.max(0, isNaN(v) ? 0 : v));
      sec.style.paddingBottom = v ? v + 'px' : '';
      padBSlider.value = v;
      padBNumber.value = v || '';
    };
    padBSlider.addEventListener('input',  e => applyPadB(parseInt(e.target.value)));
    padBSlider.addEventListener('change', () => pushHistory('섹션 여백'));
    padBNumber.addEventListener('change', e => { applyPadB(parseInt(e.target.value)); pushHistory('섹션 여백'); });
  }

  // 배경색 이벤트
  const picker = document.getElementById('sec-bg-color');
  const hex    = document.getElementById('sec-bg-hex');
  const swatch = picker.closest('.prop-color-swatch');
  picker.addEventListener('input', () => {
    sec.style.background = picker.value;
    sec.dataset.bg = picker.value;
    hex.value = picker.value;
    swatch.style.background = picker.value;
  });
  picker.addEventListener('change', () => pushHistory('섹션 배경색'));
  hex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(hex.value)) {
      sec.style.background = hex.value;
      sec.dataset.bg = hex.value;
      picker.value = hex.value;
      swatch.style.background = hex.value;
    }
  });
  hex.addEventListener('change', () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)) pushHistory('섹션 배경색'); });

  // 배경 이미지 이벤트
  const bgImgBtn    = document.getElementById('sec-bg-img-btn');
  const bgImgInput  = document.getElementById('sec-bg-img-input');
  const bgSizeEl    = document.getElementById('sec-bg-size');
  const bgImgRemove = document.getElementById('sec-bg-img-remove');
  const bgPosBtnEl  = document.getElementById('sec-bg-pos-btn');
  if (bgPosBtnEl) bgPosBtnEl.addEventListener('click', () => window.enterBgPosDragMode?.(sec));

  if (bgImgBtn && bgImgInput) {
    bgImgBtn.addEventListener('click', () => bgImgInput.click());
    bgImgInput.addEventListener('change', () => {
      const file = bgImgInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        sec.dataset.bgImg = dataUrl;
        sec.dataset.bgSize = 'cover';
        sec.style.backgroundImage = `url(${dataUrl})`;
        sec.style.backgroundSize = 'cover';
        sec.style.backgroundPosition = 'center';
        sec.style.backgroundRepeat = 'no-repeat';
        showSectionProperties(sec);
      };
      reader.readAsDataURL(file);
    });
  }
  if (bgSizeEl) {
    bgSizeEl.addEventListener('change', () => {
      sec.dataset.bgSize = bgSizeEl.value;
      sec.style.backgroundSize = bgSizeEl.value;
    });
  }
  if (bgImgRemove) {
    bgImgRemove.addEventListener('click', () => {
      delete sec.dataset.bgImg;
      delete sec.dataset.bgSize;
      sec.style.backgroundImage = '';
      sec.style.backgroundSize = '';
      sec.style.backgroundPosition = '';
      sec.style.backgroundRepeat = '';
      showSectionProperties(sec);
    });
  }

  // Preset 드롭다운 이벤트
  const presetSelect = document.getElementById('sec-preset');
  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      applyPreset(sec, presetSelect.value);
      showSectionProperties(sec);
    });
  }

  // 텍스트 컬러 이벤트
  typeOrder.filter(t => found[t]).forEach(t => {
    const blocks = found[t].blocks;
    const applyColor = (val) => {
      blocks.forEach(tb => {
        const contentEl = tb.querySelector('[contenteditable]') || tb.querySelector('div');
        contentEl.style.color = val;
      });
    };
    const p = document.getElementById(`sec-txt-${t}`);
    const h = document.getElementById(`sec-txt-${t}-hex`);
    const sw = p.closest('.prop-color-swatch');
    p.addEventListener('input', () => { applyColor(p.value); h.value = p.value; sw.style.background = p.value; });
    h.addEventListener('input', () => {
      if (/^#[0-9a-f]{6}$/i.test(h.value)) { applyColor(h.value); p.value = h.value; sw.style.background = h.value; }
    });
  });

  // 일괄 정렬
  const allTextBlocks = [...sec.querySelectorAll('.text-block')];
  ['left','center','right'].forEach(align => {
    const btn = document.getElementById(`sec-align-${align}`);
    if (!btn) return;
    btn.addEventListener('click', () => {
      allTextBlocks.forEach(tb => {
        const isLabel = tb.querySelector('.tb-label');
        if (isLabel) { tb.style.textAlign = align; }
        else {
          const contentEl = tb.querySelector('[contenteditable]') || tb.querySelector('div');
          if (contentEl) contentEl.style.textAlign = align;
        }
      });
      propPanel.querySelectorAll('#sec-align-left,#sec-align-center,#sec-align-right')
        .forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  // 내보내기 / 템플릿 저장
  _bindSectionExport(sec);
  _bindSectionTemplate(sec);
}

/* 섹션 내보내기 이벤트 바인딩 — showSectionProperties에서 분리 */
function _bindSectionExport(sec) {
  const secExportBtn = document.getElementById('sec-export-btn');
  if (!secExportBtn) return;
  secExportBtn.addEventListener('click', async () => {
    const fmt = document.getElementById('sec-export-format').value;
    const w   = parseInt(document.getElementById('sec-export-width').value) || 860;
    secExportBtn.disabled = true;
    secExportBtn.textContent = '내보내는 중...';
    try {
      await window.exportSection(sec, fmt, w);
    } finally {
      secExportBtn.disabled = false;
      secExportBtn.textContent = '이 섹션 내보내기';
    }
  });
}

/* 섹션 템플릿 저장 이벤트 바인딩 — showSectionProperties에서 분리 */
function _bindSectionTemplate(sec) {
  const tplFolderSel = document.getElementById('sec-tpl-folder');
  const tplFolderNew = document.getElementById('sec-tpl-folder-new');
  if (tplFolderSel && tplFolderNew) {
    tplFolderSel.addEventListener('change', () => {
      tplFolderNew.style.display = tplFolderSel.value === '__new__' ? 'block' : 'none';
    });
  }

  const tplSaveBtn = document.getElementById('sec-tpl-save-btn');
  if (!tplSaveBtn) return;
  tplSaveBtn.addEventListener('click', () => {
    const name = document.getElementById('sec-tpl-name').value.trim();
    if (!name) { document.getElementById('sec-tpl-name').focus(); return; }
    const category = document.getElementById('sec-tpl-cat').value;
    let folder = tplFolderSel ? tplFolderSel.value : '기타';
    if (folder === '__new__') {
      folder = (tplFolderNew ? tplFolderNew.value.trim() : '') || '기타';
    }
    const tagsRaw = document.getElementById('sec-tpl-tags')?.value || '';
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
    window.saveAsTemplate?.(sec, name, folder, category, tags);
    document.getElementById('sec-tpl-name').value = '';
    const tagsEl = document.getElementById('sec-tpl-tags');
    if (tagsEl) tagsEl.value = '';
    tplSaveBtn.textContent = '저장됨 ✓';
    tplSaveBtn.disabled = true;
    setTimeout(() => {
      if (tplSaveBtn) { tplSaveBtn.textContent = '템플릿으로 저장'; tplSaveBtn.disabled = false; }
    }, 1500);
  });
}

/* 블록이 선택된 상태에서 소속 섹션만 하이라이트 (deselectAll 없이) */
function syncSection(sec) {
  document.querySelectorAll('.section-block').forEach(s => s.classList.remove('selected'));
  sec.classList.add('selected');
  window.syncLayerActive(sec);
}

export { applyPreset, setRpIdBadge, showSectionProperties, syncSection };

window.applyPreset           = applyPreset;
window.setRpIdBadge          = setRpIdBadge;
window.showSectionProperties = showSectionProperties;
window.syncSection           = syncSection;
