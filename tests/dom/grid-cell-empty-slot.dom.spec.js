/* grid-cell-empty-slot.dom.spec.js — 「그리드 칸을 «빈 셀»로 둘 수 있는가」의 계약. (2026-09-25)
 *
 * ★현빈이 «세 번» 물으신 것 — 그래서 이 파일의 ①이 그 물음 그대로다.
 *     「빈 슬롯이 들어갈 수 있어야지. … 칸의 마지막 줄은 그리고 왜 삭제가 안 되니?
 *      빈 셀로도 두고 싶을 수도 있잖아?」  「처음에 체크패턴으로 둘 수 있을 것 같은데」
 *
 * ★무엇이 막고 있었나 — 우클릭 「이미지 삭제」(block-factory.js bcm-grid-img-del)가
 *   `lines.filter(i !== addr.li)` 로 «줄을 통째로» 뺐다. 칸에 줄이 하나뿐이면 `lines:[]` 가 되고
 *   입구(grid-block.js _gridRejectLinesLength)가 EMPTY_CELL_LINES 로 거절한다.
 *   ⇒ 「마지막 줄은 이미지가 안 지워진다」. ②가 그 막는 자리를 «지금도 살아 있는 채로» 못박는다.
 * ★어떻게 고쳤나 — 가드를 «푸는» 쪽이 아니라 «지울 일을 없애는» 쪽. 그림만 비우고 줄은 남긴다
 *   (patchCell{lineIndex, imgSrc:''}) ⇒ 줄 길이가 안 바뀌니 가드에 애초에 안 닿는다.
 *
 * ★★이 파일은 «진짜 우클릭 메뉴»를 띄워 «진짜 핸들러»를 누른다 — 패치 모양을 손으로 베끼지
 *   않는다. (grid-rclick-line-target.dom.spec.js 가 세운 선례. 그 파일이 이 메뉴의 «표적»을
 *   재고, 이 파일은 같은 메뉴의 «삭제»가 무엇을 하는지를 잰다.)
 *
 * ⛔「줄 삭제」(prop-grid.js grd-line-del-btn)·Backspace 는 여기서 «안» 잰다 — 그 둘은 여전히
 *   줄을 빼고, 마지막 한 줄 보호도 그대로다. 그 몫은 grid-line-delete.dom.spec.js 가 진다.
 *   ★두 계약이 갈린 까닭은 그 파일 머리말에 같이 적어 뒀다(둘이 따로 늙지 않게).
 *
 * 여기서 재는 것:
 *   ① ★핵심 — 칸에 «마지막 한 줄»(그림 하나)만 있어도 「이미지 삭제」가 «된다». 줄은 남는다.
 *   ② ★전제 — 옛 방식(lines:[])은 «지금도» EMPTY_CELL_LINES 로 막힌다(가드가 살아 있다).
 *   ③ 줄이 둘일 때도 «비우기»다 — 줄 수가 안 준다(「줄 삭제」와 갈린다).
 *   ④ 빈 슬롯이 «체크패턴으로 그려진다» ＋ 그 무늬가 «인라인이 아니다»(배송 함정).
 *   ⑤ 저장·재열기 — 그림 없는 image 줄이 왕복 뒤에도 살아 있고 다시 그려진다.
 *   ⑥ 내보내기 — 붙은 클론(PNG·썸네일 축)에서 중화기가 체커를 걷는다 ＋ ★양성대조.
 *   ⑦ 내보내기 — 단독 HTML 축: export-html 이 그 클래스를 «편집 전용»으로 벗긴다.
 *
 * ⛔앱을 «안» 띄운다. 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grid-cell-empty-slot
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* ★메뉴 마크업은 «index.html 에서 떠 온다» — 여기 베끼면 딱지 id 가 하나 바뀔 때 이 그물만 늙는다.
   (grid-rclick-line-target.dom.spec.js 와 «같은 함수»다 — 그 파일의 주석에 까닭이 있다) */
function contextMenuMarkup() {
  const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const start = html.indexOf('<div id="block-context-menu"');
  if (start < 0) throw new Error('index.html 에서 #block-context-menu 를 못 찾았다');
  const end = html.indexOf('<!-- 색상 조정 플로팅 패널', start);
  if (end < 0) throw new Error('index.html 에서 메뉴 마크업의 끝을 못 찾았다');
  return html.slice(start, end);
}

