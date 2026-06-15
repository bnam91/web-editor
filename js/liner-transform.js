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
  { value: 'wave',     label: 'Wave (물결)' }
];

const LINER_DEFAULTS = {
  preset:    'arc-up',
  curvature: 50          // 0~100
};

const LINER_PAD = 12;     // 좌우 패딩 P (글자 잘림 방지)
const LINER_BASE_H = 80;  // 기본 블록/뷰박스 높이

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
  cfg.curvature = normCurvature(cfg.curvature); // m7: NaN → 기본값

  // 폰트크기 먼저 읽기 (M4: H 계산에 반영) — 미러 inline style 우선, 없으면 computed
  const csEarly = window.getComputedStyle(mirror);
  const fontSizePx = parseInt(mirror.style.fontSize) || parseInt(csEarly.fontSize) || 28;

  // 폭: 블록(미러) 실측 폭 — 0이면 fallback
  const W = Math.max(120, Math.round(mirror.offsetWidth || block.offsetWidth || 600));

  // 진폭 k: 곡률 0~100 → 0 ~ baseH*0.45 (H가 아닌 고정 baseH 기준 → 큰 폰트에서 아치 과장 방지)
  const amp = linerAmplitude(cfg.curvature, LINER_BASE_H);
  // 글자 ascent/descent 여유 (M4: arc-up 상단 / arc-down 하단 클리핑 방지)
  const ascent  = fontSizePx * 0.85;  // 베이스라인 위 글자 높이
  const descent = fontSizePx * 0.30;  // 베이스라인 아래 꼬리
  const padTop    = 6;
  const padBottom = 6;
  // 베이스라인 cy: 상단에 (amp[arc-up peak] + ascent) 여유, 하단에 (descent) 여유 확보
  const cy = Math.round(padTop + ascent + amp);
  // 높이 H: 베이스라인 + (descent, 그리고 arc-down일 때 아래로 휜 peak amp) + 하단 패딩
  const H = Math.round(cy + descent + amp + padBottom);

  const P = LINER_PAD;
  const pid = linerPathId(block);

  // defs / path / text 보장
  let defs = svg.querySelector('defs');
  if (!defs) { defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); svg.insertBefore(defs, svg.firstChild); }
  let path = defs.querySelector('path');
  if (!path) { path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); defs.appendChild(path); }
  let textEl = svg.querySelector('text');
  if (!textEl) { textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text'); svg.appendChild(textEl); }
  let tp = textEl.querySelector('textPath');
  if (!tp) { tp = document.createElementNS('http://www.w3.org/2000/svg', 'textPath'); textEl.appendChild(tp); }

  // viewBox / 크기
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  // path d — 명시적 cy/amp 전달(폰트 ascent 여유 반영)
  path.setAttribute('id', pid);
  path.setAttribute('d', buildLinerPathD(cfg.preset, cfg.curvature, W, H, P, cy, amp));
  path.setAttribute('fill', 'none');

  // textPath href (id 재바인드)
  tp.setAttribute('href', '#' + pid);
  tp.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + pid);
  tp.setAttribute('startOffset', '50%');
  textEl.setAttribute('text-anchor', 'middle');

  // 폰트/색/letter-spacing — 미러 div style/computed에서 복사 (단일 소스 = 미러)
  const cs = csEarly;
  const fontFamily = mirror.style.fontFamily || cs.fontFamily || "'Pretendard', sans-serif";
  const fontSize   = fontSizePx;
  const fontWeight = mirror.style.fontWeight || cs.fontWeight || '400';
  const fontStyle  = mirror.style.fontStyle || cs.fontStyle || 'normal';
  // 색: 미러 inline style.color 우선. 비었거나 transparent/alpha=0면 #111111 fallback (M1)
  // .tb-liner는 CSS color:transparent로 숨겨져 있어 computed color를 그대로 쓰면 글자가 안 보임
  const fill       = resolveLinerFill(mirror, cs);
  const ls         = mirror.style.letterSpacing || cs.letterSpacing || 'normal';
  textEl.setAttribute('font-family', fontFamily);
  textEl.setAttribute('font-size', String(fontSize));
  textEl.setAttribute('font-weight', fontWeight);
  textEl.setAttribute('font-style', fontStyle);
  textEl.setAttribute('fill', fill);
  textEl.setAttribute('letter-spacing', (ls === 'normal' ? '0' : ls));

  // 텍스트 내용 먼저 동기화 (측정 전에 채워야 getComputedTextLength가 유효)
  tp.textContent = readLinerText(mirror);

  // ── textLength 보정: 기본은 자연 자간(미설정). 실제로 path 가용길이를 넘칠 때만 spacing만 좁힘 ──
  // (M1 FIX) 전체폭 강제 + spacingAndGlyphs 제거 → 짧은 텍스트 stretch/글리프 왜곡 방지
  tp.removeAttribute('textLength');
  tp.removeAttribute('lengthAdjust');
  // path 가용 길이: 좌우 패딩 제외한 path arc length. path가 곡선이라 실제 length로 측정.
  let avail = W - 2 * P;
  try {
    if (path.getTotalLength) {
      const L = path.getTotalLength();
      if (Number.isFinite(L) && L > 0) avail = L;
    }
  } catch (e) { /* getTotalLength 미지원 → W-2P fallback */ }
  let natural = 0;
  try {
    // textPath 우선(곡선 배치 실폭), 없으면 text 엘리먼트
    if (tp.getComputedTextLength) natural = tp.getComputedTextLength();
    if (!(natural > 0) && textEl.getComputedTextLength) natural = textEl.getComputedTextLength();
  } catch (e) { natural = 0; }
  // 자연 폭이 path 가용길이보다 길 때만 자간(spacing)만 좁혀 path 안에 수용 (글리프 왜곡 없음)
  if (natural > 0 && natural > avail) {
    tp.setAttribute('textLength', String(Math.max(1, Math.round(avail))));
    tp.setAttribute('lengthAdjust', 'spacing');
  }

  // 블록 minHeight 동기 (곡선이 잘리지 않게)
  block.style.minHeight = H + 'px';

  // dataset 저장 (autoSave가 outerHTML 직렬화 → data-* 보존)
  block.dataset.liner = JSON.stringify({ preset: cfg.preset, curvature: cfg.curvature });
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
        <span style="flex:1;font-size:11px;color:#999;">곡률</span>
        <input type="range" class="prop-slider" id="lnr-curvature" min="0" max="100" value="${cfg.curvature}" style="flex:2;">
        <span id="lnr-curvature-val" style="width:32px;font-size:11px;color:#999;text-align:right;">${cfg.curvature}</span>
      </div>
    </div>
  `;

  const existing = propPanel.querySelector('#liner-controls-section');
  if (existing) existing.outerHTML = html;
  else propPanel.insertAdjacentHTML('beforeend', html);

  const read = () => {
    const next = {
      preset:    propPanel.querySelector('#lnr-preset').value,
      curvature: parseInt(propPanel.querySelector('#lnr-curvature').value)
    };
    applyLiner(block, next);
    return next;
  };

  propPanel.querySelector('#lnr-preset')?.addEventListener('change', () => {
    read(); window.pushHistory?.('곡선 텍스트 프리셋'); window.scheduleAutoSave?.();
  });
  propPanel.querySelector('#lnr-curvature')?.addEventListener('input', e => {
    propPanel.querySelector('#lnr-curvature-val').textContent = e.target.value;
    read();
  });
  propPanel.querySelector('#lnr-curvature')?.addEventListener('change', () => {
    window.pushHistory?.('곡선 텍스트 곡률'); window.scheduleAutoSave?.();
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
window.applyLiner            = applyLiner;
window.applyLinerText        = applyLinerText;
window.ensureLiner           = ensureLiner;
window.enhanceLinerPropPanel = enhanceLinerPropPanel;
window.initLinersInDom       = initLinersInDom;
window.LINER_DEFAULTS        = LINER_DEFAULTS;
window.LINER_PRESETS         = LINER_PRESETS;
