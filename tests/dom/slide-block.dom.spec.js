/* slide-block — 0.9.13 MOTION-SLIDE-BLOCK-01 1단계 MVP(현빈 261116 · 설계 DESIGN-ty-0913-motion-261116.md · 지디 GO).
 *   ★잰다: 진짜 추가 메뉴 클릭 · 진짜 파일창(filechooser) · 진짜 패널 단추(↓ · ✕) · 진짜 ⌘Z · 진짜 GIF 버튼 · 진짜 효과 클릭 · 진짜 호버 ▶.
 *   가짜는 electronAPI 둘만(⛔실데이터 0): assetsSaveCanvasImage = goya-asset URL · assetsReadAsDataUri = 그 파일의 data URL(빨강·파랑 PNG) — 캔버스는 IPC 로 받은 data 로만 그린다(지디 261116).
 * M1 추가 메뉴: 관리자 아님 = «Slides» 안 보임 · 관리자 = 보임 → 누르면 슬라이드 블럭 + 오른쪽 패널(내용만) · 사진 둘(파일창) → data-slides 2 · 첫 장면 img 2 ·
 *    ↓ = 순서 바뀜 · ✕ = 빠짐 · ⌘Z 한 번 = 빼기 전 · pageerror 0
 * M2 GIF 버튼 → GIF 패널: 효과 목록 = 흐름·스와이프만 · 글자 칸(도장 시작·줄마다) 숨김 · 방향 칸 보임 · 머무름 칸은 스와이프만 ·
 *    안내 줄 «상한 60» · 미리보기에 빨강·파랑(사진이 그려짐) · 읽기 IPC 가 두 파일을 읽음
 * M3 GIF 저장 = 오염 0: 프레임마다 getImageData 가 던지지 않음(가짜 GIF 가 진짜 gif.js copy 처럼 읽음) · 프레임 수 = 안내 줄 값(≤60) · 프레임에 사진 빨강 · 폭 = 블럭 × 2
 * M4 캔버스 재생: 호버 ▶ → 덮개(#canvas-scaler 층)에 사진 · 끝 멈춤 없이 움직임(사진 자리가 바뀜) · Esc 끝
 * M5 저장 왕복: 스와이프 · 오른쪽 → data-anim-fx·data-anim-slide 저장 · serializeProject → applyProjectData 뒤 그대로 + 첫 장면 img 2 ·
 *    글자 블럭 GIF 패널은 옛 그대로(글자 효과 목록 · 슬라이드 칸 숨김 · 줄마다 칸 보임)
 * M6 Figma: 첫 장면 카드 그림이 images 로 실림(지디 결정 ⓒ)
 * M7 세로(2단계 ② 세로 스크롤): 세로 흐름 고르면 첫 장면 세로 쌓임 · 방향 글 위로/아래로 · 세로 넘김 = 머무름 칸 · 미리보기 사진이 y 로 움직임 ·
 *    Figma images 가 y 로 · ⌘Z 두 번 = 가로로 · 다시 세로 고르고 저장 왕복(그림 지운 채) 뒤에도 세로
 *   양성대조(2단계 · 예측): CTL1 renderSlideBlock `const vert = …` → `const vert = false` → M7 빨강(첫 장면) · CTL2 drawSlides `const y = false` → S6·M7 빨강(미리보기 y 안 움직임) ·
 *    CTL3 엔진 고른 효과 뒤 renderSlideBlock 줄 삭제 → M7 빨강(첫 장면 안 바뀜) · CTL4 export-figma `const _v = …` → `const _v = false` → M7 빨강(Figma)
 * 양성대조(예측 · CTL 패치): ① save-load.js RERENDER_KINDS 의 slide-block 줄 삭제 → M5 빨강(왕복 뒤 첫 장면 0)
 *   ② animation-engine.js _buildAnimList 의 `const LIST = _kindList();` → `const LIST = ANIM_LIST;` → M2 빨강(글자 효과 목록)
 *   ③ slide-block.js _dataUriOf 첫 줄 뒤에 `return src;`(IPC 안 거치고 goya-asset 그대로) → M2·M3 빨강(사진이 안 그려짐)
 *   ④ export-figma-json.js 슬라이드 갈래 `if (el.classList.contains('slide-block') && …)` → `if (false)` → M6 빨강
 * 셀렉터·전역 대조(제품 소스 grep): #fp-component-dropdown .fp-dropdown-trigger · #fp-add-slide(index.html) · .slide-block .sld-img(slide-block.js) ·
 *   #sld-add · .sld-photo-row .sld-down/.sld-del(prop-slide.js) · #open-anim-btn(prop-slide.js) · #anim-list .anim-item[data-id] · #anim-slide-row · #anim-slide-dwell-row ·
 *   #anim-stamp-s0-row · #anim-per-line · #anim-loop-info · #anim-preview-canvas · .anim-export-btn · #anim-tb-play · #anim-canvas-play(animation-engine.js) ·
 *   window.addSection · selectSection · selectBlock · flushCurrentPage · #anim-slide-dir option(animation-engine.js _syncKindRows) · addTextBlock · openAnimModal · closeAnimModal · serializeProject · applyProjectData · buildFigmaExportJSON · __admin(state)
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/** 빨강·파랑 PNG 를 페이지 캔버스로 만들어 받는다(파일창에 넣을 바이트 · 가짜 읽기 IPC 값). */
async function pngs(page) {
  return page.evaluate(() => ['#ff0000', '#0000ff'].map((c) => { const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 40, 30); return cv.toDataURL('image/png'); }));
}
async function scene(page, { admin = true } = {}) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const [R, B] = await pngs(page);
  await page.evaluate(async ({ R, B, admin }) => {
    const real = window.electronAPI, DATA = { 'r.png': R, 'b.png': B };
    window.__reads = [];
    const fake = {
      assetsSaveCanvasImage: async ({ b64 }) => ({ ok: true, url: `goya-asset://p1/${b64 === R.split(',')[1] ? 'r.png' : 'b.png'}` }),
      assetsReadAsDataUri: async ({ filename }) => { window.__reads.push(filename); return DATA[filename] ? { ok: true, dataUri: DATA[filename] } : { ok: false }; },
    };
    window.electronAPI = new Proxy(fake, { get: (t, k) => (k in t ? t[k] : real[k]) });
    window.activeProjectId = window.activeProjectId || 'p1';
    if (admin) window.__admin = { state: () => ({ isAdmin: true }) };
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    window.selectSection(c.querySelector('.section-block'));
  }, { R, B, admin });
  return { errs, R, B };
}
const menu = (page) => page.click('#fp-component-dropdown .fp-dropdown-trigger');
async function addViaMenu(page) {
  await menu(page);
  await expect(page.locator('#fp-add-slide'), '[전제] 관리자 = Slides 보임').toBeVisible();
  await page.click('#fp-add-slide');
  await expect(page.locator('#canvas .slide-block'), '[전제] 슬라이드 블럭').toHaveCount(1);
}
/* SLIDE-CELL-AS-FRAME-01(261118) — 추가 메뉴 새 블럭 = 프레임 칸(제품 의도 변경). 이 묶음(M1~M7)은 «사진 엔진»(옛 사진 모드 · 옛 저장본이 계속 탄다)을 잰다
   ⇒ 사진 모드 블럭은 입구 함수로 만든다(addSlideBlock({cellMode:'photo'}) · 메뉴와 같은 선택·패널 길). 메뉴 자체(관리자 노출·프레임 칸)는 M1 앞머리가 잰다. */
