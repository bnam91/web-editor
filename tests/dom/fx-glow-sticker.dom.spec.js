/* fx-glow-sticker — 글로우 이펙트 스티커(shape:'glow', 2026-10-06 지디 발주 FOUR).
 *
 * ★무엇을 잠그나
 *   F1 그리기(sticker-block.js glow 갈래) · F2 만들기(seed·프리셋) · F3 seed 결정성(공용 부품 js/fx/seeded-random.js — 소비자 1)
 *   F4 다시 그려도 같은 모습(리로드·undo 경로 = renderStickerBlock 재호출) · F5 패널 · F6 마지막 스타일 기억(__last 는 안 건드림)
 *   F7·F8 ★내보내기 두 경로에 후광이 «산다» — PNG(CDP Page.captureScreenshot · 오프스크린 fixed = export-image.js:249 와 같은 꼴)
 *         · 썸네일(html2canvas · save-load.js captureThumbnail 과 같은 옵션). ★모자이크가 죽은 자리를 «구조»로 막는 칸이다 — 빼지 마라.
 *         대조 = 같은 클론 안, 필터만 뗀 같은 스티커(후광 자리가 배경이어야 한다).
 *   F9 즐겨찾기는 «말하고» 거절 · F10 사람 손 복제(⌘D)에 필터 id 가 안 겹친다
 * ★headless == 실앱 근거: 2026-10-06 격리 실앱(captureSectionCdp) ×3 과 headless(fixed) 가 같은 값(SVG·CSS·text 셋 다).
 *   ⚠️headless 에서 position:absolute 로 -99999 에 두면 빈 그림이 찍힌다 — 반드시 fixed(앱과 같은 꼴).
 * 양성대조(판 sha 는 커밋 메시지·보고에): 필터 무력화 → F7·F8 빨강 · seed 를 Math.random 으로 → F3·F4 빨강 ·
 *   명부 셋(그리기·만들기·기억) 무력화 → 각 F1·F2·F6 빨강 · FxSeed 무력화 → 소비자 1(F3) 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

/* 섹션 하나(어두운 바탕) + 글로우 스티커를 만든다. 돌려주는 값 = 스티커 id 들. */
async function setup(page, specs) {
  return page.evaluate((specs) => {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = '<div class="section-block" id="secG" style="position:relative;height:320px;background:#101018"><div class="section-inner"></div></div>';
    window.rebindAll?.();
    const sec = document.getElementById('secG');
    return specs.map((o) => {
      const b = window.makeStickerBlock({ shape: 'glow', ...o });
      sec.appendChild(b);
      window.bindStickerSelect?.(b);
      return b.id;
    });
  }, specs);
}
const bodyOf = (page, id) => page.evaluate((id) => {
  const g = document.querySelector(`#${id} .sticker-glow-body`);
  return g ? g.innerHTML : null;
}, id);

test('F0 전제 — 공용 부품이 실렸고 스위치 판은 그대로다', async ({ page }) => {
  const errs = await bootApp(page);
  const r = await page.evaluate(() => ({ seed: typeof window.FxSeed?.mulberry32, glow: typeof window.GlowFx?.svg,
    kinds: window.GlowFx?.KINDS, make: typeof window.makeStickerBlock }));
  expect(r).toEqual({ seed: 'function', glow: 'function', kinds: ['star', 'flare', 'dot'], make: 'function' });
  expect(errs).toEqual([]);
});

