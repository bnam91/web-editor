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
 *
 * ★★★261019 — ★입구가 ★바뀌었다(현빈: 「그리드블럭에서 줄추가하는 것과 같은 로직이면 될 것 같은데
 *   굳이 (cvb-add-btn) 이거는 필요없지 않겠어?」). ★「빈칸채우기 ＋」(.cvb-add-btn) 단추를 ★없앴고
 *   (canvas-block.js _cvbBlockMounts 의 `const want = [];`), ★그 자리를 ★«빈 칸의 텍스트 영역
 *   더블클릭»이 ★대신한다(_bindCvbDblEdit 의 `if (!hit)` 가지 — 좌표가 _cvbTextArea 사각형 안이면
 *   _cvbBeginAdd). ⇒ ★A 묶음은 ★«그 입구»로 옮겨 ★같은 것을 잰다. ★위 2~8행의 역사 서술은 ★그대로
 *   둔다(그때 잰 것은 그때의 참이다) — ★지금 사실은 ★이 문단이다.
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

const cards = (page, id) => page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.cards || '[]'), id);

/* ══ ★261019 새 입구용 헬퍼 — 옛 plusSel/plusCount/plusGeom/clickPlus 의 자리 ══════════════════
 * ⛔옛 이름을 ★뜻만 갈아 끼워 쓰지 않았다 — 「＋ 개수」라는 이름으로 「빈 칸 개수」를 세면 다음
 *   사람이 틀린다. 이름·뜻을 ★같이 바꾼다(expectPlus → expectEmpty, clickPlus → dblclickEmpty).
 *
 * ★「빈 칸」의 정의 = ★렌더된 DOM «만» 보고 센다: 같은 텍스트 영역(= .cvb-card-title /
 *   .cvb-card-desc 의 ★부모)에 ★둘 중 ★하나만 있는 자리. 제목만 있으면 ★설명 자리가 빈 칸,
 *   설명만 있으면 ★제목 자리가 빈 칸. 둘 다 있으면(또는 둘 다 없어 .cvb-card-ph 가 선 칸이면)
 *   ★빈 칸이 아니다 — 제품의 cvbMissingTextSlots 가 그 둘을 각각 ‘안 센다/[] 로 낸다’와 같은 뜻.
 * ⛔제품의 cvbMissingTextSlots 를 ★불러다 세지 않는다 — 그러면 기대값을 ★피검 대상과 ★같은 자에서
 *   뽑는 ★항등식이 된다. 그 순수 함수 자체는 tests/unit/cvb-card-add-slot.test.mjs 가 따로 잠근다.
 *
 * ★더블클릭 점 = 있는 글자 요소 ★바깥 여백(설명이 비면 글자 ★아래, 제목이 비면 글자 ★위)의 세로
 *   가운데 · 가로는 영역 ★왼쪽 1/4. ⛔★가로 «가운데»를 안 쓴다: ★행 성장 ＋(블럭 바닥 가로 가운데 ·
 *   40px · pointer-events:auto · mousedown/dblclick 을 stopPropagation)가 ★거기 있다. ★그 겹침
 *   자체는 ★B1b 가 따로 잰다 — ★여기서 가운데를 피해 가는 것은 ‘A 묶음은 ★입구 기구를 잰다’는
 *   분업이지 ‘덮임이 없다’는 주장이 ★아니다(그래서 atCenter 를 ★같이 재서 들고 나온다).
 * ★순서 = document 순서(카드 idx 오름차 · 한 카드 안에서는 top 슬롯이 bottom 보다 먼저) —
 *   옛 plusGeom(page,id,i) 의 i 와 ★같은 차례다(_cvbMissingAll 의 순회 순서와 일치). */