/* 40×40 단색 PNG — 「비웠다」를 «표시»가 아니라 «바이트»로 가른다. */
const RED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAIAAAADnC86AAAAL0lEQVR4nO3NMQ0AAAgDsMmZfz2IwQQJT5P+zbQvIhaLxWKxWCwWi8VisVgsFt9ZIvNTarZAi6sAAAAASUVORK5CYII=';

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
  import { neutralizeEmptyImageCheckerForCapture } from '/js/io/capture-safety.js';
  import { collectCanvasCss } from '/js/io/export-css-collect.js';
  window.__collectCss = collectCanvasCss;
  window.updateGridBlock = updateGridBlock;
  window.getGridModel = getGridModel;
  window.renderGridBlock = renderGridBlock;
  window.__mk = makeGridBlock;
  window.__model = getGridModel;
  window.__neutralize = neutralizeEmptyImageCheckerForCapture;
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

/** 칸 (0,0) 에 `lines` 를 그대로 세운다. ★①은 여기 «그림 한 줄»만 넣는다(= 마지막 줄). */
async function build(page, lines) {
  await page.evaluate(({ lines }) => {
    document.getElementById('host').innerHTML = '';
    const { row, block } = window.__mk({ gap: 24, valign: 'top', cols: [
      { width: 1, lines: [{ type: 'body', text: '자리' }] },
      { width: 1, lines: [{ type: 'body', text: '내용을 입력하세요.' }] },
    ] });
    document.getElementById('host').appendChild(row);
    block.classList.add('selected');
    window.updateGridBlock(block.id, { patchCell: { r: 0, c: 0, lines } });
    window.__block = block;
  }, { lines });
}

/** 그 줄의 «가운데»에 contextmenu 를 쏘고, 「이미지 삭제」가 떴는지까지 같은 자리에서 본다. */
async function openMenuOnLine(page, r, c, li) {
  return page.evaluate(({ r, c, li }) => {
    const sel = `[data-r="${r}"][data-c="${c}"][data-line="${li}"]`;
    const el = window.__block.querySelector(sel);
    if (!el) return { err: '줄을 못 찾았다: ' + sel };
    const box = el.getBoundingClientRect();
    const x = Math.round(box.left + box.width / 2), y = Math.round(box.top + box.height / 2);
    const hit = document.elementFromPoint(x, y);
    if (!(el === hit || el.contains(hit))) return { err: '그 점에 다른 것이 있다: ' + (hit && hit.className) };
    window._openBlockContextMenu(
      new MouseEvent('contextmenu', { clientX: x, clientY: y, bubbles: true, cancelable: true }), window.__block);
    return { delShown: getComputedStyle(document.getElementById('bcm-grid-img-del')).display !== 'none' };
  }, { r, c, li });
}

/** 열린 메뉴의 「이미지 삭제」를 «진짜로» 누른다. */
async function clickDelete(page) {
  await page.evaluate(() => document.getElementById('bcm-grid-img-del').click());
  await page.waitForTimeout(150);
}

/** 칸의 줄들을 «정체»로 찍어 낸다 — image 는 imgSrc 바이트까지 본다. */
const linesOf = (page, r, c) => page.evaluate(({ r, c }) => {
  const ls = window.__model(window.__block).cells[r][c].lines || [];
  return ls.map((l) => (l.type === 'image' ? 'image:' + (l.imgSrc || '') : l.type + ':' + (l.text ?? '')));
}, { r, c });

