/* grid-block-width-model.dom.spec.js — G2-a 「그리드 블럭 자체 너비」 «모델»만 잠근다 (TASK-20261003-goditor-32 G2).
 *   키 = data-grid-width (px 정수) · 없으면 100%(옛 뜻) · 패널/핸들은 G2-b.
 * W0 ★지키는 시험 — 키가 없으면 bf9161d0 과 style·innerHTML «바이트 동일»(기존 그리드 겉모습 불변).
 *    기준판은 «git show bf9161d0:<경로>» 로 같은 앱을 한 번 더 띄워 잰다(외부 체크아웃 경로에 안 기댄다).
 * W1 키가 있으면 그 폭으로 그린다 · 다시 그려도 산다. W2 무효 키 = 없는 것. W3 저장 왕복. W4 ⌘Z 한 걸음·⌘⇧Z.
 * 하네스 = _root-harness bootApp(앱 통째 헤드리스, ⛔Electron 아님).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const { execFileSync } = require('child_process');
const { bootApp, ORIGIN } = require('./_root-harness.js');

const BASE = 'bf9161d0';
const REPO = path.join(__dirname, '..', '..');
const MIME = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png' };
const _baseCache = new Map();
function baseFile(rel) {
  if (_baseCache.has(rel)) return _baseCache.get(rel);
  let buf = null;
  try { buf = execFileSync('git', ['show', `${BASE}:${rel}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (_) { buf = null; }
  _baseCache.set(rel, buf);
  return buf;
}
/* bootApp 과 같은 꼴 — 파일만 «기준판 git 객체»에서 읽는다. */
async function bootBase(page) {
  await page.addInitScript(() => { window.electronAPI = new Proxy({}, { get: () => (() => Promise.resolve(null)) }); });
  await page.addInitScript(() => { window.prompt = () => { throw new Error('prompt() is not supported.'); }; });
  await page.route(`${ORIGIN}/**`, async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\/+/, '');
    const buf = baseFile(rel);
    if (!buf) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ contentType: MIME[path.extname(rel)] || 'application/octet-stream', body: buf });
  });
  await page.goto(`${ORIGIN}/index.html`);
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.groupSelectedBlocks === 'function', null, { timeout: 20000 });
}

const SEC = `<div class="section-block" id="sW" data-section="1" data-name="sW" style="padding-left:40px;padding-right:40px"><div class="section-hitzone"></div><div class="section-inner" id="innerW">
  <div class="gap-block" data-type="gap" style="height:40px"></div>
  <div class="frame-block" id="frW" data-free-layout="true" style="position:relative;width:700px;height:400px;"></div>
  <div class="gap-block" data-type="gap" style="height:40px"></div></div></div>`;

async function setup(page, boot) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await boot(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.();
  }, SEC);
  return errs;
}

/* 같은 손으로 네 꼴을 만들고 «블럭 상자의 style + innerHTML» 을 뜬다. 키는 «안» 쓴다. */
const SNAP = () => {
  const inner = document.getElementById('innerW'), fr = document.getElementById('frW');
  const out = {};
  const mk = (opts) => window.makeGridBlock(opts);
  const take = (k, b) => { out[k] = { style: b.getAttribute('style'), html: b.innerHTML }; window.renderGridBlock(b); out[k + '·재렌더'] = { style: b.getAttribute('style'), html: b.innerHTML }; };
  { const { row, block } = mk({}); inner.appendChild(row); take('흐름 기본', block); }
  { const { row, block } = mk({ gap: 8 }); inner.appendChild(row); block.dataset.fullBleed = 'true'; window.renderGridBlock(block); take('흐름 패딩제외', block); }
  { const { row, block } = mk({}); fr.appendChild(row); take('자유프레임 row 안', block); }
  { const { row, block } = mk({}); inner.appendChild(row); block.dataset.overlayBlock = 'true'; block.dataset.overlayFrozenWidth = '333px'; window.renderGridBlock(block); take('떠 있음(굳힌 폭)', block); }
  return out;
};

