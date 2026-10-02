/* mockup-recapture-guard — 「빈 그림으로 멀쩡한 캡처를 덮으면서 «완료!»라고 한다」를 잠근다
 * ──────────────────────────────────────────────────────────────────────────
 * 무엇이 있었나 (2026-09-21 실측, 목업 캡처):
 *   섹션을 한 번 캡처하면 그 섹션은 `sec.style.display='none'` 으로 숨는다(설계대로다).
 *   그 섹션을 «다시» 캡처하면 `cloneNode` 가 그 `display:none` 까지 베껴 와 html2canvas 가
 *   크기 0 짜리를 그리고 캔버스가 0×0 이 된다.
 *   ⛔그때 `toDataURL()` 은 «던지지 않고» 문자열 `"data:,"` 를 «돌려준다».
 *     `_captureAndApply` 의 try/catch 는 «예외»만 보므로 그대로 통과해
 *     928,378자짜리 PNG 를 6자로 덮고 「캡처 완료! 섹션이 숨겨졌습니다.」라고 말했다.
 *   ⇒ 사용자가 만든 것이 «성공 신호와 함께» 사라진다. 두 번 누르면 난다.
 *
 * 고친 모양 둘(짝이다 — 하나는 원인, 하나는 그물):
 *   ㉠ 클론에만 `display:block` 을 건다(원본 sec 는 안 건드린다 — 깜빡임·상태 어긋남 없이)
 *   ㉡ 덮기 «전»에 결과를 재고, 빈 그림이면 «가진 것을 지키고» 사실대로 말한다
 *   ⛔㉠만으로 닫지 않는 까닭 — 캔버스가 0 이 되는 길이 그것 하나라는 보장이 없다.
 *     그리고 이 자리의 병은 «0 이 되는 것»이 아니라 «0 인 줄 모르고 덮는 것»이다.
 *
 * ★이 스펙은 «전제»부터 브라우저에서 잰다(G1) — 「toDataURL 이 안 던진다」를 말로 두면
 *   그게 바뀌는 날 이 고침의 까닭이 조용히 사라진다.
 *
 * ⛔앱을 «안» 띄운다. 실행: npm run test:dom -- mockup-recapture-guard
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(REPO, 'js', 'props', 'prop-mockup.js'), 'utf8');
/* 주석을 걷고 «코드만» 잰다 — 이 고침의 설명 주석이 스스로 빨강을 내지 않게. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

test('G1 ★전제 — 0×0 캔버스의 toDataURL 은 «던지지 않고» "data:," 를 돌려준다', async ({ page }) => {
  await page.goto('about:blank');
  const r = await page.evaluate(() => {
    const cv = document.createElement('canvas');
    cv.width = 0; cv.height = 0;
    let threw = false, url = null;
    try { url = cv.toDataURL('image/png'); } catch (e) { threw = true; }
    return { threw, url, len: url ? url.length : -1 };
  });
  expect(r.threw,
    '★toDataURL 이 이제 «던진다» — 그러면 try/catch 가 잡으므로 이 고침의 까닭(㉡)이 달라진다. ' +
    '고침을 지우지 말고 이 주석과 카드를 먼저 고쳐라').toBe(false);
  expect(r.url, '★돌려주는 값이 "data:," 가 아니다 — 판정식(길이)이 늙었을 수 있다').toBe('data:,');
  expect(r.len, '★그 문자열이 128자보다 길다 — 아래 판정식 임계를 다시 봐라').toBeLessThan(128);
});

test('G2 ㉠ 클론에 display:block 을 «건다» (그리고 베껴 온 display:none 뒤에 온다)', () => {
  const m = CODE.match(/clone\.style\.cssText \+= '([^']+)'/);
  expect(m, '★클론 cssText 대입을 못 찾았다 — 이 검사가 «안 돈» 것이지 통과가 아니다').toBeTruthy();
  expect(m[1],
    '★display:block 이 빠졌다 — 이미 숨겨진 섹션을 다시 캡처하면 클론이 display:none 을 ' +
    '베껴 와 캔버스가 0×0 이 된다').toContain('display:block');
  /* ★«뒤»에 와야 이긴다 — cssText 는 나중 선언이 이긴다. += 로 붙이므로 이 문자열 «안»의
     순서만 보면 된다(원본의 display:none 은 이 문자열보다 앞에 있다). */
  expect(CODE, '★원본 sec 의 display 를 건드리고 있다 — 클론만 펴야 한다(깜빡임·상태 어긋남)')
    .not.toMatch(/sec\.style\.display\s*=\s*''/);
});

