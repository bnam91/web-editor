/* scratch-paste-link.dom.spec.js — #16-DUP 「링크된 섹션을 붙여넣으면 스크래치도 같이 복제」
 * (2026-09-08 신설 · 현빈 발주 「링크체인이 2개가 생겨」)
 *
 * ★여기서 «진짜» 도는 것 — js/scratchpad-link.js 원문을 크로미움에 얹는다(클래식 IIFE).
 *   rewireClonedSection 의 판정·복제·토큰 재기입·sideEffects 조립이 «실제 코드»다.
 *   그래서 원문이 바뀌면 여기가 빨개진다.
 *
 * ⛔이 검사가 «못» 재는 경계 (정직하게 적는다)
 *   · js/scratch-pad.js · js/editor.js 는 ESM(import 문)이라 addScriptTag 로 못 얹는다.
 *     ⇒ 스크래치 모델(_scratchItemById/_scratchDuplicateItem/_scratchRestoreItem/_scratchRemoveById)은
 *       «window 계약만» 세운 대역이다. 그 두 파일의 «원문»은 tests/unit/scratch-paste-dup.test.js 가 진다
 *       (7인자 전달·id 보존·재인코딩 금지·호출 순서·별건 무접촉).
 *   · 대역 _scratchRemoveById 는 «동기»다. 원문은 async 지만 삭제 자체는 첫 await «전»에 끝나므로
 *     관측 가능한 부분은 같다. 「await 뒤의 _saveScratch」는 여기서 «안 쟀다».
 *   · 실앱에서 restoreSnapshot 이 페이지를 바꾼 «뒤» onUndo 가 불리는 «순서»는 «안 쟀다»(T-DOM-11 은
 *     SE 함수만 직접 돌린다). 실앱 로드 중 ⌘V 도 «안 쟀다» — 지디 실기 몫.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 포트 무접촉. 빈 페이지에 스크립트만 얹는다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js scratch-paste-link
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const LINK_SRC = path.join(REPO, 'js', 'scratchpad-link.js');

/* 앱의 진짜 구조 그대로: #canvas-scaler > (#canvas > .section-block…)  +  .scratch-item «형제»
   ★스크래치 아이템이 #canvas 의 «형제»라는 것이 T-DOM-9 가 잡는 전제다. */
const SECTION = (id, refLinks, h) =>
  `<div class="section-block" id="${id}"${refLinks ? ` data-ref-links="${refLinks}"` : ''}`
  + ` style="height:${h || 200}px;background:#eee;">`
  + `<div class="section-inner"><div class="text-block" id="tb_${id}">글</div></div></div>`;

const FIXTURE = (secs) => `<!doctype html><html><body style="margin:0">
<div id="canvas-wrap" style="position:relative;width:800px;height:600px;overflow:auto">
  <div id="canvas-scaler" style="position:relative;width:800px">
    <div id="canvas" style="position:relative;width:600px">${secs}</div>
  </div>
</div></body></html>`;

