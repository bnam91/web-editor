/* editing-guard-roster — ★「편집 중 차단」의 ★명부들과 ★★«무엇이 받치나»를 ★기록하는 자
 *
 * ★★왜 있나 — ★2026-10-20 ★하루에 ★두 번 ★같은 실수가 났다(둘 다 ★조정 쪽, 둘 다 ★실측으로 뒤집혔다):
 *   ⑴ 「★Delete 를 누르면 블럭이 지워질 수 있다」  → ⛔안 난다(7/7). 썩은 주석을 믿고 안 쟀다.
 *   ⑵ 「★편집 중 단축키 차단이 그리드·모달·비교·laurel 에 ★전부 안 걸린다」 → ⛔구멍 ★0건.
 *      ★★«명부에 이름이 없다»를 ★«막히지 않는다»로 읽었다.
 *   ⇒ ★★한 뿌리: ★★«소스에 ★이름이 없다» ≠ ★«동작이 없다».
 * ⇒ ★★이 파일이 ★그 혼동을 ★막는다. ★명부의 ★빈칸마다 ★★«무엇이 받치나»를 ★한 줄로 쥐고 있다.
 *
 * ★★이 자가 ★★«잠그는 것»
 *   ⒜ ★명부가 ★어디에 ★몇 개 있나 — ★꼴로 센다(⛔이름 명부 금지 · ⛔줄번호 금지).
 *      ★늘면 빨강 ⇒ ★그때 ★«그 자리를 ★무엇이 받치나»를 ★여기 적어야 통과한다.
 *   ⒝ ★★«받치는 자» ★넷이 ★살아 있나 — ★그것이 ★이 자의 ★★존재 이유다.
 *      ⛔「명부가 같다」만 재면 ★★죽은 초록이 된다. ★받치는 자가 ★사라지면 ★★여기가 먼저 울어야 한다.
 *   ⒞ ★★각 받침마다 ★★«자체 양성대조» — ★그 줄을 ★메모리에서 ★죽여 ★판정이 ★뒤집히나 본다.
 *      (선례 = tests/unit/anchor-signature-ratchet.test.mjs R2 의 ★가상 파일 주입)
 *
 * ⛔⛔이 자가 ★★«못 재는 것» — ★★박아 둔다
 *   ★★«실제로 ★키를 눌러 ★무슨 일이 나나»는 ★여기서 ★못 잰다. ★이건 ★소스 글자만 본다.
 *   ⇒ ★그건 ★DOM/CDP 만 잰다. ★★이 파일이 ★초록이어도 ★「사고가 안 난다」가 ★증명된 것이 ★아니다.
 *   ⇒ ★거꾸로도 참이다 — ★여기가 빨개도 ★「사고가 난다」가 ★아니다. ★★둘을 ★섞지 마라.
 *   ⛔그리고 ★이 자는 ★「명부를 ★합쳐야 한다」를 ★주장하지 ★않는다. ★합치는 판단은 ★사람 몫이다.
 *
 * ⛔닻에 ★매개변수 목록을 적지 마라 · ⛔닻을 ★변수에 담지 마라
 *   (집행 = tests/unit/anchor-signature-ratchet.test.mjs R1/R4 — ★오늘 ★둘 다 밟았다).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(import.meta.url);
const { readSrc } = require_('./_srcread.js');
const ROOT = path.join(__dirname, '..', '..');
const SELF = 'tests/unit/editing-guard-roster.test.mjs';

/* ── ⒜ 명부 census — ★꼴로 센다 ──────────────────────────────────────────
   ★꼴 = `.<무엇>-block.editing` ★토큰. ⛔블럭 이름을 ★손으로 적지 않는다. */
const TOKEN = /\.([a-z0-9-]+)-block\.editing/g;

/** js/ · css/ 전수를 걸어 토큰이 든 «자리»를 모은다(⛔이 검사 파일 자신은 뺀다). */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(f, out); }
    else if (/\.(?:js|css)$/.test(e.name)) out.push(f);
  }
  return out;
}
function census() {
  const sites = [];
  for (const abs of [...walk(path.join(ROOT, 'js')), ...walk(path.join(ROOT, 'css'))]) {
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    if (rel === SELF) continue;
    const src = readSrc(ROOT, rel);
    src.split('\n').forEach((line, i) => {
      const types = [...new Set([...line.matchAll(TOKEN)].map(m => m[1]))].sort();
      if (types.length) sites.push({ file: rel, line: i + 1, types });
    });
  }
  const byFile = {};
  for (const s of sites) (byFile[s.file] ||= []).push(s);
  const union = [...new Set(sites.flatMap(s => s.types))].sort();
  return { sites, byFile, union };
}

