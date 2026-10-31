/* frame-fuzz-294.dom.spec.js — 294 t9-03 첫 조각: 프레임 중첩 복사 «적대적 QA» 하네스(④) ＋ 판정부(⑤) (S6 · 261031 · 지디 ORDER-294)
 * ★왜: 현빈 원문 «무작위 조작을 실행하는 것 자체는 검증이 아니다» ⇒ 매 조작 뒤 판정 여섯 칸이 모델과 맞대어 본다. 판정 없는 회차는 «안 잰 회차»(measured 로 센다).
 * ★입구: 프레임·글자는 addFrameBlock·addTextBlock(_activeFrame) · 고르기 진짜 마우스 · 조작 = 진짜 키(⌘D ⌘Z ⌘⇧Z Delete) ＋ moveBlock·updateFrameBlock·groupSelectedBlocks. ⛔DOM 손 짜기 0.
 * ★크기: 깊이 ≤3 · 프레임 ≤6 · 조작 ≤8(urun·zdeep 은 한 조작에 ⌘Z·⌘⇧Z 여러 번) · 시드 5 ＋ undo·redo 연달아 5 ＋ 쌓임≥2 보장 5 — ⑥ 극한은 밖.
 * ★판정 여섯(모델 = 조작마다 기대를 세운 표):
 *   ⒜ 부모: 프레임마다 실제 부모 프레임 id = 모델 ⒝ 순환: 부모 사슬을 올라가 같은 id 를 두 번 안 만나고 섹션에 닿는다(DOM 이 나무라 ★같은 id 겹침만 본다)
 *   ⒞ 중복·유실: 프레임·글자 id 집합 = 모델 · 겹침 0 ⒟ 복사본: 새 부분나무의 꼴·글자·크기 = 원본(그 복사 순간 값)
 *   ⒠ ⌘Z/⌘⇧Z: 뒤 상태 = 모델 되돌림 칸 ⒡ 저장: getSerializedCanvas 를 DOMParser 로 읽은 상태 = 지금 · 끝에 ★innerHTML+rebindAll 재로드 뒤 같은 꼴
 * ★못 집은 회차: 조상에 들어가 다시 집기(via descend) · 그래도 못 집으면 후보 점마다 hitAt 으로 맨 위 임자를 rec.owners 에(시트 328 재료) · 고르기 시도 수는 옆 파일 *.tries.json.
 * ★재현: 시드·초기 구조·조작 순서·칸별 판정을 FUZZ_OUT(기본 test-results/frame-fuzz-294)/<RUN_TAG>-<시드>.json · id 는 F0·T0 이름으로 정규화 ⇒ 같은 시드 ×3 은 파일 내용이 같아야 한다.
 * ★양성 둘: P287(알려진 꼴 — 진입 상태 ⌘D · 음성 P287N) · FUZZ_INJECT=a|b|c|d|e|f(칸마다 일부러 망가뜨려 그 칸이 빨개지나 · 평소 끔). V265 = 값만.
 * ⚠️⌘Z 칸 trace 번호: urun 안 빨강은 그 앞까지 끝난 조작 수로 적힌다.
 * ⚠️자 한계: 모델은 그룹을 «부모만 새 그룹으로 옮겨도 된다» 로 너그럽게 본다 · 좌표·겹침 안 봄 · 진입 상태는 시드에서 안 뽑음(P287 만) · 재로드 = 열기 경로 두 줄(파일 왕복 아님).
 * ⌘Z 앞 부름 = evaluate · getSerializedCanvas · DOMParser · 스크린샷 0(JNOTE). */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp } = require('./_root-harness.js');
const { hitAt } = require('./_click-at.js');

