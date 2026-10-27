/* annotation-1013t2c6-label-box — 어노테이션 라벨 «상자»: 너비 조절 · 상자 손잡이 · 처음 모서리 0 (1013t2C6 👉 뒤).
 *
 * 현빈 원문(👉 뒤): 「해당문제는 해결됐으나 추가로 라벨 너비도 조절이 되면 좋겠다. 라벨박스에도 핸들이 있으면 좋겠고,
 *   첨에는 모서리 라운드를 주지말 것」
 *
 * ★무엇을 잠그나
 *   LB1 펜으로 새로 만든 라벨은 모서리 0px · (음성) 키 없는 옛 저장본 꼴은 그대로 4px(CSS 기본)
 *   LB2 고르면 라벨 상자 좌·우 가운데에 손잡이 둘 — 그 자리에서 맨 위(쥘 수 있다)
 *   LB3 오른 손잡이를 끌면 끈 만큼 넓어지고 왼 모서리는 제자리 · 글은 그 너비에서 접힌다(pre-wrap)
 *   LB4 왼 손잡이를 끌면 끈 만큼 넓어지고 오른 모서리는 제자리 · ⌘Z 한 번 = 끌기 한 번
 *   LB5 패널 「너비」 150 → 150px · 「자동」→ 키가 지워지고 글 길이로 · (합침 261026) 일반 어노테이션엔 「모서리」 칸이 없다 — 택일5 그대로 치수선만
 *   LB6 rebindAll(리로드·⌘Z 복원과 같은 길) 뒤에도 너비·모서리가 같다 — 라벨 style 의 «속성 차례·값»이 라이브와 같고
 *       (CSSOM 이 고쳐 쓴 글꼴 차이는 패널을 한 번이라도 만진 모든 라벨에 이미 있다 · 이 칸 밖), 두 번 다시 그려도 한 글자도 안 바뀐다(F2)
 * ★만드는 길은 «사람 손» 그대로 — 펜 단추 → 메뉴 「Annotation」 → 섹션 두 점 → Enter → Esc (annotation-1017t1h5 와 같은 꼴).
 * ⛔waitForTimeout 금지 — expect.poll/waitForFunction 만.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const SEC = '[id="secA"]';

async function setup(page) {
  await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = '<div class="section-block" id="secA" style="position:relative;height:420px;background:#f4f4f6"><div class="section-inner"></div></div>';
    window.rebindAll?.();
    window.applyPagePadX?.(window.state?.pageSettings?.padX);
    window.buildLayerPanel?.();
  });
}

const annotCount = (page) => page.evaluate(() => document.querySelectorAll('#secA .annotation-block').length);

async function makeAnnotation(page, { p1 = [0.2, 0.3], p2 = [0.35, 0.5] } = {}) {
  const before = await annotCount(page);
  await page.click('#fp-pen-btn');
  await page.click('#fp-pen-menu .fp-menu-item:text-is("Annotation")');
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('pen-mode')), '★전제: 펜 모드가 켜졌다').toBe(true);
  const r = await waitStableRect(page, SEC);
  await clickAt(page, r.left + r.width * p1[0], r.top + r.height * p1[1], { sel: SEC }, { label: '첫 점' });
  await clickAt(page, r.left + r.width * p2[0], r.top + r.height * p2[1], { sel: SEC }, { label: '둘째 점' });
  await page.keyboard.press('Enter');
  await expect.poll(() => annotCount(page), 'Enter 로 어노테이션 하나가 생겼다').toBe(before + 1);
  await expect.poll(() => page.evaluate(() => document.activeElement?.classList?.contains('annot-label')), '생성 직후 라벨 편집에 들어갔다').toBe(true);
  await page.keyboard.type('라벨 너비 재기 글');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('pen-mode')), 'Esc 로 펜 모드 종료').toBe(false);
  const id = await page.evaluate(() => { const all = document.querySelectorAll('#secA .annotation-block'); return all[all.length - 1].id; });
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.text, id), '★전제: 친 글이 확정됐다').toBe('라벨 너비 재기 글');
  return id;
}

async function selectByLabel(page, id) {
  const sel = `[id="${id}"] .annot-label`;
  const lr = await waitStableRect(page, sel);
  await clickAt(page, lr.cx, lr.cy, { sel }, { label: '라벨' });
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('selected')
    && !!document.querySelector('#panel-right [data-prop-panel="annotation"]'), id), '★전제: 골랐고 어노테이션 패널이 떴다').toBe(true);
}

const labelBox = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id);
  const l = b.querySelector('.annot-label');
  const r = l.getBoundingClientRect();
  const k = b.getBoundingClientRect().width / b.offsetWidth;
  const cs = getComputedStyle(l);
  return { left: r.left, right: r.right, w: l.offsetWidth, k, ws: cs.whiteSpace, radius: cs.borderRadius, dsW: b.dataset.labelWidth ?? null, dsR: b.dataset.labelRadius ?? null };
}, id);

const handles = (page, id) => page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.annot-lw-handle')].map((h) => {
  const q = h.getBoundingClientRect();
  const x = q.left + q.width / 2, y = q.top + q.height / 2;
  return { edge: h.dataset.edge, x, y, top: document.elementFromPoint(x, y) === h };
}), id);

async function dragX(page, h, dx) {
  await page.mouse.move(h.x, h.y);
  await page.mouse.down();
  await page.mouse.move(h.x + dx / 2, h.y, { steps: 3 });
  await page.mouse.move(h.x + dx, h.y, { steps: 3 });
  await page.mouse.up();
}

async function setNum(page, sel, value) {
  await page.click(`#panel-right ${sel}`);
  await page.keyboard.press('Meta+a');
  await page.keyboard.type(String(value));
  await page.keyboard.press('Enter');
}

test('LB1 펜으로 새로 만든 라벨은 모서리 0px · (음성) 키 없는 옛 저장본 꼴은 4px 그대로', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  const b = await labelBox(page, id);
  expect({ radius: b.radius, dsR: b.dsR }, '새 라벨 = 모서리 0').toEqual({ radius: '0px', dsR: '0' });
  const old = await page.evaluate(() => {
    const a = window.makeAnnotationBlock({ points: [[20, 20], [60, 40]], text: '옛' });
    document.getElementById('secA').appendChild(a);
    const l = a.querySelector('.annot-label');
    const o = { radius: getComputedStyle(l).borderRadius, ws: getComputedStyle(l).whiteSpace, keys: Object.keys(a.dataset).filter((k) => k === 'labelWidth' || k === 'labelRadius') };
    a.remove();
    return o;
  });
  expect(old, '옛 저장본(키 없음) = CSS 기본 4px · 글 길이(pre) · 키를 안 단다').toEqual({ radius: '4px', ws: 'pre', keys: [] });
});

test('LB2·LB3 고르면 상자 손잡이 둘 — 오른 손잡이를 끌면 끈 만큼 넓어지고 왼 모서리는 제자리', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  expect((await handles(page, id)).length, '★전제: 안 고르면 손잡이가 없다').toBe(0);
  await selectByLabel(page, id);
  const hs = await handles(page, id);
  const b0 = await labelBox(page, id);
  expect(hs.map((h) => h.edge).sort()).toEqual(['e', 'w']);
  expect(hs.every((h) => h.top), '두 손잡이 모두 그 자리에서 맨 위').toBe(true);
  const he = hs.find((h) => h.edge === 'e');
  const hw = hs.find((h) => h.edge === 'w');
  expect(Math.abs(he.x - b0.right) <= 1 && Math.abs(hw.x - b0.left) <= 1, '손잡이는 상자 좌·우 모서리에 선다').toBe(true);
  expect(b0.ws, '★전제: 너비를 안 정한 라벨은 글 길이(pre)').toBe('pre');

  await dragX(page, he, 60);
  const b1 = await labelBox(page, id);
  expect(Math.abs((b1.w - b0.w) - 60 / b0.k) <= 1, `끈 만큼 넓어졌다(${b0.w} → ${b1.w} · 배율 ${b0.k})`).toBe(true);
  expect(Math.abs(b1.left - b0.left) <= 1, '왼 모서리는 제자리').toBe(true);
  expect({ ws: b1.ws, dsW: b1.dsW }).toEqual({ ws: 'pre-wrap', dsW: String(b1.w) });
  const he1 = (await handles(page, id)).find((h) => h.edge === 'e');
  expect(Math.abs(he1.x - b1.right) <= 1, '손잡이가 새 모서리를 따라간다').toBe(true);
});

test('LB4 왼 손잡이를 끌면 넓어지고 오른 모서리는 제자리 · ⌘Z 한 번 = 끌기 한 번', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  const b0 = await labelBox(page, id);
  const hw = (await handles(page, id)).find((h) => h.edge === 'w');
  await dragX(page, hw, -40);
  const b1 = await labelBox(page, id);
  expect(Math.abs((b1.w - b0.w) - 40 / b0.k) <= 1, `끈 만큼 넓어졌다(${b0.w} → ${b1.w})`).toBe(true);
  expect(Math.abs(b1.right - b0.right) <= 1, '오른 모서리는 제자리').toBe(true);
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await labelBox(page, id)).dsW, '⌘Z 한 번에 끌기 전으로').toBe(null);
  const b2 = await labelBox(page, id);
  expect(Math.abs(b2.w - b0.w) <= 1 && Math.abs(b2.left - b0.left) <= 1, '너비·자리 모두 끌기 전').toBe(true);
});

test('LB5 패널 — 너비 150 · 자동으로 되돌리기 · 모서리 칸은 일반 어노테이션에 없다(택일5 · 치수선만)', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  const w0 = (await labelBox(page, id)).w;
  expect(await page.inputValue('#panel-right #annot-label-w'), '★전제: 안 정한 너비는 빈 칸(자동)').toBe('');
  await setNum(page, '#annot-label-w', 150);
  await expect.poll(async () => (await labelBox(page, id)).w).toBe(150);
  expect((await labelBox(page, id)).dsW).toBe('150');
  await page.click('#panel-right #annot-label-w-auto');
  await expect.poll(async () => (await labelBox(page, id)).dsW, '자동 = 키 삭제').toBe(null);
  const b = await labelBox(page, id);
  expect({ ws: b.ws, w: b.w }, '글 길이로 돌아간다').toEqual({ ws: 'pre', w: w0 });
  expect(await page.locator('#panel-right #annot-label-radius-num').count(), '일반 어노테이션 = 모서리 칸 0(택일5 G2 와 같은 뜻)').toBe(0);
});

test('LB6 rebindAll 뒤에도 너비·모서리가 같고 라벨 style 문자열이 한 글자도 안 바뀐다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  await dragX(page, (await handles(page, id)).find((h) => h.edge === 'w'), -30);
  await expect.poll(async () => (await labelBox(page, id)).dsW, '★전제: 너비가 들었다').not.toBe(null);
  /* 속성 차례·값 — CSSOM 으로 읽어 견준다(글꼴 차이 rgb(…)·띄어쓰기를 걷어낸 «뜻») */
  const decl = (id) => page.evaluate((id) => {
    const l = document.getElementById(id).querySelector('.annot-label');
    return Array.from(l.style).map((k) => `${k}:${l.style.getPropertyValue(k)}`);
  }, id);
  const live = await page.evaluate((id) => { const b = document.getElementById(id); return { w: b.dataset.labelWidth, dx: b.dataset.labelDx }; }, id);
  expect(live.w != null && live.dx != null, '★전제: 너비·개별 위치가 둘 다 들었다(왼 손잡이)').toBe(true);
  const liveDecl = await decl(id);
  expect(liveDecl.some((d) => d.startsWith('width:')) && liveDecl[liveDecl.length - 1].startsWith('translate:'), '★전제: 라이브에 너비가 있고 translate 가 맨 끝').toBe(true);
  const rebind = () => page.evaluate((id) => { window.rebindAll(); const b = document.getElementById(id); const l = b.querySelector('.annot-label'); return { style: l.getAttribute('style'), w: b.dataset.labelWidth, r: b.dataset.labelRadius, ow: l.offsetWidth, radius: getComputedStyle(l).borderRadius }; }, id);
  const after = await rebind();
  expect(await decl(id), '다시 그린 라벨의 속성 차례·값 = 라이브').toEqual(liveDecl);
  expect({ w: after.w, r: after.r, ow: String(after.ow), radius: after.radius }, '펜으로 만든 모서리 0 도 다시 그린 뒤 그대로').toEqual({ w: live.w, r: '0', ow: live.w, radius: '0px' });
  expect((await rebind()).style, '두 번째 다시 그리기는 한 글자도 안 바꾼다(F2 멱등)').toBe(after.style);
});
