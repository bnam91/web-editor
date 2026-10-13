/* laurel-rich-text.dom.spec.js — 1013t1B1 laurel(월계관) 캔버스 «부분 서식» + line-host 줄 커밋의 서식 유실 고침 (2026-10-13 · S1-1013 하네스)
 *
 * ★현빈 원문(1013t1B1): 「laurel 블럭 추가시 캔버스에서 특정 텍스트 영역만 스타일 입힐 수 있으면 좋겠음」
 * ★결정 B1-a(기본값): 키보드 ⌘B/⌘I/⌘U/⌘⇧X 부분 서식 = 그리드 줄이 이미 가진 범위와 같다. 패널 부분 색·크기는 v1 밖. Figma 는 글만(B1-b).
 * ★고침 한 자리: js/blocks/line-host.js lnBeginEdit — 진입 때 sanitize 한 HTML 을 기억하고, 커밋(finish) 때 { text, textHtml } 를 보낸다
 *   (그리드 block-drag.js _gridBeginEdit/_gridEndEdit 와 같은 규약 · 허용목록 GRID_RICH_TEXT_OPTS · 빈 textHtml = gridMergeLine 이 키 삭제).
 *   laurel 은 B2 로 line-host 네 번째 주인이 됐으므로 이 한 자리가 laurel·버블·챗·비교 넷 모두의 길이다.
 *   ⇒ 플래너가 잰 기존 결함 둘도 같은 자리에서 고쳐진다:
 *     H2  — line-host 줄 ⌘B 가 커밋에서 날아간다(편집 중엔 보이는데 Esc/바깥 뒤 평문)        → HB1 · HC1 · HM1 · LR1
 *     H1a — textHtml 든 줄에 글자를 치면 모델 text 만 바뀌고 묵은 textHtml 이 새 글자를 가린다 → HB2
 *
 * ★판정자 = window._stickerHtmlHasFormatting (공용 richTextHasFormatting 그 자체 · sz7 선례) — J0 가 판정자 자신을 양·음 대조한다.
 * ⛔고정 대기 0 — waitForFunction / expect.poll 로 «재는 그 값»을 기다린다.
 *
 * 음성대조(1회 실측 · 생성기 B1): line-host.js finish 의 `host.previewLine(hit.r, hit.c, hit.li, { text, textHtml });`
 *   를 `{ text }` 로 되돌리면 → 실측 2026-10-13: 11 failed / 5 passed — 빨강 LR1×4·LR2·LR3·LR6·HB1·HB2·HC1·HM1 ·
 *   초록(이 깨뜨림과 무관한 칸) J0·LR1b·LR4·LR5·LR7. 되돌린 뒤 cmp 같음.
 * LR8·LR9(이벨류 지적 뒤 · 1회 실측 2026-10-13 · 25칸 판):
 *   · _lnReadHtml 의 richTextBlocksToBreaks(raw) 를 raw 로(블럭 경계 펴기 뺌) → 8 failed(LR8 네 주인 × 2줄·3줄 전부) / 17 passed
 *   · _lnReadHtml 의 sanitize 를 건너뜀(펴기만) → 1 failed(LR9) / 24 passed · 둘 다 되돌린 뒤 cmp 같음.
 *
 * 실행: bash run-test.sh dom tests/dom/laurel-rich-text.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = '<div class="section-block" data-section="1" id="sR"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>';
const TXT = 'AAABBBCCC';

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate((sec) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', sec);
    window.rebindAll?.(); window.applyZoom?.(100);
    window.deselectAll?.(); window.selectSection(document.getElementById('sR'));
  }, SEC);
  await page.waitForFunction(() => window.currentZoom === 100 && !!document.getElementById('sR'));
  return errs;
}

/* 블럭 넣기(준비 · 앱 입구 함수) — 넣은 블럭 id. ⛔재는 대상이 아니다. */
async function addBlock(page, kind, { deselect = true } = {}) {
  const id = await page.evaluate(([kind, deselect]) => {
    const sec = document.getElementById('sR');
    const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
    window.deselectAll?.(); window.selectSection(sec);
    if (kind === 'laurel') window.addLaurelBlock({});
    else if (kind === 'bubble') window.addSpeechBubbleBlock('left');
    else if (kind === 'chat') window.addChatBlock({ messages: [{ text: '첫 메시지', align: 'left' }] });
    else if (kind === 'cmp') window.addComparisonBlock({ cols: [
      { title: 'A', rows: [{ type: 'text', text: 'a0' }] }, { title: 'B', rows: [{ type: 'text', text: 'b0' }] }], featured: 1 });
    else if (kind === 'grid') window.addGridBlock({});
    const cls = { laurel: 'laurel-block', bubble: 'speech-bubble-block', chat: 'chat-block', cmp: 'comparison-block', grid: 'grid-block' }[kind];
    const fresh = [...document.querySelectorAll(`#sR .${cls}`)].filter(e => !before.has(e.id));
    const b = fresh.pop();
    if (deselect) window.deselectAll?.();
    b?.scrollIntoView({ block: 'center' });
    return b ? b.id : null;
  }, [kind, deselect]);
  expect(id, `전제 — ${kind} 블럭이 들어갔다`).toBeTruthy();
  return id;
}

