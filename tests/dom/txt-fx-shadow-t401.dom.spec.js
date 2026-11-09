/* txt-fx-shadow-t401.dom.spec.js — t4-01 텍스트 블럭 Effects 「효과 추가」 드롭다운에 그림자(Shadow)
 *
 * ★원문(현빈) — 「텍스트 블록의 Shadow 이펙트가 Effects의 '효과 추가' 드롭다운에 포함되어 있지 않음 · 기존 반사·글로우·자유변형 항목에
 *   Shadow(그림자) 옵션 추가 · 드롭다운에서 Shadow를 선택하면 기존 텍스트 그림자 효과가 추가되고 설정할 수 있어야 함」
 * ★팀장 — 새 그림자를 만들지 말고 «옛» 텍스트 그림자(글자칸 data-shadow-* + text-shadow)에 잇는다.
 * ★재는 것
 *   S1 목록 = 반사·그림자·글로우·자유변형(등록 순서) · 옛 Shadow 절은 없다(두 벌 금지)
 *   S2 고르면 옛 기본값 그대로 그려지고 조절칸이 카드에 뜬다 · S3 칸 → 그림 · S4 ✕ → 켜기 전 바이트
 *   S5 더하기 ⌘Z 한 번 · S6 저장 왕복 · S7 옛 저장본(그림자 켜짐) = 카드로 · S8 이웃 효과 무변
 *   ★t4-01b(팀장) 눈 — 걸림 = 그림자 키가 하나라도 있음 · 보임 = shadowEnabled 'true' (⛔새 키 0)
 *   E1 눈 꼴 = 글로우 눈 · E2 숨김 = 그림 0·값 남음·카드 남음 · E3 다시 = 같은 그림 · E4 숨김 ⌘Z 한 번
 *   E5 숨긴 채 저장 왕복 · E6 숨김 뒤 ✕ = 키 0·목록 복귀
 * ⛔고정 대기 0 — waitForFunction / expect.poll (dom-fixed-wait-census). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 장면: effects-glow.dom.spec.js setup 꼴 — [텍스트 eT 80px 파랑] [도형 eSh] */
