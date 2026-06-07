// HTML template extracted from prop-text.js (Phase 2 refactor)
import { _fontDisplayName } from './prop-text-utils.js';

export function buildTextPropsHtml(state) {
  const {
    tb, isOverlayTb, currentClass, currentAlign,
    currentX, currentY, currentRotation = 0, currentW, currentFont, currentWeight, currentSize,
    currentLH, currentLS, currentColor, currentColorAlpha,
    currentPadT, currentPadL, currentPadR, phLinked,
    isLabel, currentBgColor, currentRadius, labelPillH,
    isSpeechBubble, currentBubbleStyle, currentTail,
    bubbleBgHex, showSender, senderName,
    isIconText, currentItbGap,
    mix,
    shadow,
  } = state;

  // Shadow defaults (prop-text-wireup-shadow.js SHADOW_DEFAULTS와 동기화)
  const _sh = shadow || { enabled:false, x:2, y:2, blur:4, color:'#000000', alpha:50 };
  const _shHex = (_sh.color || '#000000').replace('#','').toUpperCase();
  const _shHexLow = '#' + _shHex.toLowerCase();
  const _shSwatchBg = (() => {
    const h = _shHex;
    const r = parseInt(h.slice(0,2), 16);
    const g = parseInt(h.slice(2,4), 16);
    const b = parseInt(h.slice(4,6), 16);
    const a = Math.max(0, Math.min(1, (_sh.alpha ?? 100) / 100));
    return a >= 1 ? _shHexLow : `rgba(${r},${g},${b},${a})`;
  })();

  // Figma "Mix" 정책: 자식들의 스타일이 섞여있으면 input 을 빈 값 + placeholder="Mix" 로 표시
  const _mix = mix || { color:{mixed:false}, fontSize:{mixed:false}, fontWeight:{mixed:false} };
  const _sizeVal      = _mix.fontSize.mixed   ? '' : currentSize;
  const _sizePh       = _mix.fontSize.mixed   ? 'Mix' : '';
  const _colorHexVal  = _mix.color.mixed      ? '' : currentColor.replace('#','').toUpperCase();
  const _colorHexPh   = _mix.color.mixed      ? 'Mix' : '';
  const _colorSwatchBg = _mix.color.mixed     ? 'linear-gradient(135deg,#bbb 25%,#777 25%,#777 50%,#bbb 50%,#bbb 75%,#777 75%)' : currentColor;
  const _swatchExtraClass = _mix.color.mixed  ? ' swatch-mix' : '';
  const _weightMixed   = _mix.fontWeight.mixed;

  return `
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
        <button class="prop-type-btn ${currentClass==='tb-bullet'?'active':''}"  data-cls="tb-bullet">List</button>
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
      <span class="prop-field-label" style="margin-top:6px">Rotation</span>
      <div class="prop-row">
        <span class="prop-label">회전°</span>
        <input type="range" class="prop-slider" id="txt-rot-slider" min="-180" max="180" step="1" value="${currentRotation}">
        <input type="number" class="prop-number" id="txt-rot-number" min="-180" max="180" step="1" value="${currentRotation}">
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
          ${_weightMixed ? '<option value="" selected disabled>Mix</option>' : ''}
          <option value="100" ${!_weightMixed && currentWeight==='100'?'selected':''}>Thin 100</option>
          <option value="200" ${!_weightMixed && currentWeight==='200'?'selected':''}>ExtraLight 200</option>
          <option value="300" ${!_weightMixed && currentWeight==='300'?'selected':''}>Light 300</option>
          <option value="400" ${!_weightMixed && (!currentWeight||currentWeight==='400')?'selected':''}>Regular 400</option>
          <option value="500" ${!_weightMixed && currentWeight==='500'?'selected':''}>Medium 500</option>
          <option value="600" ${!_weightMixed && currentWeight==='600'?'selected':''}>SemiBold 600</option>
          <option value="700" ${!_weightMixed && currentWeight==='700'?'selected':''}>Bold 700</option>
          <option value="800" ${!_weightMixed && currentWeight==='800'?'selected':''}>ExtraBold 800</option>
          <option value="900" ${!_weightMixed && currentWeight==='900'?'selected':''}>Black 900</option>
        </select>
        <input type="number" class="prop-number prop-number-select" id="txt-size-number" min="8" max="800" value="${_sizeVal}" placeholder="${_sizePh}" style="flex:1;min-width:0">
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
        <div class="prop-color-field">
          <div class="prop-color-swatch${_swatchExtraClass}" style="background:${_colorSwatchBg}" title="${_mix.color.mixed?'Mix — 일부 선택 후 색상 변경':''}">
            <input type="color" id="txt-color" value="${currentColor}">
          </div>
          <input type="text" class="prop-color-hex" id="txt-color-hex" value="${_colorHexVal}" placeholder="${_colorHexPh}" maxlength="6" aria-label="Color">
          <label class="prop-color-alpha" title="Opacity">
            <input type="text" class="prop-color-alpha-input" id="txt-color-alpha" value="${currentColorAlpha}" aria-label="Opacity">
            <span class="prop-color-alpha-suffix">%</span>
          </label>
        </div>
      </div>
      <div class="cv-chips" id="txt-color-chips" hidden></div>
    </div>

    <div class="prop-section" id="txt-shadow-section">
      <div class="prop-section-title-row" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div class="prop-section-title" style="margin-bottom:0">Shadow</div>
        <label class="prop-toggle" title="그림자 켜기/끄기" style="display:inline-flex;align-items:center;gap:4px">
          <input type="checkbox" id="txt-shadow-on" ${_sh.enabled ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
      <div id="txt-shadow-controls">
        <div class="prop-row">
          <span class="prop-label">X</span>
          <input type="range" class="prop-slider" id="txt-shadow-x-slider" min="-20" max="20" step="1" value="${_sh.x}">
          <input type="number" class="prop-number" id="txt-shadow-x-number" min="-20" max="20" value="${_sh.x}">
        </div>
        <div class="prop-row">
          <span class="prop-label">Y</span>
          <input type="range" class="prop-slider" id="txt-shadow-y-slider" min="-20" max="20" step="1" value="${_sh.y}">
          <input type="number" class="prop-number" id="txt-shadow-y-number" min="-20" max="20" value="${_sh.y}">
        </div>
        <div class="prop-row">
          <span class="prop-label">Blur</span>
          <input type="range" class="prop-slider" id="txt-shadow-blur-slider" min="0" max="40" step="1" value="${_sh.blur}">
          <input type="number" class="prop-number" id="txt-shadow-blur-number" min="0" max="40" value="${_sh.blur}">
        </div>
        <div class="prop-color-row">
          <span class="prop-label">색상</span>
          <div class="prop-color-field">
            <div class="prop-color-swatch" style="background:${_shSwatchBg}">
              <input type="color" id="txt-shadow-color" value="${_shHexLow}">
            </div>
            <input type="text" class="prop-color-hex" id="txt-shadow-color-hex" value="${_shHex}" maxlength="6" aria-label="Shadow color">
            <label class="prop-color-alpha" title="Opacity">
              <input type="text" class="prop-color-alpha-input" id="txt-shadow-color-alpha" value="${_sh.alpha}" aria-label="Shadow opacity">
              <span class="prop-color-alpha-suffix">%</span>
            </label>
          </div>
        </div>
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
      <div class="prop-row" id="txt-label-h-row" style="display:${isLabel?'flex':'none'}">
        <span class="prop-label">박스 높이</span>
        <input type="range" class="prop-slider" id="txt-label-h-slider" min="0" max="120" step="2" value="${labelPillH}">
        <input type="number" class="prop-number" id="txt-label-h-number" min="0" max="120" value="${labelPillH}">
      </div>
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
          <button class="prop-btn-full" id="label-shape-outline">Outline</button>
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
}
