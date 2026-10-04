/* effects-reflection.dom.spec.js — E1 Effects 절 + 바닥 리플렉션(지디 판정 D1 ㉮ box-reflect · D2 ㉠ 다음 블럭을 민다).
 *
 * ★재는 것: 패널(진짜 마우스 ＋·눈·✕·접기·슬라이더) · 데이터 키 넷 · 블럭 인라인 -webkit-box-reflect · 아래 여백(섹션 높이 = 수) ·
 *   옛 문서 바이트 동일(같은 판에서 «핀 6119145c 파일»을 실어 같은 장면을 직렬화해 비교) · innerText «두 번 읽기» 0 ·
 *   PNG: 클론 스크린샷(=크로미움 합성기 — 주 경로와 같은 렌더러)에 반사 픽셀 · html2canvas 대체 경로엔 «안 나온다»(의도됨 · 고정) ·
 *   ⌘Z 한 걸음 · 저장 왕복 · E57 · E64(회전 여백 합 · 오버레이 · 말풍선/라벨/그리드 = 대상 밖).
 * ★주 경로 «진짜» CDP 네이티브 캡처는 실앱 격리 판(scratchpad e1real.js)이 잰다 — 이 하네스엔 electronAPI.captureSection 이 없다.
 * ★양성대조: GD1001_ROOT=<6119145c 체크아웃> 에서 R* 빨강 · P0 초록. ⛔HEAD 금지.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/effects-reflection.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { bootApp, ROOT, ORIGIN } = require('./_root-harness.js');

const PIN = '6119145c';
/* 시안(지디 goditor-effects-reflection.html) 슬라이더 값 — 범위·기본값을 «그대로» 빌린다(지디 판정). 흐림은 뺐다. */
const MOCK = { gap: { min: -20, max: 40, def: 4 }, len: { min: 10, max: 100, def: 55 }, op: { min: 0, max: 100, def: 35 } };

async function px(page, pts) {
  const buf = await page.screenshot();
  return page.evaluate(async ({ b64, pts }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    return pts.map(([X, Y]) => { const d = x.getImageData(Math.round(X), Math.round(Y), 1, 1).data; return [d[0], d[1], d[2]]; });
  }, { b64: buf.toString('base64'), pts });
}

