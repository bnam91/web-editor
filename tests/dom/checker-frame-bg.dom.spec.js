/* checker-frame-bg.dom.spec.js — NEW-현빈QA-FRAME-BG-CHECKER-OPTIONS-01 (0.9.11 · 현빈 ⓑ)
 *   요구: 섹션 배경 설정의 «체크 배경으로 두기/끄기»·«체커 어둡게 켬/끔»을 프레임 블럭 배경 설정에도 — 같은 UI·동작·저장 키·내보내기 제외.
 *   설계: 섹션 것 재사용(키 bgImgEmpty·checkerTone · 클래스 sec-bg-empty · 내보내기 떼기 · 문구) + 에셋(t4-15) 선례의 «프레임 전용 톤 쌍».
 *   F1 단추 — 프레임 패널(그림 없음)에 섹션과 같은 단추 · 누르면 키·클래스·체커가 서고 «체커 어둡게» 줄이 뜬다 · 다시 누르면 끈다(톤은 남김)
 *   F2 톤 — 켬 → 그 프레임만 #7c7c7c/#949494 · 끔 → 밝게 · ★어두운 섹션 안 프레임은 «끔»이면 밝다(섹션 쌍 상속 차단)
 *   F3 내보내기 — 캡처 클론(stripEditorOnlyForCapture)·저장 직렬화 뒤: 클론엔 체커 0 · 저장본엔 키 둘이 실린다
 *   F4 다시 열기 — 클래스가 걷힌 저장본도 rebindAll 이 키로 체커를 다시 세운다 · 그림이 있으면 체커가 그림을 안 덮는다
 *   F5 ⌘Z — 켜기·톤이 «한 칸씩»: 톤 켠 뒤 undo 한 번 = 톤만 · 한 번 더 = 체크 배경 꺼짐(적용 먼저 · 기록 나중)
 *   N1 [대조] 같은 문서 섹션 체크 배경·톤은 그대로(라디오 name 이 안 섞인다)
 * ★양성대조: js/props/prop-frame.js 의 ss-bg-img-empty 배선(클릭 처리기 한 덩이)을 지우면 F1·F2·F3 빨강 · css/editor-base.css 의
 *   .frame-block[data-checker-tone="dark"] 규칙을 지우면 F2 빨강 · save-load.js 프레임 복원 한 줄을 지우면 F4 빨강 · N1 은 늘 초록.
 * 하네스 = checker-section-tone 꼴(bootApp · 앱 안 띄움). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const DARK = 'rgb(124, 124, 124)', LIGHT = 'rgb(216, 216, 216)';   // css/editor-base.css 톤 · :root --goya-checker-big-a

async function build(page) {
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', `
      <div class="section-block" id="S1" data-section="1"><div class="section-inner">
        <div class="row" data-layout="stack"><div class="frame-block" id="F" data-free-layout="true" data-bg="#EFEFEF" style="background:#EFEFEF;position:relative;width:400px;height:200px;"></div></div>
      </div></div>
      <div class="section-block sec-bg-empty" id="S2" data-section="1" data-bg-img-empty="1" data-checker-tone="dark"><div class="section-inner">
        <div class="row" data-layout="stack"><div class="frame-block" id="G" data-free-layout="true" style="position:relative;width:400px;height:200px;"></div></div>
      </div></div>`);
  });
}
const bg = (page, id) => page.evaluate((i) => getComputedStyle(document.getElementById(i)).backgroundImage, id);
const open = async (page, id) => { await page.evaluate((i) => window.showFrameProperties(document.getElementById(i)), id); await page.waitForSelector('#ss-bg-img-btn', { state: 'attached' }); };
const click = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const radio = (page, id) => page.evaluate((i) => { const r = document.getElementById(i); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }, id);

test('F1 프레임 패널 «체크 배경으로 두기» — 키·클래스·체커 · 톤 줄 · 다시 누르면 끈다(톤은 남김)', async ({ page }) => {
  const errs = await bootApp(page);
  await build(page);
  await open(page, 'F');
  expect(await page.evaluate(() => document.getElementById('ss-bg-img-empty')?.textContent.trim())).toBe('체크 배경으로 두기');
  expect(await page.$('#ss-checker-tone-on'), '꺼진 동안엔 톤 줄이 없다(섹션과 같다)').toBeNull();
  expect(await bg(page, 'F'), '[전제] 켜기 전 체커 없음').not.toContain('repeating-conic-gradient');
  await click(page, '#ss-bg-img-empty');
  const on = await page.evaluate(() => { const f = document.getElementById('F'); return { k: f.dataset.bgImgEmpty, cls: f.classList.contains('sec-bg-empty'), btn: document.getElementById('ss-bg-img-empty')?.textContent.trim(), tone: !!document.getElementById('ss-checker-tone-on') }; });
  expect(on, '★프레임 «체크 배경» 단추가 안 먹는다').toEqual({ k: '1', cls: true, btn: '체크 배경 끄기', tone: true });
  expect(await bg(page, 'F')).toContain('repeating-conic-gradient');
  expect(await bg(page, 'F')).toContain(LIGHT);
  await radio(page, 'ss-checker-tone-on');
  await click(page, '#ss-bg-img-empty');
  const off = await page.evaluate(() => { const f = document.getElementById('F'); return { k: f.dataset.bgImgEmpty ?? null, cls: f.classList.contains('sec-bg-empty'), tone: f.dataset.checkerTone }; });
  expect(off, '끄면 키·클래스가 빠지고 톤은 남는다').toEqual({ k: null, cls: false, tone: 'dark' });
  expect(await bg(page, 'F')).not.toContain('repeating-conic-gradient');
  expect(errs).toEqual([]);
});

test('F2 체커 어둡게 — 그 프레임만 · 어두운 섹션 안 프레임은 «끔»이면 밝다', async ({ page }) => {
  await bootApp(page);
  await build(page);
  await open(page, 'F');
  await click(page, '#ss-bg-img-empty');
  await radio(page, 'ss-checker-tone-on');
  expect(await page.evaluate(() => document.getElementById('F').dataset.checkerTone)).toBe('dark');
  expect(await bg(page, 'F'), '★켰는데 프레임 체커가 안 어둡다').toContain(DARK);
  await radio(page, 'ss-checker-tone-off');
  expect(await bg(page, 'F')).toContain(LIGHT);
  expect(await bg(page, 'F')).not.toContain(DARK);
  /* G = 어둡게 켠 섹션 S2 안 프레임 — 프레임 톤은 끔 */
  await open(page, 'G');
  await click(page, '#ss-bg-img-empty');
  expect(await bg(page, 'G'), '★어두운 섹션의 톤이 프레임 체커로 새어 든다').toContain(LIGHT);
  expect(await bg(page, 'G')).not.toContain(DARK);
});

