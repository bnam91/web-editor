/* laurel-lines.dom.spec.js — 1013t1B2 laurel(월계관) 줄을 line-host 의 «네 번째 주인»으로 (2026-10-13 · S1-1013 하네스)
 *
 * ★현빈 원문(1013t1B2): 「laurel 블럭의 경우 우측패널에 셀별로 줄추가 … 그리드의 칸과 줄을 삽입하는 것과 같은 방식으로 …
 *   줄 추가하는 부분 일관성 유지해줘.」
 * ★단계 C1(LL0~LL3) — 모든 줄을 «한 렌더 길»(lnLinesHtml = 그리드 줄 렌더)로 그린다.
 * ★단계 C2(LL4~LL10) — line-host 네 번째 주인: 캔버스 2단 선택 · 공용 줄바 · T/G/⌫/Esc/⌘↑↓/⌘→ · 더블클릭 편집 · updateLaurelBlock{cellLines} 문.
 *   UI·저장 데이터 변화 0 · 옛 저장본(옛 꼴 줄 {text,fontSize,fontWeight,color,letterSpacing?})의 렌더 기하·계산 스타일 불변.
 *   ⇒ 「옛 렌더 산출」을 이 파일 안에 «고정 문자열 식»(oldLineHtml — b6e85227 의 _renderLaurelCellHtml 줄 span 그대로)으로 박고,
 *     같은 칸에 나란히 놓아 화면으로 견준다(grid-img-frame-noop 선례).
 * ⛔고정 대기 0 — waitForFunction / expect.poll 로 «그 값»을 기다린다.
 *
 * 음성대조(1회 실측 · 생성기 C1):
 *   · js/blocks/laurel-block.js _lrlGridLine 의 `lineHeight: 1.1,` 를 빼면 → LL0 빨강(줄 높이 1.6 배)
 *   · 같은 파일 _lrlDecorateLinesHtml 의 `el.style.whiteSpace = 'nowrap';` 를 빼면 → LL1 빨강(긴 줄이 줄바꿈 · 높이 44 → 여러 줄)
 *   · 같은 파일 _lrlDecorateLinesHtml 의 `if (fxClass) {` 를 `if (false) {` 로 → LL2 빨강(neon 글자색이 fx 색이 아니다)
 *   실측 2026-10-13(셋을 한 번에 깨서 한 벌): 3 failed / 2 passed — LL0 줄높이 61.6→89.6px·white-space pre-wrap · LL1 · LL2(fx 줄 0 → 기다림 시간초과).
 *   LL3 은 이 셋과 무관해 초록(음성대조 안 쟀다). LL4 는 C2 에서 「더블클릭 = line-host 편집기」로 고쳐 썼다(C1 판 LL4 = 옛 「Enter = 끝」).
 *
 * 실행: bash run-test.sh dom tests/dom/laurel-lines.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = '<div class="section-block" data-section="1" id="sB"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>';

/* 옛 꼴 줄(= b6e85227 까지의 저장본 꼴) — 짧은 줄 · 자간 · 기본값 빠진 줄 · rgb 색 · 겹공백 · 긴 줄 */
const OLD_CELLS = [
  { lines: [
    { text: '1위', fontSize: 56, fontWeight: 700, color: '#1a1a1a' },
    { text: '고객 만족도', fontSize: 28, fontWeight: 500, color: '#333333', letterSpacing: 2 },
    { text: '기본값' },
    { text: 'A  B  C', fontSize: 20, fontWeight: 400, color: 'rgb(10, 20, 30)', letterSpacing: -1.5 },
  ], leafColor: '#c0a060', gap: 24, height: 140 },
  { lines: [
    { text: '매우 긴 문장이 칸 너비를 넘어가면 어떻게 되는가 확인용 텍스트입니다 정말로 깁니다', fontSize: 40, fontWeight: 700, color: '#1a1a1a' },
  ], leafColor: '#1a1a1a', gap: 24, height: 140 },
];

async function setup(page, cells = OLD_CELLS, cols = 2, rows = 1) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(([cells, cols, rows, sec]) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', sec);
    window.rebindAll?.(); window.applyZoom?.(100);
    window.deselectAll?.(); window.selectSection(document.getElementById('sB'));
    window.addLaurelBlock({ gridCols: cols, gridRows: rows, cells });
    window.__blk = [...document.querySelectorAll('#sB .laurel-block')].pop();
    window.__bid = window.__blk?.id;
    window.buildLayerPanel?.(); window.deselectAll?.();
    window.__blk?.scrollIntoView({ block: 'center' });
  }, [cells, cols, rows, SEC]);
  await page.waitForFunction(() => !!window.__blk && window.__blk.isConnected && !window.__blk.classList.contains('selected'), null, { timeout: 5000 });
  await waitStableRect(page, '#sB .laurel-block');
  return errs;
}

/* ★옛 렌더의 줄 span — b6e85227 js/blocks/laurel-block.js _renderLaurelCellHtml 의 linesHtml 식 «그대로»(고정). ⛔제품 코드를 부르지 않는다. */
const OLD_LINE_FN = `(ln, i, fx) => {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fxClass = fx ? ' text-effect tfx-' + fx.preset + ((fx.preset === 'grunge' && fx.texture) ? ' tfx-tex-' + fx.texture : '') : '';
  const fxStyle = fx ? '--tfx-color:' + fx.color + ';--tfx-glow-color:' + (fx.glowColor || fx.color) + ';--tfx-intensity:' + ((fx.intensity ?? 70) / 100) + ';--tfx-grain:' + ((fx.grain ?? 60) / 100) + ';' : '';
  const fs = parseInt(ln.fontSize) || 56;
  const fw = parseInt(ln.fontWeight) || 700;
  const cl = ln.color || '#1a1a1a';
  const ls = (ln.letterSpacing !== undefined && ln.letterSpacing !== null && !isNaN(parseFloat(ln.letterSpacing))) ? parseFloat(ln.letterSpacing) : 0;
  return '<span class="laurel-text-line' + fxClass + '" data-line-idx="' + i + '" style="font-size:' + fs + 'px;font-weight:' + fw + ';line-height:1.1;white-space:nowrap;color:' + cl + ';letter-spacing:' + ls + 'px;' + fxStyle + '">' + esc(ln.text) + '</span>';
}`;

