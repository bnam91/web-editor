/* grad-group-lost-on-reload.dom.spec.js
 *   ★★★`GRAD-GROUP-LOST-ON-RELOAD-01` — ★등급을 ★잰다. (2026-10-25 신설 · 지디)
 *
 * ★찾은 이 = 태양 가지 `taeyang/t5-07-gradient-group` (`567ca3b4` · ★「지디 판정」으로 넘겨졌다)
 *   그 보고 ★그대로 : 「★저장 → 다시 열기에서 ★그룹 안 그라데이션이 ★섹션 직속으로 ★빠지고
 *     ★그룹 기준 x/y 로 ★튄다(★앱 A5 ★실측)」 · ★자리 `save-load.js:1457` → `gradient-select.js:336`
 *
 * ★★까닭 (261025 · 지디 소스 실측) — `migrateLegacyGradientBlocks` :
 *     if (block.parentElement === sec) return;      // ★섹션 직속이면 skip
 *     if (parentRow) { sec.appendChild(block); … }
 *     else { sec.appendChild(block); }              // ★★★그룹 안이어도 ★꺼낸다
 *   ★그 함수 336~375 줄에 ★`frame-block`·`free-layout`·`group` 을 ★보는 줄이 ★★0 개다.
 *   ⇒ ★★★「★마이그레이션이 ★★«그룹»을 ★«legacy 구조»로 ★오인해 ★깨뜨린다」
 *
 * ★★★등급을 ★가르는 물음 ★셋 (★`FT-TOUCHED-OLD-FILES-NOT-MIGRATED-01` 때와 ★같은 자)
 *   ⑴ ★★저장을 ★안 해도 ★★`rebindAll()` ★한 번으로 ★나나 — ★★그 migrate 는 ★`rebindAll` ★안에 있다
 *      ⇒ ★★`rebindAll` 은 ★⌘Z·로드·페이지 전환 ★여럿이 부른다(★`GRAD-MIGRATE-OTHER-CALLERS-UNMEASURED-01`)
 *   ⑵ ★저장본에 ★굳나 — ★그 뒤 `getSerializedCanvas()` 에 ★그룹이 ★없나
 *   ⑶ ★★음성대조 — ★그룹이 ★아닌(섹션 직속) 그라데는 ★★그대로인가 (⛔「전부 깨진다」가 아니다)
 *
 * ⛔안 재는 축 (★이름)
 *   · ★실제 파일 저장·재기동 — `GRAD-GROUP-DISK-PERSIST-UNMEASURED-01` (★앱 축 · 태양)
 *   · ★`rebindAll` 의 ★다른 호출자 전수 — `GRAD-MIGRATE-OTHER-CALLERS-UNMEASURED-01`
 *   · ★자리 튐(x/y) 의 ★수 — ★여기서는 ★★«부모가 바뀌나»만 잰다
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grad-group-lost-on-reload
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* ★★★261025 ★실측 — ★이 판(`2a6f28d9`)에서는 ★★⌘G 가 ★★그라데를 ★안 묶는다
     (`G0` 실측 `selN: 2` · ★`grouped: ★false`).
   ★★그것이 ★`t5-07` 의 ★본체이고, ★고침은 ★가지 `taeyang/t5-07-gradient-group`(43749cd6)의
     ★`6605fbad`(「⌘G 명부를 ★정본에서 ★성질로 ★파생」)에 ★있으나 ★★dev 에 ★★아직 ★없다.
   ⇒ ★★★장면을 ★만들 수 ★없으니 ★★«등급»을 ★여기서 ★★적으면 ★거짓이다.
   ⇒ ★★⛔그래서 ★★FAIL 이 ★아니라 ★★SKIP 으로 둔다 — 「★범위 밖 검사는 ★FAIL 아니라 ★SKIP」.
     ★이름 = `GRAD-GROUP-GRADE-BLOCKED-BY-T5-07-NOT-MERGED-01`
   ⇒ ★★그 가지가 ★들어오면 ★★`_canGroup` 이 ★참이 되고 ★★세 칸이 ★★스스로 ★깨어난다.
     ⛔그때 ★이 주석을 ★지우지 말고 ★★「언제 깨어났나」를 ★덧붙여라. */
async function _canGroupGradients(page) {
  const r = await page.evaluate(async () => {
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.section-block').forEach(s => s.remove());
    await window.addSection();
    const sec = [...canvas.querySelectorAll('.section-block')].pop();
    if (!sec) return false;
    window.selectSection(sec);
    const a = window.addGradientBlock?.();
    const b = window.addGradientBlock?.();
    if (!a || !b) return false;
    for (const el of [a, b]) if (!el.classList.contains('selected')) window.toggleBlockSelect?.(el);
    if (sec.querySelectorAll('.gradient-block.selected').length !== 2) return false;
    window.groupSelectedBlocks?.();
    return !!a.closest('.frame-block');
  });
  return r;
}

