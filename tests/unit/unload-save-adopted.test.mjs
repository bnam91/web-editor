/* 동기 저장(창 닫기·새로고침)은 옮겨 둔 짝을 적용한 뒤 보낸다 — 안 하면 라이브 DOM 의 옛 주소가 파일을 원본 프로젝트로 되돌린다(OOM-01 ①, 앱 값은 회신).
   실제 동작은 tests/dom/paste-foreign-asset(적용) · 앱 재현 ×3. 여기는 그 호출이 동기 저장 앞에 있는지만 잠근다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../js/io/save-load.js', import.meta.url), 'utf8');
test('beforeunload: applyAdoptedAssets 가 saveProjectSync 바로 앞이고 localStorage 본도 같이 바꾼다', () => {
  const at = src.indexOf('window.electronAPI.saveProjectSync(proj)');
  assert.ok(at > 0);
  assert.match(src.slice(at - 300, at), /if \(applyAdoptedAssets\(proj, activeProjectId\)\) snap = JSON\.stringify\(snapData\);/);
});
test('종료 저장: 새 옮기기를 먼저 멈춘다', () => {
  assert.match(src, /onForceSaveBeforeQuit\(async \(\) => \{\s*stopAdoptingForQuit\(\);/);
});