/* 칸 ci 의 «새 렌더» 줄(글자 담는 요소)과 «옛 마크업» 줄을 같은 칸에서 재서 돌려준다. */
const measure = (page, ci) => page.evaluate(([ci, fnSrc]) => {
  const oldLine = (0, eval)(fnSrc);
  const b = document.getElementById(window.__bid);
  const cell = b.querySelector(`.laurel-cell[data-cell-idx="${ci}"]`);
  const stack = cell.querySelector('.laurel-text-stack');
  const R = (e) => { const q = e.getBoundingClientRect(); return [q.left, q.top, q.width, q.height]; };
  const CS = (e) => { const s = getComputedStyle(e); return { color: s.color, fontSize: s.fontSize, fontWeight: s.fontWeight, letterSpacing: s.letterSpacing,
    lineHeight: s.lineHeight, fontFamily: s.fontFamily, whiteSpace: s.whiteSpace, textOverflow: s.textOverflow, overflowX: s.overflowX,
    textShadow: s.textShadow, fill: s.webkitTextFillColor, bgClip: s.webkitBackgroundClip || s.backgroundClip, bgImage: s.backgroundImage }; };
  const newEls = [...stack.querySelectorAll(':scope > .ln-row > .grd-line')];
  const fresh = { rows: stack.querySelectorAll(':scope > .ln-row[data-ln]').length, legacySpans: stack.querySelectorAll('.laurel-text-line').length,
    rects: newEls.map(R), cs: newEls.map(CS), texts: newEls.map(e => e.textContent), cellH: cell.getBoundingClientRect().height,
    lnM: [...stack.querySelectorAll(':scope > .ln-row')].map(r => r.dataset.lnM) };
  const lines = JSON.parse(b.dataset.cells)[ci].lines;
  let fx = null; try { fx = b.dataset.textEffect ? JSON.parse(b.dataset.textEffect) : null; } catch (_) {}
  const saved = stack.innerHTML;
  stack.innerHTML = lines.map((l, i) => oldLine(l, i, fx)).join('');
  const oldEls = [...stack.children];
  const legacy = { rects: oldEls.map(R), cs: oldEls.map(CS), texts: oldEls.map(e => e.textContent), cellH: cell.getBoundingClientRect().height };
  stack.innerHTML = saved;
  return { fresh, legacy };
}, [ci, OLD_LINE_FN]);

