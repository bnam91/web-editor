/* bg-layer-guard.test.mjs — b1a G8 ★구조 자: 「레이어 있음 ⇔ needsBgLayer」 불변식의 ★부르는 자리 전수.
 *
 * ★왜 — e4bb4594(1017t1k1·k2)가 `js/image-handling.js` adjHost 에 ★검문 없는 `ensureBgLayer(host)` 를
 *   하나 더했다. 영구 자리 셋(prop-section · frame-bg ×2)은 모두 `needsBgLayer ? ensure : remove` 짝인데
 *   그 하나만 ★불변식 밖에서 레이어를 지었다 ⇒ needs=false 인데 레이어가 «있고», syncBg 가 needs 를 믿고
 *   숙주에 써서 ★레이어 아래로 숨었다 ⇒ 편집 중 화면이 굳었다(5일 동안 안 잡혔다).
 *
 * ★이 자는 «증상»이 아니라 «구조»를 잰다 — tests/dom/sec-bg-live.dom.spec.js(G1~G7 픽셀)가 증상 자다.
 *   ★글자 자(frame-bg-edit-wiring B3 같은 스타일 문자열 정규식)는 ★이 결함에 눈이 없다 —
 *   M1 덤: 회전 중 레이어 size 글자가 cover→860px 645px 로 바뀌었지만 화면은 0(거울상).
 *   ⇒ 증상은 픽셀 자만 본다. G8 은 «같은 병이 ★다른 자리로 다시 들어오는 길»을 막는다.
 *
 * ★짝의 정의(엄격 · 지디 판정 j2 ①):
 *   부르는 자리를 둘러싼 조건 사슬(if 블록 · 중괄호 없는 if · 삼항) 안에 ★정확히 `needsBgLayer(<같은 첫 인자>)`
 *   인 조건이 있거나, `const V = needsBgLayer(<같은 인자>);` 로 초기화된 별칭 V 단독 조건이 있으면 짝.
 *   ⛔`!!deg || needsBgLayer(host)` 처럼 `||`·`&&` 가 붙은 꼴은 짝이 ★아니다(판정이 한 자리가 아니다 —
 *   핀판 :1303 이 바로 회전 중 needs=false 인데 레이어를 지은 자리).
 *   부류: 영구 자리 = else(또는 return 뒤 바로 다음 문장 · 삼항 거짓 갈래)에 removeBgLayer(<같은 인자>).
 *         편집 자리(image-handling) = 가드만 — 그 remove 는 커밋이다 ⇒ beforeCommit 에서 _teardownBgEdit 가
 *         ad.commit 보다 앞(편집 키가 내려간 뒤 영구 자리가 다시 판정).
 *
 * ★★왜 자가 둘인가 — 평가자 실측(work-b1a/eval/EVAL.md): V1(:1313 `!!deg ||` 되붙임) ⇒ 이 파일 G8a 빨강 · 픽셀 spec 9/9 초록 /
 *   V2(needsBgLayer 의 _secBgEditing 줄 삭제) ⇒ 이 파일 3/3 초록 · 픽셀 spec 6 빨강 — 서로의 사각을 덮었다 · ⛔하나를 지우지 마라.
 * ★조건부 예외 한 줄(b1a N1 · 지디 판정 n1) — 엄격형이 허용하는 «검문 아닌» 꼴은 ★정확히 이 한 줄뿐이다:
 *     js/image-handling.js adjHost `needsBgLayer(host) || host.classList.contains('has-bg-opacity') ? ensureBgLayer(host) : …`
 *   다른 파일·다른 자리·다른 꼴의 `||` 는 여전히 짝이 아니다. 그 예외는 needsBgLayer 의 has-bg-opacity 예외와
 *   «한 예외의 두 얼굴»이라 G8d 가 둘 다 있거나 둘 다 없음을 잠근다(거둘 조건 HAS-BG-OPACITY-LAYER-ZERO 공유).
 * ★예측(PLAN) — 처방판: 자리 5 · 짝 5 · 초록 / 핀 002d9725: 자리 5 · 짝 아님 2(:1305 · :1364) · 빨강.
 * ★양성대조: GD1001_ROOT=<핀 사본> 으로 돌린다. 음성대조: 처방판 사본에 검문 없는 부름 하나 심기 ⇒ 빨강.
 *
 * 실행: node --test tests/unit/bg-layer-guard.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const req = createRequire(import.meta.url);
const { readSrc } = req('./_srcread.js');
const { stripCommentsTA, templateBalanced } = req('./_strip-comments.js');

const ROOT = process.env.GD1001_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/* ★부류 표 — ⛔새 자리가 생기면 ★여기에 부류를 정해 올려라(안 올리면 G8c 가 빨강). */
const EXPECTED = {
  'js/props/prop-section.js': { kind: 'perm', n: 1 },
  'js/frame-bg.js':           { kind: 'perm', n: 2 },
  'js/image-handling.js':     { kind: 'edit', n: 2 },
  /* ★10171a5(2026-10-26 S3) — 모달 배경도 회전·색보정 레이어를 갖는다(renderModalBlock 이 innerHTML 을 갈아끼워도 지킨다). */
  'js/blocks/modal-block.js': { kind: 'perm', n: 1 },
};
const EXPECTED_TOTAL = 6;

