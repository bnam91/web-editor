/* ═══════════════════════════════════════════════════════════════════
 * 잔존 토큰 SSOT — 2026-09-05 「duo → grid」 개명이 «반쪽»으로 남지 않게 지킨다.
 *
 * ★이 레포의 고질: 같은 판정이 여러 이름으로 흩어지고, 열거 자리 중 하나만 고쳐져
 *   절반만 개명된다(1abfea2 사고). 그걸 «기계»가 막는다.
 *
 * 규약: js/ · css/ · index.html 에서 «주석을 걷어낸 코드» 안의 /duo/i 는
 *       아래 ALLOW 목록에 «파일까지 일치»해야만 통과한다. 목록 밖 1건이면 빨강.
 *       ⛔ALLOW 를 늘려서 빨강을 끄지 마라 — 늘리려면 «왜 그 이름이 남아야 하는지»를 적어라.
 *
 * 선례 = grid-callsite-ssot.test.mjs.
 * ═══════════════════════════════════════════════════════════════════ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

/* ── 주석 제거기 — ★공용 부품을 ★쓴다(제 것을 ★안 만든다) ─────────────────
 * ★★2026-10-07 — 여기 있던 ★자기 제거기 ★45줄을 ★걷고 `_strip-comments.js` 로 갔다.
 *
 * ★왜 — ★그 자기 제거기가 ★이 파일 ★자신을 ★눈멀게 하고 있었다. ★행위로 쟀다:
 *   `js/blocks/grid-block.js` 를 걸러 ★«살아남은 주석 줄»을 세면
 *     ★자기 제거기 = ★100줄 (★첫 줄 3407) · ★공용 부품 = ★0줄
 *   ⇒ ★base(`64a06566`)에서 ★이미 ★멀어 있었다. S1 이 ★그때 초록이던 까닭은
 *     ★그 먼 구간에 `duo` 를 품은 주석이 ★아직 ★없었을 뿐이다(= ★「괜찮다」가 아니라 ★「안 봤다」).
 *   ⇒ 그리고 `gd/gridcol` 의 `4b0dbd4e` 가 ★그 구간에 ★주석 한 줄을 적자 S1 이 ★빨개졌다.
 *     ★그 주석은 ★제품 동작을 ★한 줄도 안 바꾼다 — ★빨강의 임자는 ★이 거르개였다.
 *
 * ★어긋난 자리 — ★한 줄로 적어 둔다(⛔다음 사람이 ★또 자기 것을 짓지 않게):
 *     return /^<div[^>]*\sclass="grd-line\s/.test(html)
 *   ★자기 제거기는 「정규식이냐 나눗셈이냐」를 ★«직전 유의미 글자»로만 갈랐고,
 *   그 글자가 `return` 의 ★`n`(영숫자)이라 ★나눗셈으로 읽었다. ⇒ 정규식 안의 `"` 가
 *   ★문자열을 열어 그 뒤 상태가 통째로 어긋났다. ★공용 부품은 `return` 을 ★키워드로 안다.
 *   ★양성대조(실측): ★그 한 줄만 괄호로 감싸니 살아남은 주석 줄 ★100 → ★0.
 *
 * ★★`templateAware: true` 로 켠다 — 이 레포는 ★여러 줄 템플릿 안에 ★주석을 쓴다
 *   (`js/props/prop-grid.js` 의 알약 주석이 ★그 꼴이고, ★name-axes X5 를 ★빨갛게 만든 자다).
 *   ⛔그 모드는 ★정규식을 안 파싱하므로 ★`templateBalanced()` 를 ★«전제»로 ★같이 건다(아래 S0).
 * ⛔여기에 ★다시 제거기를 ★만들지 마라 — `strip-comments-shared.test.js` S-6 이 그것을 막고,
 *   ★이 파일은 ★그 ★LEGACY 허용목록에서 ★빠졌다(같은 커밋).
 * ★★그래서 ★별칭 수입이다 — ⛔공용본을 감싸는 ★지역 상수를 ★`stripComments` 라는 ★이름으로
 *   ★선언하면 ★그 S-6 이 ★이 파일을 ★«자기 제거기를 만들었다»로 ★잡는다(그 자는 ★정의를 찾는다).
 *   ★★⚠️그 함정을 ★내가 ★한 번 밟았다(2026-10-07) — ★그 선언 꼴을 ★이 주석에 ★«예시»로 적었더니
 *     ★S-6 이 ★주석을 ★안 걷고 ★raw 로 읽어 ★이 파일을 ★잡았다. ⇒ ⛔금지 꼴을 ★«그대로» 적지 마라.
 *     (같은 병의 선례 = 소스 파싱 게이트의 입력에 ★주석이 들어가는 자리.)
 *   ⇒ `templateAware` 를 켠 이름은 ★정본이 ★`stripCommentsTA` 로 ★내준다. */
