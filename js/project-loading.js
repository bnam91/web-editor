// 무거운 프로젝트 로딩 인디케이터 (batch-4) — 캔버스 위 반투명 오버레이 + 스피너 + "불러오는 중…".
// 토스트/모달 공용 비주얼 언어(--ui-* 토큰, asset-spin keyframes) 재사용. 경량 프로젝트엔 호출부에서 표시 안 함.
let _overlayEl = null;

function _ensureOverlay() {
  if (_overlayEl && _overlayEl.isConnected) return _overlayEl;
  const host = document.getElementById('canvas-area') || document.body;
  const ov = document.createElement('div');
  ov.className = 'proj-loading-overlay';
  ov.id = 'proj-loading-overlay';
  ov.setAttribute('role', 'status');
  ov.setAttribute('aria-live', 'polite');
  ov.innerHTML = `<div class="proj-loading-box"><div class="proj-loading-spinner"></div><span class="proj-loading-text">불러오는 중…</span></div>`;
  host.appendChild(ov);
  _overlayEl = ov;
  return ov;
}

function showProjectLoadingOverlay() {
  const ov = _ensureOverlay();
  ov.classList.remove('hiding');   // 즉시 표시(페이드인 없음) — 동기 렌더 직전 1프레임에 확실히 페인트되게
}

function hideProjectLoadingOverlay() {
  // [b7] 정적 오버레이(index.html #proj-loading-overlay)도 닫을 수 있게 getElementById 폴백.
  const ov = _overlayEl || document.getElementById('proj-loading-overlay');
  if (!ov) return;
  ov.classList.add('hiding');      // 페이드아웃(CSS transition)
  setTimeout(() => { if (ov && ov.classList.contains('hiding')) { ov.remove(); if (_overlayEl === ov) _overlayEl = null; } }, 240);
}

window.showProjectLoadingOverlay = showProjectLoadingOverlay;
window.hideProjectLoadingOverlay = hideProjectLoadingOverlay;

/* ── 프로젝트 «열림 확정» 레지스트리 (2026-08-25) ───────────────────────────────
 * 왜 필요한가 — 실측(39MB 세이프본, open_project 응답을 t0 로):
 *     t0+87ms   open_project 가 ok 를 반환(loadFile 은 «문서 로드»까지만 기다린다)
 *     t0+782ms  URL(?project) · window.activeProjectId · document.readyState('complete')
 *               · window.addSection(함수 존재)  ← «넷 다 목적지 값». 그런데 캔버스는 비어 있다(섹션 0).
 *     t0+1,782ms 섹션 22개가 그제서야 DOM 에 붙는다(applyProjectData 완료).
 *   ⇒ 저 넷은 「어느 프로젝트인가」만 말하고 「편집 가능한가」는 «말하지 않는다».
 *      그 창(t0~t0+1.8s)에 들어온 편집은 곧 교체될 DOM 에 쓰이고 통째로 사라진다
 *      (에러 0·응답 ok — 그래서 호출자가 성공으로 믿는다).
 *
 * 진실을 말하는 유일한 신호 = «이 프로젝트의 데이터 적용이 끝났다»는 사실 그 자체다.
 * 그래서 로드를 «시작하는 쪽»(부트 initLoad / 탭 전환)이 begin() 으로 선언하고,
 * «끝내는 쪽»이 settle() 로 확정한다. 대기자는 그 확정만 본다.
 * ⛔setTimeout 고정 대기로 대체 금지 — 로드 시간은 프로젝트 크기에 비례(수십ms~수초)라
 *   임의 상수는 반드시 깨진다. 대기는 «확정 신호» 기준으로만.
 *
 * 공용 계약(중복 구현 방지):
 *   begin(projectId, source) -> seq   로드 시작 선언. 반환 토큰(seq)은 settle 에 되돌려준다.
 *   settle(seq, phase, detail)        'ready' | 'error' 확정. «지난» seq 는 무시(늦은 완료가 최신을 덮지 않음).
 *   get()                             현재 레코드 + urlProject/activeProjectId(대조용 원본값).
 *   isReady(projectId)                그 프로젝트가 «지금 편집 가능»한가
 *                                     (확정 + URL + 활성 + autosave 무장 4자 일치).
 *
 * ※U6(feature/collab-accept-flow)의 js/collab/accept.js open() 은 같은 함정을 «URL 확인 후
 *   start» 로 피해간다. 두 브랜치가 갈라져 있어 지금은 코드를 공유할 수 없지만, 합류하면
 *   그쪽 `cur() === projectId` 를 이 isReady(projectId) 로 바꾸는 게 정본이다(중복 구현 제거).
 */
