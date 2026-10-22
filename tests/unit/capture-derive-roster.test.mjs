/* R0~R5 — ★CAPTURE-ROSTER-NOT-DERIVED-FROM-SAVE-01 (2026-10-22 · imac-지디워커 · 설계 = 지디 PLAN-capture-derive)
 *   증상 이름 = EXPORT-SELECTED-HANDLE-BAKED-IN-01 (고른 채 내보내면 손잡이가 박힌다) · ★이 검사는 ★뿌리를 잰다.
 *
 * ★무엇을 재나 — 편집 노드 «정본»(js/io/save-load.js NON_CONTENT_UI_SELECTOR · ★소스에서 파싱)의 선택자마다
 *   ★세 길이 ★그 노드를 ★지우나:
 *     capture = js/io/capture-safety.js stripEditorOnlyForCapture (PNG·썸네일·단독 HTML 이 같이 부르는 공용 겹)
 *     html    = capture ∪ js/io/export-html.js exportHTMLFile 의 제 손 지우기
 *     save    = js/io/section-serialize.js serializeCleanRoot (저장본)
 *   ★«막힌다» = 그 길의 함수 몸통(주석 뗀 코드)에 querySelectorAll(…).forEach(…remove()) 로 ★그 선택자가 있다.
 *   (자 = tests/unit/_clone-removals.mjs — drop 축과 같은 파서 한 벌)
 * ★★단언 R1 = 「예외로 이름 붙지 않은 정본 선택자 × 세 길 — ★안 막히는 칸 = 0」.
 *   ⇒ ★★지금은 ★빨강이다(2026-10-22 dc93370e). ★그게 목적이다 — ⛔skip/fixme 로 두지 마라(발주 ⓒ).
 *   ⇒ ⛔빨강을 끄려고 ★제품을 고치지 마라(제품 고침 = 지디 판정 칸) · ⛔예외에 넣어 끄지 마라(예외는 이름·까닭·날짜 셋을 다 단다).
 * ★«합집합»이 아니라 «길마다»로 잰다 — 정본은 저장 쪽 상수라 «세 길의 합»으로 재면 저장이 늘 덮어 ★항등식 0 이 된다.
 * ⛔안 재는 것: ⒤ 숨김(display·visibility)으로 «안 그려지는» 것 — 노드 «제거»만 본다(회전 핫존은 .selected 매인 display 로 숨는다고
 *   MARKER-HLB-261022 ⑶ 이 적었다 — 그래서 이 표에선 빨강 칸이지만 «그려지나»는 S3 몫) ⅱ) 부모째 지워지는 자식(.annot-handle 은
 *   .annotation-block 이 지금 캡처에서 지워져 같이 사라진다 — 그 부모는 현빈 결정 ⒝ 로 «남아야» 한다) ⅲ) 정본 «밖» — 아래 R3 이 따로 찍는다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { fnBody, removedSelectors } from './_clone-removals.mjs';

const _req = createRequire(import.meta.url);
const { readSrc } = _req('./_srcread.js');
const { makeStripper } = _req('./_strip-comments.js');
const { editorNodeCanon, EDITOR_NODE_CANON_SRC, EDITOR_NODE_EXCEPTIONS } = _req('../_export-channels.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NAME = 'CAPTURE-ROSTER-NOT-DERIVED-FROM-SAVE-01';

const codeOf = (rel) => { const s = makeStripper(); return readSrc(ROOT, rel).split('\n').map(l => s(l)).join('\n'); };
const sels = (file, fn) => {
  const body = fnBody(codeOf(file), fn);
  assert.ok(body, `★${file} 에 ${fn} 이 없다 — 길이 사라졌다`);
  const r = removedSelectors(body);
  assert.equal(r.covered, r.total, `★${file} ${fn} 에 파서가 못 읽는 지우기 꼴이 있다 — 이 표가 거짓이 된다`);
  return r.sels;
};

/** 세 길이 지우는 선택자 — ★전부 소스에서 읽는다 */
function paths() {
  const capture = sels('js/io/capture-safety.js', 'stripEditorOnlyForCapture');
  assert.ok(/stripEditorOnlyForCapture\s*\(\s*clone\s*\)/.test(fnBody(codeOf('js/io/export-html.js'), 'exportHTMLFile')),
    '★exportHTMLFile 이 공용 겹을 안 부른다 — html = capture ∪ 제 손 이 거짓이 된다');
  const html = [...new Set([...capture, ...sels('js/io/export-html.js', 'exportHTMLFile')])];
  const save = sels('js/io/section-serialize.js', 'serializeCleanRoot');
  return { capture, html, save };
}
const PATHS = ['capture', 'html', 'save'];
const SRC_OF = { capture: 'capture-safety.js stripEditorOnlyForCapture', html: 'export-html.js exportHTMLFile(＋공용 겹)', save: 'section-serialize.js serializeCleanRoot' };

