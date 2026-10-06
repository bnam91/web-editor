/* frame-align-insert.dom.spec.js — E122 «스택 프레임에 「왼쪽」을 준 뒤 새로 넣은 것이 가운데로 선다» 잠금 (태양 lane-e122-falign 2026-10-05)
 * ★실측(9ef09f76 · 26 종 × 3 정렬, $S/e122/probe2.json): 「정렬 단추 → 새로 넣기」 자리를 «같은 단추를 다시 누른» 자리와 견줬다.
 *   다른 것 = 왼쪽·오른쪽: 에셋 Object(small) · Logo · 아이콘서클 · 아이콘텍스트 · 사각형 도형 · 가운데: 아이콘텍스트. 나머지 21 종은 같다.
 *   까닭: 정렬 규칙이 단추(prop-frame.js _setAlign) «안»에만 있었다 — 넣는 길(_appendFlowChild · addShapeBlock)은 블럭 기본값(align-self:center 등)으로 세웠다.
 * 고침: 규칙을 frame-geometry.js applyFrameHAlignToChild 한 벌로 옮기고 단추·넣는 길이 같이 쓴다. 프레임에 dataset.alignItems 가 «있을 때만»
 *   (정렬 단추·MCP updateFrame·modal-frameify 만 씀 — 코드독해) — 손 안 댄 프레임은 종전 그대로(G2 가 지킨다).
 * ★순서는 실앱 순서다: 프레임을 «클릭으로 고른다» → 패널 「왼쪽/가운데/오른쪽」 클릭 → 플로팅 패널 단추 → 메뉴 항목 클릭. 전부 clickAt(맞힌 요소 단언).
 * 이름표: L1~L5·R1~R5 = 왼쪽/오른쪽 뒤 다섯 종(고친 것) · C1 = 가운데 뒤 아이콘텍스트 · G1 = 왼쪽 뒤 Heading(원래 맞던 것 그대로) · G2 = 손 안 댄 프레임의 Object 는 가운데 그대로.
 * 형제: frame-align-display.dom.spec.js A5(결함 잠금 → 이 고침에서 뒤집었다).
 * 양성대조: 9ef09f76 나무 안 → L1~L5 R1~R5 C1 빨강 · G1 G2 초록 (predict: $S/e122/predict.md).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/frame-align-insert.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const KINDS = [   // [이름, 플로팅 단추 title 머리, 메뉴 글자]
  ['Object(에셋 small)', '이미지(Asset)', 'Object'],
  ['Logo(에셋)', '이미지(Asset)', 'Logo'],
  ['Circle(아이콘서클)', '이미지(Asset)', 'Circle'],
  ['Icon Text', '텍스트 블록 추가', 'Icon Text'],
  ['Rectangle(도형)', '도형 추가', 'Rectangle'],
];

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" data-section="1" id="sec1"><div class="section-hitzone"></div><div class="section-inner" data-padding-x="0" style="padding-left:0;padding-right:0"></div></div>`);
    const ss = window.makeFrameBlock({ fullWidth: true }); ss.id = 'FR'; ss.style.width = '860px'; ss.style.padding = '30px'; ss.dataset.width = '860'; ss.style.minHeight = '200px';
    document.querySelector('#sec1 .section-inner').appendChild(ss);
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    document.getElementById('FR').scrollIntoView({ block: 'start' });
    window.__known = new Set([...document.querySelectorAll('#FR *')]);
  });
  return errs;
}
/** 프레임을 클릭으로 고르고(빈 자리 · 맞힌 요소 = 프레임) 패널 정렬 단추를 누른다 */
async function pickFrameAndAlign(page, btnId) {
  const f = await waitStableRect(page, '#FR');
  await clickAt(page, f.left + 8, f.top + 8, { sel: '#FR' }, { label: '프레임 고르기' });
  await page.waitForFunction(() => document.getElementById('FR').classList.contains('selected') && !!document.getElementById('ss-align-left'), null, { timeout: 3000 });
  if (!btnId) return;
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), btnId);
  const b = await waitStableRect(page, '#' + btnId);
  await clickAt(page, b.cx, b.cy, { sel: `[id="${btnId}"]` }, { label: btnId });
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('active'), btnId), { message: `전제 — ${btnId} 켜짐` }).toBe(true);
}
/** 플로팅 패널 단추 → 메뉴 항목 (실앱과 같은 손) */
async function insertViaMenu(page, titleHead, label) {
  const tsel = `button.fp-dropdown-trigger[title^="${titleHead}"]`;
  const t = await waitStableRect(page, tsel);
  await clickAt(page, t.cx, t.cy, { sel: tsel }, { label: '플로팅 ' + titleHead });
  await page.waitForFunction((label) => [...document.querySelectorAll('.fp-menu-item')].some(e => e.innerText.trim() === label && e.getBoundingClientRect().width > 0), label, { timeout: 3000 });
  const it = await page.evaluate((label) => { const e = [...document.querySelectorAll('.fp-menu-item')].find(e => e.innerText.trim() === label && e.getBoundingClientRect().width > 0); e.dataset.e122 = '1'; const q = e.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; }, label);
  await clickAt(page, it.x, it.y, { sel: '[data-e122="1"]' }, { label: '메뉴 ' + label });
  await page.waitForFunction(() => [...document.getElementById('FR').children].some(e => !window.__known.has(e)), null, { timeout: 3000 });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}