/** ★섹션에 ★그라데 둘을 ★앱 길로 만들고 ★⌘G 로 ★묶는다. */
const makeGroup = async (page) => page.evaluate(async () => {
  const canvas = document.getElementById('canvas');
  canvas.querySelectorAll('.section-block').forEach(s => s.remove());
  await window.addSection();
  const sec = [...canvas.querySelectorAll('.section-block')].pop();
  if (!sec) return { fail: '섹션이 없다' };
  if (!sec.id) sec.id = 'ggSec';
  window.selectSection(sec);
  const a = window.addGradientBlock?.();
  const b = window.addGradientBlock?.();
  if (!a || !b) return { fail: 'addGradientBlock 이 둘을 안 만들었다' };
  a.dataset.probe = 'A'; b.dataset.probe = 'B';
  /* ★앱 길로 ★둘을 ★고른다 — ⛔손으로 클래스를 붙이지 않는다.
     ★★261025 실측 : ★`rangeSelectBlocks(block, sec)` 는 ★★«블럭, 섹션» ★두 인자다
       (⛔배열을 넘기면 ★`el.closest is not a function` 으로 ★터진다 — ★내가 밟았다).
     ⇒ ★⌘클릭 길(`toggleBlockSelect`)로 ★하나씩 ★더한다. */
  /* ★★★261025 ★실측 ⑵ : ★`addGradientBlock` 이 ★끝에서 ★자기를 ★고른다 ⇒ ★`b` 는 ★이미 켜져 있다.
     ⇒ ★★`toggleBlockSelect(b)` 를 ★또 부르면 ★★b 가 ★꺼진다(★토글의 함정 · ★실측 `selN: 1`).
     ⇒ ★★상태를 ★보고 ★★«꺼진 것만» ★켠다. */
  const want = [a, b];
  const sel = () => sec.querySelectorAll('.gradient-block.selected').length;
  if (typeof window.toggleBlockSelect === 'function') {
    for (const el of want) if (!el.classList.contains('selected')) window.toggleBlockSelect(el);
  } else if (typeof window.rangeSelectBlocks === 'function') {
    window.rangeSelectBlocks(a, sec); window.rangeSelectBlocks(b, sec);
  } else { a.classList.add('selected'); b.classList.add('selected'); }
  const selN = sel();
  if (typeof window.groupSelectedBlocks !== 'function') return { fail: 'groupSelectedBlocks 없음' };
  window.groupSelectedBlocks();
  const ff = a.closest('.frame-block');
  return {
    secId: sec.id, selN,
    grouped: !!ff,
    ffFree: !!(ff && ff.dataset.freeLayout !== undefined),
    parentA: a.parentElement === sec ? 'sec' : (a.parentElement?.className || '?').slice(0, 40),
  };
});

const parentsOf = async (page) => page.evaluate(() => {
  const sec = document.getElementById('ggSec');
  const out = {};
  for (const p of ['A', 'B']) {
    const el = sec?.querySelector(`.gradient-block[data-probe="${p}"]`);
    out[p] = !el ? '(없다)'
      : el.parentElement === sec ? 'sec'
      : (el.parentElement.classList.contains('frame-block') ? 'frame' : el.parentElement.className.slice(0, 30));
  }
  out.frames = sec ? sec.querySelectorAll('.frame-block').length : -1;
  return out;
});

test('G0 ★전제 — ★앱 길로 ★그라데 둘을 ★⌘G 로 ★묶을 수 있다', async ({ page }) => {
  await bootApp(page);
  if (!(await _canGroupGradients(page))) {
    test.skip(true, '★★⌘G 가 그라데를 안 묶는다 — `t5-07`(43749cd6) 머지 전이다'
      + ' = GRAD-GROUP-GRADE-BLOCKED-BY-T5-07-NOT-MERGED-01 (⛔FAIL 아니라 SKIP)');
  }
  const r = await makeGroup(page);
  expect(r.fail, `★전제: ${r.fail}`).toBeUndefined();
  console.log('[G0]', JSON.stringify(r));
  /* ⛔묶이지 않으면 아래 「깨진다」가 ★«안 재고 있다»다 */
  /* ★★앞끝 전제 — ★둘이 ★정말 ★골렸나(⛔0·1 이면 ⌘G 가 ★할 일이 없다) */
  expect(r.selN, '★그라데 둘이 안 골렸다 — ⌘G 가 묶을 것이 없다').toBe(2);
  expect(r.grouped, '★★⌘G 로 ★그룹이 안 생겼다 — 아래 칸들이 뜻을 잃는다(t5-07 U1·U2 가 dev 에 들어왔나 보라)').toBe(true);
  const p = await parentsOf(page);
  console.log('[G0-parents]', JSON.stringify(p));
  expect(p.A, '★A 가 그룹(frame) 안이 아니다').toBe('frame');
});

