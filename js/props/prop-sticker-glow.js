/* prop-sticker-glow.js — 글로우 이펙트 스티커(shape:'glow')의 우측 패널 절.
 *   prop-sticker.js 가 shape==='glow' 일 때 이 절만 보이고 원·사각 기본 절·Shape 고르기는 숨긴다.
 *   조절 축(2026-10-06 지디 발주 FOUR 설계): 종류(프리셋) · 후광색 · 심 색 · 세기(진하기) · 퍼짐(반경) · 갈래 수 · 색수차 · 불투명도(fxOpacity) · [다시 뿌리기](seed).
 *   ⛔seed 는 여기서만 새로 뽑는다(js/fx/seeded-random.js FxSeed.newSeed) — 그림(glow-render.js)은 seed 를 «읽기만» 한다.
 *   ★「다시 뿌리기」의 0.2초 페이드는 «상태 전이 표시»다(지디 ②-1: 효과 애니메이션은 넣지 않는다 — 화면 == 내보낸 것).
 */
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

const KIND_LABEL = { star: '별 반짝이', flare: '렌즈 플레어', dot: '빛점' };

export function glowSectionHTML(block) {
  const d = block.dataset;
  const kind = d.fxKind || 'star';
  const I = parseInt(d.intensity, 10);
  const OP = parseInt(d.fxOpacity, 10);
  const SP = parseInt(d.spread, 10);
  const rays = parseInt(d.rays, 10);
  const raysOn = kind !== 'dot';
  const kinds = (window.GlowFx && window.GlowFx.KINDS) || ['star', 'flare', 'dot'];
  return `
    <div class="prop-section" id="stk-glow-section">
      <div class="prop-section-title">Glow</div>
      <div class="prop-row">
        <div class="prop-align-group" id="stk-glow-kind">
          ${kinds.map(k => `<button class="prop-align-btn${k === kind ? ' active' : ''}" data-fx-kind="${k}" title="${KIND_LABEL[k] || k}">${KIND_LABEL[k] || k}</button>`).join('')}
        </div>
      </div>
      <div class="prop-row"><span class="prop-label">후광</span>
        ${colorFieldHTML({ idPrefix: 'stk-glow-color', hex: d.glowColor || '#b06cff', alpha: parseAlphaFromColor(d.glowColor || '#b06cff') })}
      </div>
      <div class="prop-row"><span class="prop-label">심</span>
        ${colorFieldHTML({ idPrefix: 'stk-glow-core', hex: d.coreColor || '#ffffff', alpha: parseAlphaFromColor(d.coreColor || '#ffffff') })}
      </div>
      <div class="prop-row"><span class="prop-label">세기</span>
        <input type="range" class="prop-slider" id="stk-glow-int" min="0" max="100" step="1" value="${Number.isFinite(I) ? I : 70}">
        <input type="number" class="prop-number" id="stk-glow-int-num" min="0" max="100" value="${Number.isFinite(I) ? I : 70}">
      </div>
      <div class="prop-row"><span class="prop-label">퍼짐</span>
        <input type="range" class="prop-slider" id="stk-glow-spread" min="0" max="20" step="1" value="${Number.isFinite(SP) ? SP : 6}">
        <input type="number" class="prop-number" id="stk-glow-spread-num" min="0" max="20" value="${Number.isFinite(SP) ? SP : 6}">
      </div>
      <div class="prop-row"><span class="prop-label">불투명도</span>
        <input type="range" class="prop-slider" id="stk-glow-op" min="0" max="100" step="1" value="${Number.isFinite(OP) ? OP : 100}">
        <input type="number" class="prop-number" id="stk-glow-op-num" min="0" max="100" value="${Number.isFinite(OP) ? OP : 100}">
      </div>
      <div class="prop-row" id="stk-glow-rays-row" style="display:${raysOn ? 'flex' : 'none'};"><span class="prop-label">갈래</span>
        <input type="range" class="prop-slider" id="stk-glow-rays" min="${kind === 'star' ? 2 : 0}" max="${kind === 'star' ? 8 : 12}" step="1" value="${Number.isFinite(rays) ? rays : 4}">
        <input type="number" class="prop-number" id="stk-glow-rays-num" min="${kind === 'star' ? 2 : 0}" max="${kind === 'star' ? 8 : 12}" value="${Number.isFinite(rays) ? rays : 4}">
      </div>
      <div class="prop-row"><span class="prop-label">색수차</span>
        <input type="checkbox" id="stk-glow-chroma" ${d.chroma === '1' ? 'checked' : ''}>
      </div>
      <div class="prop-row">
        <button class="prop-action-btn" id="stk-glow-reroll" style="width:100%;" title="모양만 새로 뿌린다(색·세기는 그대로)">다시 뿌리기</button>
      </div>
    </div>`;
}