test('F1·F2 그리기·만들기 — 종류 셋 다 SVG 필터(fxg-<id>)로 그리고, 만들 때 seed·프리셋이 박힌다', async ({ page }) => {
  await bootApp(page);
  const ids = await setup(page, [{ fxKind: 'star' }, { fxKind: 'flare' }, { fxKind: 'dot' }]);
  const r = await page.evaluate((ids) => ids.map(id => {
    const b = document.getElementById(id);
    const f = b.querySelector('svg.sticker-glow-svg filter');
    return { kind: b.dataset.fxKind, filterId: f?.id, blurs: b.querySelectorAll('feGaussianBlur').length,
      bodyUsesFilter: b.querySelector('.sticker-glow-body')?.getAttribute('filter'), seed: b.dataset.seed, glowColor: b.dataset.glowColor };
  }), ids);
  // 프리셋 기본 색 — «글자로» 박는다(glow-render.js 에서 읽으면 항등식)
  const WANT = { star: '#b06cff', flare: '#ff9a3c', dot: '#ffffff' };
  for (const [i, x] of r.entries()) {
    expect(x.filterId, `${x.kind}: 필터 id`).toBe('fxg-' + ids[i]);
    expect(x.blurs, `${x.kind}: 후광 3겹`).toBe(3);
    expect(x.bodyUsesFilter).toBe(`url(#fxg-${ids[i]})`);
    expect(Number(x.seed), `${x.kind}: 만들 때 seed`).toBeGreaterThan(0);
    expect(x.glowColor).toBe(WANT[x.kind]);
  }
});

test('F3 ★seed 결정성 — 같은 seed = 같은 모양 · 다른 seed = 다른 모양 · [다시 뿌리기] = 모양만 바뀐다', async ({ page }) => {
  await bootApp(page);
  const [a, b, c] = await setup(page, [{ fxKind: 'flare', seed: 12345 }, { fxKind: 'flare', seed: 12345 }, { fxKind: 'flare', seed: 99991 }]);
  const A = await bodyOf(page, a), B = await bodyOf(page, b), C = await bodyOf(page, c);
  expect(A, '★전제: 그림이 있다').toBeTruthy();
  expect(B, '같은 seed 인데 모양이 다르다 — 그림 안에 seed 아닌 난수가 섞였다').toBe(A);
  expect(C, '다른 seed 인데 모양이 같다 — seed 가 그림에 안 닿는다').not.toBe(A);
  // 다시 뿌리기(패널 단추) — seed 가 바뀌고 모양이 바뀐다. 색은 그대로.
  const r = await page.evaluate((a) => {
    const blk = document.getElementById(a);
    window._selectSticker?.(blk);
    const before = { seed: blk.dataset.seed, color: blk.dataset.glowColor, body: blk.querySelector('.sticker-glow-body').innerHTML };
    document.getElementById('stk-glow-reroll').click();
    return { before, after: { seed: blk.dataset.seed, color: blk.dataset.glowColor, body: blk.querySelector('.sticker-glow-body').innerHTML } };
  }, a);
  expect(r.after.seed).not.toBe(r.before.seed);
  expect(r.after.body).not.toBe(r.before.body);
  expect(r.after.color).toBe(r.before.color);
});

test('F4 다시 그려도 같은 모습 — 리로드·undo 와 같은 길(renderStickerBlock 재호출)', async ({ page }) => {
  await bootApp(page);
  const [id] = await setup(page, [{ fxKind: 'star', rays: 6, chroma: '1' }]);
  const r = await page.evaluate((id) => {
    const b = document.getElementById(id);
    const first = b.innerHTML;
    b.innerHTML = '';                       // 저장본엔 dataset 만 산다고 치고
    window.renderStickerBlock(b);
    return { same: b.innerHTML === first, len: first.length };
  }, id);
  expect(r.len).toBeGreaterThan(200);
  expect(r.same, '다시 그렸더니 모습이 바뀌었다 — 리로드·썸네일·undo 마다 다른 그림이 된다').toBe(true);
});

