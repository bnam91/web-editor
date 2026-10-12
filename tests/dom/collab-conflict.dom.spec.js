/* collab-conflict — SIX(2026-10-06 · 현빈 두 기기 실사용 「동시에 고쳤는데 한쪽 작업량이 날라가네」).
 *
 * ★확정된 결함(지디 서버 데이터 · 태양 재현): 사용자가 만지는 동안 «보류»된 묵은 원격 패치가, 그 사이 올린 내 새 판을
 *   손 뗀 뒤 «경고 없이» 덮고 → 다음 저장이 묵은 판을 다시 올렸다(서버 seq 13 A → 14 B → ★15 B 가 13 을 그대로 · conflicts 0).
 *   원인: ⓐ flushDeferred 가 묵음을 안 봄 ⓑ 덮어쓰기 경고가 «못 올린 내 변경»만 봄 ⓒ 보류 패치도 baseSeq 를 올려 서버 충돌 판정이 속음.
 * ★양성대조: 고치기 전 판(dev e7444dd3)에서 X1·X2 빨강 — 판 sha 는 보고에.
 * ★하네스: bootApp + 가짜 electronAPI.collab(서버 대신 정해진 답) · 검사 페이지 안에서만 COLLAB_ENABLED=true. 앱·서버 0.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 섹션 하나 + 가짜 서버. queue 에 넣은 패치를 다음 pull 이 준다. push 는 seq 를 하나씩 올려 accepted 로 돌려준다. */
async function boot(page) {
  await bootApp(page);
  await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    window.__SEC = (t) => `<div class="section-block" id="secX"><div class="section-inner"><div class="text-block" id="tbX"><div class="tb-body">${t}</div></div></div></div>`;
    canvas.innerHTML = window.__SEC('BASE') + '<div class="section-block" id="secY"><div class="section-inner">Y</div></div>';
    const M = window.marketMerge;
    window.__hash = (html) => { const d = new DOMParser().parseFromString(html, 'text/html'); return M.hash(M.normSection(d.querySelector('.section-block'))); };
    window.__queue = []; window.__pushes = []; window.__seq = 5; window.__presence = [];
    window.electronAPI = Object.assign({}, window.electronAPI, { collab: {
      ref: async () => ({ ok: true, ref: { collabId: 'cb_t', seq: 5, role: 'member' } }),
      pull: async () => { const p = window.__queue; window.__queue = []; return { ok: true, patches: p, seq: window.__seq, presence: window.__presence }; },
      push: async (q) => {
        const pt = q.patches[0];
        const t = new DOMParser().parseFromString(pt.html, 'text/html').querySelector('.tb-body')?.textContent ?? null;
        window.__seq += 1;
        window.__pushes.push({ sectionId: pt.sectionId, text: t, baseSeq: pt.baseSeq, seq: window.__seq });
        return { ok: true, seq: window.__seq, accepted: [{ sectionId: pt.sectionId, seq: window.__seq, conflict: false }] };
      },
      seq: async () => ({ ok: true }), invites: async () => ({ ok: true, invites: [], projects: [] }),
    } });
    window.COLLAB_ENABLED = true;
    window.__save = () => window.dispatchEvent(new CustomEvent('gd:project-saved', { detail: { snap: JSON.stringify({ pages: [{ id: window.state.currentPageId, canvas: document.getElementById('canvas').innerHTML }] }) } }));
    window.__text = () => document.querySelector('#tbX .tb-body').textContent;
  });
}

/* 현빈 사고 장면: 만지는 중 A-OLD 도착(보류) → B-NEW 저장·push → 손 뗌 → tick → 다음 저장 */
async function staleScene(page) {
  return page.evaluate(async () => {
    await window.collabSync.start('proj_x');
    const pushedAtStart = window.__pushes.length;
    document.getElementById('tbX').classList.add('selected');
    window.__seq += 1;
    const other = window.__SEC('A-OLD');
    window.__queue = [{ pageId: window.state.currentPageId, sectionId: 'secX', html: other, hash: window.__hash(other), actorId: 'aaaa', actorEmail: 'a@x.com', seq: window.__seq, baseSeq: window.__seq - 1 }];
    const deferredSeq = window.__seq;
    await window.collabSync.tick();
    document.querySelector('#tbX .tb-body').textContent = 'B-NEW';
    window.__save(); await new Promise(r => setTimeout(r, 150));
    document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected'));
    await window.collabSync.tick();
    const afterFlush = window.__text();
    window.__save(); await new Promise(r => setTimeout(r, 150));
    return { deferredSeq, afterFlush, pushes: window.__pushes.slice(pushedAtStart), conflicts: (window.collabSync.conflicts ? window.collabSync.conflicts() : []).map(c => ({ mode: c.mode, sectionId: c.sectionId })),   // 옛 판(API 없음)에서도 장면이 끝까지 돌게 — 양성대조가 «재현 단언»에서 빨개지도록
             toasts: window.collabNotify.shown() };
  });
}

test('X1 ★묵은 보류 패치가 내 새 판(이미 올림)을 덮지 않는다 · 묵은 판을 다시 올리지 않는다 · 충돌로 알린다', async ({ page }) => {
  await boot(page);
  const r = await staleScene(page);
  expect(r.afterFlush, `손 뗀 뒤 화면이 묵은 상대 판으로 덮였다(현빈 사고) — push: ${JSON.stringify(r.pushes)}`).toBe('B-NEW');
  const bNew = r.pushes.findIndex(p => p.text === 'B-NEW');
  expect(bNew, '★전제: B-NEW 를 올렸다').toBeGreaterThanOrEqual(0);
  expect(r.pushes.slice(bNew + 1).some(p => p.text === 'A-OLD'), `B-NEW 뒤에 묵은 A-OLD 를 다시 올렸다(seq 15 꼴): ${JSON.stringify(r.pushes)}`).toBe(false);
  expect(r.conflicts).toEqual([{ mode: 'kept', sectionId: 'secX' }]);
  expect(r.toasts.length, '충돌을 «말하지» 않았다(현빈은 못 봤다)').toBeGreaterThan(0);
});

