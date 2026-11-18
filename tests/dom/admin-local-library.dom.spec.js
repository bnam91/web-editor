/* admin-local-library — LIB-FIGMA(261118) «관리자 로컬 폴더» 라이브러리 탭 (js/panels/library-panel.js · 명부 ADMIN_LOCAL).
 * 장면은 앱의 제 문으로: 섹션 고름 → Plugins(#fp-plugin-btn) → «내장 라이브러리»(#plugin-library) → 탭 → 칸.
 * main IPC 는 하네스에 없다 ⇒ electronAPI.adminLibraryList/Read 만 가짜(부른 횟수를 센다) · 나머지는 하네스 그대로(null).
 * L1 관리자 + 폴더 있음 → «두들(피그마)»·«미모지(Inclusive)» 탭 · 화살표 = 20 + 1 · 칸 다 읽힘(지연 로드) · 다색 표시 · 나쁜 SVG 는 걸러짐
 *    두들 탭 묶음 = «기본»(102 폴더) + 더보기 폴더 이름 · 더보기 묶음 칸(SVG + 추출 실패 PNG) 다 읽힘
 *    두들 칸 클릭 → 벡터 블럭 +1 · data-color = 원래 색 · data-svg 에 currentColor · 그린 svg 는 원래 색 → 색 바꾸면 stroke 도 바뀐다
 *    미모지 = «캐릭터 N» 묶음 단추 · 칸 클릭 → 에셋 블럭 +1(webp data URL)
 * L2 음성: 일반 계정 → 새 탭 0 · 화살표 20 · adminLibraryList/Read 호출 0
 * L3 관리자인데 폴더 없음(dirs {}) → 새 탭 0 · 화살표 20
 * 양성대조(CTL · _patches/ · 파일 사본 + git apply): ⓐ _adminLocal 의 _isAdmin() 확인을 빼면 → L2 빨강(호출 수) · ⓒ normalizeMonoSvg 건너뜀 → L1 빨강(currentColor)
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const DOODLE = '<svg width="20" height="10" viewBox="0 0 20 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L19 9" stroke-width="2" stroke="#A98467"/></svg>';
const MULTI = '<svg viewBox="0 0 10 10"><path d="M0 0H5V5Z" fill="#ff0000"/><path d="M5 5H9V9Z" fill="#0000ff"/></svg>';
const EVIL = '<svg viewBox="0 0 10 10" onload="window.__pwned=1"><script>window.__pwned=2</script><path d="M0 0H9V9Z" fill="#00aa00"/></svg>';
const ARROW = '<svg width="131" height="41" viewBox="0 0 131 41" fill="none"><path d="M0 11H82V31H0Z" fill="black"/></svg>';

async function setup(page, { admin, dirs }) {
  const errs = await bootApp(page);
  await page.evaluate(async ({ admin, dirs, svgs }) => {
    const c = document.getElementById('canvas');
    if (!c.querySelector('.section-block')) await window.addSection();
    window.selectSection([...c.querySelectorAll('.section-block')].pop());
    const cv = document.createElement('canvas'); cv.width = 8; cv.height = 8; cv.getContext('2d').fillRect(0, 0, 8, 8);
    const webp = cv.toDataURL('image/webp');
    window.__libCalls = { list: 0, read: 0 };
    const base = window.electronAPI;
    window.electronAPI = new Proxy({}, { get: (_t, k) => {
      if (k === 'adminLibraryList') return async () => { window.__libCalls.list++; return { ok: true, dirs }; };
      if (k === 'adminLibraryRead') return async ({ dir, file }) => { window.__libCalls.read++; return file.endsWith('.svg') ? { ok: true, svg: svgs[file] } : { ok: true, dataUrl: webp }; };
      return base[k];
    } });
    window.__admin._forceState(admin ? { ok: true, isAdmin: true } : { ok: true, isAdmin: false, hasRoleField: true });
  }, { admin, dirs, svgs: { 'Heart_195-288.svg': DOODLE, 'Multi_1-1.svg': MULTI, 'Evil_1-2.svg': EVIL, 'Vector_191-10.svg': ARROW, '두들002_Crispy_doodles/Star_195-466.svg': DOODLE, '두들003_update/Doodle_195-784.svg': MULTI } });
  return errs;
}
const DIRS = {
  'doodle-figma-191-38': ['Evil_1-2.svg', 'Heart_195-288.svg', 'Multi_1-1.svg'],
  'arrow-figma-191-2': ['Vector_191-10.svg'],
  'doodle-figma-more': ['두들002_Crispy_doodles/024_195-468.png', '두들002_Crispy_doodles/Star_195-466.svg', '두들003_update/Doodle_195-784.svg'],
  'memoji-inclusive-192-2': ['Frame_1/b-sticker_1_192-9.webp', 'Frame_1/a-sticker_1_192-8.webp', 'Frame_3/c-sticker_1_192-20.webp'],
};
async function openLibrary(page) {
  if (!(await page.isVisible('#plugin-library'))) await page.click('#fp-plugin-btn');
  await page.click('#plugin-library');
  await expect(page.locator('#lib-modal')).toBeVisible();
}
const count = (page, sel) => page.evaluate((s) => window.getSelectedSection().querySelectorAll(s).length, sel);

test('L1 관리자 + 폴더 → 탭 · 지연 로드 · 벡터 넣기(원래 색 · 색 바꾸기) · 미모지 묶음', async ({ page }) => {
  const errs = await setup(page, { admin: true, dirs: DIRS });
  await openLibrary(page);
  await expect(page.locator('.lib-tab[data-col="figma-doodle"]')).toHaveText('두들(피그마)');
  await expect(page.locator('.lib-tab[data-col="memoji-inclusive"]')).toHaveText('미모지(Inclusive)');

  await page.click('.lib-tab[data-col="arrow"]');
  await expect(page.locator('#lib-grid .lib-item')).toHaveCount(21);
  await expect(page.locator('#lib-grid .lib-item[data-loc]')).toHaveCount(1);
  await expect(page.locator('#lib-credit')).toContainText('관리자 로컬');

  await page.click('.lib-tab[data-col="figma-doodle"]');
  await expect(page.locator('#lib-grid .lib-item')).toHaveCount(3);
  await expect(page.locator('#lib-grid .lib-item[data-loaded="1"]')).toHaveCount(3);
  await expect(page.locator('#lib-grid .lib-item[title="Multi 1-1"] .lib-name')).toHaveText('Multi 1-1 ·다색');
  await expect(page.locator('#lib-groups .lib-group')).toHaveText(['기본', '두들002_Crispy_doodles', '두들003_update']);
  await page.click('#lib-groups .lib-group:has-text("두들002_Crispy_doodles")');
  await expect(page.locator('#lib-grid .lib-item')).toHaveText(['024 195-468', 'Star 195-466']);
  await expect(page.locator('#lib-grid .lib-item[data-loaded="1"]')).toHaveCount(2);
  await expect(page.locator('#lib-grid .lib-item[data-loaded="1"] img')).toHaveCount(1);   // PNG 칸 = 그림 · SVG 칸 = 거른 svg
  await page.click('#lib-groups .lib-group:has-text("기본")');
  await expect(page.locator('#lib-grid .lib-item')).toHaveCount(3);
  expect(await page.evaluate(() => ({ p: window.__pwned, s: document.querySelectorAll('#lib-grid script, #lib-grid [onload]').length }))).toEqual({ p: undefined, s: 0 });

  const before = await count(page, '.vector-block');
  await page.click('#lib-grid .lib-item[title="Heart 195-288"]');
  await expect.poll(() => count(page, '.vector-block')).toBe(before + 1);
  const got = await page.evaluate(() => {
    const b = [...window.getSelectedSection().querySelectorAll('.vector-block')].pop();
    const drawn = b.querySelector('.vb-inner path').getAttribute('stroke'); const color = b.dataset.color;
    b.dataset.color = '#123456'; window.renderVector(b);   // 우측 패널 색 바꾸기가 쓰는 길(dataset.color → renderVector)
    return { color, libMono: b.dataset.libMono, cur: /stroke="currentColor"/.test(b.dataset.svg), drawn, after: b.querySelector('.vb-inner path').getAttribute('stroke'), w: b.dataset.w, h: b.dataset.h };
  });
  expect(got).toEqual({ color: '#a98467', libMono: '1', cur: true, drawn: '#a98467', after: '#123456', w: '200', h: '100' });

  await expect(page.locator('#lib-modal')).toBeHidden();   // 칸을 넣으면 모달이 닫힌다(기존 _insert 와 같은 꼴) → 다시 연다
  await openLibrary(page);
  await page.click('.lib-tab[data-col="memoji-inclusive"]');
  await expect(page.locator('#lib-groups .lib-group')).toHaveText(['캐릭터 1', '캐릭터 3']);
  await expect(page.locator('#lib-grid .lib-item')).toHaveText(['포즈 1', '포즈 2']);
  await expect(page.locator('#lib-grid .lib-item[data-loaded="1"] img')).toHaveCount(2);
  const a0 = await count(page, '.asset-block');
  await page.click('#lib-grid .lib-item[title="포즈 1"]');
  await expect.poll(() => count(page, '.asset-block')).toBe(a0 + 1);
  expect(await page.evaluate(() => ([...window.getSelectedSection().querySelectorAll('.asset-block')].pop().dataset.imgSrc || '').slice(0, 16))).toBe('data:image/webp;');
  expect(errs).toEqual([]);
});

test('L2 음성 — 일반 계정 → 새 탭 0 · 화살표 20 · IPC 호출 0', async ({ page }) => {
  await setup(page, { admin: false, dirs: DIRS });
  await openLibrary(page);
  await expect(page.locator('.lib-tab[data-col="doodle"]')).toHaveCount(1);
  await expect(page.locator('.lib-tab[data-col="figma-doodle"], .lib-tab[data-col="memoji-inclusive"]')).toHaveCount(0);
  await page.click('.lib-tab[data-col="arrow"]');
  await expect(page.locator('#lib-grid .lib-item')).toHaveCount(20);
  expect(await page.evaluate(() => window.__libCalls)).toEqual({ list: 0, read: 0 });
});

test('L3 관리자 · 폴더 없음 → 새 탭 0 · 화살표 20', async ({ page }) => {
  await setup(page, { admin: true, dirs: {} });
  await openLibrary(page);
  await expect(page.locator('.lib-tab[data-col="doodle"]')).toHaveCount(1);
  await expect(page.locator('.lib-tab[data-col="figma-doodle"], .lib-tab[data-col="memoji-inclusive"]')).toHaveCount(0);
  await page.click('.lib-tab[data-col="arrow"]');
  await expect(page.locator('#lib-grid .lib-item')).toHaveCount(20);
  expect(await page.evaluate(() => window.__libCalls.list)).toBe(1);
});
