/* css-token-a-stage.cjs — CSS 토큰 통일 A단계(새 토큰 0)의 «한 자». PLAN-css-token-unify-261118 §2·§5.
 *   쓰는 곳: tests/unit/css-token-static-proof.test.mjs(정적증명) · tests/dom/_css-token-parity.js(후보·덮은 선언 셈).
 *   CLI: node scripts/css-token-a-stage.cjs <base-sha>  → 정적증명 n/n · 실패 줄 · 파일별 후보 수
 *
 * A단계 토큰 = 아래 A_TOKENS 명부만(값은 :root 에서 읽는다 — 손으로 안 적는다).
 *   ⛔테마 토큰(js/theme-system.js applyTheme 이 런타임에 덮는 것)은 명부에 없고, 있더라도 RUNTIME 검사가 빨강을 낸다.
 *   ⛔토큰은 «역할이 같은 속성»에만: fs=font-size · fw=font-weight · space=margin/padding/gap · border류=border/outline · text류=color.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const SPACE_PROPS = /^(margin|padding)(-[a-z-]+)?$|^(row-|column-)?gap$/;
const BORDER_PROPS = /^(border|outline)(-[a-z-]+)?$/;
const TEXT_PROPS = /^(color|fill|stroke|caret-color)$/;
const ANY_PROPS = /^[a-z-]+$/;
/** [토큰 이름 정규식, 허용 속성 정규식] — 명부 밖 토큰은 A단계에서 못 쓴다. */
const A_TOKENS = [
  [/^--ui-fw-(medium|semibold|bold)$/, /^font-weight$/],
  [/^--ui-fs-(\d+|base)$/, /^font-size$/],
  [/^--ui-space-\d+(_5)?$/, SPACE_PROPS],   // _5 = 반 칸(0_5=2px · 1_5=6px · 2_5=10px · 현빈 결정 ⑤ 261119)
  [/^--ui-(border-mid|border-soft|border-strong|divider)$/, BORDER_PROPS],
  [/^--ui-(text-sub|text-muted)$/, TEXT_PROPS],
  [/^--ui-(danger|accent-primary-hover)$/, ANY_PROPS],
];
const tokenRule = (name) => (A_TOKENS.find(([re]) => re.test(name)) || [])[1] || null;

/** 표기만 다른 같은 값을 하나로(⒜): 소문자 · 공백 · #abc→#aabbcc · #rrggbbff→#rrggbb · rgb(a=1)→hex · 알파 %g. */
function normColor(v) {
  v = v.toLowerCase().replace(/\s+/g, '');
  if (/^#[0-9a-f]{3}$/.test(v)) v = '#' + [...v.slice(1)].map((c) => c + c).join('');
  if (/^#[0-9a-f]{8}$/.test(v) && v.endsWith('ff')) v = v.slice(0, 7);
  const m = v.match(/^rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)$/);
  if (m) {
    const [r, g, b, a] = m.slice(1);
    if (a === undefined || +a === 1) return '#' + [r, g, b].map((x) => (+x).toString(16).padStart(2, '0')).join('');
    return `rgba(${r},${g},${b},${+a})`;
  }
  return v;
}
const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;
const IS_COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))$/;
const normText = (s) => s.replace(COLOR_RE, normColor).replace(/\s+/g, ' ').trim();

const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));

/** :root 커스텀 속성 값(주석 뺌 · var 사슬 풀이) + «:root 밖에서 다시 정의된» 이름 목록. */
function rootValues(cssTexts) {
  const raw = {}; const scoped = new Set();
  for (const t of cssTexts) {
    const s = stripComments(t);
    for (const m of s.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const isRoot = /(^|[\s,;}])(:root|html)\s*$/.test(m[1].trim()) || m[1].trim().endsWith(':root');
      for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) {
        if (isRoot) raw[d[1]] = d[2].trim(); else scoped.add(d[1]);
      }
    }
  }
  const val = (n, depth = 0) => {
    const v = raw[n]; if (v === undefined || depth > 10) return undefined;
    return v.replace(/var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)/g, (all, x) => val(x, depth + 1) ?? all);
  };
  const out = {}; for (const n of Object.keys(raw)) out[n] = val(n);
  return { values: out, scoped };
}

