/* ★에셋 «파일» 등록(op:addImage) 배선 검사.
   현빈 요구: 「폴더 안에 에셋을 읽을 수도 있니 … 넣고 뺄 수도 있고 등록할 수도 있고」.
   ⛔put_image(스크래치패드)와 «다른 일»이다 — 그걸로는 에셋 패널에 안 남는다.
   실측(2026-09-07, 격리 9370): 등록→트리(11)→sendToCanvas(ab_ 생성)→confirm 게이트→삭제(10) 전 과정 통과.
     디스크에도 assets/ast_2qqadt.png 가 실제로 생겼다(list_assets 로 확인). */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { readSrc } = require('./_srcread.js');   // ⛔CRLF — win-portability ①-3

const ROOT = path.join(__dirname, '..', '..');
const MAIN = readSrc(ROOT, 'main.js');
const SRV = readSrc(ROOT, 'main', 'claude-pm', 'mcp-server.js');
const PANEL = readSrc(ROOT, 'js', 'panels', 'assets-panel.js');

test('A0 ★양성대조 — 앱이 그 경로를 «정말» 내놓고 있나(전제부터)', () => {
  assert.match(PANEL, /window\.assetsAddImageFiles\s*=\s*assetsAddImageFiles/,
    '앱이 이 함수를 window 에 안 걸면 우리 경로가 통째로 무효다');
});

test('A1 앱 자신의 경로를 «탄다» — 디스크에 직접 쓰지 않는다', () => {
  const i = MAIN.indexOf('async function _invokeRendererAssetsMutate');
  const body = MAIN.slice(i, MAIN.indexOf('\n}\n', i));
  assert.match(body, /window\.assetsAddImageFiles\(\[file\], p\.parentId\)/,
    '앱 경로를 안 타면 「네 번째 경로 조립기」가 된다 — 저장 규칙이 갈린다');
  assert.doesNotMatch(body, /require\(['"]fs['"]\)|writeFileSync/,
    '렌더러 조각에서 파일을 직접 쓰려 하고 있다');
});

test('A2 결과를 «되읽어» 정한다 — 돌려받은 배열을 그대로 믿지 않는다', () => {
  const i = MAIN.indexOf("if (p.op === 'addImage')");
  const seg = MAIN.slice(i, i + 2200);
  assert.match(seg, /NOT_REGISTERED/,
    '앱은 지원 안 되는 형식을 «조용히 건너뛴다» — 그때 ok:true 면 거짓 성공이다');
  assert.match(seg, /idsBefore/, '전/후 차집합으로 새 노드를 특정해야 한다');
});

test('A3 MCP 층이 형식·크기를 «먼저» 막는다', () => {
  const i = SRV.indexOf("if (op === 'addImage')");
  assert.ok(i > 0, 'addImage 게이트가 없다');
  const seg = SRV.slice(i, i + 900);
  assert.match(seg, /data:image\\\/\(png\|jpeg\|gif\|webp\|svg/, '허용 mime 을 안 재고 있다');
  assert.match(seg, /TOO_LARGE/, '크기 상한이 없다 — 대화가 터진다');
});

test('A4 addImage 가 op 목록·스키마 «양쪽»에 있다 (한쪽만이면 조용히 거절된다)', () => {
  assert.match(SRV, /const OPS = \[[^\]]*'addImage'/, 'OPS 에 없다');
  assert.match(SRV, /enum: \['createFolder', 'addUrl', 'addImage'/, '스키마 enum 에 없다');
});

test('A5 ★변이대조 — OPS 에서 addImage 를 빼면 A4 가 빨개져야 한다', () => {
  const mutated = SRV.replace(/const OPS = \['createFolder', 'addUrl', 'addImage'/,
                              "const OPS = ['createFolder', 'addUrl'");
  assert.doesNotMatch(mutated, /const OPS = \[[^\]]*'addImage'/,
    '변이가 안 먹었다 = A4 는 이 배선을 «안» 본다');
});