async function addPhotoSlide(page) {
  await page.evaluate(() => window.addSlideBlock({ cellMode: 'photo' }));
  await expect(page.locator('#canvas .slide-block'), '[전제] 사진 모드 슬라이드 블럭').toHaveCount(1);
  await expect(page.locator('#sld-add'), '[전제] 오른쪽 패널 = 사진 줄').toHaveCount(1);
}
async function addPhoto(page, buf, name) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sld-add')]);
  await fc.setFiles([{ name, mimeType: 'image/png', buffer: buf }]);
}
const srcs = (page) => page.evaluate(() => JSON.parse(document.querySelector('#canvas .slide-block').dataset.slides || '[]').map((s) => s.src.split('/').pop()));
const bufOf = (d) => Buffer.from(d.split(',')[1], 'base64');
async function withPhotos(page) {
  const s = await scene(page);
  await addPhotoSlide(page);
  await addPhoto(page, bufOf(s.R), 'r.png');
  await expect.poll(() => srcs(page)).toEqual(['r.png']);
  await addPhoto(page, bufOf(s.B), 'b.png');
  await expect.poll(() => srcs(page)).toEqual(['r.png', 'b.png']);
  return s;
}
/** 캔버스에 빨강·파랑이 있나 + 파랑 왼끝 x(둘째 카드 — 블럭 가운데쯤에서 시작해 흐르면 바로 움직인다) */
const colors = (page, sel) => page.evaluate((sel) => {
  const cv = document.querySelector(sel); if (!cv) return null;
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, W = cv.width;
  let red = false, blue = false, bx = Infinity, by = Infinity;
  for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], b = d[i + 2]; if (r > 200 && g < 60 && b < 60) red = true; if (b > 200 && r < 60 && g < 60) { blue = true; bx = Math.min(bx, (i / 4) % W); by = Math.min(by, Math.floor(i / 4 / W)); } }
  return { red, blue, bx, by };
}, sel);

