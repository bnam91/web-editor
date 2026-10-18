/* prop-sticker-arrow.js — 화살표 스티커(shape:'arrow' · 1013t2C4)의 우측 패널 절 「Arrow Line」.
 *   prop-sticker.js 가 shape==='arrow' 일 때 이 절만 보이고 원·사각 기본 절·Shape 고르기는 숨긴다(glow·coin 과 같은 길).
 *   행(이 순서): 종류(직선·곡선·꺾은·손그림) · 머리(한쪽·양쪽·없음) · 머리 꼴(채운 삼각·열린 V) · 선(실선·파선·점선) · 두께 ·
 *               휨(곡선일 때만 — 선 형광펜 「주기」 행이 물결에서만 보이는 꼴) · 색상 · [다시 섞기](손그림일 때만 · seed 만 새로).
 *   이동·길이·방향은 패널에 없다 — 캔버스의 끝점 손잡이(.hlb-handle · js/sticker-select.js)가 한다(각도는 두 끝점이 정한다).
 *   칩 아이콘은 이웃 「Highlight Line」 절(#stk-hlb-style-group)과 같은 꼴: 18×14 · viewBox 0 0 18 14 · currentColor.
 *   값 이름·기본값·범위는 그리개 한 자리(js/fx/arrow-render.js ArrowFx.KINDS/HEADS/TIPS/DASHES/DEFAULTS/LIMITS).
 *   ⛔seed 는 여기서만 새로 뽑는다(FxSeed.newSeed) — 그림은 seed 를 «읽기만» 한다.
 *   히스토리 = push-after(쓰고 그린 뒤 pushHistory) — glow·coin 절과 같은 규약. 조작 한 번 = 한 칸.
 */
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

