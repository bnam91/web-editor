/* bulk-align-section.dom.spec.js — 섹션 «Bulk Align» 이 글자«만» 움직이는가. (T-095)
 *
 * ★왜 DOM 이어야 하나
 *   이 결함은 dataset 으로는 «안 보인다». 옛 코드는 text-block 에 text-align 을 «정확히»
 *   찍었고, 그래서 모델만 보면 초록이다. 틀린 건 화면 좌표다 — 도형·이미지가 제자리였다.
 *   그 「제자리」는 «계산된 rect»에서만 나온다.
 *
 * ★음성대조 (dev 3f39b71 = 고치기 «전», 실앱 9545 실측)
 *   섹션 오른쪽 정렬 후 — text-align:right ✓ / shape L=152 R=152 «불변» / asset L=112 R=112 «불변»
 *   즉 D2·D3 가 빨강. 고친 뒤 실측 — shape R=29, asset R=29 (=좌우패딩 72px·줌 0.4).
 *
 * ★2026-09-22 2라운드 — 이 검사가 «못 잡은» 것 둘을 같이 막는다.
 *   ⑴ 재는 자리가 «배선»이 아니었다. 예전엔 여기서 collectBulkAlignTargets+alignFlowBlock 을
 *      «손으로» 이어 붙여 불렀다 — 그러면 단추 핸들러(js/props/prop-section.js)가 옛 한 줄로
 *      되돌아가도 이 검사는 초록이다. ⇒ 이제 그 핸들러 «원문»을 떠서 돌린다.
 *   ⑵ 판(fixture)에 «그룹»이 없었다. 그룹(⌘G)은 width:100% 래퍼 + 자유배치 자식이라
 *      옛 규칙으로는 「꽉 참 → 내려감 → 전부 좌표축 → 대상 0개」로 통째로 사라졌다.
 *      실측(2026-09-22, 포트 9634 실앱): 섹션 좌/우/가운데 어느 것을 눌러도 그룹 속 도형이
 *      L=308·R=308 «불변», 글자만 움직였다 = T-095 신고문이 그룹 안에서 그대로 살아 있었다.
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(modal-icon-align.dom.spec.js 와 같은 부팅).
 * ⚠️tests/dom 은 `npm test` 스위트에 «안» 들어간다. 변이 책임은 tests/unit/bulk-align-targets.test.mjs 가 진다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js bulk-align-section
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/** 중괄호 균형으로 «그 자리»의 블록을 떠낸다(선례: multisel-mixed-kind.dom.spec.js). */
function sliceBraces(src, from) {
  let i = src.indexOf('{', from);
  if (i < 0) throw new Error('여는 중괄호를 못 찾았다');
  let b = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') b++;
    else if (src[i] === '}') { b--; if (b === 0) return src.slice(src.indexOf('{', from) + 1, i); }
  }
  throw new Error('닫는 중괄호를 못 찾았다');
}

/* ★섹션 «일괄 정렬» 단추의 클릭 핸들러 «원문». 손으로 베껴 적지 않는다 —
   베끼면 배선(prop-section.js)이 옛 `.text-block` 한 줄로 되돌아가도 이 검사가 초록이다. */
const SECTION_SRC = fs.readFileSync(path.join(REPO, 'js/props/prop-section.js'), 'utf8');
const BULK_AT = SECTION_SRC.indexOf("['left','center','right'].forEach(align =>");
if (BULK_AT < 0) throw new Error('섹션 일괄 정렬 배선을 못 찾았다 — 검사가 대상을 놓쳤다');
const CLICK_MARK = "btn.addEventListener('click', () => {";
const CLICK_AT = SECTION_SRC.indexOf(CLICK_MARK, BULK_AT);
if (CLICK_AT < 0) throw new Error('일괄 정렬 단추의 click 핸들러를 못 찾았다');
const CLICK_BODY = sliceBraces(SECTION_SRC, CLICK_AT + CLICK_MARK.length - 1);
if (!/collectBulkAlignTargets/.test(CLICK_BODY)) {
  throw new Error('떠낸 핸들러가 collectBulkAlignTargets 를 안 부른다 — 배선이 바뀌었다');
}

