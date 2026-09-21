/* keys-esc-arrow-wiring.test.mjs — T-102 «배선» 검사.
 *
 * DOM 검사(tests/dom/keys-esc-arrow.dom.spec.js)는 함수가 «제대로 닫고 제대로 고르는지»를 잰다.
 * 여기서 재는 건 다른 축이다 — 그 함수가 «실제로 Esc/화살표키에 걸려 있는지».
 * 함수만 멀쩡하고 배선이 빠지면 앱에서는 아무 일도 안 일어난다(둘 다 있어야 한다).
 *
 * 실행: node --test tests/unit/keys-esc-arrow-wiring.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'editor.js'), 'utf8');

/** `if (e.key === 'Escape') { … }` 의 몸통을 중괄호 균형으로 떠낸다. */
function escapeBlock(src) {
  const k = src.indexOf("if (e.key === 'Escape') {");
  assert.ok(k >= 0, "editor.js 에서 Escape 분기를 못 찾았다");
  let i = src.indexOf('{', k), b = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') b++;
    else if (src[i] === '}') { b--; if (b === 0) { i++; break; } }
  }
  return src.slice(k, i);
}

test('★Esc 분기가 closeFpMenus() 를 «먼저» 부르고 소진한다 (메뉴 > 선택 풀기 순서)', () => {
  const blk = escapeBlock(SRC);
  const iClose = blk.indexOf('closeFpMenus()');
  const iDesel = blk.indexOf('deselectAll()');
  assert.ok(iClose >= 0, '★Esc 가 closeFpMenus() 를 안 부른다 = 뜬 메뉴가 Esc 로 안 닫힌다');
  assert.ok(iDesel >= 0, 'Esc 의 선택 풀기(deselectAll)가 사라졌다 — T-058 회귀');
  assert.ok(iClose < iDesel, '★메뉴 닫기가 선택 풀기보다 뒤에 있다 = 메뉴를 열어둔 채 선택이 먼저 풀린다');
  assert.match(blk.slice(iClose, iClose + 120), /closeFpMenus\(\)\s*>\s*0\)\s*return/,
    '★닫았으면 return 으로 소진해야 한다(안 그러면 같은 Esc 가 선택까지 푼다)');
});

/** 화살표키 분기의 «몸통»을 중괄호 깊이로 떠낸다.
 *  ⚠️예전엔 여기가 `SRC.slice(k, k + 2600)` 라는 «글자수 창»이었다. 그 창이 옆 분기(⌥+a/s/d)
 *    까지 덮어서, 화살표 분기의 e.preventDefault() 를 통째로 지워도 «옆집 것»에 걸려 초록이
 *    났다(2026-09-22 음성대조 실측). 창을 분기 몸통에 딱 맞춘다. */
function arrowBlock(src) {
  const k = src.indexOf('const _ARROW = {');
  assert.ok(k >= 0, '★화살표키 분기가 없다 = 브라우저 기본 스크롤이 캔버스를 민다(T-102 ②)');
  let d = 0, i = k;
  for (; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (d < 0) break; }
  }
  assert.ok(i < src.length, '화살표키 분기의 끝을 못 찾았다');
  return src.slice(k, i);
}

test('★화살표키 분기가 있다 — preventDefault 로 캔버스 스크롤을 막고, 밀면 되돌리기에 쌓는다', () => {
  const blk = arrowBlock(SRC);
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])
    assert.ok(blk.includes(key), `${key} 가 빠졌다 — 네 방향이 다 있어야 한다`);
  assert.ok(blk.includes('e.preventDefault()'), '★preventDefault 가 없으면 캔버스가 그대로 밀린다');
  assert.ok(/pushHistory\(/.test(blk), '★민 것이 되돌리기에 안 쌓인다');
  assert.ok(blk.includes('_freeNudgeTargets()'), '★성질로 대상을 고르는 길(_freeNudgeTargets)을 안 쓴다');
  assert.ok(/_deepestCanvasSelection\(\)/.test(blk), '고른 게 없는데도 키를 먹으면 스크롤이 죽는다');
  /* ★연타 병합 — 이 앱 규약은 «연타 한 번 = 되돌리기 한 칸»이다(js/editor.js
     coalesceSizeHistory 「C3: 연속 크기/간격 조정 히스토리 병합」). 조건 없이 매번
     pushHistory 를 부르면 ⌘Z 가 누른 횟수만큼 필요해진다. 행동 쪽은
     tests/dom/keys-esc-arrow.dom.spec.js T-102-③ 이 «실제로 몇 칸 쌓이나»로 잰다. */
  assert.ok(/if\s*\(_now\s*-\s*\(window\._nudgeBurstAt[^)]*\)[^)]*\)\s*pushHistory\(/.test(blk),
    '★pushHistory 가 조건 없이 매번 불린다 = 키 한 번에 되돌리기 한 칸씩 쌓인다');
});

test('★뜬 메뉴 닫는 «명부»는 한 벌이다 — 바깥클릭 핸들러가 자기 목록을 따로 들고 있지 않다', () => {
  const k = SRC.indexOf("document.addEventListener('click', e => { closeFpMenus(e.target); });");
  assert.ok(k >= 0, '★바깥클릭 닫기가 closeFpMenus 를 안 쓴다 = 명부가 두 벌로 갈린다');
  // .fp-dropdown 을 통째로 닫는 자리는 toggleFpDropdown(하나 열고 나머지 닫기) 뿐이어야 한다.
  const dupes = SRC.split("document.querySelectorAll('.fp-dropdown').forEach(d => d.classList.remove('open'))").length - 1;
  assert.equal(dupes, 1, `★.fp-dropdown 를 닫는 손으로 적은 자리가 ${dupes} 곳이다 — 한 곳만 남아야 한다`);
});