/* ── 대역 ScratchPadDB — window 계약만. 진짜 scratch-pad.js 는 ESM 이라 못 얹는다(파일 머리 참조). ── */
const STUB = () => {
  window.__DB = { items: [], seq: 0, saveSoon: 0, failMode: null };
  const scaler = () => document.getElementById('canvas-scaler');
  window.__mkItemEl = (id, x, y, w) => {
    const d = document.createElement('div');
    d.className = 'scratch-item';
    d.dataset.scratchId = id;
    d.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:60px;background:#fcc;`;
    scaler().appendChild(d);   // ★#canvas 가 아니라 scaler 의 «직계» — 앱과 같은 자리
    return d;
  };
  window.__addItem = (rec) => {
    const it = Object.assign({}, rec, { el: window.__mkItemEl(rec.id, rec.x, rec.y, rec.w) });
    window.__DB.items.push(it);
    return it;
  };
  window._scratchItemById = (id) => window.__DB.items.find((s) => s.id === id) || null;
  window._scratchSaveSoon = () => { window.__DB.saveSoon++; };
  window._scratchDuplicateItem = (srcId, opts) => {
    const { dx = 0, dy = 0 } = opts || {};
    if (window.__DB.failMode === 'NO_SCALER') return { ok: false, code: 'NO_SCALER', message: 'stub' };
    const it = window.__DB.items.find((s) => s.id === srcId);
    if (!it) return { ok: false, code: 'NO_SOURCE', message: 'stub' };
    const rec = {
      id: 'sp_dup' + (++window.__DB.seq),
      src: it.src, x: (it.x || 0) + dx, y: (it.y || 0) + dy, w: it.w, linkDy: it.linkDy,
    };
    window.__addItem(rec);
    window._scratchSaveSoon();
    return { ok: true, item: Object.assign({}, rec) };
  };
  window._scratchRestoreItem = (rec) => {
    if (!rec || typeof rec.id !== 'string') return { ok: false, code: 'BAD_ARGS' };
    if (window.__DB.items.some((s) => s.id === rec.id)) return { ok: true, code: 'ALREADY' };
    window.__addItem({ id: rec.id, src: rec.src, x: rec.x, y: rec.y, w: rec.w, linkDy: rec.linkDy });
    return { ok: true };
  };
  window._scratchRemoveById = (id) => {
    const it = window.__DB.items.find((s) => s.id === id);
    if (!it) return false;
    it.el.remove();
    window.__DB.items = window.__DB.items.filter((s) => s !== it);
    return true;
  };

  /* ── 검사 편의 ── */
  window.__seed = (recs) => recs.forEach((r) => window.__addItem(r));
  /** 섹션을 «복사»한다 — pasteClipboard 의 섹션 분기와 같은 순서(id 재생성 → 아직 «분리»). */
  window.__cloneDetached = (secId, newId) => {
    const src = document.getElementById(secId);
    const el = src.cloneNode(true);
    el.id = newId;
    el.querySelectorAll('[id]').forEach((c) => { c.id = c.id + '_' + newId; });
    return el;   // ⚠️아직 DOM 밖(temp 안과 같은 상태)
  };
  window.__metrics = () => {
    const all = window.SPLink.allLinks();
    const per = {};
    all.forEach((l) => { per[l.scratchId] = (per[l.scratchId] || 0) + 1; });
    return {
      pairs: all.map((l) => l.sectionId + '→' + l.scratchId + (l.collapsed ? '(접힘)' : '')),
      scratchIds: all.map((l) => l.scratchId),
      perImage: per,
      maxPerImage: all.length ? Math.max.apply(null, Object.values(per)) : 0,
      dbIds: window.__DB.items.map((i) => i.id),
      dbCount: window.__DB.items.length,
      sectionCount: document.querySelectorAll('.section-block').length,
    };
  };
  /* ★대조군 — 「addLink 의 자가 가드를 «베끼면» 나오는 판」.
     ⛔이건 제품 코드가 아니다. 제품이 이렇게 되는 것을 막는 건 T-U1-1/1b 다.
     여기서는 «왜 위험한지»를 수치로 보이기 위한 모형이다(T-DOM-4 오른쪽 열). */
  window.__rewireAfterInsertWithSelfGuard = (sec) => {
    const SP = window.SPLink;
    const arr = SP._parse(sec);
    const next = [];
    let dups = 0;
    for (const l of arr) {
      const curSecId = SP.sectionIdOf(l.scratchId);
      if (!curSecId || curSecId === sec.id) { next.push(l); continue; }   // ← 베낀 자가 가드
      const r = window._scratchDuplicateItem(l.scratchId, { dx: 0, dy: 0 });
      if (!r || !r.ok) { next.push(l); continue; }
      dups++;
      next.push({ scratchId: r.item.id, collapsed: l.collapsed });
    }
    SP._write(sec, next);
    return dups;
  };
};

async function boot(page, secs, seed) {
  const logs = [];
  page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
  await page.setContent(FIXTURE(secs));
  await page.evaluate(STUB);
  await page.addScriptTag({ content: fs.readFileSync(LINK_SRC, 'utf8') });
  await page.evaluate((s) => window.__seed(s), seed || []);
  await expect.poll(() => page.evaluate(() => typeof window.SPLink?.rewireClonedSection)).toBe('function');
  return logs;
}

const ITEM_A = { id: 'sp_a', src: 'goya-asset://aaa', x: 700, y: 40, w: 120, linkDy: 30 };
const ITEM_B = { id: 'sp_b', src: 'goya-asset://bbb', x: 700, y: 300, w: 90, linkDy: 55 };

