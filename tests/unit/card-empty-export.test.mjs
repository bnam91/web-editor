/* U-CVBEXP — 빈 카드 이미지 표시가 «내보내기 결과물»로 새는지 감시한다.
 *   실행: node --test "tests/unit/*.test.mjs"  ·  소스만 읽는다(라이브 무접촉).
 *
 * ★왜 이 파일이 있나 — 적대검수(EVAL-batch-0905) 조건①.
 *   현빈 2026-09-05 「카드블럭에 이미지 영역 체크배경으로 해줘. 다른 이미지 에셋 블럭 배경처럼」
 *   1차 수정(M38)이 체커를 «인라인 style» 로 박았다. 인라인은 직렬화돼 저장본에 실리고
 *   내보낸 HTML 에도 체커와 '+' 가 그대로 찍힌다 — «편집 화면 표시»가 «배송물»이 된 것이다.
 *   ★정본인 .asset-block 은 체커를 CSS 에 둔다. 재사용해야 했던 것은 «값»이 아니라 «두는 자리».
 *   ★옛 코드(rgba(0,0,0,0.06))도 같은 인라인이었다 — 회색이라 안 보였을 뿐. 새 병이 아니라
 *     드러난 병이다. 그래서 이 검사는 «체커»가 아니라 «인라인이냐»를 잰다.
 *
 * ⚠️이 검사는 «결함이 다시 들어오는 문»을 지킨다. 값을 옮겨도 다음 사람이 인라인으로 되돌리면
 *   조용히 회귀하고, export-html 의 클래스 제거 줄은 그때 아무것도 안 한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toPosix } from './_srcread.js';   // ★스캔 키는 posix 로 — 윈도우 `js\a.js` 방어(win-portability ④)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const CVB    = strip(read('js/blocks/canvas-block.js'));
const CSS    = read('css/editor-blocks.css');
const EXPORT = strip(read('js/io/export-html.js'));

/* ★2026-09-21 사용자관점훑기 exportvisual — 이 검사는 «손으로 적은 목록»이었다.
 *   canvas-block.js «하나»만 훑었고, js/blocks/banner02-block.js 가 그 목록 «밖»에서
 *   정확히 같은 규약을 어기고 있었다(`img.style.background = 'repeating-conic-gradient(...)'`).
 *   그물 밖이라 검사는 초록인데 결함은 살아 있었다.
 * ★2026-09-21 EVAL low — 한 번 더 좁았다. js/blocks «만» 넓혔는데, 캔버스에 들어가는 DOM 에
 *   체커를 인라인으로 박는 자리가 그 디렉터리 밖에도 있었다(js/props/prop-table.js
 *   _makeImgCellPlaceholder → .tbl-img-cell, 표 이미지 row 의 빈 칸). ⇒ 범위를 js/ «전수»로 넓힌다.
 * ★예외는 «사유와 함께» 명시한다 — 목록이 없으면 「일부러 둔 것」과 「실수로 빠진 것」이 안 갈린다.
 *   ⚠️예외는 «파일»이 아니라 «파일+건수»로 적는다. 파일만 적으면 허용된 파일에 새 인라인 체커가
 *     하나 더 들어와도 조용히 통과한다(이 검사가 막으려던 바로 그 모양이다).
 * ⚠️이 검사의 한계(다음 사람에게) — 잡는 모양은 `.style.background|backgroundImage|cssText = …`
 *   «뿐»이다. innerHTML 템플릿의 `style="…"` 안에 박힌 체커는 안 잡힌다
 *   (js/blocks/annotation-block.js:215 가 실제로 그 꼴인데, 주석 블럭은 캡처·배송 클론에서
 *    통째로 remove 되므로 결과물엔 안 나간다). 그 축의 그물은 정적 스캔이 아니라
 *   tests/dom/export-image-empty-checker.dom.spec.js 의 «산출물 실측»이 진다. */
