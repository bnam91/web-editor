/* handle-escape-hittest.dom.spec.js — 「도형·그라데이션 모서리 손잡이가 보이는데 안 눌린다」 [0921F-handle]
 *
 * ★현빈 신고(2026-09-21): 도형의 «아래쪽» 모서리 손잡이가 이웃 블럭에 덮여 안 잡힌다.
 *   실앱 실측(9515, 줌 40·100 양쪽): se 손잡이 7×7 중 위 2행만 잡히고(10/25) 아래는 다음 블럭이
 *   가져간다 — 한가운데를 끌면 100×100 그대로, «2px 위»를 끌면 커진다.
 *
 * ★뿌리는 «손잡이 z-index 가 낮아서»가 아니다. 손잡이는 z-index:10 인데도 진다 —
 *   부모(.shape-block.selected{z-index:2} · .gradient-block 인라인 z-index:2)가 쌓임맥락을
 *   만들어 그 10 이 부모 «안»에 갇히기 때문이다. 그래서 «부모의 2» 대 «이웃의 2»가 되고,
 *   같으면 DOM 뒤가 이긴다. 손잡이는 상자 밖으로 3.5px 나오는데 그 반쪽이 이웃 상자 안이다.
 *
 * ★고침 = js/overlay-handles.js 의 «손잡이 탈출층» — 선택된 동안 손잡이를 다른 모든 블럭
 *   타입이 이미 쓰는 자리(#ss-handles-overlay)로 옮기고 자리는 rAF(_cornerScreen)가 좇는다.
 *   전수표(블럭 타입 17종 × 줌 40/100, 진짜 이웃을 덮어 놓고 elementFromPoint): 고치기 전
 *   도형 2종·그라데이션만 새고 나머지 14종은 0건 → 고친 뒤 34행 전부 0건.
 *
 * ⛔9/20 규약(선택 UI 는 모달·플로팅 패널 «아래») 유지 — G4 가 그걸 잡는다.
 * ⛔앱을 «안» 띄운다. 정본 패턴 = tests/dom/overlay-zindex-hittest.dom.spec.js.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js handle-escape-hittest
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* 실앱의 뼈대만 옮겨 왔다 — #canvas-area(isolation) > #canvas-scaler > #canvas + #ss-handles-overlay.
   ★가림꾼은 «진짜 이웃 블럭»의 조건을 그대로 갖춘다: .text-block(z-index:2) · DOM 상 도형 «뒤» ·
     도형 아래 모서리 위에 겹침. 이것이 현빈 화면(세로로 쌓인 블럭)에서 일어나는 바로 그 배치다. */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<style>
  html, body { margin:0; height:100%; }
  #canvas-area { position:relative; height:100%; }
  #canvas-scaler { transform: scale(1); transform-origin: 0 0; --inv-zoom: 1; }
  #canvas { width:860px; }
  .section-block { position:relative; }
  .section-inner { position:relative; width:860px; }
  #wrap { position:relative; width:200px; height:100px; margin:80px 0 0 80px; }
  /* 자리는 부팅 때 도형 상자에서 «계산해» 넣는다 — 손으로 적은 좌표는 조용히 빗나간다(실제로 한 번 빗나갔다) */
  #occ { position:absolute; background:rgba(255,0,0,.25); }
</style></head><body>
<div id="canvas-area">
  <div id="canvas-scaler"><div id="canvas">
    <div class="section-block"><div class="section-inner">
      <div class="frame-block" id="wrap">
        <div class="shape-block selected" id="shp" data-shape-type="rectangle">
          <svg class="shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><rect width="100" height="100"></rect></svg>
          <div class="shape-handle nw" data-dir="nw"></div><div class="shape-handle ne" data-dir="ne"></div>
          <div class="shape-handle sw" data-dir="sw"></div><div class="shape-handle se" data-dir="se"></div>
        </div>
      </div>
      <!-- ★DOM 상 도형 «뒤» + 아래 모서리 위에 겹치는 진짜 블럭 -->
      <div class="text-block" id="occ"><div class="tb-h2">이웃</div></div>
    </div></div>
  </div></div>
  <div id="ss-handles-overlay"></div>
</div>
<!-- 9/20 규약 대조군: #canvas-area «밖»의 플로팅 패널(실제 #fp-plugin-panel 급 z-index) -->
<div id="fakepanel" style="position:fixed;z-index:499;background:#123;display:none"></div>
<script src="/js/feature-flags.js"></script>
<script type="module">
  import '/js/overlay-handles.js';
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  // 가림꾼을 «도형 아래 모서리 띠» 위에 정확히 올린다(두 아래 모서리를 다 덮게)
  await page.evaluate(() => {
    const w = document.getElementById('wrap'), o = document.getElementById('occ');
    o.style.left = (w.offsetLeft - 20) + 'px';
    o.style.top = (w.offsetTop + w.offsetHeight - 6) + 'px';
    o.style.width = (w.offsetWidth + 40) + 'px';
    o.style.height = '40px';
  });
  await page.waitForFunction(() => window.__handleEscape && window.__handleEscape.size === 4);
  return errs;
}

