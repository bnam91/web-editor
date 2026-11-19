/* scratch-x-flush-now — SCRATCH-X-THEN-CRASH-WITHIN-SAVE-WINDOW-01: 스크래치 ✕·⌘Z·⌘⇧Z 뒤 «파일» 매니페스트가 1.5초 자동저장을 안 기다리고 바로 맞는다
 *   결함(원문 ×3 · J214 K판): ✕ 는 IndexedDB 만 바로 쓰고 proj.json pages[].scratchpad 는 1.5초 미룬 자동저장 때 갈렸다 ⇒ 그 창 안 비정상 종료면
 *     파일에 지운 장이 남아 IndexedDB 없는 곳(다른 맥)에서 매니페스트로 되살아났다.
 *   자: 가짜 electronAPI.saveProject 가 받은 proj(= 디스크) 의 pages[0].scratchpad. «1초 안»(자동저장 1.5초보다 짧게) 맞는지 잰다.
 *   X1 ✕ → 1초 안 파일에 그 장 없음 · X2 ⌘Z → 1초 안 다시 있음 · X3 ⌘⇧Z → 1초 안 다시 없음 · X4 연달아 ✕ 5번 → 저장 수 기록 + 끝 파일 = 0장
 *   (적대 리뷰 1) X5 ✕ 와 같은 틱에 탭 B 로 — A 파일에서 그 장이 빠지고 B 파일엔 A 내용이 안 들어간다 · X6 저장이 실패하면 미저장이 남아 다시 건다
 *   (리뷰 2) X7 손짓 미룸(deferAutoSave) 중 ✕ → 바로 저장 0 · 손을 떼면(resumeAutoSave) 파일에서 빠진다 · 양성대조: 미룸 확인을 빼면 X7 빨강
 *   양성대조(리뷰 1): 예약을 먼저 거는 줄·탭 확인 줄을 빼면 X5 빨강 · X6 빨강
 * 양성대조: js/scratch-pad.js 를 기준판(5cebeb139)으로 되돌리면 X1·X2·X3 빨강(1.5초 미룬 저장). */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const A = 'proj_xc';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const settle = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
/* 파일이 맞을 때까지 잰 시간(ms) — «1초 안» 단언은 잰 값으로 한다(자동저장 1.5초보다 짧게). poll 의 timeout 을 1초로 조이면 술어 대기까지 그 안에 넣어 흔들렸다(인텔 2/3) */
const until = async (page, want) => { const t0 = Date.now(); await expect.poll(() => onDisk(page), { timeout: 6000, intervals: [25] }).toEqual(want); return Date.now() - t0; };