const JS_DIR = path.join(ROOT, 'js');
const INLINE_CHECKER_ALLOW = {
  // ── 실제 화면 이미지 «밑에 까는 안전망»(투명 PNG 대비). 빈 칸 «표시»가 아니다.
  //    url(...) 과 «같은 선언»에 들어가야 해서 클래스로 뺄 수 없다. 결과물로 새는 몫은
  //    js/io/capture-safety.js neutralizeEmptyImageCheckerForCapture 가 «레이어 단위»로 막는다.
  'js/blocks/mockup-block.js': { n: 1, why: '목업 화면 — 실제 이미지 아래 깔리는 투명 안전망' },
  'js/io/save-load.js':        { n: 1, why: '위와 같은 안전망 — 저장본 로드 복원 경로' },
  'js/props/prop-mockup.js':   { n: 1, why: '위와 같은 안전망 — 패널에서 이미지 넣는 경로' },
  // ── 패널(우측 속성창) UI 의 스와치·바. «캔버스 DOM 이 아니다» ⇒ 저장본·배송본에 애초에 안 실린다.
  'js/props/prop-shape.js':       { n: 2, why: '패널 이미지 스와치(투명 표시) — 캔버스 DOM 아님' },
  /* ★3 → 4 (2026-09-21 합치기): fix/ul-colorhex(499cbc3)가 «에셋 배경색 칸»을 같은 규약으로
     맞추면서 같은 종류의 스와치 하나가 늘었다. 확인한 것 — .prop-color-swatch 는 js/props/
     밖에서 안 쓰이고, 캔버스가 아니라 우측 패널 마크업(index.html:511)에 붙는다 ⇒ 저장본·
     단독 HTML 내보내기에 실리지 않는다. 그래서 «예외»가 맞고 건수만 올린다.
     ⛔이 숫자를 «그냥» 올리지 마라 — 올리기 전에 그 자리가 캔버스 DOM 인지 매번 확인할 것. */
  'js/props/prop-simple-card.js': { n: 4, why: '패널 색 스와치(투명 표시) — 캔버스 DOM 아님' },
  'js/props/prop-gradient.js':    { n: 1, why: '패널 그라데이션 바 뒤 투명 표시 — 캔버스 DOM 아님' },
};

/** js/ 아래 .js 전수 (레포 상대경로, 슬래시 통일) */
function allJsFiles(dir = JS_DIR, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) allJsFiles(f, out);
    else if (e.name.endsWith('.js')) out.push(toPosix(path.relative(ROOT, f)));
  }
  return out;
}

/** 소스 한 벌에서 «인라인으로 체커를 박는 줄»을 찾는다(상수 뒤에 숨어도 잡는다). */
function inlineCheckerLines(src) {
  const holders = [...src.matchAll(/const\s+([A-Za-z0-9_$]+)\s*=\s*'[^']*repeating-conic-gradient/g)]
    .map(m => m[1]);
  const rhs = ['repeating-conic-gradient', ...holders];
  return src.split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /\.style\.(background|backgroundImage|cssText)\s*=/.test(l)
                    && rhs.some(r => l.includes(r)))
    .map(([n, l]) => `${n}: ${l.trim()}`);
}

/* ★이 검사를 «한 번 틀리게» 썼다(2026-09-06). 처음엔 「그 줄에 repeating-conic-gradient 가
   있는가」로 셌는데, 옛 코드는 `style.background = _CVB_CHECKER_BG` 라 «그 줄에 그 글자가 없다».
   그래서 양성대조에서 옛 소스가 이 검사를 «통과»했다 — 지켜야 할 바로 그 회귀를 못 보는 검사였다.
   ⇒ 리터럴이 아니라 «체커를 담은 이름»까지 같이 본다. 값이 상수 뒤에 숨어도 잡힌다. */
