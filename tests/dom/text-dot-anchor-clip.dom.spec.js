/* text-dot-anchor-clip — T4-02 위험 재기: 점(::before)의 담는 상자가 span → «가장 가까운 positioned 조상»으로 바뀌었다.
 *   그 사이에 overflow 가 visible 아닌(자르는) positioned 아닌 조상이 있으면, 예전엔 잘리던 점이 이제 넘친다.
 *   ⇒ 그 «사이»를 실물 자리 셋에서 잰다 — 텍스트 블럭(둥근 프레임 안) · 그리드 줄(row 안) · 인용구 줄.
 *   S0 ★구조 불변식 — span 부모 ~ offsetParent(앵커 점의 담는 상자) «사이»에 자르는 조상 0
 *   S1 점 자리 — 점마다 제 글자 가운데 ±2px(빨강 덩이 중심 ↔ span 가운데)
 *   S2 잘림 유지 — 점을 자르는 상자 밖으로 밀면 그 띠에 빨강 0 · [양성대조] 그 상자의 자르기를 풀면 빨강 > 0(띠가 넘침을 잡는 자임)
 *     A 둥근 프레임(data-radius 24 · 자름) 위로 −60px(프레임 위변 밖 · 섹션 위 패딩 안) · B·C 섹션 가로 자르기(.section-inner overflow-x:clip) 왼쪽으로 −3000px
 * ⛔못 재는 것: 실물에 없는 꼴(positioned 아닌 overflow:hidden 그릇 안의 점 글자) — S0 이 실물 자리에서 «그 꼴이 없음»을 잰다.
 *   (훑은 자르는 그릇: laurel-cell·zoom-text·mkp-screen·joker-block-inner·icb-circle·chb-profile-* — 점 글자를 담는 줄 그릇이 아니다.)
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const WORD = 'PATENA';
const DOTVARS = '--tb-dot-color:#ff0000;--tb-dot-size:10px;--tb-dot-x:0px;--tb-dot-y:0px;--tb-dot-gap:0px;';
const dotHtml = () => [...WORD].map((ch, i) => `<span class="tb-dot" style="--tb-dot-i:${i - (WORD.length - 1) / 2}">${ch}</span>`).join('');

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1400 });
  const errs = await bootApp(page);
  await page.evaluate(([html, DOTVARS]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sA" data-section="1" style="background-color:#ffffff"><div class="section-hitzone"></div>
      <div class="section-inner" id="inA" style="padding:120px 40px 120px 40px">
        <div class="frame-block" id="frA" data-radius="24" style="border-radius:24px;height:160px;background:#eeeeee;"></div>
        <div class="gap-block" data-type="gap" style="height:160px"></div>
        <div class="row" id="rG" data-layout="stack"></div>
        <div class="gap-block" data-type="gap" style="height:160px"></div>
        <div class="row" id="rQ" data-layout="stack"></div>
      </div></div>`);
    window.rebindAll?.(); window.applyZoom?.(100);
    // A — 텍스트 블럭 (둥근 프레임 안)
    document.getElementById('sA').classList.add('selected');
    const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
    window.addTextBlock('h1', { content: 'x' });
    const tb = [...document.querySelectorAll('#canvas .text-block')].find(e => !before.has(e.id));
    tb.id = 'tA'; document.getElementById('frA').appendChild(tb);
    tb.style.cssText += DOTVARS;
    tb.querySelector('.tb-h1').innerHTML = html;
    // B — 그리드 줄 (row 안)
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: 'PATENA', textHtml: html }] }], rows: [{ height: 'auto' }] });
    g.id = 'gB'; document.getElementById('rG').appendChild(g); g.style.cssText += DOTVARS; window.renderGridBlock(g);
    // C — 인용구 줄
    const made = window.makeQuoteBlock({ text: 'PATENA' }); const q = made.block || made;
    q.id = 'qC'; document.getElementById('rQ').appendChild(q); window.renderQuoteBlock(q); q.style.cssText += DOTVARS;
    const line = q.querySelector('.tb-qt-line'); if (line) line.innerHTML = html;
    window.deselectAll?.();
    document.querySelectorAll('#canvas .selected, #canvas .editing').forEach(e => e.classList.remove('selected', 'editing'));
  }, [dotHtml(), DOTVARS]);
  return errs;
}
const HOSTS = { A: '#tA', B: '#gB', C: '#qC' };

/* 화면 전체를 찍어 rect 안 빨강 덩이 중심(x)들과 빨강 수 */
async function redIn(page, r) {
  const b64 = (await page.screenshot()).toString('base64');
  return page.evaluate(async ([s, r]) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode();
    const k = im.width / window.innerWidth;
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const X0 = Math.max(0, Math.round(r.x * k)), X1 = Math.min(im.width, Math.round((r.x + r.w) * k));
    const Y0 = Math.max(0, Math.round(r.y * k)), Y1 = Math.min(im.height, Math.round((r.y + r.h) * k));
    if (X1 <= X0 || Y1 <= Y0) return { n: 0, blobs: [] };
    const d = x.getImageData(X0, Y0, X1 - X0, Y1 - Y0).data, W = X1 - X0;
    let n = 0; const cols = new Array(W).fill(0);
    for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 70 && d[i + 2] < 70) { n++; cols[(i / 4) % W]++; }
    const blobs = []; let st = -1, sum = 0, ws = 0;
    for (let xx = 0; xx <= W; xx++) { const v = xx < W ? cols[xx] : 0;
      if (v) { if (st < 0) st = xx; sum += v; ws += v * xx; } else if (st >= 0) { blobs.push(+((ws / sum + X0) / k).toFixed(1)); st = -1; sum = 0; ws = 0; } }
    return { n, blobs };
  }, [b64, r]);
}
const rectOf = (page, sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, sel);

