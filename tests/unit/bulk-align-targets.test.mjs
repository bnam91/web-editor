/* U-BULKALIGN — 섹션 «Bulk Align» 이 옮길 것을 «성질»로 고르는가. (T-095, 2026-09-21)
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *
 * ★왜 이 파일이 있나
 *   고친 결함: 오른쪽 정렬을 눌러도 «글자만» 움직였다. 옛 코드가
 *   `sec.querySelectorAll('.text-block')` 한 줄이라 이미지·도형은 애초에 대상이 아니었다.
 *   (실측 dev 3f39b71 — 오른쪽 정렬 후 shape L=152·asset L=112 불변, 글자만 text-align:right)
 *
 * ⛔고치는 방법으로 «블록 이름 명부»를 새로 적지 않았다. 그래서 이 검사도 이름을 안 센다 —
 *   「폭에 여유가 있나」라는 «성질»만 잰다. 여기에 새 블록 이름이 등장하면 그건 명부가
 *   다시 생겼다는 뜻이고, 이 파일을 고치는 손이 한 번 멈춰야 한다.
 *
 * ★음성대조(이 파일을 만든 뒤 실제로 돌려 본 값)
 *   collectBulkAlignTargets 를 옛 한 줄(`[...sec.querySelectorAll('.text-block')]`)로
 *   되돌리면 T2·T3·T5 가 빨강이 난다(도형·이미지가 대상에서 사라진다). 아래 참조.
 *
 * ⚠️DOM 이 없는 자리라 getComputedStyle·offsetWidth 를 «가짜»로 세운다.
 *   진짜 CSS 위에서 재는 짝은 tests/dom/bulk-align-section.dom.spec.js 다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');

/* ── 최소 가짜 DOM ─────────────────────────────────────────────────────────
   collectBulkAlignTargets 가 실제로 만지는 면만 세운다:
   classList.contains · children · nodeType · offsetWidth · clientWidth
   · querySelector('.section-inner') · querySelectorAll('.text-block') · getComputedStyle */
class FakeEl {
  constructor(cls, { w = 100, inner = null, pos = 'static', dir = 'column', disp = 'flex', pad = 0 } = {}) {
    this.nodeType = 1;
    this._cls = new Set(String(cls).split(/\s+/).filter(Boolean));
    this.classList = { contains: (c) => this._cls.has(c) };
    this.children = [];
    this.offsetWidth = w;                       // 자기 «바깥» 폭
    this.clientWidth = inner === null ? w : inner; // 자식이 쓸 수 있는 «안» 폭(패딩 포함)
    this._style = { position: pos, flexDirection: dir, display: disp, paddingLeft: pad + 'px', paddingRight: pad + 'px' };
  }
  add(...kids) { this.children.push(...kids); return this; }
  _walk(out = []) { out.push(this); this.children.forEach(c => c._walk(out)); return out; }
  querySelector(sel) { return this._walk().find(e => e !== this && e._cls.has(sel.slice(1))) || null; }
  querySelectorAll(sel) {
    const hit = this._walk().filter(e => e !== this && e._cls.has(sel.slice(1)));
    hit.forEach = Array.prototype.forEach.bind(hit);
    return hit;
  }
}

function withFakeDom(fn) {
  const prev = globalThis.getComputedStyle;
  globalThis.getComputedStyle = (el) => el._style;
  try { return fn(); } finally {
    if (prev === undefined) delete globalThis.getComputedStyle; else globalThis.getComputedStyle = prev;
  }
}

/* ★js/*.js 는 브라우저에선 ESM 이지만 package.json 에 type:module 이 없어 Node 가 CJS 로 읽는다.
   선례(save-dirty-after-failure.test.mjs)와 «같은 벌»로 — 임시 폴더에 type:module 을 얹고 싣는다. */
const { collectBulkAlignTargets } = await (async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-bulkalign-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  fs.copyFileSync(path.join(ROOT, 'js/props/bulk-align-targets.js'), path.join(tmp, 'm.js'));
  const m = await import(pathToFileURL(path.join(tmp, 'm.js')).href);
  fs.rmSync(tmp, { recursive: true, force: true });
  return m;
})();

/* 실앱과 같은 골격 한 벌:
   section-inner(716, padding 72)
     ├ gap-block(716)                     ← 스페이서
     ├ frame-block(716) > text-block(716) ← 글자(꽉 참)
     ├ frame-block(100) > shape-block     ← 도형(여유 있음)
     └ row(716)        > asset-block(300) ← 이미지(래퍼는 꽉 참, 알맹이는 여유) */
function buildSection() {
  const textFrame  = new FakeEl('frame-block', { w: 716, inner: 716 });
  const text       = new FakeEl('text-block',  { w: 716 });
  textFrame.add(text);
  const shapeFrame = new FakeEl('frame-block', { w: 100, inner: 100 });
  shapeFrame.add(new FakeEl('shape-block', { w: 100 }));
  const row        = new FakeEl('row',         { w: 716, inner: 716 });
  const asset      = new FakeEl('asset-block', { w: 300 });
  row.add(asset);
  const gap        = new FakeEl('gap-block',   { w: 716 });
  const inner = new FakeEl('section-inner', { w: 860, inner: 860, pad: 72 }); // 860 − 72*2 = 716
  inner.add(gap, textFrame, shapeFrame, row);
  const sec = new FakeEl('section-block', { w: 860, inner: 860 });
  sec.add(inner);
  return { sec, inner, gap, textFrame, text, shapeFrame, row, asset };
}

test('T1 글자는 대상이다 (text-align 이 가로 자리를 지배)', () => {
  const { sec, text } = buildSection();
  const got = withFakeDom(() => collectBulkAlignTargets(sec));
  assert.ok(got.includes(text), '텍스트 블록이 대상에서 빠졌다');
});

