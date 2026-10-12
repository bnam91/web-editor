/* thumb-box-reflect.test.mjs — ★썸네일 전용 반사 대체의 ★배선과 ★범위 (C 버그 ② · 2026-10-08 지디 레인 gd/thumb)
 *
 * ★★이 검사가 ★«무엇을 잠그지 않는가»부터 적는다:
 *   ⛔「거울이 ★맞게 그려진다」를 ★안 건다 — ★그건 ★픽셀이라야 알 수 있다
 *     (tests/dom/thumb-canvas-parity.dom.spec.js C2-a 가 ★캔버스 ↔ ★썸네일 픽셀로 잰다).
 *   ⛔「반사가 html2canvas 에서 ★빠진다」도 ★안 건다 — ★이미 ★픽셀로 잠근 자가 있다
 *     (tests/dom/effects-reflection.dom.spec.js ★R4: h2c 대체 경로 = [255,255,255]).
 *   ⇒ ★여기서 잠그는 것은 ★«구조» 둘뿐이다: ⒜ 썸네일이 ★부른다 ⒝ ★PNG 는 ★안 부른다 ⒞ 명부가 ★하나다.
 *
 * ★★⒝ 가 ★이 검사의 ★핵이다 — ★범위 결정을 ★구조로 잠근다:
 *   PNG 는 ★주 경로가 CDP 네이티브라 ★브라우저가 반사를 ★제대로 그린다. 그 길의 클론에 거울을 세우면
 *   ★반사가 ★두 겹이 된다. 그리고 ★R4 가 ★PNG 의 h2c 대체 경로를 「흰색(의도됨)」으로 ★고정해 뒀다.
 *   ⇒ ★누가 「공용 길로 옮기면 깔끔하다」며 ★export-image 쪽에도 걸면 ★여기서 막힌다.
 *
 * ⚠️★양성대조의 ★세기 — 핀(기준판 c76dcbaf)에서 이 파일은 ★빨강이다. ★다만 그 빨강은
 *   ★«새 기능이 ★없어서» 빨강이다(★약한 양성). ★강한 양성은 ★픽셀 자(DOM C2-a)가 맡는다.
 *   ⇒ ★그래서 ★여기 ★단언들은 ★전부 ★«항상 참이 아닌» 꼴로 적었다 — ⒝ 는 ★고친 판에서도 ★깨질 수 있다.
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const { stripComments } = require('./_strip-comments.js');

const ROOT = path.join(import.meta.dirname, '..', '..');
const SAFETY = stripComments(readSrc(ROOT, 'js', 'io', 'capture-safety.js'));
const SAVE   = stripComments(readSrc(ROOT, 'js', 'io', 'save-load.js'));
const EXPORT = stripComments(readSrc(ROOT, 'js', 'io', 'export-image.js'));
const REFLECT = stripComments(readSrc(ROOT, 'js', 'effects-reflect.js'));

const FN = 'neutralizeBoxReflectForH2C';

/* ─────────────────────────────────────────────
   T0 ★입력이 살아 있다 — ⛔거르개가 코드를 먹었으면 아래 전부가 «조용히» 초록이 된다
   ───────────────────────────────────────────── */
