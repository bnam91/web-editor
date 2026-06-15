// prop-annotation.js — 어노테이션 우측 속성 패널
// 프리셋 / 선 / 시작점 / 라벨 (디자인 시스템 공용 컴포넌트 사용)
import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

// ── 프리셋 ───────────────────────────────────────────────────────────────
const ANNOTATION_PRESETS = [
  {
    name: '빨간 콜아웃',
    strokeColor: '#e74c3c',
    strokeWidth: 1.5,
    anchorShape: 'circle',
    anchorSize:  7,
    labelFontSize: 16,
    labelColor:  '#1a1a1a',
    labelBg:     '#ffffff',
    labelBorderColor: '#e74c3c',
  },
  {
    name: '파란 라벨',
    strokeColor: '#1592fe',
    strokeWidth: 2,
    anchorShape: 'square',
    anchorSize:  8,
    labelFontSize: 16,
    labelColor:  '#ffffff',
    labelBg:     '#1592fe',
    labelBorderColor: '#1592fe',
  },
  {
    name: '검은 화살표',
    strokeColor: '#1a1a1a',
    strokeWidth: 2.5,
    anchorShape: 'triangle',
    anchorSize:  10,
    labelFontSize: 16,
    labelColor:  '#1a1a1a',
    labelBg:     '#ffffff',
    labelBorderColor: '#1a1a1a',
  },
];

// ── dataset → 정규화 상태 ─────────────────────────────────────────────
function _readState(block) {
  const D = window.ANNOT_DEFAULTS || {};
  let points = [];
  try { points = JSON.parse(block.dataset.points || '[]'); } catch (_) { points = []; }
  return {
    points,
    text:             block.dataset.text             || D.text || '텍스트',
    strokeColor:      block.dataset.strokeColor      || D.strokeColor,
    strokeWidth:      parseFloat(block.dataset.strokeWidth) || D.strokeWidth,
    anchorShape:      block.dataset.anchorShape      || D.anchorShape,
    anchorSize:       parseFloat(block.dataset.anchorSize) || D.anchorSize,
    labelFontSize:    parseFloat(block.dataset.labelFontSize) || D.labelFontSize,
    labelColor:       block.dataset.labelColor       || D.labelColor,
    labelBg:          block.dataset.labelBg          || D.labelBg,
    labelBorderColor: block.dataset.labelBorderColor || D.labelBorderColor,
    labelMode:        block.dataset.labelMode        || D.labelMode || 'text',
    labelImageSrc:    block.dataset.labelImageSrc    || '',
    labelImageSize:   parseInt(block.dataset.labelImageSize) || D.labelImageSize || 120,
    labelImageRadius: parseFloat(block.dataset.labelImageRadius ?? D.labelImageRadius ?? 0),
    labelBorderStyle: block.dataset.labelBorderStyle || D.labelBorderStyle || 'solid',
    labelBorderWidth: parseFloat(block.dataset.labelBorderWidth ?? D.labelBorderWidth ?? 1),
  };
}

