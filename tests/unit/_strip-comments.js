/* _strip-comments — 소스를 훑는 검사가 «주석을 걷어내는» 단 하나의 부품.
 *
 * ★왜 있나 (2026-09-08, 툴매니저가 실물로 잡음)
 *   이 레포엔 같은 일을 하는 stripComments 가 «11벌» 있었고 그중 9벌이 같은 형태로 부서져 있었다:
 *     src.replace(/\/\*[\s\S]*?\*\//g, '')
 *   이 정규식은 `accept="image/*"` 의 `/*` 를 «블록 주석 시작»으로 읽고 다음 `*​/` 까지 삼킨다.
 *   ⇒ 그 사이의 «진짜 코드»가 사라지고, 검사는 「0건 발견 = 통과」로 초록이 된다.
 *   실측(툴매니저): 정렬 버튼이 146 → 121 로 떨어졌다. 25개가 «없는 것»이 됐다.
 *     (prop-frame 9 · prop-section 3 · prop-table 3 …)
 *   ★그리고 `image/*` 는 이 레포에 «실재»하고 하필 정렬 버튼이 있는 파일들에 있다
 *     (prop-annotation.js: align-btn 14 · prop-banner02.js: 9).
 *
 * ★★이 부품이 필요한 진짜 이유
 *   이 팀의 규율은 «선례를 베껴라»다. 그런데 이번엔 «선례가 결함을 옮겼다».
 *   베끼기는 옳았고 베낀 것이 부서져 있었다. ⇒ 베낄 것을 «하나»로 둔다.
 *
 * ⛔쓰는 법 — 파일 «하나»마다 새 stripper 를 만든다(블록 주석 상태를 들고 가기 때문).
 *     const strip = makeStripper();
 *     src.split('\n').forEach((line, i) => { const code = strip(line); … });
 *
 * ⚠️한계(단언하지 않고 적는다)
 *   · ★★[2026-10-07 닫혔다 — 단 `templateAware: true` 에서만] 여러 줄 템플릿 리터럴 안의 `/*` 를
 *     ★기본(레거시) 모드는 ★여전히 주석으로 읽는다. ★산 결함은 ★그 반대였다 — `${ … }` «안»의
 *     ★진짜 주석을 ★못 걷었고, 그 주석 넷 줄이 ★코드로 읽혔다(실측: js/props/prop-grid.js 의
 *     ★알약 주석이 ★name-axes X5 를 ★빨갛게 만들었다 · 그 자리를 두 모드가 ★갈라 재는 대조는
 *     tests/unit/strip-comments-shared.test.js 에 있다).
 *   · ★templateAware 도 ★정규식 리터럴을 ★안 파싱한다 ⇒ 정규식 «안»의 백틱은 ★어긋낸다.
 *     ⇒ 그래서 `templateBalanced()` 를 ★같이 내어 «전제»로 걸게 한다.
 *   · 문자열 안의 `//` 는 «줄 맨 앞»이 아니면 안 지운다(그래서 'http://…' 가 안 잘린다).
 */
'use strict';

/** 파일 하나를 줄 단위로 훑는 «상태를 든» 주석 거르개. 코드만 남긴 줄을 돌려준다.
 *
 * ★2026-09-22 (T-049 XS4) — 한 번에 왼쪽부터 훑는다. 전엔 «블록 주석을 먼저, 줄 주석을 나중»
 *   두 번에 나눠 봤고, 그래서 **줄 주석 «안»의 `/` + `*` 를 블록 주석의 시작으로 읽었다**:
 *     return { … };  // 파랑 (feature/<별>)      ← 이 한 줄이
 *   그 뒤 74줄을 통째로 삼켰다(js/branch-system.js:9 실측, 선언만 28줄). 삼켜진 구간은
 *   **어떤 소스 게이트에도 안 보인다** — 초록이 「괜찮다」가 아니라 「안 봤다」가 된다.
 *   ⛔두 번 훑는 꼴로 되돌리지 마라. 어느 쪽을 먼저 보든 반대쪽이 눈먼다 —
 *     순서 문제가 아니라 «한 줄 안에서 먼저 나온 표기가 이긴다»가 규칙이다.
 *   ★이 결함을 재는 검사는 tests/unit/name-axes-to-markup.test.mjs 의 XS4 다.
 */
