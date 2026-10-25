/* cvb-linehost-text-color.dom.spec.js
 *   ★★`CVB-LINEHOST-DROPS-TEXT-COLOR-01` — ★줄추가로 ★line-host 로 갈아탈 때 ★글자색이 ★사라진다.
 *   (2026-10-25 신설 · 지디 · 현빈 `1020t1c` 「👉 ★해결 안 됐다」)
 *
 * ★★★현빈이 ★증거를 ★그대로 주셨다 (proj_1792823705838 · cvb_ts0he_ke1uc2x → cvb_ts0he_pweumxg)
 *     줄추가 ★전 : <div class="cvb-card-title" style="… ★color: rgb(26, 26, 26) …">카드 제목</div>
 *     줄추가 ★후 : <div class="ln-row"><div class="grd-line grd-body"
 *                   style="font-size:40px;font-weight:600;line-height:1.3;letter-spacing:0;
 *                          text-align:center;white-space:pre-wrap;word-break:keep-all;">카드 제목</div></div>
 *   ⇒ ★★색이 ★«바뀐» 게 아니라 ★★«사라졌다». ★그리고 ★구조가 ★통째로 갈린다.
 *
 * ★★★내가 ★먼저 고친 것은 ★다른 자리였다 — ★적어 둔다
 *   `54114954`(10-20)은 ★「색을 ★어떻게 ★고르나」를 ★한 자리로 모은 것이다(`cvbAutoTextColor`).
 *   `_cvbBeginAdd` 는 ★지금도 ★색을 ★제대로 ★넣는다(`_cvbTextCss(…, color, …)`).
 *   ★★그런데 ★그 줄이 ★line-host 로 ★넘어가는 순간 ★그 색이 ★버려진다.
 *   ⇒ ★★「맞는 결함 ≠ 지목된 결함」. ★그 커밋도 ★검사 5칸도 ★초록인데 ★증상은 ★그대로였다.
 *
 * ★★자리 (★소스 실측)
 *     `line-host.js:84`  lnLinesHtml(lines, m, c, align)      ← ★색 인자가 ★아예 ★없다
 *       → `:88`          gridLineHtml(l, align)                ← ★2-인자로만 부른다
 *         → `grid-block.js:2614` effColor = color || (useRoleColor ? … : '')
 *            ⇒ ★둘 다 없으면 `''` ⇒ `:2657` 의 `${effColor ? \`color:…\` : ''}` 가 ★아무것도 안 쓴다
 *
 * ★★범위 — `lnLinesHtml` 의 주인이 ★넷이다. ★같은 병일 수 있다
 *     `canvas-block.js:94` · `comparison-block.js:466` · `laurel-block.js:272` · `chat-block.js:142`
 *   ⇒ ★C3 가 ★그 넷을 ★한꺼번에 ★센다(★하나만 고치면 ★나머지가 ★빨강으로 남는다).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js cvb-linehost-text-color
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
/* ★주석 걷기는 ★공용 부품 — ⛔제 벌을 만들지 마라(`strip-comments-shared.test.js` ★S-6).
   ★261025 ★실측: ★안 걷었더니 ★월계수의 ★주석 문장
     「lnLinesHtml(= 그리드 줄 렌더 · 버블·챗·비교와 한 길)」을 ★★«호출»로 ★잡아
     ★★멀쩡한 주인을 ★빨강으로 만들었다. ⇒ ★「주석이 ★소스 파싱 게이트의 ★입력」 그 자리다. */
const { stripComments } = require('../unit/_strip-comments.js');
const read = (rel) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const readRaw = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* ★헤드리스 하네스엔 카드블럭 입구가 없다(`addCanvasBlock` 미노출 · 실측 261025)
   ⇒ ★★이 칸들은 ★«소스»로 잰다. ★행위 확인은 ★앱 축이다 — `CVB-LINEHOST-COLOR-APP-UNMEASURED-01`. */

test('C0 ★전제 — 두 파일을 읽고, 문제의 식을 떠낼 수 있다', () => {
  const lh = read('js/blocks/line-host.js');
  const gb = read('js/blocks/grid-block.js');
  expect(lh.includes('export function lnLinesHtml'), 'lnLinesHtml 정의를 못 찾았다 — 판정 무효').toBe(true);
  expect(gb.includes('const effColor = color ||'), 'effColor 식을 못 찾았다 — 판정 무효').toBe(true);
});

