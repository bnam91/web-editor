/* prop-text-wireup-text-edit.js
 * font-size + color (selection-aware, Figma "b" policy)
 *
 * 정책 (Figma 일치):
 *  - contentEditable 내 일부 텍스트가 선택(드래그)된 상태라면 → 그 선택 부분만 <span style="..."> 으로 감싸 적용
 *  - 선택이 없으면 → 슬라이더/컬러 조작은 효과 없음 (전체 적용 X)
 *  - ★선택 저장·복원은 «한 벌»이다 — js/props/_text-selection.js (TX1 · 2026-10-03).
 *    옛 판은 칸마다 저장 변수(_lastSelRange·_savedSizeSel·_sizeSpan·_savedColorSel·_colorSpan)를 두고
 *    적용 «뒤에 null 로 버렸다» ⇒ 연달아 두 번째 조작이 블럭 전체로 갔다(현빈 2026-10-03 증상).
 *    이제는 withTextSelection 이 적용한 span 으로 저장 범위를 «바꾼다»(버리지 않는다).
 *
 * Mix 표기는 prop-text.js prelude 에서 _detectMix 로 계산 → template input 에 placeholder="Mix" 로 반영.
 */

import { wireColorVarChips, parseColorVarName } from './color-var-chips.js';
import { wireHexText, parseHex6, formatHex6, wireColorField } from './color-picker.js';   /* 색 코드 칸 배선은 «한 자리»(유닛 colorhex) */
import { forgetLabelAutoColor } from './label-auto-color.js';
import { detectMix } from './prop-text-mix-detect.js';
import {
  withTextSelection, getSavedTextSelection, clearTextSelection, spanExactlyCovering, applyStyleToRange,
} from './_text-selection.js';
import { panelRenderedWeight } from './_panel-rendered.js';
import {
  applyTextGradient, clearTextGradient, getTextGradient, hasTextGradient,
  textGradientBlockedReason,
} from './text-block-color.js';

/* ── 0920b textgrad-bar: 캔버스 그라데이션 바 → 패널 ────────────────────────────
 * 캔버스에서 바(끈 끝·칩)를 끌면 gradient-model.js 의 text-block 어댑터 set() 이 «이미»
 * applyTextGradient 로 글자를 다시 칠한다. 그래서 여기서는 «다시 칠하지 않는다» — 열려 있는
 * 패널의 스와치 미리보기만 맞춘다.
 * ⚠️반드시 두 가지로 좁힌다 — detail.source==='canvas' 이고 대상이 .text-block 인 것만.
 *   도형·에셋 «안»의 오버레이 텍스트(.overlay-tb)는 .text-block 이면서 조상이 도형일 수 있어
 *   좁히지 않으면 도형 리스너와 서로의 이벤트를 먹는다.
 * ★루프 걱정은 «없다»(0920b 이벨류 실측·코드 실독). 캔버스→패널은 color-picker.js 의
 *   syncPickerGradient → 'goya-cp:sync-gradient' → _seedGradientUI({emit:false}) 로만 흐르고
 *   'goya-cp:gradient' 를 되쏘지 않는다 ⇒ 아래 _onGrad 가 캔버스 드래그로는 애초에 안 불린다
 *   (실측: 피커가 열린 채 칩 드래그 → pushHistory 1회, 중복 0). prop-shape.js 는 같은 자리에
 *   _applyingExternalShapeGrad 플래그를 두지만 그 플래그가 막을 일이 일어나지 않는 «죽은 가드»라
 *   여기선 따라 베끼지 않는다 — 안심을 주는 문장이 경고 부재보다 나쁘다.
 *   (prop-shape.js 의 죽은 플래그 정리는 이 유닛 범위 밖: 도형 담당 브랜치와 충돌한다.)
 */
document.addEventListener('gradient-line:change', (e) => {
  if (e.detail?.source !== 'canvas') return;
  const block = e.target?.closest?.('.text-block');
  if (!block || !e.detail?.css) return;
  const sw = document.getElementById('txt-color')?.closest('.prop-color-swatch');
  if (sw) sw.style.background = e.detail.css;
});

/* ─────────────────────────────────────────────────────────────
 * 전역 색상 적용 헬퍼 (text-block content + 테이블 셀 공용)
 * ─────────────────────────────────────────────────────────────
 * applyColorToSel/_lastSelRange 로직을 wireup 클로저 밖 전역으로 승격.
 * text-block(prop-text-wireup)과 테이블 셀(prop-table)이 동일 primitive를
 * 공유해 부분 색상 <span style="color:..."> 배선을 재사용한다.
 * ★text-block 동작은 완전 불변(아래 applyColorToSel 이 이 헬퍼로 위임). */

// host 를 경계로, 새 span 의 조상 중 같은 style prop 을 가진 span 을 평탄화(외부 중첩 방지)
function _flattenAncestorWithPropIn(newSpan, prop, host) {
  let cur = newSpan.parentNode;
  while (cur && cur !== host && cur.nodeType === 1) {
    if (cur.tagName === 'SPAN' && cur.style && cur.style[prop]) {
      cur.style[prop] = '';
      const styleStr = cur.getAttribute('style') || '';
      if (!styleStr.replace(/;|\s/g, '')) {
        const p = cur.parentNode;
        while (cur.firstChild) p.insertBefore(cur.firstChild, cur);
        p.removeChild(cur);
        cur = p;
        continue;
      }
    }
    cur = cur.parentNode;
  }
}

