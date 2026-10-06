/* settings-mvp-tabs-single — 현빈 08-28 「MVP 제외 탭」 정의가 «한 자리»에, «현빈 문장 그대로» 있는가.
 *
 * ★왜 있나 (2026-10-06, 지디 발주 TWO ⒜ 허용 조건 ㉠㉡)
 *   S7 술어(window.isSettingsTabEnabled)가 같은 값을 읽도록 MVP_DISABLED_TABS 정의 4줄을 ensureModal 안에서
 *   IIFE 머리로 «옮겼다»(내용 바이트 동일 · 들여쓰기만 4→2). 지디가 허용한 근거는 둘이었다:
 *     ⒜ 정의 자리 수 == 1 (둘로 갈리면 술어와 탭 막기가 서로 다른 명부를 읽는다)
 *     ⒝ 현빈 문장이 그대로 남아 있다 (값·뜻·문장 무변경)
 *   ⇒ 그 둘을 자로 세운다. 「주석이 길다」고 지우거나 값을 복사해 두 벌로 만드는 날 빨갛다.
 * ⛔이 검사는 «값»을 고정하지 않는다 — 문을 여는 것은 현빈 결정이다. 값이 바뀌면 이 검사의 S2 기대값이 아니라
 *   «현빈 문장»(S3)부터 같이 고쳐야 한다는 신호로 읽어라.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');
const SRC = readSrc(REPO, 'js/settings/settings-modal.js');

test('S1 — MVP_DISABLED_TABS 정의 자리가 정확히 하나', () => {
  const defs = SRC.match(/\b(const|let|var)\s+MVP_DISABLED_TABS\s*=/g) || [];
  assert.equal(defs.length, 1, `정의가 ${defs.length} 곳 — 두 벌이면 술어(isSettingsTabEnabled)와 탭 막기가 다른 명부를 읽는다`);
});

test('S2 — 술어와 탭 막기가 «그 하나»를 읽는다(값을 복사하지 않는다)', () => {
  assert.match(SRC, /window\.isSettingsTabEnabled\s*=\s*\(tab\)\s*=>\s*!MVP_DISABLED_TABS\.includes\(tab\)/, '술어가 MVP_DISABLED_TABS 를 직접 읽지 않는다');
  assert.match(SRC, /MVP_DISABLED_TABS\.includes\(btn\.dataset\.tab\)/, '탭 막기가 MVP_DISABLED_TABS 를 직접 읽지 않는다');
});

test('S3 — 현빈 08-28 문장 4줄이 정의 바로 위에 그대로 있다', () => {
  const HYUNBIN = [
    "/* ★[MVP 제외] 개발자·협업 탭은 «보이되 안 눌린다»(현빈 2026-08-28).",
    " *   Figma 때와 같은 방식 — 감추면 「있었다」는 것조차 사라진다. 다음 런칭에 돌아온다.",
    " *   ⛔탭 «내용»(renderDevPane 등)은 그대로 둔다. 여기서 막는 건 «들어가는 문»이다. */",
    "const MVP_DISABLED_TABS = ['dev', 'collab'];",
  ];
  const lines = SRC.split('\n').map(l => l.trim());
  const i = lines.findIndex(l => l === HYUNBIN[0].trim());
  assert.ok(i >= 0, '현빈 문장 첫 줄이 없다');
  assert.deepEqual(lines.slice(i, i + 4), HYUNBIN.map(l => l.trim()), '현빈 문장 4줄(주석 3 + 정의 1)이 연달아 그대로 있지 않다');
});
