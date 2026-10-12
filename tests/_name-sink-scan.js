/* tests/_name-sink-scan.js — 「사용자가 붙인 «이름»이 HTML 문자열로 들어가는 자리」를 ★패턴으로★ 훑는 계측기.
 *
 * ★왜 이 파일이 따로 있나 (T-049 의 남은 축)
 *   같은 결의 결함이 「프로젝트·폴더 이름」에서는 막혔고 「레이어 이름」에서 다시 열렸다.
 *   ⇒ «자리 명부»를 손으로 적으면 새 자리가 생길 때마다 명부가 낡는다.
 *     여기서는 «이름이 화면에 닿는 모양»만 규칙으로 적고, 자리는 스스로 찾게 한다.
 *     새 prop 패널·새 패널 줄이 생겨도 규칙에 걸리면 자동으로 세어진다.
 *
 * 두 규칙을 «각각» 돌린다(하나로 합치지 않는다 — 한쪽이 놓쳐도 다른 쪽이 잡게).
 *   · 규칙 S(그리는 자리) — HTML 을 만드는 템플릿 문자열 안에서, class/id 토큰이
 *     `name` 으로 «끝나는» 요소의 «속살»에 박히는 삽입부.
 *     (이 코드베이스가 이름을 그릴 때 쓰는 모양: prop-block-name · layer-item-name ·
 *      card-name · ft-name · cvb-layer-name · anim-item-name …)
 *   · 규칙 P(가져온 곳) — 삽입식이 «데이터에서 이름을 읽는» 모양일 때.
 *     dataset.*Name / dataset.name / .xxxName / ._name / getAttribute('data-…name') / .name
 *     파일 안 지역 별칭(const displayName = block.dataset.layerName || …)은 3단계까지 따라간다.
 *
 * 판정 — 걸린 삽입부의 «이름 읽기»가 전부 이스케이프 함수 괄호 «안»이면 초록, 아니면 빨강.
 *   ⛔「esc 를 불렀다」로 끝내지 않는다 — 그 함수가 진짜로 꺾쇠를 실체참조로 바꾸는지
 *     verifyEscapers() 로 따로 잰다(이름만 esc 인 껍데기를 통과시키지 않으려고).
 *
 * ⚠️못 재는 축 / 알려진 한계
 *   · `.xxxName` 은 DOM 내장 속성(className/tagName/…)과 모양이 같다. 그래서 «언어·DOM 내장
 *     어휘»만 INTRINSIC 로 뺀다. 이건 «자리 명부»가 아니라 «어휘»라 제품이 커져도 낡지 않는다
 *     — 새 dataset.*Name 은 그대로 걸린다.
 *   · textContent/createTextNode 로 넣는 자리는 안 걸린다(그게 정답 모양이다).
 *   · 문자열을 다른 함수로 넘겨 조립하는 간접 경로는 못 따라간다.
 *   · map 콜백 인자(a.label 처럼)는 출처를 못 따라가서, «개발자 상수»여도 규칙 S 에 걸린다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
/* ★★주석을 ★걷고 시작한다 (2026-10-07) — ⛔이 모듈은 ★그동안 ★raw 를 훑었다.
 *  ★산 결함: `js/props/prop-grid.js` 의 ★템플릿 보간 ★안에 든 블록 주석을 ★코드로 읽어,
 *    한 보간식이 ★2927자까지 ★폭주해 ★패널 템플릿을 통째로 삼켰다. 그 안에 들어 있던
 *    ★검증된 안전 싱크(`blockHeaderHTML({ name: … })`)가 ★같이 먹혀서, X5 가 ★«안 닫힌 자리»
 *    ★1건으로 신고했다 — ★제품에는 ★이름 보간이 ★없었다.
 *  ★`templateAware` 를 켠다 — ⛔기본 모드는 ★보간 안 주석을 ★못 걷는다(그 한계가 이 결함이었다).
 *  ★줄번호가 ★그대로 사는 까닭 = 공용 거르개는 ★줄 수를 ★보존한다(내용만 비운다).
 *    ⇒ ★그래서 ★파일을 ★«통째로» 걷고 ★그 결과로 segment·offset 을 ★전부 다시 센다.
 *    ⛔한 segment 만 걷으면 ★offset 이 밀려 ★엉뚱한 줄을 가리킨다(글자 수는 ★안 보존된다).
 *  ⛔`templateBalanced` 를 ★«전제»로 걸어라 — 쓰는 쪽(name-axes-to-markup.test.mjs X0)이 건다. */
