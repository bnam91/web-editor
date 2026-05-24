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
let _els      = null;  // cached [data-el="*"] refs (rebuilt once with popover)
let _isDragging = false;  // true while user is mid-drag on solid spectrum/hue/alpha

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
      <div class="goya-cp-gradient-bar" data-el="gradBar" style="position:relative;">
        <div class="goya-cp-gradient-fill" data-el="gradFill"></div>
        <div class="goya-cp-grad-thumb is-active" data-el="gradThumbStart" data-stop-idx="0" title="Start stop" style="left:0%;"></div>
        <div class="goya-cp-grad-thumb" data-el="gradThumbEnd" data-stop-idx="1" title="End stop" style="left:100%;"></div>
      </div>
      <div class="goya-cp-grad-offset-row" style="display:flex;gap:8px;margin-top:4px;align-items:center;justify-content:space-between;font-size:10px;color:#888;">
        <span data-el="gradStartOffsetLabel">0%</span>
        <span data-el="gradEndOffsetLabel">100%</span>
      </div>
      <div class="goya-cp-gradient-opts">
        <select data-el="gradType">
          <option value="linear">Linear</option>
          <option value="radial">Radial</option>
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
      <div class="goya-cp-grad-stops" style="display:flex;gap:8px;margin-top:10px;align-items:center;">
        <span style="font-size:11px;color:#888;width:32px;">Start</span>
        <input type="color" data-el="gradStart" value="#ff5e3a" style="width:32px;height:24px;border:none;background:transparent;cursor:pointer;">
        <input type="text" class="goya-cp-hex" data-el="gradStartHex" maxlength="6" value="FF5E3A" style="flex:1;" aria-label="Start hex">
        <input type="text" data-el="gradStartAlpha" value="100" maxlength="3" title="Start opacity %" style="width:36px;font-size:11px;text-align:right;background:#1c1c1c;border:1px solid #2a2a2a;color:#ccc;padding:3px 4px;border-radius:3px;" aria-label="Start opacity">
        <span style="font-size:10px;color:#666;">%</span>
      </div>
      <div class="goya-cp-grad-stops" style="display:flex;gap:8px;margin-top:6px;align-items:center;">
        <span style="font-size:11px;color:#888;width:32px;">End</span>
        <input type="color" data-el="gradEnd" value="#1aa6ff" style="width:32px;height:24px;border:none;background:transparent;cursor:pointer;">
        <input type="text" class="goya-cp-hex" data-el="gradEndHex" maxlength="6" value="1AA6FF" style="flex:1;" aria-label="End hex">
        <input type="text" data-el="gradEndAlpha" value="100" maxlength="3" title="End opacity %" style="width:36px;font-size:11px;text-align:right;background:#1c1c1c;border:1px solid #2a2a2a;color:#ccc;padding:3px 4px;border-radius:3px;" aria-label="End opacity">
        <span style="font-size:10px;color:#666;">%</span>
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
  // perf: 자주 쓰는 [data-el] 노드를 한 번만 querySelector 해서 캐시
  // _syncSolidUI / _drag / gradient emit이 mousemove마다 querySelector를 14+회 호출하던 비용을 제거.
  _els = {};
  _pop.querySelectorAll('[data-el]').forEach(n => { _els[n.dataset.el] = n; });
  _wireEvents(_pop);
  return _pop;
}

