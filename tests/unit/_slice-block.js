/* _slice-block — 소스에서 «한 덩이»(함수·객체리터럴·화살표)를 잘라내는 단 하나의 부품.
 *
 * ★왜 있나 (2026-09-09, 게이트가 균형괄호로 다시 재서 잡음)
 *   이 레포의 검사 18벌이 구간의 «끝»을 이렇게 찾고 있었다:
 *       const j = src.indexOf('\n}\n', i);
 *   「최상위 함수는 0열 `}` 로 끝난다」는 전제인데, ★그 전제가 반만 맞다:
 *     · `function f() { … }`            → `\n}\n`  ○ 걸린다
 *     · `const g = (a) => { … };`        → `\n};\n` ✗ «안» 걸린다
 *     · `const H = { … };`               → `\n};\n` ✗ «안» 걸린다
 *     · `const K = { … });`  `[ … ]);`   → 그 밖의 꼬리 전부 ✗
 *   못 걸리면 -1 이 아니라 «다음 최상위 `}` 까지 달려간다» ⇒ 구간이 «남의 코드»를 삼킨다.
 *
 *   실측(zoom-block.test.js · HEAD ad39400 · 2026-09-09):
 *       const bindPair = … =>        진짜 21줄 → 떠낸 것 129줄  (+108)
 *       const bindRadio = … =>       진짜 12줄 → 떠낸 것  91줄  (+79)
 *       const _ROTATE_HANDLERS = {   진짜 10줄 → 떠낸 것  16줄  (+6)
 *       const ZOOM_DEFAULTS = {      진짜 31줄 → 떠낸 것  45줄  (+14)
 *
 * ★삼킨 구역은 «검사를 눈멀게» 한다 — 두 방향으로 다.
 *   ⑴ 거짓 초록: 구간 «밖»의 코드가 단언을 만족시켜, 그 구간에서 배선을 빼는 변이가 통과한다.
 *      (ad39400 이 실물로 겪었다: apply() 에서 rerender() 를 뺀 변이가 초록이었다.)
 *   ⑵ 거짓 빨강: 「이 구간엔 X 가 없어야 한다」가 «남의 X» 때문에 빠개진다.
 *
 * ⛔「`\n};\n` 도 같이 찾는다」로 때우지 마라 — 그건 또 다른 «명부»고,
 *    다음에 `})` · `}]` · `}));` 로 끝나는 자리가 오면 같은 구멍이 다시 난다.
 *    ⇒ 끝을 «세어서» 찾는다. 명부가 아니라 셈이다.
 *
 * ★★이 부품이 필요한 진짜 이유 (_strip-comments 와 같다)
 *   이 팀의 규율은 «선례를 베껴라»다. 그런데 선례가 결함을 옮겼다 — 18벌이 같은 형태로
 *   부서져 있었다. 베끼기는 옳았고 베낀 것이 부서져 있었다. ⇒ 베낄 것을 «하나»로 둔다.
 *
 * 쓰는 법
 *     const { sliceBlock } = require('./_slice-block.js');
 *     const body = sliceBlock(SRC, 'function deselectAll()');
 *     const obj  = sliceBlock(SRC, 'const ZOOM_DEFAULTS = {');
 *     const arrow = sliceBlock(SRC, 'const bindPair = (id, key, label, min, max) =>');
 *   구간 머리(header)는 «여는 `{` 앞까지»만 적어도 된다 — 머리 뒤 첫 최상위 `{` 를 본문으로 본다.
 *   ★머리가 `{` 로 «끝나면» 그 `{` 를 본문으로 본다(`const w = register({` 처럼 `(` 안에서 여는 자리용).
 *   돌려주는 것은 «머리부터 짝 맞는 `}` 까지»(닫는 괄호 «포함») 원문 그대로다.
 *     ⇒ 옛 관용구의 `src.slice(i, j + 3)`(원문 그대로) 자리에 그대로 놓을 수 있다.
 *       옛 `src.slice(i, j)`(닫는 줄 제외) 자리에도 놓을 수 있다 — 단언이 보는 것은
 *       구간 «안»의 코드고, `}` 한 글자가 더 붙는 것으로 뜻이 바뀌는 단언은 없다.
 *
 * ⛔못 찾으면 «던진다». 건너뛰지(skip) 않는다 — 건너뛴 검사는 영영 안 돈다.
 *   ★특히 「끝을 못 찾음」을 -1 로 흘려보내지 않는다. 그게 이 병의 시작이었다.
 *
 * ⚠️한계(단언하지 않고 적는다)
 *   · 문자열·주석·정규식 리터럴·템플릿(`${}` 중첩 포함) 안의 괄호는 세지 않는다. 여기까지가 범위다.
 *   · 정규식 vs 나눗셈은 «직전 유효 문자»로 가른다(표준 휴리스틱). `)` 뒤의 정규식
 *     (`if (x) /re/.test(y)`)은 나눗셈으로 읽는다 — 이 레포엔 그 형태가 없다(검사가 센다).
 *   · 머리 뒤 첫 최상위 `{` 를 본문으로 본다. 즉시실행함수(`(function(){…})`)를 머리로
 *     주면 최상위 `{` 가 없어 «던진다» — 조용히 틀리지는 않는다.
 *
 * (파일명이 _ 로 시작해 테스트 글롭(`*.test.js`)에 안 걸린다 — 도구다.)
 * ★ESM(.mjs)에서도 `import { sliceBlock } from './_slice-block.js'` 로 쓸 수 있다
 *   (module.exports 객체 리터럴이라 cjs-module-lexer 가 이름을 뽑는다 — _srcread.js 와 같다).
 */
