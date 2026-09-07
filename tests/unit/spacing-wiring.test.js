/* spacing-wiring.test.js — 갭 «감수 패스»의 배선. (2026-09-07 신설)
 *
 * ★이 파일이 재는 것은 «규격»이 아니라 «배선»이다(규격은 spacing-spec.test.mjs).
 *   ⛔「돌아는 가는데 효과가 0」을 막으려고 **양끝을 따로** 잰다:
 *     앞끝 = 「감수가 불렸다」(렌더러 원장에 applySpacingOps 가 찍혔나)
 *     뒤끝 = 「갭이 실제로 그 값이 됐다」(가짜 렌더러가 시퀀스를 «진짜로 들고» 적용한 뒤 다시 읽는다)
 *   앞끝만 초록인 상태를 빨강으로 만드는 검사를 «따로» 둔다(Ⓒ).
 *
 * ★배선 자리 판정의 근거도 여기서 기계로 지킨다(Ⓓ):
 *   tools/call 은 _SWITCH_EXEMPT / _serializeCall «두 갈래»로 갈리는데 둘 다 _noteSeq 를 지난다.
 *   훅을 갈래 «한쪽»에 옮겨 놓으면 다른 쪽이 조용히 샌다 — 소스 문자열로 그 이동을 막는다.
 */
'use strict';
/* ⛔env 는 mcp-server.js 를 require 하기 «전에» 박아야 한다(모듈 로드 시 한 번 읽는다). */
process.env.GODITOR_SPACING_DEBOUNCE_MS = process.env.GODITOR_SPACING_DEBOUNCE_MS || '40';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { startHarness } = require('./_mcp-harness');

const REPO = path.join(__dirname, '..', '..');
const SPACING = require(path.join(REPO, 'main', 'claude-pm', 'services', 'spacing.js'));
const DEBOUNCE = Number(process.env.GODITOR_SPACING_DEBOUNCE_MS);

/* ── 가짜 렌더러: «상태를 진짜로 든다» ────────────────────────────────────
 * ⛔{ok:true} 만 돌려주는 스텁이면 뒤끝(값이 그 값이 됐나)을 잴 수 없다.
 *   그래서 시퀀스를 들고 ops 를 실제로 적용한다. 적용 규칙은 js/spacing-normalize.js 와
 *   같은 규약(remove → set → insert)을 «손으로» 다시 적는다 — 규격 모듈의 헬퍼를 쓰면
 *   「자기가 만든 계획을 자기가 적용해 자기를 검증」하는 고리가 된다. */
function makeCanvas(sections) {
  const state = JSON.parse(JSON.stringify(sections));
  let n = 0;
  return {
    state,
    read: async ({ sectionId } = {}) => {
      const list = sectionId ? state.filter((s) => s.sectionId === sectionId) : state;
      if (sectionId && !list.length) return { ok: false, code: 'NOT_FOUND', message: 'section not found: ' + sectionId };
      return { ok: true, sections: JSON.parse(JSON.stringify(list)) };
    },
    apply: async (plan) => {
      let inserted = 0, removed = 0, resized = 0;
      for (const s of (plan && plan.sections) || []) {
        const sec = state.find((x) => x.sectionId === s.sectionId);
        if (!sec) continue;
        for (const o of s.ops.filter((o) => o.op === 'remove')) {
          const i = sec.items.findIndex((it) => it.id === o.id);
          if (i >= 0) { sec.items.splice(i, 1); removed++; }
        }
        for (const o of s.ops.filter((o) => o.op === 'set')) {
          const it = sec.items.find((x) => x.id === o.id);
          if (it) { it.height = o.height; it.auto = true; resized++; }
        }
        for (const o of s.ops.filter((o) => o.op === 'insert')) {
          const gap = { id: 'gb_fake' + (++n), kind: 'gap', height: o.height, auto: true };
          if (o.afterId == null) sec.items.unshift(gap);
          else {
            const i = sec.items.findIndex((x) => x.id === o.afterId);
            if (i < 0) sec.items.push(gap); else sec.items.splice(i + 1, 0, gap);
          }
          inserted++;
        }
      }
      return { ok: true, inserted, removed, resized, applied: inserted + removed + resized };
    },
  };
}