// ══════════════════════════════════════════════════════════════════
test('T-DOM-0 ★★양성대조 — 지금 dev 는 «2» 를 낸다 (rewire 없이 붙이면 한 이미지를 두 섹션이 쥔다)', async ({ page }) => {
  await boot(page, SECTION('sec_a', 'sp_a:0'), [ITEM_A]);
  const m = await page.evaluate(() => {
    const clone = window.__cloneDetached('sec_a', 'sec_copy');
    document.getElementById('sec_a').after(clone);      // ⛔rewire 를 «안» 부른다 = 오늘의 dev
    return window.__metrics();
  });
  console.log('  rewire 없이 붙여넣기 →', m.pairs.join(' · '));
  expect(m.scratchIds).toEqual(['sp_a', 'sp_a']);
  expect(m.perImage.sp_a).toBe(2);                       // ★이 「2」가 아래 모든 「1」의 분모다
  expect(m.maxPerImage).toBe(2);
  expect(m.dbCount).toBe(1);                             // 이미지는 하나뿐인데 선이 둘 = 「링크체인 2개」
});

test('T-DOM-1 ★삽입 «전» rewire → 링크는 2건이되 scratchId 가 서로 다르고 «이미지당 섹션 수»가 전부 1', async ({ page }) => {
  await boot(page, SECTION('sec_a', 'sp_a:0'), [ITEM_A]);
  const r = await page.evaluate(() => {
    const clone = window.__cloneDetached('sec_a', 'sec_copy');
    const out = window.SPLink.rewireClonedSection(clone);   // ★아직 DOM 밖
    document.getElementById('sec_a').after(clone);
    return { dups: out.dups.length, hasSE: !!out.sideEffects, m: window.__metrics(), raw: clone.dataset.refLinks };
  });
  console.log('  삽입 전 rewire →', r.m.pairs.join(' · '), '| 사본 dataset:', r.raw);
  expect(r.dups).toBe(1);
  expect(r.hasSE).toBe(true);
  expect(r.m.scratchIds.length).toBe(2);
  expect(new Set(r.m.scratchIds).size).toBe(2);           // ★서로 다른 이미지
  expect(r.m.maxPerImage).toBe(1);                        // ★★이게 발주의 답이다
  expect(r.m.dbCount).toBe(2);
});

test('T-DOM-2 ★잘라내기(원본 섹션이 먼저 사라진 뒤) → 복제 0 · 토큰 그대로 sp_a · 체인 1 («이동»이 «복제»로 변하면 안 된다)', async ({ page }) => {
  await boot(page, SECTION('sec_a', 'sp_a:0'), [ITEM_A]);
  const r = await page.evaluate(() => {
    const clone = window.__cloneDetached('sec_a', 'sec_copy');   // ⌘X 는 삭제 «전»에 복사한다
    document.getElementById('sec_a').remove();                   // …그리고 원본을 지운다
    const out = window.SPLink.rewireClonedSection(clone);
    document.getElementById('canvas').appendChild(clone);
    return { dups: out.dups.length, hasSE: !!out.sideEffects, raw: clone.dataset.refLinks, m: window.__metrics() };
  });
  console.log('  ⌘X→⌘V →', r.m.pairs.join(' · '), '| dataset:', r.raw);
  expect(r.dups).toBe(0);
  expect(r.hasSE).toBe(false);                 // ★SE 가 null = 오늘과 동작 동일 = 회귀 0
  expect(r.raw).toBe('sp_a:0');                // ★토큰을 «안» 건드렸다
  expect(r.m.dbCount).toBe(1);                 // 이미지가 안 늘었다
  expect(r.m.maxPerImage).toBe(1);
});

