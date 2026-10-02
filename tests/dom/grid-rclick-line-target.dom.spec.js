/* grid-rclick-line-target.dom.spec.js — T-168 회귀 그물. (2026-09-24)
 *
 * ★무엇을 재나 — 그리드 칸을 «우클릭»해 이미지를 넣을 때, «누른 줄»이 표적이 되는가.
 *
 * ★실측한 증상(2026-09-24, 앱 9370 격리 프로필에서 화면으로 봤다):
 *   칸에 [글자 줄, 그림 줄] 이 있을 때 «글자 줄 위»에서 우클릭하면
 *   ⑴ 메뉴 딱지가 「이미지 교체」로 뜨고 「이미지 삭제」까지 뜬다 — 글자 줄엔 지울 그림이 없다.
 *   ⑵ 그걸 고르면 «아무 말 없이» 칸 안의 «다른» 그림(줄 1)이 바뀐다. 붉은 안내는 «안 뜬다».
 *   ⇒ 즉 사람은 A 를 눌렀는데 B 가 바뀐다. 게다가 «글자 줄 자리에 그림을 넣는» 길은 닫혀 있다.
 *
 * ★원인 — block-factory.js `_gridCellAddrAt` 이 「누른 줄이 그림이면 그 줄, 아니면 «그 칸의
 *   첫 그림 줄»」로 표적을 정한다. 그 «아니면» 가지가 «안 누른 줄»을 집어 온다.
 *
 * ⛔T-069 가 이미 잰 갈래(그림 줄이 «없는» 칸)는 여기서 «그대로»여야 한다 — 아래 ③·④ 가 못박는다.
 *
 * ★★2026-09-26 — 「이미지 추가」의 «동작»이 일부러 바뀌었다(현빈 ㈎안). 표적 규약(위)은 그대로다.
 *   현빈 「그리드 블럭 우클릭 후 「이미지 추가」를 하면 바로 이미지 추가 UI(파일 선택창)가
 *         뜨는 것이 아니라, 이미지 블럭(체크패턴 있는) 걸 넣어 주는 것이 어때?」
 *   ⇒ 이 파일의 ②·③ 이 재던 것이 바뀌었다:
 *       옛 계약: 「이미지 추가」 → 파일창 → 고른 그림이 그 줄 «다음»에 들어간다.
 *       새 계약: 「이미지 추가」 → 파일창을 «안 열고» «빈 이미지 줄»(imgSrc:'')이 그 줄 «다음»에.
 *     ⛔「이미지 교체」(④)는 «안 바뀌었다» — 그대로 파일창이다. 그래서 ④ 가 그 축의 파수꾼이다.
 *   ★그러니 이 파일은 이제 «파일창이 열린 횟수»도 센다(window.__fileDialogs) — 「빈 줄이 들어왔다」만
 *     재면 「들어오고 파일창도 같이 떴다」를 못 가린다(현빈이 없애라 한 것이 바로 그 창이다).
 *   ★채우는 길 — 빈 슬롯 «더블클릭» → 파일 선택(block-drag.js `.grd-img-empty[data-line]`).
 *     그 배선은 여기서 «안» 잰다(이 하네스엔 bindBlock 이 없다) — tests/dom/grid-img-crop.dom.spec.js
 *     W3 이 그 몫을 진다. 여기 ⑤ 는 그 가지가 «집을 수 있는 꼴»로 그려졌는지까지만 잰다.
 *
 * ⛔앱을 «안» 띄운다. 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grid-rclick-line-target
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* ★메뉴 마크업은 «index.html 에서 떠 온다» — 여기 베끼면 딱지 id 가 하나 바뀔 때 이 그물만 늙는다.
   (이 원장의 「명부를 손으로 베끼면 한쪽만 고쳐진다」) */
function contextMenuMarkup() {
  const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const start = html.indexOf('<div id="block-context-menu"');
  if (start < 0) throw new Error('index.html 에서 #block-context-menu 를 못 찾았다');
  const end = html.indexOf('<!-- 색상 조정 플로팅 패널', start);
  if (end < 0) throw new Error('index.html 에서 메뉴 마크업의 끝을 못 찾았다');
  return html.slice(start, end);
}

