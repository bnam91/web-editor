/* prop-text-wireup-label.js
 * label 전용 스타일 컨트롤
 * - 배경색 (picker + hex + none 토글)
 * - radius (slider + number)
 * - pill 높이 (상하 패딩으로 조절)
 * - 5개 shape preset (pill / box / outline / circle / text)
 */
import { markLabelAutoColor, forgetLabelAutoColor } from './label-auto-color.js';
import { wireHexText, parseHex6, formatHex6 } from './color-picker.js';
import { labelShapeFromRendered } from './_panel-rendered.js';

export function wireLabelSection({ ctx }) {
  /* 태그 배경색 */
  const labelBgPicker = document.getElementById('label-bg-color');
  const labelBgHex    = document.getElementById('label-bg-hex');
  const labelBgNone   = document.getElementById('label-bg-none');
  /* ★배경을 바꿀 때 padding 을 «통째로 비우지 않는다»(B3 적대QA: 좌우 60 → 배경색 input → 36 으로 되돌아감, 알약 높이도 같은 길로 지워지던 옛 결함).
     「배경 없음」은 padding 을 0 으로 만들고(글자만 남는 꼴), 끌 때 «켜기 전 값»으로 되돌린다.
     켜기 전 인라인 값(상·우·하·좌)을 data-pad-before-none 에 담아 두고, 없음 «동안»의 패딩 조작(setPadX·setPillH)도 거기에 따라 적는다 —
     안 그러면 끌 때 옛 값이 새 값을 덮는다. 색만 바꾸는 입력은 padding 을 안 건드린다. */
  const _KEY = 'padBeforeNone';
  const _padForBg = (isNone) => {
    const el = ctx.contentEl, st = el.style;
    if (isNone) {
      if (el.dataset[_KEY] === undefined) el.dataset[_KEY] = JSON.stringify([st.paddingTop, st.paddingRight, st.paddingBottom, st.paddingLeft]);
      st.padding = '0';
    } else if (el.dataset[_KEY] !== undefined) {
      const [t, r, b, l] = JSON.parse(el.dataset[_KEY]);
      delete el.dataset[_KEY];
      st.padding = '';
      if (t) st.paddingTop = t; if (r) st.paddingRight = r; if (b) st.paddingBottom = b; if (l) st.paddingLeft = l;
    }
  };
  const _stashPad = (axis, v) => {   // 없음 동안 바꾼 값을 «끌 때 돌려줄 값»에도 적는다
    const raw = ctx.contentEl.dataset[_KEY]; if (raw === undefined) return;
    const a = JSON.parse(raw);
    if (axis === 'x') { a[1] = v + 'px'; a[3] = v + 'px'; } else { a[0] = v + 'px'; a[2] = v + 'px'; }
    ctx.contentEl.dataset[_KEY] = JSON.stringify(a);
  };
  if (labelBgPicker) {
    const labelBgSwatch = labelBgPicker.closest('.prop-color-swatch');
    const setLabelBg = (val) => {
      const isNone = val === 'transparent';
      ctx.contentEl.style.backgroundColor = val;
      _padForBg(isNone);
      ctx.contentEl.style.borderRadius = isNone ? '0' : (ctx.contentEl.style.borderRadius || '');
      labelBgSwatch.style.background = isNone ? 'transparent' : val;
      labelBgSwatch.classList.toggle('swatch-none', isNone);
      if (!isNone) { labelBgHex.value = formatHex6(val); labelBgPicker.value = val; }
    };
    labelBgPicker.addEventListener('input', () => {
      if (labelBgNone.checked) return;
      setLabelBg(labelBgPicker.value);
      labelBgHex.value = formatHex6(labelBgPicker.value);
    });
    /* 색 코드 칸 — 배선은 color-picker.js 의 wireHexText 한 자리(2026-09-20 유닛 colorhex).
       이 칸의 «문법»은 「빈 값 = 없음(transparent)」 + 6자리 hex 다 — 체크박스와 같은 상태를 글자로도 쓸 수 있다.
       예전엔 무효값이 말없이 무시되고 blur 복원도 없었다. */
    wireHexText(labelBgHex, {
      parse: (raw) => (String(raw ?? '').trim() === '' ? '' : parseHex6(raw)),
      format: (v) => (v ? formatHex6(v) : ''),
      getCurrent: () => (labelBgNone.checked ? '' : (labelBgPicker.value || '#111111')),
      onApply: (v) => {
        if (v === '') { setLabelBg('transparent'); labelBgNone.checked = true; return; }
        const keep = labelBgHex.value;
        setLabelBg(v); labelBgNone.checked = false;
        labelBgHex.value = keep;          // 타이핑 중인 글자를 덮어쓰지 않는다
      },
      onCommit: () => window.pushHistory?.(),
    });
    labelBgNone.addEventListener('change', () => {
      if (labelBgNone.checked) { setLabelBg('transparent'); labelBgHex.value = ''; }
      else {
        const v = labelBgPicker.value || '#111111';
        setLabelBg(v); labelBgHex.value = formatHex6(v);
      }
    });
  }
  /* 태그 모서리 */
  const rSlider = document.getElementById('label-radius-slider');
  const rNumber = document.getElementById('label-radius-number');
  if (rSlider) {
    rSlider.addEventListener('input', () => { ctx.contentEl.style.borderRadius = rSlider.value+'px'; rNumber.value = rSlider.value; });
    rSlider.addEventListener('change', () => window.pushHistory?.());
    rNumber.addEventListener('input', () => {
      const v = Math.min(40, Math.max(0, parseInt(rNumber.value)||0));
      ctx.contentEl.style.borderRadius = v+'px'; rSlider.value = v;
    });
    rNumber.addEventListener('change', () => window.pushHistory?.());
  }

  /* 태그 pill 높이 (상하 패딩으로 조절) — label-style-section 의 label-pill-height-slider (Tag Style 안) «한 곳».
   * ★U22(2026-10-05 · 지디 ①): Padding 절에 같은 값을 쥔 「박스 높이」(txt-label-h-*)가 하나 더 있었고
   *   양방향 동기화로 묶여 있었다(c97f4541). 값의 정체가 «태그 모양»(높이)이라 Tag Style 쪽만 남겼다.
   *   ⛔Padding 절의 «상하»(txt-pv-*)는 이번에 안 건드렸다 — U7(E101) 을 잰 뒤 처방한다.
   */
  const pillHSlider = document.getElementById('label-pill-height-slider');
  const pillHNumber = document.getElementById('label-pill-height-number');
  // ★원형(Circle)은 «패딩으로 커지지 않는다» — CSS 가드가 padding:0 !important 로 못박고
  //   크기를 인라인 width/height 로 잡기 때문이다. 그래서 원형에선 지름을 직접 바꾼다.
  //   (안 그러면 슬라이더를 끝까지 밀어도 25.6px 그대로 — 2026-09-03 현빈 신고 실측.)
  const _isCircle = () => ctx.contentEl.dataset.shape === 'circle';
  const setPillH = v => {
    if (_isCircle()) {
      ctx.contentEl.style.width  = v+'px';
      ctx.contentEl.style.height = v+'px';
      return;
    }
    const half = Math.round(v/2);
    ctx.contentEl.style.paddingTop = half+'px';
    ctx.contentEl.style.paddingBottom = half+'px';
    _stashPad('y', half);
  };
  const syncPillH = v => {
    if (pillHSlider) pillHSlider.value = v;
    if (pillHNumber) pillHNumber.value = v;
  };
  if (pillHSlider) {
    pillHSlider.addEventListener('input', () => { const v=parseInt(pillHSlider.value); setPillH(v); syncPillH(v); });
    pillHSlider.addEventListener('change', () => window.pushHistory?.());
    pillHNumber.addEventListener('input', () => {
      const v = Math.min(120, Math.max(0, parseInt(pillHNumber.value)||0));
      setPillH(v); syncPillH(v);
    });
    pillHNumber.addEventListener('change', () => window.pushHistory?.());
  }

  /* 알약 «안쪽» 좌우 패딩 — 글자 양옆 여백 = 알약 폭. (바깥 «왼쪽/오른쪽 패딩» 은 알약을 통째로 안쪽으로 민다)
   * 원형은 CSS 가드가 padding:0 !important 라 줄 자체를 숨긴다. 형태 버튼이 패딩을 다시 쓰므로 누른 뒤 값을 맞춘다. */
  const pxWrap   = document.getElementById('txt-label-padx-wrap');
  const pxSlider = document.getElementById('txt-label-padx-slider');
  const pxNumber = document.getElementById('txt-label-padx-number');
  const syncPadX = () => {
    if (!pxSlider) return;
    // 원형에서 줄을 숨기는 «까닭»: css/editor-layout.css 의 `.text-block .tb-label[data-shape="circle"]`(:357 근처)가
    //   `padding: 0 !important` 라 인라인 padding 으로도 못 덮는다 — 보여 줘도 안 먹어서 숨긴다. 「원형엔 칸 없음 = 버그」가 아니다.
    if (pxWrap) pxWrap.style.display = _isCircle() ? 'none' : 'block';
    const v = Math.round(parseFloat(getComputedStyle(ctx.contentEl).paddingLeft) || 0);
    pxSlider.value = v; pxNumber.value = v;
  };
  if (pxSlider) {
    const setPadX = v => {
      ctx.contentEl.style.paddingLeft  = v + 'px';
      ctx.contentEl.style.paddingRight = v + 'px';
      _stashPad('x', v);
    };
    pxSlider.addEventListener('input', () => { const v = parseInt(pxSlider.value) || 0; setPadX(v); pxNumber.value = v; });
    pxNumber.addEventListener('input', () => {
      const v = Math.min(100, Math.max(0, parseInt(pxNumber.value) || 0));
      setPadX(v); pxSlider.value = v;
    });
    const commitPadX = () => { window.pushHistory?.(); window.scheduleAutoSave?.(); };
    pxSlider.addEventListener('change', commitPadX);
    pxNumber.addEventListener('change', commitPadX);
  }

  /* 태그 형태 프리셋 */
  // 모든 프리셋은 디폴트 .tb-label(padding:11px 36px, font:26px/700, radius:8px) 기준 + 서로 토글 시 안전 복원
  // 공통 reset 헬퍼 — 인라인 background/color/border/size 제거 → CSS 디폴트 복귀
  const _resetLabelInline = () => {
    window.clearTextGradient?.(ctx.contentEl);   // 0918r2 textgrad: 라벨은 단색만
    ctx.contentEl.style.backgroundColor = '';
    ctx.contentEl.style.color = '';
    forgetLabelAutoColor(ctx.contentEl);   // 0920r6 labeltext: 색을 걷어냈으니 표식도 폐기(다음 프리셋이 제 색만 표식하게)
    ctx.contentEl.style.border = '';
    ctx.contentEl.style.width  = '';
    ctx.contentEl.style.height = '';
    delete ctx.contentEl.dataset[_KEY];   // 형태 버튼은 padding 을 새로 쓴다 — 옛 «없음 전» 값은 버린다
    ctx.contentEl.style.padding = '';   // circle→타shape 전환 시 padding:0 잔류 방지
    ctx.contentEl.style.display = '';
    ctx.contentEl.style.alignItems = '';
    ctx.contentEl.style.justifyContent = '';
    delete ctx.contentEl.dataset.shape; // 원형 가드 마커 제거(타shape에 aspect-ratio 가드 미적용)
  };
  document.getElementById('label-shape-pill')?.addEventListener('click', () => {
    window.pushHistory?.();
    _resetLabelInline();
    ctx.contentEl.style.borderRadius = '999px';
    ctx.contentEl.style.padding       = '11px 36px';
    const rSlider2 = document.getElementById('label-radius-slider');
    const rNumber2 = document.getElementById('label-radius-number');
    if (rSlider2) { rSlider2.value = 999; rNumber2.value = 999; }
    window.scheduleAutoSave?.();
  });
  document.getElementById('label-shape-box')?.addEventListener('click', () => {
    window.pushHistory?.();
    _resetLabelInline();
    ctx.contentEl.style.borderRadius = '8px';
    ctx.contentEl.style.padding       = '11px 36px';
    const rSlider2 = document.getElementById('label-radius-slider');
    const rNumber2 = document.getElementById('label-radius-number');
    if (rSlider2) { rSlider2.value = 8; rNumber2.value = 8; }
    window.scheduleAutoSave?.();
  });
  document.getElementById('label-shape-outline')?.addEventListener('click', () => {
    window.pushHistory?.();
    _resetLabelInline();
    ctx.contentEl.style.backgroundColor = 'transparent';
    ctx.contentEl.style.border = '1.5px solid currentColor'; // 텍스트 색 따라가는 외곽선
    ctx.contentEl.style.borderRadius = '8px';
    ctx.contentEl.style.padding = '11px 36px';
    const rSlider2 = document.getElementById('label-radius-slider');
    const rNumber2 = document.getElementById('label-radius-number');
    if (rSlider2) { rSlider2.value = 8; rNumber2.value = 8; }
    window.scheduleAutoSave?.();
  });
  document.getElementById('label-shape-circle')?.addEventListener('click', () => {
    window.pushHistory?.();
    _resetLabelInline();
    // CSS 가드(.tb-label[data-shape="circle"])가 정원/padding:0을 강제 → 저장된 블록도 회복
    ctx.contentEl.dataset.shape = 'circle';
    ctx.contentEl.style.borderRadius = '50%';
    ctx.contentEl.style.padding = '0';
    ctx.contentEl.style.width  = '64px';
    ctx.contentEl.style.height = '64px';
    ctx.contentEl.style.display = 'inline-flex';
    ctx.contentEl.style.alignItems = 'center';
    ctx.contentEl.style.justifyContent = 'center';
    // Circle은 숫자만 — 항상 "1"로 덮어쓰기 (사용자가 직접 2,3 등으로 변경 가능)
    ctx.contentEl.textContent = '1';
    // ★슬라이더를 지금 지름(64)에 맞춰 둔다. 안 맞추면 첫 드래그에서 «이전 pill 높이»부터
    //   시작해 크기가 툭 튄다(슬라이더가 가리키는 값과 실제가 어긋난 상태).
    syncPillH(64);
    const rSlider2 = document.getElementById('label-radius-slider');
    const rNumber2 = document.getElementById('label-radius-number');
    if (rSlider2) { rSlider2.value = 999; rNumber2.value = 999; }
    window.scheduleAutoSave?.();
  });
  document.getElementById('label-shape-text')?.addEventListener('click', () => {
    window.pushHistory?.();
    _resetLabelInline();
    ctx.contentEl.style.backgroundColor = 'transparent';
    // textgrad-ok: 바로 위 _resetLabelInline 이 clearTextGradient 를 불렀다
    ctx.contentEl.style.color = '#111111';
    markLabelAutoColor(ctx.contentEl);   // 0920r6 labeltext: 프리셋이 넣은 색도 «라벨이 넣은 색» — 라벨을 벗어나면 이 색만 걷어낸다
    ctx.contentEl.style.borderRadius = '0';
    ctx.contentEl.style.padding = '0';
    const rSlider2 = document.getElementById('label-radius-slider');
    const rNumber2 = document.getElementById('label-radius-number');
    if (rSlider2) { rSlider2.value = 0; rNumber2.value = 0; }
    window.scheduleAutoSave?.();
  });

  /* ★U7(E121 · 2026-10-05): Tag Style 켜짐 표시 — 형태 단추가 인라인을 쓴 «뒤» 그려진 모양으로 다시 판정한다
     (위 핸들러들 뒤에 등록 = 같은 요소의 리스너는 등록 순서대로 돈다). 판정 한 자리 = _panel-rendered.js. */
  const _SHAPES = ['pill', 'box', 'outline', 'circle', 'text'];
  const _markShape = () => {
    const cur = labelShapeFromRendered(ctx.contentEl);
    _SHAPES.forEach(k => document.getElementById('label-shape-' + k)?.classList.toggle('active', k === cur));
  };
  _SHAPES.forEach(k => document.getElementById('label-shape-' + k)?.addEventListener('click', _markShape));

  /* 「좌우 패딩」 줄 동기화 — ★위 형태 버튼 핸들러들 «뒤에» 등록한다(같은 요소의 리스너는 등록 순서대로 돈다.
     앞에 두면 버튼이 padding 을 쓰기 «전»에 값을 읽어 옛 값에 머문다). */
  document.querySelectorAll('[id^="label-shape-"]').forEach(b => b.addEventListener('click', syncPadX));
  document.getElementById('label-bg-none')?.addEventListener('change', syncPadX);
}