const _plRec = {
  projectId: null,      // 이 로드가 «목표»로 한 프로젝트
  phase: 'idle',        // idle | loading | ready | error
  source: null,         // boot | tab | ...
  seq: 0,
  startedAt: 0,
  settledAt: 0,
  detail: '',
  sections: -1,
};

function beginProjectLoad(projectId, source) {
  _plRec.projectId = projectId || null;
  _plRec.phase = 'loading';
  _plRec.source = source || '';
  _plRec.seq += 1;
  _plRec.startedAt = Date.now();
  _plRec.settledAt = 0;
  _plRec.detail = '';
  _plRec.sections = -1;
  return _plRec.seq;
}

function settleProjectLoad(seq, phase, detail) {
  // 늦게 끝난 «지난» 로드가 최신 상태를 덮어쓰면 대기자에게 거짓말이 된다(BL-CDD-08 계열).
  if (seq !== _plRec.seq) return false;
  _plRec.phase = (phase === 'error') ? 'error' : 'ready';
  _plRec.settledAt = Date.now();
  _plRec.detail = detail || '';
  try { _plRec.sections = document.querySelectorAll('#canvas .section-block').length; }
  catch (_) { _plRec.sections = -1; }
  try { window.dispatchEvent(new CustomEvent('gdt:project-load-settled', { detail: getProjectLoadState() })); } catch (_) {}
  return true;
}

function getProjectLoadState() {
  let urlProject = null;
  try { urlProject = new URLSearchParams(location.search).get('project'); } catch (_) {}
  let active = null;
  try { active = window.activeProjectId || null; } catch (_) {}
  // ★autosave 무장 여부는 «지금» 읽는다(레코드에 굳히면 거짓말이 된다).
  //   applyProjectData 는 억제를 requestAnimationFrame 한 프레임 뒤에 푼다 — 39MB 는 적용 직후
  //   레이아웃이 밀려 그 프레임이 늦게 온다. 그 창에 들어온 편집은 MutationObserver 가 삼켜
  //   autosave 가 «예약조차» 안 된다(실측: 39MB 에서 build 후 120초 동안 디스크 0건,
  //   그 다음 mutation 하나가 들어오자마자 기록됨). 「적용됨」과 「저장이 살아있음」은 다른 사실이다.
  let armed = true;
  try { armed = !(window.state && window.state._suppressAutoSave); } catch (_) {}
  // ★docOrigin = 이 «문서»의 신원(performance.timeOrigin 은 문서마다 고유).
  //   대기자(main open_project)가 「내가 방금 시킨 navigate 의 문서인가」를 대조하는 데 쓴다.
  //   이게 없으면 «이전 문서에 남아 있던 ready» 를 보고 즉시 통과할 수 있다(거짓양성).
  let docOrigin = null;
  try { docOrigin = (performance && performance.timeOrigin) || null; } catch (_) {}
  return { ..._plRec, urlProject, activeProjectId: active, autosaveArmed: armed, docOrigin };
}

/** 「지금 이 프로젝트를 편집해도 되나」 — 확정·URL·활성·autosave 무장이 모두 참일 때만. */
function isProjectReady(projectId) {
  if (!projectId) return false;
  const s = getProjectLoadState();
  return s.phase === 'ready' && s.projectId === projectId
      && s.urlProject === projectId && s.activeProjectId === projectId
      && s.autosaveArmed === true;
}

window.gdtProjectReady = {
  begin: beginProjectLoad,
  settle: settleProjectLoad,
  get: getProjectLoadState,
  isReady: isProjectReady,
};
