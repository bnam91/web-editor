/* section-defaults — _section-spec.js SECTION_DEFAULTS(절별 기본 항목 · 현빈 G 261123 · 태양 PLAN §4b)의 꼴을 잠근다.
 *   D1 절 key ∈ SECTION_ORDER · Kind/Content/Special 없음 · D2 부품 이름 ∈ PART_NAMES · D3 양성대조(모르는 이름·제외 절이면 판정이 잡음). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const src = fs.readFileSync(path.join(ROOT, 'js/props/_section-spec.js'), 'utf8').replace(/^export /gm, '');
const ctx = {}; vm.createContext(ctx); vm.runInContext(src + '\n;globalThis.__x = { SECTION_ORDER, SECTION_DEFAULTS, PART_NAMES };', ctx);
const { SECTION_ORDER, SECTION_DEFAULTS, PART_NAMES } = ctx.__x;
const judge = (D) => { const bad = []; for (const [k, parts] of Object.entries(D)) { if (!SECTION_ORDER.includes(k)) bad.push('모르는 절 ' + k); if (['kind', 'content', 'special'].includes(k)) bad.push('제외 절 ' + k); for (const p of parts) if (!PART_NAMES.includes(p)) bad.push('모르는 부품 ' + k + '.' + p); } return bad; };
test('D1·D2 절 key ∈ SECTION_ORDER · 제외 절 없음 · 부품 이름 ∈ PART_NAMES', () => { assert.deepEqual(judge(SECTION_DEFAULTS), []); assert.ok(Object.keys(SECTION_DEFAULTS).length >= 7); });
test('D3 양성대조 — 모르는 부품·제외 절은 잡는다', () => { assert.ok(judge({ position: ['segment'] }).length === 1); assert.ok(judge({ content: ['number'] }).length === 1); });
