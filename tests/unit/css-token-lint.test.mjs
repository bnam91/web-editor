/* css-token-lint.test.mjs — 1009t3 ⑥ «우리판 CSS 토큰 린터»의 자기검사.
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"   (= npm test)
 *
 * ★이 파일이 하는 일은 하나다 — **그 자를 일부러 깨뜨려서, 정말로 빨개지는지 본다.**
 *   ⛔「만들었다」는 근거가 아니다. 「가드를 끄니 잡더라」만 근거다.
 *   선례: tests/unit/assert-strength.test.mjs (같은 꼴).
 *
 * ★★처음 세운 대조 10칸은 두 가드를 ★놓쳤다(2026-10-10):
 *     「제안 패밀리 거르개 off」·「주석 벗기기 off」가 ★10칸 전부 초록이었다.
 *   ⇒ 그래서 이 파일은 «칸을 세는» 검사가 아니라 ★«무력화 묶음»을 세는 검사다.
 *     가드를 끄는 변이를 돌려, ★각 변이가 ★최소 한 칸을 ★빨갛게 만드는지 본다.
 *
 * ⛔표본은 «합성»이다 — 「레포에 이런 꼴이 있어야 한다」를 전제로 걸지 않는다.
 *   그렇게 걸면 그 꼴을 고쳐 없앨수록 이 검사가 빨개진다.
 *   단 ★표본의 «값»은 레포의 산 토큰에서 끌어온다 — 손으로 박으면 토큰 값이 바뀐 날
 *   이 검사가 «조용히» 아무것도 안 재게 된다.
 *
 * ⛔git 을 안 부른다 — 범위(diff)는 Set 을 ★직접 넘겨 흉내 낸다. 그래서 이 검사는
 *   어느 판에서 돌려도 같은 값이 나오고, HEAD 가 움직여도 안 흔들린다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import cp from 'child_process';
import { fileURLToPath } from 'url';
import {
  blankCssNoise, blankExemptSpans, scanDeclarations, makeLineIndex,
  collectRootTokens, resolveTokens, buildMaps, isSuggestable, normHex,
  lintCss, renderFinding, selfCheck, deriveBase, scanIntegrity, integrityReport,
  collectKnownVarNames, unknownVarAt,
} from '../../tools/css-token-lint.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../../');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

/* ── 합성 토큰 명부 — 이 검사가 쓰는 모든 값의 ★출처 ────────────────────── */
const FAKE_CSS = `:root {
  --p-ink-900: #2a2a2a;
  --ui-bg-input: #2a2a2a;
  --bg-input: var(--p-ink-900);
  --ui-radius-sm: 4px;
  --ui-fs-12: 12px;
  --ui-btn-h: 24px;
  --goya-checker-big-a: #d8d8d8;
  --preset-label-color: #ffffff;
}`;
function fakeMaps() {
  const { defs } = collectRootTokens(['fake.css'], () => FAKE_CSS);
  const resolved = resolveTokens(defs);
  return { maps: buildMaps(resolved), resolved, defs };
}

test('부품: 주석·문자열을 빈칸으로 바꾸고 «길이와 줄 구조»를 보존한다', () => {
  const src = 'a{/* x */color:red}\nb{content:"/* no */"}\n';
  const out = blankCssNoise(src);
  assert.equal(out.length, src.length, '길이가 달라지면 file:line:col 이 어긋난다');
  assert.equal(out.split('\n').length, src.split('\n').length);
  assert.ok(!out.includes('/*'), '주석 열기표가 남았다');
  assert.ok(out.includes('color:red'), '주석 밖 코드를 삼켰다');
  // ⛔CSS 엔 `//` 줄 주석이 없다 — 지우면 url(http://…) 을 삼킨다
  const u = blankCssNoise('a{background:url(http://x/y.png)}');
  assert.ok(u.includes('http://x/y.png'), '`//` 를 줄 주석으로 읽었다');
});

test('부품: url( … ) 과 var( … ) 괄호 안을 면제한다 — 중첩 괄호까지', () => {
  const v = blankExemptSpans(' var(--a, var(--b, #2a2a2a)) #333333 url("#444444") ');
  assert.ok(!v.includes('#2a2a2a'), 'var() 중첩 대체값이 안 면제됐다');
  assert.ok(!v.includes('#444444'), 'url() 안이 안 면제됐다');
  assert.ok(v.includes('#333333'), 'var/url 밖의 리터럴을 삼켰다');
});

test('부품: 선택자 텍스트는 선언으로 안 담는다 — `#canvas` 를 색으로 읽는 길을 ★구조로 막는다', () => {
  const d = scanDeclarations(blankCssNoise('#canvas .x{color:red}'));
  assert.deepEqual(d.map((x) => x.prop), ['color']);
});

test('부품: offset → line/col 이 1-based 로 맞는다', () => {
  const src = 'ab\ncde\nf';
  const at = makeLineIndex(src);
  assert.deepEqual(at(0), { line: 1, col: 1 });
  assert.deepEqual(at(3), { line: 2, col: 1 });
  assert.deepEqual(at(5), { line: 2, col: 3 });
  assert.deepEqual(at(7), { line: 3, col: 1 });
});

test('부품: hex 정규화 — 3·4·8자리와 대문자를 한 열쇠로 모은다', () => {
  assert.equal(normHex('#ABC'), '#aabbcc');
  assert.equal(normHex('#2A2A2A'), '#2a2a2a');
  assert.equal(normHex('#2a2a2aff'), '#2a2a2a', 'alpha=ff 는 6자리와 같은 색이다');
  assert.notEqual(normHex('#2a2a2a80'), '#2a2a2a', '반투명을 불투명과 섞으면 틀린 제안을 한다');
});

test('명부: «정의 자리»에서만 센다 — :root 밖 정의는 제안 대상이 아니다', () => {
  const src = `:root{--ui-bg-input:#2a2a2a}\n.local{--mine:#123456}\n.use{color:var(--ui-bg-input)}`;
  const { defs, nonRootCount } = collectRootTokens(['x.css'], () => src);
  assert.deepEqual(defs.map((d) => d.name), ['--ui-bg-input']);
  assert.equal(nonRootCount, 1);
  // ⛔사용 자리 grep 으로 세면 --ui-bg-input 을 ★두 번 센다 — 그 길을 안 쓴다는 단언
  assert.equal((src.match(/--ui-bg-input/g) || []).length, 2);
});

test('명부: var() 사슬을 리터럴까지 푼다 (--bg-input → --p-ink-900 → #2a2a2a)', () => {
  const { resolved } = fakeMaps();
  assert.equal(resolved.get('--bg-input'), '#2a2a2a');
});

test('제안 패밀리: --ui-* 와 semantic 만. --p-* --preset-* --goya-* 는 ★아니다', () => {
  for (const n of ['--ui-bg-input', '--color-accent', '--bg-input', '--border-default', '--text-sub']) {
    assert.ok(isSuggestable(n), `${n} 이 제안 대상에서 빠졌다`);
  }
  for (const n of ['--p-ink-900', '--preset-label-color', '--goya-checker-big-a', '--gdt-padhint-hex', '--cv-chip-size']) {
    assert.ok(!isSuggestable(n), `${n} 을 「이걸 쓰라」고 권하면 틀린다`);
  }
});

test('표: px 는 «(property, 값)» 짝으로만 맞는다 — 24px(--ui-btn-h)는 표에 ★없다', () => {
  const { maps } = fakeMaps();
  assert.deepEqual(maps.length.get('border-radius|4px'), ['--ui-radius-sm']);
  assert.deepEqual(maps.length.get('font-size|12px'), ['--ui-fs-12']);
  assert.equal(maps.length.get('padding|4px'), undefined, 'padding 4px 를 radius 로 권하면 틀린다');
  assert.equal(maps.length.get('font-size|4px'), undefined);
  assert.equal(maps.length.get('height|24px'), undefined, '--ui-btn-h 는 일부러 표에 안 넣었다');
  assert.equal(maps.color.get('#d8d8d8'), undefined, '지역 전용 토큰이 색 표에 샜다');
  assert.equal(maps.color.get('#ffffff'), undefined, '--preset-* 가 색 표에 샜다');
});

