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
        window.scheduleAutoSave?.();
      }
    }, true);
  }

  // ── 선택 / 해제 ─────────────────────────────────────────────────────
  function _deselectAllAnnotations() {
    document.querySelectorAll('.annotation-block.selected').forEach(b => {
      b.classList.remove('selected');
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
  }
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

    // anchor (시작점) SVG 노드 교체
    const svg = block.querySelector('.annot-svg');
    const oldAnchor = block.querySelector('.annot-anchor');
    if (oldAnchor) oldAnchor.remove();
    const shape = block.dataset.anchorShape || 'circle';
    const size  = parseFloat(block.dataset.anchorSize) || 7;
    const color = block.dataset.strokeColor || '#e74c3c';
    if (shape !== 'none' && svg && typeof window._renderAnnotAnchorSVG === 'function') {
      const html = window._renderAnnotAnchorSVG(shape, size, points[0][0], points[0][1], color);
      if (html) {
        // 임시 컨테이너로 SVG 노드 파싱
        const tmp = document.createElementNS(SVG_NS, 'svg');
        tmp.innerHTML = html;
        const node = tmp.firstElementChild;
        if (node) {
          // line 다음에 anchor 배치 (handles 앞)
          const firstHandle = svg.querySelector('.annot-handle');
          if (firstHandle) svg.insertBefore(node, firstHandle);
          else svg.appendChild(node);
        }
      }
    }

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
      _enterLabelEdit(block, label);
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

      // 선택되지 않았다면 선택만 하고 드래그는 다음 mousedown부터
      if (!block.classList.contains('selected')) {
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

      const onMove = (ev) => {
        if (!dragging) {
          if (Math.abs(ev.clientX - startX) < 3 && Math.abs(ev.clientY - startY) < 3) return;
          dragging = true;
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
      const onUp = () => {
        document.removeEventListener('mousemove', onMove, true);
        document.removeEventListener('mouseup',   onUp,   true);
        if (dragging) {
          _writePoints(block, points);
          if (typeof window.pushHistory === 'function') window.pushHistory('어노테이션 이동');
          window.scheduleAutoSave?.();
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

        const onMove = (ev) => {
          const dx = (ev.clientX - startX) / _zoom();
          const dy = (ev.clientY - startY) / _zoom();
          if (!dragging) {
            if (Math.abs(ev.clientX - startX) < 2 && Math.abs(ev.clientY - startY) < 2) return;
            dragging = true;
          }
          points[idx] = [startPoint[0] + dx, startPoint[1] + dy];
          _updateBlockGeometry(block, points);
        };
        const onUp = () => {
          document.removeEventListener('mousemove', onMove, true);
          document.removeEventListener('mouseup',   onUp,   true);
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
  window.bindAnnotationSelect = bindAnnotationSelect;

  // ── 라벨 편집 진입 ──────────────────────────────────────────────────
  function _enterLabelEdit(block, label) {
    label.setAttribute('contenteditable', 'true');
    const onKey = (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        label.blur();
      } else if (ev.key === 'Escape') {
        ev.stopPropagation();
        label.blur();
      }
    };
    const onBlur = () => {
      label.setAttribute('contenteditable', 'false');
      const txt = (label.textContent || '').trim();
      if (!txt) {
        label.textContent = '텍스트';
        block.dataset.text = '텍스트';
      } else {
        block.dataset.text = txt;
      }
      label.removeEventListener('keydown', onKey);
      label.removeEventListener('blur',    onBlur);
      window.scheduleAutoSave?.();
    };
    label.addEventListener('keydown', onKey);
    label.addEventListener('blur',    onBlur);
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
})();
