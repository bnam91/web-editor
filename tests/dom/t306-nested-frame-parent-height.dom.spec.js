/* t306-nested-frame-parent-height — 현빈 t3-06: 프레임에 들어가(더블클릭) 새 프레임을 넣으면 «정한 높이» 부모가 커진다.
 * 대상 ss_rwx4l_i3vos5j(자식 860×520 · absolute) ⊂ ss_rwx4l_sgz77pr(자유배치 · 860×878 · height px).
 * 판정(T306-PLAN-261109): 정한 높이 부모(자유·쌓기) = 높이 그대로여야 한다(빨강이면 버그) · 내용 맞춤 쌓기 부모 = 자람(정책 · 양성 대조).
 * 측정 줄은 `T306ROW {json}` 로 찍는다(나무 × 부모 × 정함/자동 → 전/후). */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const PROJ = '/private/tmp/claude-501/-Users-a1-wt-srv/15280401-eb92-4115-a360-02f2d224e5e9/scratchpad/t306-proj/proj.json';
const HAS_F = /KeyD'\) window\.addGridBlock\?\.\(\); else window\.addFrameBlock/.test(fs.readFileSync(path.join(__dirname, '../../js/editor.js'), 'utf8'));
const FR = '.frame-block:not([data-text-frame])';
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

const ROW = (id, inner) => `<div class="row" id="row${id}" data-layout="stack">${inner}</div><div class="gap-block" data-type="gap" style="height:60px"></div>`;
const SCENE = `<div class="section-block" id="sT" data-section="1"><div class="section-hitzone"></div><div class="section-inner" style="padding-left:32px;padding-right:32px;">
  <div class="gap-block" data-type="gap" style="height:30px"></div>
  ${ROW('A', `<div class="frame-block" id="FREE_FIX_EMPTY" data-free-layout="true" data-bg="#ffffff" data-width="860" data-height="520" style="background:#ffffff;padding:0;width:860px;max-width:100%;margin:0 auto;min-height:520px;height:520px;"></div>`)}
  ${ROW('B', `<div class="frame-block" id="FREE_FIX_SIB" data-free-layout="true" data-bg="#ffffff" data-width="860" data-height="520" style="background:#ffffff;padding:0;width:860px;max-width:100%;margin:0 auto;min-height:520px;height:520px;"><div class="frame-block" id="SIB" data-free-layout="true" data-width="170" data-height="184" style="padding:0;width:170px;max-width:none;min-height:184px;height:184px;position:absolute;left:374px;top:132px;background:#ccc;" data-offset-x="374" data-offset-y="132"></div></div>`)}
  ${ROW('C', `<div class="frame-block" id="FREE_AUTO" data-free-layout="true" data-bg="#ffffff" style="background:#ffffff;padding:0;width:860px;max-width:100%;margin:0 auto;"><div class="frame-block" id="SIB2" data-free-layout="true" data-width="170" data-height="184" style="padding:0;width:170px;min-height:184px;height:184px;position:absolute;left:374px;top:20px;background:#ccc;" data-offset-x="374" data-offset-y="20"></div></div>`)}
  ${ROW('D', `<div class="frame-block" id="STACK_FIX" data-full-width="true" data-bg="#ffffff" data-height="520" style="background:#ffffff;width:860px;padding:20px;box-sizing:border-box;height:520px;min-height:520px;"><div class="gap-block" data-type="gap" style="height:200px"></div></div>`)}
  ${ROW('E', `<div class="frame-block" id="STACK_AUTO" data-full-width="true" data-bg="#ffffff" style="background:#ffffff;width:860px;padding:20px;box-sizing:border-box;"><div class="gap-block" data-type="gap" style="height:200px"></div></div>`)}
  <div class="gap-block" data-type="gap" style="height:400px"></div></div></div>`;

async function boot(page, fromProj, keep) {
  await page.setViewportSize({ width: 1600, height: 1200 });
  const errs = await bootApp(page);
  if (fromProj) {
    const data = fs.readFileSync(PROJ, 'utf8');
    await page.evaluate((d) => { document.getElementById('canvas').innerHTML = ''; window.applyProjectData(JSON.parse(d)); }, data);
  } else {
    await page.evaluate(({ h, keep }) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
      c.insertAdjacentHTML('beforeend', h); c.querySelectorAll('#sT .section-inner > .row').forEach((r) => { if (!r.querySelector('#' + keep)) { r.nextElementSibling?.remove(); r.remove(); } });
      window.rebindAll?.(); window.applyZoom?.(100); }, { h: SCENE, keep });
  }
  await page.evaluate(() => { window.deselectAll?.(); window._activeFrame = null; window.clearHistory?.(); });
  await raf(page);
  return errs;
}
const ids = (page) => page.evaluate((s) => [...document.querySelectorAll('#canvas ' + s)].map((e) => e.id), FR);
const emptyPoint = (page, id) => page.evaluate((id) => { const f = document.getElementById(id); const r = f.getBoundingClientRect();
  for (let y = Math.round(r.bottom - 6); y > r.top; y -= 4) for (const x of [Math.round(r.right - 10), Math.round(r.left + 10)]) if (document.elementFromPoint(x, y) === f) return [x, y]; return null; }, id);
