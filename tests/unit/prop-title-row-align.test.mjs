/* prop-title-row-align — 1020t2c1 ★절 머리줄(제목 ＋ 오른쪽 손잡이)의 ★정의 자리를 잠근다.
 *
 * ★px 를 재는 자는 ★DOM 쪽이다: tests/dom/prop-title-row-align.dom.spec.js (D0~D5).
 *   ⇒ ★여기는 ★「고친 ★구조가 그대로 있나」만 본다. ★둘이 ★다른 축을 잰다(소스 ↔ 렌더).
 *
 * ★무엇을 잠그나
 *   T0 전제 — `.prop-section-title` 블록을 ★찾았고 그 안에 `padding:` 이 있다  (⛔못 찾으면 「0건」이 아니라 ★죽는다)
 *   T1 `.prop-section-title-row` 선언이 CSS 에 ★있다                        (★핀 a42d76d5 에서는 ★0건 ⇒ 빨강)
 *   T2 `.prop-section-title-row > .prop-section-title` 의 padding 위 == 아래 (★핀에는 그 규칙 자체가 없다 ⇒ 빨강)
 *   T3 `… > .prop-action-btn { margin-top: 0 }` ★와 ★editor-blocks.css 의 `margin-top: 6px` 를 ★한 쌍으로
 *      ⇒ 6px 가 사라지면 ★이 리셋이 불필요해지므로 ★그때 빨개져 ★사람이 다시 판단한다(⛔조용히 남는 규칙 금지)
 *   T4 마크업 ★5곳이 `class="prop-section-title-row"` 를 쓰고 ★그중 인라인 style 을 쓰는 곳은 ★0 이다
 *      ⇒ ★핀에서는 ★5곳 전부 인라인 style 이 있었다(5건 빨강). ★명부(파일별)를 ★메시지에 싣는다.
 *
 * ★★항등식 방지 — 아래 단언은 ★전부 ★핀 `a42d76d59f45a70eb3ee0e1f68a8ed37650f7565` 에서 ★빨강이었다.
 *   ★음성대조(내 고침을 ★한 글자 깨뜨려 ★이 칸이 빨개지나)는 ★보고 ㉤ 변이 표에 ★수로 적는다.
 * ⛔`tests/fixtures/*.html`(바이트 골든)은 ★분모가 아니다 — 거기 꼴은 typo-section-ssot 가 잰다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

/** CSS 에서 선택자 ★한 벌의 선언 본문을 꺼낸다. 못 찾으면 null (★호출한 쪽이 ★죽인다). */
function ruleBody(css, selector) {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}');
  const m = css.match(re);
  return m ? m[1] : null;
}
/** 선언 본문에서 한 속성값. */
function prop(body, name) {
  const m = body.match(new RegExp('(?:^|;)\\s*' + name + '\\s*:\\s*([^;]+)'));
  return m ? m[1].trim() : null;
}
/** `padding: a b c` → { top, bottom } (css 축약 규칙). */
function padTopBottom(v) {
  const p = v.trim().split(/\s+/);
  if (p.length === 1) return { top: p[0], bottom: p[0] };
  if (p.length === 2 || p.length === 3) return { top: p[0], bottom: p.length === 3 ? p[2] : p[0] };
  return { top: p[0], bottom: p[2] };
}

/* ★제품 마크업에서 title-row 를 쓰는 자리 — ⛔tests/·docs/ 는 제품이 아니라 분모 밖이다. */
const MARKUP_FILES = ['js/props/prop-sticker.js', 'js/props/prop-text-template.js', 'js/effects-registry.js'];

test('T0 ★전제 — `.prop-section-title` 블록을 찾았고 그 안에 padding 이 있다 (⛔못 찾으면 ★죽는다)', () => {
  const css = read('css/editor-props.css');
  const body = ruleBody(css, '.prop-section-title');
  assert.ok(body, '★css/editor-props.css 에서 `.prop-section-title { … }` 를 ★못 찾았다 — ⛔「0건」이 아니라 ★못 잰 것이다(이름이 바뀌었나?)');
  assert.ok(prop(body, 'padding'), `★그 블록에 padding 선언이 없다 — 자가 깨졌다 (본문: ${body.trim()})`);
});

test('T1 `.prop-section-title-row` 선언이 CSS 에 ★있다 (★핀에서는 0건이었다)', () => {
  const css = read('css/editor-props.css');
  const n = [...css.matchAll(/\.prop-section-title-row\b/g)].length;
  assert.ok(n >= 1, `★.prop-section-title-row 가 css/editor-props.css 에 ★0건이다 — 마크업 5곳이 다시 ★인라인 style 을 베끼게 된다(핀 a42d76d5 에서 ★0건이었고 그것이 이 묶음의 ★뿌리였다)`);
});

