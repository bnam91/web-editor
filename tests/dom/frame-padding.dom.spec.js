/* frame-padding.dom.spec.js — 현빈 「프레임에 패딩 기능 — 섹션처럼」 (F5, 2026-10-03)
 * 지금까지 프레임엔 「상/하 여백」(padY)만 있었다. 「좌우 패딩」 줄을 섹션 줄과 «같은 마크업(sliderRowHTML)·같은 띠(_showPadXHint)» 로 붙인다.
 * ★자유 프레임은 자식이 absolute 라 CSS padding 이 «안 먹는다» — 정렬(frameAlignOffset)·끌기 죔(clampChildIntoFrame)·
 *   삽입 스택(_calcFreeLayoutStackY)이 안쪽 여백을 직접 읽는다.
 * ⛔앱 통째 헤드리스(bootApp). 실행: npx playwright test --config=tests/dom/playwright.dom.config.js frame-padding --workers=2
 * ⛔못 재는 축: Figma 내보내기(미대응 — 커밋 메시지), drag-utils.js settleRowInFreeFrame(F3 레인 몫). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const ASSET = `<div class="asset-block" id="k" style="width:200px;height:60px;background:#0000ff;position:absolute;left:0px;top:0px"></div>`;
const STACK_ASSET = `<div class="row" data-layout="stack"><div class="asset-block" id="k" data-align="left" style="width:200px;height:60px;align-self:flex-start;background:#0000ff"></div></div>`;
const STACK_TEXT = `<div class="frame-block" id="k" data-text-frame="true" data-bg="transparent" style="background:transparent;width:133px;box-sizing:border-box;max-width:100%;align-self:flex-start"><div class="text-block" data-type="body"><div class="tb-body" style="text-align:left">안녕하세요</div></div></div>`;

async function setup(page, { free, kid, bg = '#ff0000' }) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  await bootApp(page);
  await page.evaluate(({ free, kid, bg }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" data-section="1" id="sec1" style="width:860px"><div class="section-hitzone"></div><div class="section-inner"></div></div>`);
    const ss = window.makeFrameBlock(free ? {} : { fullWidth: true });
    if (free) { ss.style.height = '300px'; ss.style.minHeight = '300px'; ss.dataset.height = '300'; }
    ss.style.width = '860px'; ss.dataset.width = '860'; ss.style.backgroundColor = bg; ss.dataset.bg = bg;
    ss.insertAdjacentHTML('beforeend', kid);
    document.querySelector('#sec1 .section-inner').appendChild(ss);
    window.rebindAll?.();
    window.showFrameProperties(ss);
    window.__ss = ss.id;
  }, { free, kid, bg });
  await page.waitForTimeout(250);
}
const setPad = async (page, id, v) => { await page.fill(`#${id}`, String(v)); await page.waitForTimeout(150); };
/* 프레임 «패딩 상자» 모서리 기준 자식 좌표(배율 보정) */
const box = (page) => page.evaluate(() => {
  const ss = document.getElementById(window.__ss), k = document.getElementById('k');
  const fr = ss.getBoundingClientRect(), kr = k.getBoundingClientRect(), sc = fr.width / ss.offsetWidth || 1;
  const cl = ss.clientLeft, ct = ss.clientTop;
  return { left: (kr.left - fr.left) / sc - cl, top: (kr.top - fr.top) / sc - ct, right: (fr.right - kr.right) / sc - cl,
           cw: ss.clientWidth, ch: ss.clientHeight, w: kr.width / sc, h: kr.height / sc,
           pl: ss.style.paddingLeft, pr: ss.style.paddingRight, dpx: ss.dataset.padX };
});
const press = async (page, id) => { await page.click(`#${id}`); await page.waitForTimeout(150); };

test('A1 ★패널에 「좌우 패딩」 줄이 있고 섹션 줄과 같은 꼴(.prop-row·라벨·슬라이더·숫자) — 기존 「상/하 여백」은 그대로', async ({ page }) => {
  await setup(page, { free: false, kid: STACK_ASSET });
  const r = await page.evaluate(() => {
    const row = document.getElementById('ss-padx-slider')?.closest('.prop-row');
    const y = document.getElementById('ss-pady-slider')?.closest('.prop-row');
    return { label: row?.querySelector('.prop-label')?.textContent, kids: row ? [...row.children].map(e => e.className) : null,
             yLabel: y?.querySelector('.prop-label')?.textContent, rowH: row ? row.getBoundingClientRect().height : 0 };
  });
  expect(r.label).toBe('좌우 패딩');
  expect(r.kids).toEqual(['prop-label', 'prop-slider', 'prop-number']);
  expect(r.yLabel).toBe('상/하 여백');
  expect(Math.round(r.rowH)).toBe(24);
});

