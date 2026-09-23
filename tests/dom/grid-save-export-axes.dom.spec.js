/* grid-save-export-axes.dom.spec.js — 그리드의 «다음 두 칸»을 잰다 (T-173).
 *
 * 지금까지 그리드를 지키던 그물은 「값을 넣으면 받나」(단위)와 「화면에 그려지나」(dom)
 * 둘뿐이었다. ★사용자가 겪는 최악은 그 둘 «다음»에 온다:
 *   S — 화면에선 되는데 «저장하고 다시 열면» 사라지는 것
 *   E — 화면엔 있는데 «내보낸 그림»엔 안 나오는 것
 * 이 파일이 그 두 칸이다.
 *
 * ★재는 «양» — 둘 다 «결과»로 잰다, 구현의 «방법»으로 재지 않는다.
 *   S 는 「같은 객체인가」가 아니라 «다시 그린 화면의 계산된 값»을 견준다.
 *   E 는 「숨김 표식이 붙었나」가 아니라 «내보낸 그림의 픽셀»을 센다(T-085 가 세운 규약).
 *
 * ★S 는 «제품이 실제로 거치는 세척»을 지난다 — js/io/section-serialize.js 의
 *   serializeCleanRoot. 기존 grid-row0-save-undo.dom.spec.js 는 스스로 적어 둔 대로
 *   raw innerHTML 로 재어 그 세척을 «못» 봤다. 여기서 그 반쪽을 닫는다.
 *   그리고 «연 직후»와 «다시 그린 뒤»를 따로 잰다 — 저장 포맷이 바뀌면 정확히 둘이 갈린다.
 *
 * ★E 는 «제품의 캡처 파이프라인»을 그대로 지난다 —
 *   js/io/export-image.js 의 prepareCloneForCapture + renderComponentsInClone.
 *   그 뒤 그 클론을 브라우저가 «직접» 찍는다(Electron 의 CDP 캡처와 같은 종류의 래스터라이저).
 *   ⚠️한계를 적어 둔다: 이 자리는 html2canvas 폴백 경로도, 저장 대화상자도 안 지난다.
 *     실앱 전수(returnDataUrl)는 tests/e2e/check-t173.mjs 가 잰다.
 *
 * ⛔앱을 «안» 띄운다. 제품 변경 0.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grid-save-export-axes
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
               '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml' };

/* ══ 팔레트 — 색 하나가 곧 «그 자리»다 ═══════════════════════════════════
   ⛔서로 가까운 색을 쓰지 마라. 아래 E0 이 «겹침»을 먼저 확인하고, 겹치면 빨강이다
     (그 경우 이 자가 두 자리를 한 자리로 세어 초록이 헛것이 된다). */
const C = {
  cell00: '#101080', cell01: '#108010', cell02: '#801010', cell03: '#808010',
  cell10: '#108080', cell11: '#801080', cell12: '#404080', cell13: '#408040',
  cell20: '#804040', cell21: '#208060', cell22: '#602080', cell23: '#806020',
  badge: '#ff3366', graphBar: '#00c2a8', graphTrack: '#ffd400',
  img: '#0044ff', duoTxt: '#7700cc',
};
/* ★내보내기는 색을 «한두 눈금» 움직여 돌려준다(실측 2026-09-24, 실앱 860px PNG:
   #108010→#0f8010 · #208060→#228060 · #ff3366→#ff3266). 색 변환을 지나기 때문이다.
   ⇒ 정확일치로 세면 «멀쩡한 것»을 결함으로 적는다. 눈금 여유를 두고 센다. */
const TOL = 4;

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<style>html,body{margin:0;padding:0;background:#fff}</style></head><body>
<div id="canvas"><div class="section-block" id="sec1" style="width:860px;background:#ffffff"><div class="section-inner" id="host"></div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script src="/js/io/section-serialize.js"></script>
<script src="/js/design-system.js"></script>
<script type="module">
  import '/js/globals.js';
  import { makeGridBlock, renderGridBlock, getGridModel } from '/js/blocks/grid-block.js';
  const ex = await import('/js/io/export-image.js');
  window.__mk = makeGridBlock;
  window.__render = renderGridBlock;
  window.__model = getGridModel;
  window.__prepare = ex.prepareCloneForCapture;
  window.__renderInClone = ex.renderComponentsInClone;
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  await page.evaluate(([c, tol]) => { window.__C = c; window.__TOL = tol; }, [C, TOL]);
  return errs;
}

/* ══ 판 — «쓸 만큼 다 쓴» 그리드 한 벌 ════════════════════════════════════
   줄 종류 전수(label h1 h2 h3 body caption image gap duo graph ＋ 뱃지)
   ＋ 칸 꾸밈 전수(bg padding radius align valign) ＋ 빈 칸 하나.
   ⛔줄이거나 늘릴 땐 G0(계측기)이 먼저 빨개진다 — 그게 이 판의 «자기 검사»다. */
