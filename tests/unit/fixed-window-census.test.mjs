/* fixed-window-census.test.mjs — ★218 FIXED-WINDOW-128-SITES-NO-RULER-01 · 소스 게이트의 «고정 창»이 ★늘지 않는다 (S3 · 261028)
 *
 * ★왜: «⛔고정 창 slice(i, i + N) 금지» 는 21 파일 머리말에 «산문»으로만 있었고 재는 자가 0 이었다(163 ⒠ 셈).
 *   고정 창 = 소스 문자열을 닻부터 N 글자만 떠서 단언하는 꼴 — 닻 뒤 문장이 늘면 단언 대상이 창 밖으로 밀려 «조용히» 눈이 먼다
 *   (163 실측: mouseup 콜백 907 글자 ↔ 창 900 · zoom-block 단언이 2500 창 끝에서 56 글자). 163·217 이 핵심 고리를 걷었다.
 * ★이 자가 하는 일 = «전수 고치기»가 아니라 «늘지 않기»(tests/unit/dom-fixed-wait-census.test.mjs 래칫 꼴을 따름).
 *   ⛔남의 파일 73 벌을 내가 고치지 않는다 · ✅새 창을 더하면 그 자리에서 빨강 · 줄였으면 명부를 줄이라는 빨강(썩은 면제 0).
 * ★자: 대상 = tests/ 아래 .js·.mjs(fixtures·node_modules 뺌) · 주석을 뗀다(stripComments = 전제 — 머리말의 «slice(i, i + 900) 금지» 글자를 안 센다)
 *   창 = `X.slice|substring|substr( a , b + N )` · N ≥ 10(두 자리 이상) · a·b 는 이름 또는 한 겹 괄호 식.
 *   ⚠️자 한계(단언 안 함 · 적음): 여러 줄에 걸친 창 · `+ N` 이 식 안 깊이 있는 꼴 · 변수 N(`i + LEN`) 은 안 센다.
 * 명부 판 = taeyang/fix-163-windows-s3 0fa4c019(7f3c6de2 + 163·217) · 잰 수 = 읽음 1138 · 창 든 파일 73 · 자리 116.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { stripComments } = createRequire(import.meta.url)('./_strip-comments.js');

const ROOT = path.join(import.meta.dirname, '..', '..');
const SELF = fileURLToPath(import.meta.url);   // ★이 파일의 미끼는 안 센다(dom-fixed-wait-census 의 SELF 와 같은 꼴)
const WIN_RE = () => /\.(?:slice|substring|substr)\(\s*([^,()]+(?:\([^()]*\))?)\s*,\s*([^,()]+(?:\([^()]*\))?)\s*\+\s*(\d{2,})\s*\)/g;
const countWin = (s) => (stripComments(s).match(WIN_RE()) || []).length;

/* 얼린 명부 — 파일 → 창 수. ⛔늘리지 마라(새 창은 sliceBlock/sliceCall/extractFn 같은 구조 떠내기로). 줄였으면 여기서 줄여라. */
const BASE = {
  'tests/_name-sink-scan.js': 1,
  'tests/dom/_history-step.js': 2,
  'tests/dom/bracket-reorder-roster.dom.spec.js': 2,
  'tests/dom/cvb-linehost-text-color.dom.spec.js': 2,
  'tests/dom/e80-fix.dom.spec.js': 2,
  'tests/dom/grid-children-shell-bytes.dom.spec.js': 2,
  'tests/dom/icb-children.dom.spec.js': 2,
  'tests/dom/modal-frameify-premise.dom.spec.js': 2,
  'tests/dom/modal-frameify.dom.spec.js': 1,
  'tests/dom/save-strip-plus7-window.dom.spec.js': 1,
  'tests/dom/section-protect-button-persist.dom.spec.js': 1,
  'tests/dom/t7-03-ft-align.dom.spec.js': 1,
  'tests/measure/frame-textcenter/04-saveload-gate.js': 2,
  'tests/unit/_name-to-markup.js': 1,
  'tests/unit/anim-gif-admin-only.test.mjs': 1,
  'tests/unit/annot-dim-geometry.test.mjs': 2,
  'tests/unit/asset-add-image.test.js': 2,
  'tests/unit/bg-layer-guard.test.mjs': 2,
  'tests/unit/card-empty-export.test.mjs': 3,
  'tests/unit/checklist-section.test.js': 2,
  'tests/unit/color-picker-tab-apply.test.mjs': 2,
  'tests/unit/count-sticker-label.test.mjs': 2,
  'tests/unit/css-token-lint.test.mjs': 1,
  'tests/unit/dom-stub-exports.test.mjs': 1,
  'tests/unit/drag-history-push-before.test.mjs': 1,
  'tests/unit/e127-guard-golden.test.mjs': 2,
  'tests/unit/editing-guard-roster.test.mjs': 1,
  'tests/unit/frame-bg-edit-wiring.test.mjs': 4,
  'tests/unit/frame-clips-predicate.test.mjs': 1,
  'tests/unit/frame-parent-pin.test.js': 2,
  'tests/unit/frame-textcenter.test.mjs': 2,
  'tests/unit/gallery-trash-tab.test.mjs': 1,
  'tests/unit/goditor-use-ping.test.mjs': 2,
  'tests/unit/google-defer-writeauth.test.mjs': 2,
  'tests/unit/graph-preset-roster.test.mjs': 1,
  'tests/unit/grid-active-line-reset.test.mjs': 1,
  'tests/unit/grid-guide.test.js': 3,
  'tests/unit/grid-line-move-wiring.test.mjs': 2,
  'tests/unit/grid-render-gaps.test.js': 1,
  'tests/unit/h2c-drops-perspective.test.mjs': 1,
  'tests/unit/icb-handle-parity.test.mjs': 1,
  'tests/unit/icon-text-contenteditable-restore.test.mjs': 2,
  'tests/unit/insert-seam-settle.test.mjs': 2,
  'tests/unit/keys-esc-arrow-wiring.test.mjs': 1,
  'tests/unit/load-strips-runtime-markers.test.mjs': 1,
  'tests/unit/mcp-session-issue.test.mjs': 2,
  'tests/unit/name-axes-to-markup.test.mjs': 2,
  'tests/unit/number-field-contract.test.js': 1,
  'tests/unit/overlay-float-wiring.test.mjs': 1,
  'tests/unit/overlay-group-zorder-wiring.test.mjs': 2,
  'tests/unit/overlay-icon-text-handles.test.mjs': 1,
  'tests/unit/pan-native-scroll.test.js': 2,
  'tests/unit/pan-room-floor.test.js': 1,
  'tests/unit/placeholder-not-content.test.js': 4,
  'tests/unit/project-load-shape-guard.test.mjs': 2,
  'tests/unit/project-search.test.js': 1,
  'tests/unit/prop-title-row-align.test.mjs': 1,
  'tests/unit/recovery-heal-toast-e169.test.js': 1,
  'tests/unit/recovery-ui-wiring.test.mjs': 1,
  'tests/unit/renderer-template-intact.test.js': 1,
  'tests/unit/scratch-drop-size.test.js': 1,
  'tests/unit/scratch-paste-dup.test.js': 2,
  'tests/unit/selection-overlay-ellipse.test.mjs': 1,
  'tests/unit/spacing-wiring.test.js': 1,
  'tests/unit/tpl-browser-sort.test.mjs': 1,
  'tests/unit/tpl-expanded-model.test.mjs': 2,
  'tests/unit/tpl-nav-keys.test.mjs': 2,
  'tests/unit/typo-section-ssot.test.mjs': 2,
  'tests/unit/variation-visible.test.js': 2,
  'tests/unit/variation-write.test.js': 1,
  'tests/unit/win-portability.test.mjs': 1,
  'tests/unit/zoom-text.test.mjs': 2,
  'tests/unit/zoom-wheel-geometric.test.mjs': 1,
};

