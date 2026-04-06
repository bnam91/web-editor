import { propPanel, state } from './globals.js';

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

  const currentClass = ['tb-h1','tb-h2','tb-h3','tb-body','tb-caption','tb-label'].find(c => contentEl.classList.contains(c)) || 'tb-body';
  const rawBg = window.getComputedStyle(contentEl).backgroundColor;
  const currentBgColor = (!rawBg || rawBg === 'rgba(0, 0, 0, 0)' || rawBg === 'transparent') ? '#111111' : (rgbToHex(rawBg) || '#111111');
  const currentRadius = parseInt(contentEl.style.borderRadius) || 4;
  const isLabel = currentClass === 'tb-label';
  const labelPillPadT = parseInt(contentEl.style.paddingTop)    || 4;
  const labelPillPadB = parseInt(contentEl.style.paddingBottom) || 4;
  const labelPillH    = labelPillPadT + labelPillPadB;
  const currentAlign = isLabel ? (tb.style.textAlign || 'left') : (contentEl.style.textAlign || 'left');
  const currentSize  = parseInt(computed.fontSize) || 15;
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

  // 위치/크기
  const isAbsolute  = tb.style.position === 'absolute';
  const currentX    = parseInt(tb.style.left  || tb.dataset.offsetX || '0');
  const currentY    = parseInt(tb.style.top   || tb.dataset.offsetY || '0');
  const _tbRow      = tb.closest('.row');
  const currentW    = parseInt(_tbRow?.dataset.width) || Math.round(_tbRow?.offsetWidth || tb.offsetWidth);

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
        ${tb.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="navigator.clipboard.writeText('${tb.id}')">${tb.id}</span>` : ''}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">타입</div>
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
      <div class="prop-row">
        <span class="prop-label">정렬</span>
        <div class="prop-align-group">
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
      </div>
      <div class="prop-row">
        <span class="prop-label" style="width:auto;min-width:10px">X</span>
        <input type="number" class="prop-number" id="txt-x-number" value="${currentX}" style="flex:1;min-width:0">
        <span class="prop-label" style="width:auto;min-width:10px;margin-left:8px">Y</span>
        <input type="number" class="prop-number" id="txt-y-number" value="${currentY}" style="flex:1;min-width:0">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Typography</div>

      <span class="prop-field-label">Font</span>
      <div class="prop-row" style="gap:4px; margin-bottom:6px;">
        <select class="prop-select" id="txt-font-family" style="flex:1">
          <option value="" style="font-family:inherit"           ${currentFont===''?'selected':''}>기본 (시스템)</option>
          <optgroup label="── 한글 ──">
            <option value="'Pretendard', sans-serif"            ${currentFont.includes('Pretendard')?'selected':''}>Pretendard</option>
            <option value="'Noto Sans KR', sans-serif"          ${currentFont.includes('Noto Sans KR')?'selected':''}>Noto Sans KR</option>
            <option value="'Noto Serif KR', serif"              ${currentFont.includes('Noto Serif KR')?'selected':''}>Noto Serif KR</option>
          </optgroup>
          <optgroup label="── 영문 ──">
            <option value="'Inter', sans-serif"                 ${currentFont.includes('Inter')?'selected':''}>Inter</option>
            <option value="'Space Grotesk', sans-serif"         ${currentFont.includes('Space Grotesk')?'selected':''}>Space Grotesk</option>
            <option value="'Playfair Display', serif"           ${currentFont.includes('Playfair Display')?'selected':''}>Playfair Display</option>
          </optgroup>
          <optgroup label="── 시스템 ──">
            <option value="sans-serif"                          ${currentFont==='sans-serif'?'selected':''}>Sans-serif</option>
            <option value="serif"                               ${currentFont==='serif'?'selected':''}>Serif</option>
            <option value="monospace"                           ${currentFont==='monospace'?'selected':''}>Monospace</option>
          </optgroup>
        </select>
        <button id="txt-font-pin" title="즐겨찾기" style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;line-height:1;color:#888;flex-shrink:0;">⭐</button>
      </div>

      <div style="display:flex; gap:4px; margin-bottom:6px;">
        <select class="prop-select" id="txt-font-weight" style="flex:2">
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
        <input type="number" class="prop-number" id="txt-size-number" min="8" max="400" value="${currentSize}" style="flex:1;min-width:0">
      </div>

      <div style="display:flex; gap:4px; margin-bottom:6px;">
        <div class="prop-icon-input">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path fill="currentColor" d="M17.5 17a.5.5 0 0 1 0 1h-11a.5.5 0 0 1 0-1zm-5.25-9a.5.5 0 0 1 .476.347l2.25 7a.5.5 0 0 1-.952.306L13.494 14h-2.987l-.531 1.653a.5.5 0 0 1-.952-.306l2.25-7 .03-.075A.5.5 0 0 1 11.75 8zm-1.422 5h2.344L12 9.354zM17.5 6a.5.5 0 0 1 0 1h-11a.5.5 0 0 1 0-1z"/></svg>
          <input type="number" id="txt-lh-number" min="1" max="3" step="0.05" value="${currentLH}" aria-label="줄간격">
        </div>
        <div class="prop-icon-input">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path fill="currentColor" d="M6.5 6a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-1 0v-11a.5.5 0 0 1 .5-.5m11 0a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-1 0v-11a.5.5 0 0 1 .5-.5m-5.25 3a.5.5 0 0 1 .472.335l1.75 5a.5.5 0 1 1-.944.33l-.407-1.165H10.88l-.407 1.165a.5.5 0 1 1-.944-.33l1.75-5 .032-.072A.5.5 0 0 1 11.75 9zm-1.02 3.5h1.54L12 10.298z"/></svg>
          <input type="number" id="txt-ls-number" min="-10" max="40" step="0.5" value="${currentLS}" aria-label="자간">
        </div>
      </div>

      <div class="prop-row" style="gap:4px;">
        <div class="prop-style-group">
          <button class="prop-style-btn ${isBold?'active':''}" id="txt-bold-btn" title="굵게 (Bold / Cmd+B)"><b>B</b></button>
          <button class="prop-style-btn ${isItalic?'active':''}" id="txt-italic-btn" title="기울임 (Italic / Cmd+I)"><i>I</i></button>
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
      <div class="prop-section-title">크기</div>
      <div class="prop-row">
        <span class="prop-label">너비</span>
        <input type="range" class="prop-slider" id="txt-width-slider" min="80" max="860" step="4" value="${currentW}">
        <input type="number" class="prop-number" id="txt-width-number" min="80" max="860" value="${currentW}">
      </div>
    </div>

    <div class="prop-section" style="${isOverlayTb ? 'display:none' : ''}">
      <div class="prop-section-title">패딩</div>
      <div class="prop-row">
        <span class="prop-label">상하</span>
        <input type="range" class="prop-slider" id="txt-pv-slider" min="0" max="120" step="4" value="${currentPadT}">
        <input type="number" class="prop-number" id="txt-pv-number" min="0" max="120" value="${currentPadT}">
      </div>
      <div class="prop-ph-header">
        <span class="prop-section-title" style="margin-bottom:0">좌우</span>
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
        <div class="prop-section-title">태그 스타일</div>
        <div class="prop-row" style="gap:6px">
          <button class="prop-full-btn" id="label-shape-pill">Pill</button>
          <button class="prop-full-btn" id="label-shape-box">Box</button>
          <button class="prop-full-btn" id="label-shape-circle">Circle</button>
          <button class="prop-full-btn" id="label-shape-text">Text</button>
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

  const fontSel = document.getElementById('txt-font-family');

  /* 핀/최근 그룹 초기 갱신 → 동기 sync */
  _rebuildFontPinnedGroups(fontSel);
  _syncFontSelectValue(fontSel, currentFont);
  _updatePinButton(currentFont);

  /* 시스템 설치 폰트 비동기 로드 → 완료 후 다시 sync */
  _loadSystemFonts(fontSel).then(() => {
    _syncFontSelectValue(fontSel, currentFont);
  });

  /* 핀 버튼 */
  document.getElementById('txt-font-pin')?.addEventListener('click', () => {
    const sel = document.getElementById('txt-font-family');
    if (!sel) return;
    const val = sel.value;
    const key = 'goditor_font_pins';
    let pins = JSON.parse(localStorage.getItem(key) || '[]');
    if (pins.includes(val)) pins = pins.filter(p => p !== val);
    else pins.unshift(val);
    localStorage.setItem(key, JSON.stringify(pins));
    _rebuildFontPinnedGroups(sel);
    _updatePinButton(val);
  });

  /* 폰트 종류 */
  document.getElementById('txt-font-family').addEventListener('change', e => {
    window.pushHistory?.();
    const rawVal = e.target.value;
    contentEl.style.fontFamily = rawVal;
    contentEl.dataset.rawFont = rawVal;   // CSS 정규화 우회용 raw 저장
    _pushRecentFont(rawVal);
    _rebuildFontPinnedGroups(e.target);
    _syncFontSelectValue(e.target, rawVal);  // rebuild 후 올바른 옵션 재선택
    _updatePinButton(rawVal);
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
      window.pushHistory?.();
      // label(inline-block)은 부모 tb에 text-align 적용해야 블록 자체가 정렬됨
      if (contentEl.classList.contains('tb-label')) {
        tb.style.textAlign = btn.dataset.align;
      } else {
        contentEl.style.textAlign = btn.dataset.align;
      }
      propPanel.querySelectorAll('.prop-align-btn').forEach(b => b.classList.toggle('active', b===btn));
    });
  });

  /* Italic — 선택 영역이 있으면 해당 영역에만, 없으면 전체에 적용 */
  let _savedItalicSel = null;
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

  let _savedBoldSel = null;
  document.getElementById('txt-bold-btn').addEventListener('mousedown', () => {
    if (hasSel()) _savedBoldSel = window.getSelection().getRangeAt(0).cloneRange();
    else _savedBoldSel = null;
  });
  document.getElementById('txt-bold-btn').addEventListener('click', () => {
    if (_savedBoldSel) {
      applyExecCmd(_savedBoldSel, 'bold');
      _savedBoldSel = null;
    } else {
      const isNowBold = contentEl.style.fontWeight === '700' || contentEl.style.fontWeight === 'bold';
      contentEl.style.fontWeight = isNowBold ? '' : '700';
      document.getElementById('txt-bold-btn').classList.toggle('active', !isNowBold);
    }
    window.pushHistory();
  });

  document.getElementById('txt-italic-btn').addEventListener('mousedown', () => {
    if (hasSel()) _savedItalicSel = window.getSelection().getRangeAt(0).cloneRange();
    else _savedItalicSel = null;
  });
  document.getElementById('txt-italic-btn').addEventListener('click', () => {
    if (_savedItalicSel) {
      applyExecCmd(_savedItalicSel, 'italic');
      _savedItalicSel = null;
    } else {
      const isNowItalic = contentEl.style.fontStyle === 'italic';
      contentEl.style.fontStyle = isNowItalic ? '' : 'italic';
      document.getElementById('txt-italic-btn').classList.toggle('active', !isNowItalic);
    }
    window.pushHistory();
  });

  /* 폰트 크기 — 선택 영역이 있으면 해당 영역에만, 없으면 전체에 적용 */
  const sizeNumber = document.getElementById('txt-size-number');
  let _savedSizeSel = null;
  let _sizeSpan = null;

  const saveSizeSel = () => {
    if (hasSel()) { _savedSizeSel = window.getSelection().getRangeAt(0).cloneRange(); _sizeSpan = null; }
    else { _savedSizeSel = null; _sizeSpan = null; }
  };
  const applySizeToSel = (v) => {
    if (!_savedSizeSel) { contentEl.style.fontSize = v + 'px'; return; }
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
    if (!_savedColorSel) { contentEl.style.color = color; return; }
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
        if (row) {
          row.style.width     = v + 'px';
          row.style.maxWidth  = '100%';
          row.style.margin    = '0 auto';
          row.style.alignSelf = 'center';
          row.dataset.width   = v;
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
      xNumber.addEventListener('input', () => { tb.style.left = (parseInt(xNumber.value) || 0) + 'px'; tb.dataset.offsetX = xNumber.value; window.scheduleAutoSave?.(); });
      xNumber.addEventListener('change', () => window.pushHistory?.());
    }
    if (yNumber) {
      yNumber.addEventListener('input', () => { tb.style.top = (parseInt(yNumber.value) || 0) + 'px'; tb.dataset.offsetY = yNumber.value; window.scheduleAutoSave?.(); });
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
  const animBtn = document.getElementById('open-anim-btn');
  if (animBtn) animBtn.addEventListener('click', () => window.openAnimModal(tb));

  window.bindLayoutInput(tb);
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

function _rebuildFontPinnedGroups(selectEl) {
  if (!selectEl) return;
  // 기존 핀/최근 optgroup 제거 후 재생성
  selectEl.querySelectorAll('optgroup[data-recent], optgroup[data-pins]').forEach(g => g.remove());

  const pins   = JSON.parse(localStorage.getItem('goditor_font_pins')   || '[]');
  const recent = JSON.parse(localStorage.getItem('goditor_font_recent') || '[]');

  // 최근 사용 그룹 (있을 때만) — 먼저 삽입해서 핀 그룹이 그 위로 오게 함
  if (recent.length > 0) {
    const og = document.createElement('optgroup');
    og.label = '── 최근 사용 ──';
    og.dataset.recent = '1';
    recent.forEach(fam => {
      const opt = document.createElement('option');
      opt.value = fam;
      opt.textContent = '🕐 ' + _fontDisplayName(fam);
      og.appendChild(opt);
    });
    selectEl.insertBefore(og, selectEl.firstChild);
  }

  // 핀 그룹 (있을 때만) — 최상단
  if (pins.length > 0) {
    const og = document.createElement('optgroup');
    og.label = '── 핀 고정 ──';
    og.dataset.pins = '1';
    pins.forEach(fam => {
      const opt = document.createElement('option');
      opt.value = fam;
      opt.textContent = '⭐ ' + _fontDisplayName(fam);
      og.appendChild(opt);
    });
    selectEl.insertBefore(og, selectEl.firstChild);
  }
}

/* 정규화된 폰트값으로 select 옵션 매칭 (CSS 따옴표 변환 우회) */
function _syncFontSelectValue(selectEl, fontValue) {
  if (!selectEl || !selectEl.isConnected) return;
  // rawFont가 exact match이면 바로 사용
  if (fontValue) {
    selectEl.value = fontValue;
    if (selectEl.value === fontValue) return;
  }
  if (!fontValue) { selectEl.value = ''; return; }
  // 정규화 매칭: 따옴표 제거 + 첫 family 이름만 비교
  const norm = v => v.replace(/['"]/g, '').split(',')[0].trim().toLowerCase();
  const target = norm(fontValue);
  if (!target) { selectEl.value = ''; return; }
  for (const opt of selectEl.options) {
    if (norm(opt.value) === target) { selectEl.value = opt.value; return; }
  }
  selectEl.value = '';  // 매칭 없으면 기본
}

function _updatePinButton(fontValue) {
  const btn = document.getElementById('txt-font-pin');
  if (!btn) return;
  const pins = JSON.parse(localStorage.getItem('goditor_font_pins') || '[]');
  btn.style.color = pins.includes(fontValue) ? '#f5c518' : '#888';
}

/* ── 시스템 설치 폰트 동적 로드 ── */
async function _loadSystemFonts(selectEl) {
  if (!window.queryLocalFonts) return;
  try {
    const fonts = await window.queryLocalFonts();
    const families = [...new Set(fonts.map(f => f.family))].sort((a, b) => a.localeCompare(b, 'ko'));
    // 이미 추가된 경우 skip (showTextProperties 재호출 대비)
    if (selectEl.querySelector('optgroup[data-system]')) return;
    const og = document.createElement('optgroup');
    og.label = '── 시스템 설치 ──';
    og.dataset.system = '1';
    families.forEach(fam => {
      const opt = document.createElement('option');
      opt.value = `'${fam}', sans-serif`;
      opt.textContent = fam;
      opt.style.fontFamily = fam;
      og.appendChild(opt);
    });
    selectEl.appendChild(og);
  } catch (e) {
    // 퍼미션 거부 또는 미지원 환경 — 하드코딩 폴백 유지
  }
}

// Backward compat: classic scripts call these via window.*
window.showTextProperties = showTextProperties;
window.rgbToHex           = rgbToHex;
