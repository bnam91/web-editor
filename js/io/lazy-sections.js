import { canvasEl, state } from '../globals.js';

/* ══════════════════════════════════════════════════════════════════════
   VIEWPORT VIRTUALIZATION (lazy render)
   ──────────────────────────────────────────────────────────────────────
   대형 프로젝트(~91 section-block)에서 화면 밖 섹션의 이미지를 언로드해
   메모리/렌더 비용을 줄인다.

   ★ 직렬화 안전성(serialization-safety) 계약 ★
   getSerializedCanvas(save-load.js)는 라이브 DOM을 cloneNode한다. 직렬화의
   "진실 소스"는 data-* 속성(data-bg-img / data-img-src) + <img>의 src 속성이다.
   본 모듈은 *렌더링 레이어*의 인라인 배경(element.style.backgroundImage)만 건드린다:
   언로드 시 그것만 비우고, 복원용 원본 값은 data-lazy-bg에 별도 보관한다.
   data-bg-img / data-img-src 같은 직렬화 진실 소스는 절대 건드리지 않는다.
   → 가장 안전한 구현: img src 속성은 절대 건드리지 않고, background-image 인라인
     스타일만 언로드/복원한다(배경 이미지가 메모리 대부분을 차지). <img> src는
     건드리지 않아 직렬화/표시 모두 항상 정확.
   옛 계획(버렸다): <img>도 src를 백업하고 placeholder로 바꿔 언로드 — 직렬화가 그 속성을 그대로 박는다.
══════════════════════════════════════════════════════════════════════════ */

let _io = null;            // 단일 IntersectionObserver
const _observed = new WeakSet(); // 이미 관찰 중인 section-block 추적

function _ioSupported() {
  return typeof IntersectionObserver === 'function';
}

/* 자동저장 «표식» 래퍼 — 언로드/복원의 DOM 변경이 MutationObserver→autosave를
   유발하지 않도록 한다. 기존 표식 상태를 보존했다가 복구(중첩 안전).
   ★2026-08-25 변경: 예전엔 state._suppressAutoSave 를 통째로 켰다. 그런데 이 창은
     «남의 편집»까지 삼킨다 — 억제 중에 들어온 변경은 scheduleAutoSave 가 조용히 버리고
     그 뒤 아무도 다시 예약하지 않는다(실측: 39MB 프로젝트에서 lazy 패스와 겹친 MCP
     build_basic_section 이 DOM 에는 있는데 «저장 예약조차» 안 돼 120초 동안 디스크 0건).
     IntersectionObserver 는 스크롤·레이아웃·이미지 로드마다 수시로 도는데, 그 창이
     전면 억제라면 「언제 편집해도 안전」이 성립하지 않는다.
   ⇒ 이제는 «내 mutation 만» 무시하게 표식(_lazyRenderPass)만 세우고, 실제 필터는
     save-load.js 의 autoSaveObserver 가 «lazy 가 만지는 속성»(style/data-lazy-bg/class)에
     한정해 적용한다. childList(=섹션/블록 추가) 같은 진짜 편집은 그대로 통과한다. */
function _withSuppressAutoSave(fn) {
  const prev = state._lazyRenderPass;
  state._lazyRenderPass = true;
  try {
    fn();
  } finally {
    // 이전 값이 true였으면(중첩) 그대로 두고, 아니면 한 프레임 뒤 해제.
    if (prev !== true) {
      // MutationObserver는 microtask 후 발화 — 잔여 mutation까지 흡수 후 해제
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => { state._lazyRenderPass = prev; });
      } else {
        state._lazyRenderPass = prev;
      }
    }
  }
}

/* 섹션 1개의 배경 이미지 요소들을 언로드 — 인라인 background-image만 비운다.
   data-* 진실 소스는 손대지 않는다. */
