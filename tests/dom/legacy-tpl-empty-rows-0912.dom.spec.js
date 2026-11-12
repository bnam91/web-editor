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
 *   E4 다시 연 판 · 가운데 글 «진짜 더블클릭»(→Esc) → ⌘] 1번 = 같은 프레임 안 순서 바뀜 · 프레임·섹션 차례 무변 · ⌘Z 1번 = 원래
 *   E6 같은 손 ⌘[ 1번 = 위로 · 프레임·섹션 차례 무변
 *   E7 끝 글 ⌘] · 첫 글 ⌘[ = 무변(프레임 밖으로 안 나감 — 템플릿 행 뒤에 간격 gEtail 을 둬 나가면 보이게)
 *   E8 E4 처럼 옮긴 뒤 저장 왕복 — 순서·자리 그대로
 *   E5 옛 망가진 저장본 꼴(프레임 안 «단추만 남은 row») 픽스처를 저장 왕복으로 열면 그 row 가 사라진다 · 글은 남음      (㉮)
 *      음성: 단추 없는 «의도된» 빈 row 는 남는다 · 단추 + 다른 자식(간격) row 는 단추만 빠지고 남는다
 * 양성대조(지디 인텔): ㉮ 의 `canvasEl.querySelectorAll('.row-col-add-btn').forEach(…)` 를 끄면 E5 빨강(E1~E3 은 ㉯ 덕에 초록 · E4·E6~E8 도 43e4941ce 있는 판에서 초록) /
 *   ㉯ 의 `_tplStripDeadColAdd(` 를 벗기면(= await _loadCanvas 그대로) E1 빨강(E2·E3 은 ㉮ 덕에 초록 · E4·E6~E8 도 43e4941ce 있는 판에서 초록) / 둘 다 끄면 E1~E3·E5 빨강(+ 아래 ④).
 * ★E4·E6·E7·E8 은 t2-06 고침 43e4941ce(editor.js moveSelectedBlocks getUnit = closest('.row, .frame-block[data-text-frame]'))이 «같이» 있어야 초록이다
 *   (이 가지 단독 = 빨강 — getUnit 이 템플릿을 감싼 바깥 row 를 집어 프레임째 섹션 안에서 움직인다 · 미카사 t2-06 ❌ 합친 판 e3bac536a 에 43e4941ce 가 없었다).
 *   양성대조 ③: 43e4941ce 의 그 한 줄을 옛 꼴 `(b.closest('.row') || b.closest('.frame-block[data-text-frame]'))` 로 → E4·E6·E7·E8 빨강(프레임째 움직임) · E1~E3·E5 초록.
 *   양성대조 ④: ㉮·㉯ 둘 다 끄면(빈 row 남음) E4·E6 빨강(빈 row 를 한 칸으로 세서 글 순서 무변).
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
    /* 템플릿 행 «뒤»에 간격 하나 — 프레임이 섹션 끝이 아니어야 «⌘] 가 프레임째 아래로 나감»을 잡는다(E7). */
    S.querySelector('.section-inner').insertAdjacentHTML('beforeend', '<div class="gap-block" data-type="gap" id="gEtail" style="height:30px"></div>');
    window.rebindAll?.();
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

/** 섹션 안 차례(직속 자식 id) · 프레임이 부모 안 몇째인가 · 프레임 안 글 순서. */
const layout = (page, F) => page.evaluate((id) => {
  const f = document.getElementById(id), inner = document.querySelector('#sE > .section-inner');
  return { sec: [...inner.children].map(c => c.id || c.className), fIdx: [...f.parentElement.children].indexOf(f), fParent: f.parentElement.id,
    texts: [...f.querySelectorAll('.text-block')].map(tb => (tb.innerText || '').trim().slice(0, 12)) };
}, F);
/** 진짜 손: 프레임 안 i 째 글을 더블클릭(첫 클릭 = 프레임 · 둘째 = 글 · dblclick = 편집 진입) → Esc(편집 끝 · 글 선택 유지 — block-drag.js «Escape → 편집 종료, 블록 선택 상태 유지»).
 *  ⚠️편집 «중»엔 ⌘[⌘] 가 일부러 안 먹는다(editor.js `.text-block.editing` 가드) — 사람도 Esc 뒤에 누른다. */
async function dblPick(page, F, i) {
  const box = await page.evaluate(([id, i]) => {
    const tb = document.getElementById(id).querySelectorAll('.text-block')[i];
    tb.scrollIntoView({ block: 'center' });
    const r = (tb.querySelector('[contenteditable]') || tb).getBoundingClientRect();
    return { x: r.left + Math.min(30, r.width / 2), y: r.top + r.height / 2, id: tb.id };
  }, [F, i]);
  expect(box.id, '[전제] 글 블럭 id').toBeTruthy();
  await page.mouse.dblclick(box.x, box.y);
  if (await page.evaluate(() => !!document.querySelector('.text-block.editing'))) {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.text-block.editing'));
  }
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), box.id), '[전제] 더블클릭으로 그 글이 골라졌다').toBe(true);
  return box.id;
}