/* ★토큰 되돌리기는 ★공용 한 곳에서 뜬다 — tests/dom/_golden-tokens.js
 *   (핀 bf9161d0 과 견준다 · ⛔여기에 사본을 두지 마라: 2026-10-08 까지 W0·B0 에 복사돼 있었고
 *    FONT 토큰을 더할 자리가 다섯으로 늘어 명부가 다섯이 될 참이었다). */
const { tokensBack, TOKEN_NAMES } = require('./_golden-tokens.js');

test.setTimeout(120000);
test('W0 ★지키는 시험 — 키가 없으면 bf9161d0 과 style·innerHTML 바이트 동일(네 꼴 × 재렌더)', async ({ browser }) => {
  const pCur = await browser.newPage(), pBase = await browser.newPage();
  const e1 = await setup(pCur, bootApp), e2 = await setup(pBase, bootBase);
  const cur = await pCur.evaluate(SNAP), base = await pBase.evaluate(SNAP);
  expect(e1, '오류 0(이 판)').toEqual([]);
  expect(e2, '오류 0(기준판)').toEqual([]);
  expect(Object.keys(base).length, '전제 — 기준판에서도 여덟 판을 떴다').toBe(8);
  expect(base['흐름 기본'].style, '전제 — 기준판 흐름 그리드는 100%').toContain('width: 100%');
  expect(base['흐름 패딩제외'].style, '전제 — 패딩제외 꼴이 정말 걸렸다(calc)').toContain('calc(');
  let nE127 = 0, nFont = 0;
  for (const k of Object.keys(base)) {
    /* ★핀 bf9161d0 = ★E127 ★이전 판 ⇒ ★E127·FONT ★둘 다 되돌린다. */
    const WANT = ['E127', 'FONT'];
    const st = tokensBack(cur[k].style, WANT), ht = tokensBack(cur[k].html, WANT);
    nE127 += (st.counts.E127||0) + (ht.counts.E127||0); nFont += (st.counts.FONT||0) + (ht.counts.FONT||0);
    expect({ style: st.s, html: ht.s }, `«${k}» 이 기준판과 다르다(뜻한 바뀜 토큰만 되돌린 뒤)`).toEqual(base[k]);
  }
  console.log(`W0 토큰 되돌림 — E127 ${nE127} 자리 · FONT ${nFont} 자리 / ${Object.keys(base).length} 판`);
  /* ★영수증을 ★둘로 가른다 — 한 보정이 헛돌아도 다른 보정이 가려 주지 않는다. */
  expect(nE127, `영수증 ⑴ — E127 토큰을 실제로 되돌렸다(잰 값 ${nE127} · 0 이면 정규화가 헛돈다 · 10-06 실측 diff = 판마다 ×2)`).toBeGreaterThan(0);
  expect(nFont, `영수증 ⑵ — FONT 토큰을 실제로 되돌렸다(잰 값 ${nFont} · 0 이면 fontChain 값이 바뀌어 이 자가 썩었다)`).toBeGreaterThan(0);
  // 양성대조 — 글자색·글꼴 아닌 바이트 하나
  const k0 = '흐름 기본', mut = tokensBack(cur[k0].html.replace('grd-line', 'grd-linX'), ['E127', 'FONT']).s;
  expect(mut, '[양성대조] 글자색 아닌 바이트를 바꾸면 되돌려도 기준판과 다르다').not.toBe(base[k0].html);
  await pCur.close(); await pBase.close();
});

const mkIn = (page, hostId, gridWidth) => page.evaluate(([hostId, gw]) => {
  const { row, block } = window.makeGridBlock({});
  document.getElementById(hostId).appendChild(row);
  if (gw !== undefined) { block.dataset.gridWidth = String(gw); window.renderGridBlock(block); }
  window.bindBlock?.(block);
  return block.id;
}, [hostId, gridWidth]);
const widthOf = (page, id) => page.evaluate((id) => { const b = document.getElementById(id); return { css: b.style.width, w: b.offsetWidth, key: b.dataset.gridWidth ?? null, ml: b.style.marginLeft }; }, id);

