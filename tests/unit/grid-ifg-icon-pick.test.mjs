/* grid-ifg-icon-pick — 1017t1i2 인포그래픽 «아이콘 더블클릭 → iconify 고르개» (2026-10-20)
 *   재는 것 = js/blocks/grid-ifg-icon-pick.js (판정·색 계약·커밋·iconify 다리) ＋ js/block-drag.js 배선
 *             ＋ index.html 적재 ＋ 옛 저장본 무회귀.
 * 실행: node --test tests/unit/grid-ifg-icon-pick.test.mjs
 *
 *   ⛔「내장 아이콘 35종 명부」를 재는 칸은 ★없다 — 현빈 정정(「35종은 샘플이라 그런거고 원래는 iconify
 *     플러그인이 연결되어있어야되는거야」)으로 ★걷혔다. 명부·검색·세트 필터는 ★iconify-panel.js 몫이다.
 *
 *   A1  ifgIsIconSrc — 빈 값·svg data URI·★`.svg` 참조(외부화) = 아이콘 / png·jpg·assets = 사진
 *   A2  ifgIconSrcColor 왕복 · 못 읽으면 null(⛔기본색으로 눙치지 않는다)
 *   A3  ★색 계약 — ifgPaintSvgRoot 가 뿌리 svg 에 `style="color:…"` 를 박고 `_recolor` 정규식이 그걸 찾는다
 *   A4  ifgPaintSvgRoot — 이미 있는 뿌리 style 은 ★갈아끼운다 · 안쪽 svg/style 은 안 건드린다 · svg 아니면 그대로
 *   A5  ifgSvgToIconSrc — ★`<svg>` 가 아니면 ★null (iconify 429 폴백 `<img src=…>` 가 칸에 안 박힌다)
 *   A5b ★★깨진 입력을 ★실제로 먹인다 — Cloudflare 꼴 ≈7KB HTML ＋ ★소스에서 뽑은 <img> 폴백 ⇒ 커밋 0 · 토스트 2
 *   A6  ifgSvgToIconSrc 왕복 — 돌려받은 data URI 에서 색이 읽힌다 · 색이 없으면 기본 #222222
 *   B0  ★전제 — 공용 주석 거르개(_strip-comments templateAware)가 읽는 파일들의 템플릿 보간이 닫힌다
 *   B1  ★block-drag.js — ifgIconDblclick 을 ★옛 두 가지(빈 슬롯 파일창·프레임 크롭)보다 ★먼저 묻는다 ＋ 그 자가 ★무나
 *   B2  block-drag.js 는 그 모듈을 import 하지 않는다 — window 다리(기존 관례)
 *   B3  커밋 문은 ★`updateGridBlock` 하나(⛔Raw 아님 — Raw 는 ⌘Z 칸을 안 쌓는다)
 *   B4  ★iconify 를 ★다시 짓지 않았다 — 이 모듈엔 API URL·검색·세트 명부가 ★0건이고, 여는 문은 openIconifyModal 하나
 *   B5  ★index.html 이 이 모듈을 얹는다(grid-infographic.js 가 import 하지 않으므로 ★script 태그가 유일한 적재 길)
 *   C1  ★음성대조 ⑴ — `ifgPreset` 표식 ★없는 보통 그리드에선 ★모달이 ★0번 뜬다 ＋ 표식만 달면 1번(양성대조)
 *   C1b ★끝에서 끝까지 — 더블클릭 → iconify 콜백 → 그 칸 imgSrc 가 고른 svg 로 갈린다(＋색 물려받기)
 *   C1c ★`openIconifyModal` 이 ★없으면 가로채지 않는다(「가로채 놓고 아무 일도 안 난다」 금지)
 *   C2  커밋 — 문 한 번 · trusted · 그 줄만 · 원형/지름 보존 · ⛔`picked.size` 를 안 쓴다
 *   C3  표식 ＋ ★사진 줄 → ★모달 0건 (2026-09-25 크롭 편집을 안 빼앗는다)
 *   C4  ★429 폴백(`<img src=…>`)이 오면 ★커밋 0건 ＋ 토스트 1건 (저장본 오염 금지)
 *   C5  ifgBuildOpts 로 만든 인포그래픽의 자리표시 아이콘이 ★이 판정에 걸린다(끝에서 끝까지)
 *   C6  ★옛 저장본 무회귀 — ⒜ ifgIconUri 가 1017t1i2 «전»과 바이트 동일 ⒝ 옛 꼴 URI 도 프리셋 적용에서 색이 갈린다
 *   C7  ★★외부화된 아이콘(`goya-asset://…svg`) — 고르개가 ★뜨고(9334 실측 꼴) 색은 ★프리셋 표에서 떨어진다
 *   C8  ★iconify 아이콘을 넣은 뒤 ★프리셋 적용이 그 색을 ★간다(색 계약이 끝까지 선다)
 *   D1~D8 ★변이(음성대조) — 이 파일 «안»에서 소스를 비틀어 위 단언들이 ★빨개지는지 본다
 */

/* ★★261020 — ★커밋 `5b6d2f63` 메시지의 ★「내장 36종」은 ★오기다. ★참값 ★35(아래 단언이 참값).
   ★자세한 까닭은 `js/blocks/grid-ifg-icon-pick.js` 머리말의 ★정정 비석. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { loadGrid } = require('./_grid-ifg-harness.js');
const { readSrc } = require('./_srcread.js');
/* ★주석 걷기는 ★공용 부품 하나(strip-comments-shared S-6) — ⛔자기 제거기를 만들지 않는다.
   ★`templateAware` 판을 쓰고 ★`templateBalanced` 를 ★전제로 같이 건다(그 파일 ⚠️한계 그대로 · B0). */
const SC = require('./_strip-comments.js');
const strip = SC.stripCommentsTA;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PICK_REL = 'js/blocks/grid-ifg-icon-pick.js';

/* ── 옛 판(1017t1i2 «전») 자리표시 아이콘을 ★손으로 다시 싼다 ─────────────────────
 * ⛔제품 코드에서 가져오지 않는다 — 가져오면 항등식이 되어 ★아무것도 안 잠근다.
 * 출처 = git 20e91e00 의 js/blocks/grid-infographic.js `_ICON_D` · `_ICON_VB` · `ifgIconUri`. */
const OLD_ICON_D = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>';
const OLD_ICON_VB = '-4.5 -4.5 33 33';
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const URI_HEAD = 'data:image/svg+xml;base64,';
function oldIfgIconUri(color) {
  const col = /^#[0-9a-f]{6}$/i.test(String(color || '')) ? String(color).toLowerCase() : '#222222';
  return URI_HEAD + b64('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + OLD_ICON_VB + '" style="color:' + col + '"'
    + ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + OLD_ICON_D + '</svg>');
}
const unb64 = (uri) => Buffer.from(String(uri).slice(URI_HEAD.length), 'base64').toString('utf8');

/* ★iconify 가 실제로 주는 꼴 — js/panels/iconify-panel.js `_doInsert` 의 두 갈래를 그대로 적는다.
   ⛔「보통 이렇다」로 지어내지 않았다: 성공 갈래는 `${API}/${prefix}/${name}.svg` 의 본문(`<svg …>`),
     실패 갈래는 그 파일이 직접 쓰는 `<img src="${API}/…svg" width=.. height=.. style="display:block;">` 다. */
const ICONIFY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">'
  + '<path fill="none" stroke="currentColor" stroke-width="2" d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2"/></svg>';
const ICONIFY_IMG_FALLBACK = '<img src="https://api.iconify.design/lucide/leaf.svg" width="64" height="64" style="display:block;">';
const pickedOf = (svg, name = 'lucide:leaf') => ({ name, svg, size: 64, iconColor: undefined });

/** 변이 주입 — ★안 먹으면 그 자리에서 죽는다(「변이가 안 들어갔는데 초록」 금지). */
function inject(src, from, to, label) {
  assert.ok(src.includes(from), `★변이 닻을 못 찾았다(${label}) — 소스가 바뀌었나: ${from.slice(0, 60)}`);
  return src.split(from).join(to);
}
const mutPick = (from, to, label) => (src, which) => (which === 'pick' ? inject(src, from, to, label) : src);
/* ⚠️`which==='ifg'`(grid-infographic.js) 변이는 ★이 파일 안에 없다 — 자리표시 아이콘 쪽 변이(M24·M25)는
   ★바깥 스윕에서 돌렸다(C6 가 그 둘을 빨갛게 만든다). ⛔쓰지 않는 주입기를 남겨 두지 않는다. */

