/* laurel-lines.dom.spec.js — 1013t1B2 laurel(월계관) 줄을 line-host 의 «네 번째 주인»으로 (2026-10-13 · S1-1013 하네스)
 *
 * ★현빈 원문(1013t1B2): 「laurel 블럭의 경우 우측패널에 셀별로 줄추가 … 그리드의 칸과 줄을 삽입하는 것과 같은 방식으로 …
 *   줄 추가하는 부분 일관성 유지해줘.」
 * ★단계 C1(이 파일의 LL0~LL4) — 모든 줄을 «한 렌더 길»(lnLinesHtml = 그리드 줄 렌더)로 그린다.
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
 *   LL3·LL4 는 이 셋과 무관해 초록(그 둘의 음성대조는 안 쟀다).
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

async function setup(page, cells = OLD_CELLS, cols = 2) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(([cells, cols, sec]) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', sec);
    window.rebindAll?.(); window.applyZoom?.(100);
    window.deselectAll?.(); window.selectSection(document.getElementById('sB'));
    window.addLaurelBlock({ gridCols: cols, cells });
    window.__blk = [...document.querySelectorAll('#sB .laurel-block')].pop();
    window.__bid = window.__blk?.id;
    window.buildLayerPanel?.(); window.deselectAll?.();
    window.__blk?.scrollIntoView({ block: 'center' });
  }, [cells, cols, SEC]);
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

  test('LL4 C1 더블클릭 글자 편집(옛 동작) — 새 줄 DOM 에서도 열리고 Enter 로 그 줄 text 만 바뀐다', async ({ page }) => {
    const errs = await setup(page);
    const sel = '#sB .laurel-block .laurel-cell[data-cell-idx="0"] .ln-row[data-ln="1"] > .grd-line';
    const p = await waitStableRect(page, sel);
    await page.mouse.dblclick(p.cx, p.cy);
    await expect.poll(() => page.evaluate((s) => document.querySelector(s)?.getAttribute('contenteditable'), sel)).toBe('true');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('바뀐 글');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => JSON.parse(document.getElementById(window.__bid).dataset.cells)[0].lines[1].text)).toBe('바뀐 글');
    const after = await page.evaluate(() => JSON.parse(document.getElementById(window.__bid).dataset.cells));
    expect(after[0].lines[1], '그 줄의 다른 필드 보존(옛 꼴 그대로)').toEqual({ ...OLD_CELLS[0].lines[1], text: '바뀐 글' });
    expect(after[0].lines[0]).toEqual(OLD_CELLS[0].lines[0]);
    expect(after[1]).toEqual(OLD_CELLS[1]);
    expect(await page.evaluate((s) => document.querySelector(s)?.textContent, sel), '다시 그린 줄').toBe('바뀐 글');
    expect(errs).toEqual([]);
  });
});