import { stripCommentsTA as stripComments, templateBalanced } from './_strip-comments.js';

/* ── 허용 목록 — «파일까지» 일치해야 한다 ── */
const ALLOW = [
  // ⑴ deprecated 전역 별칭 4개(grid-block.js). 러너·스킬 md·다른 맥 CDP 스크립트 호환. 제거는 P1.
  { file: 'js/blocks/grid-block.js', re: /^window\.(make|add|update|render)DuoBlock = (make|add|update|render)GridBlock;$/ },
  // ⑵ deprecated 패널 별칭(prop-grid.js). tools/duo-align-probe 등이 부른다. 제거는 P1.
  { file: 'js/props/prop-grid.js', re: /^window\.showDuoProperties = showGridProperties;$/ },
  // ⑶ 승격 상수 — 옛 이름이 «여기 한 곳»에만 산다.
  { file: 'js/blocks/grid-block.js', re: /^export const LEGACY_GRID_CLASS = 'duo-block';$/ },
  { file: 'js/blocks/grid-block.js', re: /^export const LEGACY_GRID_TYPE {2}= 'duo';$/ },
  { file: 'js/blocks/grid-block.js', re: /^export const GRID_ID_PREFIXES = \['grd_', 'duo_'\];$/ },
  /* ⑷ 중첩 «라인» 그리드의 스키마 enum — 데이터 토큰이라 개명 대상 밖(PLAN §6-⑤).
       ★2026-09-24 이사: 전엔 `if (line.type === 'duo') {` 이 그 «한 곳»이었다. 입구 계약(T-175 ⑶)이
         「이 중첩은 잘린다」를 말하려고 같은 판정을 한 번 더 하게 되면서, 리터럴을 둘로 늘리는 대신
         이름 있는 상수로 옮겼다. ⛔예외가 «는 것이 아니다» — 리터럴 수는 그대로 하나고, 이 규칙이
         가리키는 «자리»만 옮겼다(S1 의 「죽은 규칙 금지」가 그 이사를 확인해 준다). */
  { file: 'js/blocks/grid-block.js', re: /^const GRID_NESTED_LINE_TYPE = 'duo';$/ },
  // ⑸ 안전망 — 옛 정체성이 bindBlock 까지 닿았다면 «문을 놓쳤다»는 신호다(PLAN §3 안전망).
  { file: 'js/block-drag.js', re: /^if \(block\.classList\.contains\('duo-block'\)\) \{$/ },
  /* ⑹ ★읽기 표의 «옛 접두»(2026-09-07). MCP 가 «옛 프로젝트»의 그리드를 읽으려면 필요하다.
       ⛔개명은 «앞으로 만드는 것»에만 적용된다 — 이미 디스크에 `duo_` 로 저장된 블록은 그대로다.
         그 접두를 지우면 옛 프로젝트에서만 그리드가 «이름 없이» 나온다(새 프로젝트로 시험하면 안 드러난다).
       ⇒ 그래서 여기는 «제거 대상이 아니다» — 읽기는 옛것을 계속 알아봐야 한다.
         (같은 이유로 GRID_ID_PREFIXES 가 ⑶에서 이미 허용돼 있다 — 이건 그 «소비처»다) */
  { file: 'js/canvas-state.js', re: /^duo_: 'grid',$/ },
];

function targets() {
  return execFileSync('git', ['ls-files', 'js', 'css', 'index.html'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean);
}

/* ★S0 — ★이 검사의 ★«자기 전제». ⛔S1 의 「0건」을 믿기 전에 ★거르개가 ★제 일을 했나부터.
 *  `templateAware` 는 ★정규식 리터럴을 ★안 파싱한다 ⇒ 정규식 «안»의 백틱 하나가
 *  ★템플릿 보간을 ★열린 채 남기면 ★그 뒤 파일 전체가 ★«안 보인다» — 그러면 S1 은 ★조용히 초록이다.
 *  ⇒ ★훑는 파일 ★전수에 대해 ★균형을 ★단언한다. ★이게 ★빨개지면 S1 의 초록은 ★근거가 없다. */
test('S0 ★전제 — 거르개가 훑는 파일 전수에서 템플릿 보간이 «닫힌다»(안 그러면 S1 은 안 본 것이다)', () => {
  const files = targets();
  assert.ok(files.length > 50,
    `★훑을 파일이 ${files.length}개뿐이다 — 이 검사가 «안 돈» 것이지 통과가 아니다`);
  const unbalanced = files.filter(f => !templateBalanced(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  assert.deepEqual(unbalanced, [],
    `★템플릿 보간이 «열린 채» 끝난 파일 ${unbalanced.length}건 — 그 파일의 ★그 뒤 줄은 ` +
    'S1 에게 ★안 보인다(초록이 「괜찮다」가 아니라 「안 봤다」가 된다). ' +
    '⛔ALLOW 를 늘려 끄지 마라 — tests/unit/_strip-comments.js 의 _skipRegexAt 를 고쳐라:\n  ' +
    unbalanced.join('\n  '));
});

/* ★양성대조 — 위 S0 의 자가 ★«불균형을 잡기는» 하는가. ⛔「0건」이 ★자가 죽어서 0 이면 안 된다. */
test('S0 ★양성대조 — 일부러 열어 둔 보간을 templateBalanced 가 거짓으로 읽는다', () => {
  assert.equal(templateBalanced('const s = `ok`;'), true, '★정상 소스를 거짓으로 읽는다 — 자가 너무 좁다');
  assert.equal(templateBalanced('const s = `open'), false, '★열어 둔 템플릿을 참으로 읽는다 — 자가 죽었다');
  assert.equal(templateBalanced('const s = `a${ (1'), false, '★열어 둔 보간을 참으로 읽는다 — 자가 죽었다');
});

/* ★★양성대조 — ★공용 부품이 ★진짜로 ★이 파일의 눈을 ★뜨게 했나.
 *  ⛔「초록이니 됐다」로 안 닫는다: ★옛 지역 제거기의 ★결함 꼴을 ★여기서 ★재현해
 *  ★그 꼴에서는 ★주석이 ★안 걷히고 ★공용 부품에서는 ★걷힌다를 ★나란히 센다.
 *  ★이 둘이 ★같아지는 날 = ★누가 공용 부품을 ★옛 꼴로 되돌린 날이다. */
test('S0 ★양성대조 — 옛 지역 제거기를 빨갛게 만들던 두 꼴이 공용 부품에서는 걷힌다', () => {
  /* ㉠ `return` 뒤 정규식 + 그 안의 따옴표 — ★S1 을 100줄 눈멀게 한 꼴(grid-block.js:3403) */
  const shapeA = 'function f(h) {\n  return /^<div[^>]*\\sclass="x\\s/.test(h);\n}\n/* duo */';
  assert.equal(/duo/i.test(stripComments(shapeA)), false,
    '★`return` 뒤 정규식을 ★나눗셈으로 읽어 그 뒤 주석이 ★코드가 됐다 — 옛 결함이 돌아왔다');
  /* ㉡ 여러 줄 템플릿 «보간 안»의 블록 주석 — ★name-axes X5 를 빨갛게 만든 꼴(prop-grid.js:3114) */
  const shapeB = 'const h = `<a>\n  </a>` + `${/* duo\n   still comment */ \'\'}`;';
  assert.equal(/duo/i.test(stripComments(shapeB)), false,
    '★여러 줄 템플릿 보간 안의 블록 주석이 ★안 걷혔다 — templateAware 가 꺼졌거나 깨졌다');
});

test('S1 ★개명 잔존 0 — js/css/index.html 의 코드(주석 제외)에 남은 duo 는 허용 목록뿐이다', () => {
  const stray = [];
  for (const f of targets()) {
    const lines = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8')).split('\n');
    lines.forEach((raw, idx) => {
      if (!/duo/i.test(raw)) return;
      const line = raw.trim();
      if (ALLOW.some(a => a.file === f && a.re.test(line))) return;
      stray.push(`${f}:${idx + 1}: ${line}`);
    });
  }
  assert.deepEqual(stray, [], '★목록 밖 duo 잔존 — 개명이 반쪽이거나 허용 목록이 낡았다:\n' + stray.join('\n'));
});

test('S1 ★허용 목록이 «살아 있다» — 7개 항목이 전부 실제로 한 번씩 걸린다(죽은 규칙 금지)', () => {
  const hit = new Map(ALLOW.map((_, i) => [i, 0]));
  for (const f of targets()) {
    const lines = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8')).split('\n');
    for (const raw of lines) {
      const line = raw.trim();
      if (!/duo/i.test(line)) continue;
      ALLOW.forEach((a, i) => { if (a.file === f && a.re.test(line)) hit.set(i, hit.get(i) + 1); });
    }
  }
  const dead = [...hit.entries()].filter(([, c]) => c === 0).map(([i]) => `ALLOW[${i}] ${ALLOW[i].file} ${ALLOW[i].re}`);
  assert.deepEqual(dead, [], '★한 번도 안 걸리는 허용 규칙 — 지웠어야 할 예외가 남았다:\n' + dead.join('\n'));
  assert.equal(hit.get(0), 4, 'deprecated 전역 별칭은 «4개» 여야 한다(make/add/update/render)');
});

test('S1 ★새 이름이 «갈라지지» 않았다 — duo-block 토큰 0 · grid-block 토큰이 옛 개수를 보존한다', () => {
  let dq = 0, gq = 0;
  for (const f of targets()) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    dq += (src.match(/duo-block/g) || []).length;
    gq += (src.match(/grid-block/g) || []).length;
  }
  // duo-block 잔존 = 승격 상수 1 + 안전망 1 + grid-block.js 주석 2 (개명 전 이름을 «설명»하는 문장)
  assert.ok(dq <= 4, `duo-block 토큰이 너무 많다(${dq}) — 어느 선택자 목록이 안 고쳐졌다`);
  // 개명 «전» js 71 + css 14 + index.html 1 = 86. 새 코드(승격 함수·안전망·테스트 훅)가 더해진다.
  assert.ok(gq >= 86, `grid-block 토큰 ${gq} < 86 — 열거 자리가 «반쪽»으로 개명됐다(어느 파일인지 찍어라)`);
});

/* ── 제거기 자기검사 — 「테스트 이름이 지키겠다는 것을 본문이 지키는가」 ──
 * ★이 5건이 없으면 S1 은 «조용히 아무것도 안 재는» 테스트가 될 수 있다. */
test('S1 제거기 자기검사 — 주석/문자열/중첩템플릿/정규식을 «틀리지 않게» 가른다', () => {
  const has = (s) => /duo/i.test(stripComments(s));
  assert.equal(has('// duo'), false, '줄 주석은 걷힌다');
  assert.equal(has('/* duo */'), false, '블록 주석은 걷힌다');
  assert.equal(has("const x = 'duo';"), true, '문자열 안의 값은 «코드»다');
  // ★중첩 템플릿 — 안쪽 백틱을 바깥의 «닫기»로 오인하면 그 뒤 주석이 코드로 보인다.
  assert.equal(has('const s = `a${b ? `c` : ""}d`;\n// duo'), false, '중첩 템플릿 뒤의 주석도 걷힌다');
  // ★따옴표를 품은 정규식 — 문자열 시작으로 오인하면 그 뒤가 통째로 문자열이 된다.
  assert.equal(has('const r = /[\'"]/;\n// duo'), false, '정규식 뒤의 주석도 걷힌다');
  assert.equal(has('const r = /a\\/duo/;'), true, '정규식 «안»의 토큰은 코드다');
  assert.equal(stripComments('a\n// x\nb').split('\n').length, 3, '줄 수가 보존된다(줄번호 신뢰성)');

  /* ★★2026-09-09 실측 결함 세 갈래 — 「템플릿 «안»인가」를 맨 먼저 안 물어서 났다.
     ⛔셋 다 자기검사 5건이 «전부 초록»인 채로 실물에서 터졌다. 「검사가 있다」 ≠ 「그 모양을 밟는다」. */
  assert.equal(has("const m = `it's ${x} here`;\n// duo"), false,
    "★템플릿 안의 따옴표를 «문자열 시작»으로 읽었다 — 그 뒤 주석이 통째로 코드가 된다");
  assert.equal(has('const u = `https://a.com/x`;\nconst duo = 1;'), true,
    '★템플릿 안의 「//」 를 줄 주석으로 읽어 «줄 나머지»를 먹었다(그 줄의 코드가 사라진다)');
  assert.equal(has('const s = `a /* b */ duo c`;'), true,
    '★템플릿 안의 「/*」 를 블록 주석으로 읽었다 — 템플릿 «내용»은 코드다');
  /* 음성대조 — 넓히다 반대로 새지 않았나. 템플릿 «밖»은 여전히 옛 규칙 그대로다. */
  assert.equal(has('const s = `a`;\n// duo'), false, '템플릿이 «닫힌 뒤»의 주석은 그대로 걷힌다');
  assert.equal(has('const s = `a${/* duo */ 1}b`;'), false, '`${}` «안»은 코드 모드라 주석이 걷힌다');
});

/* ★적대검수 C1 — 로드 폴백 id 접두가 «다른 자리와 같은 토큰»인가.
 * `js/io/save-load.js` 의 「id 없는 블록」 폴백이 `'grid'` 로 적혀 있었다. 나머지(GRID_ID_PREFIXES ·
 * 문서 · 플랜)는 전부 `'grd'` 다. 갈라지면 그 블록만 `grid_…` 가 되어 접두로 타입을 보는 코드가 못 알아본다.
 * ⚠️이 자리는 테스트가 «0건» 이었다 — 검수자가 `'zzz'` 로 바꿔도 466/466 초록임을 실측했다.
 *   동작 테스트로는 이 폴백까지 가지 못하므로 «소스 문자열»로 잠근다(주석은 걷고 센다). */
test('★로드 폴백 id 접두는 GRID_ID_PREFIXES 와 같은 토큰이다 (C1)', () => {
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const sl = strip(fs.readFileSync(path.join(ROOT, 'js/io/save-load.js'), 'utf8'));
  const m = sl.match(/classList\.contains\('grid-block'\)\s*\?\s*'([a-z_]+)'/);
  assert.ok(m, 'save-load.js 에서 grid-block 폴백 접두를 못 찾았다 — 리팩터링됐나? 패턴을 갱신하라');

  const gb = strip(fs.readFileSync(path.join(ROOT, 'js/blocks/grid-block.js'), 'utf8'));
  const p = gb.match(/GRID_ID_PREFIXES\s*=\s*\[\s*'([a-z]+)_'/);
  assert.ok(p, 'GRID_ID_PREFIXES 를 못 찾았다 — 패턴을 갱신하라');

  assert.equal(m[1], p[1],
    `폴백은 '${m[1]}_' 인데 GRID_ID_PREFIXES[0] 는 '${p[1]}_' 다 — 두 자리가 갈라졌다`);
});
