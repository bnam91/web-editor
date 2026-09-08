/* autosave-unsuppress.test.js — 자동저장 억제가 «영영» 안 풀리던 것 (2026-09-08 실측 사고)
 *
 * ★증상: 「프로젝트 여는 데 2분」. 어제 120초 타임아웃 4연속, 오늘 58~92초.
 *   ⛔가설을 세 번 세우고 세 번 틀렸다(크기 탓 · 고정 지연 · 활성삭제 탓). 전부 재서 깨졌다.
 *
 * ★진짜 원인:
 *   applyProjectData 가 `state._suppressAutoSave` 를 켜고, 푸는 것을 «rAF 하나»에만 맡겼다.
 *   브라우저는 창이 «가려지면»(visibilityState:'hidden') rAF 를 아예 안 돌린다 —
 *   실측: hidden 창에서 3초를 기다려도 «한 번도» 안 돌았다.
 *   ⇒ ⑴그 창의 편집이 «저장되지 않는다»(고착이 곧 데이터 손실)
 *     ⑵open_project 는 autosaveArmed 를 기다리므로 상한 120초를 꽉 채운다
 *
 * ★판정(같은 조건에서 두 번 재서):
 *     안전망 «없음» → 120.0초 load_timeout
 *     안전망 «있음» →   0.7초 ok
 *
 * ⛔이 파일은 이미 같은 병을 앓고 처방을 적어 뒀다 — `_AUTOSAVE_DEFER_MAX_MS` 옆:
 *   「고착이 곧 데이터 손실이다 … 재개 경로를 «셋» 둔다」. 그런데 이 경로엔 안전망이 «없었다».
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { readSrc } = require('./_srcread.js');   // ⛔CRLF — win-portability ①-3

const ROOT = path.join(__dirname, '..', '..');
const SL = readSrc(ROOT, 'js', 'io', 'save-load.js');

/** applyProjectData 의 finally 블록만 잘라온다 */
function releaseBlock() {
  const i = SL.indexOf('state._suppressAutoSave = true;');
  assert.ok(i > 0, '★억제를 «켜는» 자리가 없다 — 이 검사가 겨누는 대상이 사라졌다');
  const j = SL.indexOf('} finally {', i);
  assert.ok(j > i, '★finally 블록이 없다');
  return SL.slice(j, SL.indexOf('\n}\n', j));
}

test('A1 ★억제를 푸는 길이 «둘»이다 — rAF 하나면 가려진 창에서 영영 안 풀린다', () => {
  const b = releaseBlock();
  assert.match(b, /requestAnimationFrame\(/,
    '★rAF 를 없앴다 — 그건 「한 프레임 뒤 = 잔여 mutation 흡수」라는 «뜻»이 있다. 지워선 안 된다');
  assert.match(b, /setTimeout\(/,
    '★안전망 타이머가 없다 — 창이 가려지면 rAF 가 «아예» 안 돌아 억제가 영영 안 풀린다 ' +
    '(실측: hidden 창 3초에 0회 · open_project 120초 타임아웃)');
});

test('A2 ★둘 중 «먼저 오는 쪽»만 푼다 — 두 번 풀면 뒤엣것이 남의 억제를 깬다', () => {
  const b = releaseBlock();
  /* 안전망이 늦게 와서 «다음 로드»의 억제를 풀어 버리면, 그 로드의 잔여 mutation 이 저장된다.
     ⇒ 한 번만 풀리는 빗장이 있어야 한다. */
  assert.match(b, /_released/, '★「이미 풀었나」를 기억하지 않는다 — 뒤늦은 타이머가 남의 억제를 깬다');
  assert.match(b, /if \(_released\) return;/, '★빗장이 «검사»되지 않는다');
});

test('A3 ★안전망이 «넉넉하되 짧다» — 길면 그동안 저장이 안 된다', () => {
  const b = releaseBlock();
  const m = b.match(/setTimeout\(_release,\s*(\d+)\)/);
  assert.ok(m, '★안전망 타이머를 못 찾겠다');
  const ms = Number(m[1]);
  assert.ok(ms >= 50 && ms <= 2000,
    `★안전망이 ${ms}ms 다 — 너무 짧으면 잔여 mutation 을 못 흡수하고, 너무 길면 그동안 편집이 저장되지 않는다`);
});

test('A4 ★같은 파일의 «형제 처방»과 어긋나지 않는다 — 고착엔 안전망을 둔다', () => {
  /* _autoSaveDeferred 는 이미 「어떤 경우에도 이보다 오래 미루지 않는다」는 상한을 갖고 있다.
     같은 병(고착)에 한쪽만 처방이 있으면, 없는 쪽이 다음 사고 자리다. */
  assert.match(SL, /_AUTOSAVE_DEFER_MAX_MS\s*=\s*\d+/,
    '전제: 형제 기제의 안전망이 있어야 이 비교가 성립한다');
  assert.match(SL, /고착이 곧 데이터 손실/,
    '전제: 이 파일이 그 원칙을 «적어 두고» 있어야 한다');
});
