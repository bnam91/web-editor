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
/* ★min/max 는 «리터럴로 쓰지 않는다» — modal-block.js 의 MODAL_LIMITS 한 표에서 온다.
   패널과 오버레이 핸들이 같은 표를 봐야 클램프가 갈라지지 않는다. */
/* ★그림자 단계도 «리터럴 금지» — MODAL_DROP_SHADOWS 한 표에서 온다.
   패널이 자기 배열을 갖는 순간, 표에 단계를 하나 더해도 패널이 안 따라온다. */
import { applyModalVariant, _effDefault, MODAL_DEFAULTS, MODAL_LIMITS, clampModal, setModalSizeMode,
         MODAL_DROP_SHADOWS } from '../blocks/modal-block.js';
const L = MODAL_LIMITS;

/* 스와치·hex 칸에 «보여 줄» 색.
   ⚠️dataset.textColor 는 hex 만 담는 게 아니다 — 컬러변수 칩은 `var(--color-x, #hex)` 를,
     alpha 조절은 `rgba(...)` 를 넣는다. 그 raw 를 hex 칸에 그대로 꽂으면
     「VAR(--COLOR…」가 글자로 뜨고 <input type="color"> 는 값을 못 읽어 «검정»으로 죽는다(실측).
   ⇒ 텍스트 패널과 같은 규칙: 보여 주는 것은 «풀린 hex» 다(변수의 폴백 hex = 그 변수의 현재 색).
     칩의 active 표시는 raw dataset 을 따로 보므로 바인딩 정보는 안 잃는다. */