// 선택 없음: host(contentEl or 셀) 전체에 색 일괄 — 내부 color span 정리 후 host.style.color
function _applyColorWholeEditable(color, host) {
  if (!host) return;
  // 0918r2 textgrad: 단색 전체 적용 = 글자 그라데이션 해제(안 풀면 그라데이션이 새 단색을 가린다)
  clearTextGradient(host);
  host.querySelectorAll('span[style*="color"]').forEach(s => {
    s.style.color = '';
    const styleStr = s.getAttribute('style') || '';
    if (!styleStr.replace(/;|\s/g, '')) {
      const parent = s.parentNode;
      while (s.firstChild) parent.insertBefore(s.firstChild, s);
      parent.removeChild(s);
    }
  });
  host.style.color = color;
  forgetLabelAutoColor(host);   // 0920r5 polish2: 사용자가 고른 색 — 라벨 표식 폐기(타입 전환 때 안 걷어내게)
}

// 선택 있음: savedRange 영역을 color span 으로 감싼다.
// prevSpan(연결됨) 재사용 → 연속 input 중복 wrap 방지.
// 반환 { span, range } — 호출측이 다음 input 시퀀스를 위해 보존.
function _applyColorSpanToRange(color, host, savedRange, prevSpan) {
  if (!host || !savedRange) return { span: null, range: savedRange || null };
  // 0918r2 textgrad: 그라데이션 글자(host 가 text-fill:transparent) 안의 부분 단색은
  //   채움색도 같이 줘야 보인다 — 안 주면 상속된 transparent 때문에 글자가 사라진다.
  const _gradHost = hasTextGradient(host);
  if (prevSpan && prevSpan.isConnected) {
    prevSpan.style.color = color;
    if (_gradHost) prevSpan.style.setProperty('-webkit-text-fill-color', color);
    return { span: prevSpan, range: savedRange };
  }
  const r = savedRange.cloneRange();
  const frag = r.extractContents();
  // frag 내부의 기존 color span 정리(이중 중첩 방지)
  frag.querySelectorAll('span').forEach(s => {
    if (s.style && s.style.color) {
      s.style.color = '';
      s.style.removeProperty('-webkit-text-fill-color');
      const styleStr = s.getAttribute('style') || '';
      if (!styleStr.replace(/;|\s/g, '')) {
        const parent = s.parentNode;
        while (s.firstChild) parent.insertBefore(s.firstChild, s);
        parent.removeChild(s);
      }
    }
  });
  const span = document.createElement('span');
  span.style.color = color;
  if (_gradHost) span.style.setProperty('-webkit-text-fill-color', color);
  span.appendChild(frag);
  r.insertNode(span);
  _flattenAncestorWithPropIn(span, 'color', host);
  /* ★DOM 선택은 여기서 «안» 옮긴다 — 호출측의 withTextSelection(_text-selection.js)이 저장 범위를 이 span 으로
     바꾸고, 포커스가 그 글자칸에 있을 때만 되돌린다(포커스가 hex 칸이면 그 칸을 뺏지 않는다). */
  const newRange = document.createRange();
  newRange.selectNodeContents(span);
  return { span, range: newRange };
}

/* 전역 진입점: savedRange(비-collapsed) 있으면 부분 span, 없으면 host 전체.
   반환 {span, range} (부분 적용 시 연속 input 재사용용 — prevSpan 으로 다시 넘길 것). */
export function applyColorToSelection(color, host, savedRange = null, prevSpan = null) {
  if (savedRange && !savedRange.collapsed) {
    return _applyColorSpanToRange(color, host, savedRange, prevSpan);
  }
  _applyColorWholeEditable(color, host);
  return { span: null, range: null };
}
if (typeof window !== 'undefined') window.applyColorToSelection = applyColorToSelection;

/* (옛 「전역 셀 selection 캐시 window.__lastCellSel」은 지웠다 — 표 칸도 js/props/_text-selection.js 한 벌을 쓴다.) */

/* ★형광펜 «켜짐» 판정 — 이 식이 사는 자리는 ★여기 하나다(2026-10-06).
 *   prop-text.js(단추 active 표시)와 아래 단추 핸들러(토글 방향)가 ★같은 것을 써야 한다.
 *   갈리면 「단추는 꺼짐인데 누르면 꺼진다」가 되고, 더 나쁘게는 ★옛 형광펜을 지우고 새로 칠한다.
 * ★세 꼴을 다 본다:
 *   ⑴ 새 꼴      span.tb-hl
 *   ⑵ 옛 꼴(부분) span[style*="background-color"]  — execCommand('hiliteColor') 가 만들던 것
 *   ⑶ 옛 꼴(전체) contentEl 자신의 인라인 background-color — 옛 «무선택» 갈래가 만들던 것
 *   ⑵ 를 빼면 옛 문서에서 단추가 «꺼짐»으로 보이고, 한 번 누르면 _hlStripAll 이 그 획을 ★지워버린다. */
