/* ═══════════════════════════════════
   FIGMA-STYLE COLOR PICKER
   - Solid / Gradient / Image 기능 탭
   - Pattern / Video UI-only 플레이스홀더
   - Blend mode / Color contrast 버튼 (UI only)
   - 기존 <input type="color"> 스와치 클릭 가로채기
═══════════════════════════════════ */

import { parseGradientStrict } from './gradient-model.js';

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
        <button class="goya-cp-tab active" data-tab="solid" aria-label="단색" data-tip="단색 채우기" data-tip-base="단색 채우기">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <rect x="3" y="3" width="10" height="10" rx="1.5"/>
          </svg>
        </button>
        <button class="goya-cp-tab" data-tab="gradient" aria-label="그라데이션" data-tip="그라데이션 채우기 — 누르면 바로 적용" data-tip-base="그라데이션 채우기 — 누르면 바로 적용">
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
        <button class="goya-cp-tab" data-tab="image" aria-label="이미지" data-tip="이미지 채우기 — 누르면 바둑판 표시 후 이미지 선택" data-tip-base="이미지 채우기 — 누르면 바둑판 표시 후 이미지 선택">
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
            <input type="text" class="goya-cp-hex" data-el="hex" maxlength="7" value="000000" aria-label="Color">
          </div>
          <label class="goya-cp-opacity-field" title="Opacity">
            <input type="text" class="goya-cp-alpha-input" data-el="alphaVal" value="100" aria-label="Opacity">
            <span class="goya-cp-suffix">%</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Gradient panel — N-stop bar + angle dial (2026-09 재설계) -->
    <div class="goya-cp-panel" data-panel="gradient">
      <div class="goya-cp-gradient-bar" data-el="gradBar" title="더블클릭으로 스톱 추가">
        <div class="goya-cp-gradient-fill" data-el="gradFill"></div>
      </div>
      <div class="goya-cp-grad-hint">더블클릭으로 스톱 추가 · 드래그로 위치 이동</div>

      <div class="goya-cp-grad-controls-row" data-el="gradControlsRow">
        <div class="goya-cp-angle-dial" data-el="gradAngleDial" title="드래그로 각도 조정">
          <div class="goya-cp-angle-needle" data-el="gradAngleNeedle"></div>
        </div>
        <div class="goya-cp-angle-num-field">
          <input type="number" data-el="gradAngleNum" min="0" max="360" value="90" aria-label="각도">
          <span class="goya-cp-suffix">°</span>
        </div>
        <select data-el="gradType" class="goya-cp-grad-type-select">
          <option value="linear">Linear</option>
          <option value="radial">Radial</option>
        </select>
      </div>

      <div class="goya-cp-grad-stop-editor" data-el="gradStopEditor">
        <input type="color" data-el="gradStopColor" value="#ff5e3a" aria-label="스톱 색">
        <input type="text" class="goya-cp-hex" data-el="gradStopHex" maxlength="7" value="FF5E3A" aria-label="스톱 hex">
        <div class="goya-cp-grad-opacity-field" title="스톱 투명도">
          <input type="range" data-el="gradStopOpacity" min="0" max="100" value="100" aria-label="스톱 투명도">
          <span data-el="gradStopOpacityLabel">100%</span>
        </div>
        <button type="button" class="goya-cp-grad-stop-del" data-el="gradStopDel" title="스톱 삭제(최소 2개)">×</button>
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
  // C12: native input[type=color]은 alpha 비지원 → dataset.cpAlpha(0~100)에 실어
  // 수신측(wireColorField)이 'input' 핸들러에서 읽어 _a를 동기화하게 한다.
  // (CustomEvent 신설 시 기존 solid 'input' 경로와 이중 적용 위험 → dataset 방식이 더 안전)
  if (opts && typeof opts.alpha === 'number') {
    _targetInput.dataset.cpAlpha = String(Math.round(Math.max(0, Math.min(1, opts.alpha)) * 100));
  }
  _targetInput.value = hex;
  _targetInput.dispatchEvent(new Event('input', { bubbles: true }));
  // commit 이벤트는 명시적 요청 시(마우스업·키보드 confirm)만 발행
  if (opts && opts.commit) {
    _targetInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/* 투명(알파 0)에서 «색을 고르면» 불투명으로 — 안 그러면 고른 색이 계속 안 보인다(wireColorField _bumpAlphaIfHidden 과 같은 뜻).
   투명 단색 복귀(0919 QA) 뒤·투명으로 열린 피커에서만. 알파를 직접 만지면 해제. */
function _unhideTransparentOnColorPick() {
  if (_state && _state.transparentHidden && _state.a === 0) _state.a = 1;
  if (_state) _state.transparentHidden = false;
}

function _applySolidAndEmit(opts) {
  if (_state && !(opts && opts.fromTab)) _state.solidEdited = true;
  _syncSolidUI();
  const hex = hexFromHsv(_state.h, _state.s, _state.v);
  // C12: solid 피커의 alpha를 함께 내려보낸다 (target은 native라 hex만 받지만 dataset로 alpha 전달)
  _emitToTarget(hex, { ...(opts || {}), alpha: _state.a });
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

/* ─── 탭: «보여주기»와 «적용하기»를 나눈다 (0918 picker) ───
   _showTab   = UI만(탭 active·패널 전환). openPicker 초기화·seed 복원이 쓴다 → 열기만 해선 문서가 안 바뀐다.
   _activateTab(= _wireEvents 안) = 사용자가 탭을 «눌렀을 때» 전용. 모드가 바뀌면 그 모드로 즉시 1회 커밋
   (피그마처럼: 그라데이션 탭 = 바로 그라데이션, 솔리드 탭 = 마지막 단색, 이미지 탭 = 바둑판).
   ⛔seed/openPicker 가 _activateTab 을 부르면 «열기만 해도» 기록이 쌓인다 — 반드시 _showTab. */
const CP_MODES = ['solid', 'gradient', 'image'];
function _showTab(name) {
  if (!_pop) return;
  _pop.querySelectorAll('.goya-cp-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  _pop.querySelectorAll('.goya-cp-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === name));
}
/* 대상 능력 게이트 — native input 의 dataset.cpModes('solid,gradient,image').
   ★속성이 없으면 'solid' 만 연다: 그라데이션/이미지를 «받는 쪽»이 없는 필드에서 탭을 눌러도
   아무 일도 안 일어나던 것(텍스트 등 약 40개 필드)을 없앤다. 받는 쪽은 스스로 선언한다
   (wireColorField onGradient → 자동, prop-shape/prop-page/텍스트 → 직접). */
function _targetModes(inp) {
  const raw = (inp && inp.dataset && inp.dataset.cpModes) || 'solid';
  const set = new Set(raw.split(',').map(s => s.trim()).filter(Boolean));
  set.add('solid');
  return set;
}
const _MODE_LABEL = { gradient: '그라데이션', image: '이미지' };
function _applyModeGate(inp) {
  if (!_pop) return;
  const modes = _targetModes(inp);
  const note = (inp && inp.dataset && inp.dataset.cpModesNote) || '';
  _pop.querySelectorAll('.goya-cp-tab').forEach(t => {
    const ok = modes.has(t.dataset.tab);
    t.disabled = !ok;
    t.setAttribute('aria-disabled', ok ? 'false' : 'true');
    t.dataset.tip = ok ? (t.dataset.tipBase || '') : (note || `이 항목은 ${_MODE_LABEL[t.dataset.tab] || t.dataset.tab} 채우기를 지원하지 않아요`);
  });
  return modes;
}

function _wireEvents(pop) {
  /* 탭 전환 — 클릭 = 모드 전환 + 즉시 커밋 (아래 _activateTab, 그라데이션 클로저가 필요해 맨 끝에서 배선) */

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
    _unhideTransparentOnColorPick();
    _state.s = x;
    _state.v = 1 - y;
    _applySolidAndEmit(commit ? { commit: true } : undefined);
  });

  /* Hue (Solid) */
  _drag(_els.hue, (x, _y, commit) => {
    _unhideTransparentOnColorPick();
    _state.h = x * 360;
    _applySolidAndEmit(commit ? { commit: true } : undefined);
  });

  /* Alpha (Solid) */
  _drag(_els.alpha, (x, _y, commit) => {
    if (_state) _state.transparentHidden = false;   // 알파를 직접 만지면 그 값이 정본
    _state.a = x;
    _applySolidAndEmit(commit ? { commit: true } : undefined);
  });

  /* Hex input (# 있어도 없어도 허용) — 배선은 wireHexText 한 자리에서 온다.
     ⛔여기에 input/blur/change 를 손으로 다시 적지 마라: 그게 이 파일이 앓던 병(사본 드리프트)이다.
     perf: 타이핑 도중에는 onApply(=input) 만, 확정 시 onCommit 1회. */
  const hexInp = _els.hex;
  wireHexText(hexInp, {
    parse: parseHex6,
    format: formatHex6,
    getCurrent: () => (_state ? hexFromHsv(_state.h, _state.s, _state.v) : null),
    onApply: (norm) => {
      const { r, g, b } = hexToRgb(norm);
      const { h, s, v: val } = rgbToHsv(r, g, b);
      _unhideTransparentOnColorPick();
      _state.h = h; _state.s = s; _state.v = val;
      _applySolidAndEmit();
    },
    onCommit: () => { if (_state) _applySolidAndEmit({ commit: true }); },
  });

  /* Alpha input (숫자만, %는 suffix label) */
  const alphaInp = _els.alphaVal;
  alphaInp.addEventListener('input', () => {
    const m = alphaInp.value.match(/(\d+)/);
    if (!m) return;
    const p = Math.max(0, Math.min(100, parseInt(m[1])));
    _state.transparentHidden = false;
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
      _unhideTransparentOnColorPick();
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
        // target 입력이 image 모드를 지원하는 필드(dataset.cpModes 에 image)면 받는다 — 업로드 = 확정 1회
        if (_state) _state.mode = 'image';
        _targetInput?.dispatchEvent(new CustomEvent('goya-cp:image', {
          bubbles: true, detail: { src: e.target.result, fit: pop.querySelector('[data-el="imgFit"]').value, commit: true }
        }));
      };
      reader.readAsDataURL(file);
    };
    inp.click();
  });

  /* Gradient — N-stop bar(드래그 이동·더블클릭 추가) + 각도 다이얼 → CSS gradient + 메타 emit.
     2026-09 재설계: 이전엔 start/end 고정 2-stop이었다. detail.stops는 애초에 가변 배열로
     소비되고 있었다(prop-shape/page/banner02/comparison 전부 stops.length를 순회) — 그래서
     여기 UI만 N-stop으로 확장하면 수신측 변경 없이 그대로 호환된다. */
  const gradFill   = _els.gradFill;
  const gradBar    = _els.gradBar;
  const gradType   = _els.gradType;
  const gradAngleDial   = _els.gradAngleDial;
  const gradAngleNeedle = _els.gradAngleNeedle;
  const gradAngleNum    = _els.gradAngleNum;
  const gradStopColor   = _els.gradStopColor;
  const gradStopHex     = _els.gradStopHex;
  const gradStopOpacity = _els.gradStopOpacity;
  const gradStopOpacityLabel = _els.gradStopOpacityLabel;
  const gradStopDel     = _els.gradStopDel;
  const gradControlsRow = _els.gradControlsRow;

  /* 첫 진입 기본값 = «지금 색 100% → 같은 색 0%» (현빈 확정 2026-09-19).
     지금 색 = 솔리드 상태(_state.h/s/v). alpha(_state.a)는 무시하고 1→0 으로 고정한다 —
     alpha 0 인 단색에서 만들어도 첫 스톱이 보이게. */
  const _defaultGradStops = () => {
    const cur = _state ? hexFromHsv(_state.h, _state.s, _state.v) : '#000000';
    return [
      { color: cur, offset: 0, opacity: 1 },
      { color: cur, offset: 1, opacity: 0 },
    ];
  };
  // D6: grad 상태를 per-target(openPicker마다 새 _state)으로 격리 — 스와치 간 누수 방지.
  const _grad = () => (_state && (_state.grad ??= { stops: _defaultGradStops(), selectedIdx: 0 })) || { stops: _defaultGradStops(), selectedIdx: 0 };
  const _aClamp = (v) => Math.max(0, Math.min(100, parseInt(v) || 0));
  const _hexToRgba = (hex, a) => {
    const h = (hex || '#000000').replace('#','');
    const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    return `rgba(${r},${g},${b},${(a/100).toFixed(3)})`;
  };
  const _lerpHex = (h1, h2, t) => {
    const a = hexToRgb(_hex6(h1)), b = hexToRgb(_hex6(h2));
    return rgbToHex(a.r + (b.r-a.r)*t, a.g + (b.g-a.g)*t, a.b + (b.b-a.b)*t);
  };
  // CSS/detail 로 내보낼 때만 offset 오름차순 정렬 — 내부 g.stops 순서(=드래그 중 index 안정성)는 안 건드린다.
  const _sortedStops = (g) => g.stops.map(s => ({ ...s })).sort((a, b) => a.offset - b.offset);
  // 내부 selectedIdx → 정렬(내보내기) 순서 인덱스. _sortedStops 와 같은 안정 정렬.
  const _sortedSelIdx = () => {
    const g = _grad();
    const order = g.stops.map((s, i) => ({ o: s.offset, i })).sort((a, b) => a.o - b.o);
    return Math.max(0, order.findIndex(e => e.i === g.selectedIdx));
  };
  const _currentAngle = () => Math.max(0, Math.min(360, parseInt(gradAngleNum?.value) || 0));

  function _buildGradientCSS() {
    const type = gradType.value;
    const angle = _currentAngle();
    const sorted = _sortedStops(_grad());
    const parts = sorted.map(s => {
      const aPct = _aClamp((s.opacity ?? 1) * 100);
      const col = aPct < 100 ? _hexToRgba(s.color, aPct) : s.color;
      return `${col} ${Math.round((s.offset || 0) * 100)}%`;
    });
    if (type === 'radial') return `radial-gradient(circle, ${parts.join(', ')})`;
    return `linear-gradient(${angle}deg, ${parts.join(', ')})`;
  }

  // perf: 그라데이션 input은 rAF로 합쳐서 한 프레임에 1회만 emit.
  // 그리고 commit 이벤트(goya-cp:gradient-commit)는 'change'/mouseup/select 변경 시에만 발행
  // — pushHistory가 매 프레임 트리거되지 않도록.
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
  /* 0920 polish1(T-059): 스탑 hex/각도 칸의 'change' 는 blur(=탭 버튼 mousedown)에서 «늦게» 온다.
     실측 순서 — tab:mousedown → hex:change(rAF 예약) → 솔리드 적용 → tab:click → rAF 그라데이션 커밋.
     그래서 hex 를 치고 곧바로 Solid 를 누르면 탭만 바뀌고 캔버스·state 는 그라데이션으로 남았다.
     ⇒ 그라데이션 방출은 «지금 모드가 그라데이션일 때»만. 모드는 _activateTab/seed 가 정한다
     (스톱 값 자체는 'input' 에서 이미 _grad() 에 들어가 있어, 다시 그라데이션 탭으로 오면 친 색 그대로다). */
  function _emitGradientNow(commit) {
    if (_state && _state.mode !== 'gradient') return;
    const css = _buildGradientCSS();
    gradFill.style.background = _barFillCSS();
    if (!_targetInput) return;
    const detail = {
      css,
      type: gradType.value,
      angle: _currentAngle(),
      stops: _sortedStops(_grad()).map(s => ({ color: s.color, offset: s.offset, opacity: (s.opacity == null) ? 1 : s.opacity })),
      commit: !!commit,
      // 0918 canvasgrad: 선택 스탑(정렬 인덱스) — 캔버스 바가 같은 칩을 선택 표시한다.
      selectedIdx: _sortedSelIdx(),
    };
    _targetInput.dispatchEvent(new CustomEvent('goya-cp:gradient', { bubbles: true, detail }));
    if (commit) {
      _targetInput.dispatchEvent(new CustomEvent('goya-cp:gradient-commit', { bubbles: true, detail }));
    }
  }

  // ── 스톱 바 렌더 ──────────────────────────────────────────────────────────
  // 풀 리빌드(추가/삭제/색변경 후) vs 포지션만(드래그 중, 매 mousemove) 를 분리해 드래그 프레임비용을 낮춘다.
  function _positionGradStops() {
    const g = _grad();
    const thumbs = gradBar.querySelectorAll('.goya-cp-grad-thumb');
    thumbs.forEach((t, i) => { if (g.stops[i]) t.style.left = _thumbLeft(g.stops[i].offset); });
    gradFill.style.background = _barFillCSS();
  }
  /* ★0919 QA(T-060↔피커): 캔버스 끝 원을 도형 밖으로 끌면 스탑이 0% 미만·100% 초과가 된다.
     예전엔 피커 바가 그 스탑을 끝(0/100%)에 «눌러» 보여 주고, 썸을 6px 만 건드려도 offset 이 0..1 로 잘려
     (5.57 → 0.97) 캔버스에서 밖까지 끌어 둔 끝점이 도형 안으로 되돌아왔다.
     → 바 = 스탑 범위 [lo,hi](lo=min(0,…), hi=max(1,…)) 전체. 표시·드래그·더블클릭 추가가 모두 같은 사상(寫像)을 쓴다.
       범위가 0..1 이면 예전과 똑같다. 드래그 중엔 범위를 «잡을 때» 값으로 고정(끌면서 눈금이 흔들리지 않게). */
  let _barFrozen = null;
  function _barRange() {
    if (_barFrozen) return _barFrozen;
    const offs = _grad().stops.map(s => Number(s.offset) || 0);
    return { lo: Math.min(0, ...offs), hi: Math.max(1, ...offs) };
  }
  function _barToOffset(x) { const { lo, hi } = _barRange(); return lo + Math.max(0, Math.min(1, x)) * (hi - lo); }
  function _thumbLeft(off) {
    const { lo, hi } = _barRange();
    const t = ((Number(off) || 0) - lo) / ((hi - lo) || 1);
    return (Math.max(0, Math.min(1, t)) * 100) + '%';
  }
  function _barFillCSS() {
    const { lo, hi } = _barRange();
    if (lo === 0 && hi === 1) return _buildGradientCSS();
    const span = (hi - lo) || 1;
    const parts = _sortedStops(_grad()).map(s => {
      const aPct = _aClamp((s.opacity ?? 1) * 100);
      const col = aPct < 100 ? _hexToRgba(s.color, aPct) : s.color;
      return `${col} ${(Math.round(((s.offset || 0) - lo) / span * 10000) / 100)}%`;
    });
    return `linear-gradient(90deg, ${parts.join(', ')})`;
  }
  function _bindStopThumbDrag(thumbEl, idx) {
    thumbEl.addEventListener('mousedown', (e) => {
      e.preventDefault(); e.stopPropagation();
      const g = _grad();
      g.selectedIdx = idx;
      gradBar.querySelectorAll('.goya-cp-grad-thumb').forEach((t, i) => t.classList.toggle('is-active', i === idx));
      _syncSelectedStopUI();
      // 0918 canvasgrad: 썸네일 선택 → 캔버스 바 칩 선택 이동(bindGradientLinePicker 가 수신)
      _targetInput?.dispatchEvent(new CustomEvent('goya-cp:gradient-select', { bubbles: true, detail: { selectedIdx: _sortedSelIdx() } }));
      thumbEl.classList.add('is-dragging');
      // 0918r2 textgrad(이벨류 지적 ④): 움직이지 않은 «클릭만»은 기록을 남기지 않는다 —
      //   안 그러면 다음 ⌘Z 가 눈에 보이는 변화 없이 한 칸을 먹는다(도형·글자 공통).
      const startOffset = g.stops[idx] ? g.stops[idx].offset : null;
      _barFrozen = null; _barFrozen = _barRange();
      const onMove = (ev) => {
        const r = gradBar.getBoundingClientRect();
        const p = _barToOffset((ev.clientX - r.left) / r.width);
        g.stops[idx].offset = Math.round(p * 10000) / 10000;
        _positionGradStops();
        _scheduleEmitGradient(false);
      };
      const onUp = () => {
        _barFrozen = null;
        thumbEl.classList.remove('is-dragging');
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        if (g.stops[idx] && g.stops[idx].offset === startOffset) return;
        _scheduleEmitGradient(true);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }
  function _renderGradStops() {
    const g = _grad();
    gradBar.querySelectorAll('.goya-cp-grad-thumb').forEach(t => t.remove());
    g.stops.forEach((s, i) => {
      const t = document.createElement('div');
      t.className = 'goya-cp-grad-thumb' + (i === g.selectedIdx ? ' is-active' : '');
      t.style.left = _thumbLeft(s.offset);
      t.style.background = s.color;
      t.title = Math.round(s.offset * 100) + '%';
      gradBar.appendChild(t);
      _bindStopThumbDrag(t, i);
    });
    gradFill.style.background = _barFillCSS();
  }
  function _syncSelectedStopUI() {
    const g = _grad();
    const s = g.stops[g.selectedIdx];
    if (!s || !gradStopColor) return;
    const hex = _hex6(s.color);
    gradStopColor.value = hex;
    if (gradStopHex) gradStopHex.value = hex.replace('#', '').toUpperCase();
    const opPct = _aClamp((s.opacity ?? 1) * 100);
    if (gradStopOpacity) gradStopOpacity.value = String(opPct);
    if (gradStopOpacityLabel) gradStopOpacityLabel.textContent = opPct + '%';
    if (gradStopDel) gradStopDel.disabled = g.stops.length <= 2;
  }
  function _mutateSelectedStop(fn, commit) {
    const g = _grad();
    const s = g.stops[g.selectedIdx];
    if (!s) return;
    fn(s);
    _positionGradStops();
    const t = gradBar.querySelectorAll('.goya-cp-grad-thumb')[g.selectedIdx];
    if (t) t.style.background = s.color;
    _scheduleEmitGradient(commit);
  }

  // 바 더블클릭 → 그 위치에 이웃 stop을 보간한 색으로 새 stop 추가 (mockup 스펙: 무제한 스톱).
  gradBar?.addEventListener('dblclick', (e) => {
    if (e.target.closest('.goya-cp-grad-thumb')) return;
    const r = gradBar.getBoundingClientRect();
    const p = Math.round(_barToOffset((e.clientX - r.left) / r.width) * 10000) / 10000;   // 0919: 바 = 스탑 범위
    const g = _grad();
    const sorted = _sortedStops(g);
    let color = sorted[0]?.color || '#ffffff', opacity = sorted[0]?.opacity ?? 1;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (p >= sorted[i].offset && p <= sorted[i + 1].offset) {
        const span = sorted[i + 1].offset - sorted[i].offset;
        const t = span > 1e-6 ? (p - sorted[i].offset) / span : 0;
        color = _lerpHex(sorted[i].color, sorted[i + 1].color, t);
        opacity = sorted[i].opacity + (sorted[i + 1].opacity - sorted[i].opacity) * t;
        break;
      }
    }
    g.stops.push({ color, offset: p, opacity });
    g.selectedIdx = g.stops.length - 1;
    _renderGradStops();
    _syncSelectedStopUI();
    _scheduleEmitGradient(true);
  });

  // 선택된 스톱 색상/투명도 컨트롤
  gradStopColor?.addEventListener('input', () => {
    if (gradStopHex) gradStopHex.value = gradStopColor.value.replace('#', '').toUpperCase();
    _mutateSelectedStop(s => { s.color = gradStopColor.value; }, false);
  });
  gradStopColor?.addEventListener('change', () => _scheduleEmitGradient(true));
  /* 스톱 hex — 여기도 같은 사본이었다(무효값 침묵 + blur 복원 없음). 배선은 공용 한 자리. */
  wireHexText(gradStopHex, {
    parse: parseHex6,
    format: formatHex6,
    getCurrent: () => gradStopColor?.value || '#000000',
    onApply: (v) => { gradStopColor.value = v; _mutateSelectedStop(s => { s.color = v; }, false); },
    onCommit: () => _scheduleEmitGradient(true),
  });
  gradStopOpacity?.addEventListener('input', () => {
    const pct = _aClamp(gradStopOpacity.value);
    if (gradStopOpacityLabel) gradStopOpacityLabel.textContent = pct + '%';
    _mutateSelectedStop(s => { s.opacity = pct / 100; }, false);
  });
  gradStopOpacity?.addEventListener('change', () => _scheduleEmitGradient(true));
  gradStopDel?.addEventListener('click', () => {
    const g = _grad();
    if (g.stops.length <= 2) return;
    g.stops.splice(g.selectedIdx, 1);
    g.selectedIdx = Math.max(0, Math.min(g.stops.length - 1, g.selectedIdx));
    _renderGradStops();
    _syncSelectedStopUI();
    _scheduleEmitGradient(true);
  });

  // ── 각도 다이얼 + 숫자 입력 (겸용 — 서로 동기화) ────────────────────────────
  // CSS gradient 각도 관례: 0deg=위, 시계방향 증가 (gradient-model.js handlesToAngle과 동일 관례).
  function _updateAngleNeedle(deg) {
    if (gradAngleNeedle) gradAngleNeedle.style.transform = `translateX(-50%) rotate(${deg}deg)`;
  }
  gradAngleDial?.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startDeg = _currentAngle();   // 움직임 없는 클릭 = 기록 없음(스탑 썸네일과 같은 규칙)
    const onMove = (ev) => {
      const r = gradAngleDial.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let deg = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI + 90;
      if (deg < 0) deg += 360;
      deg = Math.round(deg);
      if (gradAngleNum) gradAngleNum.value = String(deg);
      _updateAngleNeedle(deg);
      _scheduleEmitGradient(false);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (_currentAngle() === startDeg) return;
      _scheduleEmitGradient(true);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
  gradAngleNum?.addEventListener('input', () => {
    const deg = _currentAngle();
    _updateAngleNeedle(deg);
    _scheduleEmitGradient(false);
  });
  gradAngleNum?.addEventListener('change', () => {
    const deg = _currentAngle();
    if (gradAngleNum) gradAngleNum.value = String(deg); // 범위 clamp 반영
    _updateAngleNeedle(deg);
    _scheduleEmitGradient(true);
  });

  // A15: radial-gradient(circle)은 각도를 안 쓰므로 radial일 때 다이얼+숫자 입력 숨김.
  const _syncGradAngleVis = () => {
    if (gradControlsRow) gradControlsRow.classList.toggle('is-radial', gradType.value === 'radial');
  };
  gradType.addEventListener('change', () => { _syncGradAngleVis(); _scheduleEmitGradient(true); });

  // A16: gradient 컨텍스트 시드 브리지 — openPicker가 dataset.cpGradient를 goya-cp:seed-gradient로 넘기면 여기서 복원.
  // opts.emit=false: 외부(캔버스 바) 동기화 — 되쏘지 않는다(루프 방지). opts.selectedIdx: 선택 스탑.
  function _seedGradientUI(g, opts = {}) {
    if (!g || !Array.isArray(g.stops) || g.stops.length < 2) return false;
    if (gradType) gradType.value = (g.type === 'radial') ? 'radial' : 'linear';
    // ★angle 0 은 유효값 — parseInt(0)||90 이 0°를 90°로 둔갑시키던 결함(0918 canvasgrad)
    const _a = Number(g.angle);
    const angle = Math.max(0, Math.min(360, Number.isFinite(_a) ? Math.round(_a) : 90));
    if (gradAngleNum) gradAngleNum.value = String(angle);
    _updateAngleNeedle(angle);
    const gr = _grad();
    gr.stops = g.stops.map(s => ({
      color: _hex6(s.color),
      // 0918 canvasgrad: 범위 밖 offset 보존(캔버스 바 자유 끝점) — 표시만 _thumbLeft 가 클램프
      offset: Number.isFinite(Number(s.offset)) ? Number(s.offset) : 0,
      opacity: (s.opacity == null) ? 1 : Math.max(0, Math.min(1, s.opacity)),
    }));
    const si = Number(opts.selectedIdx);
    gr.selectedIdx = Number.isFinite(si) ? Math.max(0, Math.min(gr.stops.length - 1, si | 0)) : 0;
    _renderGradStops();
    _syncSelectedStopUI();
    _syncGradAngleVis();
    if (opts.emit === false) gradFill.style.background = _barFillCSS();
    else _emitGradientNow(false);
    return true;
  }
  // 0918 canvasgrad: 캔버스 바 → 열린 피커 UI 동기(syncPickerGradient 가 _pop 에 직접 dispatch).
  //   탭은 전환하지 않고, emit 하지 않는다(goya-cp:gradient 재발행 0회 = 루프 없음).
  pop.addEventListener('goya-cp:sync-gradient', (e) => {
    const d = e.detail;
    if (!d || !d.g) return;
    _seedGradientUI(d.g, { emit: false, selectedIdx: d.selectedIdx });
  });
  // openPicker가 _pop에 직접 dispatch하는 시드 이벤트를 수신 (_pop은 body 직속이라 bubbling 미사용)
  pop.addEventListener('goya-cp:seed-gradient', (e) => {
    if (!e.detail) return;
    // T-059 2라운드(이벨류 high): 열기만 해선 방출하지 않는다(emit:false). 전엔 _emitGradientNow(false) →
    //   onGradient 가 블럭 값을 «피커가 다시 만든 CSS»로 덮었다 — 피커 문법이 아닌 값('to right'·'ellipse at …')은
    //   열기만 해도 모양이 바뀌었다(기록 0, autosave 만). 캔버스 바 선택 칩 동기는 값 변경 없는 select 이벤트로만.
    const ok = _seedGradientUI(e.detail, { emit: false });
    if (ok) {
      _targetInput?.dispatchEvent(new CustomEvent('goya-cp:gradient-select', { bubbles: true, detail: { selectedIdx: _sortedSelIdx() } }));
      // gradient 탭으로 «보여주기만» — 커밋 없음(열기만 해선 기록이 안 쌓인다)
      if (_state) _state.mode = 'gradient';
      _showTab('gradient');
    }
  });

  /* ── 탭 클릭 = 모드 전환 + 즉시 커밋 ── (0918 picker, 피그마식)
     같은 모드 탭을 다시 누르면 UI만 — 기록이 쌓이지 않는다.
     커밋은 동기(rAF 안 씀): 탭 한 번 = pushHistory 한 번 = 되돌리기 한 번. */
  function _activateTab(name) {
    if (!_state || !CP_MODES.includes(name)) return;
    if (!_targetModes(_targetInput).has(name)) return;   // 게이트(disabled 버튼이면 click 자체가 안 오지만 이중 안전)
    const prev = _state.mode || 'solid';
    // 0920 polish1: 그라데이션을 떠나면 대기 중인 그라데이션 방출은 버린다(위 _emitGradientNow 주석).
    if (name !== 'gradient') _gradPendingCommit = false;
    _showTab(name);
    if (name === 'gradient') {
      if (_state.grad == null) {
        // 이 세션 첫 그라데이션 — 기본값(지금 색 100%→0%, linear 90°)으로 UI까지 리셋.
        // ★팝오버가 싱글턴이라 type/angle 을 안 리셋하면 이전 스와치의 radial·각도가 넘어온다.
        gradType.value = 'linear';
        if (gradAngleNum) gradAngleNum.value = '90';
        _updateAngleNeedle(90);
      }
      _grad();                 // null 이면 여기서 기본 스톱 생성(같은 세션 재진입이면 직전 스톱 그대로)
      _syncGradAngleVis();
      _renderGradStops();
      _syncSelectedStopUI();
      if (prev === 'gradient') return;
      _state.mode = 'gradient';
      _emitGradientNow(true);
      return;
    }
    if (prev === name) return;
    _state.mode = name;
    if (name === 'solid') {
      // 마지막 단색 = _state.h/s/v/a (그라데이션 탭은 이 값을 안 건드린다) → input+change 1회
      // ★0919 QA: 열 때 단색이 «투명»(transparent·alpha 0)이었고 이 세션에 단색을 안 만졌으면 투명으로 돌아간다.
      //   (예전엔 _state.a 기본 1 이라 투명 배경 그룹이 불투명 흰색으로 덮였다 — 데이터 변경)
      if (_state.solidRestoreAlpha != null && !_state.solidEdited) {
        _state.a = _state.solidRestoreAlpha;
        if (_state.a === 0) _state.transparentHidden = true;   // 다음 «색 고르기»는 보이게(아래 헬퍼)
      }
      _applySolidAndEmit({ commit: true, fromTab: true });
      return;
    }
    if (name === 'image') {
      // 이미지 넣기 전 = 캔버스에 바둑판(체커). 받는 쪽(prop-shape)이 표시·기록 1회.
      _targetInput?.dispatchEvent(new CustomEvent('goya-cp:image', {
        bubbles: true, detail: { src: null, placeholder: true, commit: true },
      }));
    }
  }
  pop.querySelectorAll('.goya-cp-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // T-059 2라운드: 누른 뒤에도 호버 설명이 떠 있으면 바로 아래 패널(이미지 드롭존 등)을 가린다 →
      //   누르면 숨기고, 마우스가 탭을 떠났다 돌아오면 다시 보인다. (disabled 탭은 click 이 안 와서 설명이 그대로 — 의도)
      tab.classList.add('tip-hide');
      if (tab.disabled) return;
      _activateTab(tab.dataset.tab);
    });
    tab.addEventListener('mouseleave', () => tab.classList.remove('tip-hide'));
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
  // D6: grad 서브상태를 매 open마다 비운다(null) → 스와치 간 스톱 누수 방지.
  //   null = «이 세션에선 아직 그라데이션을 안 만들었다» — 그라데이션 탭을 처음 누를 때
  //   지금 색 기준 기본값(_defaultGradStops)으로 만들고 type/angle UI 도 리셋한다.
  const cpAlpha = nativeInp.dataset.cpAlpha != null && nativeInp.dataset.cpAlpha !== ''
    ? Math.max(0, Math.min(1, (parseInt(nativeInp.dataset.cpAlpha) || 0) / 100)) : 1;
  _state = { h, s, v, a: cpAlpha, grad: null, mode: 'solid' };
  if (cpAlpha === 0) _state.transparentHidden = true;
  // 단색 복귀 알파(0919 QA) — wireColorField 가 «지금 단색이 투명»이면 cpSolidAlpha='0' 을 심는다.
  if (nativeInp.dataset.cpSolidAlpha != null && nativeInp.dataset.cpSolidAlpha !== '') {
    _state.solidRestoreAlpha = Math.max(0, Math.min(1, (parseInt(nativeInp.dataset.cpSolidAlpha) || 0) / 100));
  }

  // 탭 능력 게이트 + solid 탭으로 초기화(UI만)
  const modes = _applyModeGate(nativeInp);
  _showTab('solid');
  _pop.querySelectorAll('.goya-cp-tab.tip-hide').forEach(t => t.classList.remove('tip-hide'));  // 새로 열면 설명 다시 허용
  // 이미지 드롭존은 스와치마다 새로 — 이전 스와치에 올린 사진이 남아 보이지 않게
  const imgZone = _els && _els.imgZone;
  if (imgZone && imgZone.classList.contains('has-image')) {
    imgZone.classList.remove('has-image');
    imgZone.style.backgroundImage = '';
    imgZone.innerHTML = '이미지를 클릭하거나<br>드래그해서 업로드';
  }

  _pop.hidden = false;
  _position(swatch);
  _syncSolidUI();

  // A16: target에 gradient 컨텍스트(dataset.cpGradient)가 있으면 gradient 탭으로 복원.
  // 시드 로직은 _wireEvents 클로저에 갇혀 있어 직접 못 부르므로 이벤트 브리지로 전달한다.
  // (잘못된 시드 방지: stops>=2 + 유효 JSON 파싱 성공 시에만)
  const gctx = modes.has('gradient') ? nativeInp.dataset.cpGradient : '';
  if (modes.has('image') && nativeInp.dataset.cpFill === 'image') {
    // 이미지(체커) 모드인 대상 — 이미지 탭으로 «보여주기만»
    _state.mode = 'image';
    _showTab('image');
  } else if (gctx) {
    try {
      const g = JSON.parse(gctx);
      if (g && Array.isArray(g.stops) && g.stops.length >= 2) {
        // _pop은 document.body 직속이라 nativeInp에서의 bubbling이 닿지 않음 → _pop에 직접 dispatch
        _pop.dispatchEvent(new CustomEvent('goya-cp:seed-gradient', { detail: g }));
      }
    } catch (_) { /* 손상된 컨텍스트 무시 → solid 탭 유지 */ }
  }
  // 0918 canvasgrad: 열린 피커가 캔버스 그라데이션 바를 가리면 바 쪽이 피커를 비킨다(gradient-line-overlay).
  document.dispatchEvent(new CustomEvent('goya-cp:opened', { detail: { input: nativeInp } }));

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
    // 0918 canvasgrad: 캔버스 그라데이션 바(칩·끝 원)는 피커와 한 몸 — 잡아도 피커를 닫지 않는다.
    if (ev.target?.closest?.('.grad-line-overlay')) return;
    if (path.includes(swatch) || ev.target.closest('.prop-color-swatch') === swatch) return;
    _closePicker();
  };
  setTimeout(() => document.addEventListener('mousedown', _outsideHandler, true), 50);
}

