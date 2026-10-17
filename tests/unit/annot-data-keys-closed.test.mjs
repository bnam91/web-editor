/* ══════════════════════════════════════════════════════════════════════════
   annot-data-keys-closed — N3 (★1017t1h5 설계서 「새 dataset 키의 다섯 자리」⑤ 를 소스에서 잠근다)
   ──────────────────────────────────────────────────────────────────────────
   무슨 일을 막나:
     js/blocks/annotation-block.js 의 ANNOT_DATA_KEYS(:395-398)는 js/io/save-load.js:1391
     `for (const k of window.ANNOT_DATA_KEYS)` 이 rebindAll(로드·⌘Z 복원)에서 되돌려 쓰는 키 명부다.
     makeAnnotationBlock 이 dataset 에 쓰는 키를 그 명부에 «같이» 안 넣으면, 패널에서 바꾼 값이
     라이브엔 보이는데 리로드·⌘Z 복원 뒤엔 조용히 사라진다(검사 0건이던 자리 — 설계서 h5 ⑶).

   ⛔손 명부 금지 — 기대값(=팩토리가 실제로 쓰는 키)도 ANNOT_DATA_KEYS 도 둘 다 «소스에서 파생»한다.
   양성: 지금 판에서 차집합 0.
   음성(계측기 자가검사): ANNOT_DATA_KEYS 문자열에서 한 키를 빼 변형본을 만들면 차집합이 1이 된다.
═══════════════════════════════════════════════════════════════════════════ */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC_PATH = path.join(ROOT, 'js', 'blocks', 'annotation-block.js');

/* makeAnnotationBlock 의 함수 본문만 자른다(그 밖의 block.dataset.* 는 다른 함수 — annotSetLabelOffset 등
   이미 ANNOT_DATA_KEYS 로 커버되는 labelDx/labelDy/anchorRot 를 또 쓰므로 범위를 좁혀야 중복이 안 센다). */
function factoryBody(src) {
  const start = src.indexOf('function makeAnnotationBlock(');
  assert.ok(start >= 0, '★전제: makeAnnotationBlock 정의를 찾았다');
  const end = src.indexOf('\nwindow.makeAnnotationBlock = makeAnnotationBlock;', start);
  assert.ok(end > start, '★전제: 함수의 끝(window 노출 줄)을 찾았다');
  return src.slice(start, end);
}

/* `block.dataset.KEY` ( = 대입 꼴, delete 포함) 전부. ⛔`.dataset.type`은 블럭 타입 판별자라
   의도적으로 ANNOT_DATA_KEYS 밖(다른 블럭도 전부 그렇다 — rebindAll 이 type 으로 팩토리를 고른다). */
const DATASET_KEY_RE = /\bblock\.dataset\.([A-Za-z_$][\w$]*)\s*=/g;
const EXCLUDED = new Set(['type']);   // ★이유: 블럭 타입 판별자, 라운드트립 「값」이 아니다(다른 블럭 팩토리도 전부 제외).

function writtenKeys(body) {
  const out = new Set();
  for (const m of body.matchAll(DATASET_KEY_RE)) {
    if (EXCLUDED.has(m[1])) continue;
    out.add(m[1]);
  }
  return out;
}

/** ANNOT_DATA_KEYS = [ ... ]; 배열 리터럴을 파싱 — 손으로 옮겨적지 않는다(소스에서 직접 평가). */
function declaredKeys(src) {
  const m = src.match(/const ANNOT_DATA_KEYS = (\[[\s\S]*?\]);/);
  assert.ok(m, '★전제: ANNOT_DATA_KEYS 정의를 찾았다');
  const arr = JSON.parse(m[1].replace(/'/g, '"'));
  return { set: new Set(arr), literalBlock: m[0], arr };
}

test('N3-양성 ★ANNOT_DATA_KEYS ⊇ 팩토리가 쓰는 dataset 키 전부 (차집합 0 · 지금 판)', () => {
  const src = fs.readFileSync(SRC_PATH, 'utf8');
  const body = factoryBody(src);
  const written = writtenKeys(body);
  const { set: declared } = declaredKeys(src);
  assert.ok(written.size > 0, '★전제: 팩토리가 실제로 dataset 키를 쓴다(계측기 자가검사)');
  const missing = [...written].filter(k => !declared.has(k));
  assert.deepEqual(missing, [], `ANNOT_DATA_KEYS 에 없는 키(차집합) = ${JSON.stringify(missing)}`);
});

test('N3-음성(계측기 자가검사) ★ANNOT_DATA_KEYS 에서 한 키를 빼면 차집합이 1이 된다', () => {
  const src = fs.readFileSync(SRC_PATH, 'utf8');
  const body = factoryBody(src);
  const written = writtenKeys(body);
  const { literalBlock, arr } = declaredKeys(src);
  assert.ok(arr.includes('labelPad'), '★전제: 1017t1h5 가 추가한 키가 지금 명부에 있다');
  // ★문자열 수술 — 포맷(줄바꿈·들여쓰기)은 그대로 두고 그 키 하나만 ", 'labelPad'" 꼴로 걷어낸다.
  const sabotagedLiteral = literalBlock.replace(/,\s*'labelPad'(?=\s*\])/, '');
  assert.notEqual(sabotagedLiteral, literalBlock, '★전제: 걷어내기가 실제로 문자열을 바꿨다');
  const sabotagedSrc = src.replace(literalBlock, sabotagedLiteral);
  assert.notEqual(sabotagedSrc, src, '★전제: 변형본이 실제로 소스를 바꿨다');
  const { set: sabotagedDeclared } = declaredKeys(sabotagedSrc);
  const missing = [...written].filter(k => !sabotagedDeclared.has(k));
  assert.deepEqual(missing, ['labelPad'], `한 키를 빼면 차집합이 정확히 그 키 1개여야 한다(지금: ${JSON.stringify(missing)})`);
});
