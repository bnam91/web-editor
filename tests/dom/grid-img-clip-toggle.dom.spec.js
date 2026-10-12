/* grid-img-clip-toggle — ★그리드 이미지줄(사각·크롭) 「내용 자르기」 토글을 ★행위로 잰다 (2026-10-12 · 1012t1 B1 · 현빈 1010t1c2 ㈁)
 *
 * 현빈 원문 c2 — 「에셋블럭이나, 그리드 블럭에 이미지줄를 추가했을때에도 이미지 삽입할 수 있는 상황에서
 *   ‘내용자르기’ 기능이 있으면 좋겠다」. 에셋은 8e96ba92 로 들어왔고 그리드는 「범위 밖」으로 남아 있었다.
 *
 * 범위 = ★크롭 줄(h>0 ∧ imgSizePct/PosX/PosY). 넘침이 생기는 유일한 그리드 사각 장면이고, 그 줄은 이미 hidden 이다
 *   ⇒ 토글은 hidden 을 «떼는» 방향 ⇒ grid-block.js ㈐ 의 flex min-height 붕괴를 다시 열지 않는다(GC1 이 높이 무변을 잰다).
 *   크롭 없는 줄 = 그림 = 틀이라 잘릴 것이 없다 ⇒ 막고 까닭을 보인다(GC4). 원 = 자름이 곧 모양 ⇒ 토글 없음(GC5).
 *
 * 자 = 「밖 점」: 프레임 rect 오른쪽 +8px · 프레임 세로 가운데. 그 점이 «그림 rect 안»인지([전제])와
 *   `document.elementsFromPoint` 에 그 그림이 있나(hit)를 같이 잰다.
 *   ★양성대조 = GC1 — 같은 점에서 끄면 hit 가 true 가 된다 ⇒ GC0 의 false 가 «자가 죽어서»가 아님을 같은 칸 안에서 증명한다.
 *
 * 머리표: [새 것] = 9ce081f0 에서 빨강이어야 하는 단언 · [전제] = 장면 확인 · [회귀 지킴] = 옛 동작 그대로.
 * 음성대조(커밋 뒤 이벨류에이터가 잰다): ㉮ 렌더러 clipOn 고정 true ⇒ GC1·GC3 빨강 · ㉯ 패널 change 의 gridPreviewLine 주석 ⇒ GC1 빨강
 *   · ㉰ 켬일 때 clipContent:true 를 쓰게 ⇒ GC2 빨강 · ㉱ clipFamily 크롭 판정 삭제 ⇒ GC7(·GC0 checked) 빨강.
 *
 * 안 재는 것: 내보내기(PNG·HTML·Figma JSON)의 끔 상태 · 이미지 편집 모드 커밋 뒤 clipContent 생존 · 원형의 「끄면 보이나」
 *   · 실앱(일렉트론) 동선 — 이 하네스는 크롬에 렌더러만 띄운다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const CROP = { type: 'image', height: 200, imgSizePct: 220, imgPosX: -10, imgPosY: -10 };
const FR = '#gC .grd-img-frame[data-r="0"][data-c="0"][data-line="0"]';

async function build(page, line) {
  await page.evaluate(async (ln) => {
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 300;
    const x = cv.getContext('2d'); x.fillStyle = '#3366cc'; x.fillRect(0, 0, 400, 300);
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sC" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="sC-in"></div></div>');
    const { row, block } = window.makeGridBlock({ cols: [
      { width: 1, lines: [{ ...ln, imgSrc: cv.toDataURL('image/png') }] },
      { width: 1, lines: [{ type: 'body', text: '옆 칸' }] },
    ] });
    block.id = 'gC'; document.getElementById('sC-in').appendChild(row); window.rebindAll?.(); window.applyZoom?.(100);
    window.pushHistory?.('장면');   // ★기준 표본 — ⌘Z 가 «토글 전»으로 돌아갈 자리
    window.grdSetActiveLine?.(block, { r: 0, c: 0, li: 0 }); window.showGridProperties?.(block, { r: 0, c: 0, li: 0 });
  }, line);
  await page.waitForFunction(() => [...document.querySelectorAll('#gC img')].every(i => i.complete && i.naturalWidth > 0));
}
async function scene(page, line) {
  await page.setViewportSize({ width: 1500, height: 1300 });
  const errs = await bootApp(page);
  await build(page, line);
  return errs;
}
const probe = (page) => page.evaluate((sel) => {
  const f = document.querySelector(sel);
  if (!f) throw new Error('프레임을 다시 찾았는데 없다: ' + sel);
  const img = f.querySelector(':scope > img.grd-img');
  const fr = f.getBoundingClientRect(), ir = img.getBoundingClientRect();
  const x = fr.right + 8, y = fr.top + fr.height / 2;
  return {
    fw: fr.width, iw: ir.width,
    inView: x > 0 && x < innerWidth && y > 0 && y < innerHeight,
    inImg: x >= ir.left && x <= ir.right && y >= ir.top && y <= ir.bottom,
    hit: document.elementsFromPoint(x, y).includes(img),
    ov: getComputedStyle(f).overflow,
    ds: f.getAttribute('data-clip-content'),
    oh: f.offsetHeight,
  };
}, FR);
const toggle = (page) => page.evaluate(() => {
  const i = document.getElementById('grd-img-clip-toggle');
  const row = i && i.closest('.prop-row');
  const hint = document.getElementById('grd-img-clip-hint');
  return i ? {
    shown: !!(row && row.offsetParent), checked: i.checked, disabled: i.disabled,
    label: row.querySelector('.prop-label')?.textContent.trim(),
    hint: hint ? { text: hint.textContent.trim(), shown: !!hint.offsetParent } : null,
  } : null;
});
const model = (page) => page.evaluate(() => JSON.parse(document.getElementById('gC').dataset.cols)[0].lines[0]);
const frameBytes = (page) => page.evaluate((sel) => {
  const f = document.querySelector(sel);
  return { style: f.getAttribute('style'), ds: f.hasAttribute('data-clip-content'), inner: f.innerHTML };
}, FR);
const clickToggle = (page) => page.locator('label.prop-toggle:has(#grd-img-clip-toggle)').click();

test('GC0+GC1 [전제·새 것] 크롭 줄 — 기본은 자르고, 패널 토글을 끄면 틀 밖에 그림이 보인다 · 높이 무변', async ({ page }) => {
  const errs = await scene(page, CROP);
  /* GC0 [전제] 넘침이 있고 · 지금 자르고 · 토글이 떠 있고 켜져 있다 */
  const p0 = await probe(page);
  expect(p0.iw, '[전제] 그림이 틀보다 넓다(넘칠 것이 있다)').toBeGreaterThan(p0.fw);
  expect(p0.inView, '[전제] 밖 점이 화면 안이다').toBe(true);
  expect(p0.inImg, '[전제] 밖 점이 그림 rect 안이다 — 아니면 hit 는 아무것도 안 잰다').toBe(true);
  expect(p0.ov, '[회귀 지킴] 크롭 줄 기본 = overflow hidden').toBe('hidden');
  expect(p0.ds, '[회귀 지킴] 미설정 줄엔 data-clip-content 가 없다(옛 바이트)').toBe(null);
  expect(p0.hit, '[회귀 지킴] 켬(기본)인데 틀 밖에 그림이 잡힌다').toBe(false);
  const t0 = await toggle(page);
  expect(t0, '[새 것] 그리드 크롭 줄 패널에 「내용 자르기」 토글이 없다').not.toBe(null);
  expect(t0).toMatchObject({ shown: true, checked: true, disabled: false, label: '내용 자르기', hint: null });

  /* GC1 [새 것] 토글을 «클릭» ⇒ 모델 false · 표식 · visible · 밖 점에 그림 · 높이 그대로 */
  await clickToggle(page);
  await expect.poll(() => model(page).then(l => l.clipContent), { message: '★토글을 껐는데 모델에 clipContent:false 가 안 실렸다' }).toBe(false);
  const p1 = await probe(page);
  expect(p1.ds, '[새 것] 프레임에 data-clip-content="false" 가 없다').toBe('false');
  expect(p1.ov, '[새 것] 끔인데 여전히 overflow hidden').toBe('visible');
  expect(p1.inImg, '[전제] 끈 뒤에도 밖 점이 그림 rect 안이다').toBe(true);
  expect(p1.hit, '[새 것·양성대조] 끔인데 틀 밖 그림이 안 보인다 — GC0 의 false 가 «자가 죽어서»일 수 있다').toBe(true);
  expect(p1.oh, '[회귀 지킴] hidden 을 떼자 프레임 높이가 바뀌었다(㈐ flex 붕괴가 다시 열렸나)').toBe(p0.oh);
  expect((await toggle(page)).checked, '[새 것] 끈 뒤 토글이 꺼진 꼴이 아니다').toBe(false);
  expect(errs).toEqual([]);
});

