import { propPanel } from '../globals.js';
import { blockHeaderHTML, sliderRowHTML, escHtml, wireRotRow, checkHTML } from './_helpers.js';
import { positionSectionHTML, positionHeadToolsHTML, wirePositionSection } from './_position-section.js';   // 표준 Position 절(0.9.14 73행 P3)
import { renderPanel, sec } from './_panel-frame.js';
import { buildTypographySectionHtml } from './_typo-section.js';   // 표준 Typography 절(시트 221) — 기본·텍스트 스티커 같은 한 벌(p 'stk-typo')
import { wireFontPicker } from './_font-picker.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';
import { strokeSectionHTML, strokeHeadToolsHTML, wireStrokeSection, STROKE_POP_WHY } from './_stroke-section.js';
import { fillSectionHTML, fillHeadToolsHTML, wireFillSection, fillLast, fillHiddenOf, setFillHiddenKey } from './_fill-section.js';   // 표준 Fill F5-2b
import { panelRenderedColor } from './_panel-rendered.js';
import { sanitizeIconMarkup } from '../util/sanitize-svg.js';
import { glowSectionHTML, wireGlowSection } from './prop-sticker-glow.js';
import { countSections, wireCountSection, syncCountGroup } from './prop-sticker-count.js';
import { coinSections, wireCoinSection } from './prop-sticker-coin.js';
import { arrowSections, wireArrowSection } from './prop-sticker-arrow.js';
import { burstPoints, clampBurst, BURST_LIMITS, BURST_DEFAULTS, clampRound, ROUND_MIN, ROUND_MAX } from '../blocks/burst-geometry.js';   // B2 톱니 스탬프
import { appearanceSectionHTML, appearanceHeadToolsHTML, wireAppearanceSection } from './_appearance-section.js';   // 표준 Appearance(A3)

import { layoutSizeRowHTML, layoutPadSlotHTML, wireLayoutSection, ratioLockOn, setRatioLock, LAY_SIZING } from './_layout-section.js';   // 표준 Layout(L2~L4 · C2)

function _esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── U6(c): 스티커 즐겨찾기 — 프로젝트 무관 전역 localStorage ────────────────────
const FAV_KEY = 'goditor.stickerFavorites';
const FAV_MAX = 30;
// 위치 종속 shape(highlightB)는 프리셋 부적합 — circle/square/text/highlight/icon만 대상.
const FAV_ALLOWED_SHAPES = ['circle', 'square', 'burst', 'text', 'highlight', 'icon'];

function listStickerFavorites() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (_) { return []; }
}
function _saveStickerFavorites(arr) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(arr.slice(0, FAV_MAX))); } catch (_) {}
  // 데이터 변경 통지 — 모달 Favorite 그리드 ↔ 우측 패널 스트립 양방향 동기화.
  //   (한쪽에서 삭제/추가하면 다른 쪽 렌더가 stale 인덱스로 라이브 배열을 읽는 것을 방지)
  try { window.dispatchEvent(new CustomEvent('sticker-favorites-changed')); } catch (_) {}
}
// 현재 스티커 dataset에서 스타일 토큰만 추출 (위치/절대크기/text 내용 제외)
function _stickerStyleFromBlock(block) {
  const d = block.dataset;
  const shape = d.shape || 'circle';
  const preset = { shape };
  const put = (k) => { if (d[k] !== undefined && d[k] !== '') preset[k] = d[k]; };
  if (shape === 'highlight') {
    put('hlColor'); put('hlW'); put('hlH');
  } else if (shape === 'icon') {
    ['iconName', 'iconSvg', 'iconColor', 'size'].forEach(put);
  } else if (shape === 'text') {
    ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textDecoration', 'textColor', 'strokeWidth', 'strokeColor',
     'letterSpacing', 'textAlign', 'shadowOn', 'shadowX', 'shadowY', 'shadowBlur', 'shadowColor',
     'bgColor', 'padX', 'padY', 'cornerRadius'].forEach(put);
  } else { // circle / square / burst(B2 — 톱니 키는 burst 에만 있다)
    ['size', 'bgColor', 'textColor', 'fontSize', 'fontWeight', 'fontStyle', 'textDecoration', 'burstTeeth', 'burstDepth', 'burstRound', 'burstRing', 'ringText', 'ringTextSize', 'ringBorderW', 'ringBorderColor', 'ringTextColor', 'subText'].forEach(put);
  }
  return preset;
}
function addStickerFavorite(block) {
  const shape = block.dataset.shape || 'circle';
  if (!FAV_ALLOWED_SHAPES.includes(shape)) {
    window.showToast?.('⚠️ 이 모양은 즐겨찾기에 추가할 수 없습니다');
    return false;
  }
  const preset = _stickerStyleFromBlock(block);
  const favs = listStickerFavorites();
  favs.unshift(preset);
  _saveStickerFavorites(favs);
  return true;
}
function removeStickerFavorite(idx) {
  const favs = listStickerFavorites();
  if (idx < 0 || idx >= favs.length) return;
  favs.splice(idx, 1);
  _saveStickerFavorites(favs);
}
window.listStickerFavorites = listStickerFavorites;
window.addStickerFavorite = addStickerFavorite;
window.removeStickerFavorite = removeStickerFavorite;

// 현재 표시 중인 스티커 프로퍼티 패널의 fav 스트립 리렌더러(단일 참조).
//   'sticker-favorites-changed'가 오면 스트립을 라이브 배열로 다시 그려 stale DOM 인덱스를 소거한다.
//   패널이 재빌드되면 참조가 교체되고, 비-스티커 선택 시엔 그리드가 없어 no-op이 되므로 리스너 누수 없음.
let _activePanelFavRerender = null;
window.addEventListener('sticker-favorites-changed', () => {
  if (typeof _activePanelFavRerender === 'function') _activePanelFavRerender();
});

// 즐겨찾기 스와치 1개의 미리보기 스타일/라벨
function _favSwatchPreview(preset) {
  const shape = preset.shape || 'circle';
  if (shape === 'highlight') {
    return { bg: preset.hlColor || 'rgba(255,235,70,0.7)', label: '' };
  }
  if (shape === 'text') {
    return { bg: (preset.bgColor && preset.bgColor !== 'transparent') ? preset.bgColor : '#2a2a2a',
             color: preset.textColor || '#ddd', label: 'T' };
  }
  if (shape === 'icon') {
    return { bg: '#2a2a2a', color: preset.iconColor || '#ddd', label: '★', svg: preset.iconSvg || '' };
  }
  return { bg: preset.bgColor || '#e74c3c', color: preset.textColor || '#fff', label: 'A' };
}

// ── U6(d): 텍스트 스티커 프리셋 (코드 내 고정 배열) ───────────────────────────────
// text 내용(dataset.text)은 보존하고 스타일만 덮어씀.
const TEXT_PRESETS = [
  { name: '빅 타이틀', style: { fontSize: '48', fontWeight: '900', textColor: '#222222', strokeWidth: '0', letterSpacing: '-1', shadowOn: '0', bgColor: 'transparent' } },
  { name: '뱃지', style: { fontSize: '18', fontWeight: '700', textColor: '#ffffff', bgColor: '#e74c3c', strokeWidth: '0', padX: '14', padY: '6', shadowOn: '0' } },
  { name: '외곽선 강조', style: { fontSize: '40', fontWeight: '800', textColor: '#ffffff', strokeWidth: '4', strokeColor: '#222222', shadowOn: '0', bgColor: 'transparent' } },
  { name: '그림자 텍스트', style: { fontSize: '36', fontWeight: '800', textColor: '#ffffff', strokeWidth: '0', shadowOn: '1', shadowX: '0', shadowY: '3', shadowBlur: '6', shadowColor: 'rgba(0,0,0,0.5)', bgColor: 'transparent' } },
  { name: '형광펜식', style: { fontSize: '30', fontWeight: '700', textColor: '#222222', strokeWidth: '0', shadowOn: '0', bgColor: 'rgba(255,235,70,0.7)', padX: '6', padY: '2' } },
  { name: '심플 라벨', style: { fontSize: '14', fontWeight: '500', textColor: '#666666', strokeWidth: '0', letterSpacing: '0.5', shadowOn: '0', bgColor: 'transparent' } },
];
window.STICKER_TEXT_PRESETS = TEXT_PRESETS;

/* ★1012t1J2 선 형광펜 두들 프리셋 칩 — 이름·모양값은 js/fx/doodle-line-render.js(DoodleLine) 한 자리. 여기는 칩 아이콘·설명만.
   아이콘은 이웃 #stk-hlb-style-group 과 같은 꼴(18×14 · viewBox 0 0 18 14 · currentColor). */
