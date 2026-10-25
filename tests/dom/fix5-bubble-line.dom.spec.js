/* fix5-bubble-line.dom.spec.js — 1012t1G1 말풍선 «줄»을 그리드처럼 (S6 고침5 · 검수 ⒜~⒡ 반영)
 *
 * ★현빈 원문(👉): 「그리드 블럭은 첫클릭은 그리드 블럭이 선택이 된다. 그안에 텍스트를 선택하면 텍스트줄이 선택이 되고
 *   좌측에 핸들이 생긴다. 이상태에 우클릭으로 줄을 추가할 수 있다. 처음부터 더블클릭하면 해당하는 텍스트 줄 수정모드가 된다.
 *   근데 버블텍스트 블럭도 같은 동작이여야된다고 보는거야. 핸들이 처음에 안생겨서 줄을 추가하려면 우측패널에 꼭 가서 해야되고
 *   줄추가하면 플레이스 홀더가 '말풍선 텍스트를 입력하세요'에서 '글자를 입력하세요'로 텍스트가 바뀐다. 통일 시키는건 어떤가?」
 *
 * ★부모 실측(ca702d40): ⒜ 첫 클릭 = 블럭 ✅ · ⒝ 둘째 클릭 줄 선택+왼쪽 핸들 ❌(버블) · ⒞ 우클릭 줄 추가 ❌(버블 «과» 그리드 —
 *   #bcm-ln-add 주인 명부가 카드뿐) · ⒟ 더블클릭 = 수정 ✅ · ⒠ 새 줄 안내문 '글자를 입력하세요' ❌.
 * ★고침(js/blocks/line-host.js · js/props/prop-grid.js · js/block-drag.js · js/editor.js · css/editor-blocks.css):
 *   · 줄 없는 말풍선의 본문 = «가상 줄 0»(lnIsBubbleBodyLine) — 둘째 클릭이 고르고(.tb-bubble.ln-line-selected) 그리드 손잡이(.grd-line-grip)가 선다.
 *     첫 클릭은 그리드와 같은 드릴다운 걸쇠(grdMarkCanvasDrill)를 봐서 «삽입 직후에도» 블럭이다.
 *     가상 줄 상태의 ⌘X = 블럭 잘라내기 · ⌘↑/↓ = 블럭 이동(줄로 안 삼킨다) · ⌫ 만 두 걸음.
 *   · 우클릭 「아래에 줄 추가 (T)」 — 말풍선(명부에 더함) ＋ 그리드(grdCtxAddAddr → grdAddLineAt = T 와 한 길). 중첩(duo) 안은 T 처럼 숨김.
 *   · 말풍선 «안» 빈 줄 안내 = '말풍선 텍스트를 입력하세요'(다른 주인·그리드 안내문 무변).
 *
 * ★칸이 두 무리다:
 *   N* = 새 동작 — 바닥 판(GD1001_ROOT=<ca702d40 사본>)에서 ★빨강이어야 한다.
 *   R* = 회귀·지킴 — 새 동작을 전제하지 않는다 ⇒ 바닥 판에서도 ★초록이어야 한다.
 *        (R6·R7·R8 은 검수 ⒜⒞ 의 «삼킴/무동작 항목» 지킴 — 바닥 판엔 그 상태가 없어 초록, 검수 전 판(g1/cur)에서 빨강.)
 * ★변이 탐지: M12(grdCtxAddAddr 바깥 그리드만 거르기) → N9 · M13(_lnPlusAdd 가상 줄 정규화) → N7 · M14(가상 줄 box-shadow) → N1.
 * ★사람 길만 쓴다 — page.mouse 클릭·우클릭·더블클릭·키. 장면 세우기만 evaluate. N9 는 판정 함수를 직접 묻는 탐침이다(안쪽 그리드 우클릭은
 *   안쪽 블럭 리스너가 먼저 먹어 사람 길로는 그 갈래에 못 닿는다).
 * ⛔고정 대기 대신 waitForFunction / expect.poll 로 «무엇을» 기다리는지 쓴다(짧은 settle 만 예외).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const COND_MS = 15000;
const PH = '말풍선 텍스트를 입력하세요';
const SEC = `<div class="section-block" id="bG" data-section="1" data-name="G" data-bg="#ffffff" style="background:#fff;">
  <div class="section-hitzone"><span class="section-label">G</span></div><div class="section-inner"></div></div>`;

async function waitFor(page, fn, arg, what) {
  try { await page.waitForFunction(fn, arg, { timeout: COND_MS }); }
  catch (e) { throw new Error(`기다림 실패 — ${what}`, { cause: e }); }
}

/** 빈 섹션 → 배율 100 → 말풍선(또는 그리드) 하나. 넣은 뒤 «다 풀어» 첫 클릭이 진짜 첫 클릭이 되게 한다. */
async function setup(page, kind = 'bubble', { keepInsertSelection = false } = {}) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  const id = await page.evaluate(({ html, kind, keep }) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.();
    window.applyZoom?.(100);
    window.selectSection?.(document.getElementById('bG'));
    let b;
    if (kind === 'grid') {
      window.addGridBlock?.();
      b = document.querySelector('#canvas .grid-block');
      window.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lines: [{ type: 'body', text: '하나' }, { type: 'body', text: '둘' }] } });
    } else {
      window.addSpeechBubbleBlock?.('left');
      b = document.querySelector('#canvas .speech-bubble-block');
    }
    b.scrollIntoView({ block: 'center' });
    if (!keep) { window.deselectAll?.(); document.activeElement?.blur?.(); }
    return b.id;
  }, { html: SEC, kind, keep: keepInsertSelection });
  await waitFor(page, () => {
    const S = document.getElementById('canvas-scaler');
    if (!S || S.getAnimations().length) return false;
    const m = /^matrix\(([^,]+),/.exec(getComputedStyle(S).transform);
    return !!m && Math.abs(Number(m[1]) - 1) < 1e-3;
  }, undefined, '배율 100% 전환이 안 끝났다');
  return { errs, id };
}

