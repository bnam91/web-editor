// block-bind-lists-ruler.test.mjs — «bindBlock 걸 종류» 명부 8곳의 ★차집합 자 (S3 t4 ⒡ · W2D-01 이관 · 2026-10-21)
//   실행: node --test "tests/unit/*.test.mjs"  ·  소스 글자만 읽는다(제품 코드 import 0 · 라이브 무접촉 · 파일 쓰기 0).
//
// 왜 — 잠금 시험(tests/unit/block-bind-kinds-lock.test.mjs)은 «정본 − 손 명부» 한 방향만 잰다.
//   정본이 무엇을 담아야 하는지는 아무도 안 쟀다 ⇒ radial-block 이 정본에 없는 채로(A/B 사본 · 템플릿 넣기에서 안 묶임) 초록이었다.
//   ⇒ 이 자는 기준표(tests/unit/_block-bind-lists-def.mjs)의 K_BIND 를 두고 명부마다 «양방향» 차집합을 잰다.
//
// 자 목록:
//   R0 정의표 무결 · R1 CANON ↔ K_BIND 양방향 · R2×7 손 명부 차집합 = 표 · R3 목록 맞추기(명부 꼴 자리 = 표의 자리)
//   R4 잠금 시험 FROZEN 이 손 명부 7곳을 다 덮는다 · R5 8자리마다 bind-list:<이름> 표식 · R6 음성대조 4(자 함수가 정말 짚나).
// 바닥 6acfb9e4 에서 기대: R1 · R4 · R5 빨강(그 셋이 이번 결함·빚을 짚는다) · 나머지 초록.
//
// ⛔닻을 쓰는 «자르개» 이름(anchor-signature-ratchet.test.mjs CUTTERS)을 이 파일에서 쓰지 않는다 — 닻은 indexOf 로만 찾는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { K_BIND, OWN_BINDER, LISTS, NOT_BIND } from './_block-bind-lists-def.mjs';
import { sliceBlock } from './_slice-block.js';   // 구간 끝은 공용 부품(균형괄호)으로 — 꼬리 문자열로 찾지 않는다(slice-block-shared SB-16)

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOCK_REL = 'tests/unit/block-bind-kinds-lock.test.mjs';
const MIN_KINDS = 10;

// ── 순수 함수 (글자 → 값 · 파일을 안 읽는다) ─────────────────────────────────────

const sorted = (it) => [...it].sort();
const minus = (a, b) => { const bs = new Set(b); return sorted(new Set([...a].filter((x) => !bs.has(x)))); };
const kindsIn = (s) => new Set([...s.matchAll(/\.([a-z0-9-]+-block)\b/g)].map((m) => m[1]));
const lineAt = (src, idx) => src.slice(0, idx).split('\n').length;
const lineTextAt = (src, idx) => { const s = src.lastIndexOf('\n', idx - 1) + 1; const e = src.indexOf('\n', idx); return src.slice(s, e < 0 ? undefined : e); };
const mustOf = (list) => (list.mustContain === 'K_BIND' ? [...K_BIND] : [...list.mustContain]);

// 닻이 나오는 자리 전부(겹치지 않게 앞에서부터).
function occurrences(src, anchor) {
  const out = [];
  if (!anchor) return out;
  for (let at = src.indexOf(anchor); at >= 0; at = src.indexOf(anchor, at + anchor.length)) out.push(at);
  return out;
}

// 닻(occurrence 번째) → { idx, line, text } · 없으면 null.
function locate(src, anchor, occurrence = 0) {
  if (src == null) return null;
  const at = occurrences(src, anchor)[occurrence];
  if (at === undefined) return null;
  return { idx: at, line: lineAt(src, at), text: lineTextAt(src, at) };
}

// 정본 글자 → 종류 배열. BLOCK_BIND_KINDS = Object.freeze([ … ]); 사이의 '…-block' (주석은 걷고 센다).
function canonKindsOf(src) {
  const head = 'BLOCK_BIND_KINDS = Object.freeze([';
  const a = src.indexOf(head);
  if (a < 0) return null;
  const b = src.indexOf(']);', a);
  const body = src.slice(a + head.length, b < 0 ? undefined : b)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
  return [...body.matchAll(/'([a-z0-9-]+-block)'/g)].map((m) => m[1]);
}

