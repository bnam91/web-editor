/* visual17-css-home.dom.spec.js — VISUAL-17-TOOLBAR-CSS-HOME-01(현빈 261119 · 0.9.13 147행 · AUDIT-visual-svg #17)
 * 한 일: 하단 플로팅 툴바 단추 규칙(fp-btn 묶음)을 editor-toast.css → css/floating-toolbar.css(index.html 에서 editor-toast.css «바로 앞»),
 *   섹션 툴바 A/B·AI 단추 색을 panels/_panel-tree.css → editor-layout.css(.st-btn 옆)로 «옮기기만». 목표 = 화면 변화 0.
 * 위험: CSS 는 같은 무게면 «나중에 읽힌 쪽»이 이긴다 — 파일을 옮기면 이기던 규칙이 질 수 있다.
 * 자: 같은 하네스(bootApp)로 두 판을 띄운다 —
 *   지금 판 = 작업 트리 그대로 · 옛 판 = 옮긴 세 파일을 BASE 내용으로(overlay) + 새 파일 404(= 링크가 없던 때와 같다).
 *   js·html 은 같으니 차이는 «규칙 자리» 뿐. 두 판에서 툴바 단추 전부 + 섹션 툴바 A/B·AI(·바쁨) 단추의 계산된 스타일을
 *   ① 가만히 ② 마우스 올림(:hover · 전이 끔) 으로 읽어 «완전히 같다».
 *   BASE = env VISUAL17_BASE 또는 `git merge-base HEAD origin/dev`.
 * 자 양성대조(늘): 새 파일만 404 인 셋째 판은 지금 판과 «달라야» 한다(규칙이 빠지면 자가 차이를 본다).
 * CTL = _patches/visual5-147-CTL-link-after.patch(새 파일을 editor-toast.css «뒤»로 링크) → 드롭다운 트리거 width 등이 달라 빨강.
 */
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const { bootApp, ROOT } = require('./_root-harness.js');

const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8' }).trim();
const BASE = process.env.VISUAL17_BASE || git('merge-base', 'HEAD', 'origin/dev');
const MOVED = ['css/editor-toast.css', 'css/editor-layout.css', 'css/panels/_panel-tree.css'];
const NEW = '/css/floating-toolbar.css';
const pinned = () => {
  const m = new Map(MOVED.map((f) => ['/' + f, execFileSync('git', ['-C', ROOT, 'show', `${BASE}:${f}`])]));
  m.set(NEW, null);
  return m;
};

const PROPS = ['width', 'height', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'gap', 'display',
  'background-color', 'border-top-color', 'border-top-width', 'border-top-style', 'border-radius', 'color', 'font-size',
  'opacity', 'pointer-events', 'cursor', 'transition-duration', 'transition-property'];
const HOVER = ['#floating-panel .fp-btn:not(.primary):not(.fp-btn-ai):not(.fp-dropdown-trigger)', '#floating-panel .fp-btn.primary',
  '#floating-panel .fp-btn-ai', '#floating-panel .fp-dropdown-trigger', '[data-v17="ab"]', '[data-v17="ai"]'];

