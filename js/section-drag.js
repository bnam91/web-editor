/* ═══════════════════════════════════
   SECTION / GROUP / ROW DRAG HELPERS
   HTML5 drag-and-drop for sections, groups, rows
   Extracted from drag-drop.js (lines ~1011–1257)
═══════════════════════════════════ */

import { state } from './globals.js';
import { toFlowUnit, isBlockEl, isEmptyShell } from './shape-frame.js';
import {
  clearDropIndicators,
  clearSectionIndicators,
  clearLayerSectionIndicators,
} from './drag-utils.js';

// perf(qa-perf): 드래그 중 autoSave MutationObserver 트리거 억제 헬퍼
/* ★[H6] 토큰으로 연다 — 예전엔 두 함수가 플래그에 «직접» true/false 를 썼다. 그래서
 *   ⑴ `_resumeDragSave()` 가 «드래그를 안 켠 채» 불리면(dragend 는 캡처 리스너에서 무조건 온다)
 *      남이 켜 둔 억제 창을 조용히 꺼버렸고,
 *   ⑵ 드래그 창 «안»에서 남이 억제를 켰다 끄면 내 드래그 억제가 먼저 꺼졌다.
 *   토큰은 «내가 연 것만» 닫고, 두 번 닫아도 아무 일 없다.
 *   longLived — 드래그는 사람 손이 쥔 창이라 «오래» 켜져 있는 게 정상이다(감시견 오경보 방지). */
let _dragTok = null;
export function _suppressDragSave() {
  if (!_dragTok || _dragTok.released) { _dragTok = window.AutoSaveSuppress.begin('section-drag', { longLived: true }); window.AutoSaveSuppress.endOnNextGesture(_dragTok); }
}
export function _resumeDragSave() {
  if (_dragTok) { window.AutoSaveSuppress.end(_dragTok); _dragTok = null; }
}

// Shared mutable drag state — exported as an object so both section-drag.js
// and block-drag.js can mutate the same properties (ES module live bindings
// cannot be reassigned by importers, but object property mutations propagate).
export const dragState = {
  dragSrc: null,
  layerDragSrc: null,
  sectionDragSrc: null,
  layerSectionDragSrc: null,
};

// Backward-compat window accessors (other scripts read/write window.dragSrc etc.)
Object.defineProperty(window, 'dragSrc', {
  get() { return dragState.dragSrc; },
  set(v) { dragState.dragSrc = v; },
  configurable: true,
});
Object.defineProperty(window, 'layerDragSrc', {
  get() { return dragState.layerDragSrc; },
  set(v) { dragState.layerDragSrc = v; },
  configurable: true,
});
Object.defineProperty(window, 'sectionDragSrc', {
  get() { return dragState.sectionDragSrc; },
  set(v) { dragState.sectionDragSrc = v; },
  configurable: true,
});
Object.defineProperty(window, 'layerSectionDragSrc', {
  get() { return dragState.layerSectionDragSrc; },
  set(v) { dragState.layerSectionDragSrc = v; },
  configurable: true,
});

function getDragAfterElement(container, y) {
  // y = dragover event.clientY (화면 좌표)
  // getBoundingClientRect도 화면 좌표 반환 → scale 보정 불필요, 두 값 단위 일치
  /* ★합쳐 넣은 몸(.section-merged-part)은 «펴서» 후보에 넣는다.
     안 그러면 「아래 섹션 전체 높이를 가진 상자 하나」로 계산돼, 그 안 어디에 놓든
     이음매 앞 아니면 섹션 맨 끝 둘 중 하나로만 간다(중간 배치 불가).
     ⇒ 반환된 기준 노드의 «부모»에 넣어야 한다 — 부르는 쪽이 그렇게 하고 있다. */
  const flatten = (el) => [...el.children].flatMap(c =>
    c.classList.contains('section-merged-part') ? flatten(c) : [c]);
  /* ★D6/E162(2026-10-05 lane-drag) — 안내선은 «기준»이 아니다: 스크래치·노트패널 미리보기의 .sp2c-insert-indicator 도 거른다
     (.drop-indicator 와 같은 까닭). 안 거르면 놓을 때 이 안내선을 기준으로 돌려주고, 곧 안내선이 떼어져 섹션 «맨 끝»에 붙었다(실앱 계측).
     그릇 안에 꽂히는 우리 안내선은 이 둘이 전부다(정의 자리 전수 — reports/lane-drag/D6-GUIDE-CENSUS.md). */
  const children = flatten(container).filter(el =>
    !el.classList.contains('drop-indicator') && !el.classList.contains('sp2c-insert-indicator') && el !== dragState.dragSrc
  );
  /* ⑦ 핀 섹션 — 후보는 «보이는» 자식만. 보이는 끝 아래로 끌면 첫 숨은 자식 앞(= 마지막 보이는 것 뒤)에 꽂는다
     (맨 끝 append 면 놓은 블럭이 숨은 데로 빠진다 · 안내선도 숨은 데 그려진다 — Codex 검토). */
  const _cut = window.sectionPin?.cutY(container.closest?.('.section-block'));
  const _vis = _cut == null ? children : children.filter(c => c.getBoundingClientRect().top < _cut);
  const _hit = _vis.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
  return _hit || (_cut == null ? undefined : children.find(c => c.getBoundingClientRect().top >= _cut));
}

