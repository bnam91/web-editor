/* sec-malicious-project-open.dom.spec.js — SEC-MALICIOUS-PROJECT-FILE-SANDBOX-01 «재현» (지디 발주 261112 · Codex 정적 감사 ②·③)
 *   ★이 파일은 «재현» 이다 — 지금(aded4a28a) 빨강이 «결함이 있다»는 뜻이고, 고친 뒤 초록이 되게 적었다.
 *   ⛔진짜 키·외부 전송 0: 악성 핸들러는 window.__pwned* 표식만 세운다 · 외부 주소는 page.route 로 «가로채 끊는다»(네트워크 0).
 *
 *   X1 ★② 열기만으로 실행 — tb-body 의 data-placeholder 에 «인코딩된» <img onerror> → applyProjectData → rebindAll 이
 *        빈 글 칸에 placeholder 를 innerHTML 로 되넣는다(js/io/save-load.js:1678) → onerror 가 돈다?
 *   X2 ★② 같은 길의 불릿 갈래 — ul.tb-bullet 이 비면 `<li>${placeholder}</li>` 를 innerHTML 로(save-load.js:1663)
 *   X3 [음성대조 · 지키는 칸] 같은 핸들러를 «속성으로 직접» 넣으면 sanitizeCanvasHtml 이 벗긴다 — 우회가 «인코딩된 문자열 속성»이라는 증거
 *   X4 ③ 캔버스 안 <a href="https://…"> 를 사람처럼 클릭하면 렌더러가 «최상위 이동»을 시도하나(가로채서 끊는다)
 *        ⚠️하네스는 Electron 이 아니다 — main.js will-navigate 가드·preload 적용 범위는 «못 잰다».
 *          이 칸이 재는 것은 「렌더러 쪽에 링크 클릭을 막는 손이 있나」 하나다. 시도가 잡히면 막는 손은 main 의 가드뿐이고,
 *          그 가드(main.js:620)는 에디터 페이지 이름만 본다(정적 · 보고서 표).
 * 실행: NODE_PRESERVE_SYMLINKS=1 node --preserve-symlinks-main node_modules/@playwright/test/cli.js test \
 *        --config=tests/dom/playwright.dom.config.js --retries=0 --workers=1 tests/dom/sec-malicious-project-open.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = (inner) => `<div class="section-block" id="xS" data-section="1" data-name="X" style="background:#fff"><div class="section-inner">${inner}</div></div>`;
/* 인코딩된 문자열 — 속성 «값»이라 sanitize 의 on* 속성 검사에 안 걸린다(감사 PoC 꼴 · 핸들러만 표식으로 바꿈) */
const ENC = (flag) => `&lt;img src=data:,x onerror=window.${flag}=1&gt;`;

/** 프로젝트 «열기»(applyProjectData) 뒤 그 칸의 img 가 «끝날 때»까지(있으면) 기다린 다음 표식·흔적을 읽는다. */
async function openAndRead(page, canvas, flag, sel) {
  await page.evaluate((c) => window.applyProjectData({ canvas: c }), canvas);
  await page.waitForFunction((sel) => { const el = document.querySelector(sel); if (!el) return false;
    const im = el.querySelector('img'); return !im || im.complete; }, sel);
  await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  return page.evaluate(([flag, sel]) => { const el = document.querySelector(sel);
    return { pwned: window[flag] === 1, imgInDom: !!el?.querySelector('img'), html: (el?.innerHTML || '').slice(0, 160) }; }, [flag, sel]);
}