'use strict';

/** 정규식 리터럴이 시작될 자리인가 — 직전 «유효» 문자로 가른다. */
function _isRegexStart(src, i, prev) {
  if (!prev) return true;                       // 구간 첫 글자
  if (prev === ')' || prev === ']' || prev === '}') return false;   // 나눗셈으로 읽는다
  if (/[\w$]/.test(prev)) {
    /* 낱말 뒤 — 그 낱말이 «키워드»면 정규식(`return /re/`), 아니면 나눗셈(`a / b`). */
    const before = src.slice(Math.max(0, i - 24), i);
    return /(?:^|[^.\w$])(?:return|typeof|instanceof|in|of|new|delete|void|case|do|else|yield|await|throw)\s*$/.test(before);
  }
  return true;
}

/** `'` · `"` 로 연 문자열을 건너뛴다. 닫는 따옴표 «다음» 자리를 돌려준다. */
function _skipQuoted(src, i, q, where) {
  for (let k = i + 1; k < src.length; k++) {
    const c = src[k];
    if (c === '\\') { k++; continue; }
    if (c === q) return k + 1;
    /* ⛔따옴표 문자열은 «줄을 못 넘는다». 넘었다면 우리가 따옴표를 잘못 짚은 것이다
       — 조용히 삼키지 말고 던진다. */
    if (c === '\n') throw new Error(`_slice-block: 안 닫힌 문자열(${q}) — ${where}`);
  }
  throw new Error(`_slice-block: 안 닫힌 문자열(${q}) — ${where}`);
}

/** 정규식 리터럴을 건너뛴다(문자 클래스 `[…]` 안의 `/` 는 끝이 아니다). */
function _skipRegex(src, i, where) {
  let inClass = false;
  for (let k = i + 1; k < src.length; k++) {
    const c = src[k];
    if (c === '\\') { k++; continue; }
    if (c === '\n') throw new Error(`_slice-block: 안 닫힌 정규식 — ${where}`);
    if (inClass) { if (c === ']') inClass = false; continue; }
    if (c === '[') { inClass = true; continue; }
    if (c === '/') return k + 1;
  }
  throw new Error(`_slice-block: 안 닫힌 정규식 — ${where}`);
}

/**
 * `from` 부터 «첫 최상위 `{`» 를 찾아 그 짝이 되는 `}` 의 «인덱스»를 돌려준다.
 * 문자열·주석·정규식·템플릿 안의 괄호에 속지 않는다.
 */
