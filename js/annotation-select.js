// annotation-select.js — 어노테이션 선택 / 라벨 드래그 / 핸들 드래그 / 삭제
// 펜툴 모드 OFF 상태에서만 활성. block마다 idempotent 바인딩.

(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let _globalsBound = false;

  // ── 전역 1회 바인딩 ──────────────────────────────────────────────────
  function _ensureGlobals() {
    if (_globalsBound) return;
    _globalsBound = true;

    // 캔버스 다른 곳 mousedown → 어노테이션 선택 해제
    document.addEventListener('mousedown', (e) => {
      if (document.body.classList.contains('pen-mode')) return;
      // 어노테이션 내부 클릭은 통과
      if (e.target.closest('.annotation-block')) return;
      // 우측 속성 패널 클릭은 통과 (입력 중)
      if (e.target.closest('#panel-right')) return;
      _deselectAllAnnotations();
    }, true);

    // Delete/Backspace 캡처 — editor.js의 비-capture 핸들러보다 먼저 실행
    document.addEventListener('keydown', (e) => {
      if (document.body.classList.contains('pen-mode')) return;
      // 입력/편집 중이면 모든 단축키 통과 (v도 텍스트 입력 가능)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      const sel = document.querySelector('.annotation-block.selected');
      if (!sel) return;

      // ESC / v → 선택 해제 (어노테이션 "모드" 빠져나옴)
      if (e.key === 'Escape' || e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        e.stopImmediatePropagation();
        // ★1013t1A3 — 라벨을 «골라» 둔 상태면 ESC 한 번은 그 고르기만 푼다(다음 ESC 에 블럭 해제)
        const picked = sel.querySelector('.annot-label.annot-cell-selected');
        if (e.key === 'Escape' && picked) { picked.classList.remove('annot-cell-selected'); return; }
        _deselectAllAnnotations();
        return;
      }

      // Delete/Backspace → 어노테이션 삭제
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (typeof window.pushHistory === 'function') window.pushHistory('어노테이션 삭제');
        sel.remove();
        window.hideAnnotationProperties?.();
        window.buildLayerPanel?.();   // ★1013t1A1 — 지운 블럭을 가리키는 «죽은 행»을 남기지 않는다
        window.scheduleAutoSave?.();
      }
    }, true);
  }

  // ── 선택 / 해제 ─────────────────────────────────────────────────────
  function _deselectAllAnnotations() {
    document.querySelectorAll('.annotation-block.selected').forEach(b => {
      b.classList.remove('selected');
      b.querySelectorAll('.annot-cell-selected').forEach(l => l.classList.remove('annot-cell-selected'));   // ★1013t1A3
      _removeHandles(b);
      _removeSelectionBox(b);
    });
    window.hideAnnotationProperties?.();
  }
  window._deselectAllAnnotations = _deselectAllAnnotations;

  function _selectAnnotation(block) {
    if (!block) return;
    if (document.body.classList.contains('pen-mode')) return;
    if (block.classList.contains('selected')) return;
    _deselectAllAnnotations();
    // 다른 블록 선택도 해제
    if (typeof window.deselectAll === 'function') {
      // deselectAll은 우측 패널을 page로 바꾸므로 우리는 직접 다른 선택만 해제
      // → 호출하지 않고 selected 토글만 처리
    }
    block.classList.add('selected');
    _ensureHandles(block);
    window.showAnnotationProperties?.(block);
    // ★1013t1A1 — 캔버스에서 골라도 좌측 레이어의 그 행이 켜진다(행은 makeLayerBlockItem 이 block._layerItem 에 단다)
    if (block._layerItem?.isConnected) window.highlightBlock?.(block, block._layerItem);
  }
  window._selectAnnotation = _selectAnnotation;

  // ── 선택 bounding box (points + 라벨 합집합) ──────────────────────
  function _computeBBox(block) {
    const points = _readPoints(block);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(p => {
      if (p[0] < minX) minX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] > maxY) maxY = p[1];
    });
    // 라벨 박스 (transform translate(0,-50%) — left가 라벨 왼쪽 끝, top이 라벨 수직 중앙)
    const label = block.querySelector('.annot-label');
    if (label) {
      const lx = parseFloat(label.style.left) || 0;
      const ly = parseFloat(label.style.top)  || 0;
      const lw = label.offsetWidth  || 0;
      const lh = label.offsetHeight || 0;
      const left = lx, top = ly - lh / 2;
      if (left < minX) minX = left;
      if (top  < minY) minY = top;
      if (left + lw > maxX) maxX = left + lw;
      if (top  + lh > maxY) maxY = top  + lh;
    }
    const PAD = 6;
    return { x: minX - PAD, y: minY - PAD, w: (maxX - minX) + PAD * 2, h: (maxY - minY) + PAD * 2 };
  }
  function _ensureSelectionBox(block) {
    _removeSelectionBox(block);
    const svg = block.querySelector('.annot-svg');
    if (!svg) return;
    const b = _computeBBox(block);
    if (!Number.isFinite(b.w) || !Number.isFinite(b.h) || b.w <= 0 || b.h <= 0) return;
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('class', 'annot-selbox');
    rect.setAttribute('x', b.x);
    rect.setAttribute('y', b.y);
    rect.setAttribute('width',  b.w);
    rect.setAttribute('height', b.h);
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', '#1592fe');
    rect.setAttribute('stroke-width', '1.5');
    rect.setAttribute('pointer-events', 'none');
    // 가장 먼저(line/anchor/handle 뒤로) 두어 시각 충돌 최소화
    svg.insertBefore(rect, svg.firstChild);
  }
  function _removeSelectionBox(block) {
    block.querySelectorAll('.annot-selbox').forEach(el => el.remove());
  }

  // ── 핸들 (각 점) ────────────────────────────────────────────────────
  function _ensureHandles(block) {
    _removeHandles(block);
    const svg = block.querySelector('.annot-svg');
    if (!svg) return;
    const points = _readPoints(block);
    points.forEach((p, idx) => {
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('class', 'annot-handle');
      c.setAttribute('cx', p[0]);
      c.setAttribute('cy', p[1]);
      c.setAttribute('r', '5');
      c.setAttribute('fill', '#ffffff');
      c.setAttribute('stroke', '#1592fe');
      c.setAttribute('stroke-width', '1.5');
      c.dataset.pointIdx = String(idx);
      svg.appendChild(c);
    });
    /* ★1013t2C7 — 시작점이 삼각형·화살촉이면 회전 손잡이 하나. 클래스에 annot-handle 을 같이 달아
       _removeHandles · 저장 철거 목록(save-load NON_CONTENT_UI_SELECTOR · section-serialize)이 저절로 덮는다.
       자리는 annotRedrawAnchor 가 시작점과 같이 옮긴다(annotRotHandlePos 한 벌). */
    /* ★★t3-01 261021 현빈 2차 — ★치수선 양끝(a·b)도 ★각각 끈다.
         원문: 「★최초에 찍은 d,c 앞의 점의 위치도 ★나중에 ★각각 잡고 ★위치 이동시킬 수 있어야해」
       ★d·c 는 ★위 `.annot-handle` 이 ★이미 끈다(pointIdx). ★여기는 ★a·b 다.
       ⛔`annot-handle` 클래스를 ★같이 단다 — ★철거·저장 제외 목록이 ★그 이름으로 덮는다(회전 손잡이 선례). */
    if (block.dataset.annotKind === 'dim' && typeof window.annotDimGeometry === 'function') {
      const st = window.annotPropsFromDataset?.(block);
      const g = st && window.annotDimGeometry(st.points, {
        dimAxis: st.dimAxis, dimOffset: st.dimOffset, dimSlide: st.dimSlide,
        dimGap: st.dimGap, dimOver: st.dimOver, dimLabelLift: st.dimLabelLift,
        dimA: st.dimA, dimB: st.dimB,
      });
      if (g) ['A', 'B'].forEach((end, i) => {
        const dh = document.createElementNS(SVG_NS, 'circle');
        dh.setAttribute('class', 'annot-handle annot-dim-handle');
        dh.setAttribute('cx', String(g.line[i][0]));
        dh.setAttribute('cy', String(g.line[i][1]));
        dh.setAttribute('r', '5');
        dh.setAttribute('fill', '#1592fe');       /* ★d·c(흰 속)와 ★눈으로 갈린다 */
        dh.setAttribute('stroke', '#ffffff');
        dh.setAttribute('stroke-width', '1.5');
        dh.dataset.dimEnd = end;
        svg.appendChild(dh);
      });
    }

    const shape = block.dataset.anchorShape;
    if (shape === 'triangle' || shape === 'arrowhead') {
      const rh = document.createElementNS(SVG_NS, 'circle');
      rh.setAttribute('class', 'annot-handle annot-rot-handle');
      const [hx, hy] = window.annotRotHandlePos?.(block, points) || points[0];
      rh.setAttribute('cx', String(hx));
      rh.setAttribute('cy', String(hy));
      rh.setAttribute('r', '5');
      if (window._ROTATE_CURSOR) rh.style.cursor = window._ROTATE_CURSOR;
      svg.appendChild(rh);
    }
  }
  /* 모양을 바꾼 뒤(패널) 손잡이를 다시 세운다 — 고른 블럭만. */
  window.annotRefreshHandles = (block) => { if (block?.classList.contains('selected')) _ensureHandles(block); };
  function _removeHandles(block) {
    block.querySelectorAll('.annot-handle').forEach(h => h.remove());
  }

  // ── 데이터 헬퍼 ─────────────────────────────────────────────────────
  function _readPoints(block) {
    try {
      const arr = JSON.parse(block.dataset.points || '[]');
      if (Array.isArray(arr) && arr.length >= 2) {
        return arr.map(p => [Number(p[0]) || 0, Number(p[1]) || 0]);
      }
    } catch (_) {}
    const ax = parseFloat(block.dataset.anchorX) || 0;
    const ay = parseFloat(block.dataset.anchorY) || 0;
    const lx = parseFloat(block.dataset.labelX)  || 0;
    const ly = parseFloat(block.dataset.labelY)  || 0;
    return [[ax, ay], [lx, ly]];
  }

  function _writePoints(block, points) {
    block.dataset.points  = JSON.stringify(points);
    block.dataset.anchorX = String(points[0][0]);
    block.dataset.anchorY = String(points[0][1]);
    const last = points[points.length - 1];
    block.dataset.labelX  = String(last[0]);
    block.dataset.labelY  = String(last[1]);
  }

  // ── DOM 즉시 갱신 (drag 중) ─────────────────────────────────────────
  function _updateBlockGeometry(block, points) {
    const line = block.querySelector('.annot-line');
    if (line) line.setAttribute('points', points.map(p => `${p[0]},${p[1]}`).join(' '));

    // anchor (시작점) — ★1013t2C7-pre 한 벌(js/blocks/annotation-block.js annotRedrawAnchor · 각도 포함)
    window.annotRedrawAnchor?.(block, points);

    // 라벨 위치 + 부착 방향 (마지막 segment 기반 4방향)
    // 이미지 원형 모드면 중앙 부착 — 모서리 없으니 자연스러움
    const label = block.querySelector('.annot-label');
    const last = points[points.length - 1];
    if (label) {
      label.style.left = last[0] + 'px';
      label.style.top  = last[1] + 'px';
      const isImgCircleish = block.dataset.labelMode === 'image' && (parseFloat(block.dataset.labelImageRadius) || 0) >= 25;
      if (isImgCircleish) {
        label.style.transform = 'translate(-50%,-50%)';
      } else if (typeof window._calcAnnotLabelTransform === 'function') {
        label.style.transform = window._calcAnnotLabelTransform(points);
      }
    }

    // 핸들 위치
    block.querySelectorAll('.annot-handle').forEach(h => {
      const idx = parseInt(h.dataset.pointIdx, 10);
      if (!Number.isNaN(idx) && points[idx]) {
        h.setAttribute('cx', points[idx][0]);
        h.setAttribute('cy', points[idx][1]);
      }
    });
  }
  window._updateAnnotBlockGeometry = _updateBlockGeometry;

  // ★1017t1h1 — 점 손잡이 끌기 중 각도 라벨(.annot-svg 안 — 확정 블럭 생면, 선례 annotation-block.js:340).
  //   선례 js/gradient-line-overlay.js:44-53 꼴로 --inv-zoom 배율 무관 크기.
  function _pointAngleLabel(block) {
    const svg = block.querySelector('.annot-svg');
    if (!svg) return null;
    let label = svg.querySelector('.annot-point-angle');
    if (!label) {
      label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('class', 'annot-point-angle');
      label.setAttribute('fill', '#1592fe');
      label.setAttribute('text-anchor', 'middle');
      label.style.fontSize = 'calc(11px * var(--inv-zoom,1))';
      label.style.fontFamily = 'system-ui, sans-serif';
      label.style.display = 'none';
      svg.appendChild(label);
    }
    return label;
  }
  function _showPointAngleLabel(block, refArr, ptArr) {
    const label = _pointAngleLabel(block);
    if (!label || !refArr) return;
    const dx = ptArr[0] - refArr[0], dy = ptArr[1] - refArr[1];
    const degRaw = Math.atan2(dy, dx) * 180 / Math.PI;
    const deg = Math.round((((degRaw % 360) + 360) % 360) * 10) / 10;
    label.textContent = `${deg}°`;
    label.setAttribute('x', (refArr[0] + ptArr[0]) / 2);
    label.setAttribute('y', (refArr[1] + ptArr[1]) / 2 - 10);
    label.style.display = '';
  }
  function _hidePointAngleLabel(block) {
    block.querySelector('.annot-svg .annot-point-angle')?.remove();
  }

  // ── 드래그 헬퍼 ─────────────────────────────────────────────────────
  function _zoom() {
    return (window.currentZoom || 40) / 100;
  }

  // 어노테이션 points 전체를 sec 안으로 clamp (bbox 기준 보정).
  // points 배열을 in-place로 변경.
  function _clampAnnotPoints(points, sec) {
    const { adjX, adjY } = _clampDeltaForPoints(points, sec);
    if (adjX === 0 && adjY === 0) return;
    for (let i = 0; i < points.length; i++) {
      points[i][0] += adjX;
      points[i][1] += adjY;
    }
  }

  // points 배열의 bbox가 sec 밖으로 나가면 안쪽으로 밀어넣을 (adjX, adjY) 반환.
  // 양쪽 다 넘치는 경우(섹션보다 큰 bbox)는 left/top을 0으로 우선.
  function _clampDeltaForPoints(points, sec) {
    if (!points || !points.length) return { adjX: 0, adjY: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p[0] < minX) minX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] > maxY) maxY = p[1];
    }
    const secW = sec.clientWidth  || 0;
    const secH = sec.clientHeight || 0;
    let adjX = 0, adjY = 0;
    if (minX < 0) adjX = -minX;
    else if (maxX > secW) adjX = secW - maxX;
    if (minY < 0) adjY = -minY;
    else if (maxY > secH) adjY = secH - maxY;
    // bbox가 sec보다 크면 minX 보정만 적용 (좌상단 우선)
    if (maxX + adjX > secW) adjX = -minX;
    if (maxY + adjY > secH) adjY = -minY;
    return { adjX, adjY };
  }

  // ── ★1013t1A3 라벨만 옮기기 (방사형 블럭 호 「항목 위치 조절」 차용 · b67106ab _startItemDrag) ──
  // 조건: 블럭이 선택돼 있고 라벨이 «이미 골라진»(.annot-cell-selected) 상태에서 누를 때만. 첫 클릭은 고르기다.
  // 끄는 동안엔 label.style.translate 만 바꾸고, 놓을 때 dataset(labelDx/Dy)에 쓰고 «끝 표본»을 찍는다.
  // 시작 표본은 onMove 첫 틱의 arm() — 끌기 한 번 = ⌘Z 한 걸음(js/CLAUDE.md 「드래그는 양쪽 끝」).
  function _startLabelOffsetDrag(block, label, e) {
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const off0 = window.annotLabelOffsetOf?.(block) || { dx: 0, dy: 0 };
    const L = window.ANNOT_LIMITS;
    const clamp = (v, k) => Math.min(L[k].max, Math.max(L[k].min, Math.round(v)));
    let moved = false, cur = null;
    const _hist = window.beginDragHistory?.('어노테이션 라벨 위치');
    const onMove = (ev) => {
      const ddx = (ev.clientX - startX) / _zoom();
      const ddy = (ev.clientY - startY) / _zoom();
      if (!moved) {
        if (Math.abs(ev.clientX - startX) < 3 && Math.abs(ev.clientY - startY) < 3) return;
        moved = true;
        _hist?.arm(ddx, ddy);
      }
      cur = { dx: clamp(off0.dx + ddx, 'labelDx'), dy: clamp(off0.dy + ddy, 'labelDy') };
      label.style.translate = `${cur.dx}px ${cur.dy}px`;
      ev.preventDefault();
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup',   onUp,   true);
      if (!moved || !cur) return;
      // 끌기 끝의 click 은 삼킨다 — 라벨 밖에서 놓으면 그 click 이 선택을 풀어 버린다(radial 과 같은 처방).
      const eat = (ce) => { ce.stopPropagation(); ce.preventDefault(); };
      window.addEventListener('click', eat, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', eat, true), 0);
      window.annotSetLabelOffset?.(block, cur.dx, cur.dy);
      window.showAnnotationProperties?.(block);
      if (typeof window.pushHistory === 'function') window.pushHistory('어노테이션 라벨 위치');
      window.scheduleAutoSave?.();
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup',   onUp,   true);
  }

  // ── ★1013t2C7 시작점 회전 끌기 (A3 라벨 위치와 같은 길 · asset-rotate 의 atan2 꼴) ──
  // 중심 = 시작점의 화면 좌표(섹션 rect + 점 × 배율). 끄는 동안 annotSetAnchorRot 이 dataset·그림을 같이 바꾼다.
  // ⇧ = «절대» 방향(자동 + 회전)을 45° 단위로(window._snapRotate) — 그 값에서 자동각을 빼 회전으로 환산한다.
  // 시작 표본은 첫 움직임의 arm(), 끝 표본은 onUp 의 pushHistory — 끌기 한 번 = ⌘Z 한 걸음.
  function _startAnchorRotateDrag(block, e) {
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    const sec = block.closest('.section-block');
    if (!sec) return;
    const points = _readPoints(block);
    const sr = sec.getBoundingClientRect();
    const cx = sr.left + points[0][0] * _zoom();
    const cy = sr.top  + points[0][1] * _zoom();
    const auto = window._calcAnnotAnchorAngle?.(points) || 0;
    const rot0 = window.annotAnchorRotOf?.(block) || 0;
    const snap = window._snapRotate || ((d, sh) => Math.round(d));
    const startX = e.clientX, startY = e.clientY;
    const startA = Math.atan2(startY - cy, startX - cx) * 180 / Math.PI;
    let moved = false;
    const _hist = window.beginDragHistory?.('어노테이션 시작점 회전');
    const onMove = (ev) => {
      if (!moved) {
        if (Math.abs(ev.clientX - startX) < 2 && Math.abs(ev.clientY - startY) < 2) return;
        moved = true;
        _hist?.arm((ev.clientX - startX) / _zoom(), (ev.clientY - startY) / _zoom());
      }
      const d = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI - startA;
      const rot = ev.shiftKey ? snap(auto + rot0 + d, true) - auto : rot0 + snap(d, false);
      window.annotSetAnchorRot?.(block, rot);
      ev.preventDefault();
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup',   onUp,   true);
      if (!moved) return;
      const eat = (ce) => { ce.stopPropagation(); ce.preventDefault(); };
      window.addEventListener('click', eat, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', eat, true), 0);
      window.showAnnotationProperties?.(block);
      if (typeof window.pushHistory === 'function') window.pushHistory('어노테이션 시작점 회전');
      window.scheduleAutoSave?.();
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup',   onUp,   true);
  }

  // ── 블록당 바인딩 ───────────────────────────────────────────────────
  function bindAnnotationSelect(block) {
    if (!block || block._annotSelBound) return;
    block._annotSelBound = true;
    _ensureGlobals();

    const label = block.querySelector('.annot-label');
    if (!label) return;

    // ── 라벨 클릭 → 선택 / contenteditable 진입 ───────────────────────
    // capture + stopImmediatePropagation으로 다른 click 핸들러 격리 (deselectAll 차단)
    label.addEventListener('click', (e) => {
      if (document.body.classList.contains('pen-mode')) return;
      if (label.getAttribute('contenteditable') === 'true') return;
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (!block.classList.contains('selected')) {
        _selectAnnotation(block);
      }
      // 선택 상태 + 다시 클릭 → 편집 진입은 dblclick으로 분리
    }, true);

    // 더블클릭으로 편집 진입 (이미지 모드에선 비활성)
    label.addEventListener('dblclick', (e) => {
      if (document.body.classList.contains('pen-mode')) return;
      if (block.dataset.labelMode === 'image') return;
      e.stopPropagation();
      annotBeginLabelEdit(block, label);
    });

    // ── 라벨 드래그 (어노테이션 전체 평행 이동) ──────────────────────
    // capture + stopImmediatePropagation으로 다른 mousedown 핸들러 차단 (deselect 방지)
    label.addEventListener('mousedown', (e) => {
      if (document.body.classList.contains('pen-mode')) return;
      if (label.getAttribute('contenteditable') === 'true') return;
      if (e.button !== 0) return;
      e.stopImmediatePropagation();
      let sec = block.closest('.section-block');
      if (!sec) return;

      // ★1013t1A3 — 골라 둔 라벨을 누르면(⌘ 없이) «라벨만» 옮긴다
      const wasSelected = block.classList.contains('selected');
      if (wasSelected && label.classList.contains('annot-cell-selected') && !(e.metaKey || e.ctrlKey)) {
        _startLabelOffsetDrag(block, label, e);
        return;
      }

      // 선택되지 않았다면 선택만 하고 드래그는 다음 mousedown부터
      if (!wasSelected) {
        _selectAnnotation(block);
      }

      e.stopPropagation();
      e.preventDefault();

      // 모드 분기: Cmd/Ctrl 누른 상태 = 마지막 점만 이동 (선 길이/방향 조정),
      // 일반 = 어노테이션 전체 평행 이동
      const lastOnly = !!(e.metaKey || e.ctrlKey);
      const startX = e.clientX;
      const startY = e.clientY;
      const points = _readPoints(block);
      let startPoints = points.map(p => [p[0], p[1]]);
      const lastIdx = points.length - 1;
      let dragging = false;
      // 드래그 시작 시 마우스의 section-local 좌표 (clamp/parent move 기준점)
      let startSecRect = sec.getBoundingClientRect();
      let startMouseSecX = (startX - startSecRect.left) / _zoom();
      let startMouseSecY = (startY - startSecRect.top)  / _zoom();

      const _hist = window.beginDragHistory?.('어노테이션 이동');
      const onMove = (ev) => {
        if (!dragging) {
          if (Math.abs(ev.clientX - startX) < 3 && Math.abs(ev.clientY - startY) < 3) return;
          dragging = true;
          /* ★«시작 상태»를 여기서 1회 찍는다 — 끝 상태는 onUp 의 pushHistory. 드래그는 «양쪽 끝»을
             다 남겨야 삽입(push-before) 뒤 첫 드래그에서 ⌘Z 가 삽입까지 먹지 않는다(js/drag-history.js). */
          _hist?.arm((ev.clientX - startX) / _zoom(), (ev.clientY - startY) / _zoom());
        }
        if (lastOnly) {
          // Cmd 드래그: 마지막 점만 이동 → 선 끝점만 이동, anchor 고정, 라벨 따라옴.
          // 섹션 변경/clamp 적용 안 함 (한 점만 움직임).
          const dx = (ev.clientX - startX) / _zoom();
          const dy = (ev.clientY - startY) / _zoom();
          points[lastIdx] = [startPoints[lastIdx][0] + dx, startPoints[lastIdx][1] + dy];
          _updateBlockGeometry(block, points);
          return;
        }

        // 일반 드래그: 전체 평행 이동 + 섹션 hover 감지 (B 정책)
        const hoverSec = window._findSectionAt ? window._findSectionAt(ev.clientX, ev.clientY) : null;
        if (hoverSec && hoverSec !== sec) {
          // 부모 섹션 변경 — DOM 이동 + 모든 points를 새 섹션 기준으로 재계산.
          // 새 좌표 = (현재 마우스 - 새 섹션 rect.left)/zoom - (시작 마우스의 sec-local 위치 - 점의 시작 좌표)
          const newSecRect = hoverSec.getBoundingClientRect();
          const mouseInNewSecX = (ev.clientX - newSecRect.left) / _zoom();
          const mouseInNewSecY = (ev.clientY - newSecRect.top)  / _zoom();
          for (let i = 0; i < points.length; i++) {
            const offX = startPoints[i][0] - startMouseSecX;
            const offY = startPoints[i][1] - startMouseSecY;
            points[i] = [mouseInNewSecX + offX, mouseInNewSecY + offY];
          }
          hoverSec.appendChild(block);
          sec = hoverSec;
          // 새 섹션 기준으로 startPoints/startMouseSec 갱신해서 다음 mousemove가 부드럽게 이어지게.
          startSecRect = newSecRect;
          startMouseSecX = mouseInNewSecX;
          startMouseSecY = mouseInNewSecY;
          startPoints = points.map(p => [p[0], p[1]]);
          // bbox clamp (모든 points)
          _clampAnnotPoints(points, sec);
          _updateBlockGeometry(block, points);
          // 선택 핸들/박스 갱신
          _ensureHandles(block);
          return;
        }

        // 같은 섹션 또는 섹션 밖 — 기존 섹션 유지 + clamp
        const dx = (ev.clientX - startX) / _zoom();
        const dy = (ev.clientY - startY) / _zoom();
        const candidate = startPoints.map(p => [p[0] + dx, p[1] + dy]);
        // 전체 points의 bbox를 sec 안으로 clamp (dx/dy를 추가 보정)
        const { adjX, adjY } = _clampDeltaForPoints(candidate, sec);
        for (let i = 0; i < points.length; i++) {
          points[i] = [candidate[i][0] + adjX, candidate[i][1] + adjY];
        }
        _updateBlockGeometry(block, points);
      };
      const startSec = sec;
      const onUp = () => {
        document.removeEventListener('mousemove', onMove, true);
        document.removeEventListener('mouseup',   onUp,   true);
        if (dragging) {
          _writePoints(block, points);
          if (typeof window.pushHistory === 'function') window.pushHistory('어노테이션 이동');
          if (sec !== startSec) window.buildLayerPanel?.();   // ★1013t1A1 — 섹션을 건넜으면 행도 그 섹션 밑으로
          window.scheduleAutoSave?.();
        } else if (wasSelected && !lastOnly) {
          // ★1013t1A3 — 이미 선택된 어노테이션의 라벨을 «안 움직이고» 한 번 더 누르면 라벨을 고른다(다음 끌기 = 라벨만)
          label.classList.add('annot-cell-selected');
        }
      };
      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('mouseup',   onUp,   true);
    }, true);

    // ── 핸들 드래그 (event delegation: svg에 등록) ────────────────────
    const svg = block.querySelector('.annot-svg');
    if (svg) {
      svg.addEventListener('mousedown', (e) => {
        if (document.body.classList.contains('pen-mode')) return;
        const h = e.target.closest('.annot-handle');
        if (!h) return;
        if (e.button !== 0) return;
        // ★1013t2C7 — 회전 손잡이는 점 번호가 없다 → 점 끌기 판정보다 «먼저» 가른다
        if (h.classList.contains('annot-rot-handle')) { _startAnchorRotateDrag(block, e); return; }
        /* ★t3-01 — 치수선 양끝 손잡이도 ★점 번호가 ★없다 ⇒ ★점 끌기 판정보다 ★먼저 가른다 */
        if (h.classList.contains('annot-dim-handle')) { _startDimEndDrag(block, h, e); return; }
        e.stopPropagation();
        e.preventDefault();

        const idx = parseInt(h.dataset.pointIdx, 10);
        if (Number.isNaN(idx)) return;

        const startX = e.clientX;
        const startY = e.clientY;
        const points = _readPoints(block);
        if (!points[idx]) return;
        const startPoint = [points[idx][0], points[idx][1]];
        let dragging = false;

        // ★1017t1h1 — 이웃 점(drag 중 안 변하는 쪽)을 기준(ref)으로 8방향 자석.
        const neighborIdx = idx > 0 ? idx - 1 : (points[idx + 1] ? idx + 1 : null);
        const refArr = neighborIdx != null ? [points[neighborIdx][0], points[neighborIdx][1]] : null;

        const _hist = window.beginDragHistory?.('어노테이션 핸들 이동');
        const onMove = (ev) => {
          const dx = (ev.clientX - startX) / _zoom();
          const dy = (ev.clientY - startY) / _zoom();
          if (!dragging) {
            if (Math.abs(ev.clientX - startX) < 2 && Math.abs(ev.clientY - startY) < 2) return;
            dragging = true;
            /* ★«시작 상태»를 여기서 1회 찍는다 — 끝 상태는 onUp 의 pushHistory. 드래그는 «양쪽 끝»을
               다 남겨야 삽입(push-before) 뒤 첫 드래그에서 ⌘Z 가 삽입까지 먹지 않는다(js/drag-history.js). */
            _hist?.arm(dx, dy);
          }
          const raw = { x: startPoint[0] + dx, y: startPoint[1] + dy };
          const snapped = refArr ? window._snapVecToStep(raw, { x: refArr[0], y: refArr[1] }, { tolDeg: ev.shiftKey ? null : window.ANNOT_SNAP_TOL_DEG }) : raw;
          points[idx] = [snapped.x, snapped.y];
          /* ★t4-21 — 치수선의 흰 점(d·c)은 «일반 어노테이션 꼴»(_updateBlockGeometry: 라벨 = points[last])로 그리면 안 된다 —
             라벨이 치수선을 떠나 점 c 로 옮겨졌다(05eefbd5 실측: 라벨−중점 (0,−11) → (212.2, 55)).
             ⇒ a·b 끌기(_startDimEndDrag)와 «같은 한 자리»(annotRedrawDim)로 그린다 — 라벨은 labelAt(치수선 중점 + lift). */
          if (block.dataset.annotKind === 'dim' && typeof window.annotRedrawDim === 'function') {
            _writePoints(block, points);
            const st = window.annotPropsFromDataset?.(block);
            if (st) window.annotRedrawDim(block, st);
            window.annotRefreshHandles?.(block);
          } else {
            _updateBlockGeometry(block, points);
          }
          if (refArr) _showPointAngleLabel(block, refArr, points[idx]);
        };
        const onUp = () => {
          document.removeEventListener('mousemove', onMove, true);
          document.removeEventListener('mouseup',   onUp,   true);
          _hidePointAngleLabel(block);
          if (dragging) {
            _writePoints(block, points);
            if (typeof window.pushHistory === 'function') window.pushHistory('어노테이션 핸들 이동');
            window.scheduleAutoSave?.();
          }
        };
        document.addEventListener('mousemove', onMove, true);
        document.addEventListener('mouseup',   onUp,   true);
      }, true);
    }
  }
  /* ★★t3-01 — 치수선 ★양끝(a·b) 끌기. ★자리는 ★절대좌표로 `dimA`/`dimB` 에 ★그대로 넣는다.
     ⛔각도 자석을 ★안 탄다 — a·b 는 ★「보기 좋은 자리」지 ★각도를 재는 점이 ★아니다(현빈 2차 설계).
     ★한쪽만 끌면 ★치수선이 ★기울고 ★보조선 길이가 ★갈린다 — ★그것이 ★요구된 동작이다. */
  function _startDimEndDrag(block, handle, e) {
    e.stopPropagation(); e.preventDefault();
    const end = handle.dataset.dimEnd === 'B' ? 'dimB' : 'dimA';
    const startX = e.clientX, startY = e.clientY;
    const from = [parseFloat(handle.getAttribute('cx')), parseFloat(handle.getAttribute('cy'))];
    if (!Number.isFinite(from[0]) || !Number.isFinite(from[1])) return;
    let dragging = false;
    const _hist = window.beginDragHistory?.('치수선 끝 이동');
    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / _zoom();
      const dy = (ev.clientY - startY) / _zoom();
      if (!dragging) {
        if (Math.abs(ev.clientX - startX) < 2 && Math.abs(ev.clientY - startY) < 2) return;
        dragging = true; _hist?.arm(dx, dy);
      }
      const pt = [Math.round((from[0] + dx) * 10) / 10, Math.round((from[1] + dy) * 10) / 10];
      block.dataset[end] = JSON.stringify(pt);
      /* ★한 끝만 끌면 ★나머지는 ★계산값이다 — ★그 값을 ★고정해 둬야 ★다음에 안 흔들린다 */
      const other = end === 'dimA' ? 'dimB' : 'dimA';
      if (!block.dataset[other]) {
        const st0 = window.annotPropsFromDataset?.(block);
        const g0 = st0 && window.annotDimGeometry?.(st0.points, {
          dimAxis: st0.dimAxis, dimOffset: st0.dimOffset, dimSlide: st0.dimSlide,
          dimA: st0.dimA, dimB: st0.dimB,
        });
        if (g0) block.dataset[other] = JSON.stringify(g0.line[other === 'dimA' ? 0 : 1]);
      }
      const st = window.annotPropsFromDataset?.(block);
      if (st) window.annotRedrawDim?.(block, st);
      window.annotRefreshHandles?.(block);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup',   onUp,   true);
      if (dragging) {
        window.pushHistory?.('치수선 끝 이동');
        window.scheduleAutoSave?.();
      }
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup',   onUp,   true);
  }

  window.bindAnnotationSelect = bindAnnotationSelect;

  // ── 라벨 편집 진입 (★1013t2C6 — 한 벌: 더블클릭 · 펜으로 만든 직후 둘 다 여기로) ──────────
  /* 키 규약 = 스텝·카드 블럭과 같다(js/blocks/step-block.js · canvas-block.js):
       Enter / ⇧Enter = 줄바꿈 · ⌘/Ctrl+Enter · Esc · 바깥 클릭(blur) = 마침.
     ⛔한글 조합 중 Enter(isComposing · keyCode 229)는 조합 확정이다 — 건드리지 않는다(그래프 라벨과 같은 가드).
     확정 = innerText → annotNormalizeText → textContent 로 다시 쓰기(<br> 잔재 0) → 바뀌었으면 끝 표본.
     히스토리: 들어갈 때 체크포인트(앞) + 바뀌었으면 '어노테이션 글'(끝) — 편집 한 번 = ⌘Z 한 걸음(그래프 라벨 꼴). */
  function annotBeginLabelEdit(block, label) {
    if (!block || !label) return;
    if (label.getAttribute('contenteditable') === 'true') return;   // 이미 편집 중
    window.ensureHistoryCheckpoint?.('어노테이션 글 편집 전');
    const before = block.dataset.text || '';
    /* ★1017t1h3 — 편집 «전» 부분 서식도 기억한다(line-host `beforeHtml` · 그리드 `_gridBeforeHtml` 꼴).
       ⛔평문만 견주면 «글자는 그대로, 서식만 바뀐» 커밋(⌘B 만 눌렀다 · 고른 글자만 색을 바꿨다)을
         «안 바뀌었다»로 읽어 ★그 서식이 ⌘Z 표본에 안 들어간다. */
    const beforeHtml = block.dataset.labelHtml || '';
    label.setAttribute('contenteditable', 'true');
    let done = false;
    const onKey = (ev) => {
      if (ev.isComposing || ev.keyCode === 229) return;
      if (ev.key === 'Enter') {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.metaKey || ev.ctrlKey) { label.blur(); return; }
        document.execCommand('insertText', false, '\n');
      } else if (ev.key === 'Escape') {
        ev.stopPropagation();
        label.blur();
      }
    };
    // 붙여넣기는 평문만(line-host 꼴) — 서식·<div> 가 라벨에 들어오지 않게
    const onPaste = (ev) => {
      ev.preventDefault();
      const t = ev.clipboardData?.getData('text/plain') || '';
      if (t) document.execCommand('insertText', false, t);
    };
    const finish = () => {
      if (done) return;
      done = true;
      label.removeEventListener('keydown', onKey);
      label.removeEventListener('paste',   onPaste);
      label.removeEventListener('blur',    finish);
      const raw = label.innerText ?? label.textContent ?? '';
      /* ★1017t1h3 — 부분 서식을 ★같이 싣는다(line-host lnBeginEdit finish 와 ★같은 규약).
         ★읽기는 contenteditable 을 ★끄기 «전»에 — 끄고 나면 브라우저가 편집 잔재를 ★정리할 수 있다.
         ★`annotReadLabelHtml` = 블럭 경계 펴기 ＋ 공용 sanitize(ANNOT_RICH_TEXT_OPTS) ★한 벌. */
      const html = window.annotReadLabelHtml(label);
      label.setAttribute('contenteditable', 'false');
      const val = window.annotNormalizeText(raw) || (window.ANNOT_DEFAULTS?.text || '텍스트');
      /* ★서식이 ★실제로 있을 때만 싣는다 — 없으면 '' ⇒ 키를 ★지워 ★평문 경로로 돌아간다(스티커 textHtml 규약).
         ⇒ ★서식을 ★전부 지우면(⌘B 두 번) ★키가 ★사라져 ★옛 저장본과 ★같은 꼴이 된다. */
      const nextHtml = window.annotLabelHtmlToStore(html);
      if (nextHtml) label.innerHTML = nextHtml;
      else label.textContent = val;      // ★평문 갈래는 ★예전 그대로(<br> 잔재 0)
      block.dataset.text = val;
      if (nextHtml) block.dataset.labelHtml = nextHtml;
      else delete block.dataset.labelHtml;
      if (val !== before || nextHtml !== beforeHtml) window.pushHistory?.('어노테이션 글');
      window.scheduleAutoSave?.();
    };
    label.addEventListener('keydown', onKey);
    label.addEventListener('paste',   onPaste);
    label.addEventListener('blur',    finish);
    setTimeout(() => {
      label.focus();
      try {
        const range = document.createRange();
        range.selectNodeContents(label);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (_) {}
    }, 0);
  }
  window.annotBeginLabelEdit = annotBeginLabelEdit;
})();
