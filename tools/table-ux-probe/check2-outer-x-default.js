#!/usr/bin/env node
/* ⑵ 「외곽 좌우 기본 OFF — 단, 기존 테이블은 그대로」 검증.
 *
 *   PORT=9334 node tools/table-ux-probe/check2-outer-x-default.js
 *
 * 무엇을 재나
 *   ① 새로 만든 테이블: data-show-outer-x === 'false' + 좌/우 외곽 border 폭 = 0px + 패널 체크 OFF
 *   ② 「기존 테이블」 A — 저장본이 data-show-outer-x="true" 를 갖고 로드된 경우 → 켜진 채 유지
 *   ③ 「기존 테이블」 B — 속성이 «아예 없는» 초기버전 저장본 → 부재=켜짐 이 유지
 *   ④ 지금 열려 있는 프로젝트에 «이미 있던» 모든 테이블의 실제 값·실제 border 폭 전수 보고
 *      (스크립트가 만들기 전 스냅샷 ↔ 만든 뒤 스냅샷 이 «완전히 같아야» 문서 무손상)
 *   ⑤ 켜기/끄기 토글이 여전히 양방향으로 먹는가
 *
 * ⚠️①의 테이블은 끝에 지운다. ②③은 화면 밖 컨테이너에 넣었다가 지운다(캔버스 무접촉).
 */
'use strict';
const { connect } = require('./_cdp');

