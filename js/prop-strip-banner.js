import { propPanel, state } from './globals.js';

/* 타입별 프리셋 폰트 사이즈 */
const SBB_TITLE_TYPES = { h1: { size: 48, weight: 700 }, h2: { size: 36, weight: 700 }, h3: { size: 28, weight: 600 }, body: { size: 22, weight: 400 } };
const SBB_BODY_TYPES  = { body: { size: 18, weight: 400 }, caption: { size: 14, weight: 400 } };

export function showStripBannerProperties(block) {
  const bgColor    = block.dataset.bgColor    || '#f5f5f5';
  const radius     = block.dataset.radius !== undefined ? parseInt(block.dataset.radius) : 0;
  const blockH     = parseInt(block.dataset.height)     || 200;
  const titleSize  = parseInt(block.dataset.titleSize)  || 28;
  const bodySize   = parseInt(block.dataset.bodySize)   || 20;
  const titleType  = block.dataset.titleType  || 'h3';
  const bodyType   = block.dataset.bodyType   || 'body';
  const titleColor = block.dataset.titleColor || '#111111';
  const bodyColor  = block.dataset.bodyColor  || '#555555';
  const usePadX    = block.dataset.usePadx !== 'false'; // 기본값 true (미설정 포함)
  const gapTopEl   = block.querySelector('.sbb-gap-top');
  const gapBotEl   = block.querySelector('.sbb-gap-bottom');
  const gapTopH    = parseInt(gapTopEl?.style.height)    || 20;
  const gapBotH    = parseInt(gapBotEl?.style.height)    || 20;

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="2" width="10" height="8" rx="1.5"/>
            <line x1="4" y1="2" x2="4" y2="10"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">Banner</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb(block)}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="navigator.clipboard.writeText('${block.id}')">${block.id}</span>` : ''}
      </div>
      <div class="prop-section-title">이미지</div>
      <div class="prop-row">
        <button class="prop-btn-full" onclick="window.triggerStripBannerImageUpload(document.getElementById('${block.id}'))">이미지 업로드</button>
      </div>
      ${block.classList.contains('has-image') ? `
      <div class="prop-row">
        <button class="prop-btn-full prop-btn-danger" onclick="window.clearStripBannerImage(document.getElementById('${block.id}'))">이미지 제거</button>
      </div>` : ''}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">크기</div>
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range" class="prop-slider" id="sbb-h-slider" min="80" max="600" step="8" value="${blockH}">
        <input type="number" class="prop-number" id="sbb-h-number" min="80" max="600" value="${blockH}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">텍스트 영역</div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        <div class="prop-color-swatch${bgColor==='transparent'?' swatch-none':''}" style="background:${bgColor==='transparent'?'transparent':bgColor}">
          <input type="color" id="sbb-bg-color" value="${bgColor==='transparent'?'#f5f5f5':bgColor}">
        </div>
        <input type="text" class="prop-color-hex" id="sbb-bg-hex" value="${bgColor==='transparent'?'':bgColor}" maxlength="7" placeholder="없음">
        <label class="prop-none-check"><input type="checkbox" id="sbb-bg-none" ${bgColor==='transparent'?'checked':''}>없음</label>
      </div>
      <div class="prop-row">
        <span class="prop-label">모서리</span>
        <input type="range" class="prop-slider" id="sbb-radius-slider" min="0" max="40" step="1" value="${radius}">
        <input type="number" class="prop-number" id="sbb-radius-number" min="0" max="40" value="${radius}">
      </div>
      <div class="prop-row">
        <span class="prop-label">상단 갭</span>
        <input type="range" class="prop-slider" id="sbb-gap-top-slider" min="0" max="120" step="2" value="${gapTopH}">
        <input type="number" class="prop-number" id="sbb-gap-top-number" min="0" max="120" value="${gapTopH}">
      </div>
      <div class="prop-row">
        <span class="prop-label">하단 갭</span>
        <input type="range" class="prop-slider" id="sbb-gap-bot-slider" min="0" max="120" step="2" value="${gapBotH}">
        <input type="number" class="prop-number" id="sbb-gap-bot-number" min="0" max="120" value="${gapBotH}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">제목 타입</div>
      <div class="prop-type-group">
        <button class="prop-type-btn ${titleType==='h1'?'active':''}" data-title-type="h1">H1</button>
        <button class="prop-type-btn ${titleType==='h2'?'active':''}" data-title-type="h2">H2</button>
        <button class="prop-type-btn ${titleType==='h3'?'active':''}" data-title-type="h3">H3</button>
        <button class="prop-type-btn ${titleType==='body'?'active':''}" data-title-type="body">Body</button>
      </div>
      <div class="prop-row" style="margin-top:6px">
        <span class="prop-label">크기</span>
        <input type="range" class="prop-slider" id="sbb-title-slider" min="12" max="72" step="1" value="${titleSize}">
        <input type="number" class="prop-number" id="sbb-title-number" min="12" max="72" value="${titleSize}">
      </div>
      <div class="prop-color-row">
        <span class="prop-label">글자색</span>
        <div class="prop-color-swatch" style="background:${titleColor}">
          <input type="color" id="sbb-title-color" value="${titleColor}">
        </div>
        <input type="text" class="prop-color-hex" id="sbb-title-color-hex" value="${titleColor}" maxlength="7">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">본문 타입</div>
      <div class="prop-type-group">
        <button class="prop-type-btn ${bodyType==='body'?'active':''}" data-body-type="body">Body</button>
        <button class="prop-type-btn ${bodyType==='caption'?'active':''}" data-body-type="caption">Caption</button>
      </div>
      <div class="prop-row" style="margin-top:6px">
        <span class="prop-label">크기</span>
        <input type="range" class="prop-slider" id="sbb-body-slider" min="10" max="48" step="1" value="${bodySize}">
        <input type="number" class="prop-number" id="sbb-body-number" min="10" max="48" value="${bodySize}">
      </div>
      <div class="prop-color-row">
        <span class="prop-label">글자색</span>
        <div class="prop-color-swatch" style="background:${bodyColor}">
          <input type="color" id="sbb-body-color" value="${bodyColor}">
        </div>
        <input type="text" class="prop-color-hex" id="sbb-body-color-hex" value="${bodyColor}" maxlength="7">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">텍스트 정렬</div>
      <div class="prop-row">
        <div class="prop-align-group" id="sbb-align-group">
          <button class="prop-align-btn${(block.dataset.textAlign||'left')==='left'?' active':''}"   data-align="left">←</button>
          <button class="prop-align-btn${(block.dataset.textAlign||'left')==='center'?' active':''}" data-align="center">↔</button>
          <button class="prop-align-btn${(block.dataset.textAlign||'left')==='right'?' active':''}"  data-align="right">→</button>
        </div>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">이미지 위치</div>
      <div class="prop-row">
        <div class="prop-align-group" id="sbb-imgpos-group" style="width:100%">
          <button class="prop-align-btn${(block.dataset.imgPos||'left')==='left'?' active':''}"  data-pos="left" style="flex:1;font-size:11px">← 왼쪽</button>
          <button class="prop-align-btn${(block.dataset.imgPos||'left')==='right'?' active':''}" data-pos="right" style="flex:1;font-size:11px">오른쪽 →</button>
        </div>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">레이아웃</div>
      <div class="prop-row">
        <span class="prop-label">페이지 패딩</span>
        <label class="prop-toggle">
          <input type="checkbox" id="sbb-padx-toggle" ${usePadX ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
    </div>
    <div class="prop-section">
      <div style="font-size:11px;color:#555;margin-top:2px;">더블클릭 편집 · 드래그로 순서 변경</div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  // 높이
  const hSlider = document.getElementById('sbb-h-slider');
  const hNumber = document.getElementById('sbb-h-number');
  const applyHeight = v => {
    v = Math.min(600, Math.max(80, v));
    block.dataset.height = v;
    block.style.minHeight = v + 'px';
    hSlider.value = v; hNumber.value = v;
  };
  hSlider.addEventListener('input',  () => applyHeight(parseInt(hSlider.value)));
  hNumber.addEventListener('change', () => { applyHeight(parseInt(hNumber.value)); window.pushHistory(); });
  hSlider.addEventListener('change', () => window.pushHistory());

  // 배경색
  const bgInput  = document.getElementById('sbb-bg-color');
  const bgHex    = document.getElementById('sbb-bg-hex');
  const bgNone   = document.getElementById('sbb-bg-none');
  const content  = block.querySelector('.sbb-content');

  function applyBg(val) {
    block.dataset.bgColor = val;
    content.style.background = val;
    if (val === 'transparent') {
      block.style.background = '';
    }
  }
  const bgSwatch = bgInput.closest('.prop-color-swatch');
  bgInput.addEventListener('input', () => {
    if (bgNone.checked) return;
    bgHex.value = bgInput.value;
    bgSwatch.style.background = bgInput.value;
    applyBg(bgInput.value);
  });
  bgHex.addEventListener('change', () => {
    const v = bgHex.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) { bgInput.value = v; bgSwatch.style.background = v; applyBg(v); }
  });
  bgNone.addEventListener('change', () => {
    if (bgNone.checked) {
      bgSwatch.style.background = 'transparent';
      bgSwatch.classList.add('swatch-none');
      bgHex.value = '';
      applyBg('transparent');
    } else {
      const v = bgInput.value || '#f5f5f5';
      bgSwatch.style.background = v;
      bgSwatch.classList.remove('swatch-none');
      bgHex.value = v;
      applyBg(v);
    }
  });

  // 모서리
  const rSlider = document.getElementById('sbb-radius-slider');
  const rNumber = document.getElementById('sbb-radius-number');

  function applyRadius(val) {
    block.dataset.radius = val;
    block.style.borderRadius = val + 'px';
  }
  rSlider.addEventListener('input', () => { rNumber.value = rSlider.value; applyRadius(rSlider.value); });
  rNumber.addEventListener('input', () => {
    const v = Math.min(40, Math.max(0, parseInt(rNumber.value) || 0));
    rSlider.value = v; applyRadius(v);
  });

  // 제목 타입 + 크기
  const headingEl  = block.querySelector('.sbb-heading');
  const tsSlider   = document.getElementById('sbb-title-slider');
  const tsNumber   = document.getElementById('sbb-title-number');
  const applyTitleSize = v => {
    v = Math.min(72, Math.max(12, v));
    block.dataset.titleSize  = v;
    if (headingEl) headingEl.style.fontSize = v + 'px';
    tsSlider.value = v; tsNumber.value = v;
  };
  const applyTitleType = type => {
    const preset = SBB_TITLE_TYPES[type];
    if (!preset) return;
    block.dataset.titleType = type;
    if (headingEl) headingEl.style.fontWeight = preset.weight;
    applyTitleSize(preset.size);
    document.querySelectorAll('[data-title-type]').forEach(b => b.classList.toggle('active', b.dataset.titleType === type));
    window.pushHistory();
  };
  document.querySelectorAll('[data-title-type]').forEach(btn =>
    btn.addEventListener('click', () => applyTitleType(btn.dataset.titleType))
  );
  tsSlider.addEventListener('input',  () => applyTitleSize(parseInt(tsSlider.value)));
  tsNumber.addEventListener('change', () => { applyTitleSize(parseInt(tsNumber.value)); window.pushHistory(); });
  tsSlider.addEventListener('change', () => window.pushHistory());

  // 본문 타입 + 크기
  const bodyEl   = block.querySelector('.sbb-body');
  const bsSlider = document.getElementById('sbb-body-slider');
  const bsNumber = document.getElementById('sbb-body-number');
  const applyBodySize = v => {
    v = Math.min(48, Math.max(10, v));
    block.dataset.bodySize   = v;
    if (bodyEl) bodyEl.style.fontSize = v + 'px';
    bsSlider.value = v; bsNumber.value = v;
  };
  const applyBodyType = type => {
    const preset = SBB_BODY_TYPES[type];
    if (!preset) return;
    block.dataset.bodyType = type;
    if (bodyEl) bodyEl.style.fontWeight = preset.weight;
    applyBodySize(preset.size);
    document.querySelectorAll('[data-body-type]').forEach(b => b.classList.toggle('active', b.dataset.bodyType === type));
    window.pushHistory();
  };
  document.querySelectorAll('[data-body-type]').forEach(btn =>
    btn.addEventListener('click', () => applyBodyType(btn.dataset.bodyType))
  );
  bsSlider.addEventListener('input',  () => applyBodySize(parseInt(bsSlider.value)));
  bsNumber.addEventListener('change', () => { applyBodySize(parseInt(bsNumber.value)); window.pushHistory(); });
  bsSlider.addEventListener('change', () => window.pushHistory());

  // 제목 글자색
  const titleColorInput = document.getElementById('sbb-title-color');
  const titleColorHex   = document.getElementById('sbb-title-color-hex');
  const titleColorSwatch = titleColorInput?.closest('.prop-color-swatch');
  const applyTitleColor = val => {
    block.dataset.titleColor = val;
    if (headingEl) headingEl.style.color = val;
    if (titleColorSwatch) titleColorSwatch.style.background = val;
    if (titleColorInput) titleColorInput.value = val;
    if (titleColorHex)   titleColorHex.value   = val;
  };
  titleColorInput?.addEventListener('input', () => applyTitleColor(titleColorInput.value));
  titleColorHex?.addEventListener('change', () => {
    if (/^#[0-9a-fA-F]{6}$/.test(titleColorHex.value)) { applyTitleColor(titleColorHex.value); window.pushHistory(); }
  });
  titleColorInput?.addEventListener('change', () => window.pushHistory());

  // 본문 글자색
  const bodyColorInput  = document.getElementById('sbb-body-color');
  const bodyColorHex    = document.getElementById('sbb-body-color-hex');
  const bodyColorSwatch = bodyColorInput?.closest('.prop-color-swatch');
  const applyBodyColor = val => {
    block.dataset.bodyColor = val;
    block.querySelectorAll('.sbb-body').forEach(el => el.style.color = val);
    if (bodyColorSwatch) bodyColorSwatch.style.background = val;
    if (bodyColorInput) bodyColorInput.value = val;
    if (bodyColorHex)   bodyColorHex.value   = val;
  };
  bodyColorInput?.addEventListener('input', () => applyBodyColor(bodyColorInput.value));
  bodyColorHex?.addEventListener('change', () => {
    if (/^#[0-9a-fA-F]{6}$/.test(bodyColorHex.value)) { applyBodyColor(bodyColorHex.value); window.pushHistory(); }
  });
  bodyColorInput?.addEventListener('change', () => window.pushHistory());

  // sbb-gap 드래그 리사이즈 바인딩
  const bindSbbGaps = () => {
    block.querySelectorAll('.sbb-gap').forEach(gap => {
      if (gap._sbbGapBound) return;
      gap._sbbGapBound = true;
      gap.addEventListener('mousedown', e => {
        if (!block.classList.contains('selected')) return;
        e.stopPropagation();
        e.preventDefault();
        const startY = e.clientY;
        const startH = parseInt(gap.style.height) || 12;
        const onMove = ev => {
          const newH = Math.max(0, Math.min(120, startH + (ev.clientY - startY)));
          gap.style.height = newH + 'px';
        };
        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          window.pushHistory();
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
  };
  bindSbbGaps();

  // 상단 갭 슬라이더
  const gapTopSlider = document.getElementById('sbb-gap-top-slider');
  const gapTopNumber = document.getElementById('sbb-gap-top-number');
  const applyGapTop = val => {
    const el = block.querySelector('.sbb-gap-top');
    if (el) el.style.height = val + 'px';
    if (gapTopSlider) gapTopSlider.value = val;
    if (gapTopNumber) gapTopNumber.value = val;
  };
  gapTopSlider?.addEventListener('input', e => applyGapTop(parseInt(e.target.value)));
  gapTopSlider?.addEventListener('change', () => window.pushHistory());
  gapTopNumber?.addEventListener('change', e => { applyGapTop(parseInt(e.target.value) || 0); window.pushHistory(); });

  // 하단 갭 슬라이더
  const gapBotSlider = document.getElementById('sbb-gap-bot-slider');
  const gapBotNumber = document.getElementById('sbb-gap-bot-number');
  const applyGapBot = val => {
    const el = block.querySelector('.sbb-gap-bottom');
    if (el) el.style.height = val + 'px';
    if (gapBotSlider) gapBotSlider.value = val;
    if (gapBotNumber) gapBotNumber.value = val;
  };
  gapBotSlider?.addEventListener('input', e => applyGapBot(parseInt(e.target.value)));
  gapBotSlider?.addEventListener('change', () => window.pushHistory());
  gapBotNumber?.addEventListener('change', e => { applyGapBot(parseInt(e.target.value) || 0); window.pushHistory(); });

  // 텍스트 정렬
  const applyStripAlign = a => {
    block.dataset.textAlign = a;
    block.querySelectorAll('.sbb-heading, .sbb-body').forEach(el => el.style.textAlign = a);
    document.querySelectorAll('#sbb-align-group .prop-align-btn').forEach(b => b.classList.toggle('active', b.dataset.align === a));
    window.pushHistory();
  };
  document.querySelectorAll('#sbb-align-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => applyStripAlign(btn.dataset.align));
  });

  // 이미지 위치
  const applyImgPos = pos => {
    block.dataset.imgPos = pos;
    document.querySelectorAll('#sbb-imgpos-group .prop-align-btn').forEach(b => b.classList.toggle('active', b.dataset.pos === pos));
    window.pushHistory();
  };
  document.querySelectorAll('#sbb-imgpos-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => applyImgPos(btn.dataset.pos));
  });

  // padX 토글 — sbb-content 에만 적용 (이미지는 full-bleed 유지)
  const sbbContentEl2 = block.querySelector('.sbb-content');
  const applyPadX = checked => {
    block.dataset.usePadx = checked ? 'true' : 'false';
    if (sbbContentEl2) {
      sbbContentEl2.style.paddingLeft  = checked ? state.pageSettings.padX + 'px' : '24px';
      sbbContentEl2.style.paddingRight = checked ? state.pageSettings.padX + 'px' : '24px';
    }
  };
  applyPadX(usePadX); // 현재 상태 반영
  document.getElementById('sbb-padx-toggle').addEventListener('change', e => {
    applyPadX(e.target.checked);
    window.pushHistory();
  });

  // 텍스트 행 추가/제거
  const sbbContent = block.querySelector('.sbb-content');

  const bindSbbRowDrag = (sbbContent) => {
    // sbbRowSrc를 element에 저장해 여러 번 호출해도 동일한 상태 공유
    [...sbbContent.children].forEach(row => {
      if (row._sbbRowDragBound) return;
      row._sbbRowDragBound = true;
      row.setAttribute('draggable', 'true');
      row.style.cursor = 'grab';
      row.addEventListener('dragstart', e => {
        e.stopPropagation();
        sbbContent._sbbRowSrc = row;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
        setTimeout(() => row.style.opacity = '0.4', 0);
      });
      row.addEventListener('dragend', () => { row.style.opacity = ''; sbbContent._sbbRowSrc = null; sbbContent.querySelectorAll('.sbb-row-indicator').forEach(el => el.remove()); });
    });
    if (sbbContent._sbbDropBound) return;
    sbbContent._sbbDropBound = true;
    sbbContent.addEventListener('dragover', e => {
      e.preventDefault(); e.stopPropagation();
      if (!sbbContent._sbbRowSrc) return;
      sbbContent.querySelectorAll('.sbb-row-indicator').forEach(el => el.remove());
      const rows = [...sbbContent.children].filter(el => !el.classList.contains('sbb-row-indicator'));
      const after = rows.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = e.clientY - box.top - box.height / 2;
        return (offset < 0 && offset > closest.offset) ? { offset, element: child } : closest;
      }, { offset: Number.NEGATIVE_INFINITY }).element;
      const ind = document.createElement('div');
      ind.className = 'sbb-row-indicator';
      ind.style.cssText = 'height:2px;background:#2d6fe8;margin:2px 0;pointer-events:none';
      if (after) sbbContent.insertBefore(ind, after);
      else sbbContent.appendChild(ind);
    });
    sbbContent.addEventListener('dragleave', e => {
      if (!sbbContent.contains(e.relatedTarget)) sbbContent.querySelectorAll('.sbb-row-indicator').forEach(el => el.remove());
    });
    sbbContent.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation();
      if (!sbbContent._sbbRowSrc) return;
      const ind = sbbContent.querySelector('.sbb-row-indicator');
      if (ind) { sbbContent.insertBefore(sbbContent._sbbRowSrc, ind); ind.remove(); }
      sbbContent._sbbRowSrc.style.opacity = '';
      sbbContent._sbbRowSrc = null;
      window.pushHistory();
    });
  };
  if (sbbContent) bindSbbRowDrag(sbbContent);

}


window.showStripBannerProperties = showStripBannerProperties;
