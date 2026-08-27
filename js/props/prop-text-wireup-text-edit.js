/* prop-text-wireup-text-edit.js
 * font-size + color (selection-aware, Figma "b" policy)
 *
 * 정책 (Figma 일치):
 *  - contentEditable 내 일부 텍스트가 선택(드래그)된 상태라면 → 그 선택 부분만 <span style="..."> 으로 감싸 적용
 *  - 선택이 없으면 → 슬라이더/컬러 조작은 효과 없음 (전체 적용 X)
 *  - 단, 우측 패널을 클릭하는 순간 contentEditable 의 selection 이 사라지므로
 *    document 의 selectionchange 를 항상 추적해 contentEl 내부의 마지막 유효 selection 을 _lastSelRange 로 캐시
 *    → 우측 패널 mousedown 시 이 캐시를 _savedColorSel / _savedSizeSel 로 복원
 *
 * Mix 표기는 prop-text.js prelude 에서 _detectMix 로 계산 → template input 에 placeholder="Mix" 로 반영.
 */

import { wireColorVarChips, parseColorVarName } from './color-var-chips.js';

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
}

// 선택 있음: savedRange 영역을 color span 으로 감싼다.
// prevSpan(연결됨) 재사용 → 연속 input 중복 wrap 방지.
// 반환 { span, range } — 호출측이 다음 input 시퀀스를 위해 보존.
function _applyColorSpanToRange(color, host, savedRange, prevSpan) {
  if (!host || !savedRange) return { span: null, range: savedRange || null };
  if (prevSpan && prevSpan.isConnected) {
    prevSpan.style.color = color;
    return { span: prevSpan, range: savedRange };
  }
  const r = savedRange.cloneRange();
  const frag = r.extractContents();
  // frag 내부의 기존 color span 정리(이중 중첩 방지)
  frag.querySelectorAll('span').forEach(s => {
    if (s.style && s.style.color) {
      s.style.color = '';
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
  span.appendChild(frag);
  r.insertNode(span);
  _flattenAncestorWithPropIn(span, 'color', host);
  const newRange = document.createRange();
  newRange.selectNodeContents(span);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(newRange);
  return { span, range: newRange.cloneRange() };
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

/* ── 전역 셀 selection 캐시 (document 레벨 selectionchange) ──
   테이블 셀(td/th contenteditable=true) 안의 마지막 비-collapsed selection 을 캐시.
   우측 색 피커 클릭으로 셀이 blur 돼도 마지막 유효 셀 선택을 복원하기 위함.
   ★text-block 자체 캐시(_onSelChange/_lastSelRange)와 완전 분리 — 회귀 방지.
   ★셀은 편집 중(contenteditable=true)일 때만 기록 → 스테일 선택 오적용 방지. */
if (typeof window !== 'undefined' && !window.__cellSelCacheInstalled) {
  window.__cellSelCacheInstalled = true;
  window.__lastCellSel = null; // { range, cell }
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const a = sel.anchorNode, f = sel.focusNode;
    if (!a || !f) return;
    const start = a.nodeType === 1 ? a : a.parentElement;
    const cell = start && start.closest
      ? start.closest('td[contenteditable="true"], th[contenteditable="true"]')
      : null;
    if (cell && cell.contains(f)) {
      window.__lastCellSel = { range: sel.getRangeAt(0).cloneRange(), cell };
    }
  });
}

export function wireTextEditSection({ ctx, currentColorAlpha }) {
  let _savedColorSel = null;
  let _colorSpan = null; // 색상 적용 시 생성한 span (input 반복 호출에 재사용)

  /* ── 마지막 유효 selection 추적 (우측 패널 클릭으로 blur 되어도 살림) ── */
  let _lastSelRange = null;
  const _onSelChange = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    if (sel.isCollapsed) return;
    const a = sel.anchorNode, f = sel.focusNode;
    if (!a || !f) return;
    if (ctx.contentEl.contains(a) && ctx.contentEl.contains(f)) {
      _lastSelRange = sel.getRangeAt(0).cloneRange();
    }
  };
  document.addEventListener('selectionchange', _onSelChange);
  // showTextProperties 가 다시 호출되면 propPanel.innerHTML 이 교체되어 이전 핸들러는 dead.
  // selectionchange 만 document-level 이므로 leak 방지:
  // 새 wireTextEditSection 호출 시점에 이전 리스너를 정리하기 위해 window 에 단일 슬롯을 둠.
  if (window.__textEditSelChange) {
    document.removeEventListener('selectionchange', window.__textEditSelChange);
  }
  window.__textEditSelChange = _onSelChange;

  const hasSel = () => {
    if (!_lastSelRange) return false;
    // contentEl 이 detach 됐거나 다른 블록 selection 이 들어왔을 수 있으니 재검사
    const s = _lastSelRange.startContainer;
    const e = _lastSelRange.endContainer;
    return s && e && ctx.contentEl.contains(s) && ctx.contentEl.contains(e) && !_lastSelRange.collapsed;
  };

  // 새로 만든 span의 ancestor 중 같은 style prop을 가진 span을 평탄화 (외부 중첩 방지)
  // ctx.contentEl 을 경계로 전역 헬퍼에 위임 (size 경로에서 사용, 동작 불변).
  const _flattenAncestorWithProp = (newSpan, prop) => _flattenAncestorWithPropIn(newSpan, prop, ctx.contentEl);

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

  /* ── 폰트 크기 ── (Figma b: selection 없으면 효과 X) */
  const sizeNumber = document.getElementById('txt-size-number');
  let _savedSizeSel = null;
  let _sizeSpan = null;

  const saveSizeSel = () => {
    if (hasSel()) { _savedSizeSel = _lastSelRange.cloneRange(); _sizeSpan = null; }
    else { _savedSizeSel = null; _sizeSpan = null; }
  };
  const applySizeToSel = (v) => {
    if (!_savedSizeSel) {
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
      return;
    }
    if (_sizeSpan && _sizeSpan.isConnected) {
      _sizeSpan.style.fontSize = v + 'px';
      return;
    }
    const r = _savedSizeSel.cloneRange();
    const frag = r.extractContents();
    // 기존 font-size 적용 span 정리 (이중 wrap 방지)
    frag.querySelectorAll('span').forEach(s => {
      if (s.style && s.style.fontSize) {
        s.style.fontSize = '';
        const styleStr = s.getAttribute('style') || '';
        if (!styleStr.replace(/;|\s/g, '')) {
          const parent = s.parentNode;
          while (s.firstChild) parent.insertBefore(s.firstChild, s);
          parent.removeChild(s);
        }
      }
    });
    _sizeSpan = document.createElement('span');
    _sizeSpan.style.fontSize = v + 'px';
    _sizeSpan.appendChild(frag);
    r.insertNode(_sizeSpan);
    _flattenAncestorWithProp(_sizeSpan, 'fontSize');
    const newRange = document.createRange();
    newRange.selectNodeContents(_sizeSpan);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(newRange);
    _savedSizeSel = newRange.cloneRange();
  };

  // mousedown / pointerdown / focus 모두에서 selection 저장 시도 (브라우저 별 타이밍 안전망)
  sizeNumber.addEventListener('mousedown', saveSizeSel);
  sizeNumber.addEventListener('pointerdown', saveSizeSel);
  sizeNumber.addEventListener('focus', saveSizeSel);
  sizeNumber.addEventListener('input', () => {
    const v = Math.min(800, Math.max(8, parseInt(sizeNumber.value)||8));
    applySizeToSel(v);
  });
  sizeNumber.addEventListener('change', () => { _savedSizeSel = null; _sizeSpan = null; window.pushHistory?.(); });

  /* ── 색상 ── (Figma b: selection 없으면 효과 X) */
  const colorPicker = document.getElementById('txt-color');
  const colorHex    = document.getElementById('txt-color-hex');
  const colorAlpha  = document.getElementById('txt-color-alpha');
  const colorSwatch = colorPicker.closest('.prop-color-swatch');
  let _txtAlpha = currentColorAlpha;

  const saveColorSel = () => {
    if (hasSel()) { _savedColorSel = _lastSelRange.cloneRange(); _colorSpan = null; }
    else { _savedColorSel = null; _colorSpan = null; }
  };

  // 색상 관련 UI 전부에 mousedown/pointerdown 으로 selection 저장 (피커 다이얼로그가 selection 을 destroy 하기 전에 잡음)
  [colorSwatch, colorPicker, colorHex, colorAlpha].forEach(el => {
    if (!el) return;
    el.addEventListener('mousedown', saveColorSel);
    el.addEventListener('pointerdown', saveColorSel);
  });
  colorHex.addEventListener('focus', saveColorSel);
  colorAlpha.addEventListener('focus', saveColorSel);

  const _buildColor = () => {
    const h = (colorPicker.value || '#000000').replace('#','');
    const r = parseInt(h.slice(0,2), 16);
    const g = parseInt(h.slice(2,4), 16);
    const b = parseInt(h.slice(4,6), 16);
    const a = Math.max(0, Math.min(1, _txtAlpha / 100));
    return a >= 1 ? colorPicker.value : `rgba(${r},${g},${b},${a})`;
  };

  const applyColorToSel = (color) => {
    if (!_savedColorSel) {
      // selection 없으면 전체 contentEl에 일괄 적용
      // mix 상태(내부 span별 부분 색)를 풀어줘야 contentEl.style.color가 우선됨
      _applyColorWholeEditable(color, ctx.contentEl);
      return;
    }
    // 부분 선택 — 전역 primitive 로 위임(연속 input 은 _colorSpan 재사용).
    const res = _applyColorSpanToRange(color, ctx.contentEl, _savedColorSel, _colorSpan);
    _colorSpan = res.span;
    if (res.range) _savedColorSel = res.range;
  };

  colorPicker.addEventListener('input', () => {
    const c = _buildColor();
    applyColorToSel(c);
    colorHex.value = colorPicker.value.replace('#','').toUpperCase();
    colorSwatch.style.background = c;
  });
  colorPicker.addEventListener('change', () => { _savedColorSel = null; _colorSpan = null; window.pushHistory?.(); });
  colorHex.addEventListener('input', () => {
    const v = colorHex.value.trim().replace(/^#/, '');
    if (/^[0-9a-f]{6}$/i.test(v)) {
      colorPicker.value = '#' + v.toLowerCase();
      const c = _buildColor();
      applyColorToSel(c);
      colorSwatch.style.background = c;
    }
  });
  colorHex.addEventListener('blur', () => {
    colorHex.value = (colorPicker.value || '#000000').replace('#','').toUpperCase();
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
   * 형광펜 기본색은 앱에 이미 있는 텍스트 하이라이트 값(prop-text.js currentHighlightColor 기본값)
   * 을 그대로 쓴다 — 새 색을 만들지 않는다.
   */
  const HL_COLOR = '#ffeb3b';

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
    let saved = null;
    const save = () => { saved = hasSel() ? _lastSelRange.cloneRange() : null; };
    btn.addEventListener('mousedown', save);
    btn.addEventListener('pointerdown', save);
    btn.addEventListener('click', () => {
      if (saved) {
        applyExecCmd(saved, cmd, cmdVal);
        saved = null;
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
    isOn: el => { const w = el.style.fontWeight; return w === 'bold' || parseInt(w, 10) >= 600; },
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

  wireInlineStyleBtn({
    btnId: 'txt-highlight-btn', cmd: 'hiliteColor', cmdVal: HL_COLOR,
    tagSel: null, styleProp: 'background-color',
    isOn: el => !!(el.style.backgroundColor && el.style.backgroundColor !== 'transparent'),
    setOn: el => { el.style.backgroundColor = HL_COLOR; },
    setOff: el => { el.style.backgroundColor = ''; },
  });

  /* ── 취소선 토글 ──
   * 부분 선택 시: Cmd+B/I 와 동일한 execCommand 계열('strikeThrough')을 selection 복원 후 실행
   * 무선택 시: 블록(contentEl) 전체 토글 — 인라인 textDecorationLine 기준, 내부 부분 적용 잔재는 정리 */
  const strikeBtn = document.getElementById('txt-strike-btn');
  if (strikeBtn) {
    let _savedStrikeSel = null;
    const saveStrikeSel = () => {
      _savedStrikeSel = hasSel() ? _lastSelRange.cloneRange() : null;
    };
    strikeBtn.addEventListener('mousedown', saveStrikeSel);
    strikeBtn.addEventListener('pointerdown', saveStrikeSel);
    strikeBtn.addEventListener('click', () => {
      if (_savedStrikeSel) {
        // 부분 선택: 선택 영역만 취소선 토글 (execCommand가 <strike>/<s> 토글 처리)
        applyExecCmd(_savedStrikeSel, 'strikeThrough');
        _savedStrikeSel = null;
        window.pushHistory?.();
        return;
      }
      const el = ctx.contentEl;
      if (!el) return;
      const nowOn = !(el.style.textDecorationLine || el.style.textDecoration || '').includes('line-through');
      if (nowOn) {
        // 부분 적용 잔재 정리 (applyColorToSel 무선택 분기와 동일 패턴) — 블록 스타일이 단일 소스가 되도록
        el.querySelectorAll('strike, s').forEach(n => {
          const parent = n.parentNode;
          while (n.firstChild) parent.insertBefore(n.firstChild, n);
          parent.removeChild(n);
        });
        el.querySelectorAll('span[style*="line-through"]').forEach(s => {
          s.style.textDecorationLine = '';
          if ((s.style.textDecoration || '').includes('line-through')) s.style.textDecoration = '';
          const styleStr = s.getAttribute('style') || '';
          if (!styleStr.replace(/;|\s/g, '')) {
            const parent = s.parentNode;
            while (s.firstChild) parent.insertBefore(s.firstChild, s);
            parent.removeChild(s);
          }
        });
        el.style.textDecorationLine = 'line-through';
      } else {
        el.style.textDecorationLine = '';
        if ((el.style.textDecoration || '').includes('line-through')) el.style.textDecoration = '';
      }
      strikeBtn.classList.toggle('active', nowOn);
      window.pushHistory?.();
    });
  }

  /* ── 컬러 변수 칩 (L3 동적 바인딩) ──
   * 정의된 컬러 변수를 칩으로 노출하고, 클릭 시 글자색을 var(--color-<name>, #hex)로 바인딩한다.
   * 정적 hex 복사가 아니므로 변수 값이 바뀌면 자동 반영(L3 핵심).
   * fallback hex를 함께 넣어 export(HTML)/var 미정의 환경에서도 graceful degrade. */
  const chipContainer = document.getElementById('txt-color-chips');
  if (chipContainer) {
    // 현재 블록(또는 selection span)이 참조 중인 변수명 → 칩 active 표시
    const getActiveName = () => {
      // selection 적용 중이면 그 span의 color, 아니면 contentEl의 color
      if (_colorSpan && _colorSpan.isConnected) return parseColorVarName(_colorSpan.style.color);
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
        }
        // var 바인딩 시 불투명도는 100으로 — 칩 색이 안 보이는 일 방지
        _txtAlpha = 100;
        if (colorAlpha) colorAlpha.value = '100';
        colorSwatch.style.background = cssRef;
        // selection 적용을 1회로 마감(다음 picker 조작은 새 시퀀스)
        _savedColorSel = null; _colorSpan = null;
      },
    });
  }
}
