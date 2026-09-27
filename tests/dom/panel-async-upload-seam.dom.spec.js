/* panel-async-upload-seam.dom.spec.js — 우측 패널의 «이미지 업로드» 세 자리가 끝 표본을 남기는가
 *
 * ★어떤 고장인가 (2026-09-22, E-undo e2e U1 이 형제 자리를 잡아 세어 본 결과)
 *   이 세 자리는 FileReader.onload 안에서 `pushHistory()` 를 «먼저» 찍고 «나서» 캔버스를 바꾼다
 *   = 평범한 push-before 다. 그래서 앞 동작이 push-after 였으면 그 push-before 가 꼭대기와
 *   «같은 상태»를 찍어 무변화 차단(js/history.js)에 먹히고, **「업로드의 결과」가 스택에 한 번도 안 남는다.**
 *   ⚠️정정 — 한때 이 셋을 「찍고 → 비동기로 반영」(js/image-handling.js 꼴)으로 분류했는데 «틀렸다».
 *     그 pushHistory 는 콜백 «안»이라 적용과 같은 동기 구간이다. 고치는 값은 같지만 기전은 다르다.
 *     js/props/prop-mockup.js  reader.onload — 목업 화면 이미지
 *     js/props/prop-section.js reader.onload — 섹션 배경 이미지
 *     js/props/prop-zoom.js    reader.onload — 확대블럭 이미지
 *   ⇒ 고침은 «더하기»다 — 반영이 끝난 콜백 «끝»에 표본을 하나 더 찍는다.
 *     ⛔앞의 push-before 를 «옮기지» 않는다(옮기면 이음매가 이사할 뿐 — js/CLAUDE.md 0920 회귀).
 *   같은 모양·같은 고침의 선례 = js/image-handling.js · js/props/asset-video-trim.js (③).
 *
 * ⚠️이 고장은 «눈에 잘 안 보인다» — 업로드 «직후» ⌘Z 는 undo 첫머리의 구제
 *   (js/history.js ensureHistoryCheckpoint)가 라이브를 주워담아 화면상 맞게 보인다.
 *   갈라지는 걸음은 «업로드 뒤에 push-after 편집이 하나 더 오는» 경우다. 아래 A3 가 그것이다.
 *
 * ★어떻게 재나 — «진짜 소스»에서 onload 콜백 몸통을 떠서 돌린다.
 *   세 자리 모두 거대한 showXProperties 클로저 «안»이라 파일을 통째로 얹을 수 없다.
 *   ⇒ 콜백 몸통만 잘라 «진짜 js/globals.js + js/history.js» 위에서 돌린다.
 *     바깥 세계(block/sec·적용 함수·패널 새로고침)는 «모양»만 세운다 — 이 스펙이 재는 것은
 *     「그 콜백이 히스토리에 칸을 남기는가」지 목업의 그림이 아니다.
 *   ⛔몸통을 손으로 베껴 두지 않는다 — 늙으면 슬라이스가 «던진다».
 *
 * 여기서 재는 것(세 자리 각각):
 *   A1 업로드 1회 = 칸이 «정확히 1» 는다.
 *   A2 ⌘Z 한 번이 업로드를 되돌린다.
 *   A3 ★업로드 뒤 push-after 편집이 하나 더 와도 ⌘Z 가 «그 편집만» 되돌린다(업로드는 남는다).
 *   N1 ★양성대조 — «내가 더한 끝 표본 줄만» 걷어낸 몸통이면 A1 이 0 이 되고 A3 가 깨진다.
 *
 * 실행: npm run test:dom -- panel-async-upload-seam
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8').replace(/\r\n/g, '\n');

/* `reader.onload = …` 의 «몸통»을 괄호 세어 떠온다(헤더 모양이 파일마다 다르다). */
function sliceOnload(src, file) {
  const m = /reader\.onload\s*=\s*(?:\(?[A-Za-z0-9_]*\)?)\s*=>\s*\{/.exec(src);
  if (!m) throw new Error(`⛔${file}: reader.onload 화살표를 못 찾았다 — 이 스펙이 늙었다`);
  const open = m.index + m[0].length - 1;
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (d === 0) return { body: src.slice(open + 1, i), arg: (/\(?([A-Za-z0-9_]+)\)?\s*=>/.exec(m[0]) || [, 'e'])[1] }; }
  }
  throw new Error(`⛔${file}: onload 몸통의 끝을 못 찾았다`);
}

