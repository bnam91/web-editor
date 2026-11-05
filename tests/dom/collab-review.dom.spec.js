/* 협업 독립 리뷰 항목 — 코드 추적 값을 장면으로 잰다. 앱 값(진짜 switchTab·큰 프로젝트)은 회신에 있다.
 * 하네스: bootApp + 가짜 electronAPI(서버는 sinceSeq 뒤·내 actorId 뺀 패치만 준다 — api/_lib/collab-handlers/pull.js c1535b2). 앱·서버 0.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

async function boot(page) {
  await bootApp(page);
  await page.evaluate((PNG) => {
    const M = window.marketMerge;
    window.__txt = (id, t, n = 1) => `<div class="section-block" id="${id}" data-section="${n}"><div class="section-hitzone"></div><div class="section-inner"><div class="tb">${t}</div></div></div>`;   // 앱이 틀을 붙인 꼴 — 보낸 쪽 글도 이 꼴이다
    window.__img = (id, pid, f = 'a.png') => `<div class="section-block" id="${id}"><div class="section-inner"><div data-img-src="goya-asset://${pid}/${f}"></div></div></div>`;
    window.__hash = (h) => M.hash(M.normSection(new DOMParser().parseFromString(h, 'text/html').querySelector('.section-block')));
    Object.assign(window, { __log: [], __pushes: [], __reads: [], __seqCalls: [], __errs: [], __seq: 5, __gate: {}, __pushGate: null, __files: { 'proj_a/a.png': PNG, 'proj_a/b.png': PNG + 'BB', 'proj_a/c.png': PNG + 'CC' } });
    window.addEventListener('unhandledrejection', (e) => window.__errs.push(String(e.reason)));
    window.saveProjectToFile = async () => ({ ok: true });
    window.electronAPI = Object.assign({}, window.electronAPI, {
      assetsReadAsDataUri: async ({ projectId, filename }) => {
        const k = projectId + '/' + filename; window.__reads.push(k);
        if (window.__gate[k]) await window.__gate[k];
        return window.__files[k] ? { ok: true, dataUri: window.__files[k] } : { ok: false, error: 'not found' };
      },
      collab: {
        ref: async () => ({ ok: true, ref: window.__ref || { collabId: 'cb_t', seq: 5, role: 'member' } }),
        pull: async (q) => ({ ok: true, seq: window.__seq, serverSeq: window.__seq, patches: window.__log.filter(p => p.seq > q.sinceSeq && p.actorId !== q.actorId), presence: [], sections: window.__sections || [] }),
        push: async (q) => {
          if (window.__pushGate) await window.__pushGate;
          const p = q.patches[0]; const seq = ++window.__seq;
          window.__log.push({ ...p, seq }); window.__pushes.push({ room: q.collabId, sectionId: p.sectionId, html: p.html, seq });
          return { ok: true, seq, accepted: [{ sectionId: p.sectionId, seq }], conflicts: [] };
        },
        seq: async (p) => { window.__seqCalls.push(p); return { ok: true, seq: p.seq }; },
        invites: async () => ({ ok: true, invites: [], projects: [] }),
      },
    });
    window.COLLAB_ENABLED = true;
    window.__canvas = (h) => { document.getElementById('canvas').innerHTML = h; window.rebindAll({ preserveHistory: true }); };
    window.__other = (id, t, pageId = window.state.currentPageId, html = window.__txt(id, t)) => { const seq = ++window.__seq; window.__log.push({ pageId, sectionId: id, html, hash: window.__hash(html), actorId: 'other', seq, baseSeq: seq - 1 }); return seq; };
    window.__snap = (over) => (over ? JSON.stringify(over) : window.serializeProject());   // 진짜 자동저장이 쏘는 글
    window.__saved = (over) => new Promise((res) => { const off = window.collabSync.onEvent((e) => { if (e.type === 'pushed') { off(); res(); } }); window.dispatchEvent(new CustomEvent('gd:project-saved', { detail: { snap: window.__snap(over) } })); });
    window.__hold = (k) => { let open; window.__gate[k] = new Promise(r => { open = r; }); return () => { delete window.__gate[k]; open(); }; };
    window.__waitRead = async (k) => { while (!window.__reads.includes(k)) await new Promise(r => requestAnimationFrame(r)); };
  }, PNG);
}

test('T2 그림을 읽는 사이 상대 패치가 붙어도 옛 스냅샷의 그 섹션을 안 올린다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    window.__canvas(window.__img('secX', 'proj_a') + window.__txt('secY', 'Y0'));
    await window.collabSync.start('proj_a');
    const before = window.__pushes.length;
    window.__canvas(window.__img('secX', 'proj_a', 'b.png') + window.__txt('secY', 'Y0'));
    const release = window.__hold('proj_a/b.png');
    const snap = window.__snap();
    const done = window.__saved(JSON.parse(snap));
    await window.__waitRead('proj_a/b.png');
    window.__other('secY', '상대글');
    await window.collabSync.tick();
    release();
    await done;
    await window.collabSync.tick();
    return { pushed: window.__pushes.slice(before).map(p => p.sectionId), y: document.getElementById('secY').textContent };
  });
  expect(r.pushed, `옛 Y 를 되올렸다: ${r.pushed}`).toEqual(['secX']);
  expect(r.y).toBe('상대글');
});

test('T2b 캐시 길로 온 섹션이 원본 주소 그대로 나가지 않는다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    window.__canvas(window.__img('secX', 'proj_a') + window.__img('secZ', 'proj_a', 'b.png'));
    await window.collabSync.start('proj_a');
    window.__canvas(window.__img('secX', 'proj_a') + window.__img('secZ', 'proj_a', 'c.png'));
    const release = window.__hold('proj_a/c.png');
    const done = window.__saved();
    await window.__waitRead('proj_a/c.png');
    window.__other('secX', '상대글');
    await window.collabSync.tick();
    release();
    await done;
    return window.__pushes.filter(p => p.html.includes('goya-asset://')).map(p => p.sectionId);
  });
  expect(r, '주소가 그대로 나갔다').toEqual([]);
});

test('T3 보류 패치가 진도를 묶어도, 재시작 때 이미 받은 섹션을 내 편집으로 올리지 않는다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    window.__canvas(window.__txt('secD', 'D0') + window.__txt('secS', 'S0', 2));   // data-section 은 자리 번호다 — 앱이 다시 매긴다
    await window.collabSync.start('proj_a');
    await window.collabSync.tick();
    document.querySelector('#secD .tb').classList.add('selected');
    window.__other('secD', '', undefined, window.collabSync._internals.collectSections(JSON.parse(window.serializeProject())).find(x => x.sectionId === 'secD').html.replace('D0', 'D1'));   // 보류
    window.__other('secS', '', undefined, window.collabSync._internals.collectSections(JSON.parse(window.serializeProject())).find(x => x.sectionId === 'secS').html.replace('S0', 'S1'));   // 붙고 저장된다
    await window.collabSync.tick();
    await new Promise(res => requestAnimationFrame(res));   // tick 이 건 저장이 끝나게
    await window.collabSync._internals.settleReceived(true);
    window.collabSync._internals.flushSeq();
    await Promise.resolve();
    const last = window.__seqCalls.at(-1);
    const seqBefore = window.__pushes.length;
    window.collabSync.stop();
    /* 재시작: 디스크의 진도·해시로. D 는 그대로 보류 전 판, S 는 받은 판 */
    document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected'));
    window.__ref = { collabId: 'cb_t', seq: last.seq, role: 'member', hashes: last.hashes };
    await window.collabSync.start('proj_a');
    return { pushed: window.__pushes.slice(seqBefore).map(p => p.sectionId), d: document.querySelector('#secD').textContent, s: document.querySelector('#secS').textContent };
  });
  expect(r.pushed, `받은 섹션을 올렸다: ${r.pushed}`).toEqual([]);
  expect(r.d, '보류했던 패치는 다시 받아 붙는다').toBe('D1');
  expect(r.s).toBe('S1');
});