test('C1 ★★★자를 고쳤다 — ★재는 것은 ★«색이 줄에 닿나»이지 ★«인자를 넘기나»가 ★아니다', () => {
  /* ★★261025 ★자가정정 — ★처음에 나는 ★「`lnLinesHtml` 에 ★색 인자를 더해라」로 ★걸었다.
     ★★실측해 보니 ★★틀린 방향이었다 :
       · ★비교 `comparison-block.js:462` — ★그릇에 `color:${textColor}` 를 걸고 ★줄이 ★상속한다
         (★그 자리 주석: 「칼럼 글자색은 ★상속(색 미지정 줄)」)
       · ★챗 `chat-block.js:142` — ★`color:${color}` 를 ★그릇에 건다
       · ★월계수 `laurel-block.js:274` — `<div class="laurel-cell" style="color:${leafColor};">`
       · ★★카드 `canvas-block.js:94` — ★★`container` 에 ★아무것도 ★안 건다 ⇒ ★★깨지는 건 ★여기뿐
     ⇒ ★★처방은 ★「서명을 고쳐라」가 ★아니라 ★★「카드도 ★그릇에 색을 걸어라」다(★선례 셋과 같은 수법).
     ⇒ ★★그래서 ★이 자도 ★«성질»로 고쳤다 — ★★「그 줄이 ★색을 ★받는 길이 ★있나」.
     ⛔「인자를 넘기나」로 재면 ★멀쩡한 셋이 ★빨강이 되고 ★처방이 ★커진다. */
  const OWNERS = [
    ['js/blocks/canvas-block.js',     '카드'],
    ['js/blocks/comparison-block.js', '비교'],
    ['js/blocks/laurel-block.js',     '월계수'],
    ['js/blocks/chat-block.js',       '챗'],
  ];
  const bad = [];
  for (const [rel, name] of OWNERS) {
    const body = read(rel);
    const calls = body.match(/lnLinesHtml\([^)]*\)/g) || [];
    expect(calls.length, `${name}(${rel})에 lnLinesHtml 호출이 0개다 — 명부가 틀렸다`).toBeGreaterThan(0);
    /* ★색이 닿는 길 ★둘 중 ★하나면 된다 :
         ⒜ ★호출에 ★색을 ★넘긴다          ⒝ ★그릇(감싸는 요소)에 ★`color:` 를 ★건다 */
    const idx = body.indexOf('lnLinesHtml(');
    const near = body.slice(Math.max(0, idx - 900), idx + 400);
    /* ★색이 ★닿는 길은 ★셋이다(실측 261025) :
         ⒜ 호출에 색을 넘긴다
         ⒝ 그릇 HTML 에 `color:${…}` 를 박는다 (비교·챗·월계수)
         ⒞ 그릇 요소에 `style.color =` 로 건다 (카드 — 이번 고침)
       ⛔⒜만 재면 ★멀쩡한 셋이 빨강이 되고, ⒝만 재면 ★⒞ 를 못 본다. */
    const ok = /color/i.test(calls.join(' '))
            || /color\s*:\s*\$\{/.test(near)
            || /\.style\.color\s*=/.test(near);
    if (!ok) bad.push(`${name} — 호출에도 그릇에도 색이 없다: ${calls[0]}`);
  }
  expect(bad, `줄에 색이 안 닿는 주인:\n  ${bad.join('\n  ')}`).toEqual([]);
});

test('C2 ★★카드가 ★제 색을 ★그릇에 ★건다 (`canvas-block.js` — ★선례 셋과 같은 수법)', () => {
  const cb = read('js/blocks/canvas-block.js');
  const i = cb.indexOf('lnLinesHtml(');
  expect(i, 'lnLinesHtml 호출을 못 찾았다 — 판정 무효').toBeGreaterThan(0);
  const near = cb.slice(Math.max(0, i - 900), i + 400);
  /* ★★`_appendCardTexts` 가 ★`titleColor`/`descColor` 를 ★인자로 ★받아 놓고 ★그 분기에서 ★안 썼다.
     ⇒ ★그 값이 ★그릇에 ★닿아야 한다. */
  expect(near, '카드가 줄 그릇에 색을 안 건다 — 받은 titleColor/descColor 가 버려진다')
    .toMatch(/\.style\.color\s*=/);
  /* ★그 값이 ★«받은 인자»에서 와야 한다 — ⛔손으로 박은 색이면 또 갈린다 */
  expect(near, '그릇 색이 titleColor/descColor 에서 오지 않는다').toMatch(/titleColor\s*\|\|\s*descColor/);
});

test('C4 ★★음성대조 — `effColor` 가 ★여전히 ★「색이 없으면 안 쓴다」를 ★지킨다', () => {
  const gb = read('js/blocks/grid-block.js');
  /* ⛔이 고침이 ★「언제나 색을 박는다」로 ★흘러가면 ★옛 저장본의 ★상속 색이 ★덮인다.
     ⇒ ★조건부가 ★그대로 남아 있어야 한다. */
  expect(gb, 'effColor 가 비면 color 를 안 쓰는 조건이 사라졌다').toMatch(/\$\{effColor \? `color:\$\{effColor\};` : ''\}/);
});
