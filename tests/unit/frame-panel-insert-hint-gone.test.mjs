/* frame-panel-insert-hint-gone — 프레임 속성 패널의 «클릭 후 넣으면 안으로» 안내를 지웠다 (지디 ㉮ · 2026-11-09 · t3-07)
 *   까닭: ㉠(⒜ 걷음) 뒤로 오브젝트로 고른 프레임에 넣으면 «다음 형제»다 — 그 안내는 거짓이 됐다. 대체 문장 없음(현빈: prop 안내 줄이기).
 *   양성: 지운 문장 0건. 음성: ⑴ 이 파일의 다른 prop-hint(전폭 사유 #ss-fullbleed-why)는 산다 = 살아 있는 prop-hint 정확히 1(옛 2 → 1)
 *         ⑵ 입력 전제(코드 본문이 남았나).
 *   ⚠️되돌리면 빨개진다: 그 문장(또는 prop-hint 한 줄)을 prop-frame.js 에 다시 넣는 순간.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { stripCommentsTA, templateBalanced } = require('./_strip-comments.js');
const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../js/props/prop-frame.js');

export function check(raw) {
  assert.ok(templateBalanced(raw), 'prop-frame.js 템플릿 균형이 깨졌다 — 주석 걷기를 못 믿는다');
  const code = stripCommentsTA(raw);
  assert.ok(code.includes('showFrameProperties') && code.includes('ss-fullbleed-why'), '입력이 죽었다 — 코드 본문이 안 남았다');
  assert.equal(code.split('이 안으로 들어갑니다').length - 1, 0, '지운 프레임 삽입 안내가 prop-frame.js 코드에 다시 있다');
  const hints = code.split('class="prop-hint').length - 1;
  assert.equal(hints, 1, `prop-frame.js 의 살아 있는 prop-hint 가 1 이어야 한다(옛 2 − 지운 1). 잰 값 ${hints}`);
}

test('H1 프레임 패널 — 「…이 안으로 들어갑니다」 안내가 0건이고 prop-hint 는 정확히 1(전폭 사유만)', () => {
  check(fs.readFileSync(SRC, 'utf8'));
});

test('H1-양성대조 — 안내를 되살린 소스에서는 빨개진다', () => {
  const raw = fs.readFileSync(SRC, 'utf8');
  const at = raw.indexOf('${window.fxSectionHtml?.(ss');
  assert.ok(at > 0, '양성대조 꽂을 자리를 못 찾았다');
  const restored = raw.slice(0, at) + '<div class="prop-section">\n      <div class="prop-hint">Frame 클릭 후 플로팅 패널에서 블록을 추가하면 이 안으로 들어갑니다.</div>\n    </div>\n    ' + raw.slice(at);
  assert.notEqual(restored, raw, '변이가 안 꽂혔다');
  assert.throws(() => check(restored), /다시 있다/);
});
