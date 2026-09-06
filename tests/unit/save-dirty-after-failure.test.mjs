/* U-W3B — ★저장이 «실패»했으면 그 사실이 종료까지 살아 있어야 한다 (W-3 방아쇠)
 *
 * ★윈도우 실기 회귀가 잡은 것 — 같은 빌드에서 «닫는 순서»로 결과가 갈렸다
 *   B. 편집 «직후»(10ms) 닫기 = 디바운스 전 → hasUnsaved=true → 다이얼로그·마커·비상사본 ✅
 *   A. 「⚠️ 저장 실패」를 «보고 나서» 닫기      → hasUnsaved=**false** → 전부 0건 ❌
 *   ⇒ 사용자가 실제로 하는 순서는 A 다. 가장 흔한 경로에서 여전히 조용히 죽고 있었다.
 *
 * ★원인은 «두 줄이 맞물린 것»
 *   ⑴ save-load.js  `_result = await _doSaveProjectToFile(...)` 다음 줄이 결과를 «안 보고»
 *      `_dirtySinceSave = false` 했다. 그런데 _doSaveProjectToFile 은 EPERM 을
 *      throw 가 아니라 `{ok:false, reason:'exception'}` 을 «반환»한다.
 *   ⑵ beforeunload 가 `if (!_dirtySinceSave && ...) return;` 으로 조기 return
 *   ⇒ `projects:save-sync` 가 «아예 안 불린다» → 메인의 기록도 없고 → before-quit 의
 *     W-3 분기가 입력(pending)을 못 받고 그냥 종료.
 *   ★★가드는 옳은 자리에 있었다. 없던 건 «방아쇠»다.
 *
 * ⛔「다이얼로그가 떴나」로만 재지 않는다 — 그 «앞 사슬»이 끊긴 게 이번 병이다.
 *   여기서는 **`saveProjectSync` 가 실제로 불렸는가**를 «세어» 재고, 그 앞에 있는
 *   dirty·hasUnsavedChanges 를 따로 잰다(양끝을 따로).
 * ⛔손으로 쓴 모델이 아니라 «진짜 js/io/save-load.js»를 진짜 import 그래프째 싣는다
 *   (frame-geometry.test.mjs 관례: 소스를 «바이트 그대로» 옮겨 ESM 으로 적재.
 *    js/ 는 package type=commonjs 아래라 트리를 통째로 임시 폴더에 복사하고
 *    거기에만 {"type":"module"} 을 둔다 — 저장소는 안 건드린다).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

/* ── 최소 DOM/Electron 스텁 ────────────────────────────────────────────── */
/** 캔버스 «내용» — getSerializedCanvas 의 cloneNode(true).innerHTML 이 이걸 돌려준다.
 *  이게 비면 _isAllCanvasEmpty 가 참이라 저장 자체가 «보호성 스킵»으로 빠진다. */
let CANVAS_HTML = '';
/** 화면의 자동저장 인디케이터 — «사용자가 읽는 문구»를 여기서 잰다. */
let INDICATOR = null;

const el = () => ({
  style: { setProperty() {}, removeProperty() {}, getPropertyValue: () => '' },
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  dataset: {}, setAttribute() {}, getAttribute: () => null,
  appendChild() {}, removeChild() {}, insertBefore() {}, remove() {},
  querySelector: () => null, querySelectorAll: () => [], closest: () => null,
  addEventListener() {}, removeEventListener() {},
  innerHTML: '', textContent: '', children: [], childNodes: [],
  scrollTop: 0, scrollLeft: 0, offsetWidth: 0, offsetHeight: 0,
  getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }),
  cloneNode: () => ({ ...el(), innerHTML: CANVAS_HTML }),
});

INDICATOR = el();