const state = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id);
  const grips = [...document.querySelectorAll('#ss-handles-overlay .grd-line-grip')].filter(g => getComputedStyle(g).display !== 'none');
  const a = window.grdGetActiveLine?.(b) || null;
  return {
    sel: !!b && b.classList.contains('selected'),
    editing: !!b && b.classList.contains('editing'),
    act: a ? { r: a.r, c: a.c, li: a.li } : null,
    bodyMark: !!b?.querySelector('.tb-bubble.ln-line-selected'),
    rowMarks: b ? [...b.querySelectorAll('.ln-row.ln-line-selected')].map(r => Number(r.dataset.ln)) : [],
    grdMarks: b ? [...b.querySelectorAll('.grd-line-selected')].map(r => Number(r.dataset.line)) : [],
    grips: grips.length,
    lines: b?.dataset.lines ? JSON.parse(b.dataset.lines).length : null,
  };
}, id);

/** 손잡이가 «그 요소의 왼쪽 밖»에 서 있나(그리드 실측 −14,9 와 같은 자리 규칙: overlay-handles.js _updateGridLineGripPosition) */
const gripBeside = (page, sel) => page.evaluate((sel) => {
  const g = document.querySelector('#ss-handles-overlay .grd-line-grip');
  const el = document.querySelector(sel);
  if (!g || !el) return { ok: false, why: !g ? 'grip 없음' : 'el 없음' };
  const gr = g.getBoundingClientRect(), er = el.getBoundingClientRect();
  const cy = gr.top + gr.height / 2;
  return { ok: gr.right <= er.left + 1 && cy >= er.top && cy <= er.bottom, dx: Math.round(gr.left - er.left), gy: Math.round(cy - er.top) };
}, sel);

const menuState = (page) => page.evaluate(() => {
  const m = document.getElementById('block-context-menu');
  const it = document.getElementById('bcm-ln-add');
  const vis = (el) => !!el && getComputedStyle(el).display !== 'none';
  return { open: vis(m), lnAdd: vis(m) && vis(it),
    items: m ? [...m.querySelectorAll(':scope > .bcm-item')].filter(vis).map(x => x.textContent.trim().replace(/\s+/g, ' ')) : [] };
});

