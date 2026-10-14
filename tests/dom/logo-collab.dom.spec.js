/* logo-collab.dom.spec.js — 1013t2A2 로고 블럭 «콜라보» [로고1 × 로고2 (× 로고3)]
 * 현빈 원문: 「logo 블럭 : 우측패널에 옵션을 하나 추가시켜줘. 콜라보 옵션인데 로고갯수를 별모양 블럭처럼 추가할 수 있게해주고,
 *            지금은 로고 하나만 들어가는 에셋블럭이 있는데, 로고1과 2 사이에 ‘x’를 넣어서 [ 로고1 X 로고2 ] 구조로 보이게 해주는거야.
 *            로고 갯수를 3개까지 늘릴 수 있어.」
 * 결정 기본(decisions ②): 로고 칸 기본 맞춤 = «원래 비율»(contain) · 메뉴 Logo 로 «새로 만들 때만» data-preset="logo".
 *
 * 양성대조 판 = bebd1b55(고치기 전) — 기대: LC1~LC9 전부 빨강(콜라보 절·함수 자체가 없다). ★아직 안 돌렸다.
 * 고정 대기 0건 — 조건 대기(waitForFunction · expect.poll)만 쓴다. 매 칸 전제를 먼저 단언한다.
 */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { bootApp, ROOT } = require('./_root-harness.js');

const SEC = `<div class="section-block" id="sA" data-section="1" data-name="A" data-bg="#ffffff" style="background:#fff;">
  <div class="section-hitzone"><span class="section-label">A</span></div><div class="section-inner"></div></div>`;
