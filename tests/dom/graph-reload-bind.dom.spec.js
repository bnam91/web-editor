/* graph-reload-bind.dom.spec.js — ★비석: «막대 graph 의 카테고리 라벨 dblclick 편집은 사본·리로드 뒤 죽는다 — 지금은 그게 맞다».
 *
 * ★왜 «빨강이 맞다»를 단언하나 (CLONE-RERENDER-01 · 지디 판정 261022 ㉡):
 *   CR-01 은 이것을 «범위 밖»으로 두었다 — 까닭은 바이트 무변 규약이다: rebindAll 은 graph 를 «방사형일 때만» 다시 그린다
 *   (js/io/save-load.js RERENDER_KINDS 의 graph 줄 · 옛 자리 :1467 주석 «다른 유형은 저장본 그대로 — 바이트 무변»).
 *   막대 graph 의 라벨 편집 위임(_bindGraphLabelEdit · js/drag-utils.js:810)은 renderGraph 안에서 걸리므로,
 *   다시 안 그리는 길(A/B 사본 · 템플릿 넣기 · 붙여넣기 · 리로드)에서는 안 걸린다(실측 핀 002d9725 · 4 길 × 3 회 = 12/12).
 *   그 4 칸을 CR-01 spec 에 «일부러 빨강»으로 두면 다음 빨강을 가린다(누가 돌려도 «아직 안 됐나»로 읽고, 새 결함이 섞여도 안 보인다).
 *   ⇒ 여기로 떼어 «지금 상태»를 초록으로 잠근다. 누가 «방사형일 때만»을 풀면 이 spec 이 빨개져 알려 준다.
 * ★GRAPH-RELOAD-BIND-01 이 닫히면(막대 graph 도 다시 그리기로 정하면) 이 단언을 «뒤집는다»(copy 편집 진입 = true).
 *
 * 대조: 같은 test 안에서 «원본» 라벨 dblclick 은 편집 진입이어야 한다(아니면 장면 미성립 — 빨강).
 * 공용부 = ./_cr-harness.js (사본 4 길 · 행위 자 · 협업 끔 · 누를 점 좌표 기록).
 */
const { test, expect, boot, KINDS, PATHS, save, errsOf, T_MS, RUN } = require('./_cr-harness.js');

/* ★t4-17 ⓐ(261026) — GRAPH-RELOAD-BIND-01 이 닫혔다. 다시 그리기로 정한 것이 «아니라»(RERENDER_KINDS 의 graph 줄 · 바이트 무변 그대로)
 *   묶기(js/block-drag.js bindBlock · isGraph)가 위임 셋을 거는 «한 자리» js/drag-utils.js bindGraphEdits 를 부르게 했다 ⇒ 아래 주 단언을 true 로 뒤집었다.
 *   (실앱 c278bc39 실측: 현빈 원 저장본 원형 grb_84a7j_oruta47 의 _grbLabelEditBound = false · 새로 넣은 원형은 true.) 테스트 이름도 같이 고쳤다. */
for (const p of ['AB', 'TPL', 'PASTE', 'RELOAD']) {
  test(`GRAPH-RELOAD-BIND ${p}: 막대 graph 라벨 dblclick 편집 — 원본 먹음 · ${p} 뒤도 먹음(t4-17 ⓐ 로 뒤집음) @GB`, async ({ page }, ti) => {
    test.setTimeout(T_MS);
    const B = await boot(page);
    const o = { cell: `${p}:graphbar`, path: p, kind: 'graphbar', run: RUN, rep: ti.repeatEachIndex, __B: B };
    try {
      o.A = await (async () => { const n0 = await page.evaluate(() => document.querySelectorAll('#canvas .section-block').length);
        await page.click('.fp-btn.primary[title="새 섹션 추가"]');
        await page.waitForFunction((n) => document.querySelectorAll('#canvas .section-block').length > n, n0);
        return page.evaluate(() => window.getSelectedSection?.()?.id || [...document.querySelectorAll('#canvas .section-block')].pop()?.id); })();
      expect(o.A, '전제: 새 섹션').toBeTruthy();
      await page.evaluate(() => document.querySelectorAll('.graph-block').forEach(e => { e.__s5 = 1; }));
      await KINDS.graphbar.ins(page);
      await page.waitForFunction(() => [...document.querySelectorAll('.graph-block')].some(e => !e.__s5));
      o.orig = await page.evaluate(() => [...document.querySelectorAll('.graph-block')].find(e => !e.__s5)?.id || null);
      expect(o.orig, '전제: 원본 graph').toBeTruthy();
      o.origAct = await KINDS.graphbar.act(page, o.orig);
      expect(o.origAct.ok, '대조: 원본 라벨 dblclick → 편집 진입').toBe(true);
      o.copy = await PATHS[p](page, o, 'graphbar');
      expect(o.copy, `전제: ${p} 뒤 graph 가 있다`).toBeTruthy();
      o.copyAct = await KINDS.graphbar.act(page, o.copy);
      expect(o.copyAct.ok === null ? 'miss' : 'hit', '전제: 누를 점을 맞혔다(뷰포트 안 · 라벨 안)').toBe('hit');
      // ★주 단언 — t4-17 ⓐ 로 뒤집었다: 다시 안 그려도 bindBlock 이 bindGraphEdits 로 위임을 건다(바이트 무변 규약은 그대로)
      expect(o.copyAct.ok, `${p} 뒤 막대 graph 라벨 편집도 먹는다(GRAPH-RELOAD-BIND-01 닫힘 · t4-17 ⓐ)`).toBe(true);
    } finally { delete o.__B; Object.assign(o, errsOf(B)); o.file = save(`GB-${p}`, ti, o); }
  });
}