// R1 — 정본 글자 → { missing: K_BIND − 정본 · extra: 정본 − K_BIND · own: 정본 ∩ OWN_BINDER · dup }.
function canonDiff(src, kBind = K_BIND, own = OWN_BINDER) {
  const got = canonKindsOf(src);
  if (!got) return null;
  const dup = sorted(new Set(got.filter((k, i) => got.indexOf(k) !== i)));
  return { size: got.length, missing: minus(kBind, got), extra: minus(got, kBind), own: sorted(got.filter((k) => own.includes(k))), dup };
}

// 손 명부 하나 — 닻 줄(닻부터 줄 끝)의 .xxx-block 종류.
function handKindsOf(src, anchor) {
  const at = locate(src, anchor);
  if (!at) return null;
  const e = src.indexOf('\n', at.idx);
  return kindsIn(src.slice(at.idx, e < 0 ? undefined : e));
}

// R2 — 손 명부 차집합을 표와 견준다. 네 갈래를 따로 돌려준다.
function handDiff(src, list) {
  const got = handKindsOf(src, list.anchor);
  if (!got) return null;
  const must = mustOf(list);
  const missing = minus(must, got);
  const extra = minus(got, must);
  const gaps = Object.keys(list.knownGaps);
  const allowed = Object.keys(list.allowedExtra);
  return {
    size: got.size, missing, extra,
    newMissing: minus(missing, gaps),       // 새로 빠짐
    filled: minus(gaps, missing),           // 채워짐(표를 줄여라)
    unexpectedExtra: minus(extra, allowed), // 뜻밖의 더함
    vanishedExtra: minus(allowed, extra),   // 사라진 더함(표를 줄여라)
    forbidden: sorted([...got].filter((k) => (list.mustNot || []).includes(k) && !allowed.includes(k))),
  };
}

// ── R3 용 가벼운 훑개 ──
// 문자열·주석·정규식·템플릿을 건너뛰며 { 를 센다. { 바로 앞이 «=>» 이거나 «이름(…)»(이름이 if/for/while/switch/catch 따위가 아님)이면 함수 몸통.
// bindBlock 부름 = 낱말 bindBlock 다음에 «(» · «?.(» · «)» · «,» (function bindBlock 정의는 뺀다).
// ⚠️정밀도 미검증 — 첫 런 전까지는 이 훑개가 «명부 꼴 자리»를 빠짐없이·군더더기 없이 뽑는지 런으로 확인 안 됐다.
//   그래서 R3 실패 메시지에 후보 전부를 찍는다(사람이 읽고 감사할 수 있게). 훑개가 짝을 못 맞춘 파일도 R3 이 따로 짚는다.
const KW = new Set(['if', 'for', 'while', 'switch', 'catch', 'with', 'return', 'typeof', 'in', 'of', 'new', 'delete', 'void',
  'instanceof', 'do', 'else', 'case', 'throw', 'await', 'yield']);

