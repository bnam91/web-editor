import { propPanel, state } from '../globals.js';
import { blockHeaderHTML } from './_helpers.js';
import { renderPanel, sec } from './_panel-frame.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';
import { fillSectionHTML, fillHeadToolsHTML, wireFillSection, fillLast, fillHiddenOf, setFillHiddenKey } from './_fill-section.js';

// 브릿지(V 커버) 블록 프로퍼티 — 색상 + 꼬리(V홈) 모양(너비/깊이/곡률 슬라이더) + 블록 높이. 공용 prop 클래스 재사용.
// 모양 파라미터는 data-bridge-width/depth/arc/height 에 저장(직렬화) → renderBridgeBlock이 path/높이 재생성.
// arc(곡률, 부호 -200~+100): 0=직선 V(뾰족), +밖으로 볼록(꼭지점 지나는 호→+100 아치), −안으로 오목(개구부 풀폭 유지·사이드만 안으로 휨, 꼭지점 뾰족, -200까지 더 깊게). (현빈 요청)
//   슬라이더 양방향으로 연속 조절, 프리셋 제거(중복).

export function showBridgeProperties(block) {
  const color  = block.dataset.bridgeColor || '#cccccc';
  const alpha  = parseAlphaFromColor(color);
  // 초기 표시값: 손상/범위초과 저장값도 슬라이더 범위로 클램프(코덱스 Q7). 기본값은 renderBridgeBlock과 일치(arc 0).
  const clamp = (v, lo, hi, dflt) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt; };
  const width  = clamp(block.dataset.bridgeWidth,  30, 860, 120);
  const depth  = clamp(block.dataset.bridgeDepth,   8,  90,  88);
  const arc    = clamp(block.dataset.bridgeArc,  -200, 100,   0);
  const height = clamp(block.dataset.bridgeHeight, 20, 300,  90);
  // t13C-02 모양: V(지금) · 둥근 물결 · 뾰족 물결 — 없는 키 = V(옛 저장본) · 물결 손잡이 기본값 = block-factory BRIDGE_WAVE_DEFAULTS 한 벌
  const shape = block.dataset.bridgeShape === 'round' || block.dataset.bridgeShape === 'sharp' ? block.dataset.bridgeShape : 'v';
  const WD = (window.BRIDGE_WAVE_DEFAULTS || {})[shape] || { amp: 30, count: 3 };
  const wAmp = clamp(block.dataset.bridgeWaveAmp, 4, 80, WD.amp);
  const wCount = clamp(block.dataset.bridgeWaveCount, 1, 24, WD.count);
  const wPhase = block.dataset.bridgeWavePhase === 'trough' ? 'trough' : 'crest';

  renderPanel(block, {
    header: blockHeaderHTML({
      icon: `          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3"><path d="M1 4 H4.5 Q5.2 4 6 7 Q6.8 4 7.5 4 H11"/></svg>`,
      name: block.dataset.layerName,
      defaultName: 'Bridge',
      crumb: window.getBlockBreadcrumb(block),
      id: block.id,
    }),
    sections: [
      sec('fill', fillSectionHTML({ prefix: 'brg-fill', hiddenWhy: '', hidden: fillHiddenOf(block), on: color !== 'transparent', colorHtml: colorFieldHTML({ idPrefix: 'brg', hex: color, alpha }) }),
        { headTools: fillHeadToolsHTML({ prefix: 'brg-fill', on: color !== 'transparent' }) }),   // 표준 Fill F2 — 없음 = bridgeColor 'transparent'(svg path fill 그대로 받음)
      sec('size', `
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range" class="prop-slider" id="brg-h-slider" min="20" max="300" step="2" value="${height}">
        <input type="number" class="prop-number" id="brg-h-number" min="20" max="300" value="${height}">
      </div>`),
      // 옛 제목 「꼬리 (V홈)」 — 절 제목 규칙(영어 Title Case · 괄호 금지)으로 «Tail». V홈 모양 세 손잡이(너비·깊이·곡률)
      sec('special', `
      <div class="prop-row">
        <span class="prop-label">모양</span>
        <select class="prop-select" id="brg-shape" style="flex:1">
          <option value="v"${shape === 'v' ? ' selected' : ''}>V</option>
          <option value="round"${shape === 'round' ? ' selected' : ''}>둥근 물결</option>
          <option value="sharp"${shape === 'sharp' ? ' selected' : ''}>뾰족 물결</option>
        </select>
      </div>` + (shape !== 'v' ? `
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range" class="prop-slider" id="brg-wa-slider" min="4" max="80" step="1" value="${wAmp}">
        <input type="number" class="prop-number" id="brg-wa-number" min="4" max="80" value="${wAmp}">
      </div>
      <div class="prop-row">
        <span class="prop-label">반복</span>
        <input type="range" class="prop-slider" id="brg-wn-slider" min="1" max="24" step="1" value="${wCount}">
        <input type="number" class="prop-number" id="brg-wn-number" min="1" max="24" value="${wCount}">
      </div>
      <div class="prop-row">
        <span class="prop-label">방향</span>
        <select class="prop-select" id="brg-wp" style="flex:1">
          <option value="crest"${wPhase === 'crest' ? ' selected' : ''}>마루로 시작</option>
          <option value="trough"${wPhase === 'trough' ? ' selected' : ''}>골로 시작</option>
        </select>
      </div>` : `
      <div class="prop-row">
        <span class="prop-label">너비</span>
        <input type="range" class="prop-slider" id="brg-w-slider" min="30" max="860" step="2" value="${width}">
        <input type="number" class="prop-number" id="brg-w-number" min="30" max="860" value="${width}">
      </div>
      <div class="prop-row">
        <span class="prop-label">깊이</span>
        <input type="range" class="prop-slider" id="brg-d-slider" min="8" max="90" step="1" value="${depth}">
        <input type="number" class="prop-number" id="brg-d-number" min="8" max="90" value="${depth}">
      </div>
      <div class="prop-row">
        <span class="prop-label">곡률</span>
        <input type="range" class="prop-slider" id="brg-a-slider" min="-200" max="100" step="1" value="${arc}">
        <input type="number" class="prop-number" id="brg-a-number" min="-200" max="100" value="${arc}">
      </div>`), { title: 'Tail' }),
    ],
  });

  // 색상
  wireColorField('brg', {
    initialAlpha: alpha,
    onApply: (c) => {
      block.dataset.bridgeColor = c;
      const path = block.querySelector('svg path');
      if (path) path.setAttribute('fill', c);
    },
    onCommit: () => { window.pushHistory?.(); window.scheduleAutoSave?.(); },
  });
  /* 표준 Fill F2 — − = 'transparent' · ＋ = 지난 색 · 없으면 #CCCCCC(BRIDGE_DEFAULTS) */
  const _brgFill = (c) => { block.dataset.bridgeColor = c; block.querySelector('svg path')?.setAttribute('fill', c); window.scheduleAutoSave?.(); showBridgeProperties(block); };
  wireFillSection({ prefix: 'brg-fill', adapter: {
    hide: (on) => { setFillHiddenKey(block, on); window.renderBridgeBlock?.(block); window.scheduleAutoSave?.(); },   // F6-2b 숨김 — 키 + 다시 그림(렌더러가 svg fill-opacity 0)
    none: () => { fillLast.set(block.id, color); _brgFill('transparent'); },
    add: () => _brgFill(fillLast.get(block.id, '#cccccc')),
    commit: () => window.pushHistory?.() } });

  const $ = (id) => document.getElementById(id);
  const wSlider = $('brg-w-slider'), wNumber = $('brg-w-number');
  const dSlider = $('brg-d-slider'), dNumber = $('brg-d-number');
  const aSlider = $('brg-a-slider'), aNumber = $('brg-a-number');
  const hSlider = $('brg-h-slider'), hNumber = $('brg-h-number');

  const rerender = () => { window.renderBridgeBlock?.(block); };
  const setWidth  = (v) => { v = Math.max(30, Math.min(860, parseInt(v) || 120)); block.dataset.bridgeWidth  = String(v); wSlider.value = v; wNumber.value = v; rerender(); };
  const setDepth  = (v) => { v = Math.max(8,  Math.min(90,  parseInt(v) || 88));  block.dataset.bridgeDepth  = String(v); dSlider.value = v; dNumber.value = v; rerender(); };
  const setArc    = (v) => { v = parseInt(v); if (!Number.isFinite(v)) v = 0; v = Math.max(-200, Math.min(100, v)); block.dataset.bridgeArc = String(v); aSlider.value = v; aNumber.value = v; rerender(); };  // 부호값: −안으로 오목 / 0 직선 / +밖으로 볼록
  const setHeight = (v) => { v = Math.max(20, Math.min(300, parseInt(v) || 90));  block.dataset.bridgeHeight = String(v); hSlider.value = v; hNumber.value = v; rerender(); };
  const commit = () => { window.pushHistory?.(); window.scheduleAutoSave?.(); };

  hSlider.addEventListener('input', () => setHeight(hSlider.value));   // 블럭 높이(Size) — 모양과 무관
  hSlider.addEventListener('change', commit);
  hNumber.addEventListener('change', () => { setHeight(hNumber.value); commit(); });

  /* t13C-02 모양·물결 손잡이 — 모양 바꾸면 패널 다시(V 줄 ↔ 물결 줄) · 값 = data-bridge-wave-* (V 값은 그대로 둠 = 되돌아오면 옛 V) */
  $('brg-shape')?.addEventListener('change', (e) => {
    const v = e.target.value;
    if (v === 'round' || v === 'sharp') block.dataset.bridgeShape = v; else delete block.dataset.bridgeShape;
    rerender(); commit(); showBridgeProperties(block);
  });
  const wire = (sid, nid, key, lo, hi) => {
    const sl = $(sid), nu = $(nid); if (!sl || !nu) return;
    const set = (v) => { v = Math.max(lo, Math.min(hi, Math.round(+v))); if (!Number.isFinite(v)) return; block.dataset[key] = String(v); sl.value = v; nu.value = v; rerender(); };
    sl.addEventListener('input', () => set(sl.value)); sl.addEventListener('change', commit);
    nu.addEventListener('change', () => { set(nu.value); commit(); });
  };
  wire('brg-wa-slider', 'brg-wa-number', 'bridgeWaveAmp', 4, 80);
  wire('brg-wn-slider', 'brg-wn-number', 'bridgeWaveCount', 1, 24);
  $('brg-wp')?.addEventListener('change', (e) => { block.dataset.bridgeWavePhase = e.target.value === 'trough' ? 'trough' : 'crest'; rerender(); commit(); });
  if (shape !== 'v') return;   // 아래는 V 손잡이(물결일 땐 그 줄이 없다)

  wSlider.addEventListener('input', () => setWidth(wSlider.value));
  wSlider.addEventListener('change', commit);
  wNumber.addEventListener('change', () => { setWidth(wNumber.value); commit(); });
  dSlider.addEventListener('input', () => setDepth(dSlider.value));
  dSlider.addEventListener('change', commit);
  dNumber.addEventListener('change', () => { setDepth(dNumber.value); commit(); });
  aSlider.addEventListener('input', () => setArc(aSlider.value));
  aSlider.addEventListener('change', commit);
  aNumber.addEventListener('change', () => { setArc(aNumber.value); commit(); });
}

window.showBridgeProperties = showBridgeProperties;
