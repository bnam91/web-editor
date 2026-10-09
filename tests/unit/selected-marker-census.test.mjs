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
import { createRequire } from 'node:module';
const { makeStripper } = createRequire(import.meta.url)('./_strip-comments.js');

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

/* ══════════════════════════════════════════════════════════════════════════
   A4-G5 — ★«산출물 전용» 명부. ⛔명부 합치기를 «합집합»으로 하면 ★멀쩡한 것이 깨진다.
   ───────────────────────────────────────────────────────────────────────────
   ★왜 있나 (2026-10-10 · 1009t3 A4)
     ★A4 를 고치며 ★「세척 명부가 ★둘이면 ★파생시켜 하나로」를 ★따르려 했다. ★그런데 재 보니
     ★★`A ⊇ B` 가 ★★거짓이었다 — ★B(산출물 겹)에만 있는 토큰 중 ★다수가 ★★«저장본에 ★남아야»
     ★하는 것이었다. ★A 가 그것을 삼키면 ★`tests/dom/grid-cell-emptied.dom.spec.js` ★E
     (「★저장·재열기 왕복에서 ★빈 칸이 ★머문다」)가 ★빨개진다 = ★★데이터/상태 손실이다.
   ★★⇒ ★방향은 ★하나뿐이다:  ★★B(산출물) = A(저장 뿌리) ＋ ARTIFACT_ONLY
     ⛔역(A 가 B 를 삼키기)은 ★금지다.
   ★★⇒ ★교훈: ★★「파생시켜 하나로」의 ★«파생»은 ★★«합집합»이 ★아니다 —
     ★★★파생시키기 ★전에 ★«포함관계»를 ★재라.

   ★이 칸이 ★막는 것 ★둘
     ⑴ ★다음 사람이 ★「합집합으로 모으자」를 ★★반복하는 것 — ★그 토큰이 ★A 에 ★들어오면 ★빨강
     ⑵ ★산출물 겹에만 ★새 토큰이 ★조용히 생기는 것 — ★명부 밖이면 ★빨강
   ★그리고 ★이 명부가 ★나중 ★모으기의 ★★설계도다(★ARTIFACT_ONLY 가 ★그때 ★남길 목록이다).

   ⛔명부를 ★베껴 적지 않는다 — ★★«함수 몸통»에서 ★주석 떼고 ★떠서 ★`isRuntimeMarker` 에 ★묻는다.
     ⚠️★«파일 전체»로 세면 ★틀린다(실측: 파일 전체 10종 vs ★함수 몸통 ★참값). ★그래서 몸통만 본다.
     ⚠️★`export-image.js` 의 명부는 ★`prepareCloneForCapture` 가 ★아니라 ★`renderComponentsInClone`
       에 있다 — ★★«재렌더 뒤»여야 하기 때문이다(그 파일 주석). ★엉뚱한 함수를 보면 ★0종이 나온다.
═══════════════════════════════════════════════════════════════════════════ */

/** 산출물 겹의 명부 — «함수 몸통»에서 뜬다. [파일, 함수 선언, 이름] */
const ARTIFACT_LAYERS = [
  ['js/io/capture-safety.js', 'export function stripEditorOnlyForCapture', 'B 공용 겹(PNG·썸네일·단독HTML)'],
  ['js/io/export-html.js',    'async function exportHTMLFile',             'C 단독 HTML 전용'],
  ['js/io/export-image.js',   'export function renderComponentsInClone',   'D PNG 재렌더 뒤'],
];

/* ★A 에 ★들어가면 ★안 되는 것 — ★까닭을 ★이름 옆에 적는다. ⛔까닭 없이 늘려 빨강을 끄지 마라.
   ★㉠영구 = ★저장본에 ★남아야 한다(A 가 삼키면 ★손실)  ·  ★㉡미측정 = ★재야 한다 */