/* ─── Esc = 피커 닫기(0919 QA) ─── 열려 있을 때만 가로채고, 닫힌 뒤의 Esc 는 에디터(상위 선택 등)로 간다. */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !_pop || _pop.hidden) return;
  e.preventDefault();
  e.stopPropagation();
  _closePicker();
}, true);

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

/** 0918 canvasgrad — 캔버스 그라데이션 바에서 바꾼 값을 «열려 있는» 피커 UI 에 반영한다.
 *  inputEl 이 지금 피커 대상일 때만(다른 스와치의 피커를 건드리지 않게). emit 없음 → 루프 없음. */
export function syncPickerGradient(inputEl, g, { selectedIdx } = {}) {
  if (!_pop || _pop.hidden || !_targetInput || _targetInput !== inputEl) return false;
  _pop.dispatchEvent(new CustomEvent('goya-cp:sync-gradient', { detail: { g, selectedIdx } }));
  return true;
}
window.syncPickerGradient = syncPickerGradient;
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

/** raw 색값에서 «보여 줄 hex» 를 뽑는다 — 스와치와 <input type="color"> 가 읽을 수 있는 형태.
 *  ⚠️저장된 색은 hex 만이 아니다: 컬러변수 칩은 `var(--color-x, #hex)` 를, alpha 조절은 `rgba(...)`
 *    를 넣는다. 그 raw 를 hex 칸에 그대로 꽂으면 「VAR(--COLOR…」가 글자로 뜨고
 *    <input type="color"> 는 값을 못 읽어 «검정»으로 죽는다(prop-modal 실측 2026-09-08).
 *  ★var() 는 «폴백 hex» = 그 변수의 현재 색으로 푼다. 바인딩 정보는 raw dataset 이 따로 갖는다.
 *  ⛔패널마다 자기 벌을 만들지 마라 — 이 레포는 그 병(사본 11벌)으로 이미 앓았다. */
