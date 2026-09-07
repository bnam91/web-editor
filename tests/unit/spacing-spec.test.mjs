/* spacing-spec.test.mjs — 갭 규격의 «순수» 부분. (2026-09-07 신설)
 *
 * ★이 파일이 검사의 «본체»다. 규격이 순수 함수라서 여기서 전수로 잴 수 있다.
 *   DOM·MCP 배선은 spacing-wiring.test.js 가 «따로» 잰다 — 「불렀다」와 「그 값이 됐다」는
 *   다른 사실이라 한 파일에서 같이 재면 한쪽 초록에 속는다.
 *
 * ★★가장 중요한 검사는 «멱등»이다(⑤). 두 번 돌려 결과가 같아야 아무 때나 돌릴 수 있고,
 *   삭제 뒤에 돌리면 고아 갭이 저절로 정리된다 — 이 설계 전체가 그 성질 위에 서 있다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..');
const require_ = createRequire(import.meta.url);
const SPACING_REL = path.join('main', 'claude-pm', 'services', 'spacing.js');
const S = require_(path.join(REPO, SPACING_REL));

const blk = (id, type, extra) => Object.assign({ id, kind: 'block', type }, extra || {});
const gap = (id, height, auto = true) => ({ id, kind: 'gap', height, auto });

// ── ① 값 ────────────────────────────────────────────────────────────────
test('① SCALE 은 승인값 그대로다 (XS16 · S40 · M80 · L100)', () => {
  assert.deepEqual({ ...S.SCALE }, { XS: 16, S: 40, M: 80, L: 100 });
  assert.equal(S.SECTION_EDGE, 100, '섹션 상하는 L=100 이다');
});

test('①-b SCALE 은 얼어 있다 — 누가 실행중에 갈아끼우지 못한다', () => {
  assert.throws(() => { 'use strict'; S.SCALE.S = 999; }, TypeError);
});

// ── ② 무게 · 조합표 전수 ─────────────────────────────────────────────────
test('② 무게표 — 0 꼬리 / 1 글줄 / 2 표제 / 3 덩어리', () => {
  for (const t of ['caption', 'label']) assert.equal(S.weightOf(t), 0, t);
  for (const t of ['body', 'bullet']) assert.equal(S.weightOf(t), 1, t);
  for (const t of ['heading', 'h1', 'h2', 'h3']) assert.equal(S.weightOf(t), 2, t);
  for (const t of ['table', 'asset', 'canvas', 'frame', 'graph', 'step', 'grid', 'comparison', 'mockup']) {
    assert.equal(S.weightOf(t), 3, t);
  }
});

test('③ 조합표 — 지시받은 여섯 규칙이 «그대로» 나온다', () => {
  const rows = [
    // [앞, 뒤, 기대, 근거]
    ['heading', 'caption', 16, '뒤가 무게0 → XS (템플릿 실측 15×3)'],
    ['heading', 'label', 16, '뒤가 무게0 → XS'],
    ['label', 'heading', 80, '라벨(0) → 제목(2): 무게가 다르다 → M'],
    ['body', 'body', 40, '둘 다 1 → S (템플릿 실측 40)'],
    ['heading', 'heading', 40, '둘 다 2 → S (템플릿 실측 40×4)'],
    ['heading', 'body', 80, '1↔2 → M (템플릿 실측 80)'],
    ['body', 'table', 80, '★한쪽이 3 → M — 실측 40 을 «올린» 유일한 칸'],
    ['table', 'body', 80, '한쪽이 3 → M'],
    ['asset', 'canvas', 80, '둘 다 3 → M'],
    ['table', 'caption', 16, '★«뒤가 0» 규칙이 «덩어리» 규칙보다 먼저다 — 표 밑 캡션은 붙는다'],
  ];
  const bad = [];
  for (const [a, b, want, why] of rows) {
    const got = S.gapFor(a, b);
    if (got !== want) bad.push(`${a} → ${b} : 기대 ${want}, 실제 ${got}   (${why})`);
  }
  assert.deepEqual(bad, [], '조합표가 어긋났다:\n  ' + bad.join('\n  '));
});

test('③-b .row 는 «가장 무거운 자식»의 무게를 쓴다 — 이미지 낀 줄은 덩어리다', () => {
  const row = { type: 'row', childTypes: ['body', 'asset'] };
  assert.equal(S.weightOfItem(row), 3);
  assert.equal(S.gapFor('body', row), 80, '본문 → (본문+이미지)줄 = 덩어리 → M');
  assert.equal(S.gapFor({ type: 'row', childTypes: ['body'] }, 'body'), 40, '글줄만 든 줄은 글줄이다');
});

// ── ④ 모르는 타입 ────────────────────────────────────────────────────────
test('④ 모르는 타입 → 무게 2(안전측) + ⛔«조용히» 안 넘어간다', () => {
  const seen = [];
  const restore = S.setWarner((m) => seen.push(m));
  S.resetWarnings();
  try {
    assert.equal(S.weightOf('teleporter'), S.FALLBACK_WEIGHT);
    assert.equal(S.FALLBACK_WEIGHT, 2);
    S.weightOf('teleporter');            // 두 번째 — 로그는 «이름당 한 번»
    S.weightOf('another_unknown');
  } finally { S.setWarner(restore); }
  assert.equal(seen.length, 2, `이름당 한 번씩 = 2줄이어야 한다. 실제:\n  ${seen.join('\n  ')}`);
  assert.match(seen[0], /teleporter/);
  assert.match(seen[0], /WEIGHT/, '어디를 고치면 되는지 말해야 한다');
});

// ── ⑤ ★멱등 ─────────────────────────────────────────────────────────────
/** 계획 → 적용 → 다시 계획. 두 번째 ops 가 비어 있어야 멱등이다. */
function twice(items) {
  const p1 = S.normalizePlan(items);
  const after = S.applyPlanToSequence(items, p1.ops);
  const p2 = S.normalizePlan(after);
  return { p1, after, p2 };
}

