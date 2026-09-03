/* ══════════════════════════════════════
   스크래치 → 캔버스 섹션 자동 변환 (AssetBlock 드롭)

   트리거: scratch-pad.js의 mousemove/mouseup에서 직접 호출 (native DnD 사용 안 함).

   케이스 분기 (좌표 기반):
     A. asset-block 위 → 이미지 교체 (.sp2c-replace-target)
     B. section-block 내부 row/gap/frame 위 → 사이에 새 asset-block 삽입 (.sp2c-insert-indicator)
     C. section-block 빈 영역 → 섹션 끝(bottomGap 앞)에 새 asset-block 추가 (.sp2c-section-target)
     D. canvas-wrap 바깥 / 섹션 밖 → 가이드 숨김 (변환 안 함)

   외부 API:
     previewScratchDropAt(x, y, opts)  — mousemove에서 호출. 가이드 렌더 + 케이스 종류 반환
     commitScratchDropAt(x, y, src, opts)  — mouseup에서 호출. 실제 변환 수행. boolean 반환
     clearScratchDropGuides()  — 드래그 종료 시 가이드 정리

   opts.requireArm (기본 false — 기존 호출자 동작 100% 유지):
     체류(dwell) 기반 '아밍' 게이트. 같은 타깃 위에 ARM_DELAY_MS 이상 머물러야
     가이드(하이라이트)가 뜨고(=armed), commit도 armed 상태에서만 수행된다.
     섹션을 스치기만 한 릴리즈가 오드롭되는 것을 차단 (scratch-pad 드래그용).
══════════════════════════════════════ */

// 활성 가이드 상태 (드래그 1회 사이클 동안 유지)
let _activeReplaceAb = null;     // .sp2c-replace-target 부착된 asset-block
let _activeSectionTarget = null; // .sp2c-section-target 부착된 section-block
let _activeSectionLocked = false; // 그 섹션이 «배경 위치 편집 중»이라 배경 교체를 막고 있는가
let _activeIndicator = null;     // .sp2c-insert-indicator DOM 노드
let _activeNewSection = null;    // newsection 배지 호스트(#canvas-scaler)

