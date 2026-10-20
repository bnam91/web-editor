/* prop-sticker-count.js — 카운트 스티커(data-count 가 붙은 circle/square 스티커)의 우측 패널 절 (1012t1Z4).
 *   ★사용자 표기 = Marking(마킹 블럭) · 1013t2B1 — 저장 키(data-count*)·id(stk-count-*)·파일명은 count 그대로다.
 *   prop-sticker.js 가 data-count 일 때 이 절을 끼우고 Shape·Text·이미지 모드 절과 «크기» 행을 숨긴다
 *   (폰트 크기·굵기·스타일·Colors 는 그대로 남는다).
 *   행: 섹션 전체(스위치) · 표기(1 / A / 아이콘) · [아이콘 — 표기가 아이콘일 때만] · 모양(원 / 사각 / 투명) · 시작 번호 · 크기 · [번호 다시 매기기]
 *   ★표기 「아이콘」(1013t2B5) — 번호 대신 내장 글리프. 표기와 같이 «항상 묶음»이다. 크기 = 폰트 크기 칸 · 색 = 글자색 칸(새 칸 없음).
 *     글리프 표·그 svg 는 js/count-sticker-tool.js(CountSticker.GLYPHS · glyphSvg) 한 자리 — 여기서 path 를 다시 적지 않는다.
 *     아이콘일 때 「시작 번호」「번호 다시 매기기」 행은 숨긴다(뜻이 없다 — 순번은 그대로 세고 있어 1/A 로 돌아오면 산다).
 *     「아이콘 고르기…」 = 레포의 기존 고르개(openIconifyModal · 인터넷 필요)를 그대로 부른다 — 받은 svg 는 쓸 때·그릴 때 거른다.
 *   ★프리셋(번호 · 포인트) — 절 맨 아래. 값은 도구의 표(CountSticker.PRESETS) 한 자리 · 누르면 이 섹션의 마킹 전부에(스위치와 무관) · 히스토리 한 칸.
 *   ★Label 절(1013t2B5) — 마커 옆 텍스트 라벨: 글자(블럭마다 · 일괄 안 함) · 위치 · 크기 · 굵기 · 글자색(이 넷은 「섹션 전체」 스위치를 따른다).
 *   ★「모서리」 행(2차) — 사각 모양일 때만. 값 = 한 변의 %(data-count-radius). 키가 없는 옛 블럭은 고정 8px 그대로 그려진다.
 *     그리기는 js/blocks/sticker-block.js(_countLabelHTML) — 라벨은 마커 블럭 «안»의 자식이고 상자(선택·손잡이)는 마커 그대로다.
 *     캔버스에서 마커를 더블클릭해도 같은 글자를 고친다(js/sticker-select.js _enterCountLabelEdit).
 *   ★표기·시작 번호 = «묶음» 속성 — 같은 섹션의 카운트 스티커 전부에 쓴다(히스토리 1칸). 스위치와 무관하게 항상.
 *   ★모양·크기·폰트 크기·굵기·스타일·배경색·글자색 = 「섹션 전체」 스위치(1013t2B3 · 기본 켬)를 따른다.
 *     켬 = 같은 섹션의 마킹 전부 · 끔 = 고른 것 하나. 스위치는 UI 선호다 — 모듈 변수(세션 동안) · 저장본에 안 쓴다.
 *     캔버스 코너 드래그는 스위치와 무관하게 잡은 것 하나다. 다음 찍기는 순번이 가장 큰 스티커의 것을 물려받는다.
 *   번호 계산·묶음 쓰기는 js/count-sticker-tool.js(window.CountSticker) 한 자리에 있다 — 여기서 다시 적지 않는다.
 *   숫자칸의 범위·빈 값 처리는 칸의 min/max 를 읽는 공용 가드(prop-number-commit-guard.js)가 한다.
 */

import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