/* 실앱이 만드는 골격 그대로 — section-inner(패딩 72) > [gap · 글자프레임(100%) · 도형프레임(100px) · row(100%)>이미지(300px)] */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<style>body{margin:0}#canvas{width:860px}.section-inner{padding:0 72px;width:860px;box-sizing:border-box}</style>
</head><body>
<div id="canvas-wrap"><div id="canvas">
  <div class="section-block" id="sec"><div class="section-inner">
    <div class="gap-block" style="height:20px"></div>
    <div class="frame-block" data-text-frame id="tf"><div class="text-block" id="tb"><div class="tb-h2" contenteditable="true">글자</div></div></div>
    <div class="frame-block" id="sf" style="width:100px;min-height:100px;align-self:center"><div class="shape-block" id="sb" style="width:100px;height:100px;background:#888"></div></div>
    <div class="row" data-layout="stack" id="rw"><div class="asset-block" id="ab" style="width:300px;height:80px;align-self:center;background:#ccc"></div></div>
    <!-- 그룹(⌘G) 한 벌 — wrapSelectedBlocksInFrame 의 flow 갈래가 만드는 꼴 그대로:
         width:100% 래퍼 + 자유배치 자식. 폭에 여유가 0 이라 align-self 로는 «절대» 안 움직인다. -->
    <div class="frame-block" data-group="true" id="gf" style="width:100%;height:120px;position:relative;background:transparent;padding:0">
      <div class="frame-block" id="gk1" style="position:absolute;left:300px;top:0px;width:100px;height:60px;background:#5a5"></div>
      <div class="frame-block" id="gk2" style="position:absolute;left:340px;top:60px;width:80px;height:60px;background:#55a"></div>
    </div>
  </div></div>
</div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script type="module">
  import { collectBulkAlignTargets } from '/js/props/bulk-align-targets.js';
  import { alignFlowBlock } from '/js/props/prop-multisel.js';
  /* ★실앱 단추의 «핸들러 원문»을 그대로 돌린다 — 배선까지 같이 재려고. */
  const run = new Function('sec', 'align', 'collectBulkAlignTargets', 'alignFlowBlock', 'propPanel',
    __CLICK_BODY__);
  window.__align = (dir) => run(document.getElementById('sec'), dir,
    collectBulkAlignTargets, alignFlowBlock, document.getElementById('panel-right'));
  window.__ready = true;
