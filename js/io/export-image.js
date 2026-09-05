import { canvasEl, state } from '../globals.js';
import { runExportGate, isGateSupported } from './export-gate.js';

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

  // 순수 px 단위 값만 스케일 (%, 단위없는 값 제외)
  // 예: "48px" → 스케일, "1.3"(line-height) → 건드리지 않음, "100%" → 건드리지 않음
  // ★ border-radius 다중값 shorthand("0 0 24px 24px" 등)는 단일-px 정규식에 안 걸려
  //   그대로 남던 버그 → 셀 radius(단일값)만 스케일되고 라벨 radius는 원본 유지되어
  //   코너에서 라벨 라운드(R) > 셀 라운드(R·s) 미스매치 → 흰 배경 arc 노출(현빈 카드4).
  //   borderRadius는 모든 px 토큰을 스케일해 셀·라벨 라운드를 일치시킨다.
  const scalePx = (style, props) => props.forEach(p => {
    const v = style[p] && style[p].trim();
    if (!v) return;
    if (/^[\d.]+px$/.test(v)) { style[p] = (parseFloat(v) * s) + 'px'; return; }
    if (p === 'borderRadius' && /[\d.]+px/.test(v)) {
      style[p] = v.replace(/([\d.]+)px/g, (_m, n) => (parseFloat(n) * s) + 'px');
    }
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

/* ── export 직전 «이미지 준비» 대기 ──
 * goya-asset:// 외부화 이후 이미지는 디스크에서 비동기로 온다. 프로젝트를 연 «직후»(콜드 캐시)에 export하면
 * 아직 디코드 안 된 <img>·background-image가 빈 채로 캡처된다(리허설 실측: 같은 섹션이 첫 export 78KB →
 * 재export 3.16MB). 기존 base64는 동기라 이 구멍이 없었고, 일괄 외부화가 이를 보편화한다.
 * clone 안의 <img>는 decode()/onload, 인라인 style background-image url()은 Image() 프리로드로 기다린다.
 * 타임아웃(기본 8s) 안에 못 오면 그냥 진행한다 — export를 영원히 막지 않는다(실패한 이미지는 어차피 빈 칸). */
async function _waitImagesReady(root, timeoutMs = 8000) {
  const waits = [];
  const imgs = root.querySelectorAll('img');
  imgs.forEach(im => {
    if (!im.getAttribute('src')) return;
    if (im.complete && im.naturalWidth > 0) return;
    waits.push(new Promise(res => {
      const done = () => res();
      if (typeof im.decode === 'function') im.decode().then(done, done);
      else { im.addEventListener('load', done, { once: true }); im.addEventListener('error', done, { once: true }); }
    }));
  });
  const urlRe = /url\(["']?([^"')]+)["']?\)/g;
  const seen = new Set();
  const els = [root, ...root.querySelectorAll('[style*="background"]')];
  els.forEach(el => {
    const bg = el.style && el.style.backgroundImage;
    if (!bg || bg === 'none') return;
    let m; urlRe.lastIndex = 0;
    while ((m = urlRe.exec(bg)) !== null) {
      const u = m[1];
      if (!u || u.startsWith('data:') || seen.has(u)) continue; // data:는 동기, 중복은 1회
      seen.add(u);
      waits.push(new Promise(res => { const pi = new Image(); pi.onload = pi.onerror = () => res(); pi.src = u; }));
    }
  });
  // ★타임아웃을 «상태»로 돌려준다 — 타임아웃이 나면 export 도 truth 도 «빈 그림»일 수 있고,
  //   그러면 둘이 «같아서» PASS 가 된다. 「검출 0」을 「문제 없음」으로 읽는 그 병이다.
  //   ⇒ 부른 쪽이 그 실행을 «못 쟀다»로 돌릴 수 있게 true/false 를 준다.
  if (!waits.length) return false;
  let _timedOut = false;
  let _timer = null;
  await Promise.race([
    Promise.all(waits),
    new Promise(res => { _timer = setTimeout(() => { _timedOut = true; res(); }, timeoutMs); }),
  ]);
  clearTimeout(_timer);
  return _timedOut;
}

/* ══════════════════════════════════════════════════════════════════════════
   ① 캡처용 클론 준비 — export 와 truth 가 «같이» 쓴다.
   ★스트립 목록은 «이 함수에만» 존재한다. 사본을 두면 어긋남이 «검출»로 둔갑한다
     (실제로 그랬다: 하네스 truth-capture.js 는 .sec-bg-proxy/.img-edit-hint/.img-boundary
      와 sec-bg-editing 을 «안» 벗겨서 export 와 목록이 갈려 있었다).
   ⛔여기에 «export 전용 변환»(flatten / bg→canvas / box-shadow→border / 필터 bake)을
     넣지 마라 — 넣는 순간 그 변환의 버그를 이 검사가 영원히 못 잡는다.
   ══════════════════════════════════════════════════════════════════════════ */
export async function prepareCloneForCapture(sec, w, useNative) {
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
  // 편집 전용 임시 DOM — 내보내기 클론에 새어 나가면 PNG 에 박힌다.
  clone.querySelectorAll('.sec-bg-proxy, .img-edit-hint, .img-boundary').forEach(el => el.remove());
  clone.classList.remove('selected', 'sec-bg-editing');
  // 자식 블록의 UI 상태 클래스 전부 제거 (outline, dashed border, opacity 등 내보내기 오염 방지)
  clone.querySelectorAll(
    '.selected, .img-editing, .editing, .dragging, .group-selected, .group-editing, .ss-drag-over, .drag-over, .item-selected, .bn2-line-selected, .bn2-line-empty'
  ).forEach(el => {
    el.classList.remove('selected', 'img-editing', 'editing', 'dragging',
      'group-selected', 'group-editing', 'ss-drag-over', 'drag-over', 'item-selected', 'bn2-line-selected', 'bn2-line-empty');
  });
  // CDP captureBeyondViewport로 off-screen 좌표도 캡쳐 가능 — clone을 화면 밖에 두어
  // export 중 사용자 화면에 큰 박스가 튀어나오는 "ghosting" 현상 제거
  clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:' + w + 'px;margin:0;outline:none;';

  // P1 우회 부수 안정성: clone 자체를 stacking context로 격리
  // (sec_fdm1dzu처럼 자체 stacking context인 섹션 외에도 일관성 보장)
  // ★`transform: 'none'` 은 «지웠다»(2026-08-28) — 의도는 「부모 transform 영향 차단」이었는데
  //   clone 은 position:fixed 로 body 에 붙는다. 즉 `#canvas-scaler` 의 matrix(0.4,…) 조상
  //   «밖»에 이미 있어서 차단할 부모 transform 이 없다. 효과가 없는 채로 남아 있으면 다음 사람이
  //   「여기서 transform 을 다루고 있구나」로 읽고 헛짚는다.
  //   실증: 이 줄이 있을 때와 없을 때 export PNG 가 «바이트 동일»(15섹션 실측).
  if (useNative) {
    clone.style.isolation = clone.style.isolation || 'isolate';
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
  return clone;
}

/* ══════════════════════════════════════════════════════════════════════════
   ② 컴포넌트 «자기 렌더» — export 와 truth 가 «같이» 쓴다.
   가르는 기준 한 줄: 「캔버스도 이걸 하나?」
     · renderCanvas / renderBanner02 / renderComparison = 캔버스도 부른다 ⇒ 공용.
       안 넣으면 truth 가 «저장본 스냅샷 높이»로 굳어 폭이 바뀌어도 다시 안 흘러
       «크기 불일치» 거짓 FAIL 이 난다(2026-08-28 780px 실측).
     · 평탄화·bg→canvas·shadow→border = html2canvas 한계 우회 ⇒ export 만(③).
   ★재렌더가 편집용 마커를 «되붙인다» — ①의 일괄 스트립보다 뒤이므로 여기서 한 번 더 벗긴다
     (PNG 엔 점선이 찍히고 export-html 엔 안 찍히던 QA BUG-2 의 자리).
   ══════════════════════════════════════════════════════════════════════════ */
export function renderComponentsInClone(clone) {
  for (const _cb of clone.querySelectorAll('.canvas-block[data-card-mode]')) {
    if (window.renderCanvas) {
      window.renderCanvas(_cb);
      if (_cb._cvbRO) { _cb._cvbRO.disconnect(); _cb._cvbRO = null; }
    }
  }
  for (const _bn of clone.querySelectorAll('.banner02-block')) {
    if (window.renderBanner02) {
      window.renderBanner02(_bn);
      if (_bn._bn2RO) { _bn._bn2RO.disconnect(); _bn._bn2RO = null; }
    }
  }
  for (const _cmp of clone.querySelectorAll('.comparison-block')) {
    if (window.renderComparison) {
      window.renderComparison(_cmp);
      if (_cmp._cmpRO) { _cmp._cmpRO.disconnect(); _cmp._cmpRO = null; }
    }
  }
  clone.querySelectorAll('.bn2-line-selected, .bn2-line-empty').forEach(_el =>
    _el.classList.remove('bn2-line-selected', 'bn2-line-empty'));
  clone.getBoundingClientRect();
}

/** export/truth 공용 — 이 클론이 native(CDP) 캡처 대상인가. */
export function isNativeCapture(opts) {
  return !(opts && opts.forceH2C) && !!window.electronAPI?.captureSection;
}

/* ══════════════════════════════════════════════════════════════════════════
   ④ 클론 → 캔버스 캡처 — export 와 truth 가 «같이» 쓴다.
   ★truth 도 «이 헬퍼»로 캡처해야 다운스케일 리샘플이 같다. 사본을 두면 리샘플 차이가
     «검출»로 둔갑한다.
   반환 { canvas, imgTimedOut, native } — imgTimedOut 이 true 면 export 도 truth 도
   «빈 그림»일 수 있어 둘이 같아도 PASS 라고 말하면 안 된다(판정에서 unmeasured 로 간다).
   ══════════════════════════════════════════════════════════════════════════ */
export async function captureCloneToCanvas(clone, w, bgColor, useNative) {
    if (useNative) {
      // ⚠️ 'background' 단축속성으로 폴백색을 넣으면 안 됨: data-URL 이미지배경은
      // background shorthand getter가 ''를 반환해서 `clone.style.background || bgColor`가
      // 색을 단축속성으로 세팅 → backgroundImage(섹션 텍스처)가 initial로 리셋되어 증발함.
      // (다크 텍스처 섹션이 흰색으로 export되던 결함.) → 인라인 배경(이미지/색)이 전혀 없을
      // 때만 longhand backgroundColor로 폴백해서 텍스처/색을 보존한다.
      if (!clone.style.backgroundImage && !clone.style.backgroundColor) {
        clone.style.backgroundColor = bgColor;
      }
      await document.fonts.ready;
      const _to = await _waitImagesReady(clone); // goya-asset 이미지 디코드 대기(콜드 캐시 빈 캡처 방지)
      clone.getBoundingClientRect();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const secH = clone.offsetHeight;
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
      // 게이트④/A6(현빈 확정 spec): PNG/JPG export = CSS픽셀 ★1배 고정.
      // CDP 캡처(captureSectionCdp)는 surface device-pixel-ratio배(레티나=2x) 물리픽셀로
      // 돌아온다(섹션 CSS 860px → 캡처 1720px). 기존엔 outCanvas도 w*dpr로 둬서 2배 PNG가
      // 나왔고, dpr=1 머신에선 1배라 머신 간 산출물이 비결정적이었음.
      // → 출력 캔버스를 CSS px(w×secH)로 고정하고 drawImage 시 다운스케일 → dpr 무관 결정적 1배.
      const outCanvas = document.createElement('canvas');
      outCanvas.width  = Math.round(w);
      outCanvas.height = Math.round(secH);
      const ctx = outCanvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      await new Promise((res, rej) => {
        const ci = new Image();
        ci.onload  = () => { ctx.drawImage(ci, 0, 0, outCanvas.width, outCanvas.height); res(); };
        ci.onerror = rej;
        ci.src = 'data:image/png;base64,' + pngBase64;
      });
      return { canvas: outCanvas, imgTimedOut: _to, native: true };
    }
    // html2canvas 폴백 — CDP 가 없는 빌드(웹). 검사는 여기서 «안» 돈다(isGateSupported=false).
    const _to2 = await _waitImagesReady(clone);
    const _h2c = await html2canvas(clone, {
      scale: 1,
      useCORS: true,
      backgroundColor: bgColor,
      logging: false,
    });
    return { canvas: _h2c, imgTimedOut: _to2, native: false };
}

/** 섹션 배경색 — export 와 truth 가 «같은 값»을 써야 한다(하나만 회색으로 찍히면 그게 차이로 잡힌다).
 *  라이브 computed bg 가 불투명이면 그 색, 진짜 투명(alpha=0)일 때만 pageSettings.bg 폴백.
 *  (흰 섹션이 `.section-block{background:#fff}` 클래스에서 색을 받는데 inline 이 없다고
 *   pageSettings.bg 회색으로 폴백해 회색으로 export 되던 결함의 자리 — Figma builder 65faf33 과 동일 원리.) */
export function sectionBgColor(sec) {
  const live  = getComputedStyle(sec).backgroundColor || '';
  const m     = live.match(/^rgba?\(([^)]+)\)/);
  const alpha = m ? (m[1].split(',').map(v => parseFloat(v))[3] ?? 1) : 1;
  return (m && alpha !== 0) ? live : (state.pageSettings.bg || '#ffffff');
}

async function exportSection(sec, format, width, opts) {
  // 이미지 외부화(goya-asset://) 이후: lazy 언로드된 섹션이 빈(blank) 상태로 캡처되지
  // 않도록 export 렌더 전에 모든 섹션 이미지를 라이브 DOM에 복원한다.
  // (lazy-sections.js가 아직 없을 수도 있으므로 방어적으로 호출)
  if (window.materializeAllSections) window.materializeAllSections();

  const fmt = format || 'png';
  const w   = width  || CANVAS_W;
  const isGif     = fmt === 'gif' || fmt === 'gif-anim';
  const isGifAnim = fmt === 'gif-anim';

  // 클론을 transform 밖(body)에 배치해서 html2canvas가 부모 scale 영향 안 받게 함
  const useNative = isNativeCapture(opts);
  const clone = await prepareCloneForCapture(sec, w, useNative);
  // ②컴포넌트 자기 렌더를 «먼저 전부» 돌린다(truth 와 같은 순서). 그 뒤가 ③export 전용 변환.
  renderComponentsInClone(clone);

  // cvb(canvas-block): renderCanvas로 scale 재계산 후 transform 평탄화
  // html2canvas가 transform:scale() 내부 background-image를 잘못 렌더링하므로
  // 실제 px 값으로 변환하여 transform 제거
  // forEach 대신 for...of 사용 (내부에서 await 필요)
  for (const cb of clone.querySelectorAll('.canvas-block[data-card-mode]')) {
    // ★렌더는 ②renderComponentsInClone 에서 «이미» 돌았다 — 여기서 또 부르면 렌더 목록이
    //   두 곳으로 갈린다. 아래는 ③export 전용 변환뿐이다.

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

        // background-size를 실제 div 스타일에서 읽어 재현 — 기존엔 항상 cover로 계산해
        // 카드 이미지 확대(imgScale, background-size:NNN%)를 무시 → export 크롭이 캔버스와 어긋났음.
        //   'NNN%'  → 가로 = divW×NNN%, 세로 auto(이미지 비율) : _cvbBackgroundSize(imgScale>100) 재현
        //   'contain' → min-fit, 'cover'(기본) → max-fit
        const _bgSize = (div.style.backgroundSize || 'cover').trim();
        const _pctM = _bgSize.match(/^([\d.]+)%$/);
        let sw, sh;
        if (_pctM) {
          sw = divW * (parseFloat(_pctM[1]) / 100);
          sh = sw * (imgObj.naturalHeight / imgObj.naturalWidth);
        } else if (_bgSize === 'contain') {
          const s = Math.min(divW / imgObj.naturalWidth, divH / imgObj.naturalHeight);
          sw = imgObj.naturalWidth * s; sh = imgObj.naturalHeight * s;
        } else {
          const s = Math.max(divW / imgObj.naturalWidth, divH / imgObj.naturalHeight);
          sw = imgObj.naturalWidth * s; sh = imgObj.naturalHeight * s;
        }
        // background-position을 % → px offset으로 변환 (음수 오버플로우: 위치%가 오버영역 분배)
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
    // ★렌더는 ②renderComponentsInClone 에서 «이미» 돌았다 — 여기서 또 부르면 렌더 목록이
    //   두 곳으로 갈린다. 아래는 ③export 전용 변환뿐이다.
    const inner = bn.querySelector('.bn2-inner');
    if (!inner) continue;
    const m = (inner.style.transform || '').match(/scale\(([^)]+)\)/);
    const s = m ? parseFloat(m[1]) : 1;
    bn.getBoundingClientRect();
    if (s && s !== 1) {
      const scalePx = (st, props) => props.forEach(p => {
        if (st[p] && /^[\d.]+px$/.test(st[p].trim())) st[p] = (parseFloat(st[p]) * s) + 'px';
      });
      /* ★letterSpacing 이 «빠져 있었다» — fontSize 는 s 배로 줄이는데 자간은 원본 px 로 남는다.
       *   그러면 글자만 작아지고 간격은 그대로라 «자간이 어긋난 채» 내보내진다.
       *   실측(2026-08-28, sec_84a7j_rto5c9n · 860px):
       *     같은 실행 안에서 export↔truth  22972 → 19972
       *     ★대조군 — 두 실행의 truth 는 «완전 동일»(0). 바뀐 건 export 뿐(3415px).
       *   ⚠️처음엔 「이 분기가 안 탄다」고 스스로 «잘못 정정»했다. 맨 배너를 따로 클론해 재보니
       *     renderBanner02 가 s=1 로 만들어서였는데, 진짜 export 는 «섹션 통째» 클론이라
       *     scale(0.97948) 이 살아 있고 분기가 «탄다»(계측으로 확인: 평탄화 후 transform=none,
       *     fontSize 26px→25.4665px = ×0.97948). ⇒ 대표성 없는 축소재현이 반증을 만들어냈다.
       *   ⚠️음수 자간(-0.5px 실재)도 있어 정규식이 부호를 받아야 한다 — 기존 /^[\d.]+px$/ 는 못 받는다. */
      const scaleSigned = (st, props) => props.forEach(p => {
        const v = st[p] && st[p].trim();
        if (v && /^-?[\d.]+px$/.test(v)) st[p] = (parseFloat(v) * s) + 'px';
      });
      inner.querySelectorAll('[style]').forEach(el => {
        scalePx(el.style, ['left', 'top', 'width', 'height', 'fontSize', 'marginTop', 'borderRadius']);
        scaleSigned(el.style, ['letterSpacing']);
      });
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
    // ★렌더는 ②renderComponentsInClone 에서 «이미» 돌았다 — 여기서 또 부르면 렌더 목록이
    //   두 곳으로 갈린다. 아래는 ③export 전용 변환뿐이다.
    const inner = cmp.querySelector('.cmp-inner');
    if (!inner) continue;
    const m = (inner.style.transform || '').match(/scale\(([^)]+)\)/);
    const s = m ? parseFloat(m[1]) : 1;
    cmp.getBoundingClientRect();
    if (s && s !== 1) {
      const scalePx = (st, props) => props.forEach(p => {
        if (st[p] && /^[\d.]+px$/.test(st[p].trim())) st[p] = (parseFloat(st[p]) * s) + 'px';
      });
      /* ★[잠복] letterSpacing 이 «빠져 있다» — fontSize 는 s 배로 줄이는데 자간은 원본 px 로 남는다.
       *   그러면 글자만 작아지고 간격은 그대로라 «자간이 어긋난 채» 내보내진다.
       *   ⚠️2026-08-28 실측: 지금 표본에선 이 분기가 «안 탄다»(renderBanner02 뒤 s=1 이라 건너뛴다).
       *     즉 재현된 결함이 아니라 «논리 불일치»다 — 고쳐두되 「이걸 고쳐서 무엇이 나아졌다」고 말하지 않는다.
       *     s≠1 이 남는 배너(더 좁은 폭·더 긴 글)에서 발화할 수 있다.
       *   ⚠️음수 자간(-0.5px 실재)도 있어 정규식이 부호를 받아야 한다 — 기존 /^[\d.]+px$/ 는 못 받는다. */
      const scaleSigned = (st, props) => props.forEach(p => {
        const v = st[p] && st[p].trim();
        if (v && /^-?[\d.]+px$/.test(v)) st[p] = (parseFloat(v) * s) + 'px';
      });
      inner.querySelectorAll('[style]').forEach(el => {
        scalePx(el.style, ['left', 'top', 'width', 'height', 'fontSize', 'marginTop', 'borderRadius']);
        scaleSigned(el.style, ['letterSpacing']);
      });
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
  const bgColor = sectionBgColor(sec);

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
  // ★캡처 결과는 «캔버스 하나»가 아니라 {canvas, imgTimedOut, native} 다.
  //   마지막 캡처의 상태를 들고 있다가 검사(⑥)에 넘긴다 — 애니메이션 GIF 는 frame 마다 부른다.
  let _lastCap = null;
  const capture = async () => {
    _lastCap = await captureCloneToCanvas(clone, w, bgColor, useNative);
    return _lastCap.canvas;
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

  /* 게이트 상태 — try 밖에서 읽는다. `return` 을 try 안에 두면 finally 가 먼저 돌아
     truth 클론이 export 클론과 «같은 자리»에서 겹친다. */
  let _gateCanvas = null, _gateSkip = null, _done = false, _err = null;
  const gateOn = !(opts && opts.returnDataUrl) && !(opts && opts.gate === false) && isGateSupported();

  try {
    if (!isGif) {
      // ── 기존 PNG/JPG 경로 ────────────────────────────────────────
      const outCanvas = await capture();
      // 채점용: 다운로드 대신 dataURL 반환 (goditor ground-truth 캡처)
      if (opts && opts.returnDataUrl) {
        // ⛔이 경로에서는 게이트를 «절대» 켜지 않는다 — tools/export-gate.sh 와 QA 스킬이
        //   쓰는 길이라, 켜면 «외부 검산이 자기 자신을 재게» 된다(검산이 검산이 아니게 된다).
        if (window.__EXPORT_GATE_TRACE) console.log('[export-gate] skipped: returnDataUrl');
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
      // ★파일은 «이미» 나갔다(B안 «주고 알린다»). 검사는 여기서부터고, 결과는 모달로만 간다.
      //   ⚠️A안(막기)으로 바꿀 자리는 «한 곳» — 위 triggerDownload 호출을 검사 «뒤»로 옮기면 된다.
      _gateCanvas = outCanvas;
      _done = true;
    }
    if (!_done) {

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
      const outCanvas = await capture();
      const blob = await canvasToGifBlob([outCanvas], [100], {
        repeat:     -1, // 1회 재생 (단일 frame)
        background: bgColor,
      });
      triggerDownload(blob, 'gif');
      // ⛔GIF 는 팔레트 256색으로 «양자화»된다 — 캔버스와 다른 게 «정상»이라 이 판정기의 축이 아니다.
      //   P0 는 못 쟀다고 말한다(정상이라고도, 문제라고도 말하지 않는다).
      _gateSkip = 'gif';
      _done = true;
    }
    if (!_done) {

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
      const outCanvas = await capture();
      frameCanvases.push(outCanvas);
      frameDelays.push(pf.delay || 100);
    }

    const blob = await canvasToGifBlob(frameCanvases, frameDelays, {
      repeat:     0, // 무한 루프
      background: bgColor,
    });
    triggerDownload(blob, 'gif');
    _gateSkip = 'gif';
    }
    }

  } catch (err) {
    _err = err;
  } finally {
    // ★truth 클론은 export 클론이 «지워진 뒤»에 붙는다 — 둘 다 top:-99999px;left:0 이라 겹친다.
    document.body.removeChild(clone);
  }
  if (_err) throw _err;

  /* ── ⑥ 검사 — 파일이 나간 «뒤» ─────────────────────────────────────────
     여기서 무엇을 하든 다운로드에는 영향이 없다(B안). 예외가 나도 삼키지 않고
     «못 쟀다»로 돌린다 — 검사가 내보내기를 깨뜨리면 안 된다. */
  let gate = null;
  if (gateOn) {
    gate = await runExportGate(sec, w, {
      exportCanvas: _gateCanvas,
      imgTimedOut:  _lastCap ? _lastCap.imgTimedOut : false,
      native:       _lastCap ? _lastCap.native : useNative,
      format:       fmt,
      bgColor,
      sectionId:    sec.id,
    });
  }
  return { name, idx, sectionId: sec.id, format: fmt, width: w, gate };
}

async function exportAllSections(format, width, onProgress, opts) {
  // 전체 export 시작 전 lazy 언로드 섹션 전부 복원 (개별 exportSection도 호출하지만,
  // 섹션 목록 산정/순회 전에 한 번 더 보장)
  if (window.materializeAllSections) window.materializeAllSections();

  const sections = [...canvasEl.querySelectorAll('.section-block:not([data-ghost])')];
  const failed = [];
  const results = [];
  for (let i = 0; i < sections.length; i++) {
    onProgress?.(i + 1, sections.length);
    try {
      const r = await exportSection(sections[i], format, width, opts);
      results.push(r && typeof r === 'object'
        ? r
        : { name: sections[i]._name || sections[i].id, idx: i + 1, sectionId: sections[i].id, gate: null });
    } catch (err) {
      console.error('[export] 섹션 내보내기 실패:', sections[i].id, err);
      const nm = sections[i]._name || sections[i].id;
      failed.push(nm);
      // ★「내보내지 못했다」는 «픽셀 판정»과 다른 층이다 — 파일이 아예 없다.
      //   결과 모달이 둘을 섞어 말하면 사용자가 파일을 찾으러 간다.
      results.push({ name: nm, idx: i + 1, sectionId: sections[i].id, failed: true,
                     error: (err && err.message) || String(err), gate: null });
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return { total: sections.length, failed, results };
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
    // ★결과는 «모달 하나»로만 말한다 — 2초 토스트에 담을 정보가 아니다(현빈 「결과 모달도 떠야」).
    window.showExportResultModal?.(res, { format: 'png', width: 860 });
  } catch (err) {
    console.error('[export] PNG 전체 내보내기 실패:', err);
    window.showToast?.('⚠️ 내보내기 실패: ' + (err?.message || err));
  }
}

window.exportSection     = exportSection;
window.exportAllSections = exportAllSections;
window.exportAllImagesPNG = exportAllImagesPNG;