test('M1 추가 메뉴(관리자) · 오른쪽 패널 사진 넣기·순서·빼기 · ⌘Z', async ({ page }) => {
  const s = await scene(page, { admin: false });
  await menu(page);
  await expect(page.locator('#fp-add-slide'), '★관리자 아닌데 Slides 가 보인다').toBeHidden();
  await menu(page);   // 닫기
  await page.evaluate(() => { window.__admin = { state: () => ({ isAdmin: true }) }; });
  await addViaMenu(page);
  /* SLIDE-CELL-AS-FRAME-01 — 메뉴 새 블럭 = 프레임 칸 3 · 패널 = 칸 줄 + «프레임 추가하기»(옛 = 사진 줄 · 제품 의도 변경) */
  expect(await page.evaluate(() => { const b = document.querySelector('#canvas .slide-block'); return { mode: b.dataset.cellMode, cells: b.querySelectorAll('.sld-cell').length }; })).toEqual({ mode: 'frame', cells: 3 });
  await expect(page.locator('#sld-add-cell')).toHaveCount(1);
  await page.evaluate(() => { document.querySelector('#canvas .slide-block').closest('.row').remove(); window.selectSection(document.querySelector('#canvas .section-block')); });
  /* 사진 엔진(옛 사진 모드) — 사진 넣기·순서·빼기·⌘Z */
  await addPhotoSlide(page);
  await addPhoto(page, bufOf(s.R), 'r.png');
  await expect.poll(() => srcs(page)).toEqual(['r.png']);
  await addPhoto(page, bufOf(s.B), 'b.png');
  await expect.poll(() => srcs(page), { message: '★사진 둘이 안 들어갔다' }).toEqual(['r.png', 'b.png']);
  await expect(page.locator('#canvas .slide-block .sld-img'), '첫 장면 img 2').toHaveCount(2);
  await page.click('.sld-photo-row[data-idx="0"] .sld-down');
  await expect.poll(() => srcs(page), { message: '★↓ 로 순서가 안 바뀐다' }).toEqual(['b.png', 'r.png']);
  await page.click('.sld-photo-row[data-idx="0"] .sld-del');
  await expect.poll(() => srcs(page)).toEqual(['r.png']);
  await page.keyboard.press('Meta+z');
  await expect.poll(() => srcs(page), { message: '★⌘Z 한 번에 빼기 전으로 안 돌아왔다' }).toEqual(['b.png', 'r.png']);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});

