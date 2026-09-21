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

import { prepareGoyaAssetsForClone } from '../io/goya-asset-inline.js';

const MOSAIC_FAIL_SAFE_FILL = '#4a4a4a';

/** ★모자이크 임시 킬스위치(js/feature-flags.js REDACT_MOSAIC_ENABLED, 2026-09-20 «0920b-mosaic-off» T-070).
 *  html2canvas 가 goya-asset:// 이미지를 못 싣는 문제(별도 카드 T-071 «0920b-mosaic-cause»)가 고쳐질
 *  때까지 «캡처로 들어가는 문»을 여기 하나에서 닫는다 — 호출처(패널·goditor-api·로드후·mouseup
 *  디바운스)를 각각 막으면 새 호출처가 생길 때 샌다.
 *  ⛔비교는 반드시 `=== false` 다 — 플래그를 «안 얹는» 하네스(tests/dom 의 기존 모자이크 스펙 5개)는
 *    undefined 라 «켜짐»으로 동작해야 그 스펙들이 그대로 초록이다(스펙 수정 0건).
 *  ⛔finalizeMosaicForClone·invalidateMosaic 에는 걸지 않는다 — export 안전실패(원본 대신 회색)
 *    경로라, 막으면 오히려 원본이 샐 수 있다. */
function mosaicDisabled() {
  return typeof window !== 'undefined' && window.REDACT_MOSAIC_ENABLED === false;
}

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

// ★칸 수는 «캔버스(줌 적용 전) 크기» ÷ 칸 크기로 정한다(2026-09-19, 0918 리뷰 medium).
//   예전엔 getBoundingClientRect(화면 px, 줌 적용)로 나눠서 같은 100×100 가림막이 줌 40%=1×1칸(단색),
//   100%=4×4, 150%=6×6 이 됐고, finalizeMosaicForClone 이 이 캔버스를 export 크기로 늘려 그대로
//   내보냈다 — 줌을 키워 두고 내보내면 칸이 mosaicBlockPxFromSlider 의 16px 하한보다 잘아진다
//   (가리는 기능이라 프라이버시 쪽 결함). offsetWidth/Height 는 줌·회전 transform 과 무관한 레이아웃
//   크기라 어느 줌에서든 칸 수가 같다. 원본 캡처(fullRes)는 화면 좌표로 찍혀도 상관없다 — 다운스케일만 한다.
function _layoutSize(block) {
  if (block.offsetWidth > 0 && block.offsetHeight > 0) return { w: block.offsetWidth, h: block.offsetHeight };
  const rect = block.getBoundingClientRect();
  const z = (Number(window.currentZoom) > 0 ? Number(window.currentZoom) : 100) / 100;
  return { w: rect.width / z, h: rect.height / z };
}

