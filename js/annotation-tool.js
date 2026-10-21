// annotation-tool.js — 펜툴 어노테이션 Phase 2 (폴리라인)
// 펜툴 모드 진입 → 같은 섹션에서 N번 클릭 → 더블클릭 / Enter / 우클릭으로 종료
// ESC / V: 그리는 중(≥2점)이면 선을 확정한 뒤 모드 종료, 1점 이하면 폐기 후 모드 종료
//          (V = 일러스트 컨벤션 "일반 포인터 복귀"). 버튼 재클릭 = 모드 종료
// 그리는 중 점 취소는 Backspace/Delete/Cmd+Z (점 단위). 모드는 자동 종료되지 않음

// ── 모듈 상태 ─────────────────────────────────────────────────────────────
let _penMode = false;
let _pendingPoints = null;       // { sec, points: [[x,y], ...] }
/* ★★t3-01 사이즈 스티커 — ★같은 펜 모드를 쓰고 ★둘째 점에서 ★스스로 끝낸다.
   ★현빈 원문 「★어노테이션처럼 ★점 2개 찍어」 ⇒ ★점 추가·자석·미리보기는 ★그대로 재사용하고
     ★다른 것은 ⑴끝나는 때(2점) ⑵만드는 꼴(annotKind:'dim') ★둘뿐이다.
   ⛔별 모드를 새로 만들지 않는다 — 그러면 자석·미리보기·ESC·섹션 가드가 ★둘째 명부가 된다. */
let _dimMode = false;
/* ★★261021 현빈 설계 — 치수선은 ★3클릭이다.
     클릭1 ★첫 점 · 클릭2 ★둘째 점(= ★길이가 정해진다) · ⇒ ★여기서 ★끝나지 않는다.
     그 뒤 ★마우스를 따라 ★임시 치수선이 ★선 밖으로 왔다갔다 한다 ·
     클릭3 ★그 자리에 ★고정 ＋ ★원래 두 점에서 ★보조선이 ★거기로 연결된다.
   ★★첫 판은 ★2클릭에 ★바로 만들고 치우침을 ★24px 로 ★박았다 — 현빈 원문으로 ★정정했다.
   ⇒ `_dimPlacing` = 「길이는 정해졌고 ★자리를 ★고르는 중」. ⛔이 동안 ★블럭은 ★아직 없다. */
let _dimPlacing = false;
let _pendingPreviewEl = null;    // 임시 SVG 미리보기 DOM (sec 내부)
let _penClickBound = false;      // 캔버스 캡처 리스너 1회 바인딩 가드
let _cursor = null;              // ★1017t1h1 — 그리는 중 «아직 안 찍은» 다음 점(고무줄 끝) [x,y] 섹션 좌표(스냅 적용됨)

// 자체 더블클릭 검출 (native dblclick는 1번째 click이 점 추가로 소모되기 때문)
let _lastClickAt = 0;
let _lastClickXY = { x: 0, y: 0 };
const DBL_TIME_MS = 280;
const DBL_DIST_PX = 6;

// ── 모드 토글 ─────────────────────────────────────────────────────────────
function enterPenMode() {
  if (_penMode) return;
  // F3: 벡터펜 모드와 상호 배타 — vectorPen이 켜져 있으면 종료(대칭 가드)
  window.exitVectorPenMode?.();
  window.exitCountStickerMode?.();
  _penMode = true;
  document.body.classList.add('pen-mode');
  const btn = document.getElementById('fp-pen-btn');
  if (btn) btn.classList.add('active');
  // 선택된 어노테이션이 있으면 해제 (선택/드래그 모드와 동시 활성 방지)
  window._deselectAllAnnotations?.();
  _initCanvasClickListener();
  document.addEventListener('keydown', _onKeydown, true);
}

