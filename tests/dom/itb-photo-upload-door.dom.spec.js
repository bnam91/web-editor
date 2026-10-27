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
 *   ── 적대 검수 조건부 PASS 보완(bd3919ed 위) ──
 *   U1  ＋B-3 올리기 한 번 = 이력 +1(getHistoryTip len·pos 각 +1) ＋B-2 .itb-icon.has-image · img draggable="false"
 *   U3  ＋B-1 그림 아닌 파일(text/plain) → 토스트 · imgSrc 무변 · img 0 · has-image 0 · 이력 0(len·pos·seq 무변) · input accept="image/*"
 *   ⬜ ITB-PHOTO-SIZE-UNCAPPED-01(지디/현빈) — 크기 상한은 안 걸었다(시험 칸 없음 · 6MB 도 들어간다).
 *   ⬜ ITB-PHOTO-HIST-ASYNC-UNSEEN — 「이력을 한 틱 늦게 찍는」 비동기 변이는 이 헤드리스 자로는 못 가른다(이름만).
 * 대조 런
 *   바닥 GD1001_ROOT=<git archive 8608bb13> → U0·U1 빨강 · U2·N1 초록(옛 폴백·인포그래픽은 원래 그렇다)
 *   변이 A(_itbPickPhoto 본문 첫 줄 return) → U1·U2 «둘 다» 빨강(공용 함수 하나를 두 소비자가 쓴다)
 *   변이 B(넷째 인자 무시 · 늘 켬) → N1 빨강
 *   변이 C(사진 길 pushHistory 둘 다 빼기) → U1 빨강(이력 +1) · 변이 C2(끝 표본만 빼기 = bd3919ed 의 이력 꼴) → U1 빨강
 *   변이 D(MIME 거름 빼기) → U3 빨강
 *   ⚠️R1 실측(첫 판): 시작 표본만 있으면 dLen 0 — 꼭대기 == 라이브라 무변화 중복 차단이 버린다 ⇒ 제품에 끝 표본을 더했다.
 *   변이 E(사진 길을 옛 인라인 박기로 되돌림 · has-image/draggable 없음) → U1 빨강
 * ⛔고정 대기 없음 — waitForFunction / expect.poll / waitForEvent 만. ⛔앱 무접촉(_root-harness.bootApp).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js itb-photo-upload-door
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 2×2 빨강 PNG — FileReader 가 data:image/png;base64,… 로 읽는다. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
const FILE = { name: 'photo.png', mimeType: 'image/png', buffer: PNG };

async function setup(page) {
  /* ★파일창 가로채기를 «부팅 전에» 켠다(덧 단단히 — 실측으로 걸린 경합은 아래 모듈 적재 쪽이다).
     Playwright 는 첫 'filechooser' 구독 때 가로채기를 «비동기로» 켠다(updateSubscription → setFileChooserInterceptedBy) ⇒
     `Promise.all([waitForEvent, click])` 의 클릭이 그보다 먼저 닿을 «수» 있다. 부팅 앞에서 한 번 구독해 두면 그 틈이 없다. */
  page.on('filechooser', () => {});
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  /* ★하네스 경합 고침(113 R1 실측 2/≈70: U1 팝오버 0 · U2 파일창 0) — bootApp 의 준비 신호는 index.html:1171
     `<script type="module" src="js/blocks/grid-ifg-icon-pick.js">` 적재를 기다리지 않는다. 고부하에서 그 모듈이 늦으면
     U1 은 클릭이 폴백(파일창)으로 가고, U2 는 우리가 비운 `window.openIfgIconPopover` 를 모듈이 «뒤늦게» 다시 채워 팝오버가 뜬다.
     ⇒ 팝오버 다리가 선 뒤에 시작한다(바닥 8608bb13 에도 있는 다리라 양성대조를 흐리지 않는다). */
  await page.waitForFunction(() => typeof window.openIfgIconPopover === 'function');
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
const tip = (page) => page.evaluate(() => { const t = window.getHistoryTip(); return { pos: t.pos, len: t.len, seq: t.seq }; });
const look = (page) => page.evaluate(() => {
  const b = document.getElementById(window.__itbId);
  const icon = b && b.querySelector('.itb-icon');
  const img = icon && icon.querySelector('img');
  return { hasImage: !!(icon && icon.classList.contains('has-image')), draggable: img ? img.getAttribute('draggable') : null };
});
async function openUploadChooser(page) {
  await clickIcon(page);
  await page.waitForFunction(() => !!document.querySelector('#grd-ifg-iconpop [data-ifg-upload]'));
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#grd-ifg-iconpop [data-ifg-upload]'),
  ]);
  return chooser;
}
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
  const t0 = await tip(page);
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#grd-ifg-iconpop [data-ifg-upload]'),
  ]);
  expect(await popState(page), '고른 순간 팝오버는 닫힌다').toEqual({ pop: false, shown: false, upload: -1 });
  await chooser.setFiles(FILE);
  await page.waitForFunction(() => !!document.getElementById(window.__itbId)?.querySelector('.itb-icon img'));
  expect(await itbImg(page)).toMatchObject({ img: true, head: 'data:image/png;base64,', same: true });
  const t1 = await tip(page);
  expect({ dLen: t1.len - t0.len, dPos: t1.pos - t0.pos }, 'B-3 올리기 한 번 = 이력 +1').toEqual({ dLen: 1, dPos: 1 });
  expect(await look(page), 'B-2 아이콘 길과 같은 꼴').toEqual({ hasImage: true, draggable: 'false' });

  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await page.waitForFunction(() => !document.getElementById(window.__itbId)?.querySelector('.itb-icon img'));
  expect(await itbImg(page), '⌘Z 한 번 = 올리기 전').toEqual({ img: false, head: '', same: false, imgSrc: '' });
  expect(errs).toEqual([]);
});

test('U3 B-1 그림 아닌 파일 → 버림 · imgSrc 무변 · 이력 0', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => {
    window.__toasts = [];
    const orig = window.showToast;
    window.showToast = function (m) { window.__toasts.push(String(m)); return orig?.apply(this, arguments); };
  });
  const t0 = await tip(page);
  const chooser = await openUploadChooser(page);
  expect(await chooser.element().evaluate((el) => el.getAttribute('accept'))).toBe('image/*');
  await chooser.setFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  /* ★버렸다는 «말»(토스트) ∪ 박혀 버림 — 둘 중 먼저 오는 것 뒤에 잰다(고정 대기 0 · 거름이 빠지면 아래 단언이 바로 빨강). */
  await page.waitForFunction(() => window.__toasts.length > 0 || !!document.getElementById(window.__itbId)?.dataset.imgSrc);
  expect(await itbImg(page)).toEqual({ img: false, head: '', same: false, imgSrc: '' });
  expect(await look(page)).toEqual({ hasImage: false, draggable: null });
  expect(await tip(page), '이력 0').toEqual(t0);
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
  await page.waitForFunction(() => typeof window.ifgIconDblclick === 'function' && typeof window.addInfographicBlock === 'function');   // 위 setup 과 같은 모듈 적재 경합
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
