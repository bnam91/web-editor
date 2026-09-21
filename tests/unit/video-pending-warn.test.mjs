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
 *   S-8~S-11 ★「한 번만」 래치를 떼거나, 래치를 건너뛰는 직접 호출을 다시 만드는 것 ·
 *            새로 막은 «탭 전환» 입구를 잃는 것 · «안 사라지는» 페이지 전환에 알림을 끼워 넣는 것
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
  /* ★T-032(2026-09-22): 판정·알림·「한 번만」 래치가 «한 번의 호출»에 들어 있어야 한다.
     예전 `hasPendingVideo() && warnPendingVideoLoss()` 이어붙이기는 판정 사본을 여기 만들고
     래치를 건너뛴다(닫으려다 물러도 또 뜬다). */
  assert.match(h, /window\.warnPendingVideoLossIf\?\.\(\)/, '래치를 탄 단일 호출(warnPendingVideoLossIf)을 안 쓴다');
  assert.ok(!/hasPendingVideo\s*\?\.\(\)\s*&&/.test(h),
    '판정을 여기서 다시 한다 — 래치를 건너뛰는 옛 이어붙이기가 돌아왔다');
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
  /* ★T-032(2026-09-22): 여기도 래치를 타야 한다 — 직접 warnPendingVideoLoss() 를 부르면
     «선택했다 풀 때마다» 뜬다(실측 5회 해제 = 5회 알림). */
  assert.match(SRC.editor, /dataset\.assetType === 'video-pending'\)\s*\{\s*warnPendingVideoLossIf\(canvas\)/,
    '선택 해제 자리에서 알림이 사라졌거나, 래치를 안 타는 옛 호출로 돌아갔다');
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
  assert.match(g, /pendingVideoIdentity\(root\)/, '판정을 pendingVideoIdentity 로 안 한다');
});

/* ══ T-032 2026-09-22 — 「한 번만」 ══════════════════════════════════════════
   ★카드의 핵심이다 — 「나가려 할 때마다 뜨거나, 영상이 없는데도 뜨면 그게 새 결함이다」.
   ★고치기 «전» 실측(dev 12865a1, 포트 9643, 미확정 영상 1개):
       선택했다 풀기 5회 → 알림 «5회» · ⌘S 3회 → 알림 «3회» · 프로젝트 탭 전환 → 알림 «0회»
       (그런데 탭 전환에서 data-img-src 가 10,270자 → 0자로 «진짜 사라졌다»).
   ⚠️여기는 «소스 대조»다. 진짜 세는 일은 tests/dom/video-pending-warn.dom.spec.js(P6~P8). */

test('S-8 「한 번만」 래치가 단일 진실원 «안»에 있다 — 부르는 쪽마다 사본을 두지 않는다', () => {
  assert.match(SRC.ssot, /function pendingVideoIdentity\(root\)/,
    '래치의 «신원» 계산이 없다');
  assert.match(SRC.ssot, /let _warnedIdentity = null;/, '래치 상태가 없다');
  /* ★블럭 id 로 래치를 걸면, 같은 블럭에 «다른» 영상을 다시 넣었을 때 영영 안 알린다(거짓 음성).
     그래서 신원은 원본 dataURL 에서 뽑는다. */
  assert.match(SRC.ssot, /dataset\.imgSrc/, '신원을 원본(dataset.imgSrc)에서 안 뽑는다 — 같은 블럭 재사용에 거짓 음성이 난다');
  assert.ok(!/\bab\.id\b/.test(sliceBlock(SRC.ssot, 'function pendingVideoIdentity(root)', '신원 계산')),
    '신원을 블럭 id 로 만든다 — 같은 블럭에 다른 영상을 넣으면 영영 안 알린다');
  /* 래치는 «미확정 영상이 없을 때» 풀려야 한다 — 안 풀면 적용/삭제 뒤 새 영상에 영영 침묵한다 */
  const f = sliceBlock(SRC.ssot, 'export function warnPendingVideoLossIf(root)', '조건부 알림');
  assert.match(f, /_warnedIdentity = null/, '미확정 영상이 없을 때 래치를 안 푼다');
  assert.match(f, /identity === _warnedIdentity/, '같은 영상인지 안 견준다 — 「한 번만」이 없다');
});

test('S-9 «떠나는 자리»는 전부 래치를 탄다 — 래치 없는 warnPendingVideoLoss 직접 호출 금지', () => {
  const ssotPosix = toPosix(path.join('js', 'io', 'pending-video-warn.js'));
  const offenders = [];
  for (const file of allSourceFiles()) {
    const rel = toPosix(path.relative(REPO, file));
    if (rel === ssotPosix) continue;                       // 단일 진실원 자신은 예외
    const body = stripComments(fs.readFileSync(file, 'utf8'));
    /* import 줄·window 노출은 «호출»이 아니다 — 괄호가 바로 붙은 호출만 센다 */
    if (/(?<!LossIf)\bwarnPendingVideoLoss\s*\(/.test(body)) offenders.push(rel);
  }
  assert.deepEqual(offenders, [],
    `래치를 건너뛰는 직접 호출이 있다(${offenders.join(', ')}) — 그 자리는 나갈 때마다 또 뜬다`);
});

test('S-10 새로 막은 입구 — 프로젝트 탭 전환이 «세척 전»에 알린다', () => {
  const tabs = stripComments(readSrc(REPO, 'js', 'tab-system.js'));
  /* ⛔여긴 import 를 «쓰면 안 된다» — tests/dom/tab-name-injection.dom.spec.js 가 이 파일을
     about:blank 에 홀로 얹어 검사하므로 './io/...' 가 안 풀려 모듈이 통째로 죽는다(실측). */
  assert.ok(!/^import .*pending-video-warn/m.test(tabs),
    'tab-system.js 가 단일 진실원을 import 한다 — about:blank 단독 로드가 깨진다(T049-DOM-2·3)');
  const sw = sliceBlock(tabs, 'async function switchTab(id)', '탭 전환');
  assert.match(sw, /window\.warnPendingVideoLossIf\?\.\(/,
    '탭 전환에 알림이 없다 — 여기서 영상이 진짜 사라진다(실측). 이 파일의 규약은 window 경유다');
  /* ⛔순서가 전부다 — 세척(serializeProject) 뒤에 알리면 판정할 영상이 이미 지워져 있다 */
  const iWarn = sw.indexOf('warnPendingVideoLossIf');
  const iSer  = sw.indexOf('serializeProject');
  assert.ok(iWarn > -1 && iSer > -1 && iWarn < iSer,
    '알림이 serializeProject(세척) «뒤»에 있다 — 그때는 이미 영상이 지워져 판정이 항상 false 다');
});

test('S-11 «안 사라지는» 자리에는 알리지 않는다 — 페이지 전환(음성대조)', () => {
  /* 실측(포트 9643): 페이지를 옮겼다 돌아와도 사이드카가 원본을 되살려 data-img-src 가
     10,270자 그대로였다. 안 사라지는데 「사라집니다」라고 알리면 그게 거짓말이다. */
  const sp = sliceBlock(SRC.save, 'function switchPage(', '페이지 전환');
  assert.ok(!/warnPendingVideoLoss/.test(sp),
    'switchPage 가 알림을 부른다 — 페이지 전환에선 영상이 안 사라진다(사이드카가 되살린다)');
});