</script></body></html>`.replace('__CLICK_BODY__', JSON.stringify(CLICK_BODY));

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
}

/** 섹션 «콘텐츠 상자» 기준 좌·우 여백(px). 여유가 있는 블록만 이 값이 움직인다. */
async function gaps(page, id) {
  return page.evaluate((bid) => {
    const inner = document.querySelector('.section-inner');
    const cs = getComputedStyle(inner);
    const ir = inner.getBoundingClientRect();
    const L = ir.left + parseFloat(cs.paddingLeft), R = ir.right - parseFloat(cs.paddingRight);
    const r = document.getElementById(bid).getBoundingClientRect();
    return { left: Math.round(r.left - L), right: Math.round(R - r.right) };
  }, id);
}

test.describe('T-095 섹션 Bulk Align', () => {
  test('D1 글자는 text-align 으로 움직인다(회귀 방어)', async ({ page }) => {
    await boot(page);
    for (const dir of ['right', 'center', 'left']) {
      await page.evaluate(d => window.__align(d), dir);
      const ta = await page.evaluate(() => getComputedStyle(document.querySelector('#tb [contenteditable]')).textAlign);
      expect(ta, `${dir} 에서 글자 정렬`).toBe(dir);
    }
  });

  test('D2 ★도형이 같이 움직인다 (옛 결함: 제자리)', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.__align('right'));
    const r = await gaps(page, 'sf');
    expect(r.right, '오른쪽 정렬인데 도형이 오른끝에 안 붙었다').toBeLessThanOrEqual(1);
    expect(r.left, '오른쪽 정렬인데 도형 왼쪽 여백이 안 생겼다').toBeGreaterThan(100);

    await page.evaluate(() => window.__align('left'));
    const l = await gaps(page, 'sf');
    expect(l.left, '왼쪽 정렬인데 도형이 왼끝에 안 붙었다').toBeLessThanOrEqual(1);

    await page.evaluate(() => window.__align('center'));
    const c = await gaps(page, 'sf');
    expect(Math.abs(c.left - c.right), '가운데 정렬인데 도형 좌우가 안 맞는다').toBeLessThanOrEqual(1);
  });

  test('D3 ★이미지가 같이 움직인다 — 꽉 찬 row 를 지나 알맹이에 닿는다', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.__align('right'));
    const r = await gaps(page, 'ab');
    expect(r.right, '오른쪽 정렬인데 이미지가 오른끝에 안 붙었다').toBeLessThanOrEqual(1);

    await page.evaluate(() => window.__align('left'));
    const l = await gaps(page, 'ab');
    expect(l.left, '왼쪽 정렬인데 이미지가 왼끝에 안 붙었다').toBeLessThanOrEqual(1);

    await page.evaluate(() => window.__align('center'));
    const c = await gaps(page, 'ab');
    expect(Math.abs(c.left - c.right), '가운데 정렬인데 이미지 좌우가 안 맞는다').toBeLessThanOrEqual(1);
  });

  /* ★[2026-09-22] 그룹 — 「꽉 찬 래퍼는 한 칸 내려간다」의 «막다른 골목».
     내려가 봤자 안은 전부 좌표축(absolute)이라 옛 규칙은 대상 0개를 돌려줬고, 그룹은 통째로
     정렬에서 빠졌다. 옮길 것이 «좌표»일 뿐 없는 게 아니다 — 묶음째 민다. */
  test('D5 ★그룹 속 블록이 같이 움직인다 (옛 결함: 글자만 움직이고 그룹은 제자리)', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.__align('right'));
    const a = await gaps(page, 'gk1'), b = await gaps(page, 'gk2');
    expect(Math.min(a.right, b.right), '오른쪽 정렬인데 그룹이 오른끝에 안 붙었다').toBeLessThanOrEqual(1);
    expect(Math.min(a.left, b.left), '오른쪽 정렬인데 그룹 왼쪽에 여백이 안 생겼다').toBeGreaterThan(100);

    await page.evaluate(() => window.__align('left'));
    const la = await gaps(page, 'gk1'), lb = await gaps(page, 'gk2');
    expect(Math.min(la.left, lb.left), '왼쪽 정렬인데 그룹이 왼끝에 안 붙었다').toBeLessThanOrEqual(1);

    await page.evaluate(() => window.__align('center'));
    const ca = await gaps(page, 'gk1'), cb = await gaps(page, 'gk2');
    const left = Math.min(ca.left, cb.left), right = Math.min(ca.right, cb.right);
    expect(Math.abs(left - right), '가운데 정렬인데 그룹 좌우가 안 맞는다').toBeLessThanOrEqual(1);
  });

  test('D6 ★그룹 «안»의 상대 위치는 안 건드린다 — 묶음째 민다(그게 그룹의 뜻이다)', async ({ page }) => {
    await boot(page);
    const before = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.getElementById('gk2')).left) -
      parseFloat(getComputedStyle(document.getElementById('gk1')).left));
    for (const dir of ['right', 'center', 'left']) {
      await page.evaluate(d => window.__align(d), dir);
      const now = await page.evaluate(() =>
        parseFloat(getComputedStyle(document.getElementById('gk2')).left) -
        parseFloat(getComputedStyle(document.getElementById('gk1')).left));
      expect(now, `${dir} 에서 그룹 «안»의 간격이 바뀌었다`).toBeCloseTo(before, 1);
    }
  });

  test('D7 그룹 래퍼엔 쓸모없는 align-self 를 안 찍는다 (폭에 여유가 0 인 자리)', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.__align('right'));
    expect(await page.evaluate(() => document.getElementById('gf').style.alignSelf),
      '움직이지도 못하는 래퍼에 align-self 가 찍혔다').toBe('');
  });

  test('D4 꽉 찬 래퍼(row)엔 align-self 를 안 찍는다 — 옮길 여지가 없는 자리', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.__align('right'));
    const rowAS = await page.evaluate(() => document.getElementById('rw').style.alignSelf);
    expect(rowAS, 'row 래퍼에 쓸모없는 align-self 가 찍혔다').toBe('');
  });
});
