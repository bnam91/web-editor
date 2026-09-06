/* canvas-state.dom.spec.js — F7 «렌더러 쪽 진짜 끝». (2026-09-07 신설, U0)
 *
 * ★왜 이게 따로 필요한가:
 *   node 하네스의 앞끝은 «픽스처 JSON»이다. 그건 canvas-state.js 가 «이렇게 낼 것이다»라는
 *   손으로 적은 기대지 실측이 아니다. 그 기대가 틀리면 F7 의 양끝 비교 전체가 거짓 위에 선다.
 *   ⇒ 여기서 «진짜» js/canvas-state.js 를 크로미움에 띄워, 같은 픽스처 DOM 에 대해
 *      정말 그 값을 내는지 대조한다. 어긋나면 고칠 것은 «픽스처»다(또는 렌더러가 바뀐 것이다).
 *
 * ⚠️jsdom 이 없어서 @playwright/test 의 chromium 을 쓴다(설치 확인: ~/Library/Caches/ms-playwright).
 *   ⛔이 파일은 앱을 «안» 띄운다 — 고디터 인스턴스·9345 대역 무접촉. 빈 페이지에 스크립트만 얹는다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js
 *   (기본 e2e 설정의 testDir 이 tests/e2e 라 이 파일은 «안» 걸린다 — 전용 설정으로 부른다)
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FIX = path.join(__dirname, '..', 'fixtures', 'mcp-canvas-fixture');
const SRC = path.join(__dirname, '..', '..', 'js', 'canvas-state.js');

test('F7-DOM ★진짜 canvas-state.js 가 픽스처에서 내는 값 = 체크인된 canvas-state.json', async ({ page }) => {
  const script = fs.readFileSync(SRC, 'utf8');
  const expected = JSON.parse(fs.readFileSync(path.join(FIX, 'canvas-state.json'), 'utf8'));

  /* ⚠️setContent 로 띄우면 base URL 이 없어 «상대경로 이미지»(img/small-a.png)가 안 뜬다.
     그러면 naturalWidth=0 이라 summary.natural 이 조용히 빠지고, 픽스처가 «틀린 채로»
     양끝 비교의 앞끝이 된다 — 실제로 이 검사가 그걸 잡았다(09-07). ⇒ file:// 로 «연다». */
  await page.goto('file://' + path.join(FIX, 'canvas.html'));
  // 이미지 natural 크기가 필요하다 — 다 «뜬» 뒤에 읽는다(«계측 지연»을 실패로 읽지 않기).
  await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
  await page.addScriptTag({ content: script });

  const actual = await page.evaluate(() => window.getCanvasState());

  // 사람이 읽을 «양끝» 한 줄 — 어디가 갈렸는지 바로 보이게.
  const ids = (s) => (s.sections || []).flatMap(x => x.blocks.map(b => b.blockId));
  console.log(`  진짜 렌더러 : 섹션 ${actual.sections.length} · 블록 ${ids(actual).length}`);
  console.log(`  픽스처 정본 : 섹션 ${expected.sections.length} · 블록 ${ids(expected).length}`);

  expect(ids(actual), '★픽스처 JSON 의 블록 목록이 진짜 렌더러와 다르다').toEqual(ids(expected));
  expect(actual).toEqual(expected);
});

test('F7-DOM-2 ★진짜 렌더러도 dataURL 원문을 «안» 싣는다 (요약기가 구조로 막는 자리)', async ({ page }) => {
  const html = fs.readFileSync(path.join(FIX, 'canvas.html'), 'utf8');
  const script = fs.readFileSync(SRC, 'utf8');
  await page.goto('file://' + path.join(FIX, 'canvas.html'));
  await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
  await page.addScriptTag({ content: script });

  const raw = JSON.stringify(await page.evaluate(() => window.getCanvasState()));
  // 픽스처 DOM 에는 base64 가 «있다»(2건, 하나는 400,000B) — 자극 있는 검사다.
  expect(html.match(/base64,/g).length).toBeGreaterThanOrEqual(2);
  expect(raw.match(/base64,/g), '★렌더러 끝에서 이미 base64 가 샌다 — 도구 다이어트보다 «앞» 문제다').toBeNull();
  expect(raw).toContain('(inline data)');   // 「인라인이다」는 사실만 남는다
});