/* 장면: 섹션 하나 — [텍스트 '███'(파랑 80px)] [gap 40] [에셋(주황 그림)] [gap 40] [도형 래퍼(100×100 사각 · 초록)] [gap 40] [아래 텍스트 'BELOW'] — 고정 id */
async function setup(page, boot = bootApp) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await boot(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="eS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="eI">
      <div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="eR1" data-layout="stack"></div>
      <div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="eR2" data-layout="stack"></div>
      <div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="eR3" data-layout="stack"></div>
      <div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="eR4" data-layout="stack"></div>
      <div class="gap-block" data-type="gap" style="height:200px"></div></div></div>`);
    const text = (id, row, s, color) => { const { block: tb } = window.makeTextBlock('h1'); const tf = window._makeTextFrame(); window.applyTextOpts(tb, tf, {}, 'h1'); tf.appendChild(tb); tb.id = id; tf.id = id + 'F';
      const h = tb.querySelector('[class^="tb-"]'); h.textContent = s; h.style.color = color; h.style.fontSize = '80px'; h.style.lineHeight = '1'; document.getElementById(row).appendChild(tf); return tb; };
    text('eT', 'eR1', '███', '#2d6fe8');
    const cv = document.createElement('canvas'); cv.width = 300; cv.height = 120; const x = cv.getContext('2d'); x.fillStyle = '#ff6600'; x.fillRect(0, 0, 300, 120);
    const r = window.makeAssetBlock(); const ab = r.block || r; ab.id = 'eA'; document.getElementById('eR2').appendChild(ab);
    window.rebindAll?.(); window.updateAssetBlock('eA', { imgSrc: cv.toDataURL('image/png') });
    const { block: sb } = window.makeShapeBlock('rectangle'); sb.id = 'eSh';
    const ss = document.createElement('div'); ss.className = 'frame-block'; ss.id = 'eShF'; ss.dataset.width = '100'; ss.dataset.height = '100'; ss.style.width = '100px'; ss.style.height = '100px';
    ss.appendChild(sb); document.getElementById('eR3').appendChild(ss);
    sb.querySelectorAll('[fill]').forEach(n => { if (n.getAttribute('fill') !== 'none') n.setAttribute('fill', '#00aa44'); });
    text('eB', 'eR4', 'BELOW', '#111111');
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
  });
  await page.waitForTimeout(300);
  return errs;
}
const rect = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); const q = e.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom, h: q.height, oh: e.offsetHeight }; }, id);
const fx = (page, id, patch, opts) => page.evaluate(([id, p, o]) => window.setFxReflect(document.getElementById(id), p, o), [id, patch, opts]);
const ds = (page, id) => page.evaluate((id) => Object.fromEntries(Object.entries(document.getElementById(id).dataset).filter(([k]) => k.startsWith('fx'))), id);

/* ══ P0 전제 — 핀에서도 초록 ══ */
test('P0 전제 — 패널 부품(.prop-cell-card·.prop-section-title-row·.prop-icon-btn·.prop-icon-input) · PLUS_ICON_SVG', async ({ page }) => {
  const errs = await setup(page);
  const css = fs.readFileSync(path.join(ROOT, 'css/editor-props.css'), 'utf8');
  for (const sel of ['.prop-cell-card {', '.prop-cell-card-header {', '.prop-icon-btn {', '.prop-icon-input {']) expect(css.includes(sel), sel).toBe(true);
  expect(fs.readFileSync(path.join(ROOT, 'js/props/prop-text-template.js'), 'utf8').includes('prop-section-title-row'), 'Shadow 절 머리 꼴이 있다').toBe(true);
  expect(await page.evaluate(() => typeof window.PLUS_ICON_SVG)).toBe('string');
  expect(errs).toEqual([]);
});

/* ══ R — 기능(핀에서 빨강) ══ */
test('R1 ★패널(진짜 마우스) — 텍스트·도형·에셋 셋 다 「Effects」 절 · ＋ → 카드(간격·길이·불투명도 = 시안 값) · 눈 끔/켬 · ✕ · 접기 · 흐림 없음', async ({ page }) => {
  const errs = await setup(page);
  const select = async (id) => { const p = await page.evaluate((id) => { const e = document.getElementById(id); e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return [q.left + 6, q.top + q.height / 2]; }, id);
    await page.evaluate(() => window.deselectAll?.()); await page.mouse.click(p[0], p[1]); await page.waitForTimeout(300); };
  const click = async (sel) => { const p = await page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }, sel);
    expect(p, `패널에 ${sel}`).not.toBeNull(); await page.mouse.click(p[0], p[1]); await page.waitForTimeout(250); };
  for (const [id, P, after] of [['eT', 'txt', 'txt-shadow-section'], ['eSh', 'shape', null], ['eA', 'asset', null]]) {
    await select(id);
    const sec = await page.evaluate(([P, after]) => { const s = document.getElementById(`${P}-fx-section`); if (!s) return null;
      return { title: s.querySelector('.prop-section-title').textContent.trim(), plus: !!document.getElementById(`${P}-fx-add`)?.querySelector('svg'), prevOk: after ? s.previousElementSibling?.id === after : true,
        plusText: (document.getElementById(`${P}-fx-add`)?.textContent || '').trim() }; }, [P, after]);
    expect(sec, `${id}: Effects 절`).not.toBeNull();
    expect(sec.title).toBe('Effects');
    expect(sec.plus, '＋ = PLUS_ICON_SVG(svg)').toBe(true);
    expect(sec.plusText, '⛔＋ 를 글자로 쓰지 않는다(E65)').toBe('');
    expect(sec.prevOk, '텍스트 = Shadow 절 바로 아래').toBe(true);
    await click(`#${P}-fx-add`);
    expect(await ds(page, id)).toEqual({ fxReflect: 'on' });
    const card = await page.evaluate((P) => ({ rows: [...document.querySelectorAll(`#${P}-fx-body .prop-label`)].map(e => e.textContent.trim()),
      gap: document.getElementById(`${P}-fx-gap`).value, gmin: document.getElementById(`${P}-fx-gap`).min, gmax: document.getElementById(`${P}-fx-gap`).max,
      len: document.getElementById(`${P}-fx-len-num`).value, lmin: document.getElementById(`${P}-fx-len-slider`).min, lmax: document.getElementById(`${P}-fx-len-slider`).max,
      op: document.getElementById(`${P}-fx-op-num`).value, omin: document.getElementById(`${P}-fx-op-slider`).min, omax: document.getElementById(`${P}-fx-op-slider`).max,
      cls: document.getElementById(`${P}-fx-card`).className }), P);
    expect(card.rows, '★흐림 없음 — 셋').toEqual(['간격', '길이', '불투명도']);
    expect([+card.gap, +card.gmin, +card.gmax]).toEqual([MOCK.gap.def, MOCK.gap.min, MOCK.gap.max]);
    expect([+card.len, +card.lmin, +card.lmax]).toEqual([MOCK.len.def, MOCK.len.min, MOCK.len.max]);
    expect([+card.op, +card.omin, +card.omax]).toEqual([MOCK.op.def, MOCK.op.min, MOCK.op.max]);
    expect(card.cls).toContain('prop-cell-card');
    expect(await page.evaluate((id) => document.getElementById(id).style.webkitBoxReflect, id)).toContain('below 4px');
    await click(`#${P}-fx-eye`);
    expect(await ds(page, id), '눈 끔 = 값 보존').toEqual({ fxReflect: 'off' });
    expect(await page.evaluate((id) => document.getElementById(id).style.webkitBoxReflect, id), '끄면 안 그린다').toBe('');
    await click(`#${P}-fx-eye`);
    expect((await ds(page, id)).fxReflect).toBe('on');
    await click(`#${P}-fx-head`);
    expect(await page.evaluate((P) => document.getElementById(`${P}-fx-body`).hidden, P), '머리 누르면 접힘').toBe(true);
    await click(`#${P}-fx-del`);
    expect(await ds(page, id), '✕ = 키 전부 지움').toEqual({});
    expect(await page.evaluate((P) => !!document.getElementById(`${P}-fx-card`), P), '카드 사라짐').toBe(false);
  }
  expect(errs).toEqual([]);
});