async function scene(page, overlay) {
  const errs = await bootApp(page, overlay ? { overlay } : undefined);
  /* 관리자 판 화면을 시험이 직접 세운다(지혜맥 261120 [전제] 빨강): index.html dev-gate 는 isAdmin() 이 거짓이면 ✨ AI·Claude PM 단추를
     인라인 display:none 으로 숨기는데 «비동기 한 번»이라 판마다 읽는 때가 갈렸다. 하네스 가짜 electronAPI 는 isAdmin → null(=비관리자) —
     ① 그 숨김이 «돈 뒤»를 조건으로 기다리고 ② 두 판 모두 인라인 display 를 걷어 관리자 화면(보임)으로 맞춘다. 규칙 비교 대상은 CSS 뿐. */
  const GATED = ['ai-btn', 'claude-pm-btn'];
  await expect.poll(() => page.evaluate((ids) => ids.every((id) => { const e = document.getElementById(id); return !e || e.style.display === 'none'; }), GATED),
    '[전제] dev-gate(비관리자 숨김)가 돌았다').toBe(true);
  await page.evaluate((ids) => ids.forEach((id) => document.getElementById(id)?.style.removeProperty('display')), GATED);
  await page.click('.fp-btn.primary[title="새 섹션 추가"]');
  await expect.poll(() => page.evaluate(() => !!document.querySelector('.section-block.selected .section-toolbar'))).toBe(true);
  /* 섹션 툴바 시료 — «두 판에 같은 꼴로» 늘 셋을 넣고, 읽을 때도 이 셋만(data-v17 이름으로) 읽는다.
     (인텔 261120 빨강: 앱이 AI 단추를 늦게 붙여 «DOM 순번»이 판마다 달랐다 — 바쁨 표시가 다른 단추와 짝지어짐 = CSS 차이 아닌 장면 차이) */
  await page.evaluate(() => {
    const tb = document.querySelector('.section-block.selected .section-toolbar');
    tb.insertAdjacentHTML('beforeend', '<button class="st-btn st-ab-btn" data-v17="ab">AB</button>'
      + '<button class="st-btn st-ai-fill-btn" data-v17="ai">AI</button>'
      + '<button class="st-btn st-ai-fill-btn is-busy" data-v17="busy">AI</button>');
  });
  await page.mouse.move(2, 2);   // 「새 섹션 추가」 위에 남은 마우스를 치운다(가만히 읽기)
  return errs;
}
/* 이름표 = id · 없으면 «클래스@같은 클래스 안 순번» · 시료는 data-v17 — 전체 DOM 순번에 기대지 않는다 */
const readAll = (page) => page.evaluate((props) => {
  const out = {}, nth = {};
  const put = (k, e) => { const cs = getComputedStyle(e); out[k] = Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)])); };
  document.querySelectorAll('#floating-panel .fp-btn, #floating-panel .fp-dropdown-trigger').forEach((e) => {
    if (e.id) return put('#' + e.id, e);
    nth[e.className] = (nth[e.className] || 0) + 1;
    put(`${e.className}@${nth[e.className]}`, e);
  });
  document.querySelectorAll('[data-v17]').forEach((e) => put('probe:' + e.dataset.v17, e));
  return out;
}, PROPS);
/* 단추 «목록»이 멎을 때까지(두 번 연속 같은 이름표) — 늦게 붙는 단추가 한쪽 판에만 잡히지 않게 */
async function readStable(page) {
  let prev = null;
  await expect.poll(async () => { const cur = JSON.stringify(Object.keys(await readAll(page)).sort()); const same = cur === prev; prev = cur; return same; }).toBe(true);
  return readAll(page);
}
async function readHover(page) {
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none !important;animation:none !important}' });
  const out = {};
  for (const sel of HOVER) {
    const loc = page.locator(sel).first();
    expect(await page.locator(sel).count(), `[전제] ${sel} 있음`).toBeGreaterThan(0);
    const box = await loc.boundingBox();
    expect(box, `[전제] ${sel} 보임`).not.toBeNull();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    /* 누를 점의 임자 = 그 단추(또는 그 안) — 두 번 연속 같은 답일 때 */
    await expect.poll(() => page.evaluate(([s, x, y]) => { const t = document.querySelector(s); const h = document.elementFromPoint(x, y); return !!t && !!h && (t === h || t.contains(h)); }, [sel, cx, cy])).toBe(true);
    await expect.poll(() => page.evaluate(([s, x, y]) => { const t = document.querySelector(s); const h = document.elementFromPoint(x, y); return !!t && !!h && (t === h || t.contains(h)); }, [sel, cx, cy])).toBe(true);
    await page.mouse.move(cx, cy);
    await expect.poll(() => page.evaluate((s) => document.querySelector(s).matches(':hover'), sel)).toBe(true);
    out[sel] = await page.evaluate(([s, props]) => { const cs = getComputedStyle(document.querySelector(s)); return Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)])); }, [sel, PROPS]);
    await page.mouse.move(2, 2);
  }
  return out;
}

test('V17 규칙 자리만 옮김 — 툴바 단추 계산된 스타일(가만히·hover) 옛 판과 같다', async ({ browser }) => {
  const ctxA = await browser.newContext(), ctxB = await browser.newContext();
  const now = await ctxA.newPage(), old = await ctxB.newPage();
  const eNow = await scene(now), eOld = await scene(old, pinned());
  expect(eNow, '지금 판 페이지 오류 0').toEqual([]);
  expect(eOld, '옛 판 페이지 오류 0').toEqual([]);
  const a = await readStable(now), b = await readStable(old);
  expect(Object.keys(a).length, '[전제] 툴바 단추를 찍었다(플로팅 + 시료 3)').toBeGreaterThan(10);
  expect(['probe:ab', 'probe:ai', 'probe:busy'].every((k) => k in a), '[전제] 섹션 툴바 시료 셋').toBe(true);
  expect(Object.keys(a).sort(), '[전제] 두 판 단추 목록 같음(장면 같음)').toEqual(Object.keys(b).sort());
  expect(a, '가만히 — 단추마다 계산된 스타일 같음').toEqual(b);
  expect(await readHover(now), 'hover — 같음').toEqual(await readHover(old));
  await ctxA.close(); await ctxB.close();
});

test('V17 자 양성대조 — 새 파일이 빠진 판은 지금 판과 다르다', async ({ browser }) => {
  const ctxA = await browser.newContext(), ctxC = await browser.newContext();
  const now = await ctxA.newPage(), miss = await ctxC.newPage();
  await scene(now); await scene(miss, new Map([[NEW, null]]));
  expect(await readStable(miss), '규칙이 빠지면 자가 차이를 본다').not.toEqual(await readStable(now));
  await ctxA.close(); await ctxC.close();
});
