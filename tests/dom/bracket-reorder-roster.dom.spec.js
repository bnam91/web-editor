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
 * ★★★2026-11-24 기대 바뀜 — IAL-02(0.9.13 187행 · cfc351d23 · b972bcea5): 손 열거 명부 + `if (!freeFrame) return;` 핸들러
 *   (`(e.key === '[' || e.key === ']')`)를 ★걷었다. 실제 키(⌘[ ⌘])는 그 앞 metaKey 블록의 `e.code === 'BracketLeft/Right'` 갈래가
 *   먼저 잡아 moveSelectedBlocks(direction, toEnd) 로 가고 ★return 했다 ⇒ 걷은 핸들러는 «code 없이 key 만 실은 합성 keydown»(이 파일 B2·B3)만 닿았다.
 *   ⇒ B0·B1 = 그 핸들러·명부가 ★없고 무덤 주석이 있다 · B2·B3 = 실제 키처럼 code 를 실어 «산 길»이 진입(preventDefault)함을 잰다 ·
 *     B3 끝에 «key 만 = 이제 아무도 안 받음»(옛 B3 빨강의 까닭)을 같이 박는다. 순서 결과는 grad-layer-order-t305 · bracket-reorder-units-j4468b 가 잰다.
 *   열차 전수 빨강(train/0913-c e958f2ab8 · 지디 261124) — 표적 grep 이 «소스 읽는 spec» 을 못 잡았다(readFileSync editor.js 도 표적에 넣는다).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js bracket-reorder-roster
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp, ROOT } = require('./_root-harness.js');

