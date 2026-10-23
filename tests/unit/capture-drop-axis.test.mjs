/* D1~D5 — ★`drop` 축의 ★클론 채널 자 (2026-10-22 · imac-지디워커 · 설계 = 지디 PLAN-drop-axis-261022)
 *
 * ★무엇을 막나 — PNG·썸네일·단독 HTML 이 ★클론에서 ★요소를 지우는 자리(.remove())가 ★한 줄 늘어도
 *   ★어느 검사도 ★안 빨개졌다. ★`.annotation-block` 이 ★그 명부에 든 채 ★같은 클래스를 쓰는
 *   ★사이즈 스티커(t3-01)가 ★출하됐다 = ★«콘텐츠가 내보내기에서 빠진다»를 ★아무도 ★못 봤다.
 * ★자 — `tests/_export-channels.js` 의 ★DROP_STRIP_ROSTER(지워도 된다고 ★이름·왜로 승인된 선택자).
 *   ⇒ ★지우는 선택자 ⊆ 명부 ⇒ ★초록. ★명부 밖 선택자 ⇒ ★빨강(★그 이름으로).
 *   ⛔«같다(=)»가 아니라 «⊆» — ★지우기를 ★줄이는 것(= 더 많이 싣는 것)은 ★drop 축의 ★실패가 아니다.
 * ⛔안 재는 것 — 머리말이 셋으로 적어 뒀다(`tests/_export-channels.js` DROP_STRIP_ROSTER 위 ⒤ⅱ)ⅲ)).
 * ★양성대조·음성대조는 ★아래 D4·D5 가 ★«같은 판정 함수»에 ★변이를 먹여 잰다 —
 *   ★실파일 변이 ×3 은 ★커밋 메시지에 수로 적었다(⛔이 파일은 실파일을 안 바꾼다). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const _req = createRequire(import.meta.url);
const { fnBody, removedSelectors } = _req('./_clone-removals.js');
const { readSrc } = _req('./_srcread.js');
const { makeStripper } = _req('./_strip-comments.js');
const { CHANNELS, DROP_STRIP_ROSTER, DROP_DESIGN_EXCLUSIONS, editorNodeCanon } = _req('../_export-channels.js');   /* ★editorNodeCanon = D3b(261023) */

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const JSDIR = path.join(ROOT, 'js');
const SHARED = 'js/io/capture-safety.js#stripEditorOnlyForCapture';
const KINDS = new Set(['chrome', 'design', 'open']);

/** 주석 뗀 코드 — ⛔주석 속 `.remove()` 가 측정값이 되지 않게(이 레포에서 주석이 게이트를 먹인 선례 넷). */
function codeOf(rel) {
  const strip = makeStripper();
  return readSrc(ROOT, rel).split('\n').map(l => strip(l)).join('\n');
}

/** 클론 drop 채널마다 «지우는 자리 키» — 제 dropFns ＋ delegates 로 부르는 공용 겹. */
function keysOf(c) {
  const own = (c.dropFns || []).map(fn => `${c.file}#${fn}`);
  const deleg = (c.delegates || []).map(d => `${d.file}#${d.entry}`);
  return [...new Set([...own, ...deleg])];
}

/** ★★판정 함수 «하나» — D3 실판 · D4 양성대조 · D5 음성대조가 ★같은 것을 부른다.
 *  src(key) → 주석 뗀 코드 · roster → 승인 명부. 돌려주는 것 = 실패 줄 배열(빈 배열 = 초록). */
export function judgeDrop(channels, src, roster, blockClasses) {
  const fails = [];
  for (const c of channels) {
    for (const key of keysOf(c)) {
      const [file, fn] = key.split('#');
      const body = fnBody(src(file), fn);
      if (!body) { fails.push(`${c.file} → ${key} ★함수가 없다 — 명부가 낡았다`); continue; }
      const { sels } = removedSelectors(body);
      const ok = new Map((roster[key] || []).map(e => [e.sel, e]));
      for (const s of sels) {
        const e = ok.get(s);
        if (!e) { fails.push(`${c.file} → ${key} ∌roster ${s}`); continue; }
        const cls = /^\.([a-z0-9-]+)$/.exec(s);
        if (cls && blockClasses.has(cls[1]) && e.kind === 'chrome')
          fails.push(`${c.file} → ${key} ★블럭 클래스 ${s} 를 'chrome' 으로 적었다 — 'design'·'open' 과 왜를 적어라`);
      }
    }
  }
  return fails;
}

/** 분모 ⑵ — js/ 전역 «className = '…' / classList.add('…'» 리터럴의 첫 토큰 중 «-block» 으로 끝나는 것.
 *  ⚠️한계: 여러 클래스 문자열의 «첫 토큰»만 · 템플릿 안의 class="…" 는 안 센다. */
