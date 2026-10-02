/* card-thumb-top.dom.spec.js — 프로젝트 카드 그림은 «첫 화면»(맨 윗머리)을 보여줘야 한다. (T-87)
 *
 * ★왜 필요한가 — 2026-09-21 실앱 실측(워크트리 wt-f2-thumb, 9549)
 *   썸네일(js/io/save-load.js captureThumbnail)은 «첫 섹션 통째»를 200px 너비로 줄인 그림이라
 *   세로로 아주 길다(실측 200×330, 긴 상세페이지면 200×1000 도 나온다).
 *   카드 칸은 210×130 뿐인데 object-position 이 기본값(center)이면 cover 가 «가운데 띠»만 남긴다.
 *   상세페이지의 가운데는 대개 본문 여백 ⇒ 카드가 하얀 빈 칸이 되고 무슨 작업물인지 구분이 안 된다.
 *   (실측: 200×330 이 210.3×130 칸에서 원본 y 103~227 만 보였다 — 제목·배지·이미지 전부 잘림.)
 *
 * ★여기서 재는 것 — «이름»이 아니라 «성질»이다.
 *   ⒜ 진짜 픽셀: 칸을 찍어(page.screenshot) 원본 맨 위의 표식색이 실제로 화면에 있는지 센다.
 *   ⒝ 보이는 띠: 칸 크기·원본 크기·computed object-fit/position 으로 «보이는 원본 y 구간»을
 *      계산해, 그 구간이 y=0(맨 위)을 포함하는지 본다. 격자 보기·리스트 보기 둘 다.
 *   ⇒ computed 값으로 재므로 «CSS 에서 object-position 을 지우기»도, «인라인 style 로 덮어쓰기»도
 *     똑같이 잡는다. 음성대조 실측(2026-09-21): 둘 다 3/3 빨강 · 표식색 0.0% · 보이는 띠 242.3~357.7.
 *
 * ★하네스 = «진짜 pages/projects.html» 그대로. window.electronAPI 만 메모리 목으로 갈아 끼운다.
 *   ⛔앱을 «안» 띄운다 — 고디터 인스턴스·포트 무접촉.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js card-thumb-top
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
               '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

/* ── 표식 썸네일: 200×600, 맨 위 100줄만 빨강(#d64040), 나머지는 흰색 ──
 * 실제 썸네일과 «같은 성질»(세로로 아주 긴 그림 + 위쪽에만 알맹이)을 만든다.  */