/* ══ 양성 / 음성 / 범위밖 ═══════════════════════════════════════════════ */
const SAMPLE = [
  /*1*/ '.a{background:#2a2a2a}',
  /*2*/ '.b{border-radius:4px}',
  /*3*/ '.c{font-size:12px}',
  /*4*/ '.d{background:var(--ui-bg-input)}',
  /*5*/ '.e{background:#ff00ff;font-size:37px}',
  /*6*/ '.f{background:#2a2a2a}',
].join('\n');

test('양성: 토큰이 있는 하드코딩을 ★잡고, 문구에 ★토큰 이름을 박는다', () => {
  const { maps } = fakeMaps();
  const got = lintCss(SAMPLE, new Set([1, 2, 3, 4, 5]), maps);
  assert.deepEqual(got.map((f) => `${f.line}:${f.literal}`), ['1:#2a2a2a', '2:4px', '3:12px']);
  const msg = renderFinding('s.css', got[0]);
  assert.match(msg, /var\(--ui-bg-input\)/, '에러 문구에 토큰 이름이 없으면 이 자의 절반이 죽는다');
  assert.match(msg, /var\(--bg-input\)/, '사슬로 닿는 semantic 토큰도 같이 보여야 한다');
  assert.ok(!msg.includes('--p-ink-900'), 'primitive 를 권하면 2단 계층을 무너뜨린다');
  // `.a{background:#2a2a2a}` — `#` 는 15번째 글자다(1-based). ⛔이 수는 ★세어서 적었다
  assert.equal(SAMPLE.split('\n')[0].indexOf('#') + 1, 15);
  assert.match(msg, /^s\.css:1:15 /, '자리(file:line:col)가 틀리면 에이전트가 못 고친다');
});

test('음성: 이미 var(--x) 를 쓰는 줄은 ★초록', () => {
  const { maps } = fakeMaps();
  assert.equal(lintCss(SAMPLE, new Set([4]), maps).length, 0);
});

test('토큰없음: 토큰이 없는 값은 ★조용히 지나간다 — ⛔경고도 안 낸다', () => {
  const { maps } = fakeMaps();
  assert.equal(lintCss(SAMPLE, new Set([5]), maps).length, 0);
});

test('★범위밖: 1행과 ★한 글자도 안 다른 6행을 범위 밖에 두면 ★안 잡는다', () => {
  const { maps } = fakeMaps();
  const l1 = SAMPLE.split('\n')[0], l6 = SAMPLE.split('\n')[5];
  assert.equal(l1.slice(2), l6.slice(2), '두 줄이 다르면 이 대조는 범위를 안 재고 내용을 잰다');
  // ⛔범위는 «본다」고 넘기는 줄의 집합이다 — 6행을 ★빼고 넘긴다(6행을 넘기면 범위 «안»이 된다)
  const scoped = lintCss(SAMPLE, new Set([1, 2, 3, 4, 5]), maps);
  assert.equal(scoped.filter((f) => f.line === 6).length, 0, '범위가 새면 445건이 쏟아져 아무도 안 쓴다');
  // ★음성대조가 «죽은 자»가 아님을 증명 — 거르개를 끄면 그 줄이 ★나타난다
  assert.ok(lintCss(SAMPLE, null, maps).some((f) => f.line === 6), '거르개 off 에서도 안 나오면 이 자는 그냥 장님이다');
});

test('★무력화 수: 거르개를 끄면 ★건수가 늘어난다 (「범위가 듣는다」를 수로)', () => {
  const { maps } = fakeMaps();
  const scoped = lintCss(SAMPLE, new Set([1, 2, 3, 4, 5]), maps).length;
  const all = lintCss(SAMPLE, null, maps).length;
  assert.equal(scoped, 3);
  assert.equal(all, 4);
  assert.ok(all > scoped, '두 수가 같으면 거르개가 안 듣는 것이다');
});

/* ══ 무력화 묶음 — ★가드를 끄면 --self 가 빨개지나 ═══════════════════════
 * ⛔「대조를 세웠다」가 아니라 「끄니 잡더라」만 근거다. */
const TOOL_SRC = read('tools/css-token-lint.mjs');
const MUTANTS = [
  { name: '범위 거르개 off', find: 'if (scopeLines && !scopeLines.has(line)) return;', repl: 'if (false) return;' },
  { name: '`--x:` 정의 면제 off', find: 'if (d.isCustomProp) continue;', repl: 'if (false) continue;' },
  { name: '제안 패밀리 거르개 off', find: 'if (!isSuggestable(name)) continue;', repl: 'if (false) continue;' },
  { name: '주석 벗기기 off', find: 'export function blankCssNoise(src) {', repl: 'export function blankCssNoise(src) { return src;' },
  { name: 'url/var 면제 off', find: 'export function blankExemptSpans(value, known) {', repl: 'export function blankExemptSpans(value, known) { return value;' },
];

test('★무력화: 가드 5개를 하나씩 끄면 --self 가 ★각각 빨개진다', async (t) => {
  // ⑴ 먼저 «안 깨뜨린» 자가 ★초록인지 — 바닥이 빨강이면 아래가 전부 거짓 양성이다
  const { maps, resolved } = (() => {
    const files = fs.readdirSync(path.join(REPO, 'css')).filter((f) => f.endsWith('.css')).sort().map((f) => `css/${f}`);
    const { defs } = collectRootTokens(files, read);
    const r = resolveTokens(defs);
    return { maps: buildMaps(r), resolved: r };
  })();
  const base = selfCheck(maps, resolved);
  assert.ok(base.length >= 14, `대조 칸이 ${base.length}칸 — 줄었다면 재는 것이 줄었다`);
  assert.equal(base.filter((r) => !r.ok).length, 0,
    '바닥이 빨강: ' + base.filter((r) => !r.ok).map((r) => r.name).join(' / '));

  // ⑵ 변이 — 임시 파일로 import 해 «그 변이가 실제로 꽂혔나»까지 센다
  const tmp = path.join(REPO, 'tools', `.css-token-lint-mut-${process.pid}.mjs`);
  t.after(() => { try { fs.unlinkSync(tmp); } catch { /* 이미 지워졌다 */ } });
  for (const m of MUTANTS) {
    assert.ok(TOOL_SRC.includes(m.find), `변이 닻이 소스에 없다 — 「${m.name}」. 자가 바뀌었으면 닻도 고쳐라`);
    const mutated = TOOL_SRC.replace(m.find, m.repl);
    assert.notEqual(mutated, TOOL_SRC, `변이가 안 꽂혔다 — 「${m.name}」 의 통과는 0건짜리 거짓이다`);
    fs.writeFileSync(tmp, mutated);
    const mod = await import(`${tmp}?v=${m.name}`);
    const files = fs.readdirSync(path.join(REPO, 'css')).filter((f) => f.endsWith('.css')).sort().map((f) => `css/${f}`);
    const { defs } = mod.collectRootTokens(files, read);
    const r2 = mod.resolveTokens(defs);
    const rows = mod.selfCheck(mod.buildMaps(r2), r2);
    const reds = rows.filter((x) => !x.ok).map((x) => x.name);
    assert.ok(reds.length > 0, `「${m.name}」 를 껐는데 ★14칸이 전부 초록이다 — 그 가드엔 ★재는 자가 없다`);
  }
});

test('산 레포에서도 돈다 — 명부가 비거나 표가 비면 HARNESS 자리다', () => {
  const files = fs.readdirSync(path.join(REPO, 'css')).filter((f) => f.endsWith('.css')).sort().map((f) => `css/${f}`);
  const { defs } = collectRootTokens(files, read);
  assert.ok(defs.length > 100, `:root 토큰 ${defs.length}건 — 100 아래로 떨어지면 명부 파싱이 깨진 것이다`);
  const maps = buildMaps(resolveTokens(defs));
  assert.ok(maps.color.size > 20, `색 표 ${maps.color.size}값`);
  assert.ok(maps.length.size > 10, `길이 표 ${maps.length.size}짝`);
});

