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

/* ── ★협업 임시 킬스위치 — 정본은 js/feature-flags.js 하나다 ────────────
 * ⛔여기에 값을 «다시 쓰지» 마라. globals.js 는 에디터 화면(index.html)의 모듈이라
 *   프로젝트 목록 화면(pages/projects.html)이 안 읽는다 — 여기에 값을 두면
 *   목록 화면의 👥 버튼이 스위치를 «안 본다»(2026-09-02 실제 사고).
 * 여기서는 그 값을 «읽어서» 모듈 쪽 이름으로만 다시 내보낸다.
 * ★플래그 파일이 안 걸린 화면에서는 undefined → false(닫힘)로 떨어진다 — 안전한 쪽. */
export const COLLAB_ENABLED = (typeof window !== 'undefined' && window.COLLAB_ENABLED === true);

/** ★킬스위치: 마켓(템플릿 공유) — 이번 런칭에는 «아직» 안 낸다(현빈 2026-08-28).
 * false면 환경설정 「마켓」 탭·패인이 «그려지지 않고», 지연로드(renderMarketPane)도 안 돈다.
 * 진입점 전수 확인: 마켓으로 들어가는 문은 환경설정 탭 «하나뿐»이라 이걸로 기능 전체가 닫힌다
 *   (js/market.js 의 함수들은 renderMarketPane 을 통해서만 호출된다).
 * ★되돌리기 = true 하나. 코드는 그대로 두었으니 다음 런칭에 한 글자로 켠다.
 * ⚠️이미 마켓으로 받은 로컬 프로젝트는 그대로 남는다 — 데이터는 안 건드린다. */
export const MARKET_ENABLED = false;
window.MARKET_ENABLED = MARKET_ENABLED;

/** ★킬스위치: Figma 연동 — 이번 MVP 에서 «제외»한다(현빈 2026-08-28).
 * false 면 아래가 «그려지지 않고», 브릿지 상태 조회·기동도 안 돈다:
 *   ⒜ Export 드롭다운의 Figma Bridge · Figma 업로드 · Figma 가져오기
 *   ⒝ Plugins 패널의 Figma Upload · Figma Import  (★Iconify 는 Figma 무관이라 «남긴다»)
 * ★메뉴만 감추고 뒤에서 도는 게 최악이라, 드롭다운 열 때 도는 initFigmaBridge 도 막는다.
 * ★되돌리기 = true 하나. 코드는 그대로 두었으니 다음 런칭에 한 글자로 켠다. */
export const FIGMA_ENABLED = false;
window.FIGMA_ENABLED = FIGMA_ENABLED;

/** ★킬스위치: 애니메이션 GIF 만들기 — 이번 MVP 에서 제외(현빈 2026-08-28).
 * Figma 와 «별개 스위치»다 — 서로 다른 결정을 한 플래그에 묶으면
 * 나중에 Figma 를 켤 때 GIF 도 같이 살아난다. 되돌리기 = true 하나. */
export const ANIM_GIF_ENABLED = false;
window.ANIM_GIF_ENABLED = ANIM_GIF_ENABLED;