async function clickAt(page, sel, opts) { const r = await waitStableRect(page, sel); await page.mouse.click(r.cx, r.cy, opts); await page.waitForTimeout(120); return r; }
async function pressById(page, domId) {
  const r = await waitStableRect(page, '#' + domId);
  await page.mouse.click(r.cx, r.cy);
}
const pressLnAdd = (page) => pressById(page, 'bcm-ln-add');
/** 빈 줄 안내문(::before content) — 주인 클래스 안에 빈 줄을 잠깐 꽂아 계산 스타일을 읽는다(CSS 범위 탐침). */
const placeholderProbe = (page, ownerCls) => page.evaluate((cls) => {
  const inner = document.querySelector('#bG .section-inner');
  const box = document.createElement('div');
  box.innerHTML = cls === 'grid-block'
    ? '<div class="grid-block"><div class="grd-line grd-body"></div></div>'
    : `<div class="${cls}"><div class="ln-row"><div class="grd-line grd-body"></div></div></div>`;
  inner.appendChild(box);
  const v = getComputedStyle(box.querySelector('.grd-line'), '::before').content;
  box.remove();
  return v;
}, ownerCls);
const beforeContent = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map(el => getComputedStyle(el, '::before').content), sel);

/** 말풍선: 첫 클릭 → 둘째 클릭 → 우클릭 → 「아래에 줄 추가」 까지. 돌려주는 값 = 단계별 상태 */
async function bubbleToTwoLines(page, id) {
  const tb = `#${id} .tb-bubble`;
  await clickAt(page, tb);                         // ① 블럭
  const s1 = await state(page, id);
  await clickAt(page, tb);                         // ② 줄
  const s2 = await state(page, id);
  const g2 = await gripBeside(page, tb);
  await clickAt(page, tb, { button: 'right' });    // ③ 우클릭
  const m3 = await menuState(page);
  return { s1, s2, g2, m3 };
}


/** 줄 선택 상태에서 우클릭 메뉴를 닫는다 — 메뉴가 누른 점에 서므로 바깥 클릭(문서 click 닫기 리스너)으로 닫는다. */
async function closeMenu(page) {
  await page.evaluate(() => document.body.click());
  await waitFor(page, () => getComputedStyle(document.getElementById('block-context-menu')).display === 'none', undefined, '메뉴가 안 닫혔다');
}
const shadowOf = (page, id) => page.evaluate((id) => getComputedStyle(document.querySelector(`#${id} .tb-bubble`)).boxShadow, id);

/* ═══════════════ N — 새 동작 (바닥 판 빨강) ═══════════════ */

test('N1 ⒝ 말풍선 — 첫 클릭 = 블럭 · 둘째 클릭 = 본문 줄 선택(표시 = 줄 선택과 같은 inset 막대) ＋ 왼쪽 손잡이', async ({ page }) => {
  const { errs, id } = await setup(page);
  const sh0 = await shadowOf(page, id);
  const { s1, s2, g2 } = await bubbleToTwoLines(page, id);
  const sh2 = await shadowOf(page, id);
  console.log('    N1 ' + JSON.stringify({ s1, s2, g2, sh0, sh2 }));
  expect(s1.sel, '① 첫 클릭 = 블럭 선택').toBe(true);
  expect(s1.bodyMark || s1.rowMarks.length > 0, '① 첫 클릭엔 줄 선택 표시가 없다').toBe(false);
  expect(s1.grips, '① 첫 클릭엔 손잡이가 없다').toBe(0);
  expect(s2.bodyMark, '② 둘째 클릭 = 본문 줄에 줄 선택 표시(.tb-bubble.ln-line-selected)').toBe(true);
  expect(s2.act, '② 활성 줄 = 가상 본문 줄 {0,0,0}').toEqual({ r: 0, c: 0, li: 0 });
  expect(s2.grips, '② 손잡이 하나').toBe(1);
  expect(g2.ok, `② 손잡이가 본문 왼쪽 밖·세로 안쪽 ${JSON.stringify(g2)}`).toBe(true);
  expect(s2.lines, '② 고르기만 했다 — 줄 모드로 굽지 않는다(dataset.lines 없음)').toBeNull();
  expect(sh2, '② 본문 줄 표시 = inset 막대(계산 스타일)').toMatch(/inset/);
  expect(sh2, '② 표시가 고르기 전과 달라졌다').not.toBe(sh0);
  expect(errs).toEqual([]);
});

