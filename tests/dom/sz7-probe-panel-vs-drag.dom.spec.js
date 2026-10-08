/* sz7-probe-panel-vs-drag.dom.spec.js
 *   ★★현빈 질문(2026-10-08, verbatim): 「★«영역 선택한 만큼»이 ★패널 단추로도 ★되어야 하나
 *     (★지금은 ★드래그 선택만) >> ★무슨말이니?」
 *   ⇒ ★★그 물음에 ★답하려면 ★★«지금 ★무엇으로 ★되나»를 ★행위로 ★재야 한다. ★이 파일이 ★그 자다.
 *
 * ══ ★★재는 것 — ★★같은 «부분 선택»에 ★★두 길을 ★따로 ★넣는다 ══════════════════
 *   ★장면(둘 공통): 그리드 칸 줄에 ★`AAABBBCCC` ★넣고 ★끝 3글자(`CCC`)만 ★고른다
 *   ★길 ⑴ ★★키보드(⌘B)        — ★★G6 이 ★이미 ★초록으로 잠근 길
 *   ★길 ⑵ ★★패널 단추(`#grd-typo-bold-btn`) — ★★이 파일이 ★새로 재는 길
 *   ⇒ ★★가름: ★★«고른 3글자만» 굵어지나(★부분) ★아니면 ★★«줄 전체»가 굵어지나(★줄 단위)
 *
 * ★★모델로 ★가른다(⛔눈으로 안 본다):
 *   ★부분   ⇒ ★`line.textHtml` 에 ★`<b>` ＋ ★`line.weight` ★무변
 *   ★줄단위 ⇒ ★`line.weight` 가 ★700 ＋ ★`line.textHtml` ★없음
 *   ⇒ ★★그 둘은 ★★배타적이다 ⇒ ★★어느 쪽인지 ★단언으로 ★못박을 수 있다
 *
 * ⛔이 파일은 ★«고치는 자»가 ★아니다 — ★★«지금 그렇다»를 ★적는 ★측정 기록이다.
 *   ★결정(★패널 단추도 ★부분이어야 하나)이 ★오면 ★★단언을 ★뒤집어라.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js sz7-probe-panel-vs-drag
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = '<div class="section-block" id="sA" data-section="1" data-name="sA" style="background-color:#ffffff"><div class="section-hitzone"></div><div class="section-inner" id="inA"></div></div>';
const TXT = 'AAABBBCCC';
const OUTSIDE = { x: 800, y: 960 };

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    document.getElementById('sA').classList.add('selected');
  }, SEC);
  await page.waitForTimeout(250);
  return errs;
}

async function addGrid(page) {
  const id = await page.evaluate(() => {
    const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
    document.getElementById('sA').classList.add('selected');
    window.addGridBlock?.({});
    const f = [...document.querySelectorAll('#canvas .grid-block')].filter(e => !before.has(e.id));
    return f.length ? f[f.length - 1].id : null;
  });
  await page.waitForTimeout(350);
  return id;
}

/** 모델 ⑴줄 — 행 0 의 줄은 `dataset.cols[0].lines[0]` 에 산다. */
const line0 = (page, id) => page.evaluate((i) => {
  const b = document.getElementById(i);
  let raw = null; try { raw = JSON.parse(b.dataset.cols || '[]'); } catch (_) {}
  const l = raw && raw[0] && Array.isArray(raw[0].lines) ? raw[0].lines[0] : null;
  const el = b.querySelector('.grd-line');
  return {
    text: l ? (l.text ?? null) : null,
    textHtml: l ? (l.textHtml ?? null) : null,
    weight: l ? (l.weight ?? null) : null,
    rendered: el ? el.innerHTML : null,
    bTags: el ? el.querySelectorAll('b,strong').length : -1,
  };
}, id);

