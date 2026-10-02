/* meta-race.dom.spec.js — 프로젝트 meta 저장 경합(현빈 승인 2026-10-02 · 설계 PLAN-20261002-meta-race-qa-hidden.md ①)
 * main.js save-meta 는 이미 받는 순간 { ...cur, ...metaData } 로 원자 합친다(132c2b75). 남은 병 = 렌더러가 «미리 읽은 meta 전체 + 자기 필드»를
 *   통째로 보내 main 이 «옛 사본»의 다른 필드로 그사이 갱신된 값을 되돌리는 것. 처방 = 각자 자기 필드만(patch).
 * 가짜 IPC = tests/dom/_fake-meta.js(의미는 unit meta-fake-semantics 가 main.js 와 소스 대조로 잠금).
 *   ★__interleave: writer 가 load 로 «찍은 직후» 다른 필드를 바꾼다 → 경합을 우연이 아니라 매번 일으킨다.
 * 짝(설계 a~f) — 각 시험 = 「writer X 가 쓰는 동안 바뀐 다른 필드가 X 의 쓰기 뒤에도 살아 있다」.
 *   a design-system(컬러 변수·최근 색) · b branch 37 · c commit 401(파일에서 커밋 복원) · d commit 260 doCommit(★닿지 않는 코드 — 영향 0, 그래도 잰다)
 *   e save-load 400 쉴 때 썸네일 · f save-load 265 저장 때 썸네일.  (g save-load 2063 · h collab 104 = 이미 자기 필드만 → 경합 없음, 안 잼)
 * ⚠️못 재는 축: 진짜 파일·main 핸들러(가짜 IPC) — main 의 합치기는 소스 대조로만.
 * ★«아직 안 고친» 짝은 KNOWN_RACE 에 이름이 있다 → test.fail(알려진 결함, 레포의 E4 와 같은 꼴). 고치는 커밋에서 그 이름을 «뺀다»
 *   ⇒ 빨강→초록이 커밋 단위로 남고, 실수로 미리 고쳐지면(test.fail 이 통과하면) 그것도 빨강으로 드러난다.
 *   핀 7699ea33·고치기 전 HEAD 실측: Ma Mb Mc Md Me Mf 전부 빨강(경합 재현). */
const KNOWN_RACE = new Set(['Me', 'Mf']);   // Ma·Md·Mc·Mb 고침 — patch-only
const raceTest = (id, title, fn) => test(`${id} ${title}`, async ({ page }, info) => {
  if (KNOWN_RACE.has(id)) test.fail(true, `${id} — 아직 안 고친 경합(알려진 결함). 고치는 커밋에서 KNOWN_RACE 에서 뺀다`);
  await fn({ page }, info);
});
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { INSTALL_FAKE_META_SRC } = require('./_fake-meta.js');

async function setup(page, seed) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate(([src, seed]) => {
    (new Function(src))();
    window.activeProjectId = 'pA';
    window.__meta.pA = seed;
  }, [INSTALL_FAKE_META_SRC, seed]);
}
/* writer 를 부르고(그 안의 load 가 찍은 «직후» other 패치를 끼워 넣음), 다 쓸 때까지 기다린 뒤 meta 를 돌려준다 */
/* ★고친 writer 는 meta 를 «아예 읽지 않는다»(patch-only) → 끼어들 «읽는 순간»이 없다. 그 경우 noRead=true 로 표시하고
   다른 필드를 «그 뒤»에 써서 두 필드가 다 남는지(= main 합치기가 서로를 안 지움)를 잰다. 읽지 않는 writer 는 옛 사본이 없어 되돌릴 수 없다. */
async function race(page, { other, run, waitMs = 600 }) {
  return page.evaluate(async ([other, run, waitMs]) => {
    window.__interleave = () => window.__fakeSaveMeta('pA', other);
    const loads0 = window.__metaLoads;
    await (new Function('return (async () => {' + run + '})()'))();
    await new Promise(r => setTimeout(r, waitMs));
    const interleaved = window.__interleave === null;
    let noRead = false;
    const loadCalls = window.__metaLoads - loads0;
    if (!interleaved) { window.__interleave = null; noRead = true; window.__fakeSaveMeta('pA', other); }
    return { meta: window.__meta.pA, interleaved, noRead, loadCalls };
  }, [other, run, waitMs]);
}