/** @param {HTMLElement} panel  propPanel · @param {Function} rerender  renderStickerBlock + rememberStickerStyle */
export function wireGlowSection(panel, block, rerender) {
  const commit = (label) => { window.pushHistory?.(label); window.scheduleAutoSave?.(); };
  const $ = (id) => panel.querySelector('#' + id);

  panel.querySelectorAll('#stk-glow-kind [data-fx-kind]').forEach(btn => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.fxKind;
      const pre = window.GlowFx?.PRESETS?.[k];
      if (!pre || block.dataset.fxKind === k) return;
      /* 종류를 바꾸면 그 프리셋(색·세기·갈래·크기)을 «통째로» 깐다 — 현빈이 시안을 보고 고르게(지디 ②-2). seed 는 그대로. */
      Object.assign(block.dataset, { fxKind: k, glowColor: pre.glowColor, coreColor: pre.coreColor, intensity: pre.intensity, spread: pre.spread,
        rays: pre.rays, chroma: pre.chroma, fxOpacity: pre.fxOpacity, sizeW: pre.sizeW, sizeH: pre.sizeH });
      rerender(); commit('글로우 종류');
      window.showStickerProperties?.(block);   // 칸 값·갈래 범위를 새 종류로 다시 그린다
    });
  });

  wireColorField('stk-glow-color', {
    initialAlpha: parseAlphaFromColor(block.dataset.glowColor || '#b06cff'),
    onApply: (c) => { block.dataset.glowColor = c; rerender(); },
    onCommit: () => commit('글로우 후광색'),
  });
  wireColorField('stk-glow-core', {
    initialAlpha: parseAlphaFromColor(block.dataset.coreColor || '#ffffff'),
    onApply: (c) => { block.dataset.coreColor = c; rerender(); },
    onCommit: () => commit('글로우 심 색'),
  });

  const pair = (sid, nid, key, label) => {
    const s = $(sid), n = $(nid);
    if (!s || !n) return;
    const apply = (v) => {
      v = Math.min(+s.max, Math.max(+s.min, Math.round(+v || 0)));
      block.dataset[key] = String(v); s.value = v; n.value = v; rerender();
    };
    s.addEventListener('input', () => apply(s.value));
    n.addEventListener('input', () => apply(n.value));
    s.addEventListener('change', () => commit(label));
    n.addEventListener('change', () => commit(label));
  };
  pair('stk-glow-int', 'stk-glow-int-num', 'intensity', '글로우 세기');
  pair('stk-glow-rays', 'stk-glow-rays-num', 'rays', '글로우 갈래');
  pair('stk-glow-op', 'stk-glow-op-num', 'fxOpacity', '글로우 불투명도');
  pair('stk-glow-spread', 'stk-glow-spread-num', 'spread', '글로우 퍼짐');

  $('stk-glow-chroma')?.addEventListener('change', (e) => {
    block.dataset.chroma = e.target.checked ? '1' : '0'; rerender(); commit('글로우 색수차');
  });

  $('stk-glow-reroll')?.addEventListener('click', () => {
    if (!window.FxSeed) return;
    block.dataset.seed = String(window.FxSeed.newSeed());
    rerender(); commit('글로우 다시 뿌리기');
    /* 0.2초 페이드 = «새로 뿌렸다»는 상태 표시(효과 아님). 인라인 style 이 아니라 Web Animations — 저장본에 안 남는다. */
    try { block.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' }); } catch (_) { /* 조용한 까닭: 표시용 — 못 해도 다시 뿌리기 자체는 끝났다 */ }
  });
}
