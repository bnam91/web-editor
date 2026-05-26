// ── Canvas Block ─────────────────────────────────────────────────────────────
// Figma에서 임포트한 레이어 합성 블록 (shape + image + text 절대배치 단일 컴포넌트)
// + Simple Card Mode (이미지 + 텍스트 카드 그리드)
//
// 의존성:
//   - genId, showNoSelectionHint, insertAfterSelected (drag-utils.js)
//   - bindBlock (drag-drop.js)
//   - window._insertToFlowFrame (block-factory.js 노출 헬퍼)

import { genId, showNoSelectionHint, insertAfterSelected } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';

function _appendCardTexts(container, card, titleSize, descSize, textAlign, titleColor, descColor) {
  const _tc = titleColor || '#ffffff';
  const _dc = descColor  || '#ffffff';
  if (card.title && card.title.trim() !== '') {
    const el = document.createElement('div');
    el.style.cssText = `font-size:${titleSize}px;font-weight:600;color:${_tc};text-align:${textAlign};white-space:pre-wrap;word-break:break-word;line-height:1.3;font-family:Pretendard,-apple-system,sans-serif;`;
    el.textContent = card.title;
    container.appendChild(el);
  }
  if (card.desc && card.desc.trim() !== '') {
    const el = document.createElement('div');
    el.style.cssText = `font-size:${descSize}px;font-weight:400;color:${_dc};text-align:${textAlign};white-space:pre-wrap;word-break:break-word;line-height:1.4;font-family:Pretendard,-apple-system,sans-serif;`;
    el.textContent = card.desc;
    container.appendChild(el);
  }
  if (!card.title && !card.desc) {
    const ph = document.createElement('div');
    ph.style.cssText = 'color:#bbb;font-size:13px;font-family:sans-serif;text-align:center;';
    ph.textContent = '텍스트를 입력하세요';
    container.appendChild(ph);
  }
}

// 이스터에그(아이콘 모드): 카드 이미지 자리에 iconify SVG를 중앙 렌더 (currentColor로 색 제어)
function _fillCardIcon(div, card, areaSize, opts) {
  opts = opts || {};
  div.style.display = 'flex';
  div.style.alignItems = 'center';
  div.style.justifyContent = 'center';
  div.style.background = opts.bg    || card.iconBg    || 'transparent';
  div.style.color      = opts.color || card.iconColor || '#333333';
  const scale = (opts.scale != null ? opts.scale : 46) / 100;
  const iconSize = Math.round(Math.max(12, (areaSize || 80) * scale));
  const wrap = document.createElement('div');
  wrap.style.cssText = `width:${iconSize}px;height:${iconSize}px;display:flex;align-items:center;justify-content:center;pointer-events:none;`;
  wrap.innerHTML = card.icon.svg;
  const svg = wrap.querySelector('svg');
  if (svg) {
    svg.setAttribute('width', iconSize);
    svg.setAttribute('height', iconSize);
    svg.style.display = 'block';
    svg.style.width  = iconSize + 'px';
    svg.style.height = iconSize + 'px';
  }
  div.appendChild(wrap);
}

function _bindCvbImgDrag(imgDiv, block, idx) {
  if (!imgDiv.style.position) imgDiv.style.position = 'relative';
  imgDiv.style.pointerEvents = 'auto';
  imgDiv.style.cursor = 'default';

  // 블록 선택된 상태에서 단일 클릭 → 편집 모드 진입 (블록 선택 안된 경우 버블 허용)
  imgDiv.addEventListener('click', function(e) {
    if (!block.classList.contains('selected')) return;
    e.stopPropagation();
    _enterCvbImgEditMode(imgDiv, block, idx);
  });

  // 더블클릭 → 편집 모드 진입 (블록 선택 여부 무관)
  imgDiv.addEventListener('dblclick', function(e) {
    e.stopPropagation();
    e.preventDefault();
    _enterCvbImgEditMode(imgDiv, block, idx);
  });
}

