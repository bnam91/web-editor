/* group-reopen-textframe-142.dom.spec.js — ★142 SAVE-REOPEN-WRAPS-GROUP-TEXT-ONE-MORE-FRAME-01 저장·다시 열기 게이트 (S3 · 261028)
 *
 * ★병: ⌘G(섹션 흐름)가 글의 텍스트 프레임(TF)을 벗겨 그룹에 맨 text-block 을 넣었다 ⇒ 다시 열면 로드 이주(save-load.js migrateColsFromDOM ·
 *   rebindAll 안 · 자유배치 직속 text-block → TF)가 TF 를 «하나 더» 씌웠다(옛 판 실측: ⌘G 직후 [G,G] → 열기 1 [TF>G] → 열기 2·3 같음).
 *   지디 판정 ㉮(로드 이주는 규약에 맞음 · 고칠 자리 = ⌘G).
 * ★게이트 꼴(measure/frame-textcenter 04-saveload-gate 꼴): «⌘G 직후 겹 → 열기 1 → 2 → 3» 의 «더 생긴 TF 겹 수»를 잰다 —
 *   고친 판 = 0 → 0 → 0 → 0 (⌘G 직후부터 TF>G · 다시 열어도 안 바뀜) / 옛 판 = 0 → 1 → 1 → 1(누적이 1 에서 멈추는 것은 «경미» 가 아니라
 *   저장본 구조가 한 겹 틀린 것 — 지디).
 * «다시 열기» = getSerializedCanvas → #canvas 갈아끼움 → rebindAll(이주가 도는 문) · ⛔파일 저장 왕복(IndexedDB·디스크)은 안 잼(적음).
 * 장면 = 앱 길(addTextBlock ×2 → toggleBlockSelect → groupSelectedBlocks). ⛔고정 대기 0.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

test('R1 ★⌘G 뒤 다시 열기 ×3 — 글의 텍스트 프레임 겹이 늘지 않는다(⌘G 직후부터 TF > 그룹)', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  const S = await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" data-section="1" id="sG"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100); window.deselectAll?.(); window.selectSection(document.getElementById('sG'));
    await window.addTextBlock('body'); await window.addTextBlock('body');
    const tbs = () => [...document.querySelectorAll('#sG .text-block')];
    const tfDepth = (el) => { let n = 0; for (let p = el.parentElement; p && p.id !== 'sG'; p = p.parentElement) if (p.dataset?.textFrame === 'true') n++; return n; };
    const inGroup = (el) => !!el.closest('.frame-block[data-group="true"]');
    const snap = (tag) => ({ tag, n: tbs().length, tf: tbs().map(tfDepth), grouped: tbs().map(inGroup), frames: document.querySelectorAll('#sG .frame-block').length });
    const out = [snap('만든 뒤')];
    window.deselectAll?.(); for (const t of tbs()) window.toggleBlockSelect?.(t);
    out.push({ ...snap('고른 뒤'), sel: document.querySelectorAll('#sG .text-block.selected').length });
    window.groupSelectedBlocks();
    out.push(snap('⌘G 직후'));
    for (const k of [1, 2, 3]) {
      document.getElementById('canvas').innerHTML = String(window.getSerializedCanvas());
      window.rebindAll?.();
      out.push(snap(`열기 ${k}`));
    }
    return out;
  });
  for (const s of S) console.log('[R1]', JSON.stringify(s));
  const [made, picked, g, o1, o2, o3] = S;
  expect([made.n, made.tf], '전제: 글 둘 · 각자 TF 한 겹(앱 길)').toEqual([2, [1, 1]]);
  expect(picked.sel, '전제: 둘 다 골라졌다').toBe(2);
  expect(g.grouped, '전제: ⌘G 로 둘 다 그룹 안').toEqual([true, true]);
  /* 게이트 수 = «⌘G 직후 대비 더 생긴 TF 겹» — 고친 판 0·0·0·0 */
  const extra = [g, o1, o2, o3].map((s) => Math.max(...s.tf) - Math.max(...g.tf));
  console.log('[R1] 더 생긴 겹 ⌘G 직후·열기1·2·3 =', JSON.stringify(extra));
  expect(g.tf, '★⌘G 직후 글이 제 TF 안(벗겨지지 않음 · js-structure «분리 금지»)').toEqual([1, 1]);
  expect(extra, '★다시 열기마다 TF 겹이 늘지 않는다').toEqual([0, 0, 0, 0]);
  expect([o1, o2, o3].map((s) => s.frames), '다시 열기 셋 다 프레임 수 = ⌘G 직후').toEqual([g.frames, g.frames, g.frames]);
  expect(errs).toEqual([]);
});
