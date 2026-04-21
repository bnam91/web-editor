/* ═══════════════════════════════════
   FIGMA-STYLE COLOR PICKER
   - Solid / Gradient / Image 기능 탭
   - Pattern / Video UI-only 플레이스홀더
   - Blend mode / Color contrast 버튼 (UI only)
   - 기존 <input type="color"> 스와치 클릭 가로채기
═══════════════════════════════════ */

/* ─── 유틸: color math ─── */
function hexToRgb(hex) {
  if (!hex || hex[0] !== '#') return { r: 0, g: 0, b: 0 };
  const h = hex.length === 4
    ? '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
    : hex;
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r, g, b) {
  const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}
function hsvToRgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if      (h <  60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else              { r = c; b = x; }
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}
function hexFromHsv(h, s, v) {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

/* ─── 싱글턴 상태 ─── */
let _pop      = null;  // popover element
let _state    = null;  // active picker state
let _targetInput = null;  // native <input type="color"> being proxied
let _outsideHandler = null;

function _closePicker() {
  if (!_pop) return;
  _pop.hidden = true;
  if (_outsideHandler) {
    document.removeEventListener('mousedown', _outsideHandler, true);
    _outsideHandler = null;
  }
  _targetInput = null;
  _state = null;
}

function _ensurePopover() {
  if (_pop) return _pop;
  _pop = document.createElement('div');
  _pop.className = 'goya-cp-popover';
  _pop.hidden = true;
  _pop.innerHTML = `
    <div class="goya-cp-header">
      <div class="goya-cp-tabs" role="tablist">
        <button class="goya-cp-tab active" data-tab="solid" title="Solid" aria-label="Solid">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <rect x="3" y="3" width="10" height="10" rx="1.5"/>
          </svg>
        </button>
        <button class="goya-cp-tab" data-tab="gradient" title="Gradient" aria-label="Gradient">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="goyaCpGradIcon" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="currentColor" stop-opacity="1"/>
                <stop offset="100%" stop-color="currentColor" stop-opacity="0.15"/>
              </linearGradient>
            </defs>
            <rect x="3" y="3" width="10" height="10" rx="1.5" fill="url(#goyaCpGradIcon)"/>
            <rect x="3" y="3" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1"/>
          </svg>
        </button>
        <button class="goya-cp-tab" data-tab="image" title="Image" aria-label="Image">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">
            <rect x="2.5" y="3" width="11" height="10" rx="1.3"/>
            <circle cx="6" cy="6.5" r="1" fill="currentColor" stroke="none"/>
            <path d="M13.5 10 10 7.5 4 12.5"/>
          </svg>
        </button>
      </div>
      <button class="goya-cp-headbtn" data-action="blend" title="블렌드 모드 (곧 지원)">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3">
          <circle cx="4.5" cy="6" r="3.2"/><circle cx="7.5" cy="6" r="3.2"/>
        </svg>
      </button>
      <button class="goya-cp-headbtn" data-action="contrast" title="색상 대비 (곧 지원)">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3">
          <circle cx="6" cy="6" r="4.5"/><path d="M6 1.5v9a4.5 4.5 0 0 0 0-9z" fill="currentColor"/>
        </svg>
      </button>
      <button class="goya-cp-headbtn" data-action="close" title="닫기">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
          <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
        </svg>
      </button>
    </div>

    <!-- Solid panel -->
    <div class="goya-cp-panel active" data-panel="solid">
      <div class="goya-cp-spectrum-wrap">
        <div class="goya-cp-spectrum" data-el="spectrum">
          <div class="goya-cp-reticle" data-el="reticle" style="left:50%;top:50%;background:#000;"></div>
        </div>
      </div>
      <div class="goya-cp-controls">
        <button class="goya-cp-dropper" data-el="dropper" type="button" aria-label="Sample color" title="Sample color">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M15.16 5.658a2.25 2.25 0 0 1 3.18.001l.155.17a2.25 2.25 0 0 1 0 2.84l-.154.172-1.696 1.692a1.5 1.5 0 0 1 .02 1.913l-.104.114a1.5 1.5 0 0 1-2.007.103l-.02-.018-4.443 4.447a2.24 2.24 0 0 1-1.716.65l-.814.815a1.5 1.5 0 0 1-2.121-2.121l.816-.818a2.25 2.25 0 0 1 .653-1.708l4.443-4.446a1.5 1.5 0 0 1 .088-2.025l.114-.103a1.5 1.5 0 0 1 1.91.015zm-7.544 8.959a1.25 1.25 0 0 0-.358 1.021c.021.197-.014.406-.154.546l-.958.96a.5.5 0 0 0 .708.706l.955-.956c.14-.14.352-.176.55-.153.364.042.745-.077 1.025-.356l4.438-4.442-1.767-1.767zm10.018-8.251a1.25 1.25 0 0 0-1.768 0l-1.782 1.78-.065.06a.87.87 0 0 1-1.165-.06.5.5 0 0 0-.707.707l3 3a.5.5 0 0 0 .628.064l.079-.064a.5.5 0 0 0 0-.707l-.004-.004a.873.873 0 0 1 .004-1.23l1.78-1.778a1.25 1.25 0 0 0 0-1.768" clip-rule="evenodd"/>
          </svg>
        </button>
        <div class="goya-cp-slider-stack">
          <div class="goya-cp-slider goya-cp-slider--hue" data-el="hue" role="slider" tabindex="0" aria-label="Hue" aria-valuemin="0" aria-valuemax="359" aria-valuenow="0">
            <div class="goya-cp-thumb" data-el="hueThumb" style="left:0%"></div>
          </div>
          <div class="goya-cp-slider goya-cp-slider--alpha" data-el="alpha" role="slider" tabindex="0" aria-label="Opacity" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">
            <div class="goya-cp-thumb" data-el="alphaThumb" style="left:100%"></div>
          </div>
        </div>
      </div>
      <div class="goya-cp-format-row">
        <div class="goya-cp-value-grid">
          <div class="goya-cp-format-select">
            <button class="goya-cp-format-trigger" data-el="formatBtn" type="button" aria-label="Color format">
              <span data-el="formatLabel">Hex</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M9.646 11.146a.5.5 0 0 1 .708 0L12 12.793l1.646-1.647a.5.5 0 0 1 .708.708l-2 2a.5.5 0 0 1-.708 0l-2-2a.5.5 0 0 1 0-.708" clip-rule="evenodd"/>
              </svg>
            </button>
          </div>
          <div class="goya-cp-hex-field">
            <input type="text" class="goya-cp-hex" data-el="hex" maxlength="6" value="000000" aria-label="Color">
          </div>
          <label class="goya-cp-opacity-field" title="Opacity">
            <input type="text" class="goya-cp-alpha-input" data-el="alphaVal" value="100" aria-label="Opacity">
            <span class="goya-cp-suffix">%</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Gradient panel -->
    <div class="goya-cp-panel" data-panel="gradient">
      <div class="goya-cp-gradient-bar" data-el="gradBar">
        <div class="goya-cp-gradient-fill" data-el="gradFill"></div>
      </div>
      <div class="goya-cp-gradient-opts">
        <select data-el="gradType">
          <option value="linear">Linear</option>
          <option value="radial">Radial</option>
          <option value="conic">Conic</option>
        </select>
        <select data-el="gradAngle">
          <option value="0">0°</option>
          <option value="45">45°</option>
          <option value="90" selected>90°</option>
          <option value="135">135°</option>
          <option value="180">180°</option>
          <option value="225">225°</option>
          <option value="270">270°</option>
          <option value="315">315°</option>
        </select>
      </div>
      <div class="goya-cp-spectrum" data-el="gradSpectrum" style="margin-top:10px;">
        <div class="goya-cp-reticle" data-el="gradReticle" style="left:50%;top:50%"></div>
      </div>
      <div class="goya-cp-sliders">
        <div class="goya-cp-slider goya-cp-slider--hue" data-el="gradHue">
          <div class="goya-cp-thumb" data-el="gradHueThumb" style="left:0%"></div>
        </div>
      </div>
      <div class="goya-cp-inputs">
        <button class="goya-cp-chit" data-el="gradChit" aria-label="Gradient stop color" type="button" style="background:#000000;"></button>
        <div class="goya-cp-hex-field">
          <input type="text" class="goya-cp-hex" data-el="gradHex" maxlength="6" value="000000" aria-label="Color hex">
        </div>
        <label class="goya-cp-opacity-field">
          <input type="text" class="goya-cp-alpha-input" data-el="gradAlpha" value="100" aria-label="Opacity">
          <span class="goya-cp-suffix">%</span>
        </label>
      </div>
    </div>

    <!-- Image panel -->
    <div class="goya-cp-panel" data-panel="image">
      <div class="goya-cp-image-zone" data-el="imgZone">
        이미지를 클릭하거나<br>드래그해서 업로드
      </div>
      <div class="goya-cp-image-opts">
        <select data-el="imgFit">
          <option value="fill">Fill</option>
          <option value="fit">Fit</option>
          <option value="crop">Crop</option>
          <option value="tile">Tile</option>
        </select>
      </div>
    </div>

  `;
  document.body.appendChild(_pop);
  _wireEvents(_pop);
  return _pop;
}

/* ─── UI 업데이트 헬퍼 ─── */
function _syncSolidUI() {
  const s = _state;
  if (!s) return;
  const q = sel => _pop.querySelector(`[data-el="${sel}"]`);
  const spec = q('spectrum');
  const pureHex = hexFromHsv(s.h, 1, 1);
  spec.style.background = pureHex;
  const ret = q('reticle');
  ret.style.left = (s.s * 100) + '%';
  ret.style.top  = ((1 - s.v) * 100) + '%';
  const currentHex = hexFromHsv(s.h, s.s, s.v);
  ret.style.background = currentHex;
  const huePct = (s.h / 360) * 100;
  q('hueThumb').style.left = huePct + '%';
  q('hueThumb').style.transform = `translate(${-huePct}%, -50%)`;
  q('hueThumb').style.color = hexFromHsv(s.h, 1, 1);
  const aPct = s.a * 100;
  q('alphaThumb').style.left = aPct + '%';
  q('alphaThumb').style.transform = `translate(${-aPct}%, -50%)`;
  q('alphaThumb').style.color = currentHex;
  q('hue').setAttribute('aria-valuenow', Math.round(s.h));
  q('alpha').setAttribute('aria-valuenow', Math.round(s.a * 100));
  const slider = q('alpha');
  slider.style.setProperty('--goya-cp-alpha-base', currentHex);
  const hexInput = q('hex');
  const hexUp = currentHex.slice(1).toUpperCase();
  if (document.activeElement !== hexInput) hexInput.value = hexUp;
  const aInput = q('alphaVal');
  const aStr = String(Math.round(s.a * 100));
  if (document.activeElement !== aInput) aInput.value = aStr;
}

function _emitToTarget(hex) {
  if (!_targetInput) return;
  _targetInput.value = hex;
  _targetInput.dispatchEvent(new Event('input', { bubbles: true }));
  _targetInput.dispatchEvent(new Event('change', { bubbles: true }));
}

function _applySolidAndEmit() {
  _syncSolidUI();
  const hex = hexFromHsv(_state.h, _state.s, _state.v);
  _emitToTarget(hex);
}

/* ─── 드래그 헬퍼 ─── */
function _drag(el, handler) {
  el.addEventListener('mousedown', e => {
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    const move = ev => {
      const x = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
      handler(x, y);
    };
    move(e);
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
}

function _wireEvents(pop) {
  /* 탭 전환 */
  pop.querySelectorAll('.goya-cp-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const name = tab.dataset.tab;
      pop.querySelectorAll('.goya-cp-tab').forEach(t => t.classList.toggle('active', t === tab));
      pop.querySelectorAll('.goya-cp-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === name));
    });
  });

  /* 헤더 버튼 */
  pop.querySelectorAll('.goya-cp-headbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const act = btn.dataset.action;
      if (act === 'close') { _closePicker(); return; }
      // blend / contrast — UI only, 토글만
      if (act === 'blend' || act === 'contrast') {
        btn.classList.toggle('active');
      }
    });
  });

  /* Spectrum (Solid) */
  const spec = pop.querySelector('[data-el="spectrum"]');
  _drag(spec, (x, y) => {
    _state.s = x;
    _state.v = 1 - y;
    _applySolidAndEmit();
  });

  /* Hue (Solid) */
  _drag(pop.querySelector('[data-el="hue"]'), (x) => {
    _state.h = x * 360;
    _applySolidAndEmit();
  });

  /* Alpha (Solid) */
  _drag(pop.querySelector('[data-el="alpha"]'), (x) => {
    _state.a = x;
    _applySolidAndEmit();
  });

  /* Hex input (# 있어도 없어도 허용) */
  const hexInp = pop.querySelector('[data-el="hex"]');
  const _normalizeHex = v => {
    v = v.trim().replace(/^#/, '');
    return /^[0-9a-fA-F]{6}$/.test(v) ? ('#' + v) : null;
  };
  hexInp.addEventListener('input', () => {
    const norm = _normalizeHex(hexInp.value);
    if (!norm) return;
    const { r, g, b } = hexToRgb(norm);
    const { h, s, v: val } = rgbToHsv(r, g, b);
    _state.h = h; _state.s = s; _state.v = val;
    _applySolidAndEmit();
  });
  hexInp.addEventListener('blur', () => {
    hexInp.value = hexFromHsv(_state.h, _state.s, _state.v).slice(1).toUpperCase();
  });

  /* Alpha input (숫자만, %는 suffix label) */
  const alphaInp = pop.querySelector('[data-el="alphaVal"]');
  alphaInp.addEventListener('input', () => {
    const m = alphaInp.value.match(/(\d+)/);
    if (!m) return;
    const p = Math.max(0, Math.min(100, parseInt(m[1])));
    _state.a = p / 100;
    _syncSolidUI();
  });
  alphaInp.addEventListener('blur', () => {
    alphaInp.value = String(Math.round(_state.a * 100));
  });

  /* Dropper (헤더) */
  const dropper = pop.querySelector('[data-el="dropper"]');
  if (!window.EyeDropper) { dropper.disabled = true; dropper.title = '이 브라우저는 EyeDropper 미지원'; }
  dropper.addEventListener('click', async () => {
    if (!window.EyeDropper) return;
    try {
      const ed = new window.EyeDropper();
      const res = await ed.open();
      const { r, g, b } = hexToRgb(res.sRGBHex);
      const { h, s, v } = rgbToHsv(r, g, b);
      _state.h = h; _state.s = s; _state.v = v;
      _applySolidAndEmit();
    } catch (_) { /* user cancelled */ }
  });

  /* Image upload */
  const imgZone = pop.querySelector('[data-el="imgZone"]');
  imgZone.addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => {
      const file = inp.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        imgZone.style.backgroundImage = `url('${e.target.result}')`;
        imgZone.classList.add('has-image');
        imgZone.innerHTML = '';
        // target 입력이 image 모드를 지원하는 필드라면 여기서 이벤트 발행 가능
        _targetInput?.dispatchEvent(new CustomEvent('goya-cp:image', {
          bubbles: true, detail: { src: e.target.result, fit: pop.querySelector('[data-el="imgFit"]').value }
        }));
      };
      reader.readAsDataURL(file);
    };
    inp.click();
  });

  /* Gradient bar — 간단히 현재 hex + 두 번째 고정 색 */
  const gradBar = pop.querySelector('[data-el="gradBar"]');
  const gradFill = pop.querySelector('[data-el="gradFill"]');
  const _updateGradFill = () => {
    const hex = hexFromHsv(_state?.h ?? 0, _state?.s ?? 1, _state?.v ?? 1);
    gradFill.style.background = `linear-gradient(to right, ${hex}, transparent)`;
  };
  gradBar.addEventListener('click', _updateGradFill);
}