/* ══ 이 자의 ★첫 적발 4건을 ★토큰으로 바꾼 자리를 잠근다 (2026-10-10) ═══════
 * ★왜 검사가 필요한가 = 리터럴을 토큰으로 바꾸면 그 줄은 ★더 이상 «못박힌 값»이
 *   아니다. 토큰이 바뀌는 날 ★네 자리의 그림이 같이 바뀐다. 그게 토큰의 ★뜻이지만,
 *   ★«모르고» 바뀌면 안 된다 ⇒ 바꾼 시점의 값을 ★여기 적어 두고, 달라지면 ★빨개진다.
 * ★반례(이 단언이 거짓이 되는 판) = `--ui-fs-20: 21px` 로 고치는 판. 실측으로 확인했다.
 * ⛔「값이 같다」만으로는 못 닫는다 — 그래서 ⑵정의가 ★하나뿐인가 ⑶문서가 토큰 파일을
 *   ★읽는가 까지 같이 건다. 셋 중 하나라도 깨지면 var() 가 ★조용히 안 먹는다.
 */
const SUBSTITUTIONS = [
  { file: 'css/editor-blocks.css', token: '--ui-fs-20', was: '20px', what: '#grd-plus-layer > .grd-add-btn font-size' },
  { file: 'css/editor-graph.css', token: '--ui-row-gap', was: '4px', what: '.grb-data-item gap' },
  { file: 'css/editor-panels.css', token: '--ui-radius-md', was: '6px', what: '#rp-height-total border-radius' },
  { file: 'css/editor-props.css', token: '--ui-fs-9', was: '9px', what: '.fxpart-chip-del font-size' },
  /* ★이 자가 ★처음 찾아낸 제품 결함을 고친 자리 — `var(--ui-fs-11, 11px)` ★8곳.
   *   ★이제 그 8곳이 ★`--ui-fs-base` 에 ★달려 있다 ⇒ ★그 값을 ★여기 못박는다. */
  { file: 'css/report-modal.css', token: '--ui-fs-base', was: '11px', what: '8곳 font-size (옛 var(--ui-fs-11, 11px))' },
];

test('치환 잠금 ⑴ 바꿔 넣은 토큰의 «지금 값»이 ★바꾸기 전 리터럴과 같다', () => {
  const files = fs.readdirSync(path.join(REPO, 'css')).filter((f) => f.endsWith('.css')).sort().map((f) => `css/${f}`);
  const resolved = resolveTokens(collectRootTokens(files, read).defs);
  for (const s of SUBSTITUTIONS) {
    assert.equal(resolved.get(s.token), s.was,
      `${s.token} 이 ${s.was} → ${resolved.get(s.token)} 로 바뀌었다. ${s.file} 의 ${s.what} 그림이 ★같이 바뀐다 — `
      + '의도한 변경이면 이 표의 was 를 고치고, 아니면 토큰을 되돌려라');
  }
});

test('치환 잠금 ⑵ 그 토큰이 css 전체에서 ★한 번만 정의된다 (덮이면 var() 가 딴 값이 된다)', () => {
  const files = fs.readdirSync(path.join(REPO, 'css')).filter((f) => f.endsWith('.css')).sort().map((f) => `css/${f}`);
  const all = [];
  for (const f of files) {
    const blanked = blankCssNoise(read(f));
    for (const m of blanked.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) all.push(m[1]);
  }
  for (const s of SUBSTITUTIONS) {
    assert.equal(all.filter((n) => n === s.token).length, 1,
      `${s.token} 정의가 1곳이 아니다 — 어느 것이 이기는지 이 검사가 모른다`);
  }
});

test('치환 잠금 ⑶ 전제 — index.html 이 토큰 파일과 네 파일을 ★같이 읽는다', () => {
  const html = read('index.html');
  assert.match(html, /href="css\/editor-base\.css"/, 'editor-base.css 를 안 읽으면 --ui-* 가 ★하나도 안 먹는다');
  for (const s of SUBSTITUTIONS) {
    const base = s.file.replace('css/', '').replace(/\./g, '\\.');
    assert.match(html, new RegExp(`href="css/${base}"`), `${s.file} 을 index.html 이 안 읽는다 — 이 잠금의 전제가 틀렸다`);
  }
});

/* ══ 게이트를 ★부르는 칸 (지디 GO 2026-10-10) ══════════════════════════════
 * ★★★★빨개졌으면 ★이것만 하면 된다:
 *       npm run gate:css-token
 *   ⇒ 적발 자리가 `file:line:col` 로 나오고, ★문구가 ★쓸 토큰 이름을 대 준다.
 *     그 `var(--…)` 로 그 리터럴을 ★그 자리에서 바꿔라. 끝이다.
 *     (토큰이 여럿이면 그 줄의 뜻에 맞는 것을 골라라 — `--ui-*` 가 정본이다.)
 *   ★이 칸이 ★왜 있나 = ⛔「자를 만들었다」로 끝나면 ★그 자는 ★안 돈다.
 *     이 레포의 `gate:assert-strength` 가 ★부르는 자 없이 ★보름을 죽어 있었고,
 *     `.github/workflows/*.yml` 주석에 「npm test 를 부르는 자리가 훅·CI·배포
 *     어디에도 없었다(T-144)」가 ★이미 적혀 있다.
 *   ★어디가 ★자동으로 도나(2026-10-10 실측) — `pre-push` 훅은 `exit 0` 고정이라
 *     아무것도 못 막고, CI 는 release-mac/win 이 ★`npm test` 를 부른다.
 *     ⇒ ★`npm test` 가 ★이 레포에서 ★유일한 자동 경로다. 그래서 ★여기 둔다.
 *   ⛔CI step 추가는 ★안 했다 — `.github/workflows/` 수정은 ★현빈 게이트다.
 *
 * ★★SKIP 규율 — 「범위 밖 검사는 FAIL 이 아니라 SKIP」, 단 ★조용한 통과는 ★금지.
 *   git 이 없거나 기준판 태그가 안 보이면(얕은 checkout) ★SKIP 하는데,
 *   ⛔「skipped」만 찍으면 다음 사람이 ★«돌았다»로 읽는다 ⇒ ★까닭을 ★stdout 에 박는다.
 *   ★그리고 ★그 SKIP 이 ★«늘 SKIP»이 아님을 ★아래 두 칸이 ★양쪽에서 잠근다.
 */
/* ⛔기준판을 ★여기에도 박지 않는다 — 박으면 ★이 검사가 ★둘째 명부가 된다.
 *   ★자와 ★같은 `deriveBase()` 를 쓴다(명부 ★하나). */
const STALE_BASE = 'v0.9.5';   // ★단언 ⒝ 전용 — 「낡은 기준판을 넣으면 창이 달라진다」를 재는 자리

/** 게이트를 돌릴 ★전제. {ok, reason} — reason 은 ★SKIP 할 때 찍을 말이다. */
const G = (...a) => cp.spawnSync('git', ['-C', REPO, ...a], { encoding: 'utf8' });

