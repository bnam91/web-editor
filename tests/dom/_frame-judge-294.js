/* _frame-judge-294 — 프레임 시험의 공용 자(t9-03 J294J). frame-fuzz-294 의 판정 여섯 · 진짜 마우스 고르기를 이 한 자리에 둔다. 뒤의 t9-04 도 이걸 쓴다.
 * 읽는 쪽: frame-fuzz-294 · frame-matrix-294 · block-matrix-294. */
/* 페이지 안 도움 — 상태 읽기(살아 있는 나무든 DOMParser 나무든 같은 자) */
const PAGE_LIB = () => {
  const FR = '.frame-block:not([data-text-frame])';
  window.__readState = (root) => {
    const frames = {}; const texts = {}; const dupes = [];
    const seen = new Set(); const mark = (id) => { if (seen.has(id)) dupes.push(id); seen.add(id); };
    root.querySelectorAll(FR).forEach((f) => { mark(f.id);
      const chain = []; let cyc = false; for (let p = f.parentElement?.closest(FR); p; p = p.parentElement?.closest(FR)) { if (p.id === f.id || chain.includes(p.id)) { cyc = true; break; } chain.push(p.id); }
      frames[f.id] = { parent: f.parentElement?.closest(FR)?.id || null, order: [...root.querySelectorAll(FR)].indexOf(f), cyc, w: f.dataset.width ?? f.style.width ?? '', h: f.dataset.height ?? f.style.height ?? '' }; });
    root.querySelectorAll('.text-block').forEach((t) => { mark(t.id);
      const holder = t.closest(FR); texts[t.id] = { frame: holder?.id || null, text: (t.querySelector('.tb-body') || t).textContent.trim() }; });
    return { frames, texts, dupes };
  };
  window.__live = () => window.__readState(document.getElementById(window.__sec));
  /* J294G ① 파일 망가뜨리기 — 첫 ss_ 는 섹션 기본 글자의 data-text-frame 이라 canon 밖이었다(실측 · 옛 양성이 초록인 까닭) ⇒ canon 이 읽는 진짜 프레임에만 닿는다. 닿았는지를 돌려준다(안 닿으면 빨강이 안 나도 «안 잰 것»). */
  window.__mangleFile = (d, kind) => { const page = d.pages.find((x) => x.id === d.currentPageId) || d.pages[0]; const doc = new DOMParser().parseFromString('<div id="r">' + page.canvas + '</div>', 'text/html'); const sec = doc.getElementById(window.__sec); if (!sec) return false;
    const fs = [...sec.querySelectorAll(FR)]; let done = false;
    if (kind === 's' && fs[0]) { fs[0].id = 'INJECT'; done = true; }
    if (kind === 'sp') { const inner = fs.find((f) => f.parentElement.closest(FR)); const top = fs.find((f) => !f.parentElement.closest(FR)); const other = fs.find((f) => f !== top && !top?.contains(f));
      if (inner) { inner.parentElement.closest(FR).parentElement.appendChild(inner); done = true; } else if (top && other) { top.appendChild(other); done = true; } }
    if (kind === 'so') { const a = fs.find((f) => fs.some((g) => g !== f && g.parentElement === f.parentElement)); if (a) { const b = fs.filter((g) => g !== a && g.parentElement === a.parentElement).pop(); b.after(a); done = true; } }
    if (kind === 'st') { const t = sec.querySelector(FR + ' .text-block'); if (t) { (t.querySelector('.tb-body') || t).textContent = 'INJECT'; done = true; } }
    if (done) page.canvas = doc.getElementById('r').innerHTML; return done; };
  window.__saved = () => { const d = new DOMParser().parseFromString('<div id="r">' + window.getSerializedCanvas() + '</div>', 'text/html'); return window.__readState(d.getElementById('r').querySelector('#' + CSS.escape(window.__sec))); };
};
const canon = (s) => JSON.stringify({ f: Object.keys(s.frames).sort().map((k) => [k, s.frames[k].parent, s.frames[k].order, s.frames[k].w, s.frames[k].h]), t: Object.keys(s.texts).sort().map((k) => [k, s.texts[k].frame, s.texts[k].text]) });