const ARTIFACT_ONLY = {
  'sec-bg-empty':        '㉠영구 · 섹션 «체크 배경» 자리표시 — 저장본에 남아야 다시 열 때 그 섹션이 «빈 배경»임이 보인다',
  'bn2-img-empty':       '㉠영구 · 배너02 «빈 이미지 칸» 체커 — 같은 성격(편집 화면에만 그리고, 상태는 저장본에 남는다)',
  'cvb-img-empty':       '㉠영구 · 커버 «빈 이미지 칸» 체커',
  'cvb-img-empty-plain': '㉠영구 · 그 평면 판',
  'grd-img-empty':       '㉠영구 · 그리드 «빈 이미지 칸» 체커(2026-09-25 현빈 주문으로 회색 단색 → 체크패턴)',
  'col-active':          '㉡미측정 · 활성 «열» 표시. ★row-active 는 A 에 있는데 ★이것만 없다 — ' +
                         '«저장돼야 하나»를 ★안 쟀다. ⇒ 별건으로 지디 명부에(2026-10-10). ' +
                         '★재서 «아니다»가 나오면 ★A 로 옮기고 이 칸을 지워라',
};

/** 함수 몸통에서 ★«클래스 토큰 명부»를 뜬다 — ★두 꼴을 ★다 읽는다.
 *  ⑴ `classList.remove('a','b',…)`  — ★손 열거 꼴
 *  ⑵ `const X = ['a','b',…];` ＋ `classList.remove(...X)` — ★★한 벌로 ★파생시킨 꼴
 *     ★2026-10-10 에 ★`js/io/capture-safety.js` 가 ★⑵ 로 바뀌었다(★거짓초록을 ★구조로 막으려고).
 *     ⛔⑴만 읽으면 ★그 파일에서 ★0종이 나와 ★이 자가 ★장님이 된다.
 *  ⚠️⑵ 는 ★«그 몸통 안의» 배열만 읽는다 — ★모듈 최상위로 올리면 ★또 눈먼다.
 *     ⇒ ★그때는 ★이 자를 ★같이 넓혀라(★분모 0 가드가 ★먼저 빨개질 것이다). */
function collectTokens(body) {
  const out = new Set();
  for (const m of body.matchAll(/classList\s*\.\s*remove\s*\(([^)]*)\)/g))
    for (const q of m[1].matchAll(/'([A-Za-z0-9_-]+)'/g)) out.add(q[1]);
  for (const m of body.matchAll(/const\s+[A-Za-z0-9_$]+\s*=\s*\[([\s\S]*?)\]\s*;/g))
    for (const q of m[1].matchAll(/'([A-Za-z0-9_-]+)'/g)) out.add(q[1]);
  return out;
}

/** 그 겹들의 ∖A — 즉 «산출물 전용»으로 남아야 하는 실제 집합. */
function artifactOnlyMeasured(rm) {
  const strip = () => makeStripper();
  const out = new Map();                           // token → [겹 이름…]
  for (const [file, sig, label] of ARTIFACT_LAYERS) {
    const s = strip();
    const code = read(file).split('\n').map((l) => s(l)).join('\n');
    const i = code.indexOf(sig);
    assert.ok(i >= 0, `★${file} 에서 «${sig}» 를 못 찾았다 — 이 자가 ${label} 를 ★안 재고 있다(이름이 바뀌었나)`);
    let j = code.indexOf('{', i), d = 0, k = j;
    for (; k < code.length; k++) { const c = code[k]; if (c === '{') d++; else if (c === '}') { d--; if (!d) break; } }
    const body = code.slice(j, k + 1);
    const toks = collectTokens(body);
    /* ★양성대조 — 분모가 0 이면 아래 「0건」이 ★항등식이다.
       ★★2026-10-10 에 ★이 가드가 ★★제 일을 했다: ★`capture-safety` 의 명부를 ★한 벌로 파생시키자
         (`classList.remove(...EDITOR_STATE_CLS)`) ★인용 토큰이 ★0건이 되어 ★이 칸이 ★빨개졌다.
         ⇒ ★자를 ★넓혔다(아래 `collectTokens` — ★배열 리터럴도 읽는다). ⛔가드를 끄지 않았다. */
    assert.ok(toks.size > 0,
      `★${label}(${file} ${sig}) 의 명부가 ★0종이다 — 자가 ★엉뚱한 함수를 보거나 ★명부 꼴이 바뀌었다` +
      `(그러면 아래 0건은 ★거짓 초록이다). ⇒ collectTokens 를 ★그 꼴까지 넓혀라`);
    for (const t of toks) if (!rm.isRuntimeMarker(t)) {
      if (!out.has(t)) out.set(t, []);
      out.get(t).push(label);
    }
  }
  return out;
}

