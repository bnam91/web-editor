/* U-SELOV-S — 선택 오버레이의 «범위»가 CSS 중화 범위와 «같은가».
 *   실행: node --test "tests/unit/*.test.mjs"  ·  소스만 읽는다(라이브 무접촉).
 *
 * ★이 검사가 막는 사고 = «선택 표시가 사라지는 것».
 *   P0 는 양립 구조다 — 문서 CSS 는 그대로 두고 `body.sel-ov` 아래에서 «색만» 투명으로 돌린다.
 *   ⇒ 중화가 오버레이보다 «넓으면» 그 블록은 선도 오버레이도 없이 «표시가 없어진다».
 *      중화가 오버레이보다 «좁으면» 옛 선과 새 선이 «둘 다» 그려진다(2겹).
 *   두 범위가 어긋나는 순간을 여기서 빨강으로 잡는다.
 *
 * ★그리고 「블록 이름 목록을 만들지 않았는가」를 «기계로» 고정한다.
 *   이 저장소는 오늘 하루에 「목록이 썩는 병」을 세 번 냈다(텍스트프레임 래퍼 · .cvb-card-ph ·
 *   z-index 17종). 같은 구조를 다시 만들면 여기서 걸린다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const decomment = s => s.replace(/\/\*[\s\S]*?\*\//g, '');

const JS = rd('js/selection-overlay.js');
const JS_CODE = decomment(JS).replace(/^\s*\/\/.*$/gm, '');
const CANVAS_CSS_FILES = ['css/editor-blocks.css', 'css/editor-layout.css',
                          'css/editor-canvas.css', 'css/editor-extra.css', 'css/editor-graph.css'];
const CSS = decomment(CANVAS_CSS_FILES.map(rd).join('\n'));

/** 중화 절의 «본체 셀렉터»(.selected:not(...)...) 한 줄. */
const NEUTRAL = CSS.match(/body\.sel-ov #canvas \.selected(:not\([^)]*\))+/);
const NOTS = NEUTRAL ? [...NEUTRAL[0].matchAll(/:not\(\.([a-z0-9-]+)\)/g)].map(m => m[1]) : [];

test('★중화 절이 «실재한다»(이 파일이 빈 문자열을 검사하고 있지 않다)', () => {
  assert.ok(NEUTRAL, 'body.sel-ov #canvas .selected:not(...) 절을 못 찾았다 — 중화가 없으면 선이 2겹이 된다');
  assert.ok(NOTS.length >= 4, `:not() 이 ${NOTS.length}개 — 너무 적다. 전제가 바뀌었으면 이 검사도 같이 옮겨라`);
  assert.ok(/\.ss-sel-layer\s*,\s*\.ss-sel-layer \*\s*\{[^}]*pointer-events:\s*none/.test(CSS),
    '★위험13 — SVG 층과 «모든 자손»의 pointer-events 를 끄지 않으면 path 가 캔버스 클릭을 먹는다');
});

test('★범위 동치 — 오버레이가 «안 그리는» 대상은 중화에서도 «빠져» 있다', () => {
  // JS 의 단일 원본: export const SKIP_SELECTOR = '.section-block, .col';
  const m = JS_CODE.match(/SKIP_SELECTOR\s*=\s*'([^']+)'/);
  assert.ok(m, 'SKIP_SELECTOR 를 못 찾았다 — 이름이 바뀌었으면 이 검사도 같이 옮겨라');
  const skip = m[1].split(',').map(s => s.trim().replace(/^\./, ''));
  for (const cls of skip) {
    assert.ok(NOTS.includes(cls),
      `«${cls}» 는 오버레이가 안 그리는데 CSS 중화는 지운다 ⇒ 선택해도 «아무 표시가 없다»`);
  }
});