const live = (page) => page.evaluate(() => window.__live());
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
/* 고르기 = 진짜 마우스 — selectBlock 은 프레임을 못 고른다(첫 판 흠 · 조작 대부분 skip). t902 pick 꼴: 그 프레임 상자 안 ∧ 다른(조상 아닌) 프레임·글자 밖 점. 깊이 1 = 더블클릭 · 깊이 2 = 더블클릭 뒤 클릭(들어간 프레임 ≠ 고른 것 · C3b) */
async function select(page, id, depth, { enter = false, chain = null } = {}) {
  let last = { sel: false, why: '안 함' };
  for (let tries = 1; tries <= 3; tries++) {   // 고르기 흔들림은 판정 밖 전제다 — 조건을 재서 다시(t902 C3 도 같은 흔들림) · ⚠️시도 수는 기록에 안 남긴다(남기면 같은 시드 ×3 비교가 흔들린다)
    await page.keyboard.press('Escape');
    await page.evaluate(() => { window.deselectAll?.(); window._activeFrame = null; window._enteredFrame = null; document.activeElement?.blur?.(); });
    await page.evaluate((id) => document.getElementById(id)?.scrollIntoView({ block: 'center' }), id);
    await settle(page);
    const q = await page.evaluate((id) => { const FR = '.frame-block:not([data-text-frame])'; const o = document.getElementById(id); if (!o) return { ok: false }; const r = o.getBoundingClientRect();
      const others = [...document.querySelectorAll('#canvas ' + FR + ', #canvas .text-block, #canvas .gap-block')].filter((f) => f !== o && !f.contains(o)).map((f) => f.getBoundingClientRect());
      const inR = (x, y, b) => x > b.left && x < b.right && y > b.top && y < b.bottom;
      /* 화면에 보이는 몫에서만 집는다 — 창보다 큰 프레임은 scrollIntoView 뒤에도 네 귀가 화면 밖이라 빈 곳을 눌렀다(J294I 앱 값: 점 y=-182 · 맞힌 것 null · 고르기 안 섬 5칸의 원인) · 패널이 덮은 점도 뺀다 */
      const wrap = document.getElementById('canvas-wrap').getBoundingClientRect();
      const L = Math.max(r.left, wrap.left), T = Math.max(r.top, wrap.top), R = Math.min(r.right, wrap.right), B = Math.min(r.bottom, wrap.bottom);
      const pts = [[R - 6, B - 6], [L + 6, B - 6], [R - 6, T + 6], [L + 6, T + 6], [(L + R) / 2, (T + B) / 2], [(L + R) / 2, B - 6], [(L + R) / 2, T + 6], [L + 6, (T + B) / 2], [R - 6, (T + B) / 2]];
      const onCanvas = (x, y) => !!document.elementFromPoint(x, y)?.closest('#canvas');
      for (const [x, y] of pts) if (inR(x, y, r) && onCanvas(x, y) && !others.some((b) => inR(x, y, b))) return { x, y, ok: true };
      return { ok: false, pts }; }, id);
    if (!q.ok) {
      if (!depth || !chain?.length) { last = { sel: false, why: '집을 점 없음', tries, pts: q.pts || [] }; break; }
      /* 조상이 잡히면 그 조상에 들어간 뒤 다시 집는다(지디 J294C ㉢ · 사람 순서) — 한 겹씩 더블클릭 · 그 뒤 맨 위가 대상이면 누른다 */
      const pts = q.pts; const ptOf = () => page.evaluate(([id, pts]) => { const FR = '.frame-block:not([data-text-frame])'; const o = document.getElementById(id);
        for (const [x, y] of pts) { const e = document.elementFromPoint(x, y); if (e && e.closest(FR) === o) return [x, y]; } return null; }, [id, pts]);
      for (const anc of chain) {
        const ap = await page.evaluate(([a, pts]) => { const r = document.getElementById(a)?.getBoundingClientRect(); return r ? (pts.find(([x, y]) => x > r.left && x < r.right && y > r.top && y < r.bottom) || null) : null; }, [anc, pts]);
        if (ap) { await page.mouse.dblclick(ap[0], ap[1]); await settle(page); }
      }
      const hit = await ptOf();
      if (!hit) { last = { sel: false, why: '들어가도 못 집음', tries, pts, via: 'descend' }; continue; }
      await page.mouse.click(hit[0], hit[1]); await settle(page);
      last = await page.evaluate((id) => { document.activeElement?.blur?.(); return { sel: !!document.getElementById(id)?.classList.contains('selected'), entered: window._enteredFrame?.id || null, selected: [...document.querySelectorAll('#canvas .selected')].map((e) => e.id) }; }, id);
      last.tries = tries; last.via = 'descend';
      if (last.sel) return last;
      last.why = '들어가 눌렀어도 안 골라짐'; last.pts = pts;
      continue;
    }
    if (depth === 0) await page.mouse.click(q.x, q.y);
    else if (depth === 1) await page.mouse.dblclick(q.x, q.y);
    else {
      for (let i = 0; i < depth - 1; i++) { await page.mouse.dblclick(q.x, q.y); await page.waitForFunction(() => !!document.querySelector('#canvas .frame-block.selected'), null, { timeout: 2000 }).catch(() => {}); }
      if (enter) await page.mouse.dblclick(q.x, q.y); else await page.mouse.click(q.x, q.y);
      if (enter) await page.waitForFunction((id) => document.getElementById(id)?.classList.contains('selected') && window._enteredFrame?.id === id, id, { timeout: 2000 }).catch(() => {});
    }
    await settle(page);
    last = await page.evaluate((id) => { document.activeElement?.blur?.(); return { sel: !!document.getElementById(id)?.classList.contains('selected'), entered: window._enteredFrame?.id || null, selected: [...document.querySelectorAll('#canvas .selected')].map((e) => e.id) }; }, id);
    last.tries = tries;
    if (last.sel && (!enter || last.entered === id)) return last;
    if (last.selected?.length && !last.sel) last.why = '다른 것이 골라짐';
  }
  /* 화면에서 못 집는 프레임(자식·형제가 다 덮었다)은 사람도 레이어 패널 줄로 고른다 — 진짜 마우스, 안 보이는 줄이면 줄의 click */
  if (!enter) {
    const row = await page.evaluate((id) => { const o = document.getElementById(id); if (!o) return null; if (!o._layerItem) window.buildLayerPanel?.(); const it = o._layerItem; const el = it?.matches?.('.layer-row-header, .layer-row') ? it : it?.querySelector?.(':scope > .layer-row-header, :scope > .layer-row') || it; if (!el) return null; el.scrollIntoView({ block: 'center' }); const q = el.getBoundingClientRect(); const x = q.left + q.width / 2, y = q.top + q.height / 2; if (q.width && q.height && el.contains(document.elementFromPoint(x, y))) return { x, y }; el.click(); return { dom: true }; }, id);
    if (row) {
      if (!row.dom) await page.mouse.click(row.x, row.y);
      await settle(page);
      const p = await page.evaluate((id) => { document.activeElement?.blur?.(); return { sel: !!document.getElementById(id)?.classList.contains('selected'), entered: window._enteredFrame?.id || null, selected: [...document.querySelectorAll('#canvas .selected')].map((e) => e.id) }; }, id);
      if (p.sel) return { ...p, tries: last.tries, via: row.dom ? 'panel-dom' : 'panel' };
      last.why = last.why || '패널 줄로도 안 골라짐';
    }
  }
  return last;
}
async function judge(page, st, want, extra = []) {
  const fails = [...extra];
  for (const [id, f] of Object.entries(st.frames)) if (f.cyc) fails.push(['b', `순환: ${id}`]);
  if (st.dupes.length) fails.push(['c', `id 겹침 ${st.dupes.join(',')}`]);
  if (want) {
    const fa = Object.keys(st.frames).sort(); const fb = Object.keys(want.frames).sort();
    if (JSON.stringify(fa) !== JSON.stringify(fb) || Object.keys(st.texts).sort().join() !== Object.keys(want.texts).sort().join()) fails.push(['c', `id 집합 다름: 있음 ${fa.length}/기대 ${fb.length}`]);
    for (const k of fa) if (want.frames[k] && want.frames[k].parent !== st.frames[k].parent) fails.push(['a', `${k} 부모 ${st.frames[k].parent} ≠ 기대 ${want.frames[k].parent}`]);
  }
  const sv = await page.evaluate(() => window.__saved());
  if (canon(sv) !== canon(st)) fails.push(['f', '저장물을 읽은 상태 ≠ 지금']);
  return fails;
}