test('A2 ★스택 프레임: 좌우 패딩 40 → 자식(왼쪽 정렬)이 여백만큼 안쪽, 가운데 정렬은 안쪽 상자 기준', async ({ page }) => {
  await setup(page, { free: false, kid: STACK_ASSET });
  await setPad(page, 'ss-padx-num', 40);
  let b = await box(page);
  expect(b.pl).toBe('40px'); expect(b.pr).toBe('40px'); expect(b.dpx).toBe('40');
  expect(Math.abs(b.left - 40)).toBeLessThanOrEqual(1);
  await press(page, 'ss-align-hcenter');
  b = await box(page);
  expect(Math.abs(b.left - b.right)).toBeLessThanOrEqual(1);
  await press(page, 'ss-align-right');
  b = await box(page);
  expect(Math.abs(b.right - 40)).toBeLessThanOrEqual(1);
});

test('A3 ★자유 프레임: 정렬이 패딩을 «존중» — 왼쪽=padX · 오른쪽=padX 만큼 띄움 · 위=padY', async ({ page }) => {
  await setup(page, { free: true, kid: ASSET });
  await setPad(page, 'ss-padx-num', 50);
  await setPad(page, 'ss-pady-num', 40);
  await press(page, 'ss-align-left');
  let b = await box(page);
  expect(Math.abs(b.left - 50)).toBeLessThanOrEqual(1);
  await press(page, 'ss-align-right');
  b = await box(page);
  expect(Math.abs(b.right - 50)).toBeLessThanOrEqual(1);
  await press(page, 'ss-align-hcenter');
  b = await box(page);
  expect(Math.abs(b.left - b.right)).toBeLessThanOrEqual(1);
  await press(page, 'ss-align-top');
  b = await box(page);
  expect(Math.abs(b.top - 40)).toBeLessThanOrEqual(1);
});

test('A4 자유 프레임: 비대칭 여백(좌 80·우 0)에서 가운데는 «안쪽 상자»의 가운데', async ({ page }) => {
  await setup(page, { free: true, kid: ASSET });
  await page.evaluate(() => { const ss = document.getElementById(window.__ss); ss.style.paddingLeft = '80px'; });
  await press(page, 'ss-align-hcenter');
  const b = await box(page);
  expect(Math.abs(b.left - 80 - (b.cw - 80 - b.w) / 2)).toBeLessThanOrEqual(1);
});

test('A5 자유 프레임: 안에서 끌어도 여백 «바깥»으로 못 나간다(clampChildIntoFrame)', async ({ page }) => {
  const r = await (async () => {
    await setup(page, { free: true, kid: ASSET });
    return page.evaluate(async () => {
      const g = await import('/js/frame-geometry.js');
      return { lo: g.clampChildIntoFrame(-30, -30, 200, 60, 860, 300, { l: 50, r: 50, t: 40, b: 40 }),
               hi: g.clampChildIntoFrame(999, 999, 200, 60, 860, 300, { l: 50, r: 50, t: 40, b: 40 }),
               none: g.clampChildIntoFrame(-30, 999, 200, 60, 860, 300) };
    });
  })();
  expect(r.lo).toEqual({ left: 50, top: 40 });
  expect(r.hi).toEqual({ left: 610, top: 200 });
  expect(r.none).toEqual({ left: 0, top: 240 });     // 여백을 안 주면 옛 계약 그대로
});

test('A6 자유 프레임: 새 블록 쌓기 첫 자리가 위 여백 아래(_calcFreeLayoutStackY)', async ({ page }) => {
  await setup(page, { free: true, kid: '' });
  await setPad(page, 'ss-pady-num', 60);
  await setPad(page, 'ss-padx-num', 30);
  await page.evaluate(() => { window._activeFrame = document.getElementById(window.__ss); });
  const r = await page.evaluate(() => {
    window.addTextBlock?.('body');
    const ss = document.getElementById(window.__ss);
    const kid = [...ss.children].find(c => c.style.position === 'absolute');
    return kid ? { top: parseInt(kid.style.top), left: parseInt(kid.style.left) } : null;
  });
  expect(r, '전제: 프레임 안에 새 블록이 들어갔다').not.toBeNull();
  expect(r.top).toBeGreaterThanOrEqual(60);
  expect(r.left).toBeGreaterThanOrEqual(30);
});