const _HLB_DOODLE_ICON = {
  scribble: '<path d="M2,10 L4,4 L6,10 L8,4 L10,10 L12,4 L14,10 L16,4" stroke-width="1.4"/>',
  brush:    '<path d="M2,6.5 C6,4.5 12,8 16,6" stroke-width="3.2"/><path d="M3,9.5 C7,8 11,10.5 15,8.5" stroke-width="1.2" opacity="0.55"/>',
  circle:   '<path d="M9,2.5 C14.5,2.5 16.5,5 16.5,7 C16.5,9.5 13,11.5 9,11.5 C4.5,11.5 1.5,9.5 1.5,7 C1.5,4.5 5,2.2 10.5,2.8" stroke-width="1.4"/>',
  double:   '<path d="M2,5.5 C7,4.8 12,6 16,5.2" stroke-width="1.4"/><path d="M3,9.2 C7,8.6 11,9.8 15,9" stroke-width="1.4"/>',
  scratch:  '<path d="M2,7 Q8,10.5 14,7 L16,3" stroke-width="1.6"/>',
};
const _HLB_DOODLE_TITLE = {
  scribble: '스크리블 — 지그재그로 칠한 낙서 (모양·두께·색을 한 번에 깐다)',
  brush:    '거친 붓 — 겹친 붓 획 (모양·두께·색을 한 번에 깐다)',
  circle:   '동그라미 — 선을 감싸는 손그림 타원 · 높이는 아래 칸 (모양·두께·색을 한 번에 깐다)',
  double:   '두 줄 밑줄 — 평행한 손그림 두 줄 · 간격은 아래 칸 (모양·두께·색을 한 번에 깐다)',
  scratch:  '밑줄 긁기 — 휜 밑줄 끝을 치켜 올린 획 (모양·두께·색을 한 번에 깐다)',
};
/* 진폭 칸은 갈래마다 뜻이 다르다 — 없으면 칸을 숨긴다. 주기 칸은 wavy 만. */
const _HLB_AMP_LABEL = { wavy: '진폭', circle: '높이', double: '간격' };

