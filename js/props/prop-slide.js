/* prop-slide.js — 슬라이드 블럭 우측 패널(내용만 · 현빈 결정 261116: 움직임은 «GIF 버튼 → GIF 패널») · 0.9.13 MOTION-SLIDE-BLOCK-01
 *   dev 관례 그대로(prop-cert.js 와 같은 꼴): prop-section · sliderRowHTML · .prop-btn · .prop-row · prop-anim-btn(텍스트 패널 GIF 단추와 같은 절) — 새 CSS 0
 *   사진: 넣기 = grdPickImageFile(prop-grid.js — 자산 URL 길) · 순서 ↑↓ · 빼기 ✕ · 최대 SLIDE_MAX
 *   GIF 단추 노출 = animGifVisible(feature-flags.js 한 자리 — 텍스트 패널과 같은 판정 · 관리자). 이력 = 고친 «뒤» pushHistory(js/CLAUDE.md 규약).
 *   ⛔그림 주소는 escHtml 로 속성에(남이 준 프로젝트에서 올 수 있다).
 */
import { propPanel } from '../globals.js';
import { blockHeaderHTML, sliderRowHTML, escHtml, animGifBtnHTML, wireAnimGifBtn } from './_helpers.js';
import { renderPanel, sec } from './_panel-frame.js';
import { grdPickImageFile } from './prop-grid.js';
import { readSlideState, setSlideList, setSlideLayout } from '../blocks/slide-block.js';
import { SLIDE_MAX, slideAxis } from '../fx/slide-motion.js';

const _ICON = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3"><rect x="1" y="3" width="6" height="6" rx="0.5"/><path d="M8.5 3.5v5M10.5 4.5v3"/></svg>`;

export function showSlideProperties(block) {
  if (!block) return;
  const st = readSlideState(block);
  const full = st.slides.length >= SLIDE_MAX;
  // 패딩 제외 — 섹션에 좌우 패딩이 있거나 이미 켜져 있을 때만(prop-cert canFB · 월계수 _lrlCanFB 와 같은 조건)
  const canFB = block.dataset.fullBleed === 'true' || (window.effectiveSectionPadX?.(block) || 0) > 0;
  const photoRows = st.slides.map((s, i) => `<div class="prop-row sld-photo-row" data-idx="${i}">
        <span class="prop-label">사진 ${i + 1}</span>
        <img class="sld-thumb" src="${escHtml(s.src)}" alt="">
        <button class="prop-btn sld-up" title="앞으로"${i === 0 ? ' disabled' : ''}>↑</button>
        <button class="prop-btn sld-down" title="뒤로"${i === st.slides.length - 1 ? ' disabled' : ''}>↓</button>
        <button class="prop-btn sld-del" title="빼기">✕</button>
      </div>`).join('');
  /* ★우측패널 틀(_panel-frame) — cand3 panel-section-gate(prop-cert.js ⓐ 선례 · id·배선 무변): 옛 「Slides」 한 절을 소유대로 갈랐다.
       Content = 사진 줄·넣기 · Size = 카드 폭/높이 %·높이 · Layout = 간격 · Export = GIF 단추(텍스트 패널 txt-anim-section 과 같은 절). */
  renderPanel(block, {
    header: blockHeaderHTML({ icon: _ICON, name: block.dataset.layerName, defaultName: 'Slides', crumb: window.getBlockBreadcrumb ? window.getBlockBreadcrumb(block) : '', id: block.id }),
    sections: [
      sec('content', `
      ${photoRows || '<div class="prop-row"><span class="prop-label">사진 없음</span></div>'}
      <div class="prop-row"><button class="prop-btn" id="sld-add" style="width:100%"${full ? ' disabled' : ''} title="${full ? `최대 ${SLIDE_MAX}장` : '사진 파일 고르기'}">+ 사진 넣기 (${st.slides.length}/${SLIDE_MAX})</button></div>
      `),
      sec('size', `
      ${sliderRowHTML(slideAxis(st.fx) === 'y' ? '카드 높이 %' : '카드 폭 %', 'sld-cardw-slider', 'sld-cardw-number', { min: 20, max: 100, step: 1, value: st.layout.cardW })}
      ${sliderRowHTML('높이', 'sld-h-slider', 'sld-h-number', { min: 120, max: 1200, step: 10, value: st.layout.h })}`),
      sec('layout', `
      ${sliderRowHTML('간격', 'sld-gap-slider', 'sld-gap-number', { min: 0, max: 80, step: 1, value: st.layout.gap })}`),
      /* SLIDE-PADDING-EXCLUDE-01 — 에셋·인증서 «패딩 제외»와 같은 줄(prop-row + prop-toggle) */
      sec('padding', canFB ? `
      <div class="prop-row">
        <span class="prop-label">패딩 제외</span>
        <label class="prop-toggle"><input type="checkbox" id="sld-fullbleed" ${block.dataset.fullBleed === 'true' ? 'checked' : ''}><span class="prop-toggle-track"></span></label>
      </div>` : ''),
      sec('export', animGifBtnHTML(), { id: 'sld-anim-section' }),
    ],
  });

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

  /* 패딩 제외 — 켜기는 renderSlideBlock 의 applyBlockFullBleed 가 매 렌더 씌운다 · 끄기는 흔적 지우기 먼저(인증서·월계수와 같은 순서) */
  $('sld-fullbleed')?.addEventListener('change', (e) => {
    if (e.target.checked) block.dataset.fullBleed = 'true';
    else { delete block.dataset.fullBleed; window.clearBlockFullBleed?.(block); }
    window.renderSlideBlock(block); commit();
  });

  wireAnimGifBtn(document.getElementById('open-anim-btn'), block);   // 텍스트 패널(prop-text.js _applyAnimGate)과 같은 판정·글 — _helpers.js 한 벌(슬라이드·그리드 공용)
}
window.showSlideProperties = showSlideProperties;
