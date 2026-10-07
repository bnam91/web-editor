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
import { escHtml } from './_helpers.js';

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
 * @param {boolean} o.isUnderline     ★밑줄 버튼 활성 (⑤ · 2026-10-08)
 * @param {boolean} o.showUnderline   ★밑줄(U) 버튼 «표시». ⛔기본 false = 이전과 «바이트 동일»
 *                                    (텍스트 패널만 true — 배선이 wireTextEditSection 에만 있다.
 *                                     모달·그리드·챗을 켜려면 그쪽 배선과 골든을 ★같이 손봐야 한다:
 *                                     tests/dom/fixtures/grid-panel-golden.json 등 ★공유 픽스처가 걸린다)
 * @param {number}  o.lh                줄간격
 * @param {number}  o.ls                자간
 * @param {number}  o.sizeMin|sizeMax   크기 입력 범위 (텍스트 8~800 · 모달 10~60)
 * @param {boolean} o.showStyleGroup    B/I/S/H 줄 표시 (liner 는 숨긴다)
 * @param {boolean} o.showLetterSpacing 자간 칸 표시
 * @param {boolean} o.showSize          크기 입력 표시
 * @param {boolean} o.showHighlight     형광펜(H) 버튼 표시. ★기본 true = 이전과 «바이트 동일»
 * @param {boolean} o.showHighlightOpts 형광펜 «색·바 높이» 칸 표시. ★기본 false = 모달·그리드는 이전과 «바이트 동일»
 *                                      (텍스트 패널만 true — 그 둘을 쓰는 배선이 wireTextEditSection 에만 있다)
 * @param {string}  o.hlColorHtml      형광펜 «색 칸» 마크업. ★부르는 쪽이 colorFieldHTML 로 만들어 넘긴다
 *                                      ⛔여기서 color-picker.js 를 import 하지 «마라» — 이 파일은 마크업만 내는 순수 함수이고,
 *                                        tests/unit/_text-template-harness.js 가 vm 에 올리는 의존 목록이 그만큼 늘어난다
 *                                        (2026-10-06 실측: import 를 더했더니 골든 검사가 ReferenceError 로 통째로 빨강).
 * @param {number}  o.hlH               형광펜 바 높이(%, 5~100)
 *                                      (T1 골든이 그 동일성을 지킨다). 끄는 쪽은 «왜 끄는지»를
 *                                      호출부에 적어야 한다 — 그리드가 그 사례다(prop-grid.js).
 * @param {boolean} o.showFont          Font 피커 표시 · @param {boolean} o.showWeight 굵기 select 표시
 * @param {boolean} o.showLineHeight    줄간격 칸 표시
 *                                      ★셋 다 기본 true = 이전과 «바이트 동일». 끄는 쪽은 «왜 끄는지»를
 *                                      호출부에 적어야 한다 — 챗이 그 사례다(prop-chat.js: 렌더러가 fontSize 만 읽는다).
 * @param {string}  o.sizePh|lhPh|lsPh  ★값을 «안 정한» 칸의 회색 안내값(역할 기본값). value 는 비우고
 *                                      이것만 주면 「아무도 안 정했다」가 화면에 보인다. mix 가 이긴다.
 * @param {object}  o.mix               Figma "Mix" 정책 — 섞였으면 빈 값 + placeholder="Mix"
 */
