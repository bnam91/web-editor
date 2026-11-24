// HTML template extracted from prop-text.js (Phase 2 refactor)
import { buildTypographySectionHtml, buildFillSectionHtml } from './_typo-section.js';
import { overlayToggleBtnHTML, blockHeaderHTML, sliderRowHTML, rotRowHTML, floatAlignRowHTML, flowAlignDisabledHTML, POS_FLOW_WHY } from './_helpers.js';
import { sec, buildPanelHTML } from './_panel-frame.js';
import { strokeSectionHTML, strokeHeadToolsHTML, STROKE_POP_WHY } from './_stroke-section.js';
import { sectionOrderFor, sectionRank } from './_section-spec.js';
/* T7 — 글머리 명부·판정은 ★한 자리(text-type-class.js). 패널과 배선이 ★같은 하나를 본다. */
import { BULLET_LIST_STYLES, bulletListStyleOf } from './text-type-class.js';

export function buildTextPanelSpec(state) {
  const {
    tb, isOverlayTb, currentClass, currentAlign,
    currentX, currentY, currentRotation = 0, currentW, currentFont, currentWeight, currentSize,
    currentLH, currentLS, currentColor, currentColorAlpha,
    currentPadT, currentPadL, currentPadR, phLinked,
    isLabel, currentBgColor, currentRadius, labelPillH, labelPadX = 0, labelIsCircle = false, labelShape = null,
    isSpeechBubble, currentBubbleStyle, currentTail,
    bubbleBgHex, bubbleBgColorHtml, showSender, bubbleSizeFixed, bubbleW, bubbleH,
    isIconText, currentItbGap, itbVertical,
    mix,
    shadow,
    stroke, strokeColorHtml,   /* ★1012t1E1 Stroke 절 — 상태(readStrokeState)·색 칸 마크업은 prop-text.js 가 준다. 없으면 절 0 ⇒ 골든 바이트 동일 */
    isLiner,
    isStrike,
    isUnderline,
    isDot,
    isBold,
    isItalic,
    isHighlight,
    hlColorHtml, hlH, hlY,          /* ★형광펜 «색 칸 마크업»·바 높이·★획 세로자리 (2026-10-06 ＋ ★hlY 2026-10-08). 마크업은 prop-text.js 가 만들어 준다 */
    ulColorHtml, ulThick, ulOffset, /* ★밑줄 «색 칸 마크업»·두께·위치 (2026-10-08). 같은 까닭으로 prop-text.js 가 만든다 */
    dotColorHtml, dotSize, dotGap, dotX, dotY,   /* ★점 찍기 «색 칸 마크업»·네 수 (⑥ · 2026-10-08). 같은 까닭으로 prop-text.js 가 만든다 */
    showGlow, isGlow, glowColorHtml, glowK,      /* ★1012t1E2 범위 글로우 — prop-text.js 가 showGlow:true 로 켠다. 없으면 단추·칸 0 ⇒ 골든 바이트 동일 */
    isOverlayBlock,
    showAnimGif,   /* GIF 단추를 «그릴» 판(U6 — 덧칠 글이 아니면 참 · 눌림은 prop-text.js 가 어드민 게이트로 disabled+까닭). 거짓이면 GIF 절째 없음 */
  } = state;

  // Shadow defaults (prop-text-wireup-shadow.js SHADOW_DEFAULTS와 동기화)
  const _sh = shadow || { enabled:false, x:2, y:2, blur:4, color:'#000000', alpha:50 };
  /* ★t4-01 — 보통 텍스트의 그림자는 Effects 「효과 추가」의 «그림자» 카드로 산다(js/effects-shadow.js · 명부 effects-registry 는 앱에 늘 실린다).
     말풍선·태그·아이콘텍스트는 fx 대상 밖 — 옛 그림자 조절칸이 그들의 Effects 절이다. ⛔명부가 없을 때의 대체 갈래를 두지 마라(앱엔 그런 판이 없다 · 단위 하네스가 명부를 싣는다). */
  const _plainText = !isSpeechBubble && !isLabel && !isIconText;

  /* ★1012t1E1 Stroke(외곽선) 절 — Fill 다음(피그마 순서 Fill → Stroke → Effects · 순서는 이제 틀이 정한다).
   * 대상 밖 = 말풍선·라벨(Tag)·아이콘텍스트·곡선(liner). 마크업 = 이 파일 끝 strokeSection 한 벌(인용구 패널도 같은 것). */

  // Figma "Mix" 정책: 자식들의 스타일이 섞여있으면 input 을 빈 값 + placeholder="Mix" 로 표시
  const _mix = mix || { color:{mixed:false}, fontSize:{mixed:false}, fontWeight:{mixed:false} };

  /* ═══ T7 ★불릿 «글머리» — 현빈 2026-10-07 「불릿의 크기 및, 모양 및 숫자 및 알파벳 등 프리셋 필요」 ═══
   * ★★«비-불릿이면 ★빈 문자열»이라 ★산출이 ★바이트 동일하다 — ⛔템플릿 «안»에 조건식을 ★줄로 넣지 마라:
   *   그러면 ★개행·들여쓰기가 ★모든 타입의 산출에 ★더해져 ★`typo-section-ssot` ★T1 골든이 ★빨개진다
   *   (★2026-10-07 실측 — 내가 ★그렇게 넣어 ★그 골든을 깨뜨렸다. ★선례: G20 의 `${circleRows}` 가 같은 꼴).
   * ★★⛔단추에 `prop-type-btn` 을 ★쓰지 않는다 — `prop-text-wireup-type.js` 의 `wireTypeSection` 이
   *   ★`propPanel.querySelectorAll('.prop-type-btn')` 으로 ★패널 ★전역을 잡아, 붙이면 ★내 단추도 물고
   *   `btn.dataset.cls`=undefined 로 ★타입 클래스가 ★지워진다(★별건으로 올렸다).
   *   ⇒ 모양은 `prop-preset-group`＋`prop-preset-btn` 한 쌍(css/editor-props.css 그 절) ⇒ ★새 클래스 0.
   * ★「지금 무엇이 골라졌나」 = ★인라인(`bulletListStyleOf`) — ⛔computed 금지(기본 disc 와 못 가른다).
   *   ★아무것도 안 골랐으면 ★`disc` 를 active 로 보인다(화면이 그러하므로) — ★값은 여전히 빈 문자열이다. */
  const _bulletSec = currentClass !== 'tb-bullet' ? '' : (() => {
    const _ul = tb?.querySelector?.('ul.tb-bullet');
    const _cur = _ul ? bulletListStyleOf(_ul) : '';
    return `
      <div class="prop-type-group prop-preset-group">
        ${BULLET_LIST_STYLES.map(x => `<button class="prop-preset-btn${(_cur || 'disc') === x.v ? ' active' : ''}" data-lst="${x.v}" title="${x.title}">${x.label}</button>`).join('\n        ')}
      </div>
      <div class="prop-hint">크기는 Typography 의 글자 크기를 따릅니다</div>`;
  })();

  /* ★TEXT-LOREM-FILL-01(현빈 261121) — Content 절 «더미 글» 세 줄: 단위 / 개수 슬라이더+숫자(t13E-08 2차 현빈 261123 · 공용 sliderRowHTML · 범위·값은 배선이 상자 높이로 맞춤) / 글·채우기. 배선 = prop-text-wireup-lorem.js · 생성 = js/text-lorem.js.
   * 줄 모드 말풍선(data-lines)은 글 자리가 아니라(ai-text-slots findTextSlot 이 건너뜀) 줄을 안 낸다. 새 클래스 0(prop-row·prop-select·prop-number·prop-btn-sm). */
  const _loremSec = (isSpeechBubble && tb?.dataset?.lines !== undefined) ? '' : `
      <div class="prop-row">
        <span class="prop-label">더미 글</span>
        <select class="prop-select" id="txt-lorem-unit" aria-label="더미 글 단위"><option value="word">단어</option><option value="sentence" selected>문장</option><option value="paragraph">문단</option></select>
      </div>
      ${sliderRowHTML('개수', 'txt-lorem-count-slider', 'txt-lorem-count', { min: 1, max: 30, step: 1, value: 2 })}
      <div class="prop-row">
        <select class="prop-select" id="txt-lorem-lang" aria-label="더미 글 언어" style="flex:1 1 auto;min-width:0;"><option value="en" selected>Lorem</option><option value="ko">한글</option></select>
        <button class="prop-btn-sm" id="txt-lorem-run" title="이 글 칸을 더미 글로 바꿉니다(⌘Z 로 되돌림)">채우기</button>
      </div>`;

  /* ═══ right-panel-unify U2(2026-11-13) — 절은 틀(_panel-frame.js)이 그린다 ═══
   * ★여기는 «절 몸통»만 낸다: sec(key, 몸통) — 순서·제목·접기·머리 = 틀(_section-spec.js SECTION_ORDER).
   * ★id·data-*·핸들러가 붙는 칸은 한 글자도 안 바꿨다(배선·spec 이 #id 로 잰다). 바뀐 것 = «어느 절에 사나»:
   *   정렬 → Layout · 회전/X/Y → Position · 태그 모서리 → Appearance · 태그 배경 → Fill · 태그 높이·아이콘 크기 → Size ·
   *   아이콘텍스트 방향/세로/간격 → Layout · 그림자/Effects → Effects 한 절(한 패널 한 key · fx 는 window.fxSectionParts).
   * ★없는 절은 «빈 문자열» ⇒ 틀이 버린다(옛 display:none 껍데기 폐지). 타입을 바꾸면 패널을 다시 그린다
   *   (prop-text-wireup-type.js — 태그 절들이 그때 서고 걷힌다).
   * ★말풍선(Bubble)은 special 한 절에 모은다 — ⛔Typography/Fill 에 넣지 마라: 줄 모드(js/blocks/line-host.js
   *   _hideBlockTypo)가 «#txt-font-picker·#txt-color 가 든 절 통째»를 숨겨 말풍선 손잡이까지 사라진다. */
  const _typo = buildTypographySectionHtml({
      p: 'txt', bare: true, fontLabel: false,   /* 재설계 1차 ⑩ — «Font» 라벨 글 걷음(텍스트만) */
      font: currentFont, weight: currentWeight, size: currentSize,
      isBold, isItalic, isStrike, isHighlight, isUnderline,
      lh: currentLH, ls: currentLS,
      sizeMin: 8, sizeMax: 800,
      showStyleGroup: !isLiner, showLetterSpacing: !isLiner, showSize: !isLiner,
      /* ★텍스트 패널만 형광펜 색·바 높이 칸을 갖는다 — 배선(wireTextEditSection)이 여기에만 있다.
         ⛔모달(prop-modal.js)·그리드(prop-grid.js)는 기본값 false 라 마크업이 «바이트 동일»이다. */
      showHighlightOpts: !isLiner, hlColorHtml, hlH, hlY,
      /* ★밑줄(U) 단추·«색·두께·위치» 칸은 ★텍스트 패널만 — 배선(wireTextEditSection)이 여기에만 있다.
         ★isLiner 는 서식 그룹 자체가 숨는 판이라 칸만 떠 있으면 「눌리는데 아무 일 없음」이 된다(점 칸과 같은 까닭). */
      showUnderline: true,
      showUnderlineOpts: !isLiner, ulColorHtml, ulThick, ulOffset,
      /* ★점 찍기(⑥)도 ★텍스트 패널만 — 모달·그리드·챗은 기본 false ⇒ «바이트 동일». isLiner 는 손잡이 칸을 안 준다. */
      showDots: true, showDotOpts: !isLiner, isDot, dotColorHtml, dotSize, dotGap, dotX, dotY,
      /* ★범위 글로우(1012t1E2)도 ★텍스트 패널만 — 배선이 wireTextEditSection 에만 있다. */
      showGlow: !!showGlow, showGlowOpts: !!showGlow && !isLiner, isGlow: !!isGlow, glowColorHtml: glowColorHtml || '', glowK: glowK ?? 70,
      mix: _mix,
    });
  /* ★「최근 그라데이션」 줄도 ★텍스트 패널만 — 글자 그라데이션 배선이 wireTextEditSection 에만 있다. */
  const _fill = buildFillSectionHtml({ p: 'txt', bare: true, colorLabel: false, colorHex: currentColor, alpha: currentColorAlpha, mix: _mix, showGradRecent: true });

  /* Effects — 한 절 key. 보통 텍스트 = fx 명부(window.fxSectionParts → {headTools, body, id}) · 말풍선·태그·아이콘텍스트 = 그림자 조절칸. */
  /* 1120b B3(현빈 261120 「버블 Effects 도 [+]」) — 켜기 토글 → 머리 «＋»(켜면 «−») · Stroke 머리와 같은 단추꼴 label · 같은 체크박스(#txt-shadow-on · change 배선 그대로) */
  const _shadowOn = `
        <label class="prop-chain-btn prop-sec-add" title="그림자 추가/빼기">
          <input type="checkbox" id="txt-shadow-on" ${_sh.enabled ? 'checked' : ''} aria-label="Shadow">
          <svg class="prop-sec-add-plus" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 2v8M2 6h8"/></svg>
          <svg class="prop-sec-add-minus" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 6h8"/></svg>
        </label>`;
  const _fx = _plainText ? window.fxSectionParts(tb, 'txt', { plus: true }) : null;   /* 재설계 1차 ⑨ — 머리 «＋»(누르면 종류 목록) */
  const _effects = _fx
    ? sec('effects', _fx.body, { id: _fx.id, headTools: _fx.headTools })
    : sec('effects', `\n${textShadowControlsHtml(_sh)}`, { id: 'txt-shadow-section', headTools: _shadowOn });

  const _alignBtns = `
      <span class="prop-field-label">Alignment</span>
      <div class="prop-align-group" id="txt-align-group">
          <button class="prop-align-btn ${currentAlign==='left'||currentAlign===''?'active':''}" data-align="left">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
              <line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/>
              <line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/>
            </svg>
          </button>
          <button class="prop-align-btn ${currentAlign==='center'?'active':''}" data-align="center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
              <line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="6" x2="11" y2="6"/>
              <line x1="2" y1="9" x2="12" y2="9"/><line x1="4" y1="12" x2="10" y2="12"/>
            </svg>
          </button>
          <button class="prop-align-btn ${currentAlign==='right'?'active':''}" data-align="right">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
              <line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/>
              <line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/>
            </svg>
          </button>
      </div>`;

  /* ★Icon Text — 방향·아이콘 세로·간격 = Layout · 아이콘 크기 = Size (OWNERSHIP: size). 아이콘텍스트일 때만. */
  const _itbLayout = !isIconText ? '' : `
      <div class="prop-row">
        <span class="prop-label">방향</span>
        <div class="prop-align-group" id="itb-dir-group">
          <button class="prop-align-btn${!itbVertical?' active':''}" data-dir="horizontal" title="가로 — 아이콘 왼쪽 · 글 오른쪽">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="1" y1="7" x2="13" y2="7"/></svg>
            가로
          </button>
          <button class="prop-align-btn${itbVertical?' active':''}" data-dir="vertical" title="세로 — 아이콘 위 · 글 아래">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="7" y1="1" x2="7" y2="13"/></svg>
            세로
          </button>
        </div>
      </div>${itbVertical ? '' : /* ★ICONTEXT-VALIGN-SLIDER-01(261110) — 아이콘 세로 = 슬라이더+숫자칸. 가로 방향에서만(세로 방향엔 뜻이 없다). */ `
      <div class="prop-row">
        <span class="prop-label" title="글 기준 아이콘 세로 자리 — 가운데 0 · 왼쪽 끝 = 글 위쪽 · 오른쪽 끝 = 글 아래쪽">아이콘 세로</span>
        <input type="range" class="prop-slider" id="itb-dy-slider" min="${window.iconTextDyRange?.(tb).min ?? -60}" max="${window.iconTextDyRange?.(tb).max ?? 60}" step="0.1" value="${window.iconTextDyOf?.(tb) ?? 0}">
        <input type="number" class="prop-number" id="itb-dy-number" min="${window.iconTextDyRange?.(tb).min ?? -60}" max="${window.iconTextDyRange?.(tb).max ?? 60}" step="0.1" value="${window.iconTextDyOf?.(tb) ?? 0}">
      </div>`}
      <div class="prop-row">
        <span class="prop-label">아이콘-텍스트 간격</span>
        <input type="range" class="prop-slider" id="itb-gap-slider" min="0" max="80" step="4" value="${currentItbGap}">
        <input type="number" class="prop-number" id="itb-gap-number" min="0" max="80" value="${currentItbGap}">
      </div>`;

  /* 재설계 1차 ⑥ — 너비 = 숫자 칸(칸 안 라벨 · 라벨 좌우 끌기) + 같은 줄 높이 칸. 텍스트 블럭은 높이가 없다(내용에 맞춤) ⇒ 꺼진 칸 «auto» */
  const _sizeHtml = (isOverlayTb ? '' : `
      <div class="prop-lhls-row">
        <div class="prop-lhls-col">
          <div class="prop-icon-input">
            <span class="prop-xy-label prop-xy-label--scrub" id="txt-width-scrub" title="좌우로 끌면 값이 바뀐다">너비</span>
            <input type="number" class="prop-number" id="txt-width-number" min="80" max="860" value="${currentW}" aria-label="너비">
          </div>
        </div>
        <div class="prop-lhls-col">
          <div class="prop-icon-input" title="텍스트 블럭은 높이를 정하지 않는다(내용에 맞춤)">
            <span class="prop-xy-label">높이</span>
            <input type="number" id="txt-height-number" disabled placeholder="auto" data-empty="invalid" aria-label="높이(텍스트 블럭은 없음)">
          </div>
        </div>
      </div>`) + (!isLabel ? '' : `
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range" class="prop-slider" id="label-pill-height-slider" min="0" max="120" step="2" value="${labelPillH}">
        <input type="number" class="prop-number" id="label-pill-height-number" min="0" max="120" value="${labelPillH}">
      </div>`) + (!isIconText ? '' : `
      <div class="prop-row">
        <span class="prop-label">아이콘 크기</span>
        <input type="range" class="prop-slider" id="itb-icon-size-slider" min="${window.ITB_ICON_SIZE?.min ?? 16}" max="${window.ITB_ICON_SIZE?.max ?? 200}" step="2" value="${window.iconTextIconSizeOf?.(tb) ?? 40}">
        <input type="number" class="prop-number" id="itb-icon-size-number" min="${window.ITB_ICON_SIZE?.min ?? 16}" max="${window.ITB_ICON_SIZE?.max ?? 200}" value="${window.iconTextIconSizeOf?.(tb) ?? 40}">
      </div>`);

  const _paddingHtml = isOverlayTb ? '' : `
      <div id="txt-label-padx-wrap" style="display:${isLabel && !labelIsCircle ? 'block' : 'none'}">
      ${sliderRowHTML('태그 좌우', 'txt-label-padx-slider', 'txt-label-padx-number', { min: 0, max: 100, step: 2, value: labelPadX }).replace('<span class="prop-label">', '<span class="prop-label" title="태그 좌우패딩">')}
      </div>
      <div class="prop-row">
        <span class="prop-label">상하패딩</span>
        <input type="range" class="prop-slider" id="txt-pv-slider" min="0" max="120" step="4" value="${currentPadT}"${isSpeechBubble ? ' disabled style="opacity:var(--ui-disabled-opacity);cursor:not-allowed"' : ''}>
        <input type="number" class="prop-number" id="txt-pv-number" min="0" max="120" value="${currentPadT}"${isSpeechBubble ? ' disabled style="opacity:var(--ui-disabled-opacity);cursor:not-allowed"' : ''}>
      </div>${/* ★⑷㉣ 현빈 sb_ts0he_4lus8he — 말풍선 꼬리는 블럭 기준 absolute 라 상하 여백을 주면 몸통에서 떨어진다 ⇒ 칸은 «숨기지 않고» 막는다.
         1120b B1(현빈 261120) — 까닭 힌트 줄(#txt-pv-bubble-hint)은 걷음(막힌 칸 그대로). */ ''}
      <!-- 재설계 1차 ⑤ — 잠금 = «좌우패딩» 한 줄(둘을 같이) · 풂 = 그 줄(라벨·사슬만 · 슬라이더 자리 비움) + 좌측패딩 + 우측패딩. 사슬은 늘 같은 자리(줄 끝) -->
      <div class="prop-row" id="txt-ph-row">
        <span class="prop-label">좌우패딩</span>
        <input type="range" class="prop-slider" id="txt-ph-slider" min="0" max="120" step="4" value="${currentPadL}"${phLinked ? '' : ' style="visibility:hidden"'}>
        <input type="number" class="prop-number" id="txt-ph-number" min="0" max="120" value="${currentPadL}"${phLinked ? '' : ' style="visibility:hidden"'}>
        <button class="prop-chain-btn${phLinked ? ' active' : ''}" id="txt-ph-chain" title="좌우 잠금/풂" aria-pressed="${phLinked ? 'true' : 'false'}">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3">
            <rect x="0.5" y="3.5" width="4" height="5" rx="2"/>
            <rect x="7.5" y="3.5" width="4" height="5" rx="2"/>
            <line ${phLinked ? 'x1="4.5" y1="6" x2="7.5" y2="6"' : 'x1="5.2" y1="4.8" x2="6.8" y2="7.2"'} stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="prop-row" id="txt-pl-row"${phLinked ? ' hidden' : ''}>
        <span class="prop-label">좌측패딩</span>
        <input type="range" class="prop-slider" id="txt-pl-slider" min="0" max="120" step="4" value="${currentPadL}">
        <input type="number" class="prop-number" id="txt-pl-number" min="0" max="120" value="${currentPadL}">
      </div>
      <div class="prop-row" id="txt-pr-row"${phLinked ? ' hidden' : ''}>
        <span class="prop-label">우측패딩</span>
        <input type="range" class="prop-slider" id="txt-pr-slider" min="0" max="120" step="4" value="${currentPadR}">
        <input type="number" class="prop-number" id="txt-pr-number" min="0" max="120" value="${currentPadR}">
      </div>`;

  /* ★태그(Tag) — 모양 단추 = Typography(#label-style-section · 기존 spec 이 이 id 안의 .prop-btn-full 을 잰다) ·
     배경 = Fill · 모서리 = Appearance · 높이 = Size. 태그일 때만. */
  const _tagShape = !isLabel ? '' : `
      <div id="label-style-section">
        <span class="prop-field-label">Tag Style</span>
        <div class="prop-row">
          <button class="prop-btn-full${labelShape==='pill'?' active':''}" id="label-shape-pill">Pill</button>
          <button class="prop-btn-full${labelShape==='box'?' active':''}" id="label-shape-box">Box</button>
          <button class="prop-btn-full${labelShape==='outline'?' active':''}" id="label-shape-outline">Outline</button>
          <button class="prop-btn-full${labelShape==='circle'?' active':''}" id="label-shape-circle">Circle</button>
          <button class="prop-btn-full${labelShape==='oval'?' active':''}" id="label-shape-oval">Oval</button>
          <button class="prop-btn-full${labelShape==='text'?' active':''}" id="label-shape-text">Text</button>
        </div>
      </div>`;
  const _tagBg = !isLabel ? '' : `
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        <div class="prop-color-swatch${currentBgColor==='transparent'?' swatch-none':''}" style="background:${currentBgColor==='transparent'?'transparent':currentBgColor}">
          <input type="color" id="label-bg-color" value="${currentBgColor==='transparent'?'#111111':currentBgColor}">
        </div>
        <input type="text" class="prop-color-hex" id="label-bg-hex" value="${currentBgColor==='transparent'?'':currentBgColor.replace('#','').toUpperCase()}" maxlength="7" aria-label="Color">
        <label class="prop-none-check"><input type="checkbox" id="label-bg-none" ${currentBgColor==='transparent'?'checked':''}>없음</label>
      </div>`;
  const _tagRadius = !isLabel ? '' : `
      <div class="prop-row">
        <span class="prop-label">모서리</span>
        <input type="range" class="prop-slider" id="label-radius-slider" min="0" max="40" step="1" value="${currentRadius}">
        <input type="number" class="prop-number" id="label-radius-number" min="0" max="40" value="${currentRadius}">
      </div>`;

  /* ★말풍선 — special 「Bubble」 한 절(위 머리말: 줄 모드가 Typography/Fill 절을 통째로 숨긴다).
     ★배경색(bubble-bg-*)은 소유표상 fill 이라 그 줄에 data-own="special:Bubble"(U0c 명시 덮어쓰기 · 블록 고유 절은 제목까지). */
  const _bubble = !isSpeechBubble ? '' : `
      <div id="bubble-style-section">
        <div class="prop-row">
          <span class="prop-label">스타일</span>
          <select class="prop-select" id="bubble-style-select">
            <option value="default" ${currentBubbleStyle==='default'||!currentBubbleStyle?'selected':''}>기본</option>
            <option value="imessage" ${currentBubbleStyle==='imessage'?'selected':''}>iMessage</option>
            <option value="apple" ${currentBubbleStyle==='apple'?'selected':''}>Apple</option>
          </select>
        </div>
        <div class="prop-row">
          <span class="prop-label">말꼬리</span>
          <div class="prop-align-group">
            <button class="prop-align-btn ${currentTail==='left'?'active':''}" id="bubble-tail-left" title="왼쪽 말꼬리">←</button>
            <button class="prop-align-btn ${currentTail==='center'?'active':''}" id="bubble-tail-center" title="말꼬리 없음 / 중앙">—</button>
            <button class="prop-align-btn ${currentTail==='right'?'active':''}" id="bubble-tail-right" title="오른쪽 말꼬리">→</button>
          </div>
        </div>
        <!-- data-own="special:Bubble": 말풍선 배경은 Bubble 절에 둔다 — 줄 모드(line-host _hideBlockTypo)가 Fill 절을 통째 숨겨 같이 사라지지 않게 -->
        <!-- 1120b B2(현빈 261120) — 값은 Fill(글자색)과 «따로»(--bubble-bg) · 줄 꼴은 Fill 색 줄과 같은 부품(colorFieldHTML: 스와치 + HEX + % · prop-color-field). 마크업은 prop-text.js 가 만든다(템플릿은 color-picker 를 import 하지 않는다) -->
        <div class="prop-color-row" data-own="special:Bubble">
          <span class="prop-label">배경색</span>
          ${bubbleBgColorHtml || ''}
        </div>
        <!-- ★1017t1m3 크기 — 「자동」= 글 길이 따라(지금까지) · 「고정」= 너비 고정 + 높이 최소 -->
        <div class="prop-row">
          <span class="prop-label">크기</span>
          <div class="prop-type-group" id="bubble-size-group">
            <button class="prop-type-btn ${bubbleSizeFixed?'':'active'}" data-bsz="auto">자동</button>
            <button class="prop-type-btn ${bubbleSizeFixed?'active':''}" data-bsz="fixed">고정</button>
          </div>
        </div>
        <!-- 1120b B4(현빈 261120 「Size 절과 CSS 통일」) — 너비·높이 = Size 절과 같은 두 칸 마크업(prop-lhls-row · 칸 안 라벨 prop-xy-label) · id·배선 그대로 -->
        <div class="prop-lhls-row">
          <div class="prop-lhls-col">
            <div class="prop-icon-input">
              <span class="prop-xy-label">너비</span>
              <input type="number" class="prop-number" id="bubble-w-number" min="60" max="860" value="${bubbleW||''}"${bubbleSizeFixed?'':' disabled'} aria-label="말풍선 너비">
            </div>
          </div>
          <div class="prop-lhls-col">
            <div class="prop-icon-input">
              <span class="prop-xy-label">높이</span>
              <input type="number" class="prop-number" id="bubble-h-number" min="40" max="2000" value="${bubbleH||''}"${bubbleSizeFixed?'':' disabled'} aria-label="말풍선 최소 높이">
            </div>
          </div>
        </div>
        <div class="prop-row">
          <span class="prop-label">발신자 이름</span>
          <label class="prop-toggle" title="발신자 이름 표시 — 이름은 캔버스에서 더블클릭해 고친다">
            <input type="checkbox" id="bubble-show-sender" ${showSender ? 'checked' : ''}>
            <span class="prop-toggle-track"></span>
          </label>
        </div>
      </div>`;

  const _rotHost = tb?.closest?.('.frame-block[data-text-frame="true"]') || tb;   // 회전·반전이 걸리는 요소(js/asset-rotate.js _textFrameHost 와 같은 판정)
  /* 타입 칸 켜짐 = 정확히 한 칸(블럭 종류가 먼저 · 그다음 내용 칸 클래스) — 재설계 1차 ⑫ 매핑 교정 */
  const _kind = isSpeechBubble ? 'bubble' : isLiner ? 'liner' : isIconText ? 'icon' : currentClass;
  const _kb = (cls, label) => `<button class="prop-type-btn ${_kind === cls ? 'active' : ''}" data-cls="${cls}">${label}</button>`;

  /* 1120b F1(현빈 261120 「GIF 절을 별도로 · [+] 누르면 바로 gif 기능」) — 절 머리 «＋» 가 곧 GIF 단추(#open-anim-btn · 어드민 게이트·배선은 prop-text.js 그대로).
     꼴 = 절 머리 손잡이(.prop-chain-btn · 블록 Template ＋ 와 같은 클래스) · 몸 없음. */
  const _anim = (isOverlayTb || !showAnimGif) ? '' : `
        <button type="button" class="prop-chain-btn" id="open-anim-btn" title="애니메이션 GIF 만들기" aria-label="애니메이션 GIF 만들기">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 2v8M2 6h8"/></svg>
        </button>`;

  return {
    header: blockHeaderHTML({
      icon: `          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <line x1="1" y1="3" x2="11" y2="3"/><line x1="1" y1="6" x2="11" y2="6"/><line x1="1" y1="9" x2="7" y2="9"/>
          </svg>`,
      name: tb.dataset.layerName,
      defaultName: (isOverlayTb ? 'Overlay Text' : 'Text Block'),
      crumb: window.getBlockBreadcrumb(tb),
      id: tb.id,
    }),
    sections: [
      /* 재설계 1차 ⑫ — 타입 12칸 두 줄(시안 v9 덧 = 7·5: H1·H2·H3·Body·Cap·Bullet·Label / Tags·Icon·Bubble·Quote·Liner ·
         «Caption» 은 칸에 안 들어 앱 이름 «Cap» 그대로 · «Icon Text» → «Icon» 현빈 v9).
         ★켜짐은 «정확히 한 칸»(현빈 261120 교정 — PLAN «텍스트 종류 12칸 매핑»): 말풍선·곡선·아이콘텍스트는 자기 칸만(내용 칸 클래스가 무엇이든 Body 등은 안 켜짐).
         Tags(태그 = label-group 블럭 · 자기 패널) · Icon · Bubble · Liner 로 «바꾸기»는 앱에 없다 ⇒ disabled(자기 블럭이면 켜짐은 보인다).
         곡선·아이콘텍스트는 타입 절 없음(옛 판 그대로 · 시안 v10 실측도 칸 0 — 지디 261120).
         ★한 묶음(#txt-kind-group) 안 — Quote 가 묶음 밖 혼자일 때 «마지막 칸 왼 테두리 없음» 규칙(editor-props.css 세그먼트)에 잘렸다. */
      sec('kind', (isLiner || isIconText) ? '' : `
      <div class="prop-type-group" id="txt-kind-group">
        ${_kb('tb-h1', 'H1')}
        ${_kb('tb-h2', 'H2')}
        ${_kb('tb-h3', 'H3')}
        ${_kb('tb-body', 'Body')}
        ${_kb('tb-caption', 'Cap')}
        ${_kb('tb-bullet', 'Bullet')}
        ${_kb('tb-label', 'Label')}
        <button class="prop-type-btn" disabled title="Tags(태그 블럭) — 바꾸기는 아직 없다(상단 텍스트 메뉴에서 새로 만든다)">Tags</button>
        <button class="prop-type-btn${_kind === 'icon' ? ' active' : ''}" disabled title="Icon Text — 바꾸기는 아직 없다(상단 텍스트 메뉴에서 새로 만든다)">Icon</button>
        <button class="prop-type-btn${_kind === 'bubble' ? ' active' : ''}" disabled title="Bubble — 바꾸기는 아직 없다(상단 텍스트 메뉴에서 새로 만든다)">Bubble</button>
        <!-- ★1017t1m1 — 「Quote」는 data-cls 를 ★안 준다(블럭 교체라 클래스 교체 루프에 물리면 반쪽 동작). 배선 = wireTextToQuote. -->
        <button class="prop-type-btn" id="txt-to-quote" title="인용구 블럭으로 바꾸기 — 서식 일부가 사라집니다">Quote</button>
        <button class="prop-type-btn${_kind === 'liner' ? ' active' : ''}" disabled title="Liner — 바꾸기는 아직 없다(상단 텍스트 메뉴에서 새로 만든다)">Liner</button>
      </div>`, { id: 'type-section' }),
      sec('content', _bulletSec + _loremSec, { id: _bulletSec ? 'bullet-style-section' : undefined }),   /* 병합(탑 261122): dev 더미 글(_loremSec) 절 유지 · 불릿이면 옛 id 그대로 */
      /* ★2026-09-16g(T-001) — Ignore Auto Layout 토글은 Position «절 머리» 오른쪽 끝(Figma). id·배선 그대로 — 자리 = headTools. */
      sec('position', `${isOverlayBlock ? floatAlignRowHTML() : flowAlignDisabledHTML()}${/* ★현빈 261123 S1-4② — 떠 있는 글자도 같은 6칸(같은 부품 · 시안 8910 floatalign) · 배선 = prop-text-wireup-position.js → overlay-float wireFloatAlign */ ''}
      <div class="prop-lhls-row">
        <div class="prop-lhls-col">
          <div class="prop-icon-input">
            <span class="prop-xy-label">X</span>
            <input type="number" id="txt-x-number" value="${isOverlayBlock ? currentX : ''}" aria-label="X position"${isOverlayBlock ? '' : ` disabled aria-disabled="true" title="${POS_FLOW_WHY}"`}>
          </div>
        </div>
        <div class="prop-lhls-col">
          <div class="prop-icon-input">
            <span class="prop-xy-label">Y</span>
            <input type="number" id="txt-y-number" value="${isOverlayBlock ? currentY : ''}" aria-label="Y position"${isOverlayBlock ? '' : ` disabled aria-disabled="true" title="${POS_FLOW_WHY}"`}>
          </div>
        </div>
      </div>
      <span class="prop-field-label">Rotation</span>${/* Q17 · Q20(시안 v10) — 각도 칸(숫자 + °) + 90° · 좌우 · 상하 반전 한 줄. 반전 키 = 회전 host(텍스트 프레임 또는 글 블럭) dataset.flipH/V */
      rotRowHTML({ p: 'txt', numberId: 'txt-rot-number', value: currentRotation, flipH: _rotHost?.dataset?.flipH === '1', flipV: _rotHost?.dataset?.flipV === '1' })}`, { headTools: isOverlayTb ? '' : overlayToggleBtnHTML({ id: 'txt-overlay-toggle', active: isOverlayBlock }) }),
      sec('size', _sizeHtml),
      sec('layout', _alignBtns + _itbLayout),
      sec('padding', _paddingHtml),
      sec('appearance', _tagRadius),
      sec('typography', _typo + _tagShape),
      sec('fill', _fill + _tagBg),
      /* ★1012t1E1/E1 — Stroke(글자 윤곽선 — §8 「Stroke 절 안 행」) · Effects. 대상 밖 = 말풍선·태그·아이콘텍스트(+liner 는 Stroke 만). */
      (!stroke || isSpeechBubble || isLabel || isIconText || isLiner) ? sec('stroke', '') : strokeSection({ p: 'txt', stroke, colorHtml: strokeColorHtml }),
      _effects,
      sec('special', _bubble, { title: 'Bubble', id: 'txt-bubble-section' }),
      sec('special', '', { id: 'txt-anim-section', title: 'GIF', headTools: _anim }),   /* 1120b F1 — «GIF» 전용 절(머리 ＋ = GIF 단추) · 글 블럭 고유 절 = special(정본 export 는 제목 「Export」 고정 — 슬라이드·그리드 GIF 는 그대로 Export) */
    ],
    panel: 'text',   /* _section-spec SECTION_ORDER_EXCEPT.text — Layout(가로 정렬)이 Size 위(재설계 1차 ④) */
  };
}

