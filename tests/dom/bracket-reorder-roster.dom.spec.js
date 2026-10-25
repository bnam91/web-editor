/* bracket-reorder-roster.dom.spec.js
 *   ★★`BRACKET-REORDER-ROSTER-IS-HANDWRITTEN-AND-FRAME-ONLY-01` (2026-10-25 신설 · 지디)
 *   ★⌘[ / ⌘] 레이어 순서 바꾸기가 ★★«어디까지» 되나 — ★수를 박는다. ⛔안 고친다.
 *
 * ★★왜 지금 — ★전수 채점에서 ★★같은 뿌리의 항목이 ★여럿 나왔다
 *   ★`t3-05`   「그라데이션 블럭 ＞ 커맨드 '[' , ']' 이걸로 ★다른 블럭 간에 레이어 순서 조절이 안되는듯?」
 *   ★`1020t2`  「ant_… ★어노테이션 블럭 커맨드 ＋ ] 했는데 ★왜 레이어 순서가 안 바뀌고 …」
 *   ★`1020t2`  「★스크래치패드 간 커맨드 '[',']' 이것만으로도 레이어 순서 변경가능하도록 해줘」
 *   ⇒ ★★「한 뿌리라 이름 붙일 땐 ★그 뿌리를 무력화하면 ★N개가 ★전부 빨강인가」를 ★같이 건다(아래 B3).
 *
 * ★★실측된 구조 (261025 · `js/editor.js:2919~2952`)
 *   ⒜ ★대상이 ★★«손으로 적은 블럭 종류 명부»다 — `.text-block.selected, .asset-block.selected, …`
 *      ⇒ ★그 명부에 ★★`.gradient-block`·`.annotation-block` 이 ★★없다.
 *   ⒝ ★그리고 ★★`if (!freeFrame) return;` — ★`.frame-block[data-free-layout]` ★안이어야 ★돈다.
 *      ⇒ ★섹션 ★직속 자식(그라데·어노)은 ★★그 조건에서 ★먼저 걸린다.
 *   ⇒ ★★까닭이 ★★둘이다. ★하나만 고치면 ★안 된다.
 *   ★★★그것을 ★★변이로 ★쟀다(261025) : ★명부에 ★`.gradient-block.selected` 를 ★더하니
 *     ★`B0` 는 ★빨개졌는데(hasGradient true · n 23→24) ★★`B2` 의 `prevented` 는
 *     ★★`[false, false]` ★★그대로였다 ⇒ ★★`freeFrame` 조건이 ★★여전히 막는다.
 *   ⇒ ★★「★뿌리 하나라 이름 붙일 땐 ★그 뿌리를 무력화하면 ★N개가 ★전부 빨강인가」를 ★걸어 보니
 *     ★★이것은 ★★«뿌리 ★둘»이었다. ⛔한 쪽만 고치고 ★닫지 마라.
 *
 * ★★★그리고 ★★처방이 ★★같은 파일 ★안에 ★이미 적혀 있다 (`editor.js:2956~2960`, ★화살표키 절) :
 *     「⛔블럭 ★«종류 명부»를 ★새로 적지 않는다 — ★★성질로 고른다:
 *        free-layout 프레임의 ★«직속 자식»이면서 ★absolute 로 떠 있는 것만 left/top 을 갖는다」
 *   ⇒ ★★⌘[] 은 ★손 열거, ★화살표는 ★성질 — ★★한 파일에서 ★두 방식이 ★공존한다.
 *   ⇒ ★★「명부가 ★둘이면 ★경고 주석으로 못 막는다 — ★파생시켜 하나로」의 ★자리다.
 *
 * ⛔이 파일이 ★안 재는 것 (★이름)
 *   · ★스크래치패드 안의 ⌘[] = `BRACKET-IN-SCRATCHPAD-UNMEASURED-01` (★별 표면 · 별 코드)
 *   · ★실제 ⌘ 키 조합을 ★OS 수준으로 보내는 축 — ★여기선 `keydown` 을 ★디스패치한다
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js bracket-reorder-roster
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp, ROOT } = require('./_root-harness.js');

const src = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('B0 ★대상 명부를 ★정의 자리에서 센다 — ★손 열거이고 ★그 둘이 ★없다', () => {
  const code = src('js/editor.js');
  const i = code.indexOf("(e.key === '[' || e.key === ']')");
  expect(i, '★⌘[] 핸들러를 못 찾았다 — 조건식이 바뀌었나').toBeGreaterThan(0);
  const seg = code.slice(i, i + 1600);
  const sels = [...seg.matchAll(/\.([a-z0-9-]+)-block\.selected/g)].map(m => `.${m[1]}-block`);
  const uniq = [...new Set(sels)];
  console.log('[B0]', JSON.stringify({ n: uniq.length, hasGradient: uniq.includes('.gradient-block'), hasAnnotation: uniq.includes('.annotation-block'), sample: uniq.slice(0, 6) }));
  /* ★★전제 — ★명부가 ★실재하고 ★여러 종을 ★손으로 적었다(⛔0 이면 파서가 헛돌았다) */
  expect(uniq.length, '★명부에서 블럭 종류를 하나도 못 읽었다 — 파서가 헛돌았다').toBeGreaterThan(10);
  /* ★★★수를 박는다 — ★이 둘이 ★들어오면 ★이 칸이 ★빨개진다 = ★그때 닫아라 */
  expect(uniq.includes('.gradient-block'), '★.gradient-block 이 명부에 들어왔다 — t3-05 를 다시 재라').toBe(false);
  expect(uniq.includes('.annotation-block'), '★.annotation-block 이 명부에 들어왔다 — 1020t2 를 다시 재라').toBe(false);
});

