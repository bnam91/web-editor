/* U-VIDEOPENDINGWARN — 「아직 «GIF로 적용» 안 한 영상은 저장에서 사라진다」 알림이
 *   ⑴ «한 자리»에서만 나오고 ⑵ «떠나는 자리 네 곳»에 전부 걸려 있고 ⑶ 편집 중에는 안 뜨는가.
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *   ⛔`node --test tests/unit`(디렉터리)로 부르지 마라 — 한 개도 안 도는데 「1 fail」처럼 보인다.
 *
 * ★무엇이 결함이었나 (T-032, dev 3f39b71 실측)
 *   알림이 «홈으로 나가기»(js/io/save-load.js goHome)와 «블럭 선택 해제»(js/editor.js) 두 곳에만
 *   있었다. 사용자가 영상을 넣고 적용을 안 한 채 **창을 닫거나 ⌘S 를 누르면** 아무 말 없이
 *   원본이 빠진 채 저장된다(세척: js/io/section-serialize.js T-012).
 *   ★재현(실앱 9551, 2026-09-21): 미확정 영상 1개 + ⌘S → 토스트가 '💾 저장됨' 하나뿐.
 *
 * ★고친 모양 = «자리를 늘리기 전에 문구·판정을 한 곳으로»
 *   js/io/pending-video-warn.js 하나가 문구(PENDING_VIDEO_MSG)와 판정(PENDING_VIDEO_SELECTOR)을
 *   갖는다. 네 자리는 그걸 부르기만 한다. 판정은 «명부»가 아니라 성질(data-asset-type)이다.
 *
 * ★이 파일이 막는 변이
 *   S-1 문구를 다른 파일에 «다시 적어» 사본을 만드는 것 (사본이 하나만 안 고쳐지는 이 레포의 지병)
 *   S-2 ⌘S 자리에서 알림을 떼는 것
 *   S-3 창 닫기 가로채기를 떼거나, 무한루프/행 금지선(재진입 가드·상한)을 떼는 것
 *   S-4 먼저 있던 두 자리(홈으로 나가기·선택 해제)를 잃는 것
 *   S-5 ★잔소리 — 구간 슬라이더(편집 중)에 알림을 끼워 넣는 것
 *   S-6 선택자(성질)를 리터럴로 되돌려 적는 것
 *
 * ⚠️여기는 «소스 대조»까지다. 진짜 DOM 동작은 tests/dom/video-pending-warn.dom.spec.js 가 잰다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { readSrc, toPosix } = require('./_srcread.js');
const { stripComments } = require('./_strip-comments.js');
const { sliceBlock } = require('./_slice-block.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..');

const SSOT_REL = ['js', 'io', 'pending-video-warn.js'];
const safeRead = (...segs) => (fs.existsSync(path.join(REPO, ...segs)) ? readSrc(REPO, ...segs) : '');

const RAW = {
  ssot:   safeRead(...SSOT_REL),
  save:   readSrc(REPO, 'js', 'io', 'save-load.js'),
  editor: readSrc(REPO, 'js', 'editor.js'),
  main:   readSrc(REPO, 'main.js'),
  trim:   readSrc(REPO, 'js', 'props', 'asset-video-trim.js'),
};
const SRC = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, stripComments(v)]));

/* 문구 본문 — 이모지·말줄임표를 뺀 «가장 흔들리지 않는» 조각으로 센다. */
const MSG_CORE = 'GIF로 적용되지 않았습니다';

/** js/**\/*.js + main.js 전수 — 이 검사가 훑은 범위를 스스로 만든다(손 명부 금지). */
function allSourceFiles() {
  const out = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.js') || ent.name.endsWith('.mjs')) out.push(p);
    }
  };
  walk(path.join(REPO, 'js'));
  out.push(path.join(REPO, 'main.js'));
  out.push(path.join(REPO, 'preload.js'));
  return out;
}

test('S-1 문구는 «한 파일»에서만 온다 — js/io/pending-video-warn.js', () => {
  assert.notEqual(RAW.ssot, '', 'js/io/pending-video-warn.js 가 없다 — 단일 진실원이 사라졌다');
  const holders = allSourceFiles()
    .filter((p) => stripComments(readSrc(p)).includes(MSG_CORE))
    .map((p) => toPosix(path.relative(REPO, p)))
    .sort();
  assert.deepEqual(holders, ['js/io/pending-video-warn.js'],
    `문구 사본이 생겼다(훑은 범위: js/**/*.js + main.js + preload.js). 발견: ${holders.join(', ')}`);
  assert.match(SRC.ssot, /export const PENDING_VIDEO_MSG\s*=/, 'PENDING_VIDEO_MSG 를 export 하지 않는다');
});

