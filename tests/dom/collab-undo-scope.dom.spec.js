/* collab-undo-scope — ★C8(협업 undo 가 상대 작업을 되돌려 재전파 → 영구삭제)을 «CI 가 보는 자리»(test:dom)에서 잠근다.
 *
 * ★왜 있나 (2026-10-06, 지디 발주 TWO ⑵)
 *   C8 고침(1ec78f0a · 2026-08-16)을 잠근 검사는 tests/e2e/10-collab-undo-diff.spec.js 하나였고, 그건
 *   «순수 유틸»(history-diff.js)만 본다. 실측: 가드(sync.js:278 — 보류 패치는 remote-applied 를 안 쏜다)를
 *   무력화(M1)해도, 배선(history.js _scopedEnabled)을 끊어도(M2) 10/10 초록. 게다가 CI 는 e2e 를 안 돈다.
 *   ⇒ 진짜 index.html(bootApp) 에서 sync.js·history.js·history-diff.js 를 «실물로» 돌려 두 축을 잰다.
 *   (옛 e2e 는 지우지 않는다 — 그날까지 옛 계약이 참이었다는 기록이다.)
 *
 * ★M2 축의 전제: _useScoped 는 collabSync.isActive() 를 본다. 검사 페이지 «안에서만» isActive 를 true 로 바꿔 끼운다
 *   (지디 판정 ⑥ 2026-10-06: COLLAB_ENABLED «값» 무변경 · 앱·서버·포트 0 · 제품 코드에 테스트용 구멍 0).
 *   그리고 전제를 단언한다 — isActive() 가 실제로 true · scopedCalls 가 실제로 1 늘었다(안 하면 «안 재고도 초록»).
 * 합격 기준(지디): 원본 초록 · M1 빨강 · M2 빨강 · M3 빨강 — 각 ×3 (보고 = 판 sha 를 붙인 표).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = (id, text) => `<div class="section-block" id="${id}"><div class="section-inner"><div class="text-block" id="${id}_t"><div class="tb-body">${text}</div></div></div></div>`;

test('U0 전제 — 실물 모듈이 실렸다(sync.js · history.js · history-diff.js)', async ({ page }) => {
  const errs = await bootApp(page);
  const r = await page.evaluate(() => ({
    applyPatch: typeof window.collabSync?._internals?.applyPatch,
    undo: typeof window.undo, push: typeof window.pushHistory,
    diff: typeof window.historyDiff?.diffSnapshots, stats: typeof window._collabScopedUndoStats,
    flag: window.COLLAB_ENABLED,
  }));
  expect(r).toEqual({ applyPatch: 'function', undo: 'function', push: 'function', diff: 'function', stats: 'object', flag: false });
  expect(errs).toEqual([]);
});

test('U1 ★M1 축 — 사용자가 만지는 섹션에 온 원격 패치는 «보류»되고 remote-applied 를 쏘지 않는다', async ({ page }) => {
  await bootApp(page);
  const r = await page.evaluate(({ a, b, bRemote }) => {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = a + b;
    document.querySelector('#secB_t').classList.add('selected');          // 「만지는 중」(isUserBusyIn)
    let fired = 0;
    window.addEventListener('gd:collab-remote-applied', () => { fired++; });
    const applied = window.collabSync._internals.applyPatch({
      pageId: window.state.currentPageId, sectionId: 'secB', html: bRemote, hash: 'h_remote', actorId: 'zz99',
    });
    return { applied, fired, bText: document.querySelector('#secB_t').textContent, busy: window.collabSync._internals.isUserBusyIn(document.getElementById('secB')) };
  }, { a: SEC('secA', 'A0'), b: SEC('secB', 'B0'), bRemote: SEC('secB', 'B-REMOTE') });
  expect(r.busy, '★전제: secB 가 «만지는 중»으로 판정됐다').toBe(true);
  expect(r.applied, '★전제: 패치가 보류됐다(applyPatch=false)').toBe(false);
  expect(r.bText, '★전제: 화면은 아직 옛 내용').toBe('B0');
  expect(r.fired, '보류된 패치가 remote-applied 를 쐈다 — 히스토리 remoteKeys 오염(C8 재발 경로, sync.js:278)').toBe(0);
});

test('U2 ★M2 축 — 원격분이 낀 스텝을 ⌘Z 해도 «상대 섹션»은 안 되돌리고 «내 섹션»만 되돌린다', async ({ page }) => {
  await bootApp(page);
  const r = await page.evaluate(({ a0, b0, bRemote }) => {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = a0 + b0;
    window.clearHistory();
    const real = window.collabSync;
    window.collabSync = Object.assign({}, real, { isActive: () => true });  // ★검사 페이지 안에서만
    const t = (id) => document.querySelector(`#${id}_t .tb-body`).textContent;
    document.querySelector('#secA_t .tb-body').textContent = 'A1'; window.pushHistory('A1');
    const applied = real._internals.applyPatch({ pageId: window.state.currentPageId, sectionId: 'secB', html: bRemote, hash: 'h_remote', actorId: 'zz99' });
    document.querySelector('#secA_t .tb-body').textContent = 'A2'; window.pushHistory('A2');
    const before = { ...window._collabScopedUndoStats };
    window.undo();
    const after = { ...window._collabScopedUndoStats };
    return { active: window.collabSync.isActive(), applied, a: t('secA'), b: t('secB'),
             scoped: after.scopedCalls - before.scopedCalls, full: after.fullCalls - before.fullCalls };
  }, { a0: SEC('secA', 'A0'), b0: SEC('secB', 'B0'), bRemote: SEC('secB', 'B-REMOTE') });
  expect(r.active, '★전제: isActive() 가 true(협업 중)').toBe(true);
  expect(r.applied, '★전제: 원격 패치가 실제로 붙었다').toBe(true);
  expect(r.b, '★주 단언: ⌘Z 가 상대(원격) 섹션을 되돌렸다 — C8(되돌린 구버전이 재전파돼 상대 작업 삭제)').toBe('B-REMOTE');
  expect(r.a, '내 섹션은 한 걸음 되돌아간다(스코프가 «상대만» 뺀다)').toBe('A1');
  expect(r.scoped, '★전제: 스코프 undo 길을 탔다(_collabScopedUndoStats.scopedCalls +1)').toBe(1);
  expect(r.full).toBe(0);
});
