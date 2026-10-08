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
  const STORAGE_HISTORY_KEY = 'we_color_history_v1';   // 컬러 히스토리(최근 쓴 색) 작업 캐시 — 정본은 meta.colorHistory
  /* ★최근 쓴 색의 «개수» — 한 줄을 넘기지 않는 수.
     우측 인스펙터 폭 240(css/editor-panels.css --panel-right-w · 폭 조절 UI 없음) 에서 .cv-chips 줄 폭 203
     (margin-left 8 + padding-left 8 + 선 2 를 먹는다) — 칩(20)+사이(4)를 하나씩 더해 «둘째 줄 직전까지» 실측 = 7 · 2026-10-02 태양.
     ⚠️시안의 8 은 패널 여백을 흉내 낸 판에서 잰 수다(실제 패널이 아님). 폭·칩 크기가 바뀌면 같은 법으로 다시 재서 바꿔라. */
  const COLOR_HISTORY_MAX = 7;
  const STORAGE_TEXTSTYLE_KEY = 'we_text_style_history_v1';   // 텍스트 «효과» 히스토리 작업 캐시 — 정본은 meta.textStyleHistory
  /* ★최근 «효과» 한 줄의 개수 — 컬러(위 7)와 ★같은 법으로, ★다시 ★재서 넣었다.
       법 = floor((줄 가용폭 − 라벨폭 − gap) ÷ (칩폭 + gap))
       ★잰 값 2026-10-08 (DOM 하네스 · 패널 폭 240 고정 — css/editor-panels.css:62):
         ★줄 가용폭 ★193 · ★라벨(「최근」)폭 ★18.28 · ★칩폭 ★26 · ★gap ★4(css .cv-chips)
         ⇒ floor((193 − 18.28 − 4) ÷ 30) = ★5
       ⛔컬러의 ★7 을 ★베끼면 틀린다 — 그 칩은 ★점(20px)이고 이것은 ★스타일 입힌 ★글자(26px)다.
       ★★그리고 ★내가 ★처음에 ★안 재고 ★6 으로 박았다가 ★검사에 ★잡혔다
         (tests/dom/text-style-recent.dom.spec.js ★M 이 ★잰 수와 ★이 상수를 ★견준다).
         ⇒ ★칩 폭·패널 폭을 바꾸면 ★그 검사가 ★빨개진다. ★거기 찍힌 세 수로 ★다시 세워라. */
  const TEXT_STYLE_HISTORY_MAX = 5;
  /* ★같은 kind 의 ★연속 손질을 ★한 벌로 묶는 창(ms).
     ★왜 필요한가(실측 2026-10-08): 슬라이더 ★한 번 끌기 = commit ★1회라 ★드래그는 큐를 안 채운다.
       큐를 채우는 것은 ★«다른 칸»이다 — 색 → 높이 → Y 를 한 번씩 손보면 ★3회 commit 이 나고
       그 셋은 ★«하나의 스타일을 다듬는 중»이다. ⇒ 창 안이면 ★맨 앞을 ★덮는다(새로 안 쌓는다).
     ⚠️★이 수는 ★«사람 손 속도»라 ★기계로 못 잰다 — ★UX 선택이다. ⛔「쟀다」로 적지 마라.
       ★검사가 ★이 상수를 ★읽는다(⛔맨숫자를 검사에 박지 않는다 · A6 가 창 안/밖을 ★둘 다 잰다). */
  const TEXT_STYLE_COALESCE_MS = 4000;

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

  /* ★meta.json 쓰기 = «자기 필드만»(patch) 보낸다 — main 이 받는 순간 파일과 원자적으로 합친다(2026-10-02 정정).
     main.js ipcMain.handle('projects:save-meta') 가 동기로 `{ ...cur, ...metaData }` 를 쓴다(132c2b75 · 「H2 다중 writer」).
     ⇒ «한 줄»은 main 의 그 핸들러다. 렌더러가 미리 읽은 meta «전체»를 보내면 main 이 그 «옛 사본»의 다른 필드로
       그사이 갱신된 값을 되돌린다(tests/dom/meta-race Ma — 썸네일이 옛 값으로). 그래서 읽지 않고 patch 만 보낸다.
     ~~[정정 2026-10-02] 「promise 사슬 한 줄로 모은다」 — 렌더러 «안» 차례만 맞출 뿐 다른 writer(썸네일·브랜치·커밋)와의
       경합은 못 막았다. 사슬을 걷었다.~~
     ★지금 이것을 부르는 둘 = ⑴_syncColorVarsToMeta(컬러 변수) ⑵_setColorHistory(최근 쓴 색).
     ⛔meta 에 무엇을 더 쓰는 셋째가 생기면 «미리 읽어 합쳐 보내지» 말고 자기 필드만 보내라(이 함수를 불러도 된다).
       ✔2026-10-02 이 파일 «밖» meta 쓰기도 같은 꼴(patch-only)로 바꿨다: save-load.js 265(저장 썸네일)·400(쉴 때 썸네일) ·
       branch-system.js 37 · commit-system.js 260·401. 원래부터 자기 필드만 보내던 둘 = save-load.js 2063 · collab/accept.js 104.
       경합 시험 = tests/dom/meta-race(Ma~Mf). */
  function _mergeProjectMeta(patch) {
    const pid = window.activeProjectId;
    if (!pid || !window.electronAPI?.saveProjectMeta) return Promise.resolve(); // 브라우저/프로젝트 미오픈 시 skip
    return Promise.resolve(window.electronAPI.saveProjectMeta(pid, { ...patch, updatedAt: new Date().toISOString() }))
      .catch(e => console.warn('[DesignSystem] meta 쓰기 실패:', e));
  }

  /** Electron 프로젝트 meta.json에 colorVars 동기화 (기존 필드 보존 merge) — 합쳐쓰기 줄 하나(_mergeProjectMeta)를 탄다 */
  async function _syncColorVarsToMeta(colorVars) {
    try {
      await _mergeProjectMeta({ colorVars });
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

  /* 색 코드 칸 표기 = «# 없는 대문자 6자» — 에디터 전체의 정본 표기(2026-09-20 유닛 colorhex).
     ⚠️이 파일은 모듈이 아니라서 공용 함수를 window 로 받는다. color-picker.js 는 module(defer)이라
       DOMContentLoaded(init) 시점엔 «이미» 실려 있다 — 그래도 없을 때를 대비해 같은 규칙을 적어 둔다. */
  const _hexBox = (v) => (window.formatHex6 ? window.formatHex6(v) : String(v ?? '').replace('#', '').toUpperCase());

  function syncPanelUI(tokens) {
    const set = (id, varName) => {
      const el = document.getElementById(id);
      if (!el) return;
      const val = tokens[varName] || _hex(varName);
      el.value = val;
      const hex = document.getElementById(id + '-hex');
      if (hex) hex.value = _hexBox(val);
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

  /* ── 이름 받는 «인라인 폼» — prompt() 대체 (현빈 2026-10-02 「컬러변수 추가가 아예 안 된다」) ─────────────
   *   ⛔Electron 렌더러는 prompt() 를 지원하지 않는다 — 부르는 순간 `Error: prompt() is not supported.` 로 던져
   *     단추가 통째로 죽었다(실앱 스택 design-system.js:521). 이 파일의 prompt 2곳(아래 saveNewPreset · addColorVarFromPanel)이 이 폼을 쓴다.
   *   ★새 모달을 만들지 않는다 — 이 레포에 이미 있는 꼴(variable-binding.js 서랍의 + → 이름칸·저장·취소, 클래스 var-add-form ·
   *     var-input · var-form-actions · var-btn)을 그대로 쓴다. 단추가 있는 줄 «바로 아래»에 열린다.
   *   onSubmit(name) 이 true 를 돌려주면 닫고, false 면 연 채로 둔다(고쳐 칠 수 있게 — 까닭은 onSubmit 이 토스트로 말한다).
   *   Enter = 확인 · Esc/취소 = 닫기(아무것도 안 함). 이미 열려 있으면 다시 열지 않고 칸에 포커스만 준다.
   *   hint(선택) = 칸 위에 보일 안내 글(여러 줄 가능 · textContent 로 넣는다). 브랜치 「+ 섹션」이 고를 목록을 여기 보인다(옛 prompt 문구 그대로). */
  function _openInlineNameForm(anchorRow, { id, placeholder, submitLabel = '추가', hint, onSubmit }) {
    if (!anchorRow) return null;
    const exist = document.getElementById(id + '-form');
    if (exist) { exist.querySelector('input')?.focus(); return exist; }
    const form = document.createElement('div');
    form.id = id + '-form';
    form.className = 'var-add-form';
    form.innerHTML = `<input id="${id}-input" class="var-input" placeholder="${placeholder}" />
      <div class="var-form-actions">
        <button type="button" class="var-btn var-btn-primary" data-act="ok">${submitLabel}</button>
        <button type="button" class="var-btn var-btn-ghost" data-act="cancel">취소</button>
      </div>`;
    if (hint) {
      const h = document.createElement('div');
      h.className = 'prop-hint';
      h.style.cssText = 'text-align:left;white-space:pre-line;padding:0';
      h.textContent = hint;
      form.prepend(h);
    }
    anchorRow.insertAdjacentElement('afterend', form);
    const input = form.querySelector('input');
    const close = () => form.remove();
    const submit = async () => { if (await onSubmit(input.value)) close(); else input.focus(); };
    form.querySelector('[data-act="ok"]').addEventListener('click', submit);
    form.querySelector('[data-act="cancel"]').addEventListener('click', close);
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();                       // 편집기 단축키(⌫·⌘Z 등)로 새지 않게
      if (e.isComposing) return;                 // 한글 조합 중 Enter 는 확정이지 제출이 아니다
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    input.focus();
    return form;
  }

  // ── C15: 신규 디자인시스템 저장 ──────────────────────

  function saveNewPreset() {
    const btn = document.querySelector('[onclick*="saveNewPreset"]') || document.getElementById('ds-new-preset-btn');
    _openInlineNameForm(btn?.closest('.ds-base-row') || btn?.parentElement, {
      id: 'ds-preset-name', placeholder: '새 디자인시스템 이름', submitLabel: '저장',
      onSubmit: async (raw) => {
        if (!raw || !raw.trim()) { window.showToast?.('이름을 입력하세요'); return false; }
        await _saveNewPresetNamed(raw);
        return true;
      },
    });
  }

  async function _saveNewPresetNamed(name) {
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
    // 폰트 체인은 prop-text-utils의 fontChain()이 단일 소유(중복 규칙 금지).
    // classic script라 import를 못 써 전역으로 받는다. 미로드 시 기존 동작으로 폴백.
    // ★기존엔 Noto Serif KR을 골라도 `', sans-serif'`가 붙어 serif가 sans로 떨어졌다.
    const _chain = (f) => window.goditorFontChain?.(f) ?? `'${f}', sans-serif`;
    const headingFontVal = _chain(headingFont);
    const bodyFontVal    = _chain(bodyFont);
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
    if (panel.classList.contains('open')) makeSectionsCollapsible();
  }

  /* ★절(Base·Color·컬러 변수·Font·Label Radius)도 «각각» 접힌다(현빈 2026-08-28).
   *   패널 전체 토글만 있어서, 색 하나 보려고 5개 절을 다 펼쳐 놓고 스크롤해야 했다.
   * ★마크업을 안 고치고 «감싼다» — index.html 은 라벨과 내용이 형제로 나열돼 있어
   *   각 행에 손대면 5곳을 다 고쳐야 하고, 절이 늘 때마다 또 고쳐야 한다.
   *   여기서 한 번 감싸면 «절이 늘어도» 자동으로 따라온다.
   * ⛔Apply/Reset(.ds-btn-row)은 어느 절에도 안 넣는다 — 접히면 못 누른다. */
  const _DS_COLLAPSE_KEY = 'goditor.ds.collapsed';
  function makeSectionsCollapsible() {
    const body = document.getElementById('ds-panel-body');
    if (!body || body.dataset.collapsibleReady) return;
    body.dataset.collapsibleReady = '1';

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(_DS_COLLAPSE_KEY) || '{}'); } catch (_) {}

    const labels = [...body.querySelectorAll('.ds-section-label')];
    labels.forEach(label => {
      const name = label.textContent.trim();
      const wrap = document.createElement('div');
      wrap.className = 'ds-section-body';
      // 다음 절 라벨 «전»까지, 그리고 버튼 줄은 «빼고» 담는다.
      let node = label.nextElementSibling;
      while (node && !node.classList.contains('ds-section-label') && !node.classList.contains('ds-btn-row')) {
        const next = node.nextElementSibling;
        wrap.appendChild(node);
        node = next;
      }
      label.after(wrap);
      label.classList.add('ds-section-toggle');
      label.setAttribute('role', 'button');
      label.tabIndex = 0;

      const apply = (collapsed) => {
        wrap.style.display = collapsed ? 'none' : '';
        label.classList.toggle('collapsed', collapsed);
        label.title = collapsed ? `${name} 펼치기` : `${name} 접기`;
      };
      apply(saved[name] === true);

      const toggle = () => {
        const now = wrap.style.display !== 'none';
        apply(now);
        try {
          const cur = JSON.parse(localStorage.getItem(_DS_COLLAPSE_KEY) || '{}');
          cur[name] = now;
          localStorage.setItem(_DS_COLLAPSE_KEY, JSON.stringify(cur));
        } catch (_) {}
      };
      label.addEventListener('click', toggle);
      // ★키보드로도 접힌다 — role=button 을 줬으면 Enter/Space 가 먹어야 한다.
      label.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });
  }

  // ── 프로젝트 열 때 복원 ──────────────────────────────

  /**
   * 프로젝트 meta.json의 colorVars를 복원 → localStorage 동기화 + :root 적용.
   * 프로젝트 로드 직후 호출(branch-system.initBranchStore 패턴과 동일하게 meta 우선).
   * meta에 colorVars가 없으면 localStorage 값(기존 동작)을 유지.
   */
  // ── 컬러 히스토리(최근 쓴 색, 현빈 2026-10-02 B안) ───────────────────────────
  //   정본 = meta.colorHistory(프로젝트별) · 작업 캐시 = localStorage(STORAGE_HISTORY_KEY). 컬러 변수와 같은 자리·같은 길.
  //   쌓는 자리는 색 팝업 «닫을 때» 한 곳(color-picker.js _flushColorHistory) — 여기는 «받아 저장»만.
  function _normHex(h) {
    const m = String(h || '').trim().match(/^#?([0-9a-f]{6})$/i);
    return m ? '#' + m[1].toLowerCase() : null;
  }
  function getColorHistory() {
    try {
      const a = JSON.parse(localStorage.getItem(STORAGE_HISTORY_KEY) || '[]');
      return Array.isArray(a) ? a.map(_normHex).filter(Boolean).slice(0, COLOR_HISTORY_MAX) : [];
    } catch { return []; }
  }
  function _setColorHistory(list, { persist = true } = {}) {
    try { localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(list)); } catch {}
    if (persist) _mergeProjectMeta({ colorHistory: list });
    document.dispatchEvent(new CustomEvent('colorhistory-changed', { detail: { list } }));
  }
  /** 같은 색은 맨 앞으로(중복 제거) · COLOR_HISTORY_MAX 넘으면 뒤에서 버린다. */
  function pushColorHistory(hex) {
    const h = _normHex(hex);
    if (!h) return getColorHistory();
    const prev = getColorHistory();
    if (prev[0] === h) return prev;                                   // 이미 맨 앞 — 쓰기 없음
    const next = [h, ...prev.filter(x => x !== h)].slice(0, COLOR_HISTORY_MAX);
    _setColorHistory(next);
    return next;
  }
  /* ⚠️컬러 변수 복원(아래)과 «한 점» 다르다: meta 에 colorHistory 가 «없으면» 빈 목록으로 둔다.
     변수 쪽은 meta 에 없으면 캐시를 그대로 둬서 «직전 프로젝트 것»이 남는다(기존 결함 — 코드 읽기·미실측, 범위 밖이라 안 고침·보고함).
     최근 색은 그 병을 물려받지 않는다. */
  async function restoreColorHistoryFromMeta(projectId) {
    const pid = projectId || window.activeProjectId;
    let list = [];
    try {
      if (pid && window.electronAPI?.loadProjectMeta) {
        const meta = await window.electronAPI.loadProjectMeta(pid).catch(() => null);
        if (Array.isArray(meta?.colorHistory)) list = meta.colorHistory.map(_normHex).filter(Boolean).slice(0, COLOR_HISTORY_MAX);
      }
    } catch (e) { console.warn('[DesignSystem] restoreColorHistoryFromMeta 실패:', e); }
    _setColorHistory(list, { persist: false });                       // 열 때 읽기만 — 다시 쓰지 않는다
    return list;
  }

  /* ── 텍스트 «효과» 히스토리 (최근 형광펜·점·밑줄·그라데이션 · 현빈 2026-10-08) ─────────────────
   *   현빈: 「★저장한 스타일도 ★복사할수 있게 … ★프리셋을 추가할 수 있게 ★하든 ★혹은 ★최근 스타일을 선택할 수 있게」
   *   ＋ 지디 notes T14 「★그 형광펜 스타일로 ★다른 텍스트에 하려는데 ★매번 설정을 ★복붙하기가 ★귀찮아」
   *     T15 「★최근 형광펜처럼 … 네온글로우 / 그라데이션 … ★마찬가지 ★최근 효과 뜨게」
   *
   * ★★컬러 히스토리와 ★같은 자리·★같은 길이다 — 정본 = meta.textStyleHistory · 작업 캐시 = localStorage.
   *   ⛔새 저장 기계를 ★만들지 않았다. 위 네 함수를 ★그대로 베껴 ★«큐가 kind 별로 여럿»인 것만 다르다.
   * ★★이 자리는 ★«무엇이 ★형광펜인가»를 ★모른다 — ★그 명부는 ★js/props/text-style-kinds.js ★하나다.
   *   ⇒ 여기서는 ★«꼴»만 본다(평평한 객체 · 문자열/수/참거짓). ★그래야 ★kind 를 늘려도 ★이 파일이 안 바뀐다.
   * ★레코드 = { v: {...}, t: <epoch ms> }   ⛔kind 를 레코드 안에 ★또 적지 않는다(큐의 ★키가 그것이다 — 명부 둘 방지).
   * ⚠️T15 의 ★네온글로우는 ★여기 ★없다 — ★그 정본 자리를 ★안 쟀다. ⛔빈 큐를 ★미리 열어 두지 않는다
   *   (「표의 ★빈칸은 ★«없는 경우»가 아니라 ★«안 잰 경우»」 — 빈 큐가 「기능 없음」으로 읽힌다. 지디 판정 2026-10-08 ⒟).
   * ★★「네 kind 가 ★한 기계인가」는 tests/dom/text-style-recent.dom.spec.js ★D1 이 잰다 —
   *   ★무력화 실측: 아래 _setTextStyleAll 의 ★쓰기 ★한 줄을 죽이면 ★네 kind 가 ★전부(4/4) 죽는다.
   */
  function _normStyleValue(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    const out = {};
    for (const k of Object.keys(v)) {
      if (!k || typeof k !== 'string' || k.length > 64) continue;
      const val = v[k];
      if (typeof val === 'string') { if (val.length <= 400) out[k] = val; }
      else if (typeof val === 'number' && Number.isFinite(val)) out[k] = val;
      else if (typeof val === 'boolean') out[k] = val;
      /* ⛔그 밖(중첩 객체·배열·함수·NaN)은 ★버린다 — 저장본이 ★미래 꼴을 들고 와도 ★안 깨지게. */
    }
    return Object.keys(out).length ? out : null;
  }
  /** 키 순서와 무관하게 같은 값인가 — 「맨 앞과 같으면 쓰기 없음」이 ★키 순서로 ★틀리지 않게. */
  function _sameStyle(a, b) {
    if (!a || !b) return false;
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    if (ka.length !== kb.length) return false;
    return ka.every((k, i) => k === kb[i] && a[k] === b[k]);
  }
  function _readTextStyleAll() {
    try {
      const o = JSON.parse(localStorage.getItem(STORAGE_TEXTSTYLE_KEY) || '{}');
      if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
      const out = {};
      for (const k of Object.keys(o)) {
        if (!Array.isArray(o[k])) continue;
        const q = o[k].map(r => {
          const v = _normStyleValue(r && r.v);
          if (!v) return null;
          const t = Number(r && r.t);
          return { v, t: Number.isFinite(t) ? t : 0 };
        }).filter(Boolean).slice(0, TEXT_STYLE_HISTORY_MAX);
        if (q.length) out[k] = q;
      }
      return out;
    } catch { return {}; }
  }
  /** kind 의 최근 목록(새 것이 앞). kind 를 안 주면 ★전부. */
  function getTextStyleHistory(kind) {
    const all = _readTextStyleAll();
    if (kind === undefined || kind === null) return all;
    return all[kind] || [];
  }
  function _setTextStyleAll(all, { persist = true } = {}) {
    try { localStorage.setItem(STORAGE_TEXTSTYLE_KEY, JSON.stringify(all)); } catch {}
    if (persist) _mergeProjectMeta({ textStyleHistory: all });
    document.dispatchEvent(new CustomEvent('textstylehistory-changed', { detail: { all } }));
  }
  /**
   * 같은 값은 ★맨 앞으로(중복 제거) · MAX 넘으면 뒤에서 버린다 — ★컬러의 그 규약 그대로.
   * ＋ ★같은 kind 를 ★창 안에 ★연달아 넣으면 ★맨 앞을 ★«덮는다»(하나의 스타일을 다듬는 중이므로).
   * @param {string} kind  'hl'|'dot'|'ul'|'grad' — ★그 명부는 text-style-kinds.js 다(여기서는 ★문자열 키일 뿐)
   */
  function pushTextStyleHistory(kind, value, { now = Date.now() } = {}) {
    if (!kind || typeof kind !== 'string') return [];
    const v = _normStyleValue(value);
    if (!v) return getTextStyleHistory(kind);
    const all = _readTextStyleAll();
    const prev = all[kind] || [];
    if (prev[0] && _sameStyle(prev[0].v, v)) return prev;             // 이미 맨 앞 — ★쓰기 없음
    const rec = { v, t: now };
    let next;
    if (prev[0] && now - prev[0].t < TEXT_STYLE_COALESCE_MS) {
      next = [rec, ...prev.slice(1).filter(r => !_sameStyle(r.v, v))];   // ★맨 앞을 덮는다
    } else {
      next = [rec, ...prev.filter(r => !_sameStyle(r.v, v))];
    }
    all[kind] = next.slice(0, TEXT_STYLE_HISTORY_MAX);
    _setTextStyleAll(all);
    return all[kind];
  }
  /* ⚠️컬러 히스토리와 ★같은 점: meta 에 없으면 ★빈 목록이다(⛔직전 프로젝트 것이 ★안 남는다).
     ★컬러 «변수» 쪽이 앓는 그 병을 ★여기도 ★물려받지 않는다. */
  async function restoreTextStyleHistoryFromMeta(projectId) {
    const pid = projectId || window.activeProjectId;
    let all = {};
    try {
      if (pid && window.electronAPI?.loadProjectMeta) {
        const meta = await window.electronAPI.loadProjectMeta(pid).catch(() => null);
        const raw = meta && meta.textStyleHistory;
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          try { localStorage.setItem(STORAGE_TEXTSTYLE_KEY, JSON.stringify(raw)); } catch {}
          all = _readTextStyleAll();                                  // ★정규화를 ★한 자리로 태운다
        }
      }
    } catch (e) { console.warn('[DesignSystem] restoreTextStyleHistoryFromMeta 실패:', e); }
    _setTextStyleAll(all, { persist: false });                        // 열 때 읽기만 — 다시 쓰지 않는다
    return all;
  }

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

  // ── 컬러 변수 패널 UI (팀 B) — 같은 IIFE의 getColorVars/setColorVar 직접 사용 ────
  // 재렌더 중 input change가 다시 setColorVar를 호출하는 무한루프 방지 플래그.
  let _cvRendering = false;

  function _cvGet() { return getColorVars() || {}; }
  function _cvSet(name, hex) { setColorVar(name, hex); }
  function _cvRemove(name) { removeColorVar(name); }

  function renderColorVars() {
    const list = document.getElementById('ds-colorvars-list');
    if (!list) return;
    _cvRendering = true;          // setProperty .value 변경이 input 이벤트를 발생시키진 않지만 이중 안전장치
    try {
      const vars = _cvGet();
      const names = Object.keys(vars);
      list.innerHTML = '';

      if (names.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'ds-colorvars-empty';
        empty.textContent = '정의된 컬러 변수가 없습니다.';
        list.appendChild(empty);
        return;
      }

      names.forEach((name) => {
        const hex = vars[name] || '#000000';
        const row = document.createElement('div');
        row.className = 'ds-token-row ds-colorvar-row';
        row.dataset.name = name;

        const label = document.createElement('span');
        label.className = 'ds-token-label ds-colorvar-name';
        label.textContent = name;
        label.title = name;

        const picker = document.createElement('input');
        picker.type = 'color';
        picker.className = 'ds-token-picker';
        picker.value = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#000000';
        picker.addEventListener('input', () => {
          if (_cvRendering) return;        // 재렌더로 인한 값 주입은 무시
          _cvSet(name, picker.value);      // 외부 store 갱신 → colorvars-changed 이벤트
        });

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'ds-colorvar-del';
        del.title = '삭제';
        del.textContent = '×';
        del.addEventListener('click', () => {
          if (window.confirm(`'${name}' 변수를 삭제할까요?`)) _cvRemove(name);
        });

        row.appendChild(label);
        row.appendChild(picker);
        row.appendChild(del);
        list.appendChild(row);
      });
    } finally {
      _cvRendering = false;
    }
  }

  function addColorVarFromPanel() {
    const btn = document.getElementById('ds-colorvar-add-btn');
    _openInlineNameForm(btn?.closest('.ds-base-row') || btn?.parentElement, {
      id: 'ds-colorvar-name', placeholder: '새 컬러 변수 이름 (예: primary, accent)',
      onSubmit: (raw) => {
        const name = (raw || '').trim();
        /* ⚠️여기 있던 alert 2개(빈 이름·중복)는 토스트로 바꿨다 — alert 는 Electron 에서 «동작»하지만 앱을 막는 대화창이라
             방금 연 입력칸의 포커스를 빼앗는다. 폼은 연 채로 두고(false) 고쳐 칠 수 있게 한다. */
        if (!name) { window.showToast?.('변수명을 입력하세요'); return false; }
        if (Object.prototype.hasOwnProperty.call(_cvGet(), name)) { window.showToast?.(`'${name}' 변수가 이미 있어요`); return false; }
        _cvSet(name, '#3b82f6');              // 기본색 — 이후 colorvars-changed가 재렌더 트리거
        return true;
      },
    });
  }

  function _initColorVars() {
    // 외부 변경(다른 패널/store) 반영
    document.addEventListener('colorvars-changed', () => renderColorVars());
    // 초기 렌더 — 팀 A 미머지 시 빈 목록
    renderColorVars();
  }

  // ── 초기화 ───────────────────────────────────────────

  function init() {
    const tokens = _load();
    applyTokens(tokens);
    // 시맨틱 컬러 변수 :root 적용 (applyTokens 호출 지점 미러)
    applyColorVars();

    /* color picker ↔ hex 양방향 동기화 — 배선은 color-picker.js 의 wireHexText 한 자리.
       ★손사본이던 때는 무효값이 «말없이» 무시되고 blur 복원도 없었다(다른 40여 칸과 같은 병).
         표기도 이 다섯 칸만 `#111111` 이라 바로 옆 「바탕색」 칸(`ACACAC`)과 규칙이 달랐다 —
         한 패널 안에서 두 규칙을 외우게 만들던 자리다(신고 원문). */
    ['ds-h1-color', 'ds-body-color', 'ds-caption-color', 'ds-label-bg', 'ds-label-color'].forEach(id => {
      const picker = document.getElementById(id);
      const hex    = document.getElementById(id + '-hex');
      if (!picker || !hex) return;
      picker.addEventListener('input', () => { hex.value = _hexBox(picker.value); });
      /* ⛔여기서 「없으면 대충이라도」 손배선을 하지 않는다 — 그 한 줄이 다시 사본의 시작이 된다.
         color-picker.js 는 `type="module"`(defer) 이라 init(DOMContentLoaded)보다 «먼저» 실린다. */
      if (!window.wireHexText) return;
      window.wireHexText(hex, {
        parse: window.parseHex6,
        format: window.formatHex6,
        getCurrent: () => picker.value || '#000000',
        onApply: (v) => { picker.value = v; },
      });
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

    // 컬러 변수 섹션 초기화 (이벤트 바인딩 + 초기 렌더)
    _initColorVars();
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    applyBase, applyFromPanel, resetTokens, togglePanel, syncPanelUI, saveNewPreset, makeSectionsCollapsible,
    // 시맨틱 컬러 변수 — 데이터(팀A) + 패널 UI(팀B)
    getColorVars, setColorVar, removeColorVar, applyColorVars, restoreColorVarsFromMeta,
    // 컬러 히스토리(최근 쓴 색) — color-picker 가 쌓고, color-var-chips 가 그린다. 인라인 이름 폼은 「변수로 만들기」가 재사용.
    getColorHistory, pushColorHistory, restoreColorHistoryFromMeta, COLOR_HISTORY_MAX,
    // 텍스트 «효과» 히스토리 — prop-text-wireup-text-edit 가 쌓고, text-style-chips 가 그린다(컬러와 같은 꼴)
    getTextStyleHistory, pushTextStyleHistory, restoreTextStyleHistoryFromMeta,
    TEXT_STYLE_HISTORY_MAX, TEXT_STYLE_COALESCE_MS,
    openInlineNameForm: (...a) => _openInlineNameForm(...a),
    addColorVarFromPanel, renderColorVars,
  };
})();

window.DesignSystem = DesignSystem;