const SIZE_MIN = 10, SIZE_MAX = 600;
const FS_MIN = 6, FS_MAX = 150;      // 코너 드래그(js/sticker-select.js)와 같은 범위
const START_MIN = 1, START_MAX = 999;

const LABEL_POS = ['right', 'left', 'top', 'bottom'];

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

/* ★1017t1j1(현빈) — «옆 라벨»(countLabelSize) 도 같은 함정·같은 해법이다(위 _fsRatio 머리말과 같은 WeakMap 항목에 얹는다).
   없으면(키가 없으면) ★null — 지어내지 않는다(그 마커는 라벨이 마커 폰트를 따르는 폴백 그대로다 · marking-glyph G3). */
function lsRatioOf(block) {
  const d = block.dataset;
  const lsRaw = parseInt(d.countLabelSize, 10);
  if (!Number.isFinite(lsRaw)) return null;
  const w = int(d.sizeW, int(d.size, 56));
  const kept = _fsRatio.get(block);
  if (kept && kept.w === String(w) && kept.ls === String(lsRaw)) return kept.lsRatio;
  return w > 0 ? lsRaw / w : 1;
}

function shapeOf(block) {
  const s = block.dataset.countShape;
  if (s === 'square' || s === 'none' || s === 'circle') return s;
  return block.dataset.shape === 'square' ? 'square' : 'circle';
}

/* 라벨의 보이는 값 — 정본은 그리기 쪽 한 자리. (그 모듈이 안 실린 일은 없다 — 패널은 그려진 블럭을 골라야 뜬다. 그래도 안 던지게 둔다.) */
const labelLook = (block) => window._stickerCountLabelLook?.(block)
  || { pos: 'right', gap: 0, size: int(block.dataset.fontSize, 26), weight: int(block.dataset.fontWeight, 700), color: block.dataset.bgColor || '' };

/* 라벨 굵기 선택지 — 저장값이 목록에 없으면(손댄 저장본의 100·200·550 …) «있는 그대로» 한 줄을 더해 보인다(3차 · N10).
   1차·2차에는 그런 값이 아무 option 도 못 골라 칸이 첫 줄(Light 300)을 보였다 — 그림은 200 인데 칸은 300. */
