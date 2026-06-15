// liner-transform.js — 라이너(곡선) 텍스트: SVG textPath로 텍스트를 path를 따라 휘게 함
// text-effect-transform.js 동형 구조 — apply / ensure / MutationObserver / window 전역
//
// 렌더 모델:
//   .text-block.liner-block (data-type="liner", data-liner JSON {preset,curvature})
//     ├─ .tb-liner[contenteditable]  ← 편집 미러 div (텍스트 SSOT, 평소 숨김 / 편집중만 노출)
//     └─ svg.lnr-svg
//          └─ <defs><path id="liner-path-{blockId}" d="..."/></defs>
//          └─ <text><textPath href="#liner-path-{blockId}">텍스트</textPath></text>
//
// 곡률/프리셋/폭/폰트는 미러 div에서 읽어 SVG로 매핑한다. innerHTML 직렬화로 자동 round-trip,
// 로드 후 ensureLiner가 path id / d / 폰트를 재계산한다.

const LINER_PRESETS = [
  { value: 'arc-up',   label: 'Arc Up (위로 아치)' },
  { value: 'arc-down', label: 'Arc Down (아래 오목)' },
  { value: 'wave',     label: 'Wave (물결)' },
  { value: 'circle',   label: '원형' }
];

const LINER_DEFAULTS = {
  preset:        'arc-up',
  curvature:     50,        // 0~100
  letterSpacing: 0          // px, 자연 자간에 더하는 추가 자간 (음수 가능)
};

const LINER_PAD = 12;     // 좌우 패딩 P (글자 잘림 방지)
const LINER_BASE_H = 80;  // 기본 블록/뷰박스 높이

// 자간 슬라이더 범위 (px)
const LINER_LS_MIN = -2;
const LINER_LS_MAX = 20;

// 곡률 비례 폰트 다운스케일 (미감 규칙 #4): 곡률 0=1.0배 → 100=0.65배 선형
// 아치가 반원에 가까울수록 글자를 작게 만들어 자연스럽게 보이게 한다.
const LINER_CURV_MIN_SCALE = 0.65;
function linerCurvatureScale(curvature) {
  const c = normCurvature(curvature);
  return 1 - (c / 100) * (1 - LINER_CURV_MIN_SCALE);
}

// 자간 정규화 — NaN은 0
function normLetterSpacing(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(LINER_LS_MIN, Math.min(LINER_LS_MAX, n));
}

// 곡률 정규화 — NaN/비유한값은 기본값(50)으로 (m7)
function normCurvature(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return LINER_DEFAULTS.curvature;
  return Math.max(0, Math.min(100, n));
}

// 색 문자열이 투명(transparent / alpha=0)인지 판정 (M1)
function isTransparentColor(c) {
  if (!c) return true;
  const v = String(c).trim().toLowerCase();
  if (v === 'transparent' || v === 'none') return true;
  // rgba(...,0) / rgba(...,0.0) 형태의 alpha=0 감지
  const m = v.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(',').map(s => s.trim());
    if (parts.length === 4 && parseFloat(parts[3]) === 0) return true;
  }
  return false;
}

// SVG <text> fill 색 결정 — 미러 inline style.color 우선, 비었거나 transparent면 기본색 fallback (M1)
function resolveLinerFill(mirror, cs) {
  const inline = (mirror.style.color || '').trim();
  if (inline && !isTransparentColor(inline)) return inline;
  const computed = (cs && cs.color) || '';
  if (computed && !isTransparentColor(computed)) return computed;
  return '#111111';
}

// 곡률 → 베지에 제어점 진폭 k (곡률 0~100 → 0 ~ baseH*0.45).
// H가 아닌 baseH(고정 기준)에 비례시켜 큰 폰트로 H가 커져도 아치가 과장되지 않게 한다.
function linerAmplitude(curvature, baseH) {
  return (normCurvature(curvature) / 100) * ((baseH || LINER_BASE_H) * 0.45);
}