test('F3 내보내기 제외 · 저장 키 — 캡처 클론엔 체커 0 · 직렬화엔 키 둘', async ({ page }) => {
  await bootApp(page);
  await build(page);
  await open(page, 'F');
  await click(page, '#ss-bg-img-empty');
  await radio(page, 'ss-checker-tone-on');
  const r = await page.evaluate(async () => {
    const { stripEditorOnlyForCapture } = await import('/js/io/capture-safety.js');
    const clone = document.getElementById('S1').cloneNode(true); clone.id = 'S1c';
    stripEditorOnlyForCapture(clone);
    document.getElementById('canvas').appendChild(clone);
    const cf = clone.querySelector('.frame-block');
    const out = { cls: cf.classList.contains('sec-bg-empty'), drawn: getComputedStyle(cf).backgroundImage };
    clone.remove();
    const html = (window.getSerializedCanvas?.() ?? document.getElementById('canvas').innerHTML);
    const tag = (html.match(/<div class="frame-block[^"]*"[^>]*id="F"[^>]*>/) || [''])[0];
    return { ...out, keyEmpty: /data-bg-img-empty="1"/.test(tag), keyTone: /data-checker-tone="dark"/.test(tag), tag: tag.slice(0, 300) };
  });
  expect({ cls: r.cls, conic: /repeating-conic-gradient/.test(r.drawn) }, '★캡처 클론에 프레임 체커가 남았다(PNG 에 나간다)').toEqual({ cls: false, conic: false });
  expect({ keyEmpty: r.keyEmpty, keyTone: r.keyTone }, r.tag).toEqual({ keyEmpty: true, keyTone: true });
});

test('F4 다시 열기 — 클래스가 걷혀도 키로 다시 선다 · 그림이 있으면 체커가 안 덮는다', async ({ page }) => {
  await bootApp(page);
  await build(page);
  await page.evaluate(() => { const f = document.getElementById('F'); f.dataset.bgImgEmpty = '1'; f.classList.remove('sec-bg-empty'); window.rebindAll(); });
  expect(await page.evaluate(() => document.getElementById('F').classList.contains('sec-bg-empty')), '★다시 열면 프레임 체크 배경이 꺼진다').toBe(true);
  expect(await bg(page, 'F')).toContain('repeating-conic-gradient');
  await page.evaluate(() => { document.getElementById('F').dataset.bgImg = 'data:image/png;base64,iVBORw0KGgo='; });
  expect(await bg(page, 'F'), '그림이 들어온 프레임을 체커가 덮었다').not.toContain('repeating-conic-gradient');
});

test('N1 [대조] 섹션 체크 배경·톤은 그대로 — 프레임 라디오와 안 섞인다', async ({ page }) => {
  await bootApp(page);
  await build(page);
  await page.evaluate(() => window.showSectionProperties(document.getElementById('S2')));
  await page.waitForSelector('#sec-checker-tone-on', { state: 'attached' });
  expect(await bg(page, 'S2')).toContain(DARK);
  const names = await page.evaluate(() => [document.getElementById('sec-checker-tone-on')?.name]);
  await open(page, 'G');
  await click(page, '#ss-bg-img-empty');
  names.push(await page.evaluate(() => document.getElementById('ss-checker-tone-on')?.name));
  expect(names[0]).not.toBe(names[1]);
  expect(await bg(page, 'S2'), '섹션 체커 톤이 바뀌었다').toContain(DARK);
  expect(await page.evaluate(() => document.getElementById('S2').dataset.checkerTone)).toBe('dark');
});

test('F5 ⌘Z — 체크 배경 켜기·톤이 한 칸씩 되돌아간다', async ({ page }) => {
  await bootApp(page);
  await build(page);
  await page.evaluate(() => window.clearHistory?.());
  await open(page, 'F');
  await click(page, '#ss-bg-img-empty');
  await radio(page, 'ss-checker-tone-on');
  const st = () => page.evaluate(() => { const f = document.getElementById('F'); return { e: f.dataset.bgImgEmpty ?? null, t: f.dataset.checkerTone ?? null }; });
  expect(await st(), '[전제]').toEqual({ e: '1', t: 'dark' });
  await page.evaluate(() => window.undo());
  expect(await st(), '★undo 한 번에 톤만 돌아가야 한다(두 편집이 같이 사라지면 빨강)').toEqual({ e: '1', t: null });
  await page.evaluate(() => window.undo());
  expect(await st(), 'undo 한 번 더 = 체크 배경 꺼짐').toEqual({ e: null, t: null });
});