const SEEDS = [294001, 294002, 294003, 294004, 294005];
const SEEDS_UR = [294101, 294102, 294103, 294104, 294105];   // ㉡ undo·redo 를 연달아 3~5 번 쌓는 회차(지디 J294B)
const SEEDS_DEEP = [294201, 294202, 294203, 294204, 294205];   // 쌓임 ≥2 를 보장하는 회차(지디 J294C ㉠) — 조작 둘 이상 뒤에만 ⌘Z
const LIM = { depth: 3, frames: 6, ops: 8 };
const TAG = process.env.FUZZ_TAG || 'run';
const OUT = process.env.FUZZ_OUT || path.join(__dirname, '..', '..', 'test-results', 'frame-fuzz-294');
const INJECT = process.env.FUZZ_INJECT || '';
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

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
  window.__saved = () => { const d = new DOMParser().parseFromString('<div id="r">' + window.getSerializedCanvas() + '</div>', 'text/html'); return window.__readState(d.getElementById('r').querySelector('#' + CSS.escape(window.__sec))); };
};
const canon = (s) => JSON.stringify({ f: Object.keys(s.frames).sort().map((k) => [k, s.frames[k].parent, s.frames[k].order, s.frames[k].w, s.frames[k].h]), t: Object.keys(s.texts).sort().map((k) => [k, s.texts[k].frame, s.texts[k].text]) });

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(PAGE_LIB);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop(); window.__sec = sec.id;
    window.__secEl = () => document.getElementById(window.__sec);
  });
  return errs;
}
/* ⑴ 구조 생성기 — 앱 입구로 나무를 짓는다 */
async function buildTree(page, r) {
  const n = 3 + Math.floor(r() * (LIM.frames - 2));   // 3~6
  const plan = []; const depth = [];
  for (let i = 0; i < n; i++) {
    const cand = depth.map((d, j) => (d + 1 < LIM.depth ? j : -1)).filter((j) => j >= 0);
    const parent = i === 0 || r() < 0.3 || !cand.length ? -1 : cand[Math.floor(r() * cand.length)];
    plan.push(parent); depth.push(parent < 0 ? 0 : depth[parent] + 1);
  }
  const ids = await page.evaluate((plan) => {
    const FR = '.frame-block:not([data-text-frame])'; const sec = window.__secEl(); const out = [];
    plan.forEach((p, i) => {
      window.deselectAll?.(); window.selectSection(sec); window._activeFrame = p < 0 ? null : document.getElementById(out[p]);
      const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x));
      if (!f) throw new Error('전제: 프레임 ' + i + ' 안 섬'); out.push(f.id);
      window.deselectAll?.(); window.selectSection(sec); window._activeFrame = f;
      const tb = new Set(sec.querySelectorAll('.text-block')); window.addTextBlock('body'); const t = [...sec.querySelectorAll('.text-block')].find((x) => !tb.has(x));
      if (t) { const body = t.querySelector('.tb-body') || t; body.textContent = 'T' + i; }
    });
    window.deselectAll?.(); window._activeFrame = null; window.clearHistory?.();
    return out;
  }, plan);
  return { plan, ids };
}
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
      const pts = [[r.right - 6, r.bottom - 6], [r.left + 6, r.bottom - 6], [r.right - 6, r.top + 6], [r.left + 6, r.top + 6], [r.left + r.width / 2, r.top + r.height / 2]];
      for (const [x, y] of pts) if (inR(x, y, r) && !others.some((b) => inR(x, y, b))) return { x, y, ok: true };
      return { ok: false, pts }; }, id);
    if (!q.ok) {
      if (!depth || !chain?.length) return { sel: false, why: '집을 점 없음', tries, pts: q.pts || [] };
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
  return last;
}
const depthOf = (st, id) => { let d = 0; for (let p = st.frames[id]?.parent; p; p = st.frames[p]?.parent) d++; return d; };
const tipOf = (page) => page.evaluate(() => { const h = window.getHistoryTip(); return [h.pos, h.len]; });
const live = (page) => page.evaluate(() => window.__live());
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const kids = (st, id) => Object.keys(st.frames).filter((k) => st.frames[k].parent === id);
const subtree = (st, id) => { const out = [id]; for (let i = 0; i < out.length; i++) out.push(...kids(st, out[i])); return out; };
const shapeOf = (st, id) => ({ w: st.frames[id].w, h: st.frames[id].h, t: Object.keys(st.texts).filter((k) => st.texts[k].frame === id).map((k) => st.texts[k].text).sort(), k: kids(st, id).map((c) => shapeOf(st, c)).sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1) });

/* ⑶ 판정부 — 칸마다 [칸, 글] 을 돌려준다. expect = 모델이 세운 상태(canon 비교) · 없으면 ⒜⒞ 는 그 칸의 expectFn 이 잰다 */
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
function norm(names, id) { return names[id] || id; }

