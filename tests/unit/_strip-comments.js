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

/** 파일 하나를 줄 단위로 훑는 «상태를 든» 주석 거르개. 코드만 남긴 줄을 돌려준다. */
function makeStripper() {
  let inBlock = false;
  return function stripLine(line) {
    let t = String(line);
    if (inBlock) {
      const e = t.indexOf('*/');
      if (e < 0) return '';
      inBlock = false; t = t.slice(e + 2);
    }
    for (;;) {
      const b = t.indexOf('/*');
      if (b < 0) break;
      /* ★따옴표 «안»의 /* 는 주석이 아니다 — accept="image/*" 가 정확히 그 경우다.
           여는 따옴표가 짝을 못 찾은 채 /* 를 만나면 그건 «문자열 안»이다. */
      const before = t.slice(0, b);
      const dq = (before.match(/"/g) || []).length;
      const sq = (before.match(/'/g) || []).length;
      if (dq % 2 === 1 || sq % 2 === 1) break;   // 문자열 안 — 주석 아님
      const e = t.indexOf('*/', b + 2);
      if (e < 0) { t = t.slice(0, b); inBlock = true; break; }
      t = t.slice(0, b) + t.slice(e + 2);
    }
    /* ★줄 주석은 «따옴표 밖»의 // 부터 지운다.
         ⛔줄 맨 앞만 보면 «꼬리 주석»(code;  // 설명)이 코드로 남는다.
         ⛔반대로 무조건 지우면 문자열 안의 'http://www.w3.org/2000/svg' 를 잘라먹어
           «코드가 사라진다» — 그게 이 레포에서 실제로 검사를 눈멀게 했던 형태다. */
    let dq = false, sq = false, bt = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (c === '\\') { i++; continue; }
      if (!sq && !bt && c === '"') dq = !dq;
      else if (!dq && !bt && c === "'") sq = !sq;
      else if (!dq && !sq && c === '`') bt = !bt;
      else if (!dq && !sq && !bt && c === '/' && t[i + 1] === '/') return t.slice(0, i);
    }
    return t;
  };
}

/** 편의: 소스 전체를 받아 «코드만» 남긴 문자열로 돌려준다. */
function stripComments(src) {
  const strip = makeStripper();
  return String(src).split('\n').map(strip).join('\n');
}

module.exports = { makeStripper, stripComments };
