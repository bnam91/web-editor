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

// ── 블록별 캡처 합치기(coalescing) + 세대 번호 (2026-09-19, fix/0918-redact) ──
// 예전엔 모자이크 버튼 한 번에 applyRedact·패널 재렌더·mouseup 디바운스가 각자 html2canvas 를
// 불러 «문서 전체 복제»가 최대 3번 겹쳤다(실측 9502: 1회 클릭 = 3회 호출, 1.0~1.3초). 그리고
// await 이 끝난 뒤 블록이 여전히 모자이크인지 안 봐서, 늦게 끝난 캡처가 블러/해제 뒤에 캔버스를
// 되살렸다. 이제:
//  - 진행 중 캡처가 있으면 새 요청은 dirty 표시만 하고 «같은 Promise»를 받는다. 진행 중 캡처가
//    끝나면 dirty 일 때 딱 1회 더 찍는다 — 그래서 어떤 요청이든 «요청 이후에 시작된 캡처»가
//    끝나야 resolve 된다(export 의 finalizeMosaicForClone 도 옛 스냅샷을 받지 않는다).
//  - invalidateMosaic 이 세대 번호를 올리면, 그 전에 시작된 캡처 결과는 버려진다.
// ⚠️ 전부 WeakMap/WeakSet(런타임 전용) — dataset 에 두면 저장 HTML·undo 스냅샷에 섞인다
//    (dataset.mosaicCaptured 사고, 2026-09-15).
const _inflight = new WeakMap(); // block → { dirty:boolean, promise:Promise<boolean> }
const _gen = new WeakMap();      // block → number (invalidate 마다 +1)

function _genOf(block) { return _gen.get(block) || 0; }

/** 이 블록이 «지금» 모자이크 가림막 상태인가 — 캡처 결과를 쓸 자격 확인. */
function _isLiveMosaic(block) {
  return !!block && block.isConnected
    && block.classList.contains('shape-redact')
    && block.dataset.shapeRedactMode === 'mosaic';
}

/** 캡처가 진행 중인가(패널 「캡처 중…」 표시용, 런타임 전용). */
export function isMosaicPending(block) {
  return !!block && _inflight.has(block);
}

/** 이 블록의 모자이크 상태를 전부 무효화한다 — 블러 전환·가림막 해제·타입 변경 시의 단일 창구.
 *  캐시·«캡처됨» 표시·캔버스를 지우고, 이미 진행 중인 캡처의 결과도 버려지게 세대 번호를 올린다. */
export function invalidateMosaic(block) {
  if (!block) return;
  _gen.set(block, _genOf(block) + 1);
  _fullResCache.delete(block);
  _capturedBlocks.delete(block);
  const inf = _inflight.get(block);
  if (inf) inf.dirty = false; // 뒤따르는 캡처 예약 취소(모드가 다시 mosaic 이 되면 새 요청이 다시 건다)
  block.querySelector(':scope > canvas.redact-mosaic-canvas')?.remove();
  delete block.dataset.mosaicCaptured;
}

/** block 밑에 깔린 콘텐츠를 캡처해 모자이크 캔버스를 갱신한다. 실패해도 조용히 무시(라이브
 *  캔버스는 이전 스냅샷을 그대로 들고 있으므로 안전 — export 단계의 안전실패가 최종 방어선).
 *  opts.reuseFullRes: true면 DOM을 다시 찍지 않고 캐시된 원본해상도 캡처만 재다운스케일
 *  (강도 슬라이더 드래그 중처럼 밑 콘텐츠는 그대로고 블록 크기만 바뀔 때).
 *  ★같은 블록에 진행 중 캡처가 있으면 합쳐진다(위 주석) — 반환 Promise 는 이 요청 «이후»
 *   시작된 캡처가 끝난 뒤 resolve 된다(opts.join 이면 예외: 진행 중 캡처 결과를 그대로 받음). */
export function captureMosaicSnapshot(block, opts) {
  if (!block) return Promise.resolve(false);
  if (opts?.reuseFullRes && _fullResCache.has(block)) {
    if (!_isLiveMosaic(block)) return Promise.resolve(false);
    redrawFromFullRes(block, _fullResCache.get(block));
    return Promise.resolve(true);
  }
  const running = _inflight.get(block);
  if (running) {
    // opts.join: «이미 도는 캡처에 결과만 얻어 타기»(패널 재렌더의 방어 동기화처럼, 새 변화가
    // 없는데 같은 순간 두 번 부르는 경우) — 뒤따르는 캡처를 예약하지 않는다.
    if (!opts?.join) running.dirty = true;
    return running.promise;
  }
  const entry = { dirty: false, promise: null };
  entry.promise = (async () => {
    let result = false;
    try {
      for (;;) {
        entry.dirty = false;
        result = await _captureOnce(block);
        if (!(entry.dirty && _isLiveMosaic(block))) break;
        // 뒤따르는 캡처 전에 한 턴 양보 — html2canvas 의 동기 문서 복제가 바로 이어지면 방금 그린
        // 첫 결과가 화면에 칠해지지 못한 채 ~0.4초 더 묶인다(실측 9502: 캡처 완료 410ms 인데
        // 화면 반영 715ms). 양보하면 첫 결과가 먼저 보이고 뒤따르는 캡처는 그 뒤에 덮어쓴다.
        await new Promise((r) => setTimeout(r, 32));
        if (!(entry.dirty && _isLiveMosaic(block))) break;
      }
    } catch (_) {
      result = false;
    } finally {
      if (_inflight.get(block) === entry) _inflight.delete(block);
    }
    return result;
  })();
  _inflight.set(block, entry);
  return entry.promise;
}

