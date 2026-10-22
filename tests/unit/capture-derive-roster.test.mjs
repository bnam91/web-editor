/* R0~R5 — ★CAPTURE-ROSTER-NOT-DERIVED-FROM-SAVE-01 (2026-10-22 · imac-지디워커 · 설계 = 지디 PLAN-capture-derive · 판정 ⑴ 넓은 정본)
 *   증상 이름 = EXPORT-SELECTED-HANDLE-BAKED-IN-01 (고른 채 내보내면 손잡이가 박힌다) · ★이 검사는 ★뿌리를 잰다.
 *
 * ★정본 = 편집 노드 «저장 쪽» 두 출처의 합 — tests/_export-channels.js editorNodeCanon (★소스 파싱 · 손 명부 0):
 *     ⒜ js/io/save-load.js NON_CONTENT_UI_SELECTOR(문자열 리터럴)
 *     ⒝ js/io/section-serialize.js serializeCleanRoot 몸통의 querySelectorAll(…).forEach(…remove())
 *   ⛔「저장이 지우는 것」≠「캡처가 지워야 할 것」 ⇒ 항목마다 CAPTURE_VERDICT ⟪yes / no(까닭) / unmeasured⟫.
 * ★세 길:
 *     capture = js/io/capture-safety.js stripEditorOnlyForCapture (PNG·썸네일·단독 HTML 이 같이 부르는 공용 겹)
 *     html    = capture ∪ js/io/export-html.js exportHTMLFile 의 제 손 지우기
 *     save    = js/io/section-serialize.js serializeCleanRoot (저장본)
 *   ★«막힌다» = 그 길의 함수 몸통(주석 뗀 코드)에 querySelectorAll(…).forEach(…remove()) 로 ★그 선택자가 있다.
 *   (자 = tests/unit/_clone-removals.js — drop 축과 같은 파서 한 벌)
 * ★★단언 R1 = 「verdict 'yes' 인 정본 선택자 × 세 길 — ★안 막히는 칸 = 0」.
 *   ⇒ ★★지금은 ★빨강이다(2026-10-22 dc93370e). ★그게 목적이다 — ⛔skip/fixme 로 두지 마라(발주 ⓒ).
 *   ⇒ ⛔빨강을 끄려고 ★제품을 고치지 마라(제품 고침 = 지디 판정 칸) · ⛔verdict 를 'no'·'unmeasured' 로 바꿔 끄지 마라(까닭이 근거여야 한다).
 * ★«합집합»이 아니라 «길마다»로 잰다 — 정본이 저장 쪽이라 «세 길의 합»으로 재면 저장이 늘 덮어 ★항등식 0 이 된다.
 * ⛔안 재는 것: ⒤ 숨김(display·visibility)으로 «안 그려지는» 것 — 노드 «제거»만 본다(회전 핫존·.shape-handle 은 .selected 매인 display 로
 *   숨는다 — 이 표에선 빨강 칸이지만 «그려지나»는 S3 몫) ⅱ) 부모째 지워지는 자식 ⅲ) 'unmeasured' 항목(R1 메시지에 수만 찍는다). */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const _req = createRequire(import.meta.url);
