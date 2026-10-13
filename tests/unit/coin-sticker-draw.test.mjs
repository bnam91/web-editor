/* coin-sticker-draw — 코인 스티커의 그리개(js/fx/coin-draw.js · window.CoinFx)와 메뉴·스크립트 배선.
 *
 * ★무엇을 잠그나
 *   D0 전제 — DOM 없이 실리고 계약한 이름만 낸다(스티커가 안 쓰는 API 가 붙어 있지 않다)
 *   D1 결정성 — 같은 입력 = 같은 문자열 · Math.random 을 한 번도 안 부른다(리로드·undo·내보내기가 매번 다시 그린다)
 *   D2 id — gradient·clipPath id 가 «접두에서만» 나오고, 정의한 id 와 url(#…) 참조가 서로 빠짐없이 맞는다 ·
 *        접두가 다르면 id 가 하나도 안 겹친다(복제본이 원본의 gradient 를 가리키지 않는다) · 접두의 위험 글자는 벗긴다
 *   D3 각인 — & < > " 이스케이프 · «글자» 기준 2자 자르기 · '' = 각인 없음 · 안 주면 기본 $
 *   D4 무늬번호 → 각도 — 범위(기울기 0~80 · 방향 -180~180) · 같은 번호 = 같은 각도 · 기대값은 글자로
 *   D5 재질 — 금/은이 표의 색을 쓰고 서로 다르다 · 커스텀은 준 두 색에서 나온다 · 못 읽는 색/모르는 재질은 금
 *   D6 그림 축 — 두께·광택·기울기·방향·바깥 회전(빛 보정)이 각각 그림을 바꾼다 · viewBox 는 각도와 무관하게 고정
 *   D7 class 속성 0 · filter 0(배송본 쓸기·html2canvas 가 못 그리는 것에 기대지 않는다)
 *   D8 배선 — index.html 에 스크립트 1번(seeded-random 뒤 · sticker-block 모듈 앞) · 메뉴 「Coin」이 #fp-pen-menu 안, Count Sticker 바로 다음
 *   D9 색 표는 그리개 한 곳 — 금/은의 대표 색이 패널·블럭 파일에 글자로 없다
 * ★기대값은 «글자로» 박았다(피검 함수에서 뽑으면 항등식이다).
 * ⛔앱 0 · 네트워크 0. 두 파일 다 최상위에서 DOM 을 안 건드리므로 vm 으로 그대로 싣는다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');
const DRAW = 'js/fx/coin-draw.js';

/* Math.random 을 «세는» 판으로 싣는다 — 그리개가 한 번이라도 부르면 D1 이 본다. */
function load() {
  const calls = { random: 0 };
  const M = Object.create(Math);
  M.random = () => { calls.random++; return 0.5; };
  const ctx = { Math: M, console: { error() {} } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(readSrc(REPO, 'js/fx/seeded-random.js'), ctx);
  vm.runInContext(readSrc(REPO, DRAW), ctx);
  return { C: ctx.CoinFx, calls };
}
const BASE = { idPrefix: 'coin-stk_abc123', tilt: 40, dir: 25, k: 0.22, gloss: 22, glyph: '$', metal: 'gold', extRot: 0 };
const idsOf = (s) => [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const refsOf = (s) => [...s.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
const textsOf = (s) => [...s.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

test('D0 전제 — DOM 없이 실리고, 계약한 이름만 낸다', () => {
  const { C } = load();
  assert.equal(typeof C?.svg, 'function');
  assert.deepEqual(Object.keys(C).sort(),
    ['DEFAULTS', 'GLYPH_MAX', 'PALETTES', 'angleFromSeed', 'baseColors', 'paletteFor', 'svg', 'toHex6'],
    '★스티커가 안 쓰는 API 가 붙었거나 계약한 것이 빠졌다 — 머리말의 계약과 같이 고쳐라');
  assert.deepEqual({ ...C.DEFAULTS }, { metal: 'gold', glyph: '$', k: 22, gloss: 22, size: 120 });
  assert.equal(C.GLYPH_MAX, 2);
  assert.ok(Object.isFrozen(C) && Object.isFrozen(C.PALETTES) && Object.isFrozen(C.PALETTES.gold));
});

test('D1 ★결정성 — 같은 입력 = 같은 문자열, Math.random 호출 0', () => {
  const { C, calls } = load();
  const a = C.svg(BASE), b = C.svg({ ...BASE });
  assert.ok(a.startsWith('<svg ') && a.endsWith('</svg>') && a.length > 1500, '★전제: 그림이 나왔다');
  assert.equal(b, a, '같은 입력인데 문자열이 다르다 — 그림 안에 카운터·난수가 섞였다');
  for (let seed = 0; seed < 50; seed++) C.angleFromSeed(seed);
  C.svg({ ...BASE, metal: 'custom', face: '#3366ff', side: '#112244' });
  assert.equal(calls.random, 0, '그리개가 Math.random 을 불렀다 — 리로드·undo 마다 그림이 달라진다');
  const src = readSrc(REPO, DRAW).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/Math\.random|Date\.now|performance\.now/.test(src), '그리개 소스에 난수·시계가 있다');
  assert.ok(!/NaN|undefined|Infinity/.test(a), '그림에 NaN·undefined 가 샜다');
  assert.ok(!/-0[\s"]/.test(a.replace(/-0\.\d/g, '')), '그림에 -0 이 샜다(기계마다 문자열이 갈린다)');
});

test('D2 ★id — 접두에서만 나오고, 정의와 참조가 맞물리고, 접두가 다르면 하나도 안 겹친다', () => {
  const { C } = load();
  const a = C.svg(BASE);
  const ids = idsOf(a), refs = refsOf(a);
  assert.deepEqual([...ids].sort(), ['cf', 'ch', 'd', 'f', 'g', 'h', 'i', 's'].map((x) => 'coin-stk_abc123' + x).sort(),
    'id 목록이 계약(접두 + s·f·d·h·i·g·cf·ch)과 다르다');
  assert.equal(new Set(ids).size, ids.length, '한 그림 안에서 id 가 겹친다');
  assert.deepEqual([...new Set(refs)].sort(), [...ids].sort(), '정의만 있고 안 쓰는 id, 또는 정의 없는 참조가 있다');
  const b = C.svg({ ...BASE, idPrefix: 'coin-stk_zzz999' });
  assert.deepEqual(idsOf(b).filter((x) => ids.includes(x)), [], '접두가 다른데 id 가 겹친다 — 복제본이 원본의 gradient 를 가리킨다');
  assert.equal(b.split('coin-stk_zzz999').join('coin-stk_abc123'), a, '접두는 id 말고 그림을 바꾸면 안 된다');
  const c = C.svg({ ...BASE, idPrefix: 'x"><script>y z#' });
  for (const id of idsOf(c)) assert.match(id, /^xscriptyz(?:s|f|d|h|i|g|cf|ch)$/, `접두의 위험 글자가 id 에 남았다: ${id}`);
  assert.ok(!c.includes('<script>'));
  assert.ok(idsOf(C.svg({ ...BASE, idPrefix: '' })).every((x) => x.startsWith('coin')), '빈 접두는 coin 으로 떨어진다');
});

test('D3 ★각인 — 이스케이프 · 글자 기준 2자 자르기 · 빈 값 = 없음', () => {
  const { C } = load();
  const glyphs = (g) => [...new Set(textsOf(C.svg({ ...BASE, glyph: g })))];
  assert.deepEqual(glyphs('$'), ['$']);
  assert.deepEqual(glyphs('<&'), ['&lt;&amp;'], '꺾쇠·앰퍼샌드가 그대로 마크업에 들어갔다');
  assert.deepEqual(glyphs('">'), ['&quot;&gt;']);
  assert.deepEqual(glyphs('ABC'), ['AB'], '2자로 안 잘랐다');
  assert.deepEqual(glyphs('₩₩₩'), ['₩₩']);
  assert.deepEqual(glyphs('😀😀😀'), ['😀😀'], '코드 단위로 잘랐다 — 이모지가 반쪽 난다');
  assert.deepEqual(glyphs('<b>x'), ['&lt;b'], '자르기는 이스케이프 «앞»이어야 한다(실체참조가 반쪽 나면 안 된다)');
  assert.deepEqual(glyphs(''), [], "'' 인데 글자가 그려졌다");
  assert.deepEqual(glyphs(undefined), ['$'], '안 주면 기본 각인');
  assert.deepEqual(glyphs(7), ['7'], '숫자도 글자로');
  assert.ok(!/<text[^>]*>[^<]*<(?!\/text>)/.test(C.svg({ ...BASE, glyph: '<i' })), '<text> 안에 다른 태그가 열렸다');
});

test('D4 ★무늬번호 → 각도 — 범위 · 같은 번호 = 같은 각도 · 기대값은 글자', () => {
  const { C } = load();
  /* mulberry32 수열에서 뽑은 값(js/fx/seeded-random.js — tests/unit/fx-seeded-random.test.mjs 가 그 수열을 잠근다). */
  assert.deepEqual([...C.angleFromSeed(201)], [...C.angleFromSeed(201)]);
  const seen = new Set();
  for (const seed of [0, 1, 2, 7, 199, 201, 225, 12345, 99991, 2147483648, 4294967295]) {
    const [tilt, dir] = C.angleFromSeed(seed);
    assert.ok(Number.isInteger(tilt) && tilt >= 0 && tilt <= 80, `seed ${seed}: 기울기 ${tilt} 가 0~80 밖`);
    assert.ok(Number.isInteger(dir) && dir >= -180 && dir <= 180, `seed ${seed}: 방향 ${dir} 가 -180~180 밖`);
    seen.add(tilt + '/' + dir);
  }
  assert.ok(seen.size >= 9, `번호가 달라도 각도가 거의 같다(${seen.size}/11) — 번호가 각도에 안 닿는다`);
  let lo = 80, hi = 0;
  for (let s = 1; s <= 400; s++) { const [t] = C.angleFromSeed(s); lo = Math.min(lo, t); hi = Math.max(hi, t); }
  assert.ok(lo <= 5 && hi >= 75, `기울기가 범위를 고루 안 쓴다(${lo}~${hi})`);
  assert.deepEqual([...C.angleFromSeed(4294967296 + 201)], [...C.angleFromSeed(201)], 'uint32 로 접는다');
});

test('D5 ★재질 — 금/은은 표의 색 · 커스텀은 준 색 · 못 읽으면 금', () => {
  const { C } = load();
  const gold = C.svg(BASE), silver = C.svg({ ...BASE, metal: 'silver' });
  assert.ok(gold.includes('#F5C542') && !gold.includes('#D3D9E2'), '금 코인에 금 앞면 색이 없다(또는 은 색이 섞였다)');
  assert.ok(silver.includes('#D3D9E2') && !silver.includes('#F5C542'), '은 코인에 은 앞면 색이 없다(또는 금 색이 섞였다)');
  const custom = C.svg({ ...BASE, metal: 'custom', face: '#3366FF', side: 'rgb(17, 34, 68)' });
  assert.ok(custom.includes('#3366ff'), '커스텀 앞면 색이 그림에 없다');
  /* 옆면 색은 빛에 따라 밝게/어둡게 섞여 들어가 글자 그대로는 안 남는다 — 표기만 다른 같은 색이 같은 그림인지로 잰다 */
  assert.equal(custom, C.svg({ ...BASE, metal: 'custom', face: '#36f', side: '#112244ff' }), '같은 색의 다른 표기(rgb() · #rgb · #rrggbbaa)가 다른 그림을 냈다');
  assert.ok(!custom.includes('#F5C542'), '커스텀인데 금 색이 남았다');
  assert.notEqual(C.svg({ ...BASE, metal: 'custom', face: '#3366ff', side: '#112244' }),
    C.svg({ ...BASE, metal: 'custom', face: '#3366ff', side: '#884422' }), '옆면 색이 그림에 안 닿는다');
  assert.equal(C.svg({ ...BASE, metal: 'gold', face: '#3366ff', side: '#112244' }), gold, '금인데 커스텀 색을 읽었다');
  assert.equal(C.svg({ ...BASE, metal: 'platinum' }), gold, '모르는 재질은 금으로 떨어진다');
  const bad = C.svg({ ...BASE, metal: 'custom', face: 'url(javascript:1)', side: '"><x' });
  assert.ok(!/javascript|<x/.test(bad), '못 읽는 색 글자가 마크업에 그대로 들어갔다');
  assert.ok(bad.includes('#f5c542'), '못 읽는 커스텀 색은 금 대표색으로 떨어진다');
  assert.equal(C.toHex6('#abc'), '#aabbcc'); assert.equal(C.toHex6('#A1B2C3D4'), '#a1b2c3');
  assert.equal(C.toHex6('rgba(255, 0, 10, 0.5)'), '#ff000a'); assert.equal(C.toHex6('red'), null); assert.equal(C.toHex6(null), null);
  assert.deepEqual({ ...C.baseColors('gold') }, { face: '#f5c542', side: '#c98a14' });
  assert.deepEqual({ ...C.baseColors('silver') }, { face: '#d3d9e2', side: '#8e97a4' });
});

test('D6 ★그림 축 — 두께·광택·기울기·방향·바깥 회전이 각각 그림을 바꾸고, viewBox 는 각도와 무관하다', () => {
  const { C } = load();
  const base = C.svg(BASE);
  const vb = (s) => /viewBox="([^"]+)"/.exec(s)[1];
  for (const [axis, patch] of [['기울기', { tilt: 70 }], ['방향', { dir: -120 }], ['두께', { k: 0.4 }], ['광택', { gloss: 80 }], ['바깥 회전(빛 보정)', { extRot: 90 }]]) {
    assert.notEqual(C.svg({ ...BASE, ...patch }), base, `${axis}를 바꿨는데 그림이 그대로다`);
  }
  assert.equal(vb(base), '-72 -72 144 144', 'viewBox = ±100·(0.5+k) — k 0.22');
  assert.equal(vb(C.svg({ ...BASE, tilt: 0, dir: 170 })), vb(base), '각도가 viewBox 를 바꿨다 — 다시뽑기에 코인 크기가 출렁인다');
  assert.equal(vb(C.svg({ ...BASE, k: 0.4 })), '-90 -90 180 180');
  /* 바깥 회전은 «빛»만 고친다 — 코인을 돌리는 바깥 <g rotate> 는 dir 에서만 나온다 */
  const rot = (s) => /<g transform="rotate\(([^)]+)\)">/.exec(s)[1];
  assert.equal(rot(base), '-25');
  assert.equal(rot(C.svg({ ...BASE, extRot: 90 })), '-25', '바깥 회전이 그림을 한 번 더 돌렸다(상자의 CSS 회전과 겹친다)');
  assert.ok(!/opacity="0\.8"/.test(base) && /opacity="0\.22"/.test(base), '광택 22 = 띠 불투명도 0.22');
  assert.ok(!/fill="url\(#coin-stk_abc123g\)"/.test(C.svg({ ...BASE, gloss: 0 })), '광택 0 인데 광택 띠가 그려졌다');
  assert.ok(/preserveAspectRatio="xMidYMid meet"/.test(base) && /width="100%" height="100%"/.test(base));
  assert.ok(/pointer-events:none/.test(base), '그림이 마우스를 먹으면 스티커 끌기가 안 된다');
});

test('D7 class 속성 0 · filter 0', () => {
  const { C } = load();
  for (const o of [BASE, { ...BASE, metal: 'custom', face: '#123456', side: '#654321', tilt: 80, glyph: '' }]) {
    const s = C.svg(o);
    assert.ok(!/\sclass=/.test(s), '그림이 class 속성을 냈다 — 배송본 CSS 쓸기 규칙에 걸릴 수 있다');
    assert.ok(!/<filter|filter=|<fe[A-Z]/.test(s), '그림이 SVG filter 를 쓴다 — html2canvas 길에서 따로 재야 한다');
    assert.ok(!/<foreignObject|<image|<script|\son[a-z]+=/.test(s));
  }
});

test('D8 배선 — 스크립트 1번(순서) · 메뉴 「Coin」이 스티커 패널 안, Count Sticker 바로 다음', () => {
  const html = readSrc(REPO, 'index.html');
  const tags = html.match(/<script[^>]*src="js\/fx\/coin-draw\.js"[^>]*>/g) || [];
  assert.equal(tags.length, 1, 'coin-draw.js script 태그 수');
  assert.ok(!/type="module"/.test(tags[0]), '고전 스크립트여야 한다(모듈보다 먼저 실행)');
  const at = html.indexOf(tags[0]);
  assert.ok(html.indexOf('src="js/fx/seeded-random.js"') < at && html.indexOf('src="js/fx/seeded-random.js"') > 0, 'seeded-random.js 뒤여야 한다(FxSeed)');
  assert.ok(at < html.indexOf('src="js/blocks/sticker-block.js"'), 'sticker-block.js 앞이어야 한다');
  const m0 = html.indexOf('id="fp-pen-menu"');
  assert.ok(m0 > 0, '★전제: #fp-pen-menu 가 있다');
  const menu = html.slice(m0, html.indexOf('id="fp-component-menu"') > m0 ? html.indexOf('id="fp-component-menu"') : m0 + 12000).replace(/<!--[\s\S]*?-->/g, '');
  const items = [...menu.matchAll(/<button class="fp-menu-item" onclick="([^"]*)" title="([^"]*)">([^<]*)<\/button>/g)].map((m) => ({ on: m[1], title: m[2], label: m[3] }));
  const i = items.findIndex((x) => x.label === 'Coin');
  assert.ok(i > 0, '「Coin」 항목이 #fp-pen-menu 에 없다(또는 class·title 꼴이 이웃과 다르다)');
  assert.equal(items.filter((x) => x.label === 'Coin').length, 1);
  assert.equal(items[i - 1].label, 'Count Sticker', '「Coin」은 Count Sticker 바로 다음이다');
  assert.equal(items[i].on, "addStickerBlock({shape:'coin'});toggleFpDropdown('fp-pen-dropdown')");
  assert.match(items[i].title, /^코인 스티커 — /, 'title 문체가 이웃(「카운트 스티커 — …」)과 다르다');
  assert.ok(!/프로토|proto/i.test(items[i].title + items[i].label));
});

test('D9 금/은 색은 그리개 한 곳 — 패널·블럭 파일에 글자로 없다', () => {
  const { C } = load();
  const colors = [...new Set(Object.values(C.PALETTES).flatMap((P) => Object.values(P).flat()))];
  assert.ok(colors.length >= 30, '★전제: 표에서 색을 뽑았다');
  for (const f of ['js/props/_coin-look.js', 'js/props/prop-sticker-coin.js', 'js/blocks/sticker-block.js', 'js/props/prop-sticker.js']) {
    const src = readSrc(REPO, f).toLowerCase();
    const hit = colors.filter((c) => c.toLowerCase() !== '#ffffff' && src.includes(c.toLowerCase()));
    assert.deepEqual(hit, [], `${f} 에 코인 색이 글자로 적혀 있다 — CoinFx.PALETTES 한 곳에만`);
  }
});
