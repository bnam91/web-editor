/* grid-cell-border — T-172 「그리드 칸에 «테두리»를 만든다」의 «값»과 «화면» 두 축.
 * 실행: node --test tests/unit/grid-cell-border.test.js   ·  라이브 userData 무접촉.
 *
 * ═══ 이 카드가 왜 멈춰 있었나 (카드 본문 · 지디 보고) ══════════════════════
 *   앞선 시도는 테두리를 «칸 필드»로 놓았고, 그 순간 세 검사가 동시에 참일 수 없었다:
 *     ⑴ 어떤 줄은 테두리가 «찍히기»를 요구하고
 *     ⑵ 다른 줄은 GRID_CELL_FIELDS 선언이 «여섯 그대로»이기를 요구하고
 *     ⑶ 제3의 검사가 그 명부와 렌더러의 등호를 강제한다.
 *   ⇒ 이 구현은 그 삼각형을 «푸는» 대신 «안 들어간다» — 테두리를 «블록 축»에 둔다.
 *     칸 축(GRID_CELL_FIELDS)을 한 글자도 안 건드리므로 ⑵·⑶은 애초에 안 걸린다.
 *     B9 가 그 사실을 «소스 독해»가 아니라 «그 세 검사를 실제로 돌려» 대는 것은 아니다 —
 *     그건 전수(npm test)의 몫이다. 여기선 이 파일이 맡은 두 축만 잰다.
 *
 * ═══ 재는 것 ═══════════════════════════════════════════════════════════════
 *   B0  계측기 — 테두리 «없는» 판에는 border-top/left/right/bottom 이 한 글자도 없다
 *                (그래야 아래 검사들의 초록이 「원래 있던 것」이 아니다)
 *   B1  값     — 세 키를 받고 dataset 에 남는다 · applied 가 그 값을 말한다
 *   B2  화면   — 네 칸 «전부»에 네 변이 실제로 찍힌다
 *   B3  거절   — 굵기/색/꼴이 «틀리면» ok:false 고 ★dataset 이 안 변한다(효과판정)
 *   B4  ★꼴 보존 — dashed 를 주면 dashed 로 그려진다(카드가 못박은 「조용한 실선 강등」 봉쇄)
 *   B5  겹침   — 간격 0 이면 안쪽 선이 «한 벌»(선이 두 배로 안 굵어진다)
 *   B6  읽는 쪽 검증 — dataset 에 «손으로» 심은 쓰레기 색이 CSS 로 안 샌다
 *   B7  롤백   — 렌더가 터지면 테두리 세 키도 «되돌아온다»(되돌림 명부에 들어 있다)
 *   ★B8·B9·B10 «양성대조» — 기능을 빼면 위 검사들이 빨개지는가
 *       B8  렌더러에서 테두리 CSS 호출을 빼면 → B2 가 빨강
 *       B9  꼴을 solid 로 «강등»시키면      → B4 가 빨강 (B2 는 «초록인 채로» 남는다)
 *       B10 겹침 규칙을 걷으면              → B5 가 빨강
 *   ⛔B9 를 따로 두는 까닭 — 「선이 그려진다」만 재면 파선이 실선으로 떨어져도 초록이다.
 *     그게 카드가 이름 붙인 «새 거짓 성공»이고, 그걸 잡는 눈은 B2 가 아니라 B4 다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { readSrc } = require('./_srcread.js');   // ★CRLF 체크아웃 방어(윈도우 core.autocrlf=true)

const RAW = readSrc(path.join(__dirname, '../../js/blocks/grid-block.js'));

/* ── 미니 DOM (grid-row0-lines-invariant.test.js 와 «같은 표면» — 새 하네스를 발명하지 않는다) ── */
function makeFakeDom() {
  const registry = new Map();
  function createElement(tag) {
    let _id = '', _classes = new Set();
    const el = {
      tagName: tag, dataset: {}, style: {}, innerHTML: '',
      get id() { return _id; },
      set id(v) { if (_id) registry.delete(_id); _id = v; if (v) registry.set(v, el); },
      get className() { return [..._classes].join(' '); },
      set className(v) { _classes = new Set(String(v).split(/\s+/).filter(Boolean)); },
      classList: {
        contains: (c) => _classes.has(c),
        add: (...cs) => cs.forEach(c => _classes.add(c)),
        remove: (...cs) => cs.forEach(c => _classes.delete(c)),
        replace: (a, b) => { if (!_classes.has(a)) return false; _classes.delete(a); _classes.add(b); return true; },
      },
      appendChild(child) { return child; },
      scrollIntoView() {},
    };
    return el;
  }
  return { createElement, getElementById: (id) => registry.get(id) || null };
}

