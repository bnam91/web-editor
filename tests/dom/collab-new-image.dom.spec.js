/* COLLAB-NEW-IMAGE-NO-GOYA-HANDLING-01 — 협업으로 나가는 섹션의 그림은 상대가 읽을 수 있는 꼴(data URL)이어야 한다.
 * 고치기 전 앱 값: 파일로 넣은 그림 → 받는 쪽 naturalWidth 0·PNG 흰색 / data URL 로 받은 쪽이 저장·다시 열기 → 그쪽 주소를 되올려 보낸 쪽 그림이 깨짐.
 * 하네스: bootApp + 가짜 electronAPI(서버·자산 IPC 대신 정해진 답). 앱·서버 0. 두 앱 값은 회신에 있다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

async function boot(page) {
  await bootApp(page);
  await page.evaluate((PNG) => {
    window.__assetSec = (pid, id = 'secX') => `<div class="section-block" id="${id}"><div class="section-inner"><div class="asset-block has-image" id="ab_${id}" data-img-src="goya-asset://${pid}/aaaa.png"><img class="asset-img" src="goya-asset://${pid}/aaaa.png"></div><div id="bg_${id}" style="background-image: url(&quot;goya-asset://${pid}/aaaa.png&quot;)"></div></div></div>`;
    window.__Y = (t) => `<div class="section-block" id="secY"><div class="section-inner">${t}</div></div>`;
    window.__pushes = []; window.__events = []; window.__reads = []; window.__seq = 5; window.__queue = []; window.__known = { 'proj_a/aaaa.png': PNG, 'proj_b/aaaa.png': PNG };
    window.__gate = null;
    window.electronAPI = Object.assign({}, window.electronAPI, {
      assetsReadAsDataUri: async ({ projectId, filename }) => {
        const k = projectId + '/' + filename; window.__reads.push(k);
        if (window.__gate) await window.__gate;
        return window.__known[k] ? { ok: true, dataUri: window.__known[k] } : { ok: false, error: 'not found' };
      },
      collab: {
        ref: async () => ({ ok: true, ref: { collabId: 'cb_t', seq: 5, role: 'member' } }),
        pull: async () => { const p = window.__queue; window.__queue = []; return { ok: true, patches: p, seq: window.__seq, presence: [], sections: [] }; },
        push: async (q) => { const pt = q.patches[0]; window.__seq += 1; window.__pushes.push({ sectionId: pt.sectionId, html: pt.html, hash: pt.hash }); return { ok: true, seq: window.__seq, accepted: [{ sectionId: pt.sectionId, seq: window.__seq }] }; },
        seq: async () => ({ ok: true }), invites: async () => ({ ok: true, invites: [], projects: [] }),
      },
    });
    window.COLLAB_ENABLED = true;
    window.collabSync.onEvent((e) => window.__events.push(e));
    window.__set = (html) => { document.getElementById('canvas').innerHTML = html; };
    window.__save = () => window.dispatchEvent(new CustomEvent('gd:project-saved', { detail: { snap: JSON.stringify({ pages: [{ id: window.state.currentPageId, canvas: document.getElementById('canvas').innerHTML }] }) } }));
  }, PNG);
}
const pushedOf = (page, sid) => page.evaluate((sid) => window.__pushes.filter(p => p.sectionId === sid), sid);
const waitPushes = (page, n) => page.waitForFunction((n) => window.__pushes.length >= n, n);

test('C1 파일로 들어간 그림은 data URL 로 나간다 — img·data-img-src·style 안(&quot;) 셋 다 · 화면과 저장 글은 그대로', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => { window.__set(window.__assetSec('proj_a')); await window.collabSync.start('proj_x'); });
  await waitPushes(page, 1);
  const [p] = await pushedOf(page, 'secX');
  expect(p.html, `주소가 그대로 나갔다: ${p.html.slice(0, 200)}`).not.toContain('goya-asset://');
  expect(p.html.split('data:image/png').length - 1, '그림 세 자리').toBe(3);
  const live = await page.evaluate(() => document.getElementById('canvas').innerHTML);
  expect(live, '라이브 DOM 은 자산 주소를 유지한다').toContain('goya-asset://proj_a/aaaa.png');
  expect(live).not.toContain('data:image/png');
});

test('C2 받은 그림을 다시 열어 주소가 내 것으로 바뀌어도 되올리지 않는다(보낸 쪽 그림을 안 깬다)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    window.__set(window.__Y('Y0'));
    await window.collabSync.start('proj_x');
    return window.__pushes.length;
  });
  await waitPushes(page, r || 1);
  /* 상대가 data URL 로 올린 secX 를 받는다 — 그 글을 알아야 hash 가 맞는다 */
  const applied = await page.evaluate(async () => {
    const inl = await window.inlineAssetsForPeer(window.__assetSec('proj_a'));
    const M = window.marketMerge;
    const hash = M.hash(M.normSection(new DOMParser().parseFromString(inl.html, 'text/html').querySelector('.section-block')));
    window.__seq += 1;
    window.__queue = [{ pageId: window.state.currentPageId, sectionId: 'secX', html: inl.html, hash, actorId: 'aaaa', seq: window.__seq, baseSeq: 0 }];
    await window.collabSync.tick();
    /* 받는 쪽 저장·다시 열기 = 같은 그림이 그쪽 주소로 */
    document.getElementById('secX').outerHTML = window.__assetSec('proj_b');
    document.getElementById('secY').outerHTML = window.__Y('Y1');
    const before = window.__pushes.length;
    window.__save();
    return before;
  });
  await waitPushes(page, applied + 1);
  expect((await pushedOf(page, 'secX')).length, '내 주소로 바뀐 것만으로 secX 를 되올렸다').toBe(0);
  expect((await pushedOf(page, 'secY')).at(-1).html, '★전제: 저장 한 바퀴가 돌았다').toContain('Y1');
});