/* ══ A — 판정 자·색 계약(순수 함수) ════════════════════════════════════════ */

test('A1 ifgIsIconSrc — 빈 값·svg·★외부화(.svg) = 아이콘 / png·jpg·assets = 사진', async () => {
  const { C } = await loadGrid({ withIfg: true });
  for (const v of ['', null, undefined, oldIfgIconUri('#222222'), 'data:image/svg+xml;utf8,<svg/>',
                   /* ★외부화된 아이콘 — 2026-10-20 9334 실측 꼴(image 줄 34개 중 25개가 이 꼴이었다) */
                   'goya-asset://proj_1791778999148/d1be6a8db7fe86e2.svg',
                   'goya-asset://proj_1791778999148/8a932fbfceb54718.svg',
                   'assets/img/icon.svg', 'https://x/y.svg?v=2', 'https://x/y.SVG']) {
    assert.equal(C.ifgIsIconSrc(v), true, `아이콘 자리인데 false: ${String(v).slice(0, 40)}`);
  }
  /* ★표본에 ★「svg」라는 글자가 ★든 사진을 섞는다 — 판정 자를 느슨하게(/svg/) 하면 ★여기서 빨개진다. */
  for (const v of ['data:image/png;base64,iVBORw0KGgo=', 'data:image/jpeg;base64,/9j/4AA', 'assets/img/a.png',
                   'https://x/y.png', 'assets/img/svg-mockup.png', 'data:image/png;base64,c3Zn',
                   'data:image/png;name=a.svg;base64,AA', 'https://x/svg/y.jpg',
                   'goya-asset://proj_1791778999148/abc.png', 'goya-asset://proj_1791778999148/abc.jpg']) {
    assert.equal(C.ifgIsIconSrc(v), false, `사진인데 true: ${v}`);
  }
});

test('A2 ifgIconSrcColor 왕복 · 못 읽으면 null', async () => {
  const { C } = await loadGrid({ withIfg: true });
  assert.equal(C.ifgIconSrcColor(oldIfgIconUri('#111111')), '#111111');
  assert.equal(C.ifgIconSrcColor(oldIfgIconUri('#222222')), '#222222');
  for (const v of ['', null, 'data:image/png;base64,AA', 'assets/a.png', 'data:image/svg+xml;base64,###',
                   'goya-asset://p/h.svg']) {
    assert.equal(C.ifgIconSrcColor(v), null, `색을 못 읽는 자리인데 ${C.ifgIconSrcColor(v)} 를 냈다`);
  }
});

test('A3 ★색 계약 — 뿌리 svg 에 style="color:…" 를 박고 `_recolor` 정규식이 그걸 찾는다', async () => {
  const { C } = await loadGrid({ withIfg: true });
  const painted = C.ifgPaintSvgRoot(ICONIFY_SVG, '#abcdef');
  assert.match(painted, /^<svg\b[^>]*\sstyle="color:#abcdef"/, '뿌리 style="color:…" 가 없다 — _recolor 가 못 찾는다');
  /* ★grid-infographic `_recolor` 의 ★그 정규식으로 ★직접 재 본다(같은 자) */
  const RECOLOR_RE = /(<svg[^>]*\sstyle="[^"]*color:\s*)(#[0-9a-fA-F]{3,8})/;
  assert.ok(RECOLOR_RE.test(painted), '_recolor 정규식이 이 svg 에서 색 자리를 못 찾는다');
  /* ⛔그림(path)·viewBox 는 안 건드린다 */
  assert.ok(painted.includes('viewBox="0 0 24 24"') && painted.includes('stroke-width="2"'));
});