const PLANT = () => {
  const C = window.__C;
  const cv = document.createElement('canvas'); cv.width = 160; cv.height = 120;
  const cx = cv.getContext('2d'); cx.fillStyle = C.img; cx.fillRect(0, 0, 160, 120);
  const IMGSRC = cv.toDataURL('image/png');
  const cells = [
    [
      { bg: C.cell00, padding: 12, radius: 8, align: 'left',
        lines: [{ type: 'label', text: 'L0' }, { type: 'h1', text: 'H1' }] },
      { bg: C.cell01, padding: 16, radius: 14, align: 'center', valign: 'middle',
        lines: [{ type: 'h2', text: 'H2' }, { type: 'h3', text: 'H3' }] },
      { bg: C.cell02, padding: 8, radius: 0, align: 'right', valign: 'bottom',
        lines: [{ type: 'body', text: 'BODY' }, { type: 'caption', text: 'CAP' }] },
      { bg: C.cell03, padding: 20, radius: 24, align: 'center',
        lines: [{ type: 'body', text: 'BADGE', bg: C.badge, padV: 10, padH: 18, radius: 6 }] },
    ],
    [
      { bg: C.cell10, padding: 10, radius: 6,
        lines: [{ type: 'image', imgSrc: IMGSRC, height: 60, radius: 4, widthPct: 80, align: 'center' }] },
      { bg: C.cell11, padding: 10, radius: 6,
        lines: [{ type: 'gap', height: 30 }, { type: 'body', text: 'AFTERGAP' }] },
      { bg: C.cell12, padding: 10, radius: 6,
        lines: [{ type: 'duo', gap: 12, valign: 'middle', cols: [
          { width: 1, lines: [{ type: 'body', text: 'N-A', color: C.duoTxt }] },
          { width: 2, lines: [{ type: 'caption', text: 'N-B' }] }] }] },
      { bg: C.cell13, padding: 10, radius: 6,
        lines: [{ type: 'graph', barColor: C.graphBar, trackColor: C.graphTrack,
                  items: [{ label: 'G1', value: 70 }, { label: 'G2', value: 40 }] }] },
    ],
    [
      { bg: C.cell20, padding: 4, radius: 2, align: 'left', valign: 'top', lines: [{ type: 'body', text: 'A-L' }] },
      { bg: C.cell21, padding: 28, radius: 30, align: 'center', valign: 'middle', lines: [{ type: 'body', text: 'A-C' }] },
      { bg: C.cell22, padding: 0, radius: 0, align: 'right', valign: 'bottom', lines: [{ type: 'body', text: 'A-R', marginTop: 9 }] },
      { bg: C.cell23, padding: 6, radius: 10, lines: [] },
    ],
  ];
  const HOST = document.getElementById('host');
  HOST.innerHTML = '';
  const { row, block } = window.__mk({ cols: [{ width: 1 }, { width: 1 }, { width: 1 }, { width: 1 }] });
  HOST.appendChild(row);
  const ID = block.id;
  const ops = [
    /* ★행 높이는 'auto' «와» px 를 섞는다 — px 최소높이(minmax)도 저장 포맷의 한 칸이다.
       전부 auto 로 두면 그 칸을 한 번도 안 지난다. */
    window.updateGridBlock(ID, { rows: [{ height: 'auto' }, { height: 200 }, { height: 'auto' }] }),
    window.updateGridBlock(ID, { rowGap: 14, colGap: 18 }),
    /* ★칸 테두리 세 키(T-172, 2026-09-24) — 블록 축 스칼라이고 «저장 포맷의 한 칸»이다.
       ⛔width 0 이 「없음」이라 안 주면 이 축을 한 번도 안 지난다(옛 저장본과 바이트 동일). */
    window.updateGridBlock(ID, { cellBorderWidth: 3, cellBorderColor: '#00ffee', cellBorderStyle: 'dashed' }),
    window.updateGridBlock(ID, { cells }),
  ].map(r => ({ ok: !!(r && r.ok), code: r && r.code, message: r && r.message }));
  return { ID, ops, imgLen: IMGSRC.length };
};

/* ══ 화면 재는 자 — «계산된 값»으로 읽는다 ══════════════════════════════ */
const INSTALL_MEASURE = () => {
  window.__screen = (block) => {
    if (!block) return { GONE: '1' };
    const out = {};
    const cells = block.querySelectorAll('.grd-cell');
    out['cells.n'] = String(cells.length);
    for (const el of cells) {
      const t = 'c' + el.dataset.r + el.dataset.c;
      const cs = getComputedStyle(el);
      out[t + '.bg'] = cs.backgroundColor;
      out[t + '.pad'] = cs.paddingTop + '/' + cs.paddingLeft;
      out[t + '.radius'] = cs.borderTopLeftRadius;
      out[t + '.justify'] = cs.justifyContent;
      /* ★테두리(T-172) — 칸마다 «어느 변이 그려지나»가 다르다(안쪽 변만). 네 변을 따로 읽는다. */
      out[t + '.bd.top'] = cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor;
      out[t + '.bd.left'] = cs.borderLeftWidth + ' ' + cs.borderLeftStyle + ' ' + cs.borderLeftColor;
      out[t + '.bd.right'] = cs.borderRightWidth + ' ' + cs.borderRightStyle + ' ' + cs.borderRightColor;
      out[t + '.bd.bottom'] = cs.borderBottomWidth + ' ' + cs.borderBottomStyle + ' ' + cs.borderBottomColor;
      out[t + '.text'] = (el.innerText || '').trim();
      out[t + '.empty'] = el.classList.contains('grd-cell-empty') ? '1' : '0';
      const kids = el.querySelectorAll(':scope > *');
      out[t + '.lines.n'] = String(kids.length);
      kids.forEach((ln, i) => {
        const k = t + '.L' + i;
        const ls = getComputedStyle(ln);
        out[k + '.tag'] = ln.tagName;
        out[k + '.cls'] = ln.className || '(none)';
        out[k + '.align'] = ls.textAlign;
        out[k + '.size'] = ls.fontSize;
        out[k + '.weight'] = ls.fontWeight;
        out[k + '.color'] = ls.color;
        out[k + '.mt'] = ls.marginTop;
        out[k + '.h'] = String(Math.round(ln.getBoundingClientRect().height));
        out[k + '.text'] = (ln.innerText || '').trim();
        if (ln.tagName === 'IMG') {
          out[k + '.src.len'] = String((ln.getAttribute('src') || '').length);
          out[k + '.src.head'] = (ln.getAttribute('src') || '').slice(0, 24);
          out[k + '.objfit'] = ls.objectFit;
          out[k + '.radius'] = ls.borderTopLeftRadius;
          out[k + '.w'] = String(Math.round(ln.getBoundingClientRect().width));
        }
        const badge = ln.querySelector(':scope > .grd-badge');
        if (badge) {
          const bs = getComputedStyle(badge);
          out[k + '.badge.bg'] = bs.backgroundColor;
          out[k + '.badge.pad'] = bs.paddingTop + '/' + bs.paddingLeft;
          out[k + '.badge.radius'] = bs.borderTopLeftRadius;
          out[k + '.badge.text'] = (badge.innerText || '').trim();
        }
        if (ln.classList.contains('grd-nested')) {
          const ncols = ln.querySelectorAll(':scope > .grd-nested-col');
          out[k + '.nested.n'] = String(ncols.length);
          out[k + '.nested.gap'] = ls.columnGap;
          ncols.forEach((nc, j) => {
            out[k + '.nested' + j + '.flex'] = getComputedStyle(nc).flexGrow;
            out[k + '.nested' + j + '.justify'] = getComputedStyle(nc).justifyContent;
            out[k + '.nested' + j + '.text'] = (nc.innerText || '').trim();
            const first = nc.querySelector(':scope > *');
            out[k + '.nested' + j + '.color'] = first ? getComputedStyle(first).color : '(none)';
          });
        }
        if (ln.classList.contains('grd-graph')) {
          const items = ln.querySelectorAll(':scope > .grd-graph-item');
          out[k + '.graph.n'] = String(items.length);
          items.forEach((it, j) => {
            const track = it.querySelector(':scope > div:nth-child(2)');
            const bar = track ? track.querySelector(':scope > div') : null;
            out[k + '.graph' + j + '.text'] = (it.innerText || '').trim().replace(/\s+/g, ' ');
            out[k + '.graph' + j + '.track'] = track ? getComputedStyle(track).backgroundColor : '(none)';
            out[k + '.graph' + j + '.bar'] = bar ? getComputedStyle(bar).backgroundColor : '(none)';
            out[k + '.graph' + j + '.barw'] = bar ? String(Math.round(bar.getBoundingClientRect().width)) : '(none)';
          });
        }
        if (ln.classList.contains('grd-gap')) out[k + '.gap.h'] = ls.height;
      });
    }
    const inner = block.querySelector('.grd-inner');
    if (inner) {
      const ics = getComputedStyle(inner);
      out['inner.cols'] = ics.gridTemplateColumns;
      out['inner.rows'] = ics.gridTemplateRows;
      out['inner.rowGap'] = ics.rowGap;
      out['inner.colGap'] = ics.columnGap;
    } else out['inner.MISSING'] = '1';
    return out;
  };
  window.__diff = (a, b) => {
    const keys = [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])].sort();
    const d = {};
    for (const k of keys) if ((a || {})[k] !== (b || {})[k]) d[k] = String((a || {})[k]) + ' → ' + String((b || {})[k]);
    return d;
  };
};