/* ★사용자 눈(J294J ⑵) — 구조 자가 안 보는 자리·겹침·선택. 레이아웃 px 로 잰다(배율에 안 흔들린다). */
const EYE_LIB = () => {
  const FR = '.frame-block:not([data-text-frame])';
  window.__eyeSnap = () => { const sec = window.__secEl(); const out = { boxes: {}, secH: sec.offsetHeight, selected: [...sec.querySelectorAll(FR + '.selected')].map((f) => f.id) };
    sec.querySelectorAll(FR).forEach((f) => { const p = f.parentElement.closest(FR); out.boxes[f.id] = { parent: p?.id || null, abs: getComputedStyle(f).position === 'absolute', l: f.offsetLeft, t: f.offsetTop, w: f.offsetWidth, h: f.offsetHeight, pw: p ? p.clientWidth : sec.clientWidth, ph: p ? p.clientHeight : sec.clientHeight }; });
    return out; };
};
/* 조작 앞뒤 눈금을 견준다. targets = 조작한 프레임(그 자손은 함께 움직여도 된다). 값이 애매하면 결함이 아니라 «이상함 후보»로 돌려준다. */
function eyeDiff(before, after, targets, { copies = [], moved = [], expectSelected = null } = {}) {
  const odd = [];
  const under = (id, st) => { for (let p = id; p; p = st.boxes[p]?.parent) if (targets.includes(p)) return true; return false; };
  for (const [id, b] of Object.entries(before.boxes)) { const a = after.boxes[id]; if (!a || under(id, before)) continue;
    if (b.abs && (a.l !== b.l || a.t !== b.t || a.w !== b.w || a.h !== b.h)) odd.push(['남이 변함', id, [b.l, b.t, b.w, b.h], [a.l, a.t, a.w, a.h]]); if (a.parent !== b.parent) odd.push(['남의 부모 변함', id]); }
  for (const id of copies) { const c = after.boxes[id]; if (!c) continue;
    for (const [o, b] of Object.entries(after.boxes)) if (o !== id && !copies.includes(o) && b.parent === c.parent && b.abs && c.abs && b.l === c.l && b.t === c.t && b.w === c.w && b.h === c.h) odd.push(['원본과 겹침', id, o]); }
  for (const id of [...copies, ...moved]) { const c = after.boxes[id]; if (c && c.abs && (c.l < 0 || c.t < 0 || c.l + c.w > c.pw || c.t + c.h > c.ph)) odd.push(['부모 밖', id, [c.l, c.t, c.w, c.h], [c.pw, c.ph]]); }
  if (after.secH !== before.secH) odd.push(['섹션 높이 변함', before.secH, after.secH]);
  if (expectSelected && JSON.stringify([...after.selected].filter((i) => !after.boxes[i] || expectSelected.includes(i) || !expectSelected.some((e) => { for (let p = after.boxes[e]?.parent; p; p = after.boxes[p]?.parent) if (p === i) return true; return false; })).sort()) !== JSON.stringify([...expectSelected].sort())) odd.push(['선택 어긋남', after.selected, expectSelected]);
  return odd;
}
/* 프레임 자기 몫의 점(자식·형제가 안 덮은 곳) — 끌기 시작점. 없으면 null */
const ownPoint = (page, id) => page.evaluate((id) => { const FR = '.frame-block:not([data-text-frame])'; const o = document.getElementById(id); if (!o) return null; const r = o.getBoundingClientRect(); const wrap = document.getElementById('canvas-wrap').getBoundingClientRect();
  const L = Math.max(r.left, wrap.left), T = Math.max(r.top, wrap.top), R = Math.min(r.right, wrap.right), B = Math.min(r.bottom, wrap.bottom);
  const others = [...document.querySelectorAll('#canvas ' + FR + ', #canvas .text-block, #canvas .gap-block')].filter((f) => f !== o && !f.contains(o)).map((f) => f.getBoundingClientRect());
  const inR = (x, y, b) => x > b.left && x < b.right && y > b.top && y < b.bottom;
  for (const [x, y] of [[(L + R) / 2, (T + B) / 2], [R - 6, B - 6], [L + 6, B - 6], [R - 6, T + 6], [(L + R) / 2, B - 6], [R - 6, (T + B) / 2]]) if (inR(x, y, r) && !others.some((b) => inR(x, y, b))) return [x, y];
  return null; }, id);
/* 진짜 마우스 끌기 — 화면 이동량 ÷ 손 이동량을 돌려준다 */
async function dragRatio(page, id, from, dx, dy) {
  const at = () => page.evaluate((id) => { const r = document.getElementById(id)?.getBoundingClientRect(); return r ? [r.left, r.top] : null; }, id);
  const a = await at(); await page.mouse.move(from[0], from[1]); await page.mouse.down(); await page.mouse.move(from[0] + dx, from[1] + dy, { steps: 10 }); await settle(page); await page.mouse.up(); await settle(page);
  const b = await at(); if (!a || !b) return null; return { x: dx ? +((b[0] - a[0]) / dx).toFixed(2) : null, y: dy ? +((b[1] - a[1]) / dy).toFixed(2) : null };
}
/* 저장 후 다시 열기(메모리 왕복) — serializeProject → applyProjectData */
async function reopen(page) { await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); }); await settle(page); }
module.exports = { PAGE_LIB, EYE_LIB, canon, live, settle, select, judge, eyeDiff, ownPoint, dragRatio, reopen };
