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
import { readSlideState, setSlideList, setSlideLayout, isFrameSlide, slideCells, addSlideCell, renderSlideBlock, convertSlideToFrames, setSlideScrollFix } from '../blocks/slide-block.js';
import { SLIDE_MAX, slideAxis } from '../fx/slide-motion.js';

const _ICON = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3"><rect x="1" y="3" width="6" height="6" rx="0.5"/><path d="M8.5 3.5v5M10.5 4.5v3"/></svg>`;

/* SLIDE-CELL-AS-FRAME-01 — 프레임 모드 Content 절 = 칸 줄(칸 N · 폭 % · ↑ ↓ ✕) + «프레임 추가하기» · 고른 칸이면 «사진 넣기(칸 N)».
   opts.cell = 캔버스에서 고른 칸(block-drag _pickSlideCell) — 그 줄을 표시하고 _activeFrame 은 그 칸 그대로(넣기 길이 그 칸으로 간다). */
function _cellRowsHTML(block, st, selCell) {
  const cells = slideCells(block), n = cells.length;
  const rows = cells.map((c, i) => `<div class="prop-row sld-cell-row${c === selCell ? ' active' : ''}" data-idx="${i}">
        <span class="prop-label">칸 ${i + 1}</span>
        <input type="number" class="prop-number sld-cw" min="20" max="100" step="1" value="${c.dataset.w ?? st.layout.cardW}" aria-label="칸 ${i + 1} ${slideAxis(st.fx) === 'y' ? '높이' : '폭'} %">${slideAxis(st.fx) === 'y' ? '' : `
        <input type="number" class="prop-number sld-ch" min="20" max="100" step="1" value="${c.dataset.h ?? 100}" aria-label="칸 ${i + 1} 높이 %">`}
        <button class="prop-btn sld-cell-up" title="앞으로"${i === 0 ? ' disabled' : ''}>↑</button>
        <button class="prop-btn sld-cell-down" title="뒤로"${i === n - 1 ? ' disabled' : ''}>↓</button>
        <button class="prop-btn sld-cell-del" title="칸 빼기"${n <= 1 ? ' disabled' : ''}>✕</button>
      </div>`).join('');
  const k = selCell ? cells.indexOf(selCell) : -1;
  return `${rows}
      <div class="prop-row"><button class="prop-btn" id="sld-add-cell" style="width:100%"${n >= SLIDE_MAX ? ' disabled' : ''}>+ 프레임 추가하기 (${n}/${SLIDE_MAX})</button></div>
      ${k >= 0 ? `<div class="prop-row"><button class="prop-btn" id="sld-cell-photo" style="width:100%">사진 넣기 (칸 ${k + 1})</button></div>
      <div class="prop-row"><span class="prop-label">모서리</span><input type="number" class="prop-number" id="sld-cell-radius" min="0" max="80" step="1" value="${selCell.dataset.radius || 0}" aria-label="칸 ${k + 1} 모서리 px"></div>
      <div class="prop-row"><span class="prop-label">그림자</span><select class="prop-select" id="sld-cell-shadow">
        ${[['', '없음'], ['soft', '옅게'], ['strong', '짙게']].map(([v, t]) => `<option value="${v}"${(selCell.dataset.shadow || '') === v ? ' selected' : ''}>${t}</option>`).join('')}
      </select></div>` : ''}`;
}

