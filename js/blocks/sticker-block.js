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
  // 회전 — circle/square/image 스티커도 드래그 회전 지원 (텍스트 스티커는 자체 브랜치에서 처리)
  const _stkRot    = parseFloat(block.dataset.rotation) || 0;
  const _stkRotCss = _stkRot ? `transform:rotate(${_stkRot}deg);transform-origin:center center;` : '';

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
      + `${_stkRotCss}`
      + `user-select:none;cursor:move;z-index:55;pointer-events:auto;`;
    block.innerHTML = `<img class="sticker-img" src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;pointer-events:none;" draggable="false">`;
  } else {
    // 텍스트 모드 (기본)
    block.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${sizeW}px;height:${sizeH}px;`
      + `background:${bgColor};color:${textColor};border-radius:${radius};`
      + `display:flex;align-items:center;justify-content:center;`
      + `font-size:${fontSize}px;font-weight:${fontWeight};line-height:1;`
      + `${_stkRotCss}`
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

// ── 수정 ────────────────────────────────────────────────────────────────────
// PM의 update_sticker_block(MCP) → main(_invokeRendererUpdateStickerBlock) → 여기.
// banner02 패턴 미러링: NOT_FOUND/INVALID + before snapshot + pushHistory + dataset partial write
// + renderStickerBlock 재렌더 + scheduleAutoSave.
//
// sticker는 polymorphic 블록 — shape에 따라 활성 dataset 키가 완전히 달라짐:
//   - circle/square: size/sizeW/sizeH/text/bgColor/textColor/fontSize/fontWeight/mode/imgSrc/rotation
//   - text:          text/fontFamily/fontSize/fontWeight/textColor/strokeWidth/strokeColor/letterSpacing/textAlign/shadow*/bgColor/padX/padY/rotation
//   - highlight:     hlW/hlH/hlColor
//   - highlightB:    x1/y1/x2/y2/thickness/hlColor/lineStyle/amplitude/period
//
// 모든 필드는 partial 허용. renderer가 무관 키는 알아서 무시. shape 변경 시에는 prop-sticker.js Shape 토글 패턴 그대로
// 기본값을 server-side에서 주입해 PM이 1콜로 "circle → text 전환"해도 깨지지 않게 함.
function updateStickerBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('sticker-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `sticker-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }
  if (Object.keys(partial).length === 0) {
    return { ok: false, code: 'INVALID', message: 'partial empty — provide at least one field' };
  }

  // before 스냅샷 (mutate 전, undo 푸시 전) — 주요 식별 필드만 저장 (전체 dataset 무게 줄임)
  const before = {
    shape: block.dataset.shape,
    mode: block.dataset.mode,
    text: block.dataset.text,
    bgColor: block.dataset.bgColor,
    textColor: block.dataset.textColor,
    fontSize: block.dataset.fontSize,
    fontWeight: block.dataset.fontWeight,
    size: block.dataset.size,
    sizeW: block.dataset.sizeW,
    sizeH: block.dataset.sizeH,
    x: block.dataset.x,
    y: block.dataset.y,
    rotation: block.dataset.rotation,
    imgSrc: block.dataset.imgSrc,
    layerName: block.dataset.layerName,
    hlW: block.dataset.hlW,
    hlH: block.dataset.hlH,
    hlColor: block.dataset.hlColor,
    x1: block.dataset.x1, y1: block.dataset.y1,
    x2: block.dataset.x2, y2: block.dataset.y2,
    thickness: block.dataset.thickness,
    lineStyle: block.dataset.lineStyle,
    amplitude: block.dataset.amplitude,
    period: block.dataset.period,
    fontFamily: block.dataset.fontFamily,
    strokeWidth: block.dataset.strokeWidth,
    strokeColor: block.dataset.strokeColor,
    letterSpacing: block.dataset.letterSpacing,
    textAlign: block.dataset.textAlign,
    shadowOn: block.dataset.shadowOn,
    shadowX: block.dataset.shadowX,
    shadowY: block.dataset.shadowY,
    shadowBlur: block.dataset.shadowBlur,
    shadowColor: block.dataset.shadowColor,
    padX: block.dataset.padX,
    padY: block.dataset.padY,
  };

  window.pushHistory?.('스티커 수정');

  const applied = {};

  // 공통 헬퍼
  const _SHAPES = ['circle','square','text','highlight','highlightB'];
  const _MODES  = ['text','image'];
  const _WEIGHTS = ['300','400','500','600','700','800','900'];
  const _ALIGNS = ['left','center','right'];
  const _LSTYLES = ['line','wavy','marker'];
  const _FONTS = [
    "'Pretendard', sans-serif",
    "'Noto Sans KR', sans-serif",
    "'Noto Serif KR', serif",
    "'Inter', sans-serif",
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    'sans-serif', 'serif', 'monospace',
  ];
  const _COLOR_RE = /^#[0-9a-fA-F]{3,8}$|^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/;

  const _isColor = (v) => typeof v === 'string' && (v === 'transparent' || _COLOR_RE.test(v.trim()));
  const _setNum = (datasetKey, value, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return false;
    if (min !== undefined && n < min) return false;
    if (max !== undefined && n > max) return false;
    block.dataset[datasetKey] = String(n);
    return true;
  };
  const _applyNum = (key, datasetKey, min, max) => {
    if (partial[key] === undefined || partial[key] === null) return;
    if (_setNum(datasetKey, partial[key], min, max)) applied[key] = Number(partial[key]);
  };
  const _applyColor = (key, datasetKey) => {
    if (partial[key] === undefined || partial[key] === null) return;
    if (!_isColor(partial[key])) return; // silently ignore invalid color (mcp validator should have caught)
    block.dataset[datasetKey] = String(partial[key]).trim();
    applied[key] = block.dataset[datasetKey];
  };
  const _applyEnum = (key, datasetKey, allowed) => {
    if (partial[key] === undefined || partial[key] === null) return;
    if (!allowed.includes(String(partial[key]))) return;
    block.dataset[datasetKey] = String(partial[key]);
    applied[key] = block.dataset[datasetKey];
  };
  const _applyStr = (key, datasetKey, maxLen) => {
    if (partial[key] === undefined || partial[key] === null) return;
    if (typeof partial[key] !== 'string') return;
    if (maxLen !== undefined && [...partial[key]].length > maxLen) return;
    block.dataset[datasetKey] = partial[key];
    applied[key] = partial[key];
  };

  // 1) shape 변경 — Shape 토글 패턴 (prop-sticker.js 486~542 mirror): 기본값 자동 주입
  if (partial.shape !== undefined) {
    if (!_SHAPES.includes(partial.shape)) {
      return { ok: false, code: 'INVALID', message: `invalid shape: ${partial.shape}` };
    }
    const prevShape = block.dataset.shape;
    const nextShape = String(partial.shape);
    if (prevShape !== nextShape) {
      block.dataset.shape = nextShape;
      applied.shape = nextShape;

      if (nextShape === 'text') {
        // text shape 기본값 주입
        if (!block.dataset.fontFamily)    block.dataset.fontFamily    = "'Pretendard', sans-serif";
        const curFs = parseInt(block.dataset.fontSize);
        if (!Number.isFinite(curFs) || curFs < 8) block.dataset.fontSize = '32';
        if (!block.dataset.fontWeight)    block.dataset.fontWeight    = '700';
        if (!block.dataset.textColor)     block.dataset.textColor     = '#222222';
        if (block.dataset.strokeWidth === undefined) block.dataset.strokeWidth = '0';
        if (!block.dataset.strokeColor)   block.dataset.strokeColor   = '#ffffff';
        if (block.dataset.letterSpacing === undefined) block.dataset.letterSpacing = '0';
        if (!block.dataset.textAlign)     block.dataset.textAlign     = 'left';
        if (block.dataset.shadowOn === undefined) block.dataset.shadowOn = '0';
        if (block.dataset.shadowX === undefined) block.dataset.shadowX = '0';
        if (block.dataset.shadowY === undefined) block.dataset.shadowY = '2';
        if (block.dataset.shadowBlur === undefined) block.dataset.shadowBlur = '4';
        if (!block.dataset.shadowColor)   block.dataset.shadowColor   = 'rgba(0,0,0,0.4)';
        block.dataset.bgColor    = 'transparent';
        if (block.dataset.rotation === undefined) block.dataset.rotation = '0';
        if (!block.dataset.text || block.dataset.text === 'NEW') block.dataset.text = 'Text';
        if (block.dataset.padX === undefined) block.dataset.padX = '10';
        if (block.dataset.padY === undefined) block.dataset.padY = '6';
      } else if (nextShape === 'highlightB') {
        // highlightB 전환 — 두 점 기본값 주입 (현재 x,y 기준)
        const baseX = parseInt(block.dataset.x) || 0;
        const baseY = parseInt(block.dataset.y) || 0;
        if (block.dataset.x1 === undefined) block.dataset.x1 = String(baseX);
        if (block.dataset.y1 === undefined) block.dataset.y1 = String(baseY + 20);
        if (block.dataset.x2 === undefined) block.dataset.x2 = String(baseX + 160);
        if (block.dataset.y2 === undefined) block.dataset.y2 = String(baseY + 20);
        if (block.dataset.thickness === undefined) block.dataset.thickness = '12';
        if (!block.dataset.hlColor) block.dataset.hlColor = 'rgba(255, 235, 70, 0.7)';
        if (!block.dataset.lineStyle) block.dataset.lineStyle = 'line';
      } else if (nextShape === 'highlight') {
        if (block.dataset.hlW === undefined) block.dataset.hlW = '160';
        if (block.dataset.hlH === undefined) block.dataset.hlH = '28';
        if (!block.dataset.hlColor) block.dataset.hlColor = 'rgba(255, 235, 70, 0.7)';
      } else {
        // circle/square — text shape에서 돌아올 때 transform 잔재 제거
        if (prevShape === 'text') {
          block.style.transform = '';
          block.style.transformOrigin = '';
        }
      }
    }
  }

  // 2) mode (circle/square 전용) — partial.mode='text' 또는 imgSrc='' 시 dataset.imgSrc 클리어
  if (partial.mode !== undefined && partial.mode !== null) {
    if (!_MODES.includes(partial.mode)) {
      return { ok: false, code: 'INVALID', message: `invalid mode: ${partial.mode}` };
    }
    block.dataset.mode = String(partial.mode);
    applied.mode = block.dataset.mode;
    if (block.dataset.mode === 'text') {
      delete block.dataset.imgSrc;
    }
  }

  // 3) imgSrc — banner02 패턴: 길이/escape 가드 + 빈 문자열은 클리어 의미
  if (partial.imgSrc !== undefined && partial.imgSrc !== null) {
    const src = String(partial.imgSrc);
    if (src.length > 200000) {
      return { ok: false, code: 'TOO_LARGE', message: 'imgSrc too long (>200000)' };
    }
    if (/["\r\n]/.test(src)) {
      return { ok: false, code: 'INVALID', message: 'imgSrc contains quote/newline (escape unsafe)' };
    }
    if (src === '') {
      delete block.dataset.imgSrc;
      block.dataset.mode = 'text';
      applied.imgSrc = '';
      applied.mode = 'text';
    } else {
      // prefix 가드 (mockup _validateMkpImgSrc pattern)
      const okPrefix = /^(data:image\/|https?:\/\/|assets\/)/.test(src);
      if (!okPrefix) {
        return { ok: false, code: 'INVALID', message: 'imgSrc must start with data:image/, http(s)://, or assets/' };
      }
      block.dataset.imgSrc = src;
      applied.imgSrc = src;
    }
  }

  // 4) text content
  _applyStr('text', 'text', 500);

  // 5) layerName
  _applyStr('layerName', 'layerName', 200);

  // 6) position
  _applyNum('x', 'x', -4000, 4000);
  _applyNum('y', 'y', -4000, 4000);

  // 7) rotation
  if (partial.rotation !== undefined && partial.rotation !== null) {
    const n = Number(partial.rotation);
    if (Number.isFinite(n) && n >= -180 && n <= 180) {
      block.dataset.rotation = String(n);
      applied.rotation = n;
    }
  }

  // 8) circle/square size — size sync (size 들어오면 sizeW/sizeH 모두 덮어씀; bindNumPair syncKeys 미러)
  if (partial.size !== undefined && partial.size !== null) {
    if (_setNum('size', partial.size, 10, 600)) {
      const n = Number(partial.size);
      block.dataset.sizeW = String(n);
      block.dataset.sizeH = String(n);
      applied.size = n;
      applied.sizeW = n;
      applied.sizeH = n;
    }
  }
  _applyNum('sizeW', 'sizeW', 10, 600);
  _applyNum('sizeH', 'sizeH', 10, 600);

  // 9) fontSize — shape 검사 후 max 적용 (circle/square: 6~150, text: 8~400)
  if (partial.fontSize !== undefined && partial.fontSize !== null) {
    const n = Number(partial.fontSize);
    const curShape = block.dataset.shape;
    const minFs = curShape === 'text' ? 8 : 6;
    const maxFs = curShape === 'text' ? 400 : 150;
    if (Number.isFinite(n) && n >= minFs && n <= maxFs) {
      block.dataset.fontSize = String(n);
      applied.fontSize = n;
    }
  }

  // 10) fontWeight — number/string 모두 받아서 string normalize
  if (partial.fontWeight !== undefined && partial.fontWeight !== null) {
    const fw = String(partial.fontWeight);
    if (_WEIGHTS.includes(fw)) {
      block.dataset.fontWeight = fw;
      applied.fontWeight = fw;
    }
  }

  // 11) 색상 — bgColor/textColor/hlColor/strokeColor/shadowColor
  _applyColor('bgColor', 'bgColor');
  _applyColor('textColor', 'textColor');
  _applyColor('hlColor', 'hlColor');
  _applyColor('strokeColor', 'strokeColor');
  _applyColor('shadowColor', 'shadowColor');

  // 12) highlight (사각 형광펜)
  _applyNum('hlW', 'hlW', 10, 1200);
  _applyNum('hlH', 'hlH', 4, 400);

  // 13) highlightB (선 형광펜)
  _applyNum('x1', 'x1', -4000, 4000);
  _applyNum('y1', 'y1', -4000, 4000);
  _applyNum('x2', 'x2', -4000, 4000);
  _applyNum('y2', 'y2', -4000, 4000);
  _applyNum('thickness', 'thickness', 1, 200);
  _applyEnum('lineStyle', 'lineStyle', _LSTYLES);
  _applyNum('amplitude', 'amplitude', 1, 60);
  _applyNum('period', 'period', 6, 200);

  // 14) text shape 전용 — fontFamily / strokeWidth / letterSpacing / textAlign / shadow / padding
  if (partial.fontFamily !== undefined && partial.fontFamily !== null) {
    if (_FONTS.includes(String(partial.fontFamily))) {
      block.dataset.fontFamily = String(partial.fontFamily);
      applied.fontFamily = block.dataset.fontFamily;
    }
  }
  _applyNum('strokeWidth', 'strokeWidth', 0, 50);
  if (partial.letterSpacing !== undefined && partial.letterSpacing !== null) {
    const n = Number(partial.letterSpacing);
    if (Number.isFinite(n) && n >= -10 && n <= 40) {
      block.dataset.letterSpacing = String(n);
      applied.letterSpacing = n;
    }
  }
  _applyEnum('textAlign', 'textAlign', _ALIGNS);

  // shadowOn — boolean true/false 도 받아서 '1'/'0' normalize (prop UI는 문자열 저장)
  if (partial.shadowOn !== undefined && partial.shadowOn !== null) {
    const so = (partial.shadowOn === true || partial.shadowOn === '1' || partial.shadowOn === 1) ? '1' : '0';
    block.dataset.shadowOn = so;
    applied.shadowOn = so;
  }
  _applyNum('shadowX', 'shadowX', -20, 20);
  _applyNum('shadowY', 'shadowY', -20, 20);
  _applyNum('shadowBlur', 'shadowBlur', 0, 40);
  _applyNum('padX', 'padX', 0, 400);
  _applyNum('padY', 'padY', 0, 400);

  // 15) 재렌더 (변경 없어도 idempotent)
  try {
    renderStickerBlock(block);
  } catch (e) {
    return { ok: false, code: 'RENDER_ERROR', message: e.message };
  }

  // 16) 우측 패널 갱신 (선택 상태일 때만)
  if (block.classList.contains('selected')) {
    try { window.showStickerProperties?.(block); } catch (_) {}
  }
  // 17) 레이어 패널 (layerName 변경 가능성 대비)
  try { window.buildLayerPanel?.(); } catch (_) {}

  window.scheduleAutoSave?.();

  const changedKeys = Object.keys(applied);
  return { ok: true, blockId, before, applied, changedKeys };
}

window.updateStickerBlock = updateStickerBlock;

// ── window 노출 ────────────────────────────────────────────────────────────
window.makeStickerBlock   = makeStickerBlock;
window.addStickerBlock    = addStickerBlock;
window.renderStickerBlock = renderStickerBlock;

export { makeStickerBlock, addStickerBlock, updateStickerBlock, renderStickerBlock, STICKER_DEFAULTS };
