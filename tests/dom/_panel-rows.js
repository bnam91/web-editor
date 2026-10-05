/* _panel-rows.js — 묶음 B(2026-10-05 태양) «새 블럭 → 패널을 연다 → 패널 값 == 그려진 값» 한 벌의 자(행 표).
 * DOM 시험(panel-shows-rendered.dom.spec.js)과 실앱 범위표 스크립트($S/b/real/run.mjs)가 «같은 표»를 쓴다(두 벌 금지).
 * 행 = { id, item, make, target, open, panel, kind, drawn, note }
 *   make   : 페이지에서 돌릴 JS 본문 — 섹션 #sB 가 골라진 채로 앱 함수(add*)로 새 블럭을 만들고 window.__blk 에 넣는다.
 *   target : 누를 요소를 돌려주는 JS 식(window.__blk 기준) — 실앱 순서의 «고르기»(그 요소 가운데를 진짜로 누른다).
 *   open   : 'click'(캔버스에서 누름) | 'layer-row'(레이어 패널 행 머리 — 행 패널은 그 길로만 열린다)
 *   panel  : 패널 칸 셀렉터 · kind: 'num'(숫자) | 'hex'(색 hex 칸 6자리)
 *   drawn  : 그려진 값을 돌려주는 JS 식(window.__blk 기준) — num 은 수 · hex 는 'rgb(..)' 문자열
 * ⛔고정 대기 없음 — 시험 쪽이 상태 대기를 한다. */
const PX = (sel, prop) => `(() => { const e = ${sel}; return e ? Math.round(parseFloat(getComputedStyle(e)['${prop}']) || 0) : null; })()`;
const CO = (sel, prop) => `(() => { const e = ${sel}; return e ? getComputedStyle(e)['${prop}'] : null; })()`;
const B = 'window.__blk';
const plainFill = (cls) => `[...${B}.querySelectorAll('${cls}')].find(e => !e.style.background && !e.style.backgroundColor)`;