test('N2 ⒞⒠ 말풍선 — 줄 선택 상태 우클릭 「아래에 줄 추가」 → 줄 +1 · 새 줄 안내문 = 말풍선 문구 · 줄 모드에서도 다시 된다', async ({ page }) => {
  const { errs, id } = await setup(page);
  const { m3 } = await bubbleToTwoLines(page, id);
  expect(m3.lnAdd, `③ 우클릭 메뉴에 「아래에 줄 추가」가 보인다 ${JSON.stringify(m3.items)}`).toBe(true);
  await pressLnAdd(page);
  await waitFor(page, (id) => !!document.getElementById(id)?.dataset.lines, id, '「아래에 줄 추가」를 눌렀는데 줄이 안 생겼다');
  const s4 = await state(page, id);
  const ph = await page.evaluate((id) => document.querySelector(`#${id} .tb-bubble`)?.dataset.placeholder, id);
  const bc = await beforeContent(page, `#${id} .ln-row > .grd-line`);
  const g4 = await gripBeside(page, `#${id} .ln-row[data-ln="1"]`);
  console.log('    N2 ' + JSON.stringify({ s4, ph, bc, g4 }));
  expect(s4.lines, '④ 본문(가상 줄 1개) → 줄 2개 = +1').toBe(2);
  expect(s4.act, '④ 새 줄이 골라진다').toEqual({ r: 0, c: 0, li: 1 });
  expect(s4.rowMarks).toEqual([1]);
  expect(s4.grips).toBe(1);
  expect(g4.ok, `④ 손잡이가 새 줄 왼쪽 ${JSON.stringify(g4)}`).toBe(true);
  expect(ph, '전제 — 말풍선 안내문').toBe(PH);
  expect(bc, '⑤ 두 빈 줄 모두 말풍선 안내문(「글자를 입력하세요」가 아니다)').toEqual([`"${PH}"`, `"${PH}"`]);
  expect((await menuState(page)).open, '메뉴는 닫혔다').toBe(false);
  await clickAt(page, `#${id} .ln-row[data-ln="0"]`);
  await clickAt(page, `#${id} .ln-row[data-ln="0"]`, { button: 'right' });
  expect((await menuState(page)).lnAdd, '줄 모드 말풍선의 줄 위 우클릭에도 보인다').toBe(true);
  await pressLnAdd(page);
  await waitFor(page, (id) => JSON.parse(document.getElementById(id).dataset.lines).length === 3, id, '둘째 추가가 안 됐다');
  expect((await state(page, id)).act, '누른 줄(0) 다음 = 1').toEqual({ r: 0, c: 0, li: 1 });
  expect(errs).toEqual([]);
});

test('N3 말풍선 — ⌘Z 한 번 = 추가 전(줄 없음·안내문 복귀) · 저장/불러오기 왕복에 줄·안내문 유지 · 선택 표시는 안 샌다', async ({ page }) => {
  const { errs, id } = await setup(page);
  await bubbleToTwoLines(page, id);
  await pressLnAdd(page);
  await waitFor(page, (id) => !!document.getElementById(id)?.dataset.lines, id, '줄 추가가 안 됐다');
  const snap = await page.evaluate(() => window.serializeProject());
  expect(snap.includes('ln-line-selected'), '저장본에 줄 선택 표시가 샜다').toBe(false);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await waitFor(page, (id) => { const b = document.getElementById(id); return !!b && !b.dataset.lines; }, id, '⌘Z 한 번에 줄 추가가 안 되돌아갔다');
  const u = await page.evaluate((id) => { const t = document.querySelector(`#${id} .tb-bubble`); return { ph: t?.dataset.isPlaceholder, txt: t?.innerText }; }, id);
  expect(u, '⌘Z 뒤 = 줄 없는 말풍선 안내문').toEqual({ ph: 'true', txt: PH });
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await waitFor(page, (id) => !!document.getElementById(id)?.dataset.lines, id, '불러온 말풍선에 줄이 없다');
  expect(await page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.lines).length, id)).toBe(2);
  expect(await beforeContent(page, `#${id} .ln-row > .grd-line`)).toEqual([`"${PH}"`, `"${PH}"`]);
  expect(errs).toEqual([]);
});

