#!/usr/bin/env node
/* docs-sync-check — 문서가 «가리키는 사실»이 실재하는지 센다.
 *
 * ★검사하는 것은 «말»이 아니라 «말이 가리키는 것»이다:
 *   ⒜ 문서가 적은 파일 경로가 «디스크에 있나»
 *   ⒝ 문서가 공개 API 라고 적은 이름이 «코드에 대입되나»(window.X = )
 *   ⒞ 문서가 적은 type 값이 «코드에서 실제로 분기되나» (그리고 그 역도)
 *
 * ⛔「그 문장이 있나」를 세지 않는다. 말만 지키면 «낡은 말을 인증»하게 된다.
 * ⛔고정 줄번호·고정 창(slice(i, i±N))을 쓰지 않는다. 마크다운 «구조»(제목 경계)로만 자른다.
 *
 * 세는 명령:  node tools/docs-sync-check.mjs
 *   불일치 0 → exit 0 / 있으면 목록을 찍고 exit 1
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOC = 'docs/TEMPLATE_SYSTEM.md';
/* 이 문서가 «자기 API 라고 주장하는» 코드. ⒝는 여기서만 찾는다 —
   아무 파일에서나 찾으면 남의 모듈 함수를 자기 API 로 적어도 통과한다. */
const OWNED = ['js/panels/template-system.js', 'js/panels/template-browser.js'];
const TYPE_SRC = 'js/panels/template-system.js';

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const problems = [];
const counted = { paths: 0, apis: 0, types: 0 };

const doc = read(DOC);
const docLines = doc.split('\n');

/* ── 마크다운 구조로 자른다: 제목 텍스트로 절을 찾고 «다음 같은 레벨 제목» 전까지 ── */
function sectionByHeading(needle) {
  const start = docLines.findIndex((l) => /^#{2,3}\s/.test(l) && l.includes(needle));
  if (start === -1) return null;
  const level = docLines[start].match(/^#+/)[0].length;
  let end = docLines.length;
  for (let i = start + 1; i < docLines.length; i++) {
    const m = docLines[i].match(/^(#+)\s/);
    if (m && m[1].length <= level) { end = i; break; }
  }
  return docLines.slice(start, end);
}

/* 표의 첫 칸에서 백틱 토큰을 뽑는다(구분선·헤더 행 제외) */
function firstCellTokens(lines) {
  const out = [];
  for (const l of lines) {
    if (!l.trim().startsWith('|')) continue;
    if (/^\s*\|[\s:|-]+\|\s*$/.test(l)) continue;      // ---|--- 구분선
    const cells = l.split('|').slice(1, -1);
    if (!cells.length) continue;
    const toks = [...cells[0].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    if (toks.length) out.push({ row: l, tokens: toks });
  }
  return out;
}

/* ── ⒜ 경로: 문서 전체의 백틱 토큰 중 «저장소 경로 모양»인 것 ── */
const PATH_HEAD = /^(js|css|docs|tools|tests|main|pages|templates)\//;
const PATH_FILE = /^(main\.js|index\.html|preload\.js)$/;
const allTokens = [...doc.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim());
const pathTokens = [...new Set(allTokens)].filter((t) => {
  if (/[{}<>*\s]/.test(t)) return false;              // {id} · <userData> 같은 자리표시자는 경로가 아니다
  return PATH_HEAD.test(t) || PATH_FILE.test(t);
});
for (const p of pathTokens) {
  counted.paths++;
  if (!fs.existsSync(path.join(ROOT, p))) problems.push(`경로 없음        ${p}`);
}

/* ── ⒝ 공개 API: 그 절의 표 첫 칸 이름이 owned 파일에서 window.X 로 대입되나 ── */
const apiSec = sectionByHeading('공개 API');
if (!apiSec) {
  problems.push('절 없음          「공개 API」 제목을 못 찾았다');
} else {
  const ownedSrc = OWNED.map(read).join('\n');
  for (const { tokens } of firstCellTokens(apiSec)) {
    for (const raw of tokens) {
      const name = raw.replace(/\(.*$/, '').trim();    // foo(a,b) → foo
      if (!/^[A-Za-z_$][\w$]*$/.test(name)) continue;
      counted.apis++;
      const assigned = new RegExp(`window\\.${name}\\s*=`).test(ownedSrc);
      if (!assigned) problems.push(`API 없음         ${name}  (window.${name} = 대입이 ${OWNED.join(', ')} 에 없다)`);
    }
  }
}

/* ── ⒞ type 값: 문서 ↔ 코드 «양방향» ── */
const typeSec = sectionByHeading('템플릿 타입');
if (!typeSec) {
  problems.push('절 없음          「템플릿 타입」 제목을 못 찾았다');
} else {
  const src = read(TYPE_SRC);
  const branched = new Set(
    [...src.matchAll(/tpl\.type\s*===\s*'([a-z-]+)'/g)].map((m) => m[1])
  );
  const documented = new Set();
  for (const { row, tokens } of firstCellTokens(typeSec)) {
    const t = tokens[0];
    if (!/^[a-z-]+$/.test(t)) continue;
    documented.add(t);
    counted.types++;
    // 분기가 있거나, «기본값»(분기 없이 흘러오는 값)이라고 문서가 밝혔거나
    if (!branched.has(t) && !row.includes('기본값')) {
      problems.push(`type 미분기      '${t}'  (${TYPE_SRC} 에 tpl.type === '${t}' 분기가 없다)`);
    }
  }
  for (const t of branched) {
    if (!documented.has(t)) problems.push(`type 누락        '${t}' 가 코드엔 있는데 문서 표에 없다`);
  }
}

/* ── 결과 ── */
const total = counted.paths + counted.apis + counted.types;
console.log(
  `docs-sync-check ${DOC} — 경로 ${counted.paths} · API ${counted.apis} · type ${counted.types} ` +
  `= ${total}건 검사 · 불일치 ${problems.length}`
);
if (problems.length) {
  for (const p of problems) console.log('  ⛔ ' + p);
  process.exit(1);
}
process.exit(0);
