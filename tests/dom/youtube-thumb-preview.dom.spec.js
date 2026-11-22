/* youtube-thumb-preview.dom.spec.js — t13C-03 ③ 유튜브 썸네일 미리보기(보기 전용 모달 · 현빈 GO 261122 · 태양)
 *   입구 = 섹션 패널 Export 절 #sec-yt-preview-btn(썸네일 섹션 + 관리자 노출) → js/yt-thumb-preview.js openYtThumbPreview
 *   P1 ★단추 → 모달 · 카드 셋(홈·옆 추천·모바일) · 각 그림 1280×720 · 썸네일 칸 16:9(±1px) · 재생시간 딱지 = 칸 오른쪽 아래 안
 *      · 제목 입력 → 카드 셋 제목 · 밝은/어두운 바탕 · Esc 로 닫힘 · 닫은 뒤 섹션 outerHTML 무변 · dirty 아님 · 저장 키 0
 *      · PNG(SHOT_YT=폴더) dark.png · light.png · mobile.png
 *   P2 [지킴] 문지기 — 관리자 아님 → 단추 없음 · 보통 섹션(썸네일 아님) → 단추 없음
 *   P3 ★양성대조(그림이 정말 그 섹션에서 온다) — 섹션 바탕색을 바꾸고 다시 열면 그림 src 가 달라진다
 *   ★양성대조 패치: _patches/yt-preview-CTL.patch(Export 절 단추 줄을 걷음) ⇒ P1·P3 빨강.
 *   치수는 offset*(레이아웃 px · 배율 무관 — dom-screen-px-census 교훈).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 실앱 PNG = main.js 'capture-section-cdp' 흉내(youtube-thumb-export-size 와 같은 손) */
async function installCdpCapture(page) {
  const cdp = await page.context().newCDPSession(page);
  await page.exposeFunction('__cdpShot', async ({ x = 0, y = 0, width, height, scale = 1 }) => {
    const s = Number(scale); const clipScale = (s > 0 && s <= 4) ? s : 1;
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: Math.round(x), y: Math.round(y), width: Math.ceil(width), height: Math.ceil(height), scale: clipScale }, captureBeyondViewport: true, fromSurface: true });
    return r.data;
  });
  await page.evaluate(() => {
    const old = window.electronAPI;
    window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'captureSectionCdp' ? async (o) => window.__cdpShot(o) : old[k]) });
  });
}

async function scene(page, { admin = true } = {}) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  await installCdpCapture(page);
  await page.evaluate((admin) => {
    window.__admin = { ...(window.__admin || {}), state: () => ({ isAdmin: admin }) };
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = window.addYoutubeThumbSection();
    sec.id = 'ytS'; sec.style.backgroundColor = '#204080';
    sec.querySelector('.section-inner').insertAdjacentHTML('beforeend', '<div class="row"><div style="width:300px;height:120px;background:#ffcc00"></div></div>');
    window.showSectionProperties(sec);
    window.clearHistory?.();
    window.markSaved?.();
  }, admin);
  /* 섹션 바닥 손잡이·높이 그리기가 rAF 로 늦게 붙는다 — outerHTML 이 100ms 간격 두 번 연속 같을 때까지(안 기다리면 «무변» 비교가 장면 탓에 흔들린다 · 첫 판 실측) */
  await page.waitForFunction(() => { const h = document.getElementById('ytS').outerHTML, same = h === window.__ytH0; window.__ytH0 = h; return same && !!document.querySelector('#ytS .section-bottom-handle'); }, null, { polling: 100, timeout: 5000 });
  return errs;
}
const openPreview = async (page) => {
  /* ★0914 dev 위(0913-d Q33 «섹션 Export = 처음엔 머리만 · ＋ 로 펼침»): 접혀 있으면 머리 ＋(#sec-export-toggle)로 펼친 뒤(사용자 길 · fill-std D27 과 같은 손) */
  await page.evaluate(() => { const f = document.getElementById('sec-export-form'); if (f && f.hidden) document.getElementById('sec-export-toggle')?.click(); });
  await page.click('#sec-yt-preview-btn');
  await page.waitForFunction(() => { const ims = [...document.querySelectorAll('#yt-preview-overlay .ytp-img')]; return ims.length === 3 && ims.every((i) => i.complete && i.naturalWidth > 0); }, null, { timeout: 20000 });
};
/* 섹션 outerHTML — style 속성은 cssText 로 정규화(앱이 미리보기와 무관하게 나중에 인라인 style 글을 다시 쓴다:
   'Pretendard', sans-serif → Pretendard, sans-serif; · 미리보기 없이 스크린샷만 찍어도 같은 차이 = 대조 실측) */
const secHtml = () => { const t = document.createElement('template'); t.innerHTML = document.getElementById('ytS').outerHTML;
  t.content.querySelectorAll('[style]').forEach((e) => e.setAttribute('style', e.style.cssText)); return t.innerHTML; };
