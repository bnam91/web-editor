/* freetext-fit-width.dom.spec.js — ①-나 (현빈 2026-10-11)
 * ★현빈: 「프레임 블럭 ★자유배치모드일때 내부에 ★처음 텍스트를 넣는 경우의 ★너비와, ★드래그로 움직였더니
 *   너비가 ★달라지거든? ★추가되는 텍스트블럭은 ★★후자로 ★글자 길이에 따른 너비로 ★아웃라인 만들어줘」
 *
 * ★★무엇을 잠그나: ★★«넣은 직후»가 ★★«끌고 난 뒤»와 ★같은 폭이다 — ★★즉 ★끌어도 ★폭이 ★안 바뀐다.
 *   ⇒ ★두 끝을 ★★같은 회차에서 ★재고 ★견준다. ⛔상수(183 따위)를 ★박지 않는다 — ★폰트에 따라 달라진다.
 * ★고치기 전 실측(기준선): 넣을 때 ★860(100%) → 끌고 난 뒤 ★183px  (★차 677)
 * ★누름 꼴: ★진짜 `page.mouse` down/move/up — ⛔`dispatchEvent` 0건
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const READ = `((id) => {
  const tf = document.getElementById(id);
  if (!tf) return { gone: true };
  const F = document.getElementById('sF');
  const fr = F.getBoundingClientRect(), tr = tf.getBoundingClientRect();
  const z = F.offsetWidth ? fr.width / F.offsetWidth : 1;
  const ce = tf.querySelector('[class^="tb-"]');
  const cr = ce ? ce.getBoundingClientRect() : null;
  return {
    styleW: tf.style.width || '(빈칸)', dsW: tf.dataset.width ?? '(없다)',
    offW: tf.offsetWidth, offH: tf.offsetHeight,
    gapL: Math.round((tr.left - fr.left) / z), gapR: Math.round((fr.right - tr.right) / z),
    align: ce ? (ce.style.textAlign || getComputedStyle(ce).textAlign) : '(없다)',
    glyphW: cr ? Math.round(cr.width / z) : -1,
    frameW: F.offsetWidth,
  };
})`;

async function freeFrame(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend',
      '<div class="section-block" data-section="1" id="sS"><div class="section-hitzone"></div>' +
      '<div class="section-inner" id="sS-in"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.();
    window.state.pageSettings.padX = 0; window.applyPageSettings();
    const S = document.getElementById('sS');
    window.selectSection(S); window.addFrameBlock();
    const F = [...S.querySelectorAll('.frame-block:not([data-text-frame])')].pop();
    F.id = 'sF'; F.style.height = '600px';
  });
  /* ★그릇을 정하는 자는 `window._activeFrame` 이고 ★놓는 자는 ★클릭이다(`block-drag.js:133`) */
  await page.click('#sF', { timeout: 2500, position: { x: 5, y: 5 } });
  const active = await page.evaluate(() => window._activeFrame?.id || '(없다)');
  expect(active, '전제: 클릭이 _activeFrame 을 이 프레임으로 놓았다').toBe('sF');
  return errs;
}
async function addText(page, fn, args) {
  return page.evaluate(({ fn, args }) => {
    const F = document.getElementById('sF');
    window._activeFrame = F;
    window[fn](...args);
    const tf = [...F.children].filter(c => c.dataset.textFrame === 'true').pop();
    if (tf) tf.id = 'tf1';
    return { found: !!tf, free: F.dataset.freeLayout };
  }, { fn, args });
}
async function dragIt(page, sel) {
  const b = await page.locator(sel).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 10, b.y + b.height / 2 + 6, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2 + 30, b.y + b.height / 2 + 20, { steps: 6 });
  await page.mouse.up();
  return b;
}

