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

/* ══ ★축(AXIS) ══════════════════════════════════════════════════════════
 * ★왜 생겼나 (T-049 2차) — 위의 ORIGINS 는 «프로젝트·폴더·탭» 한 축만 연다.
 *   로스터는 «행위»로 만들었는데 «들어올 자격»이 손목록이라, 레이어·섹션·변수·브랜치
 *   이름은 검사 대상에 한 번도 들어온 적이 없었다. 그래서 초록인 채로 열려 있었다.
 *   ⇒ 문을 «갈아끼울 수 있게» 한다. 기본값은 예전 그대로라 기존 검사는 안 흔들린다.
 * ⛔여기에 «자리(파일:줄)»를 적지 마라. 적는 것은 «문»뿐이다. */
const AXIS_PROJECT = { key: 'project', ORIGINS, OBJ, SCALAR, FIELD, hops: 2 };

/** ⑤레이어 · ④섹션 · ⑥변수 · ⑦브랜치 · ⑨아이콘 · ⑪폰트 · ⑫채팅프로필 이름의 문. */
const ORIGINS_NAMES = [
  'dataset.layerName',        // ⑤ 레이어 이름 (블록·그룹·프레임)
  'sec._name',                // ④ 섹션 이름
  'VariableStore.listVars',   // ⑥ 변수 이름
  'loadBranchStore',          // ⑦ 브랜치 스토어
  'store.branches',           // ⑦ 브랜치 이름 꾸러미
  'svgPresets',               // ⑨ 아이콘 분류
  'dataset.iconName',         // ⑨ 아이콘 이름
  'dataset.messages',         // ⑫ 채팅 메시지(프로필 이름이 든 꾸러미)
  'dataset.layers',           // 캔버스 블록의 층 이름표
  '_fontDisplayName',         // ⑪ 폰트 표시 이름
];
const OBJ_NAMES = new RegExp([
  '\\bJSON\\.parse\\s*\\(\\s*[\\w$.?]*\\bdataset\\s*\\.\\s*\\w+',  // dataset 에 든 꾸러미(층·메시지…)
  '\\bVariableStore\\s*\\.\\s*listVars\\s*\\(',
  '\\bloadBranchStore\\s*\\(',
  '\\bstore\\s*\\.\\s*branches\\b',
  '\\bsvgPresets\\s*\\??\\.',
  '\\b_presetCategories\\b',
].join('|'));
const SCALAR_NAMES = new RegExp([
  '\\bdataset\\s*\\.\\s*\\w*[Nn]ame\\b',   // dataset.layerName · dataset.name · dataset.iconName …
  '\\b_name\\b',                              // sec._name
  '\\b_fontDisplayName\\s*\\(',
].join('|'));
/** 이 축에서 «사람이 적는» 칸 — 위 넷에 층/메시지 꾸러미가 쓰는 칸을 더한다. */
const FIELD_NAMES = '(?:name|title|label|id|layerName|profileName|iconName|family|content)';
const AXIS_NAMES = {
  key: 'names', ORIGINS: ORIGINS_NAMES, OBJ: OBJ_NAMES,
  SCALAR: SCALAR_NAMES, FIELD: FIELD_NAMES, hops: 3,
};
const AXES = { PROJECT: AXIS_PROJECT, NAMES: AXIS_NAMES };
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
        /* ★outer 표시를 «같이» 올린다 — 떨어뜨리면 한 단계 위에서 그 껍데기가 다시 «안쪽»으로 세어져
           `${scope.map(() => \`…\`)}` 같은 껍데기가 빨강으로 두 번 잡힌다(실측 2026-09-22). */
        for (const t of templates(inner)) for (const e of t.exprs) exprs.push({ text: e.text, at: j + 2 + e.at, outer: e.outer });
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

/** ★「이름이 실렸나」와 「이름이 «그려지나»」는 다르다.
 *  `cond ? 'checked' : ''` 는 조건 쪽에 이름이 있어도 «화면에 나가는 값»은 개발자 리터럴뿐이다.
 *  그 자리를 빨강으로 세면, 고칠 것이 없는데 빨간 줄이 남아 게이트가 「원래 빨간 것」이 된다.
 *  ⛔조건 쪽을 안 본다는 뜻이 아니다 — 조건은 판정에 안 쓰이고 «내보내는 값»만 본다.
 *  (실측 2026-09-22: prop-chat 의 showName, variable-binding 의 currentColorBound 비교 셋이 이 꼴이었다.) */
function rendersOnlyLiterals(expr) {
  const t = String(expr).trim();
  const q = t.indexOf('?');
  if (q < 0) return false;
  let depth = 0, colon = -1;
  for (let i = q + 1; i < t.length; i++) {
    const c = t[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === '"' || c === "'" || c === '`') { const qc = c; i++; while (i < t.length && t[i] !== qc) { if (t[i] === '\\') i++; i++; } }
    else if (c === ':' && depth === 0) { colon = i; break; }
  }
  if (colon < 0) return false;
  const lit = /^\s*(?:'[^']*'|"[^"]*"|`[^`$]*`)\s*$/;
  return lit.test(t.slice(q + 1, colon)) && lit.test(t.slice(colon + 1));
}