/** 오늘 실측한 그 5섹션 모양 — 섹션 상하 100 만 있고 «블록 사이 갭은 0개». */
const FIVE = () => ([
  { sectionId: 'sec_1', name: 'Section 01', items: [g('g1a'), b('lg_1', 'label'), b('t_1', 'heading'), b('t_2', 'body'), g('g1z')] },
  { sectionId: 'sec_2', name: 'Section 02', items: [g('g2a'), b('t_3', 'heading'), b('cvb_1', 'canvas'), g('g2z')] },
  { sectionId: 'sec_3', name: 'Section 03', items: [g('g3a'), b('t_4', 'heading'), b('tbl_1', 'table'), g('g3z')] },
  { sectionId: 'sec_4', name: 'Section 04', items: [g('g4a'), b('stb_1', 'step'), b('tbl_2', 'table'), g('g4z')] },
  { sectionId: 'sec_5', name: 'Section 05', items: [g('g5a'), b('t_5', 'heading'), b('t_6', 'body'), g('g5z')] },
]);
const g = (id, h = 100, auto = true) => ({ id, kind: 'gap', height: h, auto });
const b = (id, type) => ({ id, kind: 'block', type });
const shape = (sec) => sec.items.map((i) => (i.kind === 'gap' ? 'gap' + i.height : i.type)).join(' · ');

let H = null, CANVAS = null;
before(async () => {
  CANVAS = makeCanvas(FIVE());
  H = await startHarness({
    activeProject: 'proj_1',
    canned: { readSpacingSequence: (a) => CANVAS.read(a || {}), applySpacingOps: (p) => CANVAS.apply(p) },
  });
});
after(async () => { if (H) await H.stop(); });

/* ★«감수가 돌았다»의 표식은 readSpacingSequence 다 — applySpacingOps 가 «아니다».
   할 일이 0이면 감수는 돌고도 적용을 «안» 부른다(그게 설계다). 그걸 「안 돌았다」로 읽으면
   멱등 설계가 배선 결함으로 오진된다 — 실제로 이 검사가 처음에 그렇게 틀렸다(09-07). */
const auditCount = (sinceIdx) => H.calls.slice(sinceIdx).filter((c) => c.method === 'readSpacingSequence').length;
const applyCount = (sinceIdx) => H.calls.slice(sinceIdx).filter((c) => c.method === 'applySpacingOps').length;

/** 예약된 감수가 «돌 때까지» 기다린다. ⛔고정 sleep 이 아니라 «산출물»(호출 기록)을 기다린다. */
async function waitForAudit(sinceIdx, ms = 3000) {
  const t0 = Date.now();
  for (;;) {
    const hit = H.calls.slice(sinceIdx).find((c) => c.method === 'readSpacingSequence');
    if (hit) return hit;
    if (Date.now() - t0 > ms) return null;
    await new Promise((r) => setTimeout(r, 10));
  }
}

// ── Ⓐ 앞끝 — 「감수가 불렸다」 ──────────────────────────────────────────
test('Ⓐ 편집 도구가 성공하면 감수가 «예약되고 돈다» (클로드가 안 불러도)', async () => {
  const at = H.calls.length;
  const r = await H.call('add_block', { type: 'text', props: { type: 'body', content: '가나다', sectionId: 'sec_1' } });
  assert.equal(r.result && r.result.ok !== false, true, `add_block 이 실패했다: ${JSON.stringify(r.result || r.error)}`);
  const hit = await waitForAudit(at);
  assert.ok(hit, '★감수가 «한 번도» 안 돌았다 — 배선이 죽었다(_noteSeq 의 _scheduleSpacingAudit 을 보라)');
  /* 이 픽스처는 블록 사이 갭이 0개라 «고칠 게 있다» ⇒ 적용까지 가야 한다.
     ⛔여기서 apply 를 안 세면 「읽기만 하고 아무것도 안 하는」 배선도 초록이 된다. */
  for (let i = 0; i < 100 && applyCount(at) === 0; i++) await new Promise((r) => setTimeout(r, 10));
  assert.ok(applyCount(at) >= 1, '★읽기만 하고 «적용»은 안 했다 — 돌아는 가는데 효과가 0인 그 상태다');
});

