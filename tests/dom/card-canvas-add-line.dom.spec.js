/* card-canvas-add-line.dom.spec.js — 카드 블럭 캔버스 ＋ 로 «빈 줄»(설명/제목) 추가 (1012t1K1 · 안 ㉠)
 *
 * ★재현(고치기 전): 제목만 있는 기본 카드는 .cvb-card-desc 요소가 «안 그려져» 캔버스에서 설명을 쓸 곳이 없었다
 *   (우측 패널 textarea 만 길). ＋ 는 블럭 밖 층 #cvb-plus-layer 에, 골라져 있을 때만, 빈 줄마다 하나.
 * ★누르기는 진짜 마우스(page.mouse.click) — 누르는 점이 ＋ 위인지 elementFromPoint 로 먼저 단언한다.
 * ⛔고정 대기(waitForTimeout) 없음 — waitForFunction 으로 «무엇을» 기다리는지 쓴다(dom-fixed-wait-census).
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp } = require('./_root-harness.js');

const SEC = `<div class="section-block" id="sK" data-section="1" data-name="sK"><div class="section-hitzone"></div><div class="section-inner" id="innerK">
  <div class="gap-block" data-type="gap" style="height:60px"></div>
  <div id="slotK"></div>
  <div class="gap-block" data-type="gap" id="gapBelow" style="height:240px"></div></div></div>`;

async function setup(page, opts = {}, html = null) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate(([sec, o, h]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', sec);
    let block;
    if (h) {
      const tmp = document.createElement('div'); tmp.innerHTML = h;
      block = tmp.firstElementChild; block.id = 'cvb_old';
      const row = document.createElement('div'); row.className = 'row'; row.dataset.layout = 'stack'; row.appendChild(block);
      document.getElementById('slotK').replaceWith(row);
    } else {
      const made = window.makeCanvasBlock({ cardMode: 'simple', ...o });
      block = made.block; block.id = 'cvb_k1';
      document.getElementById('slotK').replaceWith(made.row);
    }
    window.applyZoom?.(100);
    window.rebindAll?.(); window.deselectAll?.();
    window.renderCanvas(block);
    block.scrollIntoView({ block: 'center' });
    return block.id;
  }, [SEC, opts, html]);
  await page.waitForFunction((id) => !!document.querySelector(`#${id} .cvb-card-title, #${id} .cvb-card-desc`), id);
  expect(await page.evaluate(() => window.currentZoom), '전제 — 배율 100%').toBe(100);
  return { id, errs };
}

const plusSel = (id) => `#cvb-plus-layer > .cvb-add-btn[data-cvb-for="${id}"]`;
const plusCount = (page, id) => page.evaluate((s) => document.querySelectorAll(s).length, plusSel(id));
const cards = (page, id) => page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.cards || '[]'), id);

/* 진짜 클릭으로 고른다 — 이미지 영역 가운데(＋ 와 안 겹치는 자리) */
async function select(page, id, expectPlus) {
  const [x, y] = await page.evaluate((id) => {
    const b = document.getElementById(id), r = b.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height * 0.3];
  }, id);
  await page.mouse.click(x, y);
  await page.waitForFunction(([id, s, n]) => document.getElementById(id).classList.contains('selected')
    && document.querySelectorAll(s).length === n, [id, plusSel(id), expectPlus], { timeout: 4000 });
  if (expectPlus) await settled(page, id);
}

/* 고른 뒤엔 패널이 열리며 캔버스 폭·카드 배율이 한동안 바뀐다 → ＋ 는 rAF 로 따라간다.
   «＋ 중심 = 영역 아래 변 가운데»가 연속 두 번(값 그대로) 성립할 때까지 기다린다 — 고정 대기 대신 «무엇을» 기다리나. */
async function settled(page, id) {
  await page.waitForFunction(([id, s]) => {
    const bs = [...document.querySelectorAll(s)];
    if (!bs.length) return false;
    const key = bs.map(b => {
      const r = b.getBoundingClientRect();
      const txt = [...document.getElementById(id).querySelectorAll('.cvb-card-title, .cvb-card-desc')]
        .find(e => e.dataset.cardIdx === b.dataset.cvbIdx && (e.dataset.slot || '') === b.dataset.cvbSlot);
      if (!txt) return 'x';
      const a = txt.parentElement.getBoundingClientRect();
      const ok = Math.abs(r.top + r.height / 2 - a.bottom) < 2 && Math.abs(r.left + r.width / 2 - (a.left + a.right) / 2) < 2;
      return ok ? `${Math.round(r.left)},${Math.round(r.top)}` : 'x';
    }).join('|');
    const prev = window.__k1Prev; window.__k1Prev = key;
    return !key.includes('x') && key === prev;
  }, [id, plusSel(id)], { polling: 'raf', timeout: 8000 });
}

