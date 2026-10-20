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
    else if (kind === 'chat2') window.addChatBlock({ messages: [{ text: '첫 메시지', align: 'left' }, { text: '둘째', align: 'right' }] });   // HC3 — 메시지 1(오른쪽)
    else if (kind === 'cmp') window.addComparisonBlock({ cols: [
      { title: 'A', rows: [{ type: 'text', text: 'a0' }] }, { title: 'B', rows: [{ type: 'text', text: 'b0' }] }], featured: 1 });
    else if (kind === 'grid') window.addGridBlock({});
    const cls = { laurel: 'laurel-block', bubble: 'speech-bubble-block', chat: 'chat-block', chat2: 'chat-block', cmp: 'comparison-block', grid: 'grid-block' }[kind];
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

/* ══ LR10 — 패널 «부분 색» (1013t1B1 반려 ① · 태양 게이트) ══════════════════════════════════════════════
 * 발주: 「캔버스에서 laurel 글의 «특정 영역만» 스타일(굵게·★색 등 — ★텍스트 블럭의 범위 서식과 같은 길)」.
 * 몸짓: 줄 더블클릭 → 'AAABBBCCC' → 끝 3글자 ⇧← → 우측 패널 그 줄 Fill 글자색 스와치를 «마우스로» 누른다(편집 blur → 세움)
 *       → 피커 값 #ff0000 input·change(피커 팝업이 쏘는 것과 같은 이벤트) → 고른 3글자만 빨강.
 * 고침: line-host.js lnBeginEdit onBlur(패널로 가는 blur = parkEditing · flush=finish keepPanel) · lnApplyLinePartialColor(저장 선택 →
 *       window.applyColorToSelection → textHtml) · prop-grid _grdWireTypo applyColor 의 partialColor 갈래 ·
 *       _text-selection.js RETAIN 에 .ln-row · KEEP_FOCUS 에서 줄 모드 말풍선 줄 제외.
 * J1 = 0번 실측(공용 sanitizer 가 color span 을 남기나) — 순수 함수 결과 문자열.
 * 음성대조(1회 실측 · 생성기 2026-10-13 · cp 백업/복원 · cmp 같음): prop-grid applyColor 의 `if (partialColor(cc)) return;` 한 줄 주석
 *   → 이 파일 32칸 중 6 failed / 26 passed — 빨강 LR10·LR10b·HB3·HC2·HM2·GL1.
 *   (LR10b 도 빨갛다 = 그 갈래가 «열린 편집을 먼저 커밋»도 진다 — 끊으면 줄 전체 색이 편집 중 줄을 다시 그려 화면 글자가 편집 전 「1위」로.) */
const RED = 'rgb(255, 0, 0)';
const KIND_GRID = { sel: (id) => `#${id} .grd-line[data-r="0"][data-c="0"][data-line="0"]`,
  line: (b) => { const cols = JSON.parse(b.dataset.cols || '[]'); return cols[0]?.lines?.[0] ?? null; } };

test('J1 0번 실측 — GRID_RICH_TEXT_OPTS sanitize 가 color span 을 남기고 위험 style 만 걷는다(순수 함수)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(async () => {
    const m = await import('/js/util/sanitize-rich-text.js');
    const g = await import('/js/blocks/grid-block.js');
    const O = g.GRID_RICH_TEXT_OPTS;
    const run = (h) => m.sanitizeRichTextHtml(h, O);
    return {
      hex: run('AAA<span style="color:#ff0000">CCC</span>'),
      rgb: run('AAA<span style="color: rgb(255, 0, 0);">CCC</span>'),
      rgba: run('AAA<span style="color: rgba(255, 0, 0, 0.5);">CCC</span>'),
      mixed: run('AAA<span style="background-color:url(x);color:#ff0000;position:fixed">CCC</span>'),
      varRef: run('AAA<span style="color:var(--color-x, #ff0000)">CCC</span>'),
      fmt: m.richTextHasFormatting(run('AAA<span style="color: rgb(255, 0, 0);">CCC</span>'), O),
    };
  });
  console.log('  J1:', JSON.stringify(r));
  expect(r.hex, 'hex color span 생존').toBe('AAA<span style="color:#ff0000">CCC</span>');
  expect(r.rgb, 'rgb()(브라우저 style.color 직렬화 꼴) 생존').toBe('AAA<span style="color:rgb(255, 0, 0)">CCC</span>');
  expect(r.rgba).toBe('AAA<span style="color:rgba(255, 0, 0, 0.5)">CCC</span>');
  expect(r.mixed, '위험 style(url(·position) 걷힘 · color 만 생존').toBe('AAA<span style="color:#ff0000">CCC</span>');
  expect(r.varRef, 'var() 는 걷힌다(→ 부분 적용은 대체 hex 를 쓴다)').toBe('AAA<span>CCC</span>');
  expect(r.fmt, 'color span = 서식(판정자 참)').toBe(true);
  expect(errs).toEqual([]);
});

/* 편집 들어가 'AAABBBCCC' → 끝 3글자 선택(편집은 연 채) */
async function editSelectTail3(page, sel, id) {
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel);
  const r = await waitStableRect(page, sel);
  await page.mouse.dblclick(r.cx, r.cy);
  await page.waitForFunction((s) => document.querySelector(s)?.getAttribute('contenteditable') === 'true', sel);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(TXT);
  await page.waitForFunction(([s, t]) => document.querySelector(s)?.innerText === t, [sel, TXT]);
  await page.keyboard.press('End');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft');
  await page.waitForFunction(() => getSelection().toString() === 'CCC');
  expect(await page.evaluate((i) => document.getElementById(i).classList.contains('editing'), id), '전제 — 편집 중').toBe(true);
}
/* 패널 Fill 글자색 스와치를 마우스로 누르고(편집 blur) 피커 값을 바꾼다 */
async function panelColor(page, hex, want = 'CCC') {
  const sw = await page.evaluate(() => {
    const e = document.getElementById('grd-typo-color')?.closest('.prop-color-swatch');
    if (!e) return null;
    const b = e.getBoundingClientRect();
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    const at = document.elementFromPoint(x, y);
    return { x, y, on: !!(at && (at === e || e.contains(at))) };
  });
  expect(sw, '전제 — 패널에 그 줄 Fill 글자색 스와치').not.toBeNull();
  expect(sw.on, '전제 — 누르는 점이 스와치 위').toBe(true);
  await page.mouse.click(sw.x, sw.y);
  const saved = await page.evaluate(() => window.__textSelection?.getSavedTextSelection?.()?.range?.toString() ?? null);
  expect(saved, '전제 — 패널을 눌러도 고른 글자(저장 선택)가 산다').toBe(want);
  await page.evaluate((h) => {
    const p = document.getElementById('grd-typo-color');
    p.value = h;
    p.dispatchEvent(new Event('input', { bubbles: true }));
    p.dispatchEvent(new Event('change', { bubbles: true }));
  }, hex);
}
/* 렌더된 줄에서 글자별 계산색 — 첫 글자(A)와 끝 글자(C) */
const charColors = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s); if (!el) return null;
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const out = [];
  for (let t = tw.nextNode(); t; t = tw.nextNode()) for (const ch of t.nodeValue) out.push([ch, getComputedStyle(t.parentElement).color]);
  return { first: out[0], last: out[out.length - 1], red: out.filter(x => x[1] === 'rgb(255, 0, 0)').map(x => x[0]).join(''), base: getComputedStyle(el).color };
}, sel);

