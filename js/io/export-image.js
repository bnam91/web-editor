import { canvasEl, state } from '../globals.js';

const CANVAS_W = 860;
const GIF_MAX_FRAMES = 60; // 메모리/시간 안전한도 (한 GIF당)

/* ─── GIF 유틸 ─────────────────────────────────────────────────────────
 * GIF (정적/애니메이션) 내보내기 헬퍼들.
 * - decodeGifFrames: ImageDecoder API로 GIF 모든 frame을 추출
 *   (Chromium 94+ / Electron 모두 지원). 각 frame을 data URL로 반환.
 * - findGifElements: 섹션 클론 안에서 GIF가 들어간 <img> 또는
 *   background-image 요소를 모두 수집.
 * - canvasToGifBlob: 단일/다중 frame canvas 배열을 gif.js로 GIF blob 생성.
 * ──────────────────────────────────────────────────────────────────── */

async function _fetchAsArrayBuffer(url) {
  // data: URL도 fetch가 처리해줌
  const res = await fetch(url);
  if (!res.ok) throw new Error('GIF fetch failed: ' + res.status);
  return await res.arrayBuffer();
}

async function decodeGifFrames(url, opts = {}) {
  // ImageDecoder가 없으면 single-frame fallback
  if (typeof ImageDecoder !== 'function') {
    return [{ url, delay: 100, single: true }];
  }
  try {
    const buf = await _fetchAsArrayBuffer(url);
    const decoder = new ImageDecoder({ data: buf, type: 'image/gif' });
    await decoder.tracks.ready;
    const track = decoder.tracks.selectedTrack;
    const frameCount = track?.frameCount || 1;
    const maxFrames = Math.min(frameCount, opts.maxFrames || GIF_MAX_FRAMES);

    const frames = [];
    for (let i = 0; i < maxFrames; i++) {
      const { image } = await decoder.decode({ frameIndex: i });
      const w = image.displayWidth || image.codedWidth;
      const h = image.displayHeight || image.codedHeight;
      const cvs = document.createElement('canvas');
      cvs.width = w;
      cvs.height = h;
      cvs.getContext('2d').drawImage(image, 0, 0);
      // delay: microseconds → ms. 0 이면 보통 100ms 기본값
      const dur = image.duration ? Math.round(image.duration / 1000) : 100;
      frames.push({
        dataURL: cvs.toDataURL('image/png'),
        delay: Math.max(20, dur),
        width: w,
        height: h,
      });
      image.close?.();
    }
    decoder.close?.();
    return frames;
  } catch (err) {
    console.warn('[GIF] decodeGifFrames failed, fallback single frame:', err);
    return [{ url, delay: 100, single: true }];
  }
}