let seq = 0;
async function loadModule(mutate) {
  let src = RAW;
  const beforeStub = src;
  src = src.replace(
    "import { insertAfterSelected, genId } from '../drag-utils.js';\nimport { bindBlock } from '../drag-drop.js';\n",
    "const insertAfterSelected = () => {};\nconst genId = (p) => `${p}_` + Math.random().toString(36).slice(2, 9);\nconst bindBlock = () => {};\n"
  );
  assert.notEqual(src, beforeStub, '소스에서 drag-utils/drag-drop import 2줄을 못 찾음 — 리팩터링됐나?');

  const gcrAlias = path.join(os.tmpdir(), `grid-bd-gcr-${process.pid}-${seq}.mjs`);
  fs.copyFileSync(path.join(__dirname, '../../js/grid-cell-resize.js'), gcrAlias);
  const beforeGcr = src;
  src = src.replace("from '../grid-cell-resize.js'", 'from ' + JSON.stringify(pathToFileURL(gcrAlias).href));
  assert.notEqual(src, beforeGcr, '소스에서 grid-cell-resize.js import 를 못 찾음');

  if (mutate) {
    const beforeMut = src;
    src = mutate(src);
    assert.notEqual(src, beforeMut, '★변이가 주입되지 않았다 — 양성대조가 «아무것도 안 바꾼 채» 돌 뻔했다');
  }
  const aliasPath = path.join(os.tmpdir(), `grid-bd-${process.pid}-${seq++}.mjs`);
  fs.writeFileSync(aliasPath, src);
  globalThis.document = makeFakeDom();
  globalThis.window = {};
  const mod = await import(pathToFileURL(aliasPath).href);
  fs.unlinkSync(aliasPath);
  fs.unlinkSync(gcrAlias);
  return mod;
}

/* ── 변이 셋. ⛔이름이 아니라 «그 한 줄»을 겨눈다(주입 성공을 loadModule 이 그 자리에서 본다). ── */
const M_DROP_RENDER = (src) => {
  const out = src.replace("${_gridCellBorderCss(cellBorder, r, c, rowGapPx, colGapPx)}", '');
  assert.notEqual(out, src, '★닻이 빗나갔다 — 렌더러의 테두리 CSS 호출을 못 찾았다');
  return out;
};
const M_FORCE_SOLID = (src) => {
  const out = src.replace('const line = `${bd.width}px ${bd.style} ${bd.color}`;',
                          'const line = `${bd.width}px solid ${bd.color}`;');
  assert.notEqual(out, src, '★닻이 빗나갔다 — 선 꼴을 쓰는 한 줄을 못 찾았다');
  return out;
};
const M_DROP_COLLAPSE = (src) => {
  const out = src.replace(
    "  const top  = (rowGapPx > 0 || r === 0) ? line : '0';\n  const left = (colGapPx > 0 || c === 0) ? line : '0';\n",
    '  const top  = line;\n  const left = line;\n');
  assert.notEqual(out, src, '★닻이 빗나갔다 — 겹침 규칙 두 줄을 못 찾았다');
  return out;
};
/** ★B7 용 — 렌더러를 «특정 색에서만» 터뜨린다. 통째로 터뜨리면 makeGridBlock 부터 죽는다. */
const M_THROW_ON = (src) => {
  const out = src.replace('  const cellBorder = _gridCellBorder(block);',
    "  const cellBorder = _gridCellBorder(block);\n  if (cellBorder.color === '#bada55') throw new Error('BOOM');");
  assert.notEqual(out, src, '★닻이 빗나갔다 — renderGridBlock 의 테두리 읽는 줄을 못 찾았다');
  return out;
};

