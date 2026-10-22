/* _clone-removals — 「클론에서 ★요소를 지우는 자리」를 소스에서 ★기계로 읽는 ★한 벌 (2026-10-22 imac-지디워커).
 *   쓰는 검사: tests/unit/capture-drop-axis.test.mjs(drop 축) · tests/unit/capture-derive-roster.test.mjs(편집 노드 정본 파생).
 *   ⛔두 검사가 파서를 따로 들면 한쪽만 늙는다 — 그래서 여기 하나로 뺐다(d8d61d00 에서 옮김 · 몸통 무변).
 *   (밑줄 파일 = 테스트 글롭 밖 도구) */
export function closeParen(s, open) {
  let d = 0;
  for (let k = open; k < s.length; k++) {
    if (s[k] === '(') d++;
    else if (s[k] === ')' && --d === 0) return k;
  }
  return -1;
}

/** 함수 몸통(중괄호 균형). 없으면 null. ⚠️매개변수 괄호를 먼저 닫는다(기본값 중괄호 오인 방지). */
export function fnBody(code, name) {
  const m = new RegExp(`function\\s+${name}\\s*\\(`).exec(code);
  if (!m) return null;
  const pc = closeParen(code, m.index + m[0].length - 1);
  const i = code.indexOf('{', pc);
  let d = 0;
  for (let k = i; k < code.length; k++) {
    if (code[k] === '{') d++;
    else if (code[k] === '}' && --d === 0) return code.slice(i, k + 1);
  }
  return null;
}

/** 몸통에서 «querySelectorAll(X).forEach(cb)» 중 ★cb 가 `.remove()` 를 부르는 것의 선택자 전수.
 *  X 가 문자열 리터럴이면 쉼표로 쪼갠다 · 식별자면 `$이름`.
 *  ★`covered` = 그 cb 들 안의 `.remove()` 수 — ★몸통 전체 수와 견주어 ★«파서가 못 읽는 지우기 꼴»을 잡는다(D2). */
export function removedSelectors(body) {
  const sels = [];
  let covered = 0;
  const re = /querySelectorAll\??\.?\(/g;
  let m;
  while ((m = re.exec(body))) {
    const open = m.index + m[0].length - 1;
    const close = closeParen(body, open);
    if (close < 0) continue;
    const arg = body.slice(open + 1, close).trim();
    const fe = /^\s*\??\.?forEach\s*\(/.exec(body.slice(close + 1));
    if (!fe) continue;
    const fo = close + 1 + fe[0].length - 1;
    const cb = body.slice(fo, closeParen(body, fo) + 1);
    const n = (cb.match(/\.remove\(\s*\)/g) || []).length;
    if (!n) continue;
    covered += n;
    const lit = /^(['"`])([^'"`]*)\1$/.exec(arg);
    if (lit) lit[2].split(',').map(s => s.trim()).filter(Boolean).forEach(s => sels.push(s));
    else sels.push('$' + arg);
  }
  return { sels, covered, total: (body.match(/\.remove\(\s*\)/g) || []).length };
}