// ── dataset 갱신 + 재렌더 + autoSave ──────────────────────────────────
function _writeProps(block, partial) {
  if ('strokeColor'      in partial) block.dataset.strokeColor      = String(partial.strokeColor);
  if ('strokeWidth'      in partial) block.dataset.strokeWidth      = String(partial.strokeWidth);
  if ('anchorShape'      in partial) block.dataset.anchorShape      = String(partial.anchorShape);
  if ('anchorSize'       in partial) block.dataset.anchorSize       = String(partial.anchorSize);
  if ('labelFontSize'    in partial) block.dataset.labelFontSize    = String(partial.labelFontSize);
  if ('labelColor'       in partial) block.dataset.labelColor       = String(partial.labelColor);
  if ('labelBg'          in partial) block.dataset.labelBg          = String(partial.labelBg);
  if ('labelBorderColor' in partial) block.dataset.labelBorderColor = String(partial.labelBorderColor);
  if ('text'             in partial) block.dataset.text             = String(partial.text);
  if ('labelMode' in partial) {
    const mode = partial.labelMode === 'image' ? 'image' : 'text';
    block.dataset.labelMode = mode;
    // 모드 전환 시 반대편 데이터 폐기 (보존 X)
    if (mode === 'text') {
      delete block.dataset.labelImageSrc;
      delete block.dataset.labelImageSize;
    } else {
      block.dataset.text = (window.ANNOT_DEFAULTS?.text) || '텍스트';
      if (!block.dataset.labelImageSize) {
        block.dataset.labelImageSize = String((window.ANNOT_DEFAULTS?.labelImageSize) || 120);
      }
    }
  }
  if ('labelImageSrc'    in partial) block.dataset.labelImageSrc    = String(partial.labelImageSrc);
  if ('labelImageSize'   in partial) block.dataset.labelImageSize   = String(partial.labelImageSize);
  if ('labelImageRadius' in partial) block.dataset.labelImageRadius = String(partial.labelImageRadius);
  if ('labelBorderStyle' in partial) block.dataset.labelBorderStyle = String(partial.labelBorderStyle);
  if ('labelBorderWidth' in partial) block.dataset.labelBorderWidth = String(partial.labelBorderWidth);
  _rerenderAnnotation(block);
  window.scheduleAutoSave?.();
}

// ── 블록 재렌더 (innerHTML 보존, 부분 갱신) ────────────────────────────
function _rerenderAnnotation(block) {
  const st = _readState(block);
  if (!st.points || st.points.length < 2) return;
  const first = st.points[0];
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // 선 (polyline)
  const line = block.querySelector('.annot-line');
  if (line) {
    line.setAttribute('stroke', st.strokeColor);
    line.setAttribute('stroke-width', String(st.strokeWidth));
  }

  // anchor 노드 교체
  const svg = block.querySelector('.annot-svg');
  const oldAnchor = block.querySelector('.annot-anchor');
  if (oldAnchor) oldAnchor.remove();
  if (svg && st.anchorShape !== 'none' && typeof window._renderAnnotAnchorSVG === 'function') {
    const angle = typeof window._calcAnnotAnchorAngle === 'function' ? window._calcAnnotAnchorAngle(st.points) : 0;
    const html = window._renderAnnotAnchorSVG(st.anchorShape, st.anchorSize, first[0], first[1], st.strokeColor, angle);
    if (html) {
      const tmp = document.createElementNS(SVG_NS, 'svg');
      tmp.innerHTML = html;
      const node = tmp.firstElementChild;
      if (node) {
        const firstHandle = svg.querySelector('.annot-handle');
        if (firstHandle) svg.insertBefore(node, firstHandle);
        else svg.appendChild(node);
      }
    }
  }

  // 라벨 스타일
  const label = block.querySelector('.annot-label');
  if (label) {
    label.style.fontSize     = st.labelFontSize + 'px';
    label.style.color        = st.labelColor;
    label.style.background   = st.labelBg;
    label.style.borderColor  = st.labelBorderColor;
    label.style.borderStyle  = st.labelBorderStyle;
    label.style.borderWidth  = st.labelBorderWidth + 'px';
    label.classList.toggle('annot-label-image', st.labelMode === 'image');

    // 이미지 모드 + radius > 0이면 padding 0 + border-radius 동기화 (이미지와 테두리 같은 모양)
    const imgWrapping = st.labelMode === 'image' && (parseFloat(st.labelImageRadius) || 0) > 0;
    if (imgWrapping) {
      const r = Math.max(0, Math.min(50, parseFloat(st.labelImageRadius) || 0));
      label.style.padding = '0';
      label.style.borderRadius = r + '%';
      label.style.overflow = 'hidden';
    } else {
      label.style.padding = '';
      label.style.borderRadius = '';
      label.style.overflow = '';
    }

    // 이미지 원형(반 이상 라운드)이면 라벨 중앙 부착, 아니면 4방향 모서리
    const isImgCircleish = st.labelMode === 'image' && (parseFloat(st.labelImageRadius) || 0) >= 25;
    if (isImgCircleish) {
      label.style.transform = 'translate(-50%,-50%)';
    } else if (typeof window._calcAnnotLabelTransform === 'function') {
      label.style.transform = window._calcAnnotLabelTransform(st.points);
    }

    if (st.labelMode === 'image') {
      // 이미지 모드: contenteditable 강제 해제 + img/placeholder 렌더
      if (label.getAttribute('contenteditable') === 'true') {
        label.setAttribute('contenteditable', 'false');
      }
      const inner = window._renderAnnotLabelInner?.('image', {
        labelImageSrc: st.labelImageSrc,
        labelImageSize: st.labelImageSize,
        labelImageRadius: st.labelImageRadius,
      });
      if (inner !== undefined) label.innerHTML = inner;
    } else {
      // 텍스트 모드
      if (label.querySelector('.annot-label-img, .annot-label-img-placeholder')) {
        label.innerHTML = '';
        label.textContent = st.text;
      } else if (label.getAttribute('contenteditable') !== 'true') {
        if ((label.textContent || '').trim() !== st.text) label.textContent = st.text;
      }
    }
  }
}