function scanJs(src) {
  const strings = [], fns = [], binds = [], stack = [];
  const n = src.length;
  let i = 0, lastSig = '', lastWord = '', underflow = 0;
  const tok = (t, w = '') => { lastSig = t; lastWord = w; };
  const tmplChunk = (from) => {
    let j = from;
    while (j < n && src[j] !== '`') { if (src[j] === '\\') { j += 2; continue; } if (src[j] === '$' && src[j + 1] === '{') break; j++; }
    strings.push({ start: from - 1, end: j + 1, text: src.slice(from, j) });
    if (src[j] === '`') { i = j + 1; tok('str'); } else { stack.push({ type: 'tx' }); i = j + 2; tok('('); }
  };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { const e = src.indexOf('\n', i); i = e < 0 ? n : e; continue; }
    if (c === '/' && d === '*') { const e = src.indexOf('*' + '/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') { if (src[j] === '\\') j++; j++; }
      strings.push({ start: i, end: j + 1, text: src.slice(i + 1, j) });
      i = j + 1; tok('str'); continue;
    }
    if (c === '`') { tmplChunk(i + 1); continue; }
    if (c === '}' && stack.length && stack[stack.length - 1].type === 'tx') { stack.pop(); tmplChunk(i + 1); continue; }
    if (c === '/') {
      const re = lastSig === '' || /^[(,=:[!&|?{};+\-*%<>~^]$/.test(lastSig) || lastSig === '}' || (lastSig === 'w' && KW.has(lastWord));
      if (re) {
        let j = i + 1, cls = false;
        while (j < n) {
          const ch = src[j];
          if (ch === '\\') { j += 2; continue; }
          if (ch === '\n') break;
          if (cls) { if (ch === ']') cls = false; } else if (ch === '[') cls = true; else if (ch === '/') break;
          j++;
        }
        j++; while (j < n && /[a-z]/i.test(src[j])) j++;
        i = j; tok('str'); continue;
      }
      i++; tok('/'); continue;
    }
    if (c === '{') {
      let isFn = false, k = i - 1;
      while (k >= 0 && /\s/.test(src[k])) k--;
      if (src[k] === '>' && src[k - 1] === '=') isFn = true;
      else if (src[k] === ')') {
        let depth = 0, m = k;
        for (; m >= 0; m--) { if (src[m] === ')') depth++; else if (src[m] === '(') { depth--; if (depth === 0) break; } }
        let p = m - 1; while (p >= 0 && /\s/.test(src[p])) p--;
        let q = p; while (q >= 0 && /[\w$]/.test(src[q])) q--;
        const w = src.slice(q + 1, p + 1);
        isFn = !!w && !KW.has(w);
      }
      stack.push({ type: 'b', open: i, isFn }); i++; tok('{'); continue;
    }
    if (c === '}') {
      const t = stack.pop();
      if (!t) underflow++;
      else if (t.isFn) fns.push({ open: t.open, close: i });
      i++; tok('}'); continue;
    }
    if (/[\w$]/.test(c)) {
      let j = i; while (j < n && /[\w$]/.test(src[j])) j++;
      const w = src.slice(i, j);
      if (w === 'bindBlock' && lastWord !== 'function' && /^\s*(?:\?\.\s*)?[(),]/.test(src.slice(j, j + 8))) binds.push(i);
      tok('w', w); i = j; continue;
    }
    if (/\s/.test(c)) { i++; continue; }
    tok(c); i++;
  }
  return { strings, fns, binds, unclosed: stack.length, underflow };
}

// R3 — 소스 묶음(Map rel → 글자) → 명부 꼴 후보 [{ site: 'rel:line', file, line, kinds, scope }] · 훑개가 짝을 못 맞춘 파일.
function inventory(sources, minKinds = MIN_KINDS) {
  const candidates = [], unbalanced = [];
  for (const [rel, src] of [...sources.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const r = scanJs(src);
    if (r.unclosed || r.underflow) unbalanced.push(`${rel}(열림 ${r.unclosed} · 넘침 ${r.underflow})`);
    for (const s of r.strings) {
      const k = kindsIn(s.text);
      if (k.size < minKinds) continue;
      const enc = r.fns.filter((f) => f.open < s.start && f.close > s.end).sort((a, b) => (a.close - a.open) - (b.close - b.open))[0];
      let lo, hi, scope;
      if (enc) { lo = enc.open; hi = enc.close; scope = `fn ${lineAt(src, enc.open)}-${lineAt(src, enc.close)}`; }
      else { // 둘러싼 함수가 없으면 그 최상위 문장(그 줄 머리 ~ 다음 «;줄바꿈»)
        lo = src.lastIndexOf('\n', s.start) + 1;
        const e = src.indexOf(';\n', s.end); hi = e < 0 ? src.length : e + 1; scope = 'top';
      }
      if (!r.binds.some((b) => b > lo && b < hi)) continue;
      const line = lineAt(src, s.start);
      candidates.push({ site: `${rel}:${line}`, file: rel, line, kinds: k.size, scope });
    }
  }
  return { candidates, unbalanced };
}

// R3 — 후보 자리 ↔ 표의 자리(손 명부 닻 ∪ NOT_BIND 닻). unaccounted = 표에 없는 후보 · stale = 후보가 아닌 표 자리.
function reconcile(candidates, entries, sources) {
  const want = new Map();
  const stale = [];
  for (const e of entries) {
    const at = locate(sources.get(e.file), e.anchor);
    if (!at) { stale.push(`${e.label}(닻 못 찾음)`); continue; }
    want.set(`${e.file}:${at.line}`, e.label);
  }
  const have = new Set(candidates.map((c) => c.site));
  for (const [site, label] of want) if (!have.has(site)) stale.push(`${label}(${site} 은 후보가 아님)`);
  const unaccounted = sorted(candidates.map((c) => c.site).filter((s) => !want.has(s)));
  return { unaccounted, stale: sorted(stale) };
}

// 잠금 시험 글자 → FROZEN 의 { file, anchor, occurrence, start, end } (한 줄 한 칸 꼴).
function parseFrozen(lockText) {
  const a = lockText.indexOf('const FROZEN = {');
  if (a < 0) return [];
  // C1b: 끝을 꼬리 문자열로 찾던 것을 sliceBlock(균형괄호)으로 바꿈 — C1 unit 에서 SB-16 이 이 파일을 짚었다
  const body = sliceBlock(lockText, 'const FROZEN = {', 'block-bind-lists-ruler parseFrozen');
  const out = [];
  const re = /file:\s*'([^']+)'\s*,\s*anchor:\s*("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')([^\n]*)/g;
  for (const m of body.matchAll(re)) {
    const lit = m[2];
    const anchor = lit[0] === '"' ? JSON.parse(lit) : lit.slice(1, -1).replace(/\\(.)/g, '$1');
    const occ = /occurrence:\s*(\d+)/.exec(m[3]);
    out.push({ file: m[1], anchor, occurrence: occ ? Number(occ[1]) : 0, start: a + m.index, end: a + m.index + m[0].length });
  }
  return out;
}

