// prop-simple-card.js
// prop-canvas.js에서 분리: 심플 카드 블록 프로퍼티 패널 (showSimpleCardProperties + _escHtml)
import { propPanel } from '../globals.js';

function showSimpleCardProperties(block) {
  const w         = parseInt(block.dataset.canvasW)  || 360;
  const h         = parseInt(block.dataset.canvasH)  || 480;
  const radius    = parseInt(block.dataset.radius)   || 12;
  const imgRatio  = parseInt(block.dataset.imgRatio) ?? 76;
  const textHide   = block.dataset.textHide === 'true';
  const isTextBgTransparent = block.dataset.textBg === 'transparent';
  const textBgLast = block.dataset.textBgLast || '#f5f5f5';
  const textBg    = isTextBgTransparent ? textBgLast : (block.dataset.textBg || '#f5f5f5');
  const titleColor = block.dataset.titleColor || '#ffffff';
  const descColor  = block.dataset.descColor  || '#ffffff';
  const titleSize = parseInt(block.dataset.titleSize) || 20;
  const descSize  = parseInt(block.dataset.descSize)  || 14;
  const textAlign = block.dataset.textAlign || 'left';
  const cards     = JSON.parse(block.dataset.cards   || '[]');
  const gridCols  = parseInt(block.dataset.gridCols) || 1;
  const gridRows  = parseInt(block.dataset.gridRows) || 1;
  const cardGap   = parseInt(block.dataset.cardGap ?? 12);
  const padX      = parseInt(block.dataset.padX ?? 0);
  const imgShape  = block.dataset.imgShape || 'rect';
  const labelPos  = block.dataset.labelPos || 'bottom';
  const overlayHeight = parseInt(block.dataset.overlayHeight) || 140;
  const overlayWidth  = Math.min(100, Math.max(10, parseInt(block.dataset.overlayWidth) || 100));
  const isOverlay = labelPos.startsWith('overlay-');
  const iconMode  = block.dataset.iconMode === 'true';
  const iconScale = Math.min(90, Math.max(10, parseInt(block.dataset.iconScale) || 46));
  const iconColor = block.dataset.iconColor || '#333333';
  const iconBgRaw = block.dataset.iconBg || (iconMode ? '#eeeeee' : 'transparent');
  const isIconBgTransparent = iconBgRaw === 'transparent';
  const iconBg    = isIconBgTransparent ? (block.dataset.iconBgLast || '#eeeeee') : iconBgRaw;

  const isBoth = labelPos === 'both';
  const cardItemsHtml = cards.map((card, i) => {
    const imgScale = Math.min(400, Math.max(100, parseInt(card.imgScale) || 100));
    return `
    <div class="cvb-card-item" data-card-index="${i}">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
        <span class="cvb-card-meta-label">카드 ${i + 1}</span>
        <div class="prop-color-swatch cvb-card-bg-swatch" style="width:16px;height:16px;border-radius:3px;flex-shrink:0;background:${card.cellBg || textBg};" title="개별 배경색">
          <input type="color" class="cvb-card-cell-bg" data-card-index="${i}" value="${card.cellBg || textBg}">
        </div>
        <button class="prop-btn cvb-card-img-btn cvb-card-btn-sm" data-card-index="${i}" title="${card.imgSrc ? '이미지 교체' : '이미지 추가'}" style="display:inline-flex;align-items:center;justify-content:center;padding:3px 6px;">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1.5" y="2.5" width="11" height="9" rx="1.3"/>
            <circle cx="5" cy="5.5" r="1"/>
            <path d="M12.5 9L9.5 6.5 4 11.5"/>
          </svg>
        </button>
        ${card.imgSrc ? `<button class="prop-btn cvb-card-img-clear cvb-card-btn-sm-del" data-card-index="${i}" title="이미지 제거">✕</button>` : ''}
        ${block.dataset.iconMode === 'true' ? `
        <button class="prop-btn cvb-card-icon-btn cvb-card-btn-sm" data-card-index="${i}" title="${card.icon ? '아이콘 교체' : '아이콘 추가'}" style="display:inline-flex;align-items:center;justify-content:center;padding:3px 6px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6.4 6.9.6-5.2 4.6 1.6 6.8L12 17.9 5.8 21.5l1.6-6.8L2.2 9.5l6.9-.6z"/></svg>
        </button>
        ${card.icon ? `<button class="prop-btn cvb-card-icon-clear cvb-card-btn-sm-del" data-card-index="${i}" title="아이콘 제거">✕</button>` : ''}` : ''}
      </div>
      ${card.imgSrc ? `
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:5px;">
        <span class="cvb-card-meta" style="flex:1;">Fit</span>
        <button class="prop-align-btn cvb-card-fit-btn cvb-card-btn-sm${(card.imgFit||'cover')==='cover'?' active':''}" data-card-index="${i}" data-fit="cover" style="padding:2px 8px;">꽉 채우기</button>
        <button class="prop-align-btn cvb-card-fit-btn cvb-card-btn-sm${(card.imgFit||'cover')==='contain'?' active':''}" data-card-index="${i}" data-fit="contain" style="padding:2px 8px;">원본 비율</button>
      </div>
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:5px;">
        <span class="cvb-card-meta" style="flex:0 0 auto;">확대</span>
        <input type="range" class="prop-slider cvb-card-zoom" data-card-index="${i}" min="100" max="400" step="10" value="${imgScale}" style="flex:1;">
        <input type="number" class="prop-number cvb-card-zoom-num" data-card-index="${i}" min="100" max="400" step="10" value="${imgScale}" style="width:54px;">
        <span class="cvb-card-meta">%</span>
      </div>` : ''}
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:5px;">
        <span class="cvb-card-meta" style="flex:1;">테두리</span>
        <div class="prop-color-swatch cvb-card-border-swatch" style="width:16px;height:16px;border-radius:3px;flex-shrink:0;background:${card.borderColor || '#ffffff'};" title="테두리 색상">
          <input type="color" class="cvb-card-border-color" data-card-index="${i}" value="${card.borderColor || '#ffffff'}">
        </div>
        <input type="number" class="cvb-card-border-width" data-card-index="${i}" value="${card.borderWidth || 0}" min="0" max="20">
        <span class="cvb-card-meta">px</span>
      </div>
      ${isBoth ? `
      <div class="cvb-slot-block" style="border-left:2px solid var(--ui-border, #ddd);padding-left:6px;margin-bottom:6px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
          <span class="cvb-card-meta" style="flex:1;font-weight:600;">상단 라벨</span>
          <div class="prop-color-swatch" style="width:14px;height:14px;border-radius:3px;flex-shrink:0;background:${card.titleColorTop || titleColor};" title="상단 제목 색">
            <input type="color" class="cvb-slot-color" data-card-index="${i}" data-slot-field="titleColorTop" value="${/^#[0-9a-fA-F]{6}$/.test(card.titleColorTop||'') ? card.titleColorTop : (/^#[0-9a-fA-F]{6}$/.test(titleColor)?titleColor:'#ffffff')}">
          </div>
          <div class="prop-color-swatch" style="width:14px;height:14px;border-radius:3px;flex-shrink:0;background:${card.descColorTop || descColor};" title="상단 설명 색">
            <input type="color" class="cvb-slot-color" data-card-index="${i}" data-slot-field="descColorTop" value="${/^#[0-9a-fA-F]{6}$/.test(card.descColorTop||'') ? card.descColorTop : (/^#[0-9a-fA-F]{6}$/.test(descColor)?descColor:'#ffffff')}">
          </div>
        </div>
        <textarea class="cvb-card-input cvb-slot-input" data-card-index="${i}" data-slot-field="titleTop" placeholder="상단 제목..." rows="1">${_escHtml(card.titleTop ?? '')}</textarea>
        <textarea class="cvb-card-input cvb-slot-input" data-card-index="${i}" data-slot-field="descTop" placeholder="상단 설명..." rows="1">${_escHtml(card.descTop ?? '')}</textarea>
      </div>
      <div class="cvb-slot-block" style="border-left:2px solid var(--ui-border, #ddd);padding-left:6px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
          <span class="cvb-card-meta" style="flex:1;font-weight:600;">하단 라벨</span>
          <div class="prop-color-swatch" style="width:14px;height:14px;border-radius:3px;flex-shrink:0;background:${card.titleColorBottom || titleColor};" title="하단 제목 색">
            <input type="color" class="cvb-slot-color" data-card-index="${i}" data-slot-field="titleColorBottom" value="${/^#[0-9a-fA-F]{6}$/.test(card.titleColorBottom||'') ? card.titleColorBottom : (/^#[0-9a-fA-F]{6}$/.test(titleColor)?titleColor:'#ffffff')}">
          </div>
          <div class="prop-color-swatch" style="width:14px;height:14px;border-radius:3px;flex-shrink:0;background:${card.descColorBottom || descColor};" title="하단 설명 색">
            <input type="color" class="cvb-slot-color" data-card-index="${i}" data-slot-field="descColorBottom" value="${/^#[0-9a-fA-F]{6}$/.test(card.descColorBottom||'') ? card.descColorBottom : (/^#[0-9a-fA-F]{6}$/.test(descColor)?descColor:'#ffffff')}">
          </div>
        </div>
        <textarea class="cvb-card-input cvb-slot-input" data-card-index="${i}" data-slot-field="titleBottom" placeholder="하단 제목..." rows="1">${_escHtml(card.titleBottom ?? '')}</textarea>
        <textarea class="cvb-card-input cvb-slot-input" data-card-index="${i}" data-slot-field="descBottom" placeholder="하단 설명..." rows="1">${_escHtml(card.descBottom ?? '')}</textarea>
      </div>
      ` : `
      <textarea class="cvb-card-title-input cvb-card-input" data-card-index="${i}" placeholder="제목 입력..." rows="2">${_escHtml(card.title || '')}</textarea>
      <textarea class="cvb-card-desc-input cvb-card-input" data-card-index="${i}" placeholder="설명 입력..." rows="2">${_escHtml(card.desc || '')}</textarea>
      `}
    </div>
  `;
  }).join('');

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="10" height="10" rx="2"/>
            <rect x="3" y="3" width="3" height="6" rx="0.5" fill="#888" stroke="none"/>
            <rect x="7" y="3" width="2" height="3" rx="0.5" fill="#888" stroke="none"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Card'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Card Size</div>
      <div class="prop-row">
        <span class="prop-label">W</span>
        <input type="number" class="prop-number" id="cvb-w" value="${w}" min="100" max="1200">
        <span class="prop-label" style="margin-left:8px">H</span>
        <input type="number" class="prop-number" id="cvb-h" value="${h}" min="40" max="2000">
      </div>
      <div class="prop-row">
        <span class="prop-label">이미지 비율</span>
        <input type="range" class="prop-slider" id="cvb-img-ratio-slider" min="20" max="90" step="1" value="${imgRatio}">
        <input type="number" class="prop-number" id="cvb-img-ratio-number" min="20" max="90" value="${imgRatio}">
      </div>
      <div class="prop-row">
        <span class="prop-label">이미지 모양</span>
        <div class="prop-align-group" id="cvb-img-shape-group">
          <button class="prop-align-btn${imgShape === 'rect' ? ' active' : ''}" data-shape="rect" title="사각">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.5" y="2.5" width="11" height="11" rx="1"/></svg>
          </button>
          <button class="prop-align-btn${imgShape === 'circle' ? ' active' : ''}" data-shape="circle" title="원형">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="5.5"/></svg>
          </button>
        </div>
      </div>
      <div class="prop-row">
        <span class="prop-label">라벨 모드</span>
        <div class="prop-align-group" id="cvb-label-mode-group">
          <button class="prop-align-btn${(!isOverlay && !textHide) ? ' active' : ''}" data-mode="separate" title="분리 박스 — 이미지와 텍스트가 별도 영역">분리</button>
          <button class="prop-align-btn${(isOverlay && !textHide) ? ' active' : ''}" data-mode="overlay" title="오버레이 — 이미지 위에 텍스트가 떠 있음 (그라데이션용)">오버레이</button>
          <button class="prop-align-btn${textHide ? ' active' : ''}" data-mode="hide" title="숨김 — 텍스트 영역 없이 이미지만 표시">숨김</button>
        </div>
      </div>
      <div class="prop-row">
        <span class="prop-label">라벨 위치</span>
        <div class="prop-align-group" id="cvb-label-pos-group" data-mode="${isOverlay ? 'overlay' : 'separate'}">
          ${!isOverlay ? `
          <button class="prop-align-btn${labelPos === 'top' ? ' active' : ''}" data-pos="top" title="라벨 위">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="2" width="12" height="3.5" fill="currentColor"/><rect x="2" y="6.5" width="12" height="7.5"/></svg>
          </button>
          <button class="prop-align-btn${labelPos === 'bottom' ? ' active' : ''}" data-pos="bottom" title="라벨 아래">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="2" width="12" height="7.5"/><rect x="2" y="10.5" width="12" height="3.5" fill="currentColor"/></svg>
          </button>
          <button class="prop-align-btn${labelPos === 'both' ? ' active' : ''}" data-pos="both" title="라벨 위+아래">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="2" width="12" height="2.5" fill="currentColor"/><rect x="2" y="5.5" width="12" height="5"/><rect x="2" y="11.5" width="12" height="2.5" fill="currentColor"/></svg>
          </button>
          ` : `
          <button class="prop-align-btn${labelPos === 'overlay-top' ? ' active' : ''}" data-pos="overlay-top" title="위쪽 오버레이">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="2" width="12" height="12"/><rect x="2" y="2" width="12" height="3.5" fill="currentColor" opacity="0.7"/></svg>
          </button>
          <button class="prop-align-btn${labelPos === 'overlay-bottom' ? ' active' : ''}" data-pos="overlay-bottom" title="아래쪽 오버레이">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="2" width="12" height="12"/><rect x="2" y="10.5" width="12" height="3.5" fill="currentColor" opacity="0.7"/></svg>
          </button>
          <button class="prop-align-btn${labelPos === 'overlay-center' ? ' active' : ''}" data-pos="overlay-center" title="중앙 오버레이">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="2" width="12" height="12"/><rect x="2" y="6.5" width="12" height="3" fill="currentColor" opacity="0.7"/></svg>
          </button>
          `}
        </div>
      </div>
      <div class="prop-row" id="cvb-overlay-h-row" style="display:${isOverlay ? 'flex' : 'none'}">
        <span class="prop-label">오버레이 높이</span>
        <input type="range" class="prop-slider" id="cvb-overlay-h-slider" min="40" max="400" step="4" value="${overlayHeight}">
        <input type="number" class="prop-number" id="cvb-overlay-h-number" min="40" max="400" value="${overlayHeight}">
      </div>
      <div class="prop-row" id="cvb-overlay-w-row" style="display:${isOverlay ? 'flex' : 'none'}">
        <span class="prop-label">오버레이 너비</span>
        <input type="range" class="prop-slider" id="cvb-overlay-w-slider" min="10" max="100" step="1" value="${overlayWidth}">
        <input type="number" class="prop-number" id="cvb-overlay-w-number" min="10" max="100" value="${overlayWidth}">
      </div>
      <div class="prop-color-row">
        <span class="prop-label">라벨 배경</span>
        <div class="prop-color-swatch" id="cvb-text-bg-swatch" style="background:${(block.dataset.textBg || 'transparent').replace(/"/g, '&quot;')}" title="클릭해서 단색 선택">
          <input type="color" id="cvb-text-bg-pick" value="${/^#[0-9a-fA-F]{6}$/.test(block.dataset.textBg || '') ? block.dataset.textBg : '#222222'}">
        </div>
        <input type="text" class="prop-color-hex" id="cvb-text-bg-raw" value="${(block.dataset.textBg || '').replace(/"/g, '&quot;')}" placeholder="hex / rgba / linear-gradient(...)" title="${(block.dataset.textBg || '').replace(/"/g, '&quot;')}">
      </div>
      <div class="prop-row" style="padding-left:60px;gap:4px;">
        <span class="prop-label" style="font-size:10px;color:var(--ui-text-sub);min-width:0;flex:0 0 auto;margin-right:4px;">그라데이션</span>
        <button class="prop-align-btn cvb-grad-preset" data-grad="linear-gradient(180deg, transparent, rgba(0,0,0,0.85))" title="아래로 어두워짐" style="background:linear-gradient(180deg, transparent, rgba(0,0,0,0.85));">↓</button>
        <button class="prop-align-btn cvb-grad-preset" data-grad="linear-gradient(0deg, transparent, rgba(0,0,0,0.85))" title="위로 어두워짐" style="background:linear-gradient(0deg, transparent, rgba(0,0,0,0.85));">↑</button>
        <button class="prop-align-btn cvb-grad-preset" data-grad="linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.95))" title="아래 강조" style="background:linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.95));">⇊</button>
        <button class="prop-align-btn cvb-grad-preset" data-grad="rgba(0,0,0,0.5)" title="반투명 검정" style="background:rgba(0,0,0,0.5);">半</button>
      </div>
      <div class="prop-row">
        <span class="prop-label">모서리</span>
        <input type="range" class="prop-slider" id="cvb-radius-slider" min="0" max="60" step="1" value="${radius}">
        <input type="number" class="prop-number" id="cvb-radius-number" min="0" max="60" value="${radius}">
      </div>
    </div>

    ${iconMode ? `
    <div class="prop-section">
      <div class="prop-section-title">아이콘 (이스터에그)</div>
      <div class="prop-row">
        <span class="prop-label">아이콘 크기</span>
        <input type="range" class="prop-slider" id="cvb-icon-size-slider" min="10" max="90" step="1" value="${iconScale}">
        <input type="number" class="prop-number" id="cvb-icon-size-number" min="10" max="90" value="${iconScale}">
      </div>
      <div class="prop-color-row">
        <span class="prop-label">아이콘 색</span>
        <div class="prop-color-swatch" style="background:${iconColor}">
          <input type="color" id="cvb-icon-color-pick" value="${iconColor}">
        </div>
        <input type="text" class="prop-color-hex" id="cvb-icon-color-hex" value="${iconColor}" maxlength="7">
      </div>
      <div class="prop-color-row">
        <span class="prop-label">이미지 배경</span>
        <div class="prop-color-swatch" style="background:${isIconBgTransparent ? 'transparent' : iconBg}; ${isIconBgTransparent ? 'background-image:repeating-conic-gradient(#888 0% 25%,#555 0% 50%);background-size:8px 8px;' : ''}">
          <input type="color" id="cvb-iconbg-pick" value="${iconBg}" ${isIconBgTransparent ? 'disabled' : ''}>
        </div>
        <input type="text" class="prop-color-hex" id="cvb-iconbg-hex" value="${isIconBgTransparent ? 'transparent' : iconBg}" maxlength="11" ${isIconBgTransparent ? 'disabled' : ''}>
        <button class="prop-align-btn prop-align-btn--aux${isIconBgTransparent ? ' active' : ''}" id="cvb-iconbg-transparent-btn">투명</button>
      </div>
    </div>` : ''}

    <div class="prop-section">
      <div class="prop-section-title">Text Area</div>
      <div id="cvb-text-area-controls" style="${textHide ? 'opacity:0.35;pointer-events:none;' : ''}">
      <div class="prop-color-row">
        <span class="prop-label">배경색 (일괄)</span>
        <div class="prop-color-swatch" style="background:${isTextBgTransparent ? 'transparent' : textBg}; ${isTextBgTransparent ? 'background-image:repeating-conic-gradient(#888 0% 25%,#555 0% 50%);background-size:8px 8px;' : ''}">
          <input type="color" id="cvb-textbg-pick" value="${textBg}" ${isTextBgTransparent ? 'disabled' : ''}>
        </div>
        <input type="text" class="prop-color-hex" id="cvb-textbg-hex" value="${isTextBgTransparent ? 'transparent' : textBg}" maxlength="11" ${isTextBgTransparent ? 'disabled' : ''}>
        <button class="prop-align-btn prop-align-btn--aux${isTextBgTransparent ? ' active' : ''}" id="cvb-textbg-transparent-btn">투명</button>
      </div>
      <div class="prop-color-row">
        <span class="prop-label">제목 색</span>
        <div class="prop-color-swatch" style="background:${titleColor}">
          <input type="color" id="cvb-title-color-pick" value="${titleColor.startsWith('rgba') ? '#ffffff' : titleColor}">
        </div>
        <input type="text" class="prop-color-hex" id="cvb-title-color-hex" value="${titleColor}" maxlength="7">
      </div>
      <div class="prop-color-row">
        <span class="prop-label">설명 색</span>
        <div class="prop-color-swatch" style="background:${descColor}">
          <input type="color" id="cvb-desc-color-pick" value="${descColor}">
        </div>
        <input type="text" class="prop-color-hex" id="cvb-desc-color-hex" value="${descColor}" maxlength="7">
      </div>
      <div class="prop-row">
        <span class="prop-label">제목 크기</span>
        <input type="range" class="prop-slider" id="cvb-title-slider" min="12" max="80" step="1" value="${titleSize}">
        <input type="number" class="prop-number" id="cvb-title-number" min="12" max="80" value="${titleSize}">
      </div>
      <div class="prop-row">
        <span class="prop-label">설명 크기</span>
        <input type="range" class="prop-slider" id="cvb-desc-slider" min="10" max="40" step="1" value="${descSize}">
        <input type="number" class="prop-number" id="cvb-desc-number" min="10" max="40" value="${descSize}">
      </div>
      <div class="prop-section-title" style="margin-top:6px;">Text Align</div>
      <div class="prop-align-group" id="cvb-align-group">
        <button class="prop-align-btn${textAlign==='left'?' active':''}"   data-align="left">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/>
            <line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn${textAlign==='center'?' active':''}" data-align="center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="6" x2="11" y2="6"/>
            <line x1="2" y1="9" x2="12" y2="9"/><line x1="4" y1="12" x2="10" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn${textAlign==='right'?' active':''}"  data-align="right">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/>
            <line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/>
          </svg>
        </button>
      </div>
      </div><!-- /cvb-text-area-controls -->
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Card Spacing</div>
      <div class="prop-row">
        <span class="prop-label">Gap</span>
        <input type="range" class="prop-slider" id="cvb-gap-slider" min="0" max="48" step="2" value="${cardGap}">
        <input type="number" class="prop-number" id="cvb-gap-number" min="0" max="48" value="${cardGap}">
      </div>
      <div class="prop-row">
        <span class="prop-label">좌우 패딩</span>
        <input type="range" class="prop-slider" id="cvb-padx-slider" min="0" max="80" step="4" value="${padX}">
        <input type="number" class="prop-number" id="cvb-padx-number" min="0" max="80" value="${padX}">
      </div>
      <div class="prop-row">
        <span class="prop-label">패딩 제외</span>
        <label class="prop-toggle">
          <input type="checkbox" id="cvb-fullbleed-toggle" ${block.dataset.fullBleed === 'true' ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
      <div class="prop-hint" style="margin-top:2px;">켜면 카드가 섹션 좌우 패딩을 무시하고 가장자리까지 확장됩니다</div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Card Grid (${gridCols}×${gridRows})</div>
      <div class="grid-picker" id="cvb-grid-picker"></div>
      <div class="grid-picker-label" id="cvb-grid-picker-label">—</div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Cards (${cards.length})</div>
      <div id="cvb-card-items">${cardItemsHtml}</div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  // ── Grid picker ─────────────────────────────────────────────────────────────
  const picker      = document.getElementById('cvb-grid-picker');
  const pickerLabel = document.getElementById('cvb-grid-picker-label');
  const MAX = 4;
  for (let r = 1; r <= MAX; r++) {
    for (let c = 1; c <= MAX; c++) {
      const cell = document.createElement('div');
      cell.className = 'grid-picker-cell';
      cell.dataset.r = r; cell.dataset.c = c;
      picker.appendChild(cell);
    }
  }
  picker.addEventListener('mouseover', e => {
    const cell = e.target.closest('.grid-picker-cell');
    if (!cell) return;
    const r = parseInt(cell.dataset.r), c = parseInt(cell.dataset.c);
    picker.querySelectorAll('.grid-picker-cell').forEach(cl => {
      cl.classList.toggle('active', parseInt(cl.dataset.r) <= r && parseInt(cl.dataset.c) <= c);
    });
    pickerLabel.textContent = `${c} × ${r}`;
  });
  picker.addEventListener('mouseleave', () => {
    picker.querySelectorAll('.grid-picker-cell').forEach(cl => cl.classList.remove('active'));
    pickerLabel.textContent = '—';
  });
  picker.addEventListener('click', e => {
    const cell = e.target.closest('.grid-picker-cell');
    if (!cell) return;
    const cols  = parseInt(cell.dataset.c);
    const rows  = parseInt(cell.dataset.r);
    const total = cols * rows;
    const curCards = JSON.parse(block.dataset.cards || '[]');
    while (curCards.length < total) curCards.push({ title: '카드 제목', desc: '', imgSrc: '', cellBg: '' });
    while (curCards.length > total) curCards.pop();
    block.dataset.cards    = JSON.stringify(curCards);
    block.dataset.gridCols = cols;
    block.dataset.gridRows = rows;
    window.renderCanvas(block);
    window.pushHistory?.();
    window.scheduleAutoSave?.();
    showSimpleCardProperties(block);
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const getCards = () => JSON.parse(block.dataset.cards || '[]');
  const setCards = (arr, skipHistory) => {
    block.dataset.cards = JSON.stringify(arr);
    window.renderCanvas(block);
    window.scheduleAutoSave?.();
    if (!skipHistory) window.pushHistory?.();
  };

  // ── 카드 크기 ────────────────────────────────────────────────────────────────
  const wInput = document.getElementById('cvb-w');
  const hInput = document.getElementById('cvb-h');
  wInput.addEventListener('change', () => { block.dataset.canvasW = wInput.value;  window.renderCanvas(block); window.pushHistory?.(); });
  hInput.addEventListener('change', () => { block.dataset.canvasH = hInput.value;  window.renderCanvas(block); window.pushHistory?.(); });

  // ── 이미지 모양 (사각/원형) ──────────────────────────────────────────────────
  const shapeGroup = document.getElementById('cvb-img-shape-group');
  shapeGroup?.querySelectorAll('.prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const shape = btn.dataset.shape;
      shapeGroup.querySelectorAll('.prop-align-btn').forEach(b => b.classList.toggle('active', b === btn));
      block.dataset.imgShape = shape;
      window.renderCanvas(block);
      window.pushHistory?.('이미지 모양');
      window.scheduleAutoSave?.();
    });
  });

  // ── 라벨 모드 (분리 vs 오버레이) — 모드 바꾸면 prop UI 재렌더 ───────────────────
  const modeGroup = document.getElementById('cvb-label-mode-group');
  const overlayHRow = document.getElementById('cvb-overlay-h-row');
  modeGroup?.querySelectorAll('.prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newMode = btn.dataset.mode;
      const currentPos = block.dataset.labelPos || 'bottom';
      const wasOverlay = currentPos.startsWith('overlay-');
      // hide 모드 — textHide=true. 다른 모드면 textHide=false
      const overlayWRow = document.getElementById('cvb-overlay-w-row');
      if (newMode === 'hide') {
        block.dataset.textHide = 'true';
        // hide 모드면 overlay-h/w-row 강제 숨김
        if (overlayHRow) overlayHRow.style.display = 'none';
        if (overlayWRow) overlayWRow.style.display = 'none';
      } else {
        block.dataset.textHide = 'false';
        // 모드 변경 시 labelPos 매핑: separate↔overlay 적절 기본값
        if (newMode === 'overlay' && !wasOverlay) {
          const bare = currentPos === 'both' ? 'bottom' : currentPos;
          block.dataset.labelPos = 'overlay-' + bare;
        } else if (newMode === 'separate' && wasOverlay) {
          const bare = currentPos.replace('overlay-', '').replace('center', 'bottom');
          block.dataset.labelPos = bare;
        }
      }
      window.renderCanvas(block);
      window.pushHistory?.('라벨 모드');
      window.scheduleAutoSave?.();
      // prop UI 재렌더 (위치 버튼이 모드에 따라 달라지므로)
      window.showSimpleCardProperties(block);
    });
  });

  // ── 라벨 위치 (모드에 맞는 옵션 중 선택) ────────────────────────────────────────
  const posGroup = document.getElementById('cvb-label-pos-group');
  posGroup?.querySelectorAll('.prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pos = btn.dataset.pos;
      posGroup.querySelectorAll('.prop-align-btn').forEach(b => b.classList.toggle('active', b === btn));
      block.dataset.labelPos = pos;
      const overlayOn = pos.startsWith('overlay-');
      if (overlayHRow) overlayHRow.style.display = overlayOn ? 'flex' : 'none';
      const owRow = document.getElementById('cvb-overlay-w-row');
      if (owRow) owRow.style.display = overlayOn ? 'flex' : 'none';
      window.renderCanvas(block);
      window.pushHistory?.('라벨 위치');
      window.scheduleAutoSave?.();
    });
  });

  // ── 오버레이 높이 ────────────────────────────────────────────────
  const ohSlider = document.getElementById('cvb-overlay-h-slider');
  const ohNumber = document.getElementById('cvb-overlay-h-number');
  if (ohSlider) {
    const applyOH = v => {
      v = Math.min(400, Math.max(40, v));
      block.dataset.overlayHeight = v;
      window.renderCanvas(block);
      ohSlider.value = v; ohNumber.value = v;
    };
    ohSlider.addEventListener('input',  () => applyOH(parseInt(ohSlider.value)));
    ohNumber.addEventListener('change', () => { applyOH(parseInt(ohNumber.value)); window.pushHistory?.(); window.scheduleAutoSave?.(); });
    ohSlider.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
  }
  // ── 오버레이 너비(%) ────────────────────────────────────────────────
  const owSlider = document.getElementById('cvb-overlay-w-slider');
  const owNumber = document.getElementById('cvb-overlay-w-number');
  if (owSlider) {
    const applyOW = v => {
      v = Math.min(100, Math.max(10, v));
      block.dataset.overlayWidth = v;
      window.renderCanvas(block);
      owSlider.value = v; owNumber.value = v;
    };
    owSlider.addEventListener('input',  () => applyOW(parseInt(owSlider.value)));
    owNumber.addEventListener('change', () => { applyOW(parseInt(owNumber.value)); window.pushHistory?.(); window.scheduleAutoSave?.(); });
    owSlider.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
  }

  // ── 라벨 배경 raw CSS (그라데이션/rgba 등 임의 입력) ────────────────────────
  // sanitize: <>"' 문자, javascript:/data:image/svg+xml inline, expression() 등 XSS 벡터 차단
  const sanitizeCss = (s) => {
    if (!s) return '';
    if (/[<>"]/.test(s)) return '';
    if (/javascript\s*:/i.test(s)) return '';
    if (/expression\s*\(/i.test(s)) return '';
    if (/<\s*script/i.test(s)) return '';
    if (/onerror|onclick|onload|onfocus/i.test(s)) return '';
    return s;
  };
  const textBgRaw = document.getElementById('cvb-text-bg-raw');
  const textBgSwatch = document.getElementById('cvb-text-bg-swatch');
  const textBgPick2 = document.getElementById('cvb-text-bg-pick');
  const syncSwatch = (v) => { if (textBgSwatch) textBgSwatch.style.background = v || 'transparent'; };
  // dataset.textBg를 공유하는 두 컨트롤(Card Size raw + Text Area 일괄)의 위젯을 양방향 동기화 —
  // 한쪽 변경 시 다른쪽 스와치/입력값이 stale로 남아 조용히 덮어쓰던 이중소스 desync 수정.
  function syncTextBgUI() {
    const v = block.dataset.textBg || '';
    const isT = v === 'transparent';
    const isHex6 = /^#[0-9a-fA-F]{6}$/.test(v);
    // cluster1 (Card Size)
    const c1raw = document.getElementById('cvb-text-bg-raw');
    const c1sw  = document.getElementById('cvb-text-bg-swatch');
    const c1pk  = document.getElementById('cvb-text-bg-pick');
    if (c1raw) { c1raw.value = isT ? '' : v; c1raw.title = v; }
    if (c1sw)  c1sw.style.background = isT ? 'transparent' : (v || 'transparent');
    if (c1pk && isHex6) c1pk.value = v;
    // cluster2 (Text Area 일괄)
    const c2pk = document.getElementById('cvb-textbg-pick');
    const c2hx = document.getElementById('cvb-textbg-hex');
    const c2bt = document.getElementById('cvb-textbg-transparent-btn');
    const c2sw = c2pk && c2pk.closest('.prop-color-swatch');
    if (c2bt) c2bt.classList.toggle('active', isT);
    if (c2pk) c2pk.disabled = isT;
    if (c2hx) c2hx.disabled = isT;
    if (isT) {
      if (c2hx) c2hx.value = 'transparent';
      if (c2sw) { c2sw.style.background = ''; c2sw.style.backgroundImage = 'repeating-conic-gradient(#888 0% 25%,#555 0% 50%)'; c2sw.style.backgroundSize = '8px 8px'; }
    } else {
      if (c2sw) { c2sw.style.backgroundImage = ''; c2sw.style.background = v || '#f5f5f5'; }
      if (isHex6) { if (c2pk) c2pk.value = v; if (c2hx) c2hx.value = v; }
      else if (c2hx && v.length <= 11) c2hx.value = v; // 그라데이션 등 긴 값은 스와치만 반영(hex 필드 미변경)
    }
  }
  if (textBgRaw) {
    // 실시간 preview (input 이벤트) — swatch만 갱신 (render는 change에서)
    textBgRaw.addEventListener('input', () => syncSwatch(sanitizeCss(textBgRaw.value.trim())));
    textBgRaw.addEventListener('change', () => {
      const raw = textBgRaw.value.trim();
      const v = sanitizeCss(raw);
      if (raw && !v) {
        textBgRaw.value = '';
        syncSwatch('');
        return;
      }
      if (v) block.dataset.textBg = v;
      else delete block.dataset.textBg;
      syncSwatch(v);
      textBgRaw.title = v;
      syncTextBgUI();
      window.renderCanvas(block);
      window.pushHistory?.('라벨 배경');
      window.scheduleAutoSave?.();
    });
  }
  // swatch 컬러 picker — 단색만 선택. 그라데이션 입력 상태에서 picker로 단색 선택 시 raw input도 hex로 동기화
  if (textBgPick2) {
    textBgPick2.addEventListener('input', () => {
      const v = textBgPick2.value;
      block.dataset.textBg = v;
      if (textBgRaw) { textBgRaw.value = v; textBgRaw.title = v; }
      syncSwatch(v);
      syncTextBgUI();
      window.renderCanvas(block);
    });
    textBgPick2.addEventListener('change', () => window.pushHistory?.('라벨 배경'));
  }
  // 그라데이션 preset 버튼 — 클릭 시 자동 입력
  document.querySelectorAll('.cvb-grad-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const grad = btn.dataset.grad;
      block.dataset.textBg = grad;
      if (textBgRaw) { textBgRaw.value = grad; textBgRaw.title = grad; }
      syncSwatch(grad);
      syncTextBgUI();
      window.renderCanvas(block);
      window.pushHistory?.('라벨 배경 그라데이션');
      window.scheduleAutoSave?.();
    });
  });

  // ── 이미지 비율 ──────────────────────────────────────────────────────────────
  const ratioSlider = document.getElementById('cvb-img-ratio-slider');
  const ratioNumber = document.getElementById('cvb-img-ratio-number');
  const applyRatio = v => {
    v = Math.min(90, Math.max(20, v));
    block.dataset.imgRatio = v;
    window.renderCanvas(block);
    ratioSlider.value = v; ratioNumber.value = v;
  };
  ratioSlider.addEventListener('input',  () => applyRatio(parseInt(ratioSlider.value)));
  ratioNumber.addEventListener('change', () => { applyRatio(parseInt(ratioNumber.value)); window.pushHistory?.(); });
  ratioSlider.addEventListener('change', () => window.pushHistory?.());

  // ── 모서리 ───────────────────────────────────────────────────────────────────
  const rSlider = document.getElementById('cvb-radius-slider');
  const rNumber = document.getElementById('cvb-radius-number');
  const applyRadius = v => {
    v = Math.min(60, Math.max(0, v));
    block.dataset.radius = v;
    window.renderCanvas(block);
    rSlider.value = v; rNumber.value = v;
  };
  rSlider.addEventListener('input',  () => applyRadius(parseInt(rSlider.value)));
  rNumber.addEventListener('change', () => { applyRadius(parseInt(rNumber.value)); window.pushHistory?.(); });
  rSlider.addEventListener('change', () => window.pushHistory?.());

  // ── 아이콘 컨트롤 (이스터에그, iconMode일 때만 존재) ──────────────────────────
  const iconSizeSlider = document.getElementById('cvb-icon-size-slider');
  if (iconSizeSlider) {
    const iconSizeNumber = document.getElementById('cvb-icon-size-number');
    const applyIconSize = v => {
      v = Math.min(90, Math.max(10, v));
      block.dataset.iconScale = v;
      window.renderCanvas(block);
      iconSizeSlider.value = v; iconSizeNumber.value = v;
    };
    iconSizeSlider.addEventListener('input',  () => applyIconSize(parseInt(iconSizeSlider.value)));
    iconSizeNumber.addEventListener('change', () => { applyIconSize(parseInt(iconSizeNumber.value)); window.pushHistory?.(); });
    iconSizeSlider.addEventListener('change', () => window.pushHistory?.());

    const icPick = document.getElementById('cvb-icon-color-pick');
    const icHex  = document.getElementById('cvb-icon-color-hex');
    const icSwatch = icPick.closest('.prop-color-swatch');
    const applyIconColor = v => {
      block.dataset.iconColor = v;
      window.renderCanvas(block);
      icPick.value = v; icHex.value = v;
      if (icSwatch) icSwatch.style.background = v;
    };
    icPick.addEventListener('input',  () => applyIconColor(icPick.value));
    icPick.addEventListener('change', () => window.pushHistory?.());
    icHex.addEventListener('change',  () => { const v = icHex.value.trim(); if (/^#[0-9a-fA-F]{6}$/.test(v)) { applyIconColor(v); window.pushHistory?.(); } });

    const ibPick = document.getElementById('cvb-iconbg-pick');
    const ibHex  = document.getElementById('cvb-iconbg-hex');
    const ibSwatch = ibPick.closest('.prop-color-swatch');
    const ibTransBtn = document.getElementById('cvb-iconbg-transparent-btn');
    const applyIconBg = v => {
      block.dataset.iconBgLast = v;
      block.dataset.iconBg = v;
      window.renderCanvas(block);
      ibPick.value = v; ibHex.value = v;
      if (ibSwatch) { ibSwatch.style.backgroundImage = ''; ibSwatch.style.background = v; }
    };
    ibTransBtn.addEventListener('click', () => {
      const on = !ibTransBtn.classList.contains('active');
      if (on) { block.dataset.iconBgLast = (block.dataset.iconBg && block.dataset.iconBg !== 'transparent') ? block.dataset.iconBg : (block.dataset.iconBgLast || '#eeeeee'); block.dataset.iconBg = 'transparent'; }
      else { block.dataset.iconBg = block.dataset.iconBgLast || '#eeeeee'; }
      window.renderCanvas(block);
      window.pushHistory?.();
      ibTransBtn.classList.toggle('active', on);
      ibPick.disabled = on; ibHex.disabled = on;
      if (on) { ibHex.value = 'transparent'; ibSwatch.style.background = ''; ibSwatch.style.backgroundImage = 'repeating-conic-gradient(#888 0% 25%,#555 0% 50%)'; ibSwatch.style.backgroundSize = '8px 8px'; }
      else { const v = block.dataset.iconBgLast || '#eeeeee'; ibHex.value = v; ibPick.value = v; ibSwatch.style.backgroundImage = ''; ibSwatch.style.background = v; }
    });
    ibPick.addEventListener('input',  () => applyIconBg(ibPick.value));
    ibPick.addEventListener('change', () => window.pushHistory?.());
    ibHex.addEventListener('change',  () => { const v = ibHex.value.trim(); if (/^#[0-9a-fA-F]{6}$/.test(v)) { applyIconBg(v); window.pushHistory?.(); } });
  }

  // ── 텍스트 영역 숨김 토글 (구 버튼 — label-mode-group의 'hide'로 이관됨. legacy 호환 유지) ──
  const textHideBtn     = document.getElementById('cvb-text-hide-btn');
  const textAreaControls = document.getElementById('cvb-text-area-controls');
  textHideBtn?.addEventListener('click', () => {
    const on = !textHideBtn.classList.contains('active');
    block.dataset.textHide = String(on);
    window.renderCanvas(block);
    window.pushHistory?.();
    textHideBtn.classList.toggle('active', on);
    if (textAreaControls) {
      textAreaControls.style.opacity = on ? '0.35' : '';
      textAreaControls.style.pointerEvents = on ? 'none' : '';
    }
  });

  // ── 텍스트 배경색 (일괄) ─────────────────────────────────────────────────────
  const textBgPick  = document.getElementById('cvb-textbg-pick');
  const textBgHex   = document.getElementById('cvb-textbg-hex');
  const textBgPickSwatch = textBgPick?.closest('.prop-color-swatch');
  const textBgTransBtn = document.getElementById('cvb-textbg-transparent-btn');

  const setTextBgTransparentUI = on => {
    textBgTransBtn.classList.toggle('active', on);
    textBgPick.disabled = on;
    textBgHex.disabled  = on;
    if (on) {
      textBgHex.value = 'transparent';
      textBgPickSwatch.style.background = '';
      textBgPickSwatch.style.backgroundImage = 'repeating-conic-gradient(#888 0% 25%,#555 0% 50%)';
      textBgPickSwatch.style.backgroundSize = '8px 8px';
    } else {
      const v = block.dataset.textBgLast || '#f5f5f5';
      textBgHex.value = v;
      textBgPick.value = v;
      textBgPickSwatch.style.backgroundImage = '';
      textBgPickSwatch.style.background = v;
    }
  };

  const applyTextBg = v => {
    block.dataset.textBgLast = v;
    block.dataset.textBg = v;
    window.renderCanvas(block);
    textBgPick.value = v;
    textBgHex.value  = v;
    if (textBgPickSwatch) textBgPickSwatch.style.background = v;
    syncTextBgUI();
  };

  textBgTransBtn.addEventListener('click', () => {
    const on = !textBgTransBtn.classList.contains('active');
    if (on) {
      block.dataset.textBgLast = block.dataset.textBg || '#f5f5f5';
      block.dataset.textBg = 'transparent';
      // 투명 활성화 — 카드 배경이 사라지므로 밝은 텍스트는 안 보임. 밝은 색이면 자동으로 어둡게 전환
      // (FIX-6) dataset 미존재 시 패널 렌더와 동일하게 effective 기본값 '#ffffff' 적용
      //          → 신규 카드(기본 흰 글자)도 투명 전환 시 어두운색으로 바뀜.
      const _effTitle = block.dataset.titleColor || '#ffffff';
      const _effDesc  = block.dataset.descColor  || '#ffffff';
      if (_cvbIsLightColor(_effTitle)) {
        block.dataset.titleColorLast = _effTitle;
        block.dataset.titleColor = '#222222';
      }
      if (_cvbIsLightColor(_effDesc)) {
        block.dataset.descColorLast = _effDesc;
        block.dataset.descColor = '#222222';
      }
    } else {
      block.dataset.textBg = block.dataset.textBgLast || '#f5f5f5';
      // 투명 해제 — 자동 전환했던 텍스트 색을 원래 흰색으로 복원
      if (block.dataset.titleColorLast) { block.dataset.titleColor = block.dataset.titleColorLast; delete block.dataset.titleColorLast; }
      if (block.dataset.descColorLast)  { block.dataset.descColor  = block.dataset.descColorLast;  delete block.dataset.descColorLast; }
    }
    window.renderCanvas(block);
    window.pushHistory?.();
    setTextBgTransparentUI(on);
    // prop UI 갱신 (색상 picker swatch 동기화)
    if (block.classList.contains('selected')) window.showSimpleCardProperties?.(block);
  });

  textBgPick.addEventListener('input',  () => applyTextBg(textBgPick.value));
  textBgPick.addEventListener('change', () => window.pushHistory?.());
  textBgHex.addEventListener('change',  () => {
    const v = textBgHex.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) { applyTextBg(v); window.pushHistory?.(); }
  });

  // ── 제목/설명 텍스트 색상 ─────────────────────────────────────────────────────
  const bindTextColor = (pickId, hexId, datasetKey) => {
    const pick  = document.getElementById(pickId);
    const hex   = document.getElementById(hexId);
    const swatch = pick.closest('.prop-color-swatch');
    const apply = v => {
      block.dataset[datasetKey] = v;
      // 사용자가 텍스트 색을 수동 변경하면 투명-토글-자동백업 무효화 — OFF 시 사용자 선택을 덮어쓰지 않게
      if (datasetKey === 'titleColor') delete block.dataset.titleColorLast;
      if (datasetKey === 'descColor')  delete block.dataset.descColorLast;
      window.renderCanvas(block);
      pick.value = v;
      hex.value  = v;
      if (swatch) swatch.style.background = v;
    };
    pick.addEventListener('input',  () => apply(pick.value));
    pick.addEventListener('change', () => window.pushHistory?.());
    hex.addEventListener('change',  () => {
      const v = hex.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) { apply(v); window.pushHistory?.(); }
    });
  };
  bindTextColor('cvb-title-color-pick', 'cvb-title-color-hex', 'titleColor');
  bindTextColor('cvb-desc-color-pick',  'cvb-desc-color-hex',  'descColor');

  // ── 제목 크기 ────────────────────────────────────────────────────────────────
  const titleSlider = document.getElementById('cvb-title-slider');
  const titleNumber = document.getElementById('cvb-title-number');
  const applyTitleSize = v => {
    v = Math.min(80, Math.max(12, v));
    block.dataset.titleSize = v;
    window.renderCanvas(block);
    titleSlider.value = v; titleNumber.value = v;
  };
  titleSlider.addEventListener('input',  () => applyTitleSize(parseInt(titleSlider.value)));
  titleNumber.addEventListener('change', () => { applyTitleSize(parseInt(titleNumber.value)); window.pushHistory?.(); });
  titleSlider.addEventListener('change', () => window.pushHistory?.());

  // ── 설명 크기 ────────────────────────────────────────────────────────────────
  const descSlider = document.getElementById('cvb-desc-slider');
  const descNumber = document.getElementById('cvb-desc-number');
  const applyDescSize = v => {
    v = Math.min(40, Math.max(10, v));
    block.dataset.descSize = v;
    window.renderCanvas(block);
    descSlider.value = v; descNumber.value = v;
  };
  descSlider.addEventListener('input',  () => applyDescSize(parseInt(descSlider.value)));
  descNumber.addEventListener('change', () => { applyDescSize(parseInt(descNumber.value)); window.pushHistory?.(); });
  descSlider.addEventListener('change', () => window.pushHistory?.());

  // ── 텍스트 정렬 ──────────────────────────────────────────────────────────────
  propPanel.querySelectorAll('#cvb-align-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.dataset.align;
      block.dataset.textAlign = a;
      window.renderCanvas(block);
      window.pushHistory?.();
      propPanel.querySelectorAll('#cvb-align-group .prop-align-btn').forEach(b => b.classList.toggle('active', b.dataset.align === a));
    });
  });

  // ── Gap / PadX ───────────────────────────────────────────────────────────────
  const gapSlider = document.getElementById('cvb-gap-slider');
  const gapNumber = document.getElementById('cvb-gap-number');
  const applyGap = v => {
    v = Math.min(48, Math.max(0, v));
    block.dataset.cardGap = v;
    window.renderCanvas(block);
    gapSlider.value = v; gapNumber.value = v;
  };
  gapSlider.addEventListener('input',  () => applyGap(parseInt(gapSlider.value)));
  gapNumber.addEventListener('change', () => { applyGap(parseInt(gapNumber.value)); window.pushHistory?.(); window.scheduleAutoSave?.(); });
  gapSlider.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });

  const padxSlider = document.getElementById('cvb-padx-slider');
  const padxNumber = document.getElementById('cvb-padx-number');
  const applyPadX = v => {
    v = Math.min(80, Math.max(0, v));
    block.dataset.padX = v;
    window.renderCanvas(block);
    padxSlider.value = v; padxNumber.value = v;
  };
  padxSlider.addEventListener('input',  () => applyPadX(parseInt(padxSlider.value)));
  padxNumber.addEventListener('change', () => { applyPadX(parseInt(padxNumber.value)); window.pushHistory?.(); window.scheduleAutoSave?.(); });
  padxSlider.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });

  // full-bleed: 섹션 좌우패딩 무시 토글. 에셋 패턴과 달리 카드는 renderCanvas가 width를 통합 처리.
  const fullBleedToggle = document.getElementById('cvb-fullbleed-toggle');
  if (fullBleedToggle) {
    fullBleedToggle.addEventListener('change', e => {
      if (e.target.checked) block.dataset.fullBleed = 'true';
      else delete block.dataset.fullBleed;
      window.renderCanvas?.(block);
      window.pushHistory?.();
      window.scheduleAutoSave?.();
    });
  }

  // ── 카드별 항목 편집 ─────────────────────────────────────────────────────────
  const cardItemsEl = document.getElementById('cvb-card-items');

  // 텍스트 입력 (실시간, 히스토리 없음)
  cardItemsEl.addEventListener('input', e => {
    const titleInput = e.target.closest('.cvb-card-title-input');
    const descInput  = e.target.closest('.cvb-card-desc-input');
    const bgPick     = e.target.closest('.cvb-card-cell-bg');

    if (titleInput) {
      const idx = parseInt(titleInput.dataset.cardIndex);
      const arr = getCards();
      if (arr[idx] !== undefined) { arr[idx].title = titleInput.value; setCards(arr, true); }
    }
    if (descInput) {
      const idx = parseInt(descInput.dataset.cardIndex);
      const arr = getCards();
      if (arr[idx] !== undefined) { arr[idx].desc = descInput.value; setCards(arr, true); }
    }
    if (bgPick) {
      const idx = parseInt(bgPick.dataset.cardIndex);
      const arr = getCards();
      if (arr[idx] !== undefined) {
        arr[idx].cellBg = bgPick.value;
        const swatch = bgPick.closest('.cvb-card-bg-swatch');
        if (swatch) swatch.style.background = bgPick.value;
        setCards(arr, true);
      }
    }

    const borderColor = e.target.closest('.cvb-card-border-color');
    if (borderColor) {
      const idx = parseInt(borderColor.dataset.cardIndex);
      const arr = getCards();
      if (arr[idx] !== undefined) {
        arr[idx].borderColor = borderColor.value;
        const swatch = borderColor.closest('.cvb-card-border-swatch');
        if (swatch) swatch.style.background = borderColor.value;
        setCards(arr, true);
      }
    }

    const borderWidth = e.target.closest('.cvb-card-border-width');
    if (borderWidth) {
      const idx = parseInt(borderWidth.dataset.cardIndex);
      const arr = getCards();
      if (arr[idx] !== undefined) {
        arr[idx].borderWidth = parseInt(borderWidth.value) || 0;
        setCards(arr, true);
      }
    }

    // 이미지 확대(zoom) 슬라이더 — 실시간(히스토리 없음). number 동기화.
    const zoomSlider = e.target.closest('.cvb-card-zoom');
    if (zoomSlider) {
      const idx = parseInt(zoomSlider.dataset.cardIndex);
      const arr = getCards();
      if (arr[idx] !== undefined) {
        const v = Math.min(400, Math.max(100, parseInt(zoomSlider.value) || 100));
        arr[idx].imgScale = v;
        const num = cardItemsEl.querySelector(`.cvb-card-zoom-num[data-card-index="${idx}"]`);
        if (num) num.value = v;
        setCards(arr, true);
      }
    }

    // 라벨 상/하 분리 슬롯 텍스트(both 모드) — 실시간(히스토리 없음)
    const slotInput = e.target.closest('.cvb-slot-input');
    if (slotInput) {
      const idx = parseInt(slotInput.dataset.cardIndex);
      const field = slotInput.dataset.slotField;
      const arr = getCards();
      if (arr[idx] !== undefined && field) { arr[idx][field] = slotInput.value; setCards(arr, true); }
    }

    // 라벨 상/하 분리 슬롯 색 override(both 모드) — 실시간
    const slotColor = e.target.closest('.cvb-slot-color');
    if (slotColor) {
      const idx = parseInt(slotColor.dataset.cardIndex);
      const field = slotColor.dataset.slotField;
      const arr = getCards();
      if (arr[idx] !== undefined && field) {
        arr[idx][field] = slotColor.value;
        const swatch = slotColor.closest('.prop-color-swatch');
        if (swatch) swatch.style.background = slotColor.value;
        setCards(arr, true);
      }
    }
  });

  // change → pushHistory
  cardItemsEl.addEventListener('change', e => {
    // 확대 number 입력은 슬라이더와 별도 경로(input 안 탐) — 여기서 값 반영 + 히스토리
    const zoomNum = e.target.closest('.cvb-card-zoom-num');
    if (zoomNum) {
      const idx = parseInt(zoomNum.dataset.cardIndex);
      const arr = getCards();
      if (arr[idx] !== undefined) {
        const v = Math.min(400, Math.max(100, parseInt(zoomNum.value) || 100));
        arr[idx].imgScale = v;
        zoomNum.value = v;
        const sl = cardItemsEl.querySelector(`.cvb-card-zoom[data-card-index="${idx}"]`);
        if (sl) sl.value = v;
        setCards(arr, true);
      }
      window.pushHistory?.();
      return;
    }
    if (e.target.closest('.cvb-card-title-input, .cvb-card-desc-input, .cvb-card-cell-bg, .cvb-card-border-color, .cvb-card-border-width, .cvb-card-zoom, .cvb-slot-input, .cvb-slot-color')) {
      window.pushHistory?.();
    }
  });

  // 이미지 업로드 / 제거 버튼
  cardItemsEl.addEventListener('click', e => {
    const imgBtn   = e.target.closest('.cvb-card-img-btn');
    const clearBtn = e.target.closest('.cvb-card-img-clear');
    const iconBtn   = e.target.closest('.cvb-card-icon-btn');
    const iconClear = e.target.closest('.cvb-card-icon-clear');

    // 이스터에그(아이콘 모드): 카드 이미지 자리에 iconify 아이콘 지정
    if (iconBtn) {
      const idx = parseInt(iconBtn.dataset.cardIndex);
      window.openIconifyModal?.((picked) => {
        const arr = getCards();
        if (arr[idx] !== undefined) {
          arr[idx].icon = { name: picked.name, svg: picked.svg };
          setCards(arr);
          showSimpleCardProperties(block);
        }
      });
      return;
    }
    if (iconClear) {
      const idx = parseInt(iconClear.dataset.cardIndex);
      const arr = getCards();
      if (arr[idx] !== undefined) {
        delete arr[idx].icon;
        setCards(arr);
        showSimpleCardProperties(block);
      }
      return;
    }

    if (imgBtn) {
      const idx = parseInt(imgBtn.dataset.cardIndex);
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          const arr = getCards();
          if (arr[idx] !== undefined) {
            arr[idx].imgSrc = ev.target.result;
            setCards(arr);
            showSimpleCardProperties(block);
          }
        };
        reader.readAsDataURL(file);
      };
      input.click();
    }

    if (clearBtn) {
      const idx = parseInt(clearBtn.dataset.cardIndex);
      const arr = getCards();
      if (arr[idx] !== undefined) {
        arr[idx].imgSrc = '';
        setCards(arr);
        showSimpleCardProperties(block);
      }
    }

    const fitBtn = e.target.closest('.cvb-card-fit-btn');
    if (fitBtn) {
      const idx = parseInt(fitBtn.dataset.cardIndex);
      const fit = fitBtn.dataset.fit;
      const arr = getCards();
      if (arr[idx] !== undefined) {
        arr[idx].imgFit = fit;
        setCards(arr);
        window.renderCanvas(block);
        window.pushHistory?.();
        // 버튼 active 상태 즉시 갱신
        cardItemsEl.querySelectorAll(`.cvb-card-fit-btn[data-card-index="${idx}"]`).forEach(b => {
          b.classList.toggle('active', b.dataset.fit === fit);
        });
      }
    }
  });
}

// HTML 특수문자 이스케이프 (textarea/input value 안전 삽입)
function _escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 색이 '밝은가' 판정 — 6자리 #hex만 파싱(상대휘도 sRGB), 임계 0.6 초과면 true.
// rgba()/linear-gradient()/var()/transparent 등은 파싱 실패로 false → 자동전환 안 함(안전).
function _cvbIsLightColor(hex) {
  if (!hex) return false;
  const v = String(hex).trim().toLowerCase();
  if (v === '#fff' || v === '#ffffff') return true;
  const m = /^#([0-9a-f]{6})$/.exec(v);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  const lin = c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.6;
}

window.showSimpleCardProperties = showSimpleCardProperties;
