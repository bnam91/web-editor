/* meta-fake-semantics.test.mjs — 경합 시험의 가짜 meta IPC(tests/dom/_fake-meta.js)가 main.js 와 «같은 의미»인지 소스로 잠근다.
 *   ⚠️행위가 아니라 소스 대조다 — main 핸들러를 실제로 돌리지 않는다(Electron 밖). 2026-10-02 태양(지디 승인 설계 ①). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.GD1001_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MAIN = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const FAKE = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dom', '_fake-meta.js'), 'utf8');

function handlerBody(src, channel) {
  const i = src.indexOf(`ipcMain.handle('${channel}'`);
  assert.ok(i >= 0, `★main.js 에서 ${channel} 핸들러를 못 찾았다 — 이 검사부터 고쳐라`);
  /* 끝 = «다음 핸들러»가 시작하는 자리(SB-16: 구간 끝을 «개행+닫는 괄호» 문자열로 찾지 않는다) */
  const next = src.indexOf('ipcMain.handle(', i + 1);
  return src.slice(i, next > i ? next : src.length);
}
test('F1 ★main 의 save-meta 는 «받는 순간» 파일을 동기로 읽어 { ...cur, ...metaData } 로 합친다', () => {
  const b = handlerBody(MAIN, 'projects:save-meta');
  assert.match(b, /readFileSync\(/, '동기 읽기가 없다 — 합치기 의미가 바뀌었다(가짜를 다시 맞춰라)');
  assert.match(b, /merged\s*=\s*\{\s*\.\.\.cur,\s*\.\.\.metaData\s*\}/, '★합치기 식이 { ...cur, ...metaData } 가 아니다 — 가짜(_fake-meta.js)와 의미가 갈린다');
  assert.doesNotMatch(b, /await\s/, 'save-meta 에 await 가 생겼다 — «동기 구간이라 안 섞인다»는 전제가 깨졌다');
});
test('F2 ★가짜도 같은 식으로 합치고, load 는 «부른 순간» 찍는다', () => {
  assert.match(FAKE, /\{\s*\.\.\.cur,\s*\.\.\.metaData\s*\}/, '가짜의 합치기 식이 main 과 다르다');
  const load = FAKE.slice(FAKE.indexOf("k === 'loadProjectMeta'"), FAKE.indexOf("k === 'saveProject')"));
  assert.ok(load.indexOf('const snap') >= 0 && load.indexOf('const snap') < load.indexOf('setTimeout'), '가짜 load 가 «돌려줄 때» 읽는다 — 경합이 안 생겨 거짓 초록이 된다(H8 교훈)');
});
