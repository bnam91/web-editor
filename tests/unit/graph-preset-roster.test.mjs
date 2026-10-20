/* 1017t1f2 뒤처리 — ★그래프 프리셋 «명부»가 ★세 자리에 ★흩어져 있다. (2026-10-18 지디)
 *
 * ★왜 이 검사가 있나 — f2(첫 조각색을 --p-green-500 으로 · 테두리를 --sel-color 로)를 고칠 때
 *   「다른 프리셋 색과도 안 겹침을 ★전수 확인함」이 css/editor-graph.css 의 ★주석에만 남고
 *   ★재는 자가 ★없었다(확인에 쓴 임시 spec 을 지웠다). ⇒ ★프리셋을 ★하나 더 넣으면
 *   ★조용히 선택색과 겹친다. ★주석은 ★썩는다 — 그래서 ★구조로 잠근다.
 *
 * ★★[2026-10-20 · 1020t2c2] ★명부는 ★셋이 아니라 ★★다섯이었다 — ★그리고 ★하나가 ★없어졌다.
 *   현빈 「우측 프로퍼티에 프리셋 ★절은 없어도 될듯」 ⇒ ★prop-graph.js 의 ★절(UI)을 지웠다.
 *   ⇒ 옛 ㉡(`prop-graph.js` 의 `const presets = [{id,label}]`)은 ★이제 ★없다. ★그 칸을 ★지우지 않고
 *     ★★다섯째 명부(MCP 스키마)로 ★갈아끼웠다 — ★UI 가 없어져도 ★프리셋은 ★안 죽는다는 것을 ★자가 잠근다.
 *
 * ★명부 자리(★전부 «정의 자리»다 — ⛔사용 자리 grep 으로 세지 않는다):
 *   ㉠ js/block-factory.js         `const PRESETS = [...]`                  ← ★제품이 ★받아들이는 값
 *   ㉢ css/editor-graph.css        `.graph-block[data-preset="X"]`           ← ★그림을 ★주는 자리(★저장본이 이걸로 그려진다)
 *   ㉣ main/claude-pm/mcp-server.js `enum: ['default','dark',…]` ★3곳         ← ★PM/MCP 로 ★거는 길(★UI 를 대신한다)
 *   ㉡ js/props/prop-graph.js      ⛔★없어졌다(1020t2c2) — ★GP4 래칫이 ★되돌아오면 알려 준다
 *   (그 밖: `js/io/export-design-json.js` 의 `preset:` 필드 = ★내보내기 — ★값 명부가 아니라 ★통로다)
 *
 * ★★어긋나는 꼴이 ★각각 다르다 — 그래서 ★한 집합으로 못 묶고 ★셋을 ★견준다:
 *   ㉠에만 있으면 → 값은 받는데 ★그림이 없다(죽은 값)
 *   ㉢에만 있으면 → 그림은 있는데 ★닿을 길이 없다(옛 프리셋의 잔재)
 *   ㉣에만 있으면 → MCP 로 걸 수는 있는데 ★제품이 ★거부한다(block-factory 가 값 검증을 한다)
 *
 * ⛔「색이 안 겹친다」는 ★여기서 못 잰다 — computed fill 이 필요하다(⇒ tests/dom/graph-pie-1013).
 *   ★까닭: colorful 은 ★--grb-pie-base 를 ★안 덮고 `.grb-bar-col:nth-child(n)` 로 ★직접 칠한다
 *   ⇒ ★변수만 읽는 자는 ★colorful 을 ★못 본다. ★그 자는 ★DOM 쪽에 둔다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

/* ㉠ block-factory.js — `const PRESETS = ['a','b',...]` 한 줄 */
function rosterFactory() {
  const src = read('js/block-factory.js');
  const m = src.match(/const\s+PRESETS\s*=\s*\[([^\]]*)\]/);
  assert.ok(m, '★js/block-factory.js 에서 `const PRESETS = [...]` 를 못 찾았다 — ⛔「0건」이 아니라 «못 잰» 것이다(이름이 바뀌었나?)');
  return new Set([...m[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] ?? x[2]));
}

/* ㉣ mcp-server.js — ★그래프의 preset `enum` 전수 (실측 3곳: add_graph_block · update_graph_block · 값검증 _enum).
   ⛔⛔`preset:` 이라는 이름으로 세면 ★안 된다 — ★실측 2026-10-20: 이 파일의 `preset` enum 은 ★임자가 ★여섯이다
     (원형글자 img1~text-img ★2곳 · 아치/물결 arc-up~circle ★2곳 · frame_8|wide_4x1 ★1곳 · 로고 logo|none ★2곳 · ★그래프 ★3곳).
     ⇒ ★이름 grep 으로 세면 ★남의 명부가 섞여 들어와 ★GP2 가 엉뚱하게 빨개진다(내가 ★한 번 밟았다).
   ★★그래서 ★값으로 고르지 ★않는다 — ★「'colorful' 이 들어있는 것」으로 고르면 ★재려는 값으로 ★대상을 골라
     ★항등식이 된다. ⇒ ★구조로 고른다: ★그래프 스키마에는 ★`chartType` 이 ★같은 블록에 있다. */