const emptyCells = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id);
  const areas = new Map();
  for (const el of b.querySelectorAll('.cvb-card-title, .cvb-card-desc')) {
    const a = el.parentElement;
    if (!areas.has(a)) areas.set(a, { title: null, desc: null });
    areas.get(a)[el.classList.contains('cvb-card-title') ? 'title' : 'desc'] = el;
  }
  const probe = (px, py) => {
    const e = document.elementFromPoint(px, py);
    return { cls: e ? (e.getAttribute('class') || e.tagName) : null,
      // ★더블클릭 리스너는 ★블럭에 걸려 있다(_bindCvbDblEdit) ⇒ 그 점에서 잡히는 것이 블럭(또는 그 후손)이
      //   아니면 ★이벤트가 리스너에 ★안 닿는다. ⛔「글자도 아니고 성장 ＋ 도 아니다」만으로는 못 가린다 —
      //   핸들 오버레이 같은 ★제3의 층이 위에 있으면 조용히 아무 일도 안 일어난다.
      inBlock: !!(e && (e === b || b.contains(e))),
      onGrow: !!(e && e.closest && e.closest('.cvb-grid-add-btn')),
      onText: !!(e && e.closest && e.closest('.cvb-card-title, .cvb-card-desc, .cvb-card-ph')) };
  };
  const out = [];
  for (const [area, rec] of areas) {
    if (!!rec.title === !!rec.desc) continue;                 // 둘 다 있다 ⇒ 빈 칸 아님
    const el = rec.title || rec.desc;
    const missing = rec.title ? 'desc' : 'title';
    const ar = area.getBoundingClientRect(), er = el.getBoundingClientRect();
    const bandTop    = missing === 'desc' ? er.bottom : ar.top;
    const bandBottom = missing === 'desc' ? ar.bottom : er.top;
    const y  = (bandTop + bandBottom) / 2;
    const x  = ar.left + ar.width * 0.25;
    const cx = (ar.left + ar.right) / 2;
    out.push({ idx: el.dataset.cardIdx, slot: el.dataset.slot || '', missing, haveField: el.dataset.field,
      x, y, cx, bandH: bandBottom - bandTop, areaW: ar.width, areaBottom: ar.bottom,
      at: probe(x, y), atCenter: probe(cx, y) });
  }
  return out;
}, id);

const emptyCount = async (page, id) => (await emptyCells(page, id)).length;

/* 진짜 클릭으로 고른다 — 이미지 영역 가운데(글자·성장 ＋ 와 안 겹치는 자리).
 * ★expectEmpty 는 ★기다릴 조건이 ★아니라 ★전제 단언이다: 옛 ＋ 개수는 «고르면 0→N» 이라 기다릴
 *   수 있었지만, ★빈 칸 수는 ★고르기와 무관하게 ★처음부터 참이다(렌더된 데이터의 성질).
 *   ⛔처음부터 참인 것을 waitForFunction 으로 걸면 ★아무것도 안 재는 기다림이 된다. */
async function select(page, id, expectEmpty) {
  const [x, y] = await page.evaluate((id) => {
    const b = document.getElementById(id), r = b.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height * 0.3];
  }, id);
  await page.mouse.click(x, y);
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected'), id, { timeout: 4000 });
  await settled(page, id);
  expect(await emptyCount(page, id), `전제 — 빈 칸 ${expectEmpty}개`).toBe(expectEmpty);
}

/* 고른 뒤엔 패널이 열리며 캔버스 폭·카드 배율이 한동안 바뀐다 → 그 «전»에 더블클릭 점을 재면
   엉뚱한 데를 누른다. ★빈 칸들의 텍스트 영역 사각형이 연속 두 rAF 틱에서 «그대로»일 때까지 기다린다
   (옛 settled() 와 ★같은 방식 — 기대값과 견주지 않고 «안정 수렴»을 기다린다. 고정 대기 아님). */
async function settled(page, id) {
  await page.waitForFunction((id) => {
    const b = document.getElementById(id);
    if (!b) return false;
    const els = [...b.querySelectorAll('.cvb-card-title, .cvb-card-desc')];
    if (!els.length) return false;
    const key = els.map(e => {
      const r = e.parentElement.getBoundingClientRect();
      return `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`;
    }).join('|');
    const prev = window.__k1Prev; window.__k1Prev = key;
    return key === prev;
  }, id, { polling: 'raf', timeout: 8000 });
}

/* 빈 칸 i 번의 여백을 진짜 마우스로 더블클릭한다. ★전제 셋을 먼저 수로 건다:
 *   ㉠ 누를 여백이 ★실제로 있다(띠 높이 > 2) — 0 이면 이 입구는 ★손에 닿지 않는다.
 *   ㉡ 그 점이 ★이미 있는 글자 위가 ★아니다 — 거기면 «글자 편집»으로 새서 새 줄이 안 생긴다.
 *   ㉢ 그 점이 ★성장 ＋ 에 ★안 가린다 — 가리면 더블클릭이 블럭에 ★안 닿는다.
 *   ㉣ 그 점에서 잡히는 것이 ★블럭(또는 후손)이다 — ㉢ 이 못 보는 ★다른 층(핸들 오버레이 등)까지 덮는다. */
async function dblclickEmpty(page, id, i = 0) {
  const cs = await emptyCells(page, id);
  const g = cs[i];
  expect(g, `전제 — 빈 칸 ${i}번이 있다(전체 ${cs.length}개)`).toBeTruthy();
  expect(g.bandH, `전제 — 누를 여백 띠가 있다(글자 ${g.missing === 'desc' ? '아래' : '위'}, 잰 값 ${g.bandH}px)`).toBeGreaterThan(2);
  expect(g.at.onText, `전제 — 누르는 점이 이미 있는 글자 위가 아니다(거기 있는 것=${g.at.cls})`).toBe(false);
  expect(g.at.onGrow, `전제 — 누르는 점이 성장 ＋ 에 안 가린다(거기 있는 것=${g.at.cls})`).toBe(false);
  expect(g.at.inBlock, `전제 — 누르는 점에서 잡히는 것이 블럭(또는 후손)이다 ⇒ dblclick 이 리스너에 닿는다(거기 있는 것=${g.at.cls})`).toBe(true);
  await page.mouse.dblclick(g.x, g.y);
  return g;
}