test('S-6 판정 선택자도 «한 파일»에서만 온다 — 성질(data-asset-type)로 판정', () => {
  assert.match(SRC.ssot, /export const PENDING_VIDEO_SELECTOR\s*=/, 'PENDING_VIDEO_SELECTOR 를 export 하지 않는다');
  assert.match(SRC.ssot, /data-asset-type="video-pending"/, '선택자가 성질을 안 쓴다');
  /* 알림을 «거는» 네 자리는 선택자 리터럴을 들고 있으면 안 된다(사본 금지). */
  for (const k of ['save', 'editor', 'main']) {
    assert.ok(!/\.asset-block\[data-asset-type="video-pending"\]/.test(SRC[k]),
      `${k}: 선택자 리터럴을 다시 적었다 — pending-video-warn.js 를 불러라`);
  }
});

test('S-2 ⌘S 자리가 알림을 부른다', () => {
  const block = sliceBlock(SRC.editor, "if (e.key === 's' && !e.shiftKey)", '⌘S 분기');
  assert.match(block, /warnPendingVideoLossIf\s*\(/, '⌘S 에서 미확정 영상 알림을 안 부른다');
  assert.match(block, /triggerAutoSave/, '⌘S 가 저장을 안 한다 — 분기를 잘못 잡았다');
  assert.match(SRC.editor, /from '\.\/io\/pending-video-warn\.js'/, 'editor.js 가 단일 진실원을 import 안 한다');
});

test('S-3 창 닫기를 가로채 알리고, 무한루프·행 금지선을 갖는다', () => {
  const h = sliceBlock(SRC.main, "mainWindow.on('close', (event) => {", '창 닫기 가로채기');
  assert.match(h, /event\.preventDefault\(\)/, '닫기를 가로채지 않는다');
  assert.match(h, /warnPendingVideoLoss/, '렌더러의 기존 알림을 안 부른다');
  assert.match(h, /hasPendingVideo/, '미확정 영상 판정을 안 묻는다');
  /* 재진입 가드: 두 번째 close 는 그대로 통과해야 한다 */
  assert.match(h, /if\s*\(_t32CloseAsked[\s\S]{0,40}\)\s*return;/, '재진입 가드가 없다 — 창이 영영 안 닫힌다');
  assert.match(h, /_t32CloseAsked\s*=\s*true/, '재진입 표식을 안 세운다');
  /* 행 금지선: 렌더러가 안 답해도 상한 뒤엔 닫는다 */
  assert.match(h, /setTimeout\([\s\S]{0,40}?,\s*600\)/, '응답 상한(600ms)이 없다 — 렌더러가 멈추면 창이 안 닫힌다');
  assert.match(h, /setTimeout\(r,\s*warned\s*\?\s*900\s*:\s*0\)/, '알렸을 때만 900ms 늦추는 구조가 아니다');
  /* 종료(⌘Q)는 가로채지 않는다 — before-quit 이 app.exit 으로 끝내는 경로다 */
  assert.match(h, /_t32Quitting/, '종료 중 예외가 없다 — ⌘Q 를 가로채면 종료가 망가진다');
  assert.match(SRC.main, /app\.on\('before-quit',\s*\(\)\s*=>\s*\{\s*_t32Quitting\s*=\s*true;\s*\}\)/,
    '_t32Quitting 을 세우는 before-quit 이 없다');
});

test('S-4 먼저 있던 두 자리(홈으로 나가기·선택 해제)를 잃지 않았다', () => {
  const home = sliceBlock(SRC.save, 'async function goHome()', '홈으로 나가기');
  assert.match(home, /warnPendingVideoLossIf\s*\(\s*canvasEl\s*\)/, 'goHome 에서 알림이 사라졌다');
  assert.match(home, /setTimeout\(r,\s*900\)/, 'goHome 이 토스트 보일 시간을 안 준다');
  assert.match(SRC.editor, /dataset\.assetType === 'video-pending'\)\s*\{\s*warnPendingVideoLoss\(\)/,
    '선택 해제 자리에서 알림이 사라졌다');
});

test('S-5 잔소리 금지 — 구간 슬라이더(편집 중)는 알리지 않는다', () => {
  assert.ok(!/warnPendingVideoLoss|PENDING_VIDEO_MSG|GIF로 적용되지 않았습니다/.test(SRC.trim),
    'js/props/asset-video-trim.js 가 알림을 부른다 — 슬라이더를 만질 때마다 잔소리가 된다');
});

test('S-7 알린 사실을 돌려준다 — 「보일 시간을 줄지」는 부르는 쪽이 정한다', () => {
  const f = sliceBlock(SRC.ssot, 'export function warnPendingVideoLoss()', '알림 함수');
  assert.match(f, /return true;/, 'warnPendingVideoLoss 가 「알렸다」를 안 돌려준다');
  assert.match(f, /return false;/, 'showToast 가 없을 때 false 를 안 돌려준다');
  const g = sliceBlock(SRC.ssot, 'export function warnPendingVideoLossIf(root)', '조건부 알림');
  assert.match(g, /hasPendingVideo\(root\)/, '판정을 hasPendingVideo 로 안 한다');
});