function rosterMcp() {
  const src = read('main/claude-pm/mcp-server.js');
  const ALL = [
    ...[...src.matchAll(/preset:\s*\{[^}]*?enum:\s*\[([^\]]*)\]/g)],
    ...[...src.matchAll(/_enum\(\s*'preset'\s*,\s*\[([^\]]*)\]/g)],
  ];
  /* ★같은 스키마/함수 안에 chartType 이 있나 — ★그래프인지를 ★값이 아니라 ★이웃 키로 가른다. */
  const isGraph = (m) => /chartType/.test(src.slice(Math.max(0, m.index - 1200), m.index + 1200));
  const graph = ALL.filter(isGraph);
  const other = ALL.filter((m) => !isGraph(m));
  /* ⑴ ★전제 — 못 찾으면 ⛔「0건」이 아니라 ★못 잰 것이다. */
  assert.ok(graph.length >= 3,
    `★main/claude-pm/mcp-server.js 에서 ★그래프 preset enum 을 ${graph.length}곳 찾았다 — ★3곳 미만이면 ⛔「없다」가 아니라 ★못 잰 것이다(스키마 꼴이 바뀌었나?). 전체 preset enum = ${ALL.length}곳`);
  /* ⑵ ★음성대조 — ★거르는 자가 ★실제로 거르나. ★남의 명부가 ★0곳이면 ★필터가 «전부 통과»인 것과 구분이 안 된다. */
  assert.ok(other.length >= 1,
    `★preset enum 중 ★그래프가 아닌 것이 ${other.length}곳 — ★0곳이면 위 필터가 ★아무것도 안 거르고 있다는 뜻이다(실측 2026-10-20 에는 ★5곳: 원형글자·아치·프레임·로고)`);
  /* ⑶ ★세 곳이 ★서로 같은가 — ★합집합으로 뭉개면 ★한 곳만 뒤처진 것을 ★못 본다. */
  const sets = graph.map((m) => new Set([...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])));
  const first = [...sets[0]].sort().join(',');
  sets.forEach((st, i) => assert.equal([...st].sort().join(','), first,
    `★그래프 preset enum ${i + 1}번째 자리가 다르다: ${[...st].sort().join(',')} ≠ ${first} — ★같은 스키마가 ★${graph.length}곳에 있다`));
  return sets[0];
}