/** 「여기서 시작하는 `/` 가 ★정규식 리터럴인가」 — 맞으면 ★닫는 `/` 다음 자리를, 아니면 그대로.
 *  ⛔나눗셈과 가르는 자 = ★직전 유의미 글자(값의 «끝»이면 나눗셈)와 ★키워드.
 *    선례 = tests/_name-sink-scan.js 의 REGEX_PREV·REGEX_KEYWORD (★같은 판정을 쓴다).
 *  ⛔한 줄 안에서 ★닫히지 않으면 ★정규식으로 보지 «않는다» — 그게 ★안전한 쪽이다
 *    (정규식은 줄을 안 넘는다 · 안 닫혔으면 나눗셈이거나 글자다).
 *  ★문자 클래스 안의 `/` 는 ★닫는 자가 아니다(`/[a-z/]/`). */
function _skipRegexAt(s, i, prev) {
  if (s[i] !== '/' || s[i + 1] === '/' || s[i + 1] === '*') return i;
  if (/[A-Za-z0-9_$)\]]/.test(prev)) return i;          // 값의 끝 ⇒ 나눗셈
  let j = i + 1, cls = false;
  for (; j < s.length; j++) {
    const d = s[j];
    if (d === '\\') { j++; continue; }
    if (d === '[') cls = true;
    else if (d === ']') cls = false;
    else if (d === '/' && !cls) return j + 1;           // 닫혔다
  }
  return i;                                             // 이 줄에서 안 닫힘 ⇒ 정규식 아님
}

