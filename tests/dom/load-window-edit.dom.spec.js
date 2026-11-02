/* load-window-edit — 로드 적용 뒤 억제가 풀리기 전 창에 넣은 편집을 버리지 않는다
 * 왜: 화면엔 섹션이 있는데 저장 예약이 안 돼 5초를 기다려도 디스크에 없었고 ⌘R·창 닫기로 사라졌다(앱 ×3 · 큰 판·작은 판 · 다음 편집이나 ⌘Q 로만 살았다).
 * 칸: W1 창 안 섹션 추가 = 미저장이 서고 억제가 풀리면 저장본에 든다 · W2 [음성] 창 안 편집 없음 = 미저장 안 선다(무편집 재기록 금지 · 345)
 *     W3 [음성] 적용 전 넣은 것은 그대로 사라진다(phase loading · 363 은 현빈 결정 대기) · W4 [음성] 창 뒤 편집은 평소대로 저장
 *     W5 창 안 글자 입력(스택 안 오름 · input 이벤트) · W6 창 안 끌기(억제 이유 둘이 겹침)
 * 변이: 창 고침만 되돌리면 W1·W5·W6 빨강 · W2·W3·W4 초록 | 스택 가름을 빼 창 안 변경을 다 편집으로 치면 W2 빨강 | input 가름만 빼면 W5 빨강 | 겹침 허용만 빼면 W6 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, ORIGIN } = require('./_root-harness.js');

const KEY = 'web-editor-autosave';
const released = (page) => page.waitForFunction(() => window.state._suppressAutoSave === false);
const saved = (page, id) => page.evaluate(([k, id]) => Object.keys(localStorage).some((x) => x.startsWith(k) && !x.endsWith('_ts') && (localStorage.getItem(x) || '').includes(id)), [KEY, id]);

async function setup(page) {
  const errs = await bootApp(page);
  await page.goto(`${ORIGIN}/index.html?project=proj_1700000000777`);   // 프로젝트 id 가 있어야 자동저장이 돈다
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.addSection === 'function' && document.readyState === 'complete', null, { timeout: 20000 });
  await page.evaluate(() => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); window.addSection(); });
  await page.waitForFunction(() => !window.hasUnsavedChanges(), null, { timeout: 15000 });   // 장면을 만든 저장이 끝나기를 기다린다
  return errs;
}
/* 진짜 적용 길 — 적용 직후 같은 틱에 fn 을 돌린다. 그때 억제가 켜져 있어야 이 창을 잰 것이다. */
const applyThen = (page, withEdit) => page.evaluate((withEdit) => {
  const snap = JSON.parse(window.serializeProject());
  window.applyProjectData(snap);
  const inWindow = window.state._suppressAutoSave === true;
  const before = new Set([...document.querySelectorAll('#canvas .section-block')].map((s) => s.id));
  if (withEdit) window.addSection();
  // 편집 아닌 변경 = 로드가 늦게 하는 일의 꼴(⌘Z 스택은 그대로)
  else document.querySelector('#canvas .section-block').setAttribute('data-load-residual', '1');
  const id = [...document.querySelectorAll('#canvas .section-block')].map((s) => s.id).find((x) => !before.has(x)) || null;
  return { inWindow, id };
}, withEdit);

test('W1 창 안 섹션 추가 — 미저장이 서고, 억제가 풀리면 저장본에 든다', async ({ page }) => {
  const errs = await setup(page);
  const r = await applyThen(page, true);
  expect(r.inWindow, '[전제] 창 안이다').toBe(true);
  expect(r.id, '[전제] 섹션이 들어갔다').toBeTruthy();
  await page.evaluate(() => new Promise((res) => queueMicrotask(res)));
  expect(await page.evaluate(() => window.hasUnsavedChanges()), '★창 안 편집인데 미저장이 안 선다 — 그대로 닫으면 사라진다').toBe(true);
  await released(page);
  await expect.poll(() => saved(page, r.id), { message: '★창 안 편집이 저장본에 안 들었다', timeout: 15000 }).toBe(true);
  expect(errs).toEqual([]);
});

