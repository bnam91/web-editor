/* beforeunload-ls-folder-returned — BEFOREUNLOAD-LS-REWRITE-FOLDER-RETURNED-01(지디 261121): 남은 본 탭의 beforeunload 동기 저장이 folder_returned·kept(history)로 거절된 뒤
 *   옛 판은 LS 에 그 본을 다시 썼고, 그 본이 «다음 열기» 판정(pickLsOverFile · 부팅 unmarkedWins:true · 탭 false)에서 돌아온 파일을 이겼다(실측: B·C 이김 · A 파일).
 *   장면 = missing-folder-returns-while-viewing 의 가짜 main 그대로(복사) · 판정은 종료 뒤 다음 실행처럼 «남은 LS + 돌아온 파일»로 직접 돌린다
 *   (옆 탭으로 옮기면 그 길의 비동기 저장이 LS 를 먼저 걷어 «안전»처럼 보인다 — 실제 종료엔 그 저장이 없다).
 *   U-A 돌아온 판 updatedAt 11-10 > 표지 11-01 · U-B 표지 = 돌아온 판 updatedAt · U-C 돌아온 판에 updatedAt 없음 — 셋 다 «LS 본 걷힘 · 다음 열기 = 돌아온 파일».
 * 양성대조(실측): _patches/folder-returned-ls-CTL.patch(beforeunload 의 _unloadKept 를 changed_outside 만으로 되돌림) → U-A·U-B·U-C 빨강(셋 다 LS 본이 남음 · B·C 는 판정에서 LS 본이 이김).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const sec = (k, t) => `<div class="section-block" id="s_${k}" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="text-block" id="tb_${k}"><p>${t}</p></div><div class="asset-block" id="ab_${k}" data-img-src="${IMG}"></div></div></div>`;
const doc = (id, tag) => ({ id, name: id + '이름', version: 2, currentPageId: 'page_1', updatedAt: tag === '돌아온' ? '2026-11-10T00:00:00.000Z' : '2026-11-01T00:00:00.000Z',
  pages: [{ id: 'page_1', name: 'P', canvas: sec(tag + '1', tag + ' 머리') + sec(tag + '2', tag + ' 몸') + sec(tag + '3', tag + ' 끝') }] });

async function setup(page, { cached = false, start = 'missing' } = {}) {
  const errs = await bootApp(page);
  await page.evaluate(({ A, B, R, F, cached, start }) => {
    window.__state = start === 'file' ? 'ok' : 'missing'; window.__written = []; window.__sent = []; window.__toasts = [];
    const real = window.electronAPI;
    /* ★-02 main 계약: 표시 저장이 폴더를 다시 만들면 «제 폴더»(__own) — 그 뒤 표시 저장은 쓴다. 밖에서 돌아오면(ret · Finder 대치) 남의 것 → 거절. */
    const write = (x) => { window.__sent.push({ id: x.id, gone: !!x._goneBase }); const _wasMissing = window.__state === 'missing'; if (x.id === 'proj_b' && window.__state === 'ok' && !window.__own && (x._goneBase || window.__mine)) { (window.__refused ||= []).push(JSON.stringify(x.pages)); return { ok: false, reason: 'folder_returned', kept: 'history' }; } if (x.id === 'proj_b') { if (_wasMissing) { window.__own = true; window.__mine = true; } window.__state = 'ok'; } const { _goneBase, ...kept } = x; window.__written.push(kept); return { ok: true }; };   // main 처럼 표시를 떼고 «쓴다» — 붙은 채 두면 다음 저장이 읽어 합친 본에 표시가 따라 들어간다(인텔 N1 2≠1 · main 은 유닛 N1)
    /* __hold: proj_b 의 첫 비동기 저장을 붙든다 — 그사이 폴더가 돌아오고 다음 저장이 줄에 선다(적대 리뷰 ①). 판정은 풀린 뒤에 한다. */
    window.electronAPI = new Proxy(real || {}, { get: (t, k) => k === 'saveProject' ? async (x) => { if (window.__hold && x.id === 'proj_b' && !window.__held) { window.__held = true; window.__sent.push({ id: 'held' }); await new Promise((r) => { window.__rel = r; }); window.__sent.pop(); } return write(x); }
      : k === 'saveProjectSync' ? (x) => write(x)
      : k === 'saveProjectMeta' ? async () => ({ ok: true })
      : k === 'loadProject' ? async (id, o) => (id === 'proj_b' && o?.open && (window.__mine = false), id === 'proj_b' ? (window.__state === 'ok' ? (window.__written.slice(window.__retAt || 0).filter(w => w.id === 'proj_b').at(-1) || (window.__retAt != null ? R : window.__written.filter(w => w.id === 'proj_b').at(-1)) || F) : null) : A)   // 돌아온 뒤엔 그 뒤 쓴 것 · 없으면 돌아온 원본(R)
      : k === 'projectFolderState' ? async (id) => (id === 'proj_b' ? window.__state : 'ok')
      : k === 'projectsRootKey' ? async () => 'acct_me' : t[k] });
    const f = window.showStatusToast; window.showStatusToast = (m) => { window.__toasts.push(m); f(m); };
    localStorage.setItem('web-editor-autosave__proj_b', JSON.stringify(B));
    localStorage.setItem('web-editor-ls-root__proj_b', 'acct_me');
    window.openTabs = [{ id: 'proj_a', name: 'proj_a이름', _cache: JSON.stringify(A) }, { id: 'proj_b', name: 'proj_b이름', ...(cached ? { _cache: JSON.stringify(B) } : {}) }];   // cached = 전에 열어 둔 탭(메모리 캐시 갈래 · 미카사 R19)
    window.activeProjectId = 'proj_a';
    window.renderTabBar();
  }, { A: doc('proj_a', 'A'), B: doc('proj_b', '남은'), R: doc('proj_b', '돌아온'), F: doc('proj_b', '처음'), cached, start });
  await page.evaluate(() => window.switchTab('proj_b'));
  await page.waitForFunction((sel) => !!document.getElementById(sel) && window.gdtProjectReady?.get?.()?.phase !== 'loading', start === 'file' ? 's_처음1' : 's_남은1');
  return errs;
}
const ret = (page) => page.evaluate(() => { window.__state = 'ok'; window.__own = false; window.__retAt = window.__written.length; });   // 앱 밖에서 폴더가 돌아왔다(앱이 다시 만든 폴더가 있었으면 Finder 대치로 치워졌다)

