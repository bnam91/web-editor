/* ── Modal 블록 프로퍼티 패널 — 컨테이너(변형/크기/패딩/배경/테두리) + 텍스트 ──
   ★prop-innercard.js 의 관례를 그대로 쓴다: colorFieldHTML/wireColorField, 슬라이더+숫자 «쌍»,
     prop-block-label 풀 구조, setRpIdBadge, pushHistory()+scheduleAutoSave().
   글자 편집은 캔버스에서 더블클릭(block-drag) — 여기선 구조/스타일만 만진다. */
import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

const _MDL_VARIANT_LABELS = {
  'plain': '기본 박스', 'titled': '제목 + 본문', 'icon': '아이콘 + 텍스트',
  'icon-stack': '아이콘 스택', 'grid-2': '2칸 그리드', 'dashed': '점선 테두리',
};

export function showModalProperties(block) {
  const v = block.dataset.variant || 'plain';
  const bg = block.dataset.bg || '#f6f7f9';
  const textColor = block.dataset.textColor || '#1c1c1e';
  const borderColor = block.dataset.borderColor || '#c3c3ca';
  const iconColor = block.dataset.iconColor || '#f0b429';
  const _i = (k, d) => { const n = parseInt(block.dataset[k]); return Number.isFinite(n) ? n : d; };
  const radius = _i('radius', 0);
  const padX = _i('padX', 20), padY = _i('padY', 18);
  const borderW = _i('borderW', 0);
  const borderStyle = block.dataset.borderStyle || 'solid';
  const wMode = block.dataset.wMode === 'fixed' ? 'fixed' : 'full';
  const hMode = block.dataset.hMode === 'fixed' ? 'fixed' : 'auto';
  const width = _i('width', 400), height = _i('height', 120);
  const align = block.dataset.align || 'left';
  const fontSize = _i('fontSize', 14);
  const gap = _i('gap', 14);
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
        <button class="prop-type-btn" id="mdl-icon-pick" style="flex:1">아이콘 고르기</button>
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
        <div class="prop-type-group">
          <button class="prop-type-btn ${align === 'left' ? 'active' : ''}" data-al="left">왼쪽</button>
          <button class="prop-type-btn ${align === 'center' ? 'active' : ''}" data-al="center">가운데</button>
          <button class="prop-type-btn ${align === 'right' ? 'active' : ''}" data-al="right">오른쪽</button>
        </div>
      </div>
      <div class="prop-row"><span class="prop-label">글자색</span>${colorFieldHTML({ idPrefix: 'mdl-fg', hex: textColor, alpha: parseAlphaFromColor(textColor) })}</div>
      <div class="prop-row">
        <span class="prop-label">크기</span>
        <input type="range" class="prop-slider" id="mdl-fs-slider" min="10" max="40" step="1" value="${fontSize}">
        <input type="number" class="prop-number" id="mdl-fs-number" min="10" max="40" value="${fontSize}">
      </div>
      <div class="prop-row"><span class="prop-label" style="opacity:.6">글자는 캔버스에서 더블클릭해 입력</span></div>
    </div>`;

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
  wireColor('mdl-fg', 'textColor');
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
  wireNum('fs', 'fontSize', 10, 40);
  if (isGrid) wireNum('gap', 'gap', 0, 40);
  if (isIcon) wireNum('isize', 'iconSize', 12, 96);

  // ── 변형 ──
  const sel = document.getElementById('mdl-variant');
  sel?.addEventListener('change', () => {
    block.dataset.variant = sel.value;
    rerender(); commit();
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
