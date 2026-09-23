#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   assert-strength — 검사의 «단언»이 «제자리에서» 약해지는 것을 잡는 자 (T-177)

   ══ 왜 있나 ═══════════════════════════════════════════════════════════════
   이 레포엔 검사가 «지워지는» 것을 잡는 자가 이미 있다:
     · tools/mutation-sweep.js  — 제품 가드를 지웠을 때 «죽는 검사의 수»를 센다.
     · tests/unit/*-roster.test.* — 입구 명부가 썩으면 그날 빨강이 된다.
     · 골든 바이트 대조         — 산출이 달라지면 빨강이 된다.
   셋 다 「지워졌다·썩었다·산출이 달라졌다」는 잡는데, **단언이 제자리에서 약해진 것**은
   «셋 다 초록으로» 통과한다. 그러면 검사는 계속 초록인데 «재는 것»이 줄어든다.

   ★2026-09-23 그 축이 실제로 났다 — 설명 주석이 남의 «변이 닻»을 가로채, 재는 대상이
     「렌더러가 새 필드를 읽는가」에서 「주석에 그 글자가 있는가」로 조용히 느슨해졌다.
     앞뒤로 검사는 계속 초록이었고, 잡은 것은 구현자의 자기 감사뿐이었다(커밋 4b0e6a1).
     ⇒ 사람의 자기 감사에 기대면 다음엔 놓친다. 그래서 이 자가 있다.

   ══ 「느슨해짐」의 정의 (이 자가 재는 것) ═══════════════════════════════════
   검사 하나를 «이름»(파일 + describe 사슬 + test 제목)으로 집고, 그 안에서 다섯을 센다.
     ⑴ n       단언 호출 수                      — 줄면 느슨
     ⑵ w       단언 «세기»의 합(아래 사다리)      — 줄면 느슨
     ⑶ guarded if/else/catch/switch 안에 든 단언  — 늘면 느슨(안 돌 수도 있는 자리)
     ⑷ soft    expect.soft 수                     — 늘면 느슨(빨개도 검사가 안 멈춘다)
     ⑸ state   run | skip | fail | fixme | only   — run 에서 벗어나면 느슨
   세기 사다리 — 4 «값이 같다» · 3 «일부가 맞다» · 2 «크기·던짐» · 1 «있기만 하다».
     예) toBe/toEqual/deepStrictEqual = 4 · toContain/toMatch = 3 ·
         toBeGreaterThan/toThrow = 2 · toBeTruthy/toBeDefined/assert.ok = 1.
     ⛔모르는 자는 2(중립)로 두고 «모르는 자 목록»으로 따로 보고한다 — 조용히 0 으로 세면
       새 matcher 가 들어올 때마다 이 자가 거짓 경보를 낸다.

   ══ 판정 방식 — «기준판과의 차이»로만 잰다 ═════════════════════════════════
   ⛔「레포에 이런 꼴이 있어야 한다」를 전제로 걸지 않는다. 그렇게 걸면 그 꼴을 고쳐
     없앨수록 빨개진다. 이 자는 절대 기준선이 없다 — 기준판(git ref)과 지금 트리를 견준다.
     · 빨강(exit 1) — 「양쪽에 «같은 이름»으로 있는 검사」가 약해졌을 때만.
     · 노랑(exit 0) — 파일 총합이 줄었는데 검사 수는 그대로일 때(이름이 바뀐 자리일 수 있다).
     · 사라진 검사는 «여기서 빨강이 아니다» — 그건 위의 «이미 있는 자»들 몫이다.
   ⇒ 그래서 느슨한 단언을 «지우는» 손질은 이 자를 더 초록으로 만든다(빨갛게 안 만든다).

   ══ 언제 도나 (⛔만들기 «전»에 정했다 — 카드 요구) ═════════════════════════
   · 매번(`npm test`)   — tests/unit/assert-strength.test.mjs. 이 자 «자신»을 합성 표본으로
                          깨뜨려 보는 자기검사다. 제품도 전수도 안 돌린다(수백 ms).
   · 머지 «앞» 한 번    — `npm run gate:assert-strength -- --base origin/dev`.
                          검사를 «돌리지 않는» 정적 읽기다. 실측 15초(기준판 419 ＋ 지금 419
                          = 838벌 파싱, 2026-09-24). ⛔매번 돌리기엔 그 15초가 비싸서 머지
                          앞으로 정했다 — 대신 «자가검사»는 매번 돈다(윗줄, 2.4초).
     ⛔느려서 꺼 두면 안 만든 것과 같다 — 그래서 검사를 «돌리는» 방식(단언을 하나씩 약하게
       만들어 전수를 N번 돌리기)은 일부러 안 골랐다. 그 방식은 전수 × 단언 수만큼 걸린다.

   ══ 쓰는 법 ═══════════════════════════════════════════════════════════════
     node tools/assert-strength.mjs --base origin/dev          # 게이트(머지 앞)
     node tools/assert-strength.mjs --census tests/dom/x.js    # 한 파일의 명세를 눈으로
     node tools/assert-strength.mjs --self                     # 자기 자신을 깨뜨려 본다
   종료코드  0 통과 · 1 «느슨해짐» 발견 · 3 HARNESS_ERROR(판정 자체가 성립 안 함).
   ⛔3 을 1 로 접지 마라 — 접는 순간 「자가 고장난 것」이 「검사가 멀쩡한 것」으로 읽힌다.

   ══ 못 재는 것 (알고 남긴다) ═══════════════════════════════════════════════
   · 검사 «제목»을 바꾸면서 같이 약해진 자리 — 이름이 닻이라 {사라짐,새로남}으로 갈린다.
     ⇒ 그 자리는 파일 총합 «노랑»으로만 보인다(빨강 아님). 사람이 봐야 한다.
   · 헬퍼 함수 «안»의 단언 — test 본문 밖이라 그 test 의 몫으로 안 센다.
   · 단언의 «인자»가 약해진 것(toBe(3) → toBe(expect.anything())) — 자 이름만 본다.
═══════════════════════════════════════════════════════════════════════════ */
'use strict';
import fs from 'fs';
import path from 'path';
import cp from 'child_process';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

