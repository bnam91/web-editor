/* ══════════════════════════════════════
   스크래치 → 캔버스 섹션 자동 변환 (AssetBlock 드롭)

   트리거: scratch-pad.js의 mousemove/mouseup에서 직접 호출 (native DnD 사용 안 함).

   케이스 분기 (좌표 기반):
     A. asset-block 위 → 이미지 교체 (.sp2c-replace-target)
     B. section-block 내부 row/gap/frame 위 → 사이에 새 asset-block 삽입 (.sp2c-insert-indicator)
     C. section-block 빈 영역 → 섹션 끝(bottomGap 앞)에 새 asset-block 추가 (.sp2c-section-target)
     D. canvas-wrap 바깥 / 섹션 밖 → 가이드 숨김 (변환 안 함)

   외부 API:
     previewScratchDropAt(x, y)  — mousemove에서 호출. 가이드 렌더 + 케이스 종류 반환
     commitScratchDropAt(x, y, src)  — mouseup에서 호출. 실제 변환 수행. boolean 반환
     clearScratchDropGuides()  — 드래그 종료 시 가이드 정리
══════════════════════════════════════ */

// 활성 가이드 상태 (드래그 1회 사이클 동안 유지)
let _activeReplaceAb = null;     // .sp2c-replace-target 부착된 asset-block
let _activeSectionTarget = null; // .sp2c-section-target 부착된 section-block
let _activeIndicator = null;     // .sp2c-insert-indicator DOM 노드

let _rafId = null;
let _pending = null;             // { clientX, clientY }

function _typesHasScratch(dataTransfer) {
  if (!dataTransfer) return false;
  // dataTransfer.types는 DOMStringList(타입) 또는 Array(브라우저별)이므로 둘 다 지원
  const t = dataTransfer.types;
  if (!t) return false;
  if (typeof t.contains === 'function') return t.contains(MIME);
  return Array.prototype.indexOf.call(t, MIME) !== -1;
}

function _clearReplaceBadge(ab) {
  if (!ab) return;
  ab.classList.remove('sp2c-replace-target');
  ab.querySelectorAll(':scope > .sp2c-badge').forEach(b => b.remove());
}

function _clearSectionBadge(sec) {
  if (!sec) return;
  sec.classList.remove('sp2c-section-target');
  sec.querySelectorAll(':scope > .sp2c-badge').forEach(b => b.remove());
}

function _clearGuides() {
  if (_activeReplaceAb) { _clearReplaceBadge(_activeReplaceAb); _activeReplaceAb = null; }
  if (_activeSectionTarget) { _clearSectionBadge(_activeSectionTarget); _activeSectionTarget = null; }
  if (_activeIndicator) { _activeIndicator.remove(); _activeIndicator = null; }
  // 누수 안전망 — 외부에서 미정리된 가이드 흔적 일괄 정리
  document.querySelectorAll('.sp2c-replace-target').forEach(el => el.classList.remove('sp2c-replace-target'));
  document.querySelectorAll('.sp2c-section-target').forEach(el => el.classList.remove('sp2c-section-target'));
  document.querySelectorAll('.sp2c-badge').forEach(el => el.remove());
  document.querySelectorAll('.sp2c-insert-indicator').forEach(el => el.remove());
}

function _addBadge(host, label, posBottom) {
  // host 기준 상대 위치 — host position이 static이면 일시적으로 relative
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const badge = document.createElement('div');
  badge.className = 'sp2c-badge' + (posBottom ? ' sp2c-badge-append' : ' sp2c-badge-replace');
  badge.textContent = label;
  host.appendChild(badge);
  return badge;
}

/* 케이스 판정:
   { kind:'replace', ab }          — A
   { kind:'insert', sec, inner, after }  — B
   { kind:'append', sec, inner }   — C
   { kind:'none' }                 — D
*/
function _classifyDrop(clientX, clientY) {
  const hit = document.elementFromPoint(clientX, clientY);
  if (!hit) return { kind: 'none' };

  // 케이스 A: 에셋 블록 (이미지 교체) — 우선순위 최상
  const ab = hit.closest('.asset-block');
  if (ab && ab.closest('#canvas-scaler')) {
    return { kind: 'replace', ab };
  }

  // 섹션 안에 있는가
  const sec = hit.closest('.section-block');
  if (!sec || !sec.closest('#canvas-scaler')) return { kind: 'none' };

  const inner = sec.querySelector('.section-inner') || sec;

  // 케이스 B: row / gap / frame 위에 있으면 사이 삽입
  const rowLike = hit.closest('.row, .gap-block, .frame-block');
  if (rowLike && inner.contains(rowLike)) {
    // section-inner의 직속 자식 기준으로만 위치 계산 (frame 내부는 본 모듈 적용 X — 섹션 끝 동작이 자연스러움)
    const after = (typeof window.getDragAfterElement === 'function')
      ? window.getDragAfterElement(inner, clientY)
      : null;
    return { kind: 'insert', sec, inner, after };
  }

  // 케이스 C: section-block의 빈 영역(여백) — 섹션 끝에 추가
  return { kind: 'append', sec, inner };
}

