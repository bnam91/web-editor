/* ★그리드 절 «정리» — 안내문 제거 · 칼럼+거터 한 줄 · 거터 기본값 10 (2026-09-08 현빈)
 *
 * 현빈 원문:
 *   "그리드 가이드 체크박스로 되어있는 부분 정리좀 해줘. 기능은 맞으나,
 *    저장재보기에는 나오지 않는다는 말 없어도 될듯하고, 칼럼과 거터 하나의 로우에 둬도 될듯해.
 *    그리고 거터의 디폴트값은 10으로 잡아줘. 20이 아니라."
 *
 * ⚠️이 파일은 «모양»을 못 박는다. 「가이드가 저장·내보내기에 새지 않는가」라는 «성질»은
 *   tests/unit/grid-guide.test.js 의 M2·M2-변이 가 지킨다. 안내문을 지웠다고 그 성질이
 *   바뀐 게 아니다 — 문장만 지웠고 배선(export 가드)은 그대로다. 그 파일을 건드리지 마라.
 *
 * ★이 파일의 모든 루프·정규식 검사는 «입력이 살아 있다»를 먼저 단언한다.
 *   근거: 같은 날 이 팀에서 루프 검사 6개가 «표를 비우니 전부 초록»이 됐다.
 *   입력이 비면 0바퀴라 스스로 통과한다 — 그건 통과가 아니라 «안 잰 것»이다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { readSrc, toPosix } = require('./_srcread.js');   // ⛔CRLF — win-portability
const { stripComments } = require('./_strip-comments.js'); // ⛔자기 벌 금지 (S-6)

const ROOT = path.join(__dirname, '..', '..');
const PAGE = stripComments(readSrc(ROOT, 'js', 'props', 'prop-page.js'));
const CANVAS_CSS = stripComments(readSrc(ROOT, 'css', 'editor-canvas.css'));

/* 소스 트리를 훑는 단 하나의 문 — js/·css/ 만, node_modules·점파일은 안 본다. */
function walkSrc() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(js|mjs|css)$/.test(e.name)) out.push(full);
    }
  };
  walk(path.join(ROOT, 'js'));
  walk(path.join(ROOT, 'css'));
  return out;
}

/* ⛔고정 창(slice(i, i+900)) 금지 — 줄이 하나 늘면 검사가 조용히 눈이 먼다.
   여는 <div 와 </div> 를 세어 «균형이 맞는 자리»까지 떠낸다. */
function extractDiv(src, from) {
  const start = src.indexOf('<div', from);
  if (start < 0) return '';
  let depth = 0, i = start;
  while (i < src.length) {
    const open = src.indexOf('<div', i);
    const close = src.indexOf('</div>', i);
    if (close < 0) return '';
    if (open >= 0 && open < close) { depth++; i = open + 4; continue; }
    depth--; i = close + 6;
    if (depth === 0) return src.slice(start, i);
  }
  return '';
}

/* ═══════════════════════════════════════════════════════════════════════════
   T-G1 — #10 안내문 제거
   ═══════════════════════════════════════════════════════════════════════════ */
test('T-G1 ★「저장·내보내기에는 나오지 않습니다」 안내문이 0건이다', () => {
  /* ★입력이 살아 있다 — 그리드 절을 «진짜로» 읽고 있나.
     ⛔이 줄이 없으면 PAGE 가 통째로 비어도 아래 doesNotMatch 가 그냥 통과한다. */
  assert.ok(PAGE.includes('그리드 가이드'),
    '그리드 절 자체를 못 찾았다 — T-G1 은 아무것도 안 쟀다');
  assert.ok(PAGE.includes('page-grid-on'), '그리드 체크박스가 없다 — 읽은 게 그 파일이 맞나');

  /* ⚠️되돌리면 빨개진다: prop-hint 로 그 문장을 다시 넣는 순간. */
  assert.doesNotMatch(PAGE, /저장·내보내기에는 나오지 않습니다/,
    '★안내문이 되살아났다 — 현빈이 "없어도 될듯"이라 지운 문장이다 (동작은 그대로, 문장만 지웠다)');
});

