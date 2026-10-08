/* inspector-t17.test.mjs — ★T17 인스펙터 「이미지」·「텍스트」 줄도 ★순차 이동 (현빈 2026-10-07)
 *
 * 현빈 원문: 「★인스펙터에 ★갭은 선택하면 캔버스에서 ★해당하는 블럭으로 ★순차 이동이 되는데
 *              ★★이미지는 ★안되네? ★되게 해줘.」
 * ★「텍스트」도 같이 = ★★지디가 넓힌 범위다 — ⛔현빈은 ★이미지만 말했다.
 *
 * ★처방은 ★«새로 만든 것»이 아니다 — 그 둘만 ★손으로 쓴 줄이어서 점프가 빠져 있었다.
 *   ⇒ ★있는 `statRow` 를 ★부른다. 그 함수가 ★「★셀 것 = 갈 곳」을 ★구조로 보장한다.
 *   ⇒ ⛔손으로 `insp-jump`·`data-jump`·`_jumpTargets` 를 적는 길은 ★그 보장을 깨는 ★유일한 길이다.
 *
 * ★지디 판정 ㉡(2026-10-07): ★`always` 를 ★«옵션»으로 더한다. ⛔기본 동작은 안 바꾼다.
 *   까닭 — ★머리 통계 ★넷(섹션·전체 블록·텍스트·이미지)이 ★한 묶음인데 ★둘만 0 에서 사라지면
 *          ★그 묶음의 ★꼴이 ★갈린다. 현빈이 본 것은 ★「이미지는 안 되네?」이고
 *          ★«줄이 사라지는 것»을 ★원한 게 ★아니다.
 *
 * ⚠️`statRow` 는 ★모듈 내부 함수라 ★export 가 아니다 ⇒ ★여기선 ★소스를 ★읽어 잰다.
 *   ★행위(점프가 실제로 순차로 도나 · 머리 넷의 꼴)는 ★tests/dom/inspector-t17.dom.spec.js 가 잰다.
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const { stripComments } = require('./_strip-comments.js');

const ROOT = path.join(import.meta.dirname, '..', '..');
const RAW = readSrc(ROOT, 'js', 'inspector.js');
const SRC = stripComments(RAW);

/** `{ … }` 균형으로 덩이를 뜬다 — ⛔고정 창(slice) 금지. */
function balanced(src, from, label) {
  const b = src.indexOf('{', from);
  assert.ok(b > 0, `${label}: 여는 중괄호가 없다`);
  let d = 0;
  for (let j = b; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (d === 0) return src.slice(b, j + 1); }
  }
  assert.fail(`${label}: 중괄호가 안 닫힌다`);
}

/** ★화살표 함수의 «몸통»을 뜬다 — ⚠️매개변수 괄호를 ★먼저 닫는다.
 *  ★까닭(2026-10-07 내가 밟았다): `(key, label, list, { always = false } = {})` 의
 *    ★«기본값 중괄호»를 ★몸통으로 오인해 엉뚱한 덩이를 떴고 ★「분기를 못 찾았다」로 빨개졌다.
 *  ★그 함정은 ★이 레포가 ★이미 적어 뒀다 — tests/unit/pad-hint.test.js 의 bodyOf/arrowBodyOf
 *    「★매개변수 괄호를 «먼저» 닫고, 그 뒤의 첫 { 부터 균형을 센다」.
 *  ⇒ ★★해법이 문서에 있어도 ★안 읽히면 ★없는 것과 같다. ★그래서 여기 ★같은 꼴로 적어 둔다. */
function arrowBody(src, needle, label) {
  const at = src.indexOf(needle);
  assert.ok(at >= 0, `${label}: 시작점 «${needle}» 을 못 찾았다`);
  let i = src.indexOf('(', at);
  assert.ok(i > at, `${label}: 매개변수 괄호가 없다`);
  let d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')') { d--; if (d === 0) { i++; break; } }
  }
  assert.strictEqual(d, 0, `${label}: 매개변수 괄호가 안 닫힌다`);
  const a = src.indexOf('=>', i);
  assert.ok(a >= i && a - i < 8, `${label}: 괄호 바로 뒤에 => 가 없다(거리 ${a - i})`);
  return balanced(src, a, label);
}