function gatePremise(baseRef) {
  const wt = G('rev-parse', '--is-inside-work-tree');
  if (wt.status !== 0 || wt.stdout.trim() !== 'true') {
    return { ok: false, reason: `git 작업트리가 아니다 (rev-parse rc=${wt.status}) — 범위를 뽑을 수 없다` };
  }
  let ref = baseRef;
  if (!ref) {                       // ★파생 — 자와 ★같은 함수를 쓴다(명부 하나)
    const d = deriveBase((...a) => G(...a));
    if (!d.ok) return { ok: false, reason: `기준판을 못 뽑는다 — ${d.reason}` };
    ref = d.base;
  }
  const base = G('rev-parse', '--verify', '--quiet', `${ref}^{commit}`);
  if (base.status !== 0 || !base.stdout.trim()) {
    return { ok: false, reason: `기준판 '${ref}' 가 안 보인다 — 얕은 checkout(fetch-depth 1)이면 태그가 없다` };
  }
  const mb = G('merge-base', ref, 'HEAD');
  if (mb.status !== 0 || !mb.stdout.trim()) {
    return { ok: false, reason: `merge-base(${ref}, HEAD) 가 없다 — 공통 조상이 안 당겨졌다` };
  }
  return { ok: true, base: ref, reason: `base=${ref} ${base.stdout.trim().slice(0, 12)} · merge-base ${mb.stdout.trim().slice(0, 12)}` };
}

/** 범위 줄 수 — ⛔자의 수를 ★되받지 않는다. git 만으로 ★따로 센다. */
function scopeLineCount(baseRef) {
  const mb = G('merge-base', baseRef, 'HEAD');
  if (mb.status !== 0 || !mb.stdout.trim()) return null;
  const d = G('diff', '-U0', '--no-color', mb.stdout.trim(), '--', 'css/*.css');
  if (d.status !== 0) return null;
  return d.stdout.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).length;
}

test('★게이트 — 바뀐 CSS 줄에 «토큰이 있는» 하드코딩이 0건인가  [빨강이면: npm run gate:css-token]', (t) => {
  const pre = gatePremise(null);
  if (!pre.ok) {
    // ⛔조용한 통과 금지 — 까닭을 찍는다
    process.stdout.write(`\n⚠️ css-token 게이트 ★SKIP — ★안 쟀다(통과가 아니다): ${pre.reason}\n`
      + '   ⇒ 재려면 태그까지 받아라: actions/checkout 은 fetch-depth: 0 ＋ tags 필요.\n\n');
    t.skip(`안 쟀다: ${pre.reason}`);
    return;
  }
  const r = cp.spawnSync('node', [path.join(REPO, 'tools/css-token-lint.mjs')],   // ⛔--base 안 준다 — ★자가 ★스스로 파생하는지도 같이 잰다
    { encoding: 'utf8', cwd: REPO });
  // ⛔3(HARNESS_ERROR)을 1 이나 0 으로 접지 마라 — 전제는 위에서 이미 봤으니 3 은 ★자가 고장난 것이다
  assert.notEqual(r.status, 3, `자가 고장났다(HARNESS_ERROR) — 전제는 섰는데 3 이 났다\n${r.stdout}${r.stderr}`);
  assert.equal(r.status, 0,
    '★고치는 법 ⇒ ★npm run gate:css-token   (자리를 다시 보려면 이것만 돌려라)\n'
    + `바뀐 CSS 줄에 토큰이 있는 하드코딩이 남았다 (${pre.reason})\n`
    + '★아래 문구의 `var(--…)` 로 그 리터럴을 그 자리에서 바꿔라:\n'
    + r.stdout + r.stderr);
});

/* ★양쪽 잠금 — 위 칸이 ★«늘 SKIP»이 아님을 증명한다.
 * ⛔하나만 두면 안 된다: ok:true 만 재면 「못 재는 판」을 못 보고,
 *   ok:false 만 재면 「여기선 도나」를 못 본다. */
/* ★⑴a 는 ★환경에 안 의존한다 — `HEAD` 는 어느 checkout 에서도 풀린다.
 *   ⛔여기서 ★파생 기준판(릴리스 태그)을 쓰면 ★얕은 checkout(CI) 에서 ★릴리스가 빨개진다.
 *   그건 CSS 와 ★무관한 빨강이고, ★내가 가로챌 자리가 아니다(워크플로 = 현빈 게이트). */
test('게이트 전제 ⑴a — 풀리는 ref 에는 전제가 ★선다 (⇒ ok 갈래가 ★닿는 자리다 · 환경 무관)', () => {
  const pre = gatePremise('HEAD');
  assert.equal(pre.ok, true, `HEAD 로도 전제가 안 섰다 — gatePremise 가 ★늘 거짓이면 게이트는 ★영원히 SKIP 이다: ${pre.reason}`);
  assert.match(pre.reason, /merge-base [0-9a-f]{12}/, '전제가 «무엇으로 섰나»를 말하지 않는다');
});

/* ★⑴b 는 ★이 판을 잰다 — 다만 ★못 재는 판에서는 ★FAIL 이 아니라 ★SKIP(까닭 찍고). */
test('게이트 전제 ⑴b — ★이 판에서 ★파생된 기준판으로 실제로 쟀나 (못 쟀으면 ★까닭을 남긴다)', (t) => {
  const pre = gatePremise(null);
  if (!pre.ok) {
    process.stdout.write(`\n⚠️ css-token 게이트가 ★이 판에서 ★안 돌았다(통과가 아니다): ${pre.reason}\n\n`);
    t.skip(`안 쟀다: ${pre.reason}`);
    return;
  }
  assert.match(pre.reason, /^base=v[0-9][0-9.]* [0-9a-f]{12} · merge-base [0-9a-f]{12}$/,
    `전제 문구가 «어느 판으로 쟀나»를 안 말한다: ${pre.reason}`);
});

test('게이트 전제 ⑵ — ★없는 기준판에는 전제가 ★안 선다 (⇒ SKIP 갈래가 ★죽은 자가 아니다)', () => {
  const pre = gatePremise('nope-this-ref-does-not-exist-1009t3');
  assert.equal(pre.ok, false, '없는 ref 에도 전제가 섰다 — 그러면 얕은 checkout 에서 ★3 으로 터진다');
  assert.match(pre.reason, /안 보인다/, 'SKIP 까닭이 비어 있으면 ★조용한 통과가 된다');
});

/* ══ ① 기준판 ★파생 — ⒜값 ⒝창 ⒞실패갈래 를 ★한 쌍으로 ══════════════════
 * ★왜 = 2026-10-10 실측으로 ★이미 한 칸 낡아 있었다. origin/main = 9de05e189791
 *   = ★v0.9.6 ★그 자체(GitHub 릴리스 0.9.6 Latest · package.json 0.9.6)인데
 *   자에 박힌 값은 ★v0.9.5 였다. ⇒ 박은 문자열이 ★둘째 명부였다.
 * ⛔①만 하면 ★안 잠긴다 — 파생이 ★엉뚱한 값을 내도 초록일 수 있다. 그래서 셋이다.
 */
test('기준판 ⒜ — 파생된 값이 «판번호 최댓값»이다 (★자가 쓴 길과 ★다른 길로 센다)', () => {
  const d = deriveBase((...a) => G(...a));
  if (!d.ok) { process.stdout.write(`\n⚠️ 기준판 파생 ★실패 — ★안 쟀다: ${d.reason}\n\n`); return; }
  // ⛔`--sort=-v:refname` 을 ★되받지 않는다 — ★JS 로 ★직접 수를 비교한다
  const r = G('tag', '--list', 'v[0-9]*', '--merged', d.mainRef);
  assert.equal(r.status, 0, 'tag --merged 가 죽었다');
  const tags = r.stdout.trim().split('\n').filter(Boolean);
  assert.ok(tags.includes(d.base), `파생값 ${d.base} 이 ${d.mainRef} 에 머지된 태그 명부에 ★없다`);
  const num = (t) => (t.replace(/^v/, '').split('.').map(Number).concat([0, 0, 0]).slice(0, 3));
  const cmp = (a, b) => (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]);
  const max = tags.reduce((m, t) => (cmp(num(t), num(m)) > 0 ? t : m), tags[0]);
  assert.equal(d.base, max,
    `파생=${d.base} 인데 ${d.mainRef} 에 머지된 ★가장 높은 판은 ${max} 다 — 기준판이 ★낡았거나 ★앞질렀다`);
  // ⒜2 매니페스트와 견준다 — ⛔태그가 매니페스트보다 ★높을 수는 없다
  const ver = JSON.parse(read('package.json')).version;
  assert.ok(cmp(num(`v${ver}`), num(d.base)) >= 0,
    `package.json=${ver} 이 태그 ${d.base} 보다 ★낮다 — 둘 중 하나가 틀렸다(릴리스 꼬임)`);
  process.stdout.write(`   기준판 ⒜ 실측: 파생=${d.base} · 판번호 최댓값=${max} · package.json=${ver} · ${d.mainRef}=${G('rev-parse', '--short=12', d.mainRef).stdout.trim()}\n`);
});

