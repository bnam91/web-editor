/* U-ROWID — «.row 를 만드는 모든 자리가 «만들 때» id 를 주는가»를 명부로 잠근다.
 *   실행: node --test "tests/unit/*.test.mjs"  ·  소스만 읽는다(라이브 무접촉).
 *
 * ══ 무엇이 고장났었나 ═══════════════════════════════════════════════════════
 * js/io/save-load.js rebindAll 의 「row ID 복원」이 id 없는 .row 에 `'row_' + Math.random()` 을
 * 박는데, 그 줄은 restoreSnapshot(⌘Z) 과 switchPage 가 «둘 다» 지난다 ⇒ 복원할 때마다 «다른 id».
 * 그러면 「복원 직후 라이브 ≠ 방금 복원한 스냅샷」이 항상 참이 되고, undo 첫머리의
 * ensureHistoryCheckpoint 가 «매번» 한 칸을 쌓았다가 곧바로 pos-- 하므로 ★순증이 0 이다
 * ⇒ ⌘Z 가 제자리를 맴돈다 = 되돌리기 «전면 무동작». 2026-09-22 에 실제로 dev 로 나갔다.
 * ⛔그날 npm test 3,023 · npm run test:dom 1,060 이 전부 초록이었다 — 4,083건이 못 잡았다.
 *
 * ══ 왜 «런타임 우회로»가 아니라 «만들 때»인가 ═══════════════════════════════
 * 삽입 문에서 런타임으로 메우는 판(ensureRowIds)을 한 번 만들었다가 걷었다. 재 보니
 *   ⑴ 덮을 자리가 «하나»뿐이었고(아래 명부 — 30자리 중 29가 원래 준다),
 *   ⑵ ★문에서 조용히 메우면 «앞으로 id 없이 만드는 새 자리»가 생겨도 아무도 모른다.
 * ⇒ 그게 「우회로가 새 사각지대를 만든다」다. 자리마다 주고, 새 자리는 이 명부가 문다.
 *
 * ══ 이 검사가 무는 두 방향 ═════════════════════════════════════════════════
 *   · 명부 «밖»에 새 자리가 나면 빨강 — 새 블럭 타입이 id 없이 row 를 만들고 들어오는 길
 *   · 명부에 있는데 소스에 «없으면» 빨강 — 자리가 사라졌으면 왜 사라졌는지 여기 적어라
 * ⛔수(30·29·1)를 박지 않는다. 수는 «명부에서 나오는» 것이다.
 * ⛔줄 단위로 세지 않는다 — `className` 과 `id` 는 «같은 줄»에도 «다음 줄»에도 온다.
 *   2026-09-22 하루에만 이 헛셈으로 수가 네 번 갈렸다(7 · 8 · 4 · 1). 그래서 «변수 단위로,
 *   그 변수를 감싼 블록 몸통 안에서» 본다. T0 이 그 자를 «네 꼴»로 먼저 검증한다.
 *
 * ⚠️행동 축은 따로다 — tests/e2e/14-undo-depth.spec.js D1(동작 K개를 ⌘Z K번에 처음까지).
 *   이 검사는 «지금 아는 한 가지 원인»을 잠그고, 그쪽은 «원인이 무엇이든 증상»을 잠근다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeStripper } from './_strip-comments.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

/* ── 자 ────────────────────────────────────────────────────────────────────
   「이 식이 .row 를 «만든다»」고 보는 꼴 — className 대입과 classList.add 둘.
   ⛔`.row` 를 «고르는» 코드(querySelector('.row') 등)는 안 센다 — 만드는 자리만이다. */
