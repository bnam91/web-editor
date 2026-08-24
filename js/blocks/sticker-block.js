// ── Sticker Block (플로팅 오버레이) ───────────────────────────────────────
// 섹션 안에 absolute로 떠있는 작은 뱃지. 어노테이션과 같은 overlay 패턴.
// 첫 종류: 원 + NEW 텍스트 (빨간 배경 + 흰 글자)
//
// 의존성:
//   - window.getSelectedSection / showNoSelectionHint / pushHistory /
//     bindStickerSelect / scheduleAutoSave

// B13: sticky — 마지막에 쓴 스티커 스타일을 shape별로 기억해 다음 addStickerBlock 기본값으로 사용.
//      위치(x/y)·절대크기·text 내용은 제외(cascade/placeholder 담당), 스타일 토큰만 캡처.
const _lastStickerStyle = Object.create(null);  // { [shape]: {필드...}, __last: {...} }
// 위치 다양화는 addStickerBlock cascade(A25)로 처리.
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

const _CTL_CHARS_RE = /[\u0000-\u0008\u000B-\u001F\u007F]/g;
// 제어문자 정화 — \b(U+0008) 등 보이지 않는 제어문자가 렌더에 잔존하면
// contenteditable 캐럿 오프셋을 어지럽힘 (실데이터 stk_p4wfa0 선두 \b 사례).
// \t(U+0009)·\n(U+000A)은 보존 (텍스트 스티커 Enter 줄바꿈 기능 유지). 렌더는 비파괴(dataset 불변),
// dataset 자체는 편집 커밋(sticker-select.js finish) 시 자연 치유됨.
function _stripCtlChars(s) {
  return String(s).replace(_CTL_CHARS_RE, '');
}

// ── U6b: 스티커 리치텍스트 sanitizer ──────────────────────────────────────
// dataset.textHtml(부분 서식 HTML)을 렌더·로드 때마다 재-sanitize한다(저장본/.gdt 변조 대비).
// ★정규식 아님 — DOM 순회. template 파싱이라 실행 컨텍스트 없음(img 로드·이벤트 미발생).
//   허용 태그만 재구성, span은 style만·style도 프로퍼티/값 화이트리스트, 그 외 전부 제거.
const _STK_ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'BR', 'SPAN']);
const _STK_ALLOWED_STYLE_PROPS = new Set(['color', 'font-weight', 'font-style', 'text-decoration', 'background-color']);
// 값 화이트리스트 — hex / 함수형색(rgb·hsl, 내부 charset 잠금) / 명명색·키워드(bold·italic·underline·line-through·normal) / 정수(font-weight).
//   함수형색 내부는 [0-9.,\s%/]만 허용 → url(·javascript: 등 침투 불가.
const _STK_VAL_HEX  = /^#[0-9a-fA-F]{3,8}$/;
const _STK_VAL_FUNC = /^(?:rgb|rgba|hsl|hsla)\(\s*[0-9.,\s%/]+\)$/i;
const _STK_VAL_WORD = /^[a-z]+(?:[ -][a-z]+)*$/i;
const _STK_VAL_NUM  = /^[0-9]{1,3}$/;

function _stkSafeStyleValue(rawVal) {
  const v = String(rawVal).trim();
  if (!v) return null;
  if (_STK_VAL_HEX.test(v) || _STK_VAL_FUNC.test(v) || _STK_VAL_WORD.test(v) || _STK_VAL_NUM.test(v)) return v;
  return null; // url(...)·expression(...)·javascript:·기타 함수/특수문자 = 그 선언 제거 (#4 교훈)
}

function _stkSanitizeStyle(styleStr) {
  if (!styleStr) return '';
  const kept = [];
  for (const decl of String(styleStr).split(';')) {
    const idx = decl.indexOf(':');
    if (idx < 0) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const val  = decl.slice(idx + 1).trim();
    if (!_STK_ALLOWED_STYLE_PROPS.has(prop)) continue;
    const safe = _stkSafeStyleValue(val);
    if (safe == null) continue;
    kept.push(`${prop}:${safe}`);
  }
  return kept.join(';');
}

