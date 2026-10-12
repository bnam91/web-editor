/* grid-children-shell-bytes.dom.spec.js — G19 C2 「그리드 껍데기만 갈아끼우기」가 «자식이 없는 그리드»의 렌더를 한 바이트도 안 바꾼다.
 *   G19 = 그리드 밑에 형제 블럭을 쌓는 그릇(.grd-children). renderGridBlock 이 `block.innerHTML` 통째 교체 대신
 *   replaceShellKeepChildren(block, html, 'grd-children') 을 부른다 — 그릇이 없으면 옛 줄과 같은 대입.
 * B0 ★지키는 시험 — 기준판 37ab1c65(G19 직전 origin/dev)와 block.outerHTML «바이트 동일»(일곱 꼴 × render·재렌더·재재렌더 = 21건).
 *    기준판은 «git show 37ab1c65:<경로>» 로 같은 앱을 한 번 더 띄워 잰다(외부 체크아웃 경로에 안 기댄다 — width-model W0 와 같은 수법).
 *    난수 id 속성만 비교에서 지운다. 첫 차이 자리를 BYTEDIFF 줄로 찍는다(빨강일 때 무엇이 달라졌는지 바로 보이게).
 *    ★전제 단언 먼저: 두 판 모두 오류 0 · 표본 21건이 «실제로» 모였다(0건 초록 금지).
 *    양성대조(2026-10-03 G19 생성자 실측): ⑴ .grd-inner 에 속성 하나(data-mut) 더하면 21/21 상이 ⑵ 자식 0개여도 빈 .grd-children 을
 *    늘 만드는 돌연변이면 21/21 상이 — 이 자는 «속성 하나»와 «빈 그릇 하나»를 둘 다 본다.
 * 하네스 = _root-harness bootApp(앱 통째 헤드리스, ⛔Electron 아님).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const { execFileSync } = require('child_process');
const { bootApp, ORIGIN } = require('./_root-harness.js');

const BASE = '37ab1c65';
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


const SNAP = () => {
  const inner = document.getElementById('innerW'), fr = document.getElementById('frW');
  const out = {};
  const mk = (opts) => window.makeGridBlock(opts);
  const take = (k, b) => { out[k] = b.outerHTML; window.renderGridBlock(b); out[k + '·재렌더'] = b.outerHTML; window.renderGridBlock(b); out[k + '·재재렌더'] = b.outerHTML; };
  { const { row, block } = mk({}); inner.appendChild(row); take('W0 흐름 기본', block); }
  { const { row, block } = mk({ gap: 8 }); inner.appendChild(row); block.dataset.fullBleed = 'true'; window.renderGridBlock(block); take('W0 흐름 패딩제외', block); }
  { const { row, block } = mk({}); fr.appendChild(row); take('W0 자유프레임 row 안', block); }
  { const { row, block } = mk({}); inner.appendChild(row); block.dataset.overlayBlock = 'true'; block.dataset.overlayFrozenWidth = '333px'; window.renderGridBlock(block); take('W0 떠 있음(굳힌 폭)', block); }
  { const { row, block } = mk({}); inner.appendChild(row); take('fresh 기본 한 번 더', block); }
  { const { row, block } = mk({}); inner.appendChild(row); block.dataset.fullBleed = 'true'; block.dataset.overlayBlock = 'true'; block.dataset.overlayFrozenWidth = '500px'; window.renderGridBlock(block); take('overlay+fullBleed', block); }
  { const { row, block } = mk({ gap: 20 }); inner.appendChild(row); block.dataset.overlayBlock = 'true'; window.renderGridBlock(block); take('overlay 폭 없음 gap20', block); }
  return out;
};
/* ★토큰 되돌리기는 ★공용 한 곳에서 뜬다 — tests/dom/_golden-tokens.js
 *   (핀 37ab1c65 과 견준다 · ⛔여기에 사본을 두지 마라: 2026-10-08 까지 W0·B0 에 복사돼 있었고
 *    FONT 토큰을 더할 자리가 다섯으로 늘어 명부가 다섯이 될 참이었다). */
