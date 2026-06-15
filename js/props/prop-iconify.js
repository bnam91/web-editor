import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

export function showIconifyProperties(block) {
  const iconName = block.dataset.iconName || '';
  const size     = parseInt(block.dataset.size)     || 64;
  const rotation = parseInt(block.dataset.rotation) || 0;
  const color    = block.dataset.iconColor || '#000000';
  const colorAlpha = parseAlphaFromColor(color);

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Icon'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Icon</div>
      <div class="prop-row" style="gap:4px;">
        <span class="prop-label" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:#888;" title="${iconName}">${iconName || '(없음)'}</span>
        <button class="prop-btn" id="icn-replace-btn" title="Iconify에서 교체"
          style="width:auto;height:auto;padding:3px 8px;font-size:10px;">교체</button>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Size</div>
      <div class="prop-row">
        <span class="prop-label">Size</span>
        <input type="range"  class="prop-slider" id="icn-size-slider" min="16" max="512" step="8"  value="${size}">
        <input type="number" class="prop-number" id="icn-size-number" min="16" max="512" value="${size}">
      </div>
      <div class="prop-row">
        <span class="prop-label">정렬</span>
        <div class="prop-align-group" id="icn-align-group">
          <button class="prop-align-btn${(block.dataset.align || 'center') === 'left'   ? ' active' : ''}" data-align="left"   title="좌측 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/><line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/></svg>
          </button>
          <button class="prop-align-btn${(block.dataset.align || 'center') === 'center' ? ' active' : ''}" data-align="center" title="중앙 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="6" x2="11" y2="6"/><line x1="2" y1="9" x2="12" y2="9"/><line x1="4" y1="12" x2="10" y2="12"/></svg>
          </button>
          <button class="prop-align-btn${(block.dataset.align || 'center') === 'right'  ? ' active' : ''}" data-align="right"  title="우측 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/><line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/></svg>
          </button>
        </div>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Color</div>
      <div class="prop-color-row">
        <span class="prop-label">Color</span>
        ${colorFieldHTML({ idPrefix: 'icn-color', hex: color, alpha: colorAlpha })}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Rotation</div>
      <div class="prop-align-group" id="icn-rotation-group">
        <button class="prop-align-btn${rotation ===   0 ? ' active' : ''}" data-deg="0">0°</button>
        <button class="prop-align-btn${rotation ===  90 ? ' active' : ''}" data-deg="90">90°</button>
        <button class="prop-align-btn${rotation === 180 ? ' active' : ''}" data-deg="180">180°</button>
        <button class="prop-align-btn${rotation === 270 ? ' active' : ''}" data-deg="270">270°</button>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">내 SVG 프리셋</div>
      <div class="prop-row" style="gap:4px;">
        <span class="prop-label">카테고리</span>
        <select id="icn-preset-cat" class="prop-number" style="flex:1;width:auto;text-align:left;padding:0 6px;">
          <option value="">로딩중...</option>
        </select>
        <button class="prop-btn" id="icn-preset-new-cat-btn" title="새 카테고리 추가" style="width:24px;height:24px;padding:0;font-size:14px;line-height:1;">+</button>
      </div>
      <div class="prop-row" id="icn-preset-newcat-row" style="display:none;gap:4px;margin-top:4px;">
        <input type="text" id="icn-preset-newcat-input" placeholder="새 카테고리 이름 입력 후 Enter" class="prop-color-hex" style="flex:1;">
        <button class="prop-btn" id="icn-preset-newcat-cancel" title="취소" style="width:24px;height:24px;padding:0;font-size:11px;">✕</button>
      </div>
      <div id="icn-preset-grid" style="display:grid;grid-template-columns:repeat(3, 1fr);gap:6px;margin-top:6px;min-height:24px;"></div>
      <div class="prop-row" style="gap:4px;">
        <button class="prop-btn" id="icn-preset-save-btn" title="현재 SVG를 내 라이브러리에 저장 (현재 선택된 카테고리로)" style="flex:1;height:24px;padding:0 8px;font-size:11px;">💾 라이브러리에 저장</button>
      </div>
      <div class="prop-row" id="icn-preset-save-row" style="display:none;gap:4px;margin-top:4px;">
        <input type="text" id="icn-preset-save-input" placeholder="이름 (Enter로 저장)" class="prop-color-hex" style="flex:1;">
        <button class="prop-btn" id="icn-preset-save-cancel" title="취소" style="width:24px;height:24px;padding:0;font-size:11px;">✕</button>
      </div>
    </div>

    <div class="prop-section">
      <button class="prop-btn-full" id="icn-open-modal-btn">Iconify에서 교체</button>
    </div>
  `;

  // ── SVG 프리셋 라이브러리 ────────────────────────────────────────────
  const presetCatSelect = propPanel.querySelector('#icn-preset-cat');
  const presetGrid      = propPanel.querySelector('#icn-preset-grid');
  let _presetCategories = [];

  const renderPresetGrid = (catName) => {
    presetGrid.innerHTML = '';
    const cat = _presetCategories.find(c => c.name === catName);
    if (!cat) return;
    cat.items.forEach(it => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:relative;aspect-ratio:1;';
      const cell = document.createElement('button');
      cell.className = 'prop-btn';
      cell.title = `${catName} / ${it.name} — 클릭하면 적용`;
      cell.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:4px;background:#ffffff;border:1px solid var(--ui-border-mid, #ddd);border-radius:4px;cursor:pointer;overflow:hidden;';
      cell.dataset.cat = catName;
      cell.dataset.file = it.file;
      // 비동기 미리보기 로드 — SVG 색은 어두운 회색(흰 배경에서 잘 보임)
      window.electronAPI?.svgPresets?.read({ category: catName, file: it.file }).then(res => {
        if (res?.ok && res.svg) {
          cell.innerHTML = res.svg;
          const svg = cell.querySelector('svg');
          if (svg) { svg.setAttribute('width', '28'); svg.setAttribute('height', '28'); svg.style.color = '#222'; }
        }
      });
      cell.addEventListener('click', async () => {
        const res = await window.electronAPI?.svgPresets?.read({ category: catName, file: it.file });
        if (!res?.ok) { window.showToast?.('SVG 로드 실패: ' + (res?.error || '')); return; }
        const svg = res.svg.trim();
        const existingSvg = block.querySelector('svg');
        if (existingSvg) existingSvg.remove();
        block.insertAdjacentHTML('beforeend', svg);
        const newSvg = block.querySelector('svg');
        if (newSvg) {
          const sz = parseInt(block.dataset.size) || 64;
          newSvg.setAttribute('width', sz);
          newSvg.setAttribute('height', sz);
        }
        block.dataset.iconName = `preset:${catName}/${it.name}`;
        block.dataset.iconSvg = svg;
        if (block.dataset.iconColor) block.style.color = block.dataset.iconColor;
        window.pushHistory?.('SVG 프리셋 적용');
        window.scheduleAutoSave?.();
      });
      // 호버 시 삭제 (X) 버튼
      const delBtn = document.createElement('button');
      delBtn.textContent = '×';
      delBtn.title = `삭제: ${catName} / ${it.name}`;
      delBtn.style.cssText = 'position:absolute;top:-4px;right:-4px;width:16px;height:16px;padding:0;line-height:14px;font-size:12px;background:#ff4444;color:#fff;border:1px solid #fff;border-radius:50%;cursor:pointer;opacity:0;transition:opacity 0.1s;z-index:2;';
      wrap.addEventListener('mouseenter', () => { delBtn.style.opacity = '1'; });
      wrap.addEventListener('mouseleave', () => { delBtn.style.opacity = '0'; });
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (window.confirm && !window.confirm(`삭제할까요?\n${catName} / ${it.name}`)) return;
        const res = await window.electronAPI?.svgPresets?.delete({ category: catName, file: it.file });
        if (res?.ok) {
          window.showToast?.(`삭제됨: ${it.name}`);
          await loadPresets();
          presetCatSelect.value = catName;
          renderPresetGrid(catName);
        } else {
          window.showToast?.('삭제 실패: ' + (res?.error || ''));
        }
      });
      wrap.appendChild(cell);
      wrap.appendChild(delBtn);
      presetGrid.appendChild(wrap);
    });
  };

  const loadPresets = async () => {
    const res = await window.electronAPI?.svgPresets?.list();
    if (!res?.ok) {
      presetCatSelect.innerHTML = '<option value="">(불러오기 실패)</option>';
      return;
    }
    _presetCategories = res.categories || [];
    presetCatSelect.innerHTML = _presetCategories.length
      ? _presetCategories.map(c => `<option value="${c.name}">${c.name} (${c.items.length})</option>`).join('')
      : '<option value="">(폴더 비어있음 — Application Support/Goya Design Editor/svg-presets/ 에 폴더+SVG 추가)</option>';
    if (_presetCategories.length > 0) {
      presetCatSelect.value = _presetCategories[0].name;
      renderPresetGrid(_presetCategories[0].name);
    }
  };

  presetCatSelect.addEventListener('change', () => renderPresetGrid(presetCatSelect.value));
  loadPresets();

  // 새 카테고리 추가 — inline input (Electron prompt 차단 회피)
  const newCatBtn   = propPanel.querySelector('#icn-preset-new-cat-btn');
  const newCatRow   = propPanel.querySelector('#icn-preset-newcat-row');
  const newCatInput = propPanel.querySelector('#icn-preset-newcat-input');
  const newCatCancel = propPanel.querySelector('#icn-preset-newcat-cancel');
  const showNewCatInput = () => {
    if (newCatRow) { newCatRow.style.display = 'flex'; newCatInput.value = ''; newCatInput.focus(); }
  };
  const hideNewCatInput = () => { if (newCatRow) newCatRow.style.display = 'none'; };
  const submitNewCat = async () => {
    const name = newCatInput.value.trim();
    if (!name) { hideNewCatInput(); return; }
    if (!window.electronAPI?.svgPresets) { window.showToast?.('프리셋 라이브러리는 데스크톱 앱에서만 사용할 수 있어요'); return; }
    const res = await window.electronAPI?.svgPresets?.createCategory({ name });
    if (res?.ok) {
      window.showToast?.(`카테고리 생성: ${res.name}`);
      hideNewCatInput();
      await loadPresets();
      presetCatSelect.value = res.name;
      renderPresetGrid(res.name);
    } else {
      window.showToast?.('생성 실패: ' + (res?.error || ''));
    }
  };
  newCatBtn?.addEventListener('click', () => {
    if (newCatRow?.style.display === 'none') showNewCatInput();
    else hideNewCatInput();
  });
  newCatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submitNewCat(); }
    else if (e.key === 'Escape') { e.preventDefault(); hideNewCatInput(); }
  });
  newCatCancel?.addEventListener('click', hideNewCatInput);

  // 현재 SVG → 라이브러리에 저장 — inline input (prompt 차단 회피)
  const saveBtn    = propPanel.querySelector('#icn-preset-save-btn');
  const saveRow    = propPanel.querySelector('#icn-preset-save-row');
  const saveInput  = propPanel.querySelector('#icn-preset-save-input');
  const saveCancel = propPanel.querySelector('#icn-preset-save-cancel');
  const guessSvgName = () => {
    // dataset.iconName 에서 적당히 추출 (예: "lucide:alert-triangle" → "alert-triangle")
    const raw = block.dataset.iconName || '';
    return raw.split('/').pop().split(':').pop() || 'my-icon';
  };
  const showSaveInput = () => {
    if (!saveRow) return;
    saveRow.style.display = 'flex';
    saveInput.value = guessSvgName();
    saveInput.focus(); saveInput.select();
  };
  const hideSaveInput = () => { if (saveRow) saveRow.style.display = 'none'; };
  const submitSave = async () => {
    const svg = block.dataset.iconSvg || block.querySelector('svg')?.outerHTML;
    if (!svg) { window.showToast?.('저장할 SVG 없음'); hideSaveInput(); return; }
    const cat = presetCatSelect.value || _presetCategories[0]?.name;
    if (!cat) { window.showToast?.('카테고리 먼저 선택/추가'); return; }
    const name = saveInput.value.trim();
    if (!name) { return; }
    if (!window.electronAPI?.svgPresets) { window.showToast?.('프리셋 라이브러리는 데스크톱 앱에서만 사용할 수 있어요'); return; }
    const res = await window.electronAPI?.svgPresets?.save({ category: cat, name, svg });
    if (res?.ok) {
      window.showToast?.(`저장: ${res.category}/${res.file}`);
      hideSaveInput();
      await loadPresets();
      presetCatSelect.value = cat;
      renderPresetGrid(cat);
    } else {
      window.showToast?.('저장 실패: ' + (res?.error || ''));
    }
  };
  saveBtn?.addEventListener('click', () => {
    if (saveRow?.style.display === 'none') showSaveInput();
    else hideSaveInput();
  });
  saveInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submitSave(); }
    else if (e.key === 'Escape') { e.preventDefault(); hideSaveInput(); }
  });
  saveCancel?.addEventListener('click', hideSaveInput);

  // 크기
  const sSlider = propPanel.querySelector('#icn-size-slider');
  const sNumber = propPanel.querySelector('#icn-size-number');
  const applySize = v => {
    v = Math.min(512, Math.max(16, v));
    block.dataset.size = v;
    block.style.width  = v + 'px';
    block.style.height = v + 'px';
    const svg = block.querySelector('svg');
    if (svg) { svg.setAttribute('width', v); svg.setAttribute('height', v); }
    const img = block.querySelector('img');
    if (img) { img.width = v; img.height = v; }
    sSlider.value = v; sNumber.value = v;
  };
  sSlider.addEventListener('mousedown', () => window.pushHistory?.());
  sSlider.addEventListener('input',  () => applySize(parseInt(sSlider.value)));
  sNumber.addEventListener('change', () => { window.pushHistory?.(); applySize(parseInt(sNumber.value)); });
  sSlider.addEventListener('change', () => window.pushHistory?.());

  // 색상 (SVG currentColor 활용)
  wireColorField('icn-color', {
    initialAlpha: colorAlpha,
    onApply: (c) => {
      block.dataset.iconColor = c;
      block.style.color = c;
    },
    onCommit: () => window.pushHistory?.(),
  });

  // 회전
  const applyRotation = deg => {
    block.dataset.rotation = deg;
    block.style.transform  = deg > 0 ? `rotate(${deg}deg)` : '';
    propPanel.querySelectorAll('#icn-rotation-group .prop-align-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.deg) === deg);
    });
    window.pushHistory?.();
  };
  propPanel.querySelectorAll('#icn-rotation-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => applyRotation(parseInt(btn.dataset.deg)));
  });

  // 교체 버튼
  const openModal = () => window.openIconifyModal?.();
  propPanel.querySelector('#icn-replace-btn').addEventListener('click', openModal);
  propPanel.querySelector('#icn-open-modal-btn').addEventListener('click', openModal);

  // 초기 색상 적용
  if (block.dataset.iconColor) block.style.color = block.dataset.iconColor;

  // 정렬 — 부모 row의 justifyContent + block 자체 margin 둘 다 사용 (어느 컨테이너든 작동)
  const applyAlign = (align) => {
    block.dataset.align = align;
    // block 자체 margin (block-level일 때)
    if (align === 'left')   { block.style.marginLeft = '0';    block.style.marginRight = 'auto'; }
    else if (align === 'right')  { block.style.marginLeft = 'auto'; block.style.marginRight = '0'; }
    else                         { block.style.marginLeft = 'auto'; block.style.marginRight = 'auto'; }
    // 부모 row의 flex 정렬
    const row = block.closest('.row');
    if (row) row.style.justifyContent = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
    propPanel.querySelectorAll('#icn-align-group .prop-align-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.align === align);
    });
  };
  propPanel.querySelectorAll('#icn-align-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyAlign(btn.dataset.align);
      window.pushHistory?.('아이콘 정렬');
      window.scheduleAutoSave?.();
    });
  });
  // 초기 정렬 복원
  if (block.dataset.align) applyAlign(block.dataset.align);
}

window.showIconifyProperties = showIconifyProperties;