const FIX = () => ({
  cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }],
  rows: [{ height: 'auto' }, { height: 'auto' }],
  cells: [
    [{ lines: [{ type: 'body', text: 'A' }] }, { lines: [{ type: 'body', text: 'B' }] }],
    [{ lines: [{ type: 'body', text: 'C' }] }, { lines: [{ type: 'body', text: 'D' }] }],
  ],
});

/** 한 칸의 «인라인 style» 문자열을 좌표로 집는다 — 화면을 «칸 단위»로 가르는 자. */
function cellStyle(block, r, c) {
  const re = new RegExp(`<div class="grd-cell[^"]*" data-r="${r}" data-c="${c}" style="([^"]*)"`);
  const m = String(block.innerHTML).match(re);
  assert.ok(m, `★칸(${r},${c})을 innerHTML 에서 못 찾았다 — 계측기가 겨냥을 잃었다`);
  return m[1];
}
const ALL = [[0, 0], [0, 1], [1, 0], [1, 1]];

/* ══════════════════════════════════════════════════════════════════════════
 * B0 — 계측기. 「없다」가 참인 자리에서 출발한다.
 * ════════════════════════════════════════════════════════════════════════ */
test('B0 ★계측기 — 테두리를 «안 준» 그리드에는 네 변이 한 글자도 없다', async () => {
  const { makeGridBlock } = await loadModule();
  const { block } = makeGridBlock(FIX());
  for (const [r, c] of ALL) {
    const st = cellStyle(block, r, c);
    for (const side of ['border-top', 'border-left', 'border-right', 'border-bottom']) {
      assert.ok(!st.includes(side + ':'),
        `★테두리를 안 줬는데 칸(${r},${c})에 ${side} 가 있다 — 아래 검사들의 초록이 «원래 있던 것»이 된다.\n   style = ${st}`);
    }
  }
  assert.equal(block.dataset.cellBorderWidth, undefined, '★안 준 키가 dataset 에 생겼다 — 옛 저장본이 바뀐다');
});

/* ══════════════════════════════════════════════════════════════════════════
 * B1·B2 — ⑴값을 받나 · ⑵화면에 그려지나
 * ════════════════════════════════════════════════════════════════════════ */
test('B1 ★값 — 세 키를 받아 dataset 에 남기고 applied 로 «그 값»을 말한다', async () => {
  const { makeGridBlock, updateGridBlock } = await loadModule();
  const { block } = makeGridBlock(FIX());
  const res = updateGridBlock(block.id, { cellBorderWidth: 2, cellBorderColor: '#123456', cellBorderStyle: 'dashed' });
  assert.equal(res.ok, true, `★세 키를 거절했다 — ${res.code}: ${res.message}`);
  assert.deepEqual(
    { w: res.applied.cellBorderWidth, c: res.applied.cellBorderColor, s: res.applied.cellBorderStyle },
    { w: 2, c: '#123456', s: 'dashed' },
    `★applied 가 «보낸 값»과 다르다 — ${JSON.stringify(res.applied)}`);
  assert.deepEqual(
    { w: block.dataset.cellBorderWidth, c: block.dataset.cellBorderColor, s: block.dataset.cellBorderStyle },
    { w: '2', c: '#123456', s: 'dashed' },
    '★dataset 에 안 남았다 — 저장본에 안 실린다는 뜻이다');
});

test('B2 ★화면 — 네 칸 «전부»의 네 변에 선이 찍힌다', async () => {
  const { makeGridBlock, updateGridBlock } = await loadModule();
  const { block } = makeGridBlock(FIX());
  /* ★간격을 «양축 다» 벌려 둔다 — 겹침 규칙(B5)이 변을 죽이지 않는 판에서 잰다. */
  updateGridBlock(block.id, { rowGap: 12, colGap: 12 });
  updateGridBlock(block.id, { cellBorderWidth: 3, cellBorderColor: '#ff0000', cellBorderStyle: 'solid' });
  for (const [r, c] of ALL) {
    const st = cellStyle(block, r, c);
    for (const side of ['border-top', 'border-left', 'border-right', 'border-bottom']) {
      assert.ok(st.includes(`${side}:3px solid #ff0000`),
        `★칸(${r},${c}) 의 ${side} 에 선이 없다 — ok:true 인데 화면은 그대로다.\n   style = ${st}`);
    }
  }
});

