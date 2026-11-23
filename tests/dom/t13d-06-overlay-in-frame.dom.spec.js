/* t13d-06 — 0.9.13 t13D-06 오버레이 블럭의 프레임 자식 편입 및 종속 이동(지디 승인 계획 ①~⑤ · 261121)
 * 고침: overlay-float.js floatHostOf — 오버레이의 «자리 주인» = posEl 바깥 첫 일반 프레임(없으면 섹션). enterFloat 은 그 주인에 남기고(좌표 = 주인 기준),
 *        끌기는 그 주인 안에서(탄성 · 가이드) · 프레임 안 오버레이는 섹션을 안 넘나든다. editor.js pasteClipboard 오버레이 갈래 — 섹션 오버레이를 «들어간» 프레임(_pasteTarget into)에 붙이면 프레임 안 오버레이(그 프레임 상자 안 자리).
 * G1 프레임 안 글자(두 번 눌러 고름)에 오버레이를 켜면 → 프레임 자식 그대로 · 오버레이 표식 · 화면 자리 그대로 · 주인 = 그 프레임
 * G2 프레임 안 오버레이 글을 끌면 프레임 안에서 옮고 · 프레임 밖까지 끌어도 프레임 자식 그대로(섹션으로 안 빠짐)
 * G3 프레임을 띄워(t13D-05) 끌면 프레임 안 오버레이 글도 같이(프레임 안 상대 자리 그대로)
 * G4 섹션 오버레이 글을 잘라(copySelected + ⌫) 프레임에 들어가(여백 두 번 클릭) 붙이면(pasteClipboard → _pasteTarget 실제 길) = 그 프레임 안 오버레이 · 프레임 안에 보임
 * G5 프레임 안 오버레이를 끄면 프레임 안 제자리로(섹션으로 안 감) · 자유배치 프레임이면 자유 자식(absolute)으로
 * G6 프레임을 ⌘↓ 로 순서 바꾸면(아래 글자 뒤로) 프레임 안 오버레이도 같이(자식 · 상대 자리 그대로)
 * ⛔⌘X/⌘V 실키 금지 — 사본 만드는 함수(copySelected)만 직접 부르고 지우기는 ⌫ · 붙이기 대상 결정부터는 제품 길(pasteClipboard).
 * 양성대조: _patches/t13d-06-CTL.patch(overlay-float.js 주인 = 늘 섹션 · floatHostOf 없음) → G1~G6 전부 빨강 · _patches/t13d-06-CTL-paste.patch(editor.js 붙이기 오버레이 갈래·방향키 주인 되돌림) → G4 만 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const rect = (page, sel) => page.evaluate((s) => { const q = document.querySelector(s).getBoundingClientRect(); return [q.left, q.top, q.width, q.height].map(Math.round); }, sel);

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    c.querySelector('.section-block').id = 'sV'; window.applyZoom?.(100);
  });
  await waitZoomSettled(page, 100);
  await page.evaluate(() => {
    const sec = document.getElementById('sV'), inner = sec.querySelector('.section-inner'); document.getElementById('canvas-wrap').scrollTop = 0; sec.scrollIntoView({ block: 'start' });
    [...inner.children].forEach((x) => { if (!x.classList.contains('drop-indicator')) x.remove(); });
    const fresh = (sel, fn) => { const before = new Set(sec.querySelectorAll(sel)); window.deselectAll(); window.selectSection(sec); fn(); return [...sec.querySelectorAll(sel)].find((x) => !before.has(x)); };
    const txt = (id, t) => { const tf = fresh('.frame-block[data-text-frame]', () => window.addTextBlock('body')); tf.id = id; const ed = tf.querySelector('[class^="tb-"]'); ed.textContent = t; delete ed.dataset.isPlaceholder; return tf; };
    const o = txt('tfS', '섹션 오버레이');   // 섹션 오버레이(오른쪽 위)
    o.style.width = '200px'; o.dataset.width = '200';
    const p = window.OverlayFloat.posElOf(o); window.OverlayFloat.enterFloat(p); p.style.left = '600px'; p.style.top = '10px'; p.dataset.offsetX = '600'; p.dataset.offsetY = '10';
    txt('tfA', '위 글자');
    const fr = fresh('.frame-block:not([data-text-frame])', () => window.addFrameBlock()); fr.id = 'frV';
    window.updateFrameBlock?.('frV', { width: 420, height: 220 });
    txt('tfB', '아래 글자');
    const kid = document.getElementById('tfB').cloneNode(true); kid.id = 'tfK'; kid.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    kid.style.position = 'absolute'; kid.style.left = '30px'; kid.style.top = '30px'; kid.style.width = '150px'; kid.dataset.offsetX = '30'; kid.dataset.offsetY = '30';
    kid.querySelector('[class^="tb-"]').textContent = '프레임 자식'; fr.appendChild(kid);
    window.rebindAll?.(); window.deselectAll(); document.activeElement?.blur?.(); window.clearHistory?.();
  });
  await raf(page);
  const pre = await page.evaluate(() => ({ s: document.getElementById('tfS').dataset.overlayBlock, sPar: document.getElementById('tfS').parentElement.id, k: document.getElementById('tfK').parentElement.id }));
  expect(pre, '[전제] 섹션 오버레이 · 프레임 자식').toEqual({ s: 'true', sPar: 'sV', k: 'frV' });
  return errs;
}
const st = (page, id) => page.evaluate((id) => { const e = document.getElementById(id), f = document.getElementById('frV'), r = e.getBoundingClientRect(), fr = f.getBoundingClientRect();
  return { par: e.parentElement.id, ov: e.dataset.overlayBlock || null, host: window.OverlayFloat.floatHostOf(e)?.id || null, x: Math.round(r.left), y: Math.round(r.top), rel: [Math.round(r.left - fr.left), Math.round(r.top - fr.top)],
    inside: r.left >= fr.left - 1 && r.top >= fr.top - 1 && r.right <= fr.right + 1 && r.bottom <= fr.bottom + 1 }; }, id);
/* 프레임 안 글자 고르기 = 두 번 눌러 들어가 고름(사람 길) */
async function pickKid(page) {
  const [x, y, w, h] = await rect(page, '#tfK .text-block');
  await page.mouse.dblclick(x + w / 2, y + h / 2); await raf(page);
  expect(await page.evaluate(() => !!document.querySelector('#tfK .text-block.selected')), '[전제] 프레임 자식 글자를 골랐다').toBe(true);
}
async function toggleTxt(page) {
  const b = await page.evaluate(() => { const e = document.getElementById('txt-overlay-toggle'); if (!e) return null; e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  expect(b, '[전제] 글자 패널 오버레이 단추').toBeTruthy(); await page.mouse.click(b[0], b[1]); await raf(page);
}
async function drag(page, sel, dx, dy, at = 'mid') {
  const [x, y, w, h] = await rect(page, sel); const secB = await page.evaluate((s) => Math.round(document.querySelector(s).closest('.section-block').getBoundingClientRect().bottom), sel);
  const p = at === 'mid' ? [x + w / 2, y + h / 2] : [x + w - 25, Math.min(y + h - 25, secB - 10)];   // ★전제 바뀜(현빈 261123 Clip content 기본 켬) — 섹션 밖 몸통은 잘려 안 잡힘 ⇒ 'corner' 는 보이는 자리
  await page.mouse.move(p[0], p[1]); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(p[0] + dx * i / 10, p[1] + dy * i / 10);
  await page.mouse.up(); await raf(page);
}

test('G1 프레임 안 글자 오버레이 켬 → 프레임 자식 그대로 · 화면 자리 그대로 · 주인 = 프레임', async ({ page }) => {
  const errs = await scene(page);
  const a = await st(page, 'tfK');
  await pickKid(page); await toggleTxt(page);
  const b = await st(page, 'tfK');
  expect([b.ov, b.par, b.host], '★오버레이 · 부모 = 프레임 · 주인 = 프레임').toEqual(['true', 'frV', 'frV']);
  expect([Math.abs(b.x - a.x) <= 1, Math.abs(b.y - a.y) <= 1], `★화면 자리 그대로 ${JSON.stringify([a, b])}`).toEqual([true, true]);
  expect(errs).toEqual([]);
});

test('G2 프레임 안 오버레이를 끌면 프레임 안에서 옮고 · 밖까지 끌어도 프레임 자식 그대로', async ({ page }) => {
  const errs = await scene(page);
  await pickKid(page); await toggleTxt(page);
  const a = await st(page, 'tfK');
  await drag(page, '#tfK .text-block', 90, 60);
  const b = await st(page, 'tfK');
  expect([b.par, b.ov], '[전제] 그대로 프레임 안 오버레이').toEqual(['frV', 'true']);
  expect([Math.abs(b.rel[0] - a.rel[0] - 90) <= 10, Math.abs(b.rel[1] - a.rel[1] - 60) <= 10], `★프레임 안에서 끈 만큼(자석 ±10) ${JSON.stringify([a.rel, b.rel])}`).toEqual([true, true]);
  await drag(page, '#tfK .text-block', 700, 400);
  const c = await st(page, 'tfK');
  expect([c.par, c.host, c.ov], '★프레임 밖까지 끌어도 프레임 자식 · 주인 = 프레임(섹션으로 안 빠짐)').toEqual(['frV', 'frV', 'true']);
  expect(errs).toEqual([]);
});

test('G3 프레임을 띄워 끌면 프레임 안 오버레이 글도 같이(상대 자리 그대로)', async ({ page }) => {
  const errs = await scene(page);
  await pickKid(page); await toggleTxt(page);
  await page.evaluate(() => { window.deselectAll(); const f = document.getElementById('frV'); window.OverlayFloat.enterFloat(f); window.selectBlock?.('frV'); window.showHandlesFor?.(f); });
  await raf(page);
  const a = await st(page, 'tfK');
  const [x, y, w, h] = await rect(page, '#frV');
  const secB = await page.evaluate((id) => Math.round(document.getElementById(id).closest('.section-block').getBoundingClientRect().bottom), 'frV');
  await page.mouse.click(x + w - 25, Math.min(y + h - 25, secB - 10)); await raf(page);   // ★전제 바뀜(현빈 261123 Clip content 기본 켬) — 섹션 밖 몸통은 잘려 안 잡힘 ⇒ 보이는 자리 · 기대 무변
  await drag(page, '#frV', 150, 80, 'corner');
  const b = await st(page, 'tfK');
  expect([b.par, b.ov], '[전제] 프레임 안 오버레이 그대로').toEqual(['frV', 'true']);
  expect(b.rel, '★프레임 안 상대 자리 그대로').toEqual(a.rel);
  expect([Math.abs(b.x - a.x - 150) <= 10, Math.abs(b.y - a.y - 80) <= 10], `★화면에선 프레임과 같이 옮음 ${JSON.stringify([a, b])}`).toEqual([true, true]);
  expect(errs).toEqual([]);
});

test('G4 섹션 오버레이를 잘라 프레임에 들어가 붙이면 = 그 프레임 안 오버레이 · 프레임 안에 보임', async ({ page }) => {
  const errs = await scene(page);
  const [sx, sy, sw, sh] = await rect(page, '#tfS .text-block');
  await page.mouse.click(sx + sw / 2, sy + sh / 2); await raf(page);
  expect(await page.evaluate(() => !!document.querySelector('#tfS .text-block.selected')), '[전제] 섹션 오버레이 고름').toBe(true);
  await page.evaluate(() => window.copySelected());   // 사본 만드는 함수만 직접(⌘X 실키 금지) — 지우기는 아래 ⌫
  await page.keyboard.press('Backspace'); await raf(page);
  expect(await page.evaluate(() => !document.getElementById('tfS')), '[전제] 잘라냄(원본 지워짐)').toBe(true);
  const [x, y, w, h] = await rect(page, '#frV');
  await page.mouse.dblclick(x + w - 30, y + h - 30); await raf(page);   // 여백 두 번 클릭 = 프레임에 들어감(drag-utils.js _enteredFrame)
  expect(await page.evaluate(() => window._enteredFrame?.id), '[전제] 프레임에 들어갔다').toBe('frV');
  const before = await page.evaluate(() => [...document.querySelectorAll('#frV > .frame-block[data-text-frame]')].map((e) => e.id));
  await page.evaluate(() => window.pasteClipboard()); await raf(page);   // 붙이기 대상 결정(_pasteTarget)부터 제품 길
  const r = await page.evaluate((before) => { const f = document.getElementById('frV'); const n = [...f.querySelectorAll(':scope > .frame-block[data-text-frame]')].find((e) => !before.includes(e.id));
    if (!n) return null; const q = n.getBoundingClientRect(), fr = f.getBoundingClientRect();
    return { txt: n.querySelector('[class^="tb-"]').textContent, ov: n.dataset.overlayBlock || null, host: window.OverlayFloat.floatHostOf(n)?.id, ret: n.dataset.overlayReturnParent,
      inside: q.left >= fr.left - 1 && q.top >= fr.top - 1 && q.right <= fr.right + 1 && q.bottom <= fr.bottom + 1 }; }, before);
  expect(r, '★프레임 자식으로 붙었다').toBeTruthy();
  expect([r.txt, r.ov, r.host, r.ret], '★그 프레임 안 오버레이 · 해제 자리도 이 프레임').toEqual(['섹션 오버레이', 'true', 'frV', 'frV']);
  expect(r.inside, '★프레임 안에 보인다(섹션 좌표 600 을 들고 오지 않음)').toBe(true);
  expect(errs).toEqual([]);
});

test('G5 프레임 안 오버레이를 끄면 프레임 안 제자리로', async ({ page }) => {
  const errs = await scene(page);
  await pickKid(page); await toggleTxt(page);
  await pickKid(page); await toggleTxt(page);
  const b = await st(page, 'tfK');
  expect([b.ov, b.par], '★오버레이 풀림 · 부모 = 프레임(섹션으로 안 감)').toEqual([null, 'frV']);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('tfK')).position), '★자유배치 프레임이면 자유 자식(absolute)으로 남음 — 흐름으로 풀려 겹쳐 쌓이지 않음').toBe('absolute');
  expect(errs).toEqual([]);
});

