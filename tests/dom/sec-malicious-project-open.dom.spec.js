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
 *   X4·X4m·X4c ★③ 고침(현빈 결정 (가)) — 캔버스 안 링크 일반·조합키·가운데 클릭 = 외부 시도 0 · 새 창 0 (js/canvas-link-guard.js)
 *   X4e [무변] 편집 중 링크 글자 편집 · X4p [양성대조] 캔버스 밖 같은 링크는 그물이 잡는다
 *        ⚠️하네스는 Electron 이 아니다 — main 벽(main/nav-guard.js: will-navigate·setWindowOpenHandler)은 tests/unit/sec-nav-guard.test.js 가 잰다.
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

test('X2b ★② 편집 끝(blur) 갈래 — 비운 채 편집을 끝내면 placeholder 가 HTML 로 실행되지 않는다 (block-drag.js _endTextEdit)', async ({ page }) => {
  /* 인텔: 합성 focus/blur 로는 «복원 길» 전제가 안 섰다(고친 판·전 판 둘 다). ⇒ 사람 손 그대로:
     더블클릭으로 편집 진입 → 실키 전체선택 + Backspace → 바깥(캔버스 왼쪽 빈 바닥) 실클릭. */
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((c) => window.applyProjectData({ canvas: c }),
    SEC(`<div class="row"><div class="text-block" id="xE"><div class="tb-body" data-placeholder="${ENC('__pwned4')}" style="font-size:32px">원래 글</div></div></div>`));
  await page.evaluate(() => document.getElementById('xE').scrollIntoView({ block: 'center', inline: 'center' }));
  const r0 = await waitStableRect(page, '#xE .tb-body');
  await page.mouse.dblclick(r0.cx, r0.cy);
  await expect.poll(() => page.evaluate(() => document.querySelector('#xE .tb-body').getAttribute('contenteditable')),
    { message: '★전제 — 더블클릭으로 편집에 들어갔다', timeout: 3000 }).toBe('true');
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  expect(await page.evaluate(() => document.querySelector('#xE .tb-body').textContent.trim()), '★전제 — 글을 다 지웠다').toBe('');
  const out = await page.evaluate(() => { const c = document.getElementById('canvas').getBoundingClientRect(); return { x: Math.max(5, c.left - 60), y: c.top + 40 }; });
  await page.mouse.click(out.x, out.y);                         // 바깥 실클릭 → blur → _endTextEdit
  await expect.poll(() => page.evaluate(() => document.querySelector('#xE .tb-body').dataset.isPlaceholder),
    { message: '★전제 — 편집 끝이 placeholder 복원 길을 탔다', timeout: 3000 }).toBe('true');
  const r = await page.evaluate(async () => {
    const el = document.querySelector('#xE .tb-body');
    const im = el.querySelector('img');
    if (im && !im.complete) await new Promise(r => { im.onload = im.onerror = () => setTimeout(r, 0); });
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { pwned: window.__pwned4 === 1, imgInDom: !!el.querySelector('img'), editable: el.getAttribute('contenteditable'), text: el.textContent.slice(0, 80) };
  });
  console.log('  X2b:', JSON.stringify({ out, ...r }));
  expect(r.editable, '★전제 — 편집이 끝났다').toBe('false');
  expect(r.imgInDom, '편집 끝에 글 칸 안에 <img> 요소가 생겼다').toBe(false);
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

/* ── X4 가족 ③ — 현빈 결정 (가) 261112: 캔버스 안 링크 클릭 = 앱 창 이동 0 · 새 창/외부 브라우저 0 · 아무 일 없음.
 *   렌더러 첫 손 = js/canvas-link-guard.js(click·auxclick 의 기본 동작만 끊음) · 바깥 벽 = main/nav-guard.js(tests/unit/sec-nav-guard.test.js 가 잰다).
 *   ⚠️window.open·location 대입은 «스크립트»라 렌더러가 못 막는다 — 그건 main 벽의 일이고 하네스(Chromium)에선 못 잰다 ⇒ 단위 N3. */
const LINK = `<div class="row"><div class="text-block" id="xL"><div class="tb-body"><a id="xA" href="https://attacker.example/p" style="font-size:40px">링크링크링크</a></div></div></div>`;

/** 링크 든 프로젝트를 열고, 외부 시도·주 프레임 이동·새 창을 잴 그물을 친 뒤 링크 가운데 좌표를 준다. */
async function armLink(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  const net = { tried: [], navs: [], popups: [] };
  await page.route('https://attacker.example/**', (route) => { net.tried.push(route.request().url()); return route.abort(); });
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) net.navs.push(f.url()); });
  page.context().on('page', (p) => net.popups.push(p.url()));
  const before = page.url();
  await page.evaluate((c) => window.applyProjectData({ canvas: c }), SEC(LINK));
  await page.waitForSelector('#xA');
  expect(await page.evaluate(() => document.getElementById('xA')?.getAttribute('href')),
    '★전제 — 열기 뒤 링크 href 가 남아 있다(sanitize 는 https 를 안 건드린다)').toBe('https://attacker.example/p');
  await page.evaluate(() => { document.getElementById('xA').scrollIntoView({ block: 'center', inline: 'center' }); });
  const r0 = await waitStableRect(page, '#xA');
  const hit = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); const a = document.getElementById('xA');
    return { inView: x > 0 && y > 0 && x < innerWidth && y < innerHeight, isLink: !!el && (el === a || a.contains(el)) }; }, [r0.cx, r0.cy]);
  expect(hit.inView, '★전제 — 링크 자리가 화면 안').toBe(true);
  return { errs, net, before, r0, hit };
}
/* «시도 없음»을 잴 창 — 고정 대기 대신: 300ms 뒤 한 프레임(요청 가로채기·새 창 생성이 끝날 틈) */
const settle = (page) => page.waitForFunction(() => new Promise(r => setTimeout(() => requestAnimationFrame(() => r(true)), 300)));
function expectNothing(page, { errs, net, before }, tag) {
  expect(net.tried, `★${tag} — 링크 클릭이 외부 이동을 시도했다`).toEqual([]);
  expect(net.popups, `★${tag} — 새 창(탭)이 열렸다`).toEqual([]);
  expect(net.navs.filter(u => /attacker\.example/.test(u)), `${tag} — 주 프레임이 외부로 이동했다`).toEqual([]);
  expect(page.url()).toBe(before);
  expect(errs).toEqual([]);
}

