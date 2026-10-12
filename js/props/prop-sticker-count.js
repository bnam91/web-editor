/* prop-sticker-count.js — 카운트 스티커(data-count 가 붙은 circle/square 스티커)의 우측 패널 절 (1012t1Z4).
 *   prop-sticker.js 가 data-count 일 때 이 절을 끼우고 Shape·Text·이미지 모드 절과 «크기» 행을 숨긴다
 *   (폰트 크기·굵기·스타일·Colors 는 그대로 남는다).
 *   행(현빈 원문 순서): 표기(1 / A) · 모양(원 / 사각 / 투명) · 시작 번호 · 크기 · [번호 다시 매기기]
 *   ★표기·시작 번호 = «묶음» 속성 — 같은 섹션의 카운트 스티커 전부에 쓴다(히스토리 1칸).
 *   ★모양·크기 = «개별» 속성 — 고른 스티커 하나. 다음 찍기는 순번이 가장 큰 스티커의 것을 물려받는다.
 *   번호 계산·묶음 쓰기는 js/count-sticker-tool.js(window.CountSticker) 한 자리에 있다 — 여기서 다시 적지 않는다.
 *   숫자칸의 범위·빈 값 처리는 칸의 min/max 를 읽는 공용 가드(prop-number-commit-guard.js)가 한다.
 */

const SIZE_MIN = 10, SIZE_MAX = 600;
const FS_MIN = 6, FS_MAX = 150;      // 코너 드래그(js/sticker-select.js)와 같은 범위
const START_MIN = 1, START_MAX = 999;

const int = (v, fallback) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : fallback; };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function shapeOf(block) {
  const s = block.dataset.countShape;
  if (s === 'square' || s === 'none' || s === 'circle') return s;
  return block.dataset.shape === 'square' ? 'square' : 'circle';
}

export function countSectionHTML(block) {
  const d = block.dataset;
  const style = d.countStyle === 'alpha' ? 'alpha' : 'num';
  const shape = shapeOf(block);
  const start = clamp(int(d.countStart, START_MIN), START_MIN, START_MAX);
  const size = clamp(int(d.sizeW, int(d.size, 56)), SIZE_MIN, SIZE_MAX);
  const on = (c) => (c ? ' active' : '');
  return `
    <div class="prop-section" id="stk-count-section">
      <div class="prop-section-title">Count</div>
      <div class="prop-row"><span class="prop-label">표기</span>
        <div class="prop-align-group" id="stk-count-style">
          <button class="prop-align-btn${on(style === 'num')}" data-count-style="num" title="숫자 (1 · 2 · 3)">1</button>
          <button class="prop-align-btn${on(style === 'alpha')}" data-count-style="alpha" title="알파벳 (A · B · C)">A</button>
        </div>
      </div>
      <div class="prop-row"><span class="prop-label">모양</span>
        <div class="prop-align-group" id="stk-count-shape">
          <button class="prop-align-btn${on(shape === 'circle')}" data-count-shape="circle" title="원형">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="5.5"/></svg>
          </button>
          <button class="prop-align-btn${on(shape === 'square')}" data-count-shape="square" title="사각">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.5" y="2.5" width="11" height="11" rx="1"/></svg>
          </button>
          <button class="prop-align-btn${on(shape === 'none')}" data-count-shape="none" title="투명 (숫자만)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 2"><circle cx="8" cy="8" r="5.5"/></svg>
          </button>
        </div>
      </div>
      <div class="prop-row"><span class="prop-label">시작 번호</span>
        <input type="number" class="prop-number" id="stk-count-start" min="${START_MIN}" max="${START_MAX}" step="1" value="${start}" title="이 섹션의 첫 번호 (알파벳 표기에서는 1 = A)">
      </div>
      <div class="prop-row"><span class="prop-label">크기</span>
        <input type="range" class="prop-slider" id="stk-count-size" min="${SIZE_MIN}" max="${SIZE_MAX}" step="1" value="${size}">
        <input type="number" class="prop-number" id="stk-count-size-num" min="${SIZE_MIN}" max="${SIZE_MAX}" value="${size}">
      </div>
      <div class="prop-row">
        <button class="prop-action-btn" id="stk-count-renumber" title="이 섹션의 번호를 지금 순서대로 1부터 다시 매긴다 (중간을 지운 뒤 빈 번호 메우기)">번호 다시 매기기</button>
      </div>
    </div>`;
}

