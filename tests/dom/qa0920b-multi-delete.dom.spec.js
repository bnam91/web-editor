/* qa0920b-multi-delete.dom.spec.js — 0920b 통합 QA 반영(medium).
 *
 * ★무엇이 깨졌나 — ⌘클릭으로 «텍스트 + 도형» 둘을 고른 뒤 Delete/Backspace 를 누르면
 *   도형만 지워지고 텍스트가 남았다(히스토리 라벨도 「서브섹션 삭제」).
 *   자리: js/editor.js deleteSelectedFromCanvas 의 `selSS`(.frame-block.selected) 갈래.
 *   그 갈래는 「프레임이 골라졌는데 «자식 블록»은 안 골라졌으면 프레임 줄째 지운다」인데,
 *   «자식이 골라졌나» 목록에 `.shape-block.selected` 가 «빠져 있었다». 도형은 자기 래퍼
 *   프레임과 «같이» 선택되므로, 도형을 고르는 순간 이 갈래가 먼저 걸려 그 프레임 줄만
 *   지우고 return — 아래의 «도형+일반블록 혼합 일괄 삭제»에 영영 못 간다.
 *   ★회귀 아님(기준선 dev 도 같다). 다만 사용자는 「두 개 골라 지웠는데 하나가 남았다」로 본다.
 *
 * ⛔앱을 «안» 띄운다 — editor.js 에서 그 함수 «전체»를 떠내 실행한다(선례: grid-block-select-delete).
 * 실행: npm run test:dom -- qa0920b-multi-delete
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const EDITOR_SRC = fs.readFileSync(path.join(REPO, 'js/editor.js'), 'utf8');

/** 함수 «전체»를 중괄호 균형으로 떠낸다(선례: duplicate-zoom · grid-block-select-delete). */
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
const DEL_SRC = extractFn(EDITOR_SRC, 'deleteSelectedFromCanvas');

/* 현빈 재현 구조 — 한 섹션에 ⑴텍스트(자기 프레임 안) ⑵도형(자기 래퍼 프레임 안). 둘 다 selected. */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8"></head><body>
  <div id="canvas">
    <div class="section-block" id="sec1">
      <div class="section-inner" id="inner1">
        <div class="row" id="row1">
          <div class="frame-block" data-text-frame="true" id="tf1">
            <div class="text-block selected" id="tb1">글자</div>
          </div>
        </div>
        <div class="row" id="row2">
          <div class="frame-block selected" data-free-layout="true" id="sf1">
            <div class="shape-block selected" id="shp1" data-shape-type="rectangle"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <script>window.__ready = true;</script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: HARNESS }));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

async function runDelete(page) {
  return page.evaluate((delSrc) => {
    const labels = [];
    const scope = {
      clearAssetImage: () => {},
      deselectAll: () => document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected')),
      multiSel: { cols: new Set(), blocks: new Set(), sections: new Set() },
      clearMultiSel: () => {},
      showMultiSelPanel: () => {},
      canvasEl: document.getElementById('canvas'),
      pushHistory: (a) => labels.push(a),
      insertAfterSelected: () => {},
      _splReleaseSections: () => null,
      ensureHistoryCheckpoint: (a) => labels.push('cp:' + a),
    };
    window.CANVAS_SEL_BLOCKS = '.text-block.selected, .asset-block.selected, .gap-block.selected, .grid-block.selected';
    window.pushHistory = (a) => labels.push(a);
    window.buildLayerPanel = () => {};
    window.ensureHistoryCheckpoint = (a) => labels.push('cp:' + a);
    window.isSectionProtected = () => false;
    const names = Object.keys(scope);
    const fn = new Function(...names, `${delSrc}; return deleteSelectedFromCanvas;`)(...names.map(n => scope[n]));
    const consumed = fn();
    return {
      consumed, labels,
      textAlive: !!document.getElementById('tb1'),
      shapeAlive: !!document.getElementById('shp1'),
    };
  }, DEL_SRC);
}

test('M1 ★텍스트+도형 다중선택 삭제 = «둘 다» 지워진다 (하나만 남지 않는다)', async ({ page }) => {
  const errs = await boot(page);
  const r = await runDelete(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  expect(r.consumed).toBe(true);
  expect(r.shapeAlive, '도형이 안 지워졌다').toBe(false);
  expect(r.textAlive, `★텍스트가 남았다 — 「두 개 골라 지웠는데 하나가 남았다」. labels=${JSON.stringify(r.labels)}`).toBe(false);
});

test('M2 회귀 — 도형 «하나만» 고른 경우도 그대로 지워진다', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => document.getElementById('tb1').classList.remove('selected'));
  const r = await runDelete(page);
  expect(r.consumed).toBe(true);
  expect(r.shapeAlive).toBe(false);
  expect(r.textAlive, '엉뚱한 블록까지 지웠다').toBe(true);
});

test('M3 회귀 — 프레임 «자체»만 고른 경우(자식 미선택)는 여전히 프레임 줄째 지운다', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    document.getElementById('tb1').classList.remove('selected');
    document.getElementById('shp1').classList.remove('selected');   // 프레임만 selected
  });
  const r = await runDelete(page);
  expect(r.consumed).toBe(true);
  expect(r.shapeAlive, '프레임을 골랐는데 줄이 안 지워졌다').toBe(false);
  expect(r.labels).toContain('서브섹션 삭제');
});