test('기준판 ⒝ — ★낡은 판(v0.9.5)을 억지로 넣으면 ★창이 달라진다 (⇒ 「0건」이 ★항등식이 아니다)', (t) => {
  const d = deriveBase((...a) => G(...a));
  const stale = G('rev-parse', '--verify', '--quiet', `${STALE_BASE}^{commit}`);
  if (!d.ok || stale.status !== 0) {
    process.stdout.write(`\n⚠️ 기준판 ⒝ ★SKIP — ★안 쟀다: ${d.ok ? `${STALE_BASE} 태그가 없다` : d.reason}\n\n`);
    t.skip('안 쟀다 — 태그가 없다');
    return;
  }
  const now = scopeLineCount(d.base);
  const old = scopeLineCount(STALE_BASE);
  assert.ok(now !== null && old !== null, 'git 만으로 센 범위가 null 이다');
  assert.notEqual(now, old,
    `두 기준판의 창이 ★같다(${now}줄) — 그러면 「기준판을 올렸다」가 ★아무것도 안 바꿨다는 뜻이고, ⒜ 가 ★헛돈 것이다`);
  assert.ok(old > now,
    `낡은 판이 ★더 좁다(${STALE_BASE} ${old}줄 < ${d.base} ${now}줄) — 방향이 뒤집혔다. merge-base 를 의심하라`);
  process.stdout.write(`   기준판 ⒝ 실측: ${STALE_BASE} ${old}줄 → ${d.base} ${now}줄 (${now - old}줄) ⇒ ★낡은 판은 «덜» 보는 게 아니라 «더» 본다(노이즈)\n`);
});

/* ⒞ 실패 갈래 — ★git 을 ★가짜로 넣어 ★세 갈래를 ★전부 밟는다.
 * ⛔이것이 없으면 「못 뽑으면 SKIP」은 ★한 번도 안 돈 코드다. */
test('기준판 ⒞ — 못 뽑는 세 갈래가 ★전부 {ok:false} ＋ ★까닭을 낸다 (가짜 git)', () => {
  const stub = (map) => (...a) => {
    const key = a.join(' ');
    for (const [pat, out] of map) if (key.startsWith(pat)) return { status: 0, stdout: out, stderr: '' };
    return { status: 1, stdout: '', stderr: '' };
  };
  const noMain = deriveBase(stub([]));
  assert.equal(noMain.ok, false);
  assert.match(noMain.reason, /main 줄기를 못 찾는다/, `까닭이 비었다: ${noMain.reason}`);

  const noTag = deriveBase(stub([['rev-parse --verify --quiet origin/main', 'abc123\n']]));
  assert.equal(noTag.ok, false);
  assert.match(noTag.reason, /태그가 0건/, `까닭이 비었다: ${noTag.reason}`);

  const split = deriveBase(stub([
    ['rev-parse --verify --quiet origin/main', 'abc123\n'],
    ['describe --tags --abbrev=0', 'v0.9.6\n'],
    ['tag --list v[0-9]* --merged origin/main --sort=-v:refname', 'v0.9.9\nv0.9.6\n'],
  ]));
  assert.equal(split.ok, false, '두 길이 갈렸는데 ★골라 썼다 — ⛔고르면 안 된다');
  assert.match(split.reason, /두 길이 갈린다/, `까닭이 비었다: ${split.reason}`);

  // ★양성 — 가짜 git 으로도 ★성공 갈래가 ★닿는다(⇒ 위 셋이 ★「늘 false」가 아니다)
  const good = deriveBase(stub([
    ['rev-parse --verify --quiet origin/main', 'abc123\n'],
    ['describe --tags --abbrev=0', 'v0.9.6\n'],
    ['tag --list v[0-9]* --merged origin/main --sort=-v:refname', 'v0.9.6\nv0.9.5\n'],
  ]));
  assert.deepEqual([good.ok, good.base, good.mainRef], [true, 'v0.9.6', 'origin/main']);
});

