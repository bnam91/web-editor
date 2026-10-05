/* proj-merge.test.mjs — 저장 병합을 «한 벌»로 모은 그 함수의 계약. (T-232 ⓑ, 2026-09-27)
 *
 * ★왜 생겼나 — 같은 병합 코드가 `js/io/save-load.js` 와 `js/commit-system.js` 에 «두 벌»이었고
 *   ★이미 갈라져 있었다: 저쪽은 `_recovered` 를 뺐고 여기는 안 뺐다. 그 마커는 「저장에 남기지
 *   않음」이 두 곳에 명시된 런타임 표식이라, ★커밋 경로로 저장하면 파일에 실렸다.
 *   ⇒ 「같은 뜻을 두 번 쓰면 따로 늙는다」의 실물이고, 한 벌로 모으며 그 결함이 같이 닫혔다.
 *
 * ★무엇을 잠그나
 *   M1  ★키 «순서»가 옛 스프레드와 같다 — 순서가 바뀌면 저장 «바이트»가 달라진다
 *   M2  existing → data 로 덮는다(레거시 필드는 data 에 없으면 existing 유지)
 *   M3  ★meta 키 넷은 양쪽에서 빠진다(_meta.json 이 관리한다)
 *   M4  ★★`_recovered` 는 «existing 에서» 빠진다 — 두 벌이 갈라졌던 바로 그 자리
 *   M5  name 폴백 셋 · id 는 «항상» targetId
 *   M6  ★시간은 «인자»로 받는다 — 안 주면 지금, 주면 그것(검사가 잴 수 있게)
 *   W1  ★호출부 둘이 «그 한 벌»을 쓴다 — 스프레드가 되살아나면 빨개진다
 *   W2  ★★순수 모듈이다 — 이 파일이 다른 모듈을 import 하면 로드 순서가 다시 얽힌다
 *
 * 실행: node --test tests/unit/proj-merge.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
/* ⛔`import` 로 못 가져온다 — package.json 에 `type:module` 이 없어 node 는 이 저장소의 `.js` 를
   CommonJS 로 본다(브라우저에서는 `<script type="module">` 이라 ESM 이다). 실측: 그대로 import 하면
   `Named export … not found. The requested module … is a CommonJS module` 로 죽는다.
   ⇒ 이 저장소의 관례대로 «소스를 떠서» 돌린다(`export ` 만 떼면 그대로 평가된다). */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const { stripComments } = createRequire(import.meta.url)('./_strip-comments.js');

const PROJ_MERGE_SRC = read('js/io/proj-merge.js').replace(/^export /gm, '');
const { buildProjForSave, PROJ_META_KEYS, PROJ_RUNTIME_KEYS } = new Function(
  `${PROJ_MERGE_SRC}\nreturn { buildProjForSave, PROJ_META_KEYS, PROJ_RUNTIME_KEYS };`)();

const NOW = '2026-09-27T12:00:00.000Z';

test('M1 ★키 순서가 옛 스프레드와 같다 — 순서가 바뀌면 저장 «바이트»가 달라진다', () => {
  const existing = { a: 1, b: 2, name: '옛이름' };
  const data = { b: 9, c: 3 };
  const proj = buildProjForSave(existing, data, 'proj_1', NOW);
  assert.deepEqual(Object.keys(proj), ['a', 'b', 'name', 'c', 'id', 'updatedAt'],
    '★삽입 순서가 existing → data → id/name/updatedAt 이 아니다');
});

test('M2 existing → data 로 덮는다 — 레거시 필드는 data 에 없으면 existing 이 산다', () => {
  const proj = buildProjForSave({ legacy: 'keep', v: 1 }, { v: 2 }, 'proj_1', NOW);
  assert.equal(proj.legacy, 'keep', '★data 에 없는 옛 필드가 사라졌다 — 그게 데이터 손실이다');
  assert.equal(proj.v, 2, '★data 가 existing 을 안 덮었다');
});