function listJs() {
  const out = [];
  const walk = (d) => {
    const abs = path.join(ROOT, d);
    if (!existsSync(abs)) return;
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(d + '/' + e.name); }
      else if (/\.(m?js)$/.test(e.name)) out.push(d + '/' + e.name);
    }
  };
  walk('js');
  return out.sort();
}

const code = (rel) => {
  const src = readSrc(ROOT, rel);
  assert.equal(templateBalanced(src), true, `★전제: ${rel} 의 템플릿이 ★안 닫혔다`);
  return stripCommentsTA(src);
};

/** 앞으로 훑어 ★문자열·템플릿·정규식 리터럴 밖의 `{` 위치 스택을 위치마다 알 수 있게 한다.
 *  돌려줌: opens[i] = i 위치에서 열려 있는 `{` 위치 배열(바깥→안). 끝에서 스택이 비어야 한다(전제). */
function braceIndex(s) {
  const stack = [];           // { pos, tpl } — tpl: 템플릿 보간 `${` 의 여는 괄호
  const opensAt = new Map();
  const queries = new Set();
  return {
    run(qs) {
      qs.forEach(q => queries.add(q));
      let i = 0, mode = 'code', quote = '', prevSig = '';
      const tplStack = [];    // 템플릿 안에서 `${` 로 들어간 깊이
      while (i < s.length) {
        const ch = s[i];
        if (queries.has(i) && mode === 'code') opensAt.set(i, stack.filter(x => !x.tpl).map(x => x.pos));
        if (mode === 'str') {
          if (ch === '\\') { i += 2; continue; }
          if (ch === quote) mode = 'code';
          i++; continue;
        }
        if (mode === 'tpl') {
          if (ch === '\\') { i += 2; continue; }
          if (ch === '`') { mode = 'code'; i++; prevSig = '`'; continue; }
          if (ch === '$' && s[i + 1] === '{') { stack.push({ pos: i + 1, tpl: true }); tplStack.push(stack.length); mode = 'code'; i += 2; continue; }
          i++; continue;
        }
        if (mode === 're') {
          if (ch === '\\') { i += 2; continue; }
          if (ch === '[') { mode = 'recls'; i++; continue; }
          if (ch === '/') { mode = 'code'; prevSig = '/'; }
          i++; continue;
        }
        if (mode === 'recls') {
          if (ch === '\\') { i += 2; continue; }
          if (ch === ']') mode = 're';
          i++; continue;
        }
        // code
        if (ch === '"' || ch === "'") { mode = 'str'; quote = ch; i++; prevSig = ch; continue; }
        if (ch === '`') { mode = 'tpl'; i++; continue; }
        if (ch === '/') {
          // 정규식 리터럴 휴리스틱: 앞의 의미 있는 글자가 연산자·여는 괄호면 정규식
          if (prevSig === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(prevSig) || /\b(return|typeof|case|in|of)$/.test(s.slice(Math.max(0, i - 8), i).trimEnd())) {
            mode = 're'; i++; continue;
          }
        }
        if (ch === '{') stack.push({ pos: i, tpl: false });
        else if (ch === '}') {
          const top = stack.pop();
          if (top && top.tpl && tplStack.length && tplStack[tplStack.length - 1] === stack.length + 1) { tplStack.pop(); mode = 'tpl'; i++; continue; }
        }
        if (!/\s/.test(ch)) prevSig = ch;
        i++;
      }
      return { opensAt, balanced: stack.length === 0 };
    },
  };
}

