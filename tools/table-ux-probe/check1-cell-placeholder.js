#!/usr/bin/env node
/* ⑴ 「행 추가 시 기본 텍스트가 방해된다」 검증 — 전부 수치·불리언으로.
 *
 *   PORT=9334 node tools/table-ux-probe/check1-cell-placeholder.js
 *
 * 무엇을 재나
 *   ① 새 테이블 본문 셀이 «텍스트 블록과 같은» placeholder 규율을 쓰는가
 *      (data-is-placeholder='true' + data-placeholder + 흐린 opacity)
 *   ② 더블클릭하면 편집 상태가 되고 «전체선택»되는가  ← 지웠다 다시 쓸 필요 없음의 정의
 *   ③ 한 글자 치면 기본문구가 통째로 교체되는가(= '항목 1가' 가 되지 않는가)
 *   ④ 비운 채 빠져나오면 기본문구가 복원되고 다시 placeholder 로 표시되는가
 *   ⑤ 「행 +」 로 «추가»한 행의 새 셀은 처음부터 빈 값인가
 *   ⑥ 대조군: 텍스트 블록도 같은 규율인가(같은 손맛인지 두 눈으로 비교)
 *
 * ⚠️이 스크립트는 캔버스에 테이블/텍스트 블록을 «만들었다가 지운다».
 *    ★스크래치 프로젝트에서 돌려라. 끝에 정리하지만 중간에 죽으면 잔여물이 남는다.
 */
'use strict';
const { connect, sleep } = require('./_cdp');