// ── 우측 패널 빌더 ──────────────────────────────────────────────────────
export function showAnnotationProperties(block) {
  if (!block) return;
  const st = _readState(block);
  const id = block.id || '';

  // 프리셋: 공용 .prop-preset-grid + .prop-preset-btn + .prop-preset-swatches(3 dots)
  const presetBtns = ANNOTATION_PRESETS.map((p, i) => `
    <button class="prop-preset-btn" data-preset-idx="${i}" title="${p.name}">
      <div class="prop-preset-swatches">
        <span class="prop-preset-dot" style="background:${p.strokeColor};"></span>
        <span class="prop-preset-dot" style="background:${p.labelBg};"></span>
        <span class="prop-preset-dot" style="background:${p.labelBorderColor};"></span>
      </div>
      <span class="prop-preset-name">${p.name}</span>
    </button>
  `).join('');

  // 시작점 모양: 공용 .prop-align-group + .prop-align-btn (active 풀배경)
  const SHAPES = ['circle', 'glow', 'square', 'triangle', 'arrowhead', 'none'];
  const shapeBtns = SHAPES.map(s => `
    <button class="prop-align-btn ${st.anchorShape === s ? 'active' : ''}" data-shape="${s}" title="${s}">
      ${_shapeIcon(s)}
    </button>
  `).join('');

  // 라벨 배경/테두리는 alpha 0(투명) 입력 가능
  const labelBgAlpha     = parseAlphaFromColor(st.labelBg);
  const labelBorderAlpha = parseAlphaFromColor(st.labelBorderColor);
  const strokeAlpha      = parseAlphaFromColor(st.strokeColor);
  const labelColorAlpha  = parseAlphaFromColor(st.labelColor);

  propPanel.innerHTML = `
    <div class="prop-section" data-prop-panel="annotation">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3" stroke-linecap="round">
            <circle cx="3" cy="9" r="1.5" fill="#888" stroke="none"/>
            <line x1="4" y1="8" x2="9.5" y2="2.5"/>
            <path d="M8 1.5 L10.5 4 L9.5 2.5 Z" fill="#888" stroke="none"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Annotation'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard?.('${id}')">${id}</span>` : ''}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">프리셋</div>
      <div class="prop-preset-grid">${presetBtns}</div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">선</div>
      <div class="prop-color-row">
        <span class="prop-label">색</span>
        ${colorFieldHTML({ idPrefix: 'annot-stroke', hex: _hex(st.strokeColor), alpha: strokeAlpha })}
      </div>
      <div class="prop-row">
        <span class="prop-label">두께</span>
        <input type="range" class="prop-slider" id="annot-stroke-w" min="0.5" max="8" step="0.5" value="${st.strokeWidth}">
        <input type="number" class="prop-number" id="annot-stroke-w-num" min="0.5" max="8" step="0.5" value="${st.strokeWidth}">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">시작점</div>
      <div class="prop-row">
        <div class="prop-align-group" id="annot-shape-group">${shapeBtns}</div>
      </div>
      <div class="prop-row">
        <span class="prop-label">크기</span>
        <input type="range" class="prop-slider" id="annot-anchor-size" min="2" max="24" step="1" value="${st.anchorSize}">
        <input type="number" class="prop-number" id="annot-anchor-size-num" min="2" max="24" step="1" value="${st.anchorSize}">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">라벨</div>
      <div class="prop-row">
        <div class="prop-align-group" id="annot-label-mode-group">
          <button class="prop-align-btn ${st.labelMode === 'text' ? 'active' : ''}" data-mode="text" title="텍스트">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><text x="8" y="12" text-anchor="middle" font-size="12" font-weight="700" font-family="system-ui">Aa</text></svg>
          </button>
          <button class="prop-align-btn ${st.labelMode === 'image' ? 'active' : ''}" data-mode="image" title="이미지">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="3" width="12" height="10" rx="1"/><circle cx="6" cy="7" r="1.2" fill="currentColor"/><path d="M2 11 L6 8 L9 10 L14 6" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
      ${st.labelMode === 'text' ? `
      <div class="prop-row">
        <textarea class="prop-textarea" id="annot-text" rows="2">${_escape(st.text)}</textarea>
      </div>
      <div class="prop-row">
        <span class="prop-label">크기</span>
        <input type="range" class="prop-slider" id="annot-font-size" min="8" max="48" step="1" value="${st.labelFontSize}">
        <input type="number" class="prop-number" id="annot-font-size-num" min="8" max="48" step="1" value="${st.labelFontSize}">
      </div>
      <div class="prop-color-row">
        <span class="prop-label">글자색</span>
        ${colorFieldHTML({ idPrefix: 'annot-label-color', hex: _hex(st.labelColor), alpha: labelColorAlpha })}
      </div>
      ` : `
      <div class="prop-row">
        <button class="prop-btn" id="annot-label-img-upload" style="width:100%;padding:8px 12px;">
          ${st.labelImageSrc ? '이미지 변경' : '이미지 업로드'}
        </button>
      </div>
      ${st.labelImageSrc ? `
      <div class="prop-row" style="justify-content:center;">
        <img src="${st.labelImageSrc}" style="max-width:100%;max-height:120px;border-radius:4px;border:1px solid var(--ui-border);" draggable="false">
      </div>
      <div class="prop-row">
        <button class="prop-btn" id="annot-label-img-remove" style="width:100%;padding:6px 12px;font-size:12px;color:var(--ui-text-muted);">이미지 제거</button>
      </div>
      ` : ''}
      <div class="prop-row">
        <span class="prop-label">크기(정사각)</span>
        <input type="range" class="prop-slider" id="annot-img-size" min="40" max="400" step="4" value="${st.labelImageSize}">
        <input type="number" class="prop-number" id="annot-img-size-num" min="20" max="800" step="1" value="${st.labelImageSize}">
      </div>
      <div class="prop-row">
        <span class="prop-label">라운드</span>
        <input type="range" class="prop-slider" id="annot-img-radius" min="0" max="50" step="1" value="${st.labelImageRadius}">
        <input type="number" class="prop-number" id="annot-img-radius-num" min="0" max="50" step="1" value="${st.labelImageRadius}">
      </div>
      `}
      <div class="prop-color-row">
        <span class="prop-label">배경</span>
        ${colorFieldHTML({ idPrefix: 'annot-label-bg', hex: _hex(st.labelBg), alpha: labelBgAlpha })}
      </div>
      <div class="prop-color-row">
        <span class="prop-label">테두리</span>
        ${colorFieldHTML({ idPrefix: 'annot-label-border', hex: _hex(st.labelBorderColor), alpha: labelBorderAlpha })}
      </div>
      <div class="prop-row">
        <span class="prop-label">선 스타일</span>
        <div class="prop-align-group" id="annot-border-style-group">
          <button class="prop-align-btn ${st.labelBorderStyle === 'solid' ? 'active' : ''}" data-style="solid" title="실선">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><line x1="1" y1="7" x2="13" y2="7"/></svg>
          </button>
          <button class="prop-align-btn ${st.labelBorderStyle === 'dashed' ? 'active' : ''}" data-style="dashed" title="대시">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="3 2"><line x1="1" y1="7" x2="13" y2="7"/></svg>
          </button>
          <button class="prop-align-btn ${st.labelBorderStyle === 'dotted' ? 'active' : ''}" data-style="dotted" title="점선">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="0.5 2.5"><line x1="1.5" y1="7" x2="12.5" y2="7"/></svg>
          </button>
        </div>
      </div>
      <div class="prop-row">
        <span class="prop-label">선 두께</span>
        <input type="range" class="prop-slider" id="annot-border-w" min="0" max="8" step="0.5" value="${st.labelBorderWidth}">
        <input type="number" class="prop-number" id="annot-border-w-num" min="0" max="8" step="0.5" value="${st.labelBorderWidth}">
      </div>
    </div>
  `;

  if (window.setRpIdBadge) window.setRpIdBadge(id || null);

  // ── 이벤트 와이어링 ────────────────────────────────────────────────
  // 프리셋
  propPanel.querySelectorAll('.prop-preset-btn[data-preset-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.presetIdx, 10);
      const p = ANNOTATION_PRESETS[idx];
      if (!p) return;
      if (typeof window.pushHistory === 'function') window.pushHistory('어노테이션 프리셋');
      _writeProps(block, { ...p });
      showAnnotationProperties(block);
    });
  });

  // 선 색 — 공용 colorField
  wireColorField('annot-stroke', {
    initialAlpha: strokeAlpha,
    onApply: (c) => _writeProps(block, { strokeColor: c }),
    onCommit: () => window.pushHistory?.('선 색'),
  });

  // 선 두께
  const sw = propPanel.querySelector('#annot-stroke-w');
  const swN = propPanel.querySelector('#annot-stroke-w-num');
  sw.addEventListener('input',  () => { swN.value = sw.value; _writeProps(block, { strokeWidth: parseFloat(sw.value) }); });
  sw.addEventListener('change', () => window.pushHistory?.('선 두께'));
  swN.addEventListener('input', () => {
    const v = Math.min(8, Math.max(0.5, parseFloat(swN.value) || 0.5));
    sw.value = v; _writeProps(block, { strokeWidth: v });
  });
  swN.addEventListener('change', () => window.pushHistory?.('선 두께'));

  // 시작점 모양 (공용 .prop-align-btn)
  propPanel.querySelectorAll('#annot-shape-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = btn.dataset.shape;
      propPanel.querySelectorAll('#annot-shape-group .prop-align-btn')
        .forEach(b => b.classList.toggle('active', b === btn));
      window.pushHistory?.('시작점 모양');
      _writeProps(block, { anchorShape: s });
    });
  });

  // 시작점 크기
  const asz = propPanel.querySelector('#annot-anchor-size');
  const aszN = propPanel.querySelector('#annot-anchor-size-num');
  asz.addEventListener('input',  () => { aszN.value = asz.value; _writeProps(block, { anchorSize: parseFloat(asz.value) }); });
  asz.addEventListener('change', () => window.pushHistory?.('시작점 크기'));
  aszN.addEventListener('input', () => {
    const v = Math.min(24, Math.max(2, parseFloat(aszN.value) || 2));
    asz.value = v; _writeProps(block, { anchorSize: v });
  });
  aszN.addEventListener('change', () => window.pushHistory?.('시작점 크기'));

  // 라벨 모드 토글
  propPanel.querySelectorAll('#annot-label-mode-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (mode === st.labelMode) return;
      window.pushHistory?.('라벨 모드');
      _writeProps(block, { labelMode: mode });
      showAnnotationProperties(block); // UI 재빌드
    });
  });

  // ── 텍스트 모드 wireup (텍스트 모드일 때만 DOM 존재) ──
  const txt = propPanel.querySelector('#annot-text');
  if (txt) {
    txt.addEventListener('input',  () => {
      block.dataset.text = txt.value;
      const label = block.querySelector('.annot-label');
      if (label && label.getAttribute('contenteditable') !== 'true') label.textContent = txt.value;
      window.scheduleAutoSave?.();
    });
    txt.addEventListener('change', () => window.pushHistory?.('라벨 텍스트'));
  }

  const fs  = propPanel.querySelector('#annot-font-size');
  const fsN = propPanel.querySelector('#annot-font-size-num');
  if (fs && fsN) {
    fs.addEventListener('input',  () => { fsN.value = fs.value; _writeProps(block, { labelFontSize: parseFloat(fs.value) }); });
    fs.addEventListener('change', () => window.pushHistory?.('라벨 크기'));
    fsN.addEventListener('input', () => {
      const v = Math.min(48, Math.max(8, parseFloat(fsN.value) || 8));
      fs.value = v; _writeProps(block, { labelFontSize: v });
    });
    fsN.addEventListener('change', () => window.pushHistory?.('라벨 크기'));
  }

  if (propPanel.querySelector('[data-color-field="annot-label-color"]') || document.getElementById('annot-label-color-hex')) {
    wireColorField('annot-label-color', {
      initialAlpha: labelColorAlpha,
      onApply: (c) => _writeProps(block, { labelColor: c }),
      onCommit: () => window.pushHistory?.('라벨 색'),
    });
  }

  // ── 이미지 모드 wireup ──
  const uploadBtn = propPanel.querySelector('#annot-label-img-upload');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = e => {
        const file = e.target.files[0];
        if (!file || !file.type.startsWith('image/')) return;
        if (file.size > 10 * 1024 * 1024) { alert('이미지 파일은 10MB 이하만 업로드할 수 있습니다.'); return; }
        const reader = new FileReader();
        reader.onload = ev => {
          window.pushHistory?.('라벨 이미지');
          _writeProps(block, { labelImageSrc: ev.target.result });
          showAnnotationProperties(block); // 미리보기 갱신
        };
        reader.readAsDataURL(file);
      };
      input.click();
    });
  }
  const removeBtn = propPanel.querySelector('#annot-label-img-remove');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      window.pushHistory?.('라벨 이미지 제거');
      _writeProps(block, { labelImageSrc: '' });
      showAnnotationProperties(block);
    });
  }
  const imgSz  = propPanel.querySelector('#annot-img-size');
  const imgSzN = propPanel.querySelector('#annot-img-size-num');
  if (imgSz && imgSzN) {
    imgSz.addEventListener('input',  () => { imgSzN.value = imgSz.value; _writeProps(block, { labelImageSize: parseInt(imgSz.value) }); });
    imgSz.addEventListener('change', () => window.pushHistory?.('라벨 이미지 크기'));
    imgSzN.addEventListener('input', () => {
      const v = Math.min(800, Math.max(20, parseInt(imgSzN.value) || 20));
      imgSz.value = Math.min(parseInt(imgSz.max), v);
      _writeProps(block, { labelImageSize: v });
    });
    imgSzN.addEventListener('change', () => window.pushHistory?.('라벨 이미지 크기'));
  }

  const imgR  = propPanel.querySelector('#annot-img-radius');
  const imgRN = propPanel.querySelector('#annot-img-radius-num');
  if (imgR && imgRN) {
    imgR.addEventListener('input',  () => { imgRN.value = imgR.value; _writeProps(block, { labelImageRadius: parseFloat(imgR.value) }); });
    imgR.addEventListener('change', () => window.pushHistory?.('라벨 이미지 라운드'));
    imgRN.addEventListener('input', () => {
      const v = Math.min(50, Math.max(0, parseFloat(imgRN.value) || 0));
      imgR.value = v;
      _writeProps(block, { labelImageRadius: v });
    });
    imgRN.addEventListener('change', () => window.pushHistory?.('라벨 이미지 라운드'));
  }

  wireColorField('annot-label-bg', {
    initialAlpha: labelBgAlpha,
    onApply: (c) => _writeProps(block, { labelBg: c }),
    onCommit: () => window.pushHistory?.('라벨 배경'),
  });
  wireColorField('annot-label-border', {
    initialAlpha: labelBorderAlpha,
    onApply: (c) => _writeProps(block, { labelBorderColor: c }),
    onCommit: () => window.pushHistory?.('라벨 테두리'),
  });

  // 선 스타일 토글
  propPanel.querySelectorAll('#annot-border-style-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      propPanel.querySelectorAll('#annot-border-style-group .prop-align-btn').forEach(b => b.classList.toggle('active', b === btn));
      window.pushHistory?.('선 스타일');
      _writeProps(block, { labelBorderStyle: btn.dataset.style });
    });
  });

  // 선 두께
  const bw = propPanel.querySelector('#annot-border-w');
  const bwN = propPanel.querySelector('#annot-border-w-num');
  if (bw && bwN) {
    bw.addEventListener('input',  () => { bwN.value = bw.value; _writeProps(block, { labelBorderWidth: parseFloat(bw.value) }); });
    bw.addEventListener('change', () => window.pushHistory?.('선 두께'));
    bwN.addEventListener('change', () => {
      const v = Math.min(8, Math.max(0, parseFloat(bwN.value) || 0));
      bw.value = v; _writeProps(block, { labelBorderWidth: v });
      window.pushHistory?.('선 두께');
    });
  }
}
window.showAnnotationProperties = showAnnotationProperties;

export function hideAnnotationProperties() {
  // 현재 패널이 annotation 마커인 경우에만 비움 (다른 블록 선택 중 충돌 방지)
  if (!propPanel) return;
  if (propPanel.querySelector('[data-prop-panel="annotation"]')) {
    propPanel.innerHTML = '';
    window.showPageProperties?.();
  }
}
window.hideAnnotationProperties = hideAnnotationProperties;

// ── 유틸 ─────────────────────────────────────────────────────────────────
function _hex(c) {
  if (!c) return '#000000';
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c;
  // rgba/rgb → hex
  const m = String(c).match(/\d+/g);
  if (!m || m.length < 3) return '#000000';
  return '#' + m.slice(0, 3).map(n => Math.max(0, Math.min(255, parseInt(n))).toString(16).padStart(2, '0')).join('');
}
function _escape(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _shapeIcon(s) {
  // currentColor 사용 → .prop-align-btn.active 시 흰색으로 자연스럽게 반전
  if (s === 'square')   return `<svg width="14" height="14" viewBox="0 0 16 16"><rect x="3" y="3" width="10" height="10" fill="currentColor"/></svg>`;
  if (s === 'triangle') return `<svg width="14" height="14" viewBox="0 0 16 16"><polygon points="8,2 14,13 2,13" fill="currentColor"/></svg>`;
  if (s === 'none')     return `<svg width="14" height="14" viewBox="0 0 16 16"><line x1="3" y1="13" x2="13" y2="3" stroke="currentColor" stroke-width="1.4"/><line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" stroke-width="1.4"/></svg>`;
  if (s === 'glow')     return `<svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="currentColor" opacity="0.3"/><circle cx="8" cy="8" r="3" fill="currentColor"/></svg>`;
  if (s === 'arrowhead') return `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="4,3 12,8 4,13"/></svg>`;
  return `<svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>`;
}
