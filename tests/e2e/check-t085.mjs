/* T-085 — 「그리드 기본 안내문구가 «내보낸 그림»에 찍히던 것」의 회귀 그물.
 *
 * ★재는 «양» = «내보낸 산출물의 픽셀». 표식(data-is-placeholder)이 붙었나로 재지 «않는다» —
 *   그건 지금 구현의 «방법»이다. 방법이 바뀌어도 결과가 맞으면 초록이어야 하고,
 *   방법이 그대로여도 결과가 틀리면 빨강이어야 한다.
 *   내보내기는 앱 자신의 길로 간다: window.exportSection(sec,'png',860,{returnDataUrl:true})
 *   (저장창은 금지 — 이 옵션이 레포가 「QA·외부검산이 쓰는 길」로 적어 둔 그 길이다,
 *    js/io/export-image.js:505)
 *
 * ★양방향으로 잰다. 한 방향만 재면 다음 사람이 반대 방향 사고를 내도 초록이 난다:
 *   ㉠ 안 나와야 할 것 — 손 안 댄 그리드 칸의 기본 문구는 «0 픽셀»
 *   ㉡ 나와야 할 것 ① — 사용자가 그 칸에 «다른» 글자를 쓰면 그 글자는 «찍힌다»
 *   ㉢ 나와야 할 것 ② — ★핵심 음성대조.
 *      사용자가 «그리드 기본 문구와 똑같은 문장»을 글자 블럭에 직접 써 넣으면 «찍혀야» 한다.
 *      고침 주석이 스스로 경고한 자리다(js/blocks/grid-block.js:648):
 *        「글자가 기본 문구와 같으면 숨겨라」로 고치면 사용자가 정말 그 문장을 쓴 경우에
 *         그 글자를 숨긴다 — T-039 가 낸 사고(진짜 본문을 가려 흰 페이지)와 «같은 방향».
 *      ⇒ ㉠만 재는 그물은 그 «되돌아간 고침»을 통과시킨다. ㉢이 그 문을 닫는다.
 *
 * ⛔이 판정이 «안 덮는» 축(고침 주석이 스스로 적어 둔 한계와 같다):
 *   · 사용자가 «그리드 칸»에 기본 문구와 똑같은 문장을 직접 쓴 경우 — 이 데이터 모델에선
 *     line.text 가 기본 문구와 «같은 값»이라 안내문구와 구별할 방법이 없다(둘이 한 상태다).
 *     ⇒ 일부러 게이트로 걸지 않는다. 대신 그 수를 «적어서» 돌려준다(gridSameTextTyped).
 *   · 전체 섹션 내보내기·HTML 내보내기 · 그리드 «배지» 줄 · 중첩 그리드.
 *
 * 양성대조(이 그물이 진짜로 그 자리를 잡는지): 고침만 되돌리면 ㉠이 빨개져야 한다 —
 *   git show 49c5a79 -- js/blocks/grid-block.js | git apply -R -
 *   → ★node tests/e2e/reload-page.mjs <port>   (「앱 새로고침」을 이것으로 해라 — 안 하면 옛 모듈이
 *     그대로 돌아 «되돌렸는데 초록» 이 나고 「양성대조 통과」라는 거짓 판정이 난다)
 *   → 이 검사
 *   ⛔끝나면 반드시 git checkout -- js/blocks/grid-block.js
 *
 * 실행: npm run test:cdp:t085 -- <port>      (저장소 뿌리에서)
 *   = node tests/e2e/check-t085.mjs [port]
 *   ★앱은 미리 «격리 프로필»로 그 포트에 띄워 두어야 한다(이 검사는 앱을 안 띄운다):
 *     electron . --remote-debugging-port=<port> --remote-allow-origins='*' \
 *                --user-data-dir=<격리폴더> --disable-renderer-backgrounding \
 *                --disable-background-timer-throttling --disable-backgrounding-occluded-windows admin
 *   ★띄운 «직후» 로그에서 「[projects] 뿌리=…」가 그 격리폴더인지 확인해라.
 */
import { connect } from './lib/cdp.mjs';
import { freshProject } from './lib/board.mjs';
import { addSection, addText, clickTool, insertFromMenu, centerOf, clickEmptyCanvas } from './lib/ui.mjs';