/* ★261019 — 옛 A1 은 「고르면 ＋ 1개 · 그 ＋ 의 중심이 텍스트 영역 아래 변 가운데」를 잠갔다.
 *   단추가 없어졌으니 ★같은 것(= 입구가 ★있고 · ★어느 필드를 가리키며 · ★손에 닿는다)을 ★새 입구로 잰다.
 *   A2 와 겹치는 것은 「열린다」 한 줄뿐이고, ★A1 만 재는 것은 ★입구의 ★기하 전제(dblclickEmpty 의 ㉠㉡㉢)와
 *   ★빈 칸의 ★정체(몇 개 · 어느 슬롯 · 무엇이 비었나)다. */
test('A1 기본 카드(제목만) — 빈 칸 1개(설명 자리) · 글자 아래 여백 더블클릭이 설명 칸을 연다', async ({ page }) => {
  const { id } = await setup(page);
  expect((await cards(page, id))[0].desc, '전제 — 설명이 비어 있다').toBe('');
  await select(page, id, 1);
  expect(await page.evaluate((id) => document.querySelectorAll(`#${id}.selected`).length, id)).toBe(1);
  const cs = await emptyCells(page, id);
  expect(cs.length).toBe(1);
  expect([cs[0].missing, cs[0].haveField, cs[0].slot], '빈 칸 = 설명 자리(제목만 그려져 있다)').toEqual(['desc', 'title', '']);
  const g = await dblclickEmpty(page, id);
  // ★통과 회차에도 수가 남아야 한다(「단언에 잰 값을 찍어라」) — atCenter 는 B1b 가 단언으로 잠근다.
  console.log(`[A1] bandH=${g.bandH} x=${g.x} y=${g.y} areaW=${g.areaW} at=${g.at.cls} atCenter=${g.atCenter.cls}`);
  await page.waitForFunction(() => document.activeElement?.classList?.contains('cvb-card-desc'));
  expect(await page.evaluate(() => document.activeElement.dataset.field), '열린 칸이 설명(desc)이다').toBe('desc');
});

test('A2 빈 칸 더블클릭 → 설명 칸이 열리고 → 입력 → Escape 로 커밋: cards[0].desc 저장 · 다시 봐도 빈 칸 0', async ({ page }) => {
  const { id, errs } = await setup(page);
  await select(page, id, 1);
  await dblclickEmpty(page, id);
  await page.waitForFunction(() => document.activeElement?.classList?.contains('cvb-card-desc'));
  const ae = await page.evaluate(() => ({ ce: document.activeElement.contentEditable, field: document.activeElement.dataset.field }));
  expect(ae).toEqual({ ce: 'true', field: 'desc' });
  // ★261019 — 옛 단언 「편집 중엔 ＋ 를 걷는다」의 ★같은 뜻: 임시 칸(_cvbBeginAdd 가 넣는 .cvb-card-desc)이
  //   영역에 들어가면 그 자리는 ★더는 «빈 칸»이 아니다 ⇒ 같은 자리가 ★두 번 열리지 않는다.
  expect(await emptyCount(page, id), '편집 중엔 그 자리가 더는 빈 칸이 아니다(임시 칸이 들어가 있다)').toBe(0);
  await page.keyboard.insertText('설명');
  await page.keyboard.press('Escape');
  await page.waitForFunction((id) => JSON.parse(document.getElementById(id).dataset.cards)[0].desc === '설명', id);
  expect((await cards(page, id))[0].title).toBe('카드 제목');
  expect(await page.evaluate((id) => document.querySelector(`#${id} .cvb-card-desc`)?.textContent, id)).toBe('설명');
  // Esc 는 커밋 뒤 블럭 선택도 푼다(editor.js 전역 Esc — 기존 동작). 다시 골라도 빈 줄이 없다.
  await select(page, id, 0);   // ← select() 안의 전제 단언이 «빈 칸 0» 을 잰다(옛 plusCount 단언과 같은 자리)
  expect(errs).toEqual([]);
});