const MAKE_RE = /(\b[A-Za-z_$][\w$]*)\s*\.\s*(?:className\s*=\s*'row'|classList\s*\.\s*add\('row'\))/g;
/** 그 자리를 감싼 블록의 끝(여는 중괄호 짝) — 거기까지가 «같은 몸통»이다. */
function enclosingEnd(src, from) {
  let d = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === '{') d++;
    else if (c === '}') { if (d === 0) return i; d--; }
  }
  return src.length;
}
/** 한 소스에서 row 생성 자리를 «변수 단위»로 뽑고, 그 변수가 id 를 받는지 본다. */
function scanSource(src) {
  const out = [];
  MAKE_RE.lastIndex = 0;
  let m;
  while ((m = MAKE_RE.exec(src))) {
    const v = m[1];
    /* 앞 300자도 같이 본다 — id 를 className «앞»에서 주는 꼴이 있다. */
    const region = src.slice(Math.max(0, m.index - 300), enclosingEnd(src, m.index));
    const idRe = new RegExp('\\b' + v.replace(/\$/g, '\\$') + '\\s*\\.\\s*id\\s*=');
    out.push({ v, hasId: idRe.test(region), line: src.slice(0, m.index).split('\n').length });
  }
  return out;
}
function jsFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) jsFiles(p, out);
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}
function scanRepo() {
  const found = {};
  for (const abs of jsFiles(path.join(ROOT, 'js')).sort()) {
    const strip = makeStripper();
    const src = fs.readFileSync(abs, 'utf8').split('\n').map(strip).join('\n');
    const hits = scanSource(src);
    if (hits.length) found[path.relative(ROOT, abs)] = hits;
  }
  return found;
}

/* ── 명부 — 파일 : 그 파일에서 row 를 만드는 «변수 이름»을 소스 순서대로 ───────────
   ⛔새 자리를 만들었으면 여기 적어라. 지웠으면 «왜 지웠는지» 여기 남겨라.
   (수를 세지 마라 — 이 표가 수다.) */
const ROSTER = {
  /* ★소스에 나오는 «그 순서» 그대로다(줄 번호순이 아니라 등장 순). */
  'js/block-factory.js': ['row', 'row', 'row', 'row', 'row',
                          /* 오버레이 안 삽입 — getSelectedOverlay() 가 있을 때만 타는 가지다.
                             ⚠️평소 삽입 경로가 «안 지나서» 행동 그물(14-undo-depth)도 이 둘은 못 덮는다
                                (그 둘의 id 만 되돌려도 그 그물 여섯 검사가 전부 초록이었다 — 실측).
                             ⇒ 이 명부가 그 둘의 «유일한» 자물쇠다. */
                          'overlayRow', 'overlayRow',
                          'row', 'row', 'row', 'row', 'row'],
  'js/blocks/banner02-block.js':   ['row'],
  'js/blocks/canvas-block.js':     ['row'],
  'js/blocks/chat-block.js':       ['row'],
  'js/blocks/comparison-block.js': ['row'],
  'js/blocks/grid-block.js':       ['row'],
  'js/blocks/iconify-block.js':    ['row'],
  'js/blocks/infocard-block.js':   ['row'],
  'js/blocks/innercard-block.js':  ['row'],
  'js/blocks/laurel-block.js':     ['row'],
  'js/blocks/mockup-block.js':     ['row'],
  'js/blocks/modal-block.js':      ['row'],
  'js/blocks/qa-block.js':         ['row'],
  'js/blocks/step-block.js':       ['row'],
  'js/blocks/vector-block.js':     ['row'],
  /* 레이어 패널에서 텍스트프레임을 «오버레이로» 끌 때 만드는 래퍼.
     2026-09-22 까지 id 를 «안» 주던 마지막 한 자리다(30 중 1). */
  'js/panels/layer-panel-items.js': ['r'],
  'js/panels/template-system.js':  ['row', 'row'],
  'js/shape-frame.js':             ['row'],
};