test('GC2 [새 것] 다시 켜면 키를 지운다 — 프레임 산출이 처음과 글자 그대로', async ({ page }) => {
  const errs = await scene(page, CROP);
  const b0 = await frameBytes(page);
  expect(b0.ds, '[전제] 처음엔 표식이 없다').toBe(false);
  await clickToggle(page);
  await expect.poll(() => model(page).then(l => l.clipContent)).toBe(false);
  await clickToggle(page);
  await expect.poll(() => model(page).then(l => Object.prototype.hasOwnProperty.call(l, 'clipContent')),
    { message: '★다시 켰는데 모델에 clipContent 키가 남았다 — 옛 바이트 보존 규약(켬 = 키 삭제) 위반' }).toBe(false);
  expect(await frameBytes(page), '[새 것] 다시 켠 프레임 산출이 처음과 다르다').toEqual(b0);
  const p = await probe(page);
  expect([p.ov, p.hit], '[새 것] 다시 켰는데 안 자른다').toEqual(['hidden', false]);
  expect(errs).toEqual([]);
});

test('GC3 [새 것] 끔 상태가 저장·로드 왕복을 산다', async ({ page }) => {
  const errs = await scene(page, CROP);
  await clickToggle(page);
  await expect.poll(() => model(page).then(l => l.clipContent)).toBe(false);
  const snap = await page.evaluate(() => window.serializeProject());
  expect(typeof snap === 'string' && snap.includes('gC'), '[전제] 저장본에 그 그리드가 실렸다').toBe(true);
  const errs2 = await bootApp(page);
  expect(await page.evaluate(() => !!document.getElementById('gC')), '[전제] 새로 띄운 판엔 그 그리드가 없다').toBe(false);
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
  await page.waitForFunction((sel) => { const f = document.querySelector(sel); const i = f && f.querySelector('img.grd-img'); return !!(i && i.complete && i.naturalWidth > 0); }, FR);
  expect((await model(page)).clipContent, '[새 것] 로드 뒤 모델에서 clipContent:false 가 사라졌다').toBe(false);
  const p = await probe(page);
  expect(p.inImg, '[전제] 로드 뒤에도 밖 점이 그림 rect 안이다').toBe(true);
  expect([p.ds, p.ov, p.hit], '[새 것] 로드 뒤 끔이 풀렸다').toEqual(['false', 'visible', true]);
  expect([...errs, ...errs2]).toEqual([]);
});

