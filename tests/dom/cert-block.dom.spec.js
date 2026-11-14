/* cert-block.dom.spec.js — 인증서 블럭(A · 현빈 GO 261114 · 참값 cert-pilot/rep4/r3.jpg)
 *   K1 진짜 메뉴(컴포넌트 ▾ → Certificate) → 고른 섹션에 블럭 · 기본 = 흩뿌린 콜라주 · 증서 4(자리표시) · 지시선 4 · 콜아웃 4 · 헤드라인
 *   K2 콜라주 모양 — 네 장의 회전각이 모두 다르다(대칭 부채 아님) · 위 글 콜아웃은 그 종이 «위», 아래 글은 «아래»(화면 사각형으로 잼)
 *   K3 패널 — 모드 «스캔 그리드»로 바꾸면 .cert-grid 4칸 · 열 수 2 → 열 2개
 *   K4 패널 — 모드 «액자 증서» = 이중 테두리 · 제목 · 낙관 자리표시 「인」
 *   K5 상태 칩 — 증서 1 상태 «출원» → 그 콜아웃에 .cert-status «출원»
 *   K6 이미지 넣기 — 패널 «이미지 넣기» → 파일창(진짜 filechooser) → 그 장이 img(data:image/png) · 자리표시 사라짐
 *   K7 장 수 6 → 종이 6 · 콜아웃 6
 *   K8 [보안] dataset 글·그림을 손댄 저장본 — 인증명의 <img onerror> 는 글자로만 · img 주소 javascript: 는 자리표시로 · 핸들러 0
 *   K9 저장→열기 왕복 — applyProjectData 로 다시 열면 dataset 에서 다시 그린다(종이 4)
 * 양성대조:
 *   · js/blocks/cert-block.js `transform:rotate(${s.rot.toFixed(2)}deg);` 를 지우면 K2 빨강(회전 0 = 모두 같음)
 *   · js/blocks/cert-block.js certImgOk 정규식을 `/./` 로 바꾸면 K8 빨강(javascript: 가 img 로)
 *   · js/props/prop-cert.js 모드 change 의 `rerender();` 를 지우면 K3·K4 빨강(그림이 안 바뀜)
 * ⚠️자리표시·샘플만 — 실제 증서·인증마크 0.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function boot(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); window.deselectAll?.(); window.selectSection(c.querySelector('.section-block'));
  });
  return errs;
}
async function addViaMenu(page) {
  await page.click('#fp-component-dropdown .fp-dropdown-trigger');
  await page.click('#fp-add-cert');
  await page.waitForSelector('#canvas .cert-block .cert-stage');
  return page.evaluate(() => { const b = [...document.querySelectorAll('#canvas .cert-block')].pop(); b.id = b.id || 'crt_qa'; return b.id; });
}
async function openPanel(page, id) {
  await page.evaluate((id) => window.showCertProperties(document.getElementById(id)), id);
  await page.waitForSelector('#crt-mode');
}

test('K1 메뉴로 추가 — 기본 콜라주 4장', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  const r = await page.evaluate((id) => { const b = document.getElementById(id); const q = (s) => b.querySelectorAll(s).length;
    return { mode: b.dataset.mode, sheets: q('.cert-sheet'), ph: q('.cert-sheet.cert-ph'), lines: q('.cert-line'), callouts: q('.cert-callout'), head: b.querySelector('.cert-headline')?.textContent || '' }; }, id);
  expect(r).toEqual({ mode: 'collage', sheets: 4, ph: 4, lines: 4, callouts: 4, head: '믿을 수 있는 인증을 받았습니다' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K2 콜라주 — 제각각 회전 · 콜아웃 위/아래', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  const r = await page.evaluate((id) => {
    const b = document.getElementById(id);
    // 각도 = atan2(b, a) — .a(=cosθ)만 세면 +θ·−θ 가 한 값으로 묶인다(s17 은 +4°·−4° 를 같이 갖는다 · 인텔 545fd6640 실측 distinct 3)
    const rots = [...b.querySelectorAll('.cert-sheet')].map((s) => { const m = new DOMMatrix(getComputedStyle(s).transform); return (Math.atan2(m.b, m.a) * 180 / Math.PI).toFixed(2); });
    const pairs = [...b.querySelectorAll('.cert-callout')].map((c) => {
      const s = b.querySelector(`.cert-sheet[data-idx="${c.dataset.idx}"]`).getBoundingClientRect(); const k = c.getBoundingClientRect();
      const up = c.style.transform.includes('-100%');
      return { up, ok: up ? k.bottom <= s.top + 1 : k.top >= s.bottom - 1 };
    });
    return { distinct: new Set(rots).size, pairs };
  }, id);
  expect(r.distinct, '★회전각이 같은 종이가 있다(부채·격자 꼴)').toBe(4);
  expect(r.pairs.filter((p) => p.up).length, '[전제] 위 글 콜아웃이 있다').toBeGreaterThan(0);
  expect(r.pairs.filter((p) => !p.up).length, '[전제] 아래 글 콜아웃이 있다').toBeGreaterThan(0);
  expect(r.pairs.every((p) => p.ok), `★콜아웃이 종이와 겹쳤다 ${JSON.stringify(r.pairs)}`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K3 패널 — 스캔 그리드 · 열 2', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await openPanel(page, id);
  await page.selectOption('#crt-mode', 'grid');
  await page.waitForSelector(`#${id} .cert-grid`);
  expect(await page.locator(`#${id} .cert-grid .cert-cell`).count()).toBe(4);
  await page.fill('#crt-cols-number', '2');
  await page.dispatchEvent('#crt-cols-number', 'change');
  const cols = await page.evaluate((id) => getComputedStyle(document.querySelector(`#${id} .cert-grid`)).gridTemplateColumns.split(' ').length, id);
  expect(cols).toBe(2);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K4 패널 — 액자 증서', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await openPanel(page, id);
  await page.selectOption('#crt-mode', 'frame');
  await page.waitForSelector(`#${id} .cert-frame`);
  const r = await page.evaluate((id) => { const f = document.querySelector(`#${id} .cert-frame`); const cs = getComputedStyle(f);
    return { style: cs.borderTopStyle, w: parseFloat(cs.borderTopWidth), title: f.querySelector('.cert-f-title').textContent, seal: f.querySelector('.cert-f-seal').textContent, stage: !!document.querySelector(`#${id} .cert-stage`) }; }, id);
  expect(r).toEqual({ style: 'double', w: 10, title: '인 증 서', seal: '인', stage: false });
  await expect(page.locator('#crt-ftitle'), '액자 모드 패널 = 증서 내용 칸').toHaveCount(1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K5 상태 칩 «출원»', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await openPanel(page, id);
  await page.selectOption('.crt-status[data-idx="0"]', '출원');
  await expect(page.locator(`#${id} .cert-callout[data-idx="0"] .cert-status`)).toHaveText('출원');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K6 이미지 넣기 — 진짜 파일창', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await openPanel(page, id);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.crt-img-pick[data-idx="1"]')]);
  await chooser.setFiles({ name: 'cert.png', mimeType: 'image/png', buffer: png });
  await page.waitForFunction((id) => !!document.querySelector(`#${id} .cert-sheet[data-idx="1"] img.cert-img`), id, { timeout: 5000 });
  const r = await page.evaluate((id) => { const s = document.querySelector(`#${id} .cert-sheet[data-idx="1"]`);
    return { src: s.querySelector('img').getAttribute('src').slice(0, 22), ph: s.classList.contains('cert-ph'), others: document.querySelectorAll(`#${id} .cert-sheet.cert-ph`).length }; }, id);
  expect(r).toEqual({ src: 'data:image/png;base64,', ph: false, others: 3 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K7 장 수 6', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await openPanel(page, id);
  await page.fill('#crt-count-number', '6');
  await page.dispatchEvent('#crt-count-number', 'change');
  await expect(page.locator(`#${id} .cert-sheet`)).toHaveCount(6);
  await expect(page.locator(`#${id} .cert-callout`)).toHaveCount(6);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K8 [보안] 손댄 dataset — 글은 글자로 · 이상한 그림 주소는 자리표시', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  const r = await page.evaluate((id) => {
    const b = document.getElementById(id);
    b.dataset.certs = JSON.stringify([
      { title: '<img src=x onerror="window.__pwnT=1">', desc: '<b>x</b>', img: 'javascript:window.__pwnI=1', status: '' },
      { title: 'ok', desc: 'ok', img: 'data:text/html;base64,PHNjcmlwdD4=', status: '<script>' },
    ]);
    b.dataset.headline = '<img src=x onerror="window.__pwnH=1">';
    window.renderCertBlock(b);
    const all = [...b.querySelectorAll('*')];
    return { imgs: b.querySelectorAll('img').length, on: all.filter((e) => [...e.attributes].some((a) => /^on/i.test(a.name))).length,
      t0: b.querySelector('.cert-callout[data-idx="0"] .cert-ct').textContent, ph: b.querySelectorAll('.cert-sheet.cert-ph').length,
      status: b.querySelectorAll('.cert-status').length, head: b.querySelector('.cert-headline').textContent };
  }, id);
  expect(r.imgs, '★손댄 저장본에서 img 가 생겼다').toBe(0);
  expect(r.on).toBe(0);
  expect(r.t0).toBe('<img src=x onerror="window.__pwnT=1">');
  expect(r.ph, '이상한 그림 주소는 자리표시로').toBe(2);
  expect(r.status, '모르는 상태 값은 안 그린다').toBe(0);
  expect(r.head).toBe('<img src=x onerror="window.__pwnH=1">');
  expect(await page.evaluate(() => ['__pwnT', '__pwnI', '__pwnH'].filter((k) => window[k]))).toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K9 저장→열기 — dataset 에서 다시 그린다', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  const html = await page.evaluate((id) => {
    const sec = document.getElementById(id).closest('.section-block');
    const clone = sec.cloneNode(true);
    clone.querySelectorAll('.cert-block').forEach((b) => { b.querySelectorAll(':scope > *').forEach((n) => n.remove()); });   // 저장본의 옛 그림을 지워도
    return clone.outerHTML;
  }, id);
  await page.evaluate((h) => window.applyProjectData({ canvas: h }), html);
  await page.waitForSelector('#canvas .cert-block .cert-stage');
  expect(await page.locator('#canvas .cert-block .cert-sheet').count()).toBe(4);
  expect(errs, errs.join(' | ')).toEqual([]);
});
