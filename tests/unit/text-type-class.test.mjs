/* U-TEXTTYPE — 텍스트 타입 전환이 글자 효과 클래스를 지우지 않는가 (0920r4 texttype, T-059)
 *   실행: npm test (node --test 'tests/unit/*.test.mjs' 'tests/unit/*.test.js')
 *
 * 결함: 패널 타입 버튼(prop-text-wireup-type.js)·단축키 1~4(editor.js)가 `contentEl.className = cls` 로
 *   클래스 목록을 통째로 덮어 .tgs(그라데이션 글자 그림자=글자 «뒤») · .text-effect .tfx-neon · .tfx-metallic 등이 사라졌다.
 * U1·U2 = 헬퍼 동작, U3 = 두 호출 자리의 소스 가드(+ 옛 코드에선 걸린다는 양성대조), U4 = 뒤처리 호출 순서.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../../');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

// js/*.js 는 package.json type:commonjs 라 Node 가 CJS 로 읽는다 → .mjs 별칭으로 복사해 import (선례 align-btn-ssot)
const _tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'text-type-class-'));
const _alias = path.join(_tmpDir, 'text-type-class.mjs');
fs.writeFileSync(_alias, read('js/props/text-type-class.js'));
const { TEXT_TYPE_CLASSES, setTextTypeClass, afterTextTypeChange } = await import(pathToFileURL(_alias).href);
fs.rmSync(_tmpDir, { recursive: true, force: true });

function fakeEl(classes) {
  let set = [...classes];
  return {
    classList: {
      contains: (x) => set.includes(x),
      [Symbol.iterator]: () => [...set][Symbol.iterator](),
    },
    getAttribute: (n) => (n === 'class' ? set.join(' ') : null),
    setAttribute: (n, v) => { if (n === 'class') set = String(v).split(/\s+/).filter(Boolean); },
    get list() { return [...set]; },
  };
}

test('U1 타입 클래스만 바뀌고 효과 클래스(tgs·text-effect·tfx-*)는 보존', () => {
  const el = fakeEl(['tb-body', 'text-effect', 'tfx-neon', 'tgs', 'tfx-tex-dots']);
  setTextTypeClass(el, 'tb-h2');
  assert.ok(!el.classList.contains('tb-body'));
  assert.ok(el.classList.contains('tb-h2'));
  for (const c of ['text-effect', 'tfx-neon', 'tgs', 'tfx-tex-dots']) assert.ok(el.classList.contains(c), c);
  assert.equal(el.list.length, 5);
  // ★타입 클래스가 맨 앞 — `[class^="tb-"]` 셀렉터(레포 17곳)가 계속 찾는다
  assert.equal(el.list[0], 'tb-h2');
  assert.equal(el.getAttribute('class'), 'tb-h2 text-effect tfx-neon tgs tfx-tex-dots');
});

test('U1b [class^="tb-"] 셀렉터에 의존하는 곳이 있다 = 타입 클래스 «맨 앞» 규칙이 필요한 이유(양성대조)', () => {
  const n = ['js/block-edit.js', 'js/canvas-state.js', 'js/editor.js'].reduce((a, f) => a + (read(f).match(/\[class\^="tb-"\]/g) || []).length, 0);
  assert.ok(n >= 3, 'prefix selector count ' + n);
});

test('U2 타입 클래스가 둘 섞인 비정상 입력도 하나로 정규화', () => {
  const el = fakeEl(['tb-h1', 'tfx-metallic', 'tb-bullet', 'text-effect']);
  setTextTypeClass(el, 'tb-caption');
  assert.deepEqual(el.list.filter(c => TEXT_TYPE_CLASSES.includes(c)), ['tb-caption']);
  assert.equal(el.list[0], 'tb-caption');
  assert.ok(el.classList.contains('tfx-metallic') && el.classList.contains('text-effect'));
  // null/빈 입력은 조용히 무시
  setTextTypeClass(null, 'tb-h1');
  afterTextTypeChange(null);
});

test('U2b 타입 목록 = 패널 버튼 data-cls 전부', () => {
  const tpl = read('js/props/prop-text-template.js');
  const btns = [...tpl.matchAll(/class="prop-type-btn[^"]*"\s+data-cls="([^"]+)"/g)].map(m => m[1]);
  assert.ok(btns.length >= 7, 'buttons found: ' + btns.length);
  assert.deepEqual([...btns].sort(), [...TEXT_TYPE_CLASSES].sort());
});

// className 대입(=, 비교 == 는 제외)
const ASSIGN = /\b(?:contentEl|newEl)\.className\s*=(?!=)/;

function shortcutRegion(src) {
  const a = src.indexOf('텍스트 타입 단축키');
  const b = src.indexOf('크기 세부조정', a);
  assert.ok(a > 0 && b > a, 'editor.js 단축키 구역을 못 찾음 — 주석이 바뀌었으면 이 테스트의 앵커를 고쳐라');
  return src.slice(a, b);
}

test('U3 양성대조 — 가드 정규식이 옛 코드 조각에선 실제로 걸린다', () => {
  assert.ok(ASSIGN.test('        contentEl.className = cls;'));
  assert.ok(ASSIGN.test('        newEl.className = cls;'));
  assert.ok(!ASSIGN.test("if (contentEl.className === 'x')"));
});

test('U3 두 호출 자리에 className 통째 대입 0건 + 헬퍼 사용', () => {
  const wire = read('js/props/prop-text-wireup-type.js');
  assert.ok(!ASSIGN.test(wire), 'prop-text-wireup-type.js 에 className 대입이 남음');
  assert.equal((wire.match(/setTextTypeClass\((?:newEl|contentEl), cls\)/g) || []).length, 2);
  const region = shortcutRegion(read('js/editor.js'));
  assert.ok(!ASSIGN.test(region), 'editor.js 단축키 경로에 className 대입이 남음');
  assert.match(region, /setTextTypeClass\(contentEl, cls\)/);
  assert.match(region, /afterTextTypeChange\(contentEl\)/);
  assert.match(region, /liner-block'\)\) return/, '라이너 가드');
});

test('U4 패널 경로: 뒤처리(sync)는 replaceWith «뒤», regate «앞»', () => {
  const wire = read('js/props/prop-text-wireup-type.js');
  const iRep = wire.indexOf('contentEl.replaceWith(newEl)');
  const iAfter = wire.indexOf('afterTextTypeChange(contentEl)');
  const iRegate = wire.indexOf('_cp?.__textGradRegate?.()');
  assert.ok(iRep > 0 && iAfter > iRep && iRegate > iAfter, `${iRep} < ${iAfter} < ${iRegate}`);
});

test('U5 afterTextTypeChange 는 window.syncTextGradShadow 를 부른다', () => {
  const calls = [];
  const had = 'window' in globalThis;
  const prev = globalThis.window;
  globalThis.window = { syncTextGradShadow: (el) => calls.push(el) };
  try {
    const el = {};
    afterTextTypeChange(el);
    assert.deepEqual(calls, [el]);
  } finally {
    if (had) globalThis.window = prev; else delete globalThis.window;
  }
});
