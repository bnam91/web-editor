/* ══════════════════════════════════════════════════════════════════════════
   export-gate.js — 내보내기 «자동 픽셀검사»의 DOM 계층 (P0 · B안 «주고 알린다»)
   현빈 발주(2026-09-05): 「내보내기 할 때 픽셀디프 스스로 하고 문제 있으면 보고.
     결과 모달도 떠야겠지. 지금은 베타라 항상 검사. 클라이언트가 내보내기 쓸 때마다
     자동으로 돌고, 사람들은 결과만 받아 보면 된다.」 → 시안 B 확정.

   ⛔이 파일은 «파일을 막지 않는다». 다운로드는 exportSection 에서 이미 끝났고,
     여기가 무엇을 하든 사용자는 파일을 받는다. A안(막기)으로 바꾸는 자리는
     export-image.js 의 triggerDownload 호출 «하나»다(PLAN §11).

   검사의 정의 한 줄: export 그림과 truth 그림의 차이 = «export 전용 변환(③)»뿐이다.
     truth = ①prepareCloneForCapture → ②renderComponentsInClone → ④captureCloneToCanvas
     export = 위 + ③(평탄화 / bg→canvas / box-shadow→border / 필터 bake)
   ⇒ ①②④ 는 export-image.js 의 «같은 함수»를 부른다. 사본을 두면 그 어긋남이
     «검출»로 둔갑한다(하네스에서 실제로 그랬다).
   ══════════════════════════════════════════════════════════════════════════ */
import { prepareCloneForCapture, renderComponentsInClone, captureCloneToCanvas, sectionBgColor } from './export-image.js';
import { compareRGBA, judgeExportDiff } from './export-gate-core.js';

/** 이 빌드에서 검사가 «가능한가». 웹 빌드엔 CDP 캡처가 없다 → 검사 자체를 안 건다. */
export function isGateSupported() {
  return !!(window.electronAPI && window.electronAPI.captureSectionCdp);
}

/* ── truth 캡처 ────────────────────────────────────────────────────────────
   ⚠️export 클론이 «지워진 뒤»에 불러야 한다 — 둘 다 top:-99999px;left:0 이라 겹친다.
   ★폰트를 «한 번 더» 기다린다: 렌더러(②)가 새로 만든 요소의 폰트는 ①의 fonts.ready
     시점엔 «요청조차 안 된» 상태라 그때는 즉시 resolve 한다. 안 기다리면 대체 폰트로
     찍힌 truth 가 나오고, 같은 export 에 대해 TOTAL 이 1,476 ↔ 15,585 로 흔들린다
     (2026-08-28 sec_0g02j5t 실측). */
async function captureTruth(sec, w, bgColor) {
  const clone = await prepareCloneForCapture(sec, w, true);
  try {
    renderComponentsInClone(clone);
    await document.fonts.ready;
    clone.getBoundingClientRect();
    return await captureCloneToCanvas(clone, w, bgColor, true);
  } finally {
    if (clone.parentNode) clone.parentNode.removeChild(clone);
  }
}

function canvasToImageData(cv) {
  return cv.getContext('2d').getImageData(0, 0, cv.width, cv.height);
}

/* ── 검사 한 판 ────────────────────────────────────────────────────────────
   반환: { tier, reasons[], metrics, ms }  — 사용자에게 보이는 «판정»은 judgeExportDiff
   하나가 만든다. 여기서 tier 를 다시 계산하지 않는다.
   @param {object} io { exportCanvas, imgTimedOut, native, format, bgColor, sectionId }  */
