// redact-mosaic.js — 셰이프 redact의 «모자이크(픽셀화)» 모드.
//
// 원리: backdrop-filter(blur 모드, prop-shape.js)처럼 매 프레임 실시간으로 밑 콘텐츠를
// 추적하지 않는다. 대신 그 순간의 스냅샷을 작은 캔버스에 다운스케일로 캡처해두고,
// CSS `image-rendering: pixelated`로 원래 크기까지 확대 표시한다 — 확대 자체는 브라우저가
// 공짜로 하므로 실시간 비용이 없다. 스냅샷은 "이벤트 발생 시"에만 다시 찍는다
// (도형 이동/리사이즈 종료, 모드 전환, 강도 변경, 밑 콘텐츠가 바뀔 수 있는 임의의
// mouseup) — 매 프레임 갱신 대비 훨씬 싸다.
//
// ⚠️ 캔버스 요소는 cloneNode로 «비트맵이 안 딸려온다»(export 경로가 clone을 오프스크린에
// 띄워 캡처하는 구조 — export-image.js captureCloneToCanvas 주석 참고). 그래서 export
// 직전에 반드시 finalizeMosaicForClone()으로 라이브 캔버스의 비트맵을 clone의 캔버스에
// 옮겨 구워야 한다. 라이브 캔버스에 스냅샷이 아직 없으면(한 번도 캡처 안 됨) 안전실패로
// 불투명 회색 채움 — 원본이 새는 것보다 못생긴 게 낫다.

const MOSAIC_FAIL_SAFE_FILL = '#4a4a4a';

// ⚠️ "이 캔버스에 실제 비트맵이 그려져 있다"는 block.dataset(직렬화되어 저장됨)가 아니라
// 이 WeakSet(런타임 전용, 이 DOM 노드 인스턴스에만 유효)으로 추적한다.
// dataset.mosaicCaptured 같은 플래그를 저장 HTML에 남기면, 프로젝트를 저장했다가 다시 열었을
// 때 «플래그는 true인데 캔버스 비트맵은 비어있는»(cloneNode/innerHTML 직렬화가 캔버스 픽셀을
// 못 담는다) 상태가 재현된다 — 이러면 해당 블록을 «이미 캡처됨»으로 잘못 신뢰해 안전실패가
// 빠질 수 있다(2026-09-15 실측: 프로젝트 리로드 후 4x3 캔버스가 전부 투명인데 플래그만 남음).
const _capturedBlocks = new WeakSet();

/** 슬라이더 0~20 → 모자이크 블록 픽셀 크기 16~44px (0에 가까울수록 잘게, 20이면 큼직하게).
 *  ★프라이버시(2026-09-15): 옛 하한 6px(슬라이더 최소 2로도 실제 블록 약 10px)는 40px+
 *  큰 글씨(제목·강조 텍스트 등)를 가릴 만큼 크지 않을 수 있다는 지적 반영 — 슬라이더
 *  전 구간에서 "충분히 안 읽히는" 블록 크기를 보장하도록 하한을 16px로 올림. */
export function mosaicBlockPxFromSlider(v) {
  const n = Math.max(0, Math.min(20, parseInt(v, 10) || 0));
  return Math.round(16 + (n / 20) * 28);
}

function ensureMosaicCanvas(block) {
  let canvas = block.querySelector(':scope > canvas.redact-mosaic-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'redact-mosaic-canvas';
    block.appendChild(canvas);
  }
  return canvas;
}

// 원본 해상도 캡처 결과 캐시(block당 1장) — "강도"(모자이크 블록 크기) 슬라이더를 드래그할
// 때마다 html2canvas로 다시 찍으면 느리다. 밑 콘텐츠는 안 바뀌었으므로 다운스케일만 다시 한다.
const _fullResCache = new WeakMap();

function redrawFromFullRes(block, fullRes) {
  const rect = block.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  const canvas = ensureMosaicCanvas(block);
  const blockPx = mosaicBlockPxFromSlider(block.dataset.shapeRedactBlur || '8');
  const dw = Math.max(1, Math.round(w / blockPx));
  const dh = Math.max(1, Math.round(h / blockPx));
  const small = document.createElement('canvas');
  small.width = dw; small.height = dh;
  const sctx = small.getContext('2d');
  sctx.imageSmoothingEnabled = true;
  sctx.drawImage(fullRes, 0, 0, dw, dh);

  canvas.width = dw; canvas.height = dh;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, dw, dh);
  ctx.drawImage(small, 0, 0);
  _capturedBlocks.add(block);
  // 레거시 정리: 옛 빌드/저장분에 남아있을 수 있는 직렬화 플래그(신뢰 금지 대상) 제거.
  delete block.dataset.mosaicCaptured;
}

/** 이 라이브 block 인스턴스에 실제로 캡처된 비트맵이 있는가(런타임 전용, 리로드 시 리셋). */
export function isMosaicCaptured(block) {
  return !!block && _capturedBlocks.has(block);
}