async function setup(page, n = 1, { tabB = false } = {}) {
  await page.addInitScript(() => {
    let k = 0;
    const fake = { onForceSaveBeforeQuit: () => {}, quitReady: () => {},
      assetsSaveCanvasImage: async ({ projectId, mime }) => ({ ok: true, url: `goya-asset://${projectId}/h${++k}.${(mime || 'image/png').split('/')[1]}` }) };
    window.__fake = fake;
    Object.defineProperty(window, 'electronAPI', { configurable: true, get: () => new Proxy(fake, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) }), set: () => {} });
  });
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async ([A, PNG, n, tabB]) => {
    const project = { ...window.buildEmptyProject(A, A), id: A, name: A, version: 2, currentPageId: 'page_1',
      pages: [{ id: 'page_1', name: 'P1', pageSettings: {}, canvas: '<div class="section-block" id="sec_1" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:300px"></div></div></div>' }] };
    window.__file = JSON.parse(JSON.stringify(project)); window.__writes = 0;
    Object.assign(window.__fake, {
      loadProject: async () => JSON.parse(JSON.stringify(window.__file)),
      saveProject: async (p) => { window.__writes++; window.__file = JSON.parse(JSON.stringify(p)); return { ok: true }; },
      saveProjectSync: (p) => { window.__file = JSON.parse(JSON.stringify(p)); return { ok: true }; },
      saveProjectMeta: async () => ({ ok: true }),
    });
    window.__files = { [A]: project };
    if (tabB) {   // 두 번째 탭 B(내용 «B만») — 프로젝트별 파일
      const pb = { ...window.buildEmptyProject('proj_xb', 'proj_xb'), id: 'proj_xb', name: 'proj_xb', version: 2, currentPageId: 'page_b',
        pages: [{ id: 'page_b', name: 'PB', pageSettings: {}, canvas: '<div class="section-block" id="sec_b"><div class="section-inner"><div class="text-block" id="tb_b"><div contenteditable="false">B만</div></div></div></div>' }] };
      window.__files.proj_xb = pb;
      Object.assign(window.__fake, { loadProject: async (id) => JSON.parse(JSON.stringify(window.__files[id] || window.__file)),
        saveProject: async (p) => { window.__writes++; window.__files[p.id] = JSON.parse(JSON.stringify(p)); if (p.id === A) window.__file = window.__files[A]; return { ok: true }; } });
    }
    window.openTabs = [{ id: A, name: A, _cache: JSON.stringify(project) }].concat(tabB ? [{ id: 'proj_xb', name: 'proj_xb', _cache: JSON.stringify(window.__files.proj_xb) }] : []);
    window.activeProjectId = A; history.replaceState(null, '', '?project=' + A);
    window.applyProjectData(JSON.parse(JSON.stringify(project)));
    await window.switchScratch(A, 'page_1');
    for (let i = 0; i < n; i++) await window._scratchAddAndSave(PNG, 700, 200 + i * 10, 300, undefined, 'sp_' + i);
    window.clearHistory?.();
    await window.flushSave();   // 파일 매니페스트에 장이 실린 판에서 시작
  }, [A, PNG, n, tabB]);
  await page.waitForFunction(() => !window.hasUnsavedChanges?.());
  /* [전제] 장 그림이 «다 떴다» — 가짜 goya-asset 주소는 못 읽혀 onerror 로 «누락» 자리표시(min-height 80)가 된다: 1×1 PNG 폭 300 = 높이 300 → 80.
     부하로 그 줄어듦이 고르기 클릭(밑변 -6) 뒤에 오면 손이 장 밖에 남아 :hover 가 풀리고 ✕ 가 pointer-events none 이 됐다(cand14 지혜맥 ×10 9 빨강). */
  await page.waitForFunction(() => [...document.querySelectorAll('.scratch-item')].every((el) => { const i = el.querySelector('img');
    return !!i && i.complete && (i.naturalWidth > 0 || el.classList.contains('scratch-missing')); }));
  return errs;
}
const onDisk = (page) => page.evaluate(() => (window.__file.pages?.[0]?.scratchpad || []).map(i => i.id).sort());
const present = (page, id) => page.evaluate((id) => !!document.querySelector(`.scratch-item[data-scratch-id="${id}"]`), id);
async function pressX(page, id) {
  await page.evaluate((id) => document.querySelector(`.scratch-item[data-scratch-id="${id}"]`).scrollIntoView({ block: 'center', behavior: 'instant' }), id);
  await waitStableRect(page, `.scratch-item[data-scratch-id="${id}"]`);
  /* «고르기» 점 = 장 안이되 단추가 아닌 곳 — 멎은 뒤 재고 같은 evaluate 에서 elementFromPoint 로 맞혀 본다.
     옛 «밑변 −6» 은 멎기 «전»에 쟀고, 장이 누락 자리표시(80 · 화면 32px)로 줄면 그 줄이 ✂ 띠에 걸려 고르기 클릭이 ✂ 를 눌렀다
     (cand14 [X-DIAG] 8/8: scratch-slice-mode · activeElement = .scratch-slice-btn). */
  let c = null, cPrev = '';
  await expect.poll(async () => {
    c = await page.evaluate((id) => { const el = document.querySelector(`.scratch-item[data-scratch-id="${id}"]`); const r = el.getBoundingClientRect();
      for (const [fx, fy] of [[0.25, 0.75], [0.5, 0.75], [0.5, 0.9], [0.25, 0.5], [0.5, 0.5]]) {
        const p = { x: r.left + r.width * fx, y: r.top + r.height * fy }; const e = document.elementFromPoint(p.x, p.y);
        /* 단추는 :hover 전엔 pointer-events none 이라 elementFromPoint 에 안 잡힌다 — 손이 닿으면 살아나니 단추 상자 자체를 피한다 */
        const onBtn = [...el.querySelectorAll('button, .scratch-resize, .scratch-id-chip, .spl-btns')].some((b) => { const q = b.getBoundingClientRect(); return q.width && p.x >= q.left - 2 && p.x <= q.right + 2 && p.y >= q.top - 2 && p.y <= q.bottom + 2; });
        if (!onBtn && e && e.closest('.scratch-item') === el && !e.closest('button, .scratch-resize, .scratch-id-chip, .spl-btns')) return { ...p, ok: true };
      }
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, ok: false }; }, id);
    const k = `${c.x},${c.y}`, same = k === cPrev; cPrev = k; return c.ok && same;
  }, { message: '[전제] 고를 점 = 그 장 몸(단추 아님)이고 자리가 멎었다', intervals: [50] }).toBe(true);
  await page.mouse.click(c.x, c.y); await settle(page);   // 골라야 ✕ 가 선다
  expect(await page.evaluate((id) => { const el = document.querySelector(`.scratch-item[data-scratch-id="${id}"]`); return el.classList.contains('scratch-selected') && !el.classList.contains('scratch-slice-mode'); }, id),
    '[전제] 골랐고 자르기(✂) 모드가 아니다').toBe(true);
  /* ✕ 는 «그 좌표의 주인»이고 자리가 두 번 내리 같을 때 누른다(같은 evaluate 에서 재고 맞혀 본다 · 조건 대기 · 고정 대기 없음). */
  let b = null, prev = '', mouse = { x: c.x, y: c.y }, polls = 0;
  try { await expect.poll(async () => {
    polls++;
    if (b) { await page.mouse.move(b.x, b.y); mouse = { x: b.x, y: b.y }; }   // 사람처럼 ✕ 위에 손을 올린 채 잰다(✕ 는 장 :hover 때만 눌린다)
    b = await page.evaluate((id) => { const x = document.querySelector(`.scratch-item[data-scratch-id="${id}"] .scratch-close`); const r = x.getBoundingClientRect();
      const p = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; const e = document.elementFromPoint(p.x, p.y); return { ...p, own: !!e && (e === x || x.contains(e)) }; }, id);
    const k = `${b.x},${b.y}`, same = k === prev; prev = k; return b.own && same;
  }, { message: '[전제] ✕ 가 그 좌표의 주인이고 자리가 멎었다', intervals: [50] }).toBe(true); } catch (err) {
    /* [X-DIAG] 진단만(지디 261119) — 끝내 주인이 못 됐을 때 «그 순간 그 자리의 주인»을 한 줄로 남기고 원래 오류를 그대로 던진다(단언·문구·대기 무변). */
    const d = await page.evaluate(([id, b, m]) => {
      const el = document.querySelector(`.scratch-item[data-scratch-id="${id}"]`), x = el?.querySelector('.scratch-close');
      const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10); };
      const tag = (e) => e ? e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '') : null;
      const cs = x ? getComputedStyle(x) : null;
      return { ptAt: b && document.elementsFromPoint(b.x, b.y).slice(0, 4).map(tag), mouse: m, mouseAt: document.elementsFromPoint(m.x, m.y).slice(0, 3).map(tag),
        close: cs && { pe: cs.pointerEvents, vis: cs.visibility, op: cs.opacity, disp: cs.display, rect: R(x), txt: x.textContent },
        item: el && { hover: el.matches(':hover'), cls: el.className, rect: R(el), z: getComputedStyle(el).zIndex },
        hovered: [...document.querySelectorAll(':hover')].slice(-2).map(tag), focus: tag(document.activeElement), hasFocus: document.hasFocus(), vis: document.visibilityState,
        items: document.querySelectorAll('.scratch-item').length, zoom: window.currentZoom };
    }, [id, b, mouse]);
    console.log('[X-DIAG]', JSON.stringify({ id, polls, last: b, prev, ...d }));
    throw err;
  }
  await page.mouse.move(b.x, b.y); await page.mouse.click(b.x, b.y);
  await expect.poll(() => present(page, id), { message: '[전제] 지워졌다' }).toBe(false);
}

