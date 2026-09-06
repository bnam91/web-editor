#!/usr/bin/env node
/* F6 실기 픽스처 «생성기» — 2026-09-07 (U0)
 *
 * 왜 생성기인가: 픽스처가 손으로 만들어지면 「해시가 다르다」가 났을 때 «누가 옳은지»를 못 가린다.
 *   ⇒ 결정적(seeded)으로 만들고 manifest.json 에 sha256 을 박는다. 재생성이 같은 해시를 내야 한다.
 *
 * 구성(계획서 §4-F6): 섹션 2 · 텍스트 3 · 사진 2×3,400B · ★사진 1×400,000B · 표 5×4 · 갭 2 · 프레임 안 텍스트 1
 *   ★사진 3장 중 2장은 «인라인 dataURL» 로 둔다 — F4 의 `base64,` 금지 검사가 «자극 없는 초록»이 되지
 *     않게 하는 자리다. DOM 에 base64 가 «실제로 있는데» 응답엔 0건이어야 참이다.
 *
 * 사용: node tests/fixtures/mcp-canvas-fixture/make-fixture.mjs [--check]
 *   --check = 다시 만들어 manifest 와 대조만 한다(파일 안 씀). 0=일치 1=불일치 2=검사불가
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import zlib from 'node:zlib';

const DIR = dirname(fileURLToPath(import.meta.url));
const IMG = join(DIR, 'img');
const CHECK = process.argv.includes('--check');
const sha = (b) => createHash('sha256').update(b).digest('hex');

/* ── 결정적 PNG ── seeded LCG 픽셀 → zlib(level 9) → 정확한 목표 바이트까지 tEXt 로 패딩 */
function crc32(buf) {
  let c, t = crc32._t;
  if (!t) { t = crc32._t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function makePng(w, h, seed, targetBytes) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) >>> 24);
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (1 + w * 3) + 1 + x * 3;
      raw[o] = rnd(); raw[o + 1] = rnd(); raw[o + 2] = rnd();
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const body = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 }))]);
  const tail = chunk('IEND', Buffer.alloc(0));
  const need = targetBytes - body.length - tail.length;
  if (need < 0) throw new Error(`목표 ${targetBytes}B 가 최소 크기 ${body.length + tail.length}B 보다 작다 — w/h 를 줄여라`);
  // tEXt: keyword\0text  (청크 오버헤드 12B + "pad\0" 4B)
  const padText = Buffer.concat([Buffer.from('pad\0', 'latin1'), Buffer.alloc(Math.max(0, need - 16), 0x61)]);
  const out = need >= 16 ? Buffer.concat([body, chunk('tEXt', padText), tail]) : Buffer.concat([body, tail]);
  if (out.length !== targetBytes) throw new Error(`패딩 실패: ${out.length} ≠ ${targetBytes}`);
  return out;
}

const smallA = makePng(28, 28, 0xA11CE, 3400);
const smallB = makePng(28, 28, 0xB0B, 3400);
const big    = makePng(340, 340, 0xC0FFEE, 400000);
const dataUrl = (b) => 'data:image/png;base64,' + b.toString('base64');

/* ── DOM ── canvas-state.js 가 읽는 구조 그대로(#canvas > .section-block > [id]) */
const html = `<!-- ⚠️생성물이다. 손으로 고치지 마라 — make-fixture.mjs 를 고치고 다시 돌려라. -->
<div id="canvas">
  <div class="section-block" id="sec_fixt_1" data-name="히어로">
    <div class="text-block" id="tb_fx_h1" data-type="heading"><div class="tb-heading" style="color: rgb(17, 17, 17); font-size: 40px; text-align: center;">픽스처 제목</div></div>
    <div class="text-block" id="tb_fx_b1" data-type="body"><div class="tb-body" style="text-align: left;">본문 한 줄. 이 문장은 120자 상한을 «안» 넘긴다 — 잘림 표시가 붙으면 안 된다.</div></div>
    <div id="gb_fx_1" style="height: 48px;"></div>
    <div id="ab_fx_small_a"><img src="img/small-a.png" width="28" height="28"></div>
    <div id="ab_fx_small_b"><img src="${dataUrl(smallB)}" width="28" height="28"></div>
  </div>
  <div class="section-block" id="sec_fixt_2" data-name="스펙">
    <div id="tbl_fx_1"><table><tr><th>항목</th><th>A</th><th>B</th><th>C</th></tr><tr><td>무게</td><td>1</td><td>2</td><td>3</td></tr><tr><td>크기</td><td>4</td><td>5</td><td>6</td></tr><tr><td>가격</td><td>7</td><td>8</td><td>9</td></tr><tr><td>보증</td><td>10</td><td>11</td><td>12</td></tr></table></div>
    <div id="gb_fx_2" style="height: 24px;"></div>
    <div id="ab_fx_big"><img src="${dataUrl(big)}" width="340" height="340"></div>
    <div id="ss_fx_frame_1">
      <div class="text-block" id="tb_fx_inframe" data-type="body"><div class="tb-body" style="text-align: center;">프레임 «안»의 텍스트 — 이게 빠지면 #1 결함 재발이다.</div></div>
    </div>
  </div>
</div>
`;