test('GC4 [새 것] 크롭 없는 줄 — 토글은 보이되 막히고 까닭이 보인다 · 산출엔 표식 0', async ({ page }) => {
  const errs = await scene(page, { type: 'image', height: 200 });
  const t = await toggle(page);
  expect(t, '[새 것] 크롭 없는 그림 줄에 토글 줄이 아예 없다(이미지 넣을 수 있는 상황인데)').not.toBe(null);
  expect(t).toMatchObject({ shown: true, disabled: true, checked: false });
  expect(t.hint, '[새 것] 막은 까닭이 안 보인다').toEqual({ text: '자르기 전에는 그림이 틀에 꼭 맞아 잘릴 것이 없습니다', shown: true });
  const f = await page.evaluate((sel) => { const e = document.querySelector(sel); const i = e.querySelector('img.grd-img');
    const a = e.getBoundingClientRect(), b = i.getBoundingClientRect();
    return { ds: e.hasAttribute('data-clip-content'), same: Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1 }; }, FR);
  expect(f.same, '[전제] 크롭 없는 줄은 그림 = 틀(넘칠 것이 없다)').toBe(true);
  expect(f.ds, '[회귀 지킴] 크롭 없는 줄 산출에 data-clip-content 가 찍혔다').toBe(false);
  expect(errs).toEqual([]);
});

