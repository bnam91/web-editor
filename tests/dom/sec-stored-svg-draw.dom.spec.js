/* sec-stored-svg-draw.dom.spec.js — 저장·불러온 svg 를 «세척 없이 innerHTML» 하던 8곳 (SEC 261114 · 지디 결정 — 피그마 에셋 가져오기 앞 단독 커밋)
 *   위협: 손댄 프로젝트 파일·라이브러리 폴더·localStorage 즐겨찾기 안의 svg 문자열(어제 SEC-VECTOR-SVG-RAW-01 과 같은 길).
 *   고침: 8곳 모두 «그릴 때» js/util/sanitize-svg.js sanitizeSvgString — 저장 형식·데이터는 그대로.
 *   P1 prop-iconify.js 라이브러리 미리보기 · P2 같은 곳 «적용»(블럭 DOM·dataset.iconSvg) · P3 sticker-block.js 아이콘 스티커
 *   P4 prop-sticker.js 스티커 즐겨찾기 미리보기 · P5 iconify-panel.js 아이콘 창 즐겨찾기 칸 · P6 같은 창 «고른 아이콘» 미리보기
 *   P7 modal-block.js 모달 아이콘 · P8 canvas-block.js 카드 아이콘
 *   G1 [지킴] 멀쩡한 아이콘식 svg(g·path·defs·linearGradient·stop-color 속성)는 세척 뒤에도 도형·그라데이션 수가 같다(P3 길)
 *   ── 2차(인텔 전수 modal-icon-img-fallback I0·I1·I3 회귀 · 지디 261114) — 저장된 아이콘이 iconify «<img src=https://…> 폴백»일 수 있다 ──
 *   P9  모달 아이콘 · P10 아이콘 스티커 — <img> 폴백에 onerror·onload 를 심어도: img 는 «그려진다»(https src 그대로) · on* 0 · 표식 0
 *       고침: 6곳(P3~P8)이 sanitizeIconMarkup(svg 면 sanitizeSvgString · <img> 하나면 다시 지음 · 그 밖 '')
 *       양성대조: modal-block.js `? sanitizeIconMarkup(svg)` → `? sanitizeSvgString(svg)` 면 P9 ＋ modal-icon-img-fallback I0·I1·I3 빨강
 *                · sticker-block.js `sanitizeIconMarkup(iconSvg)` → `sanitizeSvgString(iconSvg)` 면 P10 빨강
 * 칸마다 단언(그 그릇 안 svg 들만): on* 속성 0 · image/script/foreignObject/img 0 · ★멀쩡한 path 는 남는다(빈 그림 초록 금지) · pageerror 0.
 *   표식(window.__pwn*)은 덤 — 비동기(onerror)는 고정 대기 없이는 못 기다리므로 판정은 «DOM 에 핸들러가 없다»가 본체다.
 * 양성대조: 그 칸의 한 줄에서 sanitizeSvgString( … ) 를 걷으면(날것으로 되돌리면) 그 칸만 빨강.
 *   P1 js/props/prop-iconify.js `cell.innerHTML = sanitizeSvgString(res.svg)` · P2 같은 파일 `const svg = sanitizeSvgString(res.svg)`
 *   P3 js/blocks/sticker-block.js `block.innerHTML = sanitizeSvgString(iconSvg)` · P4 js/props/prop-sticker.js `holder.innerHTML = sanitizeSvgString(p.iconSvg)`
 *   P5 js/panels/iconify-panel.js `holder.innerHTML = sanitizeSvgString(p.iconSvg)` · P6 같은 파일 `holder.innerHTML = sanitizeSvgString(sel.svg)`
 *   P7 js/blocks/modal-block.js `? sanitizeSvgString(svg)` · P8 js/blocks/canvas-block.js `wrap.innerHTML = sanitizeSvgString(card.icon.svg)`
 * ⛔네트워크 0 — api.iconify.design 은 route 로 끊는다. ⚠️실제 Iconify 아이콘 표본의 모양 유지는 이 파일이 못 잰다(G1 은 손으로 쓴 꼴).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const OK_D = 'M1 1h22v22H1z';
const EVIL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" onload="window.__pwnA=1">`
  + `<path d="${OK_D}" fill="currentColor"/>`
  + `<image href="data:," onerror="window.__pwnB=1"/>`
  + `<script>window.__pwnC=1</script>`
  + `<foreignObject width="10" height="10"><img src="data:," onerror="window.__pwnD=1"></foreignObject></svg>`;

async function boot(page) {
  await page.route('https://api.iconify.design/**', (r) => r.abort());
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); window.deselectAll?.(); window.selectSection(c.querySelector('.section-block'));
  });
  return errs;
}
/** 그릇(sel) 안 svg 들을 잰다. */
async function inspect(page, sel) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return page.evaluate(([sel, okD]) => {
    const root = document.querySelector(sel);
    if (!root) return { missing: sel };
    const svgs = [...root.querySelectorAll('svg')];
    const all = svgs.flatMap((s) => [s, ...s.querySelectorAll('*')]);
    return {
      svgs: svgs.length,
      onAttrs: all.filter((e) => [...e.attributes].some((a) => /^on/i.test(a.name))).length,
      bad: root.querySelectorAll('svg image, svg script, svg foreignObject, svg img').length,
      okPaths: all.filter((e) => e.tagName.toLowerCase() === 'path' && e.getAttribute('d') === okD).length,
      flags: ['__pwnA', '__pwnB', '__pwnC', '__pwnD'].filter((k) => window[k]),
    };
  }, [sel, OK_D]);
}
function judge(r, errs, label) {
  expect(r.missing, `[전제] ${label} 그릇이 없다`).toBeUndefined();
  expect(r.svgs, `[전제] ${label} svg 가 그려졌다`).toBeGreaterThan(0);
  expect(r.okPaths, `★${label} 멀쩡한 path 가 사라졌다(빈 그림)`).toBeGreaterThan(0);
  expect(r.onAttrs, `★${label} on* 핸들러가 DOM 에 남았다(세척 없이 innerHTML)`).toBe(0);
  expect(r.bad, `★${label} image/script/foreignObject/img 가 DOM 에 남았다`).toBe(0);
  expect(r.flags, `★${label} 핸들러가 실행됐다`).toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
}

