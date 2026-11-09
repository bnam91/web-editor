/* foreign-asset-trash-read — FOREIGN-ASSET-ADOPT-GAPS-01 표의 공통 뿌리 칸(진짜 main)
 * 다른 프로젝트(A) 그림을 B 에 붙이면 B 화면·저장본은 A 주소(goya-asset://A/…)를 들고 있다가, 저장 때 adopt 가 A 파일을 읽어 B 로 복사한다.
 * 그런데 main 의 그림 읽기 두 자리(assets:readAsDataUri · goya-asset 프로토콜)는 «살아 있는 PROJECTS_DIR/<id>/assets» 만 본다.
 * A 를 지우면(기본 = 앱 휴지통 .trash/<id>/bundle/ 로 통째 이동) 파일은 휴지통에 그대로 있는데 못 읽는다
 *   ⇒ adopt 실패(②④⑥ 의 «나중 저장이 옮긴다» 도 실패) · 같은 세션 HTML 내보내기(readAsDataUri) 그림 빠짐(①).
 * 칸: F1 A 를 휴지통으로 보낸 뒤 A 그림을 readAsDataUri 로 읽힌다(기준판 빨강 = 뿌리 확정) · F2 [음성] A 를 영구 삭제하면 못 읽는다(되살릴 데가 없다 — 지금과 같음)
 *     F3 [음성] 살아 있는 A 는 지금처럼 읽힌다
 * ⚠️goya-asset 프로토콜(화면 표시)은 하네스가 app ready 를 안 돌려 못 잰다 — 같은 경로 규칙이라 코드로만.
 * 실행: node --test tests/unit/foreign-asset-trash-read.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { loadMain } = require('./_ipc-harness.js');
const H = loadMain();
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

async function projectWithAsset(id) {
  const saved = await H.invoke('assets:saveCanvasImage', { projectId: id, b64: PNG, mime: 'image/png' });
  assert.ok(saved && saved.ok && saved.url, `[전제] 그림 저장 실패 ${JSON.stringify(saved)}`);
  const r = await H.invoke('projects:save', { id, name: id, pages: [{ id: 'p1', canvas: `<div class="section-block"><img src="${saved.url}"></div>` }] });
  assert.equal(r && r.ok, true, '[전제] 프로젝트 저장 실패');
  const m = /^goya-asset:\/\/([^/]+)\/(.+)$/.exec(saved.url);
  return { projectId: m[1], filename: decodeURIComponent(m[2]) };
}

test('F1 ★원본 A 를 휴지통으로 보낸 뒤에도 A 그림이 읽힌다(adopt·내보내기·화면의 공통 뿌리)', async () => {
  const a = await projectWithAsset('proj_1788000000001');
  const del = await H.invoke('projects:delete', 'proj_1788000000001', {});
  assert.ok(del && (del.ok || del === true), `[전제] 휴지통 보내기 실패 ${JSON.stringify(del)}`);
  const r = await H.invoke('assets:readAsDataUri', a);
  assert.equal(r && r.ok, true, `⛔휴지통에 파일이 있는데 못 읽는다 — B 에 붙인 그림의 adopt·내보내기가 깨진다 ${JSON.stringify(r)}`);
  assert.ok(String(r.dataUri).startsWith('data:image/png;base64,'));
});

test('F2 [음성] 영구 삭제한 A 는 못 읽는다(지금과 같음)', async () => {
  const a = await projectWithAsset('proj_1788000000002');
  await H.invoke('projects:delete', 'proj_1788000000002', { permanent: true });
  const r = await H.invoke('assets:readAsDataUri', a);
  assert.notEqual(r && r.ok, true, '영구 삭제한 그림이 읽혔다');
});

test('F3 [음성] 살아 있는 A 는 지금처럼 읽힌다', async () => {
  const a = await projectWithAsset('proj_1788000000003');
  const r = await H.invoke('assets:readAsDataUri', a);
  assert.equal(r && r.ok, true);
});