/* 주인별 «첫 줄» 자리(글자 요소)와 모델 읽기 */
const KIND = {
  laurel: { sel: (id) => `#${id} .ln-row[data-ln-m="0"][data-ln="0"] > .grd-line`,
            line: (b) => JSON.parse(b.dataset.cells || '[]')[0]?.lines?.[0] ?? null },
  bubble: { sel: (id) => `#${id} .ln-row[data-ln="0"] > .grd-line`,
            line: (b) => (b.dataset.lines ? JSON.parse(b.dataset.lines)[0] : null) },
  chat:   { sel: (id) => `#${id} .ln-row[data-ln-m="0"][data-ln="0"] > .grd-line`,
            line: (b) => JSON.parse(b.dataset.messages || '[]')[0]?.lines?.[0] ?? null },
  cmp:    { sel: (id) => `#${id} .cmp-row[data-col-idx="0"][data-row-idx="0"] > .ln-row[data-ln="0"] > .grd-line`,
            line: (b) => window.getComparisonCols(b.dataset)[0]?.rows?.[0]?.lines?.[0] ?? null },
};

/* 모델(저장 꼴) + 렌더 상태 한 벌 */
const state = (page, kind, id) => page.evaluate(([kind, id, selSrc, lineSrc]) => {
  const b = document.getElementById(id);
  if (!b) return { err: 'block 이 없다' };
  const sel = (0, eval)(selSrc)(id); const lineOf = (0, eval)(lineSrc);
  const line = lineOf(b);
  const el = document.querySelector(sel);
  const J = window._stickerHtmlHasFormatting;
  return {
    text: line ? (line.text ?? null) : null,
    textHtml: line ? (line.textHtml ?? null) : null,
    hasKey: !!(line && Object.prototype.hasOwnProperty.call(line, 'textHtml')),
    fmtStored: J ? J(line ? (line.textHtml || '') : '') : null,
    rendered: el ? el.innerHTML : null,
    shown: el ? el.innerText : null,
    fmtRendered: el && J ? J(el.innerHTML) : null,
    editing: b.classList.contains('editing'),
    ce: el ? el.getAttribute('contenteditable') : null,
  };
}, [kind, id, KIND[kind].sel.toString(), KIND[kind].line.toString()]);

/* 더블클릭(줄 글자 편집 = line-host lnBeginEdit) → 전체 고르기 → 타이핑 → 끝 3글자 → (키) → Esc 커밋.
   ★각 단계의 전제를 단언한다(편집에 들어갔나 · 선택이 섰나 · 편집 중 서식이 생겼나). */
async function editTail3(page, kind, id, keys, { type = TXT } = {}) {
  const sel = KIND[kind].sel(id);
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel);
  const r = await waitStableRect(page, sel);
  const hit = await page.evaluate(([x, y, s]) => { const e = document.elementFromPoint(x, y); const w = document.querySelector(s);
    if (e && w && (e === w || w.contains(e))) return true;
    return JSON.stringify({ x, y, e: String(e?.outerHTML || e).slice(0, 100) }); }, [r.cx, r.cy, sel]);
  expect(hit, `전제 — 누르는 점이 ${sel} 위`).toBe(true);
  await page.mouse.dblclick(r.cx, r.cy);
  await page.waitForFunction((s) => document.querySelector(s)?.getAttribute('contenteditable') === 'true', sel);
  expect(await page.evaluate((i) => document.getElementById(i).classList.contains('editing'), id), '전제 — line-host 편집기(블럭 .editing)').toBe(true);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(type);
  await page.waitForFunction(([s, t]) => document.querySelector(s)?.innerText === t, [sel, type]);
  await page.keyboard.press('End');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft');
  await page.waitForFunction((t) => getSelection().toString() === t, type.slice(-3));
  for (const k of keys) await page.keyboard.press(k);
  let live = null;
  if (keys.length) {
    await page.waitForFunction((s) => window._stickerHtmlHasFormatting?.(document.querySelector(s)?.innerHTML || '') === true, sel);
    live = await page.evaluate((s) => document.querySelector(s).innerHTML, sel);
  }
  await page.keyboard.press('Escape');                    // ★line-host onKey → blur → finish(커밋)
  await page.waitForFunction(([i, s]) => !document.getElementById(i).classList.contains('editing') && document.querySelector(s)?.getAttribute('contenteditable') !== 'true', [id, sel]);
  return live;
}

/* ══════════════════════════════════════════════════════════════════ */