test('W1 키가 있으면 그 px 폭으로 그린다 · 다시 그려도 산다 · 패딩제외보다 명시 폭이 이긴다', async ({ page }) => {
  const errs = await setup(page, bootApp);
  const id = await mkIn(page, 'innerW', 420);
  expect(await widthOf(page, id)).toMatchObject({ css: '420px', w: 420, key: '420' });
  await page.evaluate((id) => window.renderGridBlock(document.getElementById(id)), id);
  expect((await widthOf(page, id)).w, '재렌더 뒤에도 420').toBe(420);
  await page.evaluate((id) => { const b = document.getElementById(id); b.dataset.fullBleed = 'true'; window.renderGridBlock(b); }, id);
  expect(await widthOf(page, id), '패딩제외 켬 + 키 → 명시 폭, 음수 마진 없음').toMatchObject({ css: '420px', w: 420, ml: '' });
  const ctl = await mkIn(page, 'innerW');
  expect((await widthOf(page, ctl)).css, '대조 — 키 없는 그리드는 100%').toBe('100%');
  expect(errs).toEqual([]);
});

test('W2 무효 키(범위 밖·숫자 아님)는 «없는 것» = 100% · 고치는 문은 거절한다', async ({ page }) => {
  await setup(page, bootApp);
  for (const bad of ['10', 'abc', '99999', '']) {
    const id = await mkIn(page, 'innerW', bad);
    expect((await widthOf(page, id)).css, `키 ${JSON.stringify(bad)}`).toBe('100%');
  }
  const id = await mkIn(page, 'innerW');
  const r = await page.evaluate((id) => [window.updateGridBlock(id, { width: 5 }), window.updateGridBlock(id, { width: 'x' })].map(x => x.code), id);
  expect(r).toEqual(['INVALID', 'INVALID']);
  expect(await widthOf(page, id)).toMatchObject({ css: '100%', key: null });
});

test('W3 저장 왕복 — getSerializedCanvas → 도로 심고 rebindAll 해도 폭이 산다(키 없는 대조는 100%)', async ({ page }) => {
  const errs = await setup(page, bootApp);
  const id = await mkIn(page, 'innerW', 510), ctl = await mkIn(page, 'frW');
  const r = await page.evaluate(([id, ctl]) => {
    const s = window.getSerializedCanvas();
    const c = document.getElementById('canvas'); c.innerHTML = s; window.rebindAll();
    const b = document.getElementById(id), k = document.getElementById(ctl);
    return { saved: s.includes(`data-grid-width="510"`), key: b.dataset.gridWidth, w: b.offsetWidth, css: b.style.width, ctl: k.style.width, ctlKey: k.dataset.gridWidth ?? null };
  }, [id, ctl]);
  expect(r).toEqual({ saved: true, key: '510', w: 510, css: '510px', ctl: '100%', ctlKey: null });
  expect(errs).toEqual([]);
});

test('W4 ⌘Z 한 걸음 — updateGridBlock{width} 한 번을 ⌘Z 한 번이 되돌리고 ⌘⇧Z 가 다시 건다 · null 은 키를 지운다', async ({ page }) => {
  const errs = await setup(page, bootApp);
  const id = await mkIn(page, 'innerW');
  await page.evaluate(() => window.pushHistory?.('판'));
  const r1 = await page.evaluate((id) => window.updateGridBlock(id, { width: 380 }), id);
  expect(r1).toMatchObject({ ok: true, applied: { width: 380 } });
  expect(await widthOf(page, id)).toMatchObject({ css: '380px', w: 380, key: '380' });
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
  expect(await widthOf(page, id), '⌘Z 한 번 = 키 없음·100%').toMatchObject({ css: '100%', key: null });
  await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(250);
  expect(await widthOf(page, id), '⌘⇧Z = 다시 380').toMatchObject({ css: '380px', w: 380, key: '380' });
  const r2 = await page.evaluate((id) => window.updateGridBlock(id, { width: null }), id);
  expect(r2.ok).toBe(true);
  expect(await widthOf(page, id), 'null = 키를 지우고 100%').toMatchObject({ css: '100%', key: null });
  expect(errs).toEqual([]);
});