test('T4 보류가 풀려 붙은 패치를 내 편집으로 안 본다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    window.__canvas(window.__txt('secD', 'D0'));
    await window.collabSync.start('proj_a');
    window.__other('secD', '', undefined, window.collabSync._internals.collectSections(JSON.parse(window.serializeProject())).find(x => x.sectionId === 'secD').html.replace('D0', 'D1'));
    document.querySelector('#secD .tb').classList.add('selected');
    await window.collabSync.tick();
    document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected'));
    await window.collabSync.tick();
    const before = window.__pushes.length;
    document.getElementById('canvas').insertAdjacentHTML('beforeend', window.__txt('secN', 'N0'));
    await window.__saved();
    return { text: document.querySelector('#secD').textContent, pushed: window.__pushes.slice(before).map(p => p.sectionId) };
  });
  expect(r.text).toBe('D1');
  expect(r.pushed, `붙인 패치를 되올렸다: ${r.pushed}`).toEqual(['secN']);
});

test('T5 다른 페이지 섹션도 내가 더 새 판을 올렸으면 옛 상대 패치로 안 바꾼다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const cur = window.state.currentPageId;
    window.state.pages = [{ id: cur, canvas: '' }, { id: 'pg2', canvas: window.__txt('secP', 'P0') }];
    window.__canvas(window.__txt('secC', 'C0'));
    const snap = () => ({ pages: [{ id: cur, canvas: document.getElementById('canvas').innerHTML }, { id: 'pg2', canvas: window.state.pages[1].canvas }] });
    await window.collabSync.start('proj_a');
    /* 상대가 먼저 올렸는데 내가 아직 안 받은 채 내 판을 올린다 */
    await window.collabSync.tick();
    const other = window.__other('secP', '상대옛글', 'pg2');
    window.state.pages[1].canvas = window.__txt('secP', '내새글');
    await window.__saved(snap());
    await window.collabSync.tick();
    return { other, text: window.state.pages[1].canvas, conflicts: window.collabSync.conflicts().length };
  });
  expect(r.text, '내 새 판이 옛 패치로 조용히 바뀌었다').toContain('내새글');
  expect(r.conflicts, '상대 판을 충돌로 남긴다').toBe(1);
});

