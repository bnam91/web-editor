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
 *   D8 배선 — index.html 에 스크립트 1번(seeded-random 뒤 · sticker-block 모듈 앞) · 메뉴 「Coin」이 #fp-pen-menu 안, Marking(옛 Count Sticker) 바로 다음
 *   D9 색 표는 그리개 한 곳 — 금/은의 대표 색이 패널·블럭 파일에 글자로 없다
 *   D10 ★어떤 입력에도 안 던진다 — 객체 내장 이름 재질 · NaN·음수·아주 큰 수 · 빈 값 (손댄 저장본이 로드를 멈추지 않는다)
 *   D11 두께는 그리개가 가둔다(패널과 같은 표 LIMITS) · 방향·회전은 한 바퀴 안으로
 *   D12 각인 자르기 한 벌(cutGlyph) — 공백뿐 = 없음 · 그래핌 기준 · 그리개가 그 함수를 쓴다
 *   D13 ★번짐(1013t2C3) — 0 이면 글자가 한 자도 안 바뀐다(옛 저장본) · 켜면 세로로만 번지는 필터 하나(id = 접두+b) ·
 *        범위가 섹션 파티클 「번짐」(ParticlesFx.RANGES.blur)과 같은 수 · 범위 밖은 끝값 · 패널·블럭이 그 축을 잇는다
 *   D14 ★그림 상자(inkBox · 1013t2C2) — 정면은 지름 100 의 원 · 기울면 납작해지고 옆띠만큼 한쪽으로 늘어난다 · 상자 회전이 축을 바꾼다
 *   D15 ★한 닢 그리기(draw · 1013t2E3) — 자리·지름이 그대로 들어가고 svg 껍데기가 없다 · 색 한 칸 → 생김새(lookFromColor)
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
    ['DEFAULTS', 'GLYPH_MAX', 'LIMITS', 'PALETTES', 'angleFromSeed', 'baseColors', 'cutGlyph', 'draw', 'inkBox', 'inkFrac', 'lookFromColor', 'paletteFor', 'svg', 'toHex6'],
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
  assert.equal(C.toHex6('rgb(12.4, 0.6, 300)'), '#0c01ff', '소수·범위 밖 성분은 반올림·끝값');
  /* 못 읽는 것은 null — 반쪽 색(#NaN…)을 내지 않는다 */
  for (const bad of ['rgb(1.2.3,4,5)', 'rgb(.,.,.)', 'rgb(1,2)', 'rgb(1,2,3,4,5)', '#12', '#1234567', 'rgb(a,b,c)', '', '#ggg']) assert.equal(C.toHex6(bad), null, `toHex6(${bad})`);
  const nan = C.svg({ ...BASE, metal: 'custom', face: 'rgb(1.2.3,4,5)', side: 'rgb(.,.,.)' });
  assert.ok(!/NaN/.test(nan) && nan.includes('#f5c542'), '못 읽는 rgb() 가 #NaN 색으로 그림에 들어갔다');
  /* 객체 내장 이름은 재질이 아니다 — 표에 «제 열쇠로» 있는 것만 */
  for (const m of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf']) {
    assert.equal(C.svg({ ...BASE, metal: m }), gold, `재질 ${m} 이 금으로 안 떨어졌다`);
    assert.deepEqual({ ...C.baseColors(m) }, { face: '#f5c542', side: '#c98a14' }, `baseColors(${m})`);
    assert.equal(C.paletteFor({ metal: m }), C.PALETTES.gold);
  }
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

test('D7 class 속성 0 · filter 0(번짐을 안 켠 코인 — 켠 것은 D13)', () => {
  const { C } = load();
  for (const o of [BASE, { ...BASE, metal: 'custom', face: '#123456', side: '#654321', tilt: 80, glyph: '' }]) {
    const s = C.svg(o);
    assert.ok(!/\sclass=/.test(s), '그림이 class 속성을 냈다 — 배송본 CSS 쓸기 규칙에 걸릴 수 있다');
    assert.ok(!/<filter|filter=|<fe[A-Z]/.test(s), '그림이 SVG filter 를 쓴다 — html2canvas 길에서 따로 재야 한다');
    assert.ok(!/<foreignObject|<image|<script|\son[a-z]+=/.test(s));
  }
});