/* ─── UI 업데이트 헬퍼 ─── */
// perf: querySelector 14+회 → 캐시된 _els 룩업으로 교체. transform/translate는
// 같은 값일 때 cssText 재할당을 건너뛰어 layout 재계산을 줄임.
function _syncSolidUI() {
  const s = _state;
  if (!s || !_els) return;
  const pureHex = hexFromHsv(s.h, 1, 1);
  const currentHex = hexFromHsv(s.h, s.s, s.v);
  // 스펙트럼 배경은 hue만 바뀌므로 캐시된 값과 다를 때만 갱신
  if (_els.spectrum._goyaBg !== pureHex) {
    _els.spectrum.style.background = pureHex;
    _els.spectrum._goyaBg = pureHex;
  }
  // reticle 위치/배경 (left,top % + bg color)
  const ret = _els.reticle;
  ret.style.left = (s.s * 100) + '%';
  ret.style.top  = ((1 - s.v) * 100) + '%';
  ret.style.background = currentHex;
  // hue thumb: 단일 transform으로 합치고 색은 hue만 영향
  const huePct = (s.h / 360) * 100;
  const ht = _els.hueThumb;
  ht.style.left = huePct + '%';
  ht.style.transform = `translate(${-huePct}%, -50%)`;
  const huePure = hexFromHsv(s.h, 1, 1);
  if (ht._goyaColor !== huePure) {
    ht.style.color = huePure;
    ht._goyaColor = huePure;
  }
  // alpha thumb
  const aPct = s.a * 100;
  const at = _els.alphaThumb;
  at.style.left = aPct + '%';
  at.style.transform = `translate(${-aPct}%, -50%)`;
  at.style.color = currentHex;
  // alpha 슬라이더 배경 CSS 변수
  const al = _els.alpha;
  if (al._goyaBase !== currentHex) {
    al.style.setProperty('--goya-cp-alpha-base', currentHex);
    al._goyaBase = currentHex;
  }
  // aria 속성: 드래그 중에는 마지막에 한 번만 업데이트하면 충분 — 매 프레임 setAttribute는 스킵
  if (!_isDragging) {
    _els.hue.setAttribute('aria-valuenow', Math.round(s.h));
    _els.alpha.setAttribute('aria-valuenow', Math.round(s.a * 100));
  }
  // 입력 필드 값: 포커스 시 사용자 입력 보존, 동일 값이면 스킵
  const hexUp = currentHex.slice(1).toUpperCase();
  const hexInput = _els.hex;
  if (document.activeElement !== hexInput && hexInput.value !== hexUp) hexInput.value = hexUp;
  const aInput = _els.alphaVal;
  const aStr = String(Math.round(s.a * 100));
  if (document.activeElement !== aInput && aInput.value !== aStr) aInput.value = aStr;
}