/* ㉢ editor-graph.css — `.graph-block[data-preset="X"]` 전수 */
function rosterCss() {
  const src = read('css/editor-graph.css');
  return new Set([...src.matchAll(/\.graph-block\[data-preset="([^"]+)"\]/g)].map((x) => x[1]));
}

const show = (s) => [...s].sort().join(',');

test('GP1 ★전제 — ★세 자리 ★전부 ★0건이 아니다 (⛔∅ 끼리는 «일치»로 둔갑한다)', () => {
  const a = rosterFactory(), b = rosterMcp(), c = rosterCss();
  /* ★이 셋을 ★먼저 단언하는 까닭: GP2 는 ★집합 등호다 — ★셋이 ★다 비면 ★항등식으로 ★초록이 된다.
     ★내 교훈 「검사는 ★자기 전제를 ★단언해야 한다」· 「★본체는 「0건이 초록」」. */
  assert.ok(a.size >= 4, `★㉠block-factory 명부가 ${a.size}개 — ★4 미만이면 자가 깨졌다 (${show(a)})`);
  assert.ok(b.size >= 4, `★㉣mcp-server 명부가 ${b.size}개 — ★4 미만이면 자가 깨졌다 (${show(b)})`);
  assert.ok(c.size >= 4, `★㉢CSS 명부가 ${c.size}개 — ★4 미만이면 자가 깨졌다 (${show(c)})`);
});

test('GP2 ★세 명부가 ★같다 — ★어긋나면 ★어느 쪽에만 있는지 ★찍는다', () => {
  const a = rosterFactory(), b = rosterMcp(), c = rosterCss();
  /* ⛔「다르다」로 끝내지 않는다 — ★양방향 차집합을 ★메시지에 ★싣는다.
     ★까닭: 명부가 ★셋이라 ★어느 쪽이 ★뒤처졌나가 ★처방을 ★가른다(위 머리말 세 갈래). */
  const diff = (x, y, nx, ny) => {
    const only = [...x].filter((v) => !y.has(v));
    assert.deepEqual(only, [], `★${nx} 에만 있다: ${only.join(',')} — ★${ny} 에도 넣어라 (${nx}=${show(x)} / ${ny}=${show(y)})`);
  };
  diff(a, b, '㉠block-factory', '㉣mcp-server');
  diff(b, a, '㉣mcp-server', '㉠block-factory');
  diff(a, c, '㉠block-factory', '㉢CSS');
  diff(c, a, '㉢CSS', '㉠block-factory');
});

test('GP3 ★f2 비석이 ★살아있다 — 「첫 조각색 ≠ 선택색」을 ★재는 자가 ★DOM 에 ★있나', () => {
  /* ★이 검사의 ★진짜 짝은 ★DOM 쪽이다(computed fill 이 필요하다).
     ⇒ ★그 자가 ★사라지면 ★여기서 ★알려 준다. ⛔「다른 데서 재고 있을 것」으로 두지 않는다.
     ★내 교훈: 「★우회로가 새 사각지대 만들면 ★같은 패치에 ★그 자리 재는 검사도 같이」. */
  const dom = read('tests/dom/graph-pie-1013.dom.spec.js');
  assert.match(dom, /sel-color/,
    '★tests/dom/graph-pie-1013.dom.spec.js 에서 --sel-color 를 재는 자리가 사라졌다 — ★f2 의 「테두리=선택색」이 안 잠긴다');
  const css = read('css/editor-graph.css');
  assert.match(css, /--grb-pie-base:\s*var\(--p-green-500\)/,
    '★기본 프리셋 첫 조각색이 --p-green-500 이 아니다 — ★--ui-accent-primary 로 되돌아갔으면 ★선택색 테두리가 다시 묻힌다(f2 재발)');
});

/* ══ GP4 ★래칫 — 「Preset 절」이 ★되돌아오면 빨강 (1020t2c2) ════════════════════════════
   ★현빈 2026-10-20 「우측 프로퍼티에 프리셋 ★절은 없어도 될듯」 ⇒ ★절(UI)만 지웠다.
   ★★왜 래칫이 필요한가 — 고침만 내면 ★다음 사람이 ★조용히 되돌린다. ★절 순서를 재는 DOM 칸
     (tests/dom/graph-shape-fill.dom.spec.js G2-2)은 ★없는 id 를 ★그냥 건너뛰므로 ★돌아와도 초록이다
     ⇒ ★거기에도 래칫을 한 줄 걸었고, ★여기서는 ★소스를 ★센다(두 축).
   ★항등식이 아님 — ★핀 a42d76d59f45a70eb3ee0e1f68a8ed37650f7565 에서 아래 수는 ★4 · 1 · 1 이었다. */
test('GP4 ★래칫 — prop-graph.js 에 Preset 절이 ★0건이고, ★적용 코드(CSS·block-factory·MCP·export)는 ★남아 있다', () => {
  const panel = read('js/props/prop-graph.js');
  /* ⑴ 절이 ★돌아오지 않았다 — ★핀에서는 grb-preset- 4건 · '>Preset<' 1건 · `const presets = [` 1건 */
  const btn = [...panel.matchAll(/grb-preset-/g)].length;
  assert.equal(btn, 0, `★Preset 절이 되돌아왔다 — grb-preset- 가 ${btn}건(핀에서는 4건이었다). 되살릴 이유가 생겼다면 ★이 칸을 지우지 말고 ★현빈 2026-10-20 결정부터 다시 봐라`);
  assert.equal([...panel.matchAll(/>Preset</g)].length, 0, '★「Preset」 절 제목이 되돌아왔다');
  assert.equal([...panel.matchAll(/const\s+presets\s*=\s*\[/g)].length, 0, '★`const presets = [` 표가 되돌아왔다 — 명부가 다시 넷이 된다');
  /* ⑵ ★반례 단언 — ⛔금지단언만 두면 「파일이 비었다」와 구분이 안 된다. ★그 파일이 ★살아있음을 같이 본다. */
  assert.ok(panel.length > 50000, `★prop-graph.js 가 ${panel.length}자다 — 파일이 비면 위 0건들이 ★공짜로 초록이 된다`);
  assert.match(panel, /showGraphProperties/, '★prop-graph.js 가 여전히 패널을 그린다(0건이 「못 잰 것」이 아님을 받친다)');
  /* ⑶ ★적용 코드는 ★남아 있다 — 「절만 지우고 기능은 남긴다」가 ★말이 아니라 ★측정이 되게. */
  assert.ok(rosterCss().size >= 4, '★css/editor-graph.css 의 .graph-block[data-preset=…] 가 사라졌다 — ★저장본 그림이 바뀐다(⛔되돌리기 어려운 회귀)');
  assert.match(read('js/block-factory.js'), /dataset\.preset\s*=/, '★block-factory 가 data-preset 기본값을 더는 안 심는다');
  assert.match(read('js/io/export-design-json.js'), /preset:\s*\w+\.dataset\.preset/, '★내보내기에서 preset 필드가 빠졌다 — 저장본이 프리셋을 잃는다');
  assert.ok(rosterMcp().size >= 4, '★MCP(add_graph_block·update_graph_block) 의 preset enum 이 사라졌다 — ★UI 를 지운 뒤 ★유일하게 남은 «거는 길»이다');
});