test('R2 ★옛 문서 바이트 동일 — 같은 장면을 «핀 6119145c 파일»과 지금 파일로 각각 띄워 패널 셋을 열고 직렬화 → 같다', async ({ page }) => {
  /* 핀 파일 덮개 — ROOT 가 git 나무가 아닐 수도 있어(양성대조·변이 사본) 핀 «내용»을 원 레포 git 에서 꺼내 «내용이 다른» 파일만 덮는다. */
  const GIT = fs.existsSync(path.join(ROOT, '.git')) ? ROOT : '/Users/a1/web-editor';
  const overlay = new Map();
  const pinFiles = execFileSync('git', ['-C', GIT, 'ls-tree', '-r', '--name-only', PIN, '--', 'js', 'css', 'index.html'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const pinSet = new Set(pinFiles);
  for (const f of pinFiles) { const pinBuf = execFileSync('git', ['-C', GIT, 'show', `${PIN}:${f}`], { maxBuffer: 64 * 1024 * 1024 }); const p = path.join(ROOT, f);
    if (!fs.existsSync(p) || !fs.readFileSync(p).equals(pinBuf)) overlay.set('/' + f, pinBuf); }
  const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  for (const f of [...walk('js'), ...walk('css')]) if (!pinSet.has(f)) overlay.set('/' + f, null);   // 핀에 없는 새 파일 = 404
  const MIME = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png' };
  const pinned = async (pg) => { const errs = []; pg.on('pageerror', e => errs.push(String(e)));
    await pg.addInitScript(() => { window.electronAPI = new Proxy({}, { get: () => (() => Promise.resolve(null)) }); });
    await pg.route(`${ORIGIN}/**`, async (r) => { const u = decodeURIComponent(new URL(r.request().url()).pathname); const ct = MIME[path.extname(u)] || 'application/octet-stream';
      if (overlay.has(u)) { const b = overlay.get(u); return b === null ? r.fulfill({ status: 404, body: '' }) : r.fulfill({ contentType: ct, body: b }); }
      const f = path.join(ROOT, u); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
      return r.fulfill({ contentType: ct, body: fs.readFileSync(f) }); });
    await pg.goto(`${ORIGIN}/index.html`); await pg.waitForFunction(() => typeof window.rebindAll === 'function', null, { timeout: 20000 }); return errs; };
  const shot = async (pg) => pg.evaluate(() => {
    for (const [id, fn] of [['eT', 'showTextProperties'], ['eSh', 'showShapeProperties'], ['eA', 'showAssetProperties']]) { try { window[fn]?.(document.getElementById(id)); } catch (_) {} }
    const s = document.getElementById('eS'); s.querySelectorAll('[id]').forEach(e => { if (!/^e/.test(e.id)) e.removeAttribute('id'); });
    return s.outerHTML; });
  const p2 = await page.context().newPage();
  await setup(p2, pinned);
  const pinHtml = await shot(p2); await p2.close();
  await setup(page);
  const nowHtml = await shot(page);
  expect(overlay.size, '전제 — 바꾼 파일이 있다(같은 판끼리 비교가 아니다)').toBeGreaterThan(0);
  expect(nowHtml, '★효과 없는 장면 + 패널 셋을 연 뒤 — 지금 판 바이트 = 핀 바이트').toBe(pinHtml);
});

test('R3 ★자리(D2 ㉠) — 끄면 섹션 높이 변화 0 · 켜면 «간격 + 높이×길이%» 만큼 늘고 아래 블럭이 그만큼 밀린다(텍스트·에셋·도형 래퍼)', async ({ page }) => {
  await setup(page);
  const H = async () => page.evaluate(() => document.getElementById('eS').getBoundingClientRect().height);
  const below = async () => (await rect(page, 'eB')).t;
  const h0 = await H(), b0 = await below();
  for (const [id, host] of [['eT', 'eT'], ['eA', 'eA'], ['eSh', 'eShF']]) {
    const oh = (await rect(page, id)).oh;
    await fx(page, id, { state: 'on', gap: 6, len: 50, op: 40 });
    const want = Math.max(0, Math.round(6 + oh * 50 / 100));
    const mb = await page.evaluate((h) => document.getElementById(h).style.marginBottom, host);
    expect(mb, `${id} host=${host} margin-bottom = 6 + ${oh}×50%`).toBe(want + 'px');
    expect(Math.round((await H()) - h0), `${id}: 섹션이 ${want}px 늘었다`).toBe(want);
    expect(Math.round((await below()) - b0), `${id}: 아래 블럭이 ${want}px 밀렸다`).toBe(want);
    await fx(page, id, { state: 'off' });
    expect(Math.round((await H()) - h0), `${id}: 끄면 0`).toBe(0);
    await fx(page, id, { state: 'none' });
    const st = await page.evaluate((h) => document.getElementById(h).getAttribute('style'), host);
    expect(st || '', `${id}: ✕ 뒤 host style 에 margin-bottom 흔적 없음`).not.toMatch(/margin-bottom/);
  }
  // 높이가 바뀌면 여백도 따라간다(ResizeObserver) — 텍스트 크기 키우기
  await fx(page, 'eT', { state: 'on', gap: 0, len: 100 });
  await page.evaluate(() => { document.querySelector('#eT [class^="tb-"]').style.fontSize = '120px'; });
  await page.waitForTimeout(300);
  const oh2 = (await rect(page, 'eT')).oh;
  expect(await page.evaluate(() => document.getElementById('eT').style.marginBottom), '높이가 커지면 여백도').toBe(oh2 + 'px');
});

test('R4 ★PNG — 클론 스크린샷(크로미움 합성기 = 주 경로 렌더러)에 반사 픽셀이 있다 · html2canvas 대체 경로엔 «없다»(의도됨 — 현재 동작 고정)', async ({ page }) => {
  await setup(page);
  await fx(page, 'eA', { state: 'on', gap: 4, len: 55, op: 35 });
  await page.evaluate(() => window.deselectAll?.());
  const geo = await page.evaluate(async () => {
    const ex = await import('/js/io/export-image.js');
    const clone = await ex.prepareCloneForCapture(document.getElementById('eS'), 860, true); ex.renderComponentsInClone(clone);
    clone.id = '__clone'; clone.style.position = 'fixed'; clone.style.top = '0px'; clone.style.left = '0px'; clone.style.zIndex = '2147483647'; clone.style.background = '#ffffff';
    const a = clone.querySelector('.asset-block'); const q = a.getBoundingClientRect(); const cr = clone.getBoundingClientRect();
    return { x: q.left - cr.left + q.width / 2, y: q.bottom - cr.top + 10, cw: cr.width };
  });
  await page.evaluate(() => document.getElementById('proj-loading-overlay')?.remove());
  const shot = await page.locator('#__clone').screenshot({ type: 'png' });
  const a = await page.evaluate(async ([b64, g]) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
    const x = cv.getContext('2d'); x.drawImage(im, 0, 0); const s = im.width / g.cw; const d = x.getImageData(Math.round(g.x * s), Math.round(g.y * s), 1, 1).data; return [d[0], d[1], d[2]]; }, [shot.toString('base64'), geo]);
  const b = await page.evaluate(async (g) => { const ex = await import('/js/io/export-image.js'); document.getElementById('__clone')?.remove();
    const clone = await ex.prepareCloneForCapture(document.getElementById('eS'), 860, false); ex.renderComponentsInClone(clone);
    const { canvas } = await ex.captureCloneToCanvas(clone, 860, '#ffffff', false, document.getElementById('eS')); clone.remove();
    const s = canvas.width / g.cw; const d = canvas.getContext('2d').getImageData(Math.round(g.x * s), Math.round(g.y * s), 1, 1).data; return [d[0], d[1], d[2]]; }, geo);
  await page.evaluate(() => document.getElementById('__clone')?.remove());
  console.log(`[R4] 에셋 바닥+10 — 클론 스크린샷 rgb=${a} · html2canvas rgb=${b}`);
  const tint = (p) => p[0] > 230 && p[1] > 150 && p[1] < 235 && p[2] < 215;   // 주황 35% ≈ (255,204,179)
  expect(tint(a), `★주 경로 렌더러에 반사(주황 틴트) rgb=${a}`).toBe(true);
  /* ⚠️의도됨 — html2canvas 는 -webkit-box-reflect 를 못 그린다(지디 판정 ㉮의 알려진 대가 · 웹 빌드 대체 경로만).
     이 단언이 빨개지면(=나오기 시작하면) 좋은 일이다 — 이 줄과 설계서 명부를 같이 고쳐라. */
  expect(b, `html2canvas 대체 경로 = 흰색(반사 없음) rgb=${b}`).toEqual([255, 255, 255]);
});

test('R5 ★innerText/textContent 를 «두 번» 안 읽는다 — 반사 켠 블럭·섹션의 innerText == 끈 것 (⛔DOM 거울로 바꾸면 여기서 막힌다)', async ({ page }) => {
  await setup(page);
  const read = () => page.evaluate(() => ({ t: document.getElementById('eT').innerText, tf: document.getElementById('eTF').innerText, tc: document.getElementById('eT').textContent,
    s: document.getElementById('eS').innerText, a: document.getElementById('eA').innerText, n: document.querySelectorAll('#eS [aria-hidden="true"][data-fx-mirror]').length }));
  const off = await read();
  for (const id of ['eT', 'eA', 'eSh']) await fx(page, id, { state: 'on' });
  const on = await read();
  expect(on, '★켬/끔 innerText·textContent 같다 — 반사 글자가 읽기에 안 섞인다').toEqual(off);
  expect(on.n).toBe(0);
});

test('R6 ⌘Z 한 걸음(더하기·바꾸기·지우기) · 저장 왕복(키·인라인·여백 유지)', async ({ page }) => {
  await setup(page);
  const blur = () => page.evaluate(() => document.activeElement?.blur?.());
  await fx(page, 'eT', { state: 'on' });
  await fx(page, 'eT', { len: 80 });
  await fx(page, 'eT', { state: 'none' });
  await blur();
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  expect(await ds(page, 'eT'), '⌘Z 1 = 지우기 전').toEqual({ fxReflect: 'on', fxReflectLen: '80' });
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  expect(await ds(page, 'eT'), '⌘Z 2 = 바꾸기 전').toEqual({ fxReflect: 'on' });
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  expect(await ds(page, 'eT'), '⌘Z 3 = 더하기 전').toEqual({});
  expect(await page.evaluate(() => document.getElementById('eT').style.webkitBoxReflect)).toBe('');
  await fx(page, 'eSh', { state: 'on', gap: 10, len: 40 });
  const st0 = await page.evaluate(() => ({ r: document.getElementById('eSh').style.webkitBoxReflect, m: document.getElementById('eShF').style.marginBottom }));
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.evaluate(() => window.applyZoom?.(100)); await page.waitForTimeout(400);
  expect(await ds(page, 'eSh')).toEqual({ fxReflect: 'on', fxReflectGap: '10', fxReflectLen: '40' });
  expect(await page.evaluate(() => ({ r: document.getElementById('eSh').style.webkitBoxReflect, m: document.getElementById('eShF').style.marginBottom }))).toEqual(st0);
});

test('R7 ★E57 지우기 꼴 + 선택 목록 — ✕ = 효과만 · 블럭 Delete = 블럭(효과·여백 함께) · ⌘Z 로 효과까지 · 편집 중 ⌫ = 글자만', async ({ page }) => {
  await setup(page);
  await fx(page, 'eA', { state: 'on' });
  const st = () => page.evaluate(() => { const a = document.getElementById('eA'); return { block: !!a, fx: a ? a.dataset.fxReflect || null : null, mb: a ? a.style.marginBottom : null, sel: [...document.querySelectorAll('#canvas .selected')].map(e => e.id || e.className.split(' ')[0]) }; });
  const rows = { start: await st() };
  await fx(page, 'eA', { state: 'none' }); rows.a_x = await st();
  expect(rows.a_x).toMatchObject({ block: true, fx: null, mb: '' });
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); await page.waitForTimeout(300); rows.a_undo = await st();
  expect(rows.a_undo.fx).toBe('on');
  const p = await page.evaluate(() => { const e = document.getElementById('eA'); e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return [q.left + 10, q.top + 10]; });
  await page.evaluate(() => window.deselectAll?.()); await page.mouse.click(p[0], p[1]); await page.waitForTimeout(300); rows.b_selected = await st();
  await page.keyboard.press('Delete'); await page.waitForTimeout(300); rows.b_delete = await st();
  expect(rows.b_delete.block, '블럭 Delete = 블럭이 지워진다').toBe(false);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); await page.waitForTimeout(400); rows.b_undo = await st();
  expect(rows.b_undo).toMatchObject({ block: true, fx: 'on' });
  // 편집 중 ⌫ = 글자만(텍스트 반사 켬)
  await fx(page, 'eT', { state: 'on' });
  const tp = await page.evaluate(() => { const e = document.querySelector('#eT [class^="tb-"]'); e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return [q.right - 4, q.top + q.height / 2]; });
  await page.mouse.dblclick(tp[0], tp[1]); await page.waitForTimeout(250);
  await page.keyboard.press('End'); await page.keyboard.press('Backspace'); await page.waitForTimeout(100);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.waitForTimeout(250);
  rows.c_bs = await page.evaluate(() => ({ text: document.querySelector('#eT [class^="tb-"]').textContent, fx: document.getElementById('eT').dataset.fxReflect }));
  expect(rows.c_bs.fx, '편집 ⌫ 뒤에도 효과 유지').toBe('on');
  for (const [k, v] of Object.entries(rows)) console.log(`[R7] ${k.padEnd(10)} ${JSON.stringify(v)}`);
});