export function buildTypographySectionHtml({
  p, font, weight, size,
  isBold, isItalic, isStrike, isHighlight, isUnderline,
  lh, ls,
  sizeMin = 8, sizeMax = 800,
  showStyleGroup = true, showLetterSpacing = true, showSize = true, showHighlight = true,
  showFont = true, showWeight = true, showLineHeight = true,
  showHighlightOpts = false, hlColorHtml = '', hlH = 100,
  showUnderline = false,
  sizePh, lhPh, lsPh,
  mix,
} = {}) {
  const _mix = mix || _NO_MIX;
  const _sizeVal = _mix.fontSize.mixed ? '' : size;
  const _sizePh  = _mix.fontSize.mixed ? 'Mix' : (sizePh ?? '');
  /* ★「빈 값의 뜻」 선언 (prop-number-commit-guard.js 세 번째 축) —
     기본은 «비지 않은 placeholder = 비우면 역할 기본으로 돌아간다»이다. 그런데 Mix 의 'Mix' 는
     역할 기본값이 아니라 «값이 여럿이라 못 보여준다»는 표시다. 비우고 Enter 했다고 고른 블럭을
     전부 하한(8px)으로 깎으면 안 된다 ⇒ 그 상태에서만 명시로 덮어 「빈 값 = 무효」로 되돌린다. */
  const _sizeEmptyAttr = _mix.fontSize.mixed ? ' data-empty="invalid"' : '';
  /* ★placeholder 속성은 «값이 있을 때만» 찍는다 — 안 그러면 기본 호출의 산출이 한 글자 늘어
     T1 골든이 빨개진다. 이 절의 규약: 기본 인자에서는 «바이트 동일». */
  const _ph = (v) => (v === undefined || v === null || v === '') ? '' : ` placeholder="${v}"`;
  /* ★끄는 칸(showFont·showWeight·showLineHeight) — «켤 때는 한 글자도 안 찍는다». 바로 위 _ph 와 같은 규약이다:
     기본 인자에서 산출이 한 글자라도 늘면 T1 골든이 빨개진다(그게 이 절의 계약이다).
     ⛔지우지 «않고» 숨긴다 — 배선(wireFontPicker 등)이 요소를 찾다 죽지 않게(line-host.js _hideBlockTypo 가 같은 말을 적었다).
     ★왜 이 셋이 필요했나 — 챗 블럭이 네 번째 소비자로 들어왔는데(2026-10-06), 렌더러(chat-block.js)가 읽는 것은
       dataset.fontSize «하나»다. 안 읽는 칸을 펴 두면 「눌리는데 아무 일도 안 난다」가 된다(prop-grid.js 머리말의 그 고질). */
  const _hide = (show) => (show ? '' : ' style="display:none"');
  const _weightMixed = _mix.fontWeight.mixed;

  return `<div class="prop-section">
      <div class="prop-section-title">Typography</div>

      <span class="prop-field-label"${_hide(showFont)}>Font</span>
      <div class="font-picker" id="${p}-font-picker"${_hide(showFont)}>
        <button class="font-picker-trigger" id="${p}-font-trigger" type="button">
          <span class="font-picker-current" id="${p}-font-name">${font ? escHtml(_fontDisplayName(font)) : '기본 (시스템)'}</span>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style="flex-shrink:0"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>
        </button>
        <div class="font-picker-dropdown" id="${p}-font-dropdown" style="display:none">
          <input class="font-picker-search" id="${p}-font-search" type="text" placeholder="폰트 검색..." autocomplete="off" spellcheck="false">
          <div class="font-picker-list" id="${p}-font-list"></div>
          <button class="font-picker-noonnu" id="${p}-font-noonnu" type="button">🔗 눈누에서 폰트 더 받기</button>
        </div>
      </div>

      <div class="prop-row">
        <select class="prop-select" id="${p}-font-weight" style="flex:1${showWeight ? '' : ';display:none'}">
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
        <input type="number" class="prop-number prop-number-select" id="${p}-size-number" min="${sizeMin}" max="${sizeMax}" value="${_sizeVal}" placeholder="${_sizePh}"${_sizeEmptyAttr} style="flex:1;min-width:0;display:${showSize?'block':'none'}">
      </div>

      <div class="prop-style-group" id="${p}-style-group" style="margin-top:6px;display:${showStyleGroup?'flex':'none'}">
        <button class="prop-style-btn ${isBold?'active':''}" id="${p}-bold-btn" title="굵게 (⌘B)"><b>B</b></button>
        <button class="prop-style-btn ${isItalic?'active':''}" id="${p}-italic-btn" title="기울임 (⌘I)"><i>I</i></button>${showUnderline ? `
        <button class="prop-style-btn ${isUnderline?'active':''}" id="${p}-underline-btn" title="밑줄 (⌘U)"><u>U</u></button>` : ''}
        <button class="prop-style-btn ${isStrike?'active':''}" id="${p}-strike-btn" title="취소선 (⌘⇧X)"><s>S</s></button>${showHighlight ? `
        <button class="prop-style-btn ${isHighlight?'active':''}" id="${p}-highlight-btn" title="형광펜 (글자 길이만큼 — 선택이 있으면 그 글자만)">H</button>` : ''}
      </div>
${showHighlightOpts ? `      <!-- ★형광펜 색·바 높이 (2026-10-06 현빈 tb_5bkw8dq: 「색변경 및 하이라이트 바 높이 조절가능하게」).
           ★H 단추 «바로 아래» — 그 단추가 켜는 것을 고치는 칸이라 같은 자리가 맞다.
           ★형광펜이 꺼져 있으면 «없다» — 정할 것이 없다(섹션 체커 톤 라디오와 같은 규약).
           ⛔칸 꼴을 새로 만들지 않는다: 스티커 형광펜(prop-sticker.js stk-hl-*)이 쓰는
             colorFieldHTML ＋ range/number 쌍을 ★그대로 쓴다. -->
      <div class="prop-color-row" id="${p}-hl-color-row" style="margin-top:6px;display:${isHighlight?'flex':'none'}">
        <span class="prop-label">형광펜</span>
        ${hlColorHtml}
      </div>
      <div class="prop-row" id="${p}-hl-h-row" style="display:${isHighlight?'flex':'none'}" title="글자 상자 높이 대비 획의 높이(%). 100 = 글자를 다 덮음 · 40 = 아래쪽 40%만">
        <span class="prop-label">바 높이</span>
        <input type="range" class="prop-slider" id="${p}-hl-h" min="5" max="100" step="1" value="${hlH}">
        <input type="number" class="prop-number" id="${p}-hl-h-num" min="5" max="100" value="${hlH}">
      </div>
` : ''}
      <div class="prop-lhls-row">
        <div class="prop-lhls-col"${_hide(showLineHeight)}>
          <span class="prop-field-label">Line Height</span>
          <div class="prop-icon-input">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path fill="currentColor" d="M17.5 17a.5.5 0 0 1 0 1h-11a.5.5 0 0 1 0-1zm-5.25-9a.5.5 0 0 1 .476.347l2.25 7a.5.5 0 0 1-.952.306L13.494 14h-2.987l-.531 1.653a.5.5 0 0 1-.952-.306l2.25-7 .03-.075A.5.5 0 0 1 11.75 8zm-1.422 5h2.344L12 9.354zM17.5 6a.5.5 0 0 1 0 1h-11a.5.5 0 0 1 0-1z"/></svg>
            <input type="number" id="${p}-lh-number" min="1" max="3" step="0.05" value="${lh}"${_ph(lhPh)} aria-label="줄간격">
          </div>
        </div>
        <div class="prop-lhls-col" id="${p}-ls-col" style="display:${showLetterSpacing?'block':'none'}">
          <span class="prop-field-label">Letter Spacing</span>
          <div class="prop-icon-input">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path fill="currentColor" d="M6.5 6a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-1 0v-11a.5.5 0 0 1 .5-.5m11 0a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-1 0v-11a.5.5 0 0 1 .5-.5m-5.25 3a.5.5 0 0 1 .472.335l1.75 5a.5.5 0 1 1-.944.33l-.407-1.165H10.88l-.407 1.165a.5.5 0 1 1-.944-.33l1.75-5 .032-.072A.5.5 0 0 1 11.75 9zm-1.02 3.5h1.54L12 10.298z"/></svg>
            <input type="number" id="${p}-ls-number" min="-10" max="40" step="0.5" value="${ls}"${_ph(lsPh)} aria-label="자간">
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
 * @param {string} o.colorHexVal ★hex 칸의 value 를 스와치와 «따로» 준다(''=아무도 안 정했다)
 * @param {string} o.colorHexPh  ★hex 칸의 회색 안내값(역할 기본색 HEX)
 * @param {object} o.mix       섞였으면 체커보드 스와치 + placeholder="Mix"
 */
export function buildFillSectionHtml({ p, colorHex, alpha, colorHexVal, colorHexPh, mix } = {}) {
  const _mix = mix || _NO_MIX;
  /* ★스와치(colorHex)와 hex 칸(colorHexVal)이 «다른 것»을 말할 수 있다 — 층이 다르기 때문이다:
     스와치는 「지금 무슨 색인가」(진실), hex 칸은 「누가 그 색을 정했나」(명시/역할 기본).
     둘 다 안 주면 이전과 «바이트 동일»(hex 칸 = 스와치 색). */
  const _colorHexVal = _mix.color.mixed ? '' : (colorHexVal ?? colorHex.replace('#','').toUpperCase());
  const _colorHexPh  = _mix.color.mixed ? 'Mix' : (colorHexPh ?? '');
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
          <input type="text" class="prop-color-hex" id="${p}-color-hex" value="${_colorHexVal}" placeholder="${_colorHexPh}" maxlength="7" aria-label="Color">
          <label class="prop-color-alpha" title="Opacity">
            <input type="text" class="prop-color-alpha-input" id="${p}-color-alpha" value="${alpha}" aria-label="Opacity">
            <span class="prop-color-alpha-suffix">%</span>
          </label>
        </div>
      </div>
      <div class="cv-chips" id="${p}-color-chips" hidden></div>
    </div>`;
}
