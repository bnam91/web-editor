/* cert-block.dom.spec.js — A4 용지 스택(cert-block · 보이는 이름 «Documents» — 현빈 261114) (A · 현빈 261114 reframe «A4 용지들을 배치»)
 *   K1 진짜 메뉴(컴포넌트 ▾ → «Documents») → 고른 섹션에 블럭 · 세로 A4 4장(그려진 세로/가로 ≈ 1.414) · 빈 칸 = 체크무늬 ·
 *      콜아웃·지시선 0(기본 끔) · 말림 0(기본 끔) · 위 제목 0(비움) · 원형 마크·낙관·그리드·액자 0 · 층 이름 «Documents»
 *   K2 부채 스택(기본) — 왼→오 회전각이 커진다(atan2) · 이웃끼리 겹친다(화면 사각형)
 *   K3 끌어 놓기 — 용지 칸에 그림 파일을 drop → 그 칸이 img(data:image/png) · 다른 칸은 체크무늬 그대로
 *   K4 더블클릭 = 파일창(진짜 filechooser) → 그 칸 img
 *   K5 패널 «그림 넣기»(파일창) → 그 칸 img · «빼기» → 다시 체크무늬
 *   K6 옵션 «지시선 글» 켬 → 콜아웃·지시선 4 · 상태 «출원» → 칩
 *   K7 → E1 로 옮김(말림은 «이펙트» 절 · 용지마다)
 *   K8 [보안] 손댄 dataset — 글은 글자로 · 이상한 그림 주소는 빈 칸 · 핸들러 0(콜아웃 켬)
 *   K9 저장→열기 왕복(applyProjectData) — dataset 에서 다시 그린다
 *   K10 장 수 6
 *   ── 격자 모드(A4 칸 · 현빈 결정 «스택 ＋ 격자») ──
 *   G1 모드 «격자» → .cert-grid · 칸 4 · 세로 A4 · 빈 칸 체크무늬 · 회전 0
 *   G2 열 수 2 → 열 2개
 *   G3 격자에서도 끌어 놓기 · 지시선 글 켜면 칸 «아래» 글(지시선 0)
 *   ── 이펙트(현빈 «이펙트» 절 · 용지마다: 회전·기울기·끝말림·그림자) ──
 *   E1 대상 «모든 용지» — 끝말림 켬 → 용지 4장 모두 .cert-curl · 그림자 «진하게» → 4장 모두 진한 그림자
 *   E2 대상 «용지 2» — 회전 20 → 그 장만 20° 더 돈다(나머지 각도 그대로)
 *   E3 기울기 25(모든 용지) → 3D 원근(matrix3d) · 0 이면 2D 그대로
 *   E4 격자에서도 이펙트(회전) 가 먹는다
 *   양성대조: cert-block.js sheetTransform 의 `base + fx.rot` 를 `base` 로 → E2·E4 빨강 · `fx.tilt ?` 갈래를 지우면 E3 빨강
 *            · _sheetCss 의 `box-shadow:${CERT_SHADOWS[c.fx.shadow]}` 를 지우면 E1 빨강
 * 양성대조:
 *   · js/blocks/cert-block.js _bindSlotInput 의 drop 리스너(`block.addEventListener('drop', …)`)를 지우면 K3 빨강
 *   · 같은 파일 `transform:rotate(${s.rot.toFixed(2)}deg);` 를 지우면 K2 빨강
 *   · 같은 파일 `if (c.fx.curl === 'on') s.appendChild(…)` 를 지우면 E1 빨강
 *   · js/blocks/cert-layout.js collageLayout 의 `preset === 'fan' ? _fanSlots(n) :` 를 지우면 K2 빨강(기본이 auto 로 떨어져 각도 ± 번갈아)
 *   · js/blocks/cert-block.js renderCertBlock 의 `if (st.mode === 'grid') { … }` 갈래를 지우면 G1·G2·G3 빨강
 * 셀렉터 대조(제품 소스 grep): #fp-add-cert(index.html) · .fp-dropdown-trigger(#fp-component-dropdown) · .cert-sheet/.cert-ph/.cert-img/.cert-curl/.cert-callout/.cert-line/.cert-status/.cert-stage(cert-block.js)
 *   · #crt-mode/#crt-preset/#crt-count-number/#crt-cols-number/#crt-callouts/#crt-fx-target/#crt-fx-rot-number/#crt-fx-tilt-number/#crt-fx-curl/#crt-fx-shadow/.crt-img-pick/.crt-img-clear/.crt-status(prop-cert.js) · 토글 = label.prop-toggle:has(#id)(숨은 체크박스 · css/editor-props.css:242)
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

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
  return page.evaluate(() => { const b = [...document.querySelectorAll('#canvas .cert-block')].pop(); return b.id; });
}
async function openPanel(page, id) {
  await page.evaluate((id) => window.showCertProperties(document.getElementById(id)), id);
  await page.waitForSelector('#crt-preset');
}
const toggle = (page, id) => page.click(`label.prop-toggle:has(#${id})`);

test('K1 메뉴 «Documents» — 세로 A4 4장 · 체크무늬 · 옵션 다 끔', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  const r = await page.evaluate((id) => { const b = document.getElementById(id); const q = (s) => b.querySelectorAll(s).length;
    const sh = b.querySelector('.cert-sheet');
    return { sheets: q('.cert-sheet'), ph: q('.cert-sheet.cert-ph'), ratioOk: Math.abs(sh.offsetHeight / sh.offsetWidth - 297 / 210) < 0.02,   // 픽셀 반올림 여유
      checker: /conic-gradient/.test(sh.style.background || sh.style.backgroundImage || getComputedStyle(sh).backgroundImage),
      callouts: q('.cert-callout'), lines: q('.cert-line'), curl: q('.cert-curl'), head: q('.cert-head'),
      extra: q('.cert-frame, .cert-grid, .cert-f-seal'), layer: b.dataset.layerName }; }, id);
  expect(r).toEqual({ sheets: 4, ph: 4, ratioOk: true, checker: true, callouts: 0, lines: 0, curl: 0, head: 0, extra: 0, layer: 'Documents' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K2 부채 스택 — 회전 단조 · 이웃 겹침', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  const r = await page.evaluate((id) => {
    const S = [...document.querySelectorAll(`#${id} .cert-sheet`)].map((s) => { const m = new DOMMatrix(getComputedStyle(s).transform); const rc = s.getBoundingClientRect();
      return { deg: Math.atan2(m.b, m.a) * 180 / Math.PI, cx: rc.left + rc.width / 2, rc }; }).sort((a, b) => a.cx - b.cx);
    const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    return { mono: S.every((s, i) => i === 0 || s.deg > S[i - 1].deg + 0.5), overlap: S.every((s, i) => i === 0 || hit(S[i - 1].rc, s.rc)), degs: S.map((s) => s.deg.toFixed(1)) };
  }, id);
  expect(r.mono, `★부채가 아니다(각도 ${r.degs})`).toBe(true);
  expect(r.overlap, '★이웃 용지가 안 겹친다').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K3 끌어 놓기 — 그 칸만 그림', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  const dt = await page.evaluateHandle((b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const d = new DataTransfer(); d.items.add(new File([u], 'a4.png', { type: 'image/png' })); return d; }, PNG.toString('base64'));
  await page.dispatchEvent(`#${id} .cert-sheet[data-idx="2"]`, 'dragover', { dataTransfer: dt });
  await page.dispatchEvent(`#${id} .cert-sheet[data-idx="2"]`, 'drop', { dataTransfer: dt });
  await page.waitForFunction((id) => !!document.querySelector(`#${id} .cert-sheet[data-idx="2"] img.cert-img`), id, { timeout: 5000 });
  const r = await page.evaluate((id) => ({ src: document.querySelector(`#${id} .cert-sheet[data-idx="2"] img`).getAttribute('src').slice(0, 22), ph: document.querySelectorAll(`#${id} .cert-sheet.cert-ph`).length }), id);
  expect(r).toEqual({ src: 'data:image/png;base64,', ph: 3 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K4 더블클릭 = 파일창', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  // 맨 위(가장 오른쪽 · z 최대) 장의 가운데 — 다른 장에 안 가린 자리(부채는 오른쪽이 위에 쌓인다)
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.dblclick(`#${id} .cert-sheet[data-idx="3"]`)]);
  await chooser.setFiles({ name: 'a4.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForFunction((id) => !!document.querySelector(`#${id} .cert-sheet[data-idx="3"] img.cert-img`), id, { timeout: 5000 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K5 패널 «그림 넣기» · «빼기»', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await openPanel(page, id);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.crt-img-pick[data-idx="1"]')]);
  await chooser.setFiles({ name: 'a4.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForFunction((id) => !!document.querySelector(`#${id} .cert-sheet[data-idx="1"] img.cert-img`), id, { timeout: 5000 });
  await page.click('.crt-img-clear[data-idx="1"]');
  await expect(page.locator(`#${id} .cert-sheet[data-idx="1"].cert-ph`)).toHaveCount(1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K6 옵션 «지시선 글» · 상태 칩', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await openPanel(page, id);
  await toggle(page, 'crt-callouts');
  await expect(page.locator(`#${id} .cert-callout`)).toHaveCount(4);
  await expect(page.locator(`#${id} .cert-line`)).toHaveCount(4);
  await page.selectOption('.crt-status[data-idx="0"]', '출원');
  await expect(page.locator(`#${id} .cert-callout[data-idx="0"] .cert-status`)).toHaveText('출원');
  expect(errs, errs.join(' | ')).toEqual([]);
});


test('K8 [보안] 손댄 dataset', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  const r = await page.evaluate((id) => {
    const b = document.getElementById(id);
    b.dataset.callouts = 'on';
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
  expect(r.imgs).toBe(0);
  expect(r.on).toBe(0);
  expect(r.t0).toBe('<img src=x onerror="window.__pwnT=1">');
  expect(r.ph).toBe(2);
  expect(r.status).toBe(0);
  expect(r.head).toBe('<img src=x onerror="window.__pwnH=1">');
  expect(await page.evaluate(() => ['__pwnT', '__pwnI', '__pwnH'].filter((k) => window[k]))).toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K9 저장→열기 — dataset 에서 다시 그린다', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  const html = await page.evaluate((id) => {
    const clone = document.getElementById(id).closest('.section-block').cloneNode(true);
    clone.querySelectorAll('.cert-block').forEach((b) => { b.querySelectorAll(':scope > *').forEach((n) => n.remove()); });   // 저장본의 옛 그림을 지워도
    return clone.outerHTML;
  }, id);
  await page.evaluate((h) => window.applyProjectData({ canvas: h }), html);
  await page.waitForSelector('#canvas .cert-block .cert-stage');
  expect(await page.locator('#canvas .cert-block .cert-sheet').count()).toBe(4);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K10 장 수 6', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await openPanel(page, id);
  await page.fill('#crt-count-number', '6');
  await page.dispatchEvent('#crt-count-number', 'change');
  await expect(page.locator(`#${id} .cert-sheet`)).toHaveCount(6);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G1 격자 모드 — A4 칸 4', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await openPanel(page, id);
  await page.selectOption('#crt-mode', 'grid');
  await page.waitForSelector(`#${id} .cert-grid`);
  const r = await page.evaluate((id) => { const b = document.getElementById(id); const sh = b.querySelector('.cert-grid .cert-sheet');
    return { cells: b.querySelectorAll('.cert-grid .cert-cell').length, ratioOk: Math.abs(sh.offsetHeight / sh.offsetWidth - 297 / 210) < 0.02,
      checker: /conic-gradient/.test(sh.style.background || getComputedStyle(sh).backgroundImage), rot: getComputedStyle(sh).transform }; }, id);
  expect(r).toEqual({ cells: 4, ratioOk: true, checker: true, rot: 'none' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G2 격자 열 2', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await openPanel(page, id);
  await page.selectOption('#crt-mode', 'grid');
  await page.waitForSelector('#crt-cols-number');
  await page.fill('#crt-cols-number', '2');
  await page.dispatchEvent('#crt-cols-number', 'change');
  const cols = await page.evaluate((id) => getComputedStyle(document.querySelector(`#${id} .cert-grid`)).gridTemplateColumns.split(' ').length, id);
  expect(cols).toBe(2);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G3 격자 — 끌어 놓기 · 칸 아래 글', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await openPanel(page, id);
  await page.selectOption('#crt-mode', 'grid');
  await page.waitForSelector(`#${id} .cert-grid`);
  const dt = await page.evaluateHandle((b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const d = new DataTransfer(); d.items.add(new File([u], 'a4.png', { type: 'image/png' })); return d; }, PNG.toString('base64'));
  await page.dispatchEvent(`#${id} .cert-sheet[data-idx="1"]`, 'drop', { dataTransfer: dt });
  await page.waitForFunction((id) => !!document.querySelector(`#${id} .cert-grid .cert-sheet[data-idx="1"] img.cert-img`), id, { timeout: 5000 });
  await toggle(page, 'crt-callouts');
  const r = await page.evaluate((id) => { const b = document.getElementById(id); const cap = b.querySelector('.cert-cell .cert-callout'); const sh = cap?.parentElement.querySelector('.cert-sheet');
    return { caps: b.querySelectorAll('.cert-grid .cert-callout').length, lines: b.querySelectorAll('.cert-line').length, below: !!(cap && sh && cap.getBoundingClientRect().top >= sh.getBoundingClientRect().bottom - 1) }; }, id);
  expect(r).toEqual({ caps: 4, lines: 0, below: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

const angles = (page, id) => page.evaluate((id) => [...document.querySelectorAll(`#${id} .cert-sheet`)].sort((a, b) => a.dataset.idx - b.dataset.idx)
  .map((s) => { const m = new DOMMatrix(getComputedStyle(s).transform); return +(Math.atan2(m.b, m.a) * 180 / Math.PI).toFixed(1); }), id);

test('E1 모든 용지 — 끝말림·그림자', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await openPanel(page, id);
  await expect(page.locator('#crt-fx-target')).toHaveValue('all');
  await toggle(page, 'crt-fx-curl');
  await expect(page.locator(`#${id} .cert-sheet .cert-curl`)).toHaveCount(4);
  await page.selectOption('#crt-fx-shadow', 'strong');
  const sh = await page.evaluate((id) => [...document.querySelectorAll(`#${id} .cert-sheet`)].map((s) => /0\.32/.test(getComputedStyle(s).boxShadow)), id);
  expect(sh).toEqual([true, true, true, true]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('E2 용지 2 만 회전 +20', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  const before = await angles(page, id);
  await openPanel(page, id);
  await page.selectOption('#crt-fx-target', '1');
  await page.fill('#crt-fx-rot-number', '20');
  await page.dispatchEvent('#crt-fx-rot-number', 'change');
  const after = await angles(page, id);
  const d = after.map((a, i) => +(a - before[i]).toFixed(1));
  expect(d).toEqual([0, 20, 0, 0]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('E3 기울기 25 → 3D 원근', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  const t0 = await page.evaluate((id) => getComputedStyle(document.querySelector(`#${id} .cert-sheet`)).transform, id);
  expect(t0.startsWith('matrix('), '[전제] 기울기 0 = 2D').toBe(true);
  await openPanel(page, id);
  await page.fill('#crt-fx-tilt-number', '25');
  await page.dispatchEvent('#crt-fx-tilt-number', 'change');
  const t = await page.evaluate((id) => [...document.querySelectorAll(`#${id} .cert-sheet`)].map((s) => getComputedStyle(s).transform.startsWith('matrix3d(')), id);
  expect(t).toEqual([true, true, true, true]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('E4 격자에서도 회전', async ({ page }) => {
  const errs = await boot(page);
  const id = await addViaMenu(page);
  await openPanel(page, id);
  await page.selectOption('#crt-mode', 'grid');
  await page.waitForSelector(`#${id} .cert-grid`);
  await page.fill('#crt-fx-rot-number', '-8');
  await page.dispatchEvent('#crt-fx-rot-number', 'change');
  expect(await angles(page, id)).toEqual([-8, -8, -8, -8]);
  expect(errs, errs.join(' | ')).toEqual([]);
});
