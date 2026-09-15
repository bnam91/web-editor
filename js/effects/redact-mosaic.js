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

/** 슬라이더 0~20 → 모자이크 블록 픽셀 크기 6~44px (0에 가까울수록 잘게, 20이면 큼직하게). */
export function mosaicBlockPxFromSlider(v) {
  const n = Math.max(0, Math.min(20, parseInt(v, 10) || 0));
  return Math.round(6 + (n / 20) * 38);
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
  const relX = rect.left - scopeRect.left;
  const relY = rect.top - scopeRect.top;

  const prevVisibility = block.style.visibility;
  block.style.visibility = 'hidden'; // 자기 자신(캔버스 포함)을 캡처하지 않도록
  let captured;
  try {
    captured = await window.html2canvas(scope, {
      x: relX, y: relY, width: w, height: h,
      backgroundColor: null, logging: false, useCORS: true,
    });
  } catch (_) {
    block.style.visibility = prevVisibility;
    return false;
  }
  block.style.visibility = prevVisibility;
  if (!captured || !captured.width || !captured.height) return false;

  _fullResCache.set(block, captured);
  redrawFromFullRes(block, captured);
  return true;
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