function exitPenMode() {
  if (!_penMode) return;
  _penMode = false;
  _dimMode = false;   /* ★t3-01 — ⛔안 끄면 ★다음에 펜을 켤 때 ★치수선이 나온다 */
  _dimPlacing = false;
  document.body.classList.remove('pen-mode');
  const btn = document.getElementById('fp-pen-btn');
  if (btn) btn.classList.remove('active');
  _cancelPending();
  document.removeEventListener('keydown', _onKeydown, true);
}

function togglePenMode() {
  if (_penMode) { exitPenMode(); return; }
  // (FIX-4) 이스터에그 게이팅 — off면 활성화 차단 (이미 켜진 건 위에서 정상 종료)
  if (window.isEasterEggEnabled && !window.isEasterEggEnabled('penMode')) return;
  enterPenMode();
}

// ── 내부 유틸 ─────────────────────────────────────────────────────────────
function _cancelPending() {
  _dimPlacing = false;   /* ★t3-01 — ⛔안 끄면 ★다음 치수선이 ★첫 클릭부터 ★자리 고르기로 들어간다 */
  _pendingPoints = null;
  if (_pendingPreviewEl) { _pendingPreviewEl.remove(); _pendingPreviewEl = null; }
  /* ★★t3-01 261021 실측 — ★치수선을 만든 뒤 ★빨간 임시선이 ★남는 것을 봤다(3개).
     ★위 한 줄이 ★층을 통째로 지우는데도 남았다 ⇒ ★층이 ★둘 이상 생기는 길이 ★있다는 뜻이다.
     ⛔그 길을 ★아직 못 찾았으므로 ★증상을 ★막는 안전망을 ★여기 둔다 — ★원인 규명은 ★따로 한다.
     ★안전망임을 ★숨기지 않는다: ★이 줄이 ★0 이 아닌 수를 지우면 ★그 길이 ★살아 있다는 것이다. */
  document.querySelectorAll('.annot-preview').forEach((el) => el.remove());
  _lastClickAt = 0;
  _cursor = null;   // ★1017t1h1
}

// clientX/Y → 특정 section 좌상단 기준 px (zoom 보정)
function _clientToSectionCoord(clientX, clientY, sec) {
  const rect = sec.getBoundingClientRect();
  const zoom = (window.currentZoom || 40) / 100;
  const x = (clientX - rect.left) / zoom;
  const y = (clientY - rect.top) / zoom;
  return { x, y };
}

function _initCanvasClickListener() {
  if (_penClickBound) return;
  const wrap = document.getElementById('canvas-wrap');
  if (!wrap) return;
  wrap.addEventListener('click',     _onCanvasClickCapture, true);
  wrap.addEventListener('mousedown', _onMouseDownCapture,   true);
  wrap.addEventListener('mousemove', _onMouseMoveCapture,   true);   // ★1017t1h1 — 그리는 중 고무줄 + 각도 라벨
  wrap.addEventListener('dblclick',  _onDblClickCapture,    true);
  wrap.addEventListener('contextmenu', _onContextMenuCapture, true);
  _penClickBound = true;
}

// ── 캡처 단계 이벤트 ──────────────────────────────────────────────────────
function _onCanvasClickCapture(e) {
  if (!_penMode) return;
  if (e.target.closest('.annot-label[contenteditable="true"]')) return;
  if (e.target.closest('#fp-pen-btn')) return;
  e.stopPropagation();
  e.preventDefault();
  _handlePenClick(e);
}

function _onMouseDownCapture(e) {
  if (!_penMode) return;
  if (e.target.closest('.annot-label[contenteditable="true"]')) return;
  if (e.target.closest('#fp-pen-btn')) return;
  if (!e.target.closest('.section-block')) return;
  e.stopPropagation();
  e.preventDefault();
}

