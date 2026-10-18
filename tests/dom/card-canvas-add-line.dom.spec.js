/* card-canvas-add-line.dom.spec.js — 카드 블럭 캔버스 ＋ 로 «빈 줄»(설명/제목) 추가 (1012t1K1 · 안 ㉠)
 *                                    ＋ 열·행 «성장» ＋ (1017t1d3 — B1~B6, 아래)
 *
 * ★재현(고치기 전): 제목만 있는 기본 카드는 .cvb-card-desc 요소가 «안 그려져» 캔버스에서 설명을 쓸 곳이 없었다
 *   (우측 패널 textarea 만 길). ＋ 는 블럭 밖 층 #cvb-plus-layer 에, 골라져 있을 때만, 빈 줄마다 하나.
 * ★누르기는 진짜 마우스(page.mouse.click) — 누르는 점이 ＋ 위인지 elementFromPoint 로 먼저 단언한다.
 * ⛔고정 대기(waitForTimeout) 없음 — waitForFunction 으로 «무엇을» 기다리는지 쓴다(dom-fixed-wait-census).
 *
 * ★261018 — B1~B6(열·행 성장 ＋)은 ★★작성 시점에 «안 돌렸다»(이 맥 swap 95%+ ⇒ Playwright 금지 — 지디 지시).
 *   처음 돌리는 사람이 ★초록/빨강을 결과에 먼저 적어라. 선례: grid-block.js _makeGridAddBtn/_placeGridAddBtns/
 *   gridAddAtEnd(:4160,4143,4085) — 카드 쪽 짝은 js/blocks/canvas-block.js _makeCvbGridAddBtn/
 *   _placeCvbGridAddBtns/_cvbGridAddAtEnd. 상한 4×4 는 canvas-block.js CVB_GRID_MAX_COLS/ROWS(d3 census 재확인
 *   ⒈ — UI 피커 4×4 를 참값으로 지디가 고정). 뮤테이션은 prop-canvas.js insertCanvasGrid 재사용(window 브리지).
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
  /* updateCanvasBlock 래퍼(js/model-update-history.js _scheduleRestamp)가 «rAF 두 번 뒤 매크로태스크»에 꼭대기를 되쓴다.
     그 되쓰기가 ＋ 편집 «중»에 떨어지면 꼭대기에 임시 칸이 찍혀 +1 이 시험 속도 탓으로 생긴다(실측 진단 꼭대기 tempDiv:true).
     ⇒ 그 되쓰기가 «지나간 뒤»를 기다린다(같은 꼴의 예약: rAF·rAF·setTimeout 0 뒤 한 번 더). 사람 손 속도에선 이 창이 안 겹친다. */
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => setTimeout(r, 0), 0)))));
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
  const diag = await page.evaluate((n) => window.historyStack.slice(n - 1).map((e, i, a) => {
    const c = e.canvas || '';
    const m = c.match(/id="cvb_k1"[^>]*/); const tag = m ? m[0] : '';
    return { act: e.action || null, tempDiv: /class="cvb-card-desc"[^>]*><\/div>/.test(c),
      size: (tag.match(/data-title-size="(\d+)"/) || [])[1] || null, hasQ: /&quot;desc&quot;:&quot;Q&quot;/.test(tag),
      sameAsPrev: i > 0 ? c === a[i - 1].canvas : null, len: c.length };
  }), len0);
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

/* ══ [1017t1d3] 열·행 성장 ＋ ══════════════════════════════════════════════════════════
 * ★현빈 1017t1d3 GO — 그리드블럭(G15)처럼 캔버스 우측(열)·하단(행)에 「진짜 늘리는」 ＋ 를 새로 둔다.
 *   클래스는 `.cvb-grid-add-btn`(위 .cvb-add-btn 「빈칸 채우기」와 다른 클래스 — d3 재확인 ⒉). */
const gridPlusSel = (id, axis) => `#cvb-plus-layer > .cvb-grid-add-btn[data-cvb-grid-for="${id}"][data-cvb-grid-add="${axis}"]`;
const gridDims = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id);
  return { cols: parseInt(b.dataset.gridCols) || 1, rows: parseInt(b.dataset.gridRows) || 1, nCards: JSON.parse(b.dataset.cards || '[]').length };
}, id);