/* ═══════════════════════════════════════════════════════════════════════════
   T-G2 — #11 칼럼 + 거터를 «한» prop-row 로
   ═══════════════════════════════════════════════════════════════════════════ */
test('T-G2 ★칼럼·프리셋·거터가 «같은 .prop-row» 안에 있다', () => {
  const anchor = PAGE.indexOf('<div class="prop-row" id="page-grid-opts">');
  assert.ok(anchor > 0, '그리드 옵션 행(#page-grid-opts)을 못 찾았다');

  const rowSrc = extractDiv(PAGE, anchor);
  /* ★입력이 살아 있다 — 행 소스를 «진짜로» 떠냈나. 빈 문자열이면 아래 3건이 전부 공회전한다. */
  assert.ok(rowSrc.length > 0, '★행 소스를 못 떠냈다 (div 균형이 안 맞는다) — T-G2 는 아무것도 안 쟀다');
  assert.ok(rowSrc.startsWith('<div class="prop-row"'), `떠낸 것이 행이 아니다: ${rowSrc.slice(0, 40)}`);

  /* ⚠️되돌리면 빨개진다: 거터를 다시 «자기 prop-row» 로 떼어내는 순간
       (그러면 거터가 이 행 밖으로 나가 아래 세 번째 단언이 터진다). */
  for (const id of ['page-grid-col-presets', 'page-grid-cols', 'page-grid-gut']) {
    assert.ok(rowSrc.includes(`id="${id}"`),
      `★#${id} 이 칼럼 행 밖에 있다 — 현빈은 "칼럼과 거터 하나의 로우"를 원했다`);
  }

  /* 라벨 두 개가 한 줄에 들어가려면 «한정 클래스»로 좁혀야 한다.
     ⛔전역 .prop-label(56px)을 내리면 다른 패널의 긴 라벨이 전부 잘린다. */
  const narrow = (rowSrc.match(/prop-label--narrow/g) || []).length;
  assert.strictEqual(narrow, 2,
    `★한정 라벨이 ${narrow}개다 — 칼럼·거터 두 라벨 모두 .prop-label--narrow 여야 한다`);

  const PROPS_CSS = stripComments(readSrc(ROOT, 'css', 'editor-props.css'));
  assert.match(PROPS_CSS, /\.prop-label--narrow\s*\{[^}]*width:\s*28px/,
    '★.prop-label--narrow 정의가 없거나 28px 이 아니다 (34px 은 여유 0 — 실측)');
  assert.match(PROPS_CSS, /\.prop-label \{[^}]*width:\s*56px/,
    '★전역 .prop-label 의 56px 이 바뀌었다 — 한정 클래스로 좁히랬지 전역을 내리랬던 게 아니다');
});

/* ═══════════════════════════════════════════════════════════════════════════
   T-G3 — #11 죽은 배선(거터 슬라이더)이 «안» 남았다
   ═══════════════════════════════════════════════════════════════════════════ */
test('T-G3 ★page-grid-gut-slider 참조가 js/·css/ 코드에 0건이다', () => {
  const files = walkSrc();
  /* ★입력이 살아 있다 ⑴ — 파일을 실제로 찾았나. */
  assert.ok(files.length >= 20, `훑은 파일이 ${files.length}개뿐이다 — 소스 트리를 못 찾았다`);

  let liveHits = 0;
  const dead = [];
  for (const f of files) {
    const code = stripComments(readSrc(f));
    if (code.includes('page-grid-gut')) liveHits++;   // ★살아 있는 «형제» 토큰
    for (const tok of ['page-grid-gut-slider', 'gridGutSlider']) {
      if (code.includes(tok)) dead.push(`${toPosix(path.relative(ROOT, f))}: ${tok}`);
    }
  }
  /* ★입력이 살아 있다 ⑵ — 주석을 턴 «뒤»에도 진짜 코드가 남았나.
     거르개가 너무 세게 먹어 파일이 비면 dead 는 «당연히» 0 이 되고 이 검사는 거짓 초록이 된다. */
  assert.ok(liveHits >= 1,
    '주석을 턴 뒤 page-grid-gut 이 한 곳도 안 잡힌다 — 거르개가 코드까지 먹었다');

  /* ⚠️되돌리면 빨개진다: 거터 슬라이더(input[type=range])나 gridGutSlider 상수를 되살리는 순간. */
  assert.deepStrictEqual(dead, [],
    '★죽은 배선이 남았다 — 슬라이더를 버렸으면 참조도 «전부» 걷어내야 한다:\n  ' + dead.join('\n  '));
});