// 확장자/MIME으로 빠르게 판정 가능한 경우만 동기 필터링
function _isLikelyGifByName(url) {
  return /\.gif(\?|$|#|"|')|data:image\/gif/i.test(url || '');
}

// blob:/file:/http: 등 확장자 없는 URL은 fetch로 Content-Type 확인 (HEAD)
async function _isGifByFetch(url) {
  if (!url) return false;
  if (_isLikelyGifByName(url)) return true;
  try {
    // HEAD가 거부될 수 있으니 GET으로 blob을 받아 type 확인
    const res = await fetch(url);
    if (!res.ok) return false;
    const b = await res.blob();
    return b.type === 'image/gif';
  } catch {
    return false;
  }
}

async function findGifElements(root) {
  // <img>
  const imgCandidates = [...root.querySelectorAll('img')];
  const imgs = [];
  for (const im of imgCandidates) {
    const src = im.src || im.getAttribute('src') || '';
    if (!src) continue;
    if (await _isGifByFetch(src)) imgs.push(im);
  }
  // [style*="background-image"]
  const bgCandidates = [...root.querySelectorAll('[style*="background-image"]')];
  const bgs = [];
  for (const el of bgCandidates) {
    const u = _gifBgUrl(el.style.backgroundImage);
    if (!u) continue;
    if (await _isGifByFetch(u)) bgs.push(el);
  }
  return { imgs, bgs };
}

function _gifBgUrl(bgValue) {
  const m = (bgValue || '').match(/url\(["']?([^"')]+)["']?\)/);
  return m ? m[1] : null;
}

async function canvasToGifBlob(canvases, delays, opts = {}) {
  // canvases: HTMLCanvasElement[] (다중) — 모두 같은 width/height
  // delays:   number[] (ms) — canvases.length 와 동일
  if (typeof GIF !== 'function') {
    throw new Error('GIF library not loaded');
  }
  const first = canvases[0];
  const gif = new GIF({
    workers:      2,
    quality:      10,
    width:        first.width,
    height:       first.height,
    workerScript: 'js/gif.worker.js',
    repeat:       opts.repeat ?? 0, // 0 = 무한루프, -1 = 1회
    background:   opts.background || '#ffffff',
  });
  for (let i = 0; i < canvases.length; i++) {
    gif.addFrame(canvases[i], { copy: true, delay: delays[i] || 100 });
  }
  if (opts.onProgress) gif.on('progress', opts.onProgress);
  return await new Promise((res, rej) => {
    gif.on('finished', blob => res(blob));
    gif.on('error',    err  => rej(err));
    gif.render();
  });
}


// cvb(canvas-block)의 CSS transform:scale()을 실제 px 값으로 평탄화
// html2canvas는 transform:scale() 안쪽 background-image를 잘못 렌더링함
function flattenCvbTransform(cvbEl) {
  const inner = cvbEl.querySelector('.cvb-inner');
  if (!inner) return;
  const match = (inner.style.transform || '').match(/scale\(([^)]+)\)/);
  if (!match) return;
  const s = parseFloat(match[1]);
  if (!s || s === 1) return;

  // 순수 px 단위 값만 스케일 (%, 단위없는 값, 복합 shorthand 제외)
  // 예: "48px" → 스케일, "1.3"(line-height) → 건드리지 않음, "100%" → 건드리지 않음
  const scalePx = (style, props) => props.forEach(p => {
    if (!style[p] || !/^[\d.]+px$/.test(style[p].trim())) return;
    style[p] = (parseFloat(style[p]) * s) + 'px';
  });

  Array.from(inner.children).forEach(cell => {
    scalePx(cell.style, ['left', 'top', 'width', 'height', 'borderRadius']);
    Array.from(cell.children).forEach(child => {
      scalePx(child.style, ['left', 'top', 'width', 'height',
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'gap', 'borderRadius', 'fontSize']);
      child.querySelectorAll('[style]').forEach(el =>
        scalePx(el.style, ['fontSize', 'left', 'top', 'width', 'height', 'lineHeight', 'gap', 'borderRadius'])
      );
    });
  });

  inner.style.width     = (parseFloat(inner.style.width)  * s) + 'px';
  inner.style.height    = (parseFloat(inner.style.height) * s) + 'px';
  inner.style.transform = 'none';
  cvbEl.style.height    = inner.style.height;
}