test('F5 패널 — glow 절만 보이고(Shape·기본 절 숨김) · 세기·종류가 dataset 과 그림에 닿는다', async ({ page }) => {
  await bootApp(page);
  const [id] = await setup(page, [{ fxKind: 'star' }]);
  const r = await page.evaluate((id) => {
    const b = document.getElementById(id);
    window._selectSticker?.(b);
    const vis = (el) => !!el && getComputedStyle(el).display !== 'none';
    const shapeSec = [...document.querySelectorAll('.prop-section')].find(s => s.querySelector('.prop-section-title')?.textContent.trim() === 'Shape');
    const out = { glowSec: vis(document.getElementById('stk-glow-section')), shapeSec: vis(shapeSec), imageSec: vis(document.getElementById('stk-image-section')) };
    const sd = () => b.querySelector('feGaussianBlur').getAttribute('stdDeviation');
    const sd0 = sd();
    const s = document.getElementById('stk-glow-int'); s.value = '20'; s.dispatchEvent(new Event('input', { bubbles: true }));
    out.int = b.dataset.intensity; out.sdChanged = sd() !== sd0;
    document.querySelector('#stk-glow-kind [data-fx-kind="flare"]').click();
    out.kind = b.dataset.fxKind; out.color = b.dataset.glowColor;
    return out;
  }, id);
  expect(r.glowSec, 'glow 절이 안 보인다').toBe(true);
  expect(r.shapeSec, 'Shape 고르기가 보인다(glow 는 자기 프리셋을 쓴다)').toBe(false);
  expect(r.imageSec).toBe(false);
  expect(r.int).toBe('20');
  expect(r.sdChanged, '세기를 바꿨는데 후광 반경이 그대로다').toBe(true);
  expect(r.kind).toBe('flare');
  expect(r.color, '종류를 바꾸면 그 프리셋 색을 깐다').toBe('#ff9a3c');
});

test('F6 마지막 스타일 기억 — 다음 Glow 는 색을 잇고 seed 는 새로 · 일반 「Sticker」 버튼은 글로우를 안 낳는다', async ({ page }) => {
  await bootApp(page);
  const [id] = await setup(page, [{ fxKind: 'dot' }]);
  const r = await page.evaluate((id) => {
    const b = document.getElementById(id);
    b.dataset.glowColor = '#00ff88';
    window.rememberStickerStyle(b);
    window._selectSticker?.(b);
    window.addStickerBlock({ shape: 'glow' });
    const all = [...document.querySelectorAll('#secG .sticker-block')];
    const nb = all[all.length - 1];
    window._selectSticker?.(nb);
    window.addStickerBlock();                         // 펜 메뉴 「Sticker」(shape 미지정)
    const all2 = [...document.querySelectorAll('#secG .sticker-block')];
    return { n: all.length, newColor: nb.dataset.glowColor, newKind: nb.dataset.fxKind, seedNew: nb.dataset.seed !== b.dataset.seed,
             plainShape: all2[all2.length - 1].dataset.shape };
  }, id);
  expect(r.n, '★전제: 글로우가 하나 더 생겼다').toBe(2);
  expect(r.newColor, '마지막 후광색을 안 이었다(기억 명부에 glow 가 없다)').toBe('#00ff88');
  expect(r.newKind).toBe('dot');
  expect(r.seedNew, '새로 찍었는데 seed 가 같다 — 「찍을 때마다 다른 모습」이 깨진다').toBe(true);
  expect(r.plainShape, '일반 Sticker 버튼이 글로우를 낳았다(__last 오염)').not.toBe('glow');
});

