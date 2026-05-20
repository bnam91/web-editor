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
  // 단, ancestor 의 range 가 새 span 외 다른 영역을 덮으면 안 되므로,
  // ancestor 가 정확히 새 span 한 자식만 갖는 경우에만 평탄화 (안전 case),
  // 그 외에는 ancestor 의 prop 만 제거 (외부의 다른 텍스트는 영향 X).
  const _flattenAncestorWithProp = (newSpan, prop) => {
    let cur = newSpan.parentNode;
    while (cur && cur !== ctx.contentEl && cur.nodeType === 1) {
      if (cur.tagName === 'SPAN' && cur.style && cur.style[prop]) {
        // 같은 prop 가진 부모 span 발견
        // 부모 span 이 newSpan 외 다른 형제를 갖고 있으면 prop만 제거(상속 차단)하면 안 됨
        // — 차라리 newSpan을 부모 밖으로 끌어내야 함. 단순화를 위해 prop만 제거.
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
  };

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
    const v = Math.min(400, Math.max(8, parseInt(sizeNumber.value)||8));
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
      if (ctx.contentEl) {
        ctx.contentEl.querySelectorAll('span[style*="color"]').forEach(s => {
          s.style.color = '';
          const styleStr = s.getAttribute('style') || '';
          if (!styleStr.replace(/;|\s/g, '')) {
            const parent = s.parentNode;
            while (s.firstChild) parent.insertBefore(s.firstChild, s);
            parent.removeChild(s);
          }
        });
        ctx.contentEl.style.color = color;
      }
      return;
    }
    // 같은 input 시퀀스 — 이미 만든 span의 color만 갱신 (중복 wrap 방지)
    if (_colorSpan && _colorSpan.isConnected) {
      _colorSpan.style.color = color;
      return;
    }
    // 새 적용: 기존 selection 영역을 새 span으로 감싸기 + 내부 기존 color span 정리
    const r = _savedColorSel.cloneRange();
    const frag = r.extractContents();
    // frag 내부의 기존 color 적용 span들을 풀어줌 (이중 중첩 방지)
    frag.querySelectorAll('span').forEach(s => {
      if (s.style && s.style.color) {
        s.style.color = '';
        // style 속성이 비었으면 span을 평탄화 (children만 남기고 span 제거)
        const styleStr = s.getAttribute('style') || '';
        if (!styleStr.replace(/;|\s/g, '')) {
          const parent = s.parentNode;
          while (s.firstChild) parent.insertBefore(s.firstChild, s);
          parent.removeChild(s);
        }
      }
    });
    _colorSpan = document.createElement('span');
    _colorSpan.style.color = color;
    _colorSpan.appendChild(frag);
    r.insertNode(_colorSpan);
    _flattenAncestorWithProp(_colorSpan, 'color');
    // selection을 새 span 내부로 복원 → 추가 input 시 같은 영역 유지
    const newRange = document.createRange();
    newRange.selectNodeContents(_colorSpan);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(newRange);
    _savedColorSel = newRange.cloneRange();
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
}
