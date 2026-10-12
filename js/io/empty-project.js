/* ═══════════════════════════════════════════════════════════════════════════
   io/empty-project.js — «빈 프로젝트» 한 벌의 모양 · 단일 원본 (고전 스크립트).
   ───────────────────────────────────────────────────────────────────────────
   ★왜 여기로 올렸나 (2026-10-06 · 지디 발주 SIX ① — 프로젝트 0개인 사람이 «목록 화면»에서 초대를 수락):
     모양이 두 벌이었다 — js/tab-system.js buildEmptyProject(편집기 모듈) · pages/projects.html createProject 안쪽 사본.
     초대 수락(js/collab/accept.js)은 window.buildEmptyProject 를 쓰는데 목록 화면은 tab-system 을 안 실어 «공장이 없다» 였다
     (no_project_factory). ⇒ 두 화면이 «다» 맨 앞에서 읽는 고전 스크립트로 올리고, 두 생성 경로가 이걸 부른다.
   ⚠️배경색은 window.PAGE_BG_DEFAULT(js/feature-flags.js) — 이 파일보다 «먼저» 실려야 한다. 회귀: tests/unit/page-bg-default.test.mjs.
═══════════════════════════════════════════════════════════════════════════ */
(function (w) {
  function buildEmptyProject(id, name) {
    const now = new Date().toISOString();
    const emptySnap = JSON.stringify({
      version: 2, currentPageId: 'page_1',
      pages: [{ id: 'page_1', name: 'Page 1', label: '', pageSettings: { bg: window.PAGE_BG_DEFAULT, gap: 100, padX: 72, padY: 32, padXExcludesAsset: true }, canvas: '' }]
    });
    const proj = {
      id, name: name || 'Untitled',
      createdAt: now, updatedAt: now,
      version: 2,
      currentPageId: 'page_1',
      pages: [{ id: 'page_1', name: 'Page 1', label: '', pageSettings: { bg: window.PAGE_BG_DEFAULT, gap: 100, padX: 72, padY: 32, padXExcludesAsset: true }, canvas: '' }],
      currentBranch: 'dev',
      branches: {
        main: { snapshot: emptySnap, createdAt: Date.now(), updatedAt: Date.now() },
        dev:  { snapshot: emptySnap, createdAt: Date.now(), updatedAt: Date.now() }
      }
    };
    return proj;
  }
  w.buildEmptyProject = buildEmptyProject;   // 편집기 탭(tab-system.js) · 목록(projects.html createProject) · 초대 수락(collab/accept.js) 셋이 같이 쓴다
})(window);
