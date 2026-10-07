/* rich-text-sanitize.dom.spec.js — ★«부분 서식 HTML» sanitizer 를 재는 ★자.
 *
 * ★★왜 지금 생기나 (지디 판정 2026-10-08 ⑷)
 *   수지② 「모달블럭에서 텍스트 영역 선택한 만큼 안 됨」을 고치려면 모달 슬롯이 ★리치텍스트를
 *   담아야 하고, 그 선례가 `js/blocks/sticker-block.js` 의 «U6b 리치텍스트»다
 *   (`dataset.textHtml` ＋ sanitize ＋ 렌더·로드마다 ★재-sanitize).
 *   ⇒ 그 본문을 ★공용 모듈로 뽑아 ★모달이 같이 쓰게 하는 것이 지디 판정이다(⛔베끼지 마라 — 명부 둘).
 *   ★★그런데 ★그 선례를 재는 검사가 ★0건이었다(지디가 ★직접 재서 확인: `textHtml` in tests/ → 0,
 *     `sanitizeSticker|_STK_ALLOWED` → 0 · 그 grep 이 ★산다는 것도 양성대조로 확인 — `sticker` 는 8+ 파일에서 걸린다).
 *   ⇒ ★★«검증 안 된 코드를 공용 본문으로 올리는 것»이 사고다. ★이 파일이 ★그 공용화를 ★안전하게 만드는 계측기다.
 *   ⛔이 검사는 ★«현재 동작»을 잠근다 — 스티커의 ★행동을 바꾸려는 것이 ★아니다.
 *     ★공용화 뒤에도 ★초록이어야 하고, ★빨개지면 그것이 ★«공용화 실패»다. ★그걸 가르는 자가 이 파일이다.
 *
 * ★★왜 unit 이 아니라 DOM 인가 — sanitizer 가 `document.createElement('template')` 로 파싱한다.
 *   ★이 레포엔 ★jsdom 이 ★없다(package.json devDeps = @playwright/test · electron · electron-builder
 *   ★셋뿐 · 그 사실은 tests/unit 머리말 여러 곳이 이미 적어 뒀다) ⇒ ★진짜 DOM 이 필요하다.
 *   ★앱을 통째로 안 띄운다 — `boot()`(가벼운 길)로 ★모듈 하나만 든다. sticker-block.js 는
 *   ★import 0 · 최상위 부작용 0 이라 단독으로 든다(실측).
 *
 * ★★자를 «정의 자리»에서 읽는다 (지디 ⒜)
 *   허용목록은 export 가 ★없다 ⇒ ★소스 문자열에서 ★그 선언 한 줄을 파싱해 쓴다.
 *   ⛔사용 자리 grep 으로 세지 않는다 — 「거짓양·음성이 ★동시에 온다」.
 *   ⚠️그래서 이 파일은 ★«소스 파싱 게이트»다 — ★내 주석이 그 입력이 되지 않게 ★선언 줄에만 닻을 건다.
 *
 * 재는 것
 *   S0 ★전제 — 모듈을 들면 입구 둘이 ★함수다. ⛔이게 거짓이면 아래 전부가 «아무것도 안 잼»이다.
 *   S1 ⒜ ★허용목록 ★전수 — ★정의 자리에서 읽은 태그가 ★하나도 빠짐없이 ★살아남는다.
 *   S2 ⒝ ★★음성대조 — script·style·on*·url(·javascript:·img·a[href]·주석·class/id/data-* 가 ★안 살아남는다.
 *   S3 ⒞ ★★양성대조(검사 안에서) — ★허용목록에 ★없는 서식 태그(mark·font·big)는 ★언랩된다.
 *        ⇒ 「허용목록이 ★실제로 상의된다」를 잠근다. ⛔이게 없으면 S1 은 「전부 통과시킨다」와 구분 안 된다.
 *   S4 ⒟ ★★STRIKE ★한 건 — 선례의 ★심장이다. `sticker-block.js` 38~40행:
 *        「STRIKE 는 레거시지만 ★execCommand 가 ★실제로 만드는 태그 — 허용목록에 없으면 ⌘⇧X 로 그은
 *          취소선이 커밋 순간 언랩돼 ★«되는 척»만 하고 사라진다」
 *        ★★그게 내가 수지②⑦ 에서 ★방금 실측한 ★같은 증상이다(tests/dom/sz27-partial-format-wall).
 *        ⇒ ★execCommand 가 ★이 브라우저에서 ★무엇을 만드는지도 ★같이 재서, 그 태그가 ★허용목록에 있나 본다.
 *   S5 ★★멱등성 — 렌더·로드마다 ★다시 돌리는 자다. `f(f(x)) === f(x)` 가 아니면 서식이 ★닳는다.
 *   S6 ★`_stickerHtmlHasFormatting` — `<br>` 만 있으면 ★false(평문 경로 유지), 서식이 있으면 ★true.
 *
 * ⛔이 파일이 «못 재는» 축: 저장본 왕복 · 실제 블럭 렌더(그건 스티커 쪽 DOM 시험 몫) ·
 *   ★공용화 뒤 「소비자 둘 다 빨강」(그건 공용화 커밋에서 ★따로 건다).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js rich-text-sanitize
 */
