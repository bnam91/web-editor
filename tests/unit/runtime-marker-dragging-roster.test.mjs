/* runtime-marker-dragging-roster — ★«끌기 표식 클래스»가 ★직렬화 스냅샷에서 ★★반드시 ★세척되게 ★잠근다.
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *
 * ★★왜 있나 (2026-10-12 · 지디 · R3)
 *   `tests/dom/free-frame-grid-width-roundtrip.dom.spec.js` 의 R3(⌘Z 10번이 한 걸음씩)가 깨졌다.
 *   ★행위로 가른 사슬:
 *     ⒜ `js/block-drag.js` 가 끌기 시작에 `frame-child-dragging` 을 붙인다.
 *     ⒝ 다섯 줄 뒤 «같은 틱»에 `_hist.arm()` → `pushHistory()` → `getSerializedCanvas()` 가 돈다
 *        (`js/history.js` 머리말: 「부르는 그 순간 살아있는 캔버스를 찍는다」).
 *     ⒞ 직렬화는 «런타임 표식 클래스»를 세척하는데, 그 명부(`RUNTIME_MARKER_CLS`)는 `indexOf`
 *        ★완전일치라 `frame-child-dragging` 이 ★샜다(명부의 토큰은 `'dragging'` 하나다).
 *     ⇒ 시작 표본이 «표식이 든 캔버스»를 찍고, 되돌리면 그 표식이 같이 살아나 걸음이 한 칸 어긋났다.
 *   ★실측으로 닫았다: 그 토큰 하나를 명부에 더하니 R3 가 green 3/3(제품의 add·CSS 둘 다 그대로).
 *   ⇒ 그래서 `RUNTIME_MARKER_RE` 를 `dragging` 가족까지 덮게 넓혔다. ★이 벌이 그 줄을 지킨다.
 *
 * ★★무엇이 빨개지면 무슨 뜻인가
 *   ⒜ 주 단언 — 새 `*dragging` 클래스가 생겼는데 규칙이 안 덮는다 ⇒ ★그날 빨강이 난다(그게 이 벌의 일이다).
 *   ⒝ 양성대조 — 명부/규칙을 소스에서 못 뽑았다 ⇒ ★이 벌은 «안 재고 있다». 패턴을 고쳐라, 지우지 마라.
 *   ⒞ 음성대조 — 규칙이 너무 넓어 «살아남아야 하는» 클래스까지 세척한다 ⇒ ★넓힘을 되돌려라.
 *
 * ⚠️이 검사는 «소스 문자열»을 본다. 정상적인 리팩터링에도 빨강이 날 수 있다 — 그때는 지우지 말고
 *   js/io/section-serialize.js 의 `isRuntimeMarker` 가 여전히 «RE || 완전일치» 꼴인지 확인한 뒤 패턴을 고쳐라.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { readSrc, toPosix } = require('./_srcread.js');
const { stripComments } = require('./_strip-comments.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../../');

const SER_PATH = 'js/io/section-serialize.js';
const SER = readSrc(REPO, SER_PATH);

/* ── js/** · css/** 전수 — ★사람이 관리하는 목록이 아니다 ─────────────────── */
const SRC_FILES = (function walk(dir, acc) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(js|mjs|css)$/.test(e.name)) acc.push(toPosix(path.relative(REPO, p)));
  }
  return acc;
})(path.join(REPO, 'js'), []).concat(
  (function walk(dir, acc) {
    if (!fs.existsSync(dir)) return acc;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, acc);
      else if (/\.css$/.test(e.name)) acc.push(toPosix(path.relative(REPO, p)));
    }
    return acc;
  })(path.join(REPO, 'css'), [])
).sort();

/* ★★«코드 줄»만 본다 — ⛔주석을 세면 내 머리말이 제 계수의 입력이 된다(2026-10-12 실사고 둘). */
const CODE = new Map(SRC_FILES.map(p => [p, stripComments(readSrc(REPO, p))]));

/** 소스에서 «그 두 자»를 뽑는다 — ⛔값을 손으로 박지 않는다. */
function rosterFromSource() {
  const reM = SER.match(/RUNTIME_MARKER_RE\s*=\s*\/(.*?)\/([gimsuy]*)\s*;/);
  const clsM = SER.match(/RUNTIME_MARKER_CLS\s*=\s*\[([\s\S]*?)\]/);
  const list = clsM ? [...clsM[1].matchAll(/'([^']+)'/g)].map(m => m[1]) : [];
  return { re: reM ? new RegExp(reM[1], reM[2]) : null, list };
}