const CASES = {
  '오늘 실측한 5섹션 중 하나 (블록 사이 갭 0개)': [
    gap('gb_a', 100), blk('lg_1', 'label'), blk('ss_1', 'heading'), blk('ss_2', 'body'), gap('gb_z', 100),
  ],
  '고아 갭 — 블록2 를 지워서 갭이 둘 남았다': [
    gap('gb_a', 100), blk('ss_1', 'heading'), gap('gb_1', 100), gap('gb_2', 100), gap('gb_z', 100),
  ],
  '이미 규격에 맞는 섹션': [
    gap('gb_a', 100), blk('ss_1', 'heading'), gap('gb_1', 80), blk('ss_2', 'body'), gap('gb_z', 100),
  ],
  '수동 갭이 낀 섹션': [
    gap('gb_a', 100), blk('ss_1', 'heading'), gap('gb_m', 37, false), blk('ss_2', 'body'), gap('gb_z', 100),
  ],
  '덩어리가 섞인 섹션': [
    blk('ss_1', 'heading'), blk('tbl_1', 'table'), blk('ss_2', 'caption'), blk('cvb_1', 'canvas'),
  ],
  '빈 섹션 (블록 0개)': [gap('gb_a', 100), gap('gb_z', 100)],
};

test('⑤ ★멱등 — 두 번 돌린 결과가 같다 (이 설계의 핵심 성질)', () => {
  const bad = [];
  for (const [name, items] of Object.entries(CASES)) {
    const { p1, after, p2 } = twice(items);
    console.error(`  ┌─ ${name}`);
    console.error(`  │ 전 : ${fmt(items)}`);
    console.error(`  │ ops: ${p1.ops.length ? p1.ops.map(o => o.op + (o.id ? ':' + o.id : '') + (o.height != null ? '=' + o.height : '')).join(' · ') : '(없음)'}`);
    console.error(`  │ 후 : ${fmt(after)}`);
    console.error(`  └ 2회차 ops: ${p2.ops.length}개`);
    if (p2.ops.length) bad.push(`${name} — 2회차에 ops 가 ${p2.ops.length}개 남았다: ${JSON.stringify(p2.ops)}`);
  }
  assert.deepEqual(bad, [], '★멱등이 깨졌다:\n  ' + bad.join('\n  '));
});

function fmt(items) {
  return items.map((it) => (it.kind === 'gap' ? `gap${it.height}${it.auto ? '' : '(수동)'}` : it.type)).join(' · ');
}