const srcOf = (page) => page.evaluate(() => document.querySelector('#yt-preview-overlay .ytp-img')?.getAttribute('src') || null);

test('P1 단추 → 카드 셋 · 1280×720 · 16:9 · 딱지 · 제목 · 바탕 · 닫으면 흔적 0', async ({ page }) => {
  const errs = await scene(page);
  const before = await page.evaluate((f) => ({ html: eval(f)(), dirty: !!window.hasUnsavedChanges?.(), ls: Object.keys(localStorage).sort() }), secHtml.toString());
  expect(await page.locator('#sec-yt-preview-btn').count(), '★썸네일 섹션 Export 절에 미리보기 단추').toBe(1);
  await openPreview(page);
  const r = await page.evaluate(() => [...document.querySelectorAll('#yt-preview-overlay .ytp-card')].map((c) => {
    const th = c.querySelector('.ytp-thumb'), im = c.querySelector('.ytp-img'), d = c.querySelector('.ytp-dur');
    return { key: c.dataset.card, nat: [im.naturalWidth, im.naturalHeight], w: th.offsetWidth, h: th.offsetHeight,
      durIn: d.offsetLeft > th.offsetWidth / 2 && d.offsetTop > th.offsetHeight / 2 && d.offsetLeft + d.offsetWidth <= th.offsetWidth && d.offsetTop + d.offsetHeight <= th.offsetHeight,
      durText: d.textContent };
  }));
  console.log('[P1 실측]', JSON.stringify(r));
  expect(r.map((c) => c.key), '★카드 셋').toEqual(['home', 'side', 'mobile']);
  for (const c of r) {
    expect(c.nat, `★${c.key} 그림 = 1280×720(썸네일 잠금 길)`).toEqual([1280, 720]);
    expect(Math.abs(c.h - c.w * 9 / 16) <= 1, `★${c.key} 16:9 ±1 — ${c.w}×${c.h}`).toBe(true);
    expect(c.durIn && /\d+:\d\d/.test(c.durText), `★${c.key} 재생시간 딱지 = 오른쪽 아래 안`).toBe(true);
  }
  await page.fill('#ytp-title-in', '제목 시험 — 작게 보면 어떤가');
  expect(await page.evaluate(() => [...document.querySelectorAll('#yt-preview-overlay .ytp-title')].map((t) => t.textContent)), '★제목 = 카드 셋').toEqual(Array(3).fill('제목 시험 — 작게 보면 어떤가'));
  const shot = process.env.SHOT_YT;
  if (shot) await page.locator('#yt-preview-overlay .ytp-shell').screenshot({ path: `${shot}/dark.png` });
  await page.click('[data-ytp-theme="light"]');
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('#yt-preview-overlay .ytp-stage')).backgroundColor);
  expect(bg, '★밝은 바탕').toBe('rgb(255, 255, 255)');
  if (shot) { await page.locator('#yt-preview-overlay .ytp-shell').screenshot({ path: `${shot}/light.png` }); await page.locator('#yt-preview-overlay .ytp-card-mobile').screenshot({ path: `${shot}/mobile.png` }); }
  await page.keyboard.press('Escape');
  const after = await page.evaluate((f) => ({ ov: !!document.getElementById('yt-preview-overlay'), html: eval(f)(), dirty: !!window.hasUnsavedChanges?.(), ls: Object.keys(localStorage).sort() }), secHtml.toString());
  expect(after.ov, '★Esc 로 닫힘').toBe(false);
  expect({ html: after.html === before.html, dirty: after.dirty, ls: after.ls }, '★섹션 무변 · dirty 아님 · 저장 키 0').toEqual({ html: true, dirty: before.dirty, ls: before.ls });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P2 [지킴] 관리자 아님 · 보통 섹션 → 미리보기 단추 없음', async ({ page }) => {
  const errs = await scene(page, { admin: false });
  expect(await page.locator('#sec-yt-preview-btn').count(), '★관리자 아님 → 없음').toBe(0);
  await page.evaluate(async () => { window.__admin = { ...window.__admin, state: () => ({ isAdmin: true }) }; const s = await window.addSection(); window.showSectionProperties(s); });
  expect(await page.locator('#sec-yt-preview-btn').count(), '★보통 섹션 → 없음').toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P3 양성대조 — 섹션 바탕을 바꾸면 미리보기 그림이 달라진다', async ({ page }) => {
  const errs = await scene(page);
  await openPreview(page);
  const s0 = await srcOf(page);
  await page.click('#ytp-done');
  await page.evaluate(() => { document.getElementById('ytS').style.backgroundColor = '#c03030'; window.showSectionProperties(document.getElementById('ytS')); });
  await openPreview(page);
  const s1 = await srcOf(page);
  expect(!!s0 && !!s1 && s0 !== s1, '★그림이 그 섹션에서 온다').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});
