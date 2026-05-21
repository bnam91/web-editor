// ── Sticker Block (플로팅 오버레이) ───────────────────────────────────────
// 섹션 안에 absolute로 떠있는 작은 뱃지. 어노테이션과 같은 overlay 패턴.
// 첫 종류: 원 + NEW 텍스트 (빨간 배경 + 흰 글자)
//
// 의존성:
//   - window.getSelectedSection / showNoSelectionHint / pushHistory /
//     bindStickerSelect / scheduleAutoSave

const STICKER_DEFAULTS = {
  shape: 'circle',
  size: 60,
  text: 'NEW',
  bgColor: '#e74c3c',
  textColor: '#ffffff',
  fontSize: 14,
  fontWeight: 700,
  x: 40,
  y: 40,
};

function renderStickerBlock(block) {
  const shape      = block.dataset.shape      || STICKER_DEFAULTS.shape;
  const size       = parseInt(block.dataset.size)       || STICKER_DEFAULTS.size;
  // 모서리 핸들 리사이즈 시 W/H 독립 (sizeW/sizeH 우선, 없으면 size로 정사각)
  const sizeW      = parseInt(block.dataset.sizeW) || size;
  const sizeH      = parseInt(block.dataset.sizeH) || size;
  const text       = block.dataset.text ?? STICKER_DEFAULTS.text;
  const bgColor    = block.dataset.bgColor    || STICKER_DEFAULTS.bgColor;
  const textColor  = block.dataset.textColor  || STICKER_DEFAULTS.textColor;
  const fontSize   = parseInt(block.dataset.fontSize)   || STICKER_DEFAULTS.fontSize;
  const fontWeight = parseInt(block.dataset.fontWeight) || STICKER_DEFAULTS.fontWeight;
  const x          = parseInt(block.dataset.x) || 0;
  const y          = parseInt(block.dataset.y) || 0;
  const imgSrc     = block.dataset.imgSrc || '';
  const mode       = block.dataset.mode || (imgSrc ? 'image' : 'text');

  if (shape === 'highlight') {
    // 형광펜 모드 — 색 사각형 (글자 없음), W/H 별도, z-index 낮음 (텍스트 아래)
    const hlW = parseInt(block.dataset.hlW) || 160;
    const hlH = parseInt(block.dataset.hlH) || 28;
    const hlColor = block.dataset.hlColor || 'rgba(255, 235, 70, 0.7)';
    block.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${hlW}px;height:${hlH}px;`
      + `background:${hlColor};border-radius:4px;`
      + `user-select:none;cursor:move;z-index:1;pointer-events:auto;`;
    block.innerHTML = '';
    return;
  }

  if (shape === 'text') {
    // 텍스트 스티커 — 캔버스에 자유 배치하는 텍스트 (auto-size, 풀 옵션)
    const tFontFamily    = block.dataset.fontFamily    || "'Pretendard', sans-serif";
    const tFontSize      = parseInt(block.dataset.fontSize) || 32;
    const tFontWeight    = parseInt(block.dataset.fontWeight) || 700;
    const tTextColor     = block.dataset.textColor     || '#222222';
    const tStrokeWidth   = parseFloat(block.dataset.strokeWidth) || 0;
    const tStrokeColor   = block.dataset.strokeColor   || '#ffffff';
    const tLetterSpacing = parseFloat(block.dataset.letterSpacing);
    const tTextAlign     = block.dataset.textAlign     || 'left';
    const tShadowOn      = block.dataset.shadowOn === '1';
    const tShadowX       = parseFloat(block.dataset.shadowX) || 0;
    const tShadowY       = parseFloat(block.dataset.shadowY) || 2;
    const tShadowBlur    = parseFloat(block.dataset.shadowBlur) || 4;
    const tShadowColor   = block.dataset.shadowColor   || 'rgba(0,0,0,0.4)';
    const tBgColor       = block.dataset.bgColor       || 'transparent';
    const tRotation      = parseFloat(block.dataset.rotation) || 0;
    const tText          = block.dataset.text ?? 'Text';

    const tPadX = parseInt(block.dataset.padX);
    const tPadY = parseInt(block.dataset.padY);
    const padX = Number.isFinite(tPadX) ? tPadX : 10;
    const padY = Number.isFinite(tPadY) ? tPadY : 6;
    const lsStr     = Number.isFinite(tLetterSpacing) ? `${tLetterSpacing}px` : 'normal';
    const shadowStr = tShadowOn ? `${tShadowX}px ${tShadowY}px ${tShadowBlur}px ${tShadowColor}` : 'none';
    const strokeCss = tStrokeWidth > 0
      ? `-webkit-text-stroke:${tStrokeWidth}px ${tStrokeColor};paint-order:stroke fill;`
      : '';
    const rotCss = tRotation !== 0 ? `transform:rotate(${tRotation}deg);transform-origin:center center;` : '';
    const safeText = String(tText).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    block.style.cssText = `position:absolute;left:${x}px;top:${y}px;`
      + `background:${tBgColor};border-radius:4px;`
      + `padding:${padY}px ${padX}px;`
      + `display:inline-block;white-space:pre-wrap;word-break:break-word;`
      + `font-family:${tFontFamily};font-size:${tFontSize}px;font-weight:${tFontWeight};`
      + `color:${tTextColor};letter-spacing:${lsStr};text-align:${tTextAlign};`
      + `text-shadow:${shadowStr};${rotCss}`
      + `user-select:none;cursor:move;z-index:55;pointer-events:auto;line-height:1.25;`;
    // -webkit-text-stroke + paint-order는 span에 직접 적용해야 외곽선이 안정적으로 보임
    // (block 인라인-블럭에 상속만 의존하면 일부 환경에서 paint-order가 무시됨)
    const spanStyle = `display:inline-block;outline:none;${strokeCss}`;
    block.innerHTML = `<span class="sticker-text" style="${spanStyle}">${safeText}</span>`;
    return;
  }

  if (shape === 'highlightB') {
    // 선 형태 형광펜 — 두 점 (x1,y1)→(x2,y2) 사이를 두께 thickness만큼 칠함
    // lineStyle: 'line' | 'wavy' | 'marker'
    const x1 = parseFloat(block.dataset.x1) || 0;
    const y1 = parseFloat(block.dataset.y1) || 0;
    const x2 = parseFloat(block.dataset.x2) || 0;
    const y2 = parseFloat(block.dataset.y2) || 0;
    const thickness = parseInt(block.dataset.thickness) || 12;
    const hlColor   = block.dataset.hlColor || 'rgba(255, 235, 70, 0.7)';
    const lineStyle = block.dataset.lineStyle || 'line';
    const amplitude = parseFloat(block.dataset.amplitude) || 6;   // wavy 진폭(px)
    const period    = parseFloat(block.dataset.period)    || 30;  // wavy 주기(px)
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    // 회전 후 그리는 좌표계: 길이방향 = x축, 두께방향 = y축
    // amplitude를 thickness 위/아래로 펼치므로 bbox 패딩 = thickness/2 + amplitude
    const padThick = Math.ceil(thickness / 2) + 2;
    const padAmp   = lineStyle === 'wavy' ? Math.ceil(amplitude) + 2 : 0;
    const padMarker = lineStyle === 'marker' ? 4 : 0; // 끝부분 roughness 여유
    const pad = padThick + padAmp + padMarker;
    const bboxLeft = Math.min(x1, x2) - pad;
    const bboxTop  = Math.min(y1, y2) - pad;
    const bboxW    = Math.abs(dx) + pad * 2;
    const bboxH    = Math.abs(dy) + pad * 2;
    block.style.cssText = `position:absolute;left:${bboxLeft}px;top:${bboxTop}px;`
      + `width:${bboxW}px;height:${bboxH}px;`
      + `background:transparent;pointer-events:auto;user-select:none;z-index:1;`;
    // 내부 SVG — 회전된 좌표계에서 그림. 중심점 = (cx-bboxLeft, cy-bboxTop)
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const lineLeft = cx - bboxLeft;
    const lineTop  = cy - bboxTop;
    // SVG 내부 좌표: viewBox 0 0 length (svgH); y 중심 = svgH/2
    const svgH = thickness + (padAmp + padMarker) * 2;
    const yMid = svgH / 2;

    // path 생성 ──────────────────────────────
    let pathD = '';
    if (lineStyle === 'line') {
      pathD = `M0,${yMid} L${length},${yMid}`;
    } else if (lineStyle === 'wavy') {
      // 사인파 근사 — 한 주기당 2개 cubic Bezier 사용 (왕복 1회)
      // 시작 high → low → high … 형태가 자연스러움
      const halfPeriod = Math.max(2, period / 2);
      pathD = `M0,${yMid}`;
      let dir = 1;
      for (let x = 0; x < length; x += halfPeriod) {
        const x2p = Math.min(x + halfPeriod, length);
        const xMid = (x + x2p) / 2;
        // quadratic — 컨트롤 포인트를 위/아래로 amplitude 만큼
        pathD += ` Q${xMid},${yMid + amplitude * dir} ${x2p},${yMid}`;
        dir *= -1;
      }
    } else if (lineStyle === 'marker') {
      // 형광펜 마커 — 끝점이 약간 거친 라인 (살짝 일그러진 곡선)
      // 살짝 비뚤어진 효과: 컨트롤 포인트를 미세하게 어긋나게
      const wobble = Math.min(2, thickness * 0.1);
      const c1x = length * 0.33;
      const c1y = yMid - wobble;
      const c2x = length * 0.66;
      const c2y = yMid + wobble * 0.6;
      pathD = `M0,${yMid} C${c1x},${c1y} ${c2x},${c2y} ${length},${yMid}`;
    }

    // 마커 전용 filter (feTurbulence + displacement) — block id 기반 고유 id
    const filterId = `hlb-rough-${block.id || 'tmp'}`;
    const filterDef = (lineStyle === 'marker') ? `
      <defs>
        <filter id="${filterId}" x="-10%" y="-30%" width="120%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3"/>
          <feDisplacementMap in="SourceGraphic" scale="${Math.min(2.5, thickness * 0.18)}"/>
        </filter>
      </defs>` : '';
    const filterAttr = (lineStyle === 'marker') ? ` filter="url(#${filterId})"` : '';

    const svgNS = 'http://www.w3.org/2000/svg';
    block.innerHTML = `<svg class="sticker-hlb-svg" xmlns="${svgNS}" width="${length}" height="${svgH}" `
      + `viewBox="0 0 ${length} ${svgH}" preserveAspectRatio="none" `
      + `style="position:absolute;left:${lineLeft}px;top:${lineTop}px;`
      + `width:${length}px;height:${svgH}px;`
      + `transform:translate(-50%, -50%) rotate(${angle}deg);transform-origin:center center;`
      + `overflow:visible;cursor:move;pointer-events:auto;">`
      + filterDef
      + `<path class="sticker-hlb-line" d="${pathD}" `
      + `fill="none" stroke="${hlColor}" stroke-width="${thickness}" `
      + `stroke-linecap="round" stroke-linejoin="round"${filterAttr}/>`
      + `</svg>`;
    return;
  }

  const radius = shape === 'circle' ? '50%' : '8px';
  if (mode === 'image' && imgSrc) {
    // 이미지 모드 — 배경 색 무시, 이미지로 채움
    block.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${sizeW}px;height:${sizeH}px;`
      + `background:transparent;border-radius:${radius};overflow:hidden;`
      + `display:flex;align-items:center;justify-content:center;`
      + `user-select:none;cursor:move;z-index:55;pointer-events:auto;`;
    block.innerHTML = `<img class="sticker-img" src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;pointer-events:none;" draggable="false">`;
  } else {
    // 텍스트 모드 (기본)
    block.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${sizeW}px;height:${sizeH}px;`
      + `background:${bgColor};color:${textColor};border-radius:${radius};`
      + `display:flex;align-items:center;justify-content:center;`
      + `font-size:${fontSize}px;font-weight:${fontWeight};line-height:1;`
      + `user-select:none;cursor:move;z-index:55;pointer-events:auto;`;
    block.innerHTML = `<span class="sticker-text" style="text-align:center;padding:4px;">${text}</span>`;
  }
}

function makeStickerBlock(opts = {}) {
  const block = document.createElement('div');
  block.className = 'sticker-block';
  block.id = 'stk_' + Math.random().toString(36).slice(2, 8);
  block.dataset.type       = 'sticker';
  block.dataset.shape      = opts.shape      ?? STICKER_DEFAULTS.shape;
  block.dataset.size       = opts.size       ?? STICKER_DEFAULTS.size;
  block.dataset.text       = opts.text       ?? STICKER_DEFAULTS.text;
  block.dataset.bgColor    = opts.bgColor    ?? STICKER_DEFAULTS.bgColor;
  block.dataset.textColor  = opts.textColor  ?? STICKER_DEFAULTS.textColor;
  block.dataset.fontSize   = opts.fontSize   ?? STICKER_DEFAULTS.fontSize;
  block.dataset.fontWeight = opts.fontWeight ?? STICKER_DEFAULTS.fontWeight;
  block.dataset.x          = opts.x          ?? STICKER_DEFAULTS.x;
  block.dataset.y          = opts.y          ?? STICKER_DEFAULTS.y;
  // highlightB (선 형광펜) 전용 데이터
  if (opts.shape === 'highlightB') {
    block.dataset.x1        = opts.x1        ?? 0;
    block.dataset.y1        = opts.y1        ?? 0;
    block.dataset.x2        = opts.x2        ?? 100;
    block.dataset.y2        = opts.y2        ?? 0;
    block.dataset.thickness = opts.thickness ?? 12;
    block.dataset.hlColor   = opts.hlColor   ?? 'rgba(255, 235, 70, 0.7)';
    block.dataset.lineStyle = opts.lineStyle ?? 'line';   // 'line' | 'wavy' | 'marker'
    block.dataset.amplitude = opts.amplitude ?? 6;
    block.dataset.period    = opts.period    ?? 30;
  }
  // 텍스트 스티커 — 풀 옵션 (폰트/사이즈/컬러/외곽선/자간/정렬/그림자/배경/회전)
  if (opts.shape === 'text') {
    block.dataset.text          = opts.text          ?? 'Text';
    block.dataset.fontFamily    = opts.fontFamily    ?? "'Pretendard', sans-serif";
    block.dataset.fontSize      = opts.fontSize      ?? 32;
    block.dataset.fontWeight    = opts.fontWeight    ?? 700;
    block.dataset.textColor     = opts.textColor     ?? '#222222';
    block.dataset.strokeWidth   = opts.strokeWidth   ?? 0;
    block.dataset.strokeColor   = opts.strokeColor   ?? '#ffffff';
    block.dataset.letterSpacing = opts.letterSpacing ?? 0;
    block.dataset.textAlign     = opts.textAlign     ?? 'left';
    block.dataset.shadowOn      = opts.shadowOn      ?? '0';
    block.dataset.shadowX       = opts.shadowX       ?? 0;
    block.dataset.shadowY       = opts.shadowY       ?? 2;
    block.dataset.shadowBlur    = opts.shadowBlur    ?? 4;
    block.dataset.shadowColor   = opts.shadowColor   ?? 'rgba(0,0,0,0.4)';
    block.dataset.bgColor       = opts.bgColor       ?? 'transparent';
    block.dataset.rotation      = opts.rotation      ?? 0;
  }
  renderStickerBlock(block);
  return block;
}

function addStickerBlock(opts = {}) {
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showNoSelectionHint?.(); return; }
  window.pushHistory?.('스티커 추가');
  const block = makeStickerBlock(opts);
  sec.appendChild(block); // 섹션 직접 자식 (absolute → 섹션 기준)
  window.bindStickerSelect?.(block);
  window.scheduleAutoSave?.();
}

// ── window 노출 ────────────────────────────────────────────────────────────
window.makeStickerBlock   = makeStickerBlock;
window.addStickerBlock    = addStickerBlock;
window.renderStickerBlock = renderStickerBlock;

export { makeStickerBlock, addStickerBlock, renderStickerBlock, STICKER_DEFAULTS };
