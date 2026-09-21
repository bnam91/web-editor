/* section-toolbar-order — 「툴바 차례가 «한 번» 뒤집힌다」의 뿌리를 잠근다 (T-140)
 * ──────────────────────────────────────────────────────────────────────────
 * 무엇이 있었나 (2026-09-22 실측, dev fd8f85d ↔ 63191c6 짝 측정):
 *   섹션이 «처음 만들어질 때»와 «rebindAll 을 지난 뒤»의 툴바 차례가 달랐다.
 *     공장(js/block-factory.js)                 [ai-fill, memo]
 *     → _ensureMemoButton 이 memo 를 맨 앞으로   [memo, ai-fill]
 *     → bindVariationToolbarBtn 이 ab 를 맨 앞에 [ab, memo, ai-fill]   ← 갓 만든 섹션
 *     → rebindAll 이 memo 를 다시 맨 앞으로      [memo, ab, ai-fill]   ← 그 뒤 영원히
 *   그 «한 번의 뒤집힘»이 직렬화를 바꾼다(실측: 길이 13025 로 같고 첫 차이가 10683번째 글자).
 *   restoreSnapshot(js/history.js:225)이 rebindAll 을 부르므로 «첫 ⌘Z»가 그걸 일으키고,
 *   복원된 DOM 이 저장 스냅샷과 어긋나 drag-history 의 «시작 표본»이 무변화 차단을 통과해
 *   진짜 항목이 된다 ⇒ 다음 드래그에 «빈 ⌘Z 칸» 하나(T-136).
 *   ★dev 4판 중 3판에서 +2. 뒤집힘을 미리 소진시킨 대조판만 +1 ⇒ 무작위가 아니라 결정적.
 *
 * ★T-136(63191c6)은 «증상»을 닫는다 — 비교자가 .section-toolbar 를 벗긴다.
 *   이건 «뿌리»다 — 애초에 안 뒤집히게 한다. 둘은 다른 자리다.
 *
 * ═══ 자리 규칙 — 이 파일의 알맹이 ═══
 * 툴바에는 «자리를 주장하는» 주입기가 셋 있고, 셋 다 «불릴 때마다 옮긴다»:
 *     📝 memo      js/section-memo.js:194        → 항상 «첫 자식»
 *     🔒 protected js/section-protection.js:214  → 항상 «memo 바로 다음»
 *     ✨ ai-fill   js/ai-section-fill.js:938     → 항상 «맨 뒤»(자체 옵저버가 되민다)
 * ⇒ 비어 있는 칸은 «✨ 바로 앞» 하나뿐이다. A/B 는 거기 둔다.
 *
 * ⛔★고치는 사람이 세 번 틀린 자리다 — 그대로 적어 둔다:
 *   ⑴ «맨 앞»(옛 코드)  → memo 가 되찾아 뒤집힌다. 그게 이 병이다.
 *   ⑵ «memo 다음»       → 🔒 자리였다. **T3 가 잡았다.**
 *   ⑶ «맨 뒤»           → ✨ 자리였다. ★**T1~T4 가 전부 초록인 채로 실앱 측정이 잡았다**
 *                         — 이 하네스에 ✨ 주입기가 없었기 때문이다.
 *   ⇒ ★「다툼을 없앴나」를 물을 땐 «자리를 주장하는 것이 몇이나 되는지»부터 세라.
 *   ⇒ ★모형은 늙는다 — T3·T5 가 «소스에서» 원본 규약이 아직 참인지 먼저 확인한다.
 *
 * ⛔앱을 «안» 띄운다. 실행: npm run test:dom -- section-toolbar-order
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

function router(page, harness, override) {
  return page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: harness });
    if (override && url.pathname === override.path) return route.fulfill({ contentType: 'text/javascript', body: override.body });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
}

/* ★공장이 내는 그 차례 그대로 — [ai-fill, memo]. 베낀 값이라 T6 이 소스와 대조한다. */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div id="canvas">
  <div class="section-block" id="sec1">
    <div class="section-toolbar">
      <button class="st-btn st-ai-fill-btn" type="button">AI</button>
      <button class="st-btn st-memo-btn" type="button">MEMO</button>
    </div>
    <div class="section-inner"></div>
  </div>
