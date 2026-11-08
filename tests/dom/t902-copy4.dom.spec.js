/* t902-copy4.dom.spec.js — t9-02 «복사 넷»(부모·자식·자손·형제 × 복사 ⌘D) · 자유 프레임 갈래 (S5 261029 · 지디 18:2x «레포 넣기 = 예»)
 * ★까닭: S3 구조 표(t9-02 · 78 벌 509 줄) — 세 판(㉮㉯㉰) 모두 «복사» 네 칸이 빈 칸 · 250 폭주(RSS 6.1GB)가 ⌘D 자리에서 나왔다
 * ★지디 세 칸(18:2x 원문 그대로):
 *   ⒜ «이 spec 은 자유 프레임(data-free-layout) 갈래만 잰다» — addFrameBlock 이 자유 프레임을 만들기 때문 · ★진입 줄만 다르고 붙이는 자리(:2273 → :463)는 같다 · 흐름 장면은 진입 줄 몫만 재면 된다
 *      (흐름 진입 = editor.js:1513 · 자유 진입 = :1520/:1527 · 둘 다 copySelected + pasteClipboard 단일 블럭 갈래 :2273 insertAfterSelectedAsSibling → drag-utils.js:409 → :463
 *       — 앞 머리말의 «→ :2112 다음 형제 — 다른 코드다» 는 틀렸다: :2112 는 multi-block 갈래(:2062 안) · 지디 18:3x 판정 ⒜ · 미카사 [보류-㉕] 셋째)
 *   ⒝ «C3(_enteredFrame = G · 더블클릭 둘)는 설계다» — drag-utils.js:421 R1(현빈 2026-10-08) ⇒ ⛔그 칸을 «빨강 기대»로 적지 마라
 *   ⒞ «그 양성(:463)으로는 C3 를 못 가른다» — 원 판도 «안» 길
 * ★깊이·개수 안 섞기(S7 250 D·C = «깊이»): 네 장면 모두 프레임 총수 = 4 · 관계만 바꾼다
 *   C1 부모 P⊃K + 납작 2 (P 고름) · C2 자식 같은 꼴(K 고름) · C3/C3b 자손 P⊃K⊃G + 납작 1(G 고름 · C3 = 더블클릭 둘 = G 에 들어감 · C3b = 더블클릭 하나 + 클릭 = G 를 오브젝트로) · C4 형제 P⊃{S1,S2} + 납작 1(S1 고름)
 * ★⌘D 길(자유 프레임): editor.js:1455 duplicateSelected → copySelected(:1731 type block) + pasteClipboard → :2273 insertAfterSelectedAsSibling
 *   → drag-utils.js:409 frameSelectedAsObject(:421 들어간 프레임이면 null) → :461 _placeAfterFrameAsSibling → :463 unit.after(el)(다음 형제) · null 이면 :498 insertAfterSelected(«안»)
 * ★단언(칸마다 일곱): ⑴ 프레임 수 = 앞 + 부분나무 ⑵ 새 것의 부모 = 고른 것의 부모 ⑶ 바로 다음 형제 ⑷ 부분나무 깊이 꼴 같음 ⑸ id 겹침 0 ⑹ 원본 그대로(조상은 kids 뺌) ⑺ ⌘Z 1 번 → 앞 꼴
 *   C3 는 ⑵ 에서 «G 안» 으로 간다 — 그 꼴이 설계(⒝)이므로 이 파일의 C3 는 «G 안»(부모 = G · ⑶ 다음 형제 칸 없음)을 단언한다(빨강 기대 아님)
 *   ⚠️C3 전제(더블클릭 둘로 G 가 골라지고 _enteredFrame = G)는 S5 ×3 중 1 번 안 섰다(G 안 골라짐) — 전제 단언이 그 판을 «빨강»이 아닌 전제 깨짐으로 낸다
 * ★양성(S5 261029 · git worktree 사본 · 1/1): drag-utils.js:463 «unit.after(el)» → «frame.appendChild(el)» ⇒ C1·C2·C3b·C4 ✘ ⑵ 4/4 · C3 는 못 가름(⒞)
 * ★×3(원 판 3ea20db3 · S5 261029): C1 3/3 · C2 2/2 · C3b 3/3 · C4 3/3 · C3 «G 안» 2/2 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const FR = '.frame-block:not([data-text-frame])';

/* 장면: kind = 'C1'|'C2'|'C3'|'C4' · 제품 addFrameBlock 사슬로 짓는다 · 반환 = { ids, free, total } */
async function build(page, kind) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const r = await page.evaluate(async ({ kind, FR }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop();
    const made = (fn) => { const b = new Set(sec.querySelectorAll(FR)); fn(); return [...sec.querySelectorAll(FR)].find((f) => !b.has(f)); };
    const top = () => { window.deselectAll?.(); window.selectSection(sec); window._activeFrame = null; return made(() => window.addFrameBlock()); };
    const inside = (parent) => { window.deselectAll?.(); window.selectSection(sec); window._activeFrame = parent; return made(() => window.addFrameBlock()); };   // ★getSelectedSection 이 섹션을 봐야 addFrameBlock 이 선다(block-factory.js:2072 · 첫 벌 전제 깨짐 고침)
    const ids = {};
    const P = top(); if (!P) return { fail: 'P 안 섬' }; ids.P = P.id;
    const need = (f, n) => { if (!f) throw new Error('전제: ' + n + ' 안 섬'); return f; };
    if (kind === 'C4') { ids.S1 = need(inside(P), 'S1').id; ids.S2 = need(inside(P), 'S2').id; }
    else { const K = need(inside(P), 'K'); ids.K = K.id; if (kind === 'C3') ids.G = need(inside(K), 'G').id; }
    const pad = 4 - sec.querySelectorAll(FR).length; for (let i = 0; i < pad; i++) top();
    window.deselectAll?.(); window._activeFrame = null; window.clearHistory?.();
    const par = (id) => document.getElementById(id)?.parentElement?.closest(FR)?.id || null;
    return { ids, secId: sec.id, total: sec.querySelectorAll(FR).length, free: Object.fromEntries(Object.entries(ids).map(([k, v]) => [k, document.getElementById(v).dataset.freeLayout || ''])),
      parents: Object.fromEntries(Object.entries(ids).map(([k, v]) => [k, par(v)])) };
  }, { kind, FR });
  return { errs, ...r };
}
/* 그 프레임의 관계 그림 */
const shape = (page, secId) => page.evaluate(({ secId, FR }) => {
  const sec = document.getElementById(secId); const all = [...sec.querySelectorAll(FR)];
  const depth = (f) => { let d = 0; for (let p = f.parentElement?.closest(FR); p && sec.contains(p); p = p.parentElement?.closest(FR)) d++; return d; };
  return all.map((f) => ({ id: f.id, parent: f.parentElement?.closest(FR)?.id || null, depth: depth(f), kids: f.querySelectorAll(':scope ' + FR).length }));
}, { secId, FR });
/* 고르기: 바깥(P·납작) = 그 프레임만 걸리는 구석 클릭 · 안쪽 = 부모 고른 뒤 그 자리 더블클릭(진입 + 자식 고름 — frame-dblclick-overlay OV-c 꼴) — 손 꼴은 첫 런에서 «골라졌나» 전제로 잰다 */
async function pick(page, id, depth, mode = 'dbl') {
  /* ★넷째 벌 고침(C2 전제 흔들림): 안 고른 프레임의 자식은 pointer-events none 이라 elementFromPoint 로는 안쪽을 못 집는다 ⇒
     «기하»로 고른다 — 후보(가운데·안쪽 네 구석) 중 «그 프레임 상자 안 ∧ 그 프레임의 조상 아닌 다른 프레임 상자 밖» 인 첫 점 */
  const pt = (target) => page.evaluate((id) => { const o = document.getElementById(id); o.scrollIntoView({ block: 'center' }); const r = o.getBoundingClientRect();
    const others = [...document.querySelectorAll('#canvas .frame-block:not([data-text-frame])')].filter((f) => f !== o && !f.contains(o)).map((f) => f.getBoundingClientRect());
    const inR = (x, y, b) => x > b.left && x < b.right && y > b.top && y < b.bottom;
    for (const [x, y] of [[r.left + r.width / 2, r.top + r.height / 2], [r.right - 6, r.bottom - 6], [r.left + 6, r.bottom - 6], [r.right - 6, r.top + 6], [r.left + 6, r.top + 6]])
      if (inR(x, y, r) && !others.some((b) => inR(x, y, b))) return { x, y, ok: true };
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, ok: false }; }, target);
  const q = await pt(id);
  if (depth === 0) await page.mouse.click(q.x, q.y);
  else if (mode === 'dbl') for (let i = 0; i < depth; i++) await page.mouse.dblclick(q.x, q.y);
  else { for (let i = 0; i < depth - 1; i++) await page.mouse.dblclick(q.x, q.y); await page.waitForFunction(() => !!document.querySelector('#canvas .frame-block.selected'), null, { timeout: 2000 }).catch(() => {}); await page.mouse.dblclick(q.x, q.y); }   // ★C3b 몸짓 = «G 골라짐 · 안 들어감» — B안(현빈 261107): 옛 «진입 한 번 + 클릭»(드릴인)은 빠져 더블클릭 깊이만큼
  await page.waitForFunction((id) => document.getElementById(id)?.classList.contains('selected'), id, { timeout: 2000 }).catch(() => {});   // 조건 대기(고정 대기 0 · dom-fixed-wait-census)
  return { ...q, selected: await page.evaluate((id) => document.getElementById(id)?.classList.contains('selected'), id) };
}