// ★1017t1h1 — 선례 js/pen-tool.js:175-178(_cursor + _renderDraw 고무줄)과 같은 꼴.
//   클릭 사이에도 각(과 자석)을 보여준다 — 「각을 모르니 답답함」을 그리는 중에 푼다.
function _onMouseMoveCapture(e) {
  if (!_penMode || !_pendingPoints || _pendingPoints.points.length === 0) {
    if (_cursor) { _cursor = null; _updatePreviewSvg(); }
    return;
  }
  const { sec, points } = _pendingPoints;
  const { x, y } = _clientToSectionCoord(e.clientX, e.clientY, sec);
  if (_dimPlacing) {
    /* ★t3-01 — ★자리 고르기. ⛔각도 자석을 ★안 탄다(각도는 ★이미 두 점이 정했다). */
    _cursor = [x, y];
    _updatePreviewSvg();
    return;
  }
  const prev = points[points.length - 1];
  const snapped = window._snapVecToStep({ x, y }, { x: prev[0], y: prev[1] }, { tolDeg: e.shiftKey ? null : window.ANNOT_SNAP_TOL_DEG });
  _cursor = [snapped.x, snapped.y];
  _updatePreviewSvg();
}

function _onDblClickCapture(e) {
  if (!_penMode) return;
  // 자체 더블 검출로 처리하므로 native dblclick은 차단만
  e.stopPropagation();
  e.preventDefault();
}

function _onContextMenuCapture(e) {
  if (!_penMode) return;
  e.stopPropagation();
  e.preventDefault();
  // 그리는 중 ≥2점이면 우클릭으로도 종료
  if (_pendingPoints && _pendingPoints.points.length >= 2) {
    _finalizeAnnotation();
  } else {
    _cancelPending();
  }
}

// ── 클릭 핸들러 (N-step) ─────────────────────────────────────────────────
function _handlePenClick(e) {
  /* ★★t3-01 261021 실측 — ★자리 고르기(③번째 클릭)는 ★섹션 ★밖에 떨어지기 쉽다.
     치수선은 ★선 바깥으로 빼는 것이라 ★경계를 ★자주 넘는다. ⛔예전엔 여기서 ★조용히 return 해서
     ★아무 일도 안 났다(임시 치수선만 ★남아 떠 있었다 — ★「먹통」으로 보인다).
     ⇒ ★고르는 중이면 ★이미 정해진 ★그 섹션을 쓴다. 좌표는 ★그 섹션 기준으로 ★음수·초과도 ★그대로 받는다
       (치우침이 ★섹션 밖을 가리키는 것은 ★정상이다 — 블럭은 ★섹션에 붙고 ★그림만 넘는다). */
  const sec = (_dimPlacing && _pendingPoints) ? _pendingPoints.sec : e.target.closest('.section-block');
  if (!sec) return;

  let { x, y } = _clientToSectionCoord(e.clientX, e.clientY, sec);
  const now = Date.now();

  // 다른 섹션에서 시작 → pending 초기화
  if (_pendingPoints && _pendingPoints.sec !== sec) {
    _cancelPending();
  }

  /* ★★t3-01 — ★자리를 ★고르는 중이면 ★이 클릭이 ★마지막이다.
     ★커서 자리를 ★부호 있는 수직거리(dimOffset)로 바꿔 ★그 값으로 만든다.
     ⛔각도 자석을 ★타지 않는다 — 자리 고르기는 ★「두 점을 잇는 각도」와 ★무관하다. */
  if (_dimPlacing && _pendingPoints && _pendingPoints.sec === sec) {
    /* ★★261021 현빈 3차 — ⛔예전엔 `annotDimOffsetFromPoint`(수직 성분 ★하나)만 썼다 ⇒ ★위아래로만 밀렸다.
       ⇒ ★커서를 ★치수선 ★중점으로 삼아 ★a·b 를 ★그 자리에 놓는다 — ★좌우로도 ★따라온다. */
    const place = window.annotDimPlaceAt?.(_pendingPoints.points, [x, y], {});
    if (place) _finalizeAnnotation({ dimA: place.dimA, dimB: place.dimB });
    else _finalizeAnnotation({ dimOffset: 24 });
    return;
  }

  // ★1017t1h1 — 8방향(0/45/90/135/180/225/270/315) 자석. Shift = 강제(지금 꼴 유지) · 평시 = ±6° 안일 때만.
  if (_pendingPoints && _pendingPoints.points.length > 0 && _pendingPoints.sec === sec) {
    const prev = _pendingPoints.points[_pendingPoints.points.length - 1];
    const snapped = window._snapVecToStep({ x, y }, { x: prev[0], y: prev[1] }, { tolDeg: e.shiftKey ? null : window.ANNOT_SNAP_TOL_DEG });
    x = snapped.x; y = snapped.y;
  }

  // 더블클릭 검출: 같은 위치 + 짧은 시간 + 이미 2점 이상이면 finalize
  if (_pendingPoints && _pendingPoints.points.length >= 2) {
    const dt = now - _lastClickAt;
    const dx = x - _lastClickXY.x;
    const dy = y - _lastClickXY.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dt < DBL_TIME_MS && dist < DBL_DIST_PX) {
      // 마지막에 추가된 중복점을 제거하지 않고 그대로 종료
      _finalizeAnnotation();
      return;
    }
  }

  // 점 추가
  if (!_pendingPoints) {
    _pendingPoints = { sec, points: [[x, y]] };
  } else {
    _pendingPoints.points.push([x, y]);
  }
  _lastClickAt = now;
  _lastClickXY = { x, y };
  /* ★★t3-01 — ★치수 모드면 ★둘째 점에서 ★바로 끝낸다(더블클릭을 ★기다리지 않는다).
     ⛔미리보기를 그리고 ★나서 끝내면 ★한 프레임 깜빡인다 ⇒ ★여기서 ★먼저 가른다. */
  /* ★★t3-01 — ★두 점이 모이면 ★길이가 정해진 것이다. ⛔여기서 ★만들지 않는다 —
     ★자리 고르기로 ★넘어가고, ★다음 클릭이 ★그 자리를 정한다(위 갈래). */
  if (_dimMode && _pendingPoints.points.length >= 2) { _dimPlacing = true; }
  _updatePreviewSvg();
}