test('Ⓐ-b ⛔읽기 전용 도구는 감수를 «안» 부른다 (묶음을 헛돌리지 않는다)', async () => {
  await new Promise((r) => setTimeout(r, DEBOUNCE * 4));   // 앞 예약을 흘려보낸다
  const at = H.calls.length;
  await H.call('get_canvas_state', {});
  await new Promise((r) => setTimeout(r, DEBOUNCE * 6));
  assert.equal(auditCount(at), 0, 'get_canvas_state 는 캔버스를 안 바꾼다 — 감수를 부를 이유가 없다');
});

test('Ⓐ-c ★묶음 — 연달아 3번 편집해도 감수는 «한 번»만 돈다', async () => {
  await new Promise((r) => setTimeout(r, DEBOUNCE * 4));
  const at = H.calls.length;
  await H.call('add_block', { type: 'text', props: { type: 'body', content: 'a', sectionId: 'sec_5' } });
  await H.call('add_block', { type: 'text', props: { type: 'body', content: 'b', sectionId: 'sec_5' } });
  await H.call('add_block', { type: 'text', props: { type: 'body', content: 'c', sectionId: 'sec_5' } });
  await waitForAudit(at);
  await new Promise((r) => setTimeout(r, DEBOUNCE * 6));
  assert.equal(auditCount(at), 1, `묶음당 1회여야 한다. 실제 ${auditCount(at)}회 — 예약이 «재설정»되지 않는다는 뜻이다`);
  assert.equal(applyCount(at), 0, '앞 검사에서 이미 규격에 맞춰졌다 — 할 일 0이면 적용은 «안» 부른다(히스토리 무오염)');
});

test('Ⓐ-d ⛔프로젝트를 «열기만» 해도 감수가 돌면 안 된다 (남의 손맞춤을 열자마자 고쳐 쓴다)', async () => {
  await new Promise((r) => setTimeout(r, DEBOUNCE * 4));
  const at = H.calls.length;
  await H.call('open_project', { projectId: 'proj_1' });
  await new Promise((r) => setTimeout(r, DEBOUNCE * 6));
  assert.equal(auditCount(at), 0,
    '★open_project 가 감수를 불렀다 — 기존 프로젝트를 «열기만» 해도 갭이 고쳐 쓰인다. '
    + '(2026-09-07 실측으로 잡은 결함: 훅을 «도구 이름»이 아니라 «히스토리가 움직였나»로 걸고, '
    + '_SPACING_EXEMPT 로 한 번 더 막는다)');
});

test('Ⓐ-e ★«추가»만이 아니라 삭제·이동도 감수를 부른다 (배선을 add 경로에 두면 고아 갭이 영영 안 치워진다)', async () => {
  /* ★이 검사가 있어야 「배선을 «다른 자리»로 옮긴 변이」가 잡힌다.
     add_* 에만 배선하면 add 검사는 전부 초록인데 delete/move 만 조용히 샌다 — 그게 함정이다.
     그리고 고아 갭은 «삭제 뒤»에 생긴다. 삭제가 감수를 안 부르면 이 기능의 존재 이유가 없다. */
  for (const [tool, args] of [
    ['delete_block', { blockId: 'tb_fx_h1' }],
    ['move_block', { blockId: 'tb_fx_b1', beforeId: 'tb_fx_h1' }],
    ['build_basic_section', { mainCopy: '메인 카피' }],
  ]) {
    await new Promise((r) => setTimeout(r, DEBOUNCE * 4));
    const at = H.calls.length;
    const r = await H.call(tool, args);
    assert.ok(r.result && r.result.ok !== false, `${tool} 이 실패했다: ${JSON.stringify(r.result || r.error)}`);
    const hit = await waitForAudit(at, 2000);
    assert.ok(hit, `★${tool} 뒤에 감수가 «안» 돌았다 — 배선이 「추가 경로」로 옮겨졌다는 뜻이다`);
  }
});

