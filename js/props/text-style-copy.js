/* text-style-copy — 텍스트 블럭 «스타일 복사 ⌥⌘C / 스타일 붙여넣기 ⌥⌘V» (1020t2d2 · 현빈 시트 L20)
 *
 * 현빈 원문: 「텍스트 블럭 스타일 복사/붙여넣기 (애플과 같은 단축키)」
 *   ⇒ 맥 관례(TextEdit·Pages·피그마 「Copy/Paste properties」)의 ⌥⌘C / ⌥⌘V.
 *   블럭을 «골라(편집 아님)» ⌥⌘C → 다른 텍스트 블럭(여럿 가능)을 골라 ⌥⌘V ⇒ 글자 모양만 옮기고 글은 그대로.
 *
 * ★보통 ⌘C/⌘V 와는 «다른 길»이다 — 이 파일은 OS 클립보드도, 블럭 클립보드(_internalClipboard*)도 안 만진다.
 *   t4-12·t5-17(보통 붙여넣기는 글만 · 목적지 서식)은 editor.js pasteClipboard / block-drag.js 편집칸 paste 리스너가 지킨다.
 *   ⇒ 스타일은 이 모듈 안 «한 칸»(_styleClip)에만 산다. 저장·undo 스냅샷에 안 실린다(앱을 다시 켜면 빈다).
 *
 * ★옮기는 것 = 우측 패널 Typography · Fill · Stroke · Shadow 절의 «블럭 전체» 값(읽는 잣대는 prop-text.js 패널과 같다):
 *   Typography  글꼴(rawFont) · 굵기 · 크기 · 기울임 · 줄간격 · 자간 · 정렬(인라인으로 «명시»된 것만 — F2)
 *   Fill        단색(인라인이면 그 글자 그대로 — var(--…) 색 변수 유지 · 자리표시 상태면 인라인 색만 — F3) · 글자 그라데이션
 *   Stroke      외곽선(on·두께·색·위치) — 그 절이 있는 블럭끼리만(말풍선·라벨·아이콘텍스트는 절 자체가 없다)
 *   Shadow      그림자(dataset 다섯 값) — Effects 글로우와의 합성은 fxComposeTextShadow «합성 문»으로 쓴다
 * ★안 옮기는 것(해석 — plan-d2.md):
 *   타입(H1/Body 클래스) · 크기·위치·패딩 · 꾸밈(밑줄·취소선·형광펜·점·글로우 — 각자 「스타일 번호 ⧉」 길이 따로 있다) · Effects 절 ·
 *   라벨 알약·말풍선 모양 · 곡선(liner) 블럭(자간·크기가 제 슬라이더 단일 소스라 대상에서 뺀다).
 * ★쓰기는 패널의 «선택 없음 = 블럭 전체» 갈래와 같은 규칙으로 한다 — 안쪽 부분서식 잔재를 먼저 걷는다
 *   (안 걷으면 일부 글자만 옛 모양으로 남는다: prop-text-wireup-font.js / text-edit.js 의 그 주석).
 * ★이력: 붙여넣기 한 번 = ⌘Z 한 번. 패널과 같은 push-after 이고, 앞 칸이 push-before 동작이면 라이브를 먼저 찍는다
 *   (block-factory.js 「여백 넣기」의 ensureHistoryCheckpoint 관용구).
 */

import { _stripInlineResidue } from './prop-text-utils.js';
import { panelRenderedWeight } from './_panel-rendered.js';
import { applyColorToSelection } from './prop-text-wireup-text-edit.js';
import { getTextGradient, applyTextGradient } from './text-block-color.js';
import { readStrokeState, applyStroke } from './prop-text-wireup-stroke.js';
import { readShadowState, textUserShadowCss } from './prop-text-wireup-shadow.js';
import { clearInnerFontFamily } from './prop-text-wireup-font.js';
import { applyTextAlignToBlock } from './prop-text-wireup-align.js';

const CONTENT_FALLBACK_SEL = '.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label,.tb-bullet,.tb-liner,.itb-text';

/** 스타일 복사/붙여넣기가 받는 블럭인가 — 텍스트 블럭(곡선 liner 뺌). */
export function isStyleCopyTextBlock(el) {
  return !!(el && el.classList && el.classList.contains('text-block') && !el.classList.contains('liner-block'));
}

