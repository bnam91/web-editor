/* anim-gif-v3-options — GIF V3(0.9.13 19~23행 · 현빈 261116) 옵션 «칸»이 실제 모달에서 서고 저장되는가. 그리기 셈은 단위 T21~T26(anim-gif-tracks)이 잰다.
 *   실제 텍스트 블럭 · 실제 모달 · 진짜 클릭(효과 고르기 · 체크 · 고르기 · 줄마다 따로).
 * V1 블럭 전체: 도장 → «옅은 가이드» 칸 하나 → 켬 = data-anim-opt {"guide":true} · 모달 다시 열면 켜진 채 · 타이핑으로 바꾸면 가이드+커서 칸 · 커서 끔 = {"guide":true,"cursor":false} ·
 *    글로우 펄스 = 가이드·글로우·깜빡임 셋 · 슬라이드업 = 칸 0(옵션 없는 효과 · 저장 키 지움) · 형광펜 없는 글엔 형광펜 고르기 0
 * V2 줄마다 따로: 첫 줄 효과를 타이핑으로 → 그 줄 칸에 커서 칸 → 끔 = data-anim-gif 첫 트랙 o {"cursor":false}
 * V3 형광펜 칠한 글(span.tb-hl): 형광펜 고르기 = 네 갈래(기본·고정·긋기·글 고정+띠만 긋기) · «형광펜 긋기» = data-anim-opt {"hl":"draw"} · 「한 글자씩 부드럽게」 효과가 목록에 있고 고르면 미리보기가 그려진다(빈 캔버스 아님)
 * V4(0.9.13 NEW-현빈QA-GIF-HL-SELECT-CSS-01 «형광펜 드롭다운이 브라우저 기본 모양이라 혼자 튄다»): 형광펜 글 + 줄마다 따로 → 첫 줄의 형광펜 고르기 class = 같은 줄 효과 고르기 class ·
 *    계산된 높이·바탕·테두리·글 크기도 같음 · 블럭 전체 칸의 형광펜 고르기도 같은 class
 *    양성대조(예측 · CTL): _optControls 의 `sel.className = 'anim-track-fx';` 삭제 → V4 빨강
 * V5(같은 표 재작업 · 지디 9500 실측 css25-overlap «줄마다 따로면 줄 옵션·형광펜 고르기가 줄 이름 위에 겹치고 마지막 것이 안내 글을 덮음»):
 *    타이핑 + 형광펜 글 두 줄 + 줄마다 따로 → 줄 칸 모든 부품(이름·효과·시작·길이·옵션 체크·형광펜 고르기·막대) + 안내 글 사각형이 서로 안 겹침 · 줄 칸 밖으로 안 넘침
 *    + 줄 옵션 칸(.anim-fx-opt-set) 좌우 = 줄 칸 좌우(첫 칸 72px 에 갇히지 않음) · 옵션 체크·형광펜 고르기가 한 줄(세로 가운데 차 ≤2px)
 *    + (9500 view4 css25v4-labelwrap «옅은 가이드 = 열/은 가이/드») 줄 옵션 라벨 글 = 한 줄(Range 조각 1) — 세로 가운데 자는 align-items:center 라 꺾여도 초록이었다
 *    양성대조(예측 · CTL): editor-extra.css `.anim-fx-opt-set > .anim-opt-label {…}` 줄 삭제 → V5 의 «라벨 한 줄» 자만 빨강
 *    양성대조(예측 · CTL): editor-extra.css `.anim-track-row > .anim-fx-opt-set {…}` 줄 삭제 → V5 빨강 · `.anim-track-row` 에 `grid-template-rows: auto 4px;` 되살림 → V5 빨강
 * 양성대조(예측 · CTL): animation-engine.js _selectAnim 의 `_renderBlockOpts();` 줄 삭제 → V1·V3 빨강(칸이 안 선다) · V2 초록(줄 칸은 _renderTrackRows)
 * 셀렉터·전역 대조(제품 소스 grep): #anim-gif-modal · #anim-list .anim-item[data-id] · #anim-fx-opts(index.html) · [data-opt](animation-engine.js _optControls) ·
 *   #anim-per-line · #anim-tracks .anim-track-row .anim-track-fx .anim-track-label .anim-track-at .anim-track-dur .anim-track-bar(_renderTrackRows) · .anim-fx-opt-set(_optControls) · #anim-loop-info(index.html) · #anim-preview-canvas · .tb-hl(prop-text-wireup-text-edit.js) · window.openAnimModal/closeAnimModal
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, html) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (html) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    window.selectSection(c.querySelector('.section-block'));
    window.addTextBlock('body');
    const tb = [...c.querySelectorAll('.text-block')].pop();
    (tb.querySelector('[contenteditable]') || tb.querySelector('.tb-body')).innerHTML = html;
    window.__tb = tb;
    window.deselectAll?.();
    window.openAnimModal(tb);
  }, html);
  return errs;
}
const opts = (page) => page.evaluate(() => [...document.querySelectorAll('#anim-fx-opts [data-opt]')].map((e) => e.dataset.opt));
const saved = (page) => page.evaluate(() => window.__tb.dataset.animOpt ?? null);
const pick = (page, id) => page.click(`#anim-list .anim-item[data-id="${id}"]`);

test('V1 블럭 전체 옵션 — 효과마다 칸 · 켬/끔 저장 · 다시 열면 그대로', async ({ page }) => {
  const errs = await scene(page, '네!');
  await pick(page, 'stamp');
  expect(await opts(page), '★도장 = 옅은 가이드 칸').toEqual(['guide']);
  await page.check('#anim-fx-opts [data-opt="guide"]');
  expect(await saved(page)).toBe('{"guide":true}');
  await page.evaluate(() => { window.closeAnimModal(); window.openAnimModal(window.__tb); });
  await expect(page.locator('#anim-fx-opts [data-opt="guide"]'), '다시 열면 켜진 채').toBeChecked();
  await pick(page, 'typewriter');
  expect(await opts(page), '타이핑 = 가이드 + 커서').toEqual(['guide', 'cursor']);
  await page.uncheck('#anim-fx-opts [data-opt="cursor"]');
  expect(await saved(page)).toBe('{"guide":true,"cursor":false}');
  await pick(page, 'glow-pulse');
  expect(await opts(page), '펄스 = 가이드 · 글로우 · 깜빡임').toEqual(['guide', 'glow', 'pulse']);
  await pick(page, 'slide-up');
  expect([await opts(page), await saved(page)], '옵션 없는 효과 = 칸 0 · 저장 키 지움').toEqual([[], null]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V2 줄마다 따로 — 줄 칸에 같은 옵션 · 트랙 o 로 저장', async ({ page }) => {
  const errs = await scene(page, '오늘 주문하면?<br>네!');
  await page.check('#anim-per-line');
  const row0 = page.locator('#anim-tracks .anim-track-row[data-line="0"]');
  await row0.locator('.anim-track-fx').selectOption('typewriter');
  await expect(row0.locator('[data-opt="cursor"]'), '★타이핑 줄에 커서 칸').toHaveCount(1);
  await row0.locator('[data-opt="cursor"]').uncheck();
  const t0 = await page.evaluate(() => JSON.parse(window.__tb.dataset.animGif).tracks[0]);
  expect([t0.fx, t0.o], '첫 트랙 저장').toEqual(['typewriter', { cursor: false }]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V3 형광펜 칠한 글 — 형광펜 고르기 세 갈래 · 긋기 저장 / 한 글자씩 부드럽게 효과', async ({ page }) => {
  const errs = await scene(page, '누적 <span class="tb-hl" style="--tb-hl-color: rgb(255, 0, 255); --tb-hl-h: 40%; --tb-hl-y: 0px">20,000</span>장');
  await pick(page, 'fade-in');
  const sel = page.locator('#anim-fx-opts select[data-opt="hl"]');
  await expect(sel, '★형광펜 글인데 형광펜 고르기가 없다').toHaveCount(1);
  expect(await sel.locator('option').evaluateAll((os) => os.map((o) => o.value))).toEqual(['', 'fixed', 'draw', 'sweep']);   // 0.9.13 24행 «글 고정 + 띠만 긋기» 더함
  await sel.selectOption('draw');
  expect(await saved(page)).toBe('{"hl":"draw"}');
  await expect(page.locator('#anim-list .anim-item[data-id="fade-char"]'), '[전제] 새 효과가 목록에').toHaveCount(1);
  await pick(page, 'fade-char');
  await expect.poll(() => page.evaluate(() => { const cv = document.getElementById('anim-preview-canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] && (d[i - 3] < 200 || d[i - 2] < 200)) n++; return n; }), { timeout: 10000, message: '★한 글자씩 부드럽게 미리보기가 비었다' }).toBeGreaterThan(50);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V4 형광펜 고르기 꼴 = 형제 효과 고르기(공용 class · 계산된 꼴 같음)', async ({ page }) => {
  const errs = await scene(page, '누적 <span class="tb-hl" style="--tb-hl-color: rgb(255, 0, 255); --tb-hl-h: 40%; --tb-hl-y: 0px">20,000</span>장<br>네!');
  await pick(page, 'fade-in');
  const blockSel = page.locator('#anim-fx-opts select[data-opt="hl"]');
  await expect(blockSel, '[전제] 블럭 전체 칸에 형광펜 고르기').toHaveCount(1);
  await page.check('#anim-per-line');
  const row0 = page.locator('#anim-tracks .anim-track-row[data-line="0"]');
  await expect(row0.locator('select[data-opt="hl"]'), '[전제] 형광펜 글 줄에 형광펜 고르기').toHaveCount(1);
  const r = await page.evaluate(() => {
    const row = document.querySelector('#anim-tracks .anim-track-row[data-line="0"]');
    const fx = row.querySelector('select:not([data-opt])'), hl = row.querySelector('select[data-opt="hl"]');
    const look = (e) => { const c = getComputedStyle(e); return [c.height, c.backgroundColor, c.borderTopColor, c.borderTopWidth, c.borderRadius, c.fontSize, c.color]; };
    return { fxCls: fx.className, hlCls: hl.className, fxLook: look(fx), hlLook: look(hl) };
  });
  expect([r.hlCls, r.hlLook], `★형광펜 고르기가 형제 효과 고르기와 꼴이 다르다 — ${JSON.stringify(r)}`).toEqual([r.fxCls, r.fxLook]);
  expect(r.fxCls, '[전제] 형제 효과 고르기 class').toBe('anim-track-fx');
  await page.uncheck('#anim-per-line');
  await expect(blockSel, '블럭 전체 칸도 같은 class').toHaveClass('anim-track-fx');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V5 줄마다 따로 — 줄 옵션·형광펜 고르기가 줄 이름·효과·시작/길이·안내 글과 안 겹침', async ({ page }) => {
  const errs = await scene(page, '<span class="tb-hl" style="--tb-hl-color: rgb(255, 235, 59); --tb-hl-h: 100%; --tb-hl-y: 0px">안녕하세요</span><br>반갑습니다.');
  await pick(page, 'typewriter');
  await page.check('#anim-per-line');
  await expect(page.locator('#anim-tracks .anim-track-row'), '[전제] 줄 칸 둘').toHaveCount(2);
  await expect(page.locator('#anim-tracks .anim-track-row .anim-fx-opt-set select[data-opt="hl"]'), '[전제] 줄마다 형광펜 고르기').toHaveCount(2);
  const r = await page.evaluate(() => {
    const box = (e, name) => { const b = e.getBoundingClientRect(); return { name, l: b.left, t: b.top, r: b.right, b: b.bottom }; };
    const parts = [], rows = [...document.querySelectorAll('#anim-tracks .anim-track-row')];
    rows.forEach((row, i) => [...row.children].forEach((c) => {
      const kids = c.classList.contains('anim-fx-opt-set') ? [...c.children] : [c];
      kids.forEach((k) => parts.push({ ...box(k, `${i}:${k.dataset.opt || k.querySelector('[data-opt]')?.dataset.opt || k.className}`), row: box(row, 'row') }));
    }));
    const info = box(document.getElementById('anim-loop-info'), 'info');
    const all = [...parts, info], hit = [], spill = [], empty = [];
    for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) {
      const A = all[a], B = all[b];
      if (Math.min(A.r, B.r) - Math.max(A.l, B.l) > 0.5 && Math.min(A.b, B.b) - Math.max(A.t, B.t) > 0.5) hit.push(`${A.name}×${B.name}`);
    }
    parts.forEach((p) => { if (p.r - p.l < 1 || p.b - p.t < 1) empty.push(p.name); if (p.t < p.row.t - 0.5 || p.b > p.row.b + 0.5) spill.push(p.name); });
    const lanes = rows.map((row, i) => { const set = row.querySelector('.anim-fx-opt-set'), R = row.getBoundingClientRect(), S = set.getBoundingClientRect();
      const mids = [...set.children].map((k) => { const q = k.getBoundingClientRect(); return (q.top + q.bottom) / 2; });
      return { i, wide: Math.abs(S.left - R.left) <= 1 && Math.abs(S.right - R.right) <= 1, oneLine: Math.max(...mids) - Math.min(...mids) <= 2, setW: Math.round(S.width), rowW: Math.round(R.width) }; });
    const wraps = [...document.querySelectorAll('#anim-tracks .anim-fx-opt-set > label')].map((lab) => {   // 라벨 글 줄 수 = 글 조각 사각형 수(Range · 줄마다 한 조각)
      const rg = document.createRange(); rg.selectNodeContents(lab.lastChild);
      return { t: lab.textContent.trim(), lines: [...rg.getClientRects()].filter((q) => q.width > 0).length, h: Math.round(lab.getBoundingClientRect().height) }; });
    return { n: parts.length, hit, spill, empty, lanes, wraps };
  });
  expect(r.n, `[전제] 줄마다 부품 8(이름·효과·시작·길이·가이드·커서·형광펜·막대) — ${JSON.stringify(r)}`).toBe(16);
  expect(r.empty, '[전제] 크기 0 부품 없음').toEqual([]);
  expect([r.hit, r.spill], '★줄 칸 부품이 겹치거나 줄 칸 밖으로 넘친다').toEqual([[], []]);
  expect(r.wraps.map((w) => w.t), '[전제] 줄마다 라벨 둘').toEqual(['옅은 가이드', '커서', '옅은 가이드', '커서']);
  expect(r.wraps.map((w) => w.lines), `★줄 옵션 라벨이 꺾인다(라벨 글 = 한 줄이어야) — ${JSON.stringify(r.wraps)}`).toEqual([1, 1, 1, 1]);
  expect(r.lanes.map((l) => [l.wide, l.oneLine]), `★줄 옵션이 줄 칸 폭 통째가 아니다(첫 칸 72px 에 갇혀 체크·형광펜 고르기가 접힘) — ${JSON.stringify(r.lanes)}`).toEqual([[true, true], [true, true]]);
  expect(errs, errs.join(' | ')).toEqual([]);
});