// ── ⑥ 시나리오별 «실제로 무엇이 됐나» ───────────────────────────────────
test('⑥-a 빠진 자리 — 오늘 그 5섹션 모양이 규격대로 채워진다', () => {
  const items = CASES['오늘 실측한 5섹션 중 하나 (블록 사이 갭 0개)'];
  const { p1, after } = twice(items);
  assert.equal(p1.ops.filter((o) => o.op === 'insert').length, 2, 'label→heading, heading→body 두 자리');
  assert.deepEqual(fmt(after).split(' · '),
    ['gap100', 'label', 'gap80', 'heading', 'gap80', 'body', 'gap100'],
    '라벨(0)→제목(2)=M80 · 제목(2)→본문(1)=M80 · 상하 L100');
});

test('⑥-b 고아 갭 — 블록2 를 지운 뒤 돌리면 «저절로» 하나로 합쳐진다', () => {
  const items = CASES['고아 갭 — 블록2 를 지워서 갭이 둘 남았다'];
  const { p1, after } = twice(items);
  assert.equal(p1.ops.filter((o) => o.op === 'remove').length, 2, '꼬리 슬롯의 갭 3개 중 2개가 지워진다');
  assert.deepEqual(fmt(after).split(' · '), ['gap100', 'heading', 'gap100']);
});

test('⑥-c ★수동 갭은 «안 건드린다» — 37px 이 살아남고, 이유를 말한다', () => {
  const items = CASES['수동 갭이 낀 섹션'];
  const { p1, after } = twice(items);
  assert.ok(!p1.ops.some((o) => o.id === 'gb_m'), '수동 갭 gb_m 에 손대는 op 가 있으면 안 된다');
  assert.ok(fmt(after).includes('gap37(수동)'), '37px 이 그대로 있어야 한다');
  assert.ok(p1.notes.some((n) => /gb_m/.test(n) && /수동/.test(n)),
    `«안 건드린 이유»를 notes 로 말해야 한다. 실제: ${JSON.stringify(p1.notes)}`);
});

test('⑥-d 이미 맞는 섹션은 ops 가 «빈 배열» = 히스토리를 안 더럽힌다', () => {
  const { p1 } = twice(CASES['이미 규격에 맞는 섹션']);
  assert.deepEqual(p1.ops, []);
});

test('⑥-e 블록이 하나도 없는 섹션은 손대지 않는다 (빈 섹션의 갭 = 작업 자리)', () => {
  const { p1 } = twice(CASES['빈 섹션 (블록 0개)']);
  assert.deepEqual(p1.ops, []);
  assert.ok(p1.notes.length, '왜 안 건드렸는지는 말해야 한다');
});

test('⑥-f 덩어리가 섞인 섹션 — 표 밑 캡션은 XS 로 «붙고», 캡션 뒤 캔버스는 M', () => {
  const { after } = twice(CASES['덩어리가 섞인 섹션']);
  assert.deepEqual(fmt(after).split(' · '),
    ['gap100', 'heading', 'gap80', 'table', 'gap16', 'caption', 'gap80', 'canvas', 'gap100']);
});