/** 새로 들어온 직계 자식의 «보이는 블럭» 자리 — 프레임 안쪽 상자 기준 L/R */
const newPos = (page) => page.evaluate(() => {
  const FR = document.getElementById('FR');
  const top = [...FR.children].find(e => !window.__known.has(e));
  const blk = (top.matches('[class*="-block"]:not(.row)') && !top.dataset.textFrame) ? top : (top.querySelector('[class*="-block"]:not(.frame-block[data-text-frame])') || top);
  const fr = FR.getBoundingClientRect(), cs = getComputedStyle(FR);
  let q = blk.getBoundingClientRect();
  if (blk.classList.contains('text-block')) { const r = document.createRange(); r.selectNodeContents(blk.querySelector('[class^="tb-"]') || blk); q = r.getBoundingClientRect(); }
  return { kind: blk.className.split(' ')[0], L: Math.round(q.left - (fr.left + parseFloat(cs.paddingLeft))), R: Math.round((fr.right - parseFloat(cs.paddingRight)) - q.right) };
});

for (const [dir, btn] of [['L', 'ss-align-left'], ['R', 'ss-align-right']]) {
  KINDS.forEach(([name, title, label], i) => {
    test(`${dir}${i + 1} ★「${dir === 'L' ? '왼쪽' : '오른쪽'}」 준 스택 프레임에 새 ${name} → ${dir === 'L' ? '왼쪽' : '오른쪽'} 끝에 붙는다`, async ({ page }) => {
      const errs = await setup(page);
      await pickFrameAndAlign(page, btn);
      await insertViaMenu(page, title, label);
      const p = await newPos(page);
      expect(p[dir], `${dir === 'L' ? '왼쪽' : '오른쪽'} 여백 ≤1 이어야 · 잰 값 ${JSON.stringify(p)}`).toBeLessThanOrEqual(1);
      expect(p[dir === 'L' ? 'R' : 'L'], `전제 — 폭을 다 채우지 않는 블럭(정렬이 보이는 것) ${JSON.stringify(p)}`).toBeGreaterThan(20);
      expect(errs).toEqual([]);
    });
  });
}

test('C1 ★「가운데」 준 스택 프레임에 새 Icon Text → 가운데(L≈R · 폭을 다 안 채움)', async ({ page }) => {
  await setup(page);
  await pickFrameAndAlign(page, 'ss-align-hcenter');
  await insertViaMenu(page, '텍스트 블록 추가', 'Icon Text');
  const p = await newPos(page);
  expect(p.L > 20 && Math.abs(p.L - p.R) <= 2, `가운데 · 잰 값 ${JSON.stringify(p)}`).toBe(true);
});

test('G1 지킴 — 「왼쪽」 뒤 새 Heading 은 원래대로 왼쪽', async ({ page }) => {
  await setup(page);
  await pickFrameAndAlign(page, 'ss-align-left');
  await insertViaMenu(page, '텍스트 블록 추가', 'Heading');
  const p = await newPos(page);
  expect(p.L, `잰 값 ${JSON.stringify(p)}`).toBeLessThanOrEqual(1);
});

test('G2 지킴 — 정렬 단추를 «안 누른» 프레임의 새 Object 에셋은 종전대로 가운데', async ({ page }) => {
  await setup(page);
  await pickFrameAndAlign(page, null);
  expect(await page.evaluate(() => document.getElementById('FR').dataset.alignItems ?? null), '전제 — 프레임에 정렬 값 없음').toBe(null);
  await insertViaMenu(page, '이미지(Asset)', 'Object');
  const p = await newPos(page);
  expect(p.L > 20 && Math.abs(p.L - p.R) <= 2, `가운데 그대로 · 잰 값 ${JSON.stringify(p)}`).toBe(true);
});