// R4 — 손 명부 중 FROZEN 이 안 덮는 이름(같은 파일 · 닻이 같은 줄로 풀리면 덮음).
function lockUncovered(lockText, sources, hands) {
  const frozen = new Set();
  for (const f of parseFrozen(lockText)) {
    const at = locate(sources.get(f.file), f.anchor, f.occurrence);
    if (at) frozen.add(`${f.file}:${at.line}`);
  }
  const out = [];
  for (const h of hands) {
    const at = locate(sources.get(h.file), h.anchor);
    if (!at || !frozen.has(`${h.file}:${at.line}`)) out.push(h.name);
  }
  return sorted(out);
}

// R5 — 표식 bind-list:<이름> 이 그 명부 줄에 없는 이름.
function markerMissing(sources, lists) {
  const out = [];
  for (const l of lists) {
    const at = locate(sources.get(l.file), l.anchor);
    const re = new RegExp('bind-list:' + l.name + '(?![A-Za-z0-9_])');
    if (!at || !re.test(at.text)) out.push(l.name);
  }
  return sorted(out);
}

// ── 레포 읽기 (한 번) ─────────────────────────────────────────────────────────────

function walkJs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walkJs(f, out); }
    else if (/\.(?:js|mjs|cjs)$/.test(e.name)) out.push(f);
  }
  return out;
}
const SOURCES = new Map(walkJs(path.join(REPO, 'js')).map((f) => [path.relative(REPO, f).split(path.sep).join('/'), fs.readFileSync(f, 'utf8')]));
const LOCK = fs.readFileSync(path.join(REPO, LOCK_REL), 'utf8');
const CANON = LISTS.find((l) => l.name === 'CANON');
const HANDS = LISTS.filter((l) => l.name !== 'CANON');
// R3 은 CANON 을 안 맞춘다 — 정본은 '…-block' 배열이지 .xxx-block 셀렉터 문자열이 아니고 bindBlock 을 부르는 함수 안에 있지도 않다.
const ENTRIES = [...HANDS.map((l) => ({ label: l.name, file: l.file, anchor: l.anchor })),
  ...NOT_BIND.map((x) => ({ label: `NOT_BIND ${x.file}`, file: x.file, anchor: x.anchor }))];
