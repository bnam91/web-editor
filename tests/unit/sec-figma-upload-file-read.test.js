/* sec-figma-upload-file-read — SEC-FIGMA-UPLOAD-FILE-READ-01 (Codex 감사 ④ · 현빈 GO 261112)
 *   ★진짜 main/figma-upload-sanitize.js 를 돌린다. 임시 «앱 폴더»와 그 밖의 «비밀» 파일을 만든다(진짜 키 0 — 표식 문자열).
 *   공격: F1 mockup.imgSrc=file://<밖 auth.json> · F2 비교표 칸 깊은 곳·대문자·앞 공백·file://localhost · F3 접두어 이웃 폴더 · 심링크로 밖
 *   정상: F4 앱 폴더 안 목업 PNG 는 같은 바이트의 data: 로 · data:/https/보통 글자는 무변
 *   배선(가드만 지우면 빨강 = 양성대조): F5 main.js figma:upload 가 tmp 에 쓰기 «전»에 sanitize · F6 변환기가 file:// 를 안 읽는다 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { mkTmpRoot } = require('./_tmproot');
const S = require('../../main/figma-upload-sanitize');

const T = mkTmpRoot('sec-figma-');
const APP = path.join(T, 'app');
const put = (p, b) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, b); return p; };
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const okPng = put(path.join(APP, 'assets', 'mockups', 'phone.png'), PNG);
const secret = put(path.join(T, 'userData', 'auth.json'), '{"sessionToken":"MARK-NOT-A-KEY"}');
const secretPng = put(path.join(T, 'userData', 'x.png'), 'MARK');
const evilPng = put(path.join(APP + '-evil', 'x.png'), 'MARK');
const u = (p) => pathToFileURL(p).href;
const run = (o) => { const n = S.sanitizeFigmaDesign(o, [APP]); return { o, n }; };

test('F1 mockup.imgSrc=file://<앱 밖 auth.json> → 빈 칸 (내용이 JSON 어디에도 없다)', () => {
  const { o, n } = run({ sections: [{ blocks: [{ type: 'mockup', imgSrc: u(secret) }] }] });
  assert.equal(o.sections[0].blocks[0].imgSrc, '');
  assert.equal(n.dropped, 1);
  assert.doesNotMatch(JSON.stringify(o), /MARK|c2Vzc2lvblRva2Vu/);
});

test('F2 깊은 곳·대문자·앞 공백·file://localhost·이미지 확장자라도 앱 밖 → 빈 칸', () => {
  const { o } = run({ a: [{ rows: [{ type: 'image', imgSrc: u(secretPng) }] }], b: 'FILE://' + secretPng, c: '  ' + u(secretPng),
                      d: 'file://localhost' + pathToFileURL(secretPng).pathname });
  assert.deepEqual([o.a[0].rows[0].imgSrc, o.b, o.c, o.d], ['', '', '', '']);
});

test('F3 접두어 이웃 폴더(app-evil) · 앱 안 심링크가 밖을 가리킴 → 빈 칸', () => {
  assert.equal(S.fileUrlToDataUri(u(evilPng), [APP]), '');
  const link = path.join(APP, 'assets', 'l.png');
  let linked = false; try { fs.symlinkSync(secretPng, link); linked = true; } catch (_) {}
  if (linked) assert.equal(S.fileUrlToDataUri(u(link), [APP]), '', '★심링크를 따라 밖을 읽었다');
});

test('F4 [정상] 앱 폴더 안 목업 PNG → 같은 바이트의 data: · data:/https/글자는 무변 · 이미지 아닌 확장자는 빈 칸', () => {
  put(path.join(APP, 'pages', 'x.html'), '<b>');
  const { o, n } = run({ m: { type: 'mockup', imgSrc: u(okPng) }, d: 'data:image/png;base64,AAAA', h: 'https://x.example/a.png', t: '파일: 이름', html: u(path.join(APP, 'pages', 'x.html')) });
  assert.equal(o.m.imgSrc, 'data:image/png;base64,' + PNG.toString('base64'));
  assert.deepEqual([o.d, o.h, o.t, o.html], ['data:image/png;base64,AAAA', 'https://x.example/a.png', '파일: 이름', '']);
  assert.deepEqual(n, { converted: 1, dropped: 1 });
});

const ROOT = path.join(__dirname, '..', '..');
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

test('F5 [배선] main.js figma:upload — tmp 에 designJSON 을 쓰기 «전»에 sanitize 를 부른다 (빼면 빨강)', () => {
  const src = rd('main.js');
  const i = src.indexOf("ipcMain.handle('figma:upload'");
  assert.ok(i > 0, '[전제] figma:upload 핸들러');
  const body = src.slice(i, src.indexOf('\n});\n', i));
  const a = body.search(/require\('\.\/main\/figma-upload-sanitize'\)\.sanitizeFigmaDesign\(designJSON, \[__dirname\]\)/);
  const b = body.indexOf('JSON.stringify(designJSON');
  assert.ok(a > 0 && b > a, `sanitize ${a} · write ${b}`);
});

test('F6 [이중 벽] 변환기 sangpe_to_figma.mjs 는 file:// 를 읽지 않는다 (readFileSync 는 입력 JSON 하나뿐)', () => {
  const src = rd('figma-renderer/sangpe_to_figma.mjs');
  assert.doesNotMatch(src, /startsWith\('file:\/\/'\)/);
  assert.equal((src.match(/readFileSync\(/g) || []).length, 1, 'readFileSync 가 늘었다 — 입력 JSON 말고 무엇을 읽나');
});
