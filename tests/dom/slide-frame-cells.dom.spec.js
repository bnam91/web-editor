/* ★기대 바뀜(현빈 261123 ①②③ · 태양 §2c check) — 바뀐 칸의 토글 스위치(label.prop-toggle · .prop-toggle-track) → check 부품(label.ui-check · input.ui-check-box) */
/* slide-frame-cells — SLIDE-CELL-AS-FRAME-01(현빈 261118 · handoff/PLAN-ty-slide-frame-cells-261118.md) · 커밋 1 = 데이터 두 갈래 + 비파괴 렌더 + 왕복.
 *   js/blocks/slide-block.js: data-cell-mode="frame" = 정본 DOM(.sld-track > .frame-block.sld-cell 자식) · renderSlideBlock 프레임 갈래 = 배치만(칸 자식 무접촉)
 * F0 ★프레임 모드 슬라이드 · 칸 2 에 들어가(_activeFrame = 칸) 진짜 addTextBlock → 그 칸 안 글자(같은 요소 = id 로 잰다 · addTextBlock 프레임 갈래는 content 를 안 받는다)
 *    → 패널 값 바꾸기 길(setSlideLayout · renderSlideBlock 탐) + pushHistory → 글자 «같은 요소» 그대로 · 칸 3 · 간격 반영
 *    → ⌘Z 한 번 = 간격 전(글자 있음) · ⌘Z 한 번 더 = 글자 넣기 전(칸 3 그대로 · 칸 비었음) · ⌘⇧Z = 글자 다시
 *    → 저장 → 다시 열기(serializeProject → applyProjectData · RERENDER_KINDS 가 renderSlideBlock 을 탄다) → 칸 2 안 글자 · 표식·칸 배치 모드 그대로
 * F0b [음성] 사진 모드(표식 없음) = 옛 렌더 그대로(.sld-card · 칸 프레임 0)
 * ── 커밋 2 ──
 * F1 추가 메뉴 입구(addSlideBlock) 새 블럭 = 프레임 칸 3 · 패널 «프레임 추가하기» → 4 · 칸 ✕ → 3 · ↓ 순서(칸 요소째) · 칸 폭 % → data-w · 그 칸 폭 · 12 상한에서 단추 꺼짐 · ⌘Z = 직전 하나
 * F2 빈 칸을 진짜 클릭 → 그 칸 고름(_activeFrame) · 패널 = 슬라이드(그 칸 줄 표시) · 프레임 px 손잡이 0 · 프레임 패널 0 · «사진 넣기(칸 N)» 단추 0(현빈 피드백 3 ②)
 *    → addTextBlock = 그 칸 안 · 칸 dragstart = 막힘 · 칸 고른 채 ⌘G(groupSelectedBlocks) = 묶음 0(칸은 트랙 그대로)
 * ── 커밋 3 ──
 * F3 GIF·미리보기 = 칸째 흐름: 칸 1 빨강 사진 · 칸 2 파랑 사진 · 칸 3 빈 칸 → slidePrepare = 칸 셋을 찍은 canvas(빨강·파랑) · slidePlan draw t=0 = 칸 자리(첫 장면)에 빨강·파랑
 *    · ★흐름 t(밀린 거리 100px) 에서 «칸 안 내용까지 같이» 파랑 왼끝이 100 만큼 왼쪽(현빈 Q2 확인 칸) · 안내 줄 «정지 한 장»
 *    (캡처 = grid-step 과 같은 길 — 하네스 electronAPI captureSectionCdp 를 진짜 CDP Page.captureScreenshot 로 잇는다 · grid-step.dom 과 같은 꼴)
 * ── 커밋 4 ──
 * F5 복제(진짜 ⌘D) — 칸·칸 안 글자 id 가 새로 · 사본 칸 안을 지워도 원본 그대로
 * F6 Figma JSON — 프레임 모드 = type frame + 칸마다 children(칸 프레임 · 칸 2 안 글자 블럭이 그 칸 children 에) · 칸 자리 x 늘어남 · images 없음
 *    / 사진 모드는 slide-block.dom M6(images) 가 그대로 잰다
 * ── 커밋 5 ──
 * F4 옛 사진 모드 저장본(빨강·파랑 2장 · 칸 1 폭 40) — 저장→다시 열기→다시 저장 = 저장본 canvas 글자 그대로(변환 0) · 패널 «프레임으로 바꾸기»(진짜 클릭)
 *    → 프레임 칸 2 · 칸마다 그 사진 에셋(칸 꽉) · 칸 1 data-w 40 · data-slides 걷힘 · ⌘Z 한 번 = 사진 모드(사진 2 · 카드 2 · 칸 0)
 * ── 적대 리뷰(261118 · 지디) 고침 ──
 * F0 + [높음2] ⌘Z 뒤·다시 열기 뒤 칸 높이 = 블럭 높이(옛 판 = makeFrameBlock data-height 520 이 rebindAll 로 박힘)
 * R1 [높음1] 칸 고르고 Delete = 그 칸만(칸 2) · 슬라이드 그대로 · ⌘Z = 칸 3 · 한 칸이면 Delete 무동작 · ⌘X 무동작 · ⌘C → ⌘V 해도 슬라이드 1
 * R3 [중간3] 프레임 모드 슬라이드 칸 위 스크래치 놓기 = 판정 slidecell · 그 칸 안 에셋 · data-slides 무변([] 그대로) · 옆 새 에셋 0
 * R4 [중간4] 칸만 고른 ⌘D = 무동작(슬라이드 1 · 칸 안 중첩 0) · 칸 안 글자 고른 ⌘D = 그 칸 안에 하나 더(종전 블럭 갈래)
 * R5 [낮음5] GIF 캐시 키가 짧다(innerHTML 통째 아님 · 길이 < 80) · 칸 안이 바뀌면 키가 바뀐다
 * ── SLIDE-OFFSCREEN-CELL-EDIT-01(펼침 · CSS 만) ──
 * P1 칸 5 · 칸 4 = 트랙 밖 → 패널 칸 4 줄 누름 = 칸 4 고름 + 캔버스 스크롤 → elementFromPoint(칸 4 가운데) = 칸 4(펼침) · 칸 4 클릭 → addTextBlock = 칸 4 안 ·
 *    캔버스에서 그 글자 고침(진짜 더블클릭·타이핑) → 저장 → 다시 열기 = 그 글 그대로 · 고름 풀면 칸 4 자리 = 칸 4 아님(잘림)
 *    · 저장본(serialize canvas)의 슬라이드에 펼침 흔적 0(class selected · overflow visible 없음)
 *    · 펼친 채 섹션 PNG 내보내기(exportSection returnDataUrl · 캡처 클론 길 = GIF 칸 찍기와 같은 길) = 안 펼친 것과 같은 PNG
 *    · 펼침(밖 흐림 덮개) 중에도 같은 섹션 다른 글자 블럭 클릭 = 그 블럭 골라짐(pointer-events none)
 * ── SLIDE-CANVAS-PLUS-ADD-CELL-01 ──
 * Q1 칸 2(글자 든) 고름 → 캔버스 ＋(#grd-plus-layer .sld-add-btn · 진짜 클릭) → 칸 4 · 새 칸 = 칸 2 바로 뒤 · 글자째 · 새 칸·글자 id 새로(문서 겹침 0) · 새 칸 고름 · ⌘Z 한 번 = 칸 3
 *    · 슬라이드만 골라 ＋ = 마지막 칸 복사 · ＋ 는 #canvas 밖(저장·내보내기에 안 샘)
 * ── 슬라이드 피드백 2 ──
 * U1 SLIDE-CLICK-SELECT-DBL-UNFOLD-01: 접힌 채 한 번 = 슬라이드만(칸 자리 elementFromPoint = 칸 아님 · 펼침 0) · 두 번 = 펼침 · 배율 10 에서 덮개 화면 너비 ≥ 창의 2배(끝 안 보임) ·
 *    Esc = 접힘 · 다시 펼치고 캔버스의 슬라이드 밖 누름 = 접힘 · 펼친 채 저장본에 sld-unfold 0 · 펼친 채 PNG = 접힌 PNG
 * H1 SLIDE-HEIGHT-HANDLE-01: 슬라이드 고름 → 오른쪽 아래 손잡이(#grd-plus-layer .sld-h-handle · #canvas 밖) · 진짜 끌기 아래로 60 → 블럭 높이 +60 · 칸 = 블럭 높이 따라감 · ⌘Z 한 번 = 옛 높이
 * H2 SLIDE-CELL-HEIGHT-EACH-01: 패널 칸 2 높이 50 → 칸 2 = 트랙 50% · 가운데 · 다른 칸 100% · GIF t=0 칸 2 자리 위쪽 = 빔 · 가운데 = 칸 2 그림(첫 장면과 같음)
 * C1 SLIDE-CELL-FRAME-HANDLES-RADIUS-SHADOW-01: 펼쳐 칸 2 고름 → 칸 손잡이(#grd-plus-layer .sld-cell-handle) · 진짜 끌기 왼쪽 위로 → 칸 2 data-w·data-h 줄어듦(% · 트랙 셈) · 다른 칸 그대로 · ⌘Z 한 번 = 옛 값
 * C2 같은: 패널 모서리 20 · 그림자 옅게 → 첫 장면 칸 border-radius 20px · box-shadow · Figma 칸 radius 20 · GIF 칸 모서리 = 칸 색 아님(둥근 clip) · 가운데 = 칸 색
 * Z1 SLIDE-GIF-PREVIEW-ZOOM-FLASH-01: 프레임 칸 슬라이드에서 효과를 차례로 바꾸며 slidePrepare(GIF 패널·미리보기가 부르는 길) — 섹션 캡처(captureSectionCdp) 횟수를 센다:
 *    흐름·스와이프·가운데·잔상·흐름 = 1 번(효과가 바꾸는 스타일은 키 밖) · 제자리 페이드(꽉 꼴) = +1 · 다시 스와이프 = +0(최근 둘 기억) · 칸 안 내용 바꿈 = +1
 * 양성대조(CTL · _patches/slide-frame-CTL1-destructive.patch): renderSlideBlock 의 프레임 갈래 `if (isFrameSlide(block)) {…}` 를 지움(옛 replaceChildren 로 떨어짐) → F0 빨강(값 바꾸자 글자 사라짐) — 예측
 *   slide-frame-CTL15-unfold-saved.patch(저장 명부에서 sld-unfold 뺌) → U1 빨강(저장본에 흔적) · slide-frame-CTL16-small-scrim.patch(덮개 100vmax) → U1 빨강(배율 10 에서 끝 보임) — 예측
 *   slide-frame-CTL17-no-cell-height.patch(칸 높이 % 줄을 100% 로) → H2 빨강 · slide-frame-CTL18-handle-noop.patch(손잡이 끌기 쓰기 삭제) → H1 빨강 — 예측
 *   slide-frame-CTL19-cell-handle-noop.patch(칸 손잡이 끌기 쓰기 삭제) → C1 빨강 · slide-frame-CTL20-gif-square.patch(drawSlides 둥근 갈래 삭제) → C2 빨강(GIF 모서리 = 칸 색) — 예측
 *   slide-frame-CTL14-key-innerhtml.patch(키 = 블럭 innerHTML 해시로 되돌림) → Z1 빨강(효과마다 캡처) — 예측
 *   slide-frame-CTL13-dup-same-ids.patch(복사 칸 id 새로 매기는 줄 삭제) → Q1 빨강(id 겹침) — 예측
 *   slide-frame-CTL12-no-unfold.patch(css 펼침 규칙 삭제) → P1 빨강(칸 4 자리 hit ≠ 칸 4) — 예측
 *   slide-frame-CTL7-delete-row.patch(editor.js 칸 삭제 갈래 삭제) → R1 빨강 · slide-frame-CTL8-height-520.patch(makeSlideCell 크기 키 지우기 + rebindAll 칸 제외 둘 다 되돌림) → F0 빨강(칸 520) ·
 *   slide-frame-CTL9-scratch-slides.patch(스크래치 프레임 모드 갈래 삭제 + appendSlideImage 가드 삭제) → R3 빨강 · slide-frame-CTL10-dup-cell.patch(⌘D 칸 가드 삭제) → R4 빨강 · slide-frame-CTL11-key-html.patch(키 = innerHTML) → R5 빨강 — 예측
 *   slide-frame-CTL6-no-convert.patch(패널 «프레임으로 바꾸기» 배선 삭제) → F4 빨강 — 예측
 *   slide-frame-CTL5-figma-images.patch(Figma 프레임 갈래 조건을 false → 옛 images 갈래) → F6 빨강 — 예측
 *   slide-frame-CTL4-no-frame-prepare.patch(slidePrepare 프레임 갈래 삭제 → 사진 길) → F3 빨강(칸 그림 0) — 예측
 *   slide-frame-CTL2-no-cell-pick.patch(block-drag click 의 _pickSlideCell 줄 삭제) → F2 빨강(프레임 패널·px 손잡이) ·
 *   slide-frame-CTL3-group-cell.patch(⌘G 칸 거르기 줄 삭제) → F2 빨강(칸이 묶음으로 빠짐) — 예측
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

async function scene(page, opts) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async (opts) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = c.querySelector('.section-block'); window.selectSection(sec);
    const { row, block } = window.makeSlideBlock(opts);
    (sec.querySelector('.section-inner') || sec).appendChild(row); window.bindBlock?.(block);
    window.pushHistory?.();   // 놓은 뒤 표본(이 장면의 «처음»)
    return block.id;
  }, opts);
  return { errs, id };
}
const st = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id); if (!b) return null;
  const cells = [...b.querySelectorAll(':scope > .sld-track > .sld-cell')];
  return {
    mode: b.dataset.cellMode || null, cells: cells.length, layouts: cells.map((c) => c.dataset.cellLayout),
    kids: cells.map((c) => [...c.querySelectorAll('.text-block')].map((t) => t.id)),
    text: cells.map((c) => c.textContent.trim()),
    gap: b.querySelector(':scope > .sld-track')?.style.gap || '',
    hOk: cells.every((c) => Math.abs(c.offsetHeight - b.clientHeight) <= 1), hs: cells.map((c) => c.offsetHeight), bh: b.clientHeight,   // 적대 리뷰 [높음2] 칸 높이 = 블럭 높이(520 고정 아님)
  };
}, id);
async function key(page, k) { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press(k); }

test('F0 ★칸 안 글자 — 값 바꿈·⌘Z·⌘⇧Z·저장 왕복에도 그대로(비파괴 렌더)', async ({ page }) => {
  const { errs, id } = await scene(page, { cellMode: 'frame' });
  const s0 = await st(page, id);
  expect({ mode: s0.mode, cells: s0.cells, layouts: s0.layouts }).toEqual({ mode: 'frame', cells: 3, layouts: ['free', 'free', 'free'] });
  /* 칸 2 에 들어가 진짜 넣기 길(addTextBlock → _insertToFlowFrame B 모드) */
  await page.evaluate((id) => { const cell = document.getElementById(id).querySelectorAll('.sld-cell')[1]; window._activeFrame = cell; window.addTextBlock('body'); }, id);
  const s1 = await st(page, id);
  expect(s1.kids[1].length, '[전제] 칸 2 안에 글자 블럭').toBe(1);
  const tid = s1.kids[1][0];
  /* 패널 값 바꾸기 길 — renderSlideBlock 을 탄다 */
  await page.evaluate((id) => { window._activeFrame = null; window.setSlideLayout(document.getElementById(id), { gap: 30 }); window.pushHistory?.(); }, id);
  const s2 = await st(page, id);
  expect({ cells: s2.cells, kid: s2.kids[1], gap: s2.gap }, '★값 바꿔도 칸 안 글자 «같은 요소» 그대로').toEqual({ cells: 3, kid: [tid], gap: '30px' });
  await key(page, 'Meta+z');
  await expect.poll(async () => (await st(page, id))?.gap, '⌘Z 1 = 간격 전').toBe('16px');
  expect((await st(page, id)).kids[1], '간격만 되돌림 · 글자 있음').toEqual([tid]);
  await key(page, 'Meta+z');
  await expect.poll(async () => (await st(page, id))?.kids[1].length, '⌘Z 2 = 글자 넣기 전').toBe(0);
  expect((await st(page, id)).hOk, `★⌘Z 뒤 칸 높이 = 블럭 높이 ${JSON.stringify(await st(page, id))}`).toBe(true);
  expect((await st(page, id)).cells, '칸 3 그대로').toBe(3);
  await key(page, 'Meta+Shift+z');
  await expect.poll(async () => (await st(page, id))?.kids[1], '⌘⇧Z = 글자 다시').toEqual([tid]);
  /* 저장 → 다시 열기 */
  await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); });
  const s3 = await st(page, id);
  expect({ mode: s3?.mode, cells: s3?.cells, layouts: s3?.layouts, kid: s3?.kids[1] }, '★다시 열어도 칸 2 안 글자').toEqual({ mode: 'frame', cells: 3, layouts: ['free', 'free', 'free'], kid: [tid] });
  expect(s3.hOk, `★다시 열어도 칸 높이 = 블럭 높이(${s3.bh}) — ${s3.hs}`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('F0b [음성] 사진 모드 = 옛 렌더 그대로', async ({ page }) => {
  const { errs, id } = await scene(page, {});
  const r = await page.evaluate((id) => { const b = document.getElementById(id); return { mode: b.dataset.cellMode || null, cards: b.querySelectorAll('.sld-card').length, cells: b.querySelectorAll('.sld-cell').length }; }, id);
  expect(r).toEqual({ mode: null, cards: 3, cells: 0 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

async function menuScene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    window.selectSection(c.querySelector('.section-block'));
    const made = window.addSlideBlock();   // 추가 메뉴 onclick 과 같은 입구
    made.block.scrollIntoView({ block: 'center' });
    return made.block.id;
  });
  return { errs, id };
}
const cellIds = (page, id) => page.evaluate((id) => [...document.getElementById(id).querySelectorAll(':scope > .sld-track > .sld-cell')].map((c) => c.id), id);

test('F1 새 블럭 = 프레임 칸 3 · 추가·빼기·순서·폭 · 12 상한 · ⌘Z', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  const c0 = await cellIds(page, id);
  expect(c0.length, '★메뉴 새 블럭 = 프레임 칸 3').toBe(3);
  await expect(page.locator('#sld-add-cell'), '[전제] 패널 = 칸 줄').toHaveCount(1);
  await page.click('#sld-add-cell');
  await expect.poll(() => cellIds(page, id).then((a) => a.length)).toBe(4);
  await page.click('.sld-cell-row[data-idx="3"] .sld-cell-del');
  await expect.poll(() => cellIds(page, id)).toEqual(c0);
  await page.click('.sld-cell-row[data-idx="0"] .sld-cell-down');
  await expect.poll(() => cellIds(page, id), '↓ = 칸 요소째').toEqual([c0[1], c0[0], c0[2]]);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  await expect.poll(() => cellIds(page, id), '⌘Z = 순서 전').toEqual(c0);
  await page.locator('.sld-cell-row[data-idx="1"] .sld-cw').fill('30'); await page.locator('.sld-cell-row[data-idx="1"] .sld-cw').dispatchEvent('change');
  const w = await page.evaluate((id) => { const b = document.getElementById(id), c = b.querySelectorAll('.sld-cell')[1]; return { dw: c.dataset.w, ratio: c.getBoundingClientRect().width / b.getBoundingClientRect().width }; }, id);
  expect(w.dw).toBe('30');
  expect(Math.abs(w.ratio - 0.3), `칸 2 폭 비 ${w.ratio}`).toBeLessThanOrEqual(0.01);
  for (let i = 3; i < 12; i++) await page.click('#sld-add-cell');
  await expect.poll(() => cellIds(page, id).then((a) => a.length)).toBe(12);
  await expect(page.locator('#sld-add-cell'), '12 상한').toBeDisabled();
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('F2 빈 칸 클릭 = 그 칸 고름(슬라이드 패널 · 손잡이 0) → 넣기 = 그 칸 안 · 칸 «사진 넣기» 단추 없음 · 칸 끌기·⌘G 막힘', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  /* SLIDE-CLICK-SELECT-DBL-UNFOLD-01(제품 뜻 바뀜) — 접힌 채 한 번 = 슬라이드만 · 두 번 = 펼침 → 그다음 한 번 = 그 칸 */
  const at = (i, dx) => page.evaluate(({ id, i, dx }) => { const r = document.getElementById(id).querySelectorAll('.sld-cell')[i].getBoundingClientRect(); return dx == null ? [r.left + r.width / 2, r.top + r.height / 2] : [r.left + dx, r.top + dx]; }, { id, i, dx });
  /* 지혜맥 defb77053 F2 3/3 «한 번» 에서 slide:false — 첫 누름 자리를 재고 «바로» 눌렀다(옛 판은 그 사이 evaluate 하나가 더 있었다 · 장면이 덜 멎은 것으로 추정 · 미확인)
     ⇒ 그 점이 두 rAF 동안 같고 그 점의 주인이 이 슬라이드 안일 때까지 기다린 뒤 누른다(조건 대기) */
  const settled = () => page.evaluate(async (id) => {
    const b = document.getElementById(id), m = () => { const r = b.querySelectorAll('.sld-cell')[0].getBoundingClientRect(); return [Math.round(r.left + 12), Math.round(r.top + 12)]; };
    const a = m(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const c = m(), e = document.elementFromPoint(c[0], c[1]);
    return { still: a[0] === c[0] && a[1] === c[1], inSlide: !!e && b.contains(e), who: e ? `${e.tagName}.${[...e.classList].join('.')}#${e.id}` : null, p: c };
  }, id);
  await expect.poll(settled, '[전제] 첫 누름 자리 멎음 · 그 점 = 슬라이드').toMatchObject({ still: true, inSlide: true });
  const p1 = (await settled()).p;
  await page.mouse.click(p1[0], p1[1]);
  const one = await page.evaluate(({ id, p1 }) => { const b = document.getElementById(id), e = document.elementFromPoint(p1[0], p1[1]); return { slide: b.classList.contains('selected'), cell: b.querySelectorAll('.sld-cell.selected').length, open: b.classList.contains('sld-unfold'), sel: [...document.querySelectorAll('#canvas .selected')].map((x) => `${x.className.split(' ')[0]}#${x.id}`), who: e ? `${e.tagName}.${[...e.classList].join('.')}#${e.id}` : null }; }, { id, p1 });
  expect(one, '★한 번 = 슬라이드만(펼침 없음) · 받은 값에 진단(sel·who)').toMatchObject({ slide: true, cell: 0, open: false });
  /* 지혜맥 F2 2/3 빨강 진단 {pre:{open:false, who:section-inner}} — 옛 판은 칸 2 가운데를 «첫 누름 전»에 재 두고 그 점을 두 번 눌렀다.
     접힌 동안 칸 2 가운데는 블럭 밖(잘림)일 수 있고 첫 누름이 패널을 열며 캔버스가 움직일 수 있다(추정 · 둘 중 무엇인지 미확인) ⇒ 두 번 누름은 «지금» 잰 칸 1 가운데(블럭 안) · 칸 2 점은 펼친 «뒤» 잰다. */
  const pd = await at(0);
  await page.mouse.dblclick(pd[0], pd[1]);
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('sld-unfold'), id), '[전제] 두 번 = 펼침').toBe(true);
  const p = await at(1);
  /* 진단: 누르기 «전» 그 점의 주인 · 펼침 · 누른 «뒤» 골라진 것 · _activeFrame · 들어간 프레임 → 실패 메시지에 */
  const pre = await page.evaluate(({ id, p }) => { const b = document.getElementById(id), e = document.elementFromPoint(p[0], p[1]); return { open: b.classList.contains('sld-unfold'), who: e ? `${e.tagName}.${[...e.classList].join('.')}#${e.id}` : null, inCell2: !!e && b.querySelectorAll('.sld-cell')[1].contains(e) }; }, { id, p });
  await page.mouse.click(p[0], p[1]);
  const post = await page.evaluate(() => ({ sel: [...document.querySelectorAll('#canvas .selected')].map((e) => `${e.className.split(' ')[0]}#${e.id}`), active: window._activeFrame?.id || null, entered: window._enteredFrame?.id || null }));
  const pick = await page.evaluate((id) => {
    const cell = document.getElementById(id).querySelectorAll('.sld-cell')[1];
    return { active: window._activeFrame === cell, sel: cell.classList.contains('selected'), row: document.querySelector('.sld-cell-row.active')?.dataset.idx ?? null,
      handles: document.querySelectorAll('.ss-resize-handle, .ss-rotate-handle').length, radiusHandles: document.querySelectorAll('.ss-radius-handle').length, framePanel: !!document.getElementById('ss-align-left') };   // 프레임 패널(prop-frame.js)에만 있는 id
    /* ★제품 뜻 바뀜(136 SLIDE-CELL-RADIUS-HANDLE-01 · 현빈 5차 (c) «캔버스 모서리 핸들 — 일반 프레임 것 재사용») — 칸에도 코너 반경 손잡이 넷 · 크기·회전 px 손잡이는 여전히 0 */
  }, id);
  expect(pre, `[전제] 펼친 뒤 누를 점 = 칸 2 · 진단 ${JSON.stringify({ pre, post })}`).toMatchObject({ open: true, inCell2: true });
  expect(pick, `★칸 고름 · 슬라이드 패널 그 칸 줄 · 프레임 px 손잡이 0 · 프레임 패널 0 · 진단 ${JSON.stringify({ pre, post })}`).toEqual({ active: true, sel: true, row: '1', handles: 0, radiusHandles: 4, framePanel: true });   // ★제품 뜻 바뀜(142 SLIDE-CELL-PANEL-PARITY-02 ⓐ · 지디 261119) — 고른 칸 = «그 칸의 프레임 패널»(정렬 단추 있음) + 슬라이드 칸 절(칸 줄)
  /* SLIDE-PANEL-REMOVE-CELL-PHOTO-BTN-01(현빈 피드백 3 ② · 제품 뜻 바뀜) — 칸을 골라도 패널에 «사진 넣기 (칸 N)» 단추가 없다(사진은 칸 위 스크래치·라이브러리 놓기 = R3) · 모서리 칸은 있다(같은 갈래가 그려졌다는 양성) */
  await expect(page.locator('#ss-radius-num'), '[전제] 고른 칸 갈래 그려짐(142 — 칸 코너 = 프레임 패널 코너)').toHaveCount(1);   /* ★기대 바뀜(표준 Appearance A1 · 현빈 261124 L-4/7 슬라이더 걷음) — 코너 = 숫자 칸 ss-radius-num 하나(같은 dataset.radius) */
  await expect(page.locator('#sld-cell-photo'), '★칸 사진 넣기 단추 없음').toHaveCount(0);
  await expect(page.getByText(/사진 넣기 \(칸/), '★그 글귀도 없음').toHaveCount(0);
  /* 고른 칸에 넣기 = 그 칸 안(_insertToFlowFrame) */
  await page.evaluate(() => window.addTextBlock('body'));
  expect(await page.evaluate((id) => document.getElementById(id).querySelectorAll('.sld-cell')[1].querySelectorAll('.text-block').length, id), '★글자 = 칸 2 안').toBe(1);
  /* 막기 — 칸 자체 끌기 · ⌘G */
  const guard = await page.evaluate((id) => {
    const cell = document.getElementById(id).querySelectorAll('.sld-cell')[1];
    const ev = new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() });
    cell.dispatchEvent(ev);
    window.deselectAll(); cell.classList.add('selected'); window.groupSelectedBlocks?.();
    return { dragBlocked: ev.defaultPrevented, parentIsTrack: cell.parentElement?.classList.contains('sld-track'), groups: document.querySelectorAll('#canvas .frame-block[data-group="true"]').length };
  }, id);
  expect(guard, '★칸 끌기 막힘 · ⌘G 로 칸이 안 빠짐').toEqual({ dragBlocked: true, parentIsTrack: true, groups: 0 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

async function wireCdp(page) {
  const cdp = await page.context().newCDPSession(page);
  await page.exposeFunction('__cdpShot', async ({ x = 0, y = 0, width, height, scale = 1 }) => (await cdp.send('Page.captureScreenshot', {
    format: 'png', clip: { x: Math.round(x), y: Math.round(y), width: Math.ceil(width), height: Math.ceil(height), scale: scale > 0 && scale <= 4 ? scale : 1 },
    captureBeyondViewport: true, fromSurface: true })).data);
  await page.evaluate(() => { const real = window.electronAPI; window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'captureSectionCdp' ? (o) => window.__cdpShot(o) : real[k]) }); });
}

test('F3 GIF·미리보기 — 칸을 찍어 흐름 · 칸 안 내용까지 같이 움직임', async ({ page }) => {
  const { errs, id } = await scene(page, { cellMode: 'frame' });
  await wireCdp(page);
  await page.evaluate(async (id) => {
    const b = document.getElementById(id), cells = b.querySelectorAll('.sld-cell');
    cells.forEach((c) => { c.dataset.w = '30'; });
    window.renderSlideBlock(b);
    const fill = (cell, color) => {
      const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30; const x = cv.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, 40, 30);
      window._activeFrame = cell; const had = new Set(cell.querySelectorAll('.asset-block'));
      window.addAssetBlock(null, { imgSrc: cv.toDataURL('image/png') });
      const ab = [...cell.querySelectorAll('.asset-block')].find((a) => !had.has(a));
      Object.assign(ab.style, { left: '0px', top: '0px', width: '100%', height: '100%' });
    };
    fill(cells[0], '#ff0000'); fill(cells[1], '#0000ff'); window._activeFrame = null;
    b.scrollIntoView({ block: 'center' });
  }, id);
  await page.waitForFunction((id) => [...document.getElementById(id).querySelectorAll('.sld-cell .asset-block img')].filter((i) => i.complete && i.naturalWidth > 0).length >= 2, id);   // 칸 사진 둘이 떴다(조건 대기)
  const r = await page.evaluate(async (id) => {
    const b = document.getElementById(id), cells = [...b.querySelectorAll('.sld-cell')];
    const imgs = await window.slidePrepare(b);
    const mid = (cv) => cv ? Array.from(cv.getContext('2d').getImageData(Math.floor(cv.width / 2), Math.floor(cv.height / 2), 1, 1).data).slice(0, 3) : null;
    const W = b.offsetWidth, H = b.offsetHeight, br = b.getBoundingClientRect(), k = br.width / W;
    const cx = cells.map((c) => { const q = c.getBoundingClientRect(); return [(q.left - br.left) / k, q.width / k]; });
    const gap = parseFloat(b.querySelector('.sld-track').style.gap) || 0, period = cx.reduce((a, [, w]) => a + w + gap, 0);
    const shot = (t) => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'); window.slidePlan(b).draw(ctx, W, H, null, t); return ctx; };
    const at = (ctx, x) => Array.from(ctx.getImageData(Math.round(x), Math.round(H / 2), 1, 1).data).slice(0, 3);
    const blueLeft = (ctx) => { const d = ctx.getImageData(0, Math.round(H / 2), W, 1).data; for (let x = 0; x < W; x++) { const i = x * 4; if (d[i + 2] > 200 && d[i] < 60 && d[i + 1] < 60) return x; } return -1; };
    const c0 = shot(0), shift = 100, c1 = shot(shift / period);
    return { n: imgs.length, err: b._sldImgs?.err ?? null, m0: mid(imgs[0]), m1: mid(imgs[1]),
      red0: at(c0, cx[0][0] + cx[0][1] / 2), blue0: at(c0, cx[1][0] + cx[1][1] / 2), bl0: blueLeft(c0), bl1: blueLeft(c1), info: window.slidePlan(b).info };
  }, id);
  expect({ n: r.n, err: r.err }, '[전제] 칸 셋을 찍음').toEqual({ n: 3, err: null });
  expect([r.m0, r.m1], '★찍은 칸 = 칸 안 사진 색').toEqual([[255, 0, 0], [0, 0, 255]]);
  expect([r.red0, r.blue0], '★t=0 = 첫 장면 칸 자리').toEqual([[255, 0, 0], [0, 0, 255]]);
  expect(Math.abs((r.bl0 - r.bl1) - 100), `★칸 안 내용까지 같이 흐름(파랑 왼끝 ${r.bl0} → ${r.bl1})`).toBeLessThanOrEqual(2);
  expect(r.info).toContain('정지 한 장');
  expect(errs, errs.join(' | ')).toEqual([]);
});