test('A4-G5 ★«산출물 전용» 명부가 실물과 맞는다 — 양방향(⛔수를 박지 않는다)', () => {
  const rm = runtimeMarkers();
  const measured = artifactOnlyMeasured(rm);
  const roster = Object.keys(ARTIFACT_ONLY);
  const unlisted = [...measured.keys()].filter((t) => !roster.includes(t)).sort();
  assert.deepEqual(unlisted, [],
    `★산출물 겹에만 있고 ★명부 밖인 토큰이 ${unlisted.length}종이다:\n`
    + unlisted.map((t) => `  · ${t}  (${measured.get(t).join(' · ')})`).join('\n')
    + '\n  ⇒ 저장본에 «남아야» 하면 이 파일 ARTIFACT_ONLY 에 ★까닭과 함께 올려라.'
    + '\n  ⇒ 저장에서도 «벗겨야» 하면 js/io/section-serialize.js 의 뿌리로 옮겨라(그러면 겹에서 지워도 된다).');
  const stale = roster.filter((t) => !measured.has(t)).sort();
  assert.deepEqual(stale, [],
    `★ARTIFACT_ONLY 에 ★실물이 없는 칸이 ${stale.length}종 남았다 — 명부가 낡아 다음 것을 가린다: ${stale.join(' ')}`);
});

test('A4-G5-⛔ ★이 6종이 ★A(저장 뿌리)에 ★들어오면 ★빨강 — 「합집합으로 모으기」를 막는다', () => {
  const rm = runtimeMarkers();
  for (const [tok, why] of Object.entries(ARTIFACT_ONLY)) {
    assert.equal(rm.isRuntimeMarker(tok), false,
      `★«${tok}» 이 ★저장 뿌리(RUNTIME_MARKER_CLS/RE)에 ★들어왔다.\n`
      + `  ★까닭: ${why}\n`
      + '  ⇒ ㉠영구면 ★저장본에서 벗겨져 ★다시 열 때 그 상태가 ★사라진다'
      + '(tests/dom/grid-cell-emptied.dom.spec.js E 가 그 자리를 잰다).\n'
      + '  ⇒ ★「명부가 둘이면 파생시켜 하나로」의 ★«파생»은 ★합집합이 아니다 —'
      + ' ★★`B = A ＋ ARTIFACT_ONLY` 한 방향뿐이다.\n'
      + '  ⇒ ㉡미측정이면 ★먼저 재라. 재서 「저장에서 벗겨도 된다」가 나오면 ★이 칸을 지우고 옮겨라.');
  }
});

test('A4-G5-D ★PNG 재렌더 뒤 명부는 ★전부 뿌리가 덮는다 — 그 자리는 ★위임만 남았다', () => {
  const rm = runtimeMarkers();
  const strip = makeStripper();
  const code = read('js/io/export-image.js').split('\n').map((l) => strip(l)).join('\n');
  const sig = 'export function renderComponentsInClone';
  const i = code.indexOf(sig);
  assert.ok(i >= 0, `★${sig} 를 못 찾았다 — 이 칸이 아무것도 안 잰다`);
  let j = code.indexOf('{', i), d = 0, k = j;
  for (; k < code.length; k++) { const c = code[k]; if (c === '{') d++; else if (c === '}') { d--; if (!d) break; } }
  const toks = collectTokens(code.slice(j, k + 1));
  assert.ok(toks.size > 0, '★그 함수의 명부가 0종이다 — 자가 엉뚱한 곳을 본다(아래 0건이 항등식이 된다)');
  const hole = [...toks].filter((t) => !rm.isRuntimeMarker(t)).sort();
  assert.deepEqual(hole, [],
    `★PNG 재렌더 뒤 명부에 뿌리가 안 덮는 토큰이 ${hole.length}종: ${hole.join(' ')}\n`
    + '  ⇒ 이 칸이 초록인 동안 그 자리는 ★`stripRuntimeMarkers` 위임으로 ★그대로 바꿀 수 있다'
    + '(⛔단 ★«자리»는 재렌더 «뒤»에 남겨야 한다 — 그 파일 주석).');
});


