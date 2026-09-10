'use strict';
/* ★배선을 «디스패처로» 잰다 — 소스 grep 이 아니다.
 *
 * 왜 갈아엎었나(적대검수 2026-09-07):
 *   1판의 배선 테스트는 전부 `fs.readFileSync(mcp-server.js)` + 정규식이었다.
 *   그래서 **호출문 «글자»만 남기고 가드를 죽이면 초록**이었다. 재현된 변이 둘:
 *     E9  `try { _assertImageSrcIntact(...) } catch (_) {}`        ← 예외를 삼킨다
 *     E10 put_image 의 catch 가 거절을 «기록만» 하고 계속 저장한다
 *   둘 다 «원래 버그를 그대로 되살려 놓고» 14개 테스트가 전부 초록이었다.
 *   ⇒ 회귀 방어력이 사실상 0 이었다.
 *
 * ★그래서 판정을 둘로 한다:
 *   ⑴ 도구가 «거절»을 돌려주나            (ok:false + IMAGE_TRUNCATED, 또는 JSON-RPC 에러)
 *   ⑵ ★**렌더러가 «안» 불렸나**            ← 예외를 삼키면 여기서 잡힌다. 이게 핵심이다.
 *   그리고 대조로 ⑶ 온전한 이미지에선 렌더러가 «불린다»(=가드가 전부를 막는 게 아니다).
 *
 * ⚠️포트는 9345~9365 «밖»이어야 한다 — 그 대역은 브리지가 훑는 자리다(F2).
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const zlib = require('node:zlib');

const mcp = require('../../main/claude-pm/mcp-server.js');
/* ★로그인 프로브를 «꽂는다» — 2026-09-07 부터 인증 게이트가 fail-closed 다(못 재면 거절).
   예전엔 미주입이 «통과»라 안 꽂아도 돌았는데, 그 관대함이 곧 「게이트가 증발하는 경로」였다
   (프로브와 게이트는 «같은 바이너리»라 「버전이 낡아 주입이 없다」는 논거가 성립하지 않는다).
   ⛔이 줄을 지우면 도구들이 AUTH_PROBE_MISSING 으로 죽는다 — 회귀가 아니라 정직한 신호다. */
mcp.setAuthProbe(() => ({ authed: true }));


// ── 픽스처 ────────────────────────────────────────────────────────────────
function makePng(w, h, rgb) {
  const raw = Buffer.concat(Array.from({ length: h },
    () => Buffer.concat([Buffer.from([0]), Buffer.from(Array(w).fill(rgb).flat())])));
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}
const PNG = makePng(48, 32, [200, 60, 60]);
const GOOD = 'data:image/png;base64,' + PNG.toString('base64');
// 사고와 «같은 모양»: base64 는 4의 배수라 멀쩡하고, PNG 만 짧다
const B64 = PNG.toString('base64');
const BAD = 'data:image/png;base64,' + B64.slice(0, Math.floor(B64.length * 0.7 / 4) * 4);

// ── 하네스 ────────────────────────────────────────────────────────────────
let PORT, TOKEN;
const PROJECT = 'proj_1';
const calls = [];
const spy = (name, ret) => async (...a) => { calls.push(name); return typeof ret === 'function' ? ret(...a) : ret; };

before(async () => {
  mcp.setRendererInvoker({
    scratchAdd:            spy('scratchAdd', { ok: true, scratchId: 'sp_t', x: 0, y: 0 }),
    addAssetBlock:         spy('addAssetBlock', { ok: true, assetBlockId: 'ab_t', hasImage: true }),
    updateAssetBlock:      spy('updateAssetBlock', { ok: true, applied: ['imgSrc'] }),
    updateBanner02Block:   spy('updateBanner02Block', { ok: true }),
    updateStickerBlock:    spy('updateStickerBlock', { ok: true }),
    updateIconCircleBlock: spy('updateIconCircleBlock', { ok: true }),
    updateIconTextBlock:   spy('updateIconTextBlock', { ok: true }),
    updateMockupBlock:     spy('updateMockupBlock', { ok: true }),
    editTextBlock:         spy('editTextBlock', { ok: true })
  });
  /* ★활성 프로젝트를 «있다»고 알려 준다 — 프로젝트 확정 게이트(feat/mcp-project-gate)가
     합쳐지면 쓰기 도구는 「대상을 정한 적 없다」로 «먼저» 거절한다. 그러면 이 파일은
     ⑴거절은 나는데 사유가 IMAGE_TRUNCATED 가 아니고 ⑵대조군은 렌더러가 안 불려서
     «둘 다» 깨진다. 실측: 병합본에서 이 파일만 17개 빨강(2026-09-07). */
  const r = await mcp.startMcpServer({ port: 9390, onActiveProject: () => PROJECT }); // 9345~9365 «밖»
  PORT = r.port ?? 9390;
  assert.ok(PORT < 9345 || PORT > 9365, `테스트 포트가 브리지 스캔 대역 안이다: ${PORT}`);
  TOKEN = mcp.getToken();
  /* 게이트 확정은 sticky 다 — 한 번 `expectedProject` 로 지목하면 이후 호출은 인자 없이 통과한다.
     ⛔게이트가 «없는» 트리(이 브랜치 단독)에서는 이 인자가 그냥 무시된다 ⇒ 양쪽에서 같은 파일이 돈다.
     ⚠️이 파일은 「이미지 검사가 배선됐나」를 재는 곳이지 「게이트가 막나」를 재는 곳이 아니다.
        게이트 자체의 검사는 U0 의 mcp-gate-coverage.test.js 소관이다 — 여기서 겹쳐 재지 않는다. */
  await call('update_asset_block', { blockId: 'ab_t', imgSrc: GOOD, expectedProject: PROJECT });
  calls.length = 0;
});
after(async () => { await mcp.stopMcpServer(); });