/* 내보내기 두 경로 — 섹션을 클론해 앱과 같은 꼴(fixed · -99999)로 두고 찍는다. 대조 스티커는 «클론에서만» 필터를 뗀다. */
async function captureBoth(page) {
  await setup(page, [{ fxKind: 'dot', x: 150, y: 120, intensity: 90 }, { fxKind: 'dot', x: 450, y: 120, intensity: 90 }]);
  const info = await page.evaluate(() => {
    const sec = document.getElementById('secG');
    const [on, off] = [...sec.querySelectorAll('.sticker-block')];
    const clone = sec.cloneNode(true);
    clone.id = 'secG-clone';
    clone.querySelector('#' + off.id + ' .sticker-glow-body').removeAttribute('filter');   // 대조: 필터만 뗀다
    clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;margin:0;outline:none;';   // export-image.js:249 와 같은 꼴
    document.body.appendChild(clone);
    const r = clone.getBoundingClientRect();
    const c = (b) => ({ x: (parseFloat(b.style.left) || 0) + b.offsetWidth / 2, y: (parseFloat(b.style.top) || 0) + b.offsetHeight / 2, w: b.offsetWidth });
    return { rect: { x: r.left, y: r.top, w: Math.round(r.width), h: Math.round(r.height) }, on: c(on), off: c(off) };
  });
  const cdp = await page.context().newCDPSession(page);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
    clip: { x: info.rect.x, y: info.rect.y, width: info.rect.w, height: info.rect.h, scale: 1 } });
  const h2c = await page.evaluate(async () => {
    const clone = document.getElementById('secG-clone');
    const cv = await html2canvas(clone, { scale: 1, useCORS: true, backgroundColor: '#101018', logging: false });   // captureThumbnail 과 같은 옵션
    return cv.toDataURL('image/png').split(',')[1];
  });
  const read = (b64) => page.evaluate(async ({ b64, info }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const k = img.width / info.rect.w;
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const x = cv.getContext('2d'); x.drawImage(img, 0, 0);
    const lum = (px, py) => { const d = x.getImageData(Math.round(px * k), Math.round(py * k), 1, 1).data; return Math.round(0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]); };
    /* 후광 자리 = 심(dot 반지름 = 상자의 9%) 바로 바깥, 중심에서 상자 폭의 15%. 심 = 중심.
       ★자리를 고른 근거(2026-10-06 실측 · 두 경로 같은 값): 중심에서 12/15/18/22/30% → 후광 90/61/46/36/23 · 대조 전부 17(배경).
         처음엔 22% 에 문턱 20 을 걸어 36−17=19~20 으로 «겨우» 갈렸다(시험 설계의 흠) → 차가 큰 15%(61−17=44)로 옮기고 문턱은 그 절반 밑(20). */
    const halo = (c) => lum(c.x + c.w * 0.15, c.y), core = (c) => lum(c.x, c.y);
    return { onHalo: halo(info.on), offHalo: halo(info.off), onCore: core(info.on), offCore: core(info.off), bg: lum(5, 5) };
  }, { b64, info });
  return { cdp: await read(shot.data), h2c: await read(h2c) };
}

for (const path of ['cdp', 'h2c']) {
  test(`F${path === 'cdp' ? 7 : 8} ★내보내기(${path === 'cdp' ? 'PNG · CDP 오프스크린' : '썸네일 · html2canvas'})에 후광이 산다 — 대조(필터 뗀 같은 스티커)는 배경`, async ({ page }) => {
    await bootApp(page);
    const all = await captureBoth(page);
    const m = all[path];
    expect(m.onCore, '★전제: 심이 찍혔다(흰 점)').toBeGreaterThan(200);
    expect(m.offCore, '★전제: 대조 스티커의 심도 찍혔다').toBeGreaterThan(200);
    expect(Math.abs(m.offHalo - m.bg), `★대조: 필터 뗀 쪽 후광 자리는 배경이어야 한다 (off ${m.offHalo} · bg ${m.bg})`).toBeLessThan(8);
    expect(m.onHalo - m.offHalo, `후광이 내보내기에서 사라졌다 (on ${m.onHalo} · off ${m.offHalo}) — 모자이크와 같은 함정`).toBeGreaterThan(20);
  });
}

/* ── ⑼ 불투명도(fxOpacity) · 중첩 불투명도 — 지디 2026-10-06 ─────────────────────────────────────────
 * 글로우 «층 통째» 불투명도는 바깥 <g opacity> 하나다. 그 안에 색수차 층(0.55)·고스트(fill-opacity)가 «중첩»된다.
 * html2canvas 가 중첩 알파를 한 번만/두 번 먹으면 화면(=CDP)과 썸네일이 갈린다(모자이크 꼴) ⇒ 두 경로를 같은 자로 잰다. */
