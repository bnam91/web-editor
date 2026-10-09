/* U6 — 「캔버스를 클론하는 문」의 명부가 «실물과 맞는가». (2026-09-08 · 2026-09-09 분모 확대)
 *
 * ★이 검사가 막는 것
 *   편집 전용 마커를 벗기는 자리가 흩어져 있어, 「N자리 다 지웠나」로 세면
 *   «N+1번째 문이 생기는 날» 조용히 통과한다. ⇒ 자리를 세지 말고 «문의 명부»를 센다.
 *
 * ★★분모를 기계가 정한다
 *   처음엔 glob 이 js/io/export-* 였고, 그래서 js/panels/template-system.js 가
 *   «구조적으로 안 보였다» — 그 파일은 실제로 마커를 안 벗기고 있었다(2026-09-09 적대 검수).
 *   ⇒ 분모를 «js/ 전역에서 cloneNode(true) 를 쓰는 파일 전수»로 넓혔다.
 *     ⛔손으로 적은 명부는 다음 문을 못 본다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const _req = createRequire(import.meta.url);
const { readSrc, toPosix } = _req('./_srcread.js');
const { makeStripper } = _req('./_strip-comments.js');
const { CHANNELS, MARKER_TOKENS, CLEAN_FN, CLEAN_SELF_FN, AXES, NORM_FN, CARRY_KEYS } = _req('../_export-channels.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const JSDIR = path.join(ROOT, 'js');

/** 주석을 걷어낸 «코드»만. ⛔파일 하나마다 새 stripper(블록 주석 상태를 들고 간다).
 *  이게 없으면 「주석에 적어 둔 함수 이름」을 «호출»로 세어 버린다. */
function codeOf(rel) {
  const strip = makeStripper();
  return readSrc(ROOT, rel).split('\n').map(l => strip(l)).join('\n');
}
const countOf = (src, needle) => src.split(needle).length - 1;

/* ══ ★마커 «덮였나» 판정 — ⛔`readSrc(...).includes(tok)` 를 ★쓰지 마라 ═══════════════
 * ★★2026-10-10 에 ★이 자의 ★흠 ★둘을 고쳤다.
 *   ⒜ ★★«주석만 있어도 초록»이었다 — 날 소스(readSrc)를 봤다. ⇒ ★`codeOf`(주석 떼기)로 바꿨다.
 *      ★★이 레포에서 ★★«주석이 ★소스 파싱 게이트를 ★먹인» 것이 ★★★네 번이다(수로 적는다):
 *        ① html2canvas 세기 ★6→4  ② `!important` 세기 ★1→0  ③ CSS 주석  ④ ★이 자(2026-10-10)
 *      ⇒ ★다음 사람이 ★「왜 주석을 벗기나」를 ★한 줄에 알게 ★여기 적어 둔다.
 *   ⒝ ★★«성질로 묶인 것»을 ★못 봤다 — `grd-cell-selected` 는 `section-serialize.js` 에
 *      ★리터럴로 ★없다. ★RE `/(?:^|-)(?:line|cell)-selected$/` 가 ★잡는다.
 *      ⇒ ★문자열로 묻지 말고 ★★«그 파일을 실행해» `isRuntimeMarker` 에 ★먹인다.
 *        ★★그게 ★이 자리에서 ★유일하게 ★거짓초록·거짓빨강이 ★동시에 없는 ★자다.
 * ⛔`includes` 로 되돌리지 마라 — ⒜ 는 주석 한 줄로, ⒝ 는 성질 묶음 하나로 각각 깨진다. */