/** 손잡이 한가운데에서 elementFromPoint 가 «그 손잡이»를 돌려주는가 + 7×7 중 몇 점이 잡히는가 */
async function hit(page, dir) {
  return page.evaluate((d) => {
    const h = [...document.querySelectorAll('.shape-handle.' + d)].find((x) => x.getBoundingClientRect().width > 0);
    if (!h) return { err: 'no handle' };
    const r = h.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    let n = 0;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
      const e = document.elementFromPoint(r.left + r.width * (i + 0.5) / 5, r.top + r.height * (j + 0.5) / 5);
      if (e && (e === h || h.contains(e))) n++;
    }
    return {
      ok: !!top && (top === h || h.contains(top)),
      /* ★가림꾼은 «블럭»으로 센다 — 실앱에서도 잡히는 것은 .text-block 자신이 아니라 그 안의
         .tb-h2 였다(현빈 신고의 그 문자열). 어느 쪽이 잡히든 뜻은 «이웃 블럭에 뺏겼다» 하나다. */
      blocker: top ? ((top.closest && top.closest('.text-block') && top.closest('.text-block').id)
                      || top.id || (typeof top.className === 'string' ? top.className.split(' ')[0] : top.tagName)) : 'null',
      cover: n, host: h.parentElement.id || h.parentElement.className,
      pe: getComputedStyle(h).pointerEvents,
    };
  }, dir);
}

test.describe('0921F-handle — 손잡이 가림', () => {
  test('G1 음성대조: 탈출층을 끄면 아래 모서리 손잡이가 «이웃 블럭»에게 뺏긴다(=고치기 전)', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate(() => window.__handleEscape.stop());
    await page.waitForFunction(() => document.querySelectorAll('#shp > .shape-handle').length === 4);
    for (const dir of ['sw', 'se']) {
      const r = await hit(page, dir);
      expect(r.host, `${dir}: 탈출층을 껐으니 손잡이는 블럭 «안»에 있어야 한다`).toBe('shp');
      expect(r.ok, `${dir}: 이 검사는 «빨강»이어야 한다 — 안 빨갛다면 재현 배치가 틀린 것이다`).toBe(false);
      expect(r.blocker, `${dir}: 뺏어가는 쪽이 이웃 텍스트 블럭이어야 한다`).toBe('occ');
      expect(r.cover, `${dir}: 7×7 중 일부만 잡힌다(전부 잡히면 재현이 아니다)`).toBeLessThan(25);
    }
    // 위 모서리는 겹침이 없어 멀쩡하다 — «아래만» 새는 결함이라는 축을 같이 못박는다
    expect((await hit(page, 'nw')).ok).toBe(true);
    expect(errs, JSON.stringify(errs)).toEqual([]);
  });

  test('G2 고친 뒤: 네 모서리 전부 «그 손잡이»가 잡힌다(7×7 25/25)', async ({ page }) => {
    const errs = await boot(page);
    for (const dir of ['nw', 'ne', 'sw', 'se']) {
      const r = await hit(page, dir);
      expect(r.host, `${dir}: 손잡이는 고정층으로 «탈출»해 있어야 한다`).toBe('ss-handles-overlay');
      expect(r.ok, `${dir}: 한가운데가 안 잡힌다`).toBe(true);
      expect(r.cover, `${dir}: 7×7 전부 잡혀야 한다`).toBe(25);
    }
    expect(errs, JSON.stringify(errs)).toEqual([]);
  });

  test('G3 탈출한 손잡이는 pointer-events:auto 다 (고정층은 none 이라 안 켜면 «아예» 안 잡힌다)', async ({ page }) => {
    await boot(page);
    const r = await hit(page, 'se');
    expect(getComputedStyleValue(r)).toBe('auto');
    function getComputedStyleValue(x) { return x.pe; }
    // 자리도 «상자 꼭지점»에 있어야 한다 — 고정층은 캔버스 배율 밖이라 좌표를 JS 가 준다
    const d = await page.evaluate(() => {
      const b = document.getElementById('shp').getBoundingClientRect();
      const h = [...document.querySelectorAll('#ss-handles-overlay > .shape-handle.se')][0].getBoundingClientRect();
      return { dx: Math.abs(h.left + h.width / 2 - b.right), dy: Math.abs(h.top + h.height / 2 - b.bottom), w: h.width };
    });
    expect(d.w).toBe(7);
    expect(d.dx).toBeLessThan(0.6);
    expect(d.dy).toBeLessThan(0.6);
  });

  test('G4 ⛔9/20 규약 — 손잡이는 플로팅 패널 «아래»다(캔버스 밖으로 안 올라온다)', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
      const h = [...document.querySelectorAll('#ss-handles-overlay > .shape-handle.se')][0];
      const b = h.getBoundingClientRect();
      const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      const p = document.getElementById('fakepanel');
      Object.assign(p.style, { display: 'block', left: (cx - 50) + 'px', top: (cy - 50) + 'px', width: '100px', height: '100px' });
      const top = document.elementFromPoint(cx, cy);
      return { topId: top && top.id };
    });
    expect(r.topId, '플로팅 패널(z 499)이 손잡이보다 위여야 한다 — 아니면 0920b-zorder 회귀다').toBe('fakepanel');
  });

  test('G5 선택이 풀리면 손잡이는 집으로 돌아가고 고정층엔 하나도 안 남는다', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => document.getElementById('shp').classList.remove('selected'));
    await page.waitForFunction(() => window.__handleEscape.size === 0);
    const r = await page.evaluate(() => ({
      ov: document.querySelectorAll('#ss-handles-overlay > .shape-handle').length,
      inBlock: document.querySelectorAll('#shp > .shape-handle').length,
      visible: [...document.querySelectorAll('#shp > .shape-handle')].filter((h) => h.getBoundingClientRect().width > 0).length,
      mark: !!document.getElementById('shp').__handlesEscaped,
    }));
    expect(r).toEqual({ ov: 0, inBlock: 4, visible: 0, mark: false });
  });
});