// ── 미리보기 SVG ─────────────────────────────────────────────────────────
function _updatePreviewSvg() {
  if (!_pendingPoints) return;
  const { sec, points } = _pendingPoints;
  if (!_pendingPreviewEl) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const wrap = document.createElement('div');
    wrap.className = 'annot-preview';
    wrap.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:60;';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'annot-preview-svg');
    svg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;';
    const poly = document.createElementNS(svgNS, 'polyline');
    poly.setAttribute('class', 'annot-preview-line');
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', '#1a1a1a');
    poly.setAttribute('stroke-width', '1.5');
    poly.setAttribute('stroke-dasharray', '4 3');
    poly.setAttribute('stroke-linejoin', 'round');
    poly.setAttribute('stroke-linecap', 'round');
    svg.appendChild(poly);
    // ★1017t1h1 — 고무줄(마지막 점 → 커서) + 각도 라벨. UI 오버레이라 --inv-zoom 으로 배율 무관 크기(선례 js/gradient-line-overlay.js:44-53).
    const guide = document.createElementNS(svgNS, 'line');
    guide.setAttribute('class', 'annot-preview-guide');
    guide.setAttribute('stroke', '#1592fe');
    guide.setAttribute('stroke-dasharray', '3 3');
    guide.setAttribute('stroke-linecap', 'round');
    guide.style.strokeWidth = 'calc(1.5px * var(--inv-zoom,1))';
    guide.style.display = 'none';
    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('class', 'annot-preview-angle');
    label.setAttribute('fill', '#1592fe');
    label.setAttribute('text-anchor', 'middle');
    label.style.fontSize = 'calc(11px * var(--inv-zoom,1))';
    label.style.fontFamily = 'system-ui, sans-serif';
    label.style.display = 'none';
    svg.appendChild(guide);
    svg.appendChild(label);
    wrap.appendChild(svg);
    wrap._poly = poly;
    wrap._svg = svg;
    wrap._guide = guide;
    wrap._label = label;
    sec.appendChild(wrap);
    _pendingPreviewEl = wrap;
  }
  const poly = _pendingPreviewEl._poly;
  const svg = _pendingPreviewEl._svg;
  const guide = _pendingPreviewEl._guide;
  const label = _pendingPreviewEl._label;
  poly.setAttribute('points', points.map(p => `${p[0]},${p[1]}`).join(' '));

  // 고무줄 + 각도 라벨 — _cursor(아직 안 찍은 다음 점)가 있을 때만.
  /* ★★t3-01 — ★자리 고르기 동안의 ★임시 치수선. ★제품과 ★같은 기하(annotDimGeometry)를 쓴다
     ⇒ ⛔미리보기와 ★만들어진 것이 ★다른 자리에 서는 일이 ★없다(명부가 ★하나다). */
  svg.querySelectorAll('.annot-preview-dim').forEach(d => d.remove());
  if (_dimPlacing && _cursor && points.length >= 2 && typeof window.annotDimGeometry === 'function') {
    const place = window.annotDimPlaceAt?.(points, _cursor, {});
    const g = place ? window.annotDimGeometry(points, place) : null;
    if (g) {
      const ns = 'http://www.w3.org/2000/svg';
      const mk = (x1, y1, x2, y2, dash) => {
        const l = document.createElementNS(ns, 'line');
        l.setAttribute('class', 'annot-preview-dim');
        l.setAttribute('x1', x1); l.setAttribute('y1', y1);
        l.setAttribute('x2', x2); l.setAttribute('y2', y2);
        l.setAttribute('stroke', '#e74c3c');
        l.setAttribute('stroke-width', dash ? 1 : 1.8);
        if (dash) l.setAttribute('stroke-dasharray', '3 3');
        l.setAttribute('stroke-linecap', 'round');
        svg.appendChild(l);
      };
      mk(g.line[0][0], g.line[0][1], g.line[1][0], g.line[1][1], false);
      g.ext.forEach(([p0, p1]) => mk(p0[0], p0[1], p1[0], p1[1], true));
    }
    /* ★자리를 고르는 동안엔 ★고무줄·각도 라벨을 ★끈다 — ★각도는 ★이미 정해졌다 */
    guide.style.display = 'none';
    label.style.display = 'none';
  } else if (_cursor && points.length > 0) {
    const prev = points[points.length - 1];
    guide.setAttribute('x1', prev[0]); guide.setAttribute('y1', prev[1]);
    guide.setAttribute('x2', _cursor[0]); guide.setAttribute('y2', _cursor[1]);
    guide.style.display = '';
    const dx = _cursor[0] - prev[0], dy = _cursor[1] - prev[1];
    const degRaw = Math.atan2(dy, dx) * 180 / Math.PI;
    const deg = Math.round((((degRaw % 360) + 360) % 360) * 10) / 10;
    label.textContent = `${deg}°`;
    label.setAttribute('x', (prev[0] + _cursor[0]) / 2);
    label.setAttribute('y', (prev[1] + _cursor[1]) / 2 - 10);
    label.style.display = '';
  } else {
    guide.style.display = 'none';
    label.style.display = 'none';
  }

  // 각 점 dot — 매번 다시 그림 (적은 수이므로 OK)
  // 기존 dot 제거
  /* ★t3-01 — 자리 고르는 동안엔 ★두 점을 잇는 점선 폴리라인을 ★옅게 둔다(원래 잰 구간을 ★보여야 한다) */
  poly.setAttribute('opacity', _dimPlacing ? '0.35' : '1');

  svg.querySelectorAll('.annot-preview-dot').forEach(d => d.remove());
  const svgNS = 'http://www.w3.org/2000/svg';
  points.forEach((p, idx) => {
    const c = document.createElementNS(svgNS, 'circle');
    c.setAttribute('class', 'annot-preview-dot');
    c.setAttribute('cx', p[0]);
    c.setAttribute('cy', p[1]);
    // 시작점(idx 0)은 흰 외곽선을 둘러 빨간 섹션 위에서도 식별되게(40% 줌 시인성)
    c.setAttribute('r', idx === 0 ? 7 : 3.5);
    c.setAttribute('fill', idx === 0 ? '#e74c3c' : '#fff');
    c.setAttribute('stroke', idx === 0 ? '#ffffff' : '#e74c3c');
    c.setAttribute('stroke-width', idx === 0 ? 2.5 : 1.2);
    svg.appendChild(c);
  });
}