/* ＋ 의 중심 · 그 점에서 잡히는 것 · 그 ＋ 가 가리키는 텍스트 영역(같은 카드·같은 슬롯의 글자 요소 부모)의 아래 변 */
const plusGeom = (page, id, i = 0) => page.evaluate(([id, s, i]) => {
  const b = document.querySelectorAll(s)[i]; const r = b.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const hit = document.elementFromPoint(cx, cy);
  const slot = b.dataset.cvbSlot;
  const txt = [...document.getElementById(id).querySelectorAll('.cvb-card-title, .cvb-card-desc')]
    .find(e => e.dataset.cardIdx === b.dataset.cvbIdx && (e.dataset.slot || '') === slot);
  const ar = txt.parentElement.getBoundingClientRect();
  return { cx, cy, hitIsPlus: hit === b, areaBottom: ar.bottom, areaCx: (ar.left + ar.right) / 2,
    field: b.dataset.cvbField, slot, idx: b.dataset.cvbIdx, title: b.title, text: b.textContent };
}, [id, plusSel(id), i]);

async function clickPlus(page, id, i = 0) {
  const g = await plusGeom(page, id, i);
  expect(g.hitIsPlus, '전제 — 누르는 점이 ＋ 위다').toBe(true);
  await page.mouse.click(g.cx, g.cy);
  return g;
}

test('A1 기본 카드(제목만)를 고르면 ＋ 1개 — 텍스트 영역 아래 변 가운데', async ({ page }) => {
  const { id } = await setup(page);
  expect((await cards(page, id))[0].desc, '전제 — 설명이 비어 있다').toBe('');
  expect(await plusCount(page, id), '고르기 전엔 ＋ 0').toBe(0);
  await select(page, id, 1);
  expect(await page.evaluate((id) => document.querySelectorAll(`#${id}.selected`).length, id)).toBe(1);
  const g = await plusGeom(page, id);
  expect(g.field).toBe('desc');
  expect(g.title).toBe('줄 추가 (설명)');
  expect(g.text, '글리프는 CSS ::before — 글자 노드 없음').toBe('');
  expect(Math.abs(g.cy - g.areaBottom)).toBeLessThan(2);
  expect(Math.abs(g.cx - g.areaCx)).toBeLessThan(2);
  expect(g.hitIsPlus).toBe(true);
});

test('A2 ＋ 클릭 → 설명 칸이 열리고 → 입력 → Escape 로 커밋: cards[0].desc 저장 · 다시 골라도 ＋ 0', async ({ page }) => {
  const { id, errs } = await setup(page);
  await select(page, id, 1);
  await clickPlus(page, id);
  await page.waitForFunction(() => document.activeElement?.classList?.contains('cvb-card-desc'));
  const ae = await page.evaluate(() => ({ ce: document.activeElement.contentEditable, field: document.activeElement.dataset.field }));
  expect(ae).toEqual({ ce: 'true', field: 'desc' });
  expect(await plusCount(page, id), '편집 중엔 ＋ 를 걷는다').toBe(0);
  await page.keyboard.insertText('설명');
  await page.keyboard.press('Escape');
  await page.waitForFunction((id) => JSON.parse(document.getElementById(id).dataset.cards)[0].desc === '설명', id);
  expect((await cards(page, id))[0].title).toBe('카드 제목');
  expect(await page.evaluate((id) => document.querySelector(`#${id} .cvb-card-desc`)?.textContent, id)).toBe('설명');
  // Esc 는 커밋 뒤 블럭 선택도 푼다(editor.js 전역 Esc — 기존 동작). 다시 골라도 빈 줄이 없으니 ＋ 0.
  await select(page, id, 0);
  expect(await plusCount(page, id)).toBe(0);
  expect(errs).toEqual([]);
});