// ── 체류(dwell) 아밍 상태 (opts.requireArm 전용) ─────────────
const ARM_DELAY_MS = 250;        // 같은 타깃 위 최소 체류 시간
let _armEl = null;               // 현재 아밍 대상 엘리먼트 (replace→ab, insert/sectionbg→sec, newsection→scaler)
let _armKind = null;             // 현재 아밍 대상 kind
let _armSince = 0;               // 타깃 진입 시각 (performance.now())
let _armTimer = null;            // 정지 호버 시 아밍 완료 시점에 가이드를 띄우기 위한 타이머
let _lastPreviewArgs = null;     // 마지막 preview 좌표 (타이머 콜백에서 재분류용)

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
  _activeSectionLocked = false;
  if (_activeIndicator) { _activeIndicator.remove(); _activeIndicator = null; }
  if (_activeNewSection) { _activeNewSection.querySelectorAll(':scope > .sp2c-badge').forEach(b => b.remove()); _activeNewSection = null; }
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

  // 다른 스크래치 아이템 위 릴리즈 — scaler 자식이라 newsection으로 오분류되던 경로 차단
  if (hit.closest('.scratch-item')) return { kind: 'none' };

  // 케이스 A: 에셋 블록 (이미지 교체) — 우선순위 최상
  const ab = hit.closest('.asset-block');
  if (ab && ab.closest('#canvas-scaler')) {
    return { kind: 'replace', ab };
  }

  // 케이스 A2: 카드 캔버스(cvb) 셀 → 해당 카드 이미지 교체 (현빈 요청: 스크래치→카드).
  // rowLike(insert) 판정보다 먼저 — cvb는 row 안에 있어 순서 바뀌면 insert로 오분류.
  const cvbCell = hit.closest('[data-cvb-card-idx]');
  if (cvbCell) {
    const cvb = cvbCell.closest('.canvas-block[data-card-mode]');
    if (cvb && cvb.closest('#canvas-scaler')) {
      return { kind: 'cvbcard', cvb, cell: cvbCell, idx: parseInt(cvbCell.dataset.cvbCardIdx) };
    }
  }

  // 섹션 안에 있는가
  const sec = hit.closest('.section-block');
  if (!sec || !sec.closest('#canvas-scaler')) {
    // 섹션 밖이지만 메인 편집영역(#canvas-scaler) 안이면 → 새 섹션 생성
    if (hit.closest('#canvas-scaler')) return { kind: 'newsection' };
    return { kind: 'none' };
  }

  const sectionInner = sec.querySelector('.section-inner') || sec;

  // 케이스 B: row / gap / frame 위(=섹션 본문 콘텐츠) → 블록 사이에 에셋블럭 삽입
  const rowLike = hit.closest('.row, .gap-block, .frame-block');
  /* ★삽입 «컨테이너»는 놓은 자리를 «직접» 품은 곳이어야 한다.
     합쳐 넣은 몸(.section-merged-part)은 section-inner 의 자식 «하나»로 보이므로,
     거기에 놓아도 위치 계산이 상자 통째의 앞뒤로 떨어진다 — 놓은 데가 아니라 엉뚱한 자리에 생긴다
     (실측 2026-09-03: 상자 안 텍스트 위에 놓았는데 위쪽 본문에 생겼다). */
  const inner = (rowLike && rowLike.closest('.section-merged-part')) || sectionInner;
  if (rowLike && inner.contains(rowLike)) {
    // section-inner의 직속 자식 기준으로만 위치 계산 (frame 내부는 본 모듈 적용 X — 섹션 끝 동작이 자연스러움)
    const after = (typeof window.getDragAfterElement === 'function')
      ? window.getDragAfterElement(inner, clientY)
      : null;
    return { kind: 'insert', sec, inner, after };
  }

  /* 케이스 C: section-block의 빈 영역/가장자리 → 섹션 배경 이미지로 설정 (드롭 위치 구분 #5b)
     ★합쳐 넣은 몸의 «빈 여백»에 놓으면 rowLike 에 안 걸려 여기로 빠지는데,
       그대로 두면 «위 섹션 전체» 배경이 바뀐다 — 놓은 자리엔 안 보이고 위쪽만 변한다.
       그 자리는 배경 바꿀 자리가 아니라 «그 몸의 끝에 넣을» 자리다. */
  const inPart = hit.closest('.section-merged-part');
  if (inPart) {
    return { kind: 'insert', sec, inner: inPart, after: null };
  }
  /* ★섹션 배경 «위치 편집»이 켜져 있으면 «바꾸지 않는다».
     편집 모드가 섹션을 프록시로 덮고 있어 rowLike 판정이 전부 빠지고 여기로만 떨어진다 —
     그대로 두면 「편집하려고 켜 놨는데 배경이 바뀌었다」가 되고, 편집 세션은 «옛 이미지 기준»
     기하를 새 배경에 커밋해 어긋남이 조용히 남는다.
     ⚠️여기서 편집을 «대신 끝내지» 않는다 — 사용자가 시킨 적 없는 동작이라 더 놀랍다.
       무시하되 호버 배지 + 드롭 토스트로 «왜 안 되는지»를 말한다(조용한 무반응은 고장으로 읽힌다). */
  if (sec._secBgEditing) return { kind: 'sectionbg', sec, inner: sectionInner, locked: true };
  return { kind: 'sectionbg', sec, inner: sectionInner };   // 배경은 «섹션» 것이지 상자 것이 아니다
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
  if (decision.kind === 'cvbcard') {
    // replace와 동일 시각 언어(.sp2c-replace-target) 재사용 — 활성 슬롯도 공유(정리 경로 동일)
    if (_activeReplaceAb === decision.cell) return;
    _clearGuides();
    decision.cell.classList.add('sp2c-replace-target');
    _addBadge(decision.cell, '카드 이미지로', false);
    _activeReplaceAb = decision.cell;
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
  if (decision.kind === 'sectionbg') {
    // locked 가 바뀌면(호버 중 Esc) 배지를 다시 그려야 하므로 잠금상태도 동일성 판정에 넣는다
    if (_activeSectionTarget === decision.sec && _activeSectionLocked === !!decision.locked) return;
    _clearGuides();
    decision.sec.classList.add('sp2c-section-target');
    _addBadge(decision.sec, decision.locked ? '배경 위치 편집 중 — Esc 로 마친 뒤 놓으세요' : '섹션 배경으로', true);
    _activeSectionTarget = decision.sec;
    _activeSectionLocked = !!decision.locked;
    return;
  }
  if (decision.kind === 'newsection') {
    // 캔버스 빈 영역 — 별도 타깃 DOM이 없어 body에 안내 배지만 (중복 방지 위해 1회만)
    if (_activeNewSection) return;
    _clearGuides();
    const scaler = document.getElementById('canvas-scaler');
    if (scaler) { _addBadge(scaler, '새 섹션으로 추가', true); _activeNewSection = scaler; }
    return;
  }
  // kind === 'none'
  _clearGuides();
}

