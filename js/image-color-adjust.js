// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// image-color-adjust.js
// 이미지 색상 조정 패널 + SVG 필터 엔진
//
// 구조:
//   Display  : SVG feColorMatrix + feComponentTransfer (실시간 미리보기)
//   Export   : Canvas API로 bake → export-image.js에서 호출
//   Persistence: img.dataset.adj* 속성 (HTML 직렬화 자동 포함)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const FILTER_PREFIX = 'img-color-adj-';
const SVG_EL_ID     = 'img-color-adj-svg';

// ★색보정 «대상»은 술어 하나로만 정의한다 — 에셋 <img.asset-img> 와 카드 배경이미지 div(.cvb-card-img).
//   이 두 상수를 저장복원(save-load)·내보내기(export-image)가 그대로 재사용한다.
//   (예전엔 7개 속성 셀렉터가 3곳에 복사돼 있었고, 카드가 생기면 세 곳을 다 고쳐야 했다.)
const ADJ_KEYS       = ['exposure','contrast','saturation','temperature','tint','highlights','shadows'];
const ADJ_TARGET_SEL = '.asset-img, .cvb-card-img';
const ADJ_DIRTY_SEL  = ADJ_TARGET_SEL.split(',').map(s => s.trim())
  .flatMap(base => ADJ_KEYS.map(k => `${base}[data-adj-${k}]`)).join(', ');

const DEFAULTS = {
  exposure: 0, contrast: 0, saturation: 0,
  temperature: 0, tint: 0, highlights: 0, shadows: 0,
};

const SLIDERS = [
  { key: 'exposure',     label: '노출' },
  { key: 'contrast',     label: '대비' },
  { key: 'saturation',   label: '채도' },
  { key: 'temperature',  label: '색온도' },
  { key: 'tint',         label: '색조' },
  { key: 'highlights',   label: '하이라이트' },
  { key: 'shadows',      label: '그림자' },
];

// ─────────────────────────────────────────────
// SVG 필터 엔진
// ─────────────────────────────────────────────

// ★★필터는 «조정값 하나당 하나»다 — 전역 단일 필터였을 때는 이미지 2장에 서로 다른 값을 주면
//   둘 다 «마지막에 갱신된» 행렬로 그려졌다(url(#같은id) 를 공유하므로 구조적으로 필연).
//   에셋은 한 번에 한 장만 편집해 잘 안 드러났지만, 카드는 격자로 여러 장이 동시에 보여 바로 깨진다.
//   id 에 조정값을 인코딩해 «같은 값이면 공유·다른 값이면 별도» 가 되게 한다.
function _svgDefs() {
  let svg = document.getElementById(SVG_EL_ID);
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = SVG_EL_ID;
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
    svg.innerHTML = '<defs></defs>';
    document.body.appendChild(svg);
  }
  return svg.querySelector('defs');
}

/** 조정값 → CSS id 로 쓸 수 있는 서명(음수 m, 소수점 p) */
function _adjKey(adj) {
  return ADJ_KEYS.map(k => (Number(adj[k]) || 0).toFixed(3))
    .join('_').replace(/-/g, 'm').replace(/\./g, 'p');
}

