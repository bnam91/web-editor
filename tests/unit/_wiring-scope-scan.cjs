/* _wiring-scope-scan.cjs — ★198 «소스에서 떠 온 배선이 읽는 바깥 이름» ↔ «spec 이 new Function 에 넘기는 이름» 을 견주는 자.
 *   ★왜: 제품 함수가 이름을 하나 늘리면(a78196de GRID_NESTED_GAP) spec 의 scope 가 조용히 뒤처진다 — 그 갈래가 안 지나면 초록인 채 잠복한다.
 *   ★쓰기: node --expose-internals tests/unit/_wiring-scope-scan.cjs <spec>[=<글자 파일>] [...]  → JSON 한 줄(부르는 자리 = tests/unit/wiring-scope-names.test.mjs)
 *   ★값: 빠짐(window 에도 안 걸리는 이름) · 빠짐?(제품이 window 에 거는 이름 — 그 파일이 하네스에 실렸나는 이 자가 안 잰다) · 못 잼(까닭).
 *   ⛔못 잼은 0 이 아니다 — 안 잰 것이다. 부르는 쪽이 따로 찍는다.
 *   shortcut: 파서가 node 내장 acorn(--expose-internals)이다, devDependencies 에 파서가 들면 그쪽으로 바꾼다.
 *   shortcut: 블록 스코프를 함수 스코프로 뭉갠다 — 옆 블록에 같은 이름이 선언돼 있으면 놓친다(≥), 그런 빠짐이 나오면 블록별로 가른다. */
'use strict';
const fs = require('fs');
const path = require('path');
const Module = require('module');
const acorn = require('internal/deps/acorn/acorn/dist/acorn');

const REPO = path.join(__dirname, '..', '..');
const PARSE = { ecmaVersion: 'latest', allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true };
/* 페이지에 늘 있는 이름 — js 기본은 node 전역에서 받고 브라우저 쪽만 적는다. 어휘라 제품이 커져도 안 낡는다. */
const BROWSER = new Set(('window document navigator location history screen console self top parent localStorage sessionStorage indexedDB '
  + 'getComputedStyle getSelection matchMedia requestAnimationFrame cancelAnimationFrame requestIdleCallback cancelIdleCallback alert confirm prompt '
  + 'Image Node Element HTMLElement HTMLImageElement HTMLCanvasElement HTMLInputElement SVGElement Text Range Selection DOMParser XMLSerializer DOMRect '
  + 'Event CustomEvent MouseEvent KeyboardEvent PointerEvent WheelEvent DragEvent InputEvent FocusEvent ClipboardEvent DataTransfer '
  + 'MutationObserver ResizeObserver IntersectionObserver CSS CSSStyleSheet FileReader Blob File URL URLSearchParams fetch createImageBitmap OffscreenCanvas '
  + 'undefined NaN Infinity arguments').split(' '));
const isGlobal = (n) => BROWSER.has(n) || n in globalThis;

/** 패턴에서 묶이는 이름 */
function bound(p, out) {
  if (!p) return out;
  if (p.type === 'Identifier') out.add(p.name);
  else if (p.type === 'ObjectPattern') p.properties.forEach((x) => bound(x.type === 'RestElement' ? x.argument : x.value, out));
  else if (p.type === 'ArrayPattern') p.elements.forEach((x) => bound(x, out));
  else if (p.type === 'AssignmentPattern') bound(p.left, out);
  else if (p.type === 'RestElement') bound(p.argument, out);
  return out;
}
const isFn = (n) => /^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(n.type);
const kids = (n) => Object.entries(n).filter(([k, v]) => k !== '$p' && v && typeof v === 'object');
function each(n, f) {
  for (const [k, v] of kids(n)) {
    if (Array.isArray(v)) { for (const c of v) if (c && c.type) f(c, k, n); } else if (v.type) f(v, k, n);
  }
}
/** 함수 스코프 하나에 선언된 이름(안쪽 함수 몸은 안 내려간다) */
function declared(root, out = new Set()) {
  each(root, (c) => {
    if (c.type === 'VariableDeclaration') c.declarations.forEach((d) => bound(d.id, out));
    if ((c.type === 'FunctionDeclaration' || c.type === 'ClassDeclaration') && c.id) out.add(c.id.name);
    if (c.type === 'CatchClause') bound(c.param, out);
    if (!isFn(c)) declared(c, out);
  });
  return out;
}
/** 바깥에서 읽는 이름 — typeof X 는 없어도 안 죽으므로 안 센다 */
function freeNames(ast) {
  const free = new Set();
  const visit = (n, scopes, key, parent) => {
    if (n.type === 'Identifier') {
      if (parent && parent.type === 'UnaryExpression' && parent.operator === 'typeof') return;
      if (!scopes.some((s) => s.has(n.name))) free.add(n.name);
      return;
    }
    if (isFn(n)) {
      const s = new Set(['arguments']);
      n.params.forEach((p) => bound(p, s));
      if (n.id) s.add(n.id.name);
      declared(n.body, s);
      const inner = [...scopes, s];
      n.params.forEach((p) => visit(p, inner));
      visit(n.body, inner);
      return;
    }
    if (n.type === 'ClassExpression' && n.id) scopes = [...scopes, new Set([n.id.name])];
    each(n, (c, k) => {
      if (c.type === 'Identifier') {
        if ((n.type === 'MemberExpression' && k === 'property' && !n.computed)
          || ((n.type === 'Property' || n.type === 'MethodDefinition' || n.type === 'PropertyDefinition') && k === 'key' && !n.computed)
          || /^(LabeledStatement|BreakStatement|ContinueStatement|MetaProperty)$/.test(n.type)) return;
      }
      visit(c, scopes, k, n);
    });
  };
  const top = declared(ast);
  visit(ast, [top]);
  return free;
}