raceTest('Ma', '★컬러 변수 저장(design-system)이 그사이 바뀐 썸네일을 되돌리지 않는다', async ({ page }) => {
  await setup(page, { thumbnail: 'T1' });
  const r = await race(page, { other: { thumbnail: 'T2' }, run: "window.DesignSystem.setColorVar('raceVar', '#123456');" });
  expect(r.interleaved || r.noRead, '전제 — 끼어들기가 일어났거나(읽는 writer) writer 가 meta 를 아예 안 읽었다(patch-only)').toBe(true);
  if (r.noRead) expect(r.loadCalls, '★«안 읽는다»를 수로 — writer 가 meta load 를 0회 불렀다(가짜가 죽어 끼어들기를 못 만든 것과 구별)').toBe(0);
  expect(r.meta.colorVars?.raceVar).toBe('#123456');
  expect(r.meta.thumbnail).toBe('T2');
});
raceTest('Mb', '★브랜치 저장(branch-system 37)이 그사이 바뀐 컬러 변수를 되돌리지 않는다', async ({ page }) => {
  await setup(page, { colorVars: { a: '#000001' } });
  const r = await race(page, { other: { colorVars: { a: '#000002' } }, run: "window.saveBranchStore({ current: 'dev', branches: { main: {}, dev: {} } });" });
  expect(r.interleaved || r.noRead, '전제 — 끼어들기 또는 patch-only').toBe(true);
  if (r.noRead) expect(r.loadCalls, '★«안 읽는다»를 수로 — writer 가 meta load 를 0회 불렀다(가짜가 죽어 끼어들기를 못 만든 것과 구별)').toBe(0);
  expect(r.meta.currentBranch).toBe('dev');
  expect(r.meta.colorVars).toEqual({ a: '#000002' });
});
raceTest('Mc', '★파일에서 커밋 복원(commit-system 401)이 그사이 바뀐 썸네일을 되돌리지 않는다', async ({ page }) => {
  await setup(page, { thumbnail: 'T1' });
  const r = await race(page, { other: { thumbnail: 'T2' }, waitMs: 1500, run: `
    const data = { version: 2, currentPageId: 'page_1', pages: [{ id: 'page_1', name: 'Page 1', label: '', pageSettings: {}, canvas: '' }], commits: [{ id: 'c1', message: 'm', timestamp: '2026-10-02T00:00:00Z', branch: 'dev', snapshot: {} }] };
    const file = new File([JSON.stringify(data)], 'p.json', { type: 'application/json' });
    window.loadProjectFile({ target: { files: [file], value: '' } });` });
  expect(r.interleaved || r.noRead, '전제 — 끼어들기 또는 patch-only').toBe(true);
  if (r.noRead) expect(r.loadCalls, '★«안 읽는다»를 수로 — writer 가 meta load 를 0회 불렀다(가짜가 죽어 끼어들기를 못 만든 것과 구별)').toBe(0);
  expect(r.meta.commits?.length, '커밋이 복원됐다').toBe(1);
  expect(r.meta.thumbnail).toBe('T2');
});
raceTest('Md', '★커밋 만들기(commit-system 260 doCommit — 닿지 않는 코드, 영향 0)도 그사이 바뀐 썸네일을 되돌리지 않는다', async ({ page }) => {
  await setup(page, { thumbnail: 'T1' });
  const r = await race(page, { other: { thumbnail: 'T2' }, run: `
    let i = document.getElementById('cm-msg-input'); if (!i) { i = document.createElement('input'); i.id = 'cm-msg-input'; document.body.appendChild(i); }
    i.value = 'race';
    await window.doCommit();` });
  expect(r.interleaved || r.noRead, '전제 — 끼어들기 또는 patch-only').toBe(true);
  if (r.noRead) expect(r.loadCalls, '★«안 읽는다»를 수로 — writer 가 meta load 를 0회 불렀다(가짜가 죽어 끼어들기를 못 만든 것과 구별)').toBe(0);
  expect(r.meta.commits?.length).toBe(1);
  expect(r.meta.thumbnail).toBe('T2');
});
raceTest('Me', '★편집이 멈출 때 썸네일(save-load 400)이 그사이 바뀐 컬러 변수를 되돌리지 않는다 — 진짜 길(scheduleIdleThumbnail → 8초 → 캡처)', async ({ page }) => {
  test.setTimeout(60000);
  await setup(page, { colorVars: { a: '#000001' } });
  const r = await race(page, { other: { colorVars: { a: '#000002' } }, waitMs: 14000, run: `
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sE" data-section="1"><div class="section-inner"><div class="gap-block" data-type="gap" style="height:120px"></div></div></div>');
    window.scheduleIdleThumbnail();` });
  expect(r.interleaved || r.noRead, '전제 — 끼어들기(쉴 때 썸네일 meta 줄까지 갔다) 또는 patch-only').toBe(true);
  if (r.noRead) expect(r.loadCalls, '★«안 읽는다»를 수로 — writer 가 meta load 를 0회 불렀다(가짜가 죽어 끼어들기를 못 만든 것과 구별)').toBe(0);
  expect(typeof r.meta.thumbnail, '썸네일이 찍혀 실렸다').toBe('string');
  expect(r.meta.colorVars).toEqual({ a: '#000002' });
});
raceTest('Mf', '★저장 때 썸네일(save-load 265)이 그사이 바뀐 컬러 변수를 되돌리지 않는다', async ({ page }) => {
  await setup(page, { colorVars: { a: '#000001' } });
  /* 빈 캔버스면 저장을 건너뛰므로(empty_canvas_skipped) 섹션 하나 — 첫 판이 썸네일 줄까지 못 간 까닭은 «이것 하나»였다.
     (⚠️처음엔 「activeProjectId 가 모듈 변수라서」로 잘못 읽었다 — window.activeProjectId 는 그 변수의 접근자다. projectId 는 넘겨도 무해.)
     썸네일은 인자가 아니라 captureThumbnail() 이 직접 찍는다(html2canvas). */
  const r = await race(page, { other: { colorVars: { a: '#000002' } }, waitMs: 1500, run: `
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sF" data-section="1"><div class="section-inner"><div class="gap-block" data-type="gap" style="height:120px"></div></div></div>');
    window.__saveRes = await window.saveProjectToFile(window.serializeProject(), { projectId: 'pA' });` });
  expect(r.interleaved || r.noRead, '전제 — 끼어들기(썸네일 meta 줄까지 갔다) 또는 patch-only').toBe(true);
  if (r.noRead) expect(r.loadCalls, '★«안 읽는다»를 수로 — writer 가 meta load 를 0회 불렀다(가짜가 죽어 끼어들기를 못 만든 것과 구별)').toBe(0);
  expect(typeof r.meta.thumbnail, '썸네일이 찍혀 실렸다').toBe('string');
  expect(r.meta.colorVars).toEqual({ a: '#000002' });
});