const { stripCommentsTA, templateBalanced } = require('./unit/_strip-comments.js');

const SOURCE_ROOTS = ['js', 'pages'];
const SOURCE_FILES_EXTRA = ['index.html'];
const EXTS = new Set(['.js', '.mjs', '.html']);

/* DOM/JS 내장 어휘 — 사용자가 붙이는 «이름»이 아니다. */
const INTRINSIC = new Set([
  'className', 'tagName', 'nodeName', 'localName', 'hostname', 'pathname',
  'fileName', 'filename', 'namespaceURI', 'nodeValue',
]);

const ESC_NAME = /(?:^|_)(?:esc|escape|escapeHtml|escHtml|sanitize|sanitise|htmlsafe)/i;

// ───────────────────────── 파일 모으기 ─────────────────────────
function sourceFiles(repo) {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (EXTS.has(path.extname(e.name))) out.push(path.relative(repo, p));
    }
  };
  for (const r of SOURCE_ROOTS) { const d = path.join(repo, r); if (fs.existsSync(d)) walk(d); }
  for (const f of SOURCE_FILES_EXTRA) if (fs.existsSync(path.join(repo, f))) out.push(f);
  return out.sort();
}

/* .html 은 <script> 안쪽만 본다(바깥 HTML 의 따옴표가 토크나이저를 어지럽히지 않게). */
function scriptSegments(repo, rel) {
  const raw = stripCommentsTA(fs.readFileSync(path.join(repo, rel), 'utf8'));
  if (!rel.endsWith('.html')) return [{ text: raw, offset: 0, rawSrc: raw }];
  const segs = [];
  const re = /<script\b[^>]*>/gi;
  let m;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('</script', start);
    if (end < 0) break;
    segs.push({ text: raw.slice(start, end), offset: start, rawSrc: raw });
    re.lastIndex = end;
  }
  return segs;
}

// ───────────────────────── 토크나이저 ─────────────────────────
/* `/` 가 나눗셈인지 정규식 시작인지. 정규식 안의 따옴표를 문자열로 읽으면
   삽입부 경계가 통째로 어긋난다(replace(/"/g, …) 한 줄이 파일 절반을 삼킨다). */
const REGEX_PREV = /[({[,;:=!&|?+\-*%^~<>]$/;
const REGEX_KEYWORD = /\b(?:return|typeof|instanceof|in|of|new|delete|void|case|do|else|yield|await)$/;
function regexAllowedAt(src, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(src[j])) j--;
  if (j < 0) return true;
  const head = src.slice(0, j + 1);
  return REGEX_PREV.test(head) || REGEX_KEYWORD.test(head);
}
function skipRegex(src, i) { // i = 여는 `/` → 닫는 `/`(+플래그) 다음
  i++; let inClass = false;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '\n') return i;          // 정규식이 아니었다 — 나눗셈으로 되돌림
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) { i++; while (i < src.length && /[a-z]/i.test(src[i])) i++; return i; }
    i++;
  }
  return i;
}
function skipQuoted(src, i) { const q = src[i]; i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; } return i + 1; }