/** 부모 고리를 달아 준다 */
function link(n, p) { n.$p = p; each(n, (c) => link(c, n)); }
function walk(n, f) { f(n); each(n, (c) => walk(c, f)); }
const chain = (n) => { const a = []; for (let p = n.$p; p; p = p.$p) a.push(p); return a; };

/** spec 윗단을 playwright 없이 돌려 윗단 const 를 읽는 눈을 얻는다(test 몸은 안 돈다). 못 돌면 null */
function topEval(file, src) {
  const stub = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : stub), apply: () => stub, construct: () => stub });
  const load = Module._load;
  Module._load = function (req, ...r) { return /playwright/.test(req) ? { test: stub, expect: stub, chromium: stub, devices: {} } : load.call(this, req, ...r); };
  try {
    const m = new Module(file, module);
    m.filename = file;
    m.paths = Module._nodeModulePaths(path.dirname(file));
    m._compile(`${src}\n;module.exports.__ev = (s) => eval(s);`, file);
    return m.exports.__ev;
  } catch { return null; } finally { Module._load = load; }
}

/** 소스 식 → 글자. 못 풀면 throw(까닭) */
function resolver(src, ev) {
  const text = (n) => src.slice(n.start, n.end);
  const findInit = (name, at) => {
    for (const a of chain(at)) {
      if (!(isFn(a) || a.type === 'Program' || a.type === 'BlockStatement')) continue;
      let hit = null;
      each(a.body && a.body.type === 'BlockStatement' ? a.body : a, (c) => {
        if (c.type === 'VariableDeclaration') for (const d of c.declarations) if (d.id.name === name && d.init) hit = d.init;
      });
      if (hit) return hit;
    }
    return null;
  };
  /* evaluate 콜백의 인자면 → 넘긴 식으로 바꾼다 */
  const throughArg = (name, at) => {
    for (const a of chain(at)) {
      if (!isFn(a) || a.$p.type !== 'CallExpression' || !/evaluate(Handle)?$/.test(text(a.$p.callee)) || a.$p.arguments[0] !== a) continue;
      const p = a.params[0], arg = a.$p.arguments[1];
      if (!p || !arg) return null;
      if (p.type === 'Identifier') return p.name === name ? arg : null;
      if (p.type === 'ArrayPattern' && arg.type === 'ArrayExpression') { const i = p.elements.findIndex((x) => x && x.name === name); return i >= 0 ? arg.elements[i] : null; }
      if (p.type === 'ObjectPattern' && arg.type === 'ObjectExpression') {
        const q = p.properties.find((x) => x.value && x.value.name === name);
        const v = q && arg.properties.find((x) => x.key && (x.key.name || x.key.value) === (q.key.name || q.key.value));
        return v ? v.value : null;
      }
      return null;
    }
    return null;
  };
  const go = (n, depth = 0) => {
    if (depth > 8) throw new Error('너무 깊다');
    if (n.type === 'Literal') return String(n.value);
    if (n.type === 'TemplateLiteral') return n.quasis.map((q, i) => q.value.cooked + (n.expressions[i] ? go(n.expressions[i], depth + 1) : '')).join('');
    if (n.type === 'BinaryExpression' && n.operator === '+') return go(n.left, depth + 1) + go(n.right, depth + 1);
    if (n.type === 'Identifier') {
      const arg = throughArg(n.name, n);
      if (arg) return go(arg, depth + 1);
      const init = findInit(n.name, n);
      if (init) return go(init, depth + 1);
    }
    if (!ev) throw new Error('spec 윗단이 안 돈다');
    let v;
    try { v = ev(text(n)); } catch (e) { throw new Error(`식을 못 풀었다 ${text(n).slice(0, 40)}`); }
    if (typeof v !== 'string') throw new Error(`글자가 아니다 ${text(n).slice(0, 40)}`);
    return v;
  };
  return go;
}