async function partialColorCase(page, kind, id, K) {
  const sel = K.sel(id);
  await editSelectTail3(page, sel, id);
  const base = (await charColors(page, sel)).base;
  expect(base, '전제 — 줄 기본색이 빨강이 아니다').not.toBe(RED);
  const lineColor0 = await page.evaluate(([i, src]) => ((0, eval)(src))(document.getElementById(i))?.color ?? null, [id, K.line.toString()]);
  await panelColor(page, '#ff0000');
  if (kind === 'grid') {   // 그리드 편집기(block-drag _gridBeginEdit)는 편집 DOM 에 칠하고 «커밋 때» textHtml 로 싣는다 → 편집칸 blur 로 커밋
    /* ⚠️Esc 한 번은 열린 색 피커 팝업이 먹는다(실측 probe — 편집이 안 닫힘) ⇒ 바깥을 누른 것과 같은 blur 로 끝낸다 */
    expect(await page.evaluate((i) => document.getElementById(i).classList.contains('editing'), id), '전제 — 그리드는 색 뒤에도 편집 중').toBe(true);
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.waitForFunction((i) => !document.getElementById(i).classList.contains('editing'), id);
  } else {                 // line-host 는 색 갈래가 열린 편집을 먼저 커밋한다(lnApplyLinePartialColor)
    expect(await page.evaluate((i) => document.getElementById(i).classList.contains('editing'), id), '색 적용 뒤 편집이 커밋돼 닫혔다').toBe(false);
  }
  const readLine = () => page.evaluate(([i, src]) => ((0, eval)(src))(document.getElementById(i)), [id, K.line.toString()]);
  await expect.poll(async () => /color/.test((await readLine())?.textHtml || ''), '부분 색이 모델 textHtml 에 들어왔다').toBe(true);
  const line = await readLine();
  const cc = await charColors(page, sel);
  console.log(`  partial ${kind}:`, JSON.stringify({ line, cc }));
  expect(line.text, '평문 text 짝').toBe(TXT);
  expect(/<span style="color:rgb\(255, 0, 0\)">CCC<\/span>$/.test(line.textHtml), `textHtml = 끝 3글자만 color span ${line.textHtml}`).toBe(true);
  expect(line.textHtml.startsWith('AAABBB'), '앞 6글자는 span 밖').toBe(true);
  expect(line.color ?? null, '줄 전체 color 는 안 바뀐다').toBe(lineColor0);
  expect(cc.red, '빨강 글자 = 고른 3글자만').toBe('CCC');
  expect(cc.first[1], '앞 글자는 원래 색').toBe(base);
  return line;
}

test.describe('LR10 패널 부분 색 — laurel · 같은 길의 주인들', () => {
  test('LR10 laurel — 끝 3글자 선택 → 패널 색 → 그 3글자만 · 커밋 textHtml color span · 저장 왕복 · ⌘Z 1 · Figma span 0', async ({ page }) => {
    const errs = await setup(page);
    const id = await addBlock(page, 'laurel');
    const K = { sel: KIND.laurel.sel, line: KIND.laurel.line };
    const pos0 = await page.evaluate(() => window.getHistoryTip?.().pos);
    const t0 = (await state(page, 'laurel', id)).text;
    expect(t0, '전제 — 편집 전 글자는 TXT 가 아니다').not.toBe(TXT);
    const line = await partialColorCase(page, 'laurel', id, K);
    const pos1 = await page.evaluate(() => window.getHistoryTip?.().pos);
    /* Figma — 글만(B1-b) */
    const j = await page.evaluate((want) => { let hit = null;
      const walk = (o) => { if (hit || !o || typeof o !== 'object') return; if (o.type === 'laurel' && o.id === want) { hit = o; return; } for (const k in o) walk(o[k]); };
      window.flushCurrentPage?.(); walk(window.buildFigmaExportJSON(null)); return hit; }, id);
    expect(j, '전제 — Figma JSON 에 그 laurel').not.toBe(null);
    const fj = JSON.stringify(j);
    expect((fj.match(/<span/g) || []).length, `Figma JSON 에 span 0 ${fj}`).toBe(0);
    expect(/textHtml/.test(fj), 'Figma JSON 에 textHtml 0').toBe(false);
    expect(j.cells[0].lines[0].text, 'Figma = 평문').toBe(TXT);
    /* 저장 왕복 */
    const snap = await page.evaluate(() => { window.flushCurrentPage?.(); return window.serializeProject(); });
    /* ⌘Z 1 걸음 = 색만 되돌린다(글자 커밋은 남는다) */
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await state(page, 'laurel', id)).hasKey, '⌘Z 한 번 — 부분 색(textHtml) 없어짐').toBe(false);
    const u1 = await state(page, 'laurel', id);
    const pos2 = await page.evaluate(() => window.getHistoryTip?.().pos);
    console.log('  LR10 undo:', JSON.stringify({ pos0, pos1, pos2, u1 }));
    expect(u1.text, '⌘Z 한 번은 «색 한 걸음»만 — 친 글자는 남는다').toBe(TXT);
    expect(await charColors(page, KIND.laurel.sel(id)).then(c => c.red), '화면에도 빨강 0').toBe('');
    await page.keyboard.press('ControlOrMeta+z');   // 두 번째 = 글자 편집 한 걸음(편집 시작 때 찍힌 것)
    await expect.poll(async () => (await state(page, 'laurel', id)).text, '⌘Z 두 번 — 편집 전 글자').toBe(t0);
    const errs2 = await bootApp(page);
    await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
    await page.waitForFunction((s) => !!document.querySelector(s), KIND.laurel.sel(id));
    const s2 = await state(page, 'laurel', id);
    expect(s2.textHtml, '다시 연 뒤 textHtml 바이트 같음').toBe(line.textHtml);
    const cc2 = await charColors(page, KIND.laurel.sel(id));
    expect([cc2.red, cc2.first[1] !== RED], '다시 연 뒤 빨강 = CCC 만').toEqual(['CCC', true]);
    expect(errs).toEqual([]);
    expect(errs2).toEqual([]);
  });

  test('LR10b 선택 없이(캐럿만) 패널 색 — 옛 동작 = 줄 전체 color · textHtml 없음', async ({ page }) => {
    const errs = await setup(page);
    const id = await addBlock(page, 'laurel');
    const sel = KIND.laurel.sel(id);
    await editSelectTail3(page, sel, id);
    await page.keyboard.press('End');   // 선택 접기
    await page.waitForFunction(() => getSelection().isCollapsed);
    /* ★전제 — «저장 선택»도 비었다(selectionchange 는 비동기라 DOM 선택이 접힌 직후엔 옛 CCC 가 남아 있을 수 있다 — 반복 5회 중 1회 실측) */
    await page.waitForFunction(() => window.__textSelection?.getSavedTextSelection?.() === null);
    const sw = await page.evaluate(() => { const e = document.getElementById('grd-typo-color').closest('.prop-color-swatch'); const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    await page.mouse.click(sw.x, sw.y);
    await page.evaluate(() => { const p = document.getElementById('grd-typo-color'); p.value = '#ff0000';
      p.dispatchEvent(new Event('input', { bubbles: true })); p.dispatchEvent(new Event('change', { bubbles: true })); });
    await expect.poll(() => page.evaluate((i) => JSON.parse(document.getElementById(i).dataset.cells)[0].lines[0].color || '', id)).toMatch(/ff0000/i);
    const s = await state(page, 'laurel', id);
    const cc = await charColors(page, sel);
    console.log('  LR10b:', JSON.stringify({ s, cc, cells: await page.evaluate((i) => document.getElementById(i).dataset.cells, id) }));
    expect(s.shown, '화면 글자 = 친 글자').toBe(TXT);
    expect(s.text, '친 글자 커밋').toBe(TXT);
    expect(s.hasKey, '선택 없음 — textHtml 없음').toBe(false);
    expect(cc.red, '줄 전체 빨강').toBe(TXT);
    expect(errs).toEqual([]);
  });

  for (const kind of ['bubble', 'chat', 'cmp']) {
    const name = { bubble: 'HB3 버블', chat: 'HC2 챗', cmp: 'HM2 비교' }[kind];
    test(`${name} — 같은 길(line-host): 끝 3글자만 패널 색`, async ({ page }) => {
      const errs = await setup(page);
      const id = await addBlock(page, kind);
      await prepOwner(page, kind, id);
      await partialColorCase(page, kind, id, KIND[kind]);
      expect(errs).toEqual([]);
    });
  }

  test('GL1 그리드 줄 — 같은 패널 갈래(_grdWireTypo): 끝 3글자만 패널 색', async ({ page }) => {
    const errs = await setup(page);
    const gid = await addBlock(page, 'grid', { deselect: false });
    await page.evaluate((g) => { const b = document.getElementById(g); const cols = JSON.parse(b.dataset.cols);
      cols[0].lines = [{ type: 'body', text: 'x' }]; b.dataset.cols = JSON.stringify(cols); window.renderGridBlock(b); window.deselectAll?.(); }, gid);
    await page.waitForFunction((s) => !!document.querySelector(s), KIND_GRID.sel(gid));
    /* 그리드는 2단 선택 — 블럭 → 줄을 먼저 고른다(패널에 줄 Typography) */
    const r = await waitStableRect(page, KIND_GRID.sel(gid));
    await page.mouse.click(r.cx, r.cy);
    await page.mouse.click(r.cx, r.cy);
    await page.waitForFunction(() => !!document.getElementById('grd-typo-color'));
    await partialColorCase(page, 'grid', gid, KIND_GRID);
    expect(errs).toEqual([]);
  });
});

