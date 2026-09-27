/* T-080 — 「복제한 블럭과 원본을 함께 골라 ⌘G 로 묶으면 …
 *          성공 시 «N개를 묶었다» 안내가 «없다»(⌘G 성공 직후 토스트/스낵바 0개)」
 *
 * ★재는 «양» = ⌘G 가 «성공했을 때» 새로 뜬 «보이는 안내»의 수. (요소 존재가 아니다 —
 *   #editor-toast 는 재사용 노드라 한 번 뜬 뒤론 계속 DOM 에 있다. rect·opacity·innerText 로 잰다.)
 * ★묶기가 «실제로 됐는지»도 같이 센다 — 안 된 채로 「안내 0」이면 그건 다른 이야기다.
 *
 * ★계측기 증명(양성대조): 같은 계측으로, «아무것도 안 고르고» ⌘G 를 누른다.
 *   그 길에는 실제 토스트가 있다(js/block-factory.js:1840 『그룹으로 묶을 블록을 먼저 선택하세요.』)
 *   ⇒ 거기서 안내가 «잡히면» 이 계측기는 토스트를 볼 줄 안다. 성공 쪽 0 은 «진짜 0»이다.
 *
 * 실행: node check-t080.mjs [port]
 *   ★끝나면 끈다:  pkill -9 -f -- '--user-data-dir=<네 프로필 절대경로>'  → 그 폴더째 삭제.
 *     ★★⛔«프로필 이름만»으로 잡지 마라(`pkill -9 -f 'ud-9533'`) — 그 문자열이 «너를 띄운 셸의
 *       명령줄»에도 들어 있으면 «검사 자신»이 같이 죽는다. 2026-09-22 실측: 되돌리기 e2e 가
 *       세 판을 그렇게 날렸고, 그 exit 144(SIGTERM)를 「빨강마다 멈춘다」로 잘못 읽고 있었다.
 *       `--user-data-dir=` 는 «앱만» 갖는 인자라 남의 앱도, 너 자신도 안 걸린다.
 */
import { connect } from './lib/cdp.mjs';
import { freshProject } from './lib/board.mjs';
import { addSection, addText, clickBlock, clickEmptyCanvas } from './lib/ui.mjs';
import { watchNotices } from './lib/notice.mjs';

const PORT = Number(process.argv[2] || process.env.PORT || 9531);
const R = { card: 'T-080', checks: [] };
const add = (id, quantity, measured, pass, note) => R.checks.push({ id, quantity, measured, pass, note });

const s = await connect(PORT, '');
await freshProject(s);
await s.sleep(1500);

await addSection(s);
await addText(s, 'Heading');
await s.sleep(400);
await s.cmd('d');                 // ⌘D 복제 — 진짜 키
await s.sleep(900);

const blocks = await s.eval(`return [...document.querySelectorAll('.text-block')].map(e => e.id)`);
if (blocks.length < 2) { console.log(JSON.stringify({ ...R, fatal: `⌘D 복제가 안 됐다(글자블럭 ${blocks.length}개)` }, null, 2)); s.close(); process.exit(1); }

/* 원본 + 복제본을 «진짜» 클릭 + ⇧클릭으로 함께 고른다 */
await clickEmptyCanvas(s);
await clickBlock(s, blocks[0]);
await clickBlock(s, blocks[1], { shift: true });
const selBefore = await s.eval(`return [...document.querySelectorAll('.text-block.selected')].map(e => e.id)`);
add('T-080/precondition', '전제 — 복제본과 원본이 «둘 다» 골라졌나', { selected: selBefore, blocks },
  selBefore.length >= 2, `글자블럭 ${blocks.length}개 중 ${selBefore.length}개 선택`);

/* ── ⌘G 성공 직후, 새로 뜬 «보이는 안내»를 센다 ── */
const before = await s.eval(`return { texts: document.querySelectorAll('.text-block').length, groups: document.querySelectorAll('.frame-block[data-group]').length }`);
const w = await watchNotices(s, () => s.cmd('g'));
await s.sleep(300);
const afterG = await s.eval(`return { texts: document.querySelectorAll('.text-block').length, groups: document.querySelectorAll('.frame-block[data-group]').length }`);

const grouped = afterG.groups > before.groups && afterG.texts === before.texts;
add('T-080/group-succeeded', '전제 — ⌘G 가 «성공»했나 (그룹 +1, 블럭 손실 0)', { before, after: afterG }, grouped,
  `그룹 ${before.groups}→${afterG.groups} · 글자블럭 ${before.texts}→${afterG.texts}`);

add('T-080/success-notice', '⌘G 성공 «직후» 새로 뜬 보이는 안내 수 (≥1 이어야 한다)',
  { floating: w.floatingNotices, count: w.floatingNotices.length, editorToast: w.editorToast, fullDiff: w.fullDiff },
  grouped ? w.floatingNotices.length >= 1 : null,
  grouped ? `떠 있는 안내 ${w.floatingNotices.length}개${w.floatingNotices.length ? ': ' + w.floatingNotices.map(n => n.text).join(' / ') : ' — 「N개를 묶었다」가 없다'}`
          : '못 잼 — ⌘G 가 성공하지 않아 «성공 안내» 축을 못 잰다');

/* ── 계측기 증명: 아무것도 안 고른 채 ⌘G — 여기엔 실제 토스트가 있다 ── */
await clickEmptyCanvas(s);
await s.sleep(300);
const selNow = await s.eval(`return document.querySelectorAll('.selected').length`);
const w2 = await watchNotices(s, () => s.cmd('g'));
add('T-080/instrument-positive', '대조 — 아무것도 안 고르고 ⌘G (토스트가 «있는» 길). 계측기가 그걸 보나',
  { selectedCount: selNow, floating: w2.floatingNotices, editorToast: w2.editorToast },
  w2.floatingNotices.length >= 1,
  w2.floatingNotices.length ? `잡았다: ${w2.floatingNotices.map(n => n.text).join(' / ')}` : '못 잡았다 ⇒ 계측기를 믿을 수 없다');

console.log(JSON.stringify(R, null, 2));
s.close();