/** ★프로세스당 «한 번만» 싣는다(ESM 모듈 캐시). 시험마다 상태만 씻는다. */
const H = await (async function boot() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-w3b-'));
  fs.cpSync(path.join(ROOT, 'js'), path.join(tmp, 'js'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');

  const events = {};
  const calls = { saveProject: [], saveProjectSync: [] };
  let saveProjectBehavior = () => ({ ok: true });

  globalThis.document = {
    addEventListener() {}, removeEventListener() {},
    querySelector: () => el(), querySelectorAll: () => [],
    /* ★인디케이터는 «같은» 엘리먼트여야 화면 문구를 읽을 수 있다(매번 새로 주면 못 잰다). */
    getElementById: (id) => (id === 'autosave-indicator' ? INDICATOR : el()),
    createElement: () => el(), createTextNode: () => el(),
    body: el(), documentElement: el(), head: el(),
  };
  globalThis.window = {
    location: { search: '?project=proj_w3b', href: '' },
    addEventListener: (t, f) => { events[t] = f; }, removeEventListener() {}, dispatchEvent() {},
    serializeCleanRoot() {},          // 플레인 스크립트라 원래 window 에 있다
    electronAPI: {
      isElectron: true,
      onForceSaveBeforeQuit() {}, quitReady() {},
      loadProject: async () => ({}),
      loadProjectMeta: async () => ({}), saveProjectMeta: async () => ({ ok: true }),
      /* ★EPERM 은 «던진다» — 실기 그대로(Error invoking remote method 'projects:save': EPERM).
         _doSaveProjectToFile 은 이걸 잡아 { ok:false, reason:'exception' } 을 «반환»한다.
         ⇒ 던지지 «않는» 실패라서 옛 코드가 못 봤다. 그게 이 병의 시작이다. */
      saveProject: async (p) => { calls.saveProject.push(p); return saveProjectBehavior(); },
      saveProjectSync: (p) => { calls.saveProjectSync.push(p); return { ok: false, reason: 'exception', message: 'EPERM' }; },
    },
  };
  globalThis.localStorage = {
    _m: new Map(),
    getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
    setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); },
  };
  globalThis.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return []; } };
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} };
  globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '', display: 'block' });
  Object.defineProperty(globalThis, 'navigator', { value: { platform: 'MacIntel', userAgent: 'node' }, configurable: true });

  /* ★globals.js 는 «같은 인스턴스»다 — save-load.js 가 쓰는 state 를 검사가 그대로 만진다. */
  const G = await import(pathToFileURL(path.join(tmp, 'js/globals.js')).href);
  await import(pathToFileURL(path.join(tmp, 'js/io/save-load.js')).href);
  fs.rmSync(tmp, { recursive: true, force: true });

  return {
    w: globalThis.window, events, calls, state: G.state,
    setSaveBehavior: (fn) => { saveProjectBehavior = fn; },
    reset() {
      calls.saveProject.length = 0; calls.saveProjectSync.length = 0;
      saveProjectBehavior = () => ({ ok: true });
      CANVAS_HTML = '';
    },
  };
})();

const PROJECT_ID = 'proj_w3b';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** ★「편집하고, 자동저장이 «끝까지 돌게» 둔다」 — 실기의 A 경로 그대로.
 *   편집 → 디바운스 1.5s → saveProjectToFile → 결과에 따라 인디케이터/ dirty.
 *   ⛔디바운스를 «지나가게» 두는 게 핵심이다: autoSaveTimer 가 살아 있으면
 *     hasUnsavedChanges() 도 beforeunload 가드도 그것만 보고 통과해 «버그가 가려진다».
 *     (B 경로 = 편집 직후 닫기 가 바로 그 상태다 — 그래서 B 만 살아 있었다.) */
async function editAndLetAutosaveRun(token) {
  CANVAS_HTML = `<div class="section-block">${token}</div>`;
  H.state.pages = [{ id: 'p1', name: 'P1', canvas: '' }];
  H.state.currentPageId = 'p1';
  H.w.activeProjectId = PROJECT_ID;
  H.w.scheduleAutoSave();
  await wait(1800);
}

/* ═══ A 경로 — 「저장 실패」를 «보고 나서» 닫는다 (사용자가 하는 순서) ═══ */