const { test, expect } = require('@playwright/test');
const { boot, src } = require('./_root-harness.js');

const REL = 'js/blocks/sticker-block.js';
const PAGE = '<!doctype html><meta charset="utf-8"><body></body>';

/* ★정의 자리 파싱 — `const _STK_ALLOWED_TAGS = new Set([...])` 한 줄에만 닻을 건다. */
function parseSet(source, name) {
  const m = source.match(new RegExp(`const\\s+${name}\\s*=\\s*new Set\\(\\[([^\\]]*)\\]\\)`));
  if (!m) return null;
  return m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

async function load(page) {
  const errs = await boot(page, PAGE, { ready: false });
  await page.evaluate(async (rel) => { await import('/' + rel); }, REL);
  return errs;
}
const san = (page, html) => page.evaluate((h) => window._sanitizeStickerHtml(h), html);
const hasFmt = (page, html) => page.evaluate((h) => window._stickerHtmlHasFormatting(h), html);

/* ══════════════════════════════════════════════════════════════════ */

test('S0 ★전제 — 모듈을 들면 입구 둘이 함수다 (잣대가 산다)', async ({ page }) => {
  const errs = await load(page);
  const t = await page.evaluate(() => ({
    san: typeof window._sanitizeStickerHtml, fmt: typeof window._stickerHtmlHasFormatting,
  }));
  console.log('  S0:', JSON.stringify(t));
  expect(t, `★입구가 함수가 아니다 — 아래 전부가 «아무것도 안 잼»이 된다. 잰 값 ${JSON.stringify(t)}`)
    .toEqual({ san: 'function', fmt: 'function' });
  /* ★자가 실제로 «무엇을 한다»도 한 번 — 빈 입력에 안 죽고, 평문은 그대로 */
  expect(await san(page, '')).toBe('');
  expect(await san(page, 'AAA')).toBe('AAA');
  expect(errs).toEqual([]);
});

test('S1 ⒜ ★허용목록 전수 — «정의 자리»에서 읽은 태그가 하나도 빠짐없이 살아남는다', async ({ page }) => {
  const source = src(REL);
  const tags = parseSet(source, '_STK_ALLOWED_TAGS');
  const props = parseSet(source, '_STK_ALLOWED_STYLE_PROPS');
  console.log('  S1 정의 자리:', JSON.stringify({ tags, props }));
  /* ★전제 — 파싱이 ★살아 있다. ⛔못 찾으면 아래 루프가 ★0회 돌고 ★초록이 된다. */
  expect(tags, '★_STK_ALLOWED_TAGS 를 정의 자리에서 못 읽었다 — 선언 꼴이 바뀌었나. 이 상태로는 아무것도 안 잰다').toBeTruthy();
  expect(props, '★_STK_ALLOWED_STYLE_PROPS 를 정의 자리에서 못 읽었다').toBeTruthy();
  expect(tags.length, `★태그 명부가 비었다. 잰 값 ${JSON.stringify(tags)}`).toBeGreaterThan(0);
  /* ★이름으로 확인 — ⛔수로만 세면 하나가 조용히 바뀌어도 안 보인다 */
  for (const must of ['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'BR', 'SPAN']) {
    expect(tags, `★«${must}» 가 허용목록에서 사라졌다 — 그 서식이 커밋 순간 언랩된다`).toContain(must);
  }

  await load(page);
  const kept = [];
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    const input = lower === 'br' ? `A<br>B` : `A<${lower}>X</${lower}>B`;
    const out = await san(page, input);
    const alive = new RegExp(`<${lower}\\b`, 'i').test(out);
    kept.push([tag, alive, out]);
    expect(alive, `★허용된 «${tag}» 가 살아남지 않았다. 입력 ${input} → 산출 ${out}`).toBe(true);
  }
  console.log('  S1 살아남음:', JSON.stringify(kept.map(([t, a]) => [t, a])));

  /* ★허용 style prop 전수 — span 에 걸면 산다(값은 각 prop 이 받는 꼴로 준다) */
  const VAL = { 'color': '#112233', 'font-weight': '700', 'font-style': 'italic',
                'text-decoration': 'line-through', 'background-color': 'rgb(1, 2, 3)' };
  for (const p of props) {
    const v = VAL[p];
    expect(v, `★이 검사가 «${p}» 에 줄 값을 모른다 — prop 이 늘었다. 값을 더해라(⛔모르는 채 건너뛰지 마라)`).toBeTruthy();
    const out = await san(page, `<span style="${p}:${v}">X</span>`);
    expect(out, `★허용된 style prop «${p}» 가 걷혔다. 산출 ${out}`).toContain(p);
  }
});

test('S2 ⒝ ★★음성대조 — 위험한 것은 하나도 살아남지 않는다', async ({ page }) => {
  const errs = await load(page);
  const CASES = [
    ['script 통째',        '<script>alert(1)</script>A',                  /script|alert/i],
    ['style 통째',         '<style>b{color:red}</style>A',                 /style>|color:red/i],
    ['on* 속성',           '<span onerror="x()" onclick="y()">A</span>',   /onerror|onclick/i],
    ['img',                '<img src=x onerror=alert(1)>A',               /<img|onerror/i],
    ['a[href]',            '<a href="javascript:alert(1)">A</a>',          /<a\b|href|javascript/i],
    ['style url(',         '<span style="background-color:url(x)">A</span>', /url\(/i],
    ['style javascript:',  '<span style="color:javascript:alert(1)">A</span>', /javascript/i],
    ['style expression(',  '<span style="color:expression(alert(1))">A</span>', /expression/i],
    ['허용 안 된 prop',    '<span style="position:fixed;top:0">A</span>',  /position|top/i],
    ['class·id·data-*',    '<span class="c" id="i" data-x="1">A</span>',   /class=|id=|data-x/i],
    ['주석',               '<!-- c -->A',                                  /<!--/],
    ['iframe',             '<iframe src="x"></iframe>A',                   /iframe/i],
  ];
  const rows = [];
  for (const [name, input, bad] of CASES) {
    const out = await san(page, input);
    rows.push([name, out]);
    expect(bad.test(out), `★«${name}» 가 살아남았다. 입력 ${input} → ★산출 ${out}`).toBe(false);
    /* ★글자는 살아야 한다 — 위험한 것만 걷는 자이고 «전부 지우는 자»가 아니다(그러면 음성대조가 공짜다) */
    if (name !== 'script 통째' && name !== 'style 통째' && name !== 'iframe') {
      expect(out, `★«${name}» 에서 글자까지 사라졌다 — 그러면 이 음성대조가 공짜로 참이 된다. 산출 ${out}`).toContain('A');
    }
  }
  console.log('  S2:', JSON.stringify(rows));
  expect(errs).toEqual([]);
});

test('S3 ⒞ ★★양성대조 — 허용목록에 «없는» 서식 태그는 언랩된다 (명부가 실제로 상의된다)', async ({ page }) => {
  const source = src(REL);
  const tags = parseSet(source, '_STK_ALLOWED_TAGS');
  const NOT = ['mark', 'font', 'big', 'small', 'sub', 'sup', 'code'];
  /* ★전제 — 이 일곱이 ★정말 허용목록 «밖»이다. ⛔허용목록이 늘면 이 검사가 거짓이 되므로 먼저 단언한다. */
  for (const t of NOT) {
    expect(tags.map(x => x.toUpperCase()), `★«${t}» 가 이제 허용목록에 ★있다 — 이 양성대조가 낡았다. 명부를 고쳐라`)
      .not.toContain(t.toUpperCase());
  }
  await load(page);
  const rows = [];
  for (const t of NOT) {
    const out = await san(page, `A<${t}>X</${t}>B`);
    rows.push([t, out]);
    expect(new RegExp(`<${t}\\b`, 'i').test(out), `★허용목록 밖인 «${t}» 가 살아남았다 — 명부가 상의되지 않는다. 산출 ${out}`).toBe(false);
    expect(out, `★«${t}» 를 걷으면서 글자까지 잃었다(언랩이어야 한다). 산출 ${out}`).toBe('AXB');
  }
  console.log('  S3:', JSON.stringify(rows));
});

test('S4 ⒟ ★★STRIKE — 선례의 심장. execCommand 가 «실제로 만드는» 태그가 허용목록에 있다', async ({ page }) => {
  const source = src(REL);
  const tags = parseSet(source, '_STK_ALLOWED_TAGS');
  expect(tags, '★STRIKE 가 허용목록에서 빠졌다 — ⌘⇧X 취소선이 커밋 순간 언랩돼 «되는 척»만 하고 사라진다').toContain('STRIKE');
  const errs = await load(page);
  const out = await san(page, 'A<strike>X</strike>B');
  expect(/<strike\b/i.test(out), `★<strike> 가 걷혔다. 산출 ${out}`).toBe(true);

  /* ★★이 브라우저의 execCommand 가 ★무엇을 만드는지 ★재서, 그 태그가 ★허용목록에 있나 본다.
     ⛔「Chrome 은 <strike> 를 만든다」를 ★주석에서 베끼지 않는다 — ★여기서 센다. */
  const made = await page.evaluate(() => {
    const d = document.createElement('div');
    d.setAttribute('contenteditable', 'true');
    d.textContent = 'AAABBBCCC';
    document.body.appendChild(d);
    const r = document.createRange();
    r.setStart(d.firstChild, 6); r.setEnd(d.firstChild, 9);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    const pre = { rc: s.rangeCount, str: s.toString() };
    document.execCommand('strikeThrough');
    const html = d.innerHTML;
    const tagsMade = [...d.querySelectorAll('*')].map(e => e.tagName);
    d.remove();
    return { pre, html, tagsMade };
  });
  console.log('  S4 execCommand 가 만든 것:', JSON.stringify(made));
  /* ★전제 — 선택이 섰다. ⛔아니면 아래는 «빈 것»을 잰다. */
  expect(made.pre, `★전제 — 선택이 "CCC" 로 서야 한다. 잰 값 ${JSON.stringify(made.pre)}`).toEqual({ rc: 1, str: 'CCC' });
  expect(made.tagsMade.length, `★execCommand 가 아무 태그도 안 만들었다 — 이 측정이 아무것도 안 잰다. 잰 값 ${JSON.stringify(made)}`).toBeGreaterThan(0);
  const upper = tags.map(t => t.toUpperCase());
  for (const t of made.tagsMade) {
    expect(upper, `★★execCommand 가 만든 «${t}» 가 ★허용목록에 ★없다 — 그 서식은 커밋 순간 언랩돼 ` +
      `«되는 척»만 하고 사라진다(sticker-block.js 38~40행이 적은 그 병). 만든 것 ${JSON.stringify(made.tagsMade)} / 명부 ${JSON.stringify(upper)}`)
      .toContain(t);
  }
  /* ★그리고 그 산출물이 sanitize 를 ★견딘다 */
  const survived = await san(page, made.html);
  expect(survived, `★execCommand 산출물이 sanitize 를 못 견뎠다. ${made.html} → ${survived}`).toMatch(/<(strike|s)\b/i);
  expect(errs).toEqual([]);
});

test('S5 ★★멱등성 — 렌더·로드마다 다시 돌리는 자다. f(f(x)) === f(x)', async ({ page }) => {
  const errs = await load(page);
  const CASES = [
    'A<b>X</b>B',
    'A<strike>X</strike>B',
    '<span style="color:#112233;font-weight:700">X</span>',
    'A<br>B',
    '<b><i><span style="background-color:rgb(1, 2, 3)">X</span></i></b>',
    'A<mark>X</mark>B',
    '<span style="position:fixed;color:#abc">X</span>',
  ];
  const rows = [];
  for (const c of CASES) {
    const once = await san(page, c);
    const twice = await san(page, once);
    rows.push([c, once, twice]);
    expect(twice, `★★두 번 돌리면 달라진다 — 렌더마다 서식이 ★닳는다. ${c} → ${once} → ${twice}`).toBe(once);
  }
  console.log('  S5:', JSON.stringify(rows));
  /* ★음성대조 — 적어도 하나는 ★실제로 바뀌어야 한다(전부 항등이면 이 검사가 아무것도 안 잰다) */
  const changedAtFirst = rows.filter(([c, once]) => once !== c).length;
  expect(changedAtFirst, '★한 건도 안 바뀌었다 — sanitizer 가 아무것도 안 하고 있거나 이 표가 너무 순하다').toBeGreaterThan(0);
  expect(errs).toEqual([]);
});

test('S6 ★_stickerHtmlHasFormatting — <br> 만 있으면 false(평문 경로 유지) · 서식이면 true', async ({ page }) => {
  const errs = await load(page);
  const CASES = [
    ['평문',            'AAA',                                        false],
    ['<br> 만',         'A<br>B',                                     false],
    ['style 없는 span', 'A<span>X</span>B',                           false],
    ['<b>',             'A<b>X</b>B',                                 true],
    ['<strike>',        'A<strike>X</strike>B',                       true],
    ['style 달린 span', 'A<span style="color:#112233">X</span>B',      true],
  ];
  const rows = [];
  for (const [name, html, want] of CASES) {
    const got = await hasFmt(page, html);
    rows.push([name, got]);
    expect(got, `★«${name}» 판정이 ${want} 여야 한다. 입력 ${html} → 잰 값 ${got}`).toBe(want);
  }
  console.log('  S6:', JSON.stringify(rows));
  expect(errs).toEqual([]);
});