test('D8 배선 — 스크립트 1번(순서) · 메뉴 「Coin」이 스티커 패널 안, Marking(옛 Count Sticker) 바로 다음', () => {
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
  assert.equal(items[i - 1].label, 'Marking', '「Coin」은 Marking(마킹 블럭 · 옛 Count Sticker) 바로 다음이다');
  assert.equal(items[i].on, "addStickerBlock({shape:'coin'});toggleFpDropdown('fp-pen-dropdown')");
  assert.match(items[i].title, /^코인 스티커 — /, 'title 문체가 이웃(「마킹 블럭 — …」)과 다르다');
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

test('D10 ★어떤 입력에도 안 던진다 — 손댄 저장본의 값들', () => {
  const { C } = load();
  const weird = [undefined, null, '', 'abc', NaN, Infinity, -Infinity, -50, 1e9, '1e9', '-1e300', {}, [], true, () => 1, Symbol.iterator.toString()];
  let n = 0;
  for (const key of ['tilt', 'dir', 'k', 'gloss', 'glyph', 'metal', 'face', 'side', 'extRot', 'idPrefix']) {
    for (const v of weird) {
      let s;
      assert.doesNotThrow(() => { s = C.svg({ ...BASE, metal: key === 'face' || key === 'side' ? 'custom' : BASE.metal, [key]: v }); }, `svg({ ${key}: ${String(v)} }) 가 던졌다`);
      assert.ok(s.startsWith('<svg ') && s.endsWith('</svg>'));
      /* id 접두는 글자라 'NaN' 같은 낱말이 그대로 id 가 된다(정상) — 수가 새는지는 나머지 축에서만 본다 */
      if (key !== 'idPrefix') assert.ok(!/NaN|undefined|Infinity/.test(s), `svg({ ${key}: ${String(v)} }) 의 그림에 NaN·undefined 가 샜다`);
      assert.equal(idsOf(s).length, 8, `svg({ ${key}: ${String(v)} }) 의 그림 구조가 깨졌다`);
      n++;
    }
  }
  assert.equal(n, 160, '★전제: 조합을 다 돌았다');
  assert.doesNotThrow(() => C.svg({}), '빈 객체');
  for (const v of weird) assert.doesNotThrow(() => C.angleFromSeed(v), `angleFromSeed(${String(v)})`);
  for (const v of [NaN, -5, 1e20, 'abc', null]) { const [t, d] = C.angleFromSeed(v); assert.ok(t >= 0 && t <= 80 && d >= -180 && d <= 180, `angleFromSeed(${String(v)}) 범위`); }
});

test('D11 ★두께는 그리개가 가둔다(LIMITS) · 방향·회전은 한 바퀴 안으로', () => {
  const { C } = load();
  assert.deepEqual(JSON.parse(JSON.stringify(C.LIMITS)), { k: [8, 40], gloss: [0, 100], blur: [0, 14] });
  assert.ok(Object.isFrozen(C.LIMITS) && Object.isFrozen(C.LIMITS.k));
  const vb = (s) => /viewBox="([^"]+)"/.exec(s)[1];
  const lo = C.svg({ ...BASE, k: 0.08 }), hi = C.svg({ ...BASE, k: 0.4 });
  assert.equal(vb(lo), '-58 -58 116 116'); assert.equal(vb(hi), '-90 -90 180 180');
  for (const k of [-0.5, 0, -1e9, 0.0799]) assert.equal(C.svg({ ...BASE, k }), lo, `두께 ${k} 가 아래 끝(8%)으로 안 가둬졌다 — viewBox 가 0 이면 코인이 안 보인다`);
  for (const k of [0.41, 1, 1e7, 1e300]) assert.equal(C.svg({ ...BASE, k }), hi, `두께 ${k} 가 위 끝(40%)으로 안 가둬졌다`);
  assert.equal(C.svg({ ...BASE, gloss: 1e9 }), C.svg({ ...BASE, gloss: 100 }));
  assert.equal(C.svg({ ...BASE, gloss: -3 }), C.svg({ ...BASE, gloss: 0 }));
  assert.equal(C.svg({ ...BASE, tilt: 1e9 }), C.svg({ ...BASE, tilt: 88 }));
  assert.equal(C.svg({ ...BASE, tilt: -10 }), C.svg({ ...BASE, tilt: 0 }));
  assert.equal(C.svg({ ...BASE, dir: 25 + 360 * 1000 }), C.svg(BASE), '방향은 한 바퀴를 접는다');
  assert.equal(C.svg({ ...BASE, extRot: 360 * 7 }), C.svg(BASE));
  assert.ok(C.svg({ ...BASE, dir: 1e15 }).length < C.svg(BASE).length + 200, '아주 큰 방향 값이 그림 문자열을 부풀렸다');
});

