/* 1017t1f2 뒤처리 — ★그래프 프리셋 «명부»가 ★세 자리에 ★흩어져 있다. (2026-10-18 지디)
 *
 * ★왜 이 검사가 있나 — f2(첫 조각색을 --p-green-500 으로 · 테두리를 --sel-color 로)를 고칠 때
 *   「다른 프리셋 색과도 안 겹침을 ★전수 확인함」이 css/editor-graph.css 의 ★주석에만 남고
 *   ★재는 자가 ★없었다(확인에 쓴 임시 spec 을 지웠다). ⇒ ★프리셋을 ★하나 더 넣으면
 *   ★조용히 선택색과 겹친다. ★주석은 ★썩는다 — 그래서 ★구조로 잠근다.
 *
 * ★명부 세 자리(★전부 «정의 자리»다 — ⛔사용 자리 grep 으로 세지 않는다):
 *   ㉠ js/block-factory.js   `const PRESETS = [...]`        ← ★제품이 ★받아들이는 값
 *   ㉡ js/props/prop-graph.js `const presets = [{id,label}]` ← ★패널이 ★그리는 단추
 *   ㉢ css/editor-graph.css  `.graph-block[data-preset="X"]` ← ★그림을 ★주는 자리
 *
 * ★★셋이 어긋나는 꼴이 ★각각 다르다 — 그래서 ★한 집합으로 못 묶고 ★셋을 ★견준다:
 *   ㉠에만 있으면 → 값은 받는데 ★단추가 없고 ★그림도 없다(죽은 값)
 *   ㉡에만 있으면 → 단추는 보이는데 ★눌러도 ★그림이 안 바뀐다
 *   ㉢에만 있으면 → 그림은 있는데 ★닿을 길이 없다(옛 프리셋의 잔재)
 *
 * ⛔「색이 안 겹친다」는 ★여기서 못 잰다 — computed fill 이 필요하다(⇒ tests/dom/graph-pie-1013).
 *   ★까닭: colorful 은 ★--grb-pie-base 를 ★안 덮고 `.grb-bar-col:nth-child(n)` 로 ★직접 칠한다
 *   ⇒ ★변수만 읽는 자는 ★colorful 을 ★못 본다. ★그 자는 ★DOM 쪽에 둔다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

/* ㉠ block-factory.js — `const PRESETS = ['a','b',...]` 한 줄 */
function rosterFactory() {
  const src = read('js/block-factory.js');
  const m = src.match(/const\s+PRESETS\s*=\s*\[([^\]]*)\]/);
  assert.ok(m, '★js/block-factory.js 에서 `const PRESETS = [...]` 를 못 찾았다 — ⛔「0건」이 아니라 «못 잰» 것이다(이름이 바뀌었나?)');
  return new Set([...m[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] ?? x[2]));
}

/* ㉡ prop-graph.js — `const presets = [{ id: 'a', label: '…' }, …]` */
function rosterPanel() {
  const src = read('js/props/prop-graph.js');
  const m = src.match(/const\s+presets\s*=\s*\[([\s\S]*?)\]\s*;/);
  assert.ok(m, '★js/props/prop-graph.js 에서 `const presets = [...]` 를 못 찾았다 — ⛔「0건」이 아니라 «못 잰» 것이다');
  return new Set([...m[1].matchAll(/id:\s*'([^']+)'/g)].map((x) => x[1]));
}

/* ㉢ editor-graph.css — `.graph-block[data-preset="X"]` 전수 */
function rosterCss() {
  const src = read('css/editor-graph.css');
  return new Set([...src.matchAll(/\.graph-block\[data-preset="([^"]+)"\]/g)].map((x) => x[1]));
}

const show = (s) => [...s].sort().join(',');

test('GP1 ★전제 — ★세 자리 ★전부 ★0건이 아니다 (⛔∅ 끼리는 «일치»로 둔갑한다)', () => {
  const a = rosterFactory(), b = rosterPanel(), c = rosterCss();
  /* ★이 셋을 ★먼저 단언하는 까닭: GP2 는 ★집합 등호다 — ★셋이 ★다 비면 ★항등식으로 ★초록이 된다.
     ★내 교훈 「검사는 ★자기 전제를 ★단언해야 한다」· 「★본체는 「0건이 초록」」. */
  assert.ok(a.size >= 4, `★㉠block-factory 명부가 ${a.size}개 — ★4 미만이면 자가 깨졌다 (${show(a)})`);
  assert.ok(b.size >= 4, `★㉡prop-graph 명부가 ${b.size}개 — ★4 미만이면 자가 깨졌다 (${show(b)})`);
  assert.ok(c.size >= 4, `★㉢CSS 명부가 ${c.size}개 — ★4 미만이면 자가 깨졌다 (${show(c)})`);
});

test('GP2 ★세 명부가 ★같다 — ★어긋나면 ★어느 쪽에만 있는지 ★찍는다', () => {
  const a = rosterFactory(), b = rosterPanel(), c = rosterCss();
  /* ⛔「다르다」로 끝내지 않는다 — ★양방향 차집합을 ★메시지에 ★싣는다.
     ★까닭: 명부가 ★셋이라 ★어느 쪽이 ★뒤처졌나가 ★처방을 ★가른다(위 머리말 세 갈래). */
  const diff = (x, y, nx, ny) => {
    const only = [...x].filter((v) => !y.has(v));
    assert.deepEqual(only, [], `★${nx} 에만 있다: ${only.join(',')} — ★${ny} 에도 넣어라 (${nx}=${show(x)} / ${ny}=${show(y)})`);
  };
  diff(a, b, '㉠block-factory', '㉡prop-graph');
  diff(b, a, '㉡prop-graph', '㉠block-factory');
  diff(a, c, '㉠block-factory', '㉢CSS');
  diff(c, a, '㉢CSS', '㉠block-factory');
});

test('GP3 ★f2 비석이 ★살아있다 — 「첫 조각색 ≠ 선택색」을 ★재는 자가 ★DOM 에 ★있나', () => {
  /* ★이 검사의 ★진짜 짝은 ★DOM 쪽이다(computed fill 이 필요하다).
     ⇒ ★그 자가 ★사라지면 ★여기서 ★알려 준다. ⛔「다른 데서 재고 있을 것」으로 두지 않는다.
     ★내 교훈: 「★우회로가 새 사각지대 만들면 ★같은 패치에 ★그 자리 재는 검사도 같이」. */
  const dom = read('tests/dom/graph-pie-1013.dom.spec.js');
  assert.match(dom, /sel-color/,
    '★tests/dom/graph-pie-1013.dom.spec.js 에서 --sel-color 를 재는 자리가 사라졌다 — ★f2 의 「테두리=선택색」이 안 잠긴다');
  const css = read('css/editor-graph.css');
  assert.match(css, /--grb-pie-base:\s*var\(--p-green-500\)/,
    '★기본 프리셋 첫 조각색이 --p-green-500 이 아니다 — ★--ui-accent-primary 로 되돌아갔으면 ★선택색 테두리가 다시 묻힌다(f2 재발)');
});