async function exportSection(sec, format, width, opts) {
  const fmt = format || 'png';
  const w   = width  || CANVAS_W;
  const isGif     = fmt === 'gif' || fmt === 'gif-anim';
  const isGifAnim = fmt === 'gif-anim';

  // 클론을 transform 밖(body)에 배치해서 html2canvas가 부모 scale 영향 안 받게 함
  const clone = sec.cloneNode(true);
  const cloneLabel   = clone.querySelector('.section-label');
  const cloneToolbar = clone.querySelector('.section-toolbar');
  if (cloneLabel)   cloneLabel.remove();
  if (cloneToolbar) cloneToolbar.remove();
  clone.querySelectorAll('.variation-badge').forEach(el => el.remove());
  // C18: 펜툴 어노테이션(리뷰용 주석)과 진행중 미리보기는 리뷰 표시일 뿐 — export 산출 이미지에 박히면 안 됨.
  // (대조: todo-pin은 #todo-pin-overlay로 섹션 밖이라 애초에 export 클론에 안 들어감)
  clone.querySelectorAll('.annotation-block, .annot-preview').forEach(el => el.remove());
  // 미입력 placeholder 안내문구는 export 결과에 박히면 안 됨.
  // data-is-placeholder="true"는 실제 글자가 들어가면 즉시 삭제되므로,
  // 클론에 true로 남은 요소는 미입력 placeholder가 확정 → 안내문구 가시성만
  // 숨겨 자식 DOM(<li>/<span> 등)과 점유 높이는 그대로 두고 글자만 렌더에서 사라지게 함.
  // (textContent='' 는 tb-bullet의 <li> 등 자식 DOM을 통째로 제거해 height가
  //  collapse되므로 금지. visibility:hidden은 자식·list marker까지 함께 숨기되 박스 높이 유지.)
  clone.querySelectorAll('[data-is-placeholder="true"]').forEach(el => {
    el.style.visibility = 'hidden';
  });
  clone.classList.remove('selected');
  // 자식 블록의 UI 상태 클래스 전부 제거 (outline, dashed border, opacity 등 내보내기 오염 방지)
  clone.querySelectorAll(
    '.selected, .img-editing, .editing, .dragging, .group-selected, .group-editing, .ss-drag-over, .drag-over'
  ).forEach(el => {
    el.classList.remove('selected', 'img-editing', 'editing', 'dragging',
      'group-selected', 'group-editing', 'ss-drag-over', 'drag-over');
  });
  // CDP captureBeyondViewport로 off-screen 좌표도 캡쳐 가능 — clone을 화면 밖에 두어
  // export 중 사용자 화면에 큰 박스가 튀어나오는 "ghosting" 현상 제거
  const useNative = !(opts && opts.forceH2C) && !!window.electronAPI?.captureSection;
  clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:' + w + 'px;margin:0;outline:none;';

  // P1 우회 부수 안정성: clone 자체를 stacking context로 격리 + 부모 transform 영향 차단
  // (sec_fdm1dzu처럼 자체 stacking context인 섹션 외에도 일관성 보장)
  if (useNative) {
    clone.style.isolation = clone.style.isolation || 'isolate';
    clone.style.transform = 'none';
  }

  document.body.appendChild(clone);

  // html2canvas는 CSS `inset` shorthand를 지원하지 않음
  // clone 전체에서 inset → top/right/bottom/left 명시적 변환
  clone.querySelectorAll('[style]').forEach(el => {
    if (!el.style.inset) return;
    const parts = el.style.inset.trim().split(/\s+/);
    const [t, r, b, l] = parts.length === 1 ? [parts[0], parts[0], parts[0], parts[0]]
                       : parts.length === 2 ? [parts[0], parts[1], parts[0], parts[1]]
                       : parts.length === 3 ? [parts[0], parts[1], parts[2], parts[1]]
                       : parts;
    el.style.inset = '';
    if (t !== 'auto') el.style.top    = t;
    if (r !== 'auto') el.style.right  = r;
    if (b !== 'auto') el.style.bottom = b;
    if (l !== 'auto') el.style.left   = l;
  });

  // 버그 2 fix: 폰트 완전 로드 대기
  // html2canvas가 폰트 로드 전에 렌더링하면 fallback 폰트 메트릭스로
  // 줄바꿈 위치가 달라짐 → document.fonts.ready로 모든 폰트 로드 완료 보장
  await document.fonts.ready;

  // 레이아웃 강제 확정 (offsetWidth/Height 정확도)
  clone.getBoundingClientRect();

  // cvb(canvas-block): renderCanvas로 scale 재계산 후 transform 평탄화
  // html2canvas가 transform:scale() 내부 background-image를 잘못 렌더링하므로
  // 실제 px 값으로 변환하여 transform 제거
  // forEach 대신 for...of 사용 (내부에서 await 필요)
  for (const cb of clone.querySelectorAll('.canvas-block[data-card-mode]')) {
    if (window.renderCanvas) {
      window.renderCanvas(cb);
      if (cb._cvbRO) { cb._cvbRO.disconnect(); cb._cvbRO = null; }
    }

    // renderCanvas가 cssText에 right:auto;bottom:auto를 포함시켜 브라우저가
    // inset 단축 속성으로 재직렬화함 → html2canvas 파싱 오류 방지를 위해 재변환
    cb.querySelectorAll('[style]').forEach(el => {
      if (!el.style.inset) return;
      const parts = el.style.inset.trim().split(/\s+/);
      const [t, r, b, l] = parts.length === 1 ? [parts[0], parts[0], parts[0], parts[0]]
                         : parts.length === 2 ? [parts[0], parts[1], parts[0], parts[1]]
                         : parts.length === 3 ? [parts[0], parts[1], parts[2], parts[1]]
                         : parts;
      el.style.inset = '';
      if (t !== 'auto') el.style.top    = t;
      if (r !== 'auto') el.style.right  = r;
      if (b !== 'auto') el.style.bottom = b;
      if (l !== 'auto') el.style.left   = l;
    });

    // flattenCvbTransform 전에 scale 값 캡처 (transform 제거 전)
    const cvbInnerEl = cb.querySelector('.cvb-inner');
    const cvbScaleMatch = (cvbInnerEl?.style.transform || '').match(/scale\(([^)]+)\)/);
    const cvbScale = cvbScaleMatch ? parseFloat(cvbScaleMatch[1]) : 1;

    flattenCvbTransform(cb);
    cb.getBoundingClientRect(); // flattenCvbTransform 후 레이아웃 재확정

    // html2canvas는 transform:scale() 내부의 background-image를 렌더링 못 함
    // background-image div → <canvas>로 직접 drawImage (html2canvas가 canvas 태그는 완벽 지원)
    const inner = cb.querySelector('.cvb-inner');
    if (inner) {
      // html2canvas가 box-shadow:inset을 solid fill로 잘못 렌더링
      // → border로 교체. spread는 디자인 좌표계 값이므로 cvbScale 곱해서 실제 px 맞춤
      inner.querySelectorAll('[style*="box-shadow"]').forEach(el => {
        const bs = el.style.boxShadow;
        // "rgb(240,70,70) 0px 0px 0px 16px inset" 패턴 파싱
        const m = bs.match(/^(rgba?\([^)]+\)|#\w+|\w+)\s+0px\s+0px\s+0px\s+([\d.]+)px\s+inset/);
        if (!m) return;
        const color = m[1], spread = parseFloat(m[2]) * cvbScale;
        el.style.boxShadow = '';
        el.style.border = `${spread}px solid ${color}`;
        el.style.boxSizing = 'border-box';
        el.style.background = el.style.background || 'transparent';
      });

      const bgDivs = [...inner.querySelectorAll('[style*="background-image"]')];
      for (const div of bgDivs) {
        const bg = div.style.backgroundImage;
        const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
        if (!match) continue;

        const divW = div.offsetWidth  || 400;
        const divH = div.offsetHeight || 300;

        // <canvas>로 직접 drawImage → html2canvas가 canvas 태그는 완벽 지원
        const cvs = document.createElement('canvas');
        cvs.width  = divW;
        cvs.height = divH;
        const ctx2 = cvs.getContext('2d');

        const imgObj = new Image();
        imgObj.src = match[1];
        await new Promise(res => { imgObj.onload = imgObj.onerror = res; });

        // background-size:cover 수동 계산
        const scale = Math.max(divW / imgObj.naturalWidth, divH / imgObj.naturalHeight);
        const sw = imgObj.naturalWidth  * scale;
        const sh = imgObj.naturalHeight * scale;
        // background-position을 % → px offset으로 변환
        const px = parseFloat(div.style.backgroundPositionX) || 50;
        const py = parseFloat(div.style.backgroundPositionY) || 50;
        const ox = -((sw - divW) * px / 100);
        const oy = -((sh - divH) * py / 100);
        ctx2.drawImage(imgObj, ox, oy, sw, sh);

        cvs.style.cssText = 'display:block;';
        // GIF 애니메이션 export 시 frame별 재렌더링용 메타데이터
        if (/\.gif(\?|$|#|"|')|data:image\/gif/i.test(match[1])) {
          cvs.dataset.gifSrc = match[1];
          cvs.dataset.bgCoverW = String(divW);
          cvs.dataset.bgCoverH = String(divH);
          cvs.dataset.bgPx = String(px);
          cvs.dataset.bgPy = String(py);
        }
        div.style.backgroundImage = '';
        // div 내용을 canvas로 교체
        div.innerHTML = '';
        div.appendChild(cvs);
      }
    }
  }

  // banner02-block: canvas-block과 동일한 transform:scale() 트릭 → export 시 px 평탄화 + bg-image→canvas
  for (const bn of clone.querySelectorAll('.banner02-block')) {
    if (window.renderBanner02) { window.renderBanner02(bn); if (bn._bn2RO) { bn._bn2RO.disconnect(); bn._bn2RO = null; } }
    const inner = bn.querySelector('.bn2-inner');
    if (!inner) continue;
    const m = (inner.style.transform || '').match(/scale\(([^)]+)\)/);
    const s = m ? parseFloat(m[1]) : 1;
    bn.getBoundingClientRect();
    if (s && s !== 1) {
      const scalePx = (st, props) => props.forEach(p => {
        if (st[p] && /^[\d.]+px$/.test(st[p].trim())) st[p] = (parseFloat(st[p]) * s) + 'px';
      });
      inner.querySelectorAll('[style]').forEach(el =>
        scalePx(el.style, ['left', 'top', 'width', 'height', 'fontSize', 'marginTop', 'borderRadius']));
      inner.style.width  = (parseFloat(inner.style.width)  * s) + 'px';
      inner.style.height = (parseFloat(inner.style.height) * s) + 'px';
      inner.style.transform = 'none';
      bn.style.height = inner.style.height;
    }
    // bg-image div(.bn2-img) → canvas (html2canvas가 scale 내부 bg-image 못 그림)
    for (const div of inner.querySelectorAll('[style*="background-image"]')) {
      const mm = (div.style.backgroundImage || '').match(/url\(["']?([^"')]+)["']?\)/);
      if (!mm) continue;
      const dw = div.offsetWidth || 200, dh = div.offsetHeight || 200;
      const cvs = document.createElement('canvas'); cvs.width = dw; cvs.height = dh;
      const ctx2 = cvs.getContext('2d');
      const img = new Image(); img.src = mm[1];
      await new Promise(r => { img.onload = img.onerror = r; });
      const cover = (div.style.backgroundSize || 'cover').includes('contain')
        ? Math.min(dw / img.naturalWidth, dh / img.naturalHeight)
        : Math.max(dw / img.naturalWidth, dh / img.naturalHeight);
      const sw = img.naturalWidth * cover, sh = img.naturalHeight * cover;
      ctx2.drawImage(img, (dw - sw) / 2, (dh - sh) / 2, sw, sh);
      cvs.style.cssText = 'display:block;width:100%;height:100%;';
      div.style.backgroundImage = ''; div.innerHTML = ''; div.appendChild(cvs);
    }
  }

  // comparison-block: scale 평탄화 (텍스트 기반이라 bg-image 변환 불필요, overflow visible로 shadow 보존)
  for (const cmp of clone.querySelectorAll('.comparison-block')) {
    if (window.renderComparison) { window.renderComparison(cmp); if (cmp._cmpRO) { cmp._cmpRO.disconnect(); cmp._cmpRO = null; } }
    const inner = cmp.querySelector('.cmp-inner');
    if (!inner) continue;
    const m = (inner.style.transform || '').match(/scale\(([^)]+)\)/);
    const s = m ? parseFloat(m[1]) : 1;
    cmp.getBoundingClientRect();
    if (s && s !== 1) {
      const scalePx = (st, props) => props.forEach(p => {
        if (st[p] && /^[\d.]+px$/.test(st[p].trim())) st[p] = (parseFloat(st[p]) * s) + 'px';
      });
      inner.querySelectorAll('[style]').forEach(el =>
        scalePx(el.style, ['left', 'top', 'width', 'height', 'fontSize', 'marginTop', 'borderRadius']));
      inner.style.width  = (parseFloat(inner.style.width)  * s) + 'px';
      inner.style.height = (parseFloat(inner.style.height) * s) + 'px';
      inner.style.transform = 'none';
      cmp.style.height = inner.style.height;
    }
  }

  // 색상 조정 필터가 적용된 img → Canvas로 bake
  // html2canvas는 SVG filter url()을 지원하지 않으므로 사전 변환 필요
  if (window.bakeImgFilterToCanvas) {
    for (const img of clone.querySelectorAll('.asset-img[data-adj-exposure], .asset-img[data-adj-contrast], .asset-img[data-adj-saturation], .asset-img[data-adj-temperature], .asset-img[data-adj-tint], .asset-img[data-adj-highlights], .asset-img[data-adj-shadows]')) {
      await window.bakeImgFilterToCanvas(img);
    }
  }

  // 섹션 배경: 라이브 getComputedStyle 우선. 흰색이 inline style이 아니라
  // `.section-block { background:#fff }` 클래스에서 오는 섹션은, inline bg가 없다고
  // pageSettings.bg(#acacac 회색)로 폴백하면 흰 섹션이 회색으로 export되는 버그가 있었음.
  // (Figma builder 65faf33과 동일 원리.) → 라이브 computed bg가 불투명이면 그 색을 쓰고,
  // 진짜 투명(alpha=0)일 때만 pageSettings.bg 폴백.
  const _liveBg  = getComputedStyle(sec).backgroundColor || '';
  const _bgm     = _liveBg.match(/^rgba?\(([^)]+)\)/);
  const _bgAlpha = _bgm ? (_bgm[1].split(',').map(s => parseFloat(s))[3] ?? 1) : 1;
  const bgColor  = (_bgm && _bgAlpha !== 0) ? _liveBg : (state.pageSettings.bg || '#ffffff');

  const secList = [...canvasEl.querySelectorAll('.section-block:not([data-ghost])')];
  const idx     = secList.indexOf(sec) + 1;
  const name    = (sec._name || `section-${String(idx).padStart(2,'0')}`).replace(/\s+/g, '-');

  // 클론을 한 번 fully-render 한 뒤 캔버스로 캡처해 돌려주는 헬퍼.
  // (animated GIF는 frame별로 여러 번 호출)
  //
  // P1 fix (2026-05-21): 기존 청크 캡쳐 루프(clone.style.top = -y → capturePage 반복) 폐기.
  // 청크 사이 compositor commit 미보장으로 직전 frame이 재사용되어 동일 내용이
  // 두 번 캡쳐되는 동기화 버그가 있었음.
  // → CDP Page.captureScreenshot + captureBeyondViewport:true 한 번 호출로 교체.
  const captureCloneToCanvas = async () => {
    if (useNative) {
      clone.style.background = clone.style.background || bgColor;
      await document.fonts.ready;
      clone.getBoundingClientRect();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const secH = clone.offsetHeight;
      const dpr  = window.devicePixelRatio || 2;
      let pngBase64;
      if (window.electronAPI.captureSectionCdp) {
        // clone은 top:-99999px(off-screen)에 위치 — clip.y를 그 좌표로 전달해 캡쳐
        const cloneRect = clone.getBoundingClientRect();
        pngBase64 = await window.electronAPI.captureSectionCdp({
          x: Math.round(cloneRect.left),
          y: Math.round(cloneRect.top),
          width: w,
          height: secH,
        });
      } else {
        // 구버전 Electron(메인 프로세스 미업데이트) 호환을 위한 명시적 실패
        throw new Error('captureSectionCdp 미지원 — Electron 재빌드 필요');
      }
      const outCanvas = document.createElement('canvas');
      outCanvas.width  = Math.round(w    * dpr);
      outCanvas.height = Math.round(secH * dpr);
      const ctx = outCanvas.getContext('2d');
      await new Promise((res, rej) => {
        const ci = new Image();
        ci.onload  = () => { ctx.drawImage(ci, 0, 0); res(); };
        ci.onerror = rej;
        ci.src = 'data:image/png;base64,' + pngBase64;
      });
      return outCanvas;
    }
    // html2canvas 폴백
    return await html2canvas(clone, {
      scale: 1,
      useCORS: true,
      backgroundColor: bgColor,
      logging: false,
    });
  };

  const triggerDownload = (blob, ext) => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url;
    a.download = `${name}.${ext}`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Electron 다운로드는 비동기 — 즉시 revoke 시 핸들러가 URL 못 읽는 케이스 방지
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  try {
    if (!isGif) {
      // ── 기존 PNG/JPG 경로 ────────────────────────────────────────
      const outCanvas = await captureCloneToCanvas();
      // 채점용: 다운로드 대신 dataURL 반환 (goditor ground-truth 캡처)
      if (opts && opts.returnDataUrl) {
        return outCanvas.toDataURL('image/png'); // clone 정리는 함수 끝 finally가 수행
      }
      const mime = fmt === 'jpg' ? 'image/jpeg' : 'image/png';
      const ext  = fmt === 'jpg' ? 'jpg' : 'png';
      await new Promise((res, rej) => {
        outCanvas.toBlob(blob => {
          if (!blob) { rej(new Error('toBlob failed')); return; }
          triggerDownload(blob, ext);
          res();
        }, mime, 0.95);
      });
      return;
    }

    // ── GIF 경로 (정적 / 애니메이션) ──────────────────────────────
    // 클론 내 GIF 원본 수집 (cvb 변환으로 canvas가 된 곳 + 일반 img + 일반 bg)
    // findGifElements는 blob:/file: 등 확장자 없는 URL을 위해 비동기로 type 검사
    const { imgs: gifImgs, bgs: gifBgs } = isGifAnim
      ? await findGifElements(clone)
      : { imgs: [], bgs: [] };
    const gifCanvases = [...clone.querySelectorAll('canvas[data-gif-src]')];

    // GIF 소스 URL 후보 (중복 제거)
    const sourceUrls = new Set();
    gifImgs.forEach(im => sourceUrls.add(im.src));
    gifBgs.forEach(el => {
      const u = _gifBgUrl(el.style.backgroundImage);
      if (u) sourceUrls.add(u);
    });
    gifCanvases.forEach(cv => sourceUrls.add(cv.dataset.gifSrc));

    // 애니메이션 모드인데 GIF 원본이 하나도 없으면 정적 GIF로 자동 폴백
    const effectiveAnim = isGifAnim && sourceUrls.size > 0;

    if (!effectiveAnim) {
      // ── 정적 GIF (단일 frame) ───────────────────────────────
      const outCanvas = await captureCloneToCanvas();
      const blob = await canvasToGifBlob([outCanvas], [100], {
        repeat:     -1, // 1회 재생 (단일 frame)
        background: bgColor,
      });
      triggerDownload(blob, 'gif');
      return;
    }

    // ── 애니메이션 GIF ─────────────────────────────────────────
    // 1) 첫 번째(주요) GIF의 frame 정보를 결정적으로 사용 (timeline 동기화 단순화)
    const primaryUrl = [...sourceUrls][0];
    const primaryFrames = await decodeGifFrames(primaryUrl, { maxFrames: GIF_MAX_FRAMES });

    // 2) 추가 GIF가 있으면 동일 frame 인덱스로 decode (frame수 다르면 modulo)
    const otherFrameMap = new Map(); // url → frames[]
    for (const u of sourceUrls) {
      if (u === primaryUrl) continue;
      otherFrameMap.set(u, await decodeGifFrames(u, { maxFrames: GIF_MAX_FRAMES }));
    }

    const frameCanvases = [];
    const frameDelays   = [];

    for (let fi = 0; fi < primaryFrames.length; fi++) {
      const pf = primaryFrames[fi];

      // (a) 일반 <img> GIF 교체
      for (const im of gifImgs) {
        const fr = (im.src === primaryUrl)
          ? pf
          : (otherFrameMap.get(im.src) || [pf])[fi % (otherFrameMap.get(im.src)?.length || 1)];
        if (fr?.dataURL) im.src = fr.dataURL;
      }

      // (b) 일반 bg-image GIF 교체
      for (const el of gifBgs) {
        const u  = _gifBgUrl(el.style.backgroundImage);
        const fr = (u === primaryUrl)
          ? pf
          : (otherFrameMap.get(u) || [pf])[fi % (otherFrameMap.get(u)?.length || 1)];
        if (fr?.dataURL) el.style.backgroundImage = `url("${fr.dataURL}")`;
      }

      // (c) cvb 내부 GIF (이미 canvas로 변환됨) — 재draw
      for (const cv of gifCanvases) {
        const u  = cv.dataset.gifSrc;
        const fr = (u === primaryUrl)
          ? pf
          : (otherFrameMap.get(u) || [pf])[fi % (otherFrameMap.get(u)?.length || 1)];
        if (!fr?.dataURL) continue;
        const divW = parseFloat(cv.dataset.bgCoverW) || cv.width;
        const divH = parseFloat(cv.dataset.bgCoverH) || cv.height;
        const px   = parseFloat(cv.dataset.bgPx) || 50;
        const py   = parseFloat(cv.dataset.bgPy) || 50;
        const im   = new Image();
        im.src = fr.dataURL;
        await new Promise(r => { im.onload = im.onerror = r; });
        const sc = Math.max(divW / im.naturalWidth, divH / im.naturalHeight);
        const sw = im.naturalWidth  * sc;
        const sh = im.naturalHeight * sc;
        const ox = -((sw - divW) * px / 100);
        const oy = -((sh - divH) * py / 100);
        const c2 = cv.getContext('2d');
        c2.clearRect(0, 0, cv.width, cv.height);
        c2.drawImage(im, ox, oy, sw, sh);
      }

      // (d) 한 frame 캡처
      const outCanvas = await captureCloneToCanvas();
      frameCanvases.push(outCanvas);
      frameDelays.push(pf.delay || 100);
    }

    const blob = await canvasToGifBlob(frameCanvases, frameDelays, {
      repeat:     0, // 무한 루프
      background: bgColor,
    });
    triggerDownload(blob, 'gif');

  } finally {
    document.body.removeChild(clone);
  }
}