test('D12 ★각인 자르기 한 벌(cutGlyph) — 공백뿐 = 없음 · 그래핌 기준', () => {
  const { C } = load();
  assert.equal(typeof Intl?.Segmenter, 'function', '★전제: 이 런타임에 Intl.Segmenter 가 있다(그래핌 갈래를 잰다)');
  assert.equal(C.cutGlyph('ABC'), 'AB'); assert.equal(C.cutGlyph('₩'), '₩'); assert.equal(C.cutGlyph(7), '7');
  assert.equal(C.cutGlyph(''), ''); assert.equal(C.cutGlyph(null), ''); assert.equal(C.cutGlyph(undefined), '');
  for (const blank of [' ', '   ', '\t', '\u3000', ' \n ']) assert.equal(C.cutGlyph(blank), '', `공백뿐(${JSON.stringify(blank)})은 각인 없음`);
  assert.equal(C.cutGlyph('a b'), 'a ', '글자 사이 공백은 글자다');
  const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
  assert.equal(C.cutGlyph(family + 'xy'), family + 'x', '이음표로 묶인 이모지는 한 글자 — 반쪽 내지 않는다');
  assert.equal(C.cutGlyph('e\u0301xy'), 'e\u0301x', '결합 부호는 앞 글자에 붙는다');
  assert.equal(C.cutGlyph('한글날'), '한글');
  /* 그리개가 그 함수를 쓴다 — 칸에 보이는 글자 = 그려지는 글자 */
  for (const g of [family + 'xy', 'e\u0301xy', ' ', 'ABC', '<b>']) {
    const want = C.cutGlyph(g);
    const drawn = [...new Set(textsOf(C.svg({ ...BASE, glyph: g })))];
    const esc = want.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    assert.deepEqual(drawn, want ? [esc] : [], `그림의 각인이 cutGlyph(${JSON.stringify(g)}) 와 다르다`);
  }
  /* 패널도 같은 함수를 쓴다(제 자르기를 따로 두지 않는다) */
  const look = readSrc(REPO, 'js/props/_coin-look.js');
  assert.ok(/fx\(\)\.cutGlyph\(/.test(look) && !/Array\.from\(/.test(look), '패널이 각인을 제 식으로 자른다 — CoinFx.cutGlyph 하나만');
  assert.ok(/LIMITS/.test(look) && !/\b(?:K_MIN|K_MAX)\s*=\s*\d/.test(look), '패널이 두께 범위를 제 숫자로 적었다 — CoinFx.LIMITS 하나만');
});

/* ── 1013t2 ─────────────────────────────────────────────────────────────── */

test('D13 ★번짐(1013t2C3) — 0 은 그림 그대로 · 켜면 세로 필터 하나 · 범위 = 파티클 「번짐」', () => {
  const { C } = load();
  const plain = C.svg(BASE);
  /* 0 · 없는 값 · 못 읽는 값 = 번짐 없음 ⇒ 글자가 한 자도 안 바뀐다(옛 저장본) */
  for (const blur of [0, undefined, null, '', NaN, 'x', -5]) assert.equal(C.svg({ ...BASE, blur }), plain, `blur=${String(blur)} 인데 그림이 달라졌다`);
  const on = C.svg({ ...BASE, blur: 6 });
  assert.notEqual(on, plain, '번짐 6 인데 그림이 그대로다');
  /* 필터는 하나, id 는 접두 + b, 감싸는 <g> 가 그 id 를 가리킨다 */
  assert.equal((on.match(/<filter\b/g) || []).length, 1);
  assert.ok(on.includes('<filter id="coin-stk_abc123b" filterUnits="userSpaceOnUse"'), '필터 id 가 접두+b 가 아니다');
  assert.ok(on.includes('<g filter="url(#coin-stk_abc123b)">'), '코인이 그 필터에 안 감싸였다');
  assert.deepEqual(idsOf(on).filter((x) => !x.startsWith('coin-stk_abc123')), [], 'id 가 접두 밖에서 났다');
  for (const r of refsOf(on)) assert.ok(idsOf(on).includes(r), `url(#${r}) 가 가리키는 정의가 없다`);
  /* 세로로만 — stdDeviation 의 첫 값(가로)이 0. 값 6 · 두께 22% → 6 × 144 ÷ 120 = 7.2 (기본 크기 상자에서 세로 6px) */
  assert.deepEqual((on.match(/stdDeviation="([^"]+)"/g) || []), ['stdDeviation="0 7.2"']);
  /* 필터 영역이 번지는 만큼 세로로 넓다(기본 영역이면 잘린다): pm = ceil(3×7.2)+8 = 30 → y = -72-30, height = 144+60 */
  assert.ok(on.includes('x="-72" y="-102" width="144" height="204"'), '필터 영역이 번짐을 못 담는다');
  /* 번짐을 벗기면 안쪽 그림은 번짐 없는 코인과 같다(번짐이 그림을 건드리지 않는다) */
  const inner = on.replace(/<defs><filter id="coin-stk_abc123b"[\s\S]*?<\/filter><\/defs><g filter="url\(#coin-stk_abc123b\)">/, '').replace('</g></svg>', '</svg>');
  assert.equal(inner, plain);
  /* 범위 밖은 끝값 */
  assert.equal(C.svg({ ...BASE, blur: 99 }), C.svg({ ...BASE, blur: 14 }));
  assert.notEqual(C.svg({ ...BASE, blur: 14 }), C.svg({ ...BASE, blur: 13 }));
  /* ★범위가 섹션 파티클의 「번짐」과 같은 수 — 두 표를 따로 싣고 견준다 */
  const pctx = {}; pctx.window = pctx; vm.createContext(pctx);
  vm.runInContext(readSrc(REPO, 'js/fx/seeded-random.js'), pctx);
  vm.runInContext(readSrc(REPO, 'js/fx/particles-render.js'), pctx);
  const R = pctx.ParticlesFx.RANGES.blur;
  assert.deepEqual([R.min, R.max], [0, 14], '★전제: 파티클 「번짐」의 범위');
  assert.deepEqual([...C.LIMITS.blur], [R.min, R.max], '코인 번짐의 범위가 파티클 「번짐」과 갈렸다');
  /* 배선 — 패널 칸 · 저장 키 · 그리기 인자 · 스타일 기억 (글자로 잇는 자리라 소스에서 본다) */
  const look = readSrc(REPO, 'js/props/_coin-look.js'), pan = readSrc(REPO, 'js/props/prop-sticker-coin.js'), blk = readSrc(REPO, 'js/blocks/sticker-block.js');
  assert.ok(/<span class="prop-label">번짐<\/span>\s*<input type="range" class="prop-slider" id="\$\{idp\}-blur"/.test(look), '패널에 번짐 행(라벨 + 슬라이더)이 없다');
  assert.ok(look.includes("limits('blur')") && look.includes("set({ blur: v })"), '번짐 칸이 범위 표·쓰기에 안 이어졌다');
  assert.ok(/blur: 'coinBlur'/.test(pan) && /blur: d\.coinBlur/.test(pan), '패널이 data-coin-blur 를 읽고 쓰지 않는다');
  assert.ok(/blur: n\(d\.coinBlur, 0\)/.test(blk), '그리기가 data-coin-blur 를 안 넘긴다');
  assert.ok(/'coinGloss', 'coinBlur'\]\.forEach/.test(blk), '스타일 기억에 번짐이 빠졌다');
});

test('D14 ★그림 상자(inkBox · 1013t2C2) — 정면 원 · 기울면 납작 + 옆띠 · 회전이 축을 바꾼다', () => {
  const { C } = load();
  const r2 = (b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v * 100) / 100 + 0]));
  /* 정면(기울기 0) — 지름 100 의 원, viewBox 반 변 m = 100 × (0.5 + 0.22) = 72 */
  assert.deepEqual(r2(C.inkBox({ tilt: 0, dir: 0, k: 0.22, rot: 0 })), { x0: -50, y0: -50, x1: 50, y1: 50, m: 72 });
  /* 기울기 60° — 세로 반지름 50×cos60 = 25, 옆띠 100×0.22×sin60 = 19.05 가 아래로 */
  assert.deepEqual(r2(C.inkBox({ tilt: 60, dir: 0, k: 0.22, rot: 0 })), { x0: -50, y0: -25, x1: 50, y1: 44.05, m: 72 });
  /* 상자를 90° 돌리면 가로·세로가 바뀐다(옆띠는 왼쪽으로) */
  assert.deepEqual(r2(C.inkBox({ tilt: 60, dir: 0, k: 0.22, rot: 90 })), { x0: -44.05, y0: -50, x1: 25, y1: 50, m: 72 });
  /* 방향(dir)은 반대로 돈다 — dir 90 = rot -90 */
  assert.deepEqual(r2(C.inkBox({ tilt: 60, dir: 90, k: 0.22, rot: 0 })), r2(C.inkBox({ tilt: 60, dir: 0, k: 0.22, rot: -90 })));
  /* 그림은 언제나 viewBox 안이다(상자 밖으로 안 나간다) · 쓰레기 입력에도 수를 낸다 */
  for (const o of [{ tilt: 88, dir: 37, k: 0.4, rot: 211 }, { tilt: 45, dir: -170, k: 0.08, rot: 33 }, {}, { tilt: 'x', dir: NaN, k: 1e9, rot: null }, null]) {
    const b = C.inkBox(o);
    for (const v of Object.values(b)) assert.ok(Number.isFinite(v), '수가 아니다');
    assert.ok(b.x0 >= -b.m && b.y0 >= -b.m && b.x1 <= b.m && b.y1 <= b.m && b.x0 < b.x1 && b.y0 < b.y1, JSON.stringify(b));
  }
});