const PORT = Number(process.argv[2] || process.env.PORT || 9531);
const GRID_PH = '내용을 입력하세요.';
const R = { card: 'T-085', checks: [] };
const add = (id, quantity, measured, pass, note) => R.checks.push({ id, quantity, measured, pass, note });

const s = await connect(PORT, '');
await freshProject(s);
await s.sleep(1500);

/** 그 섹션을 «앱의 내보내기 길»로 뽑아 픽셀을 센다.
 *  ph = 그리드 글자색 rgb(85,85,85) 정확 일치 · dark = 어두운 픽셀(글자 유무의 굵은 지표). */
const exportCount = (secId) => s.eval(`
  const sec = document.getElementById(${JSON.stringify(secId)});
  if (!sec) return { error: 'section 없음' };
  const url = await window.exportSection(sec, 'png', 860, { returnDataUrl: true });
  if (!url || !String(url).startsWith('data:image')) return { error: '내보내기가 그림을 안 돌려줬다: ' + String(url).slice(0, 60) };
  const img = new Image(); img.src = url; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let dark = 0, ph = 0, nonwhite = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i+1], b = d[i+2];
    if (r === 85 && g === 85 && b === 85) ph++;
    if (Math.max(r, g, b) < 200) dark++;
    if (!(r > 250 && g > 250 && b > 250)) nonwhite++;
  }
  return { w: img.width, h: img.height, dark, ph, nonwhite };`);

/** 캔버스의 글자를 «진짜로» 고쳐 쓴다 — 더블클릭해 편집으로 들어가고 글자마다 진짜 키. */
async function typeInto(selectorJs, text) {
  const p = await centerOf(s, selectorJs);
  if (!p?.visible || !p.hitInside) throw new Error(`편집할 자리를 못 잡았다: ${JSON.stringify(p)}`);
  await s.dblclick(p.x, p.y, { gapMs: 90 });
  await s.sleep(500);
  const editing = await s.eval(`return document.querySelectorAll('[contenteditable=true]').length`);
  if (!editing) throw new Error('더블클릭해도 편집으로 안 들어갔다');
  await s.selectAllInField();
  await s.sleep(80);
  await s.type(text);
  await s.sleep(300);
  await clickEmptyCanvas(s);      // 커밋
  await s.sleep(500);
}

/* ── ㉠ 손 안 댄 그리드: 기본 문구는 산출물에 «없어야» 한다 ── */
await addSection(s);
await insertFromMenu(s, '컴포넌트 블록 추가', 'Grid');
await s.sleep(500);
const g1 = await s.eval(`
  const g = document.querySelector('.grid-block');
  return g ? { grid: g.id, sec: g.closest('.section-block').id,
               lines: [...g.querySelectorAll('.grd-line')].map(e => ({ t: (e.textContent||'').trim(), ph: e.dataset.isPlaceholder || null })) } : null;`);
if (!g1) { console.log(JSON.stringify({ ...R, fatal: 'Grid 블럭이 안 들어갔다' }, null, 2)); s.close(); process.exit(1); }
await clickEmptyCanvas(s);
const pxUntouched = await exportCount(g1.sec);
add('T-085/placeholder-not-printed', '㉠ 손 안 댄 그리드 — 내보낸 그림의 안내문구색 픽셀 수 (0 이어야 한다)',
  { section: g1.sec, lines: g1.lines, px: pxUntouched },
  !pxUntouched.error && pxUntouched.ph === 0 && pxUntouched.dark === 0,
  pxUntouched.error || `안내문구색 ${pxUntouched.ph}px · 어두운 ${pxUntouched.dark}px (${pxUntouched.w}×${pxUntouched.h})`);

