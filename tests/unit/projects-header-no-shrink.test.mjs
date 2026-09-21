/* projects-header-no-shrink — 프로젝트 목록 헤더의 «줄어들면 안 되는 쪽»이 줄지 않는가.
 *
 * ★왜 있나 (2026-09-21, 현빈 제보: 「메인홈페이지에 new design 버튼 보이는 거 깨져보여 줄바꿈이 됐어」)
 *   실측 경계 — 창 1300px 이상 한 줄 / 1280px 이하 «New / Design» 두 줄.
 *   버튼 height 가 32px 고정이라 두 줄이 되면 글자가 상자 «밖»으로 나간다.
 *
 * ★뿌리는 «주석이 사실과 달랐던» 것이다.
 *   #proj-search 머리주석은 「h1/.header-actions 는 flex-shrink:0」이라 적었지만,
 *   `.header-actions { flex-shrink: 0 }` 를 `#header > .header-actions { flex: 1 1 0 }`(B안 09-19)가
 *   더 높은 특정성으로 덮어 계산값이 shrink:1 이었다(실앱 getComputedStyle 실측).
 *   ⇒ 「선언했다」와 「계산값이 그렇다」는 다른 축이다. 이 검사는 «선언이 덮이지 않았는가»를 잰다.
 *
 * ⚠️이 검사는 소스 문자열을 본다. 정상 리팩터링에도 빨강이 날 수 있다 — 그때는 지우지 말고
 *   「헤더 동작 칸이 내용보다 작아질 수 있는가」를 실제로 재 본 뒤 패턴을 고쳐라.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../../');
const SRC = readSrc(REPO, 'pages/projects.html');

/** `#header > .header-actions { … }` 선언 블록을 꺼낸다. */
function headerActionsRule() {
  const m = /#header\s*>\s*\.header-actions\s*\{([^}]*)\}/.exec(SRC);
  assert.ok(m, '#header > .header-actions 규칙을 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라');
  return m[1];
}

test('H1 — 헤더 동작 칸은 «내용보다 작아지지» 않는다', () => {
  const body = headerActionsRule();
  const shrinkable = /flex:\s*\d+\s+[1-9]/.test(body);   // flex: 1 1 0 처럼 shrink 가 0이 아닌가
  if (shrinkable) {
    assert.match(body, /min-width:\s*max-content/,
      'flex 단축속성이 flex-shrink 를 0 이 아닌 값으로 덮는다. 그러면 창이 좁을 때 ' +
      'New Design 글자가 두 줄로 깨진다(실측 경계 1280px). ' +
      '`flex: 1 1 0` 을 지우지 말고 min-width: max-content 로 바닥을 깔아라.');
  }
});

test('H2 — 헤더 버튼 글자는 어떤 경우에도 두 줄이 되지 않는다', () => {
  /* 버튼 높이가 고정이라 줄바꿈 = 상자 밖으로 삐져나옴. 이중 안전망을 못박는다. */
  const m = /#btn-new[^{]*\{[^}]*white-space:\s*nowrap/.exec(SRC)
        || /(#btn-new\b[^{]*,\s*)*#btn-new-label[^{]*\{[^}]*white-space:\s*nowrap/.exec(SRC);
  assert.ok(m, '#btn-new / #btn-new-label 에 white-space: nowrap 이 없다 — 폭이 좁아지면 글자가 쪼개진다');
});

test('H3 — 줄어드는 칸은 «검색칸 하나»라는 설계가 유지된다', () => {
  /* ★규칙이 «여럿»이다(#proj-search 와 #header > #proj-search). 첫 매치만 보면 엉뚱한 쪽을 집는다 —
     실제로 이 검사를 처음 썼을 때 `#header > #proj-search` 를 집어 거짓 빨강이 났다. 전부 보고 «어딘가에» 있으면 통과. */
  const bodies = [...SRC.matchAll(/#proj-search\s*\{([^}]*)\}/g)].map(m => m[1]);
  assert.ok(bodies.length, '#proj-search 규칙을 못 찾았다');
  assert.ok(bodies.some(b => /min-width:\s*\d+px/.test(b)),
    `검색칸에 min-width 바닥이 없다 — 이 칸이 무한히 줄면 다른 칸이 대신 찌그러진다 (본 규칙 ${bodies.length}개)`);
});