/* 세 자리 — 파일 · 끝 표본 라벨 · 「캔버스가 바뀌었나」를 읽는 법 */
const SITES = [
  { file: 'js/props/prop-mockup.js',  label: '목업 화면 이미지',   target: 'block' },
  { file: 'js/props/prop-section.js', label: '섹션 배경 이미지 적용', target: 'sec'   },
  { file: 'js/props/prop-zoom.js',    label: '확대블럭 이미지 적용',  target: 'block' },
];

for (const s of SITES) {
  const src = read(s.file);
  s.slice = sliceOnload(src, s.file);
  /* ⓪ 전제 — 픽스가 «이 몸통 안»에 있다. 없으면 아래가 자가통과한다. */
  s.endLine = `window.pushHistory?.('${s.label}');`;
  if (!s.slice.body.includes(s.endLine)) {
    throw new Error(`⛔${s.file}: onload 몸통에 끝 표본(${s.endLine})이 없다 — 픽스가 사라졌거나 슬라이스가 늙었다`);
  }
  /* 앞의 push-before 가 «그대로 남아» 있는지도 본다 — 옮긴 게 아니라 «더한» 것이어야 한다. */
  const code = s.slice.body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const pushes = (code.match(/pushHistory/g) || []).length;
  if (pushes !== 2) throw new Error(`⛔${s.file}: onload 몸통의 pushHistory 가 ${pushes}개다 — «앞의 push-before + 뒤의 끝 표본» 둘이어야 한다(옮긴 게 아니라 더한 것)`);
  /* 양성대조본 — «내가 더한 그 줄만» 걷는다 */
  s.n1 = s.slice.body.replace(s.endLine, '/* N1: 끝 표본 없음 */');
  if (s.n1 === s.slice.body) throw new Error(`⛔${s.file}: 양성대조 변환이 안 먹었다`);
  /* ⛔변환이 «앞의 push-before» 를 대신 걷지 않았는지 — 라벨이 겹치면 그런 일이 난다(실측).
     양성대조본에도 push-before 는 «그대로» 있어야 한다. */
  const n1code = s.n1.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  if ((n1code.match(/pushHistory/g) || []).length !== 1) {
    throw new Error(`⛔${s.file}: 양성대조 변환이 «틀린 줄»을 걷었다 — 끝 표본 하나만 빠져야 한다`);
  }
}

const HARNESS = (site, body) => `
import './globals.js';
import './history.js';
const canvas = document.getElementById('canvas');
window.getSerializedCanvas = () => canvas.innerHTML;
window.getLastVideoPendingSidecar = () => null;
window.rebindAll = () => {}; window.applyPageSettings = () => {}; window.buildLayerPanel = () => {};
window.deselectAll = () => {}; window.scheduleAutoSave = () => {}; window.triggerAutoSave = () => {};
window.CANVAS_SEL_BLOCKS_AND_SHAPE = '.x.selected';
window.syncSection = () => {}; window.highlightBlock = () => {}; window.setBlockAnchor = () => {};
window.openPanelForBlock = () => {}; window.showHandlesFor = () => {};

/* ── 바깥 세계의 «모양»만 — 이 스펙이 재는 건 칸이지 그림이 아니다 ── */
const block = document.getElementById('t');
const sec = block;
function _applyScreenImage(b, src) { b.dataset.screenImg = src; }
function _applySectionBg(el) { el.dataset.bgApplied = '1'; }
function rerender() { block.dataset.rendered = String(Number(block.dataset.rendered || 0) + 1); }
window.showMockupProperties = () => {};
function showSectionProperties() {}
function showZoomProperties() {}

/* ⛔인자 이름을 짧게 짓지 마라 — 떠온 몸통이 같은 이름을 const 로 다시 선언하면
   (prop-section.js 의 dataUrl) 하네스가 «구문 오류»로 안 뜬다(실측).
   ⛔여기는 템플릿 리터럴 «안»이다 — 주석에도 백틱을 쓰지 마라(리터럴이 끊긴다, 실측 2회). */
window.__runUpload = function (__src) {
  const ${site.slice.arg} = { target: { result: __src } };
  ${body}
};
window.__ready = true;
`;

const BODY = `<div id="canvas"><div class="section-block" id="sec2"><div class="section-inner" id="inner">
  <div class="x" id="t" data-v="1"></div></div></div></div>`;

