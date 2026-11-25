/* figma-text-gaps-0912 — 0.9.12 현빈 결정 #4 (261117) · ICONTEXT-TEXT-NOT-IN-FIGMA-TEXTS-01 + FIGMA-GRID-CELL-TEXT-NOT-EXPORTED-01(143행)
 *   기준 «화면 == 내보낸 것». 옛: 그리드 칸 글(.grd-line · 원 안 글 .grd-img-circle-text)은 수집기 셀렉터 밖이라 Figma JSON 에 0 ·
 *   아이콘텍스트 글(.itb-text)은 fe693f59e 로 실렸지만 자리 0,0 · 폭 = 블럭 폭 · 왼정렬(렌더러 generic 이 i*44 로 쌓음) = 화면과 다른 자리.
 * 고침: js/io/export-figma-json.js generic 수집기 — 셀렉터에 .grd-line·.grd-img-circle-text · 그 셋(+.itb-text)은 살아 있는 문서에서
 *   블럭 왼위 기준 레이아웃 px 자리·폭·정렬(x·y·w·align)과 글자 크기·색(사본엔 computed 가 없어 옛 판은 24·#111111 고정)을 싣는다 / figma-renderer/sangpe_to_figma.mjs generic — t.w 가 있으면 그 자리·폭·정렬로 create_text.
 * 칸
 *   T1 그리드 칸 글 셋(가운데 제목 · 본문 · 원 안 글)이 그리드 texts 에 «한 번씩» · 자리·폭(±1)·정렬·글자 크기·색 = 화면
 *   T2 아이콘텍스트 글이 한 번 · 자리·폭(±1)·정렬·글자 크기·색 = 화면
 *   T3 «플러그인이 받을 명령» — T1·T2 의 JSON 을 진짜 렌더러(figma-renderer/*.mjs 사본 + 명령만 적는 가짜 figma_cmd · figma-dryrun.sh 와 같은 손)에 넣으면
 *      글마다 create_text 하나 · 부모 = 그 블럭 프레임 · x·y·width·textAlignHorizontal·fontSize = JSON 값
 * 양성대조: _patches/controls/FTEXT-CTL.patch(두 파일 고침 되돌림) → T1 빨강(칸 글 0) · T2 빨강(자리 0,0) · T3 빨강(width = 블럭 폭 · LEFT).
 * 안 잰 것: 실 Figma 화면 · 굵기(렌더러 generic 은 400 고정 — 옛 한계) · 아이콘텍스트 «아이콘 그림»(generic 은 그림을 안 그린다 — 별건) · 다른 페이지(살아 있는 짝 없음 = 글만 · 옛 자리).
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { bootApp } = require('./_root-harness.js');

const f2 = (p) => p.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const SCENE = {
  cols: [{ width: 1, lines: [{ type: 'h3', text: '제목칸', align: 'center' }, { type: 'body', text: '본문칸' }] },
    { width: 1, lines: [{ type: 'image', imgShape: 'circle', height: 90, bg: '#ffcc00', text: '원글' }] }],
  rows: [{ height: 'auto' }],
  cells: [[{}, {}]],
};
const SEC = `<div class="section-block" id="sX" data-section="1" data-name="글"><div class="section-hitzone"></div><div class="section-inner">
<div class="gap-block" data-type="gap" style="height:40px"></div>
<div class="row" id="rG"><div class="grid-block" id="gX" data-type="grid" data-gap="16"></div></div>
<div class="gap-block" data-type="gap" style="height:40px"></div></div></div>`;

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const icId = await page.evaluate(([h, sc]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h);
    const g = document.getElementById('gX');
    g.dataset.cols = JSON.stringify(sc.cols); g.dataset.rows = JSON.stringify(sc.rows); g.dataset.cells = JSON.stringify(sc.cells);
    window.rebindAll?.(); window.renderGridBlock(g);
    const sec = document.getElementById('sX');
    const b = new Set([...sec.querySelectorAll('.icon-text-block')]);
    window.deselectAll?.(); window._activeFrame = null; window.selectSection(sec); window.addIconTextBlock();
    const ic = [...sec.querySelectorAll('.icon-text-block')].find(e => !b.has(e));
    ic.querySelector('.itb-text').textContent = '아이콘글';
    window.deselectAll?.();
    return ic.id;
  }, [SEC, SCENE]);
  await f2(page);
  /* 화면 자리(블럭 왼위 기준 레이아웃 px · 배율로 나눔)와 정렬 — 내보내기와 «같은 문서»에서 잰다 */
  const r = await page.evaluate((icId) => {
    window.flushCurrentPage?.();
    const live = (blk, sel) => { const B = blk.getBoundingClientRect(), z = (B.width / (blk.offsetWidth || 1)) || 1;
      return [...blk.querySelectorAll(sel)].map((e) => { const R = e.getBoundingClientRect(), a = getComputedStyle(e).textAlign;
        return { t: e.innerText.trim(), fs: parseInt(getComputedStyle(e).fontSize), color: getComputedStyle(e).color, x: Math.round((R.left - B.left) / z), y: Math.round((R.top - B.top) / z), w: Math.round(R.width / z),
          align: a === 'center' ? 'CENTER' : (a === 'right' || a === 'end') ? 'RIGHT' : 'LEFT' }; }); };
    const json = window.buildFigmaExportJSON(null);
    const hit = {}; JSON.stringify(json, (k, v) => { if (v && v.type === 'generic' && (v.id === 'gX' || v.id === icId)) hit[v.id] = v; return v; });
    return { json, grid: hit.gX, ic: hit[icId], gLive: live(document.getElementById('gX'), '.grd-line, .grd-img-circle-text'), icLive: live(document.getElementById(icId), '.itb-text') };
  }, icId);
  return { errs, icId, ...r };
}
const near = (a, b) => Math.abs(a - b) <= 1;
const pick = (texts, t) => (texts || []).filter((x) => x.t === t);
function sameAsScreen(texts, liveList, label) {
  for (const L of liveList) {
    const hits = pick(texts, L.t);
    expect(hits.length, `${label} — «${L.t}» 가 texts 에 ${hits.length}번(한 번이어야) · 잰 texts ${JSON.stringify(texts)}`).toBe(1);
    const h = hits[0];
    expect([near(h.x, L.x), near(h.y, L.y), near(h.w, L.w), h.align, h.fs, h.color], `${label} — «${L.t}» 자리·폭·정렬·크기·색 JSON ${JSON.stringify(h)} vs 화면 ${JSON.stringify(L)}`)
      .toEqual([true, true, true, L.align, L.fs, L.color]);
  }
}