</div>
<script src="/js/section-memo.js"></script>
<script type="module">
  import '/js/section-variation.js';
  /* ── 모형 둘 ──────────────────────────────────────────────────────────
     ai-fill : js/ai-section-fill.js:938 tb.appendChild(btn) — 「항상 마지막으로 이동」.
               그 함수는 window 에 안 나와 있다(모듈 안 + 자체 옵저버)라 모형으로 둔다.
     lock    : js/section-protection.js:214 — 「항상 memo 바로 다음」. 모듈을 통째로 실으면
               init hydrate 가 숨은 단추를 더해 «다른 검사의 단추 수»가 흔들린다(실제로 그랬다).
     ⛔둘 다 모형이라 늙는다 — T3·T5 가 소스에서 원본 규약을 먼저 확인한다. */
  window.__aiLast = (sec) => {
    const tb = sec.querySelector(':scope > .section-toolbar');
    const ai = tb.querySelector(':scope > .st-ai-fill-btn');
    if (ai) tb.appendChild(ai);
  };
  window.__lockAfterMemo = (sec) => {
    const tb = sec.querySelector(':scope > .section-toolbar');
    let b = tb.querySelector(':scope > .st-protected-btn');
    if (!b) { b = document.createElement('button'); b.className = 'st-btn st-protected-btn'; b.textContent = 'LOCK'; }
    const memo = tb.querySelector(':scope > .st-memo-btn');
    if (memo) { if (memo.nextElementSibling !== b) tb.insertBefore(b, memo.nextElementSibling); }
    else if (tb.firstElementChild !== b) tb.insertBefore(b, tb.firstElementChild);
  };
  window.__ready = true;
