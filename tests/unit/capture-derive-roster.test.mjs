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
 *   ⇒ ★2026-10-22 지디 판정(머지 조건): R1 은 node:test `todo` 로 단다 — 단언은 그대로 돌고, 지면 «todo» 로 찍히고 rc 를 안 깬다.
 *     ★안 막히는 칸 수는 todo 메시지와 단언 메시지 둘 다에 찍는다(R1_GAPS). 제품이 고쳐져 0 이 되면 todo 를 떼라(닫는 이 = 지디).
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
const CANON0 = editorNodeCanon(ROOT);   /* ★RESOLVE 가 쓰므로 ★paths() 보다 ★먼저 선다 */
const NAME = 'CAPTURE-ROSTER-NOT-DERIVED-FROM-SAVE-01';
const NC = 'js/io/editor-ui-roster.js#NON_CONTENT_UI_SELECTOR';   /* ★261023 — save-load.js 에서 ★잎 모듈로 옮겼다(R1 처방) */
const SR = 'js/io/section-serialize.js#serializeCleanRoot';

const codeOf = (rel) => { const s = makeStripper(); return readSrc(ROOT, rel).split('\n').map(l => s(l)).join('\n'); };
/* ★★★261023 R1 처방 — ★길이 ★«공용 명부 상수»를 ★부르면 ★그 종들로 ★푼다.
   ⛔안 풀면 ★파서가 ★`$NON_CONTENT_UI_SELECTOR` ★한 줄로 찍고, ★정본 선택자와 ★안 맞아
     ★★«제품이 ★고쳐졌는데도 ★칸이 ★안 닫히는» ★거짓 빨강이 된다.
   ★출처는 ★★CANON 과 ★같은 자리다(EDITOR_NODE_CANON_SRC) — ⛔둘째 명부를 만들지 않는다.
   ★이 resolve 가 ★죽으면 ★R7 이 ★잡는다(아래). */
