/* export-section-height-exph.dom.spec.js — EXPORT-HEIGHT-SHORT-GREY-ROW-01 (2026-11-09)
 *
 * ★증상(미카사 실앱) — 그리드(«나란히 두 칸» + 빈 그림칸 + 구분선) 섹션을 「이 섹션 내보내기」 하면 PNG 가 35px 짧다
 *   (653.1875 → 618 · 맨 아래 갭 100→65). 0.9.11 에선 높이 소수부 .9375 일 때 마지막 줄이 회색(140).
 * ★기전(이 스펙의 음성대조로 확인) — 내보내기 클론은 #canvas «밖»(body)에 붙는다. 빈 글자 줄의 높이는
 *   `#canvas .grid-block .grd-body:empty::before{content:'내용'}` 안내문이 만들었는데, 그 규칙이 클론엔 안 걸려
 *   duo 의 빈 줄 두 개가 0 으로 접혔다(같은 행이라 35.19px 한 번). 헤드리스 실측: 화면 653.17 → 클론 617.98.
 * ⛔앱을 «안» 띄운다 — prepareCloneForCapture · captureCloneToCanvas 를 «진짜로» 부른다.
 *   captureSectionCdp 만 page.screenshot 으로 바꿔 끼운다(회색 바탕 위에서 클론을 찍는다).
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css"><link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-canvas.css"><link rel="stylesheet" href="/css/editor-blocks.css">
<style>html,body{margin:0;background:rgb(140,140,140)} #canvas{margin-top:1500px}</style></head><body>
<div id="canvas"><div class="section-block" id="sec1" style="width:860px;background:#ffffff"><div class="section-inner" id="host"></div></div></div>
<script src="/js/io/section-serialize.js"></script><script src="/js/design-system.js"></script>
<script type="module">
  import '/js/globals.js';
  import { makeGridBlock, updateGridBlock } from '/js/blocks/grid-block.js';
  const ex = await import('/js/io/export-image.js');
  window.__mk = makeGridBlock; window.__update = updateGridBlock; window.__ex = ex;
  window.__ready = true;
</script></body></html>`;

const PH = '내용을 입력하세요.';
/* 미카사 0.9.10 판: 칸(0,0)=[body, duo(빈 body ×2), 이미지, 원형 이미지] · 칸(0,1)=[body, 구분선] */
const GRID = [[
  { lines: [{ type: 'body', text: PH },
    { type: 'duo', gap: 8, cols: [{ width: 1, lines: [{ type: 'body', text: '' }] }, { width: 1, lines: [{ type: 'body', text: '' }] }] },
    { type: 'image', imgSrc: '' },
    { type: 'image', imgSrc: '', imgShape: 'circle', height: 120 }] },
  { lines: [{ type: 'body', text: PH }, { type: 'divider' }] },
]];

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__h.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto(`${ORIGIN}/__h.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/** 갭100 · 제목 · (그리드) · 갭(bottomGap) 섹션을 깔고, 클론을 만들어 잰다. */
function measure(page, grid, bottomGap = 100) {
  return page.evaluate(async ([grid, bottomGap]) => {
    const host = document.getElementById('host'); host.innerHTML = '';
    host.insertAdjacentHTML('beforeend', '<div class="row"><div class="gap-block" style="height:100px"></div></div><div class="row"><div class="text-block"><h2 class="tb-h2">제목</h2></div></div>');
    let ok = true;
    if (grid) { const { row, block } = window.__mk({ cols: [{ width: 1 }, { width: 1 }] }); host.appendChild(row); ok = window.__update(block.id, { cells: grid }).ok; }
    host.insertAdjacentHTML('beforeend', `<div class="row"><div class="gap-block" id="lastgap" style="height:${bottomGap}px"></div></div>`);
    const sec = document.getElementById('sec1');
    const liveH = sec.getBoundingClientRect().height;
    const clone = await window.__ex.prepareCloneForCapture(sec, 860, true);
    window.__ex.renderComponentsInClone(clone);
    const cr = clone.getBoundingClientRect();
    const gr = clone.querySelector('#lastgap').getBoundingClientRect();
    const nest = clone.querySelector('.grd-nested');
    const r = { ok, liveH, cloneH: cr.height, gapH: gr.height, gapToBottom: cr.bottom - gr.bottom,
      nestH: nest ? nest.getBoundingClientRect().height : null,
      text: clone.innerText, phHidden: [...clone.querySelectorAll('[data-is-placeholder="true"]')].every(e => getComputedStyle(e).visibility === 'hidden') };
    clone.remove();
    return r;
  }, [grid, bottomGap]);
}

test.describe('EXPORT-HEIGHT — 섹션 내보내기 높이 = 화면 높이', () => {
  test('H1 ★그리드(duo·빈 그림칸·구분선) 섹션 — 클론 높이 = 화면 높이, 맨 아래 갭 안 잘림', async ({ page }) => {
    const errs = await boot(page);
    const r = await measure(page, GRID);
    expect(r.ok, '판 깔기 실패').toBe(true);
    expect(Math.abs(r.cloneH - r.liveH), `화면 ${r.liveH} ↔ 클론 ${r.cloneH} (duo ${r.nestH})`).toBeLessThanOrEqual(1);
    expect(r.gapH).toBe(100);
    expect(Math.abs(r.gapToBottom)).toBeLessThanOrEqual(1);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('H2 대조 — 단순 섹션(갭·제목·갭)은 그대로', async ({ page }) => {
    const errs = await boot(page);
    const r = await measure(page, null);
    expect(Math.abs(r.cloneH - r.liveH)).toBeLessThanOrEqual(0.01);
    expect(Math.round(r.liveH)).toBe(283);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('H3 안내문은 여전히 안 그려진다(글자·가상요소·픽셀)', async ({ page }) => {
    const errs = await boot(page);
    const r = await measure(page, GRID);
    expect(r.text).not.toContain('내용');
    expect(r.text).not.toContain('입력하세요');
    expect(r.phHidden, 'data-is-placeholder 가 visibility:hidden 이 아니다').toBe(true);
    /* duo 빈 줄 자리를 찍어 «흰색뿐»인지 본다 */
    const box = await page.evaluate(async () => {
      const sec = document.getElementById('sec1');
      const clone = await window.__ex.prepareCloneForCapture(sec, 860, true);
      window.__ex.renderComponentsInClone(clone);
      clone.id = '__c'; clone.style.top = '0px'; clone.getBoundingClientRect();
      const n = clone.querySelector('.grd-nested').getBoundingClientRect();
      return { x: n.x, y: n.y, width: n.width, height: n.height };
    });
    expect(box.height).toBeGreaterThan(30);
    const png = await page.screenshot({ clip: box });
    const nonWhite = await page.evaluate(async (b64) => {
      const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
      const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
      const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0);
      const d = cx.getImageData(0, 0, cv.width, cv.height).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250) n++;
      return n;
    }, png.toString('base64'));
    expect(nonWhite, '빈 줄 자리에 무언가 그려졌다').toBe(0);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('H4 ★소수 높이 .9375 — 캡처 높이는 올림, 마지막 줄은 섹션 바탕(흰색)', async ({ page }) => {
    const errs = await boot(page);
    /* captureSectionCdp 대역: 클론을 잠깐 화면(top 0)으로 올려 회색 바탕 위에서 클립 그대로 찍는다 */
    await page.exposeFunction('__shot', async (clip) => (await page.screenshot({ clip })).toString('base64'));
    const r = await page.evaluate(async () => {
      const host = document.getElementById('host');
      host.innerHTML = '<div class="row"><div class="gap-block" style="height:627.9375px"></div></div>';
      const sec = document.getElementById('sec1');
      const liveH = sec.getBoundingClientRect().height;
      let asked = null;
      window.electronAPI = { captureSectionCdp: async (o) => {
        asked = o;
        const c = [...document.body.children].find(e => e.style.top === '-99999px');
        c.style.top = '0px'; c.getBoundingClientRect();
        const b64 = await window.__shot({ x: Math.round(o.x), y: 0, width: Math.ceil(o.width), height: Math.ceil(o.height) });
        c.style.top = '-99999px';
        return b64;
      } };
      const clone = await window.__ex.prepareCloneForCapture(sec, 860, true);
      window.__ex.renderComponentsInClone(clone);
      const { canvas } = await window.__ex.captureCloneToCanvas(clone, 860, '#ffffff', true, sec);
      const cloneH = clone.getBoundingClientRect().height;
      clone.remove();
      const last = canvas.getContext('2d').getImageData(0, canvas.height - 1, canvas.width, 1).data;
      let minC = 255; for (let i = 0; i < last.length; i += 4) minC = Math.min(minC, last[i], last[i + 1], last[i + 2]);
      return { liveH, cloneH, askedH: asked.height, cvH: canvas.height, minC };
    });
    expect(r.liveH).toBeCloseTo(627.9375, 3);
    expect(r.askedH, '캡처 요청 높이는 올림').toBe(628);
    expect(r.cloneH, '클론이 클립 끝까지 덮어야 한다(정수로 올림)').toBe(628);
    expect(r.cvH).toBe(628);
    expect(r.minC, `마지막 줄 최소 채널 ${r.minC} — 회색이 비친다`).toBeGreaterThanOrEqual(250);
    expect(errs, errs.join('\n')).toEqual([]);
  });
});
