/* selected-marker-census — 「★선택 마커 명부가 ★몇 종인가 · ★구멍이 ★어디인가」의 ★자. (1009t3 A4)
 *
 * ★왜 있나 (2026-10-10 실측)
 *   `grd-cell-selected` 가 ★다섯 세척 명부 ★전부에서 빠져 ★저장본·템플릿·⌘C 재료·협업 비교 키로
 *   새고, ★HTML 배송본에서는 ★★«실제로 그려졌다»(computed `rgb(45,111,232) 0 0 0 2px inset`).
 *   ⇒ 2026-10-09 `8c73e8fc` 는 ★무게를 「0건 ⇒ 꾸밈만 샌다」로 적었다. ★그 자(=«그 클래스를
 *     ★읽어서 ★결정하는 자리»의 수)는 ★맞게 돌았다 — ★그러나 ★이 누수는 ⒤★문자열을 ★해시해서
 *     (비교 키) ⅱ)★CSS 규칙이 ★같이 ★수확되어(배송본) 기능을 깬다. ★★두 길 다 ★그 자 ★밖이다.
 *
 * ★★그리고 그 커밋 주석의 ★「16종」은 ★틀린 수였다 — ★`stb-step-selected` 를 빠뜨렸다(참값 ★17).
 *   ⇒ ★그래서 ★이 파일은 ★★«수를 박지 않는다». ★명부를 ★«이름»으로 들고, ★양방향으로 잰다:
 *       ㉠ 실제 구멍 ⊆ 명부      (새 구멍이 생기면 빨강)
 *       ㉡ 명부 ⊆ 실제 구멍      (메워진 칸이 명부에 남아 있으면 빨강 — 명부가 낡았다)
 *   ⛔등호로 «수»를 박지 마라 — ∅ 가 「일치」로 둔갑하거나 「불일치」로 거절된다.
 *
 * ★자의 출처 — ★«정의 자리» 둘의 합집합이다. ⛔«사용 자리» grep 은 거짓양성·음성이 같이 온다.
 *   ⒜ CSS 선택자   : css/ 전수의 `.xxxselected`
 *   ⒝ 런타임 토글 : js/ 전수의 `classList.(add|remove|toggle|contains)('xxxselected')`
 *   ⚠️`iconify-selected` 는 ★class 가 아니라 ★element id 다(`iconify-selected-preview` 등) —
 *     ⒜⒝ 어디에도 안 걸린다. ★이름이 비슷한 것을 ★섞지 않는 것이 ★이 자의 요건이다.
 *
 * ★판정자는 ★이 파일이 ★아니다 — `js/io/section-serialize.js` 의 `isRuntimeMarker` 를 ★실행해 묻는다.
 *   ⛔명부를 ★베껴 적으면 ★★둘째 명부가 된다(그게 이 결함의 꼴 그대로다).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** section-serialize.js 를 «실행해» 자를 꺼낸다(플레인 스크립트라 import 가 없다). */
function runtimeMarkers() {
  const win = {};
  vm.runInNewContext(read('js/io/section-serialize.js'), { window: win, document: {} });
  const rm = win.runtimeMarkers;
  assert.ok(rm && typeof rm.isRuntimeMarker === 'function',
    '★window.runtimeMarkers 가 안 섰다 — 이 파일의 모든 판정이 무효다');
  return rm;
}

/** ⒜＋⒝ 정의 자리 합집합. */
function census() {
  const out = new Set();
  const cssDir = path.join(ROOT, 'css');
  for (const f of fs.readdirSync(cssDir)) {
    if (!f.endsWith('.css')) continue;
    for (const m of fs.readFileSync(path.join(cssDir, f), 'utf8').matchAll(/\.([A-Za-z0-9_-]*selected)\b/g)) out.add(m[1]);
  }
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.js')) continue;
      for (const m of fs.readFileSync(p, 'utf8').matchAll(/classList\s*\.\s*(?:add|remove|toggle|contains)\s*\(([^)]*)\)/g))
        for (const q of m[1].matchAll(/'([A-Za-z0-9_-]*selected)'/g)) out.add(q[1]);
    }
  };
  walk(path.join(ROOT, 'js'));
  return [...out].sort();
}

/* ★구멍 명부 — ★«저장 루트(#canvas 클론) 밖»이라서 열려 있어도 되는 것들. ★까닭을 이름 옆에 적는다.
   ⛔까닭 없이 이름을 늘려 빨강을 끄지 마라. ★늘릴 때는 ★그 클래스를 붙이는 요소의 ★«부모»를
     ★정의 자리에서 찾아 ★«#canvas 안인가»를 보고 적어라(아래 넷이 그렇게 닫혔다).
   ★2026-10-10 실측(행위) — `#canvas-wrap > #canvas-scaler > [ #todo-pin-overlay , #canvas ]` */