/* ══════════════════════════════════════════════════════════════════════════
 * B3 — 거절. ★ok:false 는 증거가 아니다 — dataset 이 «안 변했나»까지 본다.
 * ════════════════════════════════════════════════════════════════════════ */
test('B3 ★거절 + 효과판정 — 틀린 값은 막히고 dataset 도 안 변한다', async () => {
  const { makeGridBlock, updateGridBlock } = await loadModule();
  const { block } = makeGridBlock(FIX());
  updateGridBlock(block.id, { cellBorderWidth: 1, cellBorderColor: '#111111', cellBorderStyle: 'dotted' });
  const snap = JSON.stringify({ ...block.dataset });

  const bad = [
    ['굵기 음수', { cellBorderWidth: -1 }],
    ['굵기 상한 초과', { cellBorderWidth: 999 }],
    ['굵기가 글자', { cellBorderWidth: 'thick' }],
    ['색이 CSS 주입꼴', { cellBorderColor: 'red;background:url(x)' }],
    ['색이 빈 값', { cellBorderColor: '' }],
    ['꼴이 명부 밖', { cellBorderStyle: 'double' }],
    ['꼴이 대문자', { cellBorderStyle: 'Dashed' }],
  ];
  for (const [why, partial] of bad) {
    const r = updateGridBlock(block.id, partial);
    assert.equal(r.ok, false, `★${why} — 그대로 받았다(${JSON.stringify(partial)})`);
    assert.equal(r.code, 'INVALID', `★${why} — 거절 코드가 INVALID 가 아니다: ${r.code}`);
    assert.equal(JSON.stringify({ ...block.dataset }), snap,
      `★${why} — ok:false 라면서 dataset 이 변했다. 「막았다」가 «표시»뿐이었다는 뜻이다`);
  }
});

/* ══════════════════════════════════════════════════════════════════════════
 * B4 — ★꼴 보존. 카드가 이름 붙인 «새 거짓 성공»(파선→실선 조용한 강등)을 막는다.
 * ════════════════════════════════════════════════════════════════════════ */
test('B4 ★꼴 — dashed·dotted 가 «그 꼴 그대로» 그려진다 (조용한 실선 강등 없음)', async () => {
  const { makeGridBlock, updateGridBlock } = await loadModule();
  for (const style of ['dashed', 'dotted', 'solid']) {
    const { block } = makeGridBlock(FIX());
    updateGridBlock(block.id, { rowGap: 10, colGap: 10 });
    updateGridBlock(block.id, { cellBorderWidth: 2, cellBorderColor: '#222222', cellBorderStyle: style });
    const st = cellStyle(block, 1, 1);
    assert.ok(st.includes(`border-right:2px ${style} #222222`),
      `★'${style}' 로 줬는데 그 꼴로 안 그려졌다 — 조용한 강등이다.\n   style = ${st}`);
  }
});

/* ══════════════════════════════════════════════════════════════════════════
 * B5 — 겹침. ⛔간격 손잡이를 되살리지 않고 «그리는 쪽»에서 푼다(T-022 함정).
 * ════════════════════════════════════════════════════════════════════════ */
