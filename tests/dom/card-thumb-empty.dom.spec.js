/* card-thumb-empty.dom.spec.js — 카드 그림이 «빈 칸»이 되는 길을 막는다 (T-87)
 *
 * ★왜 필요한가 — 2026-09-22 실앱 실측(워크트리 wt-T087, 포트 9640)
 *   「카드가 빈 칸」의 정체는 셋으로 갈린다: ⑴ 안 만든다 ⑵ 만드는데 빈 그림이다 ⑶ 못 읽어온다.
 *   실측은 ⑵→⑶ 이었다 — canvas.toDataURL() 은 높이 0 캔버스에서 «예외를 안 던지고»
 *   "data:,"(6자)를 돌려준다. 6자는 truthy 라 _meta.json 에 «썸네일이 있다»로 저장되고,
 *   프로젝트 목록은 <img src="data:,"> 를 그린 뒤 onerror 로 그 img 를 숨겼다
 *   ⇒ 기본 아이콘조차 없는 «완전한 빈 칸»(실측: .card-thumb.innerText='' · img display:none).
 *   ⛔try/catch 로는 안 보인다. 「파일이 있다」로 재도 안 보인다. «길이/높이»를 재야 보인다.
 *
 * ★여기서 재는 것 — «이름»이 아니라 «값»이다.
 *   ㈎ 만드는 쪽(js/io/thumb-usable.js makeThumbDataUrl): 진짜 캔버스를 먹여 돌려준 값의 «길이»를 센다.
 *      음성대조로 «가드를 뺀 옛 계산»이 실제로 "data:,"(6자)를 만든다는 것도 같이 증명한다.
 *   ㈏ 그리는 쪽(진짜 pages/projects.html): 빈 그림을 물려도 칸에 «보이는 것»이 남는지 잰다(rect).
 *
 * ★하네스 = «진짜 pages/projects.html» 그대로. window.electronAPI 만 메모리 목으로 갈아 끼운다.
 *   ⛔앱을 «안» 띄운다 — 고디터 인스턴스·포트 무접촉.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js card-thumb-empty
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
               '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

async function serve(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
}

function installMock(thumb) {
  const now = new Date().toISOString();
  window.electronAPI = {
    isElectron: true,
    listProjects: async () => [{ id: 'proj_1', name: '원목 식탁 상세', updatedAt: now, folderId: null, thumbnail: thumb }],
    trashList: async () => ({ ok: true, items: [] }),
    getAuthState: async () => ({ signedIn: false }),
    folders: { list: async () => ({ ok: true, folders: [] }) },
  };
}

/* 카드 칸의 «보이는 것»을 잰다 — img 와 기본 아이콘의 실제 그려진 크기. */
async function thumbState(page) {
  await page.waitForFunction(() => !!document.querySelector('#project-grid .project-card .card-thumb'));
  return page.evaluate(() => {
    const th = document.querySelector('#project-grid .project-card .card-thumb');
    const img = th.querySelector('img');
    const fb = th.querySelector('.card-thumb-fallback');
    const vis = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; };
    const shown = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
    return {
      imgSrcLen: img ? img.getAttribute('src').length : 0,
      imgShown: shown(img),
      imgBox: vis(img),
      fbShown: shown(fb),
      fbBox: vis(fb),
      name: document.querySelector('#project-grid .project-card .card-name')?.textContent || '',
    };
  });
}

/* ── ㈎ 만드는 쪽 ───────────────────────────────────────────────────────── */

test('㈎ 빈 캔버스에서 «그럴듯한 6자»가 아니라 null 이 나온다 (+ 옛 계산의 음성대조)', async ({ page }) => {
  await serve(page);
  await page.goto(`${ORIGIN}/pages/projects.html`);   // thumb-usable.js 를 «진짜 페이지»가 싣는지까지 같이 잰다
  await page.waitForFunction(() => typeof window.makeThumbDataUrl === 'function');

  const r = await page.evaluate(() => {
    const src = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h;
      if (w && h) { const g = c.getContext('2d'); g.fillStyle = '#d64040'; g.fillRect(0, 0, w, h); } return c; };
    /* 가드를 뺀 «옛» 계산 — 이게 실제로 무엇을 돌려주는지 같이 재 둔다(음성대조). */
    const legacy = (canvas) => {
      const t = document.createElement('canvas');
      t.width = 200; t.height = Math.round(canvas.height * (200 / canvas.width));
      try { t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height); } catch (e) { return 'THREW:' + e.name; }
      return t.toDataURL('image/jpeg', 0.7);
    };
    const out = {};
    for (const h of [0, 1, 2, 3, 600]) {
      const c = src(860, h);
      const now = window.makeThumbDataUrl(c);
      const old = h === 0 ? null : legacy(c);
      out['h' + h] = { now: now === null ? null : now.length, old: old === null ? null : (old.length <= 16 ? old : old.length) };
    }
    return out;
  });

  // 음성대조 — 옛 계산은 1~2px 에서 진짜로 "data:,"(6자)를 돌려준다. 이 함정은 «상상»이 아니다.
  expect(r.h1.old, '옛 계산이 1px 에서 돌려준 값').toBe('data:,');
  expect(r.h2.old, '옛 계산이 2px 에서 돌려준 값').toBe('data:,');
  expect(typeof r.h3.old, '옛 계산은 3px 에서 «멀쩡해 보이는» 1px 짜리 얼룩을 만든다').toBe('number');

  // 지금 — 빈 그림은 전부 null 이고, 진짜 그림만 길이를 갖는다
  for (const h of [0, 1, 2, 3]) {
    expect(r['h' + h].now, `첫 섹션 ${h}px → 썸네일이 나오면 안 된다(나온 길이: ${r['h' + h].now})`).toBeNull();
  }
  expect(r.h600.now, '정상 캔버스(860×600)는 진짜 그림이어야 한다').toBeGreaterThan(128);
});

