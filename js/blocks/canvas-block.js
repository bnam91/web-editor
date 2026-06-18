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

// slot: null | 'top' | 'bottom' — labelPos='both'일 때 상/하단 라벨이 서로 다른 내용·색을 갖도록 분리.
//   - slot==='top'    → card.titleTop/descTop (없으면 card.title/desc fallback), 색은 titleColorTop/descColorTop (없으면 블록색)
//   - slot==='bottom' → card.titleBottom/descBottom (없으면 card.title/desc fallback), 색은 titleColorBottom/descColorBottom
//   - slot===null     → 기존 단일 슬롯 (card.title/desc)
// dataset.field/slot은 인라인 편집(_bindCvbDblEdit) 라우팅에 사용.
function _appendCardTexts(container, card, titleSize, descSize, textAlign, titleColor, descColor, cardIdx, slot) {
  let titleField = 'title', descField = 'desc';
  let titleText = card.title, descText = card.desc;
  let _tc = titleColor, _dc = descColor;
  if (slot === 'top') {
    titleField = 'titleTop'; descField = 'descTop';
    titleText = (card.titleTop !== undefined && card.titleTop !== null) ? card.titleTop : card.title;
    descText  = (card.descTop  !== undefined && card.descTop  !== null) ? card.descTop  : card.desc;
    if (card.titleColorTop) _tc = card.titleColorTop;
    if (card.descColorTop)  _dc = card.descColorTop;
  } else if (slot === 'bottom') {
    titleField = 'titleBottom'; descField = 'descBottom';
    titleText = (card.titleBottom !== undefined && card.titleBottom !== null) ? card.titleBottom : card.title;
    descText  = (card.descBottom  !== undefined && card.descBottom  !== null) ? card.descBottom  : card.desc;
    if (card.titleColorBottom) _tc = card.titleColorBottom;
    if (card.descColorBottom)  _dc = card.descColorBottom;
  }
  _tc = _tc || '#ffffff';
  _dc = _dc || '#ffffff';
  if (titleText && titleText.trim() !== '') {
    const el = document.createElement('div');
    el.className = 'cvb-card-title';
    if (cardIdx != null) { el.dataset.cardIdx = cardIdx; el.dataset.field = titleField; if (slot) el.dataset.slot = slot; }
    el.style.cssText = `font-size:${titleSize}px;font-weight:600;color:${_tc};text-align:${textAlign};white-space:pre-wrap;word-break:break-word;line-height:1.3;font-family:Pretendard,-apple-system,sans-serif;`;
    el.textContent = titleText;
    container.appendChild(el);
  }
  if (descText && descText.trim() !== '') {
    const el = document.createElement('div');
    el.className = 'cvb-card-desc';
    if (cardIdx != null) { el.dataset.cardIdx = cardIdx; el.dataset.field = descField; if (slot) el.dataset.slot = slot; }
    el.style.cssText = `font-size:${descSize}px;font-weight:400;color:${_dc};text-align:${textAlign};white-space:pre-wrap;word-break:break-word;line-height:1.4;font-family:Pretendard,-apple-system,sans-serif;`;
    el.textContent = descText;
    container.appendChild(el);
  }
  if ((!titleText || titleText.trim() === '') && (!descText || descText.trim() === '')) {
    const ph = document.createElement('div');
    ph.style.cssText = 'color:#bbb;font-size:13px;font-family:sans-serif;text-align:center;';
    ph.textContent = '텍스트를 입력하세요';
    container.appendChild(ph);
  }
}

// 카드 이미지 zoom(배율) → backgroundSize 계산.
//   - scale<=1(미설정/100): 기존 그대로 cover|contain (회귀 없음)
//   - scale>1: contain은 비율 유지하며 (`contain` 기준 × scale 불가하므로) cover처럼 `${100*scale}% auto` 대신
//     가로/세로 모두 키우는 `${100*scale}%`(cover 근사) 사용. backgroundPosition(imgX/imgY)과 병행 동작.
function _cvbBackgroundSize(card) {
  const scale = Math.max(1, (Number(card.imgScale) || 100) / 100);
  if (scale <= 1) return card.imgFit === 'contain' ? 'contain' : 'cover';
  // cover를 기준으로 확대: backgroundSize 퍼센트는 가로 기준이라 cover와 정확히 같진 않지만
  // 일반 가로>세로 카드에서 자연스러운 확대. contain도 확대 시 cover-like로 통일.
  return `${Math.round(100 * scale)}%`;
}

// 라벨 배경 그라데이션 재조립 — dataset.gradDir/gradStopPos/gradOpacity → linear-gradient 문자열.
//   - dir==null(또는 NaN): 단색 rgba(0,0,0,op) 반환 (방향 없는 반투명 검정)
//   - 그 외: linear-gradient(${dir}deg, transparent ${stop}%, rgba(0,0,0,${op/100}))
// stop/op는 0~100 클램프. prop 패널·updateCanvasBlock(MCP) 양쪽이 공유.
function _cvbBuildGrad(dir, stop, op) {
  const o = Math.min(100, Math.max(0, Number(op) || 0)) / 100;
  const s = Math.min(100, Math.max(0, Number(stop) || 0));
  const alpha = Math.round(o * 100) / 100;
  if (dir === null || dir === undefined || isNaN(Number(dir))) {
    return `rgba(0,0,0,${alpha})`;
  }
  return `linear-gradient(${Number(dir)}deg, transparent ${s}%, rgba(0,0,0,${alpha}))`;
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

// 카드 제목/설명 더블클릭 인라인 편집 — block 자체에 한 번만 등록
function _bindCvbDblEdit(block) {
  if (block._cvbDblBound) return;
  block._cvbDblBound = true;
  block.addEventListener('dblclick', (e) => {
    const target = e.target.closest('.cvb-card-title, .cvb-card-desc');
    if (!target || !block.contains(target)) return;
    e.stopPropagation();
    target.contentEditable = 'true';
    target.style.outline = '2px dashed var(--ui-accent-primary, #3b82f6)';
    target.style.outlineOffset = '2px';
    target.focus();
    const range = document.createRange();
    range.selectNodeContents(target);
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(range);
  });
  block.addEventListener('blur', (e) => {
    const target = e.target?.closest?.('.cvb-card-title, .cvb-card-desc');
    if (!target || target.contentEditable !== 'true') return;
    target.contentEditable = 'false';
    target.style.outline = ''; target.style.outlineOffset = '';
    const idx = parseInt(target.dataset.cardIdx);
    const field = target.dataset.field;
    if (!Number.isFinite(idx) || !field) return;
    const cards = JSON.parse(block.dataset.cards || '[]');
    if (!cards[idx]) cards[idx] = {};
    cards[idx][field] = target.innerText.trim();
    block.dataset.cards = JSON.stringify(cards);
    window.pushHistory?.('카드 편집');
    window.scheduleAutoSave?.();
    if (block.classList.contains('selected') && window.showSimpleCardProperties) window.showSimpleCardProperties(block);
  }, true);
  block.addEventListener('keydown', (e) => {
    const target = e.target?.closest?.('.cvb-card-title, .cvb-card-desc');
    if (!target || target.contentEditable !== 'true') return;
    if (e.key === 'Escape') { e.preventDefault(); target.blur(); }
    else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); target.blur(); }
  });
}