const fmtCands = (cs) => cs.map((c) => `  ${c.site} (${c.kinds}종 · ${c.scope})`).join('\n');

// ── 자 ───────────────────────────────────────────────────────────────────────────

test('R0 정의표 무결 — 이름 하나씩 · 칸 다 있음 · K_BIND 와 OWN_BINDER 안 겹침 · 닻 한 번 · js 가 정의표를 안 읽음', () => {
  assert.equal(new Set(K_BIND).size, K_BIND.length, 'K_BIND 에 겹친 종류');
  assert.equal(K_BIND.length, 31, `K_BIND ${K_BIND.length} 종(정본 30 + radial 1 = 31 이어야)`);
  assert.deepEqual(K_BIND.filter((k) => OWN_BINDER.includes(k)), [], 'K_BIND ∩ OWN_BINDER ≠ ∅');
  const names = LISTS.map((l) => l.name);
  assert.equal(new Set(names).size, names.length, `명부 이름 겹침 ${JSON.stringify(names)}`);
  assert.equal(LISTS.length, 8, `명부 ${LISTS.length} 곳(8 이어야)`);
  const FIELDS = ['name', 'file', 'anchor', 'event', 'meaning', 'mustContain', 'mustNot', 'knownGaps', 'allowedExtra'];
  for (const l of LISTS) {
    for (const f of FIELDS) assert.ok(l[f] !== undefined && l[f] !== null && l[f] !== '', `${l.name}: 칸 ${f} 비었음`);
    assert.ok(l.mustContain === 'K_BIND' || Array.isArray(l.mustContain), `${l.name}: mustContain 꼴`);
    const must = mustOf(l);
    assert.deepEqual(minus(Object.keys(l.knownGaps), must), [], `${l.name}: knownGaps 가 mustContain 밖`);
    assert.deepEqual(Object.keys(l.allowedExtra).filter((k) => must.includes(k)), [], `${l.name}: allowedExtra 가 mustContain 안`);
    assert.deepEqual(l.mustNot.filter((k) => must.includes(k)), [], `${l.name}: mustNot ∩ mustContain ≠ ∅`);
    for (const [k, why] of [...Object.entries(l.knownGaps), ...Object.entries(l.allowedExtra)]) assert.ok(typeof why === 'string' && why.trim(), `${l.name}: ${k} 까닭 없음`);
    const src = SOURCES.get(l.file);
    assert.ok(src, `${l.name}: 파일 ${l.file} 없음`);
    assert.equal(occurrences(src, l.anchor).length, 1, `${l.name}: 닻이 ${l.file} 에 정확히 한 번이 아님`);
  }
  assert.deepEqual(Object.keys(CANON.knownGaps), [], 'CANON 의 knownGaps 는 비어야 한다(정본 빠짐은 결함이지 알려진 빠짐이 아님)');
  for (const x of NOT_BIND) {
    assert.ok(x.reason && x.reason.trim(), `NOT_BIND ${x.file}: 까닭 없음`);
    assert.equal(occurrences(SOURCES.get(x.file) || '', x.anchor).length, 1, `NOT_BIND ${x.file}: 닻이 정확히 한 번이 아님`);
  }
  const importers = [...SOURCES.entries()].filter(([, s]) => s.includes('_block-bind-lists-def')).map(([r]) => r);
  assert.deepEqual(importers, [], `제품 코드가 정의표를 읽는다: ${JSON.stringify(importers)}`);
});

