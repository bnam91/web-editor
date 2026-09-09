/* U-VARSHIP — 「안 쓰는 A/B 시안」이 «배송본»으로 새지 않는다 + 인스펙터가 «못 가는 곳»을 세지 않는다.
 *   실행: node --test "tests/unit/*.test.mjs"  ·  술어는 «진짜로 돌리고», 호출부는 소스로 잰다(라이브 무접촉).
 *
 * ★잰 사실 (2026-09-09 · QA · 포트 9386 · HEAD f8f66c0 · CDP 실측)
 *   ⑴ export.html 에 .section-block 이 2개 — data-variation-active="0" 그대로 실렸다.
 *      숨기는 CSS(.section-block[data-variation-active="0"]{display:none})는 내보낸 CSS(3,866B)에
 *      «없다»(/variation/i 히트 0) ⇒ ★받는 사람 화면에 A안·B안이 위아래로 «둘 다» 보였다.
 *   ⑵ Figma JSON 도 sections 2개("Section 01" 두 번).
 *   ⑶ 인스펙터 점프: 진짜 클릭 24회 중 19/24 만 대상이 화면에 들어왔다. 실패 5는 «전부»
 *      비활성 시안 안 블록(rect 0×0). 숨은 시안을 없애고 다시 재니 20/20 — «간헐»이 아니라
 *      «대상의 함수»였다.
 *
 * ★처방 — CSS 한 줄을 배송본에 끼워 넣어 «숨기는» 게 아니라, 배송본에서 «뺀다».
 *   숨기면 데이터는 여전히 나간다(받는 사람이 소스를 보면 안 고른 시안이 그대로 있다).
 *
 * ⚠️★가장 중요한 경계 — 저장본(.gdt · proj.json · 프로젝트 JSON)에서는 «빼면 안 된다».
 *   거기서 빼는 것은 숨기는 게 아니라 «사용자의 시안을 지우는» 것이다. V4 가 그 문을 지킨다.
 *
 * ⛔이 파일은 「고쳤나」를 «자기 말»로 세지 않는다 — 분모를 기계가 세고(섹션 순회 전수·술어를
 *   아는 파일 전수), 단언마다 «변이»를 실제로 주입해 빨강이 나오는지 같은 검사 안에서 확인한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
/* 구간 «끝»은 세어서 찾는다 — 꼬리 문자열(`\n  };`)로 찾으면 남의 코드를 삼킨다(_slice-block 머리말). */
import { sliceBlock } from './_slice-block.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
/** 주석을 지운 소스 — 「주석에 그 글자가 있다」로 통과하는 검사를 막는다. */
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const MOD_SRC  = rd('js/variation-visibility.js');

/* ★술어는 «소스를 그대로 돌려» 쓴다 — 검사가 문자열이 아니라 «동작»을 재게.
   ⛔import() 를 쓰지 않는다: ⑴ 이 레포의 js/*.js 는 브라우저에선 ESM 이지만 package.json 에
   type:module 이 없어 Node 가 import 하면 CJS 로 읽고, ⑵ data: URL import 는 win-portability
   ②-4 가 막는 자리다(그 검사는 「file:// 아닌 import()」를 전수로 센다).
   ⇒ export 키워드만 걷어 «그 파일의 진짜 글자»를 함수 본문으로 돌린다. 내보내는 이름도 «기계»가 센다. */
function asModule(src) {
  const names = [...src.matchAll(/export\s+(?:const|function)\s+([A-Za-z0-9_$]+)/g)].map(m => m[1]);
  assert.ok(names.length >= 5,
    `★js/variation-visibility.js 에서 내보내는 이름을 ${names.length}개 밖에 못 찾았다 — 모듈 모양이 바뀌었다`);
  return new Function(src.replace(/\bexport\s+/g, '') + `\n;return { ${names.join(', ')} };`)();
}
const {
  HIDDEN_VARIATION_SEL, HIDDEN_VARIATION_SECTION_SEL, NOT_HIDDEN_VARIATION,
  isHiddenVariationSection, isInHiddenVariation, isJumpTarget,
} = asModule(MOD_SRC);
const HTMLSRC  = strip(rd('js/io/export-html.js'));
const FIGSRC   = strip(rd('js/io/export-figma-json.js'));
const INSPSRC  = strip(rd('js/inspector.js'));
const PANELCSS = rd('css/editor-panels.css');