test('B5 ★겹침 — 간격 0 이면 안쪽 선이 «한 벌», 간격이 있으면 칸마다 상자', async () => {
  const { makeGridBlock, updateGridBlock } = await loadModule();

  const { block: tight } = makeGridBlock(FIX());
  updateGridBlock(tight.id, { gap: 0 });
  updateGridBlock(tight.id, { cellBorderWidth: 1, cellBorderColor: '#333333', cellBorderStyle: 'solid' });
  const LINE = '1px solid #333333';
  /* 첫 행·첫 열만 위/왼쪽 선을 든다 ⇒ 이웃 사이에 선이 «하나»다. */
  assert.ok(cellStyle(tight, 0, 0).includes(`border-top:${LINE}`), '★맨 윗줄의 위 선이 없다 — 표의 바깥 테두리가 빈다');
  assert.ok(cellStyle(tight, 0, 0).includes(`border-left:${LINE}`), '★맨 왼쪽 칸의 왼쪽 선이 없다');
  assert.ok(cellStyle(tight, 1, 0).includes('border-top:0'),
    `★간격 0 인데 아랫줄도 위 선을 들었다 — 두 선이 맞붙어 «두 배 굵기»가 된다.\n   style = ${cellStyle(tight, 1, 0)}`);
  assert.ok(cellStyle(tight, 0, 1).includes('border-left:0'),
    `★간격 0 인데 둘째 열도 왼쪽 선을 들었다.\n   style = ${cellStyle(tight, 0, 1)}`);
  /* 바깥은 끝까지 닫혀 있어야 «표»가 된다. */
  assert.ok(cellStyle(tight, 1, 1).includes(`border-right:${LINE}`), '★오른쪽 끝이 안 닫혔다');
  assert.ok(cellStyle(tight, 1, 1).includes(`border-bottom:${LINE}`), '★아래 끝이 안 닫혔다');

  const { block: loose } = makeGridBlock(FIX());
  updateGridBlock(loose.id, { gap: 24 });
  updateGridBlock(loose.id, { cellBorderWidth: 1, cellBorderColor: '#333333', cellBorderStyle: 'solid' });
  for (const [r, c] of ALL) {
    const st = cellStyle(loose, r, c);
    assert.ok(st.includes(`border-top:${LINE}`) && st.includes(`border-left:${LINE}`),
      `★간격이 24 인데 칸(${r},${c}) 이 변을 잃었다 — 카드 모양이 깨진다.\n   style = ${st}`);
  }
});

/* ══════════════════════════════════════════════════════════════════════════
 * B6 — 읽는 쪽 검증. 저장본을 손으로 고치거나 옛 파일이 섞여도 CSS 로 안 샌다.
 * ════════════════════════════════════════════════════════════════════════ */
test('B6 ★읽는 문 — dataset 에 손으로 심은 쓰레기 색이 인라인 CSS 로 안 샌다', async () => {
  const { makeGridBlock, renderGridBlock } = await loadModule();
  const { block } = makeGridBlock(FIX());
  block.dataset.cellBorderWidth = '2';
  block.dataset.cellBorderColor = 'red;position:fixed;top:0';   // ⛔쓰는 문을 우회해 «직접» 심는다
  block.dataset.cellBorderStyle = 'groove';
  renderGridBlock(block);
  const st = cellStyle(block, 0, 0);
  assert.ok(!st.includes('position:fixed'), `★색 칸을 타고 남의 속성이 샜다.\n   style = ${st}`);
  assert.ok(!st.includes('groove'), `★명부 밖 선 꼴이 그대로 CSS 에 실렸다.\n   style = ${st}`);
  assert.ok(st.includes('border-right:2px solid #d0d0d0'),
    `★못 읽는 값은 «기본값»으로 떨어져야 한다(선을 아예 잃으면 사용자는 「굵기는 먹는데 색은 안 먹는다」를 본다).\n   style = ${st}`);
});

/* ══════════════════════════════════════════════════════════════════════════
 * B7 — 롤백. 되돌림 명부(before/restore)에 새 키가 들어 있는가.
 *   ★「명부에 이름이 있나」를 grep 하지 않는다 — 실제로 렌더를 터뜨리고 «값»을 본다.
 * ════════════════════════════════════════════════════════════════════════ */