const fmt = (d) => Object.keys(d).length
  ? Object.keys(d).sort().map(k => `      ${k}: ${d[k]}`).join('\n')
  : '      (차이 없음)';

/** 판을 깔고 재는 자를 심는다. */
async function plant(page) {
  const r = await page.evaluate((install) => {
    eval('(' + install + ')()');
    return window.__plantResult = eval('(' + window.__PLANT + ')()');
  }, INSTALL_MEASURE.toString());
  return r;
}
async function installPlant(page) {
  await page.evaluate((src) => { window.__PLANT = src; }, PLANT.toString());
}

/* ══════════════════════════════════════════════════════════════════════
 * G0 — 계측기. 판이 «실제로» 열두 칸 서로 다른 화면을 만드는가.
 * ⛔이게 빨갛다면 아래 초록은 전부 헛것이다.
 * ════════════════════════════════════════════════════════════════════ */
test('G0 ★계측기 — 판이 열두 칸·줄 종류 전수를 «화면»으로 만든다', async ({ page }) => {
  const errs = await boot(page);
  await installPlant(page);
  const r = await plant(page);
  expect(errs).toEqual([]);
  expect(r.ops.every(o => o.ok), `판 깔기가 실패했다: ${JSON.stringify(r.ops)}`).toBe(true);
  const scr = await page.evaluate((id) => window.__screen(document.getElementById(id)), r.ID);
  expect(scr['cells.n'], '★칸이 12개가 아니다').toBe('12');
  const tags = ['00', '01', '02', '03', '10', '11', '12', '13', '20', '21', '22', '23'];
  const bgs = tags.map(t => scr['c' + t + '.bg']);
  expect(new Set(bgs).size, `★칸 배경이 겹친다(${JSON.stringify(bgs)}) — 어느 칸이 틀어져도 못 잡는다`).toBe(12);
  /* 줄 종류가 «전부» 서 있나 — 이름이 아니라 «화면에 생긴 것»으로 센다 */
  const kinds = await page.evaluate((id) => {
    const g = document.getElementById(id);
    return {
      img: g.querySelectorAll('img.grd-img').length,
      gap: g.querySelectorAll('.grd-gap').length,
      nested: g.querySelectorAll('.grd-nested').length,
      nestedCols: g.querySelectorAll('.grd-nested-col').length,
      graph: g.querySelectorAll('.grd-graph').length,
      graphItems: g.querySelectorAll('.grd-graph-item').length,
      badge: g.querySelectorAll('.grd-badge').length,
      roles: ['label', 'h1', 'h2', 'h3', 'body', 'caption'].map(k => g.querySelectorAll('.grd-' + k).length),
      empty: g.querySelectorAll('.grd-cell-empty').length,
    };
  }, r.ID);
  /* ★테두리(T-172)가 «실제로 그려졌나» — 안 그려졌으면 아래 S 축의 테두리 대조는
     「빈 것끼리 견주기」라 공짜 초록이다. ⛔안쪽 변만 그려지는 것이 그 카드의 규약이라
     「네 변 다 3px」이 아니라 «3px 인 변이 하나라도 있나»로 잰다. */
  const bd = Object.entries(scr).filter(([k, v]) => /\.bd\./.test(k) && /^3px dashed/.test(String(v)));
  expect(bd.length,
    `★칸 테두리가 한 변도 안 그려졌다 — cellBorderWidth:3 이 화면에 안 닿았다(S 축이 못 잰다).\n` +
    `   읽은 테두리 값: ${JSON.stringify(Object.fromEntries(Object.entries(scr).filter(([k]) => /\.bd\./.test(k)).slice(0, 6)))}`)
    .toBeGreaterThan(0);
  expect(String(bd[0][1]), '★테두리 색이 준 값이 아니다').toContain('rgb(0, 255, 238)');
  expect(kinds, '★줄 종류가 판에 다 안 섰다 — 안 선 종류는 아래 축이 «안 재는» 것이다')
    .toEqual({ img: 1, gap: 1, nested: 1, nestedCols: 2, graph: 1, graphItems: 2, badge: 1,
               roles: [1, 1, 1, 1, 6, 2], empty: 1 });
});

