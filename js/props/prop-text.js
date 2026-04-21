import { propPanel, state } from '../globals.js';

let _systemFontsList = [];

export function showTextProperties(tb) {
  const isOverlayTb = tb.classList.contains('overlay-tb');
  // contenteditable 속성이 없는 경우(저장 후 복원 시 속성 누락) fallback으로 내부 첫 자식 div를 사용
  let contentEl = tb.querySelector('[contenteditable]');
  if (!contentEl) {
    contentEl = tb.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label');
    if (contentEl) contentEl.setAttribute('contenteditable', 'false');
  }
  if (!contentEl) {
    console.warn('[prop-text] showTextProperties: contentEl not found in', tb.id);
    return;
  }
  const computed   = window.getComputedStyle(contentEl);

  const isSpeechBubble = tb.classList.contains('speech-bubble-block');
  const isIconText     = tb.classList.contains('icon-text-block');
  const currentClass = ['tb-h1','tb-h2','tb-h3','tb-body','tb-caption','tb-label'].find(c => contentEl.classList.contains(c)) || (isSpeechBubble ? 'tb-bubble' : 'tb-body');
  const rawBg = window.getComputedStyle(contentEl).backgroundColor;
  const currentBgColor = (!rawBg || rawBg === 'rgba(0, 0, 0, 0)' || rawBg === 'transparent') ? '#111111' : (rgbToHex(rawBg) || '#111111');
  const currentRadius = parseInt(contentEl.style.borderRadius) || 4;
  const isLabel = currentClass === 'tb-label';
  const currentTail = tb.dataset.tail || 'left';
  const currentBubbleStyle = tb.dataset.bubbleStyle || 'imessage';
  const _blockBubbleVar = isSpeechBubble ? tb.style.getPropertyValue('--bubble-bg').trim() : '';
  const bubbleBg = isSpeechBubble ? (_blockBubbleVar || contentEl.style.backgroundColor || '#e5e5ea') : '#e5e5ea';
  const bubbleBgHex = isSpeechBubble ? (_blockBubbleVar || rgbToHex(window.getComputedStyle(contentEl).backgroundColor) || '#e5e5ea') : '#e5e5ea';
  const showSender = isSpeechBubble && tb.dataset.showSender === 'true';
  const senderName = isSpeechBubble ? (tb.dataset.senderName || 'Your name') : 'Your name';
  const labelPillPadT = parseInt(contentEl.style.paddingTop)    || 4;
  const labelPillPadB = parseInt(contentEl.style.paddingBottom) || 4;
  const labelPillH    = labelPillPadT + labelPillPadB;
  const _jcToAlign   = { 'flex-start': 'left', 'center': 'center', 'flex-end': 'right' };
  const currentAlign = isLabel
    ? (tb.style.textAlign || 'left')
    : isIconText
      ? (_jcToAlign[tb.style.justifyContent] || 'left')
      : (contentEl.style.textAlign || 'left');
  const currentItbGap = isIconText ? (parseInt(tb.style.gap) || 16) : 16;
  // 자식 span/div에 inline font-size가 있으면 그 값을 우선 사용 (복사 블록 대응)
  const _firstSizedChild = contentEl.querySelector('[style*="font-size"]');
  const currentSize  = _firstSizedChild
    ? (parseInt(window.getComputedStyle(_firstSizedChild).fontSize) || parseInt(computed.fontSize) || 15)
    : (parseInt(computed.fontSize) || 15);
  const currentColor = rgbToHex(computed.color) || '#111111';
  const currentLH    = (parseFloat(computed.lineHeight) / parseFloat(computed.fontSize) || 1.5).toFixed(2);
  const currentLS    = isNaN(parseFloat(contentEl.style.letterSpacing))
    ? (parseFloat(computed.letterSpacing) || 0)
    : parseFloat(contentEl.style.letterSpacing);
  const currentPadT  = parseInt(tb.style.paddingTop)    || 0;
  const currentPadB  = parseInt(tb.style.paddingBottom) || 0;
  const currentPadL  = parseInt(tb.style.paddingLeft)  || 0;
  const currentPadR  = parseInt(tb.style.paddingRight) || 0;
  let   phLinked     = currentPadL === currentPadR;
  // rawFont: CSS가 fontFamily를 정규화(따옴표 변환 등)하므로 raw option값을 별도 저장해서 우선 사용
  const currentFont   = contentEl.dataset.rawFont || contentEl.style.fontFamily || '';
  const rawWeight     = contentEl.style.fontWeight || '';
  const currentWeight = rawWeight === 'bold' ? '700' : rawWeight === 'normal' ? '400' : rawWeight;
  const isBold        = currentWeight === '700' || rawWeight === 'bold';
  const isItalic      = contentEl.style.fontStyle  === 'italic';
  const currentHighlight      = tb.dataset.highlight || 'none';
  const currentHighlightColor = tb.dataset.highlightColor || '#ffeb3b';

  // 위치/크기 — text-frame(래퍼)이 position/size를 보유
  const _tf         = tb.closest('.frame-block[data-text-frame="true"]');
  const _posEl      = _tf || tb;  // freeLayout 안: text-frame, 그 외: tb
  const isAbsolute  = _posEl.style.position === 'absolute';
  const currentX    = parseInt(_posEl.style.left  || _posEl.dataset.offsetX || '0');
  const currentY    = parseInt(_posEl.style.top   || _posEl.dataset.offsetY || '0');
  const _tbRow      = tb.closest('.row');
  const currentW    = parseInt(_tf?.dataset.width || _tbRow?.dataset.width) || Math.round(_tf?.offsetWidth || _tbRow?.offsetWidth || tb.offsetWidth);

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <line x1="1" y1="3" x2="11" y2="3"/><line x1="1" y1="6" x2="11" y2="6"/><line x1="1" y1="9" x2="7" y2="9"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${tb.dataset.layerName || (isOverlayTb ? 'Overlay Text' : 'Text Block')}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb(tb)}</span>
        </div>
        ${tb.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${tb.id}')">${tb.id}</span>` : ''}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Type</div>
      <div class="prop-type-group">
        <button class="prop-type-btn ${currentClass==='tb-h1'?'active':''}"      data-cls="tb-h1">H1</button>
        <button class="prop-type-btn ${currentClass==='tb-h2'?'active':''}"      data-cls="tb-h2">H2</button>
        <button class="prop-type-btn ${currentClass==='tb-h3'?'active':''}"      data-cls="tb-h3">H3</button>
        <button class="prop-type-btn ${currentClass==='tb-body'?'active':''}"    data-cls="tb-body">Body</button>
        <button class="prop-type-btn ${currentClass==='tb-caption'?'active':''}" data-cls="tb-caption">Cap</button>
        <button class="prop-type-btn ${currentClass==='tb-label'?'active':''}"   data-cls="tb-label">Tag</button>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Position</div>
      <span class="prop-field-label">Alignment</span>
      <div class="prop-align-group" style="margin-bottom:6px">
          <button class="prop-align-btn ${currentAlign==='left'||currentAlign===''?'active':''}" data-align="left">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
              <line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/>
              <line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/>
            </svg>
          </button>
          <button class="prop-align-btn ${currentAlign==='center'?'active':''}" data-align="center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
              <line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="6" x2="11" y2="6"/>
              <line x1="2" y1="9" x2="12" y2="9"/><line x1="4" y1="12" x2="10" y2="12"/>
            </svg>
          </button>
          <button class="prop-align-btn ${currentAlign==='right'?'active':''}" data-align="right">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
              <line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/>
              <line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/>
            </svg>
          </button>
      </div>
      <span class="prop-field-label">Position</span>
      <div class="prop-lhls-row">
        <div class="prop-lhls-col">
          <div class="prop-icon-input">
            <span class="prop-xy-label">X</span>
            <input type="number" id="txt-x-number" value="${currentX}" aria-label="X position">
          </div>
        </div>
        <div class="prop-lhls-col">
          <div class="prop-icon-input">
            <span class="prop-xy-label">Y</span>
            <input type="number" id="txt-y-number" value="${currentY}" aria-label="Y position">
          </div>
        </div>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Typography</div>

      <span class="prop-field-label">Font</span>
      <div class="font-picker" id="txt-font-picker">
        <button class="font-picker-trigger" id="txt-font-trigger" type="button">
          <span class="font-picker-current" id="txt-font-name">${currentFont ? _fontDisplayName(currentFont) : '기본 (시스템)'}</span>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style="flex-shrink:0"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>
        </button>
        <div class="font-picker-dropdown" id="txt-font-dropdown" style="display:none">
          <input class="font-picker-search" id="txt-font-search" type="text" placeholder="폰트 검색..." autocomplete="off" spellcheck="false">
          <div class="font-picker-list" id="txt-font-list"></div>
        </div>
      </div>

      <div class="prop-row">
        <select class="prop-select" id="txt-font-weight" style="flex:1">
          <option value="100" ${currentWeight==='100'?'selected':''}>Thin 100</option>
          <option value="200" ${currentWeight==='200'?'selected':''}>ExtraLight 200</option>
          <option value="300" ${currentWeight==='300'?'selected':''}>Light 300</option>
          <option value="400" ${(!currentWeight||currentWeight==='400')?'selected':''}>Regular 400</option>
          <option value="500" ${currentWeight==='500'?'selected':''}>Medium 500</option>
          <option value="600" ${currentWeight==='600'?'selected':''}>SemiBold 600</option>
          <option value="700" ${currentWeight==='700'?'selected':''}>Bold 700</option>
          <option value="800" ${currentWeight==='800'?'selected':''}>ExtraBold 800</option>
          <option value="900" ${currentWeight==='900'?'selected':''}>Black 900</option>
        </select>
        <input type="number" class="prop-number prop-number-select" id="txt-size-number" min="8" max="400" value="${currentSize}" style="flex:1;min-width:0">
      </div>

      <div class="prop-lhls-row">
        <div class="prop-lhls-col">
          <span class="prop-field-label">Line Height</span>
          <div class="prop-icon-input">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path fill="currentColor" d="M17.5 17a.5.5 0 0 1 0 1h-11a.5.5 0 0 1 0-1zm-5.25-9a.5.5 0 0 1 .476.347l2.25 7a.5.5 0 0 1-.952.306L13.494 14h-2.987l-.531 1.653a.5.5 0 0 1-.952-.306l2.25-7 .03-.075A.5.5 0 0 1 11.75 8zm-1.422 5h2.344L12 9.354zM17.5 6a.5.5 0 0 1 0 1h-11a.5.5 0 0 1 0-1z"/></svg>
            <input type="number" id="txt-lh-number" min="1" max="3" step="0.05" value="${currentLH}" aria-label="줄간격">
          </div>
        </div>
        <div class="prop-lhls-col">
          <span class="prop-field-label">Letter Spacing</span>
          <div class="prop-icon-input">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path fill="currentColor" d="M6.5 6a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-1 0v-11a.5.5 0 0 1 .5-.5m11 0a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-1 0v-11a.5.5 0 0 1 .5-.5m-5.25 3a.5.5 0 0 1 .472.335l1.75 5a.5.5 0 1 1-.944.33l-.407-1.165H10.88l-.407 1.165a.5.5 0 1 1-.944-.33l1.75-5 .032-.072A.5.5 0 0 1 11.75 9zm-1.02 3.5h1.54L12 10.298z"/></svg>
            <input type="number" id="txt-ls-number" min="-10" max="40" step="0.5" value="${currentLS}" aria-label="자간">
          </div>
        </div>
      </div>

    </div>

    <div class="prop-section">
      <div class="prop-section-title">Fill</div>
      <div class="prop-color-row">
        <span class="prop-label">글자색</span>
        <div class="prop-color-swatch" style="background:${currentColor}">
          <input type="color" id="txt-color" value="${currentColor}">
        </div>
        <input type="text" class="prop-color-hex" id="txt-color-hex" value="${currentColor}" maxlength="7">
      </div>
    </div>

    <div class="prop-section" style="${isOverlayTb ? 'display:none' : ''}">
      <div class="prop-section-title">Size</div>
      <div class="prop-row">
        <span class="prop-label">너비</span>
        <input type="range" class="prop-slider" id="txt-width-slider" min="80" max="860" step="4" value="${currentW}">
        <input type="number" class="prop-number" id="txt-width-number" min="80" max="860" value="${currentW}">
      </div>
    </div>

    <div class="prop-section" style="${isOverlayTb ? 'display:none' : ''}">
      <div class="prop-section-title">Padding</div>
      <div class="prop-row">
        <span class="prop-label">상하</span>
        <input type="range" class="prop-slider" id="txt-pv-slider" min="0" max="120" step="4" value="${currentPadT}">
        <input type="number" class="prop-number" id="txt-pv-number" min="0" max="120" value="${currentPadT}">
      </div>
      <div class="prop-ph-header">
        <span class="prop-section-title" style="margin-bottom:0">L/R</span>
        <button class="prop-chain-btn${phLinked ? ' active' : ''}" id="txt-ph-chain" title="좌우 연동">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3">
            <rect x="0.5" y="3.5" width="4" height="5" rx="2"/>
            <rect x="7.5" y="3.5" width="4" height="5" rx="2"/>
            <line x1="4.5" y1="6" x2="7.5" y2="6" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="prop-row">
        <span class="prop-label" style="width:60px">왼쪽 패딩</span>
        <input type="range" class="prop-slider" id="txt-pl-slider" min="0" max="120" step="4" value="${currentPadL}">
        <input type="number" class="prop-number" id="txt-pl-number" min="0" max="120" value="${currentPadL}">
      </div>
      <div class="prop-row">
        <span class="prop-label" style="width:60px">오른쪽 패딩</span>
        <input type="range" class="prop-slider" id="txt-pr-slider" min="0" max="120" step="4" value="${currentPadR}">
        <input type="number" class="prop-number" id="txt-pr-number" min="0" max="120" value="${currentPadR}">
      </div>
    </div>

    <div id="label-style-section" style="display:${isLabel?'block':'none'}">
      <div class="prop-section">
        <div class="prop-section-title">Tag Style</div>
        <div class="prop-row" style="gap:6px">
          <button class="prop-btn-full" id="label-shape-pill">Pill</button>
          <button class="prop-btn-full" id="label-shape-box">Box</button>
          <button class="prop-btn-full" id="label-shape-circle">Circle</button>
          <button class="prop-btn-full" id="label-shape-text">Text</button>
        </div>
        <div class="prop-color-row">
          <span class="prop-label">배경색</span>
          <div class="prop-color-swatch${currentBgColor==='transparent'?' swatch-none':''}" style="background:${currentBgColor==='transparent'?'transparent':currentBgColor}">
            <input type="color" id="label-bg-color" value="${currentBgColor==='transparent'?'#111111':currentBgColor}">
          </div>
          <input type="text" class="prop-color-hex" id="label-bg-hex" value="${currentBgColor==='transparent'?'':currentBgColor}" maxlength="7" placeholder="없음">
          <label class="prop-none-check"><input type="checkbox" id="label-bg-none" ${currentBgColor==='transparent'?'checked':''}>없음</label>
        </div>
        <div class="prop-row">
          <span class="prop-label">모서리</span>
          <input type="range" class="prop-slider" id="label-radius-slider" min="0" max="40" step="1" value="${currentRadius}">
          <input type="number" class="prop-number" id="label-radius-number" min="0" max="40" value="${currentRadius}">
        </div>
        <div class="prop-row">
          <span class="prop-label">높이</span>
          <input type="range" class="prop-slider" id="label-pill-height-slider" min="0" max="120" step="2" value="${labelPillH}">
          <input type="number" class="prop-number" id="label-pill-height-number" min="0" max="120" value="${labelPillH}">
        </div>
      </div>
    </div>

    <div id="bubble-style-section" style="display:${isSpeechBubble?'block':'none'}">
      <div class="prop-section">
        <div class="prop-section-title">Bubble Style</div>
        <div class="prop-row">
          <span class="prop-label">스타일</span>
          <select class="prop-select" id="bubble-style-select">
            <option value="default" ${currentBubbleStyle==='default'||!currentBubbleStyle?'selected':''}>기본</option>
            <option value="imessage" ${currentBubbleStyle==='imessage'?'selected':''}>iMessage</option>
            <option value="apple" ${currentBubbleStyle==='apple'?'selected':''}>Apple</option>
          </select>
        </div>
        <div class="prop-row">
          <span class="prop-label">말꼬리</span>
          <div class="prop-align-group">
            <button class="prop-align-btn ${currentTail==='left'?'active':''}" id="bubble-tail-left" title="왼쪽 말꼬리">←</button>
            <button class="prop-align-btn ${currentTail==='center'?'active':''}" id="bubble-tail-center" title="말꼬리 없음 / 중앙">—</button>
            <button class="prop-align-btn ${currentTail==='right'?'active':''}" id="bubble-tail-right" title="오른쪽 말꼬리">→</button>
          </div>
        </div>
        <div class="prop-color-row">
          <span class="prop-label">배경색</span>
          <div class="prop-color-swatch" style="background:${bubbleBgHex}">
            <input type="color" id="bubble-bg-color" value="${bubbleBgHex}">
          </div>
          <input type="text" class="prop-color-hex" id="bubble-bg-hex" value="${bubbleBgHex}" maxlength="7">
        </div>
        <div class="prop-row">
          <span class="prop-label">발신자 이름</span>
          <label class="prop-toggle" title="발신자 이름 표시">
            <input type="checkbox" id="bubble-show-sender" ${showSender ? 'checked' : ''}>
            <span class="prop-toggle-track"></span>
          </label>
        </div>
        <div class="prop-row" id="bubble-sender-name-row" style="display:${showSender?'flex':'none'}">
          <input type="text" class="prop-color-hex" id="bubble-sender-name-input" value="${senderName.replace(/"/g,'&quot;')}" placeholder="Your name" style="flex:1;max-width:none">
        </div>
      </div>
    </div>

    <div id="icon-text-style-section" style="display:${isIconText?'block':'none'}">
      <div class="prop-section">
        <div class="prop-section-title">Icon Text</div>
        <div class="prop-row">
          <span class="prop-label">아이콘-텍스트 간격</span>
          <input type="range" class="prop-slider" id="itb-gap-slider" min="0" max="80" step="4" value="${currentItbGap}">
          <input type="number" class="prop-number" id="itb-gap-number" min="0" max="80" value="${currentItbGap}">
        </div>
      </div>
    </div>

    <div class="prop-section prop-section--anim" style="${isOverlayTb ? 'display:none' : ''}">
      <button class="prop-anim-btn" id="open-anim-btn">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="1" y="3" width="12" height="8" rx="1.5"/>
          <path d="M5 6l3 1.5L5 9V6z" fill="currentColor" stroke="none"/>
        </svg>
        애니메이션 GIF 만들기
      </button>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(tb.id || null);

  /* ── 말풍선 블록 전용 이벤트 ── */
  if (isSpeechBubble) {
    // 말꼬리 방향
    const _applyBubbleBg = (hex) => {
      contentEl.style.backgroundColor = hex;
      // --bubble-bg 변수를 .speech-bubble-block(tb)에 설정해 SVG 말꼬리 색상도 동기화
      tb.style.setProperty('--bubble-bg', hex);
      window.triggerAutoSave?.();
    };

    // 말풍선 스타일 드롭다운
    document.getElementById('bubble-style-select')?.addEventListener('change', e => {
      window.pushHistory?.();
      const style = e.target.value;
      tb.dataset.bubbleStyle = style;
      _applyBubbleStyle(style);
      window.triggerAutoSave?.();
    });

    const _applyBubbleStyle = (style) => {
      const bubbleEl = tb.querySelector('.tb-bubble');
      if (!bubbleEl) return;
      if (style === 'apple') {
        bubbleEl.dataset.bubbleStyle = 'apple';
      } else {
        delete bubbleEl.dataset.bubbleStyle;
      }
    };
    _applyBubbleStyle(currentBubbleStyle);

    // 말꼬리 방향
    const _setTail = (dir) => {
      window.pushHistory?.();
      tb.dataset.tail = dir;
      tb.style.marginLeft = dir === 'right' ? 'auto' : dir === 'center' ? 'auto' : '';
      tb.style.marginRight = dir === 'center' ? 'auto' : '';
      // 말꼬리 SVG 교체 (center는 대칭형, left/right는 비대칭형)
      const oldTail = tb.querySelector('.tb-bubble-tail');
      if (oldTail && window.getBubbleTailSVG) {
        const tmp = document.createElement('div');
        tmp.innerHTML = window.getBubbleTailSVG(dir);
        oldTail.replaceWith(tmp.firstElementChild);
      }
      ['left','center','right'].forEach(d => {
        document.getElementById('bubble-tail-' + d)?.classList.toggle('active', d === dir);
      });
      window.triggerAutoSave?.();
    };

    document.getElementById('bubble-tail-left')?.addEventListener('click', () => _setTail('left'));
    document.getElementById('bubble-tail-center')?.addEventListener('click', () => _setTail('center'));
    document.getElementById('bubble-tail-right')?.addEventListener('click', () => _setTail('right'));

    const bubbleBgPicker = document.getElementById('bubble-bg-color');
    const bubbleBgHexInput = document.getElementById('bubble-bg-hex');
    bubbleBgPicker?.addEventListener('input', e => {
      const hex = e.target.value;
      bubbleBgHexInput.value = hex;
      _applyBubbleBg(hex);
    });
    bubbleBgPicker?.addEventListener('change', () => window.pushHistory?.());
    bubbleBgHexInput?.addEventListener('input', e => {
      const hex = e.target.value;
      if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
        bubbleBgPicker.value = hex;
        _applyBubbleBg(hex);
      }
    });
    bubbleBgHexInput?.addEventListener('change', () => window.pushHistory?.());

    // 발신자 이름 토글
    document.getElementById('bubble-show-sender')?.addEventListener('change', e => {
      window.pushHistory?.();
      const show = e.target.checked;
      tb.dataset.showSender = show ? 'true' : 'false';
      const senderEl = tb.querySelector('.tb-sender-name');
      if (senderEl) senderEl.style.display = show ? '' : 'none';
      const nameRow = document.getElementById('bubble-sender-name-row');
      if (nameRow) nameRow.style.display = show ? 'flex' : 'none';
      window.triggerAutoSave?.();
    });

    // 발신자 이름 텍스트 입력
    document.getElementById('bubble-sender-name-input')?.addEventListener('input', e => {
      const name = e.target.value;
      tb.dataset.senderName = name;
      const senderEl = tb.querySelector('.tb-sender-name');
      if (senderEl) senderEl.textContent = name || 'Your name';
      window.triggerAutoSave?.();
    });
    document.getElementById('bubble-sender-name-input')?.addEventListener('change', () => window.pushHistory?.());
  }

  /* ── Custom Font Picker ── */
  const _fpTrigger  = propPanel.querySelector('#txt-font-trigger');
  const _fpDropdown = propPanel.querySelector('#txt-font-dropdown');
  const _fpSearch   = propPanel.querySelector('#txt-font-search');
  const _fpList     = propPanel.querySelector('#txt-font-list');
  const _fpNameEl   = propPanel.querySelector('#txt-font-name');

  const _FP_STATIC = [
    { value: '', label: '기본 (시스템)', group: 'base' },
    { value: "'Pretendard', sans-serif",     label: 'Pretendard',      group: 'korean' },
    { value: "'Noto Sans KR', sans-serif",   label: 'Noto Sans KR',    group: 'korean' },
    { value: "'Noto Serif KR', serif",       label: 'Noto Serif KR',   group: 'korean' },
    { value: "'Inter', sans-serif",          label: 'Inter',           group: 'latin'  },
    { value: "'Space Grotesk', sans-serif",  label: 'Space Grotesk',   group: 'latin'  },
    { value: "'Playfair Display', serif",    label: 'Playfair Display', group: 'latin' },
    { value: 'sans-serif',   label: 'Sans-serif',  group: 'system' },
    { value: 'serif',        label: 'Serif',       group: 'system' },
    { value: 'monospace',    label: 'Monospace',   group: 'system' },
  ];

  function _fpAllFonts() {
    return [
      ..._FP_STATIC,
      ..._systemFontsList.map(fam => ({ value: `'${fam}', sans-serif`, label: fam, group: 'installed' })),
    ];
  }

  function _fpItemHtml(f, isPinned, isSel) {
    const v = f.value.replace(/"/g, '&quot;');
    return `<div class="font-item${isSel ? ' selected' : ''}" data-value="${v}">
      <span class="font-item-name">${f.label}</span>
      <button class="font-item-pin${isPinned ? ' pinned' : ''}" data-pin-value="${v}" title="${isPinned ? '핀 제거' : '핀 고정'}">⭐</button>
    </div>`;
  }

  function _fpBuildList(search) {
    const pins   = JSON.parse(localStorage.getItem('goditor_font_pins')   || '[]');
    const recent = JSON.parse(localStorage.getItem('goditor_font_recent') || '[]');
    const curVal = contentEl.dataset.rawFont || contentEl.style.fontFamily || '';
    const term   = (search || '').trim().toLowerCase();
    const all    = _fpAllFonts();

    const isSel = (v) => v === curVal || (!v && !curVal);

    let html = '';
    if (term) {
      const hits = all.filter(f => f.label.toLowerCase().includes(term));
      if (!hits.length) { html = '<div class="font-group-label">결과 없음</div>'; }
      else hits.forEach(f => { html += _fpItemHtml(f, pins.includes(f.value), isSel(f.value)); });
    } else {
      // Pinned
      const pinnedFonts = pins.map(v => all.find(f => f.value === v) || { value: v, label: _fontDisplayName(v), group: 'pinned' });
      if (pinnedFonts.length) {
        html += '<div class="font-group-label">핀 고정</div>';
        pinnedFonts.forEach(f => { html += _fpItemHtml(f, true, isSel(f.value)); });
      }
      // Recent (not pinned)
      const recentFonts = recent.filter(v => !pins.includes(v))
        .map(v => all.find(f => f.value === v) || { value: v, label: _fontDisplayName(v), group: 'recent' });
      if (recentFonts.length) {
        html += '<div class="font-group-label">최근 사용</div>';
        recentFonts.forEach(f => { html += _fpItemHtml(f, false, isSel(f.value)); });
      }
      // Static groups
      [['base','기본'],['korean','한글'],['latin','영문'],['system','시스템'],['installed','설치 폰트']].forEach(([g, lbl]) => {
        const items = all.filter(f => f.group === g);
        if (!items.length) return;
        html += `<div class="font-group-label">${lbl}</div>`;
        items.forEach(f => { html += _fpItemHtml(f, pins.includes(f.value), isSel(f.value)); });
      });
    }
    _fpList.innerHTML = html;
    const selEl = _fpList.querySelector('.font-item.selected');
    if (selEl) selEl.scrollIntoView({ block: 'nearest' });
  }

  function _fpClose() {
    _fpDropdown.style.display = 'none';
    _fpTrigger.classList.remove('open');
  }

  _fpTrigger.addEventListener('click', () => {
    const isOpen = _fpDropdown.style.display !== 'none';
    if (isOpen) { _fpClose(); return; }

    // Position dropdown with fixed coords to avoid clipping
    const r = _fpTrigger.getBoundingClientRect();
    Object.assign(_fpDropdown.style, {
      display: 'block', position: 'fixed',
      top: (r.bottom + 2) + 'px', left: r.left + 'px', width: r.width + 'px', zIndex: '9999'
    });
    _fpTrigger.classList.add('open');
    _fpSearch.value = '';
    _fpBuildList('');
    setTimeout(() => _fpSearch.focus(), 10);

    const outside = (e) => {
      if (!propPanel.querySelector('#txt-font-picker')?.contains(e.target) &&
          !_fpDropdown.contains(e.target)) {
        _fpClose();
        document.removeEventListener('mousedown', outside, true);
      }
    };
    document.addEventListener('mousedown', outside, true);
  });

  _fpSearch.addEventListener('input', () => _fpBuildList(_fpSearch.value));

  _fpList.addEventListener('mousedown', e => {
    e.preventDefault();
    const pinBtn = e.target.closest('.font-item-pin');
    if (pinBtn) {
      const val = pinBtn.dataset.pinValue;
      let pins = JSON.parse(localStorage.getItem('goditor_font_pins') || '[]');
      if (pins.includes(val)) pins = pins.filter(p => p !== val);
      else pins.unshift(val);
      localStorage.setItem('goditor_font_pins', JSON.stringify(pins));
      _fpBuildList(_fpSearch.value);
      return;
    }
    const item = e.target.closest('.font-item');
    if (item) {
      const rawVal = item.dataset.value;
      window.pushHistory?.();
      contentEl.style.fontFamily = rawVal;
      contentEl.dataset.rawFont  = rawVal;
      contentEl.querySelectorAll('div').forEach(child => { child.style.removeProperty('font-family'); });
      _pushRecentFont(rawVal);
      _fpNameEl.textContent = rawVal ? _fontDisplayName(rawVal) : '기본 (시스템)';
      _fpClose();
    }
  });

  /* 시스템 폰트 비동기 로드 */
  _loadSystemFonts().then(() => {
    if (_fpDropdown.style.display !== 'none') _fpBuildList(_fpSearch.value);
  });

  /* 폰트 굵기 */
  document.getElementById('txt-font-weight').addEventListener('change', e => {
    contentEl.style.fontWeight = e.target.value;
    window.pushHistory();
  });

  /* 타입 전환 */
  const typeMap2 = { 'tb-h1':'heading','tb-h2':'heading','tb-h3':'heading','tb-body':'body','tb-caption':'caption','tb-label':'label' };
  propPanel.querySelectorAll('.prop-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.pushHistory?.();
      const cls = btn.dataset.cls;
      contentEl.className = cls;
      tb.dataset.type = typeMap2[cls];
      propPanel.querySelectorAll('.prop-type-btn').forEach(b => b.classList.toggle('active', b===btn));

      const labelSection = document.getElementById('label-style-section');
      if (labelSection) labelSection.style.display = cls === 'tb-label' ? 'block' : 'none';

      // label로 전환 시 기본 스타일 적용, 다른 타입으로 전환 시 초기화
      if (cls === 'tb-label') {
        if (!contentEl.style.backgroundColor) contentEl.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--preset-label-bg').trim() || '#111111';
        if (!contentEl.style.color) contentEl.style.color = getComputedStyle(document.documentElement).getPropertyValue('--preset-label-color').trim() || '#ffffff';
        if (!contentEl.style.borderRadius) contentEl.style.borderRadius = '4px';
      } else {
        contentEl.style.backgroundColor = '';
        contentEl.style.borderRadius = '';
      }
    });
  });

  /* 태그 배경색 */
  const labelBgPicker = document.getElementById('label-bg-color');
  const labelBgHex    = document.getElementById('label-bg-hex');
  const labelBgNone   = document.getElementById('label-bg-none');
  if (labelBgPicker) {
    const labelBgSwatch = labelBgPicker.closest('.prop-color-swatch');
    const setLabelBg = (val) => {
      const isNone = val === 'transparent';
      contentEl.style.backgroundColor = val;
      contentEl.style.padding = isNone ? '0' : '';
      contentEl.style.borderRadius = isNone ? '0' : (contentEl.style.borderRadius || '');
      labelBgSwatch.style.background = isNone ? 'transparent' : val;
      labelBgSwatch.classList.toggle('swatch-none', isNone);
      if (!isNone) { labelBgHex.value = val; labelBgPicker.value = val; }
    };
    labelBgPicker.addEventListener('input', () => {
      if (labelBgNone.checked) return;
      setLabelBg(labelBgPicker.value);
      labelBgHex.value = labelBgPicker.value;
    });
    labelBgHex.addEventListener('input', () => {
      if (/^#[0-9a-f]{6}$/i.test(labelBgHex.value)) { setLabelBg(labelBgHex.value); labelBgNone.checked = false; }
    });
    labelBgNone.addEventListener('change', () => {
      if (labelBgNone.checked) { setLabelBg('transparent'); labelBgHex.value = ''; }
      else {
        contentEl.style.padding = '';
        const v = labelBgPicker.value || '#111111';
        setLabelBg(v); labelBgHex.value = v;
      }
    });
  }
  /* 태그 모서리 */
  const rSlider = document.getElementById('label-radius-slider');
  const rNumber = document.getElementById('label-radius-number');
  if (rSlider) {
    rSlider.addEventListener('input', () => { contentEl.style.borderRadius = rSlider.value+'px'; rNumber.value = rSlider.value; });
    rSlider.addEventListener('change', () => window.pushHistory?.());
    rNumber.addEventListener('input', () => {
      const v = Math.min(40, Math.max(0, parseInt(rNumber.value)||0));
      contentEl.style.borderRadius = v+'px'; rSlider.value = v;
    });
    rNumber.addEventListener('change', () => window.pushHistory?.());
  }

  /* 태그 pill 높이 (상하 패딩으로 조절) */
  const pillHSlider = document.getElementById('label-pill-height-slider');
  const pillHNumber = document.getElementById('label-pill-height-number');
  if (pillHSlider) {
    const setPillH = v => { const half = Math.round(v/2); contentEl.style.paddingTop = half+'px'; contentEl.style.paddingBottom = half+'px'; };
    pillHSlider.addEventListener('input', () => { setPillH(parseInt(pillHSlider.value)); pillHNumber.value = pillHSlider.value; });
    pillHSlider.addEventListener('change', () => window.pushHistory?.());
    pillHNumber.addEventListener('input', () => {
      const v = Math.min(120, Math.max(0, parseInt(pillHNumber.value)||0));
      setPillH(v); pillHSlider.value = v;
    });
    pillHNumber.addEventListener('change', () => window.pushHistory?.());
  }

  /* 태그 형태 프리셋 */
  document.getElementById('label-shape-pill')?.addEventListener('click', () => {
    window.pushHistory?.();
    contentEl.style.borderRadius = '40px';
    contentEl.style.paddingLeft  = '20px';
    contentEl.style.paddingRight = '20px';
    contentEl.style.width  = '';
    contentEl.style.height = '';
    contentEl.style.display = '';
    contentEl.style.alignItems = '';
    contentEl.style.justifyContent = '';
    const rSlider2 = document.getElementById('label-radius-slider');
    const rNumber2 = document.getElementById('label-radius-number');
    if (rSlider2) { rSlider2.value = 40; rNumber2.value = 40; }
  });
  document.getElementById('label-shape-box')?.addEventListener('click', () => {
    window.pushHistory?.();
    contentEl.style.borderRadius = '4px';
    contentEl.style.paddingLeft  = '12px';
    contentEl.style.paddingRight = '12px';
    contentEl.style.width  = '';
    contentEl.style.height = '';
    contentEl.style.display = '';
    contentEl.style.alignItems = '';
    contentEl.style.justifyContent = '';
    const rSlider2 = document.getElementById('label-radius-slider');
    const rNumber2 = document.getElementById('label-radius-number');
    if (rSlider2) { rSlider2.value = 4; rNumber2.value = 4; }
  });
  document.getElementById('label-shape-circle')?.addEventListener('click', () => {
    window.pushHistory?.();
    contentEl.style.borderRadius = '50%';
    contentEl.style.padding = '0';
    contentEl.style.width  = '48px';
    contentEl.style.height = '48px';
    contentEl.style.display = 'inline-flex';
    contentEl.style.alignItems = 'center';
    contentEl.style.justifyContent = 'center';
    const rSlider2 = document.getElementById('label-radius-slider');
    const rNumber2 = document.getElementById('label-radius-number');
    if (rSlider2) { rSlider2.value = 40; rNumber2.value = 40; }
  });
  document.getElementById('label-shape-text')?.addEventListener('click', () => {
    window.pushHistory?.();
    contentEl.style.backgroundColor = 'transparent';
    contentEl.style.color = '#111111';
    contentEl.style.borderRadius = '0';
    contentEl.style.padding = '0';
    contentEl.style.width  = '';
    contentEl.style.height = '';
    contentEl.style.display = '';
    contentEl.style.alignItems = '';
    contentEl.style.justifyContent = '';
    const rSlider2 = document.getElementById('label-radius-slider');
    const rNumber2 = document.getElementById('label-radius-number');
    if (rSlider2) { rSlider2.value = 0; rNumber2.value = 0; }
  });

  /* 정렬 */
  propPanel.querySelectorAll('.prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!btn.dataset.align) return; // 말꼬리 방향 버튼은 data-align 없으므로 무시
      window.pushHistory?.();
      // label(inline-block)은 부모 tb에 text-align 적용해야 블록 자체가 정렬됨
      if (contentEl.classList.contains('tb-label')) {
        tb.style.textAlign = btn.dataset.align;
      } else if (isIconText) {
        // 아이콘+텍스트 전체를 함께 정렬 — justifyContent로 icon-text-block 내부 정렬
        const jcMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
        tb.style.justifyContent = jcMap[btn.dataset.align] || 'flex-start';
        const itbText = tb.querySelector('.itb-text');
        if (itbText) itbText.style.flex = btn.dataset.align === 'left' ? '1' : '0 1 auto';
      } else {
        contentEl.style.textAlign = btn.dataset.align;
      }
      propPanel.querySelectorAll('.prop-align-btn[data-align]').forEach(b => b.classList.toggle('active', b===btn));
    });
  });

  /* 아이콘-텍스트 간격 */
  if (isIconText) {
    const itbGapSlider = propPanel.querySelector('#itb-gap-slider');
    const itbGapNumber = propPanel.querySelector('#itb-gap-number');
    if (itbGapSlider && itbGapNumber) {
      const applyItbGap = v => { tb.style.gap = v + 'px'; window.triggerAutoSave?.(); };
      itbGapSlider.addEventListener('input', () => { itbGapNumber.value = itbGapSlider.value; applyItbGap(itbGapSlider.value); });
      itbGapNumber.addEventListener('input', () => { itbGapSlider.value = itbGapNumber.value; applyItbGap(itbGapNumber.value); });
    }
  }

  let _savedColorSel = null;
  let _colorSpan = null; // 색상 적용 시 생성한 span (input 반복 호출에 재사용)

  const hasSel = () => {
    const sel = window.getSelection();
    return sel && !sel.isCollapsed && (contentEl.contains(sel.anchorNode) || contentEl.contains(sel.focusNode));
  };
  const applyExecCmd = (savedSel, cmd, val = null) => {
    if (!savedSel) return false;
    const wasEditable = contentEl.contentEditable;
    contentEl.contentEditable = 'true';
    contentEl.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedSel);
    if (val) document.execCommand(cmd, false, val);
    else document.execCommand(cmd, false, null);
    contentEl.contentEditable = wasEditable;
    return true;
  };

  /* 폰트 크기 — 선택 영역이 있으면 해당 영역에만, 없으면 전체에 적용 */
  const sizeNumber = document.getElementById('txt-size-number');
  let _savedSizeSel = null;
  let _sizeSpan = null;

  const saveSizeSel = () => {
    if (hasSel()) { _savedSizeSel = window.getSelection().getRangeAt(0).cloneRange(); _sizeSpan = null; }
    else { _savedSizeSel = null; _sizeSpan = null; }
  };
  const applySizeToSel = (v) => {
    if (!_savedSizeSel) {
      // 자식 요소의 inline font-size 모두 제거 후 컨테이너에 설정 (복사된 블록 대응)
      contentEl.querySelectorAll('[style]').forEach(el => el.style.removeProperty('font-size'));
      contentEl.style.fontSize = v + 'px';
      return;
    }
    if (_sizeSpan) {
      _sizeSpan.style.fontSize = v + 'px';
    } else {
      const r = _savedSizeSel.cloneRange();
      const frag = r.extractContents();
      _sizeSpan = document.createElement('span');
      _sizeSpan.style.fontSize = v + 'px';
      _sizeSpan.appendChild(frag);
      r.insertNode(_sizeSpan);
    }
  };

  sizeNumber.addEventListener('mousedown', saveSizeSel);
  sizeNumber.addEventListener('input', () => {
    const v = Math.min(400, Math.max(8, parseInt(sizeNumber.value)||8));
    applySizeToSel(v);
  });
  sizeNumber.addEventListener('change', () => { _savedSizeSel = null; _sizeSpan = null; window.pushHistory(); });

  /* 색상 — 선택 영역이 있으면 해당 영역에만, 없으면 전체에 적용 */
  const colorPicker = document.getElementById('txt-color');
  const colorHex    = document.getElementById('txt-color-hex');
  const colorSwatch = colorPicker.closest('.prop-color-swatch');
  colorSwatch.addEventListener('mousedown', () => {
    if (hasSel()) { _savedColorSel = window.getSelection().getRangeAt(0).cloneRange(); _colorSpan = null; }
    else { _savedColorSel = null; _colorSpan = null; }
  });

  const applyColorToSel = (color) => {
    if (!_savedColorSel) {
      contentEl.style.color = color;
      // Enter 줄바꿈으로 생성된 자식 div들의 인라인 color 제거 (부모 color가 cascade되도록)
      contentEl.querySelectorAll('div').forEach(child => { child.style.color = ''; });
      return;
    }
    if (_colorSpan) {
      // 이미 span 생성됨 → color만 업데이트 (DOM 재조작 없음)
      _colorSpan.style.color = color;
    } else {
      // 처음 적용: range에서 내용 추출 → span으로 감싸 재삽입
      const r = _savedColorSel.cloneRange();
      const frag = r.extractContents();
      _colorSpan = document.createElement('span');
      _colorSpan.style.color = color;
      _colorSpan.appendChild(frag);
      r.insertNode(_colorSpan);
    }
  };

  colorPicker.addEventListener('input', () => {
    applyColorToSel(colorPicker.value);
    colorHex.value = colorPicker.value;
    colorSwatch.style.background = colorPicker.value;
  });
  colorPicker.addEventListener('change', () => { _savedColorSel = null; _colorSpan = null; window.pushHistory(); });
  colorHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(colorHex.value)) {
      colorPicker.value = colorHex.value;
      applyColorToSel(colorHex.value);
      colorSwatch.style.background = colorHex.value;
    }
  });

  /* 줄간격 */
  const lhNumber = document.getElementById('txt-lh-number');
  lhNumber.addEventListener('change', () => { window.pushHistory?.(); });
  lhNumber.addEventListener('input', () => {
    const v = Math.min(3, Math.max(1, parseFloat(lhNumber.value)||1));
    contentEl.style.lineHeight = v;
  });

  /* 자간 */
  const lsNumber = document.getElementById('txt-ls-number');
  lsNumber.addEventListener('change', () => { window.pushHistory?.(); });
  lsNumber.addEventListener('input', () => {
    const v = Math.min(40, Math.max(-10, parseFloat(lsNumber.value) || 0));
    contentEl.style.letterSpacing = v + 'px';
  });

  /* 위치 / 크기 (overlay-tb는 해당 없음) */
  if (!isOverlayTb) {
    const wSlider = document.getElementById('txt-width-slider');
    const wNumber = document.getElementById('txt-width-number');
    if (wSlider) {
      const applyW = v => {
        const row = tb.closest('.row');
        const tf  = tb.closest('.frame-block[data-text-frame="true"]');
        if (row) {
          row.style.width     = v + 'px';
          row.style.maxWidth  = '100%';
          row.style.margin    = '0 auto';
          row.style.alignSelf = 'center';
          row.dataset.width   = v;
        } else if (tf) {
          // text-frame이 래퍼인 경우 — text-frame에 width 적용
          tf.style.width    = v + 'px';
          tf.style.maxWidth = '100%';
          tf.dataset.width  = v;
        } else {
          tb.style.width = v + 'px';
          tb.dataset.width = v;
        }
        wSlider.value = v; wNumber.value = v;
        window.scheduleAutoSave?.();
      };
      wSlider.addEventListener('input', () => applyW(parseInt(wSlider.value)));
      wNumber.addEventListener('input', () => applyW(Math.min(860, Math.max(80, parseInt(wNumber.value) || 80))));
      wSlider.addEventListener('change', () => window.pushHistory?.());
      wNumber.addEventListener('change', () => window.pushHistory?.());
    }

    const xNumber = document.getElementById('txt-x-number');
    const yNumber = document.getElementById('txt-y-number');
    if (xNumber) {
      xNumber.addEventListener('input', () => {
        const el = tb.closest('.frame-block[data-text-frame="true"]') || tb;
        el.style.left = (parseInt(xNumber.value) || 0) + 'px';
        el.dataset.offsetX = xNumber.value;
        window.scheduleAutoSave?.();
      });
      xNumber.addEventListener('change', () => window.pushHistory?.());
    }
    if (yNumber) {
      yNumber.addEventListener('input', () => {
        const el = tb.closest('.frame-block[data-text-frame="true"]') || tb;
        el.style.top = (parseInt(yNumber.value) || 0) + 'px';
        el.dataset.offsetY = yNumber.value;
        window.scheduleAutoSave?.();
      });
      yNumber.addEventListener('change', () => window.pushHistory?.());
    }
  }

  /* 패딩 (overlay-tb는 해당 없음) */
  if (!isOverlayTb) {
    const pvSlider = document.getElementById('txt-pv-slider');
    const pvNumber = document.getElementById('txt-pv-number');
    if (pvSlider) {
      pvSlider.addEventListener('input', () => { tb.style.paddingTop = pvSlider.value+'px'; tb.style.paddingBottom = pvSlider.value+'px'; pvNumber.value = pvSlider.value; });
      pvNumber.addEventListener('input', () => { const v=Math.min(120,Math.max(0,parseInt(pvNumber.value)||0)); tb.style.paddingTop=v+'px'; tb.style.paddingBottom=v+'px'; pvSlider.value=v; });
    }

    /* 좌우 패딩 */
    const plSlider = document.getElementById('txt-pl-slider');
    const plNumber = document.getElementById('txt-pl-number');
    const prSlider = document.getElementById('txt-pr-slider');
    const prNumber = document.getElementById('txt-pr-number');
    const chainBtn = document.getElementById('txt-ph-chain');

    const CHAIN_SVG_LINKED = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="3.5" width="4" height="5" rx="2"/><rect x="7.5" y="3.5" width="4" height="5" rx="2"/><line x1="4.5" y1="6" x2="7.5" y2="6" stroke-linecap="round"/></svg>`;
    const CHAIN_SVG_BROKEN = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="3.5" width="4" height="5" rx="2"/><rect x="7.5" y="3.5" width="4" height="5" rx="2"/><line x1="5.2" y1="4.8" x2="6.8" y2="7.2" stroke-linecap="round"/></svg>`;

    if (plSlider) {
      chainBtn.addEventListener('click', () => {
        phLinked = !phLinked;
        chainBtn.classList.toggle('active', phLinked);
        chainBtn.innerHTML = phLinked ? CHAIN_SVG_LINKED : CHAIN_SVG_BROKEN;
        if (phLinked) {
          const v = parseInt(plSlider.value);
          tb.style.paddingRight = v + 'px';
          prSlider.value = v; prNumber.value = v;
        }
      });

      const setL = v => {
        tb.style.paddingLeft = v + 'px';
        tb.dataset.customPadL = '1';
        plSlider.value = v; plNumber.value = v;
        if (phLinked) { tb.style.paddingRight = v + 'px'; tb.dataset.customPadR = '1'; prSlider.value = v; prNumber.value = v; }
      };
      const setR = v => {
        tb.style.paddingRight = v + 'px';
        tb.dataset.customPadR = '1';
        prSlider.value = v; prNumber.value = v;
        if (phLinked) { tb.style.paddingLeft = v + 'px'; tb.dataset.customPadL = '1'; plSlider.value = v; plNumber.value = v; }
      };

      plSlider.addEventListener('input', () => setL(parseInt(plSlider.value)));
      plNumber.addEventListener('input', () => setL(Math.min(120, Math.max(0, parseInt(plNumber.value) || 0))));
      prSlider.addEventListener('input', () => setR(parseInt(prSlider.value)));
      prNumber.addEventListener('input', () => setR(Math.min(120, Math.max(0, parseInt(prNumber.value) || 0))));
    }
  }

  /* 애니메이션 GIF 버튼 */
  // BUG-FIX: 텍스트블록 선택마다 이 함수가 실행되므로 리스너 중복 방지
  // onclick을 직접 교체하는 방식으로 단일 핸들러 보장
  const animBtn = document.getElementById('open-anim-btn');
  if (animBtn) animBtn.onclick = () => window.openAnimModal(tb);

  window.bindLayoutInput?.(tb);
}

