import { propPanel, state } from '../globals.js';
import { blockHeaderHTML } from './_helpers.js';
import { renderPanel, sec } from './_panel-frame.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';
import { panelRenderedPx } from './_panel-rendered.js';
import { layoutSizeRowHTML, layoutPadSlotHTML, wireLayoutSection } from './_layout-section.js';   // 표준 Layout(L2·L3 · C1)
import { appearanceSectionHTML, appearanceHeadToolsHTML, wireAppearanceSection } from './_appearance-section.js';   // 표준 Appearance(A4 Opacity)

export function showDividerProperties(block) {
  const lineColor  = block.dataset.lineColor  || '#cccccc';
  const lineAlpha  = parseAlphaFromColor(lineColor);
  const lineStyle  = block.dataset.lineStyle  || 'solid';
  const lineWeight = parseInt(block.dataset.lineWeight) || 1;
  const padV       = Math.round(panelRenderedPx(block, 'paddingTop'));   // 묶음 B E111 — 그려진 위아래 여백(렌더 applyDividerStyle: padV || 30 · '0' 은 0). 옛 `|| 12` 는 빈 값·0 둘 다 12 로 그렸다
  const padH       = parseInt(block.dataset.padH)       || 0;
  const lineDir    = block.dataset.lineDir    || 'horizontal';
  const lineLength = parseInt(block.dataset.lineLength) || 80;
  const isVertical = lineDir === 'vertical';
  /* 가로 «너비» 슬라이더의 끝 = 지금 선이 펼 수 있는 전폭(블록 폭 − 좌우 패딩). 끝까지 올리면 «전폭»(값 없음)으로 돌아간다. */
  const fullW = Math.max(40, Math.round((block.clientWidth || 860) - padH * 2));
  const lineWidth = Math.min(fullW, parseInt(block.dataset.lineWidth) || fullW);

  renderPanel(block, {
    header: blockHeaderHTML({
      icon: `          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <line x1="1" y1="6" x2="11" y2="6"/>
          </svg>`,
      name: block.dataset.layerName,
      defaultName: 'Divider',
      crumb: window.getBlockBreadcrumb(block),
      id: block.id,
    }),
    sections: [
      sec('kind', `
      <div class="prop-align-group" id="dvd-dir-group">
        <button class="prop-align-btn${!isVertical?' active':''}" data-dir="horizontal">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="1" y1="7" x2="13" y2="7"/></svg>
          가로
        </button>
        <button class="prop-align-btn${isVertical?' active':''}" data-dir="vertical">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="7" y1="1" x2="7" y2="13"/></svg>
          세로
        </button>
      </div>`),
      // 옛 「Line Style」 한 절 → 색·스타일·굵기 = Special «Line»(선이 곧 몸 · 현빈 F5-3 «구분선 = Special(Line)» · Stroke 2-2 이사와 같게) · 너비/길이 = Size
      /* ★현빈 261123 — 구분선 = Stroke 절 «밖» Special «Line» 으로 이사(선이 곧 몸 · 표준 Stroke 칸 뜻 없음 · 정본 시안 8910 strokestd2 19) · 몸 컨트롤·id·배선 그대로 · 이름 «두께» → «굵기»(지디 이름 통일) */
      sec('special', `
      <div class="prop-color-row" data-own="special:Line">${/* data-own: 선 색 — 소유표 fill 로 가지만 선이 곧 몸이라 Line 절의 한 몸(현빈 F5-3) */ ''}
        <span class="prop-label">색상</span>
        ${colorFieldHTML({ idPrefix: 'dvd', hex: lineColor, alpha: lineAlpha })}
      </div>
      <div class="prop-row">
        <span class="prop-label">스타일</span>
        <select class="prop-select" id="dvd-style">
          <option value="solid"  ${lineStyle==='solid'  ?'selected':''}>실선</option>
          <option value="dashed" ${lineStyle==='dashed' ?'selected':''}>파선</option>
          <option value="dotted" ${lineStyle==='dotted' ?'selected':''}>점선</option>
          <option value="tick"   ${lineStyle==='tick'   ?'selected':''}>눈금(레일)</option>
        </select>
      </div>
      <div class="prop-row">
        <span class="prop-label">굵기</span>
        <input type="range" class="prop-slider" id="dvd-weight-slider" min="1" max="24" step="1" value="${lineWeight}">
        <input type="number" class="prop-number" id="dvd-weight-number" min="1" max="24" value="${lineWeight}">
      </div>`, { title: 'Line' }),
      /* ★표준 Layout L2·L3(현빈 261124 L-4 · 시안 #mkp-layoutstd) — 옛 dvd-width/length/pady/padx-slider 걷음 · 숫자 칸 id·키·범위 무변
         ★전폭 = 너비 칸 max(fullW) — 라벨 끌기·숫자로 max 에 닿으면 «전폭»(키 지움 · 탑 판정 261125 · 새 모드 0) · 전폭 사슬 막힘(부품 chain.blocked)은 사슬 없는 한 칸이라 해당 없음
         너비·길이 = 한 칸(one · ↔/↕) · 패딩 = 축마다 제 상한(좌우 2000 · 상하 120) */
      sec('size', `
      <div id="dvd-width-row" style="display:${isVertical?'none':'block'}">${layoutSizeRowHTML({ prefix: 'dvd-w', one: { id: 'dvd-width-number', label: 'Width', min: 20, max: fullW, value: lineWidth } })}</div>
      <div id="dvd-length-row" style="display:${isVertical?'block':'none'}">${layoutSizeRowHTML({ prefix: 'dvd-l', one: { id: 'dvd-length-number', label: 'Length', icon: 'h', min: 20, max: 400, value: lineLength } })}</div>`),
      sec('padding', layoutPadSlotHTML({ xId: 'dvd-padx-number', yId: 'dvd-pady-number', x: padH, y: padV, xMax: 2000, yMax: 120 })),
      sec('appearance', appearanceSectionHTML({ prefix: 'dvd', op: { value: window.readBlockOpacity?.(block) ?? 100 } }), { headTools: appearanceHeadToolsHTML({ prefix: 'dvd' }) }),   // A4 Opacity 만(모서리 없음)
    ],
  });

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  // 방향 토글
  propPanel.querySelector('#dvd-dir-group').addEventListener('click', e => {
    const btn = e.target.closest('[data-dir]');
    if (!btn) return;
    block.dataset.lineDir = btn.dataset.dir;
    const isVert = btn.dataset.dir === 'vertical';
    propPanel.querySelectorAll('#dvd-dir-group .prop-align-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.dir === btn.dataset.dir));
    propPanel.querySelector('#dvd-length-row').style.display = isVert ? 'block' : 'none';
    propPanel.querySelector('#dvd-width-row').style.display = isVert ? 'none' : 'block';
    window.applyDividerStyle(block);
    window.pushHistory();
  });

  /* 표준 Layout 배선(부품) — input = 범위 안이면 바로 · change = 잘라 + 이력 한 번 · 빈 칸 = 옛 값 되돌림 · 라벨 끌기 */
  // 길이 (세로 전용)
  wireLayoutSection({ w: { numberId: 'dvd-length-number', min: 20, max: 400, apply: (v) => { block.dataset.lineLength = v; window.applyDividerStyle(block); } } });
  // 너비 (가로 전용) — 끝(전폭)이면 값을 지운다: «전폭»은 숫자가 아니라 «없음»이다(섹션 폭이 바뀌어도 따라간다)
  wireLayoutSection({ w: { numberId: 'dvd-width-number', min: 20, max: fullW, apply: (v) => {
    if (v >= fullW) delete block.dataset.lineWidth; else block.dataset.lineWidth = v;
    window.applyDividerStyle(block);
  } } });

  const applyAll = () => window.applyDividerStyle(block);
  wireColorField('dvd', {
    initialAlpha: lineAlpha,
    onApply: (c) => { block.dataset.lineColor = c; applyAll(); },
    onCommit: () => window.pushHistory(),
  });

  document.getElementById('dvd-style').addEventListener('change', e => {
    block.dataset.lineStyle = e.target.value;
    applyAll(); window.pushHistory();
  });

  const wSlider = document.getElementById('dvd-weight-slider');
  const wNumber = document.getElementById('dvd-weight-number');
  const applyWeight = v => {
    v = Math.min(24, Math.max(1, v));
    block.dataset.lineWeight = v;
    applyAll();
    wSlider.value = v; wNumber.value = v;
  };
  wSlider.addEventListener('input',  () => applyWeight(parseInt(wSlider.value)));
  wNumber.addEventListener('change', () => { applyWeight(parseInt(wNumber.value)); window.pushHistory(); });
  wSlider.addEventListener('change', () => window.pushHistory());

  // 패딩 슬롯 — 축마다 제 상한(상하 120 · 좌우 2000)
  wireLayoutSection({ w: { numberId: 'dvd-pady-number', min: 0, max: 120, apply: (v) => { block.dataset.padV = v; applyAll(); } } });
  wireLayoutSection({ w: { numberId: 'dvd-padx-number', min: 0, max: 2000, apply: (v) => { block.dataset.padH = v; applyAll(); } } });
  wireAppearanceSection({ op: { numberId: 'dvd-opacity', apply: (v) => window.setBlockOpacity?.(block, v) } });   // A4 — 계약(갈래 E) 없으면 그리기 0
}

// Backward compat: classic scripts call these via window.*

window.showDividerProperties = showDividerProperties;