test('A3 빈 채로 나가면 아무 일도 없다 — cards 바이트 · 히스토리 길이 그대로 · 임시 칸 0 · 다시 봐도 빈 칸 1', async ({ page }) => {
  const { id } = await setup(page);
  await select(page, id, 1);
  const before = await page.evaluate((id) => ({ cards: document.getElementById(id).dataset.cards, len: window.getHistoryTip().len }), id);
  await dblclickEmpty(page, id);
  await page.waitForFunction(() => document.activeElement?.classList?.contains('cvb-card-desc'));
  await page.keyboard.press('Escape');
  await page.waitForFunction((id) => !document.getElementById(id).classList.contains('editing') && !document.querySelector('[contenteditable="true"]'), id);
  const after = await page.evaluate((id) => ({ cards: document.getElementById(id).dataset.cards, len: window.getHistoryTip().len,
    desc: document.querySelectorAll(`#${id} .cvb-card-desc`).length }), id);
  expect(after.cards).toBe(before.cards);
  expect(after.len).toBe(before.len);
  expect(after.desc).toBe(0);
  await select(page, id, 1);                          // 다시 골라도 빈 칸이 그대로 하나(빈 줄 그대로)
});

test('A4 ⌘Z 한 번에 설명이 빈다', async ({ page }) => {
  const { id } = await setup(page);
  await select(page, id, 1);
  await dblclickEmpty(page, id);
  await page.waitForFunction(() => document.activeElement?.classList?.contains('cvb-card-desc'));
  await page.keyboard.insertText('설명');
  await page.keyboard.press('Escape');
  await page.waitForFunction((id) => JSON.parse(document.getElementById(id).dataset.cards)[0].desc === '설명', id);
  await page.evaluate(() => window.undo());
  await page.waitForFunction((id) => { const b = document.getElementById(id); return b && JSON.parse(b.dataset.cards)[0].desc === ''; }, id);
  expect((await cards(page, id))[0].title).toBe('카드 제목');
});

/* A4b (이벨 D1 · 2026-10-12) — 줄 추가 커밋 «한 번» = 히스토리 «한 칸». 두 번째 ⌘Z 는 «직전 변경»으로 간다(빈 걸음 없음).
 *   직전 변경 = 패널 길과 같은 updateCanvasBlock(titleSize 20→30). 커밋은 이벨 재현대로 «바깥 클릭»(blur). ⌘Z 는 진짜 키.
 *   ★261019 — 커밋을 여는 손만 ＋ 클릭 → «빈 칸 더블클릭»으로 바뀌었다(커밋 길은 그대로 _cvbBeginAdd→_cvbEndEdit). */
test('A4b 줄 추가 커밋 1회 = 히스토리 +1 · 두 번째 ⌘Z 는 직전 변경(제목 크기)을 되돌린다', async ({ page }) => {
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
     그 되쓰기가 줄 추가 편집 «중»에 떨어지면 꼭대기에 임시 칸이 찍혀 +1 이 시험 속도 탓으로 생긴다(실측 진단 꼭대기 tempDiv:true).
     ⇒ 그 되쓰기가 «지나간 뒤»를 기다린다(같은 꼴의 예약: rAF·rAF·setTimeout 0 뒤 한 번 더). 사람 손 속도에선 이 창이 안 겹친다. */
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => setTimeout(r, 0), 0)))));
  await settled(page, id);
  const len0 = await page.evaluate(() => window.getHistoryTip().len);
  await dblclickEmpty(page, id);
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
  expect(len1 - len0, `줄 추가 커밋 한 번에 쌓인 히스토리 칸 수 · 새 표본별 빈 임시 칸 찍힘=${JSON.stringify(diag)}`).toBe(1);
  const st = () => page.evaluate((id) => { const b = document.getElementById(id); return b ? { desc: JSON.parse(b.dataset.cards)[0].desc, size: b.dataset.titleSize } : null; }, id);
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(st).toEqual({ desc: '', size: '30' });
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(st, '두 번째 ⌘Z = 직전 변경(제목 크기 30→20)').toEqual({ desc: '', size: '20' });
});

/* ★★261019 — ★«A5 ＋ 는 블럭 DOM·글자·#canvas 에 새지 않는다» 는 ★지웠다. ⛔조용히 지운 게 아니라
 *   ★여기 까닭을 남긴다:
 *   ⑴ 잰 대상(.cvb-add-btn)이 ★사라졌다 ⇒ 네 단언이 ★전부 ★항등식이 된다(측정 0). 「초록이니 됐다」로
 *      두면 ★다음 사람이 「누수를 재고 있다」고 믿는다.
 *   ⑵ ★살아 있는 ＋(.cvb-grid-add-btn)에 대한 ★같은 단언이 ★이 파일 아래 ★B6 에 ★이미 있다
 *      (inBlock·inCanvas·plusInText·layerParent) ⇒ 옮기면 ★중복이다. ⚠️단 A5 에만 있던 칸 하나
 *      (`#canvas` 안에 'cvb-plus-layer' 문자열이 없다)는 ★B6 로 ★넘겼다 — 그걸 안 넘기면 삭제가
 *      ★커버리지를 ★조용히 줄인다.
 *   ⑶ 내보내기·저장 길 전체(L1~L8)의 누수는 tests/dom/card-plus-leak.dom.spec.js 가 잰다(그쪽도 261019 에
 *      성장 ＋ 로 옮겼다).
 *   ⚠️★못 잰 것: ★편집 «중»에 블럭 ★안에 사는 ★임시 칸(_cvbBeginAdd 가 넣는 빈 .cvb-card-desc)이
 *     저장·내보내기에 실리는가 — ★A5 도 ★B6 도 ★그건 안 쟀다(둘 다 «편집 중»이 아닌 상태에서 잰다).
 *     A3 가 「나간 뒤 임시 칸 0」을, A4b 진단이 「히스토리 표본에 빈 임시 칸이 찍혔나」를 볼 뿐이다. */