/* ══════════════════════════════════════════════════════════════════════
 * S — 저장 → 다시 열기. ★제품의 «세척»(serializeCleanRoot)을 지난다.
 * ════════════════════════════════════════════════════════════════════ */

test('S1 ★★저장→다시 열기 — «연 직후» 화면이 같다 (제품 세척 경로)', async ({ page }) => {
  const errs = await boot(page);
  await installPlant(page);
  const r = await plant(page);
  const out = await page.evaluate((id) => {
    const block = document.getElementById(id);
    const before = window.__screen(block);
    /* 제품이 저장하는 것 = 캔버스 클론을 serializeCleanRoot 로 씻은 innerHTML
       (js/io/save-load.js getSerializedCanvas 와 «같은 함수»다 — 사본을 안 만든다). */
    const canvas = document.getElementById('canvas');
    const clone = canvas.cloneNode(true);
    window.serializeCleanRoot(clone);
    const saved = clone.innerHTML;
    /* 다시 열기 — 저장본을 도로 심는다 */
    canvas.innerHTML = saved;
    const re = canvas.querySelector('.grid-block');
    return { before, opened: window.__screen(re), savedLen: saved.length,
             hasCols: /data-cols=/.test(saved), hasCells: /data-cells=/.test(saved), hasRows: /data-rows=/.test(saved) };
  }, r.ID);
  expect(errs).toEqual([]);
  expect(out.hasCols && out.hasRows && out.hasCells,
    `★저장본에 data-cols/rows/cells 가 다 없다 — 그러면 아래 견줌은 «빈 것끼리» 견주는 셈이다(cols=${out.hasCols} rows=${out.hasRows} cells=${out.hasCells})`).toBe(true);
  const d = await page.evaluate(([a, b]) => window.__diff(a, b), [out.before, out.opened]);
  expect(d, '★저장본을 도로 심었더니 화면이 달라졌다 — 다시 연 순간부터 모양이 다르다.\n' + fmt(d)).toEqual({});
});

test('S2 ★★저장본을 «다시 그려도» 같다 — 건드리는 순간 모양이 바뀌면 안 된다', async ({ page }) => {
  const errs = await boot(page);
  await installPlant(page);
  const r = await plant(page);
  const out = await page.evaluate((id) => {
    const block = document.getElementById(id);
    const before = window.__screen(block);
    const canvas = document.getElementById('canvas');
    const clone = canvas.cloneNode(true);
    window.serializeCleanRoot(clone);
    canvas.innerHTML = clone.innerHTML;
    const re = canvas.querySelector('.grid-block');
    const opened = window.__screen(re);
    window.__render(re);                       // 첫 조작이 일으키는 재렌더
    return { before, opened, redrawn: window.__screen(re) };
  }, r.ID);
  expect(errs).toEqual([]);
  const d1 = await page.evaluate(([a, b]) => window.__diff(a, b), [out.opened, out.redrawn]);
  expect(d1,
    '★연 직후 화면과 «다시 그린» 화면이 다르다 — 저장된 픽셀은 맞는데\n' +
    '   읽는 문이 그 값을 «새 자리에서» 못 읽는다는 뜻이다.\n' + fmt(d1)).toEqual({});
  const d2 = await page.evaluate(([a, b]) => window.__diff(a, b), [out.before, out.redrawn]);
  expect(d2, '★왕복 뒤 다시 그린 화면이 원본과 다르다.\n' + fmt(d2)).toEqual({});
});

test('S3 ★세척이 그리드 상태를 한 글자도 안 깎는다 (data-cols/rows/cells 바이트 동일)', async ({ page }) => {
  const errs = await boot(page);
  await installPlant(page);
  const r = await plant(page);
  const out = await page.evaluate((id) => {
    const live = document.getElementById(id);
    const KEYS = ['cols', 'rows', 'cells', 'gap', 'rowGap', 'colGap', 'valign',
                  'cellBorderWidth', 'cellBorderColor', 'cellBorderStyle'];   // ★테두리 셋 = T-172 신설
    const pluck = (el) => Object.fromEntries(KEYS.map(k => [k, el.dataset[k]]));
    const mine = pluck(live);
    const canvas = document.getElementById('canvas');
    const clone = canvas.cloneNode(true);
    window.serializeCleanRoot(clone);
    const host = document.createElement('div');
    host.innerHTML = clone.innerHTML;
    const saved = host.querySelector('.grid-block');
    const theirs = saved ? pluck(saved) : null;
    return { mine, theirs };
  }, r.ID);
  expect(errs).toEqual([]);
  expect(out.theirs, '★저장본에 그리드 블록이 없다').not.toBeNull();
  expect(out.theirs, '★세척이 그리드 dataset 을 바꿨다 — 저장하면 «데이터»가 달라진다는 뜻이다').toEqual(out.mine);
});

