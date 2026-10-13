/* prop-sticker-count.js — 카운트 스티커(data-count 가 붙은 circle/square 스티커)의 우측 패널 절 (1012t1Z4).
 *   ★사용자 표기 = Marking(마킹 블럭) · 1013t2B1 — 저장 키(data-count*)·id(stk-count-*)·파일명은 count 그대로다.
 *   prop-sticker.js 가 data-count 일 때 이 절을 끼우고 Shape·Text·이미지 모드 절과 «크기» 행을 숨긴다
 *   (폰트 크기·굵기·스타일·Colors 는 그대로 남는다).
 *   행(현빈 원문 순서): 표기(1 / A) · 모양(원 / 사각 / 투명) · 시작 번호 · 크기 · [번호 다시 매기기]
 *   ★표기·시작 번호 = «묶음» 속성 — 같은 섹션의 카운트 스티커 전부에 쓴다(히스토리 1칸). 스위치와 무관하게 항상.
 *   ★모양·크기·폰트 크기·굵기·스타일·배경색·글자색 = 「섹션 전체」 스위치(1013t2B3 · 기본 켬)를 따른다.
 *     켬 = 같은 섹션의 마킹 전부 · 끔 = 고른 것 하나. 스위치는 UI 선호다 — 모듈 변수(세션 동안) · 저장본에 안 쓴다.
 *     캔버스 코너 드래그는 스위치와 무관하게 잡은 것 하나다. 다음 찍기는 순번이 가장 큰 스티커의 것을 물려받는다.
 *   번호 계산·묶음 쓰기는 js/count-sticker-tool.js(window.CountSticker) 한 자리에 있다 — 여기서 다시 적지 않는다.
 *   숫자칸의 범위·빈 값 처리는 칸의 min/max 를 읽는 공용 가드(prop-number-commit-guard.js)가 한다.
 */

const SIZE_MIN = 10, SIZE_MAX = 600;
const FS_MIN = 6, FS_MAX = 150;      // 코너 드래그(js/sticker-select.js)와 같은 범위
const START_MIN = 1, START_MAX = 999;

const int = (v, fallback) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : fallback; };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* 폰트/크기 비율(반올림 전 소수) — 스티커 요소별. 우리가 마지막에 쓴 크기·폰트가 dataset 에 그대로 있을 때만 믿는다.
   폰트 크기 칸·코너 드래그·되돌리기처럼 «남이» 크기나 폰트를 바꿨으면 그 값에서 다시 잡는다.
   패널을 다시 그려도(다른 블럭을 골랐다 돌아와도) 안 사라지게 클로저가 아니라 모듈에 둔다. */
const _fsRatio = new WeakMap();

