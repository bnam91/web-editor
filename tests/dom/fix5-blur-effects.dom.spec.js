/* fix5-blur-effects — 에셋(이미지)블럭 블러(Redact)를 «Effects 드롭다운»으로 옮긴 것을 사람 길로 잰다 (1012t1C1 · S6 고침5)
 *
 * ★현빈 원문: 「이미지블럭에 그레인 이펙트 들어가는 것 처럼 블러 (Redact)기능도 있으면 좋겠음 👉 이펙트 드랍다운에 추가해줘야지 않니?
 *   에셋블럭의 이펙트 드랍다운 혹은 여기에 추가할까? <div id="color-adjust-header">」
 * ★해석(발주 태양): 둘 중 Effects 드롭다운(#asset-fx-add) ⇒ 「블러」 항목 · 고르면 반사·그림자처럼 효과 카드 · 옛 따로 절 지움.
 *   저장 키는 그대로(data-redact + --redact-blur · js/effects/image-redact.js) ⇒ 옛 저장본은 열면 저절로 효과 카드로 보인다.
 *
 * 칸
 *   B1 드롭다운에 「블러」 · 옛 따로 절(#asset-redact-section · 제목 「블러 (Redact)」) 0 · 그림 없는 에셋엔 항목 없음
 *   B2 고르면 효과 카드(data-fx-type="blur") · data-redact 40 · 그림 계산 filter blur(8px) · 드롭다운에서 빠짐
 *   B3 세기 — 숫자칸 60 ⇒ blur(12px) · 슬라이더 25 ⇒ blur(5px)
 *   B4 눈 끔 ⇒ filter none · data-redact 없음 · 값(60) 보존 · 눈 켬 ⇒ blur(12px) 그대로
 *   B5 ✕ ⇒ 카드 0 · 드롭다운에 「블러」 복귀 · outerHTML 에 redact 0건 · filter none
 *   B6 옛 저장(기존 키 data-redact=60 — applyImageRedact 로 쓴 것) 불러오기 ⇒ 효과 카드 · 강도 60 · filter 같은 값
 *   B7 픽셀 — 요소 스크린샷: 블러 전 줄무늬 sd · 가장자리 대비(이웃 px 최대차) 큼 ⇒ 고른 뒤 둘 다 작아짐(비 < 0.1)
 *   B9 끈 상태에서 ✕ ⇒ 카드 0 · data-redact·data-redact-off 둘 다 없음 (C1 검수 MINOR-1 · 변이 M2 «✕ 가 redactOff 를 안 지움» 을 잡는다)
 *   B10 끈 채 슬라이더 끌기 ⇒ 켜지지 않는다 — data-redact 없음 · off=끈 값 · filter none (변이 M5 «keep() 이 늘 'on'» 을 잡는다)
 *   B8 내보내기 PNG — 앱 PNG 는 클론을 CDP 로 «스크린샷»한다(js/io/export-image.js captureCloneToCanvas native 갈래 ·
 *      neutralize 안 함). 그 클론(prepareCloneForCapture)을 같은 하네스 화면에 꺼내 찍어 흐린지 잰다(양성대조: 끈 클론).
 *      html2canvas 폴백 갈래는 블러를 못 그려 «불투명 회색 덮개»가 된다(capture-safety.js — 옛 동작 그대로) ⇒ 그 사실도 단언.
 *
 * ⛔고정 대기 0(waitForFunction / expect.poll) · ⛔화면 px 사각형을 숫자와 견주지 않는다(픽셀은 locator.screenshot).
 * ★빨강 먼저(고치기 전 판 46d444b1): GD1001_ROOT=<그 판 사본> 으로 돌리면 B1·B2·B3·B4·B5·B6·B7·B8 이 빨강이어야 한다
 *   (그 판 드롭다운 = 「효과 추가… · 반사 · 그림자」 — 「블러」 없음 · 블러는 따로 절).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const RATIO_MAX = 0.1, MIN_OFF_SD = 30;

async function setupAsset(page) {
  await page.setViewportSize({ width: 1400, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.rebindAll?.(); window.deselectAll?.(); window.addSection();
    window.applyZoom?.(100);
    /* 줄무늬 PNG — 파랑/노랑 6px (흐림 판정용 · asset-redact 와 같은 그림) */
    const cv = document.createElement('canvas'); cv.width = 240; cv.height = 180;
    const x = cv.getContext('2d');
    for (let i = 0; i < 240; i += 12) { x.fillStyle = '#0000ff'; x.fillRect(i, 0, 6, 180); x.fillStyle = '#ffff00'; x.fillRect(i + 6, 0, 6, 180); }
    window.__SRC = cv.toDataURL('image/png');
    const { row, block } = window.makeAssetBlock();
    document.querySelector('.section-block .section-inner').appendChild(row);
    window.bindBlock?.(block); window.rebindAll?.();
    window.setAssetImageFromSrc(block, window.__SRC);
    block.style.width = '320px'; block.style.height = '240px'; block.style.borderRadius = '0px';
    window.__AB = block.id;
  });
  await page.waitForFunction(() => {
    const ab = document.getElementById(window.__AB);
    const img = ab && ab.querySelector('.asset-img-clip .asset-img');
    return !!(ab && ab.classList.contains('has-image') && img && img.complete && img.naturalWidth > 0);
  }, null, { timeout: 15000 });
  return errs;
}
const openPanel = async (page) => {
  await page.evaluate(() => window.showAssetProperties(document.getElementById(window.__AB)));
  await page.waitForFunction(() => !!document.getElementById('asset-fx-add') || !!document.getElementById('asset-fx-section'), null, { timeout: 5000 });
};
/** 드롭다운 항목 [값, 글] — 없으면 null */
const fxOpts = (page) => page.evaluate(() => {
  const s = document.getElementById('asset-fx-add');
  return s ? [...s.options].map((o) => [o.value, o.textContent.trim()]) : null;
});
/** 사람 길: 드롭다운에서 「블러」를 고른다. ★없으면 «바로» 빨강(선택을 기다리며 시간을 버리지 않는다). */
async function pickBlur(page) {
  const opts = await fxOpts(page);
  expect(opts, 'Effects 드롭다운이 없다').not.toBe(null);
  expect(opts, 'Effects 드롭다운에 「블러」 가 없다').toContainEqual(['blur', '블러']);
  await page.selectOption('#asset-fx-add', 'blur');
  await page.waitForFunction(() => !!document.querySelector('#asset-fx-list .prop-cell-card[data-fx-type="blur"]'), null, { timeout: 5000 });
}
const state = (page) => page.evaluate(() => {
  const ab = document.getElementById(window.__AB);
  const media = ab.querySelector(':scope > .asset-img-clip > :is(.asset-img, canvas)');
  return {
    attr: ab.getAttribute('data-redact'), off: ab.getAttribute('data-redact-off'),
    blurVar: (ab.style.getPropertyValue('--redact-blur') || '').trim(),
    filter: media ? getComputedStyle(media).filter : null,
    inline: media ? (media.style.filter || '') : null,
    outerHasRedact: /redact/i.test(ab.outerHTML),
    cards: [...document.querySelectorAll('#asset-fx-list .prop-cell-card')].map((e) => e.dataset.fxType),
    num: document.getElementById('asset-redact-number')?.value ?? null,
    sld: document.getElementById('asset-redact-slider')?.value ?? null,
  };
});
const setNumber = (page, v) => page.evaluate((val) => {
  const n = document.getElementById('asset-redact-number');
  n.value = String(val); n.dispatchEvent(new Event('change', { bubbles: true }));
}, v);
const setSlider = (page, v) => page.evaluate((val) => {
  const s = document.getElementById('asset-redact-slider');
  s.value = String(val);
  s.dispatchEvent(new Event('input', { bubbles: true }));
  s.dispatchEvent(new Event('change', { bubbles: true }));
}, v);