/* ══════════════════════════════════════════════════════════════════════
 * S4~S6 — ★「cols/rows/cells/gap/valign 다섯 키가 바이트 동일」이 «못 보는» 자리.
 *   그 다섯이 같아도 «화면»은 갈릴 수 있다. 갈리는 길이 셋 있다:
 *     S4 글자가 «속성 왕복»을 못 견딘다 (dataset 은 HTML 속성 안의 JSON 이다)
 *     S5 「값이 ''/0 이다」와 「키가 없다」가 왕복에서 뭉개진다 (뜻이 정반대다)
 *     S6 배경이 «캔버스 밖»을 가리킨다 (var(--color-…)) — 다섯 키는 같은데 색이 갈린다
 * ════════════════════════════════════════════════════════════════════ */

/** 세척 왕복 한 번 — 「저장하고 다시 열었다」를 한 줄로. */
const ROUNDTRIP = `
  const canvas = document.getElementById('canvas');
  const clone = canvas.cloneNode(true);
  window.serializeCleanRoot(clone);
  canvas.innerHTML = clone.innerHTML;
  const re = canvas.querySelector('.grid-block');
  window.__render(re);`;

/* ⛔따옴표·꺾쇠·앰퍼샌드·백슬래시·닫는 주석·NBSP — dataset 은 HTML 속성 «안»의 JSON 이라
   escape 가 한 겹이라도 새면 여기서 글자가 깨지거나 속성이 통째로 끊긴다. */
const NASTY = '따옴표"큰\' 작은 <b>태그</b> & 앰퍼샌드 \\백슬래시 </div> -->  끝';

test('S4 ★다섯 키 밖 ① — 따옴표·꺾쇠·앰퍼샌드가 든 글자가 저장 왕복을 견딘다', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(([roundtrip, nasty]) => {
    const HOST = document.getElementById('host');
    HOST.innerHTML = '';
    const { row, block } = window.__mk({ cols: [{ width: 1 }, { width: 1 }] });
    HOST.appendChild(row);
    window.updateGridBlock(block.id, { cells: [[
      { lines: [{ type: 'body', text: nasty }] },
      { lines: [{ type: 'h2', text: nasty }] },
    ]] });
    const read = () => [...document.querySelectorAll('.grd-cell [data-line]')].map(e => e.textContent);
    const before = read();
    const dsBefore = document.querySelector('.grid-block').dataset.cols;
    eval(roundtrip);
    return { before, after: read(), dsBefore, dsAfter: document.querySelector('.grid-block').dataset.cols };
  }, [ROUNDTRIP, NASTY]);
  expect(errs).toEqual([]);
  expect(out.before, '★심은 글자가 화면에 그대로 안 들어갔다 — 왕복을 재기 전에 이미 깨졌다')
    .toEqual([NASTY, NASTY]);
  expect(out.after, '★저장 왕복에서 글자가 깨졌다(속성 escape 가 샜다)').toEqual([NASTY, NASTY]);
  expect(out.dsAfter, '★dataset.cols 가 왕복에서 달라졌다').toBe(out.dsBefore);
});

test("S5 ★다섯 키 밖 ② — 「''·0 = 이 칸만 끈다」와 「키 없음 = 열 기본값을 따른다」가 왕복에서 안 뒤집힌다", async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate((roundtrip) => {
    const HOST = document.getElementById('host');
    HOST.innerHTML = '';
    const { row, block } = window.__mk({ cols: [{ width: 1 }, { width: 1 }] });
    HOST.appendChild(row);
    const ID = block.id;
    /* 열 기본값을 «둘 다» 깔아 둔다 — 그래야 「끈다」와 「따른다」가 서로 다른 화면이 된다 */
    window.updateGridBlock(ID, { patchCol: { index: 0, bg: '#123456', padding: 40, radius: 20 } });
    window.updateGridBlock(ID, { patchCol: { index: 1, bg: '#123456', padding: 40, radius: 20 } });
    window.updateGridBlock(ID, { rows: [{ height: 'auto' }, { height: 'auto' }] });
    window.updateGridBlock(ID, { cells: [
      [{ lines: [{ type: 'body', text: 'r0' }] }, { lines: [{ type: 'body', text: 'r0b' }] }],
      /* 0열 = 끈다('' / 0) · 1열 = 따른다(키 없음) */
      [{ bg: '', padding: 0, radius: 0, lines: [{ type: 'body', text: 'OFF' }] },
       { lines: [{ type: 'body', text: 'INHERIT' }] }],
    ] });
    const read = () => {
      const o = {};
      for (const el of document.querySelectorAll('.grd-cell')) {
        const cs = getComputedStyle(el);
        o['c' + el.dataset.r + el.dataset.c] = cs.backgroundColor + '|' + cs.paddingTop + '|' + cs.borderTopLeftRadius;
      }
      return o;
    };
    const before = read();
    eval(roundtrip);
    return { before, after: read() };
  }, ROUNDTRIP);
  expect(errs).toEqual([]);
  /* ★계측기 — 두 칸이 «애초에» 달라야 왕복이 뒤집혀도 잡힌다 */
  expect(out.before.c10, '★계측기: 「끈 칸」이 열 기본값과 같아졌다 — 이 검사는 아무것도 못 가른다')
    .not.toBe(out.before.c11);
  expect(out.before.c10, '★「끈 칸」이 안 꺼졌다').toBe('rgba(0, 0, 0, 0)|0px|0px');
  expect(out.before.c11, '★「따르는 칸」이 열 기본값을 안 받았다').toBe('rgb(18, 52, 86)|40px|20px');
  expect(out.after, '★저장 왕복에서 「끈다」와 「따른다」가 뒤집혔다 — 다섯 키가 같아도 화면이 갈린다').toEqual(out.before);
});