/* 40×40 단색 PNG — 두 장을 «정체»로 가른다(표시가 아니라 바이트로). */
const RED  = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAIAAAADnC86AAAAL0lEQVR4nO3NMQ0AAAgDsMmZfz2IwQQJT5P+zbQvIhaLxWKxWCwWi8VisVgsFt9ZIvNTarZAi6sAAAAASUVORK5CYII=';
const BLUE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAIAAAADnC86AAAAMElEQVR4nO3NQQkAAAgEsItjHPtjGEsIfgb7L9XzImKxWCwWi8VisVgsFovFYvGdBSrwTXmLcR7GAAAAAElFTkSuQmCC';

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host"></div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
${contextMenuMarkup()}
<script src="/js/design-system.js"></script>
<script src="/js/io/section-serialize.js"></script>
<script type="module">
  import { makeGridBlock, renderGridBlock, updateGridBlock, getGridModel } from '/js/blocks/grid-block.js';
  window.updateGridBlock = updateGridBlock;
  window.getGridModel = getGridModel;
  window.__mk = makeGridBlock;
  window.__render = renderGridBlock;
  window.__model = getGridModel;
  await import('/js/block-factory.js');
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  return errs;
}

/** 칸 (0,0) = [글자, 그림RED] · 칸 (0,1) = [글자] 인 2×1 그리드를 세운다. */
async function build(page, red) {
  await page.evaluate(({ red }) => {
    document.getElementById('host').innerHTML = '';
    const { row, block } = window.__mk({ gap: 24, valign: 'top', cols: [
      { width: 1, lines: [{ type: 'body', text: '글자 줄 A' }] },
      { width: 1, lines: [{ type: 'body', text: '내용을 입력하세요.' }] },
    ] });
    document.getElementById('host').appendChild(row);
    block.classList.add('selected');
    window.updateGridBlock(block.id, { patchCell: { r: 0, c: 0, lines: [
      { type: 'body', text: '글자 줄 A' },
      { type: 'image', imgSrc: red, height: 40 },
    ] } });
    window.__block = block;
    /* ★파일 고르개만 «막는다» — 메뉴 클릭부터 커밋까지의 길은 그대로 돈다.
       (앱에서도 같은 방식으로 쟀다: OS 파일창은 안 열고 같은 onchange 에 진짜 File 을 넘긴다)
       ★★그리고 «몇 번 열렸나»를 센다 — 2026-09-26 부터 「이미지 추가」는 0 이어야 한다.
         ⛔「줄이 들어왔다」만 재면 «들어오고 창도 같이 떴다»가 초록으로 지나간다. */
    window.__fileDialogs = 0;
    const orig = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () {
      if (this.type !== 'file') return orig.apply(this, arguments);
      window.__fileDialogs++;
      const b64 = window.__pick.split(',')[1];
      const bin = atob(b64); const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const dt = new DataTransfer(); dt.items.add(new File([arr], 'pick.png', { type: 'image/png' }));
      this.files = dt.files;
      this.dispatchEvent(new Event('change'));
    };
  }, { red });
}

/** 그 줄의 «가운데»에 contextmenu 를 쏜다 — 좌표는 같은 호출 안에서 재고, 대상도 같은 자리에서 확인한다. */
async function openMenuOnLine(page, r, c, li) {
  return page.evaluate(({ r, c, li }) => {
    const sel = `[data-r="${r}"][data-c="${c}"][data-line="${li}"]`;
    const el = window.__block.querySelector(sel);
    if (!el) return { err: '줄을 못 찾았다: ' + sel };
    const box = el.getBoundingClientRect();
    const x = Math.round(box.left + box.width / 2), y = Math.round(box.top + box.height / 2);
    const hit = document.elementFromPoint(x, y);
    if (!(el === hit || el.contains(hit))) return { err: '그 점에 다른 것이 있다: ' + (hit && hit.className) };
    window._openBlockContextMenu(new MouseEvent('contextmenu', { clientX: x, clientY: y, bubbles: true, cancelable: true }), window.__block);
    const item = document.getElementById('bcm-grid-img');
    return {
      label: document.getElementById('bcm-grid-img-label').textContent.trim(),
      addShown: getComputedStyle(item).display !== 'none',
      delShown: getComputedStyle(document.getElementById('bcm-grid-img-del')).display !== 'none',
    };
  }, { r, c, li });
}

/** 열린 메뉴의 「이미지 추가/교체」를 누른다. 파일창이 열리면 고를 그림은 `pick` 이다.
 *  @returns {Promise<number>} 이 클릭이 «파일창을 연 횟수» — 「추가」는 0, 「교체」는 1 이어야 한다.
 *  ★`input.click()` 은 핸들러 «안»에서 동기로 불린다 — 그래서 클릭 직후에 세도 안 놓친다.
 *    (커밋은 교체 쪽만 FileReader 를 지나 비동기다 — 그래서 기다림은 그대로 둔다.) */
async function pickImage(page, pick) {
  const dialogs = await page.evaluate((pick) => {
    window.__pick = pick;
    window.__fileDialogs = 0;
    document.getElementById('bcm-grid-img').click();
    return window.__fileDialogs;
  }, pick);
  await page.waitForTimeout(150);
  return dialogs;
}