/** block 밑에 깔린 콘텐츠를 캡처해 모자이크 캔버스를 갱신한다. 실패해도 조용히 무시(라이브
 *  캔버스는 이전 스냅샷을 그대로 들고 있으므로 안전 — export 단계의 안전실패가 최종 방어선).
 *  opts.reuseFullRes: true면 DOM을 다시 찍지 않고 캐시된 원본해상도 캡처만 재다운스케일
 *  (강도 슬라이더 드래그 중처럼 밑 콘텐츠는 그대로고 블록 크기만 바뀔 때). */
export async function captureMosaicSnapshot(block, opts) {
  if (!block) return false;
  if (opts?.reuseFullRes && _fullResCache.has(block)) {
    redrawFromFullRes(block, _fullResCache.get(block));
    return true;
  }
  if (typeof window.html2canvas !== 'function') return false;
  const scope = block.closest('.section-block') || block.parentElement;
  if (!scope) return false;

  const rect = block.getBoundingClientRect();
  const scopeRect = scope.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  // ★프라이버시(2026-09-15 실측): html2canvas는 scope(섹션)를 #canvas-scaler의 CSS
  // transform:scale(줌) 밖에서(=원본 크기로) 렌더링한다 — 그런데 x/y/width/height는 여기까지
  // «화면(줌 적용) 좌표»로 계산돼 있었다. 100% 미만 줌(신규 프로젝트 기본값이 40%!)에서는 실제
  // 콘텐츠의 일부만 크롭 요청하는 꼴이 되어, 캡처가 "성공"해도(isMosaicCaptured=true) 크롭
  // 밖으로 밀린 나머지 부분은 원본 그대로 아래 비쳐 보인다(1000×1000 텍스트 블록 중 뒤쪽 60%가
  // 그대로 노출되는 것을 실측). scope의 렌더 좌표계(=원본, 줌 무관)로 환산해서 크롭해야 한다.
  const zf = (window.currentZoom || 100) / 100;
  const relX = (rect.left - scopeRect.left) / zf;
  const relY = (rect.top - scopeRect.top) / zf;
  const capW = Math.max(1, Math.round(w / zf));
  const capH = Math.max(1, Math.round(h / zf));

  // ★프라이버시(2026-09-15): 예전엔 block.style.visibility='hidden'으로 라이브 DOM을
  // 실제로 숨긴 뒤 await 하고 되돌렸다 — html2canvas가 밑 콘텐츠를 찍는 수백ms 동안
  // 화면의 가림막(회색/모자이크)이 통째로 사라져 재캡처 때마다(슬라이더 드래그, 다른
  // 블록 이동 등 임의의 mouseup) 원본이 깜빡이며 노출됐다(a1-a3 코드리뷰 지적, T-027).
  // html2canvas의 ignoreElements로 "이 블록만 캡처 대상에서 제외"하면, 라이브 화면은
  // 한순간도 안 바뀐 채(가림막 계속 보임) 오프스크린 캡처 결과에서만 그 블록이 빠져
  // 밑 콘텐츠가 드러난다 — 같은 효과를 화면에 아무 변화 없이 얻는다.
  let captured;
  try {
    captured = await window.html2canvas(scope, {
      x: relX, y: relY, width: capW, height: capH,
      backgroundColor: null, logging: false, useCORS: true,
      ignoreElements: (el) => el === block,
    });
  } catch (_) {
    return false;
  }
  if (!captured || !captured.width || !captured.height) return false;
  /* ★프라이버시(2026-09-15, export 조사 중 발견 — fix-mosaic-precapture-exposure): export
   * 도중(오프스크린 clone이 document에 떠 있는 특정 맥락) html2canvas가 크기는 정상인데
   * «완전 투명»한 캡처를 돌려주는 경우가 확인됐다(정확한 근본원인은 미확정 — html2canvas
   * 내부가 offscreen clone 존재로 뭔가 오작동하는 것으로 추정). 그걸 그대로 신뢰해
   * _capturedBlocks 에 "캡처됨"으로 마킹하면, 실제로는 빈 비트맵이 기존의 «정상 스냅샷»
   * (또는 안전실패 회색)을 덮어써 finalizeMosaicForClone 이 원본을 그대로 내보내는 사고로
   * 이어진다(라이브는 안전한데 export PNG 만 새는 형태로 실측됨). 완전 투명이면 "캡처 실패"로
   * 취급해 기존 상태(_fullResCache/canvas)를 그대로 둔다 — 원인을 못 밝혀도 결과는 안전하게. */
  if (_isFullyTransparent(captured)) return false;

  _fullResCache.set(block, captured);
  redrawFromFullRes(block, captured);
  return true;
}

/** canvas 가 «완전 투명»(알파 전부 0에 가까움)인지 저해상도 샘플링으로 빠르게 판정.
 *  읽기 실패(오염된 캔버스 등)는 "투명 아님"으로 취급해 기존 흐름을 막지 않는다 — 이 함수의
 *  목적은 새로운 실패를 만드는 게 아니라 «이미 관측된 특정 실패 모드»만 걸러내는 것이다. */