test('T6 잘못된 주소(%E0%A4%A)가 있어도 push 가 멈추지 않는다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    window.__canvas(window.__img('secX', 'proj_a', '%E0%A4%A') + window.__txt('secY', 'Y0'));
    await window.collabSync.start('proj_a').catch((e) => window.__errs.push(String(e)));
    return { pushed: window.__pushes.map(p => p.sectionId), errs: window.__errs };
  });
  expect(r.errs, `예외: ${r.errs}`).toEqual([]);
  expect(r.pushed).toContain('secY');
});

test('T8 push 루프 중 방이 바뀌면 남은 섹션을 새 방에 안 보낸다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    window.__canvas(window.__txt('secX', 'X0') + window.__txt('secY', 'Y0'));
    let open; window.__pushGate = new Promise(res => { open = res; });
    const first = window.collabSync.start('proj_a');
    while (!window.collabSync.isActive()) await new Promise(res => requestAnimationFrame(res));
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    window.collabSync.stop();
    window.__ref = { collabId: 'cb_next', seq: 5, role: 'member' };
    window.__sections = [];
    const second = window.collabSync.start('proj_b');
    open(); window.__pushGate = null;
    await first.catch(() => {}); await second.catch(() => {});
    return window.__pushes.map(p => p.room + ':' + p.sectionId);
  });
  expect(r.filter(x => x.startsWith('cb_next:')), `앞 방 섹션이 새 방으로 갔다: ${r}`).toEqual([]);
  expect(r.filter(x => x.startsWith('cb_t:')).length, `앞 방 루프가 멈추지 않았다: ${r}`).toBeLessThanOrEqual(1);
});

test('T11 이 프로젝트 자기 주소만 읽는다 — 다른 프로젝트 그림을 방에 안 올린다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    window.__files['proj_secret/s.png'] = window.__files['proj_a/a.png'];
    window.__canvas(window.__img('secX', 'proj_secret', 's.png') + window.__img('secO', 'proj_a'));
    await window.collabSync.start('proj_a');
    return { reads: window.__reads, x: window.__pushes.find(p => p.sectionId === 'secX')?.html, o: window.__pushes.find(p => p.sectionId === 'secO')?.html };
  });
  expect(r.reads, '다른 프로젝트 파일을 읽었다').not.toContain('proj_secret/s.png');
  expect(r.x).toContain('goya-asset://proj_secret/s.png');
  expect(r.o, '★양성: 자기 주소는 읽어 보낸다').toContain('data:image/png');
});

