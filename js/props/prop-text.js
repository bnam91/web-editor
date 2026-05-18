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

export function showTextProperties(tb) {
  const isOverlayTb = tb.classList.contains('overlay-tb');
  // contenteditable 속성이 없는 경우(저장 후 복원 시 속성 누락) fallback으로 내부 첫 자식 div를 사용
  let contentEl = tb.querySelector('[contenteditable]');
  if (!contentEl) {
    contentEl = tb.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label,.tb-bullet');
    if (contentEl) contentEl.setAttribute('contenteditable', 'false');
  }
  if (!contentEl) {
    console.warn('[prop-text] showTextProperties: contentEl not found in', tb.id);
    return;
  }
  const computed   = window.getComputedStyle(contentEl);

  const isSpeechBubble = tb.classList.contains('speech-bubble-block');
  const isIconText     = tb.classList.contains('icon-text-block');
  const currentClass = ['tb-h1','tb-h2','tb-h3','tb-body','tb-caption','tb-label','tb-bullet'].find(c => contentEl.classList.contains(c)) || (isSpeechBubble ? 'tb-bubble' : 'tb-body');
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
  const currentAlign = isLabel
    ? (tb.style.textAlign || 'left')
    : isIconText
      ? (_jcToAlign[tb.style.justifyContent] || 'left')
      : (contentEl.style.textAlign || 'left');
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
  const currentHighlight      = tb.dataset.highlight || 'none';
  const currentHighlightColor = tb.dataset.highlightColor || '#ffeb3b';

  // 위치/크기 — text-frame(래퍼)이 position/size를 보유
  const _tf         = tb.closest('.frame-block[data-text-frame="true"]');
  const _posEl      = _tf || tb;  // freeLayout 안: text-frame, 그 외: tb
  const isAbsolute  = _posEl.style.position === 'absolute';
  const currentX    = parseInt(_posEl.style.left  || _posEl.dataset.offsetX || '0');
  const currentY    = parseInt(_posEl.style.top   || _posEl.dataset.offsetY || '0');
  const _tbRow      = tb.closest('.row');
  const currentW    = parseInt(_tf?.dataset.width || _tbRow?.dataset.width) || Math.round(_tf?.offsetWidth || _tbRow?.offsetWidth || tb.offsetWidth);

  // Mix 감지 (Figma 패턴): contentEl 내부 자식들이 서로 다른 color/fontSize/fontWeight 를 가지면 "Mix" 표시
  const mix = detectMix(contentEl);

  propPanel.innerHTML = buildTextPropsHtml({
    tb, isOverlayTb, currentClass, currentAlign,
    currentX, currentY, currentW, currentFont, currentWeight, currentSize,
    currentLH, currentLS, currentColor, currentColorAlpha,
    currentPadT, currentPadL, currentPadR, phLinked,
    isLabel, currentBgColor, currentRadius, labelPillH,
    isSpeechBubble, currentBubbleStyle, currentTail,
    bubbleBgHex, showSender, senderName,
    isIconText, currentItbGap,
    mix,
  });

  if (window.setRpIdBadge) window.setRpIdBadge(tb.id || null);

  // wireTypeSection이 contentEl을 교체할 수 있으므로 ctx 객체로 공유 (R1)
  // 각 wireup 핸들러는 ctx.contentEl을 동적 참조해 type 토글 후 새 노드를 본다
  const ctx = { contentEl };

  if (isSpeechBubble) wireBubbleSection({ tb, ctx, currentBubbleStyle });
  wireFontSection({ propPanel, ctx });
  wireTypeSection({ tb, propPanel, ctx });
  wireLabelSection({ ctx });
  wireAlignSection({ tb, ctx, propPanel, isIconText });
  wireTextEditSection({ ctx, currentColorAlpha });
  wireSpacingSection({ ctx });
  if (!isOverlayTb) wirePositionSection({ tb });
  if (!isOverlayTb) wirePaddingSection({ tb, phLinked });

  /* 애니메이션 GIF 버튼 */
  // BUG-FIX: 텍스트블록 선택마다 이 함수가 실행되므로 리스너 중복 방지
  // onclick을 직접 교체하는 방식으로 단일 핸들러 보장
  const animBtn = document.getElementById('open-anim-btn');
  if (animBtn) animBtn.onclick = () => window.openAnimModal(tb);

  window.bindLayoutInput?.(tb);
}

// Backward compat: classic scripts call these via window.*
window.showTextProperties = showTextProperties;
window.rgbToHex           = rgbToHex;
