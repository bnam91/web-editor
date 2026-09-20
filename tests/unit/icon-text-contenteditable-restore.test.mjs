/* U-ITBCE — 「복원 뒤에도 아이콘+텍스트 블럭이 편집 표식을 되찾는가」의 «변이 책임».
 *
 * 숫자·행동은 tests/dom/icon-text-panel-after-restore.dom.spec.js 가 진짜 패널로 잰다.
 * 그런데 tests/dom 은 `npm test` 스위트에 «안» 들어간다 ⇒ 되돌려도 조용히 지나간다.
 * 그래서 이 결함의 «문 둘»을 여기 박는다 — 하나만 닫으면 신고가 다른 문으로 그대로 산다.
 *   문① js/io/save-load.js rebindAll 의 «되붙이는 자리»  (모든 복원 경로의 공통 길목)
 *   문② js/props/prop-text.js 의 «읽는 쪽 fallback»      (패널이 조용히 포기하던 자리)
 * ＋전제① 스냅샷이 contenteditable 을 «떼는» 것은 의도다 — 그 전제가 바뀌면 이 검사부터 고쳐라.
 *
 * ★실앱 실측 근거 (2026-09-20, 9505 / 줌 40% / 격리 프로필)
 *   아이콘+텍스트 삽입 → ⌘Z 한 번 → .itb-text 의 contenteditable 이 null 이 되고
 *   그 뒤 블럭을 클릭해도 우측 패널이 «영영» 안 열렸다(#txt-overlay-toggle 0개).
 *   같은 ⌘Z 를 맞은 .tb-h2 · .tb-bubble 은 "false" 를 유지했다 — 문① 이 그 둘만 돌기 때문.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
/* ⛔주석 거르개를 여기서 «새로 만들지» 않는다 — 공용 부품 하나뿐이다(S-6 가드가 잡는다).
   손으로 적은 `/\*[\s\S]*?\*\//` 는 `accept="image/*"` 뒤를 통째로 삼켜 검사를 거짓 초록으로 만든다. */
import { stripComments } from './_strip-comments.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

const SAVELOAD  = stripComments(read('js', 'io', 'save-load.js'));
const PROPTEXT  = stripComments(read('js', 'props', 'prop-text.js'));
const SERIALIZE = stripComments(read('js', 'io', 'section-serialize.js'));

test('전제① 스냅샷은 contenteditable 을 «전부» 뗀다 (이게 사실이라 되붙임이 필요하다)', () => {
  assert.match(SERIALIZE, /querySelectorAll\('\[contenteditable\]'\)[\s\S]{0,80}removeAttribute\('contenteditable'\)/,
    '★세척이 사라졌다 — 그렇다면 되붙임(문①②)의 «이유»가 바뀐 것이니 이 검사부터 다시 써라');
});

test('문① rebindAll 이 .icon-text-block 의 본문 칸에 편집 표식을 되붙인다', () => {
  const i = SAVELOAD.indexOf(".querySelectorAll('.icon-text-block')");
  assert.notStrictEqual(i, -1,
    '★복원 경로에 .icon-text-block 갈래가 없다 — ⌘Z 한 번이면 그 블럭의 우측 패널이 영영 안 열린다');
  /* 그 갈래가 «본문 칸»에 «편집 표식»을 되붙이는지까지 본다 — 이름만 스쳐도 통과하면 뜻이 없다. */
  const branch = SAVELOAD.slice(i, i + 600);
  assert.match(branch, /itb-text/, '★그 갈래가 본문 칸(.itb-text)을 안 집는다');
  assert.match(branch, /setAttribute\('contenteditable',\s*'false'\)/,
    '★그 갈래가 contenteditable 을 안 되붙인다');
  assert.match(branch, /hasAttribute\('contenteditable'\)/,
    '★이미 있는 값을 덮어쓰지 않는지(편집 중 true 를 false 로 밟지 않는지) 확인하는 가드가 없다');
});

test('문② showTextProperties 의 fallback 이 .itb-text 를 «센다»', () => {
  const i = PROPTEXT.indexOf('export function showTextProperties');
  assert.notStrictEqual(i, -1, '★showTextProperties 를 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라');
  const head = PROPTEXT.slice(i, i + 900);
  assert.match(head, /\.tb-h1[^']*\.itb-text/,
    '★읽는 쪽 fallback 목록에 .itb-text 가 없다 — 복원본에서 패널이 조용히 return 한다');
  assert.match(head, /\[contenteditable\]/,
    '★1순위(살아 있는 편집 표식)가 사라졌다 — fallback 만 남으면 편집 중 칸을 못 집는다');
});

test('가드 — 되붙임은 «표식 하나»만 한다 (tb-* 전용 보정을 베껴오지 않았다)', () => {
  /* placeholder·bullet·blank 보정은 tb-* 의 규약이다. .itb-text 는 평문 한 칸이라
     그 보정이 들어오면 「본문이 placeholder 로 덮이는」 새 병이 생긴다.
     ⚠️바람직함이 아니라 «지금 이렇다»는 기록이다 — 아이콘텍스트에도 placeholder 를
       주기로 결정되면 그때 이 검사부터 뒤집어라. */
  /* ⚠️구간은 «다음 갈래 시작»까지로 끊는다 — 고정 길이로 자르면 바로 뒤 .text-block 갈래의
     _phTextMap 을 제 것으로 오해해 늘 빨강이 된다(이 검사를 처음 쓸 때 실제로 그랬다). */
  const i = SAVELOAD.indexOf(".querySelectorAll('.icon-text-block')");
  const j = SAVELOAD.indexOf(".querySelectorAll('.text-block')", i);
  assert.ok(j > i, '★아이콘텍스트 갈래 뒤에 .text-block 갈래가 없다 — 구간 판정이 낡았다');
  const branch = SAVELOAD.slice(i, j);
  assert.ok(!/_phTextMap|isPlaceholder|tb-bullet/.test(branch),
    '★아이콘텍스트 갈래에 tb-* 전용 보정이 섞였다');
});
