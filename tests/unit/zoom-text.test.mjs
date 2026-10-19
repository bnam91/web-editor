/* 단위 하네스 — 확대블럭 «글자»(현빈 2026-10-18 `1018t1-h8c`)
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"   (= npm test)
 *
 * ★발주 원문: 「기존의 줌블럭은 이미지 에셋블럭에 줌이 들어가는건데,
 *               ★모달블럭 처럼 텍스트를 넣을 수 있게도 해줄 것」
 *
 * ★★이 파일이 잠그는 것 — ★«짝»으로만 잰다(한쪽만 재면 「안 재고 있다」와 구분이 안 된다):
 *   ⒜ ★음성대조 — ★글자가 꺼져 있으면(=옛 저장본 전부) ★글자 층이 ★0개다.
 *      ★이 칸이 ★무회귀의 전부다. ★dataset 에 `tx` 가 ★없는 블록이 ★옛 저장본이다.
 *   ⒝ ★양성대조 — ★켜면 ★1개다(비어 있어도 ★안내문구로 선다 ⇒ 더블클릭할 과녁이 생긴다).
 *   ⒞ ★«그 자리가 ★진짜 그 층인가» — ★쌓는 순서(배경 ★위 · 손잡이 ★아래)까지 ★이름으로 못박는다.
 *
 * ⚠️★이 검사의 ★전제를 ★먼저 단언한다 — ★「층이 0개」는 ★«글자가 꺼져서»여야지
 *   ★«조립기가 통째로 비어서»면 안 된다. ⇒ 0건을 적기 «전»에 ★조립기가 돌고 있음을 잰다.
 *
 * ★기하 모듈은 ★tmp `.mjs` 사본으로 «진짜 실행»한다 — tests/unit/zoom-block.test.js 와 ★같은 수법.
 *   ⛔그래서 ★js/blocks/zoom-geometry.js 에는 ★import 가 ★한 줄도 없어야 한다(그 파일 `_esc` 주석 참조).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
/* ★임시 루트의 ★임자 = ★`tests/unit/_tmproot.js` ★한 자리다 — ⛔제 mkdtempSync 를 만들지 마라
   (★잠그는 자 = ★`tests/unit/tmproot-sole-owner.test.mjs`). */
const { mkTmpRoot } = require('./_tmproot.js');