const ALLOWED_HOLES = {
  'scratch-selected':           '.scratch-item 의 부모 = #canvas-scaler (js/scratch-pad.js `scaler.appendChild(el)`) = #canvas 의 «형제»',
  'todo-pin--selected':         '.todo-pin 의 부모 = #todo-pin-overlay (index.html) = #canvas 의 «형제»',
  'is-selected':                '.grad-stop-chip → .grad-line-portal → HOST_SELECTOR = "#canvas-scaler" (js/gradient-line-overlay.js) = «형제» / 또 하나는 자산 패널',
  'assets-row--selected':       '자산 패널 행 — 캔버스 밖',
  'assets-grid-card--selected': '자산 패널 카드 — 캔버스 밖',
  'ck-item--selected':          '체크리스트 패널 항목 — 캔버스 밖',
};

test('A4-C1 ★자가 살아있다 — 양성·음성 대조', () => {
  const rm = runtimeMarkers();
  assert.equal(rm.isRuntimeMarker('selected'), true, '★양성대조 실패 — 자가 죽었다');
  assert.equal(rm.isRuntimeMarker('zz-not-a-marker-xyz'), false, '★음성대조 실패 — 자가 전부 참을 낸다');
  const all = census();
  assert.ok(all.length >= 17,
    `★정의 자리 합집합이 ${all.length}종이다 — 17 미만이면 자가 눈먼 것이다(2026-10-10 참값 17):\n  ${all.join(' ')}`);
  assert.ok(!all.includes('iconify-selected'),
    '★`iconify-selected` 가 명부에 들어왔다 — 그건 class 가 아니라 element id 다(이름이 비슷한 것을 섞었다)');
});

test('A4-C2 ★구멍은 «명부 안»에만 있다 — 양방향(⛔수를 박지 않는다)', () => {
  const rm = runtimeMarkers();
  const holes = census().filter((t) => !rm.isRuntimeMarker(t));
  const roster = Object.keys(ALLOWED_HOLES);
  /* ㉠ 새 구멍이 생기면 빨강 — 이것이 A4 를 잡은 축이다. */
  const unlisted = holes.filter((t) => !roster.includes(t));
  assert.deepEqual(unlisted, [],
    `★세척 명부가 «못 벗기는» 선택 마커가 명부 밖에 ${unlisted.length}종 있다 — 저장본·템플릿·⌘C 재료·협업 비교 키로 샌다:\n` +
    unlisted.map((t) => `  · ${t}`).join('\n') +
    '\n  ⇒ 저장 루트 안이면 js/io/section-serialize.js 의 RUNTIME_MARKER_CLS/RE 에 넣어라.' +
    '\n  ⇒ 밖이면 이 파일 ALLOWED_HOLES 에 «까닭»(그 요소의 부모가 #canvas 밖임)을 적어 올려라.');
  /* ㉡ 메워진 칸이 명부에 남아 있으면 빨강 — 명부가 낡았다. */
  const stale = roster.filter((t) => rm.isRuntimeMarker(t));
  assert.deepEqual(stale, [],
    `★ALLOWED_HOLES 에 «이미 메워진» 칸이 ${stale.length}종 남았다 — 명부가 낡아 다음 구멍을 가린다: ${stale.join(' ')}`);
});

test('A4-C3 ★A4 당사자 둘이 «덮였다» — 되돌리면 이 칸이 빨강이다', () => {
  const rm = runtimeMarkers();
  /* ★`grd-cell-selected` — 2026-10-10 실측: 저장본 1건 · ⌘C 1건 · 템플릿 1건 ·
     섹션 해시 `b8315380`(선택 전) → `805b8dc8`(고른 뒤) · ★HTML 배송본에 ★그려졌다.
     ★`item-selected`     — 같은 날 실측: 저장본 1건 · 해시 `a1ad09e8` → `b4189398`.
     ⚠️`col-active` 는 ★안 쟀다 — `row-active` 는 A 에 있는데 그것만 없다. ★백로그(별건). */
  for (const tok of ['grd-cell-selected', 'item-selected']) {
    assert.equal(rm.isRuntimeMarker(tok), true,
      `★«${tok}» 이 세척 명부에서 빠졌다 — 2026-10-10 에 행위로 잰 누수가 되살아난다`);
  }
  /* ★성질로 묶였나 — 손 열거가 아니라 RE 가 잡아야 «앞으로 생길 xxx-cell-selected»도 자동이다. */
  assert.equal(rm.isRuntimeMarker('zzz-cell-selected'), true,
    '★「-cell-selected 로 끝나면 칸 선택 마커다」가 ★성질로 묶이지 않았다 — 새 컴포넌트가 제 칸 마커를 만드는 날 또 샌다');
  assert.equal(rm.isRuntimeMarker('zzz-line-selected'), true,
    '★대조 — 줄 마커의 성질 묶음이 깨졌다(RE 를 고치다 한쪽을 잃었다)');
  /* ★음성대조 — RE 가 «전부»를 삼키지 않았다(⛔`/(?:^|-)selected$/` 로 넓히면 아래가 참이 된다). */
  for (const tok of Object.keys(ALLOWED_HOLES)) {
    assert.equal(rm.isRuntimeMarker(tok), false,
      `★RE 가 너무 넓어졌다 — «${tok}»(캔버스 밖 · 저장돼도 무해)까지 벗긴다. 그 8종은 종마다 따로 재야 한다`);
  }
});