const { fnBody, removedSelectors } = _req('./_clone-removals.js');
const { readSrc } = _req('./_srcread.js');
const { makeStripper } = _req('./_strip-comments.js');
const { editorNodeCanon, EDITOR_NODE_CANON_SRC, EDITOR_NODE_EXCEPTIONS, CAPTURE_VERDICT, CAPTURE_VERDICT_VALUES } = _req('../_export-channels.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NAME = 'CAPTURE-ROSTER-NOT-DERIVED-FROM-SAVE-01';
const NC = 'js/io/save-load.js#NON_CONTENT_UI_SELECTOR';
const SR = 'js/io/section-serialize.js#serializeCleanRoot';

const codeOf = (rel) => { const s = makeStripper(); return readSrc(ROOT, rel).split('\n').map(l => s(l)).join('\n'); };
const sels = (file, fn) => {
  const body = fnBody(codeOf(file), fn);
  assert.ok(body, `★${file} 에 ${fn} 이 없다 — 길이 사라졌다`);
  const r = removedSelectors(body);
  assert.equal(r.covered, r.total, `★${file} ${fn} 에 파서가 못 읽는 지우기 꼴이 있다 — 이 표가 거짓이 된다`);
  return r.sels;
};
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

/** 판정 표 검사 — 정본의 모든 항목에 ★값이 있나 · 값 꼴이 맞나. 돌려주는 것 = 틀린 줄. */
function verdictProblems(canon, verdict) {
  const out = [];
  for (const sel of canon) {
    const v = verdict[sel];
    if (!v) { out.push(`${sel} — 「캡처에서도 지워야 하나」 판정 없음`); continue; }
    if (!CAPTURE_VERDICT_VALUES.includes(v.v)) out.push(`${sel} — 판정 값 «${v.v}» 은 모르는 값`);
    if (!(typeof v.why === 'string' && v.why.length > 8)) out.push(`${sel} — 판정 까닭이 없다`);
    if (v.v === 'no' && !EDITOR_NODE_EXCEPTIONS.some(e => e.id === v.exception)) out.push(`${sel} — 'no' 인데 이름 붙은 예외(EDITOR_NODE_EXCEPTIONS)가 없다`);
  }
  return out;
}
/** ★판정 «하나» — R1 실판 · R4 쌍이 같은 것을 부른다. */
function judge(canon, P, verdict) {
  const rows = [], gaps = [], unmeasured = [];
  for (const sel of canon) {
    const v = (verdict[sel] || {}).v;
    const row = { sel, verdict: v || '(없음)' };
    for (const p of PATHS) {
      const blocked = P[p].includes(sel);
      row[p] = blocked ? '막힘' : (v === 'yes' ? '★안 막힘' : (v === 'no' ? '안 막힘(남아야 함)' : '안 막힘(판정 미정)'));
      if (!blocked && v === 'yes') gaps.push(`${sel} ∌ ${p}`);
    }
    if (v === 'unmeasured') unmeasured.push(sel);
    rows.push(row);
  }
  return { rows, gaps, unmeasured };
}
const table = (rows) => ['선택자 | 캡처에서도 지워야? | capture | html | save', ...rows.map(r => `${r.sel} | ${r.verdict} | ${r.capture} | ${r.html} | ${r.save}`)].join('\n');

const CANON = editorNodeCanon(ROOT);
const P = paths();

test('R0 ★정본을 ★파싱으로 끌어왔다 — 손 명부 0 · 출처마다 몇 종인지 찍는다', (t) => {
  assert.equal(EDITOR_NODE_CANON_SRC.length, 2, '★정본 출처가 둘이 아니다(지디 판정 ⑴ = NON_CONTENT ∪ serializeCleanRoot)');
  const nc = CANON.by[NC], sr = CANON.by[SR];
  assert.ok(nc && sr, '★출처 둘 중 하나를 못 읽었다');
  assert.ok(CANON.all.every(s => /^[.\[a-z][\w\-\[\]="'.]*$/i.test(s)), `★파싱이 이상하다: ${CANON.all.join(' ')}`);
  const srOnly = sr.filter(s => !nc.includes(s)), ncOnly = nc.filter(s => !sr.includes(s));
  t.diagnostic(`정본 = ${CANON.all.length}종 · ${NC} ${nc.length} · ${SR} ${sr.length} · serialize ∖ NON_CONTENT = ${srOnly.length}: ${srOnly.join(' ')} · NON_CONTENT ∖ serialize = ${ncOnly.length}`);
  t.diagnostic(`세 길 지우기 수: capture ${P.capture.length} · html ${P.html.length} · save ${P.save.length} (자 = _clone-removals 파서)`);
});

test('R0b ★정본의 «모든» 항목에 「캡처에서도 지워야 하나」 판정이 있다 (값 = yes / no(까닭·예외 이름) / unmeasured)', (t) => {
  const bad = verdictProblems(CANON.all, CAPTURE_VERDICT);
  const count = (v) => CANON.all.filter(s => (CAPTURE_VERDICT[s] || {}).v === v).length;
  t.diagnostic(`판정: yes ${count('yes')} · no ${count('no')} · unmeasured ${count('unmeasured')} · (정본 밖 'no' 보기: ${Object.keys(CAPTURE_VERDICT).filter(s => !CANON.all.includes(s)).join(' ')})`);
  assert.deepEqual(bad, [], '★판정 표가 정본과 안 맞는다 — 정본에 줄이 늘었으면 그 줄의 판정(근거 자리 포함)을 CAPTURE_VERDICT 에 적어라:\n  ' + bad.join('\n  '));
});

test(`R1 ★★${NAME} — 'yes' 판정 정본 선택자가 ★세 길 «모두»에서 막히나 (안 막히는 칸 = 0)`, (t) => {
  const { rows, gaps, unmeasured } = judge(CANON.all, P, CAPTURE_VERDICT);
  t.diagnostic('\n' + table(rows));
  const byPath = Object.fromEntries(PATHS.map(p => [p, gaps.filter(g => g.endsWith('∌ ' + p)).map(g => g.split(' ∌ ')[0])]));
  assert.deepEqual(gaps, [],
    `★${NAME} — 편집 노드 정본(저장 쪽 두 출처의 합 · ${CANON.all.length}종) 중 「캡처에서도 지워야 함(yes)」인데 ` +
    `★안 지우는 칸이 ${gaps.length} 개다. ★까닭 = 세 길의 지우기 명부가 ★정본에서 파생되지 않고 ★손으로 따로 있다:\n` +
    PATHS.map(p => `  ${p.padEnd(7)} (${SRC_OF[p]}) 안 막힘 ${byPath[p].length}: ${byPath[p].join(' ')}`).join('\n') +
    `\n  (판정 미정 unmeasured ${unmeasured.length}: ${unmeasured.join(' ')} — 이 수는 빨강에 안 든다)` +
    `\n  ⇒ 이 노드들은 «고른 채» 내보내면 그 길의 산출물에 ★남는다(그려지는지는 CSS·display 에 달렸다 — S3 가 잰다).` +
    `\n  ⛔토큰 한 줄 더하기로 끄지 마라(다음 줄이 또 온다) · 처방 = 그 길이 ★정본에서 파생 (제품 고침 = 지디 판정 칸)`);
});

test('R2 ★예외 다섯 — 이름 · 까닭 · 날짜가 다 있다 (+ 캡처가 «남아야 할» 것을 지우나 — 사실만)', (t) => {
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
  assert.equal(CAPTURE_VERDICT['.annotation-block'].v, 'no', '★.annotation-block 이 「아니오」의 첫 보기가 아니다(지디 판정 ⑴)');
  /* 사실만 찍는다(단언 아님 — 제품 고침은 지디 칸 · 지디 판정 ⑵ 「그대로」) */
  const inter = EDITOR_NODE_EXCEPTIONS.filter(e => CANON.all.includes(e.sel)).map(e => e.sel);
  const staysButRemoved = EDITOR_NODE_EXCEPTIONS.filter(e => e.effect === 'stays' && P.capture.includes(e.sel)).map(e => e.sel);
  t.diagnostic(`예외 ∩ 정본 = ${inter.length} [${inter.join(' ')}] · ★캡처가 «남아야 할» 것을 지금 지운다 = ${staysButRemoved.length} [${staysButRemoved.join(' ')}]`);
});

test('R3 ★넓힌 몫 — serialize ∖ NON_CONTENT 가 정본에 들었고, 위험 3종이 그 안에서 R1 의 빨강 칸이다', (t) => {
  const srOnly = CANON.by[SR].filter(s => !CANON.by[NC].includes(s));
  assert.ok(srOnly.length > 0, '★넓힌 몫이 0 이다 — 판정 ⑴ 이 효과가 없다(판을 먼저 의심하라)');
  assert.ok(srOnly.every(s => CANON.all.includes(s)));
  const { gaps } = judge(CANON.all, P, CAPTURE_VERDICT);
  for (const s of ['.hlb-handle', '.sticker-corner-handle', '.gradient-corner-handle']) {
    assert.ok(srOnly.includes(s), `★${s} 가 serialize 몫이 아니다 — 해석을 다시 적어라`);
    assert.equal(CAPTURE_VERDICT[s].v, 'yes');
    assert.ok(gaps.includes(`${s} ∌ capture`), `★${s} 가 캡처에서 이제 막힌다 — R1 해석이 바뀌었다`);
  }
  t.diagnostic(`넓힌 몫 ${srOnly.length} 중 캡처 안 막힘 ${srOnly.filter(s => gaps.includes(s + ' ∌ capture')).length}`);
});

test('R4 ★★쌍 — 정본에 ★한 줄 늘리면 ★빨강 (판정 없음 · 판정 yes 면 그 이름으로 세 길)', () => {
  const probe = '.zz-probe-handle';
  assert.ok(!CANON.all.includes(probe));
  assert.deepEqual(verdictProblems([...CANON.all, probe], CAPTURE_VERDICT).filter(x => x.startsWith(probe)), [`${probe} — 「캡처에서도 지워야 하나」 판정 없음`]);
  const V = { ...CAPTURE_VERDICT, [probe]: { v: 'yes', why: '지어낸 손잡이 — 쌍 검사용' } };
  assert.deepEqual(judge([...CANON.all, probe], P, V).gaps.filter(g => g.startsWith(probe + ' ')), [`${probe} ∌ capture`, `${probe} ∌ html`, `${probe} ∌ save`]);
  /* 반대쪽 — 세 길이 다 지우면 빨강이 아니다(자가 «무조건 빨강»이 아니다) · 'no'·'unmeasured' 는 빨강 칸이 아니다 */
  const P2 = { capture: [...P.capture, probe], html: [...P.html, probe], save: [...P.save, probe] };
  assert.deepEqual(judge([...CANON.all, probe], P2, V).gaps.filter(g => g.startsWith(probe + ' ')), []);
  for (const v of ['no', 'unmeasured']) {
    assert.deepEqual(judge([...CANON.all, probe], P, { ...CAPTURE_VERDICT, [probe]: { v, why: '지어낸 판정' } }).gaps.filter(g => g.startsWith(probe + ' ')), []);
  }
});

test('R5 ★음성대조 — 세 길이 다 지우는 정본 선택자는 빨강 칸이 아니다(지금 판에 실재하는 것으로)', (t) => {
  const { rows } = judge(CANON.all, P, CAPTURE_VERDICT);
  const allBlocked = rows.filter(r => PATHS.every(p => r[p] === '막힘')).map(r => r.sel);
  t.diagnostic(`세 길 다 막힘 = ${allBlocked.length}: ${allBlocked.join(' ')}`);
  assert.ok(allBlocked.length > 0, '★세 길 다 막힌 선택자가 0 이다 — 자가 «무조건 빨강»인지 의심하라');
});
