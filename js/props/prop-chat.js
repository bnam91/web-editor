import { propPanel } from '../globals.js';
import { blockHeaderHTML } from './_helpers.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';
import { buildTypographySectionHtml } from './_typo-section.js';   // ⛔글자 크기 칸을 «손으로» 만들지 마라 — 정본은 여기 하나다(tests/unit/typo-section-ssot.test.mjs T2)
import { CHAT_NUM_BOUNDS } from '../blocks/chat-bounds.js';   /* ⛔chat-block.js 에서 끌지 마라 — number-field-contract 하네스의 모듈 그래프를 통째로 키워 __ready 가 안 켜진다(그 파일 머리말) */
/* ★⒝(2026-10-06) — 숫자 손잡이의 min/max 는 ★모델의 경계 표에서 «파생»한다. ⛔여기 숫자를 적지 마라.
 *   무엇이 있었나(실측): 패널이 모델보다 좁아 ★일곱 자리에서 사람이 못 넣는 값이 있었다 —
 *     fontSize 10~60(모델 4~400) · gap 0~40(0~400) · radius 0~40(0~400) · padding 0~60(0~400) ·
 *     profileOffsetY ±40(±400) · profileGap 0~40(0~400) · profileSize 24~120(24~400).
 *   «값은 받는데 누를 데가 좁다» ⇒ MCP 로는 되고 사람은 안 되는 자리가 일곱이었다.
 * ⛔슬라이더와 숫자칸에 ★다른 상한을 주지 마라 — range 는 value>max 를 max 로 «조용히 깎는다»
 *   (숫자칸에 400 을 넣고 슬라이더를 건드리면 60 으로 되돌아간다). 둘은 ★같은 B 를 쓴다. */
const B = CHAT_NUM_BOUNDS;
const CHB_FONT_MIN = B.fontSize.min, CHB_FONT_MAX = B.fontSize.max;
/* ═══ ★다음 판 쪽지 — 「챗 블럭 ★폭을 숫자로 정하기」 (2026-10-06 ⒜ 조사 · 지디 ㉡ 보류 판정) ═══════════════
 * ★여기에 ★「너비」 줄이 ★없다. ⛔빠뜨린 것이 아니라 ★판정으로 미룬 것이다 — 까닭을 적어 둔다.
 * ★현빈 ⒜ 원문은 「챗 블럭 너비가 ★더 늘어날 순 없는지?」였고, ★그 요구는 ⒜-1 로 섰다(실측):
 *     말풍선 최대폭 100 ＋ 블럭 패딩 0 ＋ 「패딩 제외」 토글 ⇒ ★535 → 860px(캔버스 전부 · 1.61배)
 *   ★그리고 ★캔버스가 ★하드 상한이다(실측: 캔버스 860 · 섹션 블럭 860 · 챗 full-bleed 860).
 *   ⇒ ★★블럭 자체 너비 손잡이는 ★「더 넓게」를 ★0px 도 못 준다 — 상한이 «그릇 폭»이고 full-bleed 가 이미 그릇을 벗는다.
 *     (그리드도 같다 — width:3000 을 모델은 받지만 ★그려진 폭은 그릇 폭이다. grid-block.js renderGridBlock 의 max-width min)
 * ⇒ ★그래서 이것은 「더 넓게」가 아니라 ★「폭을 ★숫자로 ★정하기(＝좁히기)」라는 ★다른 요구다.
 * ★★짓게 되면 ⛔새로 만들지 마라 — ★그리드의 그 줄에서 ★파생시켜라:
 *     js/props/prop-grid.js `_grdWidthRowHtml` (슬라이더 ＋ 숫자 ＋ 「100%」 단추)
 *     ＋ `_grdWidthMax`(상한 = 담는 그릇의 «그려진» 내용 폭) ＋ 빈 칸 = 「자동」 규약
 *   ⇒ ★공용 함수로 뽑아 ★그리드·챗이 같이 부르고, ★무력화하면 ★2곳 빨강인 쌍을 같이 걸어라.
 *   ＋모델에 `width` 필드 1개(CHAT_NUM_BOUNDS 에 한 줄) · ★렌더는 full-bleed 분기와 ★한 자리에서 폭을 정해야 한다
 *     (지금도 chat-block.js 에 그 인라인 쓰기가 두 줄이다 — 각자 쓰면 조용히 갈린다).
 * ⛔그리고 ★이 쪽지를 지우기 전에 ★현빈께 ★「폭을 숫자로 정하고 싶으신가」를 ★먼저 물어라. ★아직 안 여쭸다.
 * ═════════════════════════════════════════════════════════════════════════════════════════ */