test('T-DOM-3 ★M개 링크 — 사본 2 · collapsed(0/1) 보존 · dataset 형식 그대로 왕복', async ({ page }) => {
  await boot(page, SECTION('sec_a', 'sp_a:0,sp_b:1'), [ITEM_A, ITEM_B]);
  const r = await page.evaluate(() => {
    const clone = window.__cloneDetached('sec_a', 'sec_copy');
    const out = window.SPLink.rewireClonedSection(clone);
    document.getElementById('sec_a').after(clone);
    return {
      dups: out.dups.length, raw: clone.dataset.refLinks,
      parsed: window.SPLink._parse(clone), m: window.__metrics(),
    };
  });
  console.log('  M=2 →', r.m.pairs.join(' · '), '| dataset:', r.raw);
  expect(r.dups).toBe(2);
  expect(r.m.maxPerImage).toBe(1);
  expect(r.m.dbCount).toBe(4);
  // ★collapsed 가 토큰별로 «따로» 따라온다 — 하나는 펼침(0) 하나는 접힘(1)
  expect(r.parsed.map((l) => l.collapsed)).toEqual([false, true]);
  expect(r.raw).toMatch(/^[^,:]+:0,[^,:]+:1$/);           // 형식 불변(id:flag,id:flag)
});

test('T-DOM-4 ★★2×2 행렬 — 「삽입 전 판정」 vs 「삽입 후 + 자가 가드」 × 「사본이 뒤」 vs 「사본이 앞」', async ({ page }) => {
  const cell = async (mode, where) => {
    await boot(page, SECTION('sec_a', 'sp_a:0'), [ITEM_A]);
    return page.evaluate(({ mode, where }) => {
      const orig = document.getElementById('sec_a');
      const clone = window.__cloneDetached('sec_a', 'sec_copy');
      let dups;
      if (mode === 'before') {                       // ★처방 — 분리 상태에서 판정
        dups = window.SPLink.rewireClonedSection(clone).dups.length;
        where === 'after' ? orig.after(clone) : orig.before(clone);
      } else {                                       // 대조군 — 넣고 나서 자가 가드로 판정
        where === 'after' ? orig.after(clone) : orig.before(clone);
        dups = window.__rewireAfterInsertWithSelfGuard(clone);
      }
      return { dups, maxPerImage: window.__metrics().maxPerImage };
    }, { mode, where });
  };
  const M = {
    beforeAfter: await cell('before', 'after'),
    beforeBefore: await cell('before', 'before'),
    afterAfter: await cell('afterInsert', 'after'),
    afterBefore: await cell('afterInsert', 'before'),
  };
  console.log('  ┌─ 2×2 (복제 수 / 이미지당 최대 섹션 수) ────────────');
  console.log(`  │                        사본이 «뒤»      사본이 «앞»`);
  console.log(`  │ 삽입 «전» 판정(처방)   ${M.beforeAfter.dups} / ${M.beforeAfter.maxPerImage}            ${M.beforeBefore.dups} / ${M.beforeBefore.maxPerImage}`);
  console.log(`  │ 삽입 «후» + 자가가드   ${M.afterAfter.dups} / ${M.afterAfter.maxPerImage}  ⚠️우연     ${M.afterBefore.dups} / ${M.afterBefore.maxPerImage}  ❌버그잔존`);
  console.log('  └────────────────────────────────────────────────');
  // ★처방은 «양쪽» 다 1 — 사용자의 선택 상태에 안 갈린다
  expect(M.beforeAfter).toEqual({ dups: 1, maxPerImage: 1 });
  expect(M.beforeBefore).toEqual({ dups: 1, maxPerImage: 1 });
  // ★★오른쪽 위 칸이 이 검사의 존재 이유 — 「뒤」만 재면 자가 가드도 «고쳐진 것처럼» 보인다
  expect(M.afterAfter).toEqual({ dups: 1, maxPerImage: 1 });
  // ★그런데 「앞」이면 사본이 «자기 자신»을 찾아 복제를 건너뛴다 = 옛 버그 그대로
  expect(M.afterBefore).toEqual({ dups: 0, maxPerImage: 2 });
});

test('T-DOM-5 ★두 번 붙여넣으면 사본이 «둘» — 1차 사본을 재사용하면 원래 버그가 그대로 재현된다', async ({ page }) => {
  await boot(page, SECTION('sec_a', 'sp_a:0'), [ITEM_A]);
  const r = await page.evaluate(() => {
    const paste = (newId) => {
      const clone = window.__cloneDetached('sec_a', newId);
      const out = window.SPLink.rewireClonedSection(clone);
      document.getElementById('sec_a').after(clone);
      return out.dups.length;
    };
    return { d1: paste('sec_c1'), d2: paste('sec_c2'), m: window.__metrics() };
  });
  console.log('  2회 붙여넣기 →', r.m.pairs.join(' · '));
  expect([r.d1, r.d2]).toEqual([1, 1]);
  expect(r.m.sectionCount).toBe(3);
  expect(r.m.dbCount).toBe(3);                    // 섹션 3 = 이미지 3
  expect(new Set(r.m.scratchIds).size).toBe(3);
  expect(r.m.maxPerImage).toBe(1);                // ★1차 사본을 재사용했다면 여기가 2가 된다
});