test('S6 ★다섯 키 밖 ③ — var(--color-…)·transparent·rgba 배경이 왕복을 견딘다', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate((roundtrip) => {
    document.documentElement.style.setProperty('--color-t173brand', '#ff7700');
    const HOST = document.getElementById('host');
    HOST.innerHTML = '';
    const { row, block } = window.__mk({ cols: [{ width: 1 }, { width: 1 }, { width: 1 }] });
    HOST.appendChild(row);
    window.updateGridBlock(block.id, { cells: [[
      { bg: 'var(--color-t173brand, #ff0000)', lines: [{ type: 'body', text: 'VAR' }] },
      { bg: 'transparent', lines: [{ type: 'body', text: 'TR' }] },
      { bg: 'rgba(0,128,255,0.5)', lines: [{ type: 'body', text: 'HALF' }] },
    ]] });
    const read = () => [...document.querySelectorAll('.grd-cell')].map(e => getComputedStyle(e).backgroundColor);
    const before = read();
    eval(roundtrip);
    const after = read();
    /* ★변수를 «치우면» 폴백으로 떨어져야 한다 — 그래야 위 초록이 「변수를 읽었다」의 증거가 된다
       (안 그러면 「그냥 빨강이 나왔다」와 구별이 안 된다). */
    document.documentElement.style.removeProperty('--color-t173brand');
    return { before, after, fallback: read() };
  }, ROUNDTRIP);
  expect(errs).toEqual([]);
  expect(out.before, '★심은 배경이 화면에 안 들어갔다').toEqual(
    ['rgb(255, 119, 0)', 'rgba(0, 0, 0, 0)', 'rgba(0, 128, 255, 0.5)']);
  expect(out.after, '★저장 왕복 뒤 배경이 달라졌다').toEqual(out.before);
  expect(out.fallback[0],
    '★변수를 치웠는데도 같은 색이다 — 위 초록은 «변수를 읽은» 증거가 아니다(계측기가 둘을 못 가른다)')
    .toBe('rgb(255, 0, 0)');
});

/* ══════════════════════════════════════════════════════════════════════
 * E — 내보낸 그림. ★제품의 캡처 파이프라인을 지난 «픽셀»을 센다.
 * ════════════════════════════════════════════════════════════════════ */

/** 제품 파이프라인으로 클론을 세우고 «브라우저가 직접» 찍는다. */
async function exportPixels(page, { strip } = {}) {
  await page.evaluate(async (stripSrc) => {
    /* ⛔앞서 찍은 클론을 먼저 치운다 — 남겨 두면 같은 id 가 둘이 되어 «어느 것을 쟀는지»
       가 흐려진다(실측: 두 번째 호출에서 locator 가 둘을 잡았다). */
    document.getElementById('__t173clone')?.remove();
    const sec = document.getElementById('sec1');
    if (stripSrc) eval('(' + stripSrc + ')()');         // 음성대조용 변조는 «찍기 전»에
    const clone = await window.__prepare(sec, 860, true);
    window.__renderInClone(clone);
    clone.id = '__t173clone';
    clone.style.top = '0px';                             // 찍으려고 화면 안으로만 옮긴다
    clone.style.left = '0px';
    clone.style.background = '#ffffff';
    clone.getBoundingClientRect();
    /* 그림 줄이 실제로 디코드될 때까지 기다린다 — 안 기다리면 「그림이 안 나왔다」가
       내 걸음의 결과가 된다(제품 _waitImagesReady 와 같은 이유). */
    await Promise.all([...clone.querySelectorAll('img')].map(im =>
      im.complete ? Promise.resolve() : im.decode().catch(() => {})));
    window.__cloneH = Math.ceil(clone.getBoundingClientRect().height);
  }, strip ? strip.toString() : null);
  const h = await page.evaluate(() => window.__cloneH);
  await page.setViewportSize({ width: 1000, height: Math.min(4000, Math.max(200, h + 40)) });
  const shot = await page.locator('#__t173clone').screenshot({ type: 'png' });
  return page.evaluate(async ([b64, want, tol]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
    const keys = Object.keys(want), tgt = keys.map(k => hex(want[k]));
    const clash = [];
    for (let a = 0; a < tgt.length; a++) for (let b = a + 1; b < tgt.length; b++) {
      const dist = Math.max(Math.abs(tgt[a][0] - tgt[b][0]), Math.abs(tgt[a][1] - tgt[b][1]), Math.abs(tgt[a][2] - tgt[b][2]));
      if (dist <= 2 * tol) clash.push(`${keys[a]}~${keys[b]}(${dist})`);
    }
    const n = {}; keys.forEach(k => n[k] = 0);
    let nonwhite = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (!(r > 250 && g > 250 && b > 250)) nonwhite++;
      for (let j = 0; j < tgt.length; j++) {
        if (Math.abs(r - tgt[j][0]) <= tol && Math.abs(g - tgt[j][1]) <= tol && Math.abs(b - tgt[j][2]) <= tol) { n[keys[j]]++; break; }
      }
    }
    return { w: img.width, h: img.height, nonwhite, clash, px: n };
  }, [shot.toString('base64'), C, TOL]);
}

test('E0 ★계측기 — 캡처가 «빈 그림»이 아니고 팔레트가 서로 안 겹친다', async ({ page }) => {
  const errs = await boot(page);
  await installPlant(page);
  await plant(page);
  const r = await exportPixels(page);
  expect(errs).toEqual([]);
  expect(r.clash, `★팔레트가 겹친다 — 한 색이 두 자리를 한 자리로 센다: ${r.clash.join(' · ')}`).toEqual([]);
  expect(r.w, '★캡처 폭이 860 이 아니다').toBe(860);
  expect(r.h, '★캡처 높이가 0 에 가깝다 — 아무것도 안 찍혔다').toBeGreaterThan(100);
  expect(r.nonwhite, '★흰색 아닌 픽셀이 거의 없다 — 백지가 나왔다').toBeGreaterThan(10000);
});