// ── 어노테이션 확정 ──────────────────────────────────────────────────────
// enterLabelEdit=false: 라벨 자동 편집 진입 생략 (ESC/V로 "작업 종료" 커밋 시)
// silent=true: "펜 모드 유지 중" 토스트 생략 (모드를 곧바로 종료하는 경로)
function _finalizeAnnotation({ enterLabelEdit = true, silent = false, dimOffset = null, dimA = null, dimB = null } = {}) {
  if (!_pendingPoints) return;
  const { sec, points } = _pendingPoints;
  if (points.length < 2) { _cancelPending(); return; }

  /* ★★t3-01 — ★치수 모드면 ★표식과 ★첫 글을 달리 준다. ⛔`_cancelPending()` ★뒤에 읽으면 ∅ 가 된다 ⇒ ★여기서 떠 둔다. */
  const asDim = _dimMode;
  if (typeof window.pushHistory === 'function') window.pushHistory(asDim ? '치수선 추가' : '어노테이션 추가');
  const block = asDim
    ? window.makeAnnotationBlock(Object.assign({ points, text: '수치입력', annotKind: 'dim' },
        dimOffset != null ? { dimOffset } : {}, dimA ? { dimA } : {}, dimB ? { dimB } : {}))
    : window.makeAnnotationBlock({ points, text: '텍스트' });
  sec.appendChild(block);

  // 라벨 즉시 편집 진입 — ★1013t2C6 더블클릭과 «같은 한 벌»(annotation-select.js annotBeginLabelEdit)
  const label = block.querySelector('.annot-label');
  if (label && enterLabelEdit) window.annotBeginLabelEdit?.(block, label);

  window.bindAnnotationSelect?.(block);
  _cancelPending();
  /* ★1013t1A1 — 좌측 레이어 패널에 행을 «바로» 세운다. 섹션 직속 플로팅 블럭(그라데이션·확대)은
     만든 자리에서 buildLayerPanel 을 부르는데 여기만 빠져, 어노테이션은 다른 이유로 패널이 다시 그려질
     때까지 레이어에 안 나타났다(2026-10-13 실측: 생성 직후 행 3 → 3). */
  window.buildLayerPanel?.();
  window.scheduleAutoSave?.();
  if (!silent) window.showToast?.(asDim ? '📐 치수선 생성 — 다음 것도 바로 찍을 수 있다 · ESC로 종료' : '✏️ 펜 모드 유지 중 — ESC로 종료');
}