/** 텍스트 패널 HTML(문자열) — 골든(tests/unit/typo-section-ssot T1)·유닛이 본다. 패널은 prop-text.js 가 renderPanel(buildTextPanelSpec(…)) 로 그린다. */
export function buildTextPropsHtml(state) {
  return buildPanelHTML(buildTextPanelSpec(state));
}

/** 클래식 증강(곡선 텍스트 liner-transform.js · 텍스트 효과 text-effect-transform.js)이 텍스트 패널에 절을 얹는 «한 자리». (U2)
 *  틀(sec · buildPanelHTML) 경유 ⇒ 머리·접기·data-sec 가 이관 절과 같고, 자리는 SECTION_ORDER 대로(⛔'beforeend' 로 끝에 붙이지 않는다).
 *  effects 는 «한 패널 한 key» — 이미 Effects 절이 있으면 그 몸에 덧붙인다. id 가 있으면 옛 절을 걷고 다시 놓는다.
 *  (클래식 스크립트라 window.placeTextPanelSection 으로 닿는다 · 여러 블럭 종류가 쓰게 되면 _panel-frame.js 로 올린다) */
export function placeTextPanelSection(panel, key, html, { title, id } = {}) {
  if (!panel) return;
  if (key === 'effects') {
    const body = panel.querySelector(':scope > .prop-section[data-sec="effects"] > .prop-sec-body');
    if (body) { body.insertAdjacentHTML('beforeend', html); return; }
  }
  if (id) panel.querySelector(`:scope > #${id}`)?.remove();
  const order = sectionOrderFor('text');
  const out = buildPanelHTML({ sections: [sec(key, html, { title, id })], panel: 'text' });
  // 자리 = 틀과 같은 정렬 수(sectionRank) — 9c2e19fcd ⑶ⓑ 뒤 GIF 는 Effects 바로 뒤라, 옛 «GIF 앞에» 규칙은 Curve 를 GIF 앞(Template 위)에 넣었다
  const rank = (e) => sectionRank(order, e.dataset.sec, e.querySelector(':scope > .prop-sec-head .prop-sec-title-text')?.textContent.trim());
  const want = sectionRank(order, key, title);
  const next = [...panel.querySelectorAll(':scope > .prop-section[data-sec]')].find((e) => rank(e) > want);
  if (next) next.insertAdjacentHTML('beforebegin', out); else panel.insertAdjacentHTML('beforeend', out);
}
if (typeof window !== 'undefined') window.placeTextPanelSection = placeTextPanelSection;