function globBlockClasses() {
  const out = new Set();
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(full); continue; }
      if (!e.name.endsWith('.js')) continue;
      const src = fs.readFileSync(full, 'utf8');
      for (const m of src.matchAll(/(?:className\s*=\s*['"`]|classList\.add\(\s*['"])([a-z0-9-]*-block)\b/g)) out.add(m[1]);
    }
  })(JSDIR);
  return out;
}

const DROP_CLONE = CHANNELS.filter(c => c.axes.includes('drop') && c.dropFns);
const _cache = new Map();
const realSrc = (f) => { if (!_cache.has(f)) _cache.set(f, codeOf(f)); return _cache.get(f); };
const BLOCKS = globBlockClasses();

test('D0 ★분모가 산다 — 클론 drop 채널 넷 · 블럭 클래스 분모 · 공용 겹', () => {
  assert.deepEqual(DROP_CLONE.map(c => c.file).sort(),
    ['js/io/capture-safety.js', 'js/io/export-html.js', 'js/io/export-image.js', 'js/io/save-load.js'],
    '★클론 drop 채널이 넷(PNG·썸네일·단독 HTML·공용 겹)이 아니다 — 명부가 바뀌었으면 이 줄도 같이');
  assert.ok(BLOCKS.size >= 30, `★블럭 클래스 분모가 ${BLOCKS.size} 다 — glob 이 죽었다`);
  for (const k of ['annotation-block', 'qa-block', 'grid-block', 'text-block']) assert.ok(BLOCKS.has(k), `★분모에 ${k} 가 없다 — 정규식이 죽었다`);
  /* ★㉣ 소비자 셋 — 셋 다 ★공용 겹을 ★부른다(주석 떼고). ⛔안 부르면 공용 명부가 그 채널을 ★안 덮는다 */
  for (const f of ['js/io/export-html.js', 'js/io/export-image.js', 'js/io/save-load.js']) {
    assert.ok(/stripEditorOnlyForCapture\s*\(/.test(realSrc(f).replace(/function\s+stripEditorOnlyForCapture/g, '')),
      `★${f} 가 공용 겹 stripEditorOnlyForCapture 를 ★안 부른다`);
    assert.ok(keysOf(CHANNELS.find(c => c.file === f)).includes(SHARED), `★${f} 의 delegates 에 공용 겹이 없다`);
  }
});

test('D1 ★명부의 칸마다 kind·why 가 있다 · 설계 제외 표 넷', () => {
  for (const [key, list] of Object.entries(DROP_STRIP_ROSTER)) {
    assert.ok(list.length > 0, `★${key} 명부가 비었다`);
    const seen = new Set();
    for (const e of list) {
      assert.ok(KINDS.has(e.kind), `★${key} ${e.sel} 의 kind «${e.kind}»`);
      assert.ok(typeof e.why === 'string' && e.why.length > 5, `★${key} ${e.sel} 에 왜가 없다`);
      assert.ok(!seen.has(e.sel), `★${key} 에 ${e.sel} 가 두 번 — 명부가 두 벌이 된다`);
      seen.add(e.sel);
    }
  }
  assert.deepEqual(DROP_DESIGN_EXCLUSIONS.map(x => x.id).sort(),
    ['MEMO-EXCLUDED-BY-DESIGN-01', 'PARTICLE-EXCLUDED-BY-DESIGN-01', 'PLACEHOLDER-EXCLUDED-BY-DESIGN-01', 'QA-EXCLUDED-BY-DESIGN-01']);
});

test('D2 ★파서가 지우기 «전부»를 읽는다 — 몸통의 .remove() 수 = forEach 안에서 잡은 수', () => {
  let walked = 0;
  for (const c of DROP_CLONE) for (const key of keysOf(c)) {
    const [file, fn] = key.split('#');
    const body = fnBody(realSrc(file), fn);
    assert.ok(body, `★${key} 함수가 없다`);
    const r = removedSelectors(body);
    assert.equal(r.covered, r.total,
      `★${key} 에 ★파서가 못 읽는 지우기 꼴이 ${r.total - r.covered} 곳 — ★querySelectorAll(…).forEach(el => el.remove()) 꼴로 쓰거나 파서를 넓혀라`);
    walked++;
  }
  assert.ok(walked >= 6, `★잰 자리가 ${walked} 곳 — 분모가 줄었다`);
  /* ★파서 자가시험 — ★지어낸 몸통(꼴 넷: 리터럴 여럿 · ?. · 식별자 · 블록 콜백)을 ★다 읽나.
     ⛔실판 수(2026-10-22 dc93370e 판 공용 겹 = 9종)를 ★바닥으로 박지 않는다 — 지우기를 ★줄이는 «옳은» 변경이 빨개진다. */
  const fx = removedSelectors(`{ a.querySelectorAll('.x, .y').forEach(el => el.remove());
    a.querySelectorAll?.('.z').forEach(el => el.remove());
    a.querySelectorAll(SEL).forEach(el => el.remove());
    a.querySelectorAll('.q').forEach(el => { const r = el.closest('.row'); if (r) r.remove(); else el.remove(); });
    a.querySelectorAll('.keep').forEach(el => el.classList.remove('keep')); }`);
  assert.deepEqual(fx.sels, ['.x', '.y', '.z', '$SEL', '.q'], '★파서가 지어낸 꼴을 못 읽는다');
  assert.equal(fx.covered, 5); assert.equal(fx.total, 5);
});

test('D3 ★★실판 — 지우는 선택자 ⊆ 승인 명부 (★한 줄 늘리면 ★그 이름으로 빨강)', () => {
  const fails = judgeDrop(DROP_CLONE, realSrc, DROP_STRIP_ROSTER, BLOCKS);
  assert.deepEqual(fails, [],
    `★클론에서 ★승인 안 된 요소 지우기 ${fails.length} 건 — ★그 블럭이 ★내보내기에서 빠진다:\n  ` + fails.join('\n  ') +
    '\n  ⇒ ★콘텐츠면 지우지 마라 · ★편집 UI 면 tests/_export-channels.js DROP_STRIP_ROSTER 에 ★kind·왜를 적어라');
});

/* ══════════════════════════════════════════════════════════════════════
   D3b — ★★«출처별 승인»이 ★비운 ★자리를 ★메우는 자. ★261023 신설(R1 처방과 ★한 쌍).
   ★까닭 : D3 의 승인 명부에 ★`$NON_CONTENT_UI_SELECTOR` ★한 줄이 들어왔다(출처 ★전체 승인).
     ★★그 꼴은 `judgeDrop` 의 ★`kind` 교차검사를 ★비킨다 —
       그 검사는 `/^\.([a-z0-9-]+)$/` 로 ★«클래스 하나»만 보고, ★`$…` 는 ★안 걸린다.
     ⇒ ★★★그러니 ★그 상수에 ★«블럭 클래스»가 ★섞여 들어오면 ★★아무도 ★안 잡는다 —
       ★그건 ★★«콘텐츠 블럭이 ★내보내기에서 ★통째로 ★빠진다»는 뜻이다(이 축이 ★막으려던 ★그것).
   ⇒ ★이 칸이 ★그 자리를 ★★직접 ★잰다.
   ══════════════════════════════════════════════════════════════════════ */
test('D3b ★★저장 정본 상수에 ★«블럭 클래스»가 ★없다 — ★출처별 승인이 ★비운 kind 검사 자리', (t) => {
  const NCKEY = 'js/io/editor-ui-roster.js#NON_CONTENT_UI_SELECTOR';
  const canon = editorNodeCanon(ROOT);
  const nc = canon.by[NCKEY];
  assert.ok(Array.isArray(nc) && nc.length >= 20, `★정본 상수를 못 읽었다(${nc ? nc.length : 'null'}종) — 자가 눈멀었다`);
  /* ★양성대조 — ★이 자가 ★정말 ★블럭 클래스를 ★알아보나. ⛔없으면 ★아래 「0건」이 ★«안 쟀다»다. */
  assert.ok(BLOCKS.size > 5, `★블럭 클래스 분모가 ${BLOCKS.size} 다 — 분모가 비면 아래가 ★항등으로 초록`);
  assert.ok(BLOCKS.has('section-block'), '★양성 — 분모에 section-block 이 없다. 분모 자가 죽었다');
  const bad = nc.filter(s => { const m = /^\.([a-z0-9-]+)$/.exec(s); return m && BLOCKS.has(m[1]); });
  assert.deepEqual(bad, [],
    `★★저장 정본 상수에 ★«블럭 클래스» ${bad.length} 종이 들어 있다: ${bad.join(' ')}\n` +
    `  ⇒ ★캡처 겹이 ★그 상수를 ★읽으므로 ★그 블럭이 ★PNG·썸네일·단독 HTML 에서 ★통째로 ★빠진다.\n` +
    `  ⇒ ★콘텐츠면 ★그 상수에서 ★빼라 · ★편집 UI 인데 ★-block 으로 끝나는 이름이면 ★DROP_STRIP_ROSTER 에 ★종별로 ★'design'·'open' ＋ 왜를 적어라`);
  t.diagnostic(`정본 상수 ${nc.length}종 · 블럭 클래스 분모 ${BLOCKS.size}종 · 겹침 ${bad.length}`);
});

/* ── 변이 — ★같은 판정 함수에 ★지어낸 판을 먹인다 ─────────────────────────────── */
const mutSrc = (file, fn) => (f) => (f === file ? fn(realSrc(f)) : realSrc(f));
/** 공용 겹 «몸통 안»의 선택자 리터럴에서 sel 하나를 뺀다(⛔몸통 밖은 안 건드린다). 실판 상태에 ★안 매인다. */
function withoutSel(code, sel) {
  const body = fnBody(code, 'stripEditorOnlyForCapture');
  const cut = body.replace(/(['"`])([^'"`]*)\1/g, (m, q, inner) => {
    const parts = inner.split(',').map(x => x.trim());
    return parts.includes(sel) ? q + parts.filter(x => x !== sel).join(', ') + q : m;
  });
  return code.replace(body, cut);
}
const ADD = (sel) => (code) => {
  const body = fnBody(code, 'stripEditorOnlyForCapture');
  return code.replace(body, body.replace(/^\{/, `{\n  clone.querySelectorAll('${sel}').forEach(el => el.remove());`));
};
const minusRoster = (sel) => ({ ...DROP_STRIP_ROSTER, [SHARED]: DROP_STRIP_ROSTER[SHARED].filter(e => e.sel !== sel) });

test('D4 ★★양성대조 — ★.annotation-block 을 «뺀 판»에 ★«되돌려 넣으면» 빨강 · ★소비자 넷 전부 · ★이름까지', () => {
  /* 뺀 판 = 지우기에서도 · 명부에서도 없음 ⇒ ★초록이어야 한다(바탕이 깨끗해야 아래 빨강이 «그 한 줄» 탓이다) */
  const baseOf = (f) => withoutSel(realSrc(f), '.annotation-block');
  const baseSrc = mutSrc('js/io/capture-safety.js', s => withoutSel(s, '.annotation-block'));
  const baseRoster = minusRoster('.annotation-block');
  assert.ok(!removedSelectors(fnBody(baseOf('js/io/capture-safety.js'), 'stripEditorOnlyForCapture')).sels.includes('.annotation-block'), '★뺀 판에 아직 있다 — 변이가 안 먹었다');
  assert.deepEqual(judgeDrop(DROP_CLONE, baseSrc, baseRoster, BLOCKS), [], '★뺀 판이 초록이 아니다 — 바탕이 더럽다');
  /* 되돌려 넣은 판 = 지우기에만 다시 있음(명부엔 없음 — 그날처럼) */
  const fails = judgeDrop(DROP_CLONE, mutSrc('js/io/capture-safety.js', s => ADD('.annotation-block')(withoutSel(s, '.annotation-block'))), baseRoster, BLOCKS);   // = 아래 readded
  assert.deepEqual(fails.sort(), [
    `js/io/capture-safety.js → ${SHARED} ∌roster .annotation-block`,
    `js/io/export-html.js → ${SHARED} ∌roster .annotation-block`,
    `js/io/export-image.js → ${SHARED} ∌roster .annotation-block`,
    `js/io/save-load.js → ${SHARED} ∌roster .annotation-block`,
  ], '★공용 한 줄이 ★넷 다 빨강이 아니다');
  /* ★블럭 클래스를 chrome 으로 숨기기 ⇒ 빨강 */
  const readded = mutSrc('js/io/capture-safety.js', s => ADD('.annotation-block')(withoutSel(s, '.annotation-block')));
  const lie = { ...baseRoster, [SHARED]: [...baseRoster[SHARED], { sel: '.annotation-block', kind: 'chrome', why: '지어낸 거짓 칸' }] };
  assert.equal(judgeDrop(DROP_CLONE, readded, lie, BLOCKS).filter(l => l.includes("★블럭 클래스 .annotation-block 를 'chrome'")).length, 4);
  /* ★새 블럭 한 줄(공용 겹) ⇒ 그 이름으로 빨강 */
  const grow = mutSrc('js/io/capture-safety.js', ADD('.grid-block'));
  assert.equal(judgeDrop(DROP_CLONE, grow, DROP_STRIP_ROSTER, BLOCKS).filter(l => l.endsWith('∌roster .grid-block')).length, 4);
});

test('D5 ★음성대조 — ★.annot-preview 가 «빠져도»(지우기에서 없애도) 빨강이 아니다 · 설계 제외', () => {
  /* 바탕 = D4 의 «뺀 판»(실판 상태에 안 매인다) · 거기서 .annot-preview 도 지우기에서 뺀다 */
  const src = mutSrc('js/io/capture-safety.js', s => withoutSel(withoutSel(s, '.annotation-block'), '.annot-preview'));
  assert.ok(!removedSelectors(fnBody(src('js/io/capture-safety.js'), 'stripEditorOnlyForCapture')).sels.includes('.annot-preview'), '★변이가 안 먹었다');
  assert.deepEqual(judgeDrop(DROP_CLONE, src, minusRoster('.annotation-block'), BLOCKS), []);
  assert.equal(DROP_STRIP_ROSTER[SHARED].find(e => e.sel === '.annot-preview')?.kind, 'design');
});
