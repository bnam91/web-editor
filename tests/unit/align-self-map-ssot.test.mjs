/* align-self-map-ssot.test.mjs — t7-03(2026-10-26 S3 · 지디 처방 ⒝) 「사상표 새로 적지 마 — 한쪽 SSOT 파생 + 세 자리 같은 답」
 *
 * ★사상표 = js/props/prop-text-wireup-align.js `ALIGN_SELF_OF`(가로 정렬 낱말 → 세로 flex 자식의 align-self).
 * ★읽는 자 셋: 그 파일의 정렬 단추(U10) · js/editor.js alignSelectedToParent(⌥A/S/D) · js/effects-freetransform.js(폭 전이).
 * ★한 쌍:
 *   S1 값 — 표가 left/center/right → flex-start/center/flex-end 이고 얼려 있다
 *   S2 자리 — 셋이 «그 표»를 import 해 쓰고, js/ 전체에 같은 표의 사본(literal)은 SSOT 한 자리뿐이다
 *        (⇒ 셋의 답이 갈릴 수 있는 길이 없다 · 사본이 생기면 빨강)
 * 실행: node --test tests/unit/align-self-map-ssot.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const req = createRequire(import.meta.url);
const { readSrc } = req('./_srcread.js');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SSOT = 'js/props/prop-text-wireup-align.js';
const READERS = ['js/props/prop-text-wireup-align.js', 'js/editor.js', 'js/effects-freetransform.js'];

test('S1 ★사상표 값 — left/center/right → flex-start/center/flex-end · 얼림', () => {
  /* 이 레포의 js 는 브라우저 ESM 이라 node 가 바로 못 읽는다 ⇒ 정의 한 줄을 떼어 값으로 만든다(다른 단위 검사와 같은 길). */
  const m = readSrc(ROOT, SSOT).match(/export const ALIGN_SELF_OF = (Object\.freeze\(\{[^}]*\}\));/);
  assert.ok(m, '★전제: SSOT 정의 줄을 찾았다');
  const ALIGN_SELF_OF = new Function('return ' + m[1])();
  assert.deepEqual({ ...ALIGN_SELF_OF }, { left: 'flex-start', center: 'center', right: 'flex-end' });
  assert.ok(Object.isFrozen(ALIGN_SELF_OF), '★얼려 있어야 한다(읽는 자가 고쳐 쓰면 셋이 갈린다)');
});

test('S2 ★세 자리가 같은 표를 쓴다 — import 해 읽고 · 사본 literal 은 SSOT 한 자리뿐', () => {
  for (const rel of READERS.slice(1)) {
    const s = readSrc(ROOT, rel);
    assert.match(s, /import\s*\{[^}]*\bALIGN_SELF_OF\b[^}]*\}\s*from\s*'\.\/props\/prop-text-wireup-align\.js'/, `${rel}: SSOT 를 import 하지 않는다`);
    assert.match(s.replace(/^\s*import[^\n]*\n/gm, ''), /\bALIGN_SELF_OF\[/, `${rel}: 표를 읽는 자리가 없다`);
  }
  assert.match(readSrc(ROOT, SSOT), /\bALIGN_SELF_OF\[/, `${SSOT}: 제 단추가 표를 읽지 않는다`);
  /* 읽는 세 자리 안에 «같은 표»의 literal 사본이 없다 — SSOT 파일은 그 정의 한 줄 ＋ 아이콘텍스트의 justify-content 표(jcMap · 뜻이 다르다)만.
     ⚠️js/ 의 다른 같은 모양 literal(block-factory · modal-block _MDL_JUSTIFY_H · prop-multisel)은 ★justify-content 쪽이라 처방 범위 밖이다
       — 이름만 단다: ALIGN-JUSTIFY-MAP-COPIES-OUT-OF-SCOPE-01. */
  const lit = /\{\s*left:\s*'flex-start',\s*center:\s*'center',\s*right:\s*'flex-end'\s*\}/g;
  for (const rel of READERS.slice(1)) assert.equal((readSrc(ROOT, rel).match(lit) || []).length, 0, `${rel}: 제 사상표 literal 이 남았다 — SSOT 에서 파생시켜라`);
  const ss = readSrc(ROOT, SSOT);
  assert.ok(!/\basMap\b/.test(ss), `${SSOT}: 옛 asMap(사본)이 남았다`);
  assert.equal((ss.match(/export const ALIGN_SELF_OF = Object\.freeze\(/g) || []).length, 1, '★정의는 한 자리');
});