/* ═══ ① ★핵심 — 현빈이 세 번 물으신 그것 ══════════════════════════════════════ */
test('① ★칸에 «마지막 한 줄»(그림 하나)만 있어도 「이미지 삭제」가 된다 — 빈 셀로 남는다', async ({ page }) => {
  const errs = await boot(page);
  await build(page, [{ type: 'image', imgSrc: RED, height: 40 }]);

  // 전제 — 정말 «한 줄»이다. 이게 2줄이면 아래 단언은 «다른 것»을 재게 된다.
  expect(await linesOf(page, 0, 0), '픽스처가 그림 한 줄이 아니다 — 이 검사가 마지막 줄을 안 잰다')
    .toEqual(['image:' + RED]);

  const m = await openMenuOnLine(page, 0, 0, 0);
  expect(m.err, m.err || '').toBeUndefined();
  expect(m.delShown, '그림 줄인데 「이미지 삭제」가 안 뜬다 — 유일한 손잡이가 없다').toBe(true);

  await clickDelete(page);

  /* ⛔고치기 «전»엔 ['image:'+RED] 그대로다 — lines:[] 가 EMPTY_CELL_LINES 로 막혀
     «아무 일도 안 일어났다». 그게 현빈이 세 번 물으신 바로 그 증상이다. */
  expect(await linesOf(page, 0, 0), '★마지막 줄의 그림이 안 비워졌다 — 현빈 요구가 그대로 막혀 있다')
    .toEqual(['image:']);

  // 그리고 «빈 슬롯»으로 실제로 그려져야 한다 — 줄이 사라지면 칸이 주소를 잃는다.
  const ph = await page.evaluate(() => ({
    empty: window.__block.querySelectorAll('.grd-img-empty').length,
    lineEl: window.__block.querySelectorAll('[data-r="0"][data-c="0"][data-line="0"]').length,
  }));
  expect(ph.empty, '★빈 이미지 슬롯이 안 그려졌다').toBe(1);
  expect(ph.lineEl, '★[data-line] 이 사라졌다 — 칸이 «주소»를 잃었다(옛 버그의 모양)').toBe(1);
  expect(errs).toEqual([]);
});

/* ═══ ② ★전제 — 「줄을 빼는 길」은 «지금도» 막혀 있다 ═══════════════════════════ */
test('② ★가드는 살아 있다 — 마지막 줄을 lines:[] 로 빼려 하면 EMPTY_CELL_LINES 로 막힌다', async ({ page }) => {
  const errs = await boot(page);
  await build(page, [{ type: 'image', imgSrc: RED, height: 40 }]);

  /* ★이 단언이 ①의 «까닭»이다 — 가드를 푼 게 아니라 «닿지 않게» 고쳤다는 증거.
     이게 초록이 아니면 ①은 「가드가 사라져서」 통과한 것이고, 그건 옛 버그(칸이 주소를 잃음)의 부활이다. */
  const r = await page.evaluate(() =>
    window.updateGridBlock(window.__block.id, { patchCell: { r: 0, c: 0, lines: [] } }));
  expect(r.ok, '★마지막 줄이 lines:[] 로 «빠졌다» — 칸이 주소를 잃는 옛 버그가 되살아났다').toBe(false);
  expect(r.code).toBe('EMPTY_CELL_LINES');
  expect(await linesOf(page, 0, 0), '거절했다면서 데이터는 이미 건드렸다').toEqual(['image:' + RED]);
  expect(errs).toEqual([]);
});

/* ═══ ③ 「비우기」와 「줄 삭제」가 갈린다 ═══════════════════════════════════════ */
test('③ 줄이 둘이어도 「이미지 삭제」는 «비우기»다 — 줄 수가 안 준다', async ({ page }) => {
  const errs = await boot(page);
  await build(page, [{ type: 'body', text: '글자 줄 A' }, { type: 'image', imgSrc: RED, height: 40 }]);

  const m = await openMenuOnLine(page, 0, 0, 1);
  expect(m.err, m.err || '').toBeUndefined();
  await clickDelete(page);

  /* ⛔고치기 «전»엔 ['body:글자 줄 A'] 다 — 줄이 빠졌다. 지금은 자리가 남는다.
     ★「줄을 아예 빼고 싶다」는 뜻은 줄바 「줄 삭제」가 맡는다(grid-line-delete.dom.spec.js). */
  expect(await linesOf(page, 0, 0), '★줄이 빠졌다 — 「이미지 삭제」는 그림만 비워야 한다')
    .toEqual(['body:글자 줄 A', 'image:']);
  expect(errs).toEqual([]);
});