async function gridPlusGeom(page, id, axis) {
  return page.evaluate(([id, s]) => {
    const b = document.querySelector(s);
    if (!b) return null;
    const r = b.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const br = document.getElementById(id).getBoundingClientRect();
    return { cx, cy, hitIsBtn: hit === b, disabled: b.disabled, title: b.title, blockRight: br.right, blockBottom: br.bottom, blockMidY: (br.top + br.bottom) / 2, blockMidX: (br.left + br.right) / 2 };
  }, [id, gridPlusSel(id, axis)]);
}

async function clickGridPlus(page, id, axis) {
  const g = await gridPlusGeom(page, id, axis);
  expect(g, `전제 — ${axis} 성장 ＋ 가 문서에 있다`).toBeTruthy();
  expect(g.hitIsBtn, '전제 — 누르는 점이 ＋ 위다').toBe(true);
  await page.mouse.click(g.cx, g.cy);
  return g;
}

/* ★1018 B1 빨강에서 찾은 자리 — 고른 뒤엔 패널이 열리며 캔버스 폭·카드 배율이 한동안 바뀐다(위 settled()
 * 머리말과 같은 까닭). select(page,id,0)(빈칸채우기 ＋ 기대 0개)은 expectPlus 가 falsy 라 settled() 호출
 * 자체를 건너뛴다(select() 의 `if (expectPlus) await settled(...)`) — 그래서 B1 은 그 settle 을 «안» 기다리고
 * 있었다. ⇒ 성장 ＋ 자신의 자리가 연속 두 rAF 틱에서 «그대로»일 때까지 따로 기다린다(기대값과 견주지
 * 않는다 — settled() 와 같은 방식, «무엇을» 기다리는지는 안정 수렴이다). */
async function gridSettled(page, id) {
  await page.waitForFunction(() => {
    const bs = [...document.querySelectorAll('#cvb-plus-layer > .cvb-grid-add-btn')];
    if (bs.length < 2) return false;
    const key = bs.map(b => { const r = b.getBoundingClientRect(); return `${Math.round(r.left)},${Math.round(r.top)}`; }).join('|');
    const prev = window.__gridK1Prev; window.__gridK1Prev = key;
    return key === prev;
  }, null, { polling: 'raf', timeout: 8000 });
}

test('B1 카드를 고르면 열·행 성장 ＋ 가 각 1개 — 열=블럭 우측 세로가운데 · 행=블럭 하단 가로가운데(빈칸 없는 카드 — 비킴 없는 «순수» 자리)', async ({ page }) => {
  // ★1018 수정 — title·desc 둘 다 채운 카드를 쓴다(빈칸채우기 ＋ 가 안 떠서 비킴 로직이 안 걸린다).
  //   순수 자리(그리드 선례와 같은 식)는 이 조건에서만 성립 — 비킴이 걸리는 경우는 B1b가 잰다.
  const { id } = await setup(page, { cards: [{ title: '제목', desc: '설명', imgSrc: '', cellBg: '' }] });
  expect(await page.evaluate((s) => document.querySelectorAll(s).length, '#cvb-plus-layer > .cvb-grid-add-btn'), '고르기 전엔 0').toBe(0);
  await select(page, id, 0);   // 빈칸채우기 ＋ 기대 0개(둘 다 채운 카드라 안 뜬다)
  await page.waitForFunction((s) => document.querySelectorAll(s).length === 2, '#cvb-plus-layer > .cvb-grid-add-btn');
  expect(await page.evaluate(() => document.querySelectorAll('.cvb-add-btn').length), '전제 — 빈칸채우기 ＋ 는 0개(둘 다 채운 카드)').toBe(0);
  // ★1018 — select(page,id,0) 은 settled() 를 안 기다린다(expectPlus falsy). 패널이 열리며 캔버스 폭·배율이
  //   한동안 바뀌므로 성장 ＋ 자신의 자리가 안정될 때까지 따로 기다린다(열 쪽 19.65px 빨강의 진짜 원인 —
  //   CSS 확인 결과 열 ＋ 는 row 처럼 반쪽 중심정렬이 아니라 translate(-50%,-50%) 완전 중심정렬이라, +20
  //   류 보정은 틀린 처방이었다. 안정 대기가 맞는 처방).
  await gridSettled(page, id);
  const col = await gridPlusGeom(page, id, 'col'), row = await gridPlusGeom(page, id, 'row');
  expect(col.title).toBe('열 추가');
  expect(row.title).toBe('행 추가');
  expect(Math.abs(col.cx - col.blockRight)).toBeLessThan(2);
  expect(Math.abs(col.cy - col.blockMidY)).toBeLessThan(2);
  expect(Math.abs(row.cy - row.blockBottom - 20)).toBeLessThan(2);   // ★행 ＋ 는 translateX(-50%) 뿐(수직 중앙정렬 없음) — 중심은 바닥에서 반 지름(20px) 아래(연산순서 조심 — cy-(bottom+20))
  expect(Math.abs(row.cx - row.blockMidX)).toBeLessThan(2);
  expect(col.hitIsBtn).toBe(true);
  expect(row.hitIsBtn).toBe(true);
});