test('GC5 [새 것] 원형 줄 — 토글이 없다(자름이 곧 원 모양)', async ({ page }) => {
  const errs = await scene(page, { type: 'image', imgShape: 'circle', height: 120 });
  const pre = await page.evaluate(() => ({ circle: !!document.querySelector('#gC .grd-img-frame.grd-img-circle'), height: !!document.getElementById('grd-img-height') }));
  expect(pre, '[전제] 원 줄이고 Image 절이 떴다 — 안 떴으면 「없다」는 아무것도 안 잰다').toEqual({ circle: true, height: true });
  const el = await page.evaluate(() => { const i = document.getElementById('grd-img-clip-toggle'); return i ? !!i.closest('.prop-row').offsetParent : null; });
  expect(el, '[새 것] 원 줄에 「내용 자르기」 토글이 보인다 — 끄면 원이 사각이 된다').not.toBe(true);
  expect(errs).toEqual([]);
});

test('GC6 [새 것] 토글 한 번 = 이력 한 걸음 · ⌘Z 한 번으로 다시 자른다', async ({ page }) => {
  const errs = await scene(page, CROP);
  const t0 = await page.evaluate(() => window.getHistoryTip());
  await clickToggle(page);
  await expect.poll(() => model(page).then(l => l.clipContent)).toBe(false);
  const t1 = await page.evaluate(() => window.getHistoryTip());
  expect(t1.len - t0.len, `[새 것] 토글 한 번이 이력 칸을 1개 안 만들었다(Δlen=${t1.len - t0.len})`).toBe(1);
  await page.evaluate(() => { document.activeElement?.blur?.(); window.undo(); });
  await expect.poll(() => page.evaluate((sel) => getComputedStyle(document.querySelector(sel)).overflow, FR),
    { message: '★⌘Z 한 번으로 자름이 안 돌아왔다' }).toBe('hidden');
  expect((await model(page)).clipContent, '[새 것] ⌘Z 뒤 모델에 끔이 남았다').toBe(undefined);
  expect(errs).toEqual([]);
});

test('GC7 [새 것] 표가 크롭 프레임에서 거짓말하지 않는다 — gridCrop · 자름', async ({ page }) => {
  const errs = await scene(page, CROP);
  const r = await page.evaluate((sel) => { const f = document.querySelector(sel);
    return { fam: window.clipFamily(f), on: window.clipsContent(f), ov: getComputedStyle(f).overflow }; }, FR);
  expect(r, '[새 것] 크롭 프레임의 계열·판정이 화면(overflow hidden)과 어긋난다 — 옛 답 gridPlain/false').toEqual({ fam: 'gridCrop', on: true, ov: 'hidden' });
  /* 대조 — 크롭 없는 줄은 여전히 gridPlain(넘칠 것이 없다) */
  await build(page, { type: 'image', height: 200 });
  const q = await page.evaluate((sel) => window.clipFamily(document.querySelector(sel)), FR);
  expect(q, '[회귀 지킴] 크롭 없는 프레임이 gridCrop 으로 샜다').toBe('gridPlain');
  expect(errs).toEqual([]);
});