function _stkSanitizeInto(srcParent, dstParent) {
  const doc = dstParent.ownerDocument || document;
  srcParent.childNodes.forEach((node) => {
    if (node.nodeType === 3) { // 텍스트 — 제어문자만 정화(\t·\n 보존), esc는 innerHTML 직렬화가 담당
      dstParent.appendChild(doc.createTextNode(_stripCtlChars(node.nodeValue)));
      return;
    }
    if (node.nodeType !== 1) return; // 주석/기타 노드 제거
    const tag = node.tagName ? node.tagName.toUpperCase() : '';
    if (tag === 'SCRIPT' || tag === 'STYLE') return; // 자식까지 통째 제거
    if (_STK_ALLOWED_TAGS.has(tag)) {
      const clean = doc.createElement(tag.toLowerCase());
      if (tag === 'SPAN') {
        const safeStyle = _stkSanitizeStyle(node.getAttribute('style'));
        if (safeStyle) clean.setAttribute('style', safeStyle);
      }
      if (tag !== 'BR') _stkSanitizeInto(node, clean); // 그 외 속성(on*/href/src/class/id/data-*)은 미복사=제거
      dstParent.appendChild(clean);
    } else {
      _stkSanitizeInto(node, dstParent); // 비허용 태그 = 언랩(자식만 재귀 편입)
    }
  });
}

// 문자열 HTML → sanitize된 문자열 HTML. template.content(inert DocumentFragment)에서 파싱.
function _sanitizeStickerHtml(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = String(html == null ? '' : html);
  const out = document.createElement('div');
  _stkSanitizeInto(tpl.content, out);
  return out.innerHTML;
}
window._sanitizeStickerHtml = _sanitizeStickerHtml;

// sanitize된 html에 «실제 인라인 서식»이 있는지 판정 — 서식 태그(b/strong/i/em/u/s)나 style 달린 span.
//   <br>(줄바꿈)만 있는 건 서식 아님(평문 경로 유지). finish()의 textHtml 생성 여부 판정에 사용.
function _stickerHtmlHasFormatting(html) {
  if (!html) return false;
  const tpl = document.createElement('template');
  tpl.innerHTML = String(html);
  if (tpl.content.querySelector('b,strong,i,em,u,s')) return true;
  for (const s of tpl.content.querySelectorAll('span')) {
    if (s.getAttribute('style')) return true;
  }
  return false;
}
window._stickerHtmlHasFormatting = _stickerHtmlHasFormatting;

function renderStickerBlock(block) {
  _renderStickerBlockInner(block);
  // 섹션 밖 크롭(--sec-clip) 재계산 — 렌더 branch들의 cssText 대입이 인라인 스타일을 통째로
  // 덮어써 기존 변수가 지워지므로 매 렌더 후 필수. shape별 early return과 무관하게 wrapper에서
  // 일괄 처리, auto 폭(max-content) 측정 위해 layout 확정 후(rAF).
  requestAnimationFrame(() => _updateStickerSecClip(block));
}