test('㈎-2 판정은 «길이»로 한다 — truthy 로 재면 빈 그림이 통과한다', async ({ page }) => {
  await serve(page);
  await page.goto(`${ORIGIN}/pages/projects.html`);
  await page.waitForFunction(() => typeof window.isUsableThumbnail === 'function');
  const r = await page.evaluate(() => ({
    emptyTruthy: !!'data:,',
    emptyUsable: window.isUsableThumbnail('data:,'),
    realUsable: window.isUsableThumbnail('data:image/jpeg;base64,' + 'A'.repeat(4000)),
  }));
  expect(r.emptyTruthy, '음성대조: 「비어 있지 않다」로 재면 참이다').toBe(true);
  expect(r.emptyUsable, '「빈 그림」 판정은 거짓이어야 한다').toBe(false);
  expect(r.realUsable).toBe(true);
});

/* ── ㈏ 그리는 쪽 ───────────────────────────────────────────────────────── */

test('㈏ 빈 그림("data:," 6자)을 물려도 카드 칸에 «보이는 것»이 남는다', async ({ page }) => {
  await serve(page);
  await page.addInitScript(installMock, 'data:,');
  await page.goto(`${ORIGIN}/pages/projects.html`);
  const s = await thumbState(page);
  expect(s.imgShown, `빈 그림이 <img> 로 그려졌다(src ${s.imgSrcLen}자)`).toBe(false);
  expect(s.fbShown, '★기본 아이콘도 없다 — 칸이 «완전한 빈 칸»이다(이 카드가 무슨 작업물인지 알 길이 없다)').toBe(true);
  expect(s.fbBox[1], `기본 아이콘 크기 ${s.fbBox && s.fbBox.join('×')}`).toBeGreaterThan(8);
  expect(s.name, '이름은 그대로 보여야 한다').toContain('원목 식탁');
});

test('㈏-2 썸네일이 아예 없어도 기본 아이콘이 보인다', async ({ page }) => {
  await serve(page);
  await page.addInitScript(installMock, null);
  await page.goto(`${ORIGIN}/pages/projects.html`);
  const s = await thumbState(page);
  expect(s.imgSrcLen, '없는 썸네일로 <img> 를 만들면 안 된다').toBe(0);
  expect(s.fbShown).toBe(true);
  expect(s.fbBox[1]).toBeGreaterThan(8);
});

test('㈏-3 진짜 그림은 그대로 보이고 기본 아이콘은 비켜 준다', async ({ page }) => {
  await serve(page);
  // 200×600 단색 PNG — card-thumb-top.dom.spec.js 와 같은 «세로로 긴» 성질
  const real = await (async () => {
    const zlib = require('zlib');
    const W = 200, H = 600;
    const rows = [];
    for (let y = 0; y < H; y++) { const l = Buffer.alloc(1 + W * 3); for (let x = 0; x < W; x++) { l[1 + x * 3] = 0xd6; l[2 + x * 3] = 0x40; l[3 + x * 3] = 0x40; } rows.push(l); }
    let TBL = null;
    const crc32 = (buf) => { if (!TBL) { TBL = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; TBL[n] = c; } } let c = -1; for (let i = 0; i < buf.length; i++) c = TBL[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
    const chunk = (type, data) => { const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
      const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
      return Buffer.concat([len, body, crc]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
    return 'data:image/png;base64,' + png.toString('base64');
  })();
  await page.addInitScript(installMock, real);
  await page.goto(`${ORIGIN}/pages/projects.html`);
  await page.waitForFunction(() => { const i = document.querySelector('#project-grid .project-card .card-thumb img'); return !!i && i.complete && i.naturalHeight > 0; });
  const s = await thumbState(page);
  expect(s.imgSrcLen, '진짜 그림의 data URL 길이').toBeGreaterThan(128);
  expect(s.imgShown).toBe(true);
  expect(s.fbShown, '진짜 그림이 있는데 기본 아이콘까지 같이 보이면 안 된다').toBe(false);
  expect(s.imgBox[1], `그림 칸 ${s.imgBox && s.imgBox.join('×')}`).toBeGreaterThan(100);
});
