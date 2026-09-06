/* ═══════════════════════════════════════════════════════════════════════════
   loadcheck.mjs — «잘라 쓴 소스»가 부르는 선언을 다 실었는지 «기계로» 센다.
   ───────────────────────────────────────────────────────────────────────────
   ★본보기: tests/unit/google-login-loopback.test.mjs 의 U-GLOGIN-0,
            tests/unit/selection-outline-zoom.test.mjs 의 U-M63-0.
   ★왜 사람이 못 하나: DEPS 를 손으로 맞추는 규약은 «반드시» 갈라진다. 갈라지면
     잘라 넣은 코드가 `X is not defined` 로 던지고 → 응답이 안 끝나고 → «무한 대기».
     경고로는 못 막는다. 검사만 막는다(골 §5.4).
═══════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';

/** 파일에서 최상위 선언 «원문»을 잘라낸다(최상위는 0열 `}` 로 끝난다). */
export function sliceTopLevel(src, head, { file = '<src>' } = {}) {
  const i = src.indexOf(head);
  if (i < 0) throw new Error(`[loadcheck] ${file} 에서 «${head}» 를 못 찾음 — 하네스가 옛 소스를 보고 있다`);
  const end = src.indexOf('\n}\n', i);
  if (end <= i) throw new Error(`[loadcheck] ${file} 의 «${head}» 끝(0열 })을 못 찾음`);
  return src.slice(i, end + 3);
}

/** 한 줄짜리 `const NAME = ...;` 선언을 잘라낸다. */
export function sliceConstLine(src, name, { file = '<src>' } = {}) {
  const re = new RegExp(`^const\\s+${name}\\s*=[^\\n]*;`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`[loadcheck] ${file} 에서 const ${name} 을 못 찾음`);
  return m[0];
}

/**
 * ★핵심. 잘라 넣은 본문이 부르는 이름 중, «원본 소스에 선언이 있는데»
 *   컨텍스트에 안 실린 것을 돌려준다. 빈 배열이어야 한다.
 *
 * @param body     실제로 컨텍스트에 넣을 소스 문자열(잘라낸 것 전부를 이어붙인 것)
 * @param src      원본 파일 전문 — 「이 이름이 원래 선언이었나」 판정에 쓴다
 * @param provided 컨텍스트에 «있는» 이름들(잘라 넣은 선언 + 스텁으로 꽂은 것 + 전역)
 * @param pattern  셀 이름 모양. 기본은 식별자 전부.
 */
export function missingSymbols(body, src, provided, { pattern = /\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g } = {}) {
  const called = new Set([...body.matchAll(pattern)].map(m => m[1]));
  const have = new Set(provided);
  const declaredInSrc = n =>
    new RegExp(`(?:function|const|let|var|class)\\s+${n}\\b`).test(src);
  return [...called].filter(n => !have.has(n) && declaredInSrc(n)).sort();
}

/** 파일을 읽어 위 셋을 한 번에 — 하네스 쪽 상용구 축소. */
export function openSource(absPath) {
  const src = fs.readFileSync(absPath, 'utf8');
  return {
    src,
    slice: head => sliceTopLevel(src, head, { file: absPath }),
    constLine: name => sliceConstLine(src, name, { file: absPath }),
    missing: (body, provided, opts) => missingSymbols(body, src, provided, opts),
  };
}
