// prop-annotation.js — 어노테이션 우측 속성 패널
// 프리셋 / 선 / 시작점 / 라벨 (디자인 시스템 공용 컴포넌트 사용)
import { propPanel } from '../globals.js';
import { blockHeaderHTML, escHtml } from './_helpers.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';
/* ★1017t1h3 — 「고른 글자만」 한 벌. ⛔선택을 여기서 따로 저장하지 않는다(_text-selection.js 머리말 ⛔). */
import { getSavedTextSelection, withTextSelection, applyStyleToRange } from './_text-selection.js';

// ── 프리셋 ───────────────────────────────────────────────────────────────
/* ★1013t1A2 — 프리셋은 «색·선·시작점»만 바꾼다. 글자 크기(옛 16)는 뺐다: 기본이 24 가 됐는데
   프리셋을 누르는 순간 16 으로 줄어드는 것을 막는다(크기는 「라벨 › 크기」에서만). */
const ANNOTATION_PRESETS = [
  {
    name: '빨간 콜아웃',
    strokeColor: '#e74c3c',
    strokeWidth: 1.5,
    anchorShape: 'circle',
    anchorSize:  7,
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
    labelColor:  '#1a1a1a',
    labelBg:     '#ffffff',
    labelBorderColor: '#1a1a1a',
  },
];

// ── dataset → 정규화 상태 ─────────────────────────────────────────────
function _readState(block) {
  // ★1013t1A3-pre — rebindAll 과 «같은 한 벌»(js/blocks/annotation-block.js annotPropsFromDataset)
  return window.annotPropsFromDataset(block);
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
      /* ★1017t1h3 — 글을 기본값으로 되돌리니 ★부분 서식도 같이 버린다(위 「반대편 데이터 폐기」와 같은 규약).
         ⛔안 지우면 image 로 갔다 text 로 돌아올 때 ★없는 글의 서식이 되살아난다. */
      delete block.dataset.labelHtml;
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
  if ('labelPad' in partial) {   // ★1017t1h5 — null = CSS 기본으로 되돌림(키 삭제)
    if (partial.labelPad == null) delete block.dataset.labelPad;
    else block.dataset.labelPad = String(partial.labelPad);
  }
  _rerenderAnnotation(block);
  window.scheduleAutoSave?.();
}

/* ══ ★★1017t1h3 패널 «부분 서식» — 라벨 글자 일부를 고르고 크기·색을 바꾸면 «고른 글자만» ═══════════
 * ★현빈 원문: 「라벨의 텍스트인 경우 선택한 영역만 색지정 혹은 폰트크기 등 각 다르게 … 일반 텍스트 블럭 처럼」
 * ★일반 텍스트 블럭과 ★같은 길이다 — 저장 선택(_text-selection.js ★한 벌) → `applyStyleToRange`(★한 벌)
 *   → 그 라벨 HTML 을 ★커밋 때와 ★같은 식(`annotReadLabelHtml`)으로 읽어 `dataset.labelHtml` 로 쓴다
 *   (line-host `lnApplyLinePartialColor` 와 ★같은 꼴 · ⛔새 거르개·새 저장 장치 0).
 * ★★선택이 «이 블럭의 라벨» 안에 없으면 ★false ⇒ 부르는 자가 ★옛 갈래(라벨 전체 dataset)를 탄다.
 *   ⇒ ★선택 없이 쓰던 손짓은 ★한 글자도 안 바뀐다(「편집 밖에서 바꾼 값은 블럭 전체」 — 핀·피그마와 같은 규약).
 * ★★«편집이 아직 열려 있나»로 ★두 갈래다 — ★line-host lnApplyLinePartialColor 가 ★같은 갈림을 쓴다.
 *   ⑴ ★열려 있으면(contenteditable=true) ★DOM 에만 칠하고 ★다시 그리지 ★않는다.
 *      ★왜 — 색 피커 스와치는 ★mousedown 을 막아 ★포커스가 라벨에 ★남는다(line-host 실측 probe:
 *        스와치 클릭에 blur·focusout 0). ★그 채로 라벨을 다시 그리면 ★방금 ★친 글자가 ★사라진다.
 *      ⇒ ★싣는 것은 ★커밋(annotation-select.js finish)이 한다. ★dataset 은 ★미리 써 둔다(편집 중 autoSave 가 들고 가게).
 *   ⑵ ★닫혀 있으면(패널로 간 blur 가 이미 커밋했다) ★다시 그린다 — ★«화면»과 ★«저장값»이 ★갈리지 않게
 *      (거르개가 떨군 것이 화면에만 남으면 다음 리로드에 ★조용히 사라진다).
 *      ★저장 선택은 `_alive()` 가 ★오프셋으로 되찾는다(글자 전체가 그대로라 ★지문이 같다)
 *      ⇒ ★연달아 두 번째 조작도 ★같은 글자에 간다(TX1 이 고친 그 증상).
 * ★★이 패널은 ★적용이 ★블럭을 ★통째로 다시 그리지 ★않는다(_rerenderAnnotation 은 ★라벨 «스타일»만 만진다)
 *   ⇒ ★그래서 line-host 처럼 ★«먼저 커밋»할 ★필요가 없다 — ⑴ 이 ★더 적게 건드린다.
 * ⛔`_writeProps` 를 부르지 않는다 — 그건 ★라벨 ★전체(labelFontSize·labelColor)를 바꾼다.
 */