/* ── 렌더러 끝의 «정본» ── canvas-state.js 의 규칙을 그대로 적용한 기대값.
 *   ⚠️innerText/naturalWidth 는 브라우저에서만 나온다 → 여기 값은 «node 하네스용 canned» 다.
 *      진짜 렌더러와의 대조는 tests/dom/canvas-state.dom.spec.js 가 크로미움에서 한다. */
const canvasState = {
  ok: true,
  sections: [
    {
      sectionId: 'sec_fixt_1', name: '히어로',
      blocks: [
        { blockId: 'tb_fx_h1', type: 'heading', text: '픽스처 제목', color: 'rgb(17, 17, 17)', fontSize: '40px', align: 'center' },
        { blockId: 'tb_fx_b1', type: 'body', text: '본문 한 줄. 이 문장은 120자 상한을 «안» 넘긴다 — 잘림 표시가 붙으면 안 된다.', color: '', fontSize: '', align: 'left' },
        { blockId: 'gb_fx_1', type: 'gap', summary: { height: '48px' } },
        { blockId: 'ab_fx_small_a', type: 'asset', summary: { image: 'small-a.png', natural: '28x28' } },
        { blockId: 'ab_fx_small_b', type: 'asset', summary: { image: '(inline data)', natural: '28x28' } },
      ],
    },
    {
      sectionId: 'sec_fixt_2', name: '스펙',
      blocks: [
        { blockId: 'tbl_fx_1', type: 'table', summary: { rows: 5, headers: ['항목', 'A', 'B', 'C'] } },
        { blockId: 'gb_fx_2', type: 'gap', summary: { height: '24px' } },
        { blockId: 'ab_fx_big', type: 'asset', summary: { image: '(inline data)', natural: '340x340' } },
        { blockId: 'ss_fx_frame_1', type: 'frame', summary: { preview: '프레임 «안»의 텍스트 — 이게 빠지면 #1 결함 재발이다.' } },
        { blockId: 'tb_fx_inframe', type: 'body', text: '프레임 «안»의 텍스트 — 이게 빠지면 #1 결함 재발이다.', color: '', fontSize: '', align: 'center' },
      ],
    },
  ],
};

const counts = { sections: 2, text: 3, photos: 3, photoBytes: [3400, 3400, 400000], table: '5x4', gaps: 2, textInFrame: 1 };
const files = {
  'img/small-a.png': smallA,
  'img/small-b.png': smallB,
  'img/big.png': big,
  'canvas.html': Buffer.from(html, 'utf8'),
  'canvas-state.json': Buffer.from(JSON.stringify(canvasState, null, 2) + '\n', 'utf8'),
};
const manifest = {
  note: '생성물. make-fixture.mjs 로만 고친다. --check 로 대조.',
  counts,
  sha256: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, sha(v)])),
  bytes: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.length])),
};

if (CHECK) {
  const mp = join(DIR, 'manifest.json');
  if (!existsSync(mp)) { console.error('[검사불가] manifest.json 없음'); process.exit(2); }
  const have = JSON.parse(readFileSync(mp, 'utf8'));
  const bad = [];
  for (const [k, v] of Object.entries(manifest.sha256)) {
    const p = join(DIR, k);
    if (!existsSync(p)) { bad.push(`${k}: 파일 없음`); continue; }
    const disk = sha(readFileSync(p));
    if (disk !== v) bad.push(`${k}: 디스크 ${disk.slice(0, 12)} ≠ 생성 ${v.slice(0, 12)}`);
    if (have.sha256?.[k] !== v) bad.push(`${k}: manifest ${String(have.sha256?.[k]).slice(0, 12)} ≠ 생성 ${v.slice(0, 12)}`);
  }
  if (bad.length) { console.error('❌ 픽스처 불일치 — «비교 불가»:\n  ' + bad.join('\n  ')); process.exit(1); }
  console.log('✅ 픽스처 일치 (' + Object.keys(manifest.sha256).length + '개 파일)');
  process.exit(0);
}

mkdirSync(IMG, { recursive: true });
for (const [k, v] of Object.entries(files)) writeFileSync(join(DIR, k), v);
writeFileSync(join(DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('생성 완료:', Object.entries(manifest.bytes).map(([k, v]) => `${k}=${v}B`).join(' · '));
