/* count-btn-disabled.test.mjs — VISUAL-10-COUNT-BTN-DISABLED-01(현빈 261119 · 0.9.13 145행 · AUDIT-visual-svg #10)
 * 증상: Buzz «개수» −/+ 가 끝에서 disabled 인데 켜진 것과 똑같이 보이고 hover 로 밝아짐(.prop-count-btn 에 :disabled 꼴 없음).
 *   형제 Radial 두 패널은 인라인 style(opacity .4 · pointer-events none)로 따로 흐리게 했다.
 * 고침: css/editor-props.css 한 규칙 — :disabled = --ui-disabled-opacity + not-allowed · hover 는 :not(:disabled) 만.
 *   Radial 두 곳(js/radial-arrange.js · js/props/prop-radial.js)은 인라인 흐림 대신 disabled 속성 → 같은 규칙을 탄다.
 * 자 = 원문(주석 뺀 CSS · JS 의 prop-count-btn 단추 꼴) 정규식.
 * 양성대조 = :disabled 규칙 빼고 hover 를 옛 꼴로 → 빨강(_patches/visual5-145-CTL-no-disabled.patch).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const css = read('css/editor-props.css').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, sel, body]) => ({ sel: sel.trim(), body }));

test('145 .prop-count-btn:disabled = 공용 꺼짐 꼴', () => {
  const r = rules.find((x) => x.sel.split(',').map((s) => s.trim()).includes('.prop-count-btn:disabled'));
  assert.ok(r, '.prop-count-btn:disabled 규칙이 있다');
  assert.match(r.body, /opacity\s*:\s*var\(--ui-disabled-opacity\)/);
  assert.match(r.body, /cursor\s*:\s*not-allowed/);
});

test('145 hover 는 켜진 단추에만', () => {
  const hov = rules.filter((x) => /\.prop-count-btn[^,{]*:hover/.test(x.sel));
  assert.ok(hov.length >= 1, '[전제] hover 규칙이 있다');
  for (const h of hov) assert.match(h.sel, /\.prop-count-btn:not\(:disabled\):hover/, `hover 선택자 «${h.sel}»`);
});

test('145 Radial 두 패널 = 인라인 흐림 없이 disabled 속성', () => {
  for (const f of ['js/radial-arrange.js', 'js/props/prop-radial.js']) {
    const btns = [...read(f).matchAll(/<button class="prop-count-btn"[\s\S]*?>(?=[−+]<\/button>)/g)].map((m) => m[0]);
    assert.ok(btns.length >= 2, `[전제] ${f} 에 개수 단추 −/+`);
    for (const b of btns) {
      assert.doesNotMatch(b, /style=/, `${f} 인라인 style 없음: ${b}`);
      assert.match(b, /\$\{[^}]*' disabled'/, `${f} 끝에서 disabled 속성: ${b}`);
    }
  }
});