// 슬라이더를 드래그하면 값마다 필터가 하나씩 생긴다 → 화면에서 참조되지 않는 것은 주기적으로 회수.
function _pruneFilters(defs) {
  if (defs.childElementCount <= 48) return;
  const used = new Set();
  document.querySelectorAll('[style*="' + FILTER_PREFIX + '"]').forEach(el => {
    const m = /url\(#(img-color-adj-[A-Za-z0-9_]+)\)/.exec(el.style.filter || '');
    if (m) used.add(m[1]);
  });
  [...defs.children].forEach(f => { if (!used.has(f.id)) f.remove(); });
}

/**
 * 조정값 전용 SVG 필터를 보장하고 그 id 를 돌려준다 (피그마 Skia 파이프라인 근사)
 * 순서: Exposure → Contrast → Temperature → Tint → Saturation → Highlights/Shadows
 */
function _ensureSVGFilter(adj) {
  const id = FILTER_PREFIX + _adjKey(adj);
  const defs = _svgDefs();
  if (document.getElementById(id)) return id;   // 같은 값이면 재사용 — 카드 격자에서 필터 폭증 방지
  _pruneFilters(defs);

  const { exposure=0, contrast=0, saturation=0,
          temperature=0, tint=0, highlights=0, shadows=0 } = adj;

  // ── 선형 행렬 퓨전 ──────────────────────────────
  const e  = Math.pow(2, exposure);               // EV: 2^E
  const c  = Math.max(0.01, 1 + contrast * 3.33); // -0.3~0.3 → -1~1
  const p  = 0.5 * (1 - c);                       // contrast pivot offset
  const s  = Math.max(0, 1 + saturation);
  const t  = temperature * 0.5;                    // R↑B↓ (채도 0.5 감쇠)
  const gK = Math.max(0.01, 1 + tint * 0.5);     // G 채널 스케일 (tint: 마젠타↔그린)

  const lr=0.2126, lg=0.7152, lb=0.0722;
  // ★★행렬이 «전치»돼 있었다(2026-09-05 실측, origin/dev 부터 존재).
  //   각 행이 (lr,lg,lb) 대신 «자기 행의 luma 계수 하나»를 세 칸에 다 써서, 채도 -100 을 주면
  //   빨강(255,0,0)이 회색이 아니라 «초록(54,182,18)»이 됐다. 내보내기는 canvas saturate(0) 라
  //   회색(54,54,54)으로 제대로 구워져서 «화면과 결과물이 서로 다른 색»이었다.
  //   표준 채도 행렬은 행마다 (lr,lg,lb) 를 쓴다:
  //     R' = (lr+(1-lr)s)R + (lg-lg·s)G   + (lb-lb·s)B
  //     G' = (lr-lr·s)R    + (lg+(1-lg)s)G + (lb-lb·s)B
  //     B' = (lr-lr·s)R    + (lg-lg·s)G   + (lb+(1-lb)s)B
  // ★그리고 exposure/contrast/temp/tint 는 채도 «뒤»에 오는 대각행렬이므로 «행 전체»에 곱해야 한다
  //   (예전엔 (1+t)/gK/(1-t) 가 대각 한 칸에만 붙어, 단색 입력이 아니면 색온도·색조도 틀렸다).
  const kR = c * e * (1 + t);
  const kG = c * e * gK;
  const kB = c * e * (1 - t);
  const rr = kR * (lr + (1-lr)*s), rg = kR * (lg - lg*s),     rb = kR * (lb - lb*s);
  const gr = kG * (lr - lr*s),     gg = kG * (lg + (1-lg)*s), gb = kG * (lb - lb*s);
  const br = kB * (lr - lr*s),     bg = kB * (lg - lg*s),     bb = kB * (lb + (1-lb)*s);

  const matrix =
    `${_f(rr)} ${_f(rg)} ${_f(rb)} 0 ${_f(p)} ` +
    `${_f(gr)} ${_f(gg)} ${_f(gb)} 0 ${_f(p)} ` +
    `${_f(br)} ${_f(bg)} ${_f(bb)} 0 ${_f(p)} ` +
    `0 0 0 1 0`;

  // ── Highlights / Shadows: 17점 tone-curve LUT ──
  const lut = Array.from({ length: 17 }, (_, i) => {
    const v  = i / 16;
    const hl = v > 0.5 ? ((v - 0.5) / 0.5) * highlights * 0.3 : 0;
    const sh = v < 0.5 ? ((0.5 - v) / 0.5) * shadows    * 0.3 : 0;
    return Math.min(1, Math.max(0, v + hl + sh)).toFixed(4);
  }).join(' ');

  const f = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  f.id = id;
  f.setAttribute('color-interpolation-filters', 'sRGB');
  f.setAttribute('x', '0'); f.setAttribute('y', '0');
  f.setAttribute('width', '100%'); f.setAttribute('height', '100%');
  f.innerHTML =
    `<feColorMatrix type="matrix" values="${matrix}"/>` +
    `<feComponentTransfer>` +
      `<feFuncR type="table" tableValues="${lut}"/>` +
      `<feFuncG type="table" tableValues="${lut}"/>` +
      `<feFuncB type="table" tableValues="${lut}"/>` +
    `</feComponentTransfer>`;
  defs.appendChild(f);
  return id;
}

function _f(n) { return n.toFixed(4); }

// ─────────────────────────────────────────────
// 필터 적용 / 저장
// ─────────────────────────────────────────────

function _isDefault(adj) {
  return Object.keys(DEFAULTS).every(k => Math.abs((adj[k] || 0)) < 0.001);
}

function _readAdj(img) {
  return {
    exposure:    parseFloat(img.dataset.adjExposure    ?? 0),
    contrast:    parseFloat(img.dataset.adjContrast    ?? 0),
    saturation:  parseFloat(img.dataset.adjSaturation  ?? 0),
    temperature: parseFloat(img.dataset.adjTemperature ?? 0),
    tint:        parseFloat(img.dataset.adjTint        ?? 0),
    highlights:  parseFloat(img.dataset.adjHighlights  ?? 0),
    shadows:     parseFloat(img.dataset.adjShadows     ?? 0),
  };
}

function _saveAdj(img, adj) {
  img.dataset.adjExposure    = adj.exposure.toFixed(3);
  img.dataset.adjContrast    = adj.contrast.toFixed(3);
  img.dataset.adjSaturation  = adj.saturation.toFixed(3);
  img.dataset.adjTemperature = adj.temperature.toFixed(3);
  img.dataset.adjTint        = adj.tint.toFixed(3);
  img.dataset.adjHighlights  = adj.highlights.toFixed(3);
  img.dataset.adjShadows     = adj.shadows.toFixed(3);
}

/**
 * 색보정 «대상» 하나에 조정 적용 (dataset 저장 + SVG filter)
 * @param {HTMLElement} img - <img.asset-img> 또는 배경이미지 div(.cvb-card-img).
 *   filter 는 배경이미지에도 그대로 걸리므로 두 경우 모두 같은 코드로 동작한다.
 */
function applyImgColorAdjust(img, adj) {
  if (!img) return;
  if (_isDefault(adj)) {
    // 기본값이면 흔적을 «지운다» — 남겨두면 저장본에 무의미한 data-adj-* 7개가 박히고,
    // 내보내기 bake 대상 목록에도 계속 걸린다.
    ADJ_KEYS.forEach(k => { delete img.dataset['adj' + k[0].toUpperCase() + k.slice(1)]; });
    img.style.filter = '';
    return;
  }
  _saveAdj(img, adj);
  img.style.filter = `url(#${_ensureSVGFilter(adj)})`;
}

/** 호스트(에셋블럭 / 카드 셀 / 카드 이미지 div)에서 색보정 «대상»을 찾는 술어 — 유일 정의 */
function findAdjTarget(host) {
  if (!host || !host.matches) return null;
  return host.matches(ADJ_TARGET_SEL) ? host : host.querySelector(ADJ_TARGET_SEL);
}

// ─────────────────────────────────────────────
// Export 헬퍼: Canvas API로 필터 bake
// (export-image.js에서 html2canvas 전에 호출)
// ─────────────────────────────────────────────

/**
 * adj 값을 Canvas ctx.filter CSS 문자열로 변환
 * Canvas 2D API ctx.filter는 CSS filter 함수를 완전 지원함
 */
function buildExportCSSFilter(adj) {
  const { exposure=0, contrast=0, saturation=0, temperature=0, tint=0 } = adj;
  const brightness = Math.pow(2, exposure);
  const contrastV  = Math.max(0.01, 1 + contrast * 3.33);
  const saturateV  = Math.max(0, 1 + saturation);
  // Temperature 근사: 따뜻→sepia+hue, 차가움→hue
  const sepiaAmt   = Math.max(0, temperature * 0.35);
  const hueTemp    = temperature >= 0 ? -temperature * 12 : Math.abs(temperature) * 18;
  const hueTint    = -tint * 9;
  const hueTotal   = hueTemp + hueTint;

  return [
    `brightness(${brightness.toFixed(3)})`,
    `contrast(${contrastV.toFixed(3)})`,
    `saturate(${saturateV.toFixed(3)})`,
    sepiaAmt > 0.001 ? `sepia(${sepiaAmt.toFixed(3)})` : '',
    Math.abs(hueTotal) > 0.5 ? `hue-rotate(${hueTotal.toFixed(1)}deg)` : '',
  ].filter(Boolean).join(' ');
}

/**
 * export-image.js에서 호출: 색상 조정이 적용된 img를 Canvas로 bake
 * html2canvas가 SVG filter url()을 지원하지 않으므로 export 전에 교체 필요
 * @param {HTMLImageElement} img - clone 내의 .asset-img
 * @returns {Promise<void>}
 */
// goya-asset:// → data: URI. 커스텀 스킴은 file:// 렌더러 기준 cross-origin 이라 캔버스를
// 오염시키고 crossOrigin 으로도 못 읽는다. export/스크래치와 같은 IPC 우회를 쓴다.
async function _toDrawableSrc(src) {
  const m = /^goya-asset:\/\/([^/]+)\/(.+)$/.exec(String(src || ''));
  if (!m || !window.electronAPI?.assetsReadAsDataUri) return String(src || '');
  try {
    const res = await window.electronAPI.assetsReadAsDataUri({
      projectId: decodeURIComponent(m[1]), filename: decodeURIComponent(m[2]),
    });
    return (res?.ok && res.dataUri) ? res.dataUri : String(src);
  } catch { return String(src); }
}

/** 배경이미지 div 의 url(...) 추출 — 카드 이미지는 <img> 가 아니라 background-image 다 */
function _bgUrl(el) {
  const m = /url\(\s*(['"]?)([^'")]+)\1\s*\)/.exec(el.style.backgroundImage || '');
  return m ? m[2] : '';
}

const _BAKE_MAX_SIDE = 4000;   // 픽셀루프(하이라이트/그림자) 메모리 상한

async function bakeImgFilterToCanvas(el) {
  const adj = _readAdj(el);
  if (_isDefault(adj)) return; // 조정값 없으면 skip

  const isImg = el.tagName === 'IMG';
  const rawSrc = isImg ? el.src : _bgUrl(el);
  if (!rawSrc) return;

  // 원본 이미지 로드 (이미 로드된 경우 즉시)
  // ★goya-asset:// 는 crossOrigin='anonymous' 로 «로드 자체가» 실패한다(실측 2026-09-03).
  //   그런데 아래 await 는 onerror 도 성공처럼 넘겨서, 깨진 이미지로 drawImage 를 부르고
  //   InvalidStateError 가 던져진다 → 색보정한 외부화 이미지가 든 섹션은 «PNG 내보내기가 통째로 죽는다».
  //   슬라이스와 같은 병(캔버스 오염)이라 같은 우회를 쓴다: assets:readAsDataUri IPC.
  const drawableSrc = await _toDrawableSrc(rawSrc);
  const imgObj = new Image();
  if (!drawableSrc.startsWith('data:')) imgObj.crossOrigin = 'anonymous';
  imgObj.src = drawableSrc;
  const loaded = await new Promise(res => { imgObj.onload = () => res(true); imgObj.onerror = () => res(false); });
  // ★못 읽었으면 «아무것도 안 한다» — 빈 캔버스로 갈아치우면 원본이 사라진다(조용한 데이터 손실).
  if (!loaded || !imgObj.naturalWidth) {
    console.warn('[color-adjust] 원본을 못 읽어 bake 생략 — 필터 없이 원본 유지:', String(rawSrc).slice(0, 80));
    return;
  }

  // ★굽는 «해상도»가 두 경우에 다르다.
  //   <img> : 표시 크기 그대로(기존 동작 보존 — objectFit 을 캔버스가 대신 못 하므로).
  //   배경div: «원본 해상도». 표시 크기로 구우면 background-size:cover 가 한 번 더 늘려
  //           이중 리샘플되고, imgScale/imgX/imgY 가 어긋난다. 원본 크기로 구워야
  //           background-size/position 을 그대로 두고 색만 바뀐다.
  let dw, dh;
  if (isImg) {
    dw = el.offsetWidth  || imgObj.naturalWidth  || 800;
    dh = el.offsetHeight || imgObj.naturalHeight || 600;
  } else {
    dw = imgObj.naturalWidth;
    dh = imgObj.naturalHeight;
    const over = Math.max(dw, dh) / _BAKE_MAX_SIDE;
    if (over > 1) { dw = Math.round(dw / over); dh = Math.round(dh / over); }
  }

  const canvas = document.createElement('canvas');
  canvas.width  = dw;
  canvas.height = dh;
  const ctx = canvas.getContext('2d');

  // Canvas 2D ctx.filter 적용 (brightness/contrast/saturate/sepia/hue-rotate)
  const cssFilter = buildExportCSSFilter(adj);
  if (cssFilter) ctx.filter = cssFilter;
  ctx.drawImage(imgObj, 0, 0, dw, dh);
  ctx.filter = 'none';

  // Highlights / Shadows: 픽셀 직접 조작 (Canvas ctx.filter로 표현 불가)
  const { highlights=0, shadows=0 } = adj;
  if (Math.abs(highlights) > 0.001 || Math.abs(shadows) > 0.001) {
    const imgData = ctx.getImageData(0, 0, dw, dh);
    const px = imgData.data;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i]/255, g = px[i+1]/255, b = px[i+2]/255;
      const luma = 0.2126*r + 0.7152*g + 0.0722*b;
      const hl = luma > 0.5 ? ((luma-0.5)/0.5) * highlights * 0.3 : 0;
      const sh = luma < 0.5 ? ((0.5-luma)/0.5) * shadows    * 0.3 : 0;
      const d = hl + sh;
      px[i]   = Math.min(255, Math.max(0, Math.round(px[i]   + d*255)));
      px[i+1] = Math.min(255, Math.max(0, Math.round(px[i+1] + d*255)));
      px[i+2] = Math.min(255, Math.max(0, Math.round(px[i+2] + d*255)));
    }
    ctx.putImageData(imgData, 0, 0);
  }

  if (isImg) {
    // img를 canvas로 교체 (style 복사)
    canvas.style.cssText   = el.style.cssText;
    canvas.style.filter    = '';
    canvas.style.objectFit = '';
    canvas.style.display   = 'block';
    el.parentNode?.replaceChild(canvas, el);
  } else {
    // 배경이미지 div: «구운 그림으로 배경만 갈아끼운다».
    // 엘리먼트를 교체하면 라운드/클립/텍스트 오버레이 같은 형제 스타일이 함께 날아간다.
    let baked;
    try { baked = canvas.toDataURL('image/png'); }
    catch (err) {
      console.warn('[color-adjust] canvas 오염으로 bake 생략 — 원본 유지:', err?.message);
      return;
    }
    el.style.backgroundImage = `url("${baked}")`;
    el.style.filter = '';
  }
}

window.bakeImgFilterToCanvas = bakeImgFilterToCanvas;

// ─────────────────────────────────────────────
// 색상 조정 패널 UI
// ─────────────────────────────────────────────

let _currentAb = null;
let _onChange  = null;   // 카드처럼 dataset 이 재렌더로 날아가는 대상의 «되쓰기» 훅

function _buildPanelHTML(adj) {
  const rows = SLIDERS.map(({ key, label }) => {
    const val = Math.round((adj[key] || 0) * 100);
    return `
      <div class="prop-row">
        <span class="prop-label ca-label">${label}</span>
        <input type="range"  class="prop-slider" id="ca-${key}" min="-100" max="100" step="1" value="${val}">
        <input type="number" class="prop-number"  id="ca-${key}-num" min="-100" max="100" value="${val}" style="width:40px">
      </div>`;
  }).join('');

  return `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke="#888" stroke-width="1.2"/>
            <path d="M6 2v1M6 9v1M2 6h1M9 6h1M3.17 3.17l.7.7M8.13 8.13l.7.7M3.17 8.83l.7-.7M8.13 3.87l.7-.7"
              stroke="#888" stroke-width="1.1" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="prop-block-name">색상 조정</span>
      </div>
      ${rows}
      <div style="padding-top:4px">
        <button class="prop-export-btn" id="ca-reset-btn"
          style="background:var(--ui-bg-input);color:var(--ui-text-sub);border:1px solid var(--ui-border-mid);">
          초기화
        </button>
      </div>
    </div>`;
}

function _bindSliders(img) {
  SLIDERS.forEach(({ key }) => {
    const slider = document.getElementById(`ca-${key}`);
    const numEl  = document.getElementById(`ca-${key}-num`);
    if (!slider || !numEl) return;

    const update = v => {
      slider.value = v;
      numEl.value  = v;
      const adj = _readAdj(img);
      adj[key] = v / 100;
      applyImgColorAdjust(img, adj);
      _onChange?.(adj);
      window.scheduleAutoSave?.();
    };

    slider.addEventListener('input', () => update(parseInt(slider.value)));
    numEl.addEventListener('input', () => {
      const v = Math.min(100, Math.max(-100, parseInt(numEl.value) || 0));
      update(v);
    });
  });

  const resetBtn = document.getElementById('ca-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      applyImgColorAdjust(img, { ...DEFAULTS });
      _onChange?.({ ...DEFAULTS });
      SLIDERS.forEach(({ key }) => {
        const sl = document.getElementById(`ca-${key}`);
        const nu = document.getElementById(`ca-${key}-num`);
        if (sl) sl.value = 0;
        if (nu) nu.value = 0;
      });
      window.scheduleAutoSave?.();
    });
  }
}