test('J0 판정자 대조 — 공용 판정자가 살아 있고(양성 <b>) 평문엔 거짓(음성)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => ({ pos: window._stickerHtmlHasFormatting?.('<b>x</b>') ?? null, neg: window._stickerHtmlHasFormatting?.('x') ?? null,
    span: window._stickerHtmlHasFormatting?.('<span style="font-weight: normal;">x</span>') ?? null }));
  expect(r.pos, '판정자가 없다 — 아래 칸들은 아무것도 안 잰다').toBe(true);
  expect(r.neg, '판정자가 평문에도 참 — 아래 「서식이 산다」가 공짜다').toBe(false);
  expect(r.span, 'laurel 기본 700 에서 ⌘B 가 내는 꼴(font-weight normal span)도 서식이다').toBe(true);
  expect(errs).toEqual([]);
});

test.describe('laurel — 캔버스 부분 서식(B1)', () => {
  for (const [label, keys] of [['B ⌘B', ['ControlOrMeta+b']], ['I ⌘I', ['ControlOrMeta+i']],
                               ['U ⌘U', ['ControlOrMeta+u']], ['S ⌘⇧X', ['ControlOrMeta+Shift+x']]]) {
    test(`LR1 ${label} — 끝 3글자만 서식 · Esc 커밋 뒤 모델 textHtml 에 살고 렌더에 산다 · 평문 text 짝`, async ({ page }) => {
      const errs = await setup(page);
      const id = await addBlock(page, 'laurel');
      const s0 = await state(page, 'laurel', id);
      expect(s0.hasKey, `전제 — 새 laurel 줄엔 textHtml 이 없다 ${JSON.stringify(s0)}`).toBe(false);
      const live = await editTail3(page, 'laurel', id, keys);
      const s = await state(page, 'laurel', id);
      console.log(`  LR1 ${label}:`, JSON.stringify({ live, ...s }));
      expect(s.text, '평문 text 도 같이(짝)').toBe(TXT);
      expect(s.fmtStored, `${label} 가 모델 textHtml 에 안 남았다(H2 꼴) ${JSON.stringify(s)}`).toBe(true);
      expect(s.fmtRendered, `${label} 가 렌더에서 사라졌다 ${JSON.stringify(s)}`).toBe(true);
      expect(s.shown, '보이는 글자 그대로').toBe(TXT);
      expect(s.rendered.startsWith('AAABBB'), `앞 6글자는 서식 밖 — 범위만 ${s.rendered}`).toBe(true);
      expect(errs).toEqual([]);
    });
  }

  test('LR1b 서식 없이 글자만 — textHtml 키가 안 생긴다(평문 경로 그대로)', async ({ page }) => {
    const errs = await setup(page);
    const id = await addBlock(page, 'laurel');
    await editTail3(page, 'laurel', id, []);
    const s = await state(page, 'laurel', id);
    expect(s.text).toBe(TXT);
    expect(s.hasKey, `서식이 없는데 textHtml 이 생겼다 ${JSON.stringify(s)}`).toBe(false);
    expect(s.rendered, '평문 렌더(마크업 0)').toBe(TXT);
    expect(errs).toEqual([]);
  });

  test('LR7 굵기 700 줄의 ⌘B = 「부분 굵게 끄기」(font-weight normal span) — 그리드 h1(700) 줄과 같은 꼴', async ({ page }) => {
    /* ⑴ laurel 기본 줄(700) */
    const errs = await setup(page);
    const id = await addBlock(page, 'laurel');
    const w = await page.evaluate((s) => getComputedStyle(document.querySelector(s)).fontWeight, KIND.laurel.sel(id));
    expect(w, '전제 — laurel 기본 줄 굵기 700').toBe('700');
    const liveL = await editTail3(page, 'laurel', id, ['ControlOrMeta+b']);
    expect(errs).toEqual([]);
    /* ⑵ 그리드 h1(700) 줄 — 새로 띄운 앱에서 같은 키 순서(그리드 편집기 _gridBeginEdit · sz7 G1 과 같은 준비: 섹션 고른 채) */
    const errs2 = await setup(page);
    const gid = await addBlock(page, 'grid', { deselect: false });
    await page.evaluate((g) => { const b = document.getElementById(g); const cols = JSON.parse(b.dataset.cols);   // 준비(G2 꼴 — 저장 자리 + 렌더)
      cols[0].lines = [{ type: 'h1', text: 'x' }]; b.dataset.cols = JSON.stringify(cols); window.renderGridBlock(b); }, gid);
    const gsel = `#${gid} .grd-line`;
    await page.waitForFunction((s) => !!document.querySelector(s) && getComputedStyle(document.querySelector(s)).fontWeight === '700', gsel);
    const gr = await waitStableRect(page, gsel);
    await page.mouse.dblclick(gr.cx, gr.cy);
    await page.waitForFunction((s) => document.querySelector(s)?.getAttribute('contenteditable') === 'true', gsel);
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(TXT);
    await page.keyboard.press('End');
    for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft');
    await page.waitForFunction(() => getSelection().toString() === 'CCC');
    await page.keyboard.press('ControlOrMeta+b');
    await page.waitForFunction((s) => window._stickerHtmlHasFormatting?.(document.querySelector(s)?.innerHTML || '') === true, gsel);
    const liveG = await page.evaluate((s) => document.querySelector(s).innerHTML, gsel);
    console.log('  LR7:', JSON.stringify({ liveL, liveG }));
    const shape = (h) => h.replace(/\s+/g, '');
    expect(shape(liveL), 'laurel = 「굵게 끄기」 span').toBe('AAABBB<spanstyle="font-weight:normal;">CCC</span>');
    expect(shape(liveG), '그리드 h1 줄도 같은 꼴(같은 규칙 — 브라우저 execCommand bold)').toBe(shape(liveL));
    expect(errs2).toEqual([]);
  });

  test('LR2 저장 왕복 — serializeProject → 재기동 → applyProjectData 뒤에도 부분 서식이 산다', async ({ page }) => {
    await setup(page);
    const id = await addBlock(page, 'laurel');
    await editTail3(page, 'laurel', id, ['ControlOrMeta+i']);
    const before = await state(page, 'laurel', id);
    expect(before.fmtStored, `전제 — 저장 전 textHtml ${JSON.stringify(before)}`).toBe(true);
    const snap = await page.evaluate(() => { window.flushCurrentPage?.(); return window.serializeProject(); });
    expect(/textHtml/.test(snap), '저장본에 textHtml 이 실렸다(data-cells JSON 안)').toBe(true);
    const errs2 = await bootApp(page);
    await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
    await page.waitForFunction((s) => !!document.querySelector(s), KIND.laurel.sel(id));
    const after = await state(page, 'laurel', id);
    console.log('  LR2:', JSON.stringify(after));
    expect(after.textHtml, '다시 연 뒤 textHtml 바이트 같음').toBe(before.textHtml);
    expect(after.fmtRendered, '다시 연 뒤 렌더에 서식').toBe(true);
    expect(after.shown).toBe(TXT);
    expect(errs2).toEqual([]);
  });

  test('LR3 ⌘Z 한 번 = 편집 전 모델(글자·서식 둘 다)로', async ({ page }) => {
    const errs = await setup(page);
    const id = await addBlock(page, 'laurel');
    const s0 = await state(page, 'laurel', id);
    const pos0 = await page.evaluate(() => window.getHistoryTip?.().pos);
    await editTail3(page, 'laurel', id, ['ControlOrMeta+b']);
    const s1 = await state(page, 'laurel', id);
    const pos1 = await page.evaluate(() => window.getHistoryTip?.().pos);
    expect(s1.fmtStored, `전제 — 커밋됐다 ${JSON.stringify(s1)}`).toBe(true);
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await state(page, 'laurel', id)).text, '⌘Z 한 번 — 글자가 편집 전으로').toBe(s0.text);
    const s2 = await state(page, 'laurel', id);
    console.log('  LR3:', JSON.stringify({ pos0, pos1, s0: s0.text, s2 }));
    expect(s2.hasKey, `⌘Z 한 번 — textHtml 도 없다 ${JSON.stringify(s2)}`).toBe(false);
    expect(s2.shown, '화면도 편집 전').toBe(s0.text);
    expect(s2.ce, '되돌린 화면에 편집 흔적(contenteditable) 없음').not.toBe('true');
    expect(errs).toEqual([]);
  });

  test('LR4 글만 쓰는 자(MCP editLine · AI 채움)는 묵은 textHtml 을 걷는다 — 새 글이 가려지지 않는다', async ({ page }) => {
    const errs = await setup(page);
    const id = await addBlock(page, 'laurel');
    const seed = () => page.evaluate((i) => window.updateLaurelBlockRaw(i, { cellLines: { cell: 0, lines: [
      { type: 'h2', text: 'XXXYYY', textHtml: '<b>XXX</b>YYY' }] } }, { noHistory: true }), id);
    await seed();
    const s0 = await state(page, 'laurel', id);
    expect(s0.fmtRendered, `전제 — 서식 줄이 그려졌다 ${JSON.stringify(s0)}`).toBe(true);
    /* ⑴ MCP 길 = updateLaurelBlock{editLine{text}} (main 의 _invokeRendererUpdateLaurelBlock 이 부르는 그 문) */
    const r1 = await page.evaluate((i) => window.updateLaurelBlock(i, { editLine: { cellIndex: 0, lineIndex: 0, text: '새 글 MCP' } }), id);
    expect(r1 && r1.ok, `editLine ok ${JSON.stringify(r1)}`).toBe(true);
    const s1 = await state(page, 'laurel', id);
    expect([s1.hasKey, s1.shown], 'MCP — textHtml 걷힘 · 새 글이 보인다').toEqual([false, '새 글 MCP']);
    /* ⑵ AI 채움 = applyAIReplacements(lrl 슬롯) */
    await seed();
    const ok2 = await page.evaluate((i) => { const sec = document.getElementById('sR');
      window.applyAIReplacements(sec, [{ id: `lrl:${i}:0:0`, text: '새 글 AI' }], [], {}); return true; }, id);
    expect(ok2).toBe(true);
    await expect.poll(async () => (await state(page, 'laurel', id)).shown).toBe('새 글 AI');
    const s2 = await state(page, 'laurel', id);
    expect(s2.hasKey, `AI — textHtml 걷힘 ${JSON.stringify(s2)}`).toBe(false);
    /* ⑶ 패널: laurel 패널엔 줄 «글자» 입력칸이 없다(B2 에서 공용 줄 절로 — 글자는 캔버스 편집만) ⇒ 잴 writer 없음(기록) */
    await page.evaluate((i) => window.selectBlock?.(i), id);
    const panelTextInputs = await page.evaluate(() => document.querySelectorAll('#panel-right .lrl-line-text, #panel-right input[id*="line-text"]').length);
    expect(panelTextInputs, '패널 줄 글자 입력칸 0(그러니 패널 글-만-쓰기 writer 없음)').toBe(0);
    expect(errs).toEqual([]);
  });

  test('LR5 저장본 변조 — 렌더가 매번 다시 거른다(script·on*·url(·a 걷힘) · 허용 <b> 는 산다', async ({ page }) => {
    const errs = await setup(page);
    const id = await addBlock(page, 'laurel');
    const DIRTY = 'AAA<script>window.__pwned=1</script><span style="background-color:url(x)" onerror="window.__pwned=2">BBB</span>'
                + '<img src=x onerror="window.__pwned=3"><a href="javascript:void 0">CCC</a><b>DDD</b>';
    await page.evaluate(([i, h]) => {   // ★저장본 자리에 직접(커밋 길을 안 탄다 — 렌더가 거르는지 재는 칸)
      const b = document.getElementById(i);
      b.dataset.cells = JSON.stringify([{ lines: [{ type: 'body', text: 'AAABBBCCCDDD', textHtml: h }], leafColor: '#1a1a1a', gap: 24, height: 140 }]);
      window.renderLaurelBlock(b);
    }, [id, DIRTY]);
    await page.waitForFunction((s) => /DDD/.test(document.querySelector(s)?.innerHTML || ''), KIND.laurel.sel(id));
    const s = await state(page, 'laurel', id);
    const pwned = await page.evaluate(() => window.__pwned ?? null);
    console.log('  LR5:', JSON.stringify({ rendered: s.rendered, pwned }));
    for (const [name, re] of [['script', /<script|__pwned/i], ['on*', /onerror/i], ['url(', /url\(/i], ['a/href', /<a\b|href|javascript/i], ['img', /<img/i]]) {
      expect(re.test(s.rendered), `«${name}» 가 렌더에 살았다: ${s.rendered}`).toBe(false);
    }
    expect(pwned, '변조 코드가 실행됐다').toBeNull();
    expect(/<b\b/i.test(s.rendered), `허용된 <b> 까지 걷혔다 — 위 「없다」가 공짜 ${s.rendered}`).toBe(true);
    expect(errs).toEqual([]);
  });

  test('LR6 Figma 내보내기 — 글만 간다(B1-b): laurel 줄 = 평문 text · textHtml·마크업 0', async ({ page }) => {
    const errs = await setup(page);
    const id = await addBlock(page, 'laurel');
    await editTail3(page, 'laurel', id, ['ControlOrMeta+b']);
    const s = await state(page, 'laurel', id);
    expect(s.fmtStored, `전제 — 모델엔 서식이 있다 ${JSON.stringify(s)}`).toBe(true);
    const j = await page.evaluate((want) => {
      let hit = null;
      const walk = (o) => { if (hit || !o || typeof o !== 'object') return; if (o.type === 'laurel' && o.id === want) { hit = o; return; } for (const k in o) walk(o[k]); };
      window.flushCurrentPage?.();
      walk(window.buildFigmaExportJSON(null));
      return hit;
    }, id);
    expect(j, '전제 — 내보내기에 그 laurel 이 있다').not.toBe(null);
    const txt = JSON.stringify(j.cells);
    console.log('  LR6:', txt);
    expect(j.cells[0].lines[0].text, '글 = 평문').toBe(TXT);
    expect(/textHtml|<b|<span|font-weight:\s*normal/i.test(txt), `서식 마크업이 샜다 ${txt}`).toBe(false);
    expect(errs).toEqual([]);
  });
});