export function swatchHex(v, fallback = '#000000') {
  const s = String(v || '').trim();
  const m6 = s.match(/#([0-9a-fA-F]{6})\b/);
  if (m6) return '#' + m6[1].toLowerCase();
  const m3 = s.match(/#([0-9a-fA-F]{3})\b/);
  if (m3) return '#' + m3[1].toLowerCase().split('').map((ch) => ch + ch).join('');
  const rgb = s.match(/rgba?\(([^)]+)\)/i);
  if (rgb) {
    const p = rgb[1].split(',').map((x) => parseInt(x, 10));
    const to = (n) => Math.max(0, Math.min(255, n | 0)).toString(16).padStart(2, '0');
    return '#' + to(p[0]) + to(p[1]) + to(p[2]);
  }
  return fallback;
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

/* ═══════════════════════════════════════════════════════════════════════════
   색 코드 칸 «한 자리» 배선 — wireHexText
   ★왜 생겼나 (2026-09-20 «사용자 관점 훑기», 유닛 colorhex / 카드 T-100)
     같은 「색 코드」 칸의 (검증 → 실시간 적용 → 커밋 → blur 복원) 배선이 최소 열 벌로
     손복사돼 있었고, 사본마다 규칙이 조금씩 달라져 있었다 —
       · 섹션 배경은 `00FF00`(# 없이 6자) / Heading 은 `#00FF00`(# 포함 7자)
       · 무효값을 넣으면 «말없이» 무시된다. 칸에는 쓴 값이 그대로 남아,
         화면은 멀쩡한데 값은 안 바뀐 «거짓 상태»가 된다.
       · 최악은 sec-txt-*-hex · cvb-*-hex — blur 핸들러가 아예 없어 무효값이 영원히 남았다.
     ⇒ 「어디어디가 그렇다」는 손목록을 늘리는 대신 «배선»을 여기 한 자리로 모은다.
   ★문법은 자리마다 «진짜로» 다르다(6자리 hex · `transparent` 키워드 · 자유 CSS).
     그래서 정규식 하나로 우겨넣지 않는다 — 공유하는 것은 «배선»이지 «문법»이 아니다.
     문법은 parse/format 으로 주입한다.

   계약:
     parse(raw)   -> 정규화값 | null(무효)
     format(v)    -> 칸에 표시할 문자열 (없으면 String(v))
     getCurrent() -> 「마지막 유효값」 — blur/무효 복원의 기준
     onApply(v)   -> 타이핑 중 실시간 반영 (히스토리 ✗)
     onCommit(v)  -> 확정 (히스토리 ○)
   동작(이 넷이 «한 벌»이다):
     input  : 유효 → 무효표시 걷고 onApply / 무효 → «적용하지 않고» 무효표시를 붙인다
     change : 유효 → onCommit / 무효 → 마지막 유효값으로 되돌린다
     Enter  : change 와 «같은 것»을 한다 — 유효 → 표기 정리 + onCommit / 무효 → 되돌린다
     blur   : 언제나 마지막 유효값 표기로 정리 + 무효표시 제거
   ⛔무효값을 «조용히 무시»하지 마라 — 그 침묵이 바로 신고된 증상이다.

   ★Enter 를 왜 따로 다루나 (2026-09-21 픽스 라운드, 이벨류에이터 low ③)
     이 앱의 색 칸은 `<form>` 밖이라 Chromium 이 Enter 에서 change 를 «안 쏜다»(실측: keydown 만 오고
     change 0건). 대부분 칸은 input 이 실시간 적용해서 눈에 안 띄지만, onApply 가 스와치만 바꾸는
     자유형식 칸(cvb-text-bg-raw 등)은 「쓰고 Enter 쳤는데 아무 일도 없다」가 된다.
     같은 레포의 «숫자» 칸(prop-number-commit-guard)은 Enter 를 확정으로 받는다 — 규약을 맞춘다.
     ⚠️Enter 로 커밋한 뒤 Tab 으로 빠져나가면 change 가 «또» 온다 → 되돌리기 두 칸이 된다.
       그래서 마지막 커밋값을 기억해 같은 값이면 한 번 더 부르지 않는다(포커스 때 기억을 비운다 —
       그 사이 피커로 색이 바뀌었으면 같은 글자라도 «새 커밋»이 맞다).
═══════════════════════════════════════════════════════════════════════════ */
export const HEX_INVALID_CLASS = 'prop-color-hex--invalid';

export function wireHexText(hexEl, { parse, format, getCurrent, onApply, onCommit, restoreOnBlur = true } = {}) {
  if (!hexEl || typeof parse !== 'function') return null;
  const fmt = format || ((v) => String(v ?? ''));
  const mark = (bad) => {
    hexEl.classList.toggle(HEX_INVALID_CLASS, !!bad);
    if (bad) hexEl.setAttribute('aria-invalid', 'true');
    else hexEl.removeAttribute('aria-invalid');
  };
  const restore = () => {
    mark(false);
    if (typeof getCurrent !== 'function') return;
    const cur = getCurrent();
    if (cur != null) hexEl.value = fmt(cur);
  };
  let _lastCommitKey = null;              // ★Enter → blur 이중 커밋 방지(위 주석)
  const commit = (v) => {
    const k = String(v);
    if (k === _lastCommitKey) return;
    _lastCommitKey = k;
    onCommit?.(v);
  };
  hexEl.addEventListener('focus', () => { _lastCommitKey = null; });
  hexEl.addEventListener('input', () => {
    const v = parse(hexEl.value);
    if (v == null) { mark(true); return; }
    mark(false);
    onApply?.(v);
  });
  hexEl.addEventListener('change', () => {
    const v = parse(hexEl.value);
    if (v == null) { restore(); return; }
    mark(false);
    commit(v);
  });
  hexEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    const v = parse(hexEl.value);
    if (v == null) { restore(); return; }   // 무효 + Enter = change 와 같게 되돌린다
    mark(false);
    hexEl.value = fmt(v);                   // 표기 정리(`#00ff00` → `00FF00`)
    onApply?.(v);                           // 자유형식 칸은 input 이 «적용»을 안 했을 수 있다
    commit(v);
  });
  hexEl.addEventListener('blur', () => { if (restoreOnBlur) restore(); else mark(false); });
  return { restore, markInvalid: () => mark(true), markValid: () => mark(false) };
}