// perf: 드래그 중에는 'input' 이벤트만 발행해서 라이브 미리보기만 갱신,
// 'change' 이벤트(pushHistory를 트리거하는 commit 이벤트)는 mouseup에서 단 1회.
function _emitToTarget(hex, opts) {
  if (!_targetInput) return;
  _targetInput.value = hex;
  _targetInput.dispatchEvent(new Event('input', { bubbles: true }));
  // commit 이벤트는 명시적 요청 시(마우스업·키보드 confirm)만 발행
  if (opts && opts.commit) {
    _targetInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function _applySolidAndEmit(opts) {
  _syncSolidUI();
  const hex = hexFromHsv(_state.h, _state.s, _state.v);
  _emitToTarget(hex, opts);
}

/* ─── 드래그 헬퍼 (rAF throttle + commit on mouseup) ─── */
// perf: 드래그 중에는 'input' 만 발행하고 mouseup 에서 'change'를 1회 발행.
// 무거운 commit 작업(pushHistory, autoSave 등)이 매 프레임 트리거되는 것을 막는다.
function _drag(el, handler) {
  el.addEventListener('mousedown', e => {
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    let pendingFrame = false, lastEv = e;
    _isDragging = true;
    const flush = () => {
      pendingFrame = false;
      const x = Math.max(0, Math.min(1, (lastEv.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (lastEv.clientY - rect.top) / rect.height));
      handler(x, y, /*commit*/ false);
    };
    const move = ev => {
      lastEv = ev;
      if (pendingFrame) return;
      pendingFrame = true;
      requestAnimationFrame(flush);
    };
    flush(); // 클릭 즉시 1회
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      _isDragging = false;
      // mouseup 시 최종 좌표로 한 번 더 + commit 이벤트
      const x = Math.max(0, Math.min(1, (lastEv.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (lastEv.clientY - rect.top) / rect.height));
      handler(x, y, /*commit*/ true);
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
  _drag(_els.spectrum, (x, y, commit) => {
    _state.s = x;
    _state.v = 1 - y;
    _applySolidAndEmit(commit ? { commit: true } : undefined);
  });

  /* Hue (Solid) */
  _drag(_els.hue, (x, _y, commit) => {
    _state.h = x * 360;
    _applySolidAndEmit(commit ? { commit: true } : undefined);
  });

  /* Alpha (Solid) */
  _drag(_els.alpha, (x, _y, commit) => {
    _state.a = x;
    _applySolidAndEmit(commit ? { commit: true } : undefined);
  });

  /* Hex input (# 있어도 없어도 허용) */
  const hexInp = _els.hex;
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
  // perf: blur/change 시 commit 이벤트 발행 — 타이핑 도중에는 input 만, 확정 시 1회 commit
  hexInp.addEventListener('change', () => {
    if (_state) _applySolidAndEmit({ commit: true });
  });
  hexInp.addEventListener('blur', () => {
    hexInp.value = hexFromHsv(_state.h, _state.s, _state.v).slice(1).toUpperCase();
  });

  /* Alpha input (숫자만, %는 suffix label) */
  const alphaInp = _els.alphaVal;
  alphaInp.addEventListener('input', () => {
    const m = alphaInp.value.match(/(\d+)/);
    if (!m) return;
    const p = Math.max(0, Math.min(100, parseInt(m[1])));
    _state.a = p / 100;
    _syncSolidUI();
  });
  alphaInp.addEventListener('change', () => {
    if (_state) _applySolidAndEmit({ commit: true });
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

  /* Gradient — start/end stop, type, angle 입력 → CSS gradient + 메타 emit */
  const gradFill     = _els.gradFill;
  const gradStart    = _els.gradStart;
  const gradEnd      = _els.gradEnd;
  const gradStartHex = _els.gradStartHex;
  const gradEndHex   = _els.gradEndHex;
  const gradStartAlpha = _els.gradStartAlpha;
  const gradEndAlpha   = _els.gradEndAlpha;
  const gradType     = _els.gradType;
  const gradAngle    = _els.gradAngle;
  const gradBar      = _els.gradBar;
  const gradThumbStart = _els.gradThumbStart;
  const gradThumbEnd   = _els.gradThumbEnd;
  const gradStartOffsetLabel = _els.gradStartOffsetLabel;
  const gradEndOffsetLabel   = _els.gradEndOffsetLabel;
  // stop offset 상태 (0~1)
  let _gradStartOffset = 0;
  let _gradEndOffset   = 1;
  function _updateThumbPositions() {
    if (gradThumbStart) gradThumbStart.style.left = (_gradStartOffset * 100) + '%';
    if (gradThumbEnd)   gradThumbEnd.style.left   = (_gradEndOffset   * 100) + '%';
    if (gradStartOffsetLabel) gradStartOffsetLabel.textContent = Math.round(_gradStartOffset * 100) + '%';
    if (gradEndOffsetLabel)   gradEndOffsetLabel.textContent   = Math.round(_gradEndOffset   * 100) + '%';
  }
  function _setActiveThumb(idx) {
    gradThumbStart?.classList.toggle('is-active', idx === 0);
    gradThumbEnd?.classList.toggle('is-active', idx === 1);
  }
  function _bindThumbDrag(thumb, isEnd) {
    if (!thumb) return;
    thumb.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      thumb.classList.add('is-dragging');
      _setActiveThumb(isEnd ? 1 : 0);
      const onMove = (ev) => {
        const r = gradBar.getBoundingClientRect();
        let p = (ev.clientX - r.left) / r.width;
        p = Math.max(0, Math.min(1, p));
        if (isEnd) _gradEndOffset   = p;
        else       _gradStartOffset = p;
        _updateThumbPositions();
        _scheduleEmitGradient(false);
      };
      const onUp = () => {
        thumb.classList.remove('is-dragging');
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        _scheduleEmitGradient(true);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }
  _bindThumbDrag(gradThumbStart, false);
  _bindThumbDrag(gradThumbEnd,   true);
  _updateThumbPositions();
  const _aClamp = (v) => Math.max(0, Math.min(100, parseInt(v) || 0));
  const _hexToRgba = (hex, a) => {
    const h = (hex || '#000000').replace('#','');
    const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    return `rgba(${r},${g},${b},${(a/100).toFixed(3)})`;
  };

  function _buildGradientCSS() {
    const type = gradType.value;
    const angle = parseInt(gradAngle.value) || 90;
    const sHex = gradStart.value || '#ff5e3a';
    const eHex = gradEnd.value || '#1aa6ff';
    const sA = _aClamp(gradStartAlpha?.value ?? 100);
    const eA = _aClamp(gradEndAlpha?.value ?? 100);
    const s = sA < 100 ? _hexToRgba(sHex, sA) : sHex;
    const e = eA < 100 ? _hexToRgba(eHex, eA) : eHex;
    const sOff = Math.round(_gradStartOffset * 100);
    const eOff = Math.round(_gradEndOffset   * 100);
    if (type === 'radial') return `radial-gradient(circle, ${s} ${sOff}%, ${e} ${eOff}%)`;
    return `linear-gradient(${angle}deg, ${s} ${sOff}%, ${e} ${eOff}%)`;
  }

  // perf: 그라데이션 input은 rAF로 합쳐서 한 프레임에 1회만 emit.
  // 그리고 commit 이벤트(goya-cp:gradient-commit)는 'change'(네이티브 컬러피커 닫힘) 또는
  // 셀렉트(type/angle) 변경 시에만 발행 — pushHistory가 매 input마다 트리거되지 않도록.
  let _gradPending = false;
  let _gradPendingCommit = false;
  function _scheduleEmitGradient(commit) {
    if (commit) _gradPendingCommit = true;
    if (_gradPending) return;
    _gradPending = true;
    requestAnimationFrame(() => {
      _gradPending = false;
      const commitNow = _gradPendingCommit;
      _gradPendingCommit = false;
      _emitGradientNow(commitNow);
    });
  }
  function _emitGradientNow(commit) {
    const css = _buildGradientCSS();
    gradFill.style.background = css;
    if (!_targetInput) return;
    const sA = _aClamp(gradStartAlpha?.value ?? 100);
    const eA = _aClamp(gradEndAlpha?.value ?? 100);
    const detail = {
      css,
      type: gradType.value,
      angle: parseInt(gradAngle.value) || 90,
      stops: [
        { color: gradStart.value, offset: _gradStartOffset, opacity: sA / 100 },
        { color: gradEnd.value,   offset: _gradEndOffset,   opacity: eA / 100 },
      ],
      commit: !!commit,
    };
    _targetInput.dispatchEvent(new CustomEvent('goya-cp:gradient', { bubbles: true, detail }));
    if (commit) {
      _targetInput.dispatchEvent(new CustomEvent('goya-cp:gradient-commit', { bubbles: true, detail }));
    }
  }
  function _syncStartHex() { gradStartHex.value = gradStart.value.replace('#','').toUpperCase(); }
  function _syncEndHex()   { gradEndHex.value   = gradEnd.value.replace('#','').toUpperCase(); }

  // 네이티브 <input type="color"> 는 OS 피커에서 드래그 시 'input' 연속 발사,
  // 닫을 때 'change' 1회 발사 — 이 패턴을 활용해 commit 분리.
  gradStart.addEventListener('input',  () => { _syncStartHex(); _scheduleEmitGradient(false); });
  gradStart.addEventListener('change', () => { _scheduleEmitGradient(true); });
  gradEnd.addEventListener('input',    () => { _syncEndHex();   _scheduleEmitGradient(false); });
  gradEnd.addEventListener('change',   () => { _scheduleEmitGradient(true); });
  gradStartHex.addEventListener('input', () => {
    const v = gradStartHex.value.trim().replace(/^#/, '');
    if (/^[0-9a-f]{6}$/i.test(v)) { gradStart.value = '#' + v.toLowerCase(); _scheduleEmitGradient(false); }
  });
  gradStartHex.addEventListener('change', () => { _scheduleEmitGradient(true); });
  gradEndHex.addEventListener('input', () => {
    const v = gradEndHex.value.trim().replace(/^#/, '');
    if (/^[0-9a-f]{6}$/i.test(v)) { gradEnd.value = '#' + v.toLowerCase(); _scheduleEmitGradient(false); }
  });
  gradEndHex.addEventListener('change', () => { _scheduleEmitGradient(true); });
  // alpha inputs — input은 라이브, change는 commit
  gradStartAlpha?.addEventListener('input',  () => _scheduleEmitGradient(false));
  gradStartAlpha?.addEventListener('change', () => _scheduleEmitGradient(true));
  gradEndAlpha?.addEventListener('input',    () => _scheduleEmitGradient(false));
  gradEndAlpha?.addEventListener('change',   () => _scheduleEmitGradient(true));
  // type/angle 은 selectbox 'change'만 발생 — 항상 commit
  gradType.addEventListener('change',  () => _scheduleEmitGradient(true));
  gradAngle.addEventListener('change', () => _scheduleEmitGradient(true));
  // 탭 진입 시 초기 프리뷰
  pop.querySelector('.goya-cp-tab[data-tab="gradient"]').addEventListener('click', () => {
    gradFill.style.background = _buildGradientCSS();
  });
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

  // outside click close — composedPath로 swatch 포함 검사 + 충분한 지연으로 자기 mousedown 회피
  // ※ 이전 openPicker 호출이 남긴 outside-handler를 먼저 제거한다.
  //   (스와치 A→B 전환 시: A의 핸들러가 document(capture)에 살아 있으면, B를 여는 같은
  //    mousedown에서 A 핸들러가 "B는 A 바깥" 으로 판정 → 방금 연 B 팝오버를 즉시 닫아버린다.
  //    핸들러 참조만 덮어쓰고 removeEventListener를 안 해서 document에 핸들러가 누적되던 버그.)
  if (_outsideHandler) {
    document.removeEventListener('mousedown', _outsideHandler, true);
  }
  _outsideHandler = (ev) => {
    const path = typeof ev.composedPath === 'function' ? ev.composedPath() : [];
    if (_pop.contains(ev.target) || path.includes(_pop)) return;
    if (path.includes(swatch) || ev.target.closest('.prop-color-swatch') === swatch) return;
    _closePicker();
  };
  setTimeout(() => document.addEventListener('mousedown', _outsideHandler, true), 50);
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

/* ═══════════════════════════════════
   PROP-COLOR-FIELD HELPERS (Figma-style grouped swatch + hex + opacity)
═══════════════════════════════════ */
function _hex6(v) {
  if (!v) return '#000000';
  const s = String(v).replace('#','').trim();
  if (/^[0-9a-f]{6}$/i.test(s)) return '#' + s.toLowerCase();
  // rgb/rgba
  const m = String(v).match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const parts = m[1].split(',').map(x => parseInt(x));
    const [r,g,b] = parts;
    const to = n => Math.max(0, Math.min(255, n|0)).toString(16).padStart(2,'0');
    return '#' + to(r) + to(g) + to(b);
  }
  return '#000000';
}

export function parseAlphaFromColor(cssColor) {
  const v = String(cssColor || '').trim().toLowerCase();
  // 빈값/transparent는 alpha 0으로 인식 (기존엔 100을 반환해 hex만 보고 적용 불가)
  if (v === 'transparent' || v === '') return 0;
  const m = v.match(/rgba?\(([^)]+)\)/i);
  if (!m) return 100;
  const parts = m[1].split(',');
  if (parts.length !== 4) return 100;
  return Math.round(parseFloat(parts[3]) * 100);
}

export function colorFieldHTML({ idPrefix, hex, alpha = 100, placeholder = '', gradientCss = '' }) {
  // gradientCss가 있으면 swatch 배경을 그라데이션으로, picker/hex는 첫 stop 색
  const h = _hex6(hex);
  const hexUp = h.replace('#','').toUpperCase();
  const swatchBg = gradientCss || h;
  return `
    <div class="prop-color-field">
      <div class="prop-color-swatch" style="background:${swatchBg}">
        <input type="color" id="${idPrefix}-color" value="${h}">
      </div>
      <input type="text" class="prop-color-hex" id="${idPrefix}-hex" value="${hexUp}" maxlength="6" aria-label="Color"${placeholder ? ` placeholder="${placeholder}"` : ''}>
      <label class="prop-color-alpha" title="Opacity">
        <input type="text" class="prop-color-alpha-input" id="${idPrefix}-alpha" value="${alpha}" aria-label="Opacity">
        <span class="prop-color-alpha-suffix">%</span>
      </label>
    </div>
  `;
}

export function wireColorField(idPrefix, { initialAlpha = 100, onApply, onCommit } = {}) {
  const picker = document.getElementById(`${idPrefix}-color`);
  const hex    = document.getElementById(`${idPrefix}-hex`);
  const alpha  = document.getElementById(`${idPrefix}-alpha`);
  const swatch = picker?.closest('.prop-color-swatch');
  if (!picker || !hex || !alpha || !swatch) return null;

  let _a = initialAlpha;
  // alpha=0(투명)인 상태에서 색만 바꾸면 결과가 여전히 투명이라 적용 안 보임.
  // 사용자가 alpha 슬라이더를 명시적으로 건드리지 않은 경우에만 자동 복귀.
  let _userTouchedAlpha = false;
  const _bumpAlphaIfHidden = () => {
    if (!_userTouchedAlpha && _a === 0) {
      _a = 100;
      if (alpha) alpha.value = '100';
    }
  };

  const build = () => {
    const h = (picker.value || '#000000').replace('#','');
    const r = parseInt(h.slice(0,2), 16);
    const g = parseInt(h.slice(2,4), 16);
    const b = parseInt(h.slice(4,6), 16);
    const a = Math.max(0, Math.min(1, _a / 100));
    return a >= 1 ? picker.value : `rgba(${r},${g},${b},${a})`;
  };
  const apply = () => {
    const c = build();
    swatch.style.background = c;
    onApply?.(c);
  };

  picker.addEventListener('input', () => {
    hex.value = picker.value.replace('#','').toUpperCase();
    _bumpAlphaIfHidden();
    apply();
  });
  picker.addEventListener('change', () => onCommit?.());
  hex.addEventListener('input', () => {
    const v = hex.value.trim().replace(/^#/, '');
    if (/^[0-9a-f]{6}$/i.test(v)) {
      picker.value = '#' + v.toLowerCase();
      _bumpAlphaIfHidden();
      apply();
    }
  });
  hex.addEventListener('blur', () => {
    hex.value = (picker.value || '#000000').replace('#','').toUpperCase();
  });
  hex.addEventListener('change', () => {
    const v = hex.value.trim().replace(/^#/, '');
    if (/^[0-9a-f]{6}$/i.test(v)) onCommit?.();
  });
  alpha.addEventListener('input', () => {
    _userTouchedAlpha = true;
    const m = alpha.value.match(/(\d+)/);
    if (!m) return;
    _a = Math.max(0, Math.min(100, parseInt(m[1])));
    apply();
  });
  alpha.addEventListener('blur', () => { alpha.value = String(_a); });
  alpha.addEventListener('change', () => onCommit?.());

  return { getColor: build, getAlpha: () => _a, setHex: v => { picker.value = v; hex.value = v.replace('#','').toUpperCase(); apply(); } };
}

window.colorFieldHTML = colorFieldHTML;
window.wireColorField = wireColorField;
window.parseAlphaFromColor = parseAlphaFromColor;

export { openPicker, _closePicker as closePicker };
