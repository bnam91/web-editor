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