test('W3B-1 ★저장이 실패하면 «미저장 없음»이라고 말하지 않는다 (hasUnsavedChanges)', async () => {
  H.reset();
  H.setSaveBehavior(() => { throw new Error("Error invoking remote method 'projects:save': EPERM"); });
  await editAndLetAutosaveRun('QA-W3B-A-1');

  assert.equal(H.calls.saveProject.length, 1, '전제 실패: 자동저장이 저장을 시도조차 안 했다');
  assert.equal(H.w.hasUnsavedChanges(), true,
    '⛔저장이 EPERM 으로 실패했는데 hasUnsavedChanges()=false — 「미저장 없음」이라고 거짓말한다');
});

test('W3B-2 ★★A 경로: 실패를 «보고 나서» 닫으면 projects:save-sync 가 «실제로 불린다»', async () => {
  H.reset();
  H.setSaveBehavior(() => { throw new Error('EPERM'); });
  await editAndLetAutosaveRun('QA-W3B-A-2');
  assert.equal(H.calls.saveProjectSync.length, 0, '전제: 아직 종료 저장 전이어야 한다');

  H.events.beforeunload();            // ← X 버튼 / 새로고침이 여기로 온다

  assert.equal(H.calls.saveProjectSync.length, 1,
    `⛔save-sync 가 ${H.calls.saveProjectSync.length}회 — 방아쇠가 안 당겨졌다. ` +
    '메인은 실패를 «알 방법»이 없고 before-quit 의 W-3 가드는 입력(pending)을 못 받는다');
  const sent = H.calls.saveProjectSync[0];
  assert.equal(sent.id, PROJECT_ID, '엉뚱한 프로젝트를 보냈다: ' + sent.id);
  assert.ok(JSON.stringify(sent).includes('QA-W3B-A-2'), '⛔마지막 편집이 안 실려 갔다 = 유실');
});

test('W3B-3 ★양성대조: 저장이 «성공»했으면 dirty 가 지워지고 save-sync 는 «안» 불린다', async () => {
  H.reset();                                   // saveProject → { ok:true }
  await editAndLetAutosaveRun('QA-W3B-OK');
  assert.equal(H.calls.saveProject.length, 1, '전제 실패: 자동저장이 안 돌았다');
  assert.equal(H.w.hasUnsavedChanges(), false, '성공했는데 dirty 가 남았다 — 종료가 매번 느려진다');

  H.events.beforeunload();
  assert.equal(H.calls.saveProjectSync.length, 0,
    `⛔성공 뒤에도 save-sync 가 ${H.calls.saveProjectSync.length}회 — 정상 종료가 느려진다`);
});

test('W3B-4 ★«보호성 스킵»(빈 캔버스)은 실패가 아니다 — dirty 를 물고 있지 않는다', async () => {
  H.reset();
  H.setSaveBehavior(() => { throw new Error('EPERM'); });
  await editAndLetAutosaveRun('QA-W3B-SKIP');
  assert.equal(H.w.hasUnsavedChanges(), true, '전제: 실패 뒤엔 dirty');

  /* 탭 전환·버전 되돌리기가 «빈 캔버스»로 부르는 자리 — 저장을 «일부러» 건너뛴다.
     ⇒ 디스크엔 직전 정상본이 그대로 있다. 이건 실패가 아니다. */
  const r = await H.w.saveProjectToFile(JSON.stringify({ pages: [{ id: 'p1', canvas: '' }] }),
    { skipThumbnail: true, projectId: PROJECT_ID });
  assert.equal(r && r.skipped, true, '전제 실패: 빈 캔버스가 스킵으로 안 돌아왔다: ' + JSON.stringify(r));
  assert.equal(H.w.hasUnsavedChanges(), false,
    '⛔스킵을 실패로 세면 새 프로젝트가 영원히 dirty 다(탭 전환마다 헛저장 · 공지 영구 억제)');
});