test('X2 ★보류 중인 섹션의 push baseSeq = «보류 패치 직전» — 서버 keep-both 충돌 판정이 선다', async ({ page }) => {
  await boot(page);
  const r = await staleScene(page);
  const p = r.pushes.find(x => x.text === 'B-NEW');
  expect(p.baseSeq, `B-NEW 의 baseSeq(${p.baseSeq})가 보류 패치 seq(${r.deferredSeq}) 를 «본 셈»이다 — 서버가 충돌을 못 본다`).toBe(r.deferredSeq - 1);
});

test('X3 [상대 판으로 바꾸기] — 충돌 칸 단추로 상대 판을 두면 그 판이 화면·다음 push 가 된다(서버엔 둘 다 남는다)', async ({ page }) => {
  await boot(page);
  await staleScene(page);
  const r = await page.evaluate(async () => {
    const btn = document.getElementById('collab-conflict-btn');
    const shown = !!btn && getComputedStyle(btn).display !== 'none';
    btn.click();
    const pop = document.getElementById('collab-conflict-pop');
    const row = pop.querySelector('.collab-conflict-row');
    const before = window.__pushes.length;
    row.querySelector('[data-pick="theirs"]').click();
    const text = window.__text();
    window.__save(); await new Promise(r => setTimeout(r, 150));
    return { shown, text, newPushes: window.__pushes.slice(before).map(p => p.text), left: window.collabSync.conflicts().length,
             btnHidden: getComputedStyle(document.getElementById('collab-conflict-btn')).display === 'none' };
  });
  expect(r.shown, '충돌 단추가 안 보인다').toBe(true);
  expect(r.text).toBe('A-OLD');
  expect(r.newPushes).toContain('A-OLD');
  expect(r.left).toBe(0);
  expect(r.btnHidden, '고른 뒤에도 충돌 단추가 남아 있다').toBe(true);
});

test('X4 상대가 내 마지막 판을 «못 보고» 더 늦게 올림 — 붙이되(나중 쓴 쪽) [내 판 유지]로 되살린다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    await window.collabSync.start('proj_x');
    document.querySelector('#tbX .tb-body').textContent = 'MINE';
    window.__save(); await new Promise(r => setTimeout(r, 150));
    const mine = window.__pushes.find(p => p.text === 'MINE');
    window.__seq += 1;
    const t = window.__SEC('THEIRS-LATE');
    window.__queue = [{ pageId: window.state.currentPageId, sectionId: 'secX', html: t, hash: window.__hash(t), actorId: 'aaaa', seq: window.__seq, baseSeq: mine.seq - 1 }];
    await window.collabSync.tick();
    const afterApply = window.__text();
    const conflicts = window.collabSync.conflicts().map(c => c.mode);
    window.collabSync.resolveConflict(window.collabSync.conflicts()[0].key, 'mine');
    const afterRestore = window.__text();
    const before = window.__pushes.length;
    window.__save(); await new Promise(r => setTimeout(r, 150));
    return { afterApply, conflicts, afterRestore, repush: window.__pushes.slice(before).map(p => p.text) };
  });
  expect(r.afterApply, '나중에 쓴 상대 판이 붙는다').toBe('THEIRS-LATE');
  expect(r.conflicts).toEqual(['replaced']);
  expect(r.afterRestore).toBe('MINE');
  expect(r.repush).toContain('MINE');
});

test('X5 ★「상대가 편집 중」 — 그 섹션 둘레에 표시 · 상단바 title 은 「N번째 섹션」 · 상대가 떠나면 지운다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    window.__presence = [{ actorId: 'aaaa', email: 'a@x.com', editingSectionId: 'secX', lastSeenAt: new Date().toISOString() }];
    await window.collabSync.start('proj_x'); await window.collabSync.tick();
    const box = document.querySelector('#collab-presence-layer .collab-presence-box');
    const sec = document.getElementById('secX').getBoundingClientRect();
    const b = box ? box.getBoundingClientRect() : null;
    const on = { has: !!box, forSec: box?.dataset.sectionId, aligned: b ? Math.abs(b.left - sec.left) < 2 && Math.abs(b.width - sec.width) < 2 : false,
                 title: document.getElementById('collab-topbar-badge').title, secAttrs: [...document.getElementById('secX').attributes].map(a => a.name) };
    window.__presence = []; await window.collabSync.tick();
    const off = { has: !!document.querySelector('#collab-presence-layer .collab-presence-box') };
    window.collabSync.stop();
    return { on, off };
  });
  expect(r.on.has, '편집 중 섹션에 표시가 없다').toBe(true);
  expect(r.on.forSec).toBe('secX');
  expect(r.on.aligned, '표시가 섹션 자리와 안 맞는다').toBe(true);
  expect(r.on.title).toBe('a@x.com — 1번째 섹션 편집 중');
  expect(r.on.secAttrs, '섹션 DOM 에 표시를 넣었다(저장본에 섞인다)').toEqual(['class', 'id']);
  expect(r.off.has, '상대가 떠났는데 표시가 남았다').toBe(false);
});