function skipTemplate(src, i) { // i = 여는 백틱 → 닫는 백틱 «다음» 인덱스
  i++; let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (depth === 0 && c === '`') return i + 1;
    if (c === '$' && src[i + 1] === '{') { depth++; i += 2; continue; }
    if (depth > 0) {
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '`') { i = skipTemplate(src, i); continue; }
      else if (c === '"' || c === "'") { i = skipQuoted(src, i); continue; }
      else if (c === '/' && regexAllowedAt(src, i)) { i = skipRegex(src, i); continue; }
    }
    i++;
  }
  return i;
}

function templateLiterals(src) {
  const out = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '/' && src[i + 1] === '/') { const n = src.indexOf('\n', i); i = n < 0 ? src.length : n; continue; }
    if (c === '/' && src[i + 1] === '*') { const n = src.indexOf('*/', i); i = n < 0 ? src.length : n + 2; continue; }
    if (c === '/' && regexAllowedAt(src, i)) { i = skipRegex(src, i); continue; }
    if (c === '"' || c === "'") { i = skipQuoted(src, i); continue; }
    if (c === '`') { const end = skipTemplate(src, i); out.push({ start: i, text: src.slice(i, end) }); i = end; continue; }
    i++;
  }
  return out;
}

/* 리터럴 «자기» 층의 ${ … } 만. 안쪽 중첩 템플릿은 templateLiterals 가 따로 잡는다. */
function interpolations(lit) {
  const out = []; let i = 1;
  while (i < lit.length - 1) {
    if (lit[i] === '\\') { i += 2; continue; }
    if (lit[i] === '$' && lit[i + 1] === '{') {
      const open = i + 2; let depth = 1; let j = open;
      while (j < lit.length) {
        const c = lit[j];
        if (c === '\\') { j += 2; continue; }
        if (c === '`') { j = skipTemplate(lit, j); continue; }
        if (c === '"' || c === "'") { j = skipQuoted(lit, j); continue; }
        if (c === '/' && regexAllowedAt(lit, j)) { j = skipRegex(lit, j); continue; }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) break; }
        j++;
      }
      /* ★`unterminated` — ★닫는 중괄호를 ★못 찾고 ★리터럴 끝까지 간 경우.
         ★이게 ★«폭주»의 ★정체다: 그 보간식은 ★제 경계를 잃고 ★뒤를 통째로 삼킨다.
         ⛔길이로는 ★못 가른다(실측 2026-10-07: 정상 중 최장 ★3478자 > 폭주 ★2927자). */
      out.push({ start: i, expr: lit.slice(open, j), unterminated: j >= lit.length });
      i = j + 1; continue;
    }
    i++;
  }
  return out;
}

/** 식 안의 중첩 템플릿 리터럴만 «길이를 지켜» 지운다(안쪽은 따로 훑으므로). */
function maskNestedLiterals(text) {
  let out = text;
  for (const l of templateLiterals(text)) {
    const n = l.text.length;
    out = out.slice(0, l.start) + ' '.repeat(n) + out.slice(l.start + n);
  }
  return out;
}

// ───────────────────────── 규칙 S — 「이름을 그리는 자리」 ─────────────────────────
const VOID_TAGS = /^(?:input|img|br|hr|meta|link|source|area|base|col|embed|param|track|wbr)$/i;
function nameSinkRanges(lit) {
  const out = [];
  const re = /<([a-zA-Z][\w-]*)([^<>]*)\bclass\s*=\s*"([^"]*)"([^<>]*)>/g;
  let m;
  while ((m = re.exec(lit))) {
    if (VOID_TAGS.test(m[1])) continue;                              // <input> 은 닫는 태그가 없다
    if (!m[3].split(/\s+/).some(t => /(?:^|[-_])name$/i.test(t))) continue;
    const gt = m.index + m[0].length;
    /* 속살은 «다음 태그가 열리기 전»까지만 본다 — 닫는 태그를 못 찾아 뒤쪽을
       통째로 삼키면(void 태그·중첩) 엉뚱한 삽입부가 이름 자리로 둔갑한다. */
    const next = lit.indexOf('<', gt);
    out.push([gt, next < 0 ? lit.length : next]);
  }
  return out;
}