export const HL_CLASS = 'tb-hl';
export function isHighlightOn(contentEl) {
  if (!contentEl) return false;
  if (contentEl.querySelector('span.' + HL_CLASS)) return true;
  if (contentEl.querySelector('span[style*="background-color"]')) return true;
  const bg = contentEl.style && contentEl.style.backgroundColor;
  return !!(bg && bg !== 'transparent');
}

export function wireTextEditSection({ tb, ctx, currentColorAlpha }) {
  /* ★선택 저장·복원 = js/props/_text-selection.js 한 벌. 여기엔 저장 변수가 «없다». */
  const hasSel = () => !!getSavedTextSelection(ctx.contentEl);

  const applyExecCmd = (savedSel, cmd, val = null) => {
    if (!savedSel) return false;
    const wasEditable = ctx.contentEl.contentEditable;
    ctx.contentEl.contentEditable = 'true';
    ctx.contentEl.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedSel);
    if (val) document.execCommand(cmd, false, val);
    else document.execCommand(cmd, false, null);
    ctx.contentEl.contentEditable = wasEditable;
    return true;
  };

  /* ── 폰트 크기 ── 선택이 있으면 그 글자만 <span>, 없으면 블럭 전체 */
  const sizeNumber = document.getElementById('txt-size-number');
  const applySizeToSel = (v) => withTextSelection((range, host) => {
    if (!range) {
      // selection 없으면 전체 일괄 적용 — mix 상태 부분 span들 정리
      if (ctx.contentEl) {
        ctx.contentEl.querySelectorAll('span[style*="font-size"]').forEach(s => {
          s.style.fontSize = '';
          const styleStr = s.getAttribute('style') || '';
          if (!styleStr.replace(/;|\s/g, '')) {
            const parent = s.parentNode;
            while (s.firstChild) parent.insertBefore(s.firstChild, s);
            parent.removeChild(s);
          }
        });
        ctx.contentEl.style.fontSize = v + 'px';
      }
      return null;
    }
    return applyStyleToRange(range, host, 'fontSize', v + 'px');
  }, { within: ctx.contentEl });

  /* ★적용 «시점»: 피그마 = 편집 나갈 때 적용 / 고디터 = Enter·blur 에 적용(커밋 가드)·Esc 되돌림.
     일부러 다르다(2026-10-03 지디 판정). — 타이핑 중 'input' 은 prop-number-commit-guard.js 가 유예하고,
     Enter·blur 의 합성 input 이 여기 온다. ⛔이 시점을 바꾸지 마라. */
  sizeNumber.addEventListener('input', () => {
    const v = Math.min(800, Math.max(8, parseInt(sizeNumber.value)||8));
    applySizeToSel(v);
  });
  sizeNumber.addEventListener('change', () => { window.pushHistory?.(); });

  /* ★편집으로 «돌아올 때» 크기 칸의 Mixed 를 다시 잰다(Evaluator 2026-10-03 x3: 36/60 이 섞였는데 ⌘A·Esc 뒤 「60」).
     옛 판은 패널 칸을 누르면 편집이 끝나 블럭을 다시 누를 때 패널이 통째로 다시 그려졌다(→ Mix). 지금은 편집이
     «세워져» 있다가 그대로 이어지므로(다시 편집·Q 입력이 되는 까닭) 패널이 안 다시 그려진다 ⇒ 같은 판정만 여기서 한다.
     (㉠ 「돌아올 때 세움을 끝내고 다시 그리기」는 R2 를 고치지만 «한 번 클릭으로 편집 이어가기»를 죽였다 — R7 빨강, 2026-10-03 실측.)
     판정·칸 꼴은 패널을 처음 그릴 때와 «같은» 것(detectMix · _typo-section 의 Mix 칸: value "" · placeholder "Mix" · data-empty="invalid"). */
  //   ⚠️패널은 블럭마다 여러 번 다시 그려진다 — 글자칸에 «한 벌»만 걸고 칸은 id 로 그때 찾는다(리스너 누적 금지).
  if (!ctx.contentEl._mixRefreshBound) {
    ctx.contentEl._mixRefreshBound = true;
    const el = ctx.contentEl;
    el.addEventListener('focusin', () => {
      const f = document.getElementById('txt-size-number');
      if (!f || document.activeElement === f) return;
      const m = detectMix(el).fontSize;
      if (m.mixed) { f.value = ''; f.placeholder = 'Mix'; f.dataset.empty = 'invalid'; }
      else if (f.placeholder === 'Mix') { f.placeholder = ''; delete f.dataset.empty; if (m.value) f.value = String(m.value); }
    });
  }

  /* ── 색상 ── (Figma b: selection 없으면 효과 X) */
  const colorPicker = document.getElementById('txt-color');
  const colorHex    = document.getElementById('txt-color-hex');
  const colorAlpha  = document.getElementById('txt-color-alpha');
  const colorSwatch = colorPicker.closest('.prop-color-swatch');
  let _txtAlpha = currentColorAlpha;
  /* 「마지막 유효값」 — hex 칸의 blur 복원 기준. ''=아무도 안 정했다(Mix·미지정 갈래).
     ⚠️선언은 «여기»다 — _syncGradUi 가 배선보다 «먼저» 불릴 수 있어 TDZ 를 피한다. */
  let _txtLastHex = parseHex6(colorHex.value || '') || '';

  // (선택 저장은 _text-selection.js 의 패널 pointerdown/mousedown 위임이 «먼저» 한다 — 칸마다 걸지 않는다.)

  const _buildColor = () => {
    const h = (colorPicker.value || '#000000').replace('#','');
    const r = parseInt(h.slice(0,2), 16);
    const g = parseInt(h.slice(2,4), 16);
    const b = parseInt(h.slice(4,6), 16);
    const a = Math.max(0, Math.min(1, _txtAlpha / 100));
    return a >= 1 ? colorPicker.value : `rgba(${r},${g},${b},${a})`;
  };

  const applyColorToSel = (color) => withTextSelection((range, host) => {
    if (!range) {
      // selection 없으면 전체 contentEl에 일괄 적용
      // mix 상태(내부 span별 부분 색)를 풀어줘야 contentEl.style.color가 우선됨
      // 0918r2 textgrad: 단색 전체 = 그라데이션 해제 + 재오픈 시드 폐기(다음에 솔리드 탭으로 열린다)
      _applyColorWholeEditable(color, ctx.contentEl);
      delete colorPicker.dataset.cpGradient;
      _syncGradUi();
      return null;
    }
    // 부분 선택 — 전역 primitive 로 위임. 범위가 이미 span 하나 전체면 그 span 을 다시 쓴다(겹 span 금지).
    return _applyColorSpanToRange(color, host, range, spanExactlyCovering(range)).span;
  }, { within: ctx.contentEl });

  colorPicker.addEventListener('input', () => {
    const c = _buildColor();
    applyColorToSel(c);
    colorHex.value = colorPicker.value.replace('#','').toUpperCase();
    _txtLastHex = colorPicker.value;      // 피커로 고른 색도 「마지막 유효값」(blur 복원 기준)
    colorSwatch.style.background = c;
  });
  colorPicker.addEventListener('change', () => { window.pushHistory?.(); });

  /* ── 글자 그라데이션 (0918r2 textgrad · T-059 확장, 현빈 결정 = 피그마 기준) ──
     탭 능력: 제목·본문·캡션 = 단색+그라데이션, 라벨·불릿·곡선·말풍선 = 단색만(이유 툴팁).
     그라데이션 탭 한 번 = color-picker _activateTab → goya-cp:gradient(+commit) 동기 1회 = 되돌리기 1단위.
     ★colorPicker.value 는 건드리지 않는다 — 솔리드 탭으로 돌아가면 그 값(=마지막 단색)이 다시 칠해진다. */
  function _syncGradUi() {
    const el = ctx.contentEl;
    const g = getTextGradient(el);
    if (g) {
      colorSwatch.style.background = g.css;
      if (g.stops[0]) { colorHex.value = g.stops[0].color.replace('#', '').toUpperCase(); _txtLastHex = g.stops[0].color; }
    }
    // 형광펜은 그라데이션과 함께 못 쓴다(블럭 형광펜은 글자 모양으로 잘려 «글자 속 색»이 된다)
    const hl = document.getElementById('txt-highlight-btn');
    if (hl) {
      hl.disabled = !!g;
      hl.title = g ? '그라데이션 글자엔 형광펜을 쓸 수 없어요 (단색으로 바꾸면 켜져요)' : '형광펜 (선택 영역 배경칠)';
    }
  }
  function _gateTextModes() {
    const why = textGradientBlockedReason(ctx.contentEl);   // 라벨·불릿 등 / 칠하는 글자 효과(메탈릭 등)
    const ok = !why;
    colorPicker.dataset.cpModes = ok ? 'solid,gradient' : 'solid';
    colorPicker.dataset.cpModesNote = ok ? '글자색은 이미지 채우기를 지원하지 않아요' : why;
    // 재오픈 시드 = 블럭의 «실제» 그라데이션(기본값으로 덮어쓰지 않게) — 저장소(인라인 스타일)에서 매번 되읽는다.
    const g = ok ? getTextGradient(ctx.contentEl) : null;
    if (g) colorPicker.dataset.cpGradient = JSON.stringify({ type: g.type, angle: g.angle, stops: g.stops });
    else delete colorPicker.dataset.cpGradient;
  }
  _gateTextModes();
  _syncGradUi();
  // 타입 전환(본문→라벨 등)이 게이트를 다시 계산하게 노출
  colorPicker.__textGradRegate = () => { _gateTextModes(); _syncGradUi(); };

  // ★스와치 mousedown 은 color-picker 의 document(capture) 델리게이션이 «먼저» 받아 피커를 연다 —
  //   그보다 앞(window capture)에서 시드를 고쳐 둔다: 부분 선택이 있으면 솔리드로(부분 단색),
  //   없으면 블럭 실제 그라데이션으로.
  const _preOpen = (e) => {
    if (!colorSwatch.isConnected) { window.removeEventListener('mousedown', _preOpen, true); return; }
    if (!colorSwatch.contains(e.target)) return;
    _gateTextModes();
    if (hasSel()) delete colorPicker.dataset.cpGradient;
  };
  if (window.__textGradPreOpen) window.removeEventListener('mousedown', window.__textGradPreOpen, true);
  window.__textGradPreOpen = _preOpen;
  window.addEventListener('mousedown', _preOpen, true);

  const _onGrad = (e, commit) => {
    const d = e.detail;
    if (!d || !d.css) return;
    if (!applyTextGradient(ctx.contentEl, d, { commit })) return;
    clearTextSelection();   // 그라데이션은 블럭 전체 — 이후 솔리드 복귀도 전체
    try {
      colorPicker.dataset.cpGradient = JSON.stringify({ type: d.type, angle: d.angle, stops: d.stops });
    } catch (_) {}
    _syncGradUi();
    // 팝업에서 각도·스탑을 바꾸면 캔버스 바도 따라 재배치(도형·배너와 같은 패턴).
    // 이 핸들러는 «팝업 조작»('goya-cp:gradient')에서만 불린다 — 캔버스 드래그는 sync 경로라 안 온다.
    window.showGradientLine?.(tb);
  };
  colorPicker.addEventListener('goya-cp:gradient', (e) => _onGrad(e, false));
  colorPicker.addEventListener('goya-cp:gradient-commit', (e) => _onGrad(e, true));
  /* ── 0920b textgrad-bar: 캔버스 그라데이션 바 ──
   * 블럭을 고르는 순간 켠다 — 그라데이션이 «안» 걸린 글자면 getGradientTarget 이 null 이라 no-op.
   * bindGradientLinePicker 는 재오픈 시드(dataset.cpGradient)와 «선택 스탑» 양방향 동기를 붙인다. */
  window.showGradientLine?.(tb);
  window.bindGradientLinePicker?.(tb, colorPicker);
  /* 글자색 hex — 배선은 color-picker.js 의 wireHexText 한 자리(2026-09-21 픽스 라운드).
     손사본이던 때는 무효값이 «말없이» 무시됐고(빨간 표시 없음) 커밋(change→pushHistory)도 없었다.
     ★빈 값 = 「안 정했다」(Mix 포함 placeholder 갈래) — 값으로 굳히지 않는다. */
  wireHexText(colorHex, {
    parse: (raw) => (String(raw ?? '').trim() === '' ? '' : parseHex6(raw)),
    format: (v) => (v ? formatHex6(v) : ''),
    getCurrent: () => _txtLastHex,
    onApply: (v) => {
      if (!v) return;                       // 빈 칸 = 미지정 — 옛 동작(no-op)과 같다
      _txtLastHex = v;
      colorPicker.value = v;
      const c = _buildColor();
      applyColorToSel(c);
      colorSwatch.style.background = c;
    },
    onCommit: (v) => { if (v) window.pushHistory?.(); },
  });
  colorAlpha.addEventListener('input', () => {
    const m = colorAlpha.value.match(/(\d+)/);
    if (!m) return;
    _txtAlpha = Math.max(0, Math.min(100, parseInt(m[1])));
    const c = _buildColor();
    applyColorToSel(c);
    colorSwatch.style.background = c;
  });
  colorAlpha.addEventListener('blur', () => { colorAlpha.value = String(_txtAlpha); });
  colorAlpha.addEventListener('change', () => { window.pushHistory?.(); });

  /* ── ⑨ 인라인 서식 버튼 (굵게 / 기울임 / 형광펜) ──
   * 규약은 취소선 버튼과 동일: 부분 선택이 있으면 그 영역만(execCommand), 없으면 블록 전체 토글.
   *   ⚠️버튼을 누르면 contentEl 이 blur 되므로 «mousedown 시점»에 selection 을 스냅샷해야 한다
   *     (click 때 읽으면 이미 사라진 뒤다 — 취소선이 쓰던 것과 같은 함정).
   *   ⚠️블록 전체로 켤 땐 내부 부분서식 잔재를 먼저 걷어내야 «블록 스타일이 단일 소스»가 된다.
   *     (안 걷어내면 껐는데도 일부 글자만 굵게 남는다.)
   * ★형광펜은 2026-10-06 에 이 규약에서 «빠졌다» — 아래 전용 배선을 보라(무선택도 «글자 길이»).
   * ★형광펜 기본색은 앱에 이미 있는 값(--ui-highlight)을 그대로 쓰되, 이제 그 기본값을 ★CSS 가 들고 있다
   *   (css/editor-layout.css `.text-block { --tb-hl-color: var(--ui-highlight) }`).
   *   ⇒ 여기서 토큰을 읽어 두던 HL_COLOR 상수는 ★지웠다. 색을 안 고른 블럭은 인라인이 «없어서»
   *     토큰이 바뀌면 같이 따라온다(옛 판은 단추를 누른 순간 hex 가 굳었다).
   */

  // 부분서식 잔재 정리: 지정 태그를 언랩하고, 지정 style prop 을 가진 span 을 벗긴다.
  const _stripInlineResidue = (el, tagSel, styleProp) => {
    if (!el) return;
    if (tagSel) {
      el.querySelectorAll(tagSel).forEach(n => {
        const parent = n.parentNode;
        while (n.firstChild) parent.insertBefore(n.firstChild, n);
        parent.removeChild(n);
      });
    }
    if (styleProp) {
      el.querySelectorAll(`span[style*="${styleProp}"]`).forEach(sp => {
        sp.style.removeProperty(styleProp);
        const styleStr = sp.getAttribute('style') || '';
        if (!styleStr.replace(/;|\s/g, '')) {
          const parent = sp.parentNode;
          while (sp.firstChild) parent.insertBefore(sp.firstChild, sp);
          parent.removeChild(sp);
        }
      });
    }
  };

  // btnId 버튼 하나를 «부분=execCommand / 전체=블록 인라인 스타일» 규약으로 배선한다.
  const wireInlineStyleBtn = ({ btnId, cmd, cmdVal = null, tagSel, styleProp, isOn, setOn, setOff }) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const saved = getSavedTextSelection(ctx.contentEl)?.range || null;
      if (saved) {
        applyExecCmd(saved, cmd, cmdVal);
        window.pushHistory?.();
        window.scheduleAutoSave?.();
        return;
      }
      const el = ctx.contentEl;
      if (!el) return;
      const nowOn = !isOn(el);
      if (nowOn) {
        _stripInlineResidue(el, tagSel, styleProp);
        setOn(el);
      } else {
        _stripInlineResidue(el, tagSel, styleProp);
        setOff(el);
      }
      btn.classList.toggle('active', nowOn);
      window.pushHistory?.();
      window.scheduleAutoSave?.();
    });
  };

  wireInlineStyleBtn({
    btnId: 'txt-bold-btn', cmd: 'bold', tagSel: 'b, strong', styleProp: 'font-weight',
    isOn: el => parseInt(panelRenderedWeight(el), 10) >= 600,   // 묶음 B #16 — 그려진 굵기(옛: 인라인만 → CSS 600 제목에서 첫 클릭이 600→700 «안 바뀐 듯»)
    setOn: el => {
      el.style.fontWeight = '700';
      // 블록 굵기의 단일 소스는 weight select 다 — 표시를 어긋나게 두지 않는다.
      const sel = document.getElementById('txt-font-weight');
      if (sel) sel.value = '700';
    },
    setOff: el => {
      el.style.fontWeight = '400';
      const sel = document.getElementById('txt-font-weight');
      if (sel) sel.value = '400';
    },
  });

  wireInlineStyleBtn({
    btnId: 'txt-italic-btn', cmd: 'italic', tagSel: 'i, em', styleProp: 'font-style',
    isOn: el => el.style.fontStyle === 'italic',
    setOn: el => { el.style.fontStyle = 'italic'; },
    setOff: el => { el.style.fontStyle = ''; },
  });

  /* ── ★형광펜 (2026-10-06 현빈 tb_5bkw8dq: 「하이라이트 기능은 ★텍스트 길이만큼 해주고,
   *    ★색변경 및 ★하이라이트 바 높이 조절가능하게」) ───────────────────────────────────────
   * ★무엇이 달라졌나 — 옛 판은 «갈래가 둘»이었다:
   *     부분 선택 → execCommand('hiliteColor') ⇒ span 이 글자를 감싸 «글자 길이»  ✅
   *     무선택   → contentEl.style.backgroundColor ⇒ «블럭 상자» 전체            ❌ (실측 716px vs 글자 298px)
   *   같은 단추가 다르게 동작했다. ⇒ ★두 갈래를 «하나»로 합친다 — 무선택이면 글자 «전체»를 범위로 잡아
   *   같은 span 을 두른다. 그러면 길이·색·높이 셋이 한 기전(css .tb-hl)에서 나온다.
   * ⛔wireInlineStyleBtn 으로 되돌리지 마라 — 그 규약의 「무선택=블럭 인라인」이 바로 이 결함이다. */
  const _hlSpans = (el) => (el ? [...el.querySelectorAll('span.' + HL_CLASS)] : []);
  const _hlIsOn = isHighlightOn;   // ★판정은 이 파일 맨 위 «한 자리»에서만 온다(prop-text.js 도 그걸 쓴다)
  const _unwrap = (n) => { const p = n.parentNode; if (!p) return; while (n.firstChild) p.insertBefore(n.firstChild, n); p.removeChild(n); };
  /* 새 꼴·옛 꼴·블럭 인라인을 «다» 걷는다 — 걷고 다시 두르므로 겹 span 이 안 쌓인다. */
  const _hlStripAll = (el) => {
    if (!el) return;
    _hlSpans(el).forEach(_unwrap);
    _stripInlineResidue(el, null, 'background-color');
    el.style.backgroundColor = '';
    el.normalize?.();
  };
  const _hlWrap = (range) => {
    const sp = document.createElement('span');
    sp.className = HL_CLASS;
    /* surroundContents 는 «부분만 걸친» 범위에서 던진다(여러 노드를 반쯤 덮을 때) — 그 때는 꺼내서 다시 넣는다. */
    try { range.surroundContents(sp); } catch (_) { sp.appendChild(range.extractContents()); range.insertNode(sp); }
    return sp;
  };
  /* 블럭 «전체»를 범위로. ⛔글자가 없으면 두르지 않는다 — 빈 span 은 획이 0폭이라 「눌렀는데 아무 일 없음」이 된다. */
  const _hlWrapWhole = (el) => {
    if (!el || !el.firstChild || !(el.textContent || '').trim()) return null;
    const r = document.createRange();
    r.selectNodeContents(el);
    return _hlWrap(r);
  };
  const _hlVarsOf = (el) => (el ? el.closest('.text-block') : null) || tb;
  /* 패널의 색·높이 칸을 함께 여닫는다 — 꺼져 있으면 정할 것이 없다. */
  const _hlSyncOpts = (on) => {
    const cr = document.getElementById('txt-hl-color-row'), hr = document.getElementById('txt-hl-h-row');
    if (cr) cr.style.display = on ? 'flex' : 'none';
    if (hr) hr.style.display = on ? 'flex' : 'none';
  };
  const hlBtn = document.getElementById('txt-highlight-btn');
  if (hlBtn) {
    hlBtn.addEventListener('click', () => {
      const el = ctx.contentEl;
      if (!el) return;
      const saved = getSavedTextSelection(el)?.range || null;
      if (saved) {
        /* 부분 선택 — 그 글자만. ⛔블럭 전체 상태를 건드리지 않는다(선택 밖 획이 살아 있어야 한다). */
        _hlWrap(saved);
        clearTextSelection?.(el);
        hlBtn.classList.add('active');
        _hlSyncOpts(true);
      } else {
        const nowOn = !_hlIsOn(el);
        _hlStripAll(el);                       // 켜든 끄든 «먼저 걷는다» — 켤 때 겹 span, 끌 때 잔재를 같이 없앤다
        if (nowOn) _hlWrapWhole(el);
        hlBtn.classList.toggle('active', nowOn);
        _hlSyncOpts(nowOn);
      }
      window.pushHistory?.();
      window.scheduleAutoSave?.();
    });
  }

  /* ★색 — 정본은 ★.text-block 의 인라인 --tb-hl-color ★하나다(dataset 사본을 두지 «않는다» —
       그리는 값과 패널이 읽는 값이 갈리는 자리가 된다. 패널은 prop-text.js 에서 이 인라인을 읽는다).
     ★왜 span 이 아니라 «블럭»에 박나 — 한 블럭 안에 획이 여럿일 수 있고(부분 선택 반복), 그 전부가
       같은 색이어야 「형광펜 색」이 한 값이다. span 마다 박으면 명부가 획 수만큼 늘어난다.
     ★안 고른 블럭은 인라인이 «없다» ⇒ CSS 기본값(--ui-highlight)이 산다. */
  const _hlApplyColor = (c) => {
    const host = _hlVarsOf(ctx.contentEl);
    if (!host) return;
    host.style.setProperty('--tb-hl-color', c);
  };
  wireColorField('txt-hl-color', {
    initialAlpha: 100,
    onApply: (c) => _hlApplyColor(c),
    onCommit: () => { window.pushHistory?.('형광펜 색'); window.scheduleAutoSave?.(); },
  });

  /* ★바 높이(%) — 100 = 글자를 다 덮는다 · 40 = 아래 40%만. 슬라이더와 숫자칸이 «같은 값»을 쓴다. */
  const _hlClampH = (v) => Math.min(100, Math.max(5, parseInt(v, 10) || 100));
  const _hlApplyH = (v) => {
    const host = _hlVarsOf(ctx.contentEl);
    if (!host) return;
    const n = _hlClampH(v);
    host.style.setProperty('--tb-hl-h', n + '%');   // ★정본은 이 인라인 하나(색과 같은 규약)
    return n;
  };
  const hlHRange = document.getElementById('txt-hl-h');
  const hlHNum   = document.getElementById('txt-hl-h-num');
  if (hlHRange && hlHNum) {
    const sync = (v, commit) => {
      const n = _hlApplyH(v);
      if (n == null) return;
      hlHRange.value = String(n); hlHNum.value = String(n);
      if (commit) { window.pushHistory?.('형광펜 바 높이'); window.scheduleAutoSave?.(); }
    };
    hlHRange.addEventListener('input',  () => sync(hlHRange.value, false));
    hlHRange.addEventListener('change', () => sync(hlHRange.value, true));
    hlHNum.addEventListener('input',    () => sync(hlHNum.value, false));
    hlHNum.addEventListener('change',   () => sync(hlHNum.value, true));
  }

  /* ── 장식선 토글 — ★취소선(S)과 ★밑줄(U) ────────────────────────────────────
   * 규약은 B/I 와 같다: 부분 선택이 있으면 그 영역만(execCommand), 없으면 블록 전체 토글.
   *
   * ★★왜 «한 자리»인가 (⑤ · 2026-10-08) — 둘은 ★한 CSS 속성(text-decoration-line)에 ★같이 산다.
   *   각자 `el.style.textDecorationLine = 'underline'` 로 쓰면 ★다른 하나를 ★조용히 지운다
   *   (취소선 켠 글에 밑줄을 켜면 취소선이 사라지고, 그 반대도). 옛 취소선 배선이 바로 그 꼴이었다
   *   — 그땐 이 속성을 ★혼자 썼으니 맞았다. ⇒ 이제 «토큰 집합»으로 읽고 쓴다.
   *   ⛔한쪽을 다시 `= '…'` 단일 대입으로 되돌리지 마라. 그러면 다른 하나가 사라지는데
   *     「켜졌다」만 재는 시험은 ★그걸 못 본다(tests/dom/text-underline.dom.spec.js U3 가 그 자다).
   * ★켜짐 판정은 ★포함으로 — `=== 'line-through'` 는 둘 다 켜진 판을 «꺼짐»으로 읽는다.
   *   패널의 단추 표시(prop-text.js isStrike·isUnderline)도 ★같은 잣대(포함)를 쓴다 — 갈리면 거꾸로 간다.
   */
  const DECO_TOKENS = ['underline', 'line-through'];
  const _decoTokens = (el) => {
    const raw = String((el && (el.style.textDecorationLine || el.style.textDecoration)) || '');
    return new Set(DECO_TOKENS.filter(t => raw.includes(t)));
  };
  const _decoWrite = (el, set) => {
    /* ★순서는 DECO_TOKENS 고정 — Set 순회 순서(=누른 순서)로 쓰면 같은 상태가 두 문자열이 되어
       저장본·골든이 «같은 뜻인데 다른 바이트»로 갈린다. */
    const v = DECO_TOKENS.filter(t => set.has(t)).join(' ');
    if (v) el.style.textDecorationLine = v;
    else el.style.removeProperty('text-decoration-line');
    /* 옛 저장본의 ★축약형(text-decoration: line-through)이 남아 있으면 그게 이긴다 — 같이 걷는다. */
    if (DECO_TOKENS.some(t => (el.style.textDecoration || '').includes(t))) el.style.textDecoration = '';
  };
  /* 부분 적용 잔재 정리 — 블록 스타일이 «단일 소스»가 되도록. ⛔내 토큰만 걷는다(다른 하나를 안 건드린다). */
  const _stripDecoResidue = (el, token, tagSel) => {
    el.querySelectorAll(tagSel).forEach(_unwrap);
    el.querySelectorAll(`span[style*="${token}"]`).forEach(sp => {
      const set = _decoTokens(sp); set.delete(token); _decoWrite(sp, set);
      const styleStr = sp.getAttribute('style') || '';
      if (!styleStr.replace(/;|\s/g, '')) _unwrap(sp);
    });
  };
  const wireDecoBtn = ({ btnId, cmd, token, tagSel }) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const saved = getSavedTextSelection(ctx.contentEl)?.range || null;
      if (saved) {
        // 부분 선택: 선택 영역만 토글 (execCommand 가 <u>/<strike> 토글을 처리한다)
        applyExecCmd(saved, cmd);
        window.pushHistory?.();
        return;
      }
      const el = ctx.contentEl;
      if (!el) return;
      const set = _decoTokens(el);
      const nowOn = !set.has(token);
      _stripDecoResidue(el, token, tagSel);
      if (nowOn) set.add(token); else set.delete(token);
      _decoWrite(el, set);
      btn.classList.toggle('active', nowOn);
      window.pushHistory?.();
    });
  };

  wireDecoBtn({ btnId: 'txt-strike-btn',    cmd: 'strikeThrough', token: 'line-through', tagSel: 'strike, s' });
  wireDecoBtn({ btnId: 'txt-underline-btn', cmd: 'underline',     token: 'underline',    tagSel: 'u' });

  /* ── 컬러 변수 칩 (L3 동적 바인딩) ──
   * 정의된 컬러 변수를 칩으로 노출하고, 클릭 시 글자색을 var(--color-<name>, #hex)로 바인딩한다.
   * 정적 hex 복사가 아니므로 변수 값이 바뀌면 자동 반영(L3 핵심).
   * fallback hex를 함께 넣어 export(HTML)/var 미정의 환경에서도 graceful degrade. */
  const chipContainer = document.getElementById('txt-color-chips');
  if (chipContainer) {
    // 현재 블록(또는 selection span)이 참조 중인 변수명 → 칩 active 표시
    const getActiveName = () => {
      // selection 적용 중이면 그 span의 color, 아니면 contentEl의 color
      const _s = getSavedTextSelection(ctx.contentEl);
      const _sp = _s && spanExactlyCovering(_s.range);
      if (_sp && _sp.style.color) return parseColorVarName(_sp.style.color);
      return parseColorVarName(ctx.contentEl?.style.color);
    };
    wireColorVarChips({
      container: chipContainer,
      getActiveName,
      // fallback hex는 변수의 현재 hex 사용 (export/HTML에서 var 미해석 시 대체)
      getFallbackHex: (name, hex) => hex,
      onPick: (cssRef /* var(--color-name, #hex) */) => {
        window.pushHistory?.();
        applyColorToSel(cssRef);
        // 피커 UI 동기화: 바인딩된 변수의 fallback hex를 swatch/hex 입력에 반영
        const fbHex = (cssRef.match(/#([0-9a-fA-F]{3,8})/) || [])[0];
        if (fbHex && /^#[0-9a-fA-F]{6}$/.test(fbHex)) {
          colorPicker.value = fbHex;
          colorHex.value = fbHex.replace('#', '').toUpperCase();
          _txtLastHex = fbHex;
        }
        // var 바인딩 시 불투명도는 100으로 — 칩 색이 안 보이는 일 방지
        _txtAlpha = 100;
        if (colorAlpha) colorAlpha.value = '100';
        colorSwatch.style.background = cssRef;
        // (옛 판은 여기서 선택을 «버렸다» — 이제는 남긴다: 다음 조작도 같은 글자에 간다)
      },
    });
  }
}
