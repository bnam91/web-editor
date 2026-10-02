/* thumbnail-object-fit.dom.spec.js — 「목록 썸네일의 그림이 화면과 다르다」
 *
 * ★왜 (2026-09-21 최종통합 QA medium)
 *   프로젝트 목록 썸네일은 html2canvas 로 찍는다(js/io/save-load.js captureThumbnail).
 *   동봉한 html2canvas 1.4.1 에는 `object-fit` 이 «한 글자도» 없다
 *   (vendor/html2canvas/html2canvas.min.js — 문자열 0건, 이 파일 T0 가 매번 확인한다).
 *   ⇒ 화면·네이티브 PNG 는 cover 로 가운데를 «자르는데» 썸네일만 전체 그림을 «늘려» 넣는다.
 *   실측(QA): 그리드 716×300 = 초록 16행·주황 17행 / 패널 400×150 에셋 = 8·8 /
 *            세로그림 교체 600×377 = 13·12.9 (화면은 전부 0행).
 *            상자 비율 = 그림 비율인 풀블리드만 29·29 로 화면과 같았다 = 양성대조.
 *   최종통합 medium ⑤ 는 «편집 화면이 찍힌다»(스트립 명부)만 닫았고 이 렌더러 축은 안 닫혔다.
 *
 * 여기서 재는 것 — 앱을 «안» 띄우고 captureThumbnail 의 줄을 그대로 재현한다:
 *   T0  전제 — 동봉 html2canvas 에 object-fit 구현이 없다(이 스펙이 «왜» 필요한지의 근거).
 *   T1  ★음성대조 — 고침을 «끄면» 잘려야 할 마커 띠가 썸네일에 나타난다.
 *   T2  ★고침 — 같은 클론에 고침을 «켜면» 화면과 같이 0행이다.
 *   T3  ★양성대조 — 상자 비율 = 그림 비율인 그림은 두 경우 모두 띠가 «보인다»
 *        (= 계측기가 띠를 실제로 셀 줄 안다. T2 의 0행이 「아무것도 못 세서 0」이 아니다.)
 *   T4  SSOT 소스 대조 — html2canvas 를 쓰는 3경로가 전부 이 중화를 부른다.
 *
 * ⛔앱을 «안» 띄운다. 실행: npm run test:dom -- thumbnail-object-fit
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const APP_CSS_LINKS = ['editor-base', 'editor-canvas', 'editor-layout', 'editor-blocks', 'editor-extra']
  .map(n => `<link rel="stylesheet" href="/css/${n}.css">`).join('\n');

/* 섹션 좌우 패딩 72 ⇒ 본문 폭 716 (실앱 기본값과 같은 수). */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
${APP_CSS_LINKS}
<style>
  #canvas{width:860px;}
  .section-block{position:relative;background:#fff;}
  .section-inner{padding-left:72px;padding-right:72px;display:block;}
  .row{position:relative;display:flex;width:100%;}
</style>
<script src="/vendor/html2canvas/html2canvas.min.js"></script>
</head><body>
<div id="canvas-wrap"><div id="canvas-scaler"><div id="canvas">
  <div class="section-block" id="sec"><div class="section-inner" data-padding-x="72">
    <!-- ① 그리드 블럭의 이미지 줄 — 716×300 상자에 860×540 그림(cover 면 위·아래가 잘린다) -->
    <div class="row" data-layout="stack">
      <div class="grid-block" style="display:flex;gap:24px;width:100%;">
        <div class="grd-col" style="flex:1;min-width:0;display:flex;flex-direction:column;">
          <img class="grd-img" id="grd" draggable="false" style="display:block;width:100%;height:300px;object-fit:cover;">
        </div>
      </div>
    </div>
    <!-- ② 우측패널 H 칸이 만든 에셋 — 400×150 (비율이 그림과 «다르다») -->
    <div class="row" data-layout="stack">
      <div class="asset-block has-image" style="width:400px;height:150px;align-self:center;">
        <div class="asset-img-clip"><img class="asset-img" id="ab400" draggable="false" style="object-fit:cover"></div>
      </div>
    </div>
    <!-- ③ 양성대조 — 상자 비율 = 그림 비율(400 × 251.16). cover 가 «아무것도 안 자른다» -->
    <div class="row" data-layout="stack">
      <div class="asset-block has-image" style="width:400px;height:251.16px;align-self:center;">
        <div class="asset-img-clip"><img class="asset-img" id="abok" draggable="false" style="object-fit:cover"></div>
      </div>
    </div>
  </div></div>
</div></div></div>
<script type="module">
  import { stripEditorOnlyForCapture, neutralizeObjectFitForH2C } from '/js/io/capture-safety.js';
  window.__strip = stripEditorOnlyForCapture;
  window.__objfit = neutralizeObjectFitForH2C;
  /* 마커 그림 860×540 — 위 20px 초록(#00ff00) · 아래 20px 주황(#ff8800) · 가운데 회색.
     ⛔파일로 두지 않고 여기서 굽는다: 자연 크기·색이 «검사의 전제»라 눈에 보여야 한다. */
  const c = document.createElement('canvas');
  c.width = 860; c.height = 540;
  const x = c.getContext('2d');
  x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, 860, 540);
  x.fillStyle = '#00ff00'; x.fillRect(0, 0, 860, 20);
  x.fillStyle = '#ff8800'; x.fillRect(0, 520, 860, 20);
  const url = c.toDataURL('image/png');
  await Promise.all(['grd', 'ab400', 'abok'].map(id => new Promise(res => {
    const im = document.getElementById(id);
    im.onload = res; im.onerror = res; im.src = url;
  })));
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/** captureThumbnail(js/io/save-load.js:77~99)의 «줄 그대로»: 클론 → 걷기 → width:860 → 찍기.
 *  withFix=false 가 «고치기 전»이다(중화를 건너뛴다). 찍힌 캔버스에서 각 상자의 가운데
 *  세로줄 픽셀을 읽어 원본 위·아래 마커 띠가 «살아 있는지» 센다 — cover 라면 0행이어야 한다. */