/* ══ LR10h · LR10n — 부분 색 결함 둘(이벨류 · 76c8eded 뒤) ═════════════════════════════════════════════════════
 * LR10h: hex 칸 길 — 타이핑 input 마다 + Enter 한 번 더 «같은 글자에 다시» 칠한다. 오프셋으로 되찾은 범위가 옛 span 을 부분 포함해
 *   빈 껍데기 `<span style="color:…"></span>` 가 textHtml 에 남았다. 고침 = 정확히 그 글자 전체인 color span 은 다시 쓴다(+ 빈 span 걷기).
 * LR10n: 줄바꿈 경계 선택(첫 줄 끝 3글자) — 되세우기 오프셋의 끝점이 \n 뒤로 밀려 `BBB\n</span>`. 고침 = 끝점을 \n 건너뛰기 «전에» 본다.
 * 원인(LR10h · 실측): 다시 칠할 때 범위를 _text-selection _rangeFromOffsets 가 되찾는데, 시작이 «앞 글자 노드의 끝»에 붙어 옛 color span 을
 *   «부분 포함»한다 → extractContents 가 span 을 복제해 가져가고 원본은 빈 껍데기로 남는다. 고침 셋(line-host.js lnApplyLinePartialColor):
 *   ① 칠한 뒤 다시 그린 줄에 저장 선택을 \n 없이 센 오프셋으로 «span 안 글자에서 시작하게» 되세움(_lnSelRestore) ② 범위 글자 = 한 color span 의
 *   글자 전체면 그 span 재사용(_lnExactColorSpan) ③ 남은 빈 span 걷기(새 범위가 옛 span 끝에 닿는 다른 선택 대비).
 * 음성대조(1회씩 · cp 백업/복원 · cmp 같음 · LR10 묶음 8칸):
 *   · ①만 끔 → 8 passed(②③ 가 막는다) · ①②③ 모두 끔(= 고치기 전) → 2 failed: LR10h(받은 값 `…CCC</span><span style="color:rgb(255, 0, 0)"></span>`)
 *     + LR10b(색 대기 시간초과 — 이 깨뜨림과 무관한 갈래 · 흔들림으로 본다, 본 판 반복 실측은 보고서)
 *   · _lnSelRestore 끝점 검사를 \n 건너뛰기 «뒤»로(옛 순서) → 1 failed: LR10n(받은 값 `AAA<span …>BBB<br></span>CCCDDD`) */