/* ★★«지금 이러하다» — ⛔「허용」이 아니다. ★2026-10-20 ★내 손으로 떠서 박았다(⛔남이 준 수 아님).
   ★늘었으면 ★★«그 자리를 무엇이 받치나»를 ★아래 BACKED_BY 에 적고 ★수를 올려라.
   ★줄었으면 ★수를 내려라 — ★그게 이 자의 래칫이다. */
const KNOWN = {
  sites: 45,                 // `.X-block.editing` 토큰이 든 «줄» 수(js+css 전수 · 주석 포함)
                             /* ★44 → 45 (261026 · 지디) — 1020t2d2/1012t1C1 묶음(e0bb4581)이 ★js/editor.js 의 ★⌘F 핸들러에
                                `if (document.querySelector('.text-block.editing')) return;` ★한 줄을 더했다.
                                ★files 는 ★9 그대로다(★그 줄이 ★이미 명부에 있는 파일 안이다 — 내가 재서 확인).
                                ★받침은 ★아래 `js/editor.js` 칸의 ★「⌘ 조합 자리는 각자 다음 줄/같은 줄에 일반검사」가 ★그대로 받는다. */
  files: 9,
  union: ['asset', 'grid', 'icon-text', 'label-group', 'liner', 'modal', 'quote', 'text'],
};

/* ★★KNOWN_GAPS — ★명부마다 ★«빠진 것»과 ★★«무엇이 받치나». ⛔한 줄도 비우지 마라. */
const KNOWN_GAPS = {
  'js/editor.js': {
    빠진것: 'grid · comparison · laurel · quote · liner · asset (합집합 중 이 파일에 없는 것)',
    받침: '★`:2403`(그 keydown 핸들러 ★첫 문장) = activeElement.isContentEditable && !meta && !ctrl → return. '
        + '⌘ 없는 ★모든 키를 ★블럭 종류와 무관하게 막는다 ⇒ 타입 명부는 그 키들에 ★도달 불가. '
        + '＋⌘ 조합 자리는 ★각자 ★다음 줄/같은 줄에 target·activeElement 일반검사가 붙어 있다.'
        + ' ★261026 추가(지디) — ★`:2599` ⌘F(섹션 검색 팔레트)의 `.text-block.editing` 줄도 ★그 꼴이다:'
        + ' ★바로 ★다음 줄이 `INPUT|TEXTAREA|SELECT|isContentEditable` ★일반검사다(내가 소스로 재서 확인)'
        + ' ⇒ ★타입 이름(`.text-block`)이 ★빠져도 ★그 다음 줄이 ★받는다. ⛔이름 명부로 ★닫는 자리가 ★아니다.',
  },
  'js/alt-click-layer-select.js': {
    빠진것: 'text·icon-text·label-group 셋만 적혀 있고 나머지 전부',
    받침: '★그 세 줄 ★다음 줄의 `closest(\'[contenteditable="true"]\')` ★포괄 catch-all.',
  },
  'css/editor-blocks.css': {
    빠진것: 'comparison 은 1020t1a-⑤ 로 들어왔고 · coupon·infocard·innercard 는 ★일부러 뺐다(그 자리 주석에 실측 근거)',
    받침: '⛔★없다 — ★CSS 는 `isContentEditable` 을 ★못 묻는다. ★★여기가 ★«이름이 구조적으로 필요한» ★유일한 명부다. '
        + '(⇒ `:has([contenteditable="true"])` 로 없앨 수 있을지는 ★안 쟀다 — ★별 카드)',
  },
  'js/blocks/line-host.js(줄 글자 편집)': {
    빠진것: '이 파일엔 타입 명부가 ★없다 — 그리드·비교·laurel·버블·챗이 ★한 함수를 공유한다',
    받침: '★`pushHistory` 를 ★편집 ★«시작»에 1회 쌓는다(push-before) ⇒ ⌘Z 가 ★편집 전으로 돌아간다. '
        + '끝낼 때는 dataset 만 쓰고 `scheduleAutoSave` 를 부른다 ⇒ ★이력·저장 둘 다 선다.',
  },
};

