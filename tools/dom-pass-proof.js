#!/usr/bin/env node
/* dom-pass-proof.js — 태그 CI 가 «DOM 전수를 건너뛰어도 되나» 를 판정한다 (0.9.12 · CI-SKIP-DOM… · 현빈 결정 16 = B안)
 *
 * ★증명 = 주석 달린(annotated) 태그 «메시지»의 한 줄:
 *     DOM-PASS commit=<40자 소문자 sha> passed=N flaky=M
 *   인텔 전수가 «같은 커밋»에서 통과한 사람이 태그를 달 때 적는다(failed 0 일 때만 적는 규약).
 *   메시지는 트리를 안 바꾸므로 sha 가 안 변한다.
 * ★실패 안전 — 건너뜀은 «전부 맞을 때»만. 증명 없음·sha 불일치·형식 깨짐·여러 줄·passed 미달·
 *   dispatch·경량 태그·git 못 읽음 = 전부 «지금처럼 전부 실행».
 * ★한계(자기선언): 이 줄은 푸시 권한자가 쓴다 ⇒ «인텔이 정말 통과했나»는 이 스크립트가 못 증명한다.
 *   태그 푸시 권한 = 어차피 릴리스 권한이라 신뢰경계는 같다. 더 세우려면 `git tag -s` 서명 검증을 더해라.
 * ★MIN_PASSED = 6900 — 근거: 인텔 전수 0.9.10 e7d97f1ec 가 6994 통과(흔들림 1)였다. 6994 에서 ~1.3% 여유를 둔
 *   «하한»이다: 일부만 돌린 런을 전수로 내세우는 것을 거르는 자리이지 정확한 분모가 아니다.
 *   ⛔시험은 계속 늘므로 이 값은 «가끔 올려라»(안 올려도 안전한 방향 — 하한이 낮아질 뿐 건너뜀이 «더 쉬워지는» 쪽이다
 *   ⇒ 릴리스마다 인텔 전수 통과 수를 보고 올리는 것이 규약).
 * 출력: $GITHUB_OUTPUT 에 skip_dom=true|false, 로그에 이유 한 줄. 잠그는 자리: tests/unit/dom-pass-proof.test.mjs */
'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const MIN_PASSED = 6900;
const LINE = /^DOM-PASS commit=([0-9a-f]{40}) passed=(\d+) flaky=(\d+)$/gm;

function decide({ event, refType, message, head, minPassed = MIN_PASSED }) {
  if (event !== 'push' || refType !== 'tag') return { skip: false, reason: `태그 푸시가 아님(${event}/${refType}) — 늘 전부 실행` };
  if (!message) return { skip: false, reason: '주석 태그 메시지 없음(경량 태그거나 못 읽음) — 전부 실행' };
  const hits = [...message.matchAll(LINE)];
  if (hits.length === 0) return { skip: false, reason: 'DOM-PASS 줄 없음/형식 깨짐 — 전부 실행' };
  if (hits.length > 1) return { skip: false, reason: 'DOM-PASS 줄이 여러 개(모호) — 전부 실행' };
  const [, commit, passed] = hits[0];
  if (!/^[0-9a-f]{40}$/.test(head || '')) return { skip: false, reason: '빌드 커밋을 못 읽음 — 전부 실행' };
  if (commit !== head) return { skip: false, reason: `증명 커밋 ${commit.slice(0, 9)} ≠ 빌드 커밋 ${head.slice(0, 9)} — 전부 실행` };
  if (Number(passed) < minPassed) return { skip: false, reason: `passed ${passed} < 하한 ${minPassed} — 전부 실행` };
  return { skip: true, reason: `인텔 전수 통과 증명 일치(commit ${head.slice(0, 9)} passed=${passed}) — DOM 건너뜀` };
}

function git(args) { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }

function main() {
  const event = process.env.GITHUB_EVENT_NAME, refType = process.env.GITHUB_REF_TYPE, tag = process.env.GITHUB_REF_NAME;
  let message = '', head = '';
  try {
    head = git(['rev-parse', 'HEAD']);
    // 주석 태그만 — 경량 태그의 %(contents)는 «커밋 메시지»라서 거른다.
    if (tag && git(['cat-file', '-t', `refs/tags/${tag}`]) === 'tag') message = git(['tag', '-l', '--format=%(contents)', tag]);
  } catch { /* 못 읽음 = 전부 실행 */ }
  const r = decide({ event, refType, message, head });
  console.log(`[dom-pass-proof] ${r.reason}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `skip_dom=${r.skip}\n`);
  return r;
}

if (require.main === module) main(); else module.exports = { decide, MIN_PASSED, LINE };
