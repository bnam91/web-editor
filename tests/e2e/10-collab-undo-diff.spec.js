/* ══════════════════════════════════════════════════════════════════════════
   10-collab-undo-diff.spec.js — 협업 undo(P3) 순수유틸 단위테스트.
   ───────────────────────────────────────────────────────────────────────────
   실제 소스 3종(market-merge.js·io/section-serialize.js·history-diff.js)을 «그대로»
   about:blank 페이지에 주입해 검증한다 — 사본을 만들지 않으므로 drift 가 불가능하다.
   앱(Electron)·메인 9334 미접촉. 순수 브라우저(chromium) 컨텍스트.

   커버:
     R1  라이브 섹션 세척 해시 == 그 섹션이 스냅샷(getSerializedCanvas) 안에서 갖는 해시
         (lazy-unloaded·selected·핸들·sticker.tiny·group-selected·inline transform·
          _name↔data-name 불일치 포함) — 세척이 «전체 파이프라인의 섹션판»임을 증명.
     R2  diff 변경 판정이 raw outerHTML 이라 annotation-block 변경을 잡는다
         (normSection 해시로는 «같음»이 되어 놓친다는 대조 포함).
     기본 diff  changed/added/removed 분류(undo/redo 대칭의 토대).
     R6  noid 인덱스 키가 섹션 증감 시 «같음»으로 오분류되지 않는다.
═══════════════════════════════════════════════════════════════════════════ */
const { test, expect } = require('@playwright/test');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../');
const FILES = [
  path.join(ROOT, 'js/market-merge.js'),
  path.join(ROOT, 'js/io/section-serialize.js'),
  path.join(ROOT, 'js/history-diff.js'),
];

async function loadUtils(page) {
  await page.goto('about:blank');
  for (const f of FILES) await page.addScriptTag({ path: f });
  // 3종 모두 로드됐는지 sanity
  const ok = await page.evaluate(() =>
    !!(window.marketMerge && window.serializeCleanRoot && window.serializeSectionClone && window.historyDiff));
  expect(ok, 'util globals loaded').toBe(true);
}