test('M3 ★meta 키 넷은 «양쪽»에서 빠진다 — proj.json 에 실리면 _meta.json 과 두 벌이 된다', () => {
  const meta = Object.fromEntries(PROJ_META_KEYS.map(k => [k, 'X']));
  const proj = buildProjForSave({ ...meta, keep: 1 }, { ...meta, keep2: 2 }, 'proj_1', NOW);
  for (const k of PROJ_META_KEYS) assert.ok(!(k in proj), `★${k} 가 저장본에 실렸다`);
  assert.equal(proj.keep, 1);
  assert.equal(proj.keep2, 2);
});

test('M4 ★★`_recovered` 는 existing 에서 빠진다 — 두 벌이 «갈라져 있던» 바로 그 자리', () => {
  // ★E169(2026-10-06 lane-drag): 자가치유 성패 표식 둘이 같은 명부로 들어왔다(_healed · _healError) — 셋 다 저장에 안 남는다.
  // ★E168(2026-10-06 lane-drag): 백업 저장 시각(_recoveredAt)도 같은 명부 — 알림 글에만 쓴다.
  assert.deepEqual(PROJ_RUNTIME_KEYS, ['_recovered', '_healed', '_healError', '_recoveredAt']);
  const proj = buildProjForSave({ _recovered: 'history', _healed: false, _healError: 'ENOSPC', _recoveredAt: 1, keep: 1 }, {}, 'proj_1', NOW);
  for (const k of ['_recovered', '_healed', '_healError', '_recoveredAt']) assert.ok(!(k in proj),
    `★★복구 마커 ${k} 가 저장본에 실렸다 — 「저장에 남기지 않음」이 두 곳에 명시돼 있다`);
  assert.equal(proj.keep, 1, '★같이 딸려 빠졌다');
});

test('M5 name 폴백 셋 · id 는 «항상» targetId', () => {
  assert.equal(buildProjForSave({ name: 'E' }, { name: 'D' }, 'p', NOW).name, 'E', '★existing 이 먼저다');
  assert.equal(buildProjForSave({}, { name: 'D' }, 'p', NOW).name, 'D');
  assert.equal(buildProjForSave({}, {}, 'p', NOW).name, 'Untitled');
  assert.equal(buildProjForSave({ id: 'old' }, { id: 'newer' }, 'p', NOW).id, 'p',
    '★★id 가 targetId 로 안 덮였다 — 저장 파일명과 안의 id 가 갈린다');
});

test('M6 ★시간은 «인자»로 받는다 — 안 주면 지금, 주면 그것', () => {
  assert.equal(buildProjForSave({}, {}, 'p', NOW).updatedAt, NOW);
  const auto = buildProjForSave({}, {}, 'p').updatedAt;
  assert.match(auto, /^\d{4}-\d{2}-\d{2}T/, '★시간을 안 넣었다');
});

/* ═══ W — 배선: 호출부 둘이 그 한 벌을 쓰는가 ═══════════════════════════════ */

test('W1 ★호출부 둘이 «그 한 벌»을 쓴다 — 스프레드가 되살아나면 빨개진다', () => {
  for (const rel of ['js/io/save-load.js', 'js/commit-system.js']) {
    const src = stripComments(read(rel));
    assert.match(src, /buildProjForSave\(existing, data, targetId\)/,
      `${rel}: ★한 벌(buildProjForSave)을 안 부른다`);
    /* ⛔옛 꼴이 되살아나면 두 벌이 되고 «따로 늙는다» — 그 지문을 문다. */
    assert.ok(!/\.\.\.existingWithoutMeta/.test(src),
      `${rel}: ★★옛 스프레드가 되살아났다 — 두 벌이 되면 한쪽만 고쳐진다(이번에 실제로 그랬다)`);
  }
});

