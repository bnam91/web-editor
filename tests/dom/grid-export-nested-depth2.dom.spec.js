/* grid-export-nested-depth2.dom.spec.js — 0.9.4 가 «새로 만든 것»을 내보내기 축에서 잰다 (2026-09-28)
 *
 * ★왜 세우나 — 현빈 릴리스 게이트 질문: 「그리드 블럭 ★종류별 내보내기 테스트는 했을까?」
 *   세어 보니 줄 종류 전수(label h1 h2 h3 body caption image gap duo graph ＋ 뱃지)는
 *   `grid-save-export-axes.dom.spec.js`(T-173) 가 이미 픽셀로 잠근다 — 12/12 초록.
 *   ⇒ ★그 자가 «안 재는» 것만 여기서 잰다. 그게 하필 0.9.4 가 새로 만든 둘이다:
 *     ㈎ ★깊이 2 중첩(duo 안 duo 안 줄) — T-173 판은 깊이 1 까지다.
 *        ⚠️이건 «안 그려질 것»이 아니다. 가드가 `depth >= GRID_NESTED_MAX_DEPTH(2)` 라
 *          duo(0)·duo-안-duo(1) 이 통과하고 그 자식이 depth 2 로 ★그려진다
 *          (그 산수를 재는 자 = tests/unit/grid-nested-create N7).
 *        ⇒ 화면에 그려지는 것이 «내보낸 그림»에도 나오는가 — 아무도 안 쟀다.
 *     ㈏ ★⠿ 줄 손잡이(T-228) — 내가 커밋 머리말에 「오버레이라 내보내기에 안 나온다」고
 *        ★«주장»했다. ⛔주장은 검사가 아니다. 그 주장을 여기서 픽셀과 DOM 두 겹으로 잰다.
 *
 * ★무엇을 잠그나
 *   X0  계측기 — 캡처가 백지가 아니고 팔레트가 서로 안 겹친다
 *   X1  ★★깊이 2 중첩 «글자»가 내보낸 그림에 나온다
 *   X2  ★★깊이 1·2 중첩 «안»의 그림 줄이 내보낸 그림에 나온다 (T-173 은 깊이 0 만 쟀다)
 *   X3  ★★⠿ 손잡이는 내보낸 그림에 ★안 나온다 — ⛔단, «화면엔 떠 있는» 상태에서 잰다
 *   X4  ★★손잡이가 클론 DOM 에 아예 «실리지 않는다» (색이 우연히 안 잡힌 것이 아님)
 *   P1  ★★음성대조 — 깊이 2 글자색을 «모델에서» 빼면 그림에서 사라진다
 *
 * ⚠️못 닿는 곳(정직하게) — ⑴ 저장 대화상자·html2canvas 폴백 경로는 안 지난다(T-173 과 같은 한계).
 *   ⑵ 손잡이 색은 제품 CSS 가 아니라 이 검사가 박은 것이다 — 재는 것은 「그 요소가 클론에
 *      실리는가」이지 「제품이 그 색을 쓴다」가 아니다. X4 가 그 자리를 DOM 으로 한 겹 더 잠근다.
 *
 * ⛔앱을 «안» 띄운다. 실행: npm run test:dom -- grid-export-nested-depth2
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
               '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml' };

/* ★내보내기는 색을 한두 눈금 움직인다(T-173 실측) ⇒ 정확일치로 세면 멀쩡한 걸 결함으로 적는다. */
const TOL = 4;

/* ⛔서로 «먼» 색만. X0 이 겹침을 먼저 본다 — 겹치면 한 색이 두 자리를 한 자리로 센다. */
const C = {
  d1Txt:  '#7700cc',   // 깊이 1 중첩 글자
  d2Txt:  '#00a0ff',   // ★깊이 2 중첩 글자 — 이 판의 주인공
  d1Img:  '#ff8800',   // 깊이 1 중첩 «안»의 그림
  d2Img:  '#00cc44',   // 깊이 2 중첩 «안»의 그림
  cell:   '#202060',   // 칸 배경(자리 확인용)
  grip:   '#ff0099',   // ★⠿ 손잡이 — 그림에 ★0 이어야 한다
};

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<style>html,body{margin:0;padding:0;background:#fff}
  /* ★손잡이를 «눈에 띄는 색»으로 — 제품 CSS 가 아니라 이 검사의 자다(파일 머리 한계 참조). */
  #ss-handles-overlay .grd-line-grip{background:${C.grip} !important;color:${C.grip} !important;}
</style></head><body>
<div id="canvas"><div class="section-block" id="sec1" style="width:860px;background:#ffffff"><div class="section-inner" id="host"></div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<div id="ss-handles-overlay"></div>
<script src="/js/io/section-serialize.js"></script>
<script src="/js/design-system.js"></script>
<script type="module">
  import '/js/globals.js';
  import { makeGridBlock, renderGridBlock, getGridModel, updateGridBlock } from '/js/blocks/grid-block.js';
  import { grdSetActiveLine } from '/js/props/prop-grid.js';
  import { showGridLineGrip } from '/js/overlay-handles.js';
  const ex = await import('/js/io/export-image.js');
  window.__mk = makeGridBlock;
  window.__render = renderGridBlock;
  window.__model = getGridModel;
  window.__update = updateGridBlock;
  window.__setActive = grdSetActiveLine;
  window.__grip = showGridLineGrip;
  window.__prepare = ex.prepareCloneForCapture;
  window.__renderInClone = ex.renderComponentsInClone;
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  await page.evaluate(([c, tol]) => { window.__C = c; window.__TOL = tol; }, [C, TOL]);
  return errs;
}

