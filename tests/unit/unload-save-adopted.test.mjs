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
/* ★FLUSH-EMPTY(245e8b158) — 즉시 저장(flushSave)의 LS 쓰기가 날 setItem → safeLocalStorageSet(큰 본 던짐 방지)로 바뀌어 닻 글자만 옮겼다.
 *   잣대는 그대로: 그 쓰기 «앞 500자 안»에 짝 적용(applyAdoptedAssets)이 있어야 한다(flushSave 는 바로 두 줄 위에 있다). */
test('자동저장·즉시 저장·종료 저장: localStorage 본과 비상 사본에 쓸 snap 도 옮겨 둔 짝을 적용한다', () => {
  const apply = /if \(applyAdoptedAssets\((?:snapData|data), (?:activeProjectId|quitId)\)\) snap = JSON\.stringify\((?:snapData|data)\);/;
  for (const [name, anchor] of [['자동저장', 'const saveOk = safeLocalStorageSet(getSaveKey(), snap);'], ['즉시 저장', 'if (safeLocalStorageSet(getSaveKey(), snap)) localStorage.setItem(getSaveTsKey(), String(Date.now()));'], ['종료 저장', 'result = await saveProjectToFile(snapData, { skipThumbnail: true });']]) {
    const at = src.indexOf(anchor);
    assert.ok(at > 0, name);
    assert.match(src.slice(Math.max(0, at - 500), at), apply, name);
  }
});
