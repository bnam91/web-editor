/* _name-to-markup — 「사람이 지은 «이름»이 «마크업 틀»로 이어지는 자리」를 소스에서 찾아 주는 부품.
 *
 * ★왜 있나 (T-049)
 *   프로젝트/폴더 «이름»과 «아이디»는 사용자가 적는 값이다. 그 값을 템플릿 리터럴로
 *   HTML 에 이어붙이면 이름 안의 꺾쇠가 «글자»가 아니라 «마크업»으로 읽힌다.
 *   T-049 는 그 자리를 «하나씩» 고쳤는데, 그 카드가 네 번 덜 셌다. 손으로 센 명부는 늙는다.
 *   ⇒ 여기서는 이름을 «열거하지 않고» 찾는다. 선례 — js/insert-history.js 의 MATCH,
 *     tests/unit/release-gate-wiring.test.mjs 의 R5(로스터를 «행위»로 만든다).
 *
 * ★어떻게 «행위»로 세나 — 세 걸음이다.
 *   ⑴ 문(門) — 앱이 스스로 정한 «이름을 내주는 접근자»에서 출발한다(ORIGINS).
 *      변수 이름을 뒤지지 않는다. T-126 이 그 함정을 값으로 치렀다(인자 이름이 label 이라
 *      «이름다운 이름»을 찾던 그물 밖으로 빠졌다).
 *   ⑵ 홉 — 그 값의 별명을 «두 세대»까지 따라간다(원본 → 별명 → 콜백 인자).
 *      ⛔끝까지 번지게 두면 한 글자 변수(f·t)를 타고 파일 전체가 뜨거워진다(실측).
 *   ⑶ 틀 — «마크업을 짓는» 템플릿 리터럴 안의 보간 중 그 값이 실린 것을 센다.
 *      이스케이프를 «거치는» 것은 세지 않는다.
 *
 * ⛔이 부품은 «소스 모양»만 잰다. 화면에서 실제로 어떻게 보이는지는 여기서 안 잰다.
 *   초록을 「앱에서 안전하다」로 읽지 마라.
 * ⚠️한계(단언하지 않고 적는다)
 *   · 호출 «인자» 자리에 든 원본은 값으로 안 센다(fn(getProjectName()) 의 결과는 안 따라간다).
 *   · 파일을 건너가는 흐름(A 에서 만든 이름을 B 가 그리는 길)은 안 센다. 파일 안에서만 본다.
 *   · 리팩터링으로 접근자 이름이 바뀌면 이 부품이 «조용히 0건»이 된다 —
 *     그래서 쓰는 쪽에서 ORIGINS 의 실재를 «먼저» 단언해야 한다(양성대조).
 */
'use strict';

/** 앱이 «이름/아이디를 내주는» 문. 이름 명부가 아니라 «접근자» 명부다. */
const ORIGINS = [
  'openTabs', '_getTabs', '_getActId', 'activeProjectId',   // 열린 탭 · 활성 프로젝트
  'getProjectName', 'currentFileName',                      // 프로젝트/파일 이름
  'assetsGetAllFolders',                                    // 자산 폴더 이름
  'listProjects', 'sangpe-projects',                        // 프로젝트 명부
  'web-editor-open-tabs',                                   // 탭 상태(브라우저 저장소에 박힌 이름)
];

const OBJ = new RegExp([
  '\\bopenTabs\\b',
  '\\b_getTabs\\s*\\(\\s*\\)',
  '\\bassetsGetAllFolders\\s*\\(\\s*\\)',
  '\\blistProjects\\s*\\??\\.?\\(\\s*\\)',
  '\\bgetItem\\s*\\(\\s*[\'"`](?:sangpe-projects|web-editor-open-tabs)',
  '\\b(?:PROJECTS_KEY|TAB_STATE_KEY)\\s*\\)',
].join('|'));
const SCALAR = /\b(?:getProjectName|currentFileName|activeProjectId|_getActId)\b/;
/** 사람이 «적는» 칸. 이 셋만 본다 — updatedAt 같은 기계값은 위협이 아니다. */
const FIELD = '(?:name|title|label|id)';
/** 태그를 «여는» 꼴이 있으면 그 템플릿은 마크업을 짓는다. */
const MARKUP = /<\s*[a-zA-Z][a-zA-Z0-9-]*[\s>/]/;
/** 이스케이프를 «거치는» 보간은 안 센다(이름은 안 보고 «거치는가»만 본다). */
const ESCAPED = /\b\w*(?:esc|escape|sanitiz|encodeURI)\w*\s*\(/i;

/** 템플릿 리터럴을 중첩까지 뽑는다. {raw, start, exprs:[{text, at, outer}]} */
function templates(code) {
  const out = [];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '\\') { i++; continue; }
    if (code[i] !== '`') continue;
    const start = i; const exprs = []; let j = i + 1, closed = false;
    for (; j < code.length; j++) {
      const c = code[j];
      if (c === '\\') { j++; continue; }
      if (c === '`') { closed = true; break; }
      if (c === '$' && code[j + 1] === '{') {
        let depth = 1, k = j + 2, bt = 0;
        for (; k < code.length; k++) {
          const d = code[k];
          if (d === '\\') { k++; continue; }
          if (d === '`') bt ^= 1;
          if (bt) continue;
          if (d === '{') depth++;
          else if (d === '}') { depth--; if (!depth) break; }
        }
        const inner = code.slice(j + 2, k);
        for (const t of templates(inner)) for (const e of t.exprs) exprs.push({ text: e.text, at: j + 2 + e.at });
        exprs.push({ text: inner, at: j, outer: true });
        j = k;
      }
    }
    if (!closed) continue;
    out.push({ raw: code.slice(start, j + 1), start, exprs });
    i = j;
  }
  return out;
}