/* ══ 판 — 깊이 2 까지 내려가는 중첩 한 벌 ════════════════════════════════
   칸(0,0) 줄[0] = 바깥 글자(손잡이를 여기에 띄운다)
   칸(0,0) 줄[1] = duo(깊이1)
        └ 왼칸: 글자(d1Txt) ＋ 그림(d1Img)
        └ 오른칸: duo(깊이2)
              └ 왼칸: 글자(d2Txt) ★주인공
              └ 오른칸: 그림(d2Img)
   ⛔줄이거나 늘리면 X0·X1 이 먼저 빨개진다 — 그게 이 판의 자기 검사다. */
const PLANT = () => {
  const C = window.__C;
  const png = (hex, w, h) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d'); cx.fillStyle = hex; cx.fillRect(0, 0, w, h);
    return cv.toDataURL('image/png');
  };
  const HOST = document.getElementById('host');
  HOST.innerHTML = '';
  const { row, block } = window.__mk({ cols: [{ width: 1 }] });
  HOST.appendChild(row);
  const ID = block.id;
  const ops = [
    window.__update(ID, { rows: [{ height: 'auto' }] }),
    window.__update(ID, { cells: [[{
      bg: C.cell, padding: 16, radius: 8,
      lines: [
        { type: 'h2', text: 'OUTER', color: '#ffffff' },
        { type: 'duo', gap: 12, cols: [
          { width: 1, lines: [
            { type: 'body', text: 'D1-TXT', color: C.d1Txt },
            { type: 'image', imgSrc: png(C.d1Img, 120, 80), height: 60 },
          ] },
          { width: 1, lines: [
            { type: 'duo', gap: 8, cols: [
              { width: 1, lines: [{ type: 'body', text: 'D2-TXT', color: C.d2Txt }] },
              { width: 1, lines: [{ type: 'image', imgSrc: png(C.d2Img, 120, 80), height: 50 }] },
            ] },
          ] },
        ] },
      ],
    }]] }),
  ];
  block.classList.add('selected');
  window.__block = block;
  const q = (sel) => block.querySelectorAll(sel).length;
  return {
    ID, ops,
    screen: {
      d1: q('[data-nroot="1"][data-npath="0.0"]'),        // 깊이1 글자
      d2: q('[data-nroot="1"][data-npath="1.0/0.0"]'),    // ★깊이2 글자
      nested: q('.grd-nested'),
      imgs: q('img'),
    },
  };
};

async function plant(page) {
  await page.evaluate((src) => { window.__PLANT = src; }, PLANT.toString());
  return page.evaluate(() => (window.__plantResult = eval('(' + window.__PLANT + ')()')));
}

/** 그 줄을 골라 ⠿ 손잡이를 띄운다. @returns 화면에 뜬 손잡이 개수 */
function raiseGrip(page) {
  return page.evaluate(() => {
    window.__setActive(window.__block, { r: 0, c: 0, li: 0 });
    window.__grip(window.__block);
    const gs = [...document.querySelectorAll('#ss-handles-overlay .grd-line-grip')]
      .filter(g => getComputedStyle(g).display !== 'none');
    return gs.length;
  });
}