// ── path d 생성 공식 (viewBox 0 0 W H, 좌우 패딩 P, 베이스라인 cy, 진폭 k) ──
// cy/k를 caller가 명시(폰트 ascent 여유 반영). 미지정 시 옛 동작(H/2 기준)으로 fallback.
function buildLinerPathD(preset, curvature, W, H, P, cy, k) {
  const c = normCurvature(curvature);
  if (cy == null) cy = H / 2;
  if (k == null)  k  = (c / 100) * (H * 0.45);
  const x0 = P, x1 = W - P;
  if (preset === 'circle') {
    // 풀 원형: <circle>은 textPath 못 받으니 두 개의 A(arc)로 360°.
    // 시작점 = 최하단(6시) (cx, cy+r). 시계방향(sweep=1)으로 왼쪽→상단→오른쪽→하단 복귀.
    // ⇒ 최상단(12시)이 둘레의 정확히 50% 지점에 위치 → startOffset='50%' + text-anchor=middle 로
    //    텍스트 중앙이 12시에 오고, 좌우로 자연스럽게 감김(짧으면 상단 호만 차지).
    // caller가 cy=원 중심 y, k=반지름 r 로 전달.
    const cx = W / 2;
    const r = (k != null) ? k : (Math.min(W - 2 * P, H) / 2);
    const botX = cx, botY = cy + r;
    const topX = cx, topY = cy - r;
    // 하단 → (왼쪽 반원) 상단 → (오른쪽 반원) 하단. sweep-flag=1(시계방향).
    return `M ${botX},${botY} A ${r},${r} 0 1 1 ${topX},${topY} A ${r},${r} 0 1 1 ${botX},${botY}`;
  }
  if (c === 0) {
    return `M ${x0},${cy} L ${x1},${cy}`;
  }
  if (preset === 'arc-up') {
    // 위로 볼록 — 제어점이 위(작은 y)
    return `M ${x0},${cy} Q ${W / 2},${cy - k} ${x1},${cy}`;
  }
  if (preset === 'arc-down') {
    // 아래로 오목 — 제어점이 아래(큰 y)
    return `M ${x0},${cy} Q ${W / 2},${cy + k} ${x1},${cy}`;
  }
  // wave: sine 1주기 — Q...T 대칭 파동
  return `M ${x0},${cy} Q ${W / 4},${cy - k} ${W / 2},${cy} T ${x1},${cy}`;
}

// 미러 div(.tb-liner) 찾기
function findLinerMirror(block) {
  return block.querySelector('.tb-liner');
}

// 미러 div의 현재 텍스트 (placeholder 상태면 placeholder 문구)
function readLinerText(mirror) {
  if (!mirror) return '';
  const t = (mirror.textContent || '').trim();
  if (!t) return mirror.dataset.placeholder || '';
  return t;
}

// 블록 id 보장 — 없으면 즉시 발급 (m8: 'unknown' path id 공유 방지)
function ensureBlockId(block) {
  if (!block.id) {
    block.id = window.genId ? window.genId('lnr') : 'lnr_' + Math.random().toString(36).slice(2, 9);
  }
  return block.id;
}

// path id 보장 — 블록 id 기준 (복제/복원 시 충돌 회피)
function linerPathId(block) {
  return 'liner-path-' + ensureBlockId(block);
}

// 미러 div → SVG textPath 텍스트 동기화
function applyLinerText(block) {
  if (!block) return;
  const svg = block.querySelector('svg.lnr-svg');
  const mirror = findLinerMirror(block);
  if (!svg || !mirror) return;
  const tp = svg.querySelector('textPath');
  if (tp) tp.textContent = readLinerText(mirror);
}

