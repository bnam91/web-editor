/* canvas-empty-hint.js — 「새 디자인을 눌렀는데 회색 화면뿐, 무엇을 먼저 할지 아무 말이 없다」
 *   (T-101 ①, 2026-09-21 사용자관점훑기 유닛 smallux)
 *
 * ★재현(실앱 9550 · New Design 직후, 실측)
 *     #canvas.children.length = 0 · innerText = '' · getBoundingClientRect 높이 0
 *     = 화면에 글자가 한 자도 없다. 레이어 패널도 비어 있어 단서가 없다.
 *
 * ★문구는 새로 짓지 않았다 — T-025(최초실행 스팟라이트 투어 기획, done)의 2단계
 *     「빈 캔버스 / 블록 삽입 툴바 / “텍스트·이미지·표 같은 블록을 여기서 캔버스로 꺼내요.”」
 *   를 그대로 빌려 왔다. 다만 이 앱의 «진짜 첫 클릭»은 블록이 아니라 섹션이라(블록은 섹션
 *   안에 들어간다) 첫 줄에 그 한 걸음을 앞세웠다. 투어 자체(스팟라이트·1회 노출 플래그·
 *   도움말 다시보기)는 T-025 가 «구현은 안 함»으로 닫힌 기획이므로 여기서 만들지 않는다.
 *
 * ⛔섹션이 늘고 주는 «경로»를 손으로 나열하지 않는다(추가·삭제·붙여넣기·undo/redo·템플릿
 *   삽입·프로젝트 로드·페이지 전환…). 그런 목록은 반드시 늙는다. 캔버스의 DOM 변화를
 *   MutationObserver 로 본다 — js/props/prop-page.js 의 「전체 섹션 내보내기」 버튼(0섹션이면
 *   비활성)이 쓰는 그 방식 그대로다.
 *
 * ★심는 자리는 #canvas-area 다(#canvas 안이 아니다)
 *   ⑴ #canvas 는 내보내기가 통째로 복제하는 나무다 — 안에 두면 산출물에 샌다.
 *      (css/editor-css-collect 의 제외 목록에도 #canvas-area 가 이미 들어 있다.)
 *   ⑵ #canvas-wrap 은 overflow:auto 라 안에 두면 힌트가 캔버스와 같이 스크롤된다.
 *   ⑶ #canvas-area 는 position:relative + isolation:isolate 라 절대배치가 이 영역에 갇힌다.
 */

const HINT_ID = 'canvas-empty-hint';

/** 지금 캔버스에 살아 있는 섹션 수(유령 제외). */
function sectionCount(canvas) {
  return canvas.querySelectorAll('.section-block:not([data-ghost])').length;
}

/** 힌트 표시를 «지금 섹션이 몇 개인가»로 다시 판정한다. 센 수를 돌려준다(못 재면 null). */
export function syncCanvasEmptyHint() {
  const hint   = document.getElementById(HINT_ID);
  const canvas = document.getElementById('canvas');
  if (!hint || !canvas) return null;
  const n = sectionCount(canvas);
  hint.hidden = n > 0;
  return n;
}

/** 힌트를 심고 캔버스 변화를 따라가게 한다. 이미 심겨 있으면 다시 맞추기만 한다. */
export function installCanvasEmptyHint() {
  const area   = document.getElementById('canvas-area');
  const canvas = document.getElementById('canvas');
  if (!area || !canvas) return null;

  let hint = document.getElementById(HINT_ID);
  if (!hint) {
    hint = document.createElement('div');
    hint.id = HINT_ID;
    /* role=status + aria-live=polite — 화면을 못 보는 사람에게도 «지금 비어 있다»가 전달된다.
       aria-hidden 으로 숨기지 않고 hidden 속성을 쓰는 이유: hidden 이면 보조기술에서도 빠진다. */
    hint.setAttribute('role', 'status');
    hint.setAttribute('aria-live', 'polite');
    hint.innerHTML =
      '<div class="canvas-empty-hint-title">아직 비어 있어요</div>' +
      '<div class="canvas-empty-hint-body">아래 툴바의 <b>＋</b>(새 섹션 추가)를 눌러 시작하세요.<br>' +
      '섹션 안에 텍스트·이미지·표 같은 블록을 넣습니다.</div>';
    area.appendChild(hint);
  }

  if (!area._gdtEmptyHintObs) {
    const obs = new MutationObserver(() => {
      if (!hint.isConnected) { obs.disconnect(); area._gdtEmptyHintObs = null; return; }
      syncCanvasEmptyHint();
    });
    try {
      obs.observe(canvas, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ghost'] });
      area._gdtEmptyHintObs = obs;
    } catch (_) {}
  }

  syncCanvasEmptyHint();
  return hint;
}

(function bindCanvasEmptyHint() {
  const init = () => installCanvasEmptyHint();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

window.installCanvasEmptyHint = installCanvasEmptyHint;
window.syncCanvasEmptyHint    = syncCanvasEmptyHint;