function census() {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory()
    ? (e.name === 'fixtures' || e.name === 'node_modules' ? [] : walk(path.join(d, e.name)))
    : (/\.m?js$/.test(e.name) ? [path.join(d, e.name)] : []));
  const out = { read: 0, by: {}, sites: 0 };
  for (const f of walk(path.join(ROOT, 'tests'))) {
    if (f === SELF) continue;
    out.read++;
    const n = countWin(fs.readFileSync(f, 'utf8'));
    if (n) { out.by[path.relative(ROOT, f).split(path.sep).join('/')] = n; out.sites += n; }
  }
  return out;
}

test('W0 ★자가 산다 — 미끼 양성·음성 · 읽은 파일 > 0', () => {
  assert.equal(countWin('const b = SRC.slice(i, i + 900);'), 1, '양성: 고정 창을 못 잡는다');
  assert.equal(countWin('const b = SRC.slice(SRC.indexOf("x"), SRC.indexOf("x") + 120);'), 1, '양성: indexOf 식 꼴을 못 잡는다');
  assert.equal(countWin('// SRC.slice(i, i + 900) 금지\n/* s.slice(a, a + 400) */'), 0, '음성: 주석 안 글자를 센다');
  assert.equal(countWin('const c = s.slice(0, 10); const d = s.slice(i, j + 1);'), 0, '음성: 고정 창 아닌 slice 를 센다');
  const c = census();
  console.log(`[218] 읽음 ${c.read} · 창 든 파일 ${Object.keys(c.by).length} · 자리 ${c.sites} · 명부 파일 ${Object.keys(BASE).length} · 명부 자리 ${Object.values(BASE).reduce((a, b) => a + b, 0)}`);
  assert.ok(c.read > 0, '전제: tests/ 를 못 읽었다(0 벌 = 안 쟀다)');
});

test('W1 ★새 파일에 고정 창이 생기지 않았다(명부 밖 0)', () => {
  const c = census();
  const fresh = Object.keys(c.by).filter((f) => !(f in BASE)).map((f) => `${f} ${c.by[f]}`);
  assert.deepEqual(fresh, [], '명부 밖 파일에 고정 창 — sliceBlock/sliceCall/extractFn 으로 «구조»를 떠라(⛔창 넓히기·⛔명부에 더하기)');
});

test('W2 ★명부 안 파일의 창 수가 늘지 않았다 · 줄었으면 명부를 줄여라', () => {
  const c = census();
  const grew = [], shrank = [];
  for (const [f, n] of Object.entries(BASE)) {
    const now = c.by[f] || 0;
    if (now > n) grew.push(`${f} ${n} → ${now}`);
    if (now < n) shrank.push(`${f} ${n} → ${now}`);
  }
  assert.deepEqual(grew, [], '고정 창이 늘었다');
  assert.deepEqual(shrank, [], '고정 창이 줄었다 — 고맙다 · BASE 를 그 수로 줄여라(⛔썩은 면제)');
});
