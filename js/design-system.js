/**
 * design-system.js — 프로젝트 디자인 시스템 (step2-design-system)
 *
 * 에디터 UI가 아닌, 캔버스 섹션/블록에 적용되는 디자인 토큰을 관리한다.
 * --preset-* CSS 변수를 :root에 적용 → 전체 캔버스에 일괄 반영.
 * 기존 presets/*.json을 베이스로 선택 후 커스터마이징 가능.
 */

'use strict';

const DesignSystem = (() => {
  const STORAGE_KEY = 'we_design_system_v1';

  // 토큰 기본값 (default 프리셋 기준)
  const DEFAULT_TOKENS = {
    '--preset-h1-color':      '#111111',
    '--preset-h1-family':     "'Noto Sans KR', sans-serif",
    '--preset-h2-color':      '#1a1a1a',
    '--preset-h2-family':     "'Noto Sans KR', sans-serif",
    '--preset-h3-color':      '#333333',
    '--preset-h3-family':     "'Noto Sans KR', sans-serif",
    '--preset-body-color':    '#555555',
    '--preset-body-family':   "'Noto Sans KR', sans-serif",
    '--preset-caption-color': '#999999',
    '--preset-label-bg':      '#111111',
    '--preset-label-color':   '#ffffff',
    '--preset-label-radius':  '8px',
  };

  // ── 저장/로드 ───────────────────────────────────────

  function _load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { ...DEFAULT_TOKENS };
    } catch {
      return { ...DEFAULT_TOKENS };
    }
  }

  function _save(tokens) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  }

  // ── 캔버스 적용 ─────────────────────────────────────

  /** 토큰 맵을 :root CSS 변수로 적용 → 전체 캔버스 블록에 반영 */
  function applyTokens(tokens) {
    const root = document.documentElement;
    Object.entries(tokens).forEach(([k, v]) => root.style.setProperty(k, v));
  }

  // ── 프리셋 베이스 선택 ──────────────────────────────

  /** 기존 PRESETS 배열에서 베이스를 골라 :root에 적용 */
  function applyBase(presetId) {
    const preset = (window.PRESETS || []).find(p => p.id === presetId);
    if (!preset) return;
    const tokens = { ...DEFAULT_TOKENS, ...preset.variables };
    applyTokens(tokens);
    _save(tokens);
    syncPanelUI(tokens);
  }

  // ── 패널 UI ─────────────────────────────────────────

  function _hex(varName) {
    const v = document.documentElement.style.getPropertyValue(varName).trim()
           || getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    // rgb() → hex 변환
    const rgb = v.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (rgb) {
      return '#' + [rgb[1], rgb[2], rgb[3]].map(n => (+n).toString(16).padStart(2, '0')).join('');
    }
    return v || '#000000';
  }

  function syncPanelUI(tokens) {
    const set = (id, varName) => {
      const el = document.getElementById(id);
      if (!el) return;
      const val = tokens[varName] || _hex(varName);
      el.value = val;
      const hex = document.getElementById(id + '-hex');
      if (hex) hex.value = val;
    };
    set('ds-h1-color',    '--preset-h1-color');
    set('ds-body-color',  '--preset-body-color');
    set('ds-caption-color', '--preset-caption-color');
    set('ds-label-bg',    '--preset-label-bg');
    set('ds-label-color', '--preset-label-color');

    // 폰트 셀렉트
    const hFont = document.getElementById('ds-heading-font');
    if (hFont) hFont.value = (tokens['--preset-h1-family'] || '').replace(/'/g, '').split(',')[0].trim();
    const bFont = document.getElementById('ds-body-font');
    if (bFont) bFont.value = (tokens['--preset-body-family'] || '').replace(/'/g, '').split(',')[0].trim();

    // Label Radius
    const rad = document.getElementById('ds-label-radius');
    if (rad) rad.value = parseInt(tokens['--preset-label-radius']) || 8;
    const radVal = document.getElementById('ds-label-radius-val');
    if (radVal) radVal.textContent = (parseInt(tokens['--preset-label-radius']) || 8) + 'px';

    // 활성 베이스 표시
    document.querySelectorAll('.ds-base-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.presetId === _currentBase());
    });
  }

  function _currentBase() {
    const tokens = _load();
    const presets = window.PRESETS || [];
    for (const p of presets) {
      if (p.id === 'default') continue;
      const match = Object.entries(p.variables).every(([k, v]) => tokens[k] === v);
      if (match) return p.id;
    }
    return 'default';
  }

  // ── 패널에서 적용 ────────────────────────────────────

  function applyFromPanel() {
    const get = (id) => document.getElementById(id)?.value || '';

    const headingFont = get('ds-heading-font');
    const bodyFont    = get('ds-body-font');
    const headingFontVal = `'${headingFont}', sans-serif`;
    const bodyFontVal    = `'${bodyFont}', sans-serif`;
    const radius = (get('ds-label-radius') || '8') + 'px';

    const h1Color = get('ds-h1-color');
    const bodyColor = get('ds-body-color');
    const captionColor = get('ds-caption-color');

    const tokens = {
      '--preset-h1-color':      h1Color,
      '--preset-h1-family':     headingFontVal,
      '--preset-h2-color':      _lighten(h1Color, 0.1),
      '--preset-h2-family':     headingFontVal,
      '--preset-h3-color':      _lighten(h1Color, 0.2),
      '--preset-h3-family':     headingFontVal,
      '--preset-body-color':    bodyColor,
      '--preset-body-family':   bodyFontVal,
      '--preset-caption-color': captionColor,
      '--preset-label-bg':      get('ds-label-bg'),
      '--preset-label-color':   get('ds-label-color'),
      '--preset-label-radius':  radius,
    };

    applyTokens(tokens);
    _save(tokens);
  }

  /** hex 색상을 amount(0~1) 만큼 밝게 */
  function _lighten(hex, amount) {
    const h = hex.replace('#', '');
    if (h.length !== 6) return hex;
    const r = Math.min(255, parseInt(h.slice(0, 2), 16) + Math.round(255 * amount));
    const g = Math.min(255, parseInt(h.slice(2, 4), 16) + Math.round(255 * amount));
    const b = Math.min(255, parseInt(h.slice(4, 6), 16) + Math.round(255 * amount));
    return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
  }

  function resetTokens() {
    _save({ ...DEFAULT_TOKENS });
    applyTokens(DEFAULT_TOKENS);
    syncPanelUI(DEFAULT_TOKENS);
  }

  function togglePanel() {
    const panel = document.getElementById('design-system-panel');
    if (!panel) return;
    panel.classList.toggle('open');
  }

  // ── 초기화 ───────────────────────────────────────────

  function init() {
    const tokens = _load();
    applyTokens(tokens);

    // color picker ↔ hex 양방향 동기화
    ['ds-h1-color', 'ds-body-color', 'ds-caption-color', 'ds-label-bg', 'ds-label-color'].forEach(id => {
      const picker = document.getElementById(id);
      const hex    = document.getElementById(id + '-hex');
      if (picker && hex) {
        picker.addEventListener('input', () => { hex.value = picker.value; });
        hex.addEventListener('input', () => {
          if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) picker.value = hex.value;
        });
      }
    });

    // radius 슬라이더
    const radSlider = document.getElementById('ds-label-radius');
    const radVal    = document.getElementById('ds-label-radius-val');
    if (radSlider && radVal) {
      radSlider.addEventListener('input', () => { radVal.textContent = radSlider.value + 'px'; });
    }

    syncPanelUI(tokens);
  }

  document.addEventListener('DOMContentLoaded', init);

  return { applyBase, applyFromPanel, resetTokens, togglePanel, syncPanelUI };
})();

window.DesignSystem = DesignSystem;