/* 요소 스크린샷 한 장 → 가운데 5px 가로 띠(가로 5~95%)의 B 채널 sd · 이웃 px 최대차(가장자리 대비) */
async function stripeStats(page, sel) {
  const png = await page.locator(sel).screenshot();
  return page.evaluate(async (b64) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const W = im.naturalWidth, H = im.naturalHeight;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'); ctx.drawImage(im, 0, 0);
    const x0 = Math.floor(W * 0.05), x1 = Math.ceil(W * 0.95), y = Math.floor(H / 2) - 2;
    const d = ctx.getImageData(x0, y, x1 - x0, 5).data;
    const bs = []; for (let i = 0; i < d.length; i += 4) bs.push(d[i + 2]);
    const m = bs.reduce((a, v) => a + v, 0) / bs.length;
    const sd = Math.sqrt(bs.reduce((a, v) => a + (v - m) ** 2, 0) / bs.length);
    const rowW = x1 - x0; let edge = 0;
    for (let r = 0; r < 5; r++) for (let i = 1; i < rowW; i++) edge = Math.max(edge, Math.abs(bs[r * rowW + i] - bs[r * rowW + i - 1]));
    return { w: W, h: H, sd: Math.round(sd * 10) / 10, edge };
  }, png.toString('base64'));
}
const rafs = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test('B1 드롭다운에 「블러」 · 옛 따로 절 0 · 그림 없는 에셋엔 항목 없음', async ({ page }) => {
  const errs = await setupAsset(page);
  await openPanel(page);
  const opts = await fxOpts(page);
  console.log('B1 opts', JSON.stringify(opts));
  expect(opts, 'Effects 드롭다운이 없다').not.toBe(null);
  expect(opts[0][0], '머리 항목(값 없음)이 첫째가 아니다').toBe('');
  expect(opts, 'Effects 드롭다운에 「블러」 가 없다').toContainEqual(['blur', '블러']);
  expect(opts.map((o) => o[0]), '반사·그림자가 사라졌다').toEqual(expect.arrayContaining(['reflect', 'shadow']));
  const old = await page.evaluate(() => ({
    sec: !!document.getElementById('asset-redact-section'),
    slider: !!document.getElementById('asset-redact-slider'),
    title: [...document.querySelectorAll('.prop-section-title')].some((t) => t.textContent.trim() === '블러 (Redact)'),
  }));
  expect(old, '옛 «블러 (Redact)» 따로 절이 남았다(두 곳)').toEqual({ sec: false, slider: false, title: false });
  const none = await page.evaluate(() => {
    const { row, block } = window.makeAssetBlock();
    document.querySelector('.section-block .section-inner').appendChild(row);
    window.bindBlock?.(block);
    window.showAssetProperties(block);
    const sel = document.getElementById('asset-fx-add');
    return { hasImage: block.classList.contains('has-image'), fx: !!document.getElementById('asset-fx-section'),
             blur: !!sel?.querySelector('option[value="blur"]') };
  });
  expect(none.hasImage, '전제: 빈 에셋인데 has-image').toBe(false);
  expect(none.fx, '전제: 빈 에셋 패널에 Effects 절이 없다').toBe(true);
  expect(none.blur, '그림 없는 에셋에 「블러」 가 있다(흐릴 것이 없다)').toBe(false);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B2 고르면 효과 카드 · data-redact 40 · filter blur(8px) · 드롭다운에서 빠짐', async ({ page }) => {
  const errs = await setupAsset(page);
  const s0 = await state(page);
  expect([s0.attr, s0.filter], '전제: 처음부터 흐리다').toEqual([null, 'none']);
  await openPanel(page);
  await pickBlur(page);
  await expect.poll(async () => (await state(page)).filter).toContain('blur(8px)');
  const s = await state(page);
  console.log('B2', JSON.stringify(s));
  expect(s.cards).toEqual(['blur']);
  expect([s.attr, s.blurVar, s.off]).toEqual(['40', '8px', null]);
  expect(s.inline, '합성 한 자리(writeImgFilter)가 인라인에 블러 몫을 안 썼다').toContain('blur(8px)');
  expect([s.num, s.sld], '카드 강도 칸이 상태와 다르다').toEqual(['40', '40']);
  expect((await fxOpts(page)).map((o) => o[0]), '건 뒤에도 「블러」 가 목록에 남았다').not.toContain('blur');
  const title = await page.evaluate(() => document.querySelector('#asset-fxbl-card .prop-cell-card-title')?.textContent.trim());
  expect(title).toBe('블러');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B3 세기 — 숫자칸 60 ⇒ blur(12px) · 슬라이더 25 ⇒ blur(5px)', async ({ page }) => {
  const errs = await setupAsset(page);
  await openPanel(page);
  await pickBlur(page);
  await setNumber(page, 60);
  await expect.poll(async () => (await state(page)).filter).toContain('blur(12px)');
  expect((await state(page)).attr).toBe('60');
  await setSlider(page, 25);
  await expect.poll(async () => (await state(page)).filter).toContain('blur(5px)');
  const s = await state(page);
  expect([s.attr, s.blurVar, s.num]).toEqual(['25', '5px', '25']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B4 눈 끔 ⇒ 안 흐림 · 값 보존 · 눈 켬 ⇒ 같은 값으로 다시 흐림', async ({ page }) => {
  const errs = await setupAsset(page);
  await openPanel(page);
  await pickBlur(page);
  await setNumber(page, 60);
  await expect.poll(async () => (await state(page)).attr).toBe('60');
  await page.locator('#asset-fxbl-eye').click();
  await expect.poll(async () => (await state(page)).filter, { message: '눈을 껐는데 아직 흐리다' }).toBe('none');
  const off = await state(page);
  expect([off.attr, off.blurVar, off.off], '끔 = data-redact 없음 · 값은 data-redact-off 에').toEqual([null, '', '60']);
  expect(off.cards, '끈 뒤 카드가 사라졌다(끔 ≠ 지움)').toEqual(['blur']);
  expect(off.inline, '끈 뒤에도 인라인 블러가 남았다').toBe('');
  await page.locator('#asset-fxbl-eye').click();
  await expect.poll(async () => (await state(page)).filter, { message: '눈을 켰는데 안 흐리다' }).toContain('blur(12px)');
  const on = await state(page);
  expect([on.attr, on.off]).toEqual(['60', null]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B5 ✕ ⇒ 카드 0 · 「블러」 목록 복귀 · 흔적 0', async ({ page }) => {
  const errs = await setupAsset(page);
  await openPanel(page);
  await pickBlur(page);
  await expect.poll(async () => (await state(page)).attr).toBe('40');
  await page.locator('#asset-fxbl-del').click();
  await expect.poll(async () => (await state(page)).cards, { message: '✕ 뒤에도 카드가 남았다' }).toEqual([]);
  const s = await state(page);
  expect([s.attr, s.off, s.blurVar, s.filter, s.inline]).toEqual([null, null, '', 'none', '']);
  expect(s.outerHasRedact, '✕ 뒤에도 바이트에 redact 가 남았다').toBe(false);
  expect((await fxOpts(page)).map((o) => o[0]), '✕ 뒤 「블러」 가 목록으로 안 돌아왔다').toContain('blur');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B6 옛 저장(기존 키 data-redact) 불러오기 ⇒ 효과 카드 · 강도 그대로 · filter 같은 값', async ({ page }) => {
  const errs = await setupAsset(page);
  /* 옛 판과 같은 바이트를 만든다 — 공용 문 applyImageRedact(옛 판에도 있다 · 옛 절의 슬라이더가 부르던 바로 그 함수) */
  const before = await page.evaluate(() => {
    const ab = document.getElementById(window.__AB);
    window.applyImageRedact(ab, 60);
    const media = ab.querySelector(':scope > .asset-img-clip > :is(.asset-img, canvas)');
    return { filter: getComputedStyle(media).filter, outer: ab.outerHTML.includes('data-redact="60"'), id: ab.id };
  });
  expect(before.outer, '전제: 옛 저장 키가 바이트에 없다').toBe(true);
  expect(before.filter, '전제: 옛 키로 흐리지 않다').toContain('blur(12px)');
  const snap = await page.evaluate(() => window.serializeProject());
  expect(snap.includes('data-redact=\\"60\\"') || snap.includes('data-redact="60"'), '전제: 저장본에 옛 키가 없다').toBe(true);
  expect(/redact-off/.test(snap), '전제: 옛 저장본에 새 키가 섞였다').toBe(false);
  /* 새로 띄워 불러온다(재기동과 같은 꼴 — effects-registry A6 과 같은 길) */
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.evaluate((id) => { window.__AB = id; window.applyZoom?.(100); }, before.id);
  await page.waitForFunction(() => !!document.getElementById(window.__AB), null, { timeout: 10000 });
  await expect.poll(async () => (await state(page)).filter, { message: '불러온 뒤 화면이 옛 판과 다르다' }).toBe(before.filter);
  await openPanel(page);
  const s = await state(page);
  console.log('B6', JSON.stringify(s));
  expect(s.cards, '옛 저장본이 효과 카드로 안 보인다').toEqual(['blur']);
  expect([s.attr, s.blurVar, s.num], '강도가 바뀌었다').toEqual(['60', '12px', '60']);
  expect((await fxOpts(page)) === null || !(await fxOpts(page)).some((o) => o[0] === 'blur'), '걸린 블러가 목록에도 있다(두 곳)').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B7 픽셀 — 드롭다운으로 고르면 화면이 실제로 흐려진다(sd · 가장자리 대비 비 < 0.1)', async ({ page }) => {
  const errs = await setupAsset(page);
  const sel = `[id="${await page.evaluate(() => window.__AB)}"] > .asset-img-clip`;
  await page.evaluate(() => { window.deselectAll?.(); document.getElementById(window.__AB).scrollIntoView({ block: 'center', inline: 'center' }); });
  await rafs(page);
  const offS = await stripeStats(page, sel);
  await openPanel(page);
  await pickBlur(page);
  await page.evaluate(() => { window.deselectAll?.(); document.getElementById(window.__AB).scrollIntoView({ block: 'center', inline: 'center' }); });
  await expect.poll(async () => (await state(page)).filter).toContain('blur(8px)');
  await rafs(page);
  const onS = await stripeStats(page, sel);
  const ratio = { sd: Math.round(onS.sd / Math.max(1, offS.sd) * 1000) / 1000, edge: Math.round(onS.edge / Math.max(1, offS.edge) * 1000) / 1000 };
  console.log('B7', JSON.stringify({ offS, onS, ratio }));
  expect(offS.sd, '양성대조: 고르기 전 줄무늬가 안 보인다 ⇒ 이 자는 흐림을 못 가른다').toBeGreaterThan(MIN_OFF_SD);
  expect(offS.edge, '양성대조: 고르기 전 가장자리 대비가 약하다').toBeGreaterThan(MIN_OFF_SD);
  expect(ratio.sd, '골랐는데 줄무늬(sd)가 남는다 — 안 흐려졌다').toBeLessThan(RATIO_MAX);
  expect(ratio.edge, '골랐는데 가장자리 대비가 남는다 — 안 흐려졌다').toBeLessThan(RATIO_MAX);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B8 내보내기 PNG — 네이티브 클론(스크린샷 갈래)이 흐리다 · html2canvas 폴백은 불투명 덮개(옛 동작)', async ({ page }) => {
  test.setTimeout(60000);
  const errs = await setupAsset(page);
  await openPanel(page);
  await pickBlur(page);
  await setNumber(page, 60);
  await expect.poll(async () => (await state(page)).attr).toBe('60');
  /* 클론을 만들어 화면 «안»으로 꺼낸다 — 앱은 CDP captureBeyondViewport 로 화면 밖 클론을 찍지만 하네스엔 그 문이 없다 */
  const mkClone = (tag) => page.evaluate(async (t) => {
    const X = await import('/js/io/export-image.js');
    const sec = document.getElementById(window.__AB).closest('.section-block');
    const clone = await X.prepareCloneForCapture(sec, sec.offsetWidth, true);
    clone.dataset.tClone = t;
    clone.style.top = '0px'; clone.style.zIndex = '2147483000';
    const ab = clone.querySelector('.asset-block');
    ab.dataset.tCloneAb = t;
    const media = ab.querySelector(':scope > .asset-img-clip > :is(.asset-img, canvas)');
    return { redact: ab.getAttribute('data-redact'), filter: getComputedStyle(media).filter, src: !!media.getAttribute('src') };
  }, tag);
  const on = await mkClone('on');
  await rafs(page);
  const onS = await stripeStats(page, '[data-t-clone-ab="on"] > .asset-img-clip');
  /* h2c 폴백 — 같은 클론에 안전실패를 걸면 그림이 걷히고 불투명 회색(옛 동작 · 이번에 안 바꿈) */
  const h2c = await page.evaluate(async () => {
    const C = await import('/js/io/capture-safety.js');
    const live = document.querySelector('[data-t-clone="on"]');
    const c2 = live.cloneNode(true);
    C.neutralizeRedactForH2C(c2);
    const ab = c2.querySelector('.asset-block');
    const box = ab.querySelector(':scope > .asset-img-clip');
    const r = { imgSrc: ab.querySelector('img')?.getAttribute('src') ?? null, boxBg: box.style.backgroundColor };
    live.remove();
    return r;
  });
  /* 양성대조 — 눈을 끈 블럭의 클론은 줄무늬가 보여야 한다 */
  await page.locator('#asset-fxbl-eye').click();
  await expect.poll(async () => (await state(page)).attr).toBe(null);
  const off = await mkClone('off');
  await rafs(page);
  const offS = await stripeStats(page, '[data-t-clone-ab="off"] > .asset-img-clip');
  await page.evaluate(() => document.querySelector('[data-t-clone="off"]')?.remove());
  const ratio = Math.round(onS.sd / Math.max(1, offS.sd) * 1000) / 1000;
  console.log('B8', JSON.stringify({ on, off, onS, offS, ratio, h2c }));
  expect([on.redact, on.src], '클론에 블러 키·그림이 안 실렸다').toEqual(['60', true]);
  expect(on.filter, '클론 그림의 filter 에 블러가 없다').toContain('blur(12px)');
  expect(off.filter, '양성대조: 끈 클론이 흐리다').toBe('none');
  expect(offS.sd, '양성대조: 끈 클론에 줄무늬가 안 보인다').toBeGreaterThan(MIN_OFF_SD);
  expect(ratio, '내보내기 클론이 안 흐리다').toBeLessThan(RATIO_MAX);
  expect(h2c.imgSrc, 'h2c 폴백 클론에 원본 src 가 남았다').toBe(null);
  expect(h2c.boxBg, 'h2c 폴백 덮개가 불투명 회색(REDACT_OPAQUE_FILL)이 아니다').toBe('rgb(74, 74, 74)');
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ── C1 적대 검수 MINOR-1 — 살아남은 변이 둘을 잡는 칸 ─────────────────────────────── */
test('B9 끈 상태에서 ✕ ⇒ 카드 0 · data-redact·data-redact-off 둘 다 없음', async ({ page }) => {
  const errs = await setupAsset(page);
  await openPanel(page);
  await pickBlur(page);
  await setNumber(page, 60);
  await expect.poll(async () => (await state(page)).attr).toBe('60');
  await page.locator('#asset-fxbl-eye').click();
  await expect.poll(async () => (await state(page)).off, { message: '전제: 눈을 껐는데 값이 data-redact-off 로 안 갔다' }).toBe('60');
  expect((await state(page)).attr, '전제: 끈 뒤에도 data-redact 가 남았다').toBe(null);
  await page.locator('#asset-fxbl-del').click();
  await expect.poll(async () => (await state(page)).cards, { message: '끈 상태 ✕ 뒤에도 카드가 남았다' }).toEqual([]);
  const s = await state(page);
  expect([s.attr, s.off], '끈 상태 ✕ 뒤 키가 남았다(다시 열면 «끈 블러 카드»가 살아난다)').toEqual([null, null]);
  expect(s.outerHasRedact, '끈 상태 ✕ 뒤 바이트에 redact 가 남았다').toBe(false);
  expect((await fxOpts(page)).map((o) => o[0]), '✕ 뒤 「블러」 가 목록으로 안 돌아왔다').toContain('blur');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B10 끈 채 슬라이더 끌기 ⇒ 켜지지 않는다 — data-redact 없음 · off=끈 값 · filter none', async ({ page }) => {
  const errs = await setupAsset(page);
  await openPanel(page);
  await pickBlur(page);
  await setNumber(page, 60);
  await expect.poll(async () => (await state(page)).attr).toBe('60');
  await page.locator('#asset-fxbl-eye').click();
  await expect.poll(async () => (await state(page)).off, { message: '전제: 눈을 껐는데 값이 data-redact-off 로 안 갔다' }).toBe('60');
  await setSlider(page, 30);
  await expect.poll(async () => (await state(page)).off, { message: '끈 채 끈 값이 data-redact-off 에 안 실렸다' }).toBe('30');
  const s = await state(page);
  expect(s.attr, '끈 채 슬라이더를 끌었더니 블러가 켜졌다(눈이 꺼져 있는데)').toBe(null);
  expect([s.filter, s.inline], '끈 채 끌었는데 그림이 흐리다').toEqual(['none', '']);
  expect(s.cards, '카드가 사라졌다(끔 ≠ 지움)').toEqual(['blur']);
  expect(s.num, '숫자칸이 슬라이더를 안 따라왔다').toBe('30');
  expect(errs, errs.join(' | ')).toEqual([]);
});