test('T-DOM-6 ★사본 x = 원본 x + w + STACK_GAP(12) · linkDy 는 원본과 «동일»', async ({ page }) => {
  await boot(page, SECTION('sec_a', 'sp_a:0'), [ITEM_A]);
  const r = await page.evaluate(() => {
    const clone = window.__cloneDetached('sec_a', 'sec_copy');
    const dup = window.SPLink.rewireClonedSection(clone).dups[0];
    document.getElementById('sec_a').after(clone);
    const src = window._scratchItemById('sp_a');
    return { src: { x: src.x, y: src.y, w: src.w, linkDy: src.linkDy }, dup };
  });
  console.log('  원본', JSON.stringify(r.src), '→ 사본', JSON.stringify(r.dup));
  expect(r.dup.x).toBe(r.src.x + r.src.w + 12);   // 가로를 벌려야 _applyFollow 가 서로 안 민다
  expect(r.dup.y).toBe(r.src.y);                  // y 는 첫 추종 프레임이 덮는다 — 여기서 계산하지 않는다
  expect(r.dup.w).toBe(r.src.w);
  expect(r.dup.linkDy).toBe(r.src.linkDy);        // ★앵커를 그대로 베낀다
  expect(r.dup.src).toBe('goya-asset://aaa');     // ★같은 문자열 = sha256 dedup 유지(디스크 0바이트)
});

test('T-DOM-7 ★추종이 사본에도 «따로» 붙는다 — 두 섹션 top 이 다르면 각자 secTop+linkDy 로 간다', async ({ page }) => {
  await boot(page, SECTION('sec_a', 'sp_a:0'), [ITEM_A]);
  const r = await page.evaluate(() => {
    const orig = document.getElementById('sec_a');
    const clone = window.__cloneDetached('sec_a', 'sec_copy');
    const dup = window.SPLink.rewireClonedSection(clone).dups[0];
    orig.after(clone);                                  // 사본 섹션은 원본 «아래»(top 이 다르다)
    const A = window._scratchItemById('sp_a');
    const B = window._scratchItemById(dup.id);
    A.linkDy = 30; B.linkDy = 30;                       // 앵커를 명시해 결정적으로 만든다
    window.SPLink.resyncFollow();
    window.SPLink._applyFollow();
    const scR = document.getElementById('canvas-scaler').getBoundingClientRect();
    const topOf = (el) => el.getBoundingClientRect().top - scR.top;
    return {
      secTopA: topOf(orig), secTopB: topOf(clone),
      yA: parseFloat(A.el.style.top), yB: parseFloat(B.el.style.top),
    };
  });
  console.log(`  섹션 top: 원본 ${r.secTopA} / 사본 ${r.secTopB} → 이미지 y: ${r.yA} / ${r.yB}`);
  expect(r.secTopB).toBeGreaterThan(r.secTopA);          // 전제: 두 섹션이 실제로 다른 높이에 있다
  expect(r.yA).toBeCloseTo(r.secTopA + 30, 0);
  expect(r.yB).toBeCloseTo(r.secTopB + 30, 0);           // ★사본이 «자기» 섹션을 따라간다
});