test('G6 프레임을 ⌘↓ 로 순서 바꾸면 프레임 안 오버레이도 같이', async ({ page }) => {
  const errs = await scene(page);
  await pickKid(page); await toggleTxt(page);
  const a = await st(page, 'tfK');
  await page.evaluate(() => { window.deselectAll(); document.activeElement?.blur?.(); });
  const [x, y, w, h] = await rect(page, '#frV');
  await page.mouse.click(x + w - 30, y + h - 30); await raf(page);
  expect(await page.evaluate(() => document.getElementById('frV').classList.contains('selected')), '[전제] 프레임을 골랐다').toBe(true);
  const order = () => page.evaluate(() => { const f = document.getElementById('frV'); return [...f.parentElement.children].filter((e) => e.id && !e.classList.contains('drop-indicator')).map((e) => e.id); });
  const o0 = await order();
  await page.keyboard.press('Meta+ArrowDown'); await raf(page);
  const o1 = await order();
  expect(o1.indexOf('frV') > o1.indexOf('tfB') && o0.indexOf('frV') < o0.indexOf('tfB'), `★⌘↓ 로 아래 글자 뒤로 ${JSON.stringify([o0, o1])}`).toBe(true);
  const b = await st(page, 'tfK');
  expect([b.par, b.ov, b.host], '★안쪽 오버레이 = 그대로 프레임 자식').toEqual(['frV', 'true', 'frV']);
  expect(b.rel, '★프레임 안 상대 자리 그대로').toEqual(a.rel);
  expect(b.y > a.y, `★화면에선 프레임과 같이 아래로 ${a.y}→${b.y}`).toBe(true);
  expect(errs).toEqual([]);
});