</script></body></html>`;

const FACTORY_TB = '\n      <button class="st-btn st-ai-fill-btn" type="button">AI</button>\n'
  + '      <button class="st-btn st-memo-btn" type="button">MEMO</button>\n    ';

const NAMES = "[...document.querySelectorAll('#sec1 .section-toolbar > .st-btn')].map(b => b.className.replace('st-btn ',''))";

/* 「갓 만든 뒤」 — ★실앱 사다리 그대로(2026-09-22 포트 9626 실측):
     동기 시점    [AI, MEMO]  ← 공장. ✨ 는 아직 «맨 앞»이고 memo hydrate 는 «안» 돈다
     bindVariation 이 ab 를 놓고
     rAF 에 ✨ 자체 옵저버가 저를 맨 뒤로 되민다
   ⛔첫 판의 이 모형은 memo hydrate 를 «먼저» 불렀다 — 실앱과 달라서 ㉠ 의 «시각» 축을
     통째로 못 봤다. 그 탓에 T1~T9 가 초록인 채로 실앱에서 5/5 재현됐다. */
const AFTER_CREATE = '(() => {'
  + " const sec = document.getElementById('sec1');"
  + " sec.querySelector('.section-toolbar').innerHTML = " + JSON.stringify(FACTORY_TB) + ';'
  + '  /* ★공장 모양으로 되돌린다 — 하네스에서 memo 모듈이 로드되며 이미 앞으로 갔기 때문.'
  + '     안 되돌리면 «갓 만든 섹션»이 아니라 «이미 한 번 정리된» 상태를 재게 된다. */'
  + ' window.bindVariationToolbarBtn(sec);'
  + ' window.__aiLast(sec);'
  + ' return ' + NAMES + ';})()';

/* 「rebindAll 을 지난 뒤」 — js/io/save-load.js 가 부르는 그 차례. ai-fill 옵저버도 뒤따른다. */
const AFTER_REBIND = '(() => {'
  + " const sec = document.getElementById('sec1');"
  + ' window.bindVariationToolbarBtn(sec);'
  + ' window._ensureMemoButton(sec);'
  + ' window.__aiLast(sec);'
  + ' return ' + NAMES + ';})()';

/* 🔒 가 «켜진» 섹션 — T3 가 묻는 바로 그 상황. */
const WITH_LOCK = '(() => {'
  + " const sec = document.getElementById('sec1');"
  + " sec.querySelector('.section-toolbar').innerHTML = " + JSON.stringify(FACTORY_TB) + ';'
  + ' window.bindVariationToolbarBtn(sec);'
  + ' window.__aiLast(sec);'
  + ' window._ensureMemoButton(sec);'
  + ' window.__lockAfterMemo(sec);'
  + ' window.bindVariationToolbarBtn(sec);'   // ★부를 때마다 자리를 맞추므로 🔒 뒤로 수렴한다
  + ' return ' + NAMES + ';})()';

async function boot(page, override) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await router(page, HARNESS, override);
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true
    && typeof window.bindVariationToolbarBtn === 'function'
    && typeof window._ensureMemoButton === 'function');
  return errs;
}

test('T1 ★갓 만든 차례와 rebindAll 뒤의 차례가 «같다» (뒤집힐 일이 없다)', async ({ page }) => {
  const errs = await boot(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  const made = await page.evaluate(AFTER_CREATE);
  const rebound = await page.evaluate(AFTER_REBIND);
  /* ★먼저 «무엇이 있었나» — ab 가 안 생겼으면 아래 비교가 저절로 참이 된다. */
  expect(made, `★ab 단추가 안 생겼다(툴바: ${made.join(', ')}) — 이 검사가 «안 돈» 것이다`)
    .toContain('st-ab-btn');
  expect(rebound,
    `★차례가 뒤집힌다: 갓 만들면 [${made.join(', ')}] · rebindAll 뒤엔 [${rebound.join(', ')}]. ` +
    '그 한 번의 뒤집힘이 직렬화를 바꿔 첫 ⌘Z 뒤 드래그에 «빈 ⌘Z 칸»을 만든다(T-136 의 뿌리)')
    .toEqual(made);
});

test('T2 ★memo 는 여전히 «첫 자식»이다 (레포가 세운 뜻을 안 뒤집었다)', async ({ page }) => {
  await boot(page);
  const order = await page.evaluate(AFTER_CREATE);
  expect(order[0],
    `★맨 앞이 memo 가 아니다(${order.join(', ')}) — js/section-memo.js:194 의 「항상 첫 자식」을 어겼다`)
    .toBe('st-memo-btn');
});

test('T3 ★ab 는 «memo 다음»을 주장하지 않는다 (🔒 자리와 안 겹친다)', async ({ page }) => {
  /* ⛔★첫 판의 이 검사는 «자리 번호»(index 1)를 쟀는데, 🔒 가 없는 하네스에서는 그 칸이
       그냥 «빈 칸»이라 ab 가 거기 있어도 다툼이 아니다 ⇒ «틀린 양»을 쟀다.
       ⇒ 🔒 를 실제로 세운 뒤 재야 이 검사가 묻는 상황이 된다. */
  const SP = fs.readFileSync(path.join(REPO, 'js', 'section-protection.js'), 'utf8');
  expect(SP, '★🔒 가 더는 «memo 다음»을 주장하지 않는다 — 모형이 늙었다(자리 규칙을 다시 정해라)')
    .toMatch(/memoBtn\.nextElementSibling/);
  await boot(page);
  const order = await page.evaluate(WITH_LOCK);
  expect(order, '★🔒 가 안 생겼다 — 이 검사가 «안 돈» 것이다').toContain('st-protected-btn');
  expect(order[1],
    `★memo 다음이 ab 다(${order.join(', ')}) — 🔒 가 그 자리를 «불릴 때마다» 주장하므로 서로 밀어낸다`)
    .toBe('st-protected-btn');
  expect(order.indexOf('st-ab-btn'), `★ab 가 ✨ 앞이 아니다(${order.join(', ')})`)
    .toBeLessThan(order.indexOf('st-ai-fill-btn'));
});

test('T4 ★음성대조 — 자리 규칙을 걷으면 실제로 «뒤집힌다»', async ({ page }) => {
  /* 화석을 안 베낀다 — 지금 소스에서 고침만 옛 모양으로 되돌린 변형본을 만들어 돌린다. */
  const SRC = fs.readFileSync(path.join(REPO, 'js', 'section-variation.js'), 'utf8');
  const mutated = SRC.replace(/_placeAbBtn\(toolbar, abBtn\);/g, 'toolbar.insertBefore(abBtn, toolbar.firstChild);');
  expect(mutated, '★변환이 늙었다 — _placeAbBtn(toolbar, abBtn) 를 못 찾았다(고침이 빠졌다)').not.toBe(SRC);

  const errs = await boot(page, { path: '/js/section-variation.js', body: mutated });
  expect(errs, `★변형본이 터졌다: ${errs.join(' | ')}`).toEqual([]);
  const made = await page.evaluate(AFTER_CREATE);
  const rebound = await page.evaluate(AFTER_REBIND);
  expect(rebound,
    '★고침을 걷었는데도 차례가 안 뒤집힌다 — T1 의 초록은 «고쳐서»가 아니라 «원래 그래서»다')
    .not.toEqual(made);
  expect(made[0], '★변형본에서 갓 만든 차례의 맨 앞이 ab 가 아니다 — 옛 모양 재현이 안 됐다').toBe('st-ab-btn');
});

test('T5 ★ab 는 «맨 뒤»도 주장하지 않는다 (✨ 자리와 안 겹친다)', async ({ page }) => {
  /* ★이 검사가 뒤늦게 생긴 까닭 — 고침 ⑶(ab 를 맨 뒤로)은 **T1~T4 가 전부 초록인 채로**
     실앱 측정에서 틀린 것이 드러났다. 이 하네스에 ✨ 주입기가 없었기 때문이다.
     ⇒ 「검사가 초록이다」와 「실제로 안 다툰다」는 다른 말이다. */
  const AI = fs.readFileSync(path.join(REPO, 'js', 'ai-section-fill.js'), 'utf8');
  expect(AI, '★✨ 가 더는 «맨 뒤»를 주장하지 않는다 — 모형이 늙었다(자리 규칙을 다시 정해라)')
    .toMatch(/tb\.appendChild\(btn\)/);
  await boot(page);
  const order = await page.evaluate(AFTER_CREATE);
  expect(order[order.length - 1],
    `★ab 가 맨 뒤에 있다(${order.join(', ')}) — ✨ 가 그 자리를 «불릴 때마다» 주장하므로 서로 밀어낸다`)
    .not.toBe('st-ab-btn');
  expect(order[order.length - 1], '★맨 뒤가 ✨ 가 아니다 — 모형이 늙었다').toBe('st-ai-fill-btn');
});

test('T6 ★공장이 내는 툴바가 이 하네스와 같은 모양인가 (하네스가 늙으면 빨강)', () => {
  /* 하네스는 [ai-fill, memo] 를 «베껴» 놓았다. 공장이 바뀌면 이 스펙 전체가 헛것을 잰다. */
  const BF = fs.readFileSync(path.join(REPO, 'js', 'block-factory.js'), 'utf8');
  const blocks = [...BF.matchAll(/<div class="section-toolbar">([\s\S]*?)<\/div>\s*\n/g)].map(m => m[1]);
  expect(blocks.length, '★공장에서 툴바 마크업을 «하나도» 못 찾았다 — 0건을 통과로 읽지 마라')
    .toBeGreaterThan(0);
  for (const b of blocks) {
    const order = [...b.matchAll(/class="st-btn (st-[a-z-]+)"/g)].map(m => m[1]);
    expect(order,
      `★공장이 내는 차례가 바뀌었다(${order.join(', ')}) — 하네스와 T1 의 전제를 같이 고쳐라`)
      .toEqual(['st-ai-fill-btn', 'st-memo-btn']);
  }
});

/* ═══ 둘째 축 — «공백 텍스트노드» (2026-09-22, 뿌리 고침만 넣은 판 9624 실측) ═══
 * ★T1~T6 이 전부 초록인 판에서도 «빈 ⌘Z 칸»이 5/5 로 재현됐다.
 *   단추 «차례»는 ⌘Z 앞뒤 5/5 동일인데 직렬화가 «길이 같고 내용 다름»이었고,
 *   태그 단위 diff 가 «공백 줄 4개(−2/+2)»뿐이었다.
 *   까닭: tb.firstChild 는 단추가 아니라 툴바 마크업의 «공백 텍스트노드»다. 그래서
 *   「항상 첫 자식」 규칙이 부를 때마다 참이 되어 단추가 공백을 넘어 튀고 공백이 뒤로 밀린다.
 *     before [TEXT,TEXT,memo,TEXT,ab,ai] → after [memo,TEXT,TEXT,TEXT,ab,ai]
 * ⇒ ★«차례»만 보면 안 보이는 축이다. 그래서 여기서는 «툴바 HTML 전체»를 잰다.
 */
/* ═══ 둘째 축 — «공백 텍스트노드» ═══
 * ★실측(2026-09-22, 뿌리 고침만 넣은 판 9624, 5판): 단추 «차례»는 ⌘Z 앞뒤 5/5 동일인데
 *   «빈 ⌘Z 칸»이 5/5 재현됐고, 태그 단위 diff 가 «공백 줄 4개(−2/+2)»뿐이었다.
 *     before [TEXT,TEXT,memo,TEXT,ab,ai] → after [memo,TEXT,TEXT,TEXT,ab,ai]
 *   까닭: tb.firstChild 는 단추가 아니라 «공백 텍스트노드»라, 「항상 첫 자식」 규칙이
 *   부를 때마다 참이 되어 단추가 공백을 넘어 튀고 공백이 뒤로 밀린다.
 *
 * ⛔★이 검사를 쓰면서 «재는 순간»을 두 번 틀렸다 — 적어 둔다:
 *   ⑴ ensure 를 두 번 불러 비교 → 첫 번째가 이미 공백을 소진해 «고침이 없어도» 초록.
 *   ⑵ «굳은 상태»를 복원해 비교 → 그 스냅샷엔 공백이 이미 뒤로 가 있어 두 판이 같아진다.
 *   ⇒ 갈리는 자리는 «공장 모양»(공백이 단추 «앞»에 있는 HTML)을 복원했을 때다.
 *     그게 저장된 문서를 다시 열 때의 모양이다. 아래 FACTORY_TB 가 그것이다.
 *   ★두 번 다 T8(음성대조)이 잡았다 — 음성대조가 없었으면 «검사처럼 생긴 문장»이 됐다.
 */
const RESTORE_FACTORY_THEN_REBIND = '(() => {'
  + " const sec = document.getElementById('sec1');"
  + " const tb = sec.querySelector('.section-toolbar');"
  + ' tb.innerHTML = ' + JSON.stringify(FACTORY_TB) + ';'   // ①저장본을 다시 파싱한 모양
  + ' window.bindVariationToolbarBtn(sec);'                  // ②rebindAll 차례
  + ' window._ensureMemoButton(sec);'
  + ' window.__aiLast(sec);'
  + ' const f = tb.firstChild;'
  + ' return { firstNodeType: f ? f.nodeType : 0,'
  + "   firstIsWhitespace: !!(f && f.nodeType === 3 && !f.data.trim()),"
  + '   html: tb.innerHTML };})()';

test('T7 ★저장본을 다시 연 뒤 rebind 해도 «공백이 제자리»에 있다 (공백 텍스트노드 축)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(RESTORE_FACTORY_THEN_REBIND);
  /* ★먼저 «무엇이 있었나» — 단추가 없으면 아래 판정이 저절로 참이 된다. */
  expect(r.html, '★툴바가 비어 있다 — 이 검사가 «안 돈» 것이다').toContain('st-memo-btn');
  expect(r.firstIsWhitespace,
    `★툴바의 첫 노드가 공백이 아니다(nodeType=${r.firstNodeType}) — 단추가 공백을 «넘어» 앞으로 튀었다. ` +
    '단추 차례가 같아도 childNodes 가 바뀌면 직렬화가 달라지고, ' +
    '비교자가 그걸 «편집»으로 읽어 빈 ⌘Z 칸을 하나 더 쌓는다(실측 5/5)')
    .toBe(true);
});

test('T8 ★음성대조 — firstChild 로 되돌리면 단추가 실제로 «공백을 넘는다»', async ({ page }) => {
  /* 화석을 안 베낀다 — 지금 소스에서 요소기준 비교만 옛 노드기준으로 되돌린 변형본을 만든다. */
  const SRC = fs.readFileSync(path.join(REPO, 'js', 'section-memo.js'), 'utf8');
  const mutated = SRC.replace(
    'if (tb.firstElementChild !== btn) tb.insertBefore(btn, tb.firstElementChild);',
    'if (tb.firstChild !== btn) tb.insertBefore(btn, tb.firstChild);');
  expect(mutated, '★변환이 늙었다 — firstElementChild 비교를 못 찾았다(고침이 빠졌다)').not.toBe(SRC);

  const errs = await boot(page, { path: '/js/section-memo.js', body: mutated });
  expect(errs, `★변형본이 터졌다: ${errs.join(' | ')}`).toEqual([]);
  const r = await page.evaluate(RESTORE_FACTORY_THEN_REBIND);
  expect(r.firstIsWhitespace,
    '★옛 모양으로 되돌렸는데도 공백이 제자리다 — T7 의 초록은 «고쳐서»가 아니라 «원래 그래서»다')
    .toBe(false);
  expect(r.firstNodeType, '★첫 노드가 요소(단추)가 아니다 — 옛 모양 재현이 안 됐다').toBe(1);
});

test('T9 ★«모양이 같아 짝으로» 고친 두 자리도 잠근다 (실측 근거는 «없다»)', () => {
  /* ⛔★이 검사가 뒤늦게 생긴 까닭을 적는다 — 작업목록매니저가 「그 둘이 지금 검사로
       잠겨 있느냐」고 되물었고, 재 보니 갈렸다:
         🔒 section-protection → T3 의 «전제 확인»이 nextElementSibling 을 보므로 «우연히» 잠겨 있었다
         ✨ ai-section-fill    → T5 의 정규식이 `tb.appendChild(btn)` 라, 고침(lastElementChild 가드)을
                                 걷어도 «여전히 맞는다» ⇒ **안 잠겨 있었다**
       ⇒ 「검사가 있다」와 「그 변경이 잠겨 있다」는 다른 말이다. 여기서 둘 다 명시적으로 잠근다.

     ⚠️★그리고 이 둘은 «실측 근거가 없다» — 공백 밀림을 실제로 냈다는 측정은 memo 쪽뿐이다.
       (2026-09-22 뿌리만 판 9624: 그 판은 보호를 안 켰고 ✨ 축도 따로 안 쟀다.)
       모양이 같아 짝으로 고쳤을 뿐이다. 되돌릴 근거가 생기면 이 검사부터 지워라. */
  const SP = fs.readFileSync(path.join(REPO, 'js', 'section-protection.js'), 'utf8');
  expect(SP, '★🔒 가 «노드» 기준(nextSibling)으로 돌아갔다 — 공백 텍스트노드를 넘어 튄다')
    .toMatch(/memoBtn\.nextElementSibling !== btn/);
  expect(SP, '★🔒 의 memo 없는 갈래도 «노드» 기준으로 돌아갔다')
    .toMatch(/tb\.firstElementChild !== btn/);

  const AI = fs.readFileSync(path.join(REPO, 'js', 'ai-section-fill.js'), 'utf8');
  expect(AI, '★✨ 가 «이미 마지막 요소인가»를 안 보고 무조건 appendChild 한다 — 뒤따르던 공백이 앞으로 밀린다')
    .toMatch(/tb\.lastElementChild !== btn\) tb\.appendChild\(btn\)/);

  const MEMO = fs.readFileSync(path.join(REPO, 'js', 'section-memo.js'), 'utf8');
  expect(MEMO, '★memo 가 «노드» 기준(firstChild)으로 돌아갔다 — ★이 자리가 «측정된» 원인이다')
    .toMatch(/tb\.firstElementChild !== btn/);
});

test('T10 ★«시각»에 안 기댄다 — ✨ 가 아직 공장 자리(맨 앞)일 때 놓아도 memo 칸에 안 앉는다', async ({ page }) => {
  /* ★이 검사가 생긴 까닭 — 앞 판의 자리 규칙은 「✨ 바로 앞」이었고, 그건 «✨ 가 이미 맨 뒤»를
     전제한다. 갓 만든 섹션의 «동기 시점»엔 툴바가 [AI, MEMO] 라 그 전제가 거짓이고,
     「✨ 바로 앞」이 하필 «맨 앞» = memo 칸이 된다. ⇒ 첫 rebindAll 이 그 한 번을 뒤집는다.
     ★실앱 5/5 재현(2026-09-22 포트 9626). **T1~T9 는 그때 전부 초록이었다.**
     ⇒ 「자리를 몇이 주장하나」를 센 다음엔 「그 셋이 «언제» 자리를 잡나」도 세라. */
  await boot(page);
  const r = await page.evaluate(`(() => {
    const sec = document.getElementById('sec1');
    const tb = sec.querySelector('.section-toolbar');
    tb.innerHTML = ${JSON.stringify(FACTORY_TB)};   // ★공장 모양 — 그 «순간»을 재려면 되돌려야 한다
    const atPlace = [...tb.children].map(b => b.className.replace('st-btn ',''));  // 놓기 «직전»
    window.bindVariationToolbarBtn(sec);
    const right = [...tb.children].map(b => b.className.replace('st-btn ',''));     // 놓은 «직후»
    window.__aiLast(sec);                                                            // ✨ 가 뒤로
    const settled = [...tb.children].map(b => b.className.replace('st-btn ',''));
    return { atPlace, right, settled };
  })()`);
  /* ★전제부터 — 놓는 순간 ✨ 가 정말 «맨 앞»이어야 이 검사가 그 상황을 잰다. */
  expect(r.atPlace[0],
    `★놓기 직전 툴바가 [${r.atPlace.join(', ')}] 다 — ✨ 가 맨 앞이 아니면 이 검사가 «그 상황»을 안 잰다`)
    .toBe('st-ai-fill-btn');
  expect(r.right[0],
    `★ab 가 «맨 앞»에 앉았다(${r.right.join(', ')}) — 거기는 memo 칸이라 첫 rebindAll 이 뒤집는다`)
    .not.toBe('st-ab-btn');
  expect(r.settled, `★✨ 가 뒤로 간 뒤 차례가 [${r.settled.join(', ')}] 다`)
    .toEqual(['st-memo-btn', 'st-ab-btn', 'st-ai-fill-btn']);
});