/** 줄에 들어가 글자를 넣고 ★끝 3글자를 고른다 — ★선택이 섰음을 ★단언한다. */
async function typeAndSelectTail3(page, id) {
  const sel = `#${id} .grd-line`;
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  const r = await waitStableRect(page, sel);
  await page.mouse.dblclick(r.cx, r.cy);
  await page.waitForTimeout(400);
  expect(await page.evaluate((s) => document.querySelector(s)?.getAttribute('contenteditable'), sel),
    '★전제 — 줄 편집에 못 들어갔다').toBe('true');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(TXT);
  await page.waitForTimeout(200);
  await page.mouse.click(OUTSIDE.x, OUTSIDE.y);   // 커밋
  await page.waitForTimeout(450);
  // 다시 들어가 끝 3글자
  await page.mouse.dblclick(r.cx, r.cy);
  await page.waitForTimeout(400);
  await page.keyboard.press('End');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft');
  await page.waitForTimeout(150);
  const s = await page.evaluate(() => { const x = getSelection();
    return { rc: x.rangeCount, col: x.isCollapsed, str: x.toString() }; });
  expect(s, `★전제 — 끝 3글자("CCC")가 골라져야 한다. 잰 값 ${JSON.stringify(s)}`)
    .toEqual({ rc: 1, col: false, str: 'CCC' });
  return sel;
}

test('Q1 ★길⑴ 키보드(⌘B) — ★부분인가 ★줄 전체인가', async ({ page }) => {
  const errs = await setup(page);
  const id = await addGrid(page);
  await typeAndSelectTail3(page, id);
  await page.keyboard.press('ControlOrMeta+b');
  await page.waitForTimeout(200);
  await page.mouse.click(OUTSIDE.x, OUTSIDE.y);
  await page.waitForTimeout(500);
  const m = await line0(page, id);
  console.log('  Q1 키보드(⌘B):', JSON.stringify(m));
  /* ★★지금 그렇다: ★부분 — textHtml 에 서식 · weight 무변 */
  expect(m.textHtml, `★★키보드 ⌘B 가 ★부분 서식을 ★안 만들었다. 잰 값 ${JSON.stringify(m)}`).toBeTruthy();
  expect(m.weight, `★★키보드 ⌘B 가 ★줄 전체 굵기를 ★건드렸다(★부분이 아니라 ★줄 단위다). 잰 값 ${JSON.stringify(m)}`).toBeNull();
  expect(errs).toEqual([]);
});

test('Q2 ★★길⑵ 패널 단추(B) — ★부분인가 ★줄 전체인가 (★현빈 질문의 그 칸)', async ({ page }) => {
  const errs = await setup(page);
  const id = await addGrid(page);
  await typeAndSelectTail3(page, id);
  /* ★전제 — ★그 단추가 ★패널에 ★있나(★없으면 아래는 아무것도 안 잰다) */
  const has = await page.evaluate(() => !!document.getElementById('grd-typo-bold-btn'));
  expect(has, '★전제 — 그리드 줄 패널에 ★B 단추가 ★없다').toBe(true);
  await page.click('#grd-typo-bold-btn');
  await page.waitForTimeout(500);
  const m = await line0(page, id);
  console.log('  Q2 패널 단추(B):', JSON.stringify(m));
  /* ★★★이 단언이 ★현빈 질문의 ★답이다 — ★«지금 그렇다»를 적는다.
     ★결정이 오면(★패널도 ★부분이어야 한다) ★★이 둘을 ★뒤집어라. */
  expect(m.weight, `★★패널 단추가 ★줄 전체 굵기를 ★안 바꿨다 — ★이 기록이 낡았다(뒤집어라). 잰 값 ${JSON.stringify(m)}`).toBe('700');
  expect(m.textHtml, `★★패널 단추가 ★부분 서식을 ★만들었다 — ★이 기록이 낡았다(뒤집어라). 잰 값 ${JSON.stringify(m)}`).toBeFalsy();
  expect(errs).toEqual([]);
});