test('N4 말풍선 본문 줄 — Esc 는 줄 선택만 풀고 · ⌫ 두 걸음(첫 ⌫ = 줄 선택만 · 다음 ⌫ = 블럭 삭제)', async ({ page }) => {
  const { errs, id } = await setup(page);
  const tb = `#${id} .tb-bubble`;
  await clickAt(page, tb); await clickAt(page, tb);
  expect((await state(page, id)).bodyMark, '전제 — 본문 줄 골라짐').toBe(true);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  const sE = await state(page, id);
  expect({ sel: sE.sel, bodyMark: sE.bodyMark, grips: sE.grips }, 'Esc = 줄 선택만 풀림').toEqual({ sel: true, bodyMark: false, grips: 0 });
  await clickAt(page, tb);
  expect((await state(page, id)).bodyMark, '전제 — 다시 본문 줄 골라짐').toBe(true);
  await page.keyboard.press('Backspace'); await page.waitForTimeout(150);
  const sB = await state(page, id);
  expect({ exists: await page.evaluate((id) => !!document.getElementById(id), id), sel: sB.sel, bodyMark: sB.bodyMark, lines: sB.lines },
    '첫 ⌫ = 블럭 그대로 · 줄 선택만 풀림').toEqual({ exists: true, sel: true, bodyMark: false, lines: null });
  await page.keyboard.press('Backspace');
  await waitFor(page, (id) => !document.getElementById(id), id, '둘째 ⌫ 가 블럭을 안 지웠다');
  expect(errs).toEqual([]);
});

test('N5 ⒞ 그리드 — 첫 클릭 블럭 · 둘째 클릭 줄+손잡이 · 우클릭 「아래에 줄 추가」 → 그 줄 다음 +1(T 와 같은 spec) · ⌘Z', async ({ page }) => {
  const { errs, id } = await setup(page, 'grid');
  const l0 = `#${id} [data-r="0"][data-c="0"][data-line="0"]`;
  await clickAt(page, l0);
  const s1 = await state(page, id);
  await clickAt(page, l0);
  const s2 = await state(page, id);
  const g2 = await gripBeside(page, l0);
  await clickAt(page, l0, { button: 'right' });
  const m3 = await menuState(page);
  console.log('    N5 ' + JSON.stringify({ s1, s2, g2, m3 }));
  expect(s1.grdMarks, '① 첫 클릭엔 줄 선택 없음').toEqual([]);
  expect(s2.grdMarks, '② 둘째 클릭 = 그 줄').toEqual([0]);
  expect(s2.grips).toBe(1);
  expect(g2.ok, `② 손잡이 왼쪽 ${JSON.stringify(g2)}`).toBe(true);
  expect(m3.lnAdd, `③ 그리드 우클릭에도 「아래에 줄 추가」 ${JSON.stringify(m3.items)}`).toBe(true);
  await pressLnAdd(page);
  await waitFor(page, (id) => window.getGridModel(document.getElementById(id)).cells[0][0].lines.length === 3, id, '그리드 줄 추가가 안 됐다');
  const after = await page.evaluate((id) => {
    const b = document.getElementById(id);
    return { texts: window.getGridModel(b).cells[0][0].lines.map(l => l.text ?? ''), act: window.grdGetActiveLine(b), font: window.getGridModel(b).cells[0][0].lines[1].fontFamily ?? null };
  }, id);
  const tSpec = await page.evaluate(() => window.grdNewLineSpec?.('body') || null);
  expect(after.texts, '누른 줄(0) 다음에 빈 줄').toEqual(['하나', '', '둘']);
  expect({ r: after.act.r, c: after.act.c, li: after.act.li }).toEqual({ r: 0, c: 0, li: 1 });
  expect(after.font, '새 줄 = T 와 같은 spec(grdNewLineSpec)').toBe(tSpec?.fontFamily ?? null);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await waitFor(page, (id) => window.getGridModel(document.getElementById(id)).cells[0][0].lines.length === 2, id, '⌘Z 한 번에 그리드 줄 추가가 안 되돌아갔다');
  expect(errs).toEqual([]);
});

