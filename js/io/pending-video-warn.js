/* pending-video-warn.js — 「아직 «GIF로 적용» 안 한 영상은 저장에서 빠진다」를 알리는 단 하나의 자리.
 *
 * ★왜 모았나 (T-032, 2026-09-21)
 *   이 알림은 처음에 «홈으로 나가기»(js/io/save-load.js goHome)와 «블럭 선택 해제»
 *   (js/editor.js clearSelection) 두 곳에 각각 복붙돼 있었다 — 판정식도 문구도 사본이 둘.
 *   여기에 «창 닫기»·«⌘S» 두 자리를 더하면 사본이 넷이 된다. 이 레포는 「손으로 적은 목록이
 *   하나만 안 고쳐져 생긴 사고」가 반복된 곳이다 ⇒ 자리를 늘리기 전에 «문구 하나·판정 하나»로 모은다.
 *
 * ★판정은 «명부»가 아니라 «성질»로 한다
 *   어떤 블록이 위험한지 목록으로 세지 않는다. 위험의 정의는 단 하나 —
 *   `data-asset-type="video-pending"`(js/image-handling.js setAssetVideoFromSrc 가 붙이고,
 *   js/props/asset-video-trim.js applyVideoTrimAsGif 가 뗀다). 그 성질이 캔버스에 남아 있으면
 *   js/io/section-serialize.js 의 T-012 세척이 저장에서 그 원본을 지운다.
 *
 * ⚠️잔소리 금지선 — 여기 있는 건 «알리는 함수»뿐이고 «언제 부를지»는 부르는 쪽이 정한다.
 *   구간 슬라이더처럼 «편집 중»인 동작에서는 부르지 않는다(떠나는 자리에서만 부른다).
 *   회귀: tests/unit/video-pending-warn.test.mjs · tests/dom/video-pending-warn.dom.spec.js
 */

/** 저장에서 원본이 빠지는 «미확정 영상» 블록의 성질. 이 선택자가 단일 진실원이다. */
export const PENDING_VIDEO_SELECTOR = '.asset-block[data-asset-type="video-pending"]';

/** 사용자가 보는 문구. ⛔다른 파일에 다시 적지 마라(검사 S-1 이 막는다). */
export const PENDING_VIDEO_MSG = '⚠️ 영상이 아직 GIF로 적용되지 않았습니다 — 저장하면 사라집니다';

/** root(기본: 캔버스) 안에 미확정 영상이 하나라도 있나. root 가 없으면 false(던지지 않는다). */
export function hasPendingVideo(root) {
  return !!(root && typeof root.querySelector === 'function' && root.querySelector(PENDING_VIDEO_SELECTOR));
}

/** 알림을 띄운다. 「띄웠다」를 true 로 돌려준다 — 부르는 쪽이 «보일 시간»을 줄지 정할 수 있게. */
export function warnPendingVideoLoss() {
  if (typeof window === 'undefined' || typeof window.showToast !== 'function') return false;
  window.showToast(PENDING_VIDEO_MSG);
  return true;
}

/** 미확정 영상이 있을 때«만» 알린다. 돌려주는 값은 「알렸나」. */
export function warnPendingVideoLossIf(root) {
  if (!hasPendingVideo(root)) return false;
  return warnPendingVideoLoss();
}

/* 창 닫기는 메인 프로세스가 가로채 렌더러에 묻는다(main.js mainWindow.on('close')) —
   beforeunload 는 동기라 토스트를 띄워도 창과 함께 사라진다. 그래서 window 에 노출한다. */
if (typeof window !== 'undefined') {
  window.hasPendingVideo = (root) => hasPendingVideo(root || window.canvasEl || document.getElementById('canvas'));
  window.warnPendingVideoLoss = warnPendingVideoLoss;
}
