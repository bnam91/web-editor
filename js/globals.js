/* ═══════════════════════════════════
   SHARED STATE — loaded first
═══════════════════════════════════ */
export const propPanel   = document.querySelector('#panel-right .panel-body');
export const canvasEl    = document.getElementById('canvas');
export const canvasWrap  = document.getElementById('canvas-wrap');

/* ── Multi-page state ── */
export const PAGE_LABELS = ['', 'Hook', 'Main', 'Detail', 'CTA', 'Event'];

export const state = {
  // padX 32 = 레거시 폴백(저장본에 padX 키가 없는 구 프로젝트 보존용). 신규 프로젝트 기본값은 72 — tab-system.js/projects.html 생성 리터럴 참조.
  pageSettings: { bg: '#828282', bgAlpha: 100, gap: 100, padX: 32, padY: 0, padXExcludesAsset: true },
  pages: [{ id: 'page_1', name: 'Page 1', label: '', pageSettings: { bg: '#828282', bgAlpha: 100, gap: 100, padX: 32, padY: 0, padXExcludesAsset: true }, canvas: '' }],
  currentPageId: 'page_1',
  // AI 이미지 갤러리 — 프로젝트 전역 자산 (페이지 전환 무관)
  imageGallery: [],
  // Assets 트리 — 폴더/이미지/URL 노드 (프로젝트 전역 자산)
  assetsTree: [],
  _suppressAutoSave: false,
  // lazy 렌더 패스(뷰포트 밖 배경 언로드/복원) 진행 표식 — «그 패스가 만지는 속성만»
  // autosave dirty 판정에서 제외하려고 쓴다(전면 억제가 남의 편집까지 삼키던 문제 해소).
  _lazyRenderPass: false,
};
window.state = state;

/* ── ★협업 임시 킬스위치 ──────────────────────────────────────────────
 * false면 협업 진입(autoStart·start·환경설정 협업 탭·초대 폴링)이 «전부» 막힌다.
 * 사유: C8(협업 undo가 상대 작업 재전파로 영구삭제) 미수정 — 정통 수정은
 *   feat/collab-undo-op 브랜치. 그 완성·머지 전까지 배포용으로 협업을 «안 켠다».
 * ★되돌리기 = true 하나. (collabRef 포함 proj_meta 전수 스캔 0 → 데이터 영향 없음)
 * ★true로 두면 아래 진입점 가드가 전부 통과해 기존 협업 동작이 그대로 복원된다. */
export const COLLAB_ENABLED = true;
window.COLLAB_ENABLED = COLLAB_ENABLED;

/** ★킬스위치: 마켓(템플릿 공유) — 이번 런칭에는 «아직» 안 낸다(현빈 2026-08-28).
 * false면 환경설정 「마켓」 탭·패인이 «그려지지 않고», 지연로드(renderMarketPane)도 안 돈다.
 * 진입점 전수 확인: 마켓으로 들어가는 문은 환경설정 탭 «하나뿐»이라 이걸로 기능 전체가 닫힌다
 *   (js/market.js 의 함수들은 renderMarketPane 을 통해서만 호출된다).
 * ★되돌리기 = true 하나. 코드는 그대로 두었으니 다음 런칭에 한 글자로 켠다.
 * ⚠️이미 마켓으로 받은 로컬 프로젝트는 그대로 남는다 — 데이터는 안 건드린다. */
export const MARKET_ENABLED = false;
window.MARKET_ENABLED = MARKET_ENABLED;
