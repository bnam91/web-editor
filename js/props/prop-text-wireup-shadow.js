/* prop-text-wireup-shadow.js
 * Text Shadow controls — toggle / X / Y / blur / color
 * Persist via inline text-shadow + data-shadow-* dataset on contentEl
 */

export const SHADOW_DEFAULTS = {
  enabled: false,
  x: 2,
  y: 2,
  blur: 4,
  color: '#000000',
  alpha: 50, // 0-100
};

function _hex6(h) {
  if (!h) return '#000000';
  let s = String(h).trim();
  if (s[0] !== '#') s = '#' + s;
  if (s.length === 4) s = '#' + s[1]+s[1] + s[2]+s[2] + s[3]+s[3];
  return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : '#000000';
}

function _buildShadowCss({ x, y, blur, color, alpha }) {
  const h = _hex6(color).replace('#','');
  const r = parseInt(h.slice(0,2), 16);
  const g = parseInt(h.slice(2,4), 16);
  const b = parseInt(h.slice(4,6), 16);
  const a = Math.max(0, Math.min(1, (alpha ?? 100) / 100));
  const col = a >= 1 ? `#${h}` : `rgba(${r},${g},${b},${a})`;
  return `${x}px ${y}px ${blur}px ${col}`;
}

/** 현재 contentEl에서 shadow 상태를 읽어 객체로 반환 */
export function readShadowState(contentEl) {
  if (!contentEl) return { ...SHADOW_DEFAULTS };
  const ds = contentEl.dataset || {};
  const enabled = ds.shadowEnabled === 'true';
  const x     = ds.shadowX     !== undefined ? parseInt(ds.shadowX, 10)     : SHADOW_DEFAULTS.x;
  const y     = ds.shadowY     !== undefined ? parseInt(ds.shadowY, 10)     : SHADOW_DEFAULTS.y;
  const blur  = ds.shadowBlur  !== undefined ? parseInt(ds.shadowBlur, 10)  : SHADOW_DEFAULTS.blur;
  const color = ds.shadowColor || SHADOW_DEFAULTS.color;
  const alpha = ds.shadowAlpha !== undefined ? parseInt(ds.shadowAlpha, 10) : SHADOW_DEFAULTS.alpha;
  return {
    enabled,
    x: isNaN(x) ? SHADOW_DEFAULTS.x : x,
    y: isNaN(y) ? SHADOW_DEFAULTS.y : y,
    blur: isNaN(blur) ? SHADOW_DEFAULTS.blur : blur,
    color,
    alpha: isNaN(alpha) ? SHADOW_DEFAULTS.alpha : alpha,
  };
}

