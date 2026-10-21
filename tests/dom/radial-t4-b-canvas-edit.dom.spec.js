/* radial-t4-b-canvas-edit — S6 t4 ⒝ (t4-03 · t4-04b · t4-05) · 2026-10-21
 *
 * 현빈 원문(T4-ORIGINAL.txt):
 *   t4-03 「Data로 디폴트로 들어가있는거 플레이스 홀더로, 내용을 입력하세요로 해줘 텍스트블럭처럼 캔버스에서 더블클릭하면 바로 수정되게끔 해주고
 *          우측 프로퍼티에서는 데이터 절은 필요없지 않니?」
 *   t4-04 뒤 절반(t4-04b) 「우측 프로퍼티패널에서는 플레이스홀더가 굳이 없어도 되지않을까? … 캔버스상에서 선택해서 바로 삭제도 가능하게 해줘.
 *          그러면 자동으로 없음으로 처리 … 내가 가운데>텍스트나 이미지를 선택하면 다시 그자리에 살아나는거지.」
 *   t4-05 「center > 가운데(이미지) 선택시에 샘플이미지가 뜨는데 샘플그림 안뜨게 해줘. 그냥 캔버스에서 채크패턴으로 떠두면 내가 넣으면 되잖아.」
 * 근거 계획: reports/S6-T4-RADIAL/plan-b.md §1 (칸 · 핀 예측) · §2 (장면 단언).
 *
 * 장면 단언(태양 ③): 칸마다 «장면» 과 «단언» 을 가른다.
 *   scene(name, fn)      = test.step('장면 — '+name) — 여기서 깨지면 실패 글이 «장면 미성립:» 으로 시작한다(진짜 단언까지 못 간 것).
 *   assertStep(name, fn) = test.step('단언 — '+name) — 진짜 빨강은 여기서 난다.
 *   ⛔장면 칸은 진짜 단언을 품지 않는다(예: C1b 의 «블럭 수 그대로» 는 단언 · C2 의 «⌫ 뒤 블럭 있음» 은 장면 — C2 가 재는 것은 ⌘Z).
 * 블럭은 «실제 문»으로 만든다 — 떠 있는 툴바 Component ▾ → 「Radial」(⒜ spec 의 makeRadial 꼴).
 * 좌표는 waitStableRect 로 멈춘 뒤 «두 번» 재서 같을 때만 누른다 · 누르기 직전 elementFromPoint 를 찍는다(clickAt).
 * ⛔고정 대기 없음(waitForTimeout 0 — _history-step 헬퍼 안의 settle 은 헬퍼 몫).
 *
 * 칸(P0 + 24 · plan-b §1 의 칸을 전부 옮겼다 — plan-b 「칸 = P0 + 22」 는 그 표의 칸 수(15+5+4=24)와 안 맞는다 · 보고에 적음):
 *   P0  판 정체 — EXPECT_SHA = git HEAD · EXPECT_FILES_SHA1 열쇠 = ID_APP ∪ ID_DISK · 앱 파일은 페이지가 받은 바이트 = 디스크 = env · 디스크만 파일은 디스크 = env
 *   t4-03: B1 B2 B3 B4 B4b B5 B6 B7 B9
 *   t4-04b: C0 B8 C1a C1b C2 C3 C3g C4 C5 C6
 *   t4-05: D1 D2 D3 D4
 *   QA⑴: H0
 *   ⒝-2(eval-b 고침 · 2026-10-22): E2a E2b(첫 클릭 = 블럭 · 다음 클릭 = 가운데) · E15(낡은 가운데 표식) · E10(편집 중 끌기) · E5(⌘D 고리) · M19 사각(편집 중 host 안 끌기) · O1 사각(⌫ «없음» 뒤 옛 글 되살림)
 *   ⒝-3(eval-b2 고침 · 2026-10-22): R1a R1b(레이어 패널로 고른 뒤 캔버스 «첫» 클릭 = 블럭 · 다음 = 가운데) · R2(다중 선택에선 가운데로 안 내려감) · E10-G1(겹① — 편집 중 host 밖 누름) · Z-E10c(겹② — zz-eval-b2-risk 에서 옮김)
 *   ⒝-4(옮김 · 2026-10-22): X-A-layer X-A-canvas X-B-layer X-B-canvas X-M1 X-M2 Y-R1c Y-R1d(추적 밖 zz-eval-b3-mixed 에서 · 이름 그대로) ＋ 음성대조 짝 Y-R1c-neg Y-R1d-neg(새)
 * 재는 축: radial 의 «첫 클릭 = 블럭 · 다음 = 가운데» 가 기대는 그리드 T-058 걸쇠(prop-grid.js:132 _grdDrillLatch · 온 앱에 한 벌)를 radial 과 그리드가 나눠 쓸 때 서로 안 밟는가 — 그래서 ⒝-4 칸에 그리드 블럭이 나온다(걸쇠를 나눠 쓰는 이웃).
 * 안 재는 축: 그리드 자체의 드릴 · 줄 편집 규칙은 이 파일이 재는 축이 아니다(정본 = grid-first-click-block.dom.spec.js T-058-*) — 그리드 단언은 «걸쇠가 radial 을 거친 뒤에도 그리드 첫 클릭 = 블럭» 만 본다.
 *   ⒝-3 장면 바꿈: 가운데 «한 번» 클릭으로 가운데를 고르던 칸(C1a C1b C2 C3 C4 C5⒝⒞ E15 E5)은 «넣은 직후 = 이미 고른 블럭» 에서 눌렀다.
 *     R1 고침 뒤 삽입 직후 고름은 캔버스 클릭이 아니라 걸쇠가 없다(그리드 정본 block-drag.js:76-78 «삽입 직후 … «첫» 클릭은 사용자에겐 첫 클릭이라 블럭 선택») ⇒
 *     그 칸들은 장면에 «㉠ 캔버스 첫 클릭(latchByCanvas)» 한 번을 앞에 더했다. 단언은 안 바꿨다. */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { ROOT, bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');
const { expectOneUndoStep } = require('./_history-step.js');

/* 정체 파일 — ⒝ 가 건드리는 파일 전부(spec 자신 제외). 앱 = 페이지 fetch = 디스크 = env · 디스크만 = env(하네스가 tests/ 를 내주는지는 이 판정에 안 쓴다). */
const ID_APP = ['css/editor-radial.css', 'js/blocks/radial-block.js', 'js/props/prop-radial.js'];
const ID_DISK = ['tests/dom/radial-arc-contain.dom.spec.js', 'tests/unit/radial-menu-proto-gone.test.mjs'];   /* 유닛 T4 ⑷′·⑷″ — 지디 판정(2026-10-21)으로 이 덩이가 건드림 */
const PH = '내용을 입력하세요';
const OLD_DATA_HINT = '캔버스의 칸(또는 왼쪽 동그라미)';
/* H0 — 핀(04ce0b74) prop-radial.js 의 힌트 글 명부(이 세 상태에서 설 수 있는 것 · 태그 뺀 글 · 공백 하나로) − Data 힌트. 「항목 n」 은 'N' 으로 접는다. */
const PIN_HINTS = [
  '지금은 배경이 투명입니다 — 색을 고르면 블럭 배경이 칠해집니다.',
  '샘플 그림 고르기',
  '항목 N — 캔버스에서 끌면 호(원)를 따라 움직입니다. 라벨만 옮기려면 Alt+끌기 또는 라벨 옆 파란 손잡이를 끄세요.',
  '줄바꿈 그대로 여러 줄이 됩니다. **굵게** 처럼 별표 둘로 감싸면 그 부분만 굵어집니다.',
  '칸 그림 — 샘플 고르기',
  'SVG 는 소독해서 넣습니다(스크립트 · 이벤트 속성 · 외부 주소는 걸러집니다). currentColor 를 쓰면 라벨 색을 따릅니다.',
];
/* 핀에서 상태마다 선 힌트 수(Data 힌트 포함) — 기본 원 2 · 항목 고름 6 · 항목 고름 + 가운데 이미지 7. */
const PIN_HINT_COUNTS = { base: 2, item: 6, itemImage: 7 };
const sha1 = (buf) => crypto.createHash('sha1').update(buf).digest('hex');

/* ── 장면 / 단언 도우미 ── */
const SCENE_PREFIX = '장면 미성립: ';
async function scene(name, fn) {
  return test.step('장면 — ' + name, async () => {
    try { return await fn(); } catch (e) {
      const msg = String((e && e.message) || e);
      throw new Error(msg.startsWith(SCENE_PREFIX) ? msg : `${SCENE_PREFIX}[${name}] ${msg}`);
    }
  });
}
async function assertStep(name, fn) { return test.step('단언 — ' + name, fn); }

/** 멈춘 사각형을 두 번 재서 같은지 본다 — 다르면 빨강(옛 좌표로 누르지 않는다). */
async function stableTwice(page, sel, opts = {}) {
  const a = await waitStableRect(page, sel, opts);
  const b = await waitStableRect(page, sel, opts);
  expect([b.left, b.top, b.width, b.height], `${sel}[${opts.index || 0}] 두 번 잰 사각형이 같다`).toEqual([a.left, a.top, a.width, a.height]);
  expect(a.width > 0 && a.height > 0, `${sel} 크기가 있다`).toBe(true);
  return b;
}

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  const secId = await page.evaluate(async () => {
    await document.fonts?.ready;
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection?.();
    const sec = c.querySelector('.section-block');
    window.deselectAll?.();
    window.selectSection?.(sec);
    window.clearHistory?.();
    return sec?.id || null;
  });
  expect(secId, '섹션이 하나 있다').toBeTruthy();
  return { errs, secId };
}

const radialCount = (page) => page.evaluate(() => document.querySelectorAll('#canvas .radial-block').length);

/** Component ▾ → 「Radial」 을 진짜로 눌러 원 블럭 하나를 더 만든다(고른 섹션에). 만든 뒤 블럭 수 = want. */
async function insertViaMenu(page, secId, want) {
  const before = await page.evaluate(() => [...document.querySelectorAll('#canvas .radial-block')].map((b) => b.id));
  const trig = '#fp-component-dropdown .fp-dropdown-trigger';
  const t = await stableTwice(page, trig);
  await clickAt(page, t.cx, t.cy, { sel: trig }, { label: 'Component 펼치기' });
  await expect(page.locator('#fp-component-dropdown')).toHaveClass(/open/);
  const idx = await page.evaluate(() => [...document.querySelectorAll('#fp-component-menu .fp-menu-item')].findIndex((b) => b.textContent.trim() === 'Radial'));
  expect(idx, '삽입 메뉴에 「Radial」 이 있다').toBeGreaterThanOrEqual(0);
  const r = await stableTwice(page, '#fp-component-menu .fp-menu-item', { index: idx });
  const hit = await page.evaluate(([x, y]) => (document.elementFromPoint(x, y)?.textContent || '').trim(), [r.cx, r.cy]);
  expect(hit, '누를 자리 = 「Radial」').toBe('Radial');
  await clickAt(page, r.cx, r.cy, { sel: '#fp-component-menu .fp-menu-item' }, { label: 'Radial 누르기' });
  await expect.poll(() => radialCount(page), { message: `방사형 블럭 ${want}개` }).toBe(want);
  const id = await page.evaluate((old) => [...document.querySelectorAll('#canvas .radial-block')].map((b) => b.id).find((x) => !old.includes(x)), before);
  expect(id, '새 블럭 id').toBeTruthy();
  await page.waitForFunction((bid) => !!document.querySelector(`[id="${bid}"] > .rdl-stage`), id, { timeout: 15000 });
  await stableTwice(page, `[id="${id}"]`);
  const st = await page.evaluate((bid) => { const b = document.getElementById(bid); return { shape: b.dataset.shape, sec: b.closest('.section-block')?.id || null, sel: b.classList.contains('selected') }; }, id);
  expect(st, '고른 섹션에 원 블럭 · 선택됨').toEqual({ shape: 'circle', sec: secId, sel: true });
  await expect.poll(() => page.evaluate(() => document.querySelector('#panel-right .prop-block-id')?.dataset.copyId || null), { message: '패널이 이 블럭으로 열렸다' }).toBe(id);
  return id;
}

/** 새 원 블럭 하나 — 장면. */
async function makeRadial(page) {
  return scene('새 원 블럭(Component ▾ → Radial)', async () => {
    const { errs, secId } = await setup(page);
    const id = await insertViaMenu(page, secId, 1);
    return { errs, secId, id };
  });
}

/** 블럭 상태 한 벌(없으면 exists:false). */
function stateOf(page, id) {
  return page.evaluate((bid) => {
    const b = document.getElementById(bid);
    const n = document.querySelectorAll('#canvas .radial-block').length;
    if (!b) return { exists: false, n };
    let items = null;
    try { items = JSON.parse(b.dataset.items || '[]'); } catch (_) { items = null; }
    const c = b.querySelector('.rdl-center');
    return {
      exists: true, n, selected: b.classList.contains('selected'), shape: b.dataset.shape, count: b.dataset.count,
      centerMode: b.dataset.centerMode, centerText: b.dataset.centerText, centerImg: b.dataset.centerImg, centerBg: b.dataset.centerBg, centerColor: b.dataset.centerColor,
      labelPos: b.dataset.labelPos, items, rdlSel: b._rdlSel,
      centers: b.querySelectorAll('.rdl-center').length, centerCls: c ? c.className : null,
      editable: b.querySelectorAll('[contenteditable="true"]').length + (b.isContentEditable ? 1 : 0),
      inFrame: !!b.closest('.frame-block'), sec: b.closest('.section-block')?.id || null,
    };
  }, id);
}

/** 라벨 글 칸(idx) — 첫 줄 상자의 가운데(줄이 둘이면 줄 사이를 피한다). 장면: 멈춤 두 번 · elementFromPoint 가 그 span 안. */
async function labelPoint(page, id, idx) {
  const sel = `[id="${id}"] .rdl-item[data-rdl-idx="${idx}"] .rdl-label-text`;
  await stableTwice(page, sel);
  const p = await page.evaluate((s) => {
    const el = document.querySelector(s);
    const r = el.getClientRects()[0] || el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { x, y, inside: !!(hit && el.contains(hit)), hit: hit ? (hit.className || hit.tagName) : null };
  }, sel);
  expect(p.inside, `누를 자리(${Math.round(p.x)},${Math.round(p.y)})가 항목 ${idx} 라벨 글 안 — 맞힌 것 «${p.hit}»`).toBe(true);
  return p;
}
/** 가운데 — 멈춤 두 번 · 가운데 점이 .rdl-center 안. */
async function centerPoint(page, id) {
  const sel = `[id="${id}"] .rdl-center`;
  const r = await stableTwice(page, sel);
  const ok = await page.evaluate(([s, x, y]) => { const el = document.querySelector(s); const h = document.elementFromPoint(x, y); return !!(h && el.contains(h)); }, [sel, r.cx, r.cy]);
  expect(ok, '누를 자리 = 가운데 안').toBe(true);
  return { x: r.cx, y: r.cy, sel };
}
/** ⒝-3 ㉠ 캔버스 첫 클릭 — 가운데를 한 번 눌러 블럭을 «캔버스로» 고른다(그리드 T-058 걸쇠가 이 블럭에 걸린다). 장면: 고름 · 가운데 고리 0.
 *   R1 고침 뒤 «가운데 고르기»는 이 다음 클릭부터다(삽입 직후 · 레이어 패널 고름은 걸쇠 없음). */