async function enter(page, id) {
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), id);
  await waitStableRect(page, '#' + id);
  const ok = () => page.evaluate((id) => window._enteredFrame?.id === id && !document.querySelector(`#${id} .selected`), id);
  for (let i = 0; i < 3 && !(await ok()); i++) { const p = await emptyPoint(page, id); expect(p, '[전제] 빈 자리 ' + await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); const e = document.elementFromPoint(r.right - 10, r.bottom - 10); return JSON.stringify([r.width, r.height, e?.className, e?.id]); }, id)).not.toBeNull(); await page.mouse.dblclick(...p); await raf(page); }
  expect(await ok(), `[전제] ${id} 진입`).toBe(true);
}
const FRAME_BTN = async (page) => { const b = await page.evaluate(() => { const e = [...document.querySelectorAll('button[title]')].find((x) => x.title.includes('Frame 추가') && x.getBoundingClientRect().width > 0); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); await page.mouse.click(...b); };
const HOW = { 'Frame 추가': FRAME_BTN, F: (page) => page.keyboard.press('f') };
const geom = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); return { h: e.offsetHeight, dh: e.dataset.height ?? null, sh: e.style.height || '' }; }, id);

/* 들어가 → 하나 만들고 → 부모 전/후 + 새 자식 자리·크기 */
async function addInto(page, host, how, tag) {
  await enter(page, host);
  const before = await geom(page, host);
  const had = await ids(page);
  await HOW[how](page);
  await expect.poll(async () => (await ids(page)).length - had.length, `${how}: 하나 생김`).toBe(1);
  await raf(page);
  const kid = (await ids(page)).find((x) => !had.includes(x));
  const after = await geom(page, host);
  const k = await page.evaluate((id) => { const e = document.getElementById(id); return { parent: e.parentElement.closest('.frame-block:not([data-text-frame])')?.id || null, w: e.offsetWidth, h: e.offsetHeight, top: e.style.top || '', pos: e.style.position || '' }; }, kid);
  const row = { tag, how, host, before: before.h, after: after.h, dhBefore: before.dh, dhAfter: after.dh, kid: k };
  console.log('T306ROW ' + JSON.stringify(row));
  test.info().annotations.push({ type: 'T306ROW', description: JSON.stringify(row) });
  expect(k.parent, `[전제] 새 프레임이 ${host} 안`).toBe(host);
  return row;
}

test('P1 사본 — 관계·스타일: i3vos5j 는 sgz77pr 의 직계 absolute 자식 · 둘 다 자유배치 · 정한 높이', async ({ page }) => {
  test.skip(!fs.existsSync(PROJ), '사본 없음(레포 밖 파일)');
  await boot(page, true);
  const r = await page.evaluate(() => { const P = document.getElementById('ss_rwx4l_sgz77pr'), C = document.getElementById('ss_rwx4l_i3vos5j'); if (!P || !C) return null;
    const s = (e) => ({ free: e.dataset.freeLayout, dw: e.dataset.width, dh: e.dataset.height, h: e.style.height, minH: e.style.minHeight, pad: e.style.padding, pos: e.style.position, top: e.style.top, left: e.style.left, oh: e.offsetHeight, auto: e.dataset.autoHeight ?? null });
    return { parentOf: C.parentElement.id, P: s(P), C: s(C), kids: [...P.children].map((k) => k.id) }; });
  test.skip(!r, '두 프레임이 이 페이지에 없음');
  console.log('T306ROW ' + JSON.stringify({ tag: 'P1', ...r }));
  expect(r.parentOf).toBe('ss_rwx4l_sgz77pr');
  expect(r.P).toMatchObject({ free: 'true', dh: '878', h: '878px', auto: null });
  expect(r.C).toMatchObject({ free: 'true', dw: '860', dh: '520', pos: 'absolute', top: '8px' });
});

for (const how of Object.keys(HOW)) {
  test(`P2 사본 · ${how} — sgz77pr 진입 → 새 프레임 → 부모 높이 그대로(정한 높이)`, async ({ page }) => {
    test.skip(!fs.existsSync(PROJ), '사본 없음(레포 밖 파일)');
    test.skip(how === 'F' && !HAS_F, '이 나무엔 F 키 프레임 만들기가 없음');
    const errs = await boot(page, true);
    test.skip(!(await page.evaluate(() => !!document.getElementById('ss_rwx4l_sgz77pr'))), '그 프레임이 이 페이지에 없음');
    const r = await addInto(page, 'ss_rwx4l_sgz77pr', how, 'P2');
    expect(r.after, `부모 ${r.before} → ${r.after} (자식 ${JSON.stringify(r.kid)})`).toBe(r.before);
    expect(errs, errs.join(' | ')).toEqual([]);
  });

  /* 정한 높이 = 그대로(버그면 빨강) · STACK_AUTO = 자람(정책 · 양성 대조) · FREE_AUTO = 측정만(absolute 자식뿐이라 흐름 높이 0 — 키우는 것 말고 길이 없다) */
  for (const [host, kind] of [['FREE_FIX_EMPTY', 'fixed'], ['FREE_FIX_SIB', 'fixed'], ['STACK_FIX', 'fixed'], ['STACK_AUTO', 'auto'], ['FREE_AUTO', 'measure']]) {
    test(`S ${host} · ${how} — ${kind === 'fixed' ? '높이 그대로' : kind === 'auto' ? '자람(정책)' : '측정만'}`, async ({ page }) => {
      test.skip(how === 'F' && !HAS_F, '이 나무엔 F 키 프레임 만들기가 없음');
      const errs = await boot(page, false, host);
      const r = await addInto(page, host, how, 'S');
      if (kind === 'fixed') expect(r.after, `부모 ${r.before} → ${r.after} (자식 ${JSON.stringify(r.kid)})`).toBe(r.before);
      if (kind === 'auto') expect(r.after - r.before, '내용 맞춤 부모는 새 자식만큼 자란다').toBeGreaterThanOrEqual(r.kid.h);
      expect(errs, errs.join(' | ')).toEqual([]);
    });
  }
}
