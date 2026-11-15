/* Figma 렌더러 — 그리드 칸 그림(generic block.images) · 목업 화면(mockup block.screen)을 그림 채움으로 그린다
 *   FIGMA-EXPORT-GRID-IMAGES-MISSING-01 · FIGMA-EXPORT-MOCKUP-SCREEN-MISSING-01 (보내는 쪽은 tests/dom/figma-export-imgs.dom.spec.js 가 잰다)
 * 자: figma-renderer-section-height-186 과 같은 손(진짜 sangpe_to_figma.mjs + 기록하는 가짜 figma_cmd.mjs · 돌려준 id 도 적는다). ⛔실 Figma 0.
 * I0 [음성] screen·images 없는 목업·generic — 화면/칸 그림 프레임 0(옛 명령 그대로 · 옛 검정 받침 mockup_screenbg_ 1 은 그대로)
 * I1 목업 화면 — mockup_screen_ 프레임이 % 상자 자리 · 그 프레임에 set_image_fill(FILL · 화면 그림) · 틀 프레임보다 먼저(아래 층) · 둥글기 8% → 짧은 변 기준
 * I2 그리드 칸 그림 — generic 프레임 안에 gimg_ 프레임 둘 · 자리·크기 그대로 · set_image_fill 둘 · 원이면 둥글기 = 짧은 변 / 2 · data: 아닌 src 는 안 그림
 * 양성대조(예측): 렌더러 mockup 분기의 `if (_scr && …` → `if (false && …` → I1 빨강 · generic 분기의 `(block.images || [])` → `([])` → I2 빨강 · I0 초록.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkTmpRoot } from './_tmproot.js';

const ROOT = process.env.GD1001_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FAKE = `import { appendFileSync } from 'fs';
const a = process.argv; const cmd = a[a.indexOf('--command') + 1]; const p = a[a.indexOf('--params') + 1];
const id = 'n' + process.hrtime.bigint();
appendFileSync(process.env.FAKE_LOG, JSON.stringify({ cmd, params: JSON.parse(p), id }) + '\\n');
console.log(JSON.stringify(cmd === 'get_document_info' ? { children: [] } : { id }));`;

function render(blocks) {
  const dir = mkTmpRoot('renderer-imgs-');
  const src = path.join(ROOT, 'figma-renderer');
  for (const f of fs.readdirSync(src)) if (f.endsWith('.mjs')) fs.copyFileSync(path.join(src, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'figma_cmd.mjs'), FAKE);
  const json = path.join(dir, 'd.json'), log = path.join(dir, 'l.log');
  fs.writeFileSync(json, JSON.stringify({ meta: { canvasWidth: 860, theme: { sectionGap: 100 } }, sections: [{ id: 's', name: 's', background: '#ffffff', paddingBottom: 0, minHeight: 0, blocks }] }));
  const r = spawnSync('node', [path.join(dir, 'sangpe_to_figma.mjs'), 'CH', json], { encoding: 'utf8', env: { ...process.env, FAKE_LOG: log } });
  assert.equal(r.status, 0, r.stderr);
  return fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}
const named = (cmds, re) => cmds.filter((c) => c.cmd === 'create_frame' && re.test(c.params.name || ''));
const fillsOf = (cmds, id) => cmds.filter((c) => c.cmd === 'set_image_fill' && c.params.nodeId === id);
const SCR = 'data:image/png;base64,U0NSRUVO', IMG = 'data:image/png;base64,R1JJRA==', FRAME = 'data:image/png;base64,RlJBTUU=';
const MOCKUP = { type: 'mockup', id: 'm1', imgSrc: FRAME, width: 240, height: 485, offsetX: 0, offsetY: 0 };
const GRID = { type: 'generic', kind: 'grid', id: 'g1', width: 700, height: 300, bg: '', radius: 0, svg: '', texts: [] };

test('I0 [음성] screen·images 없음 — 화면/칸 그림 프레임 0', () => {
  const cmds = render([MOCKUP, GRID]);
  /* 틀 프레임 이름만 정확히 — 옛 판도 imgSrc 가 있으면 «mockup_screenbg_» 검정 받침을 그린다(이 칸 첫 판은 /^mockup_\w*m1$/ 로 둘을 같이 세 빨강 · 아이맥 29e516019+패치) */
  assert.equal(named(cmds, /^mockup_m1$/).length, 1, '[전제] 목업 틀 프레임은 그린다');
  assert.equal(named(cmds, /^mockup_screenbg_m1$/).length, 1, '[지킴] 옛 검정 받침은 그대로');
  assert.equal(named(cmds, /^grid_g1$/).length, 1, '[전제] 그리드 프레임은 그린다');
  assert.deepEqual([named(cmds, /^mockup_screen_/).length, named(cmds, /^gimg_/).length], [0, 0]);
});