async function _captureOnce(block) {
  if (!_isLiveMosaic(block)) return false;
  if (typeof window.html2canvas !== 'function') return false;
  const scope = block.closest('.section-block') || block.parentElement;
  if (!scope) return false;
  const gen = _genOf(block);
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
   * «거의 다 투명»한 캡처를 돌려주는 경우가 확인됐다(정확한 근본원인은 미확정 — html2canvas
   * 내부가 offscreen clone 존재로 뭔가 오작동하는 것으로 추정). 그걸 그대로 신뢰해
   * _capturedBlocks 에 "캡처됨"으로 마킹하면, 실제로는 빈(또는 거의 빈) 비트맵이 기존의
   * «정상 스냅샷»(또는 안전실패 회색)을 덮어써 finalizeMosaicForClone 이 원본을 그대로
   * 내보내는 사고로 이어진다(라이브는 안전한데 export PNG 만 새는 형태로 실측됨). 의심스러운
   * 결과는 "캡처 실패"로 취급해 기존 상태(_fullResCache/canvas)를 그대로 둔다 — 원인을 못
   * 밝혀도 결과는 안전하게.
   * ★2차수정(a1-a3 코드리뷰 지적, 2건 모두 타당해서 반영):
   *   ① 예전엔 "완전 투명(알파 전부 0)"만 걸렀는데, 16×16 다운샘플이 스무딩(평균/블렌딩)을
   *      쓰면 "대부분 투명 + 일부만 찍힌" 부분 누수가 옅게 뭉개져 알파>8 기준을 통과해
   *      버린다. ⇒ 작은 캔버스(≤250,000px)는 다운샘플 없이 «전체 픽셀»을 그대로 읽고, 큰
   *      캔버스만 스무딩을 «끈» 근접샘플(평균 없음)로 촘촘히 본다. 그리고 "완전 투명"이 아니라
   *      "불투명 픽셀 비율 5% 미만"이면 의심 — 부분 누수도 대부분 이 문턱에 걸린다.
   *   ② 예전엔 getImageData 가 던지면(CORS 오염된 캔버스 등) "투명 아님(=신뢰)"으로
   *      기본값을 잡았다 — 검증 실패를 "괜찮음"으로 읽는 실패열림(fail-open)이었다. 검증
   *      불가는 "의심"과 같은 취급이어야 한다(실패닫힘) — catch 에서도 true(의심스러움)를
   *      돌려준다. */
  if (_isSuspiciouslyBlank(captured)) return false;
  // ★늦게 끝난 캡처 차단(2026-09-19): await 사이에 블러로 바뀌었거나, 가림막이 꺼졌거나,
  //   DOM 에서 떨어졌거나(undo/redo 가 노드를 새로 만듦), invalidate 됐으면 결과를 버린다 —
  //   캔버스·캐시·«캡처됨» 표시를 건드리지 않는다(예전엔 여기서 캔버스를 되살렸다).
  if (!_isLiveMosaic(block) || _genOf(block) !== gen) return false;

  _fullResCache.set(block, captured);
  redrawFromFullRes(block, captured);
  return true;
}

/** canvas 가 «의심스럽게 비어있는»(불투명 픽셀이 사실상 없는) 결과인지 판정.
 *  ⛔"완전 투명"만 보지 않는다 — 다운샘플 평균으로 옅게 뭉개진 부분 누수도 잡으려면
 *    "거의 다 투명"(5% 미만)까지 걸러야 한다(위 ① 참고).
 *  ⛔읽기 실패는 "의심 아님"이 아니라 "의심스러움"으로 처리한다(실패닫힘, 위 ② 참고) —
 *    이 함수는 «검증됐다»고 확신할 때만 false 를 돌려줘야 한다. */
function _isSuspiciouslyBlank(canvas) {
  try {
    const w = canvas.width, h = canvas.height;
    if (!w || !h) return true;
    let data, total;
    const area = w * h;
    if (area <= 250000) {
      // 작은 캔버스(모자이크 redact 블록은 보통 이 범위)는 다운샘플 없이 «전체»를 읽는다 —
      // 평균으로 옅게 뭉개져 부분 누수가 숨는 것을 막는다.
      const ctx = canvas.getContext('2d');
      data = ctx.getImageData(0, 0, w, h).data;
      total = w * h;
    } else {
      // 큰 캔버스는 스무딩을 «끈» 근접샘플(블렌딩 없음)로 촘촘히 — 다운샘플은 하되
      // 평균은 안 낸다.
      const sw = 64, sh = 64;
      const probe = document.createElement('canvas');
      probe.width = sw; probe.height = sh;
      const pctx = probe.getContext('2d');
      pctx.imageSmoothingEnabled = false;
      pctx.drawImage(canvas, 0, 0, sw, sh);
      data = pctx.getImageData(0, 0, sw, sh).data;
      total = sw * sh;
    }
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 8) opaque++;
    }
    return (opaque / total) < 0.05; // 불투명 픽셀이 5% 미만이면 의심스럽다.
  } catch (_) {
    return true; // 읽기 실패 = 검증 불가 = 의심스러움(실패닫힘) — "투명 아님"으로 단정하지 않는다.
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
window.invalidateMosaic        = invalidateMosaic;
window.isMosaicPending         = isMosaicPending;

wireMosaicAutoRefresh();
