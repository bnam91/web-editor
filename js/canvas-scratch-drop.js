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

/* ★「스크래치 표시폭 → 실제로 박을 폭」 — DOM 이 «안» 필요한 순수 계산 (2026-09-20).
   ⛔이 계산을 applyScratchWidth 안에 묻어 두지 마라. 묻으면 단위로는 소스 문자열밖에 못 재고
     (리팩터하면 빨강 / 문자열만 남기고 동작을 깨면 초록), 진짜 숫자는 DOM 스펙에만 남는데
     tests/dom 은 `npm test` 스위트에 «안» 들어간다.
   ⇒ 세 밴드를 여기서 정하고, DOM 쪽은 «재서 넣고 받아 바르는» 일만 한다.
     ⑴ want ≤ full            → 그 폭 그대로, 음수마진 0
     ⑵ full < want ≤ full+2p  → 그 폭 그대로, 넘치는 만큼을 좌우로 «대칭»으로 먹는다(over)
     ⑶ want > full+2p         → 섹션 전체폭까지만(더 키우면 섹션 밖으로 잘린다)
   @param {number} want 스크래치패드에서 보이던 폭(캔버스 px)
   @param {number} full 블록이 «음수마진 없이» 쓸 수 있는 폭(부모 콘텐츠폭)
   @param {number} padX 그 블록이 든 상자의 좌우 패딩(한쪽) — 먹을 수 있는 여유
   @returns {{width:number, over:number}|null} null = 폭을 정할 근거가 없다(옵트인 미사용 포함) */