// ───────────────────────── 규칙 P — 「이름을 읽어 온 곳」 ─────────────────────────
const NAME_READ_RE = /\bdataset\s*\.\s*([A-Za-z0-9_$]*[Nn]ame)\b|\.\s*(_?[A-Za-z0-9_$]*[Nn]ame)\b|\bgetAttribute\s*\(\s*['"](data-[a-z0-9-]*name)['"]/g;

function nameReads(expr) {
  const out = []; NAME_READ_RE.lastIndex = 0;
  let m;
  while ((m = NAME_READ_RE.exec(expr))) {
    const ident = m[1] || m[2] || m[3];
    if (m[2] && INTRINSIC.has(ident)) continue;      // 내장 어휘는 뺀다
    out.push({ start: m.index, end: m.index + m[0].length, ident });
  }
  return out;
}

/* 지역 별칭 따라가기 — const displayName = block.dataset.layerName || labels[type]; */
/* 같은 이름이 «다른 자리»에도 묶여 있으면(콜백 인자 등) 따라가지 않는다.
   파일 전체에서 이름만 보고 잇는 방식이라, 애매하면 «안 잇는» 쪽이 맞다. */
function ambiguouslyBound(tok, src) {
  return new RegExp(`(?:\\(|,)\\s*${tok}\\s*(?:,|\\)|=>)|\\b${tok}\\s*=>`).test(src);
}
/* 같은 이름의 선언이 여러 개면 «삽입부 바로 위»의 것을 쓴다.
   파일의 첫 선언을 집으면 엉뚱한 값으로 이어진다(editor.js 의 `n` 이 실제로 그랬다). */
function nearestDecl(tok, src, at) {
  const re = new RegExp(`\\b(?:const|let|var)\\s+${tok}\\s*=\\s*([^;\\n]+)`, 'g');
  let m, best = null;
  while ((m = re.exec(src))) { if (at == null || m.index < at) best = m[1]; else break; }
  return best;
}
function resolveAliases(expr, src, at, depth = 3) {
  if (depth <= 0) return expr;
  let changed = false;
  const out = expr.replace(/\b([A-Za-z_$][A-Za-z0-9_$]*)\b/g, (tok, _g, off, str) => {
    if (ESC_NAME.test(tok)) return tok;                 // ⛔이스케이프 함수는 펴지 마라 — 펴면 막힌 표가 사라진다
    if (/^\s*\(/.test(str.slice(off + tok.length))) return tok;  // 부르는 이름(함수)은 값이 아니다
    if (ambiguouslyBound(tok, src)) return tok;
    const init = nearestDecl(tok, src, at);
    if (init == null) return tok;
    changed = true;
    return `(${init})`;
  });
  return changed ? resolveAliases(out, src, at, depth - 1) : out;
}

/* 숫자·개수처럼 «글자가 아닌» 삽입부 걸러내기 (${n}개 선택됨 / ${blocks.length} 같은 것).
   문자열 리터럴이 하나라도 섞이면 글자로 본다. */
function resolveAny(expr, src, at, depth = 3) {
  if (depth <= 0) return expr;
  let changed = false;
  const out = expr.replace(/\b([A-Za-z_$][A-Za-z0-9_$]*)\b/g, (tok, _g, off, str) => {
    if (/^(?:length|size)$/.test(tok)) return tok;
    if (/^\s*\(/.test(str.slice(off + tok.length))) return tok;
    const init = nearestDecl(tok, src, at);
    if (init == null) return tok;
    changed = true;
    return `(${init})`;
  });
  return changed ? resolveAny(out, src, at, depth - 1) : out;
}
function isNumericish(expr, src, at) {
  if (/\.(?:length|size)\b/.test(expr)) return true;
  const r = resolveAny(expr, src, at);
  if (/\.(?:length|size)\b/.test(r)) return true;
  if (/\b[A-Za-z_$][A-Za-z0-9_$]*(?:count|len|size|num)[A-Za-z0-9_$]*\s*\(/i.test(r)) return true;
  if (/['"`]/.test(r)) return false;
  if (/^[\s()]*-?\d+(?:\.\d+)?[\s()]*$/.test(r)) return true;
  return /^[\s()\w$.]+[-+*/%][\s()\w$.+\-*/%]+$/.test(r);   // 순수 산술
}

/* `cond ? 'checked' : ''` 처럼 «그려지는 값이 전부 개발자 리터럴»이면 이름이 아니다.
   (조건 쪽에 이름 읽기가 있어도 화면에 나가는 건 리터럴뿐이다.) */
function producesOnlyLiterals(expr) {
  const t = expr.trim();
  const q = t.indexOf('?');
  if (q < 0) return false;
  let depth = 0, colon = -1;
  for (let i = q + 1; i < t.length; i++) {
    const c = t[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === '"' || c === "'" || c === '`') { i = skipQuoted(t, i) - 1; }
    else if (c === ':' && depth === 0) { colon = i; break; }
  }
  if (colon < 0) return false;
  const lit = /^\s*(?:'[^']*'|"[^"]*"|`[^`$]*`)\s*$/;
  return lit.test(t.slice(q + 1, colon)) && lit.test(t.slice(colon + 1));
}

/* ★「코드에 박힌 목록」에서 온 값은 사용자가 짓는 이름이 아니다.
   `ANIM_LIST.map(a => …)` 의 a.label 은 개발자가 적은 고정 문구다 — 이걸 빨강으로 세면
   «고칠 것이 없는데 빨간 줄»이 남아 게이트가 「원래 빨간 것」이 된다.
   ⛔«이름»으로 빼지 않는다 — «출처»로 뺀다: 그 map 의 대상이 const 배열 리터럴인가.
   한 파일에서 못 찾으면 import 한 모듈까지 «한 번만» 따라간다(두 파일에서 멈춘다). */
function fromConstArray(tok, src, repo, rel) {
  const m = new RegExp(`\\b([A-Za-z_$][\\w$]*)\\s*\\.\\s*(?:map|forEach|flatMap)\\s*\\(\\s*\\(?\\s*${tok}\\b`).exec(src);
  if (!m) return false;
  const holder = m[1];
  const isArr = (code) => new RegExp(`\\b(?:const|let|var)\\s+${holder}\\s*=\\s*\\[`).test(code);
  if (isArr(src)) return true;
  const imp = new RegExp(`import\\s*\\{[^}]*\\b${holder}\\b[^}]*\\}\\s*from\\s*['"]([^'"]+)['"]`).exec(src);
  if (!imp) return false;
  /* ★수입한 모듈도 ★주석을 걷고 본다 (2026-10-07) — ⛔여기만 raw 로 두면 ★본문은 걷고
     ★수입처는 안 걷는 ★비대칭이 생긴다. ★틀리는 ★방향이 ★나쁘다: 주석 속 예시
     (`const X = [ … ]`)가 ★«상수 배열»로 읽히면 ★그 자리는 ★조용히 ★건너뛰어진다(거짓 음성). */
  try { return isArr(stripCommentsTA(fs.readFileSync(path.resolve(path.dirname(path.join(repo, rel)), imp[1]), 'utf8'))); }
  catch { return false; }
}

// ───────────────────────── 이스케이프 여부 ─────────────────────────
/* esc 스러운 함수의 «부름 전체»와 «괄호 안»을 둘 다 기록한다.
   ┌ 이름 읽기가 «괄호 안»에 들어 있으면 그 읽기는 막힌 것
   └ 삽입부 «전체»가 «부름 전체»에 덮이면 그 삽입부는 막힌 것 */
function escapedSpans(expr) {
  const out = []; const re = /\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
  let m;
  while ((m = re.exec(expr))) {
    if (!ESC_NAME.test(m[1])) continue;
    let j = m.index + m[0].length, depth = 1;
    while (j < expr.length && depth > 0) {
      const c = expr[j];
      if (c === '(') depth++;
      else if (c === ')') { depth--; if (!depth) break; }
      else if (c === '"' || c === "'" || c === '`') { j = skipQuoted(expr, j) - 1; }
      j++;
    }
    out.push({ call: [m.index, j + 1], arg: [m.index + m[0].length, j] });
  }
  return out;
}

function isEscaped(expr) {
  const spans = escapedSpans(expr);
  if (!spans.length) return false;
  const reads = nameReads(expr);
  if (reads.length) return reads.every(r => spans.some(s => r.start >= s.arg[0] && r.end <= s.arg[1]));
  const t = expr.trim(); const lead = expr.indexOf(t);
  return spans.some(s => s.call[0] <= lead && s.call[1] >= lead + t.length);
}

function lineOf(src, idx) { return src.slice(0, idx).split('\n').length; }

// ───────────────────────── 훑기 ─────────────────────────
/** ★★경계 감지기 — 「한 보간이 ★닫는 중괄호를 ★못 찾았다」를 전수로. ★이게 ★주 자다.
 *  ★병의 정체(2026-10-07): `js/props/prop-grid.js:3103` 의 보간이 ★경계를 잃고
 *    ★리터럴 끝까지 삼켰다(raw ★32,541자). 그 안의 ★검증된 안전 싱크까지 ★같이 먹혀
 *    X5 가 ★«안 닫힌 이름 자리» ★1건으로 신고했다 — ★제품에는 ★이름 보간이 ★없었다.
 *
 *  ★★⚠️[정정 · 2026-10-07] ★내가 ★한 번 ★「길이로는 못 가른다」고 ★적었다. ★그것은 ★틀렸다 —
 *    ★★«두 자를 섞어» 견준 것이다: ★폭주는 `scan()` 이 ★공백을 접고 ★중첩을 가린 뒤의
 *    ★2,927자로, ★정상 최장은 ★raw `it.expr.length` ★3,478자로 재 놓고 ★나란히 놓았다.
 *    ★★같은 자(raw)로 다시 재면 ★갈린다:
 *        ★정상 최장  ★3,478 (js/props/prop-simple-card.js:231 · 다음 3,384 · 2,882 …)
 *        ★폭주       ★19,498 (js/props/prop-chat.js:166) · ★32,541 (prop-grid.js:3103)
 *    ⇒ ★길이 자도 ★선다. ⇒ ★버리지 않고 ★«둘째 그물»로 ★같이 건다(아래 INTERP_MAX_CHARS).
 *
 *  ★그래도 ★주 자는 ★«닫혔나»다 — ★까닭:
 *    ⑴ ★문턱이 ★없다(★정상 최장이 자라면 길이 자는 ★손으로 올려야 한다 = ★썩는다)
 *    ⑵ ★까닭과 ★무관하다(주석·정규식·새 문법 ★무엇이든 ★경계를 잃으면 운다)
 *  ⛔둘 중 ★하나라도 ★느슨하게 하지 마라 — ★토크나이저를 고쳐라. */function unterminatedInterpolations(repo) {
  const out = [];
  for (const rel of sourceFiles(repo)) {
    for (const seg of scriptSegments(repo, rel)) {
      for (const lit of templateLiterals(seg.text)) {
        for (const it of interpolations(lit.text)) {
          if (!it.unterminated) continue;
          out.push({
            file: rel,
            line: lineOf(seg.rawSrc, seg.offset + lit.start + it.start),
            len: it.expr.length,
            head: it.expr.replace(/\s+/g, ' ').trim().slice(0, 80),
          });
        }
      }
    }
  }
  return out;
}

/** ★둘째 그물 — ★길이 상한. ★문턱의 ★근거는 ★실측이다(2026-10-07, ★raw `it.expr.length`):
 *    ★정상 최장 ★3,478  ·  ★폭주 ★19,498 / ★32,541   ⇒ ★그 사이에 ★여유 있게 ★8,000.
 *  ★★⛔이 수를 ★올려서 빨강을 끄지 마라 — ★올리기 전에 ★「★왜 그렇게 긴 보간이 생겼나」를 적어라.
 *    ★정상 최장이 ★8,000 에 닿으면 ★그때는 ★그 보간을 ★쪼개는 것이 ★맞는 처방이다.
 *  ⚠️이 자는 ★주 자(경계)가 ★못 보는 꼴을 ★덮는 ★보조다 — ⛔이것만으로 ★닫지 마라. */
const INTERP_MAX_CHARS = 8000;

/** 상한을 넘은 보간식 전부. */
function oversizedInterpolations(repo, limit = INTERP_MAX_CHARS) {
  const out = [];
  for (const rel of sourceFiles(repo)) {
    for (const seg of scriptSegments(repo, rel)) {
      for (const lit of templateLiterals(seg.text)) {
        for (const it of interpolations(lit.text)) {
          if (it.expr.length <= limit) continue;
          out.push({
            file: rel,
            line: lineOf(seg.rawSrc, seg.offset + lit.start + it.start),
            len: it.expr.length,
            head: it.expr.replace(/\s+/g, ' ').trim().slice(0, 80),
          });
        }
      }
    }
  }
  return out;
}

/** 가장 긴 보간식 — ★진단용(위 문턱이 ★아직 넉넉한지 ★검사가 스스로 찍게). */
function longestInterpolation(repo) {
  let best = { len: -1 };
  for (const rel of sourceFiles(repo)) {
    for (const seg of scriptSegments(repo, rel)) {
      for (const lit of templateLiterals(seg.text)) {
        for (const it of interpolations(lit.text)) {
          if (it.expr.length > best.len) {
            best = { file: rel, line: lineOf(seg.rawSrc, seg.offset + lit.start + it.start), len: it.expr.length };
          }
        }
      }
    }
  }
  return best;
}

function scan(repo) {
  const hits = [];
  for (const rel of sourceFiles(repo)) {
    for (const seg of scriptSegments(repo, rel)) {
      for (const lit of templateLiterals(seg.text)) {
        if (!/<[a-zA-Z][^>]*>/.test(lit.text)) continue;   // HTML 을 만드는 리터럴만
        const sinks = nameSinkRanges(lit.text);
        for (const it of interpolations(lit.text)) {
          /* 중첩 템플릿은 따로 훑는다(이중계수 방지) — 다만 «통째로» 건너뛰면
             껍데기 층에 실린 이름이 안 보인다. 안쪽만 길이를 지켜 지우고 껍데기를 본다. */
          const hadNested = it.expr.includes('`');
          const shell = hadNested ? maskNestedLiterals(it.expr) : it.expr;
          if (!shell.trim()) continue;
          /* 지운 자리가 «되풀이의 몸통»이면 껍데기는 흐름일 뿐 — 그 몸통은 따로 훑는다. */
          if (hadNested && /\.\s*(?:map|forEach|flatMap|filter|reduce)\s*\(/.test(shell)) continue;
          const inSink = sinks.some(([a, b]) => it.start >= a && it.start < b);
          const at = lit.start + it.start;
          const resolved = resolveAliases(shell, seg.text, at);
          const reads = nameReads(resolved);
          if (!inSink && !reads.length) continue;
          if (isNumericish(shell, seg.text, at)) continue;    // 개수·숫자는 글자가 아니다
          if (producesOnlyLiterals(shell)) continue;          // 그려지는 값이 리터럴뿐
          /* 코드에 박힌 목록에서 온 값은 사용자 이름이 아니다 — «출처»로 가른다 */
          const holderTok = /^\s*\(?\s*([A-Za-z_$][\w$]*)\s*\./.exec(shell);
          if (holderTok && fromConstArray(holderTok[1], seg.text, repo, rel)) continue;
          const abs = seg.offset + lit.start + it.start;
          hits.push({
            file: rel,
            line: lineOf(seg.rawSrc, abs),
            rules: (inSink ? 'S' : '') + (reads.length ? 'P' : ''),
            expr: shell.replace(/\s+/g, ' ').trim(),
            /* 별칭 «정의»에서 이미 감싼 것도 초록이다 (const safeName = _escHtml(tab.name)). */
            escaped: isEscaped(shell) || isEscaped(resolved),
          });
        }
      }
    }
  }
  return hits;
}

/* 「esc 를 불렀다」와 「그 esc 가 진짜로 막는다」는 다른 말이다.
   ⇒ 초록으로 친 자리가 «실제로 부르는» 이스케이프 함수만 골라, 그 정의가 꺾쇠를
     실체참조로 바꾸는지 본다. (레포엔 «Escape 키» 뜻의 _escHandler/_escRaf 같은
     동음이의 이름이 많아서, 이름만 보고 전수로 재면 그게 곧 오탐이다.)
   ⚠️HTML 실체참조엔 `;` 가 들어 있다 — 정의 본문을 `[^;]` 로 자르면 `&amp;` 에서 끊긴다. */
function verifyEscapers(repo, usedNames) {
  const want = new Set(usedNames || []);
  const found = [];
  for (const rel of sourceFiles(repo)) {
    for (const seg of scriptSegments(repo, rel)) {
      const re = /\b(?:const|let|var|function)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[=(]/g;
      let m;
      while ((m = re.exec(seg.text))) {
        if (want.size && !want.has(m[1])) continue;
        if (!ESC_NAME.test(m[1])) continue;
        const body = seg.text.slice(m.index, m.index + 500);
        const alias = /^(?:const|let|var)\s+[\w$]+\s*=\s*([A-Za-z_$][\w$]*)\s*[;\n]/.exec(body);
        found.push({
          file: rel, name: m[1], line: lineOf(seg.rawSrc, seg.offset + m.index),
          aliasOf: alias && ESC_NAME.test(alias[1]) ? alias[1] : null,
          blocksAngle: /&lt;|&#0*60\b|&#x0*3c/i.test(body),
        });
      }
    }
  }
  /* `const esc = _escHtml;` 같은 «딴이름»은 가리키는 쪽 결과를 물려받는다. */
  const ok = new Set(found.filter(f => f.blocksAngle).map(f => f.name));
  for (const f of found) if (!f.blocksAngle && f.aliasOf && ok.has(f.aliasOf)) f.blocksAngle = true;
  return found;
}

/* 초록으로 친 자리들이 실제로 부르는 esc 함수 이름 모으기. */
function escapersUsedBy(hits) {
  const names = new Set();
  for (const h of hits) {
    if (!h.escaped) continue;
    const re = /\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
    let m;
    while ((m = re.exec(h.expr))) if (ESC_NAME.test(m[1])) names.add(m[1]);
  }
  return [...names].sort();
}

module.exports = {
  SOURCE_ROOTS, INTRINSIC,
  sourceFiles, scriptSegments, templateLiterals, interpolations,
  nameSinkRanges, VOID_TAGS, nameReads, producesOnlyLiterals, fromConstArray, resolveAliases, isNumericish, escapedSpans, isEscaped, lineOf,
  scan, verifyEscapers, escapersUsedBy,
  unterminatedInterpolations, oversizedInterpolations, INTERP_MAX_CHARS, longestInterpolation, templateBalanced,
};