test('A3 빈 채로 나가면 아무 일도 없다 — cards 바이트 · 히스토리 길이 그대로 · 임시 칸 0 · 다시 고르면 ＋ 1', async ({ page }) => {
  const { id } = await setup(page);
  await select(page, id, 1);
  const before = await page.evaluate((id) => ({ cards: document.getElementById(id).dataset.cards, len: window.getHistoryTip().len }), id);
  await clickPlus(page, id);
  await page.waitForFunction(() => document.activeElement?.classList?.contains('cvb-card-desc'));
  await page.keyboard.press('Escape');
  await page.waitForFunction((id) => !document.getElementById(id).classList.contains('editing') && !document.querySelector('[contenteditable="true"]'), id);
  const after = await page.evaluate((id) => ({ cards: document.getElementById(id).dataset.cards, len: window.getHistoryTip().len,
    desc: document.querySelectorAll(`#${id} .cvb-card-desc`).length }), id);
  expect(after.cards).toBe(before.cards);
  expect(after.len).toBe(before.len);
  expect(after.desc).toBe(0);
  await select(page, id, 1);                          // 다시 고르면 ＋ 가 그대로 있다(빈 줄 그대로)
});

test('A4 ⌘Z 한 번에 설명이 빈다', async ({ page }) => {
  const { id } = await setup(page);
  await select(page, id, 1);
  await clickPlus(page, id);
  await page.waitForFunction(() => document.activeElement?.classList?.contains('cvb-card-desc'));
  await page.keyboard.insertText('설명');
  await page.keyboard.press('Escape');
  await page.waitForFunction((id) => JSON.parse(document.getElementById(id).dataset.cards)[0].desc === '설명', id);
  await page.evaluate(() => window.undo());
  await page.waitForFunction((id) => { const b = document.getElementById(id); return b && JSON.parse(b.dataset.cards)[0].desc === ''; }, id);
  expect((await cards(page, id))[0].title).toBe('카드 제목');
});

/* A4b (이벨 D1 · 2026-10-12) — ＋ 커밋 «한 번» = 히스토리 «한 칸». 두 번째 ⌘Z 는 «직전 변경»으로 간다(빈 걸음 없음).
 *   직전 변경 = 패널 길과 같은 updateCanvasBlock(titleSize 20→30). 커밋은 이벨 재현대로 «바깥 클릭»(blur). ⌘Z 는 진짜 키. */
test('A4b ＋ 커밋 1회 = 히스토리 +1 · 두 번째 ⌘Z 는 직전 변경(제목 크기)을 되돌린다', async ({ page }) => {
  const { id } = await setup(page);
  await select(page, id, 1);
  const pre = await page.evaluate((id) => {
    const r = window.updateCanvasBlock(id, { titleSize: 30 });
    // updateCanvasBlock 은 push-before(바꾸기 «전»만 찍음) — 패널 길은 그 뒤 «끝 표본»을 찍는다(push-after · js/CLAUDE.md 히스토리 규약).
    // 그 끝 표본을 여기서 찍어 «직전 변경이 끝난 상태»를 꼭대기에 둔다. 안 찍으면 이음매 ⑴ 로 +1 이 시험 전제에서 새로 생긴다(실측 [false,false]).
    window.pushHistory('제목 크기');
    return { ok: r.ok, size: document.getElementById(id).dataset.titleSize };
  }, id);
  expect(pre, '전제 — 직전 변경이 들어갔다').toEqual({ ok: true, size: '30' });
  await settled(page, id);
  const len0 = await page.evaluate(() => window.getHistoryTip().len);
  await clickPlus(page, id);
  await page.waitForFunction(() => document.activeElement?.classList?.contains('cvb-card-desc'));
  await page.keyboard.insertText('Q');
  const out = await page.evaluate(() => { const r = document.getElementById('gapBelow').getBoundingClientRect(); return [r.left + 20, r.top + r.height / 2]; });
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, out), '전제 — 바깥 클릭 점은 아래 gap 블럭').toBe('gapBelow');
  await page.mouse.click(out[0], out[1]);
  await page.waitForFunction((id) => JSON.parse(document.getElementById(id).dataset.cards)[0].desc === 'Q', id);
  const len1 = await page.evaluate(() => window.getHistoryTip().len);
  // 진단(빨강일 때 원인을 같이 남긴다): 새로 쌓인 표본마다 «빈 임시 칸»(<div class="cvb-card-desc" …></div>)이 찍혔나
  const diag = await page.evaluate((n) => window.historyStack.slice(n).map(e => /class="cvb-card-desc"[^>]*><\/div>/.test(e.canvas || '')), len0);
  expect(len1 - len0, `＋ 커밋 한 번에 쌓인 히스토리 칸 수 · 새 표본별 빈 임시 칸 찍힘=${JSON.stringify(diag)}`).toBe(1);
  const st = () => page.evaluate((id) => { const b = document.getElementById(id); return b ? { desc: JSON.parse(b.dataset.cards)[0].desc, size: b.dataset.titleSize } : null; }, id);
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(st).toEqual({ desc: '', size: '30' });
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(st, '두 번째 ⌘Z = 직전 변경(제목 크기 30→20)').toEqual({ desc: '', size: '20' });
});

