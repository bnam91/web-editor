/* qa0920b-redact-overlay-z.dom.spec.js — 0920b 통합 QA 반영(high, 프라이버시).
 *
 * ★무엇이 깨졌나 — T-052 가 «가림막 도형도 오버레이로 띄울 수 있게» 만들면서, 같은 라운드의
 *   css/editor-blocks.css `.section-block > [data-overlay-block="true"] { z-index:80 !important }`
 *   가 «오버레이 전부»를 한 층에 올렸다. 그 결과 프라이버시 보장이던
 *   `.shape-block.shape-redact { z-index:3 !important }` 가 오버레이 블록에는 무력해지고,
 *   z 가 같아지면 «나중에 띄운 것»(섹션 직속 마지막 자식)이 무조건 이긴다 —
 *   가림막 위에 글자를 띄우면 가림이 «풀린다»(화면·PNG·Figma 순서에 그대로 실린다).
 *
 * ★이 파일이 지키는 것
 *   R1 가림막 오버레이 «위»에 다른 오버레이를 나중에 띄워도 가림막이 이긴다(elementFromPoint).
 *   R1-b [음성대조] 가림막 승격 규칙을 끄면 R1 이 실제로 뒤집힌다(검사가 뭔가를 보고 있다).
 *   R2 가림막이 흐름(비오버레이)이고 글자가 오버레이면 — 이건 «가림막이 져도 되는» 자리가
 *      아니다: 가림막은 선택 여부·오버레이 여부와 무관하게 콘텐츠 위다.
 *   R3 가림막끼리·일반 오버레이끼리의 기존 순서(DOM 순)는 안 바뀐다(회귀 방지).
 *
 * ⛔앱을 «안» 띄운다. 실행: npm run test:dom -- qa0920b-redact-overlay-z
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const BLOCKS_CSS = fs.readFileSync(path.join(REPO, 'css/editor-blocks.css'), 'utf8');
const LAYOUT_CSS = fs.readFileSync(path.join(REPO, 'css/editor-layout.css'), 'utf8');

/* 섹션 하나에 ⑴흐름 글자 ⑵가림막 도형(오버레이) ⑶글자 오버레이 순서로 «나중에» 붙는다.
   DOM 순서상 마지막이 글자라, z 가 같으면 글자가 이긴다 = 재현 조건. */
function harness({ killRedactZ = false } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8">
    <style>${LAYOUT_CSS}</style>
    <style>${BLOCKS_CSS}</style>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; }
      .section-block { position: relative; width: 500px; height: 300px; background: #fff; }
      .section-inner { position: relative; }
      ${killRedactZ ? '.section-block > .shape-block.shape-redact[data-overlay-block="true"], .section-block > [data-overlay-block="true"]:has(> .shape-block.shape-redact) { z-index: 80 !important; }' : ''}
    </style>
    </head><body>
    <div class="section-block" id="sec1">
      <div class="section-inner" id="inner1">
        <div class="text-block" id="flowtxt" style="position:relative;">흐름 글자 900101-1234567</div>
      </div>
      <!-- ⑵ 가림막 도형 오버레이 (래퍼 프레임에 띄우는 실제 구조) -->
      <div class="frame-block" data-free-layout="true" data-overlay-block="true" id="redwrap"
           style="position:absolute;left:0px;top:0px;width:300px;height:100px;">
        <div class="shape-block shape-redact" id="red1" data-shape-type="rectangle"
             data-shape-redact-mode="blur" style="position:absolute;left:0;top:0;width:100%;height:100%;"></div>
      </div>
      <!-- ⑶ «나중에» 띄운 글자 오버레이 — 같은 자리를 덮는다 -->
      <div class="frame-block" data-text-frame="true" data-overlay-block="true" id="txtwrap"
           style="position:absolute;left:0px;top:0px;width:300px;height:100px;">
        <div class="text-block" id="ovtxt">떠 있는 글자 900101-1234567</div>
      </div>
    </div>
    </body></html>`;
}

async function boot(page, opts = {}) {
  await page.route(`${ORIGIN}/**`, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: harness(opts) }));
  await page.goto(`${ORIGIN}/__harness.html`);
}

/** 겹친 한 점에서 «맨 위»가 가림막 쪽인가. */
const topAt = (page, x, y) => page.evaluate(([px, py]) => {
  const el = document.elementFromPoint(px, py);
  return { id: el?.id || '', cls: el?.className || '', inRedact: !!el?.closest('#redwrap') };
}, [x, y]);

test('R1 ★가림막 오버레이 위에 다른 오버레이를 나중에 띄워도 가림막이 이긴다', async ({ page }) => {
  await boot(page);
  const hit = await topAt(page, 150, 50);
  expect(hit.inRedact, `가림이 풀렸다 — 맨 위가 ${hit.id || hit.cls}`).toBe(true);
});

test('R1-b [음성대조] 가림막 승격을 끄면 R1 이 뒤집힌다 (검사가 실제로 z 를 본다)', async ({ page }) => {
  await boot(page, { killRedactZ: true });
  const hit = await topAt(page, 150, 50);
  expect(hit.inRedact, '음성대조가 재현 안 됐다 — 승격을 껐는데도 가림막이 이겼다면 R1 은 아무것도 안 본다').toBe(false);
});

test('R2 가림막의 computed z 가 다른 오버레이보다 «높다»', async ({ page }) => {
  await boot(page);
  const z = await page.evaluate(() => ({
    red: getComputedStyle(document.getElementById('redwrap')).zIndex,
    txt: getComputedStyle(document.getElementById('txtwrap')).zIndex,
  }));
  expect(Number(z.red)).toBeGreaterThan(Number(z.txt));
});

test('R3 일반 오버레이끼리는 기존 순서(DOM 순 · 같은 층)가 그대로다', async ({ page }) => {
  await boot(page);
  const z = await page.evaluate(() => {
    const sec = document.getElementById('sec1');
    const a = document.createElement('div');
    a.className = 'frame-block'; a.dataset.textFrame = 'true'; a.dataset.overlayBlock = 'true';
    a.style.cssText = 'position:absolute;left:0;top:150px;width:100px;height:40px;';
    sec.appendChild(a);
    return {
      a: getComputedStyle(a).zIndex,
      txt: getComputedStyle(document.getElementById('txtwrap')).zIndex,
    };
  });
  expect(z.a).toBe('80');
  expect(z.txt).toBe('80');
});
