/**
 * design-system.js — 프로젝트 디자인 시스템 (step2-design-system)
 *
 * 에디터 UI가 아닌, 캔버스 섹션/블록에 적용되는 디자인 토큰을 관리한다.
 * --preset-* CSS 변수를 :root에 적용 → 전체 캔버스에 일괄 반영.
 * 기존 presets/*.json을 베이스로 선택 후 커스터마이징 가능.
 */

'use strict';

const DesignSystem = (() => {
  const STORAGE_KEY        = 'we_design_system_v1';
  const STORAGE_BASE_KEY   = 'we_design_system_base_v1';
  const STORAGE_COLORS_KEY = 'we_color_vars_v1';

  // 시맨틱 컬러 변수 기본값 (피그마 Variables 유사 — 메인/보조/강조)
  // --preset-* 계열과 충돌하지 않도록 별도 네임스페이스(--color-*) 사용.
  const DEFAULT_COLOR_VARS = {
    primary:   '#6b9eff',  // Claude 톤 블루
    secondary: '#333333',
    accent:    '#ff6b6b',
  };

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

  // ── 시맨틱 컬러 변수 저장/로드 ───────────────────────
  // 저장 위치 2곳:
  //   1) localStorage(STORAGE_COLORS_KEY) — 단일 출처(source of truth)
  //   2) localStorage(STORAGE_KEY).colorVars — 스펙 요구(기존 토큰과 공존). applyTokens는 이 키를 건너뜀.
  //   3) project.meta.json.colorVars — Electron 프로젝트 저장 경로(saveProjectMeta)로 동기화

  function _loadColorVars() {
    try {
      const raw = localStorage.getItem(STORAGE_COLORS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    // 폴백: 기존 토큰 객체 안에 colorVars가 섞여 저장돼 있을 수 있음(스키마 통합 케이스)
    try {
      const embedded = _load().colorVars;
      if (embedded && typeof embedded === 'object') return { ...embedded };
    } catch {}
    return { ...DEFAULT_COLOR_VARS };
  }

  function _saveColorVars(colorVars) {
    // 1) 전용 키
    try { localStorage.setItem(STORAGE_COLORS_KEY, JSON.stringify(colorVars)); } catch {}
    // 2) 기존 디자인시스템 객체에도 colorVars 키로 공존 저장(스펙 요구). 기존 토큰은 보존.
    try {
      const tokens = _load();
      tokens.colorVars = colorVars;
      _save(tokens);
    } catch {}
    // 3) meta.json 동기화 (Electron) — 기존 meta(branches/commits/thumbnail 등) 보존 후 colorVars만 추가
    _syncColorVarsToMeta(colorVars);
  }

  /** Electron 프로젝트 meta.json에 colorVars 동기화 (기존 필드 보존 merge) */
  async function _syncColorVarsToMeta(colorVars) {
    try {
      const pid = window.activeProjectId;
      if (!pid || !window.electronAPI?.saveProjectMeta) return; // 브라우저/프로젝트 미오픈 시 skip
      const existing = await window.electronAPI.loadProjectMeta(pid).catch(() => null);
      await window.electronAPI.saveProjectMeta(pid, {
        ...(existing || {}),
        colorVars,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('[DesignSystem] colorVars meta 동기화 실패:', e);
    }
  }

  // ── 시맨틱 컬러 변수 공개 API ────────────────────────

  /** 현재 시맨틱 컬러 변수 맵 반환 (없으면 기본 3개) */
  function getColorVars() {
    return { ..._loadColorVars() };
  }

  /** 컬러 변수 추가/갱신 → :root 적용 + 저장 + 이벤트 dispatch */
  function setColorVar(name, hex) {
    if (!name) return getColorVars();
    const colorVars = _loadColorVars();
    colorVars[name] = hex;
    _saveColorVars(colorVars);
    applyColorVars();
    _dispatchColorVarsChanged(colorVars);
    return { ...colorVars };
  }

  /** 컬러 변수 삭제 → :root에서도 제거 + 저장 + 이벤트 dispatch */
  function removeColorVar(name) {
    const colorVars = _loadColorVars();
    if (!(name in colorVars)) return { ...colorVars };
    delete colorVars[name];
    _saveColorVars(colorVars);
    // :root에서 해당 CSS 변수 제거
    document.documentElement.style.removeProperty('--color-' + name);
    applyColorVars();
    _dispatchColorVarsChanged(colorVars);
    return { ...colorVars };
  }

  /** 각 컬러 변수를 :root에 --color-<name> 으로 적용 (applyTokens 패턴 미러) */
  function applyColorVars() {
    const root = document.documentElement;
    const colorVars = _loadColorVars();
    Object.entries(colorVars).forEach(([name, hex]) => {
      root.style.setProperty('--color-' + name, hex);
    });
  }

  function _dispatchColorVarsChanged(colorVars) {
    try {
      document.dispatchEvent(new CustomEvent('colorvars-changed', {
        detail: { colorVars: { ...colorVars } },
      }));
    } catch {}
  }

  // ── 캔버스 적용 ─────────────────────────────────────

  /** 토큰 맵을 :root CSS 변수로 적용 → 전체 캔버스 블록에 반영 */
  function applyTokens(tokens) {
    const root = document.documentElement;
    Object.entries(tokens).forEach(([k, v]) => {
      // colorVars는 별도 경로(applyColorVars)에서 --color-* 로 적용하므로 토큰 맵 적용 시 건너뜀.
      // (객체 값이 setProperty에 들어가 '[object Object]'로 오염되는 것을 방지)
      if (k === 'colorVars' || typeof v !== 'string') return;
      root.style.setProperty(k, v);
    });
  }

  // ── 프리셋 베이스 선택 ──────────────────────────────

  /** 기존 PRESETS 배열에서 베이스를 골라 :root에 적용 */
  async function applyBase(presetId) {
    // window.PRESETS(editor.js module) 또는 electronAPI로 직접 로드
    let presets = window.PRESETS;
    if (!presets?.length && window.electronAPI?.readPresets) {
      presets = await window.electronAPI.readPresets();
      // 캐시: 이후 _currentBase() 에서도 사용 가능하도록 저장
      if (presets?.length) window.PRESETS = presets;
    }
    const preset = (presets || []).find(p => p.id === presetId);
    if (!preset) return;
    const tokens = { ...DEFAULT_TOKENS, ...preset.variables };
    applyTokens(tokens);
    _save(tokens);
    // 활성 프리셋 ID를 별도 저장 → _currentBase() 가 즉시 읽을 수 있음
    localStorage.setItem(STORAGE_BASE_KEY, presetId);
    syncPanelUI(tokens);
    // 전체 테마 전환 시 개별 섹션에 인라인으로 적용된 --preset-* 변수를 제거.
    // :root 변경이 섹션 인라인 변수에 가려지는 것을 방지.
    // (사용자가 섹션별로 설정한 preset 커스터마이징도 함께 초기화됨 — 전체 테마 전환의 의도된 동작)
    document.querySelectorAll('.section-block').forEach(sec => {
      const style = sec.style;
      [...style].filter(p => p.startsWith('--preset-')).forEach(p => style.removeProperty(p));
      delete sec.dataset.preset;
    });
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

    // C14: 드롭다운 active 표시
    const baseSelect = document.getElementById('ds-base-select');
    if (baseSelect) baseSelect.value = _currentBase();
  }

  // ── C15: 신규 디자인시스템 저장 ──────────────────────

  async function saveNewPreset() {
    const name = prompt('새 디자인시스템 이름을 입력하세요:');
    if (!name || !name.trim()) return;
    const trimmedName = name.trim();
    const id = trimmedName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // 현재 토큰값 수집 (colorVars는 프리셋 variables에 포함하지 않음 — 별도 시스템)
    const { colorVars: _cv, ...tokens } = _load();
    const preset = { id, name: trimmedName, variables: { ...tokens } };

    // electronAPI로 저장 (있을 경우)
    if (window.electronAPI?.savePreset) {
      try {
        await window.electronAPI.savePreset(preset);
      } catch (e) {
        console.warn('[DesignSystem] savePreset failed:', e);
      }
    }

    // 드롭다운에 즉시 반영
    const baseSelect = document.getElementById('ds-base-select');
    if (baseSelect) {
      const exists = baseSelect.querySelector(`option[value="${id}"]`);
      if (!exists) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = trimmedName;
        baseSelect.appendChild(opt);
      }
      baseSelect.value = id;
    }

    // window.PRESETS 캐시도 업데이트
    if (!window.PRESETS) window.PRESETS = [];
    const existsPreset = window.PRESETS.find(p => p.id === id);
    if (!existsPreset) window.PRESETS.push(preset);

    // 저장된 베이스 ID 업데이트
    localStorage.setItem(STORAGE_BASE_KEY, id);
    alert(`"${trimmedName}" 디자인시스템이 저장되었습니다.`);
  }

  function _currentBase() {
    // 1순위: applyBase() 호출 시 저장한 명시적 presetId
    const saved = localStorage.getItem(STORAGE_BASE_KEY);
    if (saved) return saved;
    // 2순위: window.PRESETS 캐시가 있으면 토큰 비교
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
    // 커스텀 편집 시 저장된 베이스 ID 초기화 (어떤 preset과도 일치하지 않음)
    localStorage.removeItem(STORAGE_BASE_KEY);
    // 버튼 active 상태도 즉시 갱신
    document.querySelectorAll('.ds-base-btn').forEach(btn => btn.classList.remove('active'));
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
    localStorage.setItem(STORAGE_BASE_KEY, 'default');
    applyTokens(DEFAULT_TOKENS);
    syncPanelUI(DEFAULT_TOKENS);
  }

  function togglePanel() {
    const panel = document.getElementById('design-system-panel');
    if (!panel) return;
    panel.classList.toggle('open');
  }

  // ── 프로젝트 열 때 복원 ──────────────────────────────

  /**
   * 프로젝트 meta.json의 colorVars를 복원 → localStorage 동기화 + :root 적용.
   * 프로젝트 로드 직후 호출(branch-system.initBranchStore 패턴과 동일하게 meta 우선).
   * meta에 colorVars가 없으면 localStorage 값(기존 동작)을 유지.
   */
  async function restoreColorVarsFromMeta(projectId) {
    const pid = projectId || window.activeProjectId;
    try {
      if (pid && window.electronAPI?.loadProjectMeta) {
        const meta = await window.electronAPI.loadProjectMeta(pid).catch(() => null);
        const cv = meta?.colorVars;
        if (cv && typeof cv === 'object' && Object.keys(cv).length) {
          // meta를 source of truth로 — localStorage 두 곳에 캐시
          try { localStorage.setItem(STORAGE_COLORS_KEY, JSON.stringify(cv)); } catch {}
          try { const t = _load(); t.colorVars = cv; _save(t); } catch {}
          applyColorVars();
          _dispatchColorVarsChanged(cv);
          return cv;
        }
      }
    } catch (e) {
      console.warn('[DesignSystem] restoreColorVarsFromMeta 실패:', e);
    }
    // meta 없음/브라우저 → 로컬 값으로 적용 (backward compat)
    applyColorVars();
    return getColorVars();
  }

  // ── 초기화 ───────────────────────────────────────────

  function init() {
    const tokens = _load();
    applyTokens(tokens);
    // 시맨틱 컬러 변수 :root 적용 (applyTokens 호출 지점 미러)
    applyColorVars();

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

    // C14: 드롭다운 선택 시 즉시 applyBase() 호출
    const baseSelect = document.getElementById('ds-base-select');
    if (baseSelect) {
      baseSelect.addEventListener('change', () => {
        applyBase(baseSelect.value);
      });
    }

    syncPanelUI(tokens);
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    applyBase, applyFromPanel, resetTokens, togglePanel, syncPanelUI, saveNewPreset,
    // 시맨틱 컬러 변수 (팀 B 패널 / 팀 C 칩이 의존하는 공유 인터페이스)
    getColorVars, setColorVar, removeColorVar, applyColorVars, restoreColorVarsFromMeta,
  };
})();

window.DesignSystem = DesignSystem;