export function rgbToHex(rgb) {
  const m = rgb.match(/\d+/g);
  if (!m) return '#111111';
  return '#' + m.slice(0,3).map(x => parseInt(x).toString(16).padStart(2,'0')).join('');
}

/* ── 폰트 최근 사용 / 핀 고정 ── */
function _pushRecentFont(fontValue) {
  if (!fontValue) return;
  const key = 'goditor_font_recent';
  let recent = JSON.parse(localStorage.getItem(key) || '[]');
  recent = [fontValue, ...recent.filter(f => f !== fontValue)].slice(0, 5);
  localStorage.setItem(key, JSON.stringify(recent));
}

function _fontDisplayName(fontValue) {
  // "'Pretendard', sans-serif" → "Pretendard"
  return fontValue.replace(/['"]/g, '').split(',')[0].trim();
}

/* ── 시스템 설치 폰트 동적 로드 (모듈 수준 캐시) ── */
async function _loadSystemFonts() {
  if (_systemFontsList.length > 0 || !window.queryLocalFonts) return;
  try {
    const fonts = await window.queryLocalFonts();
    _systemFontsList = [...new Set(fonts.map(f => f.family))].sort((a, b) => a.localeCompare(b, 'ko'));
  } catch (e) { /* 퍼미션 거부 또는 미지원 */ }
}

// Backward compat: classic scripts call these via window.*
window.showTextProperties = showTextProperties;
window.rgbToHex           = rgbToHex;
