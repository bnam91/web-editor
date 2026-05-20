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

async function exportSection(sec, format, width) {
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
  clone.classList.remove('selected');
  // 자식 블록의 UI 상태 클래스 전부 제거 (outline, dashed border, opacity 등 내보내기 오염 방지)
  clone.querySelectorAll(
    '.selected, .img-editing, .editing, .dragging, .group-selected, .group-editing, .ss-drag-over, .drag-over'
  ).forEach(el => {
    el.classList.remove('selected', 'img-editing', 'editing', 'dragging',
      'group-selected', 'group-editing', 'ss-drag-over', 'drag-over');
  });
  // Electron CDP 캡처 시 clone을 viewport 상단에 배치, html2canvas는 off-screen
  const useNative = !!window.electronAPI?.captureSection;
  clone.style.cssText += ';position:fixed;top:' + (useNative ? '0' : '-99999px')
    + ';left:0;width:' + w + 'px;margin:0;outline:none;'
    + (useNative ? ';z-index:9999999;' : '');

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

  // 색상 조정 필터가 적용된 img → Canvas로 bake
  // html2canvas는 SVG filter url()을 지원하지 않으므로 사전 변환 필요
  if (window.bakeImgFilterToCanvas) {
    for (const img of clone.querySelectorAll('.asset-img[data-adj-exposure], .asset-img[data-adj-contrast], .asset-img[data-adj-saturation], .asset-img[data-adj-temperature], .asset-img[data-adj-tint], .asset-img[data-adj-highlights], .asset-img[data-adj-shadows]')) {
      await window.bakeImgFilterToCanvas(img);
    }
  }

  const secBg   = sec.style.background || sec.style.backgroundColor || '';
  const bgColor = (secBg && secBg !== 'transparent') ? secBg : (state.pageSettings.bg || '#ffffff');

  const secList = [...canvasEl.querySelectorAll('.section-block:not([data-ghost])')];
  const idx     = secList.indexOf(sec) + 1;
  const name    = (sec._name || `section-${String(idx).padStart(2,'0')}`).replace(/\s+/g, '-');

  // 클론을 한 번 fully-render 한 뒤 캔버스로 캡처해 돌려주는 헬퍼.
  // (animated GIF는 frame별로 여러 번 호출)
  const captureCloneToCanvas = async () => {
    if (useNative) {
      clone.style.background = clone.style.background || bgColor;
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const secH  = clone.offsetHeight;
      const viewH = window.innerHeight;
      const dpr   = window.devicePixelRatio || 2;
      const outCanvas = document.createElement('canvas');
      outCanvas.width  = Math.round(w    * dpr);
      outCanvas.height = Math.round(secH * dpr);
      const ctx = outCanvas.getContext('2d');
      let y = 0;
      while (y < secH) {
        const chunkH = Math.min(viewH, secH - y);
        clone.style.top = (-y) + 'px';
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const pngBase64 = await window.electronAPI.captureSection({ width: w, height: chunkH });
        await new Promise((res, rej) => {
          const ci = new Image();
          ci.onload = () => { ctx.drawImage(ci, 0, Math.round(y * dpr)); res(); };
          ci.onerror = rej;
          ci.src = 'data:image/png;base64,' + pngBase64;
        });
        y += chunkH;
      }
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

async function exportAllSections(format, width) {
  const sections = [...canvasEl.querySelectorAll('.section-block:not([data-ghost])')];
  for (const sec of sections) {
    await exportSection(sec, format, width);
    await new Promise(r => setTimeout(r, 300));
  }
}

window.exportSection     = exportSection;
window.exportAllSections = exportAllSections;