function makeStripper(opts) {
  /* ★templateAware — 「`${ … }` «안»은 ★코드다」를 아는 모드. ⛔기본은 ★꺼짐이다.
   *  ★왜 옵션인가 — 이 부품의 소비자는 ★87 벌이고(★행위로 셌다: `_strip-comments` 를 부르는 파일),
   *    아래 스택은 ★«줄을 넘어» 사는 상태를 들인다 ⇒ ★여러 줄 템플릿의 판정이 바뀐다.
   *    ⇒ ★레거시 모드의 산출을 ★한 바이트도 안 바꾸는 것이 ★나머지 소비자에게 지는 약속이다.
   *      ★그 약속을 ★어떻게 확인했나(2026-10-07 ★실측 · ⛔상시 게이트가 ★아니다 — 옛 모듈이
   *      ★레포에 없으니 검사가 ★스스로 못 센다): 고치기 ★전 모듈과 ★후 모듈로 ★js·css·pages·main·
   *      tests·index.html ★1069 파일을 ★레거시 모드로 걸러 ★차이 ★0 을 쟀다.
   *      ★상시로 ★재는 자는 ★그 대신 「★두 모드가 ★무엇에서 갈리나」다 =
   *      tests/unit/strip-comments-shared.test.js 의 ★S-9·S-10.
   *  ⚠️이것은 ★빚이다 — ⛔「두 모드」를 ★영구 설계로 두지 마라. 소비자를 하나씩 옮기고
   *    ★레거시를 쓰는 수가 0 이 되는 날 ★이 분기를 지워라.
   *  ★켠 자(2026-10-07): tests/unit/grid-rename-residue.test.mjs · tests/_name-sink-scan.js
   */
  const templateAware = !!(opts && opts.templateAware);
  let inBlock = false;
  /* ★templateAware 전용 — 템플릿 중첩은 ★«줄을 넘어» 산다(여러 줄 템플릿이 이 레포의 관용구다).
     'tpl' = 템플릿 ★본문(따옴표·주석 표기가 ★글자다) · 'expr' = 템플릿 보간 ★안(★코드다) · 'brace' = 그 안의 중괄호. */
  const tpl = [];
  /* ★깊이를 ★밖에 내준다 — `templateBalanced()` 가 「닫혔나」를 ★스택으로 재게.
     ⛔주석 탐침 한 줄로는 ★«보간 안에 갇힘»(top='expr' = 코드 모드)을 ★못 본다 —
       실측 2026-10-07: `const s = \`a${ (1` 을 ★「닫혔다」로 읽었다(내 첫 판의 흠). */
  const stripLine = (line) => {
    const s = String(line);
    let out = '';
    /* 따옴표 상태는 «줄마다» 새로 센다 — ⛔templateAware 에서도 ★그대로 둔다.
       ★까닭: 정규식 안의 따옴표를 ★그 줄에서 끊어 주는 것이, 이 거르개가 ★정규식을
         안 파싱하고도 사는 까닭이다(자기검사 「정규식 뒤의 주석도 걷힌다」가 그것을 잠근다). */
    let dq = false, sq = false, bt = false;
    /* ★templateAware 전용 — 「직전 유의미 글자」. 정규식 리터럴을 가리는 데만 쓴다. */
    let prev = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inBlock) {
        if (c === '*' && s[i + 1] === '/') { inBlock = false; i++; }
        continue;
      }
      /* 「지금 템플릿 ★본문인가」 — 레거시는 ★한 줄짜리 bt, templateAware 는 ★줄을 넘는 스택. */
      const inTpl = templateAware ? tpl[tpl.length - 1] === 'tpl' : bt;
      if (!dq && !sq && !inTpl) {
        /* ★먼저 나온 표기가 이긴다. `//` 를 만나면 그 줄은 거기서 끝이고,
             그 뒤에 무엇이 오든(`/*` 든 뭐든) 글자일 뿐이다. */
        if (c === '/' && s[i + 1] === '/') return out;
        if (c === '/' && s[i + 1] === '*') { inBlock = true; i++; continue; }
      }
      if (c === '\\') { out += c; if (i + 1 < s.length) out += s[++i]; continue; }
      if (templateAware) {
        if (inTpl) {
          if (c === '`') tpl.pop();                                      // 템플릿이 닫혔다
          else if (c === '$' && s[i + 1] === '{') { tpl.push('expr'); out += c + s[++i]; continue; }
          out += c; continue;                                            // ★본문 — 따옴표는 글자다
        }
        if (!dq && !sq) {
          /* ★정규식 리터럴을 ★건너뛴다 — ⛔templateAware 에서만. ★까닭(실측 2026-10-07):
               js/io/gdt-import.js:50 의 `/["\\]/g` 가 따옴표 하나를 ★열어 둔 채 끝나,
               같은 줄의 닫는 중괄호가 ★안 눌려 ★보간이 ★열린 채 ★다음 줄로 샜다.
               ★레거시는 따옴표를 ★줄마다 리셋해 그 새는 것이 ★한 줄에서 죽었지만,
               templateAware 의 ★스택은 ★줄을 넘어 살아서 ★그 뒤 파일 전체가 눈먼다.
             ⇒ ★자리를 ★여기로 고른 까닭 = ★이 상태기를 ★어긋내는 유일한 꼴이 ★정규식이고,
               그것을 ★안 가리면 `templateBalanced()` 가 ★7 파일에서 거짓이 된다(실측). */
          if (c === '/') {
            const r = _skipRegexAt(s, i, prev);
            if (r > i) { out += s.slice(i, r); prev = '/'; i = r - 1; continue; }
          }
          if (c === '`') tpl.push('tpl');
          else if (c === '{') { if (tpl.length) tpl.push('brace'); }
          else if (c === '}') { const t = tpl[tpl.length - 1]; if (t === 'brace' || t === 'expr') tpl.pop(); }
        }
        if (!sq && c === '"') dq = !dq;
        else if (!dq && c === "'") sq = !sq;
        if (!/\s/.test(c)) prev = c;
        out += c; continue;
      }
      if (!sq && !bt && c === '"') dq = !dq;
      else if (!dq && !bt && c === "'") sq = !sq;
      else if (!dq && !sq && c === '`') bt = !bt;
      out += c;
    }
    return out;
  };
  stripLine.tplDepth = () => tpl.length;
  return stripLine;
}