test('② --rev — ★체크아웃 없이 ref 를 잰다 · ⛔빈 블롭을 「0건」으로 접지 않는다', () => {
  const r = cp.spawnSync('node', [path.join(REPO, 'tools/css-token-lint.mjs'), '--rev', 'HEAD'],
    { encoding: 'utf8', cwd: REPO });
  assert.notEqual(r.status, 3, `--rev HEAD 가 HARNESS_ERROR 를 냈다\n${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /잰 것=HEAD/, '무엇을 쟀는지 출력에 안 적힌다');
  assert.match(r.stdout, /토큰 명부 :root \d+건/, 'ref 에서 토큰 명부를 못 읽었다');
  // ★없는 ref 는 ★조용히 0 이 아니라 ★3 이어야 한다
  const bad = cp.spawnSync('node', [path.join(REPO, 'tools/css-token-lint.mjs'), '--rev', 'nope-ref-1009t3'],
    { encoding: 'utf8', cwd: REPO });
  assert.equal(bad.status, 3, `없는 ref 에 rc=${bad.status} — ⛔0 으로 접으면 「0건」이 거짓이 된다`);

  /* ★★--rev 가 ★정말 ★그 ref 를 읽나 — ⛔안 읽고 작업트리를 재면 ★둘이 ★같은 수가 된다.
   * ★닻 = `417d220e133f`(내 첫 커밋 · 고치기 ★전 판 · ★불변).
   *   ★이 「2」는 ★자가 아니라 ★git 만으로 ★따로 세서 나온 수다(파생 기준판 v0.9.6 에서
   *   적발 4건 중 ★2건이 창 안 — editor-panels:140 · editor-props:626).
   * ⇒ 작업트리는 ★0건(고쳤다) · 그 ref 는 ★2건 ⇒ ★두 수가 ★달라야 --rev 가 산다. */
  const PRE_FIX = '417d220e133f';
  const atRef = cp.spawnSync('node', [path.join(REPO, 'tools/css-token-lint.mjs'), '--rev', PRE_FIX],
    { encoding: 'utf8', cwd: REPO });
  assert.notEqual(atRef.status, 3, `--rev ${PRE_FIX} 가 HARNESS_ERROR\n${atRef.stdout}${atRef.stderr}`);
  const n = (out) => { const m = /적발 (\d+)건/.exec(out); return m ? Number(m[1]) : (/적발 0건\./.test(out) ? 0 : null); };
  assert.equal(n(atRef.stdout), 2,
    `--rev ${PRE_FIX} 에서 2건이 아니다 — --rev 가 ref 를 ★안 읽고 작업트리를 재는 것일 수 있다\n${atRef.stdout}`);
  assert.equal(n(r.stdout), 0, `작업트리가 0건이 아니다 — 두 수가 같으면 --rev 를 ★못 믿는다\n${r.stdout}`);
  assert.match(atRef.stdout, /editor-panels\.css:140/, '기대한 자리가 안 나온다');
  assert.match(atRef.stdout, /editor-props\.css:626/, '기대한 자리가 안 나온다');
});

test('③ 단언 ★본문에 명령이 들어 있다 — ⛔제목만으로는 «본문을 복사해 가는 사람»에게 안 간다', () => {
  const src = read('tests/unit/css-token-lint.test.mjs');
  const i = src.indexOf('assert.equal(r.status, 0,');
  assert.ok(i > 0, '게이트 단언을 못 찾는다');
  const body = src.slice(i, i + 400);
  assert.match(body, /npm run gate:css-token/, '단언 ★본문에 명령이 없다');
});

/* ══ Ⓐ ★거르개 정합 — ⛔「적발 0건」을 믿기 전에 ★«본 줄»을 보라 ═══════════
 * ★왜 = 적대적 QA(advqa)가 ★실명을 찾았다(2026-10-10). 내가 ★뿌리를 다시 쟀고,
 *   ★advqa 가 지목한 자리(677·723)가 ★아니었다 — 뿌리는 ★`blankCssNoise` 의
 *   ★`Array.from`(코드포인트) ↔ `src[i]`(UTF-16) ★색인 섞임이다.
 * ⛔「지금 editor-layout.css 가 ★실명이다」를 ★단언으로 걸지 않는다 —
 *   그러면 ★고치는 날 ★빨개진다(「일부러 빨간 검사가 다음 빨강을 가린다」).
 *   ⇒ ⑴ 계측기가 ★잡을 수 있나(합성 양성/음성) ⑵ 그 줄이 ★출력에 ★늘 찍히나 — 둘만 건다. */
/* ★★이 칸은 ★Ⓑ 고침 뒤 ★고쳤다 — ⛔원래는 ★«결함»을 재고 있었다.
 *   옛 단언: 「astral 이 있으면 ★lenDrift ≠ 0」 ⇒ ★그건 ★버그의 ★증상이었다.
 *   ★Ⓑ 가 그 버그를 없애자 ★이 칸이 ★빨개졌다 — ★계측기가 아니라 ★결함을 잠근 칸이었다.
 *   ⇒ ★지금은 ⑴ astral 을 ★세는가 ⑵ 어긋남이 ★0 인가(＝★계약)만 건다.
 * ⛔그러면 ★`lenDrift ≠ 0` 갈래는 ★«안 재는 자»가 된다 — ★안 숨긴다:
 *   ★그 갈래를 재는 것은 ★무력화 묶음이다(거르개를 깨뜨려 ★어긋남을 만들어 본다, 아래). */
test('Ⓐ 정합 ⑴ — astral 을 ★세고, 어긋남은 ★0 이다 (Ⓑ 뒤 ★계약)', () => {
  const plain = '.a{color:red}\n.b{color:blue}\n';
  const withAstral = '/* 📝 */\n.a{color:red}\n.b{color:blue}\n';
  const a = scanIntegrity(plain);
  const b = scanIntegrity(withAstral);
  assert.equal(a.astral, 0, 'astral 이 없는데 있다고 한다');
  assert.equal(b.astral, 1, 'astral 문자를 못 센다');
  assert.equal(a.lenDrift, 0, '멀쩡한 소스에 어긋남이 있다고 한다');
  assert.equal(b.lenDrift, 0, '★astral 이 있는데 어긋났다 — ★Ⓑ 고침이 되돌아갔다');
  assert.equal(b.decls, a.decls, 'astral 하나 때문에 선언 수가 달라진다 — ★Ⓑ 고침이 되돌아갔다');
});

test('Ⓐ 정합 ⑴b — 거르개를 ★깨뜨리면 ★어긋남을 ★잡는다 (⇒ lenDrift 갈래가 ★죽은 자가 아니다)', () => {
  /* ★계측기 쪽을 ★직접 먹인다 — ⛔제품 거르개를 되돌리지 않고 ★같은 산식을 ★손으로 흉내 낸다.
   *   `lenDrift = blanked.length - src.length` 이므로, ★코드포인트 배열로 만든 출력은
   *   astral 이 있을 때 ★반드시 짧아진다. ★그게 ★옛 꼴(Array.from)이 낸 수다. */
  const src = '/* 📝 */\n.a{color:red}\n';
  const cpJoin = Array.from(src).join('');          // 길이는 같다(join 은 복원한다)
  assert.equal(cpJoin.length, src.length);
  const cpLen = Array.from(src).length;             // ★이 수가 ★옛 꼴이 쓰던 n 이다
  assert.ok(cpLen < src.length, 'astral 이 있는데 코드포인트 수가 UTF-16 길이와 같다 — 표본이 죽었다');
  assert.equal(cpLen - src.length, -1, `옛 꼴이 낼 어긋남이 -1 이 아니다: ${cpLen - src.length}`);
});

test('Ⓐ 정합 ⑵ — 짝 없는 `(` 를 ★잡는다 (＋짝이 맞으면 ★0 : 음성대조)', () => {
  assert.deepEqual(scanIntegrity('.a{color:rgb(1,2,3)}\n').runaway, [], '짝이 맞는데 짝 없다고 한다');
  // ★진짜 짝 없는 `(` — 그 뒤 전부를 안 보게 만드는 꼴
  const r = scanIntegrity('.a{color:rgb(1,2}\n.b{color:blue}\n');
  assert.deepEqual(r.runaway, [1], `짝 없는 ( 를 못 잡는다: ${JSON.stringify(r)}`);
});

/* ★★advqa 가 지목한 ★기전의 ★반증 — ★문자열 안의 `)` ★만으로는 ★폭주가 ★안 난다.
 * ⛔「문자열을 빈칸으로 만들며 그 `)` 도 지운다 ⇒ `:not(` 가 짝을 잃는다」는 ★틀렸다:
 *   그 `)` 는 ★애초에 ★짝이 아니었다. 진짜 짝은 ★그대로 남는다.
 * ⇒ editor-layout.css:677 이 `runaway` 로 뜨는 것은 ★결과이고, ★원인은 ★색인 어긋남이다.
 *   ★이 칸이 있으면 ★다음 사람이 ★677 행을 ★고치려 들지 않는다(증상 가리기 방지). */
test('Ⓐ 정합 ⑵b — 문자열 안의 `)` ★만으로는 ★폭주가 ★안 난다 (★advqa 기전의 반증)', () => {
  const sample = '.a:not([x=")"]):not([y=", 0)"]){color:red}\n.b{color:blue}\n';
  const r = scanIntegrity(sample);
  assert.deepEqual(r.runaway, [], `문자열 안의 ) 때문에 폭주했다고 한다: ${JSON.stringify(r)}`);
  assert.equal(r.lenDrift, 0, 'astral 이 없는데 색인이 어긋났다');
  assert.equal(r.decls, 2, `그 뒤를 못 봤다 — 선언 ${r.decls}개`);
  /* ★★Ⓑ 뒤 — astral 을 더해도 ★이제 아무 일이 없다. ★그게 ★고침의 ★뜻이다.
   *   ⛔옛 단언(「astral 을 더하면 ★어긋난다」)은 ★결함의 증상이라 ★지웠다. */
  const r2 = scanIntegrity('/* 📝 */\n' + sample);
  assert.equal(r2.astral, 1, 'astral 을 못 센다');
  assert.equal(r2.lenDrift, 0, 'astral 을 더하니 어긋났다 — ★Ⓑ 고침이 되돌아갔다');
  assert.deepEqual(r2.runaway, [], 'astral 을 더하니 폭주했다 — ★Ⓑ 고침이 되돌아갔다');
  assert.equal(r2.decls, r.decls, `astral 때문에 선언 수가 ${r.decls} → ${r2.decls} 로 달라졌다`);
});

/* ★★Ⓑ 가 ★되돌릴 ★계약을 ★여기 적어 둔다(⛔아직 단언으로 걸지 않는다 —
 *   지금 걸면 ★일부러 빨간 검사가 되고, 그게 ★다음 빨강을 가린다):
 *     ★`blankCssNoise(src).length === src.length` 는 ★항상 참이어야 한다.
 *   ★지금은 astral 입력에서 ★거짓이다(실측 -2). ★Ⓑ 에서 ★이 줄을 ★단언으로 올린다. */

test('Ⓐ 정합 ⑶ — ★CLI 출력에 「거르개 정합」 줄이 ★늘 찍힌다 (⛔조용히 빠지면 의미가 없다)', () => {
  const r = cp.spawnSync('node', [path.join(REPO, 'tools/css-token-lint.mjs')], { encoding: 'utf8', cwd: REPO });
  assert.notEqual(r.status, 3, `HARNESS_ERROR\n${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /거르개 정합 \d+\/\d+/, '★정합 줄이 출력에서 ★빠졌다 — 사람이 실명을 ★못 본다');
  // ★지금 이 레포는 ★실명이 있다 ⇒ ⛔로 찍히고 ★까닭(색인 어긋남/짝없는 괄호)이 같이 나온다.
  //   ★고쳐지면 「안 본 자리 0건」으로 바뀐다 — ★둘 다 ★참으로 받는다(단언은 「찍힌다」까지).
  assert.ok(/안 본 자리 0건/.test(r.stdout) || /그 뒤를 안 본다/.test(r.stdout),
    `정합 줄이 ★둘 중 어느 꼴도 아니다:\n${r.stdout}`);
});

