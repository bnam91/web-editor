/* board.mjs — «판 만들기»는 앱의 진짜 길로 한다.
 * ⛔여기서 DOM 을 손으로 만들어 두고 재면, 실제 경로에서만 나는 결함을 못 잡는다.
 *   그래서 블럭 넣기는 도구막대 단추를 «진짜로 누른다».
 */

/** 갤러리에 있으면 New Design 을 진짜 눌러 에디터로 들어간다. */
export async function ensureEditor(s) {
  const where = await s.eval(`return location.pathname`);
  if (where.includes('index.html')) return 'already-editor';
  if (!where.includes('projects.html')) throw new Error('unknown page: ' + where);
  const pos = await s.eval(`
    const b = document.getElementById('btn-new'); if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  `);
  if (!pos) throw new Error('#btn-new 없음');
  const hit = await s.hit(pos.x, pos.y);
  if (!hit) throw new Error('#btn-new 자리에 아무것도 없다');
  await s.click(pos.x, pos.y);
  for (let i = 0; i < 60; i++) {
    await s.sleep(500);
    const p = await s.eval(`return location.pathname`).catch(() => '');
    if (String(p).includes('index.html')) { await s.sleep(2500); return 'created'; }
  }
  throw new Error('에디터로 안 넘어감');
}

/** 매 검사가 «자기 판»에서 돌게 — 홈 단추(진짜 클릭) → New Design(진짜 클릭)으로 새 프로젝트. */
export async function freshProject(s) {
  const p = await s.eval(`return location.pathname`);
  if (p.includes('index.html')) {
    const h = await s.eval(`
      const b = document.getElementById('home-btn'); if (!b) return null;
      const r = b.getBoundingClientRect(); return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) };`);
    if (!h) throw new Error('홈 단추 없음');
    await s.click(h.x, h.y);
    for (let i = 0; i < 40; i++) { await s.sleep(400); if ((await s.eval('return location.pathname').catch(() => '')).includes('projects.html')) break; }
    await s.sleep(1200);
  }
  return ensureEditor(s);
}

/** 도구막대에서 블럭 하나를 «진짜 클릭»으로 넣는다. label 은 단추의 글자/제목. */
export const TOOLBAR_CLICK_FN = `
async function __toolbarInsert(label) {
  const btns = [...document.querySelectorAll('button, .tool-btn, .comp-item, [role=button]')];
  const b = btns.find(el => {
    const t = ((el.innerText || '') + ' ' + (el.title || '') + ' ' + (el.dataset.type || '')).trim();
    return t === label || t.split(/\\s+/).includes(label);
  });
  if (!b) return null;
  const r = b.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return { found: true, visible: false };
  return { found: true, visible: true, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
}`;
