/* prop-slide.js — 슬라이드 블럭 우측 패널(내용만 · 현빈 결정 261116: 움직임은 «GIF 버튼 → GIF 패널») · 0.9.13 MOTION-SLIDE-BLOCK-01
 *   dev 관례 그대로(prop-cert.js 와 같은 꼴): prop-section · sliderRowHTML · .prop-btn · .prop-row · prop-anim-btn(텍스트 패널 GIF 단추와 같은 절) — 새 CSS 0
 *   사진: 넣기 = grdPickImageFile(prop-grid.js — 자산 URL 길) · 순서 ↑↓ · 빼기 ✕ · 최대 SLIDE_MAX
 *   GIF 단추 노출 = animGifVisible(feature-flags.js 한 자리 — 텍스트 패널과 같은 판정 · 관리자). 이력 = 고친 «뒤» pushHistory(js/CLAUDE.md 규약).
 *   ⛔그림 주소는 escHtml 로 속성에(남이 준 프로젝트에서 올 수 있다).
 */
import { propPanel } from '../globals.js';
import { blockHeaderHTML, sliderRowHTML, escHtml, animGifBtnHTML, wireAnimGifBtn } from './_helpers.js';
import { renderPanel, sec } from './_panel-frame.js';
import { colorFieldHTML, wireColorField } from './color-picker.js';
import { grdPickImageFile } from './prop-grid.js';
import { syncFrameBgVars } from '../frame-bg.js';
import { readSlideState, setSlideList, setSlideLayout, isFrameSlide, slideCells, addSlideCell, renderSlideBlock, convertSlideToFrames, setSlideScrollFix } from '../blocks/slide-block.js';
import { SLIDE_MAX, slideAxis } from '../fx/slide-motion.js';

const _ICON = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3"><rect x="1" y="3" width="6" height="6" rx="0.5"/><path d="M8.5 3.5v5M10.5 4.5v3"/></svg>`;

/* SLIDE-CELL-AS-FRAME-01 — 프레임 모드 Content 절 = 칸 줄(칸 N · 폭 % · ↑ ↓ ✕) + «프레임 추가하기» · 고른 칸이면 «사진 넣기(칸 N)».
   opts.cell = 캔버스에서 고른 칸(block-drag _pickSlideCell) — 그 줄을 표시하고 _activeFrame 은 그 칸 그대로(넣기 길이 그 칸으로 간다). */
