/* settings-row-escape — 설정 모달의 공용 «행» 틀이 바깥 글자를 «항상 글자로» 넣는가.
 *
 * ★왜 있나 (2026-09-21, T-049 전수에서 작업목록매니저가 찾아냄)
 *   `js/settings/settings-modal.js` 의 `row(label, help, buttons)` 가 `${label}` 과
 *   `value="${help}"` 를 **날것**으로 꽂고 있었다. 그런데 그 틀에 들어오는 이름은
 *   «내가 지은 것»이 아니다 — `await api.invites({})`(원격 응답)의 `i.name` · `p.name` 이다.
 *   ⇒ **남이 지어 보낸 문자열이 우리 화면 HTML 이 된다.** 위협모델이 T-049(내 프로젝트 이름)와 다르다.
 *   ★같은 파일에 `_escapeHtml`(:340)이 이미 있고 다른 자리(:325 등)는 제대로 쓰고 있었다 —
 *     도구가 없어서가 아니라 «이 틀만» 안 썼다. 그래서 «규칙»이 아니라 «검사»로 못박는다.
 *
 * ⚠️이 검사는 소스 문자열을 본다. 정상 리팩터링에도 빨강이 날 수 있다 — 그때는 지우지 말고
 *   「이 틀에 들어오는 바깥 글자가 이스케이프를 거치는가」를 확인한 뒤 패턴을 고쳐라.
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
const SRC = readSrc(REPO, 'js/settings/settings-modal.js');

/** `const row = (label, help, buttons) => ` 부터 그 템플릿 리터럴 끝까지 */
function rowTemplate() {
  const i = SRC.indexOf('const row = (label, help, buttons)');
  assert.ok(i > 0, 'row(label,help,buttons) 틀을 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라');
  const start = SRC.indexOf('`', i);
  const end = SRC.indexOf('`;', start + 1);
  assert.ok(end > start, 'row 틀의 템플릿 리터럴 끝을 못 찾았다');
  return SRC.slice(start, end);
}

test('S1 — row 틀이 label 을 «날것»으로 꽂지 않는다', () => {
  const t = rowTemplate();
  assert.doesNotMatch(t, /\$\{\s*label\s*\}/,
    '★${label} 이 날것이다 — 원격에서 온 초대 이름(api.invites)이 그대로 HTML 이 된다. _escapeHtml 로 감싸라');
  assert.match(t, /\$\{\s*_escapeHtml\(\s*label\s*\)\s*\}/,
    'label 이 _escapeHtml 을 안 탄다');
});

test('S2 — row 틀이 help 를 «속성 안»에서도 막는다', () => {
  const t = rowTemplate();
  assert.doesNotMatch(t, /value="\$\{\s*help\s*(\|\|[^}]*)?\}"/,
    '★value="${help}" 가 날것이다 — 속성 밖으로 나갈 수 있다. _escapeHtml 로 감싸라(그 함수가 " 도 덮는다)');
  assert.match(t, /value="\$\{\s*_escapeHtml\(/,
    'help 가 속성 자리에서 _escapeHtml 을 안 탄다');
});

test('S3 — 그 틀에 «바깥에서 온 이름»이 실제로 들어온다(검사가 헛돌지 않는다)', () => {
  /* ★이게 없으면 위 둘은 「아무도 안 쓰는 틀」을 지키는 빈 검사가 될 수 있다.
     원격 응답(api.invites)의 이름이 row 로 들어가는 자리가 «있다»는 것을 같이 못박는다. */
  assert.match(SRC, /api\.invites\(/, 'api.invites 호출이 사라졌다 — 그러면 이 검사의 전제를 다시 보라');
  assert.match(SRC, /invites\.map\(\s*i\s*=>\s*row\(/, 'invites → row 경로가 사라졌다');
  assert.match(SRC, /projects\.map\(\s*p\s*=>\s*row\(/, 'projects → row 경로가 사라졌다');
});

test('S4 — _escapeHtml 이 따옴표까지 덮는다(속성 자리를 막으려면 필요)', () => {
  const m = /function _escapeHtml\(v\)\s*\{([\s\S]*?)\n  \}/.exec(SRC);
  assert.ok(m, '_escapeHtml 정의를 못 찾았다');
  for (const ch of ['&', '<', '>', '"']) {
    assert.ok(m[1].includes(`/${ch === '&' ? '&' : ch}/g`) || m[1].includes(`'${ch}'`) || m[1].includes(`"${ch}"`) || m[1].includes(ch),
      `_escapeHtml 이 ${ch} 를 안 덮는다`);
  }
  assert.match(m[1], /&quot;/, '★" 를 &quot; 로 안 바꾼다 — 속성 자리를 못 막는다');
});