/** 라이브러리(svgPresets) 가짜 — 카테고리 qa 에 evil.svg 하나. 나머지 electronAPI 는 하네스와 같이 null. */
async function fakeLibrary(page) {
  await page.evaluate((evil) => {
    const svgPresets = {
      list: async () => ({ ok: true, categories: [{ name: 'qa', items: [{ name: 'evil', file: 'evil.svg' }] }] }),
      read: async () => ({ ok: true, svg: evil }),
    };
    window.electronAPI = new Proxy({ svgPresets }, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) });
  }, EVIL);
}
async function iconifyPanel(page) {
  await fakeLibrary(page);
  await page.evaluate(() => {
    // addIconifyBlock 은 { row, block } 을 돌려준다(블럭 클래스는 .icon-block — 인텔 r: .iconify-block 으로 찾다 TypeError)
    const b = window.addIconifyBlock('mdi:star', '<svg viewBox="0 0 24 24"><path d="M2 2h4v4H2z"/></svg>', 64)?.block;
    if (!b) throw new Error('[전제] addIconifyBlock 이 블럭을 안 돌려줬다');
    b.id = 'qaI'; window.showIconifyProperties(b);
  });
  await page.waitForFunction(() => !!document.querySelector('#icn-preset-grid button[data-file="evil.svg"] svg'), null, { timeout: 5000 });
}

test('P1 라이브러리 미리보기(prop-iconify) — 세척본만 그린다', async ({ page }) => {
  const errs = await boot(page);
  await iconifyPanel(page);
  judge(await inspect(page, '#icn-preset-grid'), errs, 'P1');
});

test('P2 라이브러리 «적용»(prop-iconify) — 블럭과 dataset 에 세척본', async ({ page }) => {
  const errs = await boot(page);
  await iconifyPanel(page);
  await page.click('#icn-preset-grid button[data-file="evil.svg"]');
  await page.waitForFunction(() => document.getElementById('qaI')?.dataset.iconName === 'preset:qa/evil', null, { timeout: 5000 });
  judge(await inspect(page, '#qaI'), errs, 'P2');
  const ds = await page.evaluate(() => document.getElementById('qaI').dataset.iconSvg || '');
  expect(ds, '★P2 dataset.iconSvg 에 핸들러가 남았다(다음 그리기·저장으로 이어진다)').not.toMatch(/\son[a-z]+\s*=|<script|<image|foreignObject/i);
});