/* 「섹션 전체」 스위치(1013t2B3) — 패널을 다시 그려도 남게 모듈에 둔다. 기본 켬. */
let _groupOn = true;
export const countGroupOn = () => _groupOn;
/** 스위치가 켜져 있으면 block 의 keys 를 같은 섹션의 다른 마킹에 베낀다(쓰기는 js/count-sticker-tool.js 한 자리). 돌려줌 = 바뀐 수. */
export function syncCountGroup(block, keys) {
  if (!_groupOn || !block || !block.dataset.count) return 0;
  return window.CountSticker?.copyToGroup?.(block, keys) || 0;
}
function fsRatioOf(block) {
  const d = block.dataset;
  const w = int(d.sizeW, int(d.size, 56)), fs = int(d.fontSize, 26);
  const kept = _fsRatio.get(block);
  if (kept && kept.w === String(w) && kept.fs === String(fs)) return kept.ratio;
  return w > 0 ? fs / w : 1;
}

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
      <div class="prop-section-title">Marking</div>
      <div class="prop-row"><span class="prop-label">섹션 전체</span>
        <label class="prop-toggle" title="켜면 모양·크기·폰트·색이 이 섹션의 마킹 전부에 적용된다 (끄면 고른 것만)">
          <input type="checkbox" id="stk-count-group" aria-label="섹션 전체에 적용"${_groupOn ? ' checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
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

  /* 「섹션 전체」 스위치 — UI 선호만 바꾼다(문서 무변 ⇒ 히스토리·저장 없음) */
  $('stk-count-group')?.addEventListener('change', (e) => { _groupOn = !!e.target.checked; });

  /* 표기 — 묶음 */
  panel.querySelectorAll('#stk-count-style [data-count-style]').forEach(btn => {
    btn.addEventListener('click', () => {
      const style = btn.dataset.countStyle === 'alpha' ? 'alpha' : 'num';
      if (!CS || (block.dataset.countStyle || 'num') === style) return;
      CS.setGroup(sec(), { style });
      markActive('stk-count-style', btn);
      commit('마킹 표기');
    });
  });

  /* 모양 — 스위치를 따른다. 투명(none)은 dataset.shape 를 그대로 두고 countShape 만 바꾼다(그리기가 배경을 비운다). */
  panel.querySelectorAll('#stk-count-shape [data-count-shape]').forEach(btn => {
    btn.addEventListener('click', () => {
      const shape = btn.dataset.countShape;
      if (shapeOf(block) === shape) return;
      block.dataset.countShape = shape;
      if (shape === 'circle' || shape === 'square') block.dataset.shape = shape;
      redraw();
      syncCountGroup(block, ['countShape', 'shape']);
      commit('마킹 모양');
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
    startEl.addEventListener('change', () => {
      /* 확정할 때 칸을 모델 값으로 되쓴다 — 2.7 을 넣으면 모델은 2 인데 칸에 "2.7" 이 남던 것 */
      startEl.value = String(clamp(int(block.dataset.countStart, START_MIN), START_MIN, START_MAX));
      commit('마킹 시작 번호');
    });
  }

  /* 크기 — 스위치를 따른다. 폰트는 폭 비율로 같이 키운다(코너 드래그와 같은 식 · 6~150).
     ★폰트/크기 «비율»은 반올림 전 소수로 들고 있는다(_fsRatio — 모듈 상태 · 저장 포맷 무변화).
       키 한 칸(input+change)마다 정수 폰트에서 비율을 다시 뽑으면 round(26×57/56)=26 이 되풀이돼 폰트가 영영 안 따라온다. */
  const sizeS = $('stk-count-size'), sizeN = $('stk-count-size-num');
  if (sizeS && sizeN) {
    const applySize = (raw) => {
      const v = parseInt(raw, 10);
      if (!Number.isFinite(v)) return;
      const next = clamp(v, SIZE_MIN, SIZE_MAX);
      const d = block.dataset;
      const ratio = fsRatioOf(block);
      d.size = String(next); d.sizeW = String(next); d.sizeH = String(next);
      d.fontSize = String(clamp(Math.round(next * ratio), FS_MIN, FS_MAX));
      _fsRatio.set(block, { w: d.sizeW, fs: d.fontSize, ratio });
      sizeS.value = String(next); sizeN.value = String(next);
      const fsS = $('stk-fs'), fsN = $('stk-fs-num');
      if (fsS) fsS.value = d.fontSize;
      if (fsN) fsN.value = d.fontSize;
      redraw();
      block.classList.toggle('tiny', next < 40);
      syncCountGroup(block, ['size', 'sizeW', 'sizeH', 'fontSize']);
    };
    const done = () => commit('마킹 크기');
    sizeS.addEventListener('input', () => applySize(sizeS.value));
    sizeN.addEventListener('input', () => applySize(sizeN.value));
    sizeS.addEventListener('change', done);
    sizeN.addEventListener('change', done);
  }

  /* 번호 다시 매기기 — 묶음 */
  $('stk-count-renumber')?.addEventListener('click', () => {
    if (!CS) return;
    CS.renumber(sec());
    commit('마킹 번호 다시 매기기');
  });
}