/** ★templateAware 의 ★«자기 전제» — 파일을 다 훑고 ★템플릿 중첩이 ★닫혔나.
 *  ⛔안 닫혔으면 그 파일은 ★어딘가에서 어긋난 것이고 ★그 뒤 줄은 ★«안 본» 것이다
 *    (가장 그럴 법한 꼴 = ★정규식 리터럴 «안»의 백틱 — 이 거르개는 정규식을 안 파싱한다).
 *  ⇒ ★켠 자는 ★이것을 ★«전제 단언»으로 걸어라 — ★초록이 「괜찮다」가 아니라
 *    「★안 봤다」가 되는 길을 ★그 자리에서 막는다.
 *  ★재는 법: 다 훑은 뒤 ★주석 표기가 든 탐침 한 줄을 더 먹여 ★그대로 돌아오나 본다.
 *    (템플릿이 ★열린 채면 그 줄은 ★본문으로 읽혀 ★주석이 안 걷히고 ★그대로 돌아온다 ⇒ 거짓.) */
function templateBalanced(src) {
  const strip = makeStripper({ templateAware: true });
  for (const l of String(src).split('\n')) strip(l);
  /* ★두 자로 ★같이 재라 — ⑴ 중첩이 ★비었나(보간 안에 갇힌 것까지 잡는다)
     ⑵ 주석 표기가 ★여전히 걷히나(템플릿 ★본문에 갇히면 안 걷힌다). ⑴만으로도 ⑵가 따라오지만,
     ⑵를 ★남겨 둔다 — ⑴의 셈이 틀리는 날 ★둘이 갈려 그게 ★신호가 된다. */
  return strip.tplDepth() === 0 && strip('/* x */') === '';
}

/** 편의: 소스 전체를 받아 «코드만» 남긴 문자열로 돌려준다. */
function stripComments(src, opts) {
  const strip = makeStripper(opts);
  return String(src).split('\n').map(strip).join('\n');
}

/** ★templateAware 를 ★켠 편의 함수 — 「`${ … }` «안»은 코드다」까지 아는 거르개.
 *  ★왜 ★따로 내나 — 쓰는 쪽이 `const stripComments = (s) => shared(s, {…})` 꼴로
 *    ★제 이름을 ★짓게 두면, 그게 ★`strip-comments-shared.test.js` S-6 의 눈에 ★«자기 제거기»로
 *    보인다(그 자는 ★정의를 찾는다). ⇒ ★여기서 ★이름을 내주고 쓰는 쪽은 ★수입만 한다.
 *  ⛔`templateBalanced()` 를 ★«전제»로 같이 걸어라 — 까닭은 위 ⚠️한계. */
function stripCommentsTA(src) {
  return stripComments(src, { templateAware: true });
}

/** YAML(.yml) 의 `#` 주석을 걷는다 — 워크플로를 훑는 검사용. (2026-09-22 신설)
 *
 * ★왜 여기 두나 — 위의 stripComments 는 «JS» 용이라 `#` 을 못 본다. 그래서
 *   워크플로를 재는 검사가 «자기 것»을 또 만들 참이었고, 그게 정확히 S-6 이 막는 일이다.
 *   ⇒ 베낄 것을 하나로 둔다는 규율은 그대로 두고, «언어가 다른 칸»을 여기에 연다.
 * ⛔YAML 에는 블록 주석이 없다 — 상태를 들 필요가 없어 줄 단위로 끝난다.
 * ⚠️한계(단언하지 않고 적는다) — 따옴표 «안»의 `#` 은 주석이 아닌데 여기선 지운다.
 *   지금 쓰는 자리(워크플로의 run/name 줄)엔 그런 `#` 이 없다. 생기면 여기를 고쳐라.
 */
function stripYamlComments(src) {
  return String(src).split('\n').map(l => l.replace(/(^|\s)#.*$/, '$1')).join('\n');
}

module.exports = { makeStripper, stripComments, stripCommentsTA, stripYamlComments, templateBalanced };