/* ══ LR8 — 한 줄 안 줄바꿈(Enter) + 부분 서식 (이벨류 지적 · 3f017a43 결함) ══════════════════════════════
 * 몸짓: 더블클릭 → 전체 고르기 → 'AAABBB' → Enter → 'CCC' → CCC 고르기 → ⌘B → Esc.
 * 결함: text 'AAABBB\nCCC' 는 사는데 textHtml 이 'AAABBB<b>CCC</b>'(줄바꿈 없음) — Chrome 의 Enter <div> 를 sanitize 가 언랩만 해서.
 *   렌더가 textHtml 을 그리므로 화면이 한 줄이 된다(저장 왕복 뒤도). ⇒ line-host _lnReadHtml 이 거르기 전에 블럭 경계를 <br> 로 편다.
 * 잰다: 네 주인(laurel·버블·챗·비교) 각각 — text = 'AAABBB\nCCC' · textHtml 에 <br> 와 서식 · 렌더 2줄(글자 사각형 윗변 수) · 저장 왕복 뒤 같음. + 3줄. */
async function prepOwner(page, kind, id) {
  if (kind === 'bubble') await page.evaluate((i) => window.updateSpeechBubbleBlock(i, { lines: [{ type: 'body', text: 'plain' }] }), id);
  if (kind === 'chat') await page.evaluate((i) => window.updateChatBlock(i, { editMessage: { index: 0, lines: [{ type: 'body', text: 'plain' }] } }), id);
  if (kind === 'cmp') await page.evaluate((i) => window.updateComparisonBlock(i, { rowLines: { col: 0, row: 0, lines: [{ type: 'body', text: 'plain' }] } }), id);
  await page.waitForFunction((s) => !!document.querySelector(s), KIND[kind].sel(id));
}
/* parts = 줄들 · 마지막 줄 끝 3글자에 ⌘B */
async function editMultiline(page, kind, id, parts) {
  const sel = KIND[kind].sel(id);
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel);
  const r = await waitStableRect(page, sel);
  await page.mouse.dblclick(r.cx, r.cy);
  await page.waitForFunction((s) => document.querySelector(s)?.getAttribute('contenteditable') === 'true', sel);
  await page.keyboard.press('ControlOrMeta+a');
  for (let i = 0; i < parts.length; i++) {
    if (i) { await page.keyboard.press('End'); await page.keyboard.press('Enter'); }
    await page.keyboard.type(parts[i]);
  }
  const want = parts.join('\n');
  await page.waitForFunction(([s, t]) => (document.querySelector(s)?.innerText || '').replace(/\n+$/, '') === t, [sel, want]);
  await page.keyboard.press('End');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft');
  await page.waitForFunction((t) => getSelection().toString() === t, parts[parts.length - 1].slice(-3));
  await page.keyboard.press('ControlOrMeta+b');
  await page.waitForFunction((s) => window._stickerHtmlHasFormatting?.(document.querySelector(s)?.innerHTML || '') === true, sel);
  const live = await page.evaluate((s) => document.querySelector(s).innerHTML, sel);
  await page.keyboard.press('Escape');
  await page.waitForFunction(([i, s]) => !document.getElementById(i).classList.contains('editing') && document.querySelector(s)?.getAttribute('contenteditable') !== 'true', [id, sel]);
  return live;
}
const renderedLines = (page, kind, id) => page.evaluate((s) => {
  const el = document.querySelector(s); if (!el) return null;
  /* 보이는 줄 수 = 글자 조각(텍스트 노드) 사각형들의 서로 다른 «윗변» 수 — 칸 늘임·패딩과 무관(비교 칸은 줄 요소가 칸 높이로 늘어난다) */
  const tops = new Set();
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let t = tw.nextNode(); t; t = tw.nextNode()) {
    if (!t.nodeValue.trim()) continue;
    const rg = document.createRange(); rg.selectNodeContents(t);
    for (const q of rg.getClientRects()) if (q.width > 0) tops.add(Math.round(q.top));
  }
  return { byHeight: tops.size, tops: [...tops], ws: getComputedStyle(el).whiteSpace };
}, KIND[kind].sel(id));