test('W3B-5 ★실패 뒤 «성공»하면 그때 지워진다 (되돌아오는 길이 막히지 않았나)', async () => {
  H.reset();
  H.setSaveBehavior(() => { throw new Error('EPERM'); });
  await editAndLetAutosaveRun('QA-W3B-R1');
  assert.equal(H.w.hasUnsavedChanges(), true, '전제: 실패 뒤엔 dirty');

  H.setSaveBehavior(() => ({ ok: true }));     // 권한 복구
  await editAndLetAutosaveRun('QA-W3B-R2');
  assert.equal(H.w.hasUnsavedChanges(), false, '⛔복구됐는데 dirty 가 안 지워진다 — 영원히 종료가 느려진다');

  H.calls.saveProjectSync.length = 0;
  H.events.beforeunload();
  assert.equal(H.calls.saveProjectSync.length, 0, '⛔복구 뒤에도 종료 저장을 계속 시도한다');
});

/* ═══ ⛔폭주 — 미니4호기가 짚은 위험 ═══════════════════════════════════ */

test('W3B-6 ⛔저장 실패가 «스스로» 재시도를 낳지 않는다 (가만히 둬도 안 는다)', async () => {
  H.reset();
  H.setSaveBehavior(() => { throw new Error('EPERM'); });
  await editAndLetAutosaveRun('QA-W3B-LOOP');
  const after = H.calls.saveProject.length;
  assert.equal(after, 1, `⛔편집 1회에 저장 시도 ${after}회 — 이미 새고 있다`);

  await wait(3000);                              // 디바운스(1.5s)의 두 배를 «가만히» 둔다
  assert.equal(H.calls.saveProject.length, 1,
    `⛔가만히 뒀는데 저장 시도가 1→${H.calls.saveProject.length} 로 늘었다 = 폭주. ` +
    '백오프나 「연속 N회 실패 후 중단」이 필요하다');
  assert.equal(H.w.hasUnsavedChanges(), true, '그러면서도 dirty 는 «남아 있어야» 한다');

  /* 「편집 N회 = 시도 N회」 — dirty 가 재무장의 입력이 «아니라는» 것의 직접 증거.
     (자동저장을 다시 쏘는 자리는 scheduleAutoSave 하나이고 편집만 그걸 부른다) */
  for (let i = 0; i < 3; i++) {
    await H.w.saveProjectToFile(JSON.stringify({ pages: [{ id: 'p1', canvas: `<div class="section-block">n${i}</div>` }] }),
      { skipThumbnail: true, projectId: PROJECT_ID });
  }
  assert.equal(H.calls.saveProject.length, 4, `저장 호출 3회 뒤 시도 ${H.calls.saveProject.length}회(기대 4)`);
});

/* ═══ 같은 뿌리를 쓰는 «다른 소비처» — 세어 보고 넣었다 ════════════════
   범위: js 아래 모든 .js + main.js + preload.js + index.html 전수 grep
   ⇒ hasUnsavedChanges() 소비처는 «둘»이다. 둘 다 같은 거짓말을 앓고 있었다. */

test('W3B-7 ★탭 전환의 「변경 없으면 저장 생략」이 실패 상태에서 «생략하지 않는다»', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/tab-system.js'), 'utf8');
  assert.ok(/hasUnsavedChanges\?\.\(\)\s*\?\?\s*true/.test(src),
    '탭 전환이 더는 hasUnsavedChanges 를 안 쓴다 — 이 검사의 전제가 바뀌었다(범위를 다시 세라)');
  H.reset();
  H.setSaveBehavior(() => { throw new Error('EPERM'); });
  await editAndLetAutosaveRun('QA-W3B-TAB');
  assert.equal(H.w.hasUnsavedChanges(), true,
    '⛔실패 상태인데 탭 전환이 「변경 없음」으로 읽어 그 프로젝트를 «다시 안 쓴다»');
});

test('W3B-8 ★공지 억제(notice.js)도 같은 값을 본다 — 실패 상태를 「미저장」으로 센다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/notice.js'), 'utf8');
  assert.ok(/hasUnsavedChanges\(\)\)\s*return\s*'unsaved'/.test(src),
    '공지 억제가 더는 hasUnsavedChanges 를 안 쓴다 — 전제가 바뀌었다(범위를 다시 세라)');
  assert.equal(H.w.hasUnsavedChanges(), true,
    '⛔저장 실패 중인데 「미저장 없음」이라 공지 모달이 덮고 들어온다');   // W3B-7 의 실패 상태를 이어받는다
});