/* ── 세기 사다리 ─────────────────────────────────────────────────────────── */
export const LADDER = {
  4: ['toBe', 'toEqual', 'toStrictEqual', 'toHaveText', 'toHaveValue', 'toHaveValues',
      'toHaveCount', 'toHaveScreenshot', 'toHaveURL', 'toHaveTitle',
      'strictEqual', 'deepStrictEqual', 'deepEqual', 'equal'],
  3: ['toContain', 'toContainEqual', 'toContainText', 'toMatch', 'toMatchObject',
      'toHaveLength', 'toBeCloseTo', 'toHaveAttribute', 'toHaveClass', 'toHaveCSS',
      'toHaveId', 'toHaveProperty', 'match', 'doesNotMatch'],
  2: ['toBeGreaterThan', 'toBeGreaterThanOrEqual', 'toBeLessThan', 'toBeLessThanOrEqual',
      'toBeInstanceOf', 'toThrow', 'toThrowError', 'throws', 'rejects', 'doesNotThrow',
      'notStrictEqual', 'notDeepStrictEqual', 'notDeepEqual', 'fail'],
  1: ['toBeTruthy', 'toBeFalsy', 'toBeDefined', 'toBeUndefined', 'toBeNull', 'toBeNaN',
      'toBeVisible', 'toBeHidden', 'toBeAttached', 'toBeEnabled', 'toBeDisabled',
      'toBeChecked', 'toBeEmpty', 'toBeFocused', 'toBeEditable', 'toBeInViewport',
      'ok', 'notEqual', 'isTrue', 'isFalse'],
};
const WEIGHT = (() => {
  const m = new Map();
  for (const [w, names] of Object.entries(LADDER)) for (const n of names) m.set(n, Number(w));
  return m;
})();
const UNKNOWN_WEIGHT = 2;

/* ── ① 문자열·주석·정규식을 «자리는 지키고» 지운다 ──────────────────────────
   ⛔길이를 바꾸면 안 된다 — 아래 단계가 «원문 오프셋»으로 말을 걸기 때문이다.
   ⇒ 지운 자리는 공백으로 채운다(줄바꿈은 살린다). */