test('B1b 회귀 — 기본 카드(빈칸채우기 ＋ 1개)에서도 행 성장 ＋ 가 그 위에 안 덮인다(1018 버그의 그 자리)', async ({ page }) => {
  // ★1018 버그 재현 조건 그대로: gridCols=1·gridRows=1·카드 하나·desc 빔(기본 setup()) — 카드 중심=블럭
  //   중심이고 labelPos='bottom'(기본)이라 텍스트 영역 바닥=블럭 바닥 ⇒ 비킴 없으면 행 ＋ 가 겹쳐 덮는다.
  const { id } = await setup(page);
  await select(page, id, 1);   // 빈칸채우기 ＋ 1개(전제) — A1~A4b·A8 이 실제로 재는 그 자리
  await page.waitForFunction((s) => document.querySelectorAll(s).length === 2, '#cvb-plus-layer > .cvb-grid-add-btn');
  const fill = await plusGeom(page, id);
  const row = await gridPlusGeom(page, id, 'row');
  // ★둘이 실제로 떨어져 있는지도 수로 — «우연히 안 겹쳤다»가 아니라 비킴이 작동했음을 잰다
  const dx = Math.abs(fill.cx - row.cx), dy = Math.abs(fill.cy - row.cy);
  // ★261018(지디·태양 지적) — ★통과해도 값이 로그에 남아야 한다(「단언에 잰 값을 찍어라」). 실패 메시지
  //   «안에만» 값이 있으면 통과 회차엔 그 수가 사라진다 — 사람이 따로 재는 자는 다음 회차에 없어진다.
  console.log(`[B1b] dx=${dx} dy=${dy} · fillHit=${fill.hitIsPlus} growHit=${row.hitIsBtn}`);
  expect(fill.hitIsPlus, '★빈칸채우기 ＋ 가 여전히 누를 수 있다(행 성장 ＋ 에 안 덮인다)').toBe(true);
  expect(row.hitIsBtn, '★행 성장 ＋ 도 누를 수 있다').toBe(true);
  // ⛔`dx>=40 || dy>=40`(불값만)을 `Math.max(dx,dy)>=40`(수)로 — 뜻은 같다(둘 중 하나라도 40 이상이면 참:
  //   max 가 40 이상 ⇔ dx 나 dy 중 적어도 하나가 40 이상). 이러면 실패 메시지·단언 자체에 값이 남는다.
  expect(Math.max(dx, dy), `비킴 — 두 ＋ 가 40px 이상 떨어져야 한다(dx=${dx} dy=${dy})`).toBeGreaterThanOrEqual(40);
  // ⚠️261018 — 이 검사는 ★행★ 성장 ＋ 만 잰다. ★열 성장 ＋(블럭 우측)가 빈칸채우기 ＋ 와 같은 식으로
  //   겹칠 수 있는지는 ★미측정이다(기하적으로 더 드문 조건으로 보이지만 그건 추론이고, 수로 재지 않았다
  //   — 「낮은 확률」을 「문제 없다」로 적지 않는다). 다음 사람의 출발선: 열 쪽도 이 B1b 와 같은 틀로
  //   (fill vs col 의 dx/dy ≥40) 재는 케이스를 추가할 것.
});

test('B2 열 ＋ 클릭 → gridCols 1→2 · cards 1→2(기본값) · 블럭 폭 모드가 100%로 전환(gridCols===1 분기)', async ({ page }) => {
  const { id } = await setup(page);
  await select(page, id, 1);
  await page.waitForFunction((s) => document.querySelectorAll(s).length === 2, '#cvb-plus-layer > .cvb-grid-add-btn');
  const before = await gridDims(page, id);
  expect(before).toEqual({ cols: 1, rows: 1, nCards: 1 });
  const widthBefore = await page.evaluate((id) => document.getElementById(id).style.width, id);
  expect(widthBefore, '전제 — 1열일 땐 고정 px 폭(canvas-block.js renderCanvas gridCols===1 분기)').toMatch(/px$/);
  await clickGridPlus(page, id, 'col');
  await page.waitForFunction((id) => (parseInt(document.getElementById(id).dataset.gridCols) || 1) === 2, id);
  const after = await gridDims(page, id);
  expect(after).toEqual({ cols: 2, rows: 1, nCards: 2 });
  const widthAfter = await page.evaluate((id) => document.getElementById(id).style.width, id);
  expect(widthAfter, '★⒊ 재확인 — cols 1→2 전환이 완전 재렌더를 타 폭 모드가 100%로 바뀐다(부분패치 지름길이면 여기서 안 바뀐 채 남는다)').toBe('100%');
  const newCard = (await cards(page, id))[1];
  expect(newCard).toEqual({ title: '카드 제목', desc: '', imgSrc: '', cellBg: '' });
});