test('R8 ★E64 — 도형 회전 여백과 «합» · 말풍선·그리드 패널엔 Effects 절이 없다', async ({ page }) => {
  await setup(page);
  // 회전 여백(frame-geometry.js applyFrameRotationMargin) + 반사 여백 = 합 · 회전만 걷으면 반사 여백이 남는다
  await fx(page, 'eSh', { state: 'on', gap: 0, len: 50 });
  const r = await page.evaluate(async () => {
    const fg = await import('/js/frame-geometry.js'); const F = document.getElementById('eShF');
    const fxM = Number(F.dataset.rfMarginY);
    F.dataset.rotateDeg = '30'; const rot = fg.applyFrameRotationMargin(F); const both = F.style.marginBottom;
    F.dataset.rotateDeg = '0'; fg.applyFrameRotationMargin(F); const after = F.style.marginBottom;
    return { fxM, rot, both, after, top: F.style.marginTop };
  });
  expect(r.both, `회전 ${r.rot} + 반사 ${r.fxM}`).toBe((r.rot + r.fxM) + 'px');
  expect(r.after, '회전만 걷으면 반사 여백이 남는다').toBe(r.fxM + 'px');
  expect(r.top).toBe('');
  // 말풍선·라벨·그리드 — 대상 밖(절이 안 뜬다)
  const none = await page.evaluate(() => {
    const out = {};
    const { block: bb } = window.makeTextBlock('body'); bb.classList.add('speech-bubble-block'); document.getElementById('eR4').appendChild(bb);
    try { window.showTextProperties(bb); out.bubble = !!document.getElementById('txt-fx-section'); } catch (e) { out.bubble = 'err:' + e.message; }
    const { block: g } = window.makeGridBlock({}); document.getElementById('eR4').appendChild(g); window.renderGridBlock(g);
    try { window.showGridProperties(g); out.grid = !!document.querySelector('[id$="-fx-section"]'); } catch (e) { out.grid = 'err:' + e.message; }
    return out;
  });
  expect(none.grid, '그리드 패널엔 Effects 없음').toBe(false);
  console.log(`[R8] 말풍선 패널 Effects 절 = ${none.bubble} (기대 false — 말풍선 판정은 prop-text.js isSpeechBubble)`);
});

