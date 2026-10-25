/* migrate-stack-col-removed.dom.spec.js
 *   ★★`MIGRATE-STACK-COL-REMOVED-BUT-COL-STILL-MADE-01` (2026-10-25 신설 · 지디)
 *   ★★「★마이그레이션이 ★새 구조를 ★옛 것으로 ★오인한다」 꼴의 ★★세 번째 ★후보를 ★★행위로 ★잰다.
 *
 * ★왜 — ★오늘 ★같은 꼴 ★둘을 ★찾았다(둘은 ★다른 뿌리임을 ★양방향으로 쟀다) :
 *     `FT-TOUCHED-OLD-FILES-NOT-MIGRATED-01`  (★고쳤다 `e73163b6`)
 *     `GRAD-GROUP-LOST-ON-RELOAD-01`          (★고쳤다 `241250d8`)
 *   ⇒ ★★「★세 번째가 ★있을 수 있다」 ⇒ ★마이그레이션 꼴 함수를 ★전수로 훑었다(★5개).
 *
 * ★★후보 (★소스 실측 261025 · ⛔이것만으로 ★닫지 ★않는다)
 *   ★`migrateColsFromDOM`(save-load.js:941)이 ★`.row[data-layout="stack"] > .col` 을 ★지운다
 *     — ★자식을 ★row 직속으로 올리고 ★`col.remove()`.
 *   ★★그런데 ★`block-factory.js:819~825`(`type === 'img1'`)가 ★★**지금도** ★그 구조를 ★만든다 :
 *       row.dataset.layout = 'stack';
 *       col.className = 'col'; col.dataset.width = '100';
 *       row.appendChild(col);
 *   ⇒ ★★그러면 ★로드(=`rebindAll`→`migrateColsFromDOM`)할 때마다 ★그 `.col` 이 ★풀리고
 *     ★`col.dataset.width='100'`·`col.style.flex` 가 ★★사라진다 — ★같은 꼴이다.
 *
 * ★★★⛔단 ★★「★사라지는 것이 ★★손실인가」는 ★별개다 —
 *   ★`.col` 이 ★★의도적으로 ★버려지는 ★옛 껍데기이고 ★자식이 ★보존되면 ★★무해할 수 있다.
 *   ⇒ ★★그래서 ★이 파일은 ★★「★무엇이 ★사라지나」를 ★수로 ★박고,
 *     ★★「손실이다/아니다」는 ★★적지 ★않는다(★그 판정은 ★사람 몫 · ★이름으로 올린다).
 *
 * ★★★실측 결과 (261025 · 3 passed · rc 0) — ★★꼴은 ★같되 ★손실은 ★약하다
 *   M0  `.col` ★1 개 생김 · `dataset.width: '100'` · `style.flex: (없음)` · 자식 1
 *   ★M1 `rebindAll()` 뒤 — `cols: 1 → ★0` · `widths: ['100'] → ★[]`
 *       ★★그런데 ★`assetsInRow: ★1` ⇒ ★★**자식(에셋)은 ★보존된다**
 *   M2  ★음성대조 — 마이그레이션 ★없으면 `cols: 1` ★그대로
 *   ⇒ ★★★판정 : ★사라지는 것은 ★`.col` ★껍데기와 ★`dataset.width='100'` ★뿐이고
 *     ★그 값은 ★★「100%」 = ★★기본값이다 ⇒ ★★★「★조용한 ★데이터 손실」로 ★부를 수 ★없다.
 *     ⇒ ★★`FT-TOUCHED`·`GRAD-GROUP` 과 ★★같은 ★★«꼴»이지만 ★★등급은 ★★다르다.
 *   ⛔내가 ★「손실이다」로 ★적지 ★않는다 — ★「무엇이 사라지나」만 ★수로 박았다.
 *
 * ⛔안 쟀다 (★이름)
 *   · `MIGRATE-STACK-COL-FLEX-PATH-UNMEASURED-01` — `makeCol(flex)` 길(`style.flex` 를 ★쓰는
 *     ★다른 프리셋)은 ★안 쟀다. ★`img1` 은 `flex: (없음)` 이었다.
 *   · `.col` 에 ★사용자가 ★준 ★배경색(`col.style.backgroundColor`)은 ★row 로 ★승계된다고
 *     ★소스가 적는다(save-load.js:963) — ★★그 승계를 ★행위로 ★안 쟀다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js migrate-stack-col-removed
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp, ROOT } = require('./_root-harness.js');

const makeImg1 = async (page) => page.evaluate(async () => {
  const canvas = document.getElementById('canvas');
  canvas.querySelectorAll('.section-block').forEach(s => s.remove());
  await window.addSection();
  const sec = [...canvas.querySelectorAll('.section-block')].pop();
  if (!sec) return { fail: '섹션이 없다' };
  sec.id = 'mscSec';
  window.selectSection(sec);
  if (typeof window.addPresetRow !== 'function') return { fail: 'addPresetRow 없음' };
  window.addPresetRow('img1');
  const row = [...sec.querySelectorAll('.row[data-layout="stack"]')].pop();
  if (!row) return { fail: 'stack row 가 안 생겼다' };
  row.dataset.probe = 'R';
  const cols = [...row.querySelectorAll(':scope > .col')];
  return {
    cols: cols.length,
    widths: cols.map(c => c.dataset.width ?? '(없음)'),
    flexes: cols.map(c => c.style.flex || '(없음)'),
    kids: cols.reduce((n, c) => n + c.children.length, 0),
  };
});

const afterMigrate = async (page) => page.evaluate(() => {
  window.rebindAll?.();
  const sec = document.getElementById('mscSec');
  const row = sec?.querySelector('.row[data-probe="R"]');
  const cols = row ? [...row.querySelectorAll(':scope > .col')] : [];
  return {
    rowKept: !!row,
    cols: cols.length,
    widths: cols.map(c => c.dataset.width ?? '(없음)'),
    /* ★★자식(에셋)이 ★보존되나 — ★그게 ★「무해/손실」을 ★가르는 ★한 칸이다 */
    assetsInRow: row ? row.querySelectorAll('.asset-block').length : -1,
    assetsInCol: cols.reduce((n, c) => n + c.querySelectorAll('.asset-block').length, 0),
  };
});

