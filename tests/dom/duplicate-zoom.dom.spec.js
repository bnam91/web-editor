/* duplicate-zoom.dom.spec.js — ⌘D 가 줌 블록을 «정상 경로»로 복제하는가. (2026-09-09)
 *
 * ★배경 — 이 검사가 없으면 무엇이 안 잡히나
 *   duplicateSelected() 의 selBlock 목록에 .zoom-block 이 «없었다». 그래도 ⌘D 결과는 맞았다 —
 *   목록에서 떨어진 블록은 copySelected/pasteClipboard 폴백으로 가고, 그 폴백도 dataset 을
 *   통째로 싣기 때문이다. ⇒ 「결과만」 재는 검사는 이 병을 «영영 못 본다».
 *   ⛔그런데 폴백은 다른 일을 한다: freeLayout 절대배치의 +20px 오프셋과 id 재발급은
 *     정상 경로(absWrapper 분기)의 몫이다. 목록이 틀린 채로 두면, 그 분기가 하는 일이
 *     필요해지는 순간(그리고 그날 다른 사람이 폴백을 손보는 순간) 조용히 갈린다.
 *   ⇒ 그래서 «어느 경로로 갔나»를 «결과와 따로» 잰다. copySelected 를 스파이로 막고
 *     그것이 «안 불렸다»를 본다 — 폴백으로 떨어지면 반드시 불린다.
 *
 * ★재는 것 셋
 *   ⑴ 경로: 정상 분기로 갔다(copySelected 미호출) + 절대배치 오프셋 +20px 이 실제로 걸렸다
 *   ⑵ 결과 보존: 줌 상태 키가 «전수» 같다(여섯 개만 고르지 않는다) · id 는 다르다
 *   ⑶ _zoomPicked(사람이 집어 둔 앵커)는 «안» 따라온다 — 밑줄 프로퍼티라 cloneNode 밖이다
 *
 * ⛔앱을 «안» 띄운다. 실행: npx playwright test --config=tests/dom/playwright.dom.config.js duplicate-zoom
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const EDITOR_SRC = fs.readFileSync(path.join(REPO, 'js/editor.js'), 'utf8');

/** 함수 «전체»를 중괄호 균형으로 떠낸다(매개변수 괄호를 먼저 닫는다). */
function extractFn(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('함수를 못 찾았다: ' + name);
  let i = m.index + m[0].length - 1, d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')') { d--; if (d === 0) { i++; break; } }
  }
  while (i < src.length && src[i] !== '{') i++;
  let b = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') b++;
    else if (src[i] === '}') { b--; if (b === 0) { i++; break; } }
  }
  return src.slice(m.index, i);
}
const DUP_SRC = extractFn(EDITOR_SRC, 'duplicateSelected');

/* 줌 블록 픽스처 — 상태 키를 «전부» 채운다. 몇 개만 채우면 「안 따라온 키」를 못 본다. */
const ZOOM_ATTRS = {
  shape: 'circle', angle: '35', length: '120', spread: '18', maxop: '70', curve: '40',
  narrow: '25', size: '160', rot: '12', fill: '#ff8800', w: '240', h: '180',
  x: '5', y: '-7', shadow: 'on', dropShadow: 'soft', bd: 'on', bdw: '3',
  bdc: '#123456', bdr: '9',
};
const ATTR_HTML = Object.entries(ZOOM_ATTRS)
  .map(([k, v]) => ` data-${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}="${v}"`).join('');

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div id="canvas"><div class="section-block" id="sec1"><div class="section-inner">
  <div class="frame-block" id="ss_free" data-free-layout="true" style="position:relative;height:600px">
    <div class="zoom-block selected" id="zoom_a" style="position:absolute;left:40px;top:30px"${ATTR_HTML}>
      <div class="zoom-clip"></div>
    </div>
  </div>
</div></div></div></body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: HARNESS }));
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  return errs;
}

/** duplicateSelected 를 «진짜 소스 그대로» 돌리되, 바깥 의존을 스파이로 세운다. */
async function runDuplicate(page) {
  return page.evaluate((dupSrc) => {
    const calls = { copySelected: 0, pasteClipboard: 0, pushHistory: [] };
    // duplicateSelected 가 부르는 바깥 것들 — 전부 스텁. copySelected 호출이 «폴백의 지문»이다.
    const scope = {
      copySelected: () => { calls.copySelected++; },
      pasteClipboard: () => { calls.pasteClipboard++; },
      deselectAll: () => document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected')),
      multiSel: { cols: new Set(), blocks: new Set() },
      showMultiSelPanel: () => {}, clearMultiSel: () => {},
    };
    window.pushHistory = (t) => calls.pushHistory.push(t);
    window.genId = (p) => p + '_' + Math.random().toString(36).slice(2, 9);
    window.bindBlock = () => {}; window.bindFrameDropZone = () => {};
    window.buildLayerPanel = () => {}; window.renderChatBlock = () => {};

    const names = Object.keys(scope);
    const fn = new Function(...names, `${dupSrc}; return duplicateSelected;`)(...names.map(n => scope[n]));

    const before = document.querySelector('.zoom-block');
    before._zoomPicked = 'tl';                       // 사람이 집어 둔 앵커 — 따라오면 안 된다
    fn();

    const blocks = [...document.querySelectorAll('.zoom-block')];
    const read = (el) => {
      const o = {};
      for (const k of Object.keys(el.dataset)) o[k] = el.dataset[k];
      return o;
    };
    return {
      calls,
      개수: blocks.length,
      ids: blocks.map(b => b.id),
      키: blocks.map(read),
      left: blocks.map(b => b.style.left),
      top: blocks.map(b => b.style.top),
      zoomPicked: blocks.map(b => b._zoomPicked ?? null),
    };
  }, DUP_SRC);
}