/* ═══ ④ 체크패턴 — 그려지되, «인라인»이 아니다 ═══════════════════════════════ */
test('④ ★빈 슬롯이 체크패턴으로 «그려진다» — 그리고 그 무늬는 «인라인이 아니다»(배송 함정)', async ({ page }) => {
  const errs = await boot(page);
  await build(page, [{ type: 'image', imgSrc: RED, height: 40 }]);
  await openMenuOnLine(page, 0, 0, 0);
  await clickDelete(page);

  const seen = await page.evaluate(() => {
    const el = window.__block.querySelector('.grd-img-empty');
    if (!el) return null;
    return {
      computed: getComputedStyle(el).backgroundImage || '',
      inline: el.getAttribute('style') || '',
      // 상자는 «남아야» 한다 — 빈 셀이 자리를 차지한다는 뜻 그 자체다.
      h: Math.round(el.getBoundingClientRect().height),
    };
  });
  expect(seen, '빈 슬롯 요소가 없다').not.toBeNull();
  expect(seen.computed, '★체크패턴이 «안» 그려진다 — 현빈 주문이 사라졌다')
    .toMatch(/repeating-conic-gradient/);
  /* ★★이것이 .tbl-img-cell 주석이 적어 둔 함정이다 — 인라인이면 저장본(.gdt)과 단독 HTML
     배송본에 «무늬 문자열 그대로» 실린다. 고치기 «전» 이 자리는 인라인이었다(회색 단색). */
  expect(seen.inline, '★무늬가 인라인 style 에 박혔다 — 저장본·배송본에 그대로 실린다. CSS 클래스로 둘 것')
    .not.toMatch(/repeating-conic-gradient/);
  expect(seen.h, '★빈 슬롯이 «자리»를 안 차지한다 — 빈 셀이 높이를 잃으면 칸이 무너진다').toBe(40);
  expect(errs).toEqual([]);
});

/* ═══ ⑤ 머무는가 — 입구 · 저장 · 재열기를 «갈라» 잰다 ════════════════════════ */
test('⑤ ★빈 슬롯이 «머문다» — 저장(dataset)에 실리고, 다시 열어도 살아 있다', async ({ page }) => {
  const errs = await boot(page);
  await build(page, [{ type: 'image', imgSrc: RED, height: 40 }]);
  await openMenuOnLine(page, 0, 0, 0);
  await clickDelete(page);

  // ㉠ 저장 — 그림 없는 image 줄이 «직렬화되는 자리»(dataset JSON)에 실렸나.
  const saved = await page.evaluate(() => {
    const cols = JSON.parse(window.__block.dataset.cols || '[]');
    return cols[0] && cols[0].lines;
  });
  expect(saved, '★저장 자리(dataset.cols)에 빈 image 줄이 안 실렸다 — 저장하면 사라진다')
    .toEqual([{ type: 'image', imgSrc: '', height: 40 }]);

  /* ㉡ 재열기 — 저장본을 «다시 여는 길»과 같은 절차다(editor.js:1678 —
     HTML 을 도로 심고 renderGridBlock 으로 다시 그린다). */
  const after = await page.evaluate(() => {
    const html = window.__block.outerHTML;
    const host = document.getElementById('host');
    host.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    const b = wrap.firstElementChild;
    host.appendChild(b);
    window.renderGridBlock(b);
    window.__block = b;
    const ls = window.getGridModel(b).cells[0][0].lines || [];
    return {
      lines: ls.map((l) => (l.type === 'image' ? 'image:' + (l.imgSrc || '') : l.type)),
      empty: b.querySelectorAll('.grd-img-empty').length,
      checker: (getComputedStyle(b.querySelector('.grd-img-empty') || document.body).backgroundImage || ''),
    };
  });
  expect(after.lines, '★다시 여니 빈 image 줄이 사라졌다 — 빈 셀이 «안 머문다»').toEqual(['image:']);
  expect(after.empty, '★다시 여니 빈 슬롯이 안 그려진다').toBe(1);
  expect(after.checker, '★다시 여니 체크패턴이 없다').toMatch(/repeating-conic-gradient/);
  expect(errs).toEqual([]);
});