test('B3 행 ＋ 클릭 → gridRows 1→2 · cards 1→2(기본값) · 열 그대로', async ({ page }) => {
  const { id } = await setup(page);
  await select(page, id, 1);
  await page.waitForFunction((s) => document.querySelectorAll(s).length === 2, '#cvb-plus-layer > .cvb-grid-add-btn');
  await clickGridPlus(page, id, 'row');
  await page.waitForFunction((id) => (parseInt(document.getElementById(id).dataset.gridRows) || 1) === 2, id);
  expect(await gridDims(page, id)).toEqual({ cols: 1, rows: 2, nCards: 2 });
});

test('B4 상한(4×4)에서는 disabled — 눌러도 안 늘어난다', async ({ page }) => {
  const { id } = await setup(page);
  await page.evaluate((id) => { window.insertCanvasGrid(document.getElementById(id), 4, 1); }, id);   // 패널 피커와 같은 길로 열 4까지 미리 올린다
  // ★1018 수정 — insertCanvasGrid 가 늘린 3장도 똑같이 desc='' 기본값이라(prop-canvas.js:349) 빈칸채우기 ＋ 는
  //   1개가 아니라 4개(카드마다 하나)가 뜬다. select() 의 전제 수를 그 실제 수로 맞춘다(짐작 1 은 틀린 전제였다).
  await select(page, id, 4);
  await page.waitForFunction((s) => document.querySelectorAll(s).length === 2, '#cvb-plus-layer > .cvb-grid-add-btn');
  const col = await gridPlusGeom(page, id, 'col');
  expect(col.disabled, '열 4 = 상한 — disabled').toBe(true);
  await page.mouse.click(col.cx, col.cy);   // disabled 버튼 위 클릭 — 브라우저가 click 이벤트 자체를 안 보낸다
  const after = await gridDims(page, id);
  expect(after.cols, '눌러도 4 그대로').toBe(4);
});

test('B5 ⌘Z 한 번 = 열 추가 전으로 — pushHistory 전/후 두 호출이 두 칸을 안 먹는다(d3 재확인 ⒉ 무변화중복차단)', async ({ page }) => {
  const { id } = await setup(page);
  await select(page, id, 1);
  await page.waitForFunction((s) => document.querySelectorAll(s).length === 2, '#cvb-plus-layer > .cvb-grid-add-btn');
  await clickGridPlus(page, id, 'col');
  await page.waitForFunction((id) => (parseInt(document.getElementById(id).dataset.gridCols) || 1) === 2, id);
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
  await page.waitForFunction((id) => (parseInt(document.getElementById(id).dataset.gridCols) || 1) === 1, id, { timeout: 3000 });
  expect((await gridDims(page, id)).cols, '한 번으로 충분 — 두 번째 ⌘Z 가 더 되돌릴 게 없어야 다음 단언이 참').toBe(1);
});

test('B6 성장 ＋ 도 블럭 DOM·글자·#canvas 에 새지 않는다(A5 와 같은 단언 — 새 클래스 짝)', async ({ page }) => {
  const { id } = await setup(page);
  await select(page, id, 1);
  await page.waitForFunction((s) => document.querySelectorAll(s).length === 2, '#cvb-plus-layer > .cvb-grid-add-btn');
  const r = await page.evaluate((id) => {
    const b = document.getElementById(id), c = document.getElementById('canvas');
    return { inBlock: b.outerHTML.includes('cvb-grid-add-btn'), inCanvas: c.innerHTML.includes('cvb-grid-add-btn'),
      plusInText: b.innerText.includes('+') || b.innerText.includes('＋'),
      layerParent: document.getElementById('cvb-plus-layer')?.parentElement?.id };
  }, id);
  expect(r).toEqual({ inBlock: false, inCanvas: false, plusInText: false, layerParent: 'canvas-scaler' });
});