test('D15 ★한 닢 그리기(draw · 1013t2E3) — 자리·지름 · svg 껍데기 없음 · 색 한 칸 → 생김새', () => {
  const { C, calls } = load();
  const g = C.draw({ idPrefix: 'pfx-s-c3', x: 120.5, y: 40, d: 250, tilt: 30, dir: 0, extRot: 15, metal: 'gold' });
  assert.ok(g.startsWith('<g transform="translate(120.5 40)"><g transform="rotate(0)">') && g.endsWith('</g></g>'));
  assert.ok(!/<svg|viewBox/.test(g), '한 닢 그리기에 svg 껍데기가 붙었다');
  assert.ok(g.includes('<ellipse rx="125" ry="108.25" fill="url(#pfx-s-c3f)"/>'), '지름 250 이 앞면 타원에 안 들어갔다');
  assert.ok(g.includes(C.PALETTES.gold.face[1]));
  assert.deepEqual(idsOf(g).filter((x) => !x.startsWith('pfx-s-c3')), []);
  assert.equal(C.draw({ idPrefix: 'a', x: 1, y: 2, d: 30 }), C.draw({ idPrefix: 'a', x: 1, y: 2, d: 30 }));
  for (const o of [null, {}, { d: -5, x: 'q', k: 1e9 }]) assert.equal(typeof C.draw(o), 'string');
  assert.equal(calls.random, 0);
  /* 색 한 칸 → 생김새 */
  assert.deepEqual({ ...C.lookFromColor('#F5C542') }, { metal: 'gold' }, '금 대표색인데 금 표로 안 간다');
  assert.deepEqual({ ...C.lookFromColor(C.baseColors('silver').face) }, { metal: 'silver' });
  assert.deepEqual({ ...C.lookFromColor('#2D6FE8') }, { metal: 'custom', face: '#2d6fe8', side: '#204ea2' });
  for (const bad of ['', 'red', null, undefined, 12, '#12']) assert.deepEqual({ ...C.lookFromColor(bad) }, { metal: 'gold' }, `못 읽는 색 ${String(bad)}`);
});