/** 아주 작은 요소 대역 — closest 는 «부모를 타고» 올라간다(진짜 DOM 과 같은 뜻). */
function mkEl({ active, parent = null, connected = true } = {}) {
  const el = {
    _attrs: active === undefined ? {} : { 'data-variation-active': String(active) },
    parentNode: parent,
    isConnected: connected,
    getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; },
    /* 진짜 closest 처럼 «값을 지정한» 형태와 «속성만» 있는 형태를 둘 다 다룬다 —
       변이(값을 뺀 셀렉터)를 이 대역이 못 다루면 그 변이가 검사되지 않는다. */
    closest(sel) {
      const m = sel.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
      assert.ok(m, `이 대역이 못 다루는 셀렉터: ${sel} — 술어가 바뀌었으면 대역도 같이 옮겨라`);
      const hit = n => m[2] === undefined ? n.getAttribute(m[1]) !== null : n.getAttribute(m[1]) === m[2];
      for (let n = this; n; n = n.parentNode) if (hit(n)) return n;
      return null;
    },
  };
  return el;
}

/** 모듈 소스를 «변이»시켜 진짜로 돌린다 — 변이가 주입됐는지 자체를 확인한다. */
function importMutated(from, to) {
  assert.ok(MOD_SRC.includes(from), `변이 주입 실패 — 원본에 「${from}」 이 없다`);
  const mutated = MOD_SRC.replace(from, to);
  assert.notEqual(mutated, MOD_SRC, '★변이가 주입되지 않았다 — 아래 단언은 아무것도 안 지킨다');
  return asModule(mutated);
}

/* ══════════ V5 · 입력 생존 — 이게 먼저 빨개져야 나머지가 뜻을 가진다 ══════════ */

test('V5 ★입력 생존 — 「숨은 시안」이 «실재»한다: 앱이 그 표식을 심고, CSS 가 그걸로 숨긴다', () => {
  // ⑴ 앱이 실제로 그 표식을 심는가 (A안=1 · B안=0)
  const VAR = strip(rd('js/section-variation.js'));
  assert.match(VAR, /dataset\.variationActive\s*=\s*'1'/,
    '활성 시안에 1 을 안 심는다 — 이 검사의 전제가 바뀌었다');
  assert.match(VAR, /dataset\.variationActive\s*=\s*'0'/,
    '★비활성 시안에 0 을 안 심는다 — 「숨은 시안」이라는 입력 자체가 없다');

  // ⑵ ★화면이 숨기는 조건 = 우리가 배송에서 빼는 조건. «CSS 에서 읽어» 맞춘다(손으로 적지 않는다)
  const rule = PANELCSS.match(/\.section-block(\[[^\]]+\])\s*\{\s*display:\s*none/);
  assert.ok(rule, '★비활성 시안 숨김 규칙을 css/editor-panels.css 에서 못 찾았다 — 조건이 바뀌었다면 술어도 같이 옮겨라');
  assert.equal(rule[1], HIDDEN_VARIATION_SEL,
    `화면이 숨기는 조건(${rule[1]}) 과 배송에서 빼는 조건(${HIDDEN_VARIATION_SEL}) 이 «다르다» — ` +
    '「보이는 대로 나간다」가 깨진다');
});

/* ══════════ V1 — 배송본(HTML)에 «비활성 시안이 없다» ══════════ */

/** export-html 의 클론에서 「숨은 시안 섹션을 노드째 들어내는가」. 소스를 받아 판정한다. */
function stripsHiddenVariation(src) {
  const importsSel = /import\s*\{[^}]*HIDDEN_VARIATION_SECTION_SEL[^}]*\}\s*from\s*'\.\.\/variation-visibility\.js'/.test(src);
  const removes = new RegExp(
    'clone\\.querySelectorAll\\(\\s*HIDDEN_VARIATION_SECTION_SEL\\s*\\)[\\s\\S]{0,60}?\\.remove\\(\\)').test(src);
  return importsSel && removes;
}