async function shotBoth(page, buildFn, arg) {
  const info = await page.evaluate(buildFn, arg);
  const cdp = await page.context().newCDPSession(page);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
    clip: { x: info.rect.x, y: info.rect.y, width: info.rect.w, height: info.rect.h, scale: 1 } });
  const h2c = await page.evaluate(async (bg) => {
    const cv = await html2canvas(document.getElementById('cap-root'), { scale: 1, useCORS: true, backgroundColor: bg, logging: false });
    return cv.toDataURL('image/png').split(',')[1];
  }, info.bg);
  const read = (b64) => page.evaluate(async ({ b64, pts, w }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const k = img.width / w; const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const x = cv.getContext('2d'); x.drawImage(img, 0, 0);
    return pts.map(([px, py]) => { const d = x.getImageData(Math.round(px * k), Math.round(py * k), 1, 1).data; return Math.round(0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]); });
  }, { b64, pts: info.pts, w: info.rect.w });
  return { cdp: await read(shot.data), h2c: await read(h2c) };
}

test('F11 ⑼ fxOpacity — 글로우 층 불투명도가 두 내보내기 경로에서 «같은 값»으로 먹는다', async ({ page }) => {
  await bootApp(page);
  await setup(page, [{ fxKind: 'dot', x: 150, y: 120, fxOpacity: 100 }, { fxKind: 'dot', x: 450, y: 120, fxOpacity: 40 }]);
  const m = await shotBoth(page, () => {
    const sec = document.getElementById('secG');
    const [a, b] = [...sec.querySelectorAll('.sticker-block')];
    const c = (el) => [(parseFloat(el.style.left) || 0) + el.offsetWidth / 2, (parseFloat(el.style.top) || 0) + el.offsetHeight / 2];
    const clone = sec.cloneNode(true); clone.id = 'cap-root';
    clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;margin:0;outline:none;';
    document.body.appendChild(clone);
    const r = clone.getBoundingClientRect();
    return { rect: { x: r.left, y: r.top, w: Math.round(r.width), h: Math.round(r.height) }, bg: '#101018', pts: [c(a), c(b), [5, 5]],
             opAttr: [a, b].map(el => el.querySelector('.sticker-glow-layer')?.getAttribute('opacity')) };
  });
  const [fullC, partC, bgC] = m.cdp, [fullH, partH, bgH] = m.h2c;
  expect(fullC, '★전제: 100% 심이 하얗다(CDP)').toBeGreaterThan(220);
  // 기대: 40% 심 ≈ 0.4·흰 + 0.6·바탕(17) ≈ 112 — 정확한 합성식이 아니라 «둘 사이·두 경로 같음»을 잰다
  expect(partC, `40% 심이 100% 와 바탕 사이가 아니다(CDP ${partC})`).toBeGreaterThan(bgC + 40);
  expect(partC).toBeLessThan(fullC - 40);
  expect(Math.abs(partH - partC), `★두 경로가 갈린다 — CDP ${partC} · html2canvas ${partH}`).toBeLessThan(10);
  expect(Math.abs(fullH - fullC)).toBeLessThan(10);
});