test('Ⓐ-f ★2차 방어를 «혼자» 재라 — 히스토리가 «움직여도» open_project 는 감수를 안 부른다', async () => {
  /* ★왜 Ⓐ-d 로는 부족한가(팀리드 지적): Ⓐ-d 는 1차 방어(히스토리 델타)에 막혀서 통과한다.
     그러면 2차 방어(_SPACING_EXEMPT)는 «있어도 없어도» 초록이라 아무것도 안 지킨다.
     ⇒ 여기서는 1차 방어를 «일부러 뚫는다» — 진짜 앱에서 open_project 는 문서를 통째로 갈아
     끼우므로 히스토리 꼭대기가 움직일 수 있다. 그 상황을 만들어 2차 방어만 남긴다. */
  await new Promise((r) => setTimeout(r, DEBOUNCE * 4));
  let tip = 500;
  const restore = H.setCanned('historyTip', async () => {
    tip += 1;   // 부를 때마다 꼭대기가 «움직인다» = 1차 방어 무력화
    return { ok: true, seq: tip, empty: false, canUndo: true, len: tip, action: 'x' };
  });
  try {
    const at = H.calls.length;
    await H.call('open_project', { projectId: 'proj_1' });
    await new Promise((r) => setTimeout(r, DEBOUNCE * 6));
    assert.equal(auditCount(at), 0,
      '★히스토리가 움직였다는 이유로 open_project 가 감수를 불렀다 — 2차 방어(_SPACING_EXEMPT)가 죽었다. '
      + '기존 프로젝트를 «열기만» 해도 남의 손맞춤 갭이 고쳐 쓰인다.');
    // 대조군: 같은 조건에서 «편집» 도구는 감수를 부른다(=이 검사가 1차 방어를 정말 뚫었다는 증거)
    const at2 = H.calls.length;
    await H.call('add_block', { type: 'text', props: { type: 'body', content: 'z', sectionId: 'sec_1' } });
    assert.ok(await waitForAudit(at2, 2000),
      '대조군이 실패했다 — 1차 방어가 아직 살아 있어서 이 검사가 2차 방어를 «안 재고» 있다');
  } finally { restore(); }
});

// ── Ⓑ 뒤끝 — 「갭이 실제로 그 값이 됐다」 ────────────────────────────────
test('Ⓑ ★뒤끝 — 오늘 그 5섹션의 «블록 사이 갭 0개»가 규격값으로 «실제로» 채워진다', async () => {
  CANVAS = makeCanvas(FIVE());
  H.setCanned('readSpacingSequence', (a) => CANVAS.read(a || {}));
  H.setCanned('applySpacingOps', (p) => CANVAS.apply(p));

  const before = CANVAS.state.map(shape);
  const r = await H.call('normalize_spacing', {});
  assert.equal(r.result && r.result.ok, true, `normalize_spacing 실패: ${JSON.stringify(r.result || r.error)}`);
  const after = CANVAS.state.map(shape);

  console.error('  ┌─ 실제 캔버스 전/후 (가짜 렌더러가 «진짜로» 적용한 결과) ─────────');
  CANVAS.state.forEach((s, i) => {
    console.error(`  │ ${s.name}`);
    console.error(`  │   전 : ${before[i]}`);
    console.error(`  │   후 : ${after[i]}`);
  });
  console.error('  └────────────────────────────────────────────────────────────');

  assert.deepEqual(after, [
    'gap100 · label · gap80 · heading · gap80 · body · gap100',   // 라벨(0)→제목(2)=M · 제목(2)→본문(1)=M
    'gap100 · heading · gap80 · canvas · gap100',                 // 제목→덩어리=M
    'gap100 · heading · gap80 · table · gap100',
    'gap100 · step · gap80 · table · gap100',                     // 덩어리↔덩어리=M
    'gap100 · heading · gap80 · body · gap100',
  ], '규격대로 안 채워졌다');
  assert.ok(before.some((x, i) => x !== after[i]), '★전/후가 «하나도» 안 바뀌었다 = 효과 0');
});

test('Ⓑ-b ★멱등 — 곧바로 한 번 더 돌리면 «아무 일도 안 일어난다»(ops 0 · 히스토리 무오염)', async () => {
  const snapshot = CANVAS.state.map(shape);
  const at = H.calls.length;
  const r = await H.call('normalize_spacing', {});
  assert.equal(r.result.ok, true);
  assert.equal(r.result.changedSections, 0, `2회차에 ${r.result.changedSections}개 섹션이 또 바뀌었다 — 멱등이 깨졌다`);
  assert.equal(H.calls.slice(at).filter((c) => c.method === 'applySpacingOps').length, 0,
    '★할 일이 0인데 applySpacingOps 를 불렀다 — 빈 호출이 히스토리를 더럽힌다');
  assert.deepEqual(CANVAS.state.map(shape), snapshot);
});

