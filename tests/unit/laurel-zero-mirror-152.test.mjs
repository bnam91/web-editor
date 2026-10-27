/* laurel-zero-mirror-152.test.mjs — C 152·181 «0 을 먹는 기본값» laurel 가족의 «거울»(읽는 쪽) (지디 02:1x ⑶)
 *
 * 무엇을 잠그나: 패널이 «0 을 넣을 수 있다»고 말하는 키(바인더 min ≤ 0)는 laurel 렌더러·패널 어디서도 `|| 기본값` 으로 읽히지 않는다
 *   — 읽는 자리는 0 을 살리는 문 하나(grid-block.js gridNumOr)를 지난다. 패널이 0 을 못 넣는 키(min > 0 · height [20,600])는
 *   «0 = 기본»이 계약이라 0 을 살리는 문으로 읽지 않는다(⛔Number.isFinite·gridNumOr).
 * ★명부는 «파생»이다(⛔손 명부 0): prop-laurel.js 의 바인더 호출 `bindXxx('슬라이더', '숫자칸', '키', min, max)` 에서 키·min 을 뽑는다.
 *   센서스 = prop-laurel.js 의 input(type=number|range) 중 min ≤ 0 칸 — 바인더로 키를 못 뽑는 칸은 «⬜ 짝 없음» 으로 센다(이 판 0 칸).
 * ⛔무엇을 «안» 잠그나: 전역 거울(js/ 전체 · 152 본체)은 지디가 따로 세운다 · 화면에 그려진 값은 DOM 검사 c-laurel-zero-181 이 잰다.
 * 양성대조: 사본에서 읽기 한 자리를 옛 꼴(`parseInt(block.dataset.gridColGap) || 32`)로 되돌리면 M2 가 빨강. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PANEL = fs.readFileSync(path.join(ROOT, 'js/props/prop-laurel.js'), 'utf8');
const RENDER = fs.readFileSync(path.join(ROOT, 'js/blocks/laurel-block.js'), 'utf8');
const SRCS = { 'js/props/prop-laurel.js': PANEL, 'js/blocks/laurel-block.js': RENDER };

/* 바인더 호출 → { slider, number, key, min } */
const BINDS = [...PANEL.matchAll(/\bbind\w+\(\s*'([\w-]+)'\s*,\s*'([\w-]+)'\s*,\s*'(\w+)'\s*,\s*(-?\d+)\s*,\s*-?\d+\s*\)/g)]
  .map((m) => ({ slider: m[1], number: m[2], key: m[3], min: Number(m[4]) }));
/* 센서스 — min ≤ 0 인 입력 칸(id 또는 class 토큰) */
const ZERO_INPUTS = [...PANEL.matchAll(/<input\b[^>]*type="(?:number|range)"[^>]*>/g)].map((m) => m[0])
  .filter((t) => { const mn = /\bmin="(-?[\d.]+)"/.exec(t); return mn && Number(mn[1]) <= 0; })
  .map((t) => ((/\bid="([\w-]+)"/.exec(t) || [])[1]) || ((/\bclass="([^"]+)"/.exec(t) || [])[1] || '').split(/\s+/).find((c) => c.startsWith('lrl-')));
const zeroKeys = [...new Set(BINDS.filter((b) => b.min <= 0).map((b) => b.key))];
const posKeys = [...new Set(BINDS.filter((b) => b.min > 0).map((b) => b.key))].filter((k) => !zeroKeys.includes(k));

/* 그 키를 «먹는» 읽기: parseInt/parseFloat/Number( …KEY ) || 수 */
const eatRe = (k) => new RegExp(`(?:parseInt|parseFloat|Number)\\([^()]*\\b${k}\\)\\s*\\|\\|\\s*-?\\d`, 'g');
const finder = (re) => Object.entries(SRCS).flatMap(([f, s]) => [...s.matchAll(re)].map((m) => `${f}:${s.slice(0, m.index).split('\n').length}`));

test('M0 ★전제 — 명부가 소스에서 뽑힌다(바인더 ≥ 3 · min≤0 키 ≥ 1 · min>0 키 ≥ 1) · 짝 없는 칸 수', () => {
  assert.ok(BINDS.length >= 3, `바인더 호출을 ${BINDS.length}개밖에 못 뽑았다 — 자가 깨졌다`);
  assert.ok(zeroKeys.length >= 1 && posKeys.length >= 1, `키 파생 실패 zero=${zeroKeys} pos=${posKeys}`);
  const bound = new Set(BINDS.flatMap((b) => [b.slider, b.number]));
  const unpaired = ZERO_INPUTS.filter((id) => !bound.has(id));
  console.log(`[M0] 바인더 ${BINDS.length} · min≤0 키 [${zeroKeys}] · min>0 키 [${posKeys}] · min≤0 칸 ${ZERO_INPUTS.length} · ⬜ 짝 없음 ${unpaired.length}${unpaired.length ? ' ' + unpaired : ''}`);
  assert.ok(ZERO_INPUTS.length >= zeroKeys.length, '센서스가 바인더보다 적다 — 자를 의심하라');
});

test('M1 ★0 을 넣을 수 있는 키는 0 을 살리는 문(gridNumOr)으로 읽힌다 — 키마다 ≥ 1 자리', () => {
  const missing = zeroKeys.filter((k) => finder(new RegExp(`gridNumOr\\([^()]*(?:\\([^()]*\\))?[^()]*\\b${k}\\b`, 'g')).length === 0);
  assert.deepEqual(missing, [], `gridNumOr 로 안 읽는 키: ${missing}`);
});

test('M2 ★0 을 넣을 수 있는 키를 `|| 기본값` 으로 읽는 자리 0 (렌더러·패널)', () => {
  const eaters = zeroKeys.flatMap((k) => finder(eatRe(k)).map((at) => `${k} @ ${at}`));
  assert.deepEqual(eaters, [], '0 을 먹는 읽기가 남았다');
});

test('M3 ★0 을 못 넣는 키(height · 계약 [20,600])는 «0 = 기본» — 0 을 살리는 문으로 읽지 않는다', () => {
  const savers = posKeys.flatMap((k) => finder(new RegExp(`(?:Number\\.isFinite|gridNumOr)\\([^()]*(?:\\([^()]*\\))?[^()]*\\b${k}\\b`, 'g')).map((at) => `${k} @ ${at}`));
  assert.deepEqual(savers, [], 'height 를 0 을 살리는 문으로 읽는다 — 계약(0 = 기본)을 뒤집는다');
  const contract = posKeys.flatMap((k) => finder(new RegExp(`parseInt\\([^()]*\\b${k}\\)\\s*>\\s*0\\s*\\?`, 'g')));
  assert.ok(contract.length >= 3, `«h > 0 ? 지정 : 기본» 판정이 ${contract.length} 자리 — 렌더러 둘(:71 이주 · 칸) + 패널 하나여야`);
});