test('Ⓐ 정합 ⑷ — 꼬리 빈 줄·@import 전용 파일을 ★거짓양성으로 올리지 않는다', () => {
  // ★실측 거짓양성 둘을 ★합성으로 못박는다: 꼬리 빈 줄 · 블록 밖 at-rule
  const tail = '.a{color:red}\n\n\n';
  const atOnly = '@charset "UTF-8";\n@import "./x.css";\n\n';
  const rep = integrityReport(['t.css', 'a.css'], (f) => (f === 't.css' ? tail : atOnly));
  assert.deepEqual(rep.map((x) => x.file), [], `멀쩡한 둘을 실명으로 올렸다: ${JSON.stringify(rep)}`);
});

/* ══ Ⓑ ★실명 고침의 ★계약 — ⛔이 칸이 ★이 고침의 ★본체다 ══════════════════
 * ★없으면 ★다음 사람이 ★또 `Array.from(src)` 로 ★되돌린다(그게 ★원래 꼴이었다).
 * ★계약: `blankCssNoise(src).length === src.length`
 *   ★거르개는 ★길이와 ★줄 구조를 ★보존해야 한다 — 안 그러면 `makeLineIndex(src)` 의
 *   오프셋이 ★blanked 와 ★안 맞고, ★빈칸이 ★«밀린 자리»에 찍힌다.
 * ★반례(이 단언이 거짓이 되는 판) = `src.split('')` 를 `Array.from(src)` 로 ★되돌리는 판.
 *   ★실측 2026-10-10: 그 판에서 editor-layout.css 는 ★38970 vs 38972 로 ★어긋났다.
 */
test('Ⓑ 계약 ⑴ — 거르개가 ★길이를 보존한다 (★astral 합성 ＋ ★레포 전 파일)', () => {
  // ★합성 — astral 이 있어도 길이가 같아야 한다
  for (const src of ['/* 📝 */\n.a{color:red}\n', '.a{content:"🔗"}\n', '🔗🔗🔗\n.b{color:blue}\n']) {
    assert.equal(blankCssNoise(src).length, src.length, `길이가 달라졌다: ${JSON.stringify(src)}`);
  }
  // ★레포 전 파일 — ⛔한 파일만 재면 「한 환경에서만 참」이 된다
  const files = fs.readdirSync(path.join(REPO, 'css')).filter((f) => f.endsWith('.css')).sort();
  const bad = files.filter((f) => { const s = read(`css/${f}`); return blankCssNoise(s).length !== s.length; });
  assert.deepEqual(bad, [], `길이가 어긋난 파일 — ⛔Array.from 으로 되돌아갔나: ${bad.join(', ')}`);
});

/* ★⒝ ★«astral 이 든 ★실제 파일»을 ★입력으로 박는다 — ⛔합성 미끼로 두지 않는다.
 * ★합성 미끼는 ★그 이모지가 ★소스에서 사라지면 ★조용히 ★항등식이 된다.
 *   ⇒ ★그래서 ★«그 파일에 ★astral 이 ★아직 있나»를 ★전제로 ★먼저 건다.
 *   ★전제가 깨지면(이모지가 지워지면) ★이 칸이 ★빨개져 ★다음 사람이 ★표본을 옮긴다. */
const ASTRAL_FILES = [
  { file: 'css/editor-layout.css', minDecls: 558 },   // ★고침 전 479 (★실측 2026-10-10)
  { file: 'css/editor-extra.css', minDecls: 1513 },   // ★고침 전 1512
];

test('Ⓑ 계약 ⑵ 전제 — 그 두 파일에 ★astral 문자가 ★아직 있다 (없으면 ★이 표본이 죽는다)', () => {
  for (const { file } of ASTRAL_FILES) {
    const r = scanIntegrity(read(file));
    assert.ok(r.astral > 0,
      `${file} 에 astral 문자가 ★0개다 — ★이 표본은 ★더 이상 색인 섞임을 ★안 잰다. `
      + 'ASTRAL_FILES 를 ★astral 이 든 다른 파일로 옮겨라(⛔칸을 지우지 마라)');
  }
});

test('Ⓑ 계약 ⑶ — astral 이 든 ★실제 파일을 ★끝까지 본다 (선언 ≥ 실측값 · 어긋남 0 · 폭주 0)', () => {
  for (const { file, minDecls } of ASTRAL_FILES) {
    const r = scanIntegrity(read(file));
    assert.equal(r.lenDrift, 0, `${file} 색인이 어긋났다(${r.lenDrift}) — 실명이 돌아왔다`);
    assert.deepEqual(r.runaway, [], `${file} 에 짝 없는 ( 가 남았다: ${r.runaway.join(',')}행`);
    assert.ok(r.lastSeen >= r.lastCandidate,
      `${file} 가 ${r.lastSeen}행까지만 본다 (선언 가능한 마지막 ${r.lastCandidate})`);
    /* ⛔맨숫자 금지 — `≥` 로 건다. 파일이 ★자라는 것은 정상이고, ★줄면 사람이 봐야 한다. */
    assert.ok(r.decls >= minDecls,
      `${file} 선언 ${r.decls}개 — 실측 기준 ${minDecls} 아래다. ★실명이 돌아왔거나 ★CSS 가 줄었다`);
  }
});

test('Ⓑ 계약 ⑷ 한 쌍 — astral 을 ★BMP 로 바꿔도 ★수가 ★안 변한다 (고친 뒤엔 ★그래야 맞다)', () => {
  for (const { file } of ASTRAL_FILES) {
    const src = read(file);
    /* ★같은 UTF-16 길이의 BMP 둘로 바꾼다 — 구조는 ★한 글자도 안 건드린다 */
    const swapped = src.replace(/[\u{10000}-\u{10FFFF}]/gu, '··');
    assert.equal(swapped.length, src.length, '치환이 길이를 바꿨다 — 이 대조가 성립 안 한다');
    const a = scanIntegrity(src);
    const b = scanIntegrity(swapped);
    assert.equal(a.decls, b.decls,
      `${file}: astral 이 있을 때 ${a.decls}개, BMP 로 바꾸면 ${b.decls}개 — ★아직 astral 에 반응한다`);
    assert.equal(a.lastSeen, b.lastSeen, `${file}: 마지막 본 줄이 ${a.lastSeen} vs ${b.lastSeen}`);
  }
});

test('Ⓑ 폭주 가드 — 짝 없는 `(` 가 있어도 ★그 뒤를 ★본다 (⛔EOF 까지 먹지 않는다)', () => {
  // ★진짜 짝 없는 괄호 — 색인 섞임과 ★다른 것을 막는 가드다
  const src = '.a{color:rgb(1,2}\n.b{color:blue}\n.c{font-size:12px}\n';
  const d = scanDeclarations(blankCssNoise(src));
  const props = d.map((x) => x.prop);
  assert.ok(props.includes('color') && props.includes('font-size'),
    `짝 없는 ( 뒤를 안 봤다 — 집은 선언 [${props.join(',')}]`);
  assert.ok(d.length >= 3, `선언 ${d.length}개 — 3개 이상이어야 한다`);
});