const SRC_OF_TRUTH = 'js/io/section-serialize.js';
let _rmCache = null;
/** section-serialize.js 를 «실행해» 세척 자를 꺼낸다(플레인 스크립트 — import 가 없다). */
function runtimeMarkersOf(root) {
  if (_rmCache) return _rmCache;
  const win = {};
  vm.runInNewContext(readSrc(root, SRC_OF_TRUTH), { window: win, document: {} });
  const rm = win.runtimeMarkers;
  assert.ok(rm && typeof rm.isRuntimeMarker === 'function',
    `★${SRC_OF_TRUTH} 가 window.runtimeMarkers 를 안 내놨다 — 아래 마커 판정이 전부 무효다`);
  /* ★자가 살아있나 — 양성·음성 둘 다. ⛔이게 없으면 「전부 덮였다」가 항등식이 된다. */
  assert.equal(rm.isRuntimeMarker('selected'), true, '★양성대조 실패 — 세척 자가 죽었다');
  assert.equal(rm.isRuntimeMarker('zz-not-a-marker-xyz'), false, '★음성대조 실패 — 자가 전부 참을 낸다');
  _rmCache = rm;
  return rm;
}
/** 그 파일이 그 토큰을 «덮나».
 *  ⑴ ★«인용된 토큰»(`'xxx'`)이 주석 뗀 코드에 있나 — classList 인자든 ★한 벌 명부의 원소든
 *  ⑵ ★진실원이면 ★«실행해» 자에 물어본다(RE 로 성질 묶인 것은 리터럴이 ★없다)
 *
 *  ★★⛔`.${tok}`(선택자 문자열) 갈래는 ★★2026-10-10 에 ★없앴다 — ★advqa 가 ★실물로 잡았다.
 *    ★그 갈래가 있으면 ★`querySelectorAll('.item-selected')…classList.remove('item-selected')` 꼴에서
 *    ★★«remove 인자만» 지운 변이를 ★★거짓초록으로 ★통과시킨다
 *    (★선택자 `'.item-selected'` 안에 ★`.item-selected` 가 ★부분문자열로 ★남는다).
 *  ★★⇒ ★★그리고 ★더 깊은 흠이 ★있었다: ★★`||` 로 ★★«선택자 vs remove 인자»(★한 함수 ★안의 ★두 반쪽)를
 *    ★묶은 것. ★★`||` 가 맞는 자리는 ★«제 손 명부 ★vs ★위임 겹»(★파일 ★둘)이다.
 *    ⇒ ★★한 함수 안의 ★두 반쪽은 ★★«검사»로 못 막는다 — ★★«구조»로 막는다:
 *      ★`js/io/capture-safety.js` 의 ★`EDITOR_STATE_CLS` ★한 벌에서 ★선택자와 ★remove 인자를 ★파생시켰다
 *      ⇒ ★★M1(remove 만 뺌)·M3(선택자만 뺌)이 ★★«지을 수 없는 변이»가 됐다. */
function fileCoversToken(root, file, tok) {
  if (countOf(codeOf(file), `'${tok}'`) > 0) return true;        // 인용된 토큰(주석 떼고)
  if (toPosix(file) === SRC_OF_TRUTH) return runtimeMarkersOf(root).isRuntimeMarker(tok);
  return false;
}

/** 함수 «전체»(선언 포함)를 떠낸다 — 그대로 평가해 돌려 볼 수 있게.
 *  ⚠️f(opts = {}) 의 «기본값 중괄호»를 몸통으로 오인하지 않도록 매개변수 괄호를 먼저 닫는다. */
function extractFn(code, name) {
  const m = new RegExp(`function\\s+${name}\\s*\\(`).exec(code);
  if (!m) throw new Error('함수를 못 찾았다: ' + name);
  let i = m.index + m[0].length - 1, d = 0;
  for (; i < code.length; i++) {
    if (code[i] === '(') d++;
    else if (code[i] === ')') { d--; if (d === 0) { i++; break; } }
  }
  while (i < code.length && code[i] !== '{') i++;
  let b = 0;
  for (; i < code.length; i++) {
    if (code[i] === '{') b++;
    else if (code[i] === '}') { b--; if (b === 0) { i++; break; } }
  }
  return code.slice(m.index, i);
}

/** 함수 몸통을 «중괄호 균형»으로 떠낸다. 정규식으로 자르면 안쪽 블록에서 끊긴다. */
function bodyOf(code, head) {
  const i = code.indexOf(head);
  if (i === -1) return '';
  let j = code.indexOf('{', i), depth = 0;
  for (let k = j; k < code.length; k++) {
    if (code[k] === '{') depth++;
    else if (code[k] === '}' && --depth === 0) return code.slice(j, k + 1);
  }
  return code.slice(j);
}

/** 실물 — js/ 아래에서 «DOM 을 통째로 클론하는» 파일 전수. ⛔손으로 적지 않는다. */
function globCloneFiles() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(full); continue; }
      if (!e.name.endsWith('.js')) continue;
      if (fs.readFileSync(full, 'utf8').includes('cloneNode(true)')) {
        out.push(toPosix(path.relative(ROOT, full)));
      }
    }
  })(JSDIR);
  return out.sort();
}

/** 실물 — js/ 아래에서 «캔버스를 파싱해 .section-block 을 도는» 파일 전수.
 *  ★이게 «빠짐» 축의 분모다. cloneNode 분모는 이걸 구조적으로 못 본다(DOMParser 직행이라).
 *  ⛔손으로 적지 않는다 — Figma 채널이 2026-09-09 까지 «등재조차» 안 되던 이유가 그거다. */
function globTraverseFiles() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(full); continue; }
      if (!e.name.endsWith('.js')) continue;
      const src = fs.readFileSync(full, 'utf8');
      if (src.includes('parseFromString') && src.includes('section-block')) {
        out.push(toPosix(path.relative(ROOT, full)));
      }
    }
  })(JSDIR);
  return out.sort();
}

