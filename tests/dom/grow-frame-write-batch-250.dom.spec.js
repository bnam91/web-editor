/* grow-frame-write-batch-250.dom.spec.js — 250 ㉡: growFrameToFitChildren 이 층마다 쓰고 읽어 강제 스타일 재계산이 깊이만큼 났다.
 *
 * O* = 쓰기를 미룬 뒤에도 값이 옛 함수(이 파일의 oldGrow · 고치기 전 본문 그대로)와 같은가 — 같은 장면을 두 벌 세워 대조한다.
 * P1 = 깊이 64 전 층이 넓어져도 강제 재계산이 깊이를 안 따라간다(고치기 전 판에서 빨강).
 * ⛔앱을 «안» 띄운다. 실행: npm run test:dom -- grow-frame-write-batch-250
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/css/editor-blocks.css"></head><body style="margin:0"><div id="a"></div><div id="b"></div>
  <script type="module">
    import { growFrameToFitChildren, frameFitHeight, absChildrenBottom } from '/js/frame-geometry.js';
    window.__new = growFrameToFitChildren;
    window.__old = (frameEl) => { let grown = 0; let el = frameEl;
      while (el && el.nodeType === 1 && el.dataset && el.dataset.freeLayout === 'true') {
        const boxes = [...el.children].filter(c => c.nodeType === 1 && c.style && c.style.position === 'absolute').map(c => ({ top: parseFloat(c.style.top) || 0, height: c.offsetHeight || 0 }));
        if (boxes.length) { const curH = el.offsetHeight || 0; const chrome = Math.max(0, curH - (el.clientHeight || 0)); const newH = frameFitHeight(curH, absChildrenBottom(boxes), chrome);
          if (newH > curH) { el.style.height = newH + 'px'; el.style.minHeight = newH + 'px'; el.dataset.height = String(newH); grown++; } }
        el = el.parentElement && el.parentElement.closest ? el.parentElement.closest('.frame-block[data-free-layout]') : null; }
      return grown; };
    /* 장면 마디: { k:'f'(프레임)|'w'(사이 상자), free, abs, top, h, border, start, kids } */
    window.__build = (host, n) => { const e = document.createElement('div'); if (n.k !== 'w') { e.className = 'frame-block'; if (n.free !== undefined) e.dataset.freeLayout = String(n.free); } if (n.abs) { e.style.position = 'absolute'; e.style.top = (n.top || 0) + 'px'; e.style.left = '0px'; } if (n.h) e.style.height = n.h + 'px'; if (n.border) e.style.border = n.border + 'px solid red'; if (n.start) e.dataset.start = '1'; host.appendChild(e); (n.kids || []).forEach((k) => window.__build(e, k)); return e; };
    window.__snap = (host) => [...host.querySelectorAll('*')].map((e) => [e.style.height, e.style.minHeight, e.dataset.height ?? null, e.offsetHeight]);
    window.__ready = true;
  </script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

const free = (o, ...kids) => ({ k: 'f', free: true, ...o, kids });
const SCENES = {
  'O1 사슬 — 맨 아래가 넘치면 꼭대기까지': free({ h: 100 }, free({ abs: 1, top: 5, h: 80 }, free({ abs: 1, top: 5, h: 60 }, free({ abs: 1, top: 500, h: 40, start: 1 }, free({ abs: 1, top: 700, h: 40 }))))),
  'O2 테두리(chrome)가 있는 층': free({ h: 100, border: 3 }, free({ abs: 1, top: 7, h: 80, border: 5 }, free({ abs: 1, top: 200, h: 50, start: 1, border: 2 }, free({ abs: 1, top: 300, h: 30 })))),
  'O3 넓어진 층보다 큰 형제': free({ h: 100 }, free({ abs: 1, top: 900, h: 50 }), free({ abs: 1, top: 10, h: 50, start: 1 }, free({ abs: 1, top: 200, h: 50 }))),
  'O4 가운데 층은 안 넓어져도 위는 제 몫을 본다': free({ h: 50 }, free({ abs: 1, top: 10, h: 2000 }, free({ abs: 1, top: 10, h: 40, start: 1 }, free({ abs: 1, top: 100, h: 40 })))),
  'O5 사이에 흐름 상자(높이 자동) — 먼저 써야 부모가 맞게 읽는다': free({ h: 100 }, { k: 'w', abs: 1, top: 20, kids: [free({ h: 50, start: 1 }, free({ abs: 1, top: 300, h: 40 }))] }),
  'O6 흐름 자식 — 부모 높이가 자동이면 실제 배치를 읽는다': free({}, free({ abs: 1, top: 10, h: 20 }), free({ h: 50, start: 1 }, free({ abs: 1, top: 300, h: 40 }))),
  'O7 자유배치 아닌 프레임에서 멈춘다': free({ h: 100 }, { k: 'f', free: false, abs: 1, top: 0, h: 80, kids: [free({ abs: 1, top: 0, h: 60, start: 1 }, free({ abs: 1, top: 400, h: 40 }))] }),
  'O8 자식 없음 · 안 넘침': free({ h: 100 }, free({ abs: 1, top: 0, h: 50, start: 1 })),
};

for (const [name, scene] of Object.entries(SCENES)) {
  test(`${name} — 옛 함수와 같은 값`, async ({ page }) => {
    const errs = await boot(page);
    const r = await page.evaluate((scene) => { const run = (id, fn) => { const host = document.getElementById(id); window.__build(host, scene); const s = host.querySelector('[data-start]'); const grown = fn(s); return { grown, snap: window.__snap(host) }; }; return { n: run('a', window.__new), o: run('b', window.__old) }; }, scene);
    expect(r.n.grown).toBe(r.o.grown);
    expect(r.n.snap).toEqual(r.o.snap);
    expect(errs).toEqual([]);
  });
}

test('O0 양성대조 — 이 장면들이 실제로 넓히거나(O1) 안 넓힌다(O8)', async ({ page }) => {
  await boot(page);
  const grown = (scene) => page.evaluate((scene) => { const host = document.getElementById('b'); host.innerHTML = ''; window.__build(host, scene); return window.__old(host.querySelector('[data-start]')); }, scene);
  expect(await grown(SCENES['O1 사슬 — 맨 아래가 넘치면 꼭대기까지'])).toBeGreaterThanOrEqual(3);
  expect(await grown(SCENES['O8 자식 없음 · 안 넘침'])).toBe(0);
});

test('P1 ★깊이 64 전 층이 넓어져도 강제 재계산은 깊이를 안 따라간다', async ({ page }) => {
  await boot(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  await page.evaluate(() => { let n = { k: 'f', free: true, abs: 1, top: 900, h: 10 }; for (let i = 0; i < 64; i++) n = { k: 'f', free: true, abs: 1, top: 2, h: 20, start: i === 0 ? 1 : undefined, kids: [n] }; window.__build(document.getElementById('a'), n); window.__deep = [...document.querySelectorAll('#a .frame-block')].at(-2); void document.body.offsetHeight; });
  const a = await m();
  const grown = await page.evaluate(() => window.__new(window.__deep));
  const b = await m();
  const n = b.RecalcStyleCount - a.RecalcStyleCount;
  expect(grown).toBe(64);
  expect(n, `재계산 ${n}회`).toBeLessThanOrEqual(4);
});
