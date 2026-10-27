/* inspector-row-ctx.dom.spec.js — 1020t2j1 ㉡: 인스펙터 «이미지» 줄(insp-stat-row) «우클릭» 입구
 *
 * 현빈 원문(T1-NOTE-1020 :30): 「에셋 일괄 비우기 기능 (<div class="insp-stat-row"><span class="insp-stat-label">이미지</span>
 *   <span class="insp-stat-value">0</span></div> 여기서 우클릭하면 가능하게 해줘)」
 * 바닥 8608bb13 에는 «줄 밑 단추»(210f0405 · clearRow)만 있고 «우클릭»은 아무것도 안 뜬다 ⇒ 입구를 따로 낸다.
 * 일 = 단추와 같은 js/image-handling.js clearAssetImages(현빈 확정 ⒜ «이미지만 비움 · 블록 유지» · ⌘Z 한 걸음).
 *
 * 칸(모두 «실제 우클릭» page.mouse.click(…, { button: 'right' }) · 고정 대기 0):
 *   P0 판 정체 — EXPECT_SHA(40 hex) = git -C ROOT rev-parse HEAD · 페이지가 받은 ID_FILES 바이트 sha1 = 디스크 = EXPECT_FILES_SHA1.
 *      (env 는 ~/taeyang-098/ty-specenv.py 로 이 파일의 ID_FILES 에서 파생한다 — ⛔손으로 베끼지 마라.)
 *   R1 사람 순서 — 인스펙터 탭 → «이미지» 줄 우클릭 ⇒ 메뉴가 뜨고 «이미지 3개 비우기» 가 켜져 있다 · 우클릭은 점프를 안 낸다
 *      → 항목 클릭 ⇒ ⑴ 이미지만 비움 ⑵ 블록 유지 ⑶ 이력 증가 ≤ 1 · ⌘Z 한 번에 3/3 · 메뉴 닫힘.
 *   R2 0 개 — ⒜ asset 0(줄 값 «0» · 원문이 붙인 바로 그 줄) ⒝ asset 은 있는데 이미지 0 ⇒ 메뉴는 뜨고 항목은 흐림
 *      (aria-disabled="true") · 눌러도 이력·DOM 무변 · 메뉴는 그대로.
 *   R3 지키기(점프 회귀 0) — 우클릭 → Esc 로 닫은 뒤 왼쪽 클릭이 예전대로 점프한다(값 «1/4» · 첫 asset 선택).
 *   R4 음성대조 — «텍스트» 줄 우클릭 ⇒ 메뉴 안 뜸 · 바깥 누름이면 열린 메뉴가 닫힌다.
 *
 *   ── 적대 검수 FAIL(83e3dd46) 뒤 더한 칸 ──
 *   R5⒜ 겹침 — 인스펙터 메뉴를 연 채 캔버스 블럭 우클릭 ⇒ 인스펙터 메뉴 닫힘 · 블럭 메뉴만 보임(A-1)
 *   R5⒝ 겹침 거꾸로 — 블럭 메뉴를 연 채 «이미지» 줄 우클릭 ⇒ 블럭 메뉴 감춤 · 인스펙터 메뉴만 보임
 *   R6 blur 닫기 — 창 blur ⇒ 닫힘
 *   R7 다시 그리기 — 연 채 renderInspectorPanel ⇒ 닫힘(A-2)
 *   R7b 낡은 수 — 연 뒤 이미지 하나 더 넣기 ⇒ 누를 때마다 «비운 수 = 그 순간 라벨 수»(다르면 안 비우고 라벨만 고침)
 *   R8 비운 뒤 다시 그리기 — 메뉴로 비움 → 다시 그림 ⇒ 줄 값 그대로 · 단추 0 · 다시 우클릭 ⇒ 항목 흐림
 *   검수 변이(사본 3벌, 바이트 한 곳씩): M1 blur 닫기 제거 ⇒ R6 빨강 · M2 블럭 메뉴 감추기 제거 ⇒ R5⒝ 빨강 ·
 *     M3 다시 그리기 닫기 제거 ⇒ R7 빨강.
 * 빨강→초록 기대(바닥 8608bb13 · GD1001_ROOT): P0 초록(그 판 env) · R1·R2 빨강(메뉴 없음) · R3 초록(지키는 칸) ·
 *   R4 초록(바닥엔 메뉴가 원래 없다 — 이 칸은 «고친 판에서 범위가 안 번졌나»를 잰다).
 * 장면은 하네스로 만든다(⛔현빈 실데이터). 공용부 = ./_root-harness.js (앱 통째 · 가짜 electronAPI).
 */