const LABEL_WEIGHTS = [[300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [800, 'Extrabold'], [900, 'Black']];
function labelWeightOptions(cur) {
  if (LABEL_WEIGHTS.some(([w]) => w === cur)) return LABEL_WEIGHTS;
  return [[cur, String(cur)], ...LABEL_WEIGHTS].sort((a, b) => a[0] - b[0]);
}

/* 사각 모서리 % (0~50). 키가 없으면 옛 고정 8px 를 한 변의 % 로 고친 값(56px 면 14). */
const RADIUS_MIN = 0, RADIUS_MAX = 50;
function radiusOf(block) {
  const d = block.dataset;
  const raw = parseFloat(d.countRadius);
  if (Number.isFinite(raw)) return clamp(Math.round(raw), RADIUS_MIN, RADIUS_MAX);
  const w = int(d.sizeW, int(d.size, 56)), h = int(d.sizeH, w);
  const side = Math.min(w, h);                      // 그리기와 같은 기준 — 짧은 변(3차 · N3)
  return clamp(Math.round(side > 0 ? 800 / side : 0), RADIUS_MIN, RADIUS_MAX);
}

/* 표기 3갈래 — 모르는 값은 num(js/count-sticker-tool.js _cntStyle 과 같은 뜻). */
const styleOf = (v) => (v === 'alpha' ? 'alpha' : v === 'icon' ? 'icon' : 'num');

/* 글리프 단추 줄 — 이웃 단추와 같은 꼴(14px · viewBox 0 0 16 16 · 선 굵기 1.4). 그림은 도구의 표에서 온다(개발자 상수 — 사용자 글자가 아니다). */
const GLYPH_TITLE = { 'chevron-right': '꺾쇠 (>)', check: '체크', 'arrow-right': '화살표', plus: '더하기', star: '별', dot: '점' };
function glyphButtonsHTML(active) {
  const CS = window.CountSticker;
  if (!CS || !CS.GLYPH_NAMES) return '';
  return CS.GLYPH_NAMES.map((g) => `<button class="prop-align-btn${g === active ? ' active' : ''}" data-count-glyph="${g}" title="${GLYPH_TITLE[g] || g}">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${CS.GLYPHS[g]}</svg>
          </button>`).join('');
}

export function countSectionHTML(block) {
  const d = block.dataset;
  const style = styleOf(d.countStyle);
  const isIcon = style === 'icon';
  const glyph = window.CountSticker?.iconNameOf ? window.CountSticker.iconNameOf(d.countIcon) : (d.countIcon || '');
  const shape = shapeOf(block);
  const start = clamp(int(d.countStart, START_MIN), START_MIN, START_MAX);
  const size = clamp(int(d.sizeW, int(d.size, 56)), SIZE_MIN, SIZE_MAX);
  const on = (c) => (c ? ' active' : '');
  /* 옆 라벨(1013t2B5) — 보이는 값은 «그리기와 같은 한 자리»에서 읽는다(js/blocks/sticker-block.js _countLabelLook · 2차 D6).
     ⛔폴백을 여기 다시 적지 마라 — 1차에 패널(검정)과 그리기(스티커 기본색)가 갈렸다. */
  const lk = labelLook(block);
  const labelPos = lk.pos, labelSize = clamp(lk.size, FS_MIN, FS_MAX), labelColor = lk.color, labelWeight = lk.weight;
  /* 사각 모서리(data-count-radius = 한 변의 % · 없으면 옛 고정 8px) — 칸에는 지금 그려진 값에 가장 가까운 % 를 보인다 */
  const radiusPct = radiusOf(block);
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
          <button class="prop-align-btn${on(isIcon)}" data-count-style="icon" title="아이콘 (번호 대신 아이콘 — 크기는 폰트 크기, 색은 글자색)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="2.5" width="11" height="11" rx="2"/><polyline points="7 5.5 9.5 8 7 10.5"/></svg>
          </button>
        </div>
      </div>
      <div class="prop-row" id="stk-count-glyph-row" style="display:${isIcon ? 'flex' : 'none'};"><span class="prop-label">아이콘</span>
        <div class="prop-align-group" id="stk-count-glyph">
          ${glyphButtonsHTML(isIcon ? glyph : '')}
        </div>
      </div>
      <div class="prop-row" id="stk-count-icon-pick-row" style="display:${isIcon ? 'flex' : 'none'};">
        <button class="prop-action-btn secondary" id="stk-count-icon-pick" style="width:100%;" title="아이콘 고르개에서 다른 아이콘을 고른다 (인터넷 연결 필요 · 고른 svg 는 걸러서 넣는다)">아이콘 고르기…</button>
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
      <div class="prop-row" id="stk-count-radius-row" style="display:${shape === 'square' ? 'flex' : 'none'};"><span class="prop-label">모서리</span>
        <input type="range" class="prop-slider" id="stk-count-radius" min="${RADIUS_MIN}" max="${RADIUS_MAX}" step="1" value="${radiusPct}" title="사각 모서리의 둥글기 — 짧은 변의 % (50 = 반원 끝)">
        <input type="number" class="prop-number" id="stk-count-radius-num" min="${RADIUS_MIN}" max="${RADIUS_MAX}" value="${radiusPct}" aria-label="모서리 %">
      </div>
      <div class="prop-row" id="stk-count-start-row" style="display:${isIcon ? 'none' : 'flex'};"><span class="prop-label">시작 번호</span>
        <input type="number" class="prop-number" id="stk-count-start" min="${START_MIN}" max="${START_MAX}" step="1" value="${start}" title="이 섹션의 첫 번호 (알파벳 표기에서는 1 = A)">
      </div>
      <div class="prop-row"><span class="prop-label">크기</span>
        <input type="range" class="prop-slider" id="stk-count-size" min="${SIZE_MIN}" max="${SIZE_MAX}" step="1" value="${size}">
        <input type="number" class="prop-number" id="stk-count-size-num" min="${SIZE_MIN}" max="${SIZE_MAX}" value="${size}">
      </div>
      <div class="prop-row" id="stk-count-renumber-row" style="display:${isIcon ? 'none' : 'flex'};">
        <!-- ★1017t1j3 — 사람의 삭제 경로(마커 하나 Delete · ⌘A→Delete · deleteBlock)는 이제 자동으로 당긴다
             (js/count-sticker-tool.js countStickerRenumberSections). 이 단추는 그 경로가 못 닿는 자리를
             위해 ⛔지우지 않고 남긴다 — 붙여넣기·되돌리기·옛 저장본처럼 번호가 비어 «남은» 경우용. -->
        <button class="prop-action-btn" id="stk-count-renumber" title="붙여넣기·되돌리기·옛 저장본처럼 번호가 비어 남았을 때 1부터 다시 매긴다">번호 다시 매기기</button>
      </div>
      <!-- ★프리셋 title 은 ★값의 둘째 명부다(1013t2 D2 이후 한 번 썩었다 — 코드는 고치고 title 은 안 고쳤다).
           ★값은 js/count-sticker-tool.js COUNT_STK_PRESETS 가 정본 — 여기 title 은 그 값을 «말로」 베낀 것뿐이니
           프리셋 값을 고치면 이 title 도 같이 고쳐라(tests/unit/marking-glyph.test.mjs G5 가 둘을 맞댄다). -->
      <div class="prop-type-group prop-preset-group" id="stk-count-presets">
        <button class="prop-preset-btn" data-count-preset="number" title="번호 — 원 · 검정 배경 · 흰 숫자 (기본 꼴로 되돌린다 · 이 섹션의 마킹 전부)">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5.5"/><line x1="8" y1="5.5" x2="8" y2="10.5"/></svg><span>번호</span>
        </button>
        <button class="prop-preset-btn" data-count-preset="point" title="포인트 — 둥근 네모(모서리 25%) · 검정 배경 · 흰 꺾쇠 아이콘 + 흰 라벨 글자(라벨이 없을 때) (이 섹션의 마킹 전부)">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="2.5" width="11" height="11" rx="2"/><polyline points="7 5.5 9.5 8 7 10.5"/></svg><span>포인트</span>
        </button>
      </div>
    </div>
    <div class="prop-section" id="stk-count-label-section">
      <div class="prop-section-title">Label</div>
      <div class="prop-row">
        <textarea class="prop-textarea" id="stk-count-label" rows="2" placeholder="마커 옆에 붙는 글자 (비우면 라벨 없음)" aria-label="라벨 글자"></textarea>
      </div>
      <div class="prop-row"><span class="prop-label">위치</span>
        <div class="prop-align-group" id="stk-count-label-pos">
          <button class="prop-align-btn${on(labelPos === 'left')}" data-label-pos="left" title="마커 왼쪽">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="12" cy="8" r="2"/><line x1="2.5" y1="8" x2="7.5" y2="8"/></svg>
          </button>
          <button class="prop-align-btn${on(labelPos === 'right')}" data-label-pos="right" title="마커 오른쪽">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="4" cy="8" r="2"/><line x1="8.5" y1="8" x2="13.5" y2="8"/></svg>
          </button>
          <button class="prop-align-btn${on(labelPos === 'top')}" data-label-pos="top" title="마커 위">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="12" r="2"/><line x1="5" y1="5" x2="11" y2="5"/></svg>
          </button>
          <button class="prop-align-btn${on(labelPos === 'bottom')}" data-label-pos="bottom" title="마커 아래">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="4" r="2"/><line x1="5" y1="11" x2="11" y2="11"/></svg>
          </button>
        </div>
      </div>
      <div class="prop-row"><span class="prop-label">크기</span>
        <input type="range" class="prop-slider" id="stk-count-label-size" min="${FS_MIN}" max="${FS_MAX}" step="1" value="${labelSize}">
        <input type="number" class="prop-number" id="stk-count-label-size-num" min="${FS_MIN}" max="${FS_MAX}" value="${labelSize}">
      </div>
      <div class="prop-row"><span class="prop-label">굵기</span>
        <select class="prop-select" id="stk-count-label-weight" aria-label="라벨 굵기">
          ${labelWeightOptions(labelWeight)
            .map(([w, t]) => `<option value="${w}"${labelWeight === w ? ' selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="prop-color-row">
        <span class="prop-label">글자색</span>
        ${colorFieldHTML({ idPrefix: 'stk-clabel', hex: labelColor, alpha: parseAlphaFromColor(labelColor) })}
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

  /* 표기가 아이콘일 때만 보이는 행 / 숨는 행 — 패널을 통째로 다시 그리지 않고 그 자리에서 맞춘다 */
  const syncIconRows = () => {
    const isIcon = styleOf(block.dataset.countStyle) === 'icon';
    const show = (id, on) => { const row = $(id); if (row) row.style.display = on ? 'flex' : 'none'; };
    show('stk-count-glyph-row', isIcon);
    show('stk-count-icon-pick-row', isIcon);
    panel.querySelectorAll('#stk-count-style [data-count-style]').forEach(b => b.classList.toggle('active', styleOf(b.dataset.countStyle) === styleOf(block.dataset.countStyle)));
    show('stk-count-start-row', !isIcon);
    show('stk-count-renumber-row', !isIcon);
    const cur = CS?.iconNameOf ? CS.iconNameOf(block.dataset.countIcon) : '';
    panel.querySelectorAll('#stk-count-glyph [data-count-glyph]').forEach(b => b.classList.toggle('active', isIcon && b.dataset.countGlyph === cur));
  };

  /* 표기 — 묶음(1 / A / 아이콘) */
  panel.querySelectorAll('#stk-count-style [data-count-style]').forEach(btn => {
    btn.addEventListener('click', () => {
      const style = styleOf(btn.dataset.countStyle);
      if (!CS || styleOf(block.dataset.countStyle) === style) return;
      CS.setGroup(sec(), { style });
      markActive('stk-count-style', btn);
      syncIconRows();
      commit('마킹 표기');
    });
  });

  /* 아이콘(내장 글리프) — 묶음. 표기가 아이콘이 아닐 때는 행이 숨어 있어 안 눌린다. */
  panel.querySelectorAll('#stk-count-glyph [data-count-glyph]').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.countGlyph;
      if (!CS || (block.dataset.countIcon === name && styleOf(block.dataset.countStyle) === 'icon')) return;
      CS.setGroup(sec(), { style: 'icon', icon: name });
      syncIconRows();
      commit('마킹 아이콘');
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

  /* 모서리 — 사각 모양일 때만 보인다 · 스위치를 따른다. 값 = 한 변의 %. */
  const radS = $('stk-count-radius'), radN = $('stk-count-radius-num');
  if (radS && radN) {
    const applyRadius = (raw) => {
      const v = parseInt(raw, 10);
      if (!Number.isFinite(v)) return;
      const next = clamp(v, RADIUS_MIN, RADIUS_MAX);
      block.dataset.countRadius = String(next);
      radS.value = String(next); radN.value = String(next);
      redraw();
      syncCountGroup(block, ['countRadius']);
    };
    const doneRad = () => commit('마킹 모서리');
    radS.addEventListener('input', () => applyRadius(radS.value));
    radN.addEventListener('input', () => applyRadius(radN.value));
    radS.addEventListener('change', doneRad);
    radN.addEventListener('change', doneRad);
  }

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
      const prevW = int(d.sizeW, int(d.size, 56));
      const ratio = fsRatioOf(block);
      const lsRatio = lsRatioOf(block);   // ★1017t1j1 — null 이면 그 마커엔 countLabelSize 가 없다(지어내지 않는다)
      d.size = String(next); d.sizeW = String(next); d.sizeH = String(next);
      d.fontSize = String(clamp(Math.round(next * ratio), FS_MIN, FS_MAX));
      if (lsRatio !== null) window.CountSticker?.rescaleLabel?.(d, prevW, next, lsRatio);
      _fsRatio.set(block, { w: d.sizeW, fs: d.fontSize, ratio, ls: d.countLabelSize, lsRatio: lsRatio === null ? undefined : lsRatio });
      sizeS.value = String(next); sizeN.value = String(next);
      const fsS = $('stk-fs'), fsN = $('stk-fs-num');
      if (fsS) fsS.value = d.fontSize;
      if (fsN) fsN.value = d.fontSize;
      redraw();
      block.classList.toggle('tiny', next < 40);
      syncCountGroup(block, ['size', 'sizeW', 'sizeH', 'fontSize', 'countLabelSize']);
    };
    const done = () => commit('마킹 크기');
    sizeS.addEventListener('input', () => applySize(sizeS.value));
    sizeN.addEventListener('input', () => applySize(sizeN.value));
    sizeS.addEventListener('change', done);
    sizeN.addEventListener('change', done);
  }

  /* 아이콘 고르기 — 레포의 기존 고르개(js/panels/iconify-panel.js openIconifyModal)를 그대로 쓴다. 여기에 네트워크 코드는 없다.
     ⚠️그 고르개는 인터넷이 있어야 아이콘을 받는다(없으면 내장 글리프 6개만 쓴다). 받지 못하면 svg 대신 <img …> 문자열이 온다 — 그건 안 쓴다.
     받은 svg 는 묶음 setter(CountSticker.setGroup)가 «쓸 때» 거르고(js/util/sanitize-svg.js), 그릴 때 한 번 더 거른다. */
  $('stk-count-icon-pick')?.addEventListener('click', () => {
    if (!CS || typeof window.openIconifyModal !== 'function') { window.showToast?.('⚠️ 아이콘 고르개를 열 수 없습니다'); return; }
    window.openIconifyModal((picked) => {
      const svg = picked && typeof picked.svg === 'string' ? picked.svg : '';
      if (!/^\s*<svg[\s>]/i.test(svg)) { window.showToast?.('⚠️ 아이콘을 받지 못했습니다'); return; }
      /* setGroup 은 «쓴 블럭 수»를 돌려준다 — 걸러서 그릴 것이 안 남았거나 상한을 넘으면 0(아무것도 안 쓴다 · 2차 D8).
         그때는 히스토리를 찍지 않고 알리기만 한다(아이콘이 안 바뀌었는데 「마킹 아이콘」 칸이 생기지 않게). */
      const wrote = CS.setGroup(sec(), { style: 'icon', icon: 'custom', iconSvg: svg });
      if (!wrote) { window.showToast?.('⚠️ 쓸 수 없는 아이콘입니다'); return; }
      syncIconRows();
      commit('마킹 아이콘');
    }, { hideSize: true });
  });

  /* 프리셋 — 이 섹션의 마킹 전부에 한 벌을 깐다(스위치와 무관). 색·모양·표기 칸이 다 바뀌므로 패널을 다시 그린다. */
  panel.querySelectorAll('#stk-count-presets [data-count-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!CS?.applyPreset) return;
      if (!CS.applyPreset(sec(), btn.dataset.countPreset)) return;
      commit('마킹 프리셋');
      window.showStickerProperties?.(block);
    });
  });

  /* ── Label 절(옆 라벨 · 1013t2B5) ─────────────────────────────────────────────── */
  /* 글자 — 블럭마다(일괄 안 함). 값은 .value 로 넣는다(본문 주입의 선두 개행 소실·이스케이프 함정 회피 — #stk-text 와 같은 까닭).
     input 마다 그 블럭만 다시 그리고, change(포커스가 빠질 때)에 히스토리 한 칸. 비우면 키를 지운다(라벨 사라짐). */
  const labelEl = $('stk-count-label');
  if (labelEl) {
    labelEl.value = block.dataset.countLabel ?? '';
    labelEl.addEventListener('input', () => {
      const v = labelEl.value.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '');
      if (v === '') delete block.dataset.countLabel;
      else block.dataset.countLabel = v;
      redraw();
    });
    labelEl.addEventListener('change', () => commit('마킹 라벨'));
  }

  /* 위치 — 스위치를 따른다 */
  panel.querySelectorAll('#stk-count-label-pos [data-label-pos]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pos = LABEL_POS.includes(btn.dataset.labelPos) ? btn.dataset.labelPos : 'right';
      if ((LABEL_POS.includes(block.dataset.countLabelPos) ? block.dataset.countLabelPos : 'right') === pos) return;
      block.dataset.countLabelPos = pos;
      redraw();
      syncCountGroup(block, ['countLabelPos']);
      markActive('stk-count-label-pos', btn);
      commit('마킹 라벨 위치');
    });
  });

  /* 크기 — 스위치를 따른다. 마커 크기와는 따로다(자기 칸). */
  const lsS = $('stk-count-label-size'), lsN = $('stk-count-label-size-num');
  if (lsS && lsN) {
    const applyLabelSize = (raw) => {
      const v = parseInt(raw, 10);
      if (!Number.isFinite(v)) return;
      const next = clamp(v, FS_MIN, FS_MAX);
      block.dataset.countLabelSize = String(next);
      /* ★1017t1j1 — 사용자가 라벨 크기를 손으로 바꾸면 비율이 «바뀐 것»이다(_fsRatio 머리말의 fsRatioOf 와 같은 논리).
         여기서 다시 잡아 둬야 다음 마커 크기 변경이 round(…)=… 되풀이로 고착되지 않는다. */
      const w = int(block.dataset.sizeW, int(block.dataset.size, 56));
      const kept = _fsRatio.get(block) || {};
      _fsRatio.set(block, { ...kept, w: String(w), ls: String(next), lsRatio: w > 0 ? next / w : 1 });
      lsS.value = String(next); lsN.value = String(next);
      redraw();
      syncCountGroup(block, ['countLabelSize']);
    };
    const doneLs = () => commit('마킹 라벨 크기');
    lsS.addEventListener('input', () => applyLabelSize(lsS.value));
    lsN.addEventListener('input', () => applyLabelSize(lsN.value));
    lsS.addEventListener('change', doneLs);
    lsN.addEventListener('change', doneLs);
  }

  /* 굵기 — 스위치를 따른다. 마커 안 글자·아이콘의 굵기와는 따로다(자기 키). */
  $('stk-count-label-weight')?.addEventListener('change', (e) => {
    block.dataset.countLabelWeight = e.target.value;
    redraw();
    syncCountGroup(block, ['countLabelWeight']);
    commit('마킹 라벨 굵기');
  });

  /* 글자색 — 스위치를 따른다 */
  wireColorField('stk-clabel', {
    initialAlpha: parseAlphaFromColor(labelLook(block).color),
    onApply: (c) => { block.dataset.countLabelColor = c; redraw(); syncCountGroup(block, ['countLabelColor']); },
    onCommit: () => commit('마킹 라벨 색'),
  });

  /* 번호 다시 매기기 — 묶음 */
  $('stk-count-renumber')?.addEventListener('click', () => {
    if (!CS) return;
    CS.renumber(sec());
    commit('마킹 번호 다시 매기기');
  });
}