const RESOLVE = (name) => {
  const hit = Object.keys(CANON0.by).find(k => k.endsWith('#' + name));
  return hit ? CANON0.by[hit] : null;
};
const sels = (file, fn) => {
  const body = fnBody(codeOf(file), fn);
  assert.ok(body, `★${file} 에 ${fn} 이 없다 — 길이 사라졌다`);
  const r = removedSelectors(body, RESOLVE);
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

/* ★갈래 — 발주 261022(R1 레인): 목표는 ★「16 → 0」이고 ★47 이 아니다. 갈래를 ★수로 찍어 목표가 ★3배로 보이는 것을 멈춘다.
 *
 * ★★★⛔261023 — ★이 자리가 ★★두 번 ★틀렸다. ★둘 다 ★★★«수»가 아니라 ★★«자»의 흠이었다.
 *   ⒤ ★★자가 ★이름 꼴이었다 — `/-rotate-zone$/ → S3 · /-handle$/ → S3 · 나머지 → R1`.
 *      ⇒ ★★★「R1 몫 ★0 · S3 몫 ★31」을 찍었고 ★★내가 그걸 「R1 은 ★닫혔다」로 읽어 ★올렸다. ★★★거짓이다.
 *      ⇒ ★까닭 : ★★«누구 몫인가»는 ★★★«이름 꼴»이 아니라 ★★«S3 레인이 ★실제로 ★무엇을 ★맡았나»가 정한다.
 *        ★이 파일 머리말이 적은 ★까닭도 ★「.selected 매인 display 로 숨는다」지 ★「-handle 로 끝난다」가 아니다.
 *   ⅱ) ★그 뒤 ★★★★★★★내가 ★손으로 ★뺐다 — `31 − 3 − 1 = ★27` 을 ★「R1 몫」이라 ★올렸다.
 *      ⇒ ★★★★★단위가 ★섞였다 : ★31 은 ★★«칸»(선택자 × 길) 이고 ★3·1 은 ★★«선택자» 다.
 *      ⇒ ★참값 : ★칸으로 ★22 · ★선택자로 ★13. ★★27 은 ★★어느 단위로도 ★참이 ★아니다.
 *      ⇒ ★이름 ★`BORROWED-NUMBER-SUBTRACTED-ACROSS-UNITS-01`.
 *   ★★⇒ ★그래서 ★아래를 ★둘 다 ★바꾼다 : ⒜ ★자를 ★★«명시 명부»로 · ⒝ ★줄이 ★★«두 단위»를 ★같이 찍게.
 *
 * ★★★정의(★출처 = ★태양이 ★S3 레인 ★실물 명부에서 ★읽어 준 것 · `S3-K1IMG.md` :877-879 · 261023):
 *   S3 몫 = 「★고를 때 js 가 ★블럭 ★«안»에 덧붙이는 손잡이가, ★고른 채 내보내면 ★산출물에 박히나」
 *           = ★증상 이름 `EXPORT-SELECTED-HANDLE-BAKED-IN-01` — ★선택자 ★셋뿐이다.
 *   S7 몫 = `.annot-handle` (어노테이션 레인).
 *   ★미확정 = `.shape-handle` — ★어느 레인도 ★안 집었다. ⛔「R1」로도 「S3」로도 ★넘기지 마라.
 *   R1 몫 = ★그 밖 ★전부.
 * ⛔이 명부를 ★손으로 늘리지 마라 — ★늘릴 일이 생기면 ★그 레인에 ★물어서 ★출처를 ★같이 적어라. */
const LANE_ROSTER = {
  /* ★출처 = 태양 261023 · S3-K1IMG.md :877-879 (S3 레인이 ★제 명부에서 읽어 줬다) */
  S3: ['.hlb-handle', '.sticker-corner-handle', '.gradient-corner-handle'],
  /* ★출처 = 같은 전언 — 「.annot-handle 은 S7 몫」 */
  S7: ['.annot-handle'],
  /* ★★어느 레인도 ★안 집었다(태양: 「.shape-handle 하나만 ★미확정」) — ★★«안 쟀다»를 ★수로 ★남긴다 */
  '미확정': ['.shape-handle'],
};
const LANE_OF = (sel) => Object.keys(LANE_ROSTER).find(k => LANE_ROSTER[k].includes(sel)) || 'R1';
const LANES = ['R1', 'S3', 'S7', '미확정'];
/** ★★두 단위를 ★같이 센다 — ★칸(선택자 × 길)과 ★선택자. ⛔한쪽만 찍으면 ★또 섞인다. */
const laneCounts = (gaps) => {
  const selOf = (g) => g.split(' ∌ ')[0];
  const uniq = [...new Set(gaps.map(selOf))];
  const out = { 칸합: gaps.length, 선택자합: uniq.length };
  for (const l of LANES) { out[l] = { 칸: gaps.filter(g => LANE_OF(selOf(g)) === l).length, 선택자: uniq.filter(s => LANE_OF(s) === l).length }; }
  return out;
};
const laneLine = (gaps) => { const c = laneCounts(gaps);
  return LANES.map(l => `★${l} 칸 ${c[l].칸}/선택자 ${c[l].선택자}`).join(' · ') + ` (합 ${c.칸합}/${c.선택자합})`; };

const P = paths();
const CANON = CANON0;

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

/** ★R1 의 todo 메시지에 ★수를 박으려고 판정을 모듈 머리에서 한 번 낸다(같은 judge · 같은 입력). */
const R1_GAPS = judge(CANON.all, P, CAPTURE_VERDICT).gaps;
const R1_TODO = `${NAME} — 안 막히는 칸 ${R1_GAPS.length} — ${laneLine(R1_GAPS)} ` +
  `(${PATHS.map(p => `${p} ${R1_GAPS.filter(g => g.endsWith('∌ ' + p)).length}`).join(' · ')}) — ` +
  `닫는 이 = 지디 판정(제품: 캡처 겹·export-html 지우기 명부를 저장 정본에서 파생) · 0 이 되면 todo 를 뗀다`;

test(`R1 ★★${NAME} — ★★R1 레인 몫이 ★0 인가 (261023 고침을 ★잠그는 자 · ⛔todo 아니다)`, (t) => {
  const { rows, gaps, unmeasured } = judge(CANON.all, P, CAPTURE_VERDICT);
  /* ★★★261023 — ★이 칸은 ★★«초록»이다. ★★그게 ★목적이다.
     ★전에는 ★이 파일 전체가 ★`todo` 였다(「31 칸이 안 막힌다」). ★★todo 는 ★rc 를 ★안 깬다 —
     ★그러니 ★제품을 ★고쳐 ★0 이 돼도, ★누가 ★되돌려도, ★★★아무 소리도 ★안 난다.
     ⇒ ★그래서 ★★«내 레인 몫»만 ★떼어 ★★단언으로 걸었다. ★★나머지(S3·미확정)는 ★아래 S3-GAPS 가 ★todo 로 든다.
     ★고침 = `js/io/capture-safety.js` stripEditorOnlyForCapture 가 ★`NON_CONTENT_UI_SELECTOR` 를 ★읽는다.
     ⛔그 줄을 지우면 ★여기가 ★★빨강이다(무력화 대조로 쟀다 · 261023). */
  const c = laneCounts(gaps);
  assert.equal(c.R1.칸, 0,
    `★★${NAME} — ★R1 레인 몫이 ★${c.R1.칸} 칸 남았다(선택자 ${c.R1.선택자}). ` +
    `★★처방은 ★«캡처 명부에 줄 더하기»가 ★아니라 ★«캡처가 저장 정본을 ★읽게 하기»다 — ` +
    `js/io/capture-safety.js stripEditorOnlyForCapture 의 NON_CONTENT_UI_SELECTOR 줄을 보라.\n  ` +
    gaps.filter(g => LANE_OF(g.split(' ∌ ')[0]) === 'R1').join('\n  '));
  t.diagnostic(laneLine(gaps));
});

test(`S3-GAPS ★${NAME} — 'yes' 판정 정본 선택자가 ★세 길 «모두»에서 막히나 (안 막히는 칸 = 0)`, { todo: R1_TODO }, (t) => {
  const { rows, gaps, unmeasured } = judge(CANON.all, P, CAPTURE_VERDICT);
  t.diagnostic('\n' + table(rows));
  const byPath = Object.fromEntries(PATHS.map(p => [p, gaps.filter(g => g.endsWith('∌ ' + p)).map(g => g.split(' ∌ ')[0])]));
  assert.deepEqual(gaps, [],
    `★${NAME} — 편집 노드 정본(저장 쪽 두 출처의 합 · ${CANON.all.length}종) 중 「캡처에서도 지워야 함(yes)」인데 ` +
    `★안 지우는 칸이 ${gaps.length} 개다. (${laneLine(gaps)} — ★R1 레인의 목표는 R1 몫 0 이다) ★까닭 = 세 길의 지우기 명부가 ★정본에서 파생되지 않고 ★손으로 따로 있다:\n` +
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
  const inter = EDITOR_NODE_EXCEPTIONS.filter(e => CANON.all.includes(e.sel)).map(e => e.sel);
  const staysButRemoved = EDITOR_NODE_EXCEPTIONS.filter(e => e.effect === 'stays' && P.capture.includes(e.sel)).map(e => e.sel);
  t.diagnostic(`예외 ∩ 정본 = ${inter.length} [${inter.join(' ')}] · ★캡처가 «남아야 할» 것을 지금 지운다 = ${staysButRemoved.length} [${staysButRemoved.join(' ')}]`);
  /* ★★★2026-10-24 — ★«사실만 찍는다»를 ★★단언으로 ★바꿨다.
       ★옛 주석 : 「단언 아님 — ★제품 고침은 ★지디 칸 · ★지디 판정 ⑵ 「그대로」」
       ⇒ ★★그 까닭이 ★★죽었다 : ★현빈 ★GO 로 ★`capture-safety.js` 의 ★한 줄을 ★고쳐
         ★`.annotation-block` 을 ★캡처 지우기에서 ★★뺐다(261024 · `DEV-ANNOT-STRIPPED-WHOLE-IN-CAPTURE-01`).
       ★★★그런데 ★그 고침을 ★★재는 자가 ★★★0 이었다 — ★변이로 ★확인했다:
         ★고침을 ★되돌려도 ★capture-derive-roster · capture-drop-axis · buzz-profile-chrome ·
         ★pan-native-scroll ★★넷이 ★전부 ★초록이고, ★★단위 ★전수도 ★★수가 ★한 자도 ★안 ★바뀌었다
         (★4738/4735/fail 0 — ★고침 ★전과 ★★동일).
       ⇒ ★★★이름 : `ANNOT-STAYS-IN-CAPTURE-HAD-NO-GATE-01` — ★★이 단언이 ★그 자다.
       ★★자가 ★사는지 : ★그 한 줄을 ★되돌리면 ★★`.annotation-block` 이 ★`P.capture` 에 ★들어와
         ★★staysButRemoved = 1 ⇒ ★★★빨강. (★★★변이로 ★확인한다 — ⛔«항상 참»인 단언이 ★아니다)
       ⛔둘째 명부를 ★만들지 ★않는다 — ★`EDITOR_NODE_EXCEPTIONS`(effect:'stays')에서 ★★파생한다. */
  assert.deepEqual(staysButRemoved, [],
    '★★★캡처가 ★«남아야 할» 것을 ★지운다 — ★ANNOT-STAYS-IN-CAPTURE-HAD-NO-GATE-01 ★그 자리다:\n  ' +
    staysButRemoved.map(s2 => `${s2} (예외 effect:'stays' 인데 stripEditorOnlyForCapture 가 지운다)`).join('\n  ') +
    `\n  ⇒ ★현빈 ★261022 ★결정 ⒝(「어노테이션·치수선은 ★최종 이미지에 ★보인다」)가 ★깨진다.`);
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

/* ══════════════════════════════════════════════════════════════════════
   R6 — ★★★«레인 자»를 ★재는 자. ★261023 신설.
   ★까닭 : ★이 파일의 ★레인 줄이 ★★두 번 ★거짓을 찍었다(위 LANE_ROSTER 머리말 ⒤ⅱ).
     ★둘 다 ★★★«사람이 읽고 ★넘어가는 ★진단 줄»이라 ★아무 검사도 ★안 걸려 있었다.
     ⇒ ★★★「규칙은 ★재는 자가 ★있어야 ★집행된다」 — ★그 자가 ★이 칸이다.
   ★★이 칸이 ★막는 것 ★셋:
     ⒜ ★자가 ★죽는 것   — ★★양성 `.hlb-handle` → S3 · `.annot-handle` → S7 · `.shape-handle` → 미확정
     ⒝ ★자가 ★전부 먹는 것 — ★★음성 `.img-rotate-zone` → ★R1 (★★옛 이름 꼴 자는 ★이걸 S3 로 ★먹었다)
     ⒞ ★★단위가 ★섞이는 것 — ★★★칸합·선택자합이 ★레인별 합과 ★같나 (★★`27` 사고의 ★그 자리)
   ⛔이 칸을 ★「명부가 맞나」로 ★읽지 마라 — ★명부의 ★참값은 ★★S3·S7 레인이 ★가졌고 ★여기선 ★못 잰다.
     ★여기서 재는 것은 ★★«내가 받아 적은 명부가 ★자에 ★실제로 ★걸렸나»와 ★«수가 ★안 새나»뿐이다.
   ══════════════════════════════════════════════════════════════════════ */
test('R6 ★★레인 자가 ★살아 있나 — 양성·음성·★단위 (★261023 두 거짓을 막는 자)', (t) => {
  /* ⒜ ★양성 — ★명부가 ★실제로 ★걸린다. ⛔이게 없으면 ★빈 명부도 ★초록이다(전부 R1). */
  assert.equal(LANE_OF('.hlb-handle'), 'S3', '★양성 — 태양이 준 S3 선택자가 S3 로 안 간다(명부가 자에 안 걸렸다)');
  assert.equal(LANE_OF('.sticker-corner-handle'), 'S3');
  assert.equal(LANE_OF('.gradient-corner-handle'), 'S3');
  assert.equal(LANE_OF('.annot-handle'), 'S7', '★양성 — .annot-handle 은 S7 몫이다(태양 261023)');
  assert.equal(LANE_OF('.shape-handle'), '미확정', '★★.shape-handle 은 ★어느 레인도 ★안 집었다 — ⛔R1·S3 로 넘기지 마라');
  /* ⒝ ★★음성 — ★★261023 에 ★★죽었던 바로 그 자리다. ★옛 자(`/-rotate-zone$/`·`/-handle$/`)는 ★이 셋을 ★S3 로 먹어
        「R1 몫 ★0」을 찍었고, ★내가 그것을 ★「닫혔다」로 ★읽어 ★올렸다. */
  for (const s of ['.img-rotate-zone', '.ab-rotate-zone', '.mdl-rotate-zone', '.img-corner-handle', '.img-edge-handle'])
    assert.equal(LANE_OF(s), 'R1', `★★음성 — ${s} 가 R1 이 아니다. ★이름 꼴로 가르는 자가 되살아났다(261023 사고)`);
  /* ⒞ ★★★단위 — ★칸합·선택자합이 ★레인별 합과 ★같나. ★★`31 − 3 − 1 = 27` 이 ★여기서 잡힌다. */
  const c = laneCounts(R1_GAPS);
  assert.equal(LANES.reduce((a, l) => a + c[l].칸, 0), c.칸합, '★★칸 수가 샌다 — 레인별 칸 합 ≠ 전체 칸');
  assert.equal(LANES.reduce((a, l) => a + c[l].선택자, 0), c.선택자합, '★★선택자 수가 샌다 — 레인별 합 ≠ 전체 선택자');
  assert.notEqual(c.칸합, c.선택자합,
    '★★칸 수와 선택자 수가 ★같다 — ★그러면 이 칸이 ★단위 섞임을 ★못 잡는다(길이 하나뿐인 판). ★자를 다시 보라');
  /* ⒟ ★★자가 ★«명부 밖»을 ★R1 로 ★흘려 보낸다 — ★그 성질 자체를 ★못박는다(새 줄이 조용히 S3 로 숨지 않게) */
  assert.equal(LANE_OF('.zz-never-seen-handle'), 'R1', '★명부에 없는 새 줄은 ★R1 로 찍혀 ★드러나야 한다');
  t.diagnostic(`레인 = ${laneLine(R1_GAPS)}`);
  t.diagnostic(`명부 출처 = 태양 261023 · S3-K1IMG.md:877-879 — S3 ${LANE_ROSTER.S3.length} · S7 ${LANE_ROSTER.S7.length} · 미확정 ${LANE_ROSTER['미확정'].length}`);
});

/* ══════════════════════════════════════════════════════════════════════
   R7 — ★★★«식별자 풀기»를 ★재는 자. ★261023 신설(R1 처방과 ★한 쌍).
   ★까닭 : ★R1 처방은 ★★두 쪽이다 —
     ⒜ ★제품 : 캡처 겹이 `NON_CONTENT_UI_SELECTOR` 를 ★읽는다
     ⒝ ★자   : 파서가 ★그 ★식별자를 ★그 종들로 ★푼다(RESOLVE)
   ★★⛔⒝ 가 ★조용히 ★죽으면 ★어떻게 되나 : 파서가 ★`$NON_CONTENT_UI_SELECTOR` ★한 줄로 찍고
     ★정본 선택자와 ★안 맞아 ★★«제품은 고쳐졌는데 ★칸은 ★안 닫히는» ★거짓 빨강이 된다.
     ⇒ ★그러면 ★다음 사람이 ★★제품에 ★줄을 ★베껴 넣어 ★끄려 한다 — ★★바로 ★R1 이 ★막으려던 ★그 길이다.
   ★★⛔반대로 ⒝ 만 ★살고 ⒜ 가 ★죽으면 : R1 이 ★빨강(22 칸) — ★그건 ★R1 이 ★잡는다.
   ⇒ ★이 칸은 ★★⒝ 쪽을 ★잡는다.
   ══════════════════════════════════════════════════════════════════════ */
test('R7 ★★식별자 풀기(RESOLVE)가 ★살아 있나 — 양성·음성 · ★캡처 길이 ★정말 그 종들을 품나', (t) => {
  /* ⒜ ★양성 — 이름을 주면 ★그 종들이 온다 */
  const got = RESOLVE('NON_CONTENT_UI_SELECTOR');
  assert.ok(Array.isArray(got) && got.length >= 20,
    `★RESOLVE 가 ★죽었다 — NON_CONTENT_UI_SELECTOR 가 ${got ? got.length : 'null'} 종이다(정본 출처에서 ${CANON.by[NC].length} 종을 읽었는데)`);
  assert.deepEqual(got, CANON.by[NC], '★RESOLVE 가 ★정본과 ★다른 것을 준다 — ★둘째 명부가 생겼다');
  /* ⒝ ★음성 — 모르는 이름엔 ★null (⛔아무거나 주면 ★전부 초록이 된다) */
  assert.equal(RESOLVE('ZZ_NOT_A_ROSTER'), null, '★RESOLVE 가 ★모르는 이름에도 ★무언가를 준다');
  /* ⒞ ★★그래서 ★캡처 길이 ★정말 ★그 종들을 ★품나 — ★이게 ★R1 고침의 ★실물이다 */
  const miss = CANON.by[NC].filter(s2 => !P.capture.includes(s2));
  assert.deepEqual(miss, [],
    `★캡처 겹이 ★정본 상수의 ${miss.length} 종을 ★안 품는다 — stripEditorOnlyForCapture 의 NON_CONTENT_UI_SELECTOR 줄이 ★사라졌나:\n  ${miss.join(' ')}`);
  /* ⒟ ★★«안 풀린 꼴»이 ★남아 있지 ★않나 — ⛔`$이름` 이 길 명부에 ★있으면 ★그 종들은 ★이 표에서 ★안 세어진다.
     ★★⛔261023 — ★이 단언을 ★처음엔 ★「하나도 없어야 한다」로 걸었다가 ★★빨강이 났다.
       ★잡힌 것 : `$HIDDEN_VARIATION_SECTION_SEL` (js/io/export-html.js:105 · 숨긴 A/B 시안 섹션)
       ★★그건 ★★정본 상수가 ★아니다 — ★다른 모듈(js/variation-visibility.js:28)의 ★제 상수고,
         ★드롭 축(D3)이 ★이미 ★`$` 꼴로 ★승인하고 ★있다.
       ⇒ ★★★그러니 ★틀린 쪽은 ★★내 단언이었다. ★★그런데 ★«느슨하게» 풀지 ★않는다 —
         ★★예외를 ★★이름으로 ★둔다. ★★그래야 ★★«새로 생긴 둘째 상수»가 ★여기서 ★드러난다.
       ★★⇒ ★이 명부에 ★없는 ★새 식별자가 나오면 ★이 칸이 ★빨개진다 = ★그게 ★이 칸의 ★일이다. */
  const RESOLVE_EXEMPT = {
    '$HIDDEN_VARIATION_SECTION_SEL':
      '★숨긴 A/B 시안 섹션(js/variation-visibility.js:28 = `.section-block` ＋ 숨김 절) — ★정본 상수가 ★아니고 ' +
      '★드롭 축 승인 명부(DROP_STRIP_ROSTER html 칸)가 ★`$` 꼴로 ★이미 든다. ★★이 표의 분모(편집 노드)가 ★아니다(★섹션째 숨긴 것).',
  };
  for (const pth of PATHS) {
    const raw = P[pth].filter(s2 => s2.startsWith('$'));
    const unknown = raw.filter(s2 => !RESOLVE_EXEMPT[s2]);
    assert.deepEqual(unknown, [],
      `★${pth} 길에 ★모르는 식별자가 있다: ${unknown.join(' ')} — ★그 종들은 ★이 표에서 ★안 세어진다.\n` +
      `  ⇒ ★정본 상수면 ★EDITOR_NODE_CANON_SRC 에 ★출처로 올려라(그러면 RESOLVE 가 ★푼다) · ` +
      `★아니면 ★이 칸의 ★RESOLVE_EXEMPT 에 ★왜를 적어라(⛔이름만 적지 마라)`);
    /* ★★그리고 ★★정본 상수는 ★★절대 ★안 풀린 꼴로 ★남아선 안 된다 — ★그게 ★R1 처방의 ★핵이다 */
    assert.ok(!raw.includes('$NON_CONTENT_UI_SELECTOR'),
      `★${pth} 길에 ★정본 상수가 ★안 풀린 채 ★남았다 — ★RESOLVE 가 ★그 이름을 ★못 찾는다(★출처 경로가 바뀌었나)`);
  }
  t.diagnostic(`RESOLVE = ${CANON.by[NC].length}종 · 캡처 길 ${P.capture.length}종 · html ${P.html.length}종 · save ${P.save.length}종`);
});