/* ── ㉡ 사용자가 그 칸에 «다른» 글자를 쓰면 찍혀야 한다 ── */
await typeInto(`document.querySelectorAll('.grd-line')[0]`, '실제본문입니다');
const after = await s.eval(`return [...document.querySelectorAll('.grd-line')].map(e => ({ t: (e.textContent||'').trim(), ph: e.dataset.isPlaceholder || null }))`);
const pxTyped = await exportCount(g1.sec);
add('T-085/user-text-printed', '㉡ 사용자가 쓴 «다른» 글자 — 내보낸 그림에 찍히는가 (>0 이어야 한다)',
  { lines: after, px: pxTyped },
  !pxTyped.error && pxTyped.ph > 0,
  /* ⛔이 줄은 «찍히는가»만 말한다. 남은 안내문구 칸이 숨었는지는 ㉠ 이 재는 것이지
     이 수로는 못 가른다 — 고침을 되돌린 판에서 이 수에 안내문구 픽셀이 섞여 들어온다
     (실측 2026-09-22: 되돌린 판 827px vs 고친 판 365px). 그래서 여기서 그 말을 하지 않는다. */
  pxTyped.error || `안내문구색 ${pxTyped.ph}px · 어두운 ${pxTyped.dark}px`);

/* ── 게이트로 «안» 거는 축: 그리드 칸에 똑같은 문장을 쓴 경우 (수만 적는다) ── */
let gridSameTextTyped = null;
try {
  await typeInto(`document.querySelectorAll('.grd-line')[1]`, GRID_PH);
  const linesNow = await s.eval(`return [...document.querySelectorAll('.grd-line')].map(e => ({ t: (e.textContent||'').trim(), ph: e.dataset.isPlaceholder || null, dph: e.dataset.placeholder || null }))`);
  const pxGridSame = await exportCount(g1.sec);
  gridSameTextTyped = { lines: linesNow, pxBefore: pxTyped, px: pxGridSame, note: '이 데이터 모델에선 line.text 가 기본 문구와 «같은 값»이라 안내문구와 구별할 수단이 없다 — 판정하지 않고 수만 남긴다' };
} catch (e) { gridSameTextTyped = { error: e.message }; }
R.notGated = { gridSameTextTyped };

/* ── ㉢ ★핵심 음성대조: 사용자가 «똑같은 문장»을 글자 블럭에 직접 쓴 경우 ── */
await addSection(s);
const secs = await s.eval(`return [...document.querySelectorAll('.section-block')].map(e => e.id)`);
const sec2 = secs[secs.length - 1];
await addText(s, 'Body');
const tb = await s.eval(`
  const sec = document.getElementById(${JSON.stringify(sec2)});
  const t = sec.querySelector('.text-block'); return t ? t.id : null;`);
if (!tb) { console.log(JSON.stringify({ ...R, fatal: '둘째 섹션에 글자 블럭이 안 들어갔다' }, null, 2)); s.close(); process.exit(1); }
await clickEmptyCanvas(s);
const pxSameBefore = await exportCount(sec2);   // ★기준선 — 이 섹션이 «타이핑 전»에 이미 검은 픽셀을 갖고 있으면 초록이 거짓이 된다
await typeInto(`document.querySelector('#${tb} .tb-body, #${tb} .tb-h1, #${tb} .tb-h2, #${tb} .tb-h3')`, GRID_PH);
const tbState = await s.eval(`
  const el = document.querySelector('#${tb} .tb-body, #${tb} .tb-h1, #${tb} .tb-h2, #${tb} .tb-h3');
  return { text: (el.textContent||'').trim(), ph: el.dataset.isPlaceholder || null, dph: el.dataset.placeholder || null,
           sameAsGridDefault: (el.textContent||'').trim() === ${JSON.stringify(GRID_PH)} };`);
const pxSame = await exportCount(sec2);
add('T-085/identical-user-text-still-printed',
  '㉢ 사용자가 «그리드 기본 문구와 똑같은 문장»을 직접 쓴 글자 — 내보낸 그림에 찍히는가 (>0 이어야 한다)',
  { block: tb, state: tbState, pxBefore: pxSameBefore, pxAfter: pxSame },
  !pxSame.error && !pxSameBefore.error && tbState.sameAsGridDefault === true
    && pxSameBefore.dark === 0 && pxSame.dark > 0,
  pxSame.error || pxSameBefore.error
    || `쓴 글자="${tbState.text}"(기본문구와 같음=${tbState.sameAsGridDefault}) · 어두운 ${pxSameBefore.dark}px → ${pxSame.dark}px`);

console.log(JSON.stringify(R, null, 2));
s.close();