test('R1 CANON 이 K_BIND 와 양방향으로 같다(빠짐 = [] · 더함 = [] · 제 바인더 0)', () => {
  const r = canonDiff(SOURCES.get(CANON.file));
  assert.ok(r, 'CANON 명부(BLOCK_BIND_KINDS)를 못 찾았다');
  assert.deepEqual(r.dup, [], `CANON 겹친 종류 ${JSON.stringify(r.dup)}`);
  assert.deepEqual(r.own, [], `CANON 에 제 바인더 종류 ${JSON.stringify(r.own)}`);
  assert.deepEqual({ missing: r.missing, extra: r.extra }, { missing: [], extra: [] },
    `CANON ${r.size} 종 · K_BIND ${K_BIND.length} 종 — 빠짐 ${JSON.stringify(r.missing)} · 더함 ${JSON.stringify(r.extra)}`);
});

for (const list of HANDS) {
  test(`R2 ${list.name} 손 명부 차집합이 정의표와 같다(${list.file})`, () => {
    const r = handDiff(SOURCES.get(list.file), list);
    assert.ok(r, `${list.name}: 명부 줄을 못 찾았다(닻 «${list.anchor.slice(0, 50)}»)`);
    const msg = `${list.name} ${r.size} 종 — 새로 빠짐 ${JSON.stringify(r.newMissing)} · 채워짐(표를 줄여라) ${JSON.stringify(r.filled)}`
      + ` · 뜻밖의 더함 ${JSON.stringify(r.unexpectedExtra)} · 사라진 더함(표를 줄여라) ${JSON.stringify(r.vanishedExtra)}`
      + ` · 들면 안 되는 종류 ${JSON.stringify(r.forbidden)}`;
    assert.deepEqual(r.missing, sorted(Object.keys(list.knownGaps)), msg);
    assert.deepEqual(r.extra, sorted(Object.keys(list.allowedExtra)), msg);
    assert.deepEqual(r.forbidden, [], msg);
  });
}

test('R3 목록 맞추기 — 명부 꼴 자리(10종 이상 · 둘러싼 함수가 bindBlock 부름) = 손 명부 7곳 + NOT_BIND', () => {
  const { candidates, unbalanced } = inventory(SOURCES);
  const r = reconcile(candidates, ENTRIES, SOURCES);
  const msg = `후보 ${candidates.length} 곳:\n${fmtCands(candidates)}\n표에 없는 후보 ${JSON.stringify(r.unaccounted)} · 후보가 아닌 표 자리 ${JSON.stringify(r.stale)} · 훑개 짝 안 맞음 ${JSON.stringify(unbalanced)}`;
  assert.deepEqual(unbalanced, [], msg);
  assert.deepEqual({ unaccounted: r.unaccounted, stale: r.stale }, { unaccounted: [], stale: [] }, msg);
});

test('R4 잠금 시험 FROZEN 이 손 명부 7곳을 다 덮는다', () => {
  const frozen = parseFrozen(LOCK);
  assert.ok(frozen.length > 0, `${LOCK_REL} 에서 FROZEN 칸을 하나도 못 읽었다(자가 죽었다)`);
  const un = lockUncovered(LOCK, SOURCES, HANDS);
  assert.deepEqual(un, [], `FROZEN ${frozen.length} 칸 — 안 덮인 손 명부 ${JSON.stringify(un.map((n) => { const h = HANDS.find((x) => x.name === n); const at = locate(SOURCES.get(h.file), h.anchor); return `${n} ${h.file}:${at ? at.line : '?'}`; }))}`);
});

test('R5 명부 8자리마다 bind-list 표식이 그 줄에 있다', () => {
  const miss = markerMissing(SOURCES, LISTS);
  assert.deepEqual(miss, [], `표식 없는 자리 ${JSON.stringify(miss.map((n) => { const l = LISTS.find((x) => x.name === n); const at = locate(SOURCES.get(l.file), l.anchor); return `${n} ${l.file}:${at ? at.line : '?'}`; }))}`);
});