/* pageerror(bootApp) ＋ console.error 둘 다 모은다 */
async function boot(page) {
  const errs = await bootApp(page);
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  return errs;
}
async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await boot(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="eS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="eI">
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="eR1" data-layout="stack"></div>
      <div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="eR3" data-layout="stack"></div>
      <div class="gap-block" data-type="gap" style="height:260px"></div></div></div>`);
    const { block: tb } = window.makeTextBlock('h1'); const tf = window._makeTextFrame();
    window.applyTextOpts(tb, tf, {}, 'h1'); tf.appendChild(tb); tb.id = 'eT'; tf.id = 'eTF';
    const h = tb.querySelector('[class^="tb-"]'); h.textContent = '███'; h.style.color = '#2d6fe8'; h.style.fontSize = '80px'; h.style.lineHeight = '1';
    document.getElementById('eR1').appendChild(tf);
    const { block: sb } = window.makeShapeBlock('rectangle'); sb.id = 'eSh';
    const ss = document.createElement('div'); ss.className = 'frame-block'; ss.id = 'eShF';
    ss.dataset.width = '100'; ss.dataset.height = '100'; ss.style.width = '100px'; ss.style.height = '100px';
    ss.appendChild(sb); document.getElementById('eR3').appendChild(ss);
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
  });
  await page.waitForFunction(() => !!document.querySelector('#eT [class^="tb-"]') && !!document.getElementById('eSh'));
  return errs;
}

const PANEL_OF = { eT: 'txt', eSh: 'shape' };
/** 블럭을 진짜 마우스로 고른다 — 그 블럭의 Effects 절이 뜰 때까지(안 뜨면 다시 누른다). */
const pick = async (page, id) => {
  await expect(async () => {
    await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), id);
    const p = await page.evaluate((id) => { const q = document.getElementById(id).getBoundingClientRect(); return [q.left + 6, q.top + q.height / 2]; }, id);
    await page.evaluate(() => { window.deselectAll?.(); ['txt', 'shape'].forEach(P => document.getElementById(`${P}-fx-section`)?.remove()); });
    await page.mouse.click(p[0], p[1]);
    await page.waitForFunction(([id, P]) => document.getElementById(id).classList.contains('selected') && !!document.getElementById(`${P}-fx-section`), [id, PANEL_OF[id]], { timeout: 3000 });
  }).toPass({ timeout: 20000 });
};
/** 진짜 마우스로 목록을 누르고(열기) 그 항목을 고른다. */
const choose = async (page, P, key) => {
  const sel = page.locator(`#${P}-fx-add`);
  await sel.scrollIntoViewIfNeeded();
  await sel.click();
  await sel.selectOption(key);
};
/** 진짜 마우스로 누른다(가운데). */
const clickMid = async (page, css) => {
  const p = await page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }, css);
  expect(p, `패널에 ${css}`).not.toBeNull();
  await page.mouse.click(p[0], p[1]);
};
const addList = (page, P) => page.evaluate((P) => { const a = document.getElementById(`${P}-fx-add`); return a ? [...a.options].slice(1).map(o => o.value) : null; }, P);
const addLabels = (page, P) => page.evaluate((P) => { const a = document.getElementById(`${P}-fx-add`); return a ? [...a.options].slice(1).map(o => o.textContent.trim()) : null; }, P);
const ce = '#eT [class^="tb-"]';
const shKeys = (page) => page.evaluate((s) => Object.fromEntries(Object.entries(document.querySelector(s).dataset).filter(([k]) => k.startsWith('shadow'))), ce);
const ts = (page) => page.evaluate((s) => getComputedStyle(document.querySelector(s)).textShadow, ce);
const cards = (page) => page.evaluate(() => [...document.querySelectorAll('#txt-fx-list .prop-cell-card')].map(e => e.dataset.fxType));
/** 옛 기본값(SHADOW_DEFAULTS x2 y2 blur4 #000 50%)이 그리는 computed 값 — 판에서 직접 잰다(⛔숫자 문자열을 박지 않는다). */
const defaultTs = (page) => page.evaluate(() => { const d = document.createElement('div'); d.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)'; document.body.appendChild(d); const v = getComputedStyle(d).textShadow; d.remove(); return v; });
const undo = async (page) => { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); };

test('S1 텍스트 목록 = 반사·그림자·글로우·자유변형(이 순서) · 라벨 = 「그림자」 · 옛 Shadow 절은 안 그린다(두 벌 금지)', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'eT');
  expect(await addList(page, 'txt')).toEqual(['reflect', 'shadow', 'glow', 'freetransform']);
  expect(await addLabels(page, 'txt')).toEqual(['반사', '그림자', '글로우', '자유변형']);
  await expect(page.locator('#txt-shadow-section'), '옛 절 없음').toHaveCount(0);
  await expect(page.locator('#txt-shadow-controls'), '고르기 전엔 조절칸 0').toHaveCount(0);
  expect(await shKeys(page), '목록을 열기만 해선 안 붙는다').toEqual({});
  await page.locator('#txt-fx-add').click();
  expect(await shKeys(page)).toEqual({});
  expect(errs).toEqual([]);
});

