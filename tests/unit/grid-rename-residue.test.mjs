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
 *   이 함수 자체를 아래 «제거기 자기검사» 5건이 지킨다. */
function stripComments(src) {
  const out = [];
  const stack = [];              // 템플릿 리터럴 중첩 깊이(`${` 안의 `)
  let i = 0, prev = '';          // prev = 직전 유의미 문자(정규식 판정용)
  const n = src.length;
  const keep = (c) => { out.push(c); if (!/\s/.test(c)) prev = c; };
  const blank = (c) => out.push(c === '\n' ? '\n' : ' ');
  while (i < n) {
    const c = src[i], c2 = src.slice(i, i + 2);
    if (c2 === '/*') { i += 2; out.push('  '); while (i < n && src.slice(i, i + 2) !== '*/') blank(src[i++]); i += 2; out.push('  '); continue; }
    if (c2 === '//') { i += 2; out.push('  '); while (i < n && src[i] !== '\n') blank(src[i++]); continue; }
    if (c === '"' || c === "'") { keep(c); i++; while (i < n && src[i] !== c) { if (src[i] === '\\') { out.push('  '); i += 2; } else { out.push(src[i] === '\n' ? '\n' : src[i]); i++; } } keep(src[i] ?? ''); i++; continue; }
    if (c === '`') { stack.push('`'); keep(c); i++; continue; }
    if (stack.length && stack[stack.length - 1] === '`') {
      // 템플릿 리터럴 «안» — `${` 를 만나면 코드 모드로 돌아간다(중첩 가능).
      if (c === '\\') { out.push('  '); i += 2; continue; }
      if (c2 === '${') { stack.push('${'); keep('$'); keep('{'); i += 2; continue; }
      if (c === '`') { stack.pop(); keep(c); i++; continue; }
      out.push(c === '\n' ? '\n' : c); i++; continue;
    }
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
});