test('★조건① — 빈 카드 이미지 체커를 «인라인 style» 로 박지 않는다(직렬화돼 결과물에 실린다)', () => {
  // 이 파일 안에서 체커 문자열을 담은 const 이름을 «소스에서» 찾아낸다(이름을 박지 않는다).
  const holders = [...CVB.matchAll(/const\s+([A-Za-z0-9_$]+)\s*=\s*'[^']*repeating-conic-gradient/g)]
    .map(m => m[1]);
  const rhs = ['repeating-conic-gradient', ...holders];
  const bad = CVB.split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /\.style\.(background|backgroundImage|cssText)\s*=/.test(l)
                    && rhs.some(r => l.includes(r)))
    .map(([n, l]) => `${n}: ${l.trim()}`);
  assert.deepEqual(bad, [],
    '체커가 인라인으로 돌아왔다 — 저장본·내보내기에 실린다. .cvb-img-empty 클래스를 쓸 것');
});

test('★자기검사 — 위 검사가 «상수 뒤에 숨은» 인라인도 잡는지 확인한다(양성대조를 코드로 고정)', () => {
  const FAKE = [
    "const _X_BG = 'repeating-conic-gradient(#d8d8d8 0% 25%, #f0f0f0 0% 50%) 0 0 / 72px 72px';",
    '  el.style.background = _X_BG;',
  ].join('\n');
  const holders = [...FAKE.matchAll(/const\s+([A-Za-z0-9_$]+)\s*=\s*'[^']*repeating-conic-gradient/g)]
    .map(m => m[1]);
  const rhs = ['repeating-conic-gradient', ...holders];
  const caught = FAKE.split('\n').filter(l =>
    /\.style\.(background|backgroundImage|cssText)\s*=/.test(l) && rhs.some(r => l.includes(r)));
  assert.equal(caught.length, 1,
    '검사식이 «상수 뒤에 숨은» 인라인을 못 본다 — 지켜야 할 회귀가 바로 이 모양이었다');
});

test("★조건① — '+' 안내문을 DOM 텍스트 노드로 넣지 않는다(클래스를 벗겨도 글자가 남는다)", () => {
  assert.doesNotMatch(CVB, /textContent\s*=\s*'\+'/,
    "'+' 가 텍스트 노드로 돌아왔다 — ::before 로 둘 것");
});

test('★체커는 CSS 에 «있다» — 옮기기만 하고 안 그리면 현빈 요구가 사라진다', () => {
  for (const cls of ['.cvb-img-empty', '.cvb-img-empty-plain']) {
    const i = CSS.indexOf(`.canvas-block ${cls} {`);
    assert.ok(i !== -1, `${cls} 규칙이 없다 — 체커가 아예 안 그려진다`);
    const body = CSS.slice(i, CSS.indexOf('}', i));
    assert.match(body, /repeating-conic-gradient/, `${cls} 에 체커가 없다`);
  }
  assert.match(CSS, /\.canvas-block \.cvb-img-empty::before\s*\{[^}]*content:\s*'\+'/,
    "'+' 안내문이 ::before 에 없다");
});

test('★정본과 «같은 값» — 빈 에셋 블록의 체커와 문자열이 일치한다(현빈: 「에셋 블럭 배경처럼」)', () => {
  const grab = (src, needle) => {
    const i = src.indexOf(needle);
    assert.ok(i !== -1, `못 찾음: ${needle}`);
    const m = src.slice(i, i + 400).match(/repeating-conic-gradient\([^)]*\)[^;]*/);
    return m && m[0].replace(/\s+/g, ' ').trim();
  };
  const asset = grab(read('css/editor-layout.css'), '.asset-block {');
  const card  = grab(CSS, '.canvas-block .cvb-img-empty {');
  assert.equal(card, asset, '카드 체커가 에셋 블록과 다른 값이다 — 「같은 배경처럼」이 깨진다');
});

test('★export 는 이 표시를 «편집 전용»으로 다룬다(.bn2-line-empty 와 같은 목록)', () => {
  assert.match(EXPORT, /cvb-img-empty/,
    'export-html 이 이 클래스를 모른다 — 편집 전용 표시라는 «의도»가 코드에 없다');
});

/* ══════════════════════════════════════════════════════════════════════════
   범위 확장 — 「카드 하나」가 아니라 «블록 전수»를 본다. (exportvisual, 2026-09-21)
   ══════════════════════════════════════════════════════════════════════════ */