// 카드 이미지 영역 더블클릭 → 파일 피커로 card.imgSrc 추가/교체
// (image-handling.js:506 triggerAssetUpload + loadImageToAsset FileReader 미러)
function _triggerCvbCardImage(block, idx) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = e => {
    const file = e.target.files && e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) { alert('이미지 파일은 10MB 이하만 업로드할 수 있습니다.'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const cards = JSON.parse(block.dataset.cards || '[]');
      if (!cards[idx]) cards[idx] = {};
      cards[idx].imgSrc = ev.target.result;
      if (!cards[idx].imgFit) cards[idx].imgFit = 'cover';
      block.dataset.cards = JSON.stringify(cards);
      window.renderCanvas?.(block);
      window.pushHistory?.('카드 이미지');
      window.scheduleAutoSave?.();
      if (block.classList.contains('selected') && window.showSimpleCardProperties) window.showSimpleCardProperties(block);
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

// 이미지 없는 placeholder 영역에도 더블클릭=이미지 추가 배선
function _bindCvbImgPlaceholder(div, block, idx) {
  div.style.cursor = 'pointer';
  div.style.pointerEvents = 'auto';
  div.title = '더블클릭하여 이미지 추가';
  div.addEventListener('dblclick', e => {
    e.stopPropagation();
    e.preventDefault();
    _triggerCvbCardImage(block, idx);
  });
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

  // 더블클릭 → 이미지 추가/교체 (위치드래그 편집모드는 단일클릭 경로로 유지)
  imgDiv.addEventListener('dblclick', function(e) {
    e.stopPropagation();
    e.preventDefault();
    _triggerCvbCardImage(block, idx);
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

// full-bleed: 카드가 속한 섹션의 effective 좌우패딩(px) 해석.
//   - closest('.section-inner')의 dataset.paddingX override가 있으면 그 값
//   - 없으면 window.state?.pageSettings?.padX (프로젝트 globals state)
//   - section-inner 없거나(프레임 free-layout 등) full-bleed 무의미하면 0
// 에셋블럭 패턴(prop-asset.js:217-221) 미러. free-layout 프레임 내부 카드는 절대좌표라 제외.
function _effSectionPadX(block) {
  // free-layout 프레임 내부 카드는 absolute 배치 → full-bleed 무의미 (에셋 applyExcludePadX 가드 미러)
  if (block.closest?.('.frame-block[data-free-layout="true"]')) return 0;
  const inner = block.closest?.('.section-inner');
  if (!inner) return 0;
  const hasOverride = inner.dataset.paddingX !== '' && inner.dataset.paddingX !== undefined;
  if (hasOverride) return parseInt(inner.dataset.paddingX) || 0;
  return window.state?.pageSettings?.padX || 0;
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
    // 텍스트 세로위치(px) — 기존 padding 위에 가산. 0이면 회귀 없음(하위호환).
    const textVOffset = Math.min(100, Math.max(0, parseInt(block.dataset.textVOffset) || 0));
    // 아이콘 모드(이스터에그) 블록 레벨 설정 — 크기(%)·색·이미지 배경
    const iconScale  = Math.min(90, Math.max(10, parseInt(block.dataset.iconScale) || 46));
    const iconColor  = block.dataset.iconColor || '#333333';
    // 아이콘 모드면 이미지 배경 기본값을 연회색으로 → circle/rect가 바로 보임(reference 스타일).
    // 투명을 원하면 패널에서 명시적으로 transparent 지정(그땐 dataset.iconBg='transparent'라 이 기본값 무시).
    const iconBg     = block.dataset.iconBg    || (block.dataset.iconMode === 'true' ? '#eeeeee' : 'transparent');
    const _iconOpts  = { scale: iconScale, color: iconColor, bg: iconBg };
    const cards     = JSON.parse(block.dataset.cards    || '[]');

    const totalW = designW * gridCols + GAP * (gridCols - 1);
    const totalH = designH * gridRows + GAP * (gridRows - 1);

    // full-bleed: 섹션 좌우패딩 무시 — 음수마진 + calc 확장폭으로 섹션 가장자리까지 확장.
    // 에셋과 달리 카드는 renderCanvas가 매 렌더 width를 덮으므로 여기서 통합 처리.
    const _fb    = block.dataset.fullBleed === 'true';
    const _secPX = _fb ? _effSectionPadX(block) : 0;
    if (_fb && _secPX > 0) {
      block.style.width      = `calc(100% + ${_secPX * 2}px)`;
      block.style.maxWidth   = '';
      block.style.minWidth   = '0';
      block.style.marginLeft  = -_secPX + 'px';
      block.style.marginRight = -_secPX + 'px';
    } else {
      block.style.marginLeft  = '';
      block.style.marginRight = '';
      if (gridCols === 1) {
        block.style.width    = designW + 'px';
        block.style.maxWidth = '';
        block.style.minWidth = '';
      } else {
        block.style.width    = '100%';
        block.style.maxWidth = '';
        block.style.minWidth = '0';
      }
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
          if (imgShape === 'circle') {
            // 가로 모드 원형 — 이미지 영역 안에 중앙 정렬된 정사각 원 (portrait와 동일 규칙)
            const side = Math.min(imgW, designH);
            const ml = Math.max(0, Math.round((imgW - side) / 2));
            const mt = Math.max(0, Math.round((designH - side) / 2));
            imgDiv.style.cssText = `position:absolute;left:${ml}px;top:${mt}px;width:${side}px;height:${side}px;overflow:hidden;border-radius:50%;flex-shrink:0;`;
          } else {
            imgDiv.style.cssText = `position:absolute;left:0;top:0;width:${imgW}px;height:${designH}px;overflow:hidden;flex-shrink:0;`;
          }
          if (card.icon && card.icon.svg) {
            _fillCardIcon(imgDiv, card, Math.min(imgW, designH), _iconOpts);
          } else if (card.imgSrc) {
            imgDiv.style.backgroundImage    = `url("${card.imgSrc}")`;
            imgDiv.style.backgroundSize     = _cvbBackgroundSize(card);
            imgDiv.style.backgroundPosition = `${card.imgX ?? 50}% ${card.imgY ?? 50}%`;
            imgDiv.style.backgroundRepeat   = 'no-repeat';
            _bindCvbImgDrag(imgDiv, block, idx);
          } else {
            imgDiv.style.background = 'rgba(0,0,0,0.06)';
            imgDiv.style.display = 'flex'; imgDiv.style.alignItems = 'center'; imgDiv.style.justifyContent = 'center';
            const ph = document.createElement('span');
            ph.style.cssText = 'color:rgba(0,0,0,0.2);font-size:28px;font-family:sans-serif;pointer-events:none;font-weight:200;';
            ph.textContent = '+'; imgDiv.appendChild(ph);
            _bindCvbImgPlaceholder(imgDiv, block, idx);
          }
          cell.appendChild(imgDiv);

          if (!textHide) {
            const textDiv = document.createElement('div');
            textDiv.style.cssText = `position:absolute;left:${imgW}px;top:0;width:${textW}px;height:${designH}px;background:${cardBg};box-sizing:border-box;padding:14px 16px;display:flex;flex-direction:column;justify-content:${justifyMode};gap:6px;`;
            if (textVOffset) textDiv.style.paddingTop = Math.min(14 + textVOffset, Math.max(14, designH - 30)) + 'px';
            _appendCardTexts(textDiv, card, titleSize, descSize, textAlign, titleColor, descColor, idx);
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
              div.style.backgroundSize     = _cvbBackgroundSize(card);
              div.style.backgroundPosition = `${card.imgX ?? 50}% ${card.imgY ?? 50}%`;
              div.style.backgroundRepeat   = 'no-repeat';
              _bindCvbImgDrag(div, block, idx);
            } else {
              div.style.background = 'rgba(0,0,0,0.06)';
              div.style.display = 'flex'; div.style.alignItems = 'center'; div.style.justifyContent = 'center';
              const ph = document.createElement('span');
              ph.style.cssText = 'color:rgba(0,0,0,0.2);font-size:28px;font-family:sans-serif;pointer-events:none;font-weight:200;';
              ph.textContent = '+'; div.appendChild(ph);
              _bindCvbImgPlaceholder(div, block, idx);
            }
            return div;
          };
          // slot: null | 'top' | 'bottom' — both 모드에서만 상/하단 분리 슬롯 사용
          const makeTextDiv = (h, position, slot) => {
            // position: 'top' | 'bottom' | 'middle' — 모서리 radius 적용 결정
            const div = document.createElement('div');
            const rTop    = (position === 'top'    || position === 'middle') ? `${radius}px ${radius}px 0 0` : '0';
            const rBottom = (position === 'bottom' || position === 'middle') ? `0 0 ${radius}px ${radius}px` : '0';
            const br = position === 'top'    ? `${radius}px ${radius}px 0 0`
                     : position === 'bottom' ? `0 0 ${radius}px ${radius}px`
                     : '0';
            // 상단 라벨 배경 오버라이드: dataset.textBgTop 있으면 top 슬롯만 그 색 사용(없으면 기존 cardBg)
            const _topBg = block.dataset.textBgTop;
            const slotBg = (slot === 'top' && _topBg) ? _topBg : cardBg;
            div.style.cssText = `width:100%;height:${h}px;background:${slotBg};box-sizing:border-box;padding:10px 14px;display:flex;flex-direction:column;justify-content:${justifyMode};gap:4px;border-radius:${br};`;
            if (textVOffset) div.style.paddingTop = Math.min(10 + textVOffset, Math.max(10, h - 30)) + 'px';
            _appendCardTexts(div, card, titleSize, descSize, textAlign, titleColor, descColor, idx, slot || null);
            return div;
          };

          if (labelPos === 'top') {
            if (!textHide) cell.appendChild(makeTextDiv(textH, 'top', 'top'));
            cell.appendChild(makeImgDiv());
          } else if (labelPos === 'both') {
            // 상/하단 라벨 완전 독립: 상단은 'top' 슬롯, 하단은 'bottom' 슬롯
            if (!textHide) cell.appendChild(makeTextDiv(textH, 'top', 'top'));
            cell.appendChild(makeImgDiv());
            if (!textHide) cell.appendChild(makeTextDiv(textH, 'bottom', 'bottom'));
          } else if (labelPos === 'overlay-bottom' || labelPos === 'overlay-top' || labelPos === 'overlay-center') {
            // 이미지가 셀 전체를 덮고 그 위에 라벨 absolute 오버레이
            const fullImg = document.createElement('div');
            fullImg.style.cssText = `position:absolute;inset:0;overflow:hidden;`;
            if (card.icon && card.icon.svg) {
              _fillCardIcon(fullImg, card, Math.min(designW, designH), _iconOpts);
            } else if (card.imgSrc) {
              fullImg.style.backgroundImage    = `url("${card.imgSrc}")`;
              fullImg.style.backgroundSize     = _cvbBackgroundSize(card);
              fullImg.style.backgroundPosition = `${card.imgX ?? 50}% ${card.imgY ?? 50}%`;
              fullImg.style.backgroundRepeat   = 'no-repeat';
              _bindCvbImgDrag(fullImg, block, idx);
            } else {
              fullImg.style.background = 'rgba(0,0,0,0.06)';
              fullImg.style.display = 'flex'; fullImg.style.alignItems = 'center'; fullImg.style.justifyContent = 'center';
              const ph = document.createElement('span');
              ph.style.cssText = 'color:rgba(0,0,0,0.2);font-size:28px;font-family:sans-serif;pointer-events:none;font-weight:200;';
              ph.textContent = '+'; fullImg.appendChild(ph);
              _bindCvbImgPlaceholder(fullImg, block, idx);
            }
            cell.appendChild(fullImg);
            if (!textHide) {
              const overlayDiv = makeTextDiv(textH, 'middle');
              const overlayH = parseInt(block.dataset.overlayHeight) || textH;
              // 좌우 너비(%) — 기본 100%. left/right 대칭 inset 으로 가운데 정렬
              const overlayWPct = Math.min(100, Math.max(10, parseInt(block.dataset.overlayWidth) || 100));
              const sideInset = (100 - overlayWPct) / 2; // %
              const verticalAnchor =
                labelPos === 'overlay-top'    ? 'top:0;'
              : labelPos === 'overlay-center' ? `top:50%;transform:translateY(-50%);`
              :                                  'bottom:0;';
              overlayDiv.style.cssText = `position:absolute;left:${sideInset}%;right:${sideInset}%;${verticalAnchor}height:${overlayH}px;background:${cardBg};box-sizing:border-box;padding:10px 14px;display:flex;flex-direction:column;justify-content:${justifyMode};gap:4px;`;
              if (textVOffset) overlayDiv.style.paddingTop = Math.min(10 + textVOffset, Math.max(10, overlayH - 30)) + 'px';
              cell.appendChild(overlayDiv);
            }
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
    _bindCvbDblEdit(block);
    return;
  }
  // ── End Simple Card Mode ───────────────────────────────────────────────────

  const totalW = designW * gridCols + GAP * (gridCols - 1);
  const totalH = designH * gridRows + GAP * (gridRows - 1);

  // block: gridCols===1이면 고정 너비, 2+이면 섹션 너비에 맞춤
  // full-bleed면 섹션 좌우패딩 무시 — simple 분기와 동일 패턴(dataset 일관성)
  const _fbL    = block.dataset.fullBleed === 'true';
  const _secPXL = _fbL ? _effSectionPadX(block) : 0;
  if (_fbL && _secPXL > 0) {
    block.style.width      = `calc(100% + ${_secPXL * 2}px)`;
    block.style.maxWidth   = '';
    block.style.minWidth   = '0';
    block.style.marginLeft  = -_secPXL + 'px';
    block.style.marginRight = -_secPXL + 'px';
  } else {
    block.style.marginLeft  = '';
    block.style.marginRight = '';
    if (gridCols === 1) {
      block.style.width    = designW + 'px';
      block.style.maxWidth = '';
      block.style.minWidth = '';
    } else {
      block.style.width    = '100%';
      block.style.maxWidth = '';
      block.style.minWidth = '0';
    }
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
  // full-bleed: 섹션 좌우패딩 무시 옵션 (자동조립/MCP 경로 대응). 기본 off — true일 때만 set.
  if (data.fullBleed === true || data.fullBleed === 'true') block.dataset.fullBleed = 'true';
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
  fullBleed: false,
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
  // 방금 추가한 블록 자동 선택 + 화면 안으로 스크롤 (C9: selectSection→deselectAll 회피)
  try { window.selectBlock?.(block.id); } catch (_) {}
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── 수정 (PM/MCP 진입점) ──────────────────────────────────────────────────────────────────────
// updateCanvasBlock(blockId, partial) — banner02 updateBanner02Block 패턴 미러.
// dual-mode 컴포넌트:
//   - 레이어 모드 (cardMode 미지정): layers[] / patchLayers[{index,...}] free-placement
//   - Simple Card Mode (cardMode='simple'): cards[] / patchCards[{index,...}] 그리드
// 시퀀스: 검증 → before snapshot → pushHistory → dataset write → renderCanvas → autosave → 패널 리프레시
// 보안:
//   - 색상: #hex | rgb(a)/hsl(a)() | transparent 만 허용 (CSS injection 차단)
//   - imgSrc / layer.src: length ≤200000 + ["\r\n] 차단 (CSS url("") 안전)
//   - icon.svg: length ≤20000 + <script / on*= / javascript: 차단
//   - layer.fontWeight: '100'..'900' | 'normal' | 'bold' 화이트리스트
//   - gridCols/gridRows 변경 시 cards 배열 자동 sync (insertCanvasGrid 패턴 미러)
function updateCanvasBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('canvas-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `canvas-block not found: ${blockId}` };
  }
  if (!String(blockId).startsWith('cvb_')) {
    return { ok: false, code: 'INVALID', message: `blockId must start with cvb_: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }
  if (Object.keys(partial).length === 0) {
    return { ok: false, code: 'INVALID', message: 'partial empty — provide at least one field' };
  }

  // ── 내부 가드 helper (boundary 재검증 — main 보낸 값도 한 번 더) ─────────────
  const _COLOR_RE_HEX = /^#[0-9a-fA-F]{3,8}$/;
  const _COLOR_RE_FN  = /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/;
  const _isColor = v => typeof v === 'string' && (v === 'transparent' || _COLOR_RE_HEX.test(v.trim()) || _COLOR_RE_FN.test(v.trim()));
  const _isImgSrc = v => typeof v === 'string' && v.length <= 200000 && !/["\r\n]/.test(v);
  const _SVG_BAD_RE = /<script\b|on[a-z]+\s*=|javascript\s*:/i;
  const _isSafeSvg = v => typeof v === 'string' && v.length <= 20000 && !_SVG_BAD_RE.test(v);
  const _FW_ALLOWED = ['100','200','300','400','500','600','700','800','900','normal','bold'];
  const _ALIGN_ALLOWED = ['left','center','right'];
  const _LAYER_TYPES = ['shape','image','text'];
  const _isInt = (n, min, max) => Number.isInteger(n) && (min === undefined || n >= min) && (max === undefined || n <= max);
  const _isNum = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max);

  // before 스냅샷 (rollback/diff 용)
  const before = {
    canvasW: block.dataset.canvasW, canvasH: block.dataset.canvasH,
    bg: block.dataset.bg, radius: block.dataset.radius,
    layerName: block.dataset.layerName,
    gridCols: block.dataset.gridCols, gridRows: block.dataset.gridRows,
    cardGap: block.dataset.cardGap, padX: block.dataset.padX,
    fullBleed: block.dataset.fullBleed || '',
    cardMode: block.dataset.cardMode || '',
    imgRatio: block.dataset.imgRatio, imgShape: block.dataset.imgShape,
    labelPos: block.dataset.labelPos, textHide: block.dataset.textHide,
    textBg: block.dataset.textBg,
    textVOffset: block.dataset.textVOffset,
    gradDir: block.dataset.gradDir, gradOpacity: block.dataset.gradOpacity, gradStopPos: block.dataset.gradStopPos,
    titleSize: block.dataset.titleSize, descSize: block.dataset.descSize,
    textAlign: block.dataset.textAlign,
    titleColor: block.dataset.titleColor, descColor: block.dataset.descColor,
    cardOrient: block.dataset.cardOrient,
    iconMode: block.dataset.iconMode, iconScale: block.dataset.iconScale,
    iconColor: block.dataset.iconColor, iconBg: block.dataset.iconBg,
    cards: block.dataset.cards, layers: block.dataset.layers,
  };

  const applied = {};
  // history는 변경 직전 1회만 — 검증 통과 후
  const _pushOnce = (() => { let done = false; return () => { if (done) return; done = true; window.pushHistory?.(); }; })();

  // ── 1) 단순 dataset 필드 (int / color / enum / str) ──────────────────────────
  const _setIntField = (key, datasetKey, min, max) => {
    if (partial[key] === undefined) return;
    const n = Number(partial[key]);
    if (!_isInt(n, min, max)) {
      return { ok: false, code: 'INVALID', message: `${key} must be integer in [${min},${max}]: ${partial[key]}` };
    }
    _pushOnce(); block.dataset[datasetKey] = String(n); applied[key] = n;
  };
  const _setColorField = (key, datasetKey) => {
    if (partial[key] === undefined || partial[key] === null) return;
    if (!_isColor(partial[key])) {
      return { ok: false, code: 'INVALID', message: `${key} invalid color (allowed: #hex | rgb(a)/hsl(a)() | transparent): ${partial[key]}` };
    }
    _pushOnce(); block.dataset[datasetKey] = String(partial[key]).trim(); applied[key] = block.dataset[datasetKey];
  };
  const _setEnumField = (key, datasetKey, allowed) => {
    if (partial[key] === undefined) return;
    if (!allowed.includes(partial[key])) {
      return { ok: false, code: 'INVALID', message: `invalid ${key}: ${partial[key]}. allowed: ${allowed.join('|')}` };
    }
    _pushOnce(); block.dataset[datasetKey] = String(partial[key]); applied[key] = partial[key];
  };
  const _setStrField = (key, datasetKey, maxLen) => {
    if (partial[key] === undefined || partial[key] === null) return;
    if (typeof partial[key] !== 'string') {
      return { ok: false, code: 'INVALID', message: `${key} must be string` };
    }
    if (maxLen !== undefined && [...partial[key]].length > maxLen) {
      return { ok: false, code: 'INVALID', message: `${key} too long (>${maxLen} code points)` };
    }
    _pushOnce(); block.dataset[datasetKey] = partial[key]; applied[key] = partial[key];
  };
  // boolean → 'true'/'false' 문자열 저장
  const _setBoolStrField = (key, datasetKey) => {
    if (partial[key] === undefined || partial[key] === null) return;
    let v = partial[key];
    if (typeof v === 'boolean') v = v ? 'true' : 'false';
    if (!['true', 'false'].includes(v)) {
      return { ok: false, code: 'INVALID', message: `${key} must be boolean or 'true'/'false': ${partial[key]}` };
    }
    _pushOnce(); block.dataset[datasetKey] = v; applied[key] = v;
  };

  const _try = (r) => { if (r && r.ok === false) throw r; };

  try {
    _try(_setIntField('canvasW',   'canvasW',   100, 1200));
    _try(_setIntField('canvasH',   'canvasH',   40,  2000));
    _try(_setColorField('bg',      'bg'));
    _try(_setIntField('radius',    'radius',    0,   60));
    _try(_setStrField('layerName', 'layerName', 100));
    _try(_setIntField('cardGap',   'cardGap',   0,   48));
    _try(_setIntField('padX',      'padX',      0,   80));
    _try(_setBoolStrField('fullBleed', 'fullBleed'));
    _try(_setEnumField('cardMode', 'cardMode',  ['simple', '']));
    _try(_setIntField('imgRatio',  'imgRatio',  10,  90));
    _try(_setEnumField('imgShape', 'imgShape',  ['rect','circle']));
    _try(_setEnumField('labelPos', 'labelPos',  ['top','bottom','both','overlay-top','overlay-bottom','overlay-center']));
    _try(_setBoolStrField('textHide','textHide'));
    _try(_setColorField('textBg',  'textBg'));
    _try(_setIntField('textVOffset','textVOffset', 0,   100));
    _try(_setIntField('gradOpacity','gradOpacity', 0,   100));
    _try(_setIntField('gradStopPos','gradStopPos', 0,   100));
    _try(_setIntField('gradDir',   'gradDir',   0,   360));
    _try(_setIntField('titleSize', 'titleSize', 4,   400));
    _try(_setIntField('descSize',  'descSize',  4,   400));
    _try(_setEnumField('textAlign','textAlign', _ALIGN_ALLOWED));
    _try(_setColorField('titleColor','titleColor'));
    _try(_setColorField('descColor', 'descColor'));
    _try(_setEnumField('cardOrient','cardOrient', ['portrait','landscape']));
    _try(_setBoolStrField('iconMode','iconMode'));
    _try(_setIntField('iconScale', 'iconScale', 10,  90));
    _try(_setColorField('iconColor','iconColor'));
    _try(_setColorField('iconBg',  'iconBg'));
  } catch (errResult) {
    return errResult;
  }

  // ── 2) grid 크기 변경 → cards 배열 자동 sync (insertCanvasGrid 패턴 미러) ──
  let needGridSync = false;
  if (partial.gridCols !== undefined) {
    const n = Number(partial.gridCols);
    if (!_isInt(n, 1, 4)) return { ok: false, code: 'INVALID', message: `gridCols must be integer in [1,4]: ${partial.gridCols}` };
    _pushOnce(); block.dataset.gridCols = String(n); applied.gridCols = n; needGridSync = true;
  }
  if (partial.gridRows !== undefined) {
    const n = Number(partial.gridRows);
    if (!_isInt(n, 1, 4)) return { ok: false, code: 'INVALID', message: `gridRows must be integer in [1,4]: ${partial.gridRows}` };
    _pushOnce(); block.dataset.gridRows = String(n); applied.gridRows = n; needGridSync = true;
  }

  // ── 3) cards 풀 교체 / patch ───────────────────────────────────────────────────
  const _validateCard = (c, ctx) => {
    if (!c || typeof c !== 'object') return { ok: false, code: 'INVALID', message: `${ctx} must be object` };
    if (c.title !== undefined && c.title !== null) {
      if (typeof c.title !== 'string') return { ok: false, code: 'INVALID', message: `${ctx}.title must be string` };
      if ([...c.title].length > 500) return { ok: false, code: 'INVALID', message: `${ctx}.title too long (>500)` };
    }
    if (c.desc !== undefined && c.desc !== null) {
      if (typeof c.desc !== 'string') return { ok: false, code: 'INVALID', message: `${ctx}.desc must be string` };
      if ([...c.desc].length > 500) return { ok: false, code: 'INVALID', message: `${ctx}.desc too long (>500)` };
    }
    if (c.imgSrc !== undefined && c.imgSrc !== null) {
      if (typeof c.imgSrc !== 'string') return { ok: false, code: 'INVALID', message: `${ctx}.imgSrc must be string` };
      if (c.imgSrc.length > 200000) return { ok: false, code: 'TOO_LARGE', message: `${ctx}.imgSrc too long (>200000)` };
      if (/["\r\n]/.test(c.imgSrc)) return { ok: false, code: 'INVALID', message: `${ctx}.imgSrc contains quote/newline (escape unsafe)` };
    }
    if (c.imgFit !== undefined && c.imgFit !== null) {
      if (!['cover','contain'].includes(c.imgFit)) return { ok: false, code: 'INVALID', message: `${ctx}.imgFit must be cover|contain` };
    }
    if (c.imgX !== undefined && c.imgX !== null) {
      if (!_isNum(Number(c.imgX), 0, 100)) return { ok: false, code: 'INVALID', message: `${ctx}.imgX must be number 0~100` };
    }
    if (c.imgY !== undefined && c.imgY !== null) {
      if (!_isNum(Number(c.imgY), 0, 100)) return { ok: false, code: 'INVALID', message: `${ctx}.imgY must be number 0~100` };
    }
    if (c.imgScale !== undefined && c.imgScale !== null) {
      if (!_isNum(Number(c.imgScale), 100, 400)) return { ok: false, code: 'INVALID', message: `${ctx}.imgScale must be number 100~400` };
    }
    // 라벨 상/하 분리 슬롯 텍스트(both 모드 전용, 미설정 시 title/desc fallback)
    for (const k of ['titleTop','descTop','titleBottom','descBottom']) {
      if (c[k] !== undefined && c[k] !== null) {
        if (typeof c[k] !== 'string') return { ok: false, code: 'INVALID', message: `${ctx}.${k} must be string` };
        if ([...c[k]].length > 500) return { ok: false, code: 'INVALID', message: `${ctx}.${k} too long (>500)` };
      }
    }
    // 라벨 상/하 분리 슬롯 색 override(미설정 시 블록 titleColor/descColor fallback)
    for (const k of ['titleColorTop','descColorTop','titleColorBottom','descColorBottom']) {
      if (c[k] !== undefined && c[k] !== null && c[k] !== '') {
        if (!_isColor(c[k])) return { ok: false, code: 'INVALID', message: `${ctx}.${k} invalid color` };
      }
    }
    if (c.cellBg !== undefined && c.cellBg !== null && c.cellBg !== '') {
      if (!_isColor(c.cellBg)) return { ok: false, code: 'INVALID', message: `${ctx}.cellBg invalid color` };
    }
    if (c.borderWidth !== undefined && c.borderWidth !== null) {
      if (!_isInt(Number(c.borderWidth), 0, 20)) return { ok: false, code: 'INVALID', message: `${ctx}.borderWidth must be integer 0~20` };
    }
    if (c.borderColor !== undefined && c.borderColor !== null && c.borderColor !== '') {
      if (!_isColor(c.borderColor)) return { ok: false, code: 'INVALID', message: `${ctx}.borderColor invalid color` };
    }
    if (c.icon !== undefined && c.icon !== null) {
      if (typeof c.icon !== 'object') return { ok: false, code: 'INVALID', message: `${ctx}.icon must be object` };
      if (c.icon.svg !== undefined && c.icon.svg !== null) {
        if (!_isSafeSvg(c.icon.svg)) return { ok: false, code: 'INVALID', message: `${ctx}.icon.svg unsafe or too long (≤20000, no <script/on*=/javascript:)` };
      }
    }
    if (c.iconBg !== undefined && c.iconBg !== null && c.iconBg !== '') {
      if (!_isColor(c.iconBg)) return { ok: false, code: 'INVALID', message: `${ctx}.iconBg invalid color` };
    }
    if (c.iconColor !== undefined && c.iconColor !== null && c.iconColor !== '') {
      if (!_isColor(c.iconColor)) return { ok: false, code: 'INVALID', message: `${ctx}.iconColor invalid color` };
    }
    return { ok: true };
  };

  if (partial.cards !== undefined) {
    if (!Array.isArray(partial.cards)) return { ok: false, code: 'INVALID', message: 'cards must be array' };
    if (partial.cards.length < 1 || partial.cards.length > 64) {
      return { ok: false, code: 'INVALID', message: `cards length ${partial.cards.length} out of range [1,64]` };
    }
    for (let i = 0; i < partial.cards.length; i++) {
      const r = _validateCard(partial.cards[i], `cards[${i}]`);
      if (!r.ok) return r;
    }
    _pushOnce();
    block.dataset.cards = JSON.stringify(partial.cards);
    applied.cards = partial.cards.length;
    needGridSync = false; // 풀 교체했으므로 sync 불필요
  }

  if (partial.patchCards !== undefined) {
    if (!Array.isArray(partial.patchCards)) return { ok: false, code: 'INVALID', message: 'patchCards must be array' };
    if (partial.patchCards.length === 0 || partial.patchCards.length > 16) {
      return { ok: false, code: 'INVALID', message: `patchCards length ${partial.patchCards.length} out of range [1,16]` };
    }
    let curCards;
    try { curCards = JSON.parse(block.dataset.cards || '[]'); }
    catch (_) { curCards = []; }
    if (!Array.isArray(curCards)) curCards = [];
    const appliedPatches = [];
    for (let i = 0; i < partial.patchCards.length; i++) {
      const p = partial.patchCards[i];
      if (!p || typeof p !== 'object') return { ok: false, code: 'INVALID', message: `patchCards[${i}] must be object` };
      if (!Number.isInteger(p.index) || p.index < 0 || p.index >= curCards.length) {
        return { ok: false, code: 'NOT_FOUND', message: `patchCards[${i}].index out of range [0,${curCards.length - 1}]: ${p.index}` };
      }
      const { index, ...partialCard } = p;
      const r = _validateCard(partialCard, `patchCards[${i}]`);
      if (!r.ok) return r;
      const cur = curCards[index] || {};
      // icon 객체는 deep merge (svg만 들어오면 기존 icon 유지하고 svg만 교체)
      const merged = { ...cur, ...partialCard };
      if (partialCard.icon !== undefined && partialCard.icon !== null && typeof partialCard.icon === 'object') {
        merged.icon = { ...(cur.icon || {}), ...partialCard.icon };
      }
      curCards[index] = merged;
      appliedPatches.push({ index, ...partialCard });
    }
    _pushOnce();
    block.dataset.cards = JSON.stringify(curCards);
    applied.patchCards = appliedPatches;
  }

  // grid 크기 변경 후 cards 풀 교체가 없었다면 자동 sync (insertCanvasGrid 미러)
  if (needGridSync && block.dataset.cardMode === 'simple') {
    const cols  = parseInt(block.dataset.gridCols) || 1;
    const rows  = parseInt(block.dataset.gridRows) || 1;
    const total = cols * rows;
    let curCards;
    try { curCards = JSON.parse(block.dataset.cards || '[]'); } catch (_) { curCards = []; }
    if (!Array.isArray(curCards)) curCards = [];
    while (curCards.length < total) curCards.push({ title: '카드 제목', desc: '', imgSrc: '', cellBg: '' });
    while (curCards.length > total) curCards.pop();
    block.dataset.cards = JSON.stringify(curCards);
    applied.cardsSynced = total;
  }

  // ── 4) layers 풀 교체 / patch ───────────────────────────────────────────────────
  const _validateLayer = (l, ctx) => {
    if (!l || typeof l !== 'object') return { ok: false, code: 'INVALID', message: `${ctx} must be object` };
    if (l.type !== undefined && l.type !== null) {
      if (!_LAYER_TYPES.includes(l.type)) return { ok: false, code: 'INVALID', message: `${ctx}.type must be shape|image|text` };
    }
    if (l.x !== undefined && l.x !== null) {
      if (!_isInt(Number(l.x), -4000, 4000)) return { ok: false, code: 'INVALID', message: `${ctx}.x must be integer -4000~4000` };
    }
    if (l.y !== undefined && l.y !== null) {
      if (!_isInt(Number(l.y), -4000, 4000)) return { ok: false, code: 'INVALID', message: `${ctx}.y must be integer -4000~4000` };
    }
    if (l.w !== undefined && l.w !== null) {
      if (!_isInt(Number(l.w), 1, 4000)) return { ok: false, code: 'INVALID', message: `${ctx}.w must be integer 1~4000` };
    }
    if (l.h !== undefined && l.h !== null) {
      if (!_isInt(Number(l.h), 1, 4000)) return { ok: false, code: 'INVALID', message: `${ctx}.h must be integer 1~4000` };
    }
    if (l.color !== undefined && l.color !== null && l.color !== '') {
      if (!_isColor(l.color)) return { ok: false, code: 'INVALID', message: `${ctx}.color invalid color` };
    }
    if (l.radius !== undefined && l.radius !== null) {
      if (!_isInt(Number(l.radius), 0, 400)) return { ok: false, code: 'INVALID', message: `${ctx}.radius must be integer 0~400` };
    }
    if (l.src !== undefined && l.src !== null) {
      if (typeof l.src !== 'string') return { ok: false, code: 'INVALID', message: `${ctx}.src must be string` };
      if (l.src.length > 200000) return { ok: false, code: 'TOO_LARGE', message: `${ctx}.src too long (>200000)` };
      if (/["\r\n]/.test(l.src)) return { ok: false, code: 'INVALID', message: `${ctx}.src contains quote/newline (escape unsafe)` };
    }
    if (l.content !== undefined && l.content !== null) {
      if (typeof l.content !== 'string') return { ok: false, code: 'INVALID', message: `${ctx}.content must be string` };
      if ([...l.content].length > 2000) return { ok: false, code: 'INVALID', message: `${ctx}.content too long (>2000)` };
    }
    if (l.fontSize !== undefined && l.fontSize !== null) {
      if (!_isInt(Number(l.fontSize), 4, 400)) return { ok: false, code: 'INVALID', message: `${ctx}.fontSize must be integer 4~400` };
    }
    if (l.fontWeight !== undefined && l.fontWeight !== null) {
      const fw = String(l.fontWeight);
      if (!_FW_ALLOWED.includes(fw)) return { ok: false, code: 'INVALID', message: `${ctx}.fontWeight must be one of ${_FW_ALLOWED.join('|')}` };
    }
    if (l.align !== undefined && l.align !== null) {
      if (!_ALIGN_ALLOWED.includes(l.align)) return { ok: false, code: 'INVALID', message: `${ctx}.align must be left|center|right` };
    }
    if (l.label !== undefined && l.label !== null) {
      if (typeof l.label !== 'string') return { ok: false, code: 'INVALID', message: `${ctx}.label must be string` };
      if ([...l.label].length > 100) return { ok: false, code: 'INVALID', message: `${ctx}.label too long (>100)` };
    }
    return { ok: true };
  };

  if (partial.layers !== undefined) {
    if (!Array.isArray(partial.layers)) return { ok: false, code: 'INVALID', message: 'layers must be array' };
    if (partial.layers.length > 64) return { ok: false, code: 'INVALID', message: `layers length ${partial.layers.length} > 64` };
    for (let i = 0; i < partial.layers.length; i++) {
      const r = _validateLayer(partial.layers[i], `layers[${i}]`);
      if (!r.ok) return r;
      // type은 풀 교체일 때 필수
      if (!partial.layers[i].type) return { ok: false, code: 'INVALID', message: `layers[${i}].type required (shape|image|text)` };
    }
    _pushOnce();
    block.dataset.layers = JSON.stringify(partial.layers);
    applied.layers = partial.layers.length;
  }

  if (partial.patchLayers !== undefined) {
    if (!Array.isArray(partial.patchLayers)) return { ok: false, code: 'INVALID', message: 'patchLayers must be array' };
    if (partial.patchLayers.length === 0 || partial.patchLayers.length > 16) {
      return { ok: false, code: 'INVALID', message: `patchLayers length ${partial.patchLayers.length} out of range [1,16]` };
    }
    let curLayers;
    try { curLayers = JSON.parse(block.dataset.layers || '[]'); }
    catch (_) { curLayers = []; }
    if (!Array.isArray(curLayers)) curLayers = [];
    const appliedPatches = [];
    for (let i = 0; i < partial.patchLayers.length; i++) {
      const p = partial.patchLayers[i];
      if (!p || typeof p !== 'object') return { ok: false, code: 'INVALID', message: `patchLayers[${i}] must be object` };
      if (!Number.isInteger(p.index) || p.index < 0 || p.index >= curLayers.length) {
        return { ok: false, code: 'NOT_FOUND', message: `patchLayers[${i}].index out of range [0,${curLayers.length - 1}]: ${p.index}` };
      }
      const { index, ...partialLayer } = p;
      const r = _validateLayer(partialLayer, `patchLayers[${i}]`);
      if (!r.ok) return r;
      const cur = curLayers[index] || {};
      curLayers[index] = { ...cur, ...partialLayer };
      appliedPatches.push({ index, ...partialLayer });
    }
    _pushOnce();
    block.dataset.layers = JSON.stringify(curLayers);
    applied.patchLayers = appliedPatches;
  }

  // grad* 미세조정만 들어오고 textBg를 직접 주지 않은 경우(MCP/자동조립) → textBg 재조립.
  // textBg를 같이 보냈으면 사용자 의도 우선이라 덮지 않음.
  if ((applied.gradDir !== undefined || applied.gradOpacity !== undefined || applied.gradStopPos !== undefined) && partial.textBg === undefined) {
    const _gd = block.dataset.gradDir;
    const _dir = (_gd === undefined || _gd === '' || isNaN(parseInt(_gd))) ? null : parseInt(_gd);
    const _stop = parseInt(block.dataset.gradStopPos) || 0;
    const _op   = block.dataset.gradOpacity !== undefined ? parseInt(block.dataset.gradOpacity) : 85;
    block.dataset.textBg = _cvbBuildGrad(_dir, _stop, _op);
    applied.textBg = block.dataset.textBg;
  }

  if (Object.keys(applied).length === 0) {
    return { ok: false, code: 'INVALID', message: 'no valid fields applied' };
  }

  // ── 5) 재렌더 ───────────────────────────────────────────────────────────────────
  try {
    window.renderCanvas?.(block);
  } catch (e) {
    return { ok: false, code: 'RENDER_ERROR', message: e.message };
  }

  // ── 6) 우측 패널 갱신 (선택 상태일 때만) ───────────────────────────────────────
  if (block.classList.contains('selected')) {
    try {
      if (block.dataset.cardMode === 'simple' && typeof window.showSimpleCardProperties === 'function') {
        window.showSimpleCardProperties(block);
      } else if (typeof window.showCanvasProperties === 'function') {
        window.showCanvasProperties(block);
      }
    } catch (_) {}
  }
  // 7) 레이어 패널 (layerName 변경 가능성 대비)
  try { window.buildLayerPanel?.(); } catch (_) {}

  window.scheduleAutoSave?.();

  return { ok: true, blockId, before, applied };
}

// ── window 노출 ────────────────────────────────────────────────────────────
window.makeCanvasBlock  = makeCanvasBlock;
window.addCanvasBlock   = addCanvasBlock;
window.renderCanvas     = renderCanvas;
// window 노출 — banner02 패턴 미러
window.updateCanvasBlock = updateCanvasBlock;
window._triggerCvbCardImage = _triggerCvbCardImage;
window._cvbBuildGrad = _cvbBuildGrad;

export { makeCanvasBlock, addCanvasBlock, updateCanvasBlock, renderCanvas, CARD_DEFAULT_OPTS, _cvbBuildGrad };