test('X1 ✕ → 1초 안에 파일 매니페스트에서 그 장이 빠진다', async ({ page }) => {
  const errs = await setup(page);
  expect(await onDisk(page), '[전제] 파일에 장이 실렸다').toEqual(['sp_0']);
  await pressX(page, 'sp_0');
  expect(await until(page, []), '★1초 안 파일에 지운 장이 남았다(1.5초 미룬 저장)').toBeLessThan(1000);
  expect(errs).toEqual([]);
});
test('X2 ✕ 뒤 ⌘Z → 1초 안에 파일에 다시 실린다 · X3 ⌘⇧Z → 다시 빠진다', async ({ page }) => {
  const errs = await setup(page);
  await pressX(page, 'sp_0');
  await expect.poll(() => onDisk(page)).toEqual([]);
  await page.keyboard.press('Meta+z');
  await expect.poll(() => present(page, 'sp_0'), { message: '[전제] 되살아났다' }).toBe(true);
  expect(await until(page, ['sp_0']), '★X2 ⌘Z 뒤 1초 안 파일에 안 실렸다').toBeLessThan(1000);
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(() => present(page, 'sp_0'), { message: '[전제] 다시 지워졌다' }).toBe(false);
  expect(await until(page, []), '★X3 ⌘⇧Z 뒤 1초 안 파일에 남았다').toBeLessThan(1000);
  expect(errs).toEqual([]);
});
test('X4 연달아 ✕ 5번 → 끝 파일 0장 · 저장 수 기록', async ({ page }) => {
  const errs = await setup(page, 5);
  expect(await onDisk(page)).toHaveLength(5);
  const w0 = await page.evaluate(() => window.__writes);
  for (let i = 4; i >= 0; i--) await pressX(page, 'sp_' + i);   // 겹쳐 놓였다 — 맨 위(나중 것)부터
  await expect.poll(() => onDisk(page), { timeout: 5000 }).toEqual([]);
  await page.waitForFunction(() => !window.hasUnsavedChanges?.() && !window._isSavingToFile);
  console.log('X4 saveProject 수(✕ 5번):', await page.evaluate((w0) => window.__writes - w0, w0));
  expect(errs).toEqual([]);
});