/**
 * Stroke 절 — 켜기 토글(절 머리 headTools) · 두께 · 색상 · 위치(내부/가운데/외부). (1012t1E1 · 1012t1H5 · U2 틀 이관)
 * ★배선은 prop-text-wireup-stroke.js wireStrokeSection({ p }) 한 벌 — id 는 옛 판과 같다(`${p}-stroke-section` = 절 id).
 * ★§8 — 글자 윤곽선은 «Stroke 절 안 행»이다(별도 절 없음).
 *
 * @param {object} o
 * @param {string} o.p          id 접두사 ('txt' | 'qt')
 * @param {{on:boolean,width:number,align:string}} o.stroke  지금 상태
 * @param {string} o.colorHtml  색 칸 마크업(부르는 쪽이 colorFieldHTML 로 만든다 — 단위 하네스가 color-picker 를 안 올린다)
 * @returns 틀 절(sec) — renderPanel/buildPanelHTML 의 sections 에 넣는다
 */
export function strokeSection({ p, stroke, colorHtml } = {}) {
  /* ★표준 Stroke 부품(현빈 261123 · 8910 strokestd2 1·2) — 꼴만 부품 · 배선은 그대로 prop-text-wireup-stroke.js(= 이 블럭의 어댑터: data-stroke-on/w/color/align · 레거시 해석)
     없음 = data-stroke-on 지움(굵기·색·위치 값은 남김 — 다시 켜면 그대로 · §4c 없음 열) · 굵기 0.5 걸음·하한 0.5 · 위치 = «살아 있음»(안쪽·가운데·바깥 다 그린다 · 실측 T1/T2/T4)
     옛 id 그대로: ${p}-stroke-on · -controls(몸) · -w-number · -align · -color · 절 id ${p}-stroke-section */
  return sec('stroke', strokeSectionHTML({ prefix: `${p}-stroke`, pop: { why: STROKE_POP_WHY.soon, styleWhy: STROKE_POP_WHY.soon }, colorHtml, width: stroke.width, maxWidth: 20, minWidth: 0.5, step: 0.5,
    align: stroke.align || 'outside', on: !!stroke.on, bodyId: `${p}-stroke-controls`, widthId: `${p}-stroke-w-number`, colorId: `${p}-stroke-color` }), {
    id: `${p}-stroke-section`,
    headTools: strokeHeadToolsHTML({ prefix: `${p}-stroke`, on: !!stroke.on }),   // 재설계 1차 ⑨ 머리 ＋/− 그대로(같은 체크박스 id)
  });
}

