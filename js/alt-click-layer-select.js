// alt-click-layer-select.js — Alt(Option)+클릭으로 아래 layer 선택 (Figma/Sketch 스타일)
//
// 동작:
// - 일반 클릭: 최상위(z-index 큰) element 선택 (기존 동작 유지)
// - Alt+클릭: 클릭 좌표의 다음 layer 선택 (현재 selected를 건너뜀)
// - 반복 Alt+클릭(같은 좌표): 더 아래 layer로 cycle
//
// 구현: document 레벨 capture-phase 클릭 핸들러.
//   1) elementsFromPoint로 좌표 stack 수집
//   2) selectable block(.text-block, .sticker-block, .asset-block 등) 필터
//   3) 현재 선택과 다른 블록을 찾아 합성 click 이벤트로 해당 블록의 select 핸들러 트리거
//   4) 원본 Alt+click은 stopImmediatePropagation으로 차단

(function () {
  'use strict';

  // 선택 가능한 블록 클래스 (위→아래 우선순위는 z-index 기준 자연스럽게 결정됨)
  // ★하이라이트 라인(선 형광펜)은 makeStickerBlock({shape:'highlightB'}) 산출물 =
  //   data-shape="highlightB" 인 .sticker-block 이라 아래 '.sticker-block'가 이미 포함한다.
  //   (bbox pointer-events:auto 라 elementsFromPoint 스택에 이미 잡힘 — 별도 셀렉터 불필요)
  const SELECTABLE_BLOCK_SELECTOR = [
    '.sticker-block',   // ← highlightB(하이라이트 라인) 포함
    '.text-block',
    '.asset-block',
    '.gap-block',
    '.icon-circle-block',
    '.table-block',
    '.label-group-block',
    '.graph-block',
    '.divider-block',
    '.bridge-block',
    '.duo-block',
    '.infocard-block',
    '.innercard-block',
    '.icon-text-block',
    '.canvas-block',
    '.banner02-block, .comparison-block',
    '.icon-block',
    '.mockup-block',
    '.vector-block',
    '.step-block',
    '.chat-block',
    '.laurel-block',
    '.shape-block',
    '.joker-block',
    '.annotation-block',
  ].join(', ');

  // U12: 섹션 자체도 드릴 대상. 섹션은 큰 컨테이너라 스택 «최하단»(자식 블록 다음)에 오게 정렬한다.
  const SECTION_SELECTOR = '.section-block';
  // _collectStack이 elementsFromPoint 결과를 필터할 통합 셀렉터 (블록 + 섹션)
  const SELECTABLE_SELECTOR = SELECTABLE_BLOCK_SELECTOR + ', ' + SECTION_SELECTOR;

  // cycle 추적: 짧은 시간 안에 같은 위치 Alt+click 시 더 아래 layer로
  let _cycleState = { x: 0, y: 0, t: 0, skipped: [] };
  const CYCLE_PX = 8;       // 같은 위치로 간주할 픽셀 범위
  const CYCLE_MS = 1500;    // cycle reset 시간

  function _resetCycle(x, y) {
    _cycleState = { x, y, t: Date.now(), skipped: [] };
  }

  function _isNearLast(x, y) {
    if (!_cycleState.t) return false;
    if (Date.now() - _cycleState.t > CYCLE_MS) return false;
    return Math.abs(x - _cycleState.x) <= CYCLE_PX
        && Math.abs(y - _cycleState.y) <= CYCLE_PX;
  }

  // elementsFromPoint stack에서 selectable block들을 위→아래 순서로 수집
  function _collectStack(clientX, clientY) {
    const els = document.elementsFromPoint(clientX, clientY) || [];
    const out = [];
    const seen = new Set();
    for (const el of els) {
      // 핸들/오버레이 무시
      if (el.classList && (
        el.classList.contains('annot-handle') ||
        el.classList.contains('shape-handle') ||
        el.classList.contains('drop-indicator')
      )) continue;
      // 블록(또는 섹션)까지 올라가서 매칭
      const block = el.closest && el.closest(SELECTABLE_SELECTOR);
      if (!block) continue;
      if (seen.has(block)) continue;
      seen.add(block);
      // 캔버스 밖(예: 패널) 블록은 무시
      if (!block.closest('#canvas')) continue;
      out.push(block);
    }
    // U12: 섹션은 항상 스택 최하단으로. elementsFromPoint는 조상(섹션)을 자식 블록 뒤에
    // 반환하므로 out 순서상 이미 뒤에 오지만, z-index 예외로 앞설 수 있어 명시적으로 보장한다.
    // (stable partition: 비섹션 블록 먼저 → 섹션 나중. 순환 순서 = 위 블록 → 아래 블록 → 섹션)
    const _blocks = out.filter(b => !b.classList.contains('section-block'));
    const _sections = out.filter(b => b.classList.contains('section-block'));
    return _blocks.concat(_sections);
  }

  // 현재 selected인 블록 (canvas 안)
  // ★블록 선택을 섹션보다 «우선»한다: freeLayout 복제 등에서 블록과 섹션이 동시에 .selected가
  //   될 수 있는데, 섹션은 DOM상 자식 블록보다 앞이라 querySelector가 섹션을 먼저 잡아버리면
  //   드릴 기준점(cur)이 섹션이 되어 자식 블록 순환을 건너뛴다. 블록을 먼저 조회.
  function _currentSelected() {
    const blockSel = '#canvas ' + SELECTABLE_BLOCK_SELECTOR.split(', ').map(s => s + '.selected').join(', ');
    return document.querySelector(blockSel)
        || document.querySelector('#canvas ' + SECTION_SELECTOR + '.selected');
  }

  // 합성 click 이벤트로 블록의 자체 핸들러 호출 (sticker는 capture, 다른 블록은 bubble)
  function _dispatchSelectClick(target, srcEvent) {
    const evt = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: srcEvent.clientX,
      clientY: srcEvent.clientY,
      screenX: srcEvent.screenX,
      screenY: srcEvent.screenY,
      button: 0,
      buttons: 0,
      // 일반 클릭으로 동작하도록 modifier 제거
      altKey: false,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
    });
    // 디버그용 마커 (필요 시 다른 핸들러에서 식별 가능)
    evt._altLayerSelect = true;
    target.dispatchEvent(evt);
  }

  function handleAltClick(e) {
    if (!e.altKey) return;
    if (e.button !== 0) return;
    // 합성 이벤트는 무시 (무한 재진입 방지)
    if (e._altLayerSelect) return;

    // 텍스트 편집 모드 중인 contenteditable 내부 클릭은 기본 동작 유지
    // (단어 선택 등 OS 기본 Alt+click 허용)
    const t = e.target;
    if (t && t.closest) {
      if (t.closest('.text-block.editing')) return;
      if (t.closest('.icon-text-block.editing')) return;
      if (t.closest('.label-group-block.editing')) return;
      if (t.closest('[contenteditable="true"]')) return;
      // 우측/좌측 패널은 무시
      if (!t.closest('#canvas')) return;
    }

    const stack = _collectStack(e.clientX, e.clientY);
    if (stack.length === 0) return;

    // cycle 상태 확인
    const sameSpot = _isNearLast(e.clientX, e.clientY);
    if (!sameSpot) _resetCycle(e.clientX, e.clientY);

    // 후보 결정:
    // - 첫 Alt+click(다른 위치): 현재 selected 다음 layer (stack에서 selected 이후 첫 항목)
    //   selected가 stack에 없으면 stack[1] (두 번째 layer)
    // - 같은 위치 반복: 이미 cycle한 블록들 skip하고 다음
    let target = null;
    const cur = _currentSelected();
    const skipped = sameSpot ? _cycleState.skipped : [];

    if (sameSpot) {
      // cycle: skipped 목록에 없는 첫 후보
      for (const b of stack) {
        if (skipped.includes(b)) continue;
        if (b === cur) continue;
        target = b;
        break;
      }
      // 모든 후보를 거쳤으면 cycle reset 후 stack[0]부터
      if (!target) {
        _cycleState.skipped = [];
        for (const b of stack) {
          if (b === cur) continue;
          target = b;
          break;
        }
      }
    } else {
      // 첫 Alt+click: stack 순서대로 현재 selected 다음 (없으면 첫 항목, 마지막이면 wrap → 첫 항목)
      const idx = cur ? stack.indexOf(cur) : -1;
      if (idx >= 0) {
        // 현재 선택이 stack에 있음 → 다음 layer (마지막이면 wrap)
        const nextIdx = (idx + 1) % stack.length;
        target = stack[nextIdx];
        // wrap된 경우(다시 자기 자신이면 의미 없음) → null
        if (target === cur) target = null;
      } else {
        // 현재 선택이 stack 밖이거나 없음 → 텍스트(맨 위) skip하고 아래 layer (없으면 맨 위)
        // ★섹션은 이 fallback에서 제외 — 기존 «블록» 드릴 동작 불변(단독 블록은 그 블록 선택).
        //   블록이 하나도 없을 때만 섹션(stack[0])으로 떨어진다.
        const _blks = stack.filter(b => !b.classList.contains('section-block'));
        target = _blks[1] || _blks[0] || stack[0];
      }
    }

    if (!target) return;

    // 원본 Alt+click 차단 (텍스트 편집 진입, 드래그 시작 등 막음)
    e.stopPropagation();
    e.stopImmediatePropagation();
    e.preventDefault();

    // cycle 기록 — 다음 Alt+click이 같은 좌표면 이번 target을 skip
    if (sameSpot) {
      if (!_cycleState.skipped.includes(target)) _cycleState.skipped.push(target);
    } else {
      _cycleState.skipped = [target];
    }
    _cycleState.t = Date.now();

    // 섹션은 전용 선택 경로(editor.js가 window에 노출한 selectSection) 재사용,
    // 블록은 기존대로 합성 click으로 블록 자체 select 핸들러 호출.
    if (target.classList.contains('section-block')) {
      if (typeof window.selectSection === 'function') window.selectSection(target);
      else _dispatchSelectClick(target, e); // 폴백: 섹션 hitzone click 핸들러 경유
    } else {
      _dispatchSelectClick(target, e);
    }
  }

  // capture-phase로 가장 먼저 받기 — sticker-select 등 capture 핸들러보다 앞서 실행
  // (document는 트리 최상위라 capture-phase가 elements보다 먼저 실행됨)
  document.addEventListener('click', handleAltClick, true);
  // mousedown도 차단 — 일부 블록(sticker, shape)이 mousedown으로 드래그/선택 시작함
  document.addEventListener('mousedown', function (e) {
    if (!e.altKey) return;
    if (e.button !== 0) return;
    if (e._altLayerSelect) return;
    const t = e.target;
    if (t && t.closest) {
      if (t.closest('.text-block.editing')) return;
      if (t.closest('.icon-text-block.editing')) return;
      if (t.closest('.label-group-block.editing')) return;
      if (t.closest('[contenteditable="true"]')) return;
      if (!t.closest('#canvas')) return;
    }
    // mousedown만 차단하고 click에서 처리 — 드래그 시작 방지가 목적
    const stack = _collectStack(e.clientX, e.clientY);
    if (stack.length === 0) return;
    e.stopPropagation();
    e.stopImmediatePropagation();
    e.preventDefault();
  }, true);

  // 디버그용 노출
  window._altLayerSelect = {
    collectStack: _collectStack,
    handleAltClick,
  };
})();
