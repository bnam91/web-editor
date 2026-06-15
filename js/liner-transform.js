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

// ── path d 생성 공식 (viewBox 0 0 W H, 좌우 패딩 P) ──
function buildLinerPathD(preset, curvature, W, H, P) {
  const cy = H / 2;
  const c = Math.max(0, Math.min(100, Number(curvature) || 0));
  // 진폭 k: 곡률 0~100 → 0 ~ H*0.45
  const k = (c / 100) * (H * 0.45);
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

// path id 보장 — 블록 id 기준 (복제/복원 시 충돌 회피)
function linerPathId(block) {
  return 'liner-path-' + (block.id || 'unknown');
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
  const mirror = findLinerMirror(block);
  const svg = block.querySelector('svg.lnr-svg');
  if (!mirror || !svg) return;

  const prev = (() => { try { return JSON.parse(block.dataset.liner || '{}'); } catch (e) { return {}; } })();
  const cfg = { ...LINER_DEFAULTS, ...prev, ...(opts || {}) };
  cfg.curvature = Math.max(0, Math.min(100, Number(cfg.curvature)));

  // 폭: 블록(미러) 실측 폭 — 0이면 fallback
  const W = Math.max(120, Math.round(mirror.offsetWidth || block.offsetWidth || 600));
  // 높이: 곡률이 클수록 글자가 안 잘리도록 자동 증가
  const amp = (cfg.curvature / 100) * (LINER_BASE_H * 0.45);
  const H = Math.round(LINER_BASE_H + amp + 24); // 진폭 여유 + 폰트 여유

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

  // path d
  path.setAttribute('id', pid);
  path.setAttribute('d', buildLinerPathD(cfg.preset, cfg.curvature, W, H, P));
  path.setAttribute('fill', 'none');

  // textPath href (id 재바인드)
  tp.setAttribute('href', '#' + pid);
  tp.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + pid);
  tp.setAttribute('startOffset', '50%');
  textEl.setAttribute('text-anchor', 'middle');

  // 폰트/색/letter-spacing — 미러 div style/computed에서 복사 (단일 소스 = 미러)
  const cs = window.getComputedStyle(mirror);
  const fontFamily = mirror.style.fontFamily || cs.fontFamily || "'Pretendard', sans-serif";
  const fontSize   = parseInt(cs.fontSize) || 28;
  const fontWeight = mirror.style.fontWeight || cs.fontWeight || '400';
  const fontStyle  = mirror.style.fontStyle || cs.fontStyle || 'normal';
  const fill       = mirror.style.color || cs.color || '#111111';
  const ls         = mirror.style.letterSpacing || cs.letterSpacing || 'normal';
  textEl.setAttribute('font-family', fontFamily);
  textEl.setAttribute('font-size', String(fontSize));
  textEl.setAttribute('font-weight', fontWeight);
  textEl.setAttribute('font-style', fontStyle);
  textEl.setAttribute('fill', fill);
  textEl.setAttribute('letter-spacing', (ls === 'normal' ? '0' : ls));

  // 텍스트 내용 동기화
  tp.textContent = readLinerText(mirror);

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
window.applyLiner            = applyLiner;
window.applyLinerText        = applyLinerText;
window.ensureLiner           = ensureLiner;
window.enhanceLinerPropPanel = enhanceLinerPropPanel;
window.initLinersInDom       = initLinersInDom;
window.LINER_DEFAULTS        = LINER_DEFAULTS;
window.LINER_PRESETS         = LINER_PRESETS;