/** ★판정 «하나» — R1 실판 · R4 쌍이 같은 것을 부른다. 돌려주는 것 = 표 행 · 빨강 칸. */
function judge(canon, P, exceptions) {
  const rows = [], gaps = [];
  for (const sel of canon) {
    const ex = exceptions.find(e => e.sel === sel);
    const row = { sel };
    for (const p of PATHS) {
      const blocked = P[p].includes(sel);
      const exempt = !!(ex && ex.exempts.includes(p));
      row[p] = blocked ? '막힘' : (exempt ? `예외(${ex.id})` : '★안 막힘');
      if (!blocked && !exempt) gaps.push(`${sel} ∌ ${p}`);
    }
    rows.push(row);
  }
  return { rows, gaps };
}
const table = (rows) => ['선택자 | capture | html | save', ...rows.map(r => `${r.sel} | ${r.capture} | ${r.html} | ${r.save}`)].join('\n');

const CANON = editorNodeCanon(ROOT);
const P = paths();

test('R0 ★정본을 ★파싱으로 끌어왔다 — 손 명부 0 · 몇 종인지 찍는다', (t) => {
  const raw = readSrc(ROOT, EDITOR_NODE_CANON_SRC.file);
  assert.match(raw, new RegExp(`export const ${EDITOR_NODE_CANON_SRC.name}\\s*=`), '★정본 상수가 그 파일에 없다');
  assert.ok(CANON.length > 0 && CANON.every(s => /^\.[a-z0-9-]+$/.test(s)), `★파싱이 이상하다: ${CANON.join(' ')}`);
  assert.equal(new Set(CANON).size, CANON.length, '★정본에 같은 선택자가 두 번');
  t.diagnostic(`정본 ${EDITOR_NODE_CANON_SRC.file} ${EDITOR_NODE_CANON_SRC.name} = ${CANON.length}종 (파싱) · 그중 handle ${CANON.filter(s => /handle/.test(s)).length}`);
  t.diagnostic(`세 길 지우기 수: capture ${P.capture.length} · html ${P.html.length} · save ${P.save.length} (자 = _clone-removals 파서)`);
});

test(`R1 ★★${NAME} — 정본의 선택자가 ★세 길 «모두»에서 막히나 (예외 밖 · 안 막히는 칸 = 0)`, (t) => {
  const { rows, gaps } = judge(CANON, P, EDITOR_NODE_EXCEPTIONS);
  t.diagnostic('\n' + table(rows));
  const byPath = Object.fromEntries(PATHS.map(p => [p, gaps.filter(g => g.endsWith('∌ ' + p)).map(g => g.split(' ∌ ')[0])]));
  assert.deepEqual(gaps, [],
    `★${NAME} — 편집 노드 정본(${EDITOR_NODE_CANON_SRC.file} ${EDITOR_NODE_CANON_SRC.name} · ${CANON.length}종)을 ` +
    `★안 지우는 칸이 ${gaps.length} 개다. ★까닭 = 세 길의 지우기 명부가 ★정본에서 파생되지 않고 ★손으로 따로 있다:\n` +
    PATHS.map(p => `  ${p.padEnd(7)} (${SRC_OF[p]}) 안 막힘 ${byPath[p].length}: ${byPath[p].join(' ')}`).join('\n') +
    `\n  ⇒ 이 노드들은 «고른 채» 내보내면 그 길의 산출물에 ★남는다(그려지는지는 CSS·display 에 달렸다 — S3 가 잰다).` +
    `\n  ⛔토큰 한 줄 더하기로 끄지 마라(21번째가 또 온다) · 처방 = 그 길이 ★정본에서 파생 (제품 고침 = 지디 판정 칸)`);
});

