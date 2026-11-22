/* slide-cell-shadow-gif — SLIDE-CELL-SHADOW-GIF-01(현빈 «반드시» · 지디 261121) GIF 판을 위아래로 칸 그림자만큼 키움.
 *   앞 줄 = 134 SLIDE-CELL-SHADOW-CLIP-01(캔버스·PNG·HTML 은 위아래 그림자 보임) · GIF 는 블럭 크기라 위아래가 잘렸다.
 *   ★잰다: 진짜 GIF 버튼(#open-anim-btn → .anim-export-btn) · 진짜 _exportSlideGif 루프 — 가짜는 GIF 클래스 하나(진짜 gif.js copy:true 처럼 프레임을 읽어 둠).
 * S1 새 블럭(칸 셋 · 옅은 그림자 blur 50 + y 18 → 넘침 68px) → GIF 높이 = 옛 높이 + 2×68×k · 폭 그대로 ·
 *    첫째 칸 가운데 세로줄: 그림 칸 바로 위·아래 띠 = 바탕보다 어둡다(그림자) · 판 맨 윗줄·맨 아랫줄 = 바탕(그림자가 판 안에서 끝남 = 잘리지 않음)
 * S2 [지킴] 그림자 0(칸 셋 다 끔) → GIF 크기 = 옛 셈(블럭 × 2) 그대로
 * 양성대조: _patches/slide-shadow-gif-CTL.patch(pad = 0 — 옛 판 크기) → S1 빨강.
 * 프레임 png: SHADOW_GIF_PNG=<경로> 로 돌리면 첫 프레임을 그 경로에 쓴다.
 * 셀렉터·전역 대조(제품 소스 grep): addSlideBlock · renderSlideBlock · slideShadowPad(slide-block.js) · #open-anim-btn(prop-slide.js) · .anim-export-btn · GIF(animation-engine.js)
 */
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function menuScene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => {
    window.__admin = { state: () => ({ isAdmin: true }) };   // GIF 버튼 공개 범위(animGifVisible · slide-block.dom.spec 과 같은 가짜)
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    window.selectSection(c.querySelector('.section-block'));
    const made = window.addSlideBlock();   // 추가 메뉴 onclick 과 같은 입구 · 새 블럭 = 칸 셋 · 칸마다 옅은 그림자
    made.block.scrollIntoView({ block: 'center' });
    return made.block.id;
  });
  return { errs, id };
}
/* 진짜 GIF 버튼으로 저장 → 가짜 GIF 가 크기·첫 프레임(data URL)·첫째 칸 가운데 세로줄 밝기를 남긴다 */
async function exportGif(page, id) {
  await page.evaluate((id) => {
    const b = document.getElementById(id), br = b.getBoundingClientRect(), c0 = b.querySelector('.sld-cell').getBoundingClientRect();
    window.__col = (c0.left + c0.width / 2 - br.left) / br.width;   // 첫째 칸 가운데(블럭 폭 비)
    window.__gif = null; window.__realGIF = window.GIF;
    window.GIF = class {
      constructor(o) { this.o = o; this.h = {}; window.__gif = { w: o.width, h: o.height, frames: 0 }; }
      addFrame(ctx) {
        const { width: W, height: H } = this.o;
        ctx.getImageData(0, 0, W, H);   // 진짜 gif.js copy:true 와 같은 읽기
        if (window.__gif.frames++) return;
        window.__gif.png = ctx.canvas.toDataURL('image/png');
        const x = Math.round(W * window.__col), d = ctx.getImageData(x, 0, 1, H).data;
        window.__gif.col = Array.from({ length: H }, (_, y) => Math.round((d[y * 4] + d[y * 4 + 1] + d[y * 4 + 2]) / 3));
      }
      on(ev, f) { this.h[ev] = f; }
      render() { this.h.finished?.(new Blob(['GIF89a'], { type: 'image/gif' })); }
    };
  }, id);
  await page.click('#open-anim-btn');
  await page.click('.anim-export-btn');
  await expect.poll(() => page.evaluate(() => window.__gif?.frames || 0), { message: '[전제] 프레임이 쌓였다' }).toBeGreaterThan(0);
  return page.evaluate((id) => { window.GIF = window.__realGIF; const b = document.getElementById(id); return { ...window.__gif, bw: b.offsetWidth, bh: b.offsetHeight, pad: window.slideShadowPad(b) }; }, id);
}

test('S1 칸 그림자 → GIF 판이 위아래로 그림자만큼 커지고 그림자가 판 안에서 끝난다', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  const g = await exportGif(page, id);
  if (process.env.SHADOW_GIF_PNG) fs.writeFileSync(process.env.SHADOW_GIF_PNG, Buffer.from(g.png.split(',')[1], 'base64'));
  const W = Math.max(320, Math.round(g.bw * 2)), H = Math.max(40, Math.round(g.bh * (W / g.bw))), pad = Math.round(g.pad * (W / g.bw));
  expect(g.pad, '[전제] 새 블럭 = 옅은 그림자 넘침 68px').toBe(68);
  expect([g.w, g.h], `★폭 그대로 · 높이 = 옛 ${H} + 2×${pad}`).toEqual([W, H + 2 * pad]);
  const c = g.col, bg = c[0], avg = (a, b) => c.slice(a, b).reduce((s, v) => s + v, 0) / (b - a);
  const above = avg(pad - 12, pad - 2), below = avg(pad + H + 2, pad + H + 12);
  expect({ above: above < bg - 3, below: below < bg - 3 }, `★칸 바로 위·아래 = 그림자(바탕 ${bg} · 위 ${above.toFixed(1)} · 아래 ${below.toFixed(1)})`).toEqual({ above: true, below: true });
  expect([Math.abs(c[0] - c[c.length - 1]) <= 1, Math.abs(avg(0, 3) - bg) <= 1, Math.abs(avg(c.length - 3, c.length) - bg) <= 1], `★판 맨 위·맨 아래 = 바탕(그림자 끝까지 판 안) ${c[0]} · ${c[c.length - 1]}`).toEqual([true, true, true]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S2 [지킴] 그림자 0 → GIF 크기 옛 그대로', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  await page.evaluate((id) => { const b = document.getElementById(id); b.querySelectorAll('.sld-cell').forEach((c) => delete c.dataset.shadow); window.renderSlideBlock(b); }, id);
  const g = await exportGif(page, id);
  const W = Math.max(320, Math.round(g.bw * 2)), H = Math.max(40, Math.round(g.bh * (W / g.bw)));
  expect([g.pad, g.w, g.h], '★그림자 0 = 넘침 0 · 옛 크기').toEqual([0, W, H]);
  expect(errs, errs.join(' | ')).toEqual([]);
});
