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
 *   · 여러 줄 템플릿 리터럴 안의 `/*` 는 주석으로 읽는다. 그 경우가 생기면 여기를 고쳐라.
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
function makeStripper() {
  let inBlock = false;
  return function stripLine(line) {
    const s = String(line);
    let out = '';
    /* 따옴표 상태는 «줄마다» 새로 센다 — 여러 줄 템플릿 리터럴은 아래 ⚠️한계 그대로다. */
    let dq = false, sq = false, bt = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inBlock) {
        if (c === '*' && s[i + 1] === '/') { inBlock = false; i++; }
        continue;
      }
      if (!dq && !sq && !bt) {
        /* ★먼저 나온 표기가 이긴다. `//` 를 만나면 그 줄은 거기서 끝이고,
             그 뒤에 무엇이 오든(`/*` 든 뭐든) 글자일 뿐이다. */
        if (c === '/' && s[i + 1] === '/') return out;
        if (c === '/' && s[i + 1] === '*') { inBlock = true; i++; continue; }
      }
      if (c === '\\') { out += c; if (i + 1 < s.length) out += s[++i]; continue; }
      if (!sq && !bt && c === '"') dq = !dq;
      else if (!dq && !bt && c === "'") sq = !sq;
      else if (!dq && !sq && c === '`') bt = !bt;
      out += c;
    }
    return out;
  };
}

/** 편의: 소스 전체를 받아 «코드만» 남긴 문자열로 돌려준다. */
function stripComments(src) {
  const strip = makeStripper();
  return String(src).split('\n').map(strip).join('\n');
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

module.exports = { makeStripper, stripComments, stripYamlComments };