test('A4 ifgPaintSvgRoot — 뿌리 style 은 갈아끼우고 · 안쪽은 안 건드리고 · svg 아니면 그대로', async () => {
  const { C } = await loadGrid({ withIfg: true });
  /* 이미 뿌리에 style 이 있는 꼴(자리표시 아이콘이 그렇다) */
  const had = '<svg viewBox="0 0 24 24" style="color:#ff0000;opacity:.5"><path d="M0 0"/></svg>';
  const out = C.ifgPaintSvgRoot(had, '#00ff00');
  assert.match(out, /^<svg[^>]*\sstyle="color:#00ff00"/);
  assert.equal(/color:#ff0000/.test(out), false, '옛 색이 남았다 — style 속성을 안 갈아끼웠다');
  assert.equal((out.match(/style=/g) || []).length, 1, 'style 속성이 둘이 됐다');
  /* 안쪽 svg·style 은 그대로 */
  const nested = '<svg viewBox="0 0 24 24"><g style="opacity:.3"><svg style="color:#123456"/></g></svg>';
  const out2 = C.ifgPaintSvgRoot(nested, '#00ff00');
  assert.ok(out2.includes('style="opacity:.3"') && out2.includes('color:#123456'), '안쪽을 건드렸다');
  /* 자기닫음 뿌리 */
  assert.match(C.ifgPaintSvgRoot('<svg viewBox="0 0 1 1"/>', '#010203'), /\sstyle="color:#010203"\/>$/);
  /* svg 가 아니면 그대로 */
  assert.equal(C.ifgPaintSvgRoot(ICONIFY_IMG_FALLBACK, '#00ff00'), ICONIFY_IMG_FALLBACK);
  assert.equal(C.ifgPaintSvgRoot('', '#00ff00'), '');
});

test('A5 ★ifgSvgToIconSrc — <svg> 가 아니면 null (429 폴백이 칸에 안 박힌다)', async () => {
  const { C } = await loadGrid({ withIfg: true });
  assert.equal(C.ifgSvgToIconSrc(ICONIFY_IMG_FALLBACK, '#222222'), null,
    'iconify 의 <img> 폴백이 data URI 로 싸였다 — 칸이 깨진 그림이 되고 저장본에 남는다');
  for (const bad of ['', null, undefined, '<html><body>429</body></html>', ' <div/>', 'svg', '<svgx/>']) {
    assert.equal(C.ifgSvgToIconSrc(bad, '#222222'), null, `svg 가 아닌데 통과했다: ${String(bad).slice(0, 30)}`);
  }
  /* 앞 공백·개행은 허용(iconify 응답에 섞인다) */
  assert.ok(C.ifgSvgToIconSrc('\n  ' + ICONIFY_SVG, '#222222'));
});

test('A5b ★★깨진 입력을 ★실제로 먹인다 — 2026-09-10 Cloudflare 꼴 HTML ＋ 소스에서 뽑은 <img> 폴백', async () => {
  const { G, C } = await loadGrid({ withIfg: true });
  const panel = readSrc(ROOT, 'js/panels/iconify-panel.js');

  /* ★전제 ⑴ — `_doInsert` 의 ★두 가드가 ★실재한다. ⇒ ★fetch 갈래에서 ★날 HTML 은 ★내게 ★안 온다.
     ⛔「거를 것이다」로 닫지 않는다 — ★그 줄이 ★있음을 ★여기서 재고, ★없어지면 ★이 칸이 빨개진다. */
  assert.match(panel, /if \(!res\.ok\) throw new Error\(`iconify \$\{res\.status\}`\)/, '★전제: HTTP 오류 가드가 없다');
  assert.match(panel, /if \(!\/\^\\s\*<svg\[\\s>\]\/i\.test\(body\)\) throw new Error\('iconify: not svg'\)/,
    '★전제: 비-svg 응답 가드가 없다');
  /* ★전제 ⑵ — ★즐겨찾기 갈래엔 ★그 검문이 ★0건이다(`svgText = _selectedIcon.svg` 그대로).
     ⇒ ★내가 `favorites` 를 ★안 켜서 ★지금은 안 오지만, ★켜는 날엔 ★내 문이 ★유일한 문이다. */
  const doInsert = panel.slice(panel.indexOf('async function _doInsert'));
  const favBranch = doInsert.slice(doInsert.indexOf('if (_selectedIcon.svg) {'), doInsert.indexOf('} else {'));
  assert.match(favBranch, /svgText = _selectedIcon\.svg;/, '★전제: 즐겨찾기 갈래의 꼴이 바뀌었다');
  assert.equal(/<svg\[/.test(favBranch), false, '★전제: 즐겨찾기 갈래에 svg 검문이 생겼다 — 그럼 이 주석을 고쳐라');

  /* ★폴백 꼴을 ★소스에서 ★뽑는다 — ⛔손으로 베끼면 그 템플릿이 바뀌어도 이 칸이 모른다. */
  const m = /svgText = `(<img src="[^`]*)`;/.exec(panel);
  assert.ok(m, '★폴백 템플릿을 소스에서 못 찾았다 — iconify-panel.js 가 바뀌었나');
  const FALLBACK = m[1]
    .replace('${ICONIFY_API}', 'https://api.iconify.design')
    .replace('${prefix}', 'lucide').replace('${iconName}', 'leaf')
    .replace(/\$\{size\}/g, '64');
  assert.match(FALLBACK, /^<img src="https:\/\/api\.iconify\.design\/lucide\/leaf\.svg" width="64"/, '폴백 조립이 틀렸다');

  /* ★★그 둘을 ★먹인다 — ⑴소스에서 뽑은 폴백 ⑵2026-09-10 사고 꼴의 ★≈7KB HTML 덩이 */
  const CF = '<!DOCTYPE html>\n<html><head><title>Attention Required! | Cloudflare</title></head>\n<body>'
    + '<div class="cf-wrapper"><h1>Sorry, you have been blocked</h1>'
    + '<p>You are unable to access api.iconify.design</p>'.repeat(120) + '</div></body></html>';
  assert.ok(CF.length > 6000, `★전제: 덩이가 ${CF.length}자 — 사고 실측은 ≈7KB 였다`);
  for (const bad of [FALLBACK, CF, '\n\n' + CF, '<?xml version="1.0"?><!DOCTYPE html><html/>']) {
    assert.equal(C.ifgSvgToIconSrc(bad, '#222222'), null, `깨진 입력이 통과했다: ${bad.slice(0, 44)}`);
  }
  /* ★양성대조 — ★성한 svg 는 ★같은 자를 ★지나간다(「언제나 null」로 통과하지 않게) */
  assert.ok(C.ifgSvgToIconSrc(ICONIFY_SVG, '#222222'), '★양성대조 실패: 성한 svg 도 거절했다');

  /* ★★그리고 ★칸에 ★아무것도 안 박힌다 — 커밋 0건 · 바이트 불변 · 토스트 N건 */
  const block = await mkCell(G, oldIfgIconUri('#222222'));
  const before = G.getGridModel(block).cells[0][0].lines[0].imgSrc;
  const calls = [];
  const real = window.updateGridBlock;
  window.updateGridBlock = (id, pt, o) => { calls.push(pt); return real(id, pt, o); };
  const msgs = spyToast();
  const t = C.ifgIconPickTarget(block, frameAt(0, 0, 0));
  for (const bad of [FALLBACK, CF]) assert.equal(C.ifgCommitIcon(block, t, pickedOf(bad)), null, '깨진 입력을 커밋했다');
  window.updateGridBlock = real;
  assert.equal(calls.length, 0, `문을 ${calls.length}번 열었다 — 0번이어야 한다(저장본 오염)`);
  assert.equal(G.getGridModel(block).cells[0][0].lines[0].imgSrc, before, '칸이 바뀌었다');
  assert.equal(msgs.length, 2, `토스트가 ${msgs.length}건 — 먹인 수(2)와 같아야 한다(조용히 삼키기 금지)`);
});

test('A6 ifgSvgToIconSrc 왕복 — 색이 읽히고 · 색을 안 주면 기본 #222222', async () => {
  const { C } = await loadGrid({ withIfg: true });
  const uri = C.ifgSvgToIconSrc(ICONIFY_SVG, '#ff0000');
  assert.equal(uri.indexOf(URI_HEAD), 0);
  assert.equal(C.ifgIconSrcColor(uri), '#ff0000');
  assert.equal(C.ifgIsIconSrc(uri), true, '제가 만든 것을 제가 아이콘으로 못 읽는다');
  assert.equal(C.ifgIconSrcColor(C.ifgSvgToIconSrc(ICONIFY_SVG, null)), '#222222');
  assert.equal(C.ifgIconSrcColor(C.ifgSvgToIconSrc(ICONIFY_SVG, 'red')), '#222222');
  assert.ok(unb64(uri).includes('d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2"'), '그림이 바뀌었다');
});

/* ══ B — 배선(소스·적재) ═══════════════════════════════════════════════════ */

test('B0 ★전제 — 주석 거르개(templateAware)가 읽는 파일들에서 템플릿 보간이 «닫힌다»', () => {
  /* ⚠️이 전제가 깨지면 아래 B1·B3·B4 는 «안 본 것»이 된다(_strip-comments.js 의 ⚠️한계 그대로). */
  for (const rel of ['js/block-drag.js', PICK_REL, 'js/panels/iconify-panel.js']) {
    assert.equal(SC.templateBalanced(readSrc(ROOT, rel)), true, `${rel} 의 백틱이 안 닫힌다 — 거르개가 눈먼다`);
  }
});

/** 「ifgIconDblclick 을 옛 두 가지보다 먼저 묻나」 — ★자 하나로 뽑아 ★자기 자신도 잰다(B1 뒷칸). */
function ifgAsksFirst(src) {
  const body = strip(src);
  const ask = body.indexOf('window.ifgIconDblclick');
  const empty = body.indexOf(".closest('.grd-img-empty[data-line]')");
  const crop = body.indexOf('grd-img-frame[data-line]:not(.grd-img-empty)');
  return { ask, empty, crop, ok: ask >= 0 && empty > ask && crop > ask };
}

test('B1 ★block-drag.js — 아이콘 고르개를 옛 두 가지보다 ★먼저 묻는다 ＋ 그 자가 ★무나', () => {
  const src = readSrc(ROOT, 'js/block-drag.js');
  const got = ifgAsksFirst(src);
  assert.ok(got.ask >= 0, 'window.ifgIconDblclick 호출이 0건 — 배선이 없다');
  assert.ok(got.empty >= 0 && got.crop >= 0, '★전제: 옛 두 가지(빈 슬롯·크롭)를 못 찾았다');
  assert.equal(got.ok, true, `순서가 틀렸다 — ask=${got.ask} empty=${got.empty} crop=${got.crop}`);
  /* ★★자기대조 — 순서를 ★뒤집은 소스에서 ★이 자가 ★빨개져야 한다(안 그러면 「안 재고 있다」와 구분 불가). */
  const swapped = strip(src)
    .replace('window.ifgIconDblclick', '§§ASK§§')
    .replace(".closest('.grd-img-empty[data-line]')", 'window.ifgIconDblclick/*moved*/')
    .replace('§§ASK§§', ".closest('.grd-img-empty[data-line]')");
  assert.equal(ifgAsksFirst(swapped).ok, false, '★뒤집은 소스에서도 초록이다 — 이 자는 순서를 안 재고 있다');
});

test('B2 block-drag.js 는 그 모듈을 import 하지 않는다 — window 다리', () => {
  const src = readSrc(ROOT, 'js/block-drag.js');
  assert.equal(/from\s+['"][^'"]*grid-ifg-icon-pick/.test(src), false,
    'block-drag.js 가 이 모듈을 import 한다 — 이 파일의 관례는 window 다리다');
  assert.match(src, /window\.ifgIconDblclick\?\./, '옵셔널 체이닝으로 «부를 때» 읽어야 한다');
});

test('B3 커밋 문은 updateGridBlock 하나 — ⛔Raw 아님', () => {
  const src = strip(readSrc(ROOT, PICK_REL));
  const calls = src.match(/window\.updateGridBlock\w*\?\./g) || [];
  assert.deepEqual(calls, ['window.updateGridBlock?.'],
    `고치는 문이 ${JSON.stringify(calls)} — ⌘Z 한 번이려면 updateGridBlock «하나»다(Raw 는 칸을 안 쌓는다)`);
});

test('B4 ★iconify 를 ★다시 짓지 않았다 — 검색·세트명부 0건 · 여는 문 하나 · 접미사는 세트당 1회', () => {
  const src = strip(readSrc(ROOT, PICK_REL));
  /* ⛔검색·세트 prefix 명부를 ★이 파일에 두지 않는다 — 그건 iconify-panel.js 몫이다. */
  assert.equal(/\/search\?query=|limit=80/.test(src), false, '검색을 다시 지었다 — openIconifyModal 이 쥔다');
  /* ⛔낱말로 재지 않는다 — `'feather'` 는 ★내 빠른 손잡이 ★아이콘 이름이기도 하다(거짓양성을 내가 한 번 밟았다).
     ⇒ ★`COLLECTIONS` 의 ★꼴(`{ id: '…', label: '…' }`)이 ★베껴졌나를 잰다. */
  assert.equal(/\{\s*id:\s*'[^']*'\s*,\s*label:/.test(src), false, '세트 prefix 명부(COLLECTIONS 꼴)를 베꼈다');
  assert.equal(/'material-symbols'|'heroicons'/.test(src), false, '세트 prefix 를 박았다');
  /* ★모달을 ★읽는 자리는 ★둘이고 ★그 둘이 ★전부다 — ⑴「쓸 수 있나」 판정(canMore) ⑵여는 자리.
     ⛔「하나」로 걸면 ★거짓 빨강이다(내가 한 번 그렇게 걸었다). ⇒ ★수가 아니라 ★이름으로 못박는다. */
  assert.equal((src.match(/window\.openIconifyModal/g) || []).length, 2,
    '모달을 읽는 자리가 둘(canMore 판정 ＋ 여는 자리)이 아니다');
  assert.equal((src.match(/typeof window\.openIconifyModal === 'function'/g) || []).length, 1, '쓸 수 있나 판정이 하나가 아니다');
  assert.equal((src.match(/const open = window\.openIconifyModal;/g) || []).length, 1, '여는 자리가 하나가 아니다');
  assert.equal((src.match(/^\s*open\(\(picked\)/gm) || []).length, 1, '모달을 부르는 자리가 하나가 아니다');
  /* ★네트워크는 ★접미사 조회 ★한 곳뿐이고 ★세트당 1회 캐시가 ★있다(:301 의 429 를 다시 밟지 않게) */
  const fetches = src.match(/\bfetch\s*\(/g) || [];
  assert.equal(fetches.length, 1, `fetch 가 ${fetches.length}곳 — 접미사 조회 한 곳뿐이어야 한다`);
  assert.match(src, /_SUFFIX_CACHE\.has\(prefix\)/, '세트당 1회 캐시가 없다 — 몰아쏘면 429 다');
  assert.match(src, /_SUFFIX_CACHE\.set\(prefix/, '못 받은 것도 캐시해야 매번 다시 안 쏜다');
  assert.equal(/\/search|icons=/.test(src.split('_suffixesOf')[0]), false, '접미사 조회 밖에서 API 를 쓴다');
  /* ★크기 칸은 숨긴다(크기는 프리셋 몫) · ⛔picked.size 를 안 쓴다 */
  assert.match(src, /hideSize:\s*true/, '크기 칸을 안 숨겼다 — 프리셋 iconSize 와 두 주인이 생긴다');
  assert.equal(/picked\s*\.\s*size/.test(src), false, 'picked.size 를 쓴다 — 아이콘 크기는 프리셋이 쥔다');
  /* ★기억한 세트로 ★걸러 연다 */
  assert.match(src, /prefix:\s*lk\.set/, 'prefix 로 세트를 걸러 열지 않는다 — 패밀리룩이 안 선다');
  /* ★전제 — iconify-panel.js 에 그 옵션들이 ★실재한다(없는 옵션을 넘기면 조용히 무시된다) */
  const panel = strip(readSrc(ROOT, 'js/panels/iconify-panel.js'));
  assert.match(panel, /options\?\.hideSize/, '★전제: iconify-panel.js 에 hideSize 옵션이 없다');
  assert.match(panel, /options\?\.prefix/, '★전제: iconify-panel.js 에 prefix 옵션이 없다(내가 더한 그 줄)');
  assert.match(panel, /window\.openIconifyModal\s*=\s*openIconifyModal/, '★전제: 그 모달의 window 다리가 없다');
  /* ★전제 — 내가 부르는 ★토스트 이름 둘이 ★실재한다(⛔「보통 있다」로 적지 않는다) */
  assert.match(readSrc(ROOT, 'js/drag-utils.js'), /window\.showToast\s*=\s*showToast/, '★전제: window.showToast 다리가 없다');
  assert.match(readSrc(ROOT, 'js/props/prop-grid.js'), /window\.grdToastImgFail\s*=\s*grdToastImgFail/, '★전제: window.grdToastImgFail 다리가 없다');
});

test('B6 ★「더 찾기」가 ★조용히 죽지 않는다 — 못 쓸 때 ★막고 ★말한다(소스 꼴 · 비석)', () => {
  /* ⚠️솔직히 — 이 칸은 ★소스 꼴을 잰다. 팝오버의 ★행위는 ★DOM 검사 몫이고 이번 판엔 ⛔금지라 ★안 쟀다.
     ★대신 9334 산 앱에서 ★한 번 눈으로 재고 그 수를 보고에 적었다. */
  const src = strip(readSrc(ROOT, PICK_REL));
  assert.match(src, /more\.disabled\s*=\s*!canMore/, '못 쓸 때 단추를 안 막는다 — 「눌리는데 아무 일 없음」');
  assert.match(src, /더 찾기를 쓸 수 없습니다/, '못 쓸 때 ★말을 안 한다');
  assert.match(src, /canMore\s*=\s*typeof window[\s\S]{0,80}openIconifyModal === 'function'/,
    '쓸 수 있나를 ★부를 때 재지 않는다');
  /* ★기억한 룩을 ★글자로 보여 준다 — 「무엇 안에서 고르는지」가 안 보이면 통일이 ★우연처럼 느껴진다. */
  assert.match(src, /'더 찾기 — iconify · ' \+ lk\.set/, '단추에 ★기억한 세트를 안 적는다');
  assert.match(src, /lk\.variant \? ' \/ ' \+ lk\.variant/, '단추에 ★기억한 스타일을 안 적는다');
});

test('B5 ★index.html 이 이 모듈을 얹는다 — grid-infographic.js 가 import 하지 않는다', () => {
  const html = readSrc(ROOT, 'index.html');
  assert.match(html, /<script type="module" src="js\/blocks\/grid-ifg-icon-pick\.js">/,
    'script 태그가 없다 — 이 모듈이 앱에 한 번도 안 실린다(window 다리가 안 걸린다)');
  /* ★적재 길이 ★하나임을 같이 잠근다 — import 로도 실리면 두 벌이 된다 */
  const ifg = readSrc(ROOT, 'js/blocks/grid-infographic.js');
  /* ★두 꼴을 다 본다 — `import X from './…'` ★그리고 ★부작용만 끌어오는 `import './…';`
     (⛔`from` 만 보면 뒤엣것이 ★안 걸린다 — 변이 스윕 M26 이 그 틈으로 ★살아남았다) */
  assert.equal(/import\s+(?:[\s\S]*?\sfrom\s*)?['"][^'"]*grid-ifg-icon-pick/.test(ifg), false,
    'grid-infographic.js 가 import 한다 — script 태그와 둘이 되면 적재 길이 두 벌이다');
  /* ★순서 — grid-infographic.js «뒤»여야 window.GRID_IFG_PRESETS 가 먼저 선다(색 대타가 그걸 읽는다) */
  assert.ok(html.indexOf('js/blocks/grid-ifg-icon-pick.js') > html.indexOf('js/blocks/grid-infographic.js'),
    'grid-infographic.js 보다 먼저 실린다 — 모듈 평가 순서가 뒤집힌다');
});

/* ══ C — 판정·커밋(하네스) ═════════════════════════════════════════════════ */

/** 아이콘 줄 하나를 가진 그리드. ifg = 표식을 달까 · src = 그 줄의 imgSrc. */
async function mkCell(G, imgSrc, { ifg = true, key = 'basic', h = 144 } = {}) {
  const lines = [{ type: 'image', imgShape: 'circle', height: h, imgSrc }, { type: 'h3', text: 'T' }];
  const { block } = G.makeGridBlock({
    cols: [{ width: 1, lines }], rows: [{ height: 'auto' }], cells: [[{ lines }]],
    ...(ifg ? { ifgPreset: key } : {}),
  });
  return block;
}
const frameAt = (r, c, li) => ({ dataset: { r: String(r), c: String(c), line: String(li) } });

/** ★팝오버를 갈아끼운다 — «몇 번 떴나»와 ★넘긴 룩을 센다(⇒ 「표식 없으면 ★0건」이 재는 자를 갖는다).
 *  ★미니 DOM 엔 body 가 없어 ★진짜 팝오버는 안 뜬다 ⇒ 이 자리를 갈아야 ★셀 수 있다. */
function spyPopover() {
  const opens = [];
  window.openIfgIconPopover = (frame, onPick, look) => { opens.push({ frame, onPick, look }); return { fake: true }; };
  return opens;
}
/** 토스트를 센다 — C4 가 「조용히 아무 일 없음」과 「막았다」를 갈라야 한다. */
function spyToast() {
  const msgs = [];
  window.showToast = (m) => { msgs.push(String(m)); };
  return msgs;
}

test('C1 ★음성대조 ⑴ — 표식 없는 보통 그리드에선 ★팝오버 0건 (옛 크롭 편집 그대로)', async () => {
  const { G, C } = await loadGrid({ withIfg: true });
  const opens = spyPopover();
  const plain = await mkCell(G, oldIfgIconUri('#222222'), { ifg: false });
  assert.equal(plain.dataset.ifgPreset, undefined, '★전제: 표식이 달려 버렸다 — 음성대조가 성립 안 한다');
  assert.equal(C.ifgIconPickTarget(plain, frameAt(0, 0, 0)), null,
    '표식 없는 그리드에서 고르개가 떴다 — 2026-09-25 크롭 편집을 빼앗는다');
  assert.equal(C.ifgIconDblclick(plain, frameAt(0, 0, 0)), false, '더블클릭을 가로챘다');
  assert.equal(opens.length, 0, `팝오버가 ${opens.length}번 떴다 — 0건이어야 한다`);
  /* ★양성대조 — 표식만 달면 ★같은 판에서 ★뜬다(「안 재고 있다」와 구분) ＋ ★룩을 같이 넘긴다 */
  const marked = await mkCell(G, oldIfgIconUri('#222222'));
  assert.equal(marked.dataset.ifgPreset, 'basic', '★전제: 표식이 안 달렸다');
  assert.equal(C.ifgIconDblclick(marked, frameAt(0, 0, 0)), true, '★양성대조 실패: 표식이 있는데 안 가로챘다');
  assert.equal(opens.length, 1, `★양성대조 실패: 팝오버가 ${opens.length}번 떴다`);
  assert.deepEqual(opens[0].look, { set: 'lucide', variant: '' }, '룩을 안 넘겼다 — 기본은 lucide(내장 35종과 같은 패밀리)');
  assert.equal(opens[0].frame.dataset.line, '0', '앵커가 그 줄의 프레임이 아니다');
});

test('C1b ★끝에서 끝까지 — ★입구 둘(내장·iconify)이 ★같은 커밋 길로 간다', async () => {
  const { G, C } = await loadGrid({ withIfg: true });
  const opens = spyPopover();
  /* ⒜ 내장 35종 — prefix 없는 이름 */
  const b1 = await mkCell(G, oldIfgIconUri('#333333'));
  assert.equal(C.ifgIconDblclick(b1, frameAt(0, 0, 0)), true);
  opens[0].onPick({ name: 'rocket', svg: C.ifgIconSvgMarkup('rocket', null), builtIn: true });
  const got1 = G.getGridModel(b1).cells[0][0].lines[0].imgSrc;
  assert.equal(C.ifgIconSrcColor(got1), '#333333', '내장 손잡이가 칸의 색을 안 물려받았다');
  assert.ok(unb64(got1).includes('M4.5 16.5c-1.5 1.26-2 5-2 5'), '내장 rocket 그림이 안 실렸다');
  /* ⒝ iconify — prefix 있는 이름. ★같은 함수로 들어간다 */
  const b2 = await mkCell(G, oldIfgIconUri('#333333'));
  assert.equal(C.ifgIconDblclick(b2, frameAt(0, 0, 0)), true);
  opens[1].onPick(pickedOf(ICONIFY_SVG, 'ph:leaf-bold'));
  const got2 = G.getGridModel(b2).cells[0][0].lines[0].imgSrc;
  assert.equal(got2, C.ifgSvgToIconSrc(ICONIFY_SVG, '#333333'), 'iconify 아이콘이 그 칸에 안 들어갔다');
  assert.ok(unb64(got2).includes('C15.5 5 17 4.48 19 2'), 'iconify 그림이 안 실렸다');
});

test('C1c ★팝오버를 ★못 띄우면 ★가로채지 않는다 — 「가로채 놓고 아무 일도 안 난다」 금지', async () => {
  const { G, C } = await loadGrid({ withIfg: true });
  const block = await mkCell(G, oldIfgIconUri('#222222'));
  /* ★전제 — 여는 자가 ★성하면 가로챈다(이 칸이 «언제나 false» 로 통과하지 않게) */
  const opens = spyPopover();
  assert.equal(C.ifgIconDblclick(block, frameAt(0, 0, 0)), true, '★전제: 성한 팝오버에서도 안 가로챘다');
  assert.equal(opens.length, 1);
  let called = 0;
  window.openIfgIconPopover = () => { called++; return null; };
  assert.equal(C.ifgIconDblclick(block, frameAt(0, 0, 0)), false,
    '팝오버가 안 떴는데 true 를 냈다 — 더블클릭이 먹통이 된다(파일창·크롭도 안 열린다)');
  assert.equal(called, 1, '여는 자를 안 불렀다 — 이 칸이 다른 까닭으로 통과했다');
});

test('C9 ★세트·스타일 기억 — iconify 픽만 적고 · 내장은 안 적고 · 커밋 실패면 안 적는다', async () => {
  const { G, C } = await loadGrid({ withIfg: true });
  /* ★전제 — ifgRememberLook 은 접미사 명부를 ★네트워크에서 받는다. 노드 하네스엔 그 길이 없다
     ⇒ ★`set` 은 적히고 `variant` 는 ★빈 채 남는다(⛔지어내지 않는다)가 ★이 판의 기대값이다. */
  const opens = spyPopover();
  const b = await mkCell(G, oldIfgIconUri('#222222'));
  assert.equal(b.dataset.ifgIconSet, undefined, '★전제: 룩이 미리 적혀 있다');
  C.ifgIconDblclick(b, frameAt(0, 0, 0));
  opens[0].onPick(pickedOf(ICONIFY_SVG, 'solar:leaf-linear'));
  await new Promise(r => setTimeout(r, 0));
  assert.equal(b.dataset.ifgIconSet, 'solar', `세트를 안 적었다(${b.dataset.ifgIconSet})`);
  /* ⇒ 다음에 열 때 ★그 세트로 간다 */
  assert.equal(C.ifgIconLook(b).set, 'solar');
  C.ifgIconDblclick(b, frameAt(0, 0, 0));
  assert.equal(opens[1].look.set, 'solar', '기억한 세트를 다음 열기에 안 넘겼다');
  /* ⒝ 내장 손잡이(prefix 없음)는 ★룩을 안 건드린다 */
  C.ifgIconDblclick(b, frameAt(0, 0, 0));
  opens[2].onPick({ name: 'leaf', svg: C.ifgIconSvgMarkup('leaf', null), builtIn: true });
  await new Promise(r => setTimeout(r, 0));
  assert.equal(b.dataset.ifgIconSet, 'solar', '내장 손잡이가 룩을 지웠다');
  /* ⒞ ★커밋이 거절되면(429 폴백) ★룩도 안 바뀐다 */
  const b2 = await mkCell(G, oldIfgIconUri('#222222'));
  C.ifgIconDblclick(b2, frameAt(0, 0, 0));
  opens[3].onPick(pickedOf(ICONIFY_IMG_FALLBACK, 'mdi:leaf'));
  await new Promise(r => setTimeout(r, 0));
  assert.equal(b2.dataset.ifgIconSet, undefined, '커밋이 거절됐는데 룩을 적었다');
});

test('C10 ★오프라인 음성대조 ⑴ — ★내장 35종은 ★네트워크 0회로 뜬다', async () => {
  const { C } = await loadGrid({ withIfg: true });
  /* ★fetch 를 ★터뜨려 둔다 — 내장 길이 네트워크를 ★한 번이라도 타면 여기서 죽는다. */
  const realFetch = globalThis.fetch;
  let hits = 0;
  globalThis.fetch = () => { hits++; throw new Error('★오프라인인데 네트워크를 탔다'); };
  try {
    assert.equal(C.IFG_ICONS.length, 35, `빠른 손잡이가 ${C.IFG_ICONS.length}종 — 시안 샘플은 35종이다`);
    assert.equal(new Set(C.IFG_ICONS.map(d => d.name)).size, 35, '이름이 겹친다');
    assert.deepEqual(C.ifgIconSearch('세척').map(d => d.name).sort(), ['droplets', 'sparkles'], '한글 별칭 검색이 안 먹는다');
    assert.deepEqual(C.ifgIconSearch('세척'.normalize('NFD')).map(d => d.name).sort(), ['droplets', 'sparkles'], 'NFD 질의가 0건');
    assert.deepEqual(C.ifgIconSearch('없는말'), [], '안 맞는 말에 0건이 아니다');
    const uri = C.ifgIconDataUri('leaf', '#111111');
    assert.equal(C.ifgIconSrcColor(uri), '#111111');
    assert.equal(C.ifgIsIconSrc(uri), true);
    assert.equal(C.ifgIconDataUri('없는아이콘'), '', '명부 밖 이름이 통과했다');
    assert.equal(C.ifgIconDef('constructor'), null, '원형 오염 이름이 통과했다');
  } finally { globalThis.fetch = realFetch; }
  assert.equal(hits, 0, `내장 길이 네트워크를 ${hits}번 탔다 — 오프라인에서 죽는다`);
});

test('C2 커밋 — 문 한 번 · trusted · 그 줄만 · 원형/지름 보존 · ⛔picked.size 미사용', async () => {
  const { G, C } = await loadGrid({ withIfg: true });
  const block = await mkCell(G, oldIfgIconUri('#222222'), { h: 144 });
  const t = C.ifgIconPickTarget(block, frameAt(0, 0, 0));
  assert.deepEqual({ r: t.r, c: t.c, li: t.li, color: t.color }, { r: 0, c: 0, li: 0, color: '#222222' });
  const calls = [];
  const real = window.updateGridBlock;
  window.updateGridBlock = (id, partial, o) => { calls.push({ id, partial, o }); return real(id, partial, o); };
  const res = C.ifgCommitIcon(block, t, pickedOf(ICONIFY_SVG));
  window.updateGridBlock = real;
  assert.equal(res && res.ok, true, `커밋 실패 — ${res && res.message}`);
  assert.equal(calls.length, 1, `문을 ${calls.length}번 열었다 — ⌘Z 한 번이려면 하나다`);
  assert.equal(calls[0].o && calls[0].o.trusted, true, '사람이 고른 것이다 — trusted 로 보내야 캡에 안 걸린다');
  assert.deepEqual(Object.keys(calls[0].partial.patchCell).sort(), ['c', 'imgSrc', 'lineIndex', 'r'],
    '보낸 키가 늘었다 — 아이콘만 갈아야 한다');
  const line = G.getGridModel(block).cells[0][0].lines[0];
  assert.equal(line.imgShape, 'circle', '원형이 풀렸다');
  assert.equal(line.height, 144, `지름이 ${line.height} 로 바뀌었다 — picked.size(64)를 썼다`);
  assert.equal(G.getGridModel(block).cells[0][0].lines[1].text, 'T', '글이 바뀌었다');
});

test('C3 표식 ＋ ★사진 줄 → ★팝오버 0건 (2026-09-25 크롭 편집을 안 빼앗는다)', async () => {
  const { G, C } = await loadGrid({ withIfg: true });
  const opens = spyPopover();
  for (const photo of ['data:image/png;base64,iVBORw0KGgo=', 'assets/img/shot.jpg', 'assets/img/svg-mockup.png',
                       'goya-asset://proj_1791778999148/abc.png']) {
    const block = await mkCell(G, photo);
    assert.equal(block.dataset.ifgPreset, 'basic', '★전제: 표식이 없다');
    assert.equal(C.ifgIconPickTarget(block, frameAt(0, 0, 0)), null, `사진(${photo.slice(0, 24)})에서 고르개가 떴다`);
    assert.equal(C.ifgIconDblclick(block, frameAt(0, 0, 0)), false);
  }
  assert.equal(opens.length, 0, `사진에서 팝오버가 ${opens.length}번 떴다 — 0건이어야 한다`);
});

test('C4 ★429 폴백(<img src=…>)이 오면 ★커밋 0건 ＋ 토스트 1건', async () => {
  const { G, C } = await loadGrid({ withIfg: true });
  const block = await mkCell(G, oldIfgIconUri('#222222'));
  const before = G.getGridModel(block).cells[0][0].lines[0].imgSrc;
  const calls = [];
  const real = window.updateGridBlock;
  window.updateGridBlock = (id, p, o) => { calls.push(p); return real(id, p, o); };
  const msgs = spyToast();
  const t = C.ifgIconPickTarget(block, frameAt(0, 0, 0));
  const res = C.ifgCommitIcon(block, t, pickedOf(ICONIFY_IMG_FALLBACK));
  window.updateGridBlock = real;
  assert.equal(res, null, '폴백을 커밋했다');
  assert.equal(calls.length, 0, `문을 ${calls.length}번 열었다 — 0번이어야 한다(저장본 오염)`);
  assert.equal(G.getGridModel(block).cells[0][0].lines[0].imgSrc, before, '칸이 바뀌었다');
  assert.equal(msgs.length, 1, `토스트가 ${msgs.length}건 — 조용히 아무 일도 안 나면 사용자가 모른다`);
  assert.match(msgs[0], /아이콘/, '토스트 문구가 이 일을 안 말한다');
});

test('C5 ifgBuildOpts 로 만든 인포그래픽의 자리표시 아이콘이 이 판정에 걸린다 (끝에서 끝까지)', async () => {
  const { G, I, C } = await loadGrid({ withIfg: true });
  const { block } = G.makeGridBlock(I.ifgBuildOpts([{ title: 'T', desc: 'D' }], 3, 3, 'basic'));
  assert.equal(block.dataset.ifgPreset, 'basic');
  const lines = G.getGridModel(block).cells[1][2].lines;
  const li = lines.findIndex(l => l.type === 'image');
  assert.ok(li >= 0, '★전제: 아이콘 줄이 없다');
  assert.equal(C.ifgIsIconSrc(lines[li].imgSrc), true, '자리표시 아이콘이 «아이콘»으로 안 읽힌다');
  const t = C.ifgIconPickTarget(block, frameAt(1, 2, li));
  assert.ok(t, '갓 만든 인포그래픽의 아이콘에서 고르개가 안 뜬다');
  assert.equal(t.color, '#222222', '자리표시 색을 못 읽었다');
});

test('C6 ★옛 저장본 무회귀 — ⒜ ifgIconUri 바이트 동일 ⒝ 옛 꼴 URI 도 프리셋에서 색이 갈린다', async () => {
  const { G, I, C } = await loadGrid({ withIfg: true });
  /* ⒜ 자리표시 URI 가 1017t1i2 «전»과 바이트 동일 — 내장 명부를 넣었다 걷는 동안 안 틀어졌나 */
  for (const col of ['#222222', '#111111', '#0a0b0c', 'zzz', undefined]) {
    assert.equal(I.ifgIconUri(col), oldIfgIconUri(col), `색 ${String(col)} 에서 옛 판과 바이트가 갈렸다`);
  }
  /* ⒝ 옛 꼴 URI 를 든 블럭에 「구분선」 프리셋(iconColor #111111)을 적용 → `_recolor` 가 색을 간다 */
  const block = await mkCell(G, oldIfgIconUri('#222222'));
  const res = I.applyIfgPreset(block, 'lines');
  assert.equal(res.ok, true, res.message);
  const got = G.getGridModel(block).cells[0][0].lines.find(l => l.type === 'image').imgSrc;
  assert.equal(C.ifgIconSrcColor(got), '#111111', '옛 저장본의 아이콘 색이 프리셋에서 안 갈렸다');
  assert.ok(unb64(got).includes(OLD_ICON_D), '옛 그림이 바뀌었다 — _recolor 는 색만 갈아야 한다');
  assert.equal(C.ifgIsIconSrc(got), true);
});

test('C7 ★★외부화된 아이콘(goya-asset://…svg) — 고르개가 ★뜨고, 색은 ★프리셋에서 온다', async () => {
  const { G, I, C } = await loadGrid({ withIfg: true });
  /* ★전제 — 프리셋 표의 아이콘 색(이 값으로 떨어져야 한다) */
  assert.equal(I.GRID_IFG_PRESETS.basic.iconColor, '#222222');
  assert.equal(I.GRID_IFG_PRESETS.lines.iconColor, '#111111');
  assert.equal(window.GRID_IFG_PRESETS, I.GRID_IFG_PRESETS, '★전제: window 다리가 안 걸렸다');
  const EXT = 'goya-asset://proj_1791778999148/d1be6a8db7fe86e2.svg';
  assert.equal(C.ifgIconSrcColor(EXT), null, '★전제: 외부화 참조에서 색을 읽을 수 있다고 착각했다');
  for (const [key, want] of [['basic', '#222222'], ['lines', '#111111']]) {
    const block = await mkCell(G, EXT, { key, h: 84 });
    assert.equal(block.dataset.ifgPreset, key, '★전제: 표식이 안 달렸다');
    const t = C.ifgIconPickTarget(block, frameAt(0, 0, 0));
    assert.ok(t, `외부화된 아이콘(${key})에서 고르개가 안 뜬다 — 현빈 프로젝트 인포그래픽 3개 중 2개가 이 꼴이다`);
    assert.equal(t.color, want, `${key} 프리셋 아이콘 색이 ${t.color} 로 떨어졌다`);
    C.ifgCommitIcon(block, t, pickedOf(ICONIFY_SVG));
    assert.equal(G.getGridModel(block).cells[0][0].lines[0].imgSrc, C.ifgSvgToIconSrc(ICONIFY_SVG, want),
      '외부화 칸을 갈면서 색이 틀어졌다');
  }
});

test('C8 ★iconify 아이콘을 넣은 뒤 ★프리셋 적용이 그 색을 간다 (색 계약이 끝까지 선다)', async () => {
  const { G, I, C } = await loadGrid({ withIfg: true });
  const block = await mkCell(G, oldIfgIconUri('#222222'));
  const t = C.ifgIconPickTarget(block, frameAt(0, 0, 0));
  C.ifgCommitIcon(block, t, pickedOf(ICONIFY_SVG));
  assert.equal(C.ifgIconSrcColor(G.getGridModel(block).cells[0][0].lines[0].imgSrc), '#222222', '★전제');
  const res = I.applyIfgPreset(block, 'lines');     // lines.iconColor = #111111
  assert.equal(res.ok, true, res.message);
  const got = G.getGridModel(block).cells[0][0].lines.find(l => l.type === 'image').imgSrc;
  assert.equal(C.ifgIconSrcColor(got), '#111111',
    'iconify 아이콘의 색이 프리셋에서 안 갈렸다 — 뿌리 style="color:…" 가 안 박혔다');
  assert.ok(unb64(got).includes('C15.5 5 17 4.48 19 2'), '프리셋이 그림을 갈아버렸다');
});

test('C11 ★★알려진 틈(기록) — ★외부화된 아이콘은 ★프리셋 적용이 ★색을 못 바꾼다 (★내 변경 전부터 그렇다)', async () => {
  /* ★★이것은 ★내가 만든 결함이 ★아니다 — `grid-infographic.js _recolor` 가
       `uri.indexOf(_URI_HEAD) !== 0` 이면 ★그대로 돌려주기 때문이고, 그 줄은 ★1013t2F 부터 있었다.
     ★★왜 검사로 ★적어 두나 — 현빈 프로젝트에 ★실재한다(2026-10-20 9334 실측:
       캔버스의 `goya-asset://` 참조 ★48건 중 ★29건이 `.svg`(=아이콘) · 인포그래픽 ★2블럭이 그 꼴).
       ⇒ 그 둘에서 「프리셋 적용」을 눌러도 ★아이콘 색만 ★안 바뀐다. ⛔「0건」으로 두면 아무도 모른다.
     ★내 길은 ★여기에 안 걸린다 — 고르는 순간 ★data URI 로 다시 들어오고(C7) 그 뒤로는 색이 간다(C8).
     ⇒ ★이 칸이 ★빨개지는 날 = 누가 `_recolor` 를 ★외부화까지 보게 고친 날이다. ★그때 이 칸을 ★갈아라. */
  const { G, I, C } = await loadGrid({ withIfg: true });
  const EXT = 'goya-asset://proj_1791778999148/d1be6a8db7fe86e2.svg';
  const block = await mkCell(G, EXT, { key: 'basic' });
  const res = I.applyIfgPreset(block, 'lines');            // lines.iconColor = #111111
  assert.equal(res.ok, true, res.message);
  const got = G.getGridModel(block).cells[0][0].lines.find(l => l.type === 'image').imgSrc;
  assert.equal(got, EXT, '★틈이 닫혔다 — 좋은 일이다. 이 칸을 「색이 간다」로 갈아라');
  /* ★그래도 ★고르개는 ★뜬다(C7) ⇒ 사용자가 ★빠져나갈 길이 있다.
     ⚠️줄 ★자리를 다시 찾는다 — 「구분선」 프리셋은 순서를 [제목·아이콘·꼬리말]로 ★다시 세운다(order).
       ⛔앞의 `frameAt(0,0,0)` 을 그대로 쓰면 ★제목 줄을 가리켜 null 이 나온다(내가 한 번 밟았다). */
  const after = G.getGridModel(block).cells[0][0].lines;
  const li = after.findIndex(l => l.type === 'image');
  assert.equal(li, 1, `★전제: 구분선 프리셋에서 아이콘이 둘째 줄이 아니다(li=${li})`);
  assert.ok(C.ifgIconPickTarget(block, frameAt(0, 0, li)), '빠져나갈 길(고르개)마저 막혔다');
});