test('T2 `.prop-section-title-row > .prop-section-title` 의 padding 이 ★위 == 아래 (비대칭이 −2.00px 의 뿌리 R1)', () => {
  const css = read('css/editor-props.css');
  const body = ruleBody(css, '.prop-section-title-row > .prop-section-title');
  assert.ok(body, '★`.prop-section-title-row > .prop-section-title` 규칙이 ★없다 — 제목 상자 중심과 ★글자 중심이 2px 어긋난 채로 돌아간다(핀과 같은 상태)');
  const pad = prop(body, 'padding');
  assert.ok(pad, `★그 규칙에 padding 이 없다 (본문: ${body.trim()})`);
  const { top, bottom } = padTopBottom(pad);
  assert.equal(top, bottom, `★padding 위(${top}) ≠ 아래(${bottom}) — align-items:center 는 ★상자를 맞추므로 제목 ★글자가 (위−아래)/2 만큼 어긋난다. ★참고: 전역 .prop-section-title 은 ${prop(ruleBody(css, '.prop-section-title'), 'padding')} 로 ★일부러 그대로 둔다(절 사이 리듬)`);
});

test('T3 `… > .prop-action-btn { margin-top: 0 }` ★와 `.prop-action-btn { margin-top: 6px }` 를 ★한 쌍으로', () => {
  const props = read('css/editor-props.css');
  const blocks = read('css/editor-blocks.css');
  const reset = ruleBody(props, '.prop-section-title-row > .prop-action-btn');
  assert.ok(reset, '★`.prop-section-title-row > .prop-action-btn` 규칙이 ★없다 — 뿌리 R2(margin-top:6px)가 제목줄에서 단추를 ★3px 내린다');
  assert.equal(prop(reset, 'margin-top'), '0', `★그 리셋의 margin-top 이 0 이 아니다 (${prop(reset, 'margin-top')})`);
  const base = ruleBody(blocks, '.prop-action-btn');
  assert.ok(base, '★css/editor-blocks.css 에서 `.prop-action-btn { … }` 를 ★못 찾았다 — ⛔「0건」이 아니라 ★못 잰 것이다');
  const mt = prop(base, 'margin-top');
  assert.equal(mt, '6px', `★`
    + `.prop-action-btn 의 margin-top 이 ★6px 이 아니다(${mt}) — ★그렇다면 위 리셋은 ★더 이상 필요 없을 수 있다. `
    + `★이 칸이 빨개진 것은 ★「고쳐라」가 아니라 ★「사람이 다시 판단해라」는 뜻이다(⛔조용히 남는 규칙 금지)`);
});

test('T4 마크업 — `class="prop-section-title-row"` 가 ★5곳이고 ★인라인 style 을 쓰는 곳은 ★0 (★핀에서는 5건)', () => {
  /* ⛔`== 5` 로만 닫지 않는다 — 「★명부 ⊇ 실패집합 ＋ ★명부 밖 0건」 꼴로 적는다.
     절이 늘면 ★늘어난 자리를 ★메시지에 ★찍어 사람이 보게 한다(수만 보고 지나치지 않게). */
  const BASE = 5;                       // ★핀 a42d76d5 에서 ★행위로 센 수 (grep -rn 'prop-section-title-row' js/)
  const found = [];
  const withStyle = [];
  for (const f of MARKUP_FILES) {
    const src = read(f);
    for (const m of src.matchAll(/<div class="prop-section-title-row"([^>]*)>/g)) {
      const after = m[1];
      /* 바로 뒤 제목 글자를 같이 집어 ★어느 절인지 이름으로 적는다(⛔줄번호로 가리키지 않는다). */
      const tail = src.slice(m.index, m.index + 260);
      const label = (tail.match(/class="prop-section-title"[^>]*>([^<]{1,40})/) || [, '(제목 못 읽음)'])[1].trim();
      found.push(`${f}«${label}»`);
      if (/style\s*=/.test(after)) withStyle.push(`${f}«${label}»`);
    }
    /* ★제목의 인라인 style 도 같이 본다 — 5곳이 `style="margin-bottom:0"` 를 ★같이 베꼈다. */
    for (const m of src.matchAll(/<div class="prop-section-title"(\s[^>]*)>/g)) {
      if (/style\s*=/.test(m[1])) withStyle.push(`${f} 제목 인라인:${m[1].trim().slice(0, 48)}`);
    }
  }
  assert.ok(found.length >= BASE, `★title-row 자리가 ${found.length}곳 — ★핀에서 센 ${BASE}곳보다 ★줄었다. 절을 지웠나? 명부: ${found.join(' · ')}`);
  assert.deepEqual(withStyle, [], `★인라인 style 이 ${withStyle.length}곳 되살아났다 — ★CSS 한 자리(.prop-section-title-row)로 파생시킨 것이 ★다시 다섯 벌이 된다. 자리: ${withStyle.join(' · ')}`);
  if (found.length > BASE) console.log(`[T4] ★자리가 ${BASE} → ${found.length} 로 늘었다(막지 않는다 · 사람이 보라): ${found.slice(BASE).join(' · ')}`);
});