async function exportAllSections(format, width, onProgress) {
  const sections = [...canvasEl.querySelectorAll('.section-block:not([data-ghost])')];
  const failed = [];
  for (let i = 0; i < sections.length; i++) {
    onProgress?.(i + 1, sections.length);
    try {
      await exportSection(sections[i], format, width);
    } catch (err) {
      console.error('[export] 섹션 내보내기 실패:', sections[i].id, err);
      failed.push(sections[i]._name || sections[i].id);
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return { total: sections.length, failed };
}

// A30: 'Export' 버튼 드롭다운에서 곧바로 이미지(PNG)로 내보내기 — 핵심 산출물 동선을
//      Page 속성패널 깊숙이에만 두지 않고 Export 메뉴 1급 항목으로 노출.
//      (실제 렌더는 Page 속성패널과 동일하게 exportAllSections 재사용)
async function exportAllImagesPNG() {
  const n = canvasEl.querySelectorAll('.section-block:not([data-ghost])').length;
  if (!n) { window.showToast?.('내보낼 섹션이 없습니다.'); return; }
  if (!confirm(`전체 ${n}개 섹션을 PNG 이미지로 내보냅니다. 계속할까요?`)) return;
  window.showToast?.('이미지 내보내는 중...');
  try {
    const res = await window.exportAllSections('png', 860, (i, t) => window.showToast?.(`내보내는 중... (${i}/${t})`));
    if (res?.failed?.length) window.showToast?.(`⚠️ ${res.failed.length}/${res.total}개 실패: ${res.failed.join(', ')}`);
    else window.showToast?.(`✅ ${res?.total ?? n}개 섹션 PNG 내보내기 완료 — 다운로드 폴더 확인`);
  } catch (err) {
    console.error('[export] PNG 전체 내보내기 실패:', err);
    window.showToast?.('⚠️ 내보내기 실패: ' + (err?.message || err));
  }
}

window.exportSection     = exportSection;
window.exportAllSections = exportAllSections;
window.exportAllImagesPNG = exportAllImagesPNG;
