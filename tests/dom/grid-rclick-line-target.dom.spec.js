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
       (앱에서도 같은 방식으로 쟀다: OS 파일창은 안 열고 같은 onchange 에 진짜 File 을 넘긴다) */
    const orig = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () {
      if (this.type !== 'file') return orig.apply(this, arguments);
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

/** 열린 메뉴의 「이미지 추가/교체」를 누르고, 고를 그림을 미리 정해 둔다. */
async function pickImage(page, pick) {
  await page.evaluate((pick) => {
    window.__pick = pick;
    document.getElementById('bcm-grid-img').click();
  }, pick);
  await page.waitForTimeout(150);
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

  test('② 글자 줄 위 우클릭 → 고른 그림은 «그 줄 다음»에 들어가고, 칸의 다른 그림은 안 바뀐다', async ({ page }) => {
    const errs = await boot(page);
    await build(page, RED);
    const m = await openMenuOnLine(page, 0, 0, 0);
    expect(m.err, m.err || '').toBeUndefined();
    await pickImage(page, BLUE);
    // ⛔고치기 «전»엔 ['body:글자 줄 A', 'image:'+BLUE] 다 — RED 가 «말없이» BLUE 로 덮인다.
    expect(await linesOf(page, 0, 0)).toEqual(['body:글자 줄 A', 'image:' + BLUE, 'image:' + RED]);
    expect(errs).toEqual([]);
  });

  test('③ 그림 줄이 «없는» 칸의 글자 줄(= T-069 가 이미 잰 갈래) — 그대로 「이미지 추가」로 붙는다', async ({ page }) => {
    const errs = await boot(page);
    await build(page, RED);
    const m = await openMenuOnLine(page, 0, 1, 0);
    expect(m.err, m.err || '').toBeUndefined();
    expect(m.label).toBe('이미지 추가');
    expect(m.delShown).toBe(false);
    await pickImage(page, BLUE);
    expect(await linesOf(page, 0, 1)).toEqual(['body:내용을 입력하세요.', 'image:' + BLUE]);
    expect(errs).toEqual([]);
  });

  test('④ 그림 줄 «위»에서 우클릭 — 그대로 「이미지 교체」이고 그 줄만 바뀐다', async ({ page }) => {
    const errs = await boot(page);
    await build(page, RED);
    const m = await openMenuOnLine(page, 0, 0, 1);
    expect(m.err, m.err || '').toBeUndefined();
    expect(m.label).toBe('이미지 교체');
    expect(m.delShown).toBe(true);
    await pickImage(page, BLUE);
    expect(await linesOf(page, 0, 0)).toEqual(['body:글자 줄 A', 'image:' + BLUE]);
    expect(errs).toEqual([]);
  });
});