test('E1 ★★내보낸 그림에 «칸 배경색 열두 개»가 전부 나온다', async ({ page }) => {
  const errs = await boot(page);
  await installPlant(page);
  await plant(page);
  const r = await exportPixels(page);
  expect(errs).toEqual([]);
  const tags = ['00', '01', '02', '03', '10', '11', '12', '13', '20', '21', '22', '23'];
  const missing = tags.filter(t => r.px['cell' + t] < 200);
  expect(missing,
    '★화면엔 있는데 «내보낸 그림»엔 그 칸 배경이 없다(200픽셀 미만).\n' +
    `   센 법: 클론을 제품 파이프라인으로 세우고 브라우저가 직접 찍은 ${r.w}×${r.h} PNG 에서\n` +
    `   목표색 ±${TOL} 안의 화소를 셌다. 전체: ${JSON.stringify(r.px)}`).toEqual([]);
});

test('E2 ★★내보낸 그림에 «그림 줄·뱃지·그래프 막대/트랙·중첩 글자색»이 나온다', async ({ page }) => {
  const errs = await boot(page);
  await installPlant(page);
  await plant(page);
  const r = await exportPixels(page);
  expect(errs).toEqual([]);
  const want = { img: 500, badge: 300, graphBar: 200, graphTrack: 200, duoTxt: 20 };
  const bad = Object.keys(want).filter(k => r.px[k] < want[k]);
  expect(bad,
    '★화면엔 있는데 «내보낸 그림»엔 안 나온다.\n' +
    `   센 법: ${r.w}×${r.h} PNG 에서 목표색 ±${TOL} 화소 수. 하한 ${JSON.stringify(want)}\n` +
    `   잰 값: ${JSON.stringify(r.px)}`).toEqual([]);
});

test('E3 ★음성대조 — 꾸밈을 «모델에서» 빼면 그 색이 그림에서 사라진다', async ({ page }) => {
  const errs = await boot(page);
  await installPlant(page);
  const r = await plant(page);
  await page.evaluate((id) => { window.__GID = id; }, r.ID);
  const full = await exportPixels(page);
  /* ⛔「표식을 지운다」가 아니라 «모델에서 값을 뺀다» — 제품이 진짜로 안 칠하게 만든다.
     이게 초록이면 위 E1/E2 의 초록은 「무엇을 재든 항상 나오는 수」가 아니다. */
  const stripped = await exportPixels(page, {
    strip: () => {
      const g = document.getElementById(window.__GID);
      const m = window.__model(g);
      const cells = m.cells.map(row => row.map(c => {
        const { bg, ...rest } = c;
        const lines = (rest.lines || []).filter(l => l.type !== 'image' && l.type !== 'graph').map(l => {
          if (l.bg) { const { bg: _b, ...r2 } = l; return r2; }
          return l;
        });
        return { ...rest, lines };
      }));
      /* ★행 0 의 «줄»은 cells 가 아니라 cols[c].lines 에 있다 — 여기도 같이 벗겨야
         뱃지(줄의 bg)가 진짜로 사라진다. 처음엔 이걸 빠뜨려 「뺐는데 남아 있다」가 났고,
         그건 제품이 아니라 내 변조가 반쪽이었던 것이다. */
      const strip = (ls) => (ls || []).filter(l => l.type !== 'image' && l.type !== 'graph')
        .map(l => { if (l.bg) { const { bg: _b, ...r2 } = l; return r2; } return l; });
      const cols = m.cols.map(c => { const { bg, ...rest } = c; return { ...rest, lines: strip(rest.lines) }; });
      g.dataset.cols = JSON.stringify(cols);
      g.dataset.cells = JSON.stringify(cells.map((row, i) => row.map(c => (i === 0 ? (({ lines, ...d }) => d)(c) : c))));
      window.__render(g);
    },
  });
  expect(errs).toEqual([]);
  for (const k of ['cell00', 'cell11', 'cell22', 'badge', 'img', 'graphBar', 'graphTrack']) {
    expect(full.px[k], `★변조 «전»에 ${k} 가 이미 0 이다 — 이 대조는 아무것도 증명 못 한다`).toBeGreaterThan(50);
    expect(stripped.px[k],
      `★모델에서 뺐는데도 ${k} 가 그림에 남아 있다(${stripped.px[k]}px) — 이 자가 «그림»이 아니라\n` +
      '   자기 자신을 재고 있다는 뜻이다.\n' + `   전: ${JSON.stringify(full.px)}\n   후: ${JSON.stringify(stripped.px)}`).toBeLessThan(50);
  }

});