/* ★★이 자가 ★처음 찾아낸 ★제품 결함 — ⛔이 레인에서 ★고치지 않는다(지디 판정).
 *   css/report-modal.css 의 `var(--ui-fs-11, 11px)` ★8곳.
 *   `--ui-fs-11` 은 ★존재하지 않는다(css 0건 · js/html 0건). 참 이름 = `--ui-fs-base: 11px`.
 *   ⇒ 지금은 ★fallback 11px 로 그려지고, `--ui-fs-base` 가 바뀌는 날 ★그 8곳만 안 따라간다.
 *   ⛔고치면 ★그 자가 ★«자기 발견»을 지워 ★다시 증명할 수 없게 된다 ⇒ ★별건으로 올렸다.
 *   ★여기선 ★«그 결함이 아직 있다»를 ★단언하지 ★않는다 — 그러면 ★고치는 날 빨개진다. */

/* ══ ⒊-① ★CLI 배선 — ⛔`--self` 가 ★못 보는 자리다 ════════════════════════
 * ★무력화 실측(2026-10-10): `maps.knownVars = null` 로 ★배선을 끊으면
 *   ★`--self` 19칸이 ★전부 초록이었다(⒀ 는 ★자기 KNOWN 집합을 쓰니 안 걸린다).
 *   ⇒ ★배선은 ★CLI 출력으로만 잴 수 있다. ★그래서 이 칸이 있다. */
test('⒊-① 배선 — ★CLI 가 var() 이름 명부를 ★실제로 만든다 (끊기면 ⚠️ 줄이 뜬다)', () => {
  const r = cp.spawnSync('node', [path.join(REPO, 'tools/css-token-lint.mjs')], { encoding: 'utf8', cwd: REPO });
  assert.notEqual(r.status, 3, `HARNESS_ERROR\n${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /var\(\) 이름 명부 \d+종/, '★명부 줄이 없다 — 배선이 끊겼다(그러면 대체값 검사가 off 다)');
  assert.doesNotMatch(r.stdout, /이름 명부를 ★못 만들었다/, '★명부를 못 만들었다 — 대체값 검사가 off 로 돈다');
  /* ★«못 보는 꼴»을 ★출력에 ★찍는가 — ⛔안 찍으면 다음 사람이 이 명부를 ★완전하다고 믿는다 */
  assert.match(r.stdout, /변수 경유 조립은 ★안 센다/, '★스캐너의 못 보는 꼴이 출력에 없다');
});

test('⒊-① 명부 — ★없는 이름은 ★없고, ★css·★js 양쪽에서 ★있는 이름은 ★있다', () => {
  const cssList = fs.readdirSync(path.join(REPO, 'css')).filter((f) => f.endsWith('.css')).sort().map((f) => `css/${f}`);
  const code = ['js/canvas-contrast.js', 'css/editor-base.css'].filter((f) => fs.existsSync(path.join(REPO, f)));
  const { known } = collectKnownVarNames(cssList, read, code, (f) => read(f));
  assert.ok(known.size > 100, `명부 ${known.size}종 — 100 아래면 파싱이 깨진 것이다`);
  assert.ok(known.has('--ui-fs-base'), 'css 에 있는 이름(--ui-fs-base)이 명부에 없다');
  assert.ok(known.has('--grb-dot-hole'),
    'js 의 ★배열 리터럴에 있는 이름(--grb-dot-hole)을 못 본다 — ★이 자리를 한 번 틀렸다(9건 → 참값 8건)');
  assert.ok(!known.has('--ui-fs-11'),
    '★없는 이름(--ui-fs-11)이 명부에 있다 — 그러면 report-modal.css 의 ★8곳을 ★영원히 못 잡는다');
});

/* ══ ★이 자가 ★처음 찾아낸 ★제품 결함을 ★고친 자리 — ★발견을 ★검사로 남긴다 ══════
 * ★결함: `css/report-modal.css` 의 `var(--ui-fs-11, 11px)` ★8곳.
 *   `--ui-fs-11` 은 ★어디에도 없었고(css 0 · js/html 0) ★참 이름은 `--ui-fs-base`(11px).
 *   ⇒ ★fallback 11px 로 그려지고 ★`--ui-fs-base` 가 바뀌는 날 ★그 8곳만 안 따라갔다.
 * ★고침: `var(--ui-fs-base)` (★레포 관용 — 대체값 없는 꼴 166건 vs 있는 꼴 1건).
 *   ★그림은 ★오늘 동일하다(대체값 11px ＝ 토큰 11px · 실측).
 * ★★⛔「고치면 ★그 자가 ★제 발견을 지운다」 — ★그래서 ★셋으로 잠근다:
 *   ① `--ui-fs-11` 이 ★명부에 ★없다            ← ⛔「`--ui-fs-11: 11px` 를 ★정의해서» 끄는 길을 막는다
 *                                                  (★위 「⒊-① 명부」 칸이 이미 건다)
 *   ② 그 파일에 `--ui-fs-11` 사용이 ★0건        ← ★되돌리면 빨강
 *   ③ ★자가 그 파일에서 «없는 토큰 이름» ★0건   ← ★계측기로 잠근다(★②가 놓치는 꼴까지)
 *   ＋ `--ui-fs-base` = 11px 를 ★치환 잠금 표에 올렸다(위 SUBSTITUTIONS).
 */
test('발견 잠금 ② — css/report-modal.css 에 `--ui-fs-11` 사용이 ★0건 (★되돌리면 빨강)', () => {
  const src = read('css/report-modal.css');
  const hits = [...src.matchAll(/--ui-fs-11\b/g)].length;
  assert.equal(hits, 0,
    `★없는 토큰 이름 --ui-fs-11 이 ${hits}곳 돌아왔다 — 참 이름은 --ui-fs-base(11px). `
    + '⛔--ui-fs-11 을 ★정의해서 끄지 마라(11px 토큰이 둘이 된다 · 위 「⒊-① 명부」 칸이 막는다)');
  // ★음성대조 — 이 자가 ★글자를 ★정말 세는가(0 을 ★항등식으로 두지 않는다)
  assert.equal([...('x var(--ui-fs-11, 11px) y'.matchAll(/--ui-fs-11\b/g))].length, 1,
    '이 단언의 ★자가 글자를 못 센다 — 그러면 위 0 은 ★「안 봤다」다');
});

test('발견 잠금 ③ — ★자가 그 파일에서 «없는 토큰 이름» ★0건이라 한다 (★계측기로)', () => {
  const r = cp.spawnSync('node', [path.join(REPO, 'tools/css-token-lint.mjs'), '--all'],
    { encoding: 'utf8', cwd: REPO });
  assert.notEqual(r.status, 3, `HARNESS_ERROR\n${r.stdout}${r.stderr}`);
  const bad = r.stdout.split('\n').filter((l) => /없는 토큰 이름/.test(l) && /report-modal\.css/.test(l));
  assert.deepEqual(bad, [], `report-modal.css 에 «없는 토큰 이름»이 돌아왔다:\n${bad.join('\n')}`);
  /* ★전제 — ★그 자가 ★그 꼴을 ★여전히 ★찾을 수 있나(⛔못 찾으면 위 0 은 ★「안 봤다」다).
   *   ★합성으로 ★한 번 먹여 본다 — ⛔레포에 그 꼴이 남아 있기를 ★전제하지 않는다. */
  const known = new Set(['--real']);
  const got = lintCss('.z{font-size:var(--gone-name, 12px)}\n', null,
    { color: new Map(), length: new Map([['font-size|12px', ['--ui-fs-12']]]), knownVars: known });
  assert.equal(got.length, 1, '★자가 «없는 토큰 이름» 꼴을 ★더는 못 찾는다 — 위 0 은 거짓이다');
  assert.equal(got[0].unknownVar, '--gone-name');
});