/** ★호출 하나의 «인자 문자열» — ⚠️괄호 ★균형으로 뜬다.
 *  ★까닭: `statRow('k','l',x,{ always: true })` 를 ★`[^;]*?\)` 로 뜨면 ★중첩 괄호에서 ★끊긴다
 *    (실측: 내 호출 ★2자리가 ★1 로 세어졌다). */
function callArgs(src, idx) {
  let i = src.indexOf('(', idx);
  if (i < 0) return null;
  const start = i + 1;
  let d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')') { d--; if (d === 0) return src.slice(start, i); }
  }
  return null;
}

/* ─────────────────────────────────────────────
   T0 ★입력이 살아 있다 — 아래가 «무언가를 실제로 보고 있나»
   ⇐ 되돌리면 빨강: 거르개가 소스를 먹거나 경로가 바뀌면 여기서 «먼저» 터진다.
   ───────────────────────────────────────────── */
test('T0 ★입력이 살아 있다 — 소스·거르개·형제 토큰', () => {
  assert.ok(SRC.trim().length > 2000, `inspector.js 가 주석을 턴 뒤 ${SRC.trim().length}자 — 거르개가 코드를 먹었다`);
  /* ★살아 있는 «형제» 토큰 — T17 과 무관하게 존재한다. 0 이면 거르개가 코드를 삼킨 것이다. */
  assert.ok((SRC.match(/jumpToElement/g) || []).length >= 2,
    '★형제 토큰 jumpToElement 가 2곳 미만 — 거르개가 코드를 먹었다');
  /* ★거르개가 «주석만» 턴다 — 양성대조(주석 속 이름이 안 세어진다) */
  const probe = 'const a=1;\n/* statRow(기만) */\n// statRow(또기만)\nconst b=statRow(2);\n';
  assert.strictEqual((stripComments(probe).match(/statRow\(/g) || []).length, 1,
    '★거르개가 주석 속 이름을 남겼다 — 아래 «호출 수» 단언이 주석에 따라 흔들린다');
});

/* ─────────────────────────────────────────────
   T1 ★`always` 는 «옵션»이다 — ⛔기본 동작을 안 바꿨다
   ⇐ 되돌리면 빨강: 기본값을 true 로 바꾸거나, 기존 소비자에 always 를 붙이면 터진다.
   ───────────────────────────────────────────── */
test('T1 ★always 는 «옵션» · ⛔기존 소비자 ★전원이 기본값을 쓴다', () => {
  const sig = SRC.match(/const statRow = \(key, label, list,\s*\{\s*always\s*=\s*(\w+)\s*\}\s*=\s*\{\}\s*\)\s*=>/);
  assert.ok(sig, '★statRow 서명에 { always = … } 가 없다 — 옵션이 아니라 다른 꼴로 들어갔나');
  assert.strictEqual(sig[1], 'false',
    `★always 의 기본값이 ${sig[1]} 다 — ⛔기본이 true 면 기존 소비자 전원의 동작이 바뀐다`);

  /* ★★기존 소비자가 ★«현재 꼴»(0 이면 사라진다)을 ★유지하나 — ★그들 중 always 를 쓰는 자가 ★0 이어야 한다.
     ★N 의 출처: js/inspector.js 의 statRow 호출 중 ★내 둘(textBlocks·assetBlocks)을 뺀 나머지.
     ⚠️`.map(([k]) => statRow('v:' + k, …))` 는 ★루프 호출이라 ★실행 횟수는 variant 수만큼이다
       ⇒ 여기서 세는 것은 ★«호출 자리»다. 그래서 ★≥ 로 적는다. */
  const calls = [];
  for (let k = SRC.indexOf('statRow('); k >= 0; k = SRC.indexOf('statRow(', k + 1)) {
    if (/const statRow\s*=\s*$/.test(SRC.slice(Math.max(0, k - 24), k))) continue;  // 정의는 뺀다
    const a = callArgs(SRC, k);
    if (a !== null) calls.push(a);
  }
  const mine = calls.filter(c => /'(textBlocks|assetBlocks)'/.test(c));
  const others = calls.filter(c => !/'(textBlocks|assetBlocks)'/.test(c));
  assert.strictEqual(mine.length, 2, `★내 호출이 ${mine.length}자리 — textBlocks·assetBlocks 둘이어야 한다`);
  assert.ok(others.length >= 9,
    `★기존 호출 자리가 ${others.length} — ≥9 여야 한다(Gap·Icon·Table·Graph·Divider·Tags·Icon Text·Step·Card·Shape·Logo ＋ variant 루프)`);
  const leaked = others.filter(c => /always/.test(c));
  assert.deepStrictEqual(leaked, [],
    `★기존 소비자 ${leaked.length}자리에 always 가 번졌다 — 그들의 「0 이면 사라진다」가 깨진다: ${JSON.stringify(leaked.slice(0, 2))}`);

  /* ★그 «현재 꼴»이 코드에 남아 있나 — always 가 아니면 빈 문자열 */
  const body = arrowBody(SRC, 'const statRow =', 'T1');
  assert.match(body, /if\s*\(!always\)\s*return\s*'';/,
    '★!always 일 때 빈 문자열을 돌려주는 줄이 없다 — 기존 소비자가 0 에서도 줄을 남기게 된다');
});

/* ─────────────────────────────────────────────
   T2 ★always 갈래엔 ⛔점프가 «안» 붙는다 — 갈 곳 0 인데 손 모양이 뜨면 거짓 약속이다
   ⇐ 되돌리면 빨강: always 갈래에 insp-jump 나 data-jump 를 넣으면 터진다.
   ───────────────────────────────────────────── */
test('T2 ★always 갈래에 insp-jump·data-jump·_jumpTargets 가 ⛔없다', () => {
  const body = arrowBody(SRC, 'const statRow =', 'T2');
  const at = body.indexOf('if (!always)');
  assert.ok(at > 0, '★!always 분기를 못 찾았다');
  /* 그 분기 «블록»을 뜬다 — `if (!list.length) { … }` 안쪽이다. */
  const zeroBlock = balanced(body, body.indexOf('if (!list.length)'), 'T2');
  assert.ok(zeroBlock.includes('if (!always)'), '★0 분기 안에 !always 가 없다 — 엉뚱한 덩이를 떴다');

  for (const tok of ['insp-jump', 'data-jump', '_jumpTargets']) {
    assert.ok(!zeroBlock.includes(tok),
      `★0 갈래에 ${tok} 가 있다 — 갈 곳이 0 인데 점프를 약속한다`);
  }
  /* ★음성대조 — «0 이 아닌» 갈래엔 그 셋이 ★있어야 한다(자가 산다는 증인) */
  const after = body.slice(body.indexOf(zeroBlock) + zeroBlock.length);
  for (const tok of ['insp-jump', 'data-jump', '_jumpTargets']) {
    assert.ok(after.includes(tok),
      `★정상 갈래에 ${tok} 가 없다 — 이 검사의 음성대조가 죽었다(위 0건이 뜻을 잃는다)`);
  }
  /* ★0 갈래도 «줄은» 남긴다 — 그게 ㉡ 의 본체다 */
  assert.match(zeroBlock, /class="insp-stat-row"/,
    '★0 갈래가 줄을 안 남긴다 — ㉡(머리 넷의 꼴 유지)이 안 섰다');
});

/* ─────────────────────────────────────────────
   T3 ★「텍스트」·「이미지」가 ★statRow 를 쓴다 — ⛔손으로 쓴 줄이 아니다
   ⇐ 되돌리면 빨강: 둘 중 하나를 손으로 쓴 <div class="insp-stat-row"> 로 되돌리면 터진다.
   ───────────────────────────────────────────── */
test('T3 ★두 줄이 statRow 를 쓰고 always:true 다 · ⛔손으로 쓴 꼴이 안 남았다', () => {
  for (const [key, label] of [['textBlocks', '텍스트'], ['assetBlocks', '이미지']]) {
    const re = new RegExp(`statRow\\('${key}', '${label}', \\w+, \\{ always: true \\}\\)`);
    assert.match(SRC, re, `★${label} 줄이 statRow('${key}', …, { always: true }) 꼴이 아니다`);
  }
  /* ⛔손으로 쓴 옛 꼴이 ★안 남았나 — 그 둘의 라벨이 ★하드코딩 div 안에 있으면 빨강 */
  for (const label of ['텍스트', '이미지']) {
    const re = new RegExp(`<div class="insp-stat-row">\\s*<span class="insp-stat-label">${label}</span>`);
    assert.doesNotMatch(SRC, re,
      `★${label} 의 ★손으로 쓴 줄이 남아 있다 — 「셀 것 = 갈 곳」 보장 밖이다`);
  }
  /* ★음성대조 — 머리 넷 중 ★나머지 둘은 ★그대로 손으로 쓴 꼴이다(⛔범위를 안 넘었다) */
  for (const label of ['섹션', '전체 블록']) {
    const re = new RegExp(`<div class="insp-stat-row">\\s*<span class="insp-stat-label">${label}</span>`);
    assert.match(SRC, re,
      `★${label} 줄까지 바꿨다 — 현빈·지디가 말한 범위는 「텍스트·이미지」 둘이다`);
  }
});

/* ─────────────────────────────────────────────
   T4 ★key 가 겹치지 않는다 — 겹치면 _jumpTargets 가 서로를 덮는다
   ⇐ 되돌리면 빨강: 내 key 를 기존 것과 같게 하면 터진다.
   ───────────────────────────────────────────── */
test('T4 ★점프 key 가 ★전부 다르다 (⛔겹치면 _jumpTargets 가 덮인다)', () => {
  const keys = [...SRC.matchAll(/statRow\('([^']+)'/g)].map(m => m[1]);
  assert.ok(keys.length >= 11, `★key 를 ${keys.length}개 떴다 — ≥11 이어야 한다(출처: statRow 호출 자리)`);
  assert.ok(keys.includes('textBlocks') && keys.includes('assetBlocks'),
    `★내 key 둘이 목록에 없다 — 떴는 것: ${JSON.stringify(keys)}`);
  assert.strictEqual(new Set(keys).size, keys.length,
    `★key 가 겹친다 — ${JSON.stringify(keys.filter((k, i) => keys.indexOf(k) !== i))}`);
});

/* ─────────────────────────────────────────────
   T5 ★★템플릿 리터럴 «안»의 HTML 주석에 ⛔백틱이 없다
   ★왜 — 2026-10-07 실측: 내가 그 주석에 `statRow` 라 적었더니 ★백틱이 리터럴을 ★닫아
     ★SyntaxError 가 났다(제품 로직 0줄인데 파일이 안 돌았다).
   ⇒ 「★주석은 ★소스의 ★입력이다」의 ★문법 판이다. ★규약엔 ★재는 자가 있어야 집행된다.
   ⇐ 되돌리면 빨강: 어느 HTML 주석에든 백틱을 하나 넣으면 터진다.
   ───────────────────────────────────────────── */
test('T5 ★HTML 주석에 ⛔백틱 0건 — ★js/ ★전수 (★템플릿 리터럴을 닫는다)', () => {
  /* ★★2026-10-07 — ★범위를 ★«레포 전체»로 넓혔다. ⛔한 파일(js/inspector.js)만 잠갔더니
     ★★같은 사고가 ★js/effects-reflect.js 에서 ★또 났다(★내가 ★같은 턴에 ★두 번 밟았다).
     ⇒ ★★「★규율은 ★재는 자가 있어야 집행된다」 ＋ ★「내가 세운 규칙의 ★첫 시험에서 ★내가 예외면
       ★규칙이 죽는다」 ⇒ ★자를 ★좁게 두면 ★그 밖에서 ★또 난다. */
  const fs = require('node:fs');
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(f); }
      else if (/\.(js|mjs|cjs)$/.test(e.name)) files.push(f);
    }
  };
  walk(path.join(ROOT, 'js'));
  /* ★입력이 살아 있다 — 파일을 «실제로» 찾았나. 0 이면 아래가 통째로 공회전이다. */
  assert.ok(files.length > 50, `★js/ 에서 ${files.length}개를 찾았다 — 50 이상이어야 한다(아래가 공회전)`);

  let commentCount = 0;
  const bad = [];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/<!--[\s\S]*?-->/g)) {
      commentCount++;
      if (m[0].includes('`')) bad.push([path.relative(ROOT, f), m[0].slice(0, 44)]);
    }
  }
  /* ★입력이 살아 있다 ⑵ — HTML 주석을 «실제로» 찾았나. */
  assert.ok(commentCount >= 1, `★js/ 전체에서 HTML 주석을 ${commentCount}개 찾았다 — 1 이상이어야 한다`);
  assert.deepStrictEqual(bad, [],
    `★HTML 주석 ${bad.length}곳이 백틱을 품었다 — ★템플릿 리터럴 안이면 ★SyntaxError 다: ${JSON.stringify(bad.slice(0, 3))}`);

  /* ★★음성대조 — 이 자가 «산다». 백틱을 품은 주석을 만들어 먹이면 ★잡아야 한다. */
  const probe = 'const x = `<div>\n  <!-- `tick` -->\n</div>`;';
  const probeBad = [...probe.matchAll(/<!--[\s\S]*?-->/g)].filter(m => m[0].includes('`'));
  assert.strictEqual(probeBad.length, 1,
    '★음성대조 실패 — 백틱 든 주석을 만들어도 안 잡힌다(이 검사의 자가 죽었다)');
});



