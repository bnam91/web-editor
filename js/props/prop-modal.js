/* ── Modal 블록 프로퍼티 패널 — 컨테이너(변형/크기/패딩/배경/테두리) + 텍스트 ──
   ★prop-innercard.js 의 관례를 그대로 쓴다: colorFieldHTML/wireColorField, 슬라이더+숫자 «쌍»,
     prop-block-label 풀 구조, setRpIdBadge, pushHistory()+scheduleAutoSave().
   글자 편집은 캔버스에서 더블클릭(block-drag) — 여기선 구조/스타일만 만진다. */
import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';
import { alignBtn } from './_helpers.js';
import { buildTypographySectionHtml, buildFillSectionHtml } from './_typo-section.js';
import { wireFontPicker } from './_font-picker.js';
import { wireColorVarChips, parseColorVarName } from './color-var-chips.js';
import { applyModalVariant, _effDefault, MODAL_DEFAULTS } from '../blocks/modal-block.js';

const _MDL_VARIANT_LABELS = {
  'plain': '기본 박스', 'titled': '제목 + 본문', 'icon': '아이콘 + 텍스트',
  'icon-stack': '아이콘 스택', 'grid-2': '2칸 그리드', 'dashed': '점선 테두리',
};

export function showModalProperties(block) {
  const v = block.dataset.variant || 'plain';
  // ★폴백은 «그 변형의 유효 기본값»이어야 한다 — MODAL_VARIANT_IDENTITY 와 같은 표를 본다.
  //   dataset 키가 없는 블록(손수 만든/가져온)에서 캔버스는 2px dashed 인데 패널만 0/solid 로
  //   보이던 «화면이 거짓말하는» 자리를 없앤다. renderModalBlock 의 폴백과 같은 값을 쓴다.
  const bg = block.dataset.bg || _effDefault(v, 'bg');
  const textColor = block.dataset.textColor || '#1c1c1e';
  const borderColor = block.dataset.borderColor || '#c3c3ca';
  const iconColor = block.dataset.iconColor || '#f0b429';
  const _i = (k, d) => { const n = parseInt(block.dataset[k]); return Number.isFinite(n) ? n : d; };
  const radius = _i('radius', 0);
  const padX = _i('padX', 20), padY = _i('padY', 18);
  const borderW = _i('borderW', _effDefault(v, 'borderW'));
  const borderStyle = block.dataset.borderStyle || _effDefault(v, 'borderStyle');
  const wMode = block.dataset.wMode === 'fixed' ? 'fixed' : 'full';
  const hMode = block.dataset.hMode === 'fixed' ? 'fixed' : 'auto';
  const width = _i('width', 400), height = _i('height', 120);
  const align = block.dataset.align || 'left';
  const fontSize = _i('fontSize', MODAL_DEFAULTS.fontSize);
  const gap = _i('gap', 14);
  // ★타이포 — 텍스트 패널과 «같은 절»을 쓴다(_typo-section.js). dataset 이 진실이다.
  const fontFamily = block.dataset.fontFamily || '';
  const fontWeight = block.dataset.fontWeight || '';
  const _f = (k, d) => { const n = parseFloat(block.dataset[k]); return Number.isFinite(n) ? n : d; };
  const lineHeight = _f('lineHeight', MODAL_DEFAULTS.lineHeight);
  const letterSpacing = _f('letterSpacing', 0);
  const on = (k) => block.dataset[k] === '1';

  const isIcon = (v === 'icon' || v === 'icon-stack');
  const isGrid = (v === 'grid-2');
  const isRaster = block.dataset.raster === '1';

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1.5" y="2" width="9" height="8" rx="1.5"/><path d="M3.5 7.5 H8.5 M3.5 5 H6.5"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Modal'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb ? window.getBlockBreadcrumb(block) : ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Variant</div>
      <div class="prop-row">
        <span class="prop-label">형태</span>
        <select class="prop-select" id="mdl-variant">
          ${Object.entries(_MDL_VARIANT_LABELS).map(([k, l]) =>
            `<option value="${k}"${k === v ? ' selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      ${isGrid ? `
      <div class="prop-row">
        <span class="prop-label">칸 간격</span>
        <input type="range" class="prop-slider" id="mdl-gap-slider" min="0" max="40" step="2" value="${gap}">
        <input type="number" class="prop-number" id="mdl-gap-number" min="0" max="40" value="${gap}">
      </div>` : ''}
    </div>

    ${isIcon ? `
    <div class="prop-section">
      <div class="prop-section-title">Icon</div>
      <div class="prop-row">
        <span class="prop-label">아이콘</span>
        <button class="prop-btn-full" id="mdl-icon-pick" style="flex:1">아이콘 고르기</button>
      </div>
      <div class="prop-row">
        <span class="prop-label">크기</span>
        <input type="range" class="prop-slider" id="mdl-isize-slider" min="12" max="96" step="2" value="${_i('iconSize', 24)}">
        <input type="number" class="prop-number" id="mdl-isize-number" min="12" max="96" value="${_i('iconSize', 24)}">
      </div>
      <div class="prop-row">
        <span class="prop-label">아이콘색</span>
        ${isRaster
          ? `<span class="prop-label" style="opacity:.55">이미지는 색 변경 불가</span>`
          : colorFieldHTML({ idPrefix: 'mdl-ic', hex: iconColor, alpha: parseAlphaFromColor(iconColor) })}
      </div>
    </div>` : ''}

    <div class="prop-section">
      <div class="prop-section-title">Size</div>
      <div class="prop-row">
        <span class="prop-label">너비</span>
        <div class="prop-type-group">
          <button class="prop-type-btn ${wMode === 'full' ? 'active' : ''}" data-wm="full">풀폭</button>
          <button class="prop-type-btn ${wMode === 'fixed' ? 'active' : ''}" data-wm="fixed">고정</button>
        </div>
        <input type="number" class="prop-number" id="mdl-w-number" min="80" max="860" value="${width}"${wMode === 'fixed' ? '' : ' disabled'}>
      </div>
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <div class="prop-type-group">
          <button class="prop-type-btn ${hMode === 'auto' ? 'active' : ''}" data-hm="auto">자동</button>
          <button class="prop-type-btn ${hMode === 'fixed' ? 'active' : ''}" data-hm="fixed">고정</button>
        </div>
        <input type="number" class="prop-number" id="mdl-h-number" min="30" max="900" value="${height}"${hMode === 'fixed' ? '' : ' disabled'}>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Padding</div>
      <div class="prop-row">
        <span class="prop-label">좌우</span>
        <input type="range" class="prop-slider" id="mdl-padx-slider" min="0" max="80" step="2" value="${padX}">
        <input type="number" class="prop-number" id="mdl-padx-number" min="0" max="80" value="${padX}">
      </div>
      <div class="prop-row">
        <span class="prop-label">상하</span>
        <input type="range" class="prop-slider" id="mdl-pady-slider" min="0" max="80" step="2" value="${padY}">
        <input type="number" class="prop-number" id="mdl-pady-number" min="0" max="80" value="${padY}">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Background</div>
      <div class="prop-row"><span class="prop-label">배경색</span>${colorFieldHTML({ idPrefix: 'mdl-bg', hex: bg, alpha: parseAlphaFromColor(bg) })}</div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Border</div>
      <div class="prop-row">
        <span class="prop-label">두께</span>
        <input type="range" class="prop-slider" id="mdl-bw-slider" min="0" max="12" step="1" value="${borderW}">
        <input type="number" class="prop-number" id="mdl-bw-number" min="0" max="12" value="${borderW}">
      </div>
      <div class="prop-row">
        <span class="prop-label">스타일</span>
        <div class="prop-type-group">
          <button class="prop-type-btn ${borderStyle === 'solid' ? 'active' : ''}" data-bs="solid">실선</button>
          <button class="prop-type-btn ${borderStyle === 'dashed' ? 'active' : ''}" data-bs="dashed">점선</button>
          <button class="prop-type-btn ${borderStyle === 'dotted' ? 'active' : ''}" data-bs="dotted">점</button>
        </div>
      </div>
      <div class="prop-row"><span class="prop-label">테두리색</span>${colorFieldHTML({ idPrefix: 'mdl-bc', hex: borderColor, alpha: parseAlphaFromColor(borderColor) })}</div>
      <div class="prop-row">
        <span class="prop-label">모서리</span>
        <input type="range" class="prop-slider" id="mdl-radius-slider" min="0" max="60" step="2" value="${radius}">
        <input type="number" class="prop-number" id="mdl-radius-number" min="0" max="60" value="${radius}">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Text</div>
      <div class="prop-row">
        <span class="prop-label">정렬</span>
        <div class="prop-align-group">
          ${alignBtn('text', 'left',   { label: '왼쪽 정렬',   title: '왼쪽 정렬',   active: align === 'left',   attrs: { 'data-al': 'left' } })}
          ${alignBtn('text', 'center', { label: '가운데 정렬', title: '가운데 정렬', active: align === 'center', attrs: { 'data-al': 'center' } })}
          ${alignBtn('text', 'right',  { label: '오른쪽 정렬', title: '오른쪽 정렬', active: align === 'right',  attrs: { 'data-al': 'right' } })}
        </div>
      </div>
    </div>

    ${buildTypographySectionHtml({
      p: 'mdl-typo',
      font: fontFamily, weight: fontWeight, size: fontSize,
      isBold: on('bold'), isItalic: on('italic'), isStrike: on('strike'), isHighlight: on('highlight'),
      lh: lineHeight, ls: letterSpacing,
      sizeMin: 10, sizeMax: 60,
    })}

    ${buildFillSectionHtml({ p: 'mdl-typo', colorHex: textColor, alpha: parseAlphaFromColor(textColor) })}`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  const rerender = () => window.renderModalBlock?.(block);
  const commit = () => { window.pushHistory?.(); window.scheduleAutoSave?.(); };

  // ── 색 필드 (raw input[type=color] 금지 — 공용 컴포넌트 사용) ──
  const wireColor = (prefix, key) => {
    if (!document.getElementById(`${prefix}-color`)) return;
    wireColorField(prefix, {
      initialAlpha: parseAlphaFromColor(block.dataset[key] || ''),
      onApply: (c) => { block.dataset[key] = c; rerender(); },
      onCommit: commit,
    });
  };
  wireColor('mdl-bg', 'bg');
  wireColor('mdl-bc', 'borderColor');
  if (isIcon && !isRaster) wireColor('mdl-ic', 'iconColor');

  // ── 슬라이더 + 숫자 «쌍» ──
  const wireNum = (prefix, key, min, max) => {
    const s = document.getElementById(`mdl-${prefix}-slider`);
    const n = document.getElementById(`mdl-${prefix}-number`);
    if (!s || !n) return;
    const apply = (val) => {
      const x = Math.min(max, Math.max(min, Number.isFinite(val) ? val : min));
      block.dataset[key] = String(x);
      rerender();
      s.value = x; n.value = x;
    };
    s.addEventListener('input', () => apply(parseInt(s.value)));
    s.addEventListener('change', commit);
    n.addEventListener('change', () => { apply(parseInt(n.value)); commit(); });
  };
  wireNum('radius', 'radius', 0, 60);
  wireNum('padx', 'padX', 0, 80);
  wireNum('pady', 'padY', 0, 80);
  wireNum('bw', 'borderW', 0, 12);
  if (isGrid) wireNum('gap', 'gap', 0, 40);
  if (isIcon) wireNum('isize', 'iconSize', 12, 96);

  /* ── 타이포 배선 ──────────────────────────────────────────────────────────
     ★전부 «dataset 에 쓰고 rerender()» 다. ⛔슬롯(.tb-mdl-text)에 인라인으로 박지 마라 —
       renderModalBlock 이 `block.innerHTML = html` 로 슬롯을 통째로 새로 만들기 때문에
       인라인은 «첫 측정을 통과하고 조용히 죽는다»(패널의 모든 조작·변형 전환·로드마다 재렌더). */
  const setDs = (key, val) => {
    if (val === null || val === '') delete block.dataset[key];
    else block.dataset[key] = String(val);
    rerender();
  };

  // 폰트 — 위젯은 텍스트 패널과 «같은 벌»(_font-picker.js). 우리는 «적용»만 준다.
  wireFontPicker({
    root: propPanel,
    p: 'mdl-typo',
    getCurrent: () => block.dataset.fontFamily || '',
    onPick: (rawVal) => { setDs('fontFamily', rawVal); commit(); },
  });

  // 굵기 select
  document.getElementById('mdl-typo-font-weight')?.addEventListener('change', (e) => {
    setDs('fontWeight', e.target.value); commit();
  });

  // 크기 — ★범위는 10~60 이다(모달 쪽 값을 지킨다). 텍스트 패널의 8~800 이 아니다.
  const fsNum = document.getElementById('mdl-typo-size-number');
  fsNum?.addEventListener('change', () => {
    const x = Math.min(60, Math.max(10, parseInt(fsNum.value) || MODAL_DEFAULTS.fontSize));
    fsNum.value = x; setDs('fontSize', x); commit();
  });

  /* B / I / S / H — ⚠️슬롯 «전체»에만 걸린다.
     슬롯 글자는 _esc() 평문으로 dataset 에 저장되므로 «부분 선택 서식»은 원리적으로 불가하다
     (텍스트블록과 다른 점 — 거기선 <b> 태그가 살지만 여기선 «글자로» 보인다). */
  for (const [id, key] of [['bold', 'bold'], ['italic', 'italic'], ['strike', 'strike'], ['highlight', 'highlight']]) {
    const btn = document.getElementById(`mdl-typo-${id}-btn`);
    btn?.addEventListener('click', () => {
      const next = block.dataset[key] !== '1';
      btn.classList.toggle('active', next);
      setDs(key, next ? '1' : null); commit();
    });
  }

  // 줄간격 / 자간
  const lhNum = document.getElementById('mdl-typo-lh-number');
  lhNum?.addEventListener('change', () => {
    const x = Math.min(3, Math.max(1, parseFloat(lhNum.value) || MODAL_DEFAULTS.lineHeight));
    lhNum.value = x; setDs('lineHeight', x); commit();
  });
  const lsNum = document.getElementById('mdl-typo-ls-number');
  lsNum?.addEventListener('change', () => {
    const x = Math.min(40, Math.max(-10, parseFloat(lsNum.value) || 0));
    lsNum.value = x; setDs('letterSpacing', x); commit();
  });

  /* ── 글자색 (Fill 절) ──
     ⛔wireColorField 를 못 쓴다 — 그건 `<prefix>-hex` 를 보는데 이 절의 id 는
       텍스트 패널과 «같은» `<prefix>-color-hex` 다. 절을 공유한 대가로 배선은 여기서 짠다. */
  const cPick  = document.getElementById('mdl-typo-color');
  const cHex   = document.getElementById('mdl-typo-color-hex');
  const cAlpha = document.getElementById('mdl-typo-color-alpha');
  const cSwatch = cPick?.closest('.prop-color-swatch');
  let _mdlAlpha = parseAlphaFromColor(textColor);
  const buildColor = () => {
    const h = (cPick.value || '#000000').replace('#', '');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    const a = Math.max(0, Math.min(1, _mdlAlpha / 100));
    return a >= 1 ? cPick.value : `rgba(${r},${g},${b},${a})`;
  };
  const applyColor = () => {
    const c = buildColor();
    if (cSwatch) cSwatch.style.background = c;
    setDs('textColor', c);
  };
  cPick?.addEventListener('input', () => {
    // alpha 0 이면 색을 바꿔도 안 보인다 — 사용자가 alpha 를 안 건드렸으면 되살린다.
    if (_mdlAlpha === 0) { _mdlAlpha = 100; if (cAlpha) cAlpha.value = '100'; }
    if (cHex) cHex.value = cPick.value.replace('#', '').toUpperCase();
    applyColor();
  });
  cPick?.addEventListener('change', commit);
  cHex?.addEventListener('input', () => {
    const val = cHex.value.trim().replace(/^#/, '');
    if (!/^[0-9a-f]{6}$/i.test(val)) return;
    cPick.value = '#' + val.toLowerCase();
    if (_mdlAlpha === 0) { _mdlAlpha = 100; if (cAlpha) cAlpha.value = '100'; }
    applyColor();
  });
  cHex?.addEventListener('change', commit);
  cAlpha?.addEventListener('change', () => {
    _mdlAlpha = Math.min(100, Math.max(0, parseInt(cAlpha.value) || 0));
    cAlpha.value = String(_mdlAlpha);
    applyColor(); commit();
  });

  /* 컬러 변수 칩 — 정적 hex 복사가 아니라 var(--color-<name>, #hex) «바인딩»이다.
     ★modal-block.js 의 _MDL_COLOR_RE 가 var() 를 받도록 넓혔다 — 안 그러면 여기서
       칩이 「눌리는데 안 먹는」 상태가 된다(2026-09-08 실측). */
  const chipBox = document.getElementById('mdl-typo-color-chips');
  if (chipBox) {
    wireColorVarChips({
      container: chipBox,
      getActiveName: () => parseColorVarName(block.dataset.textColor || ''),
      getFallbackHex: (name, hex) => hex,
      onPick: (cssRef) => {
        window.pushHistory?.();
        setDs('textColor', cssRef);
        const fb = (String(cssRef).match(/#[0-9a-fA-F]{6}/) || [])[0];
        if (fb && cPick) { cPick.value = fb; if (cHex) cHex.value = fb.replace('#', '').toUpperCase(); }
        // var 바인딩이면 불투명도는 100 — 칩 색이 안 보이는 일 방지(텍스트 패널과 같은 관례)
        _mdlAlpha = 100; if (cAlpha) cAlpha.value = '100';
        if (cSwatch) cSwatch.style.background = cssRef;
        window.scheduleAutoSave?.();
      },
    });
  }

  // ── 변형 ──
  const sel = document.getElementById('mdl-variant');
  sel?.addEventListener('change', () => {
    // ★순서 고정 — applyModalVariant 가 «채우기 먼저, dataset.variant 갱신 나중»을 한 번에 한다.
    //   (dataset.variant 를 먼저 쓰면 「이전 변형의 기본값」 판정이 무너진다.)
    //   변형의 정체(테두리/배경)는 여기서 dataset 에 «박혀야» 한다 —
    //   dataset.variant 만 바꾸면 렌더된 borderTopStyle 이 none 으로 남는다.
    applyModalVariant(block, sel.value);
    rerender(); commit();
    // 재렌더 후 패널을 다시 그린다 — 값 필드(두께/스타일/배경)가 «새 정체»를 반영해야 한다.
    showModalProperties(block);   // 변형에 따라 패널 구성이 달라진다(아이콘/간격 행)
  });

  // ── 크기 모드 ──
  const wNum = document.getElementById('mdl-w-number');
  const hNum = document.getElementById('mdl-h-number');
  propPanel.querySelectorAll('[data-wm]').forEach(btn => btn.addEventListener('click', () => {
    block.dataset.wMode = btn.dataset.wm;
    propPanel.querySelectorAll('[data-wm]').forEach(b => b.classList.toggle('active', b === btn));
    if (wNum) wNum.disabled = (btn.dataset.wm !== 'fixed');
    rerender(); commit();
  }));
  propPanel.querySelectorAll('[data-hm]').forEach(btn => btn.addEventListener('click', () => {
    block.dataset.hMode = btn.dataset.hm;
    propPanel.querySelectorAll('[data-hm]').forEach(b => b.classList.toggle('active', b === btn));
    if (hNum) hNum.disabled = (btn.dataset.hm !== 'fixed');
    rerender(); commit();
  }));
  wNum?.addEventListener('change', () => {
    const x = Math.min(860, Math.max(80, parseInt(wNum.value) || 400));
    block.dataset.width = String(x); wNum.value = x; rerender(); commit();
  });
  hNum?.addEventListener('change', () => {
    const x = Math.min(900, Math.max(30, parseInt(hNum.value) || 120));
    block.dataset.height = String(x); hNum.value = x; rerender(); commit();
  });

  // ── 테두리 스타일 / 정렬 ──
  propPanel.querySelectorAll('[data-bs]').forEach(btn => btn.addEventListener('click', () => {
    block.dataset.borderStyle = btn.dataset.bs;
    propPanel.querySelectorAll('[data-bs]').forEach(b => b.classList.toggle('active', b === btn));
    rerender(); commit();
  }));
  propPanel.querySelectorAll('[data-al]').forEach(btn => btn.addEventListener('click', () => {
    block.dataset.align = btn.dataset.al;
    propPanel.querySelectorAll('[data-al]').forEach(b => b.classList.toggle('active', b === btn));
    rerender(); commit();
  }));

  // ── 아이콘 고르기 — Iconify 모달(에셋 SVG). 래스터도 같은 콜백으로 들어온다. ──
  document.getElementById('mdl-icon-pick')?.addEventListener('click', () => {
    window.openIconifyModal?.((picked) => {
      if (!picked) return;
      if (picked.name) block.dataset.iconName = picked.name;
      if (picked.svg) { block.dataset.iconSvg = picked.svg; delete block.dataset.raster; delete block.dataset.iconSrc; }
      if (picked.src) { block.dataset.iconSrc = picked.src; block.dataset.raster = '1'; delete block.dataset.iconSvg; }
      rerender(); commit();
      showModalProperties(block);   // 래스터면 색 컨트롤이 비활성으로 바뀐다
    }, { favorites: true });
  });
}

window.showModalProperties = showModalProperties;