test('G3 ㉡ 덮기 «전»에 결과를 재고, 빈 그림이면 dataset 을 «안» 건드린다', () => {
  const i = CODE.indexOf("const dataUrl = canvas.toDataURL('image/png')");
  expect(i, '★toDataURL 자리를 못 찾았다 — 검사가 안 돈 것이다').toBeGreaterThan(0);
  const j = CODE.indexOf('block.dataset.imgSrc = dataUrl', i);
  expect(j, '★dataset 쓰기 자리를 못 찾았다').toBeGreaterThan(i);
  const between = CODE.slice(i, j);
  expect(between,
    '★toDataURL 과 dataset 쓰기 «사이»에 캔버스 크기 검사가 없다 — 0×0 이어도 그대로 덮는다')
    .toMatch(/canvas\.width|canvas\.height/);
  expect(between, '★빈 그림일 때 «되돌아가지» 않는다 — 검사만 있고 막지 않으면 아무 일도 안 한다')
    .toMatch(/return;/);
});

test('G4 ★음성대조 — 판정식이 «진짜» 빈 그림을 잡고 «멀쩡한 그림»은 안 잡는다', async ({ page }) => {
  /* 소스에서 판정식을 그대로 꺼내 쓴다 — 베껴 적으면 늙는다. */
  const m = CODE.match(/const _degenerate = ([^;]+);/);
  expect(m, '★판정식(_degenerate)을 못 찾았다 — 이 검사가 «안 돈» 것이지 통과가 아니다').toBeTruthy();

  /* ★판정식이 이제 js/io/image-data-url.js 의 함수를 부른다(T-148) — 그 파일을 «소스 그대로»
     같은 페이지에 실어 준다. 베껴 적지 않으므로 그 파일이 바뀌면 이 검사도 같이 바뀐다. */
  const SHARED = fs.readFileSync(path.join(REPO, 'js', 'io', 'image-data-url.js'), 'utf8');
  await page.goto('about:blank');
  const r = await page.evaluate(async ({ expr, shared }) => {
    (0, eval)(shared);
    if (typeof window.isUsableImageDataUrl !== 'function') throw new Error('★공용 판정기가 안 실렸다 — 이 검사가 «안 돈» 것이다');
    /* ⛔`_judge` 를 인자로 «넣어 준다» — 안 넣으면 `typeof _judge !== 'function'` 이
       «던지지 않고» 참이 되어 **모든 그림을 빈 그림이라고 한다**.
       ★이 검사가 실제로 그걸 잡았다(2026-09-22, T-148 합치던 중): 멀쩡한 40×30 을
         «빈 그림»이라 해서 빨강. `typeof` 는 없는 이름에도 안 던지므로 조용히 뒤집힌다. */
    const judge = new Function('canvas', 'dataUrl', '_judge', `return (${expr});`)
      .bind(null);
    const call = (cv, url) => judge(cv, url, window.isUsableImageDataUrl);
    // ⑴ 진짜 0×0 — 이 병의 그 모양
    const bad = document.createElement('canvas'); bad.width = 0; bad.height = 0;
    const badUrl = bad.toDataURL('image/png');
    // ⑵ 멀쩡한 그림 — 너무 많이 잡으면 «되는 캡처»가 막힌다
    const good = document.createElement('canvas'); good.width = 40; good.height = 30;
    const g = good.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 40, 30);
    const goodUrl = good.toDataURL('image/png');
    return { bad: call(bad, badUrl), good: call(good, goodUrl), goodLen: goodUrl.length };
  }, { expr: m[1], shared: SHARED });

  expect(r.bad, '★0×0 을 «멀쩡하다»고 한다 — 이 그물이 아무것도 안 막는다').toBe(true);
  expect(r.good,
    `★멀쩡한 40×30 그림(${r.goodLen}자)을 «빈 그림»이라고 한다 — 되는 캡처까지 막는다. ` +
    '임계를 낮춰라').toBe(false);
});

test('G5 ★「완료」를 말하는 자리가 덮기 «뒤»에만 있다', () => {
  const okI = CODE.indexOf('캡처 완료');
  expect(okI, '★완료 토스트를 못 찾았다 — 검사가 안 돈 것이다').toBeGreaterThan(0);
  const setI = CODE.indexOf('block.dataset.imgSrc = dataUrl');
  expect(setI).toBeGreaterThan(0);
  expect(okI,
    '★「캡처 완료」가 dataset 쓰기보다 «앞»에 있다 — 안 덮고도 완료라고 말할 수 있다')
    .toBeGreaterThan(setI);
});