export async function runExportGate(sec, w, io) {
  const t0 = performance.now();
  const ctx = {
    native: io.native !== false,
    format: io.format,
    imgTimedOut: !!io.imgTimedOut,
    captureError: false,
    repro: null,
  };
  let metrics = null;
  const timing = { truthMs: 0, cmpMs: 0, reproMs: 0 };

  // «못 잴 조건»이면 truth 를 뜨지도 않는다 — 비용을 안 쓴다.
  const pre = judgeExportDiff(null, ctx);
  if (pre.tier === 'unmeasured' && (ctx.native === false || ctx.format === 'gif' ||
      ctx.format === 'gif-anim' || ctx.imgTimedOut)) {
    return _log(sec, { tier: pre.tier, reasons: pre.reasons, metrics: null, ms: performance.now() - t0, timing });
  }
  if (!io.exportCanvas) {
    ctx.captureError = true;
    const v = judgeExportDiff(null, ctx);
    return _log(sec, { tier: v.tier, reasons: v.reasons, metrics: null, ms: performance.now() - t0, timing });
  }

  let truth1 = null;
  try {
    const a0 = performance.now();
    truth1 = await captureTruth(sec, w, io.bgColor);
    timing.truthMs = performance.now() - a0;
    // ★truth 쪽 이미지 대기가 터졌으면 «그 실행»을 못 쟀다고 해야 한다. export 만 봐선 모른다.
    if (truth1.imgTimedOut) ctx.imgTimedOut = true;
    const c0 = performance.now();
    metrics = compareRGBA(canvasToImageData(io.exportCanvas), canvasToImageData(truth1.canvas));
    timing.cmpMs = performance.now() - c0;
  } catch (err) {
    // ⚠️오류를 «삼키면» 그 위의 모든 판정이 거짓말이 된다 — 「검사했는데 정상」이 아니라
    //   「검사를 못 했다」가 사실이다.
    console.warn('[export-gate] truth 캡처/비교 실패:', err);
    ctx.captureError = true;
  }

  let verdict = judgeExportDiff(metrics, ctx);

  /* ★재검사(재현성) — «문제»라고 말하기 «전»에 「이 측정이 재현되나」부터 묻는다.
     truth 를 한 번 더 떠서 truth₁ vs truth₂ 가 0 이 아니면 그 실행은 못 믿는다.
     PASS 경로엔 비용 0 — mismatch 경로에서만 1회 더 뜬다.
     흔들리는 truth 가 만드는 오탐을 «규칙»이 아니라 «구조»로 막는 자리다. */
  if (verdict.tier === 'mismatch') {
    try {
      const r0 = performance.now();
      const truth2 = await captureTruth(sec, w, io.bgColor);
      const rm = compareRGBA(canvasToImageData(truth1.canvas), canvasToImageData(truth2.canvas));
      timing.reproMs = performance.now() - r0;
      ctx.repro = (rm.sizeMismatch || rm.total !== 0) ? 'unstable' : 'stable';
      if (metrics) metrics.reproDiff = rm.sizeMismatch ? 'SIZE' : rm.total;
    } catch (err) {
      console.warn('[export-gate] 재검사 실패:', err);
      ctx.repro = 'unstable';
    }
    verdict = judgeExportDiff(metrics, ctx);
  }

  return _log(sec, { tier: verdict.tier, reasons: verdict.reasons, metrics, ms: performance.now() - t0, timing });
}

function _log(sec, r) {
  const m = r.metrics;
  console.log('[export-gate]', JSON.stringify({
    sid: sec && sec.id, tier: r.tier, reasons: r.reasons,
    total: m ? m.total : null, maxCell: m ? m.maxCell : null, blobPx: m ? m.blobPx : null,
    bandCount: m ? m.bandCount : null, truthBandCount: m ? m.truthBandCount : null,
    sizeMismatch: m ? m.sizeMismatch : null, maxDx: m ? m.maxDx : null, maxDy: m ? m.maxDy : null,
    reproDiff: m ? (m.reproDiff ?? null) : null,
    ms: Math.round(r.ms), truthMs: Math.round(r.timing.truthMs),
    cmpMs: Math.round(r.timing.cmpMs), reproMs: Math.round(r.timing.reproMs),
  }));
  /* ⛔여기서는 신고 버퍼에 «담지 않는다» — 옮겼다(js/io/export-report.js).
     이 자리의 note 는 tier 와 무관하게 «내보낼 때마다» 한 줄씩 담았다. 링버퍼는 20칸이라
     22섹션짜리 전체 내보내기 한 번이면 그것만으로 버퍼가 다 찬다 — 정작 실패한 섹션의 줄도,
     그 앞에 쌓여 있던 console.error 도 밀려나 «신고가 껍데기»가 된다(2026-09-05 지디 검수).
     그리고 담기던 sec.id 는 `sec_<actorId>_…` 라 설치 고정 식별자를 실어 보내면서
     정작 재현에 필요한 형식·폭·블록 구성·예외는 없었다.
     ⇒ 지금은 exportSection 래퍼가 «실패에서만», «재현에 쓰이는 값»으로 담는다.
     ★콘솔 로그(위)는 그대로다 — 그건 이 기계에만 남고 아무 데도 안 간다. */
  return r;
}

// 앱 안에서 검산·실험용으로 부를 수 있게 노출(외부 하네스는 여전히 pixdiff.py 를 쓴다).
window.__exportGate = { runExportGate, captureTruth, compareRGBA, judgeExportDiff, canvasToImageData, sectionBgColor };