function _unloadSection(sec) {
  if (!sec || sec.classList.contains('lazy-unloaded')) return;
  // 배경 이미지가 인라인 스타일에 걸린 모든 요소(섹션 자신 포함)
  const els = [sec, ...sec.querySelectorAll('*')];
  for (const el of els) {
    if (!el.style) continue;
    const bg = el.style.backgroundImage;
    /* ★149 — 줄임(background:#e65004)의 색 전용은 image 가 'initial' 로 읽힌다. 이미지가 아닌데 내리면 style 이 CSSOM 꼴로 다시 쓰여 저장 바이트가 움직인다.
       shortcut: 줄임에 든 진짜 url·그라데이션은 여전히 CSSOM 꼴로 바뀐다, 그것까지 막으려면 style 원문을 보관하는 쪽으로 바꿔라. */
    if (bg && bg !== 'none' && bg !== 'initial' && !el.hasAttribute('data-lazy-bg')) {
      el.setAttribute('data-lazy-bg', bg);
      el.style.backgroundImage = 'none';
    }
  }
  sec.classList.add('lazy-unloaded');
}

/* 섹션 1개 복원 — data-lazy-bg에 보관한 원본 배경을 인라인 스타일로 되돌린다. */
function _restoreSection(sec) {
  if (!sec) return;
  const els = [sec, ...sec.querySelectorAll('[data-lazy-bg]')];
  for (const el of els) {
    if (el.hasAttribute && el.hasAttribute('data-lazy-bg')) {
      el.style.backgroundImage = el.getAttribute('data-lazy-bg');
      el.removeAttribute('data-lazy-bg');
    }
  }
  sec.classList.remove('lazy-unloaded');
}

function _onIntersect(entries) {
  _withSuppressAutoSave(() => {
    for (const entry of entries) {
      const sec = entry.target;
      if (entry.isIntersecting) _restoreSection(sec);
      else _unloadSection(sec);
    }
  });
}

/* ── public API ── */

function initLazySections() {
  if (!_ioSupported()) return;        // 미지원 환경: no-op (전 섹션 로드 유지)
  if (_io) return;                    // 이미 초기화됨 (idempotent)
  _io = new IntersectionObserver(_onIntersect, {
    root: null,
    rootMargin: '800px 0px',
    threshold: 0,
  });
  refreshLazyObservation();
}

function observeSection(sectionEl) {
  if (!_io || !sectionEl || _observed.has(sectionEl)) return;
  if (!sectionEl.classList || !sectionEl.classList.contains('section-block')) return;
  _observed.add(sectionEl);
  _io.observe(sectionEl);
}

function unobserveSection(sectionEl) {
  if (!sectionEl) return;
  if (_io) _io.unobserve(sectionEl);
  _observed.delete(sectionEl);
  // 관찰 해제 시 혹시 언로드 상태였다면 복원해 둔다(분리 후 재사용 안전)
  if (sectionEl.classList && sectionEl.classList.contains('lazy-unloaded')) {
    _withSuppressAutoSave(() => _restoreSection(sectionEl));
  }
}

/* canvasEl을 재스캔해 아직 관찰하지 않은 section-block을 모두 등록한다.
   페이지 로드/페이지 전환/innerHTML 교체 후 호출. */
function refreshLazyObservation() {
  if (!_io || !canvasEl) return;
  canvasEl.querySelectorAll('.section-block').forEach(observeSection);
}

/* 언로드된 모든 섹션을 동기 복원 — export/thumbnail/figma 전에 호출해
   라이브 렌더 스타일에 모든 이미지가 존재하도록 보장한다. 멱등. */
function materializeAllSections() {
  if (!canvasEl) return;
  const unloaded = canvasEl.querySelectorAll('.section-block.lazy-unloaded, [data-lazy-bg]');
  if (!unloaded.length) return; // 아무것도 언로드 안 됐으면 no-op
  _withSuppressAutoSave(() => {
    // section 단위로 복원(섹션 내부 자식 data-lazy-bg까지 한 번에 처리)
    canvasEl.querySelectorAll('.section-block.lazy-unloaded').forEach(_restoreSection);
    // 섹션 밖(혹시 모를) 잔여 data-lazy-bg도 복원
    canvasEl.querySelectorAll('[data-lazy-bg]').forEach(el => {
      el.style.backgroundImage = el.getAttribute('data-lazy-bg');
      el.removeAttribute('data-lazy-bg');
    });
  });
}

/* window 노출 */
if (typeof window !== 'undefined') {
  window.initLazySections = initLazySections;
  window.materializeAllSections = materializeAllSections;
  window.refreshLazyObservation = refreshLazyObservation;
  window.observeSection = observeSection;
  window.unobserveSection = unobserveSection;
}

export {
  initLazySections,
  materializeAllSections,
  refreshLazyObservation,
  observeSection,
  unobserveSection,
};
