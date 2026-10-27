/* t0-modal-bg-edit-10171a5.dom.spec.js — 10171a5 「섹션의 배경이미지 편집기능이 있듯이 같은 기능으로 되게 해줘」
 *
 * ★현빈 원문(T0-NOTE-ORIGINAL-261025.txt :9 의 👉 뒤)
 *   「배경이미지 설정은 되지만 섹션의 배경이미지 편집기능이있듯이 같은 기능으로되게 해줘.」
 * ★잰 사람(S3 · t8 재채점 · 판 f62653ce) — 모달 패널 Bg Image 절엔 이미지 선택·사이즈·제거뿐 «편집» 단추 0,
 *   더블클릭해도 핸들 0. 양성대조 = 같은 판 섹션 「배경이미지 편집」 ⇒ 모서리 4 · 변 4 · 회전존 4 · 고스트 1.
 * ★고침 = 이식 — js/image-handling.js 의 배경 편집 본문(_enterBgEditMode · 숙주 표 BG_EDIT_HOSTS)에
 *   ★모달 숙주 한 칸을 더한다(섹션·프레임이 이미 타는 «한 벌»). 패널에 같은 이름의 단추.
 *
 * ★칸
 *   P  전제 — plain 모달에 배경이미지가 섰다(사람 길: 패널 「이미지 선택」 → 파일) · 모달 cssText 에 background-image
 *   E1 패널 Bg Image 절의 「배경이미지 편집」 ⇒ 섹션과 같은 손잡이: 모서리 4 · 변 4 · 회전존 4 · 고스트 1
 *   E2 그 상태에서 그림을 진짜 마우스로 (+60,+30) 화면 px 끌고 Esc ⇒ dataset.bgPos 가 (60,30)÷배율 만큼 · 임시 DOM 0 ·
 *      모달 글은 그대로 · 그려진 background-position 이 그 값
 *   E3 끈 뒤 ⌘Z 한 번 ⇒ bgPos 가 끌기 전으로
 *   E4 회전 45° 하고 Esc ⇒ dataset.bgRotate=45 · 그림은 «레이어»(.sec-bg-clip > .sec-bg-img)가 rotate(45deg) 로 그리고
 *      모달 자신의 background-image 는 none · 다시 그려도(renderModalBlock) 레이어가 남는다 · 글은 레이어 «위»(elementFromPoint)
 * ⛔고정 대기 0 — 조건 대기만.
 * 실행: bash ~/taeyang-098/run-test.sh dom tests/dom/t0-modal-bg-edit-10171a5.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

/* 40×20 PNG(왼쪽 빨강 · 오른쪽 파랑 — zlib 로 지은 진짜 바이트) — 모달보다 작아 cover 로 늘어난다. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAIAAABwJOjsAAAAKUlEQVR4nGN44OBANjJIuEA2Yhi1eNTiUYtHLR61eNTiUYtHLR45FgMAciRMPSw1/UEAAAAASUVORK5CYII=', 'base64');

async function setup(page) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => {
    await window.addSection();
    const made = window.addModalBlock({ variant: 'plain', hMode: 'fixed', height: 220 });
    return made.block.id;
  });
  await waitStableRect(page, '#' + id);
  await page.waitForFunction((id) => document.getElementById(id)?.classList.contains('selected') && !!document.getElementById('mdl-bg-img-btn'), id, { timeout: 5000 });
  const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 3000 }), page.click('#mdl-bg-img-btn')]);
  await chooser.setFiles({ name: 'bg.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForFunction((id) => /^data:image\//.test(document.getElementById(id)?.dataset.bgImg || '') && !!document.getElementById('mdl-bg-size'), id, { timeout: 3000 });
  return { errs, id };
}

/** 패널의 「배경이미지 편집」 단추(없으면 null). */
async function editBtn(page) {
  return page.evaluate(() => {
    const b = [...document.querySelectorAll('#panel-right button')].find((e) => e.textContent.trim() === '배경이미지 편집' && e.offsetParent !== null);
    if (!b) return null;
    b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
}

async function enterEdit(page) {
  const b = await editBtn(page);
  expect(b, 'E1 패널 Bg Image 절의 「배경이미지 편집」 단추').not.toBeNull();
  await page.mouse.click(b.x, b.y);
  await page.waitForFunction(() => {
    const img = document.querySelector('.sec-bg-proxy .asset-img');
    return !!img && img.complete && img.naturalWidth > 0 && document.querySelectorAll('#ss-handles-overlay .img-corner-handle').length > 0;
  }, null, { timeout: 5000 });
  await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
}

async function exitEsc(page) {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelectorAll('.sec-bg-proxy, .sec-bg-ghost-wrap, .sec-bg-ghost').length === 0, null, { timeout: 5000 });
}

test('P·E1 ★모달 패널 「배경이미지 편집」 ⇒ 섹션과 같은 손잡이(모서리4·변4·회전존4·고스트1)', async ({ page }) => {
  const { errs, id } = await setup(page);
  const pre = await page.evaluate((id) => document.getElementById(id).style.backgroundImage, id);
  expect(pre, 'P 전제: 모달이 배경이미지를 그린다').toMatch(/^url\(/);
  await enterEdit(page);
  const n = await page.evaluate((id) => ({
    corner: document.querySelectorAll('#ss-handles-overlay .img-corner-handle').length,
    edge: document.querySelectorAll('#ss-handles-overlay .img-edge-handle').length,
    rot: document.querySelectorAll('#ss-handles-overlay .img-rotate-zone').length,
    ghost: document.querySelectorAll('.sec-bg-ghost').length,
    host: !!document.getElementById(id).querySelector(':scope > .sec-bg-proxy'),
  }), id);
  expect(n, 'E1 손잡이 수').toEqual({ corner: 4, edge: 4, rot: 4, ghost: 1, host: true });
  expect(errs).toEqual([]);
});

test('E2·E3 ★끌어 옮기고 Esc ⇒ bgPos 가 끈 만큼 · 임시 DOM 0 · 글 그대로 · ⌘Z 한 번에 되돌아간다', async ({ page }) => {
  const { errs, id } = await setup(page);
  const before = await page.evaluate((id) => {
    const b = document.getElementById(id);
    return { pos: b.dataset.bgPos || null, text: b.querySelector('.tb-mdl-text')?.textContent };
  }, id);
  await enterEdit(page);
  const p = await page.evaluate((id) => {
    const b = document.getElementById(id);
    const img = document.querySelector('.sec-bg-proxy .asset-img');
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width * 0.3, y: r.top + r.height * 0.5, z: r.width / b.offsetWidth, x0: parseFloat(img.style.left) || 0, y0: parseFloat(img.style.top) || 0 };
  }, id);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 30, p.y + 15, { steps: 5 });
  await page.mouse.move(p.x + 60, p.y + 30, { steps: 5 });
  await page.mouse.up();
  await exitEsc(page);
  const after = await page.evaluate((id) => {
    const b = document.getElementById(id);
    return { pos: b.dataset.bgPos || null, css: getComputedStyle(b).backgroundPosition, text: b.querySelector('.tb-mdl-text')?.textContent, editing: !!b._secBgEditing };
  }, id);
  const [ax, ay] = (after.pos || '').split(/\s+/).map(parseFloat);
  expect(after.pos, 'E2 bgPos 가 써졌다').toMatch(/px .*px/);
  expect(Math.abs(ax - (p.x0 + 60 / p.z)), `E2 x ${ax} ≈ ${p.x0 + 60 / p.z}`).toBeLessThan(1.5);
  expect(Math.abs(ay - (p.y0 + 30 / p.z)), `E2 y ${ay} ≈ ${p.y0 + 30 / p.z}`).toBeLessThan(1.5);
  expect(after.css.replace(/\s+/g, ' '), 'E2 그려진 위치 = 저장 값').toBe(after.pos.replace(/\s+/g, ' '));
  expect(after.text, 'E2 글 그대로').toBe(before.text);
  expect(after.editing, 'E2 편집 세션 끝').toBe(false);
  await page.keyboard.press('Meta+z');
  await page.waitForFunction(([id, want]) => (document.getElementById(id)?.dataset.bgPos || null) === want, [id, before.pos], { timeout: 3000 });
  expect(errs).toEqual([]);
});