test('U6-0 ★양성대조 — glob 이 실제로 파일을 찾는다 (0건이 «못 잰 것»이 아니다)', () => {
  const found = globCloneFiles();
  assert.ok(found.length >= 10, `js/ 에서 ${found.length}건만 찾았다 — glob 이 죽었다:\n${found.join('\n')}`);
  for (const must of ['js/io/export-image.js', 'js/panels/template-system.js']) {
    assert.ok(found.includes(must), `${must} 를 못 찾는다 — 잣대가 낡았다`);
  }
  assert.ok(CHANNELS.length > 0, '명부가 비었다');
});

test('U6 ★명부 밖 파일이 «0건» — 새로 클론하는 문이 조용히 생기지 않는다', () => {
  const listed = new Set(CHANNELS.map(c => c.file));
  const missing = globCloneFiles().filter(f => !listed.has(f));
  assert.deepEqual(missing, [],
    `${missing.join(' · ')} 가 cloneNode(true) 를 새로 쓴다 — tests/_export-channels.js 명부에 추가해라.\n` +
    `  그 클론이 «저장·배송되는 산출물»이 되면 kind:'artifact' 로 적고 마커 스트립을 붙여라 ` +
    `(window.${CLEAN_FN}?.(clone) 위임이 정답이다). 안 그러면 그 경로로 선택 마커가 «조용히» 샌다.`);
});

test('U6-b ★명부의 파일이 «전부 실재»하고 «왜»가 적혀 있다', () => {
  const KINDS = new Set(['artifact', 'compare', 'transient']);
  for (const c of CHANNELS) {
    assert.ok(fs.existsSync(path.join(ROOT, c.file)), `명부의 ${c.file} 이 없다 — 명부가 낡았다`);
    assert.ok(KINDS.has(c.kind), `${c.file} 의 kind 가 «${c.kind}» 다`);
    assert.ok(typeof c.why === 'string' && c.why.length > 15, `${c.file} 에 «왜»가 없다`);
    /* ★축을 «반드시» 적게 한다 — 「무엇으로 재는지 모르는 채널」이 생기면
       그게 곧 Figma 가 앓던 병이다(명부엔 있는데 어느 축도 안 재는 상태). */
    assert.ok(Array.isArray(c.axes) && c.axes.length > 0, `★${c.file} 에 axes 가 없다 — 무엇으로 재나`);
    for (const a of c.axes) assert.ok(AXES.includes(a), `${c.file} 의 축 «${a}» 은 모르는 축이다`);
  }
});

