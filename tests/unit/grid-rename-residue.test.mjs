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

/* ── 주석 제거기 ────────────────────────────────────────────────
 * ★단순 상태기계로는 «틀린다» — 이 레포는 중첩 템플릿 리터럴
 *   (`a${b ? `c` : ''}d`)과 따옴표를 품은 정규식(/['"]/)을 쓴다.
 *   둘 중 하나만 놓쳐도 상태가 어긋나 «주석이 코드로, 코드가 주석으로» 보인다.
 *   ⇒ 템플릿은 스택으로, 정규식은 «직전 유의미 토큰»으로 판정한다.
 *   이 함수 자체를 아래 «제거기 자기검사»가 지킨다.
 *
 * ⛔★2026-09-09 실측 결함 — 「템플릿 «안»인가」를 «맨 먼저» 물어야 한다.
 *   초판은 `/*` · `//` · 따옴표 분기가 템플릿 분기보다 «위»에 있었다. 그래서 템플릿 리터럴
 *   안의 평범한 글자가 코드로 읽혔다. 실측 세 갈래(전부 이 레포에 나올 수 있는 모양):
 *     `it's ${x}`        → 「'」 를 문자열 시작으로 읽어 그 뒤 주석이 «코드»가 됐다
 *     `https://a.com`    → 「//」 를 줄 주석으로 읽어 «줄 나머지를 통째로» 먹었다
 *     `a /* b *\/ c`      → 「/*」 를 블록 주석으로 읽었다
 *   ⇒ 첫째 갈래를 grid-block.js 의 새 거절 메시지가 실제로 밟아 S1 이 «주석 12줄»을
 *     코드로 신고했다. 검사가 «틀린 것»을 신고하면 진짜 잔존은 그 소음에 묻힌다.
 *   ★그리고 이건 자기검사 5건이 «전부 초록»인 채로 났다 — 셋 다 검사에 없던 모양이었다.
 *     「검사가 있다」 ≠ 「그 모양을 밟는다」. 그래서 셋을 아래에 «전부» 박았다. */
function stripComments(src) {
  const out = [];
  const stack = [];              // 템플릿 리터럴 중첩 깊이(`${` 안의 `)
  let i = 0, prev = '';          // prev = 직전 유의미 문자(정규식 판정용)
  const n = src.length;
  const keep = (c) => { out.push(c); if (!/\s/.test(c)) prev = c; };
  const blank = (c) => out.push(c === '\n' ? '\n' : ' ');
  while (i < n) {
    const c = src[i], c2 = src.slice(i, i + 2);
    /* ★★「템플릿 «안»인가」가 «맨 먼저» — 위 주석의 실측 결함. 여기가 아래로 내려가면
       템플릿 안의 `'` · `//` · `/*` 가 각각 문자열·주석으로 읽혀 상태가 통째로 어긋난다. */
    if (stack.length && stack[stack.length - 1] === '`') {
      // 템플릿 리터럴 «안» — `${` 를 만나면 코드 모드로 돌아간다(중첩 가능).
      if (c === '\\') { out.push('  '); i += 2; continue; }
      if (c2 === '${') { stack.push('${'); keep('$'); keep('{'); i += 2; continue; }
      if (c === '`') { stack.pop(); keep(c); i++; continue; }
      out.push(c === '\n' ? '\n' : c); i++; continue;
    }
    if (c2 === '/*') { i += 2; out.push('  '); while (i < n && src.slice(i, i + 2) !== '*/') blank(src[i++]); i += 2; out.push('  '); continue; }
    if (c2 === '//') { i += 2; out.push('  '); while (i < n && src[i] !== '\n') blank(src[i++]); continue; }
    if (c === '"' || c === "'") { keep(c); i++; while (i < n && src[i] !== c) { if (src[i] === '\\') { out.push('  '); i += 2; } else { out.push(src[i] === '\n' ? '\n' : src[i]); i++; } } keep(src[i] ?? ''); i++; continue; }
    if (c === '`') { stack.push('`'); keep(c); i++; continue; }
    if (c === '}' && stack[stack.length - 1] === '${') { stack.pop(); keep(c); i++; continue; }
    if (c === '/') {
      // 정규식 리터럴인가? 직전 유의미 문자가 «값의 끝»이면 나눗셈, 아니면 정규식.
      const isRegex = !/[A-Za-z0-9_$)\]]/.test(prev);
      if (isRegex) {
        keep(c); i++;
        let inClass = false;
        while (i < n) {
          const d = src[i];
          if (d === '\\') { out.push('  '); i += 2; continue; }
          if (d === '[') inClass = true;
          else if (d === ']') inClass = false;
          else if (d === '/' && !inClass) break;
          else if (d === '\n') break;             // 미종결 정규식 — 방어
          out.push(d); i++;
        }
        keep('/'); i++; continue;
      }
    }
    keep(c); i++;
  }
  return out.join('');
}

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
  // ⑷ 중첩 «라인» 그리드의 스키마 enum — 데이터 토큰이라 개명 대상 밖(PLAN §6-⑤).
  { file: 'js/blocks/grid-block.js', re: /^if \(line\.type === 'duo'\) \{$/ },
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
