/* label-presets — t3-01 라벨 블럭 «내 프리셋» 저장소·꼴 함수 (js/label-presets.js · 2026-11-13 워커2)
 * 기법: 모듈 글자를 그대로 돌린다(export 만 걷음 — variant-ship-leak 의 asModule 과 같은 결) · localStorage 는 가짜를 인자로 넣는다.
 * 칸
 *   L1 등록·불러오기 — add → list 에 {id,name,style} · 꼴 키 8개만 남는다(모르는 키·글은 버림)
 *   L2 같은 이름 등록 → « (2)» · 빈 이름 → null(저장 안 함)
 *   L3 수정 — 이름 변경(같은 id) · 덮어쓰기(style 교체) · 없는 id → false
 *   L4 삭제 — remove 뒤 list 에서 빠짐 · 없는 id → false
 *   L5 망가진 저장소(JSON 깨짐 · 배열 아님 · 항목 일부 깨짐) → 읽기는 살아남고 저장소 글자는 안 건드린다
 *   L6 쓰기 실패(저장소 막힘) → add null · update/remove false — 조용히 «된 척» 안 한다
 *   L7 기본 4종 무손상 — 값 그대로 · 얼어 있다(쓰기 무시) · 사용자 프리셋이 있어도 resolve 는 기본값
 *   L8 기본 프리셋 적용은 옛 동작 그대로(bg·color·border 셋만 · 모서리·여백·모양 안 건드림)
 *   L9 read → 저장 → 다른 태그에 apply 왕복 = 같은 꼴(모서리·높이·모양·간격까지)
 * 양성대조(돌릴 사람이 확인): ⑴ listLabelUserPresets 의 JSON.parse try/catch 를 걷으면 L5 빨강(던짐)
 *   ⑵ LABEL_BUILTIN_PRESETS 의 Object.freeze 를 걷으면 L7 빨강 ⑶ _write 의 try/catch 를 걷으면 L6 빨강(던짐)
 *   ⑷ applyLabelStyleToItem 의 `if (s.radius != null …)` 를 무조건 실행으로 바꾸면 L8 빨강(기본 프리셋이 모서리를 40px 로 덮음)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js/label-presets.js'), 'utf8');
const KEY = 'goditor_label_presets';

function fakeLS({ blocked = false } = {}) {
  const m = new Map();
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (blocked) throw new Error('QuotaExceededError'); m.set(k, String(v)); },
  };
}
function load(ls) {
  const names = [...SRC.matchAll(/export\s+(?:const|function)\s+([A-Za-z0-9_$]+)/g)].map((m) => m[1]);
  assert.ok(names.length >= 10, `★내보내는 이름이 ${names.length}개뿐 — 모듈 모양이 바뀌었다`);
  return new Function('localStorage', SRC.replace(/\bexport\s+/g, '') + `\n;return { ${names.join(', ')} };`)(ls);
}
const fakeItem = (o = {}) => {
  const cls = new Set(o.cls || []);
  return { style: { ...(o.style || {}) }, dataset: { ...(o.dataset || {}) },
    classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), contains: (c) => cls.has(c) }, _cls: cls };
};
const STYLE = { bg: '#ff0000', color: '#00ff00', border: '2px solid #0000ff', radius: '8', padT: '6px', padB: '6px', shape: 'pill', gap: '14px' };

test('L1 등록·불러오기 — 꼴 키 8개만 저장된다', () => {
  const ls = fakeLS(); const M = load(ls);
  assert.deepEqual(M.listLabelUserPresets(), [], '[전제] 처음엔 비었다');
  const p = M.addLabelUserPreset('  빨강 알약 ', { ...STYLE, text: '글은 안 담는다', onclick: 'x' });
  assert.ok(p && p.id.startsWith('lp_'), '등록이 id 를 돌려준다');
  assert.equal(p.name, '빨강 알약', '이름 앞뒤 공백을 걷는다');
  const list = M.listLabelUserPresets();
  assert.equal(list.length, 1);
  assert.deepEqual(list[0].style, STYLE, '★꼴 8키만 남아야 한다(글·모르는 키 버림)');
  assert.deepEqual(JSON.parse(ls.m.get(KEY))[0].style, STYLE, '저장소에 실제로 들어갔다');
  assert.deepEqual(M.resolveLabelPreset(M.LABEL_USER_PREFIX + p.id), STYLE, 'user:<id> 로 불러온다');
});

test('L2 같은 이름 → « (2)» · 빈 이름 → 저장 안 함', () => {
  const M = load(fakeLS());
  assert.equal(M.addLabelUserPreset('A', STYLE).name, 'A');
  assert.equal(M.addLabelUserPreset('A', STYLE).name, 'A (2)');
  assert.equal(M.addLabelUserPreset('A', STYLE).name, 'A (3)');
  assert.equal(M.addLabelUserPreset('   ', STYLE), null);
  assert.equal(M.addLabelUserPreset('B', { bg: '#fff' }), null, 'color 없는 꼴은 거절');
  assert.equal(M.listLabelUserPresets().length, 3);
});

test('L3 수정 — 이름 변경·덮어쓰기는 같은 id · 없는 id 는 false', () => {
  const M = load(fakeLS());
  const a = M.addLabelUserPreset('A', STYLE); M.addLabelUserPreset('B', STYLE);
  assert.equal(M.updateLabelUserPreset(a.id, { name: '새 이름' }), true);
  assert.equal(M.updateLabelUserPreset(a.id, { name: 'B' }), true, '다른 것과 같은 이름 → (2) 로 저장');
  assert.equal(M.listLabelUserPresets().find((p) => p.id === a.id).name, 'B (2)');
  assert.equal(M.updateLabelUserPreset(a.id, { name: 'B (2)' }), true, '자기 이름 그대로는 (2)를 또 안 붙인다');
  assert.equal(M.listLabelUserPresets().find((p) => p.id === a.id).name, 'B (2)');
  const s2 = { ...STYLE, bg: '#123456', radius: '0' };
  assert.equal(M.updateLabelUserPreset(a.id, { style: s2 }), true);
  assert.deepEqual(M.resolveLabelPreset('user:' + a.id), s2, '★덮어쓴 꼴로 불러온다');
  assert.equal(M.updateLabelUserPreset('lp_없음', { name: 'x' }), false);
  assert.equal(M.updateLabelUserPreset(a.id, { name: '' }), false, '빈 이름으로 못 바꾼다');
});

test('L4 삭제', () => {
  const M = load(fakeLS());
  const a = M.addLabelUserPreset('A', STYLE); const b = M.addLabelUserPreset('B', STYLE);
  assert.equal(M.removeLabelUserPreset(a.id), true);
  assert.deepEqual(M.listLabelUserPresets().map((p) => p.id), [b.id]);
  assert.equal(M.resolveLabelPreset('user:' + a.id), null, '지운 프리셋은 못 불러온다');
  assert.equal(M.removeLabelUserPreset(a.id), false, '두 번째 삭제는 false');
});

test('L5 망가진 저장소 — 읽기는 살고 저장소 글자는 그대로', () => {
  for (const bad of ['{깨짐', '"문자열"', '{"a":1}', 'null']) {
    const ls = fakeLS(); ls.m.set(KEY, bad); const M = load(ls);
    assert.deepEqual(M.listLabelUserPresets(), [], `★${bad} 를 빈 목록으로 읽어야 한다`);
    assert.equal(ls.m.get(KEY), bad, '읽기가 저장소를 고쳐 쓰면 안 된다(사용자 데이터)');
  }
  const ls = fakeLS();
  ls.m.set(KEY, JSON.stringify([{ id: 'ok', name: '좋음', style: STYLE }, { id: 'x' }, null, { id: 'y', name: 'Y', style: { bg: 1 } }]));
  assert.deepEqual(load(ls).listLabelUserPresets().map((p) => p.id), ['ok'], '깨진 항목만 건너뛴다');
});

test('L6 쓰기 실패 — 된 척 안 한다', () => {
  const ls = fakeLS(); ls.m.set(KEY, JSON.stringify([{ id: 'ok', name: '좋음', style: STYLE }]));
  const M = load(Object.assign(ls, { setItem: () => { throw new Error('blocked'); } }));
  assert.equal(M.addLabelUserPreset('A', STYLE), null);
  assert.equal(M.updateLabelUserPreset('ok', { name: 'Z' }), false);
  assert.equal(M.removeLabelUserPreset('ok'), false);
  assert.equal(M.listLabelUserPresets()[0].name, '좋음');
});

test('L7 기본 4종 무손상', () => {
  const M = load(fakeLS());
  const WANT = {
    Default: { bg: '#111111', color: '#ffffff', border: 'none' },
    Filled: { bg: '#333333', color: '#ffffff', border: 'none' },
    Outline: { bg: 'transparent', color: '#111111', border: '1.5px solid #111111' },
    Ghost: { bg: 'rgba(0,0,0,0.06)', color: '#333333', border: 'none' },
  };
  assert.deepEqual(JSON.parse(JSON.stringify(M.LABEL_BUILTIN_PRESETS)), WANT, '★기본 4종 값이 바뀌었다');
  assert.ok(Object.isFrozen(M.LABEL_BUILTIN_PRESETS) && Object.isFrozen(M.LABEL_BUILTIN_PRESETS.Default), '★기본 프리셋이 얼어 있지 않다');
  M.addLabelUserPreset('Default', { ...STYLE });
  assert.deepEqual({ ...M.resolveLabelPreset('Default') }, WANT.Default, '같은 이름 사용자 프리셋이 기본을 가리지 않는다');
  assert.equal(M.resolveLabelPreset('toString'), null, '프로토타입 이름은 프리셋이 아니다');
  assert.equal(M.resolveLabelPreset('user:'), null);
});

test('L8 기본 프리셋 적용 = 옛 동작(bg·color·border 셋만)', () => {
  const M = load(fakeLS());
  const it = fakeItem({ style: { borderRadius: '12px', paddingTop: '3px', paddingBottom: '3px' }, dataset: { radius: '12', shape: 'pill' } });
  M.applyLabelStyleToItem(it, M.resolveLabelPreset('Outline'));
  assert.equal(it.style.backgroundColor, 'transparent');
  assert.equal(it.style.color, '#111111');
  assert.equal(it.style.border, '1.5px solid #111111');
  assert.equal(it.dataset.bg, 'transparent'); assert.equal(it.dataset.color, '#111111');
  assert.equal(it.style.borderRadius, '12px', '★기본 프리셋이 모서리를 건드렸다');
  assert.equal(it.dataset.radius, '12');
  assert.equal(it.style.paddingTop, '3px', '★기본 프리셋이 높이를 건드렸다');
});

test('L9 read → 저장 → 다른 태그 apply 왕복 = 같은 꼴', () => {
  const M = load(fakeLS());
  const src = fakeItem({ style: { backgroundColor: 'x', border: '2px solid #0000ff', paddingTop: '6px', paddingBottom: '6px' }, dataset: { bg: '#ff0000', color: '#00ff00', radius: '8', shape: 'pill' } });
  const srcBlock = { dataset: { shape: 'pill' }, style: { gap: '14px' } };
  const p = M.addLabelUserPreset('왕복', M.readLabelStyle(src, srcBlock));
  assert.deepEqual(p.style, STYLE, 'read 가 꼴 8키를 다 읽는다');
  const dst = fakeItem({ style: {}, dataset: { radius: '50%', shape: 'circle' }, cls: ['label-circle'] });
  const dstBlock = { dataset: { shape: 'circle' }, style: { gap: '4px' } };
  const s = M.resolveLabelPreset('user:' + p.id);
  M.applyLabelStyleToItem(dst, s); M.applyLabelStyleToBlock(dstBlock, s);
  assert.equal(dst.style.backgroundColor, '#ff0000'); assert.equal(dst.style.color, '#00ff00');
  assert.equal(dst.style.border, '2px solid #0000ff');
  assert.equal(dst.style.borderRadius, '8px', '원형 → 알약으로 바뀌며 모서리 8px'); assert.equal(dst.dataset.radius, '8');
  assert.equal(dst.dataset.shape, 'pill'); assert.equal(dst._cls.has('label-circle'), false);
  assert.equal(dst.style.paddingTop, '6px'); assert.equal(dst.style.paddingBottom, '6px');
  assert.equal(dstBlock.dataset.shape, 'pill'); assert.equal(dstBlock.style.gap, '14px');
  const circ = M.readLabelStyle(dst, dstBlock);
  M.applyLabelStyleToItem(src, { ...circ, shape: 'circle', radius: '50%' });
  assert.equal(src.style.borderRadius, '50%', '원형 프리셋은 50%'); assert.equal(src._cls.has('label-circle'), true);
});
