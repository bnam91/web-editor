/* e127-guard-golden.test.mjs — E127 이 바꾼 바이트 골든(tpl-pagepad-e81 T3)의 갱신이 «글자색 토큰만»인가를 기계로 단언 (2026-10-06 lane-esweep · 지디 E127-guards)
 *   E127(c16bbccc): 그리드 역할색 color:#hex → color:var(--preset-<역할>-color, #hex) — 폴백 hex 그대로 ⇒ 프리셋 덮기 없으면 같은 픽셀.
 *   골든 규칙: 지운 줄은 글자색 토큰만 다르다 · 다른 바이트가 하나라도 다르면 빨강.
 *   기준 = 골든을 마지막으로 뜬 커밋 d05a58e9(핀 4df20f78 판을 integ14 에 들인 그 파일).
 * 양성대조(이 파일 안): 갱신본에서 글자색 «아닌» 바이트 하나를 바꾸면 같은 판정이 «다름»을 내야 한다 — 판정기가 눈멀지 않았나. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REL = 'tests/dom/fixtures/tpl-pagepad-e81-golden.json';
const PIN = 'd05a58e9';
const ROLE_TOKEN = /color:var\(--preset-(?:h1|h2|h3|body|caption)-color, (#[0-9a-fA-F]{6})\);/g;

/* 판정기 — 두 골든이 «글자색 토큰만» 다른가. 돌려주는 값: { ok, tokens, why } */
function onlyRoleColorDiffers(oldG, newG) {
  const ko = Object.keys(oldG).sort(), kn = Object.keys(newG).sort();
  if (JSON.stringify(ko) !== JSON.stringify(kn)) return { ok: false, tokens: 0, why: `키가 다르다 ${ko} vs ${kn}` };
  let tokens = 0;
  for (const k of ko) {
    if (oldG[k] === newG[k]) continue;
    const back = newG[k].replace(ROLE_TOKEN, (_, hex) => { tokens++; return `color:${hex};`; });
    if (back !== oldG[k]) {
      let j = 0; while (j < back.length && back[j] === oldG[k][j]) j++;
      return { ok: false, tokens, why: `${k} @${j}: 토큰 말고도 다르다 now=${JSON.stringify(back.slice(Math.max(0, j - 30), j + 40))} pin=${JSON.stringify(oldG[k].slice(Math.max(0, j - 30), j + 40))}` };
    }
  }
  return { ok: true, tokens, why: '' };
}

const oldG = JSON.parse(execFileSync('git', ['show', `${PIN}:${REL}`], { cwd: REPO, encoding: 'utf8' }));
const newG = JSON.parse(fs.readFileSync(path.join(REPO, REL), 'utf8'));

test('E127-G1 T3 골든 갱신 = 그리드 역할색 토큰만(2 자리 · grd-body) — 다른 바이트 0', () => {
  const r = onlyRoleColorDiffers(oldG, newG);
  assert.ok(r.ok, r.why);
  assert.equal(r.tokens, 2, '토큰 수 — grid 의 grd-body 줄 둘(E127 이 실제로 바꾼 곳 · 손 계산 아님: W0 실측 diff ×2 와 같은 꼴)');
  for (const k of Object.keys(oldG)) if (k !== 'grid') assert.equal(newG[k], oldG[k], `grid 말고는 한 바이트도 안 바뀐다 — ${k}`);
});

test('E127-G1 양성대조 — 글자색 아닌 바이트 하나를 바꾸면 판정기가 «다름»', () => {
  const mutated = { ...newG, grid: newG.grid.replace('grd-line grd-body', 'grd-line grd-bodx') };
  assert.notEqual(mutated.grid, newG.grid, '[전제] 변이가 실제로 걸렸다');
  assert.equal(onlyRoleColorDiffers(oldG, mutated).ok, false);
  const mutatedHex = { ...newG, grid: newG.grid.replace('var(--preset-body-color, #555555)', 'var(--preset-body-color, #555556)') };
  assert.equal(onlyRoleColorDiffers(oldG, mutatedHex).ok, false, '폴백 hex 가 바뀌면 «토큰만»이 아니다');
});
