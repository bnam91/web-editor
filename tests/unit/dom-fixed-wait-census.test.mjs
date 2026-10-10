/* ★★★«고정 대기»가 ★늘지 않는다 — ★DOM spec 의 ★★래칫 자 (지디 ⒝ GO · 2026-10-10)
 *
 * ★★왜 이 자가 생겼나 — ★★머지 18 의 ★사고:
 *   ★load ★106(★선 15의 ★7배)에서 ★`shape-star-b1b3` E3 와 ★`text-style-recent` M·D1 이 ★빨개졌다.
 *   ★같은 판 · ★코드 ★무변 · ★load ★5.35 ⇒ ★★80 passed ⇒ ★★★제품이 아니라 ★★«고정 대기»가 원인.
 *   ⇒ ★★그리고 ★그건 ★한 파일의 흠이 ★아니었다: ★★조건 대기가 ★0 인데 ★고정 대기가 ★있는 spec 이 ★★102벌.
 *   ⇒ ★★★한 파일만 고치면 ★다음 부하에서 ★다른 파일이 ★같이 터진다(지디 ⒟).
 *
 * ★★★이 자가 ★하는 일 = ★★«전수 고치기»가 ★아니라 ★★«늘지 않기».
 *   ⛔남의 레인 ★102벌을 ★내가 ★고치지 ★않는다 — ★★그러면 ★한 사람이 ★모두의 검사를 ★만진다.
 *   ✅대신 ★★새로 ★더하면 ★★그 자리에서 ★빨개진다.
 *
 * ★★자(ruler) — ⛔«수»가 아니라 ★«자»를 ★먼저 적는다(★오늘 ★네 번 ★수가 ★자 때문에 갈렸다):
 *   ★대상 = `tests/dom/*.spec.js` (★★`_root-harness.js` 처럼 ★spec 이 아닌 것은 ★★안 센다)
 *   ★★주석은 ★뗀다 — ★`stripComments` 는 ★«선택»이 아니라 ★★전제다(★양방향으로 틀린다:
 *     ★주석이 ★«있다»를 지어내고(거짓양성) ★«없다»를 가린다(거짓음성))
 *     ★실제로 ★이 레포에서 ★그 둘이 ★다 났다 — ★`history-ipc` / ★`project-trash`
 *     ＋ ★★내 `shape-star-b1b3` 머리말이 ★이제 ★`waitForTimeout` 을 ★★글자로 ★품는다 ⇒ ★안 떼면 ★1 더 센다
 *   ★고정 = /waitForTimeout\(\s*(\d+)\s*\)/ · ★조건 = toPass·waitForFunction·expect.poll·
 *     waitForSelector·toBeVisible·toHaveCount·toHaveText·toHaveAttribute
 *
 * ★★★세 수를 ★★다 잠근다(지디 ⒝) — ⛔«파일 수»만 보면 ★★한 파일에 ★30곳 ★더해도 ★안 걸린다.
 * ★★그리고 ★명부는 ★★«이름»으로 둔다 — ★수만 두면 ★★«어느 파일이 ★늘었나»를 ★못 말한다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { stripComments } = createRequire(import.meta.url)('./_strip-comments.js');
/* ★★임시 루트의 ★임자 = ★`tests/unit/_tmproot.js` · ★잠그는 자 = ★`tmproot-sole-owner.test.mjs`.
 * ⛔★처음 나는 ★여기서 ★`mkdtempSync`＋`rmSync` 를 ★손으로 썼다 ⇒ ★★그 자의 ★T2·T4·T5 가 ★★즉시 ★빨개졌다
 *   ⇒ ★★★내가 ★세운 ★명부가 ★★내 새 파일을 ★★몇 분 만에 ★잡았다. ★★그게 ★자가 ★사는 ★꼴이다 */
const { mkTmpRoot } = createRequire(import.meta.url)('./_tmproot.js');

const ROOT = path.join(import.meta.dirname, '..', '..');
const DOM = path.join(ROOT, 'tests', 'dom');
const SELF = fileURLToPath(import.meta.url);