test('M0 ★전제 — ★앱 길 addPresetRow(img1) 이 ★.row[data-layout=stack] > .col 을 ★★지금도 만든다', async ({ page }) => {
  await bootApp(page);
  const r = await makeImg1(page);
  expect(r.fail, `★전제: ${r.fail}`).toBeUndefined();
  console.log('[M0]', JSON.stringify(r));
  /* ★★이것이 ★★후보의 ★핵 — ⛔0 이면 ★「죽은 이름」이고 ★이 파일은 ★닫힌다 */
  expect(r.cols, '★.col 이 안 생겼다 — 그러면 migrateColsFromDOM 의 그 갈래는 ★죽은 길이다').toBeGreaterThan(0);
  expect(r.kids, '★.col 안에 자식이 없다 — 장면이 비었다').toBeGreaterThan(0);
});

test('M1 ★★★수를 박는다 — ★`rebindAll()` 뒤 ★그 `.col` 이 ★어떻게 되나', async ({ page }) => {
  await bootApp(page);
  const before = await makeImg1(page);
  expect(before.fail).toBeUndefined();
  expect(before.cols, '★전제: .col 이 없다').toBeGreaterThan(0);
  const after = await afterMigrate(page);
  console.log('[M1]', JSON.stringify({ before, after }));
  /* ★★전제 — ★row 는 ★남았나(⛔없으면 ★자가 헛돈다) */
  expect(after.rowKept, '★row 를 못 찾았다 — data-probe 가 저장/복원에 안 실렸나').toBe(true);
  /* ★★★수 — ★`.col` 이 ★사라진다 (★이 칸이 ★빨개지면 = ★그 갈래가 ★꺼졌다) */
  expect(after.cols,
    `★.col 이 ★살았다 — ★migrateColsFromDOM 의 그 갈래가 ★꺼졌나 (${before.cols} → ${after.cols})`
  ).toBe(0);
  /* ★★★그리고 ★★«무엇이 사라졌나» — ★`dataset.width` 가 ★같이 간다 */
  console.log('[M1-lost]', JSON.stringify({ widthsBefore: before.widths, flexesBefore: before.flexes }));
  /* ⛔「손실이다」를 ★여기서 ★적지 ★않는다 — ★자식이 ★보존되는지만 ★수로 남긴다 */
  expect(after.assetsInRow + after.assetsInCol,
    `★★에셋이 ★사라졌다 — ★그러면 ★★손실이다 (row ${after.assetsInRow} · col ${after.assetsInCol})`
  ).toBeGreaterThan(0);
});