test('★범위 — 이 검사가 실제로 js/ 전수를 읽는다(넓히기가 no-op 이 아님을 고정)', () => {
  const files = allJsFiles();
  assert.ok(files.length >= 100, `js/ 파일이 ${files.length}개뿐 — 경로가 틀렸다`);
  // ★«디렉터리 밖»을 실제로 덮는지 — blocks 하나, io 하나, props 하나를 같이 요구한다.
  for (const must of ['js/blocks/canvas-block.js', 'js/blocks/banner02-block.js',
                      'js/io/export-html.js', 'js/props/prop-table.js']) {
    assert.ok(files.includes(must), `${must} 가 스캔 목록에 없다 — 그물이 그 자리를 안 덮는다`);
  }
});

test('★조건①(js/ 전수) — 캔버스에 들어가는 DOM 에 빈 이미지 체커를 «인라인 style» 로 박지 않는다', () => {
  const offenders = {};
  const allowCount = {};
  for (const rel of allJsFiles()) {
    const bad = inlineCheckerLines(strip(fs.readFileSync(path.join(ROOT, rel), 'utf8')));
    if (!bad.length) continue;
    const allow = INLINE_CHECKER_ALLOW[rel];
    if (allow) { allowCount[rel] = bad.length; continue; }    // 사유는 위 표에 적혀 있다
    offenders[rel] = bad;
  }
  assert.deepEqual(offenders, {},
    '체커가 인라인으로 박혀 있다 — 저장본·단독 HTML 내보내기에 그대로 실린다. CSS 클래스로 뺄 것');
  // ★허용된 파일에 «한 줄 더» 들어오면 빨강 — 파일만 적는 예외는 그 문을 열어 둔다.
  const expect = Object.fromEntries(Object.entries(INLINE_CHECKER_ALLOW).map(([k, v]) => [k, v.n]));
  assert.deepEqual(allowCount, expect,
    '예외 파일의 인라인 체커 «건수»가 달라졌다 — 표(사유 포함)를 같이 고칠 것');
});

test('★자기검사(범위) — 고치기 «전» prop-table.js 를 넣으면 빨강이어야 한다(음성대조, 디렉터리 밖 축)', () => {
  const BEFORE = "  ph.style.cssText = `${sizeRule};width:100%;background-image:"
               + "repeating-conic-gradient(#e0e0e0 0% 25%, transparent 0% 50%);background-size:16px 16px;`;";
  assert.equal(inlineCheckerLines(BEFORE).length, 1,
    'js/props 아래의 인라인 체커를 못 잡는다 — 넓힌 범위가 헛돈다');
  // 그리고 «지금» 그 파일은 깨끗해야 한다(고쳤다는 주장의 근거).
  assert.deepEqual(inlineCheckerLines(strip(read('js/props/prop-table.js'))), []);
});