function _annotApplyToSelection(block, prop, value) {
  const label = block.querySelector('.annot-label');
  if (!label || block.dataset.labelMode === 'image') return false;
  if (!getSavedTextSelection(label)) return false;
  const span = withTextSelection(
    (range, host) => (range ? applyStyleToRange(range, host, prop, value) : null),
    { within: label },
  );
  if (!span) return false;
  const next = window.annotLabelHtmlToStore?.(window.annotReadLabelHtml?.(label) || '') || '';
  if (next) block.dataset.labelHtml = next;
  else delete block.dataset.labelHtml;
  // ⑴ 편집이 열려 있으면 ★다시 그리지 않는다(위 머리말) — 커밋이 싣는다.
  if (label.getAttribute('contenteditable') !== 'true') {
    if (next) label.innerHTML = next;
    else label.textContent = block.dataset.text || '';
  }
  window.scheduleAutoSave?.();
  return true;
}

// ── 블록 재렌더 (innerHTML 보존, 부분 갱신) ────────────────────────────
function _rerenderAnnotation(block) {
  const st = _readState(block);
  if (!st.points || st.points.length < 2) return;

  // 선 (polyline)
  const line = block.querySelector('.annot-line');
  if (line) {
    line.setAttribute('stroke', st.strokeColor);
    line.setAttribute('stroke-width', String(st.strokeWidth));
  }

  // anchor 노드 교체 — ★1013t2C7-pre 한 벌(js/blocks/annotation-block.js annotRedrawAnchor)
  window.annotRedrawAnchor?.(block, st.points);

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
      // ★1017t1h5 — labelPad 가 null 이면 CSS 기본(4px 8px) 유지, 그 외엔 사방 동일로 이긴다.
      label.style.padding = st.labelPad != null ? st.labelPad + 'px' : '';
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
    // ★1013t1A3 — 개별 위치(translate)를 style «맨 끝»으로 다시 붙인다(위에서 padding 등이 새로 붙었을 수 있다)
    window.annotApplyLabelOffset?.(block);
  }
}