test('R6 음성대조 4 — 글자를 일부러 깨면 자 함수가 그 자리를 짚는다(메모리 안 · 파일 쓰기 0)', () => {
  // ⒜ 정본에서 'text-block', 을 뺀다 → R1 함수가 text-block 빠짐을 짚는다.
  const canonSrc = SOURCES.get(CANON.file);
  const canonMut = canonSrc.replace("'text-block',", '');
  assert.notEqual(canonMut, canonSrc, '⒜ 변이가 안 꽂혔다');
  assert.deepEqual(minus(canonDiff(canonMut).missing, canonDiff(canonSrc).missing), ['text-block'], '⒜ R1 함수가 text-block 빠짐을 못 짚었다');

  // ⒝ 정의표 사본에서 DUP_ABS 를 뺀다 → R3 함수가 그 자리(js/editor.js:<그 줄>)를 «표에 없는 후보»로 짚는다.
  const dup = HANDS.find((l) => l.name === 'DUP_ABS');
  const dupAt = locate(SOURCES.get(dup.file), dup.anchor);
  assert.ok(dupAt, '⒝ DUP_ABS 닻을 못 찾았다');
  const entriesMut = ENTRIES.filter((e) => e.label !== 'DUP_ABS');
  assert.equal(entriesMut.length, ENTRIES.length - 1, '⒝ 변이가 안 꽂혔다');
  const { candidates } = inventory(SOURCES);
  assert.deepEqual(minus(reconcile(candidates, entriesMut, SOURCES).unaccounted, reconcile(candidates, ENTRIES, SOURCES).unaccounted),
    [`${dup.file}:${dupAt.line}`], `⒝ R3 함수가 ${dup.file}:${dupAt.line} 을 못 짚었다\n${fmtCands(candidates)}`);

  // ⒞ DUP_ABS 줄에서 .text-block, 을 뺀다 → R2 함수가 text-block «새로 빠짐»을 짚는다.
  const edSrc = SOURCES.get(dup.file);
  const lineEnd = edSrc.indexOf('\n', dupAt.idx);
  const edMut = edSrc.slice(0, dupAt.idx) + edSrc.slice(dupAt.idx, lineEnd).replace('.text-block, ', '') + edSrc.slice(lineEnd);
  assert.notEqual(edMut, edSrc, '⒞ 변이가 안 꽂혔다');
  assert.deepEqual(minus(handDiff(edMut, dup).newMissing, handDiff(edSrc, dup).newMissing), ['text-block'], '⒞ R2 함수가 text-block 새로 빠짐을 못 짚었다');

  // ⒟ 잠금 시험 글자에서 DUP_ABS 닻을 뺀다 → R4 함수가 DUP_ABS 를 짚는다.
  //   바닥에는 FROZEN 에 DUP_ABS 가 없으므로 먼저 합성 칸을 하나 꽂아 «덮임»을 만든 뒤(양성 확인), DUP_ABS 로 풀리는 칸을 전부 걷는다.
  const at = LOCK.indexOf('const FROZEN = {\n');
  assert.ok(at >= 0, '⒟ FROZEN 머리를 못 찾았다');
  const head = at + 'const FROZEN = {\n'.length;
  const synth = `  'synthetic DUP_ABS': { file: '${dup.file}', anchor: ${JSON.stringify(dup.anchor)}, gaps: {} },\n`;
  const lockWith = LOCK.slice(0, head) + synth + LOCK.slice(head);
  assert.ok(!lockUncovered(lockWith, SOURCES, HANDS).includes('DUP_ABS'), '⒟ 합성 칸을 꽂았는데도 DUP_ABS 가 안 덮였다(R4 함수가 칸을 못 읽는다)');
  const drop = parseFrozen(lockWith).filter((f) => { const a = locate(SOURCES.get(f.file), f.anchor, f.occurrence); return f.file === dup.file && a && a.line === dupAt.line; });
  let lockMut = lockWith;
  for (const f of [...drop].sort((x, y) => y.start - x.start)) lockMut = lockMut.slice(0, f.start) + lockMut.slice(f.end);
  assert.notEqual(lockMut, lockWith, '⒟ 변이가 안 꽂혔다');
  assert.ok(lockUncovered(lockMut, SOURCES, HANDS).includes('DUP_ABS'), '⒟ R4 함수가 DUP_ABS 를 못 짚었다');
});