/* SLIDE-CELL-FRAME-BG-01 — 칸 배경 = 프레임 배경 키 그대로(data-bg · 인라인 background-color) ⇒ 캔버스·PNG·HTML(DOM)·Figma(프레임 bg · 'transparent' = 칠 없음)·GIF(칸 찍기) 같은 길. 끔 = 'transparent'. */
const _cellBg = (c) => c.dataset.bg || c.style.backgroundColor || '#ffffff';
const _cellBgOn = (c) => !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(_cellBg(c));
function _setCellBg(c, v) { c.style.backgroundImage = ''; c.style.backgroundColor = v; c.dataset.bg = v; syncFrameBgVars(c); }
function _cellRowsHTML(block, st, selCell) {
  const cells = slideCells(block), n = cells.length;
  const rows = cells.map((c, i) => `<div class="prop-row prop-row--wide sld-cell-row${c === selCell ? ' active' : ''}" data-idx="${i}">
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
      ${k >= 0 ? _cellPartsHTML(selCell, k, st) : ''}`;
}
/* SLIDE-CELL-PANEL-PARITY-01(135)→02(142) — 고른 칸 부품(대조표 handoff/TABLE-slide-cell-vs-frame-panel-261119.md) · 142 부터 코너·배경색·투명도는 칸의 프레임 패널 몫. */
function _cellPartsHTML(c, k, st) {
  /* 142(ⓐ) — 코너·배경색·투명도·이미지·테두리·정렬·간격·패딩은 «칸의 프레임 패널»이 일반 프레임 부품 그대로 맡는다 ⇒ 여기는 칸만의 넷: 폭%·높이%(트랙 몫) · 배경 켜기(102 원문) · 슬라이드로 */
  const vert = slideAxis(st.fx) === 'y';
  return `${sliderRowHTML(vert ? '높이 %' : '폭 %', 'sld-cell-w-slider', 'sld-cell-w-number', { min: 20, max: 100, step: 1, value: c.dataset.w ?? st.layout.cardW })}${vert ? '' : `
      ${sliderRowHTML('높이 %', 'sld-cell-h-slider', 'sld-cell-h-number', { min: 20, max: 100, step: 1, value: c.dataset.h ?? 100 })}`}
      <div class="prop-row"><span class="prop-label">배경</span><label class="prop-toggle"><input type="checkbox" id="sld-cell-bg-on" ${_cellBgOn(c) ? 'checked' : ''} aria-label="칸 ${k + 1} 배경"><span class="prop-toggle-track"></span></label></div>
      <div class="prop-row"><button class="prop-btn" id="sld-cell-back" style="width:100%">슬라이드 전체 설정</button></div>`;
}
/* 그림자 = Effects 절(일반 프레임과 같은 절 이름) · 저장 키 dataset.shadow 그대로(GIF deco·103 기본값이 읽는다) */
function _cellShadowHTML(c) {
  return `<div class="prop-row"><span class="prop-label">그림자</span><select class="prop-select" id="sld-cell-shadow">
        ${[['', '없음'], ['soft', '옅게'], ['strong', '짙게']].map(([v, t]) => `<option value="${v}"${(c.dataset.shadow || '') === v ? ' selected' : ''}>${t}</option>`).join('')}
      </select></div>`;
}

/** 칸 줄 + 고른 칸 부품 배선 — 슬라이드 패널(고른 칸 없음)과 «칸의 프레임 패널» 슬라이드 칸 절(142 · 고른 칸) 둘 다 이 한 벌. */
function _wireCellSection(block, st, selCell) {
  const commit = () => { window.pushHistory?.(); window.scheduleAutoSave?.(); };
  const reopen = (cell = selCell) => showSlideProperties(block, { cell });
  const $ = (id) => document.getElementById(id);
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
      window.showFrameHandles?.(c);   // 캔버스 칸 클릭과 같은 상태(코너 반경 손잡이 · 136)
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
  /* 135 — 고른 칸 슬라이더 줄(같은 키 · 숫자칸 change = 옛 길 그대로) */
  const cellNum = (v, lo, hi, dflt) => Math.max(lo, Math.min(hi, Math.round(+v || dflt)));
  const setCellW = (v) => { const c = selCell; if (!c) return; c.dataset.w = String(cellNum(v, 20, 100, st.layout.cardW)); renderSlideBlock(block); };
  const setCellH = (v) => { const c = selCell; if (!c) return; const h = cellNum(v, 20, 100, 100); if (h === 100) delete c.dataset.h; else c.dataset.h = String(h); renderSlideBlock(block); };
  for (const [sid, nid, fn] of [['sld-cell-w-slider', 'sld-cell-w-number', setCellW], ['sld-cell-h-slider', 'sld-cell-h-number', setCellH]]) {
    const sl = $(sid), nu = $(nid);
    sl?.addEventListener('input', () => { if (nu) nu.value = sl.value; fn(sl.value); });
    sl?.addEventListener('change', commit);
    nu?.addEventListener('change', () => { if (sl) sl.value = nu.value; fn(nu.value); commit(); });
  }
  $('sld-cell-bg-on')?.addEventListener('change', (e) => { const c = selCell; if (!c) return; _setCellBg(c, e.target.checked ? '#ffffff' : 'transparent'); commit(); reopen(); });
  $('sld-cell-shadow')?.addEventListener('change', (e) => { const c = selCell; if (!c) return; if (e.target.value) c.dataset.shadow = e.target.value; else delete c.dataset.shadow; renderSlideBlock(block); commit(); });
  $('sld-cell-back')?.addEventListener('click', () => { window.deselectAll?.(); window.selectBlock?.(block.id); showSlideProperties(block); });   // 142 칸 패널 → 슬라이드 전체 설정
}

export function showSlideProperties(block, opts = {}) {
  if (!block) return;
  const st = readSlideState(block);
  const frame = isFrameSlide(block);
  const selCell = frame && opts.cell && slideCells(block).includes(opts.cell) ? opts.cell : null;
  /* 142 SLIDE-CELL-PANEL-PARITY-02(ⓐ · 지디 261119) — 고른 칸 = «그 칸의 프레임 패널»(prop-frame 부품·배선 그대로) + 맨 위 «슬라이드 칸» 절(slideCellPanelParts) */
  if (selCell) { window.showFrameProperties?.(selCell); return; }
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
      ${_dotsRowsHTML(st.layout)}
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
  if (frame) _wireCellSection(block, st, selCell);
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
  /* SLIDE-PROGRESS-BAR-01 — 표시 모양(없음 = 위치 none · 점/진행바 = 지금 위치 그대로 · 처음 켜면 아래) · 엔드슬롯 = 위↔아래 · 모양 바뀌면 아래 줄 다시 그림 */
  $('sld-dots-kind')?.addEventListener('change', (e) => { const v = e.target.value, L0 = readSlideState(block).layout; setSlideLayout(block, v === 'none' ? { dots: 'none' } : { dots: L0.dots === 'none' ? 'bottom' : L0.dots, dotShape: v }); commit(); reopen(); });
  $('sld-dots-pos')?.addEventListener('click', () => { const L0 = readSlideState(block).layout; setSlideLayout(block, { dots: L0.dots === 'top' ? 'bottom' : 'top' }); commit(); reopen(); });
  /* SLIDE-DOTS-SPACING-01 — 칸↔점 갭 · 점↔점 간격 · 켜진/꺼진 점 색(첫 장면·GIF 같은 값) */
  for (const [id, key] of [['sld-dotgap', 'dotGap'], ['sld-dotspace', 'dotSpace'], ['sld-bargap', 'dotGap'], ['sld-barh', 'barThick']]) {
    const sl = $(`${id}-slider`), nu = $(`${id}-number`);
    sl?.addEventListener('input', () => { nu.value = sl.value; setSlideLayout(block, { [key]: +sl.value }); });
    sl?.addEventListener('change', commit);
    nu?.addEventListener('change', () => { sl.value = nu.value; setSlideLayout(block, { [key]: +nu.value }); commit(); });
  }
  for (const [pre, key] of [['sld-don', 'dotOn'], ['sld-doff', 'dotOff'], ['sld-bon', 'dotOn'], ['sld-boff', 'dotOff']]) {
    wireColorField(pre, { onApply: (c) => { setSlideLayout(block, { [key]: String(c) }); }, onCommit: commit });   // 소독은 normLayout(#rrggbb[aa] 만 · 그 밖은 기본색)
  }

  wireAnimGifBtn(document.getElementById('open-anim-btn'), block);   // 텍스트 패널(prop-text.js _applyAnimGate)과 같은 판정·글 — _helpers.js 한 벌(슬라이드·그리드 공용)
}
window.showSlideProperties = showSlideProperties;
/* SLIDE-PROGRESS-BAR-01(0.9.13 195 · 현빈 261123 D 확정 · 정본 시안 8910 sbarend/sbarendbar · 탑 f2236dd·e1df443) — 한 줄 [점 표시 | 표시 모양 ▾(없음·점·진행바) | 엔드슬롯 위↔아래]
   · 위치(dots top/bottom)는 엔드슬롯 단추(.prop-chain-btn = 끝 칼럼 규칙 · 새 CSS 0) · «없음» = 표시 모양 맨 앞(현빈 답 대기 · 추천안대로 — 바뀌면 이 줄)
   · 아래 줄: 점 = 칸↔점 갭 · 점 간격 · 켜진/꺼진 점 / 진행바 = 칸↔바 갭 · 바 두께 · 채운/빈 색(갭·색 = 점과 같은 키 — 모양을 바꿔도 유지) */
const _SB_UP = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2 1.5h8M6 10.5V4.5M3.5 7L6 4.5 8.5 7"/></svg>';
const _SB_DN = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10.5h8M6 1.5v6M3.5 5L6 7.5 8.5 5"/></svg>';
function _dotsRowsHTML(L) {
  const kind = L.dots === 'none' ? 'none' : L.dotShape, top = L.dots === 'top';
  const posT = `점 표시 위치: ${top ? '위' : '아래'} — 누르면 ${top ? '아래' : '위'}`;
  const head = `
      <div class="prop-row"><span class="prop-label">점 표시</span><select class="prop-select" id="sld-dots-kind" aria-label="표시 모양" title="표시 모양 — 없음 · 점 · 진행바" style="flex:1 1 0;min-width:0">
        ${[['none', '없음'], ['dots', '점'], ['bar', '진행바']].map(([v, t]) => `<option value="${v}"${kind === v ? ' selected' : ''}>${t}</option>`).join('')}
      </select>${kind === 'none' ? '' : `<button type="button" class="prop-chain-btn" id="sld-dots-pos" data-pos="${top ? 'top' : 'bottom'}" aria-label="${posT}" title="${posT}">${top ? _SB_UP : _SB_DN}</button>`}</div>`;
  if (kind === 'none') return head;
  if (kind === 'bar') return head + `
      ${sliderRowHTML('칸↔바 갭', 'sld-bargap-slider', 'sld-bargap-number', { min: 0, max: 40, step: 1, value: L.dotGap })}
      ${sliderRowHTML('바 두께', 'sld-barh-slider', 'sld-barh-number', { min: 1, max: 12, step: 1, value: L.barThick })}
      <div class="prop-row"><span class="prop-label">채운 색</span>${colorFieldHTML({ idPrefix: 'sld-bon', hex: L.dotOn })}</div>
      <div class="prop-row"><span class="prop-label">빈 색</span>${colorFieldHTML({ idPrefix: 'sld-boff', hex: L.dotOff })}</div>`;
  return head + `
      ${sliderRowHTML('칸↔점 갭', 'sld-dotgap-slider', 'sld-dotgap-number', { min: 0, max: 40, step: 1, value: L.dotGap })}
      ${sliderRowHTML('점 간격', 'sld-dotspace-slider', 'sld-dotspace-number', { min: 2, max: 40, step: 1, value: L.dotSpace })}
      <div class="prop-row"><span class="prop-label">켜진 점</span>${colorFieldHTML({ idPrefix: 'sld-don', hex: L.dotOn })}</div>
      <div class="prop-row"><span class="prop-label">꺼진 점</span>${colorFieldHTML({ idPrefix: 'sld-doff', hex: L.dotOff })}</div>`;
}

/** 142 — 칸의 프레임 패널(prop-frame)이 부르는 «슬라이드 칸» 조각: content = 칸 줄 + 고른 칸 넷 · effects = 그림자 3단(Q4) · wire = 배선 한 벌 */
export function slideCellPanelParts(cell) {
  const block = cell?.closest?.('.slide-block');
  if (!block || !isFrameSlide(block) || !slideCells(block).includes(cell)) return null;
  const st = readSlideState(block);
  return { content: _cellRowsHTML(block, st, cell), effects: _cellShadowHTML(cell), wire: () => _wireCellSection(block, st, cell) };
}
window.slideCellPanelParts = slideCellPanelParts;
