/* itb-photo-upload-door.dom.spec.js — 113 ITB-PHOTO-UPLOAD-DOOR-01 아이콘 텍스트 블럭 팝오버 안 「사진 올리기」(회귀 복구)
 *
 * 발주(현빈 GO ㉡): 아이콘 텍스트 블럭 패널 안에 「사진 올리기」 항목을 따로 둔다.
 *   원래 있던 문(.itb-icon 클릭 → 파일 선택창)을 3c676f79(1017t1m2)가 팝오버로 바꾸며 `if (pop) return;` 으로 막았다.
 * 처방: 막힌 업로드 블록을 그대로 `_itbPickPhoto(block)`(block-drag.js)로 떼어 ⑴ 팝오버 「사진 올리기」 ⑵ 폴백 두 곳에서 부른다.
 *   항목은 openIfgIconPopover 넷째 인자 { onUpload } 로 «부르는 쪽»이 켠다 — 기본 꺼짐(인포그래픽 칸 무변).
 *
 * 칸
 *   U0  ⒞ 아이콘 클릭 → #grd-ifg-iconpop 에 「사진 올리기」 정확히 1개 (바닥 8608bb13 = 0 → 빨강)
 *   U1  ⒝⒠ 팝오버 「사진 올리기」 실제 클릭 → 파일 선택창 → setInputFiles(png) → .itb-icon img = data:image/png · dataset.imgSrc 같음
 *          · 팝오버 닫힘 → ⌘Z 한 번 → 그림 0 · imgSrc 빈값
 *   U2  ⒝⒠ 폴백(팝오버 모듈 미적재 = window.openIfgIconPopover 비움) → 아이콘 클릭 → 파일 선택창 → setInputFiles → 그림 들어감
 *   N1  ⒟ 음성대조(범위 누수) — 인포그래픽 칸 아이콘 더블클릭 → #grd-ifg-iconpop 은 뜨되 「사진 올리기」 0개
 * 대조 런
 *   바닥 GD1001_ROOT=<git archive 8608bb13> → U0·U1 빨강 · U2·N1 초록(옛 폴백·인포그래픽은 원래 그렇다)
 *   변이 A(_itbPickPhoto 본문 첫 줄 return) → U1·U2 «둘 다» 빨강(공용 함수 하나를 두 소비자가 쓴다)
 *   변이 B(넷째 인자 무시 · 늘 켬) → N1 빨강
 * ⛔고정 대기 없음 — waitForFunction / expect.poll / waitForEvent 만. ⛔앱 무접촉(_root-harness.bootApp).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js itb-photo-upload-door
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 2×2 빨강 PNG — FileReader 가 data:image/png;base64,… 로 읽는다. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
const FILE = { name: 'photo.png', mimeType: 'image/png', buffer: PNG };

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    const sec = c.querySelector('.section-block');
    window.selectSection(sec);
    window.addIconTextBlock();
    window.deselectAll?.();
    const itb = sec.querySelector('.icon-text-block');
    window.__itbId = itb.id;
    itb.scrollIntoView({ block: 'center' });
  });
  await page.waitForFunction(() => {
    const b = document.getElementById(window.__itbId);
    return !!b && b.querySelector('.itb-icon').getBoundingClientRect().width > 0;
  });
  return errs;
}
const iconCenter = (page) => page.evaluate(() => {
  const icon = document.getElementById(window.__itbId).querySelector('.itb-icon');
  const r = icon.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const at = document.elementFromPoint(x, y);
  return { x, y, ownerIsIcon: !!(at && at.closest('.itb-icon') === icon) };
});
const popState = (page) => page.evaluate(() => {
  const p = document.getElementById('grd-ifg-iconpop');
  return {
    pop: !!p,
    shown: !!(p && getComputedStyle(p).display !== 'none' && p.getBoundingClientRect().width > 0),
    upload: p ? p.querySelectorAll('[data-ifg-upload]').length : -1,
  };
});
const itbImg = (page) => page.evaluate(() => {
  const b = document.getElementById(window.__itbId);
  const img = b && b.querySelector('.itb-icon img');
  const src = img ? img.getAttribute('src') : '';
  return { img: !!img, head: src.slice(0, 22), same: !!img && src === b.dataset.imgSrc, imgSrc: (b && b.dataset.imgSrc) || '' };
});
async function clickIcon(page) {
  const c = await iconCenter(page);
  expect(c.ownerIsIcon, '전제: 아이콘 칸 가운데의 임자가 .itb-icon').toBe(true);
  await page.mouse.click(c.x, c.y);
}

test('U0 ⒞ 아이콘 클릭 → 팝오버에 「사진 올리기」 정확히 1개', async ({ page }) => {
  const errs = await setup(page);
  let chooser = 0; page.on('filechooser', () => { chooser++; });
  await clickIcon(page);
  await expect.poll(() => popState(page)).toEqual({ pop: true, shown: true, upload: 1 });
  const label = await page.evaluate(() => document.querySelector('#grd-ifg-iconpop [data-ifg-upload]').textContent.trim());
  expect(label).toBe('사진 올리기');
  expect(chooser, '1017t1m2: 아이콘 클릭은 팝오버만 — 파일창 0').toBe(0);
  expect(errs).toEqual([]);
});

test('U1 ⒝⒠ 팝오버 「사진 올리기」 → setInputFiles → 그림 · ⌘Z 한 번에 되돌림', async ({ page }) => {
  const errs = await setup(page);
  await clickIcon(page);
  await page.waitForFunction(() => !!document.querySelector('#grd-ifg-iconpop [data-ifg-upload]'));
  expect(await itbImg(page)).toEqual({ img: false, head: '', same: false, imgSrc: '' });
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#grd-ifg-iconpop [data-ifg-upload]'),
  ]);
  expect(await popState(page), '고른 순간 팝오버는 닫힌다').toEqual({ pop: false, shown: false, upload: -1 });
  await chooser.setFiles(FILE);
  await page.waitForFunction(() => !!document.getElementById(window.__itbId)?.querySelector('.itb-icon img'));
  expect(await itbImg(page)).toMatchObject({ img: true, head: 'data:image/png;base64,', same: true });

  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await page.waitForFunction(() => !document.getElementById(window.__itbId)?.querySelector('.itb-icon img'));
  expect(await itbImg(page), '⌘Z 한 번 = 올리기 전').toEqual({ img: false, head: '', same: false, imgSrc: '' });
  expect(errs).toEqual([]);
});

test('U2 ⒝⒠ 폴백(팝오버 미적재) → 아이콘 클릭 → setInputFiles → 그림', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { window.openIfgIconPopover = undefined; });
  const c = await iconCenter(page);
  expect(c.ownerIsIcon).toBe(true);
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.mouse.click(c.x, c.y),
  ]);
  expect((await popState(page)).pop).toBe(false);
  await chooser.setFiles(FILE);
  await page.waitForFunction(() => !!document.getElementById(window.__itbId)?.querySelector('.itb-icon img'));
  expect(await itbImg(page)).toMatchObject({ img: true, head: 'data:image/png;base64,', same: true });
  expect(errs).toEqual([]);
});

test('N1 ⒟ 음성대조 — 인포그래픽 칸 아이콘 팝오버엔 「사진 올리기」 0개', async ({ page }) => {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    const sec = c.querySelector('.section-block');
    window.selectSection(sec);
    const g = window.addInfographicBlock();
    window.deselectAll?.();
    const f = g && g.querySelector('.grd-img-frame[data-line]');
    if (f) { f.setAttribute('data-t-ifg', '1'); f.scrollIntoView({ block: 'center' }); }
  });
  await page.waitForFunction(() => {
    const f = document.querySelector('[data-t-ifg]');
    return !!f && f.getBoundingClientRect().width > 0;
  });
  await page.locator('[data-t-ifg]').dblclick();
  await expect.poll(() => popState(page), '전제: 인포그래픽 팝오버가 뜬다 · 항목 0').toEqual({ pop: true, shown: true, upload: 0 });
  expect(errs).toEqual([]);
});