/* ─── 위치 계산 ─── */
function _position(anchor) {
  const rect = anchor.getBoundingClientRect();
  const popRect = _pop.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  const gap = 6;
  let left = rect.right + gap;
  let top  = rect.top;
  // 오른쪽 공간 부족하면 왼쪽으로
  if (left + popRect.width + gap > vw) left = rect.left - popRect.width - gap;
  // 왼쪽도 안 되면 위/아래
  if (left < gap) { left = Math.max(gap, Math.min(vw - popRect.width - gap, rect.left)); top = rect.bottom + gap; }
  // 하단 잘리면 위로
  if (top + popRect.height + gap > vh) top = Math.max(gap, vh - popRect.height - gap);
  _pop.style.left = left + 'px';
  _pop.style.top  = top  + 'px';
}

/* ─── 공개 API ─── */
function openPicker(swatch) {
  _ensurePopover();
  const nativeInp = swatch.querySelector('input[type="color"]');
  if (!nativeInp) return;

  _targetInput = nativeInp;
  const currentHex = nativeInp.value || '#000000';
  const { r, g, b } = hexToRgb(currentHex);
  const { h, s, v } = rgbToHsv(r, g, b);
  _state = { h, s, v, a: 1 };

  // solid 탭으로 초기화
  _pop.querySelectorAll('.goya-cp-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'solid'));
  _pop.querySelectorAll('.goya-cp-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === 'solid'));

  _pop.hidden = false;
  _position(swatch);
  _syncSolidUI();

  // outside click close
  _outsideHandler = (ev) => {
    if (_pop.contains(ev.target)) return;
    if (ev.target.closest('.prop-color-swatch') === swatch) return;
    _closePicker();
  };
  setTimeout(() => document.addEventListener('mousedown', _outsideHandler, true), 0);
}

/* ─── 스와치 클릭 델리게이션 ─── */
document.addEventListener('mousedown', (e) => {
  const swatch = e.target.closest('.prop-color-swatch');
  if (!swatch) return;
  const inp = swatch.querySelector('input[type="color"]');
  if (!inp) return;
  // 네이티브 컬러 피커 차단
  e.preventDefault();
  e.stopPropagation();
  openPicker(swatch);
}, true);

/* 네이티브 <input type="color"> 직접 클릭도 차단 (swatch 없이 쓰는 경우) */
document.addEventListener('click', (e) => {
  const inp = e.target.closest?.('input[type="color"]');
  if (!inp) return;
  const swatch = inp.closest('.prop-color-swatch');
  if (!swatch) return;
  e.preventDefault();
  e.stopPropagation();
}, true);

window.openGoyaColorPicker = openPicker;
window.closeGoyaColorPicker = _closePicker;

export { openPicker, _closePicker as closePicker };
