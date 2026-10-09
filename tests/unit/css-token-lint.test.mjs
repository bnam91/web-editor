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
  lintCss, renderFinding, selfCheck,
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
  { name: 'url/var 면제 off', find: 'export function blankExemptSpans(value) {', repl: 'export function blankExemptSpans(value) { return value;' },
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
const GATE_BASE = 'v0.9.5';

/** 게이트를 돌릴 ★전제. {ok, reason} — reason 은 ★SKIP 할 때 찍을 말이다. */
function gatePremise(baseRef) {
  const g = (...a) => cp.spawnSync('git', ['-C', REPO, ...a], { encoding: 'utf8' });
  const wt = g('rev-parse', '--is-inside-work-tree');
  if (wt.status !== 0 || wt.stdout.trim() !== 'true') {
    return { ok: false, reason: `git 작업트리가 아니다 (rev-parse rc=${wt.status}) — 범위를 뽑을 수 없다` };
  }
  const base = g('rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`);
  if (base.status !== 0 || !base.stdout.trim()) {
    return { ok: false, reason: `기준판 '${baseRef}' 가 안 보인다 — 얕은 checkout(fetch-depth 1)이면 태그가 없다` };
  }
  const mb = g('merge-base', baseRef, 'HEAD');
  if (mb.status !== 0 || !mb.stdout.trim()) {
    return { ok: false, reason: `merge-base(${baseRef}, HEAD) 가 없다 — 공통 조상이 안 당겨졌다` };
  }
  return { ok: true, reason: `base=${baseRef} ${base.stdout.trim().slice(0, 12)} · merge-base ${mb.stdout.trim().slice(0, 12)}` };
}

test('★게이트 — 바뀐 CSS 줄에 «토큰이 있는» 하드코딩이 0건인가  [빨강이면: npm run gate:css-token]', (t) => {
  const pre = gatePremise(GATE_BASE);
  if (!pre.ok) {
    // ⛔조용한 통과 금지 — 까닭을 찍는다
    process.stdout.write(`\n⚠️ css-token 게이트 ★SKIP — ★안 쟀다(통과가 아니다): ${pre.reason}\n`
      + '   ⇒ 재려면 태그까지 받아라: actions/checkout 은 fetch-depth: 0 ＋ tags 필요.\n\n');
    t.skip(`안 쟀다: ${pre.reason}`);
    return;
  }
  const r = cp.spawnSync('node', [path.join(REPO, 'tools/css-token-lint.mjs'), '--base', GATE_BASE],
    { encoding: 'utf8', cwd: REPO });
  // ⛔3(HARNESS_ERROR)을 1 이나 0 으로 접지 마라 — 전제는 위에서 이미 봤으니 3 은 ★자가 고장난 것이다
  assert.notEqual(r.status, 3, `자가 고장났다(HARNESS_ERROR) — 전제는 섰는데 3 이 났다\n${r.stdout}${r.stderr}`);
  assert.equal(r.status, 0,
    `바뀐 CSS 줄에 토큰이 있는 하드코딩이 남았다 (${pre.reason})\n`
    + '★아래 문구의 `var(--…)` 로 그 리터럴을 그 자리에서 바꿔라:\n'
    + r.stdout + r.stderr);
});

/* ★양쪽 잠금 — 위 칸이 ★«늘 SKIP»이 아님을 증명한다.
 * ⛔하나만 두면 안 된다: ok:true 만 재면 「못 재는 판」을 못 보고,
 *   ok:false 만 재면 「여기선 도나」를 못 본다. */
/* ★⑴a 는 ★환경에 안 의존한다 — `HEAD` 는 어느 checkout 에서도 풀린다.
 *   ⛔여기서 `GATE_BASE` 를 쓰면 ★얕은 checkout(CI) 에서 ★릴리스가 빨개진다.
 *   그건 CSS 와 ★무관한 빨강이고, ★내가 가로챌 자리가 아니다(워크플로 = 현빈 게이트). */
test('게이트 전제 ⑴a — 풀리는 ref 에는 전제가 ★선다 (⇒ ok 갈래가 ★닿는 자리다 · 환경 무관)', () => {
  const pre = gatePremise('HEAD');
  assert.equal(pre.ok, true, `HEAD 로도 전제가 안 섰다 — gatePremise 가 ★늘 거짓이면 게이트는 ★영원히 SKIP 이다: ${pre.reason}`);
  assert.match(pre.reason, /merge-base [0-9a-f]{12}/, '전제가 «무엇으로 섰나»를 말하지 않는다');
});

/* ★⑴b 는 ★이 판을 잰다 — 다만 ★못 재는 판에서는 ★FAIL 이 아니라 ★SKIP(까닭 찍고). */
test('게이트 전제 ⑴b — ★이 판에서 ★기준판으로 실제로 쟀나 (못 쟀으면 ★까닭을 남긴다)', (t) => {
  const pre = gatePremise(GATE_BASE);
  if (!pre.ok) {
    process.stdout.write(`\n⚠️ css-token 게이트가 ★이 판에서 ★안 돌았다(통과가 아니다): ${pre.reason}\n\n`);
    t.skip(`안 쟀다: ${pre.reason}`);
    return;
  }
  assert.match(pre.reason, new RegExp(`^base=${GATE_BASE} [0-9a-f]{12} · merge-base [0-9a-f]{12}$`),
    `전제 문구가 «어느 판으로 쟀나»를 안 말한다: ${pre.reason}`);
});

test('게이트 전제 ⑵ — ★없는 기준판에는 전제가 ★안 선다 (⇒ SKIP 갈래가 ★죽은 자가 아니다)', () => {
  const pre = gatePremise('nope-this-ref-does-not-exist-1009t3');
  assert.equal(pre.ok, false, '없는 ref 에도 전제가 섰다 — 그러면 얕은 checkout 에서 ★3 으로 터진다');
  assert.match(pre.reason, /안 보인다/, 'SKIP 까닭이 비어 있으면 ★조용한 통과가 된다');
});
