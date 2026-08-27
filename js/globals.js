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