test('T1 탭이 바뀌면 안 받고 안 붙이고 진도를 안 올린다 — 돌아오면 받는다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    window.__canvas(window.__txt('secP', 'P0'));
    await window.collabSync.start('proj_a');
    await window.collabSync.tick();
    const seq0 = window.collabSync.status().seq;
    const real = Object.getOwnPropertyDescriptor(window, 'activeProjectId');
    let active = 'proj_q';
    Object.defineProperty(window, 'activeProjectId', { configurable: true, get: () => active, set: (v) => { active = v; } });
    window.__canvas(window.__txt('secQ', 'Q0'));
    const n = window.__other('secNew', '패치글');
    await window.collabSync.tick();
    const during = { text: document.getElementById('canvas').textContent, seq: window.collabSync.status().seq };
    active = 'proj_a';
    window.__canvas(window.__txt('secP', 'P0'));
    await window.collabSync.tick();
    const back = { has: !!document.getElementById('secNew'), seq: window.collabSync.status().seq };
    if (real) Object.defineProperty(window, 'activeProjectId', real);
    return { seq0, n, during, back };
  });
  expect(r.during.text, '패치가 다른 프로젝트 캔버스에 붙었다').not.toContain('패치글');
  expect(r.during.seq, '멈춘 사이 진도가 올랐다').toBe(r.seq0);
  expect(r.back.has, '돌아와서 못 받았다').toBe(true);
  expect(r.back.seq).toBe(r.n);
});

test('T1b 못 쓴 내용이 있는 채 탭이 바뀌면 되감아 돌아왔을 때 다시 받는다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    window.__canvas(window.__txt('secP', 'P0'));
    await window.collabSync.start('proj_a');
    await window.collabSync.tick();
    await window.collabSync._internals.settleReceived(true);
    window.saveProjectToFile = async () => ({ ok: false, reason: 'qa' });   // 못 쓴다
    window.__other('secNew', '못쓴글');
    await window.collabSync.tick();
    await Promise.resolve();
    const real = Object.getOwnPropertyDescriptor(window, 'activeProjectId');
    let active = 'proj_q';
    Object.defineProperty(window, 'activeProjectId', { configurable: true, get: () => active, set: (v) => { active = v; } });
    window.__canvas(window.__txt('secQ', 'Q0'));
    await window.collabSync.tick();
    active = 'proj_a';
    window.__canvas(window.__txt('secP', 'P0'));   // 파일에서 다시 읽힌 판
    window.saveProjectToFile = async () => ({ ok: true });
    await window.collabSync.tick();
    if (real) Object.defineProperty(window, 'activeProjectId', real);
    return { has: !!document.getElementById('secNew') };
  });
  expect(r.has, '화면과 함께 사라진 패치를 다시 못 받았다').toBe(true);
});

test('T2c 받기 전에 찍힌 저장 스냅샷이 받은 뒤 도착해도 옛 판을 안 올린다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    window.__canvas(window.__txt('secY', 'Y0') + window.__txt('secN', 'N0'));
    await window.collabSync.start('proj_a');
    const before = window.__pushes.length;
    window.__canvas(window.__txt('secY', 'Y0') + window.__txt('secN', 'N1'));
    const oldSnap = JSON.parse(window.__snap());
    window.__other('secY', '상대글');
    await window.collabSync.tick();
    await window.__saved(oldSnap);
    return { pushed: window.__pushes.slice(before).map(p => p.sectionId), y: document.getElementById('secY').textContent };
  });
  expect(r.pushed, `옛 Y 를 되올렸다: ${r.pushed}`).toEqual(['secN']);
  expect(r.y).toBe('상대글');
});

test('T3b 이미 서버와 같은 글은 진도·해시가 뒤처져도 안 올린다(종료 저장이 먼저 쓴 경우)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const html = window.__txt('secS', 'S1');
    window.__canvas(html);
    const key = window.state.currentPageId + '::secS';
    const local = window.collabSync._internals.collectSections({ pages: [{ id: window.state.currentPageId, canvas: html }] })[0].hash;
    window.__ref = { collabId: 'cb_t', seq: 5, role: 'member', hashes: { [key]: 'oldhash' } };
    window.__sections = [{ pageId: window.state.currentPageId, sectionId: 'secS', hash: local }];
    await window.collabSync.start('proj_a');
    return window.__pushes.map(p => p.sectionId);
  });
  expect(r, '서버와 같은 글을 올렸다').toEqual([]);
});

test('T7 받은 저장은 간격을 둔다 — 그 사이 진도는 안 오른다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    window.__canvas(window.__txt('secP', 'P0'));
    let saves = 0; window.saveProjectToFile = async () => { saves++; return { ok: true }; };
    await window.collabSync.start('proj_a');
    await window.collabSync.tick();
    window.__other('secA', 'A'); await window.collabSync.tick(); await window.collabSync._internals.settleReceived();
    const s1 = saves;
    const n2 = window.__other('secB', 'B'); await window.collabSync.tick(); await window.collabSync._internals.settleReceived(); window.collabSync._internals.flushSeq(); await Promise.resolve();
    const s2 = saves; const seqMid = window.__seqCalls.at(-1)?.seq;
    await window.collabSync._internals.settleReceived(true);
    return { s1, s2, s3: saves, seqMid, n2 };
  });
  expect(r.s1).toBe(1);
  expect(r.s2, '간격 안에 또 전체 저장을 했다').toBe(1);
  expect(r.seqMid ?? 0, '안 쓴 패치까지 진도가 올랐다').toBeLessThan(r.n2);
  expect(r.s3).toBe(2);
});

