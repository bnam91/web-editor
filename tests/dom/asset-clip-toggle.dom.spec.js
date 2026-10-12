/* asset-clip-toggle — ★에셋 「★내용 자르기」 ★토글을 ★★행위로 잰다 (2026-10-10 · 현빈 1010t1c2)
 *
 * ★현빈 원문 — 「★에셋블럭이나, ★그리드 블럭에 ★이미지줄를 추가했을때에도
 *   ★이미지 삽입할 수 있는 상황에서 ★★‘내용자르기’ 기능이 ★있으면 좋겠다」
 *
 * ★★이 파일이 ★잠그는 것
 *   ⑴ ★★«켬(기본)»이면 ★★프레임 밖에 ★★안 그려진다
 *   ⑵ ★★«끔»이면 ★★★그려진다 — ★★그것이 ★이 기능의 ★★존재 증명이다
 *   ⑶ ★★그리고 ★★«미설정»과 ★«켬»이 ★★★같은 그림이다 — ★★옛 바이트 보존의 ★행위 쪽 짝
 *
 * ★★자 ＋ ★★양성대조 — ⛔하나만 두면 ★★«안 쟀다»와 ★구분이 ★안 된다
 *   ★`bandAlive(band)` = ★그 띠가 ★잉크를 ★보일 수 ★있나(★초록 네모를 ★잠깐 둔다)
 *   ★`inkOutside()`   = ★★★매번 ★다시 찾아 ★숨겼다 찍는다. ⛔id 를 ★캐시하지 ★않는다 —
 *                       ★앱이 ★다시 그려 ★그 요소가 ★사라진다(★2026-10-10 실측: ★id 와 함께 ★던졌다)
 *                       ★★다시 찾았는데 ★없으면 ★★던진다. ⛔널 가드가 ★«통과»가 되면 ★또 ★둔갑한다
 *
 * ★★안 재는 것(⛔「닫았다」로 적지 않는다)
 *   · ★★그리드 — ★★★범위 ★밖이다. ★★`grid-block.js` ㈐ 가 ★스스로 적어 뒀다:
 *     「★`overflow:hidden` 을 붙이면 ★★flex 항목의 `min-height:auto` 가 ★★통째로 ★0 이 된다」
 *     ★★내 실측도 ★같았다(★상자 ★[386, ★0]) ⇒ ★★그 «별건»이 ★닫히기 ★전에는 ★못 짓는다
 *   · ★★사람이 ★패널에서 ★눌러 본 것 — ★여기서는 ★★dataset 으로 ★★모형을 ★바꾼다(★패널 배선은 ★유닛이 잰다)
 */
const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const { bootApp } = require('./_root-harness.js');

const BIG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="1600" height="1200" fill="#cc2222"/></svg>');
const h = (b) => crypto.createHash('md5').update(b).digest('hex');
const CLIP = '.asset-img-clip';
const IMG = '.asset-img-clip .asset-img';

async function bandAlive(page, band) {
  const before = h(await page.screenshot({ clip: band }));
  await page.evaluate((b) => {
    const d = document.createElement('div'); d.id = '__ALIVE__';
    d.style.cssText = 'position:fixed;left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.width
      + 'px;height:' + b.height + 'px;background:#00ff00;z-index:99999;';
    document.body.appendChild(d);
  }, band);
  await page.waitForTimeout(120);
  const during = h(await page.screenshot({ clip: band }));
  await page.evaluate(() => document.getElementById('__ALIVE__')?.remove());
  await page.waitForTimeout(80);
  return before !== during;
}
/** ⛔요소를 ★캐시하지 ★않는다 — ★매번 ★다시 찾고 ★없으면 ★던진다 */
const flip = (page, vis) => page.evaluate(([s, v]) => {
  const el = document.querySelector(s);
  if (!el) throw new Error('다시 찾았는데 없다: ' + s);
  el.style.visibility = v;
}, [IMG, vis]);

async function shot(page, band) {
  const a = h(await page.screenshot({ clip: band }));
  await flip(page, 'hidden');
  const b = h(await page.screenshot({ clip: band }));
  await flip(page, '');
  return { ink: a !== b, shown: a, hidden: b };
}
async function geo(page) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) throw new Error('다시 찾았는데 없다: ' + s);
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height),
             ov: getComputedStyle(el).overflow, ovInline: el.style.overflow || null,
             band: { x: Math.round(r.right + 2), y: Math.round(r.top + 6),
                     width: 60, height: Math.max(8, Math.round(r.height) - 12) } };
  }, CLIP);
}