/** 식 안의 중첩 템플릿 리터럴만 «길이를 지켜» 지운다(안쪽은 따로 세므로). */
function maskNested(text) {
  let out = text;
  for (const t of templates(text)) {
    const n = t.raw.length;
    out = out.slice(0, t.start) + ' '.repeat(n) + out.slice(t.start + n);
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
function gateFunctions(code, OBJ = AXIS_PROJECT.OBJ) {
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
/* ★템플릿 리터럴 «안»은 JS 가 아니라 HTML 이다.
     `<input title="값 편집" …>` 의 `title=` 를 «대입문»으로 읽으면 그 속성 이름이
     통째로 «이름 별명»이 되어 엉뚱한 보간까지 빨개진다(실측: variable-binding.js 에서
     title·type·value 가 별명이 되어 v.type·v.value 까지 걸렸다).
   ⇒ 대입문을 찾을 때만 리터럴 «속»을 공백으로 가린다. 길이는 그대로 둬서 위치가 안 밀린다. */
function maskTemplates(code) {
  let out = code;
  for (const t of templates(code)) {
    const inner = t.raw.length - 2;
    if (inner <= 0) continue;
    out = out.slice(0, t.start + 1) + ' '.repeat(inner) + out.slice(t.start + 1 + inner);
  }
  return out;
}

function scan(code, axis = AXIS_PROJECT) {
  const { OBJ, SCALAR, FIELD, hops = 2 } = axis;
  const decls = assignments(maskTemplates(code));
  const fns = gateFunctions(code, OBJ);
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
  for (let hop = 0; hop < hops; hop++) {  // ⛔세대 수는 축이 정한다(기본 둘)
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
  /* «이름이 실렸나»와 «이스케이프를 지나나»를 나눠 본다 —
     hits 의 뜻은 예전과 똑같고(안 지나는 것만), 지나는 것은 escaped 로 따로 센다.
     ★escaped 가 있어야 「계측기가 그냥 다 빨간 게 아니다」를 같은 축에서 보일 수 있다. */
  const bears = (txt) => {
    if (SCALAR.test(txt)) return true;
    if (objects.size && fieldRead.test(txt)) return true;
    return !!nameRe && nameRe.test(txt);
  };

  const hits = [];
  const escaped = [];
  /* ★bears 를 내보낸다 — 「이 식이 이름을 싣고 있나」를 쓰는 쪽에서 «자리를 골라» 다시 물을 수 있게.
     (G7 이 «인라인 핸들러 «안»의 보간»만 따로 재는 데 쓴다. 판정 규칙을 베껴 쓰면 두 벌이 된다.) */
  for (const t of templates(code)) {
    if (!MARKUP.test(t.raw)) continue;
    for (const e of t.exprs) {
      /* ★바깥 껍데기 — 안쪽 템플릿은 «따로» 세므로 여기서 다시 세면 이중계수다.
         ⛔그렇다고 통째로 건너뛰면 «껍데기 층에 실린 값»이 통째로 안 보인다.
           실측 2026-09-22: `${fn({ icon: \`<svg…>\`, name: 이름 })}` 꼴에서 이름이 껍데기 층에 있는데
           안쪽 백틱 하나 때문에 33곳 중 31곳이 그물 밖으로 빠졌다(2곳만 걸렸다 — 아이콘 없는 둘).
         ⇒ 안쪽 리터럴만 «길이를 지켜» 지우고, 남은 껍데기 층을 본다. */
      const hadNested = e.outer && /`/.test(e.text);
      const shell = hadNested ? maskNested(e.text) : e.text;
      /* ★지운 자리가 «되풀이의 몸통»이면 껍데기는 그저 흐름이다 — 그 몸통은 따로 센다.
         (`${arr.map(x => \`…\`)}` 의 껍데기엔 값이 안 실린다. 반대로
          `${fn({ icon: \`…\`, name: 이름 })}` 은 껍데기 층에 값이 실린다 — 그건 봐야 한다.) */
      if (hadNested && /\.\s*(?:map|forEach|flatMap|filter|reduce)\s*\(/.test(shell)) continue;
      if (!bears(shell)) continue;
      if (rendersOnlyLiterals(shell)) continue;    // ★값이 리터럴뿐이면 «이름이 안 나간다»
      const row = { at: e.at, text: e.text.trim().replace(/\s+/g, ' ').slice(0, 90) };
      (ESCAPED.test(e.text) ? escaped : hits).push(row);
    }
  }
  return { objects, names, hits, escaped, bears };
}

/** 이 파일이 «이름을 내주는 문»에 닿는가 = 로스터에 드는가. */
function touchesOrigin(code, axis = AXIS_PROJECT) {
  return axis.OBJ.test(code) || axis.SCALAR.test(code);
}

const lineOf = (code, idx) => code.slice(0, idx).split('\n').length;

module.exports = { ORIGINS, AXES, AXIS_PROJECT, AXIS_NAMES, scan, touchesOrigin, templates, lineOf, MARKUP, ESCAPED };