/** 글자칸 — showTextProperties 와 같은 순서로 찾는다(패널이 읽는 그 칸에 쓴다). */
function _contentOf(tb) {
  return tb.querySelector('[contenteditable]') || tb.querySelector(CONTENT_FALLBACK_SEL);
}
const _isLabel = (ce) => ce.classList.contains('tb-label');
const _isBubble = (tb) => tb.classList.contains('speech-bubble-block');
/* 정렬이 «글자 정렬»인 블럭 — 라벨은 알약 상자 위치(tb.textAlign)라 글자 모양이 아니다. */
const _alignApplies = (tb, ce) => !_isLabel(ce);
/* Stroke 절이 있는 블럭 — prop-text-template.js _strokeSec 의 조건과 같다(liner 는 대상 밖 · 아이콘텍스트는 .text-block 이 아니라 대상 밖). */
const _strokeApplies = (tb, ce) => !(_isBubble(tb) || _isLabel(ce));

const ALIGN_OF = { left: 'left', start: 'left', center: 'center', right: 'right', end: 'right' };

/** 블럭 하나의 «글자 모양»을 읽는다(쓰지 않는다). 못 읽으면 null. */
export function captureTextBlockStyle(tb) {
  if (!isStyleCopyTextBlock(tb)) return null;
  const ce = _contentOf(tb);
  if (!ce) return null;
  const cs = getComputedStyle(ce);
  /* 크기 — 패널과 같은 잣대: 안쪽에 크기 span 이 있으면 그 첫 값(복사 블럭 대응 · prop-text.js currentSize) */
  const sized = ce.querySelector('[style*="font-size"]');
  const size = (sized && parseFloat(getComputedStyle(sized).fontSize)) || parseFloat(cs.fontSize) || null;
  /* 줄간격 — 인라인(배수)이 있으면 그 글자 그대로, 없으면 그려진 값을 배수로(패널 currentLH 와 같은 식) */
  const lhInline = ce.style.lineHeight;
  const lhRatio = parseFloat(cs.lineHeight) / parseFloat(cs.fontSize);
  const lh = lhInline || (Number.isFinite(lhRatio) ? String(Number(lhRatio.toFixed(2))) : '');
  const lsInline = parseFloat(ce.style.letterSpacing);
  const ls = Number.isFinite(lsInline) ? lsInline : (parseFloat(cs.letterSpacing) || 0);
  const g = getTextGradient(ce);
  /* 정렬 — «명시 정렬»(글자칸 인라인 text-align = 정렬 단추가 쓰는 저장값)이 있을 때만 담는다(d2 검수 F2).
     ⛔계산값을 담지 않는다: 정렬을 준 적 없는 블럭의 계산값 'start' 가 'left' 로 굳어 대상(말풍선 발신자 정렬까지)에 박힌다. */
  const alignExplicit = ALIGN_OF[(ce.style.textAlign || '').trim()] || null;
  /* 색 — 자리표시 상태(빈 글 · CSS 가 흐린 색을 칠함, 예: 말풍선 rgba(…,0.4))면 인라인 색이 있을 때만 담는다(d2 검수 F3).
     그 밖엔 패널과 같은 잣대(인라인 우선, 없으면 그려진 색). */
  const isPh = ce.dataset.isPlaceholder === 'true' || ce.dataset.blank === 'true';
  const color = ce.style.color || (isPh ? '' : (cs.color || ''));
  return {
    fromId: tb.id || null,
    font: ce.dataset.rawFont || ce.style.fontFamily || '',
    weight: panelRenderedWeight(ce),
    italic: ce.style.fontStyle === 'italic',
    size,
    lh,
    ls,
    align: _alignApplies(tb, ce) ? alignExplicit : null,
    color,
    grad: g ? g.css : null,
    stroke: _strokeApplies(tb, ce) ? (({ on, width, color, align }) => ({ on, width, color, align }))(readStrokeState(ce)) : null,
    shadow: readShadowState(ce),
  };
}