test('A6 both 모드 — 위 설명만 비면 top 슬롯 빈 칸 하나 → 더블클릭해 쓰면 descTop 저장', async ({ page }) => {
  const { id } = await setup(page, { labelPos: 'both', cards: [{ title: '제목', desc: '', descTop: '', descBottom: '아래', imgSrc: '', cellBg: '' }] });
  await select(page, id, 1);
  const cs = await emptyCells(page, id);
  // ★필드 이름(descTop)은 ★제품이 정하는 이름이라 ★여기서 다시 적지 않는다(둘째 명부가 된다) —
  //   DOM 으로 잴 수 있는 것(어느 슬롯 · 무엇이 비었나 · 있는 쪽 필드)만 걸고, ★이름은 ★열린 칸으로 잰다.
  expect([cs[0].slot, cs[0].missing, cs[0].haveField], '위 슬롯의 설명이 비었다').toEqual(['top', 'desc', 'titleTop']);
  await dblclickEmpty(page, id);
  await page.waitForFunction(() => document.activeElement?.dataset?.field === 'descTop');
  await page.keyboard.insertText('위 설명');
  await page.keyboard.press('Escape');
  await page.waitForFunction((id) => JSON.parse(document.getElementById(id).dataset.cards)[0].descTop === '위 설명', id);
  const c = (await cards(page, id))[0];
  expect([c.desc, c.descBottom]).toEqual(['', '아래']);
});

/* ★★261019 — 옛 A7 「선택을 풀면 빈칸채우기 ＋ 0」은 ★대상이 사라져 ★항등식이 된다(.cvb-add-btn 은
 *   이제 ★언제나 0). ⛔지우지 않고 ★뜻을 ★살아 있는 ＋ 로 옮긴다: 「고르면 뜨는 ＋ 는 ★풀면 걷힌다」.
 *   ★중복 아님 — B1 은 「★고르기 ★전엔 0」을, 여기는 「★풀면 ★다시 0」을 잰다(_dropCvbGridPlus 경로).
 *   ★새 입구(빈 칸 더블클릭)에는 ★대응물이 없다 — 떴다 사라지는 UI 가 아니라 ★영역 자체이기 때문. */
test('A7 선택을 풀면 성장 ＋ 0 (옛 「빈칸채우기 ＋ 0」의 뜻을 살아 있는 ＋ 로 옮김)', async ({ page }) => {
  const GROW = '#cvb-plus-layer > .cvb-grid-add-btn';
  const { id } = await setup(page);
  await select(page, id, 1);
  await page.waitForFunction((s) => document.querySelectorAll(s).length === 2, GROW);
  await page.evaluate(() => window.deselectAll());
  await page.waitForFunction((s) => document.querySelectorAll(s).length === 0, GROW);
  expect(await page.evaluate((s) => document.querySelectorAll(s).length, GROW)).toBe(0);
});