const SWATCH_BYTES = 'AAABBB<span style="color:rgb(255, 0, 0)">CCC</span>';
test.describe('LR10h·LR10n 부분 색 결함 둘', () => {
  test('LR10h hex 칸으로 색 — textHtml 에 빈 span 0 · 스와치 길과 같은 바이트', async ({ page }) => {
    const errs = await setup(page);
    const id = await addBlock(page, 'laurel');
    const sel = KIND.laurel.sel(id);
    await editSelectTail3(page, sel, id);
    const hx = await page.evaluate(() => { const e = document.getElementById('grd-typo-color-hex'); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    expect(hx, '전제 — 그 줄 Fill hex 칸').not.toBeNull();
    await page.mouse.click(hx.x, hx.y);
    expect(await page.evaluate(() => document.activeElement?.id), '전제 — hex 칸에 포커스').toBe('grd-typo-color-hex');
    expect(await page.evaluate(() => window.__textSelection?.getSavedTextSelection?.()?.range?.toString() ?? null), '전제 — 고른 글자가 산다').toBe('CCC');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('FF0000');      // input 마다 적용(유효한 3자리 FFF 도 한 번 칠한다)
    await page.keyboard.press('Enter');      // Enter = onApply 한 번 더 + commit
    await expect.poll(async () => (await state(page, 'laurel', id)).textHtml, 'hex 길 textHtml = 스와치 길과 같은 바이트').toBe(SWATCH_BYTES);
    const s = await state(page, 'laurel', id);
    const cc = await charColors(page, sel);
    console.log('  LR10h:', JSON.stringify({ s, cc }));
    expect((s.textHtml.match(/<span[^>]*><\/span>/g) || []).length, `빈 span 0 ${s.textHtml}`).toBe(0);
    expect(cc.red, '빨강 = CCC 만').toBe('CCC');
    expect(s.text).toBe(TXT);
    expect(errs).toEqual([]);
  });

  test('LR10n 줄바꿈 경계 선택(첫 줄 끝 3글자) — span 은 BBB 에서 끝나고 줄바꿈은 밖 · 2줄 · 저장 왕복', async ({ page }) => {
    const errs = await setup(page);
    const id = await addBlock(page, 'laurel');
    const sel = KIND.laurel.sel(id);
    await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel);
    const r = await waitStableRect(page, sel);
    await page.mouse.dblclick(r.cx, r.cy);
    await page.waitForFunction((s) => document.querySelector(s)?.getAttribute('contenteditable') === 'true', sel);
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('AAABBB');
    await page.keyboard.press('Enter');
    await page.keyboard.type('CCCDDD');
    await page.waitForFunction((s) => (document.querySelector(s)?.innerText || '').replace(/\n+$/, '') === 'AAABBB\nCCCDDD', sel);
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('End');
    for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft');
    await page.waitForFunction(() => getSelection().toString() === 'BBB');
    await panelColor(page, '#ff0000', 'BBB');
    await expect.poll(async () => /color/.test((await state(page, 'laurel', id)).textHtml || '')).toBe(true);
    const s = await state(page, 'laurel', id);
    const rl = await renderedLines(page, 'laurel', id);
    const cc = await charColors(page, sel);
    console.log('  LR10n:', JSON.stringify({ s, rl, cc }));
    expect(s.text, 'text = 두 줄 평문').toBe('AAABBB\nCCCDDD');
    expect(s.textHtml, 'span 은 BBB 에서 끝나고 줄바꿈(<br>)은 span 밖').toBe('AAA<span style="color:rgb(255, 0, 0)">BBB</span><br>CCCDDD');
    expect(cc.red, '빨강 = BBB 만').toBe('BBB');
    expect(rl.byHeight, `렌더 2줄 ${JSON.stringify(rl)}`).toBe(2);
    const snap = await page.evaluate(() => { window.flushCurrentPage?.(); return window.serializeProject(); });
    const errs2 = await bootApp(page);
    await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
    await page.waitForFunction((q) => !!document.querySelector(q), sel);
    await page.evaluate((q) => document.querySelector(q)?.scrollIntoView({ block: 'center' }), sel);
    const s2 = await state(page, 'laurel', id);
    const rl2 = await renderedLines(page, 'laurel', id);
    expect([s2.text, s2.textHtml], '다시 연 뒤 모델 같음').toEqual([s.text, s.textHtml]);
    expect(rl2.byHeight, '다시 연 뒤 2줄').toBe(2);
    expect(errs).toEqual([]);
    expect(errs2).toEqual([]);
  });
});

/* ══ LR11 — 86ecc76c 재판정 칸 정식화(이벨류에이터 임시 EV86-1~9 → LR11-1~9) + D1 고침 ══════════════════════════════
 * ★D1(이벨류 실측 8/8 · 1013 재판정): 두 줄 laurel 줄 'AAABBB⏎CCCDDD' 에서 BBB 를 고르고 패널 hex 칸에 FF0000 → 고른 글자가 아니라
 *   «줄 전체» color(#ff0000) · textHtml 없음. 한 줄·스와치 길은 정상.
 *   원인(계측 — _alive 에 탐침을 박아 잼 · 보고서): hex 칸 클릭 = 편집 blur → parkEditing(세움) → 첫 input 의 캡처(onPanelAct)가
 *   flush = finish({keepPanel}) 로 줄을 «평문(\n 글자)»으로 다시 그린다 → _text-selection._alive 의 지문 둘
 *   (블럭 textContent · 줄 글자칸 textContent)이 기록 때 편집 DOM(Enter = <div>, \n 없음)과 \n 하나만큼 갈려 저장 선택을 버렸다.
 *   고침(js/props/_text-selection.js _alive): 지문이 «그대로» 같으면 옛 길 그대로 · 다르면 «\n 을 빼고» 견주어 같을 때만
 *   \n 을 안 센 오프셋(_rangeFromOffsetsNoNl)으로 되찾는다 — 편집 DOM(<div>)↔평문 렌더(\n) 는 같은 글자다.
 * 계측(고치기 전 · 탐침): 지문 «둘 다» 갈렸다 — 블럭 'AAABBBCCCDDD'↔'AAABBB\nCCCDDD' · 글자칸 같은 꼴(laurel·버블·챗·비교·그리드·칩 6/6).
 * 음성대조(1회 실측 2026-10-14 · cp 백업/복원 · cmp 같음 · 이 묶음 -g 27칸):
 *   · _alive 의 \n 무시 갈래 둘을 끔 → 6 failed: LR11-2 · HB4h · HC3h · HM3h · GL2h · LR14 (나머지 21 초록)
 *   · line-host ②(_lnExactColorSpan) 를 null 로 → 1 failed: LR11-10(겹 span `<span fw><span color>CCC`) · 옛 ②(DOM 경계 비교)도 LR11-10 빨강(같은 바이트). */
const R = 'rgb(255, 0, 0)', G = 'rgb(0, 255, 0)', B = 'rgb(0, 0, 255)';
const SP = (rgb, t) => `<span style="color:${rgb}">${t}</span>`;
const T2 = 'AAABBB\nCCCDDD', T3 = 'AAA\nBBB\nCCC';
const lineK = (page, K, id) => page.evaluate(([i, src]) => { const b = document.getElementById(i); return b ? ((0, eval)(src))(b) : null; }, [id, K.line.toString()]);
const colorsByChar = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s); if (!el) return null;
  const m = {};
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let t = tw.nextNode(); t; t = tw.nextNode()) for (const ch of t.nodeValue) { if (/\s/.test(ch)) continue; const c = getComputedStyle(t.parentElement).color; m[c] = (m[c] || '') + ch; }
  return m;
}, sel);
const linesAt = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s); if (!el) return null;
  const tops = new Set();
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let t = tw.nextNode(); t; t = tw.nextNode()) {
    if (!t.nodeValue.trim()) continue;
    const rg = document.createRange(); rg.selectNodeContents(t);
    for (const q of rg.getClientRects()) if (q.width > 0) tops.add(Math.round(q.top));
  }
  return { byHeight: tops.size, ws: getComputedStyle(el).whiteSpace };
}, sel);
async function waitSel(page, want) {
  try { await page.waitForFunction((t) => getSelection().toString() === t, want, { timeout: 3000 }); }
  catch (_) { const got = await page.evaluate(() => getSelection().toString()); throw new Error(`전제 — 선택 ${JSON.stringify(want)} 아님 · 받은 ${JSON.stringify(got)}`); }
}
/* 줄 더블클릭 → 편집. ★스크롤 재시도(이벨류에이터 도우미): 패널이 다시 그려지며 캔버스가 밀리면 첫 scrollIntoView 가 화면 밖 좌표를 줄 수 있다
   ⇒ 글자칸이 화면 안에 멈출 때까지 최대 5번 다시 스크롤하고, 누르는 점이 그 줄 위인지 단언한 뒤 누른다. */
/* ★★1020t1a(2차) — ★«고를 글자»를 ★Range 로 ★곧장 집는다. ⛔캐럿 위치에 ★매달리지 않는다.
   ★왜 — ★이 describe 의 ★단언 ★9개에 ★캐럿 단언이 ★0개다(전수 확인). ★증명 대상은
     ★«부분 색 두 번 · ⌘Z 1 · 저장 왕복»이고 ★캐럿은 ★거기 가는 ★수단일 뿐이었다.
     ★그런데 ★그 수단이 ★1020t1a(`d9ead6e9`) 뒤 ★주인마다 달라졌다(비교 = 누른 글자 · 나머지 = 줄 끝)
     ⇒ ★키로 세우는 길(`↓`·`End`)은 ★★주인·DOM 꼴·키 순서에 ★기대는 ★약한 바닥이었다.
       ★실측으로 ★두 번 틀렸다: ⇧←×3 → "AAA" · ↓·End·⇧←×3 → ★"CCC"(그 판에서 ★End 가 ★안 먹었다).
   ★이 길은 ★★앱의 ★저장 선택(`selectionchange` → js/props/_text-selection.js:447)이 ★프로그램 선택도
     ★잡는다는 것에 ★선다 — ★그걸 ★재서 확인했다(헤드리스 크롬 · 진짜 앱):
       Range 로 "DDD" → `lnApplyLinePartialColor` → ★모델 textHtml 이 ★A2 와 ★바이트 일치.
   ★★«재진입 캐럿»의 동작은 ★여기서 ★빠지지 ★않는다 — ★그 칸은 ★레포 밖 CDP 게이트가 ★맡는다
     (`…/scratchpad/t1a/gate-hm3.mjs` — 비교 = 누른 글자 · laurel = 줄 끝을 ★각각 단언). */