/** 읽은 모양을 블럭 하나에 쓴다. 글(textContent)은 안 바꾼다. 이력은 부르는 쪽이 찍는다. */
export function applyTextBlockStyle(tb, st) {
  if (!st || !isStyleCopyTextBlock(tb)) return false;
  const ce = _contentOf(tb);
  if (!ce) return false;

  /* Typography — 글꼴: 빈 값 = 「기본 (시스템)」(인라인을 지운다) */
  if (st.font) { ce.style.fontFamily = st.font; ce.dataset.rawFont = st.font; }
  else { ce.style.removeProperty('font-family'); delete ce.dataset.rawFont; }
  clearInnerFontFamily(ce);
  if (st.weight) {
    _stripInlineResidue(ce, 'b, strong', 'font-weight');
    ce.style.fontWeight = st.weight;
  }
  _stripInlineResidue(ce, 'i, em', 'font-style');
  if (st.italic) ce.style.fontStyle = 'italic'; else ce.style.removeProperty('font-style');
  if (st.size) {
    _stripInlineResidue(ce, null, 'font-size');
    ce.style.fontSize = Math.round(st.size * 100) / 100 + 'px';
  }
  if (st.lh) ce.style.lineHeight = st.lh;
  ce.style.letterSpacing = (st.ls || 0) + 'px';
  if (st.align && _alignApplies(tb, ce)) {
    applyTextAlignToBlock(tb, ce, st.align);
  }

  /* Fill — 단색 전체 길(안쪽 색 span 걷기 · 그라데이션 해제 · 라벨 자동색 표식 폐기)을 그대로 탄다 */
  if (st.color) applyColorToSelection(st.color, ce);
  if (st.grad) applyTextGradient(tb, { css: st.grad });

  /* Stroke — 두 쪽 다 절이 있을 때만. 둘 다 꺼져 있으면 안 쓴다(꺼진 블럭에 dataset 만 늘리지 않게) */
  if (st.stroke && _strokeApplies(tb, ce) && (st.stroke.on || readStrokeState(ce).on)) applyStroke(ce, st.stroke);

  /* Shadow — dataset 이 정본(readShadowState) · 화면은 합성 문으로. 둘 다 꺼져 있으면 안 쓴다(위와 같은 까닭) */
  const s = st.shadow;
  if (s && (s.enabled || readShadowState(ce).enabled)) {
    ce.dataset.shadowEnabled = s.enabled ? 'true' : 'false';
    ce.dataset.shadowX = String(s.x);
    ce.dataset.shadowY = String(s.y);
    ce.dataset.shadowBlur = String(s.blur);
    ce.dataset.shadowColor = s.color;
    ce.dataset.shadowAlpha = String(s.alpha);
    const userCss = textUserShadowCss(ce);
    if (typeof window.fxComposeTextShadow === 'function') window.fxComposeTextShadow(ce, userCss);
    else ce.style.textShadow = userCss;
  }
  window.syncTextGradShadow?.(ce);
  return true;
}

/* ── 스타일 클립보드 «한 칸» ── */
let _styleClip = null;

export function hasTextStyleClipboard() { return !!_styleClip; }

/** 골라 둔 텍스트 블럭들 — 문서 순서. */
function _selectedTextBlocks() {
  return [...document.querySelectorAll('#canvas .text-block.selected')].filter(isStyleCopyTextBlock);
}

/**
 * ⌥⌘C — 출처 블럭의 모양을 담는다. 출처를 안 주면 «골라 둔 텍스트 블럭의 첫째»(문서 순서).
 * @returns {boolean} 담았나
 */
export function copyTextBlockStyle(src) {
  const tb = src || _selectedTextBlocks()[0] || null;
  const st = tb ? captureTextBlockStyle(tb) : null;
  if (!st) {
    window.showToast?.('스타일 복사: 텍스트 블럭을 골라 주세요');
    return false;
  }
  _styleClip = st;
  window.showToast?.('스타일 복사됨 — ⌥⌘V 로 다른 텍스트 블럭에 붙여넣기');
  return true;
}

/**
 * ⌥⌘V — 담아 둔 모양을 대상 블럭들에 쓴다. 대상을 안 주면 «골라 둔 텍스트 블럭 전부».
 * 텍스트 아닌 블럭은 건너뛴다(대상이 하나도 없으면 아무것도 안 하고 이력도 안 찍는다).
 * @returns {number} 바꾼 블럭 수
 */
export function pasteTextBlockStyle(targets) {
  if (!_styleClip) {
    window.showToast?.('붙여넣을 스타일이 없어요 — 먼저 ⌥⌘C');
    return 0;
  }
  const list = (targets || _selectedTextBlocks()).filter(isStyleCopyTextBlock);
  if (!list.length) {
    window.showToast?.('스타일 붙여넣기: 텍스트 블럭에만 돼요');
    return 0;
  }
  window.ensureHistoryCheckpoint?.('스타일 붙여넣기 전');
  let n = 0;
  for (const tb of list) if (applyTextBlockStyle(tb, _styleClip)) n++;
  if (!n) return 0;
  window.pushHistory?.('스타일 붙여넣기');
  window.scheduleAutoSave?.();
  /* 패널이 열린 블럭이 바뀌었으면 새 값으로 다시 그린다(안 그리면 패널 칸이 옛 값을 보인다) */
  if (list.length === 1 && list[0].classList.contains('selected')) window.showTextProperties?.(list[0]);
  window.showToast?.(n > 1 ? `스타일 붙여넣기 — 블럭 ${n}개` : '스타일 붙여넣기');
  return n;
}

window.isStyleCopyTextBlock = isStyleCopyTextBlock;
window.copyTextBlockStyle = copyTextBlockStyle;
window.pasteTextBlockStyle = pasteTextBlockStyle;
window.hasTextStyleClipboard = hasTextStyleClipboard;
