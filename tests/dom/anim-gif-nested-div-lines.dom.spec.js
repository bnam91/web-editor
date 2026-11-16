/* anim-gif-nested-div-lines — NEW-현빈QA-GIF-BROKEN-AFTER-LINEBREAK-EDIT-01(현빈 실앱 QA 261116 · tb_6jh6q_p1c1zyx 증상 참고 — 시험은 픽스처 별).
 *   «GIF 적용한 상태에서 텍스트 줄바꿈하고 빈칸 넣고 하다 보니 깨지네» — 편집 뒤 글 HTML(지디 실측) 그대로:
 *   <span tb-hl>&nbsp;안녕하세요&nbsp;</span><div><div><span tb-hl>반갑습니다.&nbsp;</span></div></div> · slide-up · H2 72px · 줄높이 1.15
 *   원인(코드 읽기): animation-engine.js _extractText 가 <div 마다 \n — 겹 div 라 \n\n = 가운데 빈 줄 ⇒ GIF 는 세 줄(블럭 화면은 두 줄) ·
 *   캔버스 재생 덮개 = 블럭 × 2 높이라 세 줄 가운데 맞춤이면 위·아래 줄이 반쯤 잘리고 두 줄이 벌어져 보인다(스샷 tbp.png 와 같은 꼴). 끝 &nbsp; 는 무관(폭만).
 * N1 진짜 모달 «줄마다 따로» 칸 = 2줄(라벨 «안녕하세요» · «반갑습니다.» · 빈 줄 0) · 캔버스에서 보기 덮개에서 글(검정) 맨 위·맨 아래 줄이 가장자리에 안 닿음(안 잘림) · pageerror 0
 * N2 줄바꿈 규칙 지킴: <div><br></div> 빈 줄은 그대로 빈 줄(세 줄) · 첫 줄이 div 여도 맨 앞 빈 줄 0
 * 양성대조(예측 · CTL 패치): _extractText 의 블럭 시작 표 두 줄을 옛 `'\n<div'`·`'\n<p'` 로 + 표 접기 줄 삭제 + _extractCs 의 `&& raw && !raw.endsWith('\n')` 삭제 → N1 빨강(3줄 · 잘림) · N2 초록(옛도 빈 줄은 빈 줄)
 * 셀렉터·전역 대조(제품 소스 grep): #anim-gif-modal · #anim-list .anim-item[data-id](_buildAnimList) · #anim-per-line · #anim-tracks .anim-track-row .anim-track-label(_renderTrackRows) ·
 *   .anim-play-canvas-btn(index.html) · #anim-canvas-play(_startCanvasPlay) · span.tb-hl 변수 · window.addTextBlock('h2')(block-factory.js classMap h2) · window.openAnimModal/closeAnimModal
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const HL = (inner) => `<span class="tb-hl" style="--tb-hl-color: rgb(255, 235, 59); --tb-hl-h: 40%; --tb-hl-y: 0px">${inner}</span>`;
const BUG_HTML = `${HL('&nbsp;안녕하세요&nbsp;')}<div><div>${HL('반갑습니다.&nbsp;')}</div></div>`;

async function scene(page, html) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    window.selectSection(c.querySelector('.section-block'));
    window.addTextBlock('h2');
    const tb = [...c.querySelectorAll('.text-block')].pop();
    const ce = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-h2');
    Object.assign(ce.style, { fontSize: '72px', lineHeight: '1.15', color: 'rgb(17, 17, 17)', textAlign: 'center' });
    ce.innerHTML = h;
    window.__tb = tb;
    window.deselectAll?.();
    window.openAnimModal(tb);
  }, html);
  await page.click('#anim-list .anim-item[data-id="slide-up"]');
  return errs;
}
const rows = async (page) => {
  await page.check('#anim-per-line');
  const labels = await page.evaluate(() => [...document.querySelectorAll('#anim-tracks .anim-track-row .anim-track-label')].map((l) => l.title.trim()));   // title = 그 줄 온 글(빈 줄 = '' · 라벨 글은 «(빈 줄)»)
  await page.uncheck('#anim-per-line');
  return labels;
};

test('N1 겹 div 줄바꿈 + 앞뒤 &nbsp; — GIF 줄 = 화면 두 줄 · 캔버스 재생에서 안 잘림', async ({ page }) => {
  const errs = await scene(page, BUG_HTML);
  expect(await rows(page), '★겹 div 가 가운데 빈 줄을 만들었다(GIF 세 줄)').toEqual(['안녕하세요', '반갑습니다.']);
  await page.click('#anim-gif-modal .anim-play-canvas-btn');
  await expect(page.locator('#anim-canvas-play'), '[전제] 캔버스에서 보기').toHaveCount(1);
  /* 덮개 = 블럭 × 2 — 끝 프레임(한 바퀴 끝 1.5초 멈춤)에 글 맨 위·맨 아래 줄이 가장자리에서 떨어져 있다(잘리면 닿는다) */
  await expect.poll(() => page.evaluate(() => {
    const cv = document.getElementById('anim-canvas-play'); if (!cv) return 'no-canvas';
    const W = cv.width, H = cv.height, d = cv.getContext('2d').getImageData(0, 0, W, H).data;
    let top = -1, bot = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (d[i + 3] > 200 && d[i] < 90 && d[i + 1] < 90 && d[i + 2] < 90) { if (top < 0) top = y; bot = y; break; } }
    return top < 0 ? 'no-ink' : (top > 2 && bot < H - 3 ? 'ok' : `cut top ${top} bot ${bot} / H ${H}`);
  }), { timeout: 15000, message: '★캔버스 재생에서 글 줄이 가장자리에 잘린다' }).toBe('ok');
  await page.keyboard.press('Escape');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('N2 빈 줄은 빈 줄 — <div><br></div> = 세 줄 · 첫 줄 div 면 맨 앞 빈 줄 0', async ({ page }) => {
  const errs = await scene(page, `<div>${HL('하나')}</div><div><br></div><div>셋</div>`);
  expect(await rows(page), '빈 줄 보존 · 맨 앞 빈 줄 0').toEqual(['하나', '', '셋']);
  expect(errs, errs.join(' | ')).toEqual([]);
});