test('★상태 동거 — 선택과 «동시에» 걸리는 다른 표시를 중화가 삼키지 않는가', () => {
  /* 캔버스 CSS 에서 `.무엇.상태 { outline: … }` 형태를 «전부» 긁어, 그 상태가
   * .selected 와 «같은 요소»에 붙을 수 있으면 중화 :not() 에 있어야 한다.
   * ⇒ 새 상태 표시가 생기면 여기서 빨강이 되고, 「삼킬지/남길지」를 사람이 정하게 된다. */
  const found = new Set();
  for (const m of CSS.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const ow = m[2].match(/outline\s*:\s*([^;]+)/);
    if (!ow || /none|transparent/.test(ow[1])) continue;
    for (const sel of m[1].split(',')) {
      for (const mm of sel.trim().matchAll(/\.([a-z0-9-]+)\.([a-z][a-z0-9-]*)/g)) {
        if (mm[2] === 'selected') continue;
        // «.selected 를 받는 요소»인가 — 블록/행/오버레이 텍스트만 본다.
        if (!/(-block|^row$|^overlay-tb$)/.test(mm[1])) continue;
        found.add(mm[2]);
      }
    }
  }
  /* 구조적으로 .selected 와 같은 요소에 «못» 붙는 것 — 여기 적는 것은 «판단»이지 면제가 아니다. */
  const IMPOSSIBLE = {
    'group-selected': '.group-block 은 group-selected 를 «대신» 받는다(selected 와 같이 안 붙는다)',
    'row-active':     '.row.row-active 는 활성 행 표시 — .row 는 오버레이 대상이지만 selected 를 안 받는다',
  };
  const missing = [...found].filter(s => !NOTS.includes(s) && !(s in IMPOSSIBLE));
  assert.deepEqual(missing, [],
    '이 상태들은 .selected 와 같이 붙을 수 있는데 중화가 색을 지운다 — 그 표시가 «사라진다»');
});

test('★블록 이름 «목록»을 만들지 않았다', () => {
  const names = new Set([...JS_CODE.matchAll(/\.([a-z0-9]+-block)\b/g)].map(m => m[1]));
  assert.ok(names.size <= 6,
    `오버레이 JS 가 블록 이름 ${names.size}종을 알고 있다: ${[...names].join(', ')}\n` +
    '— 목록으로 관리되는 규칙은 «새 블록이 생길 때 조용히 빠진다». 일반 질의로 되돌려라');
  assert.ok(/querySelectorAll\('\.selected'\)/.test(JS_CODE),
    '대상 집합은 `#canvas .selected` 일반 질의여야 한다');
});