function applyLiner(block, opts) {
  if (!block) return;
  ensureBlockId(block); // m8: id 없으면 즉시 발급
  const mirror = findLinerMirror(block);
  const svg = block.querySelector('svg.lnr-svg');
  if (!mirror || !svg) return;

  const prev = (() => { try { return JSON.parse(block.dataset.liner || '{}'); } catch (e) { return {}; } })();
  const cfg = { ...LINER_DEFAULTS, ...prev, ...(opts || {}) };
  cfg.curvature     = normCurvature(cfg.curvature);          // m7: NaN → 기본값
  cfg.letterSpacing = normLetterSpacing(cfg.letterSpacing);  // #1: 자간 정규화

  // 사용자 폰트크기 = "원하는 최대치" (#3) — 미러 inline style 우선, 없으면 computed
  const csEarly = window.getComputedStyle(mirror);
  const userFontPx = parseInt(mirror.style.fontSize) || parseInt(csEarly.fontSize) || 28;

  // 폭: 블록(미러) 실측 폭 — 0이면 fallback
  const W = Math.max(120, Math.round(mirror.offsetWidth || block.offsetWidth || 600));
  const P = LINER_PAD;
  const pid = linerPathId(block);

  // 폰트/색 — 미러 div style/computed에서 복사 (단일 소스 = 미러)
  const cs = csEarly;
  const fontFamily = mirror.style.fontFamily || cs.fontFamily || "'Pretendard', sans-serif";
  const fontWeight = mirror.style.fontWeight || cs.fontWeight || '400';
  const fontStyle  = mirror.style.fontStyle || cs.fontStyle || 'normal';
  const fill       = resolveLinerFill(mirror, cs);
  const ls         = cfg.letterSpacing; // #1: dataset의 추가 자간(px)

  // defs / path / text 보장
  let defs = svg.querySelector('defs');
  if (!defs) { defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); svg.insertBefore(defs, svg.firstChild); }
  let path = defs.querySelector('path');
  if (!path) { path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); defs.appendChild(path); }
  let textEl = svg.querySelector('text');
  if (!textEl) { textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text'); svg.appendChild(textEl); }
  let tp = textEl.querySelector('textPath');
  if (!tp) { tp = document.createElementNS('http://www.w3.org/2000/svg', 'textPath'); textEl.appendChild(tp); }

  // textPath href / 공통 텍스트 속성 (측정 전에 세팅)
  tp.setAttribute('href', '#' + pid);
  tp.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + pid);
  tp.setAttribute('startOffset', '50%');
  textEl.setAttribute('text-anchor', 'middle');
  textEl.setAttribute('font-family', fontFamily);
  textEl.setAttribute('font-weight', fontWeight);
  textEl.setAttribute('font-style', fontStyle);
  textEl.setAttribute('fill', fill);
  textEl.setAttribute('letter-spacing', String(ls));
  // 측정 신뢰성: 항상 자연 자간(stretch 미설정)
  tp.removeAttribute('textLength');
  tp.removeAttribute('lengthAdjust');
  tp.textContent = readLinerText(mirror);

  path.setAttribute('id', pid);
  path.setAttribute('fill', 'none');

  const isCircle = (cfg.preset === 'circle');
  // 곡률 비례 다운스케일 (#4): 곡률↑ → 폰트↓ (모든 프리셋 공통)
  const curvScale = linerCurvatureScale(cfg.curvature);
  let effFont = Math.max(6, userFontPx * curvScale);

  let cy, H, pathK;

  if (isCircle) {
    // ── 원형: 블록은 정사각형(H=W), 원은 가운데. 곡률↑ → 원 작게 + 글자 작게 ──
    // 글자 ascent가 path 바깥(위)으로 올라가므로 ascent만큼 반지름을 줄여 블록 안에 가둠.
    const ascent = effFont * 0.78;
    // 곡률로 원 크기 제어: 곡률 0 → 가용폭 꽉, 100 → 60%. (curvScale 0.65~1.0 와 별개로 좀 더 강하게)
    const sizeScale = 1 - (normCurvature(cfg.curvature) / 100) * 0.40; // 1.0 ~ 0.60
    const maxR = (W - 2 * P) / 2 - ascent;
    let r = Math.max(8, maxR * sizeScale);
    // 임시 path로 둘레(circumference) 측정 → fit-to-width 기준
    H = W; // 정사각형
    const cyTmp = H / 2;
    path.setAttribute('d', buildLinerPathD('circle', cfg.curvature, W, H, P, cyTmp, r));
    let circ = 2 * Math.PI * r;
    try { if (path.getTotalLength) { const L = path.getTotalLength(); if (Number.isFinite(L) && L > 0) circ = L; } } catch (e) {}
    // "채울 수 있는 만큼만": 자연 길이가 둘레를 넘을 때만 폰트 축소 (stretch X, 강제 360° X)
    textEl.setAttribute('font-size', String(effFont));
    let natural = 0;
    try {
      if (tp.getComputedTextLength) natural = tp.getComputedTextLength();
      if (!(natural > 0) && textEl.getComputedTextLength) natural = textEl.getComputedTextLength();
    } catch (e) { natural = 0; }
    if (natural > circ && natural > 0) {
      effFont = Math.max(6, effFont * (circ / natural) * 0.985);
      textEl.setAttribute('font-size', String(effFont));
    }
    cy    = Math.round(H / 2);   // 원 중심 = 블록 중앙
    pathK = r;
  } else {
    // ── arc/wave: path 가용 길이(직선 근사) → fit-to-width ──
    if (!path.getAttribute('d')) path.setAttribute('d', `M ${P},40 L ${W - P},40`);
    let avail = W - 2 * P;
    try {
      if (path.getTotalLength) { const L = path.getTotalLength(); if (Number.isFinite(L) && L > 0) avail = L; }
    } catch (e) { /* fallback W-2P */ }

    textEl.setAttribute('font-size', String(effFont));
    let natural = 0;
    try {
      if (tp.getComputedTextLength) natural = tp.getComputedTextLength();
      if (!(natural > 0) && textEl.getComputedTextLength) natural = textEl.getComputedTextLength();
    } catch (e) { natural = 0; }
    if (natural > avail && natural > 0) {
      effFont = Math.max(6, effFont * (avail / natural) * 0.985); // 0.985 안전마진
      textEl.setAttribute('font-size', String(effFont));
    }

    // ── effFont 기준 높이/베이스라인 계산 (#2: 아치 rise + ascent만큼 블록 높이 확보) ──
    const amp     = linerAmplitude(cfg.curvature, LINER_BASE_H); // 아치 sagitta rise
    const ascent  = effFont * 0.85;  // 베이스라인 위 글자 높이
    const descent = effFont * 0.30;  // 베이스라인 아래 꼬리
    const padTop = 6, padBottom = 6;
    cy    = Math.round(padTop + ascent + amp);                 // arc-up peak/ascent 상단 여유
    H     = Math.round(cy + descent + amp + padBottom);        // arc-down peak/descent 하단 여유
    pathK = amp;
  }

  // viewBox / 크기
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  // 최종 path d (확정 cy/k)
  path.setAttribute('d', buildLinerPathD(cfg.preset, cfg.curvature, W, H, P, cy, pathK));

  // 원형: path 시작점=6시, 12시=둘레 50% 지점. startOffset='50%' + text-anchor=middle
  // ⇒ 텍스트 중앙이 12시에 오고 좌우로 자연스럽게 감김(짧으면 상단 호만 차지, stretch X).
  // arc/wave도 동일하게 50% 중앙정렬.
  tp.setAttribute('startOffset', '50%');

  // 블록/섹션 차지 높이 동기 (#2: 위 콘텐츠와 겹침/잘림 방지)
  block.style.minHeight = H + 'px';

  // dataset 저장 (autoSave가 outerHTML 직렬화 → data-* 보존). 사용자 폰트크기는 미러가 보존, 여기엔 effFont 미저장.
  block.dataset.liner = JSON.stringify({ preset: cfg.preset, curvature: cfg.curvature, letterSpacing: cfg.letterSpacing });
}