async function pickText(page, sel, needle) {
  const got = await page.evaluate(([s, n]) => {
    const el = document.querySelector(s); if (!el) return { ok: false, why: 'no el' };
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let t = tw.nextNode(); t; t = tw.nextNode()) {
      const i = t.nodeValue.lastIndexOf(n);
      if (i < 0) continue;
      const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + n.length);
      const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r);
      return { ok: sl.toString() === n, sel: sl.toString() };
    }
    return { ok: false, why: 'needle 없음', html: el.innerHTML };
  }, [sel, needle]);
  expect(got.ok, `전제 — ${needle} 를 Range 로 집었다 ${JSON.stringify(got)}`).toBe(true);
}
async function openEditSel(page, sel, id) {
  let r = null;
  for (let k = 0; k < 5; k++) {
    await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center', behavior: 'instant' }), sel);
    r = await waitStableRect(page, sel);
    if (r.cy > 0 && r.cy < 1200) break;
  }
  const hit = await page.evaluate(([x, y, s]) => { const e = document.elementFromPoint(x, y); const w = document.querySelector(s);
    return { on: !!(e && w && (e === w || w.contains(e))), at: String(e?.outerHTML || e).slice(0, 160), x, y }; }, [r.cx, r.cy, sel]);
  expect(hit.on, `전제 — 누르는 점이 줄 위 ${JSON.stringify(hit)}`).toBe(true);
  await page.mouse.dblclick(r.cx, r.cy);
  try { await page.waitForFunction((s) => document.querySelector(s)?.getAttribute('contenteditable') === 'true', sel, { timeout: 5000 }); }
  catch (_) {
    const d = await page.evaluate(([s, i]) => ({ ce: document.querySelector(s)?.getAttribute('contenteditable'), editing: document.getElementById(i)?.classList.contains('editing'),
      act: String(document.activeElement?.outerHTML || '').slice(0, 120), html: document.querySelector(s)?.innerHTML }), [sel, id]);
    throw new Error('전제 — 더블클릭으로 편집에 안 들어감 ' + JSON.stringify(d));
  }
  expect(await page.evaluate((i) => document.getElementById(i).classList.contains('editing'), id), '전제 — 편집 중').toBe(true);
}
async function buildSel(page, sel, id, parts) {
  await openEditSel(page, sel, id);
  await page.keyboard.press('ControlOrMeta+a');
  for (let i = 0; i < parts.length; i++) { if (i) { await page.keyboard.press('End'); await page.keyboard.press('Enter'); } await page.keyboard.type(parts[i]); }
  await page.waitForFunction(([s, t]) => (document.querySelector(s)?.innerText || '').replace(/\n+$/, '') === t, [sel, parts.join('\n')]);
}
async function keys(page, list) { for (const k of list) await page.keyboard.press(k); }
const shiftLeft = (n) => Array(n).fill('Shift+ArrowLeft');
/* hex 칸을 «마우스로» 누르고(편집 blur → 세움) ⌘A → 타이핑(input 마다 적용) → Enter */
async function hexColor(page, HEX6, want) {
  const hx = await page.evaluate(() => { const e = document.getElementById('grd-typo-color-hex'); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  expect(hx, '전제 — Fill hex 칸').not.toBeNull();
  await page.mouse.click(hx.x, hx.y);
  expect(await page.evaluate(() => document.activeElement?.id), '전제 — hex 칸 포커스').toBe('grd-typo-color-hex');
  if (want !== null) expect(await page.evaluate(() => window.__textSelection?.getSavedTextSelection?.()?.range?.toString() ?? null), '전제 — 저장 선택').toBe(want);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(HEX6);
  await page.keyboard.press('Enter');
}
/* 스와치를 누르고 피커 input 을 여러 번(스펙트럼 끌기 대용) → change 한 번 */
async function swatchMulti(page, hexes, want) {
  const sw = await page.evaluate(() => { const e = document.getElementById('grd-typo-color')?.closest('.prop-color-swatch'); if (!e) return null;
    const b = e.getBoundingClientRect(); const x = b.x + b.width / 2, y = b.y + b.height / 2; const at = document.elementFromPoint(x, y); return { x, y, on: !!(at && (at === e || e.contains(at))) }; });
  expect(sw, '전제 — 스와치').not.toBeNull(); expect(sw.on, '전제 — 누르는 점이 스와치 위').toBe(true);
  await page.mouse.click(sw.x, sw.y);
  expect(await page.evaluate(() => window.__textSelection?.getSavedTextSelection?.()?.range?.toString() ?? null), '전제 — 저장 선택').toBe(want);
  await page.evaluate((hs) => { const p = document.getElementById('grd-typo-color');
    for (const h of hs) { p.value = h; p.dispatchEvent(new Event('input', { bubbles: true })); }
    p.dispatchEvent(new Event('change', { bubbles: true })); }, hexes);
}
/* 정확한 바이트를 기다리되(못 와도) 실제 값을 남기고 공통 단언 — 빈 span 0 · 평문 짝 · 줄 전체 color 불변 · 렌더 줄 수 · 글자별 색 */
async function verdictK(page, K, id, label, want, { text, color0, lines, chars }) {
  try { await expect.poll(async () => (await lineK(page, K, id))?.textHtml ?? null, { timeout: 5000 }).toBe(want); } catch (_) {}
  const line = await lineK(page, K, id);
  const rl = await linesAt(page, K.sel(id));
  const cbc = await colorsByChar(page, K.sel(id));
  console.log(`  ${label}:`, JSON.stringify({ want, textHtml: line?.textHtml ?? null, text: line?.text, color: line?.color ?? null, byHeight: rl?.byHeight, ws: rl?.ws, cbc }));
  expect(line?.textHtml ?? null, `${label} textHtml 바이트`).toBe(want);
  expect((String(line?.textHtml || '').match(/<span[^>]*><\/span>/g) || []).length, '빈 span 0').toBe(0);
  expect(line?.text, '평문 짝').toBe(text);
  expect(line?.color ?? null, '줄 전체 color 불변').toBe(color0);
  expect(rl?.byHeight, '렌더 줄 수').toBe(lines);
  for (const [c, s] of Object.entries(chars)) expect(cbc?.[c] ?? '', `글자색 ${c}`).toBe(s);
  return line;
}
const KL = { sel: KIND.laurel.sel, line: KIND.laurel.line };
async function prepL(page) { const errs = await setup(page); const id = await addBlock(page, 'laurel'); const color0 = (await lineK(page, KL, id))?.color ?? null; return { errs, id, color0 }; }
const build = (page, id, parts) => buildSel(page, KL.sel(id), id, parts);
const verdict = (page, id, label, want, o) => verdictK(page, KL, id, label, want, o);

test.describe('LR11 86ecc76c 재판정 칸(EV86 → LR11) · D1', () => {
  test('LR11-1 한 줄 끝 CCC · hex FF0000', async ({ page }) => {
    const { errs, id, color0 } = await prepL(page);
    await build(page, id, [TXT]); await keys(page, ['End', ...shiftLeft(3)]); await waitSel(page, 'CCC');
    await hexColor(page, 'FF0000', 'CCC');
    await verdict(page, id, 'LR11-1', 'AAABBB' + SP(R, 'CCC'), { text: TXT, color0, lines: 1, chars: { [R]: 'CCC' } });
    expect(errs).toEqual([]);
  });
  test('LR11-2 ★D1 두 줄 BBB · hex FF0000 — 고른 BBB 만(줄 전체 아님)', async ({ page }) => {
    const { errs, id, color0 } = await prepL(page);
    await build(page, id, ['AAABBB', 'CCCDDD']); await keys(page, ['ArrowUp', 'End', ...shiftLeft(3)]); await waitSel(page, 'BBB');
    await hexColor(page, 'FF0000', 'BBB');
    await verdict(page, id, 'LR11-2', 'AAA' + SP(R, 'BBB') + '<br>CCCDDD', { text: T2, color0, lines: 2, chars: { [R]: 'BBB' } });
    expect(errs).toEqual([]);
  });
  test('LR11-3 한 줄 CCC · 스와치 input 3번(R→G→B) · ⌘Z 1', async ({ page }) => {
    const { errs, id, color0 } = await prepL(page);
    await build(page, id, [TXT]); await keys(page, ['End', ...shiftLeft(3)]); await waitSel(page, 'CCC');
    await swatchMulti(page, ['#ff0000', '#00ff00', '#0000ff'], 'CCC');
    const line = await verdict(page, id, 'LR11-3', 'AAABBB' + SP(B, 'CCC'), { text: TXT, color0, lines: 1, chars: { [B]: 'CCC' } });
    expect((line.textHtml.match(/<span/g) || []).length, 'span 1개').toBe(1);
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await state(page, 'laurel', id)).hasKey, '⌘Z 1 → textHtml 없음').toBe(false);
    expect((await state(page, 'laurel', id)).text).toBe(TXT);
    expect(errs).toEqual([]);
  });
  test('LR11-4 ★①b 두 줄 BBB · 스와치 input 3번 · ⌘Z 1', async ({ page }) => {
    const { errs, id, color0 } = await prepL(page);
    await build(page, id, ['AAABBB', 'CCCDDD']); await keys(page, ['ArrowUp', 'End', ...shiftLeft(3)]); await waitSel(page, 'BBB');
    await swatchMulti(page, ['#ff0000', '#00ff00', '#0000ff'], 'BBB');
    await verdict(page, id, 'LR11-4', 'AAA' + SP(B, 'BBB') + '<br>CCCDDD', { text: T2, color0, lines: 2, chars: { [B]: 'BBB' } });
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await state(page, 'laurel', id)).hasKey, '⌘Z 1 → textHtml 없음').toBe(false);
    expect((await state(page, 'laurel', id)).text).toBe(T2);
    expect(errs).toEqual([]);
  });
  test('LR11-5 ★③ CCC 빨강 → 다시 편집 BBBCCC 파랑(끝 = 옛 span 끝)', async ({ page }) => {
    const { errs, id, color0 } = await prepL(page);
    await build(page, id, [TXT]); await keys(page, ['End', ...shiftLeft(3)]); await waitSel(page, 'CCC');
    await panelColor(page, '#ff0000', 'CCC');
    await verdict(page, id, 'LR11-5a', 'AAABBB' + SP(R, 'CCC'), { text: TXT, color0, lines: 1, chars: { [R]: 'CCC' } });
    await openEditSel(page, KL.sel(id), id); await keys(page, shiftLeft(6)); await waitSel(page, 'BBBCCC');
    await panelColor(page, '#0000ff', 'BBBCCC');
    await verdict(page, id, 'LR11-5', 'AAA' + SP(B, 'BBBCCC'), { text: TXT, color0, lines: 1, chars: { [B]: 'BBBCCC' } });
    expect(errs).toEqual([]);
  });
  test('LR11-6 ★③ 가운데 BBB 빨강 → 다시 편집 BBBCCC 파랑(시작 = 옛 span 시작)', async ({ page }) => {
    const { errs, id, color0 } = await prepL(page);
    await build(page, id, [TXT]); await keys(page, ['End', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', ...shiftLeft(3)]); await waitSel(page, 'BBB');
    await panelColor(page, '#ff0000', 'BBB');
    await verdict(page, id, 'LR11-6a', 'AAA' + SP(R, 'BBB') + 'CCC', { text: TXT, color0, lines: 1, chars: { [R]: 'BBB' } });
    await openEditSel(page, KL.sel(id), id); await keys(page, shiftLeft(6)); await waitSel(page, 'BBBCCC');
    await panelColor(page, '#0000ff', 'BBBCCC');
    await verdict(page, id, 'LR11-6', 'AAA' + SP(B, 'BBBCCC'), { text: TXT, color0, lines: 1, chars: { [B]: 'BBBCCC' } });
    expect(errs).toEqual([]);
  });
  test('LR11-7 ④ 세 줄 가운데 BBB · 스와치 · 저장 왕복', async ({ page }) => {
    const { errs, id, color0 } = await prepL(page);
    await build(page, id, ['AAA', 'BBB', 'CCC']); await keys(page, ['ArrowUp', 'End', ...shiftLeft(3)]); await waitSel(page, 'BBB');
    await panelColor(page, '#ff0000', 'BBB');
    const line = await verdict(page, id, 'LR11-7', 'AAA<br>' + SP(R, 'BBB') + '<br>CCC', { text: T3, color0, lines: 3, chars: { [R]: 'BBB' } });
    const snap = await page.evaluate(() => { window.flushCurrentPage?.(); return window.serializeProject(); });
    const errs2 = await bootApp(page);
    await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
    await page.waitForFunction((q) => !!document.querySelector(q), KL.sel(id));
    const l2 = await lineK(page, KL, id);
    expect([l2.text, l2.textHtml], '저장 왕복 같음').toEqual([line.text, line.textHtml]);
    expect(errs).toEqual([]); expect(errs2).toEqual([]);
  });
  test('LR11-8 ④⑤ 세 줄 AAA\\nBBB(줄 넘음) · 스와치', async ({ page }) => {
    const { errs, id, color0 } = await prepL(page);
    await build(page, id, ['AAA', 'BBB', 'CCC']); await keys(page, ['ArrowUp', 'End', ...shiftLeft(7)]); await waitSel(page, 'AAA\nBBB');
    await panelColor(page, '#ff0000', 'AAABBB');   // 저장 Range.toString 은 <div> 경계를 \n 으로 안 센다(이벨류 실측)
    await verdict(page, id, 'LR11-8', SP(R, 'AAA<br>BBB') + '<br>CCC', { text: T3, color0, lines: 3, chars: { [R]: 'AAABBB' } });
    expect(errs).toEqual([]);
  });
  /* ★갈래 ②(line-host _lnExactColorSpan — 범위 = 한 color span 의 글자 전체면 그 span 재사용)를 «혼자» 지키는 칸.
     ①b·③ 가 가리는 까닭: 다른 칸들의 옛 span 은 style 이 color «하나»라, 재사용이 없어도 새 span 이 옛 span 안에 들고
     _flattenAncestorWithPropIn 이 color 를 지우면 빈 style 의 옛 span 이 «벗겨져» 바이트가 같아진다.
     ⇒ 옛 span 이 color «말고 다른 속성»(font-weight)도 가지면 벗겨지지 않아 겹 span 이 남는다 — 이 칸이 그 장면이다. */
  test('LR11-10 ★② color+굵기 span 의 글자 전체를 다시 칠함 — 그 span 재사용(겹 span 0)', async ({ page }) => {
    const { errs, id, color0 } = await prepL(page);
    const sel = KL.sel(id);
    await openEditSel(page, sel, id);
    await page.evaluate((s) => { document.querySelector(s).innerHTML = 'AAABBB<span style="color:#ff0000;font-weight:700">CCC</span>'; }, sel);
    await page.keyboard.press('Escape');
    await page.waitForFunction((i) => !document.getElementById(i).classList.contains('editing'), id);
    const pre = await lineK(page, KL, id);
    expect(pre?.textHtml, '전제 — color+굵기 span 이 커밋됐다').toBe('AAABBB<span style="color:#ff0000;font-weight:700">CCC</span>');
    await openEditSel(page, sel, id); await keys(page, shiftLeft(3)); await waitSel(page, 'CCC');
    await panelColor(page, '#0000ff', 'CCC');
    const line = await verdict(page, id, 'LR11-10', 'AAABBB<span style="color:rgb(0, 0, 255);font-weight:700">CCC</span>', { text: TXT, color0, lines: 1, chars: { [B]: 'CCC' } });
    expect((line.textHtml.match(/<span/g) || []).length, 'span 1개(겹 0)').toBe(1);
    expect(errs).toEqual([]);
  });
  test('LR11-9 ①b 세 줄 BBB\\nCCC · 스와치 빨강 → 편집 닫힌 뒤 hex 00FF00', async ({ page }) => {
    const { errs, id, color0 } = await prepL(page);
    await build(page, id, ['AAA', 'BBB', 'CCC']); await keys(page, ['End', ...shiftLeft(7)]); await waitSel(page, 'BBB\nCCC');
    await panelColor(page, '#ff0000', 'BBBCCC');   // 같은 까닭
    await verdict(page, id, 'LR11-9a', 'AAA<br>' + SP(R, 'BBB<br>CCC'), { text: T3, color0, lines: 3, chars: { [R]: 'BBBCCC' } });
    await hexColor(page, '00FF00', null);
    const line = await verdict(page, id, 'LR11-9', 'AAA<br>' + SP(G, 'BBB<br>CCC'), { text: T3, color0, lines: 3, chars: { [G]: 'BBBCCC' } });
    expect((line.textHtml.match(/<span/g) || []).length, 'span 1개(겹 0)').toBe(1);
    expect(errs).toEqual([]);
  });
});