const ROOT = path.resolve(import.meta.dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let _geom = null;
function loadGeom() {
  if (!_geom) {
    const mjs = path.join(mkTmpRoot('zoom-text-'), 'zoom-geometry.mjs');
    fs.copyFileSync(path.join(ROOT, 'js/blocks/zoom-geometry.js'), mjs);
    _geom = import(pathToFileURL(mjs).href);
  }
  return _geom;
}

/* 기본 상태 — readZoomState 가 내놓는 꼴 그대로(⛔여기서 기본값을 새로 발명하지 않는다). */
const ST = {
  shape: 'rect', angle: -90, length: 170, spread: 0,
  maxop: 30, curve: 100, narrow: 62, size: 260, rot: 0,
  fill: 'checker', imgSrc: '', w: null, h: null,
  shadow: 'off', dropShadow: 'none', bd: 'off', bdw: 6, bdc: '#ffffff', shc: '#000000', bdr: 0,
  tx: 'off', text: '', txc: '#ffffff', txs: 24, txa: 'center',
};
const count = (s, re) => (s.match(re) || []).length;

/* ★글자 층을 «여는 태그»와 «안의 글»로 가른다 — ⛔둘을 섞어 재면 틀린다:
   ★`data-placeholder` 속성은 ★글이 있든 없든 ★언제나 안내문구를 ★들고 있다(모달 슬롯도 같다).
   ⇒ 「안내문구를 그리고 있나」는 ★«안의 글»에서만 물어야 한다.
   (실측 2026-10-19 — 처음엔 통째로 `includes` 했다가 ★이 자가 거짓 빨강을 냈다.) */
function splitTextLayer(html) {
  const m = html.match(/<div class="zoom-text"([\s\S]*?)>([\s\S]*?)<\/div>/);
  return m ? { attrs: m[1], inner: m[2] } : null;
}

/* ── ⒜ 음성대조 — 옛 저장본은 «한 픽셀도» 안 바뀐다 ───────────────────────── */
test('Z1 ⒜음성대조 — 글자가 꺼져 있으면 글자 층이 «0개»다 (＋전제: 조립기는 돌고 있다)', async () => {
  const g = await loadGeom();
  const html = g.buildZoomInner(ST, null, null);
  /* ★전제 단언 — ⛔이게 없으면 「0개」가 «조립기가 통째로 비었다»여도 초록이다 */
  assert.ok(html.length > 200, `전제: 조립기가 마크업을 내고 있다 (지금 ${html.length}자)`);
  assert.equal(count(html, /class="zoom-clip"/g), 1, '전제: 클리핑 층이 그려진다');
  assert.equal(count(html, /class="zoom-bg"/g), 1, '전제: 배경 층이 그려진다');

  assert.equal(count(html, /class="zoom-text"/g), 0, '글자를 켜지 않았는데 글자 층이 섰다');
  assert.equal(/data-zoom-slot/.test(html), false, '글자 슬롯 표식이 샜다');
});

test('Z2 ⒜음성대조 — ★`tx` 키가 «아예 없는» 옛 상태도 0개다 (undefined 가 켬으로 읽히지 않는다)', async () => {
  const g = await loadGeom();
  const old = { ...ST };
  delete old.tx; delete old.text; delete old.txc; delete old.txs; delete old.txa;
  assert.equal(g.zoomTextVisible(old), false, 'tx 가 없는 상태를 «켬»으로 읽는다');
  assert.equal(count(g.buildZoomInner(old, null, null), /class="zoom-text"/g), 0);
  /* ★그리고 ★그 마크업은 ★tx 를 붙이기 «전»과 ★한 글자도 안 달라야 한다 */
  assert.equal(g.buildZoomInner(old, null, null), g.buildZoomInner(ST, null, null),
    '옛 꼴과 새 꼴의 마크업이 갈렸다 — 저장된 확대블럭의 화면이 바뀐다');
});

/* ── ⒝ 양성대조 — 켜면 선다 ────────────────────────────────────────────────── */
test('Z3 ⒝양성대조 — 켜면 글자 층이 «1개»다. 비면 안내문구, 넣으면 그 글자', async () => {
  const g = await loadGeom();

  const empty = g.buildZoomInner({ ...ST, tx: 'on' }, null, null);
  assert.equal(count(empty, /class="zoom-text"/g), 1, '켰는데 글자 층이 없다');
  const e = splitTextLayer(empty);
  assert.ok(e, '전제: 글자 층을 가르지 못했다 — 아래 단언이 전부 자기통과한다');
  assert.ok(/data-is-placeholder="true"/.test(e.attrs), '비었는데 안내문구 표식이 없다 — 흐리게 안 그려진다');
  assert.equal(e.inner, g.ZOOM_TEXT_PH, '안내문구 글자가 «안»에 없다 — 더블클릭할 과녁이 없다');

  const filled = g.buildZoomInner({ ...ST, tx: 'on', text: '확대해서 보세요' }, null, null);
  assert.equal(count(filled, /class="zoom-text"/g), 1);
  const f = splitTextLayer(filled);
  assert.ok(f, '전제: 글자 층을 가르지 못했다');
  assert.equal(/data-is-placeholder/.test(f.attrs), false, '글이 있는데 안내문구로 흐려진다');
  assert.equal(f.inner, '확대해서 보세요', '넣은 글자가 «안»에 그대로 안 들어갔다');
  /* ⚠️`data-placeholder` 속성은 ★글이 있어도 ★남는다(모달과 같다 — 다 지우면 다시 빈칸이 될 때 쓸 문구가 없다).
     ⇒ 「안내문구를 그리고 있나」는 ★«안의 글»로만 묻는다. */
  assert.ok(f.attrs.includes(`data-placeholder="${g.ZOOM_TEXT_PH}"`), '안내문구 속성이 사라졌다');
});

test('Z4 ⒝ 공백뿐인 글자는 «빈 것»으로 본다 — 안내문구로 돌아간다', async () => {
  const g = await loadGeom();
  const html = g.buildZoomInner({ ...ST, tx: 'on', text: '   \n  ' }, null, null);
  assert.equal(count(html, /class="zoom-text"/g), 1);
  assert.ok(/data-is-placeholder="true"/.test(html), '공백만 남은 글이 «글»로 굳었다');
});

/* ── ⒞ 그 자리가 정말 그 자리인가 ──────────────────────────────────────────── */
test('Z5 ⒞ 쌓는 순서 — 글자는 «배경 위 · 손잡이 아래»다 (손잡이를 덮으면 못 집는다)', async () => {
  const g = await loadGeom();
  /* ★손잡이는 그림자를 켜야 «있다»(끄면 짧은 변 자체가 없다 — zoom-state S-13 이 적어 둔 그것) */
  const st = { ...ST, tx: 'on', text: '가', shadow: 'on' };
  const html = g.buildZoomInner(st, null, null);
  /* ★전제 — 셋이 «다» 있어야 순서를 잴 수 있다 */
  for (const cls of ['zoom-bg', 'zoom-text', 'zoom-handle-layer']) {
    assert.ok(html.includes(cls), `전제: ${cls} 가 마크업에 없다 — 순서를 잴 수 없다`);
  }
  assert.ok(html.indexOf('zoom-bg') < html.indexOf('zoom-text'),
    '글자가 배경·이미지 «아래»면 이미지에 가려 안 보인다');
  assert.ok(html.indexOf('zoom-text') < html.indexOf('zoom-handle-layer'),
    '글자가 손잡이 «위»면 빛·a·b 를 못 집는다');
  // 클리핑 층 «안»이어야 섹션 밖 크롭·드롭섀도가 같이 먹는다
  assert.ok(html.indexOf('zoom-text') > html.indexOf('zoom-clip'), '글자 층이 클리핑 층 밖에 있다');
});

test('Z6 ⒞ 글자 상자는 «도형 상자»다 — .zoom-bg 와 ★같은 표(shapeBoxInClip)를 쓴다', async () => {
  const g = await loadGeom();
  for (const st of [{ ...ST, tx: 'on' },
                    { ...ST, tx: 'on', shape: 'circle' },
                    { ...ST, tx: 'on', shape: 'a4', rot: 30, bd: 'on', bdw: 12, bdr: 20 }]) {
    const html = g.buildZoomInner(st, null, null);
    const bg = html.match(/class="zoom-bg" style="left:([-\d.]+)px;top:([-\d.]+)px;width:([\d.]+)px;height:([\d.]+)px;/);
    const tx = html.match(/class="zoom-text"[^>]*style="left:([-\d.]+)px;top:([-\d.]+)px;width:([\d.]+)px;height:([\d.]+)px;/);
    assert.ok(bg, `전제: ${st.shape} 에서 배경 층 치수를 못 읽었다`);
    assert.ok(tx, `${st.shape} 에서 글자 층 치수를 못 읽었다`);
    assert.deepEqual(tx.slice(1), bg.slice(1), `${st.shape} — 글자 상자가 도형 상자와 갈렸다`);
  }
});

test('Z7 ⒞ 도형이 돌면 글자도 «같이» 돈다 (원은 안 돈다 — 돌려도 같은 모양이다)', async () => {
  const g = await loadGeom();
  const rot = g.buildZoomInner({ ...ST, tx: 'on', rot: 30 }, null, null);
  const tx = rot.match(/class="zoom-text"[\s\S]*?>/)[0];
  assert.ok(/transform:rotate\(30deg\);/.test(tx), '도형만 돌고 글자가 안 돈다');
  const circ = g.buildZoomInner({ ...ST, tx: 'on', shape: 'circle', rot: 30 }, null, null);
  const ctx = circ.match(/class="zoom-text"[\s\S]*?>/)[0];
  assert.equal(/transform:rotate/.test(ctx), false, '원은 회전을 안 받는데 글자만 돌았다');
});

/* ── 거르개 — 글자·색이 마크업을 깨고 나오지 못한다 ────────────────────────── */
test('Z8 글자는 «걸러서» 들어간다 — 태그·따옴표로 속성을 깨고 나올 수 없다', async () => {
  const g = await loadGeom();
  const evil = '<img src=x onerror=alert(1)>"\' & <b>굵게</b>';
  /* ★전제 — ★표본이 ★정말 위험한 글자여야 아래 단언이 뜻을 갖는다(아니면 전부 항등식이다) */
  assert.ok(/[<>"'&]/.test(evil), '전제: 표본에 깨뜨릴 글자가 없다');

  const html = g.buildZoomInner({ ...ST, tx: 'on', text: evil }, null, null);
  const t = splitTextLayer(html);
  assert.ok(t, '전제: 글자 층을 가르지 못했다');
  /* ★「태그가 들어갔나」는 ★«안의 글»에 ★생 꺾쇠가 ★남았나로 잰다 —
     ⛔`/onerror/` 로 재면 안 된다: 덮인 뒤에도 ★그 «낱말»은 글자로 남는다(그게 맞는 동작이다). */
  assert.equal(/[<>]/.test(t.inner), false, `글자 자리에 생 꺾쇠가 남았다: ${t.inner}`);
  assert.ok(t.inner.includes('&lt;img') && t.inner.includes('&lt;b&gt;'), '꺾쇠가 안 덮였다');
  assert.ok(t.inner.includes('&amp;'), '앰퍼샌드가 안 덮였다');
  assert.ok(t.inner.includes('&quot;') && t.inner.includes('&#39;'), '따옴표가 안 덮였다');
  /* ★여는 태그는 ★그대로 멀쩡하다 — 글자가 속성을 깨고 나오지 못했다는 뜻이다 */
  assert.equal(/[<>]/.test(t.attrs), false, '글자가 여는 태그를 깨고 나왔다');

  // 색도 같은 길 — safeColor 가 거른다
  const bad = g.buildZoomInner({ ...ST, tx: 'on', txc: '#fff" onload="x' }, null, null);
  assert.equal(/onload/.test(bad), false, '색 자리로 속성이 들어갔다');
  assert.ok(/color:#ffffff;/.test(bad), '거른 뒤 기본색으로 안 떨어졌다');
});

test('Z9 정렬·크기는 모르는 값이면 기본으로 떨어진다 (저장본 변조 대비)', async () => {
  const g = await loadGeom();
  const bad = g.buildZoomInner({ ...ST, tx: 'on', txa: 'justify', txs: 0 }, null, null);
  assert.ok(/text-align:center;/.test(bad), `모르는 정렬이 그대로 나갔다`);
  assert.ok(/font-size:24px;/.test(bad), '크기 0 이 그대로 나갔다 — 글자가 사라진다');
  // ★양성대조 — 제대로 준 값은 «그대로» 나간다(위 칸이 늘 center/24 를 내는 항등식이 아니다)
  const ok = g.buildZoomInner({ ...ST, tx: 'on', txa: 'right', txs: 40 }, null, null);
  assert.ok(/text-align:right;/.test(ok) && /font-size:40px;/.test(ok), '제대로 준 값이 안 먹는다');
});

/* ── 상태층·배선 — 소스로 잰다 ────────────────────────────────────────────── */
test('Z10 기본값은 «한 자리»(ZOOM_DEFAULTS)에 있고, tx 기본은 ★off 다', () => {
  const b = read('js/blocks/zoom-block.js');
  assert.match(b, /tx:\s*'off',/, "ZOOM_DEFAULTS.tx 기본이 'off' 가 아니다 — 옛 저장본에 글자가 돋는다");
  assert.match(b, /text:\s*'',/, 'ZOOM_DEFAULTS.text 기본이 빈 문자열이 아니다');
  assert.match(b, /tx:\s*_onOff\(d\.tx,\s*ZOOM_DEFAULTS\.tx\)/, 'readZoomState 가 tx 를 «안 거른다»');
  assert.match(b, /text:\s*d\.text \?\? ZOOM_DEFAULTS\.text/, 'readZoomState 가 text 를 안 읽는다');
  /* ⛔생성 시 글자 칸을 «박지» 않는다 — 박으면 새 블록마다 data-tx/data-text 가 저장본에 실려
     「글자를 한 번도 안 쓴 블록」과 「껐다 켠 블록」이 구분이 안 된다(`shc` 와 같은 꼴로 조건부다).
     ★다섯 칸을 ★전수로 센다 — ⛔「tx 하나만 조건부」면 나머지 넷이 조용히 박힌다. */
  for (const k of ['tx', 'text', 'txc', 'txs', 'txa']) {
    const re = new RegExp(`if \\(opts\\.${k}\\s*!= null\\) block\\.dataset\\.${k}\\s*=`);
    assert.match(b, re, `makeZoomBlock 이 ${k} 를 «조건 없이» 박는다`);
  }
});

test('Z11 ★글자 커밋은 dataset 으로 간다 — DOM 이 아니라(모달·인용구와 같은 규율)', () => {
  const b = read('js/blocks/zoom-block.js');
  const fn = b.slice(b.indexOf('function commitZoomText'));
  assert.ok(fn.startsWith('function commitZoomText'), '전제: commitZoomText 를 못 찾았다');
  assert.match(fn.slice(0, 500), /block\.dataset\.text = next/, 'dataset 에 안 쓴다');
  assert.match(fn.slice(0, 500), /delete block\.dataset\.text/, '빈 값일 때 키를 안 지운다');
  assert.match(b, /window\.commitZoomText\s*=\s*commitZoomText/, 'window 에 안 냈다 — block-drag 가 못 부른다');
});

test('Z12 ★편집 배선이 실제로 걸려 있다 — dblclick · blur · Escape (모달 꼴)', () => {
  const d = read('js/block-drag.js');
  const at = d.indexOf('if (isZoom) {\n    block.addEventListener(\'dblclick\'');
  assert.ok(at > 0, '확대블럭 dblclick 핸들러가 없다 — 글자를 넣을 길이 없다');
  const seg = d.slice(at, at + 2200);
  assert.match(seg, /\.zoom-text/, '글자 층을 안 찾는다');
  assert.match(seg, /contenteditable', 'true'/, '편집을 안 연다');
  assert.match(seg, /classList\.add\('editing'\)/, '.editing 을 안 붙인다 — 이동 드래그가 글자를 삼킨다');
  assert.match(seg, /addEventListener\('blur', \(\) => _zoomEndEdit\(block, host\)\)/, 'blur 커밋이 없다');
  assert.match(seg, /ev\.key === 'Escape'/, 'Escape 로 빠져나올 길이 없다');
  assert.match(d, /function _zoomEndEdit\(block, host\)/, '_zoomEndEdit 가 없다');
  const end = d.slice(d.indexOf('function _zoomEndEdit'), d.indexOf('function _zoomEndEdit') + 1600);
  assert.match(end, /window\.commitZoomText\?\.\(block, next\)/, '커밋을 안 부른다');
  assert.match(end, /window\.renderZoomBlock\?\.\(block\)/, '커밋 뒤 다시 안 그린다');
  assert.match(end, /host\.innerText = before/, '커밋 «전» DOM 을 편집 전으로 안 되돌린다 — 히스토리가 어긋난다');
});

test('Z13 ★이동 드래그가 글자 편집을 «삼키지 않는다» — .editing 가드', () => {
  const b = read('js/blocks/zoom-block.js');
  const at = b.indexOf('function _bindZoomMoveDrag');
  assert.ok(at > 0, '전제: _bindZoomMoveDrag 를 못 찾았다');
  const seg = b.slice(at, at + 1800);
  assert.match(seg, /if \(block\.classList\.contains\('editing'\)\) return;/,
    '편집 중에도 이동 드래그가 돈다 — 글자를 고르려 끌면 블록이 움직인다');
  /* ★그 가드가 ★손잡이 가드보다 ★«먼저» 서야 한다(손잡이는 편집과 무관하게 비켜 가야 하므로 순서가 뜻을 갖는다) */
  assert.ok(seg.indexOf("contains('editing')") < seg.indexOf('.zoom-handle'),
    '편집 가드가 손잡이 가드보다 뒤에 있다');
});

test('Z14 ★패널 — 켬/끔·정렬·크기·색이 있고 ★배선이 «짝»으로 있다', () => {
  const p = read('js/props/prop-zoom.js');
  assert.match(p, /<div class="prop-section-title">Text<\/div>/, 'Text 절이 없다');
  for (const [id, 이름] of [['zm-tx-group', '켬/끔'], ['zm-txa-group', '정렬'],
                            ['zm-txs', '크기'], ['zm-txc', '색']]) {
    assert.ok(p.includes(id), `${이름}(${id}) 컨트롤이 패널에 없다`);
  }
  // ★마크업만 있고 배선이 없으면 «칸은 서는데 아무 일도 안 난다»(prop-quote 가 그 교훈을 적어 뒀다)
  assert.match(p, /bindRadio\('zm-tx',\s*'tx'/, '켬/끔 배선이 없다');
  assert.match(p, /bindPair\('zm-txs',\s*'txs'/, '크기 배선이 없다');
  assert.match(p, /wireColorField\('zm-txc'/, '색 배선이 없다');
  assert.match(p, /#zm-txa-group \.prop-align-btn/, '정렬 배선이 없다');
  /* ⛔체크박스를 쓰지 않았다 — 현빈이 「라디오버튼으로」라고 못박은 것(zoom-block.test ⓑ-14 와 같은 자리) */
  assert.equal(/type="checkbox"/.test(p), false, '체크박스가 생겼다');
  /* ⛔«내용» 입력칸은 두지 않는다 — 모달에도 없고, 인용구는 현빈이 걷게 했다(1011t1a-2) */
  assert.equal(/<textarea/.test(p), false,
    '내용 입력칸이 생겼다 — 글은 캔버스 더블클릭으로 넣는다(prop-quote.js 의 ⚰️ 1011t1a-2 참조)');
});

test('Z15 ★CSS — 글자 층은 평소 포인터를 안 받고, 편집 중에만 받는다', async () => {
  /* ⛔«선언이 글자로 있나»로 재면 안 된다 — ★주석으로 «꺼 둔» 줄도 글자로는 그대로다.
     ★실측(2026-10-19 변이 M11): `pointer-events: auto;` 를 주석으로 감쌌더니 ★이 칸이 ★그냥 통과했다.
     ⇒ ★본문은 ★주석을 걷은 판에서 읽는다. ★거르개는 ★이 레포의 부품을 쓴다(⛔제 벌을 만들지 않는다).
     ⚠️`blankCssNoise` 는 ★주석뿐 아니라 ★«문자열»도 빈칸으로 만든다 ⇒ ★선택자의 `"true"` 가 사라진다.
       ★그런데 ★길이와 줄 구조는 ★보존한다(그 자의 자기검사가 그 성질을 못박는다)
       ⇒ ★선택자는 ★생 소스에서 찾고, ★본문은 ★같은 오프셋의 ★걷은 판에서 읽는다. */
  const { blankCssNoise } = await import('../../tools/css-token-lint.mjs');
  const raw = read('css/editor-blocks.css');
  const blank = blankCssNoise(raw);
  assert.equal(blank.length, raw.length, '전제: 거르개가 길이를 안 지켰다 — 오프셋을 못 맞춘다');
  assert.equal(blank.includes('글자 층 — 현빈'), false, '전제: 주석이 안 걷혔다 — 이 칸이 꺼진 선언을 못 가린다');

  const bodyOf = (sel) => {
    const i = raw.indexOf(sel);
    assert.ok(i >= 0, `전제: 규칙을 못 찾았다 — ${sel}`);
    const j = raw.indexOf('}', i);
    assert.ok(j > i, `전제: 규칙이 안 닫혔다 — ${sel}`);
    return blank.slice(i + sel.length, j);
  };

  assert.match(blank, /\.zoom-block \.zoom-text,/, '글자 층이 pointer-events:none 묶음에 없다');
  const edit = bodyOf('#canvas .zoom-block .zoom-text[contenteditable="true"] {');
  assert.match(edit, /pointer-events:\s*auto;/, '편집 중에도 포인터를 안 받는다 — 캐럿이 안 선다');
  assert.match(edit, /user-select:\s*text;/, '블럭이 user-select:none 이라 안 풀면 글자를 못 고른다');
  /* ★줄 읽기(mdlReadText)와 그리는 줄이 같으려면 모달 슬롯과 «같은 값»이어야 한다 */
  assert.match(bodyOf('.zoom-block .zoom-text {'), /white-space:\s*pre-wrap;/, 'pre-wrap 이 아니다 — 줄 수가 갈린다');
});