test.describe('collab-undo P3 순수유틸', () => {
  test('R1: 라이브 섹션 세척 해시 == 스냅샷 안 섹션 해시(장식 상태 포함)', async ({ page }) => {
    await loadUtils(page);
    const res = await page.evaluate(() => {
      const canvas = document.createElement('div');
      canvas.id = 'canvas';
      document.body.appendChild(canvas);
      // 3개 섹션: 각기 다른 «라이브 장식» 상태를 얹는다(스냅샷엔 세척돼 사라져야 함).
      canvas.innerHTML = `
        <section class="section-block selected" id="sec_a">
          <div class="text-block editing" contenteditable="true">Hello A</div>
          <div class="block-resize-handle"></div>
          <div class="img-corner-handle"></div>
        </section>
        <section class="section-block lazy-unloaded" id="sec_b" data-lazy-bg="url(&quot;x.png&quot;)" style="background-image:none">
          <div class="sticker-block tiny">S</div>
          <div class="drop-indicator"></div>
        </section>
        <section class="section-block" id="sec_c" style="transform:scale(0.5);position:absolute;left:10px">
          <div class="group-block group-selected group-editing">
            <div class="ci-selected ci-active row-active">card</div>
          </div>
          <div class="annotation-block">주석 노트</div>
        </section>`;
      // _name↔data-name 불일치(getSerializedCanvas 가 저장 직전 동기화하는 케이스)
      const secA = canvas.querySelector('#sec_a');
      secA._name = '섹션A이름';
      secA.dataset.name = '옛이름';

      const M = window.marketMerge;

      // ── 스냅샷 경로(=getSerializedCanvas 재현): live _name→dataset 동기화 후 클론 세척 ──
      canvas.querySelectorAll('.section-block').forEach(sec => {
        if (sec._name && sec.dataset.name !== sec._name) sec.dataset.name = sec._name;
      });
      const clone = canvas.cloneNode(true);
      window.serializeCleanRoot(clone);
      const snapshotStr = clone.innerHTML;

      // 스냅샷 안 각 섹션의 normSection 해시
      const snapHash = {};
      const D = new DOMParser().parseFromString(`<div id="c">${snapshotStr}</div>`, 'text/html').getElementById('c');
      D.querySelectorAll('.section-block').forEach(sec => { snapHash[sec.id] = M.hash(M.normSection(sec)); });

      // 라이브 각 섹션의 세척 해시(serializeSectionClone 경유)
      const liveHash = {};
      canvas.querySelectorAll('.section-block').forEach(sec => {
        liveHash[sec.id] = window.historyDiff.sectionGuardHash(sec);
      });

      return { snapHash, liveHash, snapshotStr };
    });

    for (const id of ['sec_a', 'sec_b', 'sec_c']) {
      expect(res.liveHash[id], `${id} live hash non-null`).toBeTruthy();
      expect(res.liveHash[id], `${id} live==snapshot`).toBe(res.snapHash[id]);
    }
    // 세척이 실제로 장식을 지웠는지(회귀 감지): 스냅샷에 라이브 전용 클래스/속성이 없어야
    expect(res.snapshotStr).not.toContain('lazy-unloaded');
    expect(res.snapshotStr).not.toContain('data-lazy-bg');
    expect(res.snapshotStr).not.toContain('block-resize-handle');
    expect(res.snapshotStr).not.toContain('drop-indicator');
    expect(res.snapshotStr).not.toContain('contenteditable');
    expect(res.snapshotStr).not.toContain('group-selected');
    expect(res.snapshotStr).not.toContain('transform:');
  });

  test('R2: raw outerHTML diff 가 annotation-block 변경을 잡는다(normSection 은 놓친다)', async ({ page }) => {
    await loadUtils(page);
    const r = await page.evaluate(() => {
      const from = `<section class="section-block" id="sec_x"><div class="annotation-block">원래 주석</div><p>본문</p></section>`;
      const to   = `<section class="section-block" id="sec_x"><div class="annotation-block">고친 주석</div><p>본문</p></section>`;
      const d = window.historyDiff.diffSnapshots(from, to);
      // 대조: normSection 은 annotation-block 을 제거하므로 두 섹션이 «같은 해시»
      const M = window.marketMerge;
      const parse = s => new DOMParser().parseFromString(`<div>${s}</div>`, 'text/html').querySelector('.section-block');
      const hFrom = M.hash(M.normSection(parse(from)));
      const hTo   = M.hash(M.normSection(parse(to)));
      return { changed: d.changed, added: d.added, removed: d.removed, normEqual: hFrom === hTo };
    });
    expect(r.changed, 'raw diff 가 주석변경을 changed 로 잡음').toContain('sec_x');
    expect(r.added).toEqual([]);
    expect(r.removed).toEqual([]);
    expect(r.normEqual, 'normSection 은 주석변경을 못 봄(그래서 raw 여야 함)').toBe(true);
  });

  test('기본 diff: changed/added/removed 분류', async ({ page }) => {
    await loadUtils(page);
    const r = await page.evaluate(() => {
      const from = `<section class="section-block" id="a"><p>1</p></section><section class="section-block" id="b"><p>2</p></section>`;
      // a 편집, b 삭제, c 추가
      const to   = `<section class="section-block" id="a"><p>1-edited</p></section><section class="section-block" id="c"><p>3</p></section>`;
      return window.historyDiff.diffSnapshots(from, to);
    });
    expect(r.changed).toEqual(['a']);
    expect(r.added).toEqual(['c']);
    expect(r.removed).toEqual(['b']);
  });

  test('R6: noid 인덱스 키가 섹션 증감 시 «같음»으로 오분류되지 않는다', async ({ page }) => {
    await loadUtils(page);
    const r = await page.evaluate(() => {
      // from: [A(id), B(no id)]  →  to: [X(no id) 신규, A(id), B(no id)]
      const from = `<section class="section-block" id="a"><p>A</p></section>` +
                   `<section class="section-block"><p>B</p></section>`;
      const to   = `<section class="section-block"><p>X</p></section>` +
                   `<section class="section-block" id="a"><p>A</p></section>` +
                   `<section class="section-block"><p>B</p></section>`;
      const d = window.historyDiff.diffSnapshots(from, to);
      const fromKeys = window.historyDiff.parseSections(from).map(s => s.key);
      const toKeys = window.historyDiff.parseSections(to).map(s => s.key);
      return { d, fromKeys, toKeys };
    });
    // id 있는 A 는 안전하게 «같음»(changed/added/removed 아님)
    expect(r.d.changed).not.toContain('a');
    expect(r.d.added).not.toContain('a');
    expect(r.d.removed).not.toContain('a');
    // noid 키는 인덱스로 매겨져 밀림 → 물리 B 가 «같음»으로 잡히지 않는다(보수적으로 add/remove)
    expect(r.fromKeys).toEqual(['a', 'noid_1']);
    expect(r.toKeys).toEqual(['noid_0', 'a', 'noid_2']);
    expect(r.d.removed).toContain('noid_1'); // from 의 B
    expect(r.d.added).toContain('noid_0');   // to 의 X
    expect(r.d.added).toContain('noid_2');   // to 의 B(다른 키라 «추가»로 — 스코프 복원은 id 없어 미접촉)
  });
});