test('T-DOM-8 ★★고아 검사 — 붙여넣기 전/후 · onUndo · onRedo · «SE 없는 대조군»을 한 자리에서 센다', async ({ page }) => {
  await boot(page, SECTION('sec_a', 'sp_a:0'), [ITEM_A]);
  const r = await page.evaluate(() => {
    const snap = () => ({ n: window.__DB.items.length, ids: window.__DB.items.map((i) => i.id).sort() });
    const before = snap();
    const clone = window.__cloneDetached('sec_a', 'sec_copy');
    const out = window.SPLink.rewireClonedSection(clone);
    document.getElementById('sec_a').after(clone);
    const after = snap();
    out.sideEffects.onUndo();
    clone.remove();                                 // 캔버스 스냅샷 undo 가 하는 일(섹션 제거)
    const undone = snap();
    out.sideEffects.onRedo();
    document.getElementById('sec_a').after(clone);  // 캔버스 스냅샷 redo
    const redone = snap();

    /* ★대조군 — SE 를 «버리면»(=지금 dev) 어떻게 되나. 같은 검사 안에 둔다:
       따로 두면 아무도 같이 안 보고, 「0 이 줄어서인지 애초에 셀 게 없어서인지」를 못 가른다. */
    const clone2 = window.__cloneDetached('sec_a', 'sec_ctl');
    window.SPLink.rewireClonedSection(clone2);      // 반환값(sideEffects)을 버린다
    document.getElementById('sec_a').after(clone2);
    const ctlAfter = snap();
    clone2.remove();                                // 캔버스 스냅샷 undo «만»
    const ctlUndone = snap();
    return { before, after, undone, redone, ctlAfter, ctlUndone };
  });
  const N0 = r.before.n;
  console.log('  ┌─ ScratchPadDB 항목 수 ─────────────────────────');
  console.log(`  │ 붙여넣기 전 : ${r.before.n}   (분모 N₀)`);
  console.log(`  │ 붙여넣기 후 : ${r.after.n}   ids=${r.after.ids.join(',')}`);
  console.log(`  │ onUndo  후  : ${r.undone.n}   ★고아 0 이어야 한다`);
  console.log(`  │ onRedo  후  : ${r.redone.n}   ids=${r.redone.ids.join(',')}  ★id 가 «같아야» refLinks 가 산다`);
  console.log(`  │ [대조군] SE 없이 붙였다 지우면 : ${r.ctlAfter.n} → ${r.ctlUndone.n}  ← 이 수가 안 줄어드는 게 «고아»다`);
  console.log('  └────────────────────────────────────────────────');
  expect(r.after.n).toBe(N0 + 1);
  expect(r.undone.n).toBe(N0);                              // ★고아 0
  expect(r.redone.n).toBe(N0 + 1);
  expect(r.redone.ids).toEqual(r.after.ids);                // ★★id 가 바뀌면 refLinks 가 死참조
  // 대조군: 「0 이 나왔다」가 «되돌려서»임을 증명한다 — 같은 계측으로 «안 줄어드는» 입력이 있다
  expect(r.ctlAfter.n).toBe(N0 + 2);
  expect(r.ctlUndone.n).toBe(N0 + 2);
});

test('T-DOM-9 ★전제 — 스크래치는 #canvas 의 «형제»다 (사본이 생겨도 캔버스 스냅샷 문자열이 불변)', async ({ page }) => {
  await boot(page, SECTION('sec_a', 'sp_a:0'), [ITEM_A]);
  const r = await page.evaluate(() => {
    const canvasEl = document.getElementById('canvas');
    const ser = () => canvasEl.cloneNode(true).innerHTML;   // getSerializedCanvas 와 같은 문
    const clone = window.__cloneDetached('sec_a', 'sec_copy');
    const before = ser();
    const dup = window.SPLink.rewireClonedSection(clone).dups[0];   // ← 아이템이 «생긴다»
    const afterDup = ser();                                         // …그런데 스냅샷은 그대로여야 한다
    document.getElementById('sec_a').after(clone);
    const dupEl = document.querySelector('.scratch-item[data-scratch-id="' + dup.id + '"]');
    return {
      before, afterDup,
      parentId: dupEl.parentElement.id,
      insideCanvas: !!canvasEl.contains(dupEl),
      changedAfterInsert: ser() !== before,
    };
  });
  console.log('  사본 아이템의 부모:', r.parentId, '| #canvas 안인가:', r.insideCanvas);
  expect(r.afterDup).toBe(r.before);      // ★이게 깨지면 ensureHistoryCheckpoint 가 끼어들어 onUndo 가 안 불린다
  expect(r.parentId).toBe('canvas-scaler');
  expect(r.insideCanvas).toBe(false);
  expect(r.changedAfterInsert).toBe(true); // 계측 대조 — 이 자는 «변할 땐» 변한다(늘 같은 값이 아니다)
});

