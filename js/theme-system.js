/**
 * theme-system.js — 테마 토큰 관리 (step2-ds-tokens)
 *
 * 토큰 매핑:
 *   Primary   → --ui-accent-primary, --sel-color
 *   Text      → --ui-text, --preset-h1-color, --preset-h2-color, --preset-h3-color, --preset-body-color
 *   Background → --ui-bg-app, --ui-bg-base, --ui-bg-elevated
 */

const ThemeSystem = (() => {
  const STORAGE_KEY = 'we_theme_v1';

  // 기본 토큰 값 (editor.css :root 기준)
  const DEFAULT_TOKENS = {
    primary:    '#2d6fe8',
    text:       '#e0e0e0',
    background: '#1a1a1a',
  };

  // ──────────────────────────────────────────────
  // 내부 유틸
  // ──────────────────────────────────────────────

  /** hex 문자열을 검증하고 6자리 hex로 정규화 */
  function normalizeHex(value) {
    let v = value.trim();
    if (!v.startsWith('#')) v = '#' + v;
    // 3자리 축약형 → 6자리 변환
    if (/^#[0-9a-fA-F]{3}$/.test(v)) {
      v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
    }
    return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null;
  }

  /** hex 색상을 rgb 컴포넌트로 변환 */
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  /** Primary 색상 기반으로 hover/fill rgba 파생값 계산 */
  function deriveAccentVariants(primaryHex) {
    const { r, g, b } = hexToRgb(primaryHex);
    // --ui-accent: primary보다 밝은 라이트 변형 (브랜치/포커스 UI용)
    const lighten = (v) => Math.min(255, Math.round(v + (255 - v) * 0.35));
    const accentLight = `#${lighten(r).toString(16).padStart(2,'0')}${lighten(g).toString(16).padStart(2,'0')}${lighten(b).toString(16).padStart(2,'0')}`;
    return {
      hover: `rgba(${r},${g},${b},0.4)`,
      fill:  `rgba(${r},${g},${b},0.08)`,
      light: accentLight,
    };
  }

  /** Background 색상 기반으로 파생 배경값 계산 (밝기 단계별 조정) */
  function deriveBgVariants(bgHex) {
    const { r, g, b } = hexToRgb(bgHex);
    const step = (n) => {
      const v = Math.min(255, n);
      return v.toString(16).padStart(2, '0');
    };
    const lift = (amt) => `#${step(r + amt)}${step(g + amt)}${step(b + amt)}`;
    return {
      base:     lift(4),   // --ui-bg-base
      elevated: lift(10),  // --ui-bg-elevated
      card:     lift(11),  // --ui-bg-card
      input:    lift(16),  // --ui-bg-input
      hover:    lift(20),  // --ui-bg-hover
      border:   lift(25),  // --ui-border
    };
  }

  // ──────────────────────────────────────────────
  // 공개 API
  // ──────────────────────────────────────────────

  /**
   * applyTheme(tokens)
   * tokens: { primary, text, background }  (모두 #rrggbb 문자열)
   *
   * 동작:
   * 1. document.documentElement에 CSS 변수 덮어씌우기
   * 2. canvas 내 inline style에서 이전 토큰 값을 새 값으로 교체
   */
  function applyTheme(tokens) {
    const primary    = normalizeHex(tokens.primary    || DEFAULT_TOKENS.primary);
    const text       = normalizeHex(tokens.text       || DEFAULT_TOKENS.text);
    const background = normalizeHex(tokens.background || DEFAULT_TOKENS.background);

    if (!primary || !text || !background) {
      console.warn('[ThemeSystem] 유효하지 않은 토큰 값:', tokens);
      return false;
    }

    const root = document.documentElement;
    const accent = deriveAccentVariants(primary);
    const bg     = deriveBgVariants(background);

    // Primary 관련 변수
    root.style.setProperty('--ui-accent-primary',   primary);
    root.style.setProperty('--sel-color',            primary);
    root.style.setProperty('--sel-color-hover',      accent.hover);
    root.style.setProperty('--sel-color-fill',       accent.fill);
    root.style.setProperty('--ui-accent',            accent.light);  /* 브랜치/focus UI 밝은 파생색 */

    // Text 관련 변수
    root.style.setProperty('--ui-text',              text);
    root.style.setProperty('--preset-h1-color',      text);
    root.style.setProperty('--preset-h2-color',      text);
    root.style.setProperty('--preset-h3-color',      text);
    root.style.setProperty('--preset-body-color',    text);

    // Background 관련 변수
    root.style.setProperty('--ui-bg-app',            background);
    root.style.setProperty('--ui-bg-base',           bg.base);
    root.style.setProperty('--ui-bg-elevated',       bg.elevated);
    root.style.setProperty('--ui-bg-card',           bg.card);
    root.style.setProperty('--ui-bg-input',          bg.input);
    root.style.setProperty('--ui-bg-hover',          bg.hover);
    root.style.setProperty('--ui-border',            bg.border);

    // 캔버스 내 inline style 순회 교체
    _replaceCanvasInlineColors(tokens, { primary, text, background });

    return true;
  }

  /**
   * 캔버스 DOM 내 inline style에서 이전 저장된 토큰 색상을 새 색상으로 교체
   * inline style은 정확히 토큰 값과 일치하는 경우만 교체 (의도하지 않은 색상 변경 방지)
   */
  function _replaceCanvasInlineColors(oldTokens, newTokens) {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;

    const saved = loadTheme();
    // 이전에 적용된 값과 새 값을 매핑
    const colorMap = {
      [normalizeHex(saved.primary)    || DEFAULT_TOKENS.primary]:    newTokens.primary,
      [normalizeHex(saved.text)       || DEFAULT_TOKENS.text]:       newTokens.text,
      [normalizeHex(saved.background) || DEFAULT_TOKENS.background]: newTokens.background,
    };

    const elements = canvas.querySelectorAll('[style]');
    elements.forEach(el => {
      let style = el.getAttribute('style');
      let changed = false;
      Object.entries(colorMap).forEach(([oldColor, newColor]) => {
        if (oldColor === newColor) return;
        // 대소문자 무관 교체 (inline style은 소문자가 보통이나 안전하게 처리)
        const regex = new RegExp(oldColor.replace('#', '#?').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        if (regex.test(style)) {
          style = style.replace(regex, newColor);
          changed = true;
        }
      });
      if (changed) el.setAttribute('style', style);
    });
  }

  /**
   * saveTheme(tokens)
   * localStorage에 현재 토큰 저장
   */
  function saveTheme(tokens) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    } catch (e) {
      console.warn('[ThemeSystem] localStorage 저장 실패:', e);
    }
  }

  /**
   * loadTheme()
   * localStorage에서 저장된 토큰 불러오기
   * 없으면 DEFAULT_TOKENS 반환
   */
  function loadTheme() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          primary:    parsed.primary    || DEFAULT_TOKENS.primary,
          text:       parsed.text       || DEFAULT_TOKENS.text,
          background: parsed.background || DEFAULT_TOKENS.background,
        };
      }
    } catch (e) {
      console.warn('[ThemeSystem] localStorage 읽기 실패:', e);
    }
    return { ...DEFAULT_TOKENS };
  }

  /**
   * resetTheme()
   * 기본값으로 초기화 후 패널 UI도 동기화
   */
  function resetTheme() {
    localStorage.removeItem(STORAGE_KEY);
    applyTheme({ ...DEFAULT_TOKENS });
    _syncPanelUI(DEFAULT_TOKENS);
  }

  /**
   * applyFromPanel()
   * 패널의 color input 값으로 테마 적용 후 저장
   */
  function applyFromPanel() {
    const primary    = document.getElementById('token-primary')?.value || DEFAULT_TOKENS.primary;
    const text       = document.getElementById('token-text')?.value    || DEFAULT_TOKENS.text;
    const background = document.getElementById('token-bg')?.value      || DEFAULT_TOKENS.background;

    const tokens = { primary, text, background };
    const ok = applyTheme(tokens);
    if (ok) {
      saveTheme(tokens);
      _syncPanelUI(tokens);
    }
  }

  /**
   * togglePanel()
   * 테마 패널 접기/펼치기
   */
  function togglePanel() {
    const panel = document.getElementById('theme-panel');
    if (!panel) return;
    panel.classList.toggle('open');
  }

  // ──────────────────────────────────────────────
  // 패널 UI 동기화
  // ──────────────────────────────────────────────

  function _syncPanelUI(tokens) {
    const primary    = normalizeHex(tokens.primary)    || DEFAULT_TOKENS.primary;
    const text       = normalizeHex(tokens.text)       || DEFAULT_TOKENS.text;
    const background = normalizeHex(tokens.background) || DEFAULT_TOKENS.background;

    const elP    = document.getElementById('token-primary');
    const elPHex = document.getElementById('token-primary-hex');
    const elT    = document.getElementById('token-text');
    const elTHex = document.getElementById('token-text-hex');
    const elB    = document.getElementById('token-bg');
    const elBHex = document.getElementById('token-bg-hex');

    if (elP)    elP.value    = primary;
    if (elPHex) elPHex.value = primary;
    if (elT)    elT.value    = text;
    if (elTHex) elTHex.value = text;
    if (elB)    elB.value    = background;
    if (elBHex) elBHex.value = background;
  }

  // ──────────────────────────────────────────────
  // color input ↔ hex input 양방향 동기화 바인딩
  // ──────────────────────────────────────────────

  function _bindColorHexSync(colorId, hexId) {
    const colorEl = document.getElementById(colorId);
    const hexEl   = document.getElementById(hexId);
    if (!colorEl || !hexEl) return;

    colorEl.addEventListener('input', () => {
      hexEl.value = colorEl.value;
    });

    hexEl.addEventListener('input', () => {
      const normalized = normalizeHex(hexEl.value);
      if (normalized) {
        colorEl.value = normalized;
        hexEl.value   = normalized;
      }
    });

    hexEl.addEventListener('blur', () => {
      const normalized = normalizeHex(hexEl.value);
      hexEl.value = normalized || colorEl.value;
      colorEl.value = hexEl.value;
    });
  }

  // ──────────────────────────────────────────────
  // 초기화 (DOMContentLoaded)
  // ──────────────────────────────────────────────

  function _init() {
    // 저장된 테마 불러와 적용
    const saved = loadTheme();
    applyTheme(saved);
    _syncPanelUI(saved);

    // color ↔ hex 양방향 바인딩
    _bindColorHexSync('token-primary',    'token-primary-hex');
    _bindColorHexSync('token-text',       'token-text-hex');
    _bindColorHexSync('token-bg',         'token-bg-hex');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  // 공개 API 노출
  return {
    applyTheme,
    saveTheme,
    loadTheme,
    resetTheme,
    applyFromPanel,
    togglePanel,
  };
})();