test('U6-c ★artifact 채널은 마커를 «전부» 벗긴다 (손 열거든 위임이든)', () => {
  /* ★«마커 축»으로 재는 artifact 만. axes 에 marker 가 없는 채널(예: Figma 업로드 —
     클래스가 아니라 JSON 모델을 낸다)에 마커 스트립을 요구하면 거짓 빨강이 된다.
     ⛔대신 그런 채널은 «자기 축»(drop)으로 U6-g 가 잰다 — 축 없이 지나가는 채널은 없다. */
  const arts = CHANNELS.filter(c => c.kind === 'artifact' && c.axes.includes('marker'));
  assert.ok(arts.length >= 4, `artifact 채널이 ${arts.length}건이다 — 명부가 낡았거나 잣대가 죽었다`);
  /* ★분모 단언 — ★«위임 갈래»가 ★적어도 한 번은 ★돈다. ⛔0 이면 아래 위임 검사가 ★항등식이다. */
  const withDeleg = arts.filter(c => (c.delegates || []).length > 0);
  assert.ok(withDeleg.length > 0,
    '★delegates 를 선언한 artifact 채널이 ★0건이다 — 위임 검사가 아무것도 안 돌린다');
  const needDeleg = [], brokenDeleg = [], uncovered = [];
  for (const c of arts) {
    const src = readSrc(ROOT, c.file);
    if (c.strips === CLEAN_FN) {
      /* 위임 — 토큰을 손으로 안 적는 대신 «세척 함수를 부른다»는 것을 확인한다.
         ★그런데 「파일이 그 이름을 갖고 있나」로 재면 «갈래»를 못 센다: 클론이 3곳인데
           위임을 1곳에만 붙여도 초록이다(실측 2026-09-09, 변이 E-1 이 그렇게 빠져나갔다).
         ⇒ «클론 수 ≤ 세척에 «닿는» 호출 수»로 잰다. 모은 사람이 갈래를 세야 한다.

         ★2026-09-09 개정 — «파일 안의 문 하나»(via)를 인정한다.
           옛 잣대는 세척 «호출»만 셌다. 그러면 위임을 한 헬퍼로 모으는 «옳은» 리팩터가
           빨강이 되고, 사람은 같은 줄을 세 번 베끼는 쪽으로 몰린다 — 그게 바로 이 검사가
           막으려던 병(네 번째 문이 생기는 날 한 곳만 빠진다)의 원인이다.
           ⇒ via 를 선언하면 ⑴ 그 함수가 «실제로» 세척을 부르는지 보고 ⑵ 그 함수 호출도 센다.
             via 가 세척을 안 부르면 «허공 위임»이라 여기서 빨강이 난다. */
      const code = codeOf(c.file);
      const clones = countOf(code, 'cloneNode(true)');
      let cleans = countOf(code, `${CLEAN_FN}?.(`) + countOf(code, `${CLEAN_FN}(`)
                 + countOf(code, `${CLEAN_SELF_FN}?.(`) + countOf(code, `${CLEAN_SELF_FN}(`);
      if (c.via) {
        const def = new RegExp(`function\\s+${c.via}\\s*\\(`);
        assert.match(code, def, `★${c.file} 이 via:'${c.via}' 를 선언했는데 그 함수가 «없다» — 명부가 낡았다`);
        /* ★그 문이 세척을 «부르는지»를 «돌려서» 본다.
           ⛔「몸통에 그 이름이 있나」로 재면 안 된다 — 실측(2026-09-09 변이 M3b):
             `const wash = window.serializeCleanSelf || …` 만 남기고 `wash(clone)` 를 지워도
             이름은 그대로 있어 «초록»이었다. 이름은 배선이 아니다.
           ⇒ 가짜 window 에 스파이를 심고 실제로 부른다. DOM 이 필요 없다 —
             이 문은 받은 것을 세척에 넘기는 «배선»일 뿐이라 sentinel 하나면 잡힌다. */
        const viaSrc = extractFn(code, c.via);
        const seen = [];
        const spy = (x) => { seen.push(x); return x; };
        const fakeWin = { serializeCleanRoot: spy, serializeCleanSelf: spy };
        const fn = new Function('window', 'console', `return (${viaSrc});`)(
          fakeWin, { warn() {}, log() {}, error() {} });
        const sentinel = { __sentinel: true, classList: { remove() {} }, getAttribute: () => '',
                           querySelectorAll: () => [] };
        fn(sentinel);
        assert.equal(seen.length, 1,
          `★${c.file} 의 ${c.via} 가 세척(${CLEAN_FN}/${CLEAN_SELF_FN})을 «안 불렀다»(${seen.length}회) — 위임이 허공을 가리킨다`);
        assert.equal(seen[0], sentinel,
          `★${c.file} 의 ${c.via} 가 세척에 «받은 것»을 안 넘긴다 — 엉뚱한 걸 씻고 클론은 그대로 나간다`);
        // 정의 1건은 «호출»이 아니므로 뺀다.
        cleans += Math.max(0, countOf(code, `${c.via}(`) - 1);
      }
      assert.ok(clones > 0, `${c.file} 에 cloneNode(true) 가 0건이다 — 명부가 낡았다(잣대가 죽는다)`);
      assert.ok(cleans >= clones,
        `★${c.file} 의 클론은 ${clones}곳인데 세척에 닿는 호출은 ${cleans}곳뿐이다 — ` +
        `${clones - cleans}곳이 «안 씻긴 채» 산출물이 된다. 클론마다 붙여라.\n  (${c.why})`);
      continue;
    }
    /* ★★«안 돌 수도 있는 자리»를 ★없앴다 (2026-10-10 · `tools/assert-strength` 가 ★잡았다).
       ★옛 꼴은 ★`for (const d of c.delegates || [])` ★안에만 단언이 있었다 ⇒ ★`delegates` 를
       ★지우면 ★★단언이 ★조용히 ★0회가 됐다(★그 자가 ★「0→5」로 ★적발).
       ★★⇒ ★이제 ★★«제 손으로 다 못 벗기면 ★delegates 가 ★반드시 있어야 한다»를
          ★채널마다 ★★무조건 ★단언한다 — ★0회가 ★구조적으로 ★불가하다. */
    const delegFiles = (c.delegates || []).map(d => d.file);
    const miss = MARKER_TOKENS.filter(t => !fileCoversToken(ROOT, c.file, t));
    if (miss.length && !delegFiles.length) needDeleg.push(`${c.file}  ∌ ${miss.join(' · ')}`);
    for (const d of (c.delegates || [])) {
      if (countOf(codeOf(c.file), `${d.entry}(`) === 0) brokenDeleg.push(`${c.file} → ${d.file} ${d.entry}`);
    }
    for (const tok of MARKER_TOKENS) {
      const covered = [c.file, ...delegFiles].some(f => fileCoversToken(ROOT, f, tok));
      if (!covered) uncovered.push(`${c.file}  ∌ ${tok}   (${c.why.slice(0, 60)}…)`);
    }
  }
  /* ★★세 단언이 ★«무조건» 돈다 — ★루프·조건 ★안이 ★아니다 (2026-10-10 · `tools/assert-strength` 가
     「★«안 돌 수도 있는 자리»의 단언 0→5」로 ★적발했다).
     ★옛 꼴은 ★`for (const d of c.delegates || [])` 와 ★`if (…) assert` ★안에 단언이 있었다
     ⇒ ★`delegates` 를 지우거나 ★조건이 거짓이면 ★★단언이 ★조용히 ★0회가 됐다.
     ★★⇒ ★꼴을 ★★«명부 ⊇ 실패집합»으로 바꿨다 — ★실패를 ★모아 ★한 번에 ★견준다.
       ⇒ ★단언 횟수가 ★입력에 ★안 매인다. ⛔다시 ★루프 안으로 ★넣지 마라. */
  assert.deepEqual(brokenDeleg, [],
    `★delegates 를 선언했는데 ★그 겹을 «안 부르는» 채널이 ${brokenDeleg.length}건 — 위임이 허공이다:\n  ` +
    brokenDeleg.join('\n  '));
  assert.deepEqual(needDeleg, [],
    `★제 손으로 마커를 다 안 벗기는데 ★delegates 가 «없는» 채널이 ${needDeleg.length}건:\n  ` +
    needDeleg.join('\n  ') +
    '\n  ⇒ 공용 겹에 위임하면 그 겹을 delegates 로 ★선언해라 — 안 적으면 이 자가 그 갈래를 못 본다');
  assert.deepEqual(uncovered, [],
    `★마커가 ${uncovered.length}자리에서 «안 벗겨진다» — 그 경로의 결과물에 박힌다:\n  ` +
    uncovered.join('\n  ') +
    '\n  ⇒ 제 손 명부에 올리거나, 공용 겹(delegates)에 올려라');
});