// 아밍 비교 기준이 되는 타깃 엘리먼트 산출
function _decisionTarget(decision) {
  if (decision.kind === 'replace') return decision.ab;
  if (decision.kind === 'cvbcard') return decision.cell;
  if (decision.kind === 'insert' || decision.kind === 'sectionbg') return decision.sec;
  if (decision.kind === 'newsection') return document.getElementById('canvas-scaler');
  return null;
}

function _resetArm() {
  if (_armTimer) { clearTimeout(_armTimer); _armTimer = null; }
  _armEl = null;
  _armKind = null;
  _armSince = 0;
  _lastPreviewArgs = null;
}

// mousemove 시 호출 — 가이드 렌더 + 분류 종류 반환 ('replace'|'insert'|'sectionbg'|'newsection'|'none')
// opts.requireArm=true면 같은 타깃 위 ARM_DELAY_MS 체류 후에만 가이드 렌더(=armed) + kind 반환.
function previewScratchDropAt(clientX, clientY, opts = {}) {
  const decision = _classifyDrop(clientX, clientY);

  if (!opts.requireArm) {
    _renderGuide(decision);
    return decision.kind;
  }

  _lastPreviewArgs = { clientX, clientY };
  const target = _decisionTarget(decision);
  if (decision.kind === 'none' || !target) {
    _resetArm();
    _clearGuides();
    return 'none';
  }

  const now = performance.now();
  if (target !== _armEl || decision.kind !== _armKind) {
    // 새 타깃 진입 — 아밍 리셋, 가이드는 숨긴 채 체류 시작
    if (_armTimer) clearTimeout(_armTimer);
    _armEl = target;
    _armKind = decision.kind;
    _armSince = now;
    _clearGuides();
    // 정지 호버(마우스 이동 없음) 시에도 아밍 완료 시점에 가이드가 뜨도록 예약
    // (setTimeout은 지정 시간보다 일찍 발화하지 않으므로 발화 시점엔 경과 >= ARM_DELAY_MS 보장)
    _armTimer = setTimeout(() => {
      _armTimer = null;
      if (!_lastPreviewArgs) return;
      const d = _classifyDrop(_lastPreviewArgs.clientX, _lastPreviewArgs.clientY);
      if (_decisionTarget(d) === _armEl && d.kind === _armKind) _renderGuide(d);
    }, ARM_DELAY_MS);
    return 'none';
  }

  // 같은 타깃 유지 중
  if (now - _armSince >= ARM_DELAY_MS) {
    // armed — 하이라이트 표시 (insert는 인디케이터 위치가 계속 갱신됨)
    if (_armTimer) { clearTimeout(_armTimer); _armTimer = null; }
    _renderGuide(decision);
    return decision.kind;
  }
  return 'none';
}

