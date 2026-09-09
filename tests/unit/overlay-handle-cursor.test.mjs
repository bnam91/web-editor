/* ★「오버레이 손잡이가 있는데 «커서»만 빠진 블록」을 기계가 잡는다.
 *   2026-09-09 현빈 실측: 「모달블럭 > 모서리 핸들 마우스 커서 모양 안 바뀜」.
 *   원인 = 커서 규칙이 «손으로 적은 목록»이라 모달을 만들 때 안 넣었다.
 *     모양 규칙(.mdl-overlay-handle)엔 얹혀 있었는데 커서 목록에만 빠졌다 ⇒ 눈엔 보이고 커서만 안 바뀐다.
 * ★분모를 손으로 적지 않는다 — CSS 에서 «-overlay-handle 로 끝나는 클래스 전수»를 뽑아
 *   그중 커서 규칙에 «안 든» 것을 센다. 새 블록이 생기는 날 이 검사가 «스스로» 빨개진다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CSS = fs.readFileSync(path.join(ROOT, 'css/editor-blocks.css'), 'utf8');
/** 주석을 걷는다 — 주석 속 클래스 이름을 «규칙»으로 세면 안 된다. */
const CODE = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

/** 이 CSS 가 «아는» 오버레이 손잡이 클래스 전수(기계가 뽑는다). */
const ALL = [...new Set([...CODE.matchAll(/\.([a-z0-9-]+-overlay-handle)\b/g)].map(m => m[1]))].sort();
/** 커서를 실제로 주는 규칙에 든 것. */
const WITH_CURSOR = [...new Set(
  [...CODE.matchAll(/([^{}]+)\{[^{}]*cursor\s*:[^{}]*resize[^{}]*\}/g)]
    .flatMap(m => [...m[1].matchAll(/\.([a-z0-9-]+-overlay-handle)\b/g)].map(x => x[1]))
)].sort();

test('H1 ★「입력이 살아 있다」 — 손잡이 클래스도 커서 규칙도 실제로 뽑혔다', () => {
  assert.ok(ALL.length >= 4, `오버레이 손잡이 클래스를 ${ALL.length}개밖에 못 뽑았다 — 정규식이 죽었다`);
  assert.ok(WITH_CURSOR.length >= 4, `커서 규칙을 ${WITH_CURSOR.length}개밖에 못 뽑았다 — 파싱이 죽었다`);
});

test('H2 ★오버레이 손잡이를 가진 블록은 «전부» resize 커서를 받는다', () => {
  /* ⚠️canvas-overlay-handle 은 «자기 규칙»으로 커서를 준다(구조가 다르다) — 그건 예외로 «적어» 둔다.
     ⛔예외를 늘리려면 «왜»를 여기 적어라. 조용히 늘리면 이 검사는 명부가 된다. */
  const EXCEPT = new Set(['canvas-overlay-handle']);
  const missing = ALL.filter(c => !EXCEPT.has(c) && !WITH_CURSOR.includes(c));
  assert.deepEqual(missing, [],
    `커서 규칙에 «빠진» 손잡이: ${missing.join(', ')} — 전수 ${ALL.length}개 중`);
});

test('H3 [변이] 모달을 커서 목록에서 빼면 이 검사가 «실제로» 빨개진다', () => {
  const mutated = CODE.replace(/, \.mdl-overlay-handle\.(nw|ne|sw|se)/g, '');
  assert.notEqual(mutated, CODE, '★하네스가 부서졌다 — 앵커를 못 찾았다');
  const wc = [...new Set(
    [...mutated.matchAll(/([^{}]+)\{[^{}]*cursor\s*:[^{}]*resize[^{}]*\}/g)]
      .flatMap(m => [...m[1].matchAll(/\.([a-z0-9-]+-overlay-handle)\b/g)].map(x => x[1]))
  )];
  assert.ok(!wc.includes('mdl-overlay-handle'),
    '★변이를 넣었는데 모달이 여전히 커서 목록에 있다 — 이 검사는 아무것도 안 지킨다');
});