test('T7b 천장을 넘는 파일은 maxBytes 를 실어 물어 안 읽는다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const seen = []; const real = window.electronAPI.assetsReadAsDataUri;
    window.electronAPI.assetsReadAsDataUri = async (q) => { seen.push(q.maxBytes); return q.filename === 'big.mp4' ? { ok: false, tooBig: true, bytes: 50000000 } : real(q); };
    const ev = []; window.collabSync.onEvent(e => { if (e.type === 'section_too_large') ev.push(e); });
    window.__canvas(window.__img('secV', 'proj_a', 'big.mp4') + window.__txt('secT', 'T0'));
    await window.collabSync.start('proj_a');
    return { seen, ev: ev.map(e => ({ s: e.sectionId, b: e.detail.bytes })), pushed: window.__pushes.map(p => p.sectionId) };
  });
  expect(r.seen.every(n => n === 525000), `maxBytes: ${r.seen}`).toBe(true);
  expect(r.ev).toEqual([{ s: 'secV', b: 50000000 }]);
  expect(r.pushed).toEqual(['secT']);
});

test('T7c 525,001~700,000 바이트 파일도 base64 로 재서 안 보낸다 — 죽은 주소가 안 나간다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const real = window.electronAPI.assetsReadAsDataUri;
    window.electronAPI.assetsReadAsDataUri = async (q) => (q.filename === 'p600.png' ? { ok: false, tooBig: true, bytes: 600000 } : real(q));
    const ev = []; window.collabSync.onEvent(e => { if (e.type === 'section_too_large') ev.push(e); });
    window.__canvas(window.__img('secV', 'proj_a', 'p600.png') + window.__txt('secT', 'T0', 2));
    await window.collabSync.start('proj_a');
    return { ev: ev.map(e => ({ s: e.sectionId, b: e.detail.bytes })), pushed: window.__pushes.map(p => p.sectionId), goya: window.__pushes.filter(p => p.html.includes('goya-asset://')).length };
  });
  expect(r.goya, '죽은 주소가 나갔다').toBe(0);
  expect(r.ev).toEqual([{ s: 'secV', b: 800000 }]);
  expect(r.pushed, '★양성: 다른 섹션은 간다').toEqual(['secT']);
});

/* 받은 패치가 저장 대기 중일 때 탭을 옮기는 장면. edit=true 면 그 섹션을 고쳐 탭 전환 저장에 실려 돌아온다 */
async function rewindScene(page, edit) {
  return page.evaluate(async (edit) => {
    window.__canvas(window.__txt('secP', 'P0'));
    await window.collabSync.start('proj_a');
    await window.collabSync.tick();
    await window.collabSync._internals.settleReceived(true);
    await new Promise(res => requestAnimationFrame(res));
    window.saveProjectToFile = async () => ({ ok: false, reason: 'qa' });
    const cur = window.state.currentPageId;
    const wire = window.collabSync._internals.collectSections(JSON.parse(window.serializeProject())).find(x => x.sectionId === 'secP').html;
    window.__other('secP', '', cur, wire.replace('P0', '받은글'));
    await window.collabSync.tick();
    await new Promise(res => requestAnimationFrame(res));
    const onScreen = document.querySelector('#secP .tb').textContent;
    const real = Object.getOwnPropertyDescriptor(window, 'activeProjectId');
    let active = 'proj_q';
    Object.defineProperty(window, 'activeProjectId', { configurable: true, get: () => active, set: (v) => { active = v; } });
    window.__canvas(window.__txt('secQ', 'Q0'));
    await window.collabSync.tick();
    active = 'proj_a';
    /* 돌아온 판 — 고쳤으면 탭 전환 저장에 실린 내 글, 아니면 파일의 옛 판 */
    window.__canvas(window.__txt('secP', edit ? '받은글+내편집' : 'P0'));
    window.saveProjectToFile = async () => ({ ok: true });
    const before = window.__pushes.length;
    await window.collabSync.tick();
    await new Promise(res => requestAnimationFrame(res));
    const text = document.querySelector('#secP .tb').textContent;
    await window.collabSync.tick();
    window.dispatchEvent(new CustomEvent('gd:project-saved', { detail: { snap: window.serializeProject() } }));
    for (let i = 0; i < 10; i++) await new Promise(res => requestAnimationFrame(res));
    if (real) Object.defineProperty(window, 'activeProjectId', real);
    return { onScreen, text, pushed: window.__pushes.slice(before).map(p => /받은글\+내편집|받은글|P0/.exec(p.html)?.[0]) };
  }, edit);
}