test('A8 옛 카드(저장본 HTML · tpl-pagepad-e81 골든)도 빈 칸 더블클릭으로 설명을 쓴다', async ({ page }) => {
  const gold = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'tpl-pagepad-e81-golden.json'), 'utf8'));
  const { id } = await setup(page, {}, gold.card);
  expect(id).toBe('cvb_old');
  await select(page, id, 1);
  await dblclickEmpty(page, id);
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
 * 않는다 — settled() 와 같은 방식, «무엇을» 기다리는지는 안정 수렴이다).
 * ★261019 정정 — 위 둘째·셋째 줄은 ★그때의 사실이다. ★지금 select() 는 ★expectEmpty 와 무관하게
 *   ★언제나 settled() 를 부른다(건너뛰는 가지가 없다). ★그래도 gridSettled 는 ★따로 필요하다:
 *   settled() 는 ★텍스트 영역 사각형을, 이 함수는 ★성장 ＋ 버튼 자리를 재는 ★다른 자다. */
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
  // ★261019 정정 — 위 괄호 안 까닭은 ★그때의 사실이다. 지금은 빈칸채우기 ＋ 가 ★아예 없어서 비킴 로직이
  //   ★어느 카드에서도 안 걸린다(_cvbPlusBtns 가 언제나 빔). ⇒ ★이 픽스처를 고른 까닭은 바뀌어도
  //   ★이 검사가 재는 것(순수 자리의 좌표)은 ★그대로다. ★덮임은 B1b 가 ★새 입구 기준으로 잰다.
  const { id } = await setup(page, { cards: [{ title: '제목', desc: '설명', imgSrc: '', cellBg: '' }] });
  expect(await page.evaluate((s) => document.querySelectorAll(s).length, '#cvb-plus-layer > .cvb-grid-add-btn'), '고르기 전엔 0').toBe(0);
  await select(page, id, 0);   // 빈 칸 기대 0개(제목·설명 둘 다 채운 카드) — select() 안에서 전제로 단언한다
  await page.waitForFunction((s) => document.querySelectorAll(s).length === 2, '#cvb-plus-layer > .cvb-grid-add-btn');
  /* ★261019 — 여기 있던 `.cvb-add-btn 0개` 전제 한 줄을 ★지웠다: 빈칸채우기 ＋ 가 ★제품에서 사라져
     ★어느 카드에서도 0 이라 ★항등식이다(「둘 다 채운 카드라 안 뜬다」를 더는 안 잰다). ★그 뜻은 바로 위
     select(page,id,0) 의 «빈 칸 0개» 전제가 ★그대로 이어받는다. */
  // ★1018 — select(page,id,0) 은 settled() 를 안 기다린다(expectPlus falsy ★— 261019 에 그 가지가
  //   없어졌다: select() 가 언제나 settled() 를 부른다. 아래 gridSettled 는 ★버튼 자리를 재는 다른 자라
  //   여전히 필요하다). 패널이 열리며 캔버스 폭·배율이
  //   한동안 바뀌므로 성장 ＋ 자신의 자리가 안정될 때까지 따로 기다린다(열 쪽 19.65px 빨강의 진짜 원인 —
  //   CSS 확인 결과 열 ＋ 는 row 처럼 반쪽 중심정렬이 아니라 translate(-50%,-50%) 완전 중심정렬이라, +20
  //   류 보정은 틀린 처방이었다. 안정 대기가 맞는 처방).
  await gridSettled(page, id);
  const col = await gridPlusGeom(page, id, 'col'), row = await gridPlusGeom(page, id, 'row');
  expect(col.title).toBe('열 추가');
  expect(row.title).toBe('행 추가');
  expect(Math.abs(col.cx - col.blockRight)).toBeLessThan(2);
  expect(Math.abs(col.cy - col.blockMidY)).toBeLessThan(2);
  // ★★261019 현빈 — 「★로우추가 ＋ 의 위치는 50%가 아니여가꼬 ★통일시켜주는게 좋을것 같아」
  //   ★옛 단언은 ★«바닥 + 반지름 20»을 ★잠그고 있었다 — ★즉 ★★«비대칭인 채로 있어라»를 ★검사가 ★지키고 있었다.
  //   ★CSS 를 ★열 ＋ 와 ★같은 translate(-50%,-50%) 로 ★고쳤으므로 ★중심이 ★바닥 선에 ★온다.
  //   ⇒ ★이 줄을 ★안 고치면 ★빨강이 ★난다(★그 빨강이 ★이 짝의 ★양성대조다).
  expect(Math.abs(row.cy - row.blockBottom)).toBeLessThan(2);   // ★행 ＋ 도 ★완전 중심정렬 — ★중심이 ★블럭 바닥 선 위
  expect(Math.abs(row.cx - row.blockMidX)).toBeLessThan(2);
  expect(col.hitIsBtn).toBe(true);
  expect(row.hitIsBtn).toBe(true);
});