test('S1 ★저장·다시 열기 뒤에도 padX 와 정렬 결과가 같다 (스택·자유)', async ({ page }) => {
  for (const [free, kid] of [[false, STACK_ASSET], [true, ASSET]]) {
    await setup(page, { free, kid });
    await setPad(page, 'ss-padx-num', 44);
    await press(page, 'ss-align-right');
    const before = await box(page);
    const snap = await page.evaluate(() => window.serializeProject());
    expect(snap).not.toContain('--gdt-pad-l');          // 띠 힌트 변수가 저장에 새지 않는다
    await bootApp(page);
    await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
    await page.waitForTimeout(1200);   // 열린 뒤 배율 맞추기가 끝나길 기다린다
    await page.evaluate(() => { window.__ss = document.querySelector('#canvas .frame-block').id; });
    const after = await box(page);
    expect(after.dpx).toBe('44'); expect(after.pl).toBe('44px'); expect(after.pr).toBe('44px');
    /* 자유 프레임은 «좌표(left)가 저장값»이다 — 다시 열면 섹션 좌우여백이 붙어 프레임 폭이 달라질 수 있어(860→796) 오른쪽 여백이 아니라 left 를 견준다. */
    if (free) expect(Math.abs(after.left - before.left)).toBeLessThanOrEqual(1);
    else expect(Math.abs(after.right - before.right)).toBeLessThanOrEqual(1);
    await page.evaluate(() => window.showFrameProperties(document.getElementById(window.__ss)));
    expect(await page.inputValue('#ss-padx-num'), '다시 열린 패널의 값').toBe('44');
  }
});

test('U1 ⌘Z 한 걸음 — 좌우 패딩 한 번이 한 걸음으로 돌아간다', async ({ page }) => {
  await setup(page, { free: false, kid: STACK_ASSET });
  await setPad(page, 'ss-padx-num', 40);
  expect((await box(page)).pl).toBe('40px');
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  const b = await box(page);
  expect(parseInt(b.pl) || 0).toBe(0);
});

test('H1 띠 힌트: 프레임 슬라이더를 만지는 «동안» 프레임 안에 핑크 띠가 뜨고, 400ms 뒤 변수까지 거둔다', async ({ page }) => {
  await setup(page, { free: false, kid: STACK_ASSET });
  await setPad(page, 'ss-padx-num', 40);
  const on = await page.evaluate(() => {
    const ss = document.getElementById(window.__ss), cs = getComputedStyle(ss, '::before');
    return { cls: document.body.classList.contains('gdt-pad-on'), bl: cs.borderLeftWidth, content: cs.content };
  });
  expect(on.cls).toBe(true); expect(on.bl).toBe('40px');
  await page.waitForTimeout(700);
  const off = await page.evaluate(() => ({ cls: document.body.classList.contains('gdt-pad-on'),
    v: document.getElementById(window.__ss).style.getPropertyValue('--gdt-pad-l') }));
  expect(off.cls).toBe(false); expect(off.v).toBe('');
});

/* ── PNG 픽셀: 제품 파이프라인(prepareCloneForCapture)으로 클론을 세워 «브라우저가 직접» 찍는다 ── */
async function pngPixels(page, pts) {
  await page.evaluate(async () => {
    const ex = await import('/js/io/export-image.js');
    document.getElementById('__fpclone')?.remove();
    const sec = document.getElementById('sec1');
    const clone = await ex.prepareCloneForCapture(sec, 860, true);
    ex.renderComponentsInClone(clone);
    document.body.appendChild(clone);   // 배율 래퍼·앱 UI 밖 맨 위로 — 찍는 것은 «클론 그 자체»
    clone.id = '__fpclone'; clone.style.position = 'fixed'; clone.style.zIndex = '2147483647'; clone.style.transform = 'none'; clone.style.top = '0px'; clone.style.left = '0px'; clone.style.background = '#ffffff';
    clone.getBoundingClientRect();
  });
  await page.evaluate(() => document.getElementById('proj-loading-overlay')?.remove());
  const shot = await page.locator('#__fpclone').screenshot({ type: 'png' });
  if (process.env.FP_SHOT) require('fs').writeFileSync(process.env.FP_SHOT, shot);
  return page.evaluate(async ([b64, pts]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
    return pts.map(p => [...ctx.getImageData(p[0], p[1], 1, 1).data].slice(0, 3));
  }, [shot.toString('base64'), pts]);
}
const isc = (got, want, tol = 6) => got.every((v, i) => Math.abs(v - want[i]) <= tol);

