/* dblclick-outside-frame-unchanged — «프레임 밖» 블럭의 더블클릭은 안 바뀐다 (프레임 더블클릭 진입 발주 §5 · 2026-10-08 지디).
 *
 * 왜: 프레임 더블클릭 = «진입»(현빈 2026-10-08 정의 · 확인 중)을 넣으면 그 손길이 block-drag.js 등 공용 자리를 지난다.
 *   블럭 종류별 더블클릭 처리기는 «정의 자리»에서 18 종이다(js/ 의 addEventListener('dblclick') 44 자리 중 캔버스 블럭 것 —
 *   block-drag.js: 글자·에셋·원형 아이콘·표·라벨그룹·아이콘텍스트·그리드·모달·말풍선 이름 / 그 밖: 스티커·캔버스·스텝·배너02·말풍선 줄·채팅·비교·월계관·그래프).
 *   ⇒ 그 변경이 «프레임 밖» 블럭까지 번지면 이 검사가 잡는다. 프레임 «안» 동작은 이 검사가 안 잰다.
 * 기준선 = 고치기 «전» 판(dev ee614986)에서 진짜 손 더블클릭 끝 상태를 잰 값을 «글자로» 박았다(같은 소스에서 기대값을 끌어오지 않는다).
 *   서명 = 블럭이 골라졌나 · 편집이 켜졌나 · 포커스가 블럭 안인가(그 요소의 첫 클래스) · 파일 고르기 창이 열렸나(filechooser 수).
 * ⛔못 재는 꼴: 배너(addBannerBlock 이 하네스에서 블럭을 «안 만들었다» — 장면 짓기 실패 · 앱 판정 아님) — 그래서 17 종 중 16.
 * 양성대조(커밋 메시지에 판·수): 문서 capture 단계에서 더블클릭을 삼키는 판 → 편집·파일창 칸이 빨강이어야 한다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* [이름, 만드는 앱 함수, 고르는 셀렉터, 기준선 서명] — 기준선은 ee614986 실측 */
const ROWS = [
  ['text',          "addTextBlock('body')",    '.text-block',          { selected: true, editing: true,  aeTag: 'tb-body',     chooser: 0 }],
  ['asset',         'addAssetBlock()',         '.asset-block',         { selected: true, editing: false, aeTag: null,          chooser: 1 }],
  ['icon-circle',   'addIconCircleBlock()',    '.icon-circle-block',   { selected: true, editing: false, aeTag: null,          chooser: 1 }],
  ['table',         'addTableBlock()',         '.table-block',         { selected: true, editing: true,  aeTag: 'TH',          chooser: 0 }],
  ['label-group',   'addLabelGroupBlock()',    '.label-group-block',   { selected: true, editing: false, aeTag: null,          chooser: 0 }],
  ['icon-text',     'addIconTextBlock()',      '.icon-text-block',     { selected: true, editing: true,  aeTag: 'itb-text',    chooser: 0 }],
  ['grid',          'addGridBlock()',          '.grid-block',          { selected: true, editing: false, aeTag: null,          chooser: 0 }],
  ['modal',         'addModalBlock()',         '.modal-block',         { selected: true, editing: true,  aeTag: 'tb-mdl-text', chooser: 0 }],
  ['speech-bubble', 'addSpeechBubbleBlock()',  '.speech-bubble-block', { selected: true, editing: true,  aeTag: 'tb-bubble',   chooser: 0 }],
  ['sticker',       'addStickerBlock()',       '.sticker-block',       { selected: true, editing: true,  aeTag: 'sticker-text', chooser: 0 }],
  ['canvas',        'addCanvasBlock()',        '.canvas-block',        { selected: true, editing: false, aeTag: null,          chooser: 1 }],
  ['step',          'addStepBlock()',          '.step-block',          { selected: true, editing: true,  aeTag: 'stb-title',   chooser: 0 }],
  ['chat',          'addChatBlock()',          '.chat-block',          { selected: true, editing: false, aeTag: null,          chooser: 0 }],
  ['comparison',    'addComparisonBlock()',    '.comparison-block',    { selected: true, editing: true,  aeTag: 'cmp-hd',      chooser: 0 }],
  ['laurel',        'addLaurelBlock()',        '.laurel-block',        { selected: true, editing: false, aeTag: null,          chooser: 0 }],
  ['graph',         'addGraphBlock()',         '.graph-block',         { selected: true, editing: false, aeTag: null,          chooser: 0 }],
];

for (const [name, call, sel, want] of ROWS) {
  test(`DU ${name} — 프레임 밖 더블클릭 끝 상태가 기준선과 같다`, async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 1100 });
    await bootApp(page);
    let chooser = 0; page.on('filechooser', () => { chooser++; });
    const info = await page.evaluate(({ call, sel }) => {
      const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
      c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sDU" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>`);
      window.rebindAll?.(); window.applyZoom?.(60);
      const sec = document.getElementById('sDU');
      window.deselectAll?.(); window._activeFrame = null; window.selectSection?.(sec);
      const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
      (0, eval)('window.' + call);
      const b = [...document.querySelectorAll('#canvas ' + sel)].find(e => !before.has(e.id));
      window.deselectAll?.(); window._activeFrame = null;
      return b ? { id: b.id, inFrame: !!b.parentElement.closest('.frame-block:not([data-text-frame])') } : null;
    }, { call, sel });
    expect(info, `[전제] ${name} 블럭이 만들어졌다`).toBeTruthy();
    expect(info.inFrame, `[전제] ${name} 는 프레임 «밖»(섹션 직속)이다`).toBe(false);
    await page.waitForTimeout(700);
    const p = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + Math.min(r.height * 0.5, 20) }; }, info.id);
    const hit = await page.evaluate(({ x, y, id }) => !!document.elementFromPoint(x, y)?.closest('#' + id), { ...p, id: info.id });
    expect(hit, `[전제] 누르는 점이 ${name} 위다`).toBe(true);
    await page.mouse.dblclick(p.x, p.y);
    await page.waitForTimeout(700);
    const got = await page.evaluate((id) => {
      const b = document.getElementById(id); const ae = document.activeElement;
      const inB = !!(ae && b && b.contains(ae) && ae !== document.body);
      return { selected: !!b?.classList.contains('selected'),
        editing: !!(b && (b.classList.contains('editing') || b.querySelector('.editing') || (inB && ae.isContentEditable))),
        aeTag: inB ? (ae.className?.toString().split(' ')[0] || ae.tagName) : null };
    }, info.id);
    expect({ ...got, chooser }, `${name}: 프레임 밖 더블클릭이 바뀌었다`).toEqual(want);
  });
}