/** ★t4-01 — 텍스트 그림자 조절칸(X·Y·Blur·색상) 마크업 «한 벌». 옛 「Shadow」 절과 Effects 「그림자」 카드(js/effects-shadow.js)가 같이 부른다 — id 그대로라 배선은 wireShadowSection 하나. */
export function textShadowControlsHtml(_sh) {
  const _shHex = (_sh.color || '#000000').replace('#','').toUpperCase();
  const _shHexLow = '#' + _shHex.toLowerCase();
  const _shSwatchBg = (() => {
    const h = _shHex;
    const r = parseInt(h.slice(0,2), 16);
    const g = parseInt(h.slice(2,4), 16);
    const b = parseInt(h.slice(4,6), 16);
    const a = Math.max(0, Math.min(1, (_sh.alpha ?? 100) / 100));
    return a >= 1 ? _shHexLow : `rgba(${r},${g},${b},${a})`;
  })();
  return `      <div id="txt-shadow-controls" style="display:${_sh.enabled ? 'block' : 'none'}">
        <div class="prop-row">
          <span class="prop-label">X</span>
          <input type="range" class="prop-slider" id="txt-shadow-x-slider" min="-20" max="20" step="1" value="${_sh.x}">
          <input type="number" class="prop-number" id="txt-shadow-x-number" min="-20" max="20" value="${_sh.x}">
        </div>
        <div class="prop-row">
          <span class="prop-label">Y</span>
          <input type="range" class="prop-slider" id="txt-shadow-y-slider" min="-20" max="20" step="1" value="${_sh.y}">
          <input type="number" class="prop-number" id="txt-shadow-y-number" min="-20" max="20" value="${_sh.y}">
        </div>
        <div class="prop-row">
          <span class="prop-label">Blur</span>
          <input type="range" class="prop-slider" id="txt-shadow-blur-slider" min="0" max="40" step="1" value="${_sh.blur}">
          <input type="number" class="prop-number" id="txt-shadow-blur-number" min="0" max="40" value="${_sh.blur}">
        </div>
        <div class="prop-color-row">
          <span class="prop-label">색상</span>
          <div class="prop-color-field">
            <div class="prop-color-swatch" style="background:${_shSwatchBg}">
              <input type="color" id="txt-shadow-color" value="${_shHexLow}">
            </div>
            <input type="text" class="prop-color-hex" id="txt-shadow-color-hex" value="${_shHex}" maxlength="7" aria-label="Shadow color">
            <label class="prop-color-alpha" title="Opacity">
              <input type="text" class="prop-color-alpha-input" id="txt-shadow-color-alpha" value="${_sh.alpha}" aria-label="Shadow opacity">
              <span class="prop-color-alpha-suffix">%</span>
            </label>
          </div>
        </div>
      </div>`;
}
