/* quit-false-save-failure.dom.spec.js — QUIT-FALSE-SAVE-FAILURE-DIALOG-01 (0.9.10 · 현빈 7126)
 *   결함: 종료 때 앞 저장이 돌고 있으면 종료 저장이 줄에 서고, 렌더러는 «1초»만 기다렸다. 그 사이 종료 저장이 «시작은 했지만 안 끝나면»
 *     (줄에서 빠져 동기 flush 도 못 하고) 답 = unconfirmed → 메인이 «저장 실패» 창(6초 상한 · 체감 약 7초) — 그런데 쓰기는 곧 끝나 디스크는 최신(거짓 실패).
 *   장면: 저장 한 번 1.5초 · 비동기 쓰기가 도는 동안 동기 쓰기(종료 flush)는 못 들어감(busy) — 이때 옛 1초 판정은 «실패»를 답했고 쓰기는 곧 끝났다.
 *   Q1 저장 한 번 1.5초 · 종료를 앞 저장 시작 1초 뒤에 ⇒ 답 ok · 파일 = 종료 때 내용(최신) · 렌더러 답이 메인 상한(3초) 안
 *   Q2 [음성] 같은 장면에서 종료 저장이 거절(ok:false) ⇒ 답 실패(창 뜸) · 사유 그대로 · 비상 사본(snapshot) 실림 · 디스크엔 안 들어감
 *   Q3 [음성] 종료 저장이 상한(2.5초) 안에 안 끝나면(4초) ⇒ 답 실패(unconfirmed) — 시간 초과는 여전히 창
 * ★양성대조: save-load.js 의 기다림 상한을 옛 1초로 되돌리면 Q1 빨강(답 unconfirmed). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const P = 'proj_quit1';

async function setup(page, { delayMs, rejectQuit = false }) {
  await page.addInitScript(() => {
    const fake = { onForceSaveBeforeQuit: (f) => { window.__quit = f; }, quitReady: (r) => { window.__answer = r; window.__answerAt = performance.now(); } };
    window.__fake = fake;
    Object.defineProperty(window, 'electronAPI', { configurable: true, get: () => new Proxy(fake, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) }), set: () => {} });
  });
  const errs = await bootApp(page);
  await page.evaluate(([P, delayMs, rejectQuit]) => {
    const project = { ...window.buildEmptyProject(P, P), id: P, name: P, version: 2, currentPageId: 'page_1',
      pages: [{ id: 'page_1', name: 'P1', pageSettings: {}, canvas: `<div class="section-block" id="sec_q"><div class="section-inner"></div></div>` }] };
    window.__file = JSON.parse(JSON.stringify(project)); window.__saves = [];
    Object.assign(window.__fake, {
      loadProject: async () => JSON.parse(JSON.stringify(window.__file)),
      saveProject: async (p) => {
        const n = window.__saves.length; window.__saves.push({ at: performance.now(), done: null });
        window.__writing = (window.__writing || 0) + 1;
        try { await new Promise(r => setTimeout(r, window.__delayFor?.(n) ?? delayMs)); } finally { window.__writing--; }
        if (window.__rejectQuit && window.__quitStarted && n > 0) { window.__saves[n].done = 'rejected'; return { ok: false, reason: 'write-failed', error: 'EACCES: permission denied' }; }
        window.__file = JSON.parse(JSON.stringify(p)); window.__saves[n].done = performance.now(); return { ok: true };
      },
      /* 같은 프로젝트에 비동기 쓰기가 도는 동안 동기 쓰기는 못 들어간다고 둔다 — 그때 «1초 판정»이 실패를 답하고 쓰기는 곧 끝나 디스크는 최신(거짓 실패의 꼴) */
      saveProjectSync: (p) => { if (window.__writing > 0) return { ok: false, reason: 'busy' }; window.__file = JSON.parse(JSON.stringify(p)); return { ok: true }; },
    });
    window.__rejectQuit = rejectQuit;
    window.openTabs = [{ id: P, name: P, _cache: JSON.stringify(project) }];
    window.activeProjectId = P;
    history.replaceState(null, '', '?project=' + P);
    window.applyProjectData(JSON.parse(JSON.stringify(project)));
  }, [P, delayMs, rejectQuit]);
  await page.waitForFunction(() => !window.hasUnsavedChanges?.());
  return errs;
}
/** 편집 A → 자동저장 시작(진행 중) → 1초 뒤 편집 B + 종료. 답을 기다린다. */
async function scenario(page) {
  return page.evaluate(async () => {
    window.selectSection(document.getElementById('sec_q')); window.addTextBlock('h2', { content: 'EDIT_A' });
    const auto = window.saveProjectToFile(JSON.parse(window.serializeProject()), { skipThumbnail: true });   // 앞 저장(1.5초)
    await new Promise(r => setTimeout(r, 1000));
    window.addTextBlock('h2', { content: 'EDIT_B' });
    window.__quitStarted = true; const t0 = performance.now();
    window.__quit();
    await new Promise(r => { const iv = setInterval(() => { if (window.__answer) { clearInterval(iv); r(); } }, 20); });
    const answerMs = window.__answerAt - t0;
    await auto; await new Promise(r => setTimeout(r, 5000));   // 늦게 끝나는 쓰기까지 다 들어간 «디스크»
    const a = window.__answer;
    return { ok: a.ok, reason: a.reason, error: a.error || null, hasSnap: !!a.snapshot, answerMs, fileHasB: JSON.stringify(window.__file).includes('EDIT_B'), saves: window.__saves.length };
  });
}

test('Q1 저장 1.5초 · 종료가 앞 저장 중 — 답 ok(창 없음) · 파일 최신 · 메인 상한 3초 안', async ({ page }) => {
  test.setTimeout(60000);
  await setup(page, { delayMs: 1500 });
  const r = await scenario(page);
  expect(r.fileHasB, '[전제] 디스크는 결국 최신(종료 때 내용)').toBe(true);
  expect({ ok: r.ok, reason: r.reason }, '거짓 실패 없음').toEqual({ ok: true, reason: 'saved' });
  expect(r.answerMs, '렌더러 답이 메인 saveWaitMs(3000) 안').toBeLessThan(2900);
});

test('Q2 [음성] 종료 저장 거절(EACCES) — 답 실패 · 사유 · 비상 사본', async ({ page }) => {
  test.setTimeout(60000);
  await setup(page, { delayMs: 1500, rejectQuit: true });
  const r = await scenario(page);
  expect(r.ok, '진짜 실패는 실패로 답한다(창 뜸)').toBe(false);
  expect(r.reason).toBe('write-failed');
  expect(r.fileHasB, '거절됐으니 디스크엔 안 들어갔다(그래서 창이 맞다)').toBe(false);   // ⚠️거절 저장은 사유만 싣고 오류 글자는 안 싣는다(save-load.js 거절 갈래 — 기존 동작)
  expect(r.hasSnap, '비상 사본 원문이 실린다').toBe(true);
});

test('Q3 [음성] 종료 저장이 상한 안에 안 끝남(4초) — 답 실패(unconfirmed)', async ({ page }) => {
  test.setTimeout(60000);
  await setup(page, { delayMs: 1500 });
  await page.evaluate(() => { window.__delayFor = (n) => (n === 0 ? 1500 : 4000); });
  const r = await scenario(page);
  expect({ ok: r.ok, reason: r.reason }).toEqual({ ok: false, reason: 'unconfirmed' });
  expect(r.answerMs).toBeLessThan(2900);
});