/** 코드에서 «*dragging» 클래스 토큰을 전수로 뽑는다 — 두 길로(classList 호출 · 문자열/CSS 선택자). */
function draggingTokens() {
  const out = new Set();
  for (const [, code] of CODE) {
    for (const m of code.matchAll(/classList\.(?:add|remove|contains|toggle|replace)\(\s*'([A-Za-z0-9_-]*dragging)'/g)) out.add(m[1]);
    for (const m of code.matchAll(/'([A-Za-z0-9_-]*dragging)'/g)) out.add(m[1]);
    for (const m of code.matchAll(/"([A-Za-z0-9_-]*dragging)"/g)) out.add(m[1]);
    for (const m of code.matchAll(/\.([A-Za-z0-9_-]*dragging)\b/g)) out.add(m[1]);
  }
  out.delete('dragging-');            // 꼴만 맞고 클래스가 아닌 찌꺼기 방지
  return [...out].filter(Boolean).sort();
}

const { re, list } = rosterFromSource();
const covered = (cls) => (re ? re.test(cls) : false) || list.indexOf(cls) !== -1;

test('★양성대조 — 명부와 규칙을 소스에서 «정말» 뽑았다 (못 뽑으면 아래가 «안 재고 있다»와 구분 안 된다)', () => {
  assert.ok(re, `★RUNTIME_MARKER_RE 를 ${SER_PATH} 에서 못 뽑았다 — 패턴을 고쳐라(지우지 마라)`);
  assert.ok(list.length >= 10, `★RUNTIME_MARKER_CLS 가 너무 짧다(${list.length}) — 추출이 깨졌다`);
  assert.ok(SRC_FILES.length >= 50, `★전수 파일이 너무 적다(${SRC_FILES.length}) — 걷기가 깨졌다`);
  /* ★그 판정이 «RE || 완전일치» 꼴인가 — 이 벌의 전제다 */
  assert.match(SER, /RUNTIME_MARKER_RE\.test\(cls\)\s*\|\|\s*RUNTIME_MARKER_CLS\.indexOf\(cls\)/,
    '★`isRuntimeMarker` 가 «RE || 완전일치» 꼴이 아니다 — 이 벌의 전제가 깨졌다');
});

test('★양성대조② — 코드에서 «*dragging» 토큰을 «정말» 찾았다', () => {
  const toks = draggingTokens();
  assert.ok(toks.length >= 5, `★*dragging 토큰이 너무 적다(${toks.length}: ${toks.join(' ')}) — 추출이 깨졌다`);
  assert.ok(toks.includes('frame-child-dragging'),
    '★`frame-child-dragging` 을 못 찾았다 — 그 줄이 사라졌거나 추출이 깨졌다(둘을 갈라 확인해라)');
});

test('★★주 단언 — 코드의 «*dragging» 클래스가 «전부» 런타임 표식으로 세척된다', () => {
  const toks = draggingTokens();
  const hole = toks.filter(t => !covered(t));
  assert.deepEqual(hole, [],
    `★세척 명부/규칙이 안 덮는 «*dragging» 클래스 ${hole.length}종: ${hole.join(' ')}\n` +
    `  ⇒ 그 토큰은 직렬화 스냅샷에 실려 되돌리기 걸음을 어긋나게 한다(2026-10-12 R3).\n` +
    `  ⇒ 고침: ${SER_PATH} 의 RUNTIME_MARKER_RE 가 그 꼴을 덮게 넓혀라(명부에 한 줄씩 넣지 마라 — 명부가 둘이 된다).\n` +
    `  ★전수 ${toks.length}종: ${toks.join(' ')}`);
});

test('★★음성대조 — 규칙이 «살아남아야 하는» 클래스까지 세척하지는 않는다', () => {
  /* ★저장본에 반드시 남아야 하는 구조 클래스들 — 이것이 세척되면 저장본이 깨진다. */
  const MUST_KEEP = ['frame-block', 'section-block', 'text-block', 'asset-block', 'row', 'gap-block', 'shape-block'];
  const wrong = MUST_KEEP.filter(c => covered(c));
  assert.deepEqual(wrong, [],
    `★규칙이 너무 넓다 — 저장본에 남아야 하는 클래스를 세척한다: ${wrong.join(' ')}`);
});
