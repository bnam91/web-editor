/* placeholder-selectall-banner-grid.dom.spec.js — 「안내문구 더블클릭 = 전체선택」 회귀 그물. (2026-09-21)
 *
 * ★사용자 관점 훑기(0920) U-26 «placeholder»:
 *   안내문구를 더블클릭하고 바로 타이핑하면 텍스트·모달·비교 블럭은 «교체»되는데
 *   배너(banner02)·그리드(grid)·스티커만 «이어붙는다» → 「강아지 간식제목을 입력합니다.」
 *   뿌리 = 편집진입 지점이 «이게 안내문구인가»를 판단조차 하지 않는다.
 *     - banner02-block.js  dblclick → focus() 만(Range/Selection 조작 0)
 *     - block-drag.js _gridBeginEdit → caretRangeFromPoint 로 «캐럿만»
 *     - sticker-select.js _enterStickerEdit → 좌표가 있으면 «캐럿만»(A26)
 *   고침 = 값-비교(comparison-block.js 선례)로 안내문구를 식별해 전체선택.
 *
 * ★픽스라운드(이벨류에이터 지적) 추가분
 *   ⑴ 배너 「+ 텍스트 줄 추가」가 만드는 줄('새 줄')은 «다른 파일의 다른 리터럴»이라 판정에서 빠져 있었다.
 *      → 그 줄을 «진짜 패널 버튼 클릭»으로 만들어 재는 케이스를 넣는다(리터럴을 여기 안 베낀다 —
 *        정본 window._bn2Lines.newLineText 를 읽어 쓴다. 정본이 갈라지면 이 검사가 빨강이 된다).
 *   ⑵ 스티커도 «실제로» 같은 증상이 난다(실측: 「Te강아지xt」) → 케이스 추가.
 *   ⑶ 대조군(사용자가 쓴 본문)이 not.toBe 뿐이라 «아무것도 안 해도» 통과했다
 *      → 「캐럿이 그 요소 «안»에 실제로 꽂혔다 + 포커스가 갔다 + 전체선택은 아니다」를 같이 잰다.
 *
 * ⛔앱을 «안» 띄운다. 실행: npm run test:dom -- placeholder-selectall
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const BANNER_TITLE_DEFAULT = '제목을 입력합니다.';
const GRID_CELL_DEFAULT    = '내용을 입력하세요.';
const STICKER_TEXT_DEFAULT = 'Text';

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host"></div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script>
  /* 앱(editor.js)이 window 에 걸어두는 전역 중, bindBlock 의 «선택» 경로가 부르는 것만 no-op 으로 세운다.
     ⚠️편집진입(_gridBeginEdit / banner dblclick / _enterStickerEdit)에 쓰이는 것은 하나도 대체하지 않는다 — 재는 대상이다. */
  // 목록 근거: grep -o "window\.[A-Za-z_][A-Za-z0-9_]*(" js/block-drag.js (옵셔널체이닝 «아닌» 호출 전수)
  ['_clampTextFrameWidth','_openBlockContextMenu','applyImageTransform','buildLayerPanel','clearAssetImage',
   'clearCircleImage','deselectAll','enterCircleImageEditMode','enterImageEditMode','grdIsSoleSelected',
   'highlightBlock','loadImageToAsset','loadImageToCircle','loadVideoToAsset','pushHistory',
   'showAssetProperties','showCanvasProperties','showDividerProperties','showGapProperties','showGraphProperties',
   'showIconCircleProperties','showLabelGroupProperties','showSimpleCardProperties','showTableProperties',
   'showTextProperties','showVectorProperties','syncSection','toggleAssetGifPlayback','triggerAssetUpload',
   'triggerCircleUpload','selectBlock','scheduleAutoSave','triggerAutoSave','showToast']
    .forEach(k => { if (typeof window[k] !== 'function') window[k] = function () {}; });
