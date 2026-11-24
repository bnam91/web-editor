/* text-lorem-regrade — 0.9.13 174 t13E-08 채점 되돌림(지디 261123 · 미카사 실앱 handoff/MIKASA-grade-0913-261123 · ❌):
 *   «래퍼 161 고정 · 더미 문장 30 채우기 3번 → 글 블럭이 3378/3477/3246px 로 커져 섹션 밖으로» = «높이에 맞춰 양만 채우기» 안 됨(원문 «블럭 높이는 고정»).
 * R1 글 프레임 높이가 style.height 로 고정(161 · data-fixed-h 없음)인 상자 + 채우기 3번 → 글이 161 안 · 프레임 161 그대로
 * R1b data-fixed-h(손잡이 길) + style.height 둘 다 161 + 채우기 3번 → 글이 161 안
 * R2 data-fixed-h(손잡이 길)로 161 인 글 프레임이 «흐름 프레임 안»에 있을 때 + 채우기 3번 → 글이 161 안
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page, mode) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (mode) => {
    window.__admin = { ...(window.__admin || {}), state: () => ({ isAdmin: true }) };
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    const sec = c.querySelector('.section-block'); sec.id = 'sR'; sec.style.minHeight = '1200px'; window.applyZoom?.(100);
    window.deselectAll(); window.selectSection(sec);
    window.addTextBlock('body');
    const tf = [...sec.querySelectorAll('.frame-block[data-text-frame]')].pop(), tb = tf.querySelector('.text-block'); tb.id = 'tbR'; tf.id = 'tfR';
    if (mode === 'inFrame') { window.deselectAll(); window.selectSection(sec); window.addFrameBlock(); const fr = [...sec.querySelectorAll('.frame-block:not([data-text-frame])')].find((f) => !f.contains(tf)); fr.id = 'frR'; fr.appendChild(tf); }   // 흐름 프레임 안 글(실프로젝트 꼴)
    const ed = tb.querySelector('[class^="tb-"]'); if (ed) ed.style.fontSize = '18px';
    if (mode === 'styleH' || mode === 'both') tf.style.height = '161px';   // 옛 꼴/다른 길로 굳은 높이
    if (mode !== 'styleH') { tf.dataset.fixedH = '161'; tf.style.minHeight = '161px'; }   // 손잡이 길(t13D-10)
    window.deselectAll(); window.selectBlock(tb.id); window.showTextProperties?.(tb); window.clearHistory?.();
  }, mode);
  await waitZoomSettled(page, 100);
  return errs;
}
const meas = (page) => page.evaluate(() => { const tf = document.getElementById('tfR'), tb = document.getElementById('tbR'); return { tf: tf.offsetHeight, tb: tb.offsetHeight, fr: document.getElementById('frR')?.offsetHeight ?? null, inFrame: tf.parentElement?.id === 'frR' || !!tf.closest('#frR'), mark: !!tb.dataset.lorem }; });
async function fill3(page) {
  await page.waitForSelector('#txt-lorem-run');
  const hs = [];
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => { const u = document.getElementById('txt-lorem-unit'); if (u) { u.value = 'sentence'; u.dispatchEvent(new Event('change', { bubbles: true })); } const c = document.getElementById('txt-lorem-count'); if (c) c.value = '30'; });   // 미카사 손짓 = 문장 · 개수 30
    await page.click('#txt-lorem-run'); await raf(page); hs.push(await meas(page));
  }
  return hs;
}

for (const mode of ['styleH', 'both', 'inFrame']) {
  test(`${{ styleH: 'R1', both: 'R1b', inFrame: 'R2' }[mode]} (174) 높이 161 고정 글 상자(${mode}) + 더미 문장 채우기 3번 → 글이 161 안 · 상자 161 그대로`, async ({ page }) => {
    const errs = await scene(page, mode);
    const pre = await meas(page);
    const hs = await fill3(page);
    console.log(`[${mode} 실측]`, JSON.stringify({ pre, hs }));
    if (mode === 'inFrame') expect(pre.inFrame, '[전제] 글 프레임이 흐름 프레임 안').toBe(true);
    expect(hs.map((h) => [h.tf <= 162, h.tb <= 162]), `★채울 때마다 상자·글 ≤ 161 (${hs.map((h) => h.tb).join('/')})`).toEqual([[true, true], [true, true], [true, true]]);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}