const near = (a, b, tol = 0.5) => a.length === b.length && a.every((v, i) => v.every((x, k) => Math.abs(x - b[i][k]) <= tol));
const pick = (cs, keys) => cs.map(o => Object.fromEntries(keys.map(k => [k, o[k]])));
const TYPO = ['color', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight', 'fontFamily', 'whiteSpace'];

test.describe('laurel 줄 — C1 한 렌더 길(옛 저장본 렌더 불변)', () => {
  test('LL0 C1 짧은 줄 — 그리드 줄 렌더(.ln-row > .grd-line)가 옛 span 과 사각형 ±0.5px · 계산 스타일 같음', async ({ page }) => {
    const errs = await setup(page);
    const { fresh, legacy } = await measure(page, 0);
    // 전제 — 새 렌더가 정말 «새 길»이다(옛 span 0 · 줄 감싸개 4 · 칸 번호 주소)
    expect(fresh.legacySpans, '전제 — 옛 .laurel-text-line 은 더는 안 그린다').toBe(0);
    expect(fresh.rows, '전제 — 줄 4개가 .ln-row[data-ln] 로').toBe(4);
    expect(fresh.lnM, '전제 — 감싸개가 칸 번호(data-ln-m)를 든다').toEqual(['0', '0', '0', '0']);
    expect(legacy.rects.length, '전제 — 옛 마크업도 줄 4개').toBe(4);
    expect(fresh.texts, '글자 같음(겹공백 포함 원문)').toEqual(legacy.texts);
    expect(pick(fresh.cs, TYPO), '계산 스타일 같음(색·크기·굵기·자간·줄높이·글꼴·공백)').toEqual(pick(legacy.cs, TYPO));
    expect(near(fresh.rects, legacy.rects), `사각형 ±0.5px — 새 ${JSON.stringify(fresh.rects)} / 옛 ${JSON.stringify(legacy.rects)}`).toBe(true);
    expect(Math.abs(fresh.cellH - legacy.cellH), '칸 높이 같음').toBeLessThanOrEqual(0.5);
    expect(errs).toEqual([]);
  });

  test('LL1 C1 긴 줄 — 옛 「한 줄 + 말줄임」 그대로(줄바꿈 안 함 · 높이 같음)', async ({ page }) => {
    const errs = await setup(page);
    const { fresh, legacy } = await measure(page, 1);
    expect(fresh.rows, '전제 — 긴 줄 1개').toBe(1);
    expect(legacy.rects[0][2], '전제 — 옛 줄이 칸 폭에 막혀 잘린다(scrollWidth 아님 · 사각 폭 < 1000)').toBeLessThan(1000);
    expect(pick(fresh.cs, [...TYPO, 'textOverflow', 'overflowX']), '말줄임 꾸밈 같음').toEqual(pick(legacy.cs, [...TYPO, 'textOverflow', 'overflowX']));
    expect(Math.abs(fresh.rects[0][3] - 44), `높이 44(40px × 1.1 한 줄) — 새 ${fresh.rects[0][3]}`).toBeLessThanOrEqual(0.5);
    expect(near(fresh.rects, legacy.rects), `사각형 ±0.5px — 새 ${JSON.stringify(fresh.rects)} / 옛 ${JSON.stringify(legacy.rects)}`).toBe(true);
    expect(Math.abs(fresh.cellH - legacy.cellH), '칸 높이 같음').toBeLessThanOrEqual(0.5);
    expect(errs).toEqual([]);
  });

  test('LL2 C1 텍스트 효과(**text_) — neon 글자색·그림자 · metallic 글자 채움이 옛 span 과 같다', async ({ page }) => {
    const errs = await setup(page);
    for (const preset of ['neon', 'metallic']) {
      await page.evaluate((p) => window.applyTextEffectToLaurel(document.getElementById(window.__bid), { preset: p, color: '#ff00aa' }), preset);
      await page.waitForFunction((p) => !!document.querySelector(`#sB .laurel-block .ln-row > .grd-line.tfx-${p}`), preset);
      const { fresh, legacy } = await measure(page, 0);
      if (preset === 'neon') expect(legacy.cs[0].color, '전제(neon) — 옛 span 에 fx 색이 먹었다').toBe('rgb(255, 0, 170)');
      else expect(legacy.cs[0].fill, '전제(metallic) — 옛 span 글자 채움 투명(bg-clip:text)').toBe('rgba(0, 0, 0, 0)');
      expect(pick(fresh.cs, ['color', 'textShadow', 'fill', 'bgClip', 'bgImage']), `${preset} — fx 계산값 같음`)
        .toEqual(pick(legacy.cs, ['color', 'textShadow', 'fill', 'bgClip', 'bgImage']));
      expect(near(fresh.rects, legacy.rects), `${preset} 사각형 ±0.5px`).toBe(true);
    }
    expect(errs).toEqual([]);
  });

  test('LL3 C1 저장 데이터 무변 — 렌더·다시 묶기(rebindAll)·직렬화 뒤 dataset.cells 바이트 같음', async ({ page }) => {
    const errs = await setup(page);
    const r = await page.evaluate(() => {
      const b = document.getElementById(window.__bid);
      const before = b.dataset.cells;
      window.renderLaurelBlock(b);
      const afterRender = document.getElementById(window.__bid).dataset.cells;
      window.rebindAll?.();
      const afterRebind = document.getElementById(window.__bid).dataset.cells;
      const snap = JSON.parse(window.serializeProject());
      const doc = new DOMParser().parseFromString(snap.pages.map(p => p.canvas || '').join(''), 'text/html');
      const saved = doc.getElementById(window.__bid)?.dataset.cells;
      const parsed = JSON.parse(before);
      return { before, afterRender, afterRebind, saved, oldShape: parsed.every(c => c.lines.every(l => l.type === undefined && 'text' in l)),
        savedLegacySpans: doc.getElementById(window.__bid)?.querySelectorAll('.laurel-text-line').length,
        savedRows: doc.getElementById(window.__bid)?.querySelectorAll('.ln-row[data-ln]').length };
    });
    expect(r.oldShape, '전제 — 저장 꼴이 옛 꼴(type 키 없음)').toBe(true);
    expect(r.afterRender, '렌더 뒤 바이트 같음').toBe(r.before);
    expect(r.afterRebind, 'rebindAll(열기 길) 뒤 바이트 같음').toBe(r.before);
    expect(r.saved, '직렬화본의 data-cells 바이트 같음').toBe(r.before);
    expect(r.savedRows, '직렬화본 마크업 = 새 줄 렌더(5줄)').toBe(5);
    expect(r.savedLegacySpans, '직렬화본에 옛 span 0').toBe(0);
    expect(errs).toEqual([]);
  });

  test('LL4 C2 더블클릭 글자 편집 — line-host 한 길(lnBindLineEdit) · Enter = 줄 안 줄바꿈 · Esc 로 끝 · 그 줄 꾸밈 보존', async ({ page }) => {
    const errs = await setup(page);
    const sel = '#sB .laurel-block .laurel-cell[data-cell-idx="0"] .ln-row[data-ln="1"] > .grd-line';
    const p = await waitStableRect(page, sel);
    await page.mouse.dblclick(p.cx, p.cy);
    await expect.poll(() => page.evaluate((s) => document.querySelector(s)?.getAttribute('contenteditable'), sel)).toBe('true');
    expect(await page.evaluate(() => document.getElementById(window.__bid).classList.contains('editing')), '전제 — line-host 편집기(블럭 .editing)가 열었다').toBe(true);
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('윗줄');
    await page.keyboard.press('Enter');                       // ★B2-8 — 끝내지 않고 줄 안 줄바꿈
    await page.keyboard.type('아랫줄');
    expect(await page.evaluate((s) => document.querySelector(s)?.getAttribute('contenteditable'), sel), 'Enter 뒤에도 편집 중(옛 「Enter = 끝」이 아니다)').toBe('true');
    await page.keyboard.press('Escape');
    const want = '윗줄\n아랫줄';
    await expect.poll(() => page.evaluate(() => JSON.parse(document.getElementById(window.__bid).dataset.cells)[0].lines[1].text)).toBe(want);
    const after = await page.evaluate(() => JSON.parse(document.getElementById(window.__bid).dataset.cells));
    const o = OLD_CELLS[0].lines[1];
    expect(after[0].lines[1], '그 줄의 꾸밈 보존(새 꼴로)').toEqual({ type: 'body', text: want, fontSize: o.fontSize, weight: String(o.fontWeight), color: o.color, letterSpacing: o.letterSpacing, lineHeight: 1.1 });
    expect(after[1], '다른 칸 무변').toEqual(OLD_CELLS[1]);
    const r = await page.evaluate((s) => { const e = document.querySelector(s); const cs = getComputedStyle(e);
      return { ws: cs.whiteSpace, h: e.getBoundingClientRect().height, lh: parseFloat(cs.lineHeight), editable: e.getAttribute('contenteditable'), other: getComputedStyle(document.querySelector('#sB .laurel-block .ln-row[data-ln-m="0"][data-ln="0"] > .grd-line')).whiteSpace }; }, sel);
    expect(r.editable, '편집 끝').toBe(null);
    expect(r.ws, '줄바꿈 든 줄 = pre(줄은 그 자리에서 끊되 감싸지 않는다)').toBe('pre');
    expect(Math.abs(r.h - 2 * r.lh), `두 줄 높이 — ${r.h} vs 2×${r.lh}`).toBeLessThanOrEqual(1);
    expect(r.other, '줄바꿈 없는 줄은 nowrap 그대로(옛 렌더)').toBe('nowrap');
    expect(errs).toEqual([]);
  });
});

/* ══ C2 — 네 번째 주인(그리드와 같은 손) ══════════════════════════════════════════════════════════
 * 음성대조(1회 실측 · 생성기 C2): js/block-drag.js isLaurel 클릭의
 *   `if (_lnAt) window.grdSetActiveLine?.(block, _lnAt);` 를 주석 처리 → LL5 빨강(두 번째 클릭이 줄을 못 고른다)
 *   (그 줄 하나가 «캔버스에서 줄을 고르는 문»이라, 클릭으로 고르는 LL6·LL7·LL8·LL10 전제도 같이 빨개진다.)
 *   실측 2026-10-13: 5 failed(LL5·LL6·LL7·LL8·LL10) / 6 passed(LL0~LL4·LL9 — 클릭 선택과 무관) · 되돌린 뒤 cmp 같음. */
const C2_CELLS = [
  { lines: [{ text: '1위', fontSize: 56, fontWeight: 700, color: '#1a1a1a' }, { text: '고객 만족', fontSize: 28, fontWeight: 500, color: '#333333' }], leafColor: '#1a1a1a', gap: 24, height: 140 },
  { lines: [{ text: '2위', fontSize: 56, fontWeight: 700, color: '#1a1a1a' }], leafColor: '#1a1a1a', gap: 24, height: 140 },
  { lines: [{ text: '3위', fontSize: 56, fontWeight: 700, color: '#1a1a1a' }], leafColor: '#1a1a1a', gap: 24, height: 140 },
  { lines: [{ text: '4위', fontSize: 56, fontWeight: 700, color: '#1a1a1a' }, { text: '넷째 칸 둘째 줄', fontSize: 24, fontWeight: 400, color: '#555555' }], leafColor: '#1a1a1a', gap: 24, height: 140 },
];
const LSEL = (ci, li) => `#sB .laurel-block .ln-row[data-ln-m="${ci}"][data-ln="${li}"]`;
const cellsOf = (page) => page.evaluate(() => JSON.parse(document.getElementById(window.__bid).dataset.cells));
const active = (page) => page.evaluate(() => window.grdGetActiveLine?.(document.getElementById(window.__bid)) ?? null);
const histLen = (page) => page.evaluate(() => window.getHistoryTip?.().pos);
async function setup2(page) {
  const errs = await setup(page, C2_CELLS, 2, 2);
  await page.evaluate(() => { window.deselectAll(); window.clearHistory?.(); });
  await waitStableRect(page, LSEL(3, 1));
  return errs;
}
/* 진짜 마우스로 «블럭 → 줄» 2단 선택. 누르는 점이 그 줄 위라는 전제를 단언한다. */
async function pickLine(page, ci, li) {
  const sel = LSEL(ci, li);
  const p = await waitStableRect(page, sel);
  const hit = await page.evaluate(([x, y, s]) => { const e = document.elementFromPoint(x, y); const w = document.querySelector(s); return !!(e && w && (e === w || w.contains(e))); }, [p.cx, p.cy, sel]);
  expect(hit, `전제 — 누르는 점이 ${sel} 위`).toBe(true);
  const sel0 = await page.evaluate(() => document.getElementById(window.__bid).classList.contains('selected'));
  if (!sel0) {
    await page.mouse.click(p.cx, p.cy);
    await page.waitForFunction(() => document.getElementById(window.__bid).classList.contains('selected'));
  }
  await page.mouse.click(p.cx, p.cy);
  await expect.poll(() => active(page), `줄 (${ci},${li}) 활성`).toEqual({ r: ci, c: 0, li });
}

test.describe('laurel 줄 — C2 네 번째 주인(캔버스 2단 선택 · 줄바 · 단축키 · 문)', () => {
  test('LL5 C2 클릭1 = 블럭만 · 클릭2 = 줄 활성 + 줄바(그리드와 같은 명부) · 칸 카드에 줄 카드 0 · 2×2 칸 4 머리', async ({ page }) => {
    const errs = await setup2(page);
    // 그리드 기준값 — 같은 페이지의 그리드 블럭에서 «+ 줄 추가» 명부를 뜬다(손으로 안 적는다)
    const gridKinds = await page.evaluate(async () => {
      window.selectSection(document.getElementById('sB')); window.addGridBlock({});
      const g = [...document.querySelectorAll('#sB .grid-block')].pop();
      window.deselectAll(); g.classList.add('selected'); window.grdSetActiveLine(g, { r: 0, c: 0, li: 0 }); window.showGridProperties(g);
      const o = [...(document.getElementById('grd-line-add-kind')?.options || [])].map(x => x.value);
      window.deselectAll(); g.closest('.row')?.remove(); return o;
    });
    expect(gridKinds.length, '전제 — 그리드 줄바 명부를 읽었다').toBeGreaterThan(3);
    const p = await waitStableRect(page, LSEL(0, 1));
    await page.mouse.click(p.cx, p.cy);
    await page.waitForFunction(() => document.getElementById(window.__bid).classList.contains('selected'));
    const s1 = await page.evaluate(() => ({ act: window.grdGetActiveLine(document.getElementById(window.__bid)) ?? null, bar: !!document.getElementById('grd-line-add-kind'),
      marked: document.querySelectorAll('#sB .laurel-block .ln-line-selected').length }));
    expect(s1, '클릭1 = 블럭만(줄 활성·줄바·표시 0)').toEqual({ act: null, bar: false, marked: 0 });
    await page.mouse.click(p.cx, p.cy);
    await expect.poll(() => active(page)).toEqual({ r: 0, c: 0, li: 1 });
    const s2 = await page.evaluate(() => {
      const P = document.querySelector('#panel-right .panel-body');
      return { kinds: [...(document.getElementById('grd-line-add-kind')?.options || [])].map(x => x.value),
        summary: document.getElementById('grd-line-summary')?.textContent || '', kindSel: !!document.getElementById('grd-line-kind'),
        marked: [...document.querySelectorAll('#sB .laurel-block .ln-line-selected')].map(e => `${e.dataset.lnM}:${e.dataset.ln}`),
        lineCards: P.querySelectorAll('.prop-line-card, .lrl-line-add, .lrl-line-remove').length, cellCards: P.querySelectorAll('.prop-cell-card').length,
        expanded: [...P.querySelectorAll('.prop-cell-card.expanded')].map(e => e.dataset.cellIdx),
        barAfterHeader: P.querySelector('.prop-section + #ln-line-panel') !== null };
    });
    expect(s2.kinds, '줄바 명부 = 그리드 명부 그대로(C4 에서 그림까지 열었다)').toEqual(gridKinds);
    expect(s2.summary, '줄바 머리 = 칸 1 · 2번째 줄').toContain('칸 1');
    expect(s2.summary).toContain('2번째 줄');
    expect(s2.kindSel, '줄 꾸미기(종류) 절').toBe(true);
    expect(s2.marked, '줄 표시 1 = 고른 줄').toEqual(['0:1']);
    expect(s2.barAfterHeader, '줄 절이 헤더 바로 아래').toBe(true);
    expect(s2.lineCards, '칸 카드의 줄 카드·「+ 줄 추가」·× = 0(걷었다)').toBe(0);
    expect(s2.cellCards, '칸 카드는 그대로(2×2 = 4)').toBe(4);
    expect(s2.expanded, '고른 칸 카드가 펼쳐져 있다').toContain('0');
    // 2×2 의 넷째 칸(칸 번호 3) 줄 — 머리에 「칸 4 (2,2)」
    await pickLine(page, 3, 1);
    const sum4 = await page.evaluate(() => document.getElementById('grd-line-summary')?.textContent || '');
    expect(sum4).toContain('칸 4 (2,2)');
    expect(await page.evaluate(() => [...document.querySelectorAll('#panel-right .prop-cell-card.expanded')].map(e => e.dataset.cellIdx)), '칸 4 카드 펼침').toContain('3');
    // 줄 밖(잎 위) 클릭 = 칸 선택(li:null)
    const leaf = await waitStableRect(page, '#sB .laurel-block .laurel-cell[data-cell-idx="1"] .laurel-leaf-left');
    await page.mouse.click(leaf.cx, leaf.cy);
    await expect.poll(() => active(page), '잎 클릭 = 칸 선택').toEqual({ r: 1, c: 0, li: null });
    expect(await page.evaluate(() => !!document.getElementById('grd-line-add-kind')), '칸만 골라도 줄바(+ 줄 추가)').toBe(true);
    expect(errs).toEqual([]);
  });

  test('LL6 C2 T·G·⌫·Esc 가 «고른 줄»에 먹는다 · ⌘Z 한 걸음 · 마지막 줄까지 지우면 빈 칸(잎만)', async ({ page }) => {
    const errs = await setup2(page);
    const textBlocks0 = await page.evaluate(() => document.querySelectorAll('#sB .text-block').length);
    const gaps0 = await page.evaluate(() => document.querySelectorAll('#sB .gap-block').length);
    const before = await page.evaluate(() => document.getElementById(window.__bid).dataset.cells);
    await pickLine(page, 0, 0);
    const h0 = await histLen(page);
    await page.keyboard.press('t');
    await expect.poll(async () => (await cellsOf(page))[0].lines.length).toBe(3);
    let c = await cellsOf(page);
    expect(c[0].lines[1].type, 'T = 고른 줄 «다음»에 본문 줄').toBe('body');
    expect(c[0].lines[1].text).toBe('');
    expect(await active(page), '새 줄이 활성').toEqual({ r: 0, c: 0, li: 1 });
    expect(await page.evaluate(() => document.querySelectorAll('#sB .text-block').length), '새 텍스트 블럭이 안 생겼다(옛 증상)').toBe(textBlocks0);
    expect(await page.evaluate(() => document.getElementById(window.__bid).classList.contains('selected')), 'laurel 선택 유지').toBe(true);
    expect(c[1].lines.map(l => l.type), '«쓰기 하나» — 한 번 쓰면 모든 칸이 새 꼴').toEqual(['body']);
    expect(await histLen(page), '이력 +1 칸(push-before + 끝 표본이 한 걸음)').toBeGreaterThan(h0);
    await page.keyboard.press('g');
    await expect.poll(async () => (await cellsOf(page))[0].lines.map(l => l.type)).toEqual(['body', 'body', 'gap', 'body']);
    expect(await page.evaluate(() => document.querySelectorAll('#sB .gap-block').length), 'G = 여백 «줄»(새 여백 블럭 아님)').toBe(gaps0);
    // ⌫ — 고른 줄(여백)을 지운다
    expect(await active(page)).toEqual({ r: 0, c: 0, li: 2 });
    await page.keyboard.press('Delete');
    await expect.poll(async () => (await cellsOf(page))[0].lines.map(l => l.type)).toEqual(['body', 'body', 'body']);
    expect(await page.evaluate(() => document.querySelectorAll('#sB .laurel-block').length), '블럭은 그대로').toBe(1);
    // ⌘Z 두 번 = G·⌫ 전 → 한 번 더 = T 전(옛 문자열 바이트 그대로)
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('Meta+z'); await expect.poll(async () => (await cellsOf(page))[0].lines.length).toBe(4);
    await page.keyboard.press('Meta+z'); await expect.poll(async () => (await cellsOf(page))[0].lines.length).toBe(3);
    await page.keyboard.press('Meta+z');
    await expect.poll(() => page.evaluate(() => document.getElementById(window.__bid).dataset.cells), '⌘Z 한 번씩 — T 전 옛 꼴 문자열 그대로').toBe(before);
    // 마지막 줄까지 지우기(칸 2 = 줄 하나)
    await page.evaluate(() => window.deselectAll());
    await pickLine(page, 1, 0);
    await page.keyboard.press('Delete');
    await expect.poll(async () => (await cellsOf(page))[1].lines).toEqual([]);
    const empty = await page.evaluate(() => { const cell = document.querySelector('#sB .laurel-block .laurel-cell[data-cell-idx="1"]');
      return { rows: cell.querySelectorAll('.ln-row').length, leaves: cell.querySelectorAll('.laurel-leaf').length, h: cell.getBoundingClientRect().height }; });
    expect(empty.rows, '빈 칸 — 줄 0').toBe(0);
    expect(empty.leaves, '잎은 남는다').toBe(2);
    expect(await active(page), '활성 줄 비움').toBe(null);
    // Esc — 줄 선택만 풀고 블럭은 남는다
    await pickLine(page, 0, 0);
    await page.keyboard.press('Escape');
    await expect.poll(() => active(page)).toBe(null);
    expect(await page.evaluate(() => document.getElementById(window.__bid).classList.contains('selected')), 'Esc 뒤 블럭 선택 유지').toBe(true);
    expect(await page.evaluate(() => document.querySelectorAll('#sB .laurel-block .ln-line-selected').length)).toBe(0);
    expect(errs).toEqual([]);
  });

  test('LL7 C2 ⌘↑/↓ — 칸 안 줄 순서 · 블럭 순서 불변 · ⌘Z 한 번', async ({ page }) => {
    const errs = await setup2(page);
    const order = () => page.evaluate(() => [...document.querySelectorAll('#sB .section-inner > *')].map(e => e.id || e.className.split(' ')[0]));
    const o0 = await order();
    await pickLine(page, 0, 1);
    await page.keyboard.press('Meta+ArrowUp');
    await expect.poll(async () => (await cellsOf(page))[0].lines.map(l => l.text)).toEqual(['고객 만족', '1위']);
    expect(await active(page), '활성 줄이 따라간다').toEqual({ r: 0, c: 0, li: 0 });
    expect(await order(), '블럭이 안 움직였다').toEqual(o0);
    await page.keyboard.press('Meta+ArrowUp');   // 칸 맨 위 — 조용히 소진(블럭 이동으로 새지 않는다)
    expect(await order()).toEqual(o0);
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('Meta+z');
    await expect.poll(async () => (await cellsOf(page))[0].lines.map(l => l.text)).toEqual(['1위', '고객 만족']);
    expect(errs).toEqual([]);
  });

  test('LL8 C2 ⌘→ — 다음 칸(선형 순서)으로 줄 옮기기 · ⌘Z 한 번에 두 칸 다 돌아온다', async ({ page }) => {
    const errs = await setup2(page);
    const before = await page.evaluate(() => document.getElementById(window.__bid).dataset.cells);
    await pickLine(page, 0, 1);
    await page.keyboard.press('Meta+ArrowRight');
    await expect.poll(async () => (await cellsOf(page)).map(c => c.lines.map(l => l.text))).toEqual([['1위'], ['2위', '고객 만족'], ['3위'], ['4위', '넷째 칸 둘째 줄']]);
    expect(await active(page), '활성 줄이 도착 칸 끝').toEqual({ r: 1, c: 0, li: 1 });
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('Meta+z');
    await expect.poll(() => page.evaluate(() => document.getElementById(window.__bid).dataset.cells), '⌘Z 한 번 = 옮기기 전 그대로').toBe(before);
    expect(errs).toEqual([]);
  });

  test('LL9 C2 문 규칙 — cellLines 잣대(종류·범위)·noHistory·옛 꼴 연산(editLine fontWeight)이 새 꼴에 먹는다', async ({ page }) => {
    const errs = await setup2(page);
    const r = await page.evaluate(() => {
      const id = window.__bid; const tip = () => window.getHistoryTip().len;
      const out = {};
      let t0 = tip();
      out.badType = window.updateLaurelBlock(id, { cellLines: { cell: 0, lines: [{ type: 'graph', items: [] }] } });
      out.badCell = window.updateLaurelBlock(id, { cellLines: { cell: 9, lines: [] } });
      out.histOnReject = tip() - t0;
      t0 = tip();
      out.raw = window.updateLaurelBlockRaw(id, { cellLines: { cell: 2, lines: [{ type: 'h2', text: '제목' }, { type: 'divider', height: 2 }] } }, { noHistory: true });
      out.histNoHistory = tip() - t0;
      out.stored2 = JSON.parse(document.getElementById(id).dataset.cells)[2].lines;
      out.divW = document.querySelector('#sB .laurel-block .ln-row[data-ln-m="2"][data-ln="1"]')?.getBoundingClientRect().width || 0;
      out.edit = window.updateLaurelBlock(id, { editLine: { cellIndex: 0, lineIndex: 0, fontWeight: 800, text: '첫째' } });
      const c = JSON.parse(document.getElementById(id).dataset.cells);
      out.line0 = c[0].lines[0];
      out.weight = getComputedStyle(document.querySelector('#sB .laurel-block .ln-row[data-ln-m="0"][data-ln="0"] > .grd-line')).fontWeight;
      out.allTyped = c.every(cell => cell.lines.every(l => typeof l.type === 'string'));
      out.editGap = window.updateLaurelBlock(id, { editLine: { cellIndex: 2, lineIndex: 1, text: 'x' } });
      out.add = window.updateLaurelBlock(id, { addLine: { cellIndex: 1, line: { text: '추가', fontSize: 30, fontWeight: 600 } } });
      out.added = JSON.parse(document.getElementById(id).dataset.cells)[1].lines.at(-1);
      return out;
    });
    expect(r.badType.ok, '명부 밖 종류(graph)는 거절(C4 부터 그림은 명부 안)').toBe(false);
    expect(r.badType.code).toBe('INVALID');
    expect(r.badType.message).toContain('laurel');
    expect(r.badCell.ok, '없는 칸').toBe(false);
    expect(r.histOnReject, '거절은 이력을 안 남긴다').toBe(0);
    expect(r.raw.ok).toBe(true);
    expect(r.histNoHistory, 'Raw + noHistory = 이력 0칸').toBe(0);
    expect(r.stored2, '새 꼴 그대로 저장').toEqual([{ type: 'h2', text: '제목' }, { type: 'divider', height: 2 }]);
    expect(r.divW, '구분선 줄이 스택 폭으로 펴져 보인다').toBeGreaterThan(10);
    expect(r.edit.ok).toBe(true);
    expect(r.line0, 'editLine{fontWeight} → 새 꼴 weight(문자) · 다른 꾸밈 보존').toEqual({ type: 'body', text: '첫째', fontSize: 56, weight: '800', color: '#1a1a1a', lineHeight: 1.1 });
    expect(r.weight, '화면 굵기 800').toBe('800');
    expect(r.allTyped, '«쓰기 하나» — 모든 칸 새 꼴').toBe(true);
    expect(r.editGap.ok, '글자 아닌 줄(구분선)을 editLine → 거절').toBe(false);
    expect(r.editGap.code).toBe('INVALID');
    expect(r.add.ok).toBe(true);
    expect(r.added, 'addLine 옛 필드 → 새 꼴').toEqual({ type: 'body', text: '추가', fontSize: 30, weight: '600', color: '#1a1a1a', lineHeight: 1.1 });
    expect(errs).toEqual([]);
  });

  test('LL10 C2 하위호환 — 옛 저장본(lines 키 없는 칸 · 옛 꼴 줄) 열기만 하면 데이터 무변 · 첫 편집에 새 꼴 · ⌘Z 로 옛 문자열', async ({ page }) => {
    const errs = await setup2(page);
    const r = await page.evaluate(() => {
      const b = document.getElementById(window.__bid);
      const OLD = JSON.stringify([{ leafColor: '#1a1a1a', gap: 24, height: 140 }, { lines: [{ text: '옛', fontSize: 40, fontWeight: 600, color: '#123456' }], leafColor: '#1a1a1a', gap: 24, height: 140 },
        { lines: [{ text: 'c' }] }, { lines: [{ text: 'd' }] }]);
      b.dataset.cells = OLD; window.rebindAll?.();
      const b2 = document.getElementById(window.__bid);
      return { OLD, same: b2.dataset.cells === OLD, t0: b2.querySelector('.ln-row[data-ln-m="0"][data-ln="0"]')?.textContent, rows0: b2.querySelectorAll('.ln-row[data-ln-m="0"]').length };
    });
    expect(r.same, '열기(rebindAll) 뒤 바이트 같음').toBe(true);
    expect(r.t0, 'lines 키 없는 칸 = 옛 「1위」 기본 줄').toBe('1위');
    expect(r.rows0).toBe(1);
    await page.evaluate(() => window.clearHistory?.());
    await pickLine(page, 1, 0);
    await page.keyboard.press('t');
    await expect.poll(async () => (await cellsOf(page))[1].lines.length).toBe(2);
    const c = await cellsOf(page);
    expect(c[1].lines[0], '옛 줄이 새 꼴로(값 그대로)').toEqual({ type: 'body', text: '옛', fontSize: 40, weight: '600', color: '#123456', lineHeight: 1.1 });
    expect('lines' in c[0], 'lines 키 없는 칸은 그대로(렌더 폴백)').toBe(false);
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('Meta+z');
    await expect.poll(() => page.evaluate(() => document.getElementById(window.__bid).dataset.cells), '⌘Z 한 번 = 옛 꼴 문자열 그대로').toBe(r.OLD);
    expect(errs).toEqual([]);
  });
});

/* ══ C3 — 내보내기(Figma JSON) · AI 채움 ═════════════════════════════════════════════════════════
 * 음성대조(1회 실측 · 생성기 C3): js/io/export-figma-json.js laurel 갈래의
 *   `if (typeof window._lrlFigmaCells === 'function') cells = window._lrlFigmaCells(cells);` 를 빼면 → LL11 빨강
 *   (새 꼴 블럭이 type·weight 를 그대로 보내 수신측이 읽는 fontWeight 가 없다 · 여백/구분선 줄이 섞인다). */
const findLaurelJson = (page) => page.evaluate(() => {
  const want = window.__bid; let hit = null;
  const walk = (o) => { if (hit || !o || typeof o !== 'object') return; if (o.type === 'laurel' && o.id === want) { hit = o; return; } for (const k in o) walk(o[k]); };
  window.flushCurrentPage?.();   // 내보내기는 state.pages(직렬화본)를 읽는다 — 지금 캔버스를 먼저 싣는다(asset-redact R10 과 같은 꼴)
  walk(window.buildFigmaExportJSON(null));
  return hit;
});
/* b6e85227 의 laurel 갈래 식 그대로(고정): `cells = JSON.parse(el.dataset.cells)` 를 «그대로» 실었다 — 옛 꼴 블럭의 옛 산출. */
const OLD_FIGMA_CELLS = (page) => page.evaluate(() => JSON.parse(document.getElementById(window.__bid).dataset.cells));

test.describe('laurel 줄 — C3 Figma JSON · AI 채움', () => {
  test('LL11 C3 Figma JSON — 새 꼴 블럭의 cells 가 같은 내용 옛 꼴 블럭의 옛 산출(b6e85227 식)과 같다 · 글자 줄만 · 옛 이름(fontWeight 숫자)', async ({ page }) => {
    const errs = await setup(page, C2_CELLS, 2, 2);
    const oldOut = await OLD_FIGMA_CELLS(page);
    expect(oldOut[0].lines[0].type, '전제 — 옛 꼴 블럭(type 없음)').toBe(undefined);
    const j0 = await findLaurelJson(page);
    expect(j0, '전제 — 내보내기에 그 laurel 이 있다').not.toBe(null);
    expect(j0.cells, '옛 꼴 블럭 — 지금 산출 = 옛 산출(바이트 같은 값)').toEqual(oldOut);
    // 같은 내용을 새 꼴로(아무 쓰기 한 번 — «쓰기 하나»)
    const typed = await page.evaluate(() => { window.updateLaurelBlock(window.__bid, { layerName: 'L' });
      return JSON.parse(document.getElementById(window.__bid).dataset.cells).every(c => c.lines.every(l => typeof l.type === 'string')); });
    expect(typed, '전제 — 저장 꼴이 새 꼴이 됐다').toBe(true);
    const j1 = await findLaurelJson(page);
    expect(j1.cells, '새 꼴 블럭 — 옛 꼴 블럭의 옛 산출과 같다').toEqual(oldOut);
    expect(typeof j1.cells[0].lines[0].fontWeight, 'fontWeight = 숫자(수신측이 읽는 이름)').toBe('number');
    // 글자 아닌 줄은 빠지고, 색·꾸밈 없는 새 글자 줄은 렌더와 같은 값으로 채운다
    await page.evaluate(() => window.updateLaurelBlock(window.__bid, { cellLines: { cell: 1, lines: [
      { type: 'h3', text: '위' }, { type: 'gap', height: 16 }, { type: 'divider', height: 1 }, { type: 'body', text: '아래', weight: '600' }, { type: 'label', text: '라벨' }] } }));
    const j2 = await findLaurelJson(page);
    const rendered = await page.evaluate(() => [...document.querySelectorAll('#sB .laurel-block .ln-row[data-ln-m="1"] > .grd-line')].map(e => { const s = getComputedStyle(e); return { fs: parseFloat(s.fontSize), fw: Number(s.fontWeight), c: s.color }; }));
    expect(j2.cells[1].lines.map(l => l.text), '글자 줄만 · 순서 그대로').toEqual(['위', '아래', '라벨']);
    expect(j2.cells[1].lines.map(l => [l.fontSize, l.fontWeight]), '크기·굵기 = 화면에 그려진 값').toEqual(rendered.map(r => [r.fs, r.fw]));
    expect(rendered.every(r => r.c === 'rgb(26, 26, 26)'), '전제 — 색 없는 줄은 laurel 글자색으로 그린다').toBe(true);
    expect(j2.cells[1].lines.every(l => l.color === '#1a1a1a'), '색 = 그려진 laurel 글자색').toBe(true);
    expect(j2.cells[1].lines[2].letterSpacing, '라벨 역할 자간 0.04em × 16 = 0.64px').toBe(0.64);
    expect(j2.cells[1].lines.every(l => !('type' in l) && !('weight' in l)), '새 이름은 안 샌다').toBe(true);
    expect(errs).toEqual([]);
  });

  test('LL12 C3 AI 채움 — 글자 줄만 슬롯 · 글자 아닌 줄엔 안 쓴다 · 쓰기/새 줄 = 새 꼴 · 글자 바꾸면 textHtml 지움', async ({ page }) => {
    const errs = await setup(page, C2_CELLS, 2, 2);
    await page.evaluate(() => window.updateLaurelBlockRaw(window.__bid, { cellLines: { cell: 0, lines: [
      { type: 'h2', text: '제목', textHtml: '<b>제</b>목' }, { type: 'gap', height: 16 }, { type: 'body', text: '본문', color: '#333333' }] } }, { noHistory: true }));
    const r = await page.evaluate(() => {
      const sec = document.getElementById('sB'); const id = window.__bid;
      const slots = window.collectSectionTextBlocks(sec).filter(x => x.id.startsWith(`lrl:${id}:`)).map(x => x.id.split(':').slice(2).join(':'));
      const applied = window.applyAIReplacements(sec, [
        { id: `lrl:${id}:0:1`, text: '여백에 쓰면 안 됨' },
        { id: `lrl:${id}:0:0`, text: '새 제목' },
        { id: `lrl:${id}:0:5`, text: '추가 줄' },
        { id: `lrl:${id}:1:0`, text: '이위' },
      ], [], {});
      return { slots, applied, cells: JSON.parse(document.getElementById(id).dataset.cells) };
    });
    expect(r.slots, '슬롯 = 글자 줄만(칸0 의 여백 줄 1 은 없다)').toEqual(['0:0', '0:2', '1:0', '2:0', '3:0', '3:1']);
    const c0 = r.cells[0].lines;
    expect(c0[1], '여백 줄 무변(글자 안 생김)').toEqual({ type: 'gap', height: 16 });
    expect(c0[0], '글자 줄 쓰기 — 역할 유지 · textHtml 지움').toEqual({ type: 'h2', text: '새 제목' });
    expect(c0.length, '새 줄 하나').toBe(4);
    expect(c0[3], '새 줄 = 마지막 글자 줄 꾸밈 시드 · 새 꼴').toEqual({ type: 'body', text: '추가 줄', color: '#333333' });
    expect(r.cells[1].lines[0], '옛 꼴 줄 쓰기 → 새 꼴(값 그대로)').toEqual({ type: 'body', text: '이위', fontSize: 56, weight: '700', color: '#1a1a1a', lineHeight: 1.1 });
    expect(r.cells.every(c => c.lines.every(l => typeof l.type === 'string')), '«쓰기 하나» — 모든 칸 새 꼴').toBe(true);
    expect(await page.evaluate(() => document.querySelector('#sB .laurel-block .ln-row[data-ln-m="0"][data-ln="3"]')?.textContent), '화면에 새 줄').toBe('추가 줄');
    expect(errs).toEqual([]);
  });
});

/* ══ C4 — 그림(에셋) 줄 ═══════════════════════════════════════════════════════════════════════
 * 음성대조(1회 실측 · 생성기 C4): js/blocks/laurel-block.js _lrlDecorateLinesHtml ⑷ 의
 *   `img.style.height = hpx + 'px';` 를 빼면 → LL13 빨강(iconify 꼴 svg 가 1em = 16px 로 그려진다)
 *   실측 2026-10-13: 3 failed(LL13 높이 16 · LL14 · LL15 — 셋 다 그 꾸밈을 잰다) / 13 passed · 되돌린 뒤 cmp 같음. */
const ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h20v20H2z"/></svg>';
const imgBox = (page, ci, li) => page.evaluate(async ([ci, li]) => {
  const im = document.querySelector(`#sB .laurel-block .ln-row[data-ln-m="${ci}"][data-ln="${li}"] img`);
  if (!im) return null;
  try { await im.decode(); } catch (_) {}
  const q = im.getBoundingClientRect(); return { w: q.width, h: q.height, nw: im.naturalWidth };
}, [ci, li]);

test.describe('laurel 줄 — C4 그림(에셋) 줄', () => {
  test('LL13 C4 K = 아이콘 그림 줄(높이 64 · 폭 auto) · 이미지 절(높이 켬 · 폭·자르기 절 숨김) · 높이 바꾸면 따라감 · ⌘Z 한 걸음', async ({ page }) => {
    const errs = await setup(page, C2_CELLS, 2, 2);
    await page.evaluate((svg) => { window.deselectAll(); window.clearHistory?.(); window.__iconCalls = 0; window.openIconifyModal = (cb) => { window.__iconCalls++; cb({ svg, size: 64 }); }; }, ICON_SVG);
    const before = await page.evaluate(() => document.getElementById(window.__bid).dataset.cells);
    await pickLine(page, 0, 0);
    await page.keyboard.press('k');
    await expect.poll(async () => (await cellsOf(page))[0].lines.map(l => l.type)).toEqual(['body', 'image', 'body']);
    expect(await page.evaluate(() => window.__iconCalls), '피커 1번').toBe(1);
    expect(await active(page), '새 그림 줄이 활성').toEqual({ r: 0, c: 0, li: 1 });
    const line = (await cellsOf(page))[0].lines[1];
    expect(line.height, '저장 높이 = 피커 크기').toBe(64);
    expect(line.imgSrc.startsWith('data:image/svg+xml'), '아이콘 = data URI').toBe(true);
    await expect.poll(async () => (await imgBox(page, 0, 1))?.h ?? 0, '화면 높이 64').toBeGreaterThan(63);
    const b1 = await imgBox(page, 0, 1);
    expect(Math.abs(b1.h - 64), `높이 64±1 — ${b1.h}`).toBeLessThanOrEqual(1);
    expect(Math.abs(b1.w - 64), `정사각 아이콘 폭 auto = 64±1 — ${b1.w}`).toBeLessThanOrEqual(1);
    const P = await page.evaluate(() => ({ pick: !!document.getElementById('grd-img-pick-btn'), h: document.getElementById('grd-img-height'),
      hDisabled: document.getElementById('grd-img-height')?.disabled, wHidden: document.getElementById('grd-img-width-pct')?.closest('.prop-row')?.style.display === 'none',
      clip: !!document.getElementById('grd-img-clip-toggle'), typo: !!document.getElementById('grd-typo-color'),
      addKinds: [...(document.getElementById('grd-line-add-kind')?.options || [])].map(o => o.value) }));
    expect(P.pick, '이미지 절 「이미지 교체…」').toBe(true);
    expect(P.hDisabled, '높이 칸 켜짐(laurel 은 높이를 읽는다)').toBe(false);
    expect(P.wHidden, '폭(%) 숨김').toBe(true);
    expect(P.clip, '「이미지 표시/내용 자르기」 절 없음').toBe(false);
    expect(P.typo, '그림 줄엔 Typography 없음').toBe(false);
    expect(P.addKinds).toContain('image');
    await page.evaluate(() => { const i = document.getElementById('grd-img-height'); i.value = '96'; i.dispatchEvent(new Event('change', { bubbles: true })); });
    await expect.poll(async () => (await cellsOf(page))[0].lines[1].height).toBe(96);
    await expect.poll(async () => Math.round((await imgBox(page, 0, 1))?.h ?? 0), '높이 바꾸면 화면도 96').toBe(96);
    // Figma·AI 는 그림 줄을 건너뛴다(C3 규약 그대로)
    const skip = await page.evaluate(() => { window.flushCurrentPage?.(); let hit = null;
      const walk = (o) => { if (hit || !o || typeof o !== 'object') return; if (o.type === 'laurel' && o.id === window.__bid) { hit = o; return; } for (const k in o) walk(o[k]); };
      walk(window.buildFigmaExportJSON(null));
      const slots = window.collectSectionTextBlocks(document.getElementById('sB')).filter(x => x.id.startsWith(`lrl:${window.__bid}:0:`)).map(x => x.id.split(':')[3]);
      return { figma: hit.cells[0].lines.map(l => l.text), slots }; });
    expect(skip.figma, 'Figma — 그림 줄 빠짐').toEqual(['1위', '고객 만족']);
    expect(skip.slots, 'AI 슬롯 — 그림 줄(1) 없음').toEqual(['0', '2']);
    // ⌘Z — 높이 바꾸기 → K 순으로 한 걸음씩
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('Meta+z'); await expect.poll(async () => (await cellsOf(page))[0].lines[1]?.height).toBe(64);
    await page.keyboard.press('Meta+z');
    await expect.poll(() => page.evaluate(() => document.getElementById(window.__bid).dataset.cells), '⌘Z — K 전 문자열 그대로').toBe(before);
    expect(errs).toEqual([]);
  });

  test('LL14 C4 「이미지 교체…」 — 파일창은 «한 번 부르기만»(가로챔) · 고른 파일이 data URL 로 그 줄에 · 큰 그림은 높이 그대로 비율 유지', async ({ page }) => {
    const errs = await setup(page, C2_CELLS, 2, 2);
    await page.evaluate((svg) => { window.deselectAll(); window.openIconifyModal = (cb) => cb({ svg, size: 64 }); }, ICON_SVG);
    await pickLine(page, 1, 0);
    await page.keyboard.press('k');
    await expect.poll(async () => (await cellsOf(page))[1].lines.length).toBe(2);
    // ⛔파일창을 열지 않는다 — click 을 가로채 «부른 횟수»만 세고, 그 input 에 만든 PNG(240×80)를 넣어 change 를 쏜다.
    await page.evaluate(async () => {
      window.__fileClicks = 0;
      const cv = document.createElement('canvas'); cv.width = 240; cv.height = 80; const g = cv.getContext('2d'); g.fillStyle = '#c00'; g.fillRect(0, 0, 240, 80);
      const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
      window.__pngFile = new File([blob], 'wide.png', { type: 'image/png' });
      const orig = HTMLInputElement.prototype.click;
      HTMLInputElement.prototype.click = function () {
        if (this.type !== 'file') return orig.call(this);
        window.__fileClicks++;
        const dt = new DataTransfer(); dt.items.add(window.__pngFile); this.files = dt.files;
        this.dispatchEvent(new Event('change'));
      };
    });
    await page.click('#grd-img-pick-btn');
    await expect.poll(async () => String((await cellsOf(page))[1].lines[1].imgSrc).slice(0, 22), '그 줄 imgSrc = 고른 파일의 data URL').toBe('data:image/png;base64,');
    expect(await page.evaluate(() => window.__fileClicks), '파일창 부르기 1번(열지 않음)').toBe(1);
    expect((await cellsOf(page))[1].lines[1].height, '높이는 그대로').toBe(64);
    await expect.poll(async () => (await imgBox(page, 1, 1))?.nw ?? 0, '새 그림이 디코드됐다').toBe(240);
    const b = await imgBox(page, 1, 1);
    expect(Math.abs(b.h - 64), `높이 64 — ${b.h}`).toBeLessThanOrEqual(1);
    expect(Math.abs(b.w - 192), `폭 = 64 × 240/80 = 192 (비율 유지) — ${b.w}`).toBeLessThanOrEqual(1);
    expect(errs).toEqual([]);
  });

  test('LL15 C4 저장 왕복 — 그림 줄이 serializeProject → applyProjectData 뒤에도 그대로(데이터·높이)', async ({ page }) => {
    await setup(page, C2_CELLS, 2, 2);
    await page.evaluate((svg) => {
      const src = 'data:image/svg+xml;base64,' + btoa(svg);
      window.updateLaurelBlock(window.__bid, { cellLines: { cell: 2, lines: [{ type: 'image', imgSrc: src, height: 80 }, { type: 'h3', text: '아래' }] } });
    }, ICON_SVG);
    const snap = await page.evaluate(() => { window.flushCurrentPage?.(); return window.serializeProject(); });
    const cells0 = await page.evaluate(() => document.getElementById(window.__bid).dataset.cells);
    const bid = await page.evaluate(() => window.__bid);
    const errs2 = await bootApp(page);
    await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
    await page.waitForFunction((id) => !!document.getElementById(id)?.querySelector('.ln-row[data-ln-m="2"][data-ln="0"] img'), bid);
    await page.evaluate((id) => { window.__bid = id; window.applyZoom?.(100); document.getElementById(id).scrollIntoView({ block: 'center' }); }, bid);
    expect(await page.evaluate(() => window.currentZoom), '전제 — 배율 100(화면 px = 모델 px)').toBe(100);
    expect(await page.evaluate(() => document.getElementById(window.__bid).dataset.cells), '데이터 바이트 같음').toBe(cells0);
    await expect.poll(async () => Math.round((await imgBox(page, 2, 0))?.h ?? 0), '다시 연 뒤 높이 80').toBe(80);
    expect(errs2).toEqual([]);
  });
});