test('M2 GIF 버튼 → GIF 패널: 슬라이드 효과만 · 글자 칸 숨김 · 미리보기에 사진(IPC data)', async ({ page }) => {
  const s = await withPhotos(page);
  await page.click('#open-anim-btn');
  await expect(page.locator('#anim-gif-modal'), '[전제] GIF 패널').toBeVisible();
  expect(await page.evaluate(() => [...document.querySelectorAll('#anim-list .anim-item')].map((e) => e.dataset.id)), '★효과 목록이 슬라이드 것이 아니다').toEqual(['slide-flow', 'slide-swipe', 'slide-vflow', 'slide-vstep']);   // 2단계에서 세로 둘 더함(같은 정확 일치)
  await expect(page.locator('#anim-stamp-s0-row'), '글자 칸(도장 시작) 숨김').toBeHidden();
  await expect(page.locator('#anim-per-line'), '글자 칸(줄마다 따로) 숨김').toBeHidden();
  await expect(page.locator('#anim-slide-row'), '방향 칸 보임').toBeVisible();
  await expect(page.locator('#anim-slide-dwell-row'), '흐름엔 머무름 없음').toBeHidden();
  await page.click('#anim-list .anim-item[data-id="slide-swipe"]');
  await expect(page.locator('#anim-slide-dwell-row'), '스와이프 = 머무름 칸').toBeVisible();
  await expect(page.locator('#anim-loop-info')).toContainText('상한 60');
  await expect.poll(() => colors(page, '#anim-preview-canvas'), { timeout: 10000, message: '★미리보기에 사진(빨강·파랑)이 안 그려진다' }).toMatchObject({ red: true, blue: true });
  expect((await page.evaluate(() => window.__reads)).sort(), '읽기 IPC 가 두 파일을').toEqual(expect.arrayContaining(['b.png', 'r.png']));
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});

test('M3 GIF 저장 — 프레임마다 getImageData 오염 0 · 프레임 수 = 안내 줄(≤60) · 사진 · 폭 = 블럭×2', async ({ page }) => {
  const s = await withPhotos(page);
  await page.click('#open-anim-btn');
  await expect.poll(() => colors(page, '#anim-preview-canvas'), { timeout: 10000 }).toMatchObject({ red: true });
  await page.evaluate(() => {
    window.__gif = { frames: 0, err: null, red: false, w: 0, delays: [] };
    window.__realGIF = window.GIF;
    window.GIF = class {
      constructor(o) { this.o = o; this.h = {}; window.__gif.w = o.width; }
      addFrame(ctx, opt) {
        try {   // 진짜 gif.js 의 copy:true 와 같은 읽기 — 오염된 캔버스면 SecurityError
          const d = ctx.getImageData(0, 0, this.o.width, this.o.height).data;
          window.__gif.frames++; window.__gif.delays.push(opt.delay);
          if (!window.__gif.red) for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 60 && d[i + 2] < 60) { window.__gif.red = true; break; }
        } catch (e) { window.__gif.err = String(e); throw e; }
      }
      on(ev, f) { this.h[ev] = f; }
      render() { this.h.finished?.(new Blob(['GIF89a'], { type: 'image/gif' })); }
    };
  });
  const want = Number((await page.textContent('#anim-loop-info')).match(/GIF (\d+)프레임/)[1]);
  await page.click('.anim-export-btn');
  await expect.poll(() => page.evaluate(() => window.__gif.frames), { message: '[전제] 프레임이 쌓였다' }).toBe(want);
  const g = await page.evaluate(() => { window.GIF = window.__realGIF; return { ...window.__gif, bw: document.querySelector('#canvas .slide-block').offsetWidth }; });
  expect([g.err, g.red, g.frames <= 60, g.w], `★GIF 저장 — ${JSON.stringify(g)}`).toEqual([null, true, true, Math.max(320, Math.round(g.bw * 2))]);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});