test('B7 ★롤백 — 렌더가 터지면 테두리 세 키도 이전 값으로 되돌아온다', async () => {
  const { makeGridBlock, updateGridBlock } = await loadModule(M_THROW_ON);
  const { block } = makeGridBlock(FIX());
  const ok = updateGridBlock(block.id, { cellBorderWidth: 2, cellBorderColor: '#123456', cellBorderStyle: 'dashed' });
  assert.equal(ok.ok, true, `★판을 못 깔았다 — ${ok.message}`);

  const boom = updateGridBlock(block.id, { cellBorderColor: '#bada55' });
  assert.equal(boom.ok, false, '★렌더가 터졌는데 ok:true 다');
  assert.equal(boom.code, 'RENDER_ERROR', `★코드가 RENDER_ERROR 가 아니다: ${boom.code}`);
  assert.equal(block.dataset.cellBorderColor, '#123456',
    `★롤백이 테두리 색을 안 되돌렸다(지금 ${block.dataset.cellBorderColor}) — 되돌림 명부에서 빠졌다는 뜻이다`);
});

/* ══════════════════════════════════════════════════════════════════════════
 * ★양성대조 — 기능을 «빼면» 위 검사가 빨개지는가.
 *   ⛔「고친 뒤 초록」으로 닫지 않는다. 깨뜨려서 댄다.
 * ════════════════════════════════════════════════════════════════════════ */
test('B8 ★양성대조 — 렌더러에서 테두리 CSS 를 빼면 B2 가 빨개진다', async () => {
  const { makeGridBlock, updateGridBlock } = await loadModule(M_DROP_RENDER);
  const { block } = makeGridBlock(FIX());
  updateGridBlock(block.id, { rowGap: 12, colGap: 12 });
  const res = updateGridBlock(block.id, { cellBorderWidth: 3, cellBorderColor: '#ff0000', cellBorderStyle: 'solid' });
  assert.equal(res.ok, true, '★변형본에서도 «값»은 받아야 한다 — 그래야 B2 가 재는 것이 «화면»임이 드러난다');
  assert.ok(!cellStyle(block, 0, 0).includes('border-right:3px solid #ff0000'),
    '★렌더러에서 테두리를 뺐는데도 선이 찍힌다 — B2 는 그 줄을 «안 재고 있다»(딴 데서 온 초록이다)');
});

test('B9 ★양성대조 — 선 꼴을 solid 로 강등시키면 B4 만 빨개진다(B2 는 초록인 채로)', async () => {
  const { makeGridBlock, updateGridBlock } = await loadModule(M_FORCE_SOLID);
  const { block } = makeGridBlock(FIX());
  updateGridBlock(block.id, { rowGap: 10, colGap: 10 });
  updateGridBlock(block.id, { cellBorderWidth: 2, cellBorderColor: '#222222', cellBorderStyle: 'dashed' });
  const st = cellStyle(block, 1, 1);
  assert.ok(!st.includes('border-right:2px dashed #222222'),
    `★꼴을 강등시켰는데 dashed 로 찍힌다 — B4 가 그 자리를 «안 재고 있다».\n   style = ${st}`);
  /* ★그리고 이것이 B4 를 «따로» 둔 까닭이다 — 선은 여전히 그려지므로 B2 는 초록으로 남는다. */
  assert.ok(st.includes('border-right:2px solid #222222'),
    `★강등본에서도 선 자체는 그려져야 한다 — 안 그러면 「B2 가 잡았을 것」이라 B4 의 필요가 안 드러난다.\n   style = ${st}`);
});

test('B10 ★양성대조 — 겹침 규칙을 걷으면 B5 가 빨개진다', async () => {
  const { makeGridBlock, updateGridBlock } = await loadModule(M_DROP_COLLAPSE);
  const { block } = makeGridBlock(FIX());
  updateGridBlock(block.id, { gap: 0 });
  updateGridBlock(block.id, { cellBorderWidth: 1, cellBorderColor: '#333333', cellBorderStyle: 'solid' });
  assert.ok(!cellStyle(block, 1, 0).includes('border-top:0'),
    '★겹침 규칙을 걷었는데도 안쪽 위 선이 죽어 있다 — B5 는 그 두 줄을 «안 재고 있다»');
  assert.ok(cellStyle(block, 1, 0).includes('border-top:1px solid #333333'),
    '★변형본이 기대한 모양(모든 칸이 네 변을 다 듦)이 아니다 — 변이가 겨냥을 빗나갔다');
});