/* ★★★261019 — 옛 B1b 「기본 카드(빈칸채우기 ＋ 1개)에서도 행 성장 ＋ 가 그 위에 안 덮인다」는
 *   ★전제(＋ 1개)가 사라졌다. ⛔지우지 않는다 — ★지키려던 것은 「＋ 단추 둘」이 아니라
 *   ★★«같은 자리에 있는 ★두 입구가 서로를 덮지 않는다»였고, ★입구 하나가 ★단추 → ★«빈 칸 더블클릭
 *   자리»로 ★바뀌었을 뿐 ★위험은 ★같은 자리에 ★남아 있다(오히려 둘 커졌다, 아래).
 *
 * ★★소스로 잰 것(261019 · ⚠️행위로는 ★안 쟀다 — 아래 「못 잰 것」):
 *   ⑴ css/editor-blocks.css 가 행 ＋ 를 translateX(-50%) → translate(-50%,-50%) 로 바꿨다 ⇒ ★중심이
 *      ★블럭 바닥 ★선 위에 온다 ⇒ 버튼의 ★아래 절반이 아니라 ★위 절반(20px)이 ★텍스트 영역 ★안으로
 *      들어온다(옛 자리에서는 버튼 전체가 블럭 ★밖이었다).
 *   ⑵ 비킴 로직(canvas-block.js _placeCvbGridAddBtns 의 `fillBtns` 루프)은 ★«빈칸채우기 ＋ 목록»
 *      (_cvbPlusBtns)을 보고 비킨다. 그 목록이 이제 ★언제나 비어서(_cvbBlockMounts 의 want=[])
 *      ★비킴이 ★한 번도 안 돈다 — ★살아 있는 코드가 아니라 ★죽은 가드다.
 *   ⇒ 기본 카드에서 ★영역 가로 ★가운데 · 글자 아래 여백 ★한가운데가 ★행 성장 ＋ 에 ★가릴 수 있다.
 *      그 버튼은 mousedown·dblclick 을 ★stopPropagation 한다(_makeCvbGridAddBtn) ⇒ 가리면 그 점의
 *      더블클릭은 ★블럭 리스너에 ★안 닿고 ★아무 일도 안 일어난다(= 1018 버그와 ★같은 실패 꼴).
 *
 * ⚠️★★못 잰 것 — ★이 검사를 ★작성 시점에 ★안 돌렸다(이 맥 Playwright 금지 · 지디 지시).
 *   ★소스 기하로만 ★셈한 예상은 ★빨강이다: 기본 카드 designH 400 · imgRatio 76 ⇒ 텍스트 영역 96px ·
 *   padding 10 · titleSize 20 · line-height 1.3 ⇒ 글자 아래 띠 ≈35px · 그 한가운데는 영역 바닥에서
 *   ≈17.5px 위 · 버튼 반지름 20px ⇒ ★안쪽(17.5 < 20). ★이 셈은 ★추정이지 ★측정이 아니다.
 *   ★빨강이 나면 ★검사의 흠이 아니라 ★제품의 흠이다. 처방 후보: ㉠ 비킴 기준을 «빈칸채우기 ＋ 목록»
 *   대신 ★«빈 칸의 텍스트 영역 사각형»으로 바꾼다 ㉡ 행 ＋ 를 다시 블럭 밖으로 뺀다.
 *   ⛔검사를 느슨하게 해서 통과시키지 마라(그러면 1018 과 같은 구멍이 조용히 돌아온다).
 * ⚠️261018 에 적어 둔 ★열 성장 ＋ 쪽 미측정은 ★그대로 남는다(아래 꼬리 주석). */
