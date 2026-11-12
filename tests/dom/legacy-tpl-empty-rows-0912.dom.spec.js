/* legacy-tpl-empty-rows-0912.dom.spec.js — LEGACY-TPL-REOPEN-LEAVES-EMPTY-ROWS-01 (미카사 t2-06 재채점 곁 · 지디 결정 ㉮+㉯)
 * 옛 공용 템플릿(templates/canvas/tpl_1775031581782 · 프레임 > .row[stack] > (.col > .text-block) + button.row-col-add-btn ×3)을 넣고
 *   다시 열면(rebindAll → save-load.js migrateColsFromDOM) 글은 row 밖 글 프레임으로 꺼내지는데 «죽은» 열 추가 단추가 남아 row 가 안 지워졌다
 *   → 회색 띠+«+» · ⌘[⌘] 가 그 row 를 한 칸으로 세 무변처럼 보임(t2-06 ◑).
 * 고침 ㉮ migrateColsFromDOM — 단추를 걷고 «단추가 있던 row» 가 비면 row 째 지움(이미 망가져 저장된 꼴도 다음 열기에 낫는다)
 *      ㉯ insertTemplate — 넣는 순간 단추를 걷는다(템플릿 원본 파일은 안 고침)
 * 칸
 *   E1 넣은 직후 — 캔버스에 .row-col-add-btn 0 · 글 3                                          (㉯)
 *   E2 넣기 → 저장 왕복 — 프레임 직속 «element 자식 0» row 0 · 단추 0 · 글 3 그대로
 *   E3 넣기 → 프레임 밖 간격 편집 → ⌘Z(rebindAll 길) — E2 와 같은 단언
 *   E4 넣기 → 저장 왕복 → 셋째 글 프레임 골라 ⌘[ 한 번 — 글 순서가 실제로 바뀐다(가 다 나 → 가 나 다 의 둘째·셋째 맞바뀜)
 *   E5 옛 망가진 저장본 꼴(프레임 안 «단추만 남은 row») 픽스처를 저장 왕복으로 열면 그 row 가 사라진다 · 글은 남음      (㉮)
 *      음성: 단추 없는 «의도된» 빈 row 는 남는다 · 단추 + 다른 자식(간격) row 는 단추만 빠지고 남는다
 * 양성대조(지디 인텔): ㉮ 의 `canvasEl.querySelectorAll('.row-col-add-btn').forEach(…)` 를 끄면 E5 빨강(E1~E4 는 ㉯ 덕에 초록) /
 *   ㉯ 의 `_tplStripDeadColAdd(` 를 벗기면(= await _loadCanvas 그대로) E1 빨강(E2~E4 는 ㉮ 덕에 초록) / 둘 다 끄면 E1~E5 빨강.
 * ⚠️E4 의 «고르기»는 손 클릭이 아니라 selected + _activeFrame 을 직접 건다(프레임 갈래 moveSelectedBlocks 가 읽는 두 값).
 */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const TPL_ID = 'tpl_1775031581782';
const TPL_HTML = fs.readFileSync(path.join(__dirname, '../../templates/canvas', TPL_ID + '.html'), 'utf8');
const SEC = '<div class="section-block" id="sE" data-section="1" data-name="옛템플릿"><div class="section-hitzone"></div><div class="section-inner">'
  + '<div class="gap-block" data-type="gap" style="height:40px"></div></div></div>';
const BROKEN = '<div class="section-block" id="sK" data-section="1" data-name="망가진저장본"><div class="section-hitzone"></div><div class="section-inner">'
  + '<div class="row" id="rK" data-layout="stack"><div class="frame-block" id="fK" data-bg="#eeeeee" style="background:#eee;width:780px;margin:0 auto;">'
  + '<div class="frame-block" data-text-frame="true" id="tfK" style="background:transparent;width:100%;"><div class="text-block" data-type="body" id="tbK"><div class="tb-body">망가진 저장본 글</div></div></div>'
  + '<div class="row" id="rKbtn" data-layout="stack" draggable="true"><button class="row-col-add-btn" title="열 추가">+</button></div>'
  + '<div class="row" id="rKmix" data-layout="stack"><div class="gap-block" data-type="gap" id="gKmix" style="height:20px"></div><button class="row-col-add-btn" title="열 추가">+</button></div>'
  + '</div></div>'
  + '<div class="row" id="rKempty" data-layout="stack"></div>'
  + '</div></div>';

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const r = await page.evaluate(async ([html, sec, id]) => {
    const base = window.electronAPI;
    window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'loadTemplateCanvas' ? async (x) => (x === id ? html : null) : base[k]) });
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', sec);
    window.rebindAll?.(); window.applyZoom?.(100);
    const S = document.getElementById('sE'); window.deselectAll?.(); window.selectSection?.(S);
    const before = new Set([...document.querySelectorAll('.frame-block')].map(f => f.id));
    await window.insertTemplate({ id, name: '급하게 제품이 필요하신가요?', type: 'subsection' });
    const F = [...document.querySelectorAll('#sE .frame-block:not([data-text-frame])')].find(f => !before.has(f.id));
    window.deselectAll?.();
    window.clearHistory?.();
    return { F: F ? F.id : null };
  }, [TPL_HTML, SEC, TPL_ID]);
  expect(r.F, '[전제] 템플릿 프레임이 들어갔다').toBeTruthy();
  return { errs, F: r.F };
}

async function reopen(page) {
  const snap = await page.evaluate(() => window.serializeProject());
  const errs = await bootApp(page);
  await page.setViewportSize({ width: 1500, height: 1200 });
  await page.evaluate((d) => { document.getElementById('canvas').innerHTML = ''; window.applyProjectData(JSON.parse(d)); }, snap);
  await page.waitForFunction(() => !!document.querySelector('#canvas .section-block'));
  return { errs, snap };
}