/** 제품의 캡처 파이프라인을 그대로 지나 픽셀을 센다 (T-173 과 같은 자). */
async function exportPixels(page, { strip } = {}) {
  await page.evaluate(async (stripSrc) => {
    document.getElementById('__d2clone')?.remove();
    const sec = document.getElementById('sec1');
    if (stripSrc) eval('(' + stripSrc + ')()');
    const clone = await window.__prepare(sec, 860, true);
    window.__renderInClone(clone);
    clone.id = '__d2clone';
    clone.style.top = '0px';
    clone.style.left = '0px';
    clone.style.background = '#ffffff';
    clone.getBoundingClientRect();
    await Promise.all([...clone.querySelectorAll('img')].map(im =>
      im.complete ? Promise.resolve() : im.decode().catch(() => {})));
    window.__cloneH = Math.ceil(clone.getBoundingClientRect().height);
    /* ★X4 용 — 클론 «안»에 손잡이/오버레이가 실렸는지 DOM 으로 센다. */
    window.__cloneHas = {
      grip: clone.querySelectorAll('.grd-line-grip').length,
      overlay: clone.querySelectorAll('#ss-handles-overlay').length,
      nested: clone.querySelectorAll('.grd-nested').length,
    };
  }, strip ? strip.toString() : null);
  const h = await page.evaluate(() => window.__cloneH);
  await page.setViewportSize({ width: 1000, height: Math.min(4000, Math.max(200, h + 40)) });
  const shot = await page.locator('#__d2clone').screenshot({ type: 'png' });
  const px = await page.evaluate(async ([b64, want, tol]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
    const keys = Object.keys(want), tgt = keys.map(k => hex(want[k]));
    const clash = [];
    for (let a = 0; a < tgt.length; a++) for (let b = a + 1; b < tgt.length; b++) {
      const dist = Math.max(...[0, 1, 2].map(i => Math.abs(tgt[a][i] - tgt[b][i])));
      if (dist <= 2 * tol) clash.push(`${keys[a]}~${keys[b]}(${dist})`);
    }
    const n = {}; keys.forEach(k => n[k] = 0);
    let nonwhite = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (!(r > 250 && g > 250 && b > 250)) nonwhite++;
      for (let j = 0; j < tgt.length; j++) {
        if (Math.abs(r - tgt[j][0]) <= tol && Math.abs(g - tgt[j][1]) <= tol && Math.abs(b - tgt[j][2]) <= tol) { n[keys[j]]++; break; }
      }
    }
    return { w: img.width, h: img.height, nonwhite, clash, px: n };
  }, [shot.toString('base64'), C, TOL]);
  px.cloneHas = await page.evaluate(() => window.__cloneHas);
  return px;
}