test('P1 ★PNG: 스택 프레임 좌우 패딩 60 — 왼쪽 60px 는 프레임 색(여백), 그 안쪽부터 에셋(파랑)', async ({ page }) => {
  await setup(page, { free: false, kid: STACK_ASSET });
  await setPad(page, 'ss-padx-num', 60);
  await page.waitForTimeout(600);
  const g = await page.evaluate(() => { const ss = document.getElementById(window.__ss), sc = document.getElementById('sec1').getBoundingClientRect();
    const r = ss.getBoundingClientRect(); const z = r.width / ss.offsetWidth; return { x0: (r.left - sc.left) / z, y: (document.getElementById('k').getBoundingClientRect().top - sc.top) / z + 20 }; });
  const [pad, inside] = await pngPixels(page, [[Math.round(g.x0 + 30), Math.round(g.y)], [Math.round(g.x0 + 60 + 20), Math.round(g.y)]]);
  expect(isc(pad, [255, 0, 0]), `여백 자리 ${pad}`).toBe(true);
  expect(isc(inside, [0, 0, 255]), `에셋 자리 ${inside}`).toBe(true);
});

test('P2 ★PNG: 자유 프레임 우측 정렬 + 좌우 패딩 60 — 오른쪽 60px 는 프레임 색', async ({ page }) => {
  await setup(page, { free: true, kid: ASSET });
  await setPad(page, 'ss-padx-num', 60);
  await press(page, 'ss-align-right');
  await page.waitForTimeout(600);
  const g = await page.evaluate(() => { const ss = document.getElementById(window.__ss), sc = document.getElementById('sec1').getBoundingClientRect();
    const r = ss.getBoundingClientRect(); const z = r.width / ss.offsetWidth; const k = document.getElementById('k').getBoundingClientRect();
    return { x1: (r.right - sc.left) / z, y: (k.top - sc.top) / z + 20 }; });
  const [pad, inside] = await pngPixels(page, [[Math.round(g.x1 - 30), Math.round(g.y)], [Math.round(g.x1 - 60 - 20), Math.round(g.y)]]);
  expect(isc(pad, [255, 0, 0]), `여백 자리 ${pad}`).toBe(true);
  expect(isc(inside, [0, 0, 255]), `에셋 자리 ${inside}`).toBe(true);
});

/* ── 적대QA(opus) 후속 — 폭 100% 로 «들어가는» 자식은 안쪽 상자 폭을 쓴다 ──
 * fb3bce51 은 left 만 패딩만큼 들이고 폭은 100% 로 둬서, 패딩 40 이면 오른쪽 끝이 900(프레임 860 밖 40px),
 * 폭 200·패딩 100 이면 100~300 으로 100px 가 밖이었다. 가운데 정렬 글은 안쪽 가운데보다 40px 오른쪽에 섰다. */
for (const [fw, pad] of [[860, 40], [200, 100]]) {
  test(`N1 ★자유 프레임 폭 ${fw}·좌우 패딩 ${pad} 에 글 상자 — 오른쪽 끝 ≤ 폭−패딩, 가운데는 안쪽 상자 가운데`, async ({ page }) => {
    await setup(page, { free: true, kid: '' });
    await page.evaluate(({ fw, pad }) => { const ss = document.getElementById(window.__ss);
      ss.style.width = fw + 'px'; ss.dataset.width = String(fw); ss.style.paddingLeft = ss.style.paddingRight = pad + 'px'; ss.dataset.padX = String(pad);
      window._activeFrame = ss; window.addTextBlock?.('body'); }, { fw, pad });
    await page.waitForTimeout(250);
    const r = await page.evaluate(() => {
      const ss = document.getElementById(window.__ss); const kid = [...ss.children].find(c => c.style.position === 'absolute');
      if (!kid) return null;
      const fr = ss.getBoundingClientRect(), kr = kid.getBoundingClientRect(), sc = fr.width / ss.offsetWidth || 1;
      return { left: (kr.left - fr.left) / sc - ss.clientLeft, right: (kr.right - fr.left) / sc - ss.clientLeft, cw: ss.clientWidth, w: kid.offsetWidth };
    });
    expect(r, '전제: 글 상자가 들어갔다').not.toBeNull();
    expect(r.right, `오른쪽 끝 ${r.right} 이 안쪽 상자 끝 ${r.cw - pad} 을 넘었다`).toBeLessThanOrEqual(r.cw - pad + 1);
    expect(r.left).toBeGreaterThanOrEqual(pad - 1);
    expect(Math.abs((r.left + r.right) / 2 - r.cw / 2), '가운데 정렬 글이 안쪽 상자 가운데').toBeLessThanOrEqual(1);
  });
}
