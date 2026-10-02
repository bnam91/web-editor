/* template-folders.test.mjs — 템플릿 폴더 «목록»은 한 곳에서만 만든다 (2026-09-30)
 *
 * 무엇이 문제였나: 트리·드롭다운 «일곱 곳»이 저마다 `new Set(templates.map(t => t.folder …))` 로
 *   폴더 목록을 계산했다. 폴더가 «템플릿의 성질»로만 존재하니 빈 폴더는 다음 렌더에 사라졌다.
 *   명부(tpl-folders)를 더하면서 목록은 js/panels/template-system.js listTemplateFolders 한 곳으로 모았다.
 * 이 검사가 막는 것: 누가 다시 제 자리에서 folder 로 Set 을 만들면 그 자리만 «빈 폴더를 못 보는»
 *   드롭다운이 된다. 경고 주석으로는 못 막는다 — 기계가 센다.
 *
 * ★양성대조의 판 = 4a66f8c1(착수 직전 origin/dev). 그 판에서 T1 은 «빨강»이어야 한다(7곳이 걸린다).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, out);
    else if (/\.(js|mjs|html)$/.test(e.name)) out.push(rel);
  }
  return out;
}

// «줄 머리»에서 시작하는 주석만 걷는다(설명 문장에 적힌 옛 꼴을 세지 않게).
// ⚠️문자열 안의 `//`·`/*` 까지 걷으면 코드가 먹힌다 — 첫 판이 그래서 prop-frame.js 를 «못 봤다»(자의 오작동).
const strip = (src) => src
  .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

test('T1 ★폴더 목록을 «제 자리에서» 만드는 곳이 0이다 — 전부 listTemplateFolders 를 부른다', () => {
  const files = [...walk('js'), ...walk('pages')];
  assert.ok(files.length > 50, `★찾기부터 실패 — ${files.length}개만 봤다(분모가 깨졌다)`);
  const RE = /new Set\(\s*[\w.?()[\]]*\.map\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*\1\.folder\b/g;
  const hits = [];
  for (const f of files) {
    const src = strip(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    for (const m of src.matchAll(RE)) hits.push(`${f}: ${m[0]}`);
  }
  assert.deepEqual(hits, [], '★폴더 목록을 제 자리에서 다시 만들었다 — 빈 폴더(명부)를 못 본다.\n'
    + '  window.listTemplateFolders(templates[, 기본폴더]) 를 불러라.\n' + hits.join('\n'));
});

test('T2 목록의 정본이 실제로 명부를 합친다 — 「한 곳」이 빈 껍데기가 아니다', () => {
  const src = strip(fs.readFileSync(path.join(ROOT, 'js/panels/template-system.js'), 'utf8'));
  const m = src.match(/function listTemplateFolders\([\s\S]*?\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(m, 'listTemplateFolders 가 없다');
  assert.match(m[1], /loadFolderRegistry\(\)/, '명부를 안 합치면 빈 폴더가 또 사라진다');
  assert.match(src, /window\.listTemplateFolders\s*=\s*listTemplateFolders/);
  // 부르는 쪽 — 최소 다섯 파일(트리·블럭메뉴·섹션패널·프레임패널·인라인편집)이 이 한 곳을 탄다
  const callers = [...walk('js')].filter(f => f !== 'js/panels/template-system.js'
    && strip(fs.readFileSync(path.join(ROOT, f), 'utf8')).includes('listTemplateFolders'));
  assert.ok(callers.length >= 4, `listTemplateFolders 를 부르는 파일이 ${callers.length}개뿐: ${callers.join(', ')}`);
});