function _renderGuide(decision) {
  // 새로운 결정과 기존 가이드가 동일하면 재배치 스킵 (깜빡임 방지)
  if (decision.kind === 'replace') {
    if (_activeReplaceAb === decision.ab) return;
    _clearGuides();
    decision.ab.classList.add('sp2c-replace-target');
    _addBadge(decision.ab, '이미지 교체', false);
    _activeReplaceAb = decision.ab;
    return;
  }
  if (decision.kind === 'insert') {
    _clearGuides();
    const ind = document.createElement('div');
    ind.className = 'sp2c-insert-indicator';
    if (decision.after) decision.inner.insertBefore(ind, decision.after);
    else decision.inner.appendChild(ind);
    _activeIndicator = ind;
    return;
  }
  if (decision.kind === 'append') {
    if (_activeSectionTarget === decision.sec) return;
    _clearGuides();
    decision.sec.classList.add('sp2c-section-target');
    _addBadge(decision.sec, '섹션 끝에 추가', true);
    _activeSectionTarget = decision.sec;
    return;
  }
  // kind === 'none'
  _clearGuides();
}

// mousemove 시 호출 — 가이드 렌더 + 분류 종류 반환 ('replace'|'insert'|'append'|'none')
function previewScratchDropAt(clientX, clientY) {
  const decision = _classifyDrop(clientX, clientY);
  _renderGuide(decision);
  return decision.kind;
}

// mouseup 시 호출 — 실제 변환 수행. 변환 성공이면 true 반환.
// opts.naturalWidth, opts.naturalHeight — 새 asset-block의 aspect-ratio 적용용 (insert/append 케이스).
// history pushHistory는 호출자가 책임 (sideEffects hook과 함께 push 가능하도록).
function commitScratchDropAt(clientX, clientY, src, opts = {}) {
  const decision = _classifyDrop(clientX, clientY);
  _clearGuides();
  if (decision.kind === 'none' || !src) return false;

  // block이 row에 삽입된 *후* sync로 호출 (offsetWidth 측정 위해 부모 layout 필요)
  const applyAspectSync = (block) => {
    const nw = opts.naturalWidth, nh = opts.naturalHeight;
    if (!Number.isFinite(nw) || !Number.isFinite(nh) || nw <= 0 || nh <= 0) return;
    // aspect-ratio 임시 적용 + offsetWidth 읽기로 reflow 강제 → 즉시 px로 잠금
    // (aspectRatio가 인라인에 남으면 핸들 resize 시 width도 같이 늘어남 — 그래서 px로 잠그고 제거)
    block.style.aspectRatio = `${nw} / ${nh}`;
    block.style.height = 'auto';
    const w = block.offsetWidth; // reflow trigger
    if (w > 0) {
      block.style.height = (w * (nh / nw)) + 'px';
    }
    block.style.aspectRatio = '';
  };

  // 변환 후 effective usePadx 기반으로 margin/width 재계산 (inner 단위)
  const reapplyPadX = (inner) => {
    if (!inner) return;
    const hasOverride = inner.dataset.paddingX !== '' && inner.dataset.paddingX !== undefined;
    const px = hasOverride ? parseInt(inner.dataset.paddingX) : (window.state?.pageSettings?.padX || 0);
    window.applyPadXToSection?.(inner, px || 0);
  };

  if (decision.kind === 'replace') {
    if (typeof window.setAssetImageFromSrc !== 'function') {
      console.warn('[canvas-scratch-drop] setAssetImageFromSrc 누락 — 변환 스킵');
      return false;
    }
    window.setAssetImageFromSrc(decision.ab, src);
    reapplyPadX(decision.ab.closest('.section-inner'));
  } else if (decision.kind === 'insert') {
    if (typeof window.makeAssetBlock !== 'function') {
      console.warn('[canvas-scratch-drop] makeAssetBlock 누락');
      return false;
    }
    const { row, block } = window.makeAssetBlock();
    // after가 inner의 직속 자식이 아닐 수 있음 (race / nested 등) — 안전 가드
    if (decision.after && decision.inner.contains(decision.after) && decision.after.parentNode === decision.inner) {
      decision.inner.insertBefore(row, decision.after);
    } else {
      decision.inner.appendChild(row);
    }
    // 풀-블리드 width 먼저 적용 → 그 다음 aspect 비율로 height 계산해야 정확
    reapplyPadX(decision.inner);
    applyAspectSync(block);
    window.bindBlock?.(block);
    window.setAssetImageFromSrc?.(block, src);
    window.buildLayerPanel?.();
  } else if (decision.kind === 'append') {
    if (typeof window.makeAssetBlock !== 'function') {
      console.warn('[canvas-scratch-drop] makeAssetBlock 누락');
      return false;
    }
    const { row, block } = window.makeAssetBlock();
    if (typeof window.insertBeforeBottomGap === 'function') {
      window.insertBeforeBottomGap(decision.sec, row);
    } else {
      decision.inner.appendChild(row);
    }
    // 풀-블리드 width 먼저 적용 → 그 다음 aspect 비율로 height 계산해야 정확
    reapplyPadX(decision.inner);
    applyAspectSync(block);
    window.bindBlock?.(block);
    window.setAssetImageFromSrc?.(block, src);
    window.buildLayerPanel?.();
  }

  window.triggerAutoSave?.();
  return true;
}

function clearScratchDropGuides() { _clearGuides(); }

export { previewScratchDropAt, commitScratchDropAt, clearScratchDropGuides };