</script>
<script src="/js/design-system.js"></script>
<script src="/js/io/section-serialize.js"></script>
<script src="/js/sticker-select.js"></script>
<script type="module">
  import { makeBanner02Block } from '/js/blocks/banner02-block.js';
  import { makeGridBlock } from '/js/blocks/grid-block.js';
  import '/js/blocks/sticker-block.js';
  import '/js/props/prop-banner02.js';
  import { bindBlock } from '/js/drag-drop.js';
  // 앱 없이 블록 하나만 세운다 — add*Block 이 하는 일 중 «DOM 삽입 + bindBlock» 만 재현.
  window.__putBanner = (opts) => {
    const { row, block } = makeBanner02Block(opts || {});
    document.getElementById('host').appendChild(row);
    bindBlock(block);
    return block.id;
  };
  window.__putGrid = (opts) => {
    const { row, block } = makeGridBlock(opts || {});
    document.getElementById('host').appendChild(row);
    bindBlock(block);
    return block.id;
  };
  // 스티커는 «섹션 직접 자식 + absolute». 하네스 섹션은 높이가 0이라 클릭 좌표가 스티커에 안 닿는다
  // → 실앱에서 섹션이 갖는 높이만 세워준다(편집진입 코드는 하나도 안 건드린다).
  window.__putSticker = (opts) => {
    const sec = document.querySelector('.section-block');
    sec.style.minHeight = '300px'; sec.style.overflow = 'visible';
    const block = window.makeStickerBlock(Object.assign({ shape: 'text' }, opts || {}));
    sec.appendChild(block);
    window.renderStickerBlock?.(block);
    window.bindStickerSelect?.(block);
    return block.id;
  };
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
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/* 선택/캐럿 상태를 «한 번에» 읽는다 — 대조군이 「아무 일도 안 일어남」으로 통과하는 구멍을 막으려면
   「전체선택이 아니다」만으로는 모자라고 「캐럿이 그 요소 안에 실제로 꽂혔다」를 같이 재야 한다. */
async function selInfo(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const s = window.getSelection();
    const anchorIn = !!(el && s && s.anchorNode && (el === s.anchorNode || el.contains(s.anchorNode)));
    return {
      text: s ? s.toString() : null,
      ranges: s ? s.rangeCount : -1,
      collapsed: s ? s.isCollapsed : null,
      anchorIn,
      focused: !!(el && document.activeElement === el),
      editable: !!(el && el.isContentEditable),
    };
  }, selector);
}