test('U6-c-전제 ★위임 대상(serializeCleanRoot/Self)이 실제로 그 토큰들을 벗긴다', () => {
  // 위임을 허용하려면 «위임받는 쪽»이 진짜 하는지 봐야 한다. 안 그러면 U6-c 가 자기통과한다.
  const src = readSrc(ROOT, 'js/io/section-serialize.js');
  for (const fn of [CLEAN_FN, CLEAN_SELF_FN]) {
    assert.match(src, new RegExp(`function ${fn}`), `${fn} 이 거기 없다 — 위임이 허공을 가리킨다`);
  }
  for (const tok of MARKER_TOKENS) {
    /* ⛔`src.includes(tok)` 가 ★아니다 — ★RE 로 ★성질 묶인 토큰은 ★리터럴이 ★없다(2026-10-10 A4). */
    assert.ok(fileCoversToken(ROOT, SRC_OF_TRUTH, tok),
      `★${CLEAN_FN} 이 «${tok}» 을 안 벗긴다 — 위임한 채널이 전부 새고 있다`);
  }
  /* ★root «자신»까지 씻는 판이 정말 root 를 본다 — Root 판은 querySelectorAll 만 써서
     구조적으로 root 자신을 못 본다. Self 판이 그걸 «래퍼»로 뒤집는 게 요점이다. */
  const selfBody = bodyOf(src, `function ${CLEAN_SELF_FN}(`);
  assert.ok(/appendChild\(el\)/.test(selfBody) && selfBody.includes(CLEAN_FN),
    `★${CLEAN_SELF_FN} 이 el 을 래퍼에 넣어 ${CLEAN_FN} 을 돌리지 않는다 — root 자신의 마커가 그대로 남는다`);
});

/* ══ U6-e — compare 채널이 «두 벌 명단»으로 돌아가지 않는다 ═════════════════
 * 되돌리면 빨강: js/market-merge.js 에 const _RUNTIME_CLS = [...] 를 되살리면 → 빨강.
 * ★왜 중요한가: 명단이 두 벌이면 한쪽만 고쳐지는 날이 온다. 실제로 그랬다 — market-merge 의
 *   명단에 두 줄 마커가 없어서, 줄을 «고르기만» 해도 「변경됨」 오탐이 났다(백로그 F2). */