/* ⑵ 조작 생성기 + 모델 */
async function runSeed(page, seed, { maxOps = LIM.ops, ur = false, deep = false } = {}) {
  const r = rng(seed); const trace = { seed, plan: null, ops: [], fails: [], measured: 0, refused: 0, skipped: 0 }; const tries = [];
  const { plan, ids } = await buildTree(page, r); trace.plan = plan;
  const names = {}; let nF = 0; const nameAll = (st) => { Object.keys(st.frames).sort((a, b) => st.frames[a].order - st.frames[b].order).forEach((k) => { if (!names[k]) names[k] = 'F' + (nF++); }); };
  ids.forEach((k) => { names[k] = 'F' + (nF++); });
  let cur = await live(page); nameAll(cur);
  const undo = []; const redo = [];
  const n = 3 + Math.floor(r() * (maxOps - 2));
  const push = (s) => { undo.push(s); redo.length = 0; };
  const pressZ = async (kind, rec) => {
    const isUndo = kind === 'undo'; const i0 = trace.ops.length; const extra = [];
    await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
    await page.keyboard.press(isUndo ? 'Meta+z' : 'Meta+Shift+z'); await settle(page);
    if (INJECT === 'e') await page.evaluate(() => { const f = window.__secEl().querySelector('.frame-block:not([data-text-frame])'); if (f) f.dataset.width = '777'; });
    const st = await live(page); const stack = isUndo ? undo : redo; const other = isUndo ? redo : undo;
    const exp = stack.length ? stack[stack.length - 1] : cur;
    if (rec) rec.stack = stack.length;
    if (canon(st) !== canon(exp)) extra.push(['e', `${kind} 뒤 상태 ≠ 모델(쌓임 ${stack.length})`]);
    nameAll(st);
    trace.fails.push(...(await judge(page, st, null, extra)).map((x) => [i0, ...x]));
    if (stack.length) { other.push(cur); stack.pop(); }
    cur = st;
  };
  for (let i = 0; i < n; i++) {
    const frames = Object.keys(cur.frames).sort((a, b) => (names[a] < names[b] ? -1 : 1));
    const kinds = ur ? ['dup', 'size', 'del', 'move', 'urun', 'urun'] : ['dup', 'dup', 'move', 'size', 'group', 'del', 'undo', 'undo', 'redo'];
    let kind = kinds[Math.floor(r() * kinds.length)];
    if (deep) { const ed = ['dup', 'dup', 'size', 'del', 'move']; kind = undo.length >= 2 ? 'zdeep' : ed[Math.floor(r() * ed.length)]; }
    if (!frames.length && kind !== 'undo' && kind !== 'redo' && kind !== 'urun' && kind !== 'zdeep') kind = 'undo';
    const tgt = frames[Math.floor(r() * frames.length)] || null;
    const rec = { i, kind, tgt: tgt && norm(names, tgt) };
    let want = null; let extra = [];
    if (kind === 'dup' || kind === 'del' || kind === 'size' || kind === 'move' || kind === 'group') {
      const chainOf = (st, k) => { const c = []; for (let p = st.frames[k]?.parent; p; p = st.frames[p]?.parent) c.unshift(p); return c; };
      const s = await select(page, tgt, depthOf(cur, tgt), { chain: chainOf(cur, tgt) });
      if (s.via) rec.via = s.via;
      rec.entered = s.entered ? norm(names, s.entered) : null;
      tries.push({ i, kind, tgt: norm(names, tgt), tries: s.tries ?? null, sel: !!s.sel });
      if (!s.sel) {
        rec.skip = s.why || '고르기 안 섬';
        if (s.pts?.length) rec.owners = await Promise.all(s.pts.map(async ([x, y]) => { const h = await hitAt(page, x, y); return h ? (names[h.id] || (h.id ? h.id.split('_')[0] : '') || h.cls.split(' ')[0] || h.tag) : null; }));
        trace.skipped++; trace.ops.push(rec); continue;
      }
    }
    if (kind === 'dup') {
      await page.keyboard.press('Meta+d'); await settle(page);
      if (INJECT === 'd') await page.evaluate((old) => { const fresh = [...window.__secEl().querySelectorAll('.text-block')].find((t) => !old.includes(t.id)); if (fresh) (fresh.querySelector('.tb-body') || fresh).textContent = 'INJECT'; }, Object.keys(cur.texts));
      const st = await live(page); const fresh = Object.keys(st.frames).filter((k) => !cur.frames[k]);
      const sub = subtree(cur, tgt);
      rec.fresh = fresh.length; rec.expect = sub.length;
      if (fresh.length !== sub.length) extra.push(['d', `새 프레임 ${fresh.length} ≠ 부분나무 ${sub.length}`]);
      const top = fresh.find((k) => !fresh.includes(st.frames[k].parent));
      /* 설계(drag-utils.js:421 R1 · t902 C3): 들어간 프레임 자신을 ⌘D 하면 사본이 그 «안» — 모델이 그 꼴을 기대값으로 든다 */
      const wantParent = rec.entered === norm(names, tgt) ? tgt : cur.frames[tgt].parent;
      if (top && st.frames[top].parent !== wantParent) extra.push(['a', `사본 부모 ${norm(names, st.frames[top].parent)} ≠ 기대 ${norm(names, wantParent)}`]);
      if (top && JSON.stringify(shapeOf(st, top)) !== JSON.stringify(shapeOf(cur, tgt))) extra.push(['d', '사본 꼴·글자 ≠ 원본']);
      for (const k of Object.keys(cur.frames)) if (!st.frames[k] || st.frames[k].parent !== cur.frames[k].parent) extra.push(['a', `원본 ${norm(names, k)} 흔들림`]);
      nameAll(st); want = null;
      trace.fails.push(...(await judge(page, st, null, extra)).map((x) => [i, ...x])); if (canon(st) !== canon(cur)) push(cur); cur = st;
    } else if (kind === 'del') {
      await page.keyboard.press('Delete'); await settle(page);
      const st = await live(page); const gone = new Set(subtree(cur, tgt));
      want = { frames: Object.fromEntries(Object.entries(cur.frames).filter(([k]) => !gone.has(k))), texts: Object.fromEntries(Object.entries(cur.texts).filter(([, t]) => !gone.has(t.frame))) };
      trace.fails.push(...(await judge(page, st, want)).map((x) => [i, ...x])); if (canon(st) !== canon(cur)) push(cur); cur = st;
    } else if (kind === 'size') {
      const w = 120 + Math.floor(r() * 300);
      const ret = await page.evaluate(([id, w]) => { try { return window.updateFrameBlock?.(id, { width: w }) ?? { none: true }; } catch (e) { return { threw: String(e) }; } }, [tgt, w]); await settle(page);
      rec.w = w; rec.ok = ret?.ok ?? null;
      const st = await live(page);
      want = { frames: cur.frames, texts: cur.texts };
      trace.fails.push(...(await judge(page, st, want)).map((x) => [i, ...x]));
      if (canon(st) !== canon(cur)) push(cur); else trace.refused++; cur = st;
    } else if (kind === 'move') {
      const sibs = kids(cur, cur.frames[tgt].parent).filter((k) => k !== tgt);
      if (!sibs.length) { rec.skip = '형제 없음'; trace.skipped++; trace.ops.push(rec); continue; }
      const ref = sibs[Math.floor(r() * sibs.length)]; rec.ref = norm(names, ref);
      const ret = await page.evaluate(([id, ref]) => { try { return window.moveBlock(id, { afterId: ref }) ?? { none: true }; } catch (e) { return { threw: String(e).slice(0, 80) }; } }, [tgt, ref]); await settle(page);
      rec.ret = ret?.threw ? 'threw' : ret?.ok === false ? 'refused' : 'ok';
      const st = await live(page);
      trace.fails.push(...(await judge(page, st, { frames: cur.frames, texts: cur.texts })).map((x) => [i, ...x]));
      if (canon(st) !== canon(cur)) push(cur); cur = st;
    } else if (kind === 'group') {
      const ret = await page.evaluate(() => { try { return window.groupSelectedBlocks?.() ?? { none: true }; } catch (e) { return { threw: String(e).slice(0, 80) }; } }); await settle(page);
      rec.ret = ret?.threw ? 'threw' : 'ok';
      const st = await live(page);
      const missing = Object.keys(cur.frames).filter((k) => !st.frames[k]); const lost = Object.keys(cur.texts).filter((k) => !st.texts[k]);
      if (missing.length || lost.length) extra.push(['c', `그룹 뒤 유실 ${missing.length + lost.length}`]);
      nameAll(st);
      trace.fails.push(...(await judge(page, st, null, extra)).map((x) => [i, ...x])); if (canon(st) !== canon(cur)) push(cur); else trace.refused++; cur = st;
    } else if (kind === 'urun') {
      const k = 3 + Math.floor(r() * 3); const m = Math.floor(r() * (k + 1)); rec.presses = [];   // undo k 번 · 이어서 redo m 번 — 누를 때마다 판정
      for (const key of [...Array(k).fill('undo'), ...Array(m).fill('redo')]) { rec.presses.push(key + ':' + (key === 'undo' ? undo : redo).length); await pressZ(key); if (trace.fails.length) break; }
    } else if (kind === 'zdeep') {
      /* 쌓임 안에서만 — 빈 스택을 안 누른다 */
      const k = Math.min(undo.length, 2 + Math.floor(r() * 3)); const m = Math.floor(r() * (k + 1)); rec.presses = [];
      rec.tips = [await tipOf(page)];   // 지디 J294D — 재는 시점 탓인지 스택 꼴인지: 누르기 전·뒤 tip
      for (const key of [...Array(k).fill('undo'), ...Array(m).fill('redo')]) { rec.presses.push(key + ':' + (key === 'undo' ? undo : redo).length); await pressZ(key); rec.tips.push(await tipOf(page)); if (trace.fails.length) break; }
    } else {
      await pressZ(kind, rec);
    }
    if (INJECT) {
      const bad = await page.evaluate((k) => { const FR = '.frame-block:not([data-text-frame])'; const sec = window.__secEl(); const fs = [...sec.querySelectorAll(FR)];
        const f = fs[fs.length - 1]; if (!f) return false;
        if (k === 'a' && fs.length > 1) { const inner = fs.find((x) => x.parentElement.closest(FR)); if (inner) sec.querySelector('.section-inner').appendChild(inner); else fs[0].appendChild(fs[1]); return true; }
        if (k === 'b') { const c = f.cloneNode(false); c.id = f.id; const kid = document.createElement('div'); kid.className = 'frame-block'; kid.id = f.id; f.appendChild(kid); return true; }
        if (k === 'c') { f.remove(); return true; }
        if (k === 'f') { window.__origSer = window.__origSer || window.getSerializedCanvas; window.getSerializedCanvas = () => window.__origSer().replace(/data-width="[^"]*"/, 'data-width="999"').replace('T0', 'TX'); return true; }
        return false; }, INJECT);
      if (bad) { rec.injected = INJECT; const st = await live(page); const want2 = INJECT === 'f' ? { frames: st.frames, texts: st.texts } : { frames: cur.frames, texts: cur.texts }; trace.fails.push(...(await judge(page, st, want2)).map((x) => [i, ...x])); }
    }
    rec.after = Object.keys(cur.frames).length;
    if (deep) rec.tip = await tipOf(page);
    trace.measured++; trace.ops.push(rec);
    if (trace.fails.length) { rec.stopped = true; break; }
  }
  if (!trace.fails.length && !INJECT) {
    const before = await live(page);
    await page.evaluate(() => { const c = document.getElementById('canvas'); const html = window.getSerializedCanvas(); c.innerHTML = html; window.rebindAll?.(); window.deselectAll?.(); });
    await settle(page);
    const st = await live(page);
    if (canon(st) !== canon(before)) trace.fails.push(['end', 'f', '재로드 뒤 상태 ≠ 재로드 앞']);
    trace.reload = canon(st) === canon(before);
  }
  const clean = JSON.parse(JSON.stringify(trace).replace(/[a-z]+_[A-Za-z0-9_]{4,}/g, (m) => names[m] || m));
  clean.__tries = tries;
  return clean;
}
/* 고르기 시도 수는 옆 파일로 — 흔들림을 나중에 세려고 남긴다(지디 J294B) · 본 기록은 ×3 대조가 그대로 서게 뺀다 */
function save(name, trace) { fs.mkdirSync(OUT, { recursive: true }); const { __tries, ...t } = trace; fs.writeFileSync(path.join(OUT, `${TAG}-${name}.json`), JSON.stringify(t, null, 1) + '\n'); fs.writeFileSync(path.join(OUT, `${TAG}-${name}.tries.json`), JSON.stringify(__tries ?? [], null, 0) + '\n'); }

for (const [seed, ur, deep] of [...SEEDS.map((x) => [x, false, false]), ...SEEDS_UR.map((x) => [x, true, false]), ...SEEDS_DEEP.map((x) => [x, false, true])]) {
  test(`F${seed} ★시드${ur ? ' undo·redo 연달아' : deep ? ' 쌓임≥2 보장' : ''} — 매 조작 뒤 판정 여섯(깊이≤3 · 프레임≤6 · 조작≤8)`, async ({ page }) => {
    test.setTimeout(180000);
    const errs = await setup(page);
    const t = await runSeed(page, seed, { ur, deep });
    save(String(seed), t);
    console.log(`F294 ${JSON.stringify({ seed, measured: t.measured, refused: t.refused, skipped: t.skipped, fails: t.fails, ops: t.ops.map((o) => o.kind + (o.skip ? '!' : '')) })}`);
    expect(t.measured, '안 잰 회차: 판정이 하나도 안 돌았다').toBeGreaterThan(0);
    expect(t.fails, `판정 빨강(시드 ${seed} · 파일 ${TAG}-${seed}.json)`).toEqual([]);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}
/* ⑸ 양성 — 알려진 결함 꼴(287 · ⌘D 가 안 보이는 진입 상태로 갈린다): 자손을 «들어가» 고르면 사본이 그 안으로 간다. 모델(원본 부모)과 맞대면 판정 ⒜ 가 빨개져야 자가 산다 · 같은 장면 «안 들어감» 은 초록(음성). 287 의 그 꼴이 설계인지 결함인지는 이 시험이 안 가른다(R1 · 지디 줄). */
async function tree3(page) {
  return page.evaluate(() => { const FR = '.frame-block:not([data-text-frame])'; const sec = window.__secEl(); const out = [];
    for (let i = 0; i < 3; i++) { window.deselectAll?.(); window.selectSection(sec); window._activeFrame = i ? document.getElementById(out[i - 1]) : null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); out.push([...sec.querySelectorAll(FR)].find((x) => !b.has(x)).id); }
    window.deselectAll?.(); window._activeFrame = null; window.clearHistory?.(); return out; });
}
for (const [name, enter, red] of [['P287 ★양성 — 들어가 고른 ⌘D 는 판정 ⒜ 빨강(사본이 원본 부모 밖 · 그 프레임 안)', true, true], ['P287N 음성 — 안 들어간 ⌘D 는 판정 초록', false, false]]) {
  test(name, async ({ page }) => {
    const errs = await setup(page);
    const [, , G] = await tree3(page);
    const cur = await live(page);
    const s = await select(page, G, 2, { enter });
    console.log(`${name.split(' ')[0]} 전제 ${JSON.stringify(s)}`);
    expect(s.sel, '[전제] G 가 골라졌다').toBe(true);
    expect(s.entered === G, '[전제] 들어간 상태').toBe(enter);
    await page.keyboard.press('Meta+d'); await settle(page);
    const st = await live(page); const fresh = Object.keys(st.frames).filter((k) => !cur.frames[k]);
    expect(fresh.length, '[전제] 사본 하나').toBe(1);
    const extra = st.frames[fresh[0]].parent !== cur.frames[G].parent ? [['a', '사본 부모 ≠ 원본 부모']] : [];
    const fails = await judge(page, st, null, extra);
    console.log(`${name.split(' ')[0]} 판정 ${JSON.stringify(fails)}`);
    expect(fails.some((f) => f[0] === 'a'), '판정 ⒜').toBe(red);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}
/* ㉢ 곁값 닫기(지디 J294B · 값만 · 판정 지디): 한 프레임을 고르고 ⌘G 세 번 → ⌘Z 세 번 — 프레임 수·깊이·상태가 어디로 가나. +3 이고 돌아오면 «감싸기» · 안 돌아오면 그때 지디가 부른다. */
test('G3 값 — 프레임 하나 고르고 ⌘G ×3 · ⌘Z ×3(프레임 수)', async ({ page }) => {
  const errs = await setup(page);
  const id = await page.evaluate(() => { const FR = '.frame-block:not([data-text-frame])'; const sec = window.__secEl(); window.deselectAll?.(); window.selectSection(sec); window._activeFrame = null; window.addFrameBlock(); const f = sec.querySelector(FR); window.deselectAll?.(); window.clearHistory?.(); return f.id; });
  const before = await live(page);
  const s = await select(page, id, 0);
  expect(s.sel, '[전제] 프레임이 골라졌다').toBe(true);
  const view = async () => { const st = await live(page); const d = (k) => { let n = 0; for (let p = st.frames[k]?.parent; p; p = st.frames[p]?.parent) n++; return n; };
    const sel = await page.evaluate(() => [...document.querySelectorAll('#canvas .frame-block.selected:not([data-text-frame])')].length);
    const tip = await page.evaluate(() => { const h = window.getHistoryTip(); return [h.pos, h.len]; });
    return { n: Object.keys(st.frames).length, maxDepth: Math.max(0, ...Object.keys(st.frames).map(d)), selFrames: sel, tip, same: canon(st) === canon(before), idAlive: !!st.frames[id] }; };
  const seq = [{ step: '시작', ...(await view()) }];
  for (let i = 1; i <= 3; i++) { await page.keyboard.press('Meta+g'); await settle(page); seq.push({ step: '⌘G' + i, ...(await view()) }); }
  await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
  for (let i = 1; i <= 3; i++) { await page.keyboard.press('Meta+z'); await settle(page); seq.push({ step: '⌘Z' + i, ...(await view()) }); }
  console.log(`G3 ${JSON.stringify(seq)}`);
  save('G3', { seq, __tries: [] });
  expect(seq[0].n, '[전제] 시작 프레임 하나').toBe(1);
  expect(errs, errs.join(' | ')).toEqual([]);
});
/* 들어간 뒤 맨 위 임자(지디 J294C ㉡ · 값만 · 시트 328 판정 지디): P⊃K1,K2 에서 P 에 들어간 상태로 자식마다 다섯 점의 맨 위와 elementsFromPoint 위 넷. 들어가기 전 값도 같이 — 그 차가 재는 것이다. */
test('E1 값 — 들어간 뒤 자식 자리의 맨 위 임자', async ({ page }) => {
  const errs = await setup(page);
  const ids = await page.evaluate(() => { const FR = '.frame-block:not([data-text-frame])'; const sec = window.__secEl(); const out = [];
    for (const parent of [null, 0, 0]) { window.deselectAll?.(); window.selectSection(sec); window._activeFrame = parent === null ? null : document.getElementById(out[parent]); const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); out.push([...sec.querySelectorAll(FR)].find((x) => !b.has(x)).id); }
    window.deselectAll?.(); window._activeFrame = null; window.clearHistory?.(); return out; });
  const [P, K1, K2] = ids; const name = { [P]: 'P', [K1]: 'K1', [K2]: 'K2' };
  const label = (h) => (h ? (name[h.id] || (h.id ? h.id.split('_')[0] : '') || (h.cls || '').split(' ')[0] || h.tag) : null);
  const probe = () => page.evaluate(([ids]) => { const out = {}; for (const id of ids) { const o = document.getElementById(id); const r = o.getBoundingClientRect();
      out[id] = { rect: [r.left, r.top, r.width, r.height].map(Math.round), pts: [[r.right - 6, r.bottom - 6], [r.left + 6, r.bottom - 6], [r.right - 6, r.top + 6], [r.left + 6, r.top + 6], [r.left + r.width / 2, r.top + r.height / 2]].map(([x, y]) => ({ x, y, stack: document.elementsFromPoint(x, y).slice(0, 4).map((e) => ({ id: e.id || '', cls: typeof e.className === 'string' ? e.className : '', tag: e.tagName })) })) }; } return out; }, [ids]);
  const show = async (st) => { const v = await probe(); const o = {}; for (const id of ids) o[name[id]] = { rect: v[id].rect, top: await Promise.all(v[id].pts.map(async (q) => label(await hitAt(page, q.x, q.y)))), stack0: v[id].pts[0].stack.map(label) }; return { st, ...o }; };
  await page.evaluate((P) => document.getElementById(P).scrollIntoView({ block: 'center' }), P); await settle(page);
  await page.waitForFunction((P) => { const r = document.getElementById(P).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }, P, { timeout: 4000 });
  const a = await show('들어가기 전');
  const r = await page.evaluate((P) => { const q = document.getElementById(P).getBoundingClientRect(); return [q.right - 6, q.bottom - 6]; }, P);
  await page.mouse.dblclick(r[0], r[1]); await settle(page);
  const entered = await page.evaluate(() => ({ entered: window._enteredFrame?.id || null, sel: [...document.querySelectorAll('#canvas .selected')].map((e) => e.id) }));
  const b = await show('더블클릭 뒤');
  const out = { entered: { entered: name[entered.entered] || entered.entered, sel: entered.sel.map((x) => name[x] || x.split('_')[0]) }, a, b };
  console.log(`E1 ${JSON.stringify(out)}`);
  save('E1', { ...out, __tries: [] });
  expect(errs, errs.join(' | ')).toEqual([]);
});
/* tip 시점 값(지디 J294D · 값만): 맨 위 프레임 둘에서 move · 대조 size — 조작 직후 · 두 프레임 뒤 · 1 초 뒤 tip. 늦게 읽어 바뀌면 시점 탓 · 그대로면 스택 꼴 쪽. */
test('M1 값 — move·size 뒤 tip 을 세 시점에(단언 없음)', async ({ page }) => {
  const errs = await setup(page);
  const ids = await page.evaluate(() => { const FR = '.frame-block:not([data-text-frame])'; const sec = window.__secEl(); const out = [];
    for (let i = 0; i < 2; i++) { window.deselectAll?.(); window.selectSection(sec); window._activeFrame = null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); out.push([...sec.querySelectorAll(FR)].find((x) => !b.has(x)).id); }
    window.deselectAll?.(); window.clearHistory?.(); return out; });
  const later = async () => { const t0 = await page.evaluate(() => performance.now()); await page.waitForFunction((t) => performance.now() > t + 1000, t0); };
  const three = async (label, act) => { const start = await tipOf(page); await page.evaluate(act, ids); const now = await tipOf(page); await settle(page); const raf = await tipOf(page); await later(); const sec1 = await tipOf(page);
    return { label, start, now, raf, sec1, order: await page.evaluate(() => { const FR = '.frame-block:not([data-text-frame])'; return [...window.__secEl().querySelectorAll(FR)].map((f) => f.id); }) }; };
  const m = await three('move', ([a, b]) => { window.moveBlock(a, { afterId: b }); });
  const z = await three('size', ([a]) => { window.updateFrameBlock(a, { width: 333 }); });
  const out = { seq: [m, z].map(({ order, ...x }) => ({ ...x, moved: order[0] === ids[1] })), __tries: [] };
  console.log(`M1 ${JSON.stringify(out.seq)}`);
  save('M1', out);
  expect(errs, errs.join(' | ')).toEqual([]);
});
/* 값 칸 265(단언은 전제만 · 판정 안 함): 거절 입력 앞뒤 이력 칸 수 · ⌘Z 한 번 뒤 값 */
test('V265 값 — 거절 입력 앞뒤 이력·⌘Z 한 번(판정 0 · 지디 칸)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => { const sec = window.__secEl(); window.selectSection(sec); window.addTableBlock(); const t = sec.querySelector('.table-block'); if (!t) return { fail: '표 안 섬' };
    window.clearHistory?.(); const tip = () => { const h = window.getHistoryTip(); return [h.pos, h.len]; };
    const t0 = tip(); const ok = window.updateTableBlock(t.id, { mergedHeaderCols: [[0, 2]] }); const t1 = tip(); const a = t.dataset.mergedHeaderCols ?? null;
    const bad = window.updateTableBlock(t.id, { mergedHeaderCols: [[0, 99]] }); const t2 = tip(); window.deselectAll?.(); document.activeElement?.blur?.();
    return { id: t.id, ok: ok?.ok, bad: bad?.ok, a, t0, t1, t2 }; });
  expect(r.fail, '전제: 표').toBeUndefined();
  expect([r.ok, r.bad], '전제: 앞 성공 · 뒤 거절').toEqual([true, false]);
  await page.keyboard.press('Meta+z'); await settle(page);
  const c = await page.evaluate((id) => { const h = window.getHistoryTip(); return { v: document.getElementById(id)?.dataset.mergedHeaderCols ?? null, tip: [h.pos, h.len] }; }, r.id);
  console.log(`V265 ${JSON.stringify({ ...r, afterZ: c })}`);
  expect(errs, errs.join(' | ')).toEqual([]);
});
/* V265 의 음성대조(JQ-RULER-A ⑶ · imac-gd-L3): 같은 장면에서 거절만 뺀다 ⇒ 이력 꼭대기가 안 움직인다. 이것이 서야 V265 의 «거절 뒤 tip 이 움직였다» 가 뜻을 갖는다.
 *   양성(사본에서 잼): 이 칸에 진짜 편집 + pushHistory 를 넣으면 빨강(자가 움직임을 본다) · ⚠️거절 줄을 넣어도 초록이다(이 문으론 거절이 꼭대기를 안 움직인다 · 261031 실측) · ⛔이 칸이 안 재는 것: 거절이 tip 을 움직이는 것이 옳은가(판정은 지디) · 값 복원 · 표 밖 다른 거절 · 패널 길(MCP 문으로 부른다). */