/* ── T0 ★자 자체 점검 — 「줄 단위로 세면 틀린다」를 여기서 잠근다 ──────────────── */
test('T0 ★자가 «네 꼴»을 다 읽는다 — 같은 줄 · 다음 줄 · 앞줄 · 안 주는 꼴', () => {
  const sameLine = `function f(){ const row = document.createElement('div');
    row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack'; }`;
  const nextLine = `function f(){ const row = document.createElement('div');
    row.className = 'row';
    row.id = genId('row');
    row.dataset.layout = 'stack'; }`;
  const before   = `function f(){ const row = document.createElement('div');
    row.id = genId('row');
    row.className = 'row'; }`;
  const none     = `function f(){ const r = document.createElement('div');
    r.className = 'row'; r.dataset.layout = 'stack'; r.appendChild(x); }`;
  /* ★다른 변수의 id 를 제 것으로 읽으면 안 된다 — 그게 「옆 자리를 물어 과다계수」다. */
  const other    = `function f(){ const r = document.createElement('div');
    r.className = 'row'; block.id = genId('b'); }`;
  assert.deepEqual(scanSource(sameLine).map(x => x.hasId), [true],  '같은 줄에 준 것을 «못» 읽는다');
  assert.deepEqual(scanSource(nextLine).map(x => x.hasId), [true],  '★다음 줄에 준 것을 «못» 읽는다 — 이 헛셈이 하루에 네 번 났다');
  assert.deepEqual(scanSource(before).map(x => x.hasId),   [true],  'className «앞»에서 준 것을 못 읽는다');
  assert.deepEqual(scanSource(none).map(x => x.hasId),     [false], '★안 주는 꼴을 «준다»고 읽는다 — 이 검사가 통과를 만들어 낸다');
  assert.deepEqual(scanSource(other).map(x => x.hasId),    [false], '★«남의» id 대입을 제 것으로 읽는다 — 과다계수의 씨앗이다');
  /* 두 자리가 한 몸통에 있어도 «각각» 센다 */
  const two = `function f(){ const a = document.createElement('div'); a.className = 'row'; a.id = 'x';
    const b = document.createElement('div'); b.className = 'row'; }`;
  assert.deepEqual(scanSource(two).map(x => x.hasId), [true, false], '한 몸통 안의 두 자리를 따로 못 센다');
});

/* ── T1 명부가 소스와 «양쪽»으로 맞나 ─────────────────────────────────────── */
test('T1 ★.row 를 만드는 자리의 «명부»가 소스와 맞는다 (새 자리도 · 사라진 자리도 빨강)', () => {
  const found = scanRepo();
  const asNames = Object.fromEntries(Object.entries(found).map(([f, hits]) => [f, hits.map(h => h.v)]));
  assert.deepEqual(asNames, ROSTER,
    '★.row 를 만드는 자리 명부가 어긋났다.\n' +
    `  잰 것 : ${JSON.stringify(asNames, null, 1)}\n` +
    '  ⇒ 새 자리를 만들었으면 ROSTER 에 적고, «만들 때» id 를 줘라(아래 T2 가 그걸 문다).\n' +
    '  ⇒ 자리가 사라졌으면 왜 사라졌는지 ROSTER 에 남겨라.');
});

/* ── T2 ★모든 자리가 «만들 때» id 를 준다 ──────────────────────────────────── */
test('T2 ★.row 를 만드는 «모든» 자리가 만들 때 id 를 준다 — 안 주면 ⌘Z 가 제자리를 맴돈다', () => {
  const found = scanRepo();
  const bad = [];
  for (const [f, hits] of Object.entries(found)) for (const h of hits) if (!h.hasId) bad.push(`${f}:${h.line} (${h.v})`);
  assert.deepEqual(bad, [],
    '★id 없이 .row 를 만드는 자리가 있다:\n  ' + bad.join('\n  ') +
    '\n  ⇒ js/io/save-load.js rebindAll 이 복원마다 «다른» id 를 박아 「복원 직후 라이브 ≠ 스냅샷」이' +
    '\n    항상 참이 된다 ⇒ undo 가 한 칸 쌓고 곧바로 pos-- 해서 순증 0 = 되돌리기 «전면 무동작».' +
    '\n  ⛔삽입 문에서 런타임으로 메우지 마라 — 앞으로 생길 새 자리를 조용히 가려 사각지대가 된다.' +
    '\n    자리마다 «만들 때» 주고 위 ROSTER 에 적어라.');
});

/* ── T3 옛 저장본 구제는 «그대로» 둔다 ─────────────────────────────────────── */
test('T3 rebindAll 의 「row ID 복원」은 지우지 않는다 — 이미 저장된 파일이 사는 길이다', () => {
  const s = fs.readFileSync(path.join(ROOT, 'js/io/save-load.js'), 'utf8');
  assert.match(s, /\.row'\)\.forEach\(row => \{\s*if \(!row\.id\)/,
    '★rebindAll 의 row id 구제가 사라졌다 — 이 고침은 «앞으로 만드는» row 만 덮는다.' +
    ' 이미 디스크에 있는 옛 저장본의 id 없는 row 는 저 줄이 살린다(로드 때 한 번).');
});