async function latchByCanvas(page, id) {
  return scene('㉠ 캔버스 첫 클릭(가운데) = 블럭 고름 · 걸쇠', async () => {
    const p = await centerPoint(page, id);
    await clickAt(page, p.x, p.y, { sel: p.sel }, { label: '㉠ 가운데 첫 클릭' });
    await expect.poll(async () => (await stateOf(page, id)).selected, { message: '㉠ 뒤 .selected' }).toBe(true);
    const ring = await page.evaluate((bid) => document.getElementById(bid).querySelectorAll('.rdl-center-cell-selected').length, id);
    expect(ring, '㉠ 뒤 가운데 고리 0').toBe(0);
    return p;
  });
}
/** 편집 전 장면 공통: 블럭 안 contenteditable=true 0 · 프레임 조상 0. */
async function preEditScene(page, id) {
  const s = await stateOf(page, id);
  expect(s.exists, '블럭 있음').toBe(true);
  expect(s.editable, '편집 전 블럭 안 contenteditable=true 0').toBe(0);
  expect(s.inFrame, '프레임 조상 0(프레임 진입 dblclick 배제)').toBe(false);
  return s;
}
/** 지금 블럭 안에서 편집 중인 host 한 벌. */
function editHost(page, id) {
  return page.evaluate((bid) => {
    const b = document.getElementById(bid);
    const hs = b ? [...b.querySelectorAll('[contenteditable="true"]')] : [];
    const h = hs[0] || null;
    return { n: hs.length, cls: h ? (h.className || h.tagName) : null, inCenter: !!(h && h.closest('.rdl-center')), label: h ? (h.closest('[data-rdl-idx]')?.dataset.rdlIdx ?? null) : null,
      text: h ? h.innerText : null, sel: String(window.getSelection() || ''), active: document.activeElement === h || !!(h && h.contains(document.activeElement)) };
  }, id);
}
async function clickPanel(page, sel, label) {
  const r = await stableTwice(page, sel);
  await clickAt(page, r.cx, r.cy, { sel }, { label });
}
/** 가운데 상자(스테이지 기준 레이아웃 px). */
function centerBox(page, id) {
  return page.evaluate((bid) => {
    const b = document.getElementById(bid);
    const st = b && b.querySelector(':scope > .rdl-stage');
    const c = b && b.querySelector('.rdl-center');
    if (!st || !c) return null;
    const S = st.getBoundingClientRect(), C = c.getBoundingClientRect(), k = S.width / (st.offsetWidth || 1);
    return { cx: (C.left + C.width / 2 - S.left) / k, cy: (C.top + C.height / 2 - S.top) / k, w: C.width / k, h: C.height / k };
  }, id);
}
/** 가운데 고르기(실제 클릭) 뒤 ⌫ 로 «없음» 만들기 — 장면(C2 · C3 · C4 · C1b 와 같은 길). */
async function canvasCenterNone(page, id) {
  await latchByCanvas(page, id);
  const p = await centerPoint(page, id);
  await clickAt(page, p.x, p.y, { sel: p.sel }, { label: '가운데 클릭' });
  const s0 = await stateOf(page, id);
  expect(s0.selected, '가운데 클릭 뒤 블럭 .selected').toBe(true);
  expect(await page.evaluate(() => !!document.activeElement?.isContentEditable), 'activeElement 가 contenteditable 아님').toBe(false);
  await page.keyboard.press('Backspace');
  await expect.poll(async () => { const s = await stateOf(page, id); return s.exists ? s.centerMode : '블럭 없음'; }, { message: '⌫ 뒤 블럭 있음 · centerMode none' }).toBe('none');
}