async function boot(page, site, variant) {
  const body = variant === 'N1' ? site.n1 : site.slice.body;
  await page.route(`${ORIGIN}/**`, async (route) => {
    const u = new URL(route.request().url());
    const js = (b) => route.fulfill({ contentType: 'application/javascript', body: b });
    if (u.pathname === '/__h.html') return route.fulfill({ contentType: 'text/html',
      body: `<!doctype html><html><head><meta charset="utf-8">
        <script type="module" src="/__h.js"></script></head><body>${BODY}</body></html>` });
    if (u.pathname === '/__h.js')     return js(HARNESS(site, body));
    if (u.pathname === '/globals.js') return js(read('js/globals.js'));
    if (u.pathname === '/history.js') return js(read('js/history.js'));
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__h.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/* 걸음: 앞 동작(push-after) → 업로드 → [편집 하나 더] → ⌘Z */
const RUN = async (withTail) => {
  const wait = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0))));
  const el = () => document.getElementById('t');
  const uploaded = () => !!(el().dataset.screenImg || el().dataset.bgApplied || el().dataset.imgSrc);
  window.clearHistory();
  /* 앞 동작이 push-after 였던 상태를 만든다 — 이래야 업로드의 push-before 가 차단에 먹힌다 */
  el().dataset.v = '2';
  window.pushHistory('앞 동작');
  await wait();
  const base = window.historyStack.length;
  window.__runUpload('data:image/png;base64,AAA');
  await wait();
  const out = { slot: window.historyStack.length - base, uploadedAfterRun: uploaded() };
  if (withTail) {
    el().dataset.v = '3';                 // 패널이 «먼저» 바꾸고
    window.pushHistory('꼬리 편집');        // «뒤»에 찍는다 = push-after
    await wait();
    window.undo();
    out.tailGone = el().dataset.v === '2';
    out.uploadKept = uploaded();
  } else {
    window.undo();
    out.uploadUndone = !uploaded();
  }
  return out;
};

for (const site of SITES) {
  const name = site.file.replace('js/props/', '');

  test(`A1·A2 [${name}] 업로드 1회 = 칸 +1 이고 ⌘Z 가 되돌린다`, async ({ page }) => {
    const errs = await boot(page, site, 'fix');
    const r = await page.evaluate(RUN, false);
    expect(r.uploadedAfterRun, '★업로드가 실제로 반영되지 않았다 — 칸 이야기를 할 수 없다').toBe(true);
    expect(r.slot, `★[${name}] 업로드가 되돌리기 «칸»을 안 만든다(+${r.slot}). ` +
      '앞 동작이 push-after 면 업로드의 push-before 가 무변화 차단에 먹힌다 — 반영이 끝난 뒤 한 번 더 찍어야 한다').toBe(1);
    expect(r.uploadUndone, `★[${name}] ⌘Z 가 업로드를 안 되돌린다`).toBe(true);
    expect(errs).toEqual([]);
  });

  test(`A3 ★[${name}] 업로드 뒤 편집이 하나 더 와도 ⌘Z 는 «그 편집만» 되돌린다`, async ({ page }) => {
    await boot(page, site, 'fix');
    const r = await page.evaluate(RUN, true);
    expect(r.slot).toBe(1);
    expect(r.tailGone, `★[${name}] ⌘Z 가 뒤 편집을 안 되돌렸다`).toBe(true);
    expect(r.uploadKept,
      `★[${name}] ⌘Z 한 번이 «뒤 편집 + 업로드» 둘을 같이 먹었다 — 업로드의 결과가 스택에 없다`).toBe(true);
  });

  test(`N1 ★[양성대조 ${name}] 끝 표본만 걷으면 칸이 0 이 되고 업로드가 같이 날아간다`, async ({ page }) => {
    await boot(page, site, 'N1');
    const r = await page.evaluate(RUN, true);
    expect(r.uploadedAfterRun, '양성대조본에서도 «반영»은 된다 — 사라지는 건 칸이지 동작이 아니다').toBe(true);
    expect(r.slot, '★양성대조가 안 먹었다 — 끝 표본을 걷었는데도 칸이 생겼다면 A1 은 «통과를 만들어 내는 검사»다').toBe(0);
    expect(r.uploadKept, '★양성대조 — 이 판에서는 ⌘Z 한 번이 업로드까지 같이 먹어야 한다').toBe(false);
  });
}