test('★좌표는 «핸들과 같은 함수»에서만 나온다', () => {
  assert.ok(/_cornerScreen\(/.test(JS_CODE), '_cornerScreen 을 호출해야 한다');
  assert.ok(!/getBoundingClientRect/.test(JS_CODE),
    '직접 rect 를 읽으면 핸들과 «갈라진다» — M39 가 바로 그 병이었다(핸들은 여기, 선은 저기)');
  assert.ok(/from '\.\/overlay-handles\.js'/.test(JS_CODE), '기존 자산에서 «임포트»해야 한다');
  assert.ok(/export function _cornerScreen/.test(rd('js/overlay-handles.js')),
    '_cornerScreen 이 export 여야 재사용이 성립한다');
});

test('★body 클래스는 «초기화 성공 뒤» 붙는다(JS 가 죽으면 문서 outline 이 산다)', () => {
  const add = JS_CODE.indexOf("classList.add('sel-ov')");
  const act = JS_CODE.indexOf('_active = true');
  assert.ok(add > 0 && act > 0, "classList.add('sel-ov') / _active = true 를 못 찾았다");
  assert.ok(act < add, '초기화 성공 «전»에 클래스를 붙이면, 실패했을 때 선택 표시가 통째로 사라진다');
  assert.ok(/catch[\s\S]{0,120}classList\.remove\('sel-ov'\)/.test(JS_CODE),
    '예외가 나면 클래스를 «되돌려야» 한다 — 중화만 남고 오버레이가 없으면 표시가 사라진다');
  assert.ok(/if \(!window\.SEL_OVERLAY_ENABLED\) return false/.test(JS_CODE), '킬스위치를 봐야 한다');
  assert.ok(/SEL_OVERLAY_ENABLED\s*=\s*(true|false)/.test(rd('js/feature-flags.js')),
    '플래그 단일 원본은 js/feature-flags.js 다(COLLAB_ENABLED 선례)');
  assert.ok(/src="js\/selection-overlay\.js"/.test(rd('index.html')), '모듈이 화면에 걸려 있어야 한다');
});

test('★매 프레임 isConnected — undo/협업이 outerHTML 을 갈아끼운다', () => {
  assert.ok(/isConnected/.test(JS_CODE), '죽은 노드를 들고 있으면 «유령 상자»가 남는다(위험7·8)');
  assert.ok(/MutationObserver/.test(JS_CODE) && /childList:\s*true/.test(JS_CODE) && /attributeFilter/.test(JS_CODE),
    '선택 변경 «이벤트가 없다» — class 변화와 childList 를 둘 다 봐야 한다');
});


test('★조건③ 재발방지 — CSS 의 stroke-width 와 JS 의 STROKE_W 가 «같은 값»인가', () => {
  /* 스냅은 «반굵기»만큼 선을 상자 안쪽에 둔다. 그 반굵기를 JS 가 STROKE_W 로 «안다».
   * CSS 에서만 굵기를 바꾸면 스냅이 굵기를 잘못 알아 선이 상자 «밖»으로 샌다 —
   * 실제로 --overlay(1.5px)에서 0.25 CSS px 가 새어 190 픽셀이 이웃에 찍혔다(적대검수 조건③).
   * ⇒ 두 값이 갈라지는 순간 여기서 빨강. */
  const m = JS_CODE.match(/STROKE_W\s*=\s*\{([^}]*)\}/);
  assert.ok(m, 'STROKE_W 표를 못 찾았다');
  const js = {};
  for (const mm of m[1].matchAll(/(?:'([a-z]*)'|([a-z]+))\s*:\s*([\d.]+)/g)) js[mm[1] ?? mm[2]] = parseFloat(mm[3]);
  assert.ok(Object.keys(js).length >= 2, `STROKE_W 항목이 ${Object.keys(js).length}개 — 너무 적다`);

  const cssW = {};
  for (const mm of CSS.matchAll(/\.ss-sel-path(--[a-z]+)?\s*\{([^}]*)\}/g)) {
    const w = mm[2].match(/stroke-width\s*:\s*([\d.]+)/);
    if (w) cssW[(mm[1] || '').replace('--', '')] = parseFloat(w[1]);
  }
  assert.ok('' in cssW, '.ss-sel-path 의 stroke-width 를 CSS 에서 못 찾았다');
  for (const [k, v] of Object.entries(cssW)) {
    assert.equal(js[k] ?? js[''], v,
      `변종 «${k || '기본'}» 굵기가 CSS ${v} vs JS ${js[k] ?? js['']} — 스냅이 굵기를 잘못 알면 선이 상자 밖으로 샌다`);
  }
});

test('★조건① 재발방지 — 오버레이가 border-radius 를 «읽는다»', () => {
  assert.ok(/borderTopLeftRadius/.test(JS_CODE) && /borderBottomRightRadius/.test(JS_CODE),
    '네 모서리 반경을 «각각» 읽어야 한다 — M39 의 코너 반경 핸들이 모서리별로 조절한다');
  assert.ok(/getComputedStyle/.test(JS_CODE),
    'inline style 만 보면 CSS 클래스로 온 반경을 놓친다');
  assert.ok(/\bA\$\{|_arc\(/.test(JS_CODE), 'SVG 원호(A) 를 그려야 둥근 모서리를 따라간다');
  /* ★이 줄이 «검사가 대상을 실제로 보는지»를 지킨다.
   *   기하 단위검사는 반경을 «주입해서» 산술만 본다 — _geomOf 가 _radiiOf 를 안 부르게 바꿔도
   *   그쪽은 초록이었다(양성대조로 확인). 그 구멍을 여기서 막는다. */
  assert.ok(/const rawR = _radiiOf\(el/.test(JS_CODE),
    '_geomOf 가 _radiiOf 를 «호출»해야 한다 — 안 부르면 반경을 읽고도 안 쓰는 셈이다');
  assert.ok(/_clampRadii/.test(JS_CODE) && /_insetRadii/.test(JS_CODE),
    '반경은 «변 길이로 클램프»하고 «선 안쪽 거리만큼 축소»해야 한다(CSS 규약 + 안쪽 선)');
});
