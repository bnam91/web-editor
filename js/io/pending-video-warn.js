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

/** 알림을 띄운다. ⛔래치를 «안» 거친다 — 「한 번만」이 필요한 자리는 warnPendingVideoLossIf 를 써라.
 *  「띄웠다」를 true 로 돌려준다 — 부르는 쪽이 «보일 시간»을 줄지 정할 수 있게. */
export function warnPendingVideoLoss() {
  if (typeof window === 'undefined' || typeof window.showToast !== 'function') return false;
  window.showToast(PENDING_VIDEO_MSG);
  return true;
}

/* ══ 「한 번만」 래치 (T-032, 2026-09-22) ═══════════════════════════════════════
   ★왜 필요한가 — 실측(dev 12865a1, 포트 9643): 미확정 영상 블럭을 선택했다 푸는 것을
     5회 되풀이하면 알림이 «5회» 떴고, ⌘S 를 3회 누르면 «3회» 떴다. 카드가 말하는
     「한 번만」이 아니다. 나가는 자리가 넷(홈·⌘S·창닫기·탭전환)이라, 래치를 부르는
     쪽마다 두면 사본이 넷이 된다 ⇒ 판정·문구와 «같은 자리»에 둔다.

   ★무엇을 「한 번」의 단위로 삼나 = «지금 위험에 놓인 영상들» 그 자체.
     블럭 id 로는 안 된다 — 같은 블럭에 GIF 적용 후 «다른 영상»을 다시 넣으면 id 가
     같아서 영영 안 알리게 된다(거짓 음성). 그래서 원본 dataURL 의 «길이 + 꼬리 32자»를
     신원으로 쓴다. 전량을 비교하면 매 호출마다 수 MB 문자열을 만든다.
   ⛔DOM 노드에 표시를 달지 않는다 — undo/redo·페이지전환이 innerHTML 을 통째로 갈아
     노드가 새로 나므로(같은 id, 다른 노드) 표시가 조용히 지워져 다시 알리게 된다.

   ★래치가 «풀리는» 자리는 하나뿐 — 미확정 영상이 하나도 없을 때(적용했거나 지웠다).
     그때 null 로 되돌려, 다음에 새로 넣은 영상은 다시 한 번 알린다.
   회귀: tests/unit/video-pending-warn.test.mjs(S-8~S-11) · tests/dom/video-pending-warn.dom.spec.js(P6~P8)
   ══════════════════════════════════════════════════════════════════════════ */

/** 지금 캔버스에 놓인 «미확정 영상들»의 신원. 없으면 빈 문자열. */
function pendingVideoIdentity(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return '';
  const parts = [];
  root.querySelectorAll(PENDING_VIDEO_SELECTOR).forEach(ab => {
    const src = (ab.dataset && ab.dataset.imgSrc) || '';
    parts.push(`${src.length}@${src.slice(-32)}`);
  });
  return parts.sort().join('|');
}

let _warnedIdentity = null;

/** 미확정 영상이 있고 «아직 그 영상들로 알린 적이 없을 때»만 알린다. 돌려주는 값은 「알렸나」. */
export function warnPendingVideoLossIf(root) {
  const identity = pendingVideoIdentity(root);
  if (!identity) { _warnedIdentity = null; return false; }  // 없다 ⇒ 안 알리고 래치도 푼다
  if (identity === _warnedIdentity) return false;           // 이 영상들로는 이미 알렸다
  if (!warnPendingVideoLoss()) return false;                // 못 띄웠으면 래치를 걸지 않는다
  _warnedIdentity = identity;
  return true;
}

/** 검사 전용 — 래치를 처음 상태로 되돌린다. ⛔제품 코드에서 부르지 마라. */
export function resetPendingVideoWarnLatch() {
  _warnedIdentity = null;
}

/* 창 닫기는 메인 프로세스가 가로채 렌더러에 묻는다(main.js mainWindow.on('close')) —
   beforeunload 는 동기라 토스트를 띄워도 창과 함께 사라진다. 그래서 window 에 노출한다. */
if (typeof window !== 'undefined') {
  const _root = (root) => root || window.canvasEl || document.getElementById('canvas');
  window.hasPendingVideo = (root) => hasPendingVideo(_root(root));
  window.warnPendingVideoLoss = warnPendingVideoLoss;
  /* ★창 닫기는 이걸 부른다 — 판정·알림·「한 번만」이 한 번의 호출에 다 들어 있어야
     메인 프로세스 쪽에 판정 사본이 안 생긴다(예전엔 hasPendingVideo && warnPendingVideoLoss
     둘을 이어 붙여 래치를 건너뛰었다). */
  window.warnPendingVideoLossIf = (root) => warnPendingVideoLossIf(_root(root));
  window.resetPendingVideoWarnLatch = resetPendingVideoWarnLatch;
}
