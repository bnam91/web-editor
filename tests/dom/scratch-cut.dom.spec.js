/* scratch-cut.dom.spec.js — 스크래치패드 ★⌘X 잘라내기 (2026-10-06 현빈 「스크래치패드 잘라내기가 안되는 문제」)
 *
 * ★고치기 «전» 실측(핀 e7444dd3, 실앱 CDP) — 「안 된다」를 네 갈래로 갈랐다:
 *   ㉠ 안 닿나?       닿는다 — document 캡처단계에서 ⌘X keydown 1회 수신
 *   ㉡ 안 불리나?     ★스크래치의 잘라내기가 «없었다»(js/ 전수에서 key==='x' 는 editor.js 둘뿐)
 *   ㉢ 틀린 갈래?     ★그렇다 — editor.js 의 «캔버스» 잘라내기가 받아 preventDefault,
 *                     캔버스 선택이 비어 아무것도 안 했다(아이템 1 → 1 · 토스트 0)
 *   ㉣ 결과가 틀리나? 아니다 — 아무 결과도 안 났다
 *   ★덧: 그 preventDefault 가 네이티브 `cut` 이벤트도 막았다(cutEvt 0) ⇒ addEventListener('cut') 길은 막혀 있다.
 *
 * 무엇을 재나
 *   C1 ★잘린다 — ⌘X 로 아이템이 사라지고 «클립보드가 갱신»된다. ⛔둘을 같이 단언한다
 *      (지워지기만 하면 그건 ★Delete 지 잘라내기가 아니다).
 *   C2 ★복사가 실패하면 ★안 지운다 — 클립보드는 비었는데 원본이 사라지는 것이 이 기능의 가장 나쁜 실패다.
 *   C3 ★N장 골라도 «담긴 한 장»만 잘린다 — OS 클립보드가 1장뿐이라, 나머지를 지우면 사본이 어디에도 없다.
 *   C4 ★캔버스가 안 다친다 — 스크래치가 가져간 ⌘X 에서 캔버스 블럭 수가 그대로다.
 *   C5 ★양보 — 스크래치 선택이 «없으면» 거짓을 돌려줘 캔버스 잘라내기가 종전대로 돈다.
 *   C6 ★입력칸 보호 — INPUT/contentEditable 포커스 중엔 안 가로챈다(칸 안 글자 잘라내기가 살아야 한다).
 *   C7 ★⌘C 회귀 — 복사는 지우지 «않는다»(한 부품을 나눠 쓰면서 갈리기 쉬운 자리).
 *
 * ⛔이 하네스로 «못 재는» 축: 실제 OS 클립보드 내용(electronAPI 가짜) · ⌘V 로 되붙는 왕복 ·
 *   재기동 뒤 IndexedDB 영속. 그 셋은 실앱 CDP 로 따로 쟀다(지디 보고).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/scratch-cut.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* ★클립보드 IPC 를 «성공»으로 세운다 — 하네스 기본 electronAPI 는 모든 호출이 null 이라 복사가 늘 실패한다.
   그 실패 자체는 C2 가 쓰는 조건이므로, 성공이 필요한 시험만 이 문을 연다. */
const clipboardOk = (page) => page.evaluate(() => {
  window.__clipCalls = 0;
  const old = window.electronAPI;
  window.electronAPI = new Proxy({}, {
    get: (t, k) => (k === 'clipboardWriteImage'
      ? (() => { window.__clipCalls++; return Promise.resolve({ ok: true }); })
      : old[k]),
  });
});

async function addItems(page, n) {
  return page.evaluate(async (count) => {
    const mk = (hue) => {
      const c = document.createElement('canvas'); c.width = 60; c.height = 40;
      const g = c.getContext('2d'); g.fillStyle = `hsl(${hue},70%,50%)`; g.fillRect(0, 0, 60, 40);
      return c.toDataURL('image/png');
    };
    for (let i = 0; i < count; i++) await window._scratchAddAndSave(mk(i * 60), 40 + i * 140, 60, 120);
    await new Promise(r => setTimeout(r, 400));
    return document.querySelectorAll('.scratch-item').length;
  }, n);
}

/* 아이템을 «진짜 클릭»으로 고른다 — 내부 _selectedItems 와 클래스가 같이 서야 한다(클래스만 붙이면 갈린다).
   ★더하기는 ⌘ 가 아니라 ★⇧ 다(js/scratch-pad.js: `_selectItem(item, e.shiftKey)`).
     캔버스 블럭은 ⌘클릭이라 손이 섞이기 쉽다 — 2026-10-06 에 ⌘로 썼다가 3장 중 1장만 골라져 빨강이었다. */