test('N6 ⒝ 삽입 직후(이미 골라진) 말풍선 — 클릭 1회 = 블럭(줄 아님) · 2회 = 본문 줄', async ({ page }) => {
  const { errs, id } = await setup(page, 'bubble', { keepInsertSelection: true });
  expect((await state(page, id)).sel, '전제 — 삽입 입구가 골랐다(풀지 않음)').toBe(true);
  const tb = `#${id} .tb-bubble`;
  await clickAt(page, tb);
  const s1 = await state(page, id);
  await clickAt(page, tb);
  const s2 = await state(page, id);
  console.log('    N6 ' + JSON.stringify({ s1, s2 }));
  expect({ sel: s1.sel, li: s1.act ? s1.act.li : null, bodyMark: s1.bodyMark, grips: s1.grips }, '① 첫 클릭 = 블럭 그대로(활성 줄 없음)')
    .toEqual({ sel: true, li: null, bodyMark: false, grips: 0 });
  expect({ act: s2.act, bodyMark: s2.bodyMark, grips: s2.grips }, '② 둘째 클릭 = 가상 본문 줄')
    .toEqual({ act: { r: 0, c: 0, li: 0 }, bodyMark: true, grips: 1 });
  expect(errs).toEqual([]);
});

test('N7 본문 줄을 고른 채 캔버스 ＋ → 줄 2개 · 새 줄(li 1)이 골라진 채 표시·손잡이', async ({ page }) => {
  const { errs, id } = await setup(page);
  const tb = `#${id} .tb-bubble`;
  await clickAt(page, tb); await clickAt(page, tb);
  expect((await state(page, id)).bodyMark, '전제 — 본문 줄 골라짐').toBe(true);
  await waitFor(page, (id) => !!document.querySelector(`#grd-plus-layer > .ln-add-btn[data-ln-for="${id}"]`), id, '＋ 가 안 떴다');
  await clickAt(page, `#grd-plus-layer > .ln-add-btn[data-ln-for="${id}"]`);
  await waitFor(page, (id) => !!document.getElementById(id)?.dataset.lines, id, '＋ 가 줄을 안 더했다');
  const s = await state(page, id);
  console.log('    N7 ' + JSON.stringify(s));
  expect({ lines: s.lines, act: s.act, rowMarks: s.rowMarks, grips: s.grips })
    .toEqual({ lines: 2, act: { r: 0, c: 0, li: 1 }, rowMarks: [1], grips: 1 });
  expect(errs).toEqual([]);
});

test('N8 ⒠ 말풍선 «안» 빈 줄 안내문 = 말풍선 문구(계산 스타일)', async ({ page }) => {
  const { errs } = await setup(page);
  expect(await placeholderProbe(page, 'speech-bubble-block')).toBe(`"${PH}"`);
  expect(errs).toEqual([]);
});

test('N9 판정 탐침 — 그리드 우클릭 주소는 «그 그리드»의 줄만(안쪽 그리드 줄은 null)', async ({ page }) => {
  const { errs, id } = await setup(page, 'grid');
  const r = await page.evaluate((outerId) => {
    const outer = document.getElementById(outerId);
    window.selectSection?.(document.getElementById('bG'));
    window.addGridBlock?.();
    const inner = [...document.querySelectorAll('#canvas .grid-block')].find(b => b !== outer);
    window.updateGridBlock(inner.id, { patchCell: { r: 0, c: 0, lines: [{ type: 'body', text: '안' }] } });
    let ch = outer.querySelector(':scope > .grd-children');
    if (!ch) { ch = document.createElement('div'); ch.className = 'grd-children'; outer.appendChild(ch); }
    ch.appendChild(inner.closest('.row') || inner);
    window.deselectAll?.();
    const innerLine = inner.querySelector('[data-r="0"][data-c="0"][data-line="0"]');
    const outerLine = outer.querySelector(':scope > .grd-inner [data-r="0"][data-c="0"][data-line="0"]');
    const fn = typeof window.grdCtxAddAddr === 'function' ? window.grdCtxAddAddr : null;   // ⛔`?? 'nofn'` 금지 — 정답 null 을 덮는다
    return { hasFn: !!fn, nested: outer.contains(innerLine),
      inner: fn ? fn(outer, innerLine) : 'nofn', outer: fn ? fn(outer, outerLine) : 'nofn' };
  }, id);
  console.log('    N9 ' + JSON.stringify(r));
  expect(r.nested, '전제 — 안쪽 그리드가 바깥 그리드 안에 있다').toBe(true);
  expect(r.hasFn, 'grdCtxAddAddr 가 있다').toBe(true);
  expect(r.outer, '바깥 줄 = 그 주소').toEqual({ r: 0, c: 0, li: 0 });
  expect(r.inner, '안쪽 그리드 줄 = null').toBeNull();
  expect(errs).toEqual([]);
});