// ─────────────────────────────────────────────
// 플로팅 패널 드래그
// ─────────────────────────────────────────────

let _panelPos = null; // { right, top } — null = 기본 CSS 위치 사용

function _initPanelDrag() {
  const panel  = document.getElementById('color-adjust-panel');
  const header = document.getElementById('color-adjust-header');
  const closeBtn = document.getElementById('color-adjust-close');
  if (!panel || !header) return;

  if (closeBtn) {
    closeBtn.addEventListener('click', e => {
      e.stopPropagation();
      hideColorAdjustPanel();
    });
  }

  let dragging = false;
  let startX, startY, startLeft, startTop;

  header.addEventListener('mousedown', e => {
    if (e.target === closeBtn) return;
    e.preventDefault();
    dragging = true;

    // fixed 좌표로 전환 (right/bottom → left/top 방식으로 드래그 처리)
    const rect = panel.getBoundingClientRect();
    panel.style.left   = rect.left + 'px';
    panel.style.top    = rect.top  + 'px';
    panel.style.right  = 'auto';
    panel.style.bottom = 'auto';
    startX    = e.clientX;
    startY    = e.clientY;
    startLeft = rect.left;
    startTop  = rect.top;

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  function onMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const newLeft = startLeft + dx;
    const newTop  = Math.max(0, startTop  + dy);
    panel.style.left = newLeft + 'px';
    panel.style.top  = newTop  + 'px';
    _panelPos = { left: newLeft, top: newTop };
  }

  function onUp() {
    dragging = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }
}

/**
 * @param {HTMLElement} host - 에셋블럭(.asset-block) 또는 카드 이미지 div(.cvb-card-img)
 * @param {{onChange?:(adj:object)=>void}} [opts] - 조정이 바뀔 때마다 호출.
 *   카드는 DOM dataset 이 재렌더로 날아가므로 이 훅으로 block.dataset.cards 에 되쓴다.
 */
function showColorAdjustPanel(host, opts = {}) {
  const panel = document.getElementById('color-adjust-panel');
  const body  = document.getElementById('color-adjust-body');
  if (!panel || !body) return;

  const img = findAdjTarget(host);
  if (!img) return;
  _currentAb = host;
  _onChange  = typeof opts.onChange === 'function' ? opts.onChange : null;

  // 편집 시작 전 스냅샷 저장 → Cmd+Z로 색상 조정 전체 취소 가능
  window.pushHistory?.('색상 조정');

  const adj = _readAdj(img);
  body.innerHTML = _buildPanelHTML(adj);

  // 드래그로 이동한 위치가 있으면 복원, 없으면 기본 CSS 위치
  if (_panelPos) {
    panel.style.left   = _panelPos.left + 'px';
    panel.style.top    = _panelPos.top  + 'px';
    panel.style.right  = 'auto';
    panel.style.bottom = 'auto';
  } else {
    panel.style.left   = '';
    panel.style.top    = '';
    panel.style.right  = '';
    panel.style.bottom = '';
  }

  panel.style.display = 'flex';

  // 이미 적용된 필터가 있으면 SVG 필터 노드가 살아있는지 보장
  if (!_isDefault(adj)) _ensureSVGFilter(adj);

  _bindSliders(img);
}

function hideColorAdjustPanel() {
  const panel = document.getElementById('color-adjust-panel');
  if (panel) panel.style.display = 'none';
  _currentAb = null;
  _onChange  = null;
}

// DOM 준비 후 드래그 초기화
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initPanelDrag);
} else {
  _initPanelDrag();
}

// 외부에서 이미지 로드 시 저장된 adj 복원 (loadImageToAsset 후 호출)
function restoreImgColorAdjust(img) {
  const adj = _readAdj(img);
  if (_isDefault(adj)) return;
  img.style.filter = `url(#${_ensureSVGFilter(adj)})`;
}

window.ADJ_DIRTY_SEL         = ADJ_DIRTY_SEL;   // ★저장복원·내보내기가 «같은 술어»를 쓴다
window.findAdjTarget         = findAdjTarget;
window.showColorAdjustPanel  = showColorAdjustPanel;
window.hideColorAdjustPanel  = hideColorAdjustPanel;
window.applyImgColorAdjust   = applyImgColorAdjust;
window.restoreImgColorAdjust = restoreImgColorAdjust;
window.bakeImgFilterToCanvas = bakeImgFilterToCanvas;
