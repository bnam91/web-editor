/* tools/panel-parts/det.js — 우측패널 부품 판정기(카탈로그 v2 · 탑 261123). 브라우저 쪽 한 벌 — 앱(DOM 하네스)·시안(8910 시안 파일) 둘 다 이 코드를 그대로 싣는다.
 * window.__partsDet(panelBody, defaults) → [{ sec, key, parts: { <data-part>: 'ok' | 'var:까닭' | n }, ownerless: [..], missing: [..], extra: [..], unnamed }]
 * 부품 이름 = 태양 PLAN-ds-parts-state-261123 §2 «부품 이름 한 벌»(data-part 값과 한 낱말): row · number · slider · toggle · select · color · tip · align-group · chain · end-slot · fx-card · rot.
 * ★주인 없는 컨트롤 = 보이는 input/select/textarea/button 가운데 어느 부품 셀렉터에도 안 걸린 것(레드팀 2차 ① — 앱 Fill 9곳이 색 칸 0 으로 «사라지던» 것을 드러냄).
 * ★이름 없는 절(머리 글 0 · kind 아님) = unnamed true → 카탈로그에서 빨강. defaults = _section-spec.js SECTION_DEFAULTS(절 key → 부품 목록). */
window.__partsDet = function (body, defaults) {
  defaults = defaults || {};
  const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const R = (e) => e.getBoundingClientRect();
  const PLUS = 'M6 2v8M2 6h8';
  // 부품 → 주인 셀렉터(그 안의 컨트롤은 그 부품 것)
  const OWN = {
    color: '.prop-color-field, .prop-color-row input[type=color], .cv-chips, .cv-chip',
    number: '.prop-icon-input, input.prop-number',
    slider: 'input.prop-slider',
    toggle: 'label.prop-toggle, label.ui-check',   // ui-check = 태양 부품 check(현빈 261123 온/오프 = 커스텀 체크박스) · 부품 키 이름 toggle→check 는 태양 PART_NAMES 바뀔 때 같이
    select: 'select.prop-select',
    'align-group': '.prop-align-group, .prop-style-group',
    chain: '.prop-chain-btn:not(.prop-chain-btn--overlay)',
    'end-slot': '.prop-sec-head button, .prop-sec-head label, .prop-sec-head input, .prop-chain-btn--overlay, .prop-sec-add',
    'fx-card': '.prop-cell-card[data-fx-type], .prop-cell-card',
    rot: '.prop-rot-row',
  };
  const out = [];
  const secs = [...body.children].filter((x) => x.classList && x.classList.contains('prop-section') && vis(x));
  for (const s of secs) {
    const key = s.dataset.sec || '';
    const titleEl = s.querySelector(':scope > .prop-sec-head .prop-sec-title-text');
    const title = titleEl ? titleEl.textContent.trim() : '';
    const isHeader = !key && s === secs[0] && !!s.querySelector('.prop-block-label, .prop-block-header, [class*="block-label"]');   // 맨 앞 이름표 머리(게이트 규칙 «머리 없는 절은 맨 앞 header 만»)
    const sec = key === 'kind' ? 'Kind' : (isHeader ? 'Header' : (title || '?'));
    const sr = R(s), bodyEnd = sr.right - 8 - 28;
    const inS = (sel) => [...s.querySelectorAll(sel)].filter(vis);
    const P = {}, present = new Set();
    // row
    const rows = inS('.prop-row, .prop-color-row').filter((r) => !r.parentElement.closest('.prop-row, .prop-color-row'));
    if (rows.length) { present.add('row'); const bad = []; rows.forEach((r) => { const lab = r.querySelector(':scope > .prop-label'); const last = [...r.children].filter(vis).pop();
      const endslot = last && last.matches('.prop-chain-btn, .prop-icon-btn, .prop-sec-add') && R(last).left >= bodyEnd - 1; const wide = r.classList.contains('prop-row--wide');
      if (R(r).right > bodyEnd + 1 && !endslot && !wide) bad.push('칼럼 침범'); if (r.scrollWidth > r.clientWidth) bad.push('줄 잘림');
      if (lab && lab.scrollWidth > lab.clientWidth) bad.push('라벨 잘림'); });
      P.row = bad.length ? 'var:' + [...new Set(bad)].join('·') + ' ' + bad.length + '/' + rows.length : 'ok'; }
    // number(P1) — 접두칸 또는 슬라이더 짝 숫자
    const nums = inS('input[type=number]');
    if (nums.length) { present.add('number'); const bare = nums.filter((i) => !i.closest('.prop-icon-input') && !(i.closest('.prop-row') && i.closest('.prop-row').querySelector('.prop-slider'))); P.number = bare.length ? 'var:맨 숫자 칸 ' + bare.length + '/' + nums.length : 'ok'; }
    // slider(P2)
    const sl = inS('input.prop-slider, input[type=range]');
    if (sl.length) { present.add('slider'); const lone = sl.filter((x) => !(x.closest('.prop-row') && x.closest('.prop-row').querySelector('input[type=number]'))); P.slider = lone.length ? 'var:숫자 짝 없음 ' + lone.length + '/' + sl.length : 'ok'; }
    // toggle(P3) — 규칙: 이진 = 토글 · 상호배타 = select(글)/align-group(아이콘) · 목록 = 체크박스
    const tg = inS('label.prop-toggle, label.ui-check'), cb = inS('input[type=checkbox]').filter((c) => !c.closest('label.prop-toggle, label.ui-check') && !c.closest('.prop-sec-head') && !c.closest('[data-sec-item]')), rad = inS('input[type=radio]');
    if (tg.length || cb.length || rad.length) { present.add('toggle'); const why = []; if (cb.length) why.push('이진인데 체크박스 ' + cb.length); const g = {}; rad.forEach((r) => { g[r.name || 'x'] = (g[r.name || 'x'] || 0) + 1; }); const bin = Object.values(g).filter((n) => n === 2).length; if (bin) why.push('켬/끔 라디오 ' + bin); P.toggle = why.length ? 'var:' + why.join(' · ') : 'ok'; }
    // select(P4)
    // ★Stroke 의 select = «위치»(태양 §4b·§4c · 지디 261123 «위치/스타일 갈라 세라») — 값이 안쪽/가운데/바깥(내부/중앙/외부)인 것만 select 로 셈 · 실선/점선 같은 스타일 select 는 따로(P['select-style'])
    const POS = /^(안쪽|가운데|바깥|내부|중앙|외부|inside|center|outside)$/i, isPos = (x) => x.dataset.field === 'stroke-align' || (x.dataset.field !== 'stroke-style' && [...x.options].some((o) => POS.test(o.textContent.trim())));   // 태양 §4c: data-field 로 가름(stroke-align = 위치 · stroke-style = 스타일 · 특수 슬롯) · data-field 없는 옛 꼴은 값으로
    const sels = inS('select'), selsFor = key === 'stroke' ? sels.filter(isPos) : sels, styleN = key === 'stroke' ? sels.length - selsFor.length : 0;
    if (selsFor.length) { present.add('select'); const b = selsFor.filter((x) => !x.classList.contains('prop-select')); P.select = b.length ? 'var:prop-select 아님 ' + b.length : 'ok'; }
    if (styleN) P['select-style'] = styleN + ' 스타일 select(위치 아님)';
    // color(P5)
    const cr = inS('.prop-color-row, .prop-row').filter((r) => r.querySelector(':scope input[type=color], :scope .prop-color-swatch, :scope .prop-color-field'));
    if (cr.length) { present.add('color'); const bare = cr.filter((r) => !r.querySelector('.prop-color-field')); P.color = bare.length ? 'var:스와치+HEX만 ' + bare.length + '/' + cr.length : 'ok'; }
    // tip(P6) — 속성 부품: data-tip 수 · 브라우저 기본 title 수(옮길 후보)
    const dtip = inS('[data-tip]').length, ttl = inS('[title]').length; if (dtip || ttl) { present.add('tip'); P.tip = dtip + ' data-tip · ' + ttl + ' title'; }
    // align-group
    const al = inS('.prop-align-group').filter((g) => g.querySelectorAll('.prop-align-btn').length >= 2 && !g.closest('.prop-rot-row')); if (al.length) { present.add('align-group'); P['align-group'] = 'ok'; }
    // chain
    const ch = inS('.prop-chain-btn:not(.prop-chain-btn--overlay)'); if (ch.length) { present.add('chain'); const inBody = ch.filter((b) => R(b).left < bodyEnd - 1); P.chain = inBody.length ? 'var:몸 안 ' + inBody.length : 'ok'; }
    // end-slot — 절 머리 ＋ 또는 오버레이 띄우기 단추
    const head = s.querySelector(':scope > .prop-sec-head'); const plus = head && (head.querySelector('.prop-sec-add, button, label') || [...head.querySelectorAll('path')].some((x) => (x.getAttribute('d') || '').replace(/\s/g, '') === PLUS));
    const ov = inS('.prop-chain-btn--overlay'); const needPlus = /^(stroke|effects)$/.test(key) && !plus;
    if (plus || ov.length || needPlus) { present.add('end-slot'); P['end-slot'] = needPlus ? 'var:머리 ＋ 없음' : 'ok'; }
    // fx-card — 정본 꼴: header(눈 aria-pressed · 제목 · ✕ aria-label) + body
    const cards = inS('.prop-cell-card[data-fx-type]'); if (cards.length) { present.add('fx-card');   // 효과 카드만(스타일 번호 카드 등 다른 .prop-cell-card 는 부품 아님 · 주인으론 셈)
    const bad = cards.filter((c) => { const h = c.querySelector(':scope > .prop-cell-card-header'); return !h || !h.querySelector('[aria-pressed]') || !h.querySelector('.prop-cell-card-title') || ![...h.querySelectorAll('button')].some((b) => /삭제|✕|×/.test((b.getAttribute('aria-label') || '') + b.textContent)); }); P['fx-card'] = bad.length ? 'var:정본 꼴 아님 ' + bad.length + '/' + cards.length : 'ok'; }
    // rot
    if (inS('.prop-rot-row').length) { present.add('rot'); P.rot = 'ok'; }
    // 주인 없는 컨트롤
    const ownSel = Object.values(OWN).join(', ');
    const ownerless = inS('input, select, textarea, button').filter((e) => e.type !== 'hidden' && !e.closest(ownSel) && !e.matches(ownSel))
      .map((e) => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.type ? ':' + e.type : '') + (e.className ? '.' + String(e.className).split(' ')[0] : '')) + ((e.closest('.prop-row') && e.closest('.prop-row').querySelector('.prop-label')) ? '(' + e.closest('.prop-row').querySelector('.prop-label').textContent.trim().slice(0, 10) + ')' : ''));
    // 기본 항목 대비
    const def = defaults[key] || null;
    const missing = def ? def.filter((p) => !present.has(p)) : [];
    const extra = def ? [...present].filter((p) => !def.includes(p) && p !== 'row' && p !== 'tip') : [];
    out.push({ sec, key, parts: P, ownerless, missing, extra, unnamed: sec === '?' });
  }
  return out;
};
