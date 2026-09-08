/* ★그리드 가이드 — 「편집 보조가 «문서»에 새지 않는가」 (2026-09-08 현빈 요청)
 *
 * ⛔이 기능의 유일한 위험은 «기능이 안 되는 것»이 아니라 «저장·내보내기에 섞이는 것»이다.
 *   고디터의 저장은 캔버스 DOM 을 그대로 직렬화한다(js/io/save-load.js getSerializedCanvas).
 *   ⇒ 오버레이 <div> 하나, inner.style 한 줄이면 프로젝트 파일에 가이드가 들어가고
 *     남의 컴퓨터에서 열어도 따라가며, 내보낸 이미지에도 찍힌다.
 *   ⇒ 그래서 배선을 «DOM 을 안 건드리는» 모양으로 못 박는다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { readSrc, toPosix } = require('./_srcread.js');   // ⛔CRLF — win-portability ①-3

const ROOT = path.join(__dirname, '..', '..');
const PAGE = readSrc(ROOT, 'js', 'props', 'prop-page.js');
const CSS  = readSrc(ROOT, 'css', 'editor-canvas.css');
const EXP  = readSrc(ROOT, 'js', 'io', 'export-image.js');
const SAVE = readSrc(ROOT, 'js', 'io', 'save-load.js');
/* ★주석 거르개는 «공용 부품»을 쓴다 — 직접 만들지 마라(tests/unit/strip-comments-shared.test.js S-6).
   예전에 이 파일에도 자기 codeOnly 가 있었고, 그건 이 레포에서 9벌이 같은 형태로 부서져 있던
   `src.replace(/\/\*[\s\S]*?\*\//g,'')` 그대로였다 — `accept="image/*"` 의 `/*` 를 주석 시작으로 읽고
   다음 `*` + `/` 까지 «진짜 코드»를 삼켜, 검사가 「0건 = 통과」로 초록이 된다.
   ⚠️M1 은 js/ 트리를 통째로 훑으므로 image/* 가 있는 파일(block-drag·prop-sticker 등)을 «실제로» 지난다.
     ⇒ 자기 거르개를 썼다면 M1 에 눈먼 자리가 생겼을 것이다. */
const { stripComments } = require('./_strip-comments.js');
const codeOnly = stripComments;

test('G0 ★양성대조 — 저장이 «DOM 을 직렬화»하는 게 맞나 (이 검사의 전제)', () => {
  assert.match(SAVE, /function getSerializedCanvas/,
    '저장 방식이 바뀌었다면 이 검사의 «이유»가 달라진다 — 지우지 말고 다시 판단하라');
  assert.match(SAVE, /querySelectorAll\('\.section-block'\)|canvasEl\.innerHTML/,
    'DOM 을 훑어 저장하는 흔적이 없다');
});

test('G1 클래스는 «body 에만» 붙는다 — 캔버스 안에는 흔적이 없다', () => {
  const src = codeOnly(PAGE);
  const hits = [...src.matchAll(/classList\.(?:toggle|add|remove)\([^)]*gdt-grid[^)]*\)/g)];
  /* ⚠️예전엔 «2곳 이상»을 요구했다 — 그때는 gdt-grid-on 과 gdt-grid-mid 둘을 토글했기 때문이다.
       중앙선을 걷어내(현빈 지시) 토글은 gdt-grid-on «한 곳»만 남는다. ⇒ 1 로 내린다.
     ★그래도 0 은 안 된다 — 0 이면 배선이 통째로 사라진 것이고, 아래 for 문이 «한 바퀴도 안 돌아»
       G1 이 통째로 공회전한다(빈 루프는 늘 통과한다). 이 줄이 그 공회전을 막는 «입력이 살아 있다»다. */
  assert.ok(hits.length >= 1, `그리드 클래스 조작을 ${hits.length}곳 찾았다 — 배선이 사라졌나`);
  for (const h of hits) {
    const before = src.slice(Math.max(0, h.index - 60), h.index);
    assert.match(before, /document\.body\.$/,
      `★body 가 아닌 요소에 그리드 클래스를 붙인다 — 저장에 섞인다: …${before.slice(-40)}${h[0]}`);
  }
});