async function call(name, args) {
  const r = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
               'x-goditor-token': TOKEN },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })
  });
  const j = await r.json();
  if (j.error) return { _rpcError: j.error.message };
  const t = j.result?.content?.[0]?.text;
  try { return JSON.parse(t); } catch { return { _raw: t }; }
}
const rejected = res =>
  res.code === 'IMAGE_TRUNCATED' || /IMAGE_TRUNCATED/.test(res._rpcError || res._raw || '');

// 도구 이름, 인자 만드는 법, «불리면 안 되는» 렌더러 메서드
const SITES = [
  ['put_image',                a => ({ image: a, target: 'scratch' }),          'scratchAdd'],
  ['update_asset_block',       a => ({ blockId: 'ab_t', imgSrc: a }),           'updateAssetBlock'],
  ['update_block',             a => ({ blockId: 'ab_t', imgSrc: a }),           'updateAssetBlock'],
  ['update_banner02_block',    a => ({ blockId: 'bn2_t', imgSrc: a }),          'updateBanner02Block'],
  ['update_sticker_block',     a => ({ blockId: 'stk_t', imgSrc: a }),          'updateStickerBlock'],
  ['update_icon_circle_block', a => ({ blockId: 'icb_t', imgSrc: a }),          'updateIconCircleBlock'],
  ['update_icon_text_block',   a => ({ blockId: 'itb_t', imgSrc: a }),          'updateIconTextBlock'],
  ['update_mockup_block',      a => ({ blockId: 'mkp_t', imgSrc: a }),          'updateMockupBlock']
];

for (const [tool, mk, renderer] of SITES) {
  test(`★배선(디스패처) — ${tool} 이 잘린 이미지를 «거절»하고 ${renderer} 를 «안» 부른다`, async () => {
    calls.length = 0;
    const res = await call(tool, mk(BAD));
    assert.ok(rejected(res), `거절해야 한다. 받은 것: ${JSON.stringify(res).slice(0, 200)}`);
    assert.equal(calls.includes(renderer), false,
      `★${renderer} 가 «불렸다» — 검사를 부르고도 예외를 삼켰다는 뜻이다(적대검수 E9/E10)`);
  });
  test(`[대조] ${tool} 은 온전한 이미지에선 ${renderer} 를 «부른다»`, async () => {
    calls.length = 0;
    const res = await call(tool, mk(GOOD));
    assert.ok(!rejected(res), `통과해야 한다. 받은 것: ${JSON.stringify(res).slice(0, 200)}`);
    assert.ok(calls.includes(renderer),
      `${renderer} 가 안 불렸다 — 가드가 «전부»를 막고 있다(오탐). calls=${calls}`);
  });
}

test('★update_asset_block 도 «어디까지 봤는지»를 응답에 싣는다 (원칙 ⑶이 절반만 지켜지던 자리)', async () => {
  calls.length = 0;
  const res = await call('update_asset_block', { blockId: 'ab_t', imgSrc: GOOD });
  assert.ok(calls.includes('updateAssetBlock'), '통과해야 한다');
  assert.ok(res.imageCheck, 'imageCheck 가 응답에 있어야 한다 — put_image 에만 있으면 표면의 절반이다');
  assert.equal(res.imageCheck.checked, 'png-structure');
  assert.equal(res.imageCheck.bytes, PNG.length);
});