test('DZ0 ★떠낸 duplicateSelected 가 «비어 있지 않다» + 목록에 .zoom-block 이 있다', () => {
  expect(DUP_SRC.length, 'duplicateSelected 를 못 떼었다 — 아래는 아무것도 안 잰다').toBeGreaterThan(800);
  expect(DUP_SRC, '★selBlock 목록에 .zoom-block 이 없다 — 줌 블록이 폴백으로 떨어진다')
    .toMatch(/\.zoom-block\.selected/);
});

test('DZ1 ★줌 블록 ⌘D 가 «정상 경로»로 간다 (폴백의 지문 = copySelected 호출)', async ({ page }) => {
  const errs = await boot(page);
  const out = await runDuplicate(page);

  // ★입력이 살아 있다 — 픽스처가 실제로 freeLayout 안의 절대배치 줌 블록이었다.
  expect(out.개수, '복제가 아예 안 일어났다 — 이 검사는 잴 것이 없었다').toBe(2);

  expect(out.calls.copySelected,
    '★copySelected 가 불렸다 = 폴백으로 떨어졌다. selBlock 목록에서 .zoom-block 이 빠진 것이다').toBe(0);
  expect(out.calls.pasteClipboard, '★pasteClipboard 도 불렸다 = 폴백 경로다').toBe(0);
  expect(out.calls.pushHistory, '★정상 경로의 히스토리 두 겹이 없다').toEqual(['복제', '복제 완료']);

  // 정상 경로가 «하는 일» — 절대배치 +20px 오프셋. 폴백은 이걸 안 한다.
  expect(out.left, '★+20px 오프셋이 안 걸렸다 — 정상 경로의 일이 안 일어났다').toEqual(['40px', '60px']);
  expect(out.top, '★+20px 오프셋이 안 걸렸다').toEqual(['30px', '50px']);

  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('DZ2 ★결과가 전과 같다 — 줌 상태 키 «전수» 동일 · id 는 다름 · _zoomPicked 는 안 따라옴', async ({ page }) => {
  const errs = await boot(page);
  const out = await runDuplicate(page);

  expect(out.개수, '복제가 안 일어났다').toBe(2);
  /* ★「여섯 키」가 아니라 «전수»를 본다 — 고른 몇 개만 보면 새 키가 생기는 날 못 본다.
     ⚠️단 offsetX/offsetY 는 «정상 경로가 스스로 찍는» 장부다(editor.js 의 절대배치 분기).
       그건 「안 따라온 상태」가 아니라 「이 경로가 새로 만드는 것」이라 따로 본다(DZ3).
       ⛔이 둘을 «상태 키»와 한 통에 넣고 세면, 진짜로 키가 빠지는 날을 못 가려낸다. */
  const 장부 = new Set(['offsetX', 'offsetY']);
  const 상태만 = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !장부.has(k)));
  const 키수 = Object.keys(상태만(out.키[0])).length;
  expect(키수, '★원본에 줌 상태 키가 거의 없다 — 픽스처가 비어 「전수 동일」이 공짜다').toBeGreaterThanOrEqual(20);
  expect(상태만(out.키[1]), `★줌 상태 키 ${키수}개 중 일부가 안 따라왔다`).toEqual(상태만(out.키[0]));

  expect(out.ids[0], '★id 가 같다 — 복제본이 원본 id 를 물려받으면 저장·레이어가 엉킨다')
    .not.toBe(out.ids[1]);
  expect(out.ids[1], '★복제본 id 가 원본 접두사를 안 물려받았다').toMatch(/^zoom_/);

  // ★_zoomPicked 는 «밑줄 프로퍼티»라 cloneNode 밖이다 — 사람이 집어 둔 앵커가 딸려오면 안 된다.
  expect(out.zoomPicked[0], '★원본의 앵커가 사라졌다 — 이 검사는 잴 것이 없었다').toBe('tl');
  expect(out.zoomPicked[1], '★_zoomPicked 가 복제본에 따라왔다').toBe(null);

  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('DZ3 ★정상 경로가 «새로 찍는» 것 — 절대배치 장부(offsetX/Y)가 오프셋과 «같은 값»이다', async ({ page }) => {
  const errs = await boot(page);
  const out = await runDuplicate(page);

  expect(out.개수, '복제가 안 일어났다').toBe(2);
  /* ★이건 폴백에는 «없던» 것이다 — ⌘D 결과가 전과 «완전히» 같지는 않다는 뜻이고,
     그게 이 고침의 요점이다. 달라진 것을 숨기지 말고 여기서 이름 붙여 못박는다.
     ⛔장부와 style 이 어긋나면 나중에 드래그·저장이 서로 다른 좌표를 믿는다. */
  expect(out.키[0].offsetX, '★원본에 장부가 생겼다 — 라이브 원본을 건드리면 안 된다').toBeUndefined();
  expect(out.키[1].offsetX, '★복제본 장부가 style.left 와 어긋난다').toBe('60');
  expect(out.키[1].offsetY, '★복제본 장부가 style.top 과 어긋난다').toBe('50');
  expect(`${out.키[1].offsetX}px`, '★장부와 실제 좌표가 갈렸다').toBe(out.left[1]);
  expect(`${out.키[1].offsetY}px`, '★장부와 실제 좌표가 갈렸다').toBe(out.top[1]);

  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});