function _enterCvbImgEditMode(imgDiv, block, idx) {
  if (imgDiv._cvbEditing) return;
  imgDiv._cvbEditing = true;

  imgDiv.style.cursor = 'grab';
  imgDiv.style.outline = '2px solid var(--color-handle, #1592fe)';
  imgDiv.style.outlineOffset = '-2px';

  const hint = document.createElement('div');
  hint.style.cssText = 'position:absolute;bottom:6px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.65);color:#fff;font-size:10px;padding:3px 10px;border-radius:4px;pointer-events:none;white-space:nowrap;z-index:10;';
  hint.textContent = '드래그로 이미지 이동 · ESC 종료';
  imgDiv.appendChild(hint);

  const exitMode = () => {
    if (!imgDiv._cvbEditing) return;
    imgDiv._cvbEditing = false;
    imgDiv.style.cursor = 'default';
    imgDiv.style.outline = '';
    hint.remove();
    document.removeEventListener('keydown', onKey);
    imgDiv.removeEventListener('mousedown', onDragStart);
  };

  const onKey = (e) => { if (e.key === 'Escape') exitMode(); };
  document.addEventListener('keydown', onKey);

  const onDragStart = (e) => {
    e.stopPropagation();
    e.preventDefault();

    const cards = JSON.parse(block.dataset.cards || '[]');
    const c = cards[idx] || {};
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startImgX = c.imgX ?? 50;
    const startImgY = c.imgY ?? 50;
    let curX = startImgX;
    let curY = startImgY;

    imgDiv.style.cursor = 'grabbing';

    const onMove = (me) => {
      const scale = block._cvbScale || 1;
      curX = Math.max(0, Math.min(100, startImgX - (me.clientX - startMouseX) / scale * 0.1));
      curY = Math.max(0, Math.min(100, startImgY - (me.clientY - startMouseY) / scale * 0.1));
      imgDiv.style.backgroundPosition = `${curX}% ${curY}%`;
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      imgDiv.style.cursor = 'grab';
      const arr = JSON.parse(block.dataset.cards || '[]');
      if (arr[idx]) {
        arr[idx].imgX = Math.round(curX * 10) / 10;
        arr[idx].imgY = Math.round(curY * 10) / 10;
        block.dataset.cards = JSON.stringify(arr);
        window.pushHistory?.();
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  imgDiv.addEventListener('mousedown', onDragStart);
}

function renderCanvas(block) {
  const layers   = JSON.parse(block.dataset.layers || '[]');
  const designW  = parseInt(block.dataset.canvasW) || 360;
  const designH  = parseInt(block.dataset.canvasH) || 400;
  const bg       = block.dataset.bg || 'transparent';
  const radius   = parseInt(block.dataset.radius) || 0;
  const gridCols = parseInt(block.dataset.gridCols) || 1;
  const gridRows = parseInt(block.dataset.gridRows) || 1;
  const GAP      = parseInt(block.dataset.cardGap ?? '12'); // 카드 사이 간격

  // ── Simple Card Mode ──────────────────────────────────────────────────────
  if (block.dataset.cardMode === 'simple') {
    const imgRatio   = Math.min(90, Math.max(10, parseInt(block.dataset.imgRatio) ?? 76));
    const imgShape   = block.dataset.imgShape || 'rect'; // 'rect' | 'circle'
    const labelPos   = block.dataset.labelPos || 'bottom'; // 'top' | 'bottom' | 'both'
    const textHide   = block.dataset.textHide === 'true';
    const textBg     = block.dataset.textBg    || '#f5f5f5';
    const titleSize  = parseInt(block.dataset.titleSize) || 20;
    const descSize   = parseInt(block.dataset.descSize)  || 14;
    const textAlign  = block.dataset.textAlign || 'left';
    const titleColor = block.dataset.titleColor || '#ffffff';
    const descColor  = block.dataset.descColor  || '#ffffff';
    // 아이콘 모드(이스터에그) 블록 레벨 설정 — 크기(%)·색·이미지 배경
    const iconScale  = Math.min(90, Math.max(10, parseInt(block.dataset.iconScale) || 46));
    const iconColor  = block.dataset.iconColor || '#333333';
    const iconBg     = block.dataset.iconBg    || 'transparent';
    const _iconOpts  = { scale: iconScale, color: iconColor, bg: iconBg };
    const cards     = JSON.parse(block.dataset.cards    || '[]');

    const totalW = designW * gridCols + GAP * (gridCols - 1);
    const totalH = designH * gridRows + GAP * (gridRows - 1);

    if (gridCols === 1) {
      block.style.width    = designW + 'px';
      block.style.maxWidth = '';
      block.style.minWidth = '';
    } else {
      block.style.width    = '100%';
      block.style.maxWidth = '';
      block.style.minWidth = '0';
    }
    const padX = parseInt(block.dataset.padX ?? '0');

    block.style.minHeight     = '';
    block.style.aspectRatio   = '';
    block.style.background    = 'transparent';
    block.style.borderRadius  = '0';
    block.style.position      = 'relative';
    block.style.overflow      = 'hidden';
    block.style.paddingLeft   = '';
    block.style.paddingRight  = '';
    block.style.boxSizing     = '';

    let inner = block.querySelector('.cvb-inner');
    if (!inner) { inner = document.createElement('div'); inner.className = 'cvb-inner'; block.appendChild(inner); }
    inner.innerHTML = '';
    // right/bottom:auto to override CSS class inset:0
    inner.style.cssText = `position:absolute;top:0;left:${padX}px;right:auto;bottom:auto;width:${totalW}px;height:${totalH}px;transform-origin:top left;pointer-events:none;overflow:visible;`;

    const applyScale = () => {
      const aw = block.offsetWidth;
      if (aw <= 0) return;
      const availW = Math.max(1, aw - 2 * padX);
      const scale = availW / totalW;
      inner.style.transform = `scale(${scale})`;
      block.style.height = (totalH * scale) + 'px';
      block._cvbScale = scale;
    };
    applyScale();
    if (block._cvbRO) block._cvbRO.disconnect();
    block._cvbRO = new ResizeObserver(applyScale);
    block._cvbRO.observe(block);

    const orient = block.dataset.cardOrient || 'portrait'; // 'portrait' | 'landscape'

    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const idx    = r * gridCols + c;
        const card   = cards[idx] || {};
        const cellX  = c * (designW + GAP);
        const cellY  = r * (designH + GAP);
        const cardBg = card.cellBg || textBg;
        // desc 비었으면 title 세로 중앙 정렬 (공백만 있어도 비었다고 판단)
        const descEmpty = !card.desc || card.desc.trim() === '';
        const justifyMode = descEmpty ? 'center' : 'flex-start';

        const cell = document.createElement('div');
        const borderW = card.borderWidth > 0 ? parseInt(card.borderWidth) : 0;
        cell.style.cssText = `position:absolute;left:${cellX}px;top:${cellY}px;width:${designW}px;height:${designH}px;border-radius:${radius}px;overflow:hidden;`;

        if (orient === 'landscape') {
          // ── 가로 모드: 이미지 좌 / 텍스트 우 ────────────────────────────
          const imgW  = textHide ? designW : Math.round(designW * imgRatio / 100);
          const textW = designW - imgW;

          const imgDiv = document.createElement('div');
          imgDiv.style.cssText = `position:absolute;left:0;top:0;width:${imgW}px;height:${designH}px;overflow:hidden;flex-shrink:0;`;
          if (card.icon && card.icon.svg) {
            _fillCardIcon(imgDiv, card, Math.min(imgW, designH), _iconOpts);
          } else if (card.imgSrc) {
            imgDiv.style.backgroundImage    = `url("${card.imgSrc}")`;
            imgDiv.style.backgroundSize     = card.imgFit === 'contain' ? 'contain' : 'cover';
            imgDiv.style.backgroundPosition = `${card.imgX ?? 50}% ${card.imgY ?? 50}%`;
            imgDiv.style.backgroundRepeat   = 'no-repeat';
            _bindCvbImgDrag(imgDiv, block, idx);
          } else {
            imgDiv.style.background = 'rgba(0,0,0,0.06)';
            imgDiv.style.display = 'flex'; imgDiv.style.alignItems = 'center'; imgDiv.style.justifyContent = 'center';
            const ph = document.createElement('span');
            ph.style.cssText = 'color:rgba(0,0,0,0.2);font-size:28px;font-family:sans-serif;pointer-events:none;font-weight:200;';
            ph.textContent = '+'; imgDiv.appendChild(ph);
          }
          cell.appendChild(imgDiv);

          if (!textHide) {
            const textDiv = document.createElement('div');
            textDiv.style.cssText = `position:absolute;left:${imgW}px;top:0;width:${textW}px;height:${designH}px;background:${cardBg};box-sizing:border-box;padding:14px 16px;display:flex;flex-direction:column;justify-content:${justifyMode};gap:6px;`;
            _appendCardTexts(textDiv, card, titleSize, descSize, textAlign, titleColor, descColor);
            cell.appendChild(textDiv);
          }

        } else {
          // ── 세로 모드(기본): 이미지 상 / 텍스트 하 ──────────────────────
          // labelPos: 'top' | 'bottom'(default) | 'both' — both는 같은 텍스트를 위·아래 동일 표시
          const imgH  = textHide ? designH : Math.round(designH * imgRatio / 100);
          const textTotalH = designH - imgH;
          const textH = labelPos === 'both' ? Math.floor(textTotalH / 2) : textTotalH;

          const makeImgDiv = () => {
            const div = document.createElement('div');
            if (imgShape === 'circle') {
              const side = Math.min(designW, imgH);
              const topMargin = Math.max(0, Math.round((imgH - side) / 2));
              div.style.cssText = `width:${side}px;height:${side}px;margin:${topMargin}px auto 0;overflow:hidden;border-radius:50%;flex-shrink:0;`;
            } else {
              div.style.cssText = `width:100%;height:${imgH}px;overflow:hidden;box-sizing:border-box;flex-shrink:0;`;
            }
            if (card.icon && card.icon.svg) {
              _fillCardIcon(div, card, Math.min(designW, imgH), _iconOpts);
            } else if (card.imgSrc) {
              div.style.backgroundImage    = `url("${card.imgSrc}")`;
              div.style.backgroundSize     = card.imgFit === 'contain' ? 'contain' : 'cover';
              div.style.backgroundPosition = `${card.imgX ?? 50}% ${card.imgY ?? 50}%`;
              div.style.backgroundRepeat   = 'no-repeat';
              _bindCvbImgDrag(div, block, idx);
            } else {
              div.style.background = 'rgba(0,0,0,0.06)';
              div.style.display = 'flex'; div.style.alignItems = 'center'; div.style.justifyContent = 'center';
              const ph = document.createElement('span');
              ph.style.cssText = 'color:rgba(0,0,0,0.2);font-size:28px;font-family:sans-serif;pointer-events:none;font-weight:200;';
              ph.textContent = '+'; div.appendChild(ph);
            }
            return div;
          };
          const makeTextDiv = (h, position) => {
            // position: 'top' | 'bottom' | 'middle' — 모서리 radius 적용 결정
            const div = document.createElement('div');
            const rTop    = (position === 'top'    || position === 'middle') ? `${radius}px ${radius}px 0 0` : '0';
            const rBottom = (position === 'bottom' || position === 'middle') ? `0 0 ${radius}px ${radius}px` : '0';
            const br = position === 'top'    ? `${radius}px ${radius}px 0 0`
                     : position === 'bottom' ? `0 0 ${radius}px ${radius}px`
                     : '0';
            div.style.cssText = `width:100%;height:${h}px;background:${cardBg};box-sizing:border-box;padding:10px 14px;display:flex;flex-direction:column;justify-content:${justifyMode};gap:4px;border-radius:${br};`;
            _appendCardTexts(div, card, titleSize, descSize, textAlign, titleColor, descColor);
            return div;
          };

          if (labelPos === 'top') {
            if (!textHide) cell.appendChild(makeTextDiv(textH, 'top'));
            cell.appendChild(makeImgDiv());
          } else if (labelPos === 'both') {
            if (!textHide) cell.appendChild(makeTextDiv(textH, 'top'));
            cell.appendChild(makeImgDiv());
            if (!textHide) cell.appendChild(makeTextDiv(textH, 'bottom'));
          } else {
            // bottom (기본)
            cell.appendChild(makeImgDiv());
            if (!textHide) cell.appendChild(makeTextDiv(textH, 'bottom'));
          }
        }

        // 테두리 오버레이: 자식 위에 inset box-shadow 표시 (자식들이 cell 전체를 덮으므로 overlay 필요)
        if (borderW > 0 && card.borderColor) {
          const borderOverlay = document.createElement('div');
          borderOverlay.style.cssText = `position:absolute;inset:0;box-shadow:inset 0 0 0 ${borderW}px ${card.borderColor};border-radius:${radius}px;pointer-events:none;z-index:10;`;
          cell.appendChild(borderOverlay);
        }

        inner.appendChild(cell);
      }
    }
    return;
  }
  // ── End Simple Card Mode ───────────────────────────────────────────────────

  const totalW = designW * gridCols + GAP * (gridCols - 1);
  const totalH = designH * gridRows + GAP * (gridRows - 1);

  // block: gridCols===1이면 고정 너비, 2+이면 섹션 너비에 맞춤
  if (gridCols === 1) {
    block.style.width    = designW + 'px';
    block.style.maxWidth = '';
    block.style.minWidth = '';
  } else {
    block.style.width    = '100%';
    block.style.maxWidth = '';
    block.style.minWidth = '0';
  }
  block.style.height       = '';
  block.style.minHeight    = '';
  block.style.aspectRatio  = `${totalW} / ${totalH}`;
  block.style.background   = 'transparent'; // 개별 셀이 배경 가짐
  block.style.borderRadius = '0';
  block.style.position     = 'relative';
  block.style.overflow     = 'hidden';
  const padX = parseInt(block.dataset.padX ?? '0');
  block.style.paddingLeft  = '';
  block.style.paddingRight = '';
  block.style.boxSizing    = '';

  // cvb-inner: 디자인 좌표계 전체 크기
  let inner = block.querySelector('.cvb-inner');
  if (!inner) { inner = document.createElement('div'); inner.className = 'cvb-inner'; block.appendChild(inner); }
  inner.innerHTML = '';
  inner.style.cssText = `position:absolute;top:0;left:${padX}px;right:auto;bottom:auto;width:${totalW}px;height:${totalH}px;transform-origin:top left;pointer-events:none;overflow:visible;`;

  // scale 갱신 함수
  const applyScale = () => {
    const aw = block.offsetWidth;
    if (aw <= 0) return;
    const availW = Math.max(1, aw - 2 * padX);
    inner.style.transform = `scale(${availW / totalW})`;
  };
  applyScale();

  // ResizeObserver 로 동적 갱신
  if (block._cvbRO) block._cvbRO.disconnect();
  block._cvbRO = new ResizeObserver(applyScale);
  block._cvbRO.observe(block);

  // 빈 레이어 — 플레이스홀더 (그리드 셀 단위로)
  if (layers.length === 0) {
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const cellX = c * (designW + GAP);
        const cellY = r * (designH + GAP);
        const ph = document.createElement('div');
        ph.style.cssText = `position:absolute;left:${cellX}px;top:${cellY}px;width:${designW}px;height:${designH}px;display:flex;align-items:center;justify-content:center;border:2px dashed #ccc;border-radius:${radius}px;color:#bbb;font-size:13px;font-family:sans-serif;`;
        ph.textContent = 'Card Block';
        inner.appendChild(ph);
      }
    }
    return;
  }

  // 각 그리드 셀에 레이어 렌더링
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const cellX = c * (designW + GAP);
      const cellY = r * (designH + GAP);

      // 셀 컨테이너 (배경, 반경)
      const cell = document.createElement('div');
      cell.style.cssText = `position:absolute;left:${cellX}px;top:${cellY}px;width:${designW}px;height:${designH}px;background:${bg};border-radius:${radius}px;overflow:hidden;`;
      inner.appendChild(cell);

      // 레이어 렌더링
      layers.forEach((layer, layerIndex) => {
        const el = document.createElement('div');
        el.style.cssText = `position:absolute;left:${layer.x}px;top:${layer.y}px;width:${layer.w}px;height:${layer.h}px;`;

        if (layer.type === 'shape') {
          el.style.background   = layer.color || '#cccccc';
          el.style.borderRadius = (layer.radius || 0) + 'px';

        } else if (layer.type === 'image') {
          el.style.background   = 'repeating-conic-gradient(#d8d8d8 0% 25%, #f0f0f0 0% 50%) 0 0 / 72px 72px';
          el.style.borderRadius = (layer.radius || 0) + 'px';
          if (layer.src) {
            el.style.backgroundImage    = `url("${layer.src}")`;
            el.style.backgroundSize     = 'cover';
            el.style.backgroundPosition = 'center';
            el.style.backgroundRepeat   = 'no-repeat';
          }

        } else if (layer.type === 'text') {
          el.style.color         = layer.color || '#000000';
          el.style.fontSize      = (layer.fontSize || 16) + 'px';
          el.style.fontFamily    = 'Pretendard, -apple-system, sans-serif';
          el.style.fontWeight    = layer.fontWeight || '400';
          el.style.textAlign     = layer.align || 'left';
          el.style.whiteSpace    = 'pre-wrap';
          el.style.lineHeight    = '1.35';
          el.style.wordBreak     = 'break-word';
          el.style.pointerEvents = 'auto';
          el.style.overflow      = 'visible';
          el.style.cursor        = 'default';
          el.textContent         = layer.content || '';

          // 더블클릭 텍스트 편집 (첫 번째 셀만 편집 가능, 나머지는 동기화)
          if (r === 0 && c === 0) {
            el.addEventListener('dblclick', e => {
              e.stopPropagation();
              el.contentEditable = 'true';
              el.focus();
              const range = document.createRange();
              range.selectNodeContents(el);
              range.collapse(false);
              const sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(range);
              el.style.outline    = '1.5px dashed #1592fe';
              el.style.background = 'rgba(255,255,255,0.15)';
              el.style.cursor     = 'text';
              block.dataset.editing = 'true';
            });
            el.addEventListener('blur', () => {
              el.contentEditable = 'false';
              el.style.outline    = '';
              el.style.background = '';
              el.style.cursor     = 'default';
              delete block.dataset.editing;
              const curLayers = JSON.parse(block.dataset.layers || '[]');
              if (curLayers[layerIndex]) {
                curLayers[layerIndex].content = el.innerText;
                block.dataset.layers = JSON.stringify(curLayers);
                window.pushHistory?.();
                window.scheduleAutoSave?.();
                if (block.classList.contains('selected')) window.showCanvasProperties?.(block);
              }
            });
            el.addEventListener('keydown', e => {
              if (e.key === 'Escape') { el.innerText = layer.content || ''; el.blur(); }
            });
          }
          el.addEventListener('mousedown', e => e.stopPropagation());
          el.addEventListener('click',     e => e.stopPropagation());
        }

        cell.appendChild(el);
      });
    }
  }
}