test('B1 ★★둘째 까닭 — ★`freeFrame` 밖이면 ★명부에 ★있어도 ★안 돈다', () => {
  const code = src('js/editor.js');
  const i = code.indexOf("(e.key === '[' || e.key === ']')");
  const seg = code.slice(i, i + 1600);
  expect(/const freeFrame = sel\.closest\('\.frame-block\[data-free-layout\]'\)/.test(seg),
    '★freeFrame 를 찾는 줄이 사라졌다 — 둘째 까닭이 바뀌었다').toBe(true);
  expect(/if \(!freeFrame\) return;/.test(seg),
    '★freeFrame 없으면 return 하는 줄이 사라졌다 — 둘째 까닭이 바뀌었다').toBe(true);
  /* ★★★처방이 ★같은 파일 안에 ★이미 있다 — ★화살표키 절은 ★★성질로 고른다 */
  expect(/블럭 «종류 명부»를 새로 적지 않는다/.test(code),
    '★화살표키 절의 「성질로 고른다」 주석이 사라졌다 — 처방의 근거가 죽었다').toBe(true);
});

test('B2 ★★행위로 — ★그라데를 ★고르고 ⌘] 를 ★눌러도 ★순서가 ★안 바뀐다 (`t3-05`)', async ({ page }) => {
  await bootApp(page);
  const r = await page.evaluate(async () => {
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.section-block').forEach(s => s.remove());
    await window.addSection();
    const sec = [...canvas.querySelectorAll('.section-block')].pop();
    if (!sec) return { fail: '섹션이 없다' };
    window.selectSection(sec);
    /* ★두 개를 만든다 — ⛔하나면 「순서」가 ★없다 */
    const a = window.addGradientBlock?.();
    const b = window.addGradientBlock?.();
    if (!a || !b) return { fail: 'addGradientBlock 이 둘을 안 만들었다' };
    a.dataset.probe = 'A'; b.dataset.probe = 'B';
    window._selectGradient?.(b);
    const order = () => [...sec.querySelectorAll('.gradient-block')].map(x => x.dataset.probe).join('');
    const before = order();
    const inFreeFrame = !!b.closest('.frame-block[data-free-layout]');
    /* ★★`defaultPrevented` 가 ★★「핸들러가 ★대상을 찾아 ★★진입했나」의 ★직접 증거다 —
       소스(editor.js:2936)에서 ★`e.preventDefault()` 는 ★명부 ＋ freeFrame ★둘을 ★통과한 ★뒤에만 돈다.
       ⇒ ★순서가 ★안 바뀐 까닭이 ★★「걸렸다」인지 ★「돌았는데 바뀔 게 없다」인지 ★가른다. */
    const prevented = [];
    for (const key of [']', '[']) {
      const ev = new KeyboardEvent('keydown', { key, metaKey: true, bubbles: true, cancelable: true });
      document.dispatchEvent(ev);
      prevented.push(ev.defaultPrevented);
    }
    return { before, after: order(), inFreeFrame, selected: b.classList.contains('selected'), prevented };
  });
  expect(r.fail, `★전제: ${r.fail}`).toBeUndefined();
  console.log('[B2]', JSON.stringify(r));
  /* ★★전제 둘 — ⛔없으면 「순서 불변」이 ★«안 재고 있다»다 */
  expect(r.before.length, '★그라데 둘이 섹션 안에 없다 — 순서를 잴 대상이 없다').toBe(2);
  expect(r.selected, '★그라데가 선택되지 않았다 — ⌘] 가 애초에 대상을 못 찾는다').toBe(true);
  /* ★★★까닭 ⒝ 도 ★행위로 — ★그라데는 ★freeFrame ★밖이다 */
  expect(r.inFreeFrame, '★그라데가 free-layout 프레임 안이다 — 둘째 까닭이 틀렸다').toBe(false);
  /* ★★★수를 박는다 — ★안 바뀐다. ★이 칸이 ★빨개지면 = ★★고쳐진 것이다 ⇒ ★닫아라 */
  expect(r.after, `★순서가 바뀌었다 — ★t3-05 가 ★고쳐졌다면 ★이 칸을 뒤집어라 (${r.before} → ${r.after})`)
    .toBe(r.before);
  /* ★★★그리고 ★★«걸렸다»를 ★직접 잰다 — ⛔「순서 불변」만으로는 ★「돌았는데 바뀔 게 없다」와 ★구분이 안 된다 */
  expect(r.prevented, `★preventDefault 가 돌았다 — 핸들러가 ★진입했다는 뜻이다 (${JSON.stringify(r.prevented)})`)
    .toEqual([false, false]);
});

