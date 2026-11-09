/* collab-big-image — COLLAB-BIG-IMAGE-SECTION-NOT-SENT-01 (S3 COLLAB-180256). 하니스 = collab-old-gaps 꼴(가짜 ref/pull/push · 앱·서버 0).
 *   에셋 블럭 = data-img-src + <img class="asset-img" src> 같은 그림 «두 번» → base64 사본 2개 → 원본 ≈262KB 에서 천장(700KB) 초과로 섹션째 안 갔다.
 *   T1 400KB 그림 섹션 → 천장을 넘으니 사본 1개(img src 빼고 data-src-from 표식)로 올라간다 · section_too_large 0
 *   T1b [지킴] 150KB 그림 섹션 → 지금과 같은 글(사본 2개 · 표식 없음) = 해시 그대로
 *   T2 받는 쪽 — 사본 1개로 온 섹션의 img src 를 data-img-src 로 되살리고, 다음 저장이 그 섹션을 되올리지 않는다
 *   T3 (b) [지킴] 옛 진도(ref.hashes 없음) 첫 재개 — 내 오프라인 편집은 «올린다»(서버 keep-both 에 남음). ⛔«안 올리고 받기»는 넣었다 뺐다(리뷰 1: 충돌 기록이 메모리뿐 · 다른 페이지는 기록 없이 덮임)
 *   T4 (c) [지킴] 서버 목차에 없는 섹션(옛 판에서 천장으로 못 간 것)은 재개에 한 번 올라간다
 *   T5 ㉠ data URL 만 든 섹션(600KB 그림 1장 · 줄일 사본 없음 · 천장 초과)은 로컬에서 미리 막지 않고 push 를 시도한다(서버가 정함) · 양성대조: 2d6fb18d9 → T5 빨강(push 0)
 * 양성대조: js/collab/sync.js 를 ㉮ 판(b25d887b2)으로 되돌리면 T1(too_large · push 0)·T2(img src 없음) 빨강 · T1b·T3·T4 초록(지킴). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const dataUrl = (rawKB, tag = 'TAGX') => 'data:image/png;base64,' + tag + 'A'.repeat(Math.ceil(rawKB * 1024 * 4 / 3));   // 머리 tag 로 사본 수를 센다
async function boot(page, { hashes = undefined, sections = null } = {}) {
  await bootApp(page);
  await page.evaluate(([hashes, sections]) => {
    window.__log = []; window.__server = 5; window.__events = [];
    window.saveProjectToFile = async () => ({ ok: true });
    const M = window.marketMerge;
    window.__hash = (html) => M.hash(M.normSection(new DOMParser().parseFromString(html, 'text/html').querySelector('.section-block')));
    window.electronAPI = Object.assign({}, window.electronAPI, { collab: {
      ref: async () => ({ ok: true, ref: { collabId: 'cb_t', seq: 5, role: 'member', ...(hashes ? { hashes: window.__refHashes } : {}) } }),
      pull: async (q) => ({ ok: true, seq: window.__server, serverSeq: window.__server, patches: window.__log.filter(p => p.seq > q.sinceSeq && p.actorId !== q.actorId), presence: [], ...(q.wantSections && window.__srvSecs ? { sections: window.__srvSecs } : {}) }),
      push: async (q) => { const p = q.patches[0]; if (new Blob([p.html]).size > 700000) return { ok: false, reason: 'section_too_large' };   /* 진짜 서버처럼 섹션 천장 */ const seq = ++window.__server; window.__log.push({ ...p, seq }); return { ok: true, seq, accepted: [{ sectionId: p.sectionId, seq }], conflicts: [] }; },
      seq: async () => ({ ok: true }), invites: async () => ({ ok: true, invites: [], projects: [] }),
    } });
    window.COLLAB_ENABLED = true;
    window.collabSync.onEvent((e) => window.__events.push(e.type));
  }, [hashes, sections]);
}
const imgSec = (id, src) => `<div class="section-block" id="${id}"><div class="section-inner"><div class="row"><div class="asset-block has-image" id="ab_${id}" data-img-src="${src}"><div class="asset-img-clip"><img class="asset-img" src="${src}"></div></div></div></div></div>`;
const mine = (page, id) => page.evaluate((id) => window.__log.filter(p => p.actorId !== 'other' && p.sectionId === id), id);
const copies = (html, tag = 'TAGX') => html.split('base64,' + tag).length - 1;