/* ══════════════════════════════════════════════════════════════════════════
   A4-S1 — ★«분모를 늘리면 ★장면도 늘려야 한다»를 ★자가 센다. (2026-10-10 · 1009t3 A4)
   ★까닭 = `tests/_export-channels.js` MARKER_SCENES 머리말에 적었다(내가 밟은 그 자리).
   ⛔이 칸이 ★DOM 을 돌리지는 ★않는다 — ★«장면을 내는 자리가 ★있나»만 ★소스로 센다.
     ★«정말 돌았나»는 ★그 spec 의 ★전제 단언(D4)이 ★DOM 에서 잰다. ★두 겹이다.
═══════════════════════════════════════════════════════════════════════════ */
const { MARKER_TOKENS, MARKER_SCENES } = createRequire(import.meta.url)('../_export-channels.js');

test('A4-S1 ★MARKER_TOKENS 마다 «장면을 내는 자리»가 있다 — 양방향', () => {
  assert.ok(MARKER_TOKENS.length >= 4,
    `★MARKER_TOKENS 가 ${MARKER_TOKENS.length}종이다 — 분모가 줄었으면 왜 줄었는지 적어라`);
  const listed = Object.keys(MARKER_SCENES);
  const noScene = MARKER_TOKENS.filter((t) => !listed.includes(t));
  assert.deepEqual(noScene, [],
    `★토큰 ${noScene.length}종에 «장면을 내는 자리»가 안 적혀 있다: ${noScene.join(' · ')}\n` +
    '  ⇒ MARKER_TOKENS 를 늘렸으면 MARKER_SCENES 도 늘려라. ⛔안 늘리면 그 토큰을 쓰는 검사의\n' +
    '    «전제 단언»이 「라이브 0건」으로 빨개진다(2026-10-10 에 실제로 그랬다).');
  const stale = listed.filter((t) => !MARKER_TOKENS.includes(t));
  assert.deepEqual(stale, [],
    `★MARKER_SCENES 에 «분모 밖» 토큰이 ${stale.length}종 남았다 — 명부가 낡았다: ${stale.join(' · ')}`);
});

test('A4-S1-b ★그 장면 파일이 «실재»하고 «그 토큰을 실제로 언급»한다', () => {
  const miss = [], silent = [], noApp = [];
  for (const [tok, sc] of Object.entries(MARKER_SCENES)) {
    for (const key of ['spec', 'appPath']) {
      const rel = sc[key];
      if (!rel) continue;
      if (!fs.existsSync(path.join(ROOT, rel))) { miss.push(`${tok} ${key}=${rel}`); continue; }
      if (!read(rel).includes(tok)) silent.push(`${tok} ${key}=${rel}`);
    }
    /* ⛔「손으로 심는다」면 ★앱의 길로 재는 자리를 ★같이 적어야 한다 — ★안 적으면
       ★다음 사람이 ★「앱 경로도 쟀다」로 읽는다(그 까닭은 MARKER_SCENES 머리말). */
    if (/손으로 심는다/.test(sc.how) && !sc.appPath && tok !== 'bn2-line-selected') noApp.push(tok);
  }
  assert.deepEqual(miss, [], `★장면 파일이 «없다» ${miss.length}건:\n  ${miss.join('\n  ')}`);
  assert.deepEqual(silent, [],
    `★장면 파일이 그 토큰을 «한 번도 언급하지 않는다» ${silent.length}건 — 장면이 사라졌다:\n  ${silent.join('\n  ')}`);
  assert.deepEqual(noApp, [],
    `★«손으로 심는다»인데 appPath(앱의 길로 재는 자리)가 안 적힌 토큰 ${noApp.length}종: ${noApp.join(' · ')}\n` +
    '  ⇒ 적어라. ⛔안 적으면 손 심기가 「앱 경로도 쟀다」로 읽힌다.\n' +
    '  ★예외 = bn2-line-selected (이 명부가 생길 때부터 «이웃 토큰» 역할로 손 심기였다 — 그 축은 별건)');
});
