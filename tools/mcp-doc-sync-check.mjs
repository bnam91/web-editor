#!/usr/bin/env node
/**
 * MCP 도구 목록 ⟷ 홈페이지 공개문서 대조 — 2026-09-06 신설
 *
 * 왜 있나: goditor-api.html 의 「도구 N개」와 목록을 «손으로» 세다가
 *   ⑴ 09-05 d4e1135 「71→77, 6개가 빠져 있었다」
 *   ⑵ 그 하루 전 09-04 0a0fb3c 로 들어온 5개를 또 빠뜨림
 * 이틀 연속 같은 누락이 났다. 손으로 세는 한 또 난다.
 *
 * 종료 코드 — ★2 는 «통과가 아니다»
 *   0 = 일치
 *   1 = 불일치(문서가 낡았거나, 코드에 없는 도구를 문서가 광고함)
 *   2 = 검사 자체가 못 돌았다(문서 경로 없음·파싱 실패). 통과로 읽지 말 것.
 *
 * 사용:  node tools/mcp-doc-sync-check.mjs [문서경로]
 *        (기본 ~/github/hompage_app/goditor-api.html)
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = [
  join(ROOT, 'main/claude-pm/mcp-server.js'),
  join(ROOT, 'main/claude-pm/mcp-block-tools.js'),
];
// 앱이 아니라 브리지가 답하는 도구 — registerTool 로 안 잡히니 여기 명시한다.
const BRIDGE_ONLY = ['goditor_which_instance'];

const die = (code, msg) => { console.error(msg); process.exit(code); };

/** 코드에서 registerTool 이름을 뽑는다. 두 표기(한 줄 / 줄바꿈) 다 받는다. */
function toolsFromCode() {
  const names = new Set(BRIDGE_ONLY);
  for (const f of SRC) {
    if (!existsSync(f)) die(2, `[검사불가] 소스 없음: ${f}`);
    const lines = readFileSync(f, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const inline = lines[i].match(/registerTool\(\s*'([A-Za-z0-9_]+)'/);
      if (inline) { names.add(inline[1]); continue; }
      if (/registerTool\(\s*$/.test(lines[i])) {
        const next = (lines[i + 1] || '').match(/^\s*'([A-Za-z0-9_]+)'\s*,?\s*$/);
        if (next) names.add(next[1]);
      }
    }
  }
  if (names.size < 50) die(2, `[검사불가] 도구를 ${names.size}개밖에 못 찾았다 — 추출 정규식이 소스와 어긋났다.`);
  return names;
}

/** 문서 §4(도구 목록) 절에서 <code> 이름과 소계를 뽑는다. */
function docFacts(html) {
  const s = html.indexOf('4. 도구');
  if (s < 0) die(2, '[검사불가] 문서에서 「4. 도구」 절을 못 찾았다 — 문서 구조가 바뀌었다.');
  const e = html.indexOf('</section>', s);
  if (e < 0) die(2, '[검사불가] §4 의 </section> 을 못 찾았다.');
  const sec = html.slice(s, e);

  const names = new Set([...sec.matchAll(/<code>([a-z0-9_]+)<\/code>/g)].map(m => m[1]));
  const subtotals = [...sec.matchAll(/doc-count">(\d+)</g)].map(m => +m[1]);
  const titles = [...html.matchAll(/도구 (\d+)개/g)].map(m => +m[1]);
  if (!titles.length) die(2, '[검사불가] 「도구 N개」 표기를 못 찾았다.');
  return { names, sum: subtotals.reduce((a, b) => a + b, 0), titles };
}

const docPath = process.argv[2] || join(homedir(), 'github/hompage_app/goditor-api.html');
if (!existsSync(docPath)) {
  die(2, `[검사불가] 문서가 없다: ${docPath}\n  → 홈페이지 레포를 체크아웃하고 다시 돌려라. «통과가 아니다».`);
}

const code = toolsFromCode();
const doc = docFacts(readFileSync(docPath, 'utf8'));

const missing = [...code].filter(n => !doc.names.has(n)).sort();   // 코드엔 있는데 문서에 없다
const phantom = [...doc.names].filter(n => !code.has(n)).sort();   // 문서가 없는 도구를 광고한다
const badTitle = doc.titles.filter(t => t !== code.size);
const badSum = doc.sum !== code.size;

console.log(`코드 ${code.size}개 · 문서 나열 ${doc.names.size}개 · 소계 합 ${doc.sum} · 제목 [${doc.titles.join(', ')}]`);
if (!missing.length && !phantom.length && !badTitle.length && !badSum) {
  console.log('✅ 일치');
  process.exit(0);
}
if (missing.length) console.error(`❌ 문서에 «빠진» 도구 ${missing.length}개: ${missing.join(' ')}`);
if (phantom.length) console.error(`❌ 문서가 «없는» 도구를 광고: ${phantom.join(' ')}`);
if (badSum) console.error(`❌ 소계 합 ${doc.sum} ≠ 실제 ${code.size}`);
if (badTitle.length) console.error(`❌ 제목/메타의 「도구 N개」가 어긋남: ${badTitle.join(', ')} ≠ ${code.size}`);
process.exit(1);
