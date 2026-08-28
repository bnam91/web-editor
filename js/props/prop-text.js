import { propPanel, state } from '../globals.js';
import { rgbToHex } from './prop-text-utils.js';
import { buildTextPropsHtml } from './prop-text-template.js';
import { detectMix } from './prop-text-mix-detect.js';
import { wireBubbleSection }   from './prop-text-wireup-bubble.js';
import { wireFontSection }     from './prop-text-wireup-font.js';
import { wireTypeSection }     from './prop-text-wireup-type.js';
import { wireLabelSection }    from './prop-text-wireup-label.js';
import { wireAlignSection }    from './prop-text-wireup-align.js';
import { wireTextEditSection } from './prop-text-wireup-text-edit.js';
import { wireSpacingSection }  from './prop-text-wireup-spacing.js';
import { wirePositionSection } from './prop-text-wireup-position.js';
import { wirePaddingSection }  from './prop-text-wireup-padding.js';
import { wireShadowSection, readShadowState } from './prop-text-wireup-shadow.js';

export function showTextProperties(tb) {
  const isOverlayTb = tb.classList.contains('overlay-tb');
  // contenteditable 속성이 없는 경우(저장 후 복원 시 속성 누락) fallback으로 내부 첫 자식 div를 사용
  let contentEl = tb.querySelector('[contenteditable]');
  if (!contentEl) {
    contentEl = tb.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label,.tb-bullet,.tb-liner');
    if (contentEl) contentEl.setAttribute('contenteditable', 'false');
  }
  if (!contentEl) {
    console.warn('[prop-text] showTextProperties: contentEl not found in', tb.id);
    return;
  }
  const computed   = window.getComputedStyle(contentEl);

  const isSpeechBubble = tb.classList.contains('speech-bubble-block');
  const isIconText     = tb.classList.contains('icon-text-block');
  const isLiner        = tb.classList.contains('liner-block');
  const currentClass = ['tb-h1','tb-h2','tb-h3','tb-body','tb-caption','tb-label','tb-bullet','tb-liner'].find(c => contentEl.classList.contains(c)) || (isSpeechBubble ? 'tb-bubble' : isLiner ? 'tb-liner' : 'tb-body');
  const rawBg = window.getComputedStyle(contentEl).backgroundColor;
  const currentBgColor = (!rawBg || rawBg === 'rgba(0, 0, 0, 0)' || rawBg === 'transparent') ? '#111111' : (rgbToHex(rawBg) || '#111111');
  const currentRadius = parseInt(contentEl.style.borderRadius) || 4;
  const isLabel = currentClass === 'tb-label';
  const currentTail = tb.dataset.tail || 'left';
  const currentBubbleStyle = tb.dataset.bubbleStyle || 'imessage';
  const _blockBubbleVar = isSpeechBubble ? tb.style.getPropertyValue('--bubble-bg').trim() : '';
  const bubbleBg = isSpeechBubble ? (_blockBubbleVar || contentEl.style.backgroundColor || '#e5e5ea') : '#e5e5ea';
  const bubbleBgHex = isSpeechBubble ? (_blockBubbleVar || rgbToHex(window.getComputedStyle(contentEl).backgroundColor) || '#e5e5ea') : '#e5e5ea';
  const showSender = isSpeechBubble && tb.dataset.showSender === 'true';
  const senderName = isSpeechBubble ? (tb.dataset.senderName || 'Your name') : 'Your name';
  const labelPillPadT = parseInt(contentEl.style.paddingTop)    || 4;
  const labelPillPadB = parseInt(contentEl.style.paddingBottom) || 4;
  const labelPillH    = labelPillPadT + labelPillPadB;
  const _jcToAlign   = { 'flex-start': 'left', 'center': 'center', 'flex-end': 'right' };
  // U10 후속 — «거짓 active» 제거.
  //   커스텀 폭(width≠100%) 블록의 «박스 가로 위치»를 지배하는 건 textAlign 이 아니라
  //   레이아웃 요소(text-frame 래퍼)의 align-self 다(prop-text-wireup-align.js 참고).
  //   그런데 active 표시는 textAlign 만 보고 그려서, 둘이 어긋난 저장본(= textAlign 은
  //   center 인데 align-self 가 안 붙은 블록)에서 「가운데가 이미 눌려 있는데 왼쪽에 붙어 있다」가 된다.
  //   ⇒ 어긋나면 «어느 것도 active 로 칠하지 않는다»(=미정). 한 번 누르면 실제로 걸리고 표시도 맞는다.
  //   ⚠️저장본은 건드리지 않는다(자가치유 금지 — 현빈 결정 대기).
  //   판정은 CSS 를 추론하지 않고 «실제로 그려진 위치»로 한다 — 가로 배치를 만드는 수단이
  //   align-self 하나가 아니기 때문이다(margin:0 auto · 부모 align-items · 프레임 중첩).
  //   실측으로 이 셋을 다 겪었다: align-self 만 보면 «이미 가운데인 블록»을 미정으로 오판한다.
  const _alignDisplayFor = (ta) => {
    // 판정 대상은 center/right 만. left 는 «기본값»이라, 바깥 프레임이 margin:auto 로
    // 가운데 놓인 블록까지 전부 미정으로 만들어 소음만 커진다(실측: left 까지 보면 11건, 제한하면 1건).
    if (ta !== 'center' && ta !== 'right') return ta;
    const layoutEl = tb.closest('.frame-block[data-text-frame="true"]') || tb;
    const w = layoutEl.style.width;
    if (!w || w === '100%' || w === 'auto') return ta;      // 기본폭 → 정렬 여지 없음, 표시 정직
    const parent = layoutEl.parentElement;
    if (!parent) return ta;
    const pcs = window.getComputedStyle(parent);
    // 자식의 «가로» 위치가 자기 정렬값으로 정해지는 건 세로 flex 컨테이너 안일 때뿐
    // (가로 row 안에서는 형제 흐름이 위치를 정하므로 이 판정을 하면 안 된다).
    if (!/flex/.test(pcs.display) || pcs.flexDirection !== 'column') return ta;
    const er = layoutEl.getBoundingClientRect();
    const pr = parent.getBoundingClientRect();
    // ⚠️rect(줌 스케일 곱해짐)와 computed px(안 곱해짐)를 섞지 않으려고 스케일을 명시적으로 뽑는다.
    const scale = parent.offsetWidth ? (pr.width / parent.offsetWidth) : 1;
    const gapL = (er.left - pr.left) - parseFloat(pcs.paddingLeft || 0) * scale;
    const gapR = (pr.right - er.right) - parseFloat(pcs.paddingRight || 0) * scale;
    const slack = gapL + gapR;
    if (!(slack > 2 * scale)) return ta;  // 여유폭 없음 → 어떤 정렬도 위치를 못 바꾼다, 표시 유지
    const tol = Math.max(1, slack * 0.03);
    const ok = ta === 'center' ? Math.abs(gapL - gapR) <= tol
             : ta === 'right'  ? gapR <= tol
             : /* left */        gapL <= tol;
    return ok ? ta : null;                // null → 세 버튼 모두 비활성(=미정)
  };
  const currentAlign = isLabel
    ? (tb.style.textAlign || 'left')
    : isIconText
      ? (_jcToAlign[tb.style.justifyContent] || 'left')
      : _alignDisplayFor(contentEl.style.textAlign || 'left');
  const currentItbGap = isIconText ? (parseInt(tb.style.gap) || 16) : 16;
  // 자식 span/div에 inline font-size가 있으면 그 값을 우선 사용 (복사 블록 대응)
  const _firstSizedChild = contentEl.querySelector('[style*="font-size"]');
  const currentSize  = _firstSizedChild
    ? (parseInt(window.getComputedStyle(_firstSizedChild).fontSize) || parseInt(computed.fontSize) || 15)
    : (parseInt(computed.fontSize) || 15);
  const currentColor = rgbToHex(computed.color) || '#111111';
  const _colorM = (computed.color || '').match(/rgba?\(([^)]+)\)/i);
  const currentColorAlpha = _colorM && _colorM[1].split(',').length === 4
    ? Math.round(parseFloat(_colorM[1].split(',')[3]) * 100)
    : 100;
  const currentLH    = (parseFloat(computed.lineHeight) / parseFloat(computed.fontSize) || 1.5).toFixed(2);
  const currentLS    = isNaN(parseFloat(contentEl.style.letterSpacing))
    ? (parseFloat(computed.letterSpacing) || 0)
    : parseFloat(contentEl.style.letterSpacing);
  const currentPadT  = parseInt(tb.style.paddingTop)    || 0;
  const currentPadB  = parseInt(tb.style.paddingBottom) || 0;
  const currentPadL  = parseInt(tb.style.paddingLeft)  || 0;
  const currentPadR  = parseInt(tb.style.paddingRight) || 0;
  let   phLinked     = currentPadL === currentPadR;
  // rawFont: CSS가 fontFamily를 정규화(따옴표 변환 등)하므로 raw option값을 별도 저장해서 우선 사용
  const currentFont   = contentEl.dataset.rawFont || contentEl.style.fontFamily || '';
  const rawWeight     = contentEl.style.fontWeight || '';
  const currentWeight = rawWeight === 'bold' ? '700' : rawWeight === 'normal' ? '400' : rawWeight;
  const isBold        = currentWeight === '700' || rawWeight === 'bold';
  const isItalic      = contentEl.style.fontStyle  === 'italic';
  const isStrike      = (contentEl.style.textDecorationLine || contentEl.style.textDecoration || '').includes('line-through');
  const currentHighlight      = tb.dataset.highlight || 'none';
  const currentHighlightColor = tb.dataset.highlightColor || getComputedStyle(document.documentElement).getPropertyValue('--ui-highlight').trim();
  // ⑨ 서식 버튼 — 블록 전체에 걸린 인라인 서식 여부(부분 서식은 selection 기준이라 여기서 안 본다)
  const isHighlight   = !!(contentEl.style.backgroundColor && contentEl.style.backgroundColor !== 'transparent');

  // 위치/크기 — text-frame(래퍼)이 position/size를 보유
  const _tf         = tb.closest('.frame-block[data-text-frame="true"]');
  const _posEl      = _tf || tb;  // freeLayout 안: text-frame, 그 외: tb
  const isAbsolute  = _posEl.style.position === 'absolute';
  const currentX    = parseInt(_posEl.style.left  || _posEl.dataset.offsetX || '0');
  const currentY    = parseInt(_posEl.style.top   || _posEl.dataset.offsetY || '0');
  const currentRotation = parseFloat(_posEl.dataset.rotation || '0') || 0;
  const _tbRow      = tb.closest('.row');
  const currentW    = parseInt(_tf?.dataset.width || _tbRow?.dataset.width) || Math.round(_tf?.offsetWidth || _tbRow?.offsetWidth || tb.offsetWidth);

  // Mix 감지 (Figma 패턴): contentEl 내부 자식들이 서로 다른 color/fontSize/fontWeight 를 가지면 "Mix" 표시
  const mix = detectMix(contentEl);

  // Shadow 상태 — dataset에서 읽음 (저장본 복원 호환)
  const shadow = readShadowState(contentEl);

  propPanel.innerHTML = buildTextPropsHtml({
    tb, isOverlayTb, currentClass, currentAlign,
    currentX, currentY, currentRotation, currentW, currentFont, currentWeight, currentSize,
    currentLH, currentLS, currentColor, currentColorAlpha,
    currentPadT, currentPadL, currentPadR, phLinked,
    isLabel, currentBgColor, currentRadius, labelPillH,
    isSpeechBubble, currentBubbleStyle, currentTail,
    bubbleBgHex, showSender, senderName,
    isIconText, currentItbGap,
    mix,
    shadow,
    isLiner,
    isStrike,
    isBold,
    isItalic,
    isHighlight,
  });

  if (window.setRpIdBadge) window.setRpIdBadge(tb.id || null);

  // wireTypeSection이 contentEl을 교체할 수 있으므로 ctx 객체로 공유 (R1)
  // 각 wireup 핸들러는 ctx.contentEl을 동적 참조해 type 토글 후 새 노드를 본다
  const ctx = { contentEl };

  if (isSpeechBubble) wireBubbleSection({ tb, ctx, currentBubbleStyle });
  wireFontSection({ propPanel, ctx });
  // 라이너 블록은 Type 토글 숨김 — 클릭 시 contentEl.className 교체로 .tb-liner가 깨지는 회귀 방지 (M2)
  if (!isLiner) wireTypeSection({ tb, propPanel, ctx });
  wireLabelSection({ ctx });
  wireAlignSection({ tb, ctx, propPanel, isIconText });
  wireTextEditSection({ ctx, currentColorAlpha });
  wireSpacingSection({ ctx, isLiner }); // M6b: 라이너는 자간 바인딩 스킵(우리 슬라이더 단일소스)
  wireShadowSection({ ctx, initial: shadow });
  if (!isOverlayTb) wirePositionSection({ tb });
  if (!isOverlayTb) wirePaddingSection({ tb, phLinked });

  /* 애니메이션 GIF 버튼 */
  // BUG-FIX: 텍스트블록 선택마다 이 함수가 실행되므로 리스너 중복 방지
  // onclick을 직접 교체하는 방식으로 단일 핸들러 보장
  const animBtn = document.getElementById('open-anim-btn');
  if (animBtn) {
    /* ★[MVP 제외] 「애니메이션 GIF 만들기」는 이번 버전에서 «보이되 안 눌린다»(현빈 2026-08-28).
     *   Figma·개발자·협업과 같은 방식 — 감추면 「있었다」는 것조차 사라진다.
     *   ⛔이 버튼은 우측 패널이 그려질 때마다 «새로 만들어진다»(prop-text-template.js:361).
     *     그래서 로드 시점 IIFE 로는 못 막고 «여기서» 막아야 한다. */
    if (window.ANIM_GIF_ENABLED === false || window.ANIM_GIF_ENABLED === undefined) {
      animBtn.onclick = null;
      animBtn.disabled = true;
      animBtn.setAttribute('aria-disabled', 'true');
      animBtn.style.opacity = '0.4';
      animBtn.style.cursor = 'default';
      animBtn.title = '이번 버전에서는 사용할 수 없습니다';
    } else {
      animBtn.onclick = () => window.openAnimModal(tb);
    }
  }

  window.bindLayoutInput?.(tb);

  // 이스터에그: 텍스트 효과가 적용된 블록이면 우측 패널에 컨트롤 증강
  if (tb.dataset.textEffect) window.enhanceTextEffectPropPanel?.(tb);

  // 라이너(곡선 텍스트): 프리셋 select + 곡률 슬라이더 증강
  if (isLiner) window.enhanceLinerPropPanel?.(tb);
}

// Backward compat: classic scripts call these via window.*
window.showTextProperties = showTextProperties;
window.rgbToHex           = rgbToHex;
