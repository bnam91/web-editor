#!/usr/bin/env node
/* ⑶ 「행별 높이 = 기본 접힘, 펼치면 입력칸이 다 나온다」 검증.
 *
 *   PORT=9334 node tools/table-ux-probe/check3-rowh-collapse.js
 *
 * 무엇을 재나
 *   ① 테이블 선택 직후: #tbl-rowh-body display=none, aria-expanded=false,
 *      행별 입력칸 «보이는 개수» 0 (offsetParent=null 로 실측 — hidden 은 display 클래스에 진다)
 *   ② 접힘이 실제로 패널을 짧게 만드는가 — 접힘/펼침 패널 scrollHeight 차이(px)
 *   ③ 진짜 클릭으로 펼치면: display=block, aria-expanded=true,
 *      «보이는» 입력칸 수 == tbody 행 수, 전부 offsetHeight>0
 *   ④ 각 입력칸이 그 행에 실제로 물려 있나 — 3행에 133px 넣고 tr.style.height 확인 후 원복
 *   ⑤ 행을 추가해 패널이 재생성돼도 펼침 상태가 유지되고 칸이 1개 늘어나는가
 *   ⑥ 새 접기 UI 를 «만들지 않았다»는 확인 — 헤더가 기존 클래스(prop-section-title)를 쓰는가
 *   ⑦ ⌘M(셀 병합) 등 기존 단축키에 손대지 않았는지 — 토글 헤더가 키를 삼키지 않는가
 *
 * ⚠️①의 테이블은 끝에 지운다. 스크래치 프로젝트에서 돌려라.
 */
'use strict';
const { connect } = require('./_cdp');