test('R2 ★예외 다섯 — 이름 · 까닭 · 날짜가 다 있다 (+ 지금 정본과 겹치나 · 캡처가 «남아야 할» 것을 지우나)', (t) => {
  assert.equal(EDITOR_NODE_EXCEPTIONS.length, 5);
  assert.equal(new Set(EDITOR_NODE_EXCEPTIONS.map(e => e.id)).size, 5, '★예외 이름이 겹친다');
  for (const e of EDITOR_NODE_EXCEPTIONS) {
    assert.ok(e.id && /-0\d$/.test(e.id), `★예외 이름 꼴: ${e.id}`);
    assert.ok(typeof e.why === 'string' && e.why.length > 10, `★${e.id} 에 까닭이 없다`);
    assert.match(String(e.since), /^\d{4}-\d{2}-\d{2}/, `★${e.id} 에 날짜가 없다`);
    assert.ok(['stays', 'design'].includes(e.effect) && e.exempts.length > 0);
  }
  assert.deepEqual(EDITOR_NODE_EXCEPTIONS.map(e => e.sel).sort(),
    ['.annotation-block', '.qa-block', '.sec-fxpart-wrap', '[data-is-placeholder]', '[data-memo]']);
  /* 사실만 찍는다(단언 아님 — 제품 고침은 지디 칸): 예외 ∩ 정본 · 캡처가 'stays' 를 지우는지 */
  const inter = EDITOR_NODE_EXCEPTIONS.filter(e => CANON.includes(e.sel)).map(e => e.sel);
  const staysButRemoved = EDITOR_NODE_EXCEPTIONS.filter(e => e.effect === 'stays' && P.capture.includes(e.sel)).map(e => e.sel);
  t.diagnostic(`예외 ∩ 정본 = ${inter.length} [${inter.join(' ')}] · ★캡처가 «남아야 할» 것을 지금 지운다 = ${staysButRemoved.length} [${staysButRemoved.join(' ')}]`);
});

test('R3 ★정본 «밖» — 저장(serializeCleanRoot)은 지우는데 정본에 없는 것 (이 검사의 초록이 덮지 않는 것)', (t) => {
  const outside = P.save.filter(s => !CANON.includes(s));
  const capMiss = outside.filter(s => !P.capture.includes(s));
  t.diagnostic(`저장 ∖ 정본 = ${outside.length} · 그중 캡처도 안 지움 = ${capMiss.length}: ${capMiss.join(' ')}`);
  assert.ok(P.save.length > 0, '★저장 길 지우기를 하나도 못 읽었다 — 파서가 눈멀었다');
  /* ★알려진 셋(MARKER-HLB-261022 ⑶ 위험 3종)은 «정본 밖»이라 R1 이 안 본다 — 그 사실을 박는다(바뀌면 이 줄을 고쳐라) */
  for (const s of ['.hlb-handle', '.sticker-corner-handle', '.gradient-corner-handle']) {
    assert.ok(!CANON.includes(s) && P.save.includes(s) && !P.capture.includes(s),
      `★${s} 의 자리가 바뀌었다(정본 밖 · 저장만 지움 · 캡처 안 지움 이 아니다) — R1·R3 해석을 다시 적어라`);
  }
});

test('R4 ★★쌍 — 정본에 ★한 줄 늘리면 ★그 이름으로 빨강 (같은 판정 함수)', () => {
  const probe = '.zz-probe-handle';
  assert.ok(!CANON.includes(probe));
  const { gaps } = judge([...CANON, probe], P, EDITOR_NODE_EXCEPTIONS);
  assert.deepEqual(gaps.filter(g => g.startsWith(probe + ' ')), [`${probe} ∌ capture`, `${probe} ∌ html`, `${probe} ∌ save`]);
  /* 반대쪽 — 세 길이 다 지우고 있으면 그 줄은 빨강이 아니다(자가 «무조건 빨강»이 아니다) */
  const P2 = { capture: [...P.capture, probe], html: [...P.html, probe], save: [...P.save, probe] };
  assert.deepEqual(judge([...CANON, probe], P2, EDITOR_NODE_EXCEPTIONS).gaps.filter(g => g.startsWith(probe + ' ')), []);
  /* 예외는 이름이 있어야만 뺀다 */
  const ex = [...EDITOR_NODE_EXCEPTIONS, { id: 'ZZ-PROBE-01', sel: probe, effect: 'design', exempts: ['capture', 'html', 'save'], why: '지어낸 예외', since: '2026-10-22' }];
  assert.deepEqual(judge([...CANON, probe], P, ex).gaps.filter(g => g.startsWith(probe + ' ')), []);
});

test('R5 ★음성대조 — 세 길이 다 지우는 정본 선택자는 빨강 칸이 아니다(지금 판에 실재하는 것으로)', (t) => {
  const { rows } = judge(CANON, P, EDITOR_NODE_EXCEPTIONS);
  const allBlocked = rows.filter(r => PATHS.every(p => r[p] === '막힘')).map(r => r.sel);
  t.diagnostic(`세 길 다 막힘 = ${allBlocked.length}: ${allBlocked.join(' ')}`);
  assert.ok(allBlocked.length > 0, '★세 길 다 막힌 선택자가 0 이다 — 자가 «무조건 빨강»인지 의심하라');
});