test.describe('0.9.4 새 축의 내보내기 (깊이 2 중첩 · ⠿ 손잡이)', () => {

  test('X0 ★계측기 — 판이 깊이 2 까지 «화면»으로 만들고, 캡처가 백지가 아니다', async ({ page }) => {
    const errs = await boot(page);
    const r = await plant(page);
    expect(r.ops.every(o => o.ok), `판 깔기 실패: ${JSON.stringify(r.ops)}`).toBe(true);
    expect(r.screen.d1, '깊이 1 글자가 화면에 없다').toBe(1);
    expect(r.screen.d2, '★깊이 2 글자가 화면에 없다 — 이게 0 이면 아래 초록은 전부 헛것이다').toBe(1);
    expect(r.screen.nested, '중첩 셸이 둘이어야 한다(깊이1·깊이2)').toBe(2);
    expect(r.screen.imgs, '중첩 안 그림 둘').toBe(2);
    const e = await exportPixels(page);
    expect(e.clash, `★팔레트가 겹친다: ${e.clash.join(' · ')}`).toEqual([]);
    expect(e.w, '캡처 폭이 860 이 아니다').toBe(860);
    expect(e.nonwhite, '백지가 나왔다').toBeGreaterThan(5000);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('X1 ★★깊이 2 중첩 «글자»가 내보낸 그림에 나온다', async ({ page }) => {
    const errs = await boot(page);
    await plant(page);
    const e = await exportPixels(page);
    expect(e.px.d2Txt,
      `★화면엔 있는데 «내보낸 그림»엔 깊이 2 글자가 없다.\n` +
      `   센 법: ${e.w}×${e.h} PNG 에서 ${C.d2Txt} ±${TOL} 화소 수 · 잰 값 ${JSON.stringify(e.px)}`)
      .toBeGreaterThan(10);
    expect(e.px.d1Txt, '깊이 1 글자도 같이 잰다(대조)').toBeGreaterThan(10);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('X2 ★★중첩 «안»의 그림 줄이 깊이 1·2 둘 다 내보낸 그림에 나온다', async ({ page }) => {
    const errs = await boot(page);
    await plant(page);
    const e = await exportPixels(page);
    const bad = ['d1Img', 'd2Img'].filter(k => e.px[k] < 300);
    expect(bad, `★중첩 안 그림이 내보내기에서 빠졌다 · 잰 값 ${JSON.stringify(e.px)}`).toEqual([]);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('X3 ★★⠿ 손잡이는 «화면엔 떠 있는데» 내보낸 그림엔 안 나온다', async ({ page }) => {
    const errs = await boot(page);
    await plant(page);
    const up = await raiseGrip(page);
    expect(up, '★손잡이가 화면에 안 떴다 — 그러면 아래 «0» 은 아무것도 증명 못 한다').toBe(1);
    const e = await exportPixels(page);
    expect(e.px.grip,
      `★내보낸 그림에 손잡이 색이 ${e.px.grip}px 찍혔다 — 편집 보조물이 산출물에 샜다.`)
      .toBe(0);
    /* ★같은 찍기에서 «있어야 할 것»도 같이 세어 둔다 — 캡처가 통째로 죽어서 0 이 나온 게 아니다. */
    expect(e.px.d2Txt, '양성대조: 같은 그림에 깊이2 글자는 있다').toBeGreaterThan(10);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('X4 ★★손잡이·오버레이가 클론 DOM 에 아예 실리지 않는다', async ({ page }) => {
    const errs = await boot(page);
    await plant(page);
    expect(await raiseGrip(page)).toBe(1);
    const e = await exportPixels(page);
    expect(e.cloneHas.grip, '★클론 안에 손잡이 요소가 있다').toBe(0);
    expect(e.cloneHas.overlay, '★클론 안에 핸들 오버레이가 있다').toBe(0);
    expect(e.cloneHas.nested, '양성대조: 클론이 중첩 둘을 담고 있다(빈 클론이 아니다)').toBe(2);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('P1 ★★음성대조 — 깊이 2 글자색을 «모델에서» 빼면 그림에서 사라진다', async ({ page }) => {
    const errs = await boot(page);
    const r = await plant(page);
    await page.evaluate((id) => { window.__GID = id; }, r.ID);
    const full = await exportPixels(page);
    expect(full.px.d2Txt, '★변조 «전»에 이미 0 이다 — 이 대조는 아무것도 증명 못 한다').toBeGreaterThan(10);
    const stripped = await exportPixels(page, {
      strip: () => {
        const g = document.getElementById(window.__GID);
        const m = window.__model(g);
        /* ★깊이 2 글자 줄의 color 만 «모델에서» 뺀다 — 표식을 지우는 게 아니다.
           ⛔★행 0 의 «줄»은 cells 가 아니라 cols[c].lines 에 산다(T-173 이 주석으로 적어 둔
             그 함정). 처음엔 cells 만 벗겨 「뺐는데 203px 남았다」가 났고, 그건 제품이 아니라
             내 변조가 반쪽이었던 것이다. ⇒ 두 자리 다 벗기고, «몇 군데 벗겼나»를 돌려준다. */
        const peel = (lines) => {
          const d2 = lines && lines[1] && lines[1].cols && lines[1].cols[1]
            && lines[1].cols[1].lines && lines[1].cols[1].lines[0]
            && lines[1].cols[1].lines[0].cols && lines[1].cols[1].lines[0].cols[0]
            && lines[1].cols[1].lines[0].cols[0].lines[0];
          if (d2 && d2.color) { delete d2.color; return 1; }
          return 0;
        };
        const cols  = JSON.parse(JSON.stringify(m.cols));
        const cells = JSON.parse(JSON.stringify(m.cells));
        let hit = 0;
        hit += peel(cols[0] && cols[0].lines);
        hit += peel(cells[0] && cells[0][0] && cells[0][0].lines);
        window.__peeled = hit;
        g.dataset.cols  = JSON.stringify(cols);
        g.dataset.cells = JSON.stringify(cells);
        window.__render(g);
      },
    });
    /* ★변조가 «닿았는지»를 먼저 잰다 — 안 닿았으면 아래 0 은 제품이 아니라 내 손의 결과다. */
    expect(await page.evaluate(() => window.__peeled),
      '★벗길 자리를 한 군데도 못 찾았다 — 이 대조는 제품을 안 쟀다').toBeGreaterThan(0);
    expect(stripped.px.d2Txt,
      `★모델에서 뺐는데 그림에 ${stripped.px.d2Txt}px 남았다 — 이 자는 «그림»이 아니라 다른 걸 세고 있다`)
      .toBeLessThan(5);
    expect(stripped.px.d1Txt, '대조: 안 건드린 깊이 1 글자는 그대로다').toBeGreaterThan(10);
    expect(errs, errs.join('\n')).toEqual([]);
  });
});