// ── 우측 패널 빌더 ──────────────────────────────────────────────────────
export function showAnnotationProperties(block) {
  if (!block) return;
  const st = _readState(block);
  const id = block.id || '';

  // ★1017t1h7 — 프리셋 드롭다운(정본 꼴 = js/props/prop-sticker.js #stk-preset-select).
  // 현빈 확정: 「가려져도 OK」 — 색 점 미리보기는 버린다.
  const presetOptions = ANNOTATION_PRESETS.map((p, i) => `<option value="${i}">${escHtml(p.name)}</option>`).join('');

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
  // ★1013t1A3 라벨 개별 위치(방사형 블럭 호의 「라벨 간격」 · 「자동 배치로 되돌리기」 꼴)
  const LIM    = window.ANNOT_LIMITS;
  const manual = st.labelDx !== 0 || st.labelDy !== 0;
  // ★1013t2C7 시작점 회전 — 삼각형·화살촉만(다른 모양엔 «방향»이 없다). 모양을 바꿔도 데이터는 남는다.
  const rotatable = st.anchorShape === 'triangle' || st.anchorShape === 'arrowhead';

  propPanel.innerHTML = `
    <div class="prop-section" data-prop-panel="annotation">
${blockHeaderHTML({
      icon: `          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3" stroke-linecap="round">
            <circle cx="3" cy="9" r="1.5" fill="#888" stroke="none"/>
            <line x1="4" y1="8" x2="9.5" y2="2.5"/>
            <path d="M8 1.5 L10.5 4 L9.5 2.5 Z" fill="#888" stroke="none"/>
          </svg>`,
      name: block.dataset.layerName,
      defaultName: 'Annotation',
      crumb: window.getBlockBreadcrumb?.(block) || '',
      id: id,
    })}
    </div>

    <div class="prop-section">
      <div class="prop-section-title">프리셋</div>
      <div class="prop-row">
        <select class="prop-select" id="annot-preset-select" style="flex:1;min-width:0;">
          <option value="">프리셋 선택...</option>
          ${presetOptions}
        </select>
      </div>
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
      ${rotatable ? `
      <div class="prop-row">
        <span class="prop-label">회전°</span>
        <input type="range" class="prop-slider" id="annot-anchor-rot" min="${LIM.anchorRot.min}" max="${LIM.anchorRot.max}" step="1" value="${st.anchorRot}">
        <input type="number" class="prop-number" id="annot-anchor-rot-num" min="${LIM.anchorRot.min}" max="${LIM.anchorRot.max}" step="1" value="${st.anchorRot}">
      </div>
      <button class="prop-btn-full" id="annot-anchor-rot-reset"${st.anchorRot !== 0 ? '' : ' disabled'}>자동 방향으로 되돌리기</button>
      ` : ''}
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
      <div class="prop-hint">캔버스에서 라벨을 더블클릭해 글을 고칩니다 · Enter 줄바꿈 · ⌘Enter/Esc 마침</div>
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
        ${colorFieldHTML({ idPrefix: 'annot-label-bg', hex: _hex(st.labelBg), alpha: labelBgAlpha, placeholder: '없음' })}
      </div>
      <div class="prop-color-row">
        <span class="prop-label">테두리</span>
        ${colorFieldHTML({ idPrefix: 'annot-label-border', hex: _hex(st.labelBorderColor), alpha: labelBorderAlpha, placeholder: '없음' })}
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
      <div class="prop-row">
        <span class="prop-label">여백</span>
        <input type="range" class="prop-slider" id="annot-label-pad" min="0" max="24" step="1" value="${st.labelPad ?? 8}">
        <input type="number" class="prop-number" id="annot-label-pad-num" min="0" max="24" step="1" value="${st.labelPad ?? 8}">
      </div>
    </div>

    <div class="prop-section" id="annot-label-pos-section">
      <div class="prop-section-title">라벨 위치</div>
      <div class="prop-row">
        <input type="number" class="prop-number" id="annot-label-dx" min="${LIM.labelDx.min}" max="${LIM.labelDx.max}" step="1" value="${st.labelDx}" title="가로(dx)">
        <input type="number" class="prop-number" id="annot-label-dy" min="${LIM.labelDy.min}" max="${LIM.labelDy.max}" step="1" value="${st.labelDy}" title="세로(dy)">
      </div>
      <button class="prop-btn-full" id="annot-label-reset"${manual ? '' : ' disabled'}>자동 배치로 되돌리기</button>
    </div>
  `;

  if (window.setRpIdBadge) window.setRpIdBadge(id || null);

  // ── 이벤트 와이어링 ────────────────────────────────────────────────
  // ★1017t1h7 — 프리셋(드롭다운) · push-after(쓰고 → 다시 그리고 → 찍는다 · :542-546 onOffset 과 같은 규약)
  propPanel.querySelector('#annot-preset-select')?.addEventListener('change', (e) => {
    const idx = parseInt(e.target.value, 10);
    const p = ANNOTATION_PRESETS[idx];
    if (!p) return;
    _writeProps(block, { ...p });
    showAnnotationProperties(block);
    window.pushHistory?.('어노테이션 프리셋');
    window.scheduleAutoSave?.();
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
      // ★1013t2C7 — 회전 줄·회전 손잡이는 모양에 따라 섰다 사라진다
      showAnnotationProperties(block);
      window.annotRefreshHandles?.(block);
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

  // ★1013t2C7 시작점 회전 — input 에서 쓰고(그림·손잡이 같이) change 에서 찍는다(push-after · prop-shape 「회전°」 꼴)
  const rotS = propPanel.querySelector('#annot-anchor-rot');
  const rotN = propPanel.querySelector('#annot-anchor-rot-num');
  const rotReset = propPanel.querySelector('#annot-anchor-rot-reset');
  const applyRot = (v) => {
    window.annotSetAnchorRot?.(block, parseFloat(v) || 0);
    const r = window.annotAnchorRotOf?.(block) || 0;
    if (rotReset) rotReset.disabled = r === 0;
    return r;
  };
  if (rotS && rotN) {
    rotS.addEventListener('input',  () => { rotN.value = applyRot(rotS.value); });
    rotS.addEventListener('change', () => window.pushHistory?.('시작점 회전'));
    rotN.addEventListener('input',  () => { rotS.value = applyRot(rotN.value); });
    // 확정(change) 때는 숫자칸에도 «감긴» 값을 되쓴다(200 → −160 · 이벨 D2). input 중엔 안 쓴다 — 치는 도중 '-' 등을 덮지 않게.
    rotN.addEventListener('change', () => { const r = applyRot(rotN.value); rotS.value = r; rotN.value = r; window.pushHistory?.('시작점 회전'); });
  }
  rotReset?.addEventListener('click', () => {
    if (!window.annotResetAnchorRot?.(block)) return;
    showAnnotationProperties(block);
    window.pushHistory?.('시작점 방향 되돌리기');
  });

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

  /* ★1013t1A2 — 글 입력칸(#annot-text)은 걷었다(현빈 「우측패널에 굳이 텍스트 입력할 플레이스홀더는 필요없음」).
     글은 캔버스에서 쓴다: 만든 직후 자동 편집(annotation-tool.js) · 라벨 더블클릭 — 둘 다 annotation-select.js annotBeginLabelEdit 한 벌(1013t2C6). */
  // ── 텍스트 모드 wireup (텍스트 모드일 때만 DOM 존재) ──
  const fs  = propPanel.querySelector('#annot-font-size');
  const fsN = propPanel.querySelector('#annot-font-size-num');
  if (fs && fsN) {
    /* ★1017t1h3 — 고른 글자가 있으면 ★그 글자만, 없으면 ★예전 그대로 라벨 전체(_annotApplyToSelection 머리말). */
    fs.addEventListener('input',  () => {
      fsN.value = fs.value;
      const v = parseFloat(fs.value);
      if (_annotApplyToSelection(block, 'fontSize', v + 'px')) return;
      _writeProps(block, { labelFontSize: v });
    });
    fs.addEventListener('change', () => window.pushHistory?.('라벨 크기'));
    fsN.addEventListener('input', () => {
      const v = Math.min(48, Math.max(8, parseFloat(fsN.value) || 8));
      fs.value = v;
      if (_annotApplyToSelection(block, 'fontSize', v + 'px')) return;
      _writeProps(block, { labelFontSize: v });
    });
    fsN.addEventListener('change', () => window.pushHistory?.('라벨 크기'));
  }

  if (propPanel.querySelector('[data-color-field="annot-label-color"]') || document.getElementById('annot-label-color-hex')) {
    wireColorField('annot-label-color', {
      initialAlpha: labelColorAlpha,
      // ★1017t1h3 — 크기와 같은 규약: 고른 글자가 있으면 그 글자만.
      onApply: (c) => { if (_annotApplyToSelection(block, 'color', c)) return; _writeProps(block, { labelColor: c }); },
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

  // ★1017t1h5 — 「없음」 발견 가능성: 알파 0 이면 스와치에 swatch-none(체커)을 켠다(prop-grid.js 꼴).
  const bgSwatch = propPanel.querySelector('#annot-label-bg-color')?.closest('.prop-color-swatch');
  bgSwatch?.classList.toggle('swatch-none', labelBgAlpha === 0);
  const borderSwatch = propPanel.querySelector('#annot-label-border-color')?.closest('.prop-color-swatch');
  borderSwatch?.classList.toggle('swatch-none', labelBorderAlpha === 0);

  wireColorField('annot-label-bg', {
    initialAlpha: labelBgAlpha,
    onApply: (c) => { _writeProps(block, { labelBg: c }); bgSwatch?.classList.toggle('swatch-none', parseAlphaFromColor(c) === 0); },
    onCommit: () => window.pushHistory?.('라벨 배경'),
  });
  wireColorField('annot-label-border', {
    initialAlpha: labelBorderAlpha,
    onApply: (c) => { _writeProps(block, { labelBorderColor: c }); borderSwatch?.classList.toggle('swatch-none', parseAlphaFromColor(c) === 0); },
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

  // ★1017t1h5 — 여백(패딩). 건드려야만 CSS 기본(4px 8px)을 사방 동일 값으로 이긴다.
  const pad = propPanel.querySelector('#annot-label-pad');
  const padN = propPanel.querySelector('#annot-label-pad-num');
  if (pad && padN) {
    pad.addEventListener('input',  () => { padN.value = pad.value; _writeProps(block, { labelPad: parseFloat(pad.value) }); });
    pad.addEventListener('change', () => window.pushHistory?.('라벨 여백'));
    padN.addEventListener('change', () => {
      const v = Math.min(24, Math.max(0, parseFloat(padN.value) || 0));
      pad.value = v; _writeProps(block, { labelPad: v });
      window.pushHistory?.('라벨 여백');
    });
  }

  // ★1013t1A3 라벨 위치 — 쓰고 → 다시 그리고(패널 포함) → 찍는다(push-after · tests/unit/prop-push-after)
  const dxIn = propPanel.querySelector('#annot-label-dx');
  const dyIn = propPanel.querySelector('#annot-label-dy');
  const onOffset = () => {
    if (!window.annotSetLabelOffset?.(block, parseFloat(dxIn.value) || 0, parseFloat(dyIn.value) || 0)) return;
    showAnnotationProperties(block);
    window.pushHistory?.('라벨 위치');
  };
  dxIn?.addEventListener('change', onOffset);
  dyIn?.addEventListener('change', onOffset);
  propPanel.querySelector('#annot-label-reset')?.addEventListener('click', () => {
    if (!window.annotResetLabelOffset?.(block)) return;
    showAnnotationProperties(block);
    window.pushHistory?.('라벨 위치 되돌리기');
  });
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
function _shapeIcon(s) {
  // currentColor 사용 → .prop-align-btn.active 시 흰색으로 자연스럽게 반전
  if (s === 'square')   return `<svg width="14" height="14" viewBox="0 0 16 16"><rect x="3" y="3" width="10" height="10" fill="currentColor"/></svg>`;
  if (s === 'triangle') return `<svg width="14" height="14" viewBox="0 0 16 16"><polygon points="8,2 14,13 2,13" fill="currentColor"/></svg>`;
  if (s === 'none')     return `<svg width="14" height="14" viewBox="0 0 16 16"><line x1="3" y1="13" x2="13" y2="3" stroke="currentColor" stroke-width="1.4"/><line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" stroke-width="1.4"/></svg>`;
  if (s === 'glow')     return `<svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="currentColor" opacity="0.3"/><circle cx="8" cy="8" r="3" fill="currentColor"/></svg>`;
  if (s === 'arrowhead') return `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="4,3 12,8 4,13"/></svg>`;
  return `<svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>`;
}