export function showSlideProperties(block, opts = {}) {
  if (!block) return;
  const st = readSlideState(block);
  const frame = isFrameSlide(block);
  const selCell = frame && opts.cell && slideCells(block).includes(opts.cell) ? opts.cell : null;
  const full = st.slides.length >= SLIDE_MAX;
  // 패딩 제외 — 섹션에 좌우 패딩이 있거나 이미 켜져 있을 때만(prop-cert canFB · 월계수 _lrlCanFB 와 같은 조건)
  const canFB = block.dataset.fullBleed === 'true' || (window.effectiveSectionPadX?.(block) || 0) > 0;
  const photoRows = st.slides.map((s, i) => `<div class="prop-row sld-photo-row" data-idx="${i}">
        <span class="prop-label">사진 ${i + 1}</span>
        <img class="sld-thumb" src="${escHtml(s.src)}" alt="">
        <input type="number" class="prop-number sld-w" min="20" max="100" step="1" value="${s.w ?? st.layout.cardW}" aria-label="사진 ${i + 1} ${slideAxis(st.fx) === 'y' ? '높이' : '폭'} %">
        <button class="prop-btn sld-up" title="앞으로"${i === 0 ? ' disabled' : ''}>↑</button>
        <button class="prop-btn sld-down" title="뒤로"${i === st.slides.length - 1 ? ' disabled' : ''}>↓</button>
        <button class="prop-btn sld-del" title="빼기">✕</button>
      </div>`).join('');
  /* ★우측패널 틀(_panel-frame) — cand3 panel-section-gate(prop-cert.js ⓐ 선례 · id·배선 무변): 옛 「Slides」 한 절을 소유대로 갈랐다.
       Content = 사진 줄·넣기 · Size = 카드 폭/높이 %·높이 · Layout = 간격 · Export = GIF 단추(텍스트 패널 txt-anim-section 과 같은 절). */
  renderPanel(block, {
    header: blockHeaderHTML({ icon: _ICON, name: block.dataset.layerName, defaultName: 'Slides', crumb: window.getBlockBreadcrumb ? window.getBlockBreadcrumb(block) : '', id: block.id }),
    sections: [
      sec('content', frame ? _cellRowsHTML(block, st, selCell) : `
      ${photoRows || '<div class="prop-row"><span class="prop-label">사진 없음</span></div>'}
      <div class="prop-row"><button class="prop-btn" id="sld-add" style="width:100%"${full ? ' disabled' : ''} title="${full ? `최대 ${SLIDE_MAX}장` : '사진 파일 고르기'}">+ 사진 넣기 (${st.slides.length}/${SLIDE_MAX})</button></div>
      <div class="prop-row"><button class="prop-btn" id="sld-to-frame" style="width:100%">프레임으로 바꾸기</button></div>
      `),
      sec('size', `
      ${sliderRowHTML(slideAxis(st.fx) === 'y' ? '카드 높이 %' : '카드 폭 %', 'sld-cardw-slider', 'sld-cardw-number', { min: 20, max: 100, step: 1, value: st.layout.cardW })}
      ${sliderRowHTML('높이', 'sld-h-slider', 'sld-h-number', { min: 120, max: 1200, step: 10, value: st.layout.h })}`),
      sec('layout', `
      <div class="prop-row"><span class="prop-label">레이아웃</span><select class="prop-select" id="sld-mode">
        ${[['row', '기본'], ['center', '가운데 캐러셀'], ['single', '단일 컷']].map(([v, t]) => `<option value="${v}"${st.layout.mode === v ? ' selected' : ''}>${t}</option>`).join('')}
      </select></div>
      ${sliderRowHTML('간격', 'sld-gap-slider', 'sld-gap-number', { min: -80, max: 80, step: 1, value: st.layout.gap })}${slideAxis(st.fx) === 'y' ? '' : `
      <div class="prop-row"><span class="prop-label">점 표시</span><select class="prop-select" id="sld-dots">
        ${[['none', '없음'], ['top', '위'], ['bottom', '아래']].map(([v, t]) => `<option value="${v}"${st.layout.dots === v ? ' selected' : ''}>${t}</option>`).join('')}
      </select></div>
      <div class="prop-row"><span class="prop-label">스크롤 고정</span><label class="prop-toggle"><input type="checkbox" id="sld-scroll-fix" ${block.dataset.scrollX ? 'checked' : ''}><span class="prop-toggle-track"></span></label></div>`}`),
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
  window.kickSlidePlus?.();   // 캔버스 ＋ 깨우기(패널이 열림 = 슬라이드·칸이 골라짐)
  const commit = () => { window.pushHistory?.(); window.scheduleAutoSave?.(); };
  const reopen = (cell = selCell) => showSlideProperties(block, { cell });
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
    /* SLIDE-CELL-SIZE-EACH-01 — 이 칸만 폭 %(slides[i].w · 소독 normCardW 20~100) · 공통 «카드 폭 %»는 칸별 값 없는 칸만 */
    row.querySelector('.sld-w')?.addEventListener('change', (e) => { const s = list(); if (!s[i]) return; s[i] = { ...s[i], w: +e.target.value }; setSlideList(block, s); commit(); reopen(); });
  });
  /* 옛 사진 모드 → 프레임 모드(누를 때만 · Q1) — 사진마다 칸 안 에셋 · 이력 한 칸(⌘Z = 사진 모드) */
  $('sld-to-frame')?.addEventListener('click', () => { if (convertSlideToFrames(block)) { commit(); reopen(null); } });
  /* 프레임 모드 칸 줄 — 순서·빼기 = 칸 요소째 옮김/뺌(자식 통째 · ⌘Z 가 DOM 표본으로 되돌림) · 폭 = 칸 data-w(%) */
  if (frame) {
    const track = block.querySelector(':scope > .sld-track');
    const cellAt = (i) => slideCells(block)[i];
    $('sld-add-cell')?.addEventListener('click', () => { const c = addSlideCell(block); if (!c) return; commit(); reopen(selCell); });
    propPanel.querySelectorAll('.sld-cell-row').forEach((row) => {
      const i = +row.dataset.idx;
      /* SLIDE-OFFSCREEN-CELL-EDIT-01 — 칸 줄 이름 누름 = 그 칸 고름(캔버스 칸 클릭과 같은 상태: selected · _activeFrame) + 캔버스를 그 칸으로 스크롤(펼침 CSS 가 트랙 밖 칸도 보이게 한다 · «패널은 거들 뿐») */
      row.querySelector('.prop-label')?.addEventListener('click', () => {
        const c = cellAt(i); if (!c) return;
        window.unfoldSlide?.(block, true);   // 패널로 칸 고름 = 펼침(트랙 밖 칸도 보이고 만지게)
        window.deselectAll?.();
        c.closest('.section-block')?.classList.add('selected');
        c.classList.add('selected');
        window._activeFrame = c;
        c.scrollIntoView({ block: 'nearest', inline: 'center' });
        showSlideProperties(block, { cell: c });
      });
      row.querySelector('.sld-cell-up')?.addEventListener('click', () => { const c = cellAt(i), p = cellAt(i - 1); if (!c || !p) return; track.insertBefore(c, p); renderSlideBlock(block); commit(); reopen(); });
      row.querySelector('.sld-cell-down')?.addEventListener('click', () => { const c = cellAt(i), nx = cellAt(i + 1); if (!c || !nx) return; track.insertBefore(nx, c); renderSlideBlock(block); commit(); reopen(); });
      row.querySelector('.sld-cell-del')?.addEventListener('click', () => {
        const c = cellAt(i); if (!c || slideCells(block).length <= 1) return;
        if (window._activeFrame === c || c.contains(window._activeFrame)) window._activeFrame = null;
        c.remove(); renderSlideBlock(block); commit(); reopen(selCell === c ? null : selCell);
      });
      /* SLIDE-CELL-HEIGHT-EACH-01 — 이 칸만 높이 %(트랙 가운데 · 100 = 키 지움) */
      row.querySelector('.sld-ch')?.addEventListener('change', (e) => { const c = cellAt(i); if (!c) return; const v = Math.max(20, Math.min(100, Math.round(+e.target.value || 100))); if (v === 100) delete c.dataset.h; else c.dataset.h = String(v); renderSlideBlock(block); commit(); reopen(); });
      row.querySelector('.sld-cw')?.addEventListener('change', (e) => { const c = cellAt(i); if (!c) return; c.dataset.w = String(Math.max(20, Math.min(100, Math.round(+e.target.value || st.layout.cardW)))); renderSlideBlock(block); commit(); reopen(); });
    });
    /* SLIDE-CELL-FRAME-HANDLES-RADIUS-SHADOW-01 — 고른 칸 모서리(px)·그림자(이펙트) · 0/없음 = 키 지움 */
    $('sld-cell-radius')?.addEventListener('change', (e) => { const c = selCell; if (!c) return; const v = Math.max(0, Math.min(80, Math.round(+e.target.value || 0))); if (v) c.dataset.radius = String(v); else delete c.dataset.radius; renderSlideBlock(block); commit(); });
    $('sld-cell-shadow')?.addEventListener('change', (e) => { const c = selCell; if (!c) return; if (e.target.value) c.dataset.shadow = e.target.value; else delete c.dataset.shadow; renderSlideBlock(block); commit(); });
    /* 칸 «사진 넣기» = 그 칸에 들어가(_activeFrame) 진짜 addAssetBlock → 칸 꽉(왼위 0 · 폭·높이 100% · cover) — 넣기 길은 _insertToFlowFrame 그대로 */
    $('sld-cell-photo')?.addEventListener('click', () => {
      const cell = selCell;
      grdPickImageFile((src) => {
        if (!cell?.isConnected) return;
        window._activeFrame = cell;
        const had = new Set(cell.querySelectorAll('.asset-block'));
        window.addAssetBlock?.(null, { imgSrc: src });
        const ab = [...cell.querySelectorAll('.asset-block')].find((b) => !had.has(b));
        if (ab) {
          Object.assign(ab.style, { left: '0px', top: '0px', width: '100%', height: '100%' });
          ab.dataset.offsetX = '0'; ab.dataset.offsetY = '0'; ab.dataset.fit = 'cover'; ab.dataset.usePadx = 'false';
          const tip = window.getHistoryTip?.(); if (tip) window.restampHistoryTop?.(tip.seq);   // 같은 틱 고침을 넣기 한 칸에(⌘Z 한 번 = 넣기 전)
        }
        window.scheduleAutoSave?.();
      });
    });
  }
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

  /* SLIDE-LAYOUT-STATIC-MODES-01 — 정지 꼴(캔버스·PNG 그대로 · GIF 효과와 별개) */
  $('sld-mode')?.addEventListener('change', (e) => { setSlideLayout(block, { mode: e.target.value }); commit(); });
  /* SLIDE-TEMP-HSCROLL-FIX-EXPORT-01 — 켜면 캔버스 임시 가로 자리(막대)를 data-scroll-x 로 굳혀 내보내기가 그 자리 · 끄면 키 지움(흔적 0) */
  $('sld-scroll-fix')?.addEventListener('change', (e) => { setSlideScrollFix(block, e.target.checked); commit(); });
  /* SLIDE-INDICATOR-DOTS-01 — 점 표시(가로 효과만 · 세로면 줄 없음) */
  $('sld-dots')?.addEventListener('change', (e) => { setSlideLayout(block, { dots: e.target.value }); commit(); });

  wireAnimGifBtn(document.getElementById('open-anim-btn'), block);   // 텍스트 패널(prop-text.js _applyAnimGate)과 같은 판정·글 — _helpers.js 한 벌(슬라이드·그리드 공용)
}
window.showSlideProperties = showSlideProperties;