/* ★★⒝ 뒤처리(2026-10-06) — 경계 명부가 ★«셋»이었다: ㉠모델 _setInt ㉡패널 min/max 속성 ㉢★핸들러 안 리터럴.
 *   속성만 넓히고 ㉢ 을 안 봐서, 패딩 숫자칸에 400 을 넣고 Enter 하면 모델이 ★60 이 됐다(옛 상한) —
 *   ★신설 검사 chat-slider-number-bound S2 가 그 «전제 단언»에서 잡았다(S1 속성 일치는 초록이었다 ⇒ 속성만으로는 못 잰다).
 *   ⛔prop-number-commit-guard.js 머리말이 바로 이것을 경고한다: 「핸들러 안의 Math.min/Math.max 를 고치면
 *     칸이 보이는 범위와 실제 범위가 다시 갈린다」. ⇒ ㉢ 도 ★같은 표에서 «파생»시킨다.
 *   ★왜 아예 지우지 않나 — range(슬라이더) 는 type=number 가 아니라 그 가드의 회원이 아니다. 클램프를 지우면
 *     슬라이더 쪽 길이 무방비가 된다. ⇒ «지우지 말고 파생»이 이 자리의 답이다(radius·gap 은 숫자칸뿐이라 원래 클램프가 없다).
 * @param {string} key CHAT_NUM_BOUNDS 의 키 · @param {number} dflt parseInt 실패 시 기본값 */
const chbClamp = (key, v, dflt) => {
  const b = B[key];
  /* ⛔`?? dflt` 금지 — parseInt('abc') = NaN 이고 `NaN ?? x` 는 ★NaN 이다(?? 는 null/undefined 만 걸러낸다).
     ★그러면 dataset 에 문자열 "NaN" 이 저장된다 — prop-number-commit-guard.js 머리말의 `prop-sticker.js _bindTPair` 그 사고다.
     ★`|| dflt` 는 원래 일곱 자리가 쓰던 꼴이고, 0 이 dflt 로 바뀌는 갈래도 원래 동작과 한 글자도 안 다르다
     (profileSize 0→48 · bubbleMaxW 0→70 — 그 뒤 min 이 다시 잡는다). */
  return Math.max(b.min, Math.min(b.max, parseInt(v) || dflt));
};