test('X1 ★② 열기만으로 — 인코딩된 data-placeholder 의 <img onerror> 가 실행되지 않는다', async ({ page }) => {
  const errs = await bootApp(page);
  const r = await openAndRead(page,
    SEC(`<div class="row"><div class="text-block" id="xT"><div class="tb-body" data-placeholder="${ENC('__pwned1')}"></div></div></div>`),
    '__pwned1', '#xT .tb-body');
  console.log('  X1:', JSON.stringify(r));
  expect(r.imgInDom, '열기 뒤 글 칸 안에 <img> 요소가 생겼다(placeholder 가 HTML 로 들어감)').toBe(false);
  expect(r.pwned, '★열기만으로 onerror 가 실행됐다').toBe(false);
  expect(errs.filter(e => !/pwned/.test(e))).toEqual([]);
});

test('X2 ★② 불릿 갈래 — 빈 ul.tb-bullet 의 placeholder 가 <li> 안 HTML 로 실행되지 않는다', async ({ page }) => {
  const errs = await bootApp(page);
  const r = await openAndRead(page,
    SEC(`<div class="row"><div class="text-block" id="xB"><ul class="tb-bullet" data-placeholder="${ENC('__pwned2')}"></ul></div></div>`),
    '__pwned2', '#xB .tb-bullet');
  console.log('  X2:', JSON.stringify(r));
  expect(r.imgInDom).toBe(false);
  expect(r.pwned, '★열기만으로 불릿 placeholder 의 onerror 가 실행됐다').toBe(false);
  expect(errs.filter(e => !/pwned/.test(e))).toEqual([]);
});

test('X3 [음성대조] 핸들러를 속성으로 «직접» 넣으면 sanitize 가 벗긴다(지금도 초록이어야)', async ({ page }) => {
  const errs = await bootApp(page);
  const r = await openAndRead(page,
    SEC(`<div class="row"><div class="text-block" id="xD"><div class="tb-body"><img src="data:,x" onerror="window.__pwned3=1">글</div></div></div>`),
    '__pwned3', '#xD .tb-body');
  console.log('  X3:', JSON.stringify(r));
  expect(r.imgInDom, '★전제 — img 는 남는다(속성만 벗김)').toBe(true);
  expect(r.pwned, '직접 넣은 onerror 가 살아 있다 — sanitize 가 죽었다').toBe(false);
  expect(errs).toEqual([]);
});

test('X4 ③ 캔버스 안 https 링크 클릭 — 렌더러가 최상위 이동을 «시도»하지 않는다 (가로채 끊음 · 네트워크 0)', async ({ page }) => {
  const errs = await bootApp(page);
  const tried = [];
  await page.route('https://attacker.example/**', (route) => { tried.push(route.request().url()); return route.abort(); });
  const before = page.url();
  await page.evaluate((c) => window.applyProjectData({ canvas: c }),
    SEC(`<div class="row"><div class="text-block" id="xL"><div class="tb-body"><a id="xA" href="https://attacker.example/p" style="font-size:40px">링크</a></div></div></div>`));
  await page.waitForSelector('#xA');
  const kept = await page.evaluate(() => document.getElementById('xA')?.getAttribute('href'));
  expect(kept, '★전제 — 열기 뒤 링크 href 가 남아 있다(sanitize 는 https 를 안 건드린다)').toBe('https://attacker.example/p');
  await page.evaluate(() => document.getElementById('xA').scrollIntoView({ block: 'center' }));
  await page.click('#xA');                                  // 사람 손 그대로(선택 클릭)
  await page.click('#xA');                                  // 두 번째 클릭(이미 고른 블럭 안 클릭)
  /* «시도 없음»을 잴 창 — 고정 대기 대신: 다음 두 프레임 + 요청 가로채기 큐가 비는 동안 */
  await page.waitForFunction(() => new Promise(r => setTimeout(() => requestAnimationFrame(() => r(true)), 300)));
  console.log('  X4:', JSON.stringify({ tried, before, after: page.url() }));
  expect(tried, '★링크 클릭이 외부 최상위 이동을 시도했다 — 막는 손은 main will-navigate 뿐(그 가드는 에디터 페이지 이름만 본다)').toEqual([]);
  expect(page.url()).toBe(before);
  expect(errs).toEqual([]);
});