const svgUri = (fill) => 'data:image/svg+xml;base64,' + Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="64"><rect width="200" height="64" fill="${fill}"/></svg>`).toString('base64');
const RED = svgUri('#ff0000'), BLUE = svgUri('#0000ff'), GREEN = svgUri('#00ff00');

async function setup(page, preset = 'logo') {
  await page.setViewportSize({ width: 1500, height: 950 });
  const errs = await bootApp(page);
  await page.evaluate(([html, preset]) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.();
    window.selectSection?.(document.getElementById('sA'));
    window.addAssetBlock?.(preset);
  }, [SEC, preset]);
  await page.waitForFunction(() => !!document.querySelector('#canvas .asset-block'));
  await page.evaluate(() => window.showAssetProperties?.(document.querySelector('#canvas .asset-block')));
  await page.waitForFunction(() => !!document.getElementById('asset-h-slider'));
  return errs;
}
const pre = (page) => page.evaluate(() => {
  const ab = document.querySelector('#canvas .asset-block');
  return { n: document.querySelectorAll('#canvas .asset-block').length, w: ab.style.width, h: ab.style.height,
    preset: ab.dataset.preset ?? null, isLogo: window.isLogoBlock?.(ab) ?? null };
});
async function assertLogoPre(page) {
  const p = await pre(page);
  expect(p.n, '전제 — 에셋 블록 1개').toBe(1);
  expect([p.w, p.h], '전제 — 메뉴 로고 200×64').toEqual(['200px', '64px']);
  expect(p.preset, '전제 — 메뉴로 새로 만든 로고에는 표식(decisions ② 덤)').toBe('logo');
  expect(p.isLogo, '전제 — isLogoBlock').toBe(true);
}
/** slider 에 사람이 끌듯 — input ＋ change */
async function setRange(page, id, v) {
  await page.evaluate(([id, v]) => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`${id} 가 없다`);
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, [id, v]);
}
async function toCount(page, n) {
  await setRange(page, 'asset-collab-count-slider', n);
  await page.waitForFunction((n) => (document.querySelector('#canvas .asset-block').dataset.collab || '1') === String(n), n);
}
const look = (page) => page.evaluate(() => {
  const ab = document.querySelector('#canvas .asset-block');
  const r = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
  const clip = ab.querySelector(':scope > .asset-img-clip');
  const slots = [...ab.querySelectorAll(':scope > .asset-collab > .asset-collab-slot')];
  const xs = [...ab.querySelectorAll(':scope > .asset-collab > .asset-collab-x')];
  return {
    collab: ab.dataset.collab ?? null, w: ab.offsetWidth, styleW: ab.style.width,
    slots: slots.length, xs: xs.length, xText: xs.map((x) => x.textContent),
    slotRects: slots.map(r), xRects: xs.map(r), abRect: r(ab), clipRect: clip ? r(clip) : null,
    slotSrc: slots.map((s) => s.querySelector('.asset-collab-img')?.getAttribute('src') || ''),
    attrs: [...ab.attributes].map((a) => a.name).filter((n) => n.startsWith('data-collab')),
    blocks: document.querySelectorAll('#canvas .asset-block').length,
  };
});

test('LC1 패널 — 메뉴 로고에 「Collab」 절(콜라보·갯수 1~3) · 표식 없는 옛 로고에도 · 일반 에셋엔 없다', async ({ page }) => {
  const errs = await setup(page);
  await assertLogoPre(page);
  const p1 = await page.evaluate(() => {
    const sec = document.getElementById('asset-collab-section');
    const s = document.getElementById('asset-collab-count-slider');
    return { sec: !!sec, title: sec?.querySelector('.prop-section-title')?.textContent.trim(),
      labels: sec ? [...sec.querySelectorAll('.prop-label')].map((e) => e.textContent.trim()) : [],
      min: s?.min, max: s?.max, val: s?.value, toggle: !!document.getElementById('asset-collab-toggle') };
  });
  expect(p1.sec).toBe(true);
  expect(p1.title).toBe('Collab');
  expect(p1.labels, '꺼짐이면 간격·X 줄 없음').toEqual(['콜라보', '갯수']);
  expect([p1.min, p1.max, p1.val]).toEqual(['1', '3', '1']);
  expect(p1.toggle).toBe(true);
  /* 표식 없는 옛 로고(200×64 근사) — inspector 근사와 같은 판정이라 나와야 한다 */
  const old = await page.evaluate(() => {
    const ab = document.querySelector('#canvas .asset-block');
    delete ab.dataset.preset;
    window.showAssetProperties(ab);
    return !!document.getElementById('asset-collab-section');
  });
  expect(old, '표식 없는 200×64 옛 로고에도 Collab 절').toBe(true);
  /* 음성 — 일반 에셋(Standard) */
  const std = await page.evaluate(() => {
    document.querySelector('#canvas .asset-block').closest('.row')?.remove();
    window.selectSection?.(document.getElementById('sA'));
    window.addAssetBlock?.('standard');
    const ab = document.querySelector('#canvas .asset-block');
    window.showAssetProperties(ab);
    return { h: ab.style.height, preset: ab.dataset.preset ?? null, sec: !!document.getElementById('asset-collab-section') };
  });
  expect(std.preset, '전제 — 일반 에셋엔 표식 없음').toBe(null);
  expect(std.sec, '일반 에셋엔 Collab 절이 없다').toBe(false);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('LC2 갯수 2 — [로고1 × 로고2] 한 블록 안 · 폭 464 · 가로 순서', async ({ page }) => {
  const errs = await setup(page);
  await assertLogoPre(page);
  await toCount(page, 2);
  const L = await look(page);
  expect(L.collab).toBe('2');
  expect(L.blocks, '블록을 복제하지 않는다').toBe(1);
  expect(L.slots + 1, '로고 칸 수 = 칸1 + .asset-collab-slot').toBe(2);
  expect(L.xs, '× 수 = n−1').toBe(1);
  expect(L.xText).toEqual(['×']);
  expect(Math.abs(L.w - 464), `폭 (잰 값 ${L.w})`).toBeLessThanOrEqual(1);
  /* 칸1(블록 왼쪽 ~ 칸1 폭) ≤ × < 칸2 — 화면 좌표(배율 무관한 «순서»만) */
  const slot1Right = L.abRect.l + (L.abRect.r - L.abRect.l) * (200 / L.w);
  expect(slot1Right).toBeLessThanOrEqual(L.xRects[0].l + 0.5);
  expect(L.xRects[0].r).toBeLessThanOrEqual(L.slotRects[0].l + 0.5);
  expect(L.slotRects[0].r).toBeLessThanOrEqual(L.abRect.r + 0.5);
  /* 켜지면 간격·X 크기·X 색 줄이 생긴다 */
  const labels = await page.evaluate(() => [...document.querySelectorAll('#asset-collab-section .prop-label')].map((e) => e.textContent.trim()));
  for (const want of ['간격', 'X 크기', 'X 색', '로고 2']) expect(labels).toContain(want);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('LC3 갯수 3 → 2 → 1 — 칸·× 수와 폭 · 1 이면 아무것도 안 남는다', async ({ page }) => {
  const errs = await setup(page);
  await assertLogoPre(page);
  await toCount(page, 3);
  let L = await look(page);
  expect([L.slots, L.xs]).toEqual([2, 2]);
  expect(Math.abs(L.w - 728), `폭 (잰 값 ${L.w})`).toBeLessThanOrEqual(1);
  await toCount(page, 2);
  L = await look(page);
  expect([L.slots, L.xs]).toEqual([1, 1]);
  await toCount(page, 1);
  L = await look(page);
  expect(L.collab).toBe(null);
  expect([L.slots, L.xs]).toEqual([0, 0]);
  expect(L.attrs, 'data-collab* 0').toEqual([]);
  expect(L.styleW).toBe('200px');
  const has = await page.evaluate(() => !!document.querySelector('#canvas .asset-collab'));
  expect(has).toBe(false);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('LC4 꺼짐 = 바이트 동일 — 켜기→끄기 왕복 outerHTML (빈 칸 · 그림 cover 둘 다)', async ({ page }) => {
  const errs = await setup(page);
  await assertLogoPre(page);
  const A = await page.evaluate(() => document.querySelector('#canvas .asset-block').outerHTML);
  await toCount(page, 3);
  const mid = await page.evaluate(() => document.querySelector('#canvas .asset-block').outerHTML);
  expect(mid, '전제 — 켜진 동안은 다르다').not.toBe(A);
  await toCount(page, 1);
  const B = await page.evaluate(() => document.querySelector('#canvas .asset-block').outerHTML);
  expect(B).toBe(A);
  /* 그림이 든 칸1(fit cover) — 켜면 contain(«원래 비율»), 끄면 cover 로 돌아와 바이트 동일 */
  await page.evaluate((src) => window.setAssetImageFromSrc(document.querySelector('#canvas .asset-block'), src), RED);
  await page.waitForFunction(() => document.querySelector('#canvas .asset-block').classList.contains('has-image'));
  const A2 = await page.evaluate(() => document.querySelector('#canvas .asset-block').outerHTML);
  expect(await page.evaluate(() => document.querySelector('#canvas .asset-block').dataset.fit), '전제 — 꺼짐의 기본 맞춤은 옛 cover').toBe('cover');
  await toCount(page, 2);
  const fitOn = await page.evaluate(() => {
    const ab = document.querySelector('#canvas .asset-block');
    return { fit: ab.dataset.fit, obj: ab.querySelector('.asset-img').style.objectFit };
  });
  expect(fitOn, '켜면 로고 칸 기본 맞춤 = 원래 비율').toEqual({ fit: 'contain', obj: 'contain' });
  await toCount(page, 1);
  const B2 = await page.evaluate(() => document.querySelector('#canvas .asset-block').outerHTML);
  expect(B2).toBe(A2);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('LC5 그림 넣기 — 칸1 넣기·교체·지우기에도 ×·로고2 생존 · 칸2 는 칸1 과 따로', async ({ page }) => {
  const errs = await setup(page);
  await assertLogoPre(page);
  await toCount(page, 2);
  const r = await page.evaluate(([RED, BLUE, GREEN]) => {
    const ab = document.querySelector('#canvas .asset-block');
    const out = {};
    window.setAssetImageFromSrc(ab, RED);
    out.afterSlot1 = { collab: !!ab.querySelector(':scope > .asset-collab'), x: ab.querySelectorAll('.asset-collab-x').length, src: ab.dataset.imgSrc === RED, fit: ab.dataset.fit };
    out.set2 = window.setCollabSlotSrc(ab, 2, BLUE);
    out.slot2 = ab.querySelector('.asset-collab-slot[data-slot="2"] .asset-collab-img')?.getAttribute('src') === BLUE;
    out.slot1Kept = ab.dataset.imgSrc === RED;
    window.setAssetImageFromSrc(ab, GREEN);   // 교체
    out.afterReplace = { collab: !!ab.querySelector(':scope > .asset-collab'), slot2: ab.querySelector('.asset-collab-img')?.getAttribute('src') === BLUE, w: ab.offsetWidth };
    window.clearAssetImage(ab);               // 칸1 지우기
    out.afterClear = { collab: !!ab.querySelector(':scope > .asset-collab'), slot2: ab.querySelector('.asset-collab-img')?.getAttribute('src') === BLUE, img1: !!ab.querySelector('.asset-img'), x: ab.querySelectorAll('.asset-collab-x').length };
    return out;
  }, [RED, BLUE, GREEN]);
  expect(r.afterSlot1, '칸1 넣은 뒤에도 콜라보 DOM 생존 · 켜짐의 새 그림 맞춤 = contain').toEqual({ collab: true, x: 1, src: true, fit: 'contain' });
  expect(r.set2).toBe(true);
  expect(r.slot2).toBe(true);
  expect(r.slot1Kept, '칸2 를 넣어도 칸1 그림 불변').toBe(true);
  expect(r.afterReplace.collab && r.afterReplace.slot2).toBe(true);
  expect(Math.abs(r.afterReplace.w - 464)).toBeLessThanOrEqual(1);
  expect(r.afterClear, '칸1 을 지워도 ×·로고2 생존').toEqual({ collab: true, slot2: true, img1: false, x: 1 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('LC6 저장 왕복 — 콜라보·칸2 그림·폭이 그대로 · 패널이 갯수를 다시 읽는다', async ({ page }) => {
  const errs = await setup(page);
  await assertLogoPre(page);
  await toCount(page, 3);
  await page.evaluate((BLUE) => window.setCollabSlotSrc(document.querySelector('#canvas .asset-block'), 2, BLUE), BLUE);
  const before = await look(page);
  const saved = await page.evaluate(() => {
    const sec = document.getElementById('sA');
    const out = window.serializeSectionClone ? window.serializeSectionClone(sec) : sec.outerHTML;
    return typeof out === 'string' ? out : (out && out.outerHTML) || '';
  });
  expect(saved.length, '전제 — 저장본이 비지 않았다').toBeGreaterThan(100);
  expect(saved).toContain('data-collab="3"');
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.();
    window.showAssetProperties(document.querySelector('#canvas .asset-block'));
  }, saved);
  await page.waitForFunction(() => !!document.getElementById('asset-collab-count-num'));
  const after = await look(page);
  expect([after.collab, after.slots, after.xs]).toEqual(['3', 2, 2]);
  expect(after.slotSrc[0]).toBe(BLUE);
  expect(after.w).toBe(before.w);
  expect(await page.evaluate(() => document.getElementById('asset-collab-count-num').value)).toBe('3');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('LC7 되돌리기 — 2 → 3 을 ⌘Z 하면 2', async ({ page }) => {
  const errs = await setup(page);
  await assertLogoPre(page);
  await toCount(page, 2);
  await page.evaluate(() => window.pushHistory?.());
  await toCount(page, 3);
  expect((await look(page)).slots, '전제 — 3 이 됐다').toBe(2);
  await page.evaluate(() => window.undo?.());
  await expect.poll(async () => (await look(page)).collab).toBe('2');
  const L = await look(page);
  expect([L.slots, L.xs]).toEqual([1, 1]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('LC8 Figma export — 켜짐 = 자유 프레임 [image, ×, image] · 좌표 = 모델 · 꺼짐 = 옛 image', async ({ page }) => {
  const errs = await setup(page);
  await assertLogoPre(page);
  const find = (json, id) => {
    let hit = null;
    const walk = (o) => { if (!o || typeof o !== 'object' || hit) return; if (o.id === id) { hit = o; return; } Object.values(o).forEach(walk); };
    walk(json); return hit;
  };
  const id = await page.evaluate(() => document.querySelector('#canvas .asset-block').id);
  /* buildFigmaExportJSON 은 state.pages(저장된 캔버스)를 읽는다 — 라이브 DOM 을 먼저 흘려 넣는다(asset-redact R10 · effects-reflection R10 과 같은 꼴) */
  const off = await page.evaluate(() => { window.flushCurrentPage?.(); return window.buildFigmaExportJSON(null); });
  expect(off.sections.length, "전제 — 흘려 넣은 섹션이 JSON 에 실렸다").toBe(1);
  const offBlk = find(off, id);
  expect(offBlk?.type, '꺼짐 = 옛 type:image').toBe('image');
  expect(find(off, id + '__collab'), '꺼짐엔 콜라보 프레임 없음').toBe(null);
  await toCount(page, 2);
  await page.evaluate((BLUE) => window.setCollabSlotSrc(document.querySelector('#canvas .asset-block'), 2, BLUE), BLUE);
  const on = await page.evaluate(() => { window.flushCurrentPage?.(); return window.buildFigmaExportJSON(null); });
  const fr = find(on, id + '__collab');
  expect(fr?.type).toBe('frame');
  expect(fr.free).toBe(true);
  expect([fr.width, fr.height]).toEqual([464, 64]);
  expect(fr.children.map((c) => c.block.type)).toEqual(['image', 'text', 'image']);
  expect(fr.children[1].block.content).toBe('×');
  expect(fr.children.map((c) => c.x)).toEqual([0, 216, 264]);
  expect(fr.children[2].block.src).toBe(BLUE);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('LC9 단독 HTML — 손글씨 폴백 img 규칙이 콜라보 칸 img 를 안 덮는다 · 앱 CSS 수확에 콜라보 규칙이 실린다', async ({ page }) => {
  const errs = await setup(page);
  await assertLogoPre(page);
  await toCount(page, 2);
  await page.evaluate(([RED, BLUE]) => {
    const ab = document.querySelector('#canvas .asset-block');
    window.setAssetImageFromSrc(ab, RED);
    window.setCollabSlotSrc(ab, 2, BLUE);
  }, [RED, BLUE]);
  const src = fs.readFileSync(path.join(ROOT, 'js/io/export-html.js'), 'utf8');
  const m = /\n(\.asset-block\.has-image img[^{\n]*)\{display:block;max-width:100%;height:auto;\}/.exec(src);
  expect(m, '전제 — 손글씨 폴백 규칙을 찾았다').not.toBe(null);
  const r = await page.evaluate(async (sel) => {
    const ab = document.querySelector('#canvas .asset-block');
    const img = ab.querySelector('.asset-collab-img');
    const { collectCanvasCss } = await import('/js/io/export-css-collect.js');
    const css = collectCanvasCss(document.getElementById('canvas'));
    return { has: !!img, hasImage: ab.classList.contains('has-image'), matches: img ? img.matches(sel) : null,
      harvested: /\.asset-collab-slot/.test(css) && /\.asset-collab-img/.test(css) };
  }, m[1]);
  expect([r.has, r.hasImage], '전제 — 칸1 그림 있음 · 칸2 img 있음').toEqual([true, true]);
  expect(r.matches, '폴백 셀렉터가 콜라보 칸 img 에 걸린다').toBe(false);
  expect(r.harvested, '앱 CSS 수확에 콜라보 규칙이 없다').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* 1013t2A2 태양 지적 — 영상 경로(setAssetVideoFromSrc)의 콜라보 복원 줄을 꺼도 LC1~9 는 초록이었다(지키는 칸 0).
   칸1 을 «영상»으로 넣어도 ×·로고2 가 살고, 저장 왕복 뒤에도 영상 src·콜라보가 그대로인가. */
const VID = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDE=';
/* ★LC10 장면 바로잡음(S2 재서, 판 5df53807): «저장 왕복 뒤 영상 src 유지»는 제품 결정과 반대다 —
 *   «GIF로 적용» 전 영상(video-pending)은 T-012 로 저장 대상이 아니다(js/io/section-serialize.js · save-load.js goHome 경고).
 *   재서: 가짜 mp4 · ffmpeg 로 만든 진짜 mp4 둘 다 저장본에 영상 src 0 — «영상 로드 실패» 경로가 아니라 T-012 세척이다.
 *   ⇒ 영상 src 는 «안 실린다»를 단언하고(더 엄격), 콜라보(×·로고2)는 «실린다»를 단언한다 — 빠졌던 것은 그쪽(제품 결함). */
test('LC10 영상 칸1 — 콜라보 켠 채 칸1 을 영상으로 넣어도 ×·로고2 생존 · 저장 왕복 뒤 영상은 T-012 대로 빠지고 ×·로고2 는 산다', async ({ page }) => {
  const errs = await setup(page);
  await assertLogoPre(page);
  await toCount(page, 2);
  const r = await page.evaluate(([BLUE, VID]) => {
    const ab = document.querySelector('#canvas .asset-block');
    const set2 = window.setCollabSlotSrc(ab, 2, BLUE);
    window.setAssetVideoFromSrc(ab, VID);
    const v = ab.querySelector('.asset-img-clip video.asset-video');
    return {
      set2, hasFn: typeof window.setAssetVideoFromSrc === 'function',
      video: !!v && v.getAttribute('src') === VID,
      collab: !!ab.querySelector(':scope > .asset-collab'),
      x: ab.querySelectorAll('.asset-collab-x').length,
      slot2: ab.querySelector('.asset-collab-slot[data-slot="2"] .asset-collab-img')?.getAttribute('src') === BLUE,
    };
  }, [BLUE, VID]);
  expect(r.hasFn, '전제 — 영상 넣기 문이 있다').toBe(true);
  expect(r.set2, '전제 — 로고2 가 들어갔다').toBe(true);
  expect(r.video, '전제 — 칸1 이 영상이 됐다').toBe(true);
  expect({ collab: r.collab, x: r.x, slot2: r.slot2 }, '영상 넣은 뒤 ×·로고2 생존').toEqual({ collab: true, x: 1, slot2: true });
  const saved = await page.evaluate(() => {
    const sec = document.getElementById('sA');
    const out = window.serializeSectionClone ? window.serializeSectionClone(sec) : sec.outerHTML;
    return typeof out === 'string' ? out : (out && out.outerHTML) || '';
  });
  expect(saved, '전제 — 저장본에 콜라보').toContain('data-collab="2"');
  expect(saved.includes(VID), 'T-012 — 확정 전 영상 src 는 저장본에 안 실린다').toBe(false);
  expect(saved.includes(BLUE), '저장본에 로고2 그림').toBe(true);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.();
  }, saved);
  await page.waitForFunction(() => !!document.querySelector('#canvas .asset-block'));
  const a = await page.evaluate(([BLUE, VID]) => {
    const ab = document.querySelector('#canvas .asset-block');
    return {
      imgSrc: ab.dataset.imgSrc ?? null, assetType: ab.dataset.assetType ?? null,
      collab: ab.dataset.collab,
      x: ab.querySelectorAll('.asset-collab-x').length,
      slot2: ab.querySelector('.asset-collab-slot[data-slot="2"] .asset-collab-img')?.getAttribute('src') === BLUE,
    };
  }, [BLUE, VID]);
  expect(a, '저장 왕복 뒤 칸1 은 빈 업로드대기(T-012) · 콜라보 · 로고2').toEqual({ imgSrc: null, assetType: null, collab: '2', x: 1, slot2: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('LC10b 영상 칸1 ⌘Z — video-pending 을 되살리는 길(reattachVideoPendingBlocks)에서도 ×·로고2 생존', async ({ page }) => {
  const errs = await setup(page);
  await assertLogoPre(page);
  await toCount(page, 2);
  const r = await page.evaluate(([BLUE, VID]) => {
    const ab = document.querySelector('#canvas .asset-block');
    window.setCollabSlotSrc(ab, 2, BLUE);
    window.setAssetVideoFromSrc(ab, VID);
    window.pushHistory?.('영상');
    return { type: ab.dataset.assetType, x: ab.querySelectorAll('.asset-collab-x').length };
  }, [BLUE, VID]);
  expect(r, '전제 — 영상(video-pending) · × 1').toEqual({ type: 'video-pending', x: 1 });
  await page.evaluate(() => { document.querySelector('#canvas .asset-block').dataset.lc10bMark = '1'; window.pushHistory?.('표식'); });
  await page.evaluate(() => window.undo?.());
  await page.waitForFunction(() => { const ab = document.querySelector('#canvas .asset-block'); return !!ab && !ab.dataset.lc10bMark; });
  const a = await page.evaluate(([BLUE, VID]) => {
    const ab = document.querySelector('#canvas .asset-block');
    return {
      imgSrc: ab.dataset.imgSrc === VID, type: ab.dataset.assetType ?? null, video: ab.querySelectorAll('video.asset-video').length,
      collab: ab.dataset.collab, x: ab.querySelectorAll('.asset-collab-x').length,
      slot2: ab.querySelector('.asset-collab-slot[data-slot="2"] .asset-collab-img')?.getAttribute('src') === BLUE,
    };
  }, [BLUE, VID]);
  expect(a, '⌘Z 뒤 영상 되살아남(T-031) · 콜라보 · 로고2').toEqual({ imgSrc: true, type: 'video-pending', video: 1, collab: '2', x: 1, slot2: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});