function getSectionDragAfterEl(container, y) {
  // DRAG-VAR-01: variation group의 다른 variant도 드래그 소스에서 제외 (display:none이라 height=0 → 위치 계산 오염 방지)
  const dragGroupId = dragState.sectionDragSrc?.dataset.variationGroup;
  const sections = [...container.children].filter(el => {
    if (!el.classList.contains('section-block')) return false;
    if (el === dragState.sectionDragSrc) return false;
    if (dragGroupId && el.dataset.variationGroup === dragGroupId) return false;
    return true;
  });
  return sections.reduce((closest, sec) => {
    const box = sec.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: sec };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function getLayerSectionDragAfterEl(panel, y) {
  const sections = [...panel.children].filter(el =>
    el.classList.contains('layer-section') && el !== dragState.layerSectionDragSrc?.sectionEl
  );
  return sections.reduce((closest, sec) => {
    const box = sec.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: sec };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function getLayerDragAfterItem(container, y) {
  const items = [...container.children].filter(el =>
    (el.classList.contains('layer-item') || el.classList.contains('layer-row-group')) && el !== dragState.layerDragSrc
  );
  return items.reduce((closest, item) => {
    const box = item.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: item };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/* 끌기 처리기는 바인드 때의 position 으로 갈린다 ⇒ absolute→흐름으로 바뀐 단위는 새로 태어나게 해 다시 묶는다(그룹 풀기 · 프레임 스택 변환). */
function rebirthFlowUnit(unit) {
  const fresh = unit.cloneNode(true);
  unit.replaceWith(fresh);
  [fresh, ...fresh.querySelectorAll('.frame-block')].filter(f => f.classList.contains('frame-block')).forEach(f => window.bindFrameDropZone?.(f));
  const blocks = [...fresh.querySelectorAll(window.SECTION_BLOCK_TYPE_SEL)].filter(b => !b.classList.contains('sticker-block'));   // 스티커는 bindBlock 을 안 탄다(bindStickerSelect 전용)
  if (fresh.matches(window.SECTION_BLOCK_TYPE_SEL)) blocks.unshift(fresh);
  blocks.forEach(b => window.bindBlock?.(b));
  window.rerenderTree?.(fresh);
  fresh.querySelectorAll('.sticker-block').forEach(b => window.bindStickerSelect?.(b));   // bindBlock 을 안 타는 제 바인더 — _bindPastedEl 과 같다
  fresh.querySelectorAll('.gradient-block').forEach(b => window.bindGradientSelect?.(b));
}
window.rebirthFlowUnit = rebirthFlowUnit;

function ungroupBlock(groupEl) {
  // 피그마식 그룹(freeLayout 프레임 + data-group): 그룹 위치/회전을 자식에 baking 후 부모로 이동
  if (groupEl.dataset.group === 'true' || (groupEl.classList.contains('frame-block') && groupEl.dataset.freeLayout === 'true' && !groupEl.querySelector(':scope > .group-inner'))) {
    window.pushHistory();
    const parent = groupEl.parentElement;
    const gx = parseInt(groupEl.style.left) || 0;
    const gy = parseInt(groupEl.style.top) || 0;
    const gRot = parseFloat(groupEl.dataset.rotateDeg) || 0;
    /* UNGROUP-DROPS-SPEECH-BUBBLE-IN-FREE-FRAME-01 — 알맹이는 position 과 상관없이 전부 꺼낸다. absolute 만 꺼냈더니 흐름으로 든 자식(자유 프레임의 말풍선·라이너, 그룹 안에 넣은 배너·버즈)이 아래 groupEl.remove() 로 같이 지워졌다.
       시험: tests/dom/ungroup-keeps-all-kinds.dom.spec.js */
    const kids = [...groupEl.children].filter(c =>
      !c.classList.contains('frame-resize-handle') &&
      (getComputedStyle(c).position === 'absolute' || !isEmptyShell(c) || isBlockEl(c)));
    /* 흐름 자식은 그룹 안 보이는 자리에서 좌표로 옮겨 둔다 — 옮기기 «전»에 재야 흐름이 안 흔들린다 */
    const _flowKids = kids.filter(c => getComputedStyle(c).position !== 'absolute').map(c => ({ c, l: c.offsetLeft, t: c.offsetTop, w: c.offsetWidth }));
    _flowKids.forEach(({ c, l, t }) => { c.style.left = l + 'px'; c.style.top = t + 'px'; });
    /* ★294 t9-03(미카사 J294G) — 흐름 자리에서 만든 그룹(⌘G 가 자식을 absolute 로 쌓는다 · block-factory.js)을 풀면 자식도 흐름으로 돌아온다.
       안 그러면 absolute 인 채 흐름 부모에 남아 위로 튀고 섹션이 자식을 못 담았다(앱 실측 3/3: 섹션 높이 1323→283 · 저장본에도 absolute). 자유 프레임 부모는 좌표가 맞고, 섹션 직속은 아래 오버레이 갈래 ⇒ 둘 다 그대로.
       시험: tests/dom/flow-ungroup-294.dom.spec.js
       shortcut: 세로로만 쌓는다(그룹 안에서 나란히 옮긴 자식 · 도형 래퍼의 가로 자리 · 패딩 밖 여백은 못 되살린다), 나란한 배치를 흐름으로 옮기는 규칙이 서면 여기서 고친다. */
    const _toFlow = parent && parent.dataset?.freeLayout !== 'true' && !parent.classList?.contains('section-block');
    if (_toFlow) kids.sort((a, b) => (parseInt(a.style.top) || 0) - (parseInt(b.style.top) || 0));   // 화면 위아래 순서대로 돌아온다
    const _flowed = [];
    if (!_toFlow) _flowKids.forEach(({ c, w }) => { c.style.position = 'absolute'; c.style.width = w + 'px'; c.setAttribute('draggable', 'false'); });
    const _flowPos = new Map();
    /* 풀면서 앞 자식이 그룹을 밀어내므로 자리는 꺼내기 «전»에 재 둔다(섹션 기준) */
    const _secEl = groupEl.closest('.section-block');
    const _secBox = el => { const r = el.getBoundingClientRect(), s = _secEl.getBoundingClientRect(); return { x: r.left - s.left, y: r.top - s.top }; };
    const _ownBox = new Map(kids.filter(c => _toFlow && _secEl && c.dataset.x != null && c.dataset.y != null && c.dataset.overlayBlock !== 'true').map(c => [c, _secBox(c)]));
    kids.forEach(c => {
      const cl = (parseInt(c.style.left) || 0) + gx;
      const ct = (parseInt(c.style.top) || 0) + gy;
      /* 자리 정본이 dataset.x/y 인 떠 있는 블럭(줌·그라데이션·스티커)은 묶기(block-factory.js _shiftXY)가 정본째 밀었다 ⇒ 정본째 되민다.
         style 만 되돌리면 화면은 맞아도 저장본이 묶기 때 좌표(대개 0,0)라 다시 열면 튄다. 표식도 원래 없던 것이라 안 단다. */
      const _ownXY = c.dataset.x != null && c.dataset.y != null && c.dataset.overlayBlock !== 'true';
      const _shiftOwn = (dx, dy) => {
        if (c.classList.contains('sticker-block') && window._translateSticker) { window._translateSticker(c, dx, dy); return; }
        c.dataset.x = String((parseInt(c.dataset.x, 10) || 0) + dx); c.dataset.y = String((parseInt(c.dataset.y, 10) || 0) + dy);
        c.style.left = ((parseInt(c.style.left, 10) || 0) + dx) + 'px'; c.style.top = ((parseInt(c.style.top, 10) || 0) + dy) + 'px';
        if (c.classList.contains('zoom-block')) window.renderZoomBlock?.(c);
      };
      if (_ownXY) {
        _shiftOwn(gx, gy);
        delete c.dataset.offsetX; delete c.dataset.offsetY;
      } else {
        c.style.left = cl + 'px'; c.style.top = ct + 'px';
        c.dataset.offsetX = String(cl); c.dataset.offsetY = String(ct);
      }
      /* 묶기가 적어 둔 흐름 자리(block-factory.js _flowBack). 그룹 안에서 폭을 바꿨으면 폭·여백은 지금 값을 둔다 */
      let _back = null;
      try { _back = c.dataset.flowBack ? JSON.parse(c.dataset.flowBack) : null; } catch { _back = null; }
      delete c.dataset.flowBack;
      // 그룹 회전은 각 자식 회전에 가산 (스큐 없음 가정)
      if (gRot) {
        const cr = (parseFloat(c.dataset.rotation) || 0) + gRot;
        c.dataset.rotation = String(cr);
        const base = (c.style.transform || '').replace(/\s*rotate\([^)]*\)/g, '').trim();
        c.style.transform = (base ? base + ' ' : '') + `rotate(${cr}deg)`;
        c.style.transformOrigin = 'center center';
      }
      groupEl.before(c);
      /* 흐름 그룹에 든 떠 있는 블럭(block-factory.js _floatIntoNew)은 섹션 직속으로 돌아간다 — 흐름 부모에 남으면 좌표 기준이 달라져 자리가 튄다 */
      if (_ownBox.has(c)) {
        _secEl.appendChild(c);
        const _at = _secBox(c), _was = _ownBox.get(c), _k = _secEl.offsetWidth ? (_secEl.getBoundingClientRect().width / _secEl.offsetWidth) || 1 : 1;
        _shiftOwn(Math.round((_was.x - _at.x) / _k), Math.round((_was.y - _at.y) / _k));
      }
      /* 떠 있는 것(그라데이션·스티커·오버레이)은 흐름 단위가 아니다 — 자리·묶기가 제 길이라 그대로 둔다. */
      /* 챗·월계·조커는 떠 있을 수도, 흐름에 있을 수도 있다 — 흐름에서 묶은 것(_back)은 흐름으로 돌아온다 */
      if (_toFlow && !_ownXY && (_back || !c.matches('.gradient-block, .sticker-block, .chat-block, .laurel-block, .joker-block')) && c.dataset.overlayBlock !== 'true') {
        c.style.position = ''; c.style.left = ''; c.style.top = '';
        delete c.dataset.offsetX; delete c.dataset.offsetY;
        if (_back) {
          if (c.style.width === _back.gw) { c.style.width = _back.w; c.style.marginLeft = _back.ml; c.style.marginRight = _back.mr; c.style.marginTop = _back.mt; c.style.marginBottom = _back.mb; c.style.maxWidth = _back.mw; if (_back.fm != null) c.dataset.fbMaxW = _back.fm; }   /* 다시 열기는 그룹 자식의 max-width·fbMaxW 를 고쳐 쓴다 */
          /* 이동값(translate)은 묶기가 left·top 으로 옮겼다 — 그룹 안에서 돌리지 않았으면 그대로 되돌린다 */
          if (c.style.transform === _back.gt) { c.style.transform = _back.tf; if (_back.tx != null) c.dataset.translateX = _back.tx; if (_back.ty != null) c.dataset.translateY = _back.ty; }
          window.applyFrameRotationMargin?.(c);
          _flowPos.set(c, _back.p);
        } else if (c.style.width === '100%') c.style.width = c.dataset.width ? c.dataset.width + 'px' : '';
        c.removeAttribute('draggable');
        /* 흐름 부모에서 좌표로 살던 것(스택 안 조커)은 그 좌표로 돌아간다 — row 를 씌우지 않는다 */
        if (_back?.p === 'absolute') {
          c.style.position = 'absolute'; c.style.left = _back.l; c.style.top = _back.t;
          if (_back.ox != null) c.dataset.offsetX = _back.ox;
          if (_back.oy != null) c.dataset.offsetY = _back.oy;
        } else _flowed.push(c);
      }
      window.syncAutoGridWidth?.(c);   // F3 후속 — 자동 폭 그리드를 새 자리에 맞춘다(떠나면 100%). 규약: grid-block.js syncAutoGridWidth
      /* ★오버레이 그룹을 풀면 자식은 «다시 섹션 직속 오버레이»가 된다 (현빈 2026-09-30).
       * 부모가 섹션 «자신»이라는 것이 곧 그 뜻이다 — 흐름 블록은 .section-inner 안에 산다.
       * ⛔표식을 안 되살리면 좌표(left/top)는 맞는데 «떠 있다는 사실»만 사라져,
       *   드래그(js/overlay-float.js bindFloatMoveDrag 의 첫 가드)도 내보내기 판정
       *   (js/io/export-figma-json.js 의 같은 술어)도 이 블록을 흐름 블록으로 오인한다.
       * ★다는 칸은 enterFloat 이 다는 것과 같다. 복귀 자리는 섹션 본문 맨 앞
       *   (exitFloat 의 fallback 과 같은 자리) — 그룹 안에 있던 동안의 «원래 자리»는 없다. */
      if (parent && parent.classList?.contains('section-block') && !_ownXY) {
        const _inner = parent.querySelector(':scope > .section-inner');
        if (_inner && !_inner.id) {
          _inner.id = (typeof window.genId === 'function')
            ? window.genId('anchor')
            : ('anchor_' + Math.random().toString(36).slice(2, 9));
        }
        c.dataset.overlayBlock = 'true';
        c.dataset.overlayReturnParent = _inner ? _inner.id : '';
        c.dataset.overlayReturnAfter = '';
        c.dataset.selVariant = 'sticker';
        const _inShape = c.querySelector?.(':scope > .shape-block');
        if (_inShape) _inShape.dataset.selVariant = 'sticker';
        window._bindOverlayMoveDrag?.(c);
      }
    });
    groupEl.remove();
    /* 끌기 처리기는 바인드 때의 position 으로 갈린다(absolute 면 좌표 끌기 · 흐름이면 HTML5) ⇒ 푼 자식만 새로 태어나게 해 다시 묶는다. 맨몸 블록은 끌어내기처럼 줄로 감싼다.
       ⛔rebindAll 금지 — 안 바꾼 프레임까지 _subSecBound 를 풀어 리스너가 겹치고(⌘클릭이 두 번 돌아 선택이 안 된다) 옵션 없이는 이력도 지운다. */
    _flowed.forEach(c => {
      const unit = (c.classList.contains('frame-block') || c.classList.contains('row')) ? c : toFlowUnit(c);
      if (_flowPos.get(c)) c.style.position = _flowPos.get(c);
      rebirthFlowUnit(unit);
    });
    window.deselectAll?.();
    window._activeFrame = (parent && parent.dataset?.freeLayout === 'true') ? parent : null;
    window.buildLayerPanel();
    window.scheduleAutoSave?.();
    return;
  }
  // 레거시 group-block(group-inner) 호환
  const inner = groupEl.querySelector('.group-inner');
  if (!inner) { groupEl.remove(); return; }
  window.pushHistory();
  [...inner.children].forEach(child => groupEl.before(child));
  groupEl.remove();
  window.buildLayerPanel();
}

function bindGroupDrag(groupEl) {
  if (groupEl._groupDragBound) return;
  groupEl._groupDragBound = true;

  // group-block 클릭 핸들러:
  //   - group-editing 모드면 내부 블록 이벤트를 허용하고 리턴
  //   - 비선택 상태 클릭 → group-selected (1번 클릭)
  //   - group-selected 상태에서 재클릭 → group-editing 모드 진입 (2번 클릭)
  groupEl.addEventListener('click', e => {
    // group-editing 모드: 내부 블록 클릭을 bindBlock에 위임
    if (groupEl.classList.contains('group-editing')) return;
    // group-inner 내 클릭이지만 editing 모드가 아닌 경우: 전체 그룹 선택 처리
    if (e.target.closest('.group-inner')) {
      e.stopPropagation();
      if (groupEl.classList.contains('group-selected')) {
        // 2번 클릭 → group-editing 모드 진입
        groupEl.classList.add('group-editing');
        window.syncSection?.(groupEl.closest('.section-block'));
      } else {
        // 1번 클릭 → group-selected
        window.deselectAll?.();
        groupEl.classList.add('group-selected');
        window.syncSection?.(groupEl.closest('.section-block'));
      }
      return;
    }
    // 패딩 영역 클릭
    e.stopPropagation();
    if (groupEl.classList.contains('group-selected')) {
      // 이미 선택된 상태의 패딩 클릭은 group-editing 진입 없이 유지
      return;
    }
    window.deselectAll?.();
    groupEl.classList.add('group-selected');
    window.syncSection?.(groupEl.closest('.section-block'));
  });

  // group-editing 중 자식 클릭 시 deselectAll이 group 상태를 날린 뒤 setTimeout으로 복원
  groupEl.addEventListener('mousedown', e => {
    if (groupEl.classList.contains('group-editing') && groupEl.contains(e.target)) {
      setTimeout(() => {
        if (document.contains(groupEl)) {
          groupEl.classList.add('group-selected', 'group-editing');
        }
      }, 0);
    }
  }, true);

  // 외부 클릭으로 group-editing 해제 (document-level, capture)
  if (!groupEl._groupEditOutsideBound) {
    groupEl._groupEditOutsideBound = true;
    document.addEventListener('click', e => {
      if (!groupEl.classList.contains('group-editing')) return;
      if (!groupEl.contains(e.target)) {
        groupEl.classList.remove('group-editing');
      }
    }, true);
  }

  // group-block 자체를 드래그 핸들로 사용 (패딩 영역에서 드래그 시작)
  groupEl.setAttribute('draggable', 'true');
  groupEl.addEventListener('dragstart', e => {
    if (groupEl.classList.contains('group-editing')) return; // group-editing 중 그룹 드래그 차단
    if (e.target.closest('.group-inner')) return; // 내부 블록 드래그는 무시
    e.stopPropagation();
    _suppressDragSave();
    dragState.dragSrc = groupEl;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-9999px;width:1px;height:1px;';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => ghost.remove(), 0);
    requestAnimationFrame(() => groupEl.classList.add('dragging'));
  });
  groupEl.addEventListener('dragend', () => {
    _resumeDragSave();
    groupEl.classList.remove('dragging');
    clearDropIndicators();
    dragState.dragSrc = null;
    // fix(qa-s02): group drag 종료 후 row-active 잔류 방지
    document.querySelectorAll('.row.row-active').forEach(r => r.classList.remove('row-active'));
  });
}

function bindSectionDrag(sec) {
  const label = sec.querySelector('.section-label');
  if (!label || label._sectionDragBound) return;
  label._sectionDragBound = true;
  label.setAttribute('draggable', 'true');

  label.addEventListener('dragstart', e => {
    e.stopPropagation();
    _suppressDragSave();
    dragState.sectionDragSrc = sec;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-9999px;width:1px;height:1px;';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => ghost.remove(), 0);
    requestAnimationFrame(() => sec.classList.add('section-dragging'));
  });
  label.addEventListener('dragend', () => {
    _resumeDragSave();
    sec.classList.remove('section-dragging');
    clearSectionIndicators();
    dragState.sectionDragSrc = null;
    // fix(qa-s02): 섹션 드래그 후 row-active 잔류 방지
    document.querySelectorAll('.row.row-active').forEach(r => r.classList.remove('row-active'));
  });
}

function bindSectionDropZone(sec) {
  // TODO-QA(S-02): 빈 row(블록 없음, col 없음)는 bindBlock이 호출되지 않아
  // draggable 속성이 설정되지 않음 → dragstart 이벤트 미발생 → 드래그 불가.
  // 빈 row를 다른 섹션으로 이동하려면 row에 직접 draggable+dragstart 바인딩 필요.
  // 현재는 실용적 빈도 낮으므로 미수정; 빈 row 생성 시 row.setAttribute('draggable','true') 추가 필요.
  const inner = sec.querySelector('.section-inner');
  // rAF throttle: getBoundingClientRect()를 dragover 매 이벤트마다 호출하지 않도록 (DBG-11)
  let _innerDragRafId = null;
  const _placeIndicator = (clientX, clientY) => {
    clearDropIndicators();
    /* G19 — 그리드 «밑» 자리(사각형 판정)면 표시선을 그 그릇 안에 그렸다(js/grid-children.js). */
    if (window.gridChildDragOver?.(inner, clientX, clientY, dragState.dragSrc)) return;
    const after = getDragAfterElement(inner, clientY);
    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    // ★기준 노드의 «실제 부모»에 넣는다(상자 안이면 상자 안). inner 로만 넣으면
    //   insertBefore 가 NotFoundError 로 죽거나 블록이 상자 밖으로 튀어나온다.
    if (after && after.parentElement) after.parentElement.insertBefore(indicator, after);
    else inner.appendChild(indicator);
  };
  inner.addEventListener('dragover', e => {
    if (!dragState.dragSrc) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (_innerDragRafId) return;
    const clientY = e.clientY, clientX = e.clientX;
    _innerDragRafId = requestAnimationFrame(() => {
      _innerDragRafId = null;
      if (!dragState.dragSrc) return;
      _placeIndicator(clientX, clientY);
    });
  });
  inner.addEventListener('dragleave', e => {
    if (!inner.contains(e.relatedTarget)) {
      if (_innerDragRafId) { cancelAnimationFrame(_innerDragRafId); _innerDragRafId = null; }
      clearDropIndicators();
    }
  });
  inner.addEventListener('drop', e => {
    e.preventDefault();
    if (_innerDragRafId) { cancelAnimationFrame(_innerDragRafId); _innerDragRafId = null; }
    if (!dragState.dragSrc) return;
    /* 177 — 표시선은 rAF 로 늦게 따라온다. 낡은 자리에 넣지 않게 «놓은 좌표»로 다시 잡는다. */
    _placeIndicator(e.clientX, e.clientY);
    /* G19 — 그리드 «밑» 자리면 그 그리드의 자식으로 넣는다. 아니면 임시 띠만 걷고 종전 그대로(js/grid-children.js). */
    if (window.gridChildDrop?.(e, inner, dragState.dragSrc)) { dragState.dragSrc = null; return; }
    /* G9 — 글자 블럭을 «그리드 칸» 위에 놓았으면 칸의 한 줄로 받는다(prop-grid.js grdDropTextBlockOnCell — 거짓이면 종전 그대로). */
    if (window.grdDropTextBlockOnCell?.(e, dragState.dragSrc)) {
      clearDropIndicators();
      dragState.dragSrc = null;
      return;
    }
    window.pushHistory();
    const _fromKids = dragState.dragSrc.parentElement;   // G19 — 그리드 밑 그릇에서 끌어냈으면 비었을 때 걷는다
    const indicator = inner.querySelector('.drop-indicator');
    if (indicator && indicator.parentElement) indicator.parentElement.insertBefore(dragState.dragSrc, indicator);
    else inner.appendChild(dragState.dragSrc);
    window.pruneGridKidsBox?.(_fromKids);
    window.syncAutoGridWidth?.(dragState.dragSrc);   // F3 후속 — 자동 폭 그리드를 새 자리에 맞춘다(떠나면 100%). 규약: grid-block.js syncAutoGridWidth
    clearDropIndicators();
    window.buildLayerPanel();
    dragState.dragSrc = null;
  });
}

/* 빈 row(블록 없음, col 없음)에 드래그 바인딩 — bindBlock이 호출되지 않는 경우를 대비 */
function bindEmptyRow(row) {
  if (row._dragBound) return;
  row._dragBound = true;
  row.setAttribute('draggable', 'true');
  row.addEventListener('dragstart', e => {
    e.stopPropagation();
    _suppressDragSave();
    dragState.dragSrc = row;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-9999px;width:1px;height:1px;';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => ghost.remove(), 0);
    requestAnimationFrame(() => row.classList.add('dragging'));
  });
  row.addEventListener('dragend', () => {
    _resumeDragSave();
    row.classList.remove('dragging');
    clearDropIndicators();
    dragState.dragSrc = null;
    document.querySelectorAll('.row.row-active').forEach(r => r.classList.remove('row-active'));
  });
}

// Backward compat
window.getDragAfterElement        = getDragAfterElement;
window.getSectionDragAfterEl      = getSectionDragAfterEl;
window.getLayerSectionDragAfterEl = getLayerSectionDragAfterEl;
window.getLayerDragAfterItem      = getLayerDragAfterItem;
window.ungroupBlock               = ungroupBlock;
window.bindGroupDrag              = bindGroupDrag;
window.bindSectionDrag            = bindSectionDrag;
window.bindSectionDropZone        = bindSectionDropZone;
window.bindEmptyRow               = bindEmptyRow;

export {
  getDragAfterElement,
  getSectionDragAfterEl,
  getLayerSectionDragAfterEl,
  getLayerDragAfterItem,
  ungroupBlock,
  bindGroupDrag,
  bindSectionDrag,
  bindSectionDropZone,
  bindEmptyRow,
};