const ROWS = [
  /* E105~E110(그래프) — 묶음 B 에서 뺌(팀장 2026-10-05: 릴리스 후 «그래프 패널 묶음» · 13≠20/E149 와 함께 · E108~E110 은 H6 자동 밝기와 충돌 → 설계 필요). 행은 격리 사본(quarantine bundle-b-wip-20261005-1603)에 있다. */
  { id: 'E111', item: '디바이더 위아래 여백', make: `window.addDividerBlock(); window.__blk = [...document.querySelectorAll('#sB .divider-block')].pop();`,
    target: `${B}`, open: 'click', panel: '#dvd-pady-number', kind: 'num', drawn: PX(`${B}`, 'paddingTop') },
  { id: 'E112', item: '태그 그룹 항목 높이(전체)', make: `window.addLabelGroupBlock(); window.__blk = [...document.querySelectorAll('#sB .label-group-block')].pop();`,
    target: `${B}.querySelector('.label-item')`, open: 'click', panel: '#lg-all-height-number', kind: 'num',
    drawn: `(() => { const e = ${B}.querySelector('.label-item'); const c = getComputedStyle(e); return Math.round(parseFloat(c.paddingTop) + parseFloat(c.paddingBottom)); })()` },
  { id: 'E113', item: '라벨(T▾ Label) 모서리', make: `window.addTextBlock('label'); window.__blk = [...document.querySelectorAll('#sB .text-block')].pop();`,
    target: `${B}.querySelector('.tb-label')`, open: 'click', panel: '#label-radius-number', kind: 'num', drawn: PX(`${B}.querySelector('.tb-label')`, 'borderTopLeftRadius') },
  { id: 'E114', item: '프레임 테두리 두께(만들 때 준 테두리 — MCP 꼴)', make: `window.addFrameBlock({ border: { width: 3, color: '#333333' } }); window.__blk = [...document.querySelectorAll('#sB .frame-block:not([data-text-frame])')].pop();`,
    target: `${B}`, open: 'click', panel: '#ss-border-w-num', kind: 'num', drawn: PX(`${B}`, 'borderTopWidth') },
  { id: 'E115', item: '프레임 위아래 여백(만들 때 준 padding — MCP 꼴)', make: `window.addFrameBlock({ padding: 24 }); window.__blk = [...document.querySelectorAll('#sB .frame-block:not([data-text-frame])')].pop();`,
    target: `${B}`, open: 'click', panel: '#ss-pady-num', kind: 'num', drawn: PX(`${B}`, 'paddingTop') },
  /* E116(가로 행 간격 · prop-row.js) — lane-b2 에서 뺌(팀장 2026-10-05): 지금 앱에서 Row 패널에 닿는 사용자 길을 못 찾았다 → 명부 E158(실앱 측정부터). */
  { id: 'E117', item: '표 좌우 여백', make: `window.addTableBlock(); window.__blk = [...document.querySelectorAll('#sB .table-block')].pop();`,
    target: `${B}`, open: 'click', panel: '#tbl-padx-number', kind: 'num', drawn: PX(`${B}`, 'paddingLeft') },
  { id: 'E118', item: '심플카드 제목 색', make: `window.addCanvasBlock(); window.__blk = [...document.querySelectorAll('#sB .canvas-block')].pop();`,
    target: `${B}`, open: 'click', panel: '#cvb-title-color-hex', kind: 'hex', drawn: CO(`${B}.querySelector('.cvb-card-title')`, 'color') },
  { id: '#18', item: '비교 블럭 칸 배경(색 없이 준 칸 — MCP 꼴)', make: `window.addComparisonBlock({ cols: [{ title: 'A', rows: ['a'] }, { title: 'B', rows: ['b'] }], featured: 1 }); window.__blk = [...document.querySelectorAll('#sB .comparison-block')].pop();`,
    target: `${B}`, open: 'click', panel: '#cmp-c0Bg-hex', kind: 'hex', drawn: CO(`${B}.querySelector('.cmp-col[data-col-idx="0"]')`, 'backgroundColor') },
  { id: 'E119a', item: '형광펜 스티커 색(사용자 rgba)', make: `window.addStickerBlock({ shape: 'highlight', hlColor: 'rgba(0, 200, 255, 0.5)' }); window.__blk = [...document.querySelectorAll('.sticker-block')].pop();`,
    target: `${B}`, open: 'click', panel: '#stk-hl-color-hex', kind: 'hex', drawn: CO(`${B}`, 'backgroundColor') },
  { id: 'E119b', item: '아이콘 스티커 색(색 안 준 것)', make: `window.addStickerBlock({ shape: 'icon', iconName: 't:dot', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/></svg>', size: 60 }); window.__blk = [...document.querySelectorAll('.sticker-block')].pop();`,
    target: `${B}`, open: 'click', panel: '#stk-icon-color-hex', kind: 'hex', drawn: CO(`${B}`, 'color') },
  /* #16(지디 승인) — 글자 굵기: 칸 · B 켜짐. B «토글 동작»은 행이 아니라 spec 의 따로 시험(W3)이다. */
  { id: '#16a', item: 'T▾ Heading 굵기 칸', make: `window.addTextBlock('h2'); window.__blk = [...document.querySelectorAll('#sB .text-block')].pop();`,
    target: `${B}.querySelector('.tb-h2')`, open: 'click', panel: '#txt-font-weight', kind: 'num', drawn: `parseInt(getComputedStyle(${B}.querySelector('.tb-h2')).fontWeight, 10)` },
  { id: '#16b', item: 'T▾ Heading B 단추 켜짐', make: `window.addTextBlock('h2'); window.__blk = [...document.querySelectorAll('#sB .text-block')].pop();`,
    target: `${B}.querySelector('.tb-h2')`, open: 'click', panel: '#txt-bold-btn', kind: 'active', drawn: `parseInt(getComputedStyle(${B}.querySelector('.tb-h2')).fontWeight, 10) >= 600` },
  /* 지킴(✓→✓) — E121 라벨 알약 높이: 이미 _panel-rendered 를 쓴다(이 묶음이 건드리지 않는다). */
  { id: 'G-E121', item: '지킴 — 라벨 알약 높이(E121)', guard: true, make: `window.addTextBlock('label'); window.__blk = [...document.querySelectorAll('#sB .text-block')].pop();`,
    target: `${B}.querySelector('.tb-label')`, open: 'click', panel: '#label-pill-height-number', kind: 'num',
    drawn: `(() => { const c = getComputedStyle(${B}.querySelector('.tb-label')); return Math.round(parseFloat(c.paddingTop) + parseFloat(c.paddingBottom)); })()` },
];
const toHex = (c) => { const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(String(c || '')); return m ? [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join('').toUpperCase() : null; };
module.exports = { ROWS, toHex };