test.describe('LR8 줄바꿈 + 부분 서식 — 네 주인 같은 길', () => {
  for (const kind of ['laurel', 'bubble', 'chat', 'cmp']) {
    for (const parts of [['AAABBB', 'CCC'], ['AAA', 'BBB', 'CCC']]) {
      test(`LR8 ${kind} ${parts.length}줄 — text·textHtml 줄 수 같음 · 렌더 ${parts.length}줄 · 저장 왕복 뒤 같음`, async ({ page }) => {
        const errs = await setup(page);
        const id = await addBlock(page, kind);
        await prepOwner(page, kind, id);
        const live = await editMultiline(page, kind, id, parts);
        const s = await state(page, kind, id);
        const n = parts.length;
        const brs = (h) => ((h || '').match(/<br\s*\/?>/gi) || []).length;
        const rl = await renderedLines(page, kind, id);
        console.log(`  LR8 ${kind} ${n}:`, JSON.stringify({ live, text: s.text, textHtml: s.textHtml, rendered: s.rendered, rl }));
        expect(s.text, 'text = 줄바꿈 든 평문').toBe(parts.join('\n'));
        expect(s.fmtStored, `서식이 모델에 ${JSON.stringify(s)}`).toBe(true);
        expect(brs(s.textHtml), `textHtml 의 줄바꿈 수 = ${n - 1} (text 와 같은 줄 수) — ${s.textHtml}`).toBe(n - 1);
        expect(/<div|<p\b/i.test(s.textHtml), `블럭 태그가 남지 않는다 ${s.textHtml}`).toBe(false);
        expect(s.shown.replace(/\n+$/, ''), '보이는 글 = text').toBe(parts.join('\n'));
        expect(rl.byHeight, `렌더 ${n}줄(글자 사각형 윗변 수) ${JSON.stringify(rl)}`).toBe(n);
        /* 저장 왕복 */
        const snap = await page.evaluate(() => { window.flushCurrentPage?.(); return window.serializeProject(); });
        const errs2 = await bootApp(page);
        await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
        await page.waitForFunction((q) => !!document.querySelector(q), KIND[kind].sel(id));
        await page.evaluate((q) => document.querySelector(q)?.scrollIntoView({ block: 'center' }), KIND[kind].sel(id));
        const s2 = await state(page, kind, id);
        const rl2 = await renderedLines(page, kind, id);
        expect([s2.text, s2.textHtml], '다시 연 뒤 모델 같음').toEqual([s.text, s.textHtml]);
        expect(rl2.byHeight, `다시 연 뒤 렌더 ${n}줄 ${JSON.stringify(rl2)}`).toBe(n);
        expect(errs).toEqual([]);
        expect(errs2).toEqual([]);
      });
    }
  }
});