test('T1 그리드 칸 글(제목·본문·원 안 글)이 한 번씩 · 자리·폭·정렬 = 화면 / T2 아이콘텍스트 글 = 화면 / T3 렌더러 명령 = JSON', async ({ page }, testInfo) => {
  const s = await scene(page);
  expect(s.gLive.map((l) => l.t), '[전제] 화면 그리드 칸 글 셋').toEqual(['제목칸', '본문칸', '원글']);
  expect(s.gLive[0].align, '[전제] 제목칸은 가운데 정렬로 그려졌다').toBe('CENTER');
  expect(s.gLive[0].fs, '[전제] 제목칸(h3)은 본문보다 크게 그려졌다(크기 축이 헛돌지 않게)').toBeGreaterThan(s.gLive[1].fs);
  expect(s.icLive.map((l) => l.t), '[전제] 화면 아이콘텍스트 글').toEqual(['아이콘글']);
  expect(s.grid && s.ic, '[전제] 그리드·아이콘텍스트가 generic 으로 나갔다').toBeTruthy();
  sameAsScreen(s.grid.texts, s.gLive, 'T1 그리드');
  sameAsScreen(s.ic.texts, s.icLive, 'T2 아이콘텍스트');

  /* T3 — figma-dryrun.sh 와 같은 손: 렌더러 사본 + 명령만 적는 가짜 figma_cmd(실 Figma·토큰 0) */
  const dir = testInfo.outputPath('fr'); fs.mkdirSync(dir, { recursive: true });
  const src = path.join(__dirname, '..', '..', 'figma-renderer');
  for (const f of fs.readdirSync(src)) if (/\.(mjs|js|json)$/.test(f)) fs.copyFileSync(path.join(src, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'figma_cmd.mjs'), `import { appendFileSync, readFileSync } from 'fs';
const a = process.argv; const g = (k) => a[a.indexOf(k) + 1]; const cmd = g('--command');
const p = a.includes('--params-file') ? readFileSync(g('--params-file'), 'utf8') : g('--params'); const id = 'n' + process.hrtime.bigint();
appendFileSync(process.env.FIGLOG, JSON.stringify({ cmd, params: JSON.parse(p), id }) + '\\n');
console.log(JSON.stringify(cmd === 'get_document_info' ? { children: [] } : { id }));`);
  const jp = path.join(dir, 'export.json'), log = path.join(dir, 'figlog.jsonl');
  fs.writeFileSync(jp, JSON.stringify(s.json));
  const run = spawnSync('node', [path.join(dir, 'sangpe_to_figma.mjs'), 'dryrun', jp], { encoding: 'utf8', env: { ...process.env, FIGLOG: log }, timeout: 120000 });
  expect(run.status, '[전제] 렌더러가 끝까지 돌았다\n' + (run.stderr || '').slice(-800)).toBe(0);
  const cmds = fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  console.log('[FTEXT-DIAG] ' + JSON.stringify({ log, grid: s.grid.texts, ic: s.ic.texts }));
  for (const [blk, label] of [[s.grid, 'grid'], [s.ic, 'icontext']]) {
    const fr = cmds.filter((c) => c.cmd === 'create_frame' && (c.params.name || '').endsWith('_' + blk.id));
    expect(fr.length, `[전제] ${label} 프레임 하나`).toBe(1);
    const kids = cmds.filter((c) => c.cmd === 'create_text' && c.params.parentId === fr[0].id);
    for (const t of blk.texts) {
      const n = kids.filter((c) => c.params.text === t.t);
      expect(n.length, `T3 ${label} — «${t.t}» create_text ${n.length}번`).toBe(1);
      const p = n[0].params;
      /* ★기대 바뀜(85행 c384ce4aa · 미카사 3차 T1): 한 줄 글(잰 폭 있고 줄바꿈 없음)은 폭 고정 안 함 = width 키 0 · WIDTH_AND_HEIGHT(앱 DOM 폭으로 고정하면 Figma 글꼴이 조금 넓어 꺾임) · 여러 줄 = 옛 그대로 width = 잰 폭 */
      const oneLine = typeof t.w === 'number' && t.w > 0 && !/[\r\n]/.test(String(t.t || ''));
      expect([p.x, p.y, p.width, p.textAlignHorizontal, p.fontSize], `T3 ${label} — «${t.t}» 플러그인이 받을 자리·폭·정렬·크기`).toEqual([t.x, t.y, oneLine ? undefined : t.w, t.align, t.fs]);
      if (oneLine) expect(p.textAutoResize, `T3 ${label} — «${t.t}» 한 줄 글 = 폭 따라 늘어남`).toBe('WIDTH_AND_HEIGHT');
    }
  }
  expect(s.errs, s.errs.join('\n')).toEqual([]);
});