test('R0 ★이 자가 ★자기를 세지 않는다(기준값이 자기 오염만큼 부풀지 않게)', () => {
  const c = census();
  assert.equal(c.sites.filter(s => s.file === SELF).length, 0,
    '★이 검사 파일이 ★명부 census 에 들어왔다 — 기준값이 썩는다');
});

test('T0 ★입력이 살아 있다 — 파일을 ★실제로 읽고 토큰을 ★실제로 뽑는다', () => {
  const c = census();
  assert.ok(c.sites.length > 20, `★자리를 ${c.sites.length}개밖에 못 찾았다 — 자가 죽었다(아래가 전부 공회전)`);
  assert.ok(c.union.includes('text'), '★`text` 가 합집합에 없다 — 정규식이 죽었다');
});

test('A1 ★명부 census 가 ★«지금 이러하다»와 같다 (늘면 ★받침을 적어라 · 줄면 ★수를 내려라)', () => {
  const c = census();
  assert.equal(c.sites.length, KNOWN.sites,
    `★자리가 ${c.sites.length}개다(기준 ${KNOWN.sites}).\n`
    + '  ★늘었다면: ★그 자리를 ★«무엇이 받치나»를 ★KNOWN_GAPS 에 적고 수를 올려라.\n'
    + '  ★줄었다면: ★합쳐졌거나 지워진 것이다 — 수를 내려라.');
  assert.equal(Object.keys(c.byFile).length, KNOWN.files, `★파일이 ${Object.keys(c.byFile).length}개다(기준 ${KNOWN.files})`);
  assert.deepEqual(c.union, KNOWN.union, '★합집합이 바뀌었다 — 새 블럭이 편집 명부에 들어왔거나 빠졌다');
});

test('A2 ★KNOWN_GAPS 가 ★장식이 아니다 — ★네 칸이 ★전부 채워져 있다', () => {
  const keys = Object.keys(KNOWN_GAPS);
  assert.ok(keys.length >= 4, `★명부 기록이 ${keys.length}개다 — 넷(editor·alt-click·CSS·line-host)이 최소다`);
  for (const k of keys) {
    const g = KNOWN_GAPS[k];
    assert.ok(g.빠진것 && g.빠진것.length > 5, `★${k} 의 「빠진것」이 비었다`);
    assert.ok(g.받침 && g.받침.length > 20,
      `★${k} 의 「받침」이 비었다 — ★★«무엇이 받치나»를 적지 않으면 ★다음 사람이 「구멍이다」로 읽는다`);
  }
});

/* ── ⒝⒞ ★받치는 자 넷 — ★살아 있나 ＋ ★자체 양성대조 ────────────────────── */