test('Ⓑ-c ★수동 갭은 «감수를 거쳐도» 살아남고, 왜 안 건드렸는지 말한다', async () => {
  CANVAS = makeCanvas([{ sectionId: 'sec_9', name: '손맞춤', items: [
    g('g9a'), b('t_9', 'heading'), g('g9m', 37, false), b('t_10', 'body'), g('g9z'),
  ] }]);
  H.setCanned('readSpacingSequence', (a) => CANVAS.read(a || {}));
  H.setCanned('applySpacingOps', (p) => CANVAS.apply(p));
  const r = await H.call('normalize_spacing', {});
  assert.equal(r.result.ok, true);
  assert.equal(shape(CANVAS.state[0]), 'gap100 · heading · gap37 · body · gap100', '37px 이 되돌려졌다 — 도와준 게 아니라 뺏은 것이다');
  assert.ok((r.result.notes || []).some((n) => /g9m/.test(n)), `«안 건드린 이유»를 보고해야 한다: ${JSON.stringify(r.result.notes)}`);
});

test('Ⓑ-d 고아 갭 — 블록을 지운 뒤 감수가 돌면 «저절로» 하나로 합쳐진다', async () => {
  CANVAS = makeCanvas([{ sectionId: 'sec_8', name: '고아', items: [
    g('g8a'), b('t_8', 'heading'), g('g8_1'), g('g8_2'), g('g8z'),
  ] }]);
  H.setCanned('readSpacingSequence', (a) => CANVAS.read(a || {}));
  H.setCanned('applySpacingOps', (p) => CANVAS.apply(p));
  await H.call('normalize_spacing', {});
  assert.equal(shape(CANVAS.state[0]), 'gap100 · heading · gap100');
});

// ── Ⓒ ★앞끝만 초록인 상태를 빨강으로 만든다 ─────────────────────────────
test('Ⓒ ★«불렸다»만으로는 통과 못 한다 — 적용이 거짓말하면 뒤끝이 빨강이어야 한다', async () => {
  CANVAS = makeCanvas(FIVE());
  H.setCanned('readSpacingSequence', (a) => CANVAS.read(a || {}));
  /* 거짓말하는 적용부: ok:true 를 돌려주지만 «아무것도 안 한다». 앞끝(호출됨)은 초록이다. */
  H.setCanned('applySpacingOps', async () => ({ ok: true, applied: 999 }));
  const at = H.calls.length;
  const r = await H.call('normalize_spacing', {});
  assert.equal(r.result.ok, true, '앞끝은 초록이다 — 이게 함정이다');
  assert.ok(H.calls.slice(at).some((c) => c.method === 'applySpacingOps'), '앞끝: 불리긴 했다');
  assert.deepEqual(CANVAS.state.map(shape), FIVE().map(shape),
    '뒤끝: 캔버스는 «하나도 안 바뀌었다» — 이 사실이 앞끝과 «따로» 보여야 한다');
  H.setCanned('applySpacingOps', (p) => CANVAS.apply(p));
});

// ── Ⓓ 배선 «자리» — 소스 문자열로 지킨다 ─────────────────────────────────
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