/** s[openParen] === '(' 에서 짝 `)` 위치 */
function matchParen(s, openParen) {
  let d = 0;
  for (let k = openParen; k < s.length; k++) {
    if (s[k] === '(') d++;
    else if (s[k] === ')') { d--; if (!d) return k; }
  }
  return -1;
}
/** s[openBrace] === '{' 에서 짝 `}` 위치(같은 함수 몸 안 · 문자열 속 괄호는 드물어 단순 균형) */
function matchBrace(s, openBrace) {
  let d = 0;
  for (let k = openBrace; k < s.length; k++) {
    if (s[k] === '{') d++;
    else if (s[k] === '}') { d--; if (!d) return k; }
  }
  return -1;
}

/** 부르는 자리의 첫 인자 */
function firstArg(s, openParen) {
  let d = 0;
  for (let k = openParen + 1; k < s.length; k++) {
    const c = s[k];
    if (c === '(' || c === '{' || c === '[') d++;
    else if (c === ')' || c === '}' || c === ']') { if (!d) return s.slice(openParen + 1, k).trim(); d--; }
    else if (c === ',' && !d) return s.slice(openParen + 1, k).trim();
  }
  return null;
}

const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isExactNeeds = (cond, arg, aliases) => {
  const c = cond.trim();
  return c === `needsBgLayer(${arg})` || aliases.has(c);
};
/* ★허용 예외 꼴(정확히 이 글자 · 공백만 자유) — 편집 자리(image-handling.js) 삼항에서만, 전수 1회까지 */
const OPA_EXC_FILE = 'js/image-handling.js';
const opaExcRe = (arg) => new RegExp(`^needsBgLayer\\(${esc(arg)}\\)\\s*\\|\\|\\s*${esc(arg)}\\.classList\\.contains\\('has-bg-opacity'\\)$`);