test('E4 다시 연 판 · 가운데 글 진짜 더블클릭 → ⌘] 한 번 = 같은 프레임 안 아래로 · 프레임·섹션 차례 무변 · ⌘Z 한 번 = 원래', async ({ page }) => {
  const { F } = await setup(page);
  const { errs } = await reopen(page);
  const L0 = await layout(page, F);
  expect(L0.texts.length, '[전제] 글 셋').toBe(3);
  await dblPick(page, F, 1);
  await page.keyboard.press('Meta+BracketRight');
  await expect.poll(async () => (await layout(page, F)).texts, '가운데 글이 셋째 자리로').toEqual([L0.texts[0], L0.texts[2], L0.texts[1]]);
  const L1 = await layout(page, F);
  expect(L1.sec, '섹션 차례 무변(프레임째 안 움직임)').toEqual(L0.sec);
  expect([L1.fParent, L1.fIdx], '프레임 자리 무변').toEqual([L0.fParent, L0.fIdx]);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await layout(page, F)).texts, '⌘Z 한 번 = 원래 순서').toEqual(L0.texts);
  expect((await layout(page, F)).sec).toEqual(L0.sec);
  expect(errs).toEqual([]);
});

test('E6 다시 연 판 · 가운데 글 더블클릭 → ⌘[ 한 번 = 같은 프레임 안 위로 · 프레임·섹션 차례 무변', async ({ page }) => {
  const { F } = await setup(page);
  const { errs } = await reopen(page);
  const L0 = await layout(page, F);
  await dblPick(page, F, 1);
  await page.keyboard.press('Meta+BracketLeft');
  await expect.poll(async () => (await layout(page, F)).texts, '가운데 글이 첫째 자리로').toEqual([L0.texts[1], L0.texts[0], L0.texts[2]]);
  const L1 = await layout(page, F);
  expect(L1.sec, '섹션 차례 무변').toEqual(L0.sec);
  expect([L1.fParent, L1.fIdx]).toEqual([L0.fParent, L0.fIdx]);
  expect(errs).toEqual([]);
});

test('E7 다시 연 판 · 끝 글 더블클릭 → ⌘] = 무변(프레임 밖으로 안 나감 · 섹션 차례 무변) · 첫 글 ⌘[ 도 무변', async ({ page }) => {
  const { F } = await setup(page);
  const { errs } = await reopen(page);
  const L0 = await layout(page, F);
  expect(L0.sec[L0.sec.length - 1], '[전제] 프레임 행 뒤에 간격이 있다(나가면 보인다)').toBe('gEtail');
  await dblPick(page, F, 2);
  await page.keyboard.press('Meta+BracketRight');
  await page.waitForTimeout(200);   // 무변을 재는 칸 — 바뀔 틈을 준다
  expect(await layout(page, F), '끝 글 ⌘] = 아무것도 안 바뀜').toEqual(L0);
  await dblPick(page, F, 0);
  await page.keyboard.press('Meta+BracketLeft');
  await page.waitForTimeout(200);
  expect(await layout(page, F), '첫 글 ⌘[ = 아무것도 안 바뀜').toEqual(L0);
  expect(errs).toEqual([]);
});

test('E8 E4 처럼 옮긴 뒤 저장 왕복 — 바뀐 글 순서·프레임 자리 그대로', async ({ page }) => {
  const { F } = await setup(page);
  await reopen(page);
  const L0 = await layout(page, F);
  await dblPick(page, F, 1);
  await page.keyboard.press('Meta+BracketRight');
  const want = [L0.texts[0], L0.texts[2], L0.texts[1]];
  await expect.poll(async () => (await layout(page, F)).texts).toEqual(want);
  const L1 = await layout(page, F);
  const { errs } = await reopen(page);
  const L2 = await layout(page, F);
  expect(L2.texts).toEqual(want);
  expect(L2.sec).toEqual(L1.sec);
  expectClean(await frameRows(page, F), 'E8');
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
