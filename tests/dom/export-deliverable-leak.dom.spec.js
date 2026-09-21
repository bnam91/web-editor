/* export-deliverable-leak.dom.spec.js — «배송본»(단독 HTML)과 «썸네일» 축.
 *   (2026-09-20 사용자 관점 훑기 → 유닛 exportvisual · 2026-09-21 픽스라운드 EVAL 지적 반영)
 *
 * ★왜 이 파일이 따로 있나 — 앞선 세 스펙은 전부 «PNG 클론» 축만 쟀다. PNG 경로는
 *   js/io/export-image.js renderComponentsInClone 이 배너·카드를 «모델로 다시 그려»
 *   DOM 속성을 재계산한다 ⇒ 모델과 DOM 이 어긋나도 PNG 는 «우연히» 멀쩡하다.
 *   실제 사용자가 받는 산출물 중 그 치유가 «없는» 둘 — 단독 HTML 내보내기(export-html.js)와
 *   프로젝트 목록 썸네일(save-load.js captureThumbnail, stripEditorOnlyForCapture 까지만) —
 *   에서만 드러나는 결함이 두 건 있었다(2026-09-21 EVAL high·medium).
 *
 * 여기서 재는 것:
 *   L1 ★배송본 — 이미지 안 넣은 asset-block 의 체커가 «안» 그려진다.
 *      N1 양성대조 — 그 배송본에 앱 CSS 는 «실려 있다»(체커만 빠진 것이지 CSS 가 통째로
 *          빠져서 우연히 안 그려지는 게 아니다 — 0180c54 가 실어 보내기 시작했다).
 *   L2 배송본 — 표 이미지 row 의 빈 칸 체커도 «안» 그려진다(js/blocks 디렉터리 «밖» 자리).
 *   L3 ★양성대조 — 목업의 «진짜 화면 이미지»는 배송본에 그대로 산다(레이어 보존).
 *   L4 ★배너에 글자를 쓰고 «재렌더 없이» 내보내면 그 글자가 배송본에 보인다.
 *      N4 음성대조 — DOM 표시만 낡게 되돌리면 그 글자가 실제로 사라진다(EVAL high 재현).
 *   L5 썸네일 축(stripEditorOnlyForCapture 까지만) — 같은 상황에서 쓴 글자가 안 숨겨진다.
 *   L6 ★updateBanner02Block 로 «색만» 바꿔도 안내문구 표시가 산다(EVAL medium 재현·회귀문).
 *      N6 음성대조 — 표시가 떨어진 모델이면 안내문구가 실제로 보인다.
 *
 * ⛔앱을 «안» 띄운다 — index.html + 레포 파일만 크로미움에 얹는다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js export-deliverable-leak
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
               '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml' };

const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const HARNESS = (() => {
  let h = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  h = h.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  return h.replace('</body>', `<script type="module">
  import '/js/blocks/banner02-block.js';
  import '/js/io/export-html.js';
  import { stripEditorOnlyForCapture } from '/js/io/capture-safety.js';
  window.__strip = stripEditorOnlyForCapture;

  /* 진짜 exportHTMLFile() 을 부르고 «내려받는 대신» 그 HTML 문자열을 가로챈다.
     ⛔손으로 만든 가짜 배송본을 재지 않는다 — 재려는 것이 바로 그 파이프라인이다. */
  window.__exportHtml = async () => {
    let blob = null;
    const oC = URL.createObjectURL, oR = URL.revokeObjectURL;
    const oClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (b) => { blob = b; return 'blob:__stub__'; };
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function () {};
    try { await window.exportHTMLFile(); }
    finally {
      URL.createObjectURL = oC; URL.revokeObjectURL = oR;
      HTMLAnchorElement.prototype.click = oClick;
    }
    return blob ? await blob.text() : null;
  };

  /* 배송본을 실제로 «렌더»해서 computed 로 잰다 — 문자열 검색이 아니라 그려진 결과를 본다. */
  window.__renderExport = async (html) => {
    document.querySelectorAll('iframe.__exp').forEach(f => f.remove());
    const f = document.createElement('iframe');
    f.className = '__exp';
    f.style.cssText = 'position:fixed;left:-99999px;top:0;width:900px;height:1600px;border:0;';
    document.body.appendChild(f);
    await new Promise(res => { f.onload = res; f.srcdoc = html; });
    return f;
  };
  window.__ready = true;