test('X4 ③ 캔버스 안 https 링크 «일반 클릭 1번» = 아무 일 없음 (외부 시도 0 · 새 창 0)', async ({ page }) => {
  const s = await armLink(page);
  await page.mouse.click(s.r0.cx, s.r0.cy);
  await settle(page);
  console.log('  X4:', JSON.stringify({ hit: s.hit, ...s.net }));
  expectNothing(page, s, 'X4 일반 클릭');
});

test('X4m ③ ⌘/Ctrl 클릭 · Shift 클릭 = 아무 일 없음 (새 창·새 탭 0)', async ({ page }) => {
  const s = await armLink(page);
  for (const mod of ['ControlOrMeta', 'Shift']) {
    await page.keyboard.down(mod);
    await page.mouse.click(s.r0.cx, s.r0.cy);
    await page.keyboard.up(mod);
  }
  await settle(page);
  console.log('  X4m:', JSON.stringify(s.net));
  expectNothing(page, s, 'X4m 조합키 클릭');
});

test('X4c ③ 가운데 클릭 = 아무 일 없음 (새 창·새 탭 0)', async ({ page }) => {
  const s = await armLink(page);
  await page.mouse.click(s.r0.cx, s.r0.cy, { button: 'middle' });
  await settle(page);
  console.log('  X4c:', JSON.stringify(s.net));
  expectNothing(page, s, 'X4c 가운데 클릭');
});

test('X4e [무변] 편집 중 링크 글자 편집은 그대로 — 더블클릭 진입 → 링크 가운데 클릭 → 글자 입력이 링크 안에 들어간다 · 이동 0', async ({ page }) => {
  const s = await armLink(page);
  await page.mouse.dblclick(s.r0.cx, s.r0.cy);
  await expect.poll(() => page.evaluate(() => document.querySelector('#xL .tb-body').getAttribute('contenteditable')),
    { message: '★전제 — 더블클릭으로 편집에 들어갔다', timeout: 3000 }).toBe('true');
  await page.mouse.click(s.r0.cx, s.r0.cy);
  await page.keyboard.type('Z');
  const r = await page.evaluate(() => ({ link: document.getElementById('xA')?.textContent, href: document.getElementById('xA')?.getAttribute('href') }));
  await settle(page);
  console.log('  X4e:', JSON.stringify({ ...r, ...s.net }));
  expect(r.link, '링크 글자 안에 입력이 안 들어갔다(편집이 막혔다)').toMatch(/^링크.*Z.*링크$/);
  expect(r.href).toBe('https://attacker.example/p');
  expectNothing(page, s, 'X4e 편집 중 클릭');
});