/** Wire up the Shadow controls in the right panel */
export function wireShadowSection({ ctx, initial }) {
  const section = document.getElementById('txt-shadow-section');
  if (!section) return;

  const onChk  = document.getElementById('txt-shadow-on');
  const xSli   = document.getElementById('txt-shadow-x-slider');
  const xNum   = document.getElementById('txt-shadow-x-number');
  const ySli   = document.getElementById('txt-shadow-y-slider');
  const yNum   = document.getElementById('txt-shadow-y-number');
  const bSli   = document.getElementById('txt-shadow-blur-slider');
  const bNum   = document.getElementById('txt-shadow-blur-number');
  const cPick  = document.getElementById('txt-shadow-color');
  const cHex   = document.getElementById('txt-shadow-color-hex');
  const cAlpha = document.getElementById('txt-shadow-color-alpha');
  const cSwatch= cPick?.closest('.prop-color-swatch');
  const ctrls  = document.getElementById('txt-shadow-controls');

  // 내부 state (initial 복제)
  const s = { ...SHADOW_DEFAULTS, ...(initial || {}) };

  const _setCtrlsDisabled = (disabled) => {
    if (!ctrls) return;
    ctrls.style.opacity = disabled ? '0.45' : '';
    ctrls.style.pointerEvents = disabled ? 'none' : '';
  };

  const _apply = () => {
    if (!ctx.contentEl) return;
    const el = ctx.contentEl;
    if (s.enabled) {
      el.style.textShadow = _buildShadowCss(s);
      el.dataset.shadowEnabled = 'true';
    } else {
      el.style.textShadow = '';
      el.dataset.shadowEnabled = 'false';
    }
    // 항상 dataset에 값 저장 (off여도 복원 시 슬라이더 위치 유지)
    el.dataset.shadowX = String(s.x);
    el.dataset.shadowY = String(s.y);
    el.dataset.shadowBlur = String(s.blur);
    el.dataset.shadowColor = _hex6(s.color);
    el.dataset.shadowAlpha = String(s.alpha);
    if (cSwatch) {
      const h = _hex6(s.color).replace('#','');
      const r = parseInt(h.slice(0,2), 16);
      const g = parseInt(h.slice(2,4), 16);
      const b = parseInt(h.slice(4,6), 16);
      const a = Math.max(0, Math.min(1, s.alpha / 100));
      cSwatch.style.background = a >= 1 ? '#'+h : `rgba(${r},${g},${b},${a})`;
    }
  };

  // 초기 상태
  _setCtrlsDisabled(!s.enabled);

  // 토글
  if (onChk) {
    onChk.addEventListener('change', () => {
      window.pushHistory?.();
      s.enabled = !!onChk.checked;
      _setCtrlsDisabled(!s.enabled);
      _apply();
    });
  }

  // X
  const _setX = (v) => {
    v = Math.max(-20, Math.min(20, isNaN(v) ? 0 : v));
    s.x = v;
    if (xSli) xSli.value = String(v);
    if (xNum) xNum.value = String(v);
    _apply();
  };
  xSli?.addEventListener('input',  e => _setX(parseInt(e.target.value, 10)));
  xSli?.addEventListener('change', () => window.pushHistory?.());
  xNum?.addEventListener('input',  e => _setX(parseInt(e.target.value, 10)));
  xNum?.addEventListener('change', () => window.pushHistory?.());

  // Y
  const _setY = (v) => {
    v = Math.max(-20, Math.min(20, isNaN(v) ? 0 : v));
    s.y = v;
    if (ySli) ySli.value = String(v);
    if (yNum) yNum.value = String(v);
    _apply();
  };
  ySli?.addEventListener('input',  e => _setY(parseInt(e.target.value, 10)));
  ySli?.addEventListener('change', () => window.pushHistory?.());
  yNum?.addEventListener('input',  e => _setY(parseInt(e.target.value, 10)));
  yNum?.addEventListener('change', () => window.pushHistory?.());

  // Blur
  const _setB = (v) => {
    v = Math.max(0, Math.min(40, isNaN(v) ? 0 : v));
    s.blur = v;
    if (bSli) bSli.value = String(v);
    if (bNum) bNum.value = String(v);
    _apply();
  };
  bSli?.addEventListener('input',  e => _setB(parseInt(e.target.value, 10)));
  bSli?.addEventListener('change', () => window.pushHistory?.());
  bNum?.addEventListener('input',  e => _setB(parseInt(e.target.value, 10)));
  bNum?.addEventListener('change', () => window.pushHistory?.());

  // 색상
  cPick?.addEventListener('input', () => {
    s.color = _hex6(cPick.value);
    if (cHex) cHex.value = s.color.replace('#','').toUpperCase();
    _apply();
  });
  cPick?.addEventListener('change', () => window.pushHistory?.());
  cHex?.addEventListener('input', () => {
    const v = cHex.value.trim().replace(/^#/, '');
    if (/^[0-9a-f]{6}$/i.test(v)) {
      s.color = '#' + v.toLowerCase();
      if (cPick) cPick.value = s.color;
      _apply();
    }
  });
  cHex?.addEventListener('blur', () => {
    if (cHex) cHex.value = _hex6(s.color).replace('#','').toUpperCase();
  });
  cHex?.addEventListener('change', () => {
    const v = cHex.value.trim().replace(/^#/, '');
    if (/^[0-9a-f]{6}$/i.test(v)) window.pushHistory?.();
  });
  cAlpha?.addEventListener('input', () => {
    const m = cAlpha.value.match(/(\d+)/);
    if (!m) return;
    s.alpha = Math.max(0, Math.min(100, parseInt(m[1], 10)));
    _apply();
  });
  cAlpha?.addEventListener('blur', () => { if (cAlpha) cAlpha.value = String(s.alpha); });
  cAlpha?.addEventListener('change', () => window.pushHistory?.());
}