test('AC1 ★★에셋 「내용 자르기」 — ★★켬(기본)은 ★안 그려지고 ★★★끔은 ★그려진다 (★양·음 ＋ ★띠 양성대조)', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await bootApp(page);
  /* ★앱 길로 ★짓는다 — `makeAssetBlock` ＋ `setAssetImageFromSrc` (`js/canvas-scratch-drop.js` 가 쓰는 ★그 길) */
  await page.evaluate(async (src) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.rebindAll?.(); window.deselectAll?.(); window.addSection();
    window.applyZoom?.(100);
    await new Promise((r) => setTimeout(r, 300));
    const { row, block } = window.makeAssetBlock();
    document.querySelector('.section-block .section-inner').appendChild(row);
    window.bindBlock?.(block); window.rebindAll?.();
    await new Promise((r) => setTimeout(r, 250));
    window.setAssetImageFromSrc(block, src);
    await new Promise((r) => setTimeout(r, 600));
    block.scrollIntoView({ block: 'center' });
    await new Promise((r) => setTimeout(r, 250));
    /* ★그림을 ★★상자보다 ★크게 — ★편집 모드가 ★쓰는 ★그 꼴(절대배치 ＋ px 폭) */
    const img = document.querySelector('.asset-img-clip .asset-img');
    if (!img) throw new Error('.asset-img 를 못 찾았다');
    Object.assign(img.style, { position: 'absolute', left: '0px', top: '0px',
                               width: '1600px', height: 'auto', objectFit: 'fill' });
    await new Promise((r) => setTimeout(r, 250));
  }, BIG);

  /* ─── ⑴ ★미설정(= ★기본 ★켬) ─── */
  const g0 = await geo(page);
  expect(g0.w, '★전제: 상자 폭이 ★너무 작다 — ★잘릴 것이 ★있어야 한다').toBeGreaterThan(200);
  expect(g0.ovInline, '★★전제: ★미설정인데 ★인라인 overflow 가 ★있다 — ★★옛 바이트 보존이 ★깨졌다').toBe(null);
  expect(g0.ov, '★전제: 기본인데 computed overflow 가 ★hidden 이 ★아니다').toBe('hidden');
  expect(await bandAlive(page, g0.band), '★★띠가 ★죽었다 — ★초록 네모를 둬도 ★잉크가 ★안 생긴다 ⇒ ★★«못 쟀다»').toBe(true);
  const s0 = await shot(page, g0.band);

  /* ─── ⑵ ★★끔 — ★★그려져야 한다(★이 기능의 ★존재 증명) ─── */
  const off = await page.evaluate(() => {
    const ab = document.querySelector('.asset-block');
    if (!ab) throw new Error('다시 찾았는데 없다: .asset-block');
    ab.dataset.clipContent = 'false';
    window.applyAssetClip(ab);
    return { ov: getComputedStyle(document.querySelector('.asset-img-clip')).overflow,
             ovInline: document.querySelector('.asset-img-clip').style.overflow || null };
  });
  await page.waitForTimeout(200);
  const g1 = await geo(page);
  const s1 = await shot(page, g1.band);

  /* ─── ⑶ ★다시 ★켬 — ★★미설정 꼴로 ★되돌아가야(★인라인 ★0) ─── */
  const back = await page.evaluate(() => {
    const ab = document.querySelector('.asset-block');
    delete ab.dataset.clipContent;
    window.applyAssetClip(ab);
    const clip = document.querySelector('.asset-img-clip');
    return { ov: getComputedStyle(clip).overflow, ovInline: clip.style.overflow || null };
  });
  await page.waitForTimeout(200);
  const s2 = await shot(page, (await geo(page)).band);

  console.log(`AC1 ★잰 값 — 상자 ${g0.w}x${g0.h} · 미설정 ink ${s0.ink} · 끔 ink ${s1.ink}(ov ${off.ov}/inline ${off.ovInline})`
    + ` · 되돌림 ink ${s2.ink}(ov ${back.ov}/inline ${back.ovInline})`);

  /* ★★★양성대조 먼저 — ★끔에서 ★잉크가 ★생겨야 ★아래 ★«켬의 ★0»이 ★뜻을 갖는다 */
  expect(off.ov, '★★끔인데 computed overflow 가 ★visible 이 ★아니다 — ★렌더러가 ★토글을 ★안 읽는다').toBe('visible');
  expect(s1.ink, '★★★양성대조 ★죽었다 — ★★끔으로 바꿔도 ★프레임 밖에 ★잉크가 ★안 생긴다'
    + ` (보인 ${s1.shown} / 숨긴 ${s1.hidden}) ⇒ ★★아래 «켬의 ★false» 는 ★★«안 쟀다»다`).toBe(true);
  /* ★★본 측정 */
  expect(s0.ink, '★★기본(미설정)인데 ★프레임 ★밖에 ★자식의 ★잉크가 ★있다 — ★★에셋이 ★안 자른다').toBe(false);
  /* ★★★옛 바이트 보존의 ★행위 쪽 짝 */
  expect(back.ovInline, '★★★다시 켰는데 ★인라인이 ★남았다 — ★★저장 바이트가 ★달라진다(지디 조건 ㉢)').toBe(null);
  expect(s2.shown, '★★★«미설정»과 ★«되돌림»의 ★그림이 ★다르다 — ★★되돌림이 ★원래 꼴이 ★아니다').toBe(s0.shown);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});