// mouseup 시 호출 — 실제 변환 수행. 변환 성공이면 true 반환.
// opts.naturalWidth, opts.naturalHeight — 새 asset-block의 aspect-ratio 적용용 (insert/append 케이스).
// opts.requireArm — 아밍(같은 타깃 위 ARM_DELAY_MS 이상 체류) 상태에서만 커밋. 미아밍 릴리즈는 false.
// history pushHistory는 호출자가 책임 (sideEffects hook과 함께 push 가능하도록).
function commitScratchDropAt(clientX, clientY, src, opts = {}) {
  const decision = _classifyDrop(clientX, clientY);
  if (opts.requireArm) {
    // 커밋 시각 기준으로 경과 재평가 → '가만히 들고 있다 릴리즈' 케이스도 정상 커밋
    const target = _decisionTarget(decision);
    const armed = !!target
      && target === _armEl
      && decision.kind === _armKind
      && (performance.now() - _armSince >= ARM_DELAY_MS);
    _resetArm();
    if (!armed) { _clearGuides(); return false; }
  }
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
  } else if (decision.kind === 'cvbcard') {
    // 카드 imgSrc 교체 — dataset.cards JSON 갱신 후 재렌더. 아이콘이 이미지보다 우선
    // 렌더되므로(card.icon && card.icon.svg 선판정) 드롭 의도=이미지 표시 → 아이콘 해제.
    try {
      const arr = JSON.parse(decision.cvb.dataset.cards || '[]');
      if (!arr[decision.idx]) return false;
      arr[decision.idx].imgSrc = src;
      if (arr[decision.idx].icon) arr[decision.idx].icon = null;
      decision.cvb.dataset.cards = JSON.stringify(arr);
      window.renderCanvas?.(decision.cvb);
    } catch (_) {
      return false;
    }
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
  } else if (decision.kind === 'sectionbg') {
    if (decision.locked || decision.sec?._secBgEditing) {
      window.showToast?.('배경 위치 편집 중에는 배경을 바꿀 수 없습니다 — Esc 로 마친 뒤 놓으세요');
      return false;
    }
    // 섹션 빈 영역/가장자리 드롭 → 섹션 배경 이미지로 설정 (#5b)
    if (typeof window.setSectionBgImage !== 'function') {
      console.warn('[canvas-scratch-drop] setSectionBgImage 누락');
      return false;
    }
    window.setSectionBgImage(decision.sec, src);
  } else if (decision.kind === 'newsection') {
    // 캔버스 빈 영역 드롭 → 새 섹션 생성 + 그 안에 에셋블럭 + 이미지 (#5a)
    if (typeof window.addSection !== 'function') {
      console.warn('[canvas-scratch-drop] addSection 누락');
      return false;
    }
    window.addSection({ skipDefaultBlock: true });
    const sections = document.querySelectorAll('#canvas .section-block');
    const sec = sections[sections.length - 1];
    if (!sec) return false;
    window.selectSection?.(sec);
    if (typeof window.addAssetBlock === 'function') {
      window.addAssetBlock();
      const blocks = sec.querySelectorAll('.asset-block');
      const ab = blocks[blocks.length - 1];
      if (ab) {
        // 좌우여백은 «그 블록이 실제로 들어간 곳» 기준이어야 한다(합쳐 넣은 몸이면 그 상자)
        const inner = ab.closest('.section-merged-part') || sec.querySelector('.section-inner') || sec;
        reapplyPadX(inner);
        applyAspectSync(ab);
        window.setAssetImageFromSrc?.(ab, src);
      }
    }
    window.buildLayerPanel?.();
  }

  window.triggerAutoSave?.();
  return true;
}

function clearScratchDropGuides() { _resetArm(); _clearGuides(); }

export { previewScratchDropAt, commitScratchDropAt, clearScratchDropGuides };

// 비-모듈 패널(예: assets-panel.js)에서도 사용 가능하도록 window에 노출
window.previewScratchDropAt   = previewScratchDropAt;
window.commitScratchDropAt    = commitScratchDropAt;
window.clearScratchDropGuides = clearScratchDropGuides;