test('G1 ★★★등급 ⑴ — ★저장을 ★안 해도 ★`rebindAll()` ★한 번으로 ★그룹이 ★깨진다', async ({ page }) => {
  await bootApp(page);
  if (!(await _canGroupGradients(page))) {
    test.skip(true, '★★⌘G 가 그라데를 안 묶는다 — `t5-07`(43749cd6) 머지 전이다'
      + ' = GRAD-GROUP-GRADE-BLOCKED-BY-T5-07-NOT-MERGED-01 (⛔FAIL 아니라 SKIP)');
  }
  const s = await makeGroup(page);
  expect(s.fail).toBeUndefined();
  expect(s.grouped, '★전제: 그룹이 안 생겼다').toBe(true);
  const before = await parentsOf(page);
  /* ★★`rebindAll` 은 ★⌘Z·로드·페이지 전환이 ★부르는 ★그 함수다 — ★그 안에 migrate 가 있다 */
  await page.evaluate(() => window.rebindAll?.());
  const after = await parentsOf(page);
  console.log('[G1]', JSON.stringify({ before, after }));
  expect(before.A, '★전제: 전에 frame 안이 아니다').toBe('frame');
  /* ★★★수를 박는다 — ★깨진다. ★이 칸이 ★빨개지면 = ★★고쳐진 것이다 ⇒ ★뒤집어라 */
  expect(after.A,
    `★그룹이 ★살았다 — ★고쳐졌다면 ★이 칸을 ★뒤집어라 (A: ${before.A} → ${after.A} · frames ${before.frames} → ${after.frames})`
  ).toBe('sec');
  expect(after.B, '★B 도 같이 봐야 한다').toBe('sec');
});

test('G2 ★★★등급 ⑵ — ★그 뒤 ★저장본에 ★그룹이 ★없다 (★굳는다)', async ({ page }) => {
  await bootApp(page);
  if (!(await _canGroupGradients(page))) {
    test.skip(true, '★★⌘G 가 그라데를 안 묶는다 — `t5-07`(43749cd6) 머지 전이다'
      + ' = GRAD-GROUP-GRADE-BLOCKED-BY-T5-07-NOT-MERGED-01 (⛔FAIL 아니라 SKIP)');
  }
  const s = await makeGroup(page);
  expect(s.fail).toBeUndefined();
  expect(s.grouped, '★전제: 그룹이 안 생겼다').toBe(true);
  const r = await page.evaluate(() => {
    const sec = document.getElementById('ggSec');
    const savedBefore = String(window.getSerializedCanvas?.() || '');
    window.rebindAll?.();
    window.flushCurrentPage?.();
    const savedAfter = String(window.getSerializedCanvas?.() || '');
    const count = (s, re) => (s.match(re) || []).length;
    return {
      framesBefore: count(savedBefore, /frame-block/g),
      framesAfter: count(savedAfter, /frame-block/g),
      gradBefore: count(savedBefore, /gradient-block/g),
      gradAfter: count(savedAfter, /gradient-block/g),
      secKept: count(savedAfter, /section-block/g),
    };
  });
  console.log('[G2]', JSON.stringify(r));
  /* ★★양성대조 — ★섹션과 ★그라데 ★자체는 ★남아야 한다(⛔「다 지워서 0」이 아니다) */
  expect(r.secKept, '★섹션이 저장본에서 사라졌다').toBeGreaterThan(0);
  expect(r.gradAfter, '★그라데가 저장본에서 사라졌다 — 병이 더 넓다').toBe(r.gradBefore);
  /* ★★★수 — ★그룹이 ★저장본에서 ★사라진다 */
  expect(r.framesAfter,
    `★그룹이 저장본에 ★남았다 — ★고쳐졌다면 ★뒤집어라 (${r.framesBefore} → ${r.framesAfter})`
  ).toBeLessThan(r.framesBefore);
});

test('G3 ★★음성대조 — ★★섹션 ★직속 그라데는 ★`rebindAll()` 뒤에도 ★그대로다', async ({ page }) => {
  await bootApp(page);
  /* ★★이 칸이 ★G1 을 ★뜻 있게 만든다 — ⛔없으면 「★rebindAll 이 ★전부 망친다」와 ★구분이 ★안 된다 */
  const r = await page.evaluate(async () => {
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.section-block').forEach(s => s.remove());
    await window.addSection();
    const sec = [...canvas.querySelectorAll('.section-block')].pop();
    if (!sec) return { fail: '섹션이 없다' };
    sec.id = 'ggSec';
    window.selectSection(sec);
    const a = window.addGradientBlock?.();
    if (!a) return { fail: 'addGradientBlock 이 안 만들었다' };
    a.dataset.probe = 'A';
    const before = a.parentElement === sec ? 'sec' : 'other';
    window.rebindAll?.();
    const el = sec.querySelector('.gradient-block[data-probe="A"]');
    return { before, after: !el ? '(없다)' : (el.parentElement === sec ? 'sec' : 'other') };
  });
  expect(r.fail, `★전제: ${r.fail}`).toBeUndefined();
  console.log('[G3]', JSON.stringify(r));
  expect(r.before, '★전제: 그룹 없이 만든 그라데가 섹션 직속이 아니다').toBe('sec');
  expect(r.after, '★★섹션 직속 그라데까지 움직였다 — 병이 ★훨씬 넓다').toBe('sec');
});
