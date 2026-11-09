/* boot-cleanup-corrupt-ls — 부팅 LS 고아 정리가 «proj.json 은 있는데 못 읽는»(깨짐·후보 0) 프로젝트의 LS 본을 지우지 않는다 (BOOT-CLEANUP-WIPES-CORRUPT-PROJECT-LS-01)
 * 왜: 깨진 프로젝트는 목록 밖(main _listItemFor null)이고 폴더는 있어 projectGoneCopy 도 null — 정리 남김 목록에 안 들어 LS 본이 지워졌다.
 *   그 본이 성한 마지막 사본일 수 있다(워커1 코드 읽기 · PLAN-corrupt-project-261110 §0). 부팅 프로젝트 자신도 같다.
 * 자: 다시 부팅(reload)한 뒤 LS 키. 정리가 돌았다는 신호 = 폴더 없는 고아 Z 의 LS 가 지워짐(고정 대기 없음).
 *   main 의 판정(projects:read-state)은 가짜 — 그 판정이 맞는지는 tests/unit/project-read-state.test.js 가 잰다.
 * 칸: K1 옆 탭의 깨진 프로젝트 LS 남음 · K2 부팅 프로젝트 자신이 깨졌을 때 LS 남음 · K3 [음성] 기획(표지 없음)은 지금대로 지움
 *     K4 [음성] proj.json 없음은 지금대로 지움 · K5 판정 창구가 던지면 남김(안전 쪽)
 * 픽스처: LS 본 = 섹션 셋 · 글 블럭 · 그림 블럭 둘. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const [A, B, Z] = ['proj_cla', 'proj_clb', 'proj_clz'];
const RED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const HALF = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVR4nGNgYPj/nwEIAAr+Af/hHqJQAAAAAElFTkSuQmCC';

async function bootWith(page, { stateA = 'unreadable', active = B, readThrows = false }) {
  await page.addInitScript(([A, B, Z, RED, HALF, stateA, active, readThrows]) => {
    const img = (n, src) => `<div class="asset-block has-image" id="ab_${n}" data-img-src="${src}" style="height:200px;"><div class="asset-img-clip"><img class="asset-img" src="${src}"></div></div>`;
    const txt = (n, s) => `<div class="text-block" id="tb_${n}" data-type="text"><div class="tb-h2">${s}</div></div>`;
    const sec = (id, n, inner) => `<div class="section-block" id="sec_${id}_${n}" data-section="${n}"><div class="section-inner">${inner}</div></div>`;
    const proj = (id) => ({ id, name: id, version: 2, currentPageId: 'page_1', pages: [{ id: 'page_1', name: 'P1', pageSettings: {}, canvas: sec(id, 1, txt(id + '1', id + ' 제목 · LS 에만 있는 편집')) + sec(id, 2, img(id + '2', RED)) + sec(id, 3, txt(id + '3', '본문') + img(id + '3', HALF)) }] });
    const fake = {
      listProjects: async () => [{ id: B, name: B, type: null, updatedAt: new Date().toISOString() }],
      projectsRootKey: async () => 'legacy',
      projectFolderState: async (id) => (id === Z ? 'missing' : 'ok'),
      projectReadState: async (id) => { if (readThrows && id === A) throw new Error('IPC 실패 흉내'); return id === A ? stateA : id === B ? 'ok' : 'none'; },   // Z 는 답한다 — 정리가 돌았다는 신호
      loadProject: async (id, o) => (id === B ? proj(B) : (o && o.open ? { _unreadable: true } : null)),
    };
    Object.defineProperty(window, 'electronAPI', { configurable: true, get: () => new Proxy(fake, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) }), set: () => {} });
    if (!sessionStorage.getItem('__seeded')) {   // 첫 부팅은 씨만 — reload 뒤 부팅이 잰다
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('web-editor-open-tabs', JSON.stringify({ tabs: [{ id: A, name: A }, { id: B, name: B }], activeId: active }));
      for (const id of [A, Z]) {
        localStorage.setItem('web-editor-autosave__' + id, JSON.stringify(proj(id)));
        localStorage.setItem('web-editor-autosave__' + id + '_ts', String(Date.now()));
        localStorage.setItem('web-editor-ls-root__' + id, 'legacy');
      }
    }
  }, [A, B, Z, RED, HALF, stateA, active, readThrows]);
  await bootApp(page);
  await page.evaluate((id) => { history.replaceState(null, '', '?project=' + id); }, active);
  await page.reload();
  await page.waitForFunction((Z) => typeof window.rebindAll === 'function' && localStorage.getItem('web-editor-autosave__' + Z) === null, Z, { timeout: 15000 });
  return page.evaluate((A) => localStorage.getItem('web-editor-autosave__' + A) || '', A);
}

test('K1 옆 탭의 깨진 프로젝트 — LS 본이 남는다', async ({ page }) => {
  const ls = await bootWith(page, {});
  expect(ls.length, '★깨진 프로젝트의 LS 본(성한 마지막 사본일 수 있다)을 지웠다').toBeGreaterThan(0);
  expect(ls).toContain('LS 에만 있는 편집');
  expect(ls).toContain(RED.slice(-24));
  expect(ls).toContain(HALF.slice(-24));
});
test('K2 부팅 프로젝트 자신이 깨졌을 때도 LS 본이 남는다', async ({ page }) => {
  const ls = await bootWith(page, { active: A });
  expect(ls.length, '★부팅 프로젝트의 LS 본을 지웠다').toBeGreaterThan(0);
});
test('K3 [음성] 기획(실패 표지 없음)은 지금대로 지운다', async ({ page }) => {
  expect(await bootWith(page, { stateA: 'planning' })).toBe('');
});
test('K4 [음성] proj.json 없음은 지금대로 지운다', async ({ page }) => {
  expect(await bootWith(page, { stateA: 'none' })).toBe('');
});
test('K5 판정 창구가 던지면 남긴다(안전 쪽)', async ({ page }) => {
  expect((await bootWith(page, { readThrows: true })).length, '★못 물었는데 지웠다').toBeGreaterThan(0);
});