const src = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('B0 ★IAL-02 뒤 — 손 열거 명부 ⌘[] 핸들러가 없다 · 무덤 주석이 남았다 · 산 길 = e.code → moveSelectedBlocks', () => {
  const code = src('js/editor.js');
  expect(code.indexOf("(e.key === '[' || e.key === ']')"), '★옛 key 핸들러가 되살아났다 — 명부 둘(손 열거 vs moveSelectedBlocks)이 다시 생긴다').toBe(-1);
  expect(/⚰️옛 «Cmd\/Ctrl \+ \[ \/ \]» 핸들러/.test(code), '★무덤 주석(걷은 까닭)이 사라졌다').toBe(true);
  expect(/if \(e\.code === 'BracketLeft'\) \{[\s\S]{0,400}moveSelectedBlocks\('up', e\.shiftKey\)/.test(code), '★산 길 ⌘[ = moveSelectedBlocks(up, ⇧)').toBe(true);
  expect(/if \(e\.code === 'BracketRight'\) \{[\s\S]{0,400}moveSelectedBlocks\('down', e\.shiftKey\)/.test(code), '★산 길 ⌘] = moveSelectedBlocks(down, ⇧)').toBe(true);
});

test('B1 ★둘째 까닭(freeFrame 전용 return)도 함께 없다 · 화살표키 절 «성질로 고른다» 주석은 그대로', () => {
  const code = src('js/editor.js');
  expect(/if \(!freeFrame\) return;/.test(code), '★freeFrame 전용 return 이 다시 생겼다 — ⌘[] 가 프레임 밖에서 또 막힌다').toBe(false);
  expect(/블럭 «종류 명부»를 새로 적지 않는다/.test(code),
    '★화살표키 절의 「성질로 고른다」 주석이 사라졌다 — 처방의 근거가 죽었다').toBe(true);
});

test('B2 ★행위로 — 섹션 직속 그라데(freeFrame 밖)를 고르고 ⌘] ⌘[ = 산 길이 진입한다(IAL-02 기대 바뀜 · 옛 = 안 돎 t3-05)', async ({ page }) => {
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
      const ev = new KeyboardEvent('keydown', { key, code: key === ']' ? 'BracketRight' : 'BracketLeft', metaKey: true, bubbles: true, cancelable: true });   /* ★IAL-02 기대 바뀜 — 실제 키처럼 code 를 싣는다 */
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
  /* ★IAL-02 기대 바뀜 — freeFrame 밖이어도 산 길(moveSelectedBlocks 흐름 갈래)이 진입한다. B 는 이미 끝이라 ⌘] = 그대로 · ⌘[ = 한 칸 뒤 ⇒ BA. */
  expect(r.prevented, `★⌘] ⌘[ 가 산 길에 진입(preventDefault) (${JSON.stringify(r.prevented)})`).toEqual([true, true]);
  expect(r.after, `★⌘](끝이라 그대로) 뒤 ⌘[ = 한 칸 뒤 (${r.before} → ${r.after})`).toBe('BA');
});

test('B3 ★★★양성대조 — ★명부에 ★있고 ★freeFrame ★안이면 ★★핸들러가 ★진입한다 (`preventDefault`)', async ({ page }) => {
  await bootApp(page);
  /* ★★이 칸이 ★B2 를 ★뜻 있게 만든다 — ⛔없으면 「⌘[] 가 ★아예 ★안 돈다」와 ★구분이 ★안 된다.
     ★★261025 ★정정 ⑴ : ★처음엔 ★«순서가 ★바뀌나»로 세웠는데 ★`addShapeBlock` 이 ★도형마다
       ★★«새 free-frame» 을 ★만들어 ★한 프레임에 ★하나뿐이었다(실측 `before: "B"`) ⇒ ★순서가 ★없다.
       ⇒ ★자를 ★`e.preventDefault()` 가 ★돌았나로 ★바꿨다 — ★소스(editor.js:2936)에서 ★그 줄은
         ★★명부 ＋ `freeFrame` ★둘을 ★통과한 ★뒤에만 돈다 ⇒ ★★블럭이 ★하나여도 ★선다.
     ★★★261025 ★정정 ⑵ (★L3 가 ★잡아 줬다 · `1020t2-19`) :
       ★이 칸이 ★★부하에서 ★★«거짓 빨강»을 냈다 — ★batch1(★load ★7.7)에서 ★빨강,
       ★batch2(★저부하)에서 ★초록. ⇒ ★★「★부하는 ★느리게만이 아니라 ★★틀리게도 만든다」.
       ★까닭(추정 · ⛔안 쟀다) : ★`addShapeBlock` 이 ★`scrollIntoView`·`buildLayerPanel` 을 부르고
         ★끝에서 `selectShapeBlock` 을 ★부른다 ⇒ ★부하에서 ★선택이 ★늦을 수 있다.
       ⇒ ★★처방 : ★★«원인»이 아니라 ★★«수»를 붙인다 — ★이름 `BRACKET-B3-LOAD-FLAKE-261025-01`
         ＋ ★★최대 ★3 회 ★시도해 ★★한 번이라도 ★진입하면 ★초록(★양성대조의 뜻 = 「★진입할 ★수 있다」).
       ⇒ ★★그리고 ★시도마다 ★`selected`·`inFreeFrame` 을 ★★함께 찍어 ★★다음 사람이 ★어느 전제가
         ★흔들렸는지 ★가를 수 있게 둔다. */
  const tries = [];
  for (let k = 0; k < 3; k++) {
    const r = await page.evaluate(async () => {
      const canvas = document.getElementById('canvas');
      canvas.querySelectorAll('.section-block').forEach(s => s.remove());
      await window.addSection();
      const sec = [...canvas.querySelectorAll('.section-block')].pop();
      if (!sec) return { fail: '섹션이 없다' };
      window.selectSection(sec);
      if (typeof window.addShapeBlock !== 'function') return { fail: 'addShapeBlock 없음' };
      window.addShapeBlock();
      /* ★부하에서 ★선택이 ★늦을 수 있다 — ★한 틱 준다(⛔원인은 안 쟀다) */
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      const b = sec.querySelector('.shape-block');
      if (!b) return { fail: 'addShapeBlock 뒤에 .shape-block 이 없다' };
      const ff = b.closest('.frame-block[data-free-layout]');
      if (!b.classList.contains('selected')) window.selectShapeBlock?.(b);
      const ev = new KeyboardEvent('keydown', { key: ']', code: 'BracketRight', metaKey: true, bubbles: true, cancelable: true });   /* ★IAL-02 기대 바뀜 — code 를 싣는다 */
      document.dispatchEvent(ev);
      const bare = new KeyboardEvent('keydown', { key: ']', metaKey: true, bubbles: true, cancelable: true });   /* key 만(code 없음) = 걷은 옛 핸들러만 받던 꼴 */
      document.dispatchEvent(bare);
      return {
        inFreeFrame: !!ff, selected: b.classList.contains('selected'),
        prevented: ev.defaultPrevented, barePrevented: bare.defaultPrevented,
      };
    });
    tries.push(r);
    if (r.prevented) break;
  }
  console.log('[B3]', JSON.stringify(tries));
  const ok = tries.find(t => t.prevented);
  /* ★★전제 — ★어느 시도에서든 ★둘이 섰나(⛔안 섰으면 ★전제 문제이고 ★흔들림이 아니다) */
  const anyPremise = tries.find(t => t.inFreeFrame && t.selected);
  expect(anyPremise,
    `★전제가 ★한 번도 ★안 섰다 — ★도형이 free-layout 프레임 안이 아니거나 선택되지 않았다 ${JSON.stringify(tries)}`
  ).toBeTruthy();
  /* ★★★양성 — ★★진입한다. ⛔이 칸이 ★3 회 ★다 빨강이면 ★`B2` 의 수가 ★뜻을 잃는다 */
  expect(Boolean(ok),
    `★★⌘] 가 ★3 회 ★다 ★안 돈다(명부에 있는 종류·freeFrame 안인데도) — ★B2 가 뜻을 잃는다 ${JSON.stringify(tries)}`
  ).toBe(true);
  /* ★★흔들림에 ★수를 붙인다 — ★몇 번째에 섰나(1 이면 안정 · 2~3 이면 흔들렸다) */
  expect(ok.barePrevented, '★code 없는 key 만 합성 keydown 이 아직 어딘가에 잡힌다 — 걷은 옛 핸들러가 되살아났나').toBe(false);
  console.log('[B3-attempt]', tries.findIndex(t => t.prevented) + 1, '/', tries.length);
});