test('N1 ★넣은 직후의 폭이 ★★끌고 난 뒤의 폭과 ★같다 (＋아웃라인이 ★글자를 ★감싼다)', async ({ page }) => {
  const errs = await freeFrame(page);
  const ins = await addText(page, 'addTextBlock', ['body', { content: '짧은 글 한 줄' }]);
  expect(ins.found, '전제: 자유배치 프레임 안에 text-frame 이 생겼다').toBe(true);
  expect(ins.free, '전제: 프레임이 자유배치다').toBe('true');
  const a = await page.evaluate(eval(READ), 'tf1');
  console.log(`[N1 ⒜ 넣은 직후] styleW=${a.styleW} dsW=${a.dsW} offW=${a.offW} 틈 L${a.gapL}/R${a.gapR} 글자폭=${a.glyphW} 정렬=${a.align} frameW=${a.frameW}`);
  /* ★★주 단언 ⑴ — ★전폭이 ★아니다. ⛔`!== '100%'` 로만 적으면 ★어떤 px 든 통과하므로 ★수로도 묶는다 */
  expect(a.dsW, '넣은 직후 dataset.width 가 100% 가 아니다').not.toBe('100%');
  expect(a.offW, `넣은 직후 폭(${a.offW})이 프레임 폭(${a.frameW})보다 작다`).toBeLessThan(a.frameW);
  /* ★★주 단언 ⑵ — ★아웃라인이 ★글자를 ★감싼다(상자 == 글자, 꾸밈 여유 2px 안) */
  expect(Math.abs(a.offW - a.glyphW), `상자 ${a.offW} 와 글자 ${a.glyphW} 의 차`).toBeLessThanOrEqual(2);
  /* ★★주 단언 ⑶ — ★★«후자와 같다»: ★진짜로 끌어도 ★폭이 ★안 바뀐다 */
  await dragIt(page, '#tf1');
  const b = await page.evaluate(eval(READ), 'tf1');
  console.log(`[N1 ⒝ 끌고 난 뒤] styleW=${b.styleW} dsW=${b.dsW} offW=${b.offW} 틈 L${b.gapL}/R${b.gapR} 글자폭=${b.glyphW}`);
  console.log(`[N1 ⇒] 폭 ${a.offW} → ${b.offW} · ★고치기 전 기준선은 ★860 → 183 였다(차 677)`);
  expect(b.offW, `끌고 난 뒤 폭이 넣은 직후와 같다(${a.offW})`).toBe(a.offW);
  expect(b.offH, '줄 수(높이)도 그대로다').toBe(a.offH);
  /* ★음성대조 ⑴ — ★가운데에서 ★시작한다(좌우 틈이 ★같다) */
  expect(Math.abs(a.gapL - a.gapR), `넣은 직후 좌우 틈 L${a.gapL}/R${a.gapR}`).toBeLessThanOrEqual(1);
  /* ★음성대조 ⑵ — ★글자 ★정렬값은 ★안 건드렸다(현빈 2026-09-05 의 center) */
  expect(a.align, '글자 정렬은 center 그대로').toBe('center');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('N2 ★범위 — ★★«빈 줄»과 ★«좌표를 준 길»은 ★안 건드린다', async ({ page }) => {
  const errs = await freeFrame(page);
  /* ⒜ 의도적 빈 줄(`addBlankTextBlock`)은 ★전폭이 ★뜻이다 — ★그 길은 ★★다른 호출 자리(block-factory.js:644) */
  const blank = await addText(page, 'addBlankTextBlock', []);
  expect(blank.found, '전제: 빈 줄 text-frame 이 생겼다').toBe(true);
  const z = await page.evaluate(eval(READ), 'tf1');
  console.log(`[N2 ⒜ 빈 줄] styleW=${z.styleW} dsW=${z.dsW} offW=${z.offW} (frameW=${z.frameW})`);
  expect(z.dsW, '빈 줄은 100% 그대로다').toBe('100%');
  /* ⒝ ★좌표를 ★준 길(MCP·Figma 임포트)은 ★자리를 ★안 고치므로 ★폭도 ★안 좁힌다.
     ⚠️★★여기서 ★한 번 틀렸다 — ★처음엔 `{x,y}` 만 주고 ★「100% 여야 한다」로 적었는데 ★★174px 이 나왔다.
       ★까닭: `frame-geometry.js:140 newTextAlignInFrame` 은 ★좌표가 있으면 ★null ⇒ ★정렬이 ★left 로 남고,
       ★left 갈래는 ★★원래부터 ★내용폭으로 ★클램프한다(★내 고침과 ★무관).
     ⇒ ★★그 칸은 ★아무것도 ★가르지 못한다. ★가르는 칸은 ★★«정렬 center ＋ 좌표» 다 —
       ★거기선 ★고치기 ★전·후가 ★둘 다 ★100% 여야 한다(★내 깃발이 ★`!hasAbsCoords` 라 ★꺼진다). */
  await page.evaluate(() => { document.getElementById('tf1').id = 'tfBlank'; });
  const given = await addText(page, 'addTextBlock', ['body', { content: '좌표를 준 글', x: 40, y: 300, align: 'center' }]);
  expect(given.found, '전제: 둘째 text-frame 이 생겼다').toBe(true);
  const g = await page.evaluate(eval(READ), 'tf1');
  console.log(`[N2 ⒝ 좌표＋정렬 center] styleW=${g.styleW} dsW=${g.dsW} offW=${g.offW} 틈 L${g.gapL}/R${g.gapR} 정렬=${g.align}`);
  expect(g.align, '전제: 정렬이 center 다(이 칸이 가르는 조건)').toBe('center');
  expect(g.dsW, '좌표를 받은 길은 center 여도 100% 그대로다(자리를 안 고치니 폭도 안 좁힌다)').toBe('100%');
  /* ★음성대조 — ★같은 자리에서 ★좌표를 ★«안» 주면 ★좁혀진다(=★깃발이 ★실제로 ★갈린다) */
  await page.evaluate(() => { document.getElementById('tf1').id = 'tfGiven'; });
  const free = await addText(page, 'addTextBlock', ['body', { content: '좌표를 준 글', align: 'center' }]);
  expect(free.found, '전제: 셋째 text-frame 이 생겼다').toBe(true);
  const f = await page.evaluate(eval(READ), 'tf1');
  console.log(`[N2 ⒞ 좌표 없음＋정렬 center] styleW=${f.styleW} dsW=${f.dsW} offW=${f.offW} ⇒ ★같은 글자인데 ★${g.offW} vs ${f.offW}`);
  expect(f.dsW, '좌표를 안 주면 글자 길이 폭이 된다').not.toBe('100%');
  expect(f.offW, `좌표 준 쪽(${g.offW})보다 좁다`).toBeLessThan(g.offW);
  expect(errs, errs.join(' | ')).toEqual([]);
});
