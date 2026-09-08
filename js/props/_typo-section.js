/* _typo-section — Typography·Fill 절의 «마크업»이 사는 단 하나의 자리. (2026-09-08)
 *
 * ★왜 뽑았나
 *   현빈: 「텍스트를 선택하면 해당 플레이스홀더에 타이포그라피 절이 들어가야지.
 *          일반 텍스트블럭을 선택한 것처럼 기본적으로. … 이게 기본 세트여야되지 않겠어?」
 *   모달 패널에 «같은 절»을 붙여야 하는데, 그 마크업은 prop-text-template.js 의
 *   buildTextPropsHtml «하나의 거대 템플릿 리터럴 안»에 박혀 있었다.
 *   ⛔손으로 베끼면 두 벌이 된다. 이 레포는 정렬 아이콘 146개로 이미 그 병을 앓았고,
 *     stripComments 사본 11벌 중 9벌이 같은 형태로 부서져 있었다.
 *   ⇒ 마크업을 «id 접두사를 받는 순수 함수»로 뽑아 두 패널이 같은 것을 부르게 한다.
 *
 * ★id 접두사(p)가 이 파일의 전부다
 *   텍스트 패널은 p='txt' → 기존 id 가 «한 글자도» 안 바뀐다(배선 무변경).
 *   모달 패널은  p='mdl-typo'.
 *
 * ⛔여기엔 «배선»이 없다 — 마크업만 낸다. 적용(무엇에 쓰는가)은 패널마다 다르다:
 *   텍스트블록은 DOM 인라인 스타일이 진실이고, 모달은 dataset 이 진실이다.
 *   그 둘을 한 함수로 묶으려 들면 안 된다(재렌더가 인라인을 지운다).
 *
 * ★「텍스트 패널이 실제로 이걸 부르는가」는 tests/unit/typo-section-ssot.test.mjs 가 못박는다.
 *   안 그러면 다음 사람이 한쪽을 인라인 마크업으로 되돌려도 검사가 초록이다.
 */
import { _fontDisplayName } from './prop-text-utils.js';

/** mix 기본값 — 셋 다 «안 섞임». 호출부가 안 주면 이걸 쓴다. */
const _NO_MIX = { color: { mixed: false }, fontSize: { mixed: false }, fontWeight: { mixed: false } };

/**
 * Typography 절 — Font 피커 · 굵기/크기 · B/I/S/H · 줄간격/자간.
 *
 * @param {object}  o
 * @param {string}  o.p                 id 접두사 ('txt' | 'mdl-typo')
 * @param {string}  o.font              현재 폰트(체인 문자열). 빈 값이면 '기본 (시스템)'
 * @param {string}  o.weight            현재 굵기('100'~'900')
 * @param {number}  o.size              현재 글자 크기
 * @param {boolean} o.isBold|isItalic|isStrike|isHighlight   스타일 버튼 활성
 * @param {number}  o.lh                줄간격
 * @param {number}  o.ls                자간
 * @param {number}  o.sizeMin|sizeMax   크기 입력 범위 (텍스트 8~800 · 모달 10~60)
 * @param {boolean} o.showStyleGroup    B/I/S/H 줄 표시 (liner 는 숨긴다)
 * @param {boolean} o.showLetterSpacing 자간 칸 표시
 * @param {boolean} o.showSize          크기 입력 표시
 * @param {object}  o.mix               Figma "Mix" 정책 — 섞였으면 빈 값 + placeholder="Mix"
 */