function _swatchHex(v) {
  const s = String(v || '').trim();
  const m6 = s.match(/#([0-9a-fA-F]{6})\b/);
  if (m6) return '#' + m6[1].toLowerCase();
  const m3 = s.match(/#([0-9a-fA-F]{3})\b/);
  if (m3) return '#' + m3[1].toLowerCase().split('').map((ch) => ch + ch).join('');
  const rgb = s.match(/rgba?\(([^)]+)\)/i);
  if (rgb) {
    const p = rgb[1].split(',').map((x) => parseInt(x, 10));
    const to = (n) => Math.max(0, Math.min(255, n | 0)).toString(16).padStart(2, '0');
    return '#' + to(p[0]) + to(p[1]) + to(p[2]);
  }
  return MODAL_DEFAULTS.textColor;
}

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
  // ⛔리터럴 금지 — 폴백은 modal-block.js 의 표에서 온다(같은 수가 두 벌이 되는 자리였다).
  const iconColor = block.dataset.iconColor || MODAL_DEFAULTS.iconColor;
  const _i = (k, d) => { const n = parseInt(block.dataset[k]); return Number.isFinite(n) ? n : d; };
  // ★표 밖의 값(손수 넣은 dataset.radius=75 같은 것)을 «패널만» 다르게 보여 주지 않는다 —
  //   renderModalBlock 도 같은 clampModal 로 자른다. 셋이 갈라지던 자리다.
  const radius = clampModal(_i('radius', L.radius.min), L.radius);
  const padX = _i('padX', 20), padY = _i('padY', 18);
  const borderW = _i('borderW', _effDefault(v, 'borderW'));
  const borderStyle = block.dataset.borderStyle || _effDefault(v, 'borderStyle');
  const wMode = block.dataset.wMode === 'fixed' ? 'fixed' : 'full';
  const hMode = block.dataset.hMode === 'fixed' ? 'fixed' : 'auto';
  const width = _i('width', 400), height = _i('height', 120);
  const align = block.dataset.align || 'left';
  /* ★그림자 — 표 밖의 값(손으로 고친 저장본)은 «없음»으로 착지시킨다.
     renderModalBlock 의 _dropShadow 와 «같은 착지점»이어야 한다 — 여기만 다르면
     캔버스엔 그림자가 없는데 패널만 「강하게」가 켜져 보이는 «화면이 거짓말하는» 자리가 생긴다. */
  const dropShadow = MODAL_DROP_SHADOWS.includes(block.dataset.dropShadow)
    ? block.dataset.dropShadow : MODAL_DEFAULTS.dropShadow;
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
      <!-- ⑶⑷ 이미지 파일·SVG 프리셋은 «아이콘블럭의 그 패널»을 그대로 연다(아래 showModalIconProperties). -->
      <div class="prop-row">
        <span class="prop-label"></span>
        <button class="prop-btn-full" id="mdl-icon-more" style="flex:1">이미지 파일 · SVG 프리셋 …</button>
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
        <input type="number" class="prop-number" id="mdl-w-number" min="${L.width.min}" max="${L.width.max}" value="${width}"${wMode === 'fixed' ? '' : ' disabled'}>
      </div>
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <div class="prop-type-group">
          <button class="prop-type-btn ${hMode === 'auto' ? 'active' : ''}" data-hm="auto">자동</button>
          <button class="prop-type-btn ${hMode === 'fixed' ? 'active' : ''}" data-hm="fixed">최소</button>
        </div>
        <input type="number" class="prop-number" id="mdl-h-number" min="${L.height.min}" max="${L.height.max}" value="${height}"${hMode === 'fixed' ? '' : ' disabled'}>
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
        <input type="range" class="prop-slider" id="mdl-radius-slider" min="${L.radius.min}" max="${L.radius.max}" step="1" value="${radius}">
        <input type="number" class="prop-number" id="mdl-radius-number" min="${L.radius.min}" max="${L.radius.max}" value="${radius}">
      </div>
    </div>

    <!-- ★그림자 — 현빈 발주 2026-09-09. 줌블럭의 「도형 그림자」와 «같은 하네스»다:
           prop-align-group + prop-align-btn[data-val] 세 개, 어휘도 없음/부드럽게/강하게 그대로
           (선례 js/props/prop-zoom.js:227-233). ⛔새 컨트롤 종류를 발명하지 않는다.
         ⚠️줌에는 절 제목에 「(줌 이펙트와 별개)」가 붙는다 — 거기엔 광원(dataset.shadow)이라는
           «다른 그림자»가 이미 있어 가르는 말이 필요했기 때문이다. 모달에는 그 말이 없어
           (실측: modal-block.js·prop-modal.js 에 shadow/box-shadow 0건) 제목이 짧다.
         ⛔안내문 행을 두지 마라 — prop-label 은 폭 ~56px 라 문장이 잘린다(prop-zoom.js 실측 주석). -->
    <div class="prop-section">
      <div class="prop-section-title">Shadow</div>
      <div class="prop-row">
        <div class="prop-align-group" id="mdl-drop-group">
          <button class="prop-align-btn${dropShadow === 'none'   ? ' active' : ''}" data-val="none">없음</button>
          <button class="prop-align-btn${dropShadow === 'soft'   ? ' active' : ''}" data-val="soft">부드럽게</button>
          <button class="prop-align-btn${dropShadow === 'strong' ? ' active' : ''}" data-val="strong">강하게</button>
        </div>
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

    ${buildFillSectionHtml({ p: 'mdl-typo', colorHex: _swatchHex(textColor), alpha: parseAlphaFromColor(textColor) })}`;

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
  wireNum('radius', 'radius', L.radius.min, L.radius.max);
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
  // ★id 는 «통짜로» 적는다 — 템플릿으로 조립하면 grep 도 검사도 그 배선을 «못 본다».
  for (const [id, key] of [['mdl-typo-bold-btn', 'bold'], ['mdl-typo-italic-btn', 'italic'],
                           ['mdl-typo-strike-btn', 'strike'], ['mdl-typo-highlight-btn', 'highlight']]) {
    const btn = document.getElementById(id);
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
  // 스와치 «배경»만은 raw 로 — var() 바인딩이면 변수의 실제 색이 보여야 한다.
  if (cSwatch && textColor) cSwatch.style.background = textColor;
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
  /* ★dataset.wMode 를 여기서 «직접» 쓰지 않는다 — setModalSizeMode 가 단 하나의 문이다.
     「늘어나는 그 순간」 판정이 패널과 핸들 두 벌로 갈라지면 한쪽만 고쳐진다.
     돌려주는 값이 true 면 자동 가운데정렬이 채워진 것 ⇒ 정렬 버튼도 다시 그려야 한다. */
  propPanel.querySelectorAll('[data-wm]').forEach(btn => btn.addEventListener('click', () => {
    const filled = setModalSizeMode(block, 'w', btn.dataset.wm);
    propPanel.querySelectorAll('[data-wm]').forEach(b => b.classList.toggle('active', b === btn));
    if (wNum) wNum.disabled = (btn.dataset.wm !== 'fixed');
    rerender(); commit();
    if (filled) showModalProperties(block);
  }));
  propPanel.querySelectorAll('[data-hm]').forEach(btn => btn.addEventListener('click', () => {
    const filled = setModalSizeMode(block, 'h', btn.dataset.hm);
    propPanel.querySelectorAll('[data-hm]').forEach(b => b.classList.toggle('active', b === btn));
    if (hNum) hNum.disabled = (btn.dataset.hm !== 'fixed');
    rerender(); commit();
    if (filled) showModalProperties(block);
  }));
  wNum?.addEventListener('change', () => {
    const x = Math.min(L.width.max, Math.max(L.width.min, parseInt(wNum.value) || MODAL_DEFAULTS.width));
    block.dataset.width = String(x); wNum.value = x; rerender(); commit();
  });
  hNum?.addEventListener('change', () => {
    const x = Math.min(L.height.max, Math.max(L.height.min, parseInt(hNum.value) || MODAL_DEFAULTS.height));
    block.dataset.height = String(x); hNum.value = x; rerender(); commit();
  });

  // ── 테두리 스타일 / 정렬 ──
  propPanel.querySelectorAll('[data-bs]').forEach(btn => btn.addEventListener('click', () => {
    block.dataset.borderStyle = btn.dataset.bs;
    propPanel.querySelectorAll('[data-bs]').forEach(b => b.classList.toggle('active', b === btn));
    rerender(); commit();
  }));
  /* ── 그림자 3단 ──
     ★줌의 #zm-drop-group 배선(prop-zoom.js:290-302)과 «같은 하네스»다: 선택자를 id 로 좁히고,
       active 를 갈아끼우고, dataset 에 쓴다.
     ⚠️★한 가지가 다르다 — 줌은 rerender 를 «안» 부른다(칠하는 일을 CSS 가 하니까).
       모달은 renderModalBlock 이 cssText 를 «다시 짜야» box-shadow 가 나온다.
       ⛔block.style.boxShadow 로 직접 박지 마라 — cssText 는 통째 교체라, 다음 재렌더(패널의
         모든 조작·변형 전환·저장 로드)에서 «조용히 죽는다». 이 파일 타이포 주석과 같은 병이다.
     ⛔이 절은 «값이 같으면 아무 것도 안 한다» — 히스토리에 빈 칸을 안 쌓는다(줌과 같다). */
  propPanel.querySelectorAll('#mdl-drop-group .prop-align-btn').forEach(btn => btn.addEventListener('click', () => {
    const next = btn.dataset.val;
    if (block.dataset.dropShadow === next) return;
    propPanel.querySelectorAll('#mdl-drop-group .prop-align-btn')
      .forEach(b => b.classList.toggle('active', b === btn));
    block.dataset.dropShadow = next;
    rerender(); commit();
  }));
  propPanel.querySelectorAll('[data-al]').forEach(btn => btn.addEventListener('click', () => {
    block.dataset.align = btn.dataset.al;
    propPanel.querySelectorAll('[data-al]').forEach(b => b.classList.toggle('active', b === btn));
    rerender(); commit();
  }));

  /* ── 아이콘 고르기 ──
     ★버튼도 «캔버스 클릭과 같은 문»으로 들어간다 — openModalIconPicker(modal-block.js).
       전에는 고른 값을 dataset 에 앉히는 세 줄이 «이 파일에만» 있었다. ⑵로 캔버스 경로가
       생기는 순간 그 세 줄이 두 벌이 될 자리였다 ⇒ 옮기지 않고 «부른다». */
  document.getElementById('mdl-icon-pick')?.addEventListener('click', () => {
    window.openModalIconPicker?.(block);
  });

  // ⑶⑷ — 아이콘블럭의 «기본 기능들»(이미지 파일·SVG 프리셋·색·크기·회전) 그대로 열기
  document.getElementById('mdl-icon-more')?.addEventListener('click', () => {
    showModalIconProperties(block);
  });
}

/* ═══ ⑶⑷ 모달 아이콘 = «아이콘블럭과 같은 것»으로 다루기 ═══════════════════════════
   현빈 지시(2026-09-09): 「이미지파일 등의 버튼과 svg 프리셋 절이 나오게 / 아이콘 블럭과
   같은 역할이라 우측 프로퍼티에서 아이콘 선택 시 아이콘블럭에 있는 기본 기능들 나타나면 됨」

   ★★베끼지 않았다. prop-iconify.js 의 프리셋 라이브러리(카테고리·그리드·저장·삭제)와
     이미지 파일 불러오기는 «약 200줄»이고, 전부 showIconifyProperties 안에 산다.
     그 200줄을 이 파일로 옮기면 이 레포가 오늘만 여러 번 밟은 「같은 줄이 두 벌」이 된다.
   ⇒ 대신 .mdl-icon 슬롯을 «그 순간만» 아이콘블럭의 계약(class=icon-block + id + dataset)에
     맞춰 입히고 window.showIconifyProperties 를 «그대로» 부른다. 패널의 모든 절이 그
     아이콘블럭 코드에서 나온다. 아이콘블럭 파일(js/blocks/iconify-block.js ·
     js/props/prop-iconify.js)은 «한 글자도» 안 고쳤다.

   ★모델은 여전히 「모달의 dataset 이 진실」이다(modal-block.js:8).
     슬롯은 «보는 창»일 뿐이라, 슬롯에서 바뀐 값은 MutationObserver 로 모달 dataset 에
     되돌려 놓는다. 안 되돌리면 재렌더·저장·로드 왕복에서 아이콘이 증발한다.
   ⚠️입힌 것(class=icon-block)은 «임시»다 — 세션이 끝나면 벗기고 재렌더한다. 저장본은
     innerHTML 스냅샷이지만 로드가 renderModalBlock 으로 다시 그린다(save-load.js:1105)
     ⇒ 임시 class 가 저장본에 섞여도 로드된 화면에는 남지 않는다. */

/* 모달 dataset 키 ↔ 아이콘블럭 dataset 키. ⛔양쪽에 따로 적지 않는다 — 표 하나. */
const _MDL_ICON_KEYMAP = [
  ['iconSize',     'size'],
  ['iconColor',    'iconColor'],
  ['iconName',     'iconName'],
  ['iconSvg',      'iconSvg'],
  ['iconSrc',      'iconSrc'],
  ['raster',       'raster'],
  ['iconRotation', 'rotation'],
];

/** 모달 → 슬롯 (세션 시작) */
function _dressIconSlot(block, slot) {
  slot.classList.add('icon-block');
  if (!slot.id) slot.id = `${block.id || 'mdl'}__icn`;
  for (const [mk, ik] of _MDL_ICON_KEYMAP) {
    const v = block.dataset[mk];
    if (v === undefined || v === '') delete slot.dataset[ik];
    else slot.dataset[ik] = v;
  }
  if (!slot.dataset.size)     slot.dataset.size = String(MODAL_DEFAULTS.iconSize);
  if (!slot.dataset.rotation) slot.dataset.rotation = String(MODAL_DEFAULTS.iconRotation);
  slot.dataset.layerName = '모달 아이콘';
}

/** 슬롯 → 모달 (변경이 생길 때마다). ★여기가 「dataset 이 진실」을 지키는 자리다. */
function _syncIconSlotToModal(block, slot) {
  for (const [mk, ik] of _MDL_ICON_KEYMAP) {
    const v = slot.dataset[ik];
    if (v === undefined || v === '') delete block.dataset[mk];
    else block.dataset[mk] = v;
  }
  /* ⚠️벡터 SVG 는 dataset 에 «안 남는 길»이 있다 — updateIconifyBlock 은 새 SVG 를
       innerHTML 로만 그리고 dataset.iconSvg 를 안 쓴다(iconify-block.js:268~).
       그 길(로컬 SVG 파일 불러오기)로 들어온 그림을 DOM 에서 «주워» 모달에 남긴다.
     ⛔iconName 이 없으면 줍지 않는다 — 그건 아직 «자리표시자 SVG»라, 주우면
       placeholder 가 진짜 아이콘으로 굳어 버린다. */
  if (slot.dataset.raster === '1') {
    delete block.dataset.iconSvg;
  } else {
    delete block.dataset.raster; delete block.dataset.iconSrc;
    if (!block.dataset.iconSvg && slot.dataset.iconName) {
      const svg = slot.querySelector?.('svg')?.outerHTML;
      if (svg) block.dataset.iconSvg = svg;
    }
    /* _applyIconifyBlockStyle 은 cssText 를 통째 갈아끼워 color 를 «지운다».
       세션 중에는 재렌더를 안 하므로(패널이 슬롯 노드를 붙들고 있다) 여기서 되살린다. */
    if (block.dataset.iconColor) slot.style.color = block.dataset.iconColor;
  }
}

/* ★열려 있는 «아이콘 세션»은 항상 하나다.
   ⛔둘을 겹치면(교체 → 재렌더 → 다시 열기) 옛 세션의 감시자가 «새» 슬롯을 지우고 나간다.
     실제로 그 순서가 난다: 재렌더가 슬롯을 갈아끼우고, 옛 감시자는 마이크로태스크 «뒤»에 깬다.
   ⇒ 새 세션을 시작하기 «전에» 옛 세션을 동기적으로 닫는다. */
let _iconSession = null;

export function showModalIconProperties(block) {
  _iconSession?.(false);   // 옛 세션 먼저 닫는다(없으면 no-op)
  const slot = block?.querySelector?.('.mdl-icon');
  if (!slot || typeof window.showIconifyProperties !== 'function') {
    window.showModalProperties?.(block);
    return false;
  }
  _dressIconSlot(block, slot);
  window.showIconifyProperties(slot);   // ★아이콘블럭의 패널 «그 자체»

  /* ⛔아이콘블럭의 「정렬」만 걷어낸다 — 그 핸들러는 block.closest('.row') 의
       justifyContent 를 만지는데, 슬롯의 .row 는 «모달 자신의 row» 다.
       누르면 아이콘이 아니라 모달이 움직인다. 모달 안에서의 아이콘 위치는 모달의
       정렬(align/vAlign)이 이미 갖고 있으므로 «없는 게» 맞다.
     ★로직을 베껴 고치는 게 아니라 «안 맞는 칸을 뺀다» — 두 벌이 안 생긴다. */
  propPanel.querySelector('#icn-align-group')?.closest('.prop-row')?.remove();

  // 돌아가는 문 — 없으면 모달 속성으로 못 돌아온다(아이콘 패널은 모달을 모른다).
  const back = document.createElement('div');
  back.className = 'prop-section';
  back.innerHTML = '<button class="prop-btn-full" id="mdl-icn-back">← 모달 속성으로</button>';
  propPanel.insertBefore(back, propPanel.firstChild);

  /* ⭐아이콘블럭 패널의 「교체」 두 버튼을 «모달의 문»으로 돌려놓는다.
     ⛔그대로 두면 사고다 — 그 두 버튼은 콜백 없이 openIconifyModal 을 부르고
       (prop-iconify.js:360), 콜백이 없으면 iconify-panel 의 _doInsert 가
       addIconifyBlock 으로 «새 아이콘블럭을 캔버스에 꽂는다»(iconify-panel.js:376).
       ⇒ 모달 안에서 누르면 아이콘이 바뀌는 대신 «엉뚱한 블록»이 하나 생긴다.
     ⛔아이콘블럭 파일을 고쳐 콜백을 열지 «않는다» — 여기서 가로챈다.
     ⛔cloneNode 로 버튼을 갈아끼우지 «않는다» — 이 레포는 clone 경로를 명부로 관리한다
       (tests/unit/export-channel-roster.test.mjs). UI 버튼 하나 때문에 그 문을 새로 열지 않는다.
     ★대신 propPanel «조상»에서 캡처 단계로 잡는다 — 캡처는 대상에 닿기 «전»에 돌아서
       원래 리스너가 아예 안 뜬다(대상 요소에 같이 걸면 등록 순서라 보장이 안 된다).
     ⚠️propPanel 은 오래 사는 요소다 ⇒ 세션이 끝나면 «반드시» 떼어낸다(아래 finish). */
  const grabReplace = (e) => {
    if (done) return;
    if (!e.target?.closest?.('#icn-replace-btn, #icn-open-modal-btn')) return;
    e.stopPropagation(); e.preventDefault();
    window.openModalIconPicker?.(block);
  };
  propPanel.addEventListener('click', grabReplace, true);

  let done = false;
  let obs = null, panelObs = null;
  const finish = (reopen) => {
    if (done) return; done = true;
    if (_iconSession === finish) _iconSession = null;
    obs?.disconnect(); panelObs?.disconnect();
    propPanel.removeEventListener('click', grabReplace, true);   // 오래 사는 요소에 안 남긴다
    if (document.contains(slot)) {
      _syncIconSlotToModal(block, slot);
      slot.classList.remove('icon-block');   // 입힌 것을 벗긴다
      delete slot.dataset.layerName;
    }
    window.renderModalBlock?.(block);        // 모달 dataset 을 진실로 다시 그린다
    window.scheduleAutoSave?.();
    if (reopen) window.showModalProperties?.(block);
  };
  _iconSession = finish;

  /* 한 감시자로 둘을 본다:
     ⓐ 슬롯의 dataset/style 변화 → 모달로 되돌리기
     ⓑ 슬롯이 DOM 에서 사라짐(리사이즈 등으로 모달이 재렌더됨) → 세션 종료 */
  obs = new MutationObserver(() => {
    if (!document.contains(slot)) { finish(false); return; }
    _syncIconSlotToModal(block, slot);
    window.scheduleAutoSave?.();
  });
  obs.observe(slot, { attributes: true, childList: true, subtree: true });
  obs.observe(block, { childList: true });

  /* ⑶ 패널이 «다른 블록»으로 갈아끼워지면 세션도 끝난다 — 안 끝내면 슬롯이 icon-block 을
       입은 채 남고(선택 아웃라인·spacing 규칙이 딸려온다), 감시자도 영영 산다. */
  panelObs = new MutationObserver(() => {
    if (!propPanel.contains(back)) finish(false);
  });
  panelObs.observe(propPanel, { childList: true });

  document.getElementById('mdl-icn-back')?.addEventListener('click', () => finish(true));
  return true;
}

window.showModalIconProperties = showModalIconProperties;

window.showModalProperties = showModalProperties;
