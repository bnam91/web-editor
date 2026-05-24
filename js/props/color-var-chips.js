/* ═══════════════════════════════════
   COLOR VARIABLE CHIPS  (Team C — L3 소비 레이어)
   - 우측 인스펙터 색 지정 UI 옆에 "정의된 컬러 변수" 칩을 노출
   - 칩 클릭 시 블록 style을 var(--color-<name>, <hexFallback>)로 바인딩
     (정적 hex 복사가 아니라 동적 참조 → 변수 값이 바뀌면 자동 반영)
   - 현재 블록이 var() 참조 중이면 해당 칩을 active 표시
   - 'colorvars-changed' 이벤트 수신 시 칩 목록 자동 갱신

   ※ 팀 A(window.DesignSystem.getColorVars) 미머지 가능성 → 항상 가드한다.
═══════════════════════════════════ */

/** 팀 A가 제공하는 시맨틱 컬러 변수 맵. 미머지 시 {} 반환(가드). */
export function getColorVars() {
  try {
    return window.DesignSystem?.getColorVars?.() || {};
  } catch {
    return {};
  }
}

// 사람이 읽기 좋은 라벨(없으면 변수명 그대로). 기본 3종만 한글 매핑.
const VAR_LABELS = {
  primary:   '메인',
  secondary: '보조',
  accent:    '강조',
};

/** CSS 값에서 var(--color-<name>) 의 name을 추출. 아니면 null. */
export function parseColorVarName(cssValue) {
  if (!cssValue) return null;
  const m = String(cssValue).match(/var\(\s*--color-([a-z0-9_-]+)/i);
  return m ? m[1] : null;
}

/** var(--color-<name>, <fallbackHex>) 문자열을 만든다.
 *  fallbackHex는 export(HTML)·var 미정의 환경에서의 graceful degrade 용. */
export function buildColorVarRef(name, fallbackHex) {
  const fb = fallbackHex && /^#?[0-9a-f]{3,8}$/i.test(String(fallbackHex).replace('#', ''))
    ? (String(fallbackHex)[0] === '#' ? fallbackHex : '#' + fallbackHex)
    : '';
  return fb ? `var(--color-${name}, ${fb})` : `var(--color-${name})`;
}

function _chipHtml(name, hex, isActive) {
  const label = VAR_LABELS[name] || name;
  const safeHex = (hex && /^#[0-9a-f]{3,8}$/i.test(hex)) ? hex : '#888888';
  return `<button type="button" class="cv-chip${isActive ? ' active' : ''}"
    data-cv-name="${name}" data-cv-hex="${safeHex}"
    title="${label} · ${safeHex} (클릭 시 변수 바인딩)"
    aria-label="${label} ${safeHex}" aria-pressed="${isActive ? 'true' : 'false'}">
    <span class="cv-chip-dot" style="background:${safeHex}"></span>
    <span class="cv-chip-label">${label}</span>
  </button>`;
}

/** 컨테이너 안에 현재 컬러 변수 칩들을 렌더. activeName이면 해당 칩 active. */
export function renderColorVarChips(container, { activeName = null } = {}) {
  if (!container) return;
  const vars = getColorVars();
  const names = Object.keys(vars);
  if (!names.length) {
    // 정의된 변수가 없으면 칩 영역을 비워 둠(직접 hex 입력은 그대로 사용 가능)
    container.innerHTML = '';
    container.hidden = true;
    return;
  }
  container.hidden = false;
  container.innerHTML =
    `<span class="cv-chips-label" title="정의된 컬러 변수 — 클릭하면 동적 바인딩">VAR</span>` +
    names.map(n => _chipHtml(n, vars[n], n === activeName)).join('');
}

/**
 * 컬러 변수 칩 위젯을 색 지정 UI에 연결한다.
 * @param {object} opts
 *  - container:    칩을 렌더할 요소 (필수)
 *  - getActiveName: () => string|null  현재 블록이 참조 중인 변수명 (active 표시용)
 *  - onPick:       (cssRef, name, hex) => void  칩 클릭 시 호출. cssRef = 'var(--color-<name>, #hex)'
 *  - getFallbackHex: (name, hex) => string  바인딩 시 fallback으로 쓸 hex (기본: 변수 hex)
 * @returns { refresh } — colorvars-changed/외부 변경 시 다시 그릴 수 있는 핸들
 */
export function wireColorVarChips({ container, getActiveName, onPick, getFallbackHex } = {}) {
  if (!container) return null;

  const refresh = () => {
    const active = (() => { try { return getActiveName?.() ?? null; } catch { return null; } })();
    renderColorVarChips(container, { activeName: active });
  };

  // 칩 클릭 → var() 바인딩 요청
  container.addEventListener('click', (e) => {
    const chip = e.target.closest('.cv-chip');
    if (!chip) return;
    e.preventDefault();
    const name = chip.dataset.cvName;
    const hex  = chip.dataset.cvHex;
    if (!name) return;
    const fb = (() => {
      try { return getFallbackHex ? getFallbackHex(name, hex) : hex; } catch { return hex; }
    })();
    const ref = buildColorVarRef(name, fb);
    try { onPick?.(ref, name, hex); } catch (err) { console.warn('[cv-chips] onPick failed', err); }
    refresh();
  });

  // 팀 A가 변수 추가/수정/삭제하면 칩 목록 갱신
  const _onChanged = () => refresh();
  document.addEventListener('colorvars-changed', _onChanged);

  // wireup이 속한 propPanel은 selection마다 innerHTML이 교체되므로
  // container가 DOM에서 분리되면 리스너를 정리(leak 방지).
  // showXxxProperties 재호출 시 새 container/새 wire가 생기므로 단일 슬롯로 정리.
  if (window.__cvChipsChanged) {
    document.removeEventListener('colorvars-changed', window.__cvChipsChanged);
  }
  window.__cvChipsChanged = _onChanged;

  refresh();
  return { refresh };
}

window.GoyaColorVarChips = { getColorVars, parseColorVarName, buildColorVarRef, renderColorVarChips, wireColorVarChips };