test('F12 ★중첩 불투명도 0.8 안의 0.8 — 두 경로 다 0.64 로 합성한다(대조: 1.0 안의 1.0 · 0.8 하나)', async ({ page }) => {
  await bootApp(page);
  const m = await shotBoth(page, () => {
    // 글로우가 쓰는 꼴 그대로: SVG 안의 <g opacity> 중첩. 검은 바탕 위 흰 사각.
    const cell = (o1, o2) => `<svg width="80" height="80" style="display:block;flex:none"><g opacity="${o1}"><g opacity="${o2}"><rect x="10" y="10" width="60" height="60" fill="#ffffff"/></g></g></svg>`;
    const root = document.createElement('div');
    root.id = 'cap-root';
    root.style.cssText = 'position:fixed;top:-99999px;left:0;width:240px;height:80px;background:#000000;display:flex;margin:0;';
    root.innerHTML = cell(1, 1) + cell(0.8, 1) + cell(0.8, 0.8);
    document.body.appendChild(root);
    const r = root.getBoundingClientRect();
    return { rect: { x: r.left, y: r.top, w: Math.round(r.width), h: Math.round(r.height) }, bg: '#000000', pts: [[40, 40], [120, 40], [200, 40], [3, 3]] };
  });
  for (const path of ['cdp', 'h2c']) {
    const [one, single, nested, bg] = m[path];
    expect(bg, `★전제(${path}): 바탕 검정`).toBeLessThan(5);
    expect(one, `★대조(${path}): 1.0 안의 1.0 = 흰색`).toBeGreaterThan(250);
    expect(Math.abs(single - 204), `★대조(${path}): 0.8 하나 = 204 근처(받음 ${single})`).toBeLessThan(6);
    expect(Math.abs(nested - 163), `${path}: 0.8 안의 0.8 이 0.64(≈163)가 아니다 — 받음 ${nested} (204 근처면 한 번만 먹음 · 130 근처면 세 번)`).toBeLessThan(6);
  }
  expect(Math.abs(m.cdp[2] - m.h2c[2]), `두 경로의 중첩 합성값이 갈린다 — CDP ${m.cdp[2]} · html2canvas ${m.h2c[2]}`).toBeLessThan(4);
});

test('F9 즐겨찾기 — glow 는 이번 판 즐겨찾기 밖: 조용히 실패하지 않고 «말하고» 거절한다', async ({ page }) => {
  await bootApp(page);
  const [id] = await setup(page, [{ fxKind: 'star' }]);
  const r = await page.evaluate((id) => {
    const ok = window.addStickerFavorite(document.getElementById(id));
    return { ok, toast: document.getElementById('editor-toast')?.textContent || null };
  }, id);
  expect(r.ok).toBe(false);
  expect(r.toast).toBe('⚠️ 이 모양은 즐겨찾기에 추가할 수 없습니다');
});

test('F10 사람 손 복제(클릭 → ⌘D) — 복제본이 새 id 로 다시 그려져 필터 id 가 안 겹친다', async ({ page }) => {
  await bootApp(page);
  const [id] = await setup(page, [{ fxKind: 'star', x: 300, y: 100 }]);
  /* ★좌표는 «멈춘 뒤» 잰다 — bootApp 뒤 배율 맞추기가 늦게 끝나 먼저 재면 빗나간다(하네스 waitStableRect 머리말).
     실측: 바로 재던 판은 workers 4·load 23 에서 3회 중 2회 「클릭으로 그 스티커가 골라졌다」 전제가 빨강(2026-10-06). */
  const st = await waitStableRect(page, '#' + id);
  await page.mouse.click(st.cx, st.cy);
  const sel = await page.evaluate(() => [...document.querySelectorAll('.sticker-block.selected')].map(b => b.id));
  await page.keyboard.press('Meta+d');
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const st = [...document.querySelectorAll('#secG .sticker-block')];
    const fids = [...document.querySelectorAll('filter')].map(f => f.id).filter(x => x.startsWith('fxg-'));
    return { n: st.length, fids, dup: fids.filter((x, i) => fids.indexOf(x) !== i), own: st.every(b => b.querySelector('filter')?.id === 'fxg-' + b.id) };
  });
  expect(sel, '★전제: 클릭으로 그 스티커가 골라졌다').toEqual([id]);
  expect(r.n, '★전제: 복제돼 둘이 됐다').toBe(2);
  expect(r.dup, `필터 id 가 겹친다: ${r.fids.join(',')}`).toEqual([]);
  expect(r.own, '스티커마다 제 id 의 필터를 갖는다').toBe(true);
});