test('T1c 저장 대기 중 받은 섹션을 고치고 탭을 옮겨도 돌아와 내 편집이 안 덮인다 · 내 편집은 올라간다', async ({ page }) => {
  await boot(page);
  const r = await rewindScene(page, true);
  expect(r.onScreen, '★전제: 받은 글이 붙었다').toBe('받은글');
  expect(r.text, '다시 받은 패치가 내 편집을 덮었다').toBe('받은글+내편집');
  expect(r.pushed).toEqual(['받은글+내편집']);
});

test('T1d 양성: 안 고쳤으면 화면과 함께 사라진 패치를 돌아와 다시 붙인다', async ({ page }) => {
  await boot(page);
  const r = await rewindScene(page, false);
  expect(r.text, '사라진 패치를 다시 못 받았다').toBe('받은글');
  expect(r.pushed, '되올리지 않는다').toEqual([]);
});

test('T11b 붙여넣어 옮긴 다른 프로젝트 그림은 첫 저장에도 풀어 보낸다 — 안 옮긴 주소는 그대로 안 읽는다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const X = await import(new URL('js/io/asset-externalize.js', location.href).href);
    window.__files['proj_other/x.png'] = window.__files['proj_a/a.png'];
    window.__files['proj_a/moved.png'] = window.__files['proj_a/a.png'];
    window.electronAPI.assetsSaveCanvasImage = async () => ({ ok: true, url: 'goya-asset://proj_a/moved.png' });
    const html = window.__img('secX', 'proj_other', 'x.png');
    window.__canvas(html + window.__img('secS', 'proj_secret', 's.png'));
    /* 자동저장 스냅샷은 옮기기 전 주소다. 저장 길이 옮긴 뒤 push 가 돈다 */
    const snap = window.serializeProject();
    await X.adoptForeignAssets({ pages: [{ canvas: html }] }, 'proj_a');
    window.__reads.length = 0;
    await window.collabSync.start('proj_a');
    const before = window.__pushes.length;
    const x = window.__pushes.find(p => p.sectionId === 'secX')?.html;
    return { x, reads: [...window.__reads], s: window.__pushes.find(p => p.sectionId === 'secS')?.html, same: !!X.applyAdoptedAssets, before };
  });
  expect(r.x, '옛 주소가 나갔다').not.toContain('goya-asset://');
  expect(r.x).toContain('data:image/png');
  expect(r.reads, '다른 프로젝트 파일을 읽었다').not.toContain('proj_other/x.png');
  expect(r.s, '★양성: 안 옮긴 주소는 그대로').toContain('goya-asset://proj_secret/s.png');
});

test('T12 받은 글의 on* 을 세척하고 붙인다 — onerror 가 안 돈다 · 다른 페이지 갈래도', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const cur = window.state.currentPageId;
    window.state.pages = [{ id: cur, canvas: '' }, { id: 'pg2', canvas: '' }];
    window.__canvas(window.__txt('secP', 'P0'));
    await window.collabSync.start('proj_a');
    window.__pwn = 0;
    const bad = (id) => `<div class="section-block" id="${id}"><div class="section-inner"><img src="x:broken" onerror="window.__pwn++"><div id="${id}_d" onclick="1">글</div></div></div>`;
    window.__other('secX', '', cur, bad('secX'));
    window.__other('secZ', '', 'pg2', bad('secZ'));
    await window.collabSync.tick();
    await new Promise(res => { const i = document.querySelector('#secX img'); if (!i || i.complete) res(); i?.addEventListener('error', res, { once: true }); });
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    return { pwn: window.__pwn, attrs: document.getElementById('secX').outerHTML.match(/\son\w+=/g), other: /\son\w+=/.test(window.state.pages[1].canvas), text: document.getElementById('secX').textContent };
  });
  expect(r.pwn, 'onerror 가 돌았다').toBe(0);
  expect(r.attrs).toBeNull();
  expect(r.other).toBe(false);
  expect(r.text, '★양성: 글은 붙었다').toContain('글');
});