test('S0 ★구조 — 점 span ~ 담는 상자(offsetParent) 사이에 자르는 조상이 없다 (세 자리)', async ({ page }) => {
  const errs = await setup(page);
  const got = await page.evaluate((H) => Object.fromEntries(Object.entries(H).map(([k, sel]) => {
    const spans = [...document.querySelectorAll(`${sel} span.tb-dot`)];
    const bad = [];
    for (const sp of spans) {
      const cb = sp.offsetParent;
      for (let e = sp.parentElement; e && e !== cb; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') bad.push(`${e.className || e.tagName}(${cs.overflowX}/${cs.overflowY})`);
      }
    }
    const sp0 = spans[0];
    return [k, { n: spans.length, cb: sp0 && sp0.offsetParent ? (sp0.offsetParent.id || sp0.offsetParent.className) : null,
                 pos: sp0 ? getComputedStyle(sp0).position : null, bad: [...new Set(bad)] }];
  })), HOSTS);
  console.log('  S0', JSON.stringify(got));
  for (const [k, v] of Object.entries(got)) {
    expect(v.n, `${k} ★전제 — 점 span ${WORD.length}개`).toBe(WORD.length);
    expect(v.pos, `${k} 점 span 은 positioned 가 아니어야 한다(T4-02)`).toBe('static');
    expect(v.bad, `★${k} 점과 담는 상자(${v.cb}) 사이에 자르는 조상 — 예전엔 잘리던 점이 넘친다`).toEqual([]);
  }
  expect(errs).toEqual([]);
});

test('S1 점 자리 — 세 자리 모두 점마다 제 글자 가운데 ±2px', async ({ page }) => {
  await setup(page);
  for (const [k, sel] of Object.entries(HOSTS)) {
    const centers = await page.evaluate((s) => [...document.querySelectorAll(`${s} span.tb-dot`)].map(e => { const r = e.getBoundingClientRect(); return +(r.left + r.width / 2).toFixed(1); }), sel);
    const host = await rectOf(page, sel);
    const st = await redIn(page, { x: host.x - 20, y: host.y - 60, w: host.w + 40, h: host.h + 80 });
    console.log(`  S1 ${k} centers=${JSON.stringify(centers)} blobs=${JSON.stringify(st.blobs)}`);
    expect(st.blobs.length, `${k} 점 덩이 수`).toBe(WORD.length);
    st.blobs.forEach((b, i) => expect(Math.abs(b - centers[i]), `${k} 점 ${i} ${b} ↔ 글자 가운데 ${centers[i]}`).toBeLessThanOrEqual(2));
  }
});

test('S2 잘림 유지 — 자르는 상자 밖으로 민 점은 안 보인다 · [양성대조] 자르기를 풀면 보인다', async ({ page }) => {
  await setup(page);
  // A — 둥근 프레임 위로
  await page.evaluate(() => document.getElementById('tA').style.setProperty('--tb-dot-y', '-60px'));
  const fr = await rectOf(page, '#frA');
  const bandA = { x: fr.x, y: fr.y - 110, w: fr.w, h: 100 };   // 프레임 위 띠(섹션 위 패딩 120 안)
  const a = await redIn(page, bandA);
  await page.evaluate(() => document.getElementById('frA').dataset.clipContent = 'false');
  const aOpen = await redIn(page, bandA);
  await page.evaluate(() => delete document.getElementById('frA').dataset.clipContent);
  // B·C — 섹션 가로 자르기 왼쪽 밖으로
  const sec = await rectOf(page, '#sA');
  const res = {};
  for (const k of ['B', 'C']) {
    const sel = HOSTS[k];
    await page.evaluate((s) => document.querySelector(s).style.setProperty('--tb-dot-x', '-3000px'), sel);
    const h = await rectOf(page, sel);
    const band = { x: 0, y: h.y - 60, w: sec.x - 2, h: h.h + 60 };
    const clipped = await redIn(page, band);
    await page.evaluate(() => { document.getElementById('inA').style.overflowX = 'visible'; });
    const open = await redIn(page, band);
    await page.evaluate((s) => { document.getElementById('inA').style.overflowX = ''; document.querySelector(s).style.setProperty('--tb-dot-x', '0px'); }, sel);
    res[k] = { clipped: clipped.n, open: open.n };
  }
  console.log(`  S2 A clipped=${a.n} open=${aOpen.n} · ${JSON.stringify(res)}`);
  expect(aOpen.n, '★양성대조 A — 자르기를 풀어도 띠에 빨강이 없다(띠가 넘침을 못 잡는다)').toBeGreaterThan(30);
  expect(a.n, '★A 둥근 프레임 위로 민 점이 보인다 — 프레임이 점을 못 자른다(담는 상자가 프레임 밖)').toBe(0);
  for (const k of ['B', 'C']) {
    expect(res[k].open, `★양성대조 ${k} — 섹션 자르기를 풀어도 띠에 빨강이 없다`).toBeGreaterThan(30);
    expect(res[k].clipped, `★${k} 섹션 밖으로 민 점이 보인다 — 섹션이 점을 못 자른다`).toBe(0);
  }
});