/** new Function 앞 인자들 → 넘기는 이름. 못 정하면 null */
function givenNames(call, src) {
  const out = new Set();
  for (const a of call.arguments.slice(0, -1)) {
    if (a.type === 'Literal' && typeof a.value === 'string') { a.value.split(',').forEach((x) => out.add(x.trim())); continue; }
    if (a.type !== 'SpreadElement') return null;
    const name = src.slice(a.argument.start, a.argument.end);
    let scopeObj = null;
    for (const p of chain(call)) {
      if (p.type !== 'BlockStatement') continue;
      walk(p, (d) => {
        if (scopeObj || d.type !== 'VariableDeclarator' || !d.id.name || !d.init) return;
        const m = d.id.name === name && /^Object\.keys\((\w+)\)$/.exec(src.slice(d.init.start, d.init.end));
        if (!m) return;
        walk(p, (e) => { if (e.type === 'VariableDeclarator' && e.id.name === m[1] && e.init && e.init.type === 'ObjectExpression') scopeObj = e.init; });
      });
      if (scopeObj) break;
    }
    if (!scopeObj || scopeObj.properties.some((x) => x.type !== 'Property' || x.computed)) return null;
    scopeObj.properties.forEach((x) => out.add(x.key.name || String(x.key.value)));
  }
  return out;
}

/** 제품이 window 에 거는 이름 전부 */
function productWindowNames() {
  const out = new Set();
  const rec = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) rec(p);
      else if (e.name.endsWith('.js')) for (const m of fs.readFileSync(p, 'utf8').matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) out.add(m[1]);
    }
  };
  rec(path.join(REPO, 'js'));
  return out;
}

/** spec 글자 하나 → new Function 자리마다 값. evalTop 은 시험에서 갈아 끼운다 */
function scan(src, { file = 'x', evalTop, productWindow = new Set() } = {}) {
  const ast = acorn.parse(src, PARSE);
  link(ast, null);
  const ev = evalTop !== undefined ? evalTop : topEval(file, src);
  const resolve = resolver(src, ev);
  const onWindow = new Set([...src.matchAll(/\b(?:window|globalThis)\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)].map((m) => m[1]));
  const rows = [];
  walk(ast, (n) => {
    if (!(n.type === 'NewExpression' && n.callee.name === 'Function') || !n.arguments.length) return;
    const row = { line: acorn.getLineInfo(src, n.start).line };
    rows.push(row);
    const given = givenNames(n, src);
    if (!given) { row.unmeasured = '넘기는 이름을 못 정했다'; return; }
    let body;
    try { body = resolve(n.arguments[n.arguments.length - 1]); } catch (e) { row.unmeasured = e.message; return; }
    let free;
    try { free = freeNames(acorn.parse(body, PARSE)); } catch (e) { row.unmeasured = `떠 온 글자가 안 읽힌다 ${e.message}`; return; }
    const out = [...free].filter((x) => !given.has(x) && !onWindow.has(x) && !isGlobal(x));
    row.missing = out.filter((x) => !productWindow.has(x)).sort();
    row.maybe = out.filter((x) => productWindow.has(x)).sort();
    row.given = given.size;
  });
  return rows;
}

if (require.main === module) {
  const productWindow = productWindowNames();
  const res = {};
  for (const arg of process.argv.slice(2)) {
    const [f, text = f] = arg.split('=');   // <spec>=<글자 파일> — spec 자리는 그대로 두고 글자만 갈아 잰다(시험의 변이 사본)
    const abs = path.resolve(f);
    try { res[f] = scan(fs.readFileSync(text, 'utf8'), { file: abs, productWindow }); } catch (e) { res[f] = [{ line: 0, unmeasured: `spec 이 안 읽힌다 ${e.message}` }]; }
  }
  process.stdout.write(`${JSON.stringify(res)}\n`);
}
module.exports = { scan, freeNames, PARSE, acorn };