function makeCanvasBlock(data = {}) {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

  const block = document.createElement('div');
  block.className = 'canvas-block'; block.dataset.type = 'canvas';
  block.id = genId('cvb');
  block.dataset.canvasW   = data.width    || 360;
  block.dataset.canvasH   = data.height   || 400;
  block.dataset.bg        = data.bg       || 'transparent';
  block.dataset.radius    = data.radius   || 0;
  block.dataset.layers    = JSON.stringify(data.layers || []);
  block.dataset.layerName = data.layerName || 'Card';
  block.dataset.gridCols  = data.gridCols || 1;
  block.dataset.gridRows  = data.gridRows || 1;
  block.dataset.cardGap   = data.cardGap ?? 12;
  block.dataset.padX      = data.padX ?? 0;
  if (data.cardMode) {
    block.dataset.cardMode  = data.cardMode;
    block.dataset.imgRatio  = data.imgRatio  ?? 76;
    block.dataset.textBg    = data.textBg    || '#f5f5f5';
    block.dataset.titleSize = data.titleSize || 20;
    block.dataset.descSize  = data.descSize  || 14;
    block.dataset.textAlign = data.textAlign || 'left';
    block.dataset.cards     = JSON.stringify(data.cards || [{ title: '카드 제목', desc: '', imgSrc: '', cellBg: '' }]);
  }

  const gridCols = parseInt(block.dataset.gridCols) || 1;
  const gridRows = parseInt(block.dataset.gridRows) || 1;
  const GAP      = parseInt(block.dataset.cardGap ?? '12');
  const totalW   = (data.width || 360) * gridCols + GAP * (gridCols - 1);
  // 단독(stack) row일 때 너비를 전체 그리드 너비로 고정 (flex:1 환경에선 무시됨)
  block.style.width = totalW + 'px';

  renderCanvas(block);

  row.appendChild(block);
  return { row, block };
}

