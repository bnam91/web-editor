/* storage-flush-ipc-331 — 렌더러 입구와 메인 손잡이가 같은 통로인가. 실제 디스크 반영은 앱 값(회신 imac-gd-L3-CLOSE). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (f) => fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8');
test('preload 의 flushLocalStorage ↔ main 의 storage:flush → flushStorageData', () => {
  assert.match(read('preload.js'), /flushLocalStorage:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('storage:flush'\)/);
  assert.match(read('main.js'), /ipcMain\.handle\('storage:flush',[^\n]*flushStorageData\(\)/);
});