/** 받침 넷의 ★술어. ★같은 술어를 ★원본과 ★«죽인 사본»에 ★둘 다 댄다(그게 양성대조다). */
const BACKED_BY = [
  {
    name: 'B1 ★일반 관문 — keydown 핸들러의 ★첫 문장이 contentEditable 조기 return',
    file: 'js/editor.js',
    /* ★★«첫 문장»까지 잰다 — 뒤로 밀리면 그 사이에 끼는 분기가 ★안 막힌다. */
    pred: (s) => {
      const i = s.indexOf("document.addEventListener('keydown', e => {\n  // contenteditable");
      if (i < 0) return false;
      const head = s.slice(i, i + 420);
      return /if \(document\.activeElement\?\.isContentEditable && !e\.metaKey && !e\.ctrlKey\) return;/.test(head);
    },
    kill: (s) => s.replace(
      'if (document.activeElement?.isContentEditable && !e.metaKey && !e.ctrlKey) return;',
      '/* 양성대조로 죽인 줄 */'),
    why: '★이 줄이 사라지면 ⌘ 없는 키(Delete·방향키·숫자·＋/−·⌥)가 ★편집 중에 ★전역 단축키로 샌다. '
       + '★그때 ★타입 명부에 없는 블럭(그리드·비교·laurel)이 ★처음으로 ★진짜 구멍이 된다.',
  },
  {
    name: 'B2 ★⌥클릭 포괄 catch-all — `[contenteditable="true"]` 조기 return',
    file: 'js/alt-click-layer-select.js',
    pred: (s) => /closest\('\[contenteditable="true"\]'\)\) return null;/.test(s),
    kill: (s) => s.replace("if (t.closest('[contenteditable=\"true\"]')) return null;", '/* 양성대조로 죽인 줄 */'),
    why: '★이 줄이 사라지면 ⌥클릭 레이어 가로채기가 ★타입 셋(text·icon-text·label-group) ★밖의 편집에서 돈다.',
  },
  {
    name: 'B3 ★줄 글자 편집은 ★push-before — 편집 ★시작에 이력 1회',
    file: 'js/blocks/line-host.js',
    pred: (s) => /window\.pushHistory\?\.\('줄 글자 편집'\);/.test(s),
    kill: (s) => s.replace("window.pushHistory?.('줄 글자 편집');", '/* 양성대조로 죽인 줄 */'),
    why: '★이 줄이 사라지면 그리드·비교·laurel·버블·챗의 ★줄 글자 편집이 ★⌘Z 로 안 돌아온다 '
       + '(끝낼 때는 dataset 만 쓰므로 ★어느 쪽도 이력을 쌓지 않는다 · deselectAll 명부에도 그 타입이 없다).',
  },
  {
    name: 'B4 ★CSS 명부는 ★이름이 필요하다 — 아직 `:has()` 로 안 바뀌었다',
    file: 'css/editor-blocks.css',
    /* ★이것은 ★«받침이 없다»를 ★기록하는 자다 — 명부가 ★이름으로 서 있음을 못박는다.
       ★`:has()` 로 바뀌는 날 ★이 칸이 빨개지고, ★그때 KNOWN_GAPS 의 그 줄을 고치면 된다. */
    /* ⛔처음 술어는 `/\.editing[^{]*:has\(/` 였다 — ★남의 규칙을 잡았다:
         `…:not(.editing)…, body.sel-ov #canvas .row:has(> .text-block.selected)` 가 ★한 선택자 목록이라
         `.editing` 과 `:has(` 사이에 `{` 가 ★없다 ⇒ ★거짓 빨강이 났다(★실측 1회).
       ⇒ ★★«그 규칙 하나»로 좁힌다 — 그 토큰부터 ★다음 `{` 까지만 본다.
       ⚠️★그리고 ★배운 것: ★양성대조가 ★통과해도(앵커를 죽이면 뒤집혔다) ★★술어의 ★«범위»가
         ★틀릴 수 있다. ★양성대조는 ★«민감도»를 재고 ★«범위»는 안 잰다. */
    pred: (s) => {
      const i = s.indexOf('.grid-block.selected.editing,');
      if (i < 0) return false;
      const rule = s.slice(i, s.indexOf('{', i));
      return !/:has\(/.test(rule);
    },
    kill: (s) => s.replace('.grid-block.selected.editing,', '.grid-block.selected.editing:has(*),'),
    why: '★CSS 는 `isContentEditable` 을 못 묻는다 ⇒ ★이 명부만은 ★이름이 구조적으로 필요하다. '
       + '★`:has()` 로 바꾸면 ★판정이 달라지는 판이 생긴다(안 쟀다) ⇒ ★그 변경은 ★별 카드다.',
  },
];

for (const b of BACKED_BY) {
  test(`${b.name}`, () => {
    const s = readSrc(ROOT, b.file);
    assert.equal(b.pred(s), true,
      `★받침이 사라졌다 — ${b.file}\n  ★그래서 무슨 일이 나나: ${b.why}\n`
      + '  ⇒ ★이 칸이 빨개진 것은 ★★«명부의 빈칸이 ★처음으로 ★진짜 구멍이 됐다»는 뜻이다.');
  });
  test(`${b.name} — ★★[양성대조] 그 줄을 죽이면 ★빨개지나`, () => {
    const s = readSrc(ROOT, b.file);
    const dead = b.kill(s);
    assert.notEqual(dead, s, '★양성대조가 ★앵커를 못 찾았다 — 이 자는 아무것도 안 잰다(패턴을 갱신하라)');
    assert.equal(b.pred(dead), false,
      '★그 줄을 죽였는데도 ★술어가 ★참이다 ⇒ ★★이 칸은 ★«받침»을 안 재고 있다(죽은 초록)');
  });
}

test('B5 ★받침 넷이 ★서로 ★다른 파일이다 — 한 파일이 무너져도 ★나머지가 보인다', () => {
  const files = BACKED_BY.map(b => b.file);
  assert.equal(new Set(files).size, files.length, '★받침 둘이 같은 파일이다 — 기록이 겹친다');
  for (const f of files) assert.ok(fs.existsSync(path.join(ROOT, f)), `★${f} 가 없다`);
});