function planScratchWidth(want, full, padX) {
  const w0 = Number(want);
  if (!Number.isFinite(w0) || w0 <= 0) return null;
  if (!Number.isFinite(full) || full <= 0) return null;
  const p = Number.isFinite(padX) && padX > 0 ? padX : 0;
  const width = Math.round(Math.min(w0, full + p * 2));
  return { width, over: Math.max(0, (width - full) / 2) };
}

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
// opts.width — «출발지에서 보이던 표시폭»(캔버스 px). ★옵트인: 아는 호출자만 넘긴다.
//   넘기면 insert/newsection 으로 만들어지는 asset-block 이 그 폭으로 들어간다(풀폭 이상이면 무시).
//   ⛔replace 경로는 «그 블록의 크기»를 지킨다(이미지 교체이지 삽입이 아니다) — 여기서도 안 쓴다.
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

  /* ★「스크래치패드에서 보이던 폭 그대로」 — opts.width 옵트인 (현빈 신고 2026-09-20)
       ⚠️★순서가 계약이다: reapplyPadX «뒤», applyAspectSync «앞».
         applyAspectSync 는 높이를 block.offsetWidth 에서 «읽어» 계산한다 ⇒ 폭이 먼저 확정돼야
         비율이 스크래치에서 보이던 그대로 나온다. 뒤에 부르면 폭만 바뀌고 높이는 풀폭 기준으로
         남아 «더 이상한» 모양이 된다.
       ⛔860 같은 리터럴을 새로 적지 않는다 — 부모에서 «잰다»(섹션 padX·합쳐넣기로 콘텐츠폭이
         달라지는데 리터럴은 그걸 못 따라간다).

       ★★2026-09-20 픽스라운드 — 초판은 «콘텐츠폭 이상이면 아무 것도 안 했다».
         그래서 신고 증상이 «위쪽 밴드»에 그대로 살아 있었다: 새 프로젝트 기본 padX=72 면
         row 콘텐츠폭은 716 인데, 스크래치 일괄배치(scratch-pad.js SCRATCH_PLACE.WIDTH=860)로
         들어온 그림은 표시폭이 860 이다 ⇒ 드롭하면 716 (17% 축소, 실앱 9389 실측).
         「풀블리드를 그대로 둔다」던 초판 주석도 사실이 아니었다 — applyPadXToSection 은
         `:scope > .asset-block` 만 풀블리드로 만들고 row 안의 블록은 안 건드리므로,
         실제 결과는 860(풀블리드)이 아니라 716(콘텐츠폭)이었다.
       ⇒ 「콘텐츠폭 + 좌우 padX」(= 섹션 전체폭)까지를 «쓸 수 있는 범위»로 열고, 그 안에서는
         표시폭을 정확히 맞춘다. 넘치는 만큼은 좌우 음수마진으로 «대칭으로» 먹는다 —
         이 레포의 풀블리드 관용구(width + marginLeft + marginRight 를 «항상 세트로»,
         prop-page.js:applyAssetFullBleed 머리말)와 같은 꼴이고, padX 만큼 먹으면 곧 풀블리드다.
       ⚠️섹션 전체폭보다 큰 표시폭은 «거기까지만» 들어간다(더 키우면 섹션 밖으로 잘린다).
         그 한계는 보고서 notDone 에 적었다.
       ★px 폭 관용구는 prop-asset.js:203-214 applyW 와 «같은 벌»이다(width + alignSelf).
       ★usePadx 표식 = «음수마진을 먹었는가» 그대로 찍는다. 먹었으면 그 블록은 실제로
         좌우여백을 제외하고 있으므로 'true' 여야 우측패널 토글이 화면과 같은 말을 한다.
       ⚠️★하한을 여기서 «안» 건다 — 그래도 되는 이유가 2026-09-20 에 생겼다.
         스크래치 아이템은 60px 까지 줄어든다(scratch-pad.js 의 fMin). 예전엔 우측패널
         폭 슬라이더가 min=100 이라 «패널은 100 을 보여주는데 실제는 60» 이었고, 그래서
         「패널을 한 번 만지면 조용히 100 으로 커진다」가 됐다.
         ★현빈 결정 ㉠(T-075/T-078): 하한을 «패널에서도» 60 으로 낮춘다 ⇒ 이제 양쪽이 같은 수다
         (js/blocks/asset-width-limits.js 의 ASSET_W_MIN = 60, 패널·모서리핸들 공용).
         ⛔여기서 다시 클램프하지 마라 — 「보이던 폭 그대로」가 이 함수의 계약이고,
           하한은 «한 자리»(ASSET_W_MIN)에서만 정해진다.
         ⚠️«높이» 축은 아직 갈라져 있다 — 패널 높이 슬라이더 min 은 200 이라, 200 보다 낮은
           그림이 들어오면 prop-asset.js 의 적응형 H_MIN 이 «그 블록에서만» 눈금을 넓혀 준다
           (하한 자체는 안 낮춘다 — 현빈 결정의 범위가 «폭»이었기 때문). */
  const applyScratchWidth = (block) => {
    const want = Number(opts.width);
    if (!Number.isFinite(want) || want <= 0) return false;
    const host = block.parentElement;
    if (!host) return false;
    const hcs = window.getComputedStyle(host);
    const full = host.clientWidth
               - (parseFloat(hcs.paddingLeft) || 0)
               - (parseFloat(hcs.paddingRight) || 0);
    // 밖으로 비어져 나갈 수 있는 여유 = «그 블록이 실제로 든 상자»의 좌우 패딩(=padX)
    const padBox = block.closest('.section-merged-part') || block.closest('.section-inner');
    const padX = padBox ? (parseFloat(window.getComputedStyle(padBox).paddingLeft) || 0) : 0;
    const plan = planScratchWidth(want, full, padX);   // ★세 밴드 판정은 순수함수 한 곳에서만
    if (!plan) return false;
    const { width: w, over } = plan;
    /* ★폭의 «표현»이 내보내기를 가른다 (2026-09-20 통합 라운드, QA high — 780px 잘림)
         내보내기는 섹션을 복제하고 «클론의 폭만» 바꾼다
         (js/io/export-image.js prepareCloneForCapture: `clone.style.…width:' + w + 'px'`).
         그래서 폭이 상대값(calc(100%+…)/%)이면 따라 줄고, 절대 px 면 «안» 줄어든다.
       ⑴ 넘침 없는 밴드(over === 0) = 「보이던 폭 그대로」가 계약이다 ⇒ 절대 px 가 맞다.
          780 내보내기에서도 220px 그림은 220px 이다(패널로 폭을 정한 블록과 같은 규약).
       ⑵⑶ 넘치는 밴드(over > 0) = 뜻이 「좌우 패딩을 over 만큼씩 먹어 «상자 끝까지» 간다」이다.
          그 뜻을 절대 px 로 굳히면 780 내보내기에서 바깥 크기가 그대로라 좌우 40px 씩 잘렸다
          (실측: 860 밴드 40/40 · 830 밴드 25/25 — tests/dom/scratch-drop-export-width).
          ⇒ 레포 관용구와 «같은 벌»로 적는다 — prop-page.js applyPadXToSection·applyAssetFullBleed,
            block-factory.applyExcludePadX 가 전부 `calc(100% + 2·먹은량)` + 음수마진 세트다.
          860 화면에서 그려지는 폭은 한 픽셀도 안 바뀐다(100% = 콘텐츠폭 = w − 2·over). */
    block.style.width = over > 0 ? `calc(100% + ${over * 2}px)` : w + 'px';
    block.style.marginLeft  = over > 0 ? (-over) + 'px' : '';
    block.style.marginRight = over > 0 ? (-over) + 'px' : '';
    block.style.alignSelf = over > 0 ? 'center'
      : block.dataset.align === 'left' ? 'flex-start'
      : block.dataset.align === 'right' ? 'flex-end' : 'center';
    block.dataset.usePadx = over > 0 ? 'true' : 'false';
    return true;
  };

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
    applyScratchWidth(block);   // ★스크래치 표시폭(옵트인) — 반드시 applyAspectSync 앞
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
        /* ★insert 분기와 «같은 자리»에 같은 것을 건다. 이 분기를 빼먹으면 「섹션 안에
           떨어뜨리면 맞는데 캔버스 빈 곳에 떨어뜨리면 여전히 커지는」 반쪽 수정이 된다.
           ⚠️addAssetBlock() 이 applyExcludePadX(block-factory.js:847-860)로
             calc(100% + 2·padX) + 음수마진을 «이미» 박아 둔다 ⇒ 그 뒤에 와야 덮인다. */
        applyScratchWidth(ab);   // ★반드시 applyAspectSync 앞
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

export { previewScratchDropAt, commitScratchDropAt, clearScratchDropGuides, planScratchWidth };

// 비-모듈 패널(예: assets-panel.js)에서도 사용 가능하도록 window에 노출
window.previewScratchDropAt   = previewScratchDropAt;
window.commitScratchDropAt    = commitScratchDropAt;
window.clearScratchDropGuides = clearScratchDropGuides;