(async () => {
  const cdp = await connect();
  const out = { env:{}, r0_기존테이블전: null, r1_새테이블: null, r2_기존명시true: null,
                r3_기존속성없음: null, r4_기존테이블후: null, r5_토글양방향: null, 문제: [] };

  // ── ⓪ 손대기 «전» 기존 테이블 전수 스냅샷 ──────────────────────────────
  const snap = `
    return [...document.querySelectorAll('#canvas .table-block')].map(b => {
      const first = b.querySelector('.tb-table tr > *:first-child');
      const last  = b.querySelector('.tb-table tr > *:last-child');
      const cs1 = first && getComputedStyle(first), cs2 = last && getComputedStyle(last);
      return { id: b.id,
               attr: b.getAttribute('data-show-outer-x'),
               borderLeft:  cs1 ? cs1.borderLeftWidth  : null,
               borderRight: cs2 ? cs2.borderRightWidth : null };
    });`;
  out.r0_기존테이블전 = await cdp.evaluate(snap);
  out.env.기존테이블수 = out.r0_기존테이블전.length;

  // ── ① 새 테이블 ────────────────────────────────────────────────────────
  out.r1_새테이블 = await cdp.evaluate(`
    let sec = window.getSelectedSection?.();
    if (!sec) { sec = document.querySelector('.section-block'); if (sec) window.selectSection?.(sec); }
    if (!sec) return { ok:false, why:'섹션 0개' };
    const before = new Set([...document.querySelectorAll('.table-block')].map(b => b.id));
    window.addTableBlock({});
    await new Promise(r => setTimeout(r, 350));
    const b = [...document.querySelectorAll('.table-block')].find(x => !before.has(x.id));
    if (!b) return { ok:false, why:'테이블이 안 생겼다' };
    window.__probeTblId = b.id;
    b.scrollIntoView({ block:'center' }); await new Promise(r => setTimeout(r, 200));
    b.click(); await new Promise(r => setTimeout(r, 250));      // 우측 패널 생성
    const first = b.querySelector('.tb-table tr > *:first-child');
    const last  = b.querySelector('.tb-table tr > *:last-child');
    const chk = document.getElementById('tbl-show-outerx');
    return { ok:true, id:b.id,
      dataset값: b.dataset.showOuterX,
      기대: 'false',
      dataset_OFF인가: b.dataset.showOuterX === 'false',
      좌_borderWidth: getComputedStyle(first).borderLeftWidth,
      우_borderWidth: getComputedStyle(last).borderRightWidth,
      좌우_0px인가: getComputedStyle(first).borderLeftWidth === '0px'
                 && getComputedStyle(last).borderRightWidth === '0px',
      패널_체크박스: chk ? chk.checked : null,
      패널_OFF인가: chk ? chk.checked === false : null,
      // 대조: 외곽 «상하» 는 그대로 켜져 있어야 한다(엉뚱한 데 손댔는지 확인)
      상_borderWidth: getComputedStyle(b.querySelector('.tb-table tr:first-child > *')).borderTopWidth,
      showOuterY: b.dataset.showOuterY };`);
  if (!out.r1_새테이블.ok) { console.error('⛔' + out.r1_새테이블.why); process.exit(2); }

  // ── ②③ 「저장본에서 로드된 기존 테이블」 재현 ──────────────────────────
  //   저장 HTML 을 그대로 파싱해 넣는다 = 실제 로드 경로가 하는 일(save-load.js 는
  //   showOuterX 를 «건드리지 않고» CSS attribute selector 에 맡긴다).
  const legacy = await cdp.evaluate(`
    const host = document.createElement('div');
    host.id = '__probeLegacyHost';
    host.style.cssText = 'position:absolute;left:-99999px;top:0;width:600px;';
    // ★#canvas 안에 넣는다 — 테이블 CSS 가 #canvas 스코프에 걸린 규칙을 쓰기 때문
    (document.getElementById('canvas') || document.body).appendChild(host);
    const cellsHTML = '<thead><tr><th>A</th><th>B</th></tr></thead>'
                    + '<tbody><tr><td>1</td><td>2</td></tr></tbody>';
    host.innerHTML =
      '<div class="table-block" id="__lg_true"  data-type="table" data-style="default"'
    + ' data-show-v-lines="true" data-show-h-lines="true" data-show-outer-x="true"'
    + ' data-show-outer-y="true" data-outer-width="1">'
    + '<table class="tb-table">' + cellsHTML + '</table></div>'
    + '<div class="table-block" id="__lg_none" data-type="table" data-style="default">'
    + '<table class="tb-table">' + cellsHTML + '</table></div>';
    await new Promise(r => setTimeout(r, 120));
    const read = (id) => {
      const b = document.getElementById(id);
      const first = b.querySelector('.tb-table tr > *:first-child');
      const last  = b.querySelector('.tb-table tr > *:last-child');
      return { attr: b.getAttribute('data-show-outer-x'),
               좌_borderWidth: getComputedStyle(first).borderLeftWidth,
               우_borderWidth: getComputedStyle(last).borderRightWidth,
               좌우_켜져있나: parseFloat(getComputedStyle(first).borderLeftWidth) > 0
                          && parseFloat(getComputedStyle(last).borderRightWidth) > 0 };
    };
    return { 명시true: read('__lg_true'), 속성없음: read('__lg_none') };`);
  out.r2_기존명시true  = legacy.명시true;
  out.r3_기존속성없음  = legacy.속성없음;

  // ── ⑤ 토글 양방향 ──────────────────────────────────────────────────────
  out.r5_토글양방향 = await cdp.evaluate(`
    const b = document.getElementById(window.__probeTblId);
    b.click(); await new Promise(r => setTimeout(r, 200));
    const chk = document.getElementById('tbl-show-outerx');
    if (!chk) return { ok:false, why:'패널 체크박스 없음' };
    const first = b.querySelector('.tb-table tr > *:first-child');
    chk.checked = true;  chk.dispatchEvent(new Event('change', { bubbles:true }));
    await new Promise(r => setTimeout(r, 150));
    const on = { dataset: b.dataset.showOuterX, 좌: getComputedStyle(first).borderLeftWidth };
    chk.checked = false; chk.dispatchEvent(new Event('change', { bubbles:true }));
    await new Promise(r => setTimeout(r, 150));
    const off = { dataset: b.dataset.showOuterX, 좌: getComputedStyle(first).borderLeftWidth };
    return { ok:true, 켰을때: on, 껐을때: off,
             켜짐_동작: on.dataset === 'true'  && parseFloat(on.좌) > 0,
             꺼짐_동작: off.dataset === 'false' && off.좌 === '0px' };`);

  // ── 정리 + ④ 사후 스냅샷 ───────────────────────────────────────────────
  await cdp.evaluate(`
    document.getElementById('__probeLegacyHost')?.remove();
    const b = window.__probeTblId && document.getElementById(window.__probeTblId);
    if (b) (b.closest('.row') || b).remove();
    delete window.__probeTblId;
    window.deselectAll?.(); window.buildLayerPanel?.();
    return true;`);
  out.r4_기존테이블후 = await cdp.evaluate(snap);

  // ── 판정 ────────────────────────────────────────────────────────────────
  const P = out.문제;
  if (!out.r1_새테이블.dataset_OFF인가) P.push('① 새 테이블 data-show-outer-x 가 false 가 아니다: ' + out.r1_새테이블.dataset값);
  if (!out.r1_새테이블.좌우_0px인가)   P.push('① 새 테이블 좌/우 외곽선이 실제로 안 꺼졌다: ' +
                                              out.r1_새테이블.좌_borderWidth + ' / ' + out.r1_새테이블.우_borderWidth);
  if (out.r1_새테이블.패널_OFF인가 === false) P.push('① 우측 패널 「외곽 좌우」 가 여전히 켜짐으로 보인다');
  if (out.r1_새테이블.showOuterY !== 'true')  P.push('① 외곽 «상하» 까지 꺼졌다 — 요구 범위를 넘었다');
  if (!out.r2_기존명시true.좌우_켜져있나)     P.push('② 저장본(data-show-outer-x="true") 테이블의 외곽선이 사라졌다 ★문서 훼손');
  if (!out.r3_기존속성없음.좌우_켜져있나)     P.push('③ 속성 없는 구버전 저장본의 외곽선이 사라졌다 ★문서 훼손');
  if (!out.r5_토글양방향.켜짐_동작 || !out.r5_토글양방향.꺼짐_동작) P.push('⑤ 외곽 좌우 토글이 양방향으로 안 먹는다');
  const a = JSON.stringify(out.r0_기존테이블전), b = JSON.stringify(out.r4_기존테이블후);
  out.env.기존테이블_전후동일 = a === b;
  if (a !== b) P.push('④ 기존 테이블 스냅샷이 «달라졌다» ★문서 훼손\n  전: ' + a + '\n  후: ' + b);

  cdp.close();
  console.log(JSON.stringify(out, null, 2));
  console.log(P.length ? `\n✖ 문제 ${P.length}건` : '\n✔ ⑵ 통과 — 문제 0건');
  process.exit(P.length ? 1 : 0);
})().catch(e => { console.error('⛔', e.message); process.exit(2); });