test('Ⓓ ★훅은 «두 갈래가 갈리기 전»에 있다 — handler(args) 호출부가 전부 _noteSeq 안이다', () => {
  const src = stripComments(fs.readFileSync(path.join(REPO, 'main', 'claude-pm', 'mcp-server.js'), 'utf8'));
  const lines = src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /await handler\(args\)/.test(l));
  assert.ok(lines.length >= 2, `handler(args) 호출부를 ${lines.length}곳 찾았다 — 리팩터링됐나? 패턴을 갱신하라`);
  const naked = lines.filter(([, l]) => !/_noteSeq\s*\(/.test(l));
  assert.deepEqual(naked.map(([n, l]) => `${n}: ${l.trim()}`), [],
    '★_noteSeq 를 «안 거치는» 도구 호출부가 있다 — 그 갈래는 갭 감수도 undo 추적도 조용히 샌다');

  // 정의(function _scheduleSpacingAudit)는 빼고 «호출»만 센다.
  const hooks = [...src.matchAll(/(?<!function )_scheduleSpacingAudit\s*\(/g)];
  assert.equal(hooks.length, 1, `_scheduleSpacingAudit 호출은 «한 곳»이어야 한다(실제 ${hooks.length}곳). 여러 곳이면 어디가 진짜인지 아무도 모른다`);
  const inNoteSeq = src.slice(src.indexOf('const _noteSeq'), src.indexOf('if (!_NON_MUTATING.has(name) && _rendererInvoker'));
  assert.ok(/_scheduleSpacingAudit\s*\(/.test(inNoteSeq),
    '★훅이 _noteSeq 밖으로 «옮겨졌다». 갈래 한쪽(예: _invokeRendererAddBlock)에 두면 '
    + 'add_section·build_basic_section·delete_block·move_block 이 통째로 샌다 — 갤러리 함정과 같은 모양이다');
});

test('Ⓓ-b 규격은 «한 곳»에서만 온다 — 배선 코드에 숫자가 박혀 있지 않다', () => {
  const src = stripComments(fs.readFileSync(path.join(REPO, 'main', 'claude-pm', 'mcp-server.js'), 'utf8'));
  const seg = src.slice(src.indexOf('function runSpacingAudit'), src.indexOf('function _enrichApiMissing'));
  for (const n of [16, 40, 80, 100]) {
    assert.equal(new RegExp(`\\b${n}\\b`).test(seg), false,
      `runSpacingAudit 안에 갭 값 ${n} 이 리터럴로 박혀 있다 — SCALE 에서 와야 한다`);
  }
  assert.ok(/require\('\.\/services\/spacing'\)/.test(fs.readFileSync(path.join(REPO, 'main', 'claude-pm', 'mcp-server.js'), 'utf8')),
    '규격 모듈을 require 하지 않고 있다');
});

test('Ⓓ-c 갭 높이를 «사람이» 정하는 자리는 전부 markGapManual 을 부른다 (ⓓ)', () => {
  /* ★호출부를 «세서» 지킨다. 한 곳이라도 빠지면 그 경로로 맞춘 값이 감수에 되돌려진다. */
  const targets = [
    ['js/props/prop-gap.js', 3, '슬라이더 · 숫자 입력 · 프리셋 버튼'],
    ['js/props/prop-multisel.js', 1, '세로 분배'],
    ['js/block-factory.js', 1, 'updateGapBlock(=MCP update_gap_block)'],
  ];
  const rows = [];
  for (const [rel, want, what] of targets) {
    const src = stripComments(fs.readFileSync(path.join(REPO, rel), 'utf8'));
    const got = (src.match(/markGapManual\s*\?\.\s*\(|markGapManual\s*\(/g) || []).length;
    rows.push(`${rel.padEnd(28)} 기대 ${want} · 실제 ${got}   (${what})`);
    assert.equal(got, want, `${rel} 의 markGapManual 호출이 ${got}곳이다(기대 ${want}) — ${what}`);
  }
  console.error('  ┌─ 수동 도장 호출부 ───────────────');
  rows.forEach((r) => console.error('  │ ' + r));
  console.error('  └──────────────────────────────────');

  /* 반대편: 기계가 만드는 갭은 «자동» 도장을 받아야 감수가 보정할 수 있다. */
  const bf = fs.readFileSync(path.join(REPO, 'js', 'block-factory.js'), 'utf8');
  assert.ok(/gb\.dataset\.gapAuto = '1'/.test(bf), 'makeGapBlock 이 자동 도장을 안 찍는다');
  assert.equal((bf.match(/data-gap-auto="1"/g) || []).length, 4,
    'addSection 의 갭 템플릿 4곳이 전부 자동 도장을 달아야 한다(빈 섹션 2 + 기본 섹션 2)');
});

test('Ⓔ normalize_spacing 은 «숨김» 도구다 — 클로드 목록에 안 뜬다(토큰 0)', async () => {
  const visible = (await H.listTools()).map((t) => t.name);
  assert.equal(visible.includes('normalize_spacing'), false,
    '★숨김이 풀렸다. 이건 QA 통로지 「클로드가 부르게 하는 길」이 아니다(현빈 지시 ⓔ)');
  const hidden = (await H.listTools(true)).map((t) => t.name);
  assert.equal(hidden.includes('normalize_spacing'), true, '숨김 목록에는 있어야 한다(호출은 된다)');
});

/* ── Ⓕ main.js ↔ 렌더러 브리지 «배선의 존재» ────────────────────────────────
 * ⚠️정직하게 적는다: 이 검사는 «소스 문자열»이다. 진짜 Electron 왕복은 «못 쟀다»
 *   (현빈 실사용 PC에서 앱을 띄우면 창이 앞으로 튄다 = 상시 금지 지시). 그래서 여기서는
 *   ⑴키가 둘 다 등록됐나 ⑵함수가 둘 다 있나 ⑶index.html 이 렌더러 파일을 «싣나»만 본다.
 *   ★렌더러 «동작»은 tests/dom/spacing-normalize.dom.spec.js 가 진짜 크로미움에서 잰다.
 *   ★MCP 디스패처 «동작»은 이 파일의 Ⓐ~Ⓒ 가 진짜 HTTP 로 잰다.
 *   ⇒ 못 잰 구간은 딱 하나 — main.js 의 executeJavaScript 왕복 그 한 칸이다.       */
test('Ⓕ main.js 가 브리지 «두 키»를 다 등록하고, index.html 이 렌더러 파일을 싣는다', () => {
  /* ⚠️main.js 에는 «주석에» setMcpRendererInvoker({ 를 적어 둔 옛 안내문이 3줄 있다.
     주석을 세면 「호출이 4곳」이라는 가짜 결함이 난다 — 주석부터 걷어낸다. */
  const mainSrc = stripComments(fs.readFileSync(path.join(REPO, 'main.js'), 'utf8'));
  const setCalls = [...mainSrc.matchAll(/setMcpRendererInvoker\(\{/g)];
  assert.equal(setCalls.length, 1, `setMcpRendererInvoker 호출이 ${setCalls.length}곳이다 — 여러 곳이면 한쪽만 등록돼 «샌다»`);
  const objStart = mainSrc.indexOf('setMcpRendererInvoker({');
  const obj = mainSrc.slice(objStart, objStart + 6000);
  for (const key of ['readSpacingSequence: _invokeRendererReadSpacingSequence', 'applySpacingOps: _invokeRendererApplySpacingOps']) {
    assert.ok(obj.includes(key), `브리지 객체에 «${key}» 가 없다 — 하나만 있으면 감수는 API_MISSING 으로 조용히 죽는다`);
  }
  for (const fn of ['_invokeRendererReadSpacingSequence', '_invokeRendererApplySpacingOps']) {
    assert.ok(new RegExp(`async function ${fn}\\b`).test(mainSrc), `${fn} 이 정의돼 있지 않다`);
  }
  /* 브리지가 «진짜 렌더러 함수»를 부르는지 — 이름이 어긋나면 API_MISSING 으로 조용히 죽는다. */
  assert.ok(/window\.readSpacingSequence/.test(mainSrc) && /window\.applySpacingOps/.test(mainSrc),
    'main.js 가 window.readSpacingSequence / window.applySpacingOps 를 안 부른다');

  const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  assert.equal((html.match(/js\/spacing-normalize\.js/g) || []).length, 1,
    'index.html 이 js/spacing-normalize.js 를 «정확히 한 번» 실어야 한다 — 안 실으면 window.* 가 없어 감수가 통째로 죽는다');

  /* 렌더러 파일이 «내보내는» 이름과 main.js 가 «부르는» 이름이 같은가 — 양끝 대조. */
  const rend = fs.readFileSync(path.join(REPO, 'js', 'spacing-normalize.js'), 'utf8');
  for (const w of ['window.readSpacingSequence =', 'window.applySpacingOps =', 'window.markGapManual =', 'window.markGapAuto =']) {
    assert.ok(rend.includes(w), `js/spacing-normalize.js 가 «${w}» 를 안 내보낸다`);
  }
});

/* ── Ⓖ 히스토리 위생 — 연속 감수가 되돌리기 목록을 «도배하지» 않는다 ──────────
 * ★타이밍만으로는 「턴 중간에 안 돈다」를 «보장 못 한다»(실측: 도구 2개에 181초 걸린 턴이 있다).
 *   그래서 「중간에 돌아도 해가 없게」 만드는 쪽이 본체다 — 이 검사가 그 자리다.
 */
test('Ⓖ 연속 감수는 히스토리 칸을 «새로 안 쌓는다» (되돌리기 목록 도배 방지)', async () => {
  /* 감수가 «두 번 연속» 실제로 뭔가를 고치게 만든다: 매번 갭을 빼앗아 다시 채우게. */
  let hist = 0;
  CANVAS = makeCanvas([{ sectionId: 'sec_h', name: '히스토리', items: [
    g('gh_a'), b('t_h1', 'heading'), b('t_h2', 'body'), g('gh_z'),
  ] }]);
  const seen = [];
  H.setCanned('readSpacingSequence', (a) => CANVAS.read(a || {}));
  H.setCanned('applySpacingOps', async (p) => { seen.push(!!p.noHistory); if (!p.noHistory) hist++; return CANVAS.apply(p); });
  H.setCanned('historyTip', async () => ({ ok: true, seq: 1000 + hist, empty: false, canUndo: true, len: 1 + hist, action: '간격 감수' }));

  const r1 = await H.call('normalize_spacing', {});
  assert.equal(r1.result.ok, true);
  assert.equal(seen[0], false, '첫 감수는 «칸을 쌓아야» 되돌릴 수 있다');

  // 사이에 «아무 일도 없이» 다시 고칠 거리를 만든다 — 사람이 갭을 지운 것과 같은 모양
  CANVAS.state[0].items = CANVAS.state[0].items.filter((i) => i.kind !== 'gap' || i.id.startsWith('gh_'));
  const r2 = await H.call('normalize_spacing', {});
  assert.equal(r2.result.ok, true);
  assert.equal(r2.result.changedSections, 1, '두 번째도 실제로 고칠 게 있어야 이 검사가 의미가 있다');
  assert.equal(seen[1], true,
    '★두 번째 감수가 히스토리 칸을 또 쌓았다 — 긴 턴이면 되돌리기 목록이 「간격 감수」로 도배된다');

  // 사람이 사이에 뭔가 하면(꼭대기가 달라지면) «정상적으로» 새 칸을 쌓는다
  hist += 5;
  CANVAS.state[0].items = CANVAS.state[0].items.filter((i) => i.kind !== 'gap' || i.id.startsWith('gh_'));
  const r3 = await H.call('normalize_spacing', {});
  assert.equal(r3.result.changedSections, 1);
  assert.equal(seen[2], false,
    '★사람이 사이에 편집했는데 칸을 안 쌓았다 — 그러면 되돌리기가 사람 작업을 건너뛴다');

  H.setCanned('applySpacingOps', (p) => CANVAS.apply(p));
});

test('Ⓗ ★디바운스 기본값은 «잰 값»이다 — 누가 조용히 되돌리지 못하게 못박는다', () => {
  const src = stripComments(fs.readFileSync(path.join(REPO, 'main', 'claude-pm', 'mcp-server.js'), 'utf8'));
  const m = src.match(/_SPACING_DEBOUNCE_DEFAULT_MS\s*=\s*(\d+)/);
  assert.ok(m, '_SPACING_DEBOUNCE_DEFAULT_MS 상수를 못 찾았다 — 값이 리터럴로 흩어졌나?');
  const ms = Number(m[1]);
  /* 실측 근거(skills/지디/handoff/axgate-0907-evidence): 도구 2개 이상인 턴 10개의
     「턴 소요/(도구수-1)」 p50 5.4s · p90 9.6s. p90 «위»여야 한다. */
  assert.ok(ms >= 9600, `기본 디바운스 ${ms}ms 는 실측 p90(9600ms) «아래»다 — 턴 중간에 도는 낭비가 커진다`);
  assert.ok(ms <= 60000, `기본 디바운스 ${ms}ms 는 너무 길다 — 사용자가 갭이 안 잡힌다고 느낀다`);
  /* ★값만 지키면 「왜 그 값인지」가 사라진다. 근거 문장이 «옆에» 있어야 한다. */
  const raw = fs.readFileSync(path.join(REPO, 'main', 'claude-pm', 'mcp-server.js'), 'utf8');
  assert.ok(/p90/.test(raw) && /p50/.test(raw),
    '디바운스 옆에 «잰 근거»(p50/p90)가 적혀 있어야 한다 — 숫자만 있으면 다음 사람이 왜 그 값인지 모른다');
});