async function probe(page, kase) {
  const errs = await setup(page);
  await ret(page);
  await page.evaluate((kase) => {
    if (kase === 'C') { const api = window.electronAPI; window.electronAPI = new Proxy(api, { get: (t, k) => (k === 'loadProject' ? async (id, o) => { const r = await t.loadProject(id, o); if (r && id === 'proj_b') { const { updatedAt, ...rest } = r; return rest; } return r; } : t[k]) }); }
    localStorage.setItem('web-editor-ls-base__proj_b', kase === 'B' ? '2026-11-10T00:00:00.000Z' : '2026-11-01T00:00:00.000Z');
    document.querySelector('#canvas .text-block p').textContent = '닫기직전'; window.scheduleAutoSave(); window.dispatchEvent(new Event('beforeunload'));
  }, kase);
  const r = await page.evaluate(async () => {
    const ls = (localStorage.getItem('web-editor-autosave__proj_b') || '').includes('닫기직전');
    const R = await window.electronAPI.loadProject('proj_b', { open: true });   // 다음 실행이 여는 «돌아온» 파일(가짜 main 의 판 그대로)
    const pick = (unmarkedWins) => { const snap = localStorage.getItem('web-editor-autosave__proj_b'), ts = localStorage.getItem('web-editor-autosave__proj_b_ts'), base = localStorage.getItem('web-editor-ls-base__proj_b');
      let w = null; try { w = window.pickLsOverFile(JSON.parse(JSON.stringify(R)), 'proj_b', { unmarkedWins }); } catch (e) { w = 'throw:' + e.message; }
      const res = w && typeof w === 'object' ? (JSON.stringify(w.pages || w).includes('닫기직전') ? 'LS본이 이김(돌아온 파일 위로 열림)' : 'LS(다른 본)') : (w || '파일');
      if (snap != null) localStorage.setItem('web-editor-autosave__proj_b', snap); else localStorage.removeItem('web-editor-autosave__proj_b');   // 판정이 걷어도 두 번째 판정에 같은 조건
      if (ts != null) localStorage.setItem('web-editor-autosave__proj_b_ts', ts);
      if (base != null) localStorage.setItem('web-editor-ls-base__proj_b', base); else localStorage.removeItem('web-editor-ls-base__proj_b');
      return res; };
    return { ls, fileVer: R && R.updatedAt, boot: pick(true), tab: pick(false) };
  });
  expect({ ls: r.ls, boot: r.boot, tab: r.tab }, `★남은 LS 본이 돌아온 파일을 이긴다(돌아온 판 updatedAt ${r.fileVer})`).toEqual({ ls: false, boot: '파일', tab: '파일' });
  expect(errs).toEqual([]);
}
for (const k of ['A', 'B', 'C']) test(`U-${k} beforeunload 뒤 다음 열기 = 돌아온 파일`, async ({ page }) => probe(page, k));