test('T1 400KB 그림 섹션 — 사본 1개로 올라간다(천장 안) · section_too_large 0', async ({ page }) => {
  await boot(page);
  const src = dataUrl(400);
  await page.evaluate(([html]) => { document.getElementById('canvas').innerHTML = html; }, [imgSec('secI', src)]);
  await page.evaluate(() => window.collabSync.start('proj_x'));
  const pushed = await mine(page, 'secI');
  const ev = await page.evaluate(() => window.__events);
  expect(ev.includes('section_too_large'), '★천장 초과로 섹션이 안 갔다').toBe(false);
  expect(pushed.length, '★섹션이 안 올라갔다').toBe(1);
  expect(copies(pushed[0].html), '사본 1개').toBe(1);
  expect(pushed[0].html).toContain('data-src-from="img-src"');
  expect(new Blob([pushed[0].html]).size).toBeLessThan(700000);
});
test('T1b [지킴] 150KB 그림 섹션 — 지금과 같은 글(사본 2개 · 표식 없음)', async ({ page }) => {
  await boot(page);
  const src = dataUrl(150);
  await page.evaluate(([html]) => { document.getElementById('canvas').innerHTML = html; }, [imgSec('secI', src)]);
  await page.evaluate(() => window.collabSync.start('proj_x'));
  const pushed = await mine(page, 'secI');
  expect(pushed.length).toBe(1);
  expect(copies(pushed[0].html)).toBe(2);
  expect(pushed[0].html).not.toContain('data-src-from');
});
test('T2 받는 쪽 — 사본 1개로 온 그림의 img src 를 되살리고 되올리지 않는다', async ({ page }) => {
  await boot(page);
  const src = dataUrl(400);
  const r = await page.evaluate(async ([src, full]) => {
    /* 보내는 쪽 섹션은 «묶인 꼴»이다 — 잠깐 넣어 묶고 번호 매긴 글을 떠 둔 뒤 뺀다(받아 붙일 때의 rebind·번호가 내 해시를 안 바꾸게) */
    const c = document.getElementById('canvas');
    c.innerHTML = '<div class="section-block" id="secA"><div class="section-inner"><div class="tb">A</div></div></div>' + full;
    window.rebindAll?.({ preserveHistory: true }); window.buildLayerPanel?.();
    const pg = JSON.parse(window.serializeProject()).pages.find(x => x.id === window.state.currentPageId);
    const boundFull = new DOMParser().parseFromString(`<div>${pg.canvas}</div>`, 'text/html').getElementById('secI').outerHTML;
    document.getElementById('secI').remove(); window.rebindAll?.({ preserveHistory: true }); window.buildLayerPanel?.();
    await window.collabSync.start('proj_x');
    const sec = new DOMParser().parseFromString(boundFull, 'text/html').querySelector('.section-block');
    const img = sec.querySelector('img.asset-img'); img.removeAttribute('src'); img.setAttribute('data-src-from', 'img-src');   // 보내는 쪽이 만든 꼴
    const html = sec.outerHTML;
    window.__log.push({ pageId: window.state.currentPageId, sectionId: 'secI', html, hash: window.__hash(html), actorId: 'other', seq: ++window.__server, baseSeq: 5 });
    await window.collabSync.tick();
    const el = document.querySelector('#secI img.asset-img');
    const got = { hasImg: !!el, srcOk: el?.getAttribute('src') === src };
    const before = window.__log.filter(p => p.actorId !== 'other').length;
    window.dispatchEvent(new CustomEvent('gd:project-saved', { detail: { snap: window.serializeProject(), snapAt: performance.now() } }));
    await new Promise(r => setTimeout(r, 400));
    return { ...got, re: window.__log.filter(p => p.actorId !== 'other').slice(before).map(p => p.sectionId) };
  }, [src, imgSec('secI', src)]);
  expect(r.hasImg).toBe(true);
  expect(r.srcOk, '★받은 그림의 img src 가 비었다').toBe(true);
  expect(r.re, '★받은 섹션을 되올렸다').toEqual([]);
});
test('T3 (b) [지킴] 옛 진도 첫 재개 — 내 오프라인 편집은 올린다(서버에 둘 다 남는다 · 메모리 기록에만 맡기지 않는다)', async ({ page }) => {
  await boot(page);   // ref.hashes 없음
  const r = await page.evaluate(async () => {
    const sec = (id, t) => `<div class="section-block" id="${id}"><div class="section-inner"><div class="tb">${t}</div></div></div>`;
    document.getElementById('canvas').innerHTML = sec('secA', '내오프라인글');
    const html = sec('secA', '상대새글');
    const p = { pageId: window.state.currentPageId, sectionId: 'secA', html, hash: window.__hash(html), actorId: 'other', seq: ++window.__server, baseSeq: 5 };
    window.__log.push(p);
    window.__srvSecs = [{ pageId: p.pageId, sectionId: 'secA', hash: p.hash }];
    await window.collabSync.start('proj_x');
    return window.__log.filter(x => x.actorId !== 'other').map(x => new DOMParser().parseFromString(x.html, 'text/html').querySelector('.tb')?.textContent);
  });
  expect(r, '★내 오프라인 편집이 서버에 안 올라갔다(재기동하면 잃는다)').toEqual(['내오프라인글']);
});
test('T4 (c) [지킴] 서버 목차에 없는 섹션은 재개에 한 번 올라간다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const sec = (id, t) => `<div class="section-block" id="${id}"><div class="section-inner"><div class="tb">${t}</div></div></div>`;
    document.getElementById('canvas').innerHTML = sec('secA', 'A') + sec('secLost', '옛판에서 못 간 섹션');
    const html = sec('secA', 'A');
    window.__srvSecs = [{ pageId: window.state.currentPageId, sectionId: 'secA', hash: window.__hash(html) }];
    await window.collabSync.start('proj_x');
    return window.__log.filter(x => x.actorId !== 'other').map(x => x.sectionId);
  });
  expect(r).toEqual(['secLost']);
});

test('T5 ㉠ data URL 만 든 섹션(600KB · 줄일 사본 없음)은 로컬에서 미리 막지 않고 push 를 시도한다', async ({ page }) => {
  await boot(page);
  const src = dataUrl(600);
  const r = await page.evaluate(async ([src]) => {
    window.__tries = 0; const push = window.electronAPI.collab.push;
    window.electronAPI.collab.push = async (q) => { if (q.patches[0].sectionId === 'secD') window.__tries++; return push(q); };
    document.getElementById('canvas').innerHTML = `<div class="section-block" id="secD"><div class="section-inner"><img class="plain" src="${src}"></div></div>`;
    await window.collabSync.start('proj_x');
    return { tries: window.__tries, ev: window.__events };
  }, [src]);
  expect(r.tries, '★서버에 묻지도 않고 로컬에서 막았다').toBe(1);
  expect(r.ev.includes('section_too_large'), '서버(가짜 700KB)가 거절하면 예전처럼 알린다').toBe(true);
});
