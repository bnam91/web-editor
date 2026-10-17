/* 1017t1e1 뒤처리 — ★`.hlb-handle` 이 ★★«두 역할»을 ★한 클래스로 ★나눠 쓴다. (2026-10-18 지디)
 *
 * ★무슨 일이 있었나 — ★e1(`1d99a386`)이 ★두께 손잡이를 ★★«같은 클래스» `.hlb-handle` 로 붙였다
 *   (`data-endpoint="thick"` · ★일부러 그렇게 했다: sticker-select.js 의 양보 가드를 그대로 쓰려고).
 *   ⇒ ★그러자 ★`.hlb-handle` 을 ★★«맨 수»로 세던 ★기존 검사 ★네 곳이 ★2 대신 ★★3 을 보고 ★빨개졌다
 *     (★261018 전수에서 ★J1-a·J1-b·J2-b·J2-d — ★dev 에 ★★엿새간 ★고정 빨강으로 ★살아 있었다).
 *   ★★그때 ★내가 ★안 한 것 = ★★«소비자(읽는 코드) 전수». ⇒ ★그래서 ★★이 자를 둔다.
 *
 * ★이 검사가 ★재는 것 — ★`.hlb-handle` 을 ★★«맨 수»로 ★세는 자리가 ★★명부 안에만 있나.
 *   ⛔「0건이어야 한다」가 ★아니다 — ★★«맨 수»를 ★일부러 세는 자리가 ★★있다(e1 자신의 spec: 3개를 기대).
 *   ⇒ ★★「명부 ⊇ 실패집합 ＋ 명부 밖 0건」 꼴로 둔다. ⛔등호가 아니다.
 *
 * ⛔이 검사가 ★안 하는 일: ★제품의 ★`remove()`·`closest()` 자리는 ★수를 ★안 세므로 ★대상이 아니다.
 *   ★그리고 ★★E2E(`tests/e2e/**`)는 ★★별도 명령으로만 돈다 — ★이 자는 ★소스를 읽으니 ★거기까지 ★본다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/* ★★«맨 수»를 세는 꼴 — `.hlb-handle` 뒤에 `[data-endpoint` 가 ★안 붙은 채 ★`.length` 로 간다 */
const BARE = /querySelectorAll\(\s*[`'"][^`'"]*\.hlb-handle(?!\[data-endpoint)[^`'"]*[`'"]\s*\)(?:\s*\]?\s*)?\.length/g;

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== 'node_modules') walk(p, out); }
    else if (/\.(m?js|cjs)$/.test(e)) out.push(p);
  }
  return out;
}

/* ★★명부 — ★«맨 수»를 ★일부러 세는 자리. ★여기 밖은 ★0건이어야 한다. */
const ALLOWED = new Set([
  'tests/dom/hlb-thickness-handle.dom.spec.js',   // ★e1 자신 — ★3개(끝점2+두께1)를 ★일부러 센다
  /* ★★261018 — ★이 자가 ★처음 돌 때 ★잡은 자리다. ★★«전체를 세는 것이 ★맞다»:
     ★그 줄은 `deselectAll` 뒤 ★`after` 를 ★★0 으로 기대한다 ⇒ ★끝점만 세면 ★thick 이 ★남아도
     ★0 이 되어 ★★놓친다. ⇒ ★여기 둔다. ⛔「빨개서 넣은 것」이 ★아니다. */
  'tests/e2e/99-merge-integration.spec.js',
]);

test('E1-C1 ★전제 — 자가 ★무언가를 ★잡는다(⛔0건이 초록이 되지 않게)', () => {
  const files = walk(path.join(ROOT, 'tests'));
  assert.ok(files.length > 100, `★검사 파일을 ${files.length}개밖에 못 셌다 — ★★「0건」이 아니라 «못 잰» 것이다`);
  /* ★양성대조: ★명부에 든 그 파일이 ★실제로 ★잡혀야 한다. 안 잡히면 ★고르개가 ★눈멀었다. */
  const self = path.join(ROOT, [...ALLOWED][0]);
  const hits = [...readFileSync(self, 'utf8').matchAll(BARE)];
  assert.ok(hits.length > 0,
    `★양성대조 실패 — ★${[...ALLOWED][0]} 는 ★«맨 수»를 ★세는데 ★고르개가 ★못 잡았다(정규식이 깨졌나?)`);
});

test('E1-C2 ★★«맨 수»로 세는 자리가 ★명부 밖에 ★0건', () => {
  const bad = [];
  for (const p of walk(path.join(ROOT, 'tests'))) {
    const rel = path.relative(ROOT, p);
    if (ALLOWED.has(rel)) continue;
    const src = readFileSync(p, 'utf8');
    for (const m of src.matchAll(BARE)) {
      const line = src.slice(0, m.index).split('\n').length;
      bad.push(`${rel}:${line}`);
    }
  }
  assert.deepEqual(bad, [],
    `★★\`.hlb-handle\` 을 ★«맨 수»로 세는 자리가 ★생겼다 — ★그 수는 ★★3 이다(끝점2＋두께1).\n`
    + `  ⇒ ★«끝점»을 재려면 ★\`[data-endpoint="start"],[data-endpoint="end"]\` 로 ★좁혀라.\n`
    + `  ⇒ ★일부러 ★전체를 세는 것이면 ★이 파일의 ALLOWED 에 ★넣고 ★까닭을 적어라.\n`
    + `  자리: ${bad.join(' · ')}`);
});