test('V265N 음성대조 — 거절 없는 같은 장면은 이력 꼭대기가 안 움직인다', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => { const sec = window.__secEl(); window.selectSection(sec); window.addTableBlock(); const t = sec.querySelector('.table-block'); if (!t) return { fail: '표 안 섬' };
    window.clearHistory?.(); const tip = () => { const h = window.getHistoryTip(); return [h.pos, h.len]; };
    const t0 = tip(); const ok = window.updateTableBlock(t.id, { mergedHeaderCols: [[0, 2]] }); const t1 = tip(); const a = t.dataset.mergedHeaderCols ?? null;
    const t2 = tip(); window.deselectAll?.(); document.activeElement?.blur?.();
    return { id: t.id, ok: ok?.ok, a, t0, t1, t2 }; });
  expect(r.fail, '전제: 표').toBeUndefined();
  expect(r.ok, '전제: 앞 성공').toBe(true);
  await settle(page);
  const after = await page.evaluate(() => { const h = window.getHistoryTip(); return [h.pos, h.len]; });
  await page.keyboard.press('Meta+z'); await settle(page);
  const c = await page.evaluate((id) => { const h = window.getHistoryTip(); return { v: document.getElementById(id)?.dataset.mergedHeaderCols ?? null, tip: [h.pos, h.len] }; }, r.id);
  console.log(`V265N ${JSON.stringify({ ...r, after, afterZ: c })}`);
  expect(r.t2, '거절 없이 꼭대기가 움직였다').toEqual(r.t1);
  expect(after, '다음 프레임에도 그대로').toEqual(r.t1);
  expect(errs, errs.join(' | ')).toEqual([]);
});