test('I1 목업 화면 — % 상자 자리 · 화면 그림 채움 · 틀보다 아래 층 · 둥글기', () => {
  const cmds = render([{ ...MOCKUP, screen: { src: SCR, l: 5.5, t: 2.5, w: 89, h: 94.9, radius: '8%' } }]);
  const [sn] = named(cmds, /^mockup_screen_m1$/), [fr] = named(cmds, /^mockup_m1$/);
  assert.ok(sn, '★화면 프레임이 없다');
  const sw = Math.round(240 * 0.89), sh = Math.round(485 * 0.949);
  assert.deepEqual([sn.params.x - fr.params.x, sn.params.y - fr.params.y, sn.params.width, sn.params.height], [Math.round(240 * 0.055), Math.round(485 * 0.025), sw, sh], '화면 자리(틀 왼위 기준)·크기');
  assert.ok(cmds.indexOf(sn) < cmds.indexOf(fr), '★화면이 틀보다 위 층(나중)에 그려졌다');
  const f = fillsOf(cmds, sn.id);
  assert.equal(f.length, 1, '★화면 프레임에 그림 채움이 없다');
  assert.deepEqual([f[0].params.imageSource, f[0].params.scaleMode], ['U0NSRUVO', 'FILL']);
  assert.ok(fillsOf(cmds, fr.id).some((c) => c.params.imageSource === 'RlJBTUU='), '[지킴] 틀 PNG 는 그대로 틀 프레임에');
  const rad = cmds.find((c) => c.cmd === 'set_corner_radius' && c.params.nodeId === sn.id);
  assert.equal(rad?.params.radius, Math.round(Math.min(sw, sh) * 0.08));
});

test('I2 그리드 칸 그림 — generic 프레임 안 · 자리·크기 · 채움 · 원 둥글기 · data: 아니면 안 그림', () => {
  const images = [{ src: IMG, x: 10, y: 20, w: 100, h: 80, circle: false }, { src: IMG, x: 300, y: 40, w: 120, h: 120, circle: true }, { src: 'goya-asset://p/x.png', x: 0, y: 0, w: 5, h: 5 }];
  const cmds = render([{ ...GRID, images }]);
  const [g] = named(cmds, /^grid_g1$/), kids = named(cmds, /^gimg_/);
  assert.equal(kids.length, 2, `★칸 그림 프레임 ${kids.length}(data: 둘만)`);
  assert.ok(kids.every((k) => k.params.parentId === g.id), '칸 그림은 그리드 프레임 안');
  assert.deepEqual(kids.map((k) => [k.params.x, k.params.y, k.params.width, k.params.height]), [[10, 20, 100, 80], [300, 40, 120, 120]]);
  for (const k of kids) assert.deepEqual(fillsOf(cmds, k.id).map((c) => [c.params.imageSource, c.params.scaleMode]), [['R1JJRA==', 'FILL']]);
  const r = (k) => cmds.find((c) => c.cmd === 'set_corner_radius' && c.params.nodeId === k.id)?.params.radius ?? null;
  assert.deepEqual(kids.map(r), [null, 60]);
});