test('U6-e ★compare 채널이 자기 마커 명단을 «따로» 들고 있지 않다', () => {
  for (const c of CHANNELS.filter(x => x.kind === 'compare')) {
    const code = codeOf(c.file);
    assert.ok(!/_RUNTIME_CLS\s*=\s*\[/.test(code),
      `★${c.file} 이 자기 _RUNTIME_CLS 명단을 다시 들고 있다 — 단일 진실원(window.runtimeMarkers)이 갈렸다.\n  (${c.why})`);
    if (c.strips === NORM_FN) {
      /* ★위임 갈래 — 자기 명단을 안 드는 대신 «단일 진실원을 부른다»는 것을 확인한다.
         ⛔「자기 명단이 없다」만 보면 «아무것도 안 씻어도» 초록이다. 부르는지를 봐라. */
      assert.match(code, new RegExp(`\\b${NORM_FN}\\s*\\(`),
        `★${c.file} 이 ${NORM_FN} 을 «안 부른다» — 위임이 허공을 가리킨다.\n  (${c.why})`);
      const owner = CHANNELS.find(x => x.file === 'js/market-merge.js');
      assert.ok(owner && owner.kind === 'compare',
        `★위임 대상 market-merge 가 명부의 compare 채널이 아니다 — 단일 진실원이 사라졌다`);
      continue;
    }
    assert.ok(code.includes('runtimeMarkers'),
      `★${c.file} 이 window.runtimeMarkers 를 «안 읽는다» — 무엇으로 마커를 걷고 있나.\n  (${c.why})`);
  }
});

test('U6-d ★transient 라고 적은 파일이 «결과물»을 만들지 않는다', () => {
  /* 「transient 라고 적어 두면 검사를 빠져나간다」를 막는 잣대.
   *
   * ★★2026-10-10 — ★축을 ★하나 더 뒀다. ★이 잣대가 ★`js/io/save-load.js` 를 ★★놓쳤다:
   *   그 파일의 `captureThumbnail` 은 ★썸네일을 ★`saveProjectMeta` 로 ★`_meta.json` 에 굳혀
   *   ★프로젝트 목록 ★카드에 띄운다 = ★★«사용자가 보는 산출물»인데 ★`transient` 로 적혀 있었고
   *   ★이 잣대는 ★초록이었다.
   * ★★왜 못 봤나 — ★수로 쟀다(2026-10-10 · 그 파일 실측):
   *     outerHTML ★1 · ★`new Blob(` ★0 · saveTemplate ★0 · exportHTML ★0   ⇒ ★초록
   *     ★진짜 산출 경로는 ★`toDataURL` ★1 · ★`html2canvas` ★15
   *   ⇒ ★★옛 잣대는 ★★«HTML 을 굳히는 ★꼴»만 보고 ★★«이미지 산출물»을 ★★구조적으로 ★못 봤다.
   * ★★⇒ ★교훈: ★★★«꼴을 ★열거하는 자는 ★★마지막 사고까지만 ★덮는다».
   *   ⛔그래서 ★이 축을 더해도 ★「이제 전부 덮었다」가 ★아니다 — ★다음 산출 꼴(예: OffscreenCanvas·
   *   `convertToBlob`·WebCodecs)이 생기면 ★여기도 ★또 눈먼다. ★늘 때 ★이 머리말에 ★수로 적어라. */
  const HTML_OUT  = /saveTemplate|exportHTML|new Blob\(/;
  /* ★2026-10-10 추가 축 — ★«이미지를 ★굳히는» 꼴.
     ⚠️★처음엔 ★`saveProjectMeta` 도 ★넣었다가 ★★뺐다 — ★★자가 ★너무 넓었다.
       ★실측: ★`js/branch-system.js:39` 이 ★`saveProjectMeta(activeProjectId, meta)` 를 부르는데
       ★그 meta 는 ★`{branches, currentBranch, updatedAt}` = ★★«브랜치 장부»이고 ★이미지가 ★아니다.
       ⇒ ★★거짓 양성으로 ★★멀쩡한 transient 를 ★빨갛게 했다.
     ★★그리고 ★그 흠을 ★내 ★음성대조(block-factory 하나)가 ★★못 잡았다 —
       ★★«분모 전수»(transient 채널 전부)를 ★먹여서야 ★나왔다.
     ★★⇒ ★교훈: ★자를 ★넓힐 때는 ★★«분모의 ★모든 원소»를 ★먹여라. ★손으로 고른 ★음성 하나로는 ★부족하다.
     ★`toDataURL`·`html2canvas` 는 ★★«그림을 만드는» 자리라 ★이 축에 ★맞다
       (실측: `js/io/save-load.js` 에 ★toDataURL 1 · html2canvas 15). */
  const IMAGE_OUT = /toDataURL|html2canvas/;
  for (const c of CHANNELS.filter(x => x.kind === 'transient')) {
    const src = readSrc(ROOT, c.file);
    const htmlish  = /\.outerHTML\s*\)?\s*;?\s*$/m.test(src) && HTML_OUT.test(src);
    const imageish = IMAGE_OUT.test(src);
    assert.equal(htmlish || imageish, false,
      `${c.file} 은 transient 인데 산출물을 굳히는 모양이다 — 분류가 틀렸다.\n` +
      `  ★HTML 꼴 ${htmlish} · ★이미지 꼴 ${imageish}\n` +
      `  ⇒ 산출물이면 kind:'artifact' ＋ delegates 를 «한 쌍»으로 달아라` +
      `(⛔artifact 만 바꾸면 U6-c 가 4토큰 리터럴을 요구해 «옳은데 빨강»이 된다).\n  (${c.why})`);
  }
});

test('U6-d-전제 ★그 잣대가 «산다» — 알려진 양성을 먹여 본다', () => {
  /* ⛔「transient 0건이 초록」은 ★항등식일 수 있다. ★분모와 ★자를 ★따로 단언한다. */
  const trans = CHANNELS.filter(x => x.kind === 'transient');
  assert.ok(trans.length > 0, '★transient 채널이 0건이다 — U6-d 는 아무것도 안 잰다');
  const IMAGE_OUT = /toDataURL|html2canvas/;
  const HTML_OUT  = /saveTemplate|exportHTML|new Blob\(/;
  /* ★양성대조 — ★artifact 로 옮긴 그 파일을 ★이 자에 먹이면 ★«산출물 꼴»로 ★잡혀야 한다. */
  const saveLoad = readSrc(ROOT, 'js/io/save-load.js');
  assert.equal(IMAGE_OUT.test(saveLoad), true,
    '★양성대조 실패 — js/io/save-load.js 가 «이미지 산출 꼴»로 안 잡힌다(그 축이 죽었다)');
  /* ★음성대조 ★둘 — ⛔하나로는 ★부족했다(2026-10-10 에 ★그래서 거짓 양성을 냈다). */
  const factory = readSrc(ROOT, 'js/block-factory.js');
  assert.equal(HTML_OUT.test(factory) || IMAGE_OUT.test(factory), false,
    '★음성대조 실패 — js/block-factory.js(히트존 노드 교체뿐)가 산출물로 잡힌다 = 자가 너무 넓다');
  /* ★★음성대조 ⑵ — ★`js/branch-system.js` 는 ★`saveProjectMeta` 를 부르지만 ★그 meta 는
     ★«브랜치 장부»(branches·currentBranch·updatedAt)이고 ★이미지가 ★아니다.
     ★★이 한 줄이 ★★내 축이 ★다시 넓어지는 것을 ★막는다 — ★`saveProjectMeta` 를 ★축에 ★되넣으면 ★빨강. */
  const branch = readSrc(ROOT, 'js/branch-system.js');
  assert.equal(IMAGE_OUT.test(branch), false,
    '★음성대조 실패 — js/branch-system.js(브랜치 장부 meta 저장뿐)가 «이미지 산출»로 잡힌다. ' +
    '★`saveProjectMeta` 를 축에 되넣지 마라 — 그건 «그림을 만드는» 자리가 아니다');
});

/* ══ U6-f — «빠짐» 축의 분모. cloneNode 분모가 구조적으로 못 보던 자리 ════════════
 * ★2026-09-09: Figma 업로드는 cloneNode 를 안 쓰고 DOMParser 로 직행한다. 그래서 이 명부에
 *   «등재조차» 안 됐고, 어느 축으로도 안 재졌고, 거기서 38종 중 15종이 빠지고 있었다.
 *   ⇒ 분모를 하나 더 둔다. 캔버스를 파싱해 섹션을 도는 문이 새로 생기면 여기서 빨강. */
test('U6-f ★캔버스를 «순회하는» 문이 전부 명부에 있다 (빠짐 축의 분모)', () => {
  const found = globTraverseFiles();
  assert.ok(found.length >= 5, `순회 파일을 ${found.length}건만 찾았다 — glob 이 죽었다`);
  assert.ok(found.includes('js/io/export-figma-json.js'),
    '★Figma 순회를 못 찾는다 — 잣대가 죽었다(이 검사가 생긴 이유가 그 파일이다)');

  const listed = new Set(CHANNELS.map(c => c.file));
  const missing = found.filter(f => !listed.has(f));
  assert.deepEqual(missing, [],
    `${missing.join(' · ')} 가 캔버스를 파싱해 .section-block 을 돈다 — 명부에 추가해라.\n` +
    `  ★그 순회가 «블록 단위»로 산출물을 지으면 axes 에 'drop' 을 적고 guard 를 붙여라. ` +
    `순회가 못 본 블록은 에러 없이 «빈 껍데기»가 된다.\n` +
    `  섹션 outerHTML 을 통째로 다룰 뿐이면 그 «이유»를 why 에 적어라(빠짐 축 해당 없음).`);
});

/* ══ U6-g — «빠짐» 축 채널은 진짜 검사에 «묶여» 있다 ═══════════════════════════
 * ⛔명부에 'drop' 이라고 적어 두는 것만으로는 아무것도 안 재진다. 그게 이 명부가
 *   앓던 병(축은 있는데 재는 자가 없다)이다. ⇒ 그 자리에 실물 검사가 있는지 본다. */
test('U6-g ★drop 축 채널마다 «실제로 재는 검사»가 있다', () => {
  const drops = CHANNELS.filter(c => c.axes.includes('drop'));
  assert.ok(drops.length >= 1, '★drop 축 채널이 0건이다 — 축이 사라졌다');
  for (const c of drops) {
    assert.ok(c.guard, `★${c.file} 이 drop 축인데 guard(재는 검사)가 없다`);
    const g = path.join(ROOT, c.guard);
    assert.ok(fs.existsSync(g), `★${c.file} 의 guard «${c.guard}» 가 없다 — 축이 허공을 가리킨다`);

    /* ★그 검사가 «분모를 기계로» 세는지까지 본다. 손 명부로 세는 검사는 이 병을 못 막는다 —
       그게 처음에 15종이 새던 이유다. */
    const gsrc = fs.readFileSync(g, 'utf8');
    assert.match(gsrc, /add\[A-Za-z0-9\]\*Block|add\*Block/,
      `★guard ${c.guard} 가 분모를 «기계로» 세지 않는 것 같다 — 손 명부로 세면 다음 블록을 못 본다`);
    assert.ok(/execSync|globby|readdirSync|grep/.test(gsrc),
      `★guard ${c.guard} 가 소스에서 분모를 «뽑지» 않는다 — 명부를 손으로 적고 있다`);
    assert.ok(typeof c.dropDenominator === 'string' && c.dropDenominator.length > 10,
      `★${c.file} 에 dropDenominator(무엇을 분모로 세는가)가 안 적혀 있다`);
  }
});

/* ══ ★★U6-h — ★`carry` 축 (2026-10-10 신설 · 현빈 1009t3-③) ═══════════════════
   ★★왜 — ★이 명부의 축이 ★`marker`·`drop` ★둘이어서 ★★«새 속성·새 CSS 변수가 ★배송물에 ★실리나»가
     ★★어느 축에도 ★안 걸렸다. ★이 파일의 ★명부 머리말이 ★스스로 ★경고한 그 자리다.
   ★★무엇을 재나 = ★★«지워지지 ★않는가». ★실측(2026-10-10): 배송 경로는 ★이름으로만 ★뗀다(★와일드카드 0건)
     ⇒ ★위험은 ★★«누가 ★그 이름을 ★떼는 명단에 ★더하는 날»이다. ★그걸 ★이 칸이 ★잡는다.
   ⛔안 재는 것은 ★`CARRY_KEYS` 머리말에 ★셋으로 적어 뒀다(★행위 미측정 · Figma 공백 · lazy 경로).
   ══════════════════════════════════════════════════════════════════════════ */

test('U6-h ★★carry 축 — ★배송 경로가 ★그 키를 ★떼지 ★않는다', () => {
  const carriers = CHANNELS.filter((c) => c.axes.includes('carry'));
  /* ★★전제 — ★분모가 ★0 이면 ★아래가 ★공회전한다(★그게 ★이 레포가 ★Figma 에서 ★겪은 병이다) */
  assert.ok(carriers.length >= 3, `★carry 채널이 ${carriers.length}건이다 — 명부가 낡았다`);
  assert.ok(CARRY_KEYS.length >= 2, '★CARRY_KEYS 가 비었다 — 잴 것이 없다');
  for (const c of carriers) {
    const code = codeOf(c.file);   /* ★주석을 ★벗긴 뒤 센다 — ⛔주석 속 이름이 ★측정값이 되지 않게 */
    for (const k of CARRY_KEYS) {
      const re = new RegExp(`(removeAttribute|removeProperty)\\(\\s*['"\`]${k.replace(/[-]/g, '\\-')}['"\`]`);
      assert.ok(!re.test(code),
        `★★${c.file} 이 ★«${k}» 를 ★뗀다 — ★그 값은 ★배송물까지 ★가야 한다(carry 축)`);
    }
  }
});

test('U6-h-양성대조 ★★지어낸 «떼는 줄»을 ★자가 ★잡는다 — ⛔없으면 위 초록은 «안 재고 있다»와 같다', () => {
  const k = CARRY_KEYS[0];
  const fake = `  el.removeAttribute('${k}');\n`;
  const re = new RegExp(`(removeAttribute|removeProperty)\\(\\s*['"\`]${k.replace(/[-]/g, '\\-')}['"\`]`);
  assert.ok(re.test(fake), `★자가 ★지어낸 줄을 ★못 잡는다 — ★정규식이 ★죽었다 (${k})`);
  /* ★★음성대조 — ★비슷하지만 ★다른 이름은 ★안 잡아야 한다(★거짓양성이면 ★멀쩡한 코드를 ★막는다) */
  assert.ok(!re.test(`  el.removeAttribute('${k}-other');\n`.replace("'"+k+"-other'", "'"+k+"X'")),
    '★자가 ★다른 이름까지 ★잡는다 — 거짓양성');
});