const shoot = (page, withFix) => page.evaluate(async (withFix) => {
  const sec = document.getElementById('sec');
  const clone = sec.cloneNode(true);
  window.__strip(clone);
  clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;margin:0;outline:none;';
  document.body.appendChild(clone);
  const changed = withFix ? await window.__objfit(clone) : 0;
  const boxes = {};
  const cr = clone.getBoundingClientRect();
  for (const id of ['grd', 'ab400', 'abok']) {
    const r = clone.querySelector('#' + id).getBoundingClientRect();
    boxes[id] = { x: Math.round(r.left - cr.left), y: Math.round(r.top - cr.top),
                  w: Math.round(r.width), h: Math.round(r.height) };
  }
  const canvas = await html2canvas(clone, { scale: 1, useCORS: true, backgroundColor: '#ffffff', logging: false });
  const ctx = canvas.getContext('2d');
  const out = { changed, shot: { w: canvas.width, h: canvas.height }, marks: {} };
  for (const [id, b] of Object.entries(boxes)) {
    const cx = Math.min(canvas.width - 1, b.x + Math.round(b.w / 2));
    const d = ctx.getImageData(cx, Math.max(0, b.y), 1, Math.min(b.h, canvas.height - b.y)).data;
    let green = 0, orange = 0;
    for (let i = 0; i < d.length; i += 4) {
      const R = d[i], G = d[i + 1], B = d[i + 2];
      if (G > 180 && R < 110 && B < 110) green++;
      if (R > 200 && G > 90 && G < 190 && B < 90) orange++;
    }
    out.marks[id] = { box: [b.w, b.h], green, orange };
  }
  clone.remove();
  return out;
}, withFix);

test('T0 전제 — 동봉 html2canvas 에는 object-fit 구현이 «없다»', () => {
  const src = fs.readFileSync(path.join(REPO, 'vendor/html2canvas/html2canvas.min.js'), 'utf8');
  expect(src, '전제가 깨졌다 — 라이브러리가 바뀌었으면 이 스펙의 «왜»부터 다시 써라').toContain('html2canvas 1.4.1');
  const hits = (src.match(/object-?[Ff]it/g) || []).length;
  console.log('  T0 object-fit 언급:', hits, '건');
  expect(hits, '★html2canvas 가 object-fit 을 알게 됐다 — 중화가 이제 이중처리일 수 있다').toBe(0);
});