export function blank(src) {
  const out = src.split('');
  const n = src.length;
  let i = 0;
  const kill = (from, to) => { for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' '; };
  /* 정규식 리터럴인지 — 바로 앞의 «뜻 있는» 글자로 가른다(나누기와 헷갈리지 않게) */
  const regexAllowedBefore = /[=(,:[!&|?{};+\-*%~^<>]/;
  let prevMeaningful = '';
  while (i < n) {
    const c = src[i], c2 = src[i + 1];
    if (c === '/' && c2 === '/') { let j = src.indexOf('\n', i); if (j < 0) j = n; kill(i, j); i = j; continue; }
    if (c === '/' && c2 === '*') { let j = src.indexOf('*/', i + 2); j = j < 0 ? n : j + 2; kill(i, j); i = j; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) { if (src[j] === '\\') j++; j++; }
      kill(i, Math.min(j + 1, n)); i = Math.min(j + 1, n); prevMeaningful = '"'; continue;
    }
    if (c === '`') {
      /* 템플릿 — ${} 안은 «코드»지만, 이 자는 그 안의 단언을 안 센다(본문 밖 취급).
         통째로 지우되 길이는 지킨다. */
      let j = i + 1, depth = 0;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '`' && depth === 0) break;
        if (src[j] === '$' && src[j + 1] === '{') { depth++; j += 2; continue; }
        if (src[j] === '}' && depth > 0) { depth--; j++; continue; }
        j++;
      }
      kill(i, Math.min(j + 1, n)); i = Math.min(j + 1, n); prevMeaningful = '`'; continue;
    }
    if (c === '/' && (prevMeaningful === '' || regexAllowedBefore.test(prevMeaningful))) {
      let j = i + 1, cls = false, ok = false;
      while (j < n && src[j] !== '\n') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') cls = true;
        else if (src[j] === ']') cls = false;
        else if (src[j] === '/' && !cls) { ok = true; break; }
        j++;
      }
      if (ok) { while (j + 1 < n && /[a-z]/.test(src[j + 1])) j++; kill(i, j + 1); i = j + 1; prevMeaningful = '/'; continue; }
    }
    if (!/\s/.test(c)) prevMeaningful = c;
    i++;
  }
  return out.join('');
}

/** `(` 에서 시작해 짝 맞는 `)` 의 «다음» 오프셋. 못 맞추면 -1. */
function matchParen(code, open) {
  if (code[open] !== '(') return -1;
  let d = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === '(') d++;
    else if (code[i] === ')') { d--; if (d === 0) return i + 1; }
  }
  return -1;
}
/** `{` 에서 시작해 짝 맞는 `}` 의 오프셋. 못 맞추면 -1. */
function matchBrace(code, open) {
  if (code[open] !== '{') return -1;
  let d = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') d++;
    else if (code[i] === '}') { d--; if (d === 0) return i; }
  }
  return -1;
}
/** 원문에서 «첫 문자열 인자»를 그대로 읽는다(제목). blank 된 코드가 아니라 원문을 본다. */
function firstStringArg(src, openParen) {
  for (let i = openParen + 1; i < src.length && i < openParen + 4000; i++) {
    const c = src[i];
    if (c === ' ' || c === '\n' || c === '\t' || c === '\r') continue;
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1, buf = '';
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') { buf += src[j + 1]; j += 2; continue; } buf += src[j]; j++; }
      return buf;
    }
    return null;   // 첫 인자가 문자열이 아니다(변수 제목 등)
  }
  return null;
}

const CALLERS = ['test', 'it', 'describe'];
const MODIFIERS = ['skip', 'fail', 'fixme', 'only', 'serial', 'parallel', 'concurrent', 'describe', 'each'];