function _chatToken(name, fallback) {
  if (typeof getComputedStyle !== 'function') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function showChatProperties(block) {
  const messages   = JSON.parse(block.dataset.messages  || '[]');
  const gap        = parseInt(block.dataset.gap)        || 8;
  const fontSize   = parseInt(block.dataset.fontSize)   || 32;
  const bgLeft     = block.dataset.bgLeft               || _chatToken('--preset-chat-bg-left', '#e5e5ea');
  const bgRight    = block.dataset.bgRight              || _chatToken('--preset-chat-bg-right', '#1888fe');
  const bgLeftAlpha  = parseAlphaFromColor(bgLeft);
  const bgRightAlpha = parseAlphaFromColor(bgRight);
  const colorLeft  = block.dataset.colorLeft            || _chatToken('--preset-chat-text-left', '#111111');
  const colorRight = block.dataset.colorRight           || _chatToken('--preset-chat-text-right', '#ffffff');
  const radius     = parseInt(block.dataset.radius)     || 16;
  const padding    = parseInt(block.dataset.padding)    || 16;
  // 말풍선 내부 패딩 — UI 표시 기본 12(dataset에는 실제 조절 시에만 기록 → 미설정 블록 무회귀)
  const bubblePadding = (block.dataset.bubblePadding != null && block.dataset.bubblePadding !== '')
    ? parseInt(block.dataset.bubblePadding) : 12;
  // 말풍선 최대폭(%) — 미설정 시 70(기존 CSS max-width:70%와 동일)
  const bubbleMaxW = (block.dataset.bubbleMaxW != null && block.dataset.bubbleMaxW !== '')
    ? parseInt(block.dataset.bubbleMaxW) : 70;
  // 카톡식 프로필 (default OFF — 호환성)
  const showProfile = block.dataset.showProfile === '1';
  const showName    = block.dataset.showName === '1';
  const defaultProfileSize = Math.max(48, Math.round(fontSize * 1.6));
  const profileSize    = parseInt(block.dataset.profileSize) || defaultProfileSize;
  const profileOffsetY = parseInt(block.dataset.profileOffsetY) || 0;
  const profileGap     = (block.dataset.profileGap != null) ? parseInt(block.dataset.profileGap) : 8;
  // 말풍선 꼬리 크기(%) — 미설정 시 100(기본)
  const tailScale = (block.dataset.tailScale != null && block.dataset.tailScale !== '')
    ? parseInt(block.dataset.tailScale) : 100;
  // 패딩 제외(full-bleed) — 섹션 좌우패딩 무시
  const fullBleed = block.dataset.fullBleed === 'true';

  function rerender() {
    window.renderChatBlock(block);
    window.triggerAutoSave?.();
  }

  /* ★프로필 이름은 틀에 안 넣는다 (T-049) — 사용자가 짓는 글자다.
     옛 판은 큰따옴표만 실체참조로 바꿨는데, 그건 «앰퍼샌드를 안 덮어» 멀쩡한 이름의 표시가
     깨지는 쪽이기도 했다. value 프로퍼티로 넣으면 둘 다 없어진다.
     ⛔이름을 «검사»하지 마라 — 따옴표 든 멀쩡한 이름이 죽는다. */
  function fillProfileNames(root) {
    root?.querySelectorAll('.chb-profile-name-input').forEach(inp => {
      const m = messages[parseInt(inp.dataset.idx)];
      inp.value = (m && m.profileName) || '';
    });
  }

  function msgListHtml() {
    return messages.map((m, i) => {
      const isLeft = m.align !== 'right';
      const showProfileFields = (block.dataset.showProfile === '1');
      const hideThisProfile = m.hideProfile === true;
      const pImg  = m.profileImg || '';
      const hasStars = (m.stars != null && m.stars !== '');
      const starsVal = hasStars ? Math.max(0, Math.min(5, parseInt(m.stars) || 0)) : 5;
      const starsPreview = '★'.repeat(starsVal) + '☆'.repeat(5 - starsVal);
      const starsRowHtml = `
        <div class="chb-prop-stars-row" data-idx="${i}" style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:11px;white-space:nowrap">
          <label style="display:inline-flex;align-items:center;gap:3px;cursor:pointer;color:#aaa;flex-shrink:0" title="말풍선 상단에 별점 표시">
            <input type="checkbox" class="chb-stars-toggle" data-idx="${i}" ${hasStars ? 'checked' : ''}>
            <span>별점</span>
          </label>
          <input type="number" class="chb-stars-num prop-number" data-idx="${i}" min="0" max="5" value="${starsVal}" ${hasStars ? '' : 'disabled'} style="width:48px">
          <span class="chb-stars-preview" data-idx="${i}" style="color:#ff8a00;letter-spacing:1px;${hasStars ? '' : 'opacity:0.3'}">${starsPreview}</span>
        </div>`;
      const profileFieldsHtml = showProfileFields ? `
        <div class="chb-prop-profile-row" data-idx="${i}" style="display:flex;align-items:center;gap:6px;margin-top:6px;padding-top:6px;border-top:1px dashed #333;font-size:11px;white-space:nowrap">
          <div class="chb-profile-thumb" data-idx="${i}" title="클릭하여 프로필 이미지 업로드"
            style="width:28px;height:28px;border-radius:50%;background:${pImg ? `url('${pImg}') center/cover` : 'linear-gradient(135deg,#666,#888)'};border:1px solid #444;cursor:pointer;flex-shrink:0"></div>
          <input type="text" class="chb-profile-name-input" data-idx="${i}" placeholder="프로필 이름"
            style="flex:1;min-width:0;width:auto;max-width:none;min-height:24px;background:#1c1c1c;border:1px solid #2a2a2a;border-radius:3px;color:#ccc;font-size:11px;padding:2px 6px">
          <label style="display:inline-flex;align-items:center;gap:3px;cursor:pointer;color:#aaa;flex-shrink:0;white-space:nowrap" title="이 메시지만 프로필 숨김(공간 유지 → 들여쓰기 효과)">
            <input type="checkbox" class="chb-hide-profile" data-idx="${i}" ${hideThisProfile ? 'checked' : ''}>
            <span>숨김</span>
          </label>
          <input type="file" class="chb-profile-file" data-idx="${i}" accept="image/*" style="display:none">
        </div>` : '';
      return `
      <div class="chb-prop-item" data-idx="${i}"
        style="margin-bottom:8px;padding:8px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px">
        <div style="display:flex;align-items:center;gap:6px">
          <div style="display:flex;gap:2px">
            <button class="prop-align-btn chb-align-btn ${isLeft ? 'active' : ''}" data-idx="${i}" data-dir="left" title="좌측 정렬"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/><line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/></svg></button>
            <button class="prop-align-btn chb-align-btn ${!isLeft ? 'active' : ''}" data-idx="${i}" data-dir="right" title="우측 정렬"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/><line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/></svg></button>
          </div>
          <span style="flex:1;font-size:10px;color:#666">메시지 ${i + 1}</span>
          <button class="prop-btn prop-btn-danger chb-del-btn" data-idx="${i}" title="삭제" style="padding:4px 8px;font-size:11px">✕</button>
        </div>
        ${profileFieldsHtml}
        ${starsRowHtml}
        ${(Array.isArray(m.lines) && m.lines.length)
          /* ★BT2 D4 — 줄이 있는 메시지의 text 는 «줄 글자 거울»이다. 여기 글자칸을 두면 «쳐도 화면이 안 바뀐다». */
          ? `<div class="prop-hint chb-lines-hint" data-idx="${i}" style="text-align:left;margin-top:6px;">줄 ${m.lines.length}개 — 캔버스에서 이 메시지를 한 번 더 누르면 줄 편집</div>`
          : `<textarea class="prop-color-hex chb-text-input" data-idx="${i}" rows="2"
          style="width:100%;box-sizing:border-box;min-height:42px;resize:vertical;font-family:inherit;line-height:1.4;padding:6px 8px;margin-top:6px">${(m.text || '').replace(/</g, '&lt;')}</textarea>`}
      </div>`;
    }).join('');
  }

  propPanel.innerHTML = `
    <div class="prop-section">
${blockHeaderHTML({
      icon: `          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <path d="M1 2a1 1 0 011-1h8a1 1 0 011 1v6a1 1 0 01-1 1H7l-2 2V9H2a1 1 0 01-1-1V2z"/>
          </svg>`,
      name: block.dataset.layerName,
      defaultName: 'Chat Block',
      crumb: window.getBlockBreadcrumb?.(block) || '',
      id: block.id,
    })}
    </div>

    ${/* ★⒝(2026-10-06 · 지디 GO) — 「폰트 크기」가 여기 «손으로 만든 숫자칸»이었다(min 10 · max 60).
          ⛔그게 ㉡ 복사본이었다: 절의 정본은 _typo-section.js 하나이고 텍스트·모달·그리드가 그걸 쓴다.
            챗만 날 <input> 을 들고 있어서 ⑴슬라이더도 폰트도 굵기도 없고 ⑵모델이 받는 4~400 중 «10~60 만» 열려 있었다
            (chat-block.js :503 `_setInt('fontSize','fontSize',4,400)`). ⇒ 사람은 60 까지, MCP 는 400 까지 — 패널이 340 을 가렸다.
          ★★왜 아무 검사도 안 빨개졌나 — typo-section-ssot 의 PANELS 가 «셋»이었고 `assert.equal(PANELS.length, 3)` 이
            그 셋을 못박았다. prop-chat.js 는 ★분모 밖이라, 「절을 베끼지 마라」 검사가 초록인 채로 사본이 살았다.
            ⇒ 그 명부에 챗을 넣었다(이제 넷). ★「검사가 있다」는 «그 분모 안에서만» 참이다.
          ⛔renderChatBlock 이 읽는 글자 값은 dataset.fontSize «하나»다(chat-block.js :47 → :127 의 font-size).
            그래서 Font 피커·굵기·B/I/S/H·줄간격·자간을 «끈다» — 펴 두면 「눌리는데 아무 일도 안 난다」가 된다
            (그리드의 showHighlight:false 가 같은 까닭으로 같은 일을 한다 — prop-grid.js).
            ⇒ 그 넷을 켜려면 렌더러가 새 dataset 키를 «읽기 시작»해야 한다. 그건 별건 발주다. */''}
    ${buildTypographySectionHtml({
      p: 'chb-typo',
      size: fontSize,
      sizeMin: CHB_FONT_MIN, sizeMax: CHB_FONT_MAX,
      showFont: false, showWeight: false, showStyleGroup: false,
      showLetterSpacing: false, showLineHeight: false, showHighlight: false,
    })}

    <div class="prop-section">
      <div class="prop-section-title">Style</div>
      <div class="prop-row">
        <span class="prop-label">말풍선 곡률</span>
        <input type="number" id="chb-radius" class="prop-color-hex" value="${radius}" min="${B.radius.min}" max="${B.radius.max}" style="width:60px">
      </div>
      <div class="prop-row">
        <span class="prop-label">간격</span>
        <input type="number" id="chb-gap" class="prop-color-hex" value="${gap}" min="${B.gap.min}" max="${B.gap.max}" style="width:60px">
      </div>
      <div class="prop-row">
        <span class="prop-label">패딩</span>
        <input type="range" class="prop-slider" id="chb-padding-range" min="${B.padding.min}" max="${B.padding.max}" value="${padding}">
        <input type="number" class="prop-number" id="chb-padding-val" min="${B.padding.min}" max="${B.padding.max}" value="${padding}" style="width:54px">
      </div>
      <div class="prop-row">
        <span class="prop-label">말풍선 패딩</span>
        <input type="range" class="prop-slider" id="chb-bubble-padding-range" min="${B.bubblePadding.min}" max="${B.bubblePadding.max}" value="${bubblePadding}">
        <input type="number" class="prop-number" id="chb-bubble-padding-val" min="${B.bubblePadding.min}" max="${B.bubblePadding.max}" value="${bubblePadding}" style="width:54px">
      </div>
      <div class="prop-row">
        <span class="prop-label">말풍선 최대폭</span>
        <input type="range" class="prop-slider" id="chb-bubble-maxw-range" min="${B.bubbleMaxW.min}" max="${B.bubbleMaxW.max}" value="${bubbleMaxW}">
        <input type="number" class="prop-number" id="chb-bubble-maxw-val" min="${B.bubbleMaxW.min}" max="${B.bubbleMaxW.max}" value="${bubbleMaxW}" style="width:54px">
      </div>
      <div class="prop-row">
        <span class="prop-label">꼬리 크기</span>
        <input type="range" class="prop-slider" id="chb-tail-range" min="${B.tailScale.min}" max="${B.tailScale.max}" value="${tailScale}">
        <input type="number" class="prop-number" id="chb-tail-val" min="${B.tailScale.min}" max="${B.tailScale.max}" value="${tailScale}" style="width:54px">
      </div>
      <div class="prop-row">
        <span class="prop-label">패딩 제외</span>
        <label class="prop-toggle">
          <input type="checkbox" id="chb-fullbleed-toggle" ${fullBleed ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Color</div>
      <div class="prop-row">
        <span class="prop-label">좌측 배경</span>
        ${colorFieldHTML({ idPrefix: 'chb-bg-left', hex: bgLeft, alpha: bgLeftAlpha })}
      </div>
      <div class="prop-row">
        <span class="prop-label">우측 배경</span>
        ${colorFieldHTML({ idPrefix: 'chb-bg-right', hex: bgRight, alpha: bgRightAlpha })}
      </div>
      <div class="prop-row">
        <span class="prop-label">좌측 글자</span>
        ${colorFieldHTML({ idPrefix: 'chb-color-left', hex: colorLeft, alpha: parseAlphaFromColor(colorLeft) })}
      </div>
      <div class="prop-row">
        <span class="prop-label">우측 글자</span>
        ${colorFieldHTML({ idPrefix: 'chb-color-right', hex: colorRight, alpha: parseAlphaFromColor(colorRight) })}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Profile</div>
      <div class="prop-row" style="gap:12px;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer">
          <input type="checkbox" id="chb-show-profile" ${showProfile ? 'checked' : ''}>
          <span>프로필 이미지</span>
        </label>
        <label style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer">
          <input type="checkbox" id="chb-show-name" ${showName ? 'checked' : ''}>
          <span>이름 표시</span>
        </label>
      </div>
      <div class="prop-row">
        <span class="prop-label">크기</span>
        <input type="range" class="prop-slider" id="chb-profile-size-range" min="${B.profileSize.min}" max="${B.profileSize.max}" value="${profileSize}">
        <input type="number" id="chb-profile-size-num" class="prop-number" value="${profileSize}" min="${B.profileSize.min}" max="${B.profileSize.max}" style="width:54px">
      </div>
      <div class="prop-row">
        <span class="prop-label">Y 위치</span>
        <input type="range" class="prop-slider" id="chb-profile-y-range" min="${B.profileOffsetY.min}" max="${B.profileOffsetY.max}" value="${profileOffsetY}">
        <input type="number" id="chb-profile-y-num" class="prop-number" value="${profileOffsetY}" min="${B.profileOffsetY.min}" max="${B.profileOffsetY.max}" style="width:54px">
      </div>
      <div class="prop-row">
        <span class="prop-label">간격</span>
        <input type="range" class="prop-slider" id="chb-profile-gap-range" min="${B.profileGap.min}" max="${B.profileGap.max}" value="${profileGap}">
        <input type="number" id="chb-profile-gap-num" class="prop-number" value="${profileGap}" min="${B.profileGap.min}" max="${B.profileGap.max}" style="width:54px">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Messages</div>
      <div id="chb-msg-list">${msgListHtml()}</div>
      <button class="prop-btn-full" id="chb-add-msg" style="margin-top:6px">+ 대화 추가하기</button>
    </div>
  `;
  fillProfileNames(propPanel);

  // ─── 프로필 토글 ───────────────────────────────────────────
  propPanel.querySelector('#chb-show-profile')?.addEventListener('change', e => {
    block.dataset.showProfile = e.target.checked ? '1' : '0';
    window.pushHistory?.('프로필 토글');
    rerender();
    rebindMsgList();
  });
  propPanel.querySelector('#chb-show-name')?.addEventListener('change', e => {
    block.dataset.showName = e.target.checked ? '1' : '0';
    window.pushHistory?.('이름 토글');
    rerender();
  });
  // 프로필 크기 — range/number 동기화
  const sizeRange = propPanel.querySelector('#chb-profile-size-range');
  const sizeNum   = propPanel.querySelector('#chb-profile-size-num');
  const setSize = (v) => {
    const n = chbClamp('profileSize', v, 48);
    block.dataset.profileSize = String(n);
    if (sizeRange) sizeRange.value = String(n);
    if (sizeNum)   sizeNum.value   = String(n);
    rerender();
  };
  sizeRange?.addEventListener('input',  e => setSize(e.target.value));
  sizeRange?.addEventListener('change', () => window.pushHistory?.());
  sizeNum?.addEventListener('input',    e => setSize(e.target.value));
  sizeNum?.addEventListener('change',   () => window.pushHistory?.());
  // 프로필 Y 위치 — range/number 동기화
  const yRange = propPanel.querySelector('#chb-profile-y-range');
  const yNum   = propPanel.querySelector('#chb-profile-y-num');
  const setY = (v) => {
    const n = chbClamp('profileOffsetY', v, 0);
    block.dataset.profileOffsetY = String(n);
    if (yRange) yRange.value = String(n);
    if (yNum)   yNum.value   = String(n);
    rerender();
  };
  yRange?.addEventListener('input',  e => setY(e.target.value));
  yRange?.addEventListener('change', () => window.pushHistory?.());
  yNum?.addEventListener('input',    e => setY(e.target.value));
  yNum?.addEventListener('change',   () => window.pushHistory?.());
  // 프로필 ↔ 말풍선 간격
  const gapRange = propPanel.querySelector('#chb-profile-gap-range');
  const gapNum   = propPanel.querySelector('#chb-profile-gap-num');
  const setGap = (v) => {
    const n = chbClamp('profileGap', v, 0);
    block.dataset.profileGap = String(n);
    if (gapRange) gapRange.value = String(n);
    if (gapNum)   gapNum.value   = String(n);
    rerender();
  };
  gapRange?.addEventListener('input',  e => setGap(e.target.value));
  gapRange?.addEventListener('change', () => window.pushHistory?.());
  gapNum?.addEventListener('input',    e => setGap(e.target.value));
  gapNum?.addEventListener('change',   () => window.pushHistory?.());

  // ─── 스타일 이벤트 ────────────────────────────────────────────
  const paddingRange = propPanel.querySelector('#chb-padding-range');
  const paddingVal   = propPanel.querySelector('#chb-padding-val');
  const applyPadding = v => {
    v = chbClamp('padding', v, 0);
    block.dataset.padding = v;
    block.style.padding = v + 'px ' + v + 'px';
    paddingRange.value = v; paddingVal.value = v;
    window.triggerAutoSave?.();
  };
  paddingRange.addEventListener('input', () => applyPadding(paddingRange.value));
  paddingVal.addEventListener('change', () => applyPadding(paddingVal.value));

  // 말풍선 내부 패딩 — .chb-bubble 인라인이라 rerender 필수(outer 패딩과 핸들러 패턴 다름).
  // profileGap 방식 미러: input→rerender, change(드래그 놓기)→pushHistory.
  const bpRange = propPanel.querySelector('#chb-bubble-padding-range');
  const bpVal   = propPanel.querySelector('#chb-bubble-padding-val');
  const applyBubblePadding = v => {
    const n = chbClamp('bubblePadding', v, 0);
    block.dataset.bubblePadding = String(n);
    if (bpRange) bpRange.value = String(n);
    if (bpVal)   bpVal.value   = String(n);
    rerender();
  };
  bpRange?.addEventListener('input',  () => applyBubblePadding(bpRange.value));
  bpRange?.addEventListener('change', () => window.pushHistory?.('말풍선 패딩'));
  bpVal?.addEventListener('change',   () => { applyBubblePadding(bpVal.value); window.pushHistory?.('말풍선 패딩'); });

  // 말풍선 최대폭(%) — bubblePadding 패턴 미러. 기존 CSS 캡(70%)을 조절 가능하게.
  const bmwRange = propPanel.querySelector('#chb-bubble-maxw-range');
  const bmwVal   = propPanel.querySelector('#chb-bubble-maxw-val');
  const applyBubbleMaxW = v => {
    const n = chbClamp('bubbleMaxW', v, 70);
    block.dataset.bubbleMaxW = String(n);
    if (bmwRange) bmwRange.value = String(n);
    if (bmwVal)   bmwVal.value   = String(n);
    rerender();
  };
  bmwRange?.addEventListener('input',  () => applyBubbleMaxW(bmwRange.value));
  bmwRange?.addEventListener('change', () => window.pushHistory?.('말풍선 최대폭'));
  bmwVal?.addEventListener('change',   () => { applyBubbleMaxW(bmwVal.value); window.pushHistory?.('말풍선 최대폭'); });

  // 말풍선 꼬리 크기 — range/number 동기화. profileGap 패턴 미러(input→rerender, change→pushHistory).
  const tailRange = propPanel.querySelector('#chb-tail-range');
  const tailVal   = propPanel.querySelector('#chb-tail-val');
  const applyTail = v => {
    const n = chbClamp('tailScale', v, 0);
    block.dataset.tailScale = String(n);
    if (tailRange) tailRange.value = String(n);
    if (tailVal)   tailVal.value   = String(n);
    rerender();
  };
  tailRange?.addEventListener('input',  () => applyTail(tailRange.value));
  tailRange?.addEventListener('change', () => window.pushHistory?.('꼬리 크기'));
  tailVal?.addEventListener('change',   () => { applyTail(tailVal.value); window.pushHistory?.('꼬리 크기'); });

  // 패딩 제외(full-bleed) 토글 — 섹션 좌우패딩 무시. 적용/해제 모두 renderChatBlock이 처리.
  propPanel.querySelector('#chb-fullbleed-toggle')?.addEventListener('change', e => {
    block.dataset.fullBleed = e.target.checked ? 'true' : 'false';
    window.pushHistory?.('패딩 제외');
    rerender();
  });

  /* ★⒝ 글자 크기 — 공용 Typography 절의 숫자칸(#chb-typo-size-number). 핸들러는 옛 #chb-fontsize 와 «한 글자도 다르지 않다».
     ⛔클램프·빈칸 처리·칸 되쓰기를 여기 적지 «않는다» — prop-number-commit-guard.js 머리말의 규약이다:
       「값의 SSOT 는 칸 자신의 min/max 속성이다. 핸들러 안의 Math.min/Math.max 를 고치면 칸이 보이는 범위와
        실제 범위가 다시 갈린다.」 그 가드는 «목록이 아니라 type=number 로» 센다 ⇒ 이 칸도 자동 회원이다.
     ★그래서 범위를 넓히는 일은 ★min/max 속성 하나로 끝난다(CHAT_NUM_BOUNDS → sizeMin/sizeMax). */
  const _fsEl = propPanel.querySelector('#chb-typo-size-number');
  _fsEl?.addEventListener('input', e => {
    block.dataset.fontSize = e.target.value;
    rerender();
  });
  _fsEl?.addEventListener('change', () => {
    window.pushHistory?.();
  });
  propPanel.querySelector('#chb-radius').addEventListener('input', e => {
    block.dataset.radius = e.target.value;
    rerender();
  });
  propPanel.querySelector('#chb-radius').addEventListener('change', () => {
    window.pushHistory?.();
  });
  propPanel.querySelector('#chb-gap').addEventListener('input', e => {
    block.dataset.gap = e.target.value;
    rerender();
  });
  propPanel.querySelector('#chb-gap').addEventListener('change', () => {
    window.pushHistory?.();
  });

  // ─── 색상 이벤트 ─────────────────────────────────────────────
  wireColorField('chb-bg-left', {
    initialAlpha: bgLeftAlpha,
    onApply: (c) => { block.dataset.bgLeft = c; rerender(); },
    onCommit: () => window.pushHistory?.(),
  });
  wireColorField('chb-bg-right', {
    initialAlpha: bgRightAlpha,
    onApply: (c) => { block.dataset.bgRight = c; rerender(); },
    onCommit: () => window.pushHistory?.(),
  });
  wireColorField('chb-color-left', {
    initialAlpha: parseAlphaFromColor(colorLeft),
    onApply: (c) => { block.dataset.colorLeft = c; rerender(); },
    onCommit: () => window.pushHistory?.(),
  });
  wireColorField('chb-color-right', {
    initialAlpha: parseAlphaFromColor(colorRight),
    onApply: (c) => { block.dataset.colorRight = c; rerender(); },
    onCommit: () => window.pushHistory?.(),
  });

  // ─── 대화 목록 이벤트 ────────────────────────────────────────
  function rebindMsgList() {
    const list = propPanel.querySelector('#chb-msg-list');
    list.innerHTML = msgListHtml();
    fillProfileNames(list);
    bindMsgEvents();
  }

  function bindMsgEvents() {
    // 텍스트 수정
    propPanel.querySelectorAll('.chb-text-input').forEach(inp => {
      // input: blur 전이라도 in-memory messages·dataset를 실시간 동기화
      // (add/delete가 rebindMsgList로 messages를 재직렬화할 때 미커밋 편집 유실 방지)
      inp.addEventListener('input', e => {
        const i = parseInt(e.target.dataset.idx);
        messages[i].text = e.target.value;
        block.dataset.messages = JSON.stringify(messages);
      });
      inp.addEventListener('change', e => {
        const i = parseInt(e.target.dataset.idx);
        messages[i].text = e.target.value;
        block.dataset.messages = JSON.stringify(messages);
        rerender();
      });
    });
    // 방향 버튼
    propPanel.querySelectorAll('.chb-align-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const i   = parseInt(btn.dataset.idx);
        const dir = btn.dataset.dir;
        messages[i].align = dir;
        block.dataset.messages = JSON.stringify(messages);
        rerender();
        rebindMsgList();
      });
    });
    // 삭제
    propPanel.querySelectorAll('.chb-del-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const i = parseInt(btn.dataset.idx);
        window.pushHistory?.();
        window.grdSetActiveLine?.(block, null);   // ★BT2 — 메시지 번호가 밀린다. 고른 줄 주소를 놓는다(낡은 주소 = 엉뚱한 메시지)
        messages.splice(i, 1);
        block.dataset.messages = JSON.stringify(messages);
        rerender();
        rebindMsgList();
      });
    });
    // 메시지별 hideProfile 체크박스
    propPanel.querySelectorAll('.chb-hide-profile').forEach(cb => {
      cb.addEventListener('change', e => {
        const i = parseInt(cb.dataset.idx);
        messages[i].hideProfile = e.target.checked;
        block.dataset.messages = JSON.stringify(messages);
        window.pushHistory?.('프로필 숨김 토글');
        rerender();
      });
    });
    // 별점 토글 — on이면 stars 부여(현재 num값 또는 5), off면 stars 제거
    propPanel.querySelectorAll('.chb-stars-toggle').forEach(cb => {
      cb.addEventListener('change', e => {
        const i = parseInt(cb.dataset.idx);
        if (e.target.checked) {
          const numEl = propPanel.querySelector(`.chb-stars-num[data-idx="${i}"]`);
          messages[i].stars = Math.max(0, Math.min(5, parseInt(numEl?.value) || 5));
        } else {
          delete messages[i].stars;
        }
        block.dataset.messages = JSON.stringify(messages);
        window.pushHistory?.('별점 토글');
        rerender();
        rebindMsgList();
      });
    });
    // 별점 점수 — 0~5
    propPanel.querySelectorAll('.chb-stars-num').forEach(inp => {
      const apply = e => {
        const i = parseInt(inp.dataset.idx);
        const n = Math.max(0, Math.min(5, parseInt(e.target.value) || 0));
        messages[i].stars = n;
        block.dataset.messages = JSON.stringify(messages);
        const pv = propPanel.querySelector(`.chb-stars-preview[data-idx="${i}"]`);
        if (pv) pv.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
        rerender();
      };
      inp.addEventListener('input', apply);
      inp.addEventListener('change', () => window.pushHistory?.('별점'));
    });
    // 프로필 이름 input
    propPanel.querySelectorAll('.chb-profile-name-input').forEach(inp => {
      inp.addEventListener('input', e => {
        const i = parseInt(inp.dataset.idx);
        messages[i].profileName = e.target.value;
        block.dataset.messages = JSON.stringify(messages);
        rerender();
      });
      inp.addEventListener('change', () => window.pushHistory?.());
    });
    // 프로필 이미지 — thumb 클릭 시 file input 트리거
    propPanel.querySelectorAll('.chb-profile-thumb').forEach(th => {
      th.addEventListener('click', () => {
        const i = parseInt(th.dataset.idx);
        const fileInput = propPanel.querySelector(`.chb-profile-file[data-idx="${i}"]`);
        fileInput?.click();
      });
    });
    propPanel.querySelectorAll('.chb-profile-file').forEach(fi => {
      fi.addEventListener('change', e => {
        const i = parseInt(fi.dataset.idx);
        const file = e.target.files?.[0];
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          messages[i].profileImg = ev.target.result;
          block.dataset.messages = JSON.stringify(messages);
          window.pushHistory?.('프로필 이미지');
          rerender();
          rebindMsgList();
        };
        reader.readAsDataURL(file);
      });
    });
  }
  bindMsgEvents();

  // ─── 대화 추가 ───────────────────────────────────────────────
  propPanel.querySelector('#chb-add-msg').addEventListener('click', () => {
    window.pushHistory?.();
    const lastAlign = messages.length ? messages[messages.length - 1].align : 'left';
    messages.push({ text: '새 대화', align: lastAlign === 'left' ? 'right' : 'left' });
    block.dataset.messages = JSON.stringify(messages);
    rerender();
    rebindMsgList();
  });

  // ★BT2 — 고른 메시지/줄의 줄바·줄 꾸미기·Typography (버블과 «같은» 함수, js/blocks/line-host.js)
  window.lnAugmentChatPanel?.(block);
}

window.showChatProperties = showChatProperties;
