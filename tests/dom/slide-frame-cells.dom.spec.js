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
const { bootApp } = require('./_root-harness.js');

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
  const p1 = await at(0, 12);
  await page.mouse.click(p1[0], p1[1]);
  expect(await page.evaluate((id) => { const b = document.getElementById(id); return { slide: b.classList.contains('selected'), cell: b.querySelectorAll('.sld-cell.selected').length, open: b.classList.contains('sld-unfold') }; }, id), '★한 번 = 슬라이드만(펼침 없음)').toEqual({ slide: true, cell: 0, open: false });
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
      handles: document.querySelectorAll('.ss-resize-handle, .ss-radius-handle').length, framePanel: !!document.getElementById('ss-align-left') };   // 프레임 패널(prop-frame.js)에만 있는 id
  }, id);
  expect(pre, `[전제] 펼친 뒤 누를 점 = 칸 2 · 진단 ${JSON.stringify({ pre, post })}`).toMatchObject({ open: true, inCell2: true });
  expect(pick, `★칸 고름 · 슬라이드 패널 그 칸 줄 · 프레임 px 손잡이 0 · 프레임 패널 0 · 진단 ${JSON.stringify({ pre, post })}`).toEqual({ active: true, sel: true, row: '1', handles: 0, framePanel: false });
  /* SLIDE-PANEL-REMOVE-CELL-PHOTO-BTN-01(현빈 피드백 3 ② · 제품 뜻 바뀜) — 칸을 골라도 패널에 «사진 넣기 (칸 N)» 단추가 없다(사진은 칸 위 스크래치·라이브러리 놓기 = R3) · 모서리 칸은 있다(같은 갈래가 그려졌다는 양성) */
  await expect(page.locator('#sld-cell-radius'), '[전제] 고른 칸 갈래 그려짐').toHaveCount(1);
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
const pickCell = async (page, id, i) => {
  const q = await page.evaluate(({ id, i }) => { const r = document.getElementById(id).querySelectorAll('.sld-cell')[i].getBoundingClientRect(); return [r.left + 8, r.top + 8]; }, { id, i });
  if (!(await page.evaluate((id) => document.getElementById(id).classList.contains('sld-unfold'), id))) await page.mouse.dblclick(q[0], q[1]);
  await page.mouse.click(q[0], q[1]);
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
  expect(await page.evaluate((id) => getComputedStyle(document.getElementById(id)).overflow, id), '[전제] 펼친 상태').toBe('visible');
  const sOpen = await shot();
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Escape');   // Esc = 접힘(SLIDE-CLICK-SELECT-DBL-UNFOLD-01 · 옛 «고름 풀면 접힘»)
  expect(await page.evaluate((id) => getComputedStyle(document.getElementById(id)).overflow, id), 'Esc = 접힘(잘림)').toBe('hidden');
  const sClosed = await shot();
  expect(sOpen && sOpen.length > 100, '[전제] PNG 가 나왔다').toBe(true);
  expect(sOpen === sClosed, '★펼친 채 PNG = 안 펼친 PNG(글자 그대로)').toBe(true);
  /* 고름 풀면 칸 4 자리 = 칸 4 아님 */
  expect((await hit()).in, '접히면 칸 4 는 잘려 안 맞는다').toBe(false);
  /* 펼침 중 옆 블럭 클릭 */
  await page.evaluate((id) => { window.selectBlock(id); window.unfoldSlide(document.getElementById(id), true); }, id);
  /* 앞에서 칸 4 로 캔버스를 가로 스크롤했다 ⇒ 옆 글자가 화면 밖일 수 있다(지혜맥 P1 빨강) — 펼친 채(슬라이드 고름 유지) 그 글자를 화면 안으로 · 누르기 «전» 그 점이 누구인지 잰다:
     글자가 아니면 «무엇이 덮었나»를 메시지로(펼친 칸·덮개가 가로채면 여기서 이름이 나온다 = 제품 빨강) */
  const op = await page.evaluate((oid) => { const t = document.getElementById(oid); t.scrollIntoView({ block: 'center', inline: 'center' }); const r = t.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2, e = document.elementFromPoint(x, y);
    return { x, y, hit: !!e && (e === t || t.contains(e)), who: e ? `${e.tagName}.${[...e.classList].join('.')}#${e.id}` : null, open: getComputedStyle(document.querySelector('#canvas .slide-block')).overflow }; }, otherId);
  expect(op.open, '[전제] 아직 펼친 채').toBe('visible');
  expect(op.hit, `★펼침 중 옆 글자 자리를 덮은 것 = ${op.who}`).toBe(true);
  await page.mouse.click(op.x, op.y);
  expect(await page.evaluate((oid) => document.getElementById(oid).classList.contains('selected'), otherId), '★펼침(흐림 덮개) 중 옆 글자 블럭 클릭 = 골라짐').toBe(true);
  /* 저장본 흔적 0 · 저장→다시 열기 글 그대로 */
  await page.evaluate((id) => window.selectBlock(id), id);
  const savedSlide = await page.evaluate((id) => { window.flushCurrentPage?.(); const d = JSON.parse(window.serializeProject());
    const doc = new DOMParser().parseFromString(`<div>${d.pages.map((p) => p.canvas).join('')}</div>`, 'text/html'); const b = doc.getElementById(id); return b ? { cls: b.className, ov: b.style.overflow, selIn: b.querySelectorAll('.selected').length } : null; }, id);
  expect(savedSlide, '★저장본 슬라이드 = 펼침 흔적 0').toEqual({ cls: 'slide-block', ov: 'hidden', selIn: 0 });
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
  await page.locator('#sld-cell-radius').fill('20'); await page.locator('#sld-cell-radius').dispatchEvent('change');
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
 * K1 SLIDE-CELL-CHILD-SELECT-OUTLINE-01: 펼쳐 칸 2 에 글자 → 칸 빈 곳 누름 → 글자 가운데 누름 → 글자 골라짐(전제) · ★선택 층(.ss-sel-layer path) 하나가 글자 상자(글자 래퍼)를 감쌈(±2px)
 *    · 실패 메시지 = 진단(골라진 것 · 길 상자 · 글자 상자 · 그 점의 주인) — 원인 미확인(srv 실행 0) · 지혜맥 결과로 가른다
 * 양성대조: slide-frame-CTL31-delete-folds.patch(editor.js 칸 빼기의 펼침 되켜기 줄 삭제) → U2 빨강(sld-unfold false) · slide-frame-CTL32-cell-photo-btn.patch(패널 단추 되살림) → F2 빨강(단추 1) — 예측 */
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
  await expect.poll(async () => (await diag()).tSel, '[전제] 글자 골라짐').toBe(true);
  await expect.poll(async () => { const d = await diag(); return d.paths.some((x) => x.box.every((v, k) => Math.abs(v - d.hostBox[k]) <= 2)); },
    { message: `★선택 층 길 하나가 글자 상자를 감쌈 · 진단 ${JSON.stringify(await diag())}` }).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});
