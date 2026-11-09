/* SKILL-IMAGES-TO-SCRATCHPAD-AWAIT-RESULT-01 — 이미지 넣기 스킬이 저장 실패를 «완료»로 찍지 않는다.
 * skill.md 안 스크립트에서 «페이지 쪽 함수»와 saveFailed 판정을 꺼내 가짜 window/Image 로 돌린다.
 * S1 ok:false 면 결과에 그 save 가 실리고 saveFailed=true · S2 옛 판(결과 없음)·ok:true 는 성공(기존 성공 경로 무변)
 * S3 저장 약속이 «기다려진다»(늦게 끝나는 저장의 결과가 실린다) · S4 저장이 던지면 페이지 함수가 거절(→ 스크립트 SKIP).
 * 변이: 고치기 전 skill.md(save 를 안 기다림·saveFailed 없음)면 S1·S3·S4 빨강. SKILL_MD 환경변수로 다른 판을 잴 수 있다. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const MD = process.env.SKILL_MD || new URL('../../main/claude-pm/skills/goditor-images_to_scratchpad/skill.md', import.meta.url);
const src = fs.readFileSync(MD, 'utf8');
const pageFn = src.match(/result = await evaluate\(ws, `(\(src, x, y, w\) => new Promise[\s\S]*?\}\))`/)?.[1];
const saveFailedSrc = src.match(/const saveFailed = (\(save\) => [^;]+);/)?.[1];

function runPage(saveImpl, { imgOk = true } = {}) {
  assert.ok(pageFn, '[전제] skill.md 에서 페이지 함수를 꺼냈다');
  class FakeImage { set src(_) { queueMicrotask(() => (imgOk ? (this.naturalWidth = 200, this.naturalHeight = 100, this.onload()) : this.onerror())); } }
  const window = { _scratchAddAndSave: saveImpl };
  const fn = new Function('window', 'Image', `return (${pageFn});`)(window, FakeImage);
  return fn('data:x', 0, 0, 220);
}
const saveFailed = (s) => { assert.ok(saveFailedSrc, '[전제] saveFailed 판정이 있다'); return new Function(`return (${saveFailedSrc});`)()(s); };

test('S1 저장이 ok:false 를 돌려주면 결과에 실리고 실패로 센다', async () => {
  const r = await runPage(async () => ({ ok: false, reason: 'memory-only' }));
  assert.equal(r?.save?.ok, false);
  assert.equal(saveFailed(r.save), true);
});

test('S2 옛 판(결과 없음)·ok:true 는 그대로 성공', async () => {
  const r0 = await runPage(() => undefined);
  assert.equal(r0.displayH, 110);
  assert.equal(saveFailed(r0.save), false);
  const r1 = await runPage(async () => ({ ok: true, id: 'a' }), { imgOk: false });
  assert.equal(saveFailed(r1.save), false);
});

test('S3 저장 약속을 기다린다 — 늦게 끝나는 저장의 결과가 실린다', async () => {
  const r = await runPage(() => new Promise((res) => setTimeout(() => res({ ok: false, reason: 'loading' }), 30)));
  assert.equal(r?.save?.reason, 'loading');
});

test('S4 저장이 던지면 페이지 함수가 거절한다(스크립트는 SKIP·실패로 셈)', async () => {
  await assert.rejects(runPage(async () => { throw new Error('boom'); }));
});