test('★표 이미지 칸 체커는 CSS 에 «있다» — 옮기기만 하고 안 그리면 편집 화면이 달라진다', () => {
  const i = CSS.indexOf('.table-block .tbl-img-cell {');
  assert.ok(i !== -1, '.tbl-img-cell 규칙이 없다 — 빈 이미지 칸이 아예 안 그려진다');
  const body = CSS.slice(i, CSS.indexOf('}', i));
  assert.match(body, /repeating-conic-gradient\(#e0e0e0 0% 25%, transparent 0% 50%\)/,
    '표 체커 «값»이 옮기는 중에 달라졌다 — 자리만 바꾸는 수정이라 화면 그림은 같아야 한다');
  assert.match(body, /background-size:\s*16px 16px/, '체커 크기가 빠졌다');
});

test('★자기검사(전수) — 고치기 «전» 배너 소스를 넣으면 이 검사가 빨강이어야 한다(음성대조)', () => {
  const BEFORE = [
    "  } else {",
    "    img.style.background = 'repeating-conic-gradient(#e3e3e3 0% 25%, #efefef 0% 50%) 0 / 16px 16px';",
    "  }",
  ].join('\n');
  const caught = inlineCheckerLines(BEFORE);
  assert.equal(caught.length, 1,
    '고치기 전 banner02-block.js 의 그 줄을 못 잡는다 — 지켜야 할 회귀가 바로 이 모양이었다');
});

test('★체커는 CSS 에 «있다» — 배너 빈 이미지 칸도 값이 안 사라졌다', () => {
  const i = CSS.indexOf('.banner02-block .bn2-img-empty {');
  assert.ok(i !== -1, '.bn2-img-empty 규칙이 없다 — 체커가 아예 안 그려진다');
  const body = CSS.slice(i, CSS.indexOf('}', i));
  assert.match(body, /repeating-conic-gradient\(#e3e3e3 0% 25%, #efefef 0% 50%\)/,
    '배너 체커 «값»이 옮기는 중에 달라졌다 — 자리만 바꾸는 수정이라 화면 그림은 같아야 한다');
});

test('★export 는 배너 체커도 «편집 전용»으로 다룬다', () => {
  assert.match(EXPORT, /bn2-img-empty/,
    'export-html 이 이 클래스를 모른다 — 편집 전용 표시라는 «의도»가 코드에 없다');
});

/* ══════════════════════════════════════════════════════════════════════════
   그리드 «빈 셀» — 넷째 자리. (2026-09-25, 현빈 「빈 슬롯 … 체크패턴으로」)
   ★이 자리는 앞의 셋과 «한 가지가 달랐다» — 무늬가 체커가 아니라 회색 «단색»
     (`background:#e8e8e8`)이었고, 그래서 체커를 찾는 위 그물이 «있지도 않은 것»을 못 찾아
     조용히 초록이었다. 혼자 관용구 밖에 있었던 것이지 예외로 허락된 게 아니었다.
   ⇒ 값을 .bn2-img-empty 관용구로 맞추면서 «두는 자리»도 CSS 로 옮겼다. 아래가 그 그물이다.
   ══════════════════════════════════════════════════════════════════════════ */
test('★체커는 CSS 에 «있다» — 그리드 빈 셀도 값이 안 사라졌다', () => {
  const i = CSS.indexOf('.grid-block .grd-img-empty {');
  assert.ok(i !== -1, '.grd-img-empty 규칙이 없다 — 빈 셀이 체크패턴으로 아예 안 그려진다');
  const body = CSS.slice(i, CSS.indexOf('}', i));
  assert.match(body, /repeating-conic-gradient/, '그리드 빈 셀에 체커가 없다');
});

test('★관용구와 «같은 값» — 그리드 빈 셀 체커가 배너02 빈 이미지칸과 문자열이 일치한다', () => {
  /* ★왜 .asset-block(72px) 이 아니라 .bn2-img-empty(16px) 인가 — 배너 주석에 적힌 그 까닭
     그대로다: 칸이 작아서다. 72px 타일은 한 칸에 한두 개만 들어가 «무늬»로 안 읽힌다.
     ⛔새 값을 발명하지 않는다 — 이 단언이 그 문을 닫는다. */
  const grab = (needle) => {
    const i = CSS.indexOf(needle);
    assert.ok(i !== -1, `못 찾음: ${needle}`);
    const m = CSS.slice(i, i + 400).match(/repeating-conic-gradient\([^)]*\)[^;]*/);
    return m && m[0].replace(/\s+/g, ' ').trim();
  };
  assert.equal(grab('.grid-block .grd-img-empty {'), grab('.banner02-block .bn2-img-empty {'),
    '그리드 빈 셀 체커가 배너02와 다른 값이다 — 관용구 밖으로 다시 나갔다');
});

test('★export 는 그리드 빈 셀도 «편집 전용»으로 다룬다', () => {
  assert.match(EXPORT, /grd-img-empty/,
    'export-html 이 이 클래스를 모른다 — 편집 전용 표시라는 «의도»가 코드에 없다');
});

/* ══════════════════════════════════════════════════════════════════════════
   ★그물의 «둘째 모양» — innerHTML 템플릿의 style="…" 안에 박힌 체커. (2026-09-25)

   ★왜 넓히나 — 위 inlineCheckerLines 는 `.style.background|backgroundImage|cssText = …`
     «대입문»만 잡는다. 그 한계는 이 파일이 스스로 적어 뒀다(위 45줄). 그런데 그리드 렌더러
     (js/blocks/grid-block.js _gridLineHtml)는 «대입문을 안 쓴다» — 템플릿 문자열로
     `<div style="…">` 을 짠다. 즉 누가 거기 체커를 인라인으로 도로 박아도 옛 그물은 초록이다.
     ⇒ 이번에 그 자리를 CSS 로 옮기면서, «되돌아오는 문»도 같이 닫는다.
       (표·배너02 때 한 일과 같다: 고치면서 그 모양의 그물을 같이 넓힌다.)
   ⚠️예외는 «파일+건수»로 적는다 — 파일만 적으면 허용된 파일에 한 줄 더 들어와도 조용히 통과한다.
   ══════════════════════════════════════════════════════════════════════════ */
const TEMPLATE_CHECKER_ALLOW = {
  /* 주석 블럭은 캡처·배송 클론에서 «통째로 remove» 된다(export-html.js·capture-safety.js) —
     결과물에 나갈 길이 없다. 위 45줄의 한계 주석이 이미 이 자리를 지목해 뒀다. */
  'js/blocks/annotation-block.js': { n: 1, why: '주석 블럭 — 캡처·배송 클론에서 통째로 제거된다' },
};

/** 마크업 문자열(`style="…"`) «안»에 박힌 체커를 찾는다 — 대입문이 아닌 꼴. */
function templateCheckerLines(src) {
  return src.split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /style\s*=\s*(["'])[^"']*repeating-conic-gradient/.test(l))
    .map(([n, l]) => `${n}: ${l.trim().slice(0, 160)}`);
}

test('★조건①(둘째 모양) — 템플릿 style="…" 안에 빈 이미지 체커를 박지 않는다', () => {
  const offenders = {};
  const allowCount = {};
  for (const rel of allJsFiles()) {
    const bad = templateCheckerLines(strip(fs.readFileSync(path.join(ROOT, rel), 'utf8')));
    if (!bad.length) continue;
    if (TEMPLATE_CHECKER_ALLOW[rel]) { allowCount[rel] = bad.length; continue; }
    offenders[rel] = bad;
  }
  assert.deepEqual(offenders, {},
    '체커가 템플릿 인라인으로 박혀 있다 — 저장본(.gdt)·단독 HTML 배송본에 그대로 실린다. CSS 클래스로 뺄 것');
  const expect_ = Object.fromEntries(Object.entries(TEMPLATE_CHECKER_ALLOW).map(([k, v]) => [k, v.n]));
  assert.deepEqual(allowCount, expect_,
    '예외 파일의 템플릿 체커 «건수»가 달라졌다 — 표(사유 포함)를 같이 고칠 것');
});

test('★자기검사(둘째 모양) — 그리드 렌더러에 체커를 인라인으로 박으면 빨강이어야 한다(음성대조)', () => {
  /* ★이 문자열은 «고치기 전»이 아니라 «되돌아올 모양»이다 — 고치기 전 그 자리는
     `background:#e8e8e8` 회색 단색이라 체커 그물엔 애초에 안 걸렸다(그게 문제였다).
     ⛔그러니 여기서 재는 것은 「옛 소스를 잡나」가 아니라 「그 자리에 체커가 인라인으로
       들어오면 잡나」다 — 이 그물이 닫으려는 문이 정확히 그것이다. */
  const BACKSLID = '      return `<div${addrAttr} class="grd-img-frame grd-img-empty" '
    + 'style="${widthCss}height:${ph}px;background:repeating-conic-gradient(#e3e3e3 0% 25%, '
    + '#efefef 0% 50%) 0 0 / 16px 16px;"></div>`;';
  assert.equal(templateCheckerLines(BACKSLID).length, 1,
    '템플릿 안의 인라인 체커를 못 잡는다 — 넓힌 그물이 헛돈다');
  // 그리고 «지금» 그리드 렌더러는 깨끗해야 한다(옮겼다는 주장의 근거).
  assert.deepEqual(templateCheckerLines(strip(read('js/blocks/grid-block.js'))), []);
});

test('★그리고 그리드는 무늬를 «인라인으로 안 준다» — 회색 단색도 돌아오지 않았다', () => {
  /* ⛔`background:#e8e8e8` 이 바로 옛 모양이다. 체커든 단색이든, 빈 칸 «표시»를 인라인으로
     주면 저장본과 배송본에 실린다 — 값이 무엇이냐가 아니라 «두는 자리»가 규약이다. */
  const GRID = strip(read('js/blocks/grid-block.js'));
  const bad = GRID.split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /grd-img-empty/.test(l) && /style\s*=\s*(["'])[^"']*background\s*:/.test(l))
    .map(([n, l]) => `${n}: ${l.trim().slice(0, 160)}`);
  assert.deepEqual(bad, [],
    '빈 슬롯이 무늬를 인라인 style 로 다시 받고 있다 — .grid-block .grd-img-empty 클래스를 쓸 것');
});

/* ══════════════════════════════════════════════════════════════════════════
   PNG 내보내기 쪽 — 「CSS 에 두면 자동으로 안 나간다」는 공식이 «안» 통하는 경로.
   캡처 클론은 document.body 에 붙어 앱 CSS 를 그대로 받는다 ⇒ 별도 걷기가 필요하다.
   ══════════════════════════════════════════════════════════════════════════ */
test('★PNG 경로 — 체커 걷기가 «한 자리»에 있고 export·truth·썸네일 셋이 그것을 부른다', () => {
  const safety = read('js/io/capture-safety.js');
  const expImg = read('js/io/export-image.js');
  const saveLd = read('js/io/save-load.js');
  assert.match(safety, /export function neutralizeEmptyImageCheckerForCapture\(/,
    '공용 걷기 함수가 없다');
  // export 와 truth 는 renderComponentsInClone «한 함수»를 같이 부른다 — 거기 들어 있어야 둘이 못 갈린다.
  const rc = expImg.slice(expImg.indexOf('export function renderComponentsInClone'),
                          expImg.indexOf('/** export/truth 공용'));
  assert.match(rc, /neutralizeEmptyImageCheckerForCapture\(clone\)/,
    'export·truth 공용 단계에서 체커를 안 걷는다 — 재렌더가 되살린 체커가 그대로 찍힌다');
  const thumb = saveLd.slice(saveLd.indexOf('async function captureThumbnail'),
                             saveLd.indexOf('/* ── 프로젝트 파일 저장'));
  assert.match(thumb, /neutralizeEmptyImageCheckerForCapture\(clone\)/,
    '썸네일이 체커를 안 걷는다 — 프로젝트 목록 그림에 박힌다');
});

test('★레이어 보존 — background-image 를 통째로 none 으로 박지 않는다(목업 실사용 이미지 보호)', () => {
  const safety = read('js/io/capture-safety.js');
  const fn = safety.slice(safety.indexOf('export function neutralizeEmptyImageCheckerForCapture'),
                          safety.indexOf('/* ── 편집 전용 DOM·상태 걷기'));
  assert.match(fn, /splitBgLayers/, '레이어를 쪼개지 않는다 — url(...) 위에 겹친 체커를 못 가른다');
  /* ★재는 것은 «background-image 에 뭘 쓰는가» 한 자리다 — 파일 어딘가의 'none' 글자가 아니라.
     (2026-09-21: `bg === 'none'` 같은 «읽기» 비교가 생기자 옛 검사식이 오탐했다.) */
  const writes = [...fn.matchAll(/setProperty\(\s*'background-image'\s*,([^)]*)\)/g)].map(m => m[1].trim());
  assert.equal(writes.length, 1, `background-image 를 쓰는 자리가 ${writes.length}곳 — 한 자리여야 한다`);
  assert.match(writes[0], /kept\.length\s*\?/,
    "조건 없이 값을 박는다 — 남은 레이어가 있으면 그걸 써야 한다(목업 실사용 이미지 보호)");
});
