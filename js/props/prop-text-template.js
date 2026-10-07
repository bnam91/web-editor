// HTML template extracted from prop-text.js (Phase 2 refactor)
import { buildTypographySectionHtml, buildFillSectionHtml } from './_typo-section.js';
import { overlayToggleBtnHTML, blockHeaderHTML, sliderRowHTML } from './_helpers.js';
/* T7 — 글머리 명부·판정은 ★한 자리(text-type-class.js). 패널과 배선이 ★같은 하나를 본다. */
import { BULLET_LIST_STYLES, bulletListStyleOf } from './text-type-class.js';

export function buildTextPropsHtml(state) {
  const {
    tb, isOverlayTb, currentClass, currentAlign,
    currentX, currentY, currentRotation = 0, currentW, currentFont, currentWeight, currentSize,
    currentLH, currentLS, currentColor, currentColorAlpha,
    currentPadT, currentPadL, currentPadR, phLinked,
    isLabel, currentBgColor, currentRadius, labelPillH, labelPadX = 0, labelIsCircle = false, labelShape = null,
    isSpeechBubble, currentBubbleStyle, currentTail,
    bubbleBgHex, showSender,
    isIconText, currentItbGap, itbVertical,
    mix,
    shadow,
    isLiner,
    isStrike,
    isBold,
    isItalic,
    isHighlight,
    hlColorHtml, hlH,               /* ★형광펜 «색 칸 마크업»·바 높이 (2026-10-06). 마크업은 prop-text.js 가 만들어 준다 */
    isOverlayBlock,
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

  return `
    <div class="prop-section">
${blockHeaderHTML({
      icon: `          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <line x1="1" y1="3" x2="11" y2="3"/><line x1="1" y1="6" x2="11" y2="6"/><line x1="1" y1="9" x2="7" y2="9"/>
          </svg>`,
      name: tb.dataset.layerName,
      defaultName: (isOverlayTb ? 'Overlay Text' : 'Text Block'),
      crumb: window.getBlockBreadcrumb(tb),
      id: tb.id,
    })}
    </div>

    <div class="prop-section" id="type-section" style="display:${(isLiner || isIconText)?'none':'block'}">
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
${/* ═══ T7 ★불릿 «글머리» — 현빈 2026-10-07 「불릿의 크기 및, 모양 및 숫자 및 알파벳 등 프리셋 필요」 ═══
    * ★불릿일 때만 뜬다 — 다른 타입에선 ★절이 아예 없다(바이트 동일). 「눌리는데 아무 일도 안 난다」를 안 만든다.
    * ★★⛔단추에 `prop-type-btn` 을 ★쓰지 않았다 — ★까닭이 있다(2026-10-07 실측):
    *   `prop-text-wireup-type.js` 의 `wireTypeSection` 이 ★`propPanel.querySelectorAll('.prop-type-btn')` 으로
    *   ★패널 ★전역을 잡는다 ⇒ 그 클래스를 붙이면 ★내 단추도 ★타입 전환 핸들러가 물고,
    *   `btn.dataset.cls` 가 ★undefined 라 ★타입 클래스가 ★지워진다.
    *   ⇒ 모양은 `prop-preset-group` ＋ `prop-preset-btn` ★한 쌍으로 세운다(css/editor-props.css:230 그 절 ·
    *     `.prop-type-group:has(.prop-preset-btn)` 선례가 이미 둘을 섞는다) ⇒ ★새 클래스 ★0.
    *   ⚠️그 ★전역 셀렉터 자체는 ★잠복 결함이다(다음 사람이 그 클래스를 쓰면 조용히 깨진다) —
    *     ⛔이 카드에서 ★안 고친다(범위 밖). ★별건으로 올렸다. 대신 ★검사가 「내 단추엔 그 클래스가 없다」를 잠근다.
    * ★「지금 무엇이 골라졌나」 = ★인라인(`bulletListStyleOf`) — ⛔computed 금지(기본 disc 와 못 가른다).
    *   ★아무것도 안 골랐으면 ★`disc` 단추를 active 로 보인다(화면이 그러하므로) — ★값은 여전히 ★빈 문자열이다. */''}
    ${currentClass !== 'tb-bullet' ? '' : (() => {
      const _ul = tb?.querySelector?.('ul.tb-bullet');
      const _cur = _ul ? bulletListStyleOf(_ul) : '';
      return `
    <div class="prop-section" id="bullet-style-section">
      <div class="prop-section-title">글머리</div>
      <div class="prop-type-group prop-preset-group">
        ${BULLET_LIST_STYLES.map(s => `<button class="prop-preset-btn${(_cur || 'disc') === s.v ? ' active' : ''}" data-lst="${s.v}" title="${s.title}">${s.label}</button>`).join('\n        ')}
      </div>
      <div class="prop-hint">크기는 Typography 의 글자 크기를 따릅니다</div>
    </div>`;
    })()}

    <div class="prop-section">
      <!-- ★2026-09-16g 현빈 정정(T-001) — Ignore Auto Layout 토글은 Alignment 줄이 아니라
           "Position" «섹션 제목과 같은 줄», 오른쪽 끝이었다(Figma 레퍼런스 스크린샷 재확인).
           id·클릭 배선(prop-text-wireup-overlay.js wireOverlaySection)은 그대로 — 자리만 옮긴다. -->
      <div class="prop-section-title prop-ph-header" style="margin-bottom:0">
        <span>Position</span>
        ${isOverlayTb ? '' : overlayToggleBtnHTML({ id: 'txt-overlay-toggle', active: isOverlayBlock })}
      </div>
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

    ${buildTypographySectionHtml({
      p: 'txt',
      font: currentFont, weight: currentWeight, size: currentSize,
      isBold, isItalic, isStrike, isHighlight,
      lh: currentLH, ls: currentLS,
      sizeMin: 8, sizeMax: 800,
      showStyleGroup: !isLiner, showLetterSpacing: !isLiner, showSize: !isLiner,
      /* ★텍스트 패널만 형광펜 색·바 높이 칸을 갖는다 — 배선(wireTextEditSection)이 여기에만 있다.
         ⛔모달(prop-modal.js)·그리드(prop-grid.js)는 기본값 false 라 마크업이 «바이트 동일»이다. */
      showHighlightOpts: !isLiner, hlColorHtml, hlH,
      mix: _mix,
    })}

    ${buildFillSectionHtml({ p: 'txt', colorHex: currentColor, alpha: currentColorAlpha, mix: _mix })}

    <div class="prop-section" id="txt-shadow-section">
      <div class="prop-section-title-row" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div class="prop-section-title" style="margin-bottom:0">Shadow</div>
        <label class="prop-toggle" title="그림자 켜기/끄기" style="display:inline-flex;align-items:center;gap:4px">
          <input type="checkbox" id="txt-shadow-on" ${_sh.enabled ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
      <div id="txt-shadow-controls" style="display:${_sh.enabled ? 'block' : 'none'}">
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
            <input type="text" class="prop-color-hex" id="txt-shadow-color-hex" value="${_shHex}" maxlength="7" aria-label="Shadow color">
            <label class="prop-color-alpha" title="Opacity">
              <input type="text" class="prop-color-alpha-input" id="txt-shadow-color-alpha" value="${_sh.alpha}" aria-label="Shadow opacity">
              <span class="prop-color-alpha-suffix">%</span>
            </label>
          </div>
        </div>
      </div>
    </div>${/* ★E1 Effects(바닥 반사) — Shadow 바로 아래(지디 승인) · 말풍선·라벨·아이콘텍스트는 대상 밖. ⛔줄바꿈을 더하지 마라 — 절이 없을 때 산출이 추출 전 골든과 같아야 한다(typo-section-ssot T1). */
      (!isSpeechBubble && !isLabel && !isIconText) ? (window.fxSectionHtml?.(tb, 'txt') || '') : ''}

    <div class="prop-section" style="${isOverlayTb ? 'display:none' : ''}">
      <div class="prop-section-title">Size</div>
      <div class="prop-row">
        <span class="prop-label">너비</span>
        <input type="range" class="prop-slider" id="txt-width-slider" min="80" max="860" step="1" value="${currentW}">
        <input type="number" class="prop-number" id="txt-width-number" min="80" max="860" value="${currentW}">
      </div>
    </div>

    <div class="prop-section" style="${isOverlayTb ? 'display:none' : ''}">
      <div class="prop-section-title">Padding</div>
      <div id="txt-label-padx-wrap" style="display:${isLabel && !labelIsCircle ? 'block' : 'none'}">
      ${sliderRowHTML('좌우 패딩', 'txt-label-padx-slider', 'txt-label-padx-number', { min: 0, max: 100, step: 2, value: labelPadX })}
      </div>
      <div class="prop-row">
        <span class="prop-label">상하</span>
        <input type="range" class="prop-slider" id="txt-pv-slider" min="0" max="120" step="4" value="${currentPadT}"${isSpeechBubble ? ' disabled style="opacity:var(--ui-disabled-opacity);cursor:not-allowed"' : ''}>
        <input type="number" class="prop-number" id="txt-pv-number" min="0" max="120" value="${currentPadT}"${isSpeechBubble ? ' disabled style="opacity:var(--ui-disabled-opacity);cursor:not-allowed"' : ''}>
      </div>${/* ★⑷㉣ 현빈 sb_ts0he_4lus8he 「상하패딩 → 말꼬리 분리 → 상하패딩 비활성화」 — 꼬리는 블럭 기준 absolute 라 상하 여백을 주면 몸통에서 떨어진다(실측 −10 → +14px).
            칸은 «숨기지 않고» 막고 까닭을 보이게 적는다(호버만으론 안 보인다). 이미 상하 여백이 있는 말풍선은 그대로 둔다(문서 무변).
            ⛔줄바꿈은 «말풍선 문자열 안»에만 — 밖에 두면 보통 텍스트 패널 산출이 7자 늘어 골든(typo-section-ssot T1)이 깨진다(10-06 실측 17994 → 18001). */
         isSpeechBubble ? '\n      <div class="prop-hint" id="txt-pv-bubble-hint">말풍선은 꼬리 때문에 상하 여백을 쓸 수 없습니다</div>' : ''}
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
        <div class="prop-row" style="gap:4px">
          <button class="prop-btn-full${labelShape==='pill'?' active':''}" id="label-shape-pill">Pill</button>
          <button class="prop-btn-full${labelShape==='box'?' active':''}" id="label-shape-box">Box</button>
          <button class="prop-btn-full${labelShape==='outline'?' active':''}" id="label-shape-outline">Outline</button>
          <button class="prop-btn-full${labelShape==='circle'?' active':''}" id="label-shape-circle">Circle</button>
          <button class="prop-btn-full${labelShape==='text'?' active':''}" id="label-shape-text">Text</button>
        </div>
        <div class="prop-color-row">
          <span class="prop-label">배경색</span>
          <div class="prop-color-swatch${currentBgColor==='transparent'?' swatch-none':''}" style="background:${currentBgColor==='transparent'?'transparent':currentBgColor}">
            <input type="color" id="label-bg-color" value="${currentBgColor==='transparent'?'#111111':currentBgColor}">
          </div>
          <input type="text" class="prop-color-hex" id="label-bg-hex" value="${currentBgColor==='transparent'?'':currentBgColor.replace('#','').toUpperCase()}" maxlength="7" placeholder="없음" aria-label="Color">
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
          <input type="text" class="prop-color-hex" id="bubble-bg-hex" value="${bubbleBgHex.replace('#','').toUpperCase()}" maxlength="7" aria-label="Color">
        </div>
        <div class="prop-row">
          <span class="prop-label">발신자 이름</span>
          <label class="prop-toggle" title="발신자 이름 표시 — 이름은 캔버스에서 더블클릭해 고친다">
            <input type="checkbox" id="bubble-show-sender" ${showSender ? 'checked' : ''}>
            <span class="prop-toggle-track"></span>
          </label>
        </div>
      </div>
    </div>

    <div id="icon-text-style-section" style="display:${isIconText?'block':'none'}">
      <div class="prop-section">
        <div class="prop-section-title">Icon Text</div>${isIconText ? /* ★S3V(2026-10-04) 방향 — 구분선 패널(prop-divider.js #dvd-dir-group)과 «같은 꼴·같은 그림»(지디 ⓑ).
             data-align 이 없어 정렬 배선은 건너뛴다. Icon Text 일 때만 «빈 문자열 밖»으로 나온다 — 다른 블럭 텍스트 패널 HTML 은 한 글자도 안 바뀐다(typo-section-ssot T1 골든). */ `
        <div class="prop-row">
          <span class="prop-label">방향</span>
          <div class="prop-align-group" id="itb-dir-group">
            <button class="prop-align-btn${!itbVertical?' active':''}" data-dir="horizontal" title="가로 — 아이콘 왼쪽 · 글 오른쪽">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="1" y1="7" x2="13" y2="7"/></svg>
              가로
            </button>
            <button class="prop-align-btn${itbVertical?' active':''}" data-dir="vertical" title="세로 — 아이콘 위 · 글 아래">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="7" y1="1" x2="7" y2="13"/></svg>
              세로
            </button>
          </div>
        </div>` : ''}
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