test('X4p [양성대조 · 자] 캔버스 «밖»에 같은 링크를 두고 같은 일반 클릭 → 그물이 외부 시도를 «잡는다»', async ({ page }) => {
  /* 이 칸이 빨강이면 X4·X4m·X4c 의 초록은 «못 재서» 초록이다. 가드 «되돌림» 양성대조는 보고 참조(index.html 의 canvas-link-guard 줄 빼고 X4 빨강). */
  const s = await armLink(page);
  await page.evaluate(() => { const a = document.createElement('a'); a.id = 'xOut'; a.href = 'https://attacker.example/out';
    a.textContent = '바깥링크'; a.style.cssText = 'position:fixed;left:8px;top:8px;z-index:2147483647;font-size:40px;background:#fff'; document.body.appendChild(a); });
  const o = await waitStableRect(page, '#xOut');
  await page.mouse.click(o.cx, o.cy);
  await expect.poll(() => s.net.tried.length, { message: '★자가 외부 시도를 못 잡는다 — 이 그물로는 X4 초록이 아무 뜻이 없다', timeout: 3000 }).toBeGreaterThan(0);
  console.log('  X4p:', JSON.stringify(s.net));
});

/* ── V 가족 — SEC-VECTOR-SVG-RAW-01 «재현» (지디 261113 · 지혜 t3-06 곁가지) ──────────────────────────────
 *   벡터 블록은 data-svg «문자열»을 renderVector 가 inner.innerHTML 로 넣는다(js/blocks/vector-block.js:39) — sanitize-svg 를 안 탄다.
 *   로드 세척(sanitizeCanvasHtml)은 DOM 의 on* 만 벗기고 data-* «값 안의 문자열»은 안 본다(X3 와 같은 성질 · sanitize-svg.js 머리말).
 *   MCP update 는 <script 만 막는다(:177). ⇒ 저장본/MCP 가 준 <svg onload> · <image onerror> 가 «그릴 때» 산다?
 *   ⚠️열기 «만»으로는 renderVector 가 안 돈다(save-load 는 저장된 inner 를 그대로 쓴다 · 그 inner 는 세척된다) —
 *     그래서 V1 은 «열기 → 일상 편집 1회(패널 폭 칸)»까지 간다. 열기 직후 표식도 따로 찍는다(open 칸).
 *   표식만 세운다(window.__pwnedV*) · 외부 주소 0(data: 만).
 *   V0 [자 · 양성대조] 이 하네스에서 innerHTML 로 넣은 <svg onload>·<image onerror> 가 «정말 돈다» — 빨강이면 V1~V3 초록은 못 재서 초록
 *   V1 ★열기 → 벡터 고르기(실클릭) → 패널 폭 칸 바꾸기 = renderVector → 실행되지 않는다
 *   V2 ★MCP 길 updateVectorBlock(id, {svg}) — <script 없는 악성 svg → 실행되지 않는다
 *   V3 ★만들기 길 makeVectorBlock(data) — 붙여넣기·복원이 data 로 부르는 자리 → 실행되지 않는다 */