test('T-DOM-10 ★실패 두 갈래 — NO_SOURCE 는 토큰 유지 «조용히» / NO_SCALER 는 토큰 유지 «+ console.warn»', async ({ page }) => {
  const logs = await boot(page, SECTION('sec_a', 'sp_a:0'), []);   // ★아이템을 «안» 심는다 = 로드 전/다른 페이지
  const noSource = await page.evaluate(() => {
    const clone = window.__cloneDetached('sec_a', 'sec_copy');
    const out = window.SPLink.rewireClonedSection(clone);
    return { dups: out.dups.length, hasSE: !!out.sideEffects, raw: clone.dataset.refLinks };
  });
  const warnsAfterNoSource = logs.filter((l) => l.startsWith('warning') && l.includes('[spl]')).length;
  console.log('  NO_SOURCE →', JSON.stringify(noSource), '| [spl] 경고 수:', warnsAfterNoSource);
  expect(noSource.dups).toBe(0);
  expect(noSource.raw).toBe('sp_a:0');       // ⛔지우지 않는다 — 「없다」는 「지워졌다」가 아니다
  expect(noSource.hasSE).toBe(false);
  expect(warnsAfterNoSource).toBe(0);        // ★정상 갈래라 «조용»해야 한다

  const noScaler = await page.evaluate(() => {
    window.__seed([{ id: 'sp_a', src: 'x', x: 10, y: 10, w: 100, linkDy: 5 }]);
    window.__DB.failMode = 'NO_SCALER';                   // 만들다 실패 = 결함
    const clone = window.__cloneDetached('sec_a', 'sec_copy2');
    const out = window.SPLink.rewireClonedSection(clone);
    return { dups: out.dups.length, raw: clone.dataset.refLinks };
  });
  await expect.poll(() => logs.filter((l) => l.includes('[spl]') && l.includes('NO_SCALER')).length).toBeGreaterThan(0);
  console.log('  NO_SCALER →', JSON.stringify(noScaler), '| 경고:', logs.filter((l) => l.includes('NO_SCALER'))[0]);
  expect(noScaler.dups).toBe(0);
  expect(noScaler.raw).toBe('sp_a:0');       // 처분은 같고
});

test('T-DOM-11 ★크로스페이지 undo — 페이지가 바뀌었으면 ⑴안 지우고 ⑵경고를 «낸다»', async ({ page }) => {
  const logs = await boot(page, SECTION('sec_a', 'sp_a:0'), [ITEM_A]);
  const r = await page.evaluate(() => {
    window.state = { currentPageId: 'p1' };                    // 붙여넣기는 p1 에서
    const clone = window.__cloneDetached('sec_a', 'sec_copy');
    const out = window.SPLink.rewireClonedSection(clone);
    document.getElementById('sec_a').after(clone);
    const afterPaste = window.__DB.items.length;
    window.state.currentPageId = 'p2';                         // …그 사이 페이지가 바뀌었다
    out.sideEffects.onUndo();
    const afterUndo = window.__DB.items.length;
    out.sideEffects.onRedo();
    const afterRedo = window.__DB.items.length;
    window.state.currentPageId = 'p1';                         // 돌아오면 정상 동작해야 한다
    out.sideEffects.onUndo();
    return { afterPaste, afterUndo, afterRedo, afterBack: window.__DB.items.length };
  });
  await expect.poll(() => logs.filter((l) => l.includes('페이지가 다르다')).length).toBeGreaterThan(0);
  console.log(`  p1 붙여넣기 ${r.afterPaste} → p2 onUndo ${r.afterUndo}(안 지움) → p2 onRedo ${r.afterRedo} → p1 복귀 onUndo ${r.afterBack}`);
  console.log('  경고:', logs.filter((l) => l.includes('페이지가 다르다'))[0]);
  expect(r.afterPaste).toBe(2);
  expect(r.afterUndo).toBe(2);        // ⑴ 다른 페이지에선 «안 지운다»(모르는 상태에서 지우는 쪽은 못 되돌린다)
  expect(r.afterRedo).toBe(2);
  expect(r.afterBack).toBe(1);        // ★가드가 «막기만» 하는 게 아니라 제 페이지에선 실제로 돈다
});
