/* anim-gif-hl-leading-space — NEW-현빈QA-GIF-HL-LEADING-SPACE-LOST-01(현빈 QA · tb_6jh6q_p1c1zyx 증상 참고 — 시험은 픽스처 별).
 *   <span class="tb-hl">&nbsp;안녕하세요</span> — 화면에선 앞 빈칸 몫까지 형광펜이 칠해지는데 GIF 미리보기는 빈칸 몫이 빠졌다.
 *   ★잰다: 실제 텍스트 블럭 · 실제 모달 · 진짜 «페이드 인» 클릭 · 실제 미리보기 캔버스 픽셀(0.9.12 효과 — V3 fade-char·hl:fixed 없이 같은 증상).
 * D1 같은 블럭 두 글: 앞 &nbsp; 있음 / 없음 — 미리보기에서 «형광(자홍) 왼끝 → 글(검정) 왼끝» 간격이 앞 빈칸 있는 쪽이 ≥ 2px 더 넓다(빈칸 몫 띠) · pageerror 0
 * 양성대조(예측 · CTL 패치 = 세 자리 옛 판으로): _extractText `.replace(_EDGE_WS, '')`→`.trim()` · _extractCs 옛 trimStart/trimEnd · layoutLines wrap 옛 truthy 판정
 *   → D1 빨강(두 간격 같음) · 단위 H1 빨강 · H2 초록
 * 셀렉터·전역 대조(제품 소스 grep): #anim-gif-modal · #anim-list .anim-item[data-id](_buildAnimList) · #anim-preview-canvas · span.tb-hl 변수 --tb-hl-color/-h/-y(_runStyle) ·
 *   window.openAnimModal · window.closeAnimModal · window.addSection · window.selectSection · window.addTextBlock
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const HL = (inner) => `<span class="tb-hl" style="--tb-hl-color: rgb(255, 0, 255); --tb-hl-h: 40%; --tb-hl-y: 0px">${inner}</span>`;
/** 미리보기 캔버스: 자홍(형광) 왼끝 · 검정(글) 왼끝 — 둘 다 보일 때만 간격 */
const gapNow = (page) => page.evaluate(() => {
  const cv = document.getElementById('anim-preview-canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, W = cv.width;
  let mag = Infinity, ink = Infinity;
  for (let i = 0; i < d.length; i += 4) {
    const x = (i / 4) % W, r = d[i], g = d[i + 1], b = d[i + 2];
    if (r > 200 && g < 80 && b > 200 && x < mag) mag = x;
    if (r < 90 && g < 90 && b < 90 && x < ink) ink = x;
  }
  return mag < Infinity && ink < Infinity ? ink - mag : null;
});

test('D1 앞 &nbsp; 형광펜 — 미리보기 띠가 빈칸 몫만큼 글 앞으로 나온다', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    window.selectSection(c.querySelector('.section-block'));
    window.addTextBlock('body');
    window.__tb = [...c.querySelectorAll('.text-block')].pop();
    window.deselectAll?.();
  });
  const measure = async (html) => {
    await page.evaluate((h) => { const tb = window.__tb; window.closeAnimModal?.(); (tb.querySelector('[contenteditable]') || tb.querySelector('.tb-body')).innerHTML = h; window.openAnimModal(tb); }, html);
    await page.click('#anim-list .anim-item[data-id="fade-in"]');
    let g = null;
    await expect.poll(async () => (g = await gapNow(page)), { timeout: 10000, message: `[전제] 미리보기에 형광·글이 다 보인다 — ${html}` }).not.toBeNull();
    return g;
  };
  const withSp = await measure(HL('&nbsp;안녕하세요'));
  const noSp = await measure(HL('안녕하세요'));
  expect(withSp - noSp, `★앞 빈칸 몫 형광펜이 빠졌다 — 간격 빈칸 있음 ${withSp}px · 없음 ${noSp}px`).toBeGreaterThanOrEqual(2);
  expect(errs, errs.join(' | ')).toEqual([]);
});