/* ⇐ 되돌리면 빨강: statRow 의 서명을 또 바꿔 ★불변식 자(variant-ship-leak)의 닻이 못 찾히면 터진다.
   ★왜 이 칸이 있나 — ★2026-10-07 실측: ★내가 매개변수 하나를 더하자
     `tests/unit/variant-ship-leak.test.mjs` 의 `sliceBlock(src, 'const statRow = (key, label, list) =>')`
     ★닻이 ★못 찾히고 ★`stat` 판정이 ★false 로 떨어졌다 ⇒ ★★「개수 = 갈 곳」을 재던 자가 ★조용히 ★눈이 멀었다.
     ⚠️★그때 ★내 unit·DOM 은 ★전부 초록이었다 — ★★그 검사 ★하나만 그걸 잡았다.
   ⇒ ★★「합친 것을 재라」의 짝이다: ★내가 그 자리를 건드렸으니 ★★그 자가 ★여전히 ★보는지 ★내가 잰다.
   ⛔그 검사 쪽 닻을 ★«서명째» 다시 적지 마라 — ★매개변수가 늘면 ★또 눈이 먼다. */
test('T6 ★statRow 의 ★불변식 자(variant-ship-leak)가 ★내 서명을 ★여전히 본다', () => {
  const guard = readSrc(ROOT, 'tests', 'unit', 'variant-ship-leak.test.mjs');
  /* ★그 검사가 쓰는 ★닻 문자열을 ★그 소스에서 ★뽑는다 — ⛔여기에 손으로 베끼지 않는다
     (베끼면 ★둘째 명부가 되고, 그쪽이 바뀌어도 ★여기는 모른다). */
  const m = guard.match(/sliceBlock\(src,\s*'([^']*statRow[^']*)'/);
  assert.ok(m, '★variant-ship-leak 이 statRow 를 더 이상 닻으로 쓰지 않는다 — 이 칸의 전제가 바뀌었다');
  const anchor = m[1];

  /* ★★본 단언 — 그 닻이 ★내 소스에서 ★정확히 1건 잡힌다 */
  const hits = RAW.split(anchor).length - 1;
  assert.strictEqual(hits, 1,
    `★그 검사의 닻 «${anchor}» 이 내 js/inspector.js 에서 ${hits}건 잡힌다 — ` +
    '0 이면 그 검사가 ★눈이 멀고(조용히 초록), 2+ 면 엉뚱한 덩이를 뜬다');

  /* ★음성대조 — 이 자가 «산다». 있을 수 없는 닻은 ★0건이어야 한다. */
  const fake = anchor + '__없는것__';
  assert.strictEqual(RAW.split(fake).length - 1, 0,
    '★음성대조 실패 — 없는 닻도 잡힌다(이 검사의 자가 죽었다)');

  /* ★그 닻이 ★«서명을 품지 않는지» — 품으면 매개변수가 늘 때 또 눈이 먼다 */
  assert.doesNotMatch(anchor, /key, label, list\s*\)/,
    `★그 검사의 닻이 ★매개변수 목록을 품었다(«${anchor}») — 매개변수가 늘면 ★또 눈이 먼다`);
});