/* 6자리 hex 문법 — `#` 은 있어도 없어도 된다(자리마다 규칙을 외우지 않아도 되게).
   반환은 언제나 `#rrggbb` (native <input type="color"> 가 먹는 꼴). */
export function parseHex6(raw) {
  const v = String(raw ?? '').trim().replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(v) ? ('#' + v.toLowerCase()) : null;
}
/* 칸 표기 = «# 없는 대문자 6자» — 40여 곳이 이미 쓰는 다수결 포맷. */
export const formatHex6 = (v) => String(v ?? '').replace('#', '').toUpperCase();

/* 6자리 hex + `transparent` 키워드까지 받는 자리(심플카드 아이콘/텍스트 배경)용 문법. */
export function parseHex6OrTransparent(raw) {
  const s = String(raw ?? '').trim();
  if (/^transparent$/i.test(s)) return 'transparent';
  return parseHex6(s);
}
/* ★대문자로 «망가뜨리지» 않는다 (2026-09-21 픽스 라운드, 이벨류에이터 low ④)
   이 칸의 getCurrent 는 dataset 원문을 준다 — 거기엔 hex 도 transparent 도 아닌 CSS 가
   들어 있을 수 있다(예: `rgb(0,0,0)`). 옛 구현은 그걸 `RGB(0,0,0)` 으로 바꿔 놓고
   parse 를 실패시켜 「멀쩡한 값에 빨간 무효 표시」를 붙였다. 모르는 값은 «그대로» 돌려준다. */