/* ══ D — 변이(음성대조) : 위 단언들이 ★빨개지는지 ═════════════════════════════
 * ★「초록」을 증거로 쓰지 않는다. 비틀면 ★어느 단언이 ★죽는지 여기서 보여 둔다. */

test('D1 ★변이 — 뿌리에 색을 안 박으면 ★색 계약·프리셋 적용이 깨진다', async () => {
  const { G, I, C } = await loadGrid({
    withIfg: true,
    mutate: mutPick("    .replace(/(\\/?)>$/, ' style=\"color:' + col + '\"$1>');", "    .replace(/(\\/?)>$/, '$1>');", 'D1 색 자리 제거'),
  });
  assert.doesNotMatch(C.ifgPaintSvgRoot(ICONIFY_SVG, '#abcdef'), /style="color:/, '★변이가 안 먹었다');
  assert.equal(C.ifgIconSrcColor(C.ifgSvgToIconSrc(ICONIFY_SVG, '#ff0000')), null, '★A6 가 이 변이를 못 잡는다');
  /* ⇒ C8(프리셋이 색을 간다)이 이 꼴을 막는다 — 여기서 «안 갈림»을 보여 둔다 */
  const block = await mkCell(G, oldIfgIconUri('#222222'));
  const t = C.ifgIconPickTarget(block, frameAt(0, 0, 0));
  C.ifgCommitIcon(block, t, pickedOf(ICONIFY_SVG));
  I.applyIfgPreset(block, 'lines');
  assert.equal(C.ifgIconSrcColor(G.getGridModel(block).cells[0][0].lines.find(l => l.type === 'image').imgSrc), null,
    '★C8 이 이 변이를 못 잡는다');
});

test('D2 ★변이 — svg 검사를 걷으면 ★429 폴백이 칸에 박힌다', async () => {
  const { C } = await loadGrid({
    withIfg: true,
    mutate: mutPick("  if (!/^\\s*<svg[\\s>]/i.test(s)) return null;", '', 'D2 svg 검사 제거'),
  });
  assert.ok(C.ifgSvgToIconSrc(ICONIFY_IMG_FALLBACK, '#222222'), '★변이가 안 먹었다');
  /* ⇒ A5·C4 가 이 꼴을 막는다 */
});

test('D3 ★변이 — 판정에서 ifgPreset 조건을 빼면 ★보통 그리드까지 고르개가 뜬다', async () => {
  const { G, C } = await loadGrid({
    withIfg: true,
    mutate: mutPick('if (!block || !block.dataset || !block.dataset.ifgPreset || !frame || !frame.dataset) return null;',
      'if (!block || !block.dataset || !frame || !frame.dataset) return null;', 'D3 표식 조건 제거'),
  });
  const plain = await mkCell(G, oldIfgIconUri('#222222'), { ifg: false });
  assert.ok(C.ifgIconPickTarget(plain, frameAt(0, 0, 0)), '★변이가 안 먹었다');
  /* ⇒ C1 이 이 꼴을 막는다 */
});

test('D4 ★변이 — ifgIsIconSrc 를 「언제나 참」으로 만들면 ★사진이 고르개에 먹힌다', async () => {
  const { G, C } = await loadGrid({
    withIfg: true,
    mutate: mutPick('return SVG_URI_RE.test(s) || SVG_PATH_RE.test(s);', 'return true;', 'D4 사진 구분 제거'),
  });
  const block = await mkCell(G, 'data:image/png;base64,iVBORw0KGgo=');
  assert.ok(C.ifgIconPickTarget(block, frameAt(0, 0, 0)), '★변이가 안 먹었다');
  /* ⇒ A1·C3 이 이 꼴을 막는다 */
});

test('D5 ★변이 — ★외부화(.svg) 가지를 빼면(내 첫 판) 현빈 프로젝트 꼴에서 고르개가 안 뜬다', async () => {
  const { G, C } = await loadGrid({
    withIfg: true,
    mutate: mutPick('return SVG_URI_RE.test(s) || SVG_PATH_RE.test(s);    //', 'return SVG_URI_RE.test(s);    //', 'D5 외부화 가지 제거'),
  });
  const EXT = 'goya-asset://proj_1791778999148/d1be6a8db7fe86e2.svg';
  assert.equal(C.ifgIsIconSrc(EXT), false, '★변이가 안 먹었다');
  const block = await mkCell(G, EXT);
  assert.equal(C.ifgIconPickTarget(block, frameAt(0, 0, 0)), null, '★A1·C7 이 이 변이를 못 잡는다');
});

test('D6 ★변이 — 프리셋 색 대타를 빼면 외부화 칸에서 색이 기본값으로 떨어진다', async () => {
  const { G, C } = await loadGrid({
    withIfg: true,
    mutate: mutPick('return { r, c, li, color: ifgIconSrcColor(line.imgSrc) || _presetIconColor(block) };',
      'return { r, c, li, color: ifgIconSrcColor(line.imgSrc) };', 'D6 색 대타 제거'),
  });
  const block = await mkCell(G, 'goya-asset://p/h.svg', { key: 'lines' });
  const t = C.ifgIconPickTarget(block, frameAt(0, 0, 0));
  assert.equal(t.color, null, '★변이가 안 먹었다');
  C.ifgCommitIcon(block, t, pickedOf(ICONIFY_SVG));
  assert.equal(C.ifgIconSrcColor(G.getGridModel(block).cells[0][0].lines[0].imgSrc), '#222222',
    '★C7 이 색 대타 제거를 못 잡는다 (#111111 이어야 한다)');
});

test('D7 ★변이 — 더블클릭이 판정을 무시하면 ★표식 없는 그리드까지 가로챈다', async () => {
  const { G, C } = await loadGrid({
    withIfg: true,
    mutate: mutPick('  const target = ifgIconPickTarget(block, frame);\n  if (!target) return false;',
      '  const target = ifgIconPickTarget(block, frame) || { r: 0, c: 0, li: 0, color: null };', 'D7 판정 무시'),
  });
  const opens = spyPopover();
  const plain = await mkCell(G, oldIfgIconUri('#222222'), { ifg: false });
  assert.equal(C.ifgIconDblclick(plain, frameAt(0, 0, 0)), true, '★변이가 안 먹었다');
  assert.equal(opens.length, 1, '★C1 이 이 변이를 못 잡는다');
});

test('D8 ★변이 — hideSize 를 빼면 크기 칸이 떠서 ★프리셋과 두 주인이 된다', async () => {
  /* ⚠️⛔`String(fn)` 으로 재지 않는다 — ★Function.toString 은 ★주석까지 품어서, 머리말에 적힌
       「★`hideSize` — …」 한 줄이 ★변이를 ★가린다(내가 한 번 밟았다). ⇒ ★소스를 비틀고 ★주석을 걷어 잰다. */
  const { PICK_RAW } = require('./_grid-ifg-harness.js');
  const mutated = inject(PICK_RAW, '{ hideSize: true, prefix: lk.set }', '{ prefix: lk.set }', 'D8 hideSize 제거');
  assert.equal(/hideSize/.test(strip(mutated)), false, '★변이가 안 먹었다');
  assert.equal(/hideSize/.test(strip(PICK_RAW)), true, '★전제: 성한 판엔 hideSize 가 있다');
  /* ★비튼 판도 ★돈다(=문법이 성하다)까지 보여 둔다 — 그래야 「안 돌아서 초록」이 아니다 */
  const { C } = await loadGrid({ withIfg: true, pickSrc: mutated });
  assert.equal(typeof C.openIfgIconPopover, 'function');
  /* ⇒ B4 의 소스 단언이 이 꼴을 막는다(모달 옵션은 팝오버 안 핸들러라 유닛이 행위로 못 잡는다 — 솔직히 적는다) */
});

test('D9 ★변이 — 접미사 캐시를 빼면 ★세트마다 매번 쏜다(:301 의 429 를 다시 밟는다)', async () => {
  const { C } = await loadGrid({
    withIfg: true,
    mutate: mutPick('  if (_SUFFIX_CACHE.has(prefix)) return _SUFFIX_CACHE.get(prefix);\n', '', 'D9 캐시 제거'),
  });
  void C;
  /* ⇒ B4 가 소스에서 그 캐시를 요구한다 — 여기서 「빼면 주입된다」만 보여 둔다 */
  assert.ok(true);
});

test('D10 ★변이 — 접미사를 「마지막 하이픈 뒤」로 ★지어내면 arrow-up-down 이 variant down 이 된다', async () => {
  const { G, C } = await loadGrid({
    withIfg: true,
    mutate: mutPick("  const hit = sufs.find(sx => nm.length > sx.length + 1 && nm.endsWith('-' + sx)) || '';",
      "  const hit = (nm.split('-').length > 1 ? nm.split('-').pop() : '');", 'D10 접미사 추측'),
  });
  /* ★접미사 명부를 ★받은 것처럼 꾸민다 — 노드엔 네트워크가 없으니 fetch 를 갈아끼운다 */
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ suffixes: { bold: 'Bold' } }) });
  try {
    const b = await mkCell(G, oldIfgIconUri('#222222'));
    const got = await C.ifgRememberLook(b, 'lucide:arrow-up-down');
    assert.equal(got.variant, 'down', '★변이가 안 먹었다');
    assert.equal(b.dataset.ifgIconVariant, 'down', '★지어낸 스타일이 블럭에 박혔다 — 이게 막으려는 그것이다');
  } finally { globalThis.fetch = realFetch; }
});

