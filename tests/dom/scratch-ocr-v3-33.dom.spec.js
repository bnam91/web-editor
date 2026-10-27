/* scratch-ocr-v3-33.dom.spec.js — 시트 33 1020t2a1 AI OCR · 시안 v3(sian-14) 의 화면과 «이미지를 지우면 기록도»(현빈 Q9 261027)
 *
 * ★칸
 *   G  어드민 게이트(현빈 261027 「admin권한인 경우에만」) — 아니면 ✨ 숨김 · _scratchOcrOpen no-op · 어드민이면 보임
 *      (판정 정본 = js/feature-flags.js adminOnlyVisible · 상태는 window.__admin._forceState 로 만든다)
 *   T  ✨ → AI 패널 「글자 뽑기 (OCR)」만 켜짐 · 텍스트 생성·이미지 생성 disabled · 닫으면 탭이 풀린다
 *   O  글자 뽑기 → 기록이 «그 이미지» 항목 ocr 칸에 붙음 · 뱃지 「글 1」 · 다른 이미지를 고르면 0건
 *   Q9 기록 둘인 이미지를 ✕ → 메모리·IndexedDB 에서 이미지와 기록이 같이 사라짐 · 열린 패널이 「지워진 이미지」를 보인다
 *      ⌘Z(undo) → 이미지와 기록 둘이 같이 돌아온다(_scratchAddAndSaveFx 가 ocr 를 실어 나른다)
 * ★OCR 호출은 가짜로 바꿔 낀다(하네스엔 Electron 이 없다 · 외부 요청 0) — 모델 품질은 이 검사 밖이다.
 * ★양성대조(사본에서 · GD1001_ROOT): ⑴ 지우기 길의 _scratchOcrRetarget 호출을 걷으면 Q9 패널 단언이 빨강
 *   ⑵ _scratchAddAndSaveFx 의 ocr 인자를 걷으면 Q9 ⌘Z 단언이 빨강.
 *   ⑶ _scratchOcrOpen 의 어드민 가드를 걷으면 G 가 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function setup(page, { admin = true } = {}) {
  const errs = await bootApp(page);
  await page.evaluate(async ({ PNG, admin }) => {
    window.__admin._forceState(admin ? { ok: true, isAdmin: true } : { ok: true, isAdmin: false, hasRoleField: true });
    const base = window.electronAPI;
    window.__ocrCalls = 0;
    window.electronAPI = new Proxy({}, { get: (_t, k) => (k === 'aiOcrImage'
      ? async () => { window.__ocrCalls++; return { ok: true, text: '가짜 OCR 글', model: 'gemini-2.5-flash' }; }
      : base[k]) });
    window.__rawScratch = (key) => new Promise((res, rej) => { const o = indexedDB.open('ScratchPadDB');
      o.onsuccess = () => { const q = o.result.transaction('scratch', 'readonly').objectStore('scratch').get(key);
        q.onsuccess = () => { res(q.result || []); o.result.close(); }; q.onerror = () => rej(q.error); }; o.onerror = () => rej(o.error); });
    await window.initScratchPad('pO', 'pg1');
    await window._scratchAddAndSaveFx(PNG, 10, 10, 100, undefined, 'sA');
    await window._scratchAddAndSaveFx(PNG, 10, 200, 100, undefined, 'sB');
  }, { PNG, admin });
  return errs;
}
const tabState = (page) => page.evaluate(() => [...document.querySelectorAll('#aig-mode-tabs .aig-mode-tab')]
  .map(t => ({ tab: t.dataset.modeTab, disabled: t.disabled, active: t.classList.contains('active'), shown: getComputedStyle(t).display !== 'none' })));

test('G 어드민이 아니면 ✨ 숨김·안 열림 · 어드민이 되면 보임', async ({ page }) => {
  const errs = await setup(page, { admin: false });
  const look = () => page.evaluate(() => ({
    btn: getComputedStyle(document.querySelector('.scratch-item[data-scratch-id="sA"] .scratch-ai-btn')).display,
    on: document.body.classList.contains('scratch-ocr-on'),
  }));
  expect(await look(), 'G 일반 계정').toEqual({ btn: 'none', on: false });
  await page.evaluate(() => window._scratchOcrOpen('sA'));
  expect(await page.evaluate(() => document.getElementById('ai-prompt-overlay').style.display), 'G 일반 계정 — 코드로 불러도 안 열림').toBe('none');
  await page.evaluate(() => window.__admin._forceState({ ok: true, isAdmin: true }));
  expect(await look(), 'G 어드민').toEqual({ btn: 'flex', on: true });
  expect(errs).toEqual([]);
});

test('T ✨ → 글자 뽑기만 켜짐 · 나머지 기능 대기 · 닫으면 풀림', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => document.querySelector('.scratch-item[data-scratch-id="sA"] .scratch-ai-btn').click());
  expect(await tabState(page), 'T 열림').toEqual([
    { tab: 'text', disabled: true, active: false, shown: true },
    { tab: 'image', disabled: true, active: false, shown: true },
    { tab: 'ocr', disabled: false, active: true, shown: true },
  ]);
  expect(await page.evaluate(() => ({
    panel: document.getElementById('aig-ocr-panel').style.display,
    footer: document.querySelector('#ai-prompt-panel .ai-panel-footer').style.display,
    target: document.getElementById('ocr-target-id').textContent,
  })), 'T 패널').toEqual({ panel: '', footer: 'none', target: '#sA' });
  await page.evaluate(() => window.closeAiPrompt());
  expect((await tabState(page)).map(t => ({ tab: t.tab, disabled: t.disabled, shown: t.shown })), 'T 닫은 뒤').toEqual([
    { tab: 'text', disabled: false, shown: true },
    { tab: 'image', disabled: false, shown: true },
    { tab: 'ocr', disabled: false, shown: false },
  ]);
  expect(errs).toEqual([]);
});

test('O 글자 뽑기 → 그 이미지에 기록 · 뱃지 · 다른 이미지는 0건', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => window._scratchOcrOpen('sA'));
  await page.evaluate(() => document.getElementById('ocr-run-btn').click());
  await expect.poll(() => page.evaluate(() => (window._scratchItemById('sA').ocr || []).length), { message: 'O 기록 1' }).toBe(1);
  const r = await page.evaluate(() => {
    const a = window._scratchItemById('sA');
    const before = { count: document.getElementById('ocr-log-count').textContent, badge: a.el.querySelector('.scratch-ocr-badge').textContent, text: a.ocr[0].text, calls: window.__ocrCalls };
    window._scratchOcrRetarget('sB');
    return { ...before, otherCount: document.getElementById('ocr-log-count').textContent, otherBadgeShown: window._scratchItemById('sB').el.querySelector('.scratch-ocr-badge').style.display !== 'none' };
  });
  expect(r, 'O').toEqual({ count: '1', badge: '글 1', text: '가짜 OCR 글', calls: 1, otherCount: '0', otherBadgeShown: false });
  expect(errs).toEqual([]);
});

test('Q9 이미지를 지우면 기록도 같이 · ⌘Z 면 같이 돌아온다', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => {
    const a = window._scratchItemById('sA');
    a.ocr = [{ id: 'o1', n: 1, text: '첫 글', at: 1, model: 'gemini-2.5-flash', mode: 'text' }, { id: 'o2', n: 2, text: '둘째 글', at: 2, model: 'gemini-2.5-flash', mode: 'text' }];
    window._scratchOcrBadge('sA');
    window._scratchOcrOpen('sA');
  });
  await page.evaluate(() => window.flushScratchForSwitch().then(() => window.initScratchPad('pO', 'pg1')).then(() => window._scratchOcrOpen('sA')));
  expect(await page.evaluate(async () => (await window.__rawScratch('scratch-pad-pO-pg1')).find(x => x.id === 'sA')?.ocr?.map(r => r.id)), '전제: 저장본에 기록 둘').toEqual(['o1', 'o2']);

  await page.evaluate(() => document.querySelector('.scratch-item[data-scratch-id="sA"] .scratch-close').click());
  await expect.poll(() => page.evaluate(async () => !!(await window.__rawScratch('scratch-pad-pO-pg1')).find(x => x.id === 'sA')), { message: 'Q9 저장본에서 이미지(＝기록) 사라짐' }).toBe(false);
  expect(await page.evaluate(() => ({
    mem: !!window._scratchItemById('sA'),
    target: document.getElementById('ocr-target-id').textContent,
    count: document.getElementById('ocr-log-count').textContent,
    runDisabled: document.getElementById('ocr-run-btn').disabled,
    otherKept: !!window._scratchItemById('sB'),
  })), 'Q9 지운 뒤').toEqual({ mem: false, target: '#sA (지워진 이미지)', count: '0', runDisabled: true, otherKept: true });

  await page.evaluate(() => window.undo());
  await expect.poll(() => page.evaluate(async () => (await window.__rawScratch('scratch-pad-pO-pg1')).find(x => x.id === 'sA')?.ocr?.map(r => r.id) ?? null), { message: 'Q9 ⌘Z 저장본에 기록 둘' }).toEqual(['o1', 'o2']);
  expect(await page.evaluate(() => ({ mem: window._scratchItemById('sA')?.ocr?.map(r => r.text) ?? null, badge: window._scratchItemById('sA')?.el.querySelector('.scratch-ocr-badge').textContent ?? null })), 'Q9 ⌘Z 메모리·뱃지').toEqual({ mem: ['첫 글', '둘째 글'], badge: '글 2' });
  expect(errs).toEqual([]);
});