const CARD_DEFAULT_OPTS = {
  width: 360, height: 480,
  bg: 'transparent', radius: 12,
  cardMode: 'simple',
  imgRatio: 76,
  textBg: '#a2abb8',
  titleSize: 40,
  descSize: 22,
  textAlign: 'center',
  layerName: 'Card',
  layers: [],
  gridCols: 1, gridRows: 1, cardGap: 12, padX: 0,
  cards: [{ title: '카드 제목', desc: '', imgSrc: '', cellBg: '' }],
};

function addCanvasBlock(opts = {}) {
  // 옵션 없이 호출 시 (플로팅 패널 Card 버튼) → 기본 심플 카드 템플릿 사용
  if (!opts.cardMode && !opts.layers?.length) {
    opts = { ...CARD_DEFAULT_OPTS, ...opts };
  }
  if (window._insertToFlowFrame?.(() => {
    const { row, block } = makeCanvasBlock(opts);
    return { row, block };
  })) return;
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeCanvasBlock(opts);
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
}

// ── window 노출 ────────────────────────────────────────────────────────────
window.makeCanvasBlock  = makeCanvasBlock;
window.addCanvasBlock   = addCanvasBlock;
window.renderCanvas     = renderCanvas;

export { makeCanvasBlock, addCanvasBlock, renderCanvas, CARD_DEFAULT_OPTS };