test('T0 ★입력이 살아 있다 — 네 소스 ＋ 형제 토큰(이 건과 무관하게 존재한다)', () => {
  for (const [n, s, min] of [['capture-safety', SAFETY, 4000], ['save-load', SAVE, 20000], ['export-image', EXPORT, 10000], ['effects-reflect', REFLECT, 1500]]) {
    assert.ok(s.trim().length > min, `${n}: 주석 턴 뒤 ${s.trim().length}자 — 거르개가 코드를 먹었다`);
  }
  assert.match(SAFETY, /export function stripEditorOnlyForCapture\(/, '형제 토큰(capture-safety)');
  assert.match(SAVE, /async function captureThumbnail\(/, '형제 토큰(save-load)');
  assert.match(EXPORT, /export async function prepareCloneForCapture\(/, '형제 토큰(export-image)');
  assert.match(REFLECT, /export function fxReflectOf\(/, '형제 토큰(effects-reflect)');
});

/* ─────────────────────────────────────────────
   ⒜ ★썸네일이 부른다 — ★captureThumbnail ★몸 안에서
   ───────────────────────────────────────────── */
test('⒜ ★captureThumbnail 이 반사 대체를 «부른다» (이름이 파일에 있는 게 아니라)', () => {
  assert.match(SAFETY, new RegExp(`export function ${FN}\\(`), `★${FN} 이 capture-safety 에 없다`);
  const j = SAVE.indexOf('async function captureThumbnail(');
  assert.ok(j > 0, 'captureThumbnail 이 없다');
  /* ★몸만 떼어 본다 — 다음 함수 머리까지. ⛔파일 전체 grep 으로 닫으면 «import 줄만 있어도» 초록이다. */
  const end = SAVE.indexOf('async function saveProjectToFile(', j);
  assert.ok(end > j, 'captureThumbnail 다음 함수를 못 찾았다 — 꼴이 바뀌었나');
  const body = SAVE.slice(j, end);
  assert.ok(body.includes(`${FN}(clone`), `★captureThumbnail 몸 안에서 ${FN}(clone …) 을 안 부른다`);
});

/* ─────────────────────────────────────────────
   ⒝ ★PNG 는 안 부른다 — ★범위를 ★구조로 잠근다(R4 를 지킨다)
   ───────────────────────────────────────────── */
test('⒝ ★export-image(PNG)는 반사 대체를 «안» 부른다 — 주 경로가 CDP 네이티브라 두 겹이 된다 ＋ R4 가 흰색으로 고정', () => {
  assert.ok(!EXPORT.includes(FN),
    `★export-image 가 ${FN} 을 부른다 — ⛔PNG 주 경로(CDP)는 반사를 «제대로» 그린다(두 겹) ` +
    `· 그리고 tests/dom/effects-reflection R4 가 h2c 대체 경로를 [255,255,255] 로 고정해 뒀다. ` +
    `★옮기려면 R4 와 설계서 명부를 «같이» 고쳐라.`);
  /* ★그리고 그 R4 가 ★아직 있다 — 없어지면 내 ⒝ 의 까닭 절반이 거짓이 된다(★선례가 폐기될 수 있다). */
  const r4 = readSrc(ROOT, 'tests', 'dom', 'effects-reflection.dom.spec.js');
  assert.ok(r4.includes('html2canvas 대체 경로 = 흰색(반사 없음)'),
    '★R4 의 「h2c = 흰색(의도됨)」 단언이 사라졌다 — ⒝ 의 까닭을 다시 적어라');
});

/* ─────────────────────────────────────────────
   ⒞ ★명부가 하나다 — 값을 ★정본에서 읽는다
   ───────────────────────────────────────────── */
test('⒞ ★간격·길이·불투명도를 ★정본(fxReflectOf)에서 «읽는다» — ⛔인라인 webkitBoxReflect 문자열을 파싱하지 않는다', () => {
  const j = SAFETY.indexOf(`export function ${FN}(`);
  assert.ok(j > 0, `${FN} 이 없다`);
  const body = SAFETY.slice(j);
  assert.ok(/fxReflectOf/.test(body), '★정본 fxReflectOf 를 안 쓴다 — 값 명부가 둘이 된다');
  /* ⛔인라인 `-webkit-box-reflect` 문자열에서 ★값을 뽑는 꼴을 막는다 — gap·len·op 는 ★fx(정본)에서만 온다.
     ★현재 코드가 raw 를 쓰는 자리는 ★단 하나: `/^\s*below\b/i.test(raw)` = ★「우리 꼴인가」 ★판정이고 ★값이 아니다.
     ★★이 자가 ★항등식이 ★아님을 ★이 자리에서 ★증명한다 — ⛔「안 걸린다」만 보면 ★틀린 정규식도 ★초록이다.
       ★초판이 ★그랬다(2026-10-09): `linear-gradient\\(to bottom` 이 ★«역슬래시＋(»를 찾아
       ★소스에 ★없는 꼴을 ★뒤졌고 ⇒ ★아무것도 ★안 잠근 채 ★초록이었다(★핀에서도 ★그 줄만은 ★참).
     ⇒ ★먼저 ★반례에 ★걸리는지 ★확인하고, ★그 다음 ★본문에 ★안 걸리는지 ★본다. */
  const PARSE_RAW = /\braw\s*\.\s*(match|matchAll|replace|split|slice|substring|indexOf)\b|\bexec\s*\(\s*raw\s*\)/;
  for (const bad of [
    'const len = raw.match(/([\\d.]+)%/)[1];',
    'const op = /rgba\\([^)]*,([\\d.]+)\\)/.exec(raw)[1];',
    'const g = raw.split(" ")[1];',
  ]) assert.ok(PARSE_RAW.test(bad), `★자기 전제 — 이 자가 반례를 ★못 잡는다: ${bad}`);
  assert.ok(!PARSE_RAW.test(body),
    '★인라인 webkitBoxReflect 문자열에서 ★값을 뽑는다 — 정본이 ★둘이 된다(값은 fxReflectOf 에서만)');
  /* ★그리고 raw 를 ★쓰는 자리가 ★판정 ★하나뿐이다 — 늘어나면 ★여기서 보고 다시 판단하게 한다. */
  const rawUses = (body.match(/\braw\b/g) || []).length;
  assert.ok(rawUses <= 2, `★raw 를 ${rawUses}곳에서 쓴다 — 선언 1 ＋ 꼴 판정 1 이 전부여야 한다`);
  assert.ok(/fx\.gap/.test(body) && /fx\.len/.test(body) && /fx\.op/.test(body),
    '★gap·len·op 셋을 ★fx(정본)에서 받지 않는다');
  /* ★정본 쪽도 ★아직 그 이름이다 — 이름이 바뀌면 내 다리가 ★조용히 null 을 받는다(안전실패로 거울 0개). */
  assert.match(REFLECT, /Object\.assign\(window,\s*\{[^}]*fxReflectOf/, '★window 다리(fxReflectOf)가 사라졌다 — 내 호출이 조용히 죽는다');
});