// 저장/로드 사이클에서 SVG가 innerHTML로 살아있어도 path id/폭변화 재계산
function ensureLiner(block) {
  if (!block || !block.dataset.liner) return;
  try {
    const cfg = JSON.parse(block.dataset.liner);
    applyLiner(block, cfg);
    applyLinerText(block);
  } catch (e) { /* malformed dataset → ignore */ }
}

// ── prop-panel 증강 (프리셋 select + 곡률 슬라이더) ──
function enhanceLinerPropPanel(block) {
  if (!block || !block.classList.contains('liner-block')) return;
  let cfg;
  try { cfg = JSON.parse(block.dataset.liner || '{}'); }
  catch (e) { cfg = { ...LINER_DEFAULTS }; }
  cfg = { ...LINER_DEFAULTS, ...cfg };

  const propPanel = document.querySelector('#panel-right .panel-body')
                 || document.querySelector('.panel-body');
  if (!propPanel) return;

  const presetOpts = LINER_PRESETS
    .map(p => `<option value="${p.value}" ${p.value === cfg.preset ? 'selected' : ''}>${p.label}</option>`)
    .join('');

  const html = `
    <div class="prop-section" id="liner-controls-section">
      <div class="prop-section-title">곡선 텍스트 〰️</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <span style="flex:1;font-size:11px;color:#999;">프리셋</span>
        <select id="lnr-preset" style="flex:2;padding:5px 6px;font-size:12px;background:#1a1a1a;color:#ddd;border:1px solid #333;border-radius:4px;">
          ${presetOpts}
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <span style="flex:1;font-size:11px;color:#999;" id="lnr-curvature-label">${cfg.preset === 'circle' ? '원 크기' : '곡률'}</span>
        <input type="range" class="prop-slider" id="lnr-curvature" min="0" max="100" value="${cfg.curvature}" style="flex:2;">
        <span id="lnr-curvature-val" style="width:32px;font-size:11px;color:#999;text-align:right;">${cfg.curvature}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <span style="flex:1;font-size:11px;color:#999;">자간</span>
        <input type="range" class="prop-slider" id="lnr-letterspacing" min="${LINER_LS_MIN}" max="${LINER_LS_MAX}" step="0.5" value="${cfg.letterSpacing}" style="flex:2;">
        <span id="lnr-letterspacing-val" style="width:32px;font-size:11px;color:#999;text-align:right;">${cfg.letterSpacing}</span>
      </div>
    </div>
  `;

  const existing = propPanel.querySelector('#liner-controls-section');
  if (existing) existing.outerHTML = html;
  else propPanel.insertAdjacentHTML('beforeend', html);

  const read = () => {
    const next = {
      preset:        propPanel.querySelector('#lnr-preset').value,
      curvature:     parseInt(propPanel.querySelector('#lnr-curvature').value),
      letterSpacing: parseFloat(propPanel.querySelector('#lnr-letterspacing').value)
    };
    applyLiner(block, next);
    return next;
  };

  propPanel.querySelector('#lnr-preset')?.addEventListener('change', () => {
    const lbl = propPanel.querySelector('#lnr-curvature-label');
    if (lbl) lbl.textContent = (propPanel.querySelector('#lnr-preset').value === 'circle') ? '원 크기' : '곡률';
    read(); window.pushHistory?.('곡선 텍스트 프리셋'); window.scheduleAutoSave?.();
  });
  propPanel.querySelector('#lnr-curvature')?.addEventListener('input', e => {
    propPanel.querySelector('#lnr-curvature-val').textContent = e.target.value;
    read();
  });
  propPanel.querySelector('#lnr-curvature')?.addEventListener('change', () => {
    window.pushHistory?.('곡선 텍스트 곡률'); window.scheduleAutoSave?.();
  });
  propPanel.querySelector('#lnr-letterspacing')?.addEventListener('input', e => {
    propPanel.querySelector('#lnr-letterspacing-val').textContent = e.target.value;
    read();
  });
  propPanel.querySelector('#lnr-letterspacing')?.addEventListener('change', () => {
    window.pushHistory?.('곡선 텍스트 자간'); window.scheduleAutoSave?.();
  });
}

// ── 로드 시 모든 liner-block 복구 ──
function initLinersInDom() {
  document.querySelectorAll('.liner-block[data-liner]').forEach(ensureLiner);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLinersInDom);
} else {
  initLinersInDom();
}

// 프로젝트 전환 / 새 블록 추가 시 자동 보장
new MutationObserver(muts => {
  for (const m of muts) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (node.classList?.contains('liner-block') && node.dataset.liner) ensureLiner(node);
      node.querySelectorAll?.('.liner-block[data-liner]').forEach(ensureLiner);
    }
  }
}).observe(document.body, { childList: true, subtree: true });

window.buildLinerPathD       = buildLinerPathD;
window.linerAmplitude        = linerAmplitude;
window.linerCurvatureScale   = linerCurvatureScale;
window.applyLiner            = applyLiner;
window.applyLinerText        = applyLinerText;
window.ensureLiner           = ensureLiner;
window.enhanceLinerPropPanel = enhanceLinerPropPanel;
window.initLinersInDom       = initLinersInDom;
window.LINER_DEFAULTS        = LINER_DEFAULTS;
window.LINER_PRESETS         = LINER_PRESETS;
