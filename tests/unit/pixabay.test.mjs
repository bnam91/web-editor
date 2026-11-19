/* pixabay.test.mjs — t13A-06 무료 이미지(js/util/pixabay.js 순수 · 실키·실호출 0 · 가짜 키·모의 응답만)
 * X1 키 꼴 · 검색 조건 조임 · ★캐시 열쇠·저장 캐시에 키가 안 실린다 · 렌더러 모듈엔 «key=» 붙이는 곳 0(검색 = main)
 * X2 24시간 캐시 — 안 = 응답 · 지나면 null · 상한 넘으면 오래된 것부터 버림
 * X3 응답 거르기 — pixabay https 주소만 · 꼴 틀리면 []
 * 양성대조: _patches/free-image-CTL-key-in-renderer.patch(렌더러 모듈이 key= 주소를 지음) → X1 빨강
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
/* js/util 은 루트 package.json(commonjs) 아래라 ESM 을 data: 로 싣는다(js/fx/package.json 머리말: 이 폴더 밖에 package.json 만들지 말 것) */
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
/* 레포 규칙(cand16 단위 전수 261120 · win-portability ②-4): import 는 data: URL 말고 임시 우산(mkTmpRoot)의 .mjs 를 file: URL 로
   (js/ 의 .js 는 node 가 CommonJS 로 읽어 그대로 import 못 함). 소스는 readSrc(LF 정규화). */
const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const { mkTmpRoot } = require('./_tmproot.js');
const SRC = readSrc(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'js', 'util', 'pixabay.js');
const _dir = mkTmpRoot('pixabay-');
fs.writeFileSync(path.join(_dir, 'pixabay.mjs'), SRC);
const { cleanKey, searchParams, cacheKey, readCache, writeCache, pickHits, CACHE_TTL_MS, CACHE_MAX, CACHE_SLOT } = await import(pathToFileURL(path.join(_dir, 'pixabay.mjs')).href);

const FAKE = '00000000-fakekeyforunit00';
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m }; };

test('X1 키 꼴 · 조건 조임 · 렌더러엔 키 0', () => {
  assert.equal(cleanKey(`  ${FAKE}\n`), FAKE);
  assert.equal(cleanKey('short'), ''); assert.equal(cleanKey('bad key with space 1234'), '');
  const p = searchParams('  고양이 ', { page: 99, perPage: 5 });
  assert.deepEqual([p.q, p.page, p.per_page, p.image_type, p.safesearch], ['고양이', 20, 20, 'photo', 'true']);
  assert.ok(!cacheKey(p).includes(FAKE), '캐시 열쇠에 키 없음');
  assert.ok(!/[?&]key=/.test(SRC), '렌더러 모듈은 요청 주소에 키를 붙이지 않는다(검색 = main)');
  const s = mem(); writeCache(s, p, { hits: [] });
  assert.ok(!s._m.get(CACHE_SLOT).includes(FAKE), '저장 캐시에 키 없음');
});

test('X2 24시간 캐시 · 상한', () => {
  const s = mem(), p = searchParams('a'), t0 = 1_000_000;
  writeCache(s, p, { n: 1 }, t0);
  assert.deepEqual(readCache(s, p, t0 + 1000), { n: 1 });
  assert.equal(readCache(s, p, t0 + CACHE_TTL_MS + 1), null, '24시간 지나면 다시 묻는다');
  for (let i = 0; i < CACHE_MAX + 5; i++) writeCache(s, searchParams('q' + i), { i }, t0 + i);
  const all = JSON.parse(s._m.get(CACHE_SLOT));
  assert.equal(Object.keys(all).length, CACHE_MAX);
  assert.equal(readCache(s, searchParams('q0'), t0 + CACHE_MAX + 10), null, '가장 오래된 것 버림');
  assert.deepEqual(readCache(s, searchParams('q' + (CACHE_MAX + 4)), t0 + CACHE_MAX + 10), { i: CACHE_MAX + 4 });
});

test('X3 응답 거르기', () => {
  const hits = pickHits({ hits: [
    { id: 1, webformatURL: 'https://pixabay.com/get/a_640.jpg', largeImageURL: 'https://pixabay.com/get/a_1280.jpg', pageURL: 'https://pixabay.com/photos/a-1/', user: 'u', tags: 't', imageWidth: 4000, imageHeight: 3000 },
    { id: 2, webformatURL: 'http://evil.example/x.jpg', largeImageURL: 'https://pixabay.com/get/b.jpg' },
    { id: 3, webformatURL: 'javascript:alert(1)', largeImageURL: 'https://pixabay.com/get/c.jpg' },
  ] });
  assert.equal(hits.length, 1);
  assert.deepEqual([hits[0].id, hits[0].w, hits[0].h], [1, 4000, 3000]);
  assert.deepEqual(pickHits(null), []); assert.deepEqual(pickHits({ hits: 'x' }), []);
});