/** @param {HTMLElement} panel  propPanel · @param {Function} rerender  renderStickerBlock + rememberStickerStyle */
export function wireCountSection(panel, block, rerender) {
  const commit = (label) => { window.pushHistory?.(label); window.scheduleAutoSave?.(); };
  const $ = (id) => panel.querySelector('#' + id);
  const CS = window.CountSticker;
  const sec = () => block.closest('.section-block');
  /* 그리기가 innerHTML 을 갈아 끼운다 — 골라진 스티커의 모서리 핸들을 다시 단다 */
  const redraw = () => { rerender(); if (block.classList.contains('selected')) window._addCornerHandles?.(block); };
  const markActive = (groupId, btn) => panel.querySelectorAll(`#${groupId} .prop-align-btn`).forEach(b => b.classList.toggle('active', b === btn));

  /* 표기 — 묶음 */
  panel.querySelectorAll('#stk-count-style [data-count-style]').forEach(btn => {
    btn.addEventListener('click', () => {
      const style = btn.dataset.countStyle === 'alpha' ? 'alpha' : 'num';
      if (!CS || (block.dataset.countStyle || 'num') === style) return;
      CS.setGroup(sec(), { style });
      markActive('stk-count-style', btn);
      commit('카운트 스티커 표기');
    });
  });

  /* 모양 — 개별. 투명(none)은 dataset.shape 를 그대로 두고 countShape 만 바꾼다(그리기가 배경을 비운다). */
  panel.querySelectorAll('#stk-count-shape [data-count-shape]').forEach(btn => {
    btn.addEventListener('click', () => {
      const shape = btn.dataset.countShape;
      if (shapeOf(block) === shape) return;
      block.dataset.countShape = shape;
      if (shape === 'circle' || shape === 'square') block.dataset.shape = shape;
      redraw(); commit('카운트 스티커 모양');
      window.showStickerProperties?.(block);   // Colors 절의 라벨(배경색 ↔ 숫자색)·글자색 행을 새 모양으로 다시 그린다
    });
  });

  /* 시작 번호 — 묶음 */
  const startEl = $('stk-count-start');
  if (startEl) {
    startEl.addEventListener('input', () => {
      const v = parseInt(startEl.value, 10);
      if (!CS || !Number.isFinite(v)) return;
      CS.setGroup(sec(), { start: clamp(v, START_MIN, START_MAX) });
    });
    startEl.addEventListener('change', () => commit('카운트 스티커 시작 번호'));
  }

  /* 크기 — 개별. 폰트는 폭 비율로 같이 키운다(코너 드래그와 같은 식 · 6~150).
     끄는 동안 반올림이 쌓이지 않게 «제스처를 시작할 때»의 크기·폰트를 기준으로 잡고, 커밋 때 푼다. */
  const sizeS = $('stk-count-size'), sizeN = $('stk-count-size-num');
  if (sizeS && sizeN) {
    let base = null;
    const applySize = (raw) => {
      const v = parseInt(raw, 10);
      if (!Number.isFinite(v)) return;
      const next = clamp(v, SIZE_MIN, SIZE_MAX);
      const d = block.dataset;
      if (!base) base = { w: int(d.sizeW, int(d.size, 56)), fs: int(d.fontSize, 26) };
      d.size = String(next); d.sizeW = String(next); d.sizeH = String(next);
      const ratio = base.w > 0 ? next / base.w : 1;
      d.fontSize = String(clamp(Math.round(base.fs * ratio), FS_MIN, FS_MAX));
      sizeS.value = String(next); sizeN.value = String(next);
      const fsS = $('stk-fs'), fsN = $('stk-fs-num');
      if (fsS) fsS.value = d.fontSize;
      if (fsN) fsN.value = d.fontSize;
      redraw();
      block.classList.toggle('tiny', next < 40);
    };
    const done = () => { base = null; commit('카운트 스티커 크기'); };
    sizeS.addEventListener('input', () => applySize(sizeS.value));
    sizeN.addEventListener('input', () => applySize(sizeN.value));
    sizeS.addEventListener('change', done);
    sizeN.addEventListener('change', done);
  }

  /* 번호 다시 매기기 — 묶음 */
  $('stk-count-renumber')?.addEventListener('click', () => {
    if (!CS) return;
    CS.renumber(sec());
    commit('카운트 스티커 번호 다시 매기기');
  });
}
