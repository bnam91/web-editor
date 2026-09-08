/* canvas-schema-mode.test.js — get_block_schema('canvas') 의 «모드 분리» (ⓒ)
 *
 * ★왜 있나: canvas 스키마 응답이 10,547자 ≈ 2,820 토큰이었다(같은 하네스 채널 실측 2026-09-08).
 *   그중 레이어 모드(layers·patchLayers)가 2,004자인데, 실물 프로젝트의 cvb_ 블록 23개가
 *   «전부» 카드 모드였다 — 레이어 모드는 Figma 임포트용이라 대화 중엔 거의 안 쓰인다.
 *   ⇒ mode 로 갈라 «쓰는 쪽»만 기본으로 준다.
 *
 * ★이 검사가 지키는 것은 «크기»가 아니라 «분류 기준»이다.
 *   분류는 설명에 이미 붙어 있는 [simple] / [레이어 모드] 태그를 읽는다 — 목록을 새로 만들지 않는다.
 *   ⇒ 새 속성이 태그 없이 들어오면 «양쪽에 남는다»(안전). 태그가 붙으면 자동으로 갈린다.
 *
 * ⚠️함정(실제로 밟았다): 태그가 늘 '[simple]' 꼴이 아니다 — labelPos 는 '[simple,portrait]' 다.
 *   완전일치로 재면 layers 모드에서 카드 전용 속성이 «새어 나간다». C3 이 그 자리를 지킨다.
 */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startHarness } = require('./_mcp-harness');

let H;
before(async () => { H = await startHarness(); });
after(async () => { if (H) await H.stop(); });

const schema = async (args) => {
  const r = await H.call('get_block_schema', args);
  assert.ok(r.result && r.result.ok, `get_block_schema(${JSON.stringify(args)}) 실패: ${r.rawText}`);
  return r;
};
const props = (r, side) => Object.keys(r.result[side].properties);

test('C0 mode:"all" 은 «양쪽»을 다 준다 — 양성대조', async () => {
  const r = await schema({ type: 'canvas', mode: 'all' });
  const a = props(r, 'add'), u = props(r, 'update');
  assert.ok(a.includes('layers'), 'all 인데 add.layers 가 없다 — 필터가 과하게 걷어냈다');
  assert.ok(a.includes('cards'),  'all 인데 add.cards 가 없다');
  assert.ok(u.includes('patchLayers') && u.includes('patchCards'), 'all 인데 update 쪽이 반쪽이다');
  assert.equal(r.result.add.omitted, undefined, 'all 인데 «뺐다»고 말한다');
});

test('C1 기본(mode 미지정) = 카드 모드 — 레이어 전용은 안 온다', async () => {
  const r = await schema({ type: 'canvas' });
  const a = props(r, 'add'), u = props(r, 'update');
  assert.ok(!a.includes('layers'), '기본 호출에 레이어 배열이 그대로 실렸다 — 필터가 안 걸렸다');
  assert.ok(!u.includes('layers') && !u.includes('patchLayers'), 'update 쪽 레이어 속성이 남았다');
  assert.ok(a.includes('cards') && u.includes('cards') && u.includes('patchCards'),
    '카드 모드인데 cards/patchCards 가 없다 — 이러면 호출자가 «한 번 더» 물어야 한다(개악)');
});

test('C3 mode:"layers" = 레이어 모드 — [simple,portrait] 같은 «변형 태그»까지 걸러야 한다', async () => {
  const r = await schema({ type: 'canvas', mode: 'layers' });
  const a = props(r, 'add'), u = props(r, 'update');
  assert.ok(a.includes('layers') && u.includes('patchLayers'), 'layers 모드인데 레이어 속성이 없다');
  assert.ok(!a.includes('cards') && !u.includes('patchCards'), 'layers 모드에 카드 속성이 남았다');
  assert.ok(!a.includes('imgRatio'), 'layers 모드에 [simple] imgRatio 가 남았다');
  /* ★이 한 줄이 «완전일치 매칭»을 빨갛게 만든다 — labelPos 의 태그는 '[simple,portrait]' 다. */
  assert.ok(!a.includes('labelPos'),
    "layers 모드에 labelPos 가 남았다 — 태그를 '[simple]' 완전일치로 재고 있다('[simple' 접두로 재라)");
});

test('C4 «몇 개를 뺐는지» 말한다 — 조용히 빼면 호출자가 없는 줄 안다', async () => {
  const r = await schema({ type: 'canvas' });
  assert.match(String(r.result.add.omitted || ''), /\d+ props of the other mode/, 'add.omitted 안내가 없다');
  assert.match(String(r.result.add.omitted || ''), /mode:"layers"/, '되찾는 방법(mode:"layers")을 안 알려준다');
});

test('C5 공유 속성은 «양쪽 모두»에 남는다 — 과잉 필터 방지', async () => {
  const simple = props(await schema({ type: 'canvas' }), 'add');
  const layers = props(await schema({ type: 'canvas', mode: 'layers' }), 'add');
  for (const k of ['sectionId', 'layerName', 'width', 'height', 'bg', 'radius', 'gridCols', 'gridRows', 'cardGap', 'padX', 'cardMode']) {
    assert.ok(simple.includes(k), `공유 속성 ${k} 가 simple 에서 사라졌다`);
    assert.ok(layers.includes(k), `공유 속성 ${k} 가 layers 에서 사라졌다`);
  }
});

test('C6 canvas 가 «아닌» 타입은 mode 에 흔들리지 않는다', async () => {
  const a = await schema({ type: 'text' });
  const b = await schema({ type: 'text', mode: 'layers' });
  assert.equal(a.rawText, b.rawText, 'text 스키마가 mode 에 따라 달라졌다 — 필터가 타입을 안 가린다');
});

test('C7 모르는 mode 는 «거절»한다 — 오타가 조용히 all 로 떨어지면 안 된다', async () => {
  const r = await H.call('get_block_schema', { type: 'canvas', mode: 'simpel' });
  const said = JSON.stringify(r.result || r.error || r.rawText);
  assert.match(said, /invalid mode/, `오타 mode 를 통과시켰다: ${said}`);
});

test('C8 기본 호출이 «실제로» 작아졌다 — 분리가 살아 있나', async () => {
  const all  = (await schema({ type: 'canvas', mode: 'all' })).rawText.length;
  const base = (await schema({ type: 'canvas' })).rawText.length;
  assert.ok(base < all - 1500,
    `기본(${base}자)이 all(${all}자)보다 «충분히» 작지 않다 — 필터가 사실상 안 걸리고 있다`);
});