test('M2 ★★음성대조 — ★`migrateColsFromDOM` 을 ★안 부르면 ★`.col` 이 ★그대로다', async ({ page }) => {
  await bootApp(page);
  const before = await makeImg1(page);
  expect(before.fail).toBeUndefined();
  /* ★★이 칸이 ★M1 을 ★뜻 있게 만든다 — ⛔없으면 「★무엇이든 ★시간이 지나면 ★사라진다」와 ★구분이 안 된다 */
  const r = await page.evaluate(async () => {
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    const sec = document.getElementById('mscSec');
    const row = sec?.querySelector('.row[data-probe="R"]');
    return { cols: row ? row.querySelectorAll(':scope > .col').length : -1 };
  });
  console.log('[M2]', JSON.stringify(r));
  expect(r.cols,
    '★.col 이 ★마이그레이션 ★없이도 ★사라졌다 — ★M1 의 수가 ★뜻을 잃는다 ('
      + before.cols + ' → ' + r.cols + ')'
  ).toBe(before.cols);
});

test('M3 ★★★`migrateColsFromDOM` 의 ★★«크기»를 수로 박는다 — ★호출 ★29 · 줄 ★151 (★`…SWEEP-01`)', () => {
  /* ★★왜 — ★`MIGRATE-MISREADS-NEW-STRUCTURE-SWEEP-01`(261025) 의 ★★진짜 ★크기를 ★적는다.
     ★이 함수는 ★`rebindAll`(save-load.js:1457 이 아니라 ★그 위 :941 정의) 안에서 ★★로드·⌘Z·
       페이지 전환마다 ★돌고, ★★그 안에서 ★«구조»를 ★여러 번 ★바꾼다.
     ⇒ ★★하나하나가 ★★「★새 구조를 ★옛 것으로 ★오인」할 ★자리다
       (★그 꼴로 ★오늘 ★둘을 고쳤다 — `FT-TOUCHED-OLD-FILES` · `GRAD-GROUP-LOST-ON-RELOAD`).
     ⇒ ★★그래서 ★★«수»를 박아, ★★하나가 ★늘면 ★이 칸이 ★빨개져 ★다음 사람이 ★보게 한다.

     ★★★261025 ★조사로 ★가린 것 ★둘 :
       ⒜ ★★`MIGRATE-STACK-COL-FLEX-PATH-UNMEASURED-01` 은 ★★**존재하지 않는 축**이었다 —
          ★`makeCol(flex)` 를 쓰는 셋(`img2`·`img3`·`text-img`)은 ★★모두 `layout='flex'` 이고,
          ★`stack > .col` 갈래는 ★★`layout="stack"` ★뿐이다. ⇒ ★★그 이름을 ★닫는다.
       ⒝ ★★그런데 ★★«다른 축»이 ★있었다 — ★`flex|grid` row 에 ★`.col` 이 ★★하나면
          ★`.col` 을 지우고 ★★`layout` 을 ★`stack` 으로 ★바꾼다(★`style.flex` 가 ★사라진다)
          = ★★`MIGRATE-FLEX-COL-COLLAPSES-TO-STACK-WHEN-ONE-01` (★★행위로 ★안 쟀다)
       ⒞ ＋ ★`.col` 배경색 → row ★승계가 ★★두 자리에 있다(★stack 갈래 ＋ ★flex 갈래)
          = ★`MIGRATE-COL-BGCOLOR-INHERIT-UNMEASURED-01` (★★행위로 ★안 쟀다) */
  const src = fs.readFileSync(path.join(ROOT, 'js/io/save-load.js'), 'utf8');
  const i = src.indexOf('function migrateColsFromDOM');
  expect(i, '★`migrateColsFromDOM` 이 사라졌다 — 이 칸의 대상이 없다').toBeGreaterThan(0);
  const j = src.indexOf('\nfunction ', i + 10);
  const body = src.slice(i, j);
  /* ★★★261025 ★자가정정 — ★내가 ★「구조 변경 ★8」이라 ★적었는데 ★★실측은 ★★29 였다.
       ★까닭 : ★내 ★앞 조사는 ★regex 에 ★`^\s*`(★줄 ★머리)를 걸어 ★★줄 머리의 ★호출만 ★셌고,
         ★아래 자는 ★★줄 ★어디든 ★잡는다. ⇒ ★★내 ★산문이 ★측정값을 ★이기려 했다.
     ⇒ ★★그래서 ★이 칸의 ★뜻을 ★★«정확히» 적는다 :
       ★이것은 ★★「★구조를 ★바꾸는 자리 수」가 ★★아니다. ★★「★`canvasEl.querySelectorAll(…)` ＋
         `window.*?.(…)` ★호출 수」다 — ★★그 중 ★몇이 ★«구조»를 ★바꾸고 ★몇이 ★읽기만 하는지는
         ★★**안 쟀다** = `MIGRATE-WHICH-CALLS-MUTATE-UNMEASURED-01`.
     ⇒ ★★그래도 ★★쓸모가 있다 : ★★이 수가 ★움직이면 ★그 함수가 ★★자랐거나 ★줄었다는 ★신호다
       (★★로드마다 ★도는 함수가 ★자라는 것이 ★★이 꼴의 ★병이 ★나는 ★자리였다). */
  const touches = [...body.matchAll(/(?:canvasEl\.querySelectorAll|window\.\w+\?\.)\(([^)]*)\)/g)]
    .map(m => m[0].slice(0, 90));
  console.log('[M3]', JSON.stringify({ lines: body.split('\n').length, n: touches.length, touches }, null, 1));
  /* ★★전제 — ★0 이면 ★자가 헛돌았다 */
  expect(touches.length, '★건드리는 자리를 하나도 못 읽었다 — 자가 헛돈다').toBeGreaterThan(3);
  /* ★★★수 — ★★여덟. ★이 칸이 ★빨개지면 = ★하나가 ★늘거나 ★줄었다
     ⇒ ★★늘었으면 ★★「★그것도 ★새 구조를 ★오인하나」를 ★★재고 ★이 수를 ★고쳐라.
     ⇒ ★줄었으면 ★어느 갈래가 ★죽었나 보라(★죽은 갈래는 ★무해하지만 ★주석이 ★거짓이 된다). */
  expect(touches.length,
    `★호출 수가 ★29 가 아니다 (${touches.length}) — ★늘었으면 ★★「그것도 ★새 구조를 ★오인하나」를 재고 ★이 수를 고쳐라` +
    `\n  ★줄 수 ${body.split('\n').length} (★261025 실측 151)\n  ` + touches.slice(0, 12).join('\n  ')
  ).toBe(29);
  /* ★★줄 수도 ★같이 — ★호출 수는 ★같은데 ★몸통만 자라는 꼴을 ★잡는다 */
  expect(body.split('\n').length,
    `★줄 수가 ★151 이 아니다 (${body.split('\n').length}) — ★그 함수가 ★자랐다(또는 줄었다)`
  ).toBe(151);
  /* ★★그리고 ★★«오늘 고친 둘»이 ★이 함수 ★안에 있나 — ★★한 자리에 ★모여 있음을 ★못박는다 */
  expect(/migrateLegacyGradientBlocks/.test(src),
    '★`migrateLegacyGradientBlocks` 호출이 사라졌다 — GRAD-GROUP 고침의 자리가 바뀌었나').toBe(true);
});