const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT, bootApp } = require('./_root-harness.js');

const ID_FILES = ['js/image-handling.js', 'js/inspector.js'];
const MENU = '#insp-row-ctx-menu';
const ITEM = '#insp-row-ctx-menu [data-insp-ctx="clear"]';
const sha1 = (buf) => crypto.createHash('sha1').update(buf).digest('hex');

/** 섹션 1 · 이미지 든 asset nImg + 빈 asset nEmpty + text nText. */
async function setup(page, { nImg = 3, nEmpty = 1, nText = 2 } = {}) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(({ nImg, nEmpty, nText }) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="aS" data-section="1">
      <div class="section-hitzone"></div><div class="section-inner" id="aI"></div></div>`);
    const inner = document.getElementById('aI');
    for (let i = 0; i < nImg + nEmpty; i++) {
      const r = window.makeAssetBlock(); const ab = r.block || r; ab.id = 'aA' + i;
      inner.appendChild(ab);
    }
    for (let i = 0; i < nText; i++) {
      const { block: tb } = window.makeTextBlock('h1');
      const tf = window._makeTextFrame(); window.applyTextOpts(tb, tf, {}, 'h1');
      tf.appendChild(tb); tb.id = 'aT' + i;
      tb.querySelector('[class^="tb-"]').textContent = 'T' + i;
      inner.appendChild(tf);
    }
    window.rebindAll?.();
    const colors = ['#ff6600', '#0066ff', '#22aa44'];
    for (let i = 0; i < nImg; i++) {
      const cv = document.createElement('canvas'); cv.width = 120; cv.height = 60;
      const x = cv.getContext('2d'); x.fillStyle = colors[i % colors.length]; x.fillRect(0, 0, 120, 60);
      window.updateAssetBlock?.('aA' + i, { imgSrc: cv.toDataURL('image/png') });
    }
    window.deselectAll?.(); window.applyZoom?.(100);
  }, { nImg, nEmpty, nText });
  const st = await snapAssets(page);
  /* ★전제 — 장면이 «실제로» 들어갔나. 아니면 아래가 공회전이다. */
  expect(st.length, '전제: asset 블록 수').toBe(nImg + nEmpty);
  expect(st.filter(a => a.hasImage && a.src).length, '전제: 이미지 든 asset').toBe(nImg);
  expect(new Set(st.filter(a => a.src).map(a => a.src)).size, '전제: 이미지 src 가 서로 다르다').toBe(nImg);
  return errs;
}

const snapAssets = (page) => page.evaluate(() => [...document.querySelectorAll('#aI .asset-block')].map(ab => ({
  id: ab.id,
  hasImage: ab.classList.contains('has-image'),
  src: ab.dataset.imgSrc || '',
  imgEls: ab.querySelectorAll('.asset-img').length,
  html: ab.outerHTML,
})));

/** 사람 순서 ①: 왼쪽 패널 «Inspector» 탭을 누른다. */
async function openInspector(page) {
  await page.locator('.panel-tab[data-tab="inspector"]').click();
  await expect(page.locator('#inspector-panel-body'), '전제: 인스펙터 패널이 보인다').toBeVisible();
  await expect(rowLoc(page, '이미지'), '전제: «이미지» 줄이 그려졌다').toBeVisible();
}

/** 라벨이 정확히 그 글자인 «개요» 절의 줄. */
const rowLoc = (page, label) => page.locator('#inspector-stats-body > .insp-section').first()
  .locator('.insp-stat-row').filter({ has: page.locator('.insp-stat-label', { hasText: new RegExp(`^${label}$`) }) }).first();

/** «실제 마우스»로 그 요소 가운데를 누른다(오른쪽/왼쪽). */
async function mouseOn(page, loc, button) {
  const b = await loc.boundingBox();
  expect(b, '전제: 누를 요소의 화면 사각형').toBeTruthy();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2, { button });
}

/** 점프 기록기 — 점프는 click «안에서» 동기로 값을 «1/N» 로 바꾸고 표시·선택을 붙인다. 그런데 선택이 패널을 다시 그려
 *  값이 곧 «N» 으로 돌아올 수 있다(바닥 첫 런 R3 실측: 왕복 뒤 읽으면 «4»). ⇒ window 버블(문서 위임 «뒤»)에서 그 순간을 적어 둔다.
 *  기록 = 인스펙터 안 click 마다 { value, flash, selectedId }. 우클릭은 click 을 안 내야 하므로 기록 0 이어야 한다. */
const armJumpLog = (page) => page.evaluate(() => {
  window.__jl = [];
  window.addEventListener('click', (e) => {
    const row = e.target.closest?.('#inspector-stats-body .insp-jump');
    if (!row) return;
    window.__jl.push({
      value: row.querySelector('[data-jump-value]')?.textContent.trim() ?? null,
      flash: document.querySelectorAll('.insp-jump-flash').length,
      selectedId: document.querySelector('#canvas .selected')?.id || null,
    });
  });
});
const jumpLog = (page) => page.evaluate(() => window.__jl);

const rowValue = (page, label) => rowLoc(page, label).locator('.insp-stat-value').textContent().then(s => s.trim());
const histLen = (page) => page.evaluate(() => window.getHistoryTip().len);
const undoOnce = async (page) => {
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
};

test.describe('1020t2j1 ㉡ 인스펙터 «이미지» 줄 우클릭 입구', () => {
  test('P0 판 정체 — HEAD = EXPECT_SHA · 페이지가 받은 ID_FILES sha1 = 디스크 = EXPECT_FILES_SHA1', async ({ page }) => {
    const want = process.env.EXPECT_SHA || '';
    expect(/^[0-9a-f]{40}$/.test(want), `EXPECT_SHA 는 40 hex — 받은 값 «${want}»`).toBe(true);
    let wantMap = null;
    try { wantMap = JSON.parse(process.env.EXPECT_FILES_SHA1 || ''); } catch (_) { wantMap = null; }
    expect(wantMap && typeof wantMap === 'object', `EXPECT_FILES_SHA1 은 JSON 객체 — 받은 값 «${process.env.EXPECT_FILES_SHA1 || ''}»`).toBe(true);
    expect(Object.keys(wantMap).sort(), 'EXPECT_FILES_SHA1 열쇠 = ID_FILES 그대로').toEqual([...ID_FILES].sort());
    const head = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    expect(head, `git -C ${ROOT} rev-parse HEAD`).toBe(want);
    const errs = await bootApp(page);
    for (const rel of ID_FILES) {
      const d = sha1(fs.readFileSync(path.join(ROOT, rel)));
      const got = await page.evaluate(async (r) => {
        const res = await fetch('/' + r, { cache: 'no-store' });
        if (!res.ok) return null;
        const u8 = new Uint8Array(await res.arrayBuffer());
        let s = '';
        for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        return btoa(s);
      }, rel);
      expect(got, `전제: 페이지가 ${rel} 를 받았다`).toBeTruthy();
      const sv = sha1(Buffer.from(got, 'base64'));
      expect(sv, `${rel}: 페이지가 받은 바이트 = 디스크`).toBe(d);
      expect(sv, `${rel}: 페이지가 받은 바이트 = EXPECT_FILES_SHA1`).toBe(wantMap[rel]);
    }
    expect(errs, 'pageerror').toEqual([]);
  });

  test('R1 사람 순서 — «이미지» 줄 우클릭 → «이미지 3개 비우기» ⇒ 이미지만 비움 · 블록 유지 · ⌘Z 한 걸음 · 점프 안 남', async ({ page }) => {
    const errs = await setup(page);
    await openInspector(page);
    expect(await rowValue(page, '이미지'), '전제: «이미지» 줄 값 = asset 4').toBe('4');

    await armJumpLog(page);
    await mouseOn(page, rowLoc(page, '이미지'), 'right');
    // 우클릭은 점프를 안 낸다 — 줄에 click 이 «안 닿는다»(기록 0) · 선택·표시 0.
    expect(await jumpLog(page), '우클릭 ⇒ 줄에 닿은 click 0(점프 0)').toEqual([]);
    expect(await page.evaluate(() => document.querySelectorAll('.insp-jump-flash').length), '우클릭 뒤 점프 표시 0').toBe(0);
    expect(await page.evaluate(() => document.querySelectorAll('#canvas .selected').length), '우클릭 뒤 고른 블럭 0').toBe(0);

    await expect(page.locator(MENU), '우클릭 ⇒ 메뉴가 뜬다').toBeVisible();
    const item = page.locator(ITEM);
    await expect(item, '항목 = «이미지 3개 비우기»').toContainText('이미지 3개 비우기');
    await expect(item, '비울 것 3 ⇒ 항목이 켜져 있다').toHaveAttribute('aria-disabled', 'false');

    const before = await snapAssets(page);
    const len0 = await histLen(page);
    await mouseOn(page, item, 'left');
    await expect(page.locator(MENU), '항목을 누르면 메뉴가 닫힌다').toBeHidden();
    const after = await snapAssets(page);
    const len1 = await histLen(page);

    expect(after.map(a => a.id), '⑵ asset 블록 id·순서 그대로').toEqual(before.map(a => a.id));
    for (const e of before.filter(a => !a.src)) expect(after.find(a => a.id === e.id)?.html, `⑵ 처음부터 빈 ${e.id} 바이트 무변`).toBe(e.html);
    for (const a of after) {
      expect(a.hasImage, `⑴ ${a.id} .has-image 0`).toBe(false);
      expect(a.src, `⑴ ${a.id} data-img-src 0`).toBe('');
      expect(a.imgEls, `⑴ ${a.id} .asset-img 0`).toBe(0);
    }
    expect(await page.locator('#aI .text-block').count(), '⑴ text 블록은 안 건드린다').toBe(2);
    expect(len1 - len0, '⑶ 이력 증가 ≤ 1 (블럭마다 한 걸음이면 빨강)').toBeLessThanOrEqual(1);

    await undoOnce(page);
    const undone = await snapAssets(page);
    const back = before.filter(b => b.src).filter(b => undone.find(a => a.id === b.id)?.src === b.src).length;
    expect(back, '⑶ ⌘Z 한 번에 돌아온 이미지 = 3/3 (같은 src)').toBe(3);
    expect(undone.length, '⑶ ⌘Z 뒤 asset 블록 수 무변').toBe(before.length);
    expect(errs, 'pageerror').toEqual([]);
  });

  for (const [tag, scene, wantVal] of [
    ['⒜ asset 0 (원문이 붙인 «이미지 0» 줄)', { nImg: 0, nEmpty: 0 }, '0'],
    ['⒝ asset 2 · 이미지 0', { nImg: 0, nEmpty: 2 }, '2'],
  ]) {
    test(`R2 0 개 ${tag} — 메뉴는 뜨고 항목은 흐림 · 눌러도 무변`, async ({ page }) => {
      const errs = await setup(page, scene);
      await openInspector(page);
      expect(await rowValue(page, '이미지'), `전제: «이미지» 줄 값 = ${wantVal}`).toBe(wantVal);
      await mouseOn(page, rowLoc(page, '이미지'), 'right');
      await expect(page.locator(MENU), '0 개여도 우클릭 ⇒ 메뉴가 뜬다').toBeVisible();
      const item = page.locator(ITEM);
      await expect(item, '항목은 흐림(aria-disabled=true)').toHaveAttribute('aria-disabled', 'true');
      expect(Number(await item.evaluate(el => getComputedStyle(el).opacity)), '항목이 «보이게» 흐리다(opacity < 1)').toBeLessThan(1);

      const before = await snapAssets(page);
      const len0 = await histLen(page);
      await mouseOn(page, item, 'left');
      expect(await histLen(page), '흐린 항목 누름 ⇒ 이력 무변').toBe(len0);
      expect((await snapAssets(page)).map(a => a.html), '흐린 항목 누름 ⇒ asset 바이트 무변').toEqual(before.map(a => a.html));
      await expect(page.locator(MENU), '흐린 항목을 눌러도 메뉴는 그대로(아무 일 없음)').toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator(MENU), 'Esc ⇒ 닫힘').toBeHidden();
      expect(errs, 'pageerror').toEqual([]);
    });
  }

  test('R3 지키기 — 우클릭·Esc 뒤에도 «이미지» 줄 왼쪽 클릭 점프가 예전대로 돈다', async ({ page }) => {
    const errs = await setup(page);
    await openInspector(page);
    await mouseOn(page, rowLoc(page, '이미지'), 'right');
    await page.keyboard.press('Escape');
    // 바닥엔 메뉴가 원래 없다(0 개) · 고친 판은 Esc 로 닫혔다 — 어느 쪽이든 «보이는 메뉴» 0 에서 왼쪽 클릭한다.
    if (await page.locator(MENU).count()) await expect(page.locator(MENU), '전제: Esc ⇒ 메뉴 닫힘').toBeHidden();

    await armJumpLog(page);
    await mouseOn(page, rowLoc(page, '이미지'), 'left');
    const log = await jumpLog(page);
    expect(log.length, '왼쪽 클릭 ⇒ 줄에 click 한 번').toBe(1);
    expect(log[0].value, '왼쪽 클릭 그 순간 값 «1/4»(점프 커서)').toBe('1/4');
    expect(log[0].selectedId, '왼쪽 클릭 그 순간 첫 asset 이 골라진다(selectBlock)').toBe('aA0');
    expect(log[0].flash, '왼쪽 클릭 그 순간 점프 표시 1').toBe(1);
    await expect(page.locator('#aA0'), '왼쪽 클릭 뒤에도 첫 asset 선택이 남는다').toHaveClass(/\bselected\b/);
    expect(await snapAssets(page).then(s => s.filter(a => a.hasImage).length), '점프는 아무것도 안 비운다').toBe(3);
    expect(errs, 'pageerror').toEqual([]);
  });

  test('R5⒜ 겹침 — 인스펙터 메뉴를 연 채 캔버스 블럭 우클릭 ⇒ 인스펙터 메뉴 닫힘 · 블럭 메뉴만', async ({ page }) => {
    const errs = await setup(page);
    await openInspector(page);
    await mouseOn(page, rowLoc(page, '이미지'), 'right');
    await expect(page.locator(MENU), '전제: 인스펙터 메뉴가 떴다').toBeVisible();
    await mouseOn(page, page.locator('#aA0'), 'right');
    await expect(page.locator('#block-context-menu'), '전제(양성): 블럭 우클릭 ⇒ 블럭 메뉴가 뜬다').toBeVisible();
    await expect(page.locator(MENU), 'A-1: 블럭 메뉴가 뜨면 인스펙터 메뉴는 닫힌다(둘이 같이 안 뜬다)').toBeHidden();
    expect(errs, 'pageerror').toEqual([]);
  });

  test('R5⒝ 겹침 거꾸로 — 블럭 메뉴를 연 채 «이미지» 줄 우클릭 ⇒ 블럭 메뉴 감춤 · 인스펙터 메뉴만', async ({ page }) => {
    const errs = await setup(page);
    await openInspector(page);
    await mouseOn(page, page.locator('#aA0'), 'right');
    await expect(page.locator('#block-context-menu'), '전제: 블럭 메뉴가 떴다').toBeVisible();
    await mouseOn(page, rowLoc(page, '이미지'), 'right');
    await expect(page.locator(MENU), '«이미지» 줄 우클릭 ⇒ 인스펙터 메뉴').toBeVisible();
    await expect(page.locator('#block-context-menu'), '블럭 메뉴는 감춰진다(둘이 같이 안 뜬다)').toBeHidden();
    expect(errs, 'pageerror').toEqual([]);
  });

  test('R6 blur 닫기 — 메뉴를 연 채 창이 blur 되면 닫힌다', async ({ page }) => {
    const errs = await setup(page);
    await openInspector(page);
    await mouseOn(page, rowLoc(page, '이미지'), 'right');
    await expect(page.locator(MENU), '전제: 메뉴가 떴다').toBeVisible();
    // 헤드리스엔 «다른 앱으로 가기»가 없다 — 창이 받는 그 사건(window blur)을 그대로 쏜다.
    await page.evaluate(() => window.dispatchEvent(new FocusEvent('blur')));
    await expect(page.locator(MENU), 'blur ⇒ 닫힘').toBeHidden();
    expect(errs, 'pageerror').toEqual([]);
  });

  test('R7 다시 그리기 — 메뉴를 연 채 인스펙터가 다시 그려지면 닫힌다', async ({ page }) => {
    const errs = await setup(page);
    await openInspector(page);
    await mouseOn(page, rowLoc(page, '이미지'), 'right');
    await expect(page.locator(MENU), '전제: 메뉴가 떴다').toBeVisible();
    await page.evaluate(() => window.renderInspectorPanel());
    await expect(page.locator(MENU), 'A-2: 다시 그림 ⇒ 메뉴 닫힘(옛 수가 남지 않는다)').toBeHidden();
    expect(errs, 'pageerror').toEqual([]);
  });

  test('R7b 낡은 수 — 연 뒤 이미지가 늘어도 «비운 수 = 누른 순간 라벨 수»', async ({ page }) => {
    const errs = await setup(page);
    await openInspector(page);
    await mouseOn(page, rowLoc(page, '이미지'), 'right');
    await expect(page.locator(ITEM), '전제: 라벨 3').toContainText('이미지 3개 비우기');
    // 메뉴가 열린 «뒤» 빈 aA3 에 이미지를 넣는다(넣기·협업·⌘Z 와 같은 꼴 — 캔버스만 바뀐다).
    await page.evaluate(() => {
      const cv = document.createElement('canvas'); cv.width = 40; cv.height = 40;
      cv.getContext('2d').fillRect(0, 0, 40, 40);
      window.updateAssetBlock('aA3', { imgSrc: cv.toDataURL('image/png') });
    });
    const imgN = () => page.evaluate(() => document.querySelectorAll('#aI .asset-block.has-image').length);
    expect(await imgN(), '전제: 이미지 4').toBe(4);
    const labelN = async () => Number(((await page.locator(ITEM).textContent()) || '').match(/이미지 (\d+)개/)?.[1] ?? NaN);
    const clicks = [];
    for (let k = 0; k < 3 && (await imgN()) > 0; k++) {
      if (!(await page.locator(MENU).isVisible())) await mouseOn(page, rowLoc(page, '이미지'), 'right');
      await expect(page.locator(ITEM), '전제: 항목이 켜져 있다').toHaveAttribute('aria-disabled', 'false');
      const L = await labelN();
      const n0 = await imgN();
      await mouseOn(page, page.locator(ITEM), 'left');
      const cleared = n0 - (await imgN());
      clicks.push({ L, cleared });
      expect(cleared === 0 || cleared === L, `누른 순간 라벨 ${L} · 실제로 비운 수 ${cleared} — 0(안 비움) 아니면 라벨과 같아야`).toBe(true);
      if (cleared === 0) await expect(page.locator(ITEM), '안 비웠으면 라벨이 지금 수(4)로 고쳐진다').toContainText(`이미지 ${n0}개 비우기`);
    }
    test.info().annotations.push({ type: 'R7b 누름', description: JSON.stringify(clicks) });
    expect(await imgN(), '끝: 4 장 모두 비움(세 번 안에)').toBe(0);
    expect(errs, 'pageerror').toEqual([]);
  });

  test('R8 비운 뒤 다시 그리기 — 줄 값 그대로 · 단추 0 · 다시 우클릭 ⇒ 항목 흐림', async ({ page }) => {
    const errs = await setup(page);
    await openInspector(page);
    await mouseOn(page, rowLoc(page, '이미지'), 'right');
    await mouseOn(page, page.locator(ITEM), 'left');
    await expect(page.locator(MENU), '비운 뒤 메뉴 닫힘').toBeHidden();
    await page.evaluate(() => window.renderInspectorPanel());
    expect(await rowValue(page, '이미지'), '다시 그림: «이미지» 줄 값 = 4 (블록 유지)').toBe('4');
    expect(await page.locator('#inspector-stats-body [data-insp-clear]').count(), '다시 그림: 줄 밑 단추 0(비울 것 0)').toBe(0);
    await mouseOn(page, rowLoc(page, '이미지'), 'right');
    await expect(page.locator(MENU), '다시 우클릭 ⇒ 메뉴').toBeVisible();
    await expect(page.locator(ITEM), '항목 흐림').toHaveAttribute('aria-disabled', 'true');
    expect(errs, 'pageerror').toEqual([]);
  });

  test('R4 음성대조 — «텍스트» 줄 우클릭은 메뉴를 안 띄운다 · 바깥 누름이면 열린 메뉴가 닫힌다', async ({ page }) => {
    const errs = await setup(page);
    await openInspector(page);
    expect(await rowValue(page, '텍스트'), '전제: «텍스트» 줄 값 = 2').toBe('2');
    await armJumpLog(page);
    await mouseOn(page, rowLoc(page, '텍스트'), 'right');
    expect(await page.evaluate((sel) => {
      const m = document.querySelector(sel);
      return !!m && getComputedStyle(m).display !== 'none';
    }, MENU), '«텍스트» 줄 우클릭 ⇒ 메뉴 안 보임').toBe(false);
    expect(await jumpLog(page), '«텍스트» 줄 우클릭도 점프 안 냄(click 0)').toEqual([]);

    // 바깥 누름 — 고친 판에서만 메뉴가 열린다(바닥에선 위 칸들이 빨강으로 이미 잡는다).
    await mouseOn(page, rowLoc(page, '이미지'), 'right');
    if (await page.locator(MENU).count()) {
      await expect(page.locator(MENU)).toBeVisible();
      await mouseOn(page, page.locator('.panel-tab[data-tab="inspector"]'), 'left');
      await expect(page.locator(MENU), '바깥 누름 ⇒ 닫힘').toBeHidden();
    }
    expect(errs, 'pageerror').toEqual([]);
  });
});