const { tokensBack, TOKEN_NAMES } = require('./_golden-tokens.js');
test.setTimeout(120000);
test('B0 ★자식 없는 그리드 — 37ab1c65 와 block.outerHTML 바이트 동일(일곱 꼴 × 재렌더 = 21건)', async ({ browser }) => {
  const pCur = await browser.newPage(), pBase = await browser.newPage();
  const e1 = await setup(pCur, bootApp), e2 = await setup(pBase, bootBase);
  const cur = await pCur.evaluate(SNAP), base = await pBase.evaluate(SNAP);
  const ids = (h) => h.replace(/ id="[^"]*"/g, ' id=""');   // id 는 난수 — 비교에서만 지운다
  let eq = 0, diff = 0, nE127 = 0, nFont = 0; const lines = [];
  for (const k of Object.keys(base)) {
    /* ★핀 37ab1c65 = ★E127 ★이전 판 ⇒ ★둘 다 되돌린다. */
    const back = tokensBack(cur[k], ['E127', 'FONT']); nE127 += (back.counts.E127||0); nFont += (back.counts.FONT||0);
    const a = ids(back.s), b = ids(base[k]);
    if (a === b) eq++; else { diff++; let j = 0; while (j < a.length && a[j] === b[j]) j++; lines.push(`${k} @${j}: now=${JSON.stringify(a.slice(Math.max(0, j - 30), j + 60))} pin=${JSON.stringify(b.slice(Math.max(0, j - 30), j + 60))}`); }
  }
  console.log(`BYTECOUNT total=${Object.keys(base).length} equal=${eq} different=${diff} errs=${e1.length}/${e2.length} e127tokens=${nE127} fonttokens=${nFont}`);
  lines.forEach(l => console.log('BYTEDIFF ' + l));
  expect(e1).toEqual([]); expect(e2).toEqual([]);
  expect(Object.keys(base).length, '★표본이 21건이 아니다 — 자가 «덜» 재고 있다').toBe(21);
  expect(Object.keys(cur).sort()).toEqual(Object.keys(base).sort());
  // ★무엇이 다른지 실패 글에 바로(10-06 integ25: «Expected 0 Received 21» 만 보였다 — console 줄이 리포트에 안 실림)
  expect(diff, `다른 판 ${diff}/${Object.keys(base).length} — 첫 셋:\n${lines.slice(0, 3).join('\n')}`).toBe(0);
  /* ★영수증을 ★둘로 가른다 — 한 보정이 헛돌아도 다른 보정이 가려 주지 않는다. */
  expect(nE127, `영수증 ⑴ — E127 토큰을 실제로 되돌렸다(잰 값 ${nE127} · 0 이면 정규화가 헛돈다)`).toBeGreaterThan(0);
  expect(nFont, `영수증 ⑵ — FONT 토큰을 실제로 되돌렸다(잰 값 ${nFont} · 0 이면 fontChain 값이 바뀌어 이 자가 썩었다)`).toBeGreaterThan(0);
  const k0 = Object.keys(base)[0], mut = ids(tokensBack(cur[k0].replace('grd-line', 'grd-linX'), ['E127', 'FONT']).s);
  expect(mut, '[양성대조] 글자색 아닌 바이트를 바꾸면 되돌려도 기준판과 다르다').not.toBe(ids(base[k0]));
});

/* B1 ★자식이 있으면 «격자 껍데기만» 다시 그린다 — 재렌더 셋(renderGridBlock · updateGridBlock · rebindAll)을 지나도
 *    .grd-children 과 그 안 블럭(같은 노드)이 남고, .grd-inner 는 «하나»이며 자식 없는 쌍둥이의 .grd-inner 와 바이트가 같다.
 *    (37ab1c65 에서는 빨강 — 재렌더가 block.innerHTML 통째 교체라 자식이 0개가 된다: 측정 M1·M2.)
 * B2 빈 그릇(요소 자식 0개)은 다음 렌더에서 걷힌다 — 자식을 다 빼낸 그리드는 옛 모양(바이트)으로 돌아온다. */
test('B1 ★자식이 있으면 재렌더 셋을 지나도 .grd-children·그 안 블럭(같은 노드)이 남고 .grd-inner 는 쌍둥이와 바이트 같다', async ({ page }) => {
  const errs = await setup(page, bootApp);
  const r = await page.evaluate(() => {
    const inner = document.getElementById('innerW');
    const a = window.makeGridBlock({}); inner.appendChild(a.row);
    const b = window.makeGridBlock({}); inner.appendChild(b.row);   // 쌍둥이(자식 없음)
    const g = a.block;
    g.insertAdjacentHTML('beforeend', '<div class="grd-children"><div class="gap-block" data-type="gap" id="k1" style="height:30px"></div></div>');
    const k1 = document.getElementById('k1');
    const premise = { kids: g.querySelectorAll(':scope > .grd-children > *').length };
    const steps = {};
    const look = () => ({
      kidsSame: document.getElementById('k1') === k1 && k1.parentElement?.classList.contains('grd-children') && k1.parentElement.parentElement === g,
      order: [...g.children].map(c => c.className),
      innerEq: g.querySelector(':scope > .grd-inner').outerHTML === b.block.querySelector(':scope > .grd-inner').outerHTML,
    });
    window.renderGridBlock(g); window.renderGridBlock(b.block); steps.render = look();
    window.updateGridBlock(g.id, { gap: 40 }); window.updateGridBlock(b.block.id, { gap: 40 }); steps.update = look();
    window.rebindAll(); steps.rebind = look();
    return { premise, steps };
  });
  expect(errs).toEqual([]);
  expect(r.premise.kids, '전제 — 자식 하나를 심었다').toBe(1);
  for (const [k, v] of Object.entries(r.steps)) {
    expect(v.kidsSame, `${k} 뒤 자식 블럭이 «같은 노드»로 그릇 안에 남아야 한다`).toBe(true);
    expect(v.order, `${k} 뒤 직계 순서 = [격자, 그릇]`).toEqual(['grd-inner', 'grd-children']);
    expect(v.innerEq, `${k} 뒤 .grd-inner 바이트 = 자식 없는 쌍둥이`).toBe(true);
  }
});

test('B2 빈 그릇(요소 자식 0개)은 다음 렌더에서 걷힌다 — 쌍둥이와 outerHTML(id 제외) 같다', async ({ page }) => {
  const errs = await setup(page, bootApp);
  const r = await page.evaluate(() => {
    const inner = document.getElementById('innerW');
    const a = window.makeGridBlock({}); inner.appendChild(a.row);
    const b = window.makeGridBlock({}); inner.appendChild(b.row);
    a.block.insertAdjacentHTML('beforeend', '<div class="grd-children"></div>');
    const premise = a.block.querySelectorAll(':scope > .grd-children').length;
    window.renderGridBlock(a.block); window.renderGridBlock(b.block);
    const ids = (h) => h.replace(/ id="[^"]*"/g, '');
    return { premise, left: a.block.querySelectorAll(':scope > .grd-children').length, same: ids(a.block.outerHTML) === ids(b.block.outerHTML) };
  });
  expect(errs).toEqual([]);
  expect(r.premise, '전제 — 빈 그릇을 심었다').toBe(1);
  expect(r.left).toBe(0);
  expect(r.same).toBe(true);
});