test.describe('S6 t4 ⒝ radial 캔버스 편집 · 가운데 지우기 · 체크 무늬', () => {
  test('P0 판 정체 — HEAD = EXPECT_SHA · 앱 파일: 페이지가 받은 바이트 = 디스크 = env · 디스크만 파일: 디스크 = env', async ({ page }) => {
    const want = process.env.EXPECT_SHA || '';
    expect(/^[0-9a-f]{40}$/.test(want), `EXPECT_SHA 는 40 hex — 받은 값 «${want}»`).toBe(true);
    let wantMap = null;
    try { wantMap = JSON.parse(process.env.EXPECT_FILES_SHA1 || ''); } catch (_) { wantMap = null; }
    expect(wantMap && typeof wantMap === 'object', `EXPECT_FILES_SHA1 은 JSON 객체 — 받은 값 «${process.env.EXPECT_FILES_SHA1 || ''}»`).toBe(true);
    expect(Object.keys(wantMap).sort(), 'EXPECT_FILES_SHA1 열쇠 = 건드린 파일 목록(앱 ∪ 디스크만) 그대로').toEqual([...ID_APP, ...ID_DISK].sort());
    for (const rel of [...ID_APP, ...ID_DISK]) expect(/^[0-9a-f]{40}$/.test(String(wantMap[rel])), `EXPECT_FILES_SHA1[${rel}] 은 40 hex — 받은 값 «${wantMap[rel]}»`).toBe(true);
    const head = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    expect(head, `git -C ${ROOT} rev-parse HEAD`).toBe(want);
    const errs = await bootApp(page);
    for (const rel of ID_APP) {
      const d = sha1(fs.readFileSync(path.join(ROOT, rel)));
      const got = await page.evaluate(async (r) => {
        const res = await fetch('/' + r, { cache: 'no-store' });
        if (!res.ok) return null;
        const u8 = new Uint8Array(await res.arrayBuffer());
        let s = '';
        for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        return btoa(s);
      }, rel);
      expect(got, `페이지가 ${rel} 를 받았다`).toBeTruthy();
      const sv = sha1(Buffer.from(got, 'base64'));
      expect(sv, `${rel}: 페이지가 받은 바이트 = 디스크`).toBe(d);
      expect(sv, `${rel}: 페이지가 받은 바이트 = EXPECT_FILES_SHA1`).toBe(wantMap[rel]);
    }
    for (const rel of ID_DISK) {
      expect(sha1(fs.readFileSync(path.join(ROOT, rel))), `${rel}: 디스크 = EXPECT_FILES_SHA1`).toBe(wantMap[rel]);
    }
    expect(errs, 'pageerror').toEqual([]);
  });

  /* ───────── t4-03 ───────── */

  test('B1 새 원 블럭 항목 글 = 안내문구 (저장 \'\' · 표식 · 흐림 0.45 · 옛 글 0)', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    await scene('원 · 항목 6 그려짐 · 라벨 아래', async () => {
      const s = await stateOf(page, id);
      expect([s.shape, s.labelPos], '원 · labelPos below').toEqual(['circle', 'below']);
      expect(await page.evaluate((bid) => document.querySelectorAll(`[id="${bid}"] .rdl-item .rdl-label-text`).length, id), '라벨 글 칸 6').toBe(6);
    });
    await assertStep('items 전부 \'\' · 라벨 6개가 안내문구로 그려진다', async () => {
      const m = await page.evaluate((bid) => {
        const b = document.getElementById(bid);
        const phs = [...b.querySelectorAll('.rdl-label-text[data-is-placeholder="true"]')];
        return { labels: JSON.parse(b.dataset.items).map((it) => it.label), n: phs.length, texts: [...new Set(phs.map((e) => e.textContent))],
          dph: [...new Set(phs.map((e) => e.dataset.placeholder))], op: [...new Set(phs.map((e) => getComputedStyle(e).opacity))], old: (b.textContent.match(/피부 장벽/g) || []).length };
      }, id);
      expect(m.labels, 'items 6개 label 전부 \'\'').toEqual(['', '', '', '', '', '']);
      expect(m.n, '.rdl-label-text[data-is-placeholder="true"] 6개').toBe(6);
      expect(m.texts, '안내문구 글').toEqual([PH]);
      expect(m.dph, 'data-placeholder').toEqual([PH]);
      expect(m.op, '흐림(인용구 블럭과 같은 #canvas [data-is-placeholder])').toEqual(['0.45']);
      expect(m.old, '«피부 장벽» 0').toBe(0);
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  test('B2 항목 + → 새 칸도 안내문구 (\'항목 n\' 아님)', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    await scene('#rdl-count-plus 있음 · 켜짐', async () => {
      expect(await page.evaluate(() => { const b = document.getElementById('rdl-count-plus'); return b ? !b.disabled : null; }), '#rdl-count-plus').toBe(true);
    });
    await clickPanel(page, '#rdl-count-plus', '항목 수 +');
    await assertStep('count 7 · items[6] \'\' · 안내문구 7', async () => {
      await expect.poll(async () => (await stateOf(page, id)).count, { message: 'count 7' }).toBe('7');
      const s = await stateOf(page, id);
      expect(s.items[6] && s.items[6].label, 'items[6].label').toBe('');
      expect(await page.evaluate((bid) => document.querySelectorAll(`[id="${bid}"] .rdl-label-text[data-is-placeholder="true"]`).length, id), '안내문구 7').toBe(7);
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  test('B3 패널에 Data 절이 없다 · 전체 되돌리기는 Shape 절로', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    await scene('패널 머리 id = 블럭 · #rdl-shape-group 있음', async () => {
      expect(await page.evaluate(() => document.querySelector('#panel-right .prop-block-id')?.dataset.copyId), '패널 머리 id').toBe(id);
      await expect(page.locator('#rdl-shape-group')).toHaveCount(1);
    });
    await assertStep('Data 0 · 목록 0 · 추가 단추 0 · reset-all 1개가 Shape 절 안 · Data 힌트 0', async () => {
      const m = await page.evaluate((hint) => {
        const P = document.querySelector('#panel-right .panel-body');
        const ra = [...P.querySelectorAll('#rdl-reset-all')];
        return { titles: [...P.querySelectorAll('.prop-section-title')].map((t) => t.textContent.trim()),
          list: P.querySelectorAll('#rdl-data-list').length, add: P.querySelectorAll('#rdl-add-item').length, ra: ra.length,
          raSec: ra[0]?.closest('.prop-section')?.querySelector('.prop-section-title')?.textContent.trim() || null,
          hint: (P.textContent.match(new RegExp(hint.replace(/[()]/g, '\\$&'), 'g')) || []).length };
      }, OLD_DATA_HINT);
      expect(m.titles.filter((t) => t === 'Data'), '「Data」 절 제목 0').toEqual([]);
      expect([m.list, m.add], '#rdl-data-list 0 · #rdl-add-item 0').toEqual([0, 0]);
      expect(m.ra, '#rdl-reset-all 정확히 1').toBe(1);
      expect(m.raSec, '#rdl-reset-all 이 「Shape」 절 안').toBe('Shape');
      expect(m.hint, 'Data 힌트 0').toBe(0);
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  /** B4 · B4b 몸 — 라벨 dblclick → 바로 입력 → Escape. */
  async function labelEditBody(page, id, idx, text) {
    const p = await scene(`항목 ${idx} 라벨 누를 자리 · 편집 전`, async () => { await preEditScene(page, id); return labelPoint(page, id, idx); });
    await page.mouse.dblclick(p.x, p.y);
    await assertStep('dblclick → 그 라벨이 편집으로 열리고 안내문구가 통째로 골라졌다', async () => {
      const h = await editHost(page, id);
      expect([h.n, h.label], `편집 host 1개 = 항목 ${idx} 라벨`).toEqual([1, String(idx)]);
      expect(h.cls, 'host = .rdl-label-text').toContain('rdl-label-text');
      expect(h.sel, '고른 글 = 안내문구 전체').toBe(PH);
    });
    await page.keyboard.type(text);
    await page.keyboard.press('Escape');
    await assertStep(`입력 «${text}» → Escape → 저장 · 그려짐 · 표식 0 · 편집 닫힘 · 블럭 그대로`, async () => {
      await expect.poll(async () => { const s = await stateOf(page, id); return s.exists ? s.items[idx]?.label : '블럭 없음'; }, { message: `items[${idx}].label` }).toBe(text);
      const m = await page.evaluate(([bid, i]) => { const el = document.querySelector(`[id="${bid}"] .rdl-item[data-rdl-idx="${i}"] .rdl-label-text`); return { text: el?.textContent ?? null, ph: el ? el.hasAttribute('data-is-placeholder') : null }; }, [id, idx]);
      expect(m, '그 라벨 글 · 표식 없음').toEqual({ text, ph: false });
      const s = await stateOf(page, id);
      expect([s.editable, s.n], '블럭 안 contenteditable=true 0 · 블럭 수 1').toEqual([0, 1]);
    });
  }

  test('B4 라벨 더블클릭 → 바로 입력 (원)', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    await labelEditBody(page, id, 1, '가나다');
    expect(errs, 'pageerror').toEqual([]);
  });

  test('B4b 라벨 더블클릭 → 바로 입력 (호 · 옆 라벨 · 넘침 0)', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    await scene('패널 「호」 → .rdl-stage--arc · 옆 라벨', async () => {
      await clickPanel(page, '#rdl-shape-arc', '패널 「호」');
      await page.waitForFunction((bid) => !!document.querySelector(`[id="${bid}"] > .rdl-stage--arc .rdl-label--side`), id, { timeout: 15000 });
      expect((await stateOf(page, id)).labelPos, '옆 라벨').toBe('outside');
    });
    await labelEditBody(page, id, 1, '가나다');
    await assertStep('넘침 0 (레이아웃 px · 변별 ≤ 0.75)', async () => {
      const o = await overflowOf(page, id);
      for (const side of ['top', 'bottom', 'left', 'right']) expect(o.worst[side], `${side} 넘침 px (누가: ${o.who[side] || '-'})`).toBeLessThanOrEqual(0.75);
      expect(o.stageOut, '스테이지가 블럭 밖으로 나간 px').toBeLessThanOrEqual(0.75);
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  test('B5 라벨 편집 ⌘Z 한 걸음', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const p = await scene('항목 1 을 골라 두고 · 편집 전', async () => {
      await preEditScene(page, id);
      const q = await labelPoint(page, id, 1);
      await clickAt(page, q.x, q.y, { sel: `[id="${id}"] .rdl-item[data-rdl-idx="1"]` }, { label: '항목 1 고르기' });
      await expect.poll(async () => (await stateOf(page, id)).rdlSel, { message: '_rdlSel 1' }).toBe(1);
      return labelPoint(page, id, 1);
    });
    await assertStep('dblclick + 입력 + Escape = ⌘Z 한 걸음 (A0~A3)', async () => {
      await expectOneUndoStep(page, async () => {
        await page.mouse.dblclick(p.x, p.y);
        await page.keyboard.type('가나다');
        await page.keyboard.press('Escape');
      }, '라벨 편집');
      expect((await stateOf(page, id)).items[1].label, '⌘Z 뒤 items[1].label').toBe('');
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  test('B6 안내문구를 손 안 대고 나가면 안 굳는다 (저장 \'\' · 표식 · 히스토리 불변)', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const p = await scene('items[2].label \'\' · 안내문구 있음', async () => {
      const s = await preEditScene(page, id);
      expect(s.items[2].label, 'items[2].label').toBe('');
      expect(await page.evaluate((bid) => document.querySelectorAll(`[id="${bid}"] .rdl-item[data-rdl-idx="2"] .rdl-label-text[data-is-placeholder="true"]`).length, id), '항목 2 안내문구').toBe(1);
      return labelPoint(page, id, 2);
    });
    const len0 = await page.evaluate(() => window.getHistoryTip().len);
    await page.mouse.dblclick(p.x, p.y);
    await assertStep('dblclick → 편집 열림', async () => {
      const h = await editHost(page, id);
      expect([h.n, h.label], '편집 host = 항목 2 라벨').toEqual([1, '2']);
    });
    await page.keyboard.press('Escape');
    await assertStep('Escape → \'\' 그대로 · 표식 다시 1 · 히스토리 len 불변', async () => {
      await expect.poll(async () => (await stateOf(page, id)).editable, { message: '편집 닫힘' }).toBe(0);
      expect((await stateOf(page, id)).items[2].label, 'items[2].label').toBe('');
      expect(await page.evaluate((bid) => document.querySelectorAll(`[id="${bid}"] .rdl-item[data-rdl-idx="2"] .rdl-label-text[data-is-placeholder="true"]`).length, id), '표식 1').toBe(1);
      expect(await page.evaluate(() => window.getHistoryTip().len), '히스토리 len').toBe(len0);
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  test('B7 굵게 원문 보존 — 편집에 원문 «**굵게** 글» 이 보이고 Escape 뒤 그대로', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const RAW = '**굵게** 글';
    const p = await scene('항목 3 을 고르고 「선택한 항목」 라벨에 굵게 글 → <b> 1', async () => {
      const q = await labelPoint(page, id, 3);
      await clickAt(page, q.x, q.y, { sel: `[id="${id}"] .rdl-item[data-rdl-idx="3"]` }, { label: '항목 3 고르기' });
      await expect(page.locator('#rdl-item-label')).toHaveCount(1);
      await page.locator('#rdl-item-label').fill(RAW);
      await page.locator('#rdl-item-label').dispatchEvent('change');
      await expect.poll(() => page.evaluate((bid) => document.querySelectorAll(`[id="${bid}"] .rdl-item[data-rdl-idx="3"] .rdl-label-text b`).length, id), { message: '<b> 1' }).toBe(1);
      expect((await stateOf(page, id)).items[3].label, 'items[3].label').toBe(RAW);
      await page.evaluate(() => document.activeElement?.blur?.());
      await preEditScene(page, id);
      return labelPoint(page, id, 3);
    });
    await page.mouse.dblclick(p.x, p.y);
    await assertStep('dblclick → 편집 열림 · 원문이 보인다', async () => {
      const h = await editHost(page, id);
      expect([h.n, h.label], '편집 host = 항목 3 라벨').toEqual([1, '3']);
      expect((h.text || '').trim(), '편집 중 글 = 원문').toBe(RAW);
    });
    await page.keyboard.press('Escape');
    await assertStep('Escape → 원문 그대로 · <b> 1', async () => {
      await expect.poll(async () => (await stateOf(page, id)).editable, { message: '편집 닫힘' }).toBe(0);
      expect((await stateOf(page, id)).items[3].label, 'items[3].label').toBe(RAW);
      expect(await page.evaluate((bid) => document.querySelectorAll(`[id="${bid}"] .rdl-item[data-rdl-idx="3"] .rdl-label-text b`).length, id), '<b> 1').toBe(1);
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  test('B9 라벨 안내문구는 캡처 클론에서 안 보인다 · 저장 items 라벨 \'\'', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    await scene('라벨 안내문구 ≥ 1', async () => {
      expect(await page.evaluate((bid) => document.querySelectorAll(`[id="${bid}"] .rdl-label-text[data-is-placeholder]`).length, id), '.rdl-label-text[data-is-placeholder] ≥ 1').toBeGreaterThanOrEqual(1);
    });
    const m = await page.evaluate(async ([bid, ph]) => {
      const cs = await import('/js/io/capture-safety.js');
      const b = document.getElementById(bid);
      const sec = b.closest('.section-block');
      const lab = b.querySelector('.rdl-label-text[data-is-placeholder="true"]');
      const d = document.createElement('div'); d.innerHTML = window.getSerializedCanvas();
      const sb = d.querySelector(`[id="${bid}"]`);
      let saved = null; try { saved = JSON.parse(sb.getAttribute('data-items')).map((it) => it.label); } catch (_) { saved = null; }
      const clone = sec.cloneNode(true); clone.id = 'rdl-t4b-clone';
      clone.style.position = 'absolute'; clone.style.left = '-5000px'; clone.style.top = '0';
      document.body.appendChild(clone);
      const beforeLab = [...clone.querySelectorAll('.rdl-label-text')].some((e) => (e.innerText || '').includes(ph));
      cs.stripEditorOnlyForCapture(clone);
      const vis = [...clone.querySelectorAll('.rdl-label-text, .rdl-label-text *')].filter((e) => (e.textContent || '').includes(ph) && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none').length;
      const after = [...clone.querySelectorAll('.rdl-label-text')].some((e) => (e.innerText || '').includes(ph));
      clone.remove();
      return { still: lab ? cs.isStillPlaceholderText(lab) : null, saved, beforeLab, vis, after };
    }, [id, PH]);
    await scene('벗기기 전 클론의 라벨에 안내문구가 보인다', async () => { expect(m.beforeLab, '벗기기 전 라벨 innerText 에 PH').toBe(true); });
    await assertStep('capture-safety 가 숨긴다 · 저장 라벨 전부 \'\'', async () => {
      expect(m.still, '라벨 안내문구 = isStillPlaceholderText').toBe(true);
      expect(m.vis, '벗긴 클론에서 PH 가 보이는 라벨 요소 0').toBe(0);
      expect(m.after, '벗긴 클론 라벨 innerText 에 PH 0').toBe(false);
      expect(m.saved, 'getSerializedCanvas data-items 라벨 전부 \'\'').toEqual(['', '', '', '', '', '']);
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  /* ───────── t4-04b ───────── */

  test('C0 패널에 가운데 글 칸이 없다 (배경 · 글자 색 줄은 산다)', async ({ page }) => {
    const { errs } = await makeRadial(page);
    await scene('가운데 = 텍스트 · 배경 · 글자 색 칸', async () => {
      await expect(page.locator('#rdl-center-text.active')).toHaveCount(1);
      await expect(page.locator('#rdl-center-bg-hex')).toHaveCount(1);
      await expect(page.locator('#rdl-center-color-hex')).toHaveCount(1);
    });
    await assertStep('#rdl-center-textarea 0 · 「첫 줄은」 칸 0', async () => {
      await expect(page.locator('#rdl-center-textarea')).toHaveCount(0);
      await expect(page.locator('.prop-textarea[placeholder*="첫 줄은"]')).toHaveCount(0);
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  test('B8 가운데 글 더블클릭 편집 — 첫 줄 sub · 나머지 main', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const p = await scene('.rdl-center--text 1 · 안내문구 1 · 편집 전', async () => {
      await preEditScene(page, id);
      expect(await page.evaluate((bid) => [document.querySelectorAll(`[id="${bid}"] .rdl-center--text`).length, document.querySelectorAll(`[id="${bid}"] .rdl-center [data-is-placeholder="true"]`).length], id), '가운데 글 · 안내문구').toEqual([1, 1]);
      return centerPoint(page, id);
    });
    await page.mouse.dblclick(p.x, p.y);
    await assertStep('dblclick → 가운데 편집 열림 · 고른 글 = 안내문구', async () => {
      const h = await editHost(page, id);
      expect([h.n, h.inCenter], '편집 host 1개 = 가운데 안').toEqual([1, true]);
      expect(h.sel, '고른 글 = 안내문구 전체').toBe(PH);
    });
    await page.keyboard.type('ABC');
    await page.keyboard.press('Enter');
    await page.keyboard.type('DEF');
    await page.keyboard.press('Escape');
    await assertStep('Escape → centerText «ABC\\nDEF» · sub ABC · main DEF · 표식 0', async () => {
      await expect.poll(async () => (await stateOf(page, id)).centerText, { message: 'dataset.centerText' }).toBe('ABC\nDEF');
      const m = await page.evaluate((bid) => { const b = document.getElementById(bid); return { sub: b.querySelector('.rdl-center-sub')?.textContent ?? null, main: b.querySelector('.rdl-center-main')?.textContent ?? null, ph: b.querySelectorAll('.rdl-center [data-is-placeholder]').length }; }, id);
      expect(m, 'sub · main · 표식').toEqual({ sub: 'ABC', main: 'DEF', ph: 0 });
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  test('C1a 가운데 클릭 = 가운데 고름 (고리 = 항목 고리와 같은 색 · 항목 고름과 안 겹침)', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const p = await scene('블럭 단독 선택 · 패널 열림', async () => {
      expect(await page.evaluate(() => document.querySelectorAll('#canvas .radial-block.selected').length), '고른 방사형 블럭 1').toBe(1);
      expect(await page.evaluate(() => document.querySelector('#panel-right .prop-block-id')?.dataset.copyId), '패널 머리 id').toBe(id);
      return centerPoint(page, id);
    });
    await latchByCanvas(page, id);
    await clickAt(page, p.x, p.y, { sel: p.sel }, { label: '가운데 클릭' });
    const c = await assertStep('가운데 outline solid · _rdlSel −1', async () => {
      const m = await page.evaluate((bid) => { const b = document.getElementById(bid); const cs = getComputedStyle(b.querySelector('.rdl-center')); return { style: cs.outlineStyle, color: cs.outlineColor, sel: b._rdlSel }; }, id);
      expect(m.style, '.rdl-center 계산 outlineStyle').toBe('solid');
      expect(m.sel, '_rdlSel === −1').toBe(-1);
      return m;
    });
    await scene('같은 블럭에서 항목 0 을 고른다(비교 색 재기)', async () => {
      const r = await stableTwice(page, `[id="${id}"] .rdl-item[data-rdl-idx="0"] .rdl-cell`);
      await clickAt(page, r.cx, r.cy, { sel: `[id="${id}"] .rdl-item[data-rdl-idx="0"]` }, { label: '항목 0' });
      await expect.poll(async () => (await stateOf(page, id)).rdlSel, { message: '_rdlSel 0' }).toBe(0);
    });
    await assertStep('가운데 고리 색 = 항목 고리 색', async () => {
      const it = await page.evaluate((bid) => getComputedStyle(document.querySelector(`[id="${bid}"] .rdl-cell-selected .rdl-cell`)).outlineColor, id);
      expect(c.color, '가운데 outlineColor = 항목 .rdl-cell outlineColor').toBe(it);
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  test('C1b 캔버스에서 가운데 골라 ⌫ → «없음» (블럭 그대로)', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const p = await scene('가운데 · 편집 전', async () => { await preEditScene(page, id); return centerPoint(page, id); });
    await latchByCanvas(page, id);
    await clickAt(page, p.x, p.y, { sel: p.sel }, { label: '가운데 클릭' });
    await scene('가운데 클릭 뒤 블럭 .selected · .rdl-center 1 · activeElement 편집 아님', async () => {
      const s = await stateOf(page, id);
      expect([s.selected, s.centers], '.selected · 가운데 1').toEqual([true, 1]);
      expect(await page.evaluate(() => !!document.activeElement?.isContentEditable), 'activeElement').toBe(false);
    });
    await page.keyboard.press('Backspace');
    await assertStep('블럭 수 · id 그대로 · 여전히 선택 · centerMode none · 가운데 0 · 패널 「없음」', async () => {
      const s = await stateOf(page, id);
      expect([s.exists, s.n], '블럭 있음 · 수 1').toEqual([true, 1]);
      expect(s.selected, '여전히 .selected').toBe(true);
      await expect.poll(async () => (await stateOf(page, id)).centerMode, { message: 'centerMode' }).toBe('none');
      expect((await stateOf(page, id)).centers, '.rdl-center 0').toBe(0);
      await expect(page.locator('#rdl-center-none.active')).toHaveCount(1);
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  test('C2 ㉠ 뒤 ⌘Z 한 칸 (+⇧⌘Z)', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const before = (await stateOf(page, id)).centerText;
    await scene('가운데 클릭(조작 밖)', async () => {
      await preEditScene(page, id);
      await latchByCanvas(page, id);
      const q = await centerPoint(page, id);
      await clickAt(page, q.x, q.y, { sel: q.sel }, { label: '가운데 클릭' });
      expect((await stateOf(page, id)).selected, '.selected').toBe(true);
    });
    await assertStep('⌫ = ⌘Z 한 걸음 (A0~A3)', async () => {
      await expectOneUndoStep(page, async () => {
        await page.keyboard.press('Backspace');
        await scene('⌫ 직후 블럭 있음 · centerMode none', async () => {
          await expect.poll(async () => { const s = await stateOf(page, id); return s.exists ? s.centerMode : '블럭 없음'; }).toBe('none');
        });
      }, '가운데 지우기');
    });
    await assertStep('⌘Z 뒤 텍스트 · 가운데 글 · 블럭 수 · id 그대로', async () => {
      const s = await stateOf(page, id);
      expect([s.exists, s.n, s.centerMode, s.centerText], '블럭 · 수 · 갈래 · 글').toEqual([true, 1, 'text', before]);
      expect(await page.evaluate((bid) => document.querySelectorAll(`[id="${bid}"] .rdl-center--text`).length, id), '.rdl-center--text 1').toBe(1);
    });
    await page.keyboard.press('Meta+Shift+z');
    await assertStep('⇧⌘Z → none 다시', async () => {
      await expect.poll(async () => (await stateOf(page, id)).centerMode, { message: 'centerMode' }).toBe('none');
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  /** C3 · C3g 몸 — ㉡ «없음» 에서 패널 텍스트 → 같은 자리에 다시 선다. */
  async function revivesText(page, id, makeNone) {
    const s0 = await stateOf(page, id);
    const box0 = await scene('㉠ 전 가운데 상자', async () => { const b = await centerBox(page, id); expect(b, '가운데 상자').not.toBeNull(); return b; });
    await scene('«없음» 상태가 섰다', makeNone);
    await clickPanel(page, '#rdl-center-text', '패널 가운데 「텍스트」');
    await assertStep('.rdl-center--text 1 · 중심 ±1 · 크기 같음 · 안내문구 1 · 배경 · 글자 색 그대로', async () => {
      await expect.poll(() => page.evaluate((bid) => document.querySelectorAll(`[id="${bid}"] .rdl-center--text`).length, id), { message: '.rdl-center--text' }).toBe(1);
      const b = await centerBox(page, id);
      expect(Math.abs(b.cx - box0.cx), `중심 x ±1 (${box0.cx} → ${b.cx})`).toBeLessThanOrEqual(1);
      expect(Math.abs(b.cy - box0.cy), `중심 y ±1 (${box0.cy} → ${b.cy})`).toBeLessThanOrEqual(1);
      expect([Math.round(b.w), Math.round(b.h)], '크기').toEqual([Math.round(box0.w), Math.round(box0.h)]);
      expect(await page.evaluate((bid) => document.querySelectorAll(`[id="${bid}"] .rdl-center [data-is-placeholder="true"]`).length, id), '안내문구 1').toBe(1);
      const s = await stateOf(page, id);
      expect([s.centerBg, s.centerColor], '배경 · 글자 색').toEqual([s0.centerBg, s0.centerColor]);
    });
  }

  test('C3 ㉡ 캔버스로 만든 «없음» 에서 패널 텍스트 → 그 자리에 다시 선다', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    await revivesText(page, id, () => canvasCenterNone(page, id));
    expect(errs, 'pageerror').toEqual([]);
  });

  test('C3g 지키는 칸 — 같은 ㉡ 를 패널 «없음» 으로 만든 판', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    await revivesText(page, id, async () => {
      await clickPanel(page, '#rdl-center-none', '패널 가운데 「없음」');
      await expect.poll(async () => (await stateOf(page, id)).centerMode).toBe('none');
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  test('C4 ㉡\' 이미지 — «없음» 에서 패널 이미지 → 같은 자리 · 체크 무늬', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const box0 = await scene('패널 이미지 → 가운데 상자', async () => {
      await clickPanel(page, '#rdl-center-image', '패널 가운데 「이미지」');
      await expect.poll(() => page.evaluate((bid) => document.querySelectorAll(`[id="${bid}"] .rdl-center--image`).length, id)).toBe(1);
      return centerBox(page, id);
    });
    await scene('캔버스 가운데 클릭 → ⌫ → none', () => canvasCenterNone(page, id));
    await clickPanel(page, '#rdl-center-image', '패널 가운데 「이미지」 다시');
    await assertStep('.rdl-center--image 1 · 중심 ±1 · 체크 무늬', async () => {
      await expect.poll(() => page.evaluate((bid) => document.querySelectorAll(`[id="${bid}"] .rdl-center--image`).length, id), { message: '.rdl-center--image' }).toBe(1);
      const b = await centerBox(page, id);
      expect(Math.abs(b.cx - box0.cx), '중심 x ±1').toBeLessThanOrEqual(1);
      expect(Math.abs(b.cy - box0.cy), '중심 y ±1').toBeLessThanOrEqual(1);
      expect(await page.evaluate((bid) => getComputedStyle(document.querySelector(`[id="${bid}"] .rdl-center`)).backgroundImage, id), '계산 backgroundImage').toContain('repeating-conic-gradient');
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  test('C5 지키는 칸 — 가운데를 안 골랐으면 ⌫ = 블럭 통째 (⒜ 항목 · ⒝ 빈 곳 · ⒞ 레이어 패널)', async ({ page }) => {
    test.setTimeout(90000);
    const { errs, secId, id } = await makeRadial(page);
    // ⒜ 항목을 고른 뒤 ⌫
    await scene('⒜ 항목 0 고름', async () => {
      const r = await stableTwice(page, `[id="${id}"] .rdl-item[data-rdl-idx="0"] .rdl-cell`);
      await clickAt(page, r.cx, r.cy, { sel: `[id="${id}"] .rdl-item[data-rdl-idx="0"]` }, { label: '항목 0' });
      await expect.poll(async () => (await stateOf(page, id)).rdlSel).toBe(0);
      expect((await stateOf(page, id)).selected, '.selected').toBe(true);
    });
    await page.keyboard.press('Backspace');
    await assertStep('⒜ ⌫ → 블럭 수 0', async () => { await expect.poll(() => radialCount(page), { message: '블럭 수' }).toBe(0); });
    // ⒝ 가운데 클릭 → 블럭 빈 곳 클릭 → ⌫
    const id2 = await scene('⒝ 새 블럭 · 가운데 클릭 → 블럭 빈 곳 클릭', async () => {
      await page.evaluate((sid) => { window.deselectAll?.(); window.selectSection?.(document.getElementById(sid)); }, secId);
      const nid = await insertViaMenu(page, secId, 1);
      await latchByCanvas(page, nid);
      const q = await centerPoint(page, nid);
      await clickAt(page, q.x, q.y, { sel: q.sel }, { label: '가운데 클릭' });
      await stableTwice(page, `[id="${nid}"]`);
      const e = await page.evaluate((bid) => {
        const b = document.getElementById(bid); const R = b.getBoundingClientRect();
        for (let fy = 0.1; fy < 0.95; fy += 0.05) for (let fx = 0.02; fx < 0.98; fx += 0.04) {
          const x = R.left + R.width * fx, y = R.top + R.height * fy, h = document.elementFromPoint(x, y);
          if (h && b.contains(h) && !h.closest('.rdl-center, .rdl-item')) return { x, y };
        }
        return null;
      }, nid);
      expect(e, '블럭 안 빈 곳(가운데 · 항목 아님)').not.toBeNull();
      await clickAt(page, e.x, e.y, { sel: `[id="${nid}"]`, not: '.rdl-center, .rdl-item' }, { label: '블럭 빈 곳' });
      const s = await stateOf(page, nid);
      expect([s.selected, s.rdlSel], '.selected · 항목 고름 없음').toEqual([true, -1]);
      return nid;
    });
    await page.keyboard.press('Backspace');
    await assertStep('⒝ ⌫ → 블럭 수 0', async () => { await expect.poll(() => radialCount(page), { message: '블럭 수' }).toBe(0); expect((await stateOf(page, id2)).exists).toBe(false); });
    // ⒞ 가운데 클릭 → 캔버스 밖 클릭으로 풀기 → 레이어 패널로 다시 고름 → ⌫
    const id3 = await scene('⒞ 새 블럭 · 가운데 클릭 → 캔버스 밖 클릭 → 레이어 패널로 다시 고름', async () => {
      await page.evaluate((sid) => { window.deselectAll?.(); window.selectSection?.(document.getElementById(sid)); }, secId);
      const nid = await insertViaMenu(page, secId, 1);
      await latchByCanvas(page, nid);
      const q = await centerPoint(page, nid);
      await clickAt(page, q.x, q.y, { sel: q.sel }, { label: '가운데 클릭' });
      const o = await page.evaluate(() => {
        const W = document.getElementById('canvas-wrap').getBoundingClientRect(), C = document.getElementById('canvas').getBoundingClientRect();
        const ys = [0.3, 0.5, 0.7].map((f) => W.top + W.height * f);
        for (const y of ys) for (const x of [W.left + 12, (W.left + C.left) / 2, C.right + 12, (C.right + W.right) / 2]) {
          const h = document.elementFromPoint(x, y);
          if (h && ['canvas-wrap', 'canvas-scaler', 'canvas'].includes(h.id)) return { x, y, id: h.id };
        }
        return null;
      });
      expect(o, '캔버스 밖 빈 자리').not.toBeNull();
      await clickAt(page, o.x, o.y, { sel: `#${o.id}` }, { label: '캔버스 밖' });
      await expect.poll(async () => (await stateOf(page, nid)).selected, { message: '선택 풀림' }).toBe(false);
      await page.evaluate(() => window.buildLayerPanel?.());
      const li = await page.evaluate((bid) => {
        const b = document.getElementById(bid); const row = b.closest('.row');
        return [...document.querySelectorAll('#layer-panel-body .layer-item')].findIndex((it) => it._dragTarget === b || it._dragTarget === row);
      }, nid);
      expect(li, '레이어 패널에 이 블럭의 행').toBeGreaterThanOrEqual(0);
      await page.evaluate((i) => document.querySelectorAll('#layer-panel-body .layer-item')[i].scrollIntoView({ block: 'center' }), li);
      const r = await stableTwice(page, '#layer-panel-body .layer-item', { index: li });
      await clickAt(page, r.cx, r.cy, { sel: '.layer-item' }, { label: '레이어 행' });
      await expect.poll(async () => (await stateOf(page, nid)).selected, { message: '레이어로 다시 고름' }).toBe(true);
      return nid;
    });
    await page.keyboard.press('Backspace');
    await assertStep('⒞ ⌫ → 블럭 수 0', async () => { await expect.poll(() => radialCount(page), { message: '블럭 수' }).toBe(0); expect((await stateOf(page, id3)).exists).toBe(false); });
    expect(errs, 'pageerror').toEqual([]);
  });

  test('C6 가운데 글 편집 중 ⌫ = 글자만 지움', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const p = await scene('가운데 · 편집 전', async () => { await preEditScene(page, id); return centerPoint(page, id); });
    await page.mouse.dblclick(p.x, p.y);
    await assertStep('dblclick → 가운데 편집 열림', async () => {
      const h = await editHost(page, id);
      expect([h.n, h.inCenter], '편집 host = 가운데').toEqual([1, true]);
    });
    await page.keyboard.type('AB');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Escape');
    await assertStep('centerText «A» · text · 블럭 수 그대로', async () => {
      await expect.poll(async () => { const s = await stateOf(page, id); return s.exists ? s.centerText : '블럭 없음'; }, { message: 'centerText' }).toBe('A');
      const s = await stateOf(page, id);
      expect([s.centerMode, s.n], '갈래 · 수').toEqual(['text', 1]);
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  /* ───────── t4-05 ───────── */

  async function pickImage(page, id) {
    await scene('패널 Center 절 · 「이미지」 단추', async () => { await expect(page.locator('#rdl-center-image')).toHaveCount(1); });
    await clickPanel(page, '#rdl-center-image', '패널 가운데 「이미지」');
    await expect.poll(() => page.evaluate((bid) => document.querySelectorAll(`[id="${bid}"] .rdl-center--image`).length, id), { message: '.rdl-center--image' }).toBe(1);
  }
  const imgLook = (page, id) => page.evaluate((bid) => {
    const b = document.getElementById(bid); const c = b.querySelector('.rdl-center');
    const cs = c ? getComputedStyle(c) : null;
    return { n: b.querySelectorAll('.rdl-center--image').length, svg: c ? c.querySelectorAll('svg').length : null, pic: c ? c.querySelectorAll('[data-radial-center]').length : null,
      sample: c ? c.querySelectorAll('[data-radial-sample]').length : null, bgi: cs ? cs.backgroundImage : null, bgs: cs ? cs.backgroundSize : null,
      ds: b.dataset.centerImg, active: document.querySelectorAll('#rdl-center-samples .active').length };
  }, id);

  test('D1 이미지 고르면 그림 0 · 체크 무늬 · centerImg \'\'', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    await pickImage(page, id);
    await assertStep('svg 0 · 가운데 그림 0 · 체크 · \'\' · 샘플 active 0', async () => {
      const m = await imgLook(page, id);
      expect([m.n, m.svg, m.pic], '.rdl-center--image 1 · svg 0 · [data-radial-center] 0').toEqual([1, 0, 0]);
      expect(m.bgi, '계산 backgroundImage').toContain('repeating-conic-gradient');
      expect(m.ds, 'dataset.centerImg').toBe('');
      expect(m.active, '#rdl-center-samples .active 0').toBe(0);
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  test('D2 체크 = big 토큰 (서클이미지블럭과 같은 값)', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    await pickImage(page, id);
    await assertStep('색 둘 = --goya-checker-big-a/b · 크기 = --goya-checker-big-size', async () => {
      const t = await page.evaluate(() => {
        const p = document.createElement('div'); document.body.appendChild(p);
        p.style.color = 'var(--goya-checker-big-a)'; const a = getComputedStyle(p).color;
        p.style.color = 'var(--goya-checker-big-b)'; const b = getComputedStyle(p).color;
        p.remove();
        return { a, b, size: getComputedStyle(document.documentElement).getPropertyValue('--goya-checker-big-size').trim() };
      });
      const m = await imgLook(page, id);
      expect(m.bgi, `big-a ${t.a}`).toContain(t.a);
      expect(m.bgi, `big-b ${t.b}`).toContain(t.b);
      expect(t.size, '토큰 크기 풀림').toBe('72px');
      expect(m.bgs, 'backgroundSize').toBe(`${t.size} ${t.size}`);
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  test('D3 지키는 칸 — 샘플을 고르면 체크가 걷힌다', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    await pickImage(page, id);
    await clickPanel(page, '#rdl-center-samples [data-sample="leaf"]', '샘플 leaf');
    await assertStep('svg 1 · backgroundImage none · centerImg leaf', async () => {
      await expect.poll(async () => (await imgLook(page, id)).ds, { message: 'centerImg' }).toBe('leaf');
      const m = await imgLook(page, id);
      expect([m.svg, m.bgi], 'svg 1 · 체크 없음').toEqual([1, 'none']);
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  test('D4 지키는 칸 — 옛 저장 블럭(centerImg bottle)은 옮기지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    const errs = await bootApp(page);
    const id = 'rdl_pz6a';
    await scene('옛 저장본(이미지 · bottle) 싣기 = rebindAll', async () => {
      const html = fs.readFileSync(path.join(ROOT, 'proto', 'demo-z6-a.html'), 'utf8');
      expect(html.includes('data-center-mode="text"'), '데모에 가운데 갈래 속성').toBe(true);
      const old = html.replace('data-center-mode="text"', 'data-center-mode="image" data-center-img="bottle"');
      await page.evaluate((h) => {
        const c = document.getElementById('canvas');
        c.querySelectorAll('.section-block').forEach((s) => s.remove());
        c.insertAdjacentHTML('beforeend', h);
        window.rebindAll();
      }, old);
      await page.waitForFunction((bid) => !!document.querySelector(`[id="${bid}"] > .rdl-stage .rdl-center--image`), id, { timeout: 15000 });
      expect((await stateOf(page, id)).centerMode, 'image').toBe('image');
    });
    await assertStep('bottle 그림 그대로 · 체크 없음 · centerImg bottle', async () => {
      const m = await imgLook(page, id);
      expect([m.svg, m.sample], 'svg 1 · 샘플 svg 1').toEqual([1, 1]);
      expect(await page.evaluate((bid) => document.querySelector(`[id="${bid}"] .rdl-center [data-radial-sample]`).getAttribute('data-radial-sample'), id), '샘플 키').toBe('bottle');
      expect(m.ds, 'dataset.centerImg').toBe('bottle');
      expect(await page.evaluate(async (bid) => (await import('/js/blocks/radial-block.js')).radialStateOf(document.getElementById(bid)).centerImg, id), 'radialStateOf centerImg').toBe('bottle');
      expect(m.bgi, '체크 없음').toBe('none');
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  /* ───────── ⒝-2 (eval-b CONDITIONAL 고침 · 사각 칸) ─────────
   * 장면 몇 개는 이벨 임시 칸(reports/S6-T4-RADIAL/zz-eval-b-risk.dom.spec.js E2 · E5 · E10 · E15)을 빌렸다. */

  /** 캔버스 밖 빈 자리 클릭 → 블럭 고름 풀림(C5⒞ 와 같은 자리 찾기). */
  async function clickOutsideCanvas(page) {
    const o = await page.evaluate(() => {
      const W = document.getElementById('canvas-wrap').getBoundingClientRect(), C = document.getElementById('canvas').getBoundingClientRect();
      for (const y of [0.3, 0.5, 0.7].map((f) => W.top + W.height * f)) for (const x of [W.left + 12, (W.left + C.left) / 2, C.right + 12, (C.right + W.right) / 2]) {
        const h = document.elementFromPoint(x, y);
        if (h && ['canvas-wrap', 'canvas-scaler', 'canvas'].includes(h.id)) return { x, y, id: h.id };
      }
      return null;
    });
    expect(o, '캔버스 밖 빈 자리').not.toBeNull();
    await clickAt(page, o.x, o.y, { sel: `#${o.id}` }, { label: '캔버스 밖' });
  }
  /** 레이어 패널 행 실제 클릭으로 이 블럭을 고른다(C5⒞ 와 같은 길). */
  async function selectViaLayer(page, id) {
    await page.evaluate(() => window.buildLayerPanel?.());
    const li = await page.evaluate((bid) => {
      const b = document.getElementById(bid); const row = b.closest('.row');
      return [...document.querySelectorAll('#layer-panel-body .layer-item')].findIndex((it) => it._dragTarget === b || it._dragTarget === row);
    }, id);
    expect(li, '레이어 패널에 이 블럭의 행').toBeGreaterThanOrEqual(0);
    await page.evaluate((i) => document.querySelectorAll('#layer-panel-body .layer-item')[i].scrollIntoView({ block: 'center' }), li);
    const r = await stableTwice(page, '#layer-panel-body .layer-item', { index: li });
    await clickAt(page, r.cx, r.cy, { sel: '.layer-item' }, { label: '레이어 행' });
    await expect.poll(async () => (await stateOf(page, id)).selected, { message: '레이어로 고름' }).toBe(true);
  }
  /** 가운데 고름 상태 — 고리(보이는 것) · _rdlCenterSel(⌫ 가 보는 것). */
  const centerSelOf = (page, id) => page.evaluate((bid) => {
    const b = document.getElementById(bid);
    return b ? { selected: b.classList.contains('selected'), cs: b._rdlCenterSel === true, ring: b.querySelectorAll('.rdl-center-cell-selected').length,
      outline: (() => { const c = b.querySelector('.rdl-center'); return c ? getComputedStyle(c).outlineStyle : null; })() } : null;
  }, id);

  /* E2 — 첫 클릭 = 블럭 고르기 · 다음 클릭 = 가운데 (두 단). 근거:
   *   js/props/prop-grid.js:125 «피그마식 드릴다운(첫 클릭=블럭·다음 클릭=줄)»
   *   js/blocks/radial-block.js(핀 04ce0b74):445 항목 끌기 «블럭이 선택돼 있고 그 항목이 이미 골라진 항목일 때만(첫 클릭은 고르기)»
   *   현빈 1012t1G1 «첫클릭은 블럭 선택» (지디 판정 to-s6-e2.txt) */
  test('E2a ㉠ 안 고른 블럭의 가운데 첫 클릭 = 블럭 고름 (가운데 아님 · 고리 0 · ⌫ = 블럭 통째)', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const p = await scene('캔버스 밖 클릭 → 블럭 풀림 · 가운데 자리', async () => {
      await clickOutsideCanvas(page);
      await expect.poll(async () => (await stateOf(page, id)).selected, { message: '선택 풀림' }).toBe(false);
      return centerPoint(page, id);
    });
    await clickAt(page, p.x, p.y, { sel: p.sel }, { label: '가운데 첫 클릭' });
    await scene('첫 클릭 뒤 블럭 .selected', async () => { await expect.poll(async () => (await stateOf(page, id)).selected).toBe(true); });
    await assertStep('가운데 고름 아님 — _rdlCenterSel 거짓 · 고리 0', async () => {
      const c = await centerSelOf(page, id);
      expect([c.cs, c.ring], '_rdlCenterSel · 고리 클래스 수').toEqual([false, 0]);
    });
    await page.keyboard.press('Backspace');
    await assertStep('⌫ → 블럭 통째 (수 0)', async () => { await expect.poll(() => radialCount(page), { message: '블럭 수' }).toBe(0); });
    expect(errs, 'pageerror').toEqual([]);
  });

  test('E2b ㉡ 고른 블럭에서 가운데 한 번 더 = 가운데 고름 (고리 1 · ⌫ = 가운데 «없음» · 블럭 그대로)', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const p = await scene('블럭 풀림 → 가운데 첫 클릭으로 블럭 고름', async () => {
      await clickOutsideCanvas(page);
      await expect.poll(async () => (await stateOf(page, id)).selected, { message: '선택 풀림' }).toBe(false);
      const q = await centerPoint(page, id);
      await clickAt(page, q.x, q.y, { sel: q.sel }, { label: '가운데 첫 클릭' });
      await expect.poll(async () => (await stateOf(page, id)).selected).toBe(true);
      return centerPoint(page, id);
    });
    await clickAt(page, p.x, p.y, { sel: p.sel }, { label: '가운데 둘째 클릭' });
    await assertStep('가운데 고름 — _rdlCenterSel 참 · 고리 1 · outline solid', async () => {
      const c = await centerSelOf(page, id);
      expect([c.cs, c.ring, c.outline], '_rdlCenterSel · 고리 · outline').toEqual([true, 1, 'solid']);
    });
    await page.keyboard.press('Backspace');
    await assertStep('⌫ → 블럭 있음 · centerMode none', async () => {
      await expect.poll(async () => { const s = await stateOf(page, id); return s.exists ? s.centerMode : '블럭 없음'; }, { message: 'centerMode' }).toBe('none');
      expect((await stateOf(page, id)).n, '블럭 수').toBe(1);
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  test('E15 고른 블럭의 가운데를 끌기만(click 없음) 한 뒤 → 풀고 레이어 패널로 고름 → 가운데 고리 0 · ⌫ = 블럭 통째', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const p = await scene('블럭 고름(넣은 직후) · 가운데 자리', async () => {
      expect((await stateOf(page, id)).selected, '.selected').toBe(true);
      return centerPoint(page, id);
    });
    await latchByCanvas(page, id);   // ⒝-3 — 걸쇠가 있어야 끌기 누름에 가운데 표식이 선다(이 칸이 재는 낡은 표식의 장면)
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    await page.mouse.move(p.x + 80, p.y + 120, { steps: 10 }); await page.mouse.move(p.x + 160, p.y + 240, { steps: 10 });
    await page.mouse.up();
    await scene('끌기 뒤 가운데 고름 없음(click 이 안 났다)', async () => {
      const c = await centerSelOf(page, id);
      expect(c && [c.cs, c.ring], '끌기 뒤 _rdlCenterSel · 고리').toEqual([false, 0]);
    });
    await scene('캔버스 밖 클릭 → 풀림 → 레이어 패널 행으로 고름', async () => {
      await clickOutsideCanvas(page);
      await expect.poll(async () => (await stateOf(page, id)).selected, { message: '선택 풀림' }).toBe(false);
      await selectViaLayer(page, id);
    });
    await assertStep('레이어로 고른 블럭 — 가운데 고리 0 · _rdlCenterSel 거짓 (plan-b §5 «레이어 패널 길은 false»)', async () => {
      const c = await centerSelOf(page, id);
      expect([c.cs, c.ring], '_rdlCenterSel · 고리').toEqual([false, 0]);
    });
    await page.keyboard.press('Backspace');
    await assertStep('⌫ → 블럭 통째 (수 0)', async () => { await expect.poll(() => radialCount(page), { message: '블럭 수' }).toBe(0); });
    expect(errs, 'pageerror').toEqual([]);
  });

  /* ⚠️얇은 데(261022 한 층씩 변이 실측): 이 칸은 겹① ＋ 겹② 를 다 뺐을 때만 빨개진다. 한 층만 빼면 초록이다(E10-b: 이 칸 초록 · Z-E10c 만 빨강) ⇒ 이 칸은 «두 겹이 같이 있다»를 잠그고, «각 겹이 제 일을 하나»는 Z-E10c 가 잰다.
   *   (겹① = radial-block.js _bindCellHit 의 «편집 중 host 밖 누름 = 편집 끝내기» · 겹② = _radialEndEdit 의 _rdlPainting 재진입 막이 · 겹① 은 E10-G1 이 따로 잰다 — 아래) */
  test('E10 라벨 편집 중 그 항목 칸을 끌면 — pageerror 0 · 친 글 보존 · 편집 닫힘', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    await scene('항목 1 고름 · 라벨 dblclick → 편집 · «XY»', async () => {
      const q = await labelPoint(page, id, 1);
      await clickAt(page, q.x, q.y, { sel: `[id="${id}"] .rdl-item[data-rdl-idx="1"]` }, { label: '항목 1 고르기' });
      await expect.poll(async () => (await stateOf(page, id)).rdlSel, { message: '_rdlSel 1' }).toBe(1);
      const p = await labelPoint(page, id, 1);
      await page.mouse.dblclick(p.x, p.y);
      await expect.poll(async () => (await editHost(page, id)).n, { message: '편집 host 1' }).toBe(1);
      await page.keyboard.type('XY');
    });
    const c = await scene('항목 1 칸 자리(라벨 밖)', async () => {
      const r = await stableTwice(page, `[id="${id}"] .rdl-item[data-rdl-idx="1"] .rdl-cell`);
      const ok = await page.evaluate(([bid, x, y]) => { const h = document.elementFromPoint(x, y); return !!(h && h.closest('.rdl-cell') && h.closest(`[id="${bid}"]`) && !h.closest('[contenteditable="true"]')); }, [id, r.cx, r.cy]);
      expect(ok, '누를 자리 = 칸(편집 host 아님)').toBe(true);
      return r;
    });
    await page.mouse.move(c.cx, c.cy); await page.mouse.down();
    await page.mouse.move(c.cx + 15, c.cy + 25, { steps: 5 }); await page.mouse.move(c.cx + 30, c.cy + 50, { steps: 5 });
    await page.mouse.up();
    await assertStep('pageerror 0 · items[1] = XY · 편집 닫힘(editing · contenteditable 0)', async () => {
      await expect.poll(async () => (await stateOf(page, id)).items[1].label, { message: 'items[1].label' }).toBe('XY');
      const s = await stateOf(page, id);
      const editing = await page.evaluate((bid) => document.getElementById(bid).classList.contains('editing'), id);
      expect([editing, s.editable], 'editing 클래스 · contenteditable').toEqual([false, 0]);
      expect(errs, 'pageerror (NotFoundError … blur 없음)').toEqual([]);
    });
  });

  test('E5 ⌘D — 보이는 가운데 고리 ⇔ _rdlCenterSel (사본 · 원본 둘 다) · 저장본 고리 0', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    await latchByCanvas(page, id);
    await scene('가운데 고름(고른 블럭에서 클릭)', async () => {
      const p = await centerPoint(page, id);
      await clickAt(page, p.x, p.y, { sel: p.sel }, { label: '가운데 클릭' });
      const c = await centerSelOf(page, id);
      expect([c.cs, c.ring], '가운데 고름').toEqual([true, 1]);
    });
    await page.keyboard.press('Meta+d');
    await scene('⌘D → 방사형 블럭 2', async () => { await expect.poll(() => radialCount(page), { message: '블럭 수' }).toBe(2); });
    await assertStep('블럭마다 «고리가 보인다» = _rdlCenterSel · 원본(고름 풀림) _rdlCenterSel 거짓 · 저장본 고리 0', async () => {
      const all = await page.evaluate(() => [...document.querySelectorAll('#canvas .radial-block')].map((b) => {
        const c = b.querySelector('.rdl-center');
        return { id: b.id, sel: b.classList.contains('selected'), cs: b._rdlCenterSel === true, seen: !!c && getComputedStyle(c).outlineStyle !== 'none' };
      }));
      console.log('E5', JSON.stringify(all));
      for (const b of all) expect([b.id, b.seen], `${b.id} 고리 보임 = _rdlCenterSel`).toEqual([b.id, b.cs]);
      const orig = all.find((b) => b.id === id);
      expect(orig && [orig.sel, orig.cs], '원본: 고름 풀림 · _rdlCenterSel 거짓').toEqual([false, false]);
      expect(await page.evaluate(() => (window.getSerializedCanvas().match(/rdl-center-cell-selected/g) || []).length), '저장본 고리 클래스').toBe(0);
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  test('M19 사각 — 편집 중 host 안 끌기(글자 고르기)는 편집을 안 깨고 항목도 안 움직인다', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const before = await scene('항목 1 고름 · 라벨 dblclick → 편집 · «ABCD»', async () => {
      const q = await labelPoint(page, id, 1);
      await clickAt(page, q.x, q.y, { sel: `[id="${id}"] .rdl-item[data-rdl-idx="1"]` }, { label: '항목 1 고르기' });
      await expect.poll(async () => (await stateOf(page, id)).rdlSel, { message: '_rdlSel 1' }).toBe(1);
      const p = await labelPoint(page, id, 1);
      await page.mouse.dblclick(p.x, p.y);
      await expect.poll(async () => (await editHost(page, id)).n, { message: '편집 host 1' }).toBe(1);
      await page.keyboard.type('ABCD');
      const { label, ...rest } = (await stateOf(page, id)).items[1];
      return rest;
    });
    const r = await scene('편집 host 안 두 점(왼끝 · 오른끝 근처)', async () => {
      const m = await page.evaluate((bid) => {
        const h = document.getElementById(bid).querySelector('[contenteditable="true"]'); const R = h.getBoundingClientRect();
        const a = { x: R.left + 2, y: R.top + R.height / 2 }, b = { x: R.right - 2, y: R.top + R.height / 2 };
        const inA = h.contains(document.elementFromPoint(a.x, a.y)), inB = h.contains(document.elementFromPoint(b.x, b.y));
        return { a, b, inA, inB };
      }, id);
      expect([m.inA, m.inB], '두 점 다 host 안').toEqual([true, true]);
      return m;
    });
    await page.mouse.move(r.a.x, r.a.y); await page.mouse.down();
    await page.mouse.move(r.b.x, r.b.y, { steps: 6 }); await page.mouse.up();
    await assertStep('편집 그대로 열림 · 항목 1 자리 키 그대로', async () => {
      const h = await editHost(page, id);
      expect([h.n, h.label], '편집 host 1 = 항목 1').toEqual([1, '1']);
      const { label, ...rest } = (await stateOf(page, id)).items[1];
      expect(rest, '항목 1 의 라벨 밖 키(자리 · 그림)').toEqual(before);
    });
    await page.keyboard.press('Escape');
    await assertStep('Escape → items[1] = ABCD', async () => {
      await expect.poll(async () => (await stateOf(page, id)).items[1].label, { message: 'items[1].label' }).toBe('ABCD');
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  /* O1 사각 «해석» — 원문 t4-04 «다시 우측패널에서도 없음으로 됐는데 내가 가운데>텍스트나 이미지를 선택하면 다시 그자리에 살아나는거지»:
   *   ⌫ 로 만든 «없음» 은 가운데 글을 지우지 않는다 ⇒ 패널 「텍스트」 로 되살리면 옛 글이 그 자리에 다시 선다(패널 «없음» 과 같은 꼴). */
  test('O1 사각 — ⌫ 로 «없음» 뒤 패널 텍스트 → 옛 글 «XYZ» 가 다시 선다', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    await scene('가운데 dblclick → «XYZ» → Escape', async () => {
      const p = await centerPoint(page, id);
      await page.mouse.dblclick(p.x, p.y);
      await expect.poll(async () => (await editHost(page, id)).inCenter, { message: '가운데 편집 host' }).toBe(true);
      await page.keyboard.type('XYZ');
      await page.keyboard.press('Escape');
      await expect.poll(async () => (await stateOf(page, id)).centerText, { message: 'centerText' }).toBe('XYZ');
      await expect.poll(async () => (await stateOf(page, id)).editable).toBe(0);
    });
    await scene('가운데 클릭 → 가운데 고름 → ⌫ → none', async () => {
      const p = await centerPoint(page, id);
      await clickAt(page, p.x, p.y, { sel: p.sel }, { label: '가운데 클릭' });
      expect((await centerSelOf(page, id)).cs, '가운데 고름').toBe(true);
      await page.keyboard.press('Backspace');
      await expect.poll(async () => { const s = await stateOf(page, id); return s.exists ? s.centerMode : '블럭 없음'; }).toBe('none');
    });
    await clickPanel(page, '#rdl-center-text', '패널 가운데 「텍스트」');
    await assertStep('centerMode text · centerText XYZ · 그려진 큰 글 XYZ · 안내문구 0', async () => {
      await expect.poll(async () => (await stateOf(page, id)).centerMode, { message: 'centerMode' }).toBe('text');
      const s = await stateOf(page, id);
      expect(s.centerText, 'centerText').toBe('XYZ');
      expect(await page.evaluate((bid) => { const b = document.getElementById(bid); return [b.querySelector('.rdl-center-main')?.textContent ?? null, b.querySelectorAll('.rdl-center [data-is-placeholder]').length]; }, id), '큰 글 · 안내문구').toEqual(['XYZ', 0]);
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  /* ───────── ⒝-3 (eval-b2 CONDITIONAL 고침) ───────── */

  /* R1 — 레이어 패널로 고른 뒤 «캔버스 첫 클릭» 이 가운데를 고르던 결함(eval-b2 D1 · zz Z-R1 장면). 근거:
   *   js/props/prop-grid.js:122-131 T-058 걸쇠 «…«캔버스 클릭이 아닌» 선택 경로(… 레이어 패널 …)가 걸쇠를 풀 길이 없어, 그 뒤 «사용자에겐 첫» 캔버스 클릭이 곧바로 줄로 내려갔다 → 블럭을 지우려는 ⌫ 가 …»
   *   js/block-drag.js:84 `_gridWasCanvasDrilled = grdWasCanvasDrilled && _isSoleSelectedBlock`
   *   radial 항목은 `_rdlSel === idx` 조건이 이미 걸쇠 노릇(레이어 길 = _rdlSel −1) — 가운데엔 없었다.
   *   261022 잼: 이 장면에선 레이어 전·후·짝 모두 −1 ⇒ _rdlSel 의 «걸쇠 노릇»을 이 장면으로는 가르지 못한다(미확정) — Y-R1c 값 줄 rdlSelBeforeLayer/AfterLayer · 단언 없음.
   *   가를 방법: −1 은 prop-radial.js:113 `if (_lastBlock && _lastBlock !== block) { _lastBlock._rdlSel = -1; … }` = 블럭이 바뀔 때 온다 ⇒ 가르려면 같은 블럭 안에서 _rdlSel ≥0(가운데/항목 고름) 상태를 먼저 만든 뒤 레이어로 다시 고르는 장면이 필요 · 그 장면이 없으면 원리적으로 못 가른다. */
  test('R1a 레이어 패널로 고른 뒤 가운데 «첫» 캔버스 클릭 = 블럭 고름 (고리 0) · ⌫ = 블럭 통째', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const p = await scene('캔버스 밖 클릭 → 풀림 → 레이어 패널 행으로 고름 · 가운데 자리', async () => {
      await clickOutsideCanvas(page);
      await expect.poll(async () => (await stateOf(page, id)).selected, { message: '선택 풀림' }).toBe(false);
      await selectViaLayer(page, id);
      const c = await centerSelOf(page, id);
      expect([c.cs, c.ring], '레이어로 고른 직후 가운데 고름 없음').toEqual([false, 0]);
      return centerPoint(page, id);
    });
    await clickAt(page, p.x, p.y, { sel: p.sel }, { label: '가운데 첫 캔버스 클릭' });
    await scene('첫 클릭 뒤 블럭 .selected', async () => { await expect.poll(async () => (await stateOf(page, id)).selected).toBe(true); });
    await assertStep('가운데 고름 아님 — _rdlCenterSel 거짓 · 고리 0', async () => {
      const c = await centerSelOf(page, id);
      expect([c.cs, c.ring], '_rdlCenterSel · 고리 클래스 수').toEqual([false, 0]);
    });
    await page.keyboard.press('Backspace');
    await assertStep('⌫ → 블럭 통째 (수 0)', async () => { await expect.poll(() => radialCount(page), { message: '블럭 수' }).toBe(0); });
    expect(errs, 'pageerror').toEqual([]);
  });

  test('R1b 레이어 패널로 고른 뒤 가운데 첫 클릭(블럭) → 한 번 더 = 가운데 고름 (고리 1)', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const p = await scene('레이어 패널로 고름 → 가운데 첫 캔버스 클릭 → 고리 0', async () => {
      await clickOutsideCanvas(page);
      await expect.poll(async () => (await stateOf(page, id)).selected, { message: '선택 풀림' }).toBe(false);
      await selectViaLayer(page, id);
      const q = await centerPoint(page, id);
      await clickAt(page, q.x, q.y, { sel: q.sel }, { label: '가운데 첫 캔버스 클릭' });
      await expect.poll(async () => (await stateOf(page, id)).selected).toBe(true);
      return centerPoint(page, id);
    });
    await clickAt(page, p.x, p.y, { sel: p.sel }, { label: '가운데 둘째 클릭' });
    await assertStep('가운데 고름 — _rdlCenterSel 참 · 고리 1 · outline solid', async () => {
      const c = await centerSelOf(page, id);
      expect([c.cs, c.ring, c.outline], '_rdlCenterSel · 고리 · outline').toEqual([true, 1, 'solid']);
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  /* R2 — 다중 선택에서 맨 클릭 한 번이 가운데까지 고르던 결함(eval-b2 D2 · zz Z-R2 장면).
   *   그리드는 «단독 선택»일 때만 드릴한다(block-drag.js:72 _isSoleSelectedBlock → prop-grid.js:115 grdIsSoleSelected).
   *   장면: A 를 캔버스로 먼저 골라 걸쇠를 A 에 건다(그래야 «단독 곱»만 따로 잰다) → ⌘클릭으로 B 더함 → A 가운데 맨 클릭. */
  test('R2 다중 선택(A 캔버스 고름 + ⌘클릭 B) 뒤 A 가운데 맨 클릭 = 블럭 단독 고름 · 가운데 아님', async ({ page }) => {
    const { errs, secId, id } = await makeRadial(page);
    const id2 = await scene('두 번째 블럭 B', async () => {
      await page.evaluate((sid) => { window.deselectAll?.(); window.selectSection?.(document.getElementById(sid)); }, secId);
      return insertViaMenu(page, secId, 2);
    });
    await latchByCanvas(page, id);
    await scene('⌘클릭으로 B 더함 → A · B 둘 다 .selected · A 가운데 고름 없음', async () => {
      const r = await stableTwice(page, `[id="${id2}"] .rdl-item[data-rdl-idx="0"] .rdl-cell`);
      await page.keyboard.down('Meta'); await page.mouse.click(r.cx, r.cy); await page.keyboard.up('Meta');
      await expect.poll(async () => [(await stateOf(page, id)).selected, (await stateOf(page, id2)).selected], { message: 'A · B .selected' }).toEqual([true, true]);
      const c = await centerSelOf(page, id);
      expect([c.cs, c.ring], 'A 가운데 고름 없음').toEqual([false, 0]);
    });
    const p = await scene('A 가운데 자리', () => centerPoint(page, id));
    await clickAt(page, p.x, p.y, { sel: p.sel }, { label: 'A 가운데 맨 클릭' });
    await assertStep('A 고름 · _rdlCenterSel 거짓 · 고리 0 (다중에서 맨 클릭 = 블럭 단독 고름)', async () => {
      await expect.poll(async () => (await stateOf(page, id2)).selected, { message: 'B 풀림' }).toBe(false);
      const c = await centerSelOf(page, id);
      expect([c.selected, c.cs, c.ring], 'A .selected · _rdlCenterSel · 고리').toEqual([true, false, 0]);
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  /* E10-G1 — 겹①(radial-block.js _bindCellHit «편집 중 host «밖»을 누르면(칸 끌기 · 다른 칸) 편집을 먼저 끝낸다 … 이 누름으로 끌기는 시작하지 않는다») 를 재는 칸.
   *   E10 과 장면은 같고 단언이 다르다: ㉮ 편집이 먼저 끝난다(친 글 XY 가 _radialEndEdit 로 쓰임 · editing 0 · contenteditable 0) ㉯ 끌기는 시작 안 한다(항목 1 의 라벨 밖 키 = 자리 · 각도 그대로). */
  test('E10-G1 겹① — 라벨 편집 중 host 밖(그 항목 칸)을 끌면 ㉮ 편집이 끝나 글이 쓰이고 ㉯ 항목은 안 움직인다', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const before = await scene('항목 1 고름 · 라벨 dblclick → 편집 · «XY»', async () => {
      const q = await labelPoint(page, id, 1);
      await clickAt(page, q.x, q.y, { sel: `[id="${id}"] .rdl-item[data-rdl-idx="1"]` }, { label: '항목 1 고르기' });
      await expect.poll(async () => (await stateOf(page, id)).rdlSel, { message: '_rdlSel 1' }).toBe(1);
      const p = await labelPoint(page, id, 1);
      await page.mouse.dblclick(p.x, p.y);
      await expect.poll(async () => (await editHost(page, id)).n, { message: '편집 host 1' }).toBe(1);
      await page.keyboard.type('XY');
      const { label, ...rest } = (await stateOf(page, id)).items[1];
      return rest;
    });
    const c = await scene('항목 1 칸 자리(라벨 밖 · 편집 host 아님)', async () => {
      const r = await stableTwice(page, `[id="${id}"] .rdl-item[data-rdl-idx="1"] .rdl-cell`);
      const ok = await page.evaluate(([bid, x, y]) => { const h = document.elementFromPoint(x, y); return !!(h && h.closest('.rdl-cell') && h.closest(`[id="${bid}"]`) && !h.closest('[contenteditable="true"]')); }, [id, r.cx, r.cy]);
      expect(ok, '누를 자리 = 칸(편집 host 아님)').toBe(true);
      return r;
    });
    await page.mouse.move(c.cx, c.cy); await page.mouse.down();
    await page.mouse.move(c.cx + 15, c.cy + 25, { steps: 5 }); await page.mouse.move(c.cx + 30, c.cy + 50, { steps: 5 });
    await page.mouse.up();
    await assertStep('㉮ 편집 끝 — items[1] = XY · editing 0 · contenteditable 0', async () => {
      await expect.poll(async () => (await stateOf(page, id)).items[1].label, { message: 'items[1].label' }).toBe('XY');
      const s = await stateOf(page, id);
      const editing = await page.evaluate((bid) => document.getElementById(bid).classList.contains('editing'), id);
      expect([editing, s.editable], 'editing 클래스 · contenteditable').toEqual([false, 0]);
    });
    await assertStep('㉯ 끌기 시작 안 함 — 항목 1 의 라벨 밖 키(자리 · 각도 · 그림) 그대로', async () => {
      const { label, ...rest } = (await stateOf(page, id)).items[1];
      console.log('E10-G1', JSON.stringify({ before, after: rest }));
      expect(rest, '항목 1 라벨 밖 키').toEqual(before);
    });
    expect(errs, 'pageerror').toEqual([]);
  });

  /* Z-E10c — 옮김: tests/dom/zz-eval-b2-risk.dom.spec.js(이벨 임시 칸 · 추적 밖) → 이 파일 · 1칸(지디 판정 ① · to-s6-ze10c.txt). 이름은 그대로 · E10 과 안 묶는다.
   * 이 칸이 겹② 의 유일한 자다 — E10 칸은 겹② 한쪽 빼기를 못 본다.
   *   (겹② = radial-block.js _radialEndEdit 의 `if (block._rdlPainting) { queueMicrotask(…); return; }` · 길 = 편집 중 «다른» 다시 그리기 · E10-b 변이(eval-b2 #13)에서 이 칸만 빨강)
   *   옮기며 바꾼 것: zz 도우미 labelPt → 이 파일 labelPoint · st → stateOf(+ editing 클래스는 그 자리에서 읽음) · 단언 3개 그대로. */
  test('Z-E10c 편집 중 다른 길로 다시 그리기(renderRadialBlock 직접 = 가드 둘째 겹의 길) → pageerror · 글', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    await scene('항목 3 dblclick · «QQ»', async () => {
      const p = await labelPoint(page, id, 3); await page.mouse.dblclick(p.x, p.y);
      await expect.poll(async () => (await stateOf(page, id)).editable).toBe(1);
      await page.keyboard.type('QQ');
    });
    const r = await page.evaluate((bid) => { try { window.renderRadialBlock(document.getElementById(bid)); return 'ok'; } catch (e) { return String(e && e.message); } }, id);
    await expect.poll(async () => (await stateOf(page, id)).editable).toBe(0);
    const s1 = await stateOf(page, id);
    const editingCls = await page.evaluate((bid) => document.getElementById(bid).classList.contains('editing'), id);
    console.log('Z-E10c', JSON.stringify({ r, label3: s1.items[3].label, editingCls, errs }));
    await assertStep('throw 0 · pageerror 0 · 글 QQ', async () => {
      expect(r).toBe('ok');
      await expect.poll(async () => (await stateOf(page, id)).items[3].label).toBe('QQ');
      expect(errs).toEqual([]);
    });
  });

  /* ───────── ⒝-4 섞인 칸 — 그리드 걸쇠(prop-grid.js:132 _grdDrillLatch) ↔ radial (옮김 · 2026-10-22) ─────────
   * 옮김: tests/dom/zz-eval-b3-mixed.dom.spec.js(이벨 임시 · 추적 밖 · sha256 7cc7d950…) → 이 파일 · 6칸(X-A ×2 · X-B ×2 · X-M1 · X-M2 · Y-R1c · Y-R1d — 이름 그대로) ＋ 음성대조 짝 2(Y-R1c-neg · Y-R1d-neg · 새).
   *   Y-E15a · Y-E15c 는 zz 에 남는다(명부 EVAL-ONLY-SPEC-NOT-COMMITTED-01).
   * 도우미 대조(zz → 이 파일):
   *   scene · assertStep · setup → 이 파일 것(같은 일 · setup 의 창 높이 1400 → 1100) · stable → stableTwice(크기 > 0 을 더 잰다)
   *   insertViaMenu(…'Radial') → 이 파일 insertViaMenu(page, secId, 1)(radial 전용 · 고름 · 패널까지 더 잰다) · viaLayer → selectViaLayer(같은 길)
   *   clickCenter → centerPoint(누를 자리 = 가운데 안 을 더 잰다) 위에 ⌘ 만 얹음
   *   따라온 것(이 파일에 없던 것): ids · insertGridViaMenu(zz insertViaMenu 의 'Grid' 판) · build · latchOf · gridSt · rdlSt · gridLinePt · clickGridLine · clickCenter · gridDrill · rdlDrill · G1 · R1 · R2 · rdlSelOf(㉯ 재기 · 새)
   *   rdlSt 를 centerSelOf 로 안 바꾼 까닭: 열쇠가 다르다(sel/selected · outline 더함) — 옮기기 전·후 값 줄을 글자로 대조하려고 zz 꼴 그대로 둔다. */
  const ids = (page, cls) => page.evaluate((c) => [...document.querySelectorAll(`#canvas .${c}`)].map((b) => b.id), cls);
  async function insertGridViaMenu(page, secId) {
    await page.evaluate((sid) => { window.deselectAll?.(); window.selectSection?.(document.getElementById(sid)); }, secId);
    const before = await ids(page, 'grid-block');
    const trig = '#fp-component-dropdown .fp-dropdown-trigger';
    const t = await stableTwice(page, trig);
    await clickAt(page, t.cx, t.cy, { sel: trig });
    await expect(page.locator('#fp-component-dropdown')).toHaveClass(/open/);
    const idx = await page.evaluate(() => [...document.querySelectorAll('#fp-component-menu .fp-menu-item')].findIndex((b) => b.textContent.trim() === 'Grid'));
    expect(idx, '메뉴 Grid').toBeGreaterThanOrEqual(0);
    const r = await stableTwice(page, '#fp-component-menu .fp-menu-item', { index: idx });
    await clickAt(page, r.cx, r.cy, { sel: '#fp-component-menu .fp-menu-item' });
    await expect.poll(async () => (await ids(page, 'grid-block')).length).toBe(before.length + 1);
    const id = (await ids(page, 'grid-block')).find((x) => !before.includes(x));
    await stableTwice(page, `[id="${id}"]`);
    return id;
  }
  async function build(page) {
    return scene('radial + grid (Component ▾)', async () => {
      const { errs, secId } = await setup(page);
      const rid = await insertViaMenu(page, secId, 1);
      const gid = await insertGridViaMenu(page, secId);
      await page.evaluate(() => { window.deselectAll?.(); });
      return { errs, secId, rid, gid };
    });
  }
  /** 걸쇠(prop-grid.js:132 _grdDrillLatch — 한 벌)가 radial(r) · 그리드(g) 중 어디에 걸렸나. */
  const latchOf = (page, rid, gid) => page.evaluate(([r, g]) => ({ r: !!window.grdWasCanvasDrilled?.(document.getElementById(r)), g: !!window.grdWasCanvasDrilled?.(document.getElementById(g)) }), [rid, gid]);
  const gridSt = (page, gid) => page.evaluate((g) => { const b = document.getElementById(g); return { sel: b.classList.contains('selected'), active: window.grdGetActiveLine?.(b) || null, marks: document.querySelectorAll('.grd-line-selected').length }; }, gid);
  const rdlSt = (page, rid) => page.evaluate((r) => { const b = document.getElementById(r); return { sel: b.classList.contains('selected'), cs: b._rdlCenterSel === true, ring: b.querySelectorAll('.rdl-center-cell-selected').length }; }, rid);
  /** ㉯ 재기 — 요소 속성 _rdlSel(radial-block.js:526 · prop-radial.js:120). */
  const rdlSelOf = (page, rid) => page.evaluate((id) => { const v = document.getElementById(id)._rdlSel; return v === undefined ? 'undef' : v; }, rid);
  async function gridLinePt(page, gid) {
    const p = await page.evaluate((g) => {
      const b = document.getElementById(g);
      for (const el of b.querySelectorAll('[data-line]')) {
        const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
        const x = r.left + r.width / 2, y = r.top + r.height / 2; const h = document.elementFromPoint(x, y);
        if (h && el.contains(h)) return { x, y, line: el.dataset.line, r: el.dataset.r, c: el.dataset.c };
      }
      return null;
    }, gid);
    expect(p, '그리드 줄 누를 자리').not.toBeNull();
    return p;
  }
  async function clickGridLine(page, gid, mods) {
    const p = await gridLinePt(page, gid);
    if (mods) await page.keyboard.down('Meta');
    await clickAt(page, p.x, p.y, { sel: `[id="${gid}"]` });
    if (mods) await page.keyboard.up('Meta');
  }
  async function clickCenter(page, rid, mods) {
    const p = await centerPoint(page, rid);
    if (mods) await page.keyboard.down('Meta');
    await clickAt(page, p.x, p.y, { sel: p.sel });
    if (mods) await page.keyboard.up('Meta');
  }
  /** 그리드 드릴(캔버스 두 번) — 장면: 첫 = 블럭 · 둘째 = 줄. */
  async function gridDrill(page, gid, how = 'canvas') {
    if (how === 'layer') await selectViaLayer(page, gid); else await clickGridLine(page, gid);
    const a = await gridSt(page, gid);
    await clickGridLine(page, gid);
    const b = await gridSt(page, gid);
    return { first: a, second: b };
  }
  /** radial 두 단 — 첫 = 블럭 · 둘째 = 가운데. probe 를 주면 레이어 고름 직후 _rdlSel 을 적는다(㉯ ⓑ 재기 · 값 줄 꼴은 안 바꾼다). */
  async function rdlDrill(page, rid, how = 'canvas', probe) {
    if (how === 'layer') { await selectViaLayer(page, rid); if (probe) probe.rdlSelAfterLayer = await rdlSelOf(page, rid); }
    await clickCenter(page, rid);
    const a = await rdlSt(page, rid);
    await clickCenter(page, rid);
    const b = await rdlSt(page, rid);
    return { first: a, second: b };
  }
  const G1 = { sel: true, active: null, marks: 0 };
  const R1 = { sel: true, cs: false, ring: 0 };
  const R2 = { sel: true, cs: true, ring: 1 };

  for (const rHow of ['layer', 'canvas']) {
    /* 이 칸은 그리드 걸쇠(prop-grid.js:132 _grdDrillLatch)와 radial 의 섞인 장면을 잰다 — 2026-10-22 에 추적 밖 zz-eval-b3-mixed 에서 옮겨 왔다(Z-E10c 선례). */
    test(`X-A-${rHow} 그리드 드릴 → radial(${rHow}) 두 단 → 그리드 첫 클릭 = 블럭 · 둘째 = 줄`, async ({ page }) => {
      const { errs, rid, gid } = await build(page);
      const g0 = await scene('그리드 캔버스 드릴(걸쇠 = 그리드)', async () => {
        const d = await gridDrill(page, gid);
        expect(d.first, '그리드 첫 클릭 = 블럭').toEqual(G1);
        expect(d.second.active, '그리드 둘째 = 줄').not.toBeNull();
        expect(await latchOf(page, rid, gid)).toEqual({ r: false, g: true });
        return d;
      });
      const probe = {};
      const rd = await rdlDrill(page, rid, rHow, probe);
      console.log('X-A', rHow, JSON.stringify({ g0, rd, latch: await latchOf(page, rid, gid) }));
      if (rHow === 'layer') console.log('X-A layer rdlSel(㉯ⓑ · 그리드를 거쳐 레이어로 radial 고른 직후)', JSON.stringify(probe));
      await assertStep('radial 첫 = 블럭 · 둘째 = 가운데', async () => { expect(rd.first).toEqual(R1); expect(rd.second).toEqual(R2); });
      const gd = await gridDrill(page, gid);
      console.log('X-A grid-back', JSON.stringify(gd));
      await assertStep('다시 그리드 — 첫 = 블럭(줄 0) · 둘째 = 줄 · radial 고리 0', async () => {
        expect(gd.first, '그리드 첫 클릭').toEqual(G1);
        expect(gd.second.active, '그리드 둘째 = 줄').not.toBeNull();
        expect(await rdlSt(page, rid)).toEqual({ sel: false, cs: false, ring: 0 });
      });
      expect(errs).toEqual([]);
    });
  }
  for (const gHow of ['layer', 'canvas']) {
    /* 이 칸은 그리드 걸쇠(prop-grid.js:132 _grdDrillLatch)와 radial 의 섞인 장면을 잰다 — 2026-10-22 에 추적 밖 zz-eval-b3-mixed 에서 옮겨 왔다(Z-E10c 선례). */
    test(`X-B-${gHow} radial 두 단 → 그리드(${gHow}) 드릴 → radial 첫 클릭 = 블럭 · 둘째 = 가운데`, async ({ page }) => {
      const { errs, rid, gid } = await build(page);
      await scene('radial 캔버스 두 단(가운데 고름)', async () => {
        const d = await rdlDrill(page, rid);
        expect(d.first).toEqual(R1); expect(d.second).toEqual(R2);
        expect(await latchOf(page, rid, gid)).toEqual({ r: true, g: false });
      });
      const gd = await gridDrill(page, gid, gHow);
      console.log('X-B', gHow, JSON.stringify({ gd, latch: await latchOf(page, rid, gid) }));
      let g3 = null;
      if (gHow === 'layer') { await clickGridLine(page, gid); g3 = await gridSt(page, gid); console.log('X-B layer third', JSON.stringify(g3)); }
      await assertStep(`그리드(${gHow}) — 첫 캔버스 클릭 = 블럭 · 다음 = 줄`, async () => {
        if (gHow === 'canvas') {
          expect(gd.first, '그리드 첫 캔버스 클릭').toEqual(G1);
          expect(gd.second.active, '그리드 둘째 = 줄').not.toBeNull();
        } else {
          expect([gd.first.sel, gd.first.active], '레이어 고름 뒤 줄 0').toEqual([true, null]);
          expect(gd.second, '레이어 고름 뒤 «첫» 캔버스 클릭 = 블럭(줄 0)').toEqual(G1);
          expect(g3.active, '그 다음 캔버스 클릭 = 줄').not.toBeNull();
        }
      });
      const rd = await rdlDrill(page, rid);
      console.log('X-B radial-back', JSON.stringify(rd));
      await assertStep('다시 radial — 첫 = 블럭 · 둘째 = 가운데', async () => { expect(rd.first).toEqual(R1); expect(rd.second).toEqual(R2); });
      expect(errs).toEqual([]);
    });
  }
  /* Y-R1c · Y-R1d — 걸쇠를 «먼저 건 뒤» 푸는 길(radialNoteOpen 의 else · 고름 풀림 관찰자)을 재는 칸. R1a 는 삽입 직후(걸쇠 없음)에서 시작해 푸는 길을 안 지난다.
   *   ㉮ = 위 R1 머리 주석(지금 :1068 · ⒝-3 판 :1065)의 약속 «레이어 패널 고름이 걸쇠를 푼다»(= radial r) 를 단언으로 바꾼 것 — Y-R1c 에만(Y-R1d 는 deselectAll 이 푼 판이라 ㉮ 대상 아님).
   *   음성대조 짝(Y-R1c-neg · Y-R1d-neg) = grid-first-click-block.dom.spec.js T-058-12 꼴 — 레이어로 고른 뒤 걸쇠를 손으로 다시 걸면(grdMarkCanvasDrill) 같은 클릭이 가운데로 내려가야 한다. */
  /* 이 칸은 그리드 걸쇠(prop-grid.js:132 _grdDrillLatch)와 radial 의 섞인 장면을 잰다 — 2026-10-22 에 추적 밖 zz-eval-b3-mixed 에서 옮겨 왔다(Z-E10c 선례).
   * Y-R1c 양성 ↔ Y-R1d 음성 — 둘 중 하나만 초록이면 그 쌍은 죽었다 */
  test('Y-R1c 캔버스로 고름(걸쇠) → 안 풀고 레이어 행으로 다시 고름 → 가운데 첫 캔버스 클릭 = 블럭', async ({ page }) => {
    const { errs, rid, gid } = await build(page);
    const lb = await scene('radial 캔버스 첫 클릭 → 걸쇠 radial', async () => { await clickCenter(page, rid); expect(await rdlSt(page, rid)).toEqual(R1); const x = await latchOf(page, rid, gid); expect(x).toEqual({ r: true, g: false }); return x; });
    const sb = await rdlSelOf(page, rid);
    await scene('레이어 행으로 다시 고름(.selected 그대로)', async () => { await selectViaLayer(page, rid); });
    const l = await latchOf(page, rid, gid);
    const sa = await rdlSelOf(page, rid);
    await assertStep('㉮ 레이어로 다시 고른 직후 걸쇠가 radial 에서 풀렸다(r === false · 약속 = R1 머리 주석 :1068 · ⒝-3 판 :1065)', async () => { expect(l.r, 'latchOf.r').toBe(false); });
    await assertStep('g — 걸쇠가 다른 블럭(그리드)에 옮겨 붙지 않았다(g === false)', async () => { expect(l.g, 'latchOf.g').toBe(false); });
    await clickCenter(page, rid);
    const r = await rdlSt(page, rid);
    console.log('Y-R1c', JSON.stringify({ latchBeforeLayer: lb, latchAfterLayer: l, r }));
    console.log('Y-R1c rdlSel(㉯ⓐ · 같은 블럭 레이어로 다시 고름)', JSON.stringify({ rdlSelBeforeLayer: sb, rdlSelAfterLayer: sa }));
    await assertStep('레이어로 다시 고른 뒤 첫 캔버스 클릭 = 블럭 · 가운데 아님', async () => { expect(r).toEqual(R1); });
    expect(errs).toEqual([]);
  });
  /* 이 칸은 그리드 걸쇠(prop-grid.js:132 _grdDrillLatch)와 radial 의 섞인 장면을 잰다 — 2026-10-22 에 추적 밖 zz-eval-b3-mixed 에서 옮겨 왔다(Z-E10c 선례).
   * Y-R1c 양성 ↔ Y-R1d 음성 — 둘 중 하나만 초록이면 그 쌍은 죽었다 */
  test('Y-R1d 캔버스로 고름(걸쇠) → 풀림(deselectAll) → 레이어 행으로 고름 → 가운데 첫 캔버스 클릭 = 블럭', async ({ page }) => {
    const { errs, rid, gid } = await build(page);
    await scene('radial 캔버스 첫 클릭 → 걸쇠 radial', async () => { await clickCenter(page, rid); expect(await latchOf(page, rid, gid)).toEqual({ r: true, g: false }); });
    await scene('풀림', async () => { await page.evaluate(() => window.deselectAll?.()); await expect.poll(async () => (await rdlSt(page, rid)).sel).toBe(false); });
    const l0 = await latchOf(page, rid, gid);
    await scene('레이어 행으로 고름', async () => { await selectViaLayer(page, rid); });
    await clickCenter(page, rid);
    const r = await rdlSt(page, rid);
    console.log('Y-R1d', JSON.stringify({ latchAfterDeselect: l0, r }));
    await assertStep('첫 캔버스 클릭 = 블럭 · 가운데 아님', async () => { expect(r).toEqual(R1); });
    expect(errs).toEqual([]);
  });
  /* ★음성대조(새 · ⒝-4) — T-058-12 꼴: 레이어로 고른 뒤 «고치기 전» 상태(걸쇠가 안 풀린 채)를 손으로 되돌리면 같은 클릭이 가운데로 내려간다.
   *   초록 = «걸쇠가 Y-R1c 의 «첫 클릭 = 블럭» 단언을 실제로 좌우한다»(Y-R1c 가 무언가를 본다). */
  test('Y-R1c-neg ★음성대조 — 레이어로 다시 고른 뒤 걸쇠를 손으로 다시 걸면(grdMarkCanvasDrill) 같은 첫 클릭이 가운데를 고른다(Y-R1c 가 진짜로 본다)', async ({ page }) => {
    const { errs, rid, gid } = await build(page);
    await scene('radial 캔버스 첫 클릭 → 걸쇠 radial', async () => { await clickCenter(page, rid); expect(await rdlSt(page, rid)).toEqual(R1); expect(await latchOf(page, rid, gid)).toEqual({ r: true, g: false }); });
    await scene('레이어 행으로 다시 고름(.selected 그대로)', async () => { await selectViaLayer(page, rid); });
    const l = await latchOf(page, rid, gid);
    // ★고치기 «전» 상태를 손으로 되돌린다 — 걸쇠가 안 풀린 채 남아 있던 그 상태.
    await page.evaluate((id) => window.grdMarkCanvasDrill?.(document.getElementById(id)), rid);
    const lm = await latchOf(page, rid, gid);
    const sm = await rdlSelOf(page, rid);
    await clickCenter(page, rid);
    const r = await rdlSt(page, rid);
    console.log('Y-R1c-neg', JSON.stringify({ latchAfterLayer: l, latchAfterRemark: lm, rdlSelAfterRemark: sm, r }));
    await assertStep('다시 건 걸쇠 아래 같은 첫 클릭 = 가운데 고름', async () => {
      expect(r, '이 음성대조가 결함을 재현하지 못한다 — Y-R1c 의 «첫 클릭 = 블럭» 단언이 걸쇠를 안 본다').toEqual(R2);
    });
    expect(errs).toEqual([]);
  });
  test('Y-R1d-neg ★음성대조 — 풀림(deselectAll) 뒤 레이어로 고르고 걸쇠를 손으로 다시 걸면 같은 첫 클릭이 가운데를 고른다(Y-R1d 가 진짜로 본다)', async ({ page }) => {
    const { errs, rid, gid } = await build(page);
    await scene('radial 캔버스 첫 클릭 → 걸쇠 radial', async () => { await clickCenter(page, rid); expect(await latchOf(page, rid, gid)).toEqual({ r: true, g: false }); });
    await scene('풀림', async () => { await page.evaluate(() => window.deselectAll?.()); await expect.poll(async () => (await rdlSt(page, rid)).sel).toBe(false); });
    const l0 = await latchOf(page, rid, gid);
    await scene('레이어 행으로 고름', async () => { await selectViaLayer(page, rid); });
    // ★고치기 «전» 상태를 손으로 되돌린다.
    await page.evaluate((id) => window.grdMarkCanvasDrill?.(document.getElementById(id)), rid);
    const lm = await latchOf(page, rid, gid);
    await clickCenter(page, rid);
    const r = await rdlSt(page, rid);
    console.log('Y-R1d-neg', JSON.stringify({ latchAfterDeselect: l0, latchAfterRemark: lm, r }));
    await assertStep('다시 건 걸쇠 아래 같은 첫 클릭 = 가운데 고름', async () => {
      expect(r, '이 음성대조가 결함을 재현하지 못한다 — Y-R1d 의 «첫 클릭 = 블럭» 단언이 걸쇠를 안 본다').toEqual(R2);
    });
    expect(errs).toEqual([]);
  });
  /* 이 칸은 그리드 걸쇠(prop-grid.js:132 _grdDrillLatch)와 radial 의 섞인 장면을 잰다 — 2026-10-22 에 추적 밖 zz-eval-b3-mixed 에서 옮겨 왔다(Z-E10c 선례). */
  test('X-M1그리드 드릴 → ⌘클릭 radial(다중) → 맨 클릭 그리드 줄 = 블럭 단독(줄 0) · ⌘클릭 radial → 맨 클릭 radial 가운데 = 블럭 단독(고리 0)', async ({ page }) => {
    const { errs, rid, gid } = await build(page);
    await scene('그리드 드릴', async () => { const d = await gridDrill(page, gid); expect(d.second.active).not.toBeNull(); });
    await scene('⌘클릭 radial → 둘 다 .selected', async () => {
      await clickCenter(page, rid, true);
      await expect.poll(async () => [(await gridSt(page, gid)).sel, (await rdlSt(page, rid)).sel]).toEqual([true, true]);
    });
    await clickGridLine(page, gid);
    const g = await gridSt(page, gid);
    await assertStep('다중 뒤 그리드 맨 클릭 = 블럭 단독 · 줄 0 · radial 풀림', async () => {
      expect(g).toEqual(G1);
      expect((await rdlSt(page, rid)).sel).toBe(false);
    });
    await scene('⌘클릭 radial → 둘 다 .selected', async () => {
      await clickCenter(page, rid, true);
      await expect.poll(async () => [(await gridSt(page, gid)).sel, (await rdlSt(page, rid)).sel]).toEqual([true, true]);
    });
    await clickCenter(page, rid);
    const r = await rdlSt(page, rid);
    console.log('X-M1', JSON.stringify({ g, r, latch: await latchOf(page, rid, gid) }));
    await assertStep('다중 뒤 radial 가운데 맨 클릭 = 블럭 단독 · 가운데 아님', async () => {
      expect(r).toEqual(R1);
      expect((await gridSt(page, gid)).sel).toBe(false);
    });
    expect(errs).toEqual([]);
  });
  /* 이 칸은 그리드 걸쇠(prop-grid.js:132 _grdDrillLatch)와 radial 의 섞인 장면을 잰다 — 2026-10-22 에 추적 밖 zz-eval-b3-mixed 에서 옮겨 왔다(Z-E10c 선례). */
  test('X-M2 radial 두 단(걸쇠 radial) → ⌘클릭 그리드 → 맨 클릭 radial 가운데 = 블럭 단독 → 맨 클릭 그리드 줄 = 블럭', async ({ page }) => {
    const { errs, rid, gid } = await build(page);
    await scene('radial 두 단 · 가운데 고름', async () => { const d = await rdlDrill(page, rid); expect(d.second).toEqual(R2); });
    await scene('⌘클릭 그리드 → 둘 다 .selected', async () => {
      await clickGridLine(page, gid, true);
      await expect.poll(async () => [(await gridSt(page, gid)).sel, (await rdlSt(page, rid)).sel]).toEqual([true, true]);
    });
    await clickCenter(page, rid);
    const r = await rdlSt(page, rid);
    await clickGridLine(page, gid);
    const g = await gridSt(page, gid);
    console.log('X-M2', JSON.stringify({ r, g, latch: await latchOf(page, rid, gid) }));
    await assertStep('radial 맨 클릭 = 블럭 단독 · 고리 0 / 그 뒤 그리드 맨 클릭 = 블럭 · 줄 0', async () => {
      expect(r).toEqual(R1);
      expect(g).toEqual(G1);
    });
    expect(errs).toEqual([]);
  });

  /* ───────── QA⑴ 힌트 ───────── */

  test('H0 ⒝ 가 힌트를 더하지 않았다 (세 상태 · 글 집합 ⊆ 핀 명부 − Data 힌트 · 수 ≤ 핀 수)', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const hints = () => page.evaluate(() => {
      const P = document.querySelector('#panel-right .panel-body');
      return { sections: P.querySelectorAll('.prop-section').length,
        hints: [...P.querySelectorAll('.prop-hint')].map((h) => h.textContent.replace(/\s+/g, ' ').trim().replace(/^항목 \d+ —/, '항목 N —')) };
    });
    const check = async (name, max) => {
      const h = await scene(`${name} — 패널 절 ≥ 1`, async () => { const x = await hints(); expect(x.sections, '.prop-section').toBeGreaterThanOrEqual(1); return x; });
      console.log(`H0 ${name}`, JSON.stringify(h.hints));
      await assertStep(`${name} — 힌트 ⊆ 핀 명부 − Data · 수 ≤ ${max}`, async () => {
        expect(h.hints.filter((t) => !PIN_HINTS.includes(t)), '명부 밖 힌트(Data 힌트 포함)').toEqual([]);
        expect(h.hints.length, '힌트 수').toBeLessThanOrEqual(max);
      });
    };
    await check('기본 원', PIN_HINT_COUNTS.base);
    await scene('항목 0 고름', async () => {
      const r = await stableTwice(page, `[id="${id}"] .rdl-item[data-rdl-idx="0"] .rdl-cell`);
      await clickAt(page, r.cx, r.cy, { sel: `[id="${id}"] .rdl-item[data-rdl-idx="0"]` }, { label: '항목 0' });
      await expect(page.locator('#rdl-item-section')).toHaveCount(1);
    });
    await check('항목 고름', PIN_HINT_COUNTS.item);
    await scene('가운데 이미지(항목 고름 유지)', async () => {
      await clickPanel(page, '#rdl-center-image', '패널 가운데 「이미지」');
      await expect(page.locator('#rdl-center-image.active')).toHaveCount(1);
    });
    await check('항목 고름 + 가운데 이미지', PIN_HINT_COUNTS.itemImage);
    expect(errs, 'pageerror').toEqual([]);
  });
});

/** 블럭 하나의 넘침 — radial-arc-contain.dom.spec.js 의 overflowOf 꼴(스테이지 사각형 밖 «레이아웃 px» · 변별 최대). */
function overflowOf(page, id) {
  return page.evaluate((bid) => {
    const block = document.getElementById(bid);
    const stage = block && block.querySelector(':scope > .rdl-stage');
    if (!stage) throw new Error('스테이지가 없다: ' + bid);
    const S = stage.getBoundingClientRect(), B = block.getBoundingClientRect();
    const scale = S.width / (stage.offsetWidth || 1);
    const line = stage.querySelector('.rdl-line');
    const sw = (Number(line.getAttribute('stroke-width')) || 0) / 2;
    const worst = { top: 0, bottom: 0, left: 0, right: 0 }, who = {};
    const take = (el, kind) => {
      const r = el.getBoundingClientRect();
      if (!(r.width > 0 || r.height > 0)) return;
      const o = { top: (S.top - r.top) / scale, bottom: (r.bottom - S.bottom) / scale, left: (S.left - r.left) / scale, right: (r.right - S.right) / scale };
      for (const k of Object.keys(o)) if (o[k] > worst[k]) { worst[k] = o[k]; who[k] = kind; }
    };
    if ((line.getAttribute('d') || '').length) {
      const M = line.getScreenCTM(), len = line.getTotalLength(), N = 720;
      const cx = Number(stage.dataset.rdlCx), cy = Number(stage.dataset.rdlCy);
      for (let i = 0; i <= N; i++) {
        const u = line.getPointAtLength(len * i / N), q = new DOMPoint(u.x, u.y).matrixTransform(M);
        const x = (q.x - S.left) / scale, y = (q.y - S.top) / scale;
        const a = Math.atan2(y - cy, x - cx), tx = sw * Math.abs(Math.cos(a)), ty = sw * Math.abs(Math.sin(a));
        const o = { top: ty - y, bottom: y + ty - S.height / scale, left: tx - x, right: x + tx - S.width / scale };
        for (const k of Object.keys(o)) if (o[k] > worst[k]) { worst[k] = o[k]; who[k] = 'line'; }
      }
    }
    stage.querySelectorAll('.rdl-cell').forEach((el) => take(el, 'cell'));
    stage.querySelectorAll('.rdl-label').forEach((el) => take(el, 'label'));
    stage.querySelectorAll('.rdl-center').forEach((el) => take(el, 'center'));
    const stageOut = Math.max(B.top - S.top, S.bottom - B.bottom, B.left - S.left, S.right - B.right, 0) / scale;
    return { worst, who, stageOut };
  }, id);
}