test('S2 그림자를 고르면 옛 기본값 그대로 그려지고(computed = 기본) 카드에 조절칸이 뜬다 · 목록에선 빠진다', async ({ page }) => {
  const errs = await setup(page);
  expect(await ts(page), '전제 — 그림자 없음').toBe('none');
  await pick(page, 'eT');
  await choose(page, 'txt', 'shadow');
  await page.waitForFunction(() => !!document.getElementById('txt-fxsh-card'));
  expect(await ts(page)).not.toBe('none');
  expect(await ts(page), '옛 기본값과 같은 그림').toBe(await defaultTs(page));
  expect(await shKeys(page)).toEqual({ shadowEnabled: 'true', shadowX: '2', shadowY: '2', shadowBlur: '4', shadowColor: '#000000', shadowAlpha: '50' });
  expect(await cards(page)).toEqual(['shadow']);
  await expect(page.locator('#txt-fxsh-card #txt-shadow-controls')).toBeVisible();
  await expect(page.locator('#txt-fxsh-card #txt-shadow-x-number')).toHaveValue('2');
  await expect(page.locator('#txt-fxsh-card .prop-cell-card-title')).toHaveText('그림자');
  expect(await addList(page, 'txt'), '걸린 것은 목록에서 빠진다').toEqual(['reflect', 'glow', 'freetransform']);
  await expect(page.locator('#txt-shadow-controls'), '조절칸은 한 벌').toHaveCount(1);
  expect(errs).toEqual([]);
});

test('S3 조절칸을 바꾸면 그림이 바뀐다 — X 숫자칸 7 · Blur 슬라이더(진짜 마우스) · 색 hex', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'eT');
  await choose(page, 'txt', 'shadow');
  await page.waitForFunction(() => !!document.getElementById('txt-fxsh-card'));
  const x = page.locator('#txt-shadow-x-number');
  await x.click(); await x.fill('7');
  await expect.poll(() => ts(page)).toContain('7px 2px 4px');
  expect((await shKeys(page)).shadowX).toBe('7');
  const before = (await shKeys(page)).shadowBlur;
  const b = await page.locator('#txt-shadow-blur-slider').boundingBox();
  await page.mouse.click(b.x + b.width * 0.9, b.y + b.height / 2);
  await expect.poll(async () => (await shKeys(page)).shadowBlur).not.toBe(before);
  const blur = (await shKeys(page)).shadowBlur;
  await expect.poll(() => ts(page)).toContain(`7px 2px ${blur}px`);
  const hex = page.locator('#txt-shadow-color-hex');
  await hex.click(); await hex.fill('FF0000'); await hex.press('Enter');
  await expect.poll(() => ts(page)).toContain('rgba(255, 0, 0, 0.5)');
  expect(errs).toEqual([]);
});

test('S4 ✕ → 그림 0 · 키 전부 지움 · 블럭 outerHTML 이 켜기 전과 바이트 동일 · 목록에 다시 뜬다', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => window.deselectAll?.());
  const html0 = await page.evaluate(() => document.getElementById('eT').outerHTML);
  await pick(page, 'eT');
  await choose(page, 'txt', 'shadow');
  await page.waitForFunction(() => !!document.getElementById('txt-fxsh-card'));
  await clickMid(page, '#txt-fxsh-del');
  await page.waitForFunction(() => !document.getElementById('txt-fxsh-card'));
  expect(await ts(page)).toBe('none');
  expect(await shKeys(page)).toEqual({});
  expect(await addList(page, 'txt')).toEqual(['reflect', 'shadow', 'glow', 'freetransform']);
  await page.evaluate(() => window.deselectAll?.());
  expect(await page.evaluate(() => document.getElementById('eT').outerHTML), '켜기 전 바이트').toBe(html0);
  expect(errs).toEqual([]);
});

test('S5 더하기 뒤 ⌘Z 한 번 = 더하기 전(키 0 · 그림 0) · ✕ 뒤 ⌘Z 한 번 = 다시 걸림', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'eT');
  await choose(page, 'txt', 'shadow');
  await page.waitForFunction(() => !!document.getElementById('txt-fxsh-card'));
  await undo(page);
  await expect.poll(() => shKeys(page), '더하기 ⌘Z 1').toEqual({});
  expect(await ts(page)).toBe('none');
  await pick(page, 'eT');
  expect(await addList(page, 'txt')).toContain('shadow');
  await choose(page, 'txt', 'shadow');
  await page.waitForFunction(() => !!document.getElementById('txt-fxsh-card'));
  await clickMid(page, '#txt-fxsh-del');
  await page.waitForFunction(() => !document.getElementById('txt-fxsh-card'));
  await undo(page);
  await expect.poll(async () => (await shKeys(page)).shadowEnabled, '✕ ⌘Z 1').toBe('true');
  expect(await ts(page)).toBe(await defaultTs(page));
  expect(errs).toEqual([]);
});

