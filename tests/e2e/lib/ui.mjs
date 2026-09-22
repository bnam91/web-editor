/* ui.mjs — 앱의 «진짜 길»로 판을 만드는 손. 좌표는 매번 화면에서 다시 읽는다(앵커 고정 금지).
 * ⛔여기서 window.addTextBlock(...) 같은 내부 함수를 부르지 않는다 — 그건 하네스가 상태를
 *   «직접 만드는» 길이고, 실제 경로에서만 나는 결함을 못 잡는다.
 */

/** 화면에 «보이는» 요소의 한가운데 좌표. 안 보이면 null(0×0 유령을 좌표로 쓰지 않는다). */
export async function centerOf(s, selectorJs) {
  return s.eval(`
    const el = (${selectorJs});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return { visible: false, rect: [r.x, r.y, r.width, r.height] };
    const x = Math.round(r.x + r.width / 2), y = Math.round(r.y + r.height / 2);
    const hit = document.elementFromPoint(x, y);
    return { visible: true, x, y, hitInside: !!hit && (el.contains(hit) || hit.contains(el)),
             hit: hit && (hit.id || String(hit.className).slice(0, 60)) };
  `);
}

const byTitle = (sub) => `[...document.querySelectorAll('[title]')].find(e => (e.title||'').includes(${JSON.stringify(sub)}) && e.getBoundingClientRect().width > 0)`;
const menuItem = (label) => `[...document.querySelectorAll('.fp-menu-item')].find(e => (e.innerText||'').trim() === ${JSON.stringify(label)} && e.getBoundingClientRect().width > 0)`;

async function clickAt(s, pos, what) {
  if (!pos || !pos.visible) throw new Error(`${what}: 화면에 안 보인다 ${JSON.stringify(pos)}`);
  if (!pos.hitInside) throw new Error(`${what}: 그 좌표에 다른 것이 있다 — ${pos.hit}`);
  await s.click(pos.x, pos.y);
}

/** 하단 도구막대 단추를 title 로 찾아 «진짜로» 누른다. */
export async function clickTool(s, titleSub) {
  await clickAt(s, await centerOf(s, byTitle(titleSub)), `도구막대「${titleSub}」`);
  await s.sleep(400);
}

/** 도구막대 드롭다운을 열고 그 안의 항목을 «진짜로» 누른다. */
export async function insertFromMenu(s, titleSub, label) {
  await clickTool(s, titleSub);
  await clickAt(s, await centerOf(s, menuItem(label)), `메뉴「${label}」`);
  await s.sleep(600);
}

export const addSection = (s) => clickTool(s, '새 섹션 추가');
export const addFrame   = (s) => clickTool(s, 'Frame 추가');
export const addText    = (s, kind = 'Heading') => insertFromMenu(s, '텍스트 블록 추가', kind);
export const addShape   = (s, kind = 'Rectangle') => insertFromMenu(s, '도형 추가', kind);

/** 블럭을 «캔버스에서» 진짜 클릭해 고른다. shift=true 면 ⇧클릭(더하기). */
export async function clickBlock(s, id, { shift = false } = {}) {
  const pos = await centerOf(s, `document.getElementById(${JSON.stringify(id)})`);
  if (!pos || !pos.visible) throw new Error(`블럭 ${id} 이 화면에 없다`);
  await s.click(pos.x, pos.y, { modifiers: shift ? 8 : 0 });
  await s.sleep(350);
  return pos;
}

/** 패널 칸에 «사람처럼» 값을 넣는다 — 진짜 클릭으로 잡고, ⌘A 로 전부 고른 뒤, 글자마다 진짜 키.
 *  ⛔Input.insertText 금지: 숫자칸 커밋가드의 «타이핑 유예»가 안 걸려 사람 경로와 달라진다.
 *  ⛔Backspace 를 세어 지우지 마라: 칸이 이미 포커스를 갖고 있으면 focusin 자동 전체선택
 *    (js/editor.js:111 _AUTO_SELECT_SEL)이 «안» 돌아 캐럿이 클릭한 자리에 남는다 —
 *    실측(2026-09-22, 9531): "1000" 에 8번 지우기 → "0" 이 남고 "300" 을 쳐서 "3000" 이 됐다.
 *  ★칸 안에서의 ⌘A 는 에디터가 «일부러» 무시한다(js/editor.js:2408 INPUT 가드) — 캔버스
 *    전체선택으로 새지 않는다. */
export async function fillField(s, id, text, { clearOnly = false } = {}) {
  const p = await centerOf(s, `document.getElementById(${JSON.stringify(id)})`);
  if (!p?.visible) throw new Error(`칸 ${id} 이 화면에 안 보인다: ${JSON.stringify(p)}`);
  if (!p.hitInside) throw new Error(`칸 ${id} 자리에 다른 것이 있다: ${p.hit}`);
  await s.click(p.x, p.y);
  await s.sleep(150);
  await s.selectAllInField();       // 칸 안 «글자» 전체선택(맥은 commands 로 실어 보내야 돈다)
  await s.sleep(80);
  if (clearOnly) { await s.backspace(); await s.sleep(80); return p; }
  await s.type(text);
  await s.sleep(120);
  return p;
}

/** 빈 캔버스 자리를 눌러 선택을 푼다. */
export async function clickEmptyCanvas(s) {
  const pos = await s.eval(`
    const w = document.getElementById('canvas-area') || document.getElementById('canvas-wrap');
    const r = w.getBoundingClientRect();
    const x = Math.round(r.x + r.width - 40), y = Math.round(r.y + 60);
    const hit = document.elementFromPoint(x, y);
    return { x, y, hit: hit && (hit.id || String(hit.className).slice(0, 40)) };
  `);
  await s.click(pos.x, pos.y);
  await s.sleep(250);
  return pos;
}
