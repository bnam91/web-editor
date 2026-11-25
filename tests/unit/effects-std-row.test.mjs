/* 표준 Effects 절 «효과 한 줄»(_effects-section.js effectRowHTML · 시트 0.9.14 224 DS-EFFECTS-STD-REST-01 · 탑 OK 261125)
 *  꼴 = FigCraft ~/ref/figcraft/crates/ui-egui/src/panels/right/effects.rs:38-59 [⚙ 펼침][이름]…[끝] + 몸(:171~ 값 칸)
 *  R1 마크업 = [data-part=effect-row] › 머리 [data-part=fx-open](aria-expanded·aria-controls) + 이름 · 몸 = 옛 마크업 바이트 그대로
 *  R2 head 를 주면 이름 자리 = 그 마크업(켬/끔 체크) · end = 끝 칸
 *  P1 손짠 Effects 패널 7(cert graph mockup modal shape text-template zoom)이 sec('effects') 몸을 effectRowHTML 로 그린다 · 옛 칸 id 그대로 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkTmpRoot } from './_tmproot.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PART = path.join(ROOT, 'js', 'props', '_effects-section.js');
const has = fs.existsSync(PART);
let effectRowHTML = null;
if (has) {
  const d = mkTmpRoot('fx-row-part-');
  fs.copyFileSync(PART, path.join(d, 'fx.mjs'));
  ({ effectRowHTML } = await import(pathToFileURL(path.join(d, 'fx.mjs')).href));
}

test('R1 줄 마크업 — data-part · 펼침 단추 · 몸 바이트 그대로', () => {
  assert.ok(has, '_effects-section.js 없음');
  const body = '<div class="prop-align-group" id="x-group"><button data-val="none">없음</button></div>';
  const h = effectRowHTML({ id: 'mkp-fx-shadow', label: '그림자', body });
  assert.match(h, /<div class="ui-fx-row" data-part="effect-row" id="mkp-fx-shadow">/);
  assert.match(h, /id="mkp-fx-shadow-open" data-part="fx-open" aria-expanded="true" aria-controls="mkp-fx-shadow-body"/);
  assert.match(h, /<span class="ui-fx-row-label"[^>]*>그림자<\/span>/);
  assert.match(h, /id="mkp-fx-shadow-body">/);
  assert.ok(h.includes(body), '몸은 바이트 그대로');
});
test('R2 head = 이름 자리 마크업 그대로 · end = 끝 칸', () => {
  assert.ok(has, '_effects-section.js 없음');
  const head = '<label class="ui-check" data-part="check"><input type="checkbox" class="ui-check-box" id="zm-shadow-on" checked><span class="ui-check-label">줌 이펙트</span></label>';
  const h = effectRowHTML({ id: 'r', head, end: '<i id="e"></i>', body: '' });
  assert.ok(h.includes(head));
  assert.doesNotMatch(h, /ui-fx-row-label/);
  assert.match(h, /<i id="e"><\/i>/);
});

const PANELS = {
  cert: ['crt-fx-rot-slider', 'crt-fx-shadow'],
  graph: ['grb-drop-group'],
  mockup: ['mkp-shadow-group'],
  modal: ['mdl-drop-group', 'mdl-deco-tail-group', 'mdl-deco-tape-group'],
  shape: ['shape-redact-toggle', 'shape-ellipse-shadow-toggle'],
  'text-template': ['txt-shadow-controls'],
  zoom: ['zm-shadow-on', 'zm-drop-group'],
};
for (const [p, ids] of Object.entries(PANELS)) {
  test(`P1 ${p} — Effects 몸 = effectRowHTML · 옛 칸 id 그대로`, () => {
    const s = fs.readFileSync(path.join(ROOT, 'js', 'props', `prop-${p}.js`), 'utf8');
    assert.ok(/import \{[^}]*effectRowHTML[^}]*\} from '\.\/_effects-section\.js'/.test(s), `prop-${p}.js 가 부품을 안 부른다`);
    assert.ok(/effectRowHTML\(\{/.test(s), `prop-${p}.js 에 효과 줄이 없다`);
    for (const id of ids) assert.ok(s.includes(id), `옛 id ${id} 사라짐`);
  });
}