(async () => {
  const cdp = await connect();
  const out = { env:{}, r1_기본접힘: null, r2_패널길이: null, r3_펼침: null,
                r4_칸이행에물렸나: null, r5_행추가후: null, r6_기존UI재사용: null, 문제: [] };

  const mk = await cdp.evaluate(`
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
    b.click(); await new Promise(r => setTimeout(r, 300));
    return { ok:true, id:b.id, 본문행수: b.querySelectorAll('tbody tr').length };`);
  if (!mk.ok) { console.error('⛔' + mk.why); process.exit(2); }
  out.env = mk;

  const READ = `
    const b = document.getElementById(window.__probeTblId);
    const head = document.getElementById('tbl-rowh-toggle');
    const body = document.getElementById('tbl-rowh-body');
    const inputs = [...document.querySelectorAll('.tbl-row-h-item')];
    const 보이는 = inputs.filter(i => i.offsetParent !== null && i.offsetHeight > 0);
    return {
      헤더있나: !!head, 본문있나: !!body,
      display: body ? body.style.display : null,
      computedDisplay: body ? getComputedStyle(body).display : null,
      ariaExpanded: head ? head.getAttribute('aria-expanded') : null,
      입력칸_DOM수: inputs.length,
      입력칸_보이는수: 보이는.length,
      tbody행수: b.querySelectorAll('tbody tr').length,
      본문_높이px: body ? body.getBoundingClientRect().height : null,
      // 우측 속성 패널 실체 = #panel-right .panel-body (globals.js:4)
      패널_scrollHeight: document.querySelector('#panel-right .panel-body')?.scrollHeight ?? null,
    };`;

  out.r1_기본접힘 = await cdp.evaluate(READ);

  // ── ⑥ 기존 접기 UI 재사용 확인 (룩어라이크 신작 금지) ─────────────────
  out.r6_기존UI재사용 = await cdp.evaluate(`
    const head = document.getElementById('tbl-rowh-toggle');
    if (!head) return { 헤더없음: true };
    return {
      className: head.className,
      prop_section_title_쓰는가: head.classList.contains('prop-section-title'),
      role: head.getAttribute('role'),
      tabindex: head.getAttribute('tabindex'),
      쉐브론_svg있나: !!head.querySelector('svg polyline'),
      // 이 페이지의 다른 prop-section-title 과 «같은 글꼴/색»인가 = 룩어라이크 아님의 증거
      내_스타일: (cs => ({ fontSize: cs.fontSize, color: cs.color, textTransform: cs.textTransform }))(getComputedStyle(head)),
      남의_스타일: (() => { const o = [...document.querySelectorAll('.prop-section-title')]
                              .find(e => e.id !== 'tbl-rowh-toggle');
                           if (!o) return null; const cs = getComputedStyle(o);
                           return { fontSize: cs.fontSize, color: cs.color, textTransform: cs.textTransform }; })(),
    };`);

  // ── ③ 진짜 클릭으로 펼치기 ────────────────────────────────────────────
  const hr = await cdp.evaluate(`
    const head = document.getElementById('tbl-rowh-toggle');
    if (!head) return { ok:false };
    head.scrollIntoView({ block:'center' }); await new Promise(r => setTimeout(r, 200));
    const r = head.getBoundingClientRect();
    return { ok:true, x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };`);
  if (!hr.ok) { console.error('⛔#tbl-rowh-toggle 이 없다 — ③ 미구현'); cdp.close(); process.exit(1); }
  await cdp.click(hr.x, hr.y);
  out.r3_펼침 = await cdp.evaluate(READ);

  out.r2_패널길이 = {
    접힘_scrollHeight: out.r1_기본접힘.패널_scrollHeight,
    펼침_scrollHeight: out.r3_펼침.패널_scrollHeight,
    절약된px: (out.r3_펼침.패널_scrollHeight ?? 0) - (out.r1_기본접힘.패널_scrollHeight ?? 0),
    접힘본문높이: out.r1_기본접힘.본문_높이px,
    펼침본문높이: out.r3_펼침.본문_높이px,
  };

  // ── ④ 입력칸 ↔ 행 결선 ────────────────────────────────────────────────
  out.r4_칸이행에물렸나 = await cdp.evaluate(`
    const b = document.getElementById(window.__probeTblId);
    const inp = [...document.querySelectorAll('.tbl-row-h-item')].find(i => i.dataset.ri === '2');
    if (!inp) return { 입력칸없음: true };
    const tr = b.querySelectorAll('tbody tr')[2];
    const 전 = tr.style.height;
    inp.value = '133'; inp.dispatchEvent(new Event('change', { bubbles:true }));
    await new Promise(r => setTimeout(r, 150));
    const 후 = tr.style.height;
    const 실측 = Math.round(tr.getBoundingClientRect().height);
    inp.value = '';   inp.dispatchEvent(new Event('change', { bubbles:true }));   // 원복
    await new Promise(r => setTimeout(r, 150));
    return { 전, 후, 복원: tr.style.height, 인라인_133됐나: 후 === '133px', 실측높이: 실측 };`);

  // ── ⑤ 행 추가 후 펼침 유지 ────────────────────────────────────────────
  out.r5_행추가후 = await cdp.evaluate(`
    const 전 = document.querySelectorAll('.tbl-row-h-item').length;
    document.getElementById('tbl-row-plus')?.click();
    await new Promise(r => setTimeout(r, 350));
    const head = document.getElementById('tbl-rowh-toggle');
    const body = document.getElementById('tbl-rowh-body');
    const inputs = [...document.querySelectorAll('.tbl-row-h-item')];
    return { 입력칸_전: 전, 입력칸_후: inputs.length,
             하나_늘었나: inputs.length === 전 + 1,
             펼침유지: body ? body.style.display !== 'none' : null,
             ariaExpanded: head ? head.getAttribute('aria-expanded') : null,
             보이는수: inputs.filter(i => i.offsetParent !== null).length };`);

  // ── ⑦ 토글 헤더가 다른 단축키를 «삼키지» 않는가 (⌘M=셀 병합 보호) ─────
  //     헤더의 keydown 핸들러는 Enter/Space 만 preventDefault 해야 한다.
  out.r7_단축키무접촉 = await cdp.evaluate(`
    const head = document.getElementById('tbl-rowh-toggle');
    if (!head) return { 헤더없음: true };
    const fire = (init) => { const ev = new KeyboardEvent('keydown', { bubbles:true, cancelable:true, ...init });
                             head.dispatchEvent(ev); return ev.defaultPrevented; };
    return {
      cmdM_막혔나:  fire({ key:'m', code:'KeyM', metaKey:true }),   // false 여야 정상(⌘M 통과)
      Escape_막혔나: fire({ key:'Escape', code:'Escape' }),          // false 여야 정상
      Enter_막혔나:  fire({ key:'Enter',  code:'Enter'  }),          // true 여야 정상(토글이 먹음)
      Space_막혔나:  fire({ key:' ',      code:'Space'  }) };`);

  // 정리
  await cdp.evaluate(`
    const b = window.__probeTblId && document.getElementById(window.__probeTblId);
    if (b) (b.closest('.row') || b).remove();
    delete window.__probeTblId;
    window.deselectAll?.(); window.buildLayerPanel?.();
    return true;`);

  // ── 판정 ────────────────────────────────────────────────────────────────
  const P = out.문제;
  if (!out.r1_기본접힘.헤더있나)                        P.push('① 「행별 높이」 토글 헤더가 없다');
  if (out.r1_기본접힘.computedDisplay !== 'none')       P.push('① 기본 접힘이 아니다: computed display=' + out.r1_기본접힘.computedDisplay);
  if (out.r1_기본접힘.ariaExpanded !== 'false')         P.push('① aria-expanded 가 false 가 아니다: ' + out.r1_기본접힘.ariaExpanded);
  if (out.r1_기본접힘.입력칸_보이는수 !== 0)            P.push('① 접혔는데 입력칸이 ' + out.r1_기본접힘.입력칸_보이는수 + '개 보인다');
  if ((out.r2_패널길이.절약된px ?? 0) <= 0)             P.push('② 접어도 패널이 안 짧아진다(절약 ' + out.r2_패널길이.절약된px + 'px)');
  if (out.r3_펼침.computedDisplay === 'none')           P.push('③ 클릭해도 안 펼쳐진다');
  if (out.r3_펼침.ariaExpanded !== 'true')              P.push('③ 펼쳤는데 aria-expanded 가 true 가 아니다');
  if (out.r3_펼침.입력칸_보이는수 !== out.r3_펼침.tbody행수)
    P.push(`③ 펼쳤을 때 보이는 입력칸 ${out.r3_펼침.입력칸_보이는수} ≠ 행 수 ${out.r3_펼침.tbody행수}`);
  if (!out.r4_칸이행에물렸나.인라인_133됐나)          P.push('④ 행별 높이 입력이 그 행에 안 먹는다');
  if (out.r4_칸이행에물렸나.복원 !== '')              P.push('④ 원복 실패 — 인라인 height 잔류: ' + out.r4_칸이행에물렸나.복원);
  if (!out.r5_행추가후.하나_늘었나)                    P.push('⑤ 행 추가 후 입력칸이 안 늘었다');
  if (out.r5_행추가후.펼침유지 !== true)               P.push('⑤ 행 추가로 패널이 재생성되며 펼침 상태가 날아갔다');
  if (out.r6_기존UI재사용.prop_section_title_쓰는가 !== true) P.push('⑥ 기존 접기 UI(prop-section-title)를 안 쓰고 새로 만들었다');
  if (out.r6_기존UI재사용.남의_스타일 &&
      JSON.stringify(out.r6_기존UI재사용.내_스타일) !== JSON.stringify(out.r6_기존UI재사용.남의_스타일))
    P.push('⑥ 다른 prop-section-title 과 렌더 스타일이 다르다 — 룩어라이크 의심');
  if (out.r7_단축키무접촉.cmdM_막혔나 === true)  P.push('⑦ 토글 헤더가 ⌘M 을 삼킨다 — 셀 병합이 죽는다');
  if (out.r7_단축키무접촉.Enter_막혔나 === false) P.push('⑦ Enter 로 토글이 안 된다(role=button 인데 키보드 미지원)');

  cdp.close();
  console.log(JSON.stringify(out, null, 2));
  console.log(P.length ? `\n✖ 문제 ${P.length}건` : '\n✔ ⑶ 통과 — 문제 0건');
  process.exit(P.length ? 1 : 0);
})().catch(e => { console.error('⛔', e.message); process.exit(2); });