test('G2 ★섹션에 «인라인 스타일»을 쓰지 않는다 — 그게 저장에 섞이는 두 번째 길', () => {
  const src = codeOnly(PAGE);
  const i = src.indexOf('function refreshGrid');
  assert.ok(i > 0, 'refreshGrid 가 없다');
  const body = src.slice(i, src.indexOf('\n  }', i));
  assert.doesNotMatch(body, /\.section-inner[^)]*\)\.style|inner\.style\.setProperty/,
    '섹션에 직접 스타일을 쓰고 있다 — 인라인 스타일은 그대로 저장된다');
  assert.match(body, /documentElement\.style/,
    'CSS 변수는 «문서 루트»에 둬야 캔버스 DOM 이 깨끗하다');
});

test('G3 CSS 는 «패딩 안쪽»에만 그린다 — 패딩을 바꾸면 자동으로 따라온다', () => {
  assert.match(CSS, /body\.gdt-grid-on \.section-inner/, '그리드 규칙이 없다');
  assert.match(CSS, /background-origin:\s*content-box/, 'content-box 가 아니면 패딩 위에도 그려진다');
  assert.match(CSS, /background-clip:\s*content-box/);
});

test('G4 ★내보내기 «직전»에 끈다 — 가장 안쪽 함수에서', () => {
  const src = codeOnly(EXP);
  const i = src.indexOf('async function exportSection(');
  assert.ok(i > 0, 'exportSection 이 없다');
  const seg = src.slice(i, i + 700);
  assert.match(seg, /classList\.remove\('gdt-grid-on'\)/,
    '내보내기 전에 그리드를 안 끈다 — html2canvas 는 body 클래스를 복제해 캡처한다');
  assert.match(seg, /finally\s*\{/, '되돌리기가 finally 에 없으면 실패 시 가이드가 영영 꺼진다');
});

test('G5 저장 경로에는 그리드 «흔적 자체»가 없다', () => {
  assert.doesNotMatch(SAVE, /gdt-grid/,
    '저장 코드가 그리드를 알고 있다면, 그건 이미 문서에 섞였다는 뜻이다');
});

test('G6 ★변이대조 — 내보내기 가드를 빼면 G4 가 빨개진다', () => {
  const src = codeOnly(EXP);
  const mutated = src.replace(/classList\.remove\('gdt-grid-on'\)/, 'void 0');
  /* ★«주입이 먹었나»를 먼저 잰다.
     ⛔이 줄이 없으면 G6 은 공회전한다 — 대상 문자열이 사라지면 replace 가 아무것도 안 바꾸고
       아래 doesNotMatch 가 «그냥» 통과한다. 실제로 중앙선을 걷어낼 때 옛 문자열
       ('gdt-grid-on', 'gdt-grid-mid')이 안 맞아 G6 이 빨개지지 «않고» 조용히 통과했다. */
  assert.notStrictEqual(mutated, src, '★변이가 주입되지 않았다 — G6 이 공회전 중이다');
  const i = mutated.indexOf('async function exportSection(');
  const seg = mutated.slice(i, i + 700);
  assert.doesNotMatch(seg, /classList\.remove\('gdt-grid-on'\)/,
    '변이가 안 먹었다 = G4 는 이 배선을 «안» 본다');
});

/* ═══════════════════════════════════════════════════════════════════════════
   M1~M4 — 「중앙선 제거」(2026-09-08 현빈: "그리드에 중앙선 기능은 없어도 될 거 같아")
   ★기능을 없애는 변경의 위험은 «덜 지운 것»과 «같이 약해진 그물» 둘이다.
     M1 이 앞을, M2 가 뒤를 막는다. M2 가 핵심이다.
   ═══════════════════════════════════════════════════════════════════════════ */

/* 소스 트리를 훑는 «단 하나의» 문 — js/·css/ 만, node_modules 는 안 본다. */
function walkSrc() {
  const fs = require('fs');
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

/* ★주석을 터는 이유 — «이력을 적은 주석»과 «되살아난 코드»를 가르는 유일한 선.
   css/editor-canvas.css 에는 「중앙선이 있던 시절 칼럼이 지워지던 결함」 이력이 일부러 남아 있고
   그 주석은 `gdt-grid-mid` 를 «글자로» 담는다. 그건 부활이 아니라 기록이다.
   거르개는 위에서 받은 공용 부품(stripComments)을 쓴다. */

test('M1 ★중앙선이 «되살아나지» 않는다 — js/·css/ 코드에 gdt-grid-mid·page-grid-mid 0건', () => {
  const files = walkSrc();
  /* ★입력이 살아 있다 ⑴ — 파일을 실제로 «찾았나».
     ⛔이 줄이 없으면 walkSrc 가 빈 배열을 돌려줘도 아래 루프가 한 바퀴도 안 돌고 M1 이 통과한다. */
  assert.ok(files.length >= 20, `훑은 파일이 ${files.length}개뿐이다 — 소스 트리를 못 찾았다`);

  let onHits = 0;
  const midHits = [];
  for (const f of files) {
    const code = stripComments(readSrc(f));
    if (code.includes('gdt-grid-on')) onHits++;
    for (const tok of ['gdt-grid-mid', 'page-grid-mid']) {
      if (code.includes(tok)) midHits.push(`${toPosix(path.relative(ROOT, f))}: ${tok}`);
    }
  }
  /* ★입력이 살아 있다 ⑵ — 주석을 턴 «뒤»에도 진짜 코드가 남았나.
     stripComments 가 너무 세게 먹어 파일이 통째로 비면 midHits 는 «당연히» 0이 되고 M1 은 거짓 초록이 된다.
     살아 있는 형제 토큰(gdt-grid-on)이 여전히 잡히는지로 그걸 막는다. */
  assert.ok(onHits >= 2, `주석을 턴 뒤 gdt-grid-on 이 ${onHits}곳에서만 잡힌다 — 거르개가 코드까지 먹었다`);

  assert.deepStrictEqual(midHits, [],
    '중앙선이 되살아났다 — 이 기능은 2026-09-08 현빈 지시로 걷어냈다:\n  ' + midHits.join('\n  '));
});

test('M2 ★내보내기 그물은 «여전히 산다» — 중앙선을 빼면서 같이 약해지지 않았다', () => {
  const src = codeOnly(EXP);
  const i = src.indexOf('async function exportSection(');
  assert.ok(i > 0, 'exportSection 이 없다');
  const seg = src.slice(i, i + 700);
  assert.match(seg, /classList\.remove\('gdt-grid-on'\)/,
    '★내보내기 직전에 그리드를 끄는 코드가 없다 — 가이드가 내보낸 이미지에 찍힌다');
  assert.match(seg, /finally\s*\{[\s\S]*classList\.add\('gdt-grid-on'\)/,
    '되돌리기가 finally 에 없다 — 내보내기가 실패하면 가이드가 영영 꺼진 채로 남는다');
});

test('M2-변이 ★끄기를 없애면 M2 가 빨개진다', () => {
  const src = codeOnly(EXP);
  const mutated = src.replace(/classList\.remove\('gdt-grid-on'\)/, 'void 0');
  assert.notStrictEqual(mutated, src, '★변이가 주입되지 않았다 — M2-변이가 공회전 중이다');
  const seg = mutated.slice(mutated.indexOf('async function exportSection('), undefined).slice(0, 700);
  assert.doesNotMatch(seg, /classList\.remove\('gdt-grid-on'\)/,
    '변이가 안 먹었다 = M2 는 이 배선을 «안» 본다');
});

test('M3 ★저장값에 mid 를 «쓰지도 읽지도» 않는다', () => {
  const src = codeOnly(PAGE);

  /* ★입력이 살아 있다 — 저장 호출을 «진짜로» 찾았나. 못 찾으면 아래 판정이 통째로 공회전한다. */
  const save = src.match(/saveGridPref\(\{[^}]*\}\)/);
  assert.ok(save, 'saveGridPref 호출을 못 찾았다 — 그리드 배선이 사라졌나');
  assert.match(save[0], /\bon\b/, '저장값에 on 이 없다 — 찾은 게 그리드 저장 호출이 맞나');

  assert.doesNotMatch(save[0], /\bmid\b/,
    `★저장값에 mid 가 다시 들어갔다 — 죽은 값이다: ${save[0]}`);
  assert.doesNotMatch(src, /pref\s*\.\s*mid|\['mid'\]|\["mid"\]/,
    '★저장값의 mid 를 읽고 있다 — 중앙선은 걷어냈다');
  assert.doesNotMatch(src, /\bgridMid\b/, '★gridMid 참조가 남아 있다');
});

test('M4 ★이미 저장된 {mid:true} 를 만나도 안전한가 — «실제 소스»를 돌려서 잰다', () => {
  /* ⛔마이그레이션 코드를 새로 만들지 않았다(현빈 지시). 「그냥 안 읽으면 그만」이 맞는지를 «잰다».
     ⇒ prop-page.js 에서 read/save 두 문을 «글자 그대로» 떼어 내 가짜 localStorage 위에서 돌린다.
       (jsdom 이 없고 prop-page.js 는 통째로 못 불러온다 — 이 두 문은 DOM 을 안 쓴다.) */
  const src = codeOnly(PAGE);
  const key  = src.match(/const GRID_KEY = '([^']+)'/);
  const read = src.match(/const readGridPref = [\s\S]*?\n  \};/);
  const save = src.match(/const saveGridPref = [^\n]*\n/);
  /* ★입력이 살아 있다 — 세 문을 다 떼어 냈나. 하나라도 못 떼면 아래는 잰 게 없다. */
  assert.ok(key && read && save, '★readGridPref/saveGridPref/GRID_KEY 를 소스에서 못 떼어 냈다 — M4 는 아무것도 안 쟀다');

  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  // eslint-disable-next-line no-new-func
  const boot = new Function('localStorage', `${key[0]};\n${read[0]}\n${save[0]}\nreturn { readGridPref, saveGridPref, GRID_KEY };`);
  const { readGridPref, saveGridPref, GRID_KEY } = boot(localStorage);

  /* ⑴ 중앙선 시절의 저장값을 그대로 넣는다 */
  store.set(GRID_KEY, JSON.stringify({ on: true, mid: true, n: 12, g: 20 }));
  let pref;
  assert.doesNotThrow(() => { pref = readGridPref(); }, '★옛 저장값을 읽다가 던졌다');
  assert.strictEqual(pref.on, true, '살아 있는 키(on)를 못 읽었다');
  assert.strictEqual(pref.n, 12);
  assert.strictEqual(pref.g, 20);
  /* mid 는 «그냥 남아 있고 아무도 안 본다» — 던지지 않는 것이 요점이다(M3 가 «안 읽는다»를 잰다). */

  /* ⑵ 다음 refreshGrid 한 번이면 죽은 키가 «저절로» 사라진다 — 마이그레이션이 필요 없는 이유 */
  saveGridPref({ on: pref.on, n: pref.n, g: pref.g });
  const after = JSON.parse(store.get(GRID_KEY));
  assert.ok(!('mid' in after), `★저장을 한 번 지나도 mid 가 남는다: ${store.get(GRID_KEY)}`);

  /* ⑶ ★양성대조 — try/catch 가 «장식»이 아니라 진짜 도는가. 깨진 값에도 안 던지고 {} 로 간다. */
  store.set(GRID_KEY, '{이건 JSON 이 아니다');
  let broken;
  assert.doesNotThrow(() => { broken = readGridPref(); }, '★깨진 저장값에 던진다 — 패널이 통째로 안 열린다');
  assert.deepStrictEqual(broken, {}, '깨진 값은 «빈 설정»으로 가야 한다');
});