test('C3 못 읽은 그림은 주소를 그대로 둔다 — 지어내지 않고 멀쩡한 섹션은 간다', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => { window.__set(window.__assetSec('proj_gone') + window.__Y('Y0')); await window.collabSync.start('proj_x'); });
  await waitPushes(page, 2);
  expect((await pushedOf(page, 'secX'))[0].html).toContain('goya-asset://proj_gone/aaaa.png');
  expect((await pushedOf(page, 'secY'))[0].html).toContain('Y0');
});

test('C4 천장을 넘는 섹션은 안 보내고 말한다 · 다음 저장에 파일을 다시 안 읽는다 · 다른 섹션은 간다', async ({ page }) => {
  await boot(page);
  await page.evaluate(async (PNG) => {
    window.__known['proj_a/aaaa.png'] = PNG.slice(0, 22) + 'A'.repeat(400000);   // 세 자리면 1.2MB
    /* 이 하네스엔 goya-asset 스킴이 없어 <img> 면 실패 표시가 글에 붙어 hash 가 바뀐다 — 저장 사이 글이 같아야 하는 시험이라 img 없는 꼴로 잰다 */
    window.__set(`<div class="section-block" id="secX" data-img-src="goya-asset://proj_a/aaaa.png"><div class="section-inner"><div data-bg-img="goya-asset://proj_a/aaaa.png"></div><div data-img-src="goya-asset://proj_a/aaaa.png"></div></div></div>` + window.__Y('Y0'));
    await window.collabSync.start('proj_x');
  }, PNG);
  await waitPushes(page, 1);
  expect((await pushedOf(page, 'secX')).length).toBe(0);
  const ev = await page.evaluate(() => window.__events.filter(e => e.type === 'section_too_large'));
  expect(ev.length).toBe(1);
  expect(ev[0].sectionId).toBe('secX');
  expect(ev[0].detail.bytes).toBeGreaterThan(ev[0].detail.limit);
  const reads = await page.evaluate(() => {
    const n = window.__reads.length;
    document.getElementById('secY').outerHTML = window.__Y('Y1');
    /* 재개 push 와 같은 글(serializeProject) — 진짜 자동저장이 쏘는 글이다 */
    window.dispatchEvent(new CustomEvent('gd:project-saved', { detail: { snap: window.serializeProject() } }));
    return n;
  });
  await waitPushes(page, 2);
  expect(await page.evaluate(() => window.__reads.length), '저장마다 큰 파일을 다시 읽는다').toBe(reads);
  expect((await pushedOf(page, 'secX')).length).toBe(0);
  const shown = await page.evaluate(() => window.collabNotify.shown());
  expect(shown.filter(t => /너무 큽니다/.test(t)).length, '사람에게 한 번 말한다').toBe(1);
});

test('C5 파일을 읽는 사이 탭이 바뀌면 이 글을 다음 방에 올리지 않는다', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => {
    window.__set(window.__assetSec('proj_a'));
    let open; window.__gate = new Promise(r => { open = r; }); window.__open = open;
    window.__started = window.collabSync.start('proj_x');
  });
  await page.waitForFunction(() => window.__reads.length >= 1);
  await page.evaluate(() => {
    window.collabSync.stop();
    window.__open(); window.__gate = null;
    return window.__started.catch(() => {});   // 멈춘 뒤 start 의 뒷걸음은 이 시험이 재는 것이 아니다
  });
  /* start 는 push 가 끝난 뒤 답한다 — 그 뒤라 더 올 것이 없다 */
  expect((await pushedOf(page, 'secX')).length).toBe(0);
});