test('D16 ★그림 면적 비(inkFrac · 1013t2C2) — 통째 = 1 · 반 = 0.5 · 귀퉁이 10%×10% 에는 그림이 없다 · 회전해도 같은 면적', () => {
  const { C, calls } = load();
  const face = { tilt: 0, dir: 0, k: 0.22, rot: 0 };                       // 정면 = 반지름 50 의 원
  const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} (기대 ${b} ± ${tol})`);
  assert.equal(C.inkFrac(face, { x0: -72, y0: -72, x1: 72, y1: 72 }), 1);
  assert.equal(C.inkFrac(face, {}), 1, '사각형을 안 주면 전부 안이다');
  assert.equal(C.inkFrac(face, { x0: 60, y0: -72, x1: 200, y1: 72 }), 0, '그림 밖의 사각형');
  near(C.inkFrac(face, { x0: 0, y0: -72, x1: 72, y1: 72 }), 0.5, 0.01, '오른쪽 반');
  near(C.inkFrac(face, { x0: 0, y0: 0, x1: 72, y1: 72 }), 0.25, 0.01, '오른쪽 아래 사분면');
  /* 원에서 가장자리로부터 폭의 10%(= 10) 만큼의 띠는 면적으로 약 5.2% 다 — 「폭의 10%」와 「면적의 10%」는 다른 자다 */
  near(C.inkFrac(face, { x0: 40, y0: -72, x1: 72, y1: 72 }), 0.052, 0.006, '폭 10% 띠의 면적');
  /* ★그림 상자의 귀퉁이 10%×10% 에는 그림이 없다 — 가로·세로를 따로 10% 씩 남기면 코인이 통째로 사라지는 까닭 */
  assert.equal(C.inkFrac(face, { x0: 40, y0: 40, x1: 72, y1: 72 }), 0);
  /* 기울인 코인 — 반으로 가르면(가로 대칭) 0.5 · 상자를 90° 돌리면 그 반이 위아래로 간다 */
  const tilted = { tilt: 60, dir: 0, k: 0.22, rot: 0 };
  near(C.inkFrac(tilted, { x0: 0, y0: -72, x1: 72, y1: 72 }), 0.5, 0.01, '기울인 코인의 오른쪽 반');
  near(C.inkFrac({ ...tilted, rot: 90 }, { x0: -72, y0: 0, x1: 72, y1: 72 }), 0.5, 0.01, '90° 돌린 코인의 아래쪽 반');
  near(C.inkFrac({ ...tilted, rot: 90 }, { x0: 0, y0: -72, x1: 72, y1: 72 }), C.inkFrac(tilted, { x0: -72, y0: -72, x1: 72, y1: 0 }), 0.01, '돌린 코인의 오른쪽 = 안 돌린 코인의 위쪽');
  /* 그림 상자(inkBox)와 맞물린다 — 그 상자로 자르면 전부 안, 한 변을 반으로 줄이면 줄어든다 */
  for (const o of [tilted, { tilt: 80, dir: 37, k: 0.4, rot: 211 }, { tilt: 45, dir: -170, k: 0.08, rot: 33 }]) {
    const b = C.inkBox(o);
    near(C.inkFrac(o, { x0: b.x0 - 0.01, y0: b.y0 - 0.01, x1: b.x1 + 0.01, y1: b.y1 + 0.01 }), 1, 1e-9, '그림 상자 안 = 전부');
    assert.ok(C.inkFrac(o, { x0: b.x0, y0: b.y0, x1: (b.x0 + b.x1) / 2, y1: b.y1 }) < 0.75);
  }
  /* 결정성 · 쓰레기 입력 */
  assert.equal(C.inkFrac(tilted, { x0: 3, y0: -9, x1: 40, y1: 30 }), C.inkFrac(tilted, { x0: 3, y0: -9, x1: 40, y1: 30 }));
  for (const [o, r] of [[null, null], [{}, {}], [{ tilt: 'x', k: 1e9 }, { x0: NaN, y1: 'q' }]]) { const v = C.inkFrac(o, r); assert.ok(v >= 0 && v <= 1); }
  assert.equal(calls.random, 0);
});