const MARK = [0xd6, 0x40, 0x40];
const THUMB_W = 200, THUMB_H = 600, MARK_H = 100;
function markerPng() {
  const rows = [];
  for (let y = 0; y < THUMB_H; y++) {
    const px = y < MARK_H ? MARK : [255, 255, 255];
    const line = Buffer.alloc(1 + THUMB_W * 3);
    for (let x = 0; x < THUMB_W; x++) { line[1 + x * 3] = px[0]; line[2 + x * 3] = px[1]; line[3 + x * 3] = px[2]; }
    rows.push(line);
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(body) >>> 0 : crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  // node 의 zlib.crc32 는 20.12+ 에만 있다 — 없으면 직접 센다(표 캐시).
  let TBL = null;
  function crc32(buf) {
    if (!TBL) { TBL = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; TBL[n] = c; } }
    let c = -1; for (let i = 0; i < buf.length; i++) c = TBL[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(THUMB_W, 0); ihdr.writeUInt32BE(THUMB_H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return 'data:image/png;base64,' + png.toString('base64');
}
const THUMB_SRC = markerPng();

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

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.addInitScript(installMock, THUMB_SRC);
  await page.goto(`${ORIGIN}/pages/projects.html`);
  await page.waitForFunction(() => {
    const i = document.querySelector('#project-grid .project-card .card-thumb img');
    return !!i && i.complete && i.naturalHeight > 0;
  });
}

/** 칸 크기·원본 크기·computed object-fit/position 으로 «보이는 원본 y 구간»을 CSS 규격대로 계산한다. */
function visibleBand(page, listView) {
  return page.evaluate((isList) => {
    const grid = document.getElementById('project-grid');
    grid.classList.toggle('is-list', !!isList);
    const img = grid.querySelector('.project-card .card-thumb img');
    const r = img.getBoundingClientRect();
    const cs = getComputedStyle(img);
    const nw = img.naturalWidth, nh = img.naturalHeight;
    const fit = cs.objectFit;
    const posY = cs.objectPosition.split(/\s+/)[1] || '50%';
    const scale = fit === 'cover' ? Math.max(r.width / nw, r.height / nh)
                : fit === 'contain' ? Math.min(r.width / nw, r.height / nh)
                : null;                       // fill/none/scale-down 은 여기선 «다른 이야기»
    const out = { fit, objectPosition: cs.objectPosition, box: [r.width, r.height], natural: [nw, nh], scale };
    if (scale == null) { grid.classList.remove('is-list'); return out; }
    const drawnH = nh * scale;
    // object-position 의 y 퍼센트: 남는(또는 넘치는) 길이를 그 비율로 나눈다
    const fracY = posY.endsWith('%') ? parseFloat(posY) / 100 : (parseFloat(posY) / Math.max(1, (r.height - drawnH)) || 0);
    const offsetY = (r.height - drawnH) * fracY;     // cover 면 음수(=위가 잘림)
    out.srcTop = Math.max(0, -offsetY / scale);
    out.srcBottom = Math.min(nh, out.srcTop + r.height / scale);
    grid.classList.remove('is-list');
    return out;
  }, listView);
}

/** 칸을 진짜로 찍어서 표식색 픽셀 비율을 센다(원본 맨 위가 화면에 «있는가»). */
async function markerRatio(page) {
  const box = await page.evaluate(() => {
    const q = document.querySelector('#project-grid .project-card .card-thumb').getBoundingClientRect();
    return { x: q.left, y: q.top, width: q.width, height: q.height };
  });
  const shot = await page.screenshot({ clip: box });
  return page.evaluate(async ({ b64, mark }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let hit = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i] - mark[0]) <= 12 && Math.abs(d[i + 1] - mark[1]) <= 12 && Math.abs(d[i + 2] - mark[2]) <= 12) hit++;
    }
    return hit / (c.width * c.height);
  }, { b64: shot.toString('base64'), mark: MARK });
}

test('⒜ 진짜 픽셀 — 카드 그림에 원본 맨 위(표식색)가 실제로 보인다', async ({ page }) => {
  await boot(page);
  const ratio = await markerRatio(page);
  /* 위를 맞추면: 칸 130px · cover 배율 = max(210/200, 130/600) ≒ 1.05 → 보이는 원본 ≒ 0~124줄 중 0~100 이 표식
     ⇒ 절반을 훌쩍 넘는다. 가운데(기본값)면 원본 238~362 줄만 보여 표식이 «0%» 다. */
  expect(ratio, `표식색 비율 ${(ratio * 100).toFixed(1)}% — 카드 그림이 원본 맨 위를 안 보여준다`).toBeGreaterThan(0.5);
});

test('⒝ 보이는 띠 — 격자 보기에서 원본 y=0 을 포함한다', async ({ page }) => {
  await boot(page);
  const b = await visibleBand(page, false);
  expect(b.scale, `object-fit=${b.fit} — cover/contain 이 아니면 이 잣대가 안 맞는다`).not.toBeNull();
  expect(b.srcTop, `보이는 원본 구간 ${b.srcTop?.toFixed(1)}~${b.srcBottom?.toFixed(1)} (object-position:${b.objectPosition})`).toBeLessThanOrEqual(1);
});

test('⒝-2 보이는 띠 — 리스트 보기(46×30)에서도 원본 y=0 을 포함한다', async ({ page }) => {
  await boot(page);
  const b = await visibleBand(page, true);
  expect(b.scale).not.toBeNull();
  expect(b.srcTop, `리스트 보기: ${b.srcTop?.toFixed(1)}~${b.srcBottom?.toFixed(1)} (object-position:${b.objectPosition})`).toBeLessThanOrEqual(1);
});