/* ══ LR12 · HB4 · HC3 · HM3 — 줄바꿈 + 부분 색 두 번(경계 BBB · 둘째 줄 DDD) · ⌘Z 1 · 저장 왕복 (계획 plan-1013-gapfill §②) ══════════
 * 몸짓(넷 공통): 더블클릭 → ⌘A → 'AAABBB' → Enter → 'CCCDDD' → ArrowUp·End·⇧←×3 = BBB → 스와치 빨강(A1)
 *   → 다시 더블클릭 → ★pickText('DDD')로 ★곧장 집는다(⛔캐럿에 안 매달린다 — 1020t1a 뒤 주인마다 캐럿이 다르다)
 *   → 스와치 파랑(A2) → 저장 → ⌘Z 1 = A1(색 한 걸음만) → 저장본 다시 열기 = A2.
 * ★★이 검사는 ★«캐럿»을 ★안 잰다(단언 9개 중 0개) — ★그 칸은 ★레포 밖 CDP 게이트 gate-hm3.mjs 가 맡는다.
 * 주인별: 챗 = 메시지 «1»(오른쪽 · HC1·HC2·LR8 이 안 간 주소) · msgs[0] 그대로 · msgs[1].text 는 평문 거울(span 0).
 *   비교 = 칼럼 «1»(featured) · cols[0] 그대로 · ★DDD 가 cmp-row(overflow:hidden) 안에서 실제로 보인다(byHeight 는 잘려도 2 를 센다 — 대리 지표 함정).
 *   버블 = 줄을 직접 넣는다(prepOwner) ⇒ D2 «첫 줄 굽기»(_bakeFrom) 길은 안 탄다(그 길 뒤 부분 색은 안 쟀다).
 * 음성대조(1회 실측 2026-10-14 · cp 백업/복원 · cmp 같음): line-host.js 칠한 뒤 `.replace(/\r?\n/g, '<br>')`(⑤) 를 빼면
 *   이 넷(LR12·HB4·HC3·HM3) 다 빨강 + LR10n · LR11-2·4·7·8·9 · HB4h·HC3h·HM3h·GL2h·LR14 (-g 27칸 중 15 failed). */