async function withText(page) {
  const { errs, id } = await menuScene(page);
  await page.evaluate((id) => { const cell = document.getElementById(id).querySelectorAll('.sld-cell')[1]; window._activeFrame = cell; window.addTextBlock('body'); window._activeFrame = null; }, id);
  return { errs, id };
}

test('F5 복제(⌘D) — 칸·글자 id 새로 · 사본을 지워도 원본 그대로', async ({ page }) => {
  const { errs, id } = await withText(page);
  const ids0 = await page.evaluate((id) => { const b = document.getElementById(id); return [...b.querySelectorAll('.sld-cell, .text-block')].map((e) => e.id); }, id);
  await page.evaluate((id) => window.selectBlock(id), id);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+d');
  await expect.poll(() => page.locator('#canvas .slide-block').count(), '[전제] 사본').toBe(2);
  const r = await page.evaluate(({ id, ids0 }) => {
    const copy = [...document.querySelectorAll('#canvas .slide-block')].find((b) => b.id !== id);
    const ids1 = [...copy.querySelectorAll('.sld-cell, .text-block')].map((e) => e.id);
    const all = [...document.querySelectorAll('#canvas [id]')].map((e) => e.id), dup = all.filter((x, i) => x && all.indexOf(x) !== i);
    copy.querySelectorAll('.sld-cell')[1].querySelectorAll('.text-block').forEach((t) => (t.closest('.frame-block[data-text-frame]') || t).remove());
    return { mode: copy.dataset.cellMode, cells: copy.querySelectorAll('.sld-cell').length, overlap: ids1.filter((x) => ids0.includes(x)), dup, origText: document.getElementById(id).querySelectorAll('.sld-cell')[1].querySelectorAll('.text-block').length };
  }, { id, ids0 });
  expect(r, '★사본 = 프레임 칸 3 · 원본과 겹치는 id 0 · 문서 안 겹침 0 · 사본 지워도 원본 글자 그대로').toEqual({ mode: 'frame', cells: 3, overlap: [], dup: [], origText: 1 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('F6 Figma — 프레임 모드 = frame + 칸 children(칸 안 글자까지) · images 없음', async ({ page }) => {
  const { errs, id } = await withText(page);
  /* 칸 셋이 다 첫 장면 안에 들게 30% 씩(기본 60% 면 칸 3 은 블럭 오른끝 밖 = 내보내기에서 빠지는 게 맞다 — 정적 첫 장면 = 보이는 칸만 · 사진 모드 images 와 같은 규칙) */
  await page.evaluate((id) => { const b = document.getElementById(id); b.querySelectorAll('.sld-cell').forEach((c) => { c.dataset.w = '30'; }); window.renderSlideBlock(b); }, id);
  const r = await page.evaluate((id) => {
    let node = null; const walk = (o) => { if (node || !o || typeof o !== 'object') return; if (o.id === id) { node = o; return; } Object.values(o).forEach(walk); };
    walk(window.buildFigmaExportJSON?.(null));
    if (!node) return { why: '노드 없음' };
    const kids = node.children || [];
    const hasText = (o) => !!o && typeof o === 'object' && (o.type === 'text' || Object.values(o).some(hasText));
    return { type: node.type, images: Array.isArray(node.images), n: kids.length, xsUp: kids.every((k, i) => i === 0 || k.x > kids[i - 1].x), kidTypes: kids.map((k) => k.block?.type), textIn: kids.map((k) => hasText(k.block)), w0: kids[0]?.w > 0 };
  }, id);
  expect(r, `★Figma 프레임 칸 — ${JSON.stringify(r)}`).toEqual({ type: 'frame', images: false, n: 3, xsUp: true, kidTypes: ['frame', 'frame', 'frame'], textIn: [false, true, false], w0: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('F4 옛 사진 모드 — 다시 열어도 글자 그대로 · «프레임으로 바꾸기»(누를 때만) · ⌘Z 한 번 = 사진 모드', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => {
    const mk = (c) => { const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 40, 30); return cv.toDataURL('image/png'); };
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = c.querySelector('.section-block'); window.selectSection(sec);
    const { row, block } = window.makeSlideBlock({ slides: [{ src: mk('#ff0000'), w: 40 }, { src: mk('#0000ff') }] });   // 옛 사진 모드(표식 없음)
    (sec.querySelector('.section-inner') || sec).appendChild(row); window.bindBlock?.(block);
    window.pushHistory?.();
    return block.id;
  });
  /* 저장본 바이트 = serializeProject 페이지 canvas 안 «그 슬라이드 블럭» 글자 — 저장 → 다시 열기 → 다시 저장해도 같아야(열 때 변환 0).
     ⛔canvas 통째로 재지 않는다 — 섹션 툴바(.st-memo-btn)는 열 때 편집기가 다시 그려 속성 순서가 바뀐다(슬라이드와 무관 · 지혜맥 sf5 실측) */
  const saved = () => page.evaluate((id) => { window.flushCurrentPage?.(); const d = JSON.parse(window.serializeProject());
    const doc = new DOMParser().parseFromString(`<div>${d.pages.map((p) => p.canvas).join('')}</div>`, 'text/html'); return doc.getElementById(id)?.outerHTML ?? null; }, id);
  const bytes0 = await saved();
  await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); });
  expect(bytes0, '[전제] 저장본에 그 블럭').not.toBeNull();
  expect(await saved(), '★다시 열어도 저장본의 슬라이드 블럭 글자 그대로(옛 사진 블럭 변환 0)').toBe(bytes0);
  expect(await page.evaluate((id) => document.getElementById(id).querySelectorAll('.sld-card').length, id), '첫 장면 = 옛 사진 카드').toBe(2);
  await page.evaluate((id) => window.selectBlock(id), id);
  await page.click('#sld-to-frame');
  const f = await page.evaluate((id) => {
    const b = document.getElementById(id), cells = [...b.querySelectorAll(':scope > .sld-track > .sld-cell')];
    return { mode: b.dataset.cellMode || null, slides: b.dataset.slides ?? null, cards: b.querySelectorAll('.sld-card').length, n: cells.length, w0: cells[0]?.dataset.w ?? null,
      imgs: cells.map((c) => (c.querySelector('.asset-block')?.dataset.imgSrc || '').slice(0, 22)),
      fill: cells.map((c) => { const a = c.querySelector('.asset-block'); if (!a) return null; const r = c.getBoundingClientRect(), q = a.getBoundingClientRect(); return [Math.round(q.width / r.width * 100) / 100, Math.round(q.height / r.height * 100) / 100]; }) };
  }, id);
  expect(f, '★프레임 칸 2 · 칸마다 그 사진 · 칸 1 폭 40 · data-slides 걷힘').toEqual({ mode: 'frame', slides: null, cards: 0, n: 2, w0: '40', imgs: ['data:image/png;base64,', 'data:image/png;base64,'], fill: [[1, 1], [1, 1]] });
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate((id) => { const b = document.getElementById(id); return { mode: b.dataset.cellMode || null, n: JSON.parse(b.dataset.slides || '[]').length, cards: b.querySelectorAll('.sld-card').length, cells: b.querySelectorAll('.sld-cell').length }; }, id),
    '★⌘Z 한 번 = 사진 모드').toEqual({ mode: null, n: 2, cards: 2, cells: 0 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* SLIDE-CLICK-SELECT-DBL-UNFOLD-01 — 칸은 «펼친» 뒤에만 누를 수 있다(접힌 동안 한 번 = 슬라이드만) ⇒ 접혀 있으면 진짜 두 번 누름으로 펼치고 칸을 누른다 */
/* 칸 i 고르기(진짜 누름) — 접혔으면 두 번 눌러 펼치고 «펼친 뒤» 점을 다시 잰다 · 고른 칸 = 그 칸 · 패널 그 칸 줄까지 기다림(받은 값 = 진단)
   (지혜맥 77f0425f4 C2 3번 중 1번 #sld-cell-radius 대기 빨강 — 옛 판은 펼치기 전 점 하나로 두 번 + 한 번 · 고름 확인 없이 다음 줄로 · 어느 쪽에서 졌는지 미확인 ⇒ 고름을 단언으로) */
/* 누를 점 = «임자 맞음 + 같은 자리 두 번 연속»일 때(조건 대기 · 지혜맥 261120 load 9 에서 K1·P1 이 배율·스크롤이 멎기 전 점을 눌러 1/3 빨강) */
/* 받은 값 = «ok|same|who» 글 — 실패하면 무엇이 그 자리를 쥐었나(who)가 그대로 찍힌다(지혜맥 261120 jsfc4: toMatchObject 차이엔 who 가 안 보였다) */
const stableAt = async (page, fn, arg, msg) => {
  let prev = '', p = null;
  await expect.poll(async () => { p = await page.evaluate(fn, arg); const k = JSON.stringify(p && [Math.round(p.x), Math.round(p.y)]); const same = k === prev; prev = k; return `${!!p && !!p.ok}|${same}|${p && p.who}`; }, { message: msg, intervals: [50] }).toMatch(/^true\|true\|/);
  return p;
};
const pickCell = async (page, id, i) => {
  await waitZoomSettled(page, await page.evaluate(() => window.currentZoom));
  /* 접힌 칸은 pointer-events none(누름이 슬라이드로) — 접혔으면 임자 = 슬라이드 안 · 펼쳤으면 임자 = 그 칸 «자신»(빈 곳 — 칸 안 블럭이면 그 블럭이 골라진다).
     ★자리 고르기(지혜맥 261120 jsfc4 R1 5/5): 옛 «왼위 +8» 은 칸 1 이면 고른 슬라이드의 왼위 모서리 = 크기 손잡이 자리 ⇒ 칸 안 격자에서 «임자 맞는» 첫 점을 고른다 · 옛 점의 임자는 DIAG 로 남긴다
     ★확인(독립 리뷰 261120 ⓒ1 닫음): 지혜맥 744a31342 ×3 런 [pickCell DIAG] «0 펼침 옛 왼위+8 임자 = DIV.ss-radius-handle.nw#(손잡이 층)» 1건 — 추정이 실측으로 맞음(R1 초록) */
  const at = (folded) => stableAt(page, ({ id, i, folded }) => { const W = (e) => e ? `${e.tagName}.${[...e.classList].join('.')}#${e.id}${e.closest && e.closest('#ss-handles-overlay') ? '(손잡이 층)' : ''}` : null;
    const b = document.getElementById(id), c = b.querySelectorAll('.sld-cell')[i], r = c.getBoundingClientRect();
    /* 펼침: 먼저 칸 «자신»(빈 곳) · 없으면(그림이 칸을 꽉 채움 — C2) 칸 안 자식 — 앱 뜻: 안 고른 칸의 내용을 누르면 «칸»이 먼저 골라진다(C2 옛 판이 이 길로 초록) */
    const passes = folded ? [(e) => !!e && b.contains(e)] : [(e) => e === c, (e) => !!e && c.contains(e)];
    const old = document.elementFromPoint(r.left + 8, r.top + 8);
    for (const ok of passes) for (const fy of [0.12, 0.3, 0.5, 0.7]) for (const fx of [0.15, 0.3, 0.5, 0.7, 0.85]) { const x = r.left + r.width * fx, y = r.top + r.height * fy, e = document.elementFromPoint(x, y); if (ok(e)) return { x, y, ok: true, who: W(e), old: W(old) }; }
    return { x: r.left + 8, y: r.top + 8, ok: false, who: W(old), old: W(old) }; }, { id, i, folded }, `[pickCell] 칸 ${i + 1} 누를 점(임자·같은 자리 두 번 · 받은 값 끝 = 임자)`)
    .then((p) => { console.log('[pickCell DIAG]', i, folded ? '접힘' : '펼침', '옛 왼위+8 임자 =', p.old, '· 고른 점 임자 =', p.who); return p; });
  if (!(await page.evaluate((id) => document.getElementById(id).classList.contains('sld-unfold'), id))) {
    const p0 = await at(true), q0 = [p0.x, p0.y];
    await page.mouse.dblclick(q0[0], q0[1]);
    await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('sld-unfold'), id), '[pickCell] 두 번 = 펼침').toBe(true);
  }
  const p1 = await at(false), q = [p1.x, p1.y];
  await page.mouse.click(q[0], q[1]);
  await expect.poll(() => page.evaluate(({ id, i, q }) => {
    const b = document.getElementById(id), c = b.querySelectorAll('.sld-cell')[i], e = document.elementFromPoint(q[0], q[1]);
    return { sel: c.classList.contains('selected'), active: window._activeFrame === c, row: document.querySelector('.sld-cell-row.active')?.dataset.idx ?? null,
      who: e ? `${e.tagName}.${[...e.classList].join('.')}#${e.id}` : null, sels: [...document.querySelectorAll('#canvas .selected')].map((x) => `${x.className.split(' ')[0]}#${x.id}`), open: b.classList.contains('sld-unfold') };
  }, { id, i, q }), `[pickCell] 칸 ${i + 1} 고름 · 받은 값 = 진단`).toMatchObject({ sel: true, active: true, row: String(i) });
};
const nSlides = (page) => page.locator('#canvas .slide-block').count();

test('R1 칸 Delete = 그 칸만 · 한 칸이면 무동작 · ⌘X·⌘C 는 슬라이드를 안 건드림', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  const c0 = await cellIds(page, id);
  await pickCell(page, id, 1);
  await key(page, 'Delete');
  await expect.poll(() => cellIds(page, id), '★Delete = 칸 2 만 빠짐').toEqual([c0[0], c0[2]]);
  expect(await nSlides(page), '슬라이드 그대로').toBe(1);
  await key(page, 'Meta+z');
  await expect.poll(() => cellIds(page, id), '⌘Z = 칸 3').toEqual(c0);
  await pickCell(page, id, 0);
  await key(page, 'Meta+x');
  expect({ n: await nSlides(page), cells: await cellIds(page, id) }, '★⌘X 무동작').toEqual({ n: 1, cells: c0 });
  await pickCell(page, id, 0);
  await key(page, 'Meta+c');
  await page.evaluate(() => { window.deselectAll(); window.selectSection(document.querySelector('#canvas .section-block')); });
  await key(page, 'Meta+v');
  expect(await nSlides(page), '★⌘C(칸) → ⌘V 해도 슬라이드 1').toBe(1);
  /* 한 칸이면 Delete 무동작 */
  await page.evaluate((id) => { const b = document.getElementById(id); b.querySelectorAll('.sld-cell').forEach((c, i) => { if (i) c.remove(); }); window.renderSlideBlock(b); }, id);
  await pickCell(page, id, 0);
  await key(page, 'Delete');
  expect({ n: await nSlides(page), cells: (await cellIds(page, id)).length }, '★마지막 칸 Delete 무동작').toEqual({ n: 1, cells: 1 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R3 프레임 모드 슬라이드 칸 위 스크래치 놓기 = 그 칸 안 · data-slides 무변', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  const png = await page.evaluate(() => { const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30; cv.getContext('2d').fillRect(0, 0, 40, 30); return cv.toDataURL('image/png'); });
  const p = await page.evaluate((id) => { const r = document.getElementById(id).querySelectorAll('.sld-cell')[0].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
  const a0 = await page.locator('#canvas .asset-block').count();
  expect(await page.evaluate(({ x, y }) => window.previewScratchDropAt(x, y), p)).toBe('slidecell');
  const ok = await page.evaluate(({ x, y, src }) => { const r = window.commitScratchDropAt(x, y, src); window.clearScratchDropGuides?.(); return r; }, { ...p, src: png });
  expect(ok).toBe(true);
  const r = await page.evaluate((id) => { const b = document.getElementById(id); return { slides: b.dataset.slides, inCell: b.querySelectorAll('.sld-cell')[0].querySelectorAll('.asset-block').length }; }, id);
  expect(r, '★칸 1 안 에셋 · data-slides 그대로([])').toEqual({ slides: '[]', inCell: 1 });
  expect(await page.locator('#canvas .asset-block').count(), '새 에셋은 그 칸 안 하나뿐').toBe(a0 + 1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R4 칸만 고른 ⌘D = 무동작 · 칸 안 글자 고른 ⌘D = 그 칸 안에 하나 더', async ({ page }) => {
  const { errs, id } = await withText(page);
  /* ★클립보드에 먼저 무엇을 담아 둔다 — 비어 있으면 ⌘D 칸 가드가 없어도 copySelected(칸 = 복사 안 함) 뒤 붙여넣기가 «아무것도 없어서» 조용했다(지혜맥: CTL10 이 R4 를 못 붉힘) */
  await page.evaluate((id) => { const t = document.getElementById(id).querySelectorAll('.sld-cell')[1].querySelector('.text-block'); window.deselectAll(); window.selectBlock(t.id); }, id);
  await key(page, 'Meta+c');
  const nText0 = await page.locator('#canvas .text-block').count();
  await pickCell(page, id, 1);
  await key(page, 'Meta+d');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));   // ⌘D 붙여넣기는 같은 틱 — 두 프레임 뒤 «안 늘었다»를 잰다(고정 대기 0)
  expect(await page.locator('#canvas .text-block').count(), '★칸 ⌘D = 아무것도 안 붙음(클립보드가 차 있어도)').toBe(nText0);
  const r = await page.evaluate((id) => { const b = document.getElementById(id); return { nested: b.querySelectorAll('.sld-cell .slide-block').length, cells: b.querySelectorAll('.sld-cell').length }; }, id);
  expect({ n: await nSlides(page), ...r }, '★칸 ⌘D 무동작(슬라이드 1 · 중첩 0)').toEqual({ n: 1, nested: 0, cells: 3 });
  await page.evaluate((id) => { const t = document.getElementById(id).querySelectorAll('.sld-cell')[1].querySelector('.text-block'); window.deselectAll(); window.selectBlock(t.id); }, id);
  await key(page, 'Meta+d');
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).querySelectorAll('.sld-cell')[1].querySelectorAll('.text-block').length, id), '칸 안 글자 ⌘D = 그 칸 안 2').toBe(2);
  expect(await nSlides(page)).toBe(1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R5 GIF 캐시 키 짧음 · 칸 안이 바뀌면 키 바뀜', async ({ page }) => {
  const { errs, id } = await withText(page);
  const r = await page.evaluate(async (id) => {
    const b = document.getElementById(id);
    await window.slidePrepare(b); const k1 = b._sldImgs?.key || '';
    b.querySelectorAll('.sld-cell')[0].appendChild(Object.assign(document.createElement('span'), { textContent: 'x' }));
    await window.slidePrepare(b); const k2 = b._sldImgs?.key || '';
    return { len: k1.length, changed: k1 !== k2, html: b.innerHTML.length };
  }, id);
  expect(r.len, `★키 길이 ${r.len}(innerHTML ${r.html})`).toBeLessThan(80);
  expect(r.changed, '칸 안 바뀜 = 키 바뀜').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P1 펼침 — 트랙 밖 칸 4 를 캔버스에서 고침 · 저장 왕복 · 흔적 0 · 캡처 픽셀 같음 · 옆 블럭 클릭', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  await wireCdp(page);
  await page.evaluate((id) => { const b = document.getElementById(id); window.addSlideCell(b); window.addSlideCell(b);
    const sec = b.closest('.section-block'); window.selectSection(sec); }, id);   // 칸 5(기본 60% → 칸 2~5 는 블럭 밖)
  const otherId = await page.evaluate(() => { window._activeFrame = null; const r = window.addTextBlock('body'); return document.querySelector('#canvas .section-block .text-block:not(.sld-cell .text-block)')?.id || null; });
  expect(otherId, '[전제] 슬라이드 옆(같은 섹션) 글자 블럭').not.toBeNull();
  await page.evaluate((id) => window.selectBlock(id), id);
  await expect(page.locator('.sld-cell-row[data-idx="3"] .prop-label')).toHaveCount(1);
  await page.click('.sld-cell-row[data-idx="3"] .prop-label');
  const hit = () => page.evaluate((id) => { const c = document.getElementById(id).querySelectorAll('.sld-cell')[3], r = c.getBoundingClientRect();
    const x = Math.min(window.innerWidth - 2, r.left + r.width / 2), y = r.top + r.height / 2; const e = document.elementFromPoint(x, y); return { in: !!e && (e === c || c.contains(e)), x: Math.round(x) }; }, id);
  const h1 = await hit();
  expect(h1.in, `★펼침 = 칸 4 가 캔버스에 보이고 맞는다(${h1.x})`).toBe(true);
  /* 칸 4 클릭 → 넣기 → 캔버스에서 글 고침 */
  const c4 = await page.evaluate((id) => { const r = document.getElementById(id).querySelectorAll('.sld-cell')[3].getBoundingClientRect(); return [Math.min(window.innerWidth - 4, r.left + 10), r.top + 10]; }, id);
  await page.mouse.click(c4[0], c4[1]);
  await page.evaluate(() => window.addTextBlock('body'));
  const tid = await page.evaluate((id) => document.getElementById(id).querySelectorAll('.sld-cell')[3].querySelector('.text-block')?.id || null, id);
  expect(tid, '[전제] 칸 4 안 글자').not.toBeNull();
  const tp = await page.evaluate((tid) => { const t = document.getElementById(tid).querySelector('[contenteditable], [class^="tb-"]') || document.getElementById(tid); t.scrollIntoView({ block: 'center', inline: 'center' }); const r = t.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, tid);
  await page.mouse.dblclick(tp[0], tp[1]);
  await page.keyboard.press('Meta+a'); await page.keyboard.type('칸넷고침');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate((tid) => document.getElementById(tid)?.textContent.trim(), tid), '[전제] 캔버스에서 고친 글').toBe('칸넷고침');
  /* 펼친 채 캡처 = 안 펼친 캡처(픽셀) */
  /* 진짜 PNG 내보내기(exportSection · returnDataUrl) — 캡처 클론이 .selected 를 걷는지가 곧 «펼침이 내보내기에 안 샌다» */
  const shot = () => page.evaluate(async (id) => window.exportSection(document.getElementById(id).closest('.section-block'), 'png', 860, { returnDataUrl: true }), id);
  await page.evaluate(({ id, tid }) => { window.deselectAll(); document.getElementById(tid).classList.add('selected'); window.unfoldSlide(document.getElementById(id), true); }, { id, tid });   // 펼친 채(두 번 누름 상태)
  /* ★기대 바뀜(SLIDE-CELL-SHADOW-CLIP-01 · 134 · 지디 261120 판정): 134 부터 접힌 블럭도 overflow visible(칸 그림자 위아래) · 가로 자름은 clip-path inset(…) ⇒ 펼침/접힘 = clip-path 로 가른다(펼침 = none · css .sld-unfold) */
  expect(await page.evaluate((id) => { const cs = getComputedStyle(document.getElementById(id)); return [cs.overflow, cs.clipPath]; }, id), '[전제] 펼친 상태(자름 없음)').toEqual(['visible', 'none']);
  const sOpen = await shot();
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Escape');   // Esc = 접힘(SLIDE-CLICK-SELECT-DBL-UNFOLD-01 · 옛 «고름 풀면 접힘»)
  expect(await page.evaluate((id) => getComputedStyle(document.getElementById(id)).clipPath.startsWith('inset('), id), 'Esc = 접힘(잘림 = 가로 clip-path · 134)').toBe(true);
  const sClosed = await shot();
  expect(sOpen && sOpen.length > 100, '[전제] PNG 가 나왔다').toBe(true);
  expect(sOpen === sClosed, '★펼친 채 PNG = 안 펼친 PNG(글자 그대로)').toBe(true);
  /* 고름 풀면 칸 4 자리 = 칸 4 아님 */
  expect((await hit()).in, '접히면 칸 4 는 잘려 안 맞는다').toBe(false);
  /* 펼침 중 옆 블럭 클릭 */
  await page.evaluate((id) => { window.selectBlock(id); window.unfoldSlide(document.getElementById(id), true); }, id);
  /* 앞에서 칸 4 로 캔버스를 가로 스크롤했다 ⇒ 옆 글자가 화면 밖일 수 있다(지혜맥 P1 빨강) — 펼친 채(슬라이드 고름 유지) 그 글자를 화면 안으로 · 누르기 «전» 그 점이 누구인지 잰다:
     글자가 아니면 «무엇이 덮었나»를 메시지로(펼친 칸·덮개가 가로채면 여기서 이름이 나온다 = 제품 빨강) */
  await page.evaluate((oid) => document.getElementById(oid).scrollIntoView({ block: 'center', inline: 'center' }), otherId);
  await waitZoomSettled(page, await page.evaluate(() => window.currentZoom));
  /* 지혜맥 261120 1/3 빨강: 한 번 잰 점을 곧장 눌렀다(스크롤·배율이 멎기 전) → 임자 맞음 + 같은 자리 두 번 뒤 누름 · 고름은 poll
     ★기대 바뀜(지디 261120 ⓐ · 현빈 7112 «띠가 보이면 띠가 이긴다» = 그리드 R1 과 같은 뜻): 펼친 슬라이드의 칸 위 띠(141)가 옆 글자 일부를 덮으면 그 자리 탭은 띠 것(B1 이 잰다).
     옆 글자는 «띠 밖» 점(그 글자가 맨 위인 점)을 눌러 고른다 — 글자 안 격자에서 임자 = 글자인 첫 점. */
  let op = null;
  await expect.poll(async () => { const p = await page.evaluate((oid) => { const t = document.getElementById(oid), r = t.getBoundingClientRect(); let x = r.left + r.width / 2, y = r.top + r.height / 2, e = document.elementFromPoint(x, y);
      for (const fy of [0.5, 0.25, 0.75, 0.1, 0.9]) { if (e && (e === t || t.contains(e))) break; for (const fx of [0.5, 0.25, 0.75]) { const xx = r.left + r.width * fx, yy = r.top + r.height * fy, ee = document.elementFromPoint(xx, yy); if (ee && (ee === t || t.contains(ee))) { x = xx; y = yy; e = ee; break; } } }
      /* 독립 리뷰 261120 ⓑ2: «격자 중 하나라도 글자면 통과»는 펼친 칸·덮개가 글자 대부분을 먹는 회귀를 못 잡는다 ⇒ 가운데 점 임자 = 글자 또는 칸 띠(.grd-headband · 7112 띠 우선)여야 */
      const c0 = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const center = !c0 ? 'null' : (c0 === t || t.contains(c0)) ? 'text' : c0.closest('.grd-headband') ? 'band' : `${c0.tagName}.${[...c0.classList].join('.')}#${c0.id}`;
      return { x, y, center, hit: !!e && (e === t || t.contains(e)), who: e ? `${e.tagName}.${[...e.classList].join('.')}#${e.id}` : null, open: getComputedStyle(document.querySelector('#canvas .slide-block')).clipPath }; }, otherId);
    const same = !!op && Math.round(op.x) === Math.round(p.x) && Math.round(op.y) === Math.round(p.y); op = p; return `${p.hit}|${same}|${p.who}`; },
    { message: '★펼침 중 옆 글자 자리 = 글자(같은 자리 두 번) — 받은 값 끝 = 덮은 것', intervals: [50] }).toMatch(/^true\|true\|/);
  expect(op.open, '[전제] 아직 펼친 채(자름 없음)').toBe('none');
  expect(['text', 'band'].includes(op.center), `★옆 글자 가운데 임자 = 글자 또는 칸 띠(받은 = ${op.center})`).toBe(true);
  expect(op.hit, `★펼침 중 옆 글자 자리를 덮은 것 = ${op.who}`).toBe(true);
  await page.mouse.click(op.x, op.y);
  await expect.poll(() => page.evaluate((oid) => document.getElementById(oid).classList.contains('selected'), otherId), '★펼침(흐림 덮개) 중 옆 글자 블럭 클릭 = 골라짐').toBe(true);
  /* 저장본 흔적 0 · 저장→다시 열기 글 그대로 */
  await page.evaluate((id) => window.selectBlock(id), id);
  const savedSlide = await page.evaluate((id) => { window.flushCurrentPage?.(); const d = JSON.parse(window.serializeProject());
    const doc = new DOMParser().parseFromString(`<div>${d.pages.map((p) => p.canvas).join('')}</div>`, 'text/html'); const b = doc.getElementById(id);
    return b ? { cls: b.className, ov: b.style.overflow, clip: b.style.clipPath.startsWith('inset('), hsVar: b.style.getPropertyValue('--sld-hs-x'), selIn: b.querySelectorAll('.selected').length } : null; }, id);
  /* ★기대 바뀜(SLIDE-CELL-SHADOW-CLIP-01 · 134 · 지디 261120): 저장본의 접힌 블럭 = overflow visible + 가로 clip-path(inset) — 옛 'hidden' 아님.
     «펼침 흔적 0»은 그대로 잰다: 클래스 = slide-block 뿐(sld-unfold·sld-hs·selected 없음) · 밀기 변수 없음 · 안에 .selected 0 · 자름 = 접힌 꼴(inset). */
  expect(savedSlide, '★저장본 슬라이드 = 펼침 흔적 0').toEqual({ cls: 'slide-block', ov: 'visible', clip: true, hsVar: '', selIn: 0 });
  await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); });
  expect(await page.evaluate((tid) => document.getElementById(tid)?.textContent.trim(), tid), '★다시 열어도 칸 4 글').toBe('칸넷고침');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('Q1 캔버스 ＋ — 고른 칸을 내용째 복사 · id 새로 · ⌘Z 한 번 · 안 고르면 마지막 칸', async ({ page }) => {
  const { errs, id } = await withText(page);
  const c0 = await cellIds(page, id);
  await pickCell(page, id, 1);
  const plus = page.locator('#grd-plus-layer .sld-add-btn');
  await expect(plus, '★칸 고름 = 캔버스 ＋').toHaveCount(1);
  expect(await page.locator('#canvas .sld-add-btn').count(), '＋ 는 #canvas 밖').toBe(0);
  await plus.click();
  await expect.poll(() => cellIds(page, id).then((a) => a.length)).toBe(4);
  const r = await page.evaluate(({ id, c0 }) => {
    const cells = [...document.getElementById(id).querySelectorAll(':scope > .sld-track > .sld-cell')], nw = cells[2];
    const all = [...document.querySelectorAll('#canvas [id]')].map((e) => e.id), dup = all.filter((x, i) => x && all.indexOf(x) !== i);
    return { order: cells.map((c) => c.id === c0[0] ? 'a' : c.id === c0[1] ? 'b' : c.id === c0[2] ? 'c' : 'new'), text: nw.querySelectorAll('.text-block').length, srcText: cells[1].querySelectorAll('.text-block').length, dup, sel: nw.classList.contains('selected') && window._activeFrame === nw };
  }, { id, c0 });
  expect(r, '★칸 2 바로 뒤 새 칸 · 글자째 · id 겹침 0 · 새 칸 고름').toEqual({ order: ['a', 'b', 'new', 'c'], text: 1, srcText: 1, dup: [], sel: true });
  await key(page, 'Meta+z');
  await expect.poll(() => cellIds(page, id), '★⌘Z 한 번 = 칸 3').toEqual(c0);
  /* 슬라이드만 고름 → 마지막 칸 복사 */
  await page.evaluate((id) => window.selectBlock(id), id);
  await expect(plus).toHaveCount(1);
  await plus.click();
  await expect.poll(() => cellIds(page, id).then((a) => a.length)).toBe(4);
  expect((await cellIds(page, id)).slice(0, 3), '마지막 칸 뒤에').toEqual(c0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('Z1 효과 바꾸기 = 다시 안 찍음(캡처 횟수) · 꽉 꼴 1번 · 내용 바뀌면 1번', async ({ page }) => {
  const { errs, id } = await withText(page);
  await wireCdp(page);
  await page.evaluate(() => { const real = window.electronAPI; window.__caps = 0; window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'captureSectionCdp' ? (o) => { window.__caps++; return real.captureSectionCdp(o); } : real[k]) }); });
  const run = (fx) => page.evaluate(async ({ id, fx }) => { const b = document.getElementById(id); b.dataset.animFx = fx; window.renderSlideBlock(b); await window.slidePrepare(b); return window.__caps; }, { id, fx });
  const seq = [];
  for (const fx of ['slide-flow', 'slide-swipe', 'slide-center', 'slide-trail', 'slide-flow']) seq.push(await run(fx));
  expect(seq, '★효과만 바꿈 = 처음 한 번만 찍음').toEqual([1, 1, 1, 1, 1]);
  expect(await run('slide-fade'), '꽉 꼴(제자리) = 한 번 더').toBe(2);
  expect(await run('slide-swipe'), '다시 카드 폭 꼴 = 기억(안 찍음)').toBe(2);
  await page.evaluate((id) => { document.getElementById(id).querySelectorAll('.sld-cell')[0].appendChild(Object.assign(document.createElement('span'), { textContent: 'x' })); }, id);
  expect(await run('slide-swipe'), '칸 안 내용 바뀜 = 다시 찍음').toBe(3);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('U1 한 번 = 슬라이드만 · 두 번 = 펼침 · 덮개 배율 10 에서도 끝 안 보임 · Esc/밖 = 접힘 · 흔적 0', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  const p = await page.evaluate((id) => { const r = document.getElementById(id).querySelectorAll('.sld-cell')[0].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
  await page.mouse.click(p[0], p[1]);
  const s1 = await page.evaluate(({ id, p }) => { const b = document.getElementById(id), e = document.elementFromPoint(p[0], p[1]); return { sel: b.classList.contains('selected'), open: b.classList.contains('sld-unfold'), cellHit: !!e?.closest('.sld-cell') }; }, { id, p });
  expect(s1, '★한 번 = 슬라이드만 · 칸은 포인터 안 받음').toEqual({ sel: true, open: false, cellHit: false });
  await page.mouse.dblclick(p[0], p[1]);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('sld-unfold'), id), '★두 번 = 펼침').toBe(true);
  /* 배율 10 — 덮개 화면 굵기 ≥ 창 긴 변 2배 */
  const cover = await page.evaluate(async (id) => { window.applyZoom(10); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const b = document.getElementById(id), ow = parseFloat(getComputedStyle(b, '::after').outlineWidth) || 0, k = b.getBoundingClientRect().width / b.offsetWidth;
    return { screen: ow * k, need: 2 * Math.max(window.innerWidth, window.innerHeight), zoom: window.currentZoom }; }, id);
  expect(cover.screen >= cover.need, `★배율 ${cover.zoom} 덮개 화면 ${Math.round(cover.screen)} ≥ ${cover.need}`).toBe(true);
  await page.evaluate(() => { window.applyZoom(40); });
  /* 펼친 채 저장본 · PNG */
  await wireCdp(page);
  const saved = await page.evaluate((id) => { window.flushCurrentPage?.(); const d = JSON.parse(window.serializeProject()); return d.pages.map((x) => x.canvas).join('').includes('sld-unfold'); }, id);
  expect(saved, '★펼친 채 저장본에 sld-unfold 0').toBe(false);
  const png = () => page.evaluate((id) => window.exportSection(document.getElementById(id).closest('.section-block'), 'png', 860, { returnDataUrl: true }), id);
  const open = await png();
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Escape');
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('sld-unfold'), id), '★Esc = 접힘').toBe(false);
  expect(open === await png(), '펼친 채 PNG = 접힌 PNG').toBe(true);
  /* 다시 펼치고 캔버스의 슬라이드 밖 누름 = 접힘 */
  await page.evaluate((id) => window.unfoldSlide(document.getElementById(id), true), id);
  const out = await page.evaluate((id) => { const sec = document.getElementById(id).closest('.section-block'), r = sec.getBoundingClientRect(); return [r.left + 6, r.bottom - 6]; }, id);
  await page.mouse.click(out[0], out[1]);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('sld-unfold'), id), '★밖 누름 = 접힘').toBe(false);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H1 높이 손잡이 — 끌기 = 블럭 높이 · 칸 따라감 · ⌘Z', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  await page.evaluate((id) => window.selectBlock(id), id);
  const hh = page.locator('#grd-plus-layer .sld-h-handle');
  await expect(hh, '★고르면 높이 손잡이').toHaveCount(1);
  expect(await page.locator('#canvas .sld-h-handle').count(), '손잡이는 #canvas 밖').toBe(0);
  const z = await page.evaluate(() => (window.currentZoom || 40) / 100);
  /* ★손잡이 자리는 rAF 가 맞춘다 — 고른 바로 뒤엔 아직 (0,0) 일 수 있다(지혜맥 H1 흔들림) ⇒ 손잡이 가운데 = 블럭 오른쪽 아래가 될 때까지(조건 대기) */
  const corner = () => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(), h = document.querySelector('#grd-plus-layer .sld-h-handle').getBoundingClientRect(); return Math.abs((h.left + h.right) / 2 - r.right) + Math.abs((h.top + h.bottom) / 2 - r.bottom); }, id);
  await expect.poll(corner, '[전제] 손잡이가 블럭 모서리에').toBeLessThanOrEqual(1.5);
  const bx = await hh.boundingBox(), x = bx.x + bx.width / 2, y = bx.y + bx.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + 60 * z, { steps: 6 }); await page.mouse.up();
  const r = await page.evaluate((id) => { const b = document.getElementById(id); return { h: window.readSlideState(b).layout.h, ok: [...b.querySelectorAll('.sld-cell')].every((c) => Math.abs(c.offsetHeight - b.clientHeight) <= 1) }; }, id);
  expect(r, '★높이 360 → 420 · 칸 따라감').toEqual({ h: 420, ok: true });
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate((id) => window.readSlideState(document.getElementById(id)).layout.h, id), '⌘Z 한 번 = 360').toBe(360);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H2 칸별 높이 — 그 칸만 50% · 가운데 · GIF 같은 자리', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  await wireCdp(page);
  await page.evaluate((id) => {
    const b = document.getElementById(id), cell = b.querySelectorAll('.sld-cell')[1], cv = document.createElement('canvas'); cv.width = 40; cv.height = 30; const x = cv.getContext('2d'); x.fillStyle = '#0000ff'; x.fillRect(0, 0, 40, 30);
    b.querySelectorAll('.sld-cell').forEach((c) => { c.dataset.w = '30'; }); window.renderSlideBlock(b);
    window.appendSlideCellImage(cell, cv.toDataURL('image/png'));
    window.selectBlock(id);
  }, id);
  await page.waitForFunction((id) => !!document.getElementById(id).querySelector('.sld-cell .asset-block img')?.naturalWidth, id);
  await page.locator('.sld-cell-row[data-idx="1"] .sld-ch').fill('50'); await page.locator('.sld-cell-row[data-idx="1"] .sld-ch').dispatchEvent('change');
  const dom = await page.evaluate((id) => {
    const b = document.getElementById(id), t = b.querySelector('.sld-track').getBoundingClientRect(), cs = [...b.querySelectorAll('.sld-cell')].map((c) => c.getBoundingClientRect());
    return { h: cs.map((r) => Math.round(r.height / t.height * 100)), mid: Math.abs((cs[1].top + cs[1].bottom) / 2 - (t.top + t.bottom) / 2) <= 1, dh: document.getElementById(id).querySelectorAll('.sld-cell')[1].dataset.h };
  }, id);
  expect(dom, '★칸 2 만 50% · 가운데').toEqual({ h: [100, 50, 100], mid: true, dh: '50' });
  const g = await page.evaluate(async (id) => {
    const b = document.getElementById(id), br = b.getBoundingClientRect(), k = br.width / b.offsetWidth, c = b.querySelectorAll('.sld-cell')[1].getBoundingClientRect();
    await window.slidePrepare(b);
    const W = b.offsetWidth, H = b.offsetHeight, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'); window.slidePlan(b).draw(ctx, W, H, null, 0);
    const x = ((c.left + c.right) / 2 - br.left) / k, p = (y) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data);
    return { top: p(6)[3], mid: p(H / 2).slice(0, 3) };
  }, id);
  expect(g, '★GIF 칸 2 위쪽 = 빔 · 가운데 = 칸 2 그림').toEqual({ top: 0, mid: [0, 0, 255] });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('C1 칸 손잡이 — 끌기 = 칸 폭·높이 % · 그 칸만 · ⌘Z', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  await pickCell(page, id, 1);
  const ch = page.locator('#grd-plus-layer .sld-cell-handle');
  await expect(ch, '★고른 칸 = 칸 손잡이').toHaveCount(1);
  const before = await page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.sld-cell')].map((c) => [c.dataset.w ?? null, c.dataset.h ?? null]), id);
  const z = await page.evaluate(() => (window.currentZoom || 40) / 100);
  /* ★칸 손잡이 자리도 rAF — 칸 오른쪽 아래에 설 때까지(조건 대기 · 지혜맥 C1 흔들림) */
  const corner = () => page.evaluate((id) => { const r = document.getElementById(id).querySelectorAll('.sld-cell')[1].getBoundingClientRect(), h = document.querySelector('#grd-plus-layer .sld-cell-handle').getBoundingClientRect(); return Math.abs((h.left + h.right) / 2 - r.right) + Math.abs((h.top + h.bottom) / 2 - r.bottom); }, id);
  await expect.poll(corner, '[전제] 칸 손잡이가 칸 모서리에').toBeLessThanOrEqual(1.5);
  const bx = await ch.boundingBox(), x = bx.x + bx.width / 2, y = bx.y + bx.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - 100 * z, y - 90 * z, { steps: 6 }); await page.mouse.up();
  const after = await page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.sld-cell')].map((c) => [c.dataset.w ?? null, c.dataset.h ?? null]), id);
  expect(+after[1][0] < 60 && +after[1][1] < 100 && +after[1][1] >= 20, `★칸 2 줄어듦 ${after[1]}`).toBe(true);
  expect([after[0], after[2]], '다른 칸 그대로').toEqual([before[0], before[2]]);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.sld-cell')].map((c) => [c.dataset.w ?? null, c.dataset.h ?? null]), id), '⌘Z 한 번 = 옛 값').toEqual(before);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('C2 칸 모서리·그림자 — 첫 장면 · Figma · GIF 둥근 모서리', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  await wireCdp(page);
  await page.evaluate((id) => { const b = document.getElementById(id), cell = b.querySelectorAll('.sld-cell')[1]; b.querySelectorAll('.sld-cell').forEach((c) => { c.dataset.w = '30'; }); window.renderSlideBlock(b);
    const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30; const x = cv.getContext('2d'); x.fillStyle = '#0000ff'; x.fillRect(0, 0, 40, 30); window.appendSlideCellImage(cell, cv.toDataURL('image/png')); }, id);
  await page.waitForFunction((id) => !!document.getElementById(id).querySelector('.sld-cell .asset-block img')?.naturalWidth, id);
  await pickCell(page, id, 1);
  await page.locator('#ss-radius-num').fill('20'); await page.locator('#ss-radius-num').dispatchEvent('change');   // 142 — 칸 코너 = 프레임 패널 코너(같은 dataset.radius)
  await page.selectOption('#sld-cell-shadow', 'soft');
  const dom = await page.evaluate((id) => { const c = document.getElementById(id).querySelectorAll('.sld-cell')[1], cs = getComputedStyle(c); return { r: cs.borderTopLeftRadius, sh: cs.boxShadow !== 'none' }; }, id);
  expect(dom, '★첫 장면 둥글기 20 · 그림자').toEqual({ r: '20px', sh: true });
  const fig = await page.evaluate((id) => { let node = null; const walk = (o) => { if (node || !o || typeof o !== 'object') return; if (o.id === id) { node = o; return; } Object.values(o).forEach(walk); }; walk(window.buildFigmaExportJSON?.(null)); return node?.children?.[1]?.block?.radius ?? null; }, id);
  expect(fig, 'Figma 칸 radius 20').toBe(20);
  const g = await page.evaluate(async (id) => {
    const b = document.getElementById(id), br = b.getBoundingClientRect(), k = br.width / b.offsetWidth, c = b.querySelectorAll('.sld-cell')[1].getBoundingClientRect();
    await window.slidePrepare(b);
    const W = b.offsetWidth, H = b.offsetHeight, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'); window.slidePlan(b).draw(ctx, W, H, null, 0);
    const L = (c.left - br.left) / k, T = (c.top - br.top) / k, p = (x, y) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data).slice(0, 3);
    return { corner: p(L + 1, T + 1), mid: p(L + (c.width / k) / 2, T + (c.height / k) / 2) };
  }, id);
  expect(g.mid, 'GIF 칸 가운데 = 칸 그림').toEqual([0, 0, 255]);
  expect(g.corner[2] < 200, `★GIF 칸 모서리 = 둥근 clip 밖(칸 색 아님) ${g.corner}`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ── 슬라이드 피드백 3 ──
 * U2 SLIDE-UNFOLD-STAY-ON-DELETE-01: 펼쳐 칸 2 고름 → Delete → 칸 2 빠짐 · ★펼침 그대로 · 슬라이드 골라짐 · 남은 칸(옛 칸 3) 자리 elementFromPoint = 그 칸(포인터 받음) · ⌘Z = 칸 3
 * K1 SLIDE-CELL-CHILD-SELECT-OUTLINE-01: 펼쳐 칸 2 에 글자 → 칸 빈 곳 누름 → 글자 가운데 «한 번» 누름 → ★글자 골라짐 · ★선택 층(.ss-sel-layer path) 하나가 글자 상자(글자 래퍼)를 감쌈(±2px)
 *    · 원인(코드): 프레임 «덮개»(editor-blocks.css .frame-block:not(.frame-entered)…:not(:has(.selected)) * = pointer-events none · B안)가 칸에도 걸려 한 번 누름이 칸으로 갔다(defb77053 지혜맥 K1 3/3 전제 빨강)
 *      ⇒ 펼친 슬라이드 칸은 덮개 제외 · 실패하면 받은 값 = 진단(골라진 것 · 길 상자 · 글자 상자 · 그 점의 주인)
 * 양성대조: slide-frame-CTL31-delete-folds.patch(editor.js 칸 빼기의 펼침 되켜기 줄 삭제) → U2 빨강(sld-unfold false) · slide-frame-CTL32-cell-photo-btn.patch(패널 단추 되살림) → F2 빨강(단추 1) · slide-frame-CTL33-cell-cover.patch(덮개의 펼친 칸 제외 삭제) → K1 빨강(tSel false) · slide-frame-CTL34-cell-frame-panel.patch(showFrameProperties 칸 돌림 삭제) → C2 빨강(사진 꽉 찬 칸 누름 = 프레임 패널 · #sld-cell-radius 0) ⚰️142(ⓐ · 지디 261119) 뒤 뜻 바뀜: 칸 = «그 칸의 프레임 패널»이 정답이 되어 CTL34(돌림 삭제)는 이제 제품과 같다 — 칸 패널 갈래의 대조는 slide-frame-CTL46-cell-no-slide-parts.patch(F2·P1 빨강) — 예측 */
test('U2 펼친 채 칸 Delete = 그 칸만 · 펼침 그대로', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  const c0 = await cellIds(page, id);
  await pickCell(page, id, 1);
  expect(await page.evaluate((id) => { const b = document.getElementById(id); return { open: b.classList.contains('sld-unfold'), cell: b.querySelectorAll('.sld-cell')[1].classList.contains('selected') }; }, id), '[전제] 펼침 · 칸 2 고름').toEqual({ open: true, cell: true });
  await key(page, 'Delete');
  await expect.poll(() => cellIds(page, id), 'Delete = 칸 2 만 빠짐').toEqual([c0[0], c0[2]]);
  const s = await page.evaluate((id) => {
    const b = document.getElementById(id), c = b.querySelectorAll('.sld-cell')[1], r = c.getBoundingClientRect(), e = document.elementFromPoint(r.left + 8, r.top + 8);
    return { open: b.classList.contains('sld-unfold'), slideSel: b.classList.contains('selected'), hit: !!e && c.contains(e) };
  }, id);
  expect(s, '★펼침 그대로 · 슬라이드 골라짐 · 남은 칸 포인터 받음').toEqual({ open: true, slideSel: true, hit: true });
  await key(page, 'Meta+z');
  await expect.poll(() => cellIds(page, id), '⌘Z = 칸 3').toEqual(c0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K1 칸 안 블럭 클릭 = 선택선 보임(선택 층이 그 블럭을 감쌈)', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  await pickCell(page, id, 1);
  await page.evaluate(() => window.addTextBlock('body'));
  const tid = await page.evaluate((id) => document.getElementById(id).querySelectorAll('.sld-cell')[1].querySelector('.text-block')?.id || null, id);
  expect(tid, '[전제] 글자 = 칸 2 안').toBeTruthy();
  await page.evaluate(() => document.activeElement?.blur?.());
  await pickCell(page, id, 1);   // 칸 빈 곳(왼위) — 글 고침 끝 · 칸 고름
  const tc = await page.evaluate((tid) => { const r = document.getElementById(tid).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, tid);
  await page.mouse.click(tc[0], tc[1]);
  const diag = () => page.evaluate(({ tid, tc }) => {
    const t = document.getElementById(tid), host = t.closest('.frame-block[data-text-frame="true"], .row') || t, hr = host.getBoundingClientRect(), e = document.elementFromPoint(tc[0], tc[1]);
    const R = (r) => [r.left, r.top, r.right, r.bottom].map((v) => Math.round(v));
    return {
      tSel: t.classList.contains('selected') || !!t.closest('.selected:not(.sld-cell):not(.slide-block):not(.section-block)'),
      sel: [...document.querySelectorAll('#canvas .selected')].map((x) => `${x.className.split(' ')[0]}#${x.id}`),
      host: `${host.className.split(' ')[0]}#${host.id}`, hostBox: R(hr),
      paths: [...document.querySelectorAll('.ss-sel-layer path')].map((x) => ({ cls: x.getAttribute('class'), box: R(x.getBoundingClientRect()), stroke: getComputedStyle(x).stroke, vis: getComputedStyle(x).visibility })),
      who: e ? `${e.tagName}.${[...e.classList].join('.')}#${e.id}` : null, selOv: document.body.classList.contains('sel-ov'),
    };
  }, { tid, tc });
  /* 받은 값 = 진단 통째(실패하면 그대로 찍힌다 · 지디 요청) */
  await expect.poll(diag, '★글자 골라짐(펼친 칸 = 진입 · 덮개 0) · 받은 값 = 진단').toMatchObject({ tSel: true });
  await expect.poll(async () => { const d = await diag(); return { wrapped: d.paths.some((x) => x.box.every((v, k) => Math.abs(v - d.hostBox[k]) <= 2)), d }; },
    '★선택 층 길 하나가 글자 상자를 감쌈 · 받은 값 = 진단').toMatchObject({ wrapped: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ── 슬라이드 피드백 4 ──
 * G1 SLIDE-CELL-FRAME-BG-01: 칸 2 고름 → 패널 «배경» 켬(기본 흰색 · 배경색 칸 있음) → 끔(진짜 클릭) = 칸 투명(computed rgba 0 · data-bg transparent · 배경색 칸 없음)
 *    · Figma 칸 bg 'transparent' · ⌘Z = 흰색 · ⌘⇧Z = 투명 · 저장→다시 열기 = 투명 · 다시 켬 + hex FF0000 = 칸 빨강 · GIF 칸 그림 가운데 빨강 · 섹션 PNG 칸 가운데 빨강
 * W1 SLIDE-CELL-DEFAULT-SHADOW-01: 추가 메뉴 새 블럭 = 칸 셋 모두 data-shadow soft · computed box-shadow = 컴패리전 값(0 18px 50px · 0.22) · 패널 그림자 «옅게» 골라짐
 *    · «+ 프레임 추가» 새 칸도 soft(마지막 칸 따라감) · [음성] 옛 저장본(그림자 키 없는 칸) 저장→다시 열기 = 키 없음 · 그림자 none(옛 저장본 무변)
 * 양성대조: slide-frame-CTL35-cell-bg-noop.patch(배경 끔 쓰기 삭제) → G1 빨강 · slide-frame-CTL36-soft-shadow-drift.patch(단위 S15) · slide-frame-CTL37-no-default-shadow.patch(새 블럭 기본 soft 삭제) → W1 빨강 — 예측 */
const cellBg = (page, id, i) => page.evaluate(({ id, i }) => { const c = document.getElementById(id).querySelectorAll('.sld-cell')[i]; return { bg: c.dataset.bg ?? null, cs: getComputedStyle(c).backgroundColor }; }, { id, i });
test('G1 칸 배경 끄기·켜기·색 — 캔버스·Figma·⌘Z·저장·GIF·PNG', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  await wireCdp(page);
  await pickCell(page, id, 1);
  await expect(page.locator('#sld-cell-bg-on'), '[전제] 배경 켬(기본)').toBeChecked();
  await expect(page.locator('#ss-bg-hex'), '[전제] 배경색 칸(142 — 칸 배경색 = 프레임 패널 Fill)').toHaveCount(1);
  /* 지혜맥 ae8952f79 G1 2/2 — 숨은 진짜 체크박스는 uncheck({force}) 로도 «viewport 밖» ⇒ 사람이 누르는 겉모양(.prop-toggle-track)을 누른다(Playwright 가 패널 스크롤로 넣고 누름) */
  const bgToggle = page.locator('label.ui-check:has(#sld-cell-bg-on)');
  await bgToggle.click();
  await expect.poll(() => cellBg(page, id, 1), '★끔 = 칸 투명').toEqual({ bg: 'transparent', cs: 'rgba(0, 0, 0, 0)' });
  await expect(page.locator('#sld-cell-bg-on'), '끈 동안 켜기 꺼짐(142 — 배경색 칸은 프레임 Fill 에 늘 있다)').not.toBeChecked();
  const fig = await page.evaluate((id) => { let node = null; const walk = (o) => { if (node || !o || typeof o !== 'object') return; if (o.id === id) { node = o; return; } Object.values(o).forEach(walk); }; walk(window.buildFigmaExportJSON?.(null)); return node?.children?.map((m) => m.block?.bg) ?? null; }, id);
  expect(fig?.[1], '★Figma 칸 2 bg = transparent(렌더러 = 칠 없음)').toBe('transparent');
  await key(page, 'Meta+z');
  await expect.poll(() => cellBg(page, id, 1).then((v) => v.cs), '⌘Z = 흰색').toBe('rgb(255, 255, 255)');
  await key(page, 'Meta+Shift+z');
  await expect.poll(() => cellBg(page, id, 1).then((v) => v.cs), '⌘⇧Z = 투명').toBe('rgba(0, 0, 0, 0)');
  await page.evaluate(() => { window.flushCurrentPage?.(); const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); });
  await expect.poll(() => cellBg(page, id, 1), '★저장→다시 열기 = 투명').toEqual({ bg: 'transparent', cs: 'rgba(0, 0, 0, 0)' });
  /* 다시 켜고 색 */
  await page.evaluate((id) => window.unfoldSlide(document.getElementById(id), true), id);
  await pickCell(page, id, 1);
  await expect(page.locator('#sld-cell-bg-on'), '[전제] 다시 연 패널 = 끔').not.toBeChecked();
  await bgToggle.click();
  await expect(page.locator('#ss-bg-hex'), '켬 = 배경색 칸').toHaveCount(1);
  await page.evaluate(() => { const inp = document.getElementById('ss-bg-hex'); inp.value = '#FF0000'; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect.poll(() => cellBg(page, id, 1).then((v) => v.cs), '★색 = 칸 빨강').toBe('rgb(255, 0, 0)');
  const gifMid = await page.evaluate(async (id) => { const imgs = await window.slidePrepare(document.getElementById(id)), cv = imgs[1]; return cv ? Array.from(cv.getContext('2d').getImageData(Math.floor(cv.width / 2), Math.floor(cv.height / 2), 1, 1).data).slice(0, 3) : null; }, id);
  expect(gifMid, '★GIF 칸 2 그림 가운데 = 빨강').toEqual([255, 0, 0]);
  const pngMid = await page.evaluate(async (id) => {
    const b = document.getElementById(id), sec = b.closest('.section-block'), url = await window.exportSection(sec, 'png', 860, { returnDataUrl: true });
    const img = new Image(); img.src = url; await img.decode();
    const sr = sec.getBoundingClientRect(), cr = b.querySelectorAll('.sld-cell')[1].getBoundingClientRect(), k = img.naturalWidth / sr.width;
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight; const x = cv.getContext('2d'); x.drawImage(img, 0, 0);
    return Array.from(x.getImageData(Math.round((cr.left + cr.width / 2 - sr.left) * k), Math.round((cr.top + cr.height / 2 - sr.top) * k), 1, 1).data).slice(0, 3);
  }, id);
  expect(pngMid, '★섹션 PNG 칸 2 가운데 = 빨강').toEqual([255, 0, 0]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('W1 새 슬라이드 = 칸마다 옅은 그림자(컴패리전 값) · 옛 저장본 무변', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  const sh = (id) => page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.sld-cell')].map((c) => [c.dataset.shadow ?? null, getComputedStyle(c).boxShadow]), id);
  const s0 = await sh(id);
  expect(s0.map((v) => v[0]), '★새 블럭 칸 셋 = soft').toEqual(['soft', 'soft', 'soft']);
  expect(s0.every((v) => /0\.22\) 0px 18px 50px/.test(v[1])), `★computed = 컴패리전 값 0 18px 50px rgba(0,0,0,0.22) · 받음 ${s0[0][1]}`).toBe(true);
  await pickCell(page, id, 1);
  await expect(page.locator('#sld-cell-shadow'), '패널 = 옅게').toHaveValue('soft');
  await page.click('#sld-add-cell');
  await expect.poll(() => sh(id).then((a) => a.map((v) => v[0])), '«+ 프레임 추가» 새 칸도 soft').toEqual(['soft', 'soft', 'soft', 'soft']);
  /* [음성] 옛 저장본(그림자 키 없는 칸) — 저장→다시 열기 해도 그림자 없음 */
  const oldId = await page.evaluate(() => {
    const { row, block } = window.makeSlideBlock({ cellMode: 'frame' });
    block.querySelectorAll('.sld-cell').forEach((c) => delete c.dataset.shadow); window.renderSlideBlock(block);   // 옛 판 저장본 꼴(키 없음)
    document.querySelector('#canvas .section-block .section-inner').appendChild(row); window.bindBlock?.(block); window.pushHistory?.();
    window.flushCurrentPage?.(); const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d);
    return block.id;
  });
  expect((await sh(oldId)).map((v) => v[0]), '★옛 저장본 칸 = 그림자 키 없음(열 때 안 붙음)').toEqual([null, null, null]);
  expect((await sh(oldId)).every((v) => v[1] === 'none'), '옛 저장본 = 그림자 없음').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ── 슬라이드 피드백 5 (b) SLIDE-CELL-PANEL-PARITY-01(135) — 고른 칸 패널 = 일반 프레임 패널과 같은 부품(대조표 handoff/TABLE-slide-cell-vs-frame-panel-261119.md)
 * P1 칸 2 고름 → 코너·폭%·높이% 슬라이더 있음 · 그림자 select 는 Effects 절 · 코너 슬라이더 24 = dataset.radius·computed 24px·숫자칸 동기 ·
 *    폭 60·높이 80 = data-w·data-h · 배경 알파 50 = computed rgba(…, 0.5) · 배경 투명도 50 = dataset.bgOpacity 0.5 + .has-bg-opacity(프레임과 같은 몸통) ·
 *    저장→다시 열기 = 넷 그대로 · ⌘Z 한 번 = 투명도 전(키 없음)
 * 양성대조: slide-frame-CTL38-cell-corner-number.patch(코너를 옛 숫자칸만으로) → P1 빨강 — 예측 */
test('P2 칸 패널 = 프레임 패널 부품(코너·폭·높이 슬라이더 · 배경 알파·투명도 · 그림자 = Effects)', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  await pickCell(page, id, 1);
  /* 독립 리뷰 261120 ⓑ1: 옛 줄은 주석이 for 머리 뒤에 붙어 아래 존재 단언 넷이 주석이 됐고 다음 줄(Effects)이 4번 도는 몸통이었다 → 몸통·주석 바로잡음 · 이름 P1 → P2(같은 파일 P1 둘) */
  for (const sel of ['#ss-radius-num', '#sld-cell-w-number', '#sld-cell-h-number']) await expect(page.locator(sel), `★${sel}`).toHaveCount(1);   // 142 — 코너 = 프레임 패널 코너   // ★기대 바뀜(표준 Appearance/Layout · 현빈 261124 L-4/7 슬라이더 걷음 · C3): 슬라이더 → 같은 줄기 숫자 칸(범위·키 무변)
  expect(await page.evaluate(() => document.getElementById('sld-cell-shadow')?.closest('[data-sec]')?.dataset.sec), '★그림자 = Effects 절').toBe('effects');
  const slide = (sid, v) => page.evaluate(([sid, v]) => { const e = document.getElementById(sid); e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sid, v]);
  const cell = () => page.evaluate((id) => { const c = document.getElementById(id).querySelectorAll('.sld-cell')[1]; const cs = getComputedStyle(c);
    return { r: c.dataset.radius ?? null, rCs: cs.borderTopLeftRadius, w: c.dataset.w ?? null, h: c.dataset.h ?? null, opa: c.dataset.bgOpacity ?? null, opaCls: c.classList.contains('has-bg-opacity'), bg: cs.backgroundColor, rNum: document.getElementById('ss-radius-num')?.value ?? null }; }, id);
  await slide('ss-radius-num', 24);   /* ★기대 바뀜(표준 Appearance A1 · 현빈 261124 L-4/7 슬라이더 걷음) — 코너 = 숫자 칸 ss-radius-num 하나(같은 dataset.radius) */
  await expect.poll(cell).toMatchObject({ r: '24', rCs: '24px', rNum: '24' });
  await slide('sld-cell-w-number', 60);   // ★기대 바뀜(표준 Appearance/Layout · 현빈 261124 L-4/7 슬라이더 걷음 · C3): 슬라이더 → 같은 줄기 숫자 칸(범위·키 무변)
  await slide('sld-cell-h-number', 80);
  await expect.poll(cell).toMatchObject({ w: '60', h: '80' });
  await page.evaluate(() => { const a = document.getElementById('ss-bg-alpha'); /* 142 — 프레임 Fill 알파 */ a.value = '50'; a.dispatchEvent(new Event('input', { bubbles: true })); a.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect.poll(() => cell().then((c) => c.bg), '★배경 알파 50').toBe('rgba(255, 255, 255, 0.5)');
  await page.locator('#ss-bgopa-num').fill('50'); await page.locator('#ss-bgopa-num').dispatchEvent('change');   // 142 — 프레임 «배경 투명도»
  await expect.poll(cell, '★배경 투명도 = 프레임과 같은 키·층').toMatchObject({ opa: '0.5', opaCls: true });
  await key(page, 'Meta+z');
  await expect.poll(() => cell().then((c) => c.opa === null || c.opa === '1'), '★⌘Z 한 번 = 투명도 전').toBe(true);
  await key(page, 'Meta+Shift+z');
  await expect.poll(cell).toMatchObject({ opa: '0.5' });
  await page.evaluate(() => { window.flushCurrentPage?.(); const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); });
  await expect.poll(cell, '★저장→다시 열기 = 그대로').toMatchObject({ r: '24', rCs: '24px', w: '60', h: '80', opa: '0.5', opaCls: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ── 슬라이드 피드백 5 (c) SLIDE-CELL-RADIUS-HANDLE-01(136) — 고른 칸에 일반 프레임의 코너 반경 손잡이(overlay-handles showFrameHandles · cellOnly)
 * H1 칸 2 고름 → .ss-radius-handle 넷 · 크기·회전 손잡이 0 · se 손잡이를 안쪽(좌상)으로 30px 끌기 = dataset.radius 늘고 칸 computed 같은 값 · 패널 코너 슬라이더·숫자칸 같은 값 ·
 *    80 넘게 끌면 80(칸 범위) · ⌘Z 한 번 = 끌기 전
 * 양성대조: slide-frame-CTL39-cell-no-radius-handle.patch(_pickSlideCell 의 showFrameHandles 줄 삭제) → H1·F2 빨강 — 예측 */
test('H1 칸 코너 반경 손잡이 = 프레임 것 · 끌면 반경·패널 같이 · 80 상한 · ⌘Z', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  await pickCell(page, id, 1);
  expect(await page.evaluate(() => [document.querySelectorAll('.ss-radius-handle').length, document.querySelectorAll('.ss-resize-handle, .ss-rotate-handle').length]), '★반경 손잡이 넷 · px 손잡이 0').toEqual([4, 0]);
  const r0 = await page.evaluate((id) => document.getElementById(id).querySelectorAll('.sld-cell')[1].dataset.radius ?? null, id);
  let prev = '', p = null;
  await expect.poll(async () => { p = await page.evaluate(() => { const h = document.querySelector('.ss-radius-handle.se'); const r = h.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; return { x, y, own: document.elementFromPoint(x, y) === h }; }); const k = `${p.x},${p.y}`, same = k === prev; prev = k; return p.own && same; },
    { message: '[전제] se 반경 손잡이가 그 점의 임자이고 멎었다', intervals: [50] }).toBe(true);
  const z = await page.evaluate(() => (window.currentZoom || 40) / 100);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(p.x - 6 * i * z, p.y - 6 * i * z);   // 로컬 30px 안쪽
  await page.mouse.up();
  const read = () => page.evaluate((id) => { const c = document.getElementById(id).querySelectorAll('.sld-cell')[1]; return { r: c.dataset.radius ?? null, cs: getComputedStyle(c).borderTopLeftRadius, nu: document.getElementById('ss-radius-num')?.value ?? null }; }, id);
  const a = await read();
  expect(+a.r, '★반경이 늘었다(로컬 30px 안쪽 ≈ +30)').toBeGreaterThanOrEqual(25);
  expect(a, '★칸·패널 같은 값').toEqual({ r: a.r, cs: `${a.r}px`, nu: a.r });   /* ★기대 바뀜(표준 Appearance A1) — 패널 코너 = 숫자 칸 하나(슬라이더 걷음) */
  await page.mouse.move(p.x, p.y); await page.mouse.down();   // 손잡이 자리는 반경과 무관(모서리 안쪽 10px 고정)
  for (let i = 1; i <= 5; i++) await page.mouse.move(p.x - 40 * i * z, p.y - 40 * i * z);
  await page.mouse.up();
  expect((await read()).r, '★칸 상한 80').toBe('80');
  await key(page, 'Meta+z');
  await expect.poll(() => read().then((v) => v.r), '★⌘Z 한 번 = 둘째 끌기 전').toBe(a.r);
  expect(r0, '[전제] 처음 반경 키 없음(새 블럭)').toBeNull();
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ── 슬라이드 피드백 5 (d) SLIDE-DOTS-GAP-SLIDER-01(137) — «칸↔점 갭»은 갭만 움직이고 블럭이 커진다
 * D1 점 아래 켬 → 갭 0 → 40: 칸 높이 그대로 · 블럭 높이 +40 · 점 바깥 여백(블럭 아래끝↔점) 8 그대로 · 칸 아래끝↔점 = 갭 · ⌘Z 한 번 = 갭 0 판
 * 양성대조: slide-frame-CTL40-dots-band-symmetric.patch(띠를 옛 «갭×2+점»으로) → D1 빨강 — 예측 */
test('D1 칸↔점 갭 — 칸 높이 그대로 · 블럭이 커짐 · 바깥 여백 고정 · ⌘Z', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  await waitZoomSettled(page, await page.evaluate(() => window.currentZoom));   // 261120 지혜맥 DIAG: 배율이 멎기 전(실제 0.4566 · 이름 0.4)에 재서 9.1~9.5 — 멎은 뒤 잰다
  await page.evaluate((id) => window.showSlideProperties(document.getElementById(id)), id);
  await page.locator('#sld-dots-kind').selectOption('dots'); // ★기대 바뀜(현빈 261123 D «표시 모양» 확정 · 0.9.13 195): 옛 «점 표시» select(없음/위/아래) → [표시 모양 ▾(없음·점·진행바) | 엔드슬롯 위↔아래] — «아래» = 점 고르기(처음 켜면 아래)
  await expect(page.locator('#sld-dotgap-slider'), '[전제] 갭 슬라이더').toHaveCount(1);
  const gapTo = (v) => page.evaluate((v) => { const e = document.getElementById('sld-dotgap-slider'); e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, v);
  const geo = () => page.evaluate((id) => {
    const b = document.getElementById(id), c = b.querySelector('.sld-cell'), d = b.querySelector(':scope > .sld-dots > span'), z = b.getBoundingClientRect().height / b.offsetHeight;   // 실제 배율(블럭 화면 높이 ÷ 높이) — 이름 배율(currentZoom)이 아니라(D8 과 같은 자)
    const br = b.getBoundingClientRect(), cr = c.getBoundingClientRect(), dr = d.getBoundingClientRect(), r = (v) => Math.round(v / z);
    return { cellH: c.offsetHeight, blockH: b.offsetHeight, outer: r(br.bottom - dr.bottom), gap: r(dr.top - cr.bottom) };
  }, id);
  await gapTo(0);
  await expect.poll(() => geo().then((g) => g.gap), '[전제] 갭 0').toBe(0);
  const g0 = await geo();
  /* DIAG(지혜맥 261120 CTL43 판 10 ≠ 8 · 판정 보류) — 바깥 여백을 이루는 값들(판정 아님 · 로그로만) */
  console.log('[D1 DIAG]', JSON.stringify(await page.evaluate((id) => { const b = document.getElementById(id), d = b.querySelector(':scope > .sld-dots'), s = d.firstElementChild, cs = getComputedStyle(b), ds = getComputedStyle(d);
    const br = b.getBoundingClientRect(), dr = d.getBoundingClientRect(), sr = s.getBoundingClientRect(), z = (window.currentZoom || 40) / 100;
    return { z, blockH: b.offsetHeight, clientH: b.clientHeight, bb: [cs.borderTopWidth, cs.borderBottomWidth, cs.paddingBottom, cs.overflow, cs.clipPath.slice(0, 40), cs.transform], dotsH: d.offsetHeight, dotsPad: ds.paddingBottom, dotsBottom: ds.bottom,
      scr: { b: [br.top, br.bottom], d: [dr.top, dr.bottom], s: [sr.top, sr.bottom] }, outerRaw: (br.bottom - sr.bottom) / z, dotsGapRaw: (br.bottom - dr.bottom) / z }; }, id)));
  expect(g0.outer, '[전제] 바깥 여백 8').toBe(8);
  await gapTo(40);
  await expect.poll(geo, '★칸 그대로 · 블럭 +40 · 바깥 8 그대로 · 갭 40').toEqual({ cellH: g0.cellH, blockH: g0.blockH + 40, outer: 8, gap: 40 });
  await key(page, 'Meta+z');
  await expect.poll(geo, '★⌘Z 한 번 = 갭 0 판').toEqual(g0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ── 슬라이드 피드백 5 (e) SLIDE-DOTS-FIXED-ON-SCROLL-01(138) — 임시 가로 밀기 때 점 띠 고정 · 보이는 칸 점만 진하게 · 산출물 무변
 * E1 점 아래 켬 → 블럭 scrollLeft = 칸 2 왼끝(막대와 같은 길) → 점 셋 화면 자리 그대로(±1) · 진한 점 = 둘째 · 저장 글자에 표식(sld-hs·sld-dot-hs-on) 0 · 0 으로 = 첫째 진함 · 표식 걷힘
 * 양성대조: slide-frame-CTL41-dots-scroll-unbound.patch(scroll 리스너 줄 삭제) → E1 빨강 — 예측 */
test('E1 임시 가로 밀기 — 점 띠 고정 · 활성 점 = 보이는 칸 · 저장 표식 0', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  await waitZoomSettled(page, await page.evaluate(() => window.currentZoom));   // 지혜맥 261120 2/3: 색은 맞고 점 x 가 740/748/756 → 742/748/755(가운데 기준 좁아짐) = 배율이 멎기 전 d0 를 잼
  await page.evaluate((id) => window.showSlideProperties(document.getElementById(id)), id);
  await page.locator('#sld-dots-kind').selectOption('dots'); // ★기대 바뀜(현빈 261123 D «표시 모양» 확정 · 0.9.13 195): 옛 «점 표시» select(없음/위/아래) → [표시 모양 ▾(없음·점·진행바) | 엔드슬롯 위↔아래] — «아래» = 점 고르기(처음 켜면 아래)
  const dots = () => page.evaluate((id) => { const b = document.getElementById(id); return [...b.querySelectorAll(':scope > .sld-dots > span')].map((d) => ({ x: Math.round(d.getBoundingClientRect().left), c: getComputedStyle(d).backgroundColor })); }, id);
  await expect.poll(() => dots().then((d) => d.length), '[전제] 점 셋').toBe(3);
  const d0 = await dots();
  const on = d0[0].c, off = d0[1].c;
  expect(on, '[전제] 첫째 진함·둘째 옅음').not.toBe(off);
  const x2 = await page.evaluate((id) => { const b = document.getElementById(id); const c = b.querySelector(':scope > .sld-track').children[1]; window.slideHScroll(b, c.offsetLeft); return window.slideHScroll(b);   /* 134 — scrollLeft 대신 밀기 값(막대와 같은 문) */ }, id);
  expect(x2, '[전제] 밀렸다').toBeGreaterThan(0);
  await expect.poll(dots, '★점 자리 그대로 · 진한 점 = 둘째').toEqual(d0.map((d, i) => ({ x: d.x, c: i === 1 ? on : off })));
  const saved = await page.evaluate(() => window.getSerializedCanvas());
  expect(/sld-hs|sld-dot-hs-on|--sld-hs-x/.test(saved), '★저장 글자에 임시 표식·밀린 거리 변수 0').toBe(false);
  await page.evaluate((id) => { window.slideHScroll(document.getElementById(id), 0); }, id);
  await expect.poll(dots, '★0 = 첫째 진함 · 자리 그대로').toEqual(d0);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('sld-hs'), id), '★표식 걷힘').toBe(false);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* E2 SLIDE-DOTS-FIXED-ON-SCROLL-01 덧(dev 9a724fb78 실앱 채점 261120) — 끝까지 밀면(막대 max · 셋째 칸 다 보임) 활성 점 = 셋째(옛 = 둘째 · 왼끝 규칙이 끝 칸을 못 고름)
 *   ★중간(둘째 칸 왼끝) = 둘째 그대로 · 끝 = 셋째 · 끝 바로 앞(max-20) = 둘째(끝 규칙이 앞쪽까지 번지지 않음).
 *   양성대조: _patches/slide-CTL52-dots-end-last.patch(끝 = 마지막 칸 줄 뺌) → «끝 = 셋째» 빨강 — 예측 */
test('E2 끝까지 밀기 — 활성 점 = 마지막 칸', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  await waitZoomSettled(page, await page.evaluate(() => window.currentZoom));
  await page.evaluate((id) => window.showSlideProperties(document.getElementById(id)), id);
  await page.locator('#sld-dots-kind').selectOption('dots'); // ★기대 바뀜(현빈 261123 D «표시 모양» 확정 · 0.9.13 195): 옛 «점 표시» select(없음/위/아래) → [표시 모양 ▾(없음·점·진행바) | 엔드슬롯 위↔아래] — «아래» = 점 고르기(처음 켜면 아래)
  const onIdx = () => page.evaluate((id) => [...document.getElementById(id).querySelectorAll(':scope > .sld-dots > span')].findIndex((d) => d.classList.contains('sld-dot-hs-on')), id);
  const max = await page.evaluate((id) => { const b = document.getElementById(id), t = b.querySelector(':scope > .sld-track'), l = t.lastElementChild; return Math.max(0, Math.round(l.offsetLeft + l.offsetWidth - b.clientWidth)); }, id);
  const c2 = await page.evaluate((id) => document.getElementById(id).querySelector(':scope > .sld-track').children[1].offsetLeft, id);
  expect(await page.evaluate((id) => document.getElementById(id).querySelectorAll(':scope > .sld-track > *').length, id), '[전제] 칸 셋').toBe(3);
  expect(max > c2 + 20, `[전제] 끝(max ${max})이 둘째 칸 왼끝(${c2})보다 20 넘게 오른쪽 — 셋째 칸 왼끝이 창 왼끝에 안 닿는 장면`).toBe(true);
  await page.evaluate(([id, x]) => window.slideHScroll(document.getElementById(id), x), [id, c2]);
  await expect.poll(onIdx, '중간(둘째 칸 왼끝) = 둘째').toBe(1);
  await page.evaluate(([id, x]) => window.slideHScroll(document.getElementById(id), x), [id, max - 20]);
  await expect.poll(onIdx, '끝 바로 앞 = 둘째(끝 규칙이 안 번짐)').toBe(1);
  await page.evaluate(([id, x]) => window.slideHScroll(document.getElementById(id), x), [id, max]);
  await expect.poll(onIdx, '★끝까지 밀면 = 셋째(마지막 칸)').toBe(2);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ── 슬라이드 피드백 5 (f) SLIDE-ENTER-KEEP-HSCROLL-01(139) — 가로로 밀어 둔 채 두 번 눌러 들어가도·나와도 그 자리
 * K2 칸 2 왼끝까지 밀기 → 칸 2 화면 왼끝 기록 → 두 번 누름(펼침) = 칸 2 같은 자리(±1) · Esc(나옴) = 같은 자리 · 블럭 scrollLeft 되돌아옴
 * 양성대조: slide-frame-CTL42-unfold-drops-hscroll.patch(펼침이 밀린 거리 안 쥠) → K2 빨강 — 예측 */
test('K2 밀어 둔 채 진입·나옴 — 보던 칸 자리 그대로', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  await waitZoomSettled(page, await page.evaluate(() => window.currentZoom));   // 261120 지혜맥 DIAG: 블럭 자체가 538→578 로 움직임(칸 2 = 블럭 왼끝 그대로 · 밀기 494 유지 = 139 뜻대로) = 배율이 멎기 전에 «before» 를 잼
  const c2x = () => page.evaluate((id) => Math.round(document.getElementById(id).querySelectorAll('.sld-cell')[1].getBoundingClientRect().left), id);
  const x = await page.evaluate((id) => { const b = document.getElementById(id); window.slideHScroll(b, b.querySelectorAll('.sld-cell')[1].offsetLeft); return window.slideHScroll(b);   /* 134 */ }, id);
  expect(x, '[전제] 밀렸다').toBeGreaterThan(0);
  const before = await c2x();
  console.log('[K2 DIAG before]', JSON.stringify(await page.evaluate((id) => { const b = document.getElementById(id), t = b.querySelector(':scope > .sld-track'), si = b.closest('.section-inner'), cw = document.getElementById('canvas-wrap');
    return { blockL: Math.round(b.getBoundingClientRect().left), trackL: Math.round(t.getBoundingClientRect().left), translate: getComputedStyle(t).translate, siScroll: si && si.scrollLeft, wrapScroll: cw && [cw.scrollLeft, cw.scrollTop] }; }, id)));
  /* 두 번 누름 = 펼침(문서 capture dblclick 길) — 블럭 안 보이는 칸 2 위 */
  const p = await page.evaluate((id) => { const r = document.getElementById(id).querySelectorAll('.sld-cell')[1].getBoundingClientRect(); return [r.left + 12, r.top + 12]; }, id);
  await page.mouse.dblclick(p[0], p[1]);
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('sld-unfold'), id), '[전제] 펼침').toBe(true);
  /* DIAG(지혜맥 261120 CTL43 판 31 어긋남 · 판정 보류) — 펼친 뒤 무엇이 움직였나(판정 아님 · 로그로만) */
  console.log('[K2 DIAG]', before, JSON.stringify(await page.evaluate((id) => { const b = document.getElementById(id), t = b.querySelector(':scope > .sld-track'), c = b.querySelectorAll('.sld-cell')[1], si = b.closest('.section-inner'), cw = document.getElementById('canvas-wrap');
    const ts = getComputedStyle(t); return { c2x: Math.round(c.getBoundingClientRect().left), blockL: Math.round(b.getBoundingClientRect().left), trackL: Math.round(t.getBoundingClientRect().left), hs: window.slideHScroll(b), hsVar: b.style.getPropertyValue('--sld-hs-x'), cls: b.className,
      translate: ts.translate, transform: ts.transform, siScroll: si && si.scrollLeft, siOverflowX: si && getComputedStyle(si).overflowX, wrapScroll: cw && [cw.scrollLeft, cw.scrollTop], picked: !!b.querySelector('.sld-cell.selected, .sld-cell .selected') }; }, id)));
  await expect.poll(c2x, '★펼친 뒤 칸 2 같은 자리').toBeGreaterThanOrEqual(before - 1);
  expect(Math.abs((await c2x()) - before), '★펼친 뒤 칸 2 같은 자리(±1)').toBeLessThanOrEqual(1);
  await key(page, 'Escape');
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('sld-unfold'), id), '[전제] 나옴').toBe(false);
  expect(await page.evaluate((id) => window.slideHScroll(document.getElementById(id)), id), '★나온 뒤 밀기 값 그대로(134 — translate 라 펼침이 안 되돌림)').toBe(x);
  expect(Math.abs((await c2x()) - before), '★나온 뒤 칸 2 같은 자리(±1)').toBeLessThanOrEqual(1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ── 슬라이드 피드백 5 (g) SLIDE-ENTER-EXIT-DIM-01(140) 앞부분 — 빈 영역 두 번 누름 = 나옴 · 펼친 동안 그 섹션이 아래 섹션 위(덮개 고르게)
 *   (어둡기 세기는 현빈 답 뒤 — 이 칸은 안 잰다)
 * X1 아래 섹션 하나 더 → 펼침 = 슬라이드 섹션 z 3 · 아래 섹션 z 2 · 칸 틈 두 번 = 나옴 · 다시 펼침 → 칸 안 두 번 = 그대로 펼침 · 캔버스 밖 회색 두 번 = 나옴 · 나온 뒤 z 2
 * 양성대조: slide-frame-CTL43-no-empty-dbl-exit.patch(빈 영역 두 번 누름 리스너 삭제) → X1 빨강 — 예측 */
test('X1 빈 영역 두 번 누름 = 나옴 · 칸 안은 그대로 · 펼친 섹션이 아래 섹션 위', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  await page.evaluate(async () => { await window.addSection(); });
  const open = () => page.evaluate((id) => document.getElementById(id).classList.contains('sld-unfold'), id);
  const zs = () => page.evaluate((id) => { const s = document.getElementById(id).closest('.section-block'), n = s.nextElementSibling?.closest?.('.section-block') || [...document.querySelectorAll('#canvas .section-block')].find((x) => x !== s); return [getComputedStyle(s).zIndex, getComputedStyle(n).zIndex]; }, id);
  const unfold = () => page.evaluate((id) => window.unfoldSlide(document.getElementById(id), true), id);
  const stable = async (fn, msg) => { let prev = '', p = null; await expect.poll(async () => { p = await fn(); const k = JSON.stringify(p && [p.x, p.y]); const same = k === prev; prev = k; return !!p && p.ok && same; }, { message: msg, intervals: [50] }).toBe(true); return p; };
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), id);
  await unfold();
  await expect.poll(open, '[전제] 펼침').toBe(true);
  expect(await zs(), '★펼친 섹션 z 3 · 아래 섹션 z 2').toEqual(['3', '2']);
  /* (g) 어둡기 «살짝» = 덮개 색 알파 = --ui-disabled-opacity(0.5) — 옛 0.78 */
  const dim = await page.evaluate((id) => ({ a: getComputedStyle(document.getElementById(id), '::after').outlineColor, tok: getComputedStyle(document.documentElement).getPropertyValue('--ui-disabled-opacity').trim() }), id);
  expect(dim.tok, '[전제] 토큰 0.5').toBe('0.5');
  expect(/[,/]\s*0\.5\)$/.test(dim.a), `★덮개 알파 0.5(받은 값 ${dim.a})`).toBe(true);
  const gap = await stable(() => page.evaluate((id) => { const cs = document.getElementById(id).querySelectorAll('.sld-cell'); const a = cs[0].getBoundingClientRect(), b = cs[1].getBoundingClientRect(); const x = (a.right + b.left) / 2, y = (a.top + a.bottom) / 2, e = document.elementFromPoint(x, y);
    return { x, y, ok: b.left - a.right >= 2 && !!e && document.getElementById(id).contains(e) && !e.closest('.sld-cell') }; }, id), '[전제] 칸 틈 = 슬라이드 안 · 칸 밖');
  await page.mouse.dblclick(gap.x, gap.y);
  await expect.poll(open, '★칸 틈 두 번 = 나옴').toBe(false);
  await unfold();
  await expect.poll(open).toBe(true);
  const inCell = await stable(() => page.evaluate((id) => { const r = document.getElementById(id).querySelectorAll('.sld-cell')[0].getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2, e = document.elementFromPoint(x, y); return { x, y, ok: !!e?.closest('.sld-cell') }; }, id), '[전제] 칸 1 가운데 = 칸 안');
  await page.mouse.dblclick(inCell.x, inCell.y);
  expect(await open(), '★칸 안 두 번 = 그대로 펼침').toBe(true);
  const gray = await stable(() => page.evaluate(() => { const w = document.getElementById('canvas-wrap').getBoundingClientRect(), c = document.getElementById('canvas').getBoundingClientRect(); const x = (w.left + c.left) / 2, y = (c.top + Math.min(c.bottom, w.bottom)) / 2, e = document.elementFromPoint(x, y);
    /* 화면 px 를 숫자(옛 «≥ 20»)와 견주지 않는다(dom-screen-px-census Z3 · 배율 따라 뜻이 바뀜 · cand16 단위 전수 261120) —
       «회색 여백이 있다» = 두 상자 비교 · «누를 점이 회색» = 그 점의 임자(elementFromPoint)로 잰다(stable = 두 번 같은 자리). */
    return { x, y, ok: c.left > w.left && !!e?.closest('#canvas-wrap') && !e.closest('#canvas') }; }), '[전제] 캔버스 밖 회색 점');
  await page.mouse.dblclick(gray.x, gray.y);
  await expect.poll(open, '★캔버스 밖 회색 두 번 = 나옴').toBe(false);
  expect(await zs(), '★나온 뒤 z 2 · 2').toEqual(['2', '2']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ── 슬라이드 피드백 5 (h) SLIDE-CELL-REORDER-01(141) — 칸 고르고 ⌘←/→ · 칸 위 띠 끌기(그리드 머리띠 한 벌)
 * O1 펼침·칸 2 고름 → 띠 셋(.grd-headband[data-sld]) · ⌘→ = [1,3,2] · 끝에서 ⌘→ 무변 · ⌘← 두 번 = [2,1,3] · ⌘Z 한 번 = 한 걸음 전([1,2,3]) · 띠 1 을 끝으로 끌기 = 첫 칸이 끝 · 저장→다시 열기 = 그 순서
 * 양성대조: slide-frame-CTL44-no-cell-reorder.patch(moveSlideCell 이 늘 false) → O1 빨강 — 예측 */
test('O1 칸 순서 — ⌘←/→ · 칸 띠 끌기 · ⌘Z · 저장', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  const c0 = await cellIds(page, id);
  expect(c0.length, '[전제] 칸 셋').toBe(3);
  await pickCell(page, id, 1);
  await expect.poll(() => page.locator('#ss-handles-overlay > .grd-headband[data-sld]').count(), '★칸 띠 셋').toBe(3);
  await key(page, 'Meta+ArrowRight');
  await expect.poll(() => cellIds(page, id), '★⌘→ = 칸 2 가 끝으로').toEqual([c0[0], c0[2], c0[1]]);
  await key(page, 'Meta+ArrowRight');
  expect(await cellIds(page, id), '★끝에서 ⌘→ 무변').toEqual([c0[0], c0[2], c0[1]]);
  await key(page, 'Meta+ArrowLeft'); await key(page, 'Meta+ArrowLeft');
  await expect.poll(() => cellIds(page, id), '★⌘← 두 번 = 맨 앞').toEqual([c0[1], c0[0], c0[2]]);
  await key(page, 'Meta+z');
  await expect.poll(() => cellIds(page, id), '★⌘Z 한 번 = 한 걸음 전').toEqual([c0[0], c0[1], c0[2]]);
  /* ⌘Z 는 DOM 표본으로 되돌린다(펼침·고름은 표본에 안 남음) ⇒ 다시 펼치고 칸을 고른다 */
  await pickCell(page, id, 0);
  await expect.poll(() => page.locator('#ss-handles-overlay > .grd-headband[data-sld]').count(), '[전제] 띠 셋 다시').toBe(3);
  /* 띠 1(첫 자리)을 끝 칸 가운데 너머로 끌기 */
  let prev = '', p = null;
  await expect.poll(async () => { p = await page.evaluate(() => { const b = document.querySelector('#ss-handles-overlay > .grd-headband[data-sld][data-i="0"]'); const r = b.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; return { x, y, own: document.elementFromPoint(x, y) === b }; }); const k = `${p.x},${p.y}`, s = k === prev; prev = k; return p.own && s; },
    { message: '[전제] 띠 1 이 그 점의 임자 · 멎음', intervals: [50] }).toBe(true);
  const endX = await page.evaluate((id) => { const cs = document.getElementById(id).querySelectorAll('.sld-cell'); const r = cs[cs.length - 1].getBoundingClientRect(); return r.right - 4; }, id);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(p.x + (endX - p.x) * i / 6, p.y);
  await page.mouse.up();
  await expect.poll(() => cellIds(page, id), '★띠 끌기 = 첫 칸이 끝으로').toEqual([c0[1], c0[2], c0[0]]);
  await page.evaluate(() => { window.flushCurrentPage?.(); const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); });
  await expect.poll(() => cellIds(page, id), '★저장→다시 열기 = 그 순서').toEqual([c0[1], c0[2], c0[0]]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ── 142 SLIDE-CELL-PANEL-PARITY-02(ⓐ · 현빈 Q1~Q3 예 · Q4 3단 유지) — 고른 칸 = «그 칸의 프레임 패널» + 맨 위 «슬라이드 칸» 절
 * Q1 칸 2 고름 → 프레임 부품(정렬 #ss-align-left · 간격 · 패딩 · 테두리 · 배경 이미지 단추) 있음 · 칸에 안 맞는 절(위치 · 크기 px · 템플릿 · 이펙트 목록) 없음 ·
 *    그림자 = 3단 select(Effects) · 칸 줄·폭%·높이%·배경 켜기 있음 · 상하 패딩 24 = 칸 padding-top 24px · 테두리 두께 3 = 칸 border 3px ·
 *    «슬라이드 전체 설정» = 슬라이드 패널(칸 줄 · 프레임 정렬 단추 없음)
 * Q2 [음성] 보통 프레임 패널 = 위치·크기·템플릿·이펙트 목록 그대로 · 슬라이드 칸 절 없음(일반 프레임 패널 무변)
 * 양성대조: slide-frame-CTL46-cell-no-slide-parts.patch(slideCellPanelParts 가 null) → Q1·F2 빨강 */
test('Q1 칸 패널 = 프레임 부품 + 슬라이드 칸 절', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  await pickCell(page, id, 1);
  const has = (ids) => page.evaluate((ids) => ids.map((x) => !!document.getElementById(x)), ids);
  /* ★기대 바뀜(현빈 261120 · 1120b P2): 프레임 간격 슬라이더(#ss-gap-slider/#ss-gap-num) 걷음(prop-frame.js:568) — 있어야 할 부품에서 빼고 «없음» 쪽으로 */
  expect(await has(['ss-align-left', 'ss-pady-num', 'ss-padx-num', 'ss-border-w-num', 'ss-bg-img-btn', 'ss-radius-num', 'ss-bg-hex']), '★프레임 부품').toEqual(Array(7).fill(true));   /* ★기대 바뀜(표준 Appearance A1 · 현빈 261124 L-4/7 슬라이더 걷음) — 코너 = 숫자 칸 ss-radius-num 하나(같은 dataset.radius) */
  /* ★기대 바뀜(표준 Appearance/Layout · 현빈 261124 L-4/7 슬라이더 걷음 · C4): 프레임 W/H = ss-width-num/ss-height-num(옛 -slider 는 늘 없음이라 눈멂) */
  expect(await has(['ss-pos-x', 'ss-width-num', 'ss-height-num', 'ss-tpl-save-btn', 'ss-fx-section', 'ss-fullbleed-toggle', 'ss-clip-toggle', 'ss-gap-num']), '★칸에 안 맞는 절 없음 · 걷은 간격 칸 없음').toEqual(Array(8).fill(false));
  expect(await has(['sld-cell-shadow', 'sld-cell-w-number', 'sld-cell-bg-on', 'sld-add-cell', 'sld-cell-back']), '★슬라이드 칸 절').toEqual(Array(5).fill(true));   // ★기대 바뀜(표준 Appearance/Layout · 현빈 261124 L-4/7 슬라이더 걷음 · C3): 슬라이더 → 같은 줄기 숫자 칸(범위·키 무변)
  expect(await page.evaluate(() => document.getElementById('sld-cell-shadow').closest('[data-sec]')?.dataset.sec), '★그림자 3단 = Effects').toBe('effects');
  await page.locator('#ss-pady-num').fill('24'); await page.locator('#ss-pady-num').dispatchEvent('change');
  if (!(await page.locator('#ss-stroke-on').isChecked())) await page.click('#panel-right label:has(#ss-stroke-on)'); await page.locator('#ss-border-w-num').fill('3'); await page.locator('#ss-border-w-num').dispatchEvent('change');   // ★전제 바뀜(표준 Stroke 2-1 ab6ccb79d · 현빈 261123): 테두리 0 = 몸 숨김 → 사람은 머리 ＋ 로 켠 뒤 굵기(기대 3px 무변)
  await expect.poll(() => page.evaluate((id) => { const c = document.getElementById(id).querySelectorAll('.sld-cell')[1], cs = getComputedStyle(c); return [cs.paddingTop, cs.borderTopWidth]; }, id), '★패딩·테두리가 그 칸에').toEqual(['24px', '3px']);
  await page.locator('#sld-cell-back').click();
  await expect.poll(() => page.evaluate(() => [!!document.getElementById('sld-add-cell'), !!document.getElementById('ss-align-left')]), '★슬라이드 전체 설정 = 슬라이드 패널').toEqual([true, false]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('Q2 [음성] 보통 프레임 패널 무변', async ({ page }) => {
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove());
    await window.addSection();
    window.selectSection(document.querySelector('#canvas .section-block'));
    window.addFrameBlock?.();
    const f = document.querySelector('#canvas .frame-block:not([data-sld-cell])');
    window.showFrameProperties(f);
  });
  const has = (ids) => page.evaluate((ids) => ids.map((x) => !!document.getElementById(x)), ids);
  expect(await has(['ss-pos-x', 'ss-width-num', 'ss-tpl-save-btn', 'ss-fx-section', 'ss-clip-toggle']), '★보통 프레임 = 절 그대로').toEqual(Array(5).fill(true));   // ★기대 바뀜(표준 Appearance/Layout · 현빈 261124 L-4/7 슬라이더 걷음 · C4): 슬라이더 → 같은 줄기 숫자 칸(범위·키 무변)
  expect(await has(['sld-cell-shadow', 'sld-add-cell', 'sld-cell-back']), '★슬라이드 칸 절 없음').toEqual(Array(3).fill(false));
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ── 134 SLIDE-CELL-SHADOW-CLIP-01(현빈 «중간») — 블럭·칸 크기 그대로 · 칸 그림자는 위아래로 보임(캔버스·네이티브 PNG·HTML) · GIF·Figma 는 지금처럼(sometime)
 * A1 새 블럭(칸 셋 · 기본 옅은 그림자 = blur 50 + y 18) → 블럭 overflow visible · clip-path inset(−68px 0) · 블럭 높이 = layout.h · 칸 높이 = 블럭 안 높이 ·
 *    블럭 오른끝 너머(잘린 칸 자리) 점의 임자 ≠ 칸(가로는 여전히 자름) · 블럭 바로 아래 띠 화면 = 위아래를 닫은 것(inset 0)과 다르다(그림자 보임) · 펼침 = clip-path none
 * 양성대조: slide-frame-CTL47-shadow-clip-closed.patch(clip-path 를 inset(0) — 옛 hidden 과 같은 자름) → A1 빨강 */
test('A1 칸 그림자 위아래로 보임 · 크기 무변 · 가로는 자름', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  const g = await page.evaluate((id) => { const b = document.getElementById(id), cs = getComputedStyle(b), c = b.querySelector('.sld-cell'); return { ov: cs.overflow, cp: cs.clipPath, bh: b.offsetHeight, lh: window.readSlideState?.(b)?.layout?.h ?? null, ch: c.offsetHeight, inner: b.clientHeight }; }, id);
  expect(g.ov, '★overflow visible').toBe('visible');
  expect(/^inset\(-68px 0px/.test(g.cp), `★위아래만 그림자만큼 엶(받은 값 ${g.cp})`).toBe(true);
  if (g.lh != null) expect(g.bh, '★블럭 높이 = layout.h(무변)').toBe(g.lh);
  expect(g.ch, '★칸 높이 = 블럭 안 높이(무변)').toBe(g.inner);
  const out = await page.evaluate((id) => { const b = document.getElementById(id), r = b.getBoundingClientRect(), c3 = b.querySelectorAll('.sld-cell')[2].getBoundingClientRect(); if (c3.right <= r.right + 4) return 'no-overflow-cell'; const x = Math.min(c3.right - 2, r.right + 6), y = r.top + r.height / 2; return document.elementFromPoint(x, y)?.closest('.sld-cell') ? 'cell' : 'not-cell'; }, id);
  expect(['not-cell', 'no-overflow-cell'], `★가로는 여전히 자름(${out})`).toContain(out);
  const band = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: Math.max(0, r.left + 20), y: r.bottom + 2, width: Math.max(10, r.width - 40), height: 24 }; }, id);
  const a = await page.screenshot({ clip: band });
  await page.evaluate((id) => { document.getElementById(id).style.clipPath = 'inset(0px)'; }, id);
  const b = await page.screenshot({ clip: band });
  expect(a.equals(b), '★블럭 아래 띠에 그림자가 보인다(닫은 판과 다름)').toBe(false);
  await page.evaluate((id) => { const el = document.getElementById(id); window.renderSlideBlock(el); window.unfoldSlide(el, true); }, id);
  expect(await page.evaluate((id) => getComputedStyle(document.getElementById(id)).clipPath, id), '★펼침 = clip-path none').toBe('none');
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* F86 SLIDE-SUJI-PROJ-CASES-01 ③ #sp_oif7z2(폰 틀 고정 + 안의 후기 제자리 전환 · 86 · 지디 261120 «지금 기능 조합으로 되나» 판정 근거)
 *   만드는 순서 그대로: 프레임 칸 0 에 «폰 틀»(회색 꽉) + «후기»(빨강 · 화면 자리) → 칸 복제(duplicateSlideCell) 2번 → 사본 후기만 파랑·초록 → GIF 효과 제자리 페이드(84).
 *   잰다(첫 장면·미리보기·GIF 같은 slidePlan.draw): 한 바퀴 24장에서 틀 자리 픽셀 = 늘 같은 회색(±2 · 겹침 페이드에도) · 화면 자리 = 빨강 → 파랑 → 초록 차례로.
 *   ⇒ «고정 덮개 한 장»이 아니라 «칸마다 같은 자리의 틀 사본»으로 고정처럼 보인다(한계는 커밋 메시지·지디 보고).
 * 양성대조(장면): 사본 하나의 틀을 아래로 옮기면(top 40%) «틀 늘 같음»이 거짓(같은 테스트 안 둘째 측정 · 자가 어긋남을 본다). */
test('F86 폰 틀 고정 + 후기 제자리 전환 — 칸 복제 + 제자리 페이드로 틀 픽셀 늘 같음 · 화면만 바뀜', async ({ page }) => {
  const { errs, id } = await scene(page, { cellMode: 'frame' });
  await wireCdp(page);
  await page.evaluate(async (id) => {
    const b = document.getElementById(id);
    const png = (color, w = 60, h = 40) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, w, h); return cv.toDataURL('image/png'); };
    const put = (cell, src, box) => { window._activeFrame = cell; const had = new Set(cell.querySelectorAll('.asset-block')); window.addAssetBlock(null, { imgSrc: src });
      const ab = [...cell.querySelectorAll('.asset-block')].find((a) => !had.has(a)); Object.assign(ab.style, box); ab.dataset.v86 = box.role; return ab; };
    const cells = [...b.querySelectorAll('.sld-cell')];
    cells.slice(1).forEach((c) => c.remove()); window.renderSlideBlock(b);
    put(cells[0], png('#555555'), { role: 'frame', left: '0px', top: '0px', width: '100%', height: '100%' });
    put(cells[0], png('#ff0000'), { role: 'review', left: '25%', top: '25%', width: '50%', height: '50%' });
    window._activeFrame = null;
    const c1 = window.duplicateSlideCell(b, cells[0]), c2 = window.duplicateSlideCell(b, c1);
    c1.querySelector('[data-v86="review"] img').src = png('#0000ff'); c2.querySelector('[data-v86="review"] img').src = png('#00aa00');
    b.dataset.animFx = 'slide-fade';
    window.renderSlideBlock(b); b.scrollIntoView({ block: 'center' });
  }, id);
  await page.waitForFunction((id) => [...document.getElementById(id).querySelectorAll('.sld-cell .asset-block img')].filter((i) => i.complete && i.naturalWidth > 0).length >= 6, id);   // 칸 셋 × 그림 둘 뜸(조건 대기)
  const measure = async () => page.evaluate(async (id) => {
    const b = document.getElementById(id); b._sldImgs = null; const imgs = await window.slidePrepare(b);
    const W = b.offsetWidth, H = b.offsetHeight, frames = [];
    for (let i = 0; i < 24; i++) {
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'); window.slidePlan(b).draw(ctx, W, H, null, i / 24);
      const px = (x, y) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data).slice(0, 3);
      frames.push({ frame: px(W * 0.5, H * 0.08), screen: px(W * 0.5, H * 0.5) });
    }
    const near = (a, b, d = 2) => a.every((v, i) => Math.abs(v - b[i]) <= d);
    const kind = (p) => (near(p, [255, 0, 0], 8) ? 'R' : near(p, [0, 0, 255], 8) ? 'B' : near(p, [0, 170, 0], 8) ? 'G' : '~');
    const seq = frames.map((f) => kind(f.screen)).filter((k) => k !== '~').filter((k, i, a) => i === 0 || a[i - 1] !== k).join('');
    return { n: imgs.length, frameSame: frames.every((f) => near(f.frame, frames[0].frame)), frame0: frames[0].frame, seq, fx: b.dataset.animFx };
  }, id);
  const r = await measure();
  expect({ n: r.n, fx: r.fx }, '[전제] 칸 셋 · 제자리 페이드').toEqual({ n: 3, fx: 'slide-fade' });
  expect(r.frame0, '[전제] 틀 자리 = 회색').toEqual([85, 85, 85]);
  expect(r.frameSame, '★틀 픽셀이 한 바퀴 내내 같다(고정처럼 보임)').toBe(true);
  expect(r.seq.startsWith('RBG'), `★화면 자리 = 빨강 → 파랑 → 초록(${r.seq})`).toBe(true);
  /* 양성대조(장면) — 사본 하나의 틀을 아래로 옮기면 같은 자가 «늘 같음 아님»을 본다 */
  await page.evaluate((id) => { const f = document.getElementById(id).querySelectorAll('.sld-cell')[1].querySelector('[data-v86="frame"]'); f.style.top = '40%'; }, id);
  expect((await measure()).frameSame, '양성대조: 사본 틀이 어긋나면 자가 잡는다').toBe(false);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* X2 SLIDE-ENTER-EXIT-DIM-01 고침(지혜맥 261120 · 18칸 빨강) — 접힌 슬라이드의 «칸 밖»(칸 틈)을 두 번 누르면 펼치고 «펼친 채» 남는다.
 *   원인: 펼침(문서 capture dblclick)과 «빈 곳 두 번 = 나옴»(140 · 같은 문서 capture)이 같은 이벤트를 차례로 받아 펼치자마자 접었다(stopPropagation 은 같은 노드 다음 듣개를 못 막음).
 *   고침: 펼침을 연 그 이벤트는 나옴 판정에서 뺀다. 펼친 «뒤» 새 두 번 누름은 그대로 나옴(140 뜻 유지 — 같은 테스트 둘째 단계).
 * 양성대조: _patches/slide-frame-CTL45-enter-ev-not-skipped.patch(나옴 쪽 «e === _enterEv» 줄 삭제) → X2 «펼친 채» 빨강. */
test('X2 접힌 슬라이드 칸 틈 두 번 = 펼침 · 펼친 채 남음 · 다음 두 번 = 나옴', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  const open = () => page.evaluate((id) => document.getElementById(id).classList.contains('sld-unfold'), id);
  await page.evaluate((id) => { window.unfoldSlide(document.getElementById(id), false); document.getElementById(id).scrollIntoView({ block: 'center' }); }, id);
  await expect.poll(open, '[전제] 접힘').toBe(false);
  let prev = '', gap = null;
  await expect.poll(async () => {
    gap = await page.evaluate((id) => { const b = document.getElementById(id), cs = b.querySelectorAll('.sld-cell'); const a = cs[0].getBoundingClientRect(), c = cs[1].getBoundingClientRect();
      const x = (a.right + c.left) / 2, y = (a.top + a.bottom) / 2, e = document.elementFromPoint(x, y);
      return { x, y, ok: c.left - a.right >= 2 && !!e && b.contains(e) && !e.closest('.sld-cell') }; }, id);
    const k = JSON.stringify([gap.x, gap.y]), same = k === prev; prev = k; return gap.ok && same;
  }, { message: '[전제] 칸 틈 = 슬라이드 안 · 칸 밖(두 번 같은 자리)', intervals: [50] }).toBe(true);
  await page.mouse.dblclick(gap.x, gap.y);
  await expect.poll(open, '★칸 틈 두 번 = 펼침').toBe(true);
  let n = 0;
  await expect.poll(async () => { n = (await open()) ? n + 1 : 0; return n >= 2; }, { message: '★펼친 채 남음(두 번 연속 펼침 — 같은 이벤트로 곧장 접히지 않음)', intervals: [50] }).toBe(true);
  await page.mouse.dblclick(gap.x, gap.y);
  await expect.poll(open, '★펼친 뒤 새 두 번 누름 = 나옴(140 그대로)').toBe(false);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* B1 SLIDE-CELL-REORDER-01 띠 탭(지디 261120 ⓐ · 현빈 7112 «띠가 보이면 띠가 이긴다» — 그리드 머리띠 R1·E1 과 같은 어법)
 *   P1 장면(칸 5 · 같은 섹션 글자) → 펼침 + 슬라이드 고름 → 띠가 옆 글자 위에 뜬 점(맨 위 = 띠 · 그 밑 = 글자)을 탭 = 그 띠의 칸이 골라진다 · 글자는 안 골라짐 · 펼침 그대로.
 * 양성대조: _patches/slide-frame-CTL49-band-no-pointer.patch(칸 띠 pointer-events none) → 탭이 글자로 가 B1 빨강. */
test('B1 펼침 중 칸 띠 탭 = 그 칸 고름(띠 밑 옆 글자 아님)', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  await page.evaluate((id) => { const b = document.getElementById(id); window.addSlideCell(b); window.addSlideCell(b); window.selectSection(b.closest('.section-block')); }, id);
  const otherId = await page.evaluate(() => { window._activeFrame = null; window.addTextBlock('body'); return document.querySelector('#canvas .section-block .text-block:not(.sld-cell .text-block)')?.id || null; });
  expect(otherId, '[전제] 같은 섹션 글자').not.toBeNull();
  await page.evaluate((id) => { window.selectBlock(id); window.unfoldSlide(document.getElementById(id), true); }, id);
  await waitZoomSettled(page, await page.evaluate(() => window.currentZoom));
  await expect.poll(() => page.locator('#ss-handles-overlay > .grd-headband[data-sld]').count(), '[전제] 칸 띠 다섯').toBe(5);
  /* 띠가 글자 위에 뜬 점 — 맨 위 = 칸 띠 · 오버레이 밑 첫 요소 = 글자(같은 자리 두 번) */
  let prev = '', pt = null;
  await expect.poll(async () => {
    pt = await page.evaluate((oid) => { const t = document.getElementById(oid), ovl = document.getElementById('ss-handles-overlay');
      for (const b of ovl.querySelectorAll(':scope > .grd-headband[data-sld]')) { const r = b.getBoundingClientRect();
        for (const fx of [0.5, 0.25, 0.75]) { const x = r.left + r.width * fx, y = r.top + r.height / 2, top = document.elementFromPoint(x, y), under = document.elementsFromPoint(x, y).find((e) => !ovl.contains(e));
          if (top === b && under && (under === t || t.contains(under))) return { x, y, i: +b.dataset.i, ok: true }; } }
      return { ok: false }; }, otherId);
    const k = JSON.stringify(pt.ok && [Math.round(pt.x), Math.round(pt.y)]); const same = k === prev; prev = k; return pt.ok && same;
  }, { message: '[전제] 칸 띠가 옆 글자 위에 뜬 점(같은 자리 두 번)', intervals: [50] }).toBe(true);
  await page.mouse.click(pt.x, pt.y);
  await expect.poll(() => page.evaluate(({ id, oid, i }) => { const b = document.getElementById(id), c = window.slideCellsOf(b)[i];
    return { cell: c.classList.contains('selected') && window._activeFrame === c, text: document.getElementById(oid).classList.contains('selected'), open: b.classList.contains('sld-unfold') }; }, { id, oid: otherId, i: pt.i }),
    `★띠 ${pt.i + 1} 탭 = 칸 ${pt.i + 1} 고름 · 옆 글자 안 골라짐 · 펼침 그대로`).toEqual({ cell: true, text: false, open: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ── 옛 저장본 픽스처(독립 리뷰 261120 «덧») — 뒤 커밋이 바꾼 «의도된 변화»가 옛 저장본을 다시 그릴 때 나타나나
 * O137 SLIDE-DOTS-GAP-SLIDER-01(137 d7385bc2c): 점 켠 옛 블럭(블럭 높이 = layout.h 고정 · 트랙 = 100% − 옛 띠 «갭×2+점») → 다시 그리면 블럭 = layout.h + 새 띠(갭+점+8) · 칸 높이 = layout.h 그대로
 * O134 SLIDE-CELL-SHADOW-CLIP-01(134 933841aa4): 옛 인라인 overflow:hidden(clip-path 없음) 저장본 → 다시 그리면 overflow visible + 가로 clip-path inset(…)
 * 옛 저장본 = 지금 저장 글자에서 그 블럭의 인라인 style 만 옛 꼴로 바꿔 다시 연다(로드가 RERENDER 로 다시 그림 · slide-block.dom M5 와 같은 길). */
async function reloadWith(page, id, mutate) {
  await page.evaluate(({ id, mutate }) => {
    window.flushCurrentPage?.();
    const d = JSON.parse(window.serializeProject());
    d.pages = d.pages.map((p) => {
      if (!p.canvas || !p.canvas.includes(id)) return p;
      const doc = new DOMParser().parseFromString(`<div id="__w">${p.canvas}</div>`, 'text/html'), b = doc.getElementById(id);
      new Function('b', mutate)(b);
      return { ...p, canvas: doc.getElementById('__w').innerHTML };
    });
    document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d);
  }, { id, mutate });
}
test('O137 옛 저장본(점 켬 · 옛 띠) → 다시 그리면 블럭이 새 띠만큼 커지고 칸 높이 그대로', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  const h = await page.evaluate((id) => { const b = document.getElementById(id); window.setSlideLayout(b, { dots: 'bottom', dotGap: 16 }); window.renderSlideBlock(b); return window.readSlideState(b).layout.h; }, id);
  /* 옛 꼴: 블럭 = h(고정) · 트랙 = calc(100% − 40px) · 아래 여백 40px(옛 띠 = 16×2 + 8) */
  await reloadWith(page, id, `b.style.height = '${h}px'; const t = b.querySelector(':scope > .sld-track'); t.style.height = 'calc(100% - 40px)'; t.style.marginBottom = '40px';`);
  const geo = () => page.evaluate((id) => { const b = document.getElementById(id); if (!b) return null; const t = b.querySelector(':scope > .sld-track'), c = b.querySelector('.sld-cell'); return { block: b.offsetHeight, track: t?.offsetHeight ?? null, cell: c?.offsetHeight ?? null }; }, id);
  await expect.poll(geo, `★다시 그림 = 블럭 ${h}+32(새 띠 16+8+8) · 트랙·칸 ${h} 그대로`).toEqual({ block: h + 32, track: h, cell: h });
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('O134 옛 저장본(인라인 overflow:hidden · clip-path 없음) → 다시 그리면 overflow visible + 가로 clip-path', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  await reloadWith(page, id, `b.style.overflow = 'hidden'; b.style.clipPath = '';`);
  await expect.poll(() => page.evaluate((id) => { const b = document.getElementById(id); if (!b) return null; const cs = getComputedStyle(b); return [cs.overflow, cs.clipPath.startsWith('inset(')]; }, id),
    '★다시 그림 = overflow visible · clip-path inset(가로만 자름)').toEqual(['visible', true]);
  expect(errs, errs.join(' | ')).toEqual([]);
});