const SVG = (inner) => `<svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const KIND_UI = {
  straight: { title: '직선',   icon: '<path d="M2,7 L15,7 M11.5,4 L15,7 L11.5,10"/>' },
  curve:    { title: '곡선',   icon: '<path d="M2,11 Q8,1 15,6 M11.6,3.9 L15,6 L12.1,8.7"/>' },
  elbow:    { title: '꺾은 선', icon: '<path d="M2,3 H9 V10 H15 M12.5,7.5 L15,10 L12.5,12.5"/>' },
  hand:     { title: '손그림', icon: '<path d="M2,8 C4,5 6,10 9,7 S13,6 15,7 M12,4.5 L15,7 L12,9.5"/>' },
};
const HEAD_UI = {
  end:  { title: '한쪽 머리',  icon: '<path d="M2,7 H15 M11.5,4 L15,7 L11.5,10"/>' },
  both: { title: '양쪽 머리',  icon: '<path d="M3,7 H15 M11.5,4 L15,7 L11.5,10 M6.5,4 L3,7 L6.5,10"/>' },
  none: { title: '머리 없음',  icon: '<path d="M2,7 H16"/>' },
};
const TIP_UI = {
  fill: { title: '채운 삼각', icon: '<path d="M2,7 H11"/><path d="M10,3.5 L16,7 L10,10.5 Z" fill="currentColor"/>' },
  open: { title: '열린 V',    icon: '<path d="M2,7 H15 M11,3.5 L15,7 L11,10.5"/>' },
};
const DASH_UI = {
  solid:  { title: '실선', icon: '<path d="M2,7 H16"/>' },
  dashed: { title: '파선', icon: '<path d="M2,7 H16" stroke-dasharray="3.5 2.5"/>' },
  dotted: { title: '점선', icon: '<path d="M2.5,7 H16" stroke-width="2" stroke-dasharray="0.01 3.5"/>' },
};

const fx = () => window.ArrowFx || null;
const listOf = (key, fb) => (fx() && fx()[key]) || fb;
const D = () => (fx() && fx().DEFAULTS) || { kind: 'straight', head: 'end', tip: 'fill', dash: 'solid', thickness: 4, bend: 40, color: '#1a1a1a' };
const LIM = () => (fx() && fx().LIMITS) || { thickness: [1, 40], bend: [-100, 100] };

function chipGroup(id, attr, list, ui, cur) {
  return `<div class="prop-align-group" id="${id}" style="flex:1;">
          ${list.map(k => `<button class="prop-align-btn${k === cur ? ' active' : ''}" data-${attr}="${k}" title="${ui[k]?.title || k}">${SVG(ui[k]?.icon || '')}</button>`).join('')}
        </div>`;
}

export function arrowSectionHTML(block) {
  const d = block.dataset, def = D(), lim = LIM();
  const kind = d.arrowKind || def.kind;
  const T = parseFloat(d.thickness), B = parseFloat(d.arrowBend);
  const t = Number.isFinite(T) ? T : def.thickness;
  const b = Number.isFinite(B) ? B : def.bend;
  const color = d.arrowColor || def.color;
  return `
    <div class="prop-section" id="stk-arrow-section">
      <div class="prop-section-title">Arrow Line</div>
      <div class="prop-row"><span class="prop-label">종류</span>
        ${chipGroup('stk-arrow-kind', 'arrow-kind', listOf('KINDS', ['straight', 'curve', 'elbow', 'hand']), KIND_UI, kind)}
      </div>
      <div class="prop-row"><span class="prop-label">머리</span>
        ${chipGroup('stk-arrow-head', 'arrow-head', listOf('HEADS', ['end', 'both', 'none']), HEAD_UI, d.arrowHead || def.head)}
      </div>
      <div class="prop-row"><span class="prop-label">머리 꼴</span>
        ${chipGroup('stk-arrow-tip', 'arrow-tip', listOf('TIPS', ['fill', 'open']), TIP_UI, d.arrowTip || def.tip)}
      </div>
      <div class="prop-row"><span class="prop-label">선</span>
        ${chipGroup('stk-arrow-dash', 'arrow-dash', listOf('DASHES', ['solid', 'dashed', 'dotted']), DASH_UI, d.arrowDash || def.dash)}
      </div>
      <div class="prop-row"><span class="prop-label">두께</span>
        <input type="range" class="prop-slider" id="stk-arrow-thick" min="${lim.thickness[0]}" max="${lim.thickness[1]}" step="1" value="${t}">
        <input type="number" class="prop-number" id="stk-arrow-thick-num" min="${lim.thickness[0]}" max="${lim.thickness[1]}" value="${t}">
      </div>
      <div class="prop-row" id="stk-arrow-bend-row" style="display:${kind === 'curve' ? 'flex' : 'none'};"><span class="prop-label">휨</span>
        <input type="range" class="prop-slider" id="stk-arrow-bend" min="${lim.bend[0]}" max="${lim.bend[1]}" step="1" value="${b}">
        <input type="number" class="prop-number" id="stk-arrow-bend-num" min="${lim.bend[0]}" max="${lim.bend[1]}" value="${b}">
      </div>
      <div class="prop-color-row" style="margin-top:6px;">
        <span class="prop-label">색상</span>
        ${colorFieldHTML({ idPrefix: 'stk-arrow-color', hex: color, alpha: parseAlphaFromColor(color) })}
      </div>
      <div class="prop-row" id="stk-arrow-reroll-row" style="display:${kind === 'hand' ? 'flex' : 'none'};">
        <button class="prop-action-btn" id="stk-arrow-reroll" style="width:100%;" title="손그림 흔들림만 새로 섞는다(끝점·색·두께는 그대로)">다시 섞기</button>
      </div>
    </div>`;
}

/** @param {HTMLElement} panel  propPanel · @param {Function} rerender  renderStickerBlock + rememberStickerStyle */
export function wireArrowSection(panel, block, rerender) {
  const commit = (label) => { window.pushHistory?.(label); window.scheduleAutoSave?.(); };
  const $ = (id) => panel.querySelector('#' + id);
  /* 그리기가 innerHTML 을 갈아 끼워 끝점 손잡이가 사라진다 — 골라져 있으면 다시 단다(선 형광펜 칸과 같은 꼴). */
  const redraw = () => {
    rerender();
    if (block.classList.contains('selected')) window._addHlbHandles?.(block);
  };
  const syncRows = () => {
    const k = block.dataset.arrowKind;
    const bend = $('stk-arrow-bend-row'), rr = $('stk-arrow-reroll-row');
    if (bend) bend.style.display = k === 'curve' ? 'flex' : 'none';
    if (rr) rr.style.display = k === 'hand' ? 'flex' : 'none';
  };

  const chips = (groupId, attr, key, label) => {
    panel.querySelectorAll(`#${groupId} .prop-align-btn`).forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.getAttribute(`data-${attr}`);
        if (!v || block.dataset[key] === v) return;
        panel.querySelectorAll(`#${groupId} .prop-align-btn`).forEach(b => b.classList.toggle('active', b === btn));
        block.dataset[key] = v;
        syncRows();
        redraw(); commit(label);
      });
    });
  };
  chips('stk-arrow-kind', 'arrow-kind', 'arrowKind', '화살표 종류');
  chips('stk-arrow-head', 'arrow-head', 'arrowHead', '화살표 머리');
  chips('stk-arrow-tip',  'arrow-tip',  'arrowTip',  '화살표 머리 꼴');
  chips('stk-arrow-dash', 'arrow-dash', 'arrowDash', '화살표 선');

  const pair = (sid, nid, key, label) => {
    const s = $(sid), n = $(nid);
    if (!s || !n) return;
    const apply = (v) => {
      v = Math.min(+s.max, Math.max(+s.min, Math.round(+v || 0)));
      block.dataset[key] = String(v); s.value = v; n.value = v; redraw();
    };
    s.addEventListener('input', () => apply(s.value));
    n.addEventListener('input', () => apply(n.value));
    s.addEventListener('change', () => commit(label));
    n.addEventListener('change', () => commit(label));
  };
  pair('stk-arrow-thick', 'stk-arrow-thick-num', 'thickness', '화살표 두께');
  pair('stk-arrow-bend', 'stk-arrow-bend-num', 'arrowBend', '화살표 휨');

  wireColorField('stk-arrow-color', {
    initialAlpha: parseAlphaFromColor(block.dataset.arrowColor || D().color),
    onApply: (c) => { block.dataset.arrowColor = c; redraw(); },
    onCommit: () => commit('화살표 색'),
  });

  $('stk-arrow-reroll')?.addEventListener('click', () => {
    if (!window.FxSeed) return;
    block.dataset.seed = String(window.FxSeed.newSeed());
    redraw(); commit('화살표 다시 섞기');
  });
}