test('A5 ＋ 는 블럭 DOM·글자·#canvas 에 새지 않는다', async ({ page }) => {
  const { id } = await setup(page);
  await select(page, id, 1);
  const r = await page.evaluate((id) => {
    const b = document.getElementById(id), c = document.getElementById('canvas');
    return { inBlock: b.outerHTML.includes('cvb-add-btn'), inCanvas: c.innerHTML.includes('cvb-add-btn') || c.innerHTML.includes('cvb-plus-layer'),
      plusInText: b.innerText.includes('+') || b.innerText.includes('＋'),
      layerParent: document.getElementById('cvb-plus-layer')?.parentElement?.id };
  }, id);
  expect(r).toEqual({ inBlock: false, inCanvas: false, plusInText: false, layerParent: 'canvas-scaler' });
});

test('A6 both 모드 — 위 설명만 비면 top 슬롯 descTop ＋ 하나 → 쓰면 descTop 저장', async ({ page }) => {
  const { id } = await setup(page, { labelPos: 'both', cards: [{ title: '제목', desc: '', descTop: '', descBottom: '아래', imgSrc: '', cellBg: '' }] });
  await select(page, id, 1);
  const g = await plusGeom(page, id);
  expect([g.slot, g.field]).toEqual(['top', 'descTop']);
  await clickPlus(page, id);
  await page.waitForFunction(() => document.activeElement?.dataset?.field === 'descTop');
  await page.keyboard.insertText('위 설명');
  await page.keyboard.press('Escape');
  await page.waitForFunction((id) => JSON.parse(document.getElementById(id).dataset.cards)[0].descTop === '위 설명', id);
  const c = (await cards(page, id))[0];
  expect([c.desc, c.descBottom]).toEqual(['', '아래']);
});

test('A7 선택을 풀면 ＋ 0', async ({ page }) => {
  const { id } = await setup(page);
  await select(page, id, 1);
  await page.evaluate(() => window.deselectAll());
  await page.waitForFunction((s) => document.querySelectorAll(s).length === 0, plusSel(id));
  expect(await plusCount(page, id)).toBe(0);
});

test('A8 옛 카드(저장본 HTML · tpl-pagepad-e81 골든)도 ＋ 로 설명을 쓴다', async ({ page }) => {
  const gold = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'tpl-pagepad-e81-golden.json'), 'utf8'));
  const { id } = await setup(page, {}, gold.card);
  expect(id).toBe('cvb_old');
  await select(page, id, 1);
  await clickPlus(page, id);
  await page.waitForFunction(() => document.activeElement?.classList?.contains('cvb-card-desc'));
  await page.keyboard.insertText('옛 카드 설명');
  await page.keyboard.press('Escape');
  await page.waitForFunction((id) => JSON.parse(document.getElementById(id).dataset.cards)[0].desc === '옛 카드 설명', id);
});

test('A9 회귀 — 진짜 dblclick 제목 편집은 그대로', async ({ page }) => {
  const { id } = await setup(page);
  await select(page, id, 1);
  const t = page.locator(`#${id} .cvb-card-title`);
  await t.dblclick();
  await page.waitForFunction(() => document.activeElement?.classList?.contains('cvb-card-title'));
  await page.keyboard.press('End');
  await page.keyboard.insertText('X');
  await page.keyboard.press('Escape');
  await page.waitForFunction((id) => JSON.parse(document.getElementById(id).dataset.cards)[0].title === '카드 제목X', id);
});