async function pick(page, idx, { add = false } = {}) {
  const p = await page.evaluate((i) => {
    const el = [...document.querySelectorAll('.scratch-item')][i];
    const r = el.getBoundingClientRect();
    const x = Math.round(r.x + r.width / 2), y = Math.round(r.y + r.height / 2);
    const hit = document.elementFromPoint(x, y);
    return { x, y, ok: !!hit && (el === hit || el.contains(hit)), hit: hit && String(hit.className).slice(0, 40) };
  }, idx);
  expect(p.ok, `★${idx}번 아이템 자리에 다른 것이 있다 — ${p.hit}`).toBe(true);
  /* ⚠️page.mouse.click 에는 ★modifiers 옵션이 «없다»(button·clickCount·delay 뿐) — 넘겨도 조용히 무시된다.
       2026-10-06 에 그렇게 썼다가 3장 중 1장만 골라져 C3 가 빨강이었다. ⇒ 키를 «눌러 두고» 클릭한다. */
  if (add) await page.keyboard.down('Shift');
  await page.mouse.click(p.x, p.y);
  if (add) await page.keyboard.up('Shift');
  await page.waitForTimeout(200);
}

const snap = (page) => page.evaluate(() => ({
  nItem: document.querySelectorAll('.scratch-item').length,
  nSel: document.querySelectorAll('.scratch-item.scratch-selected').length,
  clipTime: window._scratchClipboardTime || 0,
  clipCalls: window.__clipCalls || 0,
}));

/* ⌘X — 진짜 키. ★스크래치 잘라내기는 비동기(클립보드 IPC)라 눌러 놓고 «결과»를 기다린다. */
async function pressCut(page) {
  await page.keyboard.press('Meta+x');
  await page.waitForTimeout(700);
}

test('C1 ★잘린다 — 아이템이 사라지고 «클립보드도» 갱신된다 (지워지기만 하면 그건 Delete 다)', async ({ page }) => {
  const errs = await bootApp(page);
  await clipboardOk(page);
  expect(await addItems(page, 1)).toBe(1);
  await pick(page, 0);
  const pre = await snap(page);
  expect(pre, '★전제 — 아이템이 하나 골라져 있어야 한다').toMatchObject({ nItem: 1, nSel: 1 });

  await pressCut(page);
  const post = await snap(page);
  console.log('  C1:', JSON.stringify({ pre, post }));
  expect(post.nItem, '★⌘X 로 아이템이 안 지워졌다 — 고치기 전의 그 증상이다').toBe(0);
  expect(post.clipCalls, '★클립보드에 쓰지도 않고 지웠다 — 그건 잘라내기가 아니라 삭제다').toBeGreaterThan(0);
  expect(post.clipTime, '★클립보드 시각이 안 갱신됐다 — ⌘V 우선순위가 깨진다').toBeGreaterThan(pre.clipTime);
  expect(errs).toEqual([]);
});

test('C2 ★복사가 실패하면 «안 지운다» — 클립보드는 비었는데 원본이 사라지는 실패를 막는다', async ({ page }) => {
  const errs = await bootApp(page);
  /* ⛔clipboardOk 를 ★안 부른다 — 하네스 기본 electronAPI 는 null 을 돌려줘 복사가 «실제로» 실패한다. */
  expect(await addItems(page, 1)).toBe(1);
  await pick(page, 0);
  const pre = await snap(page);
  await pressCut(page);
  const post = await snap(page);
  console.log('  C2:', JSON.stringify({ pre, post }));
  expect(post.nItem, '★복사가 실패했는데 아이템을 지웠다 — 사본 없는 데이터 손실').toBe(1);
  expect(post.clipTime, '★실패했는데 클립보드 시각을 갱신했다 — ⌘V 가 없는 것을 붙이러 간다').toBe(pre.clipTime);
  expect(errs).toEqual([]);
});

test('C3 ★N장 골라도 «담긴 한 장»만 잘린다 (OS 클립보드가 1장뿐이라 나머지는 사본이 없다)', async ({ page }) => {
  const errs = await bootApp(page);
  await clipboardOk(page);
  expect(await addItems(page, 3)).toBe(3);
  await pick(page, 0);
  await pick(page, 1, { add: true });
  await pick(page, 2, { add: true });
  const pre = await snap(page);
  expect(pre.nSel, '★전제 — 세 장이 골라져야 한다. 아니면 C3 가 아무것도 안 잰다').toBe(3);

  await pressCut(page);
  const post = await snap(page);
  console.log('  C3:', JSON.stringify({ pre, post }));
  expect(post.nItem, '★세 장을 다 지웠다 — 클립보드엔 한 장뿐이라 두 장은 사본이 없다').toBe(2);
  expect(errs).toEqual([]);
});