/* ═══════════════════════════════════════════════════════════════════════════
   T-G4 / T-G5 — #12 거터 기본값 10
   ═══════════════════════════════════════════════════════════════════════════ */

/* 거터의 «기본값»이 적힌 자리를 소스에서 모아 온다.
   ⚠️clampGut 의 `parseInt(v) || 0` 은 «기본값»이 아니라 «빈 칸 폴백»이다(칼럼은 ||12, 거터는 ||0).
     헷갈리기 쉬운 비대칭이라 일부러 여기서 세지 않는다 — 손대지도 마라. */
function gutterDefaultSites() {
  const sites = [];
  const mk = PAGE.match(/id="page-grid-gut"[^>]*\bvalue="(\d+)"/);
  if (mk) sites.push({ where: 'js/props/prop-page.js 마크업 value', v: mk[1] });
  for (const f of walkSrc().filter(f => f.endsWith('.css'))) {
    const code = stripComments(readSrc(f));
    for (const m of code.matchAll(/var\(--gdt-grid-gut,\s*(\d+)px\)/g)) {
      sites.push({ where: `${toPosix(path.relative(ROOT, f))} CSS 폴백`, v: m[1] });
    }
  }
  return sites;
}

test('T-G4 ★마크업 value="10" 이고 CSS 폴백도 10px 이다', () => {
  const sites = gutterDefaultSites();
  /* ★입력이 살아 있다 — 두 자리를 «진짜로» 떠냈나. 0건이면 아래는 잰 게 없다. */
  assert.ok(sites.length >= 2,
    `★거터 기본값 자리를 ${sites.length}곳만 찾았다 — 마크업과 CSS 둘 다 떠내야 한다`);

  /* ⚠️되돌리면 빨개진다: value="10" → "20" (그리고 T-G5 도 같이). */
  assert.match(PAGE, /id="page-grid-gut"[^>]*\bvalue="10"/,
    '★마크업 거터 기본값이 10 이 아니다 — 현빈: "거터의 디폴트값은 10으로 잡아줘. 20이 아니라"');
  assert.match(CANVAS_CSS, /var\(--gdt-grid-gut,\s*10px\)/,
    '★CSS 폴백이 10px 이 아니다 — JS 가 변수를 못 세운 상태에서 그려지는 값이다');
});

test('T-G5 ★기본값 10 은 «출처가 하나»다 — 사본이 갈라지면 빨강', () => {
  const sites = gutterDefaultSites();
  /* ★입력이 살아 있다 — 표를 비우면 아래 Set 검사가 스스로 통과한다. */
  assert.ok(sites.length >= 2,
    `★기본값 자리를 ${sites.length}곳만 찾았다 — T-G5 는 아무것도 안 쟀다`);

  const values = new Set(sites.map(s => s.v));
  /* ⚠️되돌리면 빨개진다: 마크업만 20 으로, 또는 «CSS 폴백만» 20 으로.
       어느 한쪽만 되돌려도 값이 둘로 갈라져 여기서 잡힌다 — 그게 「사본 부활」이다. */
  assert.strictEqual(values.size, 1,
    '★거터 기본값이 서로 다른 값으로 갈라졌다 (사본 부활):\n  ' +
    sites.map(s => `${s.where} = ${s.v}`).join('\n  '));
  assert.strictEqual([...values][0], '10',
    `★단 하나의 기본값이 10 이 아니라 ${[...values][0]} 이다`);
});