(async () => {
  const cdp = await connect();
  const out = { env: {}, r1_생성직후셀: null, r2_더블클릭: null, r3_첫타이핑: null,
                r4_비우고blur: null, r5_행추가새셀: null, r6_대조텍스트블록: null, 문제: [] };

  out.env = await cdp.evaluate(`
    return { url: location.pathname.split('/').pop(),
             hasAddTable: typeof window.addTableBlock === 'function',
             sections: document.querySelectorAll('.section-block').length };`);
  if (!out.env.hasAddTable) { console.error('⛔window.addTableBlock 없음 — 렌더러가 아니다'); process.exit(2); }

  // ── 새 테이블 1개 생성 ────────────────────────────────────────────────
  const made = await cdp.evaluate(`
    let sec = window.getSelectedSection?.();
    if (!sec) { sec = document.querySelector('.section-block'); if (sec) window.selectSection?.(sec); }
    if (!sec) return { ok:false, why:'섹션 0개' };
    const before = new Set([...document.querySelectorAll('.table-block')].map(b => b.id));
    window.addTableBlock({});
    await new Promise(r => setTimeout(r, 350));
    const made = [...document.querySelectorAll('.table-block')].find(b => !before.has(b.id));
    if (!made) return { ok:false, why:'테이블이 안 생겼다' };
    made.scrollIntoView({ block:'center' });
    await new Promise(r => setTimeout(r, 250));
    window.__probeTblId = made.id;
    return { ok:true, id: made.id };`);
  if (!made.ok) { console.error('⛔' + made.why); process.exit(2); }
  out.env.newTableId = made.id;

  // ── ① 생성 직후 셀 상태 ───────────────────────────────────────────────
  out.r1_생성직후셀 = await cdp.evaluate(`
    const b = document.getElementById(window.__probeTblId);
    const cell = (el) => ({
      text: el.textContent,
      hasPlaceholderAttr: !!el.dataset.placeholder,
      placeholder: el.dataset.placeholder || null,
      isPlaceholder: el.dataset.isPlaceholder === 'true',
      opacity: Number(getComputedStyle(el).opacity),
    });
    const bodyRows = [...b.querySelectorAll('tbody tr')];
    return {
      본문행수: bodyRows.length,
      첫열_셀들: bodyRows.map(tr => cell(tr.children[0])),
      둘째열_셀들: bodyRows.map(tr => cell(tr.children[1])),
      헤더셀들: [...b.querySelectorAll('thead th')].map(cell),
    };`);

  // ── ② 더블클릭 → 편집 + 전체선택 (진짜 마우스 입력) ────────────────────
  const rect = await cdp.evaluate(`
    const b = document.getElementById(window.__probeTblId);
    const td = b.querySelector('tbody tr td');
    b.click();                                  // 테이블 dblclick 은 selected 일 때만 편집 진입
    await new Promise(r => setTimeout(r, 150));
    const r = td.getBoundingClientRect();
    return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2),
             selected: b.classList.contains('selected') };`);
  await cdp.dblclick(rect.x, rect.y);
  out.r2_더블클릭 = await cdp.evaluate(`
    const b = document.getElementById(window.__probeTblId);
    const td = b.querySelector('tbody tr td');
    const sel = window.getSelection();
    return {
      블록이_selected였나: ${rect.selected},
      셀이_편집상태: td.getAttribute('contenteditable') === 'true',
      셀이_포커스: document.activeElement === td,
      선택된_글자: sel.toString(),
      셀_전체글자: td.textContent,
      전체선택인가: sel.toString() === td.textContent && td.textContent.length > 0,
      선택_길이: sel.toString().length,
      편집중_opacity: Number(getComputedStyle(td).opacity),
    };`);

  // ── ③ 한 글자만 «진짜 키로» 친다 → 기본문구가 통째로 교체되어야 한다 ─────
  await cdp.typeKey('X');
  out.r3_첫타이핑 = await cdp.evaluate(`
    const b = document.getElementById(window.__probeTblId);
    const td = b.querySelector('tbody tr td');
    return { 셀글자: td.textContent, 길이: td.textContent.length,
             기대: 'X', 통째교체됨: td.textContent === 'X',
             남은_기본문구잔재: td.textContent.includes('항목'),
             isPlaceholder해제: td.dataset.isPlaceholder !== 'true' };`);

  // ── ④ 다 지우고 빠져나오면 기본문구 복원 ────────────────────────────────
  out.r4_비우고blur = await cdp.evaluate(`
    const b = document.getElementById(window.__probeTblId);
    const td = b.querySelector('tbody tr td');
    td.textContent = '';
    td.dispatchEvent(new Event('input', { bubbles: true }));
    td.blur();
    await new Promise(r => setTimeout(r, 200));
    return { 복원된글자: td.textContent, 기대: td.dataset.placeholder,
             복원됨: td.textContent === td.dataset.placeholder,
             isPlaceholder: td.dataset.isPlaceholder === 'true',
             contenteditable: td.getAttribute('contenteditable') };`);

  // ── ⑤ 「행 +」 로 추가한 행의 새 셀은 처음부터 빈 값 ─────────────────────
  out.r5_행추가새셀 = await cdp.evaluate(`
    const b = document.getElementById(window.__probeTblId);
    b.click(); await new Promise(r => setTimeout(r, 150));   // 우측 패널 재생성
    const before = b.querySelectorAll('tbody tr').length;
    document.getElementById('tbl-row-plus')?.click();
    await new Promise(r => setTimeout(r, 250));
    const rows = [...b.querySelectorAll('tbody tr')];
    const last = rows[rows.length - 1];
    return { 행수_전: before, 행수_후: rows.length,
             새행_셀글자: [...last.children].map(c => c.textContent),
             새행_전부빈값: [...last.children].every(c => c.textContent === ''),
             새행_길이합: [...last.children].reduce((n,c) => n + c.textContent.length, 0) };`);

  // ── ⑥ 대조군: 텍스트 블록이 실제로 쓰는 방식 ────────────────────────────
  const trect = await cdp.evaluate(`
    const before = new Set([...document.querySelectorAll('.text-block')].map(b => b.id));
    window.addTextBlock?.('body');
    await new Promise(r => setTimeout(r, 350));
    const tb = [...document.querySelectorAll('.text-block')].find(b => !before.has(b.id));
    if (!tb) return { ok:false };
    window.__probeTxtId = tb.id;
    tb.scrollIntoView({ block:'center' }); await new Promise(r => setTimeout(r, 250));
    const el = tb.querySelector('[data-placeholder]') || tb.firstElementChild;
    const r = el.getBoundingClientRect();
    return { ok:true, x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };`);
  if (trect.ok) {
    await cdp.dblclick(trect.x, trect.y);
    out.r6_대조텍스트블록 = await cdp.evaluate(`
      const tb = document.getElementById(window.__probeTxtId);
      const el = tb.querySelector('[data-placeholder]') || tb.firstElementChild;
      const sel = window.getSelection();
      return { isPlaceholder: el.dataset.isPlaceholder === 'true',
               전체선택인가: sel.toString() === el.textContent && el.textContent.length > 0,
               선택된_글자: sel.toString() };`);
  }

  // ── 정리: 만든 블록 제거 ────────────────────────────────────────────────
  const cleaned = await cdp.evaluate(`
    let n = 0;
    for (const k of ['__probeTblId','__probeTxtId']) {
      const el = window[k] && document.getElementById(window[k]);
      if (el) { (el.closest('.row') || el).remove(); n++; }
      delete window[k];
    }
    window.deselectAll?.(); window.buildLayerPanel?.();
    return n;`);
  out.env.정리한_블록수 = cleaned;

  // ── 판정 ────────────────────────────────────────────────────────────────
  const P = out.문제;
  if (!out.r1_생성직후셀.첫열_셀들.every(c => c.isPlaceholder))   P.push('① 본문 첫 열이 placeholder 로 표시되지 않는다');
  if (!out.r1_생성직후셀.첫열_셀들.every(c => c.opacity < 1))     P.push('① placeholder 인데 흐리게 안 그려진다(CSS 미적용)');
  if (!out.r2_더블클릭.셀이_편집상태)                              P.push('② 더블클릭해도 편집 상태가 아니다');
  if (!out.r2_더블클릭.전체선택인가)                                P.push('② 더블클릭 시 전체선택이 안 된다 — 지웠다 다시 써야 한다');
  if (!out.r3_첫타이핑.통째교체됨)                                  P.push('③ 첫 타이핑이 기본문구를 교체하지 못했다: ' + JSON.stringify(out.r3_첫타이핑.셀글자));
  if (!out.r4_비우고blur.복원됨)                                   P.push('④ 비운 뒤 기본문구 복원 실패');
  if (!out.r5_행추가새셀.새행_전부빈값)                            P.push('⑤ 「행 +」 로 추가한 새 행에 글자가 들어있다');
  if (out.r6_대조텍스트블록 && !out.r6_대조텍스트블록.전체선택인가) P.push('⑥ 대조군(텍스트 블록)이 전체선택이 아니다 — 기준 자체를 다시 재라');

  cdp.close();
  console.log(JSON.stringify(out, null, 2));
  console.log(P.length ? `\n✖ 문제 ${P.length}건` : '\n✔ ⑴ 통과 — 문제 0건');
  process.exit(P.length ? 1 : 0);
})().catch(e => { console.error('⛔', e.message); process.exit(2); });