test('E4 ★회전 45° 하고 Esc ⇒ 레이어가 rotate(45deg) 로 그리고 다시 그려도 남는다 · 글은 레이어 위', async ({ page }) => {
  const { errs, id } = await setup(page);
  await enterEdit(page);
  const r = await page.evaluate(() => {
    const img = document.querySelector('.sec-bg-proxy .asset-img');
    const zones = [...document.querySelectorAll('#ss-handles-overlay .img-rotate-zone')];
    const ir = img.getBoundingClientRect();
    const cx = ir.left + ir.width / 2, cy = ir.top + ir.height / 2;
    for (const zone of zones) {
      const zr = zone.getBoundingClientRect();
      for (const [zx, zy] of [[zr.left + 4, zr.top + 4], [zr.right - 4, zr.top + 4], [zr.left + 4, zr.bottom - 4], [zr.right - 4, zr.bottom - 4]]) {
        if (zx >= 0 && zy >= 0 && document.elementFromPoint(zx, zy) === zone) return { cx, cy, zx, zy };
      }
    }
    return null;
  });
  expect(r, 'E4 전제: 누를 수 있는 회전존').not.toBeNull();
  const a0 = Math.atan2(r.zy - r.cy, r.zx - r.cx);
  const rad = Math.max(60, Math.hypot(r.zx - r.cx, r.zy - r.cy));
  await page.mouse.move(r.zx, r.zy);
  await page.mouse.down();
  for (let k = 1; k <= 6; k++) {
    const a = a0 + (Math.PI / 4) * k / 6;
    await page.mouse.move(r.cx + rad * Math.cos(a), r.cy + rad * Math.sin(a));
  }
  await page.mouse.up();
  await page.waitForFunction(() => Math.abs(parseFloat(document.querySelector('.sec-bg-proxy')?.dataset.imgRotate || 0) - 45) < 0.5, null, { timeout: 3000 });
  await exitEsc(page);
  const read = (id) => page.evaluate((id) => {
    const b = document.getElementById(id);
    const L = b.querySelector(':scope > .sec-bg-clip > .sec-bg-img');
    const t = b.querySelector('.tb-mdl-text');
    const tr = t.getBoundingClientRect();
    const hit = document.elementFromPoint(tr.left + tr.width / 2, tr.top + tr.height / 2);
    return { rot: b.dataset.bgRotate || null, layer: !!L, layerT: L ? L.style.transform : null, hostImg: getComputedStyle(b).backgroundImage,
      textOnTop: !!hit && (hit === t || t.contains(hit)) };
  }, id);
  const a = await read(id);
  expect(a.rot, 'E4 dataset.bgRotate').toBe('45');
  expect(a.layer, 'E4 레이어가 섰다').toBe(true);
  expect(a.layerT, 'E4 레이어 회전').toContain('rotate(45deg)');
  /* ★그려진 값(computed)으로 잰다 — 인라인 `background:` 단축은 style.backgroundImage 를 'initial' 로 읽힌다. */
  expect(a.hostImg, 'E4 모달 자신은 그림을 안 그린다(이중 그림 0)').toBe('none');
  expect(a.textOnTop, 'E4 글이 레이어 위').toBe(true);
  await page.evaluate((id) => window.renderModalBlock(document.getElementById(id)), id);
  const b = await read(id);
  expect({ layer: b.layer, layerT: b.layerT, hostImg: b.hostImg, textOnTop: b.textOnTop }, 'E4 다시 그린 뒤').toEqual({ layer: true, layerT: a.layerT, hostImg: a.hostImg, textOnTop: true });
  expect(errs).toEqual([]);
});
