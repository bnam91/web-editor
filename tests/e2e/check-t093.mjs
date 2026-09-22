/* T-093 ④ — 「Gap 높이에 9999 를 넣으면 1000 까지만 들어가는데 …
 *          넘겼다는 «알림»(토스트/경고)은 0건 — 알려 주는 수단은 «칸이 1000 으로 되써지는 것» 하나뿐」
 *
 * ★재는 «양» = «상한을 넘겨 값이 깎였을 때» 사용자에게 뜬 «보이는 안내»의 수.
 *   ⛔「요소가 있다」로 세지 않는다(#editor-toast 는 재사용 노드 — lib/notice.mjs 머리말 참고).
 *   칸·슬라이더·실제 높이도 같이 적는다 — 「깎였다」는 사실 자체가 전제이기 때문이다.
 *
 * ★타이핑은 «글자마다» 진짜 키로 넣는다. Input.insertText 로 넣으면 숫자칸 커밋가드의
 *   «타이핑 유예»가 안 걸려 사람 경로와 다른 결과가 나온다(2026-09-22 QA6 기록).
 *
 * ★멀쩡한 이웃(초록이어야 하는 자리): 같은 칸에 «범위 안»의 값(300)을 넣는 길.
 *   거긴 깎이지 않으므로 알릴 것도 없고, 칸=실제 가 맞아야 한다.
 * ★계측기 증명: 같은 계측으로 «토스트가 있는 길»(아무것도 안 고르고 ⌘G)을 재 본다.
 *
 * 실행: npm run test:cdp:small5 -- <port>      (저장소 뿌리에서)
 *   = node tests/e2e/check-t093.mjs [port]
 *   ★앱은 미리 «격리 프로필»로 그 포트에 띄워 두어야 한다(이 검사는 앱을 «안» 띄운다 — 붙기만 한다):
 *     electron . --remote-debugging-port=<port> --remote-allow-origins='*' \
 *                --user-data-dir=<격리폴더> --disable-renderer-backgrounding \
 *                --disable-background-timer-throttling --disable-backgrounding-occluded-windows admin
 *   ★띄운 «직후» 로그에서 「[projects] 뿌리=…」가 그 격리폴더인지 확인해라.
 *     ~/Library/Application Support/GODITOR 면 현빈 실계정이다 — 즉시 끄고 다시 띄운다.
 *   ★제품 파일을 바꾼 «뒤»(양성대조 등)엔 node tests/e2e/reload-page.mjs <port> 로
 *     캐시 무시 새로고침을 해라 — 안 하면 옛 모듈이 그대로 돌아 «거짓 통과»가 난다.
 */
import { connect } from './lib/cdp.mjs';
import { freshProject } from './lib/board.mjs';
import { addSection, clickBlock, clickEmptyCanvas, fillField } from './lib/ui.mjs';
import { watchNotices } from './lib/notice.mjs';

const PORT = Number(process.argv[2] || process.env.PORT || 9531);
const R = { card: 'T-093', checks: [] };
const add = (id, quantity, measured, pass, note) => R.checks.push({ id, quantity, measured, pass, note });

const s = await connect(PORT, '');
await freshProject(s);
await s.sleep(1500);
await addSection(s);

const gap = (await s.eval(`return [...document.querySelectorAll('.gap-block')].map(e => e.id)`))[0];
if (!gap) { console.log(JSON.stringify({ ...R, fatal: '갭 블럭이 없다' }, null, 2)); s.close(); process.exit(1); }
await clickBlock(s, gap);

const field = () => s.eval(`
  const n = document.getElementById('gap-number'), sl = document.getElementById('gap-slider');
  const gb = document.getElementById(${JSON.stringify(gap)});
  return { value: n ? n.value : null, min: n ? n.min : null, max: n ? n.max : null,
           slider: sl ? sl.value : null, styleH: gb.style.height,
           computedH: getComputedStyle(gb).height, rectH: Math.round(gb.getBoundingClientRect().height),
           invalidClass: n ? n.className : null, ariaInvalid: n ? n.getAttribute('aria-invalid') : null };`);

const base = await field();
add('T-093/precondition-panel', '전제 — 갭 패널의 #gap-number 가 열렸나(min/max 포함)', base,
  base.value != null, `칸=${base.value} · min=${base.min} max=${base.max}`);

/* ── ① 상한을 넘기는 값: 9999 ── */
await fillField(s, 'gap-number', '9999');
const preEnter = await field();
const w = await watchNotices(s, () => s.enter());
await s.sleep(400);
const postEnter = await field();

const px = (v) => Math.round(parseFloat(v || '0'));
const clamped = String(postEnter.value) === String(base.max) && px(postEnter.computedH) === Number(base.max);
add('T-093/clamped', '전제 — 9999 가 상한(1000)으로 깎였나 · 칸과 실제가 같은가',
  { preEnter, postEnter }, clamped,
  `Enter 전 칸=${preEnter.value}/실제 ${px(preEnter.computedH)}px → Enter 후 칸=${postEnter.value}/슬라이더=${postEnter.slider}/실제 ${px(postEnter.computedH)}px (rect 는 줌 40% 라 0.4배)`);

add('T-093/overflow-notice', '상한을 넘겨 값이 깎였을 때 새로 뜬 «보이는 안내» 수 (≥1 이어야 한다)',
  { count: w.floatingNotices.length, floating: w.floatingNotices, editorToast: w.editorToast, fullDiff: w.fullDiff },
  clamped ? w.floatingNotices.length >= 1 : null,
  clamped ? `떠 있는 안내 ${w.floatingNotices.length}개${w.floatingNotices.length ? ': ' + w.floatingNotices.map(n => n.text).join(' / ') : ' — 깎였다는 말이 «어디에도» 없다'}`
          : '못 잼 — 깎이지 않아 «알림» 축을 못 잰다');

/* ── ② 멀쩡한 이웃: 범위 «안»의 값은 조용히, 그리고 칸=실제 ── */
await fillField(s, 'gap-number', '300');
const w2 = await watchNotices(s, () => s.enter(), { samples: [150, 300, 500] });
await s.sleep(300);
const inRange = await field();
add('T-093/in-range-neighbor', '멀쩡한 이웃 — 범위 안(300)은 칸=실제 이고 조용하다',
  { field: inRange, notices: w2.floatingNotices },
  String(inRange.value) === '300' && px(inRange.computedH) === 300 && w2.floatingNotices.length === 0,
  `칸=${inRange.value} · 실제 ${px(inRange.computedH)}px · 안내 ${w2.floatingNotices.length}개`);

/* ── ③ 계측기 증명: 토스트가 «있는» 길을 같은 계측으로 ── */
await clickEmptyCanvas(s);
await s.sleep(300);
const w3 = await watchNotices(s, () => s.cmd('g'));
add('T-093/instrument-positive', '대조 — 토스트가 «있는» 길(빈 선택 ⌘G)을 같은 계측이 잡나',
  { floating: w3.floatingNotices }, w3.floatingNotices.length >= 1,
  w3.floatingNotices.length ? `잡았다: ${w3.floatingNotices.map(n => n.text).join(' / ')}` : '못 잡았다 ⇒ 계측기를 믿을 수 없다');

console.log(JSON.stringify(R, null, 2));
s.close();
