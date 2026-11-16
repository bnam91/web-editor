/* prop-slide.js — 슬라이드 블럭 우측 패널(내용만 · 현빈 결정 261116: 움직임은 «GIF 버튼 → GIF 패널») · 0.9.13 MOTION-SLIDE-BLOCK-01
 *   dev 관례 그대로(prop-cert.js 와 같은 꼴): prop-section · sliderRowHTML · .prop-btn · .prop-row · prop-anim-btn(텍스트 패널 GIF 단추와 같은 절) — 새 CSS 0
 *   사진: 넣기 = grdPickImageFile(prop-grid.js — 자산 URL 길) · 순서 ↑↓ · 빼기 ✕ · 최대 SLIDE_MAX
 *   GIF 단추 노출 = animGifVisible(feature-flags.js 한 자리 — 텍스트 패널과 같은 판정 · 관리자). 이력 = 고친 «뒤» pushHistory(js/CLAUDE.md 규약).
 *   ⛔그림 주소는 escHtml 로 속성에(남이 준 프로젝트에서 올 수 있다).
 */
import { propPanel } from '../globals.js';
import { blockHeaderHTML, sliderRowHTML, escHtml } from './_helpers.js';
import { grdPickImageFile } from './prop-grid.js';
import { readSlideState, setSlideList, setSlideLayout } from '../blocks/slide-block.js';
import { SLIDE_MAX, slideAxis } from '../fx/slide-motion.js';

const _ICON = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3"><rect x="1" y="3" width="6" height="6" rx="0.5"/><path d="M8.5 3.5v5M10.5 4.5v3"/></svg>`;
const _adminState = () => (window.__admin && typeof window.__admin.state === 'function' ? window.__admin.state() : null);

export function showSlideProperties(block) {
  if (!block) return;
  const st = readSlideState(block);
  const full = st.slides.length >= SLIDE_MAX;
  const photoRows = st.slides.map((s, i) => `<div class="prop-row sld-photo-row" data-idx="${i}">
        <span class="prop-label">사진 ${i + 1}</span>
        <img class="sld-thumb" src="${escHtml(s.src)}" alt="" style="width:44px;height:28px;object-fit:cover;border-radius:3px;flex:0 0 auto">
        <button class="prop-btn sld-up" title="앞으로"${i === 0 ? ' disabled' : ''}>↑</button>
        <button class="prop-btn sld-down" title="뒤로"${i === st.slides.length - 1 ? ' disabled' : ''}>↓</button>
        <button class="prop-btn sld-del" title="빼기">✕</button>
      </div>`).join('');
  propPanel.innerHTML = `
    <div class="prop-section">
${blockHeaderHTML({ icon: _ICON, name: block.dataset.layerName, defaultName: 'Slides', crumb: window.getBlockBreadcrumb ? window.getBlockBreadcrumb(block) : '', id: block.id })}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Slides</div>
      ${photoRows || '<div class="prop-row"><span class="prop-label">사진 없음</span></div>'}
      <div class="prop-row"><button class="prop-btn" id="sld-add" style="width:100%"${full ? ' disabled' : ''} title="${full ? `최대 ${SLIDE_MAX}장` : '사진 파일 고르기'}">+ 사진 넣기 (${st.slides.length}/${SLIDE_MAX})</button></div>
      ${sliderRowHTML(slideAxis(st.fx) === 'y' ? '카드 높이 %' : '카드 폭 %', 'sld-cardw-slider', 'sld-cardw-number', { min: 20, max: 100, step: 1, value: st.layout.cardW })}
      ${sliderRowHTML('간격', 'sld-gap-slider', 'sld-gap-number', { min: 0, max: 80, step: 1, value: st.layout.gap })}
      ${sliderRowHTML('높이', 'sld-h-slider', 'sld-h-number', { min: 120, max: 1200, step: 10, value: st.layout.h })}
    </div>
    <div class="prop-section prop-section--anim">
      <button class="prop-anim-btn" id="open-anim-btn">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="1" y="3" width="12" height="8" rx="1.5"/>
          <path d="M5 6l3 1.5L5 9V6z" fill="currentColor" stroke="none"/>
        </svg>
        애니메이션 GIF 만들기
      </button>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);
  const commit = () => { window.pushHistory?.(); window.scheduleAutoSave?.(); };
  const reopen = () => showSlideProperties(block);
  const $ = (id) => document.getElementById(id);
  const list = () => readSlideState(block).slides;

  $('sld-add')?.addEventListener('click', () => {
    grdPickImageFile((src) => {
      if (!block.isConnected) return;
      const s = list();
      if (s.length >= SLIDE_MAX) return;
      setSlideList(block, [...s, { src }]);
      commit(); reopen();
    });
  });
  propPanel.querySelectorAll('.sld-photo-row').forEach((row) => {
    const i = +row.dataset.idx;
    const move = (d) => { const s = list(); const j = i + d; if (j < 0 || j >= s.length) return; [s[i], s[j]] = [s[j], s[i]]; setSlideList(block, s); commit(); reopen(); };
    row.querySelector('.sld-up')?.addEventListener('click', () => move(-1));
    row.querySelector('.sld-down')?.addEventListener('click', () => move(1));
    row.querySelector('.sld-del')?.addEventListener('click', () => { const s = list(); s.splice(i, 1); setSlideList(block, s); commit(); reopen(); });
  });
  for (const [id, key] of [['sld-cardw', 'cardW'], ['sld-gap', 'gap'], ['sld-h', 'h']]) {
    const sl = $(`${id}-slider`), nu = $(`${id}-number`);
    sl?.addEventListener('input', () => { nu.value = sl.value; setSlideLayout(block, { [key]: +sl.value }); });
    sl?.addEventListener('change', commit);
    nu?.addEventListener('change', () => { sl.value = nu.value; setSlideLayout(block, { [key]: +nu.value }); commit(); });
  }

  /* GIF 단추 — 텍스트 패널(prop-text.js _applyAnimGate)과 같은 판정 함수 · 같은 «왜 안 눌리나» 글 */
  const btn = $('open-anim-btn');
  const gate = () => {
    if (!btn?.isConnected) return;
    const visible = window.animGifVisible ? window.animGifVisible(window.ANIM_GIF_ENABLED, _adminState()) : false;
    btn.disabled = !visible;
    btn.onclick = visible ? () => window.openAnimModal(block) : null;
    if (visible) { btn.removeAttribute('aria-disabled'); btn.style.opacity = ''; btn.style.cursor = ''; btn.title = ''; return; }
    btn.setAttribute('aria-disabled', 'true'); btn.style.opacity = '0.4'; btn.style.cursor = 'default';
    btn.title = window.ANIM_GIF_ENABLED === true ? '어드민 계정에서만 사용할 수 있습니다' : '이번 버전에서는 사용할 수 없습니다';
  };
  gate();
  if (window.ANIM_GIF_ENABLED === true && !_adminState() && window.__admin && typeof window.__admin.refresh === 'function') {
    Promise.resolve(window.__admin.refresh()).then(gate).catch(() => {});
  }
}
window.showSlideProperties = showSlideProperties;