test('R9 ★U8 조건⑴ — 켰다가 ✕ 로 지우면 블럭·래퍼·섹션 outerHTML 이 켜기 «전»과 바이트 동일(텍스트·에셋·도형)', async ({ page }) => {
  await setup(page);
  const snap = () => page.evaluate(() => ({ t: document.getElementById('eTF').outerHTML, a: document.getElementById('eA').outerHTML, s: document.getElementById('eShF').outerHTML, sec: document.getElementById('eS').outerHTML }));
  const before = await snap();
  for (const id of ['eT', 'eA', 'eSh']) { await fx(page, id, { state: 'on', gap: 12, len: 70, op: 60 }); await fx(page, id, { state: 'off' }); await fx(page, id, { state: 'on' }); }
  expect((await snap()).sec, '전제 — 켠 동안은 다르다').not.toBe(before.sec);
  for (const id of ['eT', 'eA', 'eSh']) await fx(page, id, { state: 'none' });
  expect(await snap(), '★✕ 뒤 = 켜기 전 바이트').toEqual(before);
});

test('R10 ★U8 조건⑵ — 눈 끔(\'off\')을 읽는 쪽 전부 «효과 없음»: ⒜ PNG(클론) ⒝ HTML 내보내기 ⒞ 피그마 JSON(안 읽음) ⒟ MCP 읽기 getCanvasState(안 읽음)', async ({ page }) => {
  await setup(page);
  const read = async () => {
    const figma = await page.evaluate(() => { window.flushCurrentPage?.(); const j = window.buildFigmaExportJSON(null); let hit = null; JSON.stringify(j, (k, v) => { if (v && v.id === 'eA') hit = v; return v; }); return JSON.stringify(hit); });
    const mcp = await page.evaluate(() => JSON.stringify(window.getCanvasState?.('eS') ?? window.getCanvasState?.()));
    const html = await page.evaluate(async () => { let out = null; const oc = URL.createObjectURL; URL.createObjectURL = (b) => { out = b; return 'blob:none'; };
      const ck = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {}; try { await window.exportHTMLFile(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ck; } return out ? await out.text() : ''; });
    const p2 = await page.context().newPage(); await p2.setContent(html);
    const h = await p2.evaluate(() => { const a = document.getElementById('eA'); return a ? { reflect: getComputedStyle(a).webkitBoxReflect, mb: getComputedStyle(a).marginBottom } : null; }); await p2.close();
    const png = await page.evaluate(async () => { const ex = await import('/js/io/export-image.js'); const clone = await ex.prepareCloneForCapture(document.getElementById('eS'), 860, true); ex.renderComponentsInClone(clone);
      const a = clone.querySelector('.asset-block'); const r = { reflect: getComputedStyle(a).webkitBoxReflect, mb: a.style.marginBottom }; clone.remove(); return r; });
    return { figma, mcp: mcp.replace(/"(updatedAt|ts|at)":[^,}]*/g, ''), html: h, png };
  };
  const none = await read();
  await fx(page, 'eA', { state: 'on' }); await fx(page, 'eA', { state: 'off' });
  expect((await ds(page, 'eA')).fxReflect, '전제 — 값은 남아 있다(off)').toBe('off');
  const off = await read();
  console.log(`[R10] off: png=${JSON.stringify(off.png)} html=${JSON.stringify(off.html)} figma.same=${off.figma === none.figma} mcp.same=${off.mcp === none.mcp}`);
  expect(off.png, '⒜ PNG 클론 — 반사·여백 없음').toEqual({ reflect: 'none', mb: '' });
  expect(off.html, '⒝ 단독 HTML — 반사·여백 없음').toEqual(none.html);
  expect(off.html.reflect).toBe('none');
  expect(off.figma, '⒞ 피그마 JSON — 효과를 «안 읽는다»(없음과 같은 바이트)').toBe(none.figma);
  expect(off.mcp, '⒟ MCP 읽기 — 효과를 «안 읽는다»(없음과 같은 바이트)').toBe(none.mcp);
});