const linesOf = (page, r, c) => page.evaluate(({ r, c }) => {
  const ls = window.__model(window.__block).cells[r][c].lines || [];
  return ls.map((l) => (l.type === 'image' ? 'image:' + l.imgSrc : l.type + ':' + (l.text ?? '')));
}, { r, c });

test.describe('T-168 — 우클릭 이미지의 표적은 «누른 줄»이다', () => {
  test('① 글자 줄 위 우클릭(칸에 그림 줄이 있음) → 딱지는 「이미지 추가」이고 「이미지 삭제」는 안 뜬다', async ({ page }) => {
    const errs = await boot(page);
    await build(page, RED);
    const m = await openMenuOnLine(page, 0, 0, 0);
    expect(m.err, m.err || '').toBeUndefined();
    expect(m.addShown).toBe(true);
    // ⛔고치기 «전»엔 '이미지 교체' 다 — 안 누른 그림 줄을 집어 오기 때문이다.
    expect(m.label).toBe('이미지 추가');
    // ⛔고치기 «전»엔 true 다 — 글자 줄엔 지울 그림이 없는데도 떴다.
    expect(m.delShown).toBe(false);
    expect(errs).toEqual([]);
  });

  test('② ★글자 줄 위 우클릭 → «파일창 없이» 빈 이미지 줄이 그 줄 다음에 들어가고, 칸의 다른 그림은 안 바뀐다', async ({ page }) => {
    const errs = await boot(page);
    await build(page, RED);
    const m = await openMenuOnLine(page, 0, 0, 0);
    expect(m.err, m.err || '').toBeUndefined();
    const dialogs = await pickImage(page, BLUE);
    /* ★현빈이 없애라 한 것이 «이 창»이다 — 줄보다 먼저 잰다. */
    expect(dialogs, '★「이미지 추가」가 파일 선택창을 열었다 — 2026-09-26 계약은 «안 여는» 것이다').toBe(0);
    /* ⛔T-168 전엔 ['body:글자 줄 A', 'image:'+BLUE] 였고(RED 가 말없이 덮였다),
       2026-09-26 전엔 ['body:글자 줄 A', 'image:'+BLUE, 'image:'+RED] 였다(고른 그림이 들어갔다).
       이제 새 줄은 «빈» 이미지 줄이다 — BLUE 는 아무 데도 없어야 한다(창을 안 열었으니까). */
    expect(await linesOf(page, 0, 0)).toEqual(['body:글자 줄 A', 'image:', 'image:' + RED]);
    expect(errs).toEqual([]);
  });

  test('③ 그림 줄이 «없는» 칸의 글자 줄(= T-069 가 이미 잰 갈래) — 그대로 「이미지 추가」로 붙는다', async ({ page }) => {
    const errs = await boot(page);
    await build(page, RED);
    const m = await openMenuOnLine(page, 0, 1, 0);
    expect(m.err, m.err || '').toBeUndefined();
    expect(m.label).toBe('이미지 추가');
    expect(m.delShown).toBe(false);
    const dialogs = await pickImage(page, BLUE);
    expect(dialogs, '★그림 줄이 없는 칸에서도 파일창은 안 뜬다(같은 한 문이니 같은 답이어야 한다)').toBe(0);
    // ⛔2026-09-26 전엔 'image:'+BLUE 였다 — 이제 «빈» 이미지 줄이다.
    expect(await linesOf(page, 0, 1)).toEqual(['body:내용을 입력하세요.', 'image:']);
    expect(errs).toEqual([]);
  });

  test('④ 그림 줄 «위»에서 우클릭 — 그대로 「이미지 교체」이고 그 줄만 바뀐다', async ({ page }) => {
    const errs = await boot(page);
    await build(page, RED);
    const m = await openMenuOnLine(page, 0, 0, 1);
    expect(m.err, m.err || '').toBeUndefined();
    expect(m.label).toBe('이미지 교체');
    expect(m.delShown).toBe(true);
    const dialogs = await pickImage(page, BLUE);
    /* ★★이 한 줄이 2026-09-26 «반대 축»의 파수꾼이다 — 「추가」에서 창을 없애면서 「교체」의
       창까지 같이 죽이는 것이 이 레포의 버릇(문이 둘)이다. 그러면 위 ②③ 은 초록인 채로
       사람은 그림을 못 바꾼다. */
    expect(dialogs, '★「이미지 교체」의 파일 선택창이 죽었다 — 그림을 바꿀 길이 없어졌다').toBe(1);
    expect(await linesOf(page, 0, 0)).toEqual(['body:글자 줄 A', 'image:' + BLUE]);
    expect(errs).toEqual([]);
  });

  /* ⑤ ★«넣었는데 안 보이는» 거짓 성공을 막는다 — 모델에 줄이 늘어도 높이가 0 이면 화면엔 없다.
   *   ★높이의 임자는 렌더러 한 자리다(grid-block.js `_gridLineHtml` 의 `ph = h > 0 ? h : 180`).
   *     ⛔그 수(180)를 여기 적지 않는다 — 적으면 같은 값이 두 곳에 살고, 한쪽만 늙는다.
   *       여기서 재는 것은 「자리를 «차지한다»」와 「무늬가 있다」다.
   *   ★그리고 «채우는 가지가 집을 수 있는 꼴»인지까지 — 선택자는 block-drag.js 에서 떠 온다. */
  test('⑤ ★넣은 빈 슬롯이 «보인다» — 자리를 차지하고, 체크패턴이 있고, 더블클릭 가지가 집을 꼴이다', async ({ page }) => {
    const errs = await boot(page);
    await build(page, RED);
    const m = await openMenuOnLine(page, 0, 1, 0);   // 그림 줄이 «없는» 칸의 글자 줄
    expect(m.err, m.err || '').toBeUndefined();
    const dialogs = await pickImage(page, BLUE);
    expect(dialogs).toBe(0);

    const seen = await page.evaluate(() => {
      /* ★block-drag.js 의 빈 슬롯 가지가 쓰는 «그 선택자»다 — 여기서 손으로 다른 걸 적으면
         「집을 수 있다」를 재는 게 아니라 「내가 적은 걸 찾았다」를 재는 것이 된다. */
      const el = window.__block.querySelector('.grd-img-empty[data-line]');
      if (!el) return { found: false };
      const cs = getComputedStyle(el);
      return {
        found: true,
        h: Math.round(el.getBoundingClientRect().height),
        w: Math.round(el.getBoundingClientRect().width),
        bg: cs.backgroundImage || '',
        addr: [el.dataset.r, el.dataset.c, el.dataset.line].join('/'),
        /* ★대조 — 그림이 «있는» 줄은 이 선택자에 안 걸려야 한다(교체 축과 안 섞인다). */
        empties: window.__block.querySelectorAll('.grd-img-empty[data-line]').length,
      };
    });
    expect(seen.found, '★빈 슬롯이 아예 안 그려졌다 — 모델엔 줄이 있는데 화면엔 없다').toBe(true);
    expect(seen.addr, '★새 줄의 주소가 «누른 줄 다음»(0/1/1)이 아니다').toBe('0/1/1');
    expect(seen.h, '★높이가 0 이다 — 「넣었는데 안 보인다」(모델만 늘어난 거짓 성공)').toBeGreaterThan(20);
    expect(seen.w, '★폭이 0 이다 — 자리를 차지하지 못했다').toBeGreaterThan(20);
    expect(seen.bg, '★체크패턴이 없다 — 현빈이 말한 「체크패턴 있는 그것」이 아니다')
      .toMatch(/gradient/);
    expect(seen.empties, '★빈 슬롯이 «그 한 줄»이 아니다 — 다른 칸의 그림 줄까지 비워졌나').toBe(1);
    expect(errs).toEqual([]);
  });

  /* ⑥ ★이력 «한 칸» — ⌘Z 한 번에 돌아오려면 이 한 번의 넣기가 스냅샷 하나여야 한다.
   *   ★여기선 «호출 횟수»로 잰다(이 하네스엔 editor.js 의 undo 스택이 없다). 실제 ⌘Z 복원은
   *     앱에서 따로 봤다(보고에 적었다) — 이 단언이 잠그는 것은 «칸 수»뿐이다.
   *   ⛔0 이면 되돌릴 수 없고, 2 면 ⌘Z 를 두 번 눌러야 한다(중간 값에 갇히는 그 사고). */
  test('⑥ ★빈 슬롯 넣기는 이력을 «한 칸»만 쌓는다 (⌘Z 한 번)', async ({ page }) => {
    const errs = await boot(page);
    await build(page, RED);
    await page.evaluate(() => { window.__hist = 0; window.pushHistory = () => { window.__hist++; }; });
    const m = await openMenuOnLine(page, 0, 1, 0);
    expect(m.err, m.err || '').toBeUndefined();
    await pickImage(page, BLUE);
    const hist = await page.evaluate(() => window.__hist);
    expect(hist, '★이력 칸 수가 1 이 아니다 — 0 이면 못 되돌리고, 2 면 ⌘Z 한 번이 중간 값에 멈춘다').toBe(1);
    expect(errs).toEqual([]);
  });
});