test('M4 캔버스 재생 — 호버 ▶ · 덮개에 사진 · 멈춤 없이 움직임 · Esc 끝', async ({ page }) => {
  const s = await withPhotos(page);
  const box = await page.locator('#canvas .slide-block').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('#anim-tb-play'), '[전제] 슬라이드 블럭에 올리면 ▶').toBeVisible();
  await page.click('#anim-tb-play');
  await expect(page.locator('#anim-canvas-play')).toHaveCount(1);
  expect(await page.evaluate(() => document.getElementById('anim-canvas-play').parentElement.id), '덮개 = 캔버스 층').toBe('canvas-scaler');
  await expect.poll(() => colors(page, '#anim-canvas-play'), { timeout: 10000, message: '★덮개에 사진이 안 그려진다' }).toMatchObject({ red: true });
  await expect.poll(() => colors(page, '#anim-canvas-play'), { timeout: 10000 }).toMatchObject({ blue: true });
  const x0 = (await colors(page, '#anim-canvas-play')).bx;
  await expect.poll(async () => (await colors(page, '#anim-canvas-play'))?.bx, { timeout: 10000, message: '★재생 중 사진이 안 움직인다' }).not.toBe(x0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#anim-canvas-play')).toHaveCount(0);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});

test('M5 저장 왕복 · 글자 블럭 GIF 패널은 옛 그대로', async ({ page }) => {
  const s = await withPhotos(page);
  await page.click('#open-anim-btn');
  await page.click('#anim-list .anim-item[data-id="slide-swipe"]');
  await page.selectOption('#anim-slide-dir', 'right');
  await page.evaluate(() => window.closeAnimModal());
  const keys = () => page.evaluate(() => { const b = document.querySelector('#canvas .slide-block'); return b && { fx: b.dataset.animFx, anim: JSON.parse(b.dataset.animSlide || '{}'), imgs: b.querySelectorAll('.sld-img').length }; });
  expect(await keys(), '[전제] 블럭에 저장').toEqual({ fx: 'slide-swipe', anim: { dir: 'right' }, imgs: 2 });
  /* 그림(첫 장면)을 지운 채 저장 — dataset 만 남는다. 로드가 RERENDER_KINDS 로 다시 그려야 imgs 2(MOTION1 아이맥: 이 줄 없이는 CTL1 의 RERENDER 삭제에도 M5 가 초록이었다). */
  await page.evaluate(() => { document.querySelector('#canvas .slide-block').replaceChildren(); const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); });
  await expect.poll(keys, { message: '★저장 왕복 뒤 슬라이드 블럭이 다르다' }).toEqual({ fx: 'slide-swipe', anim: { dir: 'right' }, imgs: 2 });
  await page.evaluate(() => { window.selectSection(document.querySelector('#canvas .section-block')); window.addTextBlock('body'); const tb = [...document.querySelectorAll('#canvas .text-block')].pop(); (tb.querySelector('[contenteditable]') || tb.querySelector('.tb-body')).textContent = '네!'; window.openAnimModal(tb); });
  const ids = await page.evaluate(() => [...document.querySelectorAll('#anim-list .anim-item')].map((e) => e.dataset.id));
  expect(ids.includes('slide-up') && !ids.includes('slide-flow'), `글자 블럭 = 글자 효과 목록 — ${ids}`).toBe(true);
  await expect(page.locator('#anim-slide-row'), '글자 블럭엔 슬라이드 칸 숨김').toBeHidden();
  await expect(page.locator('#anim-per-line'), '글자 블럭엔 줄마다 칸 보임').toBeVisible();
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});

test('M6 Figma — 첫 장면 카드 그림이 images 로', async ({ page }) => {
  const s = await withPhotos(page);
  const imgs = await page.evaluate(() => {
    const id = document.querySelector('#canvas .slide-block').id;
    let node = null; const walk = (o) => { if (node || !o || typeof o !== 'object') return; if (o.id === id) { node = o; return; } Object.values(o).forEach(walk); };
    window.flushCurrentPage();   // 내보내기는 state.pages[].canvas(저장 꼴)를 읽는다 — 제품 입구(figma-publish.js)도 먼저 부른다 · T12 와 같은 길
    walk(window.buildFigmaExportJSON?.(null));
    if (!node) return { why: '블럭 노드 없음' };
    if (!Array.isArray(node.images)) return { why: 'images 없음', keys: Object.keys(node), type: node.type, width: node.width };
    return node.images.map((m) => [m.src.split('/').pop(), m.x, m.w > 0]);
  });
  expect(imgs?.[0], `★Figma 에 첫 장면 그림이 없다 — ${JSON.stringify(imgs)}`).toEqual(['r.png', 0, true]);
  expect(imgs?.[1]?.[0], '둘째 카드 = b.png').toBe('b.png');
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});

test('M7 세로 — 고르면 첫 장면 세로 · 위로/아래로 · 미리보기 y 로 움직임 · Figma y · ⌘Z 가로 · 왕복', async ({ page }) => {
  const s = await withPhotos(page);
  const cards = () => page.evaluate(() => [...document.querySelectorAll('#canvas .slide-block .sld-card')].map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; }));
  const [h0, h1] = await cards();
  expect(h1[0] > h0[0] && h1[1] === h0[1], `[전제] 가로 첫 장면 — ${JSON.stringify([h0, h1])}`).toBe(true);
  await page.click('#open-anim-btn');
  await page.click('#anim-list .anim-item[data-id="slide-vflow"]');
  const [v0, v1] = await cards();
  expect(v1[1] > v0[1] && v1[0] === v0[0], `★세로 흐름을 골랐는데 첫 장면이 세로로 안 쌓인다 — ${JSON.stringify([v0, v1])}`).toBe(true);
  expect(await page.evaluate(() => [...document.getElementById('anim-slide-dir').options].map((o) => o.textContent)), '방향 글').toEqual(['↑ 위로', '↓ 아래로']);
  await expect(page.locator('#anim-slide-dwell-row'), '세로 흐름엔 머무름 없음').toBeHidden();
  await expect.poll(() => colors(page, '#anim-preview-canvas'), { timeout: 10000 }).toMatchObject({ blue: true });
  const y0 = (await colors(page, '#anim-preview-canvas')).by;
  await expect.poll(async () => (await colors(page, '#anim-preview-canvas'))?.by, { timeout: 10000, message: '★미리보기 사진이 세로로 안 움직인다' }).not.toBe(y0);
  await page.click('#anim-list .anim-item[data-id="slide-vstep"]');
  await expect(page.locator('#anim-slide-dwell-row'), '세로 넘김 = 머무름 칸').toBeVisible();
  await page.evaluate(() => window.closeAnimModal());
  const fig = await page.evaluate(() => {
    const id = document.querySelector('#canvas .slide-block').id; let node = null;
    const walk = (o) => { if (node || !o || typeof o !== 'object') return; if (o.id === id) { node = o; return; } Object.values(o).forEach(walk); };
    window.flushCurrentPage(); walk(window.buildFigmaExportJSON?.(null));
    return node && node.images ? node.images.map((m) => [m.src.split('/').pop(), m.x, m.y > 0]) : node;
  });
  expect(fig, `★Figma 세로 자리 — ${JSON.stringify(fig)}`).toEqual([['r.png', 0, false], ['b.png', 0, true]]);
  const isVert = async () => { const [a, b] = (await cards()) || []; return a && b ? (b[1] > a[1] && b[0] === a[0] ? 'v' : b[0] > a[0] && b[1] === a[1] ? 'h' : '?') : '없음'; };
  await page.keyboard.press('Meta+z');   // 세로 넘김 → 세로 흐름
  await page.keyboard.press('Meta+z');   // 세로 흐름 → 가로 흐름(고른 «뒤» pushHistory 라 한 번에 한 칸)
  await expect.poll(isVert, { message: '★⌘Z 로 가로 첫 장면에 안 돌아간다' }).toBe('h');
  await page.evaluate(() => window.selectBlock(document.querySelector('#canvas .slide-block').id));   // 가운데 클릭은 ▶ 단추와 겹칠 수 있어 함수로
  await page.click('#open-anim-btn');
  await page.click('#anim-list .anim-item[data-id="slide-vflow"]');
  await page.evaluate(() => window.closeAnimModal());
  await page.evaluate(() => { document.querySelector('#canvas .slide-block').replaceChildren(); const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); });
  await expect.poll(isVert, { message: '★저장 왕복 뒤 세로가 풀렸다' }).toBe('v');
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