test('V1 ★배송본(HTML)에 비활성 시안이 «없다» — 클론에서 노드째 뺀다', () => {
  assert.equal(stripsHiddenVariation(HTMLSRC), true,
    '★js/io/export-html.js 가 숨은 시안 섹션을 «안» 뺀다 — 받는 사람 화면에 A안·B안이 둘 다 보인다');

  // ★변이 짝 — 뺀 것을 되돌리면(그 줄을 지우면) 반드시 빨강
  const mutated = HTMLSRC.replace(/^.*clone\.querySelectorAll\(\s*HIDDEN_VARIATION_SECTION_SEL[\s\S]*?$/m, '');
  assert.notEqual(mutated, HTMLSRC, '★변이가 주입되지 않았다 — 아래 단언은 아무것도 안 지킨다');
  assert.equal(stripsHiddenVariation(mutated), false,
    '★판정기가 «변이를 못 가른다» — 이 검사는 아무것도 안 지키고 있다');
});

test('V1-b ★빼는 자리는 이미지 재인라인 «앞» — 버릴 섹션을 base64 로 부풀려 넣고 지우지 않는다', () => {
  const iStrip  = HTMLSRC.indexOf('HIDDEN_VARIATION_SECTION_SEL');
  const iInline = HTMLSRC.indexOf('await inlineGoyaAssets(clone)');
  assert.ok(iStrip > 0 && iInline > 0, '두 자리 중 하나를 못 찾았다 — 이름이 바뀌었으면 이 검사도 같이 옮겨라');
  assert.ok(iStrip < iInline,
    '숨은 시안을 «인라인 뒤»에 뺀다 — 버릴 섹션의 이미지까지 읽어 base64 로 실었다가 지우게 된다');
});

/* ══════════ V2 — Figma JSON 에도 없다. ★분모는 «기계»가 센다 ══════════ */

/** 그 파일 안에서 «최상위 섹션을 도는» querySelectorAll 전수를 소스에서 캐낸다.
 *  ⛔자리를 손으로 두 곳 적지 마라 — 세 번째 순회가 생기는 날 조용히 통과한다. */
function sectionSweeps(src) {
  return [...src.matchAll(/querySelectorAll\(\s*([`'"])([^`'"]*)\1/g)]
    .map(m => m[2])
    .filter(sel => sel.includes('.section-block') && sel.includes(':not([data-ghost])'));
}

test('V2 ★Figma JSON 에도 없다 — «섹션을 도는 자리 전수»가 숨은 시안을 제외한다', () => {
  const sweeps = sectionSweeps(FIGSRC);
  // 입력 생존 — 순회를 «찾지도» 못했으면 아래 forEach 는 0번 돌고 초록이다
  assert.ok(sweeps.length >= 2,
    `★섹션 순회를 ${sweeps.length}곳 밖에 못 찾았다 — 파일 저장(exportFigmaJSON)과 업로드` +
    '(buildFigmaExportJSON) 두 자리가 있어야 한다. 순회 모양이 바뀌었으면 이 검사도 같이 옮겨라');

  const leaky = sweeps.filter(sel => !sel.includes('${NOT_HIDDEN_VARIATION}'));
  assert.deepEqual(leaky, [],
    '★이 순회가 숨은 시안을 그대로 싣는다 — 안 고른 시안이 피그마로 한 벌 더 올라간다');
});

test('V2-b ★변이 짝 — «한 자리만» 고치면 빨강이다(두 채널 다 닫혔는지 잰다)', () => {
  const sweeps = sectionSweeps(FIGSRC);
  for (let i = 0; i < sweeps.length; i++) {
    // i 번째 순회에서만 제외절을 걷어낸다
    let seen = 0;
    const mutated = FIGSRC.replace(/querySelectorAll\(\s*`([^`]*)`/g, (whole, sel) => {
      if (!(sel.includes('.section-block') && sel.includes(':not([data-ghost])'))) return whole;
      return (seen++ === i) ? whole.replace('${NOT_HIDDEN_VARIATION}', '') : whole;
    });
    assert.notEqual(mutated, FIGSRC, `★변이 ${i} 가 주입되지 않았다`);
    const leaky = sectionSweeps(mutated).filter(sel => !sel.includes('${NOT_HIDDEN_VARIATION}'));
    assert.equal(leaky.length, 1,
      `★판정기가 «${i}번째 자리만 되돌린» 변이를 못 가른다 — 「한 채널만 닫은」 고침이 통과한다`);
  }
});

/* ══════════ V3 — ★음성대조. «활성» 시안은 그대로 실린다 ══════════ */

test('V3 ★음성대조 — 활성 시안·평범한 섹션은 «안» 걸러진다(다 빼 버리는 고침을 잡는다)', () => {
  const active  = mkEl({ active: 1 });
  const plain   = mkEl({});                      // 시안 아님 — 표식 자체가 없다
  const hidden  = mkEl({ active: 0 });
  const inHidden= mkEl({ parent: hidden });      // 숨은 시안 «안»의 블록

  assert.equal(isHiddenVariationSection(active), false, '★활성 시안(1)이 걸러진다 — 배송본이 빈다');
  assert.equal(isHiddenVariationSection(plain),  false, '★평범한 섹션이 걸러진다 — 배송본이 빈다');
  assert.equal(isHiddenVariationSection(hidden), true,  '숨은 시안(0)을 «못» 가른다');

  assert.equal(isJumpTarget(active),   true,  '★활성 시안이 점프 대상에서 빠진다');
  assert.equal(isJumpTarget(plain),    true,  '★평범한 블록이 점프 대상에서 빠진다');
  assert.equal(isJumpTarget(hidden),   false, '숨은 시안이 점프 대상에 남았다');
  assert.equal(isJumpTarget(inHidden), false, '★숨은 시안 «안»의 블록이 점프 대상에 남았다(실측 실패 5건이 전부 이것)');
  assert.equal(isInHiddenVariation(inHidden), true, 'closest 가 부모를 안 탄다');

  // 셀렉터 모양 — «값을 지정한» 제외절이어야 한다. [data-variation-active] 로 넓히면 활성도 빠진다
  assert.equal(NOT_HIDDEN_VARIATION, `:not(${HIDDEN_VARIATION_SEL})`, '제외절이 술어와 어긋났다');
  assert.equal(HIDDEN_VARIATION_SECTION_SEL, `.section-block${HIDDEN_VARIATION_SEL}`, '섹션 셀렉터가 술어와 어긋났다');
});

test('V3-b ★변이 짝 — 술어를 «무조건 빼는» 쪽으로 넓히면 반드시 빨강', () => {
  // 「값 없이 속성만」 보는 흔한 실수 — 활성 시안(1)까지 숨은 것으로 판정한다
  const M = importMutated(
    `export const HIDDEN_VARIATION_SEL = '[data-variation-active="0"]';`,
    `export const HIDDEN_VARIATION_SEL = '[data-variation-active]';`);
  const active = mkEl({ active: 1 });
  assert.equal(M.isHiddenVariationSection(active), false,
    '(대역 확인) 자기 자신 판정은 값을 보므로 그대로여야 한다');
  assert.equal(M.isJumpTarget(active), false,
    '★변이가 «안 먹혔다» — 그러면 V3 의 음성대조는 아무것도 못 잡는다');
  // ⇒ 진짜 술어에서는 반대여야 한다(V3 가 그것을 단언한다)
  assert.equal(isJumpTarget(active), true, '★진짜 술어가 활성 시안을 거른다 — 배송본·인스펙터가 통째로 빈다');
});

/* ══════════ V4 — ★저장본에는 «남아 있다». 술어를 아는 파일의 «전수»를 기계가 센다 ══════════ */

test('V4 ★저장본은 안 바뀐다 — 숨김 술어를 아는 파일이 «배송·표시» 셋뿐이다', () => {
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (/\.(js|mjs)$/.test(e.name)) files.push(rel);
    }
  })('js');
  assert.ok(files.length > 50, `★js/ 순회가 ${files.length}개 밖에 못 봤다 — 분모가 깨졌다`);

  /* 술어를 «아는» 파일 = 모듈을 import 하거나, 그 조건을 손으로 베낀 파일.
     ⛔손으로 명단을 적지 않는다 — 기계가 전수에서 골라낸다. */
  const knows = files.filter(f => {
    const src = strip(rd(f));
    return src.includes("variation-visibility.js") || src.includes('data-variation-active');
  }).sort();

  assert.deepEqual(knows, [
    'js/inspector.js',
    'js/io/export-figma-json.js',
    'js/io/export-html.js',
    'js/variation-visibility.js',
  ], '★숨김 술어가 «배송·표시» 밖으로 번졌다. 저장 경로(section-serialize·save-load·canvas-state)가 ' +
     '이 조건을 알면 그건 시안을 «숨기는» 게 아니라 «지우는» 것이다. 새 배송 채널이라면 여기 명단과 ' +
     '왜를 같이 갱신해라');

  // ★저장본은 시안을 «기록»한다 — 빠지지 않는다는 것을 반대편에서도 확인한다
  const CANVASSTATE = strip(rd('js/canvas-state.js'));
  assert.match(CANVASSTATE, /variationActive:\s*section\.dataset\.variationActive === '1'/,
    '★저장 스냅샷이 시안 상태를 «안» 적는다 — 저장본에서 시안이 사라진다');
  const SERIALIZE = strip(rd('js/io/section-serialize.js'));
  assert.doesNotMatch(SERIALIZE, /variation/i,
    '★저장 직렬화가 시안을 손대기 시작했다 — 저장본에서 시안이 지워질 수 있다');
});

/* ══════════ J1·J2·J3 — 인스펙터: 세 자리가 «같은 술어»를 본다 ══════════ */

/** inspector.js 안에서 「숨은 시안을 거르는 자리」 셋을 «각각» 판정한다. */
function inspSites(src) {
  const click  = /_jumpTargets\[key\]\s*\|\|\s*\[\]\s*\)\s*\.filter\(\s*isJumpTarget\s*\)/.test(src);
  // statRow: 거른 «그 배열»을 담고, «그 배열»의 길이를 찍는다(개수와 점프가 같은 목록)
  const body = sliceBlock(src, 'const statRow = (key, label, list) =>',
    '개수와 점프가 «같은 목록»을 보는지 재는 자리');
  const stat = /list\s*=\s*\(\s*list\s*\|\|\s*\[\]\s*\)\.filter\(\s*isJumpTarget\s*\)/.test(body)
            && /_jumpTargets\[key\]\s*=\s*list/.test(body)
            && /\$\{list\.length\}/.test(body);
  const color = /\.map\(\s*\(\[hex, els\]\)\s*=>\s*\[hex,\s*\[\.\.\.els\]\.filter\(\s*isJumpTarget\s*\)\]\s*\)/.test(src);
  const collect = /const \$all = \(sel\) => \[\.\.\.document\.querySelectorAll\(sel\)\]\.filter\(\s*isJumpTarget\s*\)/.test(src);
  return { click, stat, color, collect };
}

test('J1·J2 ★세 자리가 «같은 술어»를 본다 — 클릭·개수·색칩', () => {
  const s = inspSites(INSPSRC);
  assert.deepEqual(s, { click: true, stat: true, color: true, collect: true },
    '★인스펙터의 네 자리 중 일부가 숨은 시안을 «안» 거른다 ⇒ 「개수는 9인데 갈 수 있는 건 7」이 된다');

  // ★술어를 «베끼지» 않았다 — 조건이 소스에 손으로 다시 적혀 있으면 한 곳만 고쳐지는 날이 온다
  assert.doesNotMatch(INSPSRC, /data-variation-active/,
    '★인스펙터가 조건을 손으로 베꼈다 — 술어는 js/variation-visibility.js «한 곳»이어야 한다');
  assert.match(INSPSRC, /import \{ isJumpTarget \} from '\.\/variation-visibility\.js'/,
    '공용 술어를 import 하지 않는다');
});

test('J2-b ★변이 짝 — 네 자리 중 «한 곳만» 되돌려도 반드시 빨강', () => {
  const muts = {
    click:   [/\(_jumpTargets\[key\] \|\| \[\]\)\.filter\(isJumpTarget\)/, '(_jumpTargets[key] || []).filter(el => el.isConnected)'],
    stat:    [/list = \(list \|\| \[\]\)\.filter\(isJumpTarget\);/, ''],
    color:   [/\.map\(\(\[hex, els\]\) => \[hex, \[\.\.\.els\]\.filter\(isJumpTarget\)\]\)/, '.map(([hex, els]) => [hex, [...els]])'],
    collect: [/\.filter\(isJumpTarget\);\n\n  const sections/, ';\n\n  const sections'],
  };
  for (const [name, [from, to]] of Object.entries(muts)) {
    const mutated = INSPSRC.replace(from, to);
    assert.notEqual(mutated, INSPSRC, `★변이 「${name}」 가 주입되지 않았다 — 이 칸은 아무것도 안 지킨다`);
    assert.equal(inspSites(mutated)[name], false,
      `★판정기가 「${name}」 변이를 못 가른다 — 그 자리는 사실상 검사되지 않는다`);
  }
});

test('J3 ★음성대조 — 보이는 블록은 여전히 «다» 점프된다(과하게 걸러내는 고침을 잡는다)', () => {
  const visibleSection = mkEl({ active: 1 });
  const list = [
    mkEl({ parent: visibleSection }),   // 활성 시안 안
    mkEl({}),                            // 시안 밖 평범한 블록
    mkEl({ parent: mkEl({}) }),          // 평범한 섹션 안
  ];
  assert.deepEqual(list.filter(isJumpTarget).length, list.length,
    '★보이는 블록이 걸러졌다 — 「아무 데도 못 가는」 인스펙터가 된다');

  // 지워진 블록만 빠진다(원래 계약 — isConnected)
  const gone = mkEl({ connected: false });
  assert.equal(isJumpTarget(gone), false, '지워진 블록이 점프 대상에 남았다');
});