const FIX_RE = () => /waitForTimeout\(\s*(\d+)\s*\)/g;
const COND_RE = () => /\.toPass\(|waitForFunction\(|expect\.poll\(|waitForSelector\(|toBeVisible\(|toHaveCount\(|toHaveText\(|toHaveAttribute\(/g;

/** ★그 뿌리의 ★spec 을 ★한 벌씩 ★재서 ★돌려준다. ★★`read` 를 ★같이 — ⛔«0 벌»이 ★«안 쟀다»인지 ★가른다. */
function census(dir) {
  const out = { read: 0, bare: {}, sites: 0, ms: 0, filesWithFix: 0 };
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.spec.js')) continue;
    out.read += 1;
    const body = stripComments(fs.readFileSync(path.join(dir, f), 'utf8'));
    const fx = [...body.matchAll(FIX_RE())];
    if (!fx.length) continue;
    out.filesWithFix += 1;
    out.sites += fx.length;
    out.ms += fx.reduce((a, m) => a + Number(m[1]), 0);
    if ((body.match(COND_RE()) || []).length === 0) out.bare[f] = fx.length;
  }
  return out;
}

/* ★★★기준선 — ★★버전관리 ★안에 둔다.
 *   ⛔상태 파일(세션 밖)에 두면 ★★«한 세션용 게이트»가 된다 — ★그건 ★다음 사람에게 ★안 선다.
 * ★★이 수를 ★★«내리는» 것은 ★좋다(★고쳤다는 뜻) — ★★그런데 ★★★말없이 ★내려가면 ★안 된다:
 *   ⇒ ★★★판정은 ★★«늘지 ★않는다»만이다(★지디 조건 2026-10-11 · ★이 파일의 ★첫 판은 ★양방향이었다).
 *   ★★왜 ★고쳤나: ★★«줄었다»를 ★FAIL 로 ★두면 ★★★고친 사람이 ★빨강을 ★본다 ⇒ ★고침에 ★벌을 ★매긴다.
 *   ⇒ ★★줄어듦은 ★★«틈(slack)»으로 ★★수를 ★찍는다 — ⛔조용히 ★넘기지도 ★않는다.
 *     ★치르는 값: ★기준선을 ★안 내리면 ★★그 틈만큼 ★다시 ★자라도 ★초록이다(★그래서 ★매회 ★찍는다). */
const BASE_SITES = 1315;
const BASE_MS = 375120;
/* ══ ★★★이 ★수의 ★★«장부» — ★★지디 조건(2026-10-11): ⛔«수»만 두지 ★마라 ════════════════
 *   ★★「그 수가 ★어느 판에서 ★어느 식으로 ★센 수인가」를 ★★이 파일 ★안에 ★적는다.
 *   ★까닭(지디 원문): ⛔이게 없으면 ★다음 사람이 ★★다른 자로 센 ★11 을 ★「늘었다」로 ★읽거나
 *                      ★9 를 ★「줄었다」로 ★읽는다.
 *   ★★`BASE_AT` 은 ★★`git blame` 에서 ★뽑았다 — ⛔손으로 ★적지 ★않았다
 *     (★지디가 ★첫 판에서 ★예외 ★이름을 ★손으로 적어 ★한 글자가 ★달라 ★★예외가 ★안 걸렸다) */
const BASE_AT = 'e6d7c337';   // ★이 두 수를 ★들인 커밋(= 이 파일을 ★처음 ★들인 커밋)
const BASE_HOW = [
  '★뿌리 = tests/dom (★`countScannable()` 이 ★분모를 ★찍는다)',
  '★곳 = `waitForTimeout(<수>)` 의 ★출현 수 · ★합ms = ★그 <수> 들의 ★합',
  '★주석은 ★떼고 ★센다(stripComments) — ⛔주석의 ★예시가 ★측정값이 ★되지 ★않게',
].join(' · ');

/** ★★조건 대기가 ★0 인데 ★고정 대기가 ★있는 spec — ★★이름 ⇒ ★곳 수. ★★2026-10-10 실측. */
const BARE = {
  'text-selection-panel.dom.spec.js': 53,
  'grid-children.dom.spec.js': 33,
  'grid-children-delete.dom.spec.js': 26,
  'grid-cell-bg-image.dom.spec.js': 24,
  'e80-fix.dom.spec.js': 22,
  'grid-width-ui.dom.spec.js': 19,
  'grid-block-bg.dom.spec.js': 17,
  'asset-x-select-r2.dom.spec.js': 15,
  'effects-registry.dom.spec.js': 15,
  'grid-gap-line-height.dom.spec.js': 15,
  'ln-line-move.dom.spec.js': 14,
  'rich-text-consumer-modal.dom.spec.js': 14,
  'rich-text-consumer-sticker.dom.spec.js': 14,
  'frame-keep-empty.dom.spec.js': 13,
  'sz7-grid-rich-text.dom.spec.js': 13,
  'bubble-shortcut-not-in-text.dom.spec.js': 11,
  'c4-settle-restamp.dom.spec.js': 11,
  'text-tone-dark-bg.dom.spec.js': 11,
  'free-frame-fullwidth-drag.dom.spec.js': 10,
  'l1-guide-align.dom.spec.js': 10,
  'sz7-probe-panel-vs-drag.dom.spec.js': 10,
  'def01-pair-blocks.dom.spec.js': 9,
  'ds-colorvar-add.dom.spec.js': 9,
  'frame-padding.dom.spec.js': 9,
  'free-frame-grid-width-roundtrip.dom.spec.js': 9,
  'grid-circle-text.dom.spec.js': 9,
  'grid-img-circle.dom.spec.js': 9,
  'grid-line-paste-single.dom.spec.js': 9,
  'modal-frameify-delete.dom.spec.js': 9,
  'page-name-edit-exit.dom.spec.js': 9,
  'rich-text-loss-axes.dom.spec.js': 9,
  'section-split.dom.spec.js': 9,
  'asset-to-scratch-move.dom.spec.js': 8,
  'frame-clip-toggle.dom.spec.js': 8,
  'frame-dblclick-overlay.dom.spec.js': 8,
  'grid-drop-cell-rect.dom.spec.js': 8,
  'grid-drop-textblock-cell.dom.spec.js': 8,
  'icon-overlay.dom.spec.js': 8,
  'multisel-save-and-copy.dom.spec.js': 8,
  'sz27-partial-format-wall.dom.spec.js': 8,
  'asset-rename-reentry.dom.spec.js': 7,
  'bullet-list-style.dom.spec.js': 7,
  'grid-overlay.dom.spec.js': 7,
  'modal-overlay-float.dom.spec.js': 7,
  'sz7-modal-not-widened.dom.spec.js': 7,
  'tab-name-edit-exit.dom.spec.js': 7,
  'frame-clip-drag.dom.spec.js': 6,
  'grid-cell-selected-leak.dom.spec.js': 6,
  'grid-img-circle-outline.dom.spec.js': 6,
  'marquee-sections-blocks.dom.spec.js': 6,
  'multisel-fontsize-mix.dom.spec.js': 6,
  'save-load-roundtrip-1001.dom.spec.js': 6,
  'small-fixes-e148-e38-e28.dom.spec.js': 6,
  'tpl-pagepad-e81.dom.spec.js': 6,
  'asset-drop-position.dom.spec.js': 5,
  'asset-preview.dom.spec.js': 5,
  'asset-secbg.dom.spec.js': 5,
  'divider-width.dom.spec.js': 5,
  'frame-stack-align.dom.spec.js': 5,
  'graph-bar-settings-vpair.dom.spec.js': 5,
  'grid-line-bold-role.dom.spec.js': 5,
  'overlay-align-shape-frame.dom.spec.js': 5,
  'shape-star-count.dom.spec.js': 5,
  'stack-frame-cmd-arrow.dom.spec.js': 5,
  'asset-clip-toggle.dom.spec.js': 4,
  'checker-dark-text-tone.dom.spec.js': 4,
  'free-frame-drop-keeps-siblings.dom.spec.js': 4,
  'grid-cross-cell-undo.dom.spec.js': 4,
  'grid-nested-ratio.dom.spec.js': 4,
  'grid-row-gap-negative.dom.spec.js': 4,
  'marquee-edge-autoscroll.dom.spec.js': 4,
  'modal-enter-newline.dom.spec.js': 4,
  'paste-external-image.dom.spec.js': 4,
  'sz7-probe-linelevel.dom.spec.js': 4,
  'sz7-rich-text-other-consumers.dom.spec.js': 4,
  'asset-align-stale-margin.dom.spec.js': 3,
  'asset-open-heal-beyond-edge.dom.spec.js': 3,
  'chat-slider-number-bound.dom.spec.js': 3,
  'grid-badge-radius.dom.spec.js': 3,
  'ln-default-addr.dom.spec.js': 3,
  'overlay-align.dom.spec.js': 3,
  'scratch-cut.dom.spec.js': 3,
  'tab-name-injection.dom.spec.js': 3,
  'dblclick-outside-frame-unchanged.dom.spec.js': 2,
  'def01-history-step.dom.spec.js': 2,
  'def01-pair-grid.dom.spec.js': 2,
  'frame-grid-dblclick-parity.dom.spec.js': 2,
  'free-frame-grid-width-exits.dom.spec.js': 2,
  'graph-gr-overlay.dom.spec.js': 2,
  'modal-frameify-pixel.dom.spec.js': 2,
  'panel-field-autoselect.dom.spec.js': 2,
  'checker-pixel-identity.dom.spec.js': 1,
  'frame-empty-no-dashed.dom.spec.js': 1,
  'frame-zoom-group-select.dom.spec.js': 1,
  'fx-glow-sticker.dom.spec.js': 1,
  'grid-flatten-columns.dom.spec.js': 1,
  'grid-newline-font.dom.spec.js': 1,
  'grid-role-color-preset.dom.spec.js': 1,
  'ln-nohistory.dom.spec.js': 1,
  'modal-font.dom.spec.js': 1,
  'modal-rotate.dom.spec.js': 1,
  'T12-gridcol-probe.dom.spec.js': 1,};

test('W1 ★★자가 ★살아있다 — ★합성 표본으로 ★양성·음성 ★둘 다 (⛔이게 없으면 아래 수는 «안 쟀다»와 같다)', () => {
  /* ★★★0 이 될 수 있는 축이 ★아니지만 ★★자가 ★죽으면 ★수가 ★0 이 되고
   *   ⇒ ★★그 ★0 은 ★★«늘지 않았다»로 ★★초록으로 ★보인다 ⇒ ★★그래서 ★양성대조가 ★필요하다(지디 ⒝).
   * ⛔★표본 글자는 ★★조립한다 — ★안 그러면 ★★이 파일이 ★★제 자의 ★입력이 된다(★T7 과 ★같은 병). */
  const FIX = 'waitFor' + 'Timeout';
  const dir = mkTmpRoot('census-fixture-');
  {
    fs.writeFileSync(path.join(dir, 'bare.dom.spec.js'), `await page.${FIX}(250);\n`);
    fs.writeFileSync(path.join(dir, 'mixed.dom.spec.js'), `await page.${FIX}(250);\nawait page.waitForFunction(() => true);\n`);
    fs.writeFileSync(path.join(dir, 'clean.dom.spec.js'), 'await page.waitForFunction(() => true);\n');
    fs.writeFileSync(path.join(dir, 'commented.dom.spec.js'), `/* await page.${FIX}(999); */\nconst a = 1;\n`);
    fs.writeFileSync(path.join(dir, 'notaspec.js'), `await page.${FIX}(250);\n`);
    const c = census(dir);
    assert.equal(c.read, 4, `★spec 만 ★읽어야 한다(★`.concat(`notaspec.js 는 ★제외) — ★읽은 수: ${c.read}`));
    assert.deepEqual(Object.keys(c.bare).sort(), ['bare.dom.spec.js'],
      '★★양성·음성 ★동시 실패 — ★★`bare` 하나만 ★걸려야 한다(★mixed=조건 있음 · ★clean=고정 없음 · '
      + '★commented=주석 속). ★잡은 것: ' + JSON.stringify(Object.keys(c.bare).sort()));
    assert.equal(c.sites, 2, `★곳 수 — ★bare 1 ＋ ★mixed 1 = 2 (★잰 값: ${c.sites})`);
    assert.equal(c.ms, 500, `★합 ms — 250＋250 (★잰 값: ${c.ms})`);
  }
});

test('W2 ★★★전제 — ★진짜 뿌리를 ★참으로 ★걸었나 (⛔«0 벌»이 «깨끗하다»인지 «안 쟀다»인지 가른다)', () => {
  const c = census(DOM);
  assert.ok(c.read > 0, '★★`tests/dom` 에서 ★읽은 spec 이 ★0벌이다 ⇒ ★★아래 수는 ★★«안 쟀다»다');
  console.log(`    ★★읽은 spec ${c.read}벌 · ★고정 대기를 쓰는 파일 ${c.filesWithFix}벌`
    + ` · ★★곳 ${c.sites} (기준 ${BASE_SITES}) · ★★합 ${c.ms}ms (기준 ${BASE_MS})`
    + ` · ★★★조건 0 인 파일 ${Object.keys(c.bare).length}벌 (명부 ${Object.keys(BARE).length}벌)`);
});

test('W3 ★★★«늘지 않는다» — ★곳 수·합 ms 가 ★늘면 ★빨강 · ★★줄면 ★찍기만 (⛔고친 사람이 ★빨강을 보지 않게)', () => {
  const c = census(DOM);
  assert.ok(c.read > 0, '★전제 미달 — ★읽은 spec 0벌');
  /* ★★★지디 조건(2026-10-11): ★★«늘지 않는다»만 ★걸어라 — ⛔«줄었다»를 ★FAIL 로 ★두면
   *   ★★★고친 사람이 ★빨강을 ★본다. ★그건 ★★고치는 일에 ★★벌을 ★매기는 ★자다.
   *   ⇒ ★★그래서 ★줄어듦은 ★★찍기만 ★한다(★아래 `console.log`).
   *
   * ★★★이 느슨함의 ★★값은 ★치른다 — ★적어 둔다:
   *   ★기준선을 ★★안 내리면 ★★그 틈(slack)만큼 ★★다시 ★자라도 ★★초록이다.
   *   ⇒ ★★그래서 ★★틈을 ★★매 회차 ★★수로 ★찍는다(⛔«줄었다»를 ★조용히 ★넘기지 ★않는다).
   * ★★★그리고 ★«줄었다»가 ★★«자가 ★죽었다»일 ★수도 ★있다 —
   *   ⇒ ★그 갈림은 ★★`W1`(합성 표본 ★양성·음성)과 ★★`W2`(뿌리 전제)가 ★잡는다.
   *     ⛔둘 중 ★하나라도 ★빠지면 ★★이 느슨함을 ★★두지 ★마라. */
  const slackSites = BASE_SITES - c.sites;
  const slackMs = BASE_MS - c.ms;
  if (slackSites > 0 || slackMs > 0) {
    console.log(`    ★★★«줄었다»(★좋다) — ★곳 ${BASE_SITES} → ${c.sites} (★틈 ${slackSites})`
      + ` · ★합ms ${BASE_MS} → ${c.ms} (★틈 ${slackMs})`);
    console.log('      ⇒ ★★기준선을 ★내리면 ★그 틈만큼 ★★다시 ★자라는 것을 ★막는다(⛔FAIL 은 ★아니다)');
  }
  assert.ok(c.sites <= BASE_SITES,
    `★★고정 대기가 ★늘었다: ★${BASE_SITES} → ★★${c.sites} (★＋${c.sites - BASE_SITES}곳)\n`
    + `  ★이 기준선의 ★장부: ★판 ${BASE_AT} · ★식 ${BASE_HOW}\n`
    + '  ⇒ ★★`waitForFunction`/`expect.poll`/`waitStableRect` 로 ★써라(★레포 관용구)\n'
    + '  ⇒ ⛔수를 ★키우는 것(250 → 1000)은 ★답이 ★아니다 — ★더 느린 판에서 ★또 ★깨진다');
  assert.ok(c.ms <= BASE_MS,
    `★★합 ms 가 ★늘었다: ★${BASE_MS} → ★${c.ms} (★＋${c.ms - BASE_MS}ms)\n`
    + `  ★이 기준선의 ★장부: ★판 ${BASE_AT} · ★식 ${BASE_HOW}\n`
    + '  ⇒ ★★«곳 수»가 같아도 ★★한 곳의 ★수를 ★키우면 ★여기서 ★걸린다(★그게 ★이 칸이 ★따로 있는 ★까닭)');
});

test('W4 ★★★명부는 ★«이름»이다 — ★명부 ⊇ 실측 ＋ ★명부 밖 0 (⛔등호로 닫지 않는다 · 지디 ⒦)', () => {
  const c = census(DOM);
  assert.ok(c.read > 0, '★전제 미달 — ★읽은 spec 0벌');
  const seen = Object.keys(c.bare).sort();
  /* ⒜ ★★명부 ★밖이 ★0 — ★본 단언. ★★새 파일이 ★«조건 0» 으로 ★들어오면 ★★이름으로 ★빨개진다 */
  const outside = seen.filter((f) => !(f in BARE));
  assert.deepEqual(outside, [],
    `★★조건 대기 ★없이 ★고정 대기만 ★쓰는 spec 이 ★★명부 ★밖에 ★${outside.length}벌 생겼다:\n  `
    + outside.map((f) => `· ${f} (${c.bare[f]}곳)`).join('\n  ')
    + '\n  ⇒ ★★부하가 ★오면 ★★이 파일들이 ★★같이 ★터진다(★머지 18 에서 ★그랬다)');
  /* ⒝ ★★★명부가 ★낡았나 — ⛔★이것도 ★★FAIL 로 ★두지 ★않는다(★지디 조건 2026-10-11).
   *   ★★★이 구멍은 ★★변이가 ★찾았다: ★`waitForTimeout` 을 ★`waitForFunction` 으로 ★★고치면
   *     ★그 파일이 ★«조건 0» 명부에서 ★★빠진다 ⇒ ★★★즉 ★★고친 사람이 ★★여기서 ★빨강을 ★본다.
   *     ★★W3 만 ★고치고 ★이 칸을 ★두었더니 ★★변이 B 가 ★★W4 로 ★빨개졌다 — ★내 고침이 ★반쪽이었다.
   *   ⇒ ★★찍기만 ★한다. ★★«자가 ★죽어서» 줄어든 ★갈림은 ★★`W1`·`W2` 가 ★잡는다. */
  const stale = Object.keys(BARE).filter((f) => !(f in c.bare)).sort();
  if (stale.length) {
    console.log(`    ★★★«고쳐졌다»(★좋다) — ★명부에 ★«이제 ★안 그런» 파일 ★${stale.length}벌: ${stale.join(' ')}`);
    console.log('      ⇒ ★명부에서 ★빼면 ★그 자리가 ★다시 ★«조건 0» 으로 ★돌아가는 것을 ★막는다(⛔FAIL 은 ★아니다)');
  }
  /* ⒞ ★★곳 수까지 ★이름별로 — ⛔«한 파일에 ★30곳 ★더하기»를 ★막는다 */
  const grew = seen.filter((f) => (BARE[f] ?? 0) < c.bare[f])
    .map((f) => `${f}: ${BARE[f]} → ${c.bare[f]}`);
  assert.deepEqual(grew, [],
    `★★명부 ★안에서 ★곳 수가 ★늘었다:\n  · ${grew.join('\n  · ')}`);
});

test('W5 ★★이 파일 ★자신이 ★제 자의 ★입력이 ★아닌가 (★T7 과 ★같은 병)', () => {
  /* ★★이 파일은 ★`tests/unit` 에 산다 ⇒ ★★`tests/dom` 을 걷는 ★자에 ★안 걸린다 — ★그걸 ★단언한다.
   * ★★그리고 ★표본 글자를 ★조립해 ★썼으니 ★★본문에 ★«고정 대기» 꼴이 ★★0 이어야 한다. */
  const raw = fs.readFileSync(SELF, 'utf8');
  const body = stripComments(raw);
  const n = (body.match(FIX_RE()) || []).length;
  assert.equal(n, 0,
    `★이 파일 ★본문에 ★«고정 대기» 꼴이 ★${n}건 생겼다 — ★★표본은 ★★조립해서 써라(’waitFor’＋’Timeout’)`);
  assert.ok(!path.relative(DOM, SELF).startsWith('..') === false,
    '★이 파일이 ★`tests/dom` 안에 있다 — ★★그러면 ★제 자가 ★자기를 ★센다');
});