test('B3 ★★★양성대조 — ★명부에 ★있고 ★freeFrame ★안이면 ★★핸들러가 ★진입한다 (`preventDefault`)', async ({ page }) => {
  await bootApp(page);
  /* ★★이 칸이 ★B2 를 ★뜻 있게 만든다 — ⛔없으면 「⌘[] 가 ★아예 ★안 돈다」와 ★구분이 ★안 된다.
     ★★261025 ★정정 : ★처음엔 ★«순서가 ★바뀌나»로 세웠는데 ★`addShapeBlock` 이 ★도형마다
       ★★«새 free-frame» 을 ★만들어 ★한 프레임에 ★하나뿐이었다(실측 `before: "B"`) ⇒ ★순서가 ★없다.
     ⇒ ★★자를 ★바꿨다 : ★`e.preventDefault()` 가 ★돌았나. ★소스(editor.js:2936)에서 ★그 줄은
       ★★명부 ＋ `freeFrame` ★둘을 ★통과한 ★뒤에만 돈다 ⇒ ★★「★진입했다」의 ★직접 증거이고
       ★★블럭이 ★하나여도 ★선다. */
  const r = await page.evaluate(async () => {
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.section-block').forEach(s => s.remove());
    await window.addSection();
    const sec = [...canvas.querySelectorAll('.section-block')].pop();
    if (!sec) return { fail: '섹션이 없다' };
    window.selectSection(sec);
    if (typeof window.addShapeBlock !== 'function') return { fail: 'addShapeBlock 없음' };
    window.addShapeBlock();
    const b = sec.querySelector('.shape-block');
    if (!b) return { fail: 'addShapeBlock 뒤에 .shape-block 이 없다' };
    const ff = b.closest('.frame-block[data-free-layout]');
    window.selectShapeBlock?.(b);
    const ev = new KeyboardEvent('keydown', { key: ']', metaKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    return {
      inFreeFrame: !!ff, selected: b.classList.contains('selected'),
      prevented: ev.defaultPrevented,
      siblings: ff ? ff.children.length : -1,
    };
  });
  expect(r.fail, `★전제: ${r.fail}`).toBeUndefined();
  console.log('[B3]', JSON.stringify(r));
  /* ★★전제 둘 — ★명부에 ★있는 종류이고 ★freeFrame ★안이다 */
  expect(r.inFreeFrame, '★도형이 free-layout 프레임 안이 아니다 — 양성대조의 전제가 깨졌다').toBe(true);
  expect(r.selected, '★도형이 선택되지 않았다').toBe(true);
  /* ★★★양성 — ★★진입한다. ⛔이 칸이 ★빨개지면 ★`B2` 의 「안 돈다」가 ★뜻을 잃는다 */
  expect(r.prevented,
    '★★⌘] 가 ★아예 ★안 돈다(명부에 있는 종류·freeFrame 안인데도) — ★B2 의 수가 ★뜻을 잃는다'
  ).toBe(true);
});