const VEC_EVIL = (flag) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="window.${flag}=1">`
  + `<image href="data:," onerror="window.${flag}=1"/><rect width="10" height="10" fill="#000000"/></svg>`;
const VEC_OK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="100%" height="100%"><rect width="10" height="10" fill="#000000"/></svg>';
/** 벡터 블록 든 섹션 — data-svg 는 setAttribute 로(인코딩은 브라우저가) · 저장된 inner 는 무해한 그림. */
const vecCanvas = (page, svg) => page.evaluate(([sec, svg]) => {
  const d = document.createElement('div'); d.innerHTML = sec;
  d.querySelector('.vector-block').setAttribute('data-svg', svg);
  return d.innerHTML;
}, [SEC(`<div class="row" data-layout="stack"><div class="vector-block" data-type="vector" id="vbX" draggable="true" data-color="#000000" data-w="120" data-h="120" data-layer-name="Vector" style="width:120px;height:120px"><div class="vb-inner">${VEC_OK}</div></div></div>`), svg]);

test('V0 [자 · 양성대조] innerHTML 로 넣은 <svg onload>·<image onerror> 는 이 하네스에서 «돈다»', async ({ page }) => {
  await bootApp(page);
  await page.evaluate((h) => { const d = document.createElement('div'); document.body.appendChild(d); d.innerHTML = h; }, VEC_EVIL('__vctl'));
  await expect.poll(() => page.evaluate(() => window.__vctl === 1),
    { message: '★자가 svg 핸들러 실행을 못 잡는다 — V1~V3 초록은 아무 뜻이 없다', timeout: 3000 }).toBe(true);
});

test('V1 ★열기 → 벡터 고르기 → 폭 바꾸기(renderVector) — data-svg 의 핸들러가 실행되지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((c) => window.applyProjectData({ canvas: c }), await vecCanvas(page, VEC_EVIL('__pwnedV1')));
  await page.waitForSelector('#vbX');
  await settle(page);
  const atOpen = await page.evaluate(() => window.__pwnedV1 === 1);
  await page.evaluate(() => document.getElementById('vbX').scrollIntoView({ block: 'center', inline: 'center' }));
  const r0 = await waitStableRect(page, '#vbX');
  await page.mouse.click(r0.cx, r0.cy);
  await page.waitForSelector('#vb-w', { timeout: 5000 });          // ★전제 — 벡터 패널이 떴다
  await page.locator('#vb-w').fill('140');
  await page.locator('#vb-w').press('Tab');                          // change → renderVector
  await expect.poll(() => page.evaluate(() => document.getElementById('vbX').dataset.w),
    { message: '★전제 — 폭 바꾸기가 renderVector 길을 탔다', timeout: 3000 }).toBe('140');
  await settle(page);
  const r = await page.evaluate(() => ({ pwned: window.__pwnedV1 === 1, inner: document.querySelector('#vbX .vb-inner').innerHTML.slice(0, 200) }));
  console.log('  V1:', JSON.stringify({ atOpen, ...r }));
  expect(atOpen, '★열기만으로 실행됐다').toBe(false);
  expect(r.pwned, '★열기 → 폭 바꾸기 한 번에 data-svg 의 핸들러가 실행됐다').toBe(false);
  expect(errs.filter(e => !/pwned/.test(e))).toEqual([]);
});

test('V2 ★MCP 길 updateVectorBlock — <script 없는 악성 svg 의 핸들러가 실행되지 않는다', async ({ page }) => {
  const errs = await bootApp(page);
  await page.evaluate((c) => window.applyProjectData({ canvas: c }), await vecCanvas(page, VEC_OK));
  await page.waitForSelector('#vbX');
  const res = await page.evaluate((svg) => window.updateVectorBlock('vbX', { svg }), VEC_EVIL('__pwnedV2'));
  await settle(page);
  const r = await page.evaluate(() => ({ pwned: window.__pwnedV2 === 1, inner: document.querySelector('#vbX .vb-inner').innerHTML.slice(0, 200) }));
  console.log('  V2:', JSON.stringify({ res, ...r }));
  expect(r.pwned, '★MCP update 로 넣은 svg 의 핸들러가 실행됐다').toBe(false);
  expect(errs.filter(e => !/pwned/.test(e))).toEqual([]);
});

test('V3 ★만들기 길 makeVectorBlock(data) — data.svg 의 핸들러가 실행되지 않는다', async ({ page }) => {
  const errs = await bootApp(page);
  await page.evaluate((c) => window.applyProjectData({ canvas: c }), await vecCanvas(page, VEC_OK));
  await page.waitForSelector('#vbX');
  await page.evaluate((svg) => { const { row } = window.makeVectorBlock({ svg }); document.querySelector('#xS .section-inner').appendChild(row); }, VEC_EVIL('__pwnedV3'));
  await settle(page);
  const r = await page.evaluate(() => ({ pwned: window.__pwnedV3 === 1 }));
  console.log('  V3:', JSON.stringify(r));
  expect(r.pwned, '★makeVectorBlock(data) 로 만든 블록의 svg 핸들러가 실행됐다').toBe(false);
  expect(errs.filter(e => !/pwned/.test(e))).toEqual([]);
});