/* B안(현빈 261107): C3(dbl) = «G 에 들어간 상태» — 더블클릭 둘은 G 를 «고르기»까지라 하나 더(G 여백) = 3 · C3b = «G 골라짐 · 안 들어감» = 더블클릭 둘 */
const CELLS = [['C1', 'P', 0, 'dbl'], ['C2', 'K', 1, 'dbl'], ['C3', 'G', 3, 'dbl'], ['C3', 'G', 2, 'dbl+click'], ['C4', 'S1', 1, 'dbl']];
for (const [kind, who, depth, mode] of CELLS) {
  test(`${kind}${mode === 'dbl' ? '' : 'b'} ${who} ⌘D (${mode}) — 부모·바로 다음 형제·부분나무·id·원본·⌘Z (프레임 총수 4 고정)`, async ({ page }) => {
    const s = await build(page, kind);
    expect(s.fail, '[전제] P 섰다(첫 단언)').toBeUndefined();
    expect(s.total, '[전제] 프레임 총수 4').toBe(4);
    const before = await shape(page, s.secId);
    const tgt = s.ids[who]; const tParent = before.find((f) => f.id === tgt).parent; const sub = 1 + before.find((f) => f.id === tgt).kids;
    const p = await pick(page, tgt, depth, mode);
    p.entered = await page.evaluate(() => window._enteredFrame?.id || null);
    console.log(`  ${kind} 전제 free=${JSON.stringify(s.free)} pick=${JSON.stringify(p)}`);
    expect(p.selected, `[전제] ${who} 가 골라졌다`).toBe(true);
    await page.keyboard.press('Meta+d');
    await page.waitForFunction(({ secId, n }) => document.getElementById(secId).querySelectorAll('.frame-block:not([data-text-frame])').length > n, { secId: s.secId, n: before.length }, { timeout: 4000 }).catch(() => {});
    const after = await shape(page, s.secId);
    const fresh = after.filter((f) => !before.some((b) => b.id === f.id));
    const top = fresh.find((f) => !fresh.some((g) => g.id === f.parent));
    console.log(`  ${kind} 뒤 ${JSON.stringify({ n: after.length, fresh: fresh.length, top })}`);
    expect(after.length, '⑴ 프레임 수 = 앞 + 부분나무').toBe(before.length + sub);
    const intoTarget = kind === 'C3' && mode === 'dbl';   // ⒝ 설계: 들어간 G 에서 ⌘D = 사본이 G «안»(drag-utils.js:421 R1)
    if (intoTarget) expect(p.entered, '[전제] C3 는 G 에 들어간 상태(_enteredFrame = G)').toBe(tgt);
    expect(top?.parent ?? null, intoTarget ? '⑵ (C3 설계) 새 것의 부모 = G 자신' : '⑵ 새 것의 부모 = 고른 것의 부모').toBe(intoTarget ? tgt : tParent);
    const nextId = await page.evaluate((id) => { const o = document.getElementById(id); let n = o.closest('.row') && o.closest('.row') !== o.parentElement?.closest('.frame-block')?.closest('.row') ? o.closest('.row').nextElementSibling : o.nextElementSibling; return n ? (n.matches('.frame-block') ? n.id : n.querySelector('.frame-block')?.id || null) : null; }, tgt);
    if (!intoTarget) expect(nextId, '⑶ 새 것 = 고른 것 바로 다음 형제').toBe(top?.id);
    const t0 = before.find((f) => f.id === tgt);
    const inSub = (list, rootId) => { const ids = new Set([rootId]); let grew = true; while (grew) { grew = false; for (const f of list) if (!ids.has(f.id) && ids.has(f.parent)) { ids.add(f.id); grew = true; } } return list.filter((f) => ids.has(f.id)); };
    expect(fresh.map((f) => f.depth - top.depth).sort(), '⑷ 새 부분나무 깊이 꼴 = 원본').toEqual(inSub(before, tgt).map((f) => f.depth - t0.depth).sort());
    expect(new Set(after.map((f) => f.id)).size, '⑸ id 겹침 0').toBe(after.length);
    const anc = new Set(); for (let p = t0.parent; p; p = before.find((f) => f.id === p)?.parent) anc.add(p);
    if (intoTarget) anc.add(tgt);   // ★C3 설계 꼴: 사본이 G «안» 이면 G 의 안 프레임 수도 느는 게 맞다(3b3d25d8 DOM 한 벌 ⑹ 빨강 고침)   // ★고친 칸(둘째 벌 흠): 조상의 안 프레임 수는 사본만큼 느는 게 맞다 ⇒ kids 는 조상 밖에서만
    for (const b of before) expect(after.find((f) => f.id === b.id), `⑹ 원본 ${b.id} 그대로`).toMatchObject(anc.has(b.id) ? { parent: b.parent, depth: b.depth } : { parent: b.parent, depth: b.depth, kids: b.kids });
    await page.keyboard.press('Meta+z');
    await page.waitForFunction(({ secId, n }) => document.getElementById(secId).querySelectorAll('.frame-block:not([data-text-frame])').length === n, { secId: s.secId, n: before.length }, { timeout: 4000 }).catch(() => {});
    expect((await shape(page, s.secId)).map((f) => f.id + '<' + f.parent).sort(), '⑺ ⌘Z 1 번 → 앞 꼴').toEqual(before.map((f) => f.id + '<' + f.parent).sort());
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
}