test('P3 아이콘 스티커(sticker-block) — 저장된 data-icon-svg 를 그릴 때 거른다', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate((evil) => {
    const sec = document.querySelector('#canvas .section-block');
    const before = new Set(sec.querySelectorAll('.sticker-block'));
    window.addStickerBlock({ shape: 'icon', iconSvg: evil });
    [...sec.querySelectorAll('.sticker-block')].find((x) => !before.has(x)).id = 'qaS';
  }, EVIL);
  judge(await inspect(page, '#qaS'), errs, 'P3');
});

const FAV = (evil) => JSON.stringify([{ shape: 'icon', iconSvg: evil, iconName: 'qa', iconColor: '#222222', size: '64' }]);

test('P4 스티커 즐겨찾기 미리보기(prop-sticker) — localStorage svg 를 거른다', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate((fav) => {
    localStorage.setItem('goditor.stickerFavorites', fav);
    const sec = document.querySelector('#canvas .section-block');
    const before = new Set(sec.querySelectorAll('.sticker-block'));
    window.addStickerBlock({ shape: 'circle' });
    const b = [...sec.querySelectorAll('.sticker-block')].find((x) => !before.has(x));
    window.showStickerProperties(b);
  }, FAV(EVIL));
  await page.waitForFunction(() => !!document.querySelector('#stk-fav-grid .stk-fav-icon svg'), null, { timeout: 5000 });
  judge(await inspect(page, '#stk-fav-grid'), errs, 'P4');
});

async function iconifyModalFav(page) {
  await page.evaluate((fav) => { localStorage.setItem('goditor.stickerFavorites', fav); window.openIconifyModal(() => {}, { favorites: true }); }, FAV(EVIL));
  await page.click('.iconify-subtab[data-subtab="favorite"]');
  await page.waitForFunction(() => !!document.querySelector('#iconify-fav-grid .iconify-fav-svg svg'), null, { timeout: 5000 });
}

test('P5 아이콘 창 즐겨찾기 칸(iconify-panel) — 거른다', async ({ page }) => {
  const errs = await boot(page);
  await iconifyModalFav(page);
  judge(await inspect(page, '#iconify-fav-grid'), errs, 'P5');
});

test('P6 아이콘 창 «고른 아이콘» 미리보기(iconify-panel) — 거른다', async ({ page }) => {
  const errs = await boot(page);
  await iconifyModalFav(page);
  await page.click('#iconify-fav-grid .iconify-fav-cell');
  await page.waitForFunction(() => !!document.querySelector('#iconify-selected-preview svg'), null, { timeout: 5000 });
  judge(await inspect(page, '#iconify-selected-preview'), errs, 'P6');
});

test('P7 모달 아이콘(modal-block) — 저장된 data-icon-svg 를 그릴 때 거른다', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate((evil) => {
    const { row, block } = window.makeModalBlock({ variant: 'icon' });
    block.id = 'qaM'; block.dataset.iconSvg = evil;
    document.querySelector('#canvas .section-block .section-inner').appendChild(row || block);
    window.renderModalBlock(block);
  }, EVIL);
  judge(await inspect(page, '#qaM'), errs, 'P7');
});

test('P8 카드 아이콘(canvas-block) — 카드 데이터의 icon.svg 를 그릴 때 거른다', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate((evil) => {
    const made = window.makeCanvasBlock({ cardMode: 'simple', iconMode: true, cards: [{ title: 't', desc: '', imgSrc: '', cellBg: '', icon: { svg: evil } }] });
    const b = made.block || made; b.id = 'qaC';
    document.querySelector('#canvas .section-block .section-inner').appendChild(made.row || b);
    window.renderCanvas(b);
  }, EVIL);
  judge(await inspect(page, '#qaC'), errs, 'P8');
});