// ── ⑦ 순수성 ────────────────────────────────────────────────────────────
test('⑦ ⛔규격 모듈은 electron·DOM 을 «안» 부른다 — 그래야 이 검사가 진짜 검사다', () => {
  const src = fs.readFileSync(path.join(REPO, SPACING_REL), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  for (const pat of [/require\(\s*['"]electron['"]/, /\bdocument\./, /\bwindow\./, /require\(\s*['"]fs['"]/]) {
    assert.equal(pat.test(src), false, `spacing.js 가 ${pat} 를 쓴다 — 순수해야 단위검사가 쉽다`);
  }
});

test('⑦-b 무게표의 타입 이름은 mcp-block-tools 의 BLOCK_TYPES 와 «갈라지지» 않는다', () => {
  const src = fs.readFileSync(path.join(REPO, 'main', 'claude-pm', 'mcp-block-tools.js'), 'utf8');
  /* ⚠️`type:` 만 보면 도구 스키마의 type:'object'/'string' 까지 딸려온다(실제로 그렇게 걸렸다).
     BLOCK_TYPES 항목은 «type 다음이 add» 라서, 그 모양으로만 센다. */
  const known = new Set([...src.matchAll(/\{\s*type:\s*'([a-z0-9_]+)',\s*add:/g)].map((m) => m[1]));
  assert.ok(known.size >= 20, `BLOCK_TYPES 를 못 읽었다(${known.size}개) — 패턴을 갱신하라`);
  /* 텍스트 하위타입(heading/body/…)과 DOM 래퍼(row)는 BLOCK_TYPES 에 «없는 게 정상»이다.
     그 밖의 이름이 무게표에만 있으면 «내가 지어낸 이름»이고, 그건 반드시 썩는다. */
  const TEXT_SUB = new Set(['heading', 'h1', 'h2', 'h3', 'body', 'bullet', 'label', 'caption', 'row']);
  /* ★BLOCK_TYPES 에 «없는데» 무게표엔 있어도 되는 것 — «이유와 함께»만 통과한다.
     이유 없이 늘리지 마라. 이 줄이 비면 이 검사는 아무것도 안 지킨다. */
  const ALLOWED_MISSING = {
    grid: 'DOM 에는 있는데(.grid-block · grd_ · js/blocks/grid-block.js) MCP BLOCK_TYPES 엔 «아직 없다»'
        + ' — bac5499 기준 실측. 정규화는 DOM 을 읽으므로 여기 무게가 있어야 grid 가 «모르는 타입»으로'
        + ' 떨어지지 않는다. BLOCK_TYPES 에 grid 가 들어오면 이 줄을 지워라.',
  };
  const invented = Object.keys(S.WEIGHT)
    .filter((t) => !known.has(t) && !TEXT_SUB.has(t) && !(t in ALLOWED_MISSING));
  assert.deepEqual(invented, [],
    `무게표에만 있는 «지어낸» 타입: ${invented.join(', ')} — BLOCK_TYPES 이름을 쓰거나, 텍스트 하위타입이면 TEXT_SUB 에, 의도한 선반영이면 ALLOWED_MISSING 에 «이유와 함께» 넣어라`);
  /* 반대 방향도 본다: BLOCK_TYPES 에 «있는데» 무게가 없는 타입 = 정규화가 못 읽는 타입.
     경고로 떨어지긴 하지만, 그건 사후 발견이다. 여기서 «미리» 잡는다. */
  /* text = 우산 이름이다(진짜 무게는 heading/body/caption… 하위타입에서 나온다).
     gap  = 간격 자체라 «블록»이 아니다. 둘 다 무게를 갖는 게 오히려 틀린다. */
  const NOT_A_BLOCK_WEIGHT = new Set(['text', 'gap']);
  const unweighted = [...known].filter((t) => !(t in S.WEIGHT) && !NOT_A_BLOCK_WEIGHT.has(t));
  assert.deepEqual(unweighted, [],
    `BLOCK_TYPES 에 있는데 무게가 «없는» 타입: ${unweighted.join(', ')} — spacing.js 의 WEIGHT 에 한 줄 추가해라`);
});

// ── ⑧ id 가 없는 것은 «지목할 수 없다» ──────────────────────────────────
test('⑧ ★id 없는 블록 뒤의 갭은 «맨 앞»에 꽂히지 않는다 — 건너뛰고 말한다', () => {
  /* afterId 가 null 이면 적용부는 «맨 앞»에 넣는다(top 슬롯 규약). 그래서 id 없는 블록을
     그대로 흘려보내면 섹션 한복판에 들어갈 갭이 통째로 위로 튄다. 한 번 보면 바로 안 보이는 종류. */
  const items = [
    { id: 'gb_a', kind: 'gap', height: 100, auto: true },
    { id: null, kind: 'block', type: 'heading' },
    { id: 'tb_2', kind: 'block', type: 'body' },
    { id: 'gb_z', kind: 'gap', height: 100, auto: true },
  ];
  const p = S.normalizePlan(items);
  assert.deepEqual(p.ops.filter((o) => o.op === 'insert'), [],
    `id 없는 블록 뒤에 삽입 op 를 냈다 — afterId=null 이라 «맨 앞»에 꽂힌다: ${JSON.stringify(p.ops)}`);
  assert.ok(p.notes.some((n) => /id/.test(n)), '왜 건너뛰었는지 말해야 한다');
});

test('⑧-b id 없는 «갭»이 낀 슬롯은 통째로 안 건드린다 (set/remove 가 빗나가는 대신)', () => {
  const items = [
    { id: 'gb_a', kind: 'gap', height: 100, auto: true },
    { id: 'tb_1', kind: 'block', type: 'heading' },
    { id: null, kind: 'gap', height: 13, auto: true },
    { id: 'tb_2', kind: 'block', type: 'body' },
    { id: 'gb_z', kind: 'gap', height: 100, auto: true },
  ];
  const p = S.normalizePlan(items);
  assert.deepEqual(p.ops, []);
  assert.ok(p.notes.some((n) => /id/.test(n)));
});

// ── ⑨ 자동/수동 «세 갈래» ────────────────────────────────────────────────
test('⑨ ★inline height 가 «없는» 갭은 자동이다 — 아무도 값을 정한 적이 없으니까', () => {
  /* 실측(templates/canvas 19개): inline height 가 아예 없는 갭이 **18개**.
     그건 CSS 기본값이 보이는 것이지 «사람이 고른 값»이 아니다. ⓓ 가 지키려는 건
     «사람이 정한 값»인데 정해진 값이 없다 ⇒ 빈칸을 채우는 건 뺏는 게 아니다. */
  assert.equal(S.isAutoGap({ marked: true, hasInlineHeight: true }), true, '표식 있으면 자동');
  assert.equal(S.isAutoGap({ marked: true, hasInlineHeight: false }), true);
  assert.equal(S.isAutoGap({ marked: false, hasInlineHeight: false }), true, '★표식 없고 «값도 없다» → 자동');
  assert.equal(S.isAutoGap({ marked: false, hasInlineHeight: true }), false, '★표식 없는데 «값이 있다» → 수동(누군가 정했다)');
  assert.equal(S.isAutoGap({ auto: true }), true, '축약 형태(검사용)도 살아 있어야 한다');
  assert.equal(S.isAutoGap({ auto: false }), false);
});

test('⑨-b 세 갈래가 «정규화 결과»까지 간다 — 값 없는 갭은 채워지고, 값 있는 갭은 남는다', () => {
  const seq = [
    { id: 'gb_a', kind: 'gap', height: 100, marked: true, hasInlineHeight: true },
    { id: 'tb_1', kind: 'block', type: 'heading' },
    { id: 'gb_blank', kind: 'gap', height: 40, marked: false, hasInlineHeight: false },  // 아무도 안 정했다
    { id: 'tb_2', kind: 'block', type: 'body' },
    { id: 'gb_hand', kind: 'gap', height: 37, marked: false, hasInlineHeight: true },     // 사람이 정했다
    { id: 'tb_3', kind: 'block', type: 'body' },
    { id: 'gb_z', kind: 'gap', height: 100, marked: true, hasInlineHeight: true },
  ];
  const p = S.normalizePlan(seq);
  const after = S.applyPlanToSequence(seq, p.ops);
  const shape = after.map((i) => (i.kind === 'gap' ? `gap${i.height}` : i.type)).join(' · ');
  assert.equal(shape, 'gap100 · heading · gap80 · body · gap37 · body · gap100',
    `값 없던 갭은 M80 으로 채워지고 손맞춤 37 은 남아야 한다: ${shape}`);
  // 멱등도 이 갈래에서 유지된다
  assert.deepEqual(S.normalizePlan(after).ops, []);
});

test('⑨-c ⚠️「inline height 없음 = 아무도 안 정했다」의 등가가 깨지는 경로가 없다', () => {
  /* 이 등가는 «갭 높이를 바꾸는 모든 자리가 .style.height 를 쓴다»에 기대고 있다.
     CSS 클래스로 갭 높이를 주는 경로가 새로 생기면 ⑵ 갈래가 «사람이 정한 값»을 자동으로 오판한다. */
  const files = ['js/props/prop-gap.js', 'js/props/prop-multisel.js', 'js/block-factory.js', 'js/spacing-normalize.js'];
  const bad = [];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(REPO, rel), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    /* 갭에 «클래스로» 높이를 주는 모양: classList.add('gap-h-…') 류. 지금은 0건이어야 한다. */
    for (const m of src.matchAll(/classList\.add\(\s*['"]gap-[a-z0-9-]*h[a-z0-9-]*['"]/g)) bad.push(`${rel}: ${m[0]}`);
  }
  assert.deepEqual(bad, [],
    '갭 높이를 «클래스»로 주는 경로가 생겼다 — spacing.js 의 isAutoGap ⑵ 갈래가 사람 값을 자동으로 오판한다:\n  ' + bad.join('\n  '));
});