const OWN = {
  laurel: { add: 'laurel', prep: null, sel: KIND.laurel.sel, line: KIND.laurel.line },
  bubble: { add: 'bubble', prep: (i) => window.updateSpeechBubbleBlock(i, { lines: [{ type: 'body', text: 'plain' }] }), sel: KIND.bubble.sel, line: KIND.bubble.line },
  chat:   { add: 'chat2', prep: (i) => window.updateChatBlock(i, { editMessage: { index: 1, lines: [{ type: 'body', text: 'plain' }] } }),
            sel: (id) => `#${id} .ln-row[data-ln-m="1"][data-ln="0"] > .grd-line`,
            line: (b) => JSON.parse(b.dataset.messages || '[]')[1]?.lines?.[0] ?? null },
  cmp:    { add: 'cmp', prep: (i) => window.updateComparisonBlock(i, { rowLines: { col: 1, row: 0, lines: [{ type: 'body', text: 'plain' }] } }),
            sel: (id) => `#${id} .cmp-row[data-col-idx="1"][data-row-idx="0"] > .ln-row[data-ln-c="1"][data-ln="0"] > .grd-line`,
            line: (b) => window.getComparisonCols(b.dataset)[1]?.rows?.[0]?.lines?.[0] ?? null },
};
const OWN_NAME = { laurel: 'LR12 laurel', bubble: 'HB4 버블', chat: 'HC3 챗(메시지 1)', cmp: 'HM3 비교(칼럼 1)' };
/* 주인 밖(다른 메시지·칼럼) — 손대지 않았나 */
const sibling = (page, kind, id) => page.evaluate(([k, i]) => {
  const b = document.getElementById(i);
  if (k === 'chat') return JSON.stringify(JSON.parse(b.dataset.messages || '[]')[0] ?? null);
  if (k === 'cmp') return JSON.stringify(window.getComparisonCols(b.dataset)[0]?.rows?.[0] ?? null);
  return null;
}, [kind, id]);
/* 비교 — DDD 글자 사각형이 cmp-row(overflow:hidden) 안에 든다 */
const dddVisible = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s); const row = el?.closest('.cmp-row'); if (!el || !row) return { ok: false, why: 'no el/row' };
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let last = null;
  for (let t = tw.nextNode(); t; t = tw.nextNode()) if (t.nodeValue.includes('DDD')) last = t;
  if (!last) return { ok: false, why: 'no DDD' };
  const i = last.nodeValue.indexOf('DDD'); const rg = document.createRange(); rg.setStart(last, i); rg.setEnd(last, i + 3);
  const q = rg.getBoundingClientRect(), rb = row.getBoundingClientRect();
  return { ok: q.height > 0 && q.bottom <= rb.bottom + 1 && q.top >= rb.top - 1, ddd: [Math.round(q.top), Math.round(q.bottom)], row: [Math.round(rb.top), Math.round(rb.bottom)], ov: getComputedStyle(row).overflow };
}, sel);
async function prepK(page, kind) {
  const errs = await setup(page);
  const K = OWN[kind];
  const id = await addBlock(page, K.add);
  if (K.prep) { const ok = await page.evaluate(K.prep, id); if (kind === 'cmp') expect(ok && ok.ok, `전제 — 비교 칸1 에 줄 ${JSON.stringify(ok)}`).toBe(true); }
  await page.waitForFunction((s) => !!document.querySelector(s), K.sel(id));
  const color0 = (await lineK(page, K, id))?.color ?? null;
  return { errs, id, K, color0 };
}
const A1 = 'AAA' + SP(R, 'BBB') + '<br>CCCDDD';
const A2 = 'AAA' + SP(R, 'BBB') + '<br>CCC' + SP(B, 'DDD');