test('G1 [지킴] 멀쩡한 아이콘식 svg 는 세척 뒤에도 같은 모양(도형·그라데이션 수)', async ({ page }) => {
  const errs = await boot(page);
  const GOOD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="qg" x1="0" y1="0" x2="1" y2="1">'
    + '<stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient></defs>'
    + `<g stroke="currentColor" stroke-width="2"><path d="${OK_D}"/><circle cx="12" cy="12" r="4"/></g><path d="M4 20h16" fill="url(#qg)"/></svg>`;
  const r = await page.evaluate((good) => {
    const sec = document.querySelector('#canvas .section-block');
    const before = new Set(sec.querySelectorAll('.sticker-block'));
    window.addStickerBlock({ shape: 'icon', iconSvg: good });
    const b = [...sec.querySelectorAll('.sticker-block')].find((x) => !before.has(x));
    const q = (s) => b.querySelectorAll(s).length;
    return { path: q('svg path'), circle: q('svg circle'), stop: q('svg stop'), grad: q('svg linearGradient'), gradFill: b.querySelector('svg path[fill^="url(#"]')?.getAttribute('fill') || null };
  }, GOOD);
  expect(r).toEqual({ path: 2, circle: 1, stop: 2, grad: 1, gradFill: 'url(#qg)' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

const IMG_EVIL = '<img src="https://api.iconify.design/qa/warn.svg" onerror="window.__pwnE=1" onload="window.__pwnL=1" width="24" height="24" style="display:block;">';
const OK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect width="24" height="24" fill="#c00"/></svg>';
async function imgCheck(page, sel) {
  await page.waitForFunction((sel) => { const i = document.querySelector(sel + ' img'); return !!i && i.complete; }, sel, { timeout: 5000 }).catch(() => {});
  return page.evaluate((sel) => {
    const root = document.querySelector(sel); const img = root?.querySelector('img');
    return { missing: !root, img: !!img, src: img?.getAttribute('src') || null, natural: img?.naturalWidth || 0,
      onAttrs: [...(root?.querySelectorAll('*') || [])].filter((e) => [...e.attributes].some((a) => /^on/i.test(a.name))).length,
      flags: ['__pwnE', '__pwnL'].filter((k) => window[k]) };
  }, sel);
}
function judgeImg(r, errs, label) {
  expect(r.missing, `[전제] ${label} 그릇`).toBe(false);
  expect(r.img, `★${label} <img> 폴백 아이콘이 빈칸이 됐다(표시 손실)`).toBe(true);
  expect(r.src).toBe('https://api.iconify.design/qa/warn.svg');
  expect(r.natural, `[전제] ${label} 그림이 실제로 실렸다(route 고정 svg)`).toBeGreaterThan(0);
  expect(r.onAttrs, `★${label} on* 핸들러가 DOM 에 남았다`).toBe(0);
  expect(r.flags, `★${label} 핸들러가 실행됐다`).toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
}

test('P9 [2차] 모달 아이콘 — <img> 폴백은 그리고 핸들러는 0', async ({ page }) => {
  const errs = await boot(page);
  // ★boot() 가 api.iconify.design/** 를 abort 로 건다 — Playwright 는 «나중에 건» route 가 먼저 먹으므로 이 fulfill 은 boot «뒤»(인텔 5bff7331f: 앞에 걸어 natural 0)
  await page.route('https://api.iconify.design/qa/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: OK_SVG }));
  await page.evaluate((img) => {
    const { row, block } = window.makeModalBlock({ variant: 'icon' });
    block.id = 'qaM2'; block.dataset.iconSvg = img;
    document.querySelector('#canvas .section-block .section-inner').appendChild(row || block);
    window.renderModalBlock(block);
  }, IMG_EVIL);
  judgeImg(await imgCheck(page, '#qaM2'), errs, 'P9');
});

test('P10 [2차] 아이콘 스티커 — <img> 폴백은 그리고 핸들러는 0', async ({ page }) => {
  const errs = await boot(page);
  // ★boot() 가 api.iconify.design/** 를 abort 로 건다 — Playwright 는 «나중에 건» route 가 먼저 먹으므로 이 fulfill 은 boot «뒤»(인텔 5bff7331f: 앞에 걸어 natural 0)
  await page.route('https://api.iconify.design/qa/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: OK_SVG }));
  await page.evaluate((img) => {
    const sec = document.querySelector('#canvas .section-block');
    const before = new Set(sec.querySelectorAll('.sticker-block'));
    window.addStickerBlock({ shape: 'icon', iconSvg: img });
    [...sec.querySelectorAll('.sticker-block')].find((x) => !before.has(x)).id = 'qaS2';
  }, IMG_EVIL);
  judgeImg(await imgCheck(page, '#qaS2'), errs, 'P10');
});