test('B1b 회귀 — 행 성장 ＋ 가 «실제로 쓰는» 더블클릭 자리를 덮지 않는다 · ＋ 는 가로 가운데(261019 현빈)', async ({ page }) => {
  /* ★★261019 — ★이 칸의 ★뜻을 ★바꿨다. ★경위를 ★적는다(⛔조용히 고치지 ★않는다).
       ⑴ ★처음 이 칸은 ★「가로 ★가운데 자리가 ★행 ＋ 에 ★가리면 ★안 된다」를 ★잠갔다.
          ★그때는 ★★비킴 가드가 ★있었다 — ★행 ＋ 가 ★겹치면 ★오른쪽으로 ★50px 비켰다.
       ⑵ ★그 뒤 ★현빈이 ★9334 에서 ★보시고 ★★「로우추가하는 ＋는 ★위치가 ★이상한데? ★중앙이 ★아니지 않니?」
          ⇒ ★★비킴을 ★걷었다. ★행 ＋ 는 ★★언제나 ★블럭 ★하단 ★가로 ★가운데다.
       ⑶ ⇒ ★★가운데 자리는 ★★가려진다. ★그게 ★★설계다(⛔결함이 ★아니다).
          ★★괜찮은 까닭 — ★더블클릭 판정이 ★★«영역 ★사각형 ★안 ★아무 데나»다.
          ★영역 ★≈144×46 · ★버튼이 ★가리는 ★부분 ★≈40×20 ⇒ ★★나머지 ★어디를 ★눌러도 ★열린다.
          ★실측(261019 · 9334): ★영역 ★왼쪽 ★20% 지점에서 ★편집이 ★열렸다.
       ⇒ ★★그래서 ★★잠글 것이 ★바뀐다:
          ⛔「가운데가 ★안 가려진다」  →  ★★「★A 묶음이 ★실제로 ★누르는 자리(at)가 ★안 가려진다」
          ＋ ★★「행 ＋ 가 ★정말 ★가로 ★가운데에 ★선다」(★현빈 지시를 ★잠근다)
       ★★atCenter 는 ★★단언하지 ★않고 ★로그로만 ★남긴다 — ★가려도 ★되고 ★안 가려도 ★되기 때문이다.
         ⛔「가려야 한다」로 ★뒤집어 ★잠그지도 ★않았다: ★그건 ★블럭 크기·배율에 ★따라 ★갈려
         ★★흔들리는 단언이 ★된다(★내 명부: 「★흔들리는 것이 든 명부에 ★등호 금지」). */
  const { id } = await setup(page);
  await select(page, id, 1);   // 빈 칸 1개(전제)
  await page.waitForFunction((s) => document.querySelectorAll(s).length === 2, '#cvb-plus-layer > .cvb-grid-add-btn');
  await gridSettled(page, id);
  const cs = await emptyCells(page, id);
  expect(cs.length, '전제 — 빈 칸 하나').toBe(1);
  const g = cs[0];
  const row = await gridPlusGeom(page, id, 'row');
  const blockMidX = await page.evaluate((id) => {
    const r = document.getElementById(id).getBoundingClientRect(); return (r.left + r.right) / 2;
  }, id);
  const dx = Math.abs(g.x - row.cx), dy = Math.abs(g.y - row.cy);
  // ★통과해도 값이 로그에 남아야 한다(「단언에 잰 값을 찍어라」)
  console.log(`[B1b] at=(${g.x},${g.y}) bandH=${g.bandH} rowCx=${row.cx} rowCy=${row.cy} blockMidX=${blockMidX} `
    + `dx=${dx} dy=${dy} at.onGrow=${g.at.onGrow} atCenter.onGrow=${g.atCenter.onGrow} atCenter.cls=${g.atCenter.cls}`);

  expect(row.hitIsBtn, '★행 성장 ＋ 는 여전히 누를 수 있다').toBe(true);
  // ★★현빈 지시 — 행 ＋ 는 블럭 가로 가운데(비킴 없음)
  expect(Math.abs(row.cx - blockMidX), `★행 ＋ 가 가로 가운데가 아니다(rowCx=${row.cx} blockMidX=${blockMidX}) — 비킴이 되살아났나?`)
    .toBeLessThan(2);
  // ★★진짜 값 — A 묶음이 실제로 누르는 자리가 살아 있나
  expect(g.at.inBlock, `★더블클릭 자리가 블럭(또는 후손)이 아니다 — 거기 있는 것=${g.at.cls} ⇒ 리스너에 안 닿는다`).toBe(true);
  expect(g.at.onGrow, `★A 묶음이 누르는 자리가 행 성장 ＋ 에 가렸다 — 거기 있는 것=${g.at.cls} (bandH=${g.bandH} areaW=${g.areaW})`).toBe(false);
  expect(g.at.onText, `★그 자리가 이미 있는 글자 위다(거기 있는 것=${g.at.cls})`).toBe(false);
  /* ⚠️261018 — 이 검사는 ★행★ 성장 ＋ 만 잰다. ★열 성장 ＋(블럭 우측)가 빈 칸 자리와 같은 식으로
       겹칠 수 있는지는 ★미측정이다(기하적으로 더 드문 조건으로 보이지만 그건 추론이고, 수로 재지 않았다).
       다음 사람의 출발선: 열 쪽도 이 B1b 와 같은 틀로 (빈 칸의 오른쪽 가장자리 자리 vs col ＋) 재는 케이스를 추가할 것. */
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

/* ★261019 — A5(빈칸채우기 ＋ 짝)를 ★지우면서, A5 에만 있던 칸 하나(`#canvas` 안에 'cvb-plus-layer'
 *   문자열이 없다)를 ★여기로 넘겨받았다. ⛔안 넘기면 A5 삭제가 ★커버리지를 조용히 줄인다
 *   (layerParent 단언이 뜻을 겹쳐 덮지만, 겹침은 «같음»이 아니다). */
test('B6 성장 ＋ 도 블럭 DOM·글자·#canvas 에 새지 않는다(옛 A5 와 같은 단언 — 새 클래스 짝)', async ({ page }) => {
  const { id } = await setup(page);
  await select(page, id, 1);
  await page.waitForFunction((s) => document.querySelectorAll(s).length === 2, '#cvb-plus-layer > .cvb-grid-add-btn');
  const r = await page.evaluate((id) => {
    const b = document.getElementById(id), c = document.getElementById('canvas');
    return { inBlock: b.outerHTML.includes('cvb-grid-add-btn'),
      inCanvas: c.innerHTML.includes('cvb-grid-add-btn') || c.innerHTML.includes('cvb-plus-layer'),
      plusInText: b.innerText.includes('+') || b.innerText.includes('＋'),
      layerParent: document.getElementById('cvb-plus-layer')?.parentElement?.id };
  }, id);
  expect(r).toEqual({ inBlock: false, inCanvas: false, plusInText: false, layerParent: 'canvas-scaler' });
});