/** 호출 «인자» 자리는 그 식의 «값»이 아니다 — 걷어낸다. */
function valueOf(rhs) {
  let t = String(rhs), prev;
  do { prev = t; t = t.replace(/\(([^()]*)\)/g, (m, inner) => (inner.trim() === '' ? '()' : '(…)')); } while (t !== prev);
  return t;
}

/** `X = …` 의 값 쪽을 괄호 깊이를 보며 잘라 온다(최대 400자). */
function assignments(code) {
  const out = [];
  for (const m of code.matchAll(/(?:(?:const|let|var)\s+|[;{}\n]\s*)([A-Za-z_$][\w$]*)\s*=(?!=|>)\s*/g)) {
    let i = m.index + m[0].length, depth = 0, q = null;
    const lim = Math.min(code.length, i + 400);
    for (; i < lim; i++) {
      const c = code[i];
      if (c === '\\') { i++; continue; }
      if (q) { if (c === q) q = null; continue; }
      if (c === '"' || c === "'" || c === '`') { q = c; continue; }
      if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)) { if (depth === 0) break; depth--; }
      else if (c === ';' && depth === 0) break;
    }
    out.push({ name: m[1], value: code.slice(m.index + m[0].length, i) });
  }
  return out;
}

/** 원본을 «되돌려 주는» 함수도 문이다 — loadProjects() 처럼 한 겹 감싼 자리. */
function gateFunctions(code) {
  const names = [];
  const re = /(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(?[^)\n]*\)?\s*=>/g;
  for (const m of code.matchAll(re)) {
    const n = m[1] || m[2];
    if (!n) continue;
    const body = code.slice(m.index, m.index + 600);
    const returns = (body.match(/\breturn\b[^;]{0,160}/g) || []).join(' ');
    if (returns && OBJ.test(returns)) names.push(n);
  }
  return names;
}

/**
 * 주석이 걷힌 소스 하나를 재서 {objects, names, hits} 를 돌려준다.
 *   objects — «이름을 든 꾸러미»의 별명(탭 하나·폴더 하나·프로젝트 하나)
 *   names   — «이름 글자 그 자체»의 별명
 *   hits    — 마크업 틀 안에서 그 값을 이스케이프 없이 이어붙인 보간
 */
function scan(code) {
  const decls = assignments(code);
  const fns = gateFunctions(code);
  const OBJX = fns.length ? new RegExp(OBJ.source + '|\\b(?:' + fns.join('|') + ')\\s*\\(') : OBJ;

  const objects = new Set();
  let gen = [null];                       // null = 접근자 자신
  /* 세대 하나를 «한 벌»의 정규식으로 컴파일한다 — 선언마다 새로 짓던 것이 이 부품의 값이었다. */
  const genTest = (g) => {
    const ids = g.filter(o => o !== null);
    const re = ids.length ? new RegExp(`\\b(?:${ids.join('|')})\\b`) : null;
    const origin = g.includes(null);
    return (s) => (origin && OBJX.test(s)) || (!!re && re.test(s));
  };
  for (let hop = 0; hop < 2; hop++) {     // ⛔두 세대까지만
    const inGen = genTest(gen);
    const next = [];
    for (const d of decls) if (inGen(valueOf(d.value)) && !objects.has(d.name)) { objects.add(d.name); next.push(d.name); }
    for (const m of code.matchAll(/([A-Za-z_$][\w$.?()\s]*?)\s*[.?]+\s*(?:map|forEach|find|filter|flatMap)\s*\(\s*\(?\s*([A-Za-z_$][\w$]*)/g))
      if (inGen(m[1]) && !objects.has(m[2])) { objects.add(m[2]); next.push(m[2]); }
    for (const m of code.matchAll(/for\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s+of\s+([^)]+)\)/g))
      if (inGen(m[2]) && !objects.has(m[1])) { objects.add(m[1]); next.push(m[1]); }
    if (!next.length) break;
    gen = next;
  }

  const fieldRead = new RegExp(
    `(?:${[...objects].map(o => `\\b${o}\\b`).join('|') || 'x^'})\\s*\\??[.\\[]\\s*['"]?${FIELD}\\b`, 'i');

  const names = new Set();
  for (const d of decls) {
    const v = valueOf(d.value);
    if (SCALAR.test(v) || (objects.size && fieldRead.test(v))) names.add(d.name);
  }

  /* 이름 별명은 «한 벌»로 묶어 한 번만 컴파일한다 — 보간마다 새로 짓던 것이 제일 비쌌다. */
  const nameRe = names.size ? new RegExp(`\\b(?:${[...names].join('|')})\\b`) : null;
  const carries = (txt) => {
    if (ESCAPED.test(txt)) return false;
    if (SCALAR.test(txt)) return true;
    if (objects.size && fieldRead.test(txt)) return true;
    return !!nameRe && nameRe.test(txt);
  };

  const hits = [];
  for (const t of templates(code)) {
    if (!MARKUP.test(t.raw)) continue;
    for (const e of t.exprs) {
      if (e.outer && /`/.test(e.text)) continue;   // 바깥 껍데기는 안쪽에서 이미 센다
      if (carries(e.text)) hits.push({ at: e.at, text: e.text.trim().replace(/\s+/g, ' ').slice(0, 90) });
    }
  }
  return { objects, names, hits };
}

/** 이 파일이 «이름을 내주는 문»에 닿는가 = 로스터에 드는가. */
function touchesOrigin(code) {
  return OBJ.test(code) || SCALAR.test(code);
}

const lineOf = (code, idx) => code.slice(0, idx).split('\n').length;

module.exports = { ORIGINS, scan, touchesOrigin, templates, lineOf, MARKUP };