test('T1 ★음성대조 — 중화를 끄면 잘려야 할 마커 띠가 썸네일에 «나타난다»', async ({ page }) => {
  const errs = await boot(page);
  const r = await shoot(page, false);
  console.log('  T1(고치기 전):', JSON.stringify(r.marks));
  expect(r.changed, '음성대조인데 중화가 돌았다').toBe(0);
  // 716×300 / 400×150 은 cover 면 위·아래가 통째로 잘려 0행이어야 하는데 «보인다»
  expect(r.marks.grd.green + r.marks.grd.orange,
    '★고치기 전인데 그리드에 마커가 0행이다 — 이 음성대조가 아무것도 안 보고 있다').toBeGreaterThan(5);
  expect(r.marks.ab400.green + r.marks.ab400.orange,
    '★고치기 전인데 에셋에 마커가 0행이다').toBeGreaterThan(3);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T2 ★고침 — 중화를 켜면 썸네일도 화면과 같이 «가운데만» 보인다(마커 0행)', async ({ page }) => {
  const errs = await boot(page);
  const r = await shoot(page, true);
  console.log('  T2(고친 뒤):', JSON.stringify(r.marks), 'changed=', r.changed);
  /* ★정확히 2 다 — 비율이 «어긋난» 두 장만 갈아 끼우고, 비율이 같은 셋째(abok)는
     자를 것이 없으므로 손대지 않는다(재인코딩으로 화질만 상한다). */
  expect(r.changed, '★중화가 갈아 끼운 장수가 2 가 아니다 (0=안 돌았다 / 3=자를 것 없는 그림까지 건드렸다)').toBe(2);
  expect(r.marks.grd.green,  `그리드 상단 마커 ${r.marks.grd.green}행 — cover 라면 0`).toBeLessThanOrEqual(1);
  expect(r.marks.grd.orange, `그리드 하단 마커 ${r.marks.grd.orange}행 — cover 라면 0`).toBeLessThanOrEqual(1);
  expect(r.marks.ab400.green,  `에셋 상단 마커 ${r.marks.ab400.green}행`).toBeLessThanOrEqual(1);
  expect(r.marks.ab400.orange, `에셋 하단 마커 ${r.marks.ab400.orange}행`).toBeLessThanOrEqual(1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T3 ★양성대조 — 상자 비율 = 그림 비율이면 «두 경우 모두» 띠가 보인다(계측기 증명)', async ({ page }) => {
  const errs = await boot(page);
  const before = (await shoot(page, false)).marks.abok;
  const after  = (await shoot(page, true)).marks.abok;
  console.log('  T3 abok before:', JSON.stringify(before), ' after:', JSON.stringify(after));
  for (const [tag, m] of [['고치기 전', before], ['고친 뒤', after]]) {
    expect(m.green,  `${tag} — 안 잘려야 할 상단 띠가 안 보인다(계측기가 못 센다)`).toBeGreaterThan(4);
    expect(m.orange, `${tag} — 안 잘려야 할 하단 띠가 안 보인다`).toBeGreaterThan(4);
  }
  // 중화는 «비율이 같으면» 손대지 않는다(재인코딩으로 화질만 상한다) ⇒ 두 수가 사실상 같다
  expect(Math.abs(after.green - before.green), '비율이 같은 그림까지 건드렸다').toBeLessThanOrEqual(2);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T4 ★SSOT — html2canvas 를 쓰는 3경로가 전부 object-fit 중화를 부른다', () => {
  const need = [
    ['js/io/save-load.js', '프로젝트 목록 썸네일(captureThumbnail)'],
    ['js/props/prop-mockup.js', '목업 캡처(_captureAndApply)'],
    ['js/io/export-image.js', 'PNG 내보내기의 html2canvas 폴백(웹 빌드)'],
  ];
  for (const [f, why] of need) {
    const src = fs.readFileSync(path.join(REPO, f), 'utf8');
    expect(src, `★${why} 가 object-fit 중화를 안 부른다 — 그 경로만 «다른 그림»이 된다`)
      .toMatch(/await\s+neutralizeObjectFitForH2C\s*\(\s*clone\s*\)/);
  }
  /* ⛔네이티브(CDP) 경로에는 «없어야» 한다 — 브라우저가 object-fit 을 제대로 그리므로
     거기서 미리 자르면 두 번 잘린다. export-image.js 의 호출은 html2canvas 폴백 «뒤»에 있다. */
  const ei = fs.readFileSync(path.join(REPO, 'js/io/export-image.js'), 'utf8');
  const iNative = ei.indexOf('captureSectionCdp 미지원');
  const iCall = ei.indexOf('await neutralizeObjectFitForH2C(clone)');
  expect(iNative).toBeGreaterThan(0);
  expect(iCall, '★중화 호출이 네이티브 분기보다 앞에 있다 — CDP 캡처에서 두 번 잘린다').toBeGreaterThan(iNative);
});