/* ═══════════════ R — 회귀·지킴 (바닥 판 초록) ═══════════════ */

test('R1 ⒟ 처음부터 더블클릭 = 본문 글자 수정(줄 모드로 안 바뀐다)', async ({ page }) => {
  const { errs, id } = await setup(page);
  const r = await waitStableRect(page, `#${id} .tb-bubble`);
  await page.mouse.dblclick(r.cx, r.cy);
  await waitFor(page, (id) => document.getElementById(id)?.classList.contains('editing'), id, '더블클릭으로 편집에 안 들어갔다');
  const e = await page.evaluate((id) => { const t = document.querySelector(`#${id} .tb-bubble`); return { ce: t.getAttribute('contenteditable'), focus: document.activeElement === t, lines: document.getElementById(id).dataset.lines ?? null }; }, id);
  expect(e, '본문이 편집 중 · 줄 없음').toEqual({ ce: 'true', focus: true, lines: null });
  expect(errs).toEqual([]);
});

test('R2 그리드 — 둘째 클릭으로 고른 줄에서 T = 그 다음에 빈 줄', async ({ page }) => {
  const { errs, id } = await setup(page, 'grid');
  const l1 = `#${id} [data-r="0"][data-c="0"][data-line="1"]`;
  await clickAt(page, l1); await clickAt(page, l1);
  await page.keyboard.press('t');
  await waitFor(page, (id) => window.getGridModel(document.getElementById(id)).cells[0][0].lines.length === 3, id, 'T 가 그리드 줄을 안 더했다');
  expect(await page.evaluate((id) => window.getGridModel(document.getElementById(id)).cells[0][0].lines.map(l => l.text ?? ''), id)).toEqual(['하나', '둘', '']);
  expect(errs).toEqual([]);
});

test('R3 그리드 칸 우클릭 — 기존 「이미지 추가」 그대로', async ({ page }) => {
  const { errs, id } = await setup(page, 'grid');
  await clickAt(page, `#${id} [data-r="0"][data-c="0"][data-line="1"]`, { button: 'right' });
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('bcm-grid-img')).display)).toBe('flex');
  expect(errs).toEqual([]);
});

test('R4 텍스트 블럭 우클릭 — 「줄 추가」 없음', async ({ page }) => {
  const { errs } = await setup(page);
  const tid = await page.evaluate(() => {
    window.deselectAll?.(); window.selectSection?.(document.getElementById('bG')); window.addTextBlock?.('body');
    const t = [...document.querySelectorAll('#canvas .text-block:not(.speech-bubble-block)')].pop(); t.scrollIntoView({ block: 'center' }); return t.id;
  });
  await page.waitForTimeout(200);
  await clickAt(page, `#${tid}`, { button: 'right' });
  const mt = await menuState(page);
  expect(mt.open, '전제 — 메뉴가 열렸다').toBe(true);
  expect(mt.lnAdd, `텍스트 블럭엔 「줄 추가」 없음 ${JSON.stringify(mt.items)}`).toBe(false);
  expect(errs).toEqual([]);
});

test('R5 ⒠ 범위 — 챗(공용 줄)·그리드 빈 줄 안내문 무변', async ({ page }) => {
  const { errs } = await setup(page);
  expect(await placeholderProbe(page, 'chat-block')).toBe('"글자를 입력하세요"');
  expect(await placeholderProbe(page, 'grid-block')).toBe('"본문을 입력하세요"');
  expect(errs).toEqual([]);
});