test('W2 [음성] 창 안 편집 없음 — 미저장이 안 선다(무편집 재기록 금지)', async ({ page }) => {
  const errs = await setup(page);
  await page.waitForFunction(() => window.hasUnsavedChanges() === false, null, { timeout: 15000 });
  const r = await applyThen(page, false);
  expect(r.inWindow, '[전제] 창 안이다').toBe(true);
  await released(page);
  await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
  expect(await page.evaluate(() => window.hasUnsavedChanges()), '★로드 자신의 변경이 편집으로 잡혔다').toBe(false);
  expect(await page.evaluate(() => window.__dragEditStateForTest().pending), '★저장을 기다리고 있다').toBe(false);
  expect(errs).toEqual([]);
});

test('W3 [음성] 적용 «전» 넣은 것은 적용이 지운다(363 · 안 건드린다)', async ({ page }) => {
  const errs = await setup(page);
  const id = await page.evaluate(() => {
    const snap = JSON.parse(window.serializeProject());
    const before = new Set([...document.querySelectorAll('#canvas .section-block')].map((s) => s.id));
    window.addSection();
    const id = [...document.querySelectorAll('#canvas .section-block')].map((s) => s.id).find((x) => !before.has(x));
    window.applyProjectData(snap);
    return id;
  });
  await released(page);
  expect(await page.evaluate((id) => !!document.getElementById(id), id), '★363 동작이 바뀌었다').toBe(false);
  expect(errs).toEqual([]);
});

test('W4 [음성] 창 뒤 편집은 평소대로 저장된다', async ({ page }) => {
  const errs = await setup(page);
  await applyThen(page, false);
  await released(page);
  const id = await page.evaluate(() => { const b = new Set([...document.querySelectorAll('#canvas .section-block')].map((s) => s.id)); window.addSection(); return [...document.querySelectorAll('#canvas .section-block')].map((s) => s.id).find((x) => !b.has(x)); });
  await expect.poll(() => saved(page, id), { timeout: 15000 }).toBe(true);
  expect(errs).toEqual([]);
});

test('W5 창 안 글자 입력 — 스택이 안 올라도 미저장이 서고 저장본에 든다', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { window.selectSection?.(document.querySelector('#canvas .section-block')); window.addTextBlock('h2'); });
  await page.waitForFunction(() => !window.hasUnsavedChanges(), null, { timeout: 15000 });
  const r = await page.evaluate(() => {
    window.applyProjectData(JSON.parse(window.serializeProject()));
    const inWindow = window.state._suppressAutoSave === true;
    const before = window.historyPos;
    const el = document.querySelector('#canvas .text-block [class^="tb-"]');
    el.textContent = '창안글자W5';
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    return { inWindow, same: window.historyPos === before };
  });
  expect(r.inWindow, '[전제] 창 안이다').toBe(true);
  expect(r.same, '[전제] 스택이 안 올랐다').toBe(true);
  await page.evaluate(() => new Promise((res) => setTimeout(res, 0)));
  expect(await page.evaluate(() => window.hasUnsavedChanges()), '★창 안 글자가 저장 대상이 아니다').toBe(true);
  await released(page);
  await expect.poll(() => saved(page, '창안글자W5'), { timeout: 15000 }).toBe(true);
  expect(errs).toEqual([]);
});

test('W6 창 안 끌기 — 끌기 창이 겹쳐도 옮긴 순서가 저장본에 든다', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { window.addSection(); });
  await page.waitForFunction(() => !window.hasUnsavedChanges(), null, { timeout: 15000 });
  const r = await page.evaluate(() => {
    window.applyProjectData(JSON.parse(window.serializeProject()));
    const inWindow = window.state._suppressAutoSave === true;
    const a = [...document.querySelectorAll('#canvas .section-block')];
    const tok = window.AutoSaveSuppress.begin('section-drag');
    a[0].before(a[1]);
    window.pushHistory('섹션 이동');
    window.AutoSaveSuppress.end(tok);
    return { inWindow, first: a[1].id };
  });
  expect(r.inWindow, '[전제] 창 안이다').toBe(true);
  await page.evaluate(() => new Promise((res) => setTimeout(res, 0)));
  expect(await page.evaluate(() => window.hasUnsavedChanges()), '★창 안 끌기가 저장 대상이 아니다').toBe(true);
  await released(page);
  await expect.poll(() => page.evaluate(([k, id]) => { const key = Object.keys(localStorage).find((x) => x.startsWith(k) && !x.endsWith('_ts')); const v = key && localStorage.getItem(key); return !!v && /id=\\?"(sec_[^"\\]+)/.exec(v)?.[1] === id; }, [KEY, r.first]), { timeout: 15000 }).toBe(true);
  expect(errs).toEqual([]);
});