/* ══════════════════════════════════════════════════════════════════════
 * E4 — ★★«알려진 결함» 표시 (B8, 2026-09-24 이 카드에서 재확인).
 *
 *   칸 «안»의 내용이 칸을 넘치면 그대로 흘러 «남의 칸 자리»에 찍힌다.
 *   ⛔섹션 «밖»으로 나간 것이 잘리는 것과는 다른 축이다 — 그건 정상이다(현빈 판정).
 *     여기서 재는 것은 「칸 A 의 글자가 칸 C 의 사각형 «안»에 찍히는가」 하나뿐이다.
 *
 *   ★실측(실앱 860px PNG · 4열, 열 폭 161px):
 *     '1234567890'              scrollWidth 388  → 칸 02 안에    384 화소
 *     'https://example.com/a/b' scrollWidth 737  → 칸 02/03 안에 3,130 / 3,260 화소
 *     '초고농축…올리브오일'      scrollWidth 1027 → 칸 02/03 안에 3,671 / 3,546 화소
 *     '우리 제품은 정말 좋습니다…' (띄어쓰기 있음) → 줄바꿈돼 «남의 칸 0 화소»
 *   ⇒ 방아쇠는 «안 끊기는 긴 토큰»이다(숫자·URL·영문·붙여쓴 한글). 띄어쓰기가 있으면 안 난다.
 *
 *   ★폭에 따라 달라진다 — 1080 으로 내보내면 열이 넓어져 글자가 옆 칸 배경에 «가려진다».
 *     ⛔그건 고쳐진 게 아니라 «안 보이게 된» 것이다: 글자는 여전히 칸 밖에 있고,
 *       가려 주는 것이 옆 칸의 배경색일 뿐이라 «옆 칸이 투명하면 그대로 드러난다».
 *     제품 폭은 CANVAS_W = 860 고정이므로 860 이 진짜다.
 *
 *   ★뿌리 둘 — .grd-cell 이 overflow:visible 이고(renderGridBlock),
 *     줄이 word-break:keep-all 이라(_gridLineHtml) 안 끊기는 토큰이 안 접힌다.
 *   ⛔이 카드에서 «안» 고친다. 고치는 길이 둘인데 둘 다 «기존 저장본의 산출»을 바꾼다:
 *       ⓐ 칸을 overflow:hidden → 사용자 글자를 «말없이» 자른다
 *       ⓑ 줄을 overflow-wrap:anywhere → keep-all 로 잡아 둔 한글 줄바꿈 규칙이 바뀐다
 *     어느 쪽인지는 발주(현빈 판정)가 필요하다.
 *   ★임자 = «지디». ⛔「B8 을 올린 유닛」으로 적었다가 고쳤다 — 그 유닛도 지금 «대기»이고,
 *     담당을 「대기」로 닫으면 «없는 담당»이 된다. 지디가 현빈 판정을 매니저 경유로 올린다.
 *
 * ★test.fail() 로 둔다 — 「지금은 빨갛다」를 그냥 빨간 검사로 두면 «다음 빨강»을 가린다.
 *   고쳐지는 날 이 표시가 «예상 밖 통과»로 빨개져서 알려 준다. 그때 test.fail() 을 떼라.
 * ════════════════════════════════════════════════════════════════════ */
test('E4 ★알려진 결함(B8) — 칸을 넘친 글자가 «남의 칸 안»에 찍힌다 (860)', async ({ page }) => {
  test.fail(true, 'B8 — 아직 안 고쳤다. 고치면 이 표시가 빨개진다(그때 test.fail 을 떼라).');
  const errs = await boot(page);
  const r = await page.evaluate(async () => {
    const HOST = document.getElementById('host');
    HOST.innerHTML = '';
    const { row, block } = window.__mk({ cols: [{ width: 1 }, { width: 1 }, { width: 1 }, { width: 1 }] });
    HOST.appendChild(row);
    window.updateGridBlock(block.id, { cells: [[
      { lines: [{ type: 'h1', text: 'https://example.com/a/b', color: '#ff0000' }] },
      { bg: '#00ff00', lines: [{ type: 'body', text: '옆칸' }] },
      { lines: [{ type: 'body', text: 'C2' }] },
      { lines: [{ type: 'body', text: 'C3' }] },
    ]] });
    document.getElementById('__t173clone')?.remove();
    const sec = document.getElementById('sec1');
    const clone = await window.__prepare(sec, 860, true);
    window.__renderInClone(clone);
    clone.id = '__t173clone';
    clone.style.top = '0px'; clone.style.left = '0px'; clone.style.background = '#ffffff';
    clone.getBoundingClientRect();
    /* ★좌표는 «같은 호출 안»에서 읽는다 — 찍은 그림과 다른 판의 사각형을 쓰면 안 된다 */
    const base = clone.getBoundingClientRect();
    window.__rects = [...clone.querySelectorAll('.grd-cell')].map(e => {
      const b = e.getBoundingClientRect();
      return { rc: e.dataset.r + e.dataset.c, x0: Math.round(b.x - base.x), x1: Math.round(b.x + b.width - base.x),
               sw: e.scrollWidth, cw: e.clientWidth };
    });
    window.__cloneH = Math.ceil(base.height);
    return { rects: window.__rects };
  });
  const h = await page.evaluate(() => window.__cloneH);
  await page.setViewportSize({ width: 1000, height: Math.min(4000, Math.max(200, h + 40)) });
  const shot = await page.locator('#__t173clone').screenshot({ type: 'png' });
  const px = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    const per = {}; window.__rects.forEach(c => per[c.rc] = 0);
    let total = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 245 && d[i + 1] < 12 && d[i + 2] < 12) {
        total++;
        const p = i / 4, x = p % cv.width;
        for (const c of window.__rects) if (x >= c.x0 && x < c.x1) { per[c.rc]++; break; }
      }
    }
    return { total, per, w: img.width };
  }, shot.toString('base64'));
  expect(errs).toEqual([]);
  const own = r.rects[0];
  /* ★계측기 — 글자가 애초에 칸보다 넓어야 이 검사에 뜻이 있다 */
  expect(own.sw, `★계측기: 글자가 칸을 안 넘친다(scrollWidth ${own.sw} ≤ clientWidth ${own.cw}) — 잴 것이 없다`)
    .toBeGreaterThan(own.cw);
  expect(px.total, '★계측기: 빨간 글자가 그림에 아예 없다').toBeGreaterThan(100);
  const intruded = Object.entries(px.per).filter(([k, v]) => k !== '00' && v > 0);
  expect(intruded,
    '★칸을 넘친 글자가 «남의 칸 사각형 안»에 찍혔다(B8).\n' +
    `   잰 법: 폭 860 클론을 브라우저가 직접 찍고, 빨간 화소의 x 를 칸 사각형과 대조.\n` +
    `   칸 00 = x ${own.x0}~${own.x1} (scrollWidth ${own.sw} / clientWidth ${own.cw})\n` +
    `   칸별 빨간 화소 ${JSON.stringify(px.per)} (전체 ${px.total})\n` +
    '   ⚠️칸 01 이 0 인 것은 «안 넘쳤다»가 아니다 — 옆 칸 배경이 그 위에 칠해져 가린 것이다.')
    .toEqual([]);
});