test('R6 ⒜ 지킴 — 말풍선을 두 번 클릭한 상태의 ⌘X = 블럭 잘라내기(줄로 안 삼킨다)', async ({ page }) => {
  const { errs, id } = await setup(page);
  const tb = `#${id} .tb-bubble`;
  await clickAt(page, tb); await clickAt(page, tb);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+x');
  await waitFor(page, (id) => !document.getElementById(id), id, '⌘X 가 말풍선 블럭을 안 잘랐다');
  expect(errs).toEqual([]);
});

test('R7 ⒜ 지킴 — 말풍선을 두 번 클릭한 상태의 ⌘↑/⌘↓ = 블럭 이동(줄로 안 삼킨다)', async ({ page }) => {
  const { errs, id } = await setup(page);
  const tid = await page.evaluate((id) => {
    window.deselectAll?.(); window.selectSection?.(document.getElementById('bG')); window.addTextBlock?.('body');
    const t = [...document.querySelectorAll('#canvas .text-block:not(.speech-bubble-block)')].pop();
    /* 글 블럭을 말풍선 «앞»에 둔다(섹션 직속 단위끼리) */
    const unit = (el) => { let u = el; while (u.parentElement && !u.parentElement.classList.contains('section-inner')) u = u.parentElement; return u; };
    const ub = unit(document.getElementById(id)), ut = unit(t);
    ub.parentElement.insertBefore(ut, ub);
    window.deselectAll?.(); document.getElementById(id).scrollIntoView({ block: 'center' });
    return t.id;
  }, id);
  await page.waitForTimeout(200);
  const order = () => page.evaluate(({ id, tid }) => (document.getElementById(tid).compareDocumentPosition(document.getElementById(id)) & Node.DOCUMENT_POSITION_FOLLOWING) ? 'text>bubble' : 'bubble>text', { id, tid });
  expect(await order(), '전제 — 글 블럭이 먼저').toBe('text>bubble');
  const tb = `#${id} .tb-bubble`;
  await clickAt(page, tb); await clickAt(page, tb);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+ArrowUp');
  await expect.poll(order, { message: '⌘↑ 가 말풍선 블럭을 안 옮겼다' }).toBe('bubble>text');
  await page.keyboard.press('Meta+ArrowDown');
  await expect.poll(order, { message: '⌘↓ 가 말풍선 블럭을 안 옮겼다' }).toBe('text>bubble');
  expect(errs).toEqual([]);
});

test('R8 ⒞ 지킴 — 그리드 중첩(duo) «안» 줄 우클릭엔 「줄 추가」가 없다(그 줄을 고른 T 도 무동작 — 같은 판정)', async ({ page }) => {
  const { errs, id } = await setup(page, 'grid');
  const l0 = `#${id} [data-r="0"][data-c="0"][data-line="0"]`;
  await clickAt(page, l0, { button: 'right' });
  await pressById(page, 'bcm-grid-nested');
  const inner = `#${id} [data-nroot][data-npath]`;
  await waitFor(page, (id) => !!document.querySelector(`#${id} [data-nroot][data-npath]`), id, '전제 — 중첩 줄이 안 생겼다');
  const n0 = await page.evaluate((id) => window.getGridModel(document.getElementById(id)).cells[0][0].lines.length, id);
  await clickAt(page, inner, { button: 'right' });
  const m = await menuState(page);
  console.log('    R8 ' + JSON.stringify(m));
  expect(m.open, '전제 — 메뉴가 열렸다').toBe(true);
  expect(m.lnAdd, `중첩 안 줄 우클릭엔 「줄 추가」 없음 ${JSON.stringify(m.items)}`).toBe(false);
  await closeMenu(page);
  await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
  await clickAt(page, inner); await clickAt(page, inner);
  await page.keyboard.press('t'); await page.waitForTimeout(200);
  expect(await page.evaluate((id) => window.getGridModel(document.getElementById(id)).cells[0][0].lines.length, id), '중첩 줄을 고른 T = 무동작').toBe(n0);
  expect(errs).toEqual([]);
});
