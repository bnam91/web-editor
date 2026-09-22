/* T-097 ⑦ — 「빈 칸 + Enter: 칸=빈 채 · 실제=rgb(255,0,0) · 2.5초 뒤에도 그대로
 *            → «보이는 값(빈칸) ≠ 실제(FF0000)»」
 *
 * ★재는 «양» = «칸에 보이는 값»과 «실제로 칠해진 색» 한 쌍. ⛔한쪽만 재면 못 잡는다 —
 *   칸만 보면 「비어 있네」이고 화면만 보면 「빨갛네」인데, 결함은 «둘이 어긋난 것»이다.
 *   실제값은 글자 요소의 computed color 로 읽는다(패널이 아니라 «칠해진 결과»).
 *
 * ★멀쩡한 이웃(초록이어야 하는 자리) 둘:
 *   ⒜ 같은 칸에 «유효값» + Enter — 칸=실제 여야 한다.
 *   ⒝ 같은 «빈 칸»을 Enter 말고 blur(다른 칸 클릭) — 여기선 되돌아온다(2026-09-22 QA6 실측).
 *   ⇒ ⒝ 가 초록인데 Enter 만 빨강이면, 빨강의 «이유»는 «Enter 경로»다(검사가 다 빨간 게 아니다).
 *
 * 실행: npm run test:cdp:small5 -- <port>      (저장소 뿌리에서)
 *   = node tests/e2e/check-t097.mjs [port]
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
import { addSection, clickBlock, fillField, centerOf } from './lib/ui.mjs';

const PORT = Number(process.argv[2] || process.env.PORT || 9531);
const R = { card: 'T-097', checks: [] };
const add = (id, quantity, measured, pass, note) => R.checks.push({ id, quantity, measured, pass, note });

const s = await connect(PORT, '');
await freshProject(s);
await s.sleep(1500);
await addSection(s);

const tb = (await s.eval(`return [...document.querySelectorAll('.text-block')].map(e => e.id)`))[0];
if (!tb) { console.log(JSON.stringify({ ...R, fatal: '글자 블럭이 없다' }, null, 2)); s.close(); process.exit(1); }
await clickBlock(s, tb);

/** 「보이는 값」과 「실제 값」을 «한 번에» 읽어 나란히 둔다. */
const pair = () => s.eval(`
  const h = document.getElementById('txt-color-hex');
  const el = document.querySelector('#${tb} .tb-h1, #${tb} .tb-h2, #${tb} .tb-h3, #${tb} .tb-body');
  const rgb = el ? getComputedStyle(el).color : null;
  const m = rgb && rgb.match(/(\\d+),\\s*(\\d+),\\s*(\\d+)/);
  const actualHex = m ? [1,2,3].map(i => Number(m[i]).toString(16).padStart(2,'0')).join('').toUpperCase() : null;
  const shownRaw = h ? h.value : null;
  const shownHex = (shownRaw || '').trim().replace(/^#/, '').toUpperCase();
  return { shownRaw, shownHex, actualRgb: rgb, actualHex,
           agrees: /^[0-9A-F]{6}$/.test(shownHex) && shownHex === actualHex,
           invalidMark: h ? (h.classList.contains('prop-color-hex--invalid') || h.getAttribute('aria-invalid') === 'true') : null,
           swatch: document.querySelector('.prop-color-swatch') ? getComputedStyle(document.querySelector('.prop-color-swatch')).backgroundColor : null,
           focused: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : null };`);

const base = await pair();
add('T-097/precondition-panel', '전제 — 글자 패널의 #txt-color-hex 가 열렸고 칸=실제 로 시작하나', base,
  base.shownRaw != null && base.agrees === true, `칸=${base.shownRaw} · 실제=${base.actualRgb}`);

/* ── ⒜ 멀쩡한 이웃: 유효값 + Enter ── */
await fillField(s, 'txt-color-hex', 'FF0000');
await s.enter();
await s.sleep(700);
const valid = await pair();
add('T-097/valid-enter-neighbor', '멀쩡한 이웃 — 유효값(FF0000)+Enter 뒤 «칸 = 실제»', valid,
  valid.agrees === true && valid.actualHex === 'FF0000', `칸=${valid.shownRaw} · 실제=${valid.actualRgb}`);

/* ── ① 본 증상: 빈 칸 + Enter ── */
await fillField(s, 'txt-color-hex', '', { clearOnly: true });
const cleared = await pair();
await s.enter();
const samples = [];
for (const ms of [300, 700, 1500]) { await s.sleep(ms); samples.push(await pair()); }   // 합계 2.5초
const last = samples[samples.length - 1];
add('T-097/empty-enter', '빈 칸 + Enter 2.5초 뒤 — 보이는 값과 실제가 같은가',
  { afterClearBeforeEnter: cleared, samples },
  last.agrees === true,
  `칸="${last.shownRaw}" · 실제=${last.actualRgb} ⇒ ${last.agrees ? '일치' : '어긋남(보이는 값 ≠ 실제)'}`);

/* ── ⒝ 멀쩡한 이웃: 같은 빈 칸을 Enter 말고 blur ── */
await fillField(s, 'txt-color-hex', '', { clearOnly: true });
const alpha = await centerOf(s, `document.getElementById('txt-color-alpha')`);
if (alpha?.visible && alpha.hitInside) await s.click(alpha.x, alpha.y);
await s.sleep(900);
const blurred = await pair();
add('T-097/empty-blur-neighbor', '멀쩡한 이웃 — 같은 «빈 칸»을 blur(다른 칸 클릭) 하면 칸=실제 로 돌아오나',
  blurred, blurred.agrees === true, `칸="${blurred.shownRaw}" · 실제=${blurred.actualRgb}`);

console.log(JSON.stringify(R, null, 2));
s.close();