/** 한 파일의 ensureBgLayer 부르는 자리 전수 분석 */
function analyze(rel) {
  const s = code(rel);
  const lineOf = (pos) => s.slice(0, pos).split('\n').length;
  const calls = [];
  const re = /\bensureBgLayer\s*(?:\?\.)?\(/g;
  let m;
  while ((m = re.exec(s))) {
    const before = s.slice(Math.max(0, m.index - 20), m.index);
    if (/function\s+$/.test(before)) continue;      // 정의
    const openParen = m.index + m[0].length - 1;
    calls.push({ pos: m.index, openParen, line: lineOf(m.index), arg: firstArg(s, openParen) });
  }
  if (!calls.length) return { rel, calls: [] };
  const { opensAt, balanced } = braceIndex(s).run(calls.map(c => c.pos));
  assert.equal(balanced, true, `★전제: ${rel} 의 중괄호 셈이 안 닫혔다(훑개가 눈멀었다)`);
  for (const c of calls) {
    const aliases = new Set();
    for (const am of s.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+);/g)) {
      if (am[2].trim() === `needsBgLayer(${c.arg})`) aliases.add(am[1]);
    }
    c.guard = null; c.removePair = false;
    /* ① 삼항 — `needsBgLayer(arg) ? ensureBgLayer(arg…) : X` */
    const head = s.slice(Math.max(0, c.pos - 200), c.pos);
    const tm = head.match(new RegExp(`(^|[(=,:>]|\\breturn)\\s*\\(?\\s*(needsBgLayer\\(${esc(c.arg)}\\))\\s*\\?\\s*$`));
    const xm = rel === OPA_EXC_FILE && head.match(new RegExp(`(?:^|[(=,:>]|\\breturn)\\s*\\(?\\s*(needsBgLayer\\(${esc(c.arg)}\\)\\s*\\|\\|\\s*${esc(c.arg)}\\.classList\\.contains\\('has-bg-opacity'\\))\\s*\\?\\s*$`));
    if (xm && opaExcRe(c.arg).test(xm[1].trim())) {
      c.guard = { form: 'ternary-opa-exception', cond: xm[1].trim() };
      continue;
    }
    if (tm) {
      c.guard = { form: 'ternary', cond: tm[2] };
      const close = matchParen(s, c.openParen);
      const tail = s.slice(close + 1, close + 200);
      c.removePair = new RegExp(`^\\s*:\\s*removeBgLayer\\(${esc(c.arg)}\\)`).test(tail);
      continue;
    }
    /* ② 중괄호 없는 if — 같은 문장 머리 */
    const stmtStart = Math.max(s.lastIndexOf(';', c.pos), s.lastIndexOf('{', c.pos), s.lastIndexOf('}', c.pos)) + 1;
    const stmt = s.slice(stmtStart, c.pos);
    const conds = [];
    const bm = stmt.match(/^\s*(?:else\s+)?if\s*\(/);
    if (bm) {
      const op = stmtStart + stmt.indexOf('(', stmt.search(/if\s*\(/));
      const cp = matchParen(s, op);
      if (cp > 0 && cp < c.pos) conds.push({ form: 'if-nobrace', cond: s.slice(op + 1, cp), blockOpen: -1, ifAt: stmtStart });
    }
    /* ③ 둘러싼 블록들(안→밖) — 함수 몸에 닿으면 멈춘다 */
    const opens = (opensAt.get(c.pos) || []).slice().reverse();
    for (const ob of opens) {
      const hdrStart = Math.max(s.lastIndexOf(';', ob - 1), s.lastIndexOf('{', ob - 1), s.lastIndexOf('}', ob - 1)) + 1;
      const hdr = s.slice(hdrStart, ob);
      if (/\bfunction\b|=>\s*$/.test(hdr) || /^\s*[A-Za-z_$][\w$]*\s*\([^)]*\)\s*$/.test(hdr) && !/^\s*(if|for|while|switch|catch)\b/.test(hdr)) break;
      const im = hdr.match(/^\s*(?:else\s+)?if\s*\(/);
      if (im) {
        const op = hdrStart + hdr.indexOf('(', hdr.search(/if\s*\(/));
        const cp = matchParen(s, op);
        conds.push({ form: 'if-block', cond: s.slice(op + 1, cp), blockOpen: ob });
      } else if (/^\s*else\s*$/.test(hdr)) {
        conds.push({ form: 'else-block', cond: null, blockOpen: ob });
      }
    }
    const g = conds.find(x => x.cond != null && isExactNeeds(x.cond, c.arg, aliases));
    if (g) {
      c.guard = { form: g.form, cond: g.cond.trim() };
      if (g.blockOpen >= 0) {
        const close = matchBrace(s, g.blockOpen);
        const body = s.slice(g.blockOpen + 1, close);
        const after = s.slice(close + 1, close + 300);
        const em = after.match(/^\s*else\s*\{/);
        if (em) {
          const eo = close + 1 + after.indexOf('{');
          c.removePair = new RegExp(`\\bremoveBgLayer\\(${esc(c.arg)}\\)`).test(s.slice(eo, matchBrace(s, eo)));
        } else {
          /* return 으로 끝나는 블록 + 바로 다음 문장 removeBgLayer(arg) = 같은 뜻의 else */
          c.removePair = /\breturn\b[^;]*;\s*$/.test(body) && new RegExp(`^\\s*removeBgLayer\\(${esc(c.arg)}\\)\\s*;`).test(after);
        }
      }
    }
  }
  return { rel, calls };
}

function censusAll() {
  const files = listJs();
  assert.ok(files.length > 50, `★전제: js/ 를 거의 못 훑었다(${files.length}벌) — ROOT=${ROOT}`);
  const rows = [];
  for (const f of files) {
    if (!/\bensureBgLayer\b/.test(readSrc(ROOT, f))) continue;
    const r = analyze(f);
    for (const c of r.calls) rows.push({ file: f, ...c });
  }
  return rows;
}

const fmt = (r) => `${r.file}:${r.line} ensureBgLayer(${r.arg}) guard=${r.guard ? r.guard.form + '«' + r.guard.cond + '»' : '없음'}`;

/* ══ G8a ════════════════════════════════════════════════════════════════ */
test('G8a ★ensureBgLayer 부르는 자리마다 needsBgLayer(같은 인자) 정확 검문과 짝이다', () => {
  const rows = censusAll();
  assert.ok(rows.length > 0, '★전제: 부르는 자리를 하나도 못 찾았다(0건=초록 방지)');
  const bad = rows.filter(r => !r.guard);
  console.log(`[G8a] ROOT=${ROOT} · 자리 ${rows.length} · 짝 ${rows.length - bad.length} · 짝 아님 ${bad.length}`);
  rows.forEach(r => console.log('  ' + fmt(r)));
  assert.deepEqual(bad.map(fmt), [],
    `★검문 없는(또는 \`||\`·\`&&\` 로 섞인) ensureBgLayer 부름 — 「레이어 있음 ⇔ needsBgLayer」 불변식 밖에서 레이어를 짓는다`);
  const exc = rows.filter(r => r.guard && r.guard.form === 'ternary-opa-exception');
  assert.ok(exc.length <= 1, `★has-bg-opacity 조건부 예외 꼴이 ${exc.length}자리다 — 허용은 한 줄뿐: ${exc.map(fmt).join(' / ')}`);
});

/* ══ G8b ════════════════════════════════════════════════════════════════ */
test('G8b ★영구 자리는 needs ? ensure : remove 짝 · 편집 자리는 teardown 이 commit 보다 앞', () => {
  const rows = censusAll();
  const perm = rows.filter(r => EXPECTED[r.file]?.kind === 'perm');
  assert.ok(perm.length > 0, '★전제: 영구 자리를 하나도 못 찾았다');
  const noRemove = perm.filter(r => !(r.guard && r.removePair));
  assert.deepEqual(noRemove.map(fmt), [], '★영구 자리에 removeBgLayer(같은 인자) 짝이 없다 — needs 가 거짓일 때 레이어가 남는다');
  /* 편집 자리 — beforeCommit 본문에서 _teardownBgEdit( 가 ad.commit( 보다 앞 */
  const s = code('js/image-handling.js');
  const i = s.indexOf('beforeCommit:');
  assert.ok(i >= 0, '★beforeCommit 을 못 찾았다');
  const ob = s.indexOf('{', i);
  const body = s.slice(ob, matchBrace(s, ob) + 1);
  const t = body.indexOf('_teardownBgEdit('), cm = body.indexOf('ad.commit(');
  assert.ok(t >= 0 && cm >= 0, `★beforeCommit 에 teardown(${t})·commit(${cm}) 이 다 있어야 한다`);
  assert.ok(t < cm, '★beforeCommit 에서 commit 이 teardown 보다 앞이다 — 편집 키가 선 채로 영구 자리가 판정해 레이어가 남는다');
});

/* ══ G8c ════════════════════════════════════════════════════════════════ */
test('G8c ★부르는 자리 수 = 6(부류 표와 같다)', () => {
  const rows = censusAll();
  const perFile = {};
  rows.forEach(r => { perFile[r.file] = (perFile[r.file] || 0) + 1; });
  const unknown = Object.keys(perFile).filter(f => !EXPECTED[f]);
  assert.deepEqual(unknown, [], `★부류 표에 없는 파일에서 ensureBgLayer 를 부른다 — 새 자리는 이 표에 부류를 정해 올려라: ${unknown.join(', ')}`);
  const want = Object.fromEntries(Object.entries(EXPECTED).map(([f, v]) => [f, v.n]));
  assert.deepEqual(perFile, want, `★파일별 부르는 자리 수가 표와 다르다`);
  assert.equal(rows.length, EXPECTED_TOTAL, `★부르는 자리 수 ${rows.length} ≠ ${EXPECTED_TOTAL}`);
});

/* ══ G8d ════════════════════════════════════════════════════════════════ */
test('G8d ★한 예외의 두 얼굴 — needsBgLayer 의 has-bg-opacity 예외 ↔ adjHost 의 has-bg-opacity 예외: 둘 다 있거나 둘 다 없다', () => {
  const bgl = code('js/bg-layer.js');
  const i = bgl.indexOf('export function needsBgLayer(');
  assert.ok(i >= 0, '★needsBgLayer 정의를 못 찾았다');
  const ob = bgl.indexOf('{', i);
  const needsBody = bgl.slice(ob, matchBrace(bgl, ob) + 1);
  assert.match(needsBody, /_secBgEditing/, '★전제: needsBgLayer 에 편집 세션 키가 없다(이 자가 엉뚱한 판을 본다)');
  const needsSide = /_secBgEditing\s*&&\s*!\s*host\.classList\??\.contains\(\s*'has-bg-opacity'\s*\)/.test(needsBody);
  const ih = code('js/image-handling.js');
  const am = ih.match(/adjHost\s*:\s*\(\)\s*=>\s*([^\n]*)/);
  assert.ok(am, '★전제: adjHost 줄을 못 찾았다');
  const adjSide = /classList\.contains\(\s*'has-bg-opacity'\s*\)/.test(am[1]);
  console.log(`[G8d] needs 쪽 예외=${needsSide} · adjHost 쪽 예외=${adjSide} · adjHost=«${am[1].trim()}»`);
  assert.equal(needsSide, adjSide,
    `★has-bg-opacity 예외가 한쪽에만 있다(needs=${needsSide} · adjHost=${adjSide}) — 둘은 같은 거둘 조건(HAS-BG-OPACITY-LAYER-ZERO)을 공유한다. 거둘 땐 같이 거둬라`);
});