/** 한 파일의 명세 — [{ name, n, w, guarded, soft, state, matchers }] */
export function census(src, file = '<mem>') {
  const code = blank(src);
  const found = [];          // {kind:'test'|'describe', title, bodyStart, bodyEnd, state}
  const re = new RegExp(`\\b(${CALLERS.join('|')})((?:\\.(?:${MODIFIERS.join('|')}))*)\\s*\\(`, 'g');
  let m;
  while ((m = re.exec(code))) {
    const open = m.index + m[0].length - 1;
    /* 앞 글자가 `.` 이면 남의 메서드다(page.test 같은 것) */
    const before = code.slice(0, m.index).replace(/\s+$/, '');
    if (before.endsWith('.')) continue;
    const close = matchParen(code, open);
    if (close < 0) continue;
    const title = firstStringArg(src, open);
    if (title == null) { re.lastIndex = open + 1; continue; }
    /* 본문 — 인자 안에서 «마지막» 화살표/함수의 `{` 를 찾는다 */
    const seg = code.slice(open, close);
    const arrow = Math.max(seg.lastIndexOf('=>'), seg.lastIndexOf('function'));
    let bodyStart = -1;
    if (arrow >= 0) { const b = seg.indexOf('{', arrow); if (b >= 0) bodyStart = open + b; }
    let bodyEnd = bodyStart >= 0 ? matchBrace(code, bodyStart) : -1;
    if (bodyStart < 0 || bodyEnd < 0) { bodyStart = open; bodyEnd = close; }
    const mods = (m[2] || '').split('.').filter(Boolean);
    const isDescribe = m[1] === 'describe' || mods.includes('describe');
    const state = mods.includes('skip') ? 'skip' : mods.includes('fail') ? 'fail'
                : mods.includes('fixme') ? 'fixme' : mods.includes('only') ? 'only' : 'run';
    found.push({ kind: isDescribe ? 'describe' : 'test', title, bodyStart, bodyEnd, state, callStart: m.index });
    re.lastIndex = open + 1;
  }
  const tests = found.filter(f => f.kind === 'test');
  const describes = found.filter(f => f.kind === 'describe');
  const nameOf = (t) => {
    const chain = describes.filter(d => d.bodyStart < t.callStart && t.bodyEnd <= d.bodyEnd)
                           .sort((a, b) => a.bodyStart - b.bodyStart).map(d => d.title);
    return [file, ...chain, t.title].join(' » ');
  };
  const out = [];
  for (const t of tests) {
    /* 자식 test 의 본문은 이 test 의 몫이 아니다(중첩은 거의 없지만 규칙은 박아 둔다) */
    const inner = tests.filter(o => o !== t && o.callStart > t.bodyStart && o.bodyEnd <= t.bodyEnd);
    const rec = scanBody(code, t.bodyStart, t.bodyEnd, inner);
    /* 본문 안의 «건너뛰기 선언»(test.skip(cond) 꼴)도 상태로 친다 */
    const bodySkip = /\b(?:test|it)\.(skip|fixme|fail)\s*\(/.test(code.slice(t.bodyStart, t.bodyEnd));
    out.push({
      name: nameOf(t), n: rec.n, w: rec.w, guarded: rec.guarded, soft: rec.soft,
      state: t.state !== 'run' ? t.state : (bodySkip ? 'cond-skip' : 'run'),
      unknown: rec.unknown,
    });
  }
  return out;
}

/** 본문 한 덩이에서 단언을 센다. */
function scanBody(code, start, end, inner = []) {
  const skip = (i) => inner.some(o => i >= o.callStart && i < o.bodyEnd);
  let n = 0, w = 0, guarded = 0, soft = 0;
  const unknown = [];
  /* 블록 종류 스택 — 「안 돌 수도 있는 자리」를 가른다 */
  const stack = [];
  let guardDepth = 0;
  const body = code.slice(start, end);
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    /* ★값싼 문지기 — 이 넷이 아니면 볼 것이 없다(전수 파싱이 23초→3초). */
    if (ch !== '{' && ch !== '}' && ch !== 'e' && ch !== 'a') continue;
    const abs = start + i;
    if (body[i] === '{') {
      const head = body.slice(Math.max(0, i - 160), i);
      const isGuard = /\b(?:if|else|catch|switch)\s*(?:\([^()]*\)\s*)?$/.test(head.replace(/\s+/g, ' '));
      stack.push(isGuard);
      if (isGuard) guardDepth++;
      continue;
    }
    if (body[i] === '}') { const g = stack.pop(); if (g) guardDepth--; continue; }
    /* expect( … ).chain.matcher(   또는  expect.soft( … )… */
    const mm = /^expect(\.soft)?\s*\(/.exec(body.slice(i, i + 16));
    if (mm && !/[\w.$]/.test(body[i - 1] || '') && !skip(abs)) {
      const open = i + mm[0].length - 1;
      const close = matchParen(body, open);
      if (close > 0) {
        /* 체인을 따라가 «마지막» 자 이름을 집는다 */
        let j = close, last = null, saw = 0;
        while (j < body.length && saw < 8) {
          const c2 = /^\s*\.\s*([A-Za-z_$][\w$]*)/.exec(body.slice(j, j + 64));
          if (!c2) break;
          j += c2[0].length; saw++;
          if (c2[1] !== 'not' && c2[1] !== 'resolves' && c2[1] !== 'rejects') last = c2[1];
          const p = /^\s*\(/.exec(body.slice(j, j + 8));
          if (p) { const e2 = matchParen(body, j + p[0].length - 1); if (e2 > 0) { j = e2; if (last) break; } else break; }
        }
        if (last) {
          n++; if (mm[1]) soft++;
          if (guardDepth > 0) guarded++;
          const ww = WEIGHT.get(last);
          if (ww == null) { unknown.push(last); w += UNKNOWN_WEIGHT; } else w += ww;
        }
        i = close - 1;
        continue;
      }
    }
    /* assert(…) · assert.X(…) */
    const am = /^assert(?:\s*\.\s*([A-Za-z_$][\w$]*))?\s*\(/.exec(body.slice(i, i + 48));
    if (am && !/[\w.$]/.test(body[i - 1] || '') && !skip(abs)) {
      const nameA = am[1] || 'ok';
      n++;
      if (guardDepth > 0) guarded++;
      const ww = WEIGHT.get(nameA);
      if (ww == null) { unknown.push(nameA); w += UNKNOWN_WEIGHT; } else w += ww;
      const open = i + am[0].length - 1;
      const close = matchParen(body, open);
      i = (close > 0 ? close : open) - 1;
      continue;
    }
  }
  return { n, w, guarded, soft, unknown };
}

/* ── ② 두 명세를 견준다 ─────────────────────────────────────────────────── */
export function diffCensus(base, head) {
  const B = new Map(base.map(r => [r.name, r]));
  const H = new Map(head.map(r => [r.name, r]));
  const weakened = [];
  for (const [name, h] of H) {
    const b = B.get(name);
    if (!b) continue;                                   // 새로 난 검사 — 견줄 것이 없다
    const why = [];
    if (h.n < b.n)             why.push(`단언 수 ${b.n}→${h.n}`);
    if (h.w < b.w)             why.push(`세기 합 ${b.w}→${h.w}`);
    if (h.guarded > b.guarded) why.push(`«안 돌 수도 있는 자리»의 단언 ${b.guarded}→${h.guarded}`);
    if (h.soft > b.soft)       why.push(`expect.soft ${b.soft}→${h.soft}`);
    if (h.state !== b.state && b.state === 'run') why.push(`상태 run→${h.state}`);
    if (why.length) weakened.push({ name, why, base: b, head: h });
  }
  const gone = [...B.keys()].filter(k => !H.has(k));
  const born = [...H.keys()].filter(k => !B.has(k));
  return { weakened, gone, born };
}

/* ── ③ CLI ──────────────────────────────────────────────────────────────── */
const TEST_GLOBS = [/^tests\/unit\/.*\.test\.(js|mjs)$/, /^tests\/dom\/.*\.spec\.js$/,
                    /^tests\/e2e\/.*\.spec\.js$/];
function listTestFiles(lsFiles) {
  return lsFiles.split('\n').map(s => s.trim()).filter(Boolean)
    .filter(f => TEST_GLOBS.some(rx => rx.test(f)));
}
function die(msg) { console.error('⛔HARNESS_ERROR — ' + msg); process.exit(3); }

function main(argv) {
  const arg = (k) => { const i = argv.indexOf(k); return i < 0 ? null : (argv[i + 1] ?? true); };
  if (argv.includes('--census')) {
    const f = arg('--census');
    if (typeof f !== 'string') die('--census <파일>');
    const rows = census(fs.readFileSync(path.join(ROOT, f), 'utf8'), f);
    for (const r of rows) console.log(`n=${String(r.n).padStart(3)} w=${String(r.w).padStart(3)} ` +
      `guarded=${r.guarded} soft=${r.soft} ${r.state.padEnd(9)} ${r.name}`);
    console.log(`\n검사 ${rows.length}개 · 단언 ${rows.reduce((a, b) => a + b.n, 0)}개`);
    return 0;
  }
  const base = arg('--base');
  if (!base || base === true) die('쓰는 법: node tools/assert-strength.mjs --base <git ref>');

  let headFiles;
  try { headFiles = listTestFiles(cp.execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })); }
  catch (e) { return die('git ls-files 실패: ' + e.message); }
  if (!headFiles.length) return die('검사 파일을 한 개도 못 찾았다 — 0건을 «통과»로 읽지 않는다');

  let baseFiles;
  try { baseFiles = listTestFiles(cp.execSync(`git ls-tree -r --name-only ${JSON.stringify(base)}`, { cwd: ROOT, encoding: 'utf8' })); }
  catch (e) { return die(`기준판 ${base} 를 못 읽는다: ` + e.message); }
  if (!baseFiles.length) return die(`기준판 ${base} 에서 검사 파일을 한 개도 못 찾았다`);

  /* ★기준판을 «한 번에» 꺼낸다 — 파일마다 `git show` 를 부르면 419개에 75초다(실측).
     git archive 한 번이면 1초 안쪽이고, 꺼낸 자리는 내가 만든 임시 폴더뿐이다. */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'assert-strength-'));
  try {
    cp.execSync(`git archive --format=tar ${JSON.stringify(base)} -- tests | tar -x -C ${JSON.stringify(tmp)}`,
                { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'], shell: '/bin/sh' });
  } catch (e) { fs.rmSync(tmp, { recursive: true, force: true }); return die(`기준판 ${base} 를 못 꺼낸다: ` + e.message); }
  const readBase = (f) => { try { return fs.readFileSync(path.join(tmp, f), 'utf8'); } catch { return null; } };
  const baseRows = [], headRows = [];
  const unknown = new Map();
  for (const f of headFiles) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const r of census(src, f)) { headRows.push(r); for (const u of r.unknown) unknown.set(u, (unknown.get(u) || 0) + 1); }
  }
  let baseRead = 0;
  for (const f of baseFiles) { const src = readBase(f); if (src != null) { baseRead++; baseRows.push(...census(src, f)); } }
  fs.rmSync(tmp, { recursive: true, force: true });
  /* ⛔「못 읽었다」를 「없다」로 읽지 않는다 — 기준판 파일이 절반도 안 열리면 판정이 성립 안 한다 */
  if (baseRead < baseFiles.length) return die(`기준판 파일 ${baseFiles.length}개 중 ${baseRead}개만 열렸다 — 판정이 성립 안 한다`);

  const { weakened, gone, born } = diffCensus(baseRows, headRows);

  /* 노랑 — 파일 총합이 줄었는데 검사 수는 그대로 (이름이 바뀌며 약해진 자리일 수 있다) */
  const byFile = (rows) => { const m = new Map(); for (const r of rows) { const f = r.name.split(' » ')[0];
    const a = m.get(f) || { n: 0, w: 0, t: 0 }; a.n += r.n; a.w += r.w; a.t++; m.set(f, a); } return m; };
  const BF = byFile(baseRows), HF = byFile(headRows);
  const yellow = [];
  for (const [f, h] of HF) { const b = BF.get(f); if (b && b.t === h.t && (h.w < b.w || h.n < b.n))
    yellow.push(`${f} — 검사 ${h.t}개 그대로인데 단언 ${b.n}→${h.n} · 세기 ${b.w}→${h.w}`); }

  console.log(`기준판 ${base} — 검사 ${baseRows.length}개 / 지금 ${headRows.length}개` +
              `  (사라짐 ${gone.length} · 새로 남 ${born.length})`);
  if (unknown.size) console.log(`ℹ 모르는 자 ${unknown.size}종(중립 ${UNKNOWN_WEIGHT} 로 셌다): ` +
    [...unknown.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}×${v}`).join(' '));
  for (const y of yellow) console.log('🟡 ' + y);
  if (!weakened.length) { console.log('✅ «제자리에서 약해진» 단언 0건'); return yellow.length ? 0 : 0; }
  console.log(`\n🔴 «제자리에서 약해진» 검사 ${weakened.length}건`);
  for (const wk of weakened) console.log(`  · ${wk.name}\n      ${wk.why.join(' · ')}`);
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