export function showStickerProperties(block) {
  const shape      = block.dataset.shape      || 'circle';
  const isText     = shape === 'text';
  const isHl      = shape === 'highlight';
  const isHlB     = shape === 'highlightB';
  const isAnyHl   = isHl || isHlB;
  const isIcon    = shape === 'icon';
  const isGlow    = shape === 'glow';   // 이펙트 스티커 — 자기 절(prop-sticker-glow.js)만 보인다
  // circle/square 전용 섹션(mode/text/size/colors)을 가리는 통합 플래그
  const isCoin    = shape === 'coin';   // 코인 스티커 — 자기 절(prop-sticker-coin.js)만 보인다
  const isArrow   = shape === 'arrow';  // 화살표 스티커(1013t2C4) — 자기 절(prop-sticker-arrow.js)만 · 각도는 두 끝점이 정한다
  const hideBasic = isAnyHl || isText || isIcon || isGlow || isCoin || isArrow;
  // 카운트 스티커(data-count · 1012t1Z4) — circle/square 의 변형. 자기 절(prop-sticker-count.js)을 끼우고
  //   글자·이미지 모드·Shape 절과 «크기» 행은 숨긴다(글자 = 번호, 모양·크기는 Count 절이 든다).
  const isCount   = !!block.dataset.count && !hideBasic;
  const isCountNone = isCount && block.dataset.countShape === 'none';   // 투명 — 배경색이 곧 숫자색이다
  // 기본 sticker(circle/square)에서 사용하는 값
  const size       = parseInt(block.dataset.size)       || 60;
  const text       = block.dataset.text ?? (isText ? 'Text' : 'NEW');
  const bgDefault  = isText ? 'transparent' : '#e74c3c';
  const txtDefault = isText ? '#222222'     : '#ffffff';
  const bgColor    = block.dataset.bgColor    || bgDefault;
  const textColor  = block.dataset.textColor  || txtDefault;
  const fontSize   = parseInt(block.dataset.fontSize)   || (isText ? 32 : 14);
  const fontWeight = parseInt(block.dataset.fontWeight) || 700;
  const bgAlpha    = parseAlphaFromColor(bgColor);
  const txtAlpha   = parseAlphaFromColor(textColor);

  // 텍스트 스티커 전용 값
  const tFontFamily    = block.dataset.fontFamily    || "'Pretendard', sans-serif";
  const tStrokeWidth   = parseFloat(block.dataset.strokeWidth) || 0;
  const tStrokeColor   = block.dataset.strokeColor   || '#ffffff';
  const tStrokeAlpha   = parseAlphaFromColor(tStrokeColor);
  const tLetterSpacing = parseFloat(block.dataset.letterSpacing) || 0;
  const tTextAlign     = block.dataset.textAlign     || 'left';
  const tFontStyle     = block.dataset.fontStyle     || 'normal';
  const tTextDeco      = block.dataset.textDecoration || 'none';
  const tDecoUnderline = tTextDeco.includes('underline');
  const tDecoStrike    = tTextDeco.includes('line-through');
  const tShadowOn      = block.dataset.shadowOn === '1';
  const tShadowX       = parseFloat(block.dataset.shadowX) || 0;
  const tShadowY       = parseFloat(block.dataset.shadowY) || 2;
  const tShadowBlur    = parseFloat(block.dataset.shadowBlur) || 4;
  const tShadowColor   = block.dataset.shadowColor   || 'rgba(0,0,0,0.4)';
  const tShadowAlpha   = parseAlphaFromColor(tShadowColor);
  const tRotation      = parseFloat(block.dataset.rotation) || 0;
  const tPadX = Number.isFinite(parseInt(block.dataset.padX)) ? parseInt(block.dataset.padX) : 10;
  const tPadY = Number.isFinite(parseInt(block.dataset.padY)) ? parseInt(block.dataset.padY) : 6;
  // 코너 라운드 — 미설정 시 4(렌더 기본값과 동일)
  const tCornerR = Number.isFinite(parseInt(block.dataset.cornerRadius)) ? parseInt(block.dataset.cornerRadius) : 4;
  // 박스 너비 — dataset.boxW 없거나 'auto'면 내용맞춤(auto). 고정 px면 그 값. 슬라이더 seed는 유효 px 우선.
  const _tBoxWpx  = parseInt(block.dataset.boxW);
  const tBoxWOn   = Number.isFinite(_tBoxWpx) && _tBoxWpx > 0;
  const tBoxWVal  = tBoxWOn ? _tBoxWpx : 200;

  /* 묶음 B E119(새 블럭 갈래 · 색) — 형광 색은 «저장된 값 그대로»(rgba 투명도 포함) · 비면 그려진 색. 옛 표시는 rgba 를 통째로 #ffeb46·70% 로 바꿔 사용자 색을 숨겼다.
     아이콘 색은 비면 «그려진»(상속) 색 — 옛 표시 #222222. */
  const _stkHlShown = block.dataset.hlColor
    || (shape === 'highlightB' ? panelRenderedColor(block.querySelector('svg [stroke]'), 'stroke') : panelRenderedColor(block, 'backgroundColor'))
    || 'rgba(255, 235, 70, 0.7)';
  const _stkIconShown = block.dataset.iconColor || panelRenderedColor(block, 'color') || '#222222';
  /* ★right-panel-unify U5 — 절은 _section-spec 순서·제목(영어)으로 프레임이 그린다. 모양(shape)마다 «있는 칸만» 낸다 —
     모양을 바꾸면 패널을 통째로 다시 그린다(아래 stk-shape-group 핸들러) ⇒ 머리만 남은 빈 절이 안 생긴다.
     옛 절 id(stk-*-section)는 절 «안» 감싸개로 남긴다(배선·spec 이 id 로 찾는다). 한 key 는 한 절 — 조각을 key 별로 모은다. */
  /* 표준 Typography — 기본(원·사각·카운트)·텍스트 스티커 두 갈래는 배타 ⇒ 접두 하나 'stk-typo'. B = 굵기 700/400 · I/U/S = 옛 fontStyle/textDecoration 쓰기.
     줄간격은 끔(스티커 렌더에 그 키가 없다) · 폰트·자간은 텍스트 스티커만(옛 칸이 거기만 있었다). */
  const _stkTypo = ({ sizeMin, sizeMax, showFont = false, showLetterSpacing = false }) => buildTypographySectionHtml({
    p: 'stk-typo', bare: true, font: tFontFamily, weight: String(fontWeight), size: fontSize,
    isBold: fontWeight >= 700, isItalic: tFontStyle === 'italic', isUnderline: tDecoUnderline, isStrike: tDecoStrike,
    showUnderline: true, showHighlight: false, ls: tLetterSpacing,
    sizeMin, sizeMax, showFont, showLetterSpacing, showLineHeight: false, omitHidden: true,
  });
  const P = {};
  const put = (key, html) => { if (html) P[key] = (P[key] || '') + html; };
  const basic = !hideBasic;   // circle/square(+카운트)
  put('kind', `
      <div class="stk-fav-grid" id="stk-fav-grid"></div>`);
  if (!(isGlow || isCount || isCoin || isArrow)) put('kind', `
    <div id="stk-shape-section">
      <div class="prop-row">
        <div class="prop-align-group" id="stk-shape-group">
          <button class="prop-align-btn${shape === 'circle' ? ' active' : ''}" data-shape="circle" title="원형">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="5.5"/></svg>
          </button>
          <button class="prop-align-btn${shape === 'square' ? ' active' : ''}" data-shape="square" title="사각">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.5" y="2.5" width="11" height="11" rx="1"/></svg>
          </button>
          <button class="prop-align-btn${shape === 'burst' ? ' active' : ''}" data-shape="burst" title="톱니 스탬프">
            <svg width="14" height="14" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="7"><polygon points="${burstPoints({ teeth: 12, depth: 18 })}"/></svg>
          </button>
          <button class="prop-align-btn${isText ? ' active' : ''}" data-shape="text" title="텍스트 스티커">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 4 L13 4 M8 4 L8 13" stroke-linecap="round"/></svg>
          </button>
          ${/* ★1012t1J1: 면 형광펜 A 는 메뉴에서 숨겼다 — 이 단추도 «지금 A 인 옛 블럭»에서만 보인다(그 블럭이 B 로 넘어갈 수는 있게).
               새로 A 로 바꾸는 입구는 닫힌다. 회귀: tests/dom/highlight-line-j1j2.dom.spec.js J1-d. */
            isHl ? `<button class="prop-align-btn active" data-shape="highlight" title="형광펜(면 · 옛 블럭)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="6" width="12" height="5" rx="1" fill="rgba(255,235,70,0.85)"/></svg>
          </button>` : ''}
          <button class="prop-align-btn${isHlB ? ' active' : ''}" data-shape="highlightB" title="선 형광펜">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><line x1="2" y1="11" x2="14" y2="5" stroke="rgba(255,235,70,0.95)" stroke-width="3.5" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    </div>`);
  if (isHlB) put('kind', `
    <div id="stk-hlb-doodle-section">
      <div class="prop-type-group prop-preset-group" id="stk-hlb-doodle-group">
        ${(window.DoodleLine?.STYLES || []).map(k => `<button class="prop-preset-btn${block.dataset.lineStyle === k ? ' active' : ''}" data-doodle="${k}" title="${_HLB_DOODLE_TITLE[k] || ''}">
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${_HLB_DOODLE_ICON[k] || ''}</svg><span>${window.DoodleLine.LABELS[k] || k}</span>
        </button>`).join('')}
      </div>
    </div>`);
  if (isText) put('kind', `
    <div id="stk-text-presets-section">
      <div class="prop-row">
        <select class="prop-select" id="stk-preset-select" style="flex:1;min-width:0;">
          <option value="">프리셋 선택...</option>
          ${TEXT_PRESETS.map((p, i) => `<option value="${i}">${_esc(p.name)}</option>`).join('')}
        </select>
      </div>
    </div>`);
  if (isIcon) {
    put('content', `
      <div class="prop-row">
        <button class="prop-action-btn secondary" id="stk-icon-replace" style="width:100%;">아이콘 교체</button>
      </div>`);
    put('position', `
      ${positionSectionHTML({ prefix: 'stk-icon', posEl: null, xy: false, rot: { p: 'stk-icon', numberId: 'stk-icon-rot-num', value: parseFloat(block.dataset.rotation) || 0, flipH: block.dataset.flipH === '1', flipV: block.dataset.flipV === '1' } })}`);
    put('size', layoutSizeRowHTML({ prefix: 'stk-icon', one: { id: 'stk-icon-size-num', label: 'Size', icon: 'px', min: 16, max: 600, value: parseInt(block.dataset.size) || 64 } }));   // ★표준 Layout(C2) — 옛 슬라이더 stk-icon-size 걷음 · 숫자 칸 id·범위 무변
    put('fill', `
      ${fillSectionHTML({ prefix: 'stk-icon-fill', removeWhy: '아이콘이 안 보이게 되는 길이라 지금은 못 지워요', colorHtml: colorFieldHTML({ idPrefix: 'stk-icon-color', hex: _stkIconShown, alpha: parseAlphaFromColor(_stkIconShown) }) })}
      <div class="prop-hint">SVG가 currentColor를 쓰는 아이콘만 색상이 반영됩니다.</div>`);
  }
  if (basic && !isCount) put('content', `
    <div id="stk-mode-section">
      <div class="prop-row">
        ${checkHTML({ id: 'stk-mode-img', label: '이미지 모드', checked: block.dataset.mode === 'image' })}   <!-- 현빈 261123 «온/오프 = 체크» -->
      </div>
    </div>
    <div id="stk-text-section" style="display:${block.dataset.mode === 'image' ? 'none' : 'block'};">
      <div class="prop-row">
        <textarea class="prop-textarea" id="stk-text" rows="2" placeholder="텍스트"></textarea>
      </div>
    </div>
    <div id="stk-image-section" style="display:${block.dataset.mode === 'image' ? 'block' : 'none'};">
      <div id="stk-img-drop" style="border:2px dashed #444;border-radius:6px;padding:18px 10px;text-align:center;color:#888;font-size:11px;cursor:pointer;background:#1a1a1a;transition:border-color .15s,background .15s;">
        ${block.dataset.imgSrc ? `<img src="${block.dataset.imgSrc}" style="max-width:80px;max-height:80px;object-fit:contain;display:block;margin:0 auto 6px;">` : ''}
        <div>이미지 드래그앤드롭<br>또는 클릭해서 선택</div>
      </div>
      ${block.dataset.imgSrc ? `<div class="prop-row"><button class="prop-action-btn" id="stk-img-clear" style="width:100%;">이미지 제거</button></div>` : ''}
    </div>`);
  if (isHl) {
    put('size', `
    <div id="stk-hl-section">${layoutSizeRowHTML({ prefix: 'stk-hl', chain: { on: ratioLockOn(block, false) },   /* ★표준 Layout(C2) — 옛 슬라이더 stk-hl-w/h 걷음 · 사슬 기본 끔 */
        w: { id: 'stk-hl-w-num', min: 10, max: 1200, value: parseInt(block.dataset.hlW) || 160 },
        h: { id: 'stk-hl-h-num', min: 4, max: 400, value: parseInt(block.dataset.hlH) || 28 } })}
    </div>`);
    put('fill', fillSectionHTML({ prefix: 'stk-hl-fill', removeWhy: '형광펜이 안 보이게 되는 길이라 지금은 못 지워요', colorHtml: colorFieldHTML({ idPrefix: 'stk-hl-color', hex: _stkHlShown, alpha: parseAlphaFromColor(_stkHlShown) }) }));
  }
  /* ★현빈 261123 — 선 형광펜(highlightB) = Stroke 절 «밖» Special «Highlight» 로 이사(선이 곧 몸 · 정본 시안 8910 strokestd2 20) · 몸 컨트롤·id·배선 그대로 · «두께» → «굵기»(이름 통일) */
  let _hlbSpecialHTML = '';
  if (isHlB) {
    _hlbSpecialHTML = `
    <div id="stk-hlb-section">
      <div class="prop-row">
        <span class="prop-label">스타일</span>
        <div class="prop-align-group" id="stk-hlb-style-group" style="flex:1;">
          <button class="prop-align-btn${(block.dataset.lineStyle || 'line') === 'line' ? ' active' : ''}" data-style="line" title="직선">
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none"><line x1="2" y1="7" x2="16" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <button class="prop-align-btn${block.dataset.lineStyle === 'wavy' ? ' active' : ''}" data-style="wavy" title="물결">
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none"><path d="M2,7 Q5,3 8,7 T14,7 T20,7" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>
          </button>
          <button class="prop-align-btn${block.dataset.lineStyle === 'marker' ? ' active' : ''}" data-style="marker" title="마커">
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none"><path d="M2,7 C6,5 12,9 16,7" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" fill="none"/></svg>
          </button>
        </div>
      </div>
      <div class="prop-row">
        <span class="prop-label">굵기</span>
        <input type="range" class="prop-slider" id="stk-hlb-thick" min="1" max="100" step="1" value="${parseInt(block.dataset.thickness) || 12}">
        <input type="number" class="prop-number" id="stk-hlb-thick-num" min="1" max="200" value="${parseInt(block.dataset.thickness) || 12}">
      </div>
      <div class="prop-row stk-hlb-amp-row" style="display:${_HLB_AMP_LABEL[block.dataset.lineStyle] ? 'flex' : 'none'};">
        <span class="prop-label" id="stk-hlb-amp-label">${_HLB_AMP_LABEL[block.dataset.lineStyle] || '진폭'}</span>
        <input type="range" class="prop-slider" id="stk-hlb-amp" min="1" max="30" step="1" value="${parseFloat(block.dataset.amplitude) || 6}">
        <input type="number" class="prop-number" id="stk-hlb-amp-num" min="1" max="60" value="${parseFloat(block.dataset.amplitude) || 6}">
      </div>
      <div class="prop-row stk-hlb-wavy-row" style="display:${block.dataset.lineStyle === 'wavy' ? 'flex' : 'none'};">
        <span class="prop-label">주기</span>
        <input type="range" class="prop-slider" id="stk-hlb-period" min="10" max="100" step="1" value="${parseFloat(block.dataset.period) || 30}">
        <input type="number" class="prop-number" id="stk-hlb-period-num" min="6" max="200" value="${parseFloat(block.dataset.period) || 30}">
      </div>
    </div>`;
    put('fill', fillSectionHTML({ prefix: 'stk-hlb-fill', removeWhy: '형광펜이 안 보이게 되는 길이라 지금은 못 지워요', colorHtml: colorFieldHTML({ idPrefix: 'stk-hlb-color', hex: _stkHlShown, alpha: parseAlphaFromColor(_stkHlShown) }) }));
  }
  if (basic) {
    if (!isCount) put('size', `
    <div id="stk-size-section">
      <div id="stk-size-row">${layoutSizeRowHTML({ prefix: 'stk', one: { id: 'stk-size-num', label: 'Size', icon: 'px', min: 10, max: 600, value: size } })}</div>
    </div>`);   // ★표준 Layout(C2) — 옛 슬라이더 stk-size 걷음 · 줄 id stk-size-row(시험이 보임 판정) 남김
    put('typography', _stkTypo({ sizeMin: 6, sizeMax: 150 }));   // 옛 stk-fs 쌍·stk-fw·stk-b-style-group 걷음 · 저장 키 fontSize/fontWeight/fontStyle/textDecoration 그대로
    put('fill', `
    <div id="stk-colors-section">
      <span class="prop-label">${isCountNone ? '숫자색' : '배경색'}</span>   <!-- 표준 Fill F5-2b — 이름표 지킴(카운트 «없음» 꼴이면 이 칸 = 숫자색 · 뜻이 바뀌어 이름이 필요 · count-sticker C6·C13) · 겹 줄 위 한 줄 -->
      ${fillSectionHTML({ prefix: 'stk-bg-fill', removeWhy: isCountNone ? '숫자가 안 보이게 되는 길이라 지금은 못 지워요' : '모양 스티커는 바탕이 곧 모양이라 지금은 못 지워요', colorHtml: colorFieldHTML({ idPrefix: 'stk-bg', hex: bgColor, alpha: bgAlpha }) })}
      <div class="prop-color-row" id="stk-txt-row" style="display:${isCountNone ? 'none' : 'flex'};">
        <span class="prop-label">글자색</span>
        ${colorFieldHTML({ idPrefix: 'stk-txt', hex: textColor, alpha: txtAlpha })}
      </div>
    </div>`);
  }
  if (isText) {
    put('typography', `
    <div id="stk-text-sticker-section">${_stkTypo({ sizeMin: 8, sizeMax: 400, showFont: true, showLetterSpacing: true })}
      <div class="prop-row">
        <span class="prop-label">정렬</span>
        <div class="prop-align-group" id="stk-t-align-group">
          <button class="prop-align-btn${tTextAlign === 'left' ? ' active' : ''}" data-align="left" title="왼쪽">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="10" y2="8"/><line x1="2" y1="12" x2="12" y2="12"/></svg>
          </button>
          <button class="prop-align-btn${tTextAlign === 'center' ? ' active' : ''}" data-align="center" title="가운데">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><line x1="2" y1="4" x2="14" y2="4"/><line x1="4" y1="8" x2="12" y2="8"/><line x1="3" y1="12" x2="13" y2="12"/></svg>
          </button>
          <button class="prop-align-btn${tTextAlign === 'right' ? ' active' : ''}" data-align="right" title="오른쪽">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><line x1="2" y1="4" x2="14" y2="4"/><line x1="6" y1="8" x2="14" y2="8"/><line x1="4" y1="12" x2="14" y2="12"/></svg>
          </button>
        </div>
      </div>
    </div>`);
    /* ★표준 Layout(C2 · §2-b) — 옛 체크 stk-t-boxw-on(박스 너비) → 너비 모드 드롭다운(고정/자동 · 이미 있는 모드만) · 옛 슬라이더 stk-t-boxw 걷음 · 높이 = 내용(자동) */
    put('size', layoutSizeRowHTML({ prefix: 'stk-t',
      w: { id: 'stk-t-boxw-num', min: 20, max: 2000, value: tBoxWVal, auto: !tBoxWOn },
      h: { id: 'stk-t-h-auto', max: 0, value: 0, auto: true },
      mode: { w: { id: 'stk-t-boxw-mode', value: tBoxWOn ? 'fixed' : 'auto', options: [['fixed', ...LAY_SIZING.fixed], ['auto', ...LAY_SIZING.hug]] } } }));
    put('fill', `
    <div id="stk-text-colors-section">
      ${fillSectionHTML({ prefix: 'stk-t-fill', hiddenWhy: '', hidden: fillHiddenOf(block), on: bgColor !== 'transparent', colorHtml: colorFieldHTML({ idPrefix: 'stk-t-bg', hex: (bgColor === 'transparent' ? '#ffffff' : bgColor), alpha: (bgColor === 'transparent' ? 0 : bgAlpha) }) })}
      <div class="prop-color-row">
        <span class="prop-label">글자색</span>
        ${colorFieldHTML({ idPrefix: 'stk-t-color', hex: textColor, alpha: txtAlpha })}
      </div>
    </div>`);   // 표준 Fill F5-2b — 글 스티커 = 표준 줄 배경(없음 = 'transparent' · 옛 «알파 0 = transparent» 값 그대로) · 글자색 = 부위 색 줄(시안 ④)
    /* ★표준 Stroke 부품(현빈 261123 · 8910 strokestd2 17) — 글자 외곽선 · 없음 = strokeWidth 0(렌더 sticker-block.js:283 «> 0 일 때만» · 옛 키 그대로) · 0.5 걸음(지디 261123)
       위치 = 바깥 막힘: 렌더가 -webkit-text-stroke 를 «두께×2» 로 긋고 paint-order:stroke fill 로 안쪽 절반을 글자 밑에 묻는다 = 보이는 건 바깥(sticker-block.js:280 실측 · 시안의 «안쪽»은 기본값 그림) */
    put('stroke', strokeSectionHTML({ prefix: 'stk-t-stk', pop: { why: STROKE_POP_WHY.soon, styleWhy: STROKE_POP_WHY.soon }, color: tStrokeColor, alpha: tStrokeAlpha, width: tStrokeWidth, maxWidth: 50, step: 0.5, align: 'outside', canAlign: false,
      alignWhy: '위치(안쪽·가운데·바깥) — 곧 지원 · 지금은 바깥', on: tStrokeWidth > 0, bodyId: 'stk-text-stroke-section', widthId: 'stk-t-stk-w-num', colorId: 'stk-t-stk-c' }));
    put('effects', `
      <div id="stk-t-shadow-detail">
        <div class="prop-row">
          <span class="prop-label">X</span>
          <input type="range" class="prop-slider" id="stk-t-sh-x" min="-20" max="20" step="1" value="${tShadowX}">
          <input type="number" class="prop-number" id="stk-t-sh-x-num" min="-20" max="20" step="1" value="${tShadowX}">
        </div>
        <div class="prop-row">
          <span class="prop-label">Y</span>
          <input type="range" class="prop-slider" id="stk-t-sh-y" min="-20" max="20" step="1" value="${tShadowY}">
          <input type="number" class="prop-number" id="stk-t-sh-y-num" min="-20" max="20" step="1" value="${tShadowY}">
        </div>
        <div class="prop-row">
          <span class="prop-label">Blur</span>
          <input type="range" class="prop-slider" id="stk-t-sh-b" min="0" max="40" step="1" value="${tShadowBlur}">
          <input type="number" class="prop-number" id="stk-t-sh-b-num" min="0" max="40" step="1" value="${tShadowBlur}">
        </div>
        <div class="prop-color-row">
          <span class="prop-label">색상</span>
          ${colorFieldHTML({ idPrefix: 'stk-t-sh-c', hex: tShadowColor, alpha: tShadowAlpha })}
        </div>
      </div>`);
    put('padding', `
    <div id="stk-text-pad-section">${layoutPadSlotHTML({ xId: 'stk-t-pad-x-num', yId: 'stk-t-pad-y-num', x: tPadX, y: tPadY, max: 400 })}
    </div>`);   // ★표준 Layout(C2) — 옛 슬라이더 stk-t-pad-x/y 걷음
    put('appearance', `
      ${appearanceSectionHTML({ prefix: 'stk-t', op: { value: window.readBlockOpacity?.(block) ?? 100 }, radius: { numberId: 'stk-t-radius-num', value: tCornerR, max: 400 } })}   <!-- ★표준 Appearance A3(현빈 261124 · 시안 #mkp-appstd) — 옛 슬라이더 걷음 · 숫자 칸 id·키·범위 무변 -->`);
    put('position', `
    <div id="stk-text-rot-section">
      ${positionSectionHTML({ prefix: 'stk-t', posEl: null, xy: false, rot: { p: 'stk-t', numberId: 'stk-t-rot-num', value: tRotation, flipH: block.dataset.flipH === '1', flipV: block.dataset.flipV === '1' } })}
    </div>`);
  }
  if (isGlow) put('effects', glowSectionHTML(block));
  const extra = isCount ? countSections(block) : isCoin ? coinSections(block) : isArrow ? arrowSections(block) : {};
  for (const [k, html] of Object.entries(extra)) if (k !== 'special') put(k, html);
  /* dev B2·B3(톱니 스탬프 · 인증마크) — U5 틀 위로 옮겨 심음: 블록 고유 절(special)로, 옛 절 id 는 sec id 로 남긴다(배선이 id 로 찾는다). */
  const _stkSpecials = [];
  if (_hlbSpecialHTML) _stkSpecials.push(sec('special', _hlbSpecialHTML, { title: 'Highlight' }));   // 선 형광펜 = Special «Highlight»(위 _hlbSpecialHTML 머리말)
  if (shape === 'burst' && !isCount) _stkSpecials.push(sec('special', `
      ${sliderRowHTML('톱니 수', 'stk-burst-teeth', 'stk-burst-teeth-num', { min: BURST_LIMITS.teeth.min, max: BURST_LIMITS.teeth.max, step: 1, value: clampBurst({ teeth: block.dataset.burstTeeth }).teeth })}
      ${sliderRowHTML('톱니 깊이 %', 'stk-burst-depth', 'stk-burst-depth-num', { min: BURST_LIMITS.depth.min, max: BURST_LIMITS.depth.max, step: 1, value: clampBurst({ depth: block.dataset.burstDepth }).depth })}
      ${sliderRowHTML('끝 둥글기 %', 'stk-burst-round', 'stk-burst-round-num', { min: ROUND_MIN, max: ROUND_MAX, step: 1, value: clampRound(block.dataset.burstRound) })}
      <div class="prop-row">
        ${checkHTML({ id: 'stk-burst-ring', label: '안쪽 링', checked: (block.dataset.burstRing ?? 'on') === 'on' })}
      </div>`, { title: 'Burst', id: 'stk-burst-section' }));
  if ((shape === 'circle' || shape === 'burst') && !isCount) _stkSpecials.push(sec('special', `
      <div class="prop-row"><span class="prop-label">둘레 글자</span><input type="text" class="prop-input" id="stk-ring-text" maxlength="80" value="${escHtml(block.dataset.ringText || '')}" placeholder="예: TEST COMPLETED" style="flex:1;min-width:0"></div>
      ${/* data-own: 인증마크 둘레 글자 크기 — 소유표 size 로 가지만 Mark 절의 한 몸(dev B3 · 둘레 글자 바로 아래) */ sliderRowHTML('둘레 글자 크기', 'stk-ring-size', 'stk-ring-size-num', { min: 5, max: 16, step: 1, value: Math.round(parseFloat(block.dataset.ringTextSize) || 9) }).replace('<div class="prop-row">', '<div class="prop-row" data-own="special:Mark">')}
      ${sliderRowHTML('테두리', 'stk-ring-bw', 'stk-ring-bw-num', { min: 0, max: 12, step: 1, value: Math.round(parseFloat(block.dataset.ringBorderW) || 0) })}
      <div class="prop-color-row" data-own="special:Mark">${/* data-own: 마크 테두리·둘레 글자 색 한 칸 — 별칭 bc→Stroke 로 가지만 Mark 절의 한 몸(dev B3) */ ''}<span class="prop-label">테두리·둘레색</span>${colorFieldHTML({ idPrefix: 'stk-ring-bc', hex: block.dataset.ringBorderColor || block.dataset.textColor || '#ffffff' })}</div>
      <div class="prop-row"><span class="prop-label">작은 줄</span><input type="text" class="prop-input" id="stk-sub-text" maxlength="60" value="${escHtml(block.dataset.subText || '')}" placeholder="예: COMPLETED" style="flex:1;min-width:0"></div>`, { title: 'Mark', id: 'stk-mark-section' }));
  if (!isText) put('appearance', appearanceSectionHTML({ prefix: 'stk', op: { value: window.readBlockOpacity?.(block) ?? 100 } }));   // ★표준 Appearance A4(C2) — 글 밖 모양 = Opacity 만(모서리 없음)
  const KEYS = ['kind', 'content', 'position', 'size', 'padding', 'appearance', 'typography', 'fill', 'stroke', 'effects'];
  const OPTS = {
    kind: { id: 'stk-fav-section', headTools: `
        <button class="prop-action-btn" id="stk-fav-add" title="현재 스티커 스타일을 즐겨찾기에 추가"
          style="width:auto;padding:2px 8px;font-size:11px;${FAV_ALLOWED_SHAPES.includes(shape) ? '' : 'opacity:0.4;cursor:not-allowed;'}">★ 추가</button>` },
    position: (isText || isIcon) ? { headTools: positionHeadToolsHTML({ prefix: isText ? 'stk-t' : 'stk-icon' }) } : {},   // 표준 Position P3 — 머리 [슬라이드](IAL 없음 · 옛도 없음)
    stroke: isText ? { headTools: strokeHeadToolsHTML({ prefix: 'stk-t-stk', on: tStrokeWidth > 0 }) } : {},
    effects: isText ? { id: 'stk-text-shadow-section', headTools: `
        ${checkHTML({ id: 'stk-t-shadow-on', label: '켜기', checked: tShadowOn, attrs: 'aria-label="그림자 켜기"' })}` } : {},   /* ②ⓒ(현빈 261123) — 이름 없이 홀로 선 켬/끔 = 체크 + 옆에 «켜기» 글 */
    appearance: { headTools: appearanceHeadToolsHTML({ prefix: isText ? 'stk-t' : 'stk' }) },   // 표준 Appearance A3 — 글 스티커만(머리 눈 = 7-2 보류 표식)
  };
  if (isText) OPTS.fill = { headTools: fillHeadToolsHTML({ prefix: 'stk-t-fill', on: bgColor !== 'transparent' }) };   // 표준 Fill F5-2b — 글 스티커 배경 없음이면 머리 ＋ (OPTS 밖 한 줄 = dev 효과 머리 체크 이관 줄과 안 겹침)
  renderPanel(block, {
    header: blockHeaderHTML({
      icon: `          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3"><circle cx="6" cy="6" r="4.5"/></svg>`,
      name: block.dataset.layerName,
      defaultName: isCount ? 'Marking' : 'Sticker',   // 1013t2B1 — 마킹 블럭(data-count)은 자기 이름으로. data-layer-name 이 있으면 그것이 이긴다
      crumb: window.getBlockBreadcrumb?.(block) || '',
      id: block.id,
    }),
    sections: [
      ...KEYS.map((k) => sec(k, P[k], OPTS[k])),
      ...(extra.special || []).map(([title, html, o]) => sec('special', html, { title, ...o })),
      ..._stkSpecials,
    ],
  });

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  const rerender = () => { window.renderStickerBlock?.(block); window.rememberStickerStyle?.(block); };
  /* 마킹 블럭의 섹션 일괄(1013t2B3) — 「섹션 전체」 스위치가 켜져 있으면 방금 쓴 키를 같은 섹션의 다른 마킹에 베낀다.
     일반 스티커(isCount 거짓)에서는 아무것도 안 한다. 히스토리는 아래 기존 change·onCommit 이 한 번 찍는다. */
  const syncGroup = (keys) => { if (isCount) syncCountGroup(block, keys); };
  // 선 형광펜 진폭·주기 칸 — 갈래별 노출·라벨(1012t1J2)
  const _syncHlbRows = (style) => {
    const lbl = _HLB_AMP_LABEL[style];
    propPanel.querySelectorAll('.stk-hlb-amp-row').forEach(row => { row.style.display = lbl ? 'flex' : 'none'; });
    const lab = propPanel.querySelector('#stk-hlb-amp-label');
    if (lab && lbl) lab.textContent = lbl;
    propPanel.querySelectorAll('.stk-hlb-wavy-row').forEach(row => { row.style.display = style === 'wavy' ? 'flex' : 'none'; });
  };
  if (isGlow) wireGlowSection(propPanel, block, rerender);
  if (isCount) wireCountSection(propPanel, block, rerender);
  if (isCoin) wireCoinSection(propPanel, block, rerender);
  if (isArrow) wireArrowSection(propPanel, block, rerender);

  // 텍스트 — textarea(멀티라인, \n 보존). input에선 .sticker-text textContent만 직접 갱신(rerender 시 캐럿 보존 X)
  //   초깃값은 HTML 본문 주입 대신 value 할당 — <input type=text>의 \n strip 함정 회피 +
  //   textarea 본문 주입 시 선두 개행 소실/이스케이프 함정도 회피.
  const txt = propPanel.querySelector('#stk-text');
  if (txt) {   // ★U5: 글자 칸은 원·사각(비마킹)에만 그린다 — 다른 모양엔 없다
    txt.value = text;
    txt.addEventListener('keydown', ev => {
      // 멀티라인은 text shape 전용 — circle/square 등은 Enter=커밋(인라인 편집과 동일 규칙, 개행 미주입)
      if (ev.key === 'Enter' && block.dataset.shape !== 'text') { ev.preventDefault(); txt.blur(); }
    });
    txt.addEventListener('input', () => {
      block.dataset.text = txt.value;
      // [v0.8 #6b] 패널 텍스트박스로 «평문» 편집 시 리치텍스트(dataset.textHtml)를 지운다 —
      //   안 지우면 다음 renderStickerBlock(리로드·리사이즈)에서 stale textHtml이 되살아나 이 편집을 shadow(U6b 지적).
      delete block.dataset.textHtml;
      const t = block.querySelector('.sticker-text');
      if (t) t.textContent = txt.value;
    });
    txt.addEventListener('change', () => { window.pushHistory?.('스티커 텍스트'); window.scheduleAutoSave?.(); });
  }

  /* ── 표준 Typography 배선(p 'stk-typo' · 기본·텍스트 갈래 공용) — 쓰기·이력 이름은 옛 칸들 그대로 · 카운트 무리 동기(syncGroup) 그대로 ── */
  {
    const _set = (patch) => { Object.assign(block.dataset, patch); rerender(); syncGroup(Object.keys(patch)); };
    const _commit = (label) => { window.pushHistory?.(label); window.scheduleAutoSave?.(); };
    const _q = (id) => propPanel.querySelector('#stk-typo-' + id);
    if (isText) wireFontPicker({ root: propPanel, p: 'stk-typo', getCurrent: () => block.dataset.fontFamily || '',
      onPick: (v) => { _set({ fontFamily: v }); _commit('텍스트 스티커 폰트'); } });
    const _fw = _q('font-weight');
    const _wLabel = isText ? '텍스트 스티커 굵기' : '스티커 굵기';
    _fw?.addEventListener('change', () => { _set({ fontWeight: _fw.value }); _q('bold-btn')?.classList.toggle('active', +_fw.value >= 700); _commit(_wLabel); });
    /* 숫자칸 — input = 바로 그림(화살표 스텝·Enter 합성 input — prop-number-commit-guard.js) · change = 이력 한 번 */
    const _num = (id, key, min, max, parse) => {
      const n = _q(id); if (!n) return;
      const apply = () => { const v = parse(n.value); if (Number.isFinite(v)) _set({ [key]: String(Math.min(max, Math.max(min, v))) }); };
      n.addEventListener('input', apply);
      n.addEventListener('change', () => { apply(); _commit(); });   // 옛 숫자칸 꼴: change 도 값을 먹인다
    };
    _num('size-number', 'fontSize', isText ? 8 : 6, isText ? 400 : 150, parseInt);
    _num('ls-number', 'letterSpacing', -10, 40, parseFloat);
    /* B = 굵기 700/400(굵기 select 와 같은 키) · I/U/S = 옛 스타일 그룹과 같은 쓰기 */
    const _b = _q('bold-btn');
    _b?.addEventListener('click', () => {
      const w = _b.classList.toggle('active') ? '700' : '400';
      if (_fw) _fw.value = w;
      _set({ fontWeight: w }); _commit(_wLabel);
    });
    const _on = (k) => !!_q(k + '-btn')?.classList.contains('active');
    ['italic', 'underline', 'strike'].forEach(k => _q(k + '-btn')?.addEventListener('click', () => {
      _q(k + '-btn').classList.toggle('active');
      const decos = [_on('underline') && 'underline', _on('strike') && 'line-through'].filter(Boolean);
      _set({ fontStyle: _on('italic') ? 'italic' : 'normal', textDecoration: decos.length ? decos.join(' ') : 'none' });
      _commit('스티커 스타일');
    }));
  }
  // 텍스트 스티커 — 폰트 사이즈
  const _bindTPair = (sliderId, numberId, key, min, max, step) => {
    const s = propPanel.querySelector('#' + sliderId);
    const n = propPanel.querySelector('#' + numberId);
    if (!n) return;   // Q20(시안 v10) — 회전은 슬라이더 없이 각도 칸만 온다
    const stepNum = step || 1;
    const apply = v => {
      v = Math.min(max, Math.max(min, v));
      block.dataset[key] = v;
      rerender();
      if (s) s.value = String(Math.min(parseFloat(s.max), Math.max(parseFloat(s.min), v)));
      n.value = String(v);
    };
    const parse = v => (stepNum < 1 ? parseFloat(v) : parseInt(v));
    s?.addEventListener('input',  () => apply(parse(s.value)));
    n.addEventListener('change', () => { apply(parse(n.value)); window.pushHistory?.(); window.scheduleAutoSave?.(); });
    s?.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
  };
  _bindTPair('stk-t-sh-x',  'stk-t-sh-x-num',  'shadowX',       -20,  20,  1);
  _bindTPair('stk-t-sh-y',  'stk-t-sh-y-num',  'shadowY',       -20,  20,  1);
  _bindTPair('stk-t-sh-b',  'stk-t-sh-b-num',  'shadowBlur',    0,    40,  1);
  _bindTPair('stk-t-rot',   'stk-t-rot-num',   'rotation',      -180, 180, 1);
  wireRotRow({ p: 'stk-t', numberId: 'stk-t-rot-num', host: () => block });   // Q17 · Q20(시안 v10)
  wirePositionSection({ prefix: 'stk-t', numberId: 'stk-t-rot-num', rerender: () => showStickerProperties(block) });
  /* ★표준 Layout(C2) — 칸 배선은 부품(input = 범위 안이면 바로 · change = 잘라 + 이력 한 번 · 빈 칸 = 옛 값 · 라벨 끌기) · 키·범위 무변 */
  wireLayoutSection({ w: { numberId: 'stk-t-pad-x-num', max: 400, apply: (v) => { block.dataset.padX = v; rerender(); } } });
  wireLayoutSection({ w: { numberId: 'stk-t-pad-y-num', max: 400, apply: (v) => { block.dataset.padY = v; rerender(); } } });
  wireAppearanceSection({ op: { numberId: 'stk-t-opacity', apply: (v) => window.setBlockOpacity?.(block, v) }, radius: { numberId: 'stk-t-radius-num', max: 400, apply: (v) => { block.dataset.cornerRadius = v; rerender(); } } });   // 표준 Appearance A3 — 옛 _bindTPair(stk-t-radius) 자리(슬라이더 걷음 · 0~400 · change = 이력 + 저장 같음)
  wireLayoutSection({ w: { numberId: 'stk-t-boxw-num', min: 20, max: 2000, apply: (v) => { block.dataset.boxW = v; rerender(); } } });

  // 박스 너비 모드(옛 체크 stk-t-boxw-on 과 같은 길) — 자동 = boxW 'auto'(내용맞춤) · 고정 = px.
  //   고정 전환 시 현재 렌더 폭(offsetWidth, 줌 미영향)으로 seed → 패널을 다시 그려 너비 칸을 연다.
  propPanel.querySelector('#stk-t-boxw-mode')?.addEventListener('change', e => {
    if (e.target.value === 'fixed') {
      let w = parseInt(block.dataset.boxW);
      if (!Number.isFinite(w) || w <= 0) w = Math.round(block.offsetWidth) || 200;
      block.dataset.boxW = String(Math.min(2000, Math.max(20, w)));
    } else {
      block.dataset.boxW = 'auto';
    }
    rerender();
    window.pushHistory?.('텍스트 스티커 박스 너비'); window.scheduleAutoSave?.();
    showStickerProperties(block);
  });

  // 텍스트 스티커 — 정렬
  propPanel.querySelectorAll('#stk-t-align-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      propPanel.querySelectorAll('#stk-t-align-group .prop-align-btn').forEach(b => b.classList.toggle('active', b === btn));
      block.dataset.textAlign = btn.dataset.align;
      rerender();
      window.pushHistory?.('텍스트 스티커 정렬'); window.scheduleAutoSave?.();
    });
  });

  // 텍스트 스티커 — 글자색
  wireColorField('stk-t-color', {
    initialAlpha: txtAlpha,
    onApply: (c) => { block.dataset.textColor = c; rerender(); },
    onCommit: () => { window.pushHistory?.('텍스트 스티커 글자색'); window.scheduleAutoSave?.(); },
  });
  // 텍스트 스티커 — 배경색 (alpha 0이면 transparent 저장)
  wireColorField('stk-t-bg', {
    initialAlpha: (bgColor === 'transparent' ? 0 : bgAlpha),
    onApply: (c) => {
      // 알파 0이거나 'rgba(...,0)' 패턴은 transparent로 저장 (renderer에서 깔끔하게 처리)
      const isFullyTransparent = /rgba?\([^)]*?,\s*0\s*\)/.test(c) || /,\s*0\s*\)/.test(c);
      block.dataset.bgColor = isFullyTransparent ? 'transparent' : c;
      rerender();
    },
    onCommit: () => { window.pushHistory?.('텍스트 스티커 배경'); window.scheduleAutoSave?.(); },
  });
  /* 표준 Fill F5-2b — 글 스티커 배경 − = 'transparent'(옛 «알파 0» 이 저장하던 값) · ＋ = 지난 색 · 없으면 #FFFFFF */
  if (isText) wireFillSection({ prefix: 'stk-t-fill', adapter: {
    hide: (on) => { setFillHiddenKey(block, on); rerender(); window.scheduleAutoSave?.(); },   // F6-2 숨김 — 키만 바꾸고 다시 그림(렌더러가 키를 보고 칠 안 함)
    none: () => { fillLast.set(block.id, bgColor); block.dataset.bgColor = 'transparent'; rerender(); showStickerProperties(block); },
    add: () => { block.dataset.bgColor = fillLast.get(block.id, '#ffffff'); rerender(); showStickerProperties(block); },
    commit: () => { window.pushHistory?.('텍스트 스티커 배경'); window.scheduleAutoSave?.(); } } });
  // 텍스트 스티커 — 외곽선(표준 Stroke 부품 · 어댑터 = 옛 쓰기 그대로: dataset.strokeWidth/strokeColor · rerender · 이력 이름 «텍스트 스티커 외곽선»)
  if (propPanel.querySelector('#stk-t-stk-w-num')) wireStrokeSection({ prefix: 'stk-t-stk', alpha: tStrokeAlpha, maxWidth: 50, step: 0.5, widthId: 'stk-t-stk-w-num', colorId: 'stk-t-stk-c', onWidth: 2,
    adapter: { color: (c) => { block.dataset.strokeColor = c; rerender(); }, width: (v) => { block.dataset.strokeWidth = v; rerender(); }, commit: () => { window.pushHistory?.('텍스트 스티커 외곽선'); window.scheduleAutoSave?.(); } } });
  // 텍스트 스티커 — 그림자 on/off + 그림자 색
  propPanel.querySelector('#stk-t-shadow-on')?.addEventListener('change', e => {
    block.dataset.shadowOn = e.target.checked ? '1' : '0';
    rerender();
    window.pushHistory?.('텍스트 스티커 그림자'); window.scheduleAutoSave?.();
  });
  wireColorField('stk-t-sh-c', {
    initialAlpha: tShadowAlpha,
    onApply: (c) => { block.dataset.shadowColor = c; rerender(); },
    onCommit: () => { window.pushHistory?.('텍스트 스티커 그림자색'); window.scheduleAutoSave?.(); },
  });

  // Mode 체크박스 (이미지 모드 on/off)
  propPanel.querySelector('#stk-mode-img')?.addEventListener('change', e => {
    block.dataset.mode = e.target.checked ? 'image' : 'text';
    propPanel.querySelector('#stk-text-section').style.display  = e.target.checked ? 'none' : 'block';
    propPanel.querySelector('#stk-image-section').style.display = e.target.checked ? 'block' : 'none';
    rerender();
    window.pushHistory?.('스티커 모드'); window.scheduleAutoSave?.();
  });

  // 이미지 처리 헬퍼 (파일 → dataURL → block 적용)
  const _applyImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { window.showToast?.('⚠️ 5MB 이하 이미지만 지원'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      block.dataset.imgSrc = e.target.result;
      block.dataset.mode = 'image';
      rerender();
      window.pushHistory?.('스티커 이미지'); window.scheduleAutoSave?.();
      showStickerProperties(block); // 패널 재렌더 (썸네일 + 제거 버튼)
    };
    reader.readAsDataURL(file);
  };

  // 드롭존: 클릭 → 파일 선택 / 드래그앤드롭
  const drop = propPanel.querySelector('#stk-img-drop');
  if (drop) {
    drop.addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.onchange = () => _applyImageFile(inp.files?.[0]);
      inp.click();
    });
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation();
      drop.style.borderColor = '#5a8aff';
      drop.style.background  = '#1a2540';
    }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation();
      drop.style.borderColor = '#444';
      drop.style.background  = '#1a1a1a';
    }));
    drop.addEventListener('drop', e => {
      _applyImageFile(e.dataTransfer?.files?.[0]);
    });
  }

  propPanel.querySelector('#stk-img-clear')?.addEventListener('click', () => {
    delete block.dataset.imgSrc;
    block.dataset.mode = 'text';
    rerender();
    window.pushHistory?.('스티커 이미지 제거'); window.scheduleAutoSave?.();
    showStickerProperties(block);
  });

  // Shape 토글
  propPanel.querySelectorAll('#stk-shape-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      propPanel.querySelectorAll('#stk-shape-group .prop-align-btn').forEach(b => b.classList.toggle('active', b === btn));
      const newShape = btn.dataset.shape;
      const prevShape = block.dataset.shape;
      block.dataset.shape = newShape;
      const _isHl  = newShape === 'highlight';
      const _isHlB = newShape === 'highlightB';
      const _isTxt = newShape === 'text';

      // 'text' shape으로 전환 시 텍스트 스티커 dataset 초기화 (없으면)
      if (_isTxt) {
        if (!block.dataset.fontFamily)    block.dataset.fontFamily    = "'Pretendard', sans-serif";
        if (!block.dataset.fontSize || parseInt(block.dataset.fontSize) < 8) block.dataset.fontSize = 32;
        if (!block.dataset.fontWeight)    block.dataset.fontWeight    = 700;
        if (block.dataset.fontStyle      === undefined) block.dataset.fontStyle      = 'normal';
        if (block.dataset.textDecoration === undefined) block.dataset.textDecoration = 'none';
        if (!block.dataset.textColor)     block.dataset.textColor     = '#222222';
        if (block.dataset.strokeWidth   === undefined) block.dataset.strokeWidth   = 0;
        if (!block.dataset.strokeColor)   block.dataset.strokeColor   = '#ffffff';
        if (block.dataset.letterSpacing === undefined) block.dataset.letterSpacing = 0;
        if (!block.dataset.textAlign)     block.dataset.textAlign     = 'left';
        if (!block.dataset.shadowOn)      block.dataset.shadowOn      = '0';
        if (block.dataset.shadowX === undefined) block.dataset.shadowX = 0;
        if (block.dataset.shadowY === undefined) block.dataset.shadowY = 2;
        if (block.dataset.shadowBlur === undefined) block.dataset.shadowBlur = 4;
        if (!block.dataset.shadowColor)   block.dataset.shadowColor   = 'rgba(0,0,0,0.4)';
        if (!block.dataset.bgColor || block.dataset.bgColor === '#e74c3c') block.dataset.bgColor = 'transparent';
        if (block.dataset.rotation === undefined) block.dataset.rotation = 0;
        if (!block.dataset.text || block.dataset.text === 'NEW') block.dataset.text = 'Text';
      }
      // text에서 다른 shape으로 갈 때 — text 잔존 transform 제거
      if (prevShape === 'text' && !_isTxt) {
        block.style.removeProperty('transform');
        block.style.removeProperty('transform-origin');
      }

      // highlightB로 전환 시 dataset 초기화 (없으면)
      if (_isHlB && !block.dataset.x1) {
        const baseX = parseInt(block.dataset.x) || 40;
        const baseY = parseInt(block.dataset.y) || 40;
        block.dataset.x1 = baseX;
        block.dataset.y1 = baseY + 20;
        block.dataset.x2 = baseX + 160;
        block.dataset.y2 = baseY + 20;
        block.dataset.thickness = block.dataset.thickness || 12;
        block.dataset.hlColor   = block.dataset.hlColor   || 'rgba(255, 235, 70, 0.7)';
        window._syncLineStickerPos?.(block);   // ★W2D-06d — 끝점을 새로 박았으니 자리도 같은 식으로
      }
      // B2 — 톱니로 갈 때 기본 톱니 값(절은 아래 통째 다시 그리기가 낸다)
      if (newShape === 'burst') {
        if (block.dataset.burstTeeth === undefined) block.dataset.burstTeeth = String(BURST_DEFAULTS.teeth);
        if (block.dataset.burstDepth === undefined) block.dataset.burstDepth = String(BURST_DEFAULTS.depth);
        if (block.dataset.burstRing === undefined) block.dataset.burstRing = BURST_DEFAULTS.ring;
      }
      rerender();
      window.pushHistory?.('스티커 모양'); window.scheduleAutoSave?.();
      // ★U5: 모양마다 절 구성이 다르다(빈 절은 프레임이 안 그린다) — 단순 표시 토글 대신 패널을 통째로 다시 그린다
      showStickerProperties(block);
    });
  });

  wireLayoutSection({   // ★표준 Layout(C2) — 옛 bindHlPair(슬라이더) 자리 · 키·범위 무변 · 사슬 = dataset.ratioLock(기본 끔)
    w: { numberId: 'stk-hl-w-num', min: 10, max: 1200, apply: (v) => { block.dataset.hlW = v; rerender(); }, read: () => parseInt(block.dataset.hlW) || 160 },
    h: { numberId: 'stk-hl-h-num', min: 4, max: 400, apply: (v) => { block.dataset.hlH = v; rerender(); }, read: () => parseInt(block.dataset.hlH) || 28 },
    chain: { id: 'stk-hl-ratio', on: ratioLockOn(block, false), set: (on) => setRatioLock(block, on, false) } });

  // Highlight color (alpha 70% default)
  wireColorField('stk-hl-color', {
    initialAlpha: parseAlphaFromColor(_stkHlShown),   // 묶음 B — 칸이 보인 투명도와 같게
    onApply: (c) => { block.dataset.hlColor = c; rerender(); },
    onCommit: () => { window.pushHistory?.('형광펜 색'); window.scheduleAutoSave?.(); },
  });

  // HighlightB — 두께 슬라이더
  const bindHlbThick = () => {
    const s = propPanel.querySelector('#stk-hlb-thick');
    const n = propPanel.querySelector('#stk-hlb-thick-num');
    if (!s || !n) return;
    const apply = v => {
      v = Math.min(200, Math.max(1, v));
      block.dataset.thickness = v;
      window._syncLineStickerPos?.(block);   // ★W2D-06d — 두께 보정
      rerender();
      s.value = Math.min(parseInt(s.max), v);
      n.value = v;
    };
    s.addEventListener('input',  () => apply(parseInt(s.value)));
    n.addEventListener('change', () => { apply(parseInt(n.value)); window.pushHistory?.('선 형광펜 두께'); window.scheduleAutoSave?.(); });
    s.addEventListener('change', () => { window.pushHistory?.('선 형광펜 두께'); window.scheduleAutoSave?.(); });
  };
  bindHlbThick();

  // HighlightB — 스타일 토글 (line/wavy/marker)
  propPanel.querySelectorAll('#stk-hlb-style-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      propPanel.querySelectorAll('#stk-hlb-style-group .prop-align-btn').forEach(b => b.classList.toggle('active', b === btn));
      const style = btn.dataset.style;
      block.dataset.lineStyle = style;
      // 진폭(wavy·circle·double)·주기(wavy) 칸 표시 · 두들 칩은 비활성(스타일은 한 가지만 골라져 있다)
      _syncHlbRows(style);
      propPanel.querySelectorAll('#stk-hlb-doodle-group .prop-preset-btn').forEach(b => b.classList.remove('active'));
      rerender();
      // 선택 상태면 핸들 위치 재계산 (bbox가 바뀌므로)
      if (block.classList.contains('selected')) window._addHlbHandles?.(block);
      window.pushHistory?.('선 형광펜 스타일');
      window.scheduleAutoSave?.();
    });
  });

  /* ★1012t1J2 두들 프리셋 칩 — 모양·두께·색(+높이/간격)을 «한 묶음»으로 깐다(가정 A3 · 글로우 종류 선례).
     push-after(이웃 패널 규약) · 패널을 다시 그려 두께·색 칸과 활성 표시를 맞춘다(text 프리셋 선례). */
  propPanel.querySelectorAll('#stk-hlb-doodle-group .prop-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pre = window.DoodleLine?.PRESETS?.[btn.dataset.doodle];
      if (!pre) return;
      for (const [k, v] of Object.entries(pre)) block.dataset[k] = String(v);
      if (!(parseInt(block.dataset.seed, 10) > 0)) block.dataset.seed = String(window.FxSeed ? window.FxSeed.newSeed() : 1);
      rerender();
      if (block.classList.contains('selected')) window._addHlbHandles?.(block);
      window.pushHistory?.('선 형광펜 두들');
      window.scheduleAutoSave?.();
      showStickerProperties(block);
    });
  });

  // HighlightB — 진폭/주기 슬라이더
  const bindHlbPair = (sliderId, numId, key, min, max, label) => {
    const s = propPanel.querySelector('#' + sliderId);
    const n = propPanel.querySelector('#' + numId);
    if (!s || !n) return;
    const apply = v => {
      v = Math.min(max, Math.max(min, v));
      block.dataset[key] = v;
      rerender();
      if (block.classList.contains('selected')) window._addHlbHandles?.(block);
      s.value = Math.min(parseInt(s.max), v);
      n.value = v;
    };
    s.addEventListener('input',  () => apply(parseFloat(s.value)));
    n.addEventListener('change', () => { apply(parseFloat(n.value)); window.pushHistory?.(label); window.scheduleAutoSave?.(); });
    s.addEventListener('change', () => { window.pushHistory?.(label); window.scheduleAutoSave?.(); });
  };
  bindHlbPair('stk-hlb-amp',    'stk-hlb-amp-num',    'amplitude', 1,  60,  '선 형광펜 진폭');
  bindHlbPair('stk-hlb-period', 'stk-hlb-period-num', 'period',    6,  200, '선 형광펜 주기');

  // HighlightB color
  wireColorField('stk-hlb-color', {
    initialAlpha: parseAlphaFromColor(_stkHlShown),   // 묶음 B — 칸이 보인 투명도와 같게
    onApply: (c) => { block.dataset.hlColor = c; rerender(); },
    onCommit: () => { window.pushHistory?.('선 형광펜 색'); window.scheduleAutoSave?.(); },
  });

  // Size pair
  /* ★표준 Layout(C2) — 옛 bindNumPair('stk-size') 자리(한 칸) · sizeW/sizeH 를 같은 값으로 덮는 몫 그대로(코너 리사이즈가 박은 값보다 이 칸이 이긴다) */
  wireLayoutSection({ w: { numberId: 'stk-size-num', min: 10, max: 600, apply: (v) => {
    block.dataset.size = v; block.dataset.sizeW = v; block.dataset.sizeH = v; rerender(); syncGroup(['size', 'sizeW', 'sizeH']);
  } } });

  // Colors
  wireColorField('stk-bg', {
    initialAlpha: bgAlpha,
    onApply: (c) => { block.dataset.bgColor = c; rerender(); syncGroup(['bgColor']); },
    onCommit: () => { window.pushHistory?.('스티커 배경'); window.scheduleAutoSave?.(); },
  });
  wireColorField('stk-txt', {
    initialAlpha: txtAlpha,
    onApply: (c) => { block.dataset.textColor = c; rerender(); syncGroup(['textColor']); },
    onCommit: () => { window.pushHistory?.('스티커 글자색'); window.scheduleAutoSave?.(); },
  });

  // ── U6(c): Favorites 그리드 렌더 + 이벤트 ──────────────────────────────────
  const _renderFavGrid = () => {
    const grid = propPanel.querySelector('#stk-fav-grid');
    if (!grid) return;
    const favs = listStickerFavorites();
    if (!favs.length) {
      grid.innerHTML = `<div class="stk-fav-empty">아직 즐겨찾기가 없습니다. ★ 추가를 눌러 현재 스타일을 저장하세요.</div>`;
      return;
    }
    grid.innerHTML = favs.map((p, i) => {
      const pv = _favSwatchPreview(p);
      const inner = pv.svg
        ? `<span style="width:18px;height:18px;display:flex;align-items:center;justify-content:center;color:${pv.color || 'inherit'};" class="stk-fav-icon"></span>`
        : (pv.label || '');
      return `<button class="stk-fav-swatch" data-fav-idx="${i}" type="button" title="${_esc(p.shape)} 스티커 추가"`
        + ` style="background:${pv.bg};color:${pv.color || '#fff'};">`
        + `${inner}<span class="stk-fav-del" data-fav-del="${i}" title="삭제">×</span></button>`;
    }).join('');
    // svg preview 주입 (innerHTML로 한 번에 못 넣음 — 따옴표 escape 회피)
    grid.querySelectorAll('.stk-fav-swatch').forEach((sw, i) => {
      const p = favs[i];
      if (p && p.shape === 'icon' && p.iconSvg) {
        const holder = sw.querySelector('.stk-fav-icon');
        if (holder) {
          holder.innerHTML = sanitizeIconMarkup(p.iconSvg);   // ★즐겨찾기(localStorage)의 svg — 그릴 때 거른다(SEC 261114)
          const svg = holder.querySelector('svg');
          if (svg) { svg.setAttribute('width', 18); svg.setAttribute('height', 18); svg.style.pointerEvents = 'none'; }
        }
      }
    });
    grid.querySelectorAll('.stk-fav-swatch').forEach(sw => {
      sw.addEventListener('click', (e) => {
        if (e.target.closest('.stk-fav-del')) return; // 삭제 버튼은 별도 처리
        const idx = parseInt(sw.dataset.favIdx);
        const preset = listStickerFavorites()[idx];
        if (preset) window.addStickerBlock?.({ ...preset });
      });
    });
    grid.querySelectorAll('.stk-fav-del').forEach(del => {
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        removeStickerFavorite(parseInt(del.dataset.favDel));
        _renderFavGrid();
      });
    });
  };
  // 데이터 변경 통지 구독용 활성 리렌더러로 등록 (모달·패널 삭제 양방향 동기화)
  _activePanelFavRerender = _renderFavGrid;
  _renderFavGrid();

  propPanel.querySelector('#stk-fav-add')?.addEventListener('click', () => {
    if (addStickerFavorite(block)) {
      window.showToast?.('★ 즐겨찾기에 추가됨');
      _renderFavGrid();
    }
  });

  // ── U6(d): Text Presets — text 내용 보존하고 스타일만 일괄 적용 (그리드→드롭다운) ──
  propPanel.querySelector('#stk-preset-select')?.addEventListener('change', e => {
    const preset = TEXT_PRESETS[parseInt(e.target.value)];
    if (!preset) return;
    // text 내용(dataset.text)은 건드리지 않음 — 스타일 토큰만 덮어씀
    Object.entries(preset.style).forEach(([k, v]) => { block.dataset[k] = v; });
    rerender();
    window.pushHistory?.('텍스트 스티커 프리셋');
    window.scheduleAutoSave?.();
    showStickerProperties(block); // 패널 재렌더 (슬라이더/색상 동기화)
  });

  // ── U6(e): Icon 섹션 — 교체 / 크기 / 회전 / 색상 ──────────────────────────────
  propPanel.querySelector('#stk-icon-replace')?.addEventListener('click', () => {
    window.openIconifyModal?.((p) => {
      block.dataset.iconName = p.name || '';
      block.dataset.iconSvg  = p.svg  || '';
      if (p.size) block.dataset.size = String(p.size);
      // 즐겨찾기 픽(iconColor 정의됨)일 때만 색 적용 — 일반 교체는 '아이콘만 교체' 유지
      if (p.iconColor !== undefined && p.iconColor !== '') block.dataset.iconColor = p.iconColor;
      rerender();
      window.pushHistory?.('아이콘 스티커 교체');
      window.scheduleAutoSave?.();
      showStickerProperties(block);
    }, { favorites: true }); // 스티커 경로 = iconColor 소비 가능 → Favorite 탭 노출
  });
  // icon size / rotation — _bindTPair 패턴 재사용 (rerender 기반)
  wireAppearanceSection({ op: { numberId: 'stk-opacity', apply: (v) => window.setBlockOpacity?.(block, v) } });   // ★표준 Appearance A4(C2) — 글 밖 모양(칸 없으면 아무것도 안 함)
  wireLayoutSection({ w: { numberId: 'stk-icon-size-num', min: 16, max: 600, apply: (v) => { block.dataset.size = v; rerender(); } } });   // ★표준 Layout(C2) — 옛 _bindTPair(stk-icon-size) 자리
  _bindTPair('stk-icon-rot',  'stk-icon-rot-num',  'rotation', -180, 180, 1);
  wireRotRow({ p: 'stk-icon', numberId: 'stk-icon-rot-num', host: () => block });   // Q17 · Q20(시안 v10)
  wirePositionSection({ prefix: 'stk-icon', numberId: 'stk-icon-rot-num', rerender: () => showStickerProperties(block) });
  // B2 — 톱니 스탬프
  _bindTPair('stk-burst-teeth', 'stk-burst-teeth-num', 'burstTeeth', BURST_LIMITS.teeth.min, BURST_LIMITS.teeth.max, 1);
  _bindTPair('stk-burst-depth', 'stk-burst-depth-num', 'burstDepth', BURST_LIMITS.depth.min, BURST_LIMITS.depth.max, 1);
  _bindTPair('stk-burst-round', 'stk-burst-round-num', 'burstRound', ROUND_MIN, ROUND_MAX, 1);   // 현빈 QA 261116 «너무 뾰족 — 곡률»
  // B3 — 인증마크(둘레 글자·테두리·작은 줄)
  for (const [id, key] of [['stk-ring-text', 'ringText'], ['stk-sub-text', 'subText']]) {
    const el = propPanel.querySelector('#' + id); if (!el) continue;
    el.addEventListener('input', () => { block.dataset[key] = el.value; rerender(); });
    el.addEventListener('change', () => { window.pushHistory?.('인증마크 글'); window.scheduleAutoSave?.(); });
  }
  _bindTPair('stk-ring-size', 'stk-ring-size-num', 'ringTextSize', 5, 16, 1);
  _bindTPair('stk-ring-bw', 'stk-ring-bw-num', 'ringBorderW', 0, 12, 1);
  if (propPanel.querySelector('#stk-ring-bc-color')) wireColorField('stk-ring-bc', {
    onApply: (c) => { block.dataset.ringBorderColor = c; block.dataset.ringTextColor = c; rerender(); },
    onCommit: () => { window.pushHistory?.('인증마크 색'); window.scheduleAutoSave?.(); },
  });
  propPanel.querySelector('#stk-burst-ring')?.addEventListener('change', (e) => {
    block.dataset.burstRing = e.target.checked ? 'on' : 'off'; rerender(); window.pushHistory?.('톱니 링'); window.scheduleAutoSave?.();
  });
  // icon color (currentColor SVG에 반영)
  wireColorField('stk-icon-color', {
    initialAlpha: parseAlphaFromColor(_stkIconShown),
    onApply: (c) => { block.dataset.iconColor = c; rerender(); },
    onCommit: () => { window.pushHistory?.('아이콘 스티커 색'); window.scheduleAutoSave?.(); },
  });
}

window.showStickerProperties = showStickerProperties;