export function buildTypographySectionHtml({
  p, font, weight, size,
  isBold, isItalic, isStrike, isHighlight,
  lh, ls,
  sizeMin = 8, sizeMax = 800,
  showStyleGroup = true, showLetterSpacing = true, showSize = true,
  mix,
} = {}) {
  const _mix = mix || _NO_MIX;
  const _sizeVal = _mix.fontSize.mixed ? '' : size;
  const _sizePh  = _mix.fontSize.mixed ? 'Mix' : '';
  const _weightMixed = _mix.fontWeight.mixed;

  return `<div class="prop-section">
      <div class="prop-section-title">Typography</div>

      <span class="prop-field-label">Font</span>
      <div class="font-picker" id="${p}-font-picker">
        <button class="font-picker-trigger" id="${p}-font-trigger" type="button">
          <span class="font-picker-current" id="${p}-font-name">${font ? _fontDisplayName(font) : '기본 (시스템)'}</span>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style="flex-shrink:0"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>
        </button>
        <div class="font-picker-dropdown" id="${p}-font-dropdown" style="display:none">
          <input class="font-picker-search" id="${p}-font-search" type="text" placeholder="폰트 검색..." autocomplete="off" spellcheck="false">
          <div class="font-picker-list" id="${p}-font-list"></div>
        </div>
      </div>

      <div class="prop-row">
        <select class="prop-select" id="${p}-font-weight" style="flex:1">
          ${_weightMixed ? '<option value="" selected disabled>Mix</option>' : ''}
          <option value="100" ${!_weightMixed && weight==='100'?'selected':''}>Thin 100</option>
          <option value="200" ${!_weightMixed && weight==='200'?'selected':''}>ExtraLight 200</option>
          <option value="300" ${!_weightMixed && weight==='300'?'selected':''}>Light 300</option>
          <option value="400" ${!_weightMixed && (!weight||weight==='400')?'selected':''}>Regular 400</option>
          <option value="500" ${!_weightMixed && weight==='500'?'selected':''}>Medium 500</option>
          <option value="600" ${!_weightMixed && weight==='600'?'selected':''}>SemiBold 600</option>
          <option value="700" ${!_weightMixed && weight==='700'?'selected':''}>Bold 700</option>
          <option value="800" ${!_weightMixed && weight==='800'?'selected':''}>ExtraBold 800</option>
          <option value="900" ${!_weightMixed && weight==='900'?'selected':''}>Black 900</option>
        </select>
        <input type="number" class="prop-number prop-number-select" id="${p}-size-number" min="${sizeMin}" max="${sizeMax}" value="${_sizeVal}" placeholder="${_sizePh}" style="flex:1;min-width:0;display:${showSize?'block':'none'}">
      </div>

      <div class="prop-style-group" id="${p}-style-group" style="margin-top:6px;display:${showStyleGroup?'flex':'none'}">
        <button class="prop-style-btn ${isBold?'active':''}" id="${p}-bold-btn" title="굵게 (⌘B)"><b>B</b></button>
        <button class="prop-style-btn ${isItalic?'active':''}" id="${p}-italic-btn" title="기울임 (⌘I)"><i>I</i></button>
        <button class="prop-style-btn ${isStrike?'active':''}" id="${p}-strike-btn" title="취소선 (⌘⇧X)"><s>S</s></button>
        <button class="prop-style-btn ${isHighlight?'active':''}" id="${p}-highlight-btn" title="형광펜 (선택 영역 배경칠)">H</button>
      </div>

      <div class="prop-lhls-row">
        <div class="prop-lhls-col">
          <span class="prop-field-label">Line Height</span>
          <div class="prop-icon-input">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path fill="currentColor" d="M17.5 17a.5.5 0 0 1 0 1h-11a.5.5 0 0 1 0-1zm-5.25-9a.5.5 0 0 1 .476.347l2.25 7a.5.5 0 0 1-.952.306L13.494 14h-2.987l-.531 1.653a.5.5 0 0 1-.952-.306l2.25-7 .03-.075A.5.5 0 0 1 11.75 8zm-1.422 5h2.344L12 9.354zM17.5 6a.5.5 0 0 1 0 1h-11a.5.5 0 0 1 0-1z"/></svg>
            <input type="number" id="${p}-lh-number" min="1" max="3" step="0.05" value="${lh}" aria-label="줄간격">
          </div>
        </div>
        <div class="prop-lhls-col" id="${p}-ls-col" style="display:${showLetterSpacing?'block':'none'}">
          <span class="prop-field-label">Letter Spacing</span>
          <div class="prop-icon-input">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path fill="currentColor" d="M6.5 6a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-1 0v-11a.5.5 0 0 1 .5-.5m11 0a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-1 0v-11a.5.5 0 0 1 .5-.5m-5.25 3a.5.5 0 0 1 .472.335l1.75 5a.5.5 0 1 1-.944.33l-.407-1.165H10.88l-.407 1.165a.5.5 0 1 1-.944-.33l1.75-5 .032-.072A.5.5 0 0 1 11.75 9zm-1.02 3.5h1.54L12 10.298z"/></svg>
            <input type="number" id="${p}-ls-number" min="-10" max="40" step="0.5" value="${ls}" aria-label="자간">
          </div>
        </div>
      </div>

    </div>`;
}

/**
 * Fill 절 — 글자색(스와치 + hex + alpha) + 컬러변수 칩 자리.
 *
 * @param {object} o
 * @param {string} o.p         id 접두사
 * @param {string} o.colorHex  현재 색
 * @param {number} o.alpha     불투명도(%)
 * @param {object} o.mix       섞였으면 체커보드 스와치 + placeholder="Mix"
 */
export function buildFillSectionHtml({ p, colorHex, alpha, mix } = {}) {
  const _mix = mix || _NO_MIX;
  const _colorHexVal = _mix.color.mixed ? '' : colorHex.replace('#','').toUpperCase();
  const _colorHexPh  = _mix.color.mixed ? 'Mix' : '';
  const _colorSwatchBg = _mix.color.mixed ? 'linear-gradient(135deg,#bbb 25%,#777 25%,#777 50%,#bbb 50%,#bbb 75%,#777 75%)' : colorHex;
  const _swatchExtraClass = _mix.color.mixed ? ' swatch-mix' : '';

  return `<div class="prop-section">
      <div class="prop-section-title">Fill</div>
      <div class="prop-color-row">
        <span class="prop-label">글자색</span>
        <div class="prop-color-field">
          <div class="prop-color-swatch${_swatchExtraClass}" style="background:${_colorSwatchBg}" title="${_mix.color.mixed?'Mix — 일부 선택 후 색상 변경':''}">
            <input type="color" id="${p}-color" value="${colorHex}">
          </div>
          <input type="text" class="prop-color-hex" id="${p}-color-hex" value="${_colorHexVal}" placeholder="${_colorHexPh}" maxlength="6" aria-label="Color">
          <label class="prop-color-alpha" title="Opacity">
            <input type="text" class="prop-color-alpha-input" id="${p}-color-alpha" value="${alpha}" aria-label="Opacity">
            <span class="prop-color-alpha-suffix">%</span>
          </label>
        </div>
      </div>
      <div class="cv-chips" id="${p}-color-chips" hidden></div>
    </div>`;
}