test('S6 저장 왕복 — 키·그림 유지 · 다시 고르면 카드(값 그대로)', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'eT');
  await choose(page, 'txt', 'shadow');
  await page.waitForFunction(() => !!document.getElementById('txt-fxsh-card'));
  const x = page.locator('#txt-shadow-x-number');
  await x.click(); await x.fill('-5');
  await expect.poll(async () => (await shKeys(page)).shadowX).toBe('-5');
  const k0 = await shKeys(page), t0 = await ts(page);
  const snap = await page.evaluate(() => window.serializeProject());
  const errs2 = await boot(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForFunction(() => !!document.getElementById('eT'));
  expect(await shKeys(page)).toEqual(k0);
  expect(await ts(page)).toBe(t0);
  await pick(page, 'eT');
  expect(await cards(page)).toEqual(['shadow']);
  await expect(page.locator('#txt-shadow-x-number')).toHaveValue('-5');
  expect(await addList(page, 'txt')).not.toContain('shadow');
  expect([...errs, ...errs2]).toEqual([]);
});

test('S7 옛 저장본(Shadow 절로 켠 그림자) — 열면 «걸린» 카드로 뜨고 목록엔 없다 · 꺼 둔 옛 값은 «걸렸지만 숨김»(t4-01b 눈)', async ({ page }) => {
  const errs = await setup(page);
  /* 옛 판이 쓰던 그대로 — 글자칸 dataset + 인라인 text-shadow(옛 _apply 와 같은 꼴) */
  await page.evaluate(() => {
    const h = document.querySelector('#eT [class^="tb-"]');
    Object.assign(h.dataset, { shadowEnabled: 'true', shadowX: '4', shadowY: '6', shadowBlur: '8', shadowColor: '#112233', shadowAlpha: '100' });
    h.style.textShadow = '4px 6px 8px #112233';
  });
  const snap = await page.evaluate(() => window.serializeProject());
  const errs2 = await boot(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForFunction(() => !!document.getElementById('eT'));
  await pick(page, 'eT');
  expect(await cards(page)).toEqual(['shadow']);
  expect(await addList(page, 'txt')).toEqual(['reflect', 'glow', 'freetransform']);
  await expect(page.locator('#txt-shadow-x-number')).toHaveValue('4');
  await expect(page.locator('#txt-shadow-y-number')).toHaveValue('6');
  await expect(page.locator('#txt-shadow-color-hex')).toHaveValue('112233');
  expect(await ts(page)).toContain('4px 6px 8px');
  /* 꺼 둔 옛 값(토글 끔 — 값은 남음) = 걸렸지만 숨긴 카드(눈 hidden) · 목록엔 없다 · 눈을 켜면 남은 값으로 켠다(옛 토글 켜기와 같다) */
  await page.evaluate(() => { const h = document.querySelector('#eT [class^="tb-"]'); h.dataset.shadowEnabled = 'false'; h.style.textShadow = ''; });
  await pick(page, 'eT');
  expect(await cards(page)).toEqual(['shadow']);
  expect(await addList(page, 'txt')).not.toContain('shadow');
  await expect(page.locator('#txt-fxsh-eye')).toHaveAttribute('aria-pressed', 'false');
  await clickMid(page, '#txt-fxsh-eye');
  await expect.poll(() => ts(page)).toContain('4px 6px 8px');
  expect([...errs, ...errs2]).toEqual([]);
});

test('S8 이웃 효과 무변 — 글로우와 합성(4겹) · 그림자 ✕ 뒤 글로우 3겹 그대로 · 도형 그림자 카드는 옛 filter 카드', async ({ page }) => {
  const errs = await setup(page);
  const nLayers = async () => { const v = await ts(page); return v === 'none' ? 0 : v.split(/,(?![^(]*\))/).length; };
  await pick(page, 'eT');
  await choose(page, 'txt', 'glow');
  await page.waitForFunction(() => !!document.getElementById('txt-fxgl-card'));
  expect(await nLayers()).toBe(3);
  await choose(page, 'txt', 'shadow');
  await page.waitForFunction(() => !!document.getElementById('txt-fxsh-card'));
  expect(await nLayers(), '글로우 3 + 그림자 1').toBe(4);
  expect(await cards(page)).toEqual(['shadow', 'glow']);
  await clickMid(page, '#txt-fxsh-del');
  await page.waitForFunction(() => !document.getElementById('txt-fxsh-card'));
  expect(await nLayers(), '글로우는 남는다').toBe(3);
  expect(await page.evaluate(() => document.getElementById('eT').dataset.fxGlow)).toBe('on');
  await choose(page, 'txt', 'reflect');
  await page.waitForFunction(() => !!document.querySelector('#txt-fx-list [data-fx-type="reflect"]'));
  expect(await page.evaluate(() => document.getElementById('eT').dataset.fxReflect)).toBe('on');
  /* 도형 — 같은 'shadow' 식구의 옛 filter 갈래 그대로 */
  await pick(page, 'eSh');
  await choose(page, 'shape', 'shadow');
  await page.waitForFunction(() => !!document.getElementById('shape-fxsh-eye'));
  expect(await page.evaluate(() => document.getElementById('eSh').style.filter)).toContain('drop-shadow');
  await expect(page.locator('#txt-shadow-controls')).toHaveCount(0);
  expect(errs).toEqual([]);
});

/* ═══ t4-01b 눈(숨김) ═══ */
const eyeState = (page) => page.evaluate(() => { const e = document.getElementById('txt-fxsh-eye'); return e ? { pressed: e.getAttribute('aria-pressed'), icon: e.innerHTML, hiddenIcon: (() => { const t = document.createElement('template'); t.innerHTML = (window.EYE_ICONS || {}).hidden || ''; return t.innerHTML; })() } : null; });
const addShadow = async (page) => { await pick(page, 'eT'); await choose(page, 'txt', 'shadow'); await page.waitForFunction(() => !!document.getElementById('txt-fxsh-card')); };
const hide = async (page) => { await clickMid(page, '#txt-fxsh-eye'); await page.waitForFunction(() => document.getElementById('txt-fxsh-eye')?.getAttribute('aria-pressed') === 'false'); };
const VALS = { shadowX: '2', shadowY: '2', shadowBlur: '4', shadowColor: '#000000', shadowAlpha: '50' };

test('E1 그림자 카드에 눈 — 글로우 카드 눈과 같은 자리·같은 마크업(id 만 다르다)', async ({ page }) => {
  const errs = await setup(page);
  await addShadow(page);
  await choose(page, 'txt', 'glow');
  await page.waitForFunction(() => !!document.getElementById('txt-fxgl-eye') && !!document.getElementById('txt-fxsh-eye'));
  const m = await page.evaluate(() => {
    const norm = (id) => { const e = document.getElementById(id); return { html: e.outerHTML.replace(/ id="[^"]*"/, ''), first: e.parentElement.firstElementChild === e, next: e.nextElementSibling.className }; };
    return { sh: norm('txt-fxsh-eye'), gl: norm('txt-fxgl-eye') };
  });
  expect(m.sh).toEqual(m.gl);
  expect(m.sh.first, '머리 첫 칸').toBe(true);
  expect(m.sh.html).toContain('class="prop-icon-btn"');
  expect(errs).toEqual([]);
});

test('E2 눈 누르기 = 그림 0 · 값 키 다 남음 · shadowEnabled false · 카드는 남고 눈은 숨김 · 목록에 안 돌아감', async ({ page }) => {
  const errs = await setup(page);
  await addShadow(page);
  await hide(page);
  expect(await ts(page)).toBe('none');
  expect(await shKeys(page)).toEqual({ shadowEnabled: 'false', ...VALS });
  expect(await cards(page)).toEqual(['shadow']);
  const e = await eyeState(page);
  expect(e.pressed).toBe('false');
  expect(e.icon).toBe(e.hiddenIcon);
  expect(await addList(page, 'txt')).not.toContain('shadow');
  await expect(page.locator('#txt-fxsh-card #txt-shadow-controls'), '숨겨도 조절칸은 보인다').toBeVisible();
  expect(errs).toEqual([]);
});

test('E3 한 번 더 누르면 숨기기 전과 같은 text-shadow', async ({ page }) => {
  const errs = await setup(page);
  await addShadow(page);
  const x = page.locator('#txt-shadow-x-number');
  await x.click(); await x.fill('-6');
  await expect.poll(async () => (await shKeys(page)).shadowX).toBe('-6');
  const t0 = await ts(page);
  expect(t0).not.toBe('none');
  await hide(page);
  expect(await ts(page)).toBe('none');
  await clickMid(page, '#txt-fxsh-eye');
  await page.waitForFunction(() => document.getElementById('txt-fxsh-eye')?.getAttribute('aria-pressed') === 'true');
  expect(await ts(page)).toBe(t0);
  expect((await shKeys(page)).shadowEnabled).toBe('true');
  expect(errs).toEqual([]);
});

test('E4 숨김 뒤 ⌘Z 한 번 = 다시 보임(같은 그림)', async ({ page }) => {
  const errs = await setup(page);
  await addShadow(page);
  const t0 = await ts(page);
  await hide(page);
  await undo(page);
  await expect.poll(async () => (await shKeys(page)).shadowEnabled, '숨김 ⌘Z 1').toBe('true');
  expect(await ts(page)).toBe(t0);
  expect(await shKeys(page)).toEqual({ shadowEnabled: 'true', ...VALS });
  expect(errs).toEqual([]);
});

test('E5 숨긴 채 저장 → 다시 열기 = 카드 있음·숨김·값 그대로·그림 0', async ({ page }) => {
  const errs = await setup(page);
  await addShadow(page);
  await hide(page);
  const k0 = await shKeys(page);
  const snap = await page.evaluate(() => window.serializeProject());
  const errs2 = await boot(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForFunction(() => !!document.getElementById('eT'));
  expect(await shKeys(page)).toEqual(k0);
  expect(await ts(page)).toBe('none');
  await pick(page, 'eT');
  expect(await cards(page)).toEqual(['shadow']);
  expect((await eyeState(page)).pressed).toBe('false');
  await expect(page.locator('#txt-shadow-x-number')).toHaveValue('2');
  expect(await addList(page, 'txt')).not.toContain('shadow');
  expect([...errs, ...errs2]).toEqual([]);
});

test('E6 숨김 뒤 ✕ = 키 전부 지움 · 카드 0 · 목록에 다시 뜬다', async ({ page }) => {
  const errs = await setup(page);
  await addShadow(page);
  await hide(page);
  await clickMid(page, '#txt-fxsh-del');
  await page.waitForFunction(() => !document.getElementById('txt-fxsh-card'));
  expect(await shKeys(page)).toEqual({});
  expect(await ts(page)).toBe('none');
  expect(await addList(page, 'txt')).toEqual(['reflect', 'shadow', 'glow', 'freetransform']);
  expect(errs).toEqual([]);
});
