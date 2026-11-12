/* sec-malicious-project-open.dom.spec.js — SEC-MALICIOUS-PROJECT-FILE-SANDBOX-01 «재현» (지디 발주 261112 · Codex 정적 감사 ②·③)
 *   ★② 고침(이 파일과 같은 가지) — save-load.js 2곳 · block-drag.js 1곳 innerHTML → textContent(불릿은 li 를 만들고 textContent).
 *   ★이 파일은 «재현» 이다 — 지금(aded4a28a) 빨강이 «결함이 있다»는 뜻이고, 고친 뒤 초록이 되게 적었다.
 *   ⛔진짜 키·외부 전송 0: 악성 핸들러는 window.__pwned* 표식만 세운다 · 외부 주소는 page.route 로 «가로채 끊는다»(네트워크 0).
 *
 *   X1 ★② 열기만으로 실행 — tb-body 의 data-placeholder 에 «인코딩된» <img onerror> → applyProjectData → rebindAll 이
 *        빈 글 칸에 placeholder 를 innerHTML 로 되넣는다(js/io/save-load.js:1678) → onerror 가 돈다?
 *   X2 ★② 같은 길의 불릿 갈래 — ul.tb-bullet 이 비면 `<li>${placeholder}</li>` 를 innerHTML 로(save-load.js:1663)
 *   X2b ★② 편집 끝(blur) 갈래 — js/block-drag.js _endTextEdit 의 placeholder 복원(고침 3번째 자리)
 *   X5 표시 무변 — 평문 placeholder(기본·사용자 지정 & 포함·불릿)가 같은 글자(고치기 전에도 초록)
 *   X3 [음성대조 · 지키는 칸] 같은 핸들러를 «속성으로 직접» 넣으면 sanitizeCanvasHtml 이 벗긴다 — 우회가 «인코딩된 문자열 속성»이라는 증거
 *   X4 ③ 캔버스 안 <a href="https://…"> 를 사람처럼 클릭하면 렌더러가 «최상위 이동»을 시도하나(가로채서 끊는다)
 *        ⚠️하네스는 Electron 이 아니다 — main.js will-navigate 가드·preload 적용 범위는 «못 잰다».
 *          이 칸이 재는 것은 「렌더러 쪽에 링크 클릭을 막는 손이 있나」 하나다. 시도가 잡히면 막는 손은 main 의 가드뿐이고,
 *          그 가드(main.js:620)는 에디터 페이지 이름만 본다(정적 · 보고서 표).
 * 실행: NODE_PRESERVE_SYMLINKS=1 node --preserve-symlinks-main node_modules/@playwright/test/cli.js test \
 *        --config=tests/dom/playwright.dom.config.js --retries=0 --workers=1 tests/dom/sec-malicious-project-open.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

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

test('X2b ★② 편집 끝(blur) 갈래 — 비운 채 blur 하면 placeholder 가 HTML 로 실행되지 않는다 (block-drag.js _endTextEdit)', async ({ page }) => {
  const errs = await bootApp(page);
  await page.evaluate((c) => window.applyProjectData({ canvas: c }),
    SEC(`<div class="row"><div class="text-block" id="xE"><div class="tb-body" data-placeholder="${ENC('__pwned4')}">원래 글</div></div></div>`));
  const r = await page.evaluate(async () => {
    const el = document.querySelector('#xE .tb-body');
    el.setAttribute('contenteditable', 'true'); el.focus();
    el.textContent = '';                                         // 사용자가 글을 다 지움
    el.blur();                                                   // 편집 끝 → placeholder 복원 길
    const im = el.querySelector('img');
    if (im && !im.complete) await new Promise(r => { im.onload = im.onerror = () => setTimeout(r, 0); });
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { pwned: window.__pwned4 === 1, imgInDom: !!el.querySelector('img'), restored: el.dataset.isPlaceholder === 'true', text: el.textContent };
  });
  console.log('  X2b:', JSON.stringify(r));
  expect(r.restored, '★전제 — blur 가 placeholder 복원 길을 탔다').toBe(true);
  expect(r.imgInDom).toBe(false);
  expect(r.pwned, '★편집 끝(blur)에 placeholder 의 onerror 가 실행됐다').toBe(false);
  expect(errs.filter(e => !/pwned/.test(e))).toEqual([]);
});

test('X5 표시 무변 — 평문 placeholder(기본·사용자 지정·불릿)는 고치기 전후 «같은 글자»로 보인다(지금도 초록이어야)', async ({ page }) => {
  const errs = await bootApp(page);
  await page.evaluate((c) => window.applyProjectData({ canvas: c }), SEC(
    '<div class="row"><div class="text-block" id="pA"><div class="tb-h2"></div></div></div>'                                   // 기본(_phTextMap)
    + '<div class="row"><div class="text-block" id="pB"><div class="tb-body" data-placeholder="고객 후기 &amp; 설명 (2줄)"></div></div></div>'   // 사용자 지정 평문(& 포함)
    + '<div class="row"><div class="text-block" id="pC"><ul class="tb-bullet"></ul></div></div>'));                             // 불릿 기본
  const r = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const one = (el) => ({ text: el.textContent, ph: el.dataset.placeholder, kids: [...el.children].map(c => c.tagName), isPh: el.dataset.isPlaceholder });
    return { a: one(q('#pA .tb-h2')), b: one(q('#pB .tb-body')), c: one(q('#pC .tb-bullet')) };
  });
  console.log('  X5:', JSON.stringify(r));
  expect(r.a).toEqual({ text: '소제목을 입력하세요', ph: '소제목을 입력하세요', kids: [], isPh: 'true' });
  expect(r.b).toEqual({ text: '고객 후기 & 설명 (2줄)', ph: '고객 후기 & 설명 (2줄)', kids: [], isPh: 'true' });
  expect(r.c).toEqual({ text: '항목을 입력하세요', ph: '항목을 입력하세요', kids: ['LI'], isPh: 'true' });
  expect(errs).toEqual([]);
});

test('X4 ③ 캔버스 안 https 링크를 «일반 클릭 1번» — 렌더러가 최상위 이동을 «시도»하지 않는다 (가로채 끊음 · 네트워크 0)', async ({ page }) => {
  /* 인텔 1차: page.click 이 «클릭 가능» 조건(보임·안정·덮개 없음)을 못 채워 30s 시간 초과 = 못 잼.
     ⇒ 사람 손과 같은 «좌표 클릭»(page.mouse.click) 한 번 · 그 자리에서 실제로 무엇이 클릭을 받는지(덮개 여부)를 같이 찍는다. */
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  const tried = [], navs = [];
  await page.route('https://attacker.example/**', (route) => { tried.push(route.request().url()); return route.abort(); });
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navs.push(f.url()); });
  const before = page.url();
  await page.evaluate((c) => window.applyProjectData({ canvas: c }),
    SEC(`<div class="row"><div class="text-block" id="xL"><div class="tb-body"><a id="xA" href="https://attacker.example/p" style="font-size:40px">링크링크링크</a></div></div></div>`));
  await page.waitForSelector('#xA');
  const kept = await page.evaluate(() => document.getElementById('xA')?.getAttribute('href'));
  expect(kept, '★전제 — 열기 뒤 링크 href 가 남아 있다(sanitize 는 https 를 안 건드린다)').toBe('https://attacker.example/p');
  await page.evaluate(() => { document.getElementById('xA').scrollIntoView({ block: 'center', inline: 'center' }); });
  const r0 = await waitStableRect(page, '#xA');
  const hit = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); const a = document.getElementById('xA');
    return { inView: x > 0 && y > 0 && x < innerWidth && y < innerHeight, isLink: !!el && (el === a || a.contains(el)),
      top: el ? (el.id ? '#' + el.id : el.tagName + '.' + String(el.className || '').split(' ')[0]) : null }; }, [r0.cx, r0.cy]);
  expect(hit.inView, '★전제 — 링크 자리가 화면 안').toBe(true);
  await page.mouse.click(r0.cx, r0.cy);                       // ★일반 클릭 1번(사람 손 그대로 — 덮개가 있으면 덮개가 받는다)
  /* «시도 없음»을 잴 창 — 고정 대기 대신: 300ms 뒤 한 프레임(요청 가로채기가 끝날 틈) */
  await page.waitForFunction(() => new Promise(r => setTimeout(() => requestAnimationFrame(() => r(true)), 300)));
  console.log('  X4:', JSON.stringify({ hit, tried, navs, before, after: page.url() }),
    hit.isLink ? '' : ' ← 클릭은 링크가 아니라 위 요소가 받았다(편집 화면의 덮개) — 일반 클릭으로는 링크에 안 닿음');
  expect(tried, '★링크 클릭이 외부 최상위 이동을 시도했다 — 막는 손은 main will-navigate 뿐(그 가드는 에디터 페이지 이름만 본다)').toEqual([]);
  expect(navs.filter(u => /attacker\.example/.test(u)), '주 프레임이 외부로 이동했다').toEqual([]);
  expect(page.url()).toBe(before);
  expect(errs).toEqual([]);
});