/* ═══════════════════════════════════════════════════════════════════════════
   T-G6 — ★기존 저장값 불침범 («실제 소스»를 가짜 localStorage 위에서 돌려 잰다)
   ⛔마이그레이션은 «만들지 않았다»(계획 지시). 「저장값이 마크업 기본값을 덮어쓴다」가
     맞는지를 말로 하지 않고 «돌려서» 잰다. jsdom 이 없어 prop-page.js 를 통째로는 못 불러온다 —
     DOM 을 안 쓰는 세 문과 초기화 구간만 글자 그대로 떼어 낸다.
   ⚠️readGridPref/saveGridPref/GRID_KEY 는 grid-guide.test.js 의 M4 도 «같은 모양»으로 떠낸다.
     그 세 문을 리팩터하면 여기와 M4 가 «둘 다» 못 떠내서 터진다. 손대지 마라.
   ═══════════════════════════════════════════════════════════════════════════ */
function runInit(seed) {
  const key  = PAGE.match(/const GRID_KEY = '([^']+)'/);
  const read = PAGE.match(/const readGridPref = [\s\S]*?\n  \};/);
  const save = PAGE.match(/const saveGridPref = [^\n]*\n/);
  /* 초기화 구간 — «pref.g 줄이 없어도» 떠내진다.
     ⛔pref.g 를 끝 닻으로 쓰면 그 줄을 지우는 변이가 «행동»이 아니라 정규식에서 먼저 터진다. */
  const init = PAGE.match(/const pref = readGridPref\(\);([\s\S]*?)\[gridOn, gridCols, gridGut\]/);

  assert.ok(key && read && save,
    '★readGridPref/saveGridPref/GRID_KEY 를 소스에서 못 떼어 냈다 — T-G6 은 아무것도 안 쟀다');
  assert.ok(init && init[1].trim().length > 0,
    '★초기화 구간을 못 떠냈다 — T-G6 은 아무것도 안 쟀다');

  const mkDefault = PAGE.match(/id="page-grid-gut"[^>]*\bvalue="(\d+)"/);
  assert.ok(mkDefault, '★마크업 기본값을 못 떠냈다 — 무엇과 비교할지가 없다');

  const store = new Map();
  if (seed !== undefined) store.set(key[1], JSON.stringify(seed));
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  // eslint-disable-next-line no-new-func
  const fn = new Function('localStorage', 'GUT_DEFAULT', `
    ${key[0]};
    ${read[0]}
    ${save[0]}
    const gridOn   = { checked: false };
    const gridCols = { value: '12' };
    const gridGut  = { value: GUT_DEFAULT };
    const pref = readGridPref();
    ${init[1]}
    return { gut: String(gridGut.value), cols: String(gridCols.value), on: !!gridOn.checked };
  `);
  return { out: fn(localStorage, mkDefault[1]), mkDefault: mkDefault[1] };
}

test('T-G6 ★기존 저장값 {g:33} 은 «안» 건드려진다 — 마이그레이션 불필요', () => {
  /* ⚠️되돌리면 빨개진다: `if (gridGut && pref.g != null) gridGut.value = pref.g;` 를 지우는 순간
       (그러면 저장값 33 대신 마크업 기본값이 남는다). */
  const { out } = runInit({ on: true, n: 12, g: 33 });
  assert.strictEqual(out.gut, '33',
    '★기존 사용자의 거터 저장값이 덮어써졌다 — 기본값 변경은 «새 사용자»에게만 미쳐야 한다');
  assert.strictEqual(out.cols, '12', '칼럼 저장값도 같은 규칙이어야 한다');
  assert.strictEqual(out.on, true, '켜짐 상태가 안 읽혔다 — 초기화 구간을 제대로 떠낸 게 맞나');
});

test('T-G6-b ★새 사용자(저장 키 없음)는 마크업 기본값 10 을 본다', () => {
  const { out, mkDefault } = runInit(undefined);
  assert.strictEqual(out.gut, mkDefault, '저장값이 없는데 마크업 기본값이 안 남았다');
  assert.strictEqual(out.gut, '10', '★새 사용자가 보는 거터 기본값이 10 이 아니다');
});

test('T-G6-c ★키는 있고 g 만 없는 경우도 마크업 기본값 10 이다', () => {
  const { out } = runInit({ on: false, n: 6 });
  assert.strictEqual(out.gut, '10', '★g 가 없는 저장값에서 거터가 10 으로 안 떨어진다');
  assert.strictEqual(out.cols, '6', '함께 저장된 n 은 살아야 한다 — 읽기 자체가 죽은 게 아닌지 확인');
});