function _renderStickerBlockInner(block) {
  const shape      = block.dataset.shape      || STICKER_DEFAULTS.shape;
  const size       = parseInt(block.dataset.size)       || STICKER_DEFAULTS.size;
  // 모서리 핸들 리사이즈 시 W/H 독립 (sizeW/sizeH 우선, 없으면 size로 정사각)
  const sizeW      = parseInt(block.dataset.sizeW) || size;
  const sizeH      = parseInt(block.dataset.sizeH) || size;
  const text       = _stripCtlChars(block.dataset.text ?? STICKER_DEFAULTS.text);
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
    // [스트로크 v2 마이그레이션] 구버전(1배 렌더 시절)에 저장된 블록은 strokeV 마커가 없다.
    // 2배 렌더 정합화로 보이는 두께가 2배가 되는 것을 막기 위해 1회만 절반으로 환산해
    // 기존 저장 프로젝트의 '보이는 두께'를 그대로 유지한다. 신규 블록은
    // makeStickerBlock/updateStickerBlock(shape→text)에서 strokeV='2' 마킹되어 스킵.
    // dataset은 직렬화로 영속 → 재로드 시 이중 환산 없음.
    if (block.dataset.strokeV !== '2') {
      const _legacyW = parseFloat(block.dataset.strokeWidth);
      if (Number.isFinite(_legacyW) && _legacyW > 0) block.dataset.strokeWidth = String(_legacyW / 2);
      block.dataset.strokeV = '2';
    }
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
    // 폰트 스타일 (이탤릭) / 장식 (밑줄·취소선 — 공백 조합 허용)
    const tFontStyle = block.dataset.fontStyle === 'italic' ? 'italic' : 'normal';
    const _TEXT_DECOS = ['none', 'underline', 'line-through', 'underline line-through'];
    const tTextDeco = _TEXT_DECOS.includes(block.dataset.textDecoration) ? block.dataset.textDecoration : 'none';

    const tPadX = parseInt(block.dataset.padX);
    const tPadY = parseInt(block.dataset.padY);
    const padX = Number.isFinite(tPadX) ? tPadX : 10;
    const padY = Number.isFinite(tPadY) ? tPadY : 6;
    const lsStr     = Number.isFinite(tLetterSpacing) ? `${tLetterSpacing}px` : 'normal';
    const shadowStr = tShadowOn ? `${tShadowX}px ${tShadowY}px ${tShadowBlur}px ${tShadowColor}` : 'none';
    // -webkit-text-stroke는 글리프 윤곽 '중앙 정렬'이고 paint-order:stroke fill로 안쪽 절반이
    // fill에 덮여 실제 보이는 외곽선 두께 ≈ w/2. asset(border)/shape(SVG stroke)의 "값 N = 보이는 N px"
    // 시맨틱과 맞추기 위해 2배로 렌더 (dataset.strokeWidth 수치 자체는 불변).
    const strokeCss = tStrokeWidth > 0
      ? `-webkit-text-stroke:${tStrokeWidth * 2}px ${tStrokeColor};paint-order:stroke fill;`
      : '';
    const rotCss = tRotation !== 0 ? `transform:rotate(${tRotation}deg);transform-origin:center center;` : '';
    const safeText = _stripCtlChars(tText).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // 박스 너비 — 'auto'(또는 미지정) = 내용맞춤, 고정 px = 그 폭 안에서 줄바꿈(원치 않는
    // 자동 줄바꿈 해소용으로 넓힘). box-sizing:border-box로 지정 폭이 padding 포함 총 박스폭이 되게 함
    // (패널 토글 시 offsetWidth로 seed하는 값과 일치).
    // auto는 max-content: absolute 요소의 shrink-to-fit이 섹션 우측 경계 안에서만 폭을 잡아
    // 경계에 붙이면 줄바꿈되던 것 → 프레임처럼 섹션 밖으로 자연 오버플로우 (\n 명시 줄바꿈은 pre-wrap 보존).
    const tBoxWraw = block.dataset.boxW;
    const tBoxW    = parseInt(tBoxWraw);
    const boxWCss  = (tBoxWraw && tBoxWraw !== 'auto' && Number.isFinite(tBoxW) && tBoxW > 0)
      ? `width:${tBoxW}px;box-sizing:border-box;` : 'width:max-content;';
    // 코너 라운드 — 미설정 시 4(기존 하드코딩 값과 동일, 무회귀)
    const tCornerR = Number.isFinite(parseInt(block.dataset.cornerRadius)) ? parseInt(block.dataset.cornerRadius) : 4;

    block.style.cssText = `position:absolute;left:${x}px;top:${y}px;`
      + `background:${tBgColor};border-radius:${tCornerR}px;`
      + `padding:${padY}px ${padX}px;${boxWCss}`
      + `display:inline-block;white-space:pre-wrap;word-break:break-word;`
      + `font-family:${tFontFamily};font-size:${tFontSize}px;font-weight:${tFontWeight};font-style:${tFontStyle};`
      + `color:${tTextColor};letter-spacing:${lsStr};text-align:${tTextAlign};`
      + `text-shadow:${shadowStr};${rotCss}`
      + `user-select:none;cursor:move;z-index:55;pointer-events:auto;line-height:1.25;`;
    // -webkit-text-stroke + paint-order는 span에 직접 적용해야 외곽선이 안정적으로 보임
    // (block 인라인-블럭에 상속만 의존하면 일부 환경에서 paint-order가 무시됨)
    // text-decoration도 span에 직접 — span이 inline-block이라 부모 장식이 전파되지 않음.
    const spanStyle = `display:inline-block;outline:none;text-decoration:${tTextDeco};${strokeCss}`;
    // U6b: dataset.textHtml(부분 서식)이 있으면 재-sanitize한 HTML을, 없으면 기존 평문 safeText 그대로.
    //   ⇒ 옛 저장본(textHtml 없음) 완전 무변·무회귀.
    const tInner = block.dataset.textHtml ? _sanitizeStickerHtml(block.dataset.textHtml) : safeText;
    block.innerHTML = `<span class="sticker-text" style="${spanStyle}">${tInner}</span>`;
    return;
  }

  if (shape === 'icon') {
    // U6(e): 아이콘 스티커 — Iconify SVG(또는 img fallback)를 인라인 렌더.
    //   드래그/리사이즈/회전은 일반 스티커(circle/square)와 동일 경로(코너 핸들).
    //   텍스트 편집 분기는 .sticker-text가 없으므로 자동 제외됨.
    const iconSvg   = block.dataset.iconSvg || block.dataset.imgSrc || '';
    const iconColor = block.dataset.iconColor || '';
    const colorCss  = iconColor ? `color:${iconColor};` : '';
    block.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${sizeW}px;height:${sizeH}px;`
      + `background:transparent;overflow:visible;`
      + `display:flex;align-items:center;justify-content:center;`
      + `${colorCss}${_stkRotCss}`
      + `user-select:none;cursor:move;z-index:55;pointer-events:auto;`;
    if (iconSvg && /^https?:\/\//.test(iconSvg)) {
      // URL인 경우 img로 (fetch 실패 fallback 등)
      block.innerHTML = `<img class="sticker-icon-img" src="${iconSvg}" style="width:100%;height:100%;object-fit:contain;pointer-events:none;" draggable="false">`;
    } else if (iconSvg) {
      block.innerHTML = iconSvg;
      const svg = block.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', sizeW);
        svg.setAttribute('height', sizeH);
        svg.style.display = 'block';
        svg.style.pointerEvents = 'none';
      } else {
        // svg 파싱 실패 시 raw 문자열(예: img 태그)도 그대로 들어옴 — pointer-events만 차단
        const inner = block.firstElementChild;
        if (inner) inner.style.pointerEvents = 'none';
      }
    } else {
      // placeholder (아이콘 미지정) — iconify-block과 동일한 빈 아이콘
      block.innerHTML = `<svg width="${sizeW}" height="${sizeH}" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="1.5" style="pointer-events:none;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
    }
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
    // 폰트 스타일(이탤릭)/장식(밑줄·취소선) — text shape 브랜치(:85-87)와 동일 파싱 규칙
    const bFontStyle = block.dataset.fontStyle === 'italic' ? 'italic' : 'normal';
    const _B_TEXT_DECOS = ['none', 'underline', 'line-through', 'underline line-through'];
    const bTextDeco = _B_TEXT_DECOS.includes(block.dataset.textDecoration) ? block.dataset.textDecoration : 'none';
    block.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${sizeW}px;height:${sizeH}px;`
      + `background:${bgColor};color:${textColor};border-radius:${radius};`
      + `display:flex;align-items:center;justify-content:center;`
      + `font-size:${fontSize}px;font-weight:${fontWeight};font-style:${bFontStyle};line-height:1;`
      + `${_stkRotCss}`
      + `user-select:none;cursor:move;z-index:55;pointer-events:auto;`;
    // outline:none — 더블클릭 편집(contenteditable+focus) 시 브라우저 기본 포커스링(주황 auto) 억제.
    //   text 스티커 span(:115)과 동일 컨벤션 → 편집 중 시각 = 블럭 레벨 선택 아웃라인만 (타 블럭과 정합).
    // text-decoration은 span에 직접 — flex 자식이라 부모 장식 전파에 의존하지 않음.
    // U6b: circle/square 뱃지도 편집 시 부분 서식이 붙을 수 있어 동일 분기(silent loss 방지).
    //   textHtml 있으면 재-sanitize, 없으면 기존 평문 text 그대로(무회귀).
    const bInner = block.dataset.textHtml ? _sanitizeStickerHtml(block.dataset.textHtml) : text;
    block.innerHTML = `<span class="sticker-text" style="text-align:center;padding:4px;outline:none;text-decoration:${bTextDeco};">${bInner}</span>`;
  }
}

// 섹션 밖 크롭 — 편집 캔버스에서도 잘림(현빈 확정). 스티커 로컬 좌표(offset*)로 섹션 경계
// 침범량을 계산해 인라인 CSS 변수 --sec-clip(inset)에 기록한다. 실제 적용/해제는 CSS가 결정:
// .selected(조작 중)와 [data-overflow-visible=true] 섹션은 clip-path:none으로 무시.
// 인라인 변수라 저장 HTML·미리보기·Export 클론에 그대로 복제 → 세 화면이 한 소스로 잘림.
// 한계: rotation 스티커는 clip이 요소와 함께 회전(경계선과 불일치) — 현행 사용례 0도.
function _updateStickerSecClip(block) {
  const sec = block.closest('.section-block');
  if (!sec) return;
  const w = block.offsetWidth, h = block.offsetHeight;
  if (!w || !h) { block.style.removeProperty('--sec-clip'); return; }
  const x = block.offsetLeft, y = block.offsetTop;
  const t = Math.max(0, -y);
  const l = Math.max(0, -x);
  const r = Math.max(0, x + w - sec.clientWidth);
  const b = Math.max(0, y + h - sec.clientHeight);
  if (t || l || r || b) block.style.setProperty('--sec-clip', `inset(${t}px ${r}px ${b}px ${l}px)`);
  else block.style.removeProperty('--sec-clip');
}
window._updateStickerSecClip = _updateStickerSecClip;

// B13: 현재 sticker의 스타일 토큰을 shape별 슬롯에 저장 (위치/절대크기/text 제외)
function rememberStickerStyle(block) {
  if (!block || !block.classList || !block.classList.contains('sticker-block')) return;
  const d = block.dataset;
  const shape = d.shape || 'circle';
  const slot = {};
  const put = (k) => { if (d[k] !== undefined && d[k] !== '') slot[k] = d[k]; };
  if (shape === 'highlight') {
    put('hlColor');
  } else if (shape === 'highlightB') {
    put('hlColor'); put('thickness'); put('lineStyle'); put('amplitude'); put('period');
  } else if (shape === 'text') {
    ['fontFamily','fontSize','fontWeight','fontStyle','textDecoration','textColor','strokeWidth','strokeColor',
     'letterSpacing','textAlign','shadowOn','shadowX','shadowY','shadowBlur','shadowColor',
     'bgColor','padX','padY','cornerRadius'].forEach(put);
  } else if (shape === 'icon') {
    // U6(e): 아이콘은 색상(currentColor SVG)만 sticky — iconName/iconSvg는 매번 새로 고르므로 제외
    put('iconColor');
  } else { // circle / square (image 모드는 imgSrc 제외 — 다음 생성은 텍스트 스타일만)
    ['bgColor','textColor','fontSize','fontWeight','fontStyle','textDecoration'].forEach(put);
  }
  slot.shape = shape;
  _lastStickerStyle[shape] = slot;
  _lastStickerStyle.__last = slot;   // shape 미지정 생성 시 마지막 shape 재현용
}
window.rememberStickerStyle = rememberStickerStyle;

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
  // 폰트 스타일/장식 — circle/square에도 유효 (sticky/즐겨찾기 승계용). 미지정 시 dataset 미생성(렌더 기본 normal/none).
  if (opts.fontStyle      !== undefined) block.dataset.fontStyle      = opts.fontStyle;
  if (opts.textDecoration !== undefined) block.dataset.textDecoration = opts.textDecoration;
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
  // U6(e): 아이콘 스티커 — Iconify에서 고른 SVG/이름 보관 (size는 위 size dataset 공유)
  if (opts.shape === 'icon') {
    block.dataset.iconName  = opts.iconName  ?? '';
    // 콜백 페이로드는 {name, svg, size} — svg를 iconSvg dataset에 보관(직렬화로 영속)
    block.dataset.iconSvg   = opts.iconSvg   ?? opts.svg   ?? '';
    block.dataset.iconColor = opts.iconColor ?? '';
    block.dataset.size      = opts.size      ?? 64;
    block.dataset.text      = '';  // icon은 텍스트 없음
  }
  // 텍스트 스티커 — 풀 옵션 (폰트/사이즈/컬러/외곽선/자간/정렬/그림자/배경/회전)
  if (opts.shape === 'text') {
    block.dataset.text          = opts.text          ?? 'Text';
    block.dataset.fontFamily    = opts.fontFamily    ?? "'Pretendard', sans-serif";
    block.dataset.fontSize      = opts.fontSize      ?? 32;
    block.dataset.fontWeight    = opts.fontWeight    ?? 700;
    block.dataset.fontStyle     = opts.fontStyle     ?? 'normal';
    block.dataset.textDecoration = opts.textDecoration ?? 'none';
    block.dataset.textColor     = opts.textColor     ?? '#222222';
    block.dataset.strokeWidth   = opts.strokeWidth   ?? 0;
    block.dataset.strokeV       = '2'; // 신규 블록 = v2 시맨틱(값 N=보이는 N px) — 렌더 마이그레이션 스킵
    block.dataset.strokeColor   = opts.strokeColor   ?? '#ffffff';
    block.dataset.letterSpacing = opts.letterSpacing ?? 0;
    block.dataset.textAlign     = opts.textAlign     ?? 'left';
    block.dataset.shadowOn      = opts.shadowOn      ?? '0';
    block.dataset.shadowX       = opts.shadowX       ?? 0;
    block.dataset.shadowY       = opts.shadowY       ?? 2;
    block.dataset.shadowBlur    = opts.shadowBlur    ?? 4;
    block.dataset.shadowColor   = opts.shadowColor   ?? 'rgba(0,0,0,0.4)';
    block.dataset.bgColor       = opts.bgColor       ?? 'transparent';
    if (opts.cornerRadius !== undefined) block.dataset.cornerRadius = opts.cornerRadius;
    block.dataset.rotation      = opts.rotation      ?? 0;
  }
  renderStickerBlock(block);
  // B13(Codex): 프리셋/메뉴로 생성한 스타일도 다음 스티커에 sticky하게 — 생성 직후 기억.
  try { rememberStickerStyle(block); } catch (_) {}
  return block;
}

function addStickerBlock(opts = {}) {
  // U6(b): 섹션 미선택 게이트 — sec 결정 우선순위(맨아래-섹션 자동 폴백 제거):
  //   1) getSelectedSection() (이제 .sticker-block.selected 포함 — editor.js U6 보강)
  //   2) 현재 선택된 sticker/일반 블록의 closest('.section-block') (명시적 회귀 방지)
  //   둘 다 없으면(=아무것도 선택 안 됨) 추가하지 않고 "섹션을 선택하세요" 토스트만 띄움.
  //   (구 3순위 last-section 폴백은 의도치 않은 맨아래 섹션 추가를 유발해 제거됨)
  const selectedAnyBlock = document.querySelector('.sticker-block.selected, .block.selected, [class*="-block"].selected');
  const sec = window.getSelectedSection?.()
    || selectedAnyBlock?.closest('.section-block');
  if (!sec) { window.showToast?.('섹션을 선택하세요'); return; }
  // B13 가드: 값이 undefined인 키는 '지정 안 함'과 동일 취급 — spread 머지에서
  //   undefined 키가 remembered 스타일(예: iconColor)을 덮어써 ''로 강등시키는 것 방지.
  //   (호출자 객체 비변조 — 새 객체로 재구성)
  {
    const cleaned = {};
    for (const [k, v] of Object.entries(opts)) if (v !== undefined) cleaned[k] = v;
    opts = cleaned;
  }
  // B13: sticky — 호출 opts에 없는 스타일 필드는 마지막에 쓴 스타일로 보충.
  //   shape 결정: 명시 opts.shape > 마지막에 쓴 shape > 기본. 그 shape 슬롯을 깔고 opts로 덮어씀.
  //   슬롯은 x/y/size/text를 안 담으므로 cascade·placeholder 분기 영향 없음.
  {
    const wantShape = opts.shape ?? _lastStickerStyle.__last?.shape ?? STICKER_DEFAULTS.shape;
    const remembered = _lastStickerStyle[wantShape];
    if (remembered) opts = { shape: wantShape, ...remembered, ...opts };
    else if (opts.shape == null && wantShape !== STICKER_DEFAULTS.shape) opts = { ...opts, shape: wantShape };
  }
  // A25/A27: x/y 미지정 시 cascade offset — 같은 자리 겹침 방지 (highlight 포함 shape 공통)
  if (opts.x == null && opts.y == null) {
    const n = sec.querySelectorAll('.sticker-block').length;
    let cx = 40 + (n % 8) * 24;
    let cy = 40 + (n % 8) * 24;
    // highlight는 폭이 커서 clamp 가정 크기를 분기 (A27)
    const bw = (opts.shape === 'highlight') ? 160 : 60;
    const bh = (opts.shape === 'highlight') ? 28  : 60;
    const [qx, qy] = window._clampToSection?.(cx, cy, sec, bw, bh) || [cx, cy];
    opts = { ...opts, x: qx, y: qy };
  }
  window.pushHistory?.('스티커 추가');
  const block = makeStickerBlock(opts);
  sec.appendChild(block); // 섹션 직접 자식 (absolute → 섹션 기준)
  window.bindStickerSelect?.(block);
  // A24: 생성 직후 자동 선택 → 핸들 + 우측 속성패널 노출 (_selectSticker가 deselect/select/handles/panel 일괄 처리)
  window._selectSticker?.(block);
  // A26: text shape는 생성 직후 인라인 편집 진입 (rAF로 DOM 부착·핸들 생성 후 안전 focus)
  if ((opts.shape ?? STICKER_DEFAULTS.shape) === 'text') {
    requestAnimationFrame(() => window._enterStickerEdit?.(block));
  }
  window.scheduleAutoSave?.();
}

// ── 수정 ────────────────────────────────────────────────────────────────────
// PM의 update_sticker_block(MCP) → main(_invokeRendererUpdateStickerBlock) → 여기.
// banner02 패턴 미러링: NOT_FOUND/INVALID + before snapshot + pushHistory + dataset partial write
// + renderStickerBlock 재렌더 + scheduleAutoSave.
//
// sticker는 polymorphic 블록 — shape에 따라 활성 dataset 키가 완전히 달라짐:
//   - circle/square: size/sizeW/sizeH/text/bgColor/textColor/fontSize/fontWeight/fontStyle/textDecoration/mode/imgSrc/rotation
//   - text:          text/fontFamily/fontSize/fontWeight/fontStyle/textDecoration/textColor/strokeWidth/strokeColor/letterSpacing/textAlign/shadow*/bgColor/padX/padY/rotation
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
    fontStyle: block.dataset.fontStyle,
    textDecoration: block.dataset.textDecoration,
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
    cornerRadius: block.dataset.cornerRadius,
    boxW: block.dataset.boxW,
    iconName: block.dataset.iconName,
    iconColor: block.dataset.iconColor,
  };

  window.pushHistory?.('스티커 수정');

  const applied = {};

  // 공통 헬퍼
  const _SHAPES = ['circle','square','text','highlight','highlightB','icon'];
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
        if (block.dataset.fontStyle === undefined) block.dataset.fontStyle = 'normal';
        if (block.dataset.textDecoration === undefined) block.dataset.textDecoration = 'none';
        if (!block.dataset.textColor)     block.dataset.textColor     = '#222222';
        if (block.dataset.strokeWidth === undefined) block.dataset.strokeWidth = '0';
        // 스트로크 v2 마이그레이션 선반영 — 구버전 잔존값(과거 text→타 shape 왕복)은 절반 환산 후 마킹.
        // 여기서 마킹해 두면 같은 호출의 partial.strokeWidth(v2 시맨틱)가 렌더에서 재환산되지 않음.
        if (block.dataset.strokeV !== '2') {
          const _lw = parseFloat(block.dataset.strokeWidth);
          if (Number.isFinite(_lw) && _lw > 0) block.dataset.strokeWidth = String(_lw / 2);
          block.dataset.strokeV = '2';
        }
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
  // U6b: MCP 텍스트 수정은 평문 → 잔존 textHtml이 새 text를 가리지 않도록 제거(렌더 우선순위 정합).
  if (applied.text !== undefined) delete block.dataset.textHtml;

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
  _applyEnum('fontStyle', 'fontStyle', ['normal', 'italic']);
  // textDecoration — 토큰 순서 무관 수용: 'line-through underline'도 정순서로 정규화 후 적용.
  //   sort() = ['line-through','underline'] → reverse() = 정순서 'underline line-through'.
  //   단일 토큰/none은 sort·reverse가 no-op. 중복/미지 토큰은 allowed 불일치로 기존처럼 무시.
  if (typeof partial.textDecoration === 'string') {
    const _decoNorm = partial.textDecoration.trim().split(/\s+/).sort().reverse().join(' ');
    if (['none', 'underline', 'line-through', 'underline line-through'].includes(_decoNorm)) {
      block.dataset.textDecoration = _decoNorm;
      applied.textDecoration = _decoNorm;
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
  _applyNum('cornerRadius', 'cornerRadius', 0, 400);


  // 14-a) 박스 너비 (text shape 전용) — 'auto'(내용맞춤) 또는 고정 px(20~2000)
  if (partial.boxW !== undefined && partial.boxW !== null) {
    if (partial.boxW === 'auto' || partial.boxW === '') {
      block.dataset.boxW = 'auto';
      applied.boxW = 'auto';
    } else {
      const bw = Number(partial.boxW);
      if (Number.isFinite(bw) && bw >= 20 && bw <= 2000) {
        block.dataset.boxW = String(Math.round(bw));
        applied.boxW = Math.round(bw);
      }
    }
  }

  // 14-b) icon shape 전용 — iconColor / iconName / svg(iconSvg)
  _applyColor('iconColor', 'iconColor');
  if (partial.iconName !== undefined && partial.iconName !== null) {
    const nm = String(partial.iconName);
    if (nm.length <= 200) { block.dataset.iconName = nm; applied.iconName = nm; }
  }
  // svg / iconSvg — Iconify 교체 시 새 SVG 문자열 주입 (길이 sanity check)
  const _svgIn = (partial.iconSvg !== undefined && partial.iconSvg !== null) ? partial.iconSvg
               : ((partial.svg !== undefined && partial.svg !== null) ? partial.svg : undefined);
  if (_svgIn !== undefined) {
    const s = String(_svgIn);
    if (s.length <= 200000) { block.dataset.iconSvg = s; applied.iconSvg = s; }
  }

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

  try { rememberStickerStyle(block); } catch (_) {}
  window.scheduleAutoSave?.();

  const changedKeys = Object.keys(applied);
  return { ok: true, blockId, before, applied, changedKeys };
}

window.updateStickerBlock = updateStickerBlock;

// ── window 노출 ────────────────────────────────────────────────────────────
window.makeStickerBlock   = makeStickerBlock;
window.addStickerBlock    = addStickerBlock;
window.renderStickerBlock = renderStickerBlock;

export { makeStickerBlock, addStickerBlock, updateStickerBlock, renderStickerBlock, rememberStickerStyle, STICKER_DEFAULTS };