/* ═══ ⑥ 내보내기 — PNG·썸네일 축(붙은 클론) ══════════════════════════════════ */
test('⑥ ★내보내기(PNG·썸네일 축) — 중화기가 그리드 빈 슬롯의 체커도 걷는다 ＋ 양성대조', async ({ page }) => {
  const errs = await boot(page);
  await build(page, [{ type: 'image', imgSrc: RED, height: 40 }]);
  await openMenuOnLine(page, 0, 0, 0);
  await clickDelete(page);

  const r = await page.evaluate(() => {
    const mk = () => {
      const c = window.__block.cloneNode(true);
      document.body.appendChild(c);          // ⚠️붙여야 computed 가 «클래스» 체커를 잡는다
      return c;
    };
    const read = (c) => {
      const el = c.querySelector('.grd-img-empty');
      return el ? (getComputedStyle(el).backgroundImage || '') : '(빈 슬롯 없음)';
    };
    /* ★양성대조 먼저 — 걷지 «않은» 클론에서 체커가 실제로 잡히나.
       여기가 «안» 잡히면 아래 「0건」은 계측기가 죽어서 나온 0 이다. */
    const before = mk(); const bgBefore = read(before); before.remove();
    const after = mk();
    const touched = window.__neutralize(after);
    const bgAfter = read(after); after.remove();
    return { bgBefore, bgAfter, touched };
  });

  expect(r.bgBefore, '★양성대조 실패 — 걷기 «전»에도 체커가 안 잡힌다. 계측기가 아무것도 안 보고 있다')
    .toMatch(/repeating-conic-gradient/);
  expect(r.touched, '★중화기가 그리드 빈 슬롯을 «한 건도» 안 만졌다 — 그물 밖이다').toBeGreaterThan(0);
  expect(r.bgAfter, '★걷은 뒤에도 체커가 남아 있다 — 편집용 무늬가 PNG·썸네일에 그대로 찍힌다')
    .not.toMatch(/repeating-conic-gradient/);
  expect(errs).toEqual([]);
});

/* ═══ ⑦ 내보내기 — 단독 HTML 축(클래스 벗기기) ═══════════════════════════════ */
test('⑦ ★내보내기(단독 HTML 축) — export-html 이 .grd-img-empty 를 «편집 전용»으로 안다', async () => {
  const src = fs.readFileSync(path.join(REPO, 'js/io/export-html.js'), 'utf8');
  /* 떼어낸 클론이라 computed 가 비어 «클래스» 체커는 중화기가 못 잡는다 — 그 몫은 두 자리다:
     ⑴ 여기(클래스를 벗긴다) ⑵ js/io/export-css-collect.js(CSS 수확에서 서명으로 걷는다).
     ⑵는 서명 기반이라 이름을 안 적는다 ⇒ «의도»가 코드에 남는 자리는 여기뿐이다. */
  expect(src, '★export-html 이 .grd-img-empty 를 모른다 — 편집 전용 표시라는 «의도»가 코드에 없다')
    .toMatch(/grd-img-empty/);
});

/* ═══ ⑧ 내보내기 — 단독 HTML 이 «싣는 CSS» 자체를 재다 ═══════════════════════ */
test('⑧ ★단독 HTML 이 싣는 <style> 에 그리드 빈 셀 체커가 «안 실린다» ＋ 양성대조', async ({ page }) => {
  const errs = await boot(page);
  await build(page, [{ type: 'image', imgSrc: RED, height: 40 }]);
  await openMenuOnLine(page, 0, 0, 0);
  await clickDelete(page);

  /* ★여기서 재는 것은 «의도»가 아니라 배송본에 실릴 «글자» 그 자체다 — ⑦이 소스를 읽는 것과
     다른 축이다. 클래스 벗기기(⑦)가 없어도 이 수확이 무늬를 빼야 두 겹이 성립한다. */
  const r = await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    const css = window.__collectCss(canvas, document) || '';
    return {
      hasChecker: /repeating-conic-gradient/i.test(css),
      // ★양성대조 — 수확이 그리드 규칙을 «보긴 보는가». 못 보면 위 false 는 헛된 0 이다.
      sawGridRule: /grd-img-empty/.test(css),
      len: css.length,
    };
  });

  expect(r.len, '수확한 CSS 가 비었다 — 계측기가 아무것도 안 걷었다').toBeGreaterThan(0);
  expect(r.sawGridRule,
    '★양성대조 실패 — 수확한 CSS 에 .grd-img-empty 규칙이 아예 없다. 「체커 0건」이 «안 봐서» 나온 0 이다')
    .toBe(true);
  expect(r.hasChecker,
    '★배송본 <style> 에 편집용 체크무늬가 실렸다 — 편집용 무늬가 배송물이 된다')
    .toBe(false);
  expect(errs).toEqual([]);
});