</script></body>`);
})();

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/* ══════════════════════════════════════════════════════════════════════════
   ⑴ 빈 이미지 칸 체커 — 배송본(단독 HTML)
   ══════════════════════════════════════════════════════════════════════════ */
const deliverable = (page, px) => page.evaluate(async ({ px }) => {
  const canvas = document.getElementById('canvas');
  canvas.innerHTML = `
    <div class="section-block" id="sec1">
      <div class="asset-block" id="ab"></div>
      <div class="table-block" id="tb"><table class="tb-table"><tbody><tr data-row-img="true">
        <td><div class="tbl-img-cell" id="tic" style="height:60px;width:100%;cursor:pointer;position:relative;"></div></td>
      </tr></tbody></table></div>
      <div class="mockup-block" id="mkp"><div class="mkp-screen" id="mkps"
        style="width:100px;height:100px;background:url('${px}') top center / cover no-repeat, repeating-conic-gradient(#d8d8d8 0% 25%, #f0f0f0 0% 50%) 0 0 / 72px 72px"></div></div>
    </div>`;
  const liveBg = (sel) => window.getComputedStyle(document.querySelector(sel)).backgroundImage || '';
  const live = { asset: liveBg('#ab'), tbl: liveBg('#tic'), mockup: liveBg('#mkps') };

  const html = await window.__exportHtml();
  const f = await window.__renderExport(html);
  const D = f.contentDocument, W = f.contentWindow;
  const bg = (sel) => { const el = D.querySelector(sel); return el ? (W.getComputedStyle(el).backgroundImage || '') : '__MISSING__'; };
  const out = {
    live,
    asset: bg('#ab'), tbl: bg('#tic'), mockup: bg('#mkps'),
    // ★양성대조 — 앱 CSS 가 실제로 실려 «그려지고» 있다(체커만 빠진 것이지 CSS 가 통째로
    //   빠져서 우연히 안 나오는 게 아니다). .asset-block{height:780px;display:flex} 는 앱 CSS 몫.
    assetH: D.querySelector('#ab') ? W.getComputedStyle(D.querySelector('#ab')).height : '',
    assetDisplay: D.querySelector('#ab') ? W.getComputedStyle(D.querySelector('#ab')).display : '',
    // 배송본 안에서 체커로 «그려지는» 요소 수 — 자르지 않은 전수.
    drawn: [...D.querySelectorAll('*')].filter(el =>
      /repeating-conic-gradient/i.test(W.getComputedStyle(el).backgroundImage || '')).length,
    // ★그려지는지만이 아니라 «실려 나가는지»도 센다 — 이 파일의 원칙은 「숨기지 말고 뺀다」다.
    srcHits: (html.match(/repeating-conic-gradient/g) || []).length,
    htmlLen: html.length,
  };
  f.remove();
  return out;
}, { px });

test('N1 ★양성대조 — 배송본에 앱 CSS 가 실제로 실려 그려진다(체커만 빠진 것이 맞다)', async ({ page }) => {
  const errs = await boot(page);
  const r = await deliverable(page, PX);
  console.log('  N1:', { assetH: r.assetH, assetDisplay: r.assetDisplay, htmlLen: r.htmlLen });
  expect(r.assetH, '★여기가 780px 이 아니면 앱 CSS 가 통째로 안 실린 것 — L1 은 아무것도 증명 못 한다')
    .toBe('780px');
  expect(r.assetDisplay).toBe('flex');
  // 라이브 캔버스에서는 체커가 «보인다»(계측기가 뭔가를 재고 있다)
  expect(/repeating-conic-gradient/i.test(r.live.asset)).toBe(true);
  expect(/repeating-conic-gradient/i.test(r.live.tbl)).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('L1 ★배송본 — 이미지 안 넣은 asset-block 의 체크무늬가 «안» 그려진다', async ({ page }) => {
  const errs = await boot(page);
  const r = await deliverable(page, PX);
  console.log('  L1 asset bg:', r.asset);
  expect(/repeating-conic-gradient/i.test(r.asset),
    '편집용 무늬가 배송물에 실린다 — 받는 사람 화면에 바둑판이 보인다').toBe(false);
  expect(r.srcHits,
    '★그려지지만 않을 뿐 «소스에는 남아 있다» — 이 파일의 원칙은 숨기기가 아니라 빼기다').toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('L2 배송본 — 표 이미지 row 빈 칸(.tbl-img-cell) 체커도 «안» 그려진다', async ({ page }) => {
  const errs = await boot(page);
  const r = await deliverable(page, PX);
  console.log('  L2 tbl bg:', r.tbl);
  expect(/repeating-conic-gradient/i.test(r.tbl)).toBe(false);
  expect(r.drawn, '배송본 어디에도 체커가 그려지면 안 된다(전수, 자르지 않음)').toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('L3 ★양성대조 — 목업의 «진짜 화면 이미지»는 배송본에 그대로 산다(레이어 보존)', async ({ page }) => {
  const errs = await boot(page);
  const r = await deliverable(page, PX);
  console.log('  L3 mockup bg:', r.mockup.slice(0, 80));
  expect(/url\(/.test(r.mockup),
    '★체커를 걷으면서 실사용 이미지까지 지웠다 — 통째로 none 을 박은 것이다').toBe(true);
  expect(/repeating-conic-gradient/i.test(r.mockup)).toBe(false);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════════
   ⑵ 배너에 쓴 글자 — 재렌더가 «없는» 두 산출물에서 사라지던 자리 (EVAL high)
   ══════════════════════════════════════════════════════════════════════════ */
/* @param mode 'new' = 지금 코드 · 'stale' = blur 뒤 DOM 표시만 낡게 되돌린다(고치기 전 꼴) */
const typedBanner = (page, mode) => page.evaluate(async (mode) => {
  const canvas = document.getElementById('canvas');
  canvas.innerHTML = '<div class="section-block" id="sec1"></div>';
  const sec = document.getElementById('sec1');
  const { row, block } = window.makeBanner02Block({});
  block.id = 'bn';
  sec.appendChild(row);
  window.renderBanner02(block);

  // 캔버스 편집과 «같은 경로» — 더블클릭 → 타자 → 빈 곳 클릭(blur). ⛔재렌더를 «안» 부른다.
  const el = block.querySelector('[data-line-idx="1"]');
  el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  el.textContent = 'QQLABELQQ';
  el.dispatchEvent(new InputEvent('input', { bubbles: true }));
  el.dispatchEvent(new FocusEvent('blur'));

  if (mode === 'stale') {
    // 고치기 «전» 꼴 — 모델은 떨어졌는데 DOM 속성만 남아 있던 그 상태.
    el.dataset.isPlaceholder = 'true';
    el.dataset.placeholder = '제목을 입력합니다.';
  }

  const model = JSON.parse(block.dataset.lines || '[]').map(l => l.placeholder === true ? 'P' : '-');
  const domPh = [...block.querySelectorAll('.bn2-text > *')].map(e => e.dataset.isPlaceholder || '-');
  const editorOpacity = window.getComputedStyle(el).opacity;

  // ── 축 ⓐ 단독 HTML 배송본
  const html = await window.__exportHtml();
  const f = await window.__renderExport(html);
  const D = f.contentDocument, W = f.contentWindow;
  const delivered = [...D.querySelectorAll('.bn2-text > *')].map(e => ({
    text: e.textContent, vis: W.getComputedStyle(e).visibility,
  }));
  f.remove();

  // ── 축 ⓑ 썸네일(captureThumbnail 과 «같은» 걷기까지만 — 재렌더가 없는 경로)
  const clone = sec.cloneNode(true);
  clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;';
  document.body.appendChild(clone);
  window.__strip(clone);
  const thumb = [...clone.querySelectorAll('.bn2-text > *')].map(e => ({
    text: e.textContent, vis: window.getComputedStyle(e).visibility,
  }));
  clone.remove();

  return { model, domPh, editorOpacity, delivered, thumb };
}, mode);

test('N4 ★음성대조 — DOM 표시만 낡으면 «쓴 글자»가 배송본에서 실제로 사라진다', async ({ page }) => {
  const errs = await boot(page);
  const r = await typedBanner(page, 'stale');
  console.log('  N4 delivered:', r.delivered);
  const typed = r.delivered.find(x => x.text === 'QQLABELQQ');
  expect(typed, '쓴 줄을 못 찾았다 — 계측기가 틀렸다').toBeTruthy();
  expect(typed.vis, '★여기서 visible 이 나오면 L4 는 아무것도 증명하지 못한다').toBe('hidden');
  expect(r.thumb.find(x => x.text === 'QQLABELQQ').vis).toBe('hidden');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('L4 ★글자를 쓰고 «재렌더 없이» 내보내면 그 글자가 배송본에 보인다', async ({ page }) => {
  const errs = await boot(page);
  const r = await typedBanner(page, 'new');
  console.log('  L4:', { model: r.model, domPh: r.domPh, delivered: r.delivered });
  expect(r.model, '모델에서 표시가 떨어져야 한다').toEqual(['P', '-', 'P']);
  expect(r.domPh, '★모델과 DOM 이 어긋나면 안 된다 — 이 어긋남이 결함의 실체였다')
    .toEqual(['true', '-', 'true']);
  const typed = r.delivered.find(x => x.text === 'QQLABELQQ');
  expect(typed.vis, '사용자가 방금 쓴 글자가 배송본에서 통째로 사라진다').toBe('visible');
  // 안 건드린 두 줄은 여전히 안내문구 — 과잉 수정이 아니다.
  expect(r.delivered.filter(x => x.text !== 'QQLABELQQ').map(x => x.vis)).toEqual(['hidden', 'hidden']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('L5 썸네일 축에서도 같다 + 에디터에서 방금 쓴 글자가 흐리지 않다', async ({ page }) => {
  const errs = await boot(page);
  const r = await typedBanner(page, 'new');
  console.log('  L5:', { thumb: r.thumb, editorOpacity: r.editorOpacity });
  expect(r.thumb.find(x => x.text === 'QQLABELQQ').vis).toBe('visible');
  expect(r.editorOpacity, '방금 쓴 글자가 캔버스에서 계속 흐리면(0.45) 표시가 안 떨어진 것이다')
    .toBe('1');
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════════
   ⑶ 색만 바꾸는 partial 업데이트가 안내문구를 «본문으로 승격»시키던 자리 (EVAL medium)
   ══════════════════════════════════════════════════════════════════════════ */
const colorOnly = (page, mode) => page.evaluate(async (mode) => {
  const canvas = document.getElementById('canvas');
  canvas.innerHTML = '<div class="section-block" id="sec1"></div>';
  const sec = document.getElementById('sec1');
  const { row, block } = window.makeBanner02Block({});
  block.id = 'bn';
  sec.appendChild(row);
  window.renderBanner02(block);
  const before = JSON.parse(block.dataset.lines).map(l => l.placeholder === true ? 'P' : '-');

  window.updateBanner02Block('bn', { labelColor: '#ff0000' });

  if (mode === 'dropped') {
    // 고치기 «전» 꼴 — _legacyLine 이 표시를 떨어뜨린 그 모델.
    const arr = JSON.parse(block.dataset.lines);
    delete arr[0].placeholder;
    block.dataset.lines = JSON.stringify(arr);
    window.renderBanner02(block);
  }
  const after = JSON.parse(block.dataset.lines).map(l => l.placeholder === true ? 'P' : '-');

  const html = await window.__exportHtml();
  const f = await window.__renderExport(html);
  const D = f.contentDocument, W = f.contentWindow;
  const delivered = [...D.querySelectorAll('.bn2-text > *')].map(e => ({
    text: e.textContent, vis: W.getComputedStyle(e).visibility, color: W.getComputedStyle(e).color,
  }));
  f.remove();
  return { before, after, delivered };
}, mode);

test('N6 ★음성대조 — 표시가 떨어진 모델이면 안내문구가 실제로 배송본에 보인다', async ({ page }) => {
  const errs = await boot(page);
  const r = await colorOnly(page, 'dropped');
  console.log('  N6:', { after: r.after, delivered: r.delivered });
  expect(r.after).toEqual(['-', 'P', 'P']);
  expect(r.delivered[0].vis, '★여기서 hidden 이면 L6 은 아무것도 증명하지 못한다').toBe('visible');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('L6 ★색만 바꾸는 updateBanner02Block 이 안내문구 표시를 떨어뜨리지 않는다', async ({ page }) => {
  const errs = await boot(page);
  const r = await colorOnly(page, 'new');
  console.log('  L6:', { before: r.before, after: r.after, delivered: r.delivered });
  expect(r.before).toEqual(['P', 'P', 'P']);
  expect(r.after, '★글자를 안 건드렸는데 표시가 떨어지면 「라벨입니다.」가 본문으로 승격된다')
    .toEqual(['P', 'P', 'P']);
  expect(r.delivered.map(x => x.vis)).toEqual(['hidden', 'hidden', 'hidden']);
  // 색은 «실제로» 바뀌었다 — 표시 보존이 업데이트를 무력화한 것이 아니다(양성대조).
  expect(r.delivered[0].color).toBe('rgb(255, 0, 0)');
  expect(errs, errs.join(' | ')).toEqual([]);
});