test.describe('LR12·HB4·HC3·HM3 줄바꿈 + 부분 색 두 번 — 경계(BBB)·둘째 줄(DDD) · ⌘Z 1 · 저장 왕복', () => {
  for (const kind of ['laurel', 'bubble', 'chat', 'cmp']) {
    test(`${OWN_NAME[kind]} — A1(BBB 빨강) → A2(+DDD 파랑) · ⌘Z 1 = A1 · 다시 열기 = A2`, async ({ page }) => {
      const { errs, id, K, color0 } = await prepK(page, kind);
      const sel = K.sel(id);
      const sib0 = await sibling(page, kind, id);
      await buildSel(page, sel, id, ['AAABBB', 'CCCDDD']);
      const base = (await charColors(page, sel)).base;
      expect([base === R, base === B], `전제 — 줄 기본색이 빨강·파랑이 아니다 ${base}`).toEqual([false, false]);
      await keys(page, ['ArrowUp', 'End', ...shiftLeft(3)]); await waitSel(page, 'BBB');
      await panelColor(page, '#ff0000', 'BBB');
      expect(await page.evaluate((i) => document.getElementById(i).classList.contains('editing'), id), '전제 — 색 갈래가 열린 편집을 먼저 커밋').toBe(false);
      await verdictK(page, K, id, `${kind} A1`, A1, { text: T2, color0, lines: 2, chars: { [R]: 'BBB' } });
      if (kind === 'cmp') { const v = await dddVisible(page, sel); expect(v.ok, `A1 — DDD 가 비교 칸 안에서 보인다 ${JSON.stringify(v)}`).toBe(true); }
      /* 둘째 칠하기 — 다시 편집 · ⛔⌘A 금지(서식이 날아간다)
         ★★1020t1a 고침 — ~~「다시 편집(캐럿 끝)」~~ ★그 전제를 ★«말로» 두지 않고 ★키로 ★세운다.
           ★왜: `d9ead6e9`(현빈 1020t1a 「비교 블럭 더블클릭시 커서가 적절한 곳에 위치하지 않는 문제」)로
             ★비교 줄은 ★더블클릭한 ★«그 글자»에 캐럿이 선다(텍스트블럭·그리드 칸의 관용과 같게).
             `openEditSel` 은 ★줄 상자의 ★«중심»을 누르는데, 이 줄은 ★시각 두 줄이라 중심이 ★줄 경계다
             ⇒ ★캐럿 off=3 («AAA|BBB») ⇒ ⇧←×3 이 ★「AAA」를 골랐다(실측 2026-10-20 · 헤드리스 크롬 · 진짜 앱).
           ★고친 꼴은 ★이 파일이 ★이미 쓰는 관용구다 — 위 A1 단계의 `['ArrowUp', 'End', ...shiftLeft(3)]`.
           ★실측으로 골랐다(네 후보 중 ★주인 둘에서 ★모두 DDD 인 것은 ★이것뿐):
             ⇧←×3        → cmp "AAA" ❌ / laurel "DDD" ✅
             End,⇧←×3    → cmp "BBB" ❌ / laurel "DDD" ✅
             ↓,End,⇧←×3  → cmp "DDD" ✅ / laurel "DDD" ✅   ← ★주인과 무관하다
           ⇒ ★옛 동작(줄 끝 캐럿)인 laurel·버블·챗도 ★그대로 초록이다(이 키는 끝에서 ★무동작). */
      await openEditSel(page, sel, id); await pickText(page, sel, 'DDD'); await waitSel(page, 'DDD');
      await panelColor(page, '#0000ff', 'DDD');
      const line2 = await verdictK(page, K, id, `${kind} A2`, A2, { text: T2, color0, lines: 2, chars: { [R]: 'BBB', [B]: 'DDD' } });
      if (kind === 'cmp') { const v = await dddVisible(page, sel); expect(v.ok, `A2 — DDD 가 비교 칸 안에서 보인다 ${JSON.stringify(v)}`).toBe(true); }
      expect(await sibling(page, kind, id), '이웃(메시지 0 · 칼럼 0) 그대로').toBe(sib0);
      if (kind === 'chat') {
        const t1 = await page.evaluate((i) => JSON.parse(document.getElementById(i).dataset.messages)[1].text, id);
        expect(/<span|&lt;span/.test(t1 || ''), `메시지 1 text = 평문 거울(span 0) ${t1}`).toBe(false);
      }
      const snap = await page.evaluate(() => { window.flushCurrentPage?.(); return window.serializeProject(); });
      /* ⌘Z 1 = 색 한 걸음만(DDD 파랑만 빠지고 BBB 빨강·두 줄 글자는 남는다) */
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.keyboard.press('ControlOrMeta+z');
      await expect.poll(async () => (await lineK(page, K, id))?.textHtml ?? null, '⌘Z 1 = A1').toBe(A1);
      expect((await lineK(page, K, id))?.text, '⌘Z 1 뒤 글자 그대로').toBe(T2);
      expect((await colorsByChar(page, sel))?.[B] ?? '', '⌘Z 1 뒤 파랑 0').toBe('');
      /* 저장 왕복 */
      const errs2 = await bootApp(page);
      await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
      await page.waitForFunction((q) => !!document.querySelector(q), sel);
      await page.evaluate((q) => document.querySelector(q)?.scrollIntoView({ block: 'center' }), sel);
      const l3 = await lineK(page, K, id);
      expect([l3?.text, l3?.textHtml], '다시 연 뒤 모델 = A2').toEqual([T2, line2.textHtml]);
      expect((await linesAt(page, sel))?.byHeight, '다시 연 뒤 2줄').toBe(2);
      const cb3 = await colorsByChar(page, sel);
      expect([cb3?.[R] ?? '', cb3?.[B] ?? ''], '다시 연 뒤 빨강 BBB · 파랑 DDD').toEqual(['BBB', 'DDD']);
      if (kind === 'cmp') { const v = await dddVisible(page, sel); expect(v.ok, `다시 연 뒤 DDD 가 보인다 ${JSON.stringify(v)}`).toBe(true); }
      expect(errs).toEqual([]);
      expect(errs2).toEqual([]);
    });
  }
});

/* ══ D1 주인별 — hex 칸 길 두 줄 BBB (HB4h · HC3h · HM3h · GL2h) + 칩 길(LR14) ══════════════════════════════
 * laurel 의 같은 장면은 LR11-2. 같은 _text-selection 지문(_alive)을 지나므로 같은 고침이 덮는다(보고서 = 고치기 전 실측). */
test.describe('D1 주인별 — hex 칸 · 두 줄 BBB = 고른 글자만', () => {
  for (const kind of ['bubble', 'chat', 'cmp']) {
    const name = { bubble: 'HB4h 버블', chat: 'HC3h 챗(메시지 1)', cmp: 'HM3h 비교(칼럼 1)' }[kind];
    test(`${name} — hex FF0000 → A1`, async ({ page }) => {
      const { errs, id, K, color0 } = await prepK(page, kind);
      const sel = K.sel(id);
      await buildSel(page, sel, id, ['AAABBB', 'CCCDDD']);
      await keys(page, ['ArrowUp', 'End', ...shiftLeft(3)]); await waitSel(page, 'BBB');
      await hexColor(page, 'FF0000', 'BBB');
      await verdictK(page, K, id, `${name}`, A1, { text: T2, color0, lines: 2, chars: { [R]: 'BBB' } });
      expect(errs).toEqual([]);
    });
  }
  test('GL2h 그리드 줄 — hex FF0000 · 두 줄 BBB → 고른 글자만', async ({ page }) => {
    const errs = await setup(page);
    const gid = await addBlock(page, 'grid', { deselect: false });
    await page.evaluate((g) => { const b = document.getElementById(g); const cols = JSON.parse(b.dataset.cols);
      cols[0].lines = [{ type: 'body', text: 'x' }]; b.dataset.cols = JSON.stringify(cols); window.renderGridBlock(b); window.deselectAll?.(); }, gid);
    const sel = KIND_GRID.sel(gid);
    await page.waitForFunction((s) => !!document.querySelector(s), sel);
    const r = await waitStableRect(page, sel);
    await page.mouse.click(r.cx, r.cy);
    await page.mouse.click(r.cx, r.cy);
    await page.waitForFunction(() => !!document.getElementById('grd-typo-color'));
    const color0 = (await lineK(page, KIND_GRID, gid))?.color ?? null;
    await buildSel(page, sel, gid, ['AAABBB', 'CCCDDD']);
    await keys(page, ['ArrowUp', 'End', ...shiftLeft(3)]); await waitSel(page, 'BBB');
    await hexColor(page, 'FF0000', 'BBB');
    await page.evaluate(() => document.activeElement?.blur?.());   // 그리드 편집기는 커밋 때 싣는다(GL1 과 같은 끝냄)
    await page.waitForFunction((i) => !document.getElementById(i).classList.contains('editing'), gid);
    await verdictK(page, KIND_GRID, gid, 'GL2h', A1, { text: T2, color0, lines: 2, chars: { [R]: 'BBB' } });
    expect(errs).toEqual([]);
  });
  test('LR14 laurel 칩(컬러 변수) 길 — 두 줄 BBB → 고른 글자만(대체 hex)', async ({ page }) => {
    const errs = await setup(page);
    await page.evaluate(() => window.DesignSystem.setColorVar('lr14', '#00ff00'));
    const id = await addBlock(page, 'laurel');
    const color0 = (await lineK(page, KL, id))?.color ?? null;
    await build(page, id, ['AAABBB', 'CCCDDD']); await keys(page, ['ArrowUp', 'End', ...shiftLeft(3)]); await waitSel(page, 'BBB');
    const chip = await page.evaluate(() => { const e = document.querySelector('#grd-typo-color-chips .cv-chip[data-cv-name="lr14"]'); if (!e) return null;
      const b = e.getBoundingClientRect(); const x = b.x + b.width / 2, y = b.y + b.height / 2; const at = document.elementFromPoint(x, y); return { x, y, on: !!(at && (at === e || e.contains(at))) }; });
    expect(chip, '전제 — 패널에 컬러 변수 칩 lr14').not.toBeNull();
    expect(chip.on, '전제 — 누르는 점이 칩 위').toBe(true);
    await page.mouse.click(chip.x, chip.y);
    await verdict(page, id, 'LR14', 'AAA' + SP(G, 'BBB') + '<br>CCCDDD', { text: T2, color0, lines: 2, chars: { [G]: 'BBB' } });
    expect(errs).toEqual([]);
  });
});