test('X5 ✕ 와 같은 틱에 탭 B 로 — A 파일에서 그 장이 빠지고 · B 파일엔 A 내용이 안 들어간다', async ({ page }) => {
  const errs = await setup(page, 1, { tabB: true });
  expect(await onDisk(page), '[전제] A 파일에 장').toEqual(['sp_0']);
  await page.evaluate(() => { document.querySelector('.scratch-item[data-scratch-id="sp_0"] .scratch-close').click(); window.__sw = window.switchTab('proj_xb'); });
  await page.evaluate(() => window.__sw);
  await expect.poll(() => page.evaluate(() => window.activeProjectId), { message: '[전제] B 로 갔다' }).toBe('proj_xb');
  await expect.poll(() => page.evaluate(() => (window.__files.proj_xc.pages?.[0]?.scratchpad || []).map(i => i.id)), { timeout: 6000, message: '★A 파일에 지운 장이 남았다(탭 전환 저장이 A 를 건너뜀)' }).toEqual([]);
  await page.waitForFunction(() => !window._isSavingToFile && !window.hasUnsavedChanges?.(), null, { timeout: 8000 });
  const b = await page.evaluate(() => JSON.stringify(window.__files.proj_xb));
  expect(b.includes('B만') && !b.includes('sec_1'), '★B 파일에 A 내용이 들어갔다').toBe(true);
  expect(errs).toEqual([]);
});
test('X6 저장이 실패하면 ✕ 뒤에도 미저장이 남아 예약이 다시 선다', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { window.__fake.saveProject = async () => ({ ok: false, reason: 'x' }); });
  await pressX(page, 'sp_0');
  await page.waitForFunction(() => !window._isSavingToFile, null, { timeout: 8000 });
  await page.evaluate(() => new Promise(r => setTimeout(r, 300)));
  expect(await page.evaluate(() => window.hasUnsavedChanges?.()), '★실패했는데 미저장 표시가 없다(다시 안 씀)').toBe(true);
  errs.length = 0;   // 실패 토스트·콘솔은 이 칸의 뜻
});

test('X7 손짓 미룸 중 ✕ → 바로 저장 안 함(중간 꼴) · 손을 떼면 파일에서 빠진다', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { window.__w7 = 0; const o = window.__fake.saveProject; window.__fake.saveProject = async (p) => { window.__w7++; return o(p); }; window.deferAutoSave(); });
  await pressX(page, 'sp_0');
  await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
  expect(await page.evaluate(() => window.__w7), '★손짓 중에 바로 저장했다').toBe(0);
  expect(await page.evaluate(() => window.__autoSaveDeferState().pending), '[전제] 예약은 기억됐다').toBe(true);
  await page.evaluate(() => window.resumeAutoSave());
  await expect.poll(() => onDisk(page), { timeout: 6000, message: '★손을 뗀 뒤에도 파일에 남았다' }).toEqual([]);
  expect(errs).toEqual([]);
});