function redrawFromFullRes(block, fullRes) {
  const sz = _layoutSize(block);
  const w = Math.max(1, Math.round(sz.w));
  const h = Math.max(1, Math.round(sz.h));
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
// 이 블록의 가장 최근 html2canvas «시작» 시각(performance.now 기준). html2canvas 는 호출 순간
// 동기로 문서를 복제하므로, 시작 시각 이후의 DOM 변화만 그 캡처에 빠진다. mouseup 디바운스가
// «그 mouseup 이후에 이미 시작된 캡처»를 중복으로 다시 부르지 않게 하는 데 쓴다(0918 픽스 라운드).
const _lastStart = new WeakMap();

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
  if (mosaicDisabled()) return Promise.resolve(false); // ★킬스위치 — html2canvas 호출 0회
  if (!block) return Promise.resolve(false);
  if (opts?.reuseFullRes && _fullResCache.has(block)) {
    if (!_isLiveMosaic(block)) return Promise.resolve(false);
    redrawFromFullRes(block, _fullResCache.get(block));
    return Promise.resolve(true);
  }
  const running = _inflight.get(block);
  // opts.since(ms, performance.now 시간축): «이 시각 이후에 시작된 캡처»면 이미 충분하다 —
  // mouseup 디바운스 전용. 방식 버튼 클릭(mousedown→mouseup→click)은 click 에서 캡처를 시작하므로
  // 그 캡처가 이미 mouseup 뒤의 DOM 을 찍고 있다 → 뒤따르는 캡처(html2canvas 1회 추가)를 걸지 않는다.
  if (opts && typeof opts.since === 'number') {
    const started = _lastStart.get(block);
    if (started !== undefined && started >= opts.since) {
      if (running) return running.promise;
      return Promise.resolve(isMosaicCaptured(block));
    }
  }
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
  // ★크롭 좌표 = «화면(줌 적용) 좌표» 그대로 — 줌 배율로 나누지 않는다(2026-09-19, T-061 픽스 라운드).
  //   html2canvas 1.4.1 은 복제 iframe 안에서 scope 의 getBoundingClientRect(=조상
  //   #canvas-scaler 의 transform:scale 이 «적용된» 크기)로 캔버스 크기를 잡고, 자식들도
  //   getBoundingClientRect 로 그린다(vendor 소스: x = opts.x + bounds.left). 즉 렌더 좌표계가
  //   곧 화면 좌표계다. 실측(9502, 줌 41%): 크롭 없이 찍은 섹션 = 706×314 = 화면 크기 353×157 × dpr2.
  //   a82c035 이 넣은 «÷줌»은 이 전제와 반대여서, 100% 미만 줌(신규 기본값 40%!)에선 크롭이 블록보다
  //   2.5배 크고 엉뚱한 자리(섹션 밖 투명 영역 포함)를 잡아 _isSuspiciouslyBlank 가 매번 «실패»로
  //   판정 → 모자이크가 영영 회색(#4a4a4a)에 머물렀다(「모자이크 버튼 눌러도 안 된다」의 본체).
  //   실패가 안전 쪽(회색)이라 원본 노출은 없었다. 좌표가 맞는지는 tests/dom 의 줌 스펙과 실앱
  //   40%·100%·150% 픽셀 대조(밑 좌/우 색이 모자이크 좌/우에 그대로 나오는가)로 고정한다.
  const relX = rect.left - scopeRect.left;
  const relY = rect.top - scopeRect.top;
  const capW = w;
  const capH = h;

  /* ★★«모자이크가 안 된다»의 본체 (2026-09-22 실측, 카드 T-071 «0920b-mosaic-cause») ──────────
   *  html2canvas 는 이미지를 «자기가 다시 로드»하는데, goya-asset:// (v0.8.0 이미지 외부화 이후
   *  캔버스 이미지의 «정상» 형태)를 어느 축으로도 못 읽는다:
   *    useCORS:true  → crossOrigin="anonymous" 를 달고 로드 → CORS 헤더가 없어 onerror
   *                    (실측: 같은 URL 이 crossOrigin 없이는 naturalWidth 64 로 멀쩡히 뜬다)
   *    useCORS:false → vendor 의 로드 조건(same-origin/data:/blob:/proxy/useCORS)이 전부 거짓 →
   *                    그 이미지를 «읽지도 않는다»
   *  ⇒ 사진이 빠진 자리에 섹션 배경(흰색)이 그대로 찍힌다. 흰색은 «불투명»이라
   *    _isSuspiciouslyBlank(불투명 5% 미만)에 안 걸리고, 그래서 이 캡처는 «성공»으로 보고됐다.
   *    실측(실앱 9646 · 줌 40%): 밑 체커보드 red 2048·blue 2048 인데 모자이크 캔버스 16픽셀이
   *    «전부 255,255,255», captureMosaicSnapshot=true, isMosaicCaptured=true.
   *    ⇒ 사용자 화면엔 «단색 네모». 회색 안전실패(#4a4a4a)도, 패널의 「캡처 실패」 표시도 안 떴다
   *      — 그래서 8번을 고쳤는데도 «여전히 안 된다» 였다(feature-flags.js 의 차단 사유 주석 참고).
   *  ⇒ 답 = html2canvas 에게 «그가 읽을 수 있는 것»만 준다. 라이브 DOM 은 한 글자도 안 고치고
   *    (goya-asset 은 화면엔 잘 그려진다), html2canvas 가 만든 «클론에서만» data: 로 갈아끼운다.
   *  ⛔실패를 삼키지 마라 — 하나라도 못 풀면 캡처를 «실패»로 끝낸다. 그래야 회색 안전실패가
   *    남고 패널이 「캡처 실패 — 다시 시도」를 띄운다(조용한 흰 네모로 돌아가는 길을 닫는다). */
  // ★프라이버시(2026-09-15): 예전엔 block.style.visibility='hidden'으로 라이브 DOM을
  // 실제로 숨긴 뒤 await 하고 되돌렸다 — html2canvas가 밑 콘텐츠를 찍는 수백ms 동안
  // 화면의 가림막(회색/모자이크)이 통째로 사라져 재캡처 때마다(슬라이더 드래그, 다른
  // 블록 이동 등 임의의 mouseup) 원본이 깜빡이며 노출됐다(a1-a3 코드리뷰 지적, T-027).
  // html2canvas의 ignoreElements로 "이 블록만 캡처 대상에서 제외"하면, 라이브 화면은
  // 한순간도 안 바뀐 채(가림막 계속 보임) 오프스크린 캡처 결과에서만 그 블록이 빠져
  // 밑 콘텐츠가 드러난다 — 같은 효과를 화면에 아무 변화 없이 얻는다.
  /* ⛔에셋 해결(async)은 html2canvas «앞»이 아니라 onclone «안»에서 한다 — html2canvas 는
   *  호출 순간 문서를 «동기로» 복제하고, onclone 의 반환 Promise 는 기다려 준다
   *  (vendor: Promise.resolve().then(onclone).then(…)). 앞으로 빼면 «요청 → 복제» 사이에
   *  await 가 끼어 그 사이의 DOM 변화가 캡처에서 빠지고, _lastStart/since 로 세운 중복
   *  캡처 합치기의 전제(「부르는 순간 찍힌다」)도 같이 흔들린다. */
  let unresolvedAssets = [];
  let captured;
  try {
    _lastStart.set(block, performance.now());
    captured = await window.html2canvas(scope, {
      x: relX, y: relY, width: capW, height: capH,
      // 모자이크 셀은 최소 16 CSS px 라 dpr(2) 해상도가 필요 없다 — 1배로 찍어 픽셀 수를 1/4 로.
      scale: 1,
      backgroundColor: null, logging: false, useCORS: true,
      ignoreElements: (el) => el === block,
      // ★클론에서만 goya-asset → data:. 라이브 DOM 은 한 글자도 안 바뀐다.
      onclone: async (doc) => {
        const a = await prepareGoyaAssetsForClone(scope);
        unresolvedAssets = a.unresolved;
        a.apply(doc);
      },
    });
  } catch (_) {
    return false;
  }
  /* ⛔하나라도 못 읽었으면 «실패»다 — 그 자리는 사진이 빠진 채(섹션 배경색) 찍혔고, 그건
   *  불투명해서 _isSuspiciouslyBlank 를 그냥 통과한다. 통과시키면 «단색 네모를 성공으로
   *  보고»하는 이 카드의 원래 결함이 그대로 돌아온다. 실패는 안전 쪽(회색 #4a4a4a)이고,
   *  패널이 「캡처 실패 — 다시 시도」를 띄운다(prop-shape.js _trackMosaicCapture). */
  if (unresolvedAssets.length) {
    console.warn('[redact-mosaic] goya-asset 을 못 읽어 캡처를 실패로 끝낸다(회색 유지):', unresolvedAssets);
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
let _refreshSince = null;
function scheduleRefreshAllVisible(e) {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  // 디바운스로 묶인 여러 mouseup 중 «가장 이른» 것 기준 — 그 뒤에 시작된 캡처만 «충분»으로 본다.
  // event.timeStamp 는 이벤트 생성 시각(= 같은 mouseup 의 다른 핸들러가 시작한 캡처보다 앞선다).
  const t = (e && typeof e.timeStamp === 'number' && e.timeStamp > 0) ? e.timeStamp : performance.now();
  _refreshSince = (_refreshSince === null) ? t : Math.min(_refreshSince, t);
  _refreshTimer = setTimeout(() => {
    _refreshTimer = null;
    const since = _refreshSince;
    _refreshSince = null;
    const blocks = document.querySelectorAll('.shape-block.shape-redact[data-shape-redact-mode="mosaic"]');
    blocks.forEach((b) => { captureMosaicSnapshot(b, { since }); });
  }, 120);
}

let _wired = false;
/** 편집 중 이벤트 기반 갱신 — 어떤 mouseup이든(도형 자체 이동/리사이즈뿐 아니라 밑에 깔린
 *  다른 블록을 옮기는 경우도 포함) 화면에 있는 모자이크 redact들을 재캡처한다.
 *  매 프레임이 아니라 "상호작용 종료 시" 1회이므로 비용이 크지 않다. */
export function wireMosaicAutoRefresh() {
  if (mosaicDisabled()) return; // ★킬스위치 — 문서 mouseup 리스너 자체를 안 건다
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

/** 로드·복원 직후 일괄 캡처 — ★0919 QA: 프로젝트를 다시 열면 모자이크가 20초 넘게 안전실패 회색으로만 보였다
 *  (입력이 없으면 재캡처가 안 일어남). 로드 «즉시» 한 번 부르던 캡처는 이미지·레이아웃이 아직 안 선 상태라
 *  _isSuspiciouslyBlank 에 걸려 실패로 끝나고, 다시 부를 계기가 없었다. 반면 PNG 내보내기는 finalizeMosaicForClone
 *  이 다시 찍어 정상 — 화면과 PNG 가 달랐다.
 *  → 섹션의 이미지가 다 뜬 뒤 시도하고, 실패하면 물러나며 몇 번 더(250ms·0.8s·2s·5s). 이미 캡처됐거나
 *    더 이상 모자이크가 아니면(블러 전환·삭제·undo 로 노드 교체) 멈춘다. 실패는 계속 안전 쪽(회색). */
const _LOAD_RETRY_MS = [250, 800, 2000, 5000];
async function _waitImages(scope) {
  if (!scope || !scope.querySelectorAll) return;
  const imgs = [...scope.querySelectorAll('img')].filter(i => !i.complete);
  if (!imgs.length) return;
  await Promise.race([
    Promise.all(imgs.map(i => new Promise(r => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }))),
    new Promise(r => setTimeout(r, 3000)),
  ]);
}
export function captureMosaicsAfterLoad(root) {
  if (mosaicDisabled()) return; // ★킬스위치 — 로드 후 재시도 루프(최대 5회)도 안 돈다
  const scope = root || document;
  const blocks = [...scope.querySelectorAll('.shape-block.shape-redact[data-shape-redact-mode="mosaic"]')];
  blocks.forEach(async (b) => {
    if (isMosaicCaptured(b)) return;
    try { await _waitImages(b.closest('.section-block')); } catch (_) {}
    for (let i = 0; i <= _LOAD_RETRY_MS.length; i++) {
      if (!_isLiveMosaic(b) || isMosaicCaptured(b)) return;
      let ok = false;
      try { ok = await captureMosaicSnapshot(b); } catch (_) { ok = false; }
      if (ok || isMosaicCaptured(b)) return;
      if (i < _LOAD_RETRY_MS.length) await new Promise(r => setTimeout(r, _LOAD_RETRY_MS[i]));
    }
  });
}

window.captureMosaicsAfterLoad = captureMosaicsAfterLoad;
window.captureMosaicSnapshot   = captureMosaicSnapshot;
window.wireMosaicAutoRefresh   = wireMosaicAutoRefresh;
window.finalizeMosaicForClone  = finalizeMosaicForClone;
window.mosaicBlockPxFromSlider = mosaicBlockPxFromSlider;
window.isMosaicCaptured        = isMosaicCaptured;
window.invalidateMosaic        = invalidateMosaic;
window.isMosaicPending         = isMosaicPending;

wireMosaicAutoRefresh();

/* ★킬스위치가 켜져 있으면 body 에 표시를 붙인다 — CSS(css/editor-blocks.css)가 이 클래스 아래에서만
   «모자이크로 저장된 블록»을 회색(#4a4a4a) 대신 블러로 보여준다.
   ⒜ 클래스를 «모듈이 스스로» 붙이는 방식은 body.sel-ov(selection-overlay.js)의 선례 그대로다 —
      JS 가 죽으면 클래스가 안 붙고 옛 동작(불투명 회색)이 남아 «제품이 성립»한다(안전 쪽 실패).
   ⒝ 이 모듈은 index.html 에서만 로드되므로 프로젝트 목록 화면(pages/projects.html)엔 안 닿는다 —
      거기엔 캔버스가 없어 닿을 필요도 없다. */
if (mosaicDisabled()) document.body?.classList.add('redact-mosaic-off');
