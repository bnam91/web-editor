import { canvasEl, state } from '../globals.js';

/* ══════════════════════════════════════════════════════════════════════
   VIEWPORT VIRTUALIZATION (lazy render)
   ──────────────────────────────────────────────────────────────────────
   대형 프로젝트(~91 section-block)에서 화면 밖 섹션의 이미지를 언로드해
   메모리/렌더 비용을 줄인다.

   ★ 직렬화 안전성(serialization-safety) 계약 ★
   getSerializedCanvas(save-load.js)는 라이브 DOM을 cloneNode한다. 직렬화의
   "진실 소스"는 data-* 속성(data-bg-img / data-img-src) + <img>의 src 속성이다.
   본 모듈은 *렌더링 레이어*만 건드린다:
     - element.style.backgroundImage  (인라인 배경)
     - <img>.src                       (속성이 아니라 라이브 src 프로퍼티)
   언로드 시 위 둘만 비우고, 복원용 원본 값은 data-lazy-bg / data-lazy-src에
   별도 보관한다. data-bg-img / data-img-src / (저장 HTML에 들어가는 img src
   속성) 같은 직렬화 진실 소스는 절대 건드리지 않는다.

   NOTE: <img>의 경우 setAttribute('src')는 직렬화 HTML에 박히므로,
   언로드는 src '속성'은 그대로 두고 라이브 src를 1x1 placeholder로 덮어쓴다.
   하지만 clone.innerHTML은 '속성'을 직렬화하므로, 속성을 건드리지 않기 위해
   여기서는 img.src 프로퍼티(=속성 동기화) 대신, 원본 src를 data-lazy-src에
   백업한 뒤 src 속성을 placeholder로 교체하고 복원 시 되돌린다. 단 직렬화는
   언로드 상태에서도 정확해야 하므로, img는 data-img-src(있으면)를 진실 소스로
   쓰는 블록만 안전하게 언로드하고, 그렇지 않은 img는 언로드 대상에서 제외한다.
   → 가장 안전한 구현: img src 속성은 절대 건드리지 않고, background-image 인라인
     스타일만 언로드/복원한다(배경 이미지가 메모리 대부분을 차지). <img> src는
     건드리지 않아 직렬화/표시 모두 항상 정확.
══════════════════════════════════════════════════════════════════════════ */

let _io = null;            // 단일 IntersectionObserver
const _observed = new WeakSet(); // 이미 관찰 중인 section-block 추적

function _ioSupported() {
  return typeof IntersectionObserver === 'function';
}

/* 자동저장 억제 래퍼 — 언로드/복원의 DOM 변경이 MutationObserver→autosave를
   유발하지 않도록 한다. 기존 억제 상태를 보존했다가 복구(중첩 안전). */
function _withSuppressAutoSave(fn) {
  const prev = state._suppressAutoSave;
  state._suppressAutoSave = true;
  try {
    fn();
  } finally {
    // 이전 값이 false였을 때만 해제(상위에서 억제 중이면 그대로 유지)
    if (prev !== true) {
      // MutationObserver는 microtask 후 발화 — 잔여 mutation까지 흡수 후 해제
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => { state._suppressAutoSave = prev; });
      } else {
        state._suppressAutoSave = prev;
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
    if (bg && bg !== 'none' && !el.hasAttribute('data-lazy-bg')) {
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