test('W2 ★★순수 모듈이다 — import 가 0개여야 로드 순서에 영향이 없다', () => {
  const src = stripComments(read('js/io/proj-merge.js'));
  assert.equal(/^\s*import\s/m.test(src), false,
    '★★이 모듈이 다른 것을 import 한다 — 두 호출부의 부수효과 실행 순서가 다시 얽힌다(그걸 피해 제3의 모듈로 뽑았다)');
  assert.equal(/window\./.test(src), false, '★전역에 손댄다 — 순수 모듈이 아니다');
});

/* ═══ G — ⓑ② «객체가 아니면» 바탕을 비운다(둘째 방어선) ══════════════════
 * ★★디스크에 실물이 있었다 — `undefined.json`(2026-07-14) 의 내용이
 *   `{ ...<문자열 id>, ...<본문>, id:'undefined', … }` 였다. `Object.entries('proj_…')` 가
 *   `[['0','p'],['1','r'],…]` 이기 때문이다.
 * ★첫 방어선은 그 문자열이 «오는 길»을 끊은 것(main.js projects:load 의 isProjectShaped 가드,
 *   같은 카드 ⓐ)이고, 이것은 다른 문(localStorage·다른 IPC)으로 들어올 때를 막는다.
 * ⛔둘을 갈라 잰다 — 한 겹만 보고 「막혔다」로 읽으면 다른 문이 열린 것을 못 본다. */

test('G1 ★★existing 이 «문자열»이면 «0,1,2…» 로 펼쳐지지 않는다 — 실물이 그 꼴이었다', () => {
  const proj = buildProjForSave('proj_1775704460431', { pages: [1] }, 'proj_x', NOW);
  assert.ok(!('0' in proj), '★★문자열이 펼쳐졌다 — 이것이 undefined.json 의 내용이었다');
  assert.deepEqual(Object.keys(proj), ['pages', 'id', 'name', 'updatedAt']);
  assert.deepEqual(proj.pages, [1], '★저장할 내용(data)이 사라졌다 — 그건 더 나쁜 결함이다');
});

test('G2 ★객체가 아닌 existing 넷 모두 바탕을 비운다 — 배열·null 도 «객체»로 새지 않는다', () => {
  for (const v of ['x', ['a', 'b'], 0, true]) {
    const proj = buildProjForSave(v, { keep: 1 }, 'p', NOW);
    assert.deepEqual(Object.keys(proj), ['keep', 'id', 'name', 'updatedAt'], JSON.stringify(v));
  }
  /* ⛔`typeof x === 'object'` 만 보면 배열과 null 이 통과한다 — 그래서 배열을 따로 세운다. */
  assert.deepEqual(Object.keys(buildProjForSave(null, { keep: 1 }, 'p', NOW)),
    ['keep', 'id', 'name', 'updatedAt']);
});

test('G3 ⛔`data` 는 «비우지 않는다» — 조용히 비우면 «빈 프로젝트로 덮는» 손실이 된다', () => {
  const warns = [];
  const orig = console.warn;
  console.warn = (...a) => warns.push(a.join(' '));
  try {
    const proj = buildProjForSave({ keep: 1 }, 'not-an-object', 'p', NOW);
    /* ★바탕은 살아 있다 — data 를 못 읽었어도 existing 을 지우지 않는다. */
    assert.equal(proj.keep, 1, '★★data 가 이상하다고 바탕까지 버렸다 — 그게 데이터 손실이다');
    assert.ok(!('0' in proj), '★data 문자열이 펼쳐졌다');
  } finally { console.warn = orig; }
  assert.equal(warns.length, 1, '★★조용히 삼켰다 — 호출 계약 위반은 «드러내야» 고칠 곳을 안다');
  assert.match(warns[0], /data 가 객체가 아니다/);
});

test('G4 ★정상 입력은 한 자도 안 바뀐다 — 가드가 «평상시»를 건드리지 않는다', () => {
  const existing = { a: 1, name: 'E', _recovered: 'history' };
  const data = { b: 2, branches: ['x'] };
  assert.deepEqual(buildProjForSave(existing, data, 'p', NOW),
    { a: 1, name: 'E', b: 2, id: 'p', updatedAt: NOW });
});
