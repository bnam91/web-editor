/* T-099 ⑤ — 「⌘A 전체선택 뒤 Delete 하면 빈 프레임이 남는다 (두 갈래)」
 *
 * ★재는 «양» = Delete «뒤»에 남은 «블럭이 하나도 없는 프레임»의 수. 두 갈래를 «둘 다» 센다:
 *   ㈀ 글자 래퍼 프레임(.frame-block[data-text-frame])  — 높이 0 이라 눈엔 안 보인다
 *   ㈁ 사용자가 넣은 Frame 블럭(.frame-block:not([data-text-frame])) — 눈에 «보이는» 채로 남는다
 *   ⛔한 갈래만 세고 닫지 않는다. 카드가 「두 갈래」라고 적었다.
 * ★⌘A 가 무엇을 골랐는지도 같이 적는다 — 「프레임이 골라져 있었는데 안 지워졌다」와
 *   「애초에 안 골라졌다」는 다른 이야기이고, 고치는 자리도 다르다.
 *
 * ★빨강의 «이유»가 맞나 (무의미한 빨강 방지):
 *   같은 판에서 «남은 프레임을 그냥 클릭 + Delete» 를 해 본다. 그게 지워지면
 *   「지울 수 없는 블럭」이 아니라 «⌘A→Delete 경로»가 못 지운 것이다.
 *
 * 판은 도구막대를 «진짜로 눌러» 만든다(하네스가 DOM 을 심지 않는다).
 * 실행: npm run test:cdp:small5 -- <port>      (저장소 뿌리에서)
 *   = node tests/e2e/check-t099.mjs [port]
 *   ★앱은 미리 «격리 프로필»로 그 포트에 띄워 두어야 한다(이 검사는 앱을 «안» 띄운다 — 붙기만 한다):
 *     electron . --remote-debugging-port=<port> --remote-allow-origins='*' \
 *                --user-data-dir=<격리폴더> --disable-renderer-backgrounding \
 *                --disable-background-timer-throttling --disable-backgrounding-occluded-windows admin
 *   ★띄운 «직후» 로그에서 「[projects] 뿌리=…」가 그 격리폴더인지 확인해라.
 *     ~/Library/Application Support/GODITOR 면 현빈 실계정이다 — 즉시 끄고 다시 띄운다.
 *   ★제품 파일을 바꾼 «뒤»(양성대조 등)엔 node tests/e2e/reload-page.mjs <port> 로
 *     캐시 무시 새로고침을 해라 — 안 하면 옛 모듈이 그대로 돌아 «거짓 통과»가 난다.
 *   ★끝나면 끈다:  pkill -9 -f -- '--user-data-dir=<네 프로필 절대경로>'  → 그 폴더째 삭제.
 *     ★★⛔«프로필 이름만»으로 잡지 마라(`pkill -9 -f 'ud-9533'`) — 그 문자열이 «너를 띄운 셸의
 *       명령줄»에도 들어 있으면 «검사 자신»이 같이 죽는다. 2026-09-22 실측: 되돌리기 e2e 가
 *       세 판을 그렇게 날렸고, 그 exit 144(SIGTERM)를 「빨강마다 멈춘다」로 잘못 읽고 있었다.
 *       `--user-data-dir=` 는 «앱만» 갖는 인자라 남의 앱도, 너 자신도 안 걸린다.
 *     ⛔포트 «접두사»로 잡지 마라 — `pkill -f 'remote-debugging-port=953'` 이
 *       9533·9534 와 «함께 9535» 를 죽여 다른 워커의 계측을 끊었다(2026-09-22 실측).
 *       프로필 경로는 «네 실행에만» 있으므로 그 사고가 «구조적으로» 안 난다.
 */
import { connect } from './lib/cdp.mjs';
import { freshProject } from './lib/board.mjs';
import { addSection, addText, addFrame, clickEmptyCanvas, clickBlock } from './lib/ui.mjs';

const PORT = Number(process.argv[2] || process.env.PORT || 9531);
const R = { card: 'T-099', checks: [] };
const add = (id, quantity, measured, pass, note) => R.checks.push({ id, quantity, measured, pass, note });

const s = await connect(PORT, '');
await freshProject(s);
await s.sleep(1500);

/* ── 판 만들기: 섹션 · 글자 2 · 사용자 Frame · 그 Frame 안의 글자 1 ── */
await addSection(s);
await addText(s, 'Heading');
await addText(s, 'Heading');
await addFrame(s);            // 프레임이 골라진 채로 남는다
await addText(s, 'Body');     // → 골라진 프레임 «안»으로 들어간다