function findBlockEnd(src, from, where = '(이름 없음)') {
  /* frames — 지금 어느 «세계»에 있나. 'code' 는 괄호를 세는 세계, 'tpl' 은 템플릿 글자 세계.
     `${` 를 만나면 템플릿 «안»에 새 code 세계가 열리고, 그 `}` 로 다시 템플릿으로 돌아간다. */
  const frames = [{ kind: 'code', depth: 0 }];
  let opened = false;   // 최상위에서 본문 여는 `{` 를 만났나
  let prev = '';        // 직전 «유효»(공백 아닌) 문자
  let i = from;

  while (i < src.length) {
    const f = frames[frames.length - 1];
    const c = src[i];

    if (f.kind === 'tpl') {
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { frames.pop(); prev = '`'; i++; continue; }
      if (c === '$' && src[i + 1] === '{') { frames.push({ kind: 'code', depth: 0 }); prev = ''; i += 2; continue; }
      i++; continue;
    }

    // ── code 세계
    if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      if (e < 0) throw new Error(`_slice-block: 안 닫힌 블록 주석 — ${where}`);
      i = e + 2; continue;
    }
    if (c === "'" || c === '"') { i = _skipQuoted(src, i, c, where); prev = c; continue; }
    if (c === '`') { frames.push({ kind: 'tpl' }); i++; continue; }
    if (c === '/' && _isRegexStart(src, i, prev)) { i = _skipRegex(src, i, where); prev = '/'; continue; }

    if (c === '(' || c === '[') { f.depth++; prev = c; i++; continue; }
    if (c === '{') {
      if (frames.length === 1 && f.depth === 0 && !opened) opened = true;
      f.depth++; prev = c; i++; continue;
    }
    if (c === ')' || c === ']') {
      f.depth--;
      if (f.depth < 0) throw new Error(`_slice-block: 짝 없는 '${c}' — ${where}`);
      prev = c; i++; continue;
    }
    if (c === '}') {
      if (f.depth === 0) {
        /* 깊이 0 의 `}` — `${` 를 닫는 자리여야 한다. 아니면 구간이 «머리보다 먼저» 끝난 것이다. */
        if (frames.length > 1) { frames.pop(); prev = '}'; i++; continue; }
        throw new Error(`_slice-block: 본문 여는 '{' 를 만나기 전에 짝 없는 '}' — ${where}`);
      }
      f.depth--;
      if (frames.length === 1 && f.depth === 0 && opened) return i;   // ★여기가 짝이다
      prev = '}'; i++; continue;
    }

    if (!/\s/.test(c)) prev = c;
    i++;
  }
  throw new Error(
    `_slice-block: 구간의 끝을 못 찾음 — ${where}` +
    (opened ? ' (본문 `{` 는 찾았으나 짝이 없다)' : " (머리 뒤에 최상위 '{' 가 없다)"));
}

/**
 * 구간 머리(header)로 시작하는 «한 덩이»를 원문 그대로 돌려준다 — 닫는 `}` 포함.
 * @param {string} src    소스 전문(readSrc 로 읽은 LF 정규화본)
 * @param {string} header 구간 머리 문자열. 여는 `{` 앞까지만 적어도 된다.
 * @param {string} [note] 못 찾았을 때 오류에 덧붙일 말(그 검사가 «무엇을 놓쳤는지»).
 */
function sliceBlock(src, header, note) {
  const i = String(src).indexOf(header);
  if (i < 0) throw new Error(`_slice-block: 구간 머리를 못 찾음: ${header}${note ? ` — ${note}` : ''}`);
  /* ★머리가 `{` 로 «끝나면» 그게 본문 여는 괄호다 — 셈을 거기서 시작한다.
       ⛔「머리 안의 마지막 `{`」로 잡으면 `function f({a, b})` 같은 «분해 인자»를 본문으로 읽는다.
       ⛔「머리 뒤 첫 최상위 `{`」로만 잡으면 `const w = register({` 처럼 여는 괄호가 `(` «안»에
         있는 자리를 영영 못 찾고 다음 함수까지 달려간다(그게 옛 병과 같은 모양이다). */
  const scanFrom = /\{\s*$/.test(header) ? i + header.lastIndexOf('{') : i;
  const end = findBlockEnd(src, scanFrom, header + (note ? ` — ${note}` : ''));
  return src.slice(i, end + 1);
}

module.exports = { sliceBlock, findBlockEnd };