test('C4·C5 ★캔버스 — 스크래치가 가져가면 캔버스는 안 다치고, 스크래치 선택이 없으면 양보한다', async ({ page }) => {
  const errs = await bootApp(page);
  await clipboardOk(page);
  await page.evaluate(() => {
    document.getElementById('canvas').innerHTML = `
      <div class="section-block" id="cutSec" data-section="1" data-name="CUT" style="background-color:#fff">
        <div class="section-inner">
          <div class="text-block selected" data-type="body" id="cutTb"><div class="tb-body" contenteditable="false">자를 블럭</div></div>
        </div>
      </div>`;
  });
  expect(await addItems(page, 1)).toBe(1);

  // C4 — 스크래치 아이템이 골라져 있으면 그쪽이 가져가고 캔버스 블럭은 «그대로»
  await pick(page, 0);
  const pre = await page.evaluate(() => ({ nItem: document.querySelectorAll('.scratch-item').length, nTb: document.querySelectorAll('#canvas .text-block').length }));
  expect(pre, '★전제 — 아이템 1 · 캔버스 블럭 1').toEqual({ nItem: 1, nTb: 1 });
  await pressCut(page);
  const mid = await page.evaluate(() => ({ nItem: document.querySelectorAll('.scratch-item').length, nTb: document.querySelectorAll('#canvas .text-block').length }));
  console.log('  C4:', JSON.stringify(mid));
  expect(mid.nItem, '★스크래치가 안 잘렸다').toBe(0);
  expect(mid.nTb, '★스크래치를 자르면서 캔버스 블럭까지 지웠다').toBe(1);

  // C5 — 스크래치 선택이 «없으면» 거짓을 돌려줘 캔버스 잘라내기가 종전대로 돈다
  const yields = await page.evaluate(() => window.scratchCutSelected());
  expect(yields, '★스크래치 선택이 없는데 ⌘X 를 가져간다 — 캔버스 잘라내기가 죽는다').toBe(false);
  expect(errs).toEqual([]);
});

test('C6 ★입력칸 보호 — INPUT 포커스 중엔 안 가로챈다(칸 안 글자 잘라내기가 살아야 한다)', async ({ page }) => {
  const errs = await bootApp(page);
  await clipboardOk(page);
  expect(await addItems(page, 1)).toBe(1);
  await pick(page, 0);
  const r = await page.evaluate(() => {
    const inp = document.createElement('input');
    inp.type = 'text'; inp.value = 'abc';
    inp.style.cssText = 'position:fixed;left:10px;top:10px;z-index:2147483647';
    document.body.appendChild(inp);
    inp.focus(); inp.select();
    const took = window.scratchCutSelected();      // 입력칸이 포커스를 가진 «그 순간»의 판정
    inp.remove();
    return { took, nItem: document.querySelectorAll('.scratch-item').length };
  });
  console.log('  C6:', JSON.stringify(r));
  expect(r.took, '★입력칸 포커스 중인데 스크래치가 ⌘X 를 가져갔다 — 칸 안 글자를 못 자른다').toBe(false);
  expect(r.nItem, '★입력칸 포커스 중에 아이템을 지웠다').toBe(1);
  expect(errs).toEqual([]);
});

test('C7 ★⌘C 회귀 — 복사는 «지우지 않는다» (잘라내기와 한 부품을 나눠 쓴다)', async ({ page }) => {
  const errs = await bootApp(page);
  await clipboardOk(page);
  expect(await addItems(page, 1)).toBe(1);
  await pick(page, 0);
  const pre = await snap(page);
  await page.keyboard.press('Meta+c');
  await page.waitForTimeout(700);
  const post = await snap(page);
  console.log('  C7:', JSON.stringify({ pre, post }));
  expect(post.nItem, '★복사했는데 아이템이 사라졌다 — 복사가 잘라내기가 됐다').toBe(1);
  expect(post.clipCalls, '★복사가 클립보드에 안 썼다').toBeGreaterThan(0);
  expect(post.clipTime, '★복사가 클립보드 시각을 안 갱신했다').toBeGreaterThan(pre.clipTime);
  expect(errs).toEqual([]);
});