export const formatHex6OrTransparent = (v) => {
  const s = String(v ?? '').trim();
  if (/^transparent$/i.test(s)) return 'transparent';
  return /^#?[0-9a-fA-F]{6}$/.test(s) ? formatHex6(s) : s;
};

/* 자유형식 CSS 배경값이 «브라우저가 실제로 읽는 값»인지 본다.
   ⛔정규식으로 흉내 내지 마라 — gradient/색이름/var() 까지 다 맞혀야 한다. 파서는 브라우저가 갖고 있다. */
let _cssProbe = null;
export function isCssBackgroundValue(v) {
  const s = String(v ?? '').trim();
  if (!s) return false;
  if (!_cssProbe) _cssProbe = document.createElement('div');
  _cssProbe.style.background = '';
  try { _cssProbe.style.background = s; } catch (_) { return false; }
  return _cssProbe.style.background !== '';
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
      <input type="text" class="prop-color-hex" id="${idPrefix}-hex" value="${hexUp}" maxlength="7" aria-label="Color"${placeholder ? ` placeholder="${placeholder}"` : ''}>
      <label class="prop-color-alpha" title="Opacity">
        <input type="text" class="prop-color-alpha-input" id="${idPrefix}-alpha" value="${alpha}" aria-label="Opacity">
        <span class="prop-color-alpha-suffix">%</span>
      </label>
    </div>
  `;
}

export function wireColorField(idPrefix, { initialAlpha = 100, onApply, onCommit, onGradient, gradientValue } = {}) {
  const picker = document.getElementById(`${idPrefix}-color`);
  const hex    = document.getElementById(`${idPrefix}-hex`);
  const alpha  = document.getElementById(`${idPrefix}-alpha`);
  const swatch = picker?.closest('.prop-color-swatch');
  if (!picker || !hex || !alpha || !swatch) return null;

  /* T-059 2라운드 — 재오픈 시드를 «필드마다 제각각»이 아니라 여기 한 곳에서 채운다.
     패널을 다시 그리면(= 블럭 재선택) native input 이 새로 생겨 dataset.cpGradient 가 비어 있다 →
     피커가 Solid 탭으로 열리고, 그라데이션 탭을 누르면 «지금 색 100%→0%» 기본값이 사용자 그라데이션을 덮었다
     (프레임·에셋·비교 칼럼 실측). gradientValue = 블럭의 «지금» 배경 CSS. 그라데이션이면:
       · cpGradient 시드 → 그라데이션 탭으로 열리고, 같은 탭 재클릭 = 기록 0
       · picker/hex/alpha = 첫 스탑 색 → Solid 복귀 색 = 첫 스탑(피그마·도형 폴백과 같음). 이게 없으면
         호출측 폴백(#ffffff·#f3f4f6·#000000)이 칠해졌다.
     호출측이 이미 cpGradient 를 채웠으면(도형 방식) 존중한다. ⛔여기선 onApply/onGradient 를 부르지 않는다(열기만 해선 문서 불변). */
  let _seedAlpha = null;
  if (onGradient && gradientValue) {
    // ★엄격 파싱: 피커 문법이 아닌 그라데이션('to right'·'ellipse at …'·이름색 등)은 시드하지 않는다 —
    //   잘못 읽힌 모델로 열면 스탑 하나만 건드려도 사용자 값이 엉뚱하게 다시 쓰인다(이벨류 high). 시드 없음 = Solid 탭.
    const g = parseGradientStrict(String(gradientValue));
    if (g && Array.isArray(g.stops) && g.stops.length >= 2) {
      // Solid 복귀 색 = «보이는» 첫 스탑(투명도>0). 첫 스탑이 완전 투명(예: 흰 0%→흰 100%)이면 그걸 고르면
      //   Solid 복귀가 투명색이 된다(이벨류 low) → 보이는 첫 스탑, 전부 투명이면 첫 스탑 색을 불투명으로.
      const sorted = g.stops.slice().sort((a, b) => a.offset - b.offset);
      const _op = s => Math.max(0, Math.min(1, s.opacity == null ? 1 : s.opacity));
      const first = sorted.find(s => _op(s) > 0) || sorted[0];
      const fh = _hex6(first.color);
      const fa = _op(first) > 0 ? Math.round(_op(first) * 100) : 100;
      if (!picker.dataset.cpGradient) {
        try { picker.dataset.cpGradient = JSON.stringify({ type: g.type, angle: g.angle, stops: g.stops }); } catch (_) {}
      }
      picker.value = fh;
      hex.value = fh.replace('#', '').toUpperCase();
      picker.dataset.cpAlpha = String(fa);
      alpha.value = String(fa);
      _seedAlpha = fa;
      swatch.style.background = String(gradientValue);
    }
  }

  // ★0919 QA: 단색이 투명(alpha 0, 예: ⌘G 그룹 배경 transparent)이면 그라데이션 탭 → Solid 복귀 때 투명으로 돌아가게 표시.
  //   cpAlpha 로 심지 않는 이유: cpAlpha 는 «사용자가 명시한 알파»로 읽혀 단색을 새로 골라도 투명에 갇힌다(_bumpAlphaIfHidden 무력화).
  if (_seedAlpha == null && initialAlpha === 0 && (picker.dataset.cpAlpha == null || picker.dataset.cpAlpha === '')) {
    picker.dataset.cpSolidAlpha = '0';
  }

  // 탭 능력 선언 — 호출측이 이미 정했으면 존중, 아니면 onGradient 유무로 자동(color-picker 게이트가 읽음)
  if (!picker.dataset.cpModes) picker.dataset.cpModes = onGradient ? 'solid,gradient' : 'solid';

  // 그라데이션 탭에서 emit되는 커스텀 이벤트 수신 (solid onApply와 별개 경로)
  if (onGradient) {
    picker.addEventListener('goya-cp:gradient', (e) => {
      if (e.detail?.css) {
        swatch.style.background = e.detail.css;
        // A16: 재오픈 시 gradient 탭/stop을 복원할 수 있게 컨텍스트를 native input에 보존
        try {
          picker.dataset.cpGradient = JSON.stringify({
            type: e.detail.type, angle: e.detail.angle, stops: e.detail.stops,
          });
        } catch (_) {}
        onGradient(e.detail.css, false);
      }
    });
    picker.addEventListener('goya-cp:gradient-commit', (e) => {
      if (e.detail?.css) onGradient(e.detail.css, true);
    });
  }

  let _a = _seedAlpha != null ? _seedAlpha : initialAlpha;
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
    // 단색이 칠해지는 순간 그라데이션 시드는 낡은 것 — hex/alpha 칸 입력도 여기로 온다(picker input 만 지우던 빈틈)
    delete picker.dataset.cpGradient;
    swatch.style.background = c;
    onApply?.(c);
  };

  picker.addEventListener('input', () => {
    hex.value = picker.value.replace('#','').toUpperCase();
    // A16: solid로 색을 바꾸면 그라데이션 컨텍스트를 폐기 → 재오픈 시 solid 탭으로 정상 복귀
    delete picker.dataset.cpGradient;
    // C12: 고급 피커(solid 탭)가 dataset.cpAlpha로 내려준 alpha를 반영.
    // _userTouchedAlpha와 충돌하지 않게: cpAlpha가 오면 그게 사용자의 명시적 alpha 조작이므로 동기화.
    if (picker.dataset.cpAlpha != null && picker.dataset.cpAlpha !== '') {
      const cpA = Math.max(0, Math.min(100, parseInt(picker.dataset.cpAlpha) || 0));
      _a = cpA;
      if (alpha) alpha.value = String(cpA);
      _userTouchedAlpha = true;
    } else {
      _bumpAlphaIfHidden();
    }
    apply();
  });
  picker.addEventListener('change', () => onCommit?.());
  /* hex 칸 — 배선은 wireHexText 한 자리. 이 함수를 40여 개 패널이 공유하므로
     여기 한 줄이 「무효값을 알린다 / blur 로 되돌린다」를 그 전부에 한꺼번에 깐다.
     ⛔grad 시드 상태기계(위 cpGradient/cpAlpha)는 건드리지 않는다 — 여기서 빼낸 것은
       input/blur/change 리스너 «본체»뿐이다. */
  wireHexText(hex, {
    parse: parseHex6,
    format: formatHex6,
    getCurrent: () => picker.value || '#000000',
    onApply: (v) => { picker.value = v; _bumpAlphaIfHidden(); apply(); },
    onCommit: () => onCommit?.(),
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
window.wireHexText = wireHexText;
/* ★문법도 같이 내보낸다 — 모듈이 아닌 파일(design-system.js · text-effect-transform.js)도
   «같은» 검증·표기를 써야 「자리마다 규칙이 다르다」가 다시 안 생긴다(유닛 colorhex). */
window.parseHex6 = parseHex6;
window.formatHex6 = formatHex6;
window.parseAlphaFromColor = parseAlphaFromColor;

export { openPicker, _closePicker as closePicker };