test.describe('안내문구 더블클릭 = 전체선택 (배너·그리드·스티커)', () => {

  test('배너 제목줄: 더블클릭하면 안내문구가 «전체선택»된다', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate(() => window.__putBanner({}));
    const title = page.locator('[data-kind="title"]').first();
    await expect(title).toHaveText(BANNER_TITLE_DEFAULT);
    await title.dblclick();
    const sel = await page.evaluate(() => (window.getSelection() || '').toString());
    expect(sel).toBe(BANNER_TITLE_DEFAULT);          // ← 고치기 전엔 '' (캐럿만)
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('배너 제목줄: 더블클릭 후 타이핑하면 안내문구가 «남지 않는다»', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate(() => window.__putBanner({}));
    const title = page.locator('[data-kind="title"]').first();
    await title.dblclick();
    await page.keyboard.insertText('강아지 간식');
    const text = await title.textContent();
    expect(text).toBe('강아지 간식');                 // ← 고치기 전엔 '강아지 간식제목을 입력합니다.'
    expect(text).not.toContain(BANNER_TITLE_DEFAULT);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  /* ★픽스라운드 ⑴ — 「+ 텍스트 줄 추가」로 «진짜 패널 버튼»을 눌러 만든 줄.
     초판은 이 줄의 기본문구('새 줄')가 prop-banner02.js 에 «따로» 박혀 있어 판정에서 빠졌다
     (실측 RED: sel="" / collapsed=true → 타이핑하면 「강아지 간식새 줄」).
     ⚠️여기서 '새 줄' 리터럴을 베끼지 «않는다» — 정본(window._bn2Lines.newLineText)을 읽는다.
       정본과 패널이 다시 갈라지면 아래 toHaveText 부터 빨강이 된다. */
  test('배너 «+ 텍스트 줄 추가»로 생긴 줄도 안내문구다 — 더블클릭하면 전체선택된다', async ({ page }) => {
    const errs = await boot(page);
    const id = await page.evaluate(() => window.__putBanner({}));
    const newText = await page.evaluate((id) => {
      const b = document.getElementById(id);
      window.showBanner02Properties(b);              // 실제 우측 패널을 세운다
      document.querySelector('#bn2-line-add').click(); // 실제 「+ 텍스트 줄 추가」 버튼
      return window._bn2Lines.newLineText;            // 정본
    }, id);
    expect(typeof newText).toBe('string');
    expect(newText.length).toBeGreaterThan(0);
    const last = page.locator('[data-line-idx]').last();
    await expect(last).toHaveText(newText);
    await last.dblclick();
    const info = await selInfo(page, '[data-line-idx]:last-child');
    expect(info.text).toBe(newText);                 // ← 고치기 전엔 ''
    expect(info.collapsed).toBe(false);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('배너 «+ 텍스트 줄 추가» 줄: 타이핑하면 기본문구가 «남지 않는다»', async ({ page }) => {
    const errs = await boot(page);
    const id = await page.evaluate(() => window.__putBanner({}));
    const newText = await page.evaluate((id) => {
      const b = document.getElementById(id);
      window.showBanner02Properties(b);
      document.querySelector('#bn2-line-add').click();
      return window._bn2Lines.newLineText;
    }, id);
    const last = page.locator('[data-line-idx]').last();
    await last.dblclick();
    await page.keyboard.insertText('강아지 간식');
    const text = await last.textContent();
    expect(text).toBe('강아지 간식');                 // ← 고치기 전엔 '강아지 간식새 줄'
    expect(text).not.toContain(newText);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('배너: 사용자가 쓴 «본문»은 전체선택하지 «않고» 캐럿이 그 줄 안에 꽂힌다', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate(() => window.__putBanner({ title: '우리 브랜드 이야기' }));
    const title = page.locator('[data-kind="title"]').first();
    await expect(title).toHaveText('우리 브랜드 이야기');
    await title.dblclick();
    const info = await selInfo(page, '[data-kind="title"]');
    expect(info.text).not.toBe('우리 브랜드 이야기');  // 전체선택 아님
    expect(info.ranges).toBe(1);                      // «아무 일도 안 일어남»이 아님
    expect(info.anchorIn).toBe(true);                 // 캐럿이 그 요소 «안»에 있다
    expect(info.focused).toBe(true);                  // 바로 타이핑되는 상태
    expect(info.editable).toBe(true);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('그리드 셀: 더블클릭하면 안내문구가 «전체선택»된다', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate(() => window.__putGrid({}));
    const cell = page.locator('.grd-line').first();
    await expect(cell).toHaveText(GRID_CELL_DEFAULT);
    await cell.dblclick();
    const sel = await page.evaluate(() => (window.getSelection() || '').toString());
    expect(sel).toBe(GRID_CELL_DEFAULT);             // ← 고치기 전엔 '' (캐럿만)
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('그리드 셀: 더블클릭 후 타이핑하면 안내문구가 «남지 않는다»', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate(() => window.__putGrid({}));
    const cell = page.locator('.grd-line').first();
    await cell.dblclick();
    await page.keyboard.insertText('강아지 간식');
    const text = await cell.textContent();
    expect(text).toBe('강아지 간식');                 // ← 고치기 전엔 '내용을 입력하세요.강아지 간식'
    expect(text).not.toContain(GRID_CELL_DEFAULT);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('그리드: 사용자가 쓴 «본문» 셀은 전체선택하지 «않고» 캐럿이 셀 안에 꽂힌다', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate(() => window.__putGrid({
      cols: [
        { width: 1, lines: [{ type: 'body', text: '사용자가 쓴 내용' }] },
        { width: 1, lines: [{ type: 'body', text: '사용자가 쓴 내용' }] },
      ],
    }));
    const cell = page.locator('.grd-line').first();
    await cell.dblclick();
    const info = await selInfo(page, '.grd-line');
    expect(info.text).not.toBe('사용자가 쓴 내용');
    expect(info.ranges).toBe(1);
    expect(info.anchorIn).toBe(true);
    expect(info.focused).toBe(true);
    expect(info.editable).toBe(true);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  /* ★그리드 판정의 «정본 한 곳» 그물.
     _gridBeginEdit 은 순환 import 를 피하려고 window 브리지로 기본문구를 읽는다.
     초판은 거기에 폴백 리터럴('내용을 입력하세요.')을 같이 뒀는데, 그건 정본이 바뀌면
     «조용히» 낡는 그림자 복제였다 → 폴백을 지우고, 브리지가 «세워져 있음»을 여기서 잰다.
     (브리지 한 줄이 사라지면 안내문구 전체선택이 소리 없이 멈춘다 — 그때 이 검사가 빨강이 된다.) */
  test('그리드 기본문구는 «정본 한 곳»에서만 온다 — window 브리지가 서 있다', async ({ page }) => {
    await boot(page);
    const v = await page.evaluate(() => window.GRID_CELL_DEFAULT_TEXT);
    expect(typeof v).toBe('string');
    expect(v).toBe(GRID_CELL_DEFAULT);
  });

  /* ★픽스라운드 ⑵ — 스티커. 실측 RED: 'Text' 가운데를 더블클릭하고 '강아지' → 「Te강아지xt」.
     A26(「커서가 안 생김」)은 «사용자가 쓴 글»을 고칠 때의 불만이었고, A26 자신도 신규 스티커
     'Text' 치환 플로우는 전체선택으로 두었다 — 안내문구일 때만 그 전체선택을 되살린다. */
  test('스티커 기본문구: 더블클릭하면 «전체선택»된다', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate(() => window.__putSticker({}));
    const el = page.locator('.sticker-text').first();
    await expect(el).toHaveText(STICKER_TEXT_DEFAULT);
    await el.dblclick();
    const info = await selInfo(page, '.sticker-text');
    expect(info.text).toBe(STICKER_TEXT_DEFAULT);    // ← 고치기 전엔 '' (캐럿만)
    expect(info.collapsed).toBe(false);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('스티커 기본문구: 더블클릭 후 타이핑하면 기본문구가 «남지 않는다»', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate(() => window.__putSticker({}));
    const el = page.locator('.sticker-text').first();
    await el.dblclick();
    await page.keyboard.insertText('강아지');
    const text = await el.textContent();
    expect(text).toBe('강아지');                      // ← 고치기 전엔 'Te강아지xt'
    expect(text).not.toContain(STICKER_TEXT_DEFAULT);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('스티커: 사용자가 쓴 «본문»은 전체선택하지 «않는다»(A26 캐럿 배치 보존)', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate(() => window.__putSticker({ text: '우리 브랜드' }));
    const el = page.locator('.sticker-text').first();
    await expect(el).toHaveText('우리 브랜드');
    await el.dblclick();
    const info = await selInfo(page, '.sticker-text');
    expect(info.text).not.toBe('우리 브랜드');
    expect(info.ranges).toBe(1);
    expect(info.anchorIn).toBe(true);
    expect(info.focused).toBe(true);
    expect(info.editable).toBe(true);
    expect(errs, errs.join('\n')).toEqual([]);
  });
});