test('D11 ★양성대조 — ★성한 판은 ★명부에 있는 접미사만 떼낸다', async () => {
  const { G, C } = await loadGrid({ withIfg: true });
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ suffixes: { '': 'Regular', bold: 'Bold', 'bold-duotone': 'Bold Duotone' } }) });
  try {
    const b = await mkCell(G, oldIfgIconUri('#222222'));
    assert.deepEqual(await C.ifgRememberLook(b, 'solar:leaf-bold-duotone'), { set: 'solar', variant: 'bold-duotone' },
      '긴 접미사를 먼저 안 봤다 — bold 로 잘렸다');
    assert.deepEqual(await C.ifgRememberLook(b, 'solar:arrow-up-down'), { set: 'solar', variant: '' },
      '명부에 없는 꼬리를 스타일로 떼냈다');
    assert.deepEqual(await C.ifgRememberLook(b, 'solar:leaf'), { set: 'solar', variant: '' });
    /* ★못 받으면 set 만 — ⛔지어내지 않는다 */
    globalThis.fetch = async () => ({ ok: false, status: 429 });
    const b2 = await mkCell(G, oldIfgIconUri('#222222'));
    assert.deepEqual(await C.ifgRememberLook(b2, 'mdi:leaf-bold'), { set: 'mdi', variant: null },
      '접미사를 못 받았는데 스타일을 적었다');
    assert.equal(b2.dataset.ifgIconVariant, undefined, '못 받았는데 variant 를 박았다');
    assert.equal(b2.dataset.ifgIconSet, 'mdi', '세트는 추측이 0 이라 적어야 한다');
  } finally { globalThis.fetch = realFetch; }
});