/* ═══ 벨트가 «진짜로» 막는 자리 ═════════════════════════════════════════
   ★_dirtySinceSave 는 «전역» 하나인데 _lastSaveResult 는 «프로젝트별»이다.
     ⇒ 내 탭의 저장이 실패한 뒤 «다른 탭»의 저장이 성공하면 그 전역 플래그가 지워진다.
       그러면 근본 수정(결과를 보고 지운다)만으로는 내 실패가 «잊힌다».
     ⇒ 탭 전환이 실제로 이 순서를 만든다(js/tab-system.js 가 이전 탭을 비동기로 저장한다).
   ⛔이 시험이 없으면 벨트는 «지워도 아무도 모르는 줄»이다 — 변이 ㉸ 로 실제로 확인했다. */

test('W3B-9 ★★다른 탭의 «성공»이 내 탭의 «실패»를 지워도 종료 저장은 여전히 시도된다 (벨트)', async () => {
  H.reset();
  H.setSaveBehavior(() => { throw new Error('EPERM'); });
  await editAndLetAutosaveRun('QA-W3B-BELT');            // 현재 탭(proj_w3b) 저장 실패
  assert.equal(H.w.hasUnsavedChanges(), true, '전제: 실패 뒤엔 dirty');

  // «다른» 프로젝트가 성공적으로 저장된다 — dirty 는 전역이라 여기서 지워진다
  H.setSaveBehavior(() => ({ ok: true }));
  await H.w.saveProjectToFile(
    JSON.stringify({ pages: [{ id: 'p1', canvas: '<div class="section-block">other</div>' }] }),
    { skipThumbnail: true, projectId: 'proj_other_tab' });
  assert.equal(H.w.hasUnsavedChanges(), false,
    '전제 실패: 전역 dirty 가 안 지워졌다 — 이 시험의 전제(전역 vs 프로젝트별)가 바뀌었다');

  H.calls.saveProjectSync.length = 0;
  H.events.beforeunload();
  assert.equal(H.calls.saveProjectSync.length, 1,
    '⛔dirty 가 지워졌다고 그냥 나갔다 — 이 탭의 마지막 저장은 «실패»로 끝난 걸 알면서도');
  assert.ok(JSON.stringify(H.calls.saveProjectSync[0]).includes('QA-W3B-BELT'),
    '⛔종료 저장이 이 탭의 마지막 편집을 안 실었다');
});


test('W3B-10 ★화면도 «실패»라고 말한다 — 인디케이터가 빨강(⚠️ 저장 실패)이 된다', async () => {
  H.reset();
  H.setSaveBehavior(() => { throw new Error('EPERM'); });
  await editAndLetAutosaveRun('QA-W3B-IND');
  assert.equal(INDICATOR.className, 'error', `인디케이터 class=${INDICATOR.className}`);
  assert.equal(INDICATOR.textContent, '⚠️ 저장 실패', `인디케이터 문구=${INDICATOR.textContent}`);
  /* ★★그리고 «그 순간» hasUnsavedChanges 도 true 여야 한다 —
     실기 회귀의 정확한 증상이 「빨강인데 hasUnsaved=false」였다. 둘을 «같이» 잰다. */
  assert.equal(H.w.hasUnsavedChanges(), true,
    '⛔화면은 빨강인데 코드는 「미저장 없음」이라고 한다 — 이 어긋남이 W-3 를 죽였다');

  H.setSaveBehavior(() => ({ ok: true }));
  await editAndLetAutosaveRun('QA-W3B-IND-OK');
  assert.equal(INDICATOR.className, 'saved', '복구했는데 빨강이 안 풀린다');
  assert.equal(H.w.hasUnsavedChanges(), false, '복구했는데 dirty 가 남는다');
});