/* ══ LR9 — 커밋 쪽 거르기(_lnReadHtml 의 sanitize)를 지키는 칸 (이벨류 지적 · 무가드) ═══════════════════════
 * 편집 중 contenteditable 에 위험 마크업을 넣고(붙여넣기·확장 등이 낼 수 있는 꼴) 커밋 → 저장된 textHtml(모델 · serializeProject)에 없다.
 * ⛔렌더 쪽 재-sanitize(LR5)와 다른 자리다 — 렌더가 걷어도 «저장본»에 남으면 다른 소비자(내보내기 등)로 샌다. */
test('LR9 편집 중 끼운 위험 마크업 — 커밋된 textHtml·저장본에 없다 · 허용 <b> 는 산다', async ({ page }) => {
  const errs = await setup(page);
  const id = await addBlock(page, 'laurel');
  const sel = KIND.laurel.sel(id);
  const r = await waitStableRect(page, sel);
  await page.mouse.dblclick(r.cx, r.cy);
  await page.waitForFunction((s) => document.querySelector(s)?.getAttribute('contenteditable') === 'true', sel);
  await page.evaluate((s) => {   // ★img 는 src 없이(로드·onerror 실행 0) — 재는 것은 «저장되나»다
    document.querySelector(s).innerHTML = 'AAA<img onerror="window.__p9=1"><b onclick="window.__p9=2">BBB</b>'
      + '<span style="background-color:url(x);color:#ff0000">CCC</span><script>window.__p9=3</script><a href="javascript:void 0">DDD</a>';
  }, sel);
  await page.keyboard.press('Escape');
  await page.waitForFunction((i) => !document.getElementById(i).classList.contains('editing'), id);
  const s = await state(page, 'laurel', id);
  const saved = await page.evaluate((i) => {
    window.flushCurrentPage?.();
    const snap = JSON.parse(window.serializeProject());
    const doc = new DOMParser().parseFromString(snap.pages.map(p => p.canvas || '').join(''), 'text/html');
    return doc.getElementById(i)?.dataset.cells || null;
  }, id);
  console.log('  LR9:', JSON.stringify({ textHtml: s.textHtml, saved }));
  expect(saved, '전제 — 저장본에 그 블럭').toBeTruthy();
  expect(s.fmtStored, `전제 — 서식이 커밋됐다 ${JSON.stringify(s)}`).toBe(true);
  for (const [name, re] of [['img', /<img/i], ['on*', /onerror|onclick/i], ['script', /<script|__p9/i], ['url(', /url\(/i], ['a/href', /<a\b|href|javascript/i]]) {
    expect(re.test(s.textHtml || ''), `«${name}» 가 모델 textHtml 에 저장됐다: ${s.textHtml}`).toBe(false);
    expect(re.test(saved), `«${name}» 가 저장본 data-cells 에 들어갔다`).toBe(false);
  }
  expect(/<b>BBB<\/b>/.test(s.textHtml), `허용 <b> 까지 걷혔다 — 위 「없다」가 공짜 ${s.textHtml}`).toBe(true);
  expect(/color:#ff0000/.test(s.textHtml), `허용 색 style 까지 걷혔다 ${s.textHtml}`).toBe(true);
  expect(errs).toEqual([]);
});

test.describe('line-host 다른 주인 — 같은 길(버블 H2·H1a 고침 · 챗 · 비교)', () => {
  test('HB1 버블 — 평문 줄 ⌘B 가 커밋 뒤에도 산다(H2 뒤집기)', async ({ page }) => {
    const errs = await setup(page);
    const id = await addBlock(page, 'bubble');
    await page.evaluate((i) => window.updateSpeechBubbleBlock(i, { lines: [{ type: 'body', text: 'plain' }] }), id);
    await page.waitForFunction((s) => document.querySelector(s)?.innerText === 'plain', KIND.bubble.sel(id));
    await editTail3(page, 'bubble', id, ['ControlOrMeta+b']);
    const s = await state(page, 'bubble', id);
    console.log('  HB1:', JSON.stringify(s));
    expect(s.text).toBe(TXT);
    expect(s.fmtStored, `버블 줄 ⌘B 가 모델에 안 남았다 ${JSON.stringify(s)}`).toBe(true);
    expect(s.fmtRendered, '렌더에 서식').toBe(true);
    expect(errs).toEqual([]);
  });

  test('HB2 버블 — 서식 든 줄 끝에 글자를 치면 새 글자가 보인다(H1a 뒤집기 · 서식도 산다)', async ({ page }) => {
    const errs = await setup(page);
    const id = await addBlock(page, 'bubble');
    await page.evaluate((i) => window.updateSpeechBubbleBlock(i, { lines: [{ type: 'body', text: 'XXXYYY', textHtml: '<b>XXX</b>YYY' }] }), id);
    const sel = KIND.bubble.sel(id);
    await page.waitForFunction((s) => /<b>XXX<\/b>YYY/.test(document.querySelector(s)?.innerHTML || ''), sel);
    const r = await waitStableRect(page, sel);
    await page.mouse.dblclick(r.cx, r.cy);
    await page.waitForFunction((s) => document.querySelector(s)?.getAttribute('contenteditable') === 'true', sel);
    await page.keyboard.press('End');
    await page.keyboard.type('ZZ');
    await page.waitForFunction((s) => document.querySelector(s)?.innerText === 'XXXYYYZZ', sel);
    await page.keyboard.press('Escape');
    await page.waitForFunction((i) => !document.getElementById(i).classList.contains('editing'), id);
    const s = await state(page, 'bubble', id);
    console.log('  HB2:', JSON.stringify(s));
    expect(s.text, '모델 글자').toBe('XXXYYYZZ');
    expect(s.shown, `친 글자가 화면에서 사라졌다(묵은 textHtml 이 가림 — H1a) ${JSON.stringify(s)}`).toBe('XXXYYYZZ');
    expect(/ZZ/.test(s.textHtml || ''), `textHtml 이 새 글자를 안 담았다 ${JSON.stringify(s)}`).toBe(true);
    expect(s.fmtStored, '앞 굵게는 산다').toBe(true);
    expect(errs).toEqual([]);
  });

  test('HC1 챗 — 메시지 줄 ⌘B 가 커밋 뒤에도 산다', async ({ page }) => {
    const errs = await setup(page);
    const id = await addBlock(page, 'chat');
    await page.evaluate((i) => window.updateChatBlock(i, { editMessage: { index: 0, lines: [{ type: 'body', text: 'plain' }] } }), id);
    await page.waitForFunction((s) => document.querySelector(s)?.innerText === 'plain', KIND.chat.sel(id));
    await editTail3(page, 'chat', id, ['ControlOrMeta+u']);
    const s = await state(page, 'chat', id);
    console.log('  HC1:', JSON.stringify(s));
    expect(s.text).toBe(TXT);
    expect(s.fmtStored, `챗 줄 ⌘U 가 모델에 안 남았다 ${JSON.stringify(s)}`).toBe(true);
    expect(s.fmtRendered).toBe(true);
    expect(errs).toEqual([]);
  });

  test('HM1 비교 — 칸 줄 ⌘B 가 커밋 뒤에도 산다', async ({ page }) => {
    const errs = await setup(page);
    const id = await addBlock(page, 'cmp');
    const ok = await page.evaluate((i) => window.updateComparisonBlock(i, { rowLines: { col: 0, row: 0, lines: [{ type: 'body', text: 'plain' }] } }), id);
    expect(ok && ok.ok, `전제 — 비교 칸에 줄 ${JSON.stringify(ok)}`).toBe(true);
    await page.waitForFunction((s) => document.querySelector(s)?.innerText === 'plain', KIND.cmp.sel(id));
    await editTail3(page, 'cmp', id, ['ControlOrMeta+b']);
    const s = await state(page, 'cmp', id);
    console.log('  HM1:', JSON.stringify(s));
    expect(s.text).toBe(TXT);
    expect(s.fmtStored, `비교 줄 ⌘B 가 모델에 안 남았다 ${JSON.stringify(s)}`).toBe(true);
    expect(s.fmtRendered).toBe(true);
    expect(errs).toEqual([]);
  });
});