const EMPTY_FRAME_FN = `
function __emptyFrames() {
  const BLOCK = '.text-block, .asset-block, .gap-block, .shape-block, .graph-block, .table-block, .grid-block, .canvas-block, .step-block, .modal-block, .banner02-block, .sticker-block, .icon-block, .icon-circle-block, .icon-text-block, .divider-block, .comparison-block, .chat-block, .laurel-block, .mockup-block, .zoom-block, .joker-block, .vector-block, .infocard-block, .innercard-block, .label-group-block, .bridge-block, .qa-block';
  return [...document.querySelectorAll('.frame-block')]
    .filter(f => !f.querySelector(BLOCK))
    .map(f => { const r = f.getBoundingClientRect();
      return { id: f.id, textFrame: f.dataset.textFrame === 'true',
               h: Math.round(r.height), w: Math.round(r.width),
               inLayerPanel: !!document.querySelector('.layer-item[data-id="' + f.id + '"], [data-layer-id="' + f.id + '"]') }; });
}`;

const before = await s.eval(`${EMPTY_FRAME_FN}
  return { frames: document.querySelectorAll('.frame-block').length,
           blocks: document.querySelectorAll('.text-block').length,
           emptyFrames: __emptyFrames().length };`);

/* ── 빈 자리를 눌러 선택을 풀고, ⌘A → 무엇이 골라졌나 ── */
await clickEmptyCanvas(s);
await s.cmd('a');
await s.sleep(600);
const sel = await s.eval(`
  return { ids: [...document.querySelectorAll('.selected')].map(e => e.id + '|' + String(e.className).split(' ')[0]),
           frameSelected: [...document.querySelectorAll('.frame-block.selected')].map(e => e.id) };`);

add('T-099/precondition-cmdA', '⌘A 가 무엇을 고르나(전제)', sel, sel.ids.length > 0,
  `${sel.ids.length}개 선택 · 그중 프레임 ${sel.frameSelected.length}개`);

/* ── Delete ── */
await s.del();
await s.sleep(900);
const after = await s.eval(`${EMPTY_FRAME_FN}
  return { frames: document.querySelectorAll('.frame-block').length,
           blocks: document.querySelectorAll('.text-block').length,
           empty: __emptyFrames() };`);

const wrappers = after.empty.filter(f => f.textFrame);
const userFrames = after.empty.filter(f => !f.textFrame);

add('T-099/leftover-text-wrapper', '㈀ Delete 뒤 남은 «빈 글자 래퍼 프레임» 수 (0 이어야 한다)',
  { count: wrappers.length, frames: wrappers }, wrappers.length === 0,
  `빈 래퍼 ${wrappers.length}개 (높이: ${wrappers.map(f => f.h).join(',') || '-'})`);

add('T-099/leftover-user-frame', '㈁ Delete 뒤 남은 «빈 사용자 Frame 블럭» 수 (0 이어야 한다)',
  { count: userFrames.length, frames: userFrames, blocksLeft: after.blocks }, userFrames.length === 0,
  `빈 Frame ${userFrames.length}개 (크기: ${userFrames.map(f => f.w + 'x' + f.h).join(',') || '-'}) · 남은 글자블럭 ${after.blocks}`);

/* ── 빨강의 «이유» 확인 — 남은 프레임을 그냥 클릭 + Delete 하면 지워지나 ── */
let ctrl = { skipped: '남은 프레임이 없어 대조 불필요' };
const target = userFrames[0] || wrappers.find(f => f.h > 0);
if (target) {
  try {
    const p = await clickBlock(s, target.id);
    const selNow = await s.eval(`return [...document.querySelectorAll('.selected')].map(e => e.id)`);
    await s.del();
    await s.sleep(800);
    const gone = await s.eval(`return !document.getElementById(${JSON.stringify(target.id)})`);
    ctrl = { id: target.id, clickedAt: [p.x, p.y], selectedAfterClick: selNow, goneAfterDelete: gone };
  } catch (e) { ctrl = { id: target.id, error: e.message }; }
}
add('T-099/control-direct-delete', '대조 — 남은 프레임을 «그냥 클릭+Delete» 하면 지워지나 (지워져야 «⌘A 경로»의 결함이다)',
  ctrl, ctrl.goneAfterDelete === true || !!ctrl.skipped,
  ctrl.skipped || (ctrl.goneAfterDelete ? '지워진다 ⇒ 못 지우는 것은 ⌘A→Delete 경로다' : '안 지워진다 ⇒ 결함의 자리가 다르다(다시 봐야 한다)'));

R.board = { before, after: { frames: after.frames, blocks: after.blocks } };
console.log(JSON.stringify(R, null, 2));
s.close();