// ESC / V 공통 — 그리던 선(≥2점)은 확정해 보존하고 펜 모드 종료 (1점 이하는 폐기)
function _commitAndExitPenMode() {
  const hadLine = _pendingPoints && _pendingPoints.points.length >= 2;
  if (hadLine) _finalizeAnnotation({ enterLabelEdit: false, silent: true });
  exitPenMode(); // 잔여 pending/미리보기는 내부 _cancelPending이 정리
  if (hadLine) window.showToast?.('✏️ 어노테이션 확정 — 펜 모드 종료');
}

// ── 전역 keydown ─────────────────────────────────────────────────────────
function _onKeydown(e) {
  if (!_penMode) return;
  const active = document.activeElement;
  const editingLabel = active && active.classList && active.classList.contains('annot-label')
    && active.getAttribute('contenteditable') === 'true';

  // 그리는 중 Cmd+Z → 전역 undo(완성 주석 삭제) 막고 펜딩 마지막 점만 취소
  if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
    if (editingLabel) return;            // 라벨 편집 중 undo는 브라우저/전역에 위임
    if (_pendingPoints && _pendingPoints.points.length > 0) {
      e.stopPropagation();
      e.preventDefault();
      _pendingPoints.points.pop();
      if (_pendingPoints.points.length === 0) { _cancelPending(); }
      else { _lastClickAt = 0; _updatePreviewSvg(); }
      return;
    }
    // 펜딩 없으면 전역 undo 그대로 통과(가로채지 않음)
  }

  if (e.key === 'Escape') {
    // 안내 토스트("ESC로 종료")와 일치: 한 번의 ESC로 종료. 라벨 편집 중이면
    // 먼저 blur로 텍스트 커밋(IME 한글 포함) 후 펜 종료 — V키와 동일 출구.
    e.stopPropagation();
    if (editingLabel) { try { active.blur(); } catch (_) {} }
    _commitAndExitPenMode();
    return;
  }

  // V — 일반 포인터(선택 도구) 복귀. 일러스트 컨벤션 (highlight-line-tool과 동일)
  if ((e.key === 'v' || e.key === 'V') && !e.metaKey && !e.ctrlKey && !e.altKey) {
    // 어노테이션 라벨(펜 플로우 자동 포커스)은 V로 "커밋 + 펜 종료" — ESC와 동일 출구.
    // 그 외 실제 입력필드/contenteditable(다른 패널 등)에서는 글자 입력으로 통과.
    const typingElsewhere = active && !editingLabel && (
      active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable
    );
    if (typingElsewhere) return;
    e.stopPropagation();
    e.preventDefault();           // 라벨에 'v'가 끼어드는 것 방지
    // 라벨 편집 중이면 먼저 blur로 텍스트 커밋(IME로 입력된 한글 포함) 후 펜 종료
    if (editingLabel) { try { active.blur(); } catch (_) {} }
    _commitAndExitPenMode();
    return;
  }

  if (e.key === 'Backspace' || e.key === 'Delete') {
    if (editingLabel) return;            // 라벨 편집 중엔 텍스트 삭제로 위임
    if (_pendingPoints && _pendingPoints.points.length > 0) {
      e.stopPropagation();
      e.preventDefault();
      _pendingPoints.points.pop();        // 마지막 점 취소
      if (_pendingPoints.points.length === 0) { _cancelPending(); }
      else { _lastClickAt = 0; _updatePreviewSvg(); }  // 더블검출 리셋 + 미리보기 갱신
      return;
    }
  }

  if (e.key === 'Enter') {
    if (editingLabel) return; // 라벨 편집 중 Enter는 라벨이 처리
    if (_pendingPoints && _pendingPoints.points.length >= 2) {
      e.stopPropagation();
      e.preventDefault();
      _finalizeAnnotation();
    }
  }
}

// ── window export ────────────────────────────────────────────────────────
/* ★★t3-01 — 치수 모드. ★펜 모드를 ★그대로 켜고 ★끝나는 때만 바꾼다.
   ⛔`enterPenMode()` 가 ★이미 켜져 있으면 ★바로 돌아오므로(`if (_penMode) return`)
     ★`_dimMode` 를 ★그 뒤에 세운다 — 순서를 바꾸면 ★펜으로 켜 둔 상태에서 ★치수로 안 넘어간다. */
function enterDimMode() {
  enterPenMode();
  _dimMode = true;
  window.showToast?.('📐 치수선 — ①점 ②점으로 길이를 정하고 ③한 번 더 눌러 자리를 정한다 · ESC로 종료');
}
function toggleDimMode() {
  if (_penMode && _dimMode) { exitPenMode(); return; }
  if (window.isEasterEggEnabled && !window.isEasterEggEnabled('penMode')) return;
  enterDimMode();
}
window.enterDimMode  = enterDimMode;
window.toggleDimMode = toggleDimMode;
window.enterPenMode  = enterPenMode;
window.exitPenMode   = exitPenMode;
window.togglePenMode = togglePenMode;