test('T2 ★도형 — 폭에 여유가 있는 래퍼가 대상이다 (옛 결함: 글자만 움직였다)', () => {
  const { sec, shapeFrame } = buildSection();
  const got = withFakeDom(() => collectBulkAlignTargets(sec));
  assert.ok(got.includes(shapeFrame), '도형 래퍼(100px < 716px)가 대상에서 빠졌다');
});

test('T3 ★이미지 — 꽉 찬 래퍼는 지나가고 «안»의 알맹이가 대상이다', () => {
  const { sec, row, asset } = buildSection();
  const got = withFakeDom(() => collectBulkAlignTargets(sec));
  assert.ok(got.includes(asset), '이미지 블록(300px)이 대상에서 빠졌다');
  assert.ok(!got.includes(row), '꽉 찬 래퍼(row)는 옮길 여지가 없는데 대상에 들었다');
});

test('T4 스페이서(gap)는 대상이 아니다', () => {
  const { sec, gap } = buildSection();
  const got = withFakeDom(() => collectBulkAlignTargets(sec));
  assert.ok(!got.includes(gap), 'gap-block 은 옮길 «자리»가 없는데 대상에 들었다');
});

test('T5 ★이름이 아니라 «성질»로 고른다 — 처음 보는 블록도 따라온다', () => {
  const { sec, inner } = buildSection();
  const 미래블록 = new FakeEl('nobody-ever-heard-of-this-block', { w: 120, inner: 120 });
  inner.add(미래블록);
  const got = withFakeDom(() => collectBulkAlignTargets(sec));
  assert.ok(got.includes(미래블록), '이름을 모르는 블록이 빠졌다 — 명부가 다시 생겼다는 뜻이다');
});

test('T6 자유배치(position:absolute)는 안 건드린다 — 그 축은 좌표다', () => {
  const { sec, inner } = buildSection();
  const floating = new FakeEl('sticker-block', { w: 40, inner: 40, pos: 'absolute' });
  inner.add(floating);
  const got = withFakeDom(() => collectBulkAlignTargets(sec));
  assert.ok(!got.includes(floating), 'absolute 블록을 align-self 로 건드렸다');
});

test('T7 가로(row) 방향 그릇엔 안 내려간다 — 거기 가로축은 justify-content 다', () => {
  const { sec, inner } = buildSection();
  const flexRow = new FakeEl('row', { w: 716, inner: 716, dir: 'row' });
  const child = new FakeEl('infocard-block', { w: 200 });
  flexRow.add(child);
  inner.add(flexRow);
  const got = withFakeDom(() => collectBulkAlignTargets(sec));
  assert.ok(!got.includes(child), 'row 방향 그릇의 자식을 align-self 로 건드렸다');
});

test('T8 같은 블록을 두 번 넣지 않는다 (글자 전수훑기와 겹쳐도)', () => {
  const { sec } = buildSection();
  const got = withFakeDom(() => collectBulkAlignTargets(sec));
  assert.equal(got.length, new Set(got).size, '중복이 있다 — 정렬이 두 번 걸린다');
});

/* ── 2026-09-22 2라운드 — 「내려갔는데 못 찾았다」를 «없음»으로 읽던 자리 ──────────────
   그룹(⌘G)은 width:100% 래퍼 + 자유배치 자식이다. 옛 규칙은 「꽉 참 → 내려감 → 자식은 전부
   좌표축 → 대상 0개」로 그룹을 통째로 버렸다. 실측(포트 9634 실앱): 섹션 좌/우/가운데 어느
   것을 눌러도 그룹 속 도형이 L=308·R=308 «불변», 글자만 움직였다.
   ★음성대조: `if (visit(c, depth+1)) { found = true; continue; }` 뒤의 hasFreeChild 두 줄을
     지우고(=옛 동작) 돌리면 T9 만 빨강이 난다 — T1~T8 은 초록 그대로다. */
function buildGroupSection() {
  const group = new FakeEl('frame-block', { w: 716, inner: 716 });   // 그룹 래퍼 — 폭에 여유 0
  group.add(
    new FakeEl('frame-block', { w: 100, inner: 100, pos: 'absolute' }),
    new FakeEl('frame-block', { w: 80,  inner: 80,  pos: 'absolute' }),
  );
  const inner = new FakeEl('section-inner', { w: 860, inner: 860, pad: 72 });
  inner.add(group);
  const sec = new FakeEl('section-block', { w: 860, inner: 860 });
  sec.add(inner);
  return { sec, group };
}

test('T9 ★그룹 — 내려가도 옮길 것을 못 찾으면 «래퍼 자신»이 대상이다 (옮길 것은 그 좌표다)', () => {
  const { sec, group } = buildGroupSection();
  const got = withFakeDom(() => collectBulkAlignTargets(sec));
  assert.ok(got.includes(group), '그룹 래퍼가 통째로 대상에서 사라졌다 — 그룹 속 블록이 제자리가 된다');
});

test('T10 대조 — 안이 «자유배치가 아닌» 꽉 찬 래퍼는 여전히 대상이 아니다 (쓸모없는 align-self 금지)', () => {
  const empty = new FakeEl('frame-block', { w: 716, inner: 716 });
  empty.add(new FakeEl('gap-block', { w: 716 }));
  const inner = new FakeEl('section-inner', { w: 860, inner: 860, pad: 72 });
  inner.add(empty);
  const sec = new FakeEl('section-block', { w: 860, inner: 860 });
  sec.add(inner);
  const got = withFakeDom(() => collectBulkAlignTargets(sec));
  assert.ok(!got.includes(empty), '옮길 여지도 좌표도 없는 래퍼가 대상에 들었다');
});