/** 런타임에 :root 를 덮는 이름(정확한 이름 + 접두사) — js 의 setProperty('--x' …) / setProperty('--x-' + …). */
function runtimeOverrides(jsTexts) {
  const names = new Set(); const prefixes = new Set();
  for (const t of jsTexts) {
    for (const m of t.matchAll(/setProperty\(\s*['"`](--[\w-]+)['"`]\s*([,+])/g)) (m[2] === '+' ? prefixes : names).add(m[1]);
  }
  return { names, prefixes };
}
const isRuntime = (n, rt) => rt.names.has(n) || [...rt.prefixes].some((p) => n.startsWith(p));

/** 한 줄의 선언들: [{prop, value}] — `a{color:#aaa;padding:4px}` 같은 한 줄 여러 선언도. */
function declsOfLine(line) {
  const s = stripComments(line);
  return [...s.matchAll(/(?:^|[{;\s])([a-z-]+)\s*:\s*([^;{}]*)/g)].filter((m) => !m[1].startsWith('--')).map((m) => ({ prop: m[1], value: m[2] }));
}

/** 정적증명 한 쌍: 지운 줄 → 넣은 줄. ok=false 면 why 에 사유. */
function proofPair(removed, added, ctx) {
  if (/^\s*--[\w-]+\s*:/.test(added)) return { ok: false, why: '정의 줄 변경 — A단계는 정의를 안 고친다' };
  const uses = [];
  for (const d of declsOfLine(added)) for (const m of d.value.matchAll(/var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)/g)) uses.push({ prop: d.prop, name: m[1] });
  const before = (removed.match(/var\(\s*--[\w-]+/g) || []).length;
  if (uses.length <= before) return { ok: false, why: '토큰 교체가 아닌 변경(새 var 없음)' };
  for (const u of uses) {
    if (removed.includes(`var(${u.name}`)) continue;   // 원래 있던 var 는 그대로
    if (isRuntime(u.name, ctx.runtime)) return { ok: false, why: `${u.name} = 런타임 덮어쓰기(테마) 토큰` };
    const rule = tokenRule(u.name);
    if (!rule) return { ok: false, why: `${u.name} = A단계 명부 밖 토큰` };
    if (!rule.test(u.prop)) return { ok: false, why: `${u.name} 를 ${u.prop} 에 씀 — 역할 다름` };
    if (ctx.scoped.has(u.name)) return { ok: false, why: `${u.name} 가 :root 밖에서 다시 정의됨` };
    if (ctx.values[u.name] === undefined) return { ok: false, why: `${u.name} :root 정의 없음` };
  }
  const sub = added.replace(/var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)/g, (all, n) => (removed.includes(all) ? all : ctx.values[n] ?? all));
  if (normText(sub) !== normText(removed)) return { ok: false, why: `치환하면 원문과 다름: «${normText(sub)}» ≠ «${normText(removed)}»` };
  return { ok: true };
}

/** 한 선언이 A단계 후보인가(리터럴이 역할 맞는 A 토큰의 :root 값과 같다) → 토큰 이름 목록. */
function candidatesOfDecl(prop, value, ctx) {
  const hits = [];
  const lits = [...(value.match(COLOR_RE) || []).map(normColor), ...(value.match(/(?<![\w.-])\d*\.?\d+px\b/g) || []), ...(/^\s*[1-9]00\s*$/.test(value) ? [value.trim()] : [])];
  for (const [name, v] of Object.entries(ctx.values)) {
    const rule = tokenRule(name);
    if (!rule || !rule.test(prop) || isRuntime(name, ctx.runtime) || ctx.scoped.has(name)) continue;
    const nv = IS_COLOR.test(v.trim()) ? normColor(v) : v.trim();
    if (lits.includes(nv)) hits.push(name);
  }
  return hits;
}

/** css 파일 하나: 줄 번호 → 그 줄이 속한 규칙의 선택자(@media 안도) · 주석 뺌. */
function selectorsByLine(text) {
  const s = stripComments(text); const out = []; const stack = []; let buf = ''; let line = 1;
  for (const ch of s) {
    if (ch === '{') { stack.push(buf.trim()); buf = ''; }
    else if (ch === '}') { stack.pop(); buf = ''; }
    else if (ch === ';') buf = '';
    else buf += ch;
    if (ch === '\n') { line++; }
    out[line] = stack.filter((x) => !x.startsWith('@')).pop() || null;
  }
  return out;
}

function git(root, ...a) { return cp.execFileSync('git', ['-C', root, ...a], { encoding: 'utf8', maxBuffer: 64 << 20 }); }
function listFiles(dir, ext) {
  const out = [];
  (function w(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) w(f); else if (f.endsWith(ext)) out.push(f); } })(dir);
  return out.sort();
}
/** 작업 트리(커밋 안 한 것 포함) 기준 맥락. */
function loadCtx(root) {
  const { values, scoped } = rootValues(listFiles(path.join(root, 'css'), '.css').map((f) => fs.readFileSync(f, 'utf8')));
  const runtime = runtimeOverrides(listFiles(path.join(root, 'js'), '.js').map((f) => fs.readFileSync(f, 'utf8')));
  return { values, scoped, runtime };
}

/** base 대비 css 변경을 쌍으로 맞춰 증명. 반환 {pairs:[{file,line,ok,why,removed,added}], unpaired:[…]} */
function proveDiff(root, base, ctx = loadCtx(root)) {
  const pairs = []; const unpaired = [];
  const files = git(root, 'diff', '--name-only', base, '--', 'css').split('\n').filter(Boolean);
  for (const f of files) {
    const d = git(root, 'diff', '-U0', '--no-color', base, '--', f).split('\n');
    let rem = []; let add = []; let at = 0;
    const flush = () => {
      if (rem.length !== add.length) unpaired.push({ file: f, line: at, why: `지운 ${rem.length}줄 ≠ 넣은 ${add.length}줄 — 교체만 허용` });
      else rem.forEach((r, i) => pairs.push({ file: f, line: at + i, removed: r, added: add[i], ...proofPair(r, add[i], ctx) }));
      rem = []; add = [];
    };
    for (const ln of d) {
      const h = ln.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
      if (h) { flush(); at = +h[1]; continue; }
      if (ln.startsWith('---') || ln.startsWith('+++')) continue;
      if (ln.startsWith('-')) rem.push(ln.slice(1)); else if (ln.startsWith('+')) add.push(ln.slice(1));
    }
    flush();
  }
  return { pairs, unpaired };
}

module.exports = { A_TOKENS, tokenRule, normColor, normText, rootValues, runtimeOverrides, isRuntime, declsOfLine, proofPair, candidatesOfDecl, selectorsByLine, loadCtx, proveDiff, listFiles };

if (require.main === module) {
  const root = path.join(__dirname, '..'); const base = process.argv[2];
  if (!base) { console.error('쓰기: node scripts/css-token-a-stage.cjs <base-sha>'); process.exit(2); }
  const ctx = loadCtx(root); const r = proveDiff(root, base, ctx);
  const ok = r.pairs.filter((p) => p.ok).length;
  console.log(`정적증명 ${ok}/${r.pairs.length} · 짝 안 맞는 덩이 ${r.unpaired.length}`);
  for (const p of r.pairs.filter((x) => !x.ok)) console.log(`  ✘ ${p.file}:${p.line} ${p.why}`);
  for (const u of r.unpaired) console.log(`  ✘ ${u.file}:${u.line} ${u.why}`);
  process.exit(ok === r.pairs.length && !r.unpaired.length ? 0 : 1);
}