/** 프레임 F 직속: element 자식 0 인 row 수 · 단추 수(캔버스 전체) · 글(순서대로). */
const frameRows = (page, id) => page.evaluate((id) => {
  const f = document.getElementById(id);
  if (!f) return null;
  return {
    emptyRows: [...f.querySelectorAll(':scope > .row')].filter(r => !r.children.length).length,
    btn: document.querySelectorAll('#canvas .row-col-add-btn').length,
    texts: [...f.querySelectorAll('.text-block')].map(tb => (tb.innerText || '').trim().slice(0, 12)),
  };
}, id);

function expectClean(s, label) {
  expect(s, `${label} 프레임이 있다`).toBeTruthy();
  expect(s.emptyRows, `${label} 프레임 직속 빈 row 0`).toBe(0);
  expect(s.btn, `${label} 죽은 단추 0`).toBe(0);
  expect(s.texts.length, `${label} 글 셋 그대로`).toBe(3);
}

test('E1 넣은 직후 — 죽은 «열 추가» 단추 0 · 글 3 (㉯)', async ({ page }) => {
  const { errs, F } = await setup(page);
  const s = await frameRows(page, F);
  console.log('LTE0912 E1 ' + JSON.stringify(s));
  expect(s.btn).toBe(0);
  expect(s.texts.length).toBe(3);
  expect(errs).toEqual([]);
});

test('E2 넣기 → 저장 왕복 — 프레임 직속 빈 row 0 · 단추 0 · 글 3', async ({ page }) => {
  const { F } = await setup(page);
  const { errs } = await reopen(page);
  const s = await frameRows(page, F);
  console.log('LTE0912 E2 ' + JSON.stringify(s));
  expectClean(s, 'E2');
  expect(errs).toEqual([]);
});

test('E3 넣기 → 프레임 밖 간격 편집 → ⌘Z(rebindAll 길) — 빈 row 0 · 단추 0 · 글 3', async ({ page }) => {
  const { errs, F } = await setup(page);
  const gapH = () => page.evaluate(() => document.querySelector('#sE > .section-inner > .gap-block').style.height);
  await page.evaluate(() => {
    window.pushHistory?.();
    document.querySelector('#sE > .section-inner > .gap-block').style.height = '80px';
    window.pushHistory?.('간격 높이');
  });
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(gapH, '[전제] ⌘Z 로 간격 40 으로 되돌아옴').toBe('40px');
  const s = await frameRows(page, F);
  console.log('LTE0912 E3 ' + JSON.stringify(s));
  expectClean(s, 'E3');
  expect(errs).toEqual([]);
});

test('E4 넣기 → 저장 왕복 → 셋째 글 프레임 ⌘[ 한 번 = 실제로 한 칸 위로(t2-06 ◑ 풀림)', async ({ page }) => {
  const { F } = await setup(page);
  const { errs } = await reopen(page);
  const s0 = await frameRows(page, F);
  expectClean(s0, 'E4 전');
  const picked = await page.evaluate((id) => {
    const tfs = [...document.getElementById(id).querySelectorAll(':scope > .frame-block[data-text-frame]')];
    const tf = tfs[2];
    if (!tf) return null;
    window.deselectAll?.();
    tf.classList.add('selected'); window._activeFrame = tf;
    document.activeElement?.blur?.();
    return tfs.length;
  }, F);
  expect(picked, '[전제] 프레임 직속 글 프레임 3').toBe(3);
  await page.keyboard.press('Meta+BracketLeft');
  const want = [s0.texts[0], s0.texts[2], s0.texts[1]];
  await expect.poll(async () => (await frameRows(page, F)).texts, '⌘[ 한 번에 셋째 글이 둘째 자리로').toEqual(want);
  expect(errs).toEqual([]);
});

test('E5 옛 망가진 저장본(단추만 남은 row)을 열면 그 row 가 사라진다 · 음성 — 의도된 빈 row·단추+간격 row 는 남는다 (㉮)', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1200 });
  await bootApp(page);
  const pre = await page.evaluate((sec) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', sec);   // ⛔rebindAll 안 부름 — 망가진 꼴 그대로 저장본에 싣는다
    return { btnRow: !!document.getElementById('rKbtn'), btn: document.querySelectorAll('#canvas .row-col-add-btn').length };
  }, BROKEN);
  expect(pre, '[전제] 망가진 꼴이 캔버스에 있다').toEqual({ btnRow: true, btn: 2 });
  const { errs, snap } = await reopen(page);
  expect(snap.includes('rKbtn'), '[전제] 저장본에 단추만 남은 row 가 실렸다').toBe(true);
  const s = await page.evaluate(() => ({
    btnRow: !!document.getElementById('rKbtn'),
    btn: document.querySelectorAll('#canvas .row-col-add-btn').length,
    text: (document.getElementById('tbK')?.innerText || '').trim(),
    mixRow: !!document.getElementById('rKmix'), mixGap: !!document.querySelector('#rKmix > #gKmix'),
    emptyRow: !!document.getElementById('rKempty'),
  }));
  console.log('LTE0912 E5 ' + JSON.stringify(s));
  expect(s.btnRow, '단추만 남은 row 는 사라진다').toBe(false);
  expect(s.btn, '단추 0').toBe(0);
  expect(s.text, '글은 남는다').toBe('망가진 저장본 글');
  expect(s.mixRow && s.mixGap, '음성 — 단추+간격 row 는 단추만 빠지고 남는다').toBe(true);
  expect(s.emptyRow, '음성 — 단추 없는 의도된 빈 row 는 남는다').toBe(true);
  expect(errs).toEqual([]);
});