function _isFullyTransparent(canvas) {
  try {
    const sw = Math.min(canvas.width, 16) || 1, sh = Math.min(canvas.height, 16) || 1;
    const probe = document.createElement('canvas');
    probe.width = sw; probe.height = sh;
    const pctx = probe.getContext('2d');
    pctx.drawImage(canvas, 0, 0, sw, sh);
    const data = pctx.getImageData(0, 0, sw, sh).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 8) return false; // 알파가 조금이라도 있으면 "내용 있음"
    }
    return true;
  } catch (_) {
    return false;
  }
}

let _refreshTimer = null;
function scheduleRefreshAllVisible() {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(() => {
    _refreshTimer = null;
    const blocks = document.querySelectorAll('.shape-block.shape-redact[data-shape-redact-mode="mosaic"]');
    blocks.forEach((b) => { captureMosaicSnapshot(b); });
  }, 120);
}

let _wired = false;
/** 편집 중 이벤트 기반 갱신 — 어떤 mouseup이든(도형 자체 이동/리사이즈뿐 아니라 밑에 깔린
 *  다른 블록을 옮기는 경우도 포함) 화면에 있는 모자이크 redact들을 재캡처한다.
 *  매 프레임이 아니라 "상호작용 종료 시" 1회이므로 비용이 크지 않다. */
export function wireMosaicAutoRefresh() {
  if (_wired) return;
  _wired = true;
  document.addEventListener('mouseup', scheduleRefreshAllVisible);
}

/** export 직전 — clone(비트맵 없음)에 라이브 캔버스의 최신 비트맵을 구워 넣는다.
 *  liveScope: 원본이 살아있는 DOM 범위(보통 캡처 대상 section). clone: 그 오프스크린 사본.
 *  ★안전실패: 라이브에 스냅샷이 없거나(한 번도 캡처 안 됨) 복사가 실패하면 원본이 새는 대신
 *  불투명 회색으로 채운다 — capture-safety.js의 neutralizeRedactForH2C와 같은 원칙. */
export async function finalizeMosaicForClone(liveScope, clone) {
  if (!clone) return;
  const cloneCanvases = clone.querySelectorAll('.shape-block.shape-redact[data-shape-redact-mode="mosaic"] canvas.redact-mosaic-canvas');
  for (const cCanvas of cloneCanvases) {
    const cBlock = cCanvas.closest('.shape-block');
    const blockId = cBlock?.id;
    // ⚠️ liveScope 안에서만 찾는다 — document 전역 getElementById 폴백은 쓰지 않는다.
    // export 도중 만들어지는 오프스크린 clone들도 같은 id를 들고 있을 수 있어(직전에 실패해
    // 못 지운 clone 등), 전역 검색은 «라이브가 아닌 또 다른 clone»을 라이브로 오인해
    // 안전실패가 빠지는 사고로 이어진다(2026-09-15 실측: 고아 id 테스트에서 재현).
    const liveBlock = (blockId && liveScope?.querySelector)
      ? liveScope.querySelector(`#${CSS.escape(blockId)}`)
      : null;
    const liveCanvas = liveBlock?.querySelector?.(':scope > canvas.redact-mosaic-canvas');

    // 항상 export 시점 기준 최신 스냅샷을 한 번 더 찍는다(밑 콘텐츠가 캡처 이후 바뀌었을 수 있음).
    if (liveBlock) {
      try { await captureMosaicSnapshot(liveBlock); } catch (_) {}
    }
    const freshLiveCanvas = liveBlock?.querySelector?.(':scope > canvas.redact-mosaic-canvas') || liveCanvas;

    const w = Math.max(1, Math.round(cBlock.getBoundingClientRect().width) || cCanvas.width || 1);
    const h = Math.max(1, Math.round(cBlock.getBoundingClientRect().height) || cCanvas.height || 1);

    const hasBitmap = freshLiveCanvas && freshLiveCanvas.width > 0 && freshLiveCanvas.height > 0
      && isMosaicCaptured(liveBlock);

    cCanvas.width = w; cCanvas.height = h;
    const ctx = cCanvas.getContext('2d');
    if (hasBitmap) {
      try {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(freshLiveCanvas, 0, 0, w, h);
        continue;
      } catch (_) { /* fall through to fail-safe */ }
    }
    // 안전실패 — 원본 노출보다 불투명 회색이 낫다.
    ctx.fillStyle = MOSAIC_FAIL_SAFE_FILL;
    ctx.fillRect(0, 0, w, h);
  }
}

window.captureMosaicSnapshot   = captureMosaicSnapshot;
window.wireMosaicAutoRefresh   = wireMosaicAutoRefresh;
window.finalizeMosaicForClone  = finalizeMosaicForClone;
window.mosaicBlockPxFromSlider = mosaicBlockPxFromSlider;
window.isMosaicCaptured        = isMosaicCaptured;

wireMosaicAutoRefresh();
